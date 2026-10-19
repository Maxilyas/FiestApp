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
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { MessageChannel } from 'node:worker_threads'
import { baseDEssai } from './banc'
import { rendreLaMain } from '../src/core/tourniquet'
import { CampagneStore, type PreparationDuTirage } from '../src/core/campagne'
import type { BaseDeLaCampagne, QuestionDeLaBase } from '../src/core/baseCampagne'
import type { MesureDUneQuestion } from '../../shared/campagne'

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
  tirage(jouables: readonly QuestionDeLaBase[], mesure: ReadonlyMap<string, MesureDUneQuestion>): PreparationDuTirage
  referencePour(...args: unknown[]): unknown
  jouables(): Promise<readonly QuestionDeLaBase[]>
  famillesGardees: WeakMap<BaseDeLaCampagne, unknown>
  preparations: WeakMap<readonly QuestionDeLaBase[], PreparationDuTirage>
  referenceGardee: unknown
}

/**
 * Un magasin de la campagne sur une base jetable, et le tour de boucle où
 * chacune de ses étapes lourdes a tourné : la famille de chaque question, la
 * part de chacune dans sa famille, la préparation du tirage, la série de
 * référence. Un tour se compte d'un `setImmediate` qui se repose à chaque
 * tour : deux étapes du même tour liraient le même compte.
 */
function magasinObserve() {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-fond-'))
  const horloge = { t: MAINTENANT }
  const campagne = new CampagneStore(`file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`, undefined, {
    base: baseDEssai(300, { categories: ['Histoire', 'Sport', 'Nature'] }),
    maintenant: () => horloge.t,
  })
  let tour = 0
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
  const tirage = prive.tirage.bind(campagne)
  prive.tirage = (jouables, mesure) => {
    const avant = prive.preparations.get(jouables)
    const preparee = tirage(jouables, mesure)
    if (preparee !== avant) etapes.push({ quoi: 'préparation du tirage', tour })
    return preparee
  }
  const referencePour = prive.referencePour.bind(campagne)
  prive.referencePour = (...args) => {
    const avant = prive.referenceGardee
    const reference = referencePour(...args)
    if (prive.referenceGardee !== avant) etapes.push({ quoi: 'série de référence', tour })
    return reference
  }
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
    campagne.prechauffer()
    await quand(() => campagne.santeDuSavoir().ajusteLe !== null, 'le modèle du savoir s’ajuste en fond')
    uneParTour(etapes, ['familles', 'en famille', 'préparation du tirage', 'série de référence'])
  } finally {
    fermer()
  }
})

test('la mesure relue en fond, dans ses deux dernières minutes : ses familles et la préparation de ses tirages, chacune à son tour', async () => {
  const { campagne, prive, horloge, etapes, fermer } = magasinObserve()
  try {
    await campagne.init()
    const jouables = await prive.jouables()
    const premiere = await campagne.mesures()
    etapes.length = 0
    horloge.t += 9 * 60_000
    assert.equal(await campagne.mesures(), premiere, 'qui la demande reçoit encore celle-ci')
    await quand(() => (prive.preparations.get(jouables)?.mesure ?? premiere) !== premiere, 'la mesure neuve, relue en fond, prépare ses tirages')
    uneParTour(etapes, ['en famille', 'préparation du tirage'])
  } finally {
    fermer()
  }
})

test('un dé tombé sur une mesure périmée : ses familles, son tirage et la série de référence d’Automate, chacun à son tour', async () => {
  const { campagne, horloge, etapes, fermer } = magasinObserve()
  try {
    await campagne.init()
    await campagne.mesures()
    etapes.length = 0
    // Onze minutes sans personne : la mesure se relit sur le chemin du dé.
    horloge.t += 11 * 60_000
    await campagne.commencerUneRencontre('profil-du-de')
    uneParTour(etapes, ['en famille', 'préparation du tirage', 'série de référence'])
    // Son écriture, qui part derrière la réponse, avant de fermer la base : la rencontre n'entre en mémoire qu'écrite.
    await quand(() => (campagne as unknown as { enCours: Map<string, unknown> }).enCours.has('profil-du-de'), 'la rencontre s’écrit')
  } finally {
    fermer()
  }
})
