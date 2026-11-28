'use strict'
/* Qui fait quoi : trois ou quatre personnages, deux séries d'attributs (un métier
   et un instrument, une bête et une couleur…), quelques indices, et une seule
   répartition possible. C'est la forme des problèmes à grille — Lewis Carroll en
   posait déjà dans ses jeux de logique, et la devinette dite d'Einstein en a fait
   la réputation. Pas de grille de croix ici : elle ne tient pas dans 328 pixels.
   Chacun reçoit une puce par série, et chaque valeur n'est qu'à un seul.

   Une fiche donne : `gens`, `series` (pour chacune son `nom`, son `verbe` et sa
   forme niée, et ses `valeurs` — la puce, l'objet du verbe, et « celui qui… » pour
   les indices qui lient deux séries), `indices`, et `rep` : rep[s][p] est la valeur
   de la série s qu'a le personnage p. `essais` vaut 3 : on vérifie d'un coup, et un
   indice trahi est nommé. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.grille = ['.........', '.#######.', '.#..#..#.', '.#..#..#.', '.#######.', '.#..#..#.', '.#..#..#.', '.#######.', '.........']

  P.style(`
.gr { display: grid; gap: 6px; }
.gr-ind { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
.gr-ind li { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 6px; font: 500 12px/1.25 var(--f-texte); color: var(--ink); }
.gr-ind b { font: 600 12px/1.25 var(--f-pixel); color: var(--or); }
.gr-qui { display: grid; grid-template-columns: 58px minmax(0, 1fr); align-items: center; gap: 6px; }
.gr-qui b { font: 600 15px/1.1 var(--f-titre); color: var(--or-clair); overflow-wrap: anywhere; }
.gr-puces { display: grid; gap: 3px; }
.gr-rang { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 3px; }
.gr-p { min-height: 40px; padding: 2px 1px; overflow: hidden; text-overflow: ellipsis; font: 500 12px/1.1 var(--f-texte); color: var(--ink); background: linear-gradient(180deg, var(--pierre), var(--boite)); border: 1px solid rgba(217, 181, 106, 0.38); border-radius: 9px; }
.gr-rang.s1 .gr-p { border-color: rgba(111, 151, 196, 0.55); }
.gr-p:active { translate: 0 1px; }
.gr-p.ailleurs { opacity: 0.45; }
.gr-p.pris { opacity: 1; background: var(--or); border-color: var(--or); color: #1a1412; font-weight: 700; }
.gr-p[disabled] { cursor: default; }
`)

  const cap = s => s[0].toUpperCase() + s.slice(1)
  const val = (f, s, v) => f.series[s].valeurs[v]
  const liste = noms => (noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}` : noms[0])
  // « Khéti est le scribe » : un personnage et une valeur, dans le verbe de la série.
  const dit = (f, p, s, v) => `${f.gens[p]} ${f.series[s].verbe} ${val(f, s, v).obj}`

  function texte(f, i) {
    if (i.t === 'non') return `${f.gens[i.p]} ${f.series[i.s].nverbe} ${val(f, i.s, i.v).nobj ?? val(f, i.s, i.v).obj}.`
    if (i.t === 'lie') return `${cap(val(f, i.a[0], i.a[1]).le)} ${f.series[i.b[0]].verbe} ${val(f, i.b[0], i.b[1]).obj}.`
    return `${f.gens[i.p]} ${f.series[i.s].verbe} ${val(f, i.s, i.v[0]).obj} ou ${val(f, i.s, i.v[1]).obj}.`
  }
  // Un indice est-il vrai de cette répartition ?
  function tient(i, rep) {
    if (i.t === 'non') return rep[i.s][i.p] !== i.v
    if (i.t === 'ou') return i.v.includes(rep[i.s][i.p])
    return rep[i.a[0]].indexOf(i.a[1]) === rep[i.b[0]].indexOf(i.b[1])
  }
  const permutations = n => (n <= 1 ? [[0]] : permutations(n - 1).flatMap(q => Array.from({ length: n }, (_, k) => [...q.slice(0, k), n - 1, ...q.slice(k)])))
  const solutions = f => {
    const ps = permutations(f.gens.length)
    return ps.flatMap(a => ps.map(b => [a, b])).filter(rep => f.indices.every(i => tient(i, rep)))
  }

  /* Ce qu'un joueur fait avec un crayon : écarter, relier, et se dire « il ne reste que celui-là ».
     On range pour chaque personnage les valeurs encore permises, et on note, à chaque case qu'une
     déduction ferme, quels indices l'ont fermée. Quand tout est déterminé, la grille se lit sans
     jamais supposer : c'est la condition pour qu'une énigme tirée soit juste, et c'est de là que
     vient l'explication. */
  function deduire(f) {
    const n = f.gens.length
    const tous = () => Array.from({ length: 2 }, () => Array.from({ length: n }, () => new Set(Array.from({ length: n }, (_, v) => v))))
    const cand = tous()
    const raisons = new Map()
    const annonce = new Set()
    const etapes = []
    const retire = (s, p, v, r) => {
      if (!cand[s][p].delete(v)) return
      const k = `${s}:${p}:${v}`
      raisons.set(k, (raisons.get(k) || new Set()).add(r))
    }
    const refs = (cles, r0) => {
      const tout = new Set()
      cles.forEach(k => (raisons.get(k) || []).forEach(r => tout.add(r)))
      return [...tout]
    }
    // Chaque case qui n'a plus qu'une valeur — ou chaque valeur qui n'a plus qu'une place — est une étape.
    const balayer = () => {
      for (let s = 0; s < 2; s++) {
        for (let p = 0; p < n; p++) {
          if (cand[s][p].size !== 1 || annonce.has(`p${s}:${p}`)) continue
          const [v] = cand[s][p]
          annonce.add(`p${s}:${p}`)
          annonce.add(`v${s}:${v}`)
          etapes.push({ s, p, v, r: refs(Array.from({ length: n }, (_, w) => `${s}:${p}:${w}`).filter(k => raisons.has(k))) })
        }
        for (let v = 0; v < n; v++) {
          const ou = [...Array(n).keys()].filter(p => cand[s][p].has(v))
          if (ou.length !== 1 || annonce.has(`v${s}:${v}`)) continue
          annonce.add(`v${s}:${v}`)
          annonce.add(`p${s}:${ou[0]}`)
          etapes.push({ s, p: ou[0], v, r: refs(Array.from({ length: n }, (_, p) => `${s}:${p}:${v}`).filter(k => raisons.has(k))) })
        }
      }
    }
    for (let tour = 0; tour < 40; tour++) {
      const avant = cand.map(l => l.map(c => c.size).join()).join('|')
      f.indices.forEach((i, k) => {
        const r = k + 1
        if (i.t === 'non') retire(i.s, i.p, i.v, r)
        else if (i.t === 'ou') {
          for (const v of [...cand[i.s][i.p]]) if (!i.v.includes(v)) retire(i.s, i.p, v, r)
        } else {
          const [[s0, v0], [s1, v1]] = [i.a, i.b]
          for (let p = 0; p < n; p++) {
            if (!cand[s0][p].has(v0)) retire(s1, p, v1, r)
            if (!cand[s1][p].has(v1)) retire(s0, p, v0, r)
          }
        }
        balayer()
      })
      // Une valeur prise par l'un ne revient pas à un autre ; une place qui n'a plus qu'un candidat est à lui.
      for (let s = 0; s < 2; s++) {
        for (let p = 0; p < n; p++) if (cand[s][p].size === 1) for (let q = 0; q < n; q++) if (q !== p) retire(s, q, [...cand[s][p]][0], 'pris')
        for (let v = 0; v < n; v++) {
          const ou = [...Array(n).keys()].filter(p => cand[s][p].has(v))
          if (ou.length === 1) for (const w of [...cand[s][ou[0]]]) if (w !== v) retire(s, ou[0], w, 'pris')
        }
      }
      balayer()
      if (cand.map(l => l.map(c => c.size).join()).join('|') === avant) break
    }
    return { fait: cand.every(l => l.every(c => c.size === 1)), etapes }
  }

  // « indice 2 », « indices 1 et 3, places déjà prises » : d'où vient une case fermée.
  const dEou = r => {
    const nums = r.filter(x => x !== 'pris').sort((a, b) => a - b)
    const morceaux = []
    if (nums.length) morceaux.push(`${nums.length > 1 ? 'indices' : 'indice'} ${liste(nums)}`)
    if (r.includes('pris')) morceaux.push('places déjà prises')
    return morceaux.join(', ') || 'par élimination'
  }
  function expliquer(f) {
    const { etapes } = deduire(f)
    const phrases = etapes.slice(0, 3).map(e => `${dit(f, e.p, e.s, e.v)} : tout le reste est écarté (${dEou(e.r)}).`)
    if (phrases.length < 3) phrases.unshift('Commence par les indices qui écartent le plus de cases.')
    const bilan = f.gens.map((nom, p) => `${nom} ${f.series[0].verbe} ${val(f, 0, f.rep[0][p]).obj}, ${f.series[1].verbe} ${val(f, 1, f.rep[1][p]).obj}`)
    phrases.push(`${etapes.length > 3 ? 'Le reste en découle' : 'Au total'} : ${bilan.join(' ; ')}.`)
    return phrases
  }

  const NOMS = ['Khéti', 'Ouni', 'Néferet', 'Iry', 'Méryt', 'Hori']
  const v = (court, obj, le, nobj) => ({ court, obj, le, nobj: nobj ?? obj })
  /* Trois thèmes : chaque série a son verbe, ses objets, et la façon de désigner « celui qui » —
     « le potier », « le joueur de harpe » — pour les indices qui relient les deux séries. */
  const THEMES = [
    {
      titre: 'Les artisans du village',
      recit: N => [`${N} amis ont chacun un métier et un instrument.`, 'Aucun métier ne se répète, aucun instrument non plus.', 'Voici mes indices : à toi de les ranger.'],
      series: [
        { nom: 'métier', verbe: 'est', nverbe: 'n’est pas', valeurs: [v('scribe', 'le scribe', 'le scribe'), v('potier', 'le potier', 'le potier'), v('pêcheur', 'le pêcheur', 'le pêcheur'), v('maçon', 'le maçon', 'le maçon')] },
        { nom: 'instrument', verbe: 'a', nverbe: 'n’a pas', valeurs: [v('harpe', 'la harpe', 'le joueur de harpe'), v('flûte', 'la flûte', 'le joueur de flûte'), v('luth', 'le luth', 'le joueur de luth'), v('tambour', 'le tambour', 'le joueur de tambour')] },
      ],
    },
    {
      titre: 'Les bêtes du marché',
      recit: N => [`${N} voisins gardent chacun une bête et portent chacun une couleur.`, 'Aucune bête ni aucune couleur ne se répète.', 'Mes indices suffisent : trouve qui garde quoi.'],
      series: [
        { nom: 'bête', verbe: 'garde', nverbe: 'ne garde pas', valeurs: [v('chat', 'le chat', 'le gardien du chat'), v('chien', 'le chien', 'le gardien du chien'), v('âne', 'l’âne', 'le gardien de l’âne'), v('faucon', 'le faucon', 'le gardien du faucon')] },
        { nom: 'couleur', verbe: 'porte', nverbe: 'ne porte pas', valeurs: [v('rouge', 'le rouge', 'celui qui porte le rouge'), v('bleu', 'le bleu', 'celui qui porte le bleu'), v('vert', 'le vert', 'celui qui porte le vert'), v('jaune', 'le jaune', 'celui qui porte le jaune')] },
      ],
    },
    {
      titre: 'Le banquet des voyageurs',
      recit: N => [`${N} voyageurs ont chacun leur mets préféré et leur ville.`, 'Chacun a un mets différent, et une ville différente.', 'Je n’en dis pas plus que mes indices.'],
      series: [
        { nom: 'mets', verbe: 'mange', nverbe: 'ne mange pas', valeurs: [v('figues', 'des figues', 'le mangeur de figues', 'de figues'), v('miel', 'du miel', 'le mangeur de miel', 'de miel'), v('dattes', 'des dattes', 'le mangeur de dattes', 'de dattes'), v('pain', 'du pain', 'le mangeur de pain', 'de pain')] },
        { nom: 'ville', verbe: 'habite', nverbe: 'n’habite pas', valeurs: [v('Thèbes', 'à Thèbes', 'l’habitant de Thèbes'), v('Memphis', 'à Memphis', 'l’habitant de Memphis'), v('Assouan', 'à Assouan', 'l’habitant d’Assouan'), v('Edfou', 'à Edfou', 'l’habitant d’Edfou')] },
      ],
    },
  ]

  const moule = P.moule({
    cle: 'grille',
    nom: 'Qui fait quoi',
    socle: 'preuve',
    glyphe: 'grille',
    unite: ['vérification', 'vérifications'],
    depart: f => ({ choix: [0, 1].map(() => f.gens.map(() => null)), verifie: false }),
    coups: f => [...[0, 1].flatMap(s => f.gens.flatMap((_, p) => f.gens.map((_, w) => ({ s, p, v: w })))), { verifie: true }],
    // Poser une puce n'engage à rien : seul « Vérifier » compte.
    compte: coup => !!coup.verifie,
    jouer(f, e, coup) {
      if (e.verifie) return { refus: 'C’est vérifié.' }
      if (coup.verifie) return e.choix.some(l => l.includes(null)) ? { refus: 'Il reste des cases vides.' } : { etat: { ...e, verifie: true } }
      const choix = e.choix.map(l => l.slice())
      // Toucher une puce déjà posée la retire ; une valeur déjà donnée à un autre lui est reprise.
      if (choix[coup.s][coup.p] === coup.v) choix[coup.s][coup.p] = null
      else {
        choix[coup.s] = choix[coup.s].map(x => (x === coup.v ? null : x))
        choix[coup.s][coup.p] = coup.v
      }
      return { etat: { ...e, choix } }
    },
    fini(f, e) {
      if (!e.verifie) return null
      if (e.choix.every((l, s) => l.every((x, p) => x === f.rep[s][p]))) return { gagne: true }
      const faux = f.indices.find(i => !tient(i, e.choix))
      return { perdu: faux ? `Cela contredit : « ${texte(f, faux)} »` : 'Cela ne tient pas.' }
    },
    // La preuve : on énumère toutes les répartitions, et une seule satisfait tous les indices.
    verifier(f) {
      const n = f.gens.length
      if (f.series.length !== 2 || f.series.some(s => s.valeurs.length !== n)) return { ok: false, note: 'deux séries, autant de valeurs que de personnages' }
      const vraies = solutions(f)
      if (vraies.length !== 1) return { ok: false, note: vraies.length ? `${vraies.length} répartitions possibles` : 'aucune répartition possible' }
      if (JSON.stringify(vraies[0]) !== JSON.stringify(f.rep)) return { ok: false, note: 'la seule répartition possible n’est pas celle de la fiche' }
      return { ok: true, coups: 1, solution: [...[0, 1].flatMap(s => f.gens.map((_, p) => ({ s, p, v: f.rep[s][p] }))), { verifie: true }], note: 'une seule réponse' }
    },
    dessiner({ f, e, agir, fige }) {
      const clos = fige || e.verifie
      return h('div', { class: 'gr' },
        // Numérotés : l'explication renvoie à « l'indice 3 ».
        h('ol', { class: 'gr-ind' }, f.indices.map((i, k) => h('li', null, h('b', null, `${k + 1}`), h('span', null, texte(f, i))))),
        f.gens.map((nom, p) => h('div', { class: 'gr-qui' },
          h('b', null, nom),
          h('div', { class: 'gr-puces' }, [0, 1].map(s => h('div', { class: `gr-rang s${s}`, role: 'group', 'aria-label': `${nom} : ${f.series[s].nom}` }, f.series[s].valeurs.map((va, w) => {
            const pris = e.choix[s][p] === w
            return h('button', {
              type: 'button', class: `gr-p ${pris ? 'pris' : e.choix[s].includes(w) ? 'ailleurs' : ''}`, 'aria-pressed': pris ? 'true' : 'false',
              'aria-label': dit(f, p, s, w), disabled: clos, onclick: () => agir({ s, p, v: w }),
            }, va.court)
          })))))),
        h('button', { type: 'button', class: 'bouton', disabled: clos, onclick: () => agir({ verifie: true }) }, 'Vérifier'))
    },

    /* On tire une répartition, puis des indices de trois formes jusqu'à ce qu'une seule la satisfasse
       — et qu'on puisse la lire au crayon, sans supposer —, puis on retire ceux qui ne servent plus. */
    tirer(graine, niveau) {
      const alea = P.alea(graine)
      const rang = Math.min(5, Math.max(1, niveau))
      const n = rang <= 3 ? 3 : 4
      const theme = P.parmi(alea, THEMES)
      const gens = P.melanger(alea, NOMS).slice(0, n)
      const series = theme.series.map(s => ({ ...s, valeurs: P.melanger(alea, s.valeurs).slice(0, n) }))
      const rep = [[...Array(n).keys()], P.melanger(alea, [...Array(n).keys()])]
      // Les formes en jeu : les premiers niveaux relient et écartent, les suivants proposent des « ou ».
      const formes = [['non', 'lie', 'lie', 'non'], ['non', 'lie', 'ou'], ['non', 'lie', 'ou', 'ou'], ['non', 'lie', 'ou'], ['non', 'lie', 'ou', 'ou']][rang - 1]
      const un = () => {
        const s = P.entier(alea, 0, 1)
        const p = P.entier(alea, 0, n - 1)
        const forme = P.parmi(alea, formes)
        const autre = P.parmi(alea, [...Array(n).keys()].filter(w => w !== rep[s][p]))
        if (forme === 'non') return { t: 'non', p, s, v: autre }
        if (forme === 'ou') return { t: 'ou', p, s, v: P.melanger(alea, [rep[s][p], autre]) }
        return { t: 'lie', a: [s, rep[s][p]], b: [1 - s, rep[1 - s][p]] }
      }
      const base = { gens, series, rep }
      for (let essai = 0; essai < 80; essai++) {
        const indices = []
        const vus = new Set()
        while (!deduire({ ...base, indices }).fait && indices.length < 3 * n) {
          const i = un()
          const cle = JSON.stringify(i)
          if (!vus.has(cle)) { vus.add(cle); indices.push(i) }
        }
        // On retire, au hasard, ce qui ne sert plus : l'énigme reste lisible au crayon.
        for (const i of P.melanger(alea, indices)) {
          const sans = indices.filter(x => x !== i)
          if (deduire({ ...base, indices: sans }).fait) indices.splice(0, indices.length, ...sans)
        }
        if (indices.length < n || indices.length > 2 * n) continue
        const f = { ...base, indices: P.melanger(alea, indices) }
        if (!moule.verifier(f).ok || !deduire(f).fait) continue
        return {
          id: `grille-${rang}-${graine}`, moule: 'grille', niveau: rang, tiree: true, essais: 3,
          titre: theme.titre,
          source: 'Tirée par le programme, sur le modèle des problèmes de logique à grille (Lewis Carroll ; la devinette dite d’Einstein)',
          recit: theme.recit(n === 3 ? 'Trois' : 'Quatre'),
          regle: 'Pour chacun, touche une puce par rangée : rien ne se répète. Puis « Vérifier ».',
          ...f,
          explication: expliquer(f),
        }
      }
      throw new Error('aucun tirage ne donne une seule répartition')
    },
  })

  /* ---------------------------------------------------------------- */

  // Deux tirages gardés pour l'atelier : trois personnages, puis quatre.
  P.fiche({ ...moule.tirer(11, 2), id: 'grille-a', tiree: false })
  P.fiche({ ...moule.tirer(23, 4), id: 'grille-b', tiree: false })
}
