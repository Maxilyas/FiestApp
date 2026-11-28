'use strict'
/* Les dominos : couvrir un damier de dominos, chacun posé sur deux cases
   voisines. Le damier amputé est l'un des plus beaux casse-tête qui soient :
   Max Black le publie en 1946, et Ralph Gomory prouve en 1973 ce qu'on peut en
   tirer — ôtez deux cases de couleurs différentes, et le damier se couvre
   toujours. Ôtez-en deux de la même couleur, et il ne se couvre jamais.

   Une fiche donne : `cote` (le damier est carré), `trous` (les cases ôtées,
   comptées ligne après ligne), et `impossible` quand la bonne réponse est de
   le dire. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.damier = ['#########', '#.#.#.###', '.#.#.#.##', '#.#.#.###', '.#.#.#...', '#####.###', '#####.###', '.....#...', '#########']

  P.style(`
.dm { display: grid; justify-items: center; gap: 6px; }
.dm-plateau { display: grid; grid-template-columns: repeat(var(--n), var(--c)); border: 2px solid rgba(217, 181, 106, 0.5); border-radius: 6px; overflow: hidden; }
.dm-case { position: relative; width: var(--c); height: var(--c); padding: 0; border: 0; background: #5d4c3a; color: var(--or-clair); touch-action: manipulation; }
.dm-case.sombre { background: #3a2e26; }
.dm-case.trou { background: var(--nuit); cursor: default; }
.dm-case.trou::before { content: ""; position: absolute; inset: 22%; border-radius: 50%; background: #000; box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.08); }
.dm-case.pose::after { content: ""; position: absolute; inset: 0; background: rgba(217, 181, 106, 0.72); box-shadow: var(--o); }
.dm-case.pose::before { content: ""; position: absolute; z-index: 1; left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px; border-radius: 50%; background: rgba(26, 20, 18, 0.6); }
.dm-case.main { outline: 3px solid var(--or-clair); outline-offset: -3px; }
.dm-case.voisine:not(.pose):not(.trou) { box-shadow: inset 0 0 0 3px rgba(var(--sable), 0.55); }
.dm-case[disabled] { cursor: default; }
.dm-case:focus-visible { outline-offset: -3px; }
.dm-pied { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 36px; }
.dm-pied p { margin: 0; font-size: 12.5px; line-height: 1.3; color: var(--muted); }
.dm .lien { min-height: 36px; }
`)

  const sombre = (n, i) => (Math.floor(i / n) + (i % n)) % 2
  // Les voisines d'une case : à gauche, à droite, au-dessus, en dessous — jamais en biais, jamais de l'autre côté du bord.
  const voisines = (n, i) => [[0, -1], [0, 1], [-1, 0], [1, 0]].flatMap(([dr, dc]) => {
    const r = Math.floor(i / n) + dr, c = (i % n) + dc
    return r >= 0 && r < n && c >= 0 && c < n ? [r * n + c] : []
  })
  const trou = (f, i) => f.trous.includes(i)
  const couverte = (e, i) => e.dom.some(d => d.includes(i))
  const libre = (f, e, i) => !trou(f, i) && !couverte(e, i)
  const cases = f => f.cote * f.cote - f.trous.length

  /* Le retour arrière couvre toujours la première case libre, dans l'ordre de
     lecture : elle n'a que deux façons d'être prise — avec sa voisine de droite
     ou celle du dessous —, puisque tout ce qui la précède est déjà couvert. Il
     compte tous les pavages, et garde le premier. */
  function paver(f) {
    const n = f.cote
    const prise = Array.from({ length: n * n }, (_, i) => trou(f, i))
    const chemin = []
    let total = 0, solution = null
    const descend = depuis => {
      let i = depuis
      while (i < n * n && prise[i]) i++
      if (i === n * n) { total++; solution = solution || chemin.map(d => ({ pose: d })); return }
      const suivantes = []
      if (i % n < n - 1) suivantes.push(i + 1)
      if (i + n < n * n) suivantes.push(i + n)
      for (const j of suivantes) {
        if (prise[j]) continue
        prise[i] = prise[j] = true
        chemin.push([i, j])
        descend(i + 1)
        chemin.pop()
        prise[i] = prise[j] = false
      }
    }
    descend(0)
    return { n: total, solution }
  }

  P.moule({
    cle: 'damier',
    nom: 'Les dominos',
    socle: 'pose',
    glyphe: 'damier',
    unite: ['domino', 'dominos'],
    // `dom` garde l'ordre des poses : la solution se rejoue domino après domino. `main` : la case touchée, qui attend sa voisine.
    depart: () => ({ dom: [], main: null, renonce: false }),
    // Toucher une case ou ôter un domino ne coûte rien : on ne compte que les dominos posés.
    compte: coup => coup.pose !== undefined,
    jauge: (f, e) => `${e.dom.length} ${e.dom.length > 1 ? 'dominos' : 'domino'} sur ${cases(f) / 2 | 0}`,
    coups(f, e) {
      const n = f.cote
      const poses = []
      for (let i = 0; i < n * n; i++) if (libre(f, e, i)) for (const j of voisines(n, i)) if (j > i && libre(f, e, j)) poses.push({ pose: [i, j] })
      return [...poses, ...e.dom.map(d => ({ ote: d[0] }))]
    },
    jouer(f, e, coup) {
      const n = f.cote
      if (coup.impossible) return f.impossible ? { etat: { ...e, renonce: true } } : { refus: 'Si, c’est possible.' }
      if (coup.prend !== undefined) {
        if (coup.prend !== null && !libre(f, e, coup.prend)) return { refus: trou(f, coup.prend) ? 'Cette case est ôtée.' : 'Cette case est déjà couverte.' }
        return { etat: { ...e, main: coup.prend } }
      }
      if (coup.ote !== undefined) {
        if (!couverte(e, coup.ote)) return { refus: 'Il n’y a pas de domino ici.' }
        return { etat: { ...e, dom: e.dom.filter(d => !d.includes(coup.ote)), main: null } }
      }
      const [a, b] = coup.pose
      if (!libre(f, e, a) || !libre(f, e, b)) return { refus: 'Une de ces cases est prise : touche son domino pour l’ôter.' }
      if (!voisines(n, a).includes(b)) return { refus: 'Un domino couvre deux cases voisines, côte à côte.' }
      return { etat: { ...e, dom: [...e.dom, [a, b]], main: null } }
    },
    fini: (f, e) => (e.renonce || (e.dom.length * 2 === cases(f) && e.dom.length > 0) ? { gagne: true } : null),
    verifier(f) {
      const n = f.cote
      const vides = [...Array(n * n).keys()].filter(i => !trou(f, i))
      const claires = vides.filter(i => !sombre(n, i)).length
      const sombres = vides.length - claires
      if (f.impossible) {
        /* Chaque domino couvre une case claire et une sombre : tant que les
           deux couleurs ne se valent pas, aucun pavage n'existe. C'est la
           preuve — et si le compte tombe juste, elle ne prouve plus rien. */
        if (claires === sombres) return { ok: false, note: 'les couleurs se valent : la preuve ne tient pas' }
        return { ok: true, note: `impossible, prouvé par le programme : ${claires} cases d’une couleur, ${sombres} de l’autre` }
      }
      if (claires !== sombres) return { ok: false, note: `${claires} cases d’une couleur, ${sombres} de l’autre : elle ne se couvre pas` }
      const r = paver(f)
      if (!r.n) return { ok: false, note: 'aucun pavage' }
      return { ok: true, coups: vides.length / 2, solution: r.solution, note: P.pluriel(r.n, 'pavage') }
    },
    dessiner({ f, e, agir, fige }) {
      const n = f.cote
      // Huit cases de 36 pixels, la bordure et le pied tiennent dans les 340 du cadre ; un petit damier prend des cases plus larges.
      const cote = Math.min(54, Math.floor(288 / n))
      const cible = e.main === null ? [] : voisines(n, e.main).filter(j => libre(f, e, j))
      const nom = i => `${'abcdefgh'[i % n]}${n - Math.floor(i / n)}`
      const une = i => {
        const d = e.dom.find(x => x.includes(i))
        const bords = []
        if (d) {
          // Le domino est un seul objet : sa bordure s'arrête là où il continue sur la case d'à côté.
          const autre = d[0] === i ? d[1] : d[0]
          const dr = Math.floor(autre / n) - Math.floor(i / n), dc = (autre % n) - (i % n)
          if (dr !== -1) bords.push('inset 0 3px 0 0 #1a1412')
          if (dr !== 1) bords.push('inset 0 -3px 0 0 #1a1412')
          if (dc !== -1) bords.push('inset 3px 0 0 0 #1a1412')
          if (dc !== 1) bords.push('inset -3px 0 0 0 #1a1412')
        }
        const aria = trou(f, i) ? 'ôtée' : d ? 'couverte, touche pour ôter le domino' : i === e.main ? 'choisie, touche une case voisine' : 'libre'
        return h('button', {
          type: 'button', disabled: fige || trou(f, i),
          class: ['dm-case', sombre(n, i) ? 'sombre' : '', trou(f, i) ? 'trou' : '', d ? 'pose' : '', i === e.main ? 'main' : '', cible.includes(i) ? 'voisine' : ''].filter(Boolean).join(' '),
          style: d ? `--o:${bords.join(',')}` : null,
          'aria-label': `${nom(i)}, ${sombre(n, i) ? 'sombre' : 'claire'} : ${aria}`,
          onclick: () => {
            if (d) return agir({ ote: i })
            if (e.main === null || e.main === i) return agir({ prend: e.main === i ? null : i })
            // Une case qui n'est pas voisine de la première la remplace : un doigt qui a visé à côté se reprend sans bruit.
            agir(voisines(n, e.main).includes(i) ? { pose: [e.main, i] } : { prend: i })
          },
        })
      }
      const dit = e.main === null ? 'Touche une case, puis sa voisine.' : 'Touche une case voisine.'
      return h('div', { class: 'dm' },
        h('div', { class: 'dm-plateau', style: `--n:${n};--c:${cote}px`, role: 'group', 'aria-label': `Un damier de ${n} cases de côté${f.trous.length ? `, ${P.pluriel(f.trous.length, 'case ôtée', 'cases ôtées')}` : ''}` }, [...Array(n * n).keys()].map(une)),
        h('div', { class: 'dm-pied' }, h('p', null, dit), h('button', { type: 'button', class: 'lien', disabled: fige, onclick: () => agir({ impossible: true }) }, 'C’est impossible')))
    },
  })

  /* ---------------------------------------------------------------- */

  P.fiche({
    id: 'damier-quatre', moule: 'damier', niveau: 1,
    titre: 'Le petit damier',
    source: 'Tradition : les dominos sur un damier, le plus vieux des pavages',
    recit: [
      'Un domino couvre deux cases voisines, ni plus ni moins.',
      'Voici un damier de quatre cases de côté, sans une case ôtée.',
      'Couvre-le tout entier, sans qu’aucun domino ne dépasse.',
    ],
    regle: 'Touche une case, puis une case voisine pour poser un domino. Touche un domino pour l’ôter.',
    cote: 4, trous: [],
  })

  P.fiche({
    id: 'damier-deux-trous', moule: 'damier', niveau: 2,
    titre: 'Le damier à deux trous',
    source: 'Ralph Gomory, 1973 : son théorème dit qu’un damier privé de deux cases de couleurs différentes se couvre toujours',
    recit: [
      'J’ai creusé deux trous dans un damier de six cases de côté.',
      'L’un tombe sur une case claire, l’autre sur une case sombre.',
      'Dix-sept dominos couvrent le reste. À toi de les poser.',
    ],
    regle: 'Touche une case, puis une case voisine pour poser un domino. Touche un domino pour l’ôter.',
    cote: 6, trous: [7, 3],
  })

  P.fiche({
    id: 'damier-ecorne', moule: 'damier', niveau: 4,
    titre: 'Le damier écorné',
    source: 'Max Black, Critical Thinking, 1946 : le damier dont on a scié deux coins opposés',
    recit: [
      'Un damier de huit cases de côté. J’en ai ôté deux coins, en haut à gauche et en bas à droite.',
      'Il reste soixante-deux cases : trente et un dominos devraient les couvrir.',
      'Essaie. Ou dis-moi que c’est impossible.',
    ],
    regle: 'Touche une case, puis une case voisine pour poser un domino. Touche un domino pour l’ôter.',
    cote: 8, trous: [0, 63],
    impossible: true,
    explication: [
      'Deux coins opposés ont la même couleur : il reste trente-deux cases d’une couleur et trente de l’autre.',
      'Un domino couvre toujours une case claire et une case sombre.',
      'Trente et un dominos en couvriraient trente et une de chaque : c’est impossible.',
    ],
  })
}
