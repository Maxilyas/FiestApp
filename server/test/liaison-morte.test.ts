// Un geste touché dans une liaison morte : le vrai module du client
// (`client/src/socket.ts`), chargé dans Node, derrière un relais qui gèle
// la liaison sans la fermer (`relais.ts`).
//
// Le téléphone renvoyait une fois la réponse sans accusé, mais aussitôt, par
// la liaison que socket.io croyait vivante : le renvoi se perdait comme
// l'envoi, et la réponse n'arrivait jamais — « pas partie » à huit secondes,
// le bandeau à quinze. On sonde maintenant la liaison avant le renvoi :
// morte, elle est rouverte, et le renvoi part par la nouvelle. La console,
// elle, envoyait ses gestes sans accusé : « Révéler » touché à la
// télécommande au fond du jardin se perdait sans un mot, et la salle
// attendait. Il a maintenant son accusé, sa sonde et son renvoi.
//
// Chaque test a son propre serveur jetable, et sa propre instance du module.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  invite,
  lancerQuiz,
  patienter,
  qcm,
} from './banc'
import { relais } from './relais'

/** Ce que le test lit du module — écrit à la main : le typecheck du serveur ne suit pas le client. */
interface ModuleSocket {
  socket: {
    connected: boolean
    connect(): void
    disconnect(): void
    once(ev: string, fn: () => void): void
    io: { opts: { extraHeaders?: Record<string, string> } }
  }
  watchParty(slug: string): Promise<{ ok: boolean }>
  joinAsPlayer(slug: string, name?: string, avatar?: string): Promise<{ ok: boolean; token?: string; error?: string }>
  helloHost(): Promise<{ ok: boolean }>
  sendPlayerAction(sessionId: string, action: unknown, slug: string, token?: string): Promise<{ ok: boolean; reason?: string }>
  envoyerCommande(sessionId: string, command: unknown): void
}

/**
 * Une instance neuve du module, qui vise ce port comme la page visait son
 * adresse : le navigateur lui donnait `location`, un cookie et le réseau.
 */
async function moduleClient(port: number, instance: string): Promise<ModuleSocket> {
  Object.assign(globalThis, {
    location: new URL(`http://127.0.0.1:${port}/banc`),
    document: { addEventListener() {}, visibilityState: 'visible' },
    window: globalThis,
  })
  ;(globalThis as any).addEventListener ??= () => {}
  ;(globalThis as any).removeEventListener ??= () => {}
  Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })
  return await import(`${new URL('../../client/src/socket.ts', import.meta.url).href}?${instance}`)
}

async function relier(mod: ModuleSocket) {
  const connecte = new Promise<void>(r => mod.socket.once('connect', () => r()))
  mod.socket.connect()
  await connecte
}

test('une réponse touchée dans une liaison morte arrive sans qu’on la retouche', async () => {
  const banc = await demarrer()
  const r = await relais(banc.server.port)
  let mod: ModuleSocket | undefined
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Capitale de la France ?', ['Paris', 'Lyon'], 0, 60)])
    const host = await ecranCommun(banc.url, cookie)
    // Un autre invité, qui ne répond pas : la question ne se révèle pas d'elle-même.
    await invite(banc.url, 'Bob', '🐻')

    mod = await moduleClient(r.port, 'joueur')
    await relier(mod)
    assert.equal((await mod.watchParty('banc')).ok, true)
    const zoe = await mod.joinAsPlayer('banc', 'Zoé', '🦋')
    assert.equal(zoe.ok, true, zoe.error)

    const vueDuTelephone = attendre<any>(host, 'session:view', p => p.view.phase === 'question', 'la question', 15_000)
    const sessionId = await lancerQuiz(host, quiz)
    const { view } = await vueDuTelephone
    // Le téléphone a reçu sa vue par le relais : il sait la question ouverte.
    await patienter(300)

    // Le wifi reste accroché, mais plus rien ne passe.
    assert.ok(r.trouNoir() > 0)
    const debut = Date.now()
    const repondue = attendre<any>(
      host,
      'session:view',
      p => p.sessionId === sessionId && p.view.answeredCount === 1,
      'la réponse de Zoé, arrivée au serveur',
      14_000,
    )
    const envoi = mod.sendPlayerAction(sessionId, { type: 'answer', choice: 0, qIndex: 0, round: view.round }, 'banc', zoe.token)
    await repondue
    // Le premier délai (4 s), la sonde (2 s), la reconnexion : bien avant le
    // battement de cœur manqué (18 s).
    assert.ok(Date.now() - debut < 12_000, `arrivée en ${Date.now() - debut} ms`)
    const ack = await envoi
    assert.ok(ack.ok || ack.reason === 'timeout', JSON.stringify(ack))
  } finally {
    mod?.socket.disconnect()
    await r.fermer()
    await banc.close()
  }
})

test('« Révéler » touché à la télécommande dans une liaison morte révèle quand même la question', async () => {
  const banc = await demarrer()
  const r = await relais(banc.server.port)
  let mod: ModuleSocket | undefined
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Capitale de la France ?', ['Paris', 'Lyon'], 0, 60)])
    // La télé, sur un réseau sain ; un invité qui ne répond pas.
    const tele = await ecranCommun(banc.url, cookie)
    await invite(banc.url, 'Bob', '🐻')

    // La télécommande : la page de la console, avec le cookie que le
    // navigateur joindrait à la poignée de main.
    mod = await moduleClient(r.port, 'telecommande')
    mod.socket.io.opts.extraHeaders = { Cookie: cookie }
    await relier(mod)
    assert.equal((await mod.helloHost()).ok, true)

    const question = attendre<any>(tele, 'session:view', p => p.view.phase === 'question', 'la question', 15_000)
    const sessionId = await lancerQuiz(tele, quiz)
    const { view } = await question

    assert.ok(r.trouNoir() > 0)
    const debut = Date.now()
    const revelee = attendre<any>(tele, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'reveal', 'la révélation', 14_000)
    mod.envoyerCommande(sessionId, { type: 'next', phase: 'question', qIndex: 0, round: view.round })
    await revelee
    assert.ok(Date.now() - debut < 10_000, `révélée en ${Date.now() - debut} ms`)
  } finally {
    mod?.socket.disconnect()
    await r.fermer()
    await banc.close()
  }
})
