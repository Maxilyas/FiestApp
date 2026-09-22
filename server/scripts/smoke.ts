// Test de bout en bout : boote un vrai serveur (base jetable) et rejoue le
// parcours complet d'une soirée — inscription, lancement d'un quiz, réponses,
// scoring de rapidité, révélation, classement, reconnexion par token.
// À lancer via `npm run smoke`.
import { io as clientIo, type Socket } from 'socket.io-client'
import { createClient } from '@libsql/client'
import Database from 'better-sqlite3'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createQuizServer } from '../src/server'
import { insertQuestions, moveQuestion, parseImportedQuestions } from '../../shared/library'
import { QuizStore } from '../src/core/quizStore'
import { finalRanking, rankTeams } from '../../shared/teams'
import { bestSample, clockOffset } from '../../shared/clock'
import { reviewFromDatabase, reviewFromServer, writeExport } from '../src/core/export'

function fail(msg: string): never {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg)
}

function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`ack timeout: ${event}`)), 5000)
    ;(socket as any).emit(event, payload, (res: T) => {
      clearTimeout(to)
      resolve(res)
    })
  })
}

function waitFor<T>(socket: Socket, event: string, pred: (p: T) => boolean, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`timeout en attendant : ${label}`)), 8000)
    const handler = (p: T) => {
      if (!pred(p)) return
      clearTimeout(to)
      socket.off(event, handler as any)
      resolve(p)
    }
    socket.on(event, handler as any)
  })
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'quizz-smoke-'))
const dbPath = path.join(tmpDir, 'test.db')
const quizDbUrl = `file:${path.join(tmpDir, 'quizzes.db').replace(/\\/g, '/')}`
/** Le compte administrateur du test : créé au premier démarrage, retrouvé au second. */
const ADMIN = { login: 'antoine', password: 'smoke-pass-1', slug: 'smoke', name: 'Antoine' }
/** Le nom de son espace dans l'adresse : celui que les invités donnent en se présentant. */
const SLUG = ADMIN.slug
const server = await createQuizServer({ port: 0, dbPath, admin: ADMIN, quizDbUrl })
const url = `http://localhost:${server.port}`
const connect = () => clientIo(url, { transports: ['websocket'] })
/** Suit une soirée sans y jouer, et rend son premier instantané. */
async function watch(socket: Socket, slug: string): Promise<any> {
  const first = waitFor<any>(socket, 'party:snapshot', () => true, `instantané de ${slug}`)
  const res = await emitAck<{ ok: boolean; error?: string }>(socket, 'party:watch', { slug })
  assert(res.ok, `suivre la soirée « ${slug} » : ${res.error}`)
  return first
}
/** Un écran commun : il se présente avec le cookie de session de l'animateur. */
const connectHost = (base: string, cookie: string) =>
  clientIo(base, { transports: ['websocket'], extraHeaders: { Cookie: cookie } })
/** Une écriture telle que la page la ferait : avec l'en-tête maison qui la distingue d'un formulaire piégé. */
const write = (base: string, path: string, body: unknown, cookie?: string, method = 'POST') =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })
const cookieOf = (res: Response) => {
  const m = /qz_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')
  assert(m, 'la réponse doit poser le cookie de session')
  return `qz_session=${m[1]}`
}

/** Se connecte par HTTP et rend le cookie de session, tel que le navigateur le renverrait. */
async function loginAs(base: string, login: string, password: string): Promise<string> {
  const res = await write(base, '/api/auth/login', { login, password })
  assert(res.ok, `connexion de ${login} refusée (${res.status})`)
  return cookieOf(res)
}

try {
  // 0. Analyse d'un collage de questions (fonction pure, aucun serveur requis)
  const imported = parseImportedQuestions(
    [
      'Quelle danse Romane préfère-t-elle ?',
      '* La salsa',
      'Le tango',
      '',
      'Combien de cours a-t-elle pris ?',
      '= 42 cours',
      '',
      'Question sans bonne réponse marquée',
      'Une réponse',
      'Une autre',
      '',
      'Bloc inexploitable',
    ].join('\n'),
  )
  assert(imported.questions.length === 3, `3 questions attendues, ${imported.questions.length} reconnues`)
  assert(imported.questions[0].correct === 0, 'l’étoile doit désigner la bonne réponse')
  assert(imported.questions[0].answers[1] === 'Le tango', 'les réponses suivantes doivent être conservées')
  assert(imported.questions[1].kind === 'number', 'le signe égal doit créer une estimation')
  assert(imported.questions[1].target === 42 && imported.questions[1].unit === 'cours', 'valeur ou unité mal lue')
  assert(imported.unmarked === 1, 'la question sans étoile doit être signalée')
  assert(imported.ignored === 1, 'le bloc inexploitable doit être compté comme ignoré')

  // 0 bis. L'écart d'horloge. Les échéances sont des instants du serveur, et
  //        chaque écran les comparait à la sienne : un téléphone qui retardait
  //        de cinq secondes affichait cinq secondes qui n'existaient plus, et
  //        son porteur répondait après la clôture.
  //
  //        Serveur en avance de 5 s, aller-retour de 200 ms : parti à 1000
  //        (heure locale), le serveur répond à 6100 (son heure, au milieu de
  //        l'aller-retour), la réponse arrive à 1200. L'écart vaut 5000.
  assert(
    clockOffset({ serverTime: 6100, sentAt: 1000, receivedAt: 1200 }) === 5000,
    'l’écart d’horloge doit compenser la moitié de l’aller-retour',
  )
  // Horloges d'accord, réseau lent : l'écart reste nul.
  assert(
    clockOffset({ serverTime: 1400, sentAt: 1000, receivedAt: 1800 }) === 0,
    'un réseau lent ne doit pas créer d’écart là où il n’y en a pas',
  )
  // On ne garde que la mesure la plus rapide : elle laisse moins de place à
  // l'asymétrie du réseau, donc moins d'erreur.
  const lent = { serverTime: 6500, sentAt: 1000, receivedAt: 2000 }
  const vif = { serverTime: 6100, sentAt: 1000, receivedAt: 1200 }
  assert(bestSample(lent, vif) === vif, 'la mesure la plus rapide doit l’emporter')
  assert(bestSample(vif, lent) === vif, 'une mesure plus lente ne doit pas détrôner la précédente')
  // Sans mesure précédente, la nouvelle s'impose : c'est ce qui permet à une
  // reconnexion de repartir propre si le téléphone s'est resynchronisé.
  assert(bestSample(null, lent) === lent, 'la première mesure d’une connexion fait autorité')

  // Réordonner : la question prend exactement le numéro demandé, qu'elle
  // monte ou qu'elle descende ; hors bornes, c'est « en tête » ou « à la fin ».
  const ordre = ['a', 'b', 'c', 'd', 'e']
  assert(moveQuestion(ordre, 2, 5).join('') === 'abdec', 'la question 3 envoyée en n° 5 doit porter le 5')
  assert(moveQuestion(ordre, 4, 2).join('') === 'aebcd', 'la question 5 envoyée en n° 2 doit porter le 2')
  assert(moveQuestion(ordre, 0, 99).join('') === 'bcdea', 'un numéro trop grand doit envoyer à la fin')
  assert(moveQuestion(ordre, 3, -1).join('') === 'dabce', 'un numéro trop petit doit envoyer en tête')
  assert(moveQuestion(ordre, 1, 2.9).join('') === 'abcde', 'une décimale doit valoir sa partie entière')
  assert(
    moveQuestion(ordre, 2, 3) === ordre && moveQuestion(ordre, 2, Number.NaN) === ordre,
    'sans déplacement, le tableau doit être rendu tel quel',
  )
  assert(insertQuestions(ordre, 3, ['x', 'y']).join('') === 'abxycde', 'les questions insérées doivent prendre les numéros demandés')
  assert(insertQuestions(ordre, 42, ['x']).join('') === 'abcdex', 'insérer au-delà de la fin doit ajouter à la fin')
  assert(insertQuestions(ordre, 1, []) === ordre, 'rien à insérer : le tableau doit être rendu tel quel')

  // 1. Écran commun : il faut être connecté. Un mauvais mot de passe est
  //    refusé sans dire pourquoi, un formulaire sans l'en-tête maison aussi,
  //    et un socket sans session ne se présente pas.
  const badLogin = await write(url, '/api/auth/login', { login: ADMIN.login, password: 'mauvais' })
  assert(badLogin.status === 401, `mauvais mot de passe : ${badLogin.status} au lieu de 401`)
  const noHeader = await fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: ADMIN.login, password: ADMIN.password }),
  })
  assert(noHeader.status === 403, 'une écriture sans l’en-tête maison doit être refusée (anti-CSRF)')
  const cookie = await loginAs(url, ADMIN.login, ADMIN.password)
  const stranger = connect()
  const strangerHello = await emitAck<{ ok: boolean }>(stranger, 'host:hello', {})
  assert(!strangerHello.ok, 'host:hello accepté sans session')
  stranger.disconnect()

  const host = connectHost(url, cookie)
  // Les refus du serveur arrivent en « toast » : sans cette écoute, un test
  // qui échoue affiche « timeout » au lieu de la vraie raison.
  host.on('toast', (t: any) => console.log(`   ⚠️  toast host : ${t.message}`))
  const hello = await emitAck<{ ok: boolean; slug?: string }>(host, 'host:hello', {})
  assert(hello.ok && hello.slug === ADMIN.slug, 'host:hello refusé avec une session valable')

  // 1 bis. Garde-fous. Cinq présentations refusées coupent la connexion : la
  //        force brute retombe à la vitesse d'une poignée de main réseau.
  const brute = connect()
  await new Promise<void>(r => brute.on('connect', () => r()))
  const cut = new Promise<void>(r => brute.on('disconnect', () => r()))
  for (let i = 0; i < 5; i++) (brute as any).emit('host:hello', {}, () => {})
  await Promise.race([cut, new Promise((_, rej) => setTimeout(() => rej(new Error('connexion non coupée après 5 présentations refusées')), 3000))])

  // Une connexion ne crée pas d'identités à la chaîne, et un avatar n'est pas
  // une charge utile : cinq mille caractères ont été rediffusés à toute la
  // salle un jour.
  const troll = connect()
  const trollIds: string[] = []
  for (const name of ['Zed', 'Zoé', 'Zia']) {
    const ack = await emitAck<any>(troll, 'player:join', { slug: SLUG, name, avatar: 'X'.repeat(5000) })
    assert(ack.ok, `inscription de ${name} refusée`)
    trollIds.push(ack.playerId)
  }
  const fourth = await emitAck<any>(troll, 'player:join', { slug: SLUG, name: 'Zack', avatar: '🤖' })
  assert(!fourth.ok, 'une même connexion ne doit pas créer une quatrième identité')
  const seen = await waitFor<any>(host, 'party:snapshot', s => s.players.some((p: any) => p.name === 'Zed'), 'troll inscrit')
  const zed = seen.players.find((p: any) => p.name === 'Zed')
  assert([...zed.avatar].length <= 4, `avatar non borné : ${zed.avatar.length} caractères diffusés`)
  // Le ménage : ces identités n'ont rien à faire dans la suite du test.
  const trollGone = waitFor<any>(host, 'party:snapshot', s => s.players.length === 0, 'trolls exclus')
  for (const id of trollIds) (host as any).emit('host:removePlayer', { playerId: id })
  troll.disconnect()
  await trollGone

  // 2. Deux invités rejoignent depuis leur téléphone
  const alice = connect()
  const bob = connect()
  bob.on('toast', (t: any) => console.log(`   ⚠️  toast Bob : ${t.message}`))
  const aliceAck = await emitAck<any>(alice, 'player:join', { slug: SLUG, name: 'Alice', avatar: '🦊' })
  const bobAck = await emitAck<any>(bob, 'player:join', { slug: SLUG, name: 'Bob', avatar: '🐸' })
  assert(aliceAck.ok && bobAck.ok, 'join joueur échoué')

  // 3. Lancement d'un quiz + choix du pack
  const here = path.dirname(fileURLToPath(import.meta.url))
  const packRaw = JSON.parse(readFileSync(path.join(here, '../content/quiz/culture-generale.json'), 'utf8'))
  const q0 = packRaw.questions[0]

  const quizSeen = waitFor<any>(alice, 'session:view', () => true, 'vue quiz chez Alice')
  ;(host as any).emit('host:launch')
  const quizId = (await quizSeen).sessionId

  const hostPicks = waitFor<any>(host, 'session:view', p => p.view.phase === 'pickPack', 'liste des quiz côté host')
  const packs = (await hostPicks).view.packs
  assert(Array.isArray(packs) && packs.length > 0, 'aucun quiz proposé à l’animateur')

  ;(host as any).emit('host:command', { sessionId: quizId, command: { type: 'selectPack', packId: 'culture-generale' } })
  await waitFor<any>(alice, 'session:view', p => p.view.phase === 'question', 'phase question (après le 3-2-1)')

  // Changer d'équipe emporterait ses points d'une équipe à l'autre entre deux
  // questions : le serveur doit le refuser tant qu'un quiz tourne.
  const refus = await emitAck<any>(alice, 'player:setTeam', { teamId: null })
  assert(!refus.ok && refus.error, 'changement d’équipe accepté en pleine partie')

  // 4. Réponses : Alice juste (et la plus rapide), Bob faux → révélation immédiate
  const aliceReveal = waitFor<any>(alice, 'session:view', p => p.view.phase === 'reveal', 'reveal joueur')
  const hostReveal = waitFor<any>(host, 'session:view', p => p.view.phase === 'reveal', 'reveal host')
  // Le classement est diffusé au moment de la révélation : on écoute AVANT de répondre.
  const scoreSeen = waitFor<any>(
    bob,
    'party:snapshot',
    s => (s.players.find((p: any) => p.id === aliceAck.playerId)?.score ?? 0) > 0,
    'score d’Alice dans le classement de la soirée',
  )
  ;(alice as any).emit('player:action', { sessionId: quizId, action: { type: 'answer', choice: q0.correct } })
  ;(bob as any).emit('player:action', {
    sessionId: quizId,
    action: { type: 'answer', choice: (q0.correct + 1) % q0.answers.length },
  })
  const [aliceRv, hostRv] = await Promise.all([aliceReveal, hostReveal])
  assert(aliceRv.view.correct === q0.correct, 'mauvais index de bonne réponse côté joueur')
  assert(
    aliceRv.view.yourPoints > 100 && aliceRv.view.yourPoints <= 200,
    `points de rapidité inattendus : ${aliceRv.view.yourPoints}`,
  )
  const totalAnswers = hostRv.view.counts.reduce((a: number, b: number) => a + b, 0)
  assert(hostRv.view.counts[q0.correct] === 1 && totalAnswers === 2, 'distribution des réponses fausse côté host')
  assert(hostRv.view.fastest?.name === 'Alice', 'le plus rapide devrait être Alice')

  // 5. Le classement de la soirée (ledger) reflète les points gagnés
  const snap = await scoreSeen
  const aliceScore = snap.players.find((p: any) => p.id === aliceAck.playerId)?.score
  assert(
    aliceScore === aliceRv.view.yourPoints,
    `classement soirée à ${aliceScore}, attendu ${aliceRv.view.yourPoints}`,
  )
  assert(snap.session?.id === quizId, 'le snapshot doit exposer la partie en cours')
  assert(snap.session.participantIds.length === 2, '2 participants attendus dans la partie')

  // 6. Question suivante, puis révélation forcée par l'animateur (sans timer)
  ;(host as any).emit('host:command', { sessionId: quizId, command: { type: 'next' } })
  const q1 = (
    await waitFor<any>(alice, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === 1, 'question 2')
  ).view

  // 6 bis. L'accusé de réception d'une réponse, et le téléphone qui répond
  //        avant d'avoir fini de se reconnecter.
  //
  //        Des invités juraient avoir répondu sans que ça compte. Deux
  //        silences se cumulaient : `player:action` ne répondait rien, et une
  //        réponse tapée pendant une coupure arrivait sur un socket tout neuf
  //        — sans espace ni identité — parce que socket.io vide sa file
  //        d'attente avant que la page ait pu se re-présenter. Elle était
  //        jetée sans un mot. La réponse porte donc son espace et son jeton.
  const okAck = await emitAck<any>(alice, 'player:action', {
    sessionId: quizId,
    action: { type: 'answer', choice: 0 },
  })
  assert(okAck.ok, 'une réponse valable doit être accusée comme retenue')

  // Retaper la même case, c'est douter de soi, pas se tromper : le serveur
  // n'a rien à réécrire mais doit confirmer, sinon le doute reste entier.
  const sameAck = await emitAck<any>(alice, 'player:action', {
    sessionId: quizId,
    action: { type: 'answer', choice: 0 },
  })
  assert(sameAck.ok, 'la même réponse retapée doit être confirmée, pas refusée')

  const badAck = await emitAck<any>(alice, 'player:action', {
    sessionId: quizId,
    action: { type: 'answer', choice: 99 },
  })
  assert(!badAck.ok && badAck.reason === 'invalid', 'une case inexistante doit être refusée avec son motif')

  // Le cas qui perdait les réponses : un socket qui n'a jamais rien dit, armé
  // du seul jeton du téléphone. Sa réponse doit compter comme les autres.
  const ghost = connect()
  // La vue qui suit sa réponse est ce qu'on vient vérifier : on écoute avant
  // de l'envoyer. Rattacher l'identité sans rejoindre son salon laisserait le
  // joueur devant une case sans coche.
  const ghostView = waitFor<any>(ghost, 'session:view', p => p.sessionId === quizId, 'vue renvoyée au téléphone rebranché')
  const ghostAck = await emitAck<any>(ghost, 'player:action', {
    sessionId: quizId,
    slug: SLUG,
    token: aliceAck.token,
    action: { type: 'answer', choice: 1 },
  })
  assert(ghostAck.ok, `réponse perdue par un téléphone en cours de reconnexion : ${ghostAck.error}`)

  // Sans jeton ni espace, en revanche, le serveur ne peut que refuser — et le dire.
  const lost = connect()
  const lostAck = await emitAck<any>(lost, 'player:action', {
    sessionId: quizId,
    action: { type: 'answer', choice: 0 },
  })
  assert(!lostAck.ok && lostAck.reason === 'no-party', 'une réponse sans espace doit être refusée avec son motif')
  lost.disconnect()

  assert((await ghostView).view.yourChoice === 1, 'le téléphone rebranché doit voir sa réponse cochée')
  ghost.disconnect()

  // 6 ter. Le souffle avant la révélation.
  //
  //        Bob répond à son tour : la salle a fini. La révélation partait à cet
  //        instant même et coupait la parole aux réponses encore en vol — deux
  //        doigts posés ensemble aux deux bouts de la salle, et celui dont le
  //        paquet arrivait second était jeté. Alice se ravise dans la foulée :
  //        sa correction doit encore compter, et c'est elle qu'on retient.
  const nouveauChoix = (1 + 1) % q1.answers.length
  const aliceReveal2 = waitFor<any>(alice, 'session:view', p => p.view.phase === 'reveal' && p.view.qIndex === 1, 'révélation après le souffle')
  const hostReveal2 = waitFor<any>(host, 'session:view', p => p.view.phase === 'reveal' && p.view.qIndex === 1, 'révélation vue de l’écran commun')
  const dernier = await emitAck<any>(bob, 'player:action', {
    sessionId: quizId,
    action: { type: 'answer', choice: 0 },
  })
  assert(dernier.ok, 'la dernière réponse de la salle doit être retenue')
  const ravise = await emitAck<any>(alice, 'player:action', {
    sessionId: quizId,
    action: { type: 'answer', choice: nouveauChoix },
  })
  assert(ravise.ok, `changement d’avis perdu juste après la dernière réponse de la salle : ${ravise.error}`)
  const apresSouffle = await aliceReveal2
  assert(
    apresSouffle.view.yourChoice === nouveauChoix,
    `le changement d’avis doit être celui retenu (vu : case ${apresSouffle.view.yourChoice})`,
  )
  // Et la révélation finit bien par venir d'elle-même : le souffle n'est pas un blocage.
  assert((await hostReveal2).view.qIndex === 1, 'la révélation doit partir seule une fois la salle calmée')

  // Une réponse qui arrive après la révélation est en retard, et on le lui dit :
  // c'est ce silence-là qui faisait croire aux invités qu'ils avaient répondu.
  const lateAck = await emitAck<any>(bob, 'player:action', {
    sessionId: quizId,
    action: { type: 'answer', choice: 0 },
  })
  assert(!lateAck.ok && lateAck.reason === 'too-late', 'une réponse après la révélation doit être refusée avec son motif')

  // 7. Reconnexion : nouveau socket + token → même joueur, et il revoit la partie
  alice.disconnect()
  const alice2 = connect()
  const viewAgain = waitFor<any>(alice2, 'session:view', p => p.sessionId === quizId, 'vue renvoyée après reconnexion')
  const rejoin = await emitAck<any>(alice2, 'player:join', { slug: SLUG, name: 'Alice', avatar: '🦊', token: aliceAck.token })
  assert(rejoin.ok && rejoin.playerId === aliceAck.playerId, 'la reconnexion par token ne rend pas le même joueur')
  const back = await viewAgain
  assert(back.view.phase === 'reveal', 'Alice devrait retrouver la partie là où elle en est')

  // 8. Fin du quiz : plus de partie en cours dans le snapshot
  const cleared = waitFor<any>(host, 'party:snapshot', s => s.session === null, 'partie soldée dans le snapshot')
  ;(host as any).emit('host:endSession', { sessionId: quizId })
  await cleared

  // 9. Bibliothèque : l'API exige une session, et une écriture l'en-tête maison
  const anon = await fetch(`${url}/api/quizzes`)
  assert(anon.status === 401, `l'API doit refuser sans session (reçu ${anon.status})`)
  const forged = await fetch(`${url}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: '{}',
  })
  assert(forged.status === 403, 'une écriture avec le cookie mais sans l’en-tête maison doit être refusée')

  const apiCall = (path: string, init?: RequestInit) =>
    fetch(`${url}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Requested-With': 'quizz', ...init?.headers },
    })

  const seeded = (await (await apiCall('/api/quizzes')).json()) as any[]
  assert(
    seeded.some((q: any) => q.id === 'culture-generale'),
    'les quiz JSON livrés doivent être importés dans la bibliothèque',
  )

  // 9 bis. Les comptes : l'administrateur crée un compte, l'ami l'active par
  //        son lien (une seule fois), se connecte, se déconnecte ; désactivé,
  //        il n'entre plus et son écran commun se coupe.
  let lastStatus = 0
  for (let i = 0; i < 6; i++) {
    lastStatus = (await write(url, '/api/auth/login', { login: 'inconnu', password: 'x' })).status
  }
  assert(lastStatus === 429, `après six échecs sur un identifiant, ${lastStatus} au lieu de 429`)
  const meAdmin = (await (await apiCall('/api/auth/me')).json()) as any
  assert(meAdmin.account?.role === 'admin' && meAdmin.space?.slug === ADMIN.slug, 'l’administrateur doit se reconnaître')
  // Les réglages de la soirée : bornés, visibles des pages publiques et des téléphones.
  const settingsRes = await apiCall('/api/space/settings', {
    method: 'PUT',
    body: JSON.stringify({ title: 'Les 30 ans de Romane', eyebrow: 'Les trente ans de', headline: 'Romane', dateLine: '19 septembre 2026', maxPlayers: 9999 }),
  })
  assert(settingsRes.ok, 'enregistrer les réglages de l’espace')
  const spaceJson = (await (await fetch(`${url}/s/${SLUG}/space.json`)).json()) as any
  assert(
    spaceJson.title === 'Les 30 ans de Romane' && spaceJson.headline === 'Romane' && spaceJson.maxPlayers === 500,
    `les réglages doivent se relire, bornés : ${JSON.stringify(spaceJson)}`,
  )
  const titled = await watch(connect(), SLUG)
  assert(titled.space?.title === 'Les 30 ans de Romane', 'l’instantané des invités porte les réglages')
  const createdAccount = (await (
    await apiCall('/api/admin/accounts', { method: 'POST', body: JSON.stringify({ login: 'Bob', name: 'Bob', slug: 'Chez Bob' }) })
  ).json()) as any
  assert(
    createdAccount.account?.login === 'bob' && createdAccount.account.slug === 'chez-bob' && createdAccount.account.status === 'pending',
    'création de compte : identifiant et adresse normalisés, compte en attente',
  )
  assert(typeof createdAccount.activation?.token === 'string', 'la création doit rendre un jeton d’activation')
  const dup = await apiCall('/api/admin/accounts', { method: 'POST', body: JSON.stringify({ login: 'bob', name: 'Bob', slug: 'autre' }) })
  assert(dup.status === 400, 'un identifiant déjà pris doit être refusé')
  const reserved = await apiCall('/api/admin/accounts', { method: 'POST', body: JSON.stringify({ login: 'carl', name: 'Carl', slug: 'host' }) })
  assert(reserved.status === 400, 'un nom d’adresse réservé doit être refusé')
  const weak = await write(url, '/api/auth/activate', { token: createdAccount.activation.token, password: 'court' })
  assert(weak.status === 400, 'un mot de passe trop court doit être refusé à l’activation')
  const activated = await write(url, '/api/auth/activate', { token: createdAccount.activation.token, password: 'bob-pass-12' })
  assert(activated.ok, `activation refusée (${activated.status})`)
  const bobCookie = cookieOf(activated)
  const reused = await write(url, '/api/auth/activate', { token: createdAccount.activation.token, password: 'bob-pass-13' })
  assert(reused.status === 400, 'un lien d’activation ne sert qu’une fois')
  const meBob = (await (await fetch(`${url}/api/auth/me`, { headers: { Cookie: bobCookie } })).json()) as any
  assert(meBob.account?.login === 'bob' && meBob.account.status === 'active', 'la session ouverte à l’activation doit être celle de Bob')
  const bobAdmin = await fetch(`${url}/api/admin/accounts`, { headers: { Cookie: bobCookie } })
  assert(bobAdmin.status === 403, 'l’administration est réservée à l’administrateur')
  const bobHost = connectHost(url, bobCookie)
  const bobHello = await emitAck<{ ok: boolean; slug?: string }>(bobHost, 'host:hello', {})
  assert(bobHello.ok && bobHello.slug === 'chez-bob', 'l’écran commun de Bob doit se présenter avec sa session')
  const bobCut = new Promise<void>(r => bobHost.on('disconnect', () => r()))
  const disabled = await apiCall(`/api/admin/accounts/${createdAccount.account.id}/disable`, { method: 'POST' })
  assert(disabled.ok, 'désactiver un compte')
  await Promise.race([
    bobCut,
    new Promise((_, rej) => setTimeout(() => rej(new Error('l’écran commun d’un compte désactivé doit être coupé')), 3000)),
  ])
  const meDisabled = await fetch(`${url}/api/auth/me`, { headers: { Cookie: bobCookie } })
  assert(meDisabled.status === 401, 'la session d’un compte désactivé ne vaut plus rien')
  const loginDisabled = await write(url, '/api/auth/login', { login: 'bob', password: 'bob-pass-12' })
  assert(loginDisabled.status === 401, 'un compte désactivé ne se connecte plus')
  // Sa soirée est fermée aux invités, mais ses pages restent lisibles.
  const closedDoor = await emitAck<any>(connect(), 'party:watch', { slug: 'chez-bob' })
  assert(!closedDoor.ok, 'la soirée d’un compte désactivé ne se rejoint plus')
  assert((await fetch(`${url}/s/chez-bob/recap.json`)).ok, 'les pages d’un compte désactivé restent lisibles')
  const selfDisable = await apiCall(`/api/admin/accounts/${meAdmin.account.id}/disable`, { method: 'POST' })
  assert(selfDisable.status === 400, 'l’administrateur ne peut pas se désactiver lui-même')
  assert((await apiCall(`/api/admin/accounts/${createdAccount.account.id}/enable`, { method: 'POST' })).ok, 'réactiver un compte')
  const bobAgain = await loginAs(url, 'bob', 'bob-pass-12')
  const logout = await fetch(`${url}/api/auth/logout`, { method: 'POST', headers: { Cookie: bobAgain, 'X-Requested-With': 'quizz' } })
  assert(logout.ok, 'déconnexion')
  const afterLogout = await fetch(`${url}/api/auth/me`, { headers: { Cookie: bobAgain } })
  assert(afterLogout.status === 401, 'après déconnexion, la session ne vaut plus rien')
  const badCurrent = await write(url, '/api/auth/password', { current: 'faux', next: 'nouveau-pass-1' }, cookie)
  assert(badCurrent.status === 400, 'changer de mot de passe exige l’ancien')

  // 9 ter. L'isolation : Bob ne voit que ses quiz et sa soirée, et rien de ce
  //        qu'il envoie n'atteint la soirée de l'administrateur — ni l'inverse.
  const bobCookie2 = await loginAs(url, 'bob', 'bob-pass-12')
  const bobCall = (path: string, init?: RequestInit) =>
    fetch(`${url}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Cookie: bobCookie2, 'X-Requested-With': 'quizz', ...init?.headers },
    })
  const bobList = (await (await bobCall('/api/quizzes')).json()) as any[]
  assert(bobList.length === 0, `Bob commence sans quiz, il en voit ${bobList.length}`)
  assert((await bobCall('/api/quizzes/culture-generale')).status === 404, 'un quiz d’un autre espace est introuvable')
  const bobPut = await bobCall('/api/quizzes/culture-generale', {
    method: 'PUT',
    body: JSON.stringify({ title: 'Piraté', questions: [] }),
  })
  assert(bobPut.status === 404, 'modifier le quiz d’un autre espace doit être refusé')
  assert(
    (await bobCall('/api/quizzes/culture-generale', { method: 'DELETE' })).status === 404,
    'supprimer le quiz d’un autre espace doit être refusé',
  )
  assert(
    (await bobCall('/api/quizzes/culture-generale/duplicate', { method: 'POST' })).status === 404,
    'dupliquer le quiz d’un autre espace doit être refusé',
  )
  const intact = (await (await apiCall('/api/quizzes/culture-generale')).json()) as any
  assert(intact.title !== 'Piraté' && intact.questions.length > 0, 'le quiz de l’administrateur doit être intact')
  const bobQuiz = (await (
    await bobCall('/api/quizzes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Le quiz de Bob',
        questions: [{ text: 'Chez qui ?', answers: ['Chez Bob', 'Ailleurs', '', ''], correct: 0, duration: 20 }],
      }),
    })
  ).json()) as any
  assert(bobQuiz.id, 'Bob doit pouvoir créer un quiz')
  const adminList = (await (await apiCall('/api/quizzes')).json()) as any[]
  assert(!adminList.some(q => q.id === bobQuiz.id), 'le quiz de Bob ne doit pas apparaître chez l’administrateur')
  assert((await apiCall(`/api/quizzes/${bobQuiz.id}`)).status === 404, 'l’administrateur ne lit pas les quiz des autres')

  // Un invité chez Bob, un chez l'administrateur : chacun ne voit que sa salle,
  // et une connexion ne suit jamais qu'une soirée.
  const bobette = connect()
  const bobRoom = await watch(bobette, 'chez-bob')
  assert(bobRoom.space?.slug === 'chez-bob' && bobRoom.players.length === 0, 'la salle de Bob est vide et porte son nom')
  const elsewhere = await emitAck<any>(bobette, 'party:watch', { slug: SLUG })
  assert(!elsewhere.ok, 'une connexion ne suit qu’une soirée')
  const nowhere = await emitAck<any>(connect(), 'party:watch', { slug: 'nulle-part' })
  assert(!nowhere.ok && nowhere.error, 'un nom d’espace inconnu est refusé')
  const bobetteAck = await emitAck<any>(bobette, 'player:join', { slug: 'chez-bob', name: 'Bobette', avatar: '🐙' })
  assert(bobetteAck.ok, 'inscription chez Bob')
  const watcher = connect()
  const adminRoom = await watch(watcher, SLUG)
  assert(!adminRoom.players.some((p: any) => p.name === 'Bobette'), 'Bobette ne doit pas apparaître chez l’administrateur')
  assert(adminRoom.players.some((p: any) => p.id === aliceAck.playerId), 'Alice est bien chez l’administrateur')
  assert(adminRoom.space?.slug === SLUG && adminRoom.joinUrl?.endsWith(`/${SLUG}`), 'l’instantané dit l’espace et l’adresse à scanner')
  watcher.disconnect()

  // Bob lance un quiz : sa liste ne contient que le sien, et sa partie ne
  // regarde pas la soirée voisine — dans un sens comme dans l'autre.
  const bobHost2 = connectHost(url, bobCookie2)
  bobHost2.on('toast', (t: any) => console.log(`   ⚠️  toast Bob (animateur) : ${t.message}`))
  assert((await emitAck<any>(bobHost2, 'host:hello', {})).ok, 'l’écran commun de Bob')
  const bobPick = waitFor<any>(bobHost2, 'session:view', p => p.view.phase === 'pickPack', 'liste des quiz de Bob')
  ;(bobHost2 as any).emit('host:launch')
  const bobSession = await bobPick
  assert(
    bobSession.view.packs.length === 1 && bobSession.view.packs[0].id === bobQuiz.id,
    'Bob ne se voit proposer que ses quiz',
  )
  ;(bobHost2 as any).emit('host:command', { sessionId: bobSession.sessionId, command: { type: 'selectPack', packId: bobQuiz.id } })
  await waitFor<any>(bobette, 'session:view', p => p.view.phase === 'question', 'question chez Bob')
  const adminRefus = waitFor<any>(host, 'toast', t => t.kind === 'error', 'commande refusée chez l’administrateur')
  ;(host as any).emit('host:command', { sessionId: bobSession.sessionId, command: { type: 'next' } })
  await adminRefus
  // La partie du voisin vaut « terminée » — et le refus voyage maintenant dans
  // l'accusé de réception plutôt que dans un toast.
  const aliceRefus = await emitAck<any>(alice2, 'player:action', {
    sessionId: bobSession.sessionId,
    action: { type: 'answer', choice: 0 },
  })
  assert(
    !aliceRefus.ok && aliceRefus.reason === 'ended',
    'la réponse d’Alice à la partie du voisin doit être refusée, avec son motif',
  )
  const bobetteReveal = waitFor<any>(bobette, 'session:view', p => p.view.phase === 'reveal', 'révélation chez Bob')
  ;(bobette as any).emit('player:action', { sessionId: bobSession.sessionId, action: { type: 'answer', choice: 0 } })
  const bobetteRv = await bobetteReveal
  assert(
    bobetteRv.view.qIndex === 0 && bobetteRv.view.yourPoints > 100,
    'la question de Bob ne doit pas avoir bougé sous les commandes venues d’ailleurs',
  )
  ;(bobHost2 as any).emit('host:endSession', { sessionId: bobSession.sessionId })

  // Bob archive : son historique en a une, celui de l'administrateur aucune,
  // et l'administrateur ne peut ni la lire dans son espace ni la retirer.
  const bobArchived = waitFor<any>(bobHost2, 'toast', t => t.kind === 'info', 'soirée de Bob archivée')
  ;(bobHost2 as any).emit('host:archiveParty', { title: 'Chez Bob' })
  await bobArchived
  const bobSoirees = (await (await fetch(`${url}/s/chez-bob/soirees.json`)).json()) as any
  assert(bobSoirees.archives.length === 1 && bobSoirees.space?.slug === 'chez-bob', 'l’historique de Bob')
  const adminSoirees = (await (await fetch(`${url}/s/${SLUG}/soirees.json`)).json()) as any
  assert(adminSoirees.archives.length === 0, 'l’historique de l’administrateur ne voit pas la soirée de Bob')
  const bobArchiveId = bobSoirees.archives[0].id
  assert(
    (await apiCall(`/api/soirees/${bobArchiveId}`, { method: 'DELETE' })).status === 404,
    'l’administrateur ne retire pas les soirées des autres',
  )
  assert((await fetch(`${url}/s/chez-bob/soirees/${bobArchiveId}/bilan.json`)).ok, 'la soirée de Bob est toujours là')
  assert(
    (await fetch(`${url}/s/${SLUG}/soirees/${bobArchiveId}/bilan.json`)).status === 404,
    'une archive ne se lit que dans son espace',
  )
  assert((await fetch(`${url}/s/personne/recap.json`)).status === 404, 'un espace inconnu vaut 404')

  // 10. Photos : envoi en dataURL, stockage en base, relecture publique
  //     (les téléphones des invités doivent pouvoir les charger sans clé)
  const TINY_JPEG: string =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
  const upload = (await (
    await apiCall('/api/images', { method: 'POST', body: JSON.stringify({ dataUrl: TINY_JPEG }) })
  ).json()) as any
  assert(upload.url?.startsWith('/media/image/'), `URL d'image inattendue : ${upload.url}`)
  const fetched = await fetch(`${url}${upload.url}`)
  assert(fetched.ok, 'la photo doit être lisible sans clé (les invités la chargent)')
  assert(
    fetched.headers.get('content-type') === 'image/jpeg',
    `type de contenu inattendu : ${fetched.headers.get('content-type')}`,
  )
  const bytes = Buffer.from(await fetched.arrayBuffer())
  assert(
    bytes.equals(Buffer.from(TINY_JPEG.split(',')[1], 'base64')),
    'la photo relue diffère de la photo envoyée',
  )
  const badImage = await apiCall('/api/images', {
    method: 'POST',
    body: JSON.stringify({ dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' }),
  })
  assert(badImage.status === 400, 'un faux fichier image doit être refusé')

  // 10 bis. Supprimer un compte : seulement désactivé, jamais le sien ; tout
  //         ce qu'il a laissé part avec lui — quiz, photo, invitée, partie en
  //         cours, archive — et son adresse redevient libre. Un compte
  //         jetable, pour laisser Bob aux vérifications d'isolation ; une
  //         seule activation et aucune connexion, le garde-fou des essais
  //         compte par adresse.
  const carlaCreated = (await (
    await apiCall('/api/admin/accounts', {
      method: 'POST',
      body: JSON.stringify({ login: 'carla', name: 'Carla', slug: 'chez-carla' }),
    })
  ).json()) as any
  const carlaId: string = carlaCreated.account.id
  const carlaActivated = await write(url, '/api/auth/activate', { token: carlaCreated.activation.token, password: 'carla-pass-12' })
  assert(carlaActivated.ok, `activation de Carla refusée (${carlaActivated.status})`)
  const carlaCookie = cookieOf(carlaActivated)
  const carlaCall = (path: string, init?: RequestInit) =>
    fetch(`${url}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Cookie: carlaCookie, 'X-Requested-With': 'quizz', ...init?.headers },
    })
  // De la matière à effacer : une photo (lue une fois, elle entre dans le
  // cache), un quiz qui la porte, une invitée, une partie laissée en cours
  // après sa première révélation — chronomètres armés, recopies en vol —,
  // et une soirée archivée.
  const carlaImage = (await (
    await carlaCall('/api/images', { method: 'POST', body: JSON.stringify({ dataUrl: TINY_JPEG }) })
  ).json()) as any
  assert((await fetch(`${url}${carlaImage.url}`)).ok, 'la photo de Carla se lit')
  const carlaQuiz = (await (
    await carlaCall('/api/quizzes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Le quiz de Carla',
        questions: [
          { text: 'Chez qui ?', answers: ['Chez Carla', 'Ailleurs', '', ''], correct: 0, duration: 20, image: carlaImage.url },
          { text: 'Et ensuite ?', answers: ['On danse', 'On dort', '', ''], correct: 0, duration: 20 },
        ],
      }),
    })
  ).json()) as any
  assert(carlaQuiz.id, 'le quiz de Carla')
  const carlita = connect()
  await watch(carlita, 'chez-carla')
  const carlitaAck = await emitAck<any>(carlita, 'player:join', { slug: 'chez-carla', name: 'Carlita', avatar: '🦋' })
  assert(carlitaAck.ok, 'Carlita rejoint la soirée de Carla')
  const carlaHost = connectHost(url, carlaCookie)
  assert((await emitAck<any>(carlaHost, 'host:hello', {})).ok, 'l’écran commun de Carla')
  const carlaPick = waitFor<any>(carlaHost, 'session:view', p => p.view.phase === 'pickPack', 'liste des quiz de Carla')
  ;(carlaHost as any).emit('host:launch')
  const carlaSession = await carlaPick
  ;(carlaHost as any).emit('host:command', { sessionId: carlaSession.sessionId, command: { type: 'selectPack', packId: carlaQuiz.id } })
  await waitFor<any>(carlita, 'session:view', p => p.view.phase === 'question', 'question chez Carla')
  const carlitaReveal = waitFor<any>(carlita, 'session:view', p => p.view.phase === 'reveal', 'révélation chez Carla')
  ;(carlita as any).emit('player:action', { sessionId: carlaSession.sessionId, action: { type: 'answer', choice: 0 } })
  await carlitaReveal
  const carlaArchived = waitFor<any>(carlaHost, 'toast', t => t.kind === 'info', 'soirée de Carla archivée')
  ;(carlaHost as any).emit('host:archiveParty', { title: 'Chez Carla' })
  await carlaArchived
  const carlaSoirees = (await (await fetch(`${url}/s/chez-carla/soirees.json`)).json()) as any
  assert(carlaSoirees.archives.length === 1 && carlaSoirees.current, 'l’historique de Carla : une archive, une soirée en cours')
  const carlaArchiveId: string = carlaSoirees.archives[0].id
  carlaHost.disconnect()

  const delAccount = (id: string, call = apiCall) => call(`/api/admin/accounts/${id}`, { method: 'DELETE' })
  assert((await delAccount('inconnu')).status === 404, 'supprimer un compte inconnu vaut 404')
  assert((await delAccount(carlaId)).status === 400, 'un compte actif ne se supprime pas : il faut le désactiver d’abord')
  assert((await delAccount(meAdmin.account.id)).status === 400, 'l’administrateur ne se supprime pas lui-même')
  assert((await delAccount(carlaId, bobCall)).status === 403, 'la suppression est réservée à l’administrateur')
  assert((await apiCall(`/api/admin/accounts/${carlaId}/disable`, { method: 'POST' })).ok, 'désactiver Carla')
  const carlitaOut = waitFor<void>(carlita, 'player:removed', () => true, 'Carlita renvoyée à l’inscription')
  const carlitaCut = new Promise<void>(r => carlita.on('disconnect', () => r()))
  const carlaRemoved = await delAccount(carlaId)
  assert(carlaRemoved.ok, `supprimer Carla (${carlaRemoved.status}) : ${await carlaRemoved.text()}`)
  await Promise.race([
    Promise.all([carlitaOut, carlitaCut]),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error('les téléphones d’un compte supprimé doivent être renvoyés puis coupés')), 3000),
    ),
  ])
  carlita.disconnect()
  assert((await fetch(`${url}/s/chez-carla/recap.json`)).status === 404, 'les pages d’un compte supprimé ne se lisent plus')
  assert(
    (await fetch(`${url}/s/chez-carla/soirees/${carlaArchiveId}/bilan.json`)).status === 404,
    'son archive est partie avec lui',
  )
  assert((await fetch(`${url}${carlaImage.url}`)).status === 404, 'sa photo n’est plus servie, cache compris')
  assert(!(await emitAck<any>(connect(), 'party:watch', { slug: 'chez-carla' })).ok, 'sa soirée ne se suit plus')
  assert((await fetch(`${url}/api/auth/me`, { headers: { Cookie: carlaCookie } })).status === 401, 'sa session ne vaut plus rien')
  const accountsLeft = (await (await apiCall('/api/admin/accounts')).json()) as any[]
  assert(!accountsLeft.some(a => a.id === carlaId), 'le compte a disparu de la liste')
  const carlaCheck = createClient({ url: quizDbUrl })
  const carlaLeft = await carlaCheck.execute({
    sql: `SELECT (SELECT COUNT(*) FROM quizzes WHERE space_id = ?)
            + (SELECT COUNT(*) FROM quiz_images WHERE space_id = ?)
            + (SELECT COUNT(*) FROM soirees WHERE space_id = ?)
            + (SELECT COUNT(*) FROM party_players WHERE space_id = ?)
            + (SELECT COUNT(*) FROM party_teams WHERE space_id = ?)
            + (SELECT COUNT(*) FROM party_bonus WHERE space_id = ?)
            + (SELECT COUNT(*) FROM party_answers WHERE space_id = ?)
            + (SELECT COUNT(*) FROM party_scores WHERE space_id = ?)
            + (SELECT COUNT(*) FROM party_sessions WHERE space_id = ?)
            + (SELECT COUNT(*) FROM accounts WHERE id = ?)
            + (SELECT COUNT(*) FROM auth_sessions WHERE account_id = ?)
            + (SELECT COUNT(*) FROM activations WHERE account_id = ?) AS n`,
    args: Array(12).fill(carlaId),
  })
  assert(Number(carlaLeft.rows[0].n) === 0, `plus aucune ligne de Carla dans la base permanente (${carlaLeft.rows[0].n} restantes)`)
  carlaCheck.close()
  const localDb = new Database(dbPath)
  const localLeft = localDb
    .prepare(
      `SELECT (SELECT COUNT(*) FROM players WHERE space_id = ?)
            + (SELECT COUNT(*) FROM teams WHERE space_id = ?)
            + (SELECT COUNT(*) FROM team_bonus WHERE space_id = ?)
            + (SELECT COUNT(*) FROM answer_log WHERE space_id = ?)
            + (SELECT COUNT(*) FROM score_entries WHERE space_id = ?)
            + (SELECT COUNT(*) FROM sessions WHERE space_id = ?) AS n`,
    )
    .get(...Array(6).fill(carlaId)) as { n: number }
  localDb.close()
  assert(localLeft.n === 0, `plus aucune ligne de Carla dans la base locale (${localLeft.n} restantes)`)
  // Son adresse et son identifiant sont libres, et l'espace qui les reprend est vierge.
  const carlaAgain = await apiCall('/api/admin/accounts', {
    method: 'POST',
    body: JSON.stringify({ login: 'carla', name: 'Carla II', slug: 'chez-carla' }),
  })
  assert(carlaAgain.status === 201, `l’identifiant et l’adresse d’un compte supprimé redeviennent libres (${carlaAgain.status})`)
  const carlaFresh = (await (await fetch(`${url}/s/chez-carla/soirees.json`)).json()) as any
  assert(carlaFresh.current === null && carlaFresh.archives.length === 0, 'le nouvel espace repart de zéro : rien n’a fui')

  // 11. Création + édition : un brouillon incomplet est conservé, pas jeté
  const created = (await (
    await apiCall('/api/quizzes', { method: 'POST', body: JSON.stringify({ title: 'Spécial Romane' }) })
  ).json()) as any
  assert(created.id, 'création de quiz échouée')

  const saved = (await (
    await apiCall(`/api/quizzes/${created.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: 'Spécial Romane',
        questions: [
          // Réponses vides intercalées : la bonne réponse doit suivre son texte,
          // pas son numéro de case.
          { text: 'Quelle danse ?', answers: ['', 'La salsa', '', 'Le tango'], correct: 1, duration: 15, image: null },
          { text: 'Brouillon pas fini', answers: ['', '', '', ''], correct: 0, duration: 20, image: null },
        ],
      }),
    })
  ).json()) as any
  assert(saved.questions.length === 2, 'le brouillon incomplet doit être conservé tel quel')

  const all = (await (await apiCall('/api/quizzes')).json()) as any[]
  const summary = all.find(q => q.id === created.id)
  assert(
    summary.questionCount === 2 && summary.readyCount === 1,
    `2 questions dont 1 prête attendues, reçu ${summary?.questionCount}/${summary?.readyCount}`,
  )

  // 12. Le quiz créé se joue immédiatement : seule la question prête est posée,
  //     et la bonne réponse est bien « La salsa » une fois les vides retirées
  const quiz2Seen = waitFor<any>(bob, 'session:view', () => true, 'nouvelle partie chez Bob')
  ;(host as any).emit('host:launch')
  const quiz2Id = (await quiz2Seen).sessionId
  ;(host as any).emit('host:command', { sessionId: quiz2Id, command: { type: 'selectPack', packId: created.id } })
  const q2 = await waitFor<any>(bob, 'session:view', p => p.view.phase === 'question', 'question du quiz créé')
  assert(q2.view.qCount === 1, `1 seule question jouable attendue, vu ${q2.view.qCount}`)
  assert(
    JSON.stringify(q2.view.answers) === JSON.stringify(['La salsa', 'Le tango']),
    `réponses vides mal retirées : ${JSON.stringify(q2.view.answers)}`,
  )

  const bobReveal = waitFor<any>(bob, 'session:view', p => p.view.phase === 'reveal', 'reveal du quiz créé')
  ;(bob as any).emit('player:action', { sessionId: quiz2Id, action: { type: 'answer', choice: 0 } })
  ;(alice2 as any).emit('player:action', { sessionId: quiz2Id, action: { type: 'answer', choice: 1 } })
  const rv2 = await bobReveal
  assert(rv2.view.correct === 0, `« La salsa » doit rester la bonne réponse (index reçu : ${rv2.view.correct})`)
  assert(rv2.view.yourPoints > 100, 'Bob a répondu juste, il doit marquer des points')

  ;(host as any).emit('host:endSession', { sessionId: quiz2Id })

  // 13. Suppression
  const del = await apiCall(`/api/quizzes/${created.id}`, { method: 'DELETE' })
  assert(del.ok, 'suppression du quiz échouée')
  const after = (await (await apiCall('/api/quizzes')).json()) as any[]
  assert(!after.some((q: any) => q.id === created.id), 'le quiz supprimé ne doit plus être listé')

  // 14. Question « estimation » : le plus proche empoche le maximum, celui qui
  //     répond quand même marque un minimum, personne n'est bloqué
  const mixed = (await (
    await apiCall('/api/quizzes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Estimation & retardataire',
        questions: [
          { kind: 'number', text: 'Quel âge fête Romane ?', target: 30, unit: 'ans', duration: 30 },
          {
            kind: 'choice',
            text: 'Quelle danse ?',
            answers: ['La salsa', 'Le tango', '', ''],
            correct: 0,
            duration: 30,
          },
        ],
      }),
    })
  ).json()) as any

  const mixedSeen = waitFor<any>(bob, 'session:view', () => true, 'partie estimation chez Bob')
  ;(host as any).emit('host:launch')
  const mixedId = (await mixedSeen).sessionId
  ;(host as any).emit('host:command', { sessionId: mixedId, command: { type: 'selectPack', packId: mixed.id } })
  const numQ = await waitFor<any>(bob, 'session:view', p => p.view.phase === 'question', 'question estimation')
  assert(numQ.view.kind === 'number', `type de question attendu 'number', reçu ${numQ.view.kind}`)
  assert(numQ.view.unit === 'ans', `unité attendue 'ans', reçue ${numQ.view.unit}`)

  const aliceGuessRv = waitFor<any>(alice2, 'session:view', p => p.view.phase === 'reveal', 'reveal estimation Alice')
  const bobGuessRv = waitFor<any>(bob, 'session:view', p => p.view.phase === 'reveal', 'reveal estimation Bob')
  const hostGuessRv = waitFor<any>(host, 'session:view', p => p.view.phase === 'reveal', 'reveal estimation host')
  ;(alice2 as any).emit('player:action', { sessionId: mixedId, action: { type: 'guess', value: 41 } })
  ;(alice2 as any).emit('player:action', { sessionId: mixedId, action: { type: 'guess', value: 31 } }) // correction
  ;(bob as any).emit('player:action', { sessionId: mixedId, action: { type: 'guess', value: 50 } })
  const [aliceG, bobG, hostG] = await Promise.all([aliceGuessRv, bobGuessRv, hostGuessRv])
  assert(aliceG.view.yourGuess === 31, `la correction doit remplacer la 1re estimation, vu ${aliceG.view.yourGuess}`)
  assert(aliceG.view.yourPoints === 200, `le plus proche marque 200, vu ${aliceG.view.yourPoints}`)
  assert(bobG.view.yourPoints === 30, `le plus loin marque le minimum de participation, vu ${bobG.view.yourPoints}`)
  assert(hostG.view.target === 30, 'la valeur à deviner doit être révélée sur l’écran commun')
  assert(hostG.view.guesses?.[0]?.name === 'Alice', 'Alice doit être en tête des estimations')

  // 15. Retardataire : Charlie arrive en pleine partie et joue la question suivante
  const charlie = connect()
  const charlieView = waitFor<any>(charlie, 'session:view', p => p.sessionId === mixedId, 'vue donnée au retardataire')
  const charlieAck = await emitAck<any>(charlie, 'player:join', { slug: SLUG, name: 'Charlie', avatar: '🐼' })
  assert(charlieAck.ok, 'join Charlie échoué')
  const charlieFirst = await charlieView
  assert(
    charlieFirst.view.justArrived === true,
    'le retardataire doit être accueilli, pas recevoir un « trop tard » pour une question qu’il n’a pas vue',
  )
  const withCharlie = await waitFor<any>(
    host,
    'party:snapshot',
    s => s.session?.participantIds.includes(charlieAck.playerId),
    'le retardataire doit rejoindre la partie en cours',
  )
  assert(withCharlie.session.participantIds.length === 3, '3 participants attendus après l’arrivée de Charlie')

  ;(host as any).emit('host:command', { sessionId: mixedId, command: { type: 'next' } })
  await waitFor<any>(charlie, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === 1, 'question 2')

  const charlieRv = waitFor<any>(charlie, 'session:view', p => p.view.phase === 'reveal', 'reveal pour Charlie')
  ;(charlie as any).emit('player:action', { sessionId: mixedId, action: { type: 'answer', choice: 0 } })
  ;(bob as any).emit('player:action', { sessionId: mixedId, action: { type: 'answer', choice: 1 } })
  ;(alice2 as any).emit('player:action', { sessionId: mixedId, action: { type: 'answer', choice: 1 } })
  const charlieReveal = await charlieRv
  assert(charlieReveal.view.yourPoints > 100, 'Charlie a répondu juste, il doit marquer des points')
  assert(
    charlieReveal.view.yourQuizTotal === charlieReveal.view.yourPoints,
    'le retardataire ne doit rien récupérer sur la question qu’il a manquée',
  )
  ;(host as any).emit('host:endSession', { sessionId: mixedId })

  // 15 bis. Une estimation absurde ne doit rien changer aux points des autres.
  //         Avec l'ancienne échelle linéaire, « 99999 » repoussait le maximum
  //         si loin que toute la salle touchait le plein de points.
  const sabotage = (await (
    await apiCall('/api/quizzes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Sabotage',
        questions: [{ kind: 'number', text: 'En quelle année ?', target: 1994, unit: '', duration: 30 }],
      }),
    })
  ).json()) as any
  const sabPick = waitFor<any>(host, 'session:view', p => p.view.phase === 'pickPack', 'liste des quiz (sabotage)')
  ;(host as any).emit('host:launch')
  const sabId = (await sabPick).sessionId
  ;(host as any).emit('host:command', { sessionId: sabId, command: { type: 'selectPack', packId: sabotage.id } })
  await waitFor<any>(charlie, 'session:view', p => p.view.phase === 'question', 'question sabotage')
  const charlieSab = waitFor<any>(charlie, 'session:view', p => p.view.phase === 'reveal', 'reveal sabotage Charlie')
  const bobSab = waitFor<any>(bob, 'session:view', p => p.view.phase === 'reveal', 'reveal sabotage Bob')
  ;(alice2 as any).emit('player:action', { sessionId: sabId, action: { type: 'guess', value: 1994 } })
  ;(charlie as any).emit('player:action', { sessionId: sabId, action: { type: 'guess', value: 2004 } })
  ;(bob as any).emit('player:action', { sessionId: sabId, action: { type: 'guess', value: 99999 } })
  const [charlieS, bobS] = await Promise.all([charlieSab, bobSab])
  assert(charlieS.view.yourPoints === 90, `deuxième sur trois : 90 points attendus, vu ${charlieS.view.yourPoints}`)
  assert(bobS.view.yourPoints === 30, `l'estimation absurde ne rapporte que la participation, vu ${bobS.view.yourPoints}`)
  ;(host as any).emit('host:endSession', { sessionId: sabId })
  await apiCall(`/api/quizzes/${sabotage.id}`, { method: 'DELETE' })

  charlie.disconnect()
  // La déconnexion met un instant à parvenir au serveur : sans cette attente,
  // la partie suivante compterait encore Charlie parmi ses participants et
  // n'atteindrait jamais « tout le monde a répondu ».
  await waitFor<any>(
    host,
    'party:snapshot',
    s => s.players.filter((p: any) => p.connected).length === 2,
    'Charlie déconnecté',
  )

  // 16. Commandes d'animation : pause, annulation des points, question reposée
  // On identifie la nouvelle partie par la liste des quiz côté animateur :
  // attendre « n'importe quelle vue » attraperait un reliquat de la précédente.
  const ctrlPick = waitFor<any>(host, 'session:view', p => p.view.phase === 'pickPack', 'liste des quiz (contrôle)')
  ;(host as any).emit('host:launch')
  const ctrlId = (await ctrlPick).sessionId
  ;(host as any).emit('host:command', {
    sessionId: ctrlId,
    command: { type: 'selectPack', packId: 'culture-generale', multiplier: 2 },
  })
  await waitFor<any>(bob, 'session:view', p => p.view.phase === 'question', 'question de contrôle')

  const paused = waitFor<any>(bob, 'session:view', p => p.view.paused === true, 'chronomètre figé')
  ;(host as any).emit('host:command', { sessionId: ctrlId, command: { type: 'pause' } })
  const pausedView = await paused
  assert(pausedView.view.remainingMs > 0, 'le temps restant doit être conservé pendant la pause')

  // Répondre pendant la pause ne doit rien faire : sinon la pause offrirait
  // un temps de réflexion illimité.
  ;(bob as any).emit('player:action', { sessionId: ctrlId, action: { type: 'answer', choice: 0 } })
  await new Promise(r => setTimeout(r, 300))

  const resumed = waitFor<any>(bob, 'session:view', p => p.view.phase === 'question' && !p.view.paused, 'reprise')
  ;(host as any).emit('host:command', { sessionId: ctrlId, command: { type: 'resume' } })
  const resumedView = await resumed
  assert(resumedView.view.yourChoice === null, 'la réponse envoyée pendant la pause doit être ignorée')

  // Changer d'avis : Bob se trompe, se ravise, et c'est la seconde réponse
  // qui compte — sans que la première soit comptée en plus.
  const mauvaise = (q0.correct + 1) % q0.answers.length
  const priseEnCompte = waitFor<any>(
    bob,
    'session:view',
    p => p.view.yourChoice === mauvaise,
    'première réponse enregistrée',
  )
  ;(bob as any).emit('player:action', { sessionId: ctrlId, action: { type: 'answer', choice: mauvaise } })
  await priseEnCompte

  const corrigee = waitFor<any>(
    bob,
    'session:view',
    p => p.view.yourChoice === q0.correct,
    'réponse corrigée',
  )
  ;(bob as any).emit('player:action', { sessionId: ctrlId, action: { type: 'answer', choice: q0.correct } })
  await corrigee

  // Bonne réponse, puis annulation des points par l'animateur
  const ctrlReveal = waitFor<any>(bob, 'session:view', p => p.view.phase === 'reveal', 'révélation de contrôle')
  const ctrlHostReveal = waitFor<any>(host, 'session:view', p => p.view.phase === 'reveal', 'révélation côté écran')
  ;(alice2 as any).emit('player:action', { sessionId: ctrlId, action: { type: 'answer', choice: q0.correct } })
  const revelation = await ctrlReveal
  const gained = revelation.view.yourPoints
  assert(gained > 0, 'la réponse corrigée de Bob doit compter')
  // Points doublés : un QCM plafonne à 200, donc au-delà c'est bien le
  // multiplicateur qui a joué. Et la salle doit le voir affiché.
  assert(gained > 200, `quiz en points doubles : ${gained} points, attendu plus de 200`)
  assert(revelation.view.multiplier === 2, 'le téléphone doit annoncer le multiplicateur')
  const repartition = (await ctrlHostReveal).view.counts
  assert(
    repartition[q0.correct] === 2 && repartition[mauvaise] === 0,
    `la première réponse ne doit pas rester comptée : ${JSON.stringify(repartition)}`,
  )

  const cancelled = waitFor<any>(bob, 'session:view', p => p.view.yourQuizTotal === 0, 'points annulés')
  ;(host as any).emit('host:command', { sessionId: ctrlId, command: { type: 'cancel' } })
  await cancelled

  const replayed = waitFor<any>(bob, 'session:view', p => p.view.phase === 'question', 'question reposée')
  ;(host as any).emit('host:command', { sessionId: ctrlId, command: { type: 'replay' } })
  const again = await replayed
  assert(again.view.qIndex === 0, 'la question reposée doit être la même')
  assert(again.view.yourChoice === null, 'les réponses précédentes doivent être effacées')
  // Enchaînement automatique : la question suivante doit partir toute seule,
  // sans que l'animateur touche à quoi que ce soit.
  ;(host as any).emit('host:command', { sessionId: ctrlId, command: { type: 'autoNext', seconds: 2 } })
  const autoArme = await waitFor<any>(
    host,
    'session:view',
    p => p.view.autoNextSeconds === 2,
    'enchaînement automatique armé',
  )
  assert(autoArme.view.phase === 'question', 'on doit être reparti sur une question')

  // On révèle à la main — attendre les 20 secondes du chronomètre allongerait
  // le test pour rien. C'est la suite qui doit se faire toute seule.
  const revelePromesse = waitFor<any>(host, 'session:view', p => p.view.phase === 'reveal', 'révélation')
  ;(host as any).emit('host:command', { sessionId: ctrlId, command: { type: 'next' } })
  const revele = await revelePromesse
  assert(revele.view.autoNextAt > Date.now(), 'la révélation doit annoncer son échéance')
  const suivante = await waitFor<any>(
    host,
    'session:view',
    p => p.view.phase === 'question' && p.view.qIndex === 1,
    'question suivante sans clic',
  )
  assert(suivante.view.autoNextSeconds === 2, 'le réglage doit tenir d’une question à l’autre')

  // Repasser en manuel annule l'enchaînement en attente.
  ;(host as any).emit('host:command', { sessionId: ctrlId, command: { type: 'next' } })
  await waitFor<any>(host, 'session:view', p => p.view.phase === 'reveal' && p.view.qIndex === 1, 'révélation forcée')
  ;(host as any).emit('host:command', { sessionId: ctrlId, command: { type: 'autoNext', seconds: null } })
  const manuel = await waitFor<any>(
    host,
    'session:view',
    p => p.view.autoNextSeconds === null,
    'retour en manuel',
  )
  assert(manuel.view.autoNextAt === undefined, 'plus aucune échéance ne doit être annoncée')

  ;(host as any).emit('host:endSession', { sessionId: ctrlId })

  // 17. Renommer et exclure un invité
  const renamed = waitFor<any>(
    host,
    'party:snapshot',
    s => s.players.some((p: any) => p.id === bobAck.playerId && p.name === 'Bob le bricoleur'),
    'invité renommé',
  )
  ;(host as any).emit('host:renamePlayer', { playerId: bobAck.playerId, name: 'Bob le bricoleur' })
  await renamed

  const removedOnPhone = waitFor<any>(bob, 'player:removed', () => true, 'téléphone prévenu de son exclusion')
  const removed = waitFor<any>(
    host,
    'party:snapshot',
    s => !s.players.some((p: any) => p.id === bobAck.playerId),
    'invité exclu',
  )
  ;(host as any).emit('host:removePlayer', { playerId: bobAck.playerId })
  await Promise.all([removed, removedOnPhone])

  // 18. Prix de caractère : un vainqueur par quiz, en plus du podium.
  //     L'ancienne adresse, celle des liens déjà partagés, mène à l'espace
  //     de l'administrateur.
  const legacyUrl = await fetch(`${url}/recap.json`, { redirect: 'manual' })
  assert(
    legacyUrl.status === 302 && legacyUrl.headers.get('location') === `/s/${SLUG}/recap.json`,
    `l’ancienne adresse doit rediriger vers l’espace par défaut (${legacyUrl.status} ${legacyUrl.headers.get('location')})`,
  )
  const legacyPage = await fetch(`${url}/soirees/abc/bilan`, { redirect: 'manual' })
  assert(legacyPage.headers.get('location') === `/${SLUG}/soirees/abc/bilan`, 'les anciennes pages aussi')
  const recap = (await (await fetch(`${url}/s/${SLUG}/recap.json`)).json()) as any
  assert(recap.space?.slug === SLUG && recap.space.title, 'le souvenir dit de quel espace il parle')
  assert(Array.isArray(recap.quizWinners), 'la page souvenir doit lister les vainqueurs de quiz')
  assert(recap.quizWinners.length >= 2, `au moins 2 quiz joués, ${recap.quizWinners.length} vainqueurs listés`)
  assert(
    recap.quizWinners.every((w: any) => w.name && w.points > 0 && w.title),
    'chaque vainqueur doit avoir un nom, un titre de quiz et des points',
  )
  assert(recap.bestShot?.name, 'le plus beau coup doit être désigné')
  assert(recap.steadiest?.name, 'le plus régulier doit être désigné')

  // 19. Ménage des photos : celles qu'aucun quiz n'utilise plus s'en vont,
  //     celles encore référencées restent, et une photo trop récente est
  //     épargnée — elle vient peut-être d'être envoyée par l'éditeur.
  const store = new QuizStore(quizDbUrl)
  const adminSpace = meAdmin.account.id as string
  const gardee = await store.saveImage(adminSpace, TINY_JPEG)
  const orpheline = await store.saveImage(adminSpace, TINY_JPEG)
  const recente = await store.saveImage(adminSpace, TINY_JPEG)
  const avecPhoto = await store.create(adminSpace, 'Quiz avec photo', [
    {
      kind: 'choice',
      text: 'Où est-ce ?',
      answers: ['Ici', 'Là', '', ''],
      correct: 0,
      image: `/media/image/${gardee}`,
    },
  ])
  // Délai de grâce nul pour les deux premières, une heure pour la troisième.
  // Au moins les deux nôtres : la photo envoyée plus haut par l'API est
  // orpheline elle aussi, et part avec.
  const effacees = await store.pruneImages(adminSpace, 0)
  assert(effacees >= 2, `au moins 2 photos orphelines attendues, ${effacees} effacées`)
  assert(await store.getImage(gardee), 'la photo utilisée par un quiz doit rester')
  assert(!(await store.getImage(orpheline)), "la photo qu'aucun quiz n'utilise doit partir")

  const recenteEpargnee = await store.saveImage(adminSpace, TINY_JPEG)
  assert((await store.pruneImages(adminSpace)) === 0, 'une photo récente ne doit pas être effacée')
  assert(await store.getImage(recenteEpargnee), 'la photo récente doit être intacte')
  void recente

  // Supprimer le quiz libère sa photo.
  await store.remove(adminSpace, avecPhoto.id)
  await store.pruneImages(adminSpace, 0)
  assert(!(await store.getImage(gardee)), 'la photo doit partir avec son dernier quiz')
  store.close()

  // 20. Photo « mémoire » : la photo passe seule, puis disparaît et la question
  //     démarre. Sans cette phase, il suffirait de répondre en la regardant.
  const memo = (await (
    await apiCall('/api/quizzes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Photos de mémoire',
        questions: [
          // Observation longue : l'animateur l'abrège d'un clic.
          {
            text: 'Combien de bougies ?',
            answers: ['Trente', 'Trente et une', '', ''],
            correct: 0,
            duration: 20,
            image: upload.url,
            observeSeconds: 30,
          },
          // Observation courte : elle s'achève toute seule.
          {
            text: 'De quelle couleur est le gâteau ?',
            answers: ['Rose', 'Bleu', '', ''],
            correct: 0,
            duration: 20,
            image: upload.url,
            observeSeconds: 2,
          },
          // Photo ordinaire : elle doit rester affichée pendant la question.
          // Le `null` explicite est ce qu'envoie l'éditeur — et `Number(null)`
          // vaut 0, un piège qui ferait disparaître la photo toute seule.
          {
            text: 'Et cette photo, elle reste ?',
            answers: ['Oui', 'Non', '', ''],
            correct: 0,
            duration: 20,
            image: upload.url,
            observeSeconds: null,
          },
          // Le cas « en quelle année cette photo a-t-elle été prise ? » :
          // l'observation vaut aussi pour une estimation, pas seulement un QCM.
          {
            kind: 'number',
            text: 'En quelle année cette photo a-t-elle été prise ?',
            target: 2019,
            unit: '',
            duration: 20,
            image: upload.url,
            observeSeconds: 2,
          },
        ],
      }),
    })
  ).json()) as any
  assert(memo.questions[0].observeSeconds === 30, 'le temps d’observation doit être enregistré')
  assert(memo.questions[2].observeSeconds === null, 'une photo sans observation reste à null')

  const memoSeen = waitFor<any>(alice2, 'session:view', () => true, 'partie photo chez Alice')
  ;(host as any).emit('host:launch')
  const memoId = (await memoSeen).sessionId
  const observing = waitFor<any>(alice2, 'session:view', p => p.view.phase === 'observe', 'phase d’observation')
  ;(host as any).emit('host:command', { sessionId: memoId, command: { type: 'selectPack', packId: memo.id } })
  const obs = await observing
  assert(obs.view.image === upload.url, 'la photo doit être envoyée pendant l’observation')
  assert(!obs.view.text && !obs.view.answers, 'ni l’intitulé ni les réponses ne doivent partir pendant l’observation')

  // Répondre pendant l'observation n'a aucun effet : il n'y a rien à répondre.
  ;(alice2 as any).emit('player:action', { sessionId: memoId, action: { type: 'answer', choice: 0 } })

  // « Passer à la question » : l'animateur abrège les 30 secondes.
  const skipped = waitFor<any>(alice2, 'session:view', p => p.view.phase === 'question', 'question après abrègement')
  ;(host as any).emit('host:command', { sessionId: memoId, command: { type: 'next' } })
  const memoQ1 = await skipped
  assert(memoQ1.view.image === null, 'la photo ne doit plus être envoyée pendant la question')
  assert(memoQ1.view.photoGone === true, 'le téléphone doit savoir que la photo a disparu')
  assert(memoQ1.view.text === 'Combien de bougies ?', 'l’intitulé doit arriver avec la question')
  assert(memoQ1.view.yourChoice === null, 'la réponse envoyée pendant l’observation ne doit pas compter')

  // La photo revient à la révélation : on vérifie ensemble ce qu'on avait vu.
  const memoRv1 = waitFor<any>(alice2, 'session:view', p => p.view.phase === 'reveal', 'révélation photo')
  ;(alice2 as any).emit('player:action', { sessionId: memoId, action: { type: 'answer', choice: 0 } })
  const rvPhoto = await memoRv1
  assert(rvPhoto.view.image === upload.url, 'la photo doit revenir à la révélation')
  assert(!rvPhoto.view.photoGone, 'plus de mention « disparue » une fois la photo revenue')

  // Question 2 : l'observation s'achève d'elle-même, sans clic.
  const obs2 = waitFor<any>(alice2, 'session:view', p => p.view.phase === 'observe' && p.view.qIndex === 1, 'observation Q2')
  ;(host as any).emit('host:command', { sessionId: memoId, command: { type: 'next' } })
  await obs2
  const auto = await waitFor<any>(
    alice2,
    'session:view',
    p => p.view.phase === 'question' && p.view.qIndex === 1,
    'question après la fin du temps d’observation',
  )
  assert(auto.view.image === null, 'la photo doit disparaître à la fin du temps d’observation')

  // Question 3 : une photo ordinaire ne déclenche aucune observation.
  const q3 = waitFor<any>(alice2, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === 2, 'question 3')
  ;(host as any).emit('host:command', { sessionId: memoId, command: { type: 'next' } })
  await waitFor<any>(alice2, 'session:view', p => p.view.phase === 'reveal' && p.view.qIndex === 1, 'révélation Q2')
  ;(host as any).emit('host:command', { sessionId: memoId, command: { type: 'next' } })
  const plain = await q3
  assert(plain.view.image === upload.url, 'une photo sans observation reste affichée pendant la question')
  assert(!plain.view.photoGone, 'une photo ordinaire ne doit pas être signalée comme disparue')

  // Question 4 : une estimation derrière la photo — « en quelle année ? ».
  ;(host as any).emit('host:command', { sessionId: memoId, command: { type: 'next' } })
  await waitFor<any>(alice2, 'session:view', p => p.view.phase === 'reveal' && p.view.qIndex === 2, 'révélation Q3')
  const obs4 = waitFor<any>(alice2, 'session:view', p => p.view.phase === 'observe' && p.view.qIndex === 3, 'observation Q4')
  ;(host as any).emit('host:command', { sessionId: memoId, command: { type: 'next' } })
  const obsGuess = await obs4
  assert(obsGuess.view.image === upload.url, 'une estimation doit aussi avoir sa photo à observer')
  const guessQ = await waitFor<any>(
    alice2,
    'session:view',
    p => p.view.phase === 'question' && p.view.qIndex === 3,
    'estimation après observation',
  )
  assert(guessQ.view.kind === 'number', `estimation attendue après la photo, reçu ${guessQ.view.kind}`)
  assert(guessQ.view.image === null && guessQ.view.photoGone === true, 'la photo doit avoir disparu de l’estimation')
  ;(host as any).emit('host:endSession', { sessionId: memoId })
  await apiCall(`/api/quizzes/${memo.id}`, { method: 'DELETE' })

  // 21. Équipes : le quiz reste individuel, mais les points se cumulent par
  //     équipe. Création, déplacement d'un invité, suppression d'une équipe,
  //     et conversion du classement en points du tableau des trois jeux.
  const onSnap = (pred: (s: any) => boolean, label: string) =>
    waitFor<any>(host, 'party:snapshot', pred, label)

  const teamsSeeded = onSnap(s => s.teams.length === 6, 'les six équipes par défaut')
  ;(host as any).emit('host:seedTeams')
  const withTeams = await teamsSeeded
  const T = withTeams.teams

  // Rejouer la création par défaut ne doit rien dupliquer : c'est un bouton
  // qu'on peut cliquer deux fois sans y penser.
  const seventh = onSnap(s => s.teams.length === 7, 'équipe créée à la main')
  ;(host as any).emit('host:seedTeams')
  ;(host as any).emit('host:createTeam', { name: 'Les Testeurs', emoji: '🧪' })
  const extra = await seventh
  const jetable = extra.teams.find((t: any) => t.name === 'Les Testeurs')
  assert(jetable, 'équipe créée introuvable dans le classement')

  const backToSix = onSnap(s => s.teams.length === 6, 'équipe supprimée')
  ;(host as any).emit('host:removeTeam', { teamId: jetable.id })
  await backToSix

  // Alice et Charlie ont marqué pendant la soirée : leurs points suivent leur
  // équipe, sans que le journal des scores soit touché.
  const split = onSnap(
    s => s.players.every((p: any) => p.teamId) && s.teams.filter((t: any) => t.memberCount === 1).length === 2,
    'les deux invités répartis',
  )
  ;(host as any).emit('host:assignPlayer', { playerId: aliceAck.playerId, teamId: T[0].id })
  ;(host as any).emit('host:assignPlayer', { playerId: charlieAck.playerId, teamId: T[1].id })
  const splitSnap = await split

  const aliceScore2 = splitSnap.players.find((p: any) => p.id === aliceAck.playerId).score
  const charlieScore = splitSnap.players.find((p: any) => p.id === charlieAck.playerId).score
  const t0 = splitSnap.teams.find((t: any) => t.id === T[0].id)
  assert(t0.memberCount === 1 && t0.total === aliceScore2, `équipe d'Alice à ${t0.total}, attendu ${aliceScore2}`)
  assert(t0.average === aliceScore2, 'à un seul membre, la moyenne vaut le total')

  // Un invité peut se corriger lui-même hors partie — le cas « je me suis
  // trompé de bouton à l'inscription ».
  const regrouped = onSnap(s => s.teams.some((t: any) => t.memberCount === 2), 'Alice a rejoint Charlie')
  const moved = await emitAck<any>(alice2, 'player:setTeam', { teamId: T[1].id })
  assert(moved.ok, 'changement d’équipe refusé hors partie')
  const regroupedSnap = await regrouped

  const t1 = regroupedSnap.teams.find((t: any) => t.id === T[1].id)
  assert(t1.total === aliceScore2 + charlieScore, 'le total d’équipe doit suivre le déménagement')
  assert(
    t1.average === Math.round((aliceScore2 + charlieScore) / 2),
    `moyenne par membre à ${t1.average}, attendu ${Math.round((aliceScore2 + charlieScore) / 2)}`,
  )
  const vide = regroupedSnap.teams.find((t: any) => t.id === T[0].id)
  assert(vide.memberCount === 0 && vide.average === 0, 'une équipe quittée retombe à zéro')

  // Le barème part du nombre d'équipes : à six équipes, la première rapporte 6.
  const standings = rankTeams(regroupedSnap.teams)
  assert(standings[0].id === T[1].id, 'la seule équipe à avoir marqué doit être première')
  assert(standings[0].gamePoints === 6, `première équipe à ${standings[0].gamePoints} points de jeu, attendu 6`)
  // Les cinq équipes encore vides sont à égalité : même rang, mêmes points.
  const exAequo = standings.slice(1)
  assert(
    exAequo.every(t => t.rank === 2 && t.gamePoints === 5),
    'les équipes à égalité doivent partager rang et points',
  )

  // Le barème lui-même, sur six équipes toutes différentes : 6, 5, 4, 3, 2, 1.
  const bareme = rankTeams(
    [500, 400, 300, 200, 100, 50].map((average, i) => ({
      id: `t${i}`,
      name: `Équipe ${i}`,
      emoji: '🎈',
      position: i,
      memberCount: 1,
      total: average,
      average,
      bonus: 0,
    })),
  ).map(t => t.gamePoints)
  assert(
    bareme.join(',') === '6,5,4,3,2,1',
    `barème des trois jeux faux : ${bareme.join(', ')}`,
  )

  // Supprimer une équipe n'exclut personne : ses membres redeviennent libres
  // et gardent leurs points.
  const dissolved = onSnap(s => s.teams.length === 5 && s.players.every((p: any) => !p.teamId), 'équipe dissoute')
  ;(host as any).emit('host:removeTeam', { teamId: T[1].id })
  const dissolvedSnap = await dissolved
  assert(
    dissolvedSnap.players.find((p: any) => p.id === aliceAck.playerId).score === aliceScore2,
    'les points ne doivent pas partir avec l’équipe supprimée',
  )

  const reassigned = onSnap(s => s.teams.some((t: any) => t.memberCount === 2), 'invités replacés')
  ;(host as any).emit('host:assignPlayer', { playerId: aliceAck.playerId, teamId: T[0].id })
  ;(host as any).emit('host:assignPlayer', { playerId: charlieAck.playerId, teamId: T[0].id })
  await reassigned

  // 22. Statistiques et prix : le journal des réponses alimente les prix de
  //     fin de soirée, et l'animateur les attribue à la main.
  const stats = (await (await fetch(`${url}/s/${SLUG}/recap.json`)).json()) as any
  assert(stats.stats, 'la page souvenir doit porter les statistiques')
  assert(stats.stats.logged > 0, 'le journal des réponses ne doit pas être vide')
  assert(stats.stats.questions > 0, 'des questions doivent avoir été comptées')

  const aliceStat = stats.stats.players.find((p: any) => p.playerId === aliceAck.playerId)
  assert(aliceStat, 'Alice doit apparaître dans les statistiques')
  assert(aliceStat.answered > 0, 'Alice a répondu, ça doit se voir')
  assert(aliceStat.correct > 0, 'Alice a eu des bonnes réponses')
  assert(
    aliceStat.asked >= aliceStat.answered,
    'on ne peut pas répondre à plus de questions qu’on en a reçues',
  )
  assert(aliceStat.avgMs !== null && aliceStat.avgMs > 0, 'un temps de réponse moyen est attendu')
  assert(aliceStat.wrong >= 1, 'Alice s’est trompée au moins une fois dans le parcours')
  assert(aliceStat.guesses >= 1, 'Alice a joué au moins une estimation')

  // Un joueur exclu ne doit plus peser sur les prix : Bob a été retiré.
  assert(
    !stats.stats.players.some((p: any) => p.playerId === bobAck.playerId),
    'les réponses d’un invité exclu doivent disparaître des statistiques',
  )

  // Ne pas répondre n'est pas répondre faux : quelqu'un qui n'a jamais touché
  // son téléphone ne doit pas décrocher le prix de la plus longue série noire.
  assert(
    stats.stats.players.every((p: any) => p.answered > 0 || (p.worstStreak === 0 && p.bestStreak === 0)),
    'une question laissée passer ne doit alimenter aucune série',
  )

  assert(Array.isArray(stats.stats.awards), 'les prix doivent être une liste')
  assert(stats.stats.awards.length > 0, 'au moins un prix doit être proposé')
  assert(
    stats.stats.awards.every((a: any) => a.key && a.title && a.rule && a.detail),
    'chaque prix doit porter son titre, sa règle et le chiffre qui le justifie',
  )

  // 22 bis. Le bilan : ce que chacun a répondu, question par question. Le
  //         journal ne garde que des numéros ; les intitulés reviennent de la
  //         copie du quiz gardée dans chaque partie terminée — même pour les
  //         quiz supprimés depuis.
  const bilan = (await (await fetch(`${url}/s/${SLUG}/bilan.json`)).json()) as any
  assert(
    bilan.questions.length === stats.stats.questions,
    `${bilan.questions.length} questions au bilan, ${stats.stats.questions} aux statistiques`,
  )
  assert(!bilan.players.some((p: any) => p.name === 'Bobette'), 'le bilan de l’administrateur ne connaît pas les invités de Bob')
  assert(bilan.unresolved === 0, `${bilan.unresolved} question(s) sans intitulé alors que les parties sont encore sur le disque`)
  assert(
    bilan.questions.every(
      (q: any) =>
        q.text && (q.kind === 'number' ? q.target !== null : q.answers.length >= 2 && q.answers[q.correct] !== undefined),
    ),
    'chaque question du bilan doit porter son intitulé et sa bonne réponse',
  )
  assert(
    bilan.questions.some((q: any) => q.kind === 'number' && q.closest),
    'une estimation doit désigner la proposition la plus proche',
  )
  const aliceBilan = bilan.players.find((p: any) => p.id === aliceAck.playerId)
  assert(aliceBilan, 'Alice doit avoir son bilan')
  assert(
    aliceBilan.answers.length === aliceStat.asked,
    `${aliceBilan.answers.length} réponses au bilan d’Alice, ${aliceStat.asked} questions posées`,
  )
  assert(aliceBilan.rank >= 1 && aliceBilan.teamRank !== null, 'Alice doit avoir un rang dans la salle et dans son équipe')
  assert(
    aliceBilan.answers.every((a: any) => bilan.questions.some((q: any) => q.key === a.questionKey)),
    'chaque réponse doit renvoyer à une question du bilan',
  )
  assert(
    aliceBilan.answers.some((a: any) => a.answered && a.correct === true && a.choice !== null),
    'les bonnes réponses d’Alice doivent être là, avec la réponse choisie',
  )
  assert(
    aliceBilan.answers.some((a: any) => a.proximityRank !== null),
    'l’estimation jouée par Alice doit porter son rang de proximité',
  )
  assert(bilan.quizzes.length >= 2 && bilan.teams.length === 5, 'le bilan doit compter les quiz et les équipes de la soirée')
  assert(
    bilan.teams.every((t: any) => t.perQuiz.length === bilan.quizzes.length),
    'chaque équipe doit avoir une ligne par quiz',
  )
  assert(
    bilan.questions.some((q: any) => q.byTeam.some((t: any) => t.teamId === T[0].id && t.asked >= 1)),
    'l’équipe d’Alice doit apparaître sur les questions qu’elle a jouées',
  )
  assert(!bilan.players.some((p: any) => p.id === bobAck.playerId), 'un invité exclu n’a pas de bilan')

  // L'export : les mêmes chiffres en fichiers, depuis le serveur et depuis la base.
  const exportDir = path.join(tmpDir, 'export')
  const exported = writeExport(bilan, exportDir)
  assert(exported.length === 4 && exported.every(f => existsSync(f)), 'l’export doit écrire ses quatre fichiers')
  const invites = readFileSync(path.join(exportDir, 'invites.csv'), 'utf8')
  const joueurs = bilan.players.filter((p: any) => p.stat.asked > 0).length
  assert(
    invites.startsWith('\uFEFF') && invites.trim().split('\r\n').length === joueurs + 1,
    'invites.csv : une ligne par invité qui a joué, plus l’en-tête',
  )
  assert(invites.includes('Alice;'), 'Alice doit figurer dans l’export')
  const fromDb = await reviewFromDatabase(quizDbUrl)
  assert(
    fromDb.questions.length === bilan.questions.length,
    `${fromDb.questions.length} questions depuis la base, ${bilan.questions.length} depuis le serveur`,
  )
  assert(fromDb.players.length === bilan.players.length, 'la base doit connaître les mêmes invités que le serveur')
  assert(!fromDb.players.some((p: any) => p.name === 'Bobette'), 'l’export sans nom d’espace lit l’espace par défaut, pas celui de Bob')
  const bobFromDb = await reviewFromDatabase(quizDbUrl, undefined, { slug: 'chez-bob' })
  assert(bobFromDb.players.some((p: any) => p.name === 'Bobette'), 'l’export sait viser l’espace de Bob')
  // Sans les copies des parties, seuls les quiz encore en bibliothèque retrouvent leurs intitulés.
  const deletedTitles = new Set(['Spécial Romane', 'Sabotage', 'Photos de mémoire'])
  assert(
    fromDb.questions.every((q: any) => q.resolved === !deletedTitles.has(q.quizTitle)),
    'depuis la base, un quiz supprimé n’a plus d’intitulé, les autres si',
  )

  // Attribution : les points s'ajoutent au total de l'équipe, pas à la moyenne.
  // Le classement d'avant se lit dans la page souvenir déjà chargée : le
  // serveur ne rediffuse que sur changement, attendre un message n'aboutirait pas.
  const teamBefore = stats.teams.find((t: any) => t.id === T[0].id)
  const awarded = onSnap(s => s.bonuses.length === 1, 'prix enregistré')
  ;(host as any).emit('host:awardTeam', { teamId: T[0].id, points: 3, reason: 'L’Éclair' })
  const withBonus = await awarded
  const teamAfter = withBonus.teams.find((t: any) => t.id === T[0].id)
  assert(teamAfter.bonus === 3, `bonus d’équipe à ${teamAfter.bonus}, attendu 3`)
  assert(
    teamAfter.average === teamBefore.average,
    'un prix ne doit pas toucher à la moyenne du quiz',
  )
  const ranked = finalRanking(withBonus.teams)
  const winner = ranked.find((t: any) => t.id === T[0].id)!
  assert(
    winner.finalPoints === winner.gamePoints + 3,
    `total final à ${winner.finalPoints}, attendu ${winner.gamePoints + 3}`,
  )

  // Un prix mal donné se retire.
  const bonusGone = onSnap(s => s.bonuses.length === 0, 'prix retiré')
  ;(host as any).emit('host:removeBonus', { bonusId: withBonus.bonuses[0].id })
  const cleanedUp = await bonusGone
  assert(
    cleanedUp.teams.find((t: any) => t.id === T[0].id).bonus === 0,
    'retirer le prix doit ramener le bonus à zéro',
  )

  // On en remet un pour vérifier qu'il survit au redémarrage.
  const kept = onSnap(s => s.bonuses.length === 1, 'prix conservé pour la coupure')
  ;(host as any).emit('host:awardTeam', { teamId: T[0].id, points: 2, reason: 'Le Cancre Magnifique' })
  const beforeRestart = await kept

  // 23. Redémarrage du serveur avec disque effacé — le scénario d'un
  //     hébergeur gratuit qui recycle l'instance en pleine soirée. Invités,
  //     équipes et points doivent revenir depuis la base distante.
  // Le dernier classement reçu fait foi : plus rien ne bouge à ce stade, donc
  // attendre un nouveau message expirerait.
  const aliceBefore = beforeRestart.players.find((p: any) => p.id === aliceAck.playerId)
  assert(aliceBefore?.score > 0, 'Alice devrait avoir des points avant la coupure')

  // La coupure arrive en pleine question : la partie doit revenir avec les
  // points, pas seulement les points.
  const livePick = waitFor<any>(host, 'session:view', p => p.view.phase === 'pickPack', 'liste des quiz (coupure)')
  ;(host as any).emit('host:launch')
  const liveId = (await livePick).sessionId
  ;(host as any).emit('host:command', { sessionId: liveId, command: { type: 'selectPack', packId: 'culture-generale' } })
  await waitFor<any>(alice2, 'session:view', p => p.sessionId === liveId && p.view.phase === 'question', 'question en cours au moment de la coupure')
  // Chez Bob aussi, une partie est en cours : les deux doivent revenir.
  const bobLive = waitFor<any>(bobHost2, 'session:view', p => p.view.phase === 'pickPack', 'nouvelle partie de Bob')
  ;(bobHost2 as any).emit('host:launch')
  const bobLiveId = (await bobLive).sessionId
  ;(bobHost2 as any).emit('host:command', { sessionId: bobLiveId, command: { type: 'selectPack', packId: bobQuiz.id } })
  await waitFor<any>(bobette, 'session:view', p => p.sessionId === bobLiveId && p.view.phase === 'question', 'question chez Bob au moment de la coupure')

  host.disconnect()
  bob.disconnect()
  alice2.disconnect()
  bobHost2.disconnect()
  bobette.disconnect()
  await server.close()

  // Le disque local disparaît, la base distante reste.
  for (const suffix of ['', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true })

  const server2 = await createQuizServer({
    port: 0,
    dbPath: path.join(tmpDir, 'apres-redemarrage.db'),
    admin: ADMIN,
    quizDbUrl,
  })
  const probe = clientIo(`http://localhost:${server2.port}`, { transports: ['websocket'] })
  const after2 = await watch(probe, SLUG)
  assert(after2.players.length > 0, 'soirée rechargée')
  const aliceAfter = after2.players.find((p: any) => p.id === aliceAck.playerId)
  assert(
    aliceAfter?.score === aliceBefore.score,
    `score perdu au redémarrage : ${aliceAfter?.score} au lieu de ${aliceBefore.score}`,
  )
  assert(aliceAfter?.name === 'Alice', 'le nom du joueur doit être rechargé lui aussi')
  assert(after2.bonuses.length === 1, 'les prix remis doivent survivre au redémarrage')
  const statsAfter = (await (await fetch(`http://localhost:${server2.port}/s/${SLUG}/recap.json`)).json()) as any
  assert(
    statsAfter.stats.logged === stats.stats.logged,
    `journal des réponses perdu au redémarrage : ${statsAfter.stats.logged} au lieu de ${stats.stats.logged}`,
  )
  assert(after2.teams.length === 5, `${after2.teams.length} équipes rechargées, attendu 5`)
  assert(aliceAfter?.teamId === T[0].id, 'l’équipe de chacun doit survivre au redémarrage')
  const t0After = after2.teams.find((t: any) => t.id === T[0].id)
  assert(t0After?.memberCount === 2, 'les deux membres doivent être recomptés dans leur équipe')
  // Le bilan survit aussi : sans les copies des parties (disque effacé), les
  // intitulés reviennent de la bibliothèque — sauf pour les quiz supprimés.
  const bilanAfter = (await (await fetch(`http://localhost:${server2.port}/s/${SLUG}/bilan.json`)).json()) as any
  assert(
    bilanAfter.questions.length === bilan.questions.length,
    `bilan perdu au redémarrage : ${bilanAfter.questions.length} questions au lieu de ${bilan.questions.length}`,
  )
  for (const q of bilanAfter.questions) {
    const before = bilan.questions.find((o: any) => o.key === q.key)
    assert(before, `question ${q.key} inconnue avant le redémarrage`)
    if (deletedTitles.has(q.quizTitle)) {
      assert(!q.resolved, 'un quiz supprimé ne peut plus livrer ses intitulés après un redémarrage')
    } else {
      assert(
        q.resolved && q.text === before.text && !q.uncertain,
        `intitulé changé au redémarrage : « ${q.text} » au lieu de « ${before.text} »`,
      )
    }
  }
  const aliceAfterBilan = bilanAfter.players.find((p: any) => p.id === aliceAck.playerId)
  assert(
    aliceAfterBilan?.answers.length === aliceBilan.answers.length,
    'les réponses d’Alice doivent revenir avec le bilan après redémarrage',
  )
  assert(after2.session?.id === liveId, 'la partie en cours doit revenir avec la soirée')
  // Le téléphone d'Alice se reconnecte et retrouve la question là où elle en était.
  const alice3 = clientIo(`http://localhost:${server2.port}`, { transports: ['websocket'] })
  const backInGame = waitFor<any>(alice3, 'session:view', p => p.sessionId === liveId, 'vue de la partie reprise')
  const rejoined = await emitAck<any>(alice3, 'player:join', { slug: SLUG, name: 'Alice', avatar: '🦊', token: aliceAck.token })
  assert(rejoined.ok && rejoined.playerId === aliceAck.playerId, 'reconnexion par jeton après redémarrage')
  const resumedGame = await backInGame
  assert(
    resumedGame.view.phase === 'question' && resumedGame.view.qIndex === 0,
    `la question en cours doit reprendre, vu ${resumedGame.view.phase} Q${resumedGame.view.qIndex + 1}`,
  )
  // La soirée de Bob revient elle aussi, sa partie en cours comprise — sans
  // que personne ne l'ait réveillée : ses chronomètres doivent repartir.
  const url2 = `http://localhost:${server2.port}`
  const bobBack = (await (await fetch(`${url2}/s/chez-bob/recap.json`)).json()) as any
  assert(bobBack.ranking.some((r: any) => r.name === 'Bobette'), 'la soirée de Bob doit revenir du miroir')
  const bobHost3 = connectHost(url2, bobCookie2)
  const bobResumed = waitFor<any>(bobHost3, 'party:snapshot', s => s.session?.id === bobLiveId, 'la partie de Bob reprise')
  assert((await emitAck<any>(bobHost3, 'host:hello', {})).ok, 'l’écran commun de Bob après redémarrage')
  await bobResumed
  const probeStranger = await watch(clientIo(url2, { transports: ['websocket'] }), 'chez-bob')
  assert(
    probeStranger.players.length === 1 && !probeStranger.players.some((p: any) => p.id === aliceAck.playerId),
    'après redémarrage, la salle de Bob ne contient toujours que Bobette',
  )
  ;(bobHost3 as any).emit('host:endSession', { sessionId: bobLiveId })
  bobHost3.disconnect()

  // 30. L'historique : la soirée se range dans la base permanente, questions
  //     comprises, et se relit avec les mêmes pages. « Nouvelle soirée »
  //     l'archive avant d'effacer, sans doublon ni perte de titre.
  // La session vit dans la base permanente : le même cookie ouvre l'écran
  // commun du serveur relancé.
  const host2 = connectHost(url2, cookie)
  const hello2 = await emitAck<{ ok: boolean }>(host2, 'host:hello', {})
  assert(hello2.ok, 'écran commun refusé après redémarrage')
  const archivedToast = waitFor<any>(host2, 'toast', t => t.kind === 'info', 'soirée archivée')
  ;(host2 as any).emit('host:archiveParty', { title: 'Soirée de test' })
  await archivedToast
  const soirees = (await (await fetch(`${url2}/s/${SLUG}/soirees.json`)).json()) as any
  assert(soirees.current && soirees.current.players > 0, 'la soirée en cours doit figurer dans l’historique')
  assert(
    soirees.archives.length === 1 && soirees.archives[0].title === 'Soirée de test',
    'la soirée archivée doit être listée sous son titre',
  )
  const archiveId = soirees.archives[0].id
  // L'ancienne adresse d'une archive mène à celle de l'espace par défaut.
  const archivedBilan = (await (await fetch(`${url2}/soirees/${archiveId}/bilan.json`)).json()) as any
  assert(archivedBilan.archive?.id === archiveId, 'le bilan archivé doit dire quelle soirée il relit')
  assert(archivedBilan.space?.slug === SLUG, 'le bilan archivé dit aussi son espace')
  assert(
    archivedBilan.questions.length === bilan.questions.length,
    `${archivedBilan.questions.length} questions dans l’archive, ${bilan.questions.length} en direct`,
  )
  assert(
    archivedBilan.questions.every(
      (q: any, i: number) => q.text === bilanAfter.questions[i].text && q.resolved === bilanAfter.questions[i].resolved,
    ),
    'l’archive doit emporter les questions telles qu’elles ont été retrouvées',
  )
  const archivedRecap = (await (await fetch(`${url2}/s/${SLUG}/soirees/${archiveId}/recap.json`)).json()) as any
  assert(
    archivedRecap.archive?.id === archiveId && archivedRecap.ranking.length === statsAfter.ranking.length,
    'le souvenir archivé doit reprendre le classement',
  )
  assert(archivedRecap.stats.logged === statsAfter.stats.logged, 'les statistiques archivées doivent compter les mêmes réponses')

  // Renommer demande une session ; lire, non.
  const anonRename = await write(url2, `/api/soirees/${archiveId}`, { title: 'Pirate' }, undefined, 'PUT')
  assert(anonRename.status === 401, 'renommer une soirée sans session doit être refusé')
  const renamedSoiree = await write(url2, `/api/soirees/${archiveId}`, { title: 'Les 30 ans de Romane' }, cookie, 'PUT')
  assert(renamedSoiree.ok, 'renommer une soirée avec sa session')

  // « Nouvelle soirée » : la même soirée est mise à jour, son titre reste, le direct est vide.
  const wiped = waitFor<any>(probe, 'party:snapshot', s => s.players.length === 0, 'soirée vierge')
  ;(host2 as any).emit('host:resetParty')
  await wiped
  const afterReset = (await (await fetch(`${url2}/s/${SLUG}/soirees.json`)).json()) as any
  assert(afterReset.current === null, 'après remise à zéro, plus de soirée en cours')
  assert(
    afterReset.archives.length === 1 && afterReset.archives[0].title === 'Les 30 ans de Romane',
    'la remise à zéro met l’archive à jour sans doublon ni perte de titre',
  )
  const emptyLive = (await (await fetch(`${url2}/s/${SLUG}/bilan.json`)).json()) as any
  assert(emptyLive.questions.length === 0, 'le bilan en direct doit être vide après remise à zéro')
  const stillThere = (await (await fetch(`${url2}/s/${SLUG}/soirees/${archiveId}/bilan.json`)).json()) as any
  assert(stillThere.questions.length === bilan.questions.length, 'l’archive doit rester lisible après la remise à zéro')
  // La remise à zéro de l'administrateur n'a pas touché la soirée de Bob.
  const bobUntouched = (await (await fetch(`${url2}/s/chez-bob/recap.json`)).json()) as any
  assert(bobUntouched.ranking.some((r: any) => r.name === 'Bobette'), 'repartir de zéro n’efface que sa propre soirée')

  // L'export sait viser une soirée archivée, depuis le serveur comme depuis la base.
  const fromArchive = await reviewFromServer(url2, { slug: SLUG, archiveId })
  assert(fromArchive.questions.length === bilan.questions.length, 'l’export doit pouvoir viser une soirée archivée')
  const fromArchiveLegacy = await reviewFromServer(url2, { archiveId })
  assert(fromArchiveLegacy.questions.length === bilan.questions.length, 'sans nom d’espace, l’export suit l’ancienne adresse')
  const fromArchiveDb = await reviewFromDatabase(quizDbUrl, undefined, { archiveId })
  assert(fromArchiveDb.questions.length === bilan.questions.length, 'l’export depuis la base doit lire l’archive')

  // Retirer une soirée de l'historique.
  const removedSoiree = await fetch(`${url2}/api/soirees/${archiveId}`, {
    method: 'DELETE',
    headers: { Cookie: cookie, 'X-Requested-With': 'quizz' },
  })
  assert(removedSoiree.ok, 'retirer une soirée avec sa session')
  const gone = await fetch(`${url2}/s/${SLUG}/soirees/${archiveId}/bilan.json`)
  assert(gone.status === 404, 'une soirée retirée ne se relit plus')
  host2.disconnect()

  alice3.disconnect()
  probe.disconnect()
  await server2.close()

  // 31. La mise à jour d'une base d'avant les comptes : un quiz, une archive,
  //     une soirée en cours dans des tables sans espace. Au démarrage, tout
  //     se retrouve sous l'espace de l'administrateur, aux mêmes adresses.
  const legacyDir = mkdtempSync(path.join(tmpdir(), 'quizz-legacy-'))
  const legacyQuizUrl = `file:${path.join(legacyDir, 'quizzes.db').replace(/\\/g, '/')}`
  const legacyDbPath = path.join(legacyDir, 'local.db')
  const legacy = createClient({ url: legacyQuizUrl })
  const legacyArchive = JSON.stringify({ version: 1, players: [], teams: [], bonuses: [], scores: [], answers: [], packs: {} })
  await legacy.batch(
    [
      `CREATE TABLE quizzes (id TEXT PRIMARY KEY, title TEXT NOT NULL, questions TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
      {
        sql: 'INSERT INTO quizzes VALUES (?, ?, ?, ?, ?)',
        args: ['ancien', 'Quiz d’avant', JSON.stringify([{ text: 'Avant ?', answers: ['Oui', 'Non', '', ''], correct: 0, duration: 20 }]), 1, 1],
      },
      `CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
      `INSERT INTO meta VALUES ('seeded', '1')`,
      `CREATE TABLE soirees (id TEXT PRIMARY KEY, title TEXT NOT NULL, held_at INTEGER NOT NULL, archived_at INTEGER NOT NULL, summary TEXT NOT NULL, data TEXT NOT NULL)`,
      { sql: 'INSERT INTO soirees VALUES (?, ?, ?, ?, ?, ?)', args: ['2026-09-19-abcde', 'Soirée d’avant', 1, 1, '{}', legacyArchive] },
      `CREATE TABLE party_players (id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL, token TEXT NOT NULL, created_at INTEGER NOT NULL)`,
      { sql: 'INSERT INTO party_players VALUES (?, ?, ?, ?, ?)', args: ['p-ancien', 'Ancien', '🕰️', 'jeton-ancien', 1] },
      `CREATE TABLE party_scores (id TEXT PRIMARY KEY, player_id TEXT NOT NULL, session_id TEXT, points INTEGER NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL)`,
      { sql: 'INSERT INTO party_scores VALUES (?, ?, ?, ?, ?, ?)', args: ['s-ancien', 'p-ancien', null, 150, 'Quiz d’avant', 2] },
    ],
    'write',
  )
  legacy.close()
  const server3 = await createQuizServer({ port: 0, dbPath: legacyDbPath, admin: ADMIN, quizDbUrl: legacyQuizUrl })
  const url3 = `http://localhost:${server3.port}`
  const cookie3 = await loginAs(url3, ADMIN.login, ADMIN.password)
  const legacyQuizzes = (await (await fetch(`${url3}/api/quizzes`, { headers: { Cookie: cookie3 } })).json()) as any[]
  assert(
    legacyQuizzes.length === 1 && legacyQuizzes[0].id === 'ancien',
    'le quiz d’avant les comptes doit être dans la bibliothèque de l’administrateur, et rien d’autre',
  )
  const legacySoirees = (await (await fetch(`${url3}/s/${SLUG}/soirees.json`)).json()) as any
  assert(
    legacySoirees.archives.length === 1 && legacySoirees.archives[0].title === 'Soirée d’avant',
    'l’archive d’avant les comptes doit être dans l’historique de l’administrateur',
  )
  assert(
    (await fetch(`${url3}/s/${SLUG}/soirees/2026-09-19-abcde/recap.json`)).ok,
    'l’archive garde son identifiant : les liens déjà partagés restent valables',
  )
  const legacyRecap = (await (await fetch(`${url3}/s/${SLUG}/recap.json`)).json()) as any
  assert(
    legacyRecap.ranking.some((r: any) => r.name === 'Ancien' && r.points === 150),
    'la soirée en cours d’avant les comptes doit revenir du miroir sous l’espace de l’administrateur',
  )
  const legacyCheck = createClient({ url: legacyQuizUrl })
  const orphans = await legacyCheck.execute(
    `SELECT (SELECT COUNT(*) FROM quizzes WHERE space_id IS NULL)
          + (SELECT COUNT(*) FROM party_players WHERE space_id IS NULL)
          + (SELECT COUNT(*) FROM party_scores WHERE space_id IS NULL)
          + (SELECT COUNT(*) FROM soirees WHERE space_id IS NULL) AS n`,
  )
  assert(Number(orphans.rows[0].n) === 0, 'plus aucune ligne sans espace après la mise à jour')
  legacyCheck.close()
  await server3.close()
  // Un second démarrage sur la même base ne refait rien de travers.
  const server4 = await createQuizServer({ port: 0, dbPath: legacyDbPath, admin: ADMIN, quizDbUrl: legacyQuizUrl })
  const secondBoot = (await (await fetch(`http://localhost:${server4.port}/s/${SLUG}/soirees.json`)).json()) as any
  assert(secondBoot.archives.length === 1, 'la mise à jour est idempotente')
  await server4.close()

  // 32. La marge réseau de fin de question, et l'heure du serveur.
  //
  //     Le chronomètre du serveur coupait 400 ms après l'échéance affichée —
  //     moins qu'un aller simple depuis un téléphone en 4G dans une salle où
  //     cinquante autres partagent la cellule. Une réponse tapée juste avant
  //     la fin mourait en route, sans un mot.
  //
  //     Sur son propre serveur : la question dure cinq secondes et la soirée
  //     ne sert qu'à ça, sans venir troubler les chiffres d'à côté.
  const chronoDir = mkdtempSync(path.join(tmpdir(), 'quizz-chrono-'))
  const chrono = await createQuizServer({
    port: 0,
    dbPath: path.join(chronoDir, 'local.db'),
    admin: ADMIN,
    quizDbUrl: `file:${path.join(chronoDir, 'quizzes.db').replace(/\\/g, '/')}`,
  })
  const chronoUrl = `http://localhost:${chrono.port}`
  const chronoCookie = await loginAs(chronoUrl, ADMIN.login, ADMIN.password)
  const chronoCall = (p: string, init: RequestInit = {}) =>
    fetch(`${chronoUrl}${p}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', Cookie: chronoCookie },
    })

  const court = (await (
    await chronoCall('/api/quizzes', { method: 'POST', body: JSON.stringify({ title: 'Question courte' }) })
  ).json()) as any
  await chronoCall(`/api/quizzes/${court.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: 'Question courte',
      questions: [{ text: 'Juste à temps ?', answers: ['Oui', 'Non', '', ''], correct: 0, duration: 5, image: null }],
    }),
  })

  const tardif = clientIo(chronoUrl, { transports: ['websocket'] })
  await emitAck(tardif, 'party:watch', { slug: SLUG })
  await emitAck<any>(tardif, 'player:join', { slug: SLUG, name: 'Tardif', avatar: '🐢' })

  // L'heure du serveur : c'est elle que les téléphones prennent pour cadrer
  // leurs chronomètres, au lieu de leur propre horloge qui dérive.
  const heure = await emitAck<{ serverNow: number }>(tardif, 'time:sync', {})
  assert(
    Math.abs(heure.serverNow - Date.now()) < 2000,
    `l’heure du serveur doit être celle de sa machine (écart : ${heure.serverNow - Date.now()} ms)`,
  )

  const chronoHost = connectHost(chronoUrl, chronoCookie)
  assert((await emitAck<any>(chronoHost, 'host:hello', {})).ok, 'l’écran commun du serveur de chronométrage')
  const courtSeen = waitFor<any>(chronoHost, 'session:view', p => p.view.phase === 'pickPack', 'liste du quiz court')
  ;(chronoHost as any).emit('host:launch')
  const courtId = (await courtSeen).sessionId
  ;(chronoHost as any).emit('host:command', { sessionId: courtId, command: { type: 'selectPack', packId: court.id } })
  const qCourte = await waitFor<any>(tardif, 'session:view', p => p.view.phase === 'question', 'question courte affichée')

  // Passé l'échéance affichée — au-delà des 400 ms d'avant, en deçà de la
  // marge d'aujourd'hui.
  const retard = 700
  await new Promise(r => setTimeout(r, Math.max(0, qCourte.view.deadline + retard - Date.now())))
  const inExtremis = await emitAck<any>(tardif, 'player:action', {
    sessionId: courtId,
    action: { type: 'answer', choice: 0 },
  })
  assert(inExtremis.ok, `réponse perdue ${retard} ms après l’échéance affichée : ${inExtremis.error}`)
  const rvCourte = await waitFor<any>(tardif, 'session:view', p => p.view.phase === 'reveal', 'révélation de la question courte')
  // Elle vaut la bonne réponse, mais le bonus de rapidité est épuisé : c'est
  // exactement le compromis voulu.
  assert(
    rvCourte.view.yourPoints === 100,
    `une réponse arrivée après l’échéance vaut la bonne réponse sans le bonus, vu ${rvCourte.view.yourPoints}`,
  )
  tardif.disconnect()
  chronoHost.disconnect()
  await chrono.close()
  rmSync(chronoDir, { recursive: true, force: true })

  console.log('✅ Smoke test OK — 38 étapes')
  console.log(
    '   collage de questions, comptes et sessions, suppression d’un compte, garde-fous, isolation des espaces, quiz complet, bibliothèque,',
  )
  console.log(
    '   accusé de réception des réponses, heure du serveur et marge de fin de question, photos, estimation, sabotage,',
  )
  console.log(
    '   retardataire, pause, enchaînement automatique, annulation, question reposée,',
  )
  console.log(
    '   invité renommé et exclu, ménage des photos, photo « mémoire », équipes, barème des trois jeux,',
  )
  console.log(
    '   statistiques et prix remis à la main, bilan question par question et export, anciennes adresses,',
  )
  console.log('   reprise après coupure avec deux parties en cours, historique des soirées, mise à jour d’une base d’avant les comptes')
  process.exit(0)
} catch (e) {
  fail((e as Error).message)
}
