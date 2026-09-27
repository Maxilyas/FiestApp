// Un geste d'animateur se présente par la session de sa poignée de main.
//
// socket.io-client garde ce qu'on émet hors connexion et le rejoue à la
// reconnexion — avant l'évènement `connect`, donc avant que la page se
// re-présente (`host:hello`). « Clore la soirée », « Révéler », « Suivant »
// touchés pendant un hoquet du wifi arrivaient sur une connexion qui n'était
// encore l'écran de personne, et se perdaient sans un mot : la soirée restait
// ouverte, aucun invité ne recevait sa fin.
//
// Et `requireHost` ne relisait que le drapeau posé au `host:hello` : une
// session éteinte sans révocation — la télé branchée par un code, plafonnée à
// vingt-quatre heures (invariant 16) — gardait la main tant que sa connexion
// tenait. Chaque geste relit maintenant la session, comme `host:hello`.
//
// Chaque test a son propre serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  cookieDe,
  demarrer,
  ecrire,
  emitAck,
  instantane,
  invite,
  patienter,
} from './banc'

test('« Clore la soirée » touché pendant une coupure : la soirée se clôt à la reconnexion', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    // La console telle que la page la tient : elle se re-présente à chaque connexion.
    const console_ = connecter(banc.url, cookie)
    let presentations = 0
    console_.on('connect', () => {
      presentations++
      ;(console_ as any).emit('host:hello', {}, () => {})
    })
    await new Promise<void>(r => console_.once('connect', () => r()))
    const alice = await invite(banc.url, 'Alice', '🦊')
    await instantane(console_, s => s.players.length === 1, 'Alice dans la salle')
    const remise = attendre<any>(alice.socket, 'party:reset', () => true, 'Alice renvoyée à l’entrée', 10_000)

    // Le wifi hoquette : la liaison tombe, l'animateur touche « Clore » entre-temps.
    const reconnectee = new Promise<void>(r => console_.io.once('reconnect', () => r()))
    ;(console_.io as any).engine.close()
    await patienter(20)
    assert.equal(console_.connected, false, 'la console devrait être hors ligne')
    const toast = attendre<any>(console_, 'toast', () => true, 'l’issue de la clôture', 10_000)
    ;(console_ as any).emit('host:closeParty', { title: 'Pendant la coupure' })
    await reconnectee

    // Rien n'avait été joué : la soirée repart vierge, et le téléphone
    // d'Alice repasse par l'entrée.
    assert.deepEqual(await toast, { kind: 'info', message: 'Soirée vierge — rien n’avait été joué' })
    await remise
    assert.equal((await instantane(console_, s => s.players.length === 0, 'la salle vidée')).players.length, 0)
    assert.equal(presentations, 2, 'la console s’est re-présentée')
  } finally {
    await banc.close()
  }
})

test('un geste d’une connexion qui porte la session d’un autre espace ne touche pas celui qu’elle suit', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    // La même session, mais la connexion suit déjà un autre espace : elle
    // n'en devient pas l'écran pour autant.
    const admin = await connexionAnimateur(banc.url)
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'voisin', name: 'Voisin', slug: 'chez-le-voisin' }, admin)
    assert.equal(cree.status, 201)
    const suiveur = connecter(banc.url, cookie)
    assert.equal((await emitAck<any>(suiveur, 'party:watch', { slug: 'chez-le-voisin' })).ok, true)
    ;(suiveur as any).emit('host:createTeam', { name: 'Intruse', emoji: '🍕' })
    await emitAck(suiveur, 'time:sync', {})
    await patienter(300)
    const salle = connecter(banc.url)
    await emitAck(salle, 'party:watch', { slug: 'chez-le-voisin' })
    const voisin = await instantane<any>(salle)
    assert.deepEqual(voisin.teams, [], 'l’espace suivi n’a pas reçu d’équipe')
    const chezSoi = connecter(banc.url)
    await emitAck(chezSoi, 'party:watch', { slug: ADMIN.slug })
    assert.deepEqual((await instantane<any>(chezSoi)).teams, [], 'ni celui de la session')
  } finally {
    await banc.close()
  }
})

test('la télé branchée ne commande plus la soirée après ses vingt-quatre heures, même sans avoir décroché', async () => {
  const vrai = Date.now
  let decalage = 0
  // L'horloge avance pour le serveur seulement. Le client socket.io du test
  // vit dans le même processus : avec vingt-cinq heures d'un coup,
  // engine.io-client croirait à un minuteur étranglé, couperait et se
  // reconnecterait — ce qu'une vraie télé, qui garde sa propre horloge, ne
  // ferait pas.
  Date.now = () => {
    if (decalage === 0) return vrai()
    const pile = new Error().stack ?? ''
    return /engine\.io-client|socket\.io-client/.test(pile) ? vrai() : vrai() + decalage
  }
  const banc = await demarrer()
  try {
    const telephone = await connexionAnimateur(banc.url)
    // Brancher la télé, par les vraies routes.
    const demande = (await (await ecrire(banc.url, '/api/auth/appairage', {})).json()) as { code: string; jeton: string }
    assert.equal((await ecrire(banc.url, '/api/auth/appairage/valider', { code: demande.code }, telephone)).status, 200)
    const tele = cookieDe(await ecrire(banc.url, '/api/auth/appairage/attente', { jeton: demande.jeton }))

    const ecran = connecter(banc.url, tele)
    const hello = await emitAck<any>(ecran, 'host:hello', {})
    assert.equal(hello.ok, true)
    assert.equal(hello.branchee, true, 'c’est bien une télé branchée')
    const salle = connecter(banc.url)
    assert.equal((await emitAck<any>(salle, 'party:watch', { slug: ADMIN.slug })).ok, true)
    // Témoin : avant l'échéance, la télé commande.
    ;(ecran as any).emit('host:createTeam', { name: 'Avant', emoji: '🍕' })
    await instantane<any>(salle, s => s.teams?.some((t: any) => t.name === 'Avant'), 'l’équipe témoin')

    // Le lendemain soir : vingt-cinq heures ont passé, la connexion n'a jamais cédé.
    decalage = 25 * 3600_000
    assert.equal((await fetch(`${banc.url}/api/auth/me`, { headers: { Cookie: tele } })).status, 401)
    const coupee = new Promise<string>(r => {
      const delai = setTimeout(() => r('toujours reliée'), 3000)
      ecran.once('disconnect', motif => {
        clearTimeout(delai)
        r(motif)
      })
    })
    ;(ecran as any).emit('host:createTeam', { name: 'Après 25 h', emoji: '🍺' })
    const motif = await coupee
    await patienter(300)
    const equipes = (await instantane<any>(salle)).teams.map((t: any) => t.name)
    assert.deepEqual(equipes, ['Avant'], 'la télé expirée n’a rien créé')
    // La connexion tombe au premier geste : la page repasse par la connexion.
    assert.equal(motif, 'io server disconnect')
  } finally {
    Date.now = vrai
    await banc.close()
  }
})
