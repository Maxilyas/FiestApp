'use strict'
/* Les pièces qui glissent : des pièces dans une boîte, une seule case vide,
   et l'on n'y glisse jamais qu'une voisine. Le taquin fait fureur en 1880 ;
   Sam Loyd s'en attribue la gloire avec son 14-15, qui n'a pas de solution —
   c'est toute l'énigme. Dudeney, en 1917, déménage un piano de la même façon.

   Une fiche donne : `large` (le nombre de colonnes), `cases` (le départ, ligne
   après ligne : la clé de chaque pièce, 0 pour la case vide), `but` (ce que
   chaque case doit porter au bout, null quand peu importe), `objectif` (le but
   en une phrase), `pieces` (clé → signe, nom ; sans elles, les clés sont des
   nombres et s'affichent tels quels), `coince` (le refus, quand « elle » ne
   va pas). Une fiche `impossible` se gagne en le disant, et porte son
   `explication`.

   Le moule tire aussi des taquins de neuf cases, mêlés à partir du rangement :
   il sait donc qu'ils se rangent, et en combien de glissements au plus juste. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.taquin = ['#########', '#.......#', '#.##.##.#', '#.##.##.#', '#.......#', '#.##....#', '#.##....#', '#.......#', '#########']

  P.style(`
.gl { display: grid; gap: 6px; justify-items: center; }
.gl-but { margin: 0; text-align: center; font-size: 12.5px; line-height: 1.35; color: var(--or-clair); }
.gl-boite { width: 100%; display: grid; gap: 5px; }
.gl-case { position: relative; aspect-ratio: 1; min-width: 0; border-radius: 8px; }
.gl-vide { border: 1px dashed rgba(217, 181, 106, 0.28); background: rgba(0, 0, 0, 0.35); box-shadow: inset 0 3px 10px rgba(0, 0, 0, 0.6); }
.gl-piece { padding: 0; display: grid; place-items: center; align-content: center; gap: 4px; border: 1px solid rgba(217, 181, 106, 0.4); background: linear-gradient(180deg, #4a3a2c, var(--pierre)); box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.3); font: 600 1em/1 var(--f-pixel); color: var(--ink); font-variant-numeric: tabular-nums; }
.gl-piece[disabled] { cursor: default; }
.gl-piece.juste { border-color: var(--or); color: var(--or-clair); box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.3), 0 0 10px rgba(var(--sable), 0.3); }
.gl-piece.glisse { animation: gl-glisse 0.16s ease-out 1; }
@keyframes gl-glisse { from { translate: calc(var(--dx) * (100% + 5px)) calc(var(--dy) * (100% + 5px)); } }
.gl-signe { font-size: 40px; line-height: 1; }
.gl-piece small { font: 600 11px/1.1 var(--f-texte); color: var(--muted); }
.gl-piece.juste small { color: var(--or-clair); }
.gl-vise { position: absolute; top: 4px; right: 4px; padding: 2px 4px; border: 1px dashed var(--or); border-radius: 6px; background: rgba(0, 0, 0, 0.4); font-size: 14px; line-height: 1; }
`)

  // Les cases qui touchent chaque case par un côté. Le parcours le redemande à chaque état : on ne le calcule qu'une fois par boîte.
  const BOITES = {}
  const voisines = f => BOITES[f.large + '×' + f.cases.length] || (BOITES[f.large + '×' + f.cases.length] = f.cases.map((_, i) => {
    const x = i % f.large
    return [i - f.large, x > 0 ? i - 1 : -1, x < f.large - 1 ? i + 1 : -1, i + f.large].filter(j => j >= 0 && j < f.cases.length)
  }))

  /* Pourquoi le 14-15 n'a pas de solution, sans le chercher — seize cases font vingt mille milliards de
     rangements, le parcours n'en verrait pas le bout. Un glissement échange une pièce et la case vide : il
     change la parité du rangement (pair ou impair, selon le nombre d'échanges qui le défont), et il déplace la
     case vide d'un pas. Après k glissements, la parité du rangement est donc celle de k, et celle du trajet de
     la case vide aussi. Un but qui demande l'une sans l'autre est hors d'atteinte. */
  function pariteInterdit(f) {
    const ou = f.but.map(v => f.cases.indexOf(v))
    // Un cycle de longueur paire se défait en un nombre impair d'échanges : on compte ceux-là.
    let pairs = 0
    const vu = []
    ou.forEach((_, i) => {
      let long = 0
      for (let k = i; !vu[k]; k = ou[k]) { vu[k] = true; long++ }
      if (long && long % 2 === 0) pairs++
    })
    const a = f.cases.indexOf(0)
    const b = f.but.indexOf(0)
    const trajet = Math.abs(a % f.large - b % f.large) + Math.abs(Math.floor(a / f.large) - Math.floor(b / f.large))
    return pairs % 2 !== trajet % 2
  }

  /* Le taquin de neuf cases : à combien de glissements du rangement est chaque mélange. On l'apprend en
     partant du rangement, une couche à la fois, et pas plus loin que le tirage ne le demande — la boîte
     entière fait 181 440 rangements, les six premières couches une centaine. */
  const RANGE = '123456780'
  const loin = new Map([[RANGE, 0]])
  let bord = [RANGE]
  let fond = 0
  const pousser = (s, i) => { const a = [...s]; a[s.indexOf('0')] = a[i]; a[i] = '0'; return a.join('') }
  let autour = null
  function creuser(jusque) {
    autour = autour || voisines({ large: 3, cases: [...RANGE] })
    while (fond < jusque && bord.length) {
      const suivant = []
      for (const s of bord) {
        for (const i of autour[s.indexOf('0')]) {
          const t = pousser(s, i)
          if (!loin.has(t)) { loin.set(t, fond + 1); suivant.push(t) }
        }
      }
      bord = suivant
      fond++
    }
  }

  const piece = (f, cle) => (f.pieces ? f.pieces[cle] : { signe: String(cle), nom: 'Le ' + cle })

  const moule = P.moule({
    cle: 'glisser',
    nom: 'Les pièces qui glissent',
    socle: 'chemin',
    glyphe: 'taquin',
    unite: ['glissement', 'glissements'],
    // `glisse` ne sert qu'à l'écran — d'où vient la pièce qui vient de bouger — : la boîte seule fait l'état.
    depart: f => ({ g: f.cases.slice(), glisse: null, renonce: false }),
    signature: e => e.g.join(','),
    // « C'est impossible » n'y est pas : le parcours doit dire ce que les glissements permettent, et eux seuls.
    coups: (f, e) => voisines(f)[e.g.indexOf(0)].map(i => ({ glisse: i })),
    jouer(f, e, coup) {
      if (coup.impossible) return f.impossible ? { etat: { ...e, glisse: null, renonce: true } } : { refus: 'Si, c’est possible.' }
      const i = coup.glisse
      const v = e.g.indexOf(0)
      if (!voisines(f)[v].includes(i)) return { refus: f.coince || 'Elle est coincée : seule une voisine de la case vide peut glisser.' }
      const g = e.g.slice()
      g[v] = g[i]
      g[i] = 0
      return { etat: { g, glisse: [i, v], renonce: false } }
    },
    fini: (f, e) => ((f.impossible && e.renonce) || f.but.every((v, i) => v === null || v === e.g[i]) ? { gagne: true } : null),
    // Une fiche impossible se prouve : par le parcours tant qu'il peut tout visiter (neuf cases au plus), par la parité au-delà.
    verifier(f) {
      const petite = f.cases.length <= 9
      if (!f.impossible || petite) {
        const r = P.plusCourt(moule, f)
        if (f.impossible) return r ? { ok: false, note: `elle se résout, en ${r.coups}` } : { ok: true, note: 'impossible, prouvé par le parcours' }
        return r ? { ok: true, coups: r.coups, solution: r.solution } : { ok: false, note: 'aucune solution' }
      }
      if (f.but.includes(null)) return { ok: false, note: 'trop grande pour le parcours, et la parité veut un but complet' }
      return pariteInterdit(f) ? { ok: true, note: 'impossible, prouvé par la parité' } : { ok: false, note: 'la parité ne l’interdit pas' }
    },
    dessiner({ f, e, agir, fige }) {
      const haut = f.cases.length / f.large
      // Le cadre fait 328 sur 340 : sous la phrase du but et le bouton, il reste 262 pixels de haut à la boîte.
      const cote = Math.min((328 - 5 * (f.large - 1)) / f.large, (262 - 5 * (haut - 1)) / haut)
      // Un but partiel ne se devine pas : la case qui attend une pièce la montre dans son coin.
      const partiel = f.but.includes(null)
      const uneCase = (cle, i) => {
        const attendue = partiel && f.but[i] && f.but[i] !== cle ? piece(f, f.but[i]) : null
        const marque = attendue && h('span', { class: 'gl-vise' }, attendue.signe)
        const attend = attendue ? ` Ici doit venir ${attendue.nom.toLowerCase()}.` : ''
        if (!cle) return h('div', { class: 'gl-case gl-vide', role: 'img', 'aria-label': `Case vide, case ${i + 1}.${attend}` }, marque)
        const p = piece(f, cle)
        const juste = f.but[i] === cle
        const vient = e.glisse && e.glisse[1] === i ? e.glisse[0] : null
        return h('button', {
          type: 'button', class: `gl-case gl-piece ${juste ? 'juste' : ''} ${vient !== null ? 'glisse' : ''}`,
          style: vient !== null ? `--dx:${vient % f.large - i % f.large};--dy:${Math.floor(vient / f.large) - Math.floor(i / f.large)}` : null,
          disabled: fige, 'aria-label': `${p.nom}, case ${i + 1}${juste ? ', à sa place' : ''}.${attend}`,
          onclick: () => agir({ glisse: i }),
        }, f.pieces ? [h('span', { class: 'gl-signe' }, p.signe), h('small', null, p.nom)] : p.signe, marque)
      }
      return h('div', { class: 'gl' },
        h('p', { class: 'gl-but' }, f.objectif),
        h('div', { class: 'gl-boite', style: `grid-template-columns:repeat(${f.large},minmax(0,1fr));max-width:${Math.floor(cote * f.large + 5 * (f.large - 1))}px;font-size:${Math.round(cote * 0.42)}px` }, e.g.map(uneCase)),
        h('button', { type: 'button', class: 'lien', disabled: fige, onclick: () => agir({ impossible: true }) }, 'C’est impossible'))
    },
    // On mêle en glissant, à partir du rangement : ce qu'on a défait ainsi se refait toujours, la parité ne peut pas s'y perdre.
    tirer(graine, niveau) {
      const alea = P.alea(graine)
      const voulu = P.entier(alea, ...[[6, 8], [9, 12], [13, 16], [17, 19], [20, 22]][Math.min(4, Math.max(0, niveau - 1))])
      creuser(voulu)
      // La promenade s'arrête dès qu'elle est à `voulu` glissements du rangement, au plus court : elle n'a donc jamais quitté ce qu'on a creusé.
      let s = RANGE
      let avant = -1
      let record = s
      for (let pas = 0; pas < 5000 && loin.get(s) < voulu; pas++) {
        const v = s.indexOf('0')
        // Sans jamais défaire le glissement d'avant : la promenade piétinerait.
        s = pousser(s, P.parmi(alea, autour[v].filter(i => i !== avant)))
        avant = v
        if (loin.get(s) > loin.get(record)) record = s
      }
      const cases = [...record].map(Number)
      const but = [...RANGE].map(Number)
      return {
        id: 'glisser-3-' + record, moule: 'glisser', niveau, tiree: true,
        titre: `Le taquin : ${P.pluriel(cases.filter((c, i) => c && c !== but[i]).length, 'pièce')} à ranger`,
        source: 'Tirée par le programme, sur le modèle du taquin, 1880',
        recit: ['Huit pièces dans une boîte de neuf cases. Je les ai mêlées, en les glissant.', 'Glisse-les à ton tour : de 1 à 8 dans l’ordre, la case vide en dernier.'],
        regle: 'Touche une pièce voisine de la case vide : elle y glisse.',
        large: 3, cases, but, objectif: 'Le but : de 1 à 8, la case vide en dernier.',
      }
    },
  })

  /* ---------------------------------------------------------------- */

  P.fiche({
    id: 'piano-bibliotheque', moule: 'glisser', niveau: 3,
    titre: 'Le piano et la bibliothèque',
    source: 'H. E. Dudeney, Amusements in Mathematics, n° 220, 1917',
    recit: [
      'Six petites chambres sur un palier, et cinq meubles si gros qu’aucune chambre n’en tient deux.',
      'Le locataire exige que le piano et la bibliothèque échangent leurs chambres. Les autres meubles finiront où ils pourront.',
      'Un meuble ne passe que dans la chambre vide d’à côté. Dix-sept déménagements suffisent.',
    ],
    regle: 'Touche un meuble voisin de la chambre vide : il y passe.',
    large: 3,
    cases: ['cabinet', 0, 'piano', 'commode', 'armoire', 'bibliotheque'],
    but: [null, null, 'bibliotheque', null, null, 'piano'],
    objectif: 'Le but : le piano et la bibliothèque échangent leurs chambres.',
    coince: 'Ce meuble est coincé : seul un voisin de la chambre vide peut bouger.',
    pieces: {
      cabinet: { signe: '🗄️', nom: 'Le cabinet' },
      piano: { signe: '🎹', nom: 'Le piano' },
      commode: { signe: '👕', nom: 'La commode' },
      armoire: { signe: '👗', nom: 'L’armoire' },
      bibliotheque: { signe: '📚', nom: 'La bibliothèque' },
    },
  })

  P.fiche({
    id: 'quatorze-quinze', moule: 'glisser', niveau: 4,
    titre: 'Le 14-15',
    source: 'Sam Loyd, vers 1880 — Cyclopedia of Puzzles, 1914',
    recit: [
      'Quinze pièces numérotées dans une boîte de seize cases. Tout est en ordre, sauf les deux dernières : le 15 est passé devant le 14.',
      'Remets-les à leur place en les glissant, sans en sortir une seule de la boîte.',
      'On a promis mille dollars à qui y arriverait.',
    ],
    regle: 'Touche une pièce voisine de la case vide : elle y glisse.',
    large: 4,
    cases: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0],
    but: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0],
    objectif: 'Le but : de 1 à 15, la case vide en dernier.',
    impossible: true,
    explication: [
      'Chaque glissement échange une pièce et la case vide : c’est un échange, un seul.',
      'Pour que la case vide retrouve son coin, il faut autant de glissements vers le haut que vers le bas, autant vers la gauche que vers la droite : toujours un nombre pair d’échanges.',
      'Or entre ce départ et le but, il y a un seul échange, le 14 et le 15 : un nombre impair. Les mille dollars de Sam Loyd n’ont jamais été payés.',
    ],
  })
}
