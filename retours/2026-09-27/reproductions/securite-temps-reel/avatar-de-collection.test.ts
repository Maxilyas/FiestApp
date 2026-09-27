// Un emoji de collection ne se porte qu'au niveau du profil qui l'a ouvert :
// l'invité anonyme n'en porte aucun (CLAUDE.md, « L'avatar d'un profil se lit
// par avatarPorte… l'invité anonyme n'y porte aucun emoji de collection »).
//
// Le contrôle de `player:join` (sockets.ts:407-409) juge l'avatar BRUT —
// `peutPorter(profile, tape)` —, puis `Party.join` le nettoie (`cleanAvatar`,
// party.ts:108), qui retire les caractères invisibles. Une demi-paire de
// substitution, un caractère invisible, l'autre demi-paire : le contrôle ne
// voit aucun emoji de collection, le nettoyage recolle 🐲.
//
// Lancer : cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//   ../export/evaluations/securite-temps-reel/avatar-de-collection.test.ts
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, connecter, demarrer, emitAck, inscrireProfil, instantane, type Banc } from '../../../server/test/banc'
import { COLLECTION } from '../../../shared/avatars'

let banc: Banc
before(async () => (banc = await demarrer()))
after(() => banc.close())

const COLLECTIONNES = new Set(COLLECTION.map(c => c.emoji))

async function entrer(avatar: string, name: string, cookie?: string) {
  const tel = connecter(banc.url, cookie)
  assert.equal((await emitAck<any>(tel, 'party:watch', { slug: ADMIN.slug })).ok, true)
  const ack = await emitAck<any>(tel, 'player:join', { slug: ADMIN.slug, name, avatar })
  assert.equal(ack.ok, true, `${name} doit entrer : ${ack.error}`)
  return { tel, ack }
}

test('témoin : 🐲 tapé tel quel est refusé à un invité anonyme', async () => {
  const { ack } = await entrer('🐲', 'Témoin')
  assert.ok(!COLLECTIONNES.has(ack.avatar), `avatar retenu : ${ack.avatar}`)
})

test('un invité anonyme ne porte pas 🐲 (niveau 16) en glissant un caractère invisible dans la paire', async () => {
  // U+D83D, U+200B (espace sans chasse, catégorie Cf), U+DC32 : cleanAvatar
  // retire U+200B et recolle U+1F432 🐲.
  const { tel, ack } = await entrer('\uD83D​\uDC32', 'Malo')
  const snap = await instantane<any>(tel, s => s.players.some((p: any) => p.id === ack.playerId), 'Malo dans la salle')
  const vu = snap.players.find((p: any) => p.id === ack.playerId).avatar
  assert.ok(!COLLECTIONNES.has(ack.avatar), `l'accusé lui rend un emoji de collection : ${ack.avatar}`)
  assert.ok(!COLLECTIONNES.has(vu), `toute la salle le voit porter un emoji de collection : ${vu}`)
})

test('un profil tout neuf (niveau 1) ne porte pas 🪐 (niveau 17) par le même détour', async () => {
  const cookie = await inscrireProfil(banc.url, 'novice', 'Novice', '🦊')
  // U+D83E, U+00AD (trait d'union conditionnel, Cf), U+DE90 → 🪐
  const { ack } = await entrer('\uD83E­\uDE90', 'Novice', cookie)
  assert.ok(!COLLECTIONNES.has(ack.avatar), `un niveau 1 porte ${ack.avatar}`)
})
