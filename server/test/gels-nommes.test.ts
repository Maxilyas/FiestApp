// Ce qui tourne se nomme pour la sonde des gels (`core/gels.ts`). Le 4
// novembre 2026, la production relevait 1,8 s de gel « sans rien de nommé » à
// 13 h, et 1,5 s sous `POST /api/cabinet/traversee/:id/geste` sans rien pour
// dire si c'était le tirage, la conclusion ou les trophées de la traversée
// (`retours/2026-11-04/latences-du-cabinet.md`). Le travail qui partait sans
// nom — les tas du Cabinet derrière une page, le tour du flux du QG, le relevé
// du serveur, le rappel du soir, le point du matin — se nomme, et les étapes
// lourdes d'une traversée aussi : chacune le temps qu'elle tourne, pas plus.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { ceQuiTournait } from '../src/core/gels'
import { SanteDuServeur } from '../src/core/santeDuServeur'
import { RappelStore } from '../src/core/rappels'
import { LePointDuMatin } from '../src/core/pointDuMatin'
import type { ProfileStore } from '../src/auth/profiles'
import type { JourStore } from '../src/core/jour'
import { connexionAnimateur, demarrer, inscrireProfil } from './banc'
import { bancDuCabinet, jouer, lire, ok, poster, type Reponse } from './cabinet-banc'
import type { PageDeLaTraversee, VueDeLaPartie } from '../../shared/cabinet/vues'

const patienter = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Ce qui a tourné depuis cet instant, chaque nom une fois. */
const depuis = (debut: number) => ceQuiTournait(debut, performance.now()).map(c => c.quoi)

/** Ce qui a tourné pendant ce geste, de son départ à sa réponse. */
async function pendantLe<T>(geste: () => Promise<T>): Promise<{ r: T; noms: string[] }> {
  const debut = performance.now()
  const r = await geste()
  return { r, noms: depuis(debut) }
}

/** Plus rien sous ce nom à cet instant : il s'est tu avec sa fin. */
function tu(nom: string) {
  const t = performance.now()
  return !ceQuiTournait(t, t + 1).some(c => c.quoi === nom)
}

/** Attend qu'une condition tienne — une machine chargée ne fait que la retarder. */
async function quand(lire: () => boolean, message: string) {
  const fin = Date.now() + 10_000
  while (!lire()) {
    if (Date.now() > fin) assert.fail(message)
    await patienter(10)
  }
}

function dossier() {
  return mkdtempSync(path.join(tmpdir(), 'quizz-gels-nommes-'))
}

test('une traversée nomme ses étapes lourdes : les tas, le tirage d’une épreuve, la fin de sa partie, sa conclusion, ses trophées', async () => {
  const b = await bancDuCabinet()
  try {
    const cookie = await inscrireProfil(b.banc.url, 'voyageuse', 'Voyageuse')
    const depart = await pendantLe(() => poster<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee', {}))
    // Le premier départ d'un processus prépare les tas que son Quiz lit : sous leur nom, plus sous la seule route.
    assert.ok(depart.noms.includes('fond · tas du Cabinet'), `les tas du premier départ (${depart.noms.join(', ')})`)
    const neuve = ok(depart.r, 'le départ').traversee!
    const t = ok(
      await poster<PageDeLaTraversee>(b, cookie, `/api/cabinet/traversee/${neuve.id}/geste`, { rang: neuve.rang, geste: { quoi: 'cartes', cartes: ['coup-d-oeil', 'echange', 'panacee'] } }),
      'les cartes',
    ).traversee!
    const etape = t.actes[0].etapes.find(e => t.atteignables.includes(e.id) && e.sorte === 'epreuve')!
    const entree = await pendantLe(() =>
      poster<PageDeLaTraversee>(b, cookie, `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'aller', etape: etape.id, ...(etape.choix && { theme: 0 }) } }),
    )
    assert.ok(entree.noms.includes('POST /api/cabinet/traversee/:id/geste'), 'la route, comme toujours')
    assert.ok(entree.noms.includes('cabinet · tirage d’une épreuve'), `le tirage, d'un seul tenant (${entree.noms.join(', ')})`)
    assert.ok(!entree.noms.includes('fond · tas du Cabinet'), 'ses tas sont prêts : rien ne se refait')
    assert.ok(tu('cabinet · tirage d’une épreuve'), 'il se tait avec le tirage')

    const partie = ok(entree.r, 'l’entrée').traversee!.partie! as VueDeLaPartie
    const quittee = await pendantLe(() => jouer(b, cookie, partie, { quoi: 'quitter' }))
    ok(quittee.r as Reponse<VueDeLaPartie>, 'quitter')
    assert.ok(quittee.noms.includes('cabinet · fin d’une partie'), `sa fin passe par le rituel de la campagne (${quittee.noms.join(', ')})`)

    const carte = await pendantLe(() => lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee'))
    assert.ok(carte.noms.includes('cabinet · conclusion d’une épreuve'), `la page de la carte la conclut (${carte.noms.join(', ')})`)
    assert.ok(carte.noms.includes('cabinet · trophées d’une traversée'), 'puis range les défis de ses cartes')
    assert.ok(tu('cabinet · conclusion d’une épreuve') && tu('cabinet · trophées d’une traversée'), 'et tous deux se taisent avec elle')

    const apres = ok(carte.r, 'la carte').traversee!
    const abandon = await pendantLe(() => poster<PageDeLaTraversee>(b, cookie, `/api/cabinet/traversee/${apres.id}/geste`, { rang: apres.rang, geste: { quoi: 'abandonner' } }))
    assert.ok(ok(abandon.r, 'abandonner').traversee?.fin, 'abandonnée, elle est finie')
    assert.ok(abandon.noms.includes('cabinet · trophées d’une traversée'), `toute fin range ses paliers sous ce nom (${abandon.noms.join(', ')})`)

    // Un geste sans rien à ranger ne s'en couvre pas : le nom dirait un travail qui n'a pas eu lieu.
    const autre = ok(await poster<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee', {}), 'une autre').traversee!
    const choix = await pendantLe(() =>
      poster<PageDeLaTraversee>(b, cookie, `/api/cabinet/traversee/${autre.id}/geste`, { rang: autre.rang, geste: { quoi: 'cartes', cartes: ['coup-d-oeil', 'echange', 'panacee'] } }),
    )
    ok(choix.r, 'ses cartes')
    assert.ok(!choix.noms.some(n => n.startsWith('cabinet · ')), `choisir ses cartes n'est aucune étape lourde (${choix.noms.join(', ')})`)
  } finally {
    await b.banc.close()
  }
})

test('les tas du Cabinet préparés derrière sa page se nomment : leur gel se comptait « sans rien de nommé »', async () => {
  // Le préchauffage de la page, comme en ligne : il part derrière sa réponse, quand plus aucune route ne tourne.
  const b = await bancDuCabinet({ prechauffageAuProfil: true })
  try {
    const cookie = await inscrireProfil(b.banc.url, 'curieuse', 'Curieuse')
    const debut = performance.now()
    ok(await lire(b, cookie, '/api/cabinet/traversee'), 'la page')
    await quand(() => depuis(debut).includes('fond · tas du Cabinet'), 'les tas se préparent en fond, sous leur nom')
    await quand(() => tu('fond · tas du Cabinet'), 'et le nom se tait une fois les tas prêts')
  } finally {
    await b.banc.close()
  }
})

test('le tour du flux du QG se nomme, le temps du tour : la page restée ouverte n’est d’aucun gel', async () => {
  const banc = await demarrer({ fluxDuQgMs: 40 })
  try {
    const admin = await connexionAnimateur(banc.url)
    const arret = new AbortController()
    const debut = performance.now()
    const res = await fetch(`${banc.url}/api/admin/flux`, { headers: { Cookie: admin }, signal: arret.signal })
    assert.equal(res.status, 200)
    const lecteur = res.body!.getReader()
    const decodeur = new TextDecoder()
    let lu = ''
    // Trois messages : le premier, que la page reçoit sans attendre, et deux tours de la minuterie.
    while ((lu.match(/event: flux/g) ?? []).length < 3) lu += decodeur.decode((await lecteur.read()).value, { stream: true })
    const noms = depuis(debut)
    assert.ok(noms.includes('fond · flux du QG'), `chaque tour sous son nom (${noms.join(', ')})`)
    assert.ok(!noms.includes('GET /api/admin/flux'), 'la page ouverte, elle, reste hors du minutage')
    arret.abort()
    // Fermée, plus aucun tour : sa minuterie s'arrête avec le dernier abonné.
    await quand(() => {
      const t = performance.now()
      return !ceQuiTournait(t - 120, t).some(c => c.quoi === 'fond · flux du QG')
    }, 'le flux se tait une fois la page fermée')
  } finally {
    await banc.close()
  }
})

test('le relevé du serveur met ses heures en texte sous son nom, toutes les dix minutes', async () => {
  const dir = dossier()
  const sante = new SanteDuServeur(`file:${path.join(dir, 'permanente.db')}`, undefined, { releveMs: 3_600_000 })
  await sante.init()
  sante.demarrer({ demarreLe: Date.now(), pretEnMs: 1, version: null, env: 'test' })
  try {
    const debut = performance.now()
    await sante.relever()
    assert.ok(depuis(debut).includes('fond · relevé du serveur'), 'ses heures en texte, d’un seul tenant')
    assert.ok(tu('fond · relevé du serveur'), 'le temps de les écrire, pas celui de l’aller-retour')
  } finally {
    await sante.arreter()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('la tournée du rappel du soir se nomme, de son départ à son bilan', async () => {
  const dir = dossier()
  // Mercredi 4 novembre 2026, 18 h 30 à Paris : l'heure du rappel.
  const soir = Date.UTC(2026, 10, 4, 17, 30)
  // Aucun téléphone abonné : la tournée ne demande rien aux profils ni au quiz du jour.
  const rappels = new RappelStore(`file:${path.join(dir, 'permanente.db')}`, undefined, {
    profiles: {} as ProfileStore,
    jour: {} as JourStore,
    maintenant: () => soir,
    sujet: 'mailto:essai@example.com',
  })
  await rappels.init()
  try {
    const debut = performance.now()
    const tournee = rappels.tic()
    assert.ok(tournee, 'à 18 h 30, la tournée part')
    assert.ok(depuis(debut).includes('fond · rappel du soir'), 'nommée dès son départ')
    await tournee
    assert.ok(tu('fond · rappel du soir'), 'et tue avec son bilan')
  } finally {
    rappels.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('le point du matin se nomme, de son passage à sa notification', async () => {
  const dir = dossier()
  let lacher: () => void = () => {}
  const reglage = { actif: true, minutes: 8 * 60 + 40 }
  const point = new LePointDuMatin(`file:${path.join(dir, 'permanente.db')}`, undefined, {
    reglage: () => reglage,
    dOffice: () => reglage,
    // La mémoire de la veille, que son passage écrit : tenue le temps de lire le nom.
    aJour: () => new Promise<void>(r => (lacher = r)),
    memoireAJour: () => false,
    jours: async () => new Map(),
    incidents: async () => [],
    prevenir: async () => ({ envoyes: 0 }),
    // Mercredi 4 novembre 2026, 9 h à Paris : son heure est passée.
    maintenant: () => Date.UTC(2026, 10, 4, 8, 0),
    tourMs: null,
  })
  await point.init()
  try {
    const debut = performance.now()
    const tour = point.tour()
    assert.ok(tour, 'passé 8 h 40, le point part')
    assert.ok(depuis(debut).includes('fond · point du matin'), 'nommé dès son passage')
    lacher()
    await tour
    assert.ok(tu('fond · point du matin'), 'et tu avec sa fin')
  } finally {
    point.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
