// Les tentatives d'un duel se cherchent par le code du duel, jamais par le
// profil (`PAR_SON_CODE`, `core/campagne.ts`). La base de production n'a pas
// de statistiques (`ANALYZE`) : départagés à l'aveugle, SQLite prenait
// l'index des séries par profil et parcourait, pour chaque duel, toutes les
// tentatives de duel des deux joueurs — 50 000 lignes au quota de Turso,
// trois fois à chaque ouverture de la page des duels du plus fidèle (le
// 22 octobre 2026). Le fichier `file:` qui tient lieu de Turso n'en a pas non
// plus : on y lit le plan de chaque requête qui joint les tentatives d'un
// duel, sur chaque chemin qui en lance une — et de la recherche d'une
// tentative seule (`tentativeDuDuel`), par le code de son duel aussi.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Une jointure des tentatives d'un duel par son code, l'alias de la série devant. */
const JOINTURE = /\b(\w+)\.duel = d\.code\b/

/** Chaque requête qui en a une, avec ses arguments : le plan se lit tel que le serveur l'a demandé. */
const vues = new Map<string, unknown[]>()

/** Le rattrapage du journal des duels : ce qui est arrivé depuis une série, par son `rowid` (`lecturesDuJournalDesDuels`). */
const DEPUIS_UNE_SERIE = /FROM campagne_series\s+WHERE rowid > \?/
const rattrapages = new Map<string, unknown[]>()

/** La tentative d'un joueur à un duel, cherchée seule (`tentativeDuDuel`) : son profil, le mode, le code du duel. */
const SA_TENTATIVE = /FROM campagne_series WHERE \+?profile_id = \? AND mode = 'duel' AND duel = \?/
const tentatives = new Map<string, unknown[]>()

/** Une ligne du plan (`EXPLAIN QUERY PLAN`) : un arbre, chaque bloc ses boucles dans l'ordre, la plus extérieure d'abord. */
interface Etape {
  id: number
  parent: number
  detail: string
}

const surLesDuels = (e: Etape) => /^(SCAN|SEARCH) d\b/.test(e.detail)

/**
 * Une boucle à l'intérieur d'une boucle sur les duels : jointe après eux dans
 * son bloc, ou dans une sous-requête qu'ils corrèlent. Celle-là cherche les
 * tentatives d'un duel. Une série qui mène la lecture — ses duels à lui, par
 * son profil ; tous ceux du classement, par leur mode — trouve ses duels par
 * leur code : son index à elle est le bon.
 */
function dansUnDuel(plan: Etape[], etape: Etape): boolean {
  const freres = (e: Etape) => plan.filter(x => x.parent === e.parent && x !== e)
  if (freres(etape).some(x => surLesDuels(x) && x.id < etape.id)) return true
  for (let e = plan.find(x => x.id === etape.parent); e; e = plan.find(x => x.id === e!.parent)) {
    if (/SUBQUERY/.test(e.detail) && freres(e).some(surLesDuels)) return true
  }
  return false
}

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    const instructions = methode === 'batch' ? (args[0] as unknown[]) : [typeof args[0] === 'string' ? { sql: args[0], args: args[1] } : args[0]]
    for (const i of instructions) {
      const { sql, args: valeurs } = typeof i === 'string' ? { sql: i, args: [] } : (i as { sql: string; args?: unknown })
      if (JOINTURE.test(sql)) vues.set(sql, Array.isArray(valeurs) ? valeurs : [])
      if (DEPUIS_UNE_SERIE.test(sql)) rattrapages.set(sql, Array.isArray(valeurs) ? valeurs : [])
      if (SA_TENTATIVE.test(sql)) tentatives.set(sql, Array.isArray(valeurs) ? valeurs : [])
    }
    return origine.apply(this, args)
  }
}

test('les tentatives d’un duel se cherchent par son code — lancer un duel, la page, l’accueil, la carte d’un joueur, un ami, le QG', async () => {
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] }) })
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const tom = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('tom') as { id: string }).id
    const lire = async (chemin: string, cookie = lea) => {
      const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })
      assert.equal(r.status, 200, `${chemin} : ${r.status}`)
    }
    const poster = async (chemin: string, corps: unknown = {}) => {
      const r = await ecrire(banc.url, chemin, corps, lea)
      assert.equal(r.status, 200, `${chemin} : ${((await r.json()) as { error?: string }).error}`)
    }
    await poster('/api/campagne/duel', { adversaire: tom })
    const code = (db.prepare('SELECT code FROM campagne_duels WHERE adversaire = ?').get(tom) as { code: string }).code
    // La page du duel cherche les deux tentatives, chacune seule.
    await lire(`/api/campagne/duel/${code}`)
    await lire('/api/duels')
    await lire('/api/joueur/moi?accueil')
    await lire(`/api/duels/joueurs/${tom}`)
    await poster(`/api/campagne/amis/${tom}/ajout`)
    await lire('/api/campagne/amis')
    await lire('/api/duels/amis')
    await lire('/api/admin/duels/suivi', await connexionAnimateur(banc.url))

    // Le duel ouvert entre eux, la page et l'accueil, l'ami rajouté, les deux lectures du QG : sans elles, le test ne dirait rien.
    assert.ok(vues.size >= 6, `${vues.size} requêtes seulement joignent les tentatives d’un duel :\n${[...vues.keys()].map(s => s.replace(/\s+/g, ' ')).join('\n')}`)
    let jugees = 0
    for (const [sql, args] of vues) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args) as Etape[]
      const dit = `${plan.map(e => `${e.id}<${e.parent} ${e.detail}`).join('\n')}\n— ${sql.replace(/\s+/g, ' ')}`
      for (const alias of new Set([...sql.matchAll(new RegExp(JOINTURE.source, 'g'))].map(m => m[1]))) {
        const boucles = plan.filter(e => new RegExp(`^(SCAN|SEARCH) ${alias}\\b`).test(e.detail))
        assert.ok(boucles.length > 0, `les tentatives (${alias}) absentes du plan :\n${dit}`)
        // Les duels d'un seul joueur ne partent pas de toutes les tentatives de duel du serveur : le cercle de ses
        // amis le faisait (1 226 lignes au quota pour le plus fidèle, le 22 octobre 2026). Le classement, lui, lit
        // les duels de tous.
        if (/\bd\.(auteur|adversaire) = \?/.test(sql)) {
          const toutes = boucles.find(e => !dansUnDuel(plan, e) && new RegExp(`^(SCAN ${alias}\\b|SEARCH ${alias} USING (COVERING )?INDEX idx_campagne_series_duel \\(mode=\\?\\)$)`).test(e.detail))
          assert.equal(toutes, undefined, `toutes les tentatives de duel (${alias}) pour les duels d’un seul joueur :\n${dit}`)
        }
        for (const e of boucles.filter(e => dansUnDuel(plan, e))) {
          jugees++
          assert.match(e.detail, new RegExp(`^SEARCH ${alias} USING (COVERING )?INDEX idx_campagne_series_duel \\(mode=\\? AND duel=\\?\\)`), `les tentatives d’un duel (${alias}) lues par leur profil, pas par son code :\n${dit}`)
        }
      }
    }
    assert.ok(jugees >= 6, `${jugees} recherches des tentatives d’un duel seulement`)

    // Sa tentative, cherchée seule — à la page du duel, au relevé, à la fin d'un duel classé, à la correction — : par le code
    // du duel aussi. Par son profil, triée par sa date, elle partait de l'index du profil et relisait toutes ses parties,
    // de tous les modes (la revue de sobriété du 25 octobre 2026).
    assert.ok(tentatives.size >= 1, 'la tentative d’un duel, cherchée seule')
    for (const [sql, args] of tentatives) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args) as Etape[]
      const dit = `${plan.map(e => `${e.id}<${e.parent} ${e.detail}`).join('\n')}\n— ${sql.replace(/\s+/g, ' ')}`
      const series = plan.filter(e => /^(SCAN|SEARCH) campagne_series\b/.test(e.detail))
      assert.ok(series.length > 0, `les séries absentes du plan :\n${dit}`)
      for (const e of series) assert.match(e.detail, /^SEARCH campagne_series USING (COVERING )?INDEX idx_campagne_series_duel \(mode=\? AND duel=\?\)/, `sa tentative cherchée par son profil :\n${dit}`)
    }

    // Le rattrapage du journal des duels part du `rowid` de la dernière série
    // vue : rien, ou presque, quand rien n'est arrivé. Sans statistiques,
    // SQLite préférait l'index du mode, et parcourait toutes les rencontres et
    // deux fois toutes les tentatives de duel, deux fois par minute de jeu (la
    // revue du 24 octobre 2026). Le banc le relit à chaque lecture.
    assert.ok(rattrapages.size >= 2, `${rattrapages.size} lectures du rattrapage seulement`)
    for (const [sql, args] of rattrapages) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args) as Etape[]
      const dit = `${plan.map(e => `${e.id}<${e.parent} ${e.detail}`).join('\n')}\n— ${sql.replace(/\s+/g, ' ')}`
      const series = plan.filter(e => /^(SCAN|SEARCH) campagne_series\b/.test(e.detail))
      assert.ok(series.length > 0, `les séries absentes du plan :\n${dit}`)
      for (const e of series) assert.equal(e.detail, 'SEARCH campagne_series USING INTEGER PRIMARY KEY (rowid>?)', `le rattrapage ne part pas de son rowid :\n${dit}`)
    }
  } finally {
    db.close()
    await banc.close()
  }
})
