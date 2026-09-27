// Un geste d'animateur fait pendant une coupure part AVANT sa re-présentation.
//
// socket.io-client garde les messages émis hors connexion et les envoie à la
// reconnexion — avant de signaler « connect » (`emitBuffered()` puis
// `emitReserved('connect')`). La console se re-présente (`host:hello`) dans
// son écouteur de « connect » : le geste retenu arrive donc sur une connexion
// neuve qui n'est encore l'écran de personne, et `requireHost()` l'ignore en
// silence. « Clore la soirée », « Révéler », « Suivant » tapés pendant un
// hoquet du wifi se perdent, sans un mot.
//
// Ce que ce test attend (il échoue aujourd'hui) : le geste retenu pendant la
// coupure s'applique une fois la console reconnectée — ou la console le sait.
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/geste-pendant-la-coupure.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connecter, connexionAnimateur, demarrer, emitAck, instantane, invite, patienter } from '../../../server/test/banc'

test('« Clore la soirée » tapé pendant une coupure : appliqué à la reconnexion, ou refusé à voix haute', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    // La console telle que la page la tient : elle se re-présente à chaque connexion.
    const console_ = connecter(banc.url, cookie)
    let hellos = 0
    console_.on('connect', () => {
      hellos++
      ;(console_ as any).emit('host:hello', {}, () => {})
    })
    await new Promise<void>(r => console_.once('connect', () => r()))
    await patienter(200)
    const toasts: string[] = []
    console_.on('toast', (t: any) => toasts.push(t.message))
    await invite(banc.url, 'Alice', '🦊')
    await instantane(console_, s => s.players.length === 1, 'Alice dans la salle')

    // Le wifi hoquette : la liaison tombe, l'animateur tape « Clore » entre-temps.
    const reconnectee = new Promise<void>(r => console_.io.once('reconnect', () => r()))
    ;(console_.io as any).engine.close()
    await patienter(20)
    assert.equal(console_.connected, false, 'la console devrait être hors ligne')
    ;(console_ as any).emit('host:closeParty', { title: 'Pendant la coupure' })
    await reconnectee
    await patienter(1500)

    const salle = await emitAck<any>(connecter(banc.url), 'party:watch', { slug: 'banc' })
    void salle
    const apres = await instantane(console_, () => true)
    console.log(`re-présentations : ${hellos} ; toasts reçus : ${JSON.stringify(toasts)} ; invités après : ${apres.players.length}`)
    assert.ok(
      apres.players.length === 0 || toasts.length > 0,
      '« Clore la soirée », tapé pendant la coupure, s’est perdu sans un mot',
    )
  } finally {
    await banc.close()
  }
})
