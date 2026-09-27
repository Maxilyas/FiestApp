// Contre-expertise de securite-temps-reel-1 : ce qu'il faut au griefeur pour
// que « Rendre sa place » reste cassé, et ce que l'animateur y peut.
//
// Le blocage d'une minute est VOULU et déjà gardé par
// `server/test/telephone-perdu.test.ts` (« L'espace aussi a trop manqué cette
// minute : un autre téléphone patiente »). Ce qui est neuf chez l'expert, c'est
// qu'il se prolonge. On mesure ici à quel prix :
//   1. une seule connexion ne bloque qu'une minute par code (son propre
//      plafond de cinq l'arrête ensuite) — le comportement voulu ;
//   2. une connexion neuve par minute suffit à le prolonger ;
//   3. le geste de l'animateur (un code neuf) rend ses essais à l'espace…
//      et à chaque connexion du griefeur, qui le remplit aussitôt.
//
// L'horloge du serveur avance à la main (la fenêtre est d'une minute) ; le
// client socket.io garde la vraie, sans quoi il se croirait étranglé et se
// reconnecterait (voir tele-expiree.test.ts).
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/verification/securite/reprise-griefeur.test.ts
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
} from '../../../../server/test/banc'
import { ESSAIS_MANQUES_MAX, FENETRE_ESSAIS_MS } from '../../../../server/src/core/places'

const SLUG = ADMIN.slug
const vrai = Date.now
let decalage = 0
Date.now = () => {
  if (decalage === 0) return vrai()
  const pile = new Error().stack ?? ''
  return /engine\.io-client|socket\.io-client/.test(pile) ? vrai() : vrai() + decalage
}

let banc: Banc
let cookie: string
let host: Socket
before(async () => {
  banc = await demarrer()
  cookie = await connexionAnimateur(banc.url)
  host = await ecranCommun(banc.url, cookie)
})
after(async () => {
  host.close()
  await banc.close()
  Date.now = vrai
})

async function suiveur(): Promise<Socket> {
  const s = connecter(banc.url)
  assert.equal((await emitAck<any>(s, 'party:watch', { slug: SLUG })).ok, true)
  return s
}
const faux = (bon: string, i: number) => {
  const c = String(100000 + i)
  return c === bon ? '999999' : c
}
const tenter = async (s: Socket, code: string) => emitAck<any>(s, 'player:reprendre', { slug: SLUG, code })

async function unePlaceARendre(nom: string): Promise<{ playerId: string }> {
  const p = await invite(banc.url, nom, '🦁')
  p.socket.close()
  await instantane<any>(host, s => s.players.find((x: any) => x.id === p.playerId)?.connected === false, `${nom} hors ligne`)
  return { playerId: p.playerId }
}

test('1 · une seule connexion : le blocage ne dure qu’une minute (voulu)', async () => {
  const { playerId } = await unePlaceARendre('Rachid')
  const { code } = await emitAck<any>(host, 'host:rendrePlace', { playerId })
  const g = await suiveur()
  for (let i = 0; i < ESSAIS_MANQUES_MAX; i++) await tenter(g, faux(code, i))
  const emprunte = await suiveur()
  assert.match((await tenter(emprunte, code)).error, /réessaie dans une minute/)
  // Une minute plus tard, le même griefeur insiste : sa connexion a épuisé
  // son propre plafond, elle ne remplit plus le compteur de l'espace.
  decalage += FENETRE_ESSAIS_MS + 1000
  const encore = await tenter(g, faux(code, 42))
  const reprise = await tenter(emprunte, code)
  console.log(`  une connexion, après une minute : griefeur « ${encore.error} » · bon code : ok=${reprise.ok}`)
  assert.equal(reprise.ok, true, 'une seule connexion ne bloque qu’une minute')
  for (const s of [g, emprunte]) s.close()
})

test('2 · une connexion neuve par minute prolonge le blocage', async () => {
  const { playerId } = await unePlaceARendre('Nadia')
  const { code } = await emitAck<any>(host, 'host:rendrePlace', { playerId })
  const emprunte = await suiveur()
  const refus: string[] = []
  for (let minute = 0; minute < 2; minute++) {
    const g = await suiveur()
    for (let i = 0; i < ESSAIS_MANQUES_MAX; i++) await tenter(g, faux(code, 10 * minute + i))
    g.close()
    const r = await tenter(emprunte, code)
    refus.push(r.ok ? 'ok' : r.error)
    decalage += FENETRE_ESSAIS_MS + 1000
  }
  console.log(`  une connexion neuve par minute — le bon code, minute après minute : ${JSON.stringify(refus)}`)
  // Ce que le code promet aujourd'hui (le code vit trois minutes) : cassé tant
  // que le griefeur tient. On le constate, sans en faire une exigence ici.
  assert.ok(refus.every(r => /réessaie dans une minute/.test(r)))
  emprunte.close()
})

test('3 · le code neuf de l’animateur rend aussi ses essais au griefeur, qui le remplit aussitôt', async () => {
  const { playerId } = await unePlaceARendre('Karim')
  const premier = await emitAck<any>(host, 'host:rendrePlace', { playerId })
  const g = await suiveur()
  for (let i = 0; i < ESSAIS_MANQUES_MAX; i++) await tenter(g, faux(premier.code, 20 + i))
  // L'animateur fait ce que le refus demande : un code neuf.
  const neuf = await emitAck<any>(host, 'host:rendrePlace', { playerId })
  // La même connexion du griefeur a retrouvé ses cinq essais (génération neuve).
  for (let i = 0; i < ESSAIS_MANQUES_MAX; i++) await tenter(g, faux(neuf.code, 30 + i))
  const emprunte = await suiveur()
  const r = await tenter(emprunte, neuf.code)
  console.log(`  après le code neuf, le même griefeur (même connexion) : bon code → ${r.ok ? 'ok' : r.error}`)
  assert.equal(r.ok, false)
  for (const s of [g, emprunte]) s.close()
})
