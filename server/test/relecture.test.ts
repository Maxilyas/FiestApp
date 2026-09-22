// Les suites de la relecture : ce qu'une lecture d'un seul tenant des
// quarante-quatre commits du plan d'action a trouvé entre les chantiers.
// Chaque constat est petit, et chacun laissait la base, la mémoire ou la
// salle dire autre chose que ce qui était arrivé.
//
// Chaque test échouait avant sa correction. Ceux qui jouent une soirée ont
// leur propre serveur jetable : l'expérience de l'un fausserait l'autre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { ADMIN, connexionAnimateur, cookieDe, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import type { QuizServerOptions } from '../src/server'
import { AuthStore } from '../src/auth/store'
import { QuizStore } from '../src/core/quizStore'
import { PartyBackup } from '../src/core/backup'
import { BaseMuette } from '../src/core/distante'

// ── Outils ────────────────────────────────────────────────────────────────

/** Un serveur jetable le temps d'un test, refermé quoi qu'il arrive. */
async function avecBanc(scenario: (banc: Banc) => Promise<void>, opts: Partial<QuizServerOptions> = {}) {
  const banc = await demarrer(opts)
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

/** Le fichier de la base permanente — celle qui tient le rôle de Turso. */
const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

/** Lit la base permanente sans passer par le serveur, comme on irait vérifier à la main. */
function lire<T = any>(banc: Banc, sql: string, ...args: unknown[]): T[] {
  const db = new Database(permanente(banc), { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}

/** L'empreinte sous laquelle un jeton de session est rangé : la base ne garde jamais le jeton lui-même. */
const empreinte = (cookie: string) => createHash('sha256').update(cookie.split('=')[1]).digest('hex')

/**
 * La base permanente refuse certaines écritures le temps de `fn` — une par
 * cible, telle qu'un déclencheur la nomme (« UPDATE OF slug ON accounts ») —
 * et répond normalement au reste. Les pannes attendues ne salissent pas le
 * journal du test : c'est le serveur qui les consigne, et c'est voulu.
 */
async function enPanne<T>(banc: Banc, cibles: string[], fn: () => Promise<T>): Promise<T> {
  const base = new Database(permanente(banc))
  const errorAvant = console.error
  console.error = (...args: unknown[]) => {
    if (!args.some(a => String(a).includes('panne simulée'))) errorAvant(...args)
  }
  try {
    cibles.forEach((cible, i) =>
      base.exec(`CREATE TRIGGER panne_${i} BEFORE ${cible} BEGIN SELECT RAISE(ABORT, 'panne simulée'); END`),
    )
    return await fn()
  } finally {
    cibles.forEach((_, i) => base.exec(`DROP TRIGGER IF EXISTS panne_${i}`))
    base.close()
    console.error = errorAvant
  }
}

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

// ── 3. La base d'abord, la mémoire ensuite ────────────────────────────────
//
// Les comptes et les profils vivent en mémoire, et la base permanente suit.
// Mais la mémoire changeait AVANT l'écriture : quand Turso refusait, la route
// disait « Erreur serveur », et le changement valait quand même — jusqu'au
// prochain redémarrage, qui le défaisait en silence.

test('un compte ne change pas en mémoire quand la base permanente refuse de l’écrire', () =>
  avecBanc(async banc => {
    const admin = await connexionAnimateur(banc.url)
    await inscrireProfil(banc.url, 'lea', 'Léa', '🦉')
    const lier = () => ecrire(banc.url, '/api/space/profil', { login: 'lea', password: 'motdepasse1' }, admin)
    /** L'espace que la connexion au profil de Léa ouvre — null s'il n'en ouvre aucun. */
    const consoleDeLea = async () =>
      ((await (await ecrire(banc.url, '/api/joueur/connexion', { login: 'lea', password: 'motdepasse1' })).json()) as any)
        .espace

    // Le rattachement que la base a refusé n'ouvre pas la console pour autant.
    await enPanne(banc, ['UPDATE OF profile_id ON accounts'], async () => {
      assert.equal((await lier()).status, 500)
      assert.equal(await consoleDeLea(), null, 'un rattachement refusé n’ouvre aucune console')
    })
    assert.equal((await lier()).status, 200)
    assert.equal((await consoleDeLea())?.slug, ADMIN.slug)
    // Ni un détachement refusé ne la ferme.
    await enPanne(banc, ['UPDATE OF profile_id ON accounts'], async () => {
      assert.equal((await ecrire(banc.url, '/api/space/profil', {}, admin, 'DELETE')).status, 500)
      assert.equal((await consoleDeLea())?.slug, ADMIN.slug, 'un détachement refusé ne détache rien')
    })

    // Les réglages de l'espace : les pages publiques gardent ce qui est en base.
    const espace = (slug: string) => fetch(`${banc.url}/s/${slug}/space.json`)
    const reglages = (await (await espace(ADMIN.slug)).json()) as Record<string, unknown>
    await enPanne(banc, ['UPDATE OF settings ON accounts'], async () => {
      const regle = await ecrire(banc.url, '/api/space/settings', { ...reglages, title: 'Soirée fantôme' }, admin, 'PUT')
      assert.equal(regle.status, 500)
    })
    assert.deepEqual(await (await espace(ADMIN.slug)).json(), reglages, 'des réglages refusés ne s’affichent pas')

    // Le nom dans l'adresse d'un autre compte, et sa désactivation.
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'zoe', name: 'Zoé', slug: 'chez-zoe' }, admin)
    const zoe = ((await cree.json()) as any).account.id as string
    await enPanne(banc, ['UPDATE OF slug ON accounts', 'UPDATE OF disabled_at ON accounts'], async () => {
      assert.equal((await ecrire(banc.url, `/api/admin/accounts/${zoe}`, { slug: 'chez-zoe-2' }, admin, 'PUT')).status, 500)
      assert.equal((await ecrire(banc.url, `/api/admin/accounts/${zoe}/disable`, {}, admin)).status, 500)
    })
    assert.equal((await espace('chez-zoe-2')).status, 404, 'une adresse refusée ne mène nulle part')
    assert.equal((await espace('chez-zoe')).status, 200, 'l’ancienne mène toujours chez Zoé')
    const comptes = (await (await fetch(`${banc.url}/api/admin/accounts`, { headers: { Cookie: admin } })).json()) as any[]
    assert.equal(comptes.find(c => c.id === zoe)?.status, 'pending', 'une désactivation refusée ne ferme rien')

    // Une déconnexion que la base refuse se retente, et le second essai
    // l'efface pour de bon : la mémoire l'avait oubliée dès le premier, et la
    // session ressuscitait au redémarrage suivant.
    const tablette = await connexionAnimateur(banc.url)
    await enPanne(banc, ['DELETE ON auth_sessions'], async () => {
      assert.equal((await ecrire(banc.url, '/api/auth/logout', {}, tablette)).status, 500)
    })
    assert.equal((await ecrire(banc.url, '/api/auth/logout', {}, tablette)).status, 200, 'le second essai trouve la session')
    assert.deepEqual(lire(banc, 'SELECT id FROM auth_sessions WHERE id = ?', empreinte(tablette)), [], 'et l’efface en base')
  }))

test('un profil ne change pas en mémoire quand la base permanente refuse de l’écrire', () =>
  avecBanc(async banc => {
    const inscrit = await ecrire(banc.url, '/api/joueur/inscription', {
      login: 'max',
      password: 'motdepasse1',
      name: 'Max',
      avatar: '🐺',
    })
    const { recovery } = (await inscrit.json()) as { recovery: string }
    const cookie = cookieDe(inscrit, 'qz_joueur')
    const moi = async () =>
      ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
    const ouvre = async (password: string) =>
      (await ecrire(banc.url, '/api/joueur/connexion', { login: 'max', password })).status

    await enPanne(banc, ['UPDATE OF name ON profiles', 'UPDATE OF password_hash ON profiles'], async () => {
      assert.equal((await ecrire(banc.url, '/api/joueur/moi', { name: 'Maxime' }, cookie, 'PUT')).status, 500)
      assert.equal((await moi()).name, 'Max', 'un prénom refusé ne s’affiche pas')

      // Le nouveau mot de passe ouvrait le profil jusqu'au redémarrage, et
      // l'ancien plus rien : on ne savait plus lequel taper.
      const change = await ecrire(banc.url, '/api/joueur/mot-de-passe', { current: 'motdepasse1', next: 'nouveau-mdp-2' }, cookie)
      assert.equal(change.status, 500)
      assert.equal(await ouvre('nouveau-mdp-2'), 401, 'un mot de passe refusé n’ouvre rien')
      assert.equal(await ouvre('motdepasse1'), 200, 'l’ancien ouvre toujours')

      // Le code de secours se consommait en mémoire, et le neuf — que la
      // réponse d'erreur ne portait pas — n'avait été montré à personne.
      const secours = await ecrire(banc.url, '/api/joueur/secours', { login: 'max', code: recovery, password: 'nouveau-mdp-3' })
      assert.equal(secours.status, 500)
    })
    const secours = await ecrire(banc.url, '/api/joueur/secours', { login: 'max', code: recovery, password: 'nouveau-mdp-3' })
    assert.equal(secours.status, 200, 'le code de secours que la base a refusé sert encore')

    // Une déconnexion refusée se retente, et le second essai l'efface en base.
    const tel = cookieDe(await ecrire(banc.url, '/api/joueur/connexion', { login: 'max', password: 'nouveau-mdp-3' }), 'qz_joueur')
    await enPanne(banc, ['DELETE ON profile_sessions'], async () => {
      assert.equal((await ecrire(banc.url, '/api/joueur/deconnexion', {}, tel)).status, 500)
    })
    assert.equal((await ecrire(banc.url, '/api/joueur/deconnexion', {}, tel)).status, 200)
    assert.deepEqual(lire(banc, 'SELECT id FROM profile_sessions WHERE id = ?', empreinte(tel)), [], 'la session est effacée en base')
  }))
