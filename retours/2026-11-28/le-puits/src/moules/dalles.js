'use strict'
/* Le jeu des dalles : un duel. Une bande de dalles, des stèles de deux ; qui ne
   peut plus poser a perdu. Le Sphinx ne se trompe jamais — il lit la valeur de
   chaque tronçon libre, comme au Nim (Sprague et Grundy, 1935) ; le jeu lui-même
   est celui que T. R. Dawson publie en 1934. Sur une bande paire, on ne le bat
   qu'en ouvrant au milieu, puis en l'imitant en miroir.

   Une fiche donne `dalles`, le nombre de dalles. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.dalles = ['.........', '##.##.##.', '##.##.##.', '.........', '.##.##.##', '.##.##.##', '.........', '##.##.##.', '##.##.##.']

  P.style(`
.da-plateau { position: relative; display: grid; gap: 3px; margin: 18px 0 10px; padding: 6px 0; touch-action: manipulation; cursor: pointer; }
.da-dalle { grid-row: 1; aspect-ratio: 1 / 1.7; background: #3a2e26; border-radius: 3px; box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06); }
.da-stele { grid-row: 1; margin: -4px 0; border-radius: 5px; z-index: 1; }
.da-stele.moi { background: linear-gradient(180deg, var(--or-clair), var(--or)); box-shadow: 0 0 12px rgba(var(--sable), 0.5), inset 0 -4px 0 rgba(0, 0, 0, 0.2); }
.da-stele.lui { background: linear-gradient(180deg, #8fb1d8, #46699a); box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.25); }
.da-stele.vise { background: none; border: 2px dashed var(--or-clair); }
.da-legende { display: flex; justify-content: space-between; margin: 0 0 12px; font-size: 12px; color: var(--muted); }
.da-legende i { display: inline-block; width: 16px; height: 9px; margin-right: 5px; border-radius: 2px; vertical-align: -1px; }
`)

  // La valeur d'une bande libre de n dalles : nulle, celui qui doit y jouer a perdu.
  const VALEUR = [0, 0]
  const valeurDUneBande = n => {
    for (let k = VALEUR.length; k <= n; k++) {
      const vus = new Set()
      for (let a = 0; a <= k - 2; a++) vus.add(VALEUR[a] ^ VALEUR[k - 2 - a])
      let m = 0
      while (vus.has(m)) m++
      VALEUR[k] = m
    }
    return VALEUR[n]
  }
  const libres = d => d.flatMap((c, i) => (i < d.length - 1 && !c && !d[i + 1] ? [i] : []))
  function valeur(d) {
    let v = 0, long = 0
    for (let i = 0; i <= d.length; i++) {
      if (i < d.length && !d[i]) long++
      else { v ^= valeurDUneBande(long); long = 0 }
    }
    return v
  }

  P.moule({
    cle: 'dalles',
    nom: 'Les dalles',
    socle: 'duel',
    glyphe: 'dalles',
    unite: ['partie', 'parties'],
    // `poses` garde chaque stèle posée : deux stèles voisines de la même couleur ne se liraient plus dans les seules dalles.
    depart: f => ({ d: new Array(f.dalles).fill(0), poses: [], vise: null, aMoi: true }),
    compte: coup => coup.vise === undefined,
    coups: (f, e) => libres(e.d).map(i => ({ pose: i })),
    jouer(f, e, coup) {
      if (coup.vise !== undefined) {
        const i = coup.vise
        if (i < 0 || i > f.dalles - 2 || e.d[i] || e.d[i + 1]) return { refus: 'Pas là : il faut deux dalles voisines encore libres.' }
        return { etat: { ...e, vise: i } }
      }
      const i = coup.pose
      if (e.d[i] || e.d[i + 1]) return { refus: 'Pas là : il faut deux dalles voisines encore libres.' }
      const d = e.d.slice()
      d[i] = d[i + 1] = coup.lui ? 2 : 1
      return { etat: { d, poses: [...e.poses, [i, coup.lui ? 2 : 1]], vise: null, aMoi: !!coup.lui } }
    },
    // Qui doit jouer et ne le peut plus a perdu.
    fini: (f, e) => (libres(e.d).length ? null : e.aMoi ? { perdu: 'Plus de place pour toi. Les dalles se relèvent.' } : { gagne: true }),
    riposte(f, e) {
      const l = libres(e.d)
      const gagnants = l.filter(i => { const d = e.d.slice(); d[i] = d[i + 1] = 2; return valeur(d) === 0 })
      const parmi = gagnants.length ? gagnants : l
      return { pose: parmi[Math.floor(Math.random() * parmi.length)], lui: true }
    },
    // Un duel n'a pas de plus court chemin : ce qu'on vérifie, c'est que celui qui commence peut gagner.
    verifier: f => (valeur(new Array(f.dalles).fill(0)) ? { ok: true, note: 'qui commence peut gagner' } : { ok: false, note: 'qui commence perd toujours' }),
    dessiner({ f, e, agir, fige }) {
      const plateau = h('div', { class: 'da-plateau', style: `grid-template-columns:repeat(${f.dalles},minmax(0,1fr))`, tabindex: '0', role: 'group', 'aria-label': `${f.dalles} dalles. Flèches pour viser, Entrée pour poser.` },
        e.d.map((_, i) => h('i', { class: 'da-dalle', style: `grid-column:${i + 1}` })),
        e.poses.map(([i, qui]) => h('i', { class: `da-stele ${qui === 1 ? 'moi' : 'lui'}`, style: `grid-column:${i + 1} / span 2` })),
        e.vise !== null && h('i', { class: 'da-stele vise', style: `grid-column:${e.vise + 1} / span 2` }))
      plateau.addEventListener('click', ev => {
        if (fige || !e.aMoi) return
        const r = plateau.getBoundingClientRect()
        // Le joint le plus proche du doigt : la stèle se pose à cheval dessus.
        const joint = Math.round((ev.clientX - r.left) / (r.width / f.dalles))
        agir({ vise: Math.min(f.dalles - 1, Math.max(1, joint)) - 1 })
      })
      plateau.addEventListener('keydown', ev => {
        if (fige || !e.aMoi || !['ArrowLeft', 'ArrowRight', 'Enter'].includes(ev.key)) return
        ev.preventDefault()
        if (ev.key === 'Enter') return e.vise !== null && agir({ pose: e.vise })
        const l = libres(e.d)
        if (!l.length) return
        const pas = ev.key === 'ArrowLeft' ? -1 : 1
        const ou = e.vise === null ? (pas > 0 ? -1 : l.length) : l.indexOf(e.vise)
        agir({ vise: l[(ou + pas + l.length) % l.length] })
      })
      return h('div', null,
        plateau,
        h('p', { class: 'da-legende' }, h('span', null, h('i', { style: 'background:var(--or)' }), 'toi'), h('span', null, h('i', { style: 'background:var(--lapis)' }), 'le Sphinx')),
        h('div', { class: 'pose' }, h('button', { type: 'button', class: 'bouton', disabled: fige || !e.aMoi || e.vise === null, onclick: () => agir({ pose: e.vise }) }, 'Poser la stèle')))
    },
  })

  /* ---------------------------------------------------------------- */

  const EXPLICATION = [
    'Pose ta première stèle au milieu : il reste autant de dalles de chaque côté.',
    'Ensuite, imite-moi : là où je pose d’un côté, pose en face, en miroir.',
    'Tant que je peux poser, tu le peux aussi. Le dernier coup est donc pour toi.',
  ]
  const fiche = (dalles, niveau, titre, phrase) => P.fiche({
    id: 'dalles-' + dalles, moule: 'dalles', niveau, titre,
    source: 'Le jeu de T. R. Dawson, 1934',
    recit: [phrase, 'Chacun son tour, on pose une stèle sur deux dalles voisines encore libres.', 'Qui ne peut plus poser a perdu. Tu commences.'],
    regle: 'Une stèle sur deux dalles voisines. Qui ne peut plus poser a perdu.',
    dalles, explication: EXPLICATION,
  })
  fiche(6, 2, 'Le petit jeu des dalles', 'Six dalles, et nous deux.')
  fiche(10, 3, 'Le jeu des dalles', 'Dix dalles, cette fois.')
  fiche(14, 4, 'Le grand jeu des dalles', 'Quatorze dalles. Tu crois avoir compris ?')
}
