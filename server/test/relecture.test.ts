// Les suites de la relecture : ce qu'une lecture d'un seul tenant des
// quarante-quatre commits du plan d'action a trouvé entre les chantiers.
// Chaque constat est petit, et chacun laissait la base, la mémoire ou la
// salle dire autre chose que ce qui était arrivé.
//
// Chaque test échouait avant sa correction. Ceux qui jouent une soirée ont
// leur propre serveur jetable : l'expérience de l'un fausserait l'autre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { AuthStore } from '../src/auth/store'
import { QuizStore } from '../src/core/quizStore'
import { PartyBackup } from '../src/core/backup'
import { BaseMuette } from '../src/core/distante'

// ── Outils ────────────────────────────────────────────────────────────────

/** Un dossier jetable, effacé quoi qu'il arrive. */
async function dansUnDossier(fn: (dir: string) => Promise<void> | void) {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-relecture-'))
  try {
    await fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Les colonnes d'une table, lues sans passer par le serveur. */
function colonnes(fichier: string, table: string): string[] {
  const db = new Database(fichier, { readonly: true, fileMustExist: true })
  try {
    return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name)
  } finally {
    db.close()
  }
}

// ── 4. Une migration ratée arrête le démarrage ────────────────────────────

/**
 * La base permanente telle qu'une version d'avant l'a laissée : les tables
 * sont là, sans les colonnes arrivées depuis — le rattachement au profil, les
 * espaces, les octets des photos, les équipes du miroir.
 */
const SCHEMA_D_AVANT = `
  CREATE TABLE accounts (id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL, password_hash TEXT, disabled_at INTEGER, created_at INTEGER NOT NULL, last_login_at INTEGER,
    settings TEXT NOT NULL DEFAULT '{}');
  CREATE TABLE quizzes (id TEXT PRIMARY KEY, title TEXT NOT NULL, questions TEXT NOT NULL, created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL);
  CREATE TABLE quiz_images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE party_players (id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL, token TEXT NOT NULL,
    created_at INTEGER NOT NULL);
  CREATE TABLE party_teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL, position INTEGER NOT NULL,
    created_at INTEGER NOT NULL);
  CREATE TABLE party_bonus (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, points INTEGER NOT NULL, reason TEXT NOT NULL,
    created_at INTEGER NOT NULL);
  CREATE TABLE party_answers (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, quiz_title TEXT NOT NULL,
    q_index INTEGER NOT NULL, kind TEXT NOT NULL, player_id TEXT NOT NULL, answered INTEGER NOT NULL, correct INTEGER,
    choice INTEGER, value REAL, target REAL, ms INTEGER, changes INTEGER NOT NULL, points INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL, observed INTEGER NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE party_scores (id TEXT PRIMARY KEY, player_id TEXT NOT NULL, session_id TEXT, points INTEGER NOT NULL,
    reason TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE party_sessions (id TEXT PRIMARY KEY, status TEXT NOT NULL, participant_ids TEXT NOT NULL,
    state TEXT NOT NULL, timers TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
`

/** Les magasins de la base permanente qui migrent au démarrage, et ce que chacun doit ajouter. */
const MIGRATIONS: { nom: string; demarrer: (url: string) => Promise<void>; ajoute: [string, string][] }[] = [
  {
    nom: 'les comptes',
    demarrer: async url => {
      const store = new AuthStore(url)
      try {
        await store.init()
      } finally {
        store.close()
      }
    },
    ajoute: [['accounts', 'profile_id']],
  },
  {
    nom: 'la bibliothèque',
    demarrer: async url => {
      const store = new QuizStore(url)
      try {
        await store.init('espace-par-defaut')
      } finally {
        store.close()
      }
    },
    ajoute: [
      ['quiz_images', 'bytes'],
      ['quizzes', 'space_id'],
      ['quiz_images', 'space_id'],
    ],
  },
  {
    nom: 'le miroir',
    demarrer: async url => {
      const miroir = new PartyBackup(url)
      try {
        await miroir.init('espace-par-defaut')
      } finally {
        await miroir.close()
      }
    },
    ajoute: [
      ['party_players', 'team_id'],
      ['party_players', 'profile_id'],
      ...['party_players', 'party_teams', 'party_bonus', 'party_answers', 'party_scores', 'party_sessions'].map(
        (t): [string, string] => [t, 'space_id'],
      ),
    ],
  },
]

/**
 * La base décroche pile au moment d'ajouter une colonne — le premier
 * démarrage d'une nouvelle version, un soir où Turso hoquette. Tout le reste
 * répond normalement.
 */
async function sansAlter<T>(fn: () => Promise<T>): Promise<T> {
  const prototype = Sqlite3Client.prototype as any
  const execute = prototype.execute
  prototype.execute = function (this: unknown, stmt: unknown, args?: unknown) {
    const sql = typeof stmt === 'string' ? stmt : (stmt as { sql: string }).sql
    if (/^\s*ALTER\s+TABLE/i.test(sql)) return Promise.reject(new BaseMuette(10_000))
    return execute.call(this, stmt, args)
  }
  try {
    return await fn()
  } finally {
    prototype.execute = execute
  }
}

test('une colonne qui n’a pas pu s’ajouter arrête le démarrage, au lieu de passer pour « déjà là »', () =>
  dansUnDossier(async dir => {
    const fichier = path.join(dir, 'permanente.db')
    const url = `file:${fichier.replace(/\\/g, '/')}`
    const avant = new Database(fichier)
    avant.exec(SCHEMA_D_AVANT)
    avant.close()

    // Chaque magasin prenait n'importe quel refus pour « la colonne existe
    // déjà » : le démarrage passait, la colonne manquait, et la panne ne se
    // voyait qu'à la première écriture qui la nommait — ou jamais, pour une
    // colonne qu'on ne fait que lire.
    await sansAlter(async () => {
      for (const { nom, demarrer } of MIGRATIONS) {
        await assert.rejects(demarrer(url), BaseMuette, `${nom} : la panne doit faire échouer le démarrage`)
      }
    })
    for (const { nom, ajoute } of MIGRATIONS) {
      for (const [table, colonne] of ajoute) {
        assert.ok(!colonnes(fichier, table).includes(colonne), `${nom} : ${table}.${colonne} n’a pas pu être ajoutée`)
      }
    }

    // Le démarrage suivant, la base revenue, ajoute ce qui manque…
    for (const { demarrer } of MIGRATIONS) await demarrer(url)
    for (const { nom, ajoute } of MIGRATIONS) {
      for (const [table, colonne] of ajoute) {
        assert.ok(colonnes(fichier, table).includes(colonne), `${nom} : ${table}.${colonne} doit exister`)
      }
    }
    // … et ceux d'après ne tentent plus rien : le schéma dit que tout est là.
    await sansAlter(async () => {
      for (const { demarrer } of MIGRATIONS) await demarrer(url)
    })
  }))
