// Le QG de l'administrateur (`/admin`, le souhait du propriétaire du 13 octobre
// 2026 : « un vrai QG pour monitorer tous les modes de jeu ») : le direct de
// toutes les soirées, en chiffres seulement, et la vue d'ensemble des modes —
// ce qu'on joue aujourd'hui comparé à la même heure, trente jours de
// participations, ce qui attend un geste.
//
// Les dérivations pures se jouent l'horloge à la main ; les routes, sur un
// serveur jetable, avec une vraie soirée et de vrais profils.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import React from 'react'
import { baseDEssai, connexionAnimateur, creerQuiz, demarrer, ecranCommun, ecrire, inscrireProfil, invite, lancerQuiz, patienter, qcm, type Banc } from './banc'
import {
  EN_PLAN_MS,
  JOURS_DU_QG,
  TUILES_DU_QG,
  compteDuJour,
  dureeEcrite,
  ecartALHabitude,
  etatDeLaSoiree,
  graduations,
  heureEcrite,
  jourAbrege,
  joursDesMinuits,
  lesChosesATraiter,
  minuitDe,
  minuitsDeParis,
  ouEnEstLaSoiree,
  participationsParJour,
  quandEcrit,
  type ATraiterDuQg,
  type DirectDuQg,
  type SoireeDuQg,
  type VueDEnsemble,
} from '../../shared/qg'
import { jourDe } from '../../shared/jour'
import { campagneDeLaVue } from '../../shared/qgCampagne'
import { duelsDeLaVue } from '../../shared/qgDuels'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

const H = 3_600_000
const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

// ── Les jours de Paris ────────────────────────────────────────────────────

test('les minuits de Paris se lisent dans le jour : le 25 octobre 2026 dure vingt-cinq heures', () => {
  // Le lundi 26 octobre à 13 h (heure d'hiver) : la veille, l'heure d'été a pris fin.
  const minuits = minuitsDeParis(Date.UTC(2026, 9, 26, 12), 3)
  assert.deepEqual(minuits, [Date.UTC(2026, 9, 23, 22), Date.UTC(2026, 9, 24, 22), Date.UTC(2026, 9, 25, 23)])
  assert.deepEqual([minuits[1] - minuits[0], minuits[2] - minuits[1]], [24 * H, 25 * H])
})

test('un chiffre du jour se compare à la même heure des sept jours d’avant, jamais à des journées entières', () => {
  // Mardi 13 octobre 2026, 21 h à Paris (19 h UTC, heure d'été).
  const maintenant = Date.UTC(2026, 9, 13, 19)
  const minuits = minuitsDeParis(maintenant, 10)
  const a = (jour: number, heureDeParis: number, qui?: string) => ({ quand: minuits[jour] + heureDeParis * H, ...(qui && { qui }) })
  const evenements = [
    // Aujourd'hui : trois parties, de deux personnes.
    a(9, 8, 'a'), a(9, 9, 'a'), a(9, 20, 'b'),
    // Hier : une à 10 h, une à 22 h — après l'heure qu'il est : elle compte au jour, pas à « d'habitude ».
    a(8, 10, 'c'), a(8, 22, 'c'),
    // Du deuxième au septième jour d'avant, une à midi.
    ...[2, 3, 4, 5, 6, 7].map(j => a(j, 12, 'd')),
    // Le huitième jour d'avant n'entre plus dans l'habitude.
    ...[1, 2, 3, 4, 5].map(m => ({ quand: minuits[1] + m * H })),
    // Ni ce qui tombe avant le premier minuit, ni ce qui viendrait après maintenant.
    { quand: minuits[0] - 1 },
    { quand: maintenant + 1 },
  ]
  const compte = compteDuJour(evenements, minuits, maintenant)
  assert.equal(compte.aujourdhui, 3)
  assert.equal(compte.habituel, 1, 'sept jours à une partie avant 21 h')
  assert.deepEqual(compte.parJour, [0, 5, 1, 1, 1, 1, 1, 1, 2, 3])
  // Des personnes, pas des faits.
  assert.equal(compteDuJour(evenements, minuits, maintenant, { distincts: true }).aujourdhui, 2)
  // Le premier jour du serveur n'a rien à quoi se comparer.
  assert.equal(compteDuJour([], minuits.slice(-1), maintenant).habituel, null)
})

test('les participations : seul, un joueur compte une fois par mode et par jour ; en soirée, chaque invité qui a joué', () => {
  const maintenant = Date.UTC(2026, 9, 13, 19)
  const minuits = minuitsDeParis(maintenant, 3)
  const aujourdhui = minuits[2] + 10 * H
  const parts = participationsParJour(
    [
      { quand: aujourdhui, qui: 'a', mode: 'jour' },
      { quand: aujourdhui + H, qui: 'a', mode: 'jour' },
      { quand: aujourdhui, qui: 'a', mode: 'campagne' },
      { quand: aujourdhui + 2 * H, qui: 'a', mode: 'campagne' },
      { quand: aujourdhui, qui: 'b', mode: 'campagne' },
      { quand: aujourdhui, qui: 'a', mode: 'duel' },
      { quand: minuits[1] + H, qui: 'c', mode: 'duel' },
    ],
    [
      { quand: aujourdhui, joueurs: 5 },
      { quand: aujourdhui + H, joueurs: 3 },
    ],
    minuits,
    maintenant,
  )
  assert.deepEqual(
    parts.map(p => p.jour),
    ['2026-10-11', '2026-10-12', '2026-10-13'],
  )
  assert.deepEqual(parts[2].modes, { soiree: 8, campagne: 2, jour: 1, duel: 1 })
  assert.deepEqual(parts[1].modes, { soiree: 0, campagne: 0, jour: 0, duel: 1 })
})

// ── Ce qu'on lit ──────────────────────────────────────────────────────────

test('une soirée est laissée en plan après six heures sans un geste, et se dit sans rien de son contenu', () => {
  assert.equal(etatDeLaSoiree(0, EN_PLAN_MS - 1), 'en-cours')
  assert.equal(etatDeLaSoiree(0, EN_PLAN_MS), 'en-plan')
  const s = (partie: SoireeDuQg['partie'], quizJoues = 0) => ouEnEstLaSoiree({ partie, quizJoues, etat: 'en-cours' })
  assert.equal(s(null), 'Salle d’attente')
  assert.equal(s(null, 2), 'Entre deux quiz · 2 joués')
  assert.equal(s({ phase: 'pickPack', quiz: 3, question: null, questions: null }, 2), 'Choix du quiz')
  assert.equal(s({ phase: 'question', quiz: 2, question: 6, questions: 15 }, 2), 'Quiz 2 · question 7 sur 15')
  assert.equal(s({ phase: 'reveal', quiz: 2, question: 6, questions: 15 }, 2), 'Quiz 2 · réponse de la question 7 sur 15')
  assert.equal(s({ phase: 'finished', quiz: 1, question: 9, questions: 10 }, 1), 'Quiz 1 · podium')
})

test('ce qui attend un geste : le plus pressé d’abord, et rien qui n’attende pas', () => {
  const calme: ATraiterDuQg = {
    reserve: { joursDAvance: 21 },
    signalementsDuJour: { questions: 0, joueurs: 0 },
    signalementsDeLaCampagne: { questions: 0, joueurs: 0 },
    catalogue: 0,
    rappel: { jour: '2026-10-12', envoyes: 87, echecs: 0 },
    routine: { jour: null, campagne: null },
    serveur: { arretNet: null, erreurs: null, tursoLent: null, memoireMo: null },
  }
  assert.deepEqual(lesChosesATraiter(calme, { soirees: [], miroir: { enAttente: 0, echecsConsecutifs: 0, enEchecDepuis: null, espacesEnRetard: 0 } }), [])
  const enPlan = { spaceId: 'tom', salon: { nom: 'Le salon de Tom', avatar: '🦉' }, etat: 'en-plan', inscrits: 9 } as SoireeDuQg
  const choses = lesChosesATraiter(
    {
      ...calme,
      reserve: { joursDAvance: 6 },
      signalementsDuJour: { questions: 1, joueurs: 3 },
      signalementsDeLaCampagne: { questions: 2, joueurs: 4 },
      catalogue: 2,
      rappel: { jour: '2026-10-12', envoyes: 87, echecs: 3 },
    },
    { soirees: [enPlan], miroir: { enAttente: 12, echecsConsecutifs: 4, enEchecDepuis: '2026-10-13T19:00:00.000Z', espacesEnRetard: 1 } },
  )
  // Les signalements des deux modes se relisent sur une seule page depuis le
  // 14 octobre 2026 (« Une page qui remplace les sections ») : une seule
  // ligne, qui dit d'où viennent ses questions — deux lignes menaient à deux
  // pages qui ne les montrent plus.
  assert.deepEqual(
    choses.map(c => c.cle),
    ['miroir', 'reserve', 'signalements', 'catalogue', 'en-plan-tom', 'rappel'],
  )
  assert.deepEqual(
    choses.filter(c => c.alerte).map(c => c.cle),
    ['miroir', 'reserve'],
  )
  assert.equal(choses[1].detail, '6 jours d’avance, l’alerte est à 7')
  assert.deepEqual(
    [choses[2].titre, choses[2].detail, choses[2].ecran],
    ['3 questions signalées', '1 au quiz du jour (3 joueurs) · 2 en campagne (4 joueurs)', 'signalements'],
    'les joueurs se comptent par mode : le même signale peut-être aux deux',
  )
  assert.equal(choses[3].titre, '2 copies à relire')
  assert.equal(choses[4].detail, 'Le salon de Tom, 9 invités')
  assert.equal(choses[5].detail, '3 envois en échec sur 90')
  assert.equal(lesChosesATraiter({ ...calme, catalogue: 1 }, null)[0].detail, 'proposée au catalogue')
  const uneSeule = lesChosesATraiter({ ...calme, signalementsDeLaCampagne: { questions: 1, joueurs: 1 } }, null)
  assert.deepEqual([uneSeule[0].titre, uneSeule[0].detail], ['Une question signalée', '1 en campagne (1 joueur)'])
})

test('l’écart à l’habitude : en pour cent au-delà de vingt, en chiffre en deçà — trois contre deux ne font pas « 50 % de plus »', () => {
  const c = (aujourdhui: number, habituel: number | null) => ecartALHabitude({ aujourdhui, habituel, parJour: [] })
  assert.equal(c(3, null), null, 'le premier jour n’a rien à quoi se comparer')
  assert.deepEqual(c(163, 155), { sens: 'plus', texte: '5 %', suite: ' de plus que d’habitude' })
  assert.deepEqual(c(220, 229), { sens: 'moins', texte: '4 %', suite: ' de moins que d’habitude' })
  assert.deepEqual(c(70, 70), { sens: null, texte: 'comme d’habitude', suite: '' })
  assert.deepEqual(c(400, 399), { sens: null, texte: 'comme d’habitude', suite: '' }, 'un quart de pour cent s’arrondit à rien')
  assert.deepEqual(c(3, 2), { sens: null, texte: '2 d’habitude', suite: '' })
  assert.deepEqual(c(2, 2), { sens: null, texte: 'comme d’habitude', suite: '' })
})

test('les mots du QG : une durée d’un coup d’œil, un instant au jour de Paris, des crans ronds sous un axe', () => {
  // Une durée ne se coupe jamais en fin de ligne : ses espaces sont insécables.
  assert.equal(dureeEcrite(8 * H), '8 h 00')
  const lu = (texte: string) => texte.replace(/ /g, ' ')
  assert.deepEqual(
    [30_000, 18 * 60_000, 72 * 60_000, 60 * 60_000, 26 * H].map(ms => lu(dureeEcrite(ms))),
    ['moins d’une minute', '18 min', '1 h 12', '1 h 00', '1 j'],
  )
  // Mardi 13 octobre 2026, 21 h 04 à Paris.
  const maintenant = Date.UTC(2026, 9, 13, 19, 4)
  assert.equal(lu(heureEcrite(maintenant)), '21 h 04')
  assert.equal(lu(quandEcrit(Date.UTC(2026, 9, 13, 5, 2), maintenant)), 'aujourd’hui à 7 h 02')
  // Lundi 22 h 30 au temps universel : déjà mardi à Paris.
  assert.equal(lu(quandEcrit(Date.UTC(2026, 9, 12, 22, 30), maintenant)), 'aujourd’hui à 0 h 30')
  assert.equal(lu(quandEcrit(Date.UTC(2026, 9, 12, 21, 10), maintenant)), 'hier à 23 h 10')
  assert.equal(quandEcrit(Date.UTC(2026, 9, 1, 10), maintenant), 'le 1er octobre')
  assert.deepEqual([jourAbrege('2026-09-14'), jourAbrege('2026-10-01')], ['14 sept.', '1er oct.'])
  assert.deepEqual(graduations(274), [0, 100, 200, 300])
  assert.deepEqual(graduations(7), [0, 2, 4, 6, 8])
  assert.deepEqual(graduations(1), [0, 1], 'jamais de demi-personne')
  assert.deepEqual(graduations(40), [0, 10, 20, 30, 40])
  assert.deepEqual(graduations(0), [0])
})

// ── Les routes ────────────────────────────────────────────────────────────

/** Le direct, relu jusqu'à ce qu'il dise ce qu'on attend. */
async function directQuand(banc: Banc, cookie: string, pred: (d: DirectDuQg) => boolean, label: string): Promise<DirectDuQg> {
  for (let i = 0; i < 60; i++) {
    const d = (await lire<DirectDuQg>(banc, cookie, '/api/admin/qg/direct')).corps
    if (pred(d)) return d
    await patienter(100)
  }
  throw new Error(`délai dépassé en attendant : ${label}`)
}

test('le direct : une soirée en chiffres — où elle en est, combien d’invités —, jamais un prénom ni un quiz ; en plan après six heures', async () => {
  const horloge = { decalage: 0 }
  const banc = await demarrer({ horlogeDuJour: () => Date.now() + horloge.decalage })
  try {
    const admin = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, admin, [qcm('Une question très confidentielle ?', ['Oui', 'Non'])], 'Le quiz très secret')
    const host = await ecranCommun(banc.url, admin)
    assert.deepEqual((await lire<DirectDuQg>(banc, admin, '/api/admin/qg/direct')).corps.soirees, [], 'personne : pas de soirée')

    await invite(banc.url, 'Zoé Mystère', '🦊')
    await invite(banc.url, 'Gaspard Caché', '🐙')
    const attente = await directQuand(banc, admin, d => d.soirees[0]?.connectes === 2, 'deux invités connectés')
    assert.equal(ouEnEstLaSoiree(attente.soirees[0]), 'Salle d’attente')

    await lancerQuiz(host, quiz)
    const enJeu = await directQuand(banc, admin, d => !!d.soirees[0]?.partie && d.soirees[0].partie.phase !== 'pickPack', 'le quiz lancé')
    const s = enJeu.soirees[0]
    assert.deepEqual(
      [s.etat, s.inscrits, s.connectes, s.ecran, s.sauvegardeEnRetard, s.partie?.quiz, s.partie?.questions, s.salon.nom],
      ['en-cours', 2, 2, true, false, 1, 1, 'Antoine'],
    )
    assert.equal(enJeu.invitesConnectes, 2)
    assert.equal(enJeu.serveur.env, 'production')
    // Ni un prénom d'invité, ni le quiz, ni sa question : le QG ne lit que des chiffres.
    const texte = JSON.stringify(enJeu)
    for (const secret of ['Zoé', 'Gaspard', 'quiz très secret', 'très confidentielle']) assert.ok(!texte.includes(secret), `« ${secret} » ne sort pas`)

    // Six heures sans un geste : elle est laissée en plan, et attend qu'on la close.
    horloge.decalage = EN_PLAN_MS + 60_000
    const plusTard = (await lire<DirectDuQg>(banc, admin, '/api/admin/qg/direct')).corps
    assert.equal(plusTard.soirees[0].etat, 'en-plan')
    assert.deepEqual(
      lesChosesATraiter(null, plusTard).map(c => c.cle),
      [`en-plan-${plusTard.soirees[0].spaceId}`],
    )
  } finally {
    await banc.close()
  }
})

test('la vue d’ensemble : les chiffres du jour par mode, trente jours de participations, ce qui attend un geste', async () => {
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(40) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const avant = (await lire<VueDEnsemble>(banc, admin, '/api/admin/qg')).corps
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob')
    assert.equal((await poster(banc, lea, '/api/jour/commencer')).status, 200)
    const serie = await poster(banc, bob, '/api/campagne/serie')
    assert.ok(serie.corps.id, serie.corps.error)

    // Deux questions du jour signalées par Léa, une de la campagne par Bob ; une déjà relue ne compte plus.
    const leaId = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id as string
    const bobId = (await lire(banc, bob, '/api/joueur/moi')).corps.profile.id as string
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const signaler = base.prepare('INSERT INTO jour_signalements (jour, question, profile_id, texte, cree_le, traite_le) VALUES (?, ?, ?, ?, ?, ?)')
      signaler.run(avant.jour, 0, leaId, 'Le livre ou le film ?', Date.now(), null)
      signaler.run(avant.jour, 3, leaId, 'Deux bonnes réponses', Date.now(), null)
      signaler.run(avant.jour, 5, bobId, 'Déjà relue', Date.now(), Date.now())
      // Ni ce que la page du quiz du jour ne montre pas : un jour sans tirage, une question hors du sien.
      signaler.run('2026-01-01', 0, bobId, 'Un jour sans tirage', Date.now(), null)
      signaler.run(avant.jour, 12, bobId, 'Une onzième question', Date.now(), null)
      base
        .prepare('INSERT INTO campagne_signalements (question_id, profile_id, serie_id, texte, cree_le, traite_le) VALUES (?, ?, ?, ?, ?, ?)')
        .run('essai001', bobId, serie.corps.id, 'Le Rhin passe aussi en France', Date.now(), null)
    } finally {
      base.close()
    }

    const vue = (await lire<VueDEnsemble>(banc, admin, '/api/admin/qg')).corps
    const de = (t: keyof VueDEnsemble['aujourdhui']) => vue.aujourdhui[t].aujourdhui - avant.aujourdhui[t].aujourdhui
    assert.deepEqual(
      [de('nouveauxProfils'), de('partiesDuJour'), de('seriesDeCampagne'), de('duels'), de('profilsActifs'), de('achats')],
      [2, 1, 1, 0, 2, 0],
    )
    assert.equal(vue.participations.length, JOURS_DU_QG)
    assert.equal(vue.participations.at(-1)!.jour, vue.jour, 'aujourd’hui en dernier')
    assert.deepEqual(vue.participations.at(-1)!.modes, { soiree: 0, campagne: 1, jour: 1, duel: 0 })
    assert.equal(vue.aujourdhui.partiesDuJour.parJour.length, 12)
    assert.deepEqual(vue.aTraiter.signalementsDuJour, { questions: 2, joueurs: 1 })
    assert.deepEqual(vue.aTraiter.signalementsDeLaCampagne, { questions: 1, joueurs: 1 })
    // L'avance de la réserve, lue par ses seules questions prêtes : celle que dit sa page.
    const pageDuJour = (await lire(banc, admin, '/api/admin/jour')).corps
    assert.equal(vue.aTraiter.reserve?.joursDAvance, pageDuJour.reserve.joursDAvance)
    assert.equal(vue.aTraiter.catalogue, 0)
  } finally {
    await banc.close()
  }
})

test('la vue d’ensemble ne relit les jours finis qu’une fois par jour : la page la redemande toutes les cinq minutes', async () => {
  // Trente jours de séries relus à chaque fois coûtaient au quota de Turso ce
  // que la page ne montrait pas de neuf — et un QG reste ouvert toute la
  // journée : seul aujourd'hui se relit (le test d'avant), les jours d'avant
  // au premier passage de minuit.
  const horloge = { decalage: 0 }
  const banc = await demarrer({ horlogeDuJour: () => Date.now() + horloge.decalage })
  try {
    const admin = await connexionAnimateur(banc.url)
    const premiere = (await lire<VueDEnsemble>(banc, admin, '/api/admin/qg')).corps
    // Une partie d'hier, écrite après cette première lecture : un jour de 25 heures n'y change rien.
    const hier = minuitDe(premiere.maintenant) - 12 * H
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      base.prepare('INSERT INTO jour_parties (profile_id, jour, commencee_le, question) VALUES (?, ?, ?, 0)').run('p-fantome', jourDe(hier), hier)
    } finally {
      base.close()
    }
    const ensuite = (await lire<VueDEnsemble>(banc, admin, '/api/admin/qg')).corps
    assert.equal(ensuite.participations.at(-2)!.jour, jourDe(hier))
    assert.equal(ensuite.participations.at(-2)!.modes.jour, 0, 'hier ne s’est pas relu')

    // Le lendemain, vers midi : les trente jours se relisent, la partie y est.
    const demain = minuitDe(minuitDe(premiere.maintenant) + 36 * H) + 12 * H
    horloge.decalage = demain - Date.now()
    const apres = (await lire<VueDEnsemble>(banc, admin, '/api/admin/qg')).corps
    assert.equal(apres.participations.at(-3)!.jour, jourDe(hier))
    assert.equal(apres.participations.at(-3)!.modes.jour, 1)
  } finally {
    await banc.close()
  }
})

// ── La page ───────────────────────────────────────────────────────────────

test('la vue d’ensemble se lit d’un coup d’œil : le direct, ce qui attend un geste, trente jours en barres, les soirées en chiffres', async () => {
  Object.assign(globalThis, { React })
  const { VueDEnsembleDuQg } = await import(new URL('../../client/src/components/QgVueDEnsemble.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  // Mardi 13 octobre 2026, 21 h 04 à Paris.
  const maintenant = Date.UTC(2026, 9, 13, 19, 4)
  const jours = joursDesMinuits(minuitsDeParis(maintenant, JOURS_DU_QG))
  const tuile = { aujourdhui: 163, habituel: 155, parJour: [140, 150, 0, 160, 150, 155, 150, 150, 158, 149, 150, 163] }
  const vue: VueDEnsemble = {
    maintenant,
    jour: jours.at(-1)!,
    aujourdhui: Object.fromEntries(TUILES_DU_QG.map(t => [t, tuile])) as VueDEnsemble['aujourdhui'],
    participations: jours.map((jour, i) => ({ jour, modes: { soiree: i % 7 === 0 ? 20 : 0, campagne: 70, jour: 110, duel: 35 } })),
    campagne: campagneDeLaVue([], minuitsDeParis(maintenant, JOURS_DU_QG), maintenant),
    duels: duelsDeLaVue([], minuitsDeParis(maintenant, JOURS_DU_QG), maintenant),
    aTraiter: {
      reserve: { joursDAvance: 6 },
      signalementsDuJour: { questions: 1, joueurs: 3 },
      signalementsDeLaCampagne: { questions: 0, joueurs: 0 },
      catalogue: 1,
      rappel: null,
      routine: { jour: maintenant - 14 * H, campagne: null },
      serveur: { arretNet: null, erreurs: null, tursoLent: null, memoireMo: null },
    },
  }
  const soiree = (s: Partial<SoireeDuQg>): SoireeDuQg => ({
    spaceId: 'lea',
    salon: { nom: 'Le salon de Léa', avatar: '🦊' },
    etat: 'en-cours',
    inscrits: 15,
    connectes: 14,
    depuis: maintenant - 72 * 60_000,
    dernierSigne: maintenant - 60_000,
    quizJoues: 2,
    partie: { phase: 'question', quiz: 2, question: 6, questions: 15 },
    ecran: true,
    sauvegardeEnRetard: false,
    ...s,
  })
  const direct: DirectDuQg = {
    maintenant,
    soirees: [
      soiree({}),
      soiree({ spaceId: 'tom', salon: { nom: 'Le salon de Tom', avatar: null }, etat: 'en-plan', connectes: 0, dernierSigne: maintenant - 7 * H - 5 * 60_000, quizJoues: 1, partie: null }),
    ],
    invitesConnectes: 14,
    profilsEnLigne: 38,
    miroir: { enAttente: 0, echecsConsecutifs: 0, enEchecDepuis: null, espacesEnRetard: 0 },
    serveur: { env: 'production', version: 'a1b2c3d4e5', enMarcheDepuisS: 13_200, memoireMo: 212, cpuPct: 4, bouclePct: 2, baseP95Ms: 84, connexions: 22 },
  }
  // Lu sans les séparateurs de React ni les espaces insécables des durées.
  const html = renderToStaticMarkup(
    React.createElement(VueDEnsembleDuQg, { vue, direct, vueEnPanne: false, directEnPanne: false, ouvrir: () => {} }),
  )
    .replace(/<!-- -->/g, '')
    .replace(/ /g, ' ')
  assert.doesNotMatch(html, /undefined|NaN/)

  // Le direct : une soirée en cours, l'autre laissée en plan ; le miroir à jour.
  assert.match(html, /<span class="admin-cadran-chiffre num">1<\/span><span class="admin-cadran-nom">soirée en cours<\/span><span class="admin-cadran-detail">et 1 laissée en plan<\/span>/)
  assert.match(html, /miroir à jour · Turso 84 ms/)
  // Ce qui attend un geste, le plus pressé d'abord ; ce qui a sa page s'ouvre d'un toucher, le reste se lit
  // — la soirée laissée en plan, sur la page des soirées qui la clôt.
  const lignes = [...html.matchAll(/<(button type="button"|div) class="qg-ligne">.*?<b>([^<]+)<\/b>/g)].map(m => [m[1] === 'div' ? 'lu' : 'ouvre', m[2]])
  assert.deepEqual(lignes, [
    ['ouvre', 'La réserve du quiz du jour'],
    // Une ligne pour les deux modes, qui ouvre leur page (le 14 octobre 2026).
    ['ouvre', 'Une question signalée'],
    ['ouvre', 'Une copie à relire'],
    ['ouvre', 'Une soirée laissée en plan'],
  ])
  // Les tuiles : le chiffre, l'écart qui se dit aussi au lecteur d'écran.
  assert.match(html, /5 %<span class="sr-only"> de plus que d’habitude<\/span>/)
  // Trente jours, chacun son infobulle ; la légende dit les chiffres d'aujourd'hui.
  const infobulles = [...html.matchAll(/<title>([^<]+)<\/title>/g)].map(m => m[1])
  assert.equal(infobulles.length, JOURS_DU_QG)
  assert.equal(infobulles.at(-1), 'mardi 13 octobre : 215 participations — campagne 70, quiz du jour 110, duels 35')
  assert.match(html, /Aujourd’hui · 215 participations/)
  // Les soirées : où elles en sont et combien elles comptent de monde, rien d'autre.
  assert.match(html, /Quiz 2 · question 7 sur 15 · depuis 1 h 12/)
  assert.match(html, /Entre deux quiz · 1 joué · sans un geste depuis 7 h 05/)
  assert.match(html, /14 sur 15 connectés/)
  // Le serveur, et la routine du matin passée à 7 h 04 dans la réserve du jour — pas dans la campagne.
  assert.match(html, /4 % d’un cœur/)
  assert.match(html, /<dt>Routine, quiz du jour<\/dt><dd>aujourd’hui à 7 h 04<\/dd>/)
  assert.match(html, /<dt>Routine, campagne<\/dt><dd>rien encore<\/dd>/)
})
