// La semaine du serveur gardée (le banc du 4 novembre 2026,
// `retours/2026-11-04/performance-du-qg.md`) : relue en entier, d'un bloc, à
// chaque remise à jour — chaque heure pour les règles des alertes, QG fermé, et
// à chaque page « Le serveur » —, elle faisait recevoir, décoder et relire
// 2,3 Mo de relevés, 2,6 s de gel pour tout le monde au dixième de cœur. Elle
// se lit maintenant une fois, par tranches qui rendent la main, puis seulement
// ce qui a été récrit ; les versions des règles et le quota des alertes y
// lisent sans recalculer la page.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { SanteDuServeur } from '../src/core/santeDuServeur'
import { ReleveHoraire } from '../src/core/pouls'
import { ceQuiTournait } from '../src/core/gels'
import { HEURES_DE_SANTE, debutDeLHeure, pageDuServeur, type DemarrageDuServeur, type HeureDeSante } from '../../shared/santeDuServeur'

const H = 3_600_000
const MINUTE = 60_000
// Mercredi 4 novembre 2026, 10 h 30 à Paris (9 h 30 UTC).
const DEPART = Date.UTC(2026, 10, 4, 9, 30)

/** Ce que la base rend des relevés : chaque lecture de `qg_sante`, et ses lignes — on compte, on ne chronomètre pas. */
const lus = { lectures: 0, lignes: 0 }
const remettre = () => Object.assign(lus, { lectures: 0, lignes: 0 })
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    const res = await origine.apply(this, args)
    const instructions = methode === 'batch' ? (args[0] as unknown[]) : [args[0]]
    const resultats = (methode === 'batch' ? res : [res]) as { rows: unknown[] }[]
    instructions.forEach((s, i) => {
      if (!/^\s*SELECT[\s\S]*\bFROM qg_sante\b/.test(typeof s === 'string' ? s : (s as { sql: string }).sql)) return
      lus.lectures++
      lus.lignes += resultats[i].rows.length
    })
    return res
  }
}

/** Une santé du serveur sur une base jetable, l'horloge à la main et son propre relevé. */
async function uneSante(etat: { t: number }, pageGardeeMs?: number) {
  const fichier = path.join(mkdtempSync(path.join(tmpdir(), 'quizz-semaine-')), 'permanente.db')
  const releve = new ReleveHoraire(() => etat.t)
  const sante = new SanteDuServeur(`file:${fichier}`, undefined, {
    maintenant: () => etat.t,
    releve,
    veille: { pannes: () => [] },
    ...(pageGardeeMs !== undefined && { pageGardeeMs }),
  })
  await sante.init()
  return { sante, releve, db: new Database(fichier) }
}

/** Celui qui répond avant que son démarrage s'écrive, tel que la santé le prête à la page. */
const provisoire = (id: string, t: number): DemarrageDuServeur => ({ id, demarreLe: t, pretEnMs: null, version: null, env: null, vuLe: t, arreteLe: null })

/** Le relevé d'une heure tel qu'un démarrage l'écrit : `v1` répond à 100 ms, `v2` — la version suivante — à 300. */
const releveDe = (demarrage: string) => ({
  base: { n: 10, p50: 20, p95: 40, max: 60 },
  routes: { n: 50, p50: 80, p95: demarrage === 'v2' ? 240 : 120, max: 400 },
  lentes: [],
  erreurs: {},
  miroir: 0,
  charge: null,
  connexions: null,
  requetes: null,
  // Assez lu pour que l'alerte du quota se dise : 500 000 lignes l'heure, plus de la moitié du quota sur trente jours.
  quota: { appels: 100, lues: 500_000, ecrites: 10, lourdes: [] },
  parRoute: [{ route: 'GET /api/jour', n: 30, p50: 50, p95: demarrage === 'v2' ? 300 : 100, max: 400, totalMs: 1_800, refusees: 0, enErreur: 0 }],
})

const ecrireUneHeure = (db: Database.Database, heure: number, demarrage: string, releve: object, majLe: number) =>
  db
    .prepare(
      `INSERT INTO qg_sante (heure, demarrage, releve, maj_le) VALUES (?, ?, ?, ?)
       ON CONFLICT (heure, demarrage) DO UPDATE SET releve = excluded.releve, maj_le = excluded.maj_le`,
    )
    .run(heure, demarrage, JSON.stringify(releve), majLe)

/**
 * Une semaine pleine, une heure par heure jusqu'à celle d'avant : `z` avant la
 * semaine — ses deux dernières heures n'en sont pas —, `v1` ses quatre premiers
 * jours, `v2` la suite. Rend ce que la page doit en lire : les heures de la
 * semaine, telles que la base les relit, et les démarrages, le dernier d'avant
 * d'abord.
 */
function ecrireLaSemaine(db: Database.Database, t: number): { lignes: HeureDeSante[]; demarrages: DemarrageDuServeur[] } {
  const derniere = debutDeLHeure(t)
  const debut = derniere - (HEURES_DE_SANTE - 1) * H
  const demarrages: DemarrageDuServeur[] = [
    { id: 'z', demarreLe: debut - 30 * H, pretEnMs: 1_000, version: 'aaaaaaa', env: 'production', vuLe: debut - MINUTE, arreteLe: debut - MINUTE },
    { id: 'v1', demarreLe: debut + 5 * MINUTE, pretEnMs: 900, version: 'aaaaaaa', env: 'production', vuLe: debut + 96 * H - MINUTE, arreteLe: debut + 96 * H - MINUTE },
    { id: 'v2', demarreLe: debut + 96 * H, pretEnMs: 1_100, version: 'bbbbbbb', env: 'production', vuLe: t - 5 * MINUTE, arreteLe: t - 5 * MINUTE },
  ]
  const unDemarrage = db.prepare('INSERT INTO qg_demarrages (id, demarre_le, pret_en_ms, version, env, vu_le, arrete_le) VALUES (?, ?, ?, ?, ?, ?, ?)')
  for (const d of demarrages) unDemarrage.run(d.id, d.demarreLe, d.pretEnMs, d.version, d.env, d.vuLe, d.arreteLe)
  const lignes: HeureDeSante[] = []
  for (let heure = debut - 2 * H; heure < derniere; heure += H) {
    const demarrage = heure < debut ? 'z' : heure < debut + 96 * H ? 'v1' : 'v2'
    // Récrite pour la dernière fois à la fin de son heure, comme le relevé le fait.
    ecrireUneHeure(db, heure, demarrage, releveDe(demarrage), heure + H - 1)
    if (heure >= debut) lignes.push({ heure, demarrage, ...releveDe(demarrage) })
  }
  return { lignes, demarrages }
}

test('la semaine du serveur se lit une fois, par tranches qui rendent la main — sans perdre ni doubler une heure à leurs bords', async () => {
  const etat = { t: DEPART }
  const { sante, releve, db } = await uneSante(etat)
  try {
    const { lignes, demarrages } = ecrireLaSemaine(db, etat.t)
    // La boucle tourne pendant la lecture : d'un seul bloc, elle ne tournait qu'au retour de la base.
    let tours = 0
    let finie = false
    const compter = () => {
      tours++
      if (!finie) setImmediate(compter)
    }
    setImmediate(compter)
    const debutDeLaLecture = performance.now()
    let nommee = false
    let page
    remettre()
    try {
      const enRoute = sante.page('7j')
      nommee = ceQuiTournait(debutDeLaLecture, performance.now()).some(c => c.quoi === 'fond · semaine du serveur')
      page = await enRoute
    } finally {
      // Le compteur s'arrête quoi qu'il arrive : il tiendrait le processus des tests ouvert.
      finie = true
    }
    assert.ok(nommee, 'nommée pour la sonde des gels')
    assert.ok(tours >= 20, `la main rendue entre les tranches : ${tours} tours de boucle pendant la lecture`)
    assert.ok(lus.lectures >= 20, `${lus.lectures} tranches`)
    assert.equal(lus.lignes, lignes.length, 'chaque heure de la semaine lue une fois, rien d’avant elle')
    // Chaque heure de la semaine une fois, rien d'avant elle : la page est celle que ses heures font.
    assert.deepEqual(page, pageDuServeur([...lignes, ...releve.lignes(sante.id)], demarrages, { maintenant: etat.t, courant: provisoire(sante.id, etat.t) }))
    // Le quota des alertes se lit dans la même semaine que la page.
    const alertes = await sante.alertes(null)
    assert.ok(page.quota && alertes.quota, 'le quota assez lu pour se dire')
    assert.deepEqual(alertes.quota, { part: page.quota.part, luesSurTrenteJours: page.quota.luesSurTrenteJours })
  } finally {
    db.close()
    await sante.arreter()
  }
})

test('une heure lue ne se relit plus : seules les lignes récrites depuis la lecture d’avant — marge comprise — reviennent de la base', async () => {
  const etat = { t: DEPART }
  const { sante, releve, db } = await uneSante(etat)
  try {
    const { lignes, demarrages } = ecrireLaSemaine(db, etat.t)
    await sante.page('7j')
    const premiere = etat.t
    // Une heure finie, changée derrière le dos du serveur sans dire quand : aucun relevé n'écrit ainsi, et elle ne se relit pas.
    const finie = lignes[10]
    ecrireUneHeure(db, finie.heure, finie.demarrage, { ...releveDe(finie.demarrage), routes: { n: 50, p50: 80, p95: 999, max: 999 } }, finie.heure + H - 1)
    etat.t += MINUTE + 1_000
    // L'heure d'avant, récrite comme le relevé l'écrit — à l'heure qu'il est.
    const recrite = lignes.at(-1)!
    const recriteNeuve = { ...recrite, routes: { n: 60, p50: 90, p95: 777, max: 800 } }
    ecrireUneHeure(db, recrite.heure, recrite.demarrage, { ...releveDe(recrite.demarrage), routes: recriteNeuve.routes }, etat.t)
    // Préparée cinq minutes avant la première lecture, posée après elle — la file d'un démarrage qui s'éteint, un Turso lent.
    const attardee = lignes.at(-2)!
    const attardeeNeuve = { ...attardee, routes: { n: 70, p50: 95, p95: 555, max: 600 } }
    ecrireUneHeure(db, attardee.heure, attardee.demarrage, { ...releveDe(attardee.demarrage), routes: attardeeNeuve.routes }, premiere - 5 * MINUTE)
    remettre()
    const page = await sante.page('7j')
    assert.deepEqual(lus, { lectures: 1, lignes: 2 }, 'une lecture, et les deux lignes récrites — pas la semaine')
    const attendues = lignes.map(l => (l === recrite ? recriteNeuve : l === attardee ? attardeeNeuve : l))
    assert.deepEqual(page, pageDuServeur([...attendues, ...releve.lignes(sante.id)], demarrages, { maintenant: etat.t, courant: provisoire(sante.id, etat.t) }))
  } finally {
    db.close()
    await sante.arreter()
  }
})

test('une remise à jour en route s’attend : derrière une base lente, la première lecture ne se fait pas deux fois', async () => {
  const etat = { t: DEPART }
  const { sante, db } = await uneSante(etat)
  try {
    const { lignes } = ecrireLaSemaine(db, etat.t)
    remettre()
    const premiere = sante.page('7j')
    // La minute passe pendant la lecture : la page suivante l'attend, et n'en lance pas une seconde dessous.
    etat.t += MINUTE + 1_000
    await Promise.all([premiere, sante.page('7j'), sante.versions()])
    assert.equal(lus.lignes, lignes.length, 'la semaine lue une fois')
  } finally {
    db.close()
    await sante.arreter()
  }
})

test('les règles des alertes lisent les versions de la semaine sans la page : celles que la page montre', async () => {
  const etat = { t: DEPART }
  const { sante, db } = await uneSante(etat)
  try {
    ecrireLaSemaine(db, etat.t)
    const versions = await sante.versions()
    assert.deepEqual(
      versions.map(v => [v.version, v.ralenties.map(r => [r.route, r.avant, r.apres])]),
      [
        ['bbbbbbb', [['GET /api/jour', 100, 300]]],
        ['aaaaaaa', []],
      ],
    )
    assert.deepEqual(versions, (await sante.page('7j')).versions)
  } finally {
    db.close()
    await sante.arreter()
  }
})

test('à zéro, la semaine se relit en entier à chaque fois : un rendu qui l’écrit sous le serveur, à des dates d’avant, la voit', async () => {
  const etat = { t: DEPART }
  const { sante, releve, db } = await uneSante(etat, 0)
  try {
    const { lignes, demarrages } = ecrireLaSemaine(db, etat.t)
    await sante.page('7j')
    const changee = lignes[10]
    const changeeNeuve = { ...changee, routes: { n: 50, p50: 80, p95: 999, max: 999 } }
    ecrireUneHeure(db, changee.heure, changee.demarrage, { ...releveDe(changee.demarrage), routes: changeeNeuve.routes }, changee.heure + H - 1)
    // Une seconde plus tard : l'horloge du rendu avance, et rien n'est gardé.
    etat.t += 1_000
    const page = await sante.page('7j')
    const attendues = lignes.map(l => (l === changee ? changeeNeuve : l))
    assert.deepEqual(page, pageDuServeur([...attendues, ...releve.lignes(sante.id)], demarrages, { maintenant: etat.t, courant: provisoire(sante.id, etat.t) }))
  } finally {
    db.close()
    await sante.arreter()
  }
})
