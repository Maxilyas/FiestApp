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
import type { CeQueLeReveilAjoute } from '../porteDeLaCampagne'

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
