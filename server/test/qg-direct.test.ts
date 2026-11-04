// Le direct du QG (le QG 2, lot 3, le 4 novembre 2026 : « voir … sur du temps
// réel ») : ce que le serveur mesure au pas de dix secondes, la présence de
// chaque mode et le fil de ce qui arrive, en mémoire, poussés par un flux
// (`GET /api/admin/flux`) toutes les deux secondes — rien vers Turso, rien
// d'un joueur nommé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { connexionAnimateur, demarrer, inscrireProfil } from './banc'
import { DirectDuServeur } from '../src/core/pouls'
import {
  CHEMIN_DU_FLUX,
  EVENEMENTS_DES_ROUTES,
  EVENEMENTS_DU_FIL,
  PAS_DU_DIRECT_MS,
  POINTS_DU_DIRECT,
  PRESENCE_MS,
  evenementsDesSoirees,
  fluxVide,
  modeDuDirect,
  recevoirLeFlux,
  type MessageDuFlux,
} from '../../shared/qgDirect'
import type { SoireeDuQg } from '../../shared/qg'

// L'application Express du serveur, attrapée à sa première requête, comme `admin-seulement.test.ts` : les routes du fil
// se relisent dans le routeur.
let application: { _router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } } | null = null
const traiter = (express as any).application.handle
;(express as any).application.handle = function (this: any, ...args: unknown[]) {
  application ??= this
  return traiter.apply(this, args)
}

const soiree = (spaceId: string, nom: string, plus: Partial<SoireeDuQg> = {}): SoireeDuQg => ({
  spaceId,
  salon: { nom, avatar: null },
  etat: 'en-cours',
  inscrits: 8,
  connectes: 7,
  depuis: 0,
  dernierSigne: 0,
  quizJoues: 0,
  partie: null,
  ecran: true,
  sauvegardeEnRetard: false,
  ...plus,
})

test('le fil des soirées : une soirée qui s’ouvre, un quiz qui commence puis finit, laissée en plan, close — des chiffres, rien du quiz', () => {
  const ouverte = soiree('a', 'Salon de Karim')
  assert.deepEqual(
    evenementsDesSoirees([], [ouverte]).map(f => f.texte),
    ['Salon de Karim · une soirée s’ouvre · 8 invités'],
  )
  const enJeu = soiree('a', 'Salon de Karim', { partie: { phase: 'question', quiz: 1, question: 3, questions: 20 } })
  assert.deepEqual(
    evenementsDesSoirees([ouverte], [enJeu]).map(f => f.texte),
    ['Salon de Karim · le quiz 1 commence · 7 téléphones'],
  )
  // Rien ne bouge d'une question à l'autre : le fil ne compte pas les questions.
  assert.deepEqual(evenementsDesSoirees([enJeu], [soiree('a', 'Salon de Karim', { partie: { phase: 'reveal', quiz: 1, question: 4, questions: 20 } })]), [])
  // Le quiz d'après, sans passer par l'entre-deux : l'un finit, l'autre commence.
  const deuxieme = soiree('a', 'Salon de Karim', { partie: { phase: 'question', quiz: 2, question: 0, questions: 10 } })
  assert.deepEqual(
    evenementsDesSoirees([enJeu], [deuxieme]).map(f => f.texte),
    ['Salon de Karim · le quiz 1 est fini', 'Salon de Karim · le quiz 2 commence · 7 téléphones'],
  )
  assert.deepEqual(
    evenementsDesSoirees([deuxieme], [soiree('a', 'Salon de Karim', { etat: 'en-plan' })]).map(f => f.texte),
    ['Salon de Karim · le quiz 2 est fini', 'Salon de Karim · laissée en plan'],
  )
  const faits = evenementsDesSoirees([ouverte], [])
  assert.deepEqual(faits, [{ sorte: 'soiree', mode: 'soiree', texte: 'Salon de Karim · la soirée est close' }])
})

test('le direct en mémoire : dix secondes par pas, quinze minutes au plus, les pas muets comblés, la charge reprise d’un pas à l’autre', () => {
  let t = 1_700_000_000_000 - (1_700_000_000_000 % PAS_DU_DIRECT_MS)
  const d = new DirectDuServeur(() => t)
  d.route('GET /api/jour', 120, 200)
  d.route('GET /api/jour', 80, 200)
  d.requete(200)
  d.requete(404)
  d.requete(500)
  d.base(30)
  d.charge({ processeur: 12.34, boucleMaxMs: 40, memoireMo: 180, invites: 5, tempsReel: 6 })
  d.erreur('POST /api/jour/repondre', 'SQLITE_BUSY')
  t += PAS_DU_DIRECT_MS
  const premier = d.lire()
  assert.equal(premier.points.length, 1)
  const p = premier.points[0]
  assert.deepEqual([p.requetes, p.refusees, p.enErreur, p.erreurs], [3, 1, 1, 1])
  assert.deepEqual([p.routes?.n, p.routes?.max, p.base?.n], [2, 120, 1])
  assert.deepEqual([p.processeur, p.boucleMaxMs, p.memoireMo, p.invites, p.tempsReel], [12.3, 40, 180, 5, 6])
  // Les invités connectés sont les joueurs des soirées.
  assert.equal(p.modes.soiree, 5)

  // Un pas sans relevé de charge — tombé de l'autre côté — reprend celle d'avant ; une erreur dite au fil par sa source et son code.
  t += PAS_DU_DIRECT_MS
  const deux = d.lire(premier.dernierPoint, premier.dernierRang)
  assert.equal(deux.points.length, 1)
  assert.equal(deux.points[0].processeur, 12.3)
  assert.deepEqual(premier.fil.map(e => e.texte), ['Erreur serveur · POST /api/jour/repondre · SQLITE_BUSY'])
  assert.deepEqual(deux.fil, [], 'le fil ne redit pas ce que la page a')

  // Vingt minutes de silence : quinze minutes de pas vides, pas plus, et la charge ne se reprend pas de si loin.
  t += 20 * 60_000
  const apres = d.lire()
  assert.equal(apres.points.length, POINTS_DU_DIRECT)
  assert.ok(apres.points.every((q, i) => i === 0 || q.a - apres.points[i - 1].a === PAS_DU_DIRECT_MS), 'le temps reste continu')
  assert.equal(apres.points.at(-1)!.processeur, null)
  assert.equal(apres.points.at(-1)!.requetes, 0)
})

test('la présence des modes : un profil compte cinq minutes dans son mode, une fois, et jamais sous son nom', () => {
  let t = 1_700_000_000_000 - (1_700_000_000_000 % PAS_DU_DIRECT_MS)
  const d = new DirectDuServeur(() => t)
  assert.equal(modeDuDirect('POST /api/jour/repondre'), 'jour')
  assert.equal(modeDuDirect('POST /api/campagne/defi'), 'campagne', 'le défi compte en campagne')
  assert.equal(modeDuDirect('POST /api/campagne/rencontre'), 'duel')
  assert.equal(modeDuDirect('GET /api/duels/joueurs'), 'duel', 'la page des duels aussi')
  assert.equal(modeDuDirect('POST /api/cabinet/traversee/:id/geste'), 'cabinet')
  assert.equal(modeDuDirect('GET /api/joueur/themes'), null, 'la boutique n’est pas un mode')
  assert.equal(modeDuDirect('GET /api/jour/reserve'), null)

  d.joueur('jour', 'p1')
  d.joueur('jour', 'p1')
  d.joueur('jour', 'p2')
  d.joueur('cabinet', 'p1')
  t += PAS_DU_DIRECT_MS
  const lu = d.lire()
  assert.deepEqual(lu.enCours.modes, { soiree: 0, campagne: 0, cabinet: 1, jour: 2, duel: 0 })
  assert.ok(!JSON.stringify(lu).includes('p1'), 'aucun profil ne sort du direct')
  t += PRESENCE_MS
  assert.deepEqual(d.lire().enCours.modes, { soiree: 0, campagne: 0, cabinet: 0, jour: 0, duel: 0 }, 'passé cinq minutes, il n’y est plus')
})

test('le fil compte ensemble ce qui tombe dans le même pas, garde les derniers, et redit ce qu’il recompte', () => {
  let t = 1_700_000_000_000
  const d = new DirectDuServeur(() => t)
  d.route('POST /api/jour/commencer', 50, 200)
  const vu = d.lire()
  d.route('POST /api/jour/commencer', 50, 200)
  d.route('POST /api/jour/commencer', 50, 409)
  d.route('POST /api/jour/commencer', 50, 200)
  const recompte = d.lire(vu.dernierPoint, vu.dernierRang)
  assert.equal(recompte.fil.length, 1, 'la même ligne, recomptée, revient avec un rang neuf')
  assert.deepEqual([recompte.fil[0].id, recompte.fil[0].n, recompte.fil[0].texte], [vu.fil[0].id, 3, 'Une partie du quiz du jour commence'])
  t += PAS_DU_DIRECT_MS + 1
  d.route('POST /api/jour/commencer', 50, 200)
  assert.equal(d.lire().fil.length, 2, 'un pas plus tard, une ligne neuve')
  for (let i = 0; i < EVENEMENTS_DU_FIL + 10; i++) d.evenement({ sorte: 'serveur', mode: null, texte: `Événement ${i}` })
  assert.equal(d.lire().fil.length, EVENEMENTS_DU_FIL)
})

test('la page tient le flux : un premier message la remet à zéro, les suivants ajoutent leurs pas et remplacent ce qui est recompté', () => {
  const point = (a: number) => ({ a, requetes: a, refusees: 0, enErreur: 0, erreurs: 0, routes: null, base: null, processeur: null, boucleMaxMs: null, memoireMo: null, invites: null, tempsReel: null, gels: 0, modes: { soiree: 0, campagne: 0, cabinet: 0, jour: 0, duel: 0 } })
  const premier: MessageDuFlux = { maintenant: 100, debut: true, points: [point(10), point(20)], enCours: point(30), fil: [{ id: 1, rang: 1, a: 5, sorte: 'profil', mode: null, texte: 'Un profil est né', n: 1 }], routes: [] }
  let etat = recevoirLeFlux(fluxVide(), premier)
  assert.deepEqual(etat.points.map(p => p.a), [10, 20])
  etat = recevoirLeFlux(etat, { maintenant: 110, points: [point(30)], enCours: point(40), fil: [{ id: 1, rang: 4, a: 9, sorte: 'profil', mode: null, texte: 'Un profil est né', n: 2 }] })
  assert.deepEqual(etat.points.map(p => p.a), [10, 20, 30])
  assert.deepEqual(etat.fil.map(e => [e.id, e.n]), [[1, 2]])
  // Un serveur redémarré renvoie un premier message : rien de l'ancien ne reste.
  etat = recevoirLeFlux(etat, { ...premier, points: [point(500)], fil: [] })
  assert.deepEqual(etat.points.map(p => p.a), [500])
  assert.deepEqual(etat.fil, [])
})

/** Lit les messages du flux, un à un, jusqu'à celui qui dit ce qu'on attend. */
async function lecteurDuFlux(url: string, cookie: string) {
  const arret = new AbortController()
  const res = await fetch(`${url}/api/admin/flux`, { headers: { Cookie: cookie }, signal: arret.signal })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /^text\/event-stream/)
  const lecteur = res.body!.getReader()
  const decodeur = new TextDecoder()
  let tampon = ''
  const messages: MessageDuFlux[] = []
  const suivant = async (): Promise<MessageDuFlux> => {
    for (;;) {
      const fin = tampon.indexOf('\n\n')
      if (fin >= 0) {
        const bloc = tampon.slice(0, fin)
        tampon = tampon.slice(fin + 2)
        const donnees = bloc.split('\n').find(l => l.startsWith('data: '))
        if (!donnees) continue
        const m = JSON.parse(donnees.slice(6)) as MessageDuFlux
        messages.push(m)
        return m
      }
      const { value, done } = await lecteur.read()
      if (done) throw new Error('le flux s’est fermé')
      tampon += decodeur.decode(value, { stream: true })
    }
  }
  const jusqua = async (pret: (m: MessageDuFlux) => boolean, delaiMs = 5_000) => {
    const limite = Date.now() + delaiMs
    for (;;) {
      const m = await suivant()
      if (pret(m)) return m
      if (Date.now() > limite) throw new Error('le flux n’a pas dit ce qu’on attendait')
    }
  }
  return { suivant, jusqua, messages, fermer: () => arret.abort(), fin: () => lecteur.read() }
}

test('le flux : le premier message porte tout, puis ce qui arrive — un profil né au fil, un joueur compté dans son mode — sans un nom', async () => {
  const banc = await demarrer({ fluxDuQgMs: 40 })
  try {
    const admin = await connexionAnimateur(banc.url)
    const flux = await lecteurDuFlux(banc.url, admin)
    const premier = await flux.suivant()
    assert.equal(premier.debut, true)
    assert.ok(premier.direct, 'le direct du poste de commande, d’emblée')
    assert.ok(premier.plafonds)
    assert.ok(premier.fil.some(e => e.sorte === 'serveur' && e.texte.startsWith('Le serveur démarre')))

    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const ne = await flux.jusqua(m => m.fil.some(e => e.texte === 'Un profil est né'))
    assert.ok(!JSON.stringify(ne).includes('Léa') && !JSON.stringify(ne).includes('lea'), 'le fil ne nomme personne')

    // Léa passe sur la campagne : elle y compte, sans que son nom parte.
    const r = await fetch(`${banc.url}/api/campagne/sentiers`, { headers: { Cookie: lea } })
    assert.equal(r.status, 200)
    const compte = await flux.jusqua(m => m.enCours.modes.campagne === 1)
    assert.ok(!JSON.stringify(compte).includes('Léa'))
    // Le direct ne repart que changé : l'instant et la durée de marche ne suffisent pas.
    const calmes = []
    for (let i = 0; i < 3; i++) calmes.push(await flux.suivant())
    assert.ok(calmes.filter(m => m.direct).length <= 1, 'le direct ne repart pas à chaque tour')
    flux.fermer()

    // Un animateur ordinaire, ou personne : refusé avant d'ouvrir quoi que ce soit.
    const sans = await fetch(`${banc.url}/api/admin/flux`)
    assert.equal(sans.status, 401)
  } finally {
    await banc.close()
  }
})

test('le serveur qui se ferme coupe le flux : une page restée ouverte ne retient pas sa fermeture', async () => {
  const banc = await demarrer({ fluxDuQgMs: 40 })
  const admin = await connexionAnimateur(banc.url)
  const flux = await lecteurDuFlux(banc.url, admin)
  await flux.suivant()
  const debut = Date.now()
  await banc.close()
  assert.ok(Date.now() - debut < 8_000, `fermé en ${Date.now() - debut} ms`)
  const { done } = await flux.fin().catch(() => ({ done: true }))
  assert.equal(done, true, 'la page voit le flux se fermer')
})

test('chaque route que le fil raconte existe sous ce modèle : renommée, elle s’y tairait', async () => {
  const banc = await demarrer()
  try {
    await connexionAnimateur(banc.url)
    assert.ok(application, 'l’application a servi la connexion')
    const routes = new Set(
      application._router.stack.flatMap(c => (c.route ? Object.keys(c.route.methods).map(m => `${m.toUpperCase()} ${c.route!.path}`) : [])),
    )
    for (const route of Object.keys(EVENEMENTS_DES_ROUTES)) assert.ok(routes.has(route), `${route} est une route du serveur`)
    // Le chemin que la page ouvre et que le serveur écarte de ce qui gèle est celui de la route.
    assert.ok(routes.has(`GET ${CHEMIN_DU_FLUX}`), `${CHEMIN_DU_FLUX} est la route du flux`)
  } finally {
    await banc.close()
  }
})

test('un appel du fil qui échoue ne raconte rien', () => {
  const d = new DirectDuServeur(() => 1_700_000_000_000)
  d.route('POST /api/joueur/inscription', 30, 409)
  d.route('POST /api/joueur/inscription', 30, 500)
  assert.deepEqual(d.lire().fil, [])
})
