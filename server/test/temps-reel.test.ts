// Le temps réel, là où une soirée rejouée d'un bout à l'autre ne va jamais :
// un message malformé, un téléphone qui se réveille avec une identité
// périmée, une connexion qui change d'identité, un invité exclu en pleine
// question, « Nouvelle soirée » avec des téléphones encore allumés — et une
// salle entière qui scanne le QR derrière la même box.
import { after, afterEach, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { io as clientIo } from 'socket.io-client'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  estimation,
  inscrireProfil,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { initDb } from '../src/core/db'
import { Party } from '../src/core/party'
import { ScoreLedger } from '../src/core/scores'
import { AnswerLog } from '../src/core/answers'
import { GameEngine } from '../src/core/engine'
import { quizModule } from '../src/games/quiz'
import { wireSockets } from '../src/sockets'
import type { GameModule } from '../src/core/types'

const SLUG = ADMIN.slug

let banc: Banc
let cookie: string

before(async () => {
  banc = await demarrer()
  cookie = await connexionAnimateur(banc.url)
})

after(async () => {
  await banc.close()
})

// Les tests de ce fichier partagent un serveur : un téléphone resté ouvert
// deviendrait participant du quiz du test suivant. Chacun referme donc les
// siens, même quand il échoue.
const aFermer: Socket[] = []
afterEach(async () => {
  for (const s of aFermer.splice(0)) s.close()
  await patienter(100)
})

/** Une connexion qu'on refermera à la fin du test. */
function tel(cookieProfil?: string): Socket {
  const s = connecter(banc.url, cookieProfil)
  aFermer.push(s)
  return s
}

/** Un invité qu'on refermera à la fin du test. */
async function invité(name: string, avatar: string): Promise<Invite> {
  const i = await invite(banc.url, name, avatar)
  aFermer.push(i.socket)
  return i
}

/** L'écran commun, qu'on refermera à la fin du test. */
async function ecran(): Promise<Socket> {
  const host = await ecranCommun(banc.url, cookie)
  aFermer.push(host)
  return host
}

/** Un téléphone qui se réveille : une connexion neuve, puis il se re-présente. */
async function reveil(charge: Record<string, unknown>, cookieProfil?: string) {
  const socket = tel(cookieProfil)
  const vu = await emitAck<{ ok: boolean }>(socket, 'party:watch', { slug: SLUG })
  assert.equal(vu.ok, true, 'la soirée doit se laisser suivre')
  const ack = await emitAck<any>(socket, 'player:join', { slug: SLUG, ...charge })
  return { socket, ack }
}

const envoyer = (s: Socket, event: string, ...args: unknown[]) => (s as any).emit(event, ...args)
const joueur = (snap: any, id: string) => snap.players.find((p: any) => p.id === id)

// ── 1. Un seul message ne doit jamais tuer le serveur ─────────────────────

test('aucun message malformé ne tue le serveur', async () => {
  const host = await ecran()
  const intrus = tel()

  // Des charges absentes, nulles ou d'un autre type, depuis un socket qui ne
  // s'est présenté à personne : les écouteurs `host:*` déstructuraient leur
  // charge AVANT de vérifier qui parlait, et socket.io les appelle hors de
  // toute promesse — une exception y arrêtait le processus, donc toutes les
  // soirées de tous les espaces.
  const AVEC_CHARGE = [
    'player:action',
    'player:setTeam',
    'host:command',
    'host:endSession',
    'host:renamePlayer',
    'host:removePlayer',
    'host:createTeam',
    'host:updateTeam',
    'host:removeTeam',
    'host:assignPlayer',
    'host:awardTeam',
    'host:removeBonus',
    'host:archiveParty',
  ]
  for (const event of AVEC_CHARGE) {
    envoyer(intrus, event)
    envoyer(intrus, event, null)
    envoyer(intrus, event, 42)
  }
  // Sans fonction d'accusé : « ack is not a function », et dans `player:join`
  // une promesse rejetée que personne n'attrapait.
  envoyer(intrus, 'party:watch', { slug: SLUG })
  envoyer(intrus, 'player:join', { slug: SLUG, name: 'Sans Accusé', avatar: '🐢' })
  envoyer(intrus, 'player:join', { slug: 'nulle-part' })
  envoyer(intrus, 'party:watch', { slug: 'nulle-part' })
  envoyer(intrus, 'host:hello', {})

  // Toute réponse d'invité reçoit un accusé, même quand elle ne ressemble à rien.
  const refus = await emitAck<any>(intrus, 'player:action', null)
  assert.equal(refus.ok, false, 'une réponse sans charge est refusée')
  assert.equal(typeof refus.error, 'string', '…avec un message')
  // Une charge oubliée : l'accusé arrive en premier argument, il doit servir quand même.
  const sansCharge = await new Promise<any>((resolve, reject) => {
    const delai = setTimeout(() => reject(new Error('accusé attendu en vain : réponse sans charge')), 3000)
    envoyer(intrus, 'player:action', (res: unknown) => {
      clearTimeout(delai)
      resolve(res)
    })
  })
  assert.equal(sansCharge.ok, false, 'une réponse sans charge du tout est refusée, et le dit')

  // Depuis l'écran commun lui-même, des champs du mauvais type.
  envoyer(host, 'host:createTeam', { name: 'Rouge', emoji: '🔴' })
  const rouge = (await instantane(host, s => s.teams.some((t: any) => t.name === 'Rouge'), 'l’équipe Rouge')).teams.find(
    (t: any) => t.name === 'Rouge',
  ).id
  envoyer(host, 'host:createTeam', { name: 5, emoji: 7 })
  envoyer(host, 'host:updateTeam', { teamId: rouge, name: 5, emoji: [] })
  envoyer(host, 'host:awardTeam', { teamId: rouge, points: 5, reason: 7 })
  envoyer(host, 'host:renamePlayer', { playerId: 5, name: {} })
  envoyer(host, 'host:assignPlayer', { playerId: [], teamId: {} })
  envoyer(host, 'host:command', { sessionId: 5, command: 'n’importe quoi' })

  // Et depuis un invité inscrit.
  const typé = await invité('Typé', '🐸')
  envoyer(typé.socket, 'player:setTeam', { teamId: 5 }, () => {})
  envoyer(typé.socket, 'player:join', { slug: SLUG, name: {}, avatar: [], token: 7, teamId: 9 }, () => {})
  envoyer(typé.socket, 'player:action', { sessionId: {}, action: 'x', slug: 5, token: [] }, () => {})

  await patienter(500)
  const sante = await fetch(`${banc.url}/healthz`)
  assert.equal(sante.status, 200, 'le serveur répond encore')

  // Un invité normal rejoint, et sa réponse passe.
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Toujours là ?')])
  const alice = await invité('Alice', '🦊')
  const sessionId = await lancerQuiz(host, quiz)
  await attendre(alice.socket, 'session:view', (p: any) => p.view.phase === 'question', 'la question')
  const ack = await emitAck<any>(alice.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
  assert.equal(ack.ok, true, 'la réponse d’un invité normal est retenue')
  envoyer(host, 'host:endSession', { sessionId })
  envoyer(host, 'host:removeTeam', { teamId: rouge })
})

test('une panne dans un écouteur finit au journal, et le client a quand même sa réponse', async () => {
  // Plus aucune charge ne fait lever d'exception de l'extérieur : c'est une
  // dépendance en panne qui en lève une ici, sur une connexion de papier.
  const io: any = new EventEmitter()
  io.sockets = { sockets: new Map(), adapter: { rooms: new Map() } }
  io.to = () => ({ emit: () => {} })
  const deps: any = {
    registry: { get: () => null, peek: () => undefined },
    profiles: { bySession: async () => null },
    auth: {
      onRevoke: () => {},
      bySlug: () => {
        throw new Error('base des comptes injoignable')
      },
    },
    trustProxy: false,
  }
  wireSockets(io, deps)
  const socket: any = new EventEmitter()
  Object.assign(socket, {
    id: 'papier',
    data: {},
    handshake: { headers: {}, address: '127.0.0.1' },
    disconnected: false,
    join: () => {},
    leave: () => {},
    disconnect: () => {},
  })
  io.emit('connection', socket)

  const journal: string[] = []
  const errorAvant = console.error
  console.error = (...args: unknown[]) => {
    journal.push(args.map(a => (a instanceof Error ? a.message : String(a))).join(' '))
  }
  try {
    // Dans la promesse d'un écouteur…
    const vu = await new Promise<any>(resolve => socket.emit('party:watch', { slug: SLUG }, resolve))
    assert.equal(vu.ok, false, 'le téléphone apprend que ça n’a pas marché')
    assert.match(vu.error, /réessaie/, 'avec un message qui dit quoi faire')
    // …comme en direct : une réponse d'invité a toujours son accusé.
    const accuse = await new Promise<any>(resolve =>
      socket.emit('player:action', { slug: SLUG, sessionId: 's', action: { type: 'answer', choice: 0 } }, resolve),
    )
    assert.equal(accuse.reason, 'error')
  } finally {
    console.error = errorAvant
  }
  assert.ok(
    journal.some(l => l.includes('party:watch') && l.includes('base des comptes injoignable')),
    `la panne est journalisée avec son événement (vu : ${journal.join(' | ')})`,
  )
  assert.ok(journal.some(l => l.includes('player:action')), 'celle de la réponse aussi')
})

// ── 2. La fiche du serveur fait foi ───────────────────────────────────────

test('un renommage survit au réveil du téléphone', async () => {
  const host = await ecran()
  const lourd = await invité('GrosLourd', '🐷')
  envoyer(host, 'host:renamePlayer', { playerId: lourd.playerId, name: 'Marc' })
  await instantane(host, s => joueur(s, lourd.playerId)?.name === 'Marc', 'le renommage')
  lourd.socket.close()

  // Une page restée sur l'ancienne version renvoie le prénom qu'elle avait retenu…
  const ancienne = await reveil({ name: 'GrosLourd', avatar: '🐷', token: lourd.token })
  assert.equal(ancienne.ack.ok, true)
  assert.equal(ancienne.ack.playerId, lourd.playerId, 'c’est bien le même invité')
  assert.equal(ancienne.ack.name, 'Marc', 'le prénom renvoyé par le téléphone ne réécrit rien')
  ancienne.socket.close()

  // …la nouvelle ne renvoie que son jeton.
  const neuve = await reveil({ token: lourd.token })
  assert.equal(neuve.ack.name, 'Marc')
  assert.equal(neuve.ack.avatar, '🐷')
  await patienter(300)
  assert.equal(joueur(await instantane(host), lourd.playerId).name, 'Marc', 'le mur dit toujours Marc')
})

test('un profil qui change d’avatar ne retrouve pas l’ancien au réveil du téléphone', async () => {
  const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🦊')
  const telephone = await reveil({}, zoe)
  assert.equal(telephone.ack.avatar, '🦊')

  const change = await ecrire(banc.url, '/api/joueur/moi', { avatar: '🐼' }, zoe, 'PUT')
  assert.equal(change.ok, true, 'le profil change d’avatar')
  // Sa tablette passe par l'entrée : elle déclare le profil tel qu'il est maintenant.
  const tablette = await reveil({}, zoe)
  assert.equal(tablette.ack.playerId, telephone.ack.playerId, 'un profil, un invité')
  assert.equal(tablette.ack.avatar, '🐼')

  // Le téléphone se réveille avec le vieux choix qu'il avait retenu.
  telephone.socket.close()
  const reveille = await reveil({ name: 'Zoé', avatar: '🦊', token: telephone.ack.token }, zoe)
  assert.equal(reveille.ack.playerId, telephone.ack.playerId)
  assert.equal(reveille.ack.avatar, '🐼', 'le réveil ne remet pas l’ancien avatar')
})

test('le jeton d’un exclu est refusé avec son motif, et personne n’est recréé', async () => {
  const host = await ecran()
  const exclu = await invité('Exclu', '🐍')
  const prevenu = attendre(exclu.socket, 'player:removed', () => true, 'le téléphone prévenu de son exclusion')
  envoyer(host, 'host:removePlayer', { playerId: exclu.playerId })
  await prevenu
  exclu.socket.close()
  await instantane(host, s => !joueur(s, exclu.playerId), 'l’exclusion')
  const avant = (await instantane(host)).players.length

  // Le téléphone dormait. Il se réveille avec son jeton — et, sur l'ancienne
  // page, avec le prénom qu'il avait retenu.
  const socket = tel()
  await emitAck(socket, 'party:watch', { slug: SLUG })
  // L'ancienne page ne lit pas le motif de l'accusé : ce signal-là est le
  // seul qui la ramène à l'entrée.
  const renvoyee = attendre<any>(socket, 'player:removed', () => true, 'l’ancienne page renvoyée à l’entrée')
  const ack = await emitAck<any>(socket, 'player:join', { slug: SLUG, name: 'Exclu', avatar: '🐍', token: exclu.token })
  assert.equal(ack.ok, false, 'un jeton qui ne désigne plus personne est refusé')
  assert.equal(ack.reason, 'unknown-token', 'avec son motif')
  assert.match(ack.error, /rejoins/i, 'et un message qui dit quoi faire')
  assert.equal((await renvoyee)?.reason, 'unknown-token')

  await patienter(300)
  const snap = await instantane(host)
  assert.equal(snap.players.length, avant, 'personne n’a été recréé')
  assert.ok(!snap.players.some((p: any) => p.name === 'Exclu'), 'l’exclu ne revient pas en silence')

  // L'entrée, elle, reste ouverte : une exclusion n'est pas un bannissement.
  const retour = await emitAck<any>(socket, 'player:join', { slug: SLUG, name: 'Exclu', avatar: '🐍' })
  assert.equal(retour.ok, true)
  assert.notEqual(retour.playerId, exclu.playerId)
})

// ── 3. Un exclu part avec ce qu'il avait laissé ───────────────────────────

test('un exclu qui avait répondu ne marque rien, et la salle ne l’attend pas', async () => {
  const host = await ecran()
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Qui est là ?', ['Moi', 'Personne'], 0, 20)])
  const xavier = await invité('Xavier', '🦁')
  const yvan = await invité('Yvan', '🐯')
  const anna = await invité('Anna', '🐨')
  const basile = await invité('Basile', '🐶')
  const sessionId = await lancerQuiz(host, quiz)
  await attendre(xavier.socket, 'session:view', (p: any) => p.view.phase === 'question', 'la question')
  const repondre = (i: Invite, choice: number) =>
    emitAck<any>(i.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })

  // Xavier répond juste, le premier — puis il est exclu.
  assert.equal((await repondre(xavier, 0)).ok, true)
  envoyer(host, 'host:removePlayer', { playerId: xavier.playerId })
  await instantane(host, s => !joueur(s, xavier.playerId), 'Xavier exclu')
  assert.equal((await repondre(anna, 0)).ok, true)
  assert.equal((await repondre(basile, 1)).ok, true)

  // Yvan n'a jamais répondu. Exclu à son tour, il était le dernier attendu :
  // la révélation part après le souffle, pas à la fin du chronomètre.
  const revelee = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal', 'la révélation sans attendre le chrono', 5000)
  envoyer(host, 'host:removePlayer', { playerId: yvan.playerId })
  const vue = (await revelee).view
  assert.deepEqual(vue.counts, [1, 1], 'la réponse de l’exclu ne compte plus')
  assert.equal(vue.answeredCount, 2)
  assert.equal(vue.participantCount, 2)
  assert.equal(vue.fastest?.name, 'Anna', 'le plus rapide est un invité encore là, pas « ??? »')
  envoyer(host, 'host:endSession', { sessionId })
})

test('un exclu ne vole pas le premier rang d’une estimation', async () => {
  const host = await ecran()
  const quiz = await creerQuiz(banc.url, cookie, [estimation('Combien de bougies ?', 100)])
  const zelie = await invité('Zélie', '🦄')
  const anna = await invité('Annabelle', '🐨')
  const basile = await invité('Basilic', '🐶')
  const sessionId = await lancerQuiz(host, quiz)
  await attendre(zelie.socket, 'session:view', (p: any) => p.view.phase === 'question', 'l’estimation')
  const proposer = (i: Invite, value: number) =>
    emitAck<any>(i.socket, 'player:action', { sessionId, action: { type: 'guess', value } })

  assert.equal((await proposer(zelie, 100)).ok, true, 'Zélie tombe pile')
  assert.equal((await proposer(anna, 90)).ok, true)
  envoyer(host, 'host:removePlayer', { playerId: zelie.playerId })
  await instantane(host, s => !joueur(s, zelie.playerId), 'Zélie exclue')

  const revelee = attendre<any>(anna.socket, 'session:view', p => p.view.phase === 'reveal', 'la révélation')
  const hote = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal', 'la révélation vue de l’écran commun')
  assert.equal((await proposer(basile, 50)).ok, true)
  const [chezAnna, chezHote] = await Promise.all([revelee, hote])
  // Sans l'exclue, l'écart typique de la salle est de 30, entre les 10
  // d'Annabelle et les 50 de Basilic : Annabelle touche 165. La réponse pile
  // de Zélie le ramenait à 10, et Annabelle à 115.
  assert.equal(chezAnna.view.yourPoints, 165, 'la réponse de l’exclue ne pèse plus sur les points des autres')
  assert.deepEqual(
    chezHote.view.guesses.map((g: any) => [g.name, g.rank]),
    [
      ['Annabelle', 1],
      ['Basilic', 2],
    ],
    'la proposition de l’exclue ne s’affiche plus, et Annabelle est la plus proche',
  )
  envoyer(host, 'host:endSession', { sessionId })
})

// ── 4. Une connexion, une identité ────────────────────────────────────────

test('une connexion rattachée deux fois ne compte qu’une fois, et sa coupure se voit', async () => {
  const host = await ecran()
  const leo = await invité('Léo', '🐵')
  leo.socket.close()
  await instantane(host, s => joueur(s, leo.playerId)?.connected === false, 'Léo parti')

  // Le téléphone se réveille : la réponse tapée pendant la coupure part avant
  // qu'il ait pu se re-présenter, et le rattache par son jeton…
  const socket = tel()
  const refus = await emitAck<any>(socket, 'player:action', {
    sessionId: 'aucune',
    slug: SLUG,
    token: leo.token,
    action: { type: 'answer', choice: 0 },
  })
  assert.equal(refus.reason, 'ended', 'rattaché, mais aucune partie en cours')
  // …puis la page se re-présente, sur la même connexion.
  const ack = await emitAck<any>(socket, 'player:join', { slug: SLUG, token: leo.token })
  assert.equal(ack.playerId, leo.playerId)
  await instantane(host, s => joueur(s, leo.playerId)?.connected === true, 'Léo revenu')

  socket.close()
  await instantane(host, s => joueur(s, leo.playerId)?.connected === false, 'Léo reparti pour de bon')
})

test('une connexion qui change d’identité quitte la précédente', async () => {
  const host = await ecran()
  const socket = tel()
  await emitAck(socket, 'party:watch', { slug: SLUG })
  const avant = await emitAck<any>(socket, 'player:join', { slug: SLUG, name: 'Avant', avatar: '🐙' })
  const apres = await emitAck<any>(socket, 'player:join', { slug: SLUG, name: 'Après', avatar: '🦉' })
  assert.ok(avant.ok && apres.ok)
  await instantane(
    host,
    s => joueur(s, avant.playerId)?.connected === false && joueur(s, apres.playerId)?.connected === true,
    'la connexion n’incarne plus que la seconde identité',
  )

  // L'animateur exclut la première : la connexion, qui n'est plus elle, ne
  // doit pas être renvoyée à l'entrée.
  let renvoyee = false
  socket.on('player:removed', () => {
    renvoyee = true
  })
  envoyer(host, 'host:removePlayer', { playerId: avant.playerId })
  await instantane(host, s => !joueur(s, avant.playerId), 'la première identité exclue')
  await patienter(300)
  assert.equal(renvoyee, false, 'l’exclusion d’une ancienne identité ne touche pas la nouvelle')
})

test('un profil ne tient qu’un seul joueur', async () => {
  const host = await ecran()
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦉')
  const telephone = await reveil({}, lea)
  assert.equal(telephone.ack.ok, true)

  // Une tablette entre sans compte…
  const tablette = tel()
  await emitAck(tablette, 'party:watch', { slug: SLUG })
  const anonyme = await emitAck<any>(tablette, 'player:join', { slug: SLUG, name: 'Tablette', avatar: '🐸' })
  assert.equal(anonyme.ok, true)
  // …puis se connecte au profil de Léa : la page rouvre sa connexion et se
  // re-présente avec son jeton.
  tablette.close()
  const connectee = await reveil({ token: anonyme.token }, lea)
  assert.equal(connectee.ack.playerId, telephone.ack.playerId, 'la tablette reprend le joueur du profil')

  await patienter(300)
  const snap = await instantane(host)
  assert.notEqual(joueur(snap, telephone.ack.playerId)?.niveau, undefined, 'Léa porte son niveau')
  assert.equal(joueur(snap, anonyme.playerId)?.niveau, undefined, 'l’invité de la tablette reste anonyme')
})

// ── 5. « Clore la soirée » ────────────────────────────────────────────────

test('« Clore la soirée » prévient les téléphones, et la suivante se rejoint', async () => {
  const host = await ecran()
  // Une soirée neuve : les invités des tests d'avant y restaient, déconnectés
  // mais classés. Annabelle et ses 200 points d'estimation passaient devant
  // Nina dès que sa réponse mettait plus d'un dixième de seconde à arriver —
  // un runner de CI chargé y suffisait, et elle finissait troisième.
  const efface = attendre<any>(host, 'toast', () => true, 'la soirée des tests d’avant effacée')
  envoyer(host, 'host:discardParty')
  assert.equal((await efface).kind, 'info')
  const nina = await invité('Nina', '🐱')
  await instantane(nina.socket, s => !!joueur(s, nina.playerId), 'Nina dans la salle')
  // Une question jouée : la soirée a une fin à raconter.
  const avant = await creerQuiz(banc.url, cookie, [qcm('Avant la clôture ?')])
  const joue = await lancerQuiz(host, avant)
  await attendre(nina.socket, 'session:view', (p: any) => p.sessionId === joue && p.view.phase === 'question', 'la question')
  const revelee = attendre<any>(host, 'session:view', p => p.sessionId === joue && p.view.phase === 'reveal', 'la révélation')
  const repondu = await emitAck<any>(nina.socket, 'player:action', { sessionId: joue, action: { type: 'answer', choice: 0 } })
  assert.equal(repondu.ok, true)
  await revelee
  // Ce que le téléphone sait de la salle à l'instant où il est prévenu : c'est
  // cette liste que lit l'entrée qui s'ouvrira après sa fin de soirée.
  const auSignal = new Promise<{ fin: any; salle: Promise<any> }>((resolve, reject) => {
    const delai = setTimeout(() => reject(new Error('délai dépassé en attendant : la fin de soirée sur le téléphone')), 8000)
    nina.socket.once('soiree:fin', (fin: any) => {
      clearTimeout(delai)
      resolve({ fin, salle: instantane(nina.socket) })
    })
  })
  envoyer(host, 'host:closeParty', {})
  const { fin, salle } = await auSignal
  // La salle vide arrive avant le signal : l'entrée prenait sinon l'identité
  // effacée du téléphone pour un homonyme, et changeait son avatar « déjà pris ».
  assert.equal((await salle).players.length, 0, 'la salle vide précède le signal')
  assert.equal(fin.nom, 'Nina', 'le téléphone reçoit sa soirée à lui')
  assert.equal(fin.rang, 1)

  // Sa connexion n'incarne plus personne : elle ne change pas d'équipe en fantôme.
  const equipe = await emitAck<any>(nina.socket, 'player:setTeam', { teamId: null })
  assert.equal(equipe.ok, false, 'plus d’identité sur cette connexion')
  // L'ancien jeton désigne la soirée close : un téléphone qui dormait
  // pendant la clôture y retrouve sa fin de soirée…
  const perime = await reveil({ token: nina.token })
  assert.equal(perime.ack.reason, 'soiree-close')
  assert.equal(perime.ack.fin?.nom, 'Nina', 'la même fin de soirée, pour le téléphone qui dormait')

  // …et l'entrée fait rejoindre la nouvelle soirée.
  const retour = await emitAck<any>(nina.socket, 'player:join', { slug: SLUG, name: 'Nina', avatar: '🐱' })
  assert.equal(retour.ok, true)
  assert.notEqual(retour.playerId, nina.playerId)
  await instantane(host, s => joueur(s, retour.playerId)?.connected === true, 'Nina dans la nouvelle soirée')

  // Le quiz suivant la compte parmi les participants.
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Nouvelle soirée ?')])
  const sessionId = await lancerQuiz(host, quiz)
  const snap = await instantane(host, s => s.session?.id === sessionId, 'le quiz lancé')
  assert.deepEqual(snap.session.participantIds, [retour.playerId])
  envoyer(host, 'host:endSession', { sessionId })
})

// ── 6. Les homonymes, recalculés quand il faut ────────────────────────────

test('les marques d’homonymie suivent les exclusions et les renommages', async () => {
  const host = await ecran()
  const c1 = await invité('Camille', '🦊')
  const c2 = await invité('Camille', '🦊')
  const c3 = await invité('Camille', '🦊')
  let snap = await instantane(host, s => [c1, c2, c3].every(c => joueur(s, c.playerId)), 'les trois Camille')
  assert.equal(joueur(snap, c1.playerId).nomAffiche, undefined)
  assert.equal(joueur(snap, c2.playerId).nomAffiche, 'Camille (2)')
  assert.equal(joueur(snap, c3.playerId).nomAffiche, 'Camille (3)')

  envoyer(host, 'host:removePlayer', { playerId: c1.playerId })
  snap = await instantane(host, s => !joueur(s, c1.playerId), 'la première Camille exclue')
  assert.equal(joueur(snap, c2.playerId).nomAffiche, undefined, 'la marque s’efface avec l’homonyme')
  assert.equal(joueur(snap, c3.playerId).nomAffiche, 'Camille (2)')

  envoyer(host, 'host:renamePlayer', { playerId: c2.playerId, name: 'Camille-Rose' })
  snap = await instantane(host, s => joueur(s, c2.playerId)?.name === 'Camille-Rose', 'le renommage')
  assert.equal(joueur(snap, c3.playerId).nomAffiche, undefined, 'plus d’homonyme, plus de marque')

  // La troisième porte des prénoms, celle qu'on oublie : la vue de partie.
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Qui répond vite ?')])
  const sessionId = await lancerQuiz(host, quiz)
  await attendre(c3.socket, 'session:view', (p: any) => p.view.phase === 'question', 'la question')
  const revelee = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal', 'la révélation')
  assert.equal(
    (await emitAck<any>(c3.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })).ok,
    true,
  )
  envoyer(host, 'host:command', { sessionId, command: { type: 'next' } })
  assert.equal((await revelee).view.fastest?.name, 'Camille', 'l’écran commun ne garde pas une marque périmée')
  envoyer(host, 'host:endSession', { sessionId })
})

test('l’invité que l’animateur change d’équipe l’apprend sur son téléphone, et lui seul', async () => {
  const host = await ecran()
  envoyer(host, 'host:createTeam', { name: 'Les Randonneurs', emoji: '⭐' })
  const snap = await instantane(host, s => s.teams.some((t: any) => t.name === 'Les Randonneurs'), 'l’équipe')
  const rando = snap.teams.find((t: any) => t.name === 'Les Randonneurs').id
  const nadia = await invité('Nadia', '🐯')
  const voisin = await invité('Voisin', '🐸')
  const toasts: any[] = []
  voisin.socket.on('toast', (t: any) => toasts.push(t))

  const place = attendre<any>(nadia.socket, 'toast', () => true, 'le toast du placement')
  envoyer(host, 'host:assignPlayer', { playerId: nadia.playerId, teamId: rando })
  assert.deepEqual(await place, {
    kind: 'info',
    message: `${ADMIN.name} t'a placé·e dans l'équipe ⭐ Les Randonneurs`,
  })

  const sortie = attendre<any>(nadia.socket, 'toast', () => true, 'le toast de la sortie')
  envoyer(host, 'host:assignPlayer', { playerId: nadia.playerId, teamId: null })
  assert.equal((await sortie).message, `${ADMIN.name} t'a sorti·e de ton équipe`)

  // Sans changement réel, rien : un second clic sur la même équipe ne
  // redit pas la nouvelle.
  const recus: any[] = []
  nadia.socket.on('toast', (t: any) => recus.push(t))
  envoyer(host, 'host:assignPlayer', { playerId: nadia.playerId, teamId: null })
  await patienter(300)
  assert.deepEqual(recus, [], 'une équipe inchangée ne se redit pas')
  assert.deepEqual(toasts, [], 'la nouvelle ne part qu’au téléphone concerné')
})

// ── 7. Les registres, sans serveur ────────────────────────────────────────

/** Une base locale jetable, pour les tests qui n'ont pas besoin d'un serveur. */
function baseJetable() {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-temps-reel-'))
  const db = initDb(path.join(dir, 'locale.db'))
  return {
    db,
    fermer() {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

test('le podium d’une grande salle se calcule sans faire attendre la salle', () => {
  const { db, fermer } = baseJetable()
  try {
    const party = new Party(db, 'podium')
    const ledger = new ScoreLedger(db, 'podium')
    const N = 200
    const ids: string[] = []
    for (let i = 0; i < N; i++) {
      // Des homonymes, comme dans une vraie salle : la marque doit se calculer.
      const rec = party.join(`Invité ${i % 70}`, ['🦊', '🐼', '🐸'][i % 3], undefined, null)
      if ('error' in rec) throw new Error(rec.error)
      ids.push(rec.id)
      ledger.award(rec.id, (i * 37) % 900, 'podium')
    }
    // Les deux lectures que le moteur offre aux vues (`ViewContext`).
    // Le mémo d'une diffusion, comme le moteur le pose : né avec elle.
    const memo = new Map<string, unknown>()
    const vctx = {
      playerName: (id: string) => party.nomAffiche(id) ?? '???',
      player: (id: string) => party.publicOne(id, ledger.total(id)),
      memo: <T>(key: string, compute: () => T): T => {
        if (!memo.has(key)) memo.set(key, compute())
        return memo.get(key) as T
      },
    }
    const totals = Object.fromEntries(ids.map(id => [id, ledger.total(id)]))
    const sess = {
      id: 'fin',
      spaceId: 'podium',
      status: 'running' as const,
      participantIds: ids,
      state: { phase: 'finished', pack: { id: 'p', title: 'Fin', questions: [] }, qIndex: 0, responses: {}, lastAwards: {}, totals, playFrom: {}, multiplier: 1 },
    }
    // Une rediffusion de fin de quiz : une vue par invité, et celle de l'écran commun.
    const debut = performance.now()
    for (const id of ids) JSON.stringify(quizModule.playerView(sess as any, id, vctx))
    const podium = quizModule.hostView(sess as any, vctx) as any
    const ms = performance.now() - debut
    assert.equal(podium.standings.length, N)
    // Mesuré avant la mémoire des marques : 2,9 s à 150 invités, 110 s à 500.
    assert.ok(ms < 1500, `podium rediffusé en ${Math.round(ms)} ms pour ${N} invités`)
  } finally {
    fermer()
  }
})

test('exclure un invité efface aussi son total en mémoire', () => {
  const { db, fermer } = baseJetable()
  try {
    const ledger = new ScoreLedger(db, 'exclusion')
    ledger.award('p1', 150, 'Q1')
    ledger.award('p2', 80, 'Q1')
    ledger.removePlayer('p1')
    assert.equal(ledger.total('p1'), 0)
    assert.equal(ledger.allTotals().has('p1'), false, 'plus de total fantôme')
    assert.equal(ledger.total('p2'), 80, 'les autres gardent le leur')
    assert.ok(!ledger.all().some(e => e.playerId === 'p1'), 'ni de ligne au journal')
    assert.equal(new ScoreLedger(db, 'exclusion').total('p1'), 0, 'et la base dit la même chose')
  } finally {
    fermer()
  }
})

test('un chronomètre qui lève une exception n’emporte pas le processus', async () => {
  const { db, fermer } = baseJetable()
  const journal: string[] = []
  const errorAvant = console.error
  console.error = (...args: unknown[]) => {
    journal.push(args.map(a => (a instanceof Error ? a.message : String(a))).join(' '))
  }
  try {
    const sonneries: string[] = []
    const module: GameModule = {
      createInitialState: () => ({}),
      onLaunch: (_sess, ctx) => ctx.setTimer('boum', 10),
      onTimer: (_sess, timerId, ctx) => {
        sonneries.push(timerId)
        if (timerId !== 'boum') return
        ctx.setTimer('ensuite', 10)
        throw new Error('révélation impossible')
      },
      onPlayerAction: () => {},
      playerView: () => ({}),
      hostView: () => ({}),
    }
    const engine = new GameEngine(
      {
        db,
        io: { to: () => ({ emit: () => {} }) } as any,
        spaceId: 'chrono',
        party: new Party(db, 'chrono'),
        ledger: new ScoreLedger(db, 'chrono'),
        answers: new AnswerLog(db, 'chrono'),
        onScoresChanged: () => {},
        onSessionChanged: () => {},
        onSessionEnded: () => {},
        onVerdict: () => {},
      },
      module,
    )
    engine.launch()
    await patienter(300)
    engine.stop()
    assert.deepEqual(sonneries, ['boum', 'ensuite'], 'la partie continue après la panne')
    assert.ok(
      journal.some(l => l.includes('boum') && l.includes('révélation impossible')),
      `la panne est journalisée avec son chronomètre (vu : ${journal.join(' | ')})`,
    )
  } finally {
    console.error = errorAvant
    fermer()
  }
})

// ── 8. Une salle entière derrière une seule adresse ───────────────────────

test('une salle derrière la même box entre, un robot non', async () => {
  // En ligne, l'adresse du client se lit dans l'en-tête du proxy : c'est le
  // seul moyen de jouer cinquante téléphones derrière une même box, et
  // l'adresse locale des tests échappe sinon à la limite.
  const enLigne = await demarrer({ online: true, publicUrl: 'http://localhost' })
  const ouverts: Socket[] = []
  const derriere = (ip: string) => {
    const s = clientIo(enLigne.url, { transports: ['websocket'], forceNew: true, extraHeaders: { 'x-forwarded-for': ip } })
    ouverts.push(s)
    return s
  }
  /** Des inscriptions depuis une adresse, trois par connexion : rend combien sont passées. */
  const inscrire = async (ip: string, n: number, prefixe: string) => {
    let passees = 0
    for (let i = 0; i < n; i += 3) {
      const s = derriere(ip)
      await emitAck(s, 'party:watch', { slug: SLUG })
      for (let j = i; j < Math.min(n, i + 3); j++) {
        const ack = await emitAck<any>(s, 'player:join', { slug: SLUG, name: `${prefixe} ${j}`, avatar: '🎲' })
        if (ack.ok) passees++
      }
    }
    return passees
  }
  try {
    const BOX = '203.0.113.7'
    // La première vague, quand le QR apparaît sur l'écran commun.
    assert.equal(await inscrire(BOX, 60, 'Invité'), 60, 'soixante invités derrière la box entrent d’un coup')
    // Le robot qui enchaîne depuis la même adresse, lui, est arrêté : il ne
    // passe plus qu'au rythme de la recharge, une inscription par seconde.
    const robot = await inscrire(BOX, 30, 'Robot')
    assert.ok(robot <= 10, `une rafale de plus depuis la même adresse est refusée (${robot} sur 30 passées)`)
    // Le voisin, sur une autre adresse, n'en pâtit pas.
    assert.equal(await inscrire('198.51.100.4', 3, 'Voisin'), 3)
  } finally {
    for (const s of ouverts) s.close()
    await enLigne.close()
  }
})
