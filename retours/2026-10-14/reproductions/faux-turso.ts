// Un faux Turso : le protocole Hrana v2 sur HTTP (`POST /v2/pipeline`) — celui
// que le client libsql parle à une adresse `http://` ou `libsql://` —, adossé
// à un fichier SQLite, avec une latence réglable par aller-retour.
//
// Pourquoi pas le fichier `file:` des tests : il ne passe pas par `fetch`. Ici,
// chaque requête du serveur emprunte le vrai chemin de la production — le
// client HTTP de libsql, sa limite de vingt requêtes en vol, son décodage JSON,
// et `avecDelai` (`core/distante.ts`), qui nourrit `pouls.base` et le relevé.
// Il compte chaque aller-retour, chaque instruction, le temps passé dans
// SQLite, les octets rendus, et passe chaque requête distincte à
// EXPLAIN QUERY PLAN avec ses vrais arguments : un plan sans statistiques
// (`ANALYZE`) ne dépend pas du volume, il est celui de Turso.
//
//   node --import tsx faux-turso.ts <fichier.db> <port>
//
// Contrôle : POST /__etiquette {etiquette}, POST /__latence {ms}, GET /__releve,
// POST /__remise (remet les compteurs à zéro), POST /__connexions
// {refermeApresMs, poigneeMs} — le délai d'inactivité de Turso (5 s, lu en
// production le 14 octobre 2026, sans en-tête `Keep-Alive`) et ce que coûte
// une connexion neuve (TCP, TLS, le chiffrement au dixième de cœur : 225 ms
// l'aller-retour contre 29), ajouté à sa première réponse ; zéro, comme avant.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../server/package.json'))
const Database = require('better-sqlite3')

type Valeur = { type: 'null' } | { type: 'integer'; value: string } | { type: 'float'; value: number } | { type: 'text'; value: string } | { type: 'blob'; base64: string }
interface Stmt { sql?: string; sql_id?: number; args?: Valeur[]; named_args?: { name: string; value: Valeur }[]; want_rows?: boolean }
type Cond = { type: 'ok' | 'error'; step: number } | { type: 'not'; cond: Cond } | { type: 'and' | 'or'; conds: Cond[] } | { type: 'is_autocommit' }

const fichier = process.argv[2]
const port = Number(process.argv[3] ?? 0)
const db = new Database(fichier)
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 5000')

let latenceMs = 0
let etiquette = '(démarrage)'
/** Le délai d'inactivité, comme Turso : la connexion se referme, sans rien annoncer. Zéro : jamais. */
let refermeApresMs = 0
/** Le prix d'une connexion neuve, ajouté à sa première réponse. */
let poigneeMs = 0
let connexions = 0
const neuves = new WeakSet<object>()
const minuteries = new WeakMap<object, ReturnType<typeof setTimeout>>()

interface Aller { etiquette: string; t: number; ms: number; sqliteMs: number; instructions: number; sqls: string[]; octets: number }
let allers: Aller[] = []
interface Plan { sql: string; plan: string[]; scans: string[]; n: number; ms: number; lignes: number; etiquettes: Set<string> }
const plans = new Map<string, Plan>()

const prepares = new Map<string, any>()
function preparer(sql: string) {
  let s = prepares.get(sql)
  if (!s) {
    s = db.prepare(sql)
    prepares.set(sql, s)
  }
  return s
}

function lireValeur(v: Valeur): unknown {
  switch (v.type) {
    case 'null': return null
    case 'integer': return BigInt(v.value)
    case 'float': return Number(v.value)
    case 'text': return v.value
    case 'blob': return Buffer.from(v.base64, 'base64')
  }
}

function ecrireValeur(v: unknown): Valeur {
  if (v === null || v === undefined) return { type: 'null' }
  if (typeof v === 'bigint') return { type: 'integer', value: String(v) }
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v }
  if (typeof v === 'string') return { type: 'text', value: v }
  if (Buffer.isBuffer(v)) return { type: 'blob', base64: v.toString('base64') }
  return { type: 'text', value: String(v) }
}

const DML = /^\s*(select|with|update|delete|insert|replace)\b/i

function expliquer(sql: string, args: unknown[] | Record<string, unknown>) {
  let p = plans.get(sql)
  if (!p) {
    let plan: string[] = []
    if (DML.test(sql) && !/^\s*insert\s+into\s+\S+\s*(\([^)]*\))?\s*values/i.test(sql)) {
      try {
        const e = db.prepare(`EXPLAIN QUERY PLAN ${sql}`)
        const lignes = Array.isArray(args) ? e.all(...args) : e.all(args)
        plan = lignes.map((l: { detail: string }) => l.detail)
      } catch (err) {
        plan = [`(explain impossible : ${(err as Error).message})`]
      }
    }
    const scans = plan.filter(d => /^SCAN /.test(d) && !/^SCAN CONSTANT ROW/.test(d))
    p = { sql, plan, scans, n: 0, ms: 0, lignes: 0, etiquettes: new Set() }
    plans.set(sql, p)
  }
  return p
}

function executer(stmt: Stmt, sqls: Map<number, string>): { cols: { name: string; decltype: string | null }[]; rows: Valeur[][]; affected_row_count: number; last_insert_rowid: string | null; _sql: string; _ms: number } {
  const sql = stmt.sql ?? sqls.get(stmt.sql_id!)
  if (sql === undefined) throw Object.assign(new Error('sql_id inconnu'), { code: 'SQL_NOT_FOUND' })
  let args: unknown[] | Record<string, unknown> = (stmt.args ?? []).map(lireValeur)
  if (stmt.named_args && stmt.named_args.length > 0) {
    const nommes: Record<string, unknown> = {}
    for (const a of stmt.named_args) nommes[a.name.replace(/^[:@$]/, '')] = lireValeur(a.value)
    args = nommes
  }
  const debut = performance.now()
  const s = preparer(sql)
  let resultat
  if (s.reader) {
    const cols = s.columns().map((c: { name: string; type: string | null }) => ({ name: c.name, decltype: c.type }))
    const lignes = (Array.isArray(args) ? s.raw(true).safeIntegers(true).all(...args) : s.raw(true).safeIntegers(true).all(args)) as unknown[][]
    resultat = { cols, rows: lignes.map(l => l.map(ecrireValeur)), affected_row_count: 0, last_insert_rowid: null as string | null }
  } else {
    const r = Array.isArray(args) ? s.run(...args) : s.run(args)
    resultat = { cols: [], rows: [], affected_row_count: r.changes, last_insert_rowid: String(r.lastInsertRowid) }
  }
  const ms = performance.now() - debut
  const p = expliquer(sql, args)
  p.n++
  p.ms += ms
  p.lignes += resultat.rows.length
  p.etiquettes.add(etiquette)
  return { ...resultat, _sql: sql, _ms: ms }
}

function erreur(e: unknown) {
  const err = e as { message?: string; code?: string }
  return { message: err.message ?? String(e), code: err.code ?? 'UNKNOWN' }
}

function evaluer(c: Cond, issues: ('ok' | 'error' | undefined)[]): boolean {
  switch (c.type) {
    case 'ok': return issues[c.step] === 'ok'
    case 'error': return issues[c.step] === 'error'
    case 'not': return !evaluer(c.cond, issues)
    case 'and': return c.conds.every(x => evaluer(x, issues))
    case 'or': return c.conds.some(x => evaluer(x, issues))
    case 'is_autocommit': return !db.inTransaction
  }
}

function pipeline(corps: { baton?: string; requests: any[] }) {
  const sqls = new Map<number, string>()
  let instructions = 0
  let sqliteMs = 0
  const vus: string[] = []
  const nettoyer = (r: ReturnType<typeof executer>) => {
    instructions++
    sqliteMs += r._ms
    vus.push(r._sql)
    const { _sql, _ms, ...reste } = r
    return reste
  }
  const results = corps.requests.map(req => {
    try {
      switch (req.type) {
        case 'execute':
          return { type: 'ok', response: { type: 'execute', result: nettoyer(executer(req.stmt, sqls)) } }
        case 'batch': {
          const steps = req.batch.steps as { condition?: Cond; stmt: Stmt }[]
          const issues: ('ok' | 'error' | undefined)[] = []
          const step_results: unknown[] = []
          const step_errors: unknown[] = []
          steps.forEach((st, i) => {
            if (st.condition && !evaluer(st.condition, issues)) {
              step_results.push(null)
              step_errors.push(null)
              return
            }
            try {
              step_results.push(nettoyer(executer(st.stmt, sqls)))
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
        case 'sequence':
          db.exec(req.sql)
          instructions++
          return { type: 'ok', response: { type: 'sequence' } }
        case 'get_autocommit':
          return { type: 'ok', response: { type: 'get_autocommit', is_autocommit: !db.inTransaction } }
        case 'close':
          return { type: 'ok', response: { type: 'close' } }
        default:
          return { type: 'error', error: { message: `requête inconnue ${req.type}`, code: 'UNKNOWN' } }
      }
    } catch (e) {
      return { type: 'error', error: erreur(e) }
    }
  })
  // Une transaction laissée ouverte par une requête sans COMMIT : on la referme,
  // comme le ferait la fin du flux chez Turso.
  if (db.inTransaction && corps.requests.some(r => r.type === 'close')) db.exec('ROLLBACK')
  return { reponse: { baton: null, base_url: null, results }, instructions, sqliteMs, vus }
}

function lireCorps(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const morceaux: Buffer[] = []
    req.on('data', c => morceaux.push(c))
    req.on('end', () => resolve(Buffer.concat(morceaux).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, statut: number, corps: unknown) {
  const texte = JSON.stringify(corps)
  res.writeHead(statut, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(texte) })
  res.end(texte)
}

const serveur = createServer(async (req, res) => {
  const t = Date.now()
  const debut = performance.now()
  const url = req.url ?? '/'
  if (req.method === 'POST' && url === '/__etiquette') {
    etiquette = JSON.parse(await lireCorps(req)).etiquette
    return json(res, 200, { ok: true })
  }
  if (req.method === 'POST' && url === '/__latence') {
    latenceMs = Number(JSON.parse(await lireCorps(req)).ms)
    return json(res, 200, { ok: true })
  }
  if (req.method === 'POST' && url === '/__remise') {
    allers = []
    connexions = 0
    for (const p of plans.values()) { p.n = 0; p.ms = 0; p.lignes = 0; p.etiquettes.clear() }
    return json(res, 200, { ok: true })
  }
  if (req.method === 'POST' && url === '/__connexions') {
    const r = JSON.parse(await lireCorps(req))
    refermeApresMs = Number(r.refermeApresMs ?? 0)
    poigneeMs = Number(r.poigneeMs ?? 0)
    // Turso ne dit pas son délai : sans délai à lui, Node n'envoie pas d'en-tête `Keep-Alive`.
    if (refermeApresMs > 0) serveur.keepAliveTimeout = 0
    return json(res, 200, { ok: true })
  }
  if (req.method === 'GET' && url === '/__releve') {
    return json(res, 200, {
      allers,
      connexions,
      plans: [...plans.values()].map(p => ({ ...p, etiquettes: [...p.etiquettes] })),
    })
  }
  if (req.method === 'POST' && (url === '/v2/pipeline' || url.endsWith('/v2/pipeline'))) {
    const socket = req.socket
    clearTimeout(minuteries.get(socket))
    const texte = await lireCorps(req)
    const { reponse, instructions, sqliteMs, vus } = pipeline(JSON.parse(texte))
    const corps = JSON.stringify(reponse)
    const envoyer = () => {
      allers.push({ etiquette, t, ms: performance.now() - debut, sqliteMs, instructions, sqls: vus, octets: Buffer.byteLength(corps) })
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(corps) })
      res.end(corps)
      // Inactive aussi longtemps, Turso la referme de lui-même.
      if (refermeApresMs > 0) res.once('finish', () => minuteries.set(socket, setTimeout(() => socket.end(), refermeApresMs)))
    }
    // La première réponse d'une connexion neuve paie la poignée de main.
    const attente = latenceMs + (neuves.has(socket) ? poigneeMs : 0)
    neuves.delete(socket)
    if (attente > 0) setTimeout(envoyer, attente)
    else envoyer()
    return
  }
  json(res, 404, { message: 'introuvable' })
})

serveur.on('connection', socket => {
  connexions++
  neuves.add(socket)
})

serveur.listen(port, '127.0.0.1', () => {
  const adresse = serveur.address()
  const p = typeof adresse === 'object' && adresse ? adresse.port : port
  // La première ligne dit le port : le banc la lit.
  process.stdout.write(`PORT ${p}\n`)
})
