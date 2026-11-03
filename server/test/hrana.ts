// Un faux Turso dans le processus du test : le protocole Hrana 2 en JSON
// (`POST /v2/pipeline`) adossé à un fichier SQLite — l'exécution, les lots et
// leurs conditions, le SQL rangé d'avance (`store_sql`, que libsql envoie pour
// un lot). Le même que celui du banc (`retours/2026-10-14/reproductions/faux-turso.ts`),
// sans ses relevés : de quoi faire parler à la même base le client libsql et le
// client minimal (`client-minimal.test.ts`), et comparer ce qu'ils en lisent.
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import Database from 'better-sqlite3'

type Valeur = { type: 'null' } | { type: 'integer'; value: string } | { type: 'float'; value: number } | { type: 'text'; value: string } | { type: 'blob'; base64: string }
interface Stmt {
  sql?: string
  sql_id?: number
  args?: Valeur[]
  named_args?: { name: string; value: Valeur }[]
}
type Cond = { type: 'ok' | 'error'; step: number } | { type: 'not'; cond: Cond } | { type: 'and' | 'or'; conds: Cond[] } | { type: 'is_autocommit' }

function lireValeur(v: Valeur): unknown {
  switch (v.type) {
    case 'null':
      return null
    case 'integer':
      return BigInt(v.value)
    case 'float':
      return Number(v.value)
    case 'text':
      return v.value
    case 'blob':
      return Buffer.from(v.base64, 'base64')
  }
}

function ecrireValeur(v: unknown): Valeur {
  if (v === null || v === undefined) return { type: 'null' }
  if (typeof v === 'bigint') return { type: 'integer', value: String(v) }
  if (typeof v === 'number') return { type: 'float', value: v }
  if (typeof v === 'string') return { type: 'text', value: v }
  if (Buffer.isBuffer(v)) return { type: 'blob', base64: v.toString('base64') }
  return { type: 'text', value: String(v) }
}

export interface FauxTurso {
  adresse: string
  /** Les requêtes reçues, chacune son corps tel quel. */
  corps: unknown[]
  /** Le plus d'allers-retours en vol en même temps. */
  enVolAuPlus(): number
  /** Chaque réponse attend autant avant de partir. */
  retarder(ms: number): void
  fermer(): Promise<void>
}

export async function fauxTursoHrana(fichier: string): Promise<FauxTurso> {
  const db = new Database(fichier)
  const corps: unknown[] = []
  let enVol = 0
  let auPlus = 0
  let retardMs = 0

  const executer = (stmt: Stmt, sqls: Map<number, string>) => {
    const sql = stmt.sql ?? sqls.get(stmt.sql_id!)
    if (sql === undefined) throw Object.assign(new Error('sql_id inconnu'), { code: 'SQL_NOT_FOUND' })
    let args: unknown[] | Record<string, unknown> = (stmt.args ?? []).map(lireValeur)
    if (stmt.named_args && stmt.named_args.length > 0) {
      const nommes: Record<string, unknown> = {}
      for (const a of stmt.named_args) nommes[a.name.replace(/^[:@$]/, '')] = lireValeur(a.value)
      args = nommes
    }
    const s = db.prepare(sql)
    if (s.reader) {
      const cols = s.columns().map(c => ({ name: c.name, decltype: c.type }))
      const lignes = (Array.isArray(args) ? s.raw(true).safeIntegers(true).all(...args) : s.raw(true).safeIntegers(true).all(args)) as unknown[][]
      return { cols, rows: lignes.map(l => l.map(ecrireValeur)), affected_row_count: 0, last_insert_rowid: null, rows_read: lignes.length, rows_written: 0 }
    }
    const r = Array.isArray(args) ? s.run(...args) : s.run(args)
    return { cols: [], rows: [], affected_row_count: r.changes, last_insert_rowid: String(r.lastInsertRowid), rows_read: 0, rows_written: r.changes }
  }
  const erreur = (e: unknown) => ({ message: (e as Error).message ?? String(e), code: (e as { code?: string }).code ?? 'UNKNOWN' })
  const evaluer = (c: Cond, issues: ('ok' | 'error' | undefined)[]): boolean => {
    switch (c.type) {
      case 'ok':
        return issues[c.step] === 'ok'
      case 'error':
        return issues[c.step] === 'error'
      case 'not':
        return !evaluer(c.cond, issues)
      case 'and':
        return c.conds.every(x => evaluer(x, issues))
      case 'or':
        return c.conds.some(x => evaluer(x, issues))
      case 'is_autocommit':
        return !db.inTransaction
    }
  }
  const pipeline = (requetes: { type: string; [cle: string]: any }[]) => {
    const sqls = new Map<number, string>()
    const results = requetes.map(req => {
      try {
        switch (req.type) {
          case 'execute':
            return { type: 'ok', response: { type: 'execute', result: executer(req.stmt, sqls) } }
          case 'batch': {
            const issues: ('ok' | 'error' | undefined)[] = []
            const step_results: unknown[] = []
            const step_errors: unknown[] = []
            ;(req.batch.steps as { condition?: Cond; stmt: Stmt }[]).forEach((etape, i) => {
              if (etape.condition && !evaluer(etape.condition, issues)) {
                step_results.push(null)
                step_errors.push(null)
                return
              }
              try {
                step_results.push(executer(etape.stmt, sqls))
                step_errors.push(null)
                issues[i] = 'ok'
              } catch (e) {
                step_results.push(null)
                step_errors.push(erreur(e))
                issues[i] = 'error'
              }
            })
            return { type: 'ok', response: { type: 'batch', result: { step_results, step_errors } } }
          }
          case 'store_sql':
            sqls.set(req.sql_id, req.sql)
            return { type: 'ok', response: { type: 'store_sql' } }
          case 'close_sql':
            sqls.delete(req.sql_id)
            return { type: 'ok', response: { type: 'close_sql' } }
          case 'close':
            return { type: 'ok', response: { type: 'close' } }
          default:
            return { type: 'error', error: { message: `requête inconnue ${req.type}`, code: 'UNKNOWN' } }
        }
      } catch (e) {
        return { type: 'error', error: erreur(e) }
      }
    })
    // Une transaction laissée ouverte se referme avec le flux, comme chez Turso.
    if (db.inTransaction) db.exec('ROLLBACK')
    return { baton: null, base_url: null, results }
  }

  const serveur = createServer((req, res) => {
    let texte = ''
    req.on('data', (m: Buffer) => (texte += m))
    req.on('end', async () => {
      enVol++
      auPlus = Math.max(auPlus, enVol)
      try {
        if (retardMs > 0) await new Promise(r => setTimeout(r, retardMs))
        if (req.url !== '/v2/pipeline') {
          res.statusCode = 404
          res.setHeader('content-type', 'text/plain')
          return res.end('introuvable')
        }
        const lu = JSON.parse(texte)
        corps.push(lu)
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(pipeline(lu.requests)))
      } finally {
        enVol--
      }
    })
  })
  await new Promise<void>(r => serveur.listen(0, '127.0.0.1', r))
  return {
    adresse: `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`,
    corps,
    enVolAuPlus: () => auPlus,
    retarder: ms => {
      retardMs = ms
    },
    fermer: () =>
      new Promise<void>(r => {
        serveur.closeAllConnections()
        serveur.close(() => {
          db.close()
          r()
        })
      }),
  }
}
