'use strict'
/* D'un seul trait : tracer une figure sans lever le doigt et sans repasser sur
   un trait. Euler en donne la règle en 1736 : on ne traverse un point qu'en y
   usant deux traits, donc seuls le départ et l'arrivée peuvent en voir partir
   un nombre impair. Deux points impairs au plus, ou la figure ne se trace pas —
   et il lui faut alors moitié moins de traits de plume qu'elle a de points
   impairs, la règle que Dudeney rappelle à son n° 240.

   Une fiche donne : `points` (leurs places, en pourcentages du cadre), `traits`
   (des paires de points), `levees` (combien de fois on peut lever le doigt :
   aucune, sinon) et `impossible` quand la bonne réponse est de le dire. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.trait = ['....#....', '...#.#...', '..#...#..', '.#######.', '.##...##.', '.#.#.#.#.', '.#..#..#.', '.#.#.#.#.', '.#######.']

  P.style(`
.tt { display: grid; gap: 4px; }
.tt-figure { position: relative; height: 252px; border: 1px solid rgba(217, 181, 106, 0.25); border-radius: 12px; background: rgba(0, 0, 0, 0.22); }
.tt-zone { position: absolute; inset: 30px 28px; }
.tt-traits, .tt-traits svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.tt-traits line { stroke: rgba(243, 236, 226, 0.3); stroke-width: 3; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.tt-traits line.fait { stroke: var(--or); stroke-width: 6; }
.tt-point { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; padding: 0; display: grid; place-items: center; background: none; border: 0; border-radius: 50%; touch-action: manipulation; }
.tt-point::before { content: ""; width: 16px; height: 16px; border-radius: 50%; background: var(--pierre); border: 2px solid var(--ink); }
.tt-point.clos::before { border-color: #7d7064; }
.tt-point.voisin::before { border-color: var(--or-clair); box-shadow: 0 0 0 5px rgba(var(--sable), 0.2); }
.tt-point.ici::before { width: 22px; height: 22px; background: var(--or-clair); border-color: #fff4d6; box-shadow: 0 0 16px rgba(var(--sable), 0.9); }
.tt-point[disabled] { cursor: default; }
.tt-pied { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 40px; }
.tt-pied p { margin: 0; font-size: 12.5px; line-height: 1.3; color: var(--muted); }
.tt-pied b { color: var(--ink); font-weight: 600; }
.tt-pied .leve { color: var(--or-clair); }
`)

  const libres = (f, e, p) => f.traits.flatMap((t, k) => (t.includes(p) && !e.faits.includes(k) ? [k] : []))
  const bout = (f, k, p) => (f.traits[k][0] === p ? f.traits[k][1] : f.traits[k][0])
  const plumes = f => (f.levees || 0) + 1

  const moule = P.moule({
    cle: 'trait',
    nom: 'D’un seul trait',
    socle: 'pose',
    glyphe: 'trait',
    unite: ['trait', 'traits'],
    // `ou` : le point sous le doigt, ou rien. `plume` : les traits de plume entamés. `frais` : le doigt vient de se poser, il peut encore se raviser.
    depart: () => ({ faits: [], ou: null, plume: 0, frais: false, renonce: false }),
    // Poser le doigt ne trace rien : seul un trait tracé compte.
    compte: coup => coup.va !== undefined,
    jauge: (f, e) => `${e.faits.length} ${e.faits.length > 1 ? 'traits' : 'trait'} sur ${f.traits.length}`,
    coups(f, e) {
      if (e.ou === null) return f.points.flatMap((_, p) => (libres(f, e, p).length ? [{ part: p }] : []))
      return libres(f, e, e.ou).map(k => ({ va: bout(f, k, e.ou) }))
    },
    jouer(f, e, coup) {
      if (coup.impossible) return f.impossible ? { etat: { ...e, renonce: true } } : { refus: 'Si, c’est possible.' }
      if (coup.leve) {
        // Un doigt mal posé se reprend, tant qu'il n'a rien tracé : sur un téléphone, on vise parfois le point d'à côté.
        if (e.ou === null) return { refus: 'Ton doigt n’est posé nulle part.' }
        if (!e.frais) return { refus: 'On ne lève pas le doigt en chemin.' }
        return { etat: { ...e, ou: null, plume: e.plume - 1, frais: false } }
      }
      if (coup.part !== undefined) {
        if (e.ou !== null) return { refus: 'Ton doigt est déjà posé : va vers un point voisin.' }
        if (!libres(f, e, coup.part).length) return { refus: 'Plus aucun trait ne part de ce point.' }
        return { etat: { ...e, ou: coup.part, plume: e.plume + 1, frais: true } }
      }
      if (e.ou === null) return { refus: 'Pose d’abord ton doigt sur un point.' }
      const k = f.traits.findIndex(t => t.includes(e.ou) && t.includes(coup.va) && e.ou !== coup.va)
      if (k < 0) return { refus: 'Aucun trait ne joint ces deux points.' }
      if (e.faits.includes(k)) return { refus: 'Tu es déjà passé par ce trait.' }
      const suite = { ...e, faits: [...e.faits, k], ou: coup.va, frais: false }
      /* Dans une impasse, le doigt se lève de lui-même s'il reste une levée. On
         ne le lève jamais avant : un trait de plume qu'on pousse jusqu'au bout
         ne coûte rien, et la règle tient en une phrase. */
      if (suite.faits.length < f.traits.length && !libres(f, suite, suite.ou).length && suite.plume < plumes(f)) suite.ou = null
      return { etat: suite }
    },
    fini(f, e) {
      if (e.renonce || e.faits.length === f.traits.length) return { gagne: true }
      if (e.ou !== null && !libres(f, e, e.ou).length) return { perdu: f.levees ? 'Une impasse, et plus une levée. L’encre s’efface.' : 'Une impasse, et il reste des traits. L’encre s’efface.' }
      return null
    },
    verifier(f) {
      const impairs = f.points.filter((_, p) => f.traits.filter(t => t.includes(p)).length % 2).length
      // D'un seul tenant : la règle des points impairs ne vaut que pour une figure dont tous les traits se rejoignent.
      const vus = new Set([f.traits[0][0]])
      for (let grandit = true; grandit;) {
        grandit = false
        for (const [a, b] of f.traits) if (vus.has(a) !== vus.has(b)) { vus.add(a); vus.add(b); grandit = true }
      }
      if (f.traits.some(([a]) => !vus.has(a))) return { ok: false, note: 'la figure est en plusieurs morceaux' }
      const faut = Math.max(1, impairs / 2)
      if (f.impossible) return faut > plumes(f) ? { ok: true, note: `impossible, prouvé par le programme : ${impairs} points impairs` } : { ok: false, note: 'elle se trace' }
      if (faut !== plumes(f)) return { ok: false, note: `${impairs} points impairs : il faut ${P.pluriel(faut, 'trait de plume', 'traits de plume')}, pas ${plumes(f)}` }
      /* Le retour arrière joue les coups mêmes du joueur. D'un seul trait, il
         compte tous les tracés ; à plusieurs traits de plume, ils se comptent
         par millions, et le premier suffit — la règle d'Euler a déjà dit
         qu'on ne fait pas mieux. */
      let total = 0, solution = null
      const chemin = []
      const descend = e => {
        if (moule.fini(f, e)) { total++; solution = solution || chemin.slice(); return }
        for (const coup of moule.coups(f, e)) {
          const suite = moule.jouer(f, e, coup).etat
          if (moule.fini(f, suite)?.perdu) continue
          chemin.push(coup)
          descend(suite)
          chemin.pop()
          if (f.levees && solution) return
        }
      }
      descend(moule.depart(f))
      if (!solution) return { ok: false, note: 'aucun tracé' }
      return { ok: true, coups: f.traits.length, solution, note: f.levees ? `${P.pluriel(faut, 'trait de plume', 'traits de plume')}, pas un de moins : ${impairs} points impairs` : P.pluriel(total, 'tracé') }
    },
    dessiner({ f, e, agir, fige }) {
      // Les traits tracés se dessinent en dernier : l'or passe par-dessus la pierre aux croisements.
      const ordre = f.traits.map((_, k) => k).sort((a, b) => e.faits.includes(a) - e.faits.includes(b))
      const ligne = k => { const [[x1, y1], [x2, y2]] = f.traits[k].map(p => f.points[p]); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${e.faits.includes(k) ? ' class="fait"' : ''}/>` }
      const voisins = e.ou === null ? [] : libres(f, e, e.ou).map(k => bout(f, k, e.ou))
      const points = f.points.map(([x, y], p) => {
        const reste = libres(f, e, p).length
        return h('button', {
          type: 'button', disabled: fige, style: `left:${x}%;top:${y}%`,
          class: ['tt-point', p === e.ou ? 'ici' : '', voisins.includes(p) ? 'voisin' : '', reste ? '' : 'clos'].filter(Boolean).join(' '),
          'aria-label': `Point ${p + 1}${p === e.ou ? ', sous ton doigt' : ''} : ${reste ? P.pluriel(reste, 'trait libre', 'traits libres') : 'plus de trait libre'}`,
          onclick: () => agir(e.ou === null ? { part: p } : p === e.ou ? { leve: true } : { va: p }),
        })
      })
      const levees = e.ou === null ? e.plume : e.plume - 1
      const pied = f.levees
        ? h('p', null, 'Levées : ', h('b', null, `${levees} sur ${f.levees}`), e.ou === null && e.plume ? h('span', { class: 'leve' }, ' · repars d’où tu veux') : null)
        : h('p', null, e.ou === null ? 'Pose ton doigt sur un point.' : 'Sans lever le doigt, sans repasser.')
      return h('div', { class: 'tt' },
        h('div', { class: 'tt-figure', role: 'group', 'aria-label': `Une figure de ${f.points.length} points et ${f.traits.length} traits` },
          h('div', { class: 'tt-zone' },
            h('div', { class: 'tt-traits', html: `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${ordre.map(ligne).join('')}</svg>` }),
            points)),
        // Le doute est offert à chaque figure : s'il ne paraissait que sur l'impossible, il la dénoncerait.
        h('div', { class: 'tt-pied' }, pied, h('button', { type: 'button', class: 'lien', disabled: fige, onclick: () => agir({ impossible: true }) }, 'C’est impossible')))
    },
  })

  /* ---------------------------------------------------------------- */

  const REGLE = 'Touche un point pour partir, puis un point voisin pour tracer.'
  const EULER = 'la règle est d’Euler, Solutio problematis ad geometriam situs pertinentis, 1736'

  P.fiche({
    id: 'maison-nicolas', moule: 'trait', niveau: 1,
    titre: 'La maison',
    source: 'Tradition allemande : « Das ist das Haus vom Nikolaus », huit syllabes pour huit traits',
    recit: [
      'Les enfants d’Allemagne la tracent en chantant : une syllabe par trait, huit en tout.',
      'Un carré, ses deux diagonales, un toit.',
      'D’un seul trait : sans lever le doigt, sans repasser sur un trait.',
    ],
    regle: REGLE,
    points: [[27, 35], [73, 35], [73, 100], [27, 100], [50, 0]],
    traits: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3], [0, 4], [1, 4]],
  })

  P.fiche({
    id: 'enveloppe-ouverte', moule: 'trait', niveau: 2,
    titre: 'L’enveloppe ouverte',
    source: `Tradition des cours d’école ; ${EULER}`,
    recit: [
      'Une enveloppe, le rabat relevé.',
      'Ses plis se croisent au milieu : c’est un point, on peut y tourner.',
      'D’un seul trait : sans lever le doigt, sans repasser sur un trait.',
    ],
    regle: REGLE,
    points: [[14, 40], [86, 40], [86, 100], [14, 100], [50, 70], [50, 0]],
    traits: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4], [0, 5], [1, 5]],
  })

  P.fiche({
    id: 'enveloppe-fermee', moule: 'trait', niveau: 3,
    titre: 'L’enveloppe fermée',
    source: `Tradition des cours d’école ; ${EULER}`,
    recit: [
      'Le rabat est retombé : il ne reste que le rectangle et ses plis.',
      'D’un seul trait, encore : sans lever le doigt, sans repasser sur un trait.',
    ],
    regle: REGLE,
    points: [[10, 14], [90, 14], [90, 86], [10, 86], [50, 50]],
    traits: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4]],
    impossible: true,
    explication: [
      'Un point qu’on traverse use deux traits : un pour arriver, un pour repartir.',
      'Seuls le départ et l’arrivée peuvent donc en voir partir un nombre impair. Ici, les quatre coins en ont trois.',
      'Quatre points impairs pour deux places : c’est impossible, Euler l’a montré en 1736.',
    ],
  })

  P.fiche({
    id: 'pavillon', moule: 'trait', niveau: 4,
    titre: 'Le pavillon',
    source: 'D’après H. E. Dudeney, Amusements in Mathematics, n° 240 (« The Union Jack »), 1917 — son pavillon, réduit à des traits simples',
    recit: [
      'Un pavillon : son cadre, sa croix droite, sa croix en biais.',
      'D’un seul trait, personne ne le trace. Je t’accorde trois levées de doigt : quatre traits de plume.',
      'Chaque trait de plume va jusqu’à l’impasse. Là, ton doigt se lève, et tu repars d’où tu veux.',
    ],
    regle: 'Touche un point pour partir, puis un point voisin. Trois levées, pas une de plus.',
    points: [[2, 6], [50, 6], [98, 6], [2, 50], [50, 50], [98, 50], [2, 94], [50, 94], [98, 94]],
    traits: [[0, 1], [1, 2], [2, 5], [5, 8], [8, 7], [7, 6], [6, 3], [3, 0], [1, 4], [4, 7], [3, 4], [4, 5], [0, 4], [4, 8], [2, 4], [4, 6]],
    levees: 3,
    explication: [
      'Huit points voient partir trois traits : les quatre coins et les quatre milieux.',
      'Un trait de plume en règle deux, son départ et son arrivée : il en faut donc quatre, c’est la règle que donne Dudeney.',
      'Pars chaque fois d’un de ces huit points, et ne finis jamais au centre.',
    ],
  })
}
