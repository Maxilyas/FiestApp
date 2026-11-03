// Le client minimal de la base distante (`QUIZ_DB_CLIENT=minimal`, le
// 3 novembre 2026) : le protocole que parle le client libsql à Turso — Hrana 2
// en JSON, `POST /v2/pipeline` —, sans les objets de la bibliothèque.
//
// Au dixième de cœur de l'hébergeur, un tiers du processeur d'une requête
// partait dans le client de la base (le banc solo du 3 novembre 2026,
// `retours/2026-11-03/reproductions/solo-charge.mjs --couts`) : pour chaque
// aller-retour, libsql ouvre un flux, l'encode par son propre écrivain JSON,
// relit la réponse champ par champ à travers ses validateurs, et bâtit chaque
// ligne à coups de `Object.defineProperty` — une fois par colonne, deux pour
// son rang. Ici : `JSON.stringify`, `JSON.parse`, et des lignes en objets
// simples, leurs colonnes en propriétés.
//
// Ce qui ne change pas, et que `client-minimal.test.ts` compare au client
// libsql sur un faux Turso adossé à SQLite : les mêmes requêtes sur le fil —
// un nombre part en flottant, un booléen en entier —, les mêmes lots en
// transaction (BEGIN, chaque instruction si la précédente a réussi, COMMIT,
// ROLLBACK sinon), les mêmes erreurs (`LibsqlError`, `LibsqlBatchError`, leur
// code et leur message), les mêmes valeurs lues (un entier hors de la plage
// sûre refusé, un blob en `ArrayBuffer`), au plus vingt allers-retours en vol.
// Ce qui change : une ligne n'a plus ses colonnes par leur rang (`row[0]`) ni
// de `length` — le serveur ne les lit jamais par là ; ses colonnes nommées,
// énumérables, sont celles de libsql, la première l'emportant sur un doublon.
// Le reste du `Client` — transaction, synchronisation — n'est pas servi : le
// serveur n'en ouvre aucune (`clientBorne`). Les requêtes passent par le même
// `fetch` (`avecDelai`) : délai, connexions, quota et transport léger compris.
import { LibsqlBatchError, LibsqlError, type Client, type InArgs, type InStatement, type InValue, type IntMode, type ResultSet, type Row, type TransactionMode, type Value } from '@libsql/client'

type ValeurHrana = { type: 'null' } | { type: 'integer'; value: string } | { type: 'float'; value: number } | { type: 'text'; value: string } | { type: 'blob'; base64: string }
interface InstructionHrana {
  sql: string
  args: ValeurHrana[]
  named_args: { name: string; value: ValeurHrana }[]
  want_rows: boolean
}
type ConditionHrana = { type: 'ok'; step: number } | { type: 'not'; cond: ConditionHrana }
interface ResultatHrana {
  cols: { name?: string | null; decltype?: string | null }[]
  rows: ValeurHrana[][]
  affected_row_count: number
  last_insert_rowid?: string | null
}
interface ErreurHrana {
  message: string
  code?: string | null
}
type ReponseHrana =
  | { type: 'ok'; response: { type: 'execute'; result: ResultatHrana } | { type: 'batch'; result: { step_results: (ResultatHrana | null)[]; step_errors: (ErreurHrana | null)[] } } | { type: 'close' } }
  | { type: 'error'; error: ErreurHrana }

/** Au plus, les allers-retours en vol d'un client : ceux de libsql (sa `concurrency`, vingt d'office). */
const EN_VOL_AU_PLUS = 20

const ENTIER_MIN = -9223372036854775808n
const ENTIER_MAX = 9223372036854775807n

/** Une valeur liée, telle que libsql l'envoie (`valueToProto`, puis l'écrivain JSON de Hrana). */
function valeurHrana(v: InValue): ValeurHrana {
  if (v === null) return { type: 'null' }
  switch (typeof v) {
    case 'string':
      return { type: 'text', value: v }
    case 'number':
      if (!Number.isFinite(v)) throw new RangeError('Only finite numbers (not Infinity or NaN) can be passed as arguments')
      return { type: 'float', value: v }
    case 'bigint':
      if (v < ENTIER_MIN || v > ENTIER_MAX) throw new RangeError('This bigint value is too large to be represented as a 64-bit integer and passed as argument')
      return { type: 'integer', value: String(v) }
    case 'boolean':
      return { type: 'integer', value: v ? '1' : '0' }
  }
  if (v instanceof ArrayBuffer) return { type: 'blob', base64: Buffer.from(v).toString('base64') }
  if (v instanceof Uint8Array) return { type: 'blob', base64: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64') }
  if (v instanceof Date) return { type: 'float', value: v.valueOf() }
  if (typeof v === 'object') return { type: 'text', value: `${(v as object).toString()}` }
  throw new TypeError('Unsupported type of value')
}

/** Une instruction, telle que libsql l'envoie (`stmtToHrana`) : ses arguments par leur rang, ou par leur nom. */
function instructionHrana(instruction: InStatement | [string, InArgs?], args: InArgs | undefined, lignes: boolean): InstructionHrana {
  let sql: string
  let lies: InArgs | undefined
  if (typeof instruction === 'string') [sql, lies] = [instruction, args]
  else if (Array.isArray(instruction)) [sql, lies] = instruction
  else [sql, lies] = [instruction.sql, instruction.args]
  const parRang = Array.isArray(lies)
  return {
    sql,
    args: parRang ? (lies as InValue[]).map(valeurHrana) : [],
    named_args: lies && !parRang ? Object.entries(lies).map(([name, value]) => ({ name, value: valeurHrana(value) })) : [],
    want_rows: lignes,
  }
}

/** Une valeur lue, telle que libsql la rend (`valueFromProto`), selon `intMode`. */
function valeurLue(v: ValeurHrana, intMode: IntMode): Value {
  switch (v.type) {
    case 'null':
      return null
    case 'integer':
      if (intMode === 'number') {
        const n = Number(v.value)
        if (!Number.isSafeInteger(n)) throw new RangeError('Received integer which is too large to be safely represented as a JavaScript number')
        return n
      }
      return intMode === 'bigint' ? BigInt(v.value) : v.value
    case 'float':
    case 'text':
      return v.value
    case 'blob': {
      const octets = Buffer.from(v.base64, 'base64')
      return octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer
    }
  }
  throw new LibsqlError('Received unrecognized type of Value', 'HRANA_PROTO_ERROR')
}

/** Ce qu'une instruction a rendu, comme un `ResultSet` de libsql — ses lignes en objets simples. */
function resultatLu(r: ResultatHrana, intMode: IntMode): ResultSet {
  const columns = r.cols.map(c => c.name ?? '')
  const columnTypes = r.cols.map(c => c.decltype ?? '')
  // La première de deux colonnes du même nom l'emporte, comme chez libsql — et `__proto__` se pose en propriété.
  const simples = new Set(columns).size === columns.length && !columns.includes('__proto__')
  const rows = r.rows.map(valeurs => {
    const ligne: Record<string, Value> = {}
    for (let i = 0; i < valeurs.length; i++) {
      const colonne = columns[i]
      if (simples) ligne[colonne] = valeurLue(valeurs[i], intMode)
      else if (!Object.hasOwn(ligne, colonne)) Object.defineProperty(ligne, colonne, { value: valeurLue(valeurs[i], intMode), enumerable: true, configurable: true, writable: true })
    }
    return ligne as unknown as Row
  })
  const lastInsertRowid = r.last_insert_rowid == null ? undefined : BigInt(r.last_insert_rowid)
  return {
    columns,
    columnTypes,
    rows,
    rowsAffected: r.affected_row_count,
    lastInsertRowid,
    toJSON: () => ({ columns, columnTypes, rows: rows.map(l => Object.values(l)), rowsAffected: r.affected_row_count, lastInsertRowid: lastInsertRowid === undefined ? null : String(lastInsertRowid) }),
  }
}

/** Une erreur rendue par Turso, comme libsql la lève (`mapHranaError`) : son code devant son message. */
const erreurDe = (e: ErreurHrana): LibsqlError => new LibsqlError(e.message, e.code ?? 'UNKNOWN')

/** Le début d'un lot : la transaction de son mode (`transactionModeToBegin`). */
function debutDuLot(mode: TransactionMode): string {
  if (mode === 'write') return 'BEGIN IMMEDIATE'
  if (mode === 'read') return 'BEGIN TRANSACTION READONLY'
  if (mode === 'deferred') return 'BEGIN DEFERRED'
  throw RangeError('Unknown transaction mode, supported values are "write", "read" and "deferred"')
}

const nue = (sql: string): InstructionHrana => ({ sql, args: [], named_args: [], want_rows: false })

/** L'adresse du pipeline d'une base : `libsql://` se parle en HTTPS, `?tls=0` en HTTP. */
function adresseDuPipeline(url: string): string {
  const u = new URL(url.replace(/^libsql:/, 'https:'))
  if (u.searchParams.get('tls') === '0') u.protocol = 'http:'
  u.search = ''
  u.hash = ''
  if (!u.pathname.endsWith('/')) u.pathname += '/'
  return new URL('v2/pipeline', u).toString()
}

export function clientMinimal(url: string, authToken: string | undefined, reglages: { intMode?: IntMode; fetch: (requete: Request) => Promise<Response> }): Client {
  const intMode = reglages.intMode ?? 'number'
  const pipeline = adresseDuPipeline(url)
  const envoyer = reglages.fetch
  let ferme = false
  let enVol = 0
  const enAttente: (() => void)[] = []

  /** Une place parmi les vingt en vol, rendue à la fin, quoi qu'il arrive. */
  async function aSonTour<T>(travail: () => Promise<T>): Promise<T> {
    if (enVol >= EN_VOL_AU_PLUS) await new Promise<void>(r => enAttente.push(r))
    enVol++
    try {
      return await travail()
    } finally {
      enVol--
      enAttente.shift()?.()
    }
  }

  /** Un aller-retour : les requêtes, puis la fermeture du flux, d'une seule requête HTTP. */
  async function allerRetour(requetes: unknown[]): Promise<ReponseHrana[]> {
    if (ferme) throw new LibsqlError('The client is closed', 'CLIENT_CLOSED')
    const entetes: Record<string, string> = { 'content-type': 'application/json' }
    if (authToken !== undefined) entetes.authorization = `Bearer ${authToken}`
    // Un flux neuf à chaque aller-retour, sans `baton`, comme libsql : il s'ouvre et se referme dans la même requête.
    const reponse = await envoyer(new Request(pipeline, { method: 'POST', headers: entetes, body: JSON.stringify({ requests: [...requetes, { type: 'close' }] }) }))
    if (!reponse.ok) {
      // Comme libsql (`errorFromResponse`) : un message de la base, ou le statut et le texte rendu.
      const sorte = reponse.headers.get('content-type') ?? 'text/plain'
      if (sorte === 'application/json') {
        const corps = (await reponse.json()) as Partial<ErreurHrana>
        if (typeof corps?.message === 'string') throw erreurDe(corps as ErreurHrana)
        throw new LibsqlError(`Server returned HTTP status ${reponse.status}`, 'SERVER_ERROR')
      }
      const texte = sorte === 'text/plain' ? (await reponse.text()).trim() : (await reponse.body?.cancel(), '')
      throw new LibsqlError(`Server returned HTTP status ${reponse.status}${texte ? `: ${texte}` : ''}`, 'SERVER_ERROR')
    }
    const corps = (await reponse.json()) as { results?: ReponseHrana[] }
    if (!Array.isArray(corps?.results) || corps.results.length !== requetes.length + 1) throw new LibsqlError('Server returned unexpected number of pipeline results', 'HRANA_PROTO_ERROR')
    return corps.results
  }

  const execute = ((instruction: InStatement | string, args?: InArgs) =>
    aSonTour(async () => {
      const [r] = await allerRetour([{ type: 'execute', stmt: instructionHrana(instruction, args, true) }])
      if (r.type === 'error') throw erreurDe(r.error)
      if (r.response.type !== 'execute') throw new LibsqlError('Received unexpected type of response', 'HRANA_PROTO_ERROR')
      return resultatLu(r.response.result, intMode)
    })) as Client['execute']

  /**
   * Un lot en transaction, comme `executeHranaBatch` : BEGIN, chaque instruction
   * si la précédente a réussi, COMMIT si la dernière a réussi, ROLLBACK si le
   * COMMIT n'a pas eu lieu. La première qui échoue le dit, à son rang.
   */
  const batch = (instructions: Array<InStatement | [string, InArgs?]>, mode: TransactionMode = 'deferred') =>
    aSonTour(async () => {
      const etapes: { condition?: ConditionHrana; stmt: InstructionHrana }[] = [{ stmt: nue(debutDuLot(mode)) }]
      for (const instruction of instructions) etapes.push({ condition: { type: 'ok', step: etapes.length - 1 }, stmt: instructionHrana(instruction, undefined, true) })
      const commit = etapes.length
      etapes.push({ condition: { type: 'ok', step: commit - 1 }, stmt: nue('COMMIT') })
      etapes.push({ condition: { type: 'not', cond: { type: 'ok', step: commit } }, stmt: nue('ROLLBACK') })
      const [r] = await allerRetour([{ type: 'batch', batch: { steps: etapes } }])
      if (r.type === 'error') throw erreurDe(r.error)
      if (r.response.type !== 'batch') throw new LibsqlError('Received unexpected type of response', 'HRANA_PROTO_ERROR')
      const { step_results: resultats, step_errors: erreurs } = r.response.result
      if (erreurs[0]) throw erreurDe(erreurs[0])
      const lus: ResultSet[] = []
      for (let i = 0; i < instructions.length; i++) {
        const erreur = erreurs[i + 1]
        if (erreur) throw new LibsqlBatchError(erreurDe(erreur).message, i, erreur.code ?? 'UNKNOWN')
        const resultat = resultats[i + 1]
        if (!resultat) throw new LibsqlBatchError('Statement in a batch was not executed, probably because the transaction has been rolled back', i, 'TRANSACTION_CLOSED')
        lus.push(resultatLu(resultat, intMode))
      }
      if (erreurs[commit]) throw erreurDe(erreurs[commit]!)
      return lus
    })

  const pasServi = (quoi: string) => () => {
    throw new LibsqlError(`${quoi} n’est pas servi par le client minimal (QUIZ_DB_CLIENT=minimal)`, 'NOT_IMPLEMENTED')
  }

  return {
    execute,
    batch,
    // Chez libsql, une migration coupe les clés étrangères le temps du lot : rien ne s'en sert ici, elle se refuse.
    migrate: pasServi('migrate') as Client['migrate'],
    executeMultiple: pasServi('executeMultiple') as Client['executeMultiple'],
    transaction: pasServi('transaction') as Client['transaction'],
    sync: pasServi('sync') as Client['sync'],
    reconnect: () => {},
    close: () => {
      ferme = true
    },
    get closed() {
      return ferme
    },
    protocol: 'http',
  } as unknown as Client
}
