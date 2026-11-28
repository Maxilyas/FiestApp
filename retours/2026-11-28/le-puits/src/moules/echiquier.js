'use strict'
/* L'échiquier : poser des pièces sur un damier, sous une seule contrainte. Deux
   familles s'y jouent. « En paix » : aucune pièce n'en menace une autre — les
   huit reines de Max Bezzel (1848), les quatorze fous de Dudeney. « En garde » :
   chaque case est occupée ou menacée — les cinq reines de Jaenisch (1862), les
   huit fous de Dudeney.

   Une fiche donne : `cote` (le damier), `piece` (reine ou fou), `combien` (les
   pièces à poser), `but` (`paix` ou `garde`), et `borne` quand elle annonce un
   record : le programme vérifie alors qu'une pièce de plus (en paix) ou de
   moins (en garde) ne se peut pas. */
{
  const P = globalThis.P
  const { h } = P

  // Les pièces sont des glyphes, pas des caractères : ♛ et ♝ n'ont pas le même dessin d'un téléphone à l'autre, et manquent à certains.
  P.glyphes.reine = ['#...#...#', '#...#...#', '##.###.##', '#########', '.#######.', '.#######.', '..#####..', '.#######.', '#########']
  P.glyphes.fou = ['....#....', '...###...', '..##.##..', '..#####..', '...###...', '...###...', '..#####..', '.#######.', '.#######.']

  P.style(`
.ec { display: grid; justify-items: center; gap: 6px; }
.ec-plateau { display: grid; grid-template-columns: repeat(var(--n), var(--c)); border: 2px solid rgba(217, 181, 106, 0.5); border-radius: 6px; overflow: hidden; }
.ec-case { position: relative; width: var(--c); height: var(--c); padding: 0; border: 0; display: grid; place-items: center; background: #5d4c3a; color: var(--or-clair); touch-action: manipulation; }
.ec-case.sombre { background: #3a2e26; }
.ec-case[disabled] { cursor: default; }
.ec-case:focus-visible { outline-offset: -3px; }
.ec-case.menacee::after { content: ""; position: absolute; inset: 0; background: rgba(111, 151, 196, 0.42); }
.ec-case.conflit::after { background: rgba(224, 108, 108, 0.45); }
.ec-case svg { position: relative; z-index: 1; filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.45)); }
.ec-case.conflit svg { color: #ffd9d9; }
.ec-compte { margin: 0; min-height: 18px; font-size: 12.5px; line-height: 18px; color: var(--muted); text-align: center; }
.ec-compte b { color: var(--ink); font-weight: 600; }
.ec-compte .faux { color: var(--faux); }
`)

  // `pas` : les directions où la pièce glisse. La première sert au programme pour ranger les cases en lignes.
  const PIECES = {
    reine: { nom: 'reine', noms: 'reines', posees: 'Reines posées', une: 'une', deplacer: 'ôtes-en une pour la déplacer', pas: [[0, 1], [1, 0], [1, 1], [1, -1]] },
    fou: { nom: 'fou', noms: 'fous', posees: 'Fous posés', une: 'un', deplacer: 'ôtes-en un pour le déplacer', pas: [[1, 1], [1, -1]] },
  }
  // Ce qui ne change pas le long d'une direction : deux cases de même clé sont sur la même ligne.
  const cle = (n, i, [dr, dc]) => Math.floor(i / n) * dc - (i % n) * dr

  /* Ce que chaque case menace. Une pièce menace toute sa ligne, même derrière
     une autre : entre pièces pareilles, celle qui fait écran menace à sa place,
     et le compte des cases gardées est le même. */
  const cartes = new WeakMap()
  function portees(f) {
    if (!cartes.has(f)) {
      const n = f.cote
      const cases = [...Array(n * n).keys()]
      cartes.set(f, cases.map(i => cases.filter(j => j !== i && PIECES[f.piece].pas.some(d => cle(n, i, d) === cle(n, j, d)))))
    }
    return cartes.get(f)
  }
  // Combien de pièces menacent chaque case.
  function menaces(f, e) {
    const m = new Array(f.cote * f.cote).fill(0)
    for (const i of e.poses) for (const j of portees(f)[i]) m[j]++
    return m
  }
  const tient = (f, e, m = menaces(f, e)) => (f.but === 'garde' ? m.every((x, i) => x || e.poses.includes(i)) : e.poses.every(i => !m[i]))

  /* En paix : chaque pièce tient seule sa ligne. On descend donc ligne après
     ligne — une pièce, ou rien si la fiche laisse des lignes vides — et chaque
     disposition se compte une fois. Case par case, les quatorze fous
     demandaient des dizaines de millions d'essais. */
  function enPaix(f, combien) {
    const n = f.cote
    const menace = portees(f)
    const rangs = new Map()
    for (let i = 0; i < n * n; i++) {
      const k = cle(n, i, PIECES[f.piece].pas[0])
      rangs.set(k, [...(rangs.get(k) || []), i])
    }
    // Les lignes courtes d'abord : un coin n'a qu'une case, et son choix ferme aussitôt les grandes diagonales.
    const lignes = [...rangs.values()].sort((a, b) => a.length - b.length)
    if (combien > lignes.length) return { n: 0 }
    const sous = new Array(n * n).fill(0)
    const prises = []
    let total = 0, solution = null
    const descend = (l, vides) => {
      if (prises.length === combien) { total++; solution = solution || prises.slice(); return }
      for (const i of lignes[l]) {
        if (sous[i]) continue
        prises.push(i)
        for (const j of menace[i]) sous[j]++
        descend(l + 1, vides)
        for (const j of menace[i]) sous[j]--
        prises.pop()
      }
      if (vides) descend(l + 1, vides - 1)
    }
    descend(0, lignes.length - combien)
    return { n: total, solution }
  }

  /* En garde : une case sans garde doit en recevoir une, d'une pièce posée sur
     elle ou sur sa ligne. On essaie ces cases l'une après l'autre, et celle
     qu'on vient d'essayer est écartée pour les suivantes : sans cela, la même
     disposition se compterait autant de fois qu'elle a d'ordres de pose. On
     prend la case sans garde qui a le moins de secours : une impasse se voit
     tout de suite. Les cases tiennent dans deux entiers de 32 bits — un damier
     de 64 cases au plus —, parce que ce compte se refait à chaque visite. */
  function enGarde(f, combien) {
    const n2 = f.cote * f.cote
    const lignes = portees(f)
    const LO = lignes.map((_, i) => (i < 32 ? 1 << i : 0))
    const HI = lignes.map((_, i) => (i < 32 ? 0 : 1 << (i - 32)))
    // Une case garde celles de ses lignes et elle-même — et ce sont aussi celles qui la gardent.
    const autour = lignes.map((l, i) => [i, ...l])
    const GLO = autour.map(l => l.reduce((m, j) => m | LO[j], 0))
    const GHI = autour.map(l => l.reduce((m, j) => m | HI[j], 0))
    const TLO = n2 >= 32 ? -1 : (1 << n2) - 1
    const THI = n2 >= 64 ? -1 : n2 > 32 ? (1 << (n2 - 32)) - 1 : 0
    const large = Math.max(...autour.map(l => l.length))
    const compte = x => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24 }
    const choix = (m, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (m - k + i) / i; return k > m ? 0 : Math.round(r) }
    const prises = []
    let total = 0, solution = null
    // `xlo`, `xhi` : les cases où l'on ne posera plus — prises, ou écartées.
    const descend = (k, lo, hi, xlo, xhi) => {
      if (lo === TLO && hi === THI) {
        // Tout est gardé : les pièces qui restent vont n'importe où ailleurs.
        const libres = n2 - compte(xlo) - compte(xhi)
        total += choix(libres, k)
        if (!solution && libres >= k) solution = [...prises, ...autour.map(l => l[0]).filter(i => !(xlo & LO[i]) && !(xhi & HI[i])).slice(0, k)]
        return
      }
      if (n2 - compte(lo) - compte(hi) > k * large) return
      let s = -1, secours = 99
      for (let i = 0; i < n2 && secours; i++) {
        if ((lo & LO[i]) || (hi & HI[i])) continue
        const c = compte(GLO[i] & ~xlo) + compte(GHI[i] & ~xhi)
        if (c < secours) { s = i; secours = c }
      }
      for (const c of autour[s]) {
        if ((xlo & LO[c]) || (xhi & HI[c])) continue
        xlo |= LO[c]
        xhi |= HI[c]
        prises.push(c)
        descend(k - 1, lo | GLO[c], hi | GHI[c], xlo, xhi)
        prises.pop()
      }
    }
    descend(combien, 0, 0, 0, 0)
    return { n: total, solution }
  }

  P.moule({
    cle: 'echiquier',
    nom: 'L’échiquier',
    socle: 'pose',
    glyphe: 'reine',
    unite: ['pose', 'poses'],
    // `poses` garde l'ordre des poses : la solution se rejoue pièce après pièce.
    depart: () => ({ poses: [] }),
    // Ôter ne coûte rien : on ne compte que les pièces posées.
    compte: coup => coup.pose !== undefined,
    coups(f, e) {
      const libres = e.poses.length < f.combien ? [...Array(f.cote * f.cote).keys()].filter(i => !e.poses.includes(i)) : []
      return [...libres.map(i => ({ pose: i })), ...e.poses.map(i => ({ ote: i }))]
    },
    jouer(f, e, coup) {
      const p = PIECES[f.piece]
      if (coup.ote !== undefined) {
        if (!e.poses.includes(coup.ote)) return { refus: 'Il n’y a rien à ôter ici.' }
        return { etat: { poses: e.poses.filter(i => i !== coup.ote) } }
      }
      if (e.poses.includes(coup.pose)) return { refus: 'Cette case est prise.' }
      if (e.poses.length >= f.combien) return { refus: `Tu as posé tes ${f.combien} ${p.noms} : ${p.deplacer}.` }
      return { etat: { poses: [...e.poses, coup.pose] } }
    },
    fini: (f, e) => (e.poses.length === f.combien && tient(f, e) ? { gagne: true } : null),
    verifier(f) {
      const p = PIECES[f.piece]
      const compter = f.but === 'garde' ? enGarde : enPaix
      const r = compter(f, f.combien)
      if (!r.n) return { ok: false, note: 'aucune solution' }
      let note = P.pluriel(r.n, 'solution')
      if (f.borne) {
        // Un record annoncé se prouve : « le plus de fous possible » ne vaut que si quinze ne tiennent pas.
        if (compter(f, f.combien + (f.but === 'garde' ? -1 : 1)).n) return { ok: false, note: `on fait mieux que ${f.combien} ${p.noms}` }
        note += `, et pas ${p.une} ${p.nom} de ${f.but === 'garde' ? 'moins' : 'plus'}`
      }
      return { ok: true, coups: f.combien, solution: r.solution.map(i => ({ pose: i })), note }
    },
    dessiner({ f, e, agir, fige }) {
      const p = PIECES[f.piece]
      const n = f.cote
      const m = menaces(f, e)
      // Huit cases de 38 pixels et la ligne du compte tiennent dans les 340 du cadre ; un petit damier prend des cases plus larges.
      const cote = Math.min(54, Math.floor(304 / n))
      const signe = P.glyphe(f.piece, Math.round(cote * 0.62))
      const cases = m.map((sous, i) => {
        const la = e.poses.includes(i)
        const conflit = la && sous && f.but !== 'garde'
        return h('button', {
          type: 'button', disabled: fige,
          class: ['ec-case', (Math.floor(i / n) + i % n) % 2 ? 'sombre' : '', sous ? 'menacee' : '', conflit ? 'conflit' : ''].filter(Boolean).join(' '),
          'aria-label': `${'abcdefgh'[i % n]}${n - Math.floor(i / n)} : ${la ? p.nom + (conflit ? ', menacée' : '') : sous ? 'menacée' : 'libre'}`,
          html: la ? signe : null,
          onclick: () => agir(la ? { ote: i } : { pose: i }),
        })
      })
      const enConflit = e.poses.filter(i => m[i]).length
      const sansGarde = m.filter((x, i) => !x && !e.poses.includes(i)).length
      const suite = f.but === 'garde'
        ? h('span', null, sansGarde ? ` · ${P.pluriel(sansGarde, 'case')} sans garde` : ' · tout est gardé')
        : enConflit ? h('span', { class: 'faux' }, ` · ${enConflit} se menacent`) : null
      return h('div', { class: 'ec' },
        h('div', { class: 'ec-plateau', style: `--n:${n};--c:${cote}px`, role: 'group', 'aria-label': `Un damier de ${n} cases de côté` }, cases),
        h('p', { class: 'ec-compte' }, `${p.posees} : `, h('b', null, `${e.poses.length} sur ${f.combien}`), suite))
    },
  })

  /* ---------------------------------------------------------------- */

  const BEZZEL = 'Max Bezzel, Schachzeitung, 1848'
  P.fiche({
    id: 'cinq-reines', moule: 'echiquier', niveau: 1,
    titre: 'Les cinq reines',
    source: `D’après ${BEZZEL} — son problème des huit reines, sur un damier de cinq cases de côté`,
    recit: [
      'Un petit damier pour commencer : cinq cases de côté.',
      'Une reine menace sa ligne, sa colonne et ses deux diagonales, aussi loin qu’elles vont.',
      'Poses-en cinq, sans qu’aucune n’en menace une autre.',
    ],
    regle: 'Touche une case pour y poser une reine, touche la reine pour l’ôter.',
    cote: 5, piece: 'reine', combien: 5, but: 'paix',
  })

  P.fiche({
    id: 'six-reines', moule: 'echiquier', niveau: 2,
    titre: 'Les six reines',
    source: `D’après ${BEZZEL} — son problème des huit reines, sur un damier de six cases de côté`,
    recit: [
      'Six cases de côté, six reines.',
      'Aucune n’en menace une autre : ni en ligne, ni en colonne, ni en biais.',
      'Il n’y a que quatre façons d’y arriver.',
    ],
    regle: 'Touche une case pour y poser une reine, touche la reine pour l’ôter.',
    cote: 6, piece: 'reine', combien: 6, but: 'paix',
  })

  P.fiche({
    id: 'quatorze-fous', moule: 'echiquier', niveau: 3,
    titre: 'Les quatorze fous',
    source: 'H. E. Dudeney, Amusements in Mathematics, n° 299 (« Bishops in Convocation »), 1917',
    recit: [
      'Un fou ne va qu’en biais, aussi loin que va sa diagonale.',
      'L’échiquier en porte quatorze sans qu’aucun n’en menace un autre. Jamais quinze.',
      'Pose les quatorze.',
    ],
    regle: 'Touche une case pour y poser un fou, touche le fou pour l’ôter.',
    cote: 8, piece: 'fou', combien: 14, but: 'paix', borne: true,
  })

  P.fiche({
    id: 'huit-fous-gardent', moule: 'echiquier', niveau: 3,
    titre: 'Huit fous gardent tout',
    source: 'H. E. Dudeney, Amusements in Mathematics, n° 297 (« Bishops — Unguarded »), 1917',
    recit: [
      'Cette fois, peu importe que les fous se menacent.',
      'Je veux que chaque case de l’échiquier soit occupée, ou sous la menace d’un fou.',
      'Il en faut huit, pas un de moins.',
    ],
    regle: 'Touche une case pour y poser un fou. Les cases gardées se teintent.',
    cote: 8, piece: 'fou', combien: 8, but: 'garde', borne: true,
  })

  P.fiche({
    id: 'huit-reines', moule: 'echiquier', niveau: 4,
    titre: 'Les huit reines',
    source: `${BEZZEL} — repris par H. E. Dudeney, Amusements in Mathematics, n° 300, 1917`,
    recit: [
      'La reine est la pièce la plus forte de l’échiquier : du centre, elle menace vingt-sept cases.',
      'Pourtant, huit reines y tiennent sans qu’aucune n’en menace une autre.',
      'Pose-les.',
    ],
    regle: 'Touche une case pour y poser une reine, touche la reine pour l’ôter.',
    cote: 8, piece: 'reine', combien: 8, but: 'paix',
  })

  P.fiche({
    id: 'cinq-reines-gardent', moule: 'echiquier', niveau: 5,
    titre: 'Cinq reines gardent tout',
    source: 'C. F. de Jaenisch, Traité des applications de l’analyse mathématique au jeu des échecs, 1862 — rappelé par H. E. Dudeney, Amusements in Mathematics, n° 311, 1917',
    recit: [
      'Huit reines tenaient en paix. Combien en faut-il pour tenir tout l’échiquier ?',
      'Cinq suffisent : chaque case est occupée, ou sous la menace d’une reine.',
      'Elles peuvent se menacer entre elles, peu importe. Pose-les.',
    ],
    regle: 'Touche une case pour y poser une reine. Les cases gardées se teintent.',
    cote: 8, piece: 'reine', combien: 5, but: 'garde', borne: true,
  })
}
