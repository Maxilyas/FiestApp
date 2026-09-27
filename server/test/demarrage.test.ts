// Le réveil de l'hébergeur : ce que le démarrage attend de la base
// permanente avant d'ouvrir le port.
//
// L'audit du 27 septembre 2026 (`retours/2026-09-27/`, axe 14) : soixante
// allers-retours strictement en série à chaque réveil, dont vingt-quatre
// relectures du schéma — trois secondes à 50 ms l'aller-retour, pendant
// lesquelles le premier invité qui scannait le QR regardait une page
// blanche [perf-serveur-6 = exploitation-7]. On compte sur le fichier
// `file:` qui tient lieu de Turso.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { createQuizServer } from '../src/server'
import { ADMIN } from './banc'
import { ArchiveStore } from '../src/core/archive'
import { PartageStore } from '../src/core/partages'

// ── Le compteur ───────────────────────────────────────────────────────────

/** Ce que la base permanente a servi, et combien de requêtes à la fois. */
const compte = { actif: false, delaiMs: 0, schemas: new Map<string, number>(), enVol: 0, enVolMax: 0 }

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    if (!compte.actif) return origine.apply(this, args)
    const premiere = (methode === 'batch' ? (args[0] as unknown[])[0] : args[0]) as string | { sql: string }
    const sql = typeof premiere === 'string' ? premiere : premiere.sql
    const table = /^PRAGMA table_info\((\w+)\)/.exec(sql)?.[1]
    if (table) compte.schemas.set(table, (compte.schemas.get(table) ?? 0) + 1)
    compte.enVol++
    compte.enVolMax = Math.max(compte.enVolMax, compte.enVol)
    try {
      // La latence de Turso, simulée : ce qui part de front se chevauche.
      if (compte.delaiMs > 0) await new Promise(r => setTimeout(r, compte.delaiMs))
      return await origine.apply(this, args)
    } finally {
      compte.enVol--
    }
  }
}

function dossier() {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-demarrage-'))
  return {
    dir,
    opts: { port: 0, dbPath: path.join(dir, 'locale.db'), quizDbUrl: `file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`, admin: ADMIN },
  }
}

test('le démarrage lit le schéma de chaque table une seule fois, et ouvre ses magasins de front', async () => {
  const { dir, opts } = dossier()
  try {
    // Le premier démarrage crée tout ; c'est le réveil ordinaire qu'on compte.
    await (await createQuizServer(opts)).close()
    Object.assign(compte, { actif: true, delaiMs: 5, schemas: new Map(), enVol: 0, enVolMax: 0 })
    try {
      await (await createQuizServer(opts)).close()
    } finally {
      compte.actif = false
    }
    const relues = [...compte.schemas].filter(([, n]) => n > 1)
    assert.deepEqual(relues, [], 'une table dont on relit le schéma à chaque colonne')
    assert.ok(compte.schemas.size >= 8, `${compte.schemas.size} tables vérifiées : le compteur voit bien les migrations`)
    // Le miroir, les profils, le quiz du jour, la bibliothèque, les
    // programmes, les partages, l'historique : ensemble.
    assert.ok(compte.enVolMax >= 4, `au plus ${compte.enVolMax} requête(s) à la fois vers la base permanente`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('un magasin qui ne s’ouvre pas fait échouer le démarrage, une fois les autres arrivés au bout', async () => {
  const { dir, opts } = dossier()
  await (await createQuizServer(opts)).close()
  const partages = PartageStore.prototype.init
  const archives = ArchiveStore.prototype.init
  let historiqueFini = false
  PartageStore.prototype.init = async () => {
    throw new Error('Les partages ne s’ouvrent pas')
  }
  ArchiveStore.prototype.init = async function (this: ArchiveStore, ...args: Parameters<ArchiveStore['init']>) {
    await new Promise(r => setTimeout(r, 300))
    await archives.apply(this, args)
    historiqueFini = true
  }
  try {
    await assert.rejects(createQuizServer(opts), /Les partages ne s’ouvrent pas/)
    // Rien n'écrit plus dans la base quand le démarrage a échoué : l'hébergeur
    // relance un processus neuf, qui ne doit croiser aucun reste de celui-ci.
    assert.equal(historiqueFini, true, 'l’échec attend que l’historique ait fini de s’ouvrir')
  } finally {
    PartageStore.prototype.init = partages
    ArchiveStore.prototype.init = archives
    rmSync(dir, { recursive: true, force: true })
  }
})
