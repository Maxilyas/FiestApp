// Ce que le Cabinet de curiosités lit en base, plan par plan : chaque lecture
// du lot froid part de la clé du profil, les parties du jour de l'index
// `(profile_id, commencee_le)` — le `+mode` y écarte celui des sentiers, qui
// parcourrait toutes ses parties du Cabinet depuis toujours —, les gestes et
// la partie en cours de leur clé, et les gardes des lots d'écriture (D9) de
// même. Le quota de Turso compte chaque ligne qu'une requête parcourt, pas
// celles qu'elle rend : un `SCAN` d'une table qui grandit avec l'histoire se
// paierait à chaque page et à chaque départ (la conception, D7).
//
// La base de production n'a pas de statistiques (`ANALYZE`), le fichier `file:`
// qui tient lieu de Turso non plus : on y lit le plan de chaque instruction
// telle que le magasin l'a envoyée (le gabarit de `campagne-index.test.ts`).
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { DIX_HEURES, aLaMain, departEnBase, dossierDEssai, fermerLesMagasins, magasinDEssai } from './cabinet-banc'
import { lecturesDuMusee, partiesDuJour } from '../src/core/cabinet/tables'
import { prixDe } from '../../shared/cabinet/musee'
import { ProfileStore } from '../src/auth/profiles'

/** Chaque instruction du Cabinet envoyée à la base, avec ses arguments : le plan se lit tel qu'elle est partie. */
const envoyees = new Map<string, unknown[]>()
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    const instructions = methode === 'batch' ? (args[0] as unknown[]) : [typeof args[0] === 'string' ? { sql: args[0], args: args[1] } : args[0]]
    for (const i of instructions) {
      const { sql, args: valeurs } = typeof i === 'string' ? { sql: i, args: [] } : (i as { sql: string; args?: unknown })
      // Ce qui lit ou écrit des lignes : le schéma — ses tables, sa colonne — n'a pas de plan.
      // L'expédition qui l'attend, que le lot froid lit aussi.
      const duCabinet = /\bcabinet(_gestes|_profils|_oeuvres)?\b/.test(sql) || /mode = 'expedition' AND finie_le IS NULL LIMIT 1/.test(sql)
      if (duCabinet && /^\s*(SELECT|INSERT|UPDATE|DELETE)\b/.test(sql)) envoyees.set(sql, Array.isArray(valeurs) ? valeurs : [])
    }
    return origine.apply(this, args)
  }
}

after(fermerLesMagasins)

/**
 * Une instruction aux paramètres numérotés (`?1`, repris plusieurs fois dans le
 * lot du départ) réécrite en paramètres anonymes, ses valeurs dans l'ordre où
 * elle les lit : le client de la base les lie par leur place, `better-sqlite3`
 * ne lit que des paramètres anonymes ou nommés.
 */
function anonyme(sql: string, args: readonly unknown[] = []): { sql: string; args: unknown[] } {
  if (!/\?\d/.test(sql)) return { sql, args: [...args] }
  const lus: unknown[] = []
  return { sql: sql.replace(/\?(\d+)/g, (_, n: string) => (lus.push(args[Number(n) - 1]), '?')), args: lus }
}

interface Etape {
  id: number
  parent: number
  detail: string
}

test('le Cabinet ne lit rien qui grandisse avec l’histoire : chaque instruction part d’une clé ou de l’index du profil et de la date', async () => {
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'cabinet.db')
  const { campagne, cabinet } = await magasinDEssai(fichier, horloge)
  // Ce que L'Explorateur lit de ses salles, dans le lot des paliers de la campagne, branché comme le serveur le branche :
  // ses œuvres, de la lecture même du lot froid — son plan se lit avec les autres.
  campagne.statsEnPlus = cabinet.statsEnPlus
  // De la poussière d'or, posée avant sa première page, pour qu'il ait de quoi dépenser.
  aLaMain(fichier, "INSERT INTO cabinet_profils (profile_id, poussiere, cree_le, maj_le) VALUES ('qui', 1000, 0, 0)")
  // Une page froide, une dorure — la première dépense du jour, qui fige la visite —, un départ libre, sa première
  // réponse, « Quitter » ; puis une case de la visite et une chasse ; un achat, une dorure, un échange, un cartel, une
  // partie finie relue : chaque lecture et chaque garde que le magasin envoie.
  await cabinet.page('qui')
  await cabinet.dorer('qui', 'prudence', prixDe('prudence', 'dorure'))
  const libre = await cabinet.commencer('qui', { origine: 'libre', jeu: 'pari', carte: null })
  const plan = departEnBase(fichier, libre.id)
  const q1 = (plan.tirages[0] as { q1: { bonne: number } }).q1
  horloge.t += 5_000
  assert.ok('partie' in (await cabinet.geste('qui', libre.id, 2, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: q1.bonne } } })))
  assert.ok('partie' in (await cabinet.geste('qui', libre.id, 3, { quoi: 'quitter' })))
  const visite = await cabinet.commencer('qui', { origine: 'visite', case: 0, carte: null })
  assert.ok('partie' in (await cabinet.geste('qui', visite.id, 2, { quoi: 'quitter' })))
  const chasse = await cabinet.commencer('qui', { origine: 'chasse', oeuvre: 'lecon', carte: null })
  assert.ok('partie' in (await cabinet.geste('qui', chasse.id, 2, { quoi: 'quitter' })))
  await cabinet.acheter('qui', 'lancee', prixDe('lancee', 'achat'))
  await cabinet.dorer('qui', 'lancee', prixDe('lancee', 'dorure'))
  await cabinet.echanger('qui', 1)
  assert.ok('cartel' in (await cabinet.cartel('qui', 'lancee')))
  assert.equal((await cabinet.partie('qui', libre.id))?.etat.fin?.pourquoi, 'quittee')
  assert.equal((await campagne.statsDe('qui')).traversees, 0)

  const db = new Database(fichier, { readonly: true })
  try {
    assert.ok(envoyees.size >= 10, `${envoyees.size} instructions relevées`)
    assert.ok([...envoyees.keys()].some(sql => /^UPDATE cabinet_profils SET visites = \?/.test(sql)), 'la visite que la première dépense du jour fige')
    // Sous la ligne que la dépense vient d'écrire, par sa clé : son plan se lit avec les autres, plus bas.
    assert.ok(
      [...envoyees.keys()].some(sql => /^UPDATE cabinet_profils SET visites = \?[\s\S]*EXISTS \(SELECT 1 FROM cabinet_oeuvres WHERE profile_id = \? AND oeuvre = \?/.test(sql)),
      'la visite que la dépense fige, gardée par la dépense même',
    )
    for (const [sql, args] of envoyees) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${anonyme(sql).sql}`).all(...anonyme(sql, args).args) as Etape[]
      const dit = `${plan.map(e => `${e.id}<${e.parent} ${e.detail}`).join('\n')}\n— ${sql.replace(/\s+/g, ' ')}`
      for (const e of plan) {
        assert.doesNotMatch(e.detail, /^SCAN (campagne_series|campagne_reponses|cabinet_gestes|cabinet_profils|cabinet_oeuvres)\b/, `une table parcourue :\n${dit}`)
        if (/^SEARCH campagne_series\b/.test(e.detail) && !/\((id|rowid)=\?\)$/.test(e.detail)) {
          // Ses parties du jour par le profil et la date ; jamais l'index des sentiers pour le Cabinet, qui les lirait toutes.
          const duJour = /^SEARCH campagne_series USING INDEX idx_campagne_series_profil \(profile_id=\? AND commencee_le>\?\)/.test(e.detail)
          // L'expédition qui l'attend, par le profil et le mode : l'index des sentiers, ou celui de la date (venu pour les missions le 26 octobre 2026, après la revue de sobriété de la veille).
          const expedition = /idx_campagne_series_(sentiers|profil_mode) \(profile_id=\? AND mode=\?\)/.test(e.detail) && /'expedition'/.test(sql)
          assert.ok(duJour || expedition, `ses parties lues autrement que par le profil et la date :\n${dit}`)
        }
      }
    }
  } finally {
    db.close()
  }
})

test('les saisons que le lot froid relit de l’étagère : trois clés, chacune par la clé primaire, jamais l’étagère entière', async () => {
  // Le magasin d'essai n'a pas d'étagère, et ne la lit pas : la table vient des profils, sur leur base. Sa clé
  // `(profile_id, badge, soiree_id)` sert les trois colonnes ; par le profil seul, la lecture parcourrait tout ce que
  // le plus fidèle a jamais gagné — des centaines de lignes, à chaque musée lu à froid.
  const fichier = path.join(dossierDEssai(), 'etagere.db')
  const profils = new ProfileStore(`file:${fichier}`)
  await profils.init()
  profils.close()
  const etagere = (avec: boolean) => lecturesDuMusee('qui', DIX_HEURES, avec).flatMap(i => (typeof i !== 'string' && /\bprofile_badges\b/.test(i.sql) ? [i] : []))
  assert.equal(etagere(false).length, 0, 'sans étagère, rien ne la lit')
  const [saisons] = etagere(true)
  assert.ok(saisons)
  const db = new Database(fichier, { readonly: true })
  try {
    const plan = (db.prepare(`EXPLAIN QUERY PLAN ${saisons.sql}`).all(...((saisons.args ?? []) as unknown[])) as Etape[]).map(e => e.detail).join('\n')
    assert.match(plan, /^SEARCH profile_badges USING (PRIMARY KEY|(COVERING )?INDEX sqlite_autoindex_profile_badges_1) \(profile_id=\? AND badge=\? AND soiree_id=\?\)$/, plan)
  } finally {
    db.close()
  }
})

test('le `+` devant le mode tient les parties du jour à l’index du profil, même quand des statistiques feraient préférer celui des sentiers', async () => {
  // Sans statistiques, SQLite prend déjà l'index du profil et de la date pour `mode = 'cabinet'` : le plan
  // d'aujourd'hui ne dit pas à quoi sert le `+`. Qu'un `ANALYZE` passe, ou que le planificateur change d'avis, et un
  // mode très sélectif sur l'index des sentiers `(profile_id, mode, …)` l'emporterait — il parcourt alors toutes les
  // parties du Cabinet du profil depuis toujours. Des statistiques qui le disent, et le `+` qui l'écarte.
  const fichier = path.join(dossierDEssai(), 'statistiques.db')
  await magasinDEssai(fichier, { t: DIX_HEURES })
  const db = new Database(fichier)
  try {
    db.exec('ANALYZE')
    db.exec('DELETE FROM sqlite_stat1')
    const stat = db.prepare('INSERT INTO sqlite_stat1 (tbl, idx, stat) VALUES (?, ?, ?)')
    stat.run('campagne_series', null, '100000')
    // Cent parties par profil, deux par instant ; trois par profil et par mode — dix modes, des milliers de séries chacun.
    stat.run('campagne_series', 'idx_campagne_series_profil', '100000 100 2')
    stat.run('campagne_series', 'idx_campagne_series_sentiers', '100000 100 3 3 3')
    // L'index du profil, du mode et de la date, venu pour les missions le 26 octobre 2026.
    stat.run('campagne_series', 'idx_campagne_series_profil_mode', '100000 100 3 1')
    stat.run('campagne_series', 'idx_campagne_series_commencee', '100000 2')
    stat.run('campagne_series', 'idx_campagne_series_defi', '100000 10000 10')
    stat.run('campagne_series', 'idx_campagne_series_duel', '100000 10000 1')
  } finally {
    db.close()
  }
  // Les statistiques se lisent à l'ouverture.
  const planDe = (filtre: string) => {
    const lue = new Database(fichier, { readonly: true })
    try {
      return (lue.prepare(`EXPLAIN QUERY PLAN SELECT id FROM campagne_series WHERE ${filtre}`).all('qui', DIX_HEURES) as Etape[]).map(e => e.detail).join('\n')
    } finally {
      lue.close()
    }
  }
  const PAR_LE_PROFIL_ET_LA_DATE = /^SEARCH campagne_series USING INDEX idx_campagne_series_profil \(profile_id=\? AND commencee_le>\?\)/m
  assert.match(planDe(partiesDuJour()), PAR_LE_PROFIL_ET_LA_DATE)
  // L'index de la date venu pour les missions mènerait, sans le `+`, aux seules parties du Cabinet du jour : rien qui
  // grandisse non plus. Le `+` ne doit rien à sa présence — sans lui, ces statistiques mènent bien aux sentiers.
  assert.match(planDe(partiesDuJour().replace('+mode', 'mode')), /idx_campagne_series_profil_mode \(profile_id=\? AND mode=\? AND commencee_le>\?\)/)
  aLaMain(fichier, 'DROP INDEX idx_campagne_series_profil_mode')
  assert.match(planDe(partiesDuJour()), PAR_LE_PROFIL_ET_LA_DATE)
  assert.match(planDe(partiesDuJour().replace('+mode', 'mode')), /idx_campagne_series_sentiers \(profile_id=\? AND mode=\?\)/, 'sans le `+` ni l’index de la date, ces statistiques mènent bien aux sentiers')
})
