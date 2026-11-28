'use strict'
/* La tablette empoisonnée : un duel. Une tablette de chocolat, dont le carré
   d'en bas à gauche est empoisonné ; on croque un carré, et tout ce qui est
   au-dessus et à sa droite part avec lui. Fred Schuh le joue en 1952 avec des
   diviseurs, David Gale lui donne sa tablette en 1974, et on l'appelle « Chomp ».
   Son paradoxe : on sait prouver que celui qui commence gagne — s'il existait
   une bonne réponse à son premier coup, il n'avait qu'à la jouer lui-même —,
   sans que personne sache dire quel coup. Le Sphinx, lui, a compté.

   Une fiche donne `rangs` et `colonnes` : la taille de la tablette. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.tablette = ['##.##....', '##.##....', '.........', '##.##.##.', '##.##.##.', '.........', '##.##.##.', '##.##.##.', '.........']
  // Le signe du carré empoisonné : un dessin, parce qu'une tête de mort tapée devient un emoji en couleurs sur un téléphone sur deux.
  P.glyphes.crane = ['..#####..', '.#######.', '#########', '#..###..#', '#..###..#', '####.####', '.#######.', '..#.#.#..', '..#####..']

  P.style(`
.tb { display: grid; gap: 10px; justify-items: center; }
.tb-tablette { display: grid; gap: 4px; padding: 6px; border-radius: 10px; background: rgba(0, 0, 0, 0.3); touch-action: manipulation; }
.tb-carre { width: var(--cote); height: var(--cote); padding: 0; display: grid; place-items: center; border: 0; border-radius: 6px; background: linear-gradient(160deg, #7a4a2a, #4f2c17); box-shadow: inset 0 2px 0 rgba(255, 220, 180, 0.22), inset 0 -4px 0 rgba(0, 0, 0, 0.32); color: #f3dea6; }
.tb-carre.vise { background: linear-gradient(160deg, var(--or-clair), var(--or)); box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.2), 0 0 10px rgba(var(--sable), 0.45); }
.tb-carre.poison { background: linear-gradient(160deg, #7d2f2f, #4a1717); color: #ffd9d9; }
.tb-carre[disabled] { cursor: default; }
.tb-vide { width: var(--cote); height: var(--cote); border: 1px dashed rgba(243, 236, 226, 0.12); border-radius: 6px; }
.tb-vide.de-lui { border-color: var(--lapis); background: rgba(111, 151, 196, 0.14); }
.tb-legende { width: 100%; display: flex; justify-content: space-between; gap: 8px; margin: 0; font-size: 11.5px; color: var(--muted); }
.tb-legende span { display: inline-flex; align-items: center; gap: 5px; }
.tb-legende i { width: 12px; height: 12px; border-radius: 3px; }
.tb .pose { width: 100%; }
`)

  // Une position, c'est la hauteur qui reste à chaque colonne : croquer ne fait que raboter vers la droite.
  const apres = (cols, [c, r]) => cols.map((x, i) => (i >= c ? Math.min(x, r) : x))
  const mordables = cols => cols.flatMap((x, c) => Array.from({ length: x }, (_, r) => [c, r])).filter(([c, r]) => c || r)
  // Qui doit jouer devant le seul carré empoisonné a perdu ; toutes les autres positions s'en déduisent, une fois chacune.
  const ISSUES = new Map()
  function gagne(cols) {
    const cle = cols.join(',')
    if (!ISSUES.has(cle)) ISSUES.set(cle, mordables(cols).some(m => !gagne(apres(cols, m))))
    return ISSUES.get(cle)
  }
  const gagnants = cols => mordables(cols).filter(m => !gagne(apres(cols, m)))
  const pleine = f => new Array(f.colonnes).fill(f.rangs)
  const emportes = (cols, m) => (m ? cols.reduce((n, x, i) => n + (i >= m[0] ? Math.max(0, x - m[1]) : 0), 0) : 0)

  P.moule({
    cle: 'tablette',
    nom: 'La tablette empoisonnée',
    socle: 'duel',
    glyphe: 'tablette',
    unite: ['partie', 'parties'],
    // `avant` garde la tablette d'avant ma dernière bouchée : sans elle, on ne verrait pas ce que je viens de croquer.
    depart: f => ({ cols: pleine(f), vise: null, avant: null, aMoi: true }),
    compte: coup => coup.vise === undefined,
    coups: (f, e) => mordables(e.cols).map(m => ({ mange: m })),
    jouer(f, e, coup) {
      const m = coup.vise !== undefined ? coup.vise : coup.mange
      if (coup.vise === null) return { etat: { ...e, vise: null } }
      if (!Array.isArray(m) || !(e.cols[m[0]] > m[1]) || m[1] < 0) return { refus: 'Ce carré est déjà mangé.' }
      // Le carré empoisonné ne se croque pas par mégarde : la partie s'arrête quand il reste seul.
      if (!m[0] && !m[1]) return { refus: 'Celui-là est empoisonné : qui n’a plus que lui a perdu.' }
      if (coup.vise) return { etat: { ...e, vise: m } }
      if (!coup.lui && !e.aMoi) return { refus: 'Attends : c’est à moi de croquer.' }
      return { etat: { cols: apres(e.cols, m), vise: null, avant: coup.lui ? e.cols : null, aMoi: !!coup.lui } }
    },
    fini: (f, e) => (mordables(e.cols).length ? null : e.aMoi ? { perdu: 'Il ne te reste que le carré empoisonné. Bon appétit.' } : { gagne: true }),
    riposte(f, e) {
      const bons = gagnants(e.cols)
      const parmi = bons.length ? bons : mordables(e.cols)
      return { mange: parmi[Math.floor(Math.random() * parmi.length)], lui: true }
    },
    // Le vol de stratégie promet que qui commence gagne ; le calcul le confirme, position par position.
    verifier: f => (gagne(pleine(f)) ? { ok: true, note: 'qui commence peut gagner' } : { ok: false, note: 'qui commence perd toujours' }),
    dessiner({ f, e, agir, fige }) {
      const cote = Math.min(56, Math.floor((328 - 12 - 4 * (f.colonnes - 1)) / f.colonnes))
      const bloque = fige || !e.aMoi
      const part = (c, r) => e.vise && c >= e.vise[0] && r >= e.vise[1]
      const cases = []
      // La rangée du bas se dessine en dernier : le carré empoisonné est en bas à gauche, comme sur la table.
      for (let r = f.rangs - 1; r >= 0; r--) {
        for (let c = 0; c < f.colonnes; c++) {
          const ou = `${r + 1}e rangée, ${c + 1}e colonne`
          if (r >= e.cols[c]) cases.push(h('i', { class: `tb-vide ${e.avant && r < e.avant[c] ? 'de-lui' : ''}` }))
          else if (!c && !r) cases.push(h('button', { type: 'button', class: 'tb-carre poison', 'aria-label': 'Le carré empoisonné', disabled: bloque, onclick: () => agir({ vise: [0, 0] }), html: P.glyphe('crane', Math.round(cote * 0.5)) }))
          else cases.push(h('button', {
            type: 'button', class: `tb-carre ${part(c, r) ? 'vise' : ''}`, 'aria-label': `Carré, ${ou}`, 'aria-pressed': part(c, r) ? 'true' : 'false', disabled: bloque,
            // Un premier doigt montre ce qui partirait, un second sur le même carré le croque.
            onclick: () => agir(e.vise && e.vise[0] === c && e.vise[1] === r ? { mange: [c, r] } : { vise: [c, r] }),
          }))
        }
      }
      const n = emportes(e.cols, e.vise)
      return h('div', { class: 'tb' },
        h('div', { class: 'tb-tablette', style: `--cote:${cote}px;grid-template-columns:repeat(${f.colonnes},${cote}px)`, role: 'group', 'aria-label': `La tablette : ${f.rangs} rangées de ${f.colonnes} carrés` }, cases),
        h('p', { class: 'tb-legende' },
          h('span', null, h('i', { style: 'background:#7d2f2f' }), 'empoisonné'),
          h('span', null, h('i', { style: 'background:var(--or)' }), 'ta bouchée'),
          h('span', null, h('i', { style: 'border:1px dashed var(--lapis)' }), 'sa dernière bouchée')),
        h('div', { class: 'pose' }, h('button', { type: 'button', class: 'bouton', disabled: bloque || !e.vise, onclick: () => agir({ mange: e.vise }) },
          e.vise ? `Croquer ${n > 1 ? `ces ${n} carrés` : 'ce carré'}` : 'Touche un carré')))
    },
  })

  /* ---------------------------------------------------------------- */

  const ORDINAUX = ['', 'première', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième']
  // À deux rangées, la recette tient en une phrase ; au-delà, on sait qu'un coup gagne sans savoir le dire — la fiche donne alors celui que le calcul trouve.
  const explication = f => {
    if (f.rangs === 2) return [
      'Croque d’abord le carré du coin, en haut à droite : il reste une case de plus en bas qu’en haut.',
      'Ensuite, après chacune de mes bouchées, rends-moi cette forme : en bas, une case de plus qu’en haut, pas davantage.',
      'De bouchée en bouchée, il ne me reste que le carré empoisonné.',
    ]
    const [c, r] = gagnants(pleine(f))[0]
    return [
      'On sait qu’un premier coup gagne : si croquer le coin d’en haut à droite perdait, ma bonne réponse, tu aurais pu la jouer avant moi.',
      'Mais aucune règle simple ne dit lequel : passé deux rangées, il faut chercher.',
      `Ici, c’est le carré de la ${ORDINAUX[r + 1]} rangée en partant du bas, ${ORDINAUX[c + 1]} colonne. Après lui, cherche encore.`,
    ]
  }
  const fiche = (rangs, colonnes, niveau, titre, phrase) => {
    const f = { id: `tablette-${rangs}x${colonnes}`, moule: 'tablette', niveau, titre, rangs, colonnes }
    return P.fiche({
      ...f,
      source: 'Fred Schuh, 1952, et David Gale, 1974 : le jeu qu’on appelle « Chomp »',
      recit: [phrase, 'Chacun son tour, on choisit un carré : on le croque, avec tout ce qui est au-dessus de lui et à sa droite.', 'Qui n’a plus que le carré empoisonné a perdu. Tu commences.'],
      regle: 'Un carré, et tout ce qui est au-dessus et à droite. Le carré empoisonné reste au perdant.',
      explication: explication(f),
    })
  }
  fiche(2, 4, 1, 'La petite tablette', 'Une tablette de deux rangées. Le carré d’en bas à gauche est empoisonné.')
  fiche(3, 4, 3, 'La tablette empoisonnée', 'Trois rangées de quatre carrés. Celui d’en bas à gauche est empoisonné.')
  fiche(4, 5, 4, 'La grande tablette', 'Vingt carrés de chocolat, dont un empoisonné : celui d’en bas à gauche.')
  fiche(4, 7, 5, 'La tablette du pharaon', 'Quatre rangées de sept carrés. Celui d’en bas à gauche est empoisonné, et je ne te dirai pas où mordre.')
}
