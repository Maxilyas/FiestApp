// Invariant 9 : « la fiche du serveur fait foi » — un renommage de
// l'animateur survit au réveil du téléphone (`temps-reel.test.ts`). Mais un
// profil qui ouvre la soirée sur un second appareil, sans jeton, passe pour
// une déclaration : `player:join` y reprend le prénom du profil
// (`sockets.ts:403`), et le renommage tombe.
//
// C'est écrit (« son prénom et son avatar sont ceux qu'il vient de confirmer,
// ou ceux de son profil s'il n'a rien retapé ») : une tension entre
// l'invariant 8 (le profil ne rechoisit jamais son prénom) et le geste de
// modération de l'invariant 9. Cette épreuve décrit ce qu'on attendrait si
// le renommage de l'animateur l'emportait ; elle échoue sur b57035c.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN,
  connecter,
  connexionAnimateur,
  demarrer,
  ecranCommun,
  emitAck,
  inscrireProfil,
  instantane,
  invite,
  type Banc,
} from '../../../server/test/banc'

let banc: Banc
let cookie: string
before(async () => {
  banc = await demarrer()
  cookie = await connexionAnimateur(banc.url)
})
after(async () => {
  await banc.close()
})

test('moteur-10 · un profil renommé par l’animateur garde ce nom quand il arrive sur un second appareil', async () => {
  const host = await ecranCommun(banc.url, cookie)
  const profil = await inscrireProfil(banc.url, 'grosbill', 'GrosBill', '🐯')
  const tel = await invite(banc.url, '', '', { cookie: profil })
  ;(host as any).emit('host:renamePlayer', { playerId: tel.playerId, name: 'Bill' })
  await instantane<any>(host, s => s.players.find((p: any) => p.id === tel.playerId)?.name === 'Bill', 'le renommage')

  // Le même profil, sur la tablette du salon : pas de jeton, le cookie du profil.
  const tablette = connecter(banc.url, profil)
  assert.equal((await emitAck<any>(tablette, 'party:watch', { slug: ADMIN.slug })).ok, true)
  const res = await emitAck<any>(tablette, 'player:join', { slug: ADMIN.slug })
  assert.equal(res.ok, true)
  assert.equal(res.playerId, tel.playerId, 'le profil retrouve sa fiche — un seul joueur par profil')
  const snap = await instantane<any>(host, s => !!s.players.find((p: any) => p.id === tel.playerId), 'la salle')
  await new Promise(r => setTimeout(r, 400))
  const apres = (await instantane<any>(host)).players.find((p: any) => p.id === tel.playerId)
  assert.ok(snap)
  assert.equal(apres.name, 'Bill', `le nom choisi par l’animateur reste (vu : ${apres.name})`)
})
