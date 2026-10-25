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
import { DIX_HEURES, departEnBase, dossierDEssai, fermerLesMagasins, magasinDEssai } from './cabinet-banc'

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
  const { cabinet } = await magasinDEssai(fichier, horloge)
  // Une page froide, un départ libre, sa première réponse, « Quitter » ; puis une case de la visite et une chasse :
  // chaque lecture et chaque garde que le magasin envoie.
  await cabinet.page('qui')
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

  const db = new Database(fichier, { readonly: true })
  try {
    assert.ok(envoyees.size >= 10, `${envoyees.size} instructions relevées`)
    for (const [sql, args] of envoyees) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${anonyme(sql).sql}`).all(...anonyme(sql, args).args) as Etape[]
      const dit = `${plan.map(e => `${e.id}<${e.parent} ${e.detail}`).join('\n')}\n— ${sql.replace(/\s+/g, ' ')}`
      for (const e of plan) {
        assert.doesNotMatch(e.detail, /^SCAN (campagne_series|campagne_reponses|cabinet_gestes|cabinet_profils|cabinet_oeuvres)\b/, `une table parcourue :\n${dit}`)
        if (/^SEARCH campagne_series\b/.test(e.detail) && !/\((id|rowid)=\?\)$/.test(e.detail)) {
          // Ses parties du jour par le profil et la date ; jamais l'index des sentiers pour le Cabinet, qui les lirait toutes.
          const duJour = /^SEARCH campagne_series USING INDEX idx_campagne_series_profil \(profile_id=\? AND commencee_le>\?\)/.test(e.detail)
          const expedition = /idx_campagne_series_sentiers \(profile_id=\? AND mode=\?\)/.test(e.detail) && /'expedition'/.test(sql)
          assert.ok(duJour || expedition, `ses parties lues autrement que par le profil et la date :\n${dit}`)
        }
      }
    }
  } finally {
    db.close()
  }
})
