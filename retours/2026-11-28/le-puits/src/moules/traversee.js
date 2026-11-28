'use strict'
/* Les traversées : mener tout le monde sur l'autre rive, dans une barque trop
   petite, sans jamais laisser ensemble ceux qui ne doivent pas l'être. La plus
   vieille famille d'énigmes qu'on sache dater : Alcuin en pose trois vers l'an
   800. Le pont et sa lanterne se jouent dans le même moule — la lanterne est la
   barque, et chaque passage coûte le temps du plus lent.

   Une fiche donne : `passagers` (cle, signe, nom, marque, teinte, temps),
   `places`, `pilotes` (qui sait mener la barque ; tous, sinon), `danger(groupe)`
   — la phrase du malheur si ce groupe ne peut rester seul, sinon rien —,
   `aBord` (le danger vaut aussi dans la barque), `limite` (des minutes). */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.barque = ['.........', '....#....', '....##...', '....###..', '....#....', '#########', '.#######.', '..#####..', '.........']

  P.style(`
.tr { display: grid; gap: 0; border-radius: 12px; overflow: hidden; border: 1px solid rgba(217, 181, 106, 0.35); }
.tr-rive { min-height: 62px; padding: 6px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px; background: linear-gradient(180deg, #4a3a22, #3a2c1a); }
.tr-rive.arrivee { background: linear-gradient(180deg, #3d4a24, #34401d); }
.tr-rive small { width: 100%; text-align: center; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(243, 236, 226, 0.55); }
.tr-eau { height: 112px; padding: 8px; display: flex; justify-content: center; background: repeating-linear-gradient(180deg, #1f3a52 0 9px, #244463 9px 18px); }
.tr-eau.la-bas { align-items: flex-start; }
.tr-eau.ici { align-items: flex-end; }
.tr-barque { min-width: 150px; min-height: 60px; padding: 4px 10px 6px; display: grid; justify-items: center; gap: 2px; background: linear-gradient(180deg, #8a6436, #5d4222); border: 0; border-radius: 6px 6px 26px 26px; box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3); color: #fff4d6; font: 600 12px var(--f-texte); transition: translate 0.2s ease; }
.tr-barque[disabled] { opacity: 0.6; cursor: default; }
.tr-barque .tr-bord { display: flex; gap: 4px; min-height: 34px; align-items: center; }
.tr-qui { position: relative; width: 44px; height: 46px; padding: 0; display: grid; place-items: center; background: rgba(0, 0, 0, 0.28); border: 2px solid var(--teinte, rgba(243, 236, 226, 0.25)); border-radius: 10px; font-size: 24px; line-height: 1; }
.tr-qui[disabled] { opacity: 0.55; cursor: default; }
.tr-qui b { position: absolute; right: -3px; bottom: -4px; min-width: 16px; padding: 1px 3px; border-radius: 6px; background: var(--teinte, #16100e); color: #16100e; font: 700 9.5px/1.2 var(--f-texte); }
.tr-barque .tr-qui { width: 36px; height: 34px; font-size: 20px; }
`)

  const cotes = (f, e, cote) => f.passagers.filter(p => e.rive[p.cle] === cote && !e.bord.includes(p.cle)).map(p => p.cle)
  const saitMener = (f, groupe) => !f.pilotes || groupe.some(c => f.pilotes.includes(c))
  // Tous les groupes de une à `places` personnes prises sur la rive de la barque.
  function groupes(liste, places) {
    const r = []
    const pousse = (debut, pris) => {
      if (pris.length) r.push(pris)
      if (pris.length === places) return
      for (let i = debut; i < liste.length; i++) pousse(i + 1, [...pris, liste[i]])
    }
    pousse(0, [])
    return r
  }

  const moule = P.moule({
    cle: 'traversee',
    nom: 'Les traversées',
    socle: 'chemin',
    glyphe: 'barque',
    unite: ['traversée', 'traversées'],
    depart: f => ({ rive: Object.fromEntries(f.passagers.map(p => [p.cle, 0])), barque: 0, bord: [], temps: 0 }),
    compte: coup => !coup.embarque,
    jauge: (f, e) => (f.limite ? `${e.temps} min sur ${f.limite}` : null),
    coups(f, e) {
      const ici = f.passagers.filter(p => e.rive[p.cle] === e.barque).map(p => p.cle)
      return groupes(ici, f.places).filter(g => saitMener(f, g) && !(f.aBord && f.danger(g))).map(g => ({ traverse: g }))
    },
    jouer(f, e, coup) {
      if (coup.embarque) {
        const c = coup.embarque
        if (e.bord.includes(c)) return { etat: { ...e, bord: e.bord.filter(x => x !== c) } }
        if (e.rive[c] !== e.barque) return { refus: 'La barque est sur l’autre rive.' }
        if (e.bord.length >= f.places) return { refus: f.places > 1 ? `La barque ne porte que ${f.places} passagers.` : 'La barque ne porte qu’un passager.' }
        return { etat: { ...e, bord: [...e.bord, c] } }
      }
      const qui = coup.traverse || e.bord
      if (!qui.length) return { refus: 'La barque ne part pas seule.' }
      if (!saitMener(f, qui)) return { refus: f.sansPilote || 'Personne à bord ne sait mener la barque.' }
      if (f.aBord && f.danger(qui)) return { refus: f.danger(qui) }
      const rive = { ...e.rive }
      for (const c of qui) rive[c] = 1 - e.barque
      const cout = f.limite ? Math.max(...qui.map(c => f.passagers.find(p => p.cle === c).temps)) : 0
      return { etat: { rive, barque: 1 - e.barque, bord: [], temps: e.temps + cout } }
    },
    fini(f, e) {
      for (const cote of [0, 1]) {
        const malheur = f.danger && f.danger(f.passagers.filter(p => e.rive[p.cle] === cote).map(p => p.cle))
        if (malheur) return { perdu: malheur }
      }
      if (f.limite && e.temps > f.limite) return { perdu: f.tropTard || 'Trop tard.' }
      return f.passagers.every(p => e.rive[p.cle] === 1) ? { gagne: true } : null
    },
    // Un pont se juge à ses minutes : la limite de la fiche doit être le plus court temps, pas une minute de trop.
    verifier(f) {
      const r = P.plusCourt(moule, f)
      if (!r) return { ok: false, note: 'aucune solution' }
      if (f.limite && P.plusCourt(moule, { ...f, limite: f.limite - 1 })) return { ok: false, note: `on fait mieux que ${f.limite} minutes` }
      return { ok: true, coups: r.coups, solution: r.solution, note: f.limite ? `${f.limite} minutes, pas une de moins` : undefined }
    },
    dessiner({ f, e, agir, fige }) {
      const jeton = (p, aBord) => h('button', {
        type: 'button', class: 'tr-qui', style: p.teinte ? `--teinte:${p.teinte}` : null, 'aria-label': p.nom + (aBord ? ', à bord' : ''),
        disabled: fige || (!aBord && e.rive[p.cle] !== e.barque),
        onclick: ev => { ev.stopPropagation(); agir({ embarque: p.cle }) },
      }, p.signe, p.marque && h('b', null, p.marque))
      const rive = cote => h('div', { class: `tr-rive ${cote ? 'arrivee' : ''}` },
        h('small', null, cote ? 'L’autre rive' : 'Le départ'),
        cotes(f, e, cote).map(c => jeton(f.passagers.find(p => p.cle === c), false)))
      const barque = h('button', { type: 'button', class: 'tr-barque', disabled: fige || !e.bord.length, onclick: () => agir({ part: true }) },
        h('span', { class: 'tr-bord' }, e.bord.map(c => jeton(f.passagers.find(p => p.cle === c), true))),
        h('span', null, e.bord.length ? (e.barque ? 'Traverser ↓' : 'Traverser ↑') : `${f.barque || 'La barque'} · ${P.pluriel(f.places, 'place')}`))
      return h('div', { class: 'tr' }, rive(1), h('div', { class: `tr-eau ${e.barque ? 'la-bas' : 'ici'}` }, barque), rive(0))
    },
  })

  /* ---------------------------------------------------------------- */

  P.fiche({
    id: 'loup-chevre-chou', moule: 'traversee', niveau: 1,
    titre: 'Le loup, la chèvre et le chou',
    source: 'Alcuin d’York, Propositions pour aiguiser l’esprit des jeunes, vers l’an 800',
    recit: [
      'Un homme doit passer une rivière avec un loup, une chèvre et un chou.',
      'Sa barque ne porte que lui, et l’un des trois.',
      'Sans lui, le loup mange la chèvre, et la chèvre mange le chou.',
    ],
    regle: 'Touche qui embarque, puis la barque.',
    places: 2, pilotes: ['homme'], sansPilote: 'Seul l’homme sait mener la barque.',
    passagers: [
      { cle: 'homme', signe: '👨‍🌾', nom: 'L’homme' },
      { cle: 'loup', signe: '🐺', nom: 'Le loup' },
      { cle: 'chevre', signe: '🐐', nom: 'La chèvre' },
      { cle: 'chou', signe: '🥬', nom: 'Le chou' },
    ],
    danger: g => (g.includes('homme') ? null : g.includes('loup') && g.includes('chevre') ? 'Le loup a mangé la chèvre.' : g.includes('chevre') && g.includes('chou') ? 'La chèvre a mangé le chou.' : null),
  })

  P.fiche({
    id: 'missionnaires', moule: 'traversee', niveau: 3,
    titre: 'Les trois ogres et les trois moines',
    source: 'Tradition, fin du XIXe siècle : « les missionnaires et les cannibales »',
    recit: [
      'Trois moines et trois ogres arrivent ensemble au bord du fleuve.',
      'La barque porte deux passagers, et n’importe lequel sait la mener.',
      'Mais sur une rive, que les ogres soient plus nombreux que les moines… et ils les dévorent.',
    ],
    regle: 'Jamais plus d’ogres que de moines sur une rive où il reste un moine.',
    places: 2,
    passagers: [
      ...[1, 2, 3].map(i => ({ cle: 'm' + i, signe: '🧔', nom: 'Un moine', teinte: '#f3dea6' })),
      ...[1, 2, 3].map(i => ({ cle: 'o' + i, signe: '👹', nom: 'Un ogre', teinte: '#e06c6c' })),
    ],
    // Les moines se valent, les ogres aussi : sans cela, le parcours visiterait les mêmes rives sous tous leurs noms.
    danger: g => {
      const moines = g.filter(c => c[0] === 'm').length
      return moines && g.length - moines > moines ? 'Les ogres étaient plus nombreux : ils ont dévoré les moines.' : null
    },
  })

  // Des couples jaloux : chacun sa lettre et sa couleur, pour qu'on voie d'un coup d'œil qui est à qui.
  const TEINTES = { A: '#f3dea6', B: '#6f97c4', C: '#e06c6c', D: '#8fc48a', E: '#c79ad6' }
  const couples = lettres => ({
    passagers: [...lettres].flatMap(l => [
      { cle: 'mari' + l, signe: '🤴', nom: 'Le mari ' + l, marque: l, teinte: TEINTES[l] },
      { cle: 'femme' + l, signe: '👸', nom: 'L’épouse ' + l, marque: l.toLowerCase(), teinte: TEINTES[l] },
    ]),
    danger: g => {
      for (const l of lettres) {
        if (g.includes('femme' + l) && !g.includes('mari' + l) && g.some(c => c.startsWith('mari'))) return `Le mari ${l} est jaloux : sa femme est restée avec un autre.`
      }
      return null
    },
  })
  P.fiche({
    id: 'couples-jaloux', moule: 'traversee', niveau: 4,
    titre: 'Les trois maris jaloux',
    source: 'Bachet de Méziriac, Problèmes plaisants et délectables, 1612 — d’après Alcuin d’York',
    recit: [
      'Trois maris jaloux et leurs trois épouses doivent passer la rivière.',
      'La barque ne porte que deux personnes, et chacun sait la mener.',
      'Aucun mari ne souffre que sa femme reste avec un autre homme s’il n’est pas là, sur une rive comme dans la barque.',
    ],
    regle: 'Une épouse ne reste jamais avec un autre mari sans le sien.',
    places: 2, aBord: true, ...couples('ABC'),
  })
  // Dudeney donne onze traversées : le parcours les retrouve.
  P.fiche({
    id: 'dudeney-375', moule: 'traversee', niveau: 5,
    titre: 'Les cinq maris jaloux',
    source: 'H. E. Dudeney, Amusements in Mathematics, n° 375, 1917',
    recit: [
      'Une crue. Cinq couples cernés par l’eau, et une barque qui porte trois personnes.',
      'Chaque mari est si jaloux qu’il ne souffre pas sa femme auprès d’un autre homme, dans la barque ou sur une rive, s’il n’y est pas lui-même.',
      'Mène-les tous au sec, au plus vite.',
    ],
    regle: 'Trois dans la barque. Une épouse ne reste jamais avec un autre mari sans le sien.',
    places: 3, aBord: true, ...couples('ABCDE'),
  })

  P.fiche({
    id: 'pont-lanterne', moule: 'traversee', niveau: 3,
    titre: 'Le pont et la lanterne',
    source: 'Tradition, XXe siècle',
    recit: [
      'Quatre voyageurs, la nuit, devant un pont de cordes qui ne porte que deux personnes.',
      'Ils n’ont qu’une lanterne, et nul ne passe sans elle : il faut la ramener.',
      'Chacun marche à son pas — une, trois, six et huit minutes —, et deux ensemble vont au pas du plus lent.',
      'Le pont cède dans dix-huit minutes.',
    ],
    regle: 'Deux au plus sur le pont, toujours avec la lanterne.',
    places: 2, limite: 18, barque: 'La lanterne', tropTard: 'Dix-huit minutes ont passé : le pont a cédé.',
    passagers: [
      { cle: 'vif', signe: '🏃', nom: 'Le plus vif, une minute', marque: '1', temps: 1, teinte: '#f3dea6' },
      { cle: 'pose', signe: '🚶', nom: 'Le posé, trois minutes', marque: '3', temps: 3, teinte: '#f3dea6' },
      { cle: 'lent', signe: '🧓', nom: 'Le lent, six minutes', marque: '6', temps: 6, teinte: '#f3dea6' },
      { cle: 'boiteux', signe: '🧙', nom: 'Le plus lent, huit minutes', marque: '8', temps: 8, teinte: '#f3dea6' },
    ],
  })
}
