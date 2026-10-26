// La suite ne dépend pas du jour où elle tourne.
//
// Une soirée se date à sa première question jouée, à l'horloge de la machine
// (`laureatsDeSaison`, `core/saisons.ts`) — une horloge que rien ne règle.
// Du 25 octobre au 1er novembre, du 20 au 26 décembre et du 30 décembre au
// 2 janvier, chaque soirée close à deux ouvrait donc son légendaire de
// saison, jusque dans les épreuves : `cloture.test.ts` attendait
// ['lg:chouette'] et recevait la Citrouille avec, `soiree.test.ts` comptait
// deux lauréats de trop. La CI de toutes les PR serait passée au rouge le
// 24 octobre 2026 à 22 h UTC, dix-neuf jours par an, sans que rien ait changé.
//
// Le banc ferme le calendrier des soirées — l'Éclat, lui, chaque fichier qui
// compte au point près le neutralise lui-même, comme celui-ci ;
// `saisons.test.ts`, qui date ses soirées lui-même, le rouvre. Ici, une
// soirée redatée du soir d'Halloween — ce que ferait l'horloge le 31 octobre —
// ne doit rien ouvrir.
//
// Chaque mode qui lit une saison a le sien, le Cabinet de curiosités
// compris : la première œuvre gagnée pendant une fête y réveille son gardien.
// Son calendrier est né le 25 octobre 2026, premier jour d'Halloween. Le banc
// et le smoke ferment donc chaque calendrier de `core/saisons.ts` — un
// oublié, et chaque épreuve qui gagne une œuvre ces jours-là réveillerait la
// Citrouille —, et rien d'autre ne les ferme : en ligne, ils suivent
// `shared/saisons.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  qcm,
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import * as saisons from '../src/core/saisons'
import { calendrierDesSoirees, calendrierDuCabinet } from '../src/core/saisons'

ProfileStore.tirageEclat = () => false

type Calendrier = { periodeDu: (jour: string) => unknown }

/**
 * Les calendriers de `core/saisons.ts` : chaque objet `{ periodeDu }` qu'il
 * exporte, celui d'un mode à venir compris. Choisis par leur forme, pas par
 * leur nom : un `saisonDuDefi` passait sous un filtre sur « calendrier… »,
 * jamais fermé, et aucune épreuve ne rougissait.
 */
const CALENDRIERS = Object.entries(saisons)
  .filter(([, v]) => typeof v === 'object' && v !== null && typeof (v as Calendrier).periodeDu === 'function')
  .map(([nom]) => nom)

test('sous le banc, le calendrier des soirées est fermé', () => {
  assert.equal(calendrierDesSoirees.periodeDu('2026-10-31'), null)
  assert.equal(calendrierDesSoirees.periodeDu('2026-12-24'), null)
  assert.equal(calendrierDesSoirees.periodeDu('2027-01-01'), null)
})

test('sous le banc, le calendrier du Cabinet est fermé', () => {
  for (const jour of ['2026-10-25', '2026-10-31', '2026-11-01', '2026-12-24', '2027-01-01']) {
    assert.equal(calendrierDuCabinet.periodeDu(jour), null, `le ${jour}, aucune œuvre du banc ne réveille son gardien`)
  }
})

test('le banc et le smoke ferment chaque calendrier de core/saisons.ts', () => {
  for (const connu of ['calendrierDesSoirees', 'calendrierDesExpeditions', 'calendrierDuCabinet']) {
    assert.ok(CALENDRIERS.includes(connu), `${connu} parmi les calendriers lus : ${CALENDRIERS.join(', ')}`)
  }
  // Le smoke ne lance pas le banc : il ferme les siens à son début, une ligne
  // chacun, avant son premier serveur. Fermé plus bas, un calendrier serait
  // ouvert pendant tout ce qui précède — et pour de bon dans un magasin qui
  // garderait `periodeDu` à sa construction.
  const smoke = readFileSync(new URL('../scripts/smoke.ts', import.meta.url), 'utf8')
  const premierServeur = smoke.indexOf('createQuizServer(')
  assert.ok(premierServeur > 0, 'le smoke démarre ses serveurs par createQuizServer')
  for (const nom of CALENDRIERS) {
    const calendrier = (saisons as Record<string, unknown>)[nom] as Calendrier
    assert.equal(calendrier.periodeDu('2026-10-31'), null, `le banc ferme ${nom}`)
    const fermeture = smoke.search(new RegExp(`^${nom}\\.periodeDu = \\(\\) => null$`, 'm'))
    // `ok` plutôt que `match` : en échec, la phrase seule, pas les 130 Ko du smoke.
    assert.ok(fermeture >= 0 && fermeture < premierServeur, `le smoke ferme ${nom} avant son premier serveur`)
  }
})

test('hors du banc, chaque calendrier suit les dates de shared/saisons.ts', () => {
  // Le banc les ferme tous à son import : ce qu'ils valent en ligne se lit
  // dans un processus qui ne l'a pas chargé. Un calendrier fermé dans le code
  // même ne ferait plus tomber une seule Citrouille, et aucune épreuve sous
  // le banc ne le verrait. L'enfant lit les noms choisis ici : un seul filtre,
  // que les deux processus ne peuvent pas lire chacun à sa façon.
  const script = `
    const saisons = await import(${JSON.stringify(new URL('../src/core/saisons.ts', import.meta.url).href)})
    const lus = ${JSON.stringify(CALENDRIERS)}
      .map(nom => [nom, saisons[nom].periodeDu('2026-10-25')?.saison.key ?? null, saisons[nom].periodeDu('2026-10-24')?.saison.key ?? null])
    process.stdout.write(JSON.stringify(lus))
  `
  const sortie = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
  })
  // Le 25 octobre ouvre Halloween ; la veille, rien.
  assert.deepEqual(JSON.parse(sortie), CALENDRIERS.map(nom => [nom, 'halloween', null]))
})

test('une soirée close le soir d’Halloween n’ouvre pas la Citrouille dans une épreuve', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    let host: Socket = await ecranCommun(banc.url, cookie)
    const salle = [await invite(banc.url, 'Alice', '', { cookie: alice }), await invite(banc.url, 'Bob', '🐻')]

    const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
      attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
    const sessionId = await lancerQuiz(host, quiz)
    await vue(sessionId, v => v.phase === 'question', 'la question')
    const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
    for (const qui of salle) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
      assert.equal(ack.ok, true, ack.error)
    }
    await revelee
    const podium = vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
    await podium
    ;(host as any).emit('host:endSession', { sessionId })

    // Le journal redaté du 31 octobre au soir, comme l'aurait daté l'horloge
    // de la machine ce jour-là ; relu au réveil, comme un disque retrouvé.
    host.close()
    const db = new Database(banc.dbPath)
    db.prepare('UPDATE answer_log SET created_at = ?').run(Date.UTC(2026, 9, 31, 20, 0))
    db.close()
    await banc.redemarrer()
    host = await ecranCommun(banc.url, cookie)
    const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    assert.equal((await toast).kind, 'info')

    const moi = (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: alice } })).json()) as any
    assert.ok(!moi.profile.legendaires.includes('lg:citrouille'), 'le calendrier des soirées est fermé : pas de Citrouille')
    const permanente = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    try {
      const lignes = permanente.prepare(`SELECT COUNT(*) AS n FROM profile_badges WHERE badge LIKE 'saison:%'`).get() as { n: number }
      assert.equal(lignes.n, 0, 'aucune saison rangée')
    } finally {
      permanente.close()
    }
  } finally {
    await banc.close()
  }
})
