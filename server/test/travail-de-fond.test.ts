// Le travail de fond de la campagne rend la main une étape à la fois
// (`core/tourniquet.ts`). Au réveil, plusieurs calculs attendent la base ;
// à une mesure neuve, plusieurs attendent ses comptes. Ils rendaient déjà la
// main entre deux tranches, mais repartaient ensemble, dans la même phase de
// la boucle : les familles de la mesure, la préparation des tirages et la
// série de référence faisaient un seul bloc — 130 ms au réveil, 70 pour un dé
// tombé sur une mesure périmée, dix fois plus au dixième de cœur de
// l'hébergeur (le banc du gel, compilé comme en production, le 19 octobre
// 2026). On compte les tours de boucle, on ne chronomètre pas : une étape
// lourde par tour, jamais deux.
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { MessageChannel } from 'node:worker_threads'
import { baseDEssai } from './banc'
import { performance } from 'node:perf_hooks'
import { SALLE_ATTENDUE_MAX_MS, laisserPasserLaSalle, rendreLaMain } from '../src/core/tourniquet'
import { ceQuiTournait } from '../src/core/gels'
import { CampagneStore, MESURE_EN_AVANCE_MS, MESURES_GARDEES_MS, type PreparationDuTirage } from '../src/core/campagne'
import { BaseDeLaCampagne, type QuestionDeLaBase } from '../src/core/baseCampagne'

test('rendre la main : une étape par tour de boucle, dans l’ordre où elles l’ont demandé, et ce qui arrive entre deux est lu', async () => {
  // Rendue par `setImmediate` seul, la main repassait aux trois étapes dans
  // le même tour, l'une derrière l'autre : aucun message n'était lu avant la
  // troisième.
  const ordre: string[] = []
  const { port1, port2 } = new MessageChannel()
  port2.on('message', m => ordre.push(String(m)))
  try {
    const etape = async (nom: string) => {
      await rendreLaMain()
      ordre.push(nom)
      port1.postMessage(`lu après ${nom}`)
    }
    await Promise.all([etape('a'), etape('b'), etape('c')])
    await rendreLaMain()
    assert.deepEqual(ordre, ['a', 'lu après a', 'b', 'lu après b', 'c', 'lu après c'])
  } finally {
    port1.close()
  }
})

const MAINTENANT = Date.UTC(2026, 9, 19, 9)

/** Ce que l'épreuve relit du magasin : ses étapes lourdes, et les caches qu'elles remplissent. */
type Prive = {
  famillesDe(base: BaseDeLaCampagne): unknown
  jouables(): Promise<readonly QuestionDeLaBase[]>
  famillesGardees: WeakMap<BaseDeLaCampagne, unknown>
  preparations: WeakMap<readonly QuestionDeLaBase[], PreparationDuTirage>
  referenceGardee: { mesure: unknown; modele: unknown } | null
}

/**
 * Un magasin de la campagne sur une base jetable, et le tour de boucle où
 * chacune de ses étapes lourdes a tourné : la famille de chaque question, la
 * part de chacune dans sa famille, la préparation du tirage — gardée —, la
 * série de référence — gardée. Un tour se compte d'un `setImmediate` qui se
 * repose à chaque tour : deux étapes du même tour liraient le même compte.
 * `observer`, et chaque question de la base dit le tour où on la lit — sa
 * classification (`meta`) ou son empreinte, que lisent les calculs sur toute
 * la base (`lectures`) ; `questionsParTranche` règle les tranches du magasin.
 */
function magasinObserve({ observer = false, questionsParTranche }: { observer?: boolean; questionsParTranche?: number } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-fond-'))
  const horloge = { t: MAINTENANT }
  let tour = 0
  const lectures = new Map<number, Set<string>>()
  const lue = (id: string) => (lectures.get(tour) ?? lectures.set(tour, new Set()).get(tour)!).add(id)
  const essai = baseDEssai(300, { categories: ['Histoire', 'Sport', 'Nature'] })
  const base = observer
    ? new BaseDeLaCampagne(
        essai.questions.map(q => {
          const copie = { ...q }
          for (const champ of ['meta', 'empreinte'] as const) {
            const valeur = q[champ]
            Object.defineProperty(copie, champ, { enumerable: true, get: () => (lue(q.id), valeur) })
          }
          return copie
        }),
      )
    : essai
  const campagne = new CampagneStore(`file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`, undefined, {
    base,
    maintenant: () => horloge.t,
    ...(questionsParTranche !== undefined && { questionsParTranche }),
  })
  let tourne = true
  const tourner = () => {
    tour++
    if (tourne) setImmediate(tourner)
  }
  setImmediate(tourner)
  const etapes: { quoi: string; tour: number }[] = []
  const prive = campagne as unknown as Prive
  const famillesDe = prive.famillesDe.bind(campagne)
  prive.famillesDe = base => {
    const neuves = !prive.famillesGardees.has(base)
    const familles = famillesDe(base)
    if (neuves) etapes.push({ quoi: 'familles', tour })
    return familles
  }
  // La préparation du tirage et la série de référence, au tour où elles se gardent : d'une traite sur le chemin d'un
  // tirage, ou au bout de leurs tranches en fond.
  const preparations = prive.preparations
  const garder = preparations.set.bind(preparations)
  preparations.set = (jouables, preparee) => {
    if (preparations.get(jouables) !== preparee) etapes.push({ quoi: 'préparation du tirage', tour })
    return garder(jouables, preparee)
  }
  let reference = prive.referenceGardee
  Object.defineProperty(campagne, 'referenceGardee', {
    configurable: true,
    get: () => reference,
    set: (v: Prive['referenceGardee']) => {
      if (v !== reference) etapes.push({ quoi: 'série de référence', tour })
      reference = v
    },
  })
  // La part de chaque question dans sa famille s'écrit dans la mesure gardée (`parQuestion`).
  let gardee: object | null = null
  Object.defineProperty(campagne, 'mesuresGardees', {
    configurable: true,
    get: () => gardee,
    set: (v: object | null) => {
      gardee =
        v &&
        new Proxy(v, {
          set(cible, cle, valeur) {
            if (cle === 'parQuestion') etapes.push({ quoi: 'en famille', tour })
            return Reflect.set(cible, cle, valeur)
          },
        })
    },
  })
  return {
    campagne,
    prive,
    horloge,
    etapes,
    lectures,
    fermer() {
      tourne = false
      campagne.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

/** Attend qu'une condition tienne — une machine chargée ne fait que la retarder. */
async function quand(condition: () => boolean, message: string) {
  const fin = Date.now() + 10_000
  while (!condition()) {
    if (Date.now() > fin) assert.fail(message)
    await new Promise(r => setTimeout(r, 5))
  }
}

/** Aucune étape lourde n'a partagé son tour de boucle avec une autre. */
function uneParTour(etapes: readonly { quoi: string; tour: number }[], attendues: readonly string[]) {
  for (const quoi of attendues) assert.ok(etapes.some(e => e.quoi === quoi), `${quoi} : faite (${JSON.stringify(etapes)})`)
  const parTour = new Map<number, string[]>()
  for (const e of etapes) parTour.set(e.tour, [...(parTour.get(e.tour) ?? []), e.quoi])
  const ensemble = [...parTour.values()].filter(q => q.length > 1)
  assert.deepEqual(ensemble, [], `des étapes lourdes dans le même tour de boucle : ${JSON.stringify(etapes)}`)
}

test('au réveil, la campagne prépare ses tirages et son modèle une étape lourde par tour de boucle', async () => {
  const { campagne, etapes, fermer } = magasinObserve()
  try {
    await campagne.init()
    const t0 = performance.now()
    campagne.prechauffer()
    await quand(() => campagne.santeDuSavoir().ajusteLe !== null, 'le modèle du savoir s’ajuste en fond')
    uneParTour(etapes, ['familles', 'en famille', 'préparation du tirage', 'série de référence'])
    // Chacun sous son nom, pour les gels du serveur (`core/gels.ts`).
    const noms = ceQuiTournait(t0, performance.now()).map(c => c.quoi)
    for (const nom of ['fond · base de la campagne', 'fond · journal des réponses', 'fond · mesure des difficultés', 'fond · modèle du savoir']) {
      assert.ok(noms.includes(nom), `${nom} : nommé (${noms.join(', ')})`)
    }
  } finally {
    fermer()
  }
})

test('au réveil, le préchauffage passe une étape après l’autre : le journal d’abord, puis la base, les bordures, les sujets et les tirages, les tas du Cabinet, le modèle', async () => {
  // Lancées ensemble, ses étapes se partageaient le dixième de cœur de l'hébergeur avec la page qui attendait le journal :
  // le 6 novembre 2026 à 6 h 52, un accueil a attendu 27,8 s ; le 7 à 0 h 29, 29,3 s (`retours/2026-11-08/`).
  const { campagne, fermer } = magasinObserve()
  try {
    await campagne.init()
    const prive = campagne as unknown as Record<string, (...a: unknown[]) => unknown> & { journal: { charge: boolean } }
    const ordre: string[] = []
    let journalLuAvantLaBase: boolean | null = null
    for (const nom of ['chargerLeJournal', 'base', 'toutesLesCotes', 'preparerEnFond', 'modeleDuSavoir']) {
      const avant = prive[nom].bind(campagne)
      prive[nom] = (...a: unknown[]) => {
        if (!ordre.includes(nom)) {
          ordre.push(nom)
          if (nom === 'base') journalLuAvantLaBase = prive.journal.charge
        }
        return avant(...a)
      }
    }
    // Les tas du Cabinet, que `server.ts` branche ici ; une étape ratée n'arrête pas les suivantes.
    campagne.baseRenouvelee = async () => {
      ordre.push('tas du Cabinet')
      throw new Error('les tas ne se préparent pas')
    }
    const prechauffage = campagne.prechauffer()
    assert.equal(campagne.prechauffer(), prechauffage, 'une fois par processus : appelé encore, la même promesse')
    await prechauffage
    assert.deepEqual(ordre, ['chargerLeJournal', 'base', 'toutesLesCotes', 'preparerEnFond', 'tas du Cabinet', 'modeleDuSavoir'])
    assert.equal(journalLuAvantLaBase, true, 'la base attend que le journal soit lu')
    await quand(() => campagne.santeDuSavoir().ajusteLe !== null, 'le modèle du savoir s’ajuste en fond, au bout')
  } finally {
    fermer()
  }
})

// Le modèle du savoir refait en fond prenait le dixième de cœur de
// l'hébergeur à la salle — 28,5 s au démarrage du 2 novembre 2026 : tant
// qu'une question attend ses réponses, il ne commence ni ne reprend.
test('le modèle du savoir laisse passer la question d’une soirée, puis s’ajuste', async () => {
  const { campagne, fermer } = magasinObserve()
  let enJeu = true
  let regards = 0
  campagne.salleEnJeu = () => {
    regards++
    return enJeu
  }
  try {
    await campagne.init()
    campagne.prechauffer()
    // Il a regardé la salle quatre fois, à un quart de seconde d'écart : de quoi
    // s'ajuster plusieurs fois sur cette base, une centaine de millisecondes.
    await quand(() => regards >= 4, 'le travail de fond regarde la salle')
    assert.equal(campagne.santeDuSavoir().ajusteLe, null, 'pas d’ajustement pendant la question')
    const pendant = performance.now()
    assert.ok(
      !ceQuiTournait(pendant, pendant).some(c => c.quoi === 'fond · modèle du savoir'),
      'en pause, il n’est d’aucun gel de la salle (`core/gels.ts`)',
    )
    enJeu = false
    await quand(() => campagne.santeDuSavoir().ajusteLe !== null, 'la question passée, le modèle s’ajuste')
    assert.ok(ceQuiTournait(pendant, performance.now()).some(c => c.quoi === 'fond · modèle du savoir'), 'reparti, il tourne de nouveau')
  } finally {
    fermer()
  }
})

test('une question laissée ouverte n’arrête pas le travail de fond pour la soirée', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  try {
    let passee = false
    const attente = laisserPasserLaSalle(() => true).then(() => {
      passee = true
    })
    // Le temps avance d'un quart de seconde à la fois ; entre deux, la boucle tourne pour de vrai.
    const avancer = async (ms: number) => {
      for (let t = 0; t < ms; t += 250) {
        mock.timers.tick(250)
        await new Promise(r => setImmediate(r))
      }
    }
    await avancer(SALLE_ATTENDUE_MAX_MS - 1_000)
    assert.equal(passee, false, 'la salle joue encore : il attend')
    await avancer(2_000)
    await attente
    assert.equal(passee, true, `au bout de ${SALLE_ATTENDUE_MAX_MS / 60_000} minutes, il reprend`)
  } finally {
    mock.timers.reset()
  }
})

test('la mesure relue en fond, dans ses deux dernières minutes : ses familles et la préparation de ses tirages, chacune à son tour', async () => {
  const { campagne, prive, horloge, etapes, fermer } = magasinObserve()
  try {
    await campagne.init()
    const jouables = await prive.jouables()
    const premiere = await campagne.mesures()
    etapes.length = 0
    // Une minute dans ses deux dernières minutes : encore bonne, elle se relit déjà.
    horloge.t += MESURES_GARDEES_MS - MESURE_EN_AVANCE_MS + 60_000
    assert.equal(await campagne.mesures(), premiere, 'qui la demande reçoit encore celle-ci')
    await quand(() => (prive.preparations.get(jouables)?.mesure ?? premiere) !== premiere, 'la mesure neuve, relue en fond, prépare ses tirages')
    uneParTour(etapes, ['en famille', 'préparation du tirage'])
  } finally {
    fermer()
  }
})

test('un dé tombé sur une mesure périmée : son tirage et la série de référence d’Automate, puis, en fond, les familles de la neuve et son tirage, chacun à son tour', async () => {
  const { campagne, prive, horloge, etapes, fermer } = magasinObserve()
  try {
    await campagne.init()
    const jouables = await prive.jouables()
    const premiere = await campagne.mesures()
    etapes.length = 0
    // Périmée d'une minute, sans personne : le dé joue sur la mesure qu'il y a, et la neuve se relit en fond — personne ne l'attend.
    horloge.t += MESURES_GARDEES_MS + 60_000
    await campagne.commencerUneRencontre('profil-du-de')
    await quand(() => (prive.preparations.get(jouables)?.mesure ?? premiere) !== premiere, 'la mesure neuve, relue en fond, prépare ses tirages')
    uneParTour(etapes, ['en famille', 'préparation du tirage', 'série de référence'])
    // Son écriture, qui part derrière la réponse, avant de fermer la base : la rencontre n'entre en mémoire qu'écrite.
    await quand(() => (campagne as unknown as { enCours: Map<string, unknown> }).enCours.has('profil-du-de'), 'la rencontre s’écrit')
  } finally {
    fermer()
  }
})

/** Le tour de boucle qui a lu le plus de questions, et combien. */
function auPlusParTour(lectures: ReadonlyMap<number, ReadonlySet<string>>): { n: number; tour: number } {
  let plus = { n: 0, tour: -1 }
  for (const [tour, lues] of lectures) if (lues.size > plus.n) plus = { n: lues.size, tour }
  return plus
}

// Une étape lourde par tour ne suffisait pas : au dixième de cœur de
// l'hébergeur, chacune passait encore toute la base d'une traite — la mise en
// famille, la préparation du tirage, la série de référence, vingt-sept mille
// questions —, et la production gelait une demi-seconde à deux secondes sous
// les départs du Cabinet, la page des sentiers et le départ d'une épreuve (le
// relevé des gels du 2 novembre 2026). Chacune se fait en tranches : un tour
// de boucle ne lit pas plus d'une tranche de la base.
test('la mesure neuve, sa préparation du tirage et sa série de référence se font en tranches : un tour de boucle ne lit pas plus d’une tranche de la base', async () => {
  const TRANCHE = 40
  const { campagne, prive, horloge, lectures, fermer } = magasinObserve({ observer: true, questionsParTranche: TRANCHE })
  try {
    await campagne.init()
    const jouables = await prive.jouables()
    const premiere = await campagne.mesures()
    lectures.clear()
    horloge.t += MESURES_GARDEES_MS - MESURE_EN_AVANCE_MS + 60_000
    assert.equal(await campagne.mesures(), premiere, 'qui la demande reçoit encore celle-ci')
    await quand(() => {
      const preparee = prive.preparations.get(jouables)
      return preparee !== undefined && preparee.mesure !== premiere && prive.referenceGardee?.mesure === preparee.mesure
    }, 'la mesure neuve, relue en fond, prépare ses tirages et sa série de référence — la page qui suit la trouve prête')
    const plus = auPlusParTour(lectures)
    assert.ok(plus.n > 0, 'la base s’est relue')
    assert.ok(plus.n <= TRANCHE, `${plus.n} questions lues dans un seul tour de boucle (au plus ${TRANCHE})`)
  } finally {
    fermer()
  }
})

// Une correction au QG refait la base — les corrections appliquées, ses index — et les familles de la mesure : vingt et
// quarante millisecondes d'une traite sur un vrai cœur, avant chaque page des signalements qui suivait (le 2 novembre
// 2026, une demi-seconde de gel par geste au banc bridé).
test('une question reclassée au QG refait la base et les familles de la mesure en tranches', async () => {
  const TRANCHE = 40
  const { campagne, prive, lectures, fermer } = magasinObserve({ observer: true, questionsParTranche: TRANCHE })
  try {
    await campagne.init()
    const avant = await campagne.mesures()
    const [q] = await prive.jouables()
    const { categorie, sousTheme, difficulte } = q.meta
    await campagne.reclasser(q.id, { categorie, sousTheme, difficulte: difficulte === 5 ? 4 : difficulte + 1 })
    lectures.clear()
    const apres = await campagne.mesures()
    assert.notEqual(apres, avant, 'la mesure se remet en famille sur la base refaite')
    const plus = auPlusParTour(lectures)
    assert.ok(plus.n > 0, 'la base s’est refaite')
    assert.ok(plus.n <= TRANCHE, `${plus.n} questions lues dans un seul tour de boucle (au plus ${TRANCHE})`)
  } finally {
    fermer()
  }
})
