// Le téléphone qui meurt en pleine soirée (tablée du 24 septembre, Rachid) :
// son invité reste hors ligne, attendu à chaque question ; le téléphone
// emprunté ne peut qu'inscrire un second « Rachid » ; et la console ne dit
// pas qui la salle attend. Trois gestes y répondent, tous à l'animateur :
// voir qui n'a pas répondu, ne plus attendre un hors-ligne, rendre sa place.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  cookieDe,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
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
import { ESSAIS_MANQUES_MAX, PlacesRendues, VIE_DU_CODE_MS } from '../src/core/places'

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

const envoyer = (s: Socket, event: string, ...args: unknown[]) => (s as any).emit(event, ...args)

/** La prochaine vue de partie qui satisfait le prédicat. */
const vue = (s: Socket, pred: (v: any) => boolean, label: string, timeoutMs = 8000) =>
  attendre<any>(s, 'session:view', p => pred(p.view), label, timeoutMs).then(p => p.view)

/** Une vue qui ne vient PAS dans le délai : rend vrai si elle est venue. */
const vient = (s: Socket, pred: (v: any) => boolean, ms: number) =>
  attendre<any>(s, 'session:view', p => pred(p.view), 'absence', ms).then(
    () => true,
    () => false,
  )

const repondre = (i: Invite, sessionId: string, v: any, choice: number) =>
  emitAck<any>(i.socket, 'player:action', {
    sessionId,
    action: { type: 'answer', choice, qIndex: v.qIndex, round: v.round },
    slug: SLUG,
    token: i.token,
  })

const commande = (host: Socket, sessionId: string, command: unknown) => envoyer(host, 'host:command', { sessionId, command })

const suivante = (host: Socket, sessionId: string, v: any) =>
  commande(host, sessionId, { type: 'next', phase: v.phase, qIndex: v.qIndex, round: v.round })

/** Le téléphone qui revient : une connexion neuve, puis il se re-présente avec son jeton. */
async function revient(i: Invite): Promise<Invite> {
  const socket = connecter(banc.url)
  assert.equal((await emitAck<any>(socket, 'party:watch', { slug: SLUG })).ok, true)
  const ack = await emitAck<any>(socket, 'player:join', { slug: SLUG, token: i.token })
  assert.equal(ack.ok, true, 'le téléphone revenu retrouve sa fiche')
  return { socket, playerId: ack.playerId, token: ack.token }
}

/** Termine le quiz en cours et laisse partir tout le monde : chaque test part d'une salle vide. */
async function ranger(host: Socket, sessionId: string, sockets: Socket[]) {
  envoyer(host, 'host:endSession', { sessionId })
  for (const s of sockets) s.close()
  await patienter(200)
}

/** Exclut tout le monde : les tests se partagent un serveur, et un invité resté serait attendu au suivant. */
async function viderLaSalle(host: Socket) {
  const snap = await instantane<any>(host)
  for (const p of snap.players) envoyer(host, 'host:removePlayer', { playerId: p.id })
  await instantane<any>(host, s => s.players.length === 0, 'la salle vide')
}

describe('le téléphone perdu', () => {
  test('« Qui n’a pas répondu ? » : les prénoms attendus, à la console seulement', async () => {
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Première ?', ['Oui', 'Non'], 0, 60)], 'Qui manque')
    const host = await ecranCommun(banc.url, cookie)
    await viderLaSalle(host)
    const alice = await invite(banc.url, 'Alice', '🦊')
    // Deux homonymes parfaits : la console doit dire lequel manque (invariant 17).
    const camille = await invite(banc.url, 'Camille', '🐼')
    const camille2 = await invite(banc.url, 'Camille', '🐼')
    const rachid = await invite(banc.url, 'Rachid', '🦁')
    const telephones = [alice, camille, camille2, rachid]
    // Tout ce que les téléphones reçoivent, pour vérifier qu'aucun n'apprend qui traîne.
    const recu: any[] = []
    for (const t of telephones) t.socket.on('session:view', (p: any) => recu.push(p.view))

    const sessionId = await lancerQuiz(host, quiz)
    let v = await vue(host, v => v.phase === 'question' && v.attendus?.length === 4, 'les quatre attendus')
    assert.deepEqual(v.attendus.map((a: any) => `${a.name} ${a.avatar}`).sort(), [
      'Alice 🦊',
      'Camille (2) 🐼',
      'Camille 🐼',
      'Rachid 🦁',
    ])
    assert.ok(v.attendus.every((a: any) => !a.horsLigne && !a.dispense), 'tout le monde est là')

    // Le téléphone de Rachid meurt : la console le marque, d'elle-même, en tête de liste.
    rachid.socket.close()
    v = await vue(host, v => v.attendus?.[0]?.horsLigne === true, 'Rachid marqué hors ligne')
    assert.equal(v.attendus[0].playerId, rachid.playerId)

    // La vue de l'animateur porte la question visée : son numéro et son tour.
    assert.equal((await repondre(alice, sessionId, v, 0)).ok, true)
    assert.equal((await repondre(camille2, sessionId, v, 1)).ok, true)
    v = await vue(host, v => v.attendus?.length === 2, 'Alice et Camille (2) ont répondu')
    assert.deepEqual(v.attendus.map((a: any) => a.name).sort(), ['Camille', 'Rachid'])

    // Aucun téléphone ne reçoit la liste, ni le prénom d'un autre pendant la question.
    assert.ok(recu.length > 0)
    for (const x of recu) {
      assert.equal('attendus' in x || 'attendusEnPlus' in x, false, 'la liste ne part jamais à un téléphone')
      if (x.phase === 'question') {
        assert.doesNotMatch(JSON.stringify(x), /Rachid|Camille|Alice/, 'pendant la question, aucun prénom')
      }
    }
    await ranger(host, sessionId, [host, alice.socket, camille.socket, camille2.socket])
  })

  test('« Ne plus l’attendre » : la révélation automatique revient ; revenu, il est de nouveau attendu à la question suivante', async () => {
    const quiz = await creerQuiz(
      banc.url,
      cookie,
      [qcm('Un ?', ['Oui', 'Non'], 0, 60), qcm('Deux ?', ['Oui', 'Non'], 0, 60), qcm('Trois ?', ['Oui', 'Non'], 0, 60)],
      'Le fantôme',
    )
    const host = await ecranCommun(banc.url, cookie)
    await viderLaSalle(host)
    const alice = await invite(banc.url, 'Alice', '🦊')
    const bob = await invite(banc.url, 'Bob', '🐸')
    let rachid = await invite(banc.url, 'Rachid', '🦁')
    const sessionId = await lancerQuiz(host, quiz)

    // Q1 : son téléphone meurt, les deux autres répondent. La salle l'attend —
    // la règle ne bouge pas : ce n'est peut-être qu'un hoquet de réseau.
    let v = await vue(host, v => v.phase === 'question' && v.qIndex === 0, 'la question 1')
    rachid.socket.close()
    await vue(host, v => v.attendus?.some((a: any) => a.playerId === rachid.playerId && a.horsLigne), 'Rachid hors ligne')
    const revele = vue(host, v => v.phase === 'reveal', 'une révélation', 20_000)
    assert.equal((await repondre(alice, sessionId, v, 0)).ok, true)
    assert.equal((await repondre(bob, sessionId, v, 0)).ok, true)
    assert.equal(await vient(host, v => v.phase === 'reveal', 1500), false, 'on attend encore Rachid')

    // Seul un hors-ligne se dispense : Alice, connectée, reste dans la règle.
    commande(host, sessionId, { type: 'nePlusAttendre', playerId: alice.playerId })
    commande(host, sessionId, { type: 'nePlusAttendre', playerId: rachid.playerId })
    v = await revele
    assert.equal(v.qIndex, 0, 'la question 1 se révèle sans lui, sans attendre la fin du chrono')

    // Q2 : toujours hors ligne, toujours dispensé — la salle n'attend plus.
    suivante(host, sessionId, v)
    v = await vue(host, v => v.phase === 'question' && v.qIndex === 1, 'la question 2')
    assert.deepEqual(
      v.attendus.find((a: any) => a.playerId === rachid.playerId),
      { playerId: rachid.playerId, name: 'Rachid', avatar: '🦁', horsLigne: true, dispense: true },
      'la console le montre : on ne l’attend plus',
    )
    const revele2 = vue(host, v => v.phase === 'reveal' && v.qIndex === 1, 'la révélation 2', 5000)
    await repondre(alice, sessionId, v, 0)
    await repondre(bob, sessionId, v, 0)
    v = await revele2

    // Il revient pendant la révélation : à la question suivante, on l'attend de nouveau.
    rachid = await revient(rachid)
    suivante(host, sessionId, v)
    v = await vue(host, v => v.phase === 'question' && v.qIndex === 2, 'la question 3')
    assert.deepEqual(
      v.attendus.find((a: any) => a.playerId === rachid.playerId),
      { playerId: rachid.playerId, name: 'Rachid', avatar: '🦁' },
      'revenu, il est attendu comme tout le monde',
    )
    await repondre(alice, sessionId, v, 0)
    await repondre(bob, sessionId, v, 0)
    // Connecté, il ne se dispense plus.
    commande(host, sessionId, { type: 'nePlusAttendre', playerId: rachid.playerId })
    assert.equal(await vient(host, v => v.phase === 'reveal', 1500), false, 'on attend Rachid, revenu')
    const revele3 = vue(host, v => v.phase === 'reveal' && v.qIndex === 2, 'la révélation 3', 5000)
    assert.equal((await repondre(rachid, sessionId, v, 0)).ok, true)
    await revele3
    await ranger(host, sessionId, [host, alice.socket, bob.socket, rachid.socket])
  })

  test('« Rendre sa place » : le bon code rend la fiche, le second Rachid qui n’a rien joué s’efface', async () => {
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?', ['Oui', 'Non'], 0, 60), qcm('Deux ?', ['Oui', 'Non'], 0, 60)], 'La place')
    const host = await ecranCommun(banc.url, cookie)
    await viderLaSalle(host)
    const alice = await invite(banc.url, 'Alice', '🦊')
    const rachid = await invite(banc.url, 'Rachid', '🦁')
    const sessionId = await lancerQuiz(host, quiz)
    let v = await vue(host, v => v.phase === 'question' && v.qIndex === 0, 'la question 1')
    const revele = vue(host, v => v.phase === 'reveal', 'la révélation 1')
    await repondre(alice, sessionId, v, 1)
    await repondre(rachid, sessionId, v, 0)
    v = await revele
    const snapAvant = await instantane<any>(host, s => s.players.find((p: any) => p.id === rachid.playerId)?.score > 0, 'les points de Rachid')
    const points = snapAvant.players.find((p: any) => p.id === rachid.playerId).score

    // Tant que son téléphone répond, sa place n'est pas à donner.
    assert.equal((await emitAck<any>(host, 'host:rendrePlace', { playerId: rachid.playerId })).ok, false)

    // Le téléphone meurt ; sur l'emprunté, il s'inscrit à nouveau — le second « Rachid ».
    rachid.socket.close()
    await instantane<any>(host, s => s.players.find((p: any) => p.id === rachid.playerId)?.connected === false, 'Rachid hors ligne')
    const emprunte = await invite(banc.url, 'Rachid', '⚽')

    // Un téléphone, une connexion qui ne fait que suivre, l'écran d'un autre espace : aucun code.
    const curieux = connecter(banc.url)
    assert.equal((await emitAck<any>(curieux, 'party:watch', { slug: SLUG })).ok, true)
    const admin = await connexionAnimateur(banc.url)
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'voisin8b', name: 'Voisin', slug: 'chez-voisin-8b' }, admin)
    assert.equal(cree.status, 201)
    const { activation } = (await cree.json()) as { activation: { token: string } }
    const active = await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'voisin-pass-1' })
    const voisin = await ecranCommun(banc.url, cookieDe(active))
    for (const [qui, s] of [
      ['le téléphone d’un invité', alice.socket],
      ['une connexion qui suit la soirée', curieux],
      ['l’écran d’un autre espace', voisin],
    ] as const) {
      const res = await emitAck<any>(s, 'host:rendrePlace', { playerId: rachid.playerId })
      assert.equal(res.ok, false, `${qui} n’obtient pas de code`)
      assert.equal('code' in res, false)
    }

    const rendue = await emitAck<any>(host, 'host:rendrePlace', { playerId: rachid.playerId })
    assert.equal(rendue.ok, true)
    assert.match(rendue.code, /^\d{6}$/, 'un code court, à taper au téléphone')
    const faux = rendue.code === '000000' ? '000001' : '000000'

    // Un mauvais code, puis le bon mais dans un autre espace : rien.
    const refus = await emitAck<any>(emprunte.socket, 'player:reprendre', { slug: SLUG, code: faux, token: emprunte.token })
    assert.equal(refus.ok, false)
    assert.match(refus.error, /demande-en un nouveau/)
    const ailleurs = connecter(banc.url)
    assert.equal((await emitAck<any>(ailleurs, 'party:watch', { slug: 'chez-voisin-8b' })).ok, true)
    assert.equal((await emitAck<any>(ailleurs, 'player:reprendre', { slug: 'chez-voisin-8b', code: rendue.code })).ok, false, 'le code ne vaut que dans son espace')

    // Le bon code, tapé comme on le dicte : la fiche revient, telle que le serveur la tient.
    const reprise = await emitAck<any>(emprunte.socket, 'player:reprendre', {
      slug: SLUG,
      code: `${rendue.code.slice(0, 3)} ${rendue.code.slice(3)}`,
      token: emprunte.token,
    })
    assert.equal(reprise.ok, true, reprise.error)
    assert.equal(reprise.playerId, rachid.playerId)
    assert.equal(reprise.token, rachid.token)
    assert.equal(reprise.name, 'Rachid')
    assert.equal(reprise.avatar, '🦁')
    const snap = await instantane<any>(
      host,
      s => !s.players.some((p: any) => p.id === emprunte.playerId) && s.players.find((p: any) => p.id === rachid.playerId)?.connected,
      'le second Rachid effacé, le premier revenu',
    )
    assert.equal(snap.players.find((p: any) => p.id === rachid.playerId).score, points, 'ses points l’attendaient')
    assert.equal(snap.players.length, 2)

    // Il rejoue sous sa fiche, sur le téléphone emprunté.
    suivante(host, sessionId, v)
    const q2 = await vue(emprunte.socket, v => v.phase === 'question' && v.qIndex === 1, 'la question 2 sur le téléphone emprunté')
    assert.equal((await repondre({ ...emprunte, playerId: rachid.playerId, token: rachid.token }, sessionId, q2, 0)).ok, true)

    // Réemployé : il ne sert plus.
    const encore = connecter(banc.url)
    assert.equal((await emitAck<any>(encore, 'party:watch', { slug: SLUG })).ok, true)
    assert.equal((await emitAck<any>(encore, 'player:reprendre', { slug: SLUG, code: rendue.code })).ok, false, 'à usage unique')

    await ranger(host, sessionId, [host, alice.socket, emprunte.socket, curieux, voisin, ailleurs, encore])
  })

  test('le second Rachid qui a joué reste, avec ses points, et on ne l’attend plus', async () => {
    const quiz = await creerQuiz(
      banc.url,
      cookie,
      [qcm('Un ?', ['Oui', 'Non'], 0, 60), qcm('Deux ?', ['Oui', 'Non'], 0, 60)],
      'Deux Rachid',
    )
    const host = await ecranCommun(banc.url, cookie)
    await viderLaSalle(host)
    const alice = await invite(banc.url, 'Alice', '🦊')
    const rachid = await invite(banc.url, 'Rachid', '🦁')
    const sessionId = await lancerQuiz(host, quiz)
    let v = await vue(host, v => v.phase === 'question' && v.qIndex === 0, 'la question 1')
    rachid.socket.close()
    // Le second Rachid arrive en pleine question, et y répond.
    const emprunte = await invite(banc.url, 'Rachid', '⚽')
    assert.equal((await repondre(emprunte, sessionId, v, 0)).ok, true, 'arrivé en pleine question, il y répond')
    const revele = vue(host, v => v.phase === 'reveal', 'la révélation 1')
    await repondre(alice, sessionId, v, 1)
    commande(host, sessionId, { type: 'nePlusAttendre', playerId: rachid.playerId })
    v = await revele

    const { code } = await emitAck<any>(host, 'host:rendrePlace', { playerId: rachid.playerId })
    const reprise = await emitAck<any>(emprunte.socket, 'player:reprendre', { slug: SLUG, code, token: emprunte.token })
    assert.equal(reprise.ok, true)
    const snap = await instantane<any>(
      host,
      s => s.players.find((p: any) => p.id === emprunte.playerId)?.connected === false,
      'le second Rachid, gardé, hors ligne',
    )
    assert.ok(snap.players.find((p: any) => p.id === emprunte.playerId).score > 0, 'ses points restent')

    // La question suivante ne l'attend pas : son porteur joue sous l'autre fiche.
    suivante(host, sessionId, v)
    v = await vue(host, v => v.phase === 'question' && v.qIndex === 1, 'la question 2')
    assert.equal(v.attendus.find((a: any) => a.playerId === emprunte.playerId)?.dispense, true)
    const revele2 = vue(host, v => v.phase === 'reveal' && v.qIndex === 1, 'la révélation 2', 5000)
    await repondre(alice, sessionId, v, 0)
    await repondre({ ...emprunte, playerId: rachid.playerId, token: rachid.token }, sessionId, v, 0)
    await revele2
    await ranger(host, sessionId, [host, alice.socket, emprunte.socket])
  })

  test('un téléphone au profil d’un autre ne reprend pas une place', async () => {
    const host = await ecranCommun(banc.url, cookie)
    await viderLaSalle(host)
    const rachid = await invite(banc.url, 'Rachid', '🦁')
    rachid.socket.close()
    await instantane<any>(host, s => s.players.find((p: any) => p.id === rachid.playerId)?.connected === false, 'Rachid hors ligne')
    const { code } = await emitAck<any>(host, 'host:rendrePlace', { playerId: rachid.playerId })
    // Le téléphone de Bertrand, connecté à son profil : la place de Rachid
    // lui serait rattachée — ou rendue au joueur de Bertrand au réveil.
    const bertrand = connecter(banc.url, await inscrireProfil(banc.url, 'bertrand8b', 'Bertrand'))
    assert.equal((await emitAck<any>(bertrand, 'party:watch', { slug: SLUG })).ok, true)
    const res = await emitAck<any>(bertrand, 'player:reprendre', { slug: SLUG, code })
    assert.equal(res.ok, false)
    assert.match(res.error, /fenêtre privée/)
    bertrand.close()
    host.close()
  })
})

describe('les codes « Rendre sa place »', () => {
  test('périmés vite, à usage unique, et les essais comptés', () => {
    const places = new PlacesRendues()
    const t = 1_000_000
    const a = places.emettre('rachid', t)
    assert.equal(places.reprendre(a.code, t + VIE_DU_CODE_MS), null, 'périmé')

    const b = places.emettre('rachid', t)
    // Un code neuf pour la même fiche fait tomber l'ancien.
    const c = places.emettre('rachid', t)
    if (b.code !== c.code) assert.equal(places.reprendre(b.code, t + 1), null, 'l’ancien code ne vaut plus')
    assert.equal(places.reprendre(c.code, t + 1), 'rachid')
    assert.equal(places.reprendre(c.code, t + 2), null, 'à usage unique')

    // Trop d'essais manqués, et tous les codes de l'espace tombent.
    const d = places.emettre('bob', t)
    const faux = d.code === '999999' ? '999998' : '999999'
    for (let i = 0; i < ESSAIS_MANQUES_MAX; i++) assert.equal(places.reprendre(faux, t + 1), null)
    assert.equal(places.reprendre(d.code, t + 1), null, 'le bon code est tombé avec les essais')
  })
})
