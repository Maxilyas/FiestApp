// Après `host:hello`, plus aucune commande ne revérifie la session : seul
// `socket.data.isHost`, posé une fois (sockets.ts:678), est lu par
// `requireHost` (sockets.ts:700). La seule chose qui coupe un écran commun
// est une RÉVOCATION explicite (`onRevoke`, sockets.ts:154-158), déclenchée
// par une déconnexion, un mot de passe changé, un compte désactivé.
//
// L'EXPIRATION naturelle d'une session n'appelle jamais les écouteurs de
// révocation (store.ts:523 `resolveSession` supprime la session sans les
// prévenir ; aucun balayage périodique ne le fait). Conséquence : la session
// d'une télé branchée par appairage, plafonnée à 24 h (`fin_max`,
// invariant 16), n'expulse pas la connexion déjà ouverte. Tant que le socket
// tient (le battement de cœur socket.io le maintient sans reconnexion), la
// télé garde la main sur la soirée bien au-delà de ses 24 h — alors qu'elle
// ne pourrait plus se re-présenter.
//
// Ce test le prouve à la couture `wireSockets` : on présente l'écran commun
// avec une session valide, puis on fait « expirer » cette session (sans la
// révoquer), et une commande d'animateur passe encore.
//
// Lancer : cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//   ../export/evaluations/securite-temps-reel/host-sans-revalidation.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { wireSockets } from '../../../server/src/sockets'

test('un écran commun garde la main quand sa session expire sans être révoquée', async () => {
  // Une session valide au moment du hello, puis « expirée » (introuvable)
  // ensuite — comme une télé dont le `fin_max` est passé.
  let sessionValide = true
  const SESSION = { id: 'sess-tele', account: { id: 'espace-A', slug: 'chez-a', name: 'A', disabledAt: null } }

  const commandesRecues: string[] = []
  const runtime: any = {
    spaceId: 'espace-A',
    engine: {
      handleHostCommand: (_sid: string, cmd: any) => commandesRecues.push(cmd?.type ?? '?'),
      activeSessionId: null,
    },
    teams: { create: () => ({ id: 't1', name: 'Créée après expiration', emoji: '🍺' }) },
    broadcastSnapshot: () => {},
    poserScene: () => {},
    lancementDeQuiz: () => ({}),
    party: { count: () => 0 },
    // Ce que `host:hello` appelle après l'accusé.
    clotureAffichee: () => null,
    buildSnapshot: () => ({}),
  }
  runtime.engine.resendHostViews = () => {}

  const io: any = new EventEmitter()
  io.sockets = { sockets: new Map(), adapter: { rooms: new Map() } }
  io.to = () => ({ emit: () => {} })
  const revokeListeners: ((id: string) => void)[] = []
  const deps: any = {
    registry: { get: () => runtime, peek: () => runtime },
    profiles: { bySession: async () => null },
    auth: {
      onRevoke: (cb: (id: string) => void) => revokeListeners.push(cb),
      bySlug: () => SESSION.account,
      byId: () => SESSION.account,
      // Le cœur du test : valide au hello, introuvable ensuite — jamais révoquée.
      resolveSession: () => (sessionValide ? { account: SESSION.account, session: { id: SESSION.id, finMax: Date.now() + 1000 } } : null),
    },
    trustProxy: false,
    inscriptions: { prendre: () => true, compter: () => {}, clore: () => ({}) },
  }
  wireSockets(io, deps)

  const socket: any = new EventEmitter()
  const salons = new Set<string>()
  Object.assign(socket, {
    id: 'tele-1',
    data: {},
    handshake: { headers: { cookie: 'qz_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }, address: '127.0.0.1' },
    disconnected: false,
    join: (r: string) => salons.add(r),
    leave: (r: string) => salons.delete(r),
    disconnect: () => {
      socket.disconnected = true
    },
    // On garde l'`emit` d'EventEmitter : c'est le canal par lequel le test
    // déclenche les écouteurs (`host:hello`, `host:command`). Les `emit` que
    // le serveur destine au client tombent dans le vide, faute d'écouteur.
  })
  io.emit('connection', socket)

  // La télé se présente : session valide, elle devient écran commun.
  const hello = await new Promise<any>(resolve => socket.emit('host:hello', {}, resolve))
  assert.equal(hello.ok, true, 'la télé est acceptée au hello')
  assert.equal(socket.data.isHost, true)

  // Le lendemain : sa session a dépassé son plafond. Elle n'est pas révoquée
  // (personne n'appelle les écouteurs de révocation) — juste introuvable.
  sessionValide = false
  for (const cb of revokeListeners) cb('une-AUTRE-session') // le balayage ne la vise pas

  // Une commande d'animateur passe encore : `requireHost` ne relit que le
  // drapeau posé au hello.
  socket.emit('host:command', { sessionId: 'x', command: { type: 'next' } })
  await new Promise(r => setImmediate(r))

  // Observation d'aujourd'hui : la commande passe (le test échoue ici), parce
  // que rien ne recontrôle la session après le hello. Le jour où une garde
  // par commande (ou une coupure à l'expiration) sera posée, `commandesRecues`
  // restera vide et ce test passera.
  console.log('[host-sans-revalidation] commandes reçues après expiration =', JSON.stringify(commandesRecues))
  assert.deepEqual(
    commandesRecues,
    [],
    'une télé dont la session a expiré (sans être révoquée) ne devrait plus commander la soirée — ' +
      'aujourd’hui elle le fait encore (requireHost ne relit que socket.data.isHost)',
  )
})
