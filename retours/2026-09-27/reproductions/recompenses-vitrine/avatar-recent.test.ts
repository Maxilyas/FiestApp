// La règle des emojis d'avant Unicode 13 (CLAUDE.md) : l'écran commun tourne
// sous Windows 10, qui montre les plus récents en carré vide. `emojis.test.ts`
// la garde pour le code et les quiz livrés, l'éditeur pour les quiz écrits
// (`emojisRecents`) — mais pas pour l'avatar : `cleanAvatar` accepte
// n'importe quels quatre points de code. La grille ne propose que des emojis
// anciens ; un appel forgé (`player:join`, `PUT /api/joueur/moi`) pose un
// 🥲 que toute la salle verra en carré.
//
// Ce test passe le jour où `cleanAvatar` rend l'avatar par défaut pour un
// emoji récent, comme il le fait pour un emoji de collection trop haut.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, demarrer, ecrire, emitAck, connecter, inscrireProfil } from '../../../server/test/banc'
import { cleanAvatar, DEFAULT_AVATAR } from '../../../shared/avatars'
import { estRecent } from '../../../shared/emojis'

test('un avatar ne s’affiche jamais en carré vide sur la télé', async () => {
  assert.ok(estRecent('🥲'), '🥲 est d’Unicode 13')
  assert.equal(cleanAvatar('🥲'), DEFAULT_AVATAR, `cleanAvatar('🥲') rend ${cleanAvatar('🥲')}`)
})

test('ni par l’entrée d’une soirée, ni par la page du profil', async () => {
  const banc = await demarrer()
  try {
    const socket = connecter(banc.url)
    await emitAck(socket, 'party:watch', { slug: ADMIN.slug })
    const res = await emitAck<any>(socket, 'player:join', { slug: ADMIN.slug, name: 'Bob', avatar: '🫠' })
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const put = (await (await ecrire(banc.url, '/api/joueur/moi', { avatar: '🥲' }, cookie, 'PUT')).json()) as any
    console.log(`[constat] invité anonyme : ${res.avatar} · profil : ${put.profile?.avatar ?? put.error}`)
    assert.ok(!estRecent(res.avatar), `l’invité entre avec ${res.avatar}`)
    assert.ok(!estRecent(put.profile.avatar), `le profil porte ${put.profile.avatar}`)
    socket.close()
  } finally {
    await banc.close()
  }
})
