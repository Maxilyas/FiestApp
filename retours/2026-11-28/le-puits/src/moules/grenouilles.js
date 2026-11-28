'use strict'
/* Les grenouilles : deux camps sur une rangée de pierres, une seule pierre
   libre, et il faut que les camps échangent leurs places. Lucas le raconte en
   1883 : chacune n'avance que vers l'autre bord, d'un pas ou d'un saut
   par-dessus une adversaire — et l'on se bloque au premier coup de travers.
   Dudeney, en 1917, lâche la bride (on recule, on saute deux grenouilles, de
   n'importe quelle couleur) mais compte les sauts : dix, pas un de plus.

   Une fiche donne : `rang`, le départ — « > » une blanche, qui part de la
   gauche, « < » une noire, « _ » la pierre libre —, `but`, le rang à
   atteindre, et la règle : celle de Lucas, sinon `libre` (dans les deux sens,
   par-dessus n'importe qui) et `bond` (combien de grenouilles un saut enjambe
   au plus). `limite` compte les sauts permis, `tropTard` dit ce qui arrive
   au-delà ; `verres` pose les grenouilles sur des verres retournés. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.grenouille = ['.........', '.##...##.', '####.####', '#.#####.#', '#########', '##.....##', '.#######.', '###...###', '##.....##']

  // L'eau et le tapis sont à mi-teinte exprès : une grenouille blanche et une noire s'y lisent aussi bien l'une que l'autre.
  P.style(`
.gr { display: grid; gap: 10px; }
.gr-but, .gr-sauts { margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12.5px; color: var(--or-clair); }
.gr-sauts { color: var(--muted); }
.gr-mini { display: inline-flex; gap: 3px; padding: 4px 5px; border-radius: 6px; background: #3b7887; }
.gr-mini.table { background: #4d8a5a; }
.gr-mini i { width: 11px; height: 11px; border-radius: 3px; }
.gr-mini i.blanche { background: #fff4d6; }
.gr-mini i.noire { background: #0d0908; }
.gr-mini i.libre { border: 1px dashed rgba(255, 255, 255, 0.6); }
.gr-mare { display: grid; padding: 22px 6px 14px; border-radius: 12px; border: 1px solid rgba(217, 181, 106, 0.35); background: linear-gradient(180deg, #3b7887, #448696); }
.gr-mare.table { background: linear-gradient(180deg, #4d8a5a, #437a50); }
.gr-pierre { position: relative; min-height: 76px; padding: 0; display: grid; align-content: end; justify-items: center; background: none; border: 0; }
.gr-pierre[disabled] { cursor: default; }
.gr-bete { width: 100%; display: grid; place-items: center; margin-bottom: -2px; z-index: 1; }
.gr-socle { width: calc(100% - 6px); height: 18px; border-radius: 50%; background: linear-gradient(180deg, #d8cfbd, #9c917d); box-shadow: 0 3px 0 rgba(0, 0, 0, 0.25); font: normal 700 15px/16px var(--f-texte); text-align: center; color: #4a4136; }
.table .gr-socle { height: 30px; border-radius: 0; clip-path: polygon(14% 0, 86% 0, 100% 100%, 0 100%); background: linear-gradient(180deg, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.3)); box-shadow: none; }
.gr-pierre.blanche .gr-bete { color: #fff4d6; }
.gr-pierre.noire .gr-bete { color: #0d0908; }
.gr-pierre.saute .gr-bete { animation: gr-saut 0.3s ease-out 1; }
@keyframes gr-saut { from { translate: calc(var(--d) * 100%) 0; } 50% { translate: calc(var(--d) * 50%) -18px; } }
`)

  const CAMPS = { '>': ['blanche', 'Grenouille blanche'], '<': ['noire', 'Grenouille noire'] }
  const sens = c => (c === '>' ? 1 : -1)

  // Ce qui retient la grenouille de la pierre i d'aller à la pierre libre : rien, si elle le peut.
  // Une seule pierre libre : la grenouille touchée n'a jamais qu'une destination, on ne la lui demande pas.
  function retient(f, p, i) {
    const c = p[i]
    const d = p.indexOf('_') - i
    const libre = f.verres ? 'Le verre libre' : 'La pierre libre'
    if (f.libre) return Math.abs(d) <= (f.bond || 1) + 1 ? null : `${libre} est trop loin : elle saute par-dessus ${P.pluriel(f.bond || 1, 'grenouille')} au plus.`
    if (d * sens(c) < 0) return 'Elle ne recule jamais : elle va vers l’autre bord.'
    if (Math.abs(d) > 2) return `${libre} est trop loin : un pas, ou un saut par-dessus une seule grenouille.`
    return Math.abs(d) === 2 && p[i + sens(c)] === c ? 'Elle ne saute pas par-dessus une des siennes.' : null
  }

  const moule = P.moule({
    cle: 'grenouilles',
    nom: 'Les grenouilles',
    socle: 'chemin',
    glyphe: 'grenouille',
    unite: ['saut', 'sauts'],
    // `saut` ne sert qu'à l'écran — d'où arrive celle qui vient de sauter — : le rang seul fait l'état.
    depart: f => ({ p: f.rang, n: 0, saut: null }),
    signature: e => e.p,
    coups: (f, e) => [...e.p].flatMap((c, i) => (c !== '_' && !retient(f, e.p, i) ? [{ saute: i }] : [])),
    jouer(f, e, coup) {
      const i = coup.saute
      if (!CAMPS[e.p[i]]) return { refus: 'Il n’y a pas de grenouille là.' }
      const non = retient(f, e.p, i)
      if (non) return { refus: non }
      const v = e.p.indexOf('_')
      const p = [...e.p]
      p[v] = p[i]
      p[i] = '_'
      return { etat: { p: p.join(''), n: e.n + 1, saut: [i, v] } }
    },
    fini(f, e) {
      if (e.p === f.but) return { gagne: true }
      if (f.limite && e.n >= f.limite) return { perdu: f.tropTard || 'Plus un saut. Elles retournent à leur place.' }
      // Chez Lucas, nulle ne recule : un coup de travers et plus rien ne bouge.
      return moule.coups(f, e).length ? null : { perdu: 'Plus une grenouille ne peut bouger. Elles retournent à leur place.' }
    },
    // Une limite doit être le plus petit nombre de sauts : sinon la fiche promet un exploit qui n'en est pas un.
    verifier(f) {
      const r = P.plusCourt(moule, f)
      if (!r) return { ok: false, note: 'aucune solution' }
      if (f.limite && r.coups < f.limite) return { ok: false, note: `on fait mieux que ${f.limite} sauts` }
      return { ok: true, coups: r.coups, solution: r.solution, note: f.limite ? `${f.limite} sauts, pas un de moins` : undefined }
    },
    dessiner({ f, e, agir, fige }) {
      const n = e.p.length
      // Neuf pierres se partagent 316 pixels : la grenouille rétrécit avant de mordre sur sa voisine.
      const taille = Math.min(44, Math.floor(316 / n) - 6)
      const pierre = (c, i) => {
        if (c === '_') return h('div', { class: 'gr-pierre' }, h('i', { class: 'gr-socle' }))
        const arrive = e.saut && e.saut[1] === i
        return h('button', {
          type: 'button', class: `gr-pierre ${CAMPS[c][0]} ${arrive ? 'saute' : ''}`, style: arrive ? `--d:${e.saut[0] - i}` : null,
          disabled: fige, 'aria-label': `${CAMPS[c][1]}, ${f.verres ? 'verre' : 'pierre'} ${i + 1} sur ${n}`,
          onclick: () => agir({ saute: i }),
        },
        h('span', { class: 'gr-bete', html: P.glyphe('grenouille', taille) }),
        // De face, une grenouille ne dit pas où elle va : chez Lucas, où nulle ne recule, sa pierre le dit pour elle.
        h('i', { class: 'gr-socle' }, !f.libre && (c === '>' ? '›' : '‹')))
      }
      const camp = c => (CAMPS[c] ? CAMPS[c][0] : 'libre')
      return h('div', { class: 'gr' },
        h('p', { class: 'gr-but' }, 'Le but :',
          h('span', { class: `gr-mini ${f.verres ? 'table' : ''}`, role: 'img', 'aria-label': [...f.but].map(camp).join(', ') }, [...f.but].map(c => h('i', { class: camp(c) })))),
        h('div', { class: `gr-mare ${f.verres ? 'table' : ''}`, style: `grid-template-columns:repeat(${n},minmax(0,1fr))` }, [...e.p].map(pierre)),
        f.limite && h('p', { class: 'gr-sauts' }, `${e.n} sur ${P.pluriel(f.limite, 'saut')}`,
          h('span', { class: 'points' }, Array.from({ length: f.limite }, (_, k) => h('i', { class: k < e.n ? 'plein' : '' })))))
    },
  })

  /* ---------------------------------------------------------------- */

  const NOMBRES = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf']
  const majuscule = s => s[0].toUpperCase() + s.slice(1)
  const lucas = (n, niveau) => P.fiche({
    id: 'grenouilles-' + n, moule: 'grenouilles', niveau,
    titre: `Les ${NOMBRES[2 * n]} grenouilles`,
    source: 'Édouard Lucas, Récréations mathématiques, tome II, 1883 : « le jeu des grenouilles »',
    recit: [
      `${majuscule(NOMBRES[2 * n + 1])} pierres en travers de la mare. ${majuscule(NOMBRES[n])} grenouilles blanches à gauche, ${NOMBRES[n]} noires à droite, une pierre libre entre elles.`,
      'Chacune n’avance que vers l’autre bord : d’un pas sur la pierre libre, ou d’un saut par-dessus une seule grenouille de l’autre couleur.',
      'Fais passer les blanches à droite et les noires à gauche. Prends garde : aucune ne recule.',
    ],
    regle: 'Touche une grenouille : elle avance d’un pas, ou saute une grenouille de l’autre couleur.',
    rang: '>'.repeat(n) + '_' + '<'.repeat(n), but: '<'.repeat(n) + '_' + '>'.repeat(n),
  })
  lucas(2, 1)
  lucas(3, 2)
  lucas(4, 3)

  P.fiche({
    id: 'grenouilles-savantes', moule: 'grenouilles', niveau: 4,
    titre: 'Les grenouilles savantes',
    source: 'H. E. Dudeney, Amusements in Mathematics, n° 216, 1917',
    recit: [
      'Sept verres retournés, en rang. Le premier est libre ; puis trois grenouilles blanches, puis trois noires.',
      'Une grenouille passe sur le verre voisin, ou saute par-dessus une ou deux autres, de n’importe quelle couleur, dans un sens comme dans l’autre.',
      'Fais-les changer de côté : les noires à gauche, les blanches à droite, le dernier verre libre. Tu as dix sauts.',
    ],
    regle: 'Touche une grenouille : elle va au verre libre, s’il est à trois verres au plus. Dix sauts.',
    rang: '_>>><<<', but: '<<<>>>_', libre: true, bond: 2, verres: true,
    limite: 10, tropTard: 'Dix sauts, et elles n’y sont pas. Elles retournent à leur verre.',
  })
}
