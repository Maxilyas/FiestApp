// Le journal des réponses (`core/journalDesReponses.ts`) : ce que les lectures
// d'avant relisaient de toute l'histoire à chaque fois — la mesure des
// difficultés, le modèle du savoir, l'expérience, les écussons, L'Érudit, ce
// que chacun a vu, ses premières réponses, ses missions —, gardé en mémoire et
// lu par différence. Le 22 octobre 2026, ces relectures faisaient l'essentiel
// des 333 millions de lignes lues au quota de Turso.
//
// Chaque dérivation se compare ici au SQL d'avant, recopié tel qu'il était,
// sur une base tirée au hasard : tous les modes, des jokers, des formes, des
// reprises du carnet, des réponses sans série, des instants égaux. Ce qu'il a
// vu s'y compare déplié : une pièce du Cabinet qui a montré des questions de
// la base — une manche de l'Éclair, un tableau du Détail, une frise d'un
// sujet — les compte vues à son heure, depuis la tablée du 25 octobre 2026 ;
// ses premières réponses, elles, restent celles du SQL d'avant. Et le
// journal se lit par petites tranches, des lectures en double et en retard
// comprises : une réponse ne compte qu'une fois. Le carnet se compare à la
// requête que la campagne garde pour un journal qui doute
// (`suivisDeLaBase`) : les défis de la semaine et d'avant, des duels
// ouverts, fermés, annulés ou inconnus, les cartes du second essai, des
// rébus, des frises et des pièces du Cabinet, qu'aucun des deux ne garde
// (`PREFIXES_HORS_DE_LA_BASE`) — à l'heure de la base, puis une semaine plus
// tard.
//
// Puis ses tranches gardées (`campagne_tranches`) : un réveil les relit au
// lieu de toute la base, et dit encore ce que dit le SQL d'avant — un duel
// annulé depuis qu'elles ont été écrites, une tranche égarée, une illisible,
// une d'une lecture d'avant ; une réponse effacée les efface toutes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createClient, type Client, type InStatement, type TransactionMode } from '@libsql/client'
import { baseDEssai } from './banc'
import { CampagneStore } from '../src/core/campagne'
import { tableauxDuDetail } from '../src/core/details'
import {
  FENETRE_DES_RECENTES_MS,
  JournalDesReponses,
  VERSION_DES_TRANCHES,
  lectureDuJournal,
  lireLeJournal,
  type LectureDuJournal,
  type ReponseDuJournal,
} from '../src/core/journalDesReponses'
import { semaineDe } from '../../shared/campagne'
import { idDeLEclair, idDeLaFiche, idDeLaFriseATheme, idDeLaFriseDeSujet, idDeLaReplique, idDuLieu, idDuTableau } from '../../shared/cabinet/pieces'
import { PREFIXES_HORS_DE_LA_BASE, horsDeLaBase, sqlDansLaBase } from '../../shared/horsDeLaBase'
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
  // Celui-ci tel qu'il était le 23 octobre 2026 : 38 % du quota de Turso à lui seul.
  compagnons: `SELECT r.compagnon AS compagnon, COUNT(*) AS n
               FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
               WHERE s.profile_id = ? AND r.juste = 1 AND r.compagnon IS NOT NULL
               GROUP BY r.compagnon`,
  // Les leurres que la campagne choisit, nés au journal le 26 octobre 2026 (`leurresChoisis`) — sans SQL d'avant, écrits ici
  // à part : sur les réponses de la mesure, la mauvaise choisie en texte, telle que sa série l'a posée, hors des pièces qui
  // ne sont pas de la base. `IS 1` et non `= 1` : une reprise du carnet absente rendrait toute la condition nulle.
  leurres: `SELECT r.reserve_id AS question, json_extract(s.questions, '$[' || r.position || '].reponses[' || r.choix || ']') AS choisie, COUNT(*) AS n
            FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
            WHERE s.mode <> 'revision' AND r.joker IS NULL AND r.forme IS NULL AND r.juste = 0 AND r.choix >= 0
              AND NOT (s.mode = 'expedition' AND json_extract(s.questions, '$[' || r.position || '].carnet') IS 1)
              AND ${sqlDansLaBase('r.reserve_id')}
            GROUP BY question, choisie HAVING typeof(choisie) = 'text'`,
  // Et celui-ci tel qu'il était le 24 octobre 2026 : 150 000 lignes pour une page du QG.
  epreuves: (branche: boolean) => `SELECT s.palier AS palier, json_extract(q.value, '$.niveau') AS niveau, COUNT(*) AS n, SUM(r.juste) AS justes
             FROM campagne_series s CROSS JOIN json_each(s.questions) q
             JOIN campagne_reponses r ON r.serie_id = s.id AND r.position = q.key
             WHERE s.mode = 'sentier' AND s.rejeu = 0 AND s.commencee_le > ?${branche ? ' AND s.branche = ?' : ''}
             GROUP BY s.palier, niveau`,
}

/**
 * Ce qu'il a vu, tel que le SQL d'avant le lisait, puis déplié : chaque pièce du Cabinet qui a montré des questions de la
 * base les compte vues à son heure, la plus récente l'emportant. Une manche de l'Éclair, ses cinq questions ; une frise d'un
 * sujet, les questions de ses nouveaux venus ; un tableau du Détail, les questions de la base qui le demandent — le
 * catalogue livré. Un lieu, une fiche, une réplique, une frise à thème n'ont rien de la base. La règle s'écrit ici à part,
 * sur les identifiants mêmes : le test ne relit pas le code qu'il éprouve. `sortes` apprend celles dont le dépli a changé
 * quelque chose.
 */
function deplieesAvant(lues: ReadonlyMap<string, number>, sortes: Set<string>): Map<string, number> {
  const depliees = new Map(lues)
  for (const [id, le] of lues) {
    const composee = /^cab:(eclair|frise:s):(.+)$/.exec(id)
    const tableau = /^cab:tableau:(Q\d+)$/.exec(id)
    const questions = composee ? composee[2].split('+') : tableau ? (tableauxDuDetail().find(t => t.qid === tableau[1])?.questions ?? []) : []
    for (const q of questions) {
      if ((depliees.get(q) ?? -Infinity) >= le) continue
      depliees.set(q, le)
      // La sorte de pièce dont le dépli a ajouté ou rajeuni une vue : sans aucune, l'égalité ne prouverait rien.
      sortes.add(composee ? composee[1] : 'tableau')
    }
  }
  return depliees
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

const MODES = ['serie', 'serie', 'revision', 'sentier', 'rencontre', 'defi', 'duel', 'expedition', 'sujet', 'cabinet']
const CATEGORIES = ['Histoire', 'Sport', 'Musique', 'Cuisine']
/** Les sentiers d'une épreuve ; un parcours de thème (`sujet`) a un palier, pas de branche. */
const BRANCHES = ['foret', 'ocean', 'cosmos']
const NIVEAUX = ['facile', 'moyen', 'difficile', 'expert']
// « parade » et « bastion » : des cartes du second essai, que le carnet tient pour ratées.
const JOKERS = ['parade', 'cinquante', 'indice', 'bastion']
const FORMES = ['vrai-faux', 'six', 'devoilement', '']
/** Le compagnon de sa niche quand il a répondu : souvent aucun. */
const COMPAGNONS = [null, null, 'loup', 'chat', 'tortue']
/** Le lundi d'un défi : celui de la semaine qui court à `MAINTENANT` — le jeudi 22 octobre 2026 —, deux d'avant, et pas de semaine. */
const SEMAINES = ['2026-10-19', '2026-10-12', '2026-10-05', null]
/** Les duels : ouverts à `MAINTENANT`, fermé, et un que la table n'a pas. */
const DUELS = [
  { code: 'duel-ouvert', fermeLe: MAINTENANT + 2 * JOUR_MS },
  { code: 'duel-ferme', fermeLe: MAINTENANT - JOUR_MS },
  { code: 'duel-bientot', fermeLe: MAINTENANT + 3 * HEURE_MS },
  { code: 'duel-inconnu', fermeLe: null },
]

/**
 * Ce que le Cabinet ne tire pas de la base, chaque sorte sous le nom qu'il lui
 * donne — l'Éclair et la frise d'un sujet portent des questions de la base
 * dans leur identifiant, qui n'en restent pas moins hors du carnet : les unes
 * répondues ailleurs aussi (`r1`), les autres jamais (`e4`), que seul le dépli
 * fait voir. Le tableau, la Joconde : la fiche livrée dit ses questions.
 */
const DU_CABINET = [
  idDuLieu('orleans-siege'),
  idDeLaFiche('victor-hugo'),
  idDeLaReplique('hotel-du-nord'),
  idDuTableau('Q12418'),
  idDeLEclair(['r1', 'r2', 'r3', 'e4', 'e5']),
  idDeLaFriseATheme('grands-sieges', 1),
  idDeLaFriseDeSujet(['r6', 'f7']),
]

/** Une question : de la base, le plus souvent ; parfois un rébus, une frise ou une pièce du Cabinet, que le carnet écarte. */
function questionAuHasard(hasard: () => number): string {
  const h = hasard()
  if (h < 0.03) return `rebus:${Math.floor(hasard() * 3)}`
  if (h < 0.06) return `frise:r1|r2|r3|r${Math.floor(hasard() * 3)}`
  if (h < 0.09) return DU_CABINET[Math.floor(hasard() * DU_CABINET.length)]
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
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, semaine, duel, branche, palier, rejeu)
       VALUES (?, ?, ?, 0, 3, 0, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    )
    const reponse = db.prepare(`INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, joker, forme, compagnon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    const duel = db.prepare(`INSERT OR IGNORE INTO campagne_duels (code, auteur, questions, cree_le, ferme_le) VALUES (?, 'p0', '[]', ?, ?)`)
    const tire = <T>(liste: readonly T[]) => liste[Math.floor(hasard() * liste.length)]
    const reponses: [string, number, string, number | null, number, number, string | null, string | null, string | null][] = []
    db.transaction(() => {
      for (const d of DUELS) if (d.fermeLe !== null) duel.run(d.code, d.fermeLe - 7 * JOUR_MS, d.fermeLe)
      for (let k = 0; k < nombre; k++) {
        const id = `s${depart + k}`
        const mode = tire(MODES)
        const commencee = debut + Math.floor(hasard() * (fin - debut))
        const questions = Array.from({ length: 12 }, (_, p) => ({
          id: `q${p}`,
          ...(hasard() < 0.9 && { categorie: tire(CATEGORIES) }),
          // Une question sans marche, parfois : les lectures d'avant la lisaient nulle.
          ...(hasard() < 0.95 && { niveau: tire(NIVEAUX) }),
          // Les reprises du carnet : à l'expédition, et quelques autres valeurs, que les lectures d'avant distinguaient.
          ...(mode === 'expedition' && hasard() < 0.4 && { carnet: hasard() < 0.7 ? true : 1 }),
          ...(mode !== 'expedition' && hasard() < 0.03 && { carnet: 2 }),
          // Ses réponses, telles que la série les a posées — trois mauvaises qui reviennent d'une série à l'autre, pour que
          // les leurres se comptent ; une question sans réponses, une autre aux réponses qui ne sont pas des textes. Rien
          // n'y tire le hasard : la base d'avant reste la même.
          ...(p < 10 && { reponses: [`bonne ${p % 5}`, `leurre ${p % 3}`, `autre ${p % 2}`, `encore ${p % 4}`] }),
          ...(p === 11 && { reponses: [1, 2, 3, 4] }),
        }))
        // Une épreuve des sentiers ou d'un parcours : son palier, et parfois un rejeu, que l'administration des sentiers écarte.
        const epreuve = mode === 'sentier' || mode === 'sujet'
        serie.run(
          id,
          `p${Math.floor(hasard() * 7)}`,
          JSON.stringify(questions),
          commencee,
          mode,
          mode === 'defi' ? tire(SEMAINES) : null,
          mode === 'duel' ? tire(DUELS).code : null,
          mode === 'sentier' ? tire(BRANCHES) : null,
          epreuve ? 1 + Math.floor(hasard() * 12) : null,
          epreuve && hasard() < 0.3 ? 1 : 0,
        )
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
            tire(COMPAGNONS),
          ])
        }
      }
      // Dans l'ordre du temps, comme les écrit le serveur : chaque joueur répond l'une après l'autre.
      for (const r of reponses.sort((a, b) => a[5] - b[5])) reponse.run(...r)
      // Sans série : leur profil est la série même (`COALESCE(profile_id, serie_id)`), et elles ne sont pas une révision.
      for (let k = 0; k < 15; k++) reponse.run(`orpheline${k % 4}`, depart + k, `r${Math.floor(hasard() * 45)}`, 0, hasard() < 0.5 ? 1 : 0, MAINTENANT - Math.floor(hasard() * 5 * JOUR_MS), null, null, tire(COMPAGNONS))
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

/** Chaque dérivation du journal contre le SQL d'avant : rend les sortes de pièces dont le dépli a ajouté ou rajeuni une vue. */
async function comparer(client: Client, journal: JournalDesReponses, profils: readonly string[], nom: string): Promise<Set<string>> {
  const depliees = new Set<string>()
  for (const p of profils) {
    // Ce qu'il a vu, déplié, et sa première réponse à chacune, telle quelle (`lireLesVues`).
    const vues = objet((await client.execute({ sql: AVANT.vues, args: [p] })).rows[0]?.vues)
    const lues = new Map<string, number>()
    const attendues = { vues: new Map<string, number>(), premieres: new Map<string, boolean>() }
    for (const [id, valeur] of Object.entries(vues)) {
      if (!Array.isArray(valeur)) continue
      lues.set(id, Number(valeur[0]))
      if (valeur[1] !== null) attendues.premieres.set(id, Number(valeur[1]) === 1)
    }
    attendues.vues = deplieesAvant(lues, depliees)
    assert.deepEqual(journal.vuesDe(p), attendues, `${nom} · ${p} : ce qu’il a vu, déplié — et ses premières réponses, sans rien des composés`)
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
    // Ses compagnons : ses bonnes réponses avec chacun dans sa niche.
    const compagnons = Object.fromEntries((await client.execute({ sql: AVANT.compagnons, args: [p] })).rows.map(r => [String(r.compagnon), Number(r.n)]))
    assert.deepEqual(journal.compagnonsDe(p), compagnons, `${nom} · ${p} : ses compagnons`)
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
  // Les leurres que la campagne choisit, question par question.
  const leurres = new Map<string, Map<string, number>>()
  for (const r of (await client.execute(AVANT.leurres)).rows) {
    const question = String(r.question)
    if (!leurres.has(question)) leurres.set(question, new Map())
    leurres.get(question)!.set(String(r.choisie), Number(r.n))
  }
  assert.ok(leurres.size > 0, `${nom} : des leurres à comparer`)
  assert.deepEqual(journal.leurresChoisis(), leurres, `${nom} : les leurres choisis`)
  // L'administration des sentiers : les réponses des épreuves de trois mois, ou des derniers jours, d'un sentier ou de tous.
  const ordre = (a: { palier: number; niveau: string }, b: { palier: number; niveau: string }) => a.palier - b.palier || a.niveau.localeCompare(b.niveau)
  for (const [depuis, branche] of [
    [MAINTENANT - 90 * JOUR_MS, null],
    [MAINTENANT - 15 * JOUR_MS, null],
    [MAINTENANT - 90 * JOUR_MS, 'foret'],
  ] as const) {
    const attendues = (await client.execute({ sql: AVANT.epreuves(branche !== null), args: branche === null ? [depuis] : [depuis, branche] })).rows
      // Une marche nulle ne se montrait nulle part.
      .filter(r => r.niveau !== null)
      .map(r => ({ palier: Number(r.palier), niveau: String(r.niveau), n: Number(r.n), justes: Number(r.justes) }))
    assert.ok(attendues.length > 0, `${nom} : des épreuves à comparer`)
    assert.deepEqual(journal.reponsesDesEpreuves(depuis, branche).sort(ordre), attendues.sort(ordre), `${nom} : les épreuves des sentiers depuis ${new Date(depuis).toISOString()}, ${branche ?? 'tous'}`)
  }
  return depliees
}

/** Le carnet de chacun, au journal et à la requête que la campagne garde quand il doute, à l'heure de la campagne : rend combien de questions il compte en tout. */
async function comparerLesCarnets(campagne: CampagneStore, journal: JournalDesReponses, profils: readonly string[], maintenant: number, nom: string): Promise<number> {
  const deLaBase = (campagne as unknown as { suivisDeLaBase(qui: string): Promise<Map<string, SuiviDeRevision>> }).suivisDeLaBase.bind(campagne)
  let questions = 0
  for (const p of profils) {
    const attendu = await deLaBase(p)
    questions += attendu.size
    assert.deepEqual(journal.carnetDe(p, semaineDe(jourDe(maintenant)), maintenant), attendu, `${nom} · ${p} : son carnet`)
    // Égaux, les deux carnets pourraient garder ensemble ce qu'aucun ne doit : un préfixe oublié des deux côtés.
    assert.deepEqual([...attendu.keys()].filter(horsDeLaBase), [], `${nom} · ${p} : rien que des questions de la base`)
  }
  return questions
}

/** Les erreurs de ces joueurs sous chaque préfixe hors de la base : sans elles, que leurs carnets s'en passent ne prouverait rien. */
function erreursHorsDeLaBase(fichier: string, profils: readonly string[]): Record<string, number> {
  const db = new Database(fichier, { readonly: true })
  try {
    const compter = db.prepare(
      `SELECT COUNT(*) AS n FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
       WHERE r.juste = 0 AND substr(r.reserve_id, 1, length(?)) = ? AND s.profile_id IN (SELECT value FROM json_each(?))`,
    )
    return Object.fromEntries(PREFIXES_HORS_DE_LA_BASE.map(p => [p, (compter.get(p, p, JSON.stringify(profils)) as { n: number }).n]))
  } finally {
    db.close()
  }
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
  compagnon: null,
  epreuve: null,
  choisie: null,
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
    const depliees = await comparer(client, journal, profils, 'la base entière')
    assert.ok(journal.reponses > 500, `${journal.reponses} réponses lues`)
    const auCarnet = await comparerLesCarnets(campagne, journal, profils, horloge.t, 'la base entière')
    assert.ok(auCarnet > 50, `${auCarnet} questions aux carnets`)
    const erreurs = erreursHorsDeLaBase(fichier, profils)
    assert.ok(Object.values(erreurs).every(n => n > 0), `des erreurs sous chaque préfixe hors de la base : ${JSON.stringify(erreurs)}`)

    // Ce qui arrive ensuite, lu par différence ; une lecture en double, et une en retard sur une plus récente, ne comptent rien de plus.
    remplir(fichier, hasard, { series: 40, depart: 160, debut: MAINTENANT - 6 * JOUR_MS, fin: MAINTENANT })
    const avant = journal.jusqua
    const enRetard = lireLeJournal((await client.execute(lectureDuJournal(avant, 10))).rows[0], 10)
    const toutes = await lire(client, journal, 1000)
    journal.appliquer(toutes[0])
    journal.appliquer(enRetard)
    for (const sorte of await comparer(client, journal, profils, 'après une lecture par différence')) depliees.add(sorte)
    // Sans composé déplié, l'égalité ne prouverait rien : l'Éclair, la frise d'un sujet et le tableau de la Joconde.
    assert.deepEqual([...depliees].sort(), ['eclair', 'frise:s', 'tableau'], 'chaque sorte de pièce qui montre la base a ajouté ou rajeuni une vue')
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

// ── Les tranches gardées ────────────────────────────────────────────────────

/** Ce qu'une campagne demande à la base pour son journal : d'où part chaque lecture, et les duels qu'elle relit. */
function espionner(campagne: CampagneStore): { depuis: number[]; duels: unknown[] } {
  const lu = { depuis: [] as number[], duels: [] as unknown[] }
  const client = (campagne as unknown as { client: Client }).client
  const noter = (stmt: InStatement) => {
    if (typeof stmt === 'string' || !Array.isArray(stmt.args)) return
    if (stmt.sql.startsWith('SELECT COUNT(*) AS lues')) lu.depuis.push(Number(stmt.args[0]))
    else if (stmt.sql.startsWith('SELECT code, ferme_le FROM campagne_duels')) lu.duels.push(...stmt.args)
  }
  const execute = client.execute.bind(client) as (stmt: InStatement) => ReturnType<Client['execute']>
  const batch = client.batch.bind(client)
  client.execute = ((stmt: InStatement) => (noter(stmt), execute(stmt))) as Client['execute']
  client.batch = ((stmts: InStatement[], mode?: TransactionMode) => (stmts.forEach(noter), batch(stmts, mode))) as Client['batch']
  return lu
}

const journalDe = (campagne: CampagneStore) => (campagne as unknown as { rattraperLeJournal(): Promise<JournalDesReponses> }).rattraperLeJournal()

/** Les tranches qu'elle range en fond, l'une après l'autre : rangées. */
async function tranchesRangees(campagne: CampagneStore): Promise<void> {
  const interne = campagne as unknown as { trancheEnRoute: Promise<void> | null }
  while (interne.trancheEnRoute) await interne.trancheEnRoute
}

const tranchesEnBase = async (client: Client) =>
  (await client.execute('SELECT version, debut, jusqua, lues FROM campagne_tranches ORDER BY debut')).rows.map(r => ({
    version: String(r.version),
    debut: Number(r.debut),
    jusqua: Number(r.jusqua),
    lues: Number(r.lues),
  }))

/** Pleines, de la version du jour, et chacune là où s'arrête la précédente : le chemin qu'un réveil suit. */
function enChemin(tranches: Awaited<ReturnType<typeof tranchesEnBase>>, nom: string) {
  assert.ok(tranches.length > 0, `${nom} : des tranches`)
  tranches.forEach((t, i) => {
    assert.deepEqual([t.version, t.debut, t.lues], [VERSION_DES_TRANCHES, i === 0 ? 0 : tranches[i - 1].jusqua, 2000], `${nom} : la tranche ${i}`)
  })
}

function enBase(fichier: string, faire: (db: Database.Database) => void) {
  const db = new Database(fichier)
  try {
    faire(db)
  } finally {
    db.close()
  }
}

test('un réveil relit ses tranches gardées, puis la base pour ce qui les suit — un duel annulé, une tranche égarée, illisible ou d’avant, une réponse effacée', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-tranches-'))
  const fichier = path.join(dir, 'permanente.db')
  const url = `file:${fichier.replace(/\\/g, '/')}`
  const ouvertes: CampagneStore[] = []
  /** Un démarrage : une campagne neuve sur la même base, ses lectures épiées. */
  const reveil = async () => {
    for (const c of ouvertes.splice(0)) c.close()
    const campagne = new CampagneStore(url, undefined, { base: baseDEssai(30), maintenant: () => MAINTENANT })
    ouvertes.push(campagne)
    await campagne.init()
    return { campagne, lu: espionner(campagne) }
  }
  const client = createClient({ url })
  const profils = Array.from({ length: 7 }, (_, i) => `p${i}`)
  try {
    let { campagne, lu } = await reveil()
    const hasard = hasardDe(5)
    remplir(fichier, hasard, { series: 1100, depart: 0, debut: MAINTENANT - 24 * JOUR_MS, fin: MAINTENANT - 7 * JOUR_MS })

    // Rien de gardé : le premier réveil lit toute la base, puis range ce qu'il a lu, deux mille réponses par tranche.
    let journal = await journalDe(campagne)
    assert.equal(lu.depuis[0], 0)
    await tranchesRangees(campagne)
    let tranches = await tranchesEnBase(client)
    enChemin(tranches, 'le premier réveil')
    assert.ok(tranches.length >= 2 && journal.reponses - 2000 * tranches.length < 2000, `${tranches.length} tranches pour ${journal.reponses} réponses`)

    // L'administrateur annule un duel que les tranches disent ouvert (`annulerUnDuel`) ; puis le serveur se rendort.
    enBase(fichier, db => db.prepare('UPDATE campagne_duels SET ferme_le = ? WHERE code = ?').run(MAINTENANT - 1, 'duel-ouvert'))
    ;({ campagne, lu } = await reveil())
    journal = await journalDe(campagne)
    const fin = tranches[tranches.length - 1].jusqua
    assert.ok(lu.depuis.length > 0 && lu.depuis.every(d => d >= fin), `la base relue depuis ${lu.depuis.join(', ')} : ses tranches vont jusqu’à ${fin}`)
    assert.ok(lu.duels.includes('duel-ouvert'), 'les duels qu’elles disent ouverts se relisent')
    await comparer(client, journal, profils, 'relu de ses tranches')
    await comparerLesCarnets(campagne, journal, profils, MAINTENANT, 'relu de ses tranches, un duel annulé depuis')

    // Des réponses arrivent : dès deux mille de plus, elles se rangent en tranches à leur tour.
    remplir(fichier, hasard, { series: 500, depart: 1100, debut: MAINTENANT - 6 * JOUR_MS, fin: MAINTENANT })
    journal = await journalDe(campagne)
    await tranchesRangees(campagne)
    const avant = tranches.length
    tranches = await tranchesEnBase(client)
    enChemin(tranches, 'des réponses arrivées')
    assert.ok(tranches.length > avant && journal.reponses - 2000 * tranches.length < 2000, `${tranches.length} tranches pour ${journal.reponses} réponses`)
    ;({ campagne, lu } = await reveil())
    journal = await journalDe(campagne)
    assert.ok(lu.depuis.every(d => d >= tranches[tranches.length - 1].jusqua), 'seulement ce qui suit ses tranches')
    await comparer(client, journal, profils, 'des réponses arrivées, relues de leurs tranches')

    // Une tranche égarée — écrite pour un journal d'avant —, une illisible, une d'une lecture d'avant : la première se passe,
    // la seconde arrête le chemin — la base relit de là —, la dernière s'efface au démarrage ; les deux premières, ensuite.
    const illisible = tranches[1]
    enBase(fichier, db => {
      const tranche = db.prepare('INSERT INTO campagne_tranches (version, debut, jusqua, lues, lignes, ecrite_le) VALUES (?, ?, ?, 2000, ?, 0)')
      tranche.run(VERSION_DES_TRANCHES, 3, 10, '[]')
      tranche.run('une-lecture-d-avant', 0, 10, '[]')
      db.prepare("UPDATE campagne_tranches SET lignes = '[[1,' WHERE debut = ?").run(illisible.debut)
    })
    ;({ campagne, lu } = await reveil())
    assert.ok((await tranchesEnBase(client)).every(t => t.version === VERSION_DES_TRANCHES), 'celle d’une lecture d’avant, effacée au démarrage')
    journal = await journalDe(campagne)
    assert.equal(lu.depuis[0], illisible.debut, 'la base relue depuis la tranche illisible')
    await comparer(client, journal, profils, 'une tranche égarée, une illisible')
    await tranchesRangees(campagne)
    enChemin(await tranchesEnBase(client), 'refaites')

    // Une réponse effacée — ici à la main, comme `oublierProfil` — efface toutes les tranches ; le réveil suivant relit toute la base.
    enBase(fichier, db => db.prepare('DELETE FROM campagne_reponses WHERE rowid = (SELECT MIN(rowid) FROM campagne_reponses)').run())
    assert.deepEqual(await tranchesEnBase(client), [], 'une réponse effacée')
    ;({ campagne, lu } = await reveil())
    journal = await journalDe(campagne)
    assert.equal(lu.depuis[0], 0)
    await comparer(client, journal, profils, 'une réponse effacée')
    await comparerLesCarnets(campagne, journal, profils, MAINTENANT, 'une réponse effacée')
    await tranchesRangees(campagne)
    enChemin(await tranchesEnBase(client), 'refaites sans elle')
    // Une réponse qui change, une série effacée : de même.
    enBase(fichier, db => db.prepare('UPDATE campagne_reponses SET juste = 1 - juste WHERE rowid = (SELECT MAX(rowid) FROM campagne_reponses)').run())
    assert.deepEqual(await tranchesEnBase(client), [], 'une réponse qui change')
    ;({ campagne } = await reveil())
    await journalDe(campagne)
    await tranchesRangees(campagne)
    assert.ok((await tranchesEnBase(client)).length > 0)
    enBase(fichier, db => db.prepare('DELETE FROM campagne_series WHERE id = ?').run('s3'))
    assert.deepEqual(await tranchesEnBase(client), [], 'une série effacée')
  } finally {
    client.close()
    for (const c of ouvertes) c.close()
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
