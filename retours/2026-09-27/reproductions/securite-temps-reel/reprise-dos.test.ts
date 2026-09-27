// « Rendre sa place » : un griefeur qui ne connaît que le slug (public — il
// est dans le QR et l'URL) peut bloquer la reprise de TOUTE la salle.
//
// `player:reprendre` vérifie le compteur d'essais manqués AVANT de regarder
// le code (places.ts:83, `lire()` : `if (this.manques.length >=
// ESSAIS_MANQUES_MAX) return { motif: 'trop' }`). Ce compteur est commun à
// tout l'espace, tous codes confondus (places.ts:47, `manques`), et cinq
// essais faux dans la minute glissante le remplissent — depuis n'importe
// quelle connexion. Le garde-fou par connexion (`placeFailures`, 5) ne borne
// qu'une connexion : le griefeur en ouvre une neuve à chaque salve.
//
// Résultat : l'invité au téléphone mort, muni du BON code que l'animateur
// vient de lui donner, lit « Trop d'essais ici — réessaie dans une minute »
// tant que le griefeur maintient la salve. C'est le symptôme que le
// correctif de places.ts voulait chasser (« la console affichait encore
// Valable 3 minutes sous un code mort »), déplacé de « code mort » à
// « reprise refusée ».
//
// Lancer : cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//   ../export/evaluations/securite-temps-reel/reprise-dos.test.ts
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN,
  connecter,
  connexionAnimateur,
  demarrer,
  ecranCommun,
  emitAck,
  instantane,
  invite,
  type Banc,
  type Socket,
} from '../../../server/test/banc'
import { ESSAIS_MANQUES_MAX } from '../../../server/src/core/places'

const SLUG = ADMIN.slug

let banc: Banc
let cookie: string
before(async () => {
  banc = await demarrer()
  cookie = await connexionAnimateur(banc.url)
})
after(() => banc.close())

/** Une connexion qui suit la soirée, prête à tenter un code. */
async function suiveur(): Promise<Socket> {
  const s = connecter(banc.url)
  assert.equal((await emitAck<any>(s, 'party:watch', { slug: SLUG })).ok, true)
  return s
}

test('un griefeur qui ne connaît que le slug bloque la reprise d’un invité muni du bon code', async () => {
  const host = await ecranCommun(banc.url, cookie)
  // Rachid entre, son téléphone meurt : l'animateur lui fait un code.
  const rachid = await invite(banc.url, 'Rachid', '🦁')
  rachid.socket.close()
  await instantane<any>(host, s => s.players.find((p: any) => p.id === rachid.playerId)?.connected === false, 'Rachid hors ligne')
  const rendue = await emitAck<any>(host, 'host:rendrePlace', { playerId: rachid.playerId })
  assert.equal(rendue.ok, true, rendue.error)
  const bonCode: string = rendue.code

  // Le griefeur : il ne sait que le slug. Il ouvre des connexions neuves —
  // pour esquiver le plafond par connexion (5) — et tente des codes faux.
  // Cinq faux suffisent à remplir le compteur de l'espace pour une minute.
  const faux = (i: number) => String(i).padStart(6, '9').slice(-6)
  for (let i = 0; i < ESSAIS_MANQUES_MAX; i++) {
    const g = await suiveur()
    const res = await emitAck<any>(g, 'player:reprendre', { slug: SLUG, code: faux(i) })
    assert.equal(res.ok, false)
    g.close()
  }

  // L'invité légitime, sur le téléphone emprunté, tape le BON code.
  const emprunte = await suiveur()
  const reprise = await emitAck<any>(emprunte, 'player:reprendre', {
    slug: SLUG,
    code: bonCode,
  })
  console.log('[reprise-dos] reprise avec le bon code =', JSON.stringify(reprise))
  assert.equal(
    reprise.ok,
    true,
    `le bon code doit rendre la place ; refusé : « ${reprise.error} ». ` +
      'Un griefeur a épuisé le compteur d’essais commun à l’espace.',
  )
})
