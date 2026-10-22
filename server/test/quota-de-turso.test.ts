// Le quota de Turso (le 22 octobre 2026 : 333 millions de lignes lues sur
// les 500 du mois, et rien ne le disait) : ce que chaque réponse de Turso dit
// de son coût, compté heure par heure au relevé, par le `fetch` de Node comme
// par le transport léger ; projeté sur trente jours à la page « Le serveur »
// du QG, avec les requêtes qui lisent le plus ; et dit dans « À traiter »
// quand ce serveur en prendrait la moitié.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import React from 'react'
import { choisirLeTransport, clientDistant, type TransportDeLaBase } from '../src/core/distante'
import { ReleveHoraire, releve } from '../src/core/pouls'
import { LIGNES_D_UNE_LOURDE, coutDeLAllerRetour, familleDeLaRequete } from '../src/core/quotaDeTurso'
import {
  HEURE_MS,
  REQUETES_PAR_HEURE,
  alertesDuServeur,
  debutDeLHeure,
  fondreLHeure,
  pageDuServeur,
  quotaDuMois,
  type DemarrageDuServeur,
  type HeureDeSante,
  type PageDuServeur,
  type QuotaDeLHeure,
} from '../../shared/santeDuServeur'
import { lesChosesATraiter, type ATraiterDuQg } from '../../shared/qg'

const sansInsecables = (s: string) => s.replace(/[  ]/g, ' ')

const ligne = (heure: number, demarrage: string, quota: QuotaDeLHeure | null): HeureDeSante => ({
  heure,
  demarrage,
  base: null,
  routes: null,
  lentes: [],
  erreurs: {},
  miroir: 0,
  charge: null,
  connexions: null,
  requetes: null,
  ...(quota !== undefined && { quota }),
})

test('une réponse de Turso dit ce qu’elle a coûté : chaque instruction, les étapes d’un lot comprises, et le texte de celles qui lisent beaucoup', () => {
  // Comme l'envoie le client libsql : le texte d'une étape de lot rangé d'abord, cité par son numéro.
  const requete = JSON.stringify({
    baton: null,
    requests: [
      { type: 'execute', stmt: { sql: 'SELECT * FROM profiles WHERE id = ?', args: [{ type: 'text', value: 'secret-de-lea' }] } },
      { type: 'store_sql', sql_id: 0, sql: 'SELECT COUNT(*) FROM campagne_reponses r\n     JOIN campagne_series s ON s.id = r.serie_id\n     WHERE s.profile_id IN (?, ?, ?) LIMIT 50' },
      {
        type: 'batch',
        batch: {
          steps: [{ stmt: { sql: 'BEGIN TRANSACTION READONLY' } }, { stmt: { sql_id: 0, args: [{ type: 'text', value: 'secret-de-lea' }] } }, { stmt: { sql: 'COMMIT' } }],
        },
      },
      { type: 'close' },
    ],
  })
  const resultat = (lues: number, ecrites = 0) => ({ cols: [], rows: [], affected_row_count: 0, last_insert_rowid: null, rows_read: lues, rows_written: ecrites })
  const reponse = {
    baton: null,
    base_url: null,
    results: [
      { type: 'ok', response: { type: 'execute', result: resultat(1) } },
      { type: 'ok', response: { type: 'store_sql' } },
      { type: 'ok', response: { type: 'batch', result: { step_results: [resultat(0), resultat(4200), resultat(0, 3)], step_errors: [null, null, null] } } },
      { type: 'ok', response: { type: 'close' } },
    ],
  }
  let relu = 0
  const corps = () => {
    relu++
    return requete
  }
  const cout = coutDeLAllerRetour(reponse, corps)
  assert.deepEqual(cout, {
    lues: 4201,
    ecrites: 3,
    lourdes: [{ requete: 'SELECT COUNT(*) FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id WHERE s.profile_id IN (?…) LIMIT #', lues: 4200 }],
  })
  assert.equal(relu, 1, 'le texte de la requête, relu pour nommer la lourde')
  assert.ok(!JSON.stringify(cout).includes('secret-de-lea'), 'jamais un paramètre : ils ne sont pas dans le texte')
  // Rien de lourd : le texte ne se relit pas — la plupart des allers-retours lisent une ligne par leur clé.
  assert.deepEqual(coutDeLAllerRetour({ results: [reponse.results[0]] }, corps), { lues: 1, ecrites: 0, lourdes: [] })
  assert.equal(relu, 1)
  assert.equal(LIGNES_D_UNE_LOURDE, 100)
  // Une erreur ne coûte rien qu'on sache ; un corps illisible nomme sa lourde « ? » ; ce qui n'est pas une réponse, rien.
  assert.deepEqual(coutDeLAllerRetour({ results: [{ type: 'error', error: { message: 'non' } }] }, () => null), { lues: 0, ecrites: 0, lourdes: [] })
  assert.deepEqual(coutDeLAllerRetour({ results: [reponse.results[2]] }, () => 'pas du JSON')?.lourdes, [{ requete: '?', lues: 4200 }])
  assert.equal(coutDeLAllerRetour({}, () => null), null)
  assert.equal(coutDeLAllerRetour(null, () => null), null)
})

test('une requête se nomme par son texte, sur une ligne, ses nombres et ses listes de paramètres ramenés à un signe', () => {
  assert.equal(familleDeLaRequete('SELECT  a\n\tFROM t  WHERE id IN (?,?, ?) AND n > 2000 LIMIT 50'), 'SELECT a FROM t WHERE id IN (?…) AND n > # LIMIT #')
  // Deux listes de longueurs différentes : la même requête.
  assert.equal(familleDeLaRequete('SELECT 1 FROM t WHERE id IN (?, ?)'), familleDeLaRequete('SELECT 1 FROM t WHERE id IN (?, ?, ?, ?, ?)'))
  assert.ok(familleDeLaRequete(`SELECT ${'x, '.repeat(200)}y FROM t`).length <= 141, 'coupée')
})

test('l’heure compte ses lignes, nomme ses requêtes lourdes — les plus gourmandes, les autres ensemble —, et deux démarrages s’y fondent', () => {
  const t = Date.UTC(2026, 9, 22, 10, 5)
  const r = new ReleveHoraire(() => t)
  assert.equal(r.lignes('a')[0].quota, null, 'sans un aller-retour, rien')
  for (let i = 0; i < 70; i++) r.quota({ lues: 200 + i, ecrites: 1, lourdes: [{ requete: `SELECT ${i}`, lues: 200 + i }] })
  r.quota({ lues: 3, ecrites: 0, lourdes: [] })
  const q = r.lignes('a')[0].quota!
  assert.equal(q.appels, 71)
  assert.equal(q.lues, 70 * 200 + (69 * 70) / 2 + 3)
  assert.equal(q.ecrites, 70)
  // Les soixante premières suivies une à une ; au-delà, ensemble — et l'heure n'écrit que les plus gourmandes.
  assert.equal(q.lourdes.length, REQUETES_PAR_HEURE)
  assert.deepEqual(q.lourdes[0], { requete: 'autres requêtes', n: 10, lues: 2645 })
  assert.deepEqual(q.lourdes[1], { requete: 'SELECT 59', n: 1, lues: 259 })
  // Deux démarrages dans la même heure : les comptes s'ajoutent, les mêmes requêtes se fondent.
  const h = debutDeLHeure(t)
  const fondue = fondreLHeure([
    ligne(h, 'b', { appels: 2, lues: 1000, ecrites: 4, lourdes: [{ requete: 'SELECT a', n: 1, lues: 600 }, { requete: 'SELECT b', n: 1, lues: 300 }] }),
    ligne(h, 'c', { appels: 3, lues: 700, ecrites: 0, lourdes: [{ requete: 'SELECT b', n: 2, lues: 500 }] }),
    // Une ligne d'avant le compte n'en dit rien.
    ligne(h, 'd', null),
  ])!
  assert.deepEqual(fondue.quota, {
    appels: 5,
    lues: 1700,
    ecrites: 4,
    lourdes: [
      { requete: 'SELECT b', n: 3, lues: 800 },
      { requete: 'SELECT a', n: 1, lues: 600 },
    ],
  })
})

/** Mardi 22 octobre 2026, 20 h 30 à Paris. */
const MAINTENANT = Date.UTC(2026, 9, 22, 18, 30)
const COURANT: DemarrageDuServeur = { id: 'c', demarreLe: MAINTENANT - 2 * HEURE_MS, pretEnMs: 900, version: 'ccccccc', env: 'production', vuLe: MAINTENANT, arreteLe: null }

/**
 * Deux jours comptés, dix heures éveillées chacun, un million de lignes par
 * heure — et deux jours d'avant le compte, qui n'en disent rien.
 */
function deuxJoursComptes(): HeureDeSante[] {
  const derniere = debutDeLHeure(MAINTENANT)
  const lignes: HeureDeSante[] = []
  for (let jour = 0; jour < 4; jour++) {
    for (let h = 8; h < 18; h++) {
      const heure = derniere - jour * 24 * HEURE_MS - h * HEURE_MS
      lignes.push(
        ligne(
          heure,
          'c',
          jour < 2
            ? {
                appels: 100,
                lues: 1_000_000,
                ecrites: 50,
                lourdes: [
                  { requete: 'SELECT lourde', n: 10, lues: 600_000 },
                  { requete: 'SELECT moyenne', n: 50, lues: 300_000 },
                ],
              }
            : null,
        ),
      )
    }
  }
  return lignes
}

test('le mois se projette au rythme des heures comptées — les heures endormies pour rien —, et « À traiter » le dit à la moitié du quota', () => {
  const lignes = deuxJoursComptes()
  const depuis = debutDeLHeure(MAINTENANT) - 24 * HEURE_MS - 17 * HEURE_MS
  const quota = quotaDuMois(lignes, MAINTENANT)!
  const luesSurTrenteJours = Math.round((20_000_000 / (MAINTENANT - depuis)) * 30 * 24 * HEURE_MS)
  assert.deepEqual(quota, {
    depuis,
    lues: 20_000_000,
    ecrites: 1000,
    luesSurTrenteJours,
    ecritesSurTrenteJours: Math.round((1000 / (MAINTENANT - depuis)) * 30 * 24 * HEURE_MS),
    part: Math.round((luesSurTrenteJours / 500_000_000) * 1000) / 10,
    partEcrite: 0.2,
    lourdes: [
      { requete: 'SELECT lourde', n: 200, lues: 12_000_000, part: 60 },
      { requete: 'SELECT moyenne', n: 1000, lues: 6_000_000, part: 30 },
    ],
  })
  assert.ok(quota.part > 50 && quota.part < 80, `${quota.part} %`)
  assert.equal(quotaDuMois(lignes.filter(l => !l.quota), MAINTENANT), null, 'sans une heure comptée')

  // Plus de la moitié, sur plus d'un jour : « À traiter » le dit, en sourdine sous les quatre cinquièmes.
  const alertes = alertesDuServeur({ recentes: [], demarrages: [], memoireMo: null, maintenant: MAINTENANT, courant: 'c', quota })
  assert.deepEqual(alertes.quota, { part: quota.part, luesSurTrenteJours })
  const aTraiter: ATraiterDuQg = {
    reserve: null,
    signalementsDuJour: { questions: 0, joueurs: 0 },
    signalementsDeLaCampagne: { questions: 0, joueurs: 0 },
    catalogue: 0,
    rappel: null,
    routine: { jour: null, campagne: null },
    serveur: alertes,
  }
  const [chose] = lesChosesATraiter(aTraiter, null, MAINTENANT)
  assert.deepEqual([chose.cle, chose.alerte, chose.ecran], ['quota', false, 'serveur'])
  assert.match(sansInsecables(chose.detail), /^[\d,]+ millions de lignes lues en trente jours à ce rythme : [\d,]+ % du quota$/)
  // Au-delà des quatre cinquièmes, en rouge.
  const rouge = alertesDuServeur({ recentes: [], demarrages: [], memoireMo: null, maintenant: MAINTENANT, courant: 'c', quota: { ...quota, part: 85 } })
  assert.equal(lesChosesATraiter({ ...aTraiter, serveur: rouge }, null, MAINTENANT)[0].alerte, true)
  // Sous la moitié, rien ; et un rythme de moins d'un jour ne se juge pas : un réveil relit tout le journal d'un coup.
  assert.equal(alertesDuServeur({ recentes: [], demarrages: [], memoireMo: null, maintenant: MAINTENANT, courant: 'c', quota: { ...quota, part: 40 } }).quota, null)
  const unReveil = quotaDuMois([ligne(debutDeLHeure(MAINTENANT), 'c', { appels: 30, lues: 2_000_000, ecrites: 0, lourdes: [] })], MAINTENANT)!
  assert.ok(unReveil.part > 100, 'une heure de réveil, ramenée à trente jours, dépasse tout')
  assert.equal(alertesDuServeur({ recentes: [], demarrages: [], memoireMo: null, maintenant: MAINTENANT, courant: 'c', quota: unReveil }).quota, null)
})

test('la page « Le serveur » dit le quota : ses lignes heure par heure, le mois à ce rythme, et ce qui lit le plus', async () => {
  const page = pageDuServeur(deuxJoursComptes(), [COURANT], { maintenant: MAINTENANT, courant: COURANT })
  assert.equal(page.quota?.lues, 20_000_000)
  const comptee = page.heures.find(h => h.lignesLues !== null)!
  assert.deepEqual([comptee.lignesLues, comptee.lignesEcrites], [1_000_000, 50])
  assert.equal(page.heures.filter(h => h.lignesLues !== null).length, 20)

  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#serveur', origin: 'http://banc' } } })
  const { SanteDuServeurAuQg } = await import(new URL('../../client/src/components/QgServeur.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const rendre = (p: PageDuServeur) => sansInsecables(renderToStaticMarkup(React.createElement(SanteDuServeurAuQg, { page: p })).replace(/<!-- -->/g, ''))
  const html = rendre(page)
  for (const attendu of [
    'Le quota de Turso',
    'Ce qui lit le plus',
    '20 millions de lignes lues',
    '% du quota de Turso (500 millions de lignes par mois)',
    'la préproduction, les sauvegardes et les scripts lisent au même quota',
    '<span class="qg-source">SELECT lourde</span><span class="num">60 % · 200 fois</span>',
    'Au-delà de la moitié du quota',
    'Le reste, 10 %',
  ]) {
    assert.ok(html.includes(attendu), `« ${attendu} » dans la page`)
  }
  for (const absent of ['NaN', 'undefined', 'null']) assert.ok(!html.includes(absent), `pas de « ${absent} »`)
  // Avant la première heure comptée : la page le dit, sans un chiffre.
  const avant = rendre(pageDuServeur(deuxJoursComptes().map(l => ({ ...l, quota: null })), [COURANT], { maintenant: MAINTENANT, courant: COURANT }))
  assert.ok(avant.includes('Rien de compté encore'))
})

/**
 * Un faux Turso qui répond au protocole comme le vrai : chaque instruction,
 * et chaque étape d'un lot, dit ce qu'elle a lu — beaucoup si son texte dit
 * « lourde » — et écrit.
 */
async function fauxTursoQuiCompte() {
  const serveur = createServer((req, res) => {
    let corps = ''
    req.on('data', (morceau: Buffer) => (corps += morceau))
    req.on('end', () => {
      type Instruction = { sql?: string; sql_id?: number }
      const { requests } = JSON.parse(corps) as { requests: { type: string; sql_id?: number; sql?: string; stmt?: Instruction; batch?: { steps: { stmt: Instruction }[] } }[] }
      // Les étapes d'un lot citent leur texte, rangé d'abord (`store_sql`).
      const rangees = new Map(requests.filter(r => r.type === 'store_sql').map(r => [r.sql_id, r.sql]))
      const resultat = (stmt: Instruction) => {
        const sql = stmt.sql ?? rangees.get(stmt.sql_id) ?? ''
        return {
          cols: [],
          rows: [],
          affected_row_count: 0,
          last_insert_rowid: null,
          rows_read: /lourde/.test(sql) ? 5000 : 2,
          rows_written: /^INSERT/.test(sql) ? 1 : 0,
        }
      }
      const results = requests.map(r =>
        r.type === 'execute'
          ? { type: 'ok', response: { type: 'execute', result: resultat(r.stmt!) } }
          : r.type === 'batch'
            ? { type: 'ok', response: { type: 'batch', result: { step_results: r.batch!.steps.map(s => resultat(s.stmt)), step_errors: r.batch!.steps.map(() => null) } } }
            : { type: 'ok', response: { type: r.type } },
      )
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ baton: null, base_url: null, results }))
    })
  })
  await new Promise<void>(r => serveur.listen(0, '127.0.0.1', r))
  return {
    adresse: `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`,
    fermer: () =>
      new Promise<void>(r => {
        serveur.closeAllConnections()
        serveur.close(() => r())
      }),
  }
}

for (const transport of ['fetch', 'leger'] as TransportDeLaBase[]) {
  test(`par le transport ${transport === 'fetch' ? 'du fetch de Node' : 'léger'}, chaque aller-retour compte ses lignes au relevé de l’heure — la requête partie entière`, async () => {
    const turso = await fauxTursoQuiCompte()
    choisirLeTransport(transport)
    releve.remettreAZero()
    const client = clientDistant(turso.adresse)
    try {
      await client.execute({ sql: 'SELECT * FROM lourde WHERE id = ?', args: ['un'] })
      // Les étapes d'un lot citent leur texte par son numéro : le relevé le retrouve.
      await client.batch([{ sql: 'INSERT INTO t (id) VALUES (?)', args: ['deux'] }, 'SELECT n FROM lourde LIMIT 10'], 'write')
      const quota = releve.lignes('banc').at(-1)!.quota!
      assert.equal(quota.appels, 2)
      assert.ok(quota.lues >= 2 * 5000 + 2, JSON.stringify(quota))
      assert.equal(quota.ecrites, 1)
      assert.deepEqual(quota.lourdes, [
        { requete: 'SELECT * FROM lourde WHERE id = ?', n: 1, lues: 5000 },
        { requete: 'SELECT n FROM lourde LIMIT #', n: 1, lues: 5000 },
      ])
    } finally {
      client.close()
      choisirLeTransport('fetch')
      await turso.fermer()
    }
  })
}
