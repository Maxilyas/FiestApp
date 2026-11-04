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
  modeDeLaSerie,
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
import { dUneTraite } from '../../shared/tranches'
import { ProfileStore } from '../src/auth/profiles'
import { chiffresDeLaVue, type Journaux } from '../src/qg'
import { PERIODES_DU_QG, activiteDeLaPeriode } from '../../shared/qgPeriodes'
import { etatDuService, phraseDeLEtat } from '../../shared/qgEtat'
import type { AlertesDuServeur } from '../../shared/santeDuServeur'

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

test('les participations : un joueur compte une fois par jour, une fois par mode dans le sien ; chaque partie compte, qui que ce soit', () => {
  // Le souhait du propriétaire du 2 novembre 2026 : « le nombre de personnes
  // unique qui participent mais aussi pouvoir switcher sur la quantité peu
  // importe l'utilisateur » — et le Cabinet, qui manquait.
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
      // Une partie du Cabinet : sa série est de campagne, son mode à lui.
      { quand: aujourdhui + 3 * H, qui: 'b', mode: 'cabinet' },
      { quand: minuits[1] + H, qui: 'c', mode: 'duel' },
    ],
    [
      // a y vient avec son profil : il ne fait qu'un joueur du jour ; ses quatre voisins sans profil, un chacun.
      { quand: aujourdhui, joueurs: 5, profils: ['a'] },
      // Une fiche d'avant les profils : chaque invité compte à part.
      { quand: aujourdhui + H, joueurs: 3 },
      // a revient dans une deuxième soirée, avec d : il ne compte pas deux fois.
      { quand: aujourdhui + 2 * H, joueurs: 2, profils: ['a', 'd'] },
    ],
    minuits,
    maintenant,
  )
  assert.deepEqual(
    parts.map(p => p.jour),
    ['2026-10-11', '2026-10-12', '2026-10-13'],
  )
  assert.deepEqual(parts[2], {
    jour: '2026-10-13',
    // a, b, d, et sept invités sans profil.
    joueurs: 10,
    // Qui joue à deux modes compte dans les deux : ces chiffres ne s'additionnent pas.
    modes: { soiree: 9, campagne: 2, cabinet: 1, jour: 1, duel: 1 },
    // Chaque partie, et chaque invité de chaque soirée.
    parties: { soiree: 10, campagne: 3, cabinet: 1, jour: 2, duel: 1 },
  })
  assert.deepEqual(parts[1], {
    jour: '2026-10-12',
    joueurs: 1,
    modes: { soiree: 0, campagne: 0, cabinet: 0, jour: 0, duel: 1 },
    parties: { soiree: 0, campagne: 0, cabinet: 0, jour: 0, duel: 1 },
  })
  assert.equal(parts[0].joueurs, 0)
})

// La vue d'ensemble se compte un chiffre par tour de boucle (`enTranches`) :
// trente jours de séries — plus de trois mille en production — passaient
// d'une traite dans chacun de ses comptes, une demi-seconde de gel au dixième
// de cœur à chaque réveil (le banc bridé du 3 novembre 2026). Les mêmes
// chiffres qu'en un bloc, comptés comme la vue les comptait.
test('les chiffres de la vue d’ensemble, un compte par tranche : les mêmes qu’en un bloc', () => {
  const maintenant = Date.UTC(2026, 9, 13, 19)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
  let graine = 11
  const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647
  // Quelques faits avant le premier minuit ou après maintenant : ils ne comptent pas.
  const quand = () => minuits[0] - 3 * H + Math.floor(hasard() * (maintenant - minuits[0] + 5 * H))
  const qui = () => `p${Math.floor(hasard() * 40)}`
  const modes = ['serie', 'sentier', 'duel', 'rencontre', 'revision', 'sujet', 'cabinet', 'defi', 'expedition', null]
  // Une partie sur cinq laissée en route ; les autres finies quelques minutes après leur début — parfois après maintenant.
  const finDe = (debut: number) => (hasard() < 0.2 ? null : debut + Math.floor(hasard() * 40) * 60_000)
  const journaux: Journaux = {
    parties: Array.from({ length: 300 }, () => {
      const debut = quand()
      return { qui: qui(), quand: debut, questions: 10, fin: finDe(debut), justes: 6, comptees: 10 }
    }),
    series: Array.from({ length: 900 }, () => {
      const debut = quand()
      return { qui: qui(), quand: debut, mode: modes[Math.floor(hasard() * modes.length)], questions: 12, fin: finDe(debut), justes: 7 }
    }),
    activite: {
      inscriptions: Array.from({ length: 30 }, quand),
      achats: Array.from({ length: 50 }, quand),
      soirees: Array.from({ length: 40 }, () => ({ qui: qui(), quand: quand(), quiz: 2, questions: 20 })),
    },
  }
  const soirees = Array.from({ length: 25 }, (_, i) => ({ quand: quand(), joueurs: 6, ...(i % 3 > 0 && { profils: [qui(), qui()] }) }))

  // Le bloc d'avant, recopié de la route : chaque compte sur les mêmes journaux — la fin de chaque partie comprise,
  // que les périodes comptent pour l'entonnoir d'un mode.
  const { parties, series, activite } = journaux
  const solo = [
    ...parties.map(p => ({ ...p, mode: 'jour' as const })),
    ...series.map(s => ({ quand: s.quand, qui: s.qui, mode: modeDeLaSerie(s.mode), fin: s.fin })),
  ]
  const campagne = series.filter(s => modeDeLaSerie(s.mode) !== 'duel')
  const duels = series.filter(s => modeDeLaSerie(s.mode) === 'duel')
  const dUnBloc = {
    aujourdhui: {
      profilsActifs: compteDuJour([...solo, ...activite.soirees], minuits, maintenant, { distincts: true }),
      partiesDuJour: compteDuJour(parties, minuits, maintenant),
      seriesDeCampagne: compteDuJour(campagne, minuits, maintenant),
      duels: compteDuJour(duels, minuits, maintenant),
      nouveauxProfils: compteDuJour(activite.inscriptions.map(quand => ({ quand })), minuits, maintenant),
      achats: compteDuJour(activite.achats.map(quand => ({ quand })), minuits, maintenant),
    },
    participations: participationsParJour(solo, soirees, minuits, maintenant),
    campagne: campagneDeLaVue(series, minuits, maintenant),
    duels: duelsDeLaVue(series, minuits, maintenant),
    // Les quatre périodes de la barre du QG 2, chacune sur les mêmes journaux.
    periodes: Object.fromEntries(PERIODES_DU_QG.map(p => [p, activiteDeLaPeriode(p, solo, soirees, activite, minuits, maintenant)])),
  }
  assert.ok(dUnBloc.aujourdhui.profilsActifs.aujourdhui > 0 && dUnBloc.aujourdhui.seriesDeCampagne.habituel !== null, 'des chiffres à comparer')
  // Des parties finies à compter, et moins que de commencées : la vue les tient de la fin de chacune.
  const surTrente = dUnBloc.periodes['30j'].totaux
  assert.ok(surTrente.finies && surTrente.finies.campagne > 0 && surTrente.finies.campagne < surTrente.parties.campagne, 'des parties finies à compter')

  let tranches = 0
  const calcul = chiffresDeLaVue(journaux, soirees, minuits, maintenant)
  let r = calcul.next()
  for (; !r.done; r = calcul.next()) tranches++
  assert.deepEqual(r.value, dUnBloc)
  // Un compte par tranche, une période par tranche : les séries ne se relisent jamais toutes deux fois dans le même tour.
  assert.ok(tranches >= 6 + PERIODES_DU_QG.length, `${tranches} tranches`)
  assert.deepEqual(dUneTraite(chiffresDeLaVue(journaux, soirees, minuits, maintenant)), dUnBloc)
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
    serveur: { pannes: [], arretNet: null, erreurs: null, tursoLent: null, memoireMo: null },
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
      rappel: { jour: '2026-10-12', envoyes: 78, echecs: 12 },
    },
    { soirees: [enPlan], miroir: { enAttente: 12, echecsConsecutifs: 4, enEchecDepuis: '2026-10-13T19:00:00.000Z', espacesEnRetard: 1 } },
  )
  // Les signalements des deux modes se relisent sur une seule page depuis le
  // 14 octobre 2026 (« Une page qui remplace les sections ») : une seule
  // ligne, qui dit d'où viennent ses questions — deux lignes menaient à deux
  // pages qui ne les montrent plus. Chaque ligne à la gravité de sa règle, la
  // plus grave d'abord (la revue d'ergonomie du 4 novembre 2026 : la réserve
  // était rouge ici, « à surveiller » sur la page des alertes) ; ce qui
  // attend sans rien casser — relire, clore — après.
  assert.deepEqual(
    choses.map(c => [c.cle, c.gravite]),
    [
      ['miroir', 'critique'],
      ['reserve', 'veille'],
      ['rappel', 'veille'],
      ['signalements', 'a-faire'],
      ['catalogue', 'a-faire'],
      ['en-plan-tom', 'a-faire'],
    ],
  )
  assert.equal(choses[1].detail, '6 jours d’avance, l’alerte est à 7')
  assert.deepEqual(
    [choses[3].titre, choses[3].detail, choses[3].ecran],
    ['3 questions signalées', '1 au quiz du jour (3 joueurs) · 2 en campagne (4 joueurs)', 'signalements'],
    'les joueurs se comptent par mode : le même signale peut-être aux deux',
  )
  assert.equal(choses[4].titre, '2 copies à relire')
  assert.equal(choses[5].detail, 'Le salon de Tom, 9 invités')
  // Le rappel du soir, jugé comme sa règle : 12 échecs sur 90 passent les dix pour cent, et la ligne mène à sa page.
  assert.deepEqual([choses[2].detail, choses[2].ecran], ['12 envois en échec sur 90', 'jour'])
  // Les soirées qui ne se sauvegardent plus mènent à « Base et miroir », qui montre chaque salon : la ligne n'ouvrait rien.
  assert.deepEqual([choses[0].titre, choses[0].ecran], ['Les soirées ne se sauvegardent plus', 'base'])
  // Trois échecs sur quatre-vingt-dix ne sont pas une panne : sa règle se tait, la ligne aussi — elle le disait.
  const peu = { ...calme, rappel: { jour: '2026-10-12', envoyes: 87, echecs: 3 } }
  assert.deepEqual(lesChosesATraiter(peu, null), [])
  // Un seuil réglé vaut ici comme sur la page des alertes : à deux pour cent, les trois échecs se disent.
  assert.deepEqual(
    lesChosesATraiter(peu, { soirees: [], miroir: null, seuils: { rappel: 2 } }).map(c => c.cle),
    ['rappel'],
  )
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
      // Une partie du Cabinet de Léa : une série de campagne, que le graphique range au Cabinet.
      base
        .prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, '[]', 6, 0, 0, ?, NULL, 'cabinet')`)
        .run('partie-du-cabinet', leaId, Date.now())
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
      // La tuile de la campagne compte aussi la partie du Cabinet : sa page le range parmi ses sous-modes.
      [2, 1, 2, 0, 2, 0],
    )
    assert.equal(vue.participations.length, JOURS_DU_QG)
    assert.equal(vue.participations.at(-1)!.jour, vue.jour, 'aujourd’hui en dernier')
    // Léa au quiz du jour et au Cabinet, Bob en campagne : deux joueurs, trois participations.
    assert.deepEqual(vue.participations.at(-1), {
      jour: vue.jour,
      joueurs: 2,
      modes: { soiree: 0, campagne: 1, cabinet: 1, jour: 1, duel: 0 },
      parties: { soiree: 0, campagne: 1, cabinet: 1, jour: 1, duel: 0 },
    })
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

test('l’état du service : ce qui ne va pas d’abord, d’un mot et d’un chiffre — et rien d’alarmant tant que le serveur n’a pas répondu', () => {
  const maintenant = Date.UTC(2026, 10, 4, 20, 0)
  const direct: Pick<DirectDuQg, 'serveur' | 'miroir' | 'maintenant'> = {
    maintenant,
    miroir: { enAttente: 3, echecsConsecutifs: 0, enEchecDepuis: null, espacesEnRetard: 0 },
    serveur: { env: 'production', version: 'a41c9e2ff', enMarcheDepuisS: 3600, memoireMo: 236, cpuPct: 4, bouclePct: 2, baseP95Ms: 61, connexions: 13, routesP95Ms: 238, routesParMin: 1280 },
  }
  const auVert: AlertesDuServeur = { pannes: [], arretNet: null, erreurs: null, tursoLent: null, memoireMo: null }
  // Rien encore : chaque voyant attend, sans un mot de panne.
  const attente = etatDuService(null, null)
  assert.ok(attente.every(v => v.etat === 'inconnu'))
  assert.deepEqual(phraseDeLEtat(attente), { aRegarder: 0, phrase: 'Le serveur répond…' })
  // Tout au vert, dans l'ordre des organes : les modes, ce qu'un joueur attend, les erreurs, l'arrêt net, Turso…
  const vert = etatDuService(direct, auVert)
  assert.deepEqual(vert.map(v => v.cle), ['modes', 'ressenti', 'erreurs', 'arret', 'base', 'memoire', 'processeur', 'miroir', 'quota', 'version'])
  assert.ok(vert.every(v => v.etat === 'ok'))
  assert.deepEqual(phraseDeLEtat(vert), { aRegarder: 0, phrase: 'Tout est au vert' })
  assert.equal(vert[1].detail.replace(/[  ]/g, ' '), '238 ms pour 19 appels sur 20 · 1280 cette minute')
  assert.deepEqual([vert[7].nom, vert[7].detail, vert[7].ecran], ['Sauvegarde des soirées', '3 écritures en attente', 'base'])
  assert.equal(vert[9].nom, 'Version a41c9e2')
  // Turso et son quota mènent à « Base et miroir », qui les montre : ils ouvraient « Le serveur », qui ne les montre plus.
  assert.deepEqual(
    vert.filter(v => v.cle === 'base' || v.cle === 'quota').map(v => v.ecran),
    ['base', 'base'],
  )
  // Des erreurs à regarder, la mémoire au plafond, un ressenti lent : chacun à la gravité de sa règle — les erreurs et
  // la mémoire sérieuses, comme sur la page des alertes —, le plus grave d'abord, dans l'ordre des organes, puis ce qui
  // est à surveiller : le regard tombe sur le rouge, pas sur la sixième case.
  const mal = etatDuService(
    { ...direct, serveur: { ...direct.serveur, memoireMo: 470, routesP95Ms: 950 } },
    { ...auVert, erreurs: { n: 2, depuis: maintenant - H, source: 'GET /api/jour' } },
  )
  assert.deepEqual(
    mal.slice(0, 3).map(v => [v.cle, v.etat]),
    [
      ['erreurs', 'serieux'],
      ['memoire', 'serieux'],
      ['ressenti', 'veille'],
    ],
  )
  assert.equal(mal[0].ecran, 'erreurs')
  assert.deepEqual(phraseDeLEtat(mal), { aRegarder: 3, phrase: 'Trois points à regarder' })
  // Les seuils réglés valent ici comme pour les règles : 950 ms sous un ressenti réglé à une seconde, 470 Mo sous une
  // mémoire réglée à 480, sont au vert.
  const regles = etatDuService(
    { ...direct, serveur: { ...direct.serveur, memoireMo: 470, routesP95Ms: 950 }, seuils: { ressenti: 1000, memoire: 480 } },
    auVert,
  )
  assert.deepEqual(
    regles.filter(v => v.cle === 'ressenti' || v.cle === 'memoire').map(v => [v.cle, v.etat]),
    [
      ['ressenti', 'ok'],
      ['memoire', 'ok'],
    ],
  )
  // Et une minute de trois appels ne juge pas ce qu'un joueur attend : sa règle en veut vingt.
  assert.equal(etatDuService({ ...direct, serveur: { ...direct.serveur, routesP95Ms: 4000, routesParMin: 3 } }, auVert).find(v => v.cle === 'ressenti')?.etat, 'ok')
  // Un mode en panne se nomme ; un miroir en échec aussi, à son heure.
  const panne = etatDuService(
    { ...direct, miroir: { enAttente: 40, echecsConsecutifs: 6, enEchecDepuis: new Date(maintenant - 10 * 60_000).toISOString(), espacesEnRetard: 2 } },
    { ...auVert, pannes: [{ mode: 'jour', depuis: maintenant - 5 * 60_000, echecs: 4, dernierEchec: maintenant - 60_000, source: 'GET /api/jour' }] },
  )
  assert.deepEqual(
    panne.slice(0, 2).map(v => [v.cle, v.etat]),
    [
      ['modes', 'critique'],
      ['miroir', 'critique'],
    ],
  )
  assert.equal(panne[0].detail, 'Le quiz du jour en panne')
  assert.equal(panne[1].detail.replace(/[  ]/g, ' '), 'Turso en échec depuis 20 h 50')
})

// ── La page ───────────────────────────────────────────────────────────────

test('le poste de commande se lit d’un coup d’œil : l’état du service, ce qui attend un geste, la période en tuiles et en barres, les soirées en chiffres', async () => {
  Object.assign(globalThis, { React })
  const { VueDEnsembleDuQg } = await import(new URL('../../client/src/components/QgVueDEnsemble.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  // Lu sans les séparateurs de React ni les espaces insécables des heures et des durées.
  const lisible = (html: string) => html.replace(/<!-- -->/g, '').replace(/[  ]/g, ' ')
  // Mardi 13 octobre 2026, 21 h 04 à Paris.
  const maintenant = Date.UTC(2026, 9, 13, 19, 4)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
  const jours = joursDesMinuits(minuits)
  // Les dernières vingt-quatre heures : depuis 21 h — le seau en cours —, trois joueurs du jour — l'un aussi en
  // campagne —, une traversée du Cabinet et un duel ; un duel cet après-midi ; une soirée de vingt, dont deux
  // profils. La veille, une soirée de vingt invités sans profil.
  const solo = [
    ...['p1', 'p2', 'p3'].map(qui => ({ quand: maintenant - 3 * 60_000, qui, mode: 'jour' as const })),
    { quand: maintenant - 2 * 60_000, qui: 'p1', mode: 'campagne' as const },
    { quand: maintenant - 60_000, qui: 'p6', mode: 'cabinet' as const },
    { quand: maintenant - 2 * 60_000, qui: 'p4', mode: 'duel' as const },
    { quand: maintenant - 5 * H, qui: 'p4', mode: 'duel' as const },
  ]
  const soireesDuJour = [
    { quand: maintenant - 3 * H, joueurs: 20, profils: ['p4', 'p5'] },
    { quand: maintenant - 27 * H, joueurs: 20 },
  ]
  const periodes = Object.fromEntries(
    PERIODES_DU_QG.map(p => [p, activiteDeLaPeriode(p, solo, soireesDuJour, { inscriptions: [maintenant - 2 * H], achats: [] }, minuits, maintenant)]),
  ) as VueDEnsemble['periodes']
  const tuile = { aujourdhui: 163, habituel: 155, parJour: [140, 150, 0, 160, 150, 155, 150, 150, 158, 149, 150, 163] }
  const vue: VueDEnsemble = {
    maintenant,
    jour: jours.at(-1)!,
    aujourdhui: Object.fromEntries(TUILES_DU_QG.map(t => [t, tuile])) as VueDEnsemble['aujourdhui'],
    participations: jours.map((jour, i) => ({
      jour,
      // Moins que la somme des modes : qui joue à deux modes ne compte qu'une fois.
      joueurs: 180 + (i % 7 === 0 ? 20 : 0),
      modes: { soiree: i % 7 === 0 ? 20 : 0, campagne: 70, cabinet: 15, jour: 110, duel: 35 },
      parties: { soiree: i % 7 === 0 ? 20 : 0, campagne: 140, cabinet: 30, jour: 110, duel: 60 },
    })),
    campagne: campagneDeLaVue([], minuitsDeParis(maintenant, JOURS_DU_QG), maintenant),
    duels: duelsDeLaVue([], minuitsDeParis(maintenant, JOURS_DU_QG), maintenant),
    periodes,
    aTraiter: {
      reserve: { joursDAvance: 6 },
      signalementsDuJour: { questions: 1, joueurs: 3 },
      signalementsDeLaCampagne: { questions: 0, joueurs: 0 },
      catalogue: 1,
      rappel: null,
      routine: { jour: maintenant - 14 * H, campagne: null },
      serveur: { pannes: [], arretNet: null, erreurs: null, tursoLent: null, memoireMo: null },
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
  const html = lisible(renderToStaticMarkup(React.createElement(VueDEnsembleDuQg, { vue, direct, vueEnPanne: false, directEnPanne: false, ouvrir: () => {} })))
    .replace(/ /g, ' ')
  assert.doesNotMatch(html, /undefined|NaN/)

  // Le direct : une soirée en cours, l'autre laissée en plan ; la sauvegarde des soirées à jour.
  assert.match(html, /<span class="admin-cadran-chiffre num">1<\/span><span class="admin-cadran-nom">soirée en cours<\/span><span class="admin-cadran-detail">et 1 laissée en plan<\/span>/)
  assert.match(html, /sauvegarde à jour · Turso 84 ms/)
  // L'état du service : la phrase, puis les dix voyants — tout au vert ici, chacun son chiffre.
  assert.match(html, /<span class="qg-etat-phrase">Tout est au vert<\/span>/)
  assert.equal([...html.matchAll(/<li class="qg-voyant-bloc /g)].length, 10)
  assert.match(html, /<b>Mémoire<\/b><span class="qg-voyant-detail">212 sur 512 Mo<span class="sr-only"> — au vert<\/span><\/span>/)
  // Ce qui attend un geste, le plus pressé d'abord, chaque ligne à la gravité de sa règle ; ce qui a sa page s'ouvre
  // d'un toucher, le reste se lit — la soirée laissée en plan, sur la page des soirées qui la clôt.
  const lignes = [...html.matchAll(/<(button type="button"|div) class="qg-ligne qg-ligne-([a-z-]+)">.*?<b>([^<]+)<\/b>/g)].map(m => [
    m[1] === 'div' ? 'lu' : 'ouvre',
    m[3],
    m[2],
  ])
  assert.deepEqual(lignes, [
    ['ouvre', 'La réserve du quiz du jour', 'veille'],
    // Une ligne pour les deux modes, qui ouvre leur page (le 14 octobre 2026).
    ['ouvre', 'Une question signalée', 'a-faire'],
    ['ouvre', 'Une copie à relire', 'a-faire'],
    ['ouvre', 'Une soirée laissée en plan', 'a-faire'],
  ])
  // Elle n'est pas vide : au téléphone, elle passe avant l'état du service (la revue d'ergonomie du 4 novembre 2026).
  assert.ok(html.indexOf('qg-traiter') < html.indexOf('qg-etat-du-service'), '« À traiter » d’abord quand quelque chose attend')
  // Les tuiles de la période — la journée, d'office : le chiffre, l'écart à la période d'avant, qui se dit aussi au
  // lecteur d'écran. Vingt-quatre joueurs, chacun une fois — les deux profils de la soirée et les dix-huit invités
  // sans profil, les six profils qui ont joué seuls —, contre vingt la veille.
  assert.match(html, /Sur les dernières 24 heures/)
  // Des personnes, invités sans profil compris — la page des joueurs, elle, ne compte que des profils : deux mots pour deux
  // populations (la revue d'analyse du 4 novembre 2026).
  assert.match(html, /<span class="qg-tuile-nom">Personnes<\/span><span class="qg-tuile-valeur num">24<\/span>/)
  assert.match(html, /20 %<span class="sr-only"> de plus que la période d’avant<\/span><span aria-hidden="true"> · <\/span>invités compris/)
  // Chaque mode, ses participations et ses joueurs : un toucher ouvre sa page.
  assert.match(html, /<li class="qg-tuile qg-tuile-ouvre" style="--teinte:var\(--mode-cabinet\)"><button type="button"><span class="qg-tuile-nom"><i class="qg-tuile-cle qg-mode-cabinet" aria-hidden="true"><\/i>Cabinet<\/span><span class="qg-tuile-valeur num">1<\/span>/)
  assert.match(html, /1 joueur<\/span>/)
  // Vingt-quatre heures, chacune son infobulle ; la lecture dit l'heure en cours. D'office, les joueurs : chacun
  // une fois, en une seule série — empilés par mode, qui joue à deux modes aurait compté deux fois ; ses modes se
  // disent dans l'infobulle.
  const graphe = html.slice(html.indexOf('<section class="qg-console qg-participations"'), html.indexOf('</section>', html.indexOf('qg-participations')))
  const infobulles = [...graphe.matchAll(/<title>([^<]+)<\/title>/g)].map(m => m[1])
  assert.equal(infobulles.length, 24)
  assert.equal(infobulles.at(-1), '21 h 00 → 21 h 04 : 5 joueurs — campagne 1, cabinet 1, quiz du jour 3, duels 1')
  assert.match(graphe, /<p class="qg-lecture" aria-live="polite"><span>21 h 00 → 21 h 04 · <\/span><b class="num">5 joueurs<\/b><\/p>/)
  assert.match(graphe, /Qui joue à plusieurs modes compte dans chacun, une fois dans le total/)
  assert.match(graphe, /<button type="button" class="onglet actif" aria-pressed="true">Joueurs<\/button><button type="button" class="onglet" aria-pressed="false">Participations<\/button>/)
  assert.match(graphe, /class="qg-joueurs"/)
  assert.doesNotMatch(graphe, /qg-mode-/, 'une seule série : ni pile ni pastille de mode')
  assert.doesNotMatch(graphe, /qg-avant/, 'la période d’avant ne se pose qu’à la demande')
  // Les soirées : où elles en sont et combien elles comptent de monde, rien d'autre.
  assert.match(html, /Quiz 2 · question 7 sur 15 · depuis 1 h 12/)
  assert.match(html, /Entre deux quiz · 1 joué · sans un geste depuis 7 h 05/)
  assert.match(html, /14 sur 15 connectés/)
  // Le serveur, et la routine du matin passée à 7 h 04 dans la réserve du jour — pas dans la campagne.
  assert.match(html, /4 % d’un cœur/)
  assert.match(html, /<dt>Routine, quiz du jour<\/dt><dd>aujourd’hui à 7 h 04<\/dd>/)
  assert.match(html, /<dt>Routine, campagne<\/dt><dd>rien encore<\/dd>/)

  // Les participations, sans regarder qui : elles s'additionnent, leur pile se lit mode par mode, le Cabinet entre la
  // campagne et le quiz du jour ; comparées, la période d'avant passe en filet, et se dit à la lecture.
  const { Participations } = await import(new URL('../../client/src/components/QgVueDEnsemble.tsx', import.meta.url).href)
  const pile = lisible(renderToStaticMarkup(React.createElement(Participations, { vue, enPanne: false, depart: 'participations', comparer: true })))
  assert.doesNotMatch(pile, /undefined|NaN/)
  const bulles = [...pile.matchAll(/<title>([^<]+)<\/title>/g)].map(m => m[1])
  assert.equal(bulles.at(-1), '21 h 00 → 21 h 04 : 6 participations — campagne 1, cabinet 1, quiz du jour 3, duels 1')
  assert.match(pile, /<b class="num">6 participations<\/b><span class="muted"> · 0 la période d’avant<\/span>/)
  assert.match(pile, /aria-pressed="true">Participations<\/button>/)
  assert.match(pile, /<path class="qg-avant" d="M/)
  const debut = pile.lastIndexOf('<title>')
  const aujourdhuiDansLaPile = pile.slice(debut, pile.indexOf('</g>', debut))
  assert.deepEqual(
    [...aujourdhuiDansLaPile.matchAll(/class="qg-mode-(\w+)"/g)].map(m => m[1]),
    ['campagne', 'cabinet', 'jour', 'duel'],
  )
  assert.match(pile, /<i class="qg-pastille-mode qg-mode-cabinet" aria-hidden="true"><\/i>Cabinet <b class="num">1<\/b>/)
  assert.match(pile, /<i class="qg-pastille-avant" aria-hidden="true"><\/i>La période d’avant/)
})
