// Contre-expertise de securite-temps-reel-3, de bout en bout : la vraie télé
// branchée par un code d'appairage (routes réelles, session à `fin_max`), une
// vraie connexion socket.io, et l'horloge du processus avancée de 25 heures.
//
// L'expert l'avait montré à la couture `wireSockets`, avec des doublures. Ici,
// rien n'est doublé : si la connexion ouverte garde la main alors qu'une
// nouvelle présentation est refusée, le défaut est celui du vrai serveur.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/verification/securite/tele-expiree.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN,
  connecter,
  connexionAnimateur,
  cookieDe,
  demarrer,
  emitAck,
  instantane,
  patienter,
  ecrire,
} from '../../../../server/test/banc'

test('la télé branchée garde la main sur la soirée après ses 24 heures, tant que sa connexion tient', async () => {
  const vrai = Date.now
  let decalage = 0
  // L'horloge avance pour le serveur seulement. Le client socket.io du test
  // vit dans le même processus : avec 25 heures d'un coup, engine.io-client
  // croit à un minuteur étranglé (`_hasPingExpired`), coupe et se reconnecte,
  // et la commande part sur une connexion neuve qui ne s'est pas présentée —
  // ce qu'une vraie télé, qui garde sa propre horloge, ne ferait pas.
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
    assert.equal(hello.branchee, true, 'c’est bien une télé branchée (fin_max posé)')
    const salle = connecter(banc.url)
    assert.equal((await emitAck<any>(salle, 'party:watch', { slug: ADMIN.slug })).ok, true)
    // Témoin : avant l'échéance, la télé commande (le geste est bien observable).
    ;(ecran as any).emit('host:createTeam', { name: 'Avant', emoji: '🍕' })
    await instantane<any>(salle, s => s.teams?.some((t: any) => t.name === 'Avant'), 'l’équipe témoin')

    // Le lendemain soir : 25 heures ont passé, la connexion n'a jamais cédé.
    decalage = 25 * 3600_000
    const me = (await fetch(`${banc.url}/api/auth/me`, { headers: { Cookie: tele } })).status
    const autre = connecter(banc.url, tele)
    const reHello = await emitAck<any>(autre, 'host:hello', {})
    autre.close()

    // La connexion restée ouverte commande encore.
    ;(ecran as any).emit('host:createTeam', { name: 'Après 25 h', emoji: '🍺' })
    let creee = false
    try {
      await instantane<any>(salle, s => s.teams?.some((t: any) => t.name === 'Après 25 h'), 'l’équipe créée par la télé expirée')
      creee = true
    } catch {
      creee = false
    }
    await patienter(50)
    console.log(
      `  /api/auth/me de la télé : ${me} · nouvelle présentation : ok=${reHello.ok} · ` +
        `connexion d'origine encore ouverte : ${ecran.connected} · équipe créée après 25 h : ${creee}`,
    )
    assert.equal(me, 401, 'la session de la télé est bien expirée côté HTTP')
    assert.equal(reHello.ok, false, 'une nouvelle présentation est bien refusée')
    // Ce que l'invariant 16 promet : une télé branchée ne dépasse pas 24 heures.
    assert.equal(creee, false, 'la connexion d’une télé expirée ne commande plus la soirée')
    ecran.close()
    salle.close()
  } finally {
    Date.now = vrai
    await banc.close()
  }
})
