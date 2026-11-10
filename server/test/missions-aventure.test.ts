// L'aventure du jour (le 10 novembre 2026). Un retour — les missions du jour,
// « moins intéressant qu'avant » —, et le propriétaire : « plus mettre en
// avant les sentiers et le cabinet des curiosités, tout en ayant de la
// diversité ». Deux missions sur trois étaient les mêmes chaque jour, et les
// sentiers et le Cabinet n'étaient que deux découvertes sur huit : un jour sur
// sept chacun, un sur seize pour qui les jouait déjà. Depuis, la deuxième
// mission est une aventure — un jour les sentiers, le lendemain le Cabinet,
// sous un objectif qui change —, la troisième un savoir ou la découverte d'un
// autre mode, et une mission de catégorie mène au sentier de sa catégorie.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { BRANCHES } from '../../shared/branches'
import {
  activiteDesJours,
  AUCUNE_ACTIVITE,
  avancement,
  DECOUVERTES,
  EPREUVES_AU_CABINET,
  JUSTES_SUR_LES_SENTIERS,
  lireLaMission,
  MANCHES_AU_CABINET,
  modeDeLAventure,
  PART_DU_SAVOIR,
  tirerLesMissions,
  vueDeLaMission,
  type ContexteDuTirage,
  type Mission,
} from '../../shared/missions'

/** Tout se propose : le Cabinet ouvert, quelqu'un à défier, un thème pour le faire. */
const TOUT: ContexteDuTirage = {
  decouvertesJouees: new Set(),
  defiFini: false,
  aRevoir: 6,
  hier: [],
  avantHier: [],
  cabinet: true,
  adversaires: true,
  themes: [{ cle: 'animaux', nom: 'Les animaux' }],
}

const tirages = (c: Partial<ContexteDuTirage>, n = 1200) => Array.from({ length: n }, (_, i) => tirerLesMissions(`p${i}|2026-11-10`, { ...TOUT, ...c }))

/** L'objectif d'une aventure, tel qu'il se lit : sa sorte, sa catégorie ou non, sa cible. */
const objectif = (m: Mission) => `${m.sorte}${m.categorie ? ' en catégorie' : ''} × ${m.cible}`

const SIX_OBJECTIFS = [
  'sentier × 1',
  'sentier en catégorie × 1',
  `sentier-justes × ${JUSTES_SUR_LES_SENTIERS}`,
  'cabinet × 1',
  `cabinet × ${EPREUVES_AU_CABINET}`,
  `cabinet-justes × ${MANCHES_AU_CABINET}`,
]

/** Des jours de suite pour un même joueur, qui ouvre ses missions chaque jour : celles d'hier et d'avant-hier passent au tirage. */
function joursDeSuite(profil: string, jours: number, c: Partial<ContexteDuTirage> = {}): Mission[][] {
  const tirees: Mission[][] = []
  for (let j = 0; j < jours; j++) tirees.push(tirerLesMissions(`${profil}|jour-${j}`, { ...TOUT, ...c, hier: tirees[j - 1] ?? [], avantHier: tirees[j - 2] ?? [] }))
  return tirees
}

// ── Le tirage, pur ─────────────────────────────────────────────────────────

test('chaque jour une aventure, sa deuxième mission : les sentiers ou le Cabinet, sous six objectifs', () => {
  const toutes = tirages({})
  for (const m of toutes) {
    assert.deepEqual(m[0], { sorte: 'jour', cible: 1 })
    assert.ok(modeDeLAventure(m[1]), `une aventure au rang 1 : ${JSON.stringify(m[1])}`)
    assert.equal(modeDeLAventure(m[2]), null, `une seule aventure par jour : ${JSON.stringify(m[2])}`)
    // Ce qu'elle porte se relit tel quel : rien ne se perd entre le tirage et la base.
    assert.deepEqual(lireLaMission(JSON.parse(JSON.stringify(m[1]))), m[1])
  }
  const aventures = toutes.map(m => m[1])
  assert.deepEqual([...new Set(aventures.map(objectif))].sort(), [...SIX_OBJECTIFS].sort())
  // Sans aventure hier — son premier jour, ou un jour manqué — : l'un ou l'autre mode, à parts égales.
  const auCabinet = aventures.filter(m => modeDeLAventure(m) === 'cabinet').length / aventures.length
  assert.ok(Math.abs(auCabinet - 0.5) < 0.05, `le Cabinet ${Math.round(auCabinet * 100)} % des jours`)
  // Chaque objectif sort, aucun n'écrase les autres.
  for (const o of SIX_OBJECTIFS) {
    const part = aventures.filter(m => objectif(m) === o).length / aventures.length
    assert.ok(part > 0.12 && part < 0.21, `${o} : ${Math.round(part * 100)} % des jours`)
  }
  // Le sentier d'une catégorie : chacune a le sien, et chacune sort.
  const categories = new Set(aventures.filter(m => m.sorte === 'sentier' && m.categorie).map(m => m.categorie))
  assert.deepEqual([...categories].sort(), [...CATEGORIES].sort())
})

test('un jour les sentiers, le lendemain le Cabinet — et le même objectif ne revient pas d’une fois à l’autre', () => {
  const vus = new Set<string>()
  for (let p = 0; p < 60; p++) {
    const jours = joursDeSuite(`profil-${p}`, 28).map(m => m[1])
    for (let j = 1; j < jours.length; j++) assert.notEqual(modeDeLAventure(jours[j]), modeDeLAventure(jours[j - 1]), `profil ${p}, jour ${j} : ${objectif(jours[j - 1])} puis ${objectif(jours[j])}`)
    // Le même mode revient tous les deux jours : jamais sous l'objectif de la fois d'avant.
    for (let j = 2; j < jours.length; j++) assert.notEqual(objectif(jours[j]), objectif(jours[j - 2]), `profil ${p}, jour ${j} : deux fois ${objectif(jours[j])}`)
    // En deux semaines, quatre objectifs différents au moins — la règle seule le garantit.
    assert.ok(new Set(jours.slice(0, 14).map(objectif)).size >= 4, `profil ${p}`)
    for (const m of jours) vus.add(objectif(m))
  }
  assert.equal(vus.size, SIX_OBJECTIFS.length)
  // Une épreuve ou le Cabinet tirés en découverte, la veille de la mise en ligne (au rang 2) : le lendemain alterne déjà.
  const dAvant = (decouverte: Mission): Mission[] => [{ sorte: 'jour', cible: 1 }, { sorte: 'justes', cible: 10 }, decouverte]
  assert.ok(tirages({ hier: dAvant({ sorte: 'cabinet', cible: 1 }) }).every(m => modeDeLAventure(m[1]) === 'sentier'))
  assert.ok(tirages({ hier: dAvant({ sorte: 'sentier', cible: 1, categorie: 'Histoire' }) }).every(m => modeDeLAventure(m[1]) === 'cabinet'))
  // Un jour manqué : l'un ou l'autre mode, mais pas l'objectif d'avant-hier.
  const apresUnJourManque = tirages({ avantHier: [{ sorte: 'jour', cible: 1 }, { sorte: 'sentier-justes', cible: JUSTES_SUR_LES_SENTIERS }, { sorte: 'duel', cible: 1 }] }).map(m => m[1])
  assert.ok(apresUnJourManque.some(m => modeDeLAventure(m) === 'sentier') && apresUnJourManque.some(m => modeDeLAventure(m) === 'cabinet'))
  assert.ok(apresUnJourManque.every(m => m.sorte !== 'sentier-justes'))
})

test('le Cabinet fermé ici, en maintenance ou bientôt disponible : les sentiers chaque jour, sous un objectif qui change', () => {
  // Une mission doit pouvoir se faire le jour même : sans Cabinet, jamais sa mission.
  assert.ok(tirages({ cabinet: false }).every(m => modeDeLAventure(m[1]) === 'sentier'))
  assert.ok(tirages({ cabinet: false, hier: [{ sorte: 'jour', cible: 1 }, { sorte: 'sentier', cible: 1 }, { sorte: 'duel', cible: 1 }] }).every(m => modeDeLAventure(m[1]) === 'sentier'))
  for (let p = 0; p < 30; p++) {
    const jours = joursDeSuite(`profil-${p}`, 14, { cabinet: false }).map(m => m[1])
    for (let j = 1; j < jours.length; j++) assert.notEqual(objectif(jours[j]), objectif(jours[j - 1]), `profil ${p}, jour ${j} : deux fois ${objectif(jours[j])}`)
  }
})

test('la troisième mission : deux jours sur cinq un savoir, sinon la découverte d’un autre mode — jamais celle d’hier', () => {
  const troisiemes = tirages({}, 6000)
  const savoirs = troisiemes.filter(m => m[2].sorte === 'justes' || m[2].sorte === 'categorie')
  const part = savoirs.length / troisiemes.length
  assert.ok(Math.abs(part - PART_DU_SAVOIR) < 0.03, `un savoir ${Math.round(part * 100)} % des jours`)
  for (const m of troisiemes) assert.ok(['justes', 'categorie', ...DECOUVERTES].includes(m[2].sorte), m[2].sorte)
  // Chaque découverte sort, la révision et le duel à lancer compris : il a un carnet et quelqu'un à défier.
  assert.deepEqual([...new Set(troisiemes.map(m => m[2].sorte).filter(s => DECOUVERTES.includes(s)))].sort(), [...DECOUVERTES].sort())
  // Une aventure qui compte déjà ses bonnes réponses ne se double pas de « bonnes réponses où tu veux » : une catégorie.
  const quiComptent = savoirs.filter(m => m[1].sorte === 'sentier-justes' || m[1].sorte === 'cabinet-justes')
  assert.ok(quiComptent.length > 100, `${quiComptent.length} jours`)
  assert.ok(quiComptent.every(m => m[2].sorte === 'categorie'))
  // Les deux savoirs sortent : des bonnes réponses où il veut un peu plus d'une fois sur trois, une catégorie le reste.
  const ouIlVeut = savoirs.filter(m => m[2].sorte === 'justes').length / savoirs.length
  assert.ok(ouIlVeut > 0.25 && ouIlVeut < 0.5, `des bonnes réponses où il veut ${Math.round(ouIlVeut * 100)} % des savoirs`)
  // Pas le savoir d'hier, pas la découverte d'hier.
  const hier = (troisieme: Mission): Mission[] => [{ sorte: 'jour', cible: 1 }, { sorte: 'cabinet', cible: 1 }, troisieme]
  assert.ok(tirages({ hier: hier({ sorte: 'justes', cible: 15 }) }).every(m => m[2].sorte !== 'justes'))
  assert.ok(
    tirages({ hier: hier({ sorte: 'categorie', cible: 5, categorie: 'Sport' }) })
      .filter(m => m[1].sorte !== 'sentier-justes')
      .every(m => m[2].sorte !== 'categorie'),
  )
  for (const s of DECOUVERTES) assert.ok(tirages({ hier: hier({ sorte: s, cible: 1 }) }).every(m => m[2].sorte !== s), s)
})

// ── Ce qu'elles lisent de la journée ───────────────────────────────────────

test('ce que les aventures lisent de sa journée : ses bonnes réponses sur les sentiers, ses épreuves et ses manches réussies au Cabinet', () => {
  const jour = '2026-11-10'
  const midi = Date.UTC(2026, 10, 10, 11)
  const reponse = (serie: string, mode: string, juste: boolean, i = 0) => ({ serie, mode, juste, le: midi + i, categorie: mode === 'cabinet' ? null : 'Histoire' })
  const a = activiteDesJours({
    jour: [],
    jourParCategorie: [],
    soirees: [],
    series: [],
    reponses: [
      // Une épreuve en jeu, pas finie : quatre bonnes réponses sur six.
      ...Array.from({ length: 6 }, (_, i) => reponse('e1', 'sentier', i < 4, i)),
      // Un rejeu, sur un autre sentier : trois de plus.
      ...Array.from({ length: 3 }, (_, i) => reponse('e2', 'sentier', true, 10 + i)),
      // Une série : ses bonnes réponses ne sont pas des sentiers.
      ...Array.from({ length: 5 }, (_, i) => reponse('s1', 'serie', true, 20 + i)),
      // Deux épreuves du Cabinet : trois manches à deux étoiles ou plus sur cinq jouées.
      ...[true, false, true].map((juste, i) => reponse('c1', 'cabinet', juste, 30 + i)),
      ...[false, true].map((juste, i) => reponse('c2', 'cabinet', juste, 40 + i)),
    ],
  }).get(jour)!
  assert.deepEqual([a.justesAuxSentiers, a.justesAuCabinet, a.cabinet, a.justes], [7, 3, 2, 15])
  assert.equal(avancement({ sorte: 'sentier-justes', cible: JUSTES_SUR_LES_SENTIERS }, a), 7, 'en jeu ou en rejeu, validée ou non — pas la série')
  assert.equal(avancement({ sorte: 'sentier-justes', cible: 5 }, a), 5, 'jamais au-delà de sa cible')
  assert.equal(avancement({ sorte: 'cabinet-justes', cible: MANCHES_AU_CABINET }, a), 3)
  assert.equal(avancement({ sorte: 'cabinet', cible: EPREUVES_AU_CABINET }, a), 2, 'deux épreuves, chacune une fois')
  assert.equal(avancement({ sorte: 'cabinet', cible: 3 }, a), 2)
  for (const sorte of ['sentier-justes', 'cabinet-justes'] as const) assert.equal(avancement({ sorte, cible: 3 }, AUCUNE_ACTIVITE), 0)
})

test('ce que la page en dit : chaque aventure, son titre, son aide, où la faire — et le savoir mène aux sentiers', () => {
  const vue = (m: Mission) => vueDeLaMission(1, m, AUCUNE_ACTIVITE, false)
  const aventures: [Mission, string, { href: string; libelle: string }][] = [
    [{ sorte: 'sentier', cible: 1 }, 'Tente une épreuve sur le sentier de ton choix', { href: '/campagne#sentiers', libelle: 'Les sentiers' }],
    [{ sorte: 'sentier', cible: 1, categorie: 'Histoire' }, 'Tente une épreuve en Histoire', { href: '/campagne#sentier-mythes', libelle: 'Le sentier' }],
    [{ sorte: 'sentier-justes', cible: 10 }, 'Trouve 10 bonnes réponses sur les sentiers', { href: '/campagne#sentiers', libelle: 'Les sentiers' }],
    [{ sorte: 'cabinet', cible: 1 }, 'Joue une épreuve au Cabinet de curiosités', { href: '/cabinet', libelle: 'Le Cabinet' }],
    [{ sorte: 'cabinet', cible: 2 }, 'Joue 2 épreuves au Cabinet de curiosités', { href: '/cabinet', libelle: 'Le Cabinet' }],
    // Une espace insécable après le « 2 » : il finissait la ligne, seul, au téléphone.
    [{ sorte: 'cabinet-justes', cible: 3 }, 'Au Cabinet, réussis 3 manches à 2 étoiles ou plus', { href: '/cabinet', libelle: 'Le Cabinet' }],
  ]
  const aides = new Set<string>()
  for (const [m, titre, lien] of aventures) {
    const v = vue(m)
    assert.deepEqual([v.famille, v.titre, v.lien, v.cible], ['aventure', titre, lien, m.cible])
    assert.ok(v.aide.length > 20, titre)
    aides.add(v.aide)
  }
  assert.equal(aides.size, aventures.length, 'chacune dit comment elle se fait')
  // Une mission se fait en jouant, jamais d'un coup de dés : aucune ne demande de valider ni de gagner.
  assert.match(vue({ sorte: 'sentier', cible: 1 }).aide, /validée ou non/)
  assert.match(vue({ sorte: 'sentier-justes', cible: 10 }).aide, /validées ou non/)
  assert.match(vue({ sorte: 'cabinet', cible: 2 }).aide, /gagnées ou non/)
  // Deux étoiles ou plus, c'est la bonne réponse que garde le journal du Cabinet — au Pari, chaque bonne réponse : l'aide le dit.
  assert.match(vue({ sorte: 'cabinet-justes', cible: 3 }).aide, /Au Pari, chaque bonne réponse compte/)

  // Le savoir : une catégorie ouvre son sentier — elle ouvrait une série —, et l'aide le nomme d'abord.
  for (const b of BRANCHES) {
    const v = vue({ sorte: 'categorie', cible: 5, categorie: b.categorie })
    assert.deepEqual([v.famille, v.lien], ['savoir', { href: `/campagne#sentier-${b.key}`, libelle: 'Le sentier' }], b.categorie)
    assert.ok(v.aide.startsWith(`Sur « ${b.nom} », son sentier`), v.aide)
  }
  // Des bonnes réponses où il veut : les sentiers et le Cabinet comptaient déjà, l'aide ne les nommait pas.
  const justes = vue({ sorte: 'justes', cible: 15 })
  assert.match(justes.aide, /sur un sentier, au Cabinet/)
  assert.deepEqual([justes.famille, justes.lien], ['savoir', { href: '/campagne', libelle: 'Jouer une série' }])
  assert.equal(vue({ sorte: 'duel', cible: 1 }).famille, 'decouverte')
})

// ── Pour de vrai, par les routes ───────────────────────────────────────────

/** Le jeudi 15 octobre 2026, à 10 h à Paris. */
const JEUDI = Date.UTC(2026, 9, 15, 8)

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

test('dix bonnes réponses sur les sentiers : comptées une à une, l’épreuve pas même finie — et cinq en Histoire, sur son sentier', async () => {
  const banc = await demarrer({ horlogeDuJour: () => JEUDI, baseDeLaCampagne: baseDEssai(32, { categories: ['Histoire', 'Nature'] }) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const profil = (await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.id as string
    // Ses missions du jour, posées d'avance — le tirage dépend de son identifiant.
    const missions: Mission[] = [
      { sorte: 'jour', cible: 1 },
      { sorte: 'sentier-justes', cible: JUSTES_SUR_LES_SENTIERS },
      { sorte: 'categorie', cible: 5, categorie: 'Histoire' },
    ]
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const inserer = db.prepare('INSERT INTO profile_missions (profile_id, jour, rang, mission, tiree_le) VALUES (?, ?, ?, ?, ?)')
      missions.forEach((m, rang) => inserer.run(profil, '2026-10-15', rang, JSON.stringify(m), JEUDI))
      inserer.run(profil, '2026-10-15', 3, '{}', JEUDI)
    } finally {
      db.close()
    }
    const lues = async () => {
      const m = (await lire(banc, lea, '/api/joueur/missions')).corps
      return { nouvelles: m.nouvelles as number[], missions: m.missions as { rang: number; famille: string; titre: string; avance: number; faite: boolean; lien: { href: string; libelle: string } }[] }
    }
    const avant = await lues()
    assert.deepEqual(
      avant.missions.map(m => [m.famille, m.titre, m.avance, m.lien.href]),
      [
        ['habitude', 'Joue le quiz du jour', 0, '/jour'],
        ['aventure', 'Trouve 10 bonnes réponses sur les sentiers', 0, '/campagne#sentiers'],
        ['savoir', 'Trouve 5 bonnes réponses en Histoire', 0, '/campagne#sentier-mythes'],
      ],
    )
    // Les mythologies, le sentier de l'Histoire : là où mène la mission de savoir.
    let e = (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'mythes', palier: 1 })).corps
    assert.ok(e.id, e.error)
    const bienRepondre = async (fois: number) => {
      for (let i = 0; i < fois; i++) {
        const q = e.question
        const r = await poster(banc, lea, `/api/campagne/epreuve/${e.id}/reponse`, { index: q.index, choix: q.reponses.findIndex((x: string) => x.startsWith('Bonne')) })
        assert.equal(r.status, 200, r.corps.error)
        e = r.corps.epreuve
      }
    }
    // Neuf bonnes réponses : le savoir est fait, sur son sentier ; l'aventure en attend une.
    await bienRepondre(9)
    const aNeuf = await lues()
    assert.deepEqual(
      aNeuf.missions.map(m => [m.avance, m.faite]),
      [
        [0, false],
        [9, false],
        [5, true],
      ],
    )
    assert.deepEqual(aNeuf.nouvelles, [2])
    // La dixième : l'aventure est faite, l'épreuve pas même finie — ses bonnes réponses comptent, validée ou non.
    await bienRepondre(1)
    assert.ok(!e.finie, 'seize questions : l’épreuve continue')
    const aDix = await lues()
    assert.deepEqual([aDix.missions[1].avance, aDix.missions[1].faite, aDix.nouvelles], [10, true, [1]])
  } finally {
    await banc.close()
  }
})
