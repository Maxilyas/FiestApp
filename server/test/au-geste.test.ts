// Ce que voit celui qui vient de faire le geste. L'instantané de la salle est
// regroupé — 120 ms plus 2 ms par invité pour les téléphones —, mais celui
// qui rejoint, se réveille ou change d'équipe ne doit pas attendre la
// fenêtre pour se voir : d'ici là, son téléphone affichait « tu entres à la
// prochaine question » en pleine question, une seconde durant à 500 invités.
// Et ce qui ne dépend pas d'une veille — les réglages de l'espace, les
// parures d'un profil, un prénom corrigé au podium — doit partir de
// lui-même : les veilles des autres ne le portent plus.
//
// Rien n'est chronométré : on regarde l'ordre dans lequel un même téléphone
// reçoit ses messages, qui est celui de leur envoi.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
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
  inscrireProfil,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'

let banc: Banc
let cookie: string
let host: Socket

before(async () => {
  banc = await demarrer()
  cookie = await connexionAnimateur(banc.url)
  host = await ecranCommun(banc.url, cookie)
})

after(async () => {
  await banc.close()
})

/**
 * Un téléphone qui suit la soirée et retient le dernier instantané reçu à
 * chaque instant : `aPremiereVue` rend celui qu'il avait quand la première
 * vue de la partie est arrivée — ce que la page lit pour décider si elle
 * montre la question (`iAmIn`, `PlayerApp.tsx`).
 */
async function telephone() {
  const socket = connecter(banc.url)
  const watched = await emitAck<{ ok: boolean }>(socket, 'party:watch', { slug: ADMIN.slug })
  assert.equal(watched.ok, true)
  let dernier: any = null
  let accuse = false
  const apresAccuse: any[] = []
  socket.on('party:snapshot', (s: any) => {
    dernier = s
    if (accuse) apresAccuse.push(s)
  })
  const aPremiereVue = new Promise<any>(resolve => socket.once('session:view', () => resolve(dernier)))
  /** Rejoint ; l'accusé est noté à sa réception, avant tout message qui le suit. */
  const rejoindre = (charge: Record<string, unknown>) =>
    new Promise<any>((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('accusé attendu en vain : player:join')), 5000)
      ;(socket as any).emit('player:join', { slug: ADMIN.slug, ...charge }, (res: any) => {
        clearTimeout(to)
        accuse = true
        resolve(res)
      })
    })
  return { socket, rejoindre, aPremiereVue, apresAccuse, dernier: () => dernier }
}

/** Une partie lancée, arrivée à sa question. */
async function enPleineQuestion(titre: string): Promise<string> {
  const quiz = await creerQuiz(banc.url, cookie, [qcm(`${titre} ?`)], titre)
  const sessionId = await lancerQuiz(host, quiz)
  await attendre<any>(host, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question', 'la question', 15_000)
  return sessionId
}

async function terminer(sessionId: string) {
  const fini = instantane<any>(host, s => s.session === null, 'la partie terminée')
  ;(host as any).emit('host:endSession', { sessionId })
  await fini
}

/**
 * Laisse passer la diffusion regroupée d'une arrivée : sans ça, c'est elle
 * qui porterait le changement qu'on veut voir partir de lui-même.
 */
const calme = () => patienter(400)

const dans = (snap: any, playerId: string) => !!snap?.session?.participantIds?.includes(playerId)

test('un retardataire arrivé en pleine question se voit dans la partie dès sa première vue', async () => {
  const deja = [await invite(banc.url, 'Alice', '🦊'), await invite(banc.url, 'Bob', '🐻')]
  assert.equal(deja.length, 2)
  const sessionId = await enPleineQuestion('Retard')

  const tel = await telephone()
  const res = await tel.rejoindre({ name: 'Retardataire', avatar: '🐢' })
  assert.equal(res.ok, true)
  // Sans l'instantané envoyé au geste, la vue arrivait la première, et
  // l'instantané qui le comptait une fenêtre de regroupement plus tard.
  const alaVue = await tel.aPremiereVue
  assert.ok(dans(alaVue, res.playerId), 'à sa première vue, il se sait dans la partie')
  const premier = await instantane<any>(tel.socket, () => tel.apresAccuse.length > 0, 'un instantané après l’accusé')
  assert.ok(premier)
  assert.ok(dans(tel.apresAccuse[0], res.playerId), 'le premier instantané après l’accusé le compte')
  await terminer(sessionId)
})

test('un téléphone endormi au lancement qui se réveille se voit dans la partie dès sa première vue', async () => {
  const dormeur = await invite(banc.url, 'Dormeur', '🐨')
  dormeur.socket.close()
  await instantane<any>(
    host,
    s => s.players.find((p: any) => p.id === dormeur.playerId)?.connected === false,
    'l’écran commun voit la veille',
  )
  const sessionId = await enPleineQuestion('Réveil')

  const tel = await telephone()
  const res = await tel.rejoindre({ token: dormeur.token })
  assert.equal(res.ok, true)
  assert.equal(res.playerId, dormeur.playerId)
  // L'instantané envoyé au réveil était construit avant `joinLate` : il
  // disait la salle, mais pas encore la partie.
  assert.ok(dans(tel.apresAccuse[0] ?? (await instantane<any>(tel.socket)), res.playerId), 'le premier instantané après l’accusé le compte')
  assert.ok(dans(await tel.aPremiereVue, res.playerId), 'à sa première vue, il se sait dans la partie')
  await terminer(sessionId)
})

test('changer d’équipe : l’accusé arrive derrière l’instantané qui le montre dans sa nouvelle équipe', async () => {
  ;(host as any).emit('host:seedTeams')
  const avecEquipes = await instantane<any>(host, s => s.teams.length >= 2, 'les équipes')
  const tel = await telephone()
  const res = await tel.rejoindre({ name: 'Nomade', avatar: '🐫' })
  assert.equal(res.ok, true)
  for (const equipe of avecEquipes.teams.slice(0, 2)) {
    const ack = await emitAck<{ ok: boolean }>(tel.socket, 'player:setTeam', { teamId: equipe.id })
    assert.equal(ack.ok, true)
    const moi = tel.dernier()?.players.find((p: any) => p.id === res.playerId)
    assert.equal(moi?.teamId, equipe.id, 'à l’accusé, le téléphone se voit déjà dans son équipe')
  }
})

test('les réglages de l’espace partent aux téléphones sans attendre la veille de quelqu’un', async () => {
  const tel = await telephone()
  await tel.rejoindre({ name: 'Lectrice', avatar: '🦉' })
  await calme()
  const res = await ecrire(banc.url, '/api/space/settings', { title: 'La grande fête', eyebrow: 'Ce soir chez' }, cookie, 'PUT')
  assert.equal(res.status, 200)
  const snap = await instantane<any>(tel.socket, s => s.space?.title === 'La grande fête', 'le nouveau titre au téléphone')
  assert.equal(snap.space.eyebrow, 'Ce soir chez')
})

test('les parures d’un profil partent à la salle dès qu’il les change', async () => {
  // Un niveau élevé, sans jouer vingt soirées : toutes les finitions sont
  // ouvertes, et le profil peut en épingler une autre que la plus belle.
  const proto = ProfileStore.prototype as any
  const niveauOf = proto.niveauOf
  proto.niveauOf = () => 25
  try {
    const profilCookie = await inscrireProfil(banc.url, 'paree', 'Parée', '🦚')
    const paree = await invite(banc.url, 'Parée', '🦚', { cookie: profilCookie })
    const temoin = await telephone()
    await temoin.rejoindre({ name: 'Témoin', avatar: '🐸' })
    const avant = await instantane<any>(
      temoin.socket,
      s => s.players.some((p: any) => p.id === paree.playerId),
      'la parée dans la salle',
    )
    assert.notEqual(avant.players.find((p: any) => p.id === paree.playerId)?.finition, 'argent')
    await calme()
    const res = await ecrire(banc.url, '/api/joueur/moi', { finition: 'argent' }, profilCookie, 'PUT')
    assert.equal(res.status, 200)
    await instantane<any>(
      temoin.socket,
      s => s.players.find((p: any) => p.id === paree.playerId)?.finition === 'argent',
      'sa nouvelle finition, vue d’un autre téléphone',
    )
  } finally {
    proto.niveauOf = niveauOf
  }
})

test('un prénom corrigé au podium repart aux téléphones sans attendre le geste de personne', async () => {
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Podium ?')], 'Podium')
  const gros = await invite(banc.url, 'GrosLourd', '🦍')
  const voisin = await invite(banc.url, 'Voisin', '🐧')
  const sessionId = await lancerQuiz(host, quiz)
  await attendre<any>(host, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question', 'la question', 15_000)
  // Les deux répondent juste : ils sont en tête du podium, que les
  // téléphones montrent en entier (les trois premiers).
  for (const inv of [gros, voisin]) {
    const ack = await emitAck<any>(inv.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
    assert.equal(ack.ok, true)
  }
  const revelee = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal', 'la révélation', 15_000)
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  await revelee
  const podium = attendre<any>(voisin.socket, 'session:view', p => p.view.phase === 'finished', 'le podium', 15_000)
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  const vu = await podium
  assert.ok(JSON.stringify(vu.view).includes('GrosLourd'), 'le podium montre l’ancien prénom')

  ;(host as any).emit('host:renamePlayer', { playerId: gros.playerId, name: 'Marc' })
  const corrige = await attendre<any>(
    voisin.socket,
    'session:view',
    p => p.view.phase === 'finished' && JSON.stringify(p.view).includes('Marc'),
    'le podium corrigé au téléphone du voisin',
  )
  assert.ok(!JSON.stringify(corrige.view).includes('GrosLourd'))
  await attendre<any>(
    host,
    'session:view',
    p => p.view.phase === 'finished' && JSON.stringify(p.view).includes('Marc'),
    'le podium corrigé à l’écran commun',
  )
  await terminer(sessionId)
})
