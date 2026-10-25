// Les tables du Cabinet de curiosités, dans la base permanente : ce que le
// Cabinet demande au réveil de la campagne (`REVEIL_DU_CABINET`), que
// `CampagneStore.init` pose dans son premier lot. Le Cabinet n'a pas d'`init` à
// lui : un aller-retour de plus à chaque réveil de l'hébergeur — la production
// dort la nuit, la préproduction dès qu'on la laisse —, c'est 30 à 225 ms avant
// que le port s'ouvre (`demarrage.test.ts`, `porte-de-la-campagne.test.ts`).
//
// Une partie est une ligne de `campagne_series` (`mode = 'cabinet'`) : son
// départ figé dans la colonne `cabinet`, ses pièces dans `questions`, leurs
// réponses dans `campagne_reponses` — le journal des réponses compte d'office
// l'expérience, les confettis, le compagnon, le carnet. Ici, ce que la campagne
// n'a pas : les gestes d'une partie, et les reflets d'un musée, bornés par
// profil — aucune lecture qui grandisse avec l'histoire (le quota de Turso, le
// 22 octobre 2026). Les `CHECK` ne gardent que des valeurs que le code pose :
// leur échec est un bogue, et un 500 lui va ; le solde de poussière n'en a
// pas — refusé, un achat se dit en mots (`rowsAffected`), jamais par une
// `LibsqlError`.
import type { InStatement, ResultSet } from '@libsql/client'
import type { CeQueLeReveilAjoute } from '../porteDeLaCampagne'
import { lireUnGeste, lireLeDepart } from '../../../../shared/cabinet/lecture'
import type { DepartDUnePartie, GesteEcrit, IssueDUnePartie, Manche, OrigineDUnePartie } from '../../../../shared/cabinet/partie'
import { ISSUES } from '../../../../shared/cabinet/partie'
import type { CaseFigee, LigneDOeuvre, LigneDuProfil, OrigineDUneOeuvre, PartieDuJour, VisiteFigee } from '../../../../shared/cabinet/musee'
import { CLES_DES_JEUX, type CleDeJeu } from '../../../../shared/cabinet/jeux/regle'
import { estUneOeuvre } from '../../../../shared/cabinet/oeuvres'
import { saison as saisonDe } from '../../../../shared/saisons'
import { jourValide } from '../../../../shared/jour'

/**
 * Les gestes d'une partie, dans l'ordre : ce que le joueur a fait, et quand le
 * serveur l'a reçu. Le pli du départ et des gestes dit tout le reste
 * (invariant 14) : une manche reprend où elle en était, son chrono compris.
 * Pas de `profile_id`, comme `expedition_gestes` : la suppression d'un profil
 * les efface par ses parties.
 */
const GESTES = `CREATE TABLE IF NOT EXISTS cabinet_gestes (
  serie_id TEXT NOT NULL,
  rang     INTEGER NOT NULL,
  geste    TEXT NOT NULL,
  fait_le  INTEGER NOT NULL,
  uid      TEXT NOT NULL,
  PRIMARY KEY (serie_id, rang)
)`

/**
 * Le Cabinet d'un profil, une ligne : ce qui se résume de ses parties, tenu à
 * jour dans les lots qui le changent — jamais la somme relue à chaque page.
 * `poussiere` est la poussière d'or gagnée, la somme des bilans ; le solde en
 * retire ce que ses œuvres ont coûté. `visites` garde les visites figées des
 * trois derniers jours, échange compris ; `partie`, celle en cours.
 */
const PROFILS = `CREATE TABLE IF NOT EXISTS cabinet_profils (
  profile_id   TEXT PRIMARY KEY,
  poussiere    INTEGER NOT NULL DEFAULT 0,
  serie        INTEGER NOT NULL DEFAULT 0,
  serie_jour   TEXT,
  serie_record INTEGER NOT NULL DEFAULT 0,
  visites      TEXT NOT NULL DEFAULT '[]',
  partie       TEXT,
  v            INTEGER NOT NULL DEFAULT 1,
  cree_le      INTEGER NOT NULL,
  maj_le       INTEGER NOT NULL
)`

/**
 * Ses œuvres : une ligne par œuvre entrée — 84 au plus —, jamais retirée hors
 * de la suppression du profil (invariant 22). Ce qu'elle a coûté s'écrit avec
 * elle, au prix du jour : un achat garde le prix payé. Les quatre œuvres de
 * départ sont à tous sans ligne ; la leur ne s'écrit que pour un cartel ou un
 * cadre doré.
 */
const OEUVRES = `CREATE TABLE IF NOT EXISTS cabinet_oeuvres (
  profile_id  TEXT NOT NULL,
  oeuvre      TEXT NOT NULL,
  origine     TEXT NOT NULL CHECK (origine IN ('partie', 'achat', 'expedition', 'depart')),
  gagnee_le   INTEGER NOT NULL,
  saison      TEXT,
  serie_id    TEXT,
  prix        INTEGER,
  doree_le    INTEGER,
  dorure      TEXT CHECK (dorure IN ('partie', 'poussiere')),
  prix_dorure INTEGER,
  serie_doree TEXT,
  PRIMARY KEY (profile_id, oeuvre)
)`

/**
 * La clé du secret du Cabinet dans `campagne_meta` : tiré au premier réveil,
 * relu à chacun. La graine de la visite du jour en dérive
 * (`HMAC-SHA256(secret, profileId)`) — faite du seul profil, la page l'aurait
 * refaite et lu l'œuvre visée de chaque case ; tirée à chaque réveil, la
 * visite de qui n'a pas encore joué changerait d'un réveil à l'autre.
 */
export const SECRET_DU_CABINET = 'secret_du_cabinet'

/** Ce que le Cabinet ajoute au premier lot de la campagne : ses trois tables, la colonne de son départ figé, son secret. */
export const REVEIL_DU_CABINET = {
  tablesEnPlus: [GESTES, PROFILS, OEUVRES],
  // Le départ figé d'une partie (`DepartDUnePartie`, JSON versionné) : ses manches et leurs rechanges, réponses comprises.
  // Il ne se relit qu'à la relecture d'une partie, par sa clé ; les lectures du jour n'en tirent que des champs.
  colonnesEnPlus: [['cabinet', 'TEXT']],
  secret: SECRET_DU_CABINET,
} as const satisfies CeQueLeReveilAjoute

// ── La garde d'un lot (D9) ────────────────────────────────────────────────

/**
 * La garde de chaque instruction d'un lot du Cabinet après la première : le
 * geste qui l'ouvre est en base, à son rang, avec l'`uid` que ce serveur a
 * tiré pour ce lot. Le même rang déjà pris — l'autre serveur d'une mise en
 * ligne, un double toucher arrivé par lui, une réponse HTTP perdue puis
 * rejouée — n'a rien laissé écrire de plus : ni réponse, ni pièce, ni fin.
 */
export function gesteEcrit(serie: string, rang: number, uid: string): { sql: string; args: [string, number, string] } {
  return { sql: 'EXISTS (SELECT 1 FROM cabinet_gestes WHERE serie_id = ? AND rang = ? AND uid = ?)', args: [serie, rang, uid] }
}

/**
 * Une partie du Cabinet, d'après ce qu'en dit sa colonne figée : sous
 * `json_valid` — `json_extract` sur un texte qui n'est pas du JSON lève une
 * erreur, et tout le lot tombait avec elle (le piège de l'Expédition, règle
 * `expedition.md`) ; seul notre code écrit la colonne, mais une ligne abîmée
 * ne doit pas fermer le Cabinet de son joueur.
 */
export const champDuDepart = (champ: 'origine' | 'visite') => `CASE WHEN json_valid(cabinet) THEN json_extract(cabinet, '$.${champ}') END`

/**
 * Les parties du Cabinet qu'un profil a commencées depuis minuit, par l'index
 * `(profile_id, commencee_le)` : le `+` devant le mode écarte celui des
 * sentiers `(profile_id, mode, …)`, qui parcourrait toutes ses parties du
 * Cabinet depuis toujours — dix par jour et par joueur — pour n'en garder
 * qu'une poignée (le patron `PAR_SON_CODE` des duels, règle `duels.md`).
 * `cabinet-index.test.ts` lit le plan de chaque lecture qui la porte. Ses
 * deux paramètres se nomment par leur place quand un lot les réutilise (`?1`).
 */
export const partiesDuJour = (profil = '?', minuit = '?') => `profile_id = ${profil} AND commencee_le >= ${minuit} AND +mode = 'cabinet'`

// ── Le lot froid ──────────────────────────────────────────────────────────

/**
 * Tant que l'Expédition se lit encore — jusqu'à l'étape 5, quand plus une
 * expédition n'est en route depuis trente jours —, la page du Cabinet dit
 * qu'une expédition attend son joueur : une lecture de plus dans le lot
 * froid, par l'index des sentiers. À faux, elle s'en va du lot.
 */
export const EXPEDITION_ENCORE_LUE = true

/**
 * Le musée d'un profil, à froid, d'un seul aller-retour (la conception, § 1.10) :
 * sa ligne de reflets, ses œuvres — 84 au plus —, ses parties du jour sans
 * leur plan, la partie en cours et ses gestes — par la clé de sa ligne, sans
 * chercher `finie_le IS NULL` —, l'expédition qui l'attend. Au pire cent
 * cinquante lignes, une fois par réveil et par joueur ; rien qui grandisse
 * avec son histoire (D7).
 */
export function lecturesDuMusee(profileId: string, minuit: number): InStatement[] {
  return [
    { sql: 'SELECT poussiere, serie, serie_jour, serie_record, visites, partie FROM cabinet_profils WHERE profile_id = ?', args: [profileId] },
    {
      sql: 'SELECT oeuvre, origine, gagnee_le, saison, serie_id, prix, doree_le, dorure, prix_dorure, serie_doree FROM cabinet_oeuvres WHERE profile_id = ?',
      args: [profileId],
    },
    {
      // Ses champs d'un seul `json_extract` à cinq chemins : un tableau JSON, décodé ici.
      sql: `SELECT id, commencee_le, finie_le, issue,
                   CASE WHEN json_valid(cabinet) THEN json_extract(cabinet, '$.origine', '$.visite', '$.jeu', '$.cible', '$.payee') END AS champs,
                   CASE WHEN json_valid(bilan) THEN json_extract(bilan, '$.total') END AS total
              FROM campagne_series WHERE ${partiesDuJour()}`,
      args: [profileId, minuit],
    },
    {
      sql: 'SELECT id, cabinet, position, commencee_le FROM campagne_series WHERE id = (SELECT partie FROM cabinet_profils WHERE profile_id = ?) AND profile_id = ?',
      args: [profileId, profileId],
    },
    { sql: 'SELECT rang, geste, fait_le FROM cabinet_gestes WHERE serie_id = (SELECT partie FROM cabinet_profils WHERE profile_id = ?) ORDER BY rang', args: [profileId] },
    ...(EXPEDITION_ENCORE_LUE
      ? [{ sql: "SELECT id FROM campagne_series WHERE profile_id = ? AND mode = 'expedition' AND finie_le IS NULL LIMIT 1", args: [profileId] }]
      : []),
  ]
}

/** Une partie relue de la base : son départ figé et ses gestes écrits, et ce que dit sa ligne. */
export interface PartieLueEnBase {
  id: string
  depart: DepartDUnePartie
  gestes: GesteEcrit[]
  /** Les pièces écrites (`campagne_series.position`) : le pli doit en ranger autant. */
  position: number
}

/** Ce que dit le lot froid, relu champ par champ : une ligne abîmée se tait plutôt que de fausser le musée. */
export interface MuseeLuEnBase {
  profil: LigneDuProfil | null
  oeuvres: LigneDOeuvre[]
  parties: PartieDuJour[]
  /** La partie que sa ligne dit en cours, ou null — illisible, elle se tait et le dit au journal. */
  enCours: PartieLueEnBase | null
  /** La ligne nomme une partie que la base ne relit pas : le magasin la referme. */
  partieIllisible: string | null
  expeditionEnRoute: string | null
}

const texte = (x: unknown): string | null => (typeof x === 'string' ? x : null)
const nombre = (x: unknown): number => Number(x ?? 0)
const ORIGINES_D_UNE_OEUVRE: readonly OrigineDUneOeuvre[] = ['partie', 'achat', 'expedition', 'depart']

/** Les visites figées, relues : le jour, trois cases d'un jeu chacune, l'œuvre en jeu, l'échange ; une visite abîmée s'écarte. */
export function lireLesVisites(brut: unknown): VisiteFigee[] {
  let v: unknown
  try {
    v = typeof brut === 'string' ? JSON.parse(brut) : brut
  } catch {
    return []
  }
  if (!Array.isArray(v)) return []
  return v.flatMap((x: unknown): VisiteFigee[] => {
    if (typeof x !== 'object' || x === null) return []
    const { jour, cases, echange } = x as Record<string, unknown>
    if (!jourValide(jour) || !Array.isArray(cases)) return []
    const lues = cases.flatMap(c => {
      if (typeof c !== 'object' || c === null) return []
      const { jeu, cible, but } = c as Record<string, unknown>
      if (!(CLES_DES_JEUX as readonly unknown[]).includes(jeu)) return []
      if (!(cible === null || estUneOeuvre(cible)) || !(but === null || but === 'gagner' || but === 'dorer')) return []
      return [{ jeu: jeu as CleDeJeu, cible, but: but as CaseFigee['but'] }]
    })
    if (lues.length !== cases.length) return []
    return [{ jour, cases: lues, ...(Number.isInteger(echange) && (echange as number) >= 0 && (echange as number) < lues.length && { echange: echange as Manche }) }]
  })
}

function laLigneDuProfil(r: Record<string, unknown> | undefined): LigneDuProfil | null {
  if (!r) return null
  return {
    poussiere: nombre(r.poussiere),
    serie: nombre(r.serie),
    serieJour: texte(r.serie_jour),
    serieRecord: nombre(r.serie_record),
    visites: lireLesVisites(r.visites),
    partie: texte(r.partie),
  }
}

function laLigneDOeuvre(r: Record<string, unknown>): LigneDOeuvre | null {
  const origine = r.origine as OrigineDUneOeuvre
  if (typeof r.oeuvre !== 'string' || !ORIGINES_D_UNE_OEUVRE.includes(origine)) return null
  const dorure = r.dorure === 'partie' || r.dorure === 'poussiere' ? r.dorure : null
  return {
    oeuvre: r.oeuvre,
    origine,
    gagneeLe: nombre(r.gagnee_le),
    saison: saisonDe(r.saison)?.key ?? null,
    serieId: texte(r.serie_id),
    prix: r.prix === null || r.prix === undefined ? null : nombre(r.prix),
    doreeLe: r.doree_le === null || r.doree_le === undefined ? null : nombre(r.doree_le),
    dorure,
    prixDorure: r.prix_dorure === null || r.prix_dorure === undefined ? null : nombre(r.prix_dorure),
    serieDoree: texte(r.serie_doree),
  }
}

function laPartieDuJour(r: Record<string, unknown>): PartieDuJour | null {
  let champs: unknown
  try {
    champs = typeof r.champs === 'string' ? JSON.parse(r.champs) : null
  } catch {
    return null
  }
  if (!Array.isArray(champs) || typeof r.id !== 'string') return null
  const [origine, visite, jeu, cible, payee] = champs as unknown[]
  if (origine !== 'visite' && origine !== 'chasse' && origine !== 'libre') return null
  if (!(CLES_DES_JEUX as readonly unknown[]).includes(jeu)) return null
  const issue = (ISSUES as readonly unknown[]).includes(r.issue) ? (r.issue as IssueDUnePartie) : null
  return {
    id: r.id,
    commenceeLe: nombre(r.commencee_le),
    finieLe: r.finie_le === null || r.finie_le === undefined ? null : nombre(r.finie_le),
    issue,
    origine: origine as OrigineDUnePartie,
    visite: Number.isInteger(visite) && (visite as number) >= 0 && (visite as number) <= 2 ? (visite as Manche) : null,
    jeu: jeu as CleDeJeu,
    cible: typeof cible === 'string' ? cible : null,
    // `json_extract` d'un booléen JSON rend vrai ou faux dans le tableau qu'il compose.
    payee: payee === true || payee === 1,
    total: r.total === null || r.total === undefined ? null : nombre(r.total),
  }
}

/** Les gestes écrits d'une partie, relus en gestes du serveur (`duServeur` : `clore` et les textes tels qu'écrits) ; un geste illisible arrête la relecture. */
export function lireLesGestes(rows: readonly Record<string, unknown>[]): GesteEcrit[] | null {
  const gestes: GesteEcrit[] = []
  for (const r of rows) {
    const geste = lireUnGeste(r.geste, { duServeur: true })
    if (!geste || nombre(r.rang) !== gestes.length + 1) return null
    gestes.push({ geste, faitLe: nombre(r.fait_le) })
  }
  return gestes
}

/** Une partie, de sa ligne et de ses gestes ; null : un départ que ce code ne relit pas, ou des gestes troués. */
export function laPartieLue(ligne: Record<string, unknown> | undefined, gestes: readonly Record<string, unknown>[]): PartieLueEnBase | null {
  if (!ligne || typeof ligne.id !== 'string') return null
  const depart = lireLeDepart(ligne.cabinet)
  const lus = lireLesGestes(gestes)
  return depart && lus ? { id: ligne.id, depart, gestes: lus, position: nombre(ligne.position) } : null
}

/** Le lot froid relu (`lecturesDuMusee`), dans son ordre. */
export function lireLeMusee(lus: readonly ResultSet[]): MuseeLuEnBase {
  const [profils, oeuvres, parties, partie, gestes, expedition] = lus
  const profil = laLigneDuProfil(profils.rows[0] as Record<string, unknown> | undefined)
  const enCours = profil?.partie ? laPartieLue(partie.rows[0] as Record<string, unknown> | undefined, gestes.rows as Record<string, unknown>[]) : null
  return {
    profil,
    oeuvres: oeuvres.rows.flatMap(r => laLigneDOeuvre(r as Record<string, unknown>) ?? []),
    parties: parties.rows.flatMap(r => laPartieDuJour(r as Record<string, unknown>) ?? []),
    enCours,
    partieIllisible: profil?.partie && !enCours ? profil.partie : null,
    expeditionEnRoute: texte(expedition?.rows[0]?.id),
  }
}

/** Une partie seule, de sa clé, cloisonnée au profil et au mode : celle d'un autre vaut « introuvable » (invariant 3). */
export function lecturesDeLaPartie(profileId: string, serie: string): InStatement[] {
  return [
    { sql: "SELECT id, cabinet, position, commencee_le, finie_le, bilan FROM campagne_series WHERE id = ? AND profile_id = ? AND mode = 'cabinet'", args: [serie, profileId] },
    { sql: 'SELECT rang, geste, fait_le FROM cabinet_gestes WHERE serie_id = ? ORDER BY rang', args: [serie] },
  ]
}
