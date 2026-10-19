// Un appel à la base distante qui ne revient jamais (`clientBorne`,
// `core/distante.ts`). En production, le 15 octobre 2026 puis le 19, une
// lecture n'a jamais rendu la main, sans une erreur — le délai du `fetch` n'y
// avait rien pu — et, derrière un verrou ou une lecture partagée, figeait ce
// qui l'attendait jusqu'au redémarrage : les duels, les épreuves des
// sentiers, les séries, le défi de la semaine. On n'a pas su le reproduire : ici,
// un faux client libsql dont un appel ne se règle jamais.
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import type { Client, ResultSet } from '@libsql/client'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { AppelEnRoute, BaseMuette, clientBorne, clientDistant } from '../src/core/distante'
import { releve } from '../src/core/pouls'

const BORNE_MS = 60

/** Un résultat comme en rend libsql, assez pour qu'on le reconnaisse. */
const resultat = (n: number) => ({ rows: [{ n }], columns: ['n'], columnTypes: [], rowsAffected: 0, lastInsertRowid: undefined }) as unknown as ResultSet

/**
 * Des clients libsql inventés, numérotés dans l'ordre où on les crée : une
 * requête qui cite `ne_revient_pas` ne se règle jamais, `refuse` échoue tout
 * de suite, le reste répond le numéro du client.
 */
function fabrique() {
  const crees: { numero: number; appels: string[]; ferme: boolean }[] = []
  const creer = () => {
    const lui = { numero: crees.length + 1, appels: [] as string[], ferme: false }
    crees.push(lui)
    const repondre = (sql: string) => {
      lui.appels.push(sql)
      if (sql.includes('ne_revient_pas')) return new Promise<never>(() => {})
      if (sql.includes('refuse')) return Promise.reject(new Error('SQLITE_ERROR: no such table: refuse'))
      return Promise.resolve(resultat(lui.numero))
    }
    const sqlDe = (x: unknown) => (typeof x === 'string' ? x : Array.isArray(x) ? String(x[0]) : String((x as { sql: string }).sql))
    return {
      execute: (x: unknown) => repondre(sqlDe(x)),
      batch: (lot: unknown[]) => repondre(lot.map(sqlDe).join(' ; ')).then(r => lot.map(() => r)),
      close: () => {
        lui.ferme = true
      },
    } as unknown as Client
  }
  return { crees, creer }
}

/** Les erreurs du relevé de l'heure en cours, et leur détail. */
function erreursDuReleve() {
  const ligne = releve.lignes('banc').at(-1)!
  return { compte: ligne.erreurs, detail: ligne.erreursEnDetail ?? [] }
}

beforeEach(() => releve.remettreAZero())

function silencieux<T>(travail: () => Promise<T>): Promise<{ resultat: T; journal: string[] }> {
  const avant = console.error
  const journal: string[] = []
  console.error = (...args: unknown[]) => void journal.push(args.map(String).join(' '))
  return travail()
    .then(resultat => ({ resultat, journal }))
    .finally(() => {
      console.error = avant
    })
}

test('un appel qui ne revient jamais échoue à sa borne, et le suivant part d’un client neuf', async () => {
  const { crees, creer } = fabrique()
  const client = clientBorne(creer, BORNE_MS)
  const { journal } = await silencieux(async () => {
    const debut = performance.now()
    await assert.rejects(
      client.execute({ sql: 'SELECT ne_revient_pas FROM campagne_reponses WHERE profile_id = ?', args: ['profil-secret-42'] }),
      (e: unknown) => e instanceof AppelEnRoute && /SELECT ne_revient_pas FROM campagne_reponses/.test(e.message),
    )
    const duree = performance.now() - debut
    assert.ok(duree >= BORNE_MS - 5 && duree < BORNE_MS + 500, `rendu à sa borne, pas avant ni bien après (${Math.round(duree)} ms)`)
  })
  assert.equal(crees.length, 2, 'un client neuf : l’ancien garde pour toujours la place de l’appel resté en route')
  assert.equal(crees[0].ferme, false, 'l’ancien n’est pas fermé : ses autres requêtes en vol finissent d’elles-mêmes')
  const suivant = await client.execute('SELECT 1')
  assert.equal(suivant.rows[0].n, 2, 'l’appel suivant passe par le client neuf, et répond')
  assert.deepEqual(crees[1].appels, ['SELECT 1'])
  client.close()
  assert.deepEqual(
    crees.map(c => c.ferme),
    [true, true],
    'fermé avec le serveur, l’ancien aussi',
  )
  assert.ok(journal.some(l => l.includes('resté en route') && l.includes('ne_revient_pas')), 'le journal le dit, avec le début de la requête')
  const { compte, detail } = erreursDuReleve()
  assert.equal(compte['base · appel resté en route'], 1, 'comptée au relevé de l’heure : la page « Le serveur » du QG la dira')
  assert.equal(detail[0]?.nom, 'AppelEnRoute')
  assert.ok(!JSON.stringify(detail).includes('profil-secret-42'), 'jamais les paramètres de la requête')
  assert.ok(!journal.join(' ').includes('profil-secret-42'))
})

test('un lot qui ne revient jamais échoue de même, et dit sa première requête', async () => {
  const { crees, creer } = fabrique()
  const client = clientBorne(creer, BORNE_MS)
  await silencieux(() =>
    assert.rejects(
      client.batch(['SELECT ne_revient_pas FROM campagne_reponses', 'SELECT 2'], 'read'),
      (e: unknown) => e instanceof AppelEnRoute && /lot de 2 : SELECT ne_revient_pas/.test(e.message),
    ),
  )
  assert.equal(crees.length, 2)
  assert.equal((await client.batch(['SELECT 3'], 'read'))[0].rows[0].n, 2)
})

test('un appel qui répond à temps passe tel quel — son refus aussi — et ne laisse rien derrière lui', async () => {
  const { crees, creer } = fabrique()
  const client = clientBorne(creer, BORNE_MS)
  assert.equal((await client.execute('SELECT 1')).rows[0].n, 1)
  await assert.rejects(client.execute('SELECT * FROM refuse'), /no such table: refuse/, 'le refus de la base remonte tel quel')
  // Au-delà de la borne : ni erreur tardive, ni client neuf pour un appel qui avait répondu.
  await new Promise(rendre => setTimeout(rendre, BORNE_MS * 2))
  assert.equal(crees.length, 1)
  assert.deepEqual(erreursDuReleve().compte, {})
})

test('le texte d’une requête ne se lit qu’une fois l’appel resté en route, jamais à chaque aller-retour', async () => {
  // Lu à chaque appel — une expression rationnelle et `tronquer` sur tout le
  // SQL —, il coûtait à chaque aller-retour, au dixième de cœur, ce qui ne
  // sert qu'à la panne.
  let lu = 0
  const requete = (reponse: 'repond' | 'jamais') => ({
    get sql() {
      lu++
      return `SELECT ${reponse} FROM campagne_reponses`
    },
    args: [],
    reponse,
  })
  const client = clientBorne(
    () =>
      ({
        execute: (x: { reponse: string }) => (x.reponse === 'jamais' ? new Promise<never>(() => {}) : Promise.resolve(resultat(1))),
        close: () => {},
      }) as unknown as Client,
    BORNE_MS,
  )
  for (let i = 0; i < 3; i++) await client.execute(requete('repond'))
  assert.equal(lu, 0, 'un appel qui répond ne lit jamais le texte de sa requête')
  await silencieux(() => assert.rejects(client.execute(requete('jamais')), /SELECT jamais FROM campagne_reponses/))
  assert.equal(lu, 1, 'resté en route, il le lit une fois, pour le dire')
})

test('une base `file:` garde son client tel quel ; une base distante a le sien borné, à son délai et sa marge', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-borne-'))
  try {
    const fichier = clientDistant(`file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`)
    assert.ok(fichier instanceof Sqlite3Client, 'une base en fichier ne passe pas par le réseau : rien à borner')
    fichier.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  // Un port où rien n'écoute : le délai du `fetch` répond avant la borne, et c'est lui qu'on lit.
  const distant = clientDistant('http://127.0.0.1:9', undefined, { delaiMs: 200 })
  assert.ok(!(distant instanceof Sqlite3Client))
  await assert.rejects(distant.execute('SELECT 1'), (e: unknown) => !(e instanceof AppelEnRoute) && (e instanceof BaseMuette || e instanceof Error))
  assert.equal(distant.protocol, 'http')
  distant.close()
})
