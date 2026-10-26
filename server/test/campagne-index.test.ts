// Les lectures des séries (`SERIES`, `core/campagne.ts`) — le record, l'état
// de la page, les records par catégorie, la série en cours, la série laissée
// qui s'arrête, l'abandon, la fin, la relecture des séries — ne parcourent
// que les séries. Écrit `COALESCE(mode, 'serie') = 'serie'`, le filtre ne
// pouvait servir aucun index : chacune partait de l'index du profil
// (`idx_campagne_series_profil`) et relisait toutes ses parties, de tous les
// modes — les épreuves, les révisions, les duels, les expéditions, et demain
// les parties du Cabinet de curiosités, une dizaine par jour et par joueur
// (la conception du Cabinet, § 1.2). Écrit `mode = 'serie'`, il prend l'index
// des sentiers `(profile_id, mode, …)`, qui ne mène qu'aux séries du profil.
//
// La base de production n'a pas de statistiques (`ANALYZE`) : SQLite y choisit
// ses index à l'aveugle — la série en cours, triée par sa date, lui faisait
// préférer l'index du profil pour s'épargner le tri. Le fichier `file:` qui
// tient lieu de Turso n'en a pas non plus : on y lit le plan de chaque lecture
// telle que le magasin l'a envoyée (le gabarit de `duels-index.test.ts`).
//
// La partie en cours de chaque mode se cherche de même : la révision laissée,
// la rencontre du dé, l'épreuve d'un sentier, l'étape d'un parcours,
// l'expédition en route. Triées par leur date, elles partaient elles aussi de
// l'index du profil et, sans partie en cours — le cas ordinaire —, relisaient
// toutes ses parties à chaque accueil, page de la campagne ou des sentiers,
// dé, carnet, parcours ou Expédition (la relecture du lot A1 du Cabinet).
// Puis toute recherche d'une partie d'un profil et d'un mode triée par sa
// date, avec ou sans `finie_le` — le défi de l'accueil, sa tentative, celle
// d'un duel, les dernières rencontres —, sans statistiques et sous des
// statistiques qui la feraient s'égarer ; et la lecture des missions, qui ne
// lit plus que les modes qu'elles comptent (la revue de sobriété du
// 25 octobre 2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { MODES_DE_SERIE } from '../../shared/campagne'
import { activiteDesJours, MODES_QUE_LES_MISSIONS_COMPTENT } from '../../shared/missions'
import { CampagneStore, type RecompensesDeCampagne } from '../src/core/campagne'
import { REVEIL_DU_CABINET } from '../src/core/cabinet/tables'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Le filtre des séries, sous ses deux écritures : le test rougit sur l'ancienne au lieu de ne rien trouver. */
const FILTRE_DES_SERIES = /(?:COALESCE\(mode, 'serie'\)|\bmode) = 'serie'/

/**
 * Les parties d'un mode d'un profil, et elles seules : l'index des sentiers
 * `(profile_id, mode, branche, palier)`, ou celui du profil, du mode et de la
 * date `(profile_id, mode, commencee_le)`, venu pour les missions le
 * 26 octobre 2026 — sans statistiques, SQLite prend l'un ou l'autre, et l'un
 * vaut l'autre ici.
 */
const PAR_LE_PROFIL_ET_LE_MODE = /^SEARCH campagne_series USING (COVERING )?INDEX idx_campagne_series_(sentiers|profil_mode) \(profile_id=\? AND mode=\?/

/**
 * Le mode dont une requête cherche la partie en cours : sur la table même,
 * sans alias, son profil, son mode et `finie_le IS NULL` dans un même
 * `WHERE`, quel qu'en soit l'ordre — une sous-requête compte, pas le
 * `CASE WHEN finie_le IS NULL` d'une liste de parties. Null : ce n'en est pas une.
 */
function modeCherche(sql: string): string | null {
  for (const m of sql.matchAll(/\bcampagne_series\s+WHERE\s+([^()]*?)(?=\s+(?:ORDER BY|GROUP BY|LIMIT)\b|[()]|$)/g)) {
    const conditions = m[1].split(/\s+AND\s+/).map(c => c.trim())
    const mode = conditions.map(c => /^mode = '(\w+)'$/.exec(c)?.[1]).find(Boolean)
    if (mode && conditions.includes('profile_id = ?') && conditions.includes('finie_le IS NULL')) return mode
  }
  return null
}

/**
 * Une recherche d'une partie d'un profil et d'un mode, triée par sa date —
 * la partie en cours, la tentative d'un défi ou d'un duel, les dernières
 * rencontres : sur la table même, son profil (`+` compris), son mode et
 * `ORDER BY commencee_le` (`+` compris), dans un même `WHERE`.
 */
function rechercheTriee(sql: string): string | null {
  for (const m of sql.matchAll(/\bcampagne_series\s+WHERE\s+([^()]*?)\s+ORDER BY\s+\+?commencee_le\b/g)) {
    const conditions = m[1].split(/\s+AND\s+/).map(c => c.trim())
    const mode = conditions.map(c => /^mode = '(\w+)'$/.exec(c)?.[1]).find(Boolean)
    if (mode && conditions.some(c => /^\+?profile_id = \?$/.test(c))) return mode
  }
  return null
}

/** Ce que les missions lisent des parties d'un profil (`activiteDepuis`). */
const LES_PARTIES_DES_MISSIONS = /SELECT id, mode, issue, finie_le FROM campagne_series/

/** Chaque lecture des séries, avec ses arguments : le plan se lit tel que le magasin l'a demandé. */
const lectures = new Map<string, unknown[]>()
/** Chaque recherche d'une partie en cours, de même. */
const enCours = new Map<string, unknown[]>()
/** Chaque recherche triée par la date, de même. */
const triees = new Map<string, unknown[]>()
/** La lecture des missions, de même. */
const missions = new Map<string, unknown[]>()

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    const instructions = methode === 'batch' ? (args[0] as unknown[]) : [typeof args[0] === 'string' ? { sql: args[0], args: args[1] } : args[0]]
    for (const i of instructions) {
      const { sql, args: valeurs } = typeof i === 'string' ? { sql: i, args: [] } : (i as { sql: string; args?: unknown })
      if (/\bcampagne_series\b/.test(sql) && FILTRE_DES_SERIES.test(sql)) lectures.set(sql, Array.isArray(valeurs) ? valeurs : [])
      if (modeCherche(sql)) enCours.set(sql, Array.isArray(valeurs) ? valeurs : [])
      if (rechercheTriee(sql)) triees.set(sql, Array.isArray(valeurs) ? valeurs : [])
      if (LES_PARTIES_DES_MISSIONS.test(sql)) missions.set(sql, Array.isArray(valeurs) ? valeurs : [])
    }
    return origine.apply(this, args)
  }
}

/** Rien à ranger : la relecture des séries n'a besoin que d'un magasin de récompenses pour partir. */
const RIEN: RecompensesDeCampagne = {
  ranger: async () => [],
  recompensesOf: () => new Map(),
  accorderPaliersDeCampagne: async () => [],
  legendairesOuverts: () => [],
  tirerUnEclat: async () => null,
}

/** Une ligne du plan (`EXPLAIN QUERY PLAN`). */
interface Etape {
  id: number
  parent: number
  detail: string
}

test('les lectures des séries ne parcourent que les séries — par le profil et le mode, sans statistiques', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-series-'))
  const fichier = path.join(dir, 'permanente.db')
  const horloge = { t: Date.UTC(2026, 9, 25, 9) }
  const campagne = new CampagneStore(`file:${fichier.replace(/\\/g, '/')}`, undefined, { base: baseDEssai(30), maintenant: () => horloge.t, recompenses: RIEN })
  const db = new Database(fichier)
  try {
    await campagne.init()
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'sqlite_stat%'").get() as { n: number }).n, 0, 'sans statistiques, comme la production')

    // Chaque chemin qui lit les séries : la page, les paliers, une série
    // commencée puis abandonnée, une autre jusqu'à sa troisième faute — sa fin
    // relit le record d'avant —, puis la relecture des séries.
    const lea = 'profil-lea'
    await campagne.etat(lea)
    await campagne.statsDe(lea)
    const abandonnee = await campagne.commencer(lea)
    await campagne.abandonnerSerie(lea, abandonnee.id)
    const serie = await campagne.commencer(lea)
    let question = serie.question
    for (let fautes = 0; question && fautes < 3; fautes++) {
      horloge.t += 10_000
      const r = await campagne.repondre(lea, serie.id, question.index, question.reponses.findIndex(x => !x.startsWith('Bonne')))
      question = r.finie ? undefined : r.suivante
    }
    await campagne.relireLesSeries()

    // Le compte de la page, ses records par catégorie, la série en cours, ses
    // paliers, la série laissée qui s'arrête, le record d'avant — l'abandon et
    // la fin l'écrivent pareil —, la relecture : sans eux tous, le test ne
    // dirait rien.
    assert.ok(lectures.size >= 7, `${lectures.size} lectures des séries seulement :\n${[...lectures.keys()].map(s => s.replace(/\s+/g, ' ')).join('\n')}`)
    for (const [sql, args] of lectures) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args) as Etape[]
      const dit = `${plan.map(e => `${e.id}<${e.parent} ${e.detail}`).join('\n')}\n— ${sql.replace(/\s+/g, ' ')}`
      const series = plan.filter(e => /^(SCAN|SEARCH) campagne_series\b/.test(e.detail))
      assert.ok(series.length > 0, `les séries absentes du plan :\n${dit}`)
      for (const e of series) {
        if (/\bprofile_id = \?/.test(sql)) {
          // Les séries d'un profil : par le profil ET le mode, jamais toutes ses parties.
          assert.match(e.detail, PAR_LE_PROFIL_ET_LE_MODE, `ses parties de tous les modes relues :\n${dit}`)
        } else {
          // Toutes les séries, une fois par version des séries : par le mode, jamais la table entière.
          assert.match(e.detail, /^SEARCH campagne_series USING (COVERING )?INDEX \w+ \(mode=\?\)/, `toute la table relue :\n${dit}`)
        }
      }
    }
  } finally {
    db.close()
    campagne.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('la partie en cours d’un mode se cherche par le profil et le mode — l’accueil, la campagne, le dé, le carnet, les sentiers, les parcours, l’Expédition', async () => {
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] }) })
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  // Ce que le serveur demande, seul : pas ce que le magasin de l'épreuve d'avant a lu.
  enCours.clear()
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const lire = async (chemin: string) => {
      const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: lea } })
      assert.equal(r.status, 200, `${chemin} : ${r.status}`)
    }
    // Chaque porte qui cherche une partie laissée, rien en cours d'abord — le
    // cas ordinaire, celui où l'index du profil relisait tout —, puis le dé,
    // qui en laisse une. L'accueil cherche la rencontre et l'épreuve laissées.
    await lire('/api/joueur/moi?accueil')
    await lire('/api/campagne')
    await lire('/api/campagne/carnet')
    await lire('/api/campagne/sentiers')
    await lire('/api/campagne/sujets')
    await lire('/api/expedition')
    const de = await ecrire(banc.url, '/api/campagne/rencontre', {}, lea)
    assert.equal(de.status, 200, ((await de.json()) as { error?: string }).error)

    // Les deux rencontres — l'accueil, le dé —, les trois sous-requêtes de
    // l'Expédition, la série, la révision, l'épreuve, le parcours : sans elles
    // toutes, le test ne dirait rien.
    assert.ok(enCours.size >= 9, `${enCours.size} recherches seulement :\n${[...enCours.keys()].map(s => s.replace(/\s+/g, ' ')).join('\n')}`)
    const modes = new Set([...enCours.keys()].map(modeCherche))
    for (const mode of ['serie', 'revision', 'rencontre', 'sentier', 'sujet', 'expedition']) {
      assert.ok(modes.has(mode), `la partie en cours du mode ${mode} jamais cherchée :\n${[...enCours.keys()].map(s => s.replace(/\s+/g, ' ')).join('\n')}`)
    }
    for (const [sql, args] of enCours) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args) as Etape[]
      const dit = `${plan.map(e => `${e.id}<${e.parent} ${e.detail}`).join('\n')}\n— ${sql.replace(/\s+/g, ' ')}`
      // Une partie retrouvée par son identifiant — l'expédition relit celle
      // que sa sous-requête a trouvée — n'est pas une recherche.
      const recherches = plan.filter(e => /^(SCAN|SEARCH) campagne_series\b/.test(e.detail) && !/\((id|rowid)=\?\)$/.test(e.detail))
      assert.ok(recherches.length > 0, `la recherche absente du plan :\n${dit}`)
      for (const e of recherches) {
        assert.match(e.detail, PAR_LE_PROFIL_ET_LE_MODE, `toutes ses parties relues pour trouver celle en cours :\n${dit}`)
      }
    }
  } finally {
    db.close()
    await banc.close()
  }
})

/**
 * Ce qu'un plan dit d'une recherche triée : rien, si elle part d'un index qui
 * tient le mode et le profil — la tentative d'un duel, le mode et le code du
 * duel (`PAR_SON_CODE`, règle `duels.md`) —, jamais du profil seul ni de toute
 * la table ; sinon, pourquoi. Une autre lecture de la même instruction — les
 * tentatives de la semaine de tout le monde, que l'accueil compte — garde son
 * plan à elle.
 */
function cequeLePlanLit(plan: Etape[], sql: string): string | null {
  const series = plan.filter(e => /^(SCAN|SEARCH) campagne_series\b/.test(e.detail) && !/\((id|rowid)=\?\)$/.test(e.detail))
  if (series.length === 0) return 'les parties absentes du plan'
  if (series.some(e => /^SCAN campagne_series\b/.test(e.detail))) return 'toute la table'
  if (series.some(e => /INDEX \w+ \(profile_id=\?(?: AND commencee_le[<>]=?\?)?\)$/.test(e.detail))) return 'toutes ses parties, de tous les modes, par l’index du profil'
  if (/\bduel = \?/.test(sql)) return series.some(e => /INDEX idx_campagne_series_duel \(mode=\? AND duel=\?\)/.test(e.detail)) ? null : 'la tentative d’un duel cherchée par le profil, pas par le code du duel'
  if (!series.some(e => /INDEX \w+ \(profile_id=\? AND mode=\?/.test(e.detail))) return 'sans le profil : les parties de ce mode de tout le monde'
  return null
}

/** Une base neuve, au schéma du serveur — la campagne, le Cabinet, les profils —, sous ces statistiques : ce que le planificateur ferait d'une production qui en aurait. */
async function sousCesStatistiques(stats: Record<string, string>): Promise<{ db: Database.Database; fermer: () => void }> {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-statistiques-'))
  const fichier = path.join(dir, 'permanente.db')
  const url = `file:${fichier.replace(/\\/g, '/')}`
  const profils = new ProfileStore(url)
  await profils.init()
  profils.close()
  const campagne = new CampagneStore(url, undefined, { base: baseDEssai(1), recompenses: RIEN })
  await campagne.init(REVEIL_DU_CABINET)
  campagne.close()
  const ecrite = new Database(fichier)
  try {
    ecrite.exec('ANALYZE')
    ecrite.exec('DELETE FROM sqlite_stat1')
    const stat = ecrite.prepare('INSERT INTO sqlite_stat1 (tbl, idx, stat) VALUES (?, ?, ?)')
    stat.run('campagne_series', null, '100000')
    for (const [idx, s] of Object.entries(stats)) stat.run('campagne_series', idx, s)
  } finally {
    ecrite.close()
  }
  // Les statistiques se lisent à l'ouverture.
  const db = new Database(fichier, { readonly: true })
  return { db, fermer: () => (db.close(), rmSync(dir, { recursive: true, force: true })) }
}

/**
 * Mille profils de cent parties, dix modes ; une partie d'un mode d'un profil
 * en compte dix, une semaine du défi trois, un duel deux : la production d'un
 * an de Cabinet, à peu près.
 */
const DE_LA_PRODUCTION: Record<string, string> = {
  idx_campagne_series_profil: '100000 100 1',
  idx_campagne_series_commencee: '100000 1',
  idx_campagne_series_sentiers: '100000 100 10 5 3',
  idx_campagne_series_profil_mode: '100000 100 10 1',
  idx_campagne_series_defi: '100000 10000 3',
  idx_campagne_series_duel: '100000 10000 2',
}

const unPlan = (db: Database.Database, sql: string, args: readonly unknown[]) => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args) as Etape[]
const ditLePlan = (plan: Etape[], sql: string) => `${plan.map(e => `${e.id}<${e.parent} ${e.detail}`).join('\n')}\n— ${sql.replace(/\s+/g, ' ')}`

test('toute recherche d’une partie d’un profil et d’un mode, triée par sa date, part d’un index qui tient le mode — l’accueil, le défi, les duels —, sans statistiques et sous des statistiques qui égareraient', async () => {
  // Le défi de la semaine sur l'accueil, la tentative du défi, celle d'un duel n'avaient pas le `+` de `LA_PLUS_RECENTE`, et
  // `campagne-index.test.ts` ne lisait que les recherches qui portent `finie_le IS NULL` : sans statistiques, SQLite les
  // menait à l'index du profil pour s'épargner le tri, et lisait toutes les parties du profil — 2 993 pas pour un fidèle à
  // chaque accueil, dix parties de plus par jour au Cabinet (la revue de sobriété du 25 octobre 2026).
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] }) })
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  triees.clear()
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const tom = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('tom') as { id: string }).id
    const lire = async (chemin: string) => {
      const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: lea } })
      assert.equal(r.status, 200, `${chemin} : ${r.status}`)
    }
    const poster = async <T>(chemin: string, corps: unknown = {}): Promise<T> => {
      const r = await ecrire(banc.url, chemin, corps, lea)
      const lu = (await r.json()) as T & { error?: string }
      assert.equal(r.status, 200, `${chemin} : ${lu.error}`)
      return lu
    }
    // L'accueil et son défi, la page du défi, le défi relevé ; la page des duels, ses dernières rencontres ; un duel lancé, sa page.
    await lire('/api/joueur/moi?accueil')
    await lire('/api/campagne/defi')
    await poster('/api/campagne/defi')
    await lire('/api/duels')
    const duel = await poster<{ code: string }>('/api/campagne/duel', { adversaire: tom })
    await lire(`/api/campagne/duel/${duel.code}`)

    const modes = new Set([...triees.keys()].map(rechercheTriee))
    for (const mode of ['defi', 'duel', 'rencontre']) assert.ok(modes.has(mode), `aucune recherche triée du mode ${mode} :\n${[...triees.keys()].map(s => s.replace(/\s+/g, ' ')).join('\n')}`)
    for (const [sql, args] of triees) {
      const plan = unPlan(db, sql, args)
      assert.equal(cequeLePlanLit(plan, sql), null, ditLePlan(plan, sql))
    }

    // Le défi de l'accueil compte les tentatives de la semaine sans relire tous les profils : un `profile_id IN (SELECT id
    // FROM profiles …)` les parcourait tous, à chaque accueil de chacun ; corrélé, il ne cherche que ceux de la semaine.
    const [accueil] = [...triees].filter(([sql]) => /json_group_array/.test(sql))
    assert.ok(accueil, 'le défi de l’accueil')
    const planDeLAccueil = unPlan(db, ...accueil)
    assert.ok(!planDeLAccueil.some(e => /^SCAN (profiles|p)\b/.test(e.detail)), `tous les profils relus :\n${ditLePlan(planDeLAccueil, accueil[0])}`)

    // Puis sous des statistiques qui feraient préférer le mauvais index sans le `+` qui l'écarte — celles d'une production
    // où une semaine du défi paraît plus sélective que ses défis à lui, puis un duel qui paraît moins sélectif que ses
    // tentatives à lui —, et chaque piège en est un : sans son `+`, la recherche s'y égare.
    const pieges: [string, Record<string, string>, string][] = [
      ['une semaine du défi, trois tentatives', DE_LA_PRODUCTION, "SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'defi' AND semaine = ? ORDER BY +commencee_le LIMIT 1"],
      ['un duel, cinquante tentatives', { ...DE_LA_PRODUCTION, idx_campagne_series_duel: '100000 10000 50' }, "SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'duel' AND duel = ? ORDER BY +commencee_le LIMIT 1"],
    ]
    for (const [quoi, stats, sansLePlus] of pieges) {
      const sous = await sousCesStatistiques(stats)
      try {
        for (const [sql, args] of triees) {
          const plan = unPlan(sous.db, sql, args)
          assert.equal(cequeLePlanLit(plan, sql), null, `sous les statistiques de ${quoi} :\n${ditLePlan(plan, sql)}`)
        }
        const egaree = unPlan(sous.db, sansLePlus, ['qui', 'quoi'])
        assert.notEqual(cequeLePlanLit(egaree, sansLePlus), null, `sous les statistiques de ${quoi}, la recherche sans son \`+\` ne s’égare pas :\n${ditLePlan(egaree, sansLePlus)}`)
      } finally {
        sous.fermer()
      }
    }
  } finally {
    db.close()
    await banc.close()
  }
})

test('les modes que la lecture des missions lit sont ceux que leur règle compte, ni plus ni moins', () => {
  // La lecture ne lit plus que `MODES_QUE_LES_MISSIONS_COMPTENT` : un mode qui compterait de plus, oublié dans la liste, ne
  // se compterait jamais, sans un mot. Chaque mode de partie, fini et validé hier : ceux qui changent sa journée.
  const hier = Date.UTC(2026, 9, 24, 12)
  const comptes = MODES_DE_SERIE.filter(mode => {
    const jours = activiteDesJours({ jour: [], jourParCategorie: [], soirees: [], reponses: [], series: [{ id: mode, mode, issue: 'validee', finieLe: hier }] })
    return [...jours.values()].some(a => a.duels + a.epreuves + a.etapes + a.defis > 0)
  })
  assert.deepEqual([...comptes].sort(), [...MODES_QUE_LES_MISSIONS_COMPTENT].sort())
})

test('les missions ne relisent que les parties des modes qu’elles comptent : jamais celles du Cabinet, par l’index du profil, du mode et de la date', async () => {
  // Chaque bilan du Cabinet redemande les missions du jour, et l'accueil aussi : elles relisaient toutes les parties du profil
  // des deux ou trois dernières semaines, de tous les modes, pour n'en compter que les duels, les rencontres, les épreuves,
  // les étapes et le défi — 131 parties du Cabinet relues à chaque bilan, 3 753 pas pour un fidèle (la revue de sobriété du
  // 25 octobre 2026). `mode IN (…)` seul n'y change rien : l'index du profil lit encore chaque ligne pour en voir le mode.
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] }) })
  const fichier = banc.quizDbUrl.replace(/^file:/, '')
  missions.clear()
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const ecrite = new Database(fichier)
    const id = (ecrite.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id
    try {
      // Quinze jours de Cabinet, dix parties par jour, et un duel au dé fini hier : écrits derrière le dos du serveur.
      const partie = ecrite.prepare("INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, issue) VALUES (?, ?, '[]', 3, 0, 1, ?, ?, ?, ?)")
      const maintenant = Date.now()
      for (let jour = 0; jour < 15; jour++) for (let k = 0; k < 10; k++) partie.run(`cab-${jour}-${k}`, id, maintenant - jour * 86_400_000 - k * 60_000, maintenant - jour * 86_400_000 - k * 60_000 + 30_000, 'cabinet', 'libre')
      partie.run('rencontre-d-hier', id, maintenant - 86_400_000, maintenant - 86_300_000, 'rencontre', null)
    } finally {
      ecrite.close()
    }
    const r = await fetch(`${banc.url}/api/joueur/missions`, { headers: { Cookie: lea } })
    assert.equal(r.status, 200)
    assert.equal(missions.size, 1, `la lecture des missions :\n${[...missions.keys()].join('\n')}`)
    const [[sql, args]] = [...missions]
    const db = new Database(fichier, { readonly: true })
    try {
      const rendues = db.prepare(sql).all(...args) as { mode: string }[]
      assert.deepEqual(rendues.map(p => p.mode), ['rencontre'], 'les parties qu’elles comptent, et rien du Cabinet')
      const plan = unPlan(db, sql, args)
      for (const e of plan.filter(e => /^(SCAN|SEARCH) campagne_series\b/.test(e.detail))) {
        assert.match(e.detail, /^SEARCH campagne_series USING (COVERING )?INDEX idx_campagne_series_profil_mode \(profile_id=\? AND mode=\? AND commencee_le>\?\)/, ditLePlan(plan, sql))
      }
    } finally {
      db.close()
    }
    // Et sous les statistiques d'une production, le même index.
    const sous = await sousCesStatistiques(DE_LA_PRODUCTION)
    try {
      const plan = unPlan(sous.db, sql, args)
      assert.ok(plan.some(e => /INDEX idx_campagne_series_profil_mode \(profile_id=\? AND mode=\? AND commencee_le>\?\)/.test(e.detail)), ditLePlan(plan, sql))
    } finally {
      sous.fermer()
    }
  } finally {
    await banc.close()
  }
})
