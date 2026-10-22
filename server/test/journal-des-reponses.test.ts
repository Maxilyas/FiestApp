// Le journal des réponses (`core/journalDesReponses.ts`) : ce que les lectures
// d'avant relisaient de toute l'histoire à chaque fois — la mesure des
// difficultés, le modèle du savoir, l'expérience, les écussons, L'Érudit, ce
// que chacun a vu, ses premières réponses, ses missions —, gardé en mémoire et
// lu par différence. Le 22 octobre 2026, ces relectures faisaient l'essentiel
// des 333 millions de lignes lues au quota de Turso.
//
// Chaque dérivation se compare ici au SQL d'avant, recopié tel qu'il était,
// sur une base tirée au hasard : tous les modes, des jokers, des formes, des
// reprises du carnet, des réponses sans série, des instants égaux. Et le
// journal se lit par petites tranches, des lectures en double et en retard
// comprises : une réponse ne compte qu'une fois. Le carnet se compare à la
// requête que la campagne garde pour un journal qui doute
// (`suivisDeLaBase`) : les défis de la semaine et d'avant, des duels
// ouverts, fermés, annulés ou inconnus, les cartes du second essai, des
// rébus et des frises — à l'heure de la base, puis une semaine plus tard.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createClient, type Client } from '@libsql/client'
import { baseDEssai } from './banc'
import { CampagneStore } from '../src/core/campagne'
import { FENETRE_DES_RECENTES_MS, JournalDesReponses, lectureDuJournal, lireLeJournal, type LectureDuJournal, type ReponseDuJournal } from '../src/core/journalDesReponses'
import { semaineDe } from '../../shared/campagne'
import { jourDe } from '../../shared/jour'
import type { SuiviDeRevision } from '../../shared/revision'

const MAINTENANT = Date.UTC(2026, 9, 22, 12)
const JOUR_MS = 24 * 3600_000
const HEURE_MS = 3600_000

// ── Le SQL d'avant, tel qu'il était le 22 octobre 2026 ──────────────────────

const PREMIERE = 'MIN(r.repondue_le * 4 + (r.joker IS NOT NULL OR r.forme IS NOT NULL) * 2 + r.juste)'
const PREMIERE_REPONSE = `CASE WHEN ${PREMIERE} % 4 >= 2 THEN NULL ELSE ${PREMIERE} % 2 END`
const HORS_DU_CARNET = "json_extract(s.questions, '$[' || r.position || '].carnet') IS NULL"
const REPONSE_NUE = `r.joker IS NULL AND r.forme IS NULL AND ${HORS_DU_CARNET}`

const AVANT = {
  vues: `SELECT json_group_object(reserve_id, json_array(le, juste)) AS vues FROM (
           SELECT r.reserve_id, MAX(r.repondue_le) AS le, ${PREMIERE_REPONSE} AS juste
           FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
           WHERE s.profile_id = ? GROUP BY r.reserve_id
         )`,
  premieres: `SELECT json_group_object(reserve_id, k) AS premieres FROM (
                SELECT r.reserve_id, ${PREMIERE} AS k
                FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
                WHERE s.profile_id = ? GROUP BY r.reserve_id
              )`,
  justes: `SELECT CAST(r.repondue_le / ${HEURE_MS} AS INTEGER) AS heure, COUNT(*) AS n
           FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
           WHERE s.profile_id = ? AND r.juste = 1 GROUP BY heure`,
  savoir: `SELECT categorie, COUNT(*) AS questions, COUNT(choix) AS repondues, SUM(juste) AS justes
           FROM (SELECT json_extract(s.questions, '$[' || r.position || '].categorie') AS categorie, r.choix AS choix, r.juste AS juste
                 FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
                 WHERE s.profile_id = ? AND s.mode <> 'revision' AND ${REPONSE_NUE}
                 LIMIT -1)
           GROUP BY categorie`,
  expertes: `SELECT COUNT(*) AS n FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
             WHERE s.profile_id = ? AND s.mode <> 'revision' AND ${REPONSE_NUE} AND r.juste = 1 AND json_extract(s.questions, '$[' || r.position || '].niveau') = 'expert'`,
  recentes: `SELECT r.serie_id AS serie, s.mode AS mode, r.juste AS juste, r.repondue_le AS le,
                    CASE WHEN ${HORS_DU_CARNET} THEN json_extract(s.questions, '$[' || r.position || '].categorie') END AS categorie
             FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
             WHERE s.profile_id = ? AND s.commencee_le >= ? AND r.repondue_le >= ? AND r.choix IS NOT NULL
             LIMIT -1`,
  savoirDeTous: `SELECT profile_id, json_group_object(reserve_id, juste) AS premieres FROM (
                   SELECT s.profile_id AS profile_id, r.reserve_id AS reserve_id, ${PREMIERE_REPONSE} AS juste
                   FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
                   GROUP BY s.profile_id, r.reserve_id
                 ) WHERE juste IS NOT NULL GROUP BY profile_id`,
  brutes: `SELECT json_group_array(json_array(reserve_id, justes, total)) AS mesures FROM (
             SELECT reserve_id, SUM(juste) AS justes, COUNT(*) AS total FROM campagne_reponses
             WHERE serie_id NOT IN (SELECT id FROM campagne_series WHERE mode = 'revision')
               AND joker IS NULL AND forme IS NULL
               AND serie_id || ':' || position NOT IN (
                 SELECT e.id || ':' || j.key FROM campagne_series e, json_each(e.questions) j
                 WHERE e.mode = 'expedition' AND json_extract(j.value, '$.carnet') = 1
               )
             GROUP BY reserve_id
           )`,
  premieresDeLaMesure: `SELECT json_group_array(json_array(reserve_id, justes, total)) AS mesures FROM (
                          SELECT reserve_id, SUM(juste) AS justes, COUNT(*) AS total FROM (
                            SELECT r.reserve_id AS reserve_id, ${PREMIERE_REPONSE} AS juste
                            FROM campagne_reponses r LEFT JOIN campagne_series s ON s.id = r.serie_id
                            WHERE COALESCE(s.mode, 'serie') <> 'revision'
                            GROUP BY COALESCE(s.profile_id, r.serie_id), r.reserve_id
                          ) WHERE juste IS NOT NULL GROUP BY reserve_id
                        )`,
}

const objet = (texte: unknown) => (typeof texte === 'string' ? (JSON.parse(texte) as Record<string, unknown>) : {})
const comptesLus = (texte: unknown) => {
  const lus = new Map<string, { justes: number; total: number }>()
  if (typeof texte === 'string') for (const [id, justes, total] of JSON.parse(texte) as [unknown, unknown, unknown][]) lus.set(String(id), { justes: Number(justes), total: Number(total) })
  return lus
}

// ── Une base au hasard ──────────────────────────────────────────────────────

function hasardDe(graine: number) {
  let g = graine
  return () => (g = (g * 16807) % 2147483647) / 2147483647
}

const MODES = ['serie', 'serie', 'revision', 'sentier', 'rencontre', 'defi', 'duel', 'expedition', 'sujet']
const CATEGORIES = ['Histoire', 'Sport', 'Musique', 'Cuisine']
const NIVEAUX = ['facile', 'moyen', 'difficile', 'expert']
// « parade » et « bastion » : des cartes du second essai, que le carnet tient pour ratées.
const JOKERS = ['parade', 'cinquante', 'indice', 'bastion']
const FORMES = ['vrai-faux', 'six', 'devoilement', '']
/** Le lundi d'un défi : celui de la semaine qui court à `MAINTENANT` — le jeudi 22 octobre 2026 —, deux d'avant, et pas de semaine. */
const SEMAINES = ['2026-10-19', '2026-10-12', '2026-10-05', null]
/** Les duels : ouverts à `MAINTENANT`, fermé, et un que la table n'a pas. */
const DUELS = [
  { code: 'duel-ouvert', fermeLe: MAINTENANT + 2 * JOUR_MS },
  { code: 'duel-ferme', fermeLe: MAINTENANT - JOUR_MS },
  { code: 'duel-bientot', fermeLe: MAINTENANT + 3 * HEURE_MS },
  { code: 'duel-inconnu', fermeLe: null },
]

/** Une question : de la base, le plus souvent ; parfois un rébus ou une frise, que le carnet écarte. */
function questionAuHasard(hasard: () => number): string {
  const h = hasard()
  if (h < 0.03) return `rebus:${Math.floor(hasard() * 3)}`
  if (h < 0.06) return `frise:r1|r2|r3|r${Math.floor(hasard() * 3)}`
  return `r${Math.floor(hasard() * 45)}`
}

/**
 * Des séries de chaque mode, commencées entre `debut` et `fin`, leurs
 * réponses — écrites dans l'ordre du temps, comme le serveur les écrit — et
 * des réponses sans série, comme un test qui les écrit à la main.
 */
function remplir(fichier: string, hasard: () => number, { series: nombre, depart, debut, fin }: { series: number; depart: number; debut: number; fin: number }) {
  const db = new Database(fichier)
  try {
    const serie = db.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, semaine, duel) VALUES (?, ?, ?, 0, 3, 0, ?, NULL, ?, ?, ?)`,
    )
    const reponse = db.prepare(`INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, joker, forme) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    const duel = db.prepare(`INSERT OR IGNORE INTO campagne_duels (code, auteur, questions, cree_le, ferme_le) VALUES (?, 'p0', '[]', ?, ?)`)
    const tire = <T>(liste: readonly T[]) => liste[Math.floor(hasard() * liste.length)]
    const reponses: [string, number, string, number | null, number, number, string | null, string | null][] = []
    db.transaction(() => {
      for (const d of DUELS) if (d.fermeLe !== null) duel.run(d.code, d.fermeLe - 7 * JOUR_MS, d.fermeLe)
      for (let k = 0; k < nombre; k++) {
        const id = `s${depart + k}`
        const mode = tire(MODES)
        const commencee = debut + Math.floor(hasard() * (fin - debut))
        const questions = Array.from({ length: 12 }, (_, p) => ({
          id: `q${p}`,
          ...(hasard() < 0.9 && { categorie: tire(CATEGORIES) }),
          niveau: tire(NIVEAUX),
          // Les reprises du carnet : à l'expédition, et quelques autres valeurs, que les lectures d'avant distinguaient.
          ...(mode === 'expedition' && hasard() < 0.4 && { carnet: hasard() < 0.7 ? true : 1 }),
          ...(mode !== 'expedition' && hasard() < 0.03 && { carnet: 2 }),
        }))
        serie.run(id, `p${Math.floor(hasard() * 7)}`, JSON.stringify(questions), commencee, mode, mode === 'defi' ? tire(SEMAINES) : null, mode === 'duel' ? tire(DUELS).code : null)
        const combien = Math.floor(hasard() * 12)
        let le = commencee
        for (let p = 0; p < combien; p++) {
          // Des instants égaux, parfois : la première réponse se départage alors par son aide, puis par sa justesse.
          if (hasard() < 0.85) le += Math.floor(hasard() * 40 * 60_000)
          if (le > MAINTENANT) break
          const aide = hasard()
          reponses.push([
            id,
            p,
            questionAuHasard(hasard),
            hasard() < 0.1 ? null : Math.floor(hasard() * 4),
            hasard() < 0.6 ? 1 : 0,
            le,
            aide < 0.1 ? tire(JOKERS) : null,
            aide > 0.9 ? tire(FORMES) : null,
          ])
        }
      }
      // Dans l'ordre du temps, comme les écrit le serveur : chaque joueur répond l'une après l'autre.
      for (const r of reponses.sort((a, b) => a[5] - b[5])) reponse.run(...r)
      // Sans série : leur profil est la série même (`COALESCE(profile_id, serie_id)`), et elles ne sont pas une révision.
      for (let k = 0; k < 15; k++) reponse.run(`orpheline${k % 4}`, depart + k, `r${Math.floor(hasard() * 45)}`, 0, hasard() < 0.5 ? 1 : 0, MAINTENANT - Math.floor(hasard() * 5 * JOUR_MS), null, null)
    })()
  } finally {
    db.close()
  }
}

/** Ce que le journal lit, par tranches de `limite` : toute la base d'abord, puis ce qui arrive. */
async function lire(client: Client, journal: JournalDesReponses, limite: number): Promise<LectureDuJournal[]> {
  const lues: LectureDuJournal[] = []
  for (;;) {
    const lu = lireLeJournal((await client.execute(lectureDuJournal(journal.jusqua, limite))).rows[0], limite)
    lues.push(lu)
    journal.appliquer(lu)
    if (!lu.aSuivre) return lues
  }
}

async function comparer(client: Client, journal: JournalDesReponses, profils: readonly string[], nom: string) {
  for (const p of profils) {
    // Ce qu'il a vu, et sa première réponse à chacune (`lireLesVues`).
    const vues = objet((await client.execute({ sql: AVANT.vues, args: [p] })).rows[0]?.vues)
    const attendues = { vues: new Map<string, number>(), premieres: new Map<string, boolean>() }
    for (const [id, valeur] of Object.entries(vues)) {
      if (!Array.isArray(valeur)) continue
      attendues.vues.set(id, Number(valeur[0]))
      if (valeur[1] !== null) attendues.premieres.set(id, Number(valeur[1]) === 1)
    }
    assert.deepEqual(journal.vuesDe(p), attendues, `${nom} · ${p} : ce qu’il a vu`)
    // Ses premières réponses, avec leur instant (`lireLesPremieres`).
    const premieres = new Map<string, { le: number; juste: boolean }>()
    for (const [id, k] of Object.entries(objet((await client.execute({ sql: AVANT.premieres, args: [p] })).rows[0]?.premieres))) {
      const n = Number(k)
      if (Number.isFinite(n) && Math.floor(n / 2) % 2 === 0) premieres.set(id, { le: Math.floor(n / 4), juste: n % 2 === 1 })
    }
    assert.deepEqual(journal.premieresDe(p), premieres, `${nom} · ${p} : ses premières réponses`)
    // Ses bonnes réponses, heure par heure.
    const justes = new Map((await client.execute({ sql: AVANT.justes, args: [p] })).rows.map(r => [Number(r.heure), Number(r.n)]))
    assert.deepEqual(new Map(journal.justesParHeureDe(p)), justes, `${nom} · ${p} : ses bonnes réponses, heure par heure`)
    // Ses écussons, et ses expertes.
    const savoir = (await client.execute({ sql: AVANT.savoir, args: [p] })).rows.map(r => ({
      categorie: r.categorie === null ? null : String(r.categorie),
      questions: Number(r.questions),
      repondues: Number(r.repondues),
      justes: Number(r.justes),
    }))
    const parCategorie = (l: { categorie: string | null }) => String(l.categorie)
    assert.deepEqual(
      [...journal.savoirDe(p)].sort((a, b) => parCategorie(a).localeCompare(parCategorie(b))),
      savoir.sort((a, b) => parCategorie(a).localeCompare(parCategorie(b))),
      `${nom} · ${p} : ses écussons`,
    )
    assert.equal(journal.expertesDe(p), Number((await client.execute({ sql: AVANT.expertes, args: [p] })).rows[0]?.n ?? 0), `${nom} · ${p} : ses expertes`)
    // Ses missions, depuis le lundi d'il y a deux semaines.
    const depuis = MAINTENANT - 13 * JOUR_MS
    const commencees = depuis - 7 * JOUR_MS
    const recentes = (await client.execute({ sql: AVANT.recentes, args: [p, commencees, depuis] })).rows.map(r => ({
      serie: String(r.serie),
      mode: String(r.mode ?? 'serie'),
      juste: Number(r.juste) === 1,
      le: Number(r.le),
      categorie: r.categorie == null ? null : String(r.categorie),
    }))
    const ordre = (a: { serie: string; le: number }, b: { serie: string; le: number }) => a.serie.localeCompare(b.serie) || a.le - b.le
    assert.deepEqual(
      journal
        .recentesDe(p, depuis, commencees)
        .map(r => ({ serie: r.serie, mode: r.mode, juste: r.juste, le: r.le, categorie: r.categorie }))
        .sort(ordre),
      recentes.sort(ordre),
      `${nom} · ${p} : ses réponses des missions`,
    )
  }
  // Le modèle du savoir : les premières réponses de tous.
  const deTous = new Map((await client.execute(AVANT.savoirDeTous)).rows.map(r => [String(r.profile_id), new Map(Object.entries(objet(r.premieres)).map(([id, j]) => [id, Number(j) === 1]))]))
  assert.deepEqual(new Map(journal.joueurs().map(p => [p, journal.premieresJustesDe(p)]).filter(([, m]) => (m as Map<string, boolean>).size > 0) as [string, Map<string, boolean>][]), deTous, `${nom} : les premières réponses de tous`)
  // La mesure des difficultés.
  const [brutes, premieres] = await client.batch([AVANT.brutes, AVANT.premieresDeLaMesure], 'read')
  const mesures = journal.mesures()
  assert.deepEqual(mesures.brutes, comptesLus(brutes.rows[0]?.mesures), `${nom} : la mesure, réponse par réponse`)
  assert.deepEqual(mesures.premieres, comptesLus(premieres.rows[0]?.mesures), `${nom} : la mesure, première réponse par première réponse`)
}

/** Le carnet de chacun, au journal et à la requête que la campagne garde quand il doute, à l'heure de la campagne : rend combien de questions il compte en tout. */
async function comparerLesCarnets(campagne: CampagneStore, journal: JournalDesReponses, profils: readonly string[], maintenant: number, nom: string): Promise<number> {
  const deLaBase = (campagne as unknown as { suivisDeLaBase(qui: string): Promise<Map<string, SuiviDeRevision>> }).suivisDeLaBase.bind(campagne)
  let questions = 0
  for (const p of profils) {
    const attendu = await deLaBase(p)
    questions += attendu.size
    assert.deepEqual(journal.carnetDe(p, semaineDe(jourDe(maintenant)), maintenant), attendu, `${nom} · ${p} : son carnet`)
  }
  return questions
}

/** Une réponse telle que le journal la lit, pour les épreuves qui la posent à la main. */
const reponseDuJournal = (r: Pick<ReponseDuJournal, 'n' | 'question' | 'juste' | 'le'> & Partial<ReponseDuJournal>): ReponseDuJournal => ({
  qui: 'p',
  serie: 's',
  repondue: true,
  aidee: false,
  joker: null,
  forme: null,
  mode: 'serie',
  commencee: r.le,
  semaine: null,
  duel: null,
  fermeLe: null,
  carnet: null,
  categorie: 'Sport',
  niveau: 'facile',
  ...r,
})

test('le journal dit ce que disaient les lectures d’avant — toute la base lue par tranches, puis ce qui arrive, lu par différence', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-journal-'))
  const fichier = path.join(dir, 'permanente.db')
  const url = `file:${fichier.replace(/\\/g, '/')}`
  // Les tables, telles que la campagne les crée.
  const horloge = { t: MAINTENANT }
  const campagne = new CampagneStore(url, undefined, { base: baseDEssai(30), maintenant: () => horloge.t })
  const client = createClient({ url })
  try {
    await campagne.init()
    const hasard = hasardDe(41)
    remplir(fichier, hasard, { series: 160, depart: 0, debut: MAINTENANT - 24 * JOUR_MS, fin: MAINTENANT - 7 * JOUR_MS })
    const journal = new JournalDesReponses(() => MAINTENANT)
    const premieres = await lire(client, journal, 37)
    assert.ok(premieres.length > 5, 'lu en plusieurs tranches')
    const profils = Array.from({ length: 7 }, (_, i) => `p${i}`)
    await comparer(client, journal, profils, 'la base entière')
    assert.ok(journal.reponses > 500, `${journal.reponses} réponses lues`)
    const auCarnet = await comparerLesCarnets(campagne, journal, profils, horloge.t, 'la base entière')
    assert.ok(auCarnet > 50, `${auCarnet} questions aux carnets`)

    // Ce qui arrive ensuite, lu par différence ; une lecture en double, et une en retard sur une plus récente, ne comptent rien de plus.
    remplir(fichier, hasard, { series: 40, depart: 160, debut: MAINTENANT - 6 * JOUR_MS, fin: MAINTENANT })
    const avant = journal.jusqua
    const enRetard = lireLeJournal((await client.execute(lectureDuJournal(avant, 10))).rows[0], 10)
    const toutes = await lire(client, journal, 1000)
    journal.appliquer(toutes[0])
    journal.appliquer(enRetard)
    await comparer(client, journal, profils, 'après une lecture par différence')
    await comparerLesCarnets(campagne, journal, profils, horloge.t, 'après une lecture par différence')

    // Rien de neuf : la lecture ne rapporte rien, et le journal ne bouge pas.
    const rien = lireLeJournal((await client.execute(lectureDuJournal(journal.jusqua))).rows[0])
    assert.deepEqual([rien.reponses.length, rien.jusqua, rien.aSuivre], [0, 0, false])
    journal.appliquer(rien)
    await comparer(client, journal, profils, 'après une lecture vide')

    // Un duel annulé par l'administrateur (`annulerUnDuel`) : fermé tout de suite, ses réponses rejoignent le carnet.
    const db = new Database(fichier)
    try {
      db.prepare('UPDATE campagne_duels SET ferme_le = ? WHERE code = ?').run(MAINTENANT - 1, 'duel-ouvert')
    } finally {
      db.close()
    }
    journal.fermerLeDuel('duel-ouvert', MAINTENANT - 1)
    await comparerLesCarnets(campagne, journal, profils, horloge.t, 'un duel annulé')
    // Une semaine plus tard : le défi de la semaine est clos, les duels fermés — leurs réponses comptent.
    horloge.t = MAINTENANT + 8 * JOUR_MS
    await comparerLesCarnets(campagne, journal, profils, horloge.t, 'une semaine plus tard')
  } finally {
    client.close()
    campagne.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('ses réponses récentes ne remontent pas plus loin que la fenêtre des missions, et s’oublient en sortant', () => {
  const horloge = { t: MAINTENANT }
  const journal = new JournalDesReponses(() => horloge.t)
  const reponse = (n: number, le: number) => reponseDuJournal({ n, question: `q${n}`, juste: true, le })
  journal.appliquer({ reponses: [reponse(1, MAINTENANT - FENETRE_DES_RECENTES_MS - 1), reponse(2, MAINTENANT - 3 * JOUR_MS), reponse(3, MAINTENANT)], jusqua: 3, aSuivre: false })
  assert.deepEqual(
    journal.recentesDe('p', 0, 0).map(r => r.le),
    [MAINTENANT - 3 * JOUR_MS, MAINTENANT],
    'une réponse sortie de la fenêtre à sa lecture n’y entre pas',
  )
  horloge.t += FENETRE_DES_RECENTES_MS - 2 * JOUR_MS
  assert.deepEqual(journal.recentesDe('p', 0, 0).map(r => r.le), [MAINTENANT], 'sortie de la fenêtre, elle s’oublie')
  assert.equal(journal.reponses, 3, 'mais le reste du journal la garde')
})

test('le carnet ne garde que ce qui suit la dernière erreur ; une réponse arrivée dans le désordre le fait relire de la base', () => {
  const journal = new JournalDesReponses(() => MAINTENANT)
  const semaine = semaineDe(jourDe(MAINTENANT))
  const prive = journal as unknown as { dossiers: Map<string, { carnet: Map<string, { passages: unknown[] }> }> }
  journal.appliquer({
    reponses: [
      reponseDuJournal({ n: 1, question: 'q1', juste: false, le: MAINTENANT - 9 * JOUR_MS }),
      reponseDuJournal({ n: 2, question: 'q1', juste: true, le: MAINTENANT - 8 * JOUR_MS }),
      reponseDuJournal({ n: 3, question: 'q1', juste: false, le: MAINTENANT - 4 * JOUR_MS }),
      reponseDuJournal({ n: 4, question: 'q1', juste: true, le: MAINTENANT - 3 * JOUR_MS }),
      // Jamais ratée : rien au carnet.
      reponseDuJournal({ n: 5, question: 'q2', juste: true, le: MAINTENANT - 2 * JOUR_MS }),
      reponseDuJournal({ n: 6, qui: 'autre', question: 'q1', juste: false, le: MAINTENANT - JOUR_MS }),
    ],
    jusqua: 6,
    aSuivre: false,
  })
  assert.equal(prive.dossiers.get('p')!.carnet.get('q1')!.passages.length, 2, 'la seconde erreur et ce qui la suit : le reste ne change plus rien')
  assert.deepEqual([...journal.carnetDe('p', semaine, MAINTENANT)!.keys()], ['q1'])
  assert.deepEqual(journal.carnetDe('p', semaine, MAINTENANT)!.get('q1'), { apprise: false, etape: 1, revientLe: jourDe(MAINTENANT) }, 'retrouvée le lendemain de sa dernière erreur : à revoir dans trois jours')
  // Une erreur lue après une bonne réponse plus récente à la même question : ce qu'on n'a pas gardé de q2 compterait.
  journal.appliquer({ reponses: [reponseDuJournal({ n: 7, question: 'q2', juste: false, le: MAINTENANT - 5 * JOUR_MS })], jusqua: 7, aSuivre: false })
  assert.equal(journal.carnetDe('p', semaine, MAINTENANT), null, 'son carnet se relit de la base')
  assert.equal(journal.carnetDe('autre', semaine, MAINTENANT)?.size, 1, 'les autres gardent le leur')
})
