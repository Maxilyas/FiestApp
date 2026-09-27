// « Rendre sa place » en rafale : la console le dit.
//
// Le code qui rend sa place à un invité au téléphone mort a une réserve
// d'essais manqués commune à tout l'espace — cinq par minute : sans elle, six
// chiffres se devineraient. Mais un plaisantin qui connaît l'adresse de la
// soirée la remplissait, et l'invité, le bon code en main, lisait « Trop
// d'essais ici » sans que personne ne sache pourquoi. La console le dit
// maintenant, une fois par minute fermée, avec ce qu'elle y peut : un code
// neuf rouvre la porte.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, connecter, connexionAnimateur, demarrer, ecranCommun, emitAck, instantane, invite, patienter } from './banc'

test('des codes faux en rafale ferment la minute de l’espace : la console le lit une fois, et un code neuf rouvre', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const host = await ecranCommun(banc.url, cookie)
    const toasts: string[] = []
    host.on('toast', (t: { message: string }) => toasts.push(t.message))

    // Rachid, téléphone mort : l'animateur fait paraître son code.
    const rachid = await invite(banc.url, 'Rachid', '🦁')
    rachid.socket.close()
    await instantane<any>(host, s => s.players.find((p: any) => p.id === rachid.playerId)?.connected === false, 'Rachid hors ligne')
    const { code } = await emitAck<any>(host, 'host:rendrePlace', { playerId: rachid.playerId })
    const faux = `${(Number(code[0]) + 1) % 10}${code.slice(1)}`

    // Le plaisantin : une connexion neuve à chaque essai, pour ne pas buter
    // sur la réserve de sa connexion.
    for (let i = 0; i < 6; i++) {
      const s = connecter(banc.url)
      await emitAck(s, 'party:watch', { slug: ADMIN.slug })
      const refus = await emitAck<any>(s, 'player:reprendre', { slug: ADMIN.slug, code: faux })
      assert.equal(refus.ok, false)
      s.close()
    }
    await patienter(200)
    const alertes = toasts.filter(t => /codes faux/.test(t))
    assert.equal(alertes.length, 1, `la console le lit une fois : ${JSON.stringify(toasts)}`)
    assert.match(alertes[0], /un code neuf rouvre la porte/)

    // Le vrai Rachid, sur un téléphone emprunté, lit qu'il faut patienter…
    const emprunte = connecter(banc.url)
    await emitAck(emprunte, 'party:watch', { slug: ADMIN.slug })
    assert.match((await emitAck<any>(emprunte, 'player:reprendre', { slug: ADMIN.slug, code })).error, /réessaie dans une minute/)
    // … et le code neuf que la console lui refait sert aussitôt.
    const neuf = await emitAck<any>(host, 'host:rendrePlace', { playerId: rachid.playerId })
    const reprise = await emitAck<any>(emprunte, 'player:reprendre', { slug: ADMIN.slug, code: neuf.code })
    assert.equal(reprise.ok, true, reprise.error)
    assert.equal(reprise.playerId, rachid.playerId)
  } finally {
    await banc.close()
  }
})
