'use strict'
/* Le socle : ce que tous les moules partagent.

   Une ÉNIGME est une fiche : son récit, sa source, ses pièces, sa règle — des
   données, pas de code. Un MOULE est une façon de jouer (embarquer, verser,
   poser des pièces…) : il sait partir d'une fiche, appliquer un coup, dire si
   c'est gagné, et dessiner l'écran. Le socle range les deux, résout une fiche
   pour la vérifier, et prête ses outils.

   Ce fichier et les moules se chargent aussi sans navigateur (`verifier.mjs`) :
   rien ici ne touche au document tant qu'on n'appelle pas `P.h` ou un
   `dessiner`. C'est ce qui permet de résoudre chaque fiche avant qu'elle entre.

   Le contrat d'un moule (`P.moule({...})`) :
     cle, nom, socle, glyphe, unite         — son nom de code, sa catégorie affichée, son socle
                                              (chemin, pose, sonde, preuve, duel, lettre), son
                                              glyphe, et ce que compte un coup (« traversées »)
     depart(f) → etat                        — l'état de départ, un objet simple
     jouer(f, e, coup) → { etat } | { refus } — applique un coup, ou dit pourquoi non (une phrase)
     fini(f, e) → null | { gagne } | { perdu } — `perdu` est la phrase que dit le Sphinx
     coups(f, e) → [coup]                    — tous les coups permis : c'est par là qu'on résout
     compte(coup) → bool                     — facultatif : faux pour un geste qui n'est pas un coup
     riposte(f, e) → coup | null             — facultatif : le coup du Sphinx, dans un duel
     verifier(f) → { ok, coups, solution, note } — facultatif : sinon, le plus court chemin
     tirer(graine, niveau) → fiche           — facultatif : fabrique une énigme, pour un puits sans fond
     dessiner(c) → Element                   — c = { f, e, agir(coup), dire(phrase), fige }
*/
const P = (globalThis.P = globalThis.P || {})

P.moules = {}
P.fiches = []
P.styles = []

P.SOCLES = {
  chemin: { nom: 'Le Chemin', dit: 'Une suite de coups, jusqu’au but.' },
  pose: { nom: 'La Pose', dit: 'Placer ou tracer, sous une contrainte.' },
  preuve: { nom: 'La Preuve', dit: 'Des indices, une seule conclusion.' },
  sonde: { nom: 'La Sonde', dit: 'Le Sphinx cache quelque chose : questionne-le.' },
  duel: { nom: 'Le Duel', dit: 'Tu joues contre lui, et il ne se trompe jamais.' },
  lettre: { nom: 'La Lettre', dit: 'Des mots, des chiffres, des codes.' },
}

P.moule = m => {
  if (!P.SOCLES[m.socle]) throw new Error(`Le moule « ${m.cle} » ne nomme pas un socle connu.`)
  P.moules[m.cle] = m
  return m
}
P.fiche = f => {
  if (!P.moules[f.moule]) throw new Error(`La fiche « ${f.id} » nomme un moule inconnu : ${f.moule}.`)
  if (P.fiches.some(x => x.id === f.id)) throw new Error(`Deux fiches portent le même nom : ${f.id}.`)
  P.fiches.push(f)
  return f
}
/** La feuille d'un moule : il l'apporte avec lui, sans toucher à celle de la page. */
P.style = css => { P.styles.push(css) }

/* ------------------------------------------------------------------ */
/* Les mots                                                            */
/* ------------------------------------------------------------------ */

// Les espaces du français : une ponctuation haute ne passe jamais seule à la ligne.
P.fr = s => String(s).replace(/ ([;:!?])/g, ' $1').replace(/« /g, '« ').replace(/ »/g, ' »').replace(/n° /g, 'n° ')
// Sans accents, sans majuscules, sans article, sans « c'est » : la même réponse écrite de deux façons reste la même.
const ARTICLES = new Set(['l', 'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'mon', 'ma', 'mes'])
P.normaliser = s => {
  const mots = String(s).toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean)
  if (mots[0] === 'c' && mots[1] === 'est') mots.splice(0, 2)
  while (mots.length > 1 && ARTICLES.has(mots[0])) mots.shift()
  return mots.join('')
}
P.pluriel = (n, mot, mots = mot + 's') => `${n} ${n > 1 ? mots : mot}`

/* ------------------------------------------------------------------ */
/* Le hasard, toujours le même pour une même graine                    */
/* ------------------------------------------------------------------ */

// Une énigme tirée se retrouve telle quelle : le palier 40 du puits est le même à chaque visite.
P.alea = graine => {
  let a = (graine >>> 0) || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
P.entier = (alea, a, b) => a + Math.floor(alea() * (b - a + 1))
P.parmi = (alea, liste) => liste[Math.floor(alea() * liste.length)]
P.melanger = (alea, liste) => {
  const l = liste.slice()
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1))
    ;[l[i], l[j]] = [l[j], l[i]]
  }
  return l
}

/* ------------------------------------------------------------------ */
/* Résoudre                                                            */
/* ------------------------------------------------------------------ */

P.signature = (m, e) => (m.signature ? m.signature(e) : JSON.stringify(e))

/** Le plus court chemin d'une fiche, par ses coups qui comptent : null si elle n'a pas de solution. */
P.plusCourt = (m, f, max = 400000) => {
  const depart = m.depart(f)
  const vus = new Map([[P.signature(m, depart), null]])
  let front = [depart]
  let profondeur = 0
  while (front.length && vus.size <= max) {
    const suivant = []
    for (const e of front) {
      if (m.fini(f, e)?.gagne) {
        const solution = []
        for (let k = P.signature(m, e); vus.get(k); k = vus.get(k).d) solution.unshift(vus.get(k).coup)
        return { coups: profondeur, solution }
      }
      for (const coup of m.coups(f, e)) {
        const r = m.jouer(f, e, coup)
        if (!r.etat || m.fini(f, r.etat)?.perdu) continue
        const k = P.signature(m, r.etat)
        if (vus.has(k)) continue
        vus.set(k, { d: P.signature(m, e), coup })
        suivant.push(r.etat)
      }
    }
    front = suivant
    profondeur++
  }
  return null
}
/** Ce que le programme sait d'une fiche avant qu'elle entre : qu'elle se résout, et en combien de coups. */
P.verifier = f => {
  const m = P.moules[f.moule]
  if (m.verifier) return m.verifier(f)
  const r = P.plusCourt(m, f)
  return r ? { ok: true, coups: r.coups, solution: r.solution } : { ok: false, note: 'aucune solution' }
}
// Une fiche ne se résout qu'une fois par visite : le puits la redemande à chaque écran.
const verdicts = new Map()
P.verdict = f => {
  if (!verdicts.has(f.id)) verdicts.set(f.id, P.verifier(f))
  return verdicts.get(f.id)
}

/* ------------------------------------------------------------------ */
/* Dessiner                                                            */
/* ------------------------------------------------------------------ */

// Des glyphes de neuf pixels de côté ; chaque moule ajoute le sien (`P.glyphes.barque = [...]`).
P.glyphes = {
  ankh: ['...###...', '..#...#..', '..#...#..', '...###...', '.#######.', '....#....', '....#....', '....#....', '....#....'],
  voix: ['....#....', '...##..#.', '.####...#', '.####.#.#', '.####...#', '...##..#.', '....#....', '.........', '.........'],
  muet: ['....#....', '...##....', '.####.#.#', '.####..#.', '.####.#.#', '...##....', '....#....', '.........', '.........'],
  etoile: ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.'],
  corde: ['....#....', '...#.....', '....#....', '.....#...', '....#....', '...#.....', '....#....', '...###...', '...###...'],
  livre: ['.........', '.###.###.', '#...#...#', '#.#.#.#.#', '#...#...#', '#.#.#.#.#', '#...#...#', '.###.###.', '....#....'],
}
P.glyphe = (nom, taille) => {
  let r = ''
  ;(P.glyphes[nom] || P.glyphes.ankh).forEach((ligne, y) => [...ligne].forEach((c, x) => { if (c === '#') r += `<rect x="${x}" y="${y}" width="1.03" height="1.03"/>` }))
  return `<svg viewBox="0 0 9 9" width="${taille}" height="${taille}" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`
}
P.h = (tag, attrs, ...enfants) => {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue
    if (k === 'class') el.className = v
    else if (k === 'html') el.innerHTML = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else el.setAttribute(k, v === true ? '' : k === 'placeholder' || k === 'aria-label' ? P.fr(v) : v)
  }
  for (const e of enfants.flat()) if (e != null && e !== false) el.append(typeof e === 'string' ? P.fr(e) : e)
  return el
}
