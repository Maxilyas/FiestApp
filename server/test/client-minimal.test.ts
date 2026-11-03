// Le client minimal de la base (`core/clientMinimal.ts`, `QUIZ_DB_CLIENT=minimal`)
// répond comme celui de libsql : chaque épreuve joue la même suite
// d'instructions par les deux clients, chacun sur son faux Turso adossé à
// SQLite (`hrana.ts`), et compare ce qu'ils rendent — lignes, colonnes, lignes
// touchées, dernier identifiant — et ce qu'ils lèvent — la même classe, le
// même code, le même message, le même rang dans un lot —, puis ce qui part sur
// le fil, lot compris. Seule différence voulue : une ligne n'a plus ses
// colonnes par leur rang ni de `length` ; ses colonnes nommées sont les mêmes.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createClient, type Client, type ResultSet } from '@libsql/client'
import { clientMinimal } from '../src/core/clientMinimal'
import { choisirLeClient, choisirLeTransport, clientDemande, clientDistant, transportDeLaBase } from '../src/core/distante'
import { fauxTursoHrana, type FauxTurso } from './hrana'

const dossier = mkdtempSync(path.join(tmpdir(), 'client-minimal-'))
let deLibsql: { turso: FauxTurso; client: Client }
let minimal: { turso: FauxTurso; client: Client }

before(async () => {
  const [a, b] = await Promise.all([fauxTursoHrana(path.join(dossier, 'libsql.db')), fauxTursoHrana(path.join(dossier, 'minimal.db'))])
  deLibsql = { turso: a, client: createClient({ url: a.adresse }) }
  minimal = { turso: b, client: clientMinimal(b.adresse, undefined, { envoyer: e => fetch(e.url, { method: e.method, headers: e.headers, body: e.corps }) }) }
  const schema = [
    'CREATE TABLE t (id INTEGER PRIMARY KEY, nom TEXT NOT NULL UNIQUE, n REAL, b BLOB, x)',
    "INSERT INTO t (id, nom, n) VALUES (1, 'un', 1.5)",
  ]
  for (const c of [deLibsql.client, minimal.client]) for (const sql of schema) await c.execute(sql)
})

after(async () => {
  deLibsql.client.close()
  minimal.client.close()
  await Promise.all([deLibsql.turso.fermer(), minimal.turso.fermer()])
  rmSync(dossier, { recursive: true, force: true })
})

const lu = (r: ResultSet) => ({ columns: r.columns, columnTypes: r.columnTypes, rows: r.rows.map(l => ({ ...l })), rowsAffected: r.rowsAffected, lastInsertRowid: r.lastInsertRowid })

/** Ce que rend une suite d'appels, ou ce qu'elle lève : de quoi comparer les deux clients. */
async function issue(travail: (c: Client) => Promise<ResultSet | ResultSet[]>, c: Client) {
  try {
    const r = await travail(c)
    return { rendu: Array.isArray(r) ? r.map(lu) : lu(r) }
  } catch (e) {
    const err = e as Error & { code?: string; statementIndex?: number }
    return { leve: { classe: err.constructor.name, nom: err.name, code: err.code, message: err.message, rang: err.statementIndex } }
  }
}

async function memeIssue(quoi: string, travail: (c: Client) => Promise<ResultSet | ResultSet[]>) {
  const [attendu, obtenu] = [await issue(travail, deLibsql.client), await issue(travail, minimal.client)]
  assert.deepStrictEqual(obtenu, attendu, quoi)
  return obtenu
}

test('une instruction : chaque sorte de valeur liée, et ce qui se relit — un nombre en flottant, un booléen en entier, un blob, une date', async () => {
  await memeIssue('insertion', c =>
    c.execute({ sql: 'INSERT INTO t (id, nom, n, b, x) VALUES (?, ?, ?, ?, ?)', args: [2, 'deux', 2.25, new Uint8Array([1, 2, 255]), true] }),
  )
  await memeIssue('par sa chaîne et ses arguments', c => c.execute('INSERT INTO t (nom, n, x) VALUES (?, ?, ?)', ['trois', 3, 12345678901234n]))
  await memeIssue('une date, un objet', c => c.execute({ sql: 'INSERT INTO t (nom, n, x) VALUES (?, ?, ?)', args: ['quatre', new Date(1_700_000_000_000), null] }))
  const tout = await memeIssue('tout relire', c => c.execute('SELECT * FROM t ORDER BY id'))
  assert.equal((tout.rendu as ReturnType<typeof lu>).rows.length, 4)
  await memeIssue('ses arguments nommés', c => c.execute({ sql: 'SELECT id, nom FROM t WHERE nom = :nom', args: { ':nom': 'deux' } }))
  await memeIssue('deux colonnes du même nom : la première', c => c.execute('SELECT 1 AS a, 2 AS a, typeof(3.0) AS b'))
  await memeIssue('un entier trop grand pour un nombre', c => c.execute('SELECT 9223372036854775807 AS grand'))
  await memeIssue('une valeur liée impossible', c => c.execute({ sql: 'SELECT ?', args: [Number.NaN] }))
})

test('une instruction refusée par la base : la même erreur, son code devant son message', async () => {
  await memeIssue('une table absente', c => c.execute('SELECT * FROM absente'))
  await memeIssue('une contrainte', c => c.execute({ sql: 'INSERT INTO t (nom) VALUES (?)', args: ['un'] }))
  await memeIssue('du SQL illisible', c => c.execute('SELEC 1'))
})

test('un lot : ses résultats dans l’ordre ; une instruction qui échoue défait tout, et se dit à son rang', async () => {
  await memeIssue('un lot qui écrit', c =>
    c.batch(
      [
        { sql: 'INSERT INTO t (nom, n) VALUES (?, ?)', args: ['cinq', 5] },
        { sql: 'UPDATE t SET n = n + 1 WHERE nom = ?', args: ['cinq'] },
        'SELECT nom, n FROM t WHERE nom = \'cinq\'',
      ],
      'write',
    ),
  )
  const rate = await memeIssue('un lot qui échoue à sa deuxième', c =>
    c.batch(
      [
        { sql: 'INSERT INTO t (nom) VALUES (?)', args: ['six'] },
        { sql: 'INSERT INTO t (nom) VALUES (?)', args: ['un'] },
        'SELECT 1',
      ],
      'write',
    ),
  )
  assert.equal((rate as { leve: { rang: number } }).leve.rang, 1)
  await memeIssue('rien de la première ne reste', c => c.execute("SELECT COUNT(*) AS n FROM t WHERE nom = 'six'"))
  await memeIssue('un lot qui lit', c => c.batch(['SELECT COUNT(*) AS n FROM t', 'SELECT MAX(id) AS m FROM t'], 'read'))
  await memeIssue('un lot vide', c => c.batch([], 'write'))
  await memeIssue('la même instruction deux fois', c => c.batch([{ sql: 'SELECT ? AS v', args: [1] }, { sql: 'SELECT ? AS v', args: [2] }], 'deferred'))
})

test('sur le fil : les mêmes instructions et les mêmes valeurs — un lot en transaction, sans SQL rangé d’avance', async () => {
  const avant = [deLibsql.turso.corps.length, minimal.turso.corps.length]
  for (const c of [deLibsql.client, minimal.client]) {
    await c.execute({ sql: 'SELECT ?, ?, ?, ?', args: [1, 'a', true, null] })
    await c.batch([{ sql: 'SELECT ? AS v', args: [7] }], 'write')
  }
  type Corps = { requests: { type: string; stmt?: { sql?: string; args: unknown[] }; batch?: { steps: { condition?: unknown; stmt: { sql?: string; sql_id?: number; args: unknown[] } }[] } }[] }
  const [de, mi] = [deLibsql.turso.corps.slice(avant[0]) as Corps[], minimal.turso.corps.slice(avant[1]) as Corps[]]
  // L'instruction seule : identique, la fermeture du flux comprise.
  assert.deepStrictEqual(mi[0], de[0])
  // Le lot : les mêmes étapes, les mêmes conditions, le même SQL — libsql le range d'avance, le client minimal l'écrit à sa place.
  const sqlDe = new Map(de[1].requests.filter(r => r.type === 'store_sql').map(r => [(r as any).sql_id, (r as any).sql]))
  const etapes = (c: Corps) => c.requests.find(r => r.type === 'batch')!.batch!.steps.map(e => ({ ...e, stmt: { ...e.stmt, sql: e.stmt.sql ?? sqlDe.get(e.stmt.sql_id), sql_id: undefined } }))
  assert.deepStrictEqual(etapes(mi[1]), etapes(de[1]))
  assert.deepStrictEqual(
    etapes(mi[1]).map(e => e.stmt.sql),
    ['BEGIN IMMEDIATE', 'SELECT ? AS v', 'COMMIT', 'ROLLBACK'],
  )
  assert.equal(mi[1].requests.at(-1)!.type, 'close')
})

test('au plus vingt allers-retours en vol, comme libsql', async () => {
  // Les réponses retenues jusqu'à ce que vingt soient en vol : rendues après un délai fixe, sur une machine chargée,
  // les premières revenaient avant que les dernières soient parties, et le compte s'arrêtait en deçà.
  const relacher = minimal.turso.retenir()
  const appels = Promise.all(Array.from({ length: 45 }, (_, i) => minimal.client.execute({ sql: 'SELECT ? AS i', args: [i] })))
  try {
    const limite = Date.now() + 10_000
    while (minimal.turso.enVol() < 20 && Date.now() < limite) await new Promise(r => setTimeout(r, 10))
  } finally {
    relacher()
  }
  await appels
  // Sans la limite, les quarante-cinq auraient été en vol ensemble, retenues.
  assert.equal(minimal.turso.enVolAuPlus(), 20)
})

test('par le chemin de la production — le transport léger —, sa requête part déjà prête : ni `Request`, ni flux à relire', async () => {
  // Le profil du banc solo du 3 novembre 2026 : le `Request` qu'il fabriquait
  // encore, et le flux de son corps qu'`avecDelai` relisait, prenaient 7 % du
  // processeur du serveur. Le `Request` d'undici se compte à sa construction.
  const descripteur = Object.getOwnPropertyDescriptor(globalThis, 'Request')!
  const Origine = globalThis.Request
  let fabriques = 0
  Object.defineProperty(globalThis, 'Request', {
    configurable: true,
    writable: true,
    value: class extends Origine {
      constructor(...args: ConstructorParameters<typeof Request>) {
        super(...args)
        fabriques++
      }
    },
  })
  const transport = transportDeLaBase()
  choisirLeClient('minimal')
  choisirLeTransport('leger')
  const avant = minimal.turso.corps.length
  const borne = clientDistant(minimal.turso.adresse)
  choisirLeClient('libsql')
  choisirLeTransport(transport)
  try {
    const r = await borne.execute({ sql: 'SELECT ? AS v, ? AS w', args: [41, 'x'] })
    assert.deepStrictEqual({ ...r.rows[0] }, { v: 41, w: 'x' })
    const lots = await borne.batch([{ sql: 'SELECT ? AS v', args: [1] }, 'SELECT 2 AS v'], 'read')
    assert.deepStrictEqual(lots.map(l => ({ ...l.rows[0] })), [{ v: 1 }, { v: 2 }])
    assert.equal(minimal.turso.corps.length, avant + 2, 'deux allers-retours, partis')
    assert.equal(fabriques, 0, 'aucun Request fabriqué')
  } finally {
    borne.close()
    Object.defineProperty(globalThis, 'Request', descripteur)
  }
})

test('QUIZ_DB_CLIENT : minimal, libsql ou rien ; autre chose se refuse en le disant — et un magasin l’ouvre à sa création', async () => {
  assert.deepEqual(clientDemande(undefined), { client: 'libsql' })
  assert.deepEqual(clientDemande(' Minimal '), { client: 'minimal' })
  assert.deepEqual(clientDemande('libsql'), { client: 'libsql' })
  const refus = clientDemande('rapide')
  assert.ok('refus' in refus && /QUIZ_DB_CLIENT illisible/.test(refus.refus))

  // Par `clientDistant`, comme les magasins : borné, et parlant par le client choisi à sa création.
  choisirLeClient('minimal')
  const avant = minimal.turso.corps.length
  const borne = clientDistant(minimal.turso.adresse)
  choisirLeClient('libsql')
  try {
    const r = await borne.batch([{ sql: 'SELECT ? AS v', args: [3] }], 'read')
    assert.deepStrictEqual({ ...r[0].rows[0] }, { v: 3 })
    const lot = (minimal.turso.corps.at(-1) as { requests: { type: string }[] }).requests
    assert.equal(minimal.turso.corps.length, avant + 1)
    assert.ok(!lot.some(r => r.type === 'store_sql'), 'le client minimal n’a rien rangé d’avance : c’est bien lui')
  } finally {
    borne.close()
  }
})
