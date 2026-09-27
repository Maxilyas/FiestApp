// Le recalcul au barème du jour : relire l'historique une fois, et jamais
// sur une base qui hoquette.
//
// Invariant 20 : quand le barème change, `recalculerHistorique` relit toutes
// les soirées de l'historique au démarrage, et remet à la version du jour les
// lignes qu'il ne sait pas relire — sinon il relirait tout à chaque
// démarrage. La ligne du quiz du jour y passait par `json_set(…, '$.v', ?)` :
// le nombre lié partait en flottant, et SQLite écrivait `{"v":6.0,…}`, que la
// recherche des lignes d'avant (`{"v":6,%`) retrouvait à chaque réveil — tout
// l'historique relu à chaque démarrage. Et une lecture d'archive qui échouait
// en route — Turso qui hoquette — passait pour une archive illisible : ses
// lignes étaient remises au barème sans avoir été relues, et le démarrage
// suivant n'avait plus rien à relire. Ses profils gardaient l'ancien barème
// pour toujours.
//
// Chaque test a son propre serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  qcm,
  type Banc,
} from './banc'
import { createQuizServer } from '../src/server'
import { ArchiveStore, buildArchive } from '../src/core/archive'
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

/** Redémarre, et rend ce que le serveur a écrit au journal pendant ce temps. */
async function redemarrer(banc: Banc): Promise<string[]> {
  const lignes: string[] = []
  const log = console.log
  console.log = (...a: unknown[]) => void lignes.push(a.map(String).join(' '))
  try {
    await banc.redemarrer()
  } finally {
    console.log = log
  }
  return lignes
}

test('après un barème monté, le démarrage suivant ne relit plus tout l’historique — la ligne du quiz du jour comprise', async () => {
  const banc = await demarrer({ horlogeDuJour: () => Date.UTC(2026, 8, 26, 8, 0) })
  try {
    const cookie = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')

    // Une question du quiz du jour : Alice a sa ligne `#jour`.
    const etat = (await (await ecrire(banc.url, '/api/jour/commencer', {}, alice)).json()) as { jour: string }
    await ecrire(banc.url, '/api/jour/repondre', { jour: etat.jour, index: 0, choix: 0 }, alice)

    // Une soirée close : une archive, que chaque recalcul relit.
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const host = await ecranCommun(banc.url, cookie)
    const a = await invite(banc.url, 'Alice', '', { cookie: alice })
    const b = await invite(banc.url, 'Bob', '🐻')
    const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
      attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
    const sessionId = await lancerQuiz(host, quiz)
    await vue(sessionId, v => v.phase === 'question', 'la question')
    const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
    for (const qui of [a, b]) await emitAck(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
    await revelee
    ;(host as any).emit('host:endSession', { sessionId })
    const close = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    assert.equal((await close).kind, 'info')
    host.close()

    // Le barème monte : toutes les lignes sont d'une version d'avant.
    const db = new Database(permanente(banc))
    db.prepare(`UPDATE profile_xp SET detail = json_set(detail, '$.v', ${VERSION_BAREME - 1})`).run()
    db.close()

    const premier = await redemarrer(banc)
    assert.ok(premier.some(l => l.includes('expérience recalculée')), 'le premier démarrage relit l’historique')
    const lu = new Database(permanente(banc), { readonly: true })
    const jour = lu.prepare(`SELECT detail FROM profile_xp WHERE soiree_id = '#jour'`).get() as { detail: string }
    lu.close()
    assert.ok(jour.detail.startsWith(`{"v":${VERSION_BAREME},`), `la ligne du quiz du jour lit ${jour.detail}`)

    const second = await redemarrer(banc)
    assert.deepEqual(second.filter(l => l.includes('expérience recalculée')), [], 'le démarrage suivant n’a plus rien à relire')
  } finally {
    await banc.close()
  }
})

// ── Une base qui hoquette pendant le recalcul ─────────────────────────────

// La panne : la prochaine lecture d'une archive échoue, comme un `fetch failed`.
let panne = false
const proto = Sqlite3Client.prototype as any
const execute = proto.execute
proto.execute = async function (this: unknown, ...args: any[]) {
  const sql = typeof args[0] === 'string' ? args[0] : args[0]?.sql
  if (panne && /^SELECT \* FROM soirees WHERE space_id = \? AND id = \?/.test(sql ?? '')) {
    panne = false
    const e = new TypeError('fetch failed')
    ;(e as any).cause = { code: 'ECONNRESET' }
    throw e
  }
  return execute.apply(this, args)
}

/** Une soirée de quatre invités, dont deux profils, dix questions. */
function soiree(k: number, profils: string[]) {
  const t0 = Date.UTC(2026, 5, 1 + k, 19)
  const players = ['Alice', 'Bruno', 'Chloé', 'Dora'].map((name, i) => ({
    id: randomUUID(),
    name,
    avatar: '🦊',
    token: '',
    teamId: null,
    profileId: profils[i] ?? null,
    createdAt: t0 + i,
  }))
  const sessionId = randomUUID()
  const answers: any[] = []
  const scores: any[] = []
  const questions: any[] = []
  for (let q = 0; q < 10; q++) {
    questions.push({ kind: 'choice', text: `Question ${q}`, answers: ['A', 'B'], correct: 0, duration: 20, image: null })
    players.forEach((p, i) => {
      const correct = (i + q) % 3 !== 0
      const points = correct ? 900 - i * 100 : 0
      answers.push({
        sessionId,
        quizTitle: 'Quiz',
        qIndex: q,
        kind: 'choice',
        playerId: p.id,
        answered: true,
        correct,
        choice: correct ? 0 : 1,
        value: null,
        target: null,
        ms: 2000 + i * 500,
        changes: 0,
        points,
        durationMs: 20000,
        observed: false,
        category: null,
        createdAt: t0 + q * 60_000,
      })
      if (points) scores.push({ playerId: p.id, sessionId, points, reason: `Q${q + 1}`, createdAt: t0 + q * 60_000 })
    })
  }
  return buildArchive({
    soiree: { id: `soiree-${k}`, heldAt: t0 } as any,
    players: players as any,
    teams: [],
    bonuses: [],
    scores,
    answers,
    packsBySession: new Map([[sessionId, { title: 'Quiz', questions }]]) as any,
    library: [],
  })!
}

test('une lecture d’archive qui échoue pendant le recalcul refuse le démarrage, et le suivant relit tout', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'recalcul-panne-'))
  const log = console.log
  const err = console.error
  console.log = console.error = () => {}
  const admin = { ...ADMIN, slug: 'chez-antoine' }
  try {
    const base = path.join(dir, 'base.db')
    const url = (f: string) => `file:${f}`
    let n = 0
    const lancer = async (f: string) => (await createQuizServer({ port: 0, dbPath: path.join(dir, `l${++n}.db`), quizDbUrl: url(f), admin })).close()
    await lancer(base)

    // Deux profils, deux soirées rangées ; leurs lignes écrites par un barème
    // d'avant, qui payait 1 000 par soirée.
    const db = new Database(base)
    const espace = String((db.prepare(`SELECT id FROM accounts WHERE slug = ?`).get(admin.slug) as any).id)
    const profils = ['p-alice', 'p-bruno']
    for (const [i, id] of profils.entries()) {
      db.prepare(
        `INSERT INTO profiles (id, login, name, avatar, finition, password_hash, recovery_hash, xp, created_at) VALUES (?, ?, ?, '🦊', 'auto', 'x', 'x', 0, 0)`,
      ).run(id, `joueur${i}`, `Joueur ${i}`)
    }
    db.close()
    const archives = new ArchiveStore(url(base))
    await archives.init(espace)
    for (let k = 0; k < 2; k++) {
      const a = soiree(k, profils)
      await archives.save(espace, a.id, a.heldAt, a.archive)
    }
    archives.close()
    const db2 = new Database(base)
    for (let k = 0; k < 2; k++) {
      for (const id of profils) {
        db2
          .prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, 1000, ?, 0)`)
          .run(id, `soiree-${k}`, espace, JSON.stringify({ v: VERSION_BAREME - 1, gain: {}, releve: {} }))
      }
    }
    db2.prepare(`UPDATE profiles SET xp = 2000`).run()
    db2.close()

    const xpDe = (f: string) => {
      const d = new Database(f, { readonly: true })
      try {
        return Object.fromEntries((d.prepare('SELECT id, xp FROM profiles ORDER BY id').all() as any[]).map(r => [r.id, r.xp]))
      } finally {
        d.close()
      }
    }

    // La référence : le recalcul sans panne.
    const ref = path.join(dir, 'ref.db')
    copyFileSync(base, ref)
    await lancer(ref)
    const attendu = xpDe(ref)
    assert.ok(Object.values(attendu).every(x => Number(x) < 2000), `le recalcul relit les deux soirées : ${JSON.stringify(attendu)}`)

    // La panne passagère : le démarrage est refusé — l'hébergeur le relance.
    const f = path.join(dir, 'panne.db')
    copyFileSync(base, f)
    panne = true
    await assert.rejects(lancer(f), 'une base muette n’est pas une archive illisible')
    // Le démarrage suivant relit tout, cette soirée comprise.
    await lancer(f)
    assert.deepEqual(xpDe(f), attendu, 'chaque profil a l’expérience du recalcul complet')
  } finally {
    panne = false
    console.log = log
    console.error = err
    rmSync(dir, { recursive: true, force: true })
  }
})
