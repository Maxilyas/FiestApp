'use strict'
/* Les allumettes : une égalité fausse, écrite en allumettes à la façon d'un
   afficheur à sept segments — des chiffres, un « + » ou un « − », un « = » —,
   et UNE allumette à déplacer pour la rendre juste. Les jeux d'allumettes ont
   leur premier recueil avec Sophus Tromholt (Streichholzspiele, 1889), et le
   « Professor Hoffmann » leur consacre un chapitre de Puzzles Old and New
   (1893).

   Une fiche donne : `ecrit`, l'égalité fausse telle qu'on la lit (« 6+4=4 » :
   des chiffres, un seul signe d'opération, un seul « = »). Le programme y
   range les allumettes ; la fiche n'en dit pas plus. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.allumettes = ['.......##', '......###', '.....###.', '....###..', '...###...', '..###....', '.###.....', '###......', '##.......']

  P.style(`
.al { display: grid; gap: 8px; justify-items: center; }
.al-table { position: relative; box-sizing: border-box; width: 100%; padding: 16px 0; display: flex; justify-content: center; gap: var(--g); border: 1px solid rgba(217, 181, 106, 0.25); border-radius: 12px; background: rgba(0, 0, 0, 0.22); }
.al-sym { position: relative; flex: none; }
.al-allu, .al-vide { position: absolute; padding: 0; border: 0; touch-action: manipulation; }
.al-allu { border-radius: 6px; background: linear-gradient(var(--sens), #c8402f 0 24%, #d8b980 24%); box-shadow: 0 2px 0 rgba(0, 0, 0, 0.45); }
.al-vide { border: 2px dashed rgba(243, 222, 166, 0.7); border-radius: 6px; background: rgba(243, 222, 166, 0.06); box-sizing: border-box; }
.al-vide.origine { border-color: var(--or); background: rgba(217, 181, 106, 0.2); }
.al-allu::before, .al-vide::before { content: ""; position: absolute; inset: -7px; }
.al-allu[disabled], .al-vide[disabled] { cursor: default; }
.al-pied { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-height: 40px; }
.al-pied p { margin: 0; font-size: 12.5px; line-height: 1.3; color: var(--muted); }
.al-pied .lu { font: 600 16px/1.2 var(--f-pixel); color: var(--ink); white-space: nowrap; }
.al-pied .lu.juste { color: var(--or-clair); }
.al-pied .lu.faux { color: var(--faux); }
.al-main { flex: none; width: 44px; height: 9px; border-radius: 5px; background: linear-gradient(90deg, #c8402f 0 24%, #d8b980 24%); box-shadow: 0 0 10px rgba(var(--sable), 0.6); }
`)

  // Les sept segments d'un chiffre, dans l'ordre a (haut), b (haut droit), c (bas droit), d (bas), e (bas gauche), f (haut gauche), g (milieu).
  const SEGMENTS = 'abcdefg'
  const CHIFFRES = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg']
  const masque = c => SEGMENTS.split('').map(s => (CHIFFRES[c].includes(s) ? 1 : 0))
  const lireChiffre = bits => {
    const i = CHIFFRES.indexOf(SEGMENTS.split('').filter((_, k) => bits[k]).join(''))
    return i < 0 ? null : i
  }
  const SIGNE = { '+': '+', '-': '−', '−': '−' }

  // La taille d'un symbole ne dépend que du nombre de symboles de la ligne : pas de calcul à chaque dessin.
  const plans = new WeakMap()
  function plan(f) {
    if (!plans.has(f)) {
      const genres = [...f.ecrit].map(c => (c === '=' ? 'e' : SIGNE[c] ? 'o' : 'd'))
      const places = []
      const occ = []
      genres.forEach((genre, s) => {
        const c = f.ecrit[s]
        const bits = genre === 'd' ? masque(+c) : genre === 'o' ? [1, SIGNE[c] === '+' ? 1 : 0] : [1, 1]
        bits.forEach((b, k) => { places.push({ s, k, genre }); occ.push(b) })
      })
      plans.set(f, { genres, places, occ })
    }
    return plans.get(f)
  }

  // Ce que dit l'égalité : chaque symbole bien formé, et le compte juste. Un chiffre mal formé se lit « ? ».
  function lire(f, occ) {
    const { genres, places } = plan(f)
    const lus = genres.map((genre, s) => {
      const bits = places.flatMap((p, i) => (p.s === s ? [occ[i]] : []))
      if (genre === 'd') return lireChiffre(bits)
      if (genre === 'o') return bits[0] && bits[1] ? '+' : bits[0] ? '−' : null
      return bits[0] && bits[1] ? '=' : null
    })
    const bien = lus.every(x => x !== null)
    const texte = lus.map(x => (x === null ? '?' : x)).join(' ').replace(/(\d) (?=\d)/g, '$1')
    if (!bien) return { bien, juste: false, texte }
    const o = genres.indexOf('o'), e = genres.indexOf('e')
    const nombre = (de, a) => +lus.slice(de, a).join('')
    const [x, y, z] = [nombre(0, o), nombre(o + 1, e), nombre(e + 1, lus.length)]
    return { bien, juste: (lus[o] === '+' ? x + y : x - y) === z, texte }
  }
  const deplacees = (f, occ) => occ.filter((b, i) => plan(f).occ[i] && !b).length

  // Tous les déplacements d'une allumette qui rendent l'égalité juste, et ceux qui la laissent bien formée mais fausse (les leurres).
  function corrections(f) {
    const { occ } = plan(f)
    const bonnes = []
    let leurres = 0
    occ.forEach((pleine, s) => {
      if (!pleine) return
      occ.forEach((autre, t) => {
        if (autre) return
        const apres = occ.map((b, i) => (i === s ? 0 : i === t ? 1 : b))
        const l = lire(f, apres)
        if (l.bien && l.juste) bonnes.push({ prend: s, pose: t })
        else if (l.bien) leurres++
      })
    })
    return { bonnes, leurres }
  }

  // Un bâtonnet : où il tombe dans son symbole, selon sa nature. `u` est l'épaisseur d'une allumette.
  function barre(genre, k, W, H, u) {
    const Wo = Math.round(W * 0.85)
    if (genre === 'd') {
      const long = W - 2.2 * u, haut = (H - 3 * u) / 2
      return [
        { x: 1.1 * u, y: 0, w: long, h: u },
        { x: W - u, y: u, w: u, h: haut },
        { x: W - u, y: (H + u) / 2, w: u, h: haut },
        { x: 1.1 * u, y: H - u, w: long, h: u },
        { x: 0, y: (H + u) / 2, w: u, h: haut },
        { x: 0, y: u, w: u, h: haut },
        { x: 1.1 * u, y: (H - u) / 2, w: long, h: u },
      ][k]
    }
    if (genre === 'o') return k === 0 ? { x: 0, y: (H - u) / 2, w: Wo, h: u } : { x: (Wo - u) / 2, y: (H - Wo) / 2, w: u, h: Wo }
    return { x: 0, y: k === 0 ? H / 2 - 1.7 * u : H / 2 + 0.7 * u, w: Wo, h: u }
  }
  const POSITIONS = ['en haut', 'en haut à droite', 'en bas à droite', 'en bas', 'en bas à gauche', 'en haut à gauche', 'au milieu']

  const moule = P.moule({
    cle: 'allumettes',
    nom: 'Les allumettes',
    socle: 'pose',
    glyphe: 'allumettes',
    unite: ['déplacement', 'déplacements'],
    // `occ` : une case par place, pleine ou vide. `main` : la place d'où l'allumette tenue a été prise, ou rien.
    depart: f => ({ occ: plan(f).occ.slice(), main: null }),
    // Prendre une allumette n'est qu'un geste : le déplacement compte quand elle est posée.
    compte: coup => coup.pose !== undefined,
    coups: (f, e) => (e.main === null ? e.occ.flatMap((b, i) => (b ? [{ prend: i }] : [])) : e.occ.flatMap((b, i) => (b ? [] : [{ pose: i }]))),
    jouer(f, e, coup) {
      if (coup.prend !== undefined) {
        if (e.main !== null) return { refus: 'Pose d’abord l’allumette que tu tiens.' }
        if (!e.occ[coup.prend]) return { refus: 'Il n’y a rien à prendre ici.' }
        return { etat: { occ: e.occ.map((b, i) => (i === coup.prend ? 0 : b)), main: coup.prend } }
      }
      if (e.main === null) return { refus: 'Prends d’abord une allumette.' }
      if (e.occ[coup.pose]) return { refus: 'Cette place est prise.' }
      return { etat: { occ: e.occ.map((b, i) => (i === coup.pose ? 1 : b)), main: null } }
    },
    // Une seule allumette a bougé : en poser une autre ailleurs puis rendre la première ne compte pas pour deux.
    fini: (f, e) => {
      if (e.main !== null || deplacees(f, e.occ) !== 1) return null
      const l = lire(f, e.occ)
      return l.bien && l.juste ? { gagne: true } : null
    },
    verifier(f) {
      const { bonnes } = corrections(f)
      if (lire(f, plan(f).occ).juste) return { ok: false, note: 'l’égalité est déjà juste' }
      if (!bonnes.length) return { ok: false, note: 'aucune correction' }
      if (bonnes.length > 1) return { ok: false, note: `${bonnes.length} corrections : une seule est promise` }
      return { ok: true, coups: 1, solution: [{ prend: bonnes[0].prend }, { pose: bonnes[0].pose }], note: 'une seule correction' }
    },
    dessiner({ f, e, agir, fige }) {
      const { genres, places } = plan(f)
      const n = genres.length
      const g = 10
      // Chiffres de 54 pixels au plus ; une égalité plus longue les rétrécit, pour que rien ne déborde des 328.
      const W = Math.min(54, Math.floor((328 - (n - 1) * g) / (genres.filter(x => x === 'd').length + 0.85 * genres.filter(x => x !== 'd').length)))
      const H = Math.round(W * 1.9), u = Math.round(W * 0.2)
      const main = e.main !== null
      const nom = s => (genres[s] === 'd' ? `Chiffre ${genres.slice(0, s + 1).filter(x => x === 'd').length}` : genres[s] === 'o' ? 'Signe d’opération' : 'Signe égal')
      const lieu = p => (p.genre === 'd' ? POSITIONS[p.k] : p.genre === 'o' ? (p.k ? 'barre verticale' : 'barre horizontale') : p.k ? 'barre du bas' : 'barre du haut')
      const symboles = genres.map((genre, s) => {
        const boite = genre === 'd' ? W : Math.round(W * 0.85)
        const bats = places.flatMap((p, i) => {
          if (p.s !== s || (!e.occ[i] && !main)) return []
          const b = barre(genre, p.k, W, H, u)
          const vertical = b.h > b.w
          const pose = [`left:${b.x}px`, `top:${b.y}px`, `width:${b.w}px`, `height:${b.h}px`, `--sens:${vertical ? 180 : 90}deg`].join(';')
          return [h('button', {
            type: 'button', disabled: fige, style: pose,
            class: e.occ[i] ? 'al-allu' : `al-vide ${i === e.main ? 'origine' : ''}`,
            'aria-label': `${nom(s)}, ${lieu(p)} : ${e.occ[i] ? 'une allumette' : i === e.main ? 'la place d’où tu l’as prise' : 'place libre'}`,
            onclick: () => agir(e.occ[i] ? { prend: i } : { pose: i }),
          })]
        })
        return h('div', { class: 'al-sym', style: `width:${boite}px;height:${H}px` }, bats)
      })
      const l = lire(f, e.occ)
      const pied = main
        ? [h('p', null, 'Pose l’allumette sur une place en pointillé.'), h('span', { class: 'al-main', role: 'img', 'aria-label': 'Une allumette en main' })]
        : [h('p', null, 'Touche une allumette pour la prendre.'), h('span', { class: `lu ${l.bien ? (l.juste ? 'juste' : 'faux') : ''}`, 'aria-label': `Tu lis : ${l.texte}` }, l.texte)]
      return h('div', { class: 'al' },
        h('div', { class: 'al-table', style: `--g:${g}px`, role: 'group', 'aria-label': `Une égalité en allumettes : ${lire(f, plan(f).occ).texte}` }, symboles),
        h('div', { class: 'al-pied' }, pied))
    },
    /* Une égalité à un chiffre par terme, fausse, qui n'a qu'UNE correction par
       déplacement d'une allumette : le programme essaie tous les déplacements
       pour le prouver. Le niveau tient à la distance que parcourt l'allumette —
       dans un seul chiffre, jusqu'au signe, d'un chiffre à l'autre — puis au
       nombre de leurres, ces déplacements qui laissent des signes bien formés
       sans rendre l'égalité juste. */
    tirer(graine, niveau) {
      const alea = P.alea(graine * 7919 + niveau * 104729)
      for (let essai = 0; essai < 6000; essai++) {
        const op = P.parmi(alea, ['+', '−'])
        const [a, b, c] = [P.entier(alea, 0, 9), P.entier(alea, 0, 9), P.entier(alea, 0, 9)]
        const ecrit = `${a}${op}${b}=${c}`
        const f = { moule: 'allumettes', ecrit }
        if (lire(f, plan(f).occ).juste) continue
        const { bonnes, leurres } = corrections(f)
        if (bonnes.length !== 1) continue
        const { s, t } = { s: plan(f).places[bonnes[0].prend], t: plan(f).places[bonnes[0].pose] }
        const classe = s.s === t.s ? 1 : s.genre === 'o' || t.genre === 'o' ? 2 : leurres <= 6 ? 3 : leurres <= 9 ? 4 : 5
        if (classe !== niveau) continue
        const dit = ecrit.replace(/([+−=])/g, ' $1 ')
        return {
          id: `allumettes-${niveau}-${graine}`, moule: 'allumettes', niveau, tiree: true,
          titre: `Une égalité boiteuse`,
          source: 'Tirée par le programme, sur le modèle des jeux d’allumettes de Sophus Tromholt, Streichholzspiele, 1889',
          recit: [
            `J’ai aligné des allumettes : « ${dit} ».`,
            'Elle est fausse. Une seule allumette à déplacer, pas une de plus, et elle devient juste.',
          ],
          regle: 'Touche une allumette pour la prendre, puis une place en pointillé pour la poser.',
          ecrit,
        }
      }
      throw new Error(`Aucune égalité de niveau ${niveau} pour la graine ${graine}.`)
    },
  })

  /* ---------------------------------------------------------------- */

  const TROMHOLT = 'Sophus Tromholt, Streichholzspiele, 1889 ; « Professor Hoffmann », Puzzles Old and New, 1893'
  const REGLE = 'Touche une allumette pour la prendre, puis une place en pointillé pour la poser.'
  const ECRIT = {
    a: ['allumettes-a', 1, 'Un chiffre à reprendre'],
    b: ['allumettes-b', 2, 'Le signe à changer'],
    c: ['allumettes-c', 3, 'D’un chiffre à l’autre'],
    d: ['allumettes-d', 4, 'L’allumette bien cachée'],
  }
  // Les graines sont choisies une fois pour toutes : une fiche fixe ne change jamais d'égalité, même si le tirage évolue.
  const GRAINES = { a: 4, b: 3, c: 1, d: 2 }
  for (const [cle, [id, niveau, titre]] of Object.entries(ECRIT)) {
    const t = moule.tirer(GRAINES[cle], niveau)
    P.fiche({ ...t, id, tiree: false, titre, source: `D’après ${TROMHOLT}`, regle: REGLE })
  }
}
