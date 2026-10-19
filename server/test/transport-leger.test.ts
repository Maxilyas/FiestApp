// Le transport léger vers la base permanente (`QUIZ_DB_TRANSPORT=leger`,
// `core/transportLeger.ts`) : les allers-retours du client libsql sur
// `http.request` plutôt que sur le `fetch` de Node, deux fois moins coûteux
// au processeur (le banc du 19 octobre 2026). Il tient d'abord tout ce que la
// garde des connexions demande au `fetch` (`garde-des-connexions.ts`), puis
// ce qui lui est propre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import { gzipSync } from 'node:zlib'
import { connexionEmpruntee, connexionOuverte, connexionRefermeeParNous, suivreLaBase } from '../src/core/connexions'
import { clientDistant, pourquoiInjoignable, transportDemande } from '../src/core/distante'
import { CONNEXIONS_AU_PLUS } from '../src/core/transportLeger'
import { demarrer } from './banc'
import { comptes, testerLesConnexions } from './garde-des-connexions'

testerLesConnexions('leger', e => (e as { code?: unknown } | null)?.code === 'ECONNRESET')

type Instruction = { sql?: string; sql_id?: number }

/**
 * Un faux Turso qui parle assez le protocole de libsql (hrana, `/v2/pipeline`)
 * pour un `execute` et un `batch` : chaque requête rend une ligne, le texte
 * de son SQL — un `BEGIN`, un `COMMIT` ou un `ROLLBACK`, aucune. Il retient
 * les en-têtes de chaque requête ; `gzip` : il compresse ses réponses quand
 * même ; `apresMs` : il répond après tant de ms ; `coupe` : il envoie le début
 * de sa réponse, puis coupe la connexion.
 */
async function fauxTursoHrana(reglage: { gzip?: boolean; apresMs?: number; coupe?: boolean } = {}) {
  const entetes: IncomingMessage['headers'][] = []
  const serveur = createServer((req: IncomingMessage, res: ServerResponse) => {
    entetes.push(req.headers)
    const morceaux: Buffer[] = []
    req.on('data', (m: Buffer) => morceaux.push(m))
    req.on('end', () => {
      const corps = JSON.parse(Buffer.concat(morceaux).toString('utf8')) as { requests: { type: string; sql_id?: number; sql?: string; stmt?: Instruction; batch?: { steps: { stmt: Instruction }[] } }[] }
      const sqls = new Map<number, string>()
      const resultat = (stmt: Instruction) => {
        const sql = stmt.sql ?? sqls.get(stmt.sql_id ?? -1) ?? ''
        return /^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(sql)
          ? { cols: [], rows: [], affected_row_count: 0, last_insert_rowid: null }
          : { cols: [{ name: 'texte', decltype: null }], rows: [[{ type: 'text', value: sql }]], affected_row_count: 0, last_insert_rowid: null }
      }
      const results = corps.requests.map(r => {
        if (r.type === 'store_sql') {
          sqls.set(r.sql_id!, r.sql!)
          return { type: 'ok', response: { type: 'store_sql' } }
        }
        if (r.type === 'execute') return { type: 'ok', response: { type: 'execute', result: resultat(r.stmt!) } }
        if (r.type === 'batch') {
          const step_results = r.batch!.steps.map(s => resultat(s.stmt))
          return { type: 'ok', response: { type: 'batch', result: { step_results, step_errors: step_results.map(() => null) } } }
        }
        return { type: 'ok', response: { type: r.type } }
      })
      const texte = Buffer.from(JSON.stringify({ baton: null, base_url: null, results }))
      const repondre = () => {
        if (reglage.coupe) {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.write(texte.subarray(0, 10))
          return void setTimeout(() => req.socket.destroy(), 20)
        }
        if (reglage.gzip) {
          const compresse = gzipSync(texte)
          res.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'gzip', 'content-length': compresse.length })
          return void res.end(compresse)
        }
        res.writeHead(200, { 'content-type': 'application/json', 'content-length': texte.length })
        res.end(texte)
      }
      if (reglage.apresMs) setTimeout(repondre, reglage.apresMs)
      else repondre()
    })
  })
  serveur.keepAliveTimeout = 0
  await new Promise<void>(r => serveur.listen(0, '127.0.0.1', r))
  const adresse = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`
  return {
    adresse,
    entetes,
    fermer: () =>
      new Promise<void>(r => {
        serveur.closeAllConnections()
        serveur.close(() => r())
      }),
  }
}

test('leger · le client libsql lit et écrit par le transport léger, sans demander de compression', async () => {
  const turso = await fauxTursoHrana()
  const client = clientDistant(turso.adresse)
  try {
    const lu = await client.execute({ sql: 'SELECT texte FROM profils WHERE id = ?', args: ['profil-1'] })
    assert.equal(lu.rows[0].texte, 'SELECT texte FROM profils WHERE id = ?')
    const [a, b] = await client.batch(['SELECT 1 AS un', { sql: 'SELECT 2 AS deux', args: [] }], 'read')
    assert.equal(a.rows[0].texte, 'SELECT 1 AS un')
    assert.equal(b.rows[0].texte, 'SELECT 2 AS deux')
    // Turso répond alors en clair : rien à décompresser au dixième de cœur.
    assert.ok(
      turso.entetes.every(e => e['accept-encoding'] === undefined),
      'aucune compression demandée',
    )
    assert.ok(turso.entetes.every(e => e['content-type'] === 'application/json'))
  } finally {
    client.close()
    await turso.fermer()
  }
})

test('leger · une réponse compressée quand même se lit en clair', async () => {
  // Un proxy devant la base pourrait compresser sans qu'on le demande.
  const turso = await fauxTursoHrana({ gzip: true })
  const client = clientDistant(turso.adresse)
  try {
    assert.equal((await client.execute('SELECT 3 AS trois')).rows[0].texte, 'SELECT 3 AS trois')
  } finally {
    client.close()
    await turso.fermer()
  }
})

test('leger · une réponse coupée en route échoue tout de suite, et dit le réseau', async () => {
  const turso = await fauxTursoHrana({ coupe: true })
  const client = clientDistant(turso.adresse)
  try {
    const debut = performance.now()
    const erreur = await client.execute('SELECT 4').then(
      () => assert.fail('une réponse coupée ne se lit pas'),
      (e: unknown) => e,
    )
    assert.ok(performance.now() - debut < 2_000, 'elle échoue dès la connexion coupée, sans attendre le délai')
    assert.equal(pourquoiInjoignable(erreur), 'réseau — ECONNRESET')
  } finally {
    client.close()
    await turso.fermer()
  }
})

test('leger · une base injoignable se dit par le réseau, son code à la place de la pile', async () => {
  // Un port où rien n'écoute.
  const client = clientDistant('http://127.0.0.1:9', undefined, { delaiMs: 2_000 })
  try {
    const erreur = await client.execute('SELECT 1').then(
      () => assert.fail('rien n’écoute là'),
      (e: unknown) => e,
    )
    assert.equal(pourquoiInjoignable(erreur), 'réseau — ECONNREFUSED')
  } finally {
    client.close()
  }
})

test('leger · jamais plus de connexions à la fois que CONNEXIONS_AU_PLUS : les autres requêtes attendent la première libre', async () => {
  // L'accueil lance treize lectures de front : treize poignées de main au
  // dixième de cœur, quand quelques connexions chaudes les servent à la file.
  const turso = await fauxTursoHrana({ apresMs: 50 })
  const client = clientDistant(turso.adresse)
  try {
    const avant = comptes().ouvertes
    const lus = await Promise.all(Array.from({ length: CONNEXIONS_AU_PLUS * 2 + 3 }, (_, i) => client.execute(`SELECT ${i} AS n`)))
    assert.deepEqual(
      lus.map(r => r.rows[0].texte),
      lus.map((_, i) => `SELECT ${i} AS n`),
      'toutes servies',
    )
    assert.equal(comptes().ouvertes - avant, CONNEXIONS_AU_PLUS, `${CONNEXIONS_AU_PLUS} connexions, pas une de plus`)
  } finally {
    client.close()
    await turso.fermer()
  }
})

test('leger · une connexion libre détruite sans sa fin se compte refermée par la base ; refermée par nous, ou en route, non', () => {
  // Depuis Node 22.23, l'agent de `http` détruit une connexion libre qui reçoit
  // quoi que ce soit — la fin de la base comprise — sans émettre `end` : le
  // transport léger ne comptait plus une seule fermeture de la base (la CI du
  // 19 octobre 2026, sur Node 22.23.3 ; rien ici, sur 22.22). Des connexions
  // fermées à la main, pour que l'épreuve vaille sur toute version de Node.
  suivreLaBase('http://base-du-test.invalid')
  const neuve = (): Socket => {
    const s = new EventEmitter() as unknown as Socket
    connexionOuverte(s, 'base-du-test.invalid', { finPeutManquer: true })
    return s
  }
  const avant = comptes().refermees
  neuve().emit('close', false)
  assert.equal(comptes().refermees - avant, 1, 'libre, détruite sans sa fin : la base l’a fermée')
  const gardee = neuve()
  connexionRefermeeParNous(gardee)
  gardee.emit('close', false)
  assert.equal(comptes().refermees - avant, 1, 'sa garde écoulée, c’est nous qui la refermons')
  // Empruntée par une requête : l'aller-retour tombé avec elle se compte ailleurs (`avecDelai`).
  const enRoute = neuve()
  connexionEmpruntee(enRoute)
  enRoute.emit('close', true)
  assert.equal(comptes().refermees - avant, 1, 'celle qui servait ne se compte pas ici')
  const finie = neuve()
  finie.emit('end')
  finie.emit('close', false)
  assert.equal(comptes().refermees - avant, 2, 'sa fin, puis sa fermeture : une seule fois')
})

test('QUIZ_DB_TRANSPORT se lit comme un humain l’écrit, et se refuse en disant quoi écrire', () => {
  for (const fetch of [undefined, '', '  ', 'fetch', 'FETCH', 'undici']) assert.deepEqual(transportDemande(fetch), { transport: 'fetch' }, `« ${fetch} »`)
  for (const leger of ['leger', ' leger ', 'LEGER', 'léger', 'Léger']) assert.deepEqual(transportDemande(leger), { transport: 'leger' }, `« ${leger} »`)
  for (const illisible of ['1', 'http', 'rapide']) {
    const lu = transportDemande(illisible)
    assert.ok('refus' in lu, `« ${illisible} » se refuse`)
    assert.ok(lu.refus.includes('leger pour') && lu.refus.includes(illisible), lu.refus)
  }
})

test('leger · /healthz dit le transport qui tourne', async () => {
  const banc = await demarrer()
  try {
    const sante = (await (await fetch(`${banc.url}/healthz`)).json()) as { base: { connexions: { transport: string } } }
    assert.equal(sante.base.connexions.transport, 'leger')
  } finally {
    await banc.close()
  }
})
