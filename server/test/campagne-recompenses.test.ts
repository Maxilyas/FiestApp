// Les récompenses de la campagne (le 5 octobre 2026) : ses hauts faits de
// série — le Funambule, Sans une égratignure, la Grande Série, le Tour du
// monde —, ses paliers — L'Alpiniste, L'Érudit, Le Marathonien —, et les
// légendaires qu'ils ouvrent : la Salamandre, le Serpent à plumes,
// l'Éléphant. Ses records par catégorie, et la relecture des séries d'avant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { FUNAMBULE, GRANDE_SERIE, hautsFaitsDeLaSerie } from '../src/core/campagne'
import { ProfileStore } from '../src/auth/profiles'
import type { Niveau } from '../../shared/campagne'

ProfileStore.tirageEclat = () => false

const DEBUT = Date.UTC(2026, 8, 26, 8, 0)

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/** Joue une série jusqu'au bout : `juste(i)` dit s'il trouve la question i. Rend la dernière réponse. */
async function jouerSerie(banc: Banc, cookie: string, juste: (i: number) => boolean, categories?: string[]) {
  const serie = (await poster(banc, cookie, '/api/campagne/serie', categories ? { categories } : {})).corps
  assert.ok(serie.id, serie.error)
  const questions = base(banc, db =>
    JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie.id) as { questions: string }).questions),
  ) as { bonne: number; reponses: string[] }[]
  let fin: any = null
  for (let i = 0; !fin?.finie; i++) {
    const q = questions[i]
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: juste(i) ? q.bonne : (q.bonne + 1) % q.reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    fin = r.corps
  }
  return fin
}

// ── La règle, pure ─────────────────────────────────────────────────────────

const niveaux = (...marches: [Niveau, number][]) => marches.flatMap(([n, k]) => Array.from({ length: k }, () => ({ niveau: n })))
const SERIE = niveaux(['facile', 5], ['moyen', 5], ['difficile', 5], ['expert', 45])

test('les hauts faits d’une série se lisent sur ses réponses, dans l’ordre', () => {
  // Deux erreurs, puis neuf bonnes réponses sur la dernière vie : le Funambule.
  const funambule = [true, false, true, false, ...Array(FUNAMBULE).fill(true), false]
  assert.deepEqual(hautsFaitsDeLaSerie({ questions: SERIE, justes: 11, categories: null }, funambule), ['hf:funambule'])
  // Huit seulement : pas encore.
  assert.deepEqual(hautsFaitsDeLaSerie({ questions: SERIE, justes: 10, categories: null }, [true, false, true, false, ...Array(8).fill(true), false]), [])
  // Les quinze premières justes, la première experte atteinte : Sans une égratignure.
  assert.deepEqual(hautsFaitsDeLaSerie({ questions: SERIE, justes: 15, categories: null }, [...Array(15).fill(true), false, false, false]), ['hf:intact'])
  // Une catégorie sans faciles sert les expertes d'emblée : ça ne compte pas.
  const sansFaciles = niveaux(['expert', 20])
  assert.deepEqual(hautsFaitsDeLaSerie({ questions: sansFaciles, justes: 5, categories: ['Sport'] }, [...Array(5).fill(true), false, false, false]), [])
  // Trente dans une série de toutes les catégories : la Grande Série ; d'une seule, non.
  const trente = [...Array(GRANDE_SERIE).fill(true), false, false, false]
  assert.deepEqual(hautsFaitsDeLaSerie({ questions: SERIE, justes: 30, categories: null }, trente), ['hf:intact', 'hf:grande-serie'])
  assert.deepEqual(hautsFaitsDeLaSerie({ questions: SERIE, justes: 30, categories: ['Histoire'] }, trente), ['hf:intact'])
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

/** Une base d'essai : douze questions de chacune des douze catégories, de toutes les difficultés. */
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

test('neuf bonnes réponses sur sa dernière vie : le Funambule, et la Salamandre avec lui', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const fin = await jouerSerie(banc, lea, i => i !== 0 && i !== 1 && i < 2 + FUNAMBULE)
    assert.deepEqual(
      fin.recompenses.map((r: any) => r.key),
      ['hf:funambule'],
    )
    assert.deepEqual(fin.legendaires, ['lg:salamandre'])
    const moi = (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    assert.ok(moi.legendaires.includes('lg:salamandre'))
    // Le titre se porte, comme celui de tout haut fait.
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { titre: 'hf:funambule' }, lea, 'PUT')).status, 200)
  } finally {
    await banc.close()
  }
})

test('dix dans une série de chacune des douze catégories : le Tour du monde, et ses records par catégorie', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    let derniere: any = null
    for (const [n, categorie] of CATEGORIES.entries()) {
      derniere = await jouerSerie(banc, lea, i => i < 10, [categorie])
      // La première série de dix fait tomber L'Alpiniste · Bronze.
      if (n === 0) assert.deepEqual(derniere.recompenses.map((r: any) => r.key), ['hf:alpiniste:1'])
    }
    assert.deepEqual(derniere.recompenses.map((r: any) => r.key), ['hf:tour-du-monde'])
    const etat = (await lire(banc, lea, '/api/campagne')).corps
    assert.equal(etat.records.length, CATEGORIES.length)
    assert.ok(etat.records.every((r: any) => r.record === 10))
    // Une série d'une seule catégorie ne fait pas la Grande Série, même longue.
    const marathon = ((await lire(banc, lea, '/api/joueur/moi')).corps.profile.hautsFaits as any[]).find(h => h.key === 'hf:marathonien')
    assert.equal(marathon.valeur, 10 * CATEGORIES.length, 'Le Marathonien compte toutes ses bonnes réponses')
  } finally {
    await banc.close()
  }
})

test('trente dans une série de toutes les catégories : la Grande Série, le Serpent à plumes, et le Sommet à L’Alpiniste · Or', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const fin = await jouerSerie(banc, lea, i => i < GRANDE_SERIE)
    assert.deepEqual(fin.recompenses.map((r: any) => r.key).sort(), [
      'hf:alpiniste:1',
      'hf:alpiniste:2',
      'hf:alpiniste:3',
      'hf:grande-serie',
      'hf:intact',
    ])
    assert.deepEqual(fin.legendaires, ['lg:serpent'])
    // Le Sommet, qu'aucune boutique ne vend, se gagne là.
    const theme = await ecrire(banc.url, '/api/joueur/moi', { theme: 'sommet' }, lea, 'PUT')
    assert.equal(theme.status, 200, ((await theme.json()) as any).error)
  } finally {
    await banc.close()
  }
})

test('au démarrage, les séries d’avant se relisent une fois : leur catégorie retrouvée, leurs paliers décernés', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const id = base(banc, db => (db.prepare(`SELECT id FROM profiles WHERE login = 'lea'`).get() as { id: string }).id)
    // Une série d'avant les catégories retenues : toutes ses questions d'histoire, dix justes.
    base(banc, db => {
      const questions = Array.from({ length: 13 }, (_, i) => ({ id: `q${i}`, texte: 't', reponses: ['a', 'b'], bonne: 0, categorie: 'Histoire', anecdote: null, niveau: 'facile' }))
      db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES ('ancienne', ?, ?, 13, 0, 10, 1, 2, 'serie')`,
      ).run(id, JSON.stringify(questions))
      const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, 0, ?, 2)')
      for (let i = 0; i < 13; i++) reponse.run('ancienne', i, `q${i}`, i < 10 ? 1 : 0)
      db.prepare(`DELETE FROM campagne_meta WHERE cle = 'relecture_des_series'`).run()
    })
    await banc.redemarrer()
    const etat = (await lire(banc, lea, '/api/campagne')).corps
    assert.deepEqual(etat.records, [{ categorie: 'Histoire', record: 10 }])
    assert.ok(((await lire(banc, lea, '/api/joueur/moi')).corps.profile.hautsFaits as any[]).find(h => h.key === 'hf:alpiniste').fois >= 1)
  } finally {
    await banc.close()
  }
})
