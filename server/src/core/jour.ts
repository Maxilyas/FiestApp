// Le quiz du jour, côté serveur : la réserve de questions, le tirage de
// minuit, la partie de chaque profil — chronométrée ici, jamais sur le
// téléphone —, et la nuit qui clôt la journée : son podium, son expérience.
//
// Tout vit dans la base permanente. Un profil commence sur un téléphone et
// reprend sur un autre ; l'hébergeur qui s'endort ou redémarre ne doit rien
// lui faire perdre, et la base locale, jetable (invariant 2), n'en sait rien.
//
// Rien ne tourne la nuit : l'hébergeur gratuit dort. La journée d'hier se
// clôt à la première demande d'aujourd'hui (`clorePasses`), une fois : son
// podium est payé, sa correction s'ouvre à tous.
//
// Les règles pures — le jour de Paris, l'expérience, la médaille, la série —
// sont dans `shared/jour.ts`.

import { randomUUID } from 'node:crypto'
import type { InStatement, ResultSet, Row } from '@libsql/client'
import { ajouterColonne, clientDistant, type Client } from './distante'
import { LECTURES_GARDEES_MS, LecturesGardees, type LectureDansUnLot } from './lecturesGardees'
import { extrait } from './journalDesGestes'
import { lireEtiquetage, type MetadonneesDeQuestion } from '../../../shared/etiquettes'
import { bonneReponseChange, niveauMesure, type Niveau } from '../../../shared/campagne'
import {
  ISSUES_QUI_SERVENT,
  QUESTION_DU_MERCI,
  RELUS_MONTRES,
  SIGNALEMENTS_MONTRES_AU_QG,
  classementEcrit,
  corrigeAussiLeJour,
  detailDeLaCorrection,
  lireIssue,
  lireLaCorrection,
  lireLeClassement,
  memeLecture,
  placesDuJour,
  type Classement,
  type IssueDUnSignalement,
  type SignalementDuJour,
  type SignalementRelu,
  type VersionDeLaReserve,
  type VersionLue,
} from '../../../shared/qgSignalements'
import { HORS_LIGNES_A_PART, cleDuJour, cleDuMois, type ProfileRec, type ProfileStore } from '../auth/profiles'
import { JOURS_DE_CHRONOS, chronosDescend, raconter } from './divins'
import { JOURS_POUR_UNE_PAGE, cleDeLaPage, moisDeLaPage } from '../../../shared/calendrier'
import { GRACE_MS, POINTS_MAX_PAR_QUESTION, bonusDeRapidite, pointsDuChoix, tempsDeLecture } from '../games/quiz'
import { lireModeles } from './seed'
import { aEcrirePour, categoriesAPrivilegier, consigneDuJour, type MesureDesJoueurs, type QuestionMesuree } from './consigne'
import {
  MAX_ANECDOTE,
  MAX_ANSWERS,
  MAX_ANSWER_TEXT,
  MAX_TEXT,
  MIN_ANSWERS,
  normalizeQuestions,
  toPlayable,
  type PlayableQuestion,
  type QuizQuestionDef,
} from '../../../shared/library'
import { preparerPartie, suiteFixe } from '../../../shared/hasard'
import {
  CONFETTIS_DE_LA_QUESTION_BONUS,
  CONFETTIS_D_UNE_QUESTION_ACCEPTEE,
  CONFETTIS_D_UNE_QUESTION_BIEN_DOSEE,
  CONFETTIS_D_UNE_QUESTION_JOUEE,
  DOSAGE_DES_POUR_CENT,
  DOSAGE_JUSQU_A_POUR_CENT,
  DUREE_DE_LA_QUESTION_BONUS,
  JOUEURS_POUR_LE_DOSAGE,
  PROPOSITIONS_EN_RELECTURE_MAX,
  QUESTIONS_DU_PUBLIC_PAR_JOUR,
  QUESTIONS_D_OFFICE_EN_FILE_MAX,
  XP_DE_LA_QUESTION_BONUS,
  estDeConfiance,
  lireLaCategorie,
  lireLaProposition,
  lireLeMotif,
  lireLeVote,
  partDeLAuteur,
  type PropositionAuQg,
  type PropositionDuJoueur,
  type QuestionEnFile,
  type QuestionProposee,
  type SalleDuBonus,
  type StatutDUneProposition,
} from '../../../shared/propositions'
import { classer, rangDansLesTries } from '../../../shared/classement'
import { PLACES_DU_COFFRE_DU_MOIS, PREMIER_MOIS_DES_COFFRES } from '../../../shared/coffre'
import { nomsAffiches, sansAccent } from '../../../shared/homonymes'
import { tronquer } from '../../../shared/avatars'
import {
  AVANT_LE_LEVE_TOT,
  DEPUIS_LE_DERNIER_METRO,
  QUESTIONS_PAR_JOUR,
  SABLIERS_MAX,
  cleDuChampion,
  jourAvant,
  jourDe,
  jourValide,
  medailleDe,
  minutesDeParis,
  moisDe,
  serieAvecSabliers,
  seriesParJour,
  xpDeSerie,
  xpDuJour,
  xpDuPodium,
  type BonusDuJour,
  type CarriereDuJour,
  type ClassementDuJour,
  type JourJoue,
  type LigneDuJour,
  type Medaille as TypeDeMedaille,
  type PartieDuJour,
  type QuestionDuJour,
  type RevelationDuBonus,
  type RevelationDuJour,
  type SerieDuJour,
} from '../../../shared/jour'
import { CHANCE_ECLAT_DU_JOUR, apparenceDeLAvatar, niveauDuProfil, type AnnonceDeLAdministrateur, type StatsDuJour } from '../../../shared/profil'
import { millesimeDe, periodeDu } from '../../../shared/saisons'
import { cleDuTimbre, timbreDe, timbreDit } from '../../../shared/timbres'
import { savoirDesLignes, type Savoir } from '../../../shared/ecussons'
import { SALLE_DU_JOUR, hautFait, palierDe, xpDe } from '../../../shared/hautsfaits'
import { minuitDe } from '../../../shared/qg'
import { recueilDeLaQuestion, type BonusDuSuivi, type PartDesBonnes, type QuestionDuSuivi } from '../../../shared/qgDuJour'
import {
  JOURS_DES_APPORTS,
  JOURS_DES_QUESTIONS_DU_JOUR,
  type LectureDesQuestionsDuJour,
  type LigneDuRecueil,
  type QuestionPoseeDuJour,
  type ReserveDuJourAuQg,
} from '../../../shared/qgContenu'
import type { Mouvement } from '../../../shared/qgEconomie'
import type { JournauxDesJours } from '../../../shared/missions'

/** Une question telle que le jour l'a tirée, figée : réponses mélangées, temps de lecture compté. */
interface QuestionTiree {
  reserveId: string
  texte: string
  reponses: string[]
  bonne: number
  categorie: string | null
  duree: number
  lectureMs: number
  anecdote: string | null
  /**
   * Le profil qui l'a proposée — une question du public (`tirer`) —, figé
   * avec le jour : lui ne la joue pas (`enregistrer`, ou la question bonus),
   * les autres la voient signée de son nom (`signee`).
   */
  auteur?: string
  /**
   * Le profil qui l'a relue et acceptée au QG (`accepterLaProposition`) — ou
   * lue dans la file, passée d'office (`lireLaQuestionEnFile`) —, figé avec le
   * jour : il en connaît la réponse, la question bonus ne se joue pas pour
   * lui. Les questions acceptées avant le 8 novembre 2026 n'en ont pas.
   */
  relecteur?: string
  /**
   * La question bonus annulée pour tous par le QG, à cet instant
   * (`annulerLeBonus`) : elle ne se joue plus, et ne rapporte plus rien — à
   * qui l'a trouvée, ni à son auteur. Rangée dans `jour_bonus.question`, que
   * le tirage relit avec elle.
   */
  annulee?: number
}

interface Tirage {
  jour: string
  questions: QuestionTiree[]
  /** Les questions dont l'administrateur a annulé les points, pour tous. */
  annulees: number[]
  /**
   * La question bonus (`jour_bonus`) : la question du public, après les dix,
   * hors des points et du classement. Absente d'un jour sans question du
   * public — et des tirages d'avant le 8 novembre 2026, où elle était l'une
   * des dix.
   */
  bonus?: QuestionTiree
}

interface Partie {
  profileId: string
  jour: string
  commenceeLe: number
  /** La question en cours : montrée si `servieLe`, à montrer sinon. */
  question: number
  servieLe: number | null
  points: number
  justes: number
  finieLe: number | null
  xp: number
  /** Son bonus de série (`xpDeSerie`), écrit quand elle commence. */
  xpSerie: number
  /** La question bonus : montrée à cet instant (son chrono part), jouée à celui-ci — trouvée, ratée ou laissée au temps. */
  bonusServieLe: number | null
  bonusLe: number | null
  bonusChoix: number | null
  bonusJuste: boolean
  /** L'expérience de la question bonus trouvée (`XP_DE_LA_QUESTION_BONUS`), figée avec la partie, comme son bonus de série. */
  xpBonus: number
  /** Son pouce sur la question bonus. */
  bonusVote: 1 | -1 | null
}

/** Une partie d'un profil, relue pour sa page. */
interface JourLu {
  jour: string
  points: number
  justes: number
  xp: number
  comptees: number
  annulees: number[]
}

/**
 * Le lot de sa carrière (`lecturesDeLaCarriere`), et ce qu'on savait en le
 * lançant : le jour, la révision de chaque jour et ceux dont la salle était
 * déjà gardée — leurs points ne sont pas dans le lot.
 */
interface LectureDeLaCarriere {
  lot: InStatement[]
  aujourdhui: string
  revisions: ReadonlyMap<string, number>
  gardes: ReadonlySet<string>
  /** Ses bonnes réponses de ses trente derniers jours, à lire du lot — rien à y lire si on les tient (`justesGardees`). */
  justes: LectureDansUnLot<readonly JusteDUnJour[]>
}

/** Une bonne réponse de ses derniers jours, telle que sa carrière la lit (`joursJoues`) : son jour, sa question, son temps. */
interface JusteDUnJour {
  jour: string
  question: number
  ms: number
}

/** Ce que l'accueil d'un profil lit du quiz du jour (`JourStore.accueilDe`) : chaque part à part, toutes d'un seul lot. */
export interface AccueilDuJour {
  carriere: Promise<CarriereDuJour>
  /** Ses bonnes réponses, parties en cours comprises : ses confettis du quiz du jour (`justesDe`). */
  justes: Promise<number>
  mercis: Promise<AnnonceDeLAdministrateur[]>
}

/** Un coffre de mois qui l'attend : le mois clos où il était classé, et sa place, de quoi en tirer le rang du coffre. */
export interface CoffreDuMoisLu {
  mois: string
  place: number
}

/** Ses coffres de mois (`coffresDuMois`), un par mois clos où il était classé. */
function lectureDesCoffresDuMois(profileId: string): InStatement {
  return { sql: 'SELECT mois, place FROM jour_coffres_du_mois WHERE profile_id = ? ORDER BY mois', args: [profileId] }
}

function coffresDuMoisLus(rows: ResultSet['rows']): CoffreDuMoisLu[] {
  return rows.map(r => ({ mois: String(r.mois), place: Number(r.place) }))
}

/**
 * Sa question du public (`r`, sa ligne de la réserve) annulée pour tous le
 * jour qui l'a jouée : son tirage à sa clé, puis ses dix questions — ou sa
 * question bonus, que le QG annule à part (`annulerLeBonus`, son instant dans
 * `jour_bonus.question`). Une question annulée était fausse, et ne compte
 * pour personne — son auteur non plus : ni les confettis de son jour, ni La
 * Plume (`JOUEE_ET_COMPTEE`), ni le défi de l'auteur (`BIEN_DOSEE`).
 */
const ANNULEE_POUR_TOUS = `(EXISTS (SELECT 1 FROM jour_tirages t, json_each(t.questions) q, json_each(t.annulees) a
  WHERE t.jour = r.posee_le AND json_extract(q.value, '$.reserveId') = r.id AND a.value = q.key)
  OR EXISTS (SELECT 1 FROM jour_bonus b WHERE b.jour = r.posee_le AND b.reserve_id = r.id AND json_extract(b.question, '$.annulee') IS NOT NULL))`

/** Sa question du public jouée, et qui compte encore : ce qui la paie le jour où elle passe, et ce que La Plume compte. */
const JOUEE_ET_COMPTEE = `(r.posee_le IS NOT NULL AND NOT ${ANNULEE_POUR_TOUS})`

/**
 * Sa question du public (`r`) posée en question bonus, et bien dosée : la
 * salle l'a trouvée sans qu'elle soit évidente — les bornes de `dosageDe`,
 * en entiers. Jugée une fois le jour clos, sur ceux qui l'ont jouée : avant
 * minuit, la part bouge encore, et ce qui peut se renverser attend la nuit.
 */
const BIEN_DOSEE = `(r.posee_le IS NOT NULL
  AND EXISTS (SELECT 1 FROM jour_bonus b WHERE b.jour = r.posee_le AND b.reserve_id = r.id AND json_extract(b.question, '$.annulee') IS NULL)
  AND EXISTS (SELECT 1 FROM jour_clotures c WHERE c.jour = r.posee_le)
  AND EXISTS (SELECT 1 FROM jour_parties j WHERE j.jour = r.posee_le AND j.bonus_le IS NOT NULL GROUP BY j.jour
              HAVING COUNT(*) >= ${JOUEURS_POUR_LE_DOSAGE}
                 AND SUM(j.bonus_juste) * 100 >= COUNT(*) * ${DOSAGE_DES_POUR_CENT}
                 AND SUM(j.bonus_juste) * 100 <= COUNT(*) * ${DOSAGE_JUSQU_A_POUR_CENT}))`

/**
 * Ce que ses questions du public lui rapportent, en confettis, l'une après
 * l'autre (`CONFETTIS_D_UNE_QUESTION_ACCEPTEE`, puis `…_JOUEE`, puis
 * `…_BIEN_DOSEE`) : la part de chacune, du profil et de l'instant qui la
 * paient — son acceptation, le minuit du jour où elle est jouée, celui de la
 * nuit qui juge son dosage. Une refusée ne rapporte rien ; une annulée pour
 * tous, son acceptation seule — une retirée de la file avant son jour aussi :
 * son acceptation reste payée, comme celle d'une annulée (elle a pu passer
 * d'office, et ses confettis paraître au solde), et `relue_le` garde l'instant
 * qui l'a payée.
 */
const CONFETTIS_DES_PROPOSITIONS = `
  SELECT p.profile_id AS profile_id, ${CONFETTIS_D_UNE_QUESTION_ACCEPTEE} AS confettis, p.relue_le AS quand, NULL AS jour
  FROM jour_propositions p WHERE p.statut IN ('acceptee', 'retiree')
  UNION ALL
  SELECT p.profile_id, ${CONFETTIS_D_UNE_QUESTION_JOUEE}, NULL, r.posee_le
  FROM jour_propositions p JOIN jour_reserve r ON r.id = p.reserve_id WHERE p.statut = 'acceptee' AND ${JOUEE_ET_COMPTEE}
  UNION ALL
  SELECT p.profile_id, ${CONFETTIS_D_UNE_QUESTION_BIEN_DOSEE}, NULL, date(r.posee_le, '+1 day')
  FROM jour_propositions p JOIN jour_reserve r ON r.id = p.reserve_id WHERE p.statut = 'acceptee' AND ${BIEN_DOSEE}`

/**
 * Les confettis d'une partie du jour : une bonne réponse, un confetti — une
 * question annulée pour tous déjà retirée (`recompter`) —, et la question
 * bonus trouvée (`CONFETTIS_DE_LA_QUESTION_BONUS`), relue de sa colonne : une
 * règle changée vaut pour tout le passé, comme tout confetti.
 */
const CONFETTIS_D_UNE_PARTIE = `(justes + bonus_juste * ${CONFETTIS_DE_LA_QUESTION_BONUS})`

/**
 * Ses confettis du quiz du jour (`justesDe`) : toutes ses bonnes réponses et
 * ses questions bonus trouvées (`CONFETTIS_D_UNE_PARTIE`), et ce que ses
 * questions du public lui rapportent, acceptées, jouées, bien dosées.
 */
function lectureDesJustes(profileId: string): InStatement {
  return {
    sql: `SELECT (SELECT COALESCE(SUM(${CONFETTIS_D_UNE_PARTIE}), 0) FROM jour_parties WHERE profile_id = ?)
               + (SELECT COALESCE(SUM(? + CASE WHEN ${JOUEE_ET_COMPTEE} THEN ? ELSE 0 END + CASE WHEN ${BIEN_DOSEE} THEN ? ELSE 0 END), 0)
                  FROM jour_propositions p LEFT JOIN jour_reserve r ON r.id = p.reserve_id
                  WHERE p.profile_id = ? AND p.statut IN ('acceptee', 'retiree')) AS n`,
    args: [profileId, CONFETTIS_D_UNE_QUESTION_ACCEPTEE, CONFETTIS_D_UNE_QUESTION_JOUEE, CONFETTIS_D_UNE_QUESTION_BIEN_DOSEE, profileId],
  }
}

/**
 * Ce que la salle a fait de la question bonus d'un jour (`jour`, une colonne
 * ou `?`) : ceux qui l'ont jouée, trouvée, et leurs pouces — d'un texte, par
 * l'index des parties d'un jour. Le bilan de son auteur, la page du QG, sa
 * révélation.
 */
const salleDuBonus = (jour: string) => `(SELECT json_array(COUNT(*), COALESCE(SUM(j.bonus_juste), 0), COALESCE(SUM(j.bonus_vote = 1), 0), COALESCE(SUM(j.bonus_vote = -1), 0))
  FROM jour_parties j WHERE j.jour = ${jour} AND j.bonus_le IS NOT NULL)`

/** La salle d'une question bonus, de son texte (`salleDuBonus`). */
function salleLue(brut: unknown): SalleDuBonus {
  const [joueurs, trouvees, pour, contre] = lireNombres(brut)
  return { joueurs: joueurs ?? 0, trouvees: trouvees ?? 0, pour: pour ?? 0, contre: contre ?? 0 }
}

/**
 * Les questions du jour qu'il a signalées et dont sa remarque a servi —
 * corrigée, reclassée, retirée, ses points annulés pour tous —, relues
 * depuis `depuis` : son accueil le remercie, une fois par téléphone. Une
 * question gardée ne dit rien. Par l'index de ses signalements, dans le lot
 * de l'accueil (`accueilDe`).
 */
function lectureDesMercis(profileId: string, depuis: number): InStatement {
  return {
    sql: `SELECT s.jour, s.question, s.traite_le, s.issue, json_extract(t.questions, '$[' || s.question || '].texte') AS texte
          FROM jour_signalements s LEFT JOIN jour_tirages t ON t.jour = s.jour
          WHERE s.profile_id = ? AND s.traite_le >= ? AND s.issue IN (${ISSUES_QUI_SERVENT.map(() => '?').join(', ')})`,
    args: [profileId, depuis, ...ISSUES_QUI_SERVENT],
  }
}

/** Ses mercis, de leur lecture (`lectureDesMercis`). */
function mercisLus(res: ResultSet): AnnonceDeLAdministrateur[] {
  return res.rows.flatMap((r): AnnonceDeLAdministrateur[] => {
    const issue = lireIssue(r.issue)
    if (!issue || issue === 'gardee' || typeof r.texte !== 'string') return []
    return [{ id: `merci:jour:${r.jour}#${r.question}:${r.traite_le}`, sorte: 'merci', mode: 'jour', issue, question: extrait(r.texte, QUESTION_DU_MERCI), le: Number(r.traite_le) }]
  })
}

/**
 * Les questions qu'il a proposées et que le QG a relues depuis `depuis` — ou
 * que le quiz du jour a posées depuis ce jour-là, ou que le QG a retirées de
 * la file depuis : son accueil le lui dit, une fois par téléphone. Posée
 * longtemps après son acceptation — la file du public avance d'une par jour
 * —, elle se lit par son jour ; retirée, par l'instant de son retrait, que la
 * réserve garde (`retiree_le`). Par l'index de ses propositions, dans le lot
 * de l'accueil (`accueilDe`).
 */
function lectureDesPropositionsRelues(profileId: string, depuis: number): InStatement {
  return {
    sql: `SELECT p.id, p.statut, p.motif, p.relue_le, json_extract(p.question, '$.texte') AS texte, r.posee_le, r.retiree_le, r.d_office, ${ANNULEE_POUR_TOUS} AS annulee,
                 EXISTS (SELECT 1 FROM jour_bonus b WHERE b.jour = r.posee_le AND b.reserve_id = r.id) AS en_bonus,
                 EXISTS (SELECT 1 FROM jour_clotures c WHERE c.jour = r.posee_le) AS close,
                 CASE WHEN r.posee_le IS NULL THEN NULL ELSE ${salleDuBonus('r.posee_le')} END AS salle
          FROM jour_propositions p LEFT JOIN jour_reserve r ON r.id = p.reserve_id
          WHERE p.profile_id = ? AND p.statut IN ('acceptee', 'refusee', 'retiree') AND (p.relue_le >= ? OR r.posee_le >= ? OR r.retiree_le >= ?)`,
    args: [profileId, depuis, jourDe(depuis), depuis],
  }
}

/**
 * Ce que l'accueil lui dit de ses questions (`lectureDesPropositionsRelues`) :
 * posée — ou annulée —, acceptée — pas les deux —, refusée, ou retirée de la
 * file avant son jour. Posée en question bonus, le jour clos, son bilan prend
 * la place de la carte du jour : ce que la salle en a fait, et son dosage —
 * sauf annulée pour tous : sa carte le dit, il n'y a rien à juger.
 */
function propositionsRelues(res: ResultSet): AnnonceDeLAdministrateur[] {
  return res.rows.flatMap((r): AnnonceDeLAdministrateur[] => {
    if (typeof r.texte !== 'string') return []
    const question = extrait(r.texte, QUESTION_DU_MERCI)
    const id = String(r.id)
    if (r.statut === 'refusee') {
      return [{ id: `proposition:${id}:refusee`, sorte: 'proposition', issue: 'refusee', question, motif: r.motif == null ? null : String(r.motif), le: Number(r.relue_le) }]
    }
    // Retirée : l'acceptation d'avant se tait, et cette carte-ci se lit sous son nom à elle, même l'autre déjà vue.
    if (r.statut === 'retiree') {
      return [{ id: `proposition:${id}:retiree`, sorte: 'proposition', issue: 'retiree', question, motif: r.motif == null ? null : String(r.motif), le: Number(r.retiree_le ?? r.relue_le) }]
    }
    // Posée, elle dit tout : l'acceptation d'avant ne se redit pas à côté. Annulée ensuite, elle ne paie plus son
    // jour : la carte qui le promettait se tait, et une autre le dit — sous son nom à elle, même déjà vue.
    if (typeof r.posee_le === 'string') {
      const enBonus = Number(r.en_bonus) === 1
      // Le lendemain, son bilan : sous son nom à lui, il se lit même quand la carte du jour a été vue.
      if (enBonus && Number(r.close) === 1 && !Number(r.annulee)) {
        return [{ id: `proposition:${id}:bilan`, sorte: 'proposition', issue: 'bilan', question, motif: null, le: minuitDuJour(jourAvant(r.posee_le, -1)), salle: salleLue(r.salle) }]
      }
      const issue = Number(r.annulee) ? 'annulee' : 'posee'
      return [{ id: `proposition:${id}:${issue}`, sorte: 'proposition', issue, question, motif: null, le: minuitDuJour(r.posee_le), ...(enBonus && { bonus: true as const }) }]
    }
    return [
      { id: `proposition:${id}:acceptee`, sorte: 'proposition', issue: 'acceptee', question, motif: null, le: Number(r.relue_le), ...(Number(r.d_office) === 1 && { dOffice: true as const }) },
    ]
  })
}

/** Le minuit de Paris d'un jour (« 2026-11-02 ») : midi UTC y tombe toujours, et `minuitDe` sait les heures d'été. */
function minuitDuJour(jour: string): number {
  const [annee, mois, j] = jour.split('-').map(Number)
  return minuitDe(Date.UTC(annee, mois - 1, j, 12))
}

/** Une proposition lue de sa colonne : la question telle que le joueur l'a écrite — son anecdote, sa catégorie s'il en a donné —, ou null. */
function questionProposeeLue(brut: unknown): QuestionProposee | null {
  try {
    const q = JSON.parse(String(brut)) as Partial<QuestionProposee>
    if (typeof q.texte !== 'string' || !Array.isArray(q.reponses) || !Number.isInteger(q.bonne)) return null
    const categorie = lireLaCategorie(q.categorie)
    return {
      texte: q.texte,
      reponses: q.reponses.map(String),
      bonne: q.bonne!,
      ...(typeof q.anecdote === 'string' && q.anecdote && { anecdote: q.anecdote }),
      ...(categorie && { categorie }),
    }
  } catch {
    return null
  }
}

/**
 * Une question de la réserve, telle que le quiz du jour la jouera — retouches
 * du QG comprises —, dans les mots d'une proposition : ce que la file du QG
 * montre d'une question qu'il lit (`lireLaQuestionEnFile`). Null : illisible.
 */
function questionDeLaReserve(brut: unknown, categorie: unknown): QuestionProposee | null {
  try {
    const q = JSON.parse(String(brut)) as QuizQuestionDef
    const p = toPlayable({ ...q, id: q.id ?? 'reserve' })
    if (!p || p.kind !== 'choice') return null
    const lue = lireLaCategorie(categorie)
    return { texte: p.text, reponses: p.answers, bonne: p.correct, ...(p.anecdote && { anecdote: p.anecdote }), ...(lue && { categorie: lue }) }
  } catch {
    return null
  }
}

/** Une proposition au QG, son auteur par son profil : la route le nomme. */
export type PropositionLue = Omit<PropositionAuQg, 'auteur'> & { auteurId: string }

/** Une question de la file au QG, son auteur par son profil : la route le nomme. */
export type QuestionEnFileLue = Omit<QuestionEnFile, 'auteur'> & { auteurId: string }

/** Un statut lu de sa colonne ; ce qu'on ne connaît pas se relit à relire. */
function statutLu(brut: unknown): StatutDUneProposition {
  return brut === 'acceptee' || brut === 'refusee' || brut === 'retiree' || brut === 'posee' ? brut : 'en-relecture'
}

/**
 * Ce qui dit si un auteur est de confiance (`estDeConfiance`), d'une ligne :
 * sa dernière question acceptée, sa dernière retirée de la file — l'instant
 * de son retrait, que la réserve garde —, sa dernière question bonus annulée
 * pour tous, et combien des siennes attendent leur jour. Par l'index de ses
 * propositions.
 */
function lectureDeLaConfiance(profileId: string): InStatement {
  return {
    sql: `SELECT
            (SELECT MAX(relue_le) FROM jour_propositions WHERE profile_id = ? AND statut = 'acceptee') AS acceptee,
            (SELECT MAX(r.retiree_le) FROM jour_propositions p JOIN jour_reserve r ON r.id = p.reserve_id
              WHERE p.profile_id = ? AND p.statut = 'retiree') AS retiree,
            (SELECT MAX(CAST(json_extract(b.question, '$.annulee') AS INTEGER)) FROM jour_propositions p JOIN jour_reserve r ON r.id = p.reserve_id
              JOIN jour_bonus b ON b.jour = r.posee_le AND b.reserve_id = r.id WHERE p.profile_id = ? AND p.statut = 'acceptee') AS annulee,
            (SELECT COUNT(*) FROM jour_propositions p JOIN jour_reserve r ON r.id = p.reserve_id
              WHERE p.profile_id = ? AND p.statut = 'acceptee' AND r.posee_le IS NULL AND r.retiree_le IS NULL) AS en_file`,
    args: [profileId, profileId, profileId, profileId],
  }
}

/** Un instant lu d'une colonne : null s'il n'y en a pas. */
const instantLu = (brut: unknown): number | null => (brut == null ? null : Number(brut))

/** Ses questions proposées que « Tes questions » montre, au plus : les plus récentes. */
const PROPOSITIONS_MONTREES = 20
/** Les propositions relues que le QG garde sous les yeux : un mois. */
const JOURS_DES_PROPOSITIONS_RELUES = 30

/** Une ligne de classement avec ce qu'il faut pour la trier et la nommer. */
/** Ce que la vue d'une partie lit sans dépendre d'elle (`contexteDeVue`). */
interface ContexteDeVue {
  serie: number
  serieTenue: boolean
  sabliers: number
  vainqueursDHier: PartieDuJour['vainqueursDHier']
  sonHier: PartieDuJour['sonHier']
  /** Le classement du jour, quand il y a un tirage. */
  joueurs: Joueur[] | null
}

interface Joueur {
  profil: ProfileRec
  points: number
  enCours: boolean
  commenceeLe: number
}

/**
 * La version des règles du quiz du jour que la relecture a appliquées aux
 * jours passés (`relireLesJours`) : 1 depuis les hauts faits du jour, le
 * calendrier, le champion du mois et Chronos (le 5 octobre 2026) ; 2 depuis
 * les timbres des fêtes (le 1er novembre 2026) — les jours d'Halloween 2026
 * rangent le leur. Une règle de plus — un haut fait du jour, un seuil — la
 * fait monter, et tous les jours se relisent au démarrage suivant.
 */
const VERSION_DES_JOURS = 2

/**
 * Un mois ne compte pour le Mois complet que s'il a eu au moins autant de
 * quiz : une réserve à sec un jour ne le ferme pas à tous, mais septembre
 * 2026, ouvert le 26, ne se gagnait pas en cinq jours.
 */
const JOURS_D_UN_MOIS_COMPLET = 28

/** Ce que la nuit décerne (`decernerLaNuit`) : le reste tombe avec la partie, et sa fin l'annonce. */
const CLES_DE_LA_NUIT = new Set(['hf:laurier', 'hf:triomphe', 'hf:phenix-du-jour', 'hf:seul-au-monde', 'hf:lanterne-du-jour', 'hf:eclair-du-jour', 'hf:courant-d-air'])

function estDeLaNuit(cle: string): boolean {
  return CLES_DE_LA_NUIT.has(cle) || /^hf:(champion-du-jour|elite):[123]$/.test(cle)
}

/** Le mois d'avant se raconte les sept premiers jours du mois suivant. */
const JOURS_DU_MOIS_DERNIER = 7

/** Le mois d'avant : « 2026-10 » → « 2026-09 ». */
function moisAvant(mois: string): string {
  const [annee, m] = mois.split('-').map(Number)
  return m === 1 ? `${annee - 1}-12` : `${annee}-${String(m - 1).padStart(2, '0')}`
}

/** « Trouvée par » ne se dit qu'à partir de trois joueurs : à un seul, 100 % ne veut rien dire. */
const TROUVEE_PAR_DES = 3
/** Ce qu'un classement montre ; au-delà, sa propre ligne à part. */
const LIGNES_MONTREES = 50
/** Une question reposée ne revient qu'après ce délai, quand la réserve est à sec. */
const JOURS_AVANT_DE_REPOSER = 30
/** « Voir les prochains jours » : de quoi relire une semaine d'avance. */
const PROCHAINES_MONTREES = 70
/** Un signalement tient en une phrase. */
const SIGNALEMENT_MAX = 280
/**
 * Combien de profils se recomptent en même temps, chacun sous son verrou
 * (`annuler`). Les classements, eux, chargent leurs joueurs d'un coup
 * (`ProfileStore.byIds`).
 */
const PROFILS_EN_VOL = 8
/**
 * Combien d'intitulés la consigne rappelle à l'IA : de quoi éviter les
 * redites de ces dernières semaines sans noyer la consigne. Plus anciennes,
 * l'empreinte écarte encore les copies exactes.
 */
const DEJA_RAPPELEES = 300
/** Les jours qu'une page de profil relit : un mois, de quoi tracer ses courbes. */
const JOURS_RELUS = 30
/**
 * Combien de jours gardent leurs points en mémoire (`pointsGardes`) : les
 * trente derniers de chacun, et de la marge pour ceux qui ont joué plus tôt.
 */
const JOURS_GARDES = 120
/** Combien de tirages restent en mémoire : aujourd'hui, et de quoi revoir la semaine. */
const TIRAGES_GARDES = 8

/**
 * Ce que les réponses de jours qui suivent `?` jusqu'à `?` (compris) ont
 * recueilli, question par question et choix par choix — comme le suivi
 * d'aujourd'hui (`suiviDAujourdhui`), et l'instant de la plus récente : la
 * page des questions du QG (`questionsAuQg`). Par l'index des réponses d'un
 * jour, en un seul texte.
 */
const RECUEIL_DES_JOURS = `SELECT json_group_array(json_array(jour, question, choix, n, ms, chronometrees, le)) AS lignes FROM (
    SELECT jour, question, choix, COUNT(*) AS n, SUM(CASE WHEN choix IS NOT NULL THEN ms END) AS ms,
           COUNT(CASE WHEN choix IS NOT NULL THEN ms END) AS chronometrees, MAX(repondue_le) AS le
    FROM jour_reponses WHERE jour > ? AND jour <= ? GROUP BY jour, question, choix)`

/** Combien de profils gardent leur jour d'hier en mémoire (`sonsHier`) : ceux du jour, et de la marge. */
const SONS_HIER_GARDES = 2000
const HEURE_MS = 3600_000

/** Pas deux fois la même : l'intitulé, sans casse, sans accents, sans ponctuation. */
export function empreinteDe(texte: string): string {
  return sansAccent(texte)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Ce que le quiz du jour sait jouer, seul, sur un téléphone : une question à
 * choix ordinaire, sans photo ni extrait. Les variantes, les estimations —
 * qui demanderont une tolérance écrite, faute de salle pour juger l'écart —
 * et les photos viendront ; d'ici là, la réserve les écarte en le disant.
 */
export function raisonDEcarter(q: QuizQuestionDef): string | null {
  if (q.image || q.photoAttendue) return 'une photo'
  if (q.son) return 'un extrait'
  if (q.kind === 'number') return 'une estimation'
  if (q.variante) return 'une variante'
  return toPlayable(q) ? null : 'incomplète'
}

/** La graine du jour : le mélange des réponses est le même pour tous, et se rejoue à l'identique. */
function graineDe(jour: string): number {
  let h = 2166136261
  for (const c of jour) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  return h
}

/**
 * Les questions du jour parmi les neuves, dans l'ordre d'arrivée — deux au
 * plus par catégorie d'abord, pour mêler les catégories, puis le reste.
 * `deja` : celles que le jour a déjà prises — la question du public —, qui
 * comptent dans leur catégorie.
 */
function choisir<T extends { categorie: string | null }>(neuves: readonly T[], n: number, deja: readonly T[] = []): T[] {
  const parCategorie = new Map<string, number>()
  for (const q of deja) parCategorie.set(q.categorie ?? '', (parCategorie.get(q.categorie ?? '') ?? 0) + 1)
  const choisies: T[] = []
  for (const q of neuves) {
    if (choisies.length >= n) break
    const cle = q.categorie ?? ''
    if ((parCategorie.get(cle) ?? 0) >= 2) continue
    parCategorie.set(cle, (parCategorie.get(cle) ?? 0) + 1)
    choisies.push(q)
  }
  for (const q of neuves) {
    if (choisies.length >= n) break
    if (!choisies.includes(q)) choisies.push(q)
  }
  return choisies
}

export interface JourDeps {
  profiles: ProfileStore
  /** L'heure du serveur : les tests la font passer minuit. */
  maintenant?: () => number
  /** Combien de temps ses bonnes réponses des trente derniers jours se gardent entre deux visites (`LECTURES_GARDEES_MS`) ; le banc, 0. */
  fraicheurDesLecturesMs?: number
}

/** Personne n'a de laurier : la liste d'avant-hier, avant que la nuit soit close. */
const AUCUN_LAURIER: ReadonlySet<string> = new Set()

/** La difficulté mesurée se relit au plus toutes les dix minutes : elle bouge avec les jours, pas avec les clics. */
const MESURES_GARDEES_MS = 10 * 60_000

/** Les dernières questions posées dont la consigne dit la difficulté mesurée. */
const MESUREES_POUR_LA_CONSIGNE = 60

/** Les séries en cours, au QG, se relisent au plus toutes les dix minutes (`seriesEnCours`). */
const SERIES_GARDEES_MS = 10 * 60_000

/** La série d'un profil qui tient encore, telle que le QG la compte. */
export interface SerieDUnProfil {
  profileId: string
  serie: number
  /** Aujourd'hui déjà joué. */
  tenue: boolean
}

export interface SeriesLues {
  /** La plus longue d'abord. */
  series: SerieDUnProfil[]
  sabliersDuMois: number
}

export class JourStore {
  private client: Client
  private maintenant: () => number
  /**
   * Un profil à la fois : deux touches sur la même réponse ne la paient pas
   * deux fois. Tout ce qui écrit ses points ou son expérience passe sous son
   * verrou — sa partie, le recompte d'une annulation, le podium de la nuit —,
   * et le tirage s'y relit : une annulation arrivée entre-temps y est.
   */
  private verrous = new Map<string, Promise<unknown>>()
  /** Les profils masqués du classement, en mémoire : chaque classement les écarte. */
  private masques = new Set<string>()
  /** Monte à chaque masquage : ce qui a été lu sans un masqué ne vaut plus (`sonsHier`). */
  private versionDesMasques = 0
  /** Monte à chaque suspension, à chaque réactivation (`suspensionChangee`) : le premier quart de chaque jour ne compte pas les suspendus. */
  private versionDesSuspensions = 0
  /**
   * Ses jours dans le premier quart (L'Élite), comptés jusqu'à la dernière
   * nuit close (`EliteGardee`) : relus en entier, ils parcouraient chaque
   * jour qu'il a joué avec tous ses joueurs — 2 400 lignes au quota de Turso
   * pour le plus assidu, le 22 octobre 2026, à chaque page du profil, chaque
   * partie, chaque nuit, et davantage chaque jour. Une nuit close ne se
   * réécrit plus (`annuler`) : seules les nuits d'après se lisent.
   */
  private elitesGardees = new Map<string, EliteGardee>()
  /**
   * Ses bonnes réponses par compagnon (`compagnonsDe`), gardées par profil :
   * relues, elles parcouraient toutes ses réponses du quiz du jour à chaque
   * fin de partie, chaque boutique, chaque niche (le 23 octobre 2026). Elles
   * ne changent qu'à une bonne réponse de lui (`enregistrer`) ou à une
   * annulation pour tous (`annuler`) : l'une l'oublie, l'autre monte la
   * version, et une lecture partie avant ne se garde pas.
   */
  private compagnonsGardes = new Map<string, { version: number; lus: Promise<Record<string, number>> }>()
  private versionDesCompagnons = 0
  /**
   * Son jour d'hier, par profil : clos, il ne bouge plus qu'à une annulation
   * (la révision du jour) ou un masquage. Relu à chaque « Question
   * suivante », il coûtait trois allers-retours en série sous les doigts du
   * joueur, pour la même ligne dix fois.
   */
  private sonsHier = new Map<string, { cle: string; valeur: Promise<PartieDuJour['sonHier']> }>()
  /** Le dernier jour dont on sait qu'il n'y a plus rien à clore avant lui. */
  private closJusqua = ''
  /**
   * Les classements, gardés tant que leur jour n'a pas bougé : chaque
   * téléphone qui finit sa partie le demande. Une révision par jour : une
   * seule pour tous faisait relire hier — clos, immobile — à chaque réponse
   * d'aujourd'hui, deux fois par « Question suivante » (les vainqueurs
   * d'hier, et son hier) : 60 % des lignes lues à l'heure de pointe.
   */
  private revisions = new Map<string, number>()
  private classementsGardes = new Map<string, { revision: number; joueurs: Joueur[] }>()
  /** La lecture d'un classement en route : deux demandes de la même vue n'en lancent qu'une. */
  private classementsEnRoute = new Map<string, { revision: number; promesse: Promise<Joueur[]> }>()
  /**
   * Les points de chaque joueur d'un jour, pour y lire des places — gardés
   * sous la révision du jour lue avant la lecture, comme les classements.
   * L'accueil de chaque profil relisait sinon les points de tous les joueurs
   * de ses trente derniers jours : 6 000 lignes par visite à deux cents
   * joueurs par jour.
   */
  private pointsGardes = new Map<string, { revision: number; points: { id: string; points: number }[] }>()
  /**
   * Les tirages lus : figés à la première demande, ils ne changent plus que
   * par une annulation, qui remet le sien à jour sous son verrou
   * (`annuler`). Relu à chaque geste, le tirage du jour — cinq kilo-octets —
   * repartait de Turso à chaque réponse, à chaque question suivante, et une
   * fois par joueur pour une annulation.
   */
  private tiragesGardes = new Map<string, Tirage>()
  /** Le jour de Paris de l'heure en cours (`joursDeLHeure`). */
  private joursGardes: { heure: number; aujourdhui: string; hier: string } | null = null
  /**
   * Les vainqueurs d'un jour clos, et ce jour : le laurier de ceux d'hier
   * (`laureats`). Relus à la nuit, une fois — ils servent à chaque
   * diffusion à toute la salle.
   */
  private lauriers: { jour: string; ids: ReadonlySet<string> } = { jour: '', ids: AUCUN_LAURIER }
  /** Une relecture des lauriers en route : une rafale de diffusions n'en lance qu'une. */
  private lauriersEnRoute: Promise<void> | null = null
  /**
   * Les champions du mois dernier, et ce mois : sa carte le dit tout le mois
   * suivant, et l'écran commun les salue à leur entrée (`champions`). Relus
   * quand un mois se clôt, une fois — ils servent à chaque diffusion.
   */
  private championsDuMois: { mois: string; ids: ReadonlySet<string> } = { mois: '', ids: AUCUN_LAURIER }
  /** Le mois en cours au dernier passage de la nuit : les mois d'avant sont clos jusque-là (`cloreLesMois`). */
  private moisClosAvant = ''
  private ferme = false
  /**
   * Un laurier est tombé ou s'est posé sur ce profil : la salle des soirées
   * où il joue se rediffuse. Branché par le serveur, qui connaît les salles.
   */
  laurierChange?: (profileId: string) => void
  /**
   * Cette question est-elle dans la base de la campagne (`baseCampagne.ts`) ?
   * Le quiz du jour ne pose pas ce que la campagne a déjà donné, ni l'inverse
   * (`empreintes`) : l'un gâcherait l'autre. Branché après le démarrage —
   * l'amorce des quiz livrés n'en a pas besoin, la base les écarte déjà, et
   * un démarrage ne lit pas la base pour rien.
   */
  dansLaCampagne?: (empreinte: string) => Promise<boolean>
  /** Les intitulés de la réserve, pour la campagne qui les évite : relus au plus toutes les dix minutes, et après chaque apport. */
  private empreintesGardees: { a: number; empreintes: ReadonlySet<string> } | null = null
  /**
   * Ses bonnes réponses de ses trente derniers jours, gardées par profil
   * entre deux visites (`lecturesDeLaCarriere`) : l'accueil et la page du
   * profil les relisaient à chaque fois — 387 lignes au quota de Turso, la
   * deuxième lecture de chaque accueil en production (le 3 novembre 2026).
   * Seule sa réponse les change (`enregistrer`), et les oublie : une
   * annulation se lit à part, sur ses parties relues (`joursJoues`), et un
   * jour qui commence n'a pas encore de bonne réponse.
   */
  private readonly justesGardees: LecturesGardees<readonly JusteDUnJour[]>
  /**
   * Ce que le quiz du jour sait de lui, catégorie par catégorie (`savoirDe`),
   * gardé de même : la page du profil et chaque carte qu'on ouvre de lui le
   * relisaient — 1 079 lignes pour un fidèle, 4,7 % du quota de la version
   * du 3 novembre 2026. Sa réponse l'oublie, et un tirage qui change pour
   * tous — une question annulée, corrigée — oublie celui de chacun
   * (`tirageChange`).
   */
  private readonly savoirsGardes: LecturesGardees<Savoir>
  /**
   * Ses bonnes réponses par jour et par catégorie depuis le lundi d'avant, que
   * ses missions jugent (`activiteDepuis`), gardées de même — sous la semaine
   * qu'elles lisent : l'accueil et chaque fin de partie les relisaient, 2,9 %
   * du quota de la même version.
   */
  private readonly categoriesGardees: LecturesGardees<JournauxDesJours['jourParCategorie']>
  /**
   * Ses jours joués et ses sabliers des 400 derniers jours, de quoi compter sa
   * série (`serieGardee`) : chaque « Question suivante » les relisait —
   * jusqu'à 400 jours, ses soirées et ses sabliers, dix fois par partie
   * (`contexteDeVue`). Ils ne bougent qu'avec lui : une partie qu'il commence
   * (`commencer`), une soirée créditée ou retirée, un sablier acheté — que le
   * magasin des profils dit (`ProfileStore.serieChangee`, branché par
   * `server.ts`) —, et le jour qui change (sa variante). L'achat d'un sablier
   * relit toujours la base (`sabliersDe`) : c'est une écriture, pas une vue.
   */
  private readonly joursDeSerieGardes: LecturesGardees<JoursDeLaSerie>

  constructor(
    url: string,
    authToken: string | undefined,
    private deps: JourDeps,
  ) {
    this.client = clientDistant(url, authToken)
    this.maintenant = deps.maintenant ?? Date.now
    const fraicheur = deps.fraicheurDesLecturesMs ?? LECTURES_GARDEES_MS
    const maintenant = () => this.maintenant()
    this.justesGardees = new LecturesGardees(fraicheur, maintenant, lignes => lignes.map(r => ({ jour: String(r.jour), question: Number(r.question), ms: Number(r.ms ?? 0) })))
    this.savoirsGardes = new LecturesGardees(fraicheur, maintenant, savoirDesLignes)
    this.categoriesGardees = new LecturesGardees(fraicheur, maintenant, lignes =>
      lignes.map(r => ({ jour: String(r.jour), categorie: r.categorie == null ? null : String(r.categorie), n: Number(r.n) })),
    )
    this.joursDeSerieGardes = new LecturesGardees(fraicheur, maintenant, joursDeLaSerie)
  }

  /** Sa série a pu changer hors du quiz du jour — une soirée créditée ou retirée, un sablier acheté : sa vue suivante la relit. */
  oublierLaSerie(profileId: string): void {
    this.joursDeSerieGardes.oublier(profileId)
  }

  /** Un tirage vient de changer pour tous — une question annulée, corrigée : ce que chacun en gardait se relit. */
  private tirageChange(): void {
    this.savoirsGardes.oublierTout()
    this.categoriesGardees.oublierTout()
  }

  async init() {
    await this.client.batch(
      [
        // La réserve : chaque question une fois, reconnue à son intitulé.
        `CREATE TABLE IF NOT EXISTS jour_reserve (
           id         TEXT PRIMARY KEY,
           question   TEXT NOT NULL,
           empreinte  TEXT NOT NULL UNIQUE,
           categorie  TEXT,
           source     TEXT NOT NULL,
           ajoutee_le INTEGER NOT NULL,
           posee_le   TEXT,
           retiree_le INTEGER
         )`,
        `CREATE INDEX IF NOT EXISTS idx_jour_reserve_posee ON jour_reserve(posee_le, ajoutee_le)`,
        // Ce que chaque apport a ajouté et écarté : le journal de l'administration.
        `CREATE TABLE IF NOT EXISTS jour_apports (
           id       TEXT PRIMARY KEY,
           quand    INTEGER NOT NULL,
           source   TEXT NOT NULL,
           ajoutees INTEGER NOT NULL,
           ecartees TEXT NOT NULL
         )`,
        // Le tirage d'un jour, figé : la copie jouée, telle quelle, pour tous.
        `CREATE TABLE IF NOT EXISTS jour_tirages (
           jour      TEXT PRIMARY KEY,
           questions TEXT NOT NULL,
           annulees  TEXT NOT NULL DEFAULT '[]',
           tire_le   INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS jour_parties (
           profile_id   TEXT NOT NULL,
           jour         TEXT NOT NULL,
           commencee_le INTEGER NOT NULL,
           question     INTEGER NOT NULL,
           servie_le    INTEGER,
           points       INTEGER NOT NULL DEFAULT 0,
           justes       INTEGER NOT NULL DEFAULT 0,
           finie_le     INTEGER,
           xp           INTEGER NOT NULL DEFAULT 0,
           PRIMARY KEY (profile_id, jour)
         )`,
        `CREATE INDEX IF NOT EXISTS idx_jour_parties_jour ON jour_parties(jour)`,
        `CREATE TABLE IF NOT EXISTS jour_reponses (
           profile_id  TEXT NOT NULL,
           jour        TEXT NOT NULL,
           question    INTEGER NOT NULL,
           choix       INTEGER,
           ms          INTEGER,
           juste       INTEGER NOT NULL,
           points      INTEGER NOT NULL,
           repondue_le INTEGER NOT NULL,
           PRIMARY KEY (profile_id, jour, question)
         )`,
        `CREATE INDEX IF NOT EXISTS idx_jour_reponses_question ON jour_reponses(jour, question)`,
        // La nuit a clos ce jour : son podium est payé, une fois.
        `CREATE TABLE IF NOT EXISTS jour_clotures (
           jour     TEXT PRIMARY KEY,
           joueurs  INTEGER NOT NULL,
           close_le INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS jour_podiums (
           jour       TEXT NOT NULL,
           profile_id TEXT NOT NULL,
           rang       INTEGER NOT NULL,
           points     INTEGER NOT NULL,
           xp         INTEGER NOT NULL,
           PRIMARY KEY (jour, profile_id)
         )`,
        `CREATE INDEX IF NOT EXISTS idx_jour_podiums_profil ON jour_podiums(profile_id)`,
        // Le coffre du mois de chacun, figé à la clôture du mois : sa place
        // au classement (`shared/coffre.ts`). Écrit une fois, jamais modifié —
        // un masquage ou une annulation d'après ne reprend pas un coffre.
        `CREATE TABLE IF NOT EXISTS jour_coffres_du_mois (
           mois       TEXT NOT NULL,
           profile_id TEXT NOT NULL,
           place      INTEGER NOT NULL,
           points     INTEGER NOT NULL,
           PRIMARY KEY (mois, profile_id)
         )`,
        `CREATE INDEX IF NOT EXISTS idx_jour_coffres_du_mois_profil ON jour_coffres_du_mois(profile_id)`,
        `CREATE TABLE IF NOT EXISTS jour_signalements (
           jour       TEXT NOT NULL,
           question   INTEGER NOT NULL,
           profile_id TEXT NOT NULL,
           texte      TEXT NOT NULL,
           cree_le    INTEGER NOT NULL,
           traite_le  INTEGER,
           PRIMARY KEY (jour, question, profile_id)
         )`,
        // Ses signalements relus ce dernier mois, que chaque accueil relit pour
        // le remercier (`mercisDe`) : sans index, la table entière à chaque visite.
        'CREATE INDEX IF NOT EXISTS idx_jour_signalements_profil ON jour_signalements(profile_id, traite_le)',
        `CREATE TABLE IF NOT EXISTS jour_masques (
           profile_id TEXT PRIMARY KEY,
           masque_le  INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS jour_meta (
           cle    TEXT PRIMARY KEY,
           valeur TEXT NOT NULL
         )`,
        // Les questions que les joueurs proposent (`shared/propositions.ts`) :
        // à relire, puis acceptées — elles rejoignent la réserve, signées —
        // ou refusées, avec leur motif. Ses propositions par profil (« Tes
        // questions », son accueil), celles à relire par leur statut (le QG).
        `CREATE TABLE IF NOT EXISTS jour_propositions (
           id          TEXT PRIMARY KEY,
           profile_id  TEXT NOT NULL,
           question    TEXT NOT NULL,
           proposee_le INTEGER NOT NULL,
           statut      TEXT NOT NULL,
           motif       TEXT,
           relue_le    INTEGER,
           reserve_id  TEXT
         )`,
        'CREATE INDEX IF NOT EXISTS idx_jour_propositions_profil ON jour_propositions(profile_id, proposee_le)',
        'CREATE INDEX IF NOT EXISTS idx_jour_propositions_statut ON jour_propositions(statut, proposee_le)',
        // La question bonus d'un jour (le 8 novembre 2026) : la question du
        // public, tirée avec le jour et figée comme lui, mais à part des dix —
        // ni dans leurs points, ni dans leurs index, que tant de lectures
        // parcourent (`json_each(t.questions)`). Une table plutôt qu'une
        // colonne de `jour_tirages` : la colonne aurait coûté une lecture de
        // son schéma à chaque réveil (`ajouterColonne`).
        `CREATE TABLE IF NOT EXISTS jour_bonus (
           jour       TEXT PRIMARY KEY,
           reserve_id TEXT NOT NULL,
           question   TEXT NOT NULL
         )`,
      ],
      'write',
    )
    // Les métadonnées d'une question — sous-thème, étiquettes, difficulté
    // estimée, public… (`shared/etiquettes.ts`) — sont venues après la
    // réserve : une base d'avant ne les a pas.
    await ajouterColonne(this.client, 'jour_reserve', 'metadonnees', 'TEXT')
    await ajouterColonne(this.client, 'jour_reserve', 'etiquetee_le', 'INTEGER')
    // Le bonus de série d'une partie (`xpDeSerie`), venu le 6 octobre 2026 :
    // écrit quand elle commence, à côté de l'expérience de ses points.
    await ajouterColonne(this.client, 'jour_parties', 'xp_serie', 'INTEGER NOT NULL DEFAULT 0')
    // La question bonus d'une partie (le 8 novembre 2026), à côté d'elle : sa
    // ligne se lit déjà à chaque geste, et ce qu'elle rapporte s'additionne
    // avec le reste — ses confettis (`CONFETTIS_D_UNE_PARTIE`), son expérience
    // (`lecturesDeLExperience`). Le schéma de la table est déjà lu : rien de
    // plus au réveil.
    await ajouterColonne(this.client, 'jour_parties', 'bonus_servie_le', 'INTEGER')
    await ajouterColonne(this.client, 'jour_parties', 'bonus_le', 'INTEGER')
    await ajouterColonne(this.client, 'jour_parties', 'bonus_choix', 'INTEGER')
    await ajouterColonne(this.client, 'jour_parties', 'bonus_juste', 'INTEGER NOT NULL DEFAULT 0')
    await ajouterColonne(this.client, 'jour_parties', 'xp_bonus', 'INTEGER NOT NULL DEFAULT 0')
    await ajouterColonne(this.client, 'jour_parties', 'bonus_vote', 'INTEGER')
    // Le compagnon de sa niche à chaque réponse (`compagnonsDe`) — venu le 13
    // octobre 2026, celui qu'il portait jusqu'au 18 : ses bonnes réponses le
    // font grandir.
    await ajouterColonne(this.client, 'jour_reponses', 'compagnon', 'TEXT')
    // Ce qu'un geste du QG a fait d'une question signalée, et comment
    // (`IssueDUnSignalement`), venus le 14 octobre 2026 avec la page des
    // signalements : son historique les relit, et le joueur dont la remarque
    // a servi l'apprend sur son accueil. Relus avant, ils n'en ont pas.
    await ajouterColonne(this.client, 'jour_signalements', 'issue', 'TEXT')
    await ajouterColonne(this.client, 'jour_signalements', 'detail', 'TEXT')
    // Le profil qui a proposé une question de la réserve (`source = 'public'`),
    // venu le 2 novembre 2026 avec les questions du public : le tirage la
    // pose une par jour au plus, signée, et son auteur ne la joue pas.
    await ajouterColonne(this.client, 'jour_reserve', 'auteur', 'TEXT')
    // Le profil de l'administrateur qui l'a acceptée (le 8 novembre 2026) :
    // il en connaît la réponse, la question bonus ne se joue pas pour lui.
    await ajouterColonne(this.client, 'jour_reserve', 'relecteur', 'TEXT')
    // Passée d'office, sans relecture (le 9 novembre 2026) : son auteur était
    // de confiance (`proposer`). Le QG la montre close dans la file, et le dit.
    // Sur la réserve plutôt que sur la proposition : le schéma de
    // `jour_reserve` est déjà lu, celui de `jour_propositions` coûterait une
    // lecture de plus à chaque réveil.
    await ajouterColonne(this.client, 'jour_reserve', 'd_office', 'INTEGER NOT NULL DEFAULT 0')
    for (const r of (await this.client.execute('SELECT profile_id FROM jour_masques')).rows) this.masques.add(String(r.profile_id))
    await this.amorcer()
  }

  // ── Les métadonnées et la difficulté mesurée ────────────────────────────

  /**
   * Les questions de la réserve qui n'ont pas encore leurs métadonnées, pour
   * la routine qui les décrit (`/api/jour/reserve/etiquetage`) : celles qui
   * sortiront bientôt d'abord, puis les déjà posées.
   */
  async aEtiqueter(n: number): Promise<{ id: string; texte: string; reponses: string[]; bonne: number; anecdote: string | null; categorie: string | null }[]> {
    const res = await this.client.execute({
      sql: `SELECT id, question, categorie FROM jour_reserve WHERE retiree_le IS NULL AND etiquetee_le IS NULL
            ORDER BY posee_le IS NOT NULL, ajoutee_le, id LIMIT ?`,
      args: [n],
    })
    return res.rows.flatMap(r => {
      const q = JSON.parse(String(r.question)) as QuizQuestionDef
      const p = toPlayable({ ...q, id: String(r.id) })
      if (!p || p.kind !== 'choice') return []
      return [{ id: String(r.id), texte: p.text, reponses: p.answers, bonne: p.correct, anecdote: p.anecdote ?? null, categorie: r.categorie == null ? null : String(r.categorie) }]
    })
  }

  /**
   * Range ce que la routine rend : chaque entrée relue par le catalogue
   * (`lireEtiquetage`), refusée en entier sur une clé inconnue, et la
   * question marquée étiquetée — hors de la base comprise (une photo à
   * regarder, des prénoms à remplacer) : on ne la redemande pas.
   */
  async etiqueter(entrees: readonly unknown[]): Promise<{ etiquetees: number; horsBase: number; refusees: { id: string; motif: string }[] }> {
    const ids = entrees.map(e => (e && typeof e === 'object' ? String((e as { id?: unknown }).id ?? '') : ''))
    const connues = new Set(
      ids.length === 0
        ? []
        : (
            await this.client.execute({
              sql: `SELECT id FROM jour_reserve WHERE id IN (${ids.map(() => '?').join(', ')})`,
              args: ids,
            })
          ).rows.map(r => String(r.id)),
    )
    const maintenant = this.maintenant()
    const ecritures: InStatement[] = []
    const refusees: { id: string; motif: string }[] = []
    let etiquetees = 0
    let horsBase = 0
    entrees.forEach((e, i) => {
      const id = ids[i]
      if (!connues.has(id)) return refusees.push({ id, motif: 'question inconnue' })
      const lu = lireEtiquetage(e)
      if ('refus' in lu) return refusees.push({ id, motif: lu.refus })
      const meta = 'horsBase' in lu ? { horsBase: lu.horsBase } : lu.meta
      if ('horsBase' in lu) horsBase++
      else etiquetees++
      ecritures.push({ sql: 'UPDATE jour_reserve SET metadonnees = ?, etiquetee_le = ? WHERE id = ?', args: [JSON.stringify(meta), maintenant, id] })
    })
    if (ecritures.length > 0) await this.client.batch(ecritures, 'write')
    return { etiquetees, horsBase, refusees }
  }

  private mesuresGardees: { a: number; parQuestion: Map<string, { justes: number; total: number }> } | null = null

  /**
   * La part de joueurs qui ont trouvé chaque question posée, par identifiant
   * de la réserve : la difficulté que la consigne ne sait pas deviner. Les
   * réponses se rapportent à leur question par le tirage de leur jour ; une
   * question annulée ne dit rien. Relue au plus toutes les dix minutes.
   */
  async mesures(): Promise<Map<string, { justes: number; total: number }>> {
    if (this.mesuresGardees && this.maintenant() - this.mesuresGardees.a < MESURES_GARDEES_MS) return this.mesuresGardees.parQuestion
    const [tirages, reponses] = await Promise.all([
      this.client.execute('SELECT jour, questions, annulees FROM jour_tirages'),
      this.client.execute('SELECT jour, question, SUM(juste) AS justes, COUNT(*) AS total FROM jour_reponses GROUP BY jour, question'),
    ])
    const idDe = new Map<string, string>()
    for (const t of tirages.rows) {
      let questions: { reserveId?: string }[] = []
      let annulees: number[] = []
      try {
        questions = JSON.parse(String(t.questions))
        annulees = JSON.parse(String(t.annulees ?? '[]'))
      } catch {
        continue
      }
      questions.forEach((q, i) => q.reserveId && !annulees.includes(i) && idDe.set(`${t.jour}#${i}`, q.reserveId))
    }
    const parQuestion = new Map<string, { justes: number; total: number }>()
    for (const r of reponses.rows) {
      const id = idDe.get(`${r.jour}#${r.question}`)
      if (!id) continue
      const avant = parQuestion.get(id) ?? { justes: 0, total: 0 }
      parQuestion.set(id, { justes: avant.justes + Number(r.justes), total: avant.total + Number(r.total) })
    }
    this.mesuresGardees = { a: this.maintenant(), parQuestion }
    return parQuestion
  }

  /** La difficulté mesurée des dernières questions posées, assez jouées pour se mesurer. */
  async difficultesRecentes(): Promise<MesureDesJoueurs> {
    const [mesures, posees] = await Promise.all([
      this.mesures(),
      this.client.execute({
        sql: "SELECT id, json_extract(question, '$.text') AS texte FROM jour_reserve WHERE posee_le IS NOT NULL ORDER BY posee_le DESC LIMIT ?",
        args: [MESUREES_POUR_LA_CONSIGNE],
      }),
    ])
    const compte: Record<Niveau, number> = { facile: 0, moyen: 0, difficile: 0, expert: 0 }
    const questions: QuestionMesuree[] = []
    for (const r of posees.rows) {
      const m = mesures.get(String(r.id))
      const n = m && niveauMesure(m.justes, m.total)
      if (!n) continue
      compte[n]++
      questions.push({ texte: String(r.texte ?? ''), part: m.justes / m.total })
    }
    // La moyenne des parts, question par question : une question jouée par
    // trente ne pèse pas plus qu'une jouée par dix — chacune est un dixième
    // d'une partie.
    const part = questions.length > 0 ? questions.reduce((s, q) => s + q.part, 0) / questions.length : undefined
    return { ...compte, part, questions: questions.filter(q => q.texte) }
  }

  close() {
    this.ferme = true
    this.client.close()
  }

  // ── La réserve ──────────────────────────────────────────────────────────

  /**
   * Au tout premier démarrage, la réserve prend les questions des quiz livrés
   * qui se jouent seuls — culture générale, vrai ou faux… —, jamais ceux à
   * personnaliser (« L'anniversaire de [Prénom] »), ni ceux des animateurs.
   * Tout animateur peut pourtant partir des livrés : leurs questions ne
   * sortent qu'en dernier recours (`tirer`) — les premiers jours d'une
   * réserve neuve, ou quand elle n'a plus rien d'autre à poser. Une fois :
   * une question retirée ne revient pas au démarrage suivant.
   */
  private async amorcer() {
    const deja = await this.client.execute({ sql: 'SELECT valeur FROM jour_meta WHERE cle = ?', args: ['amorcee'] })
    if (deja.rows.length > 0) return
    // Seulement ce qui se joue seul : le journal de l'administration dirait
    // sinon « 32 écartées » de questions que personne n'a proposées.
    const questions = lireModeles()
      .filter(m => !m.personnaliser)
      .flatMap(m => normalizeQuestions(m.questions))
      .filter(q => !raisonDEcarter(q))
    // Le drapeau part dans le lot de l'apport : écrit à part, une panne entre
    // les deux refaisait l'amorce au démarrage suivant, qui consignait un
    // second apport — « 0 ajoutée, 38 écartées » au journal de `/admin`.
    const { ajoutees } = await this.ajouter(questions, 'livre', n => ({
      sql: 'INSERT OR IGNORE INTO jour_meta (cle, valeur) VALUES (?, ?)',
      args: ['amorcee', String(n)],
    }))
    if (ajoutees > 0) console.log(`[jour] réserve amorcée : ${ajoutees} questions des quiz livrés`)
  }

  /**
   * Ajoute des questions à la réserve. Celles que le quiz du jour ne sait pas
   * jouer, et celles qu'elle a déjà, sont écartées — et dites.
   */
  async ajouter(
    questions: readonly QuizQuestionDef[],
    source: 'livre' | 'liste' | 'ia' | 'public',
    /** Ce qui s'écrit avec l'apport, dans le même lot : le drapeau de l'amorce, la proposition acceptée. */
    avecLui?: (ajoutees: number) => InStatement,
    /** Le profil qui l'a proposée : une question du public (`accepterLaProposition`). */
    auteur: string | null = null,
    /** Le profil de l'administrateur qui l'a acceptée : il ne la jouera pas. */
    relecteur: string | null = null,
    /** Acceptée d'office, sans relecture : son auteur est de confiance (`proposer`). */
    dOffice = false,
  ): Promise<{ ajoutees: number; ecartees: { texte: string; raison: string }[] }> {
    const ecartees: { texte: string; raison: string }[] = []
    const vues = new Set<string>()
    const candidates: { id: string; question: QuizQuestionDef; empreinte: string }[] = []
    for (const q of questions) {
      const texte = tronquer((q.text ?? '').trim(), 120)
      const raison = raisonDEcarter(q)
      if (raison) {
        ecartees.push({ texte, raison })
        continue
      }
      const empreinte = empreinteDe(q.text)
      if (vues.has(empreinte)) {
        ecartees.push({ texte, raison: 'en double' })
        continue
      }
      vues.add(empreinte)
      if (await this.dansLaCampagne?.(empreinte)) {
        ecartees.push({ texte, raison: 'déjà dans la campagne' })
        continue
      }
      const id = randomUUID()
      candidates.push({ id, question: { ...q, id }, empreinte })
    }
    const connues = new Set<string>()
    for (let i = 0; i < candidates.length; i += 200) {
      const lot = candidates.slice(i, i + 200)
      const res = await this.client.execute({
        sql: `SELECT empreinte FROM jour_reserve WHERE empreinte IN (${lot.map(() => '?').join(', ')})`,
        args: lot.map(c => c.empreinte),
      })
      for (const r of res.rows) connues.add(String(r.empreinte))
    }
    const neuves = candidates.filter(c => {
      if (!connues.has(c.empreinte)) return true
      ecartees.push({ texte: tronquer(c.question.text.trim(), 120), raison: 'déjà dans la réserve' })
      return false
    })
    const quand = this.maintenant()
    await this.client.batch(
      [
        ...neuves.map((c, i) => ({
          sql: `INSERT OR IGNORE INTO jour_reserve (id, question, empreinte, categorie, source, ajoutee_le, auteur, relecteur, d_office) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          // Une milliseconde d'écart par question : la réserve garde l'ordre de la liste.
          args: [c.id, JSON.stringify(c.question), c.empreinte, c.question.category ?? null, source, quand + i, auteur, relecteur, dOffice ? 1 : 0],
        })),
        {
          sql: 'INSERT INTO jour_apports (id, quand, source, ajoutees, ecartees) VALUES (?, ?, ?, ?, ?)',
          args: [randomUUID(), quand, source, neuves.length, JSON.stringify(ecartees.slice(0, 50))],
        },
        ...(avecLui ? [avecLui(neuves.length)] : []),
      ],
      'write',
    )
    if (neuves.length > 0) this.empreintesGardees = null
    return { ajoutees: neuves.length, ecartees }
  }

  /**
   * Les intitulés de toute la réserve — posés, à venir ou retirés : la
   * campagne n'en pose aucun (`core/campagne.ts`). Une question à venir
   * gâcherait le quiz du jour de demain, une question passée a été vue et
   * corrigée par ceux qui jouent chaque matin.
   */
  async empreintes(): Promise<ReadonlySet<string>> {
    const garde = this.empreintesGardees
    if (garde && this.maintenant() - garde.a < MESURES_GARDEES_MS) return garde.empreintes
    const res = await this.client.execute('SELECT empreinte FROM jour_reserve')
    const lues = new Set(res.rows.map(r => String(r.empreinte)))
    // Inchangée, la même instance : la campagne garde ce qu'elle en a tiré —
    // ses jouables, leurs sujets, la préparation de ses tirages — tant
    // qu'elle la reçoit (`CampagneStore.jouables`). Relue en un ensemble neuf
    // toutes les dix minutes, elle refaisait tout, vingt-quatre mille
    // questions repassées au crible pour une réserve qui ne change qu'au
    // matin.
    const avant = garde?.empreintes
    const empreintes = avant && avant.size === lues.size && [...lues].every(e => avant.has(e)) ? avant : lues
    this.empreintesGardees = { a: this.maintenant(), empreintes }
    return empreintes
  }

  /** Ce que l'administration montre de la réserve : les jours d'avance, et ce que les derniers apports ont fait. */
  async etatDeLaReserve(): Promise<{
    pretes: number
    joursDAvance: number
    posees: number
    retirees: number
    apports: { quand: number; source: string; ajoutees: number; ecartees: { texte: string; raison: string }[] }[]
  }> {
    const [compte, apports] = await this.client.batch(
      [
        `SELECT
           SUM(CASE WHEN retiree_le IS NULL AND posee_le IS NULL AND source <> 'public' THEN 1 ELSE 0 END) AS pretes,
           SUM(CASE WHEN retiree_le IS NULL AND posee_le IS NOT NULL THEN 1 ELSE 0 END) AS posees,
           SUM(CASE WHEN retiree_le IS NOT NULL THEN 1 ELSE 0 END) AS retirees
         FROM jour_reserve`,
        'SELECT quand, source, ajoutees, ecartees FROM jour_apports ORDER BY quand DESC LIMIT 8',
      ],
      'read',
    )
    const pretes = Number(compte.rows[0]?.pretes ?? 0)
    return {
      pretes,
      joursDAvance: Math.floor(pretes / QUESTIONS_PAR_JOUR),
      posees: Number(compte.rows[0]?.posees ?? 0),
      retirees: Number(compte.rows[0]?.retirees ?? 0),
      apports: apports.rows.map(r => ({
        quand: Number(r.quand),
        source: String(r.source),
        ajoutees: Number(r.ajoutees),
        ecartees: lireListe(r.ecartees),
      })),
    }
  }

  /**
   * La réserve pour la page « Réserves et base » du QG (`/admin#reserves`) :
   * ce que `etatDeLaReserve` en dit, ses questions prêtes catégorie par
   * catégorie — celles du public mises à part, elles ont leur file —, et ce qui
   * y est entré chaque jour de ces deux semaines, la routine du matin à part.
   * Les prêtes par l'index des questions pas encore posées ; les apports, une
   * poignée par jour, comme `etatDeLaReserve` les lit.
   */
  async reserveAuQg(): Promise<Omit<ReserveDuJourAuQg, 'remplissage'>> {
    const aujourdhui = jourDe(this.maintenant())
    const jours = Array.from({ length: JOURS_DES_APPORTS }, (_, k) => jourAvant(aujourdhui, JOURS_DES_APPORTS - 1 - k))
    const [etat, [categories, apports]] = await Promise.all([
      this.etatDeLaReserve(),
      this.client.batch(
        [
          "SELECT categorie, COUNT(*) AS n FROM jour_reserve WHERE posee_le IS NULL AND retiree_le IS NULL AND source <> 'public' GROUP BY categorie",
          // Une journée de marge avant le premier jour : un minuit de Paris tombe à 22 h ou 23 h UTC, et l'instant se range au jour de Paris dessous.
          { sql: 'SELECT quand, source, ajoutees FROM jour_apports WHERE quand >= ?', args: [Date.parse(`${jours[0]}T00:00:00Z`) - 86_400_000] },
        ],
        'read',
      ),
    ])
    const parJour = new Map(jours.map(jour => [jour, { jour, routine: 0, autres: 0 }]))
    for (const r of apports.rows) {
      const j = parJour.get(jourDe(Number(r.quand)))
      if (!j) continue
      if (r.source === 'ia') j.routine += Number(r.ajoutees)
      else j.autres += Number(r.ajoutees)
    }
    return {
      ...etat,
      parCategorie: categories.rows
        .map(r => ({ categorie: r.categorie === null || r.categorie === undefined ? null : String(r.categorie), pretes: Number(r.n) }))
        .sort((a, b) => b.pretes - a.pretes || String(a.categorie ?? '').localeCompare(String(b.categorie ?? ''), 'fr')),
      parJour: [...parJour.values()],
    }
  }

  /**
   * La consigne à donner à une IA (`core/consigne.ts`), et combien il reste à
   * écrire pour tenir trois semaines d'avance. Elle rappelle les intitulés
   * déjà là — les prêts d'abord, puis les derniers posés — et les catégories
   * les moins fournies. `n` : combien en demander, sinon ce qu'il manque.
   */
  async consigne(n?: number): Promise<{ joursDAvance: number; aEcrire: number; consigne: string }> {
    const [compte, textes] = await this.client.batch(
      [
        // Les questions du public ne sortent qu'une par jour : elles ne font pas des jours d'avance.
        "SELECT categorie, COUNT(*) AS n FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NULL AND source <> 'public' GROUP BY categorie",
        {
          sql: `SELECT json_extract(question, '$.text') AS texte FROM jour_reserve WHERE retiree_le IS NULL
                ORDER BY posee_le IS NOT NULL, posee_le DESC, ajoutee_le DESC LIMIT ?`,
          args: [DEJA_RAPPELEES],
        },
      ],
      'read',
    )
    const parCategorie: Record<string, number> = {}
    let pretes = 0
    for (const r of compte.rows) {
      parCategorie[r.categorie == null ? '' : String(r.categorie)] = Number(r.n)
      pretes += Number(r.n)
    }
    const joursDAvance = Math.floor(pretes / QUESTIONS_PAR_JOUR)
    const aEcrire = aEcrirePour(joursDAvance)
    // Ce que disent les joueurs : la difficulté qu'une IA ne sait pas juger
    // seule. Une base muette ne prive pas la routine de sa consigne.
    const mesure = await this.difficultesRecentes().catch(() => undefined)
    return {
      joursDAvance,
      aEcrire,
      consigne: consigneDuJour({
        n: n ?? aEcrire,
        aPrivilegier: categoriesAPrivilegier(parCategorie),
        deja: textes.rows.map(r => String(r.texte ?? '')).filter(Boolean),
        mesure,
      }),
    }
  }

  /**
   * Les prochaines questions, dans l'ordre où la réserve les tirera — pour
   * l'administrateur seul. Sans celles du public, qui ont leur file à elles,
   * une par jour (`tirer`) : la page des questions du public les compte.
   */
  async prochaines(): Promise<{ id: string; question: QuizQuestionDef; source: string }[]> {
    const res = await this.client.execute({
      sql: `SELECT id, question, source FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NULL AND source <> 'public'
            ORDER BY source = 'livre', ajoutee_le, id LIMIT ?`,
      args: [PROCHAINES_MONTREES],
    })
    return res.rows.map(r => ({ id: String(r.id), question: JSON.parse(String(r.question)), source: String(r.source) }))
  }

  /** L'intitulé d'une question de la réserve : ce que le journal du QG en dit quand on la retire. */
  async texteDeLaReserve(reserveId: string): Promise<string | null> {
    const res = await this.client.execute({ sql: "SELECT json_extract(question, '$.text') AS texte FROM jour_reserve WHERE id = ?", args: [reserveId] })
    const texte = res.rows[0]?.texte
    return typeof texte === 'string' ? texte : null
  }

  /**
   * Retire une question de la réserve : elle ne sera plus jamais tirée. Le
   * jour qui l'a posée la garde. Signalée (`signalee`), ses signalements se
   * referment dans le même lot — à part, une panne entre les deux la
   * laissait retirée et toujours à relire —, et seulement si ce geste-ci l'a
   * retirée : déjà retirée, rien ne bouge.
   */
  async retirer(reserveId: string, signalee?: { jour: string; index: number }): Promise<boolean> {
    const maintenant = this.maintenant()
    const [retrait] = await this.client.batch(
      [
        { sql: 'UPDATE jour_reserve SET retiree_le = ? WHERE id = ? AND retiree_le IS NULL', args: [maintenant, reserveId] },
        ...(signalee
          ? [
              {
                sql: `UPDATE jour_signalements SET traite_le = ?, issue = 'retiree', detail = NULL
                      WHERE jour = ? AND question = ? AND traite_le IS NULL
                        AND EXISTS (SELECT 1 FROM jour_reserve WHERE id = ? AND retiree_le = ?)`,
                args: [maintenant, signalee.jour, signalee.index, reserveId, maintenant],
              },
            ]
          : []),
      ],
      'write',
    )
    return retrait.rowsAffected > 0
  }

  // ── Les questions du public ─────────────────────────────────────────────

  /**
   * Un joueur propose une question au quiz du jour (`shared/propositions.ts`),
   * relue aux règles mêmes que son téléphone lui a conseillées — refusée en
   * clair sinon. Un auteur de confiance la voit passer d'office, sa catégorie
   * donnée (`accepterDOffice`) ; sinon elle part en relecture, trois à la fois
   * au plus (`PROPOSITIONS_EN_RELECTURE_MAX`), comptées dans l'instruction
   * même qui l'écrit : deux touchers croisés n'en font pas passer une
   * quatrième. Sous son verrou à lui : deux envois croisés d'un auteur de
   * confiance ne dépassent pas sa part de la file.
   */
  async proposer(profil: ProfileRec, brut: unknown): Promise<PropositionDuJoueur> {
    const lue = lireLaProposition(brut)
    if (typeof lue === 'string') throw new Error(lue)
    return this.avecVerrou(`#plume:${profil.id}`, async () => {
      const id = randomUUID()
      const maintenant = this.maintenant()
      // Une page d'avant n'envoie pas de catégorie : personne ne l'aurait classée, le QG la relit.
      const dOffice = lue.categorie ? await this.accepterDOffice(profil.id, id, { ...lue, categorie: lue.categorie }, maintenant) : null
      if (dOffice) return dOffice
      const res = await this.client.execute({
        sql: `INSERT INTO jour_propositions (id, profile_id, question, proposee_le, statut)
              SELECT ?, ?, ?, ?, 'en-relecture'
              WHERE (SELECT COUNT(*) FROM jour_propositions WHERE profile_id = ? AND statut = 'en-relecture') < ?`,
        args: [id, profil.id, JSON.stringify(lue), maintenant, profil.id, PROPOSITIONS_EN_RELECTURE_MAX],
      })
      if (res.rowsAffected === 0) throw new Error(`Tu as déjà ${PROPOSITIONS_EN_RELECTURE_MAX} questions en relecture : attends qu’une soit relue`)
      return { id, ...lue, statut: 'en-relecture', proposeeLe: maintenant }
    })
  }

  /**
   * La question d'un auteur de confiance (`estDeConfiance`), acceptée
   * d'office (le choix du propriétaire du 9 novembre 2026) : elle rejoint la
   * file comme une question que le QG accepte — signée, sa proposition dite
   * acceptée dans le lot même de l'apport —, sans relecteur : personne ne la
   * connaît, l'administrateur la jouera comme tout le monde. Null : il n'est
   * pas de confiance, ou elle ne passe pas d'office — la réserve ou la
   * campagne l'ont déjà, elle ne se joue pas telle quelle — : la relecture le
   * dira au QG, sans apprendre au joueur ce que la réserve contient.
   */
  private async accepterDOffice(
    auteur: string,
    id: string,
    lue: QuestionProposee & { categorie: string },
    maintenant: number,
  ): Promise<PropositionDuJoueur | null> {
    const confiance = (await this.client.execute(lectureDeLaConfiance(auteur))).rows[0]
    if (!confiance || !estDeConfiance(instantLu(confiance.acceptee), instantLu(confiance.retiree), instantLu(confiance.annulee))) return null
    if (Number(confiance.en_file) >= QUESTIONS_D_OFFICE_EN_FILE_MAX) {
      throw new Error(`${QUESTIONS_D_OFFICE_EN_FILE_MAX} de tes questions attendent déjà leur jour : la suivante quand l’une sera passée`)
    }
    const def = normalizeQuestions([{ kind: 'choice', text: lue.texte, answers: lue.reponses, correct: lue.bonne, anecdote: lue.anecdote ?? null, category: lue.categorie }])[0]
    if (!def || raisonDEcarter(def)) return null
    const { ajoutees } = await this.ajouter(
      [def],
      'public',
      n =>
        n > 0
          ? {
              sql: `INSERT INTO jour_propositions (id, profile_id, question, proposee_le, statut, relue_le, reserve_id)
                    VALUES (?, ?, ?, ?, 'acceptee', ?, (SELECT id FROM jour_reserve WHERE empreinte = ?))`,
              args: [id, auteur, JSON.stringify(lue), maintenant, maintenant, empreinteDe(def.text)],
            }
          : { sql: 'SELECT 0', args: [] },
      auteur,
      null,
      true,
    )
    if (ajoutees === 0) return null
    return { id, ...lue, statut: 'acceptee', proposeeLe: maintenant, dOffice: true }
  }

  /** Ses questions proposées, les plus récentes d'abord (« Tes questions ») : posée, avec le jour qui l'a jouée. */
  async sesPropositions(profileId: string): Promise<PropositionDuJoueur[]> {
    const res = await this.client.execute({
      // Posée en question bonus : ce que la salle en a fait, que « Tes questions » dit sous elle — annulée, rien à en dire.
      sql: `SELECT p.id, p.question, p.proposee_le, p.statut, p.motif, r.posee_le, r.d_office,
                   CASE WHEN EXISTS (SELECT 1 FROM jour_bonus b WHERE b.jour = r.posee_le AND b.reserve_id = r.id AND json_extract(b.question, '$.annulee') IS NULL)
                        THEN ${salleDuBonus('r.posee_le')} END AS salle
            FROM jour_propositions p LEFT JOIN jour_reserve r ON r.id = p.reserve_id
            WHERE p.profile_id = ? ORDER BY p.proposee_le DESC LIMIT ?`,
      args: [profileId, PROPOSITIONS_MONTREES],
    })
    return res.rows.flatMap((r): PropositionDuJoueur[] => {
      const q = questionProposeeLue(r.question)
      if (!q) return []
      const posee = typeof r.posee_le === 'string' ? r.posee_le : null
      return [
        {
          id: String(r.id),
          ...q,
          statut: posee ? 'posee' : statutLu(r.statut),
          proposeeLe: Number(r.proposee_le),
          ...(r.motif != null && { motif: String(r.motif) }),
          ...(posee && { jour: posee }),
          ...(typeof r.salle === 'string' && { salle: salleLue(r.salle) }),
          ...(Number(r.d_office) === 1 && { dOffice: true as const }),
        },
      ]
    })
  }

  /**
   * Ce que le QG relit des questions du public : celles qui attendent leur
   * relecture, la plus ancienne d'abord ; la file des acceptées, dans l'ordre
   * où le tirage les prendra (`tirer`) — leur question seulement si
   * l'administrateur la connaît déjà (`relecteur`) : passée d'office, elle
   * reste close tant qu'il ne la lit pas (`lireLaQuestionEnFile`) ; et celles
   * refusées, retirées ou jouées ce dernier mois. Leurs auteurs par leur
   * profil : la route les nomme (`pourLAdministrateurDe`), un suspendu compris.
   */
  async propositionsAuQg(): Promise<{ aRelire: PropositionLue[]; enFile: QuestionEnFileLue[]; relues: PropositionLue[] }> {
    const depuis = this.maintenant() - JOURS_DES_PROPOSITIONS_RELUES * 24 * HEURE_MS
    const [aRelire, file, relues] = await this.client.batch(
      [
        `SELECT id, profile_id, question, proposee_le, statut, motif, relue_le FROM jour_propositions
         WHERE statut = 'en-relecture' ORDER BY proposee_le`,
        // Acceptée par le QG, il l'a lue en l'acceptant ; passée d'office, elle attend son « La lire ».
        `SELECT p.id, p.profile_id, p.proposee_le, p.relue_le, r.categorie, r.d_office,
                CASE WHEN r.relecteur IS NOT NULL OR r.d_office = 0 THEN r.question END AS question
         FROM jour_propositions p JOIN jour_reserve r ON r.id = p.reserve_id
         WHERE p.statut = 'acceptee' AND r.posee_le IS NULL AND r.retiree_le IS NULL
         ORDER BY r.ajoutee_le, r.id`,
        {
          // Jouée en question bonus : ce que la salle en a fait — la part qui l'a trouvée, les pouces —, de quoi repérer qui écrit bien.
          sql: `SELECT p.id, p.profile_id, p.question, p.proposee_le, p.statut, p.motif, p.relue_le, r.posee_le, r.retiree_le, r.d_office,
                       CASE WHEN r.posee_le IS NULL THEN 0 ELSE ${ANNULEE_POUR_TOUS} END AS annulee,
                       CASE WHEN EXISTS (SELECT 1 FROM jour_bonus b WHERE b.jour = r.posee_le AND b.reserve_id = r.id) THEN ${salleDuBonus('r.posee_le')} END AS salle
                FROM jour_propositions p LEFT JOIN jour_reserve r ON r.id = p.reserve_id
                WHERE (p.statut = 'refusee' AND p.relue_le >= ?) OR (p.statut = 'retiree' AND r.retiree_le >= ?) OR (p.statut = 'acceptee' AND r.posee_le >= ?)`,
          args: [depuis, depuis, jourDe(depuis)],
        },
      ],
      'read',
    )
    const lire = (r: Record<string, unknown>): PropositionLue[] => {
      const q = questionProposeeLue(r.question)
      if (!q) return []
      return [
        {
          id: String(r.id),
          auteurId: String(r.profile_id),
          ...q,
          proposeeLe: Number(r.proposee_le),
          statut: typeof r.posee_le === 'string' ? 'posee' : statutLu(r.statut),
          ...(r.motif != null && { motif: String(r.motif) }),
          ...(r.relue_le != null && { relueLe: Number(r.relue_le) }),
          ...(typeof r.salle === 'string' && { salle: salleLue(r.salle) }),
          ...(Number(r.d_office) === 1 && { dOffice: true as const }),
          ...(Number(r.annulee) === 1 && { annulee: true as const }),
        },
      ]
    }
    // Le plus récent d'abord : une jouée à son jour, une retirée à son retrait, une refusée à sa relecture.
    const quand = (r: Record<string, unknown>) => (typeof r.posee_le === 'string' ? minuitDuJour(r.posee_le) : r.statut === 'retiree' ? Number(r.retiree_le) : Number(r.relue_le))
    return {
      aRelire: aRelire.rows.flatMap(lire),
      enFile: file.rows.map(r => {
        const question = r.question == null ? null : questionDeLaReserve(r.question, r.categorie)
        return {
          id: String(r.id),
          auteurId: String(r.profile_id),
          categorie: r.categorie == null ? null : String(r.categorie),
          proposeeLe: Number(r.proposee_le),
          accepteeLe: Number(r.relue_le),
          dOffice: Number(r.d_office) === 1,
          ...(question && { question }),
        }
      }),
      relues: [...relues.rows].sort((a, b) => quand(b) - quand(a)).flatMap(lire),
    }
  }

  /**
   * L'administrateur lit une question de la file (« La lire ») : elle se
   * montre telle qu'elle se jouera, et il en devient le relecteur — il en
   * connaît la réponse, la question bonus ne se jouera pas pour lui, comme
   * s'il l'avait acceptée. `lecteur` : le profil que tient sa console ; sans
   * profil, rien à retenir — il ne joue pas le quiz du jour d'ici. Null : elle
   * n'existe pas ; plus dans la file, le geste se refuse.
   */
  async lireLaQuestionEnFile(id: string, lecteur: string | null): Promise<{ question: QuestionProposee; auteurId: string } | null> {
    const [, lue] = await this.client.batch(
      [
        lecteur
          ? {
              sql: `UPDATE jour_reserve SET relecteur = ? WHERE id = (SELECT reserve_id FROM jour_propositions WHERE id = ? AND statut = 'acceptee')
                    AND posee_le IS NULL AND retiree_le IS NULL AND relecteur IS NULL`,
              args: [lecteur, id],
            }
          : { sql: 'SELECT 0', args: [] },
        {
          sql: `SELECT p.profile_id, p.statut, r.question, r.categorie, r.posee_le, r.retiree_le
                FROM jour_propositions p LEFT JOIN jour_reserve r ON r.id = p.reserve_id WHERE p.id = ?`,
          args: [id],
        },
      ],
      'write',
    )
    const r = lue.rows[0]
    if (!r) return null
    if (r.statut !== 'acceptee' || r.question == null || r.posee_le != null || r.retiree_le != null) throw new Error('Cette question n’attend plus son jour : recharge la page')
    const question = questionDeLaReserve(r.question, r.categorie)
    if (!question) throw new Error('Cette question ne se lit pas : retire-la de la file')
    return { question, auteurId: String(r.profile_id) }
  }

  /**
   * Retire de la file une question acceptée, avant son jour, en disant
   * pourquoi : elle quitte la réserve, et son auteur le lit sur son accueil,
   * une fois. Son acceptation reste payée — elle a pu passer d'office, ses
   * confettis paraître au solde —, mais il n'est plus de confiance : sa
   * prochaine question repasse par la relecture (`estDeConfiance`, l'instant du
   * retrait dans `jour_reserve.retiree_le`). Déjà posée, elle ne se retire
   * plus : le jour qui la joue l'annule pour tous (`annulerLeBonus`). Null :
   * elle n'existe pas.
   */
  async retirerLaProposition(id: string, brut: unknown): Promise<{ texte: string; auteurId: string } | null> {
    const motif = lireLeMotif(brut)
    if (typeof motif !== 'string') throw new Error(motif.erreur)
    const maintenant = this.maintenant()
    // Le retrait de la réserve d'abord, puis la proposition — seulement si c'est ce retrait-ci qui l'a ôtée : d'un seul lot.
    const [retrait, , ligne] = await this.client.batch(
      [
        {
          sql: `UPDATE jour_reserve SET retiree_le = ? WHERE id = (SELECT reserve_id FROM jour_propositions WHERE id = ? AND statut = 'acceptee')
                AND posee_le IS NULL AND retiree_le IS NULL`,
          args: [maintenant, id],
        },
        {
          sql: `UPDATE jour_propositions SET statut = 'retiree', motif = ? WHERE id = ? AND statut = 'acceptee'
                AND EXISTS (SELECT 1 FROM jour_reserve r WHERE r.id = jour_propositions.reserve_id AND r.retiree_le = ?)`,
          args: [motif, id, maintenant],
        },
        { sql: 'SELECT p.profile_id, p.question, r.posee_le FROM jour_propositions p LEFT JOIN jour_reserve r ON r.id = p.reserve_id WHERE p.id = ?', args: [id] },
      ],
      'write',
    )
    const r = ligne.rows[0]
    if (!r) return null
    if (retrait.rowsAffected === 0) {
      throw new Error(r.posee_le != null ? 'Elle est déjà passée au quiz du jour : annule-la pour tous depuis son suivi' : 'Cette question n’attend plus son jour')
    }
    return { texte: questionProposeeLue(r.question)?.texte ?? '', auteurId: String(r.profile_id) }
  }

  /** Combien de questions du public attendent leur relecture : ce que le QG compte sur sa page. */
  async propositionsATraiter(): Promise<number> {
    const res = await this.client.execute("SELECT COUNT(*) AS n FROM jour_propositions WHERE statut = 'en-relecture'")
    return Number(res.rows[0]?.n ?? 0)
  }

  /**
   * Accepte une question du public : elle rejoint la réserve, signée de son
   * auteur, telle que l'administrateur l'a retouchée — sa catégorie, une
   * anecdote s'il en écrit une —, et passera au quiz du jour à son tour, une
   * par jour au plus (`tirer`). La proposition se dit acceptée dans le lot
   * même de l'apport : à part, une panne entre les deux la laissait à relire
   * et déjà dans la réserve. Un intitulé que la réserve ou la campagne ont
   * déjà la refuse, en le disant — retouchée, elle peut repasser. Null :
   * cette proposition n'existe pas. `relecteur` : le profil de qui l'accepte
   * — il en connaît la réponse, la question bonus ne se jouera pas pour lui.
   */
  async accepterLaProposition(id: string, brut: unknown, relecteur: string | null = null): Promise<{ texte: string; auteurId: string } | null> {
    const ligne = (await this.client.execute({ sql: 'SELECT profile_id, statut FROM jour_propositions WHERE id = ?', args: [id] })).rows[0]
    if (!ligne) return null
    if (ligne.statut !== 'en-relecture') throw new Error('Cette question est déjà relue')
    const o = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {}
    // Sa catégorie se relit à part, dite à l'administrateur : le conseil du joueur parlerait du haut de sa carte.
    const lue = lireLaProposition({ ...o, categorie: undefined })
    if (typeof lue === 'string') throw new Error(lue)
    const categorie = lireLaCategorie(o.categorie)
    if (!categorie) throw new Error('Choisis sa catégorie : le quiz du jour en mêle deux au plus de chaque')
    const anecdote = typeof o.anecdote === 'string' ? o.anecdote.trim().replace(/\s+/g, ' ') : ''
    if (tronquer(anecdote, MAX_ANECDOTE) !== anecdote) throw new Error(`L’anecdote tient en ${MAX_ANECDOTE} caractères`)
    const def = normalizeQuestions([{ kind: 'choice', text: lue.texte, answers: lue.reponses, correct: lue.bonne, anecdote: anecdote || null, category: categorie }])[0]
    const raison = def ? raisonDEcarter(def) : 'incomplète'
    if (!def || raison) throw new Error(`Elle ne se joue pas au quiz du jour : ${raison}`)
    const { ajoutees, ecartees } = await this.ajouter(
      [def],
      'public',
      n =>
        n > 0
          ? {
              sql: `UPDATE jour_propositions SET statut = 'acceptee', relue_le = ?, reserve_id = (SELECT id FROM jour_reserve WHERE empreinte = ?)
                    WHERE id = ? AND statut = 'en-relecture'`,
              args: [this.maintenant(), empreinteDe(def.text), id],
            }
          : { sql: 'SELECT 0', args: [] },
      String(ligne.profile_id),
      relecteur,
    )
    if (ajoutees === 0) throw new Error(`La réserve la refuse : ${ecartees[0]?.raison ?? 'incomplète'}. Retouche-la, ou refuse-la`)
    return { texte: lue.texte, auteurId: String(ligne.profile_id) }
  }

  /**
   * Refuse une question du public, en disant pourquoi : le joueur le lit sur
   * son accueil, une fois. Null : elle n'existe pas ; relue déjà, le geste se
   * refuse — le journal ne note que ce qui change.
   */
  async refuserLaProposition(id: string, brut: unknown): Promise<{ texte: string; auteurId: string } | null> {
    const motif = lireLeMotif(brut)
    if (typeof motif !== 'string') throw new Error(motif.erreur)
    const [refus, ligne] = await this.client.batch(
      [
        { sql: `UPDATE jour_propositions SET statut = 'refusee', motif = ?, relue_le = ? WHERE id = ? AND statut = 'en-relecture'`, args: [motif, this.maintenant(), id] },
        { sql: 'SELECT profile_id, question FROM jour_propositions WHERE id = ?', args: [id] },
      ],
      'write',
    )
    const r = ligne.rows[0]
    if (!r) return null
    if (refus.rowsAffected === 0) throw new Error('Cette question est déjà relue')
    return { texte: questionProposeeLue(r.question)?.texte ?? '', auteurId: String(r.profile_id) }
  }

  // ── Le tirage ───────────────────────────────────────────────────────────

  /**
   * Le tirage d'un jour. Celui d'aujourd'hui se tire à la première demande —
   * rien ne tourne à minuit — puis se fige : la même copie pour tous, les
   * réponses dans le même ordre, et une question corrigée ensuite dans la
   * réserve ne change rien à ce jour-là. Un jour passé sans tirage n'en aura
   * jamais : null.
   */
  async tirage(jour: string, tirerSiBesoin = false): Promise<Tirage | null> {
    const lu = await this.tirageLu(jour)
    if (lu || !tirerSiBesoin) return lu
    return this.avecVerrou(`#tirage`, async () => (await this.tirageLu(jour)) ?? this.tirer(jour))
  }

  private async tirageLu(jour: string): Promise<Tirage | null> {
    const garde = this.tiragesGardes.get(jour)
    if (garde) return garde
    // Sa question bonus dans la même lecture : elle vit à part des dix (`jour_bonus`).
    const res = await this.client.execute({
      sql: 'SELECT t.questions, t.annulees, b.question AS bonus FROM jour_tirages t LEFT JOIN jour_bonus b ON b.jour = t.jour WHERE t.jour = ?',
      args: [jour],
    })
    const r = res.rows[0]
    if (!r) return null
    // Une annulation rangée pendant la lecture a le dernier mot : cette
    // lecture-ci est partie avant elle.
    const deja = this.tiragesGardes.get(jour)
    if (deja) return deja
    const tirage: Tirage = {
      jour,
      questions: JSON.parse(String(r.questions)),
      annulees: lireNombres(r.annulees),
      ...(typeof r.bonus === 'string' && { bonus: JSON.parse(r.bonus) as QuestionTiree }),
    }
    this.garderTirage(tirage)
    return tirage
  }

  private garderTirage(tirage: Tirage) {
    this.tiragesGardes.delete(tirage.jour)
    this.tiragesGardes.set(tirage.jour, tirage)
    if (this.tiragesGardes.size > TIRAGES_GARDES) this.tiragesGardes.delete(this.tiragesGardes.keys().next().value!)
  }

  private async tirer(jour: string): Promise<Tirage | null> {
    const lire = (r: Record<string, unknown>) => ({
      id: String(r.id),
      question: String(r.question),
      categorie: r.categorie == null ? null : String(r.categorie),
      livree: r.source === 'livre',
      auteur: r.auteur == null ? null : String(r.auteur),
      relecteur: r.relecteur == null ? null : String(r.relecteur),
    })
    const [neuves, publiques] = await this.client.batch(
      [
        `SELECT id, question, categorie, source, auteur FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NULL AND source <> 'public'
         ORDER BY source = 'livre', ajoutee_le, id LIMIT 300`,
        // Les questions du public ont leur file, la plus anciennement acceptée
        // d'abord, et leur nombre par jour (`QUESTIONS_DU_PUBLIC_PAR_JOUR`) :
        // tirées avec les autres, une réserve qui en recevait dix en aurait
        // posé dix le même jour — et autant d'auteurs à traiter à part.
        {
          sql: `SELECT id, question, categorie, source, auteur, relecteur FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NULL AND source = 'public'
                ORDER BY ajoutee_le, id LIMIT ?`,
          args: [QUESTIONS_DU_PUBLIC_PAR_JOUR],
        },
      ],
      'read',
    )
    const lignes = neuves.rows.map(lire)
    // La question du public ne se mêle plus aux dix (le 8 novembre 2026) :
    // elle vient après elles, la question bonus, hors des points — mêlée aux
    // autres, on la jouait à la course sans voir qu'un joueur l'avait écrite,
    // et qui l'avait relue au QG la jouait en en sachant la réponse.
    const duPublic = publiques.rows.map(lire)[0]
    // Les questions des quiz livrés en dernier recours : ces quiz, une soirée
    // peut les jouer, et le profil qui en aurait lu la correction ici y
    // connaîtrait les réponses, pas l'invité anonyme (invariant 8) —
    // l'arbitrage du 27 septembre 2026. Elles ne servent qu'un jour où la
    // réserve n'a plus rien d'autre à poser, pas même ses anciennes.
    let choisies = choisir(lignes.filter(l => !l.livree), QUESTIONS_PAR_JOUR)
    if (choisies.length < QUESTIONS_PAR_JOUR) {
      // À sec : les plus anciennes reviennent, jamais un jour vide — mais pas
      // celles du mois, ni celles du public, qui ne reviennent pas : leur
      // file dit une par jour.
      const anciennes = (
        await this.client.execute({
          sql: `SELECT id, question, categorie, source, auteur FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NOT NULL AND posee_le < ? AND source <> 'public'
                ORDER BY source = 'livre', posee_le, ajoutee_le, id LIMIT ?`,
          args: [jourAvant(jour, JOURS_AVANT_DE_REPOSER), QUESTIONS_PAR_JOUR - choisies.length],
        })
      ).rows.map(lire)
      choisies = [...choisies, ...anciennes.filter(l => !l.livree)]
      choisies = [...choisies, ...choisir(lignes.filter(l => l.livree), QUESTIONS_PAR_JOUR - choisies.length)]
      choisies = [...choisies, ...anciennes.filter(l => l.livree)].slice(0, QUESTIONS_PAR_JOUR)
      // Personne ne regarde la réserve : le journal le dit. Sans la routine
      // qui la remplit (docs/exploitation/mise-en-ligne.md, étape 9), l'amorce tient quatre
      // jours, puis plus rien avant que ses questions redeviennent tirables.
      if (choisies.length < QUESTIONS_PAR_JOUR) {
        console.warn(
          `[jour] réserve à sec : ${choisies.length} question${choisies.length > 1 ? 's' : ''} pour le ${jour} — la routine qui la remplit tourne-t-elle ? (docs/exploitation/mise-en-ligne.md, étape 9)`,
        )
      }
    }
    const jouables = choisies
      .map(c => toPlayable({ ...(JSON.parse(c.question) as QuizQuestionDef), id: c.id }))
      .filter((p): p is PlayableQuestion & { kind: 'choice' } => p !== null && p.kind === 'choice')
    if (jouables.length === 0) return null
    const copie = preparerPartie(jouables, { melangerQuestions: true, melangerReponses: true }, suiteFixe(graineDe(jour)))
    const questions: QuestionTiree[] = copie.flatMap(p => (p.kind === 'choice' ? [questionTiree(p)] : []))
    // La question bonus : ses réponses mélangées elles aussi — la bonne n'est
    // plus à la place où son auteur l'a écrite —, son chrono allongé, et son
    // auteur et son relecteur figés avec le jour.
    const bonus = duPublic ? this.questionBonus(duPublic, jour) : null
    const posees = [...questions.map(q => q.reserveId), ...(bonus ? [bonus.reserveId] : [])]
    await this.client.batch(
      [
        {
          sql: 'INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, ?, ?)',
          args: [jour, JSON.stringify(questions), '[]', this.maintenant()],
        },
        // Avec le tirage, jamais sans : un autre serveur qui tire le même jour garde le premier, bonus compris.
        ...(bonus ? [{ sql: 'INSERT OR IGNORE INTO jour_bonus (jour, reserve_id, question) VALUES (?, ?, ?)', args: [jour, bonus.reserveId, JSON.stringify(bonus)] }] : []),
        {
          sql: `UPDATE jour_reserve SET posee_le = ? WHERE id IN (${posees.map(() => '?').join(', ')})`,
          args: [jour, ...posees],
        },
      ],
      'write',
    )
    return this.tirageLu(jour)
  }

  /**
   * La question du public tirée en bonus, telle que le jour la fige : ses
   * réponses mélangées à la graine du jour, son chrono porté à
   * `DUREE_DE_LA_QUESTION_BONUS` au moins, son auteur et son relecteur. Null
   * si elle ne se joue plus (une réserve retouchée à la main).
   */
  private questionBonus(ligne: { id: string; question: string; auteur: string | null; relecteur: string | null }, jour: string): QuestionTiree | null {
    const p = toPlayable({ ...(JSON.parse(ligne.question) as QuizQuestionDef), id: ligne.id })
    if (!p || p.kind !== 'choice') return null
    const [melangee] = preparerPartie([p], { melangerQuestions: false, melangerReponses: true }, suiteFixe(graineDe(`bonus:${jour}`)))
    if (!melangee || melangee.kind !== 'choice') return null
    const q = questionTiree(melangee)
    return {
      ...q,
      duree: Math.max(q.duree, DUREE_DE_LA_QUESTION_BONUS),
      ...(ligne.auteur && { auteur: ligne.auteur }),
      ...(ligne.relecteur && { relecteur: ligne.relecteur }),
    }
  }

  // ── La partie ───────────────────────────────────────────────────────────

  /** La partie du jour de ce profil, telle que son téléphone la montre. */
  async etat(profil: ProfileRec): Promise<PartieDuJour> {
    const jour = jourDe(this.maintenant())
    await this.clorePasses(jour)
    return this.avecVerrou(profil.id, async () => {
      const tirage = await this.tirage(jour, true)
      // Sa partie et le reste de sa vue, ensemble : la page attendait l'une
      // pour demander l'autre. Une question expirée entre-temps ne change pas
      // les points du classement.
      const [[partie, revelation], contexte] = await Promise.all([
        tirage ? this.aJour(profil.id, tirage) : ([null, undefined] as const),
        this.contexteDeVue(profil, jour, tirage),
      ])
      return this.vueDe(profil, jour, tirage, partie, revelation, contexte)
    })
  }

  /**
   * Sa partie, l'échéance de la question montrée vérifiée d'abord : passée
   * sans réponse, elle compte « sans réponse » et se révèle.
   */
  private async aJour(profileId: string, tirage: Tirage): Promise<[Partie | null, RevelationDuJour | undefined]> {
    const partie = await this.partieDe(profileId, tirage.jour)
    if (!partie) return [null, undefined]
    const expiree = await this.expirer(partie, tirage)
    if (expiree) return expiree
    // Sa question bonus laissée au temps se clôt de même, à la lecture suivante.
    return [(await this.expirerLeBonus(partie, tirage)) ?? partie, undefined]
  }

  /** Commence la partie du jour, et montre sa première question. Recommencer rend la partie en cours. */
  async commencer(profil: ProfileRec): Promise<PartieDuJour> {
    const jour = jourDe(this.maintenant())
    await this.clorePasses(jour)
    return this.avecVerrou(profil.id, async () => {
      const tirage = await this.tirage(jour, true)
      if (!tirage) throw new Error('Pas de quiz aujourd’hui : la réserve de questions est vide')
      // Commencée, relue, et ses jours comptés pour ses paliers, dans le même
      // lot. Sa première question ne se sert qu'après eux (plus bas) : servie
      // ici, son chronomètre courait pendant les paliers et la vue.
      const elite = this.eliteGardee(profil.id)
      const commenceeLe = this.maintenant()
      let lus: ResultSet[]
      try {
        lus = await this.client.batch(
          [
            {
              sql: `INSERT OR IGNORE INTO jour_parties (profile_id, jour, commencee_le, question, servie_le) VALUES (?, ?, ?, 0, NULL)`,
              args: [profil.id, jour, commenceeLe],
            },
            { sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profil.id, jour] },
            ...lecturesDesStats(profil.id, elite.jusqua),
          ],
          'write',
        )
      } finally {
        // Sa partie qui commence compte à sa série : sa vue suivante la relit — même si le lot n'a pas répondu.
        this.joursDeSerieGardes.oublier(profil.id)
      }
      const [res, lue, ...stats] = lus
      if (res.rowsAffected > 0) {
        this.suivreAuClassement(jour, profil, { points: 0, enCours: true, commenceeLe })
        // Son bonus de série d'abord : versé avant ses paliers, il compte
        // déjà dans le niveau que La Légende lit.
        await this.payerLaSerie(profil.id, jour, serieLue(stats.slice(LECTURES_AVANT_LA_SERIE), jour).serie)
        // Une partie commencée compte — pour la jauge de L'Assidu comme pour
        // celle de la saison : ce qu'elle fait atteindre tombe maintenant.
        // Décerné seulement à la fin de la partie, le troisième jour
        // d'Halloween commencé puis laissé (le téléphone qui sonne, minuit
        // qui passe) affichait « 3 jours sur 3 » sans jamais ouvrir la
        // Citrouille : le lendemain, la saison était finie, pour un an. La
        // fin de la partie les fête toujours : elle lit ce que ce jour a fait
        // tomber (`recompensesDuJour`).
        await this.deps.profiles.accorderPaliersDuJour(profil.id, jour, this.garderLElite(profil.id, statsDe(stats, jour, elite)))
        await this.accorderSaison(profil.id, jour)
        await this.decernerAuDebut(profil.id, jour, this.maintenant())
      }
      const commencee = lirePartie(profil.id, jour, lue.rows[0])
      // Sa première question, jamais servie — la partie qui commence, ou
      // celle qu'une panne a laissée là — part en dernier : le reste de la
      // vue d'abord, puis servie et relue dans le même lot, comme « Question
      // suivante ». La sienne, s'il l'a proposée, ne se sert pas : elle se
      // montre comme une révélation (`passerLaSienne`).
      if (commencee && commencee.question === 0 && commencee.servieLe === null && commencee.finieLe === null) {
        if (tirage.questions[0]?.auteur === profil.id) return this.passerLaSienne(profil, tirage, commencee)
        const contexte = await this.contexteDeVue(profil, jour, tirage)
        const [, servie] = await this.client.batch(
          [
            {
              sql: `UPDATE jour_parties SET servie_le = ? WHERE profile_id = ? AND jour = ? AND servie_le IS NULL AND finie_le IS NULL AND question = 0`,
              args: [this.maintenant(), profil.id, jour],
            },
            { sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profil.id, jour] },
          ],
          'write',
        )
        return this.vueDe(profil, jour, tirage, lirePartie(profil.id, jour, servie.rows[0]), undefined, contexte)
      }
      // Déjà commencée — l'autre téléphone, un double toucher : la partie
      // reprend où elle en était, sans rien rejouer.
      const [partie, revelation] = (commencee && (await this.expirer(commencee, tirage))) ?? [commencee, undefined]
      return this.vueDe(profil, jour, tirage, partie, revelation)
    })
  }

  /**
   * Le bonus de série d'une partie qui commence (`xpDeSerie`) : la série du
   * jour — aujourd'hui compris, sabliers comptés —, écrit avec la partie et
   * versé dans sa ligne tout de suite. Une partie commencée compte pour la
   * série, laissée en route aussi : son bonus de même.
   */
  private async payerLaSerie(profileId: string, jour: string, serie: number): Promise<void> {
    const xp = xpDeSerie(serie)
    if (xp <= 0) return
    await this.client.execute({ sql: 'UPDATE jour_parties SET xp_serie = ? WHERE profile_id = ? AND jour = ?', args: [xp, profileId, jour] })
    await this.ecrireXp(profileId, jour, false)
  }

  /**
   * La question suivante. Déjà montrée — un double toucher, un téléphone qui
   * revient —, elle garde son échéance : rien ne se rejoue en rechargeant.
   */
  async suivante(profil: ProfileRec): Promise<PartieDuJour> {
    const jour = jourDe(this.maintenant())
    // Minuit a pu passer entre deux questions : le jour neuf se tire, et la
    // veille se clôt d'abord, comme au chargement de la page. Sans ça, la
    // partie commencée à 23 h 58 recevait « Pas de quiz aujourd'hui : la
    // réserve est vide », et son « hier » se lisait avant son podium.
    await this.clorePasses(jour)
    return this.avecVerrou(profil.id, async () => {
      const tirage = await this.tirage(jour, true)
      if (!tirage) return this.vueDe(profil, jour, null, null)
      const [avant, revelation] = await this.aJour(profil.id, tirage)
      // Une question vient d'expirer : on la révèle d'abord, la suivante attend son geste.
      if (revelation || !avant) return this.vueDe(profil, jour, tirage, avant, revelation)
      // La sienne vient : elle ne se sert pas, elle se montre.
      if (avant.servieLe === null && avant.finieLe === null && tirage.questions[avant.question]?.auteur === profil.id) {
        return this.passerLaSienne(profil, tirage, avant)
      }
      // Le reste de la vue d'abord, puis la question servie et relue dans le
      // même lot : son chronomètre part au dernier aller-retour. Il partait
      // avant cinq lectures en série, que le joueur voyait manger son compte
      // à rebours.
      const contexte = await this.contexteDeVue(profil, jour, tirage)
      const [, lue] = await this.client.batch(
        [
          {
            sql: `UPDATE jour_parties SET servie_le = ? WHERE profile_id = ? AND jour = ? AND servie_le IS NULL AND finie_le IS NULL AND question < ?`,
            args: [this.maintenant(), profil.id, jour, tirage.questions.length],
          },
          { sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profil.id, jour] },
        ],
        'write',
      )
      return this.vueDe(profil, jour, tirage, lirePartie(profil.id, jour, lue.rows[0]), undefined, contexte)
    })
  }

  /**
   * Sa propre question, venue à son tour : ni servie ni chronométrée — il en
   * connaît la réponse —, elle se montre à lui comme une révélation, telle
   * que les autres la jouent (« Ta question », `RevelationDuJour.tienne`), et
   * la partie avance par le chemin d'une réponse (`enregistrer`) : la
   * dernière la finit comme une autre. Sous son verrou.
   */
  private async passerLaSienne(profil: ProfileRec, tirage: Tirage, partie: Partie): Promise<PartieDuJour> {
    const { revelation, suite } = await this.enregistrer(partie, tirage, null, null, this.deps.profiles.compagnonDeLaNiche(profil))
    return this.vueDe(profil, tirage.jour, tirage, suite, revelation)
  }

  /**
   * Sa réponse à la question montrée. Arrivée après l'échéance et la marge du
   * réseau (`GRACE_MS`), elle ne compte pas. Rejouée — le réseau a hoqueté,
   * il a touché deux fois —, elle rend ce qu'elle avait rendu, sans rien
   * payer de plus.
   */
  async repondre(profil: ProfileRec, jour: string, index: number, choix: unknown): Promise<RevelationDuJour> {
    return this.avecVerrou(profil.id, async () => {
      const tirage = jourValide(jour) ? await this.tirage(jour) : null
      if (!tirage) throw new Error('Ce quiz du jour n’existe plus : recharge la page')
      const partie = await this.partieDe(profil.id, jour)
      if (!partie) throw new Error('Commence d’abord le quiz du jour')
      if (!Number.isInteger(index) || index < 0 || index >= tirage.questions.length) throw new Error('Question introuvable')
      if (index < partie.question) return this.revelationDe(profil.id, tirage, index)
      if (index > partie.question || partie.servieLe === null) throw new Error('Cette question n’est pas encore posée')
      const maintenant = this.maintenant()
      // Minuit clôt la journée : une réponse d'hier arriverait après son
      // classement, et après son podium.
      if (jour !== jourDe(maintenant)) throw new Error('Minuit est passé : le quiz d’hier est clos')
      const q = tirage.questions[index]
      const ms = maintenant - partie.servieLe
      const aTemps = ms <= q.duree * 1000 + GRACE_MS
      const retenu = typeof choix === 'number' && Number.isInteger(choix) && choix >= 0 && choix < q.reponses.length ? choix : null
      const { revelation } = await this.enregistrer(partie, tirage, aTemps ? retenu : null, ms, this.deps.profiles.compagnonDeLaNiche(profil))
      return !aTemps && retenu !== null ? { ...revelation, tropTard: true } : revelation
    })
  }

  /**
   * Une question montrée dont l'échéance est passée sans réponse — le
   * téléphone a sonné, l'écran s'est éteint : elle compte « sans réponse »,
   * et la partie avance. Rend la partie et ce qu'elle révèle, ou null.
   */
  private async expirer(partie: Partie, tirage: Tirage): Promise<[Partie, RevelationDuJour] | null> {
    if (partie.servieLe === null || partie.finieLe !== null || partie.question >= tirage.questions.length) return null
    const q = tirage.questions[partie.question]
    const ms = this.maintenant() - partie.servieLe
    if (ms <= q.duree * 1000 + GRACE_MS) return null
    const profil = this.deps.profiles.cached(partie.profileId)
    const { revelation, suite } = await this.enregistrer(partie, tirage, null, null, profil ? this.deps.profiles.compagnonDeLaNiche(profil) : null)
    return suite ? [suite, revelation] : null
  }

  /**
   * Écrit une réponse — ou son absence — et fait avancer la partie, points et
   * expérience compris. Rend ce que la réponse révèle et la partie d'après,
   * lues dans le même lot que l'écriture : chaque lecture attendait la
   * précédente, six allers-retours en série sous les doigts du joueur.
   * `compagnon` : celui de sa niche, que la ligne retient (`compagnonsDe`).
   */
  private async enregistrer(
    partie: Partie,
    tirage: Tirage,
    choix: number | null,
    ms: number | null,
    compagnon: string | null,
  ): Promise<{ revelation: RevelationDuJour; suite: Partie | null }> {
    const index = partie.question
    const q = tirage.questions[index]
    const annulee = tirage.annulees.includes(index)
    // Sa propre question ne se joue pas : il en connaît la réponse. Rien ne
    // s'écrit pour elle — ni choix, ni une ligne que la salle compterait
    // (« trouvée par », la difficulté mesurée) —, la partie avance.
    const tienne = q.auteur === partie.profileId
    const juste = !tienne && choix !== null && choix === q.bonne
    const points = juste && !annulee && ms !== null ? pointsDuChoix(ms, q.duree * 1000, q.lectureMs) : 0
    let total = partie.points + points
    let justes = partie.justes + (juste && !annulee ? 1 : 0)
    if (sienneDans(tirage, partie.profileId) >= 0) {
      // Le jour où sa question passe, elle lui compte à sa moyenne sur les
      // autres (`partDeLAuteur`) : ce qu'il a gagné ailleurs se relit, sa
      // part s'y ajoute, et grandit avec lui jusqu'à la dernière.
      const brut = await this.brutDe(partie.profileId, partie.jour, tirage)
      const gagne = brut.points + points
      const trouvees = brut.justes + (juste && !annulee ? 1 : 0)
      total = gagne + partDeLAuteur(gagne, autresQuestions(tirage))
      justes = trouvees + partDeLAuteur(trouvees, autresQuestions(tirage))
    }
    const derniere = index + 1 >= tirage.questions.length
    const maintenant = this.maintenant()
    let res: ResultSet[]
    try {
      res = await this.client.batch(
        [
          tienne
            ? // La place de la ligne qu'elle n'écrit pas : le lot se relit à la même place.
              { sql: 'SELECT 0', args: [] }
            : {
                sql: `INSERT OR IGNORE INTO jour_reponses (profile_id, jour, question, choix, ms, juste, points, repondue_le, compagnon)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [partie.profileId, partie.jour, index, choix, ms, juste ? 1 : 0, points, maintenant, compagnon],
              },
          {
            sql: `UPDATE jour_parties SET question = ?, servie_le = NULL, points = ?, justes = ?, finie_le = ?, xp = ?
                  WHERE profile_id = ? AND jour = ? AND question = ?`,
            args: [index + 1, total, justes, derniere ? maintenant : null, xpDuJour(total, possiblesDe(tirage)), partie.profileId, partie.jour, index],
          },
          ...this.lecturesDeLExperience(partie.profileId),
          ...this.lecturesDeRevelation(partie.profileId, partie.jour, index),
        ],
        'write',
      )
    } finally {
      // Sa réponse rejoint ce qu'il sait, et une bonne réponse ses trente
      // derniers jours et ses missions — ou peut-être, si le lot n'a pas
      // répondu : ce qu'on en gardait se relit à la visite suivante.
      this.savoirsGardes.oublier(partie.profileId)
      if (juste) {
        this.justesGardees.oublier(partie.profileId)
        this.categoriesGardees.oublier(partie.profileId)
      }
    }
    const [ecrite, avance, parties, podiums, ...revelation] = res
    // Une bonne réponse avec son compagnon le fait grandir : ses comptes se relisent (`compagnonsDe`).
    if (ecrite.rowsAffected > 0 && juste && compagnon !== null && !annulee) this.oublierSesCompagnons(partie.profileId)
    const lu = {
      revelation: await this.signee(this.revelation(tirage, index, revelation), q, partie.profileId),
      suite: lirePartie(partie.profileId, partie.jour, revelation[2].rows[0]),
    }
    if (avance.rowsAffected === 0) return lu
    this.suivreAuClassement(partie.jour, partie.profileId, { points: total, enCours: !derniere })
    // Ses paliers ne bougent qu'au début de la partie (un jour joué, voir
    // `commencer`) et à sa fin (un sans-faute) : les chercher à chaque
    // réponse coûtait un aller-retour de plus sous les doigts du joueur.
    await this.ecrireXp(partie.profileId, partie.jour, derniere, [parties, podiums])
    if (derniere) {
      await this.decernerALaFin(partie.profileId, partie.jour, maintenant)
      await this.tirerLEclat(partie.profileId, partie.jour)
      // Son compagnon grandit à la fin de la partie, jamais pendant une
      // question ; une base qui hoquette le laisse grandir à la lecture suivante.
      await this.deps.profiles.faireGrandir(partie.profileId).catch(e => console.error('[jour] compagnon :', e))
    }
    return lu
  }

  /**
   * L'Éclat du quiz du jour : une chance sur `CHANCE_ECLAT_DU_JOUR`, tirée
   * ici, quand la partie finit — une seule fois, l'écriture qui la finit ne
   * passe qu'une fois —, donc une fois par jour. Jamais dans
   * `decernerALaFin`, que la relecture des jours rejoue : chaque relecture
   * aurait retiré au sort. Il se range sous le jour, avec ses paliers, et la
   * fin de la partie le relit (`vueDe`).
   */
  private async tirerLEclat(profileId: string, jour: string): Promise<void> {
    try {
      await this.deps.profiles.tirerUnEclat(profileId, cleDuJour(jour), CHANCE_ECLAT_DU_JOUR)
    } catch (e) {
      // La partie est rangée : un Éclat que la base refuse tombe à côté, comme un tirage manqué.
      console.error('[jour] Éclat non rangé :', e)
    }
  }

  // ── La question bonus ───────────────────────────────────────────────────
  //
  // La question du public, après les dix (le choix du 8 novembre 2026,
  // `shared/propositions.ts`) : elle se joue une fois la partie finie, sous
  // le chrono du serveur comme les autres, mais hors de ses points — ni le
  // classement, ni les étoiles, ni le sans-faute ne la voient. Trouvée, des
  // confettis (`CONFETTIS_D_UNE_PARTIE`) et de l'expérience
  // (`jour_parties.xp_bonus`). Sa vue est légère : la servir ne relit pas la
  // fin de la partie, sinon son chrono courrait pendant les lectures.

  /** Il ne la joue pas : c'est la sienne, ou il l'a relue au QG — il en connaît la réponse. */
  private neLaJouePas(bonus: QuestionTiree, profileId: string): 'tienne' | 'relue' | null {
    if (bonus.auteur === profileId) return 'tienne'
    if (bonus.relecteur === profileId) return 'relue'
    return null
  }

  /**
   * La question bonus montrée, sa partie finie : une fois — redemandée, elle
   * garde son échéance, et passée, elle se révèle « sans réponse ».
   */
  async servirLeBonus(profil: ProfileRec): Promise<BonusDuJour> {
    const jour = jourDe(this.maintenant())
    await this.clorePasses(jour)
    return this.avecVerrou(profil.id, async () => {
      const tirage = await this.tirage(jour, true)
      const bonus = tirage?.bonus
      if (!tirage || !bonus) throw new Error('Pas de question bonus aujourd’hui : reviens demain')
      if (this.neLaJouePas(bonus, profil.id)) throw new Error('Tu en connais la réponse : elle ne se joue pas pour toi')
      const partie = await this.partieDe(profil.id, jour)
      if (!partie?.finieLe) throw new Error('Finis d’abord tes dix questions : la question bonus vient après')
      // Annulée pour tous : sa vue le dit, et la page range la carte qui la proposait.
      if (bonus.annulee !== undefined || partie.bonusServieLe !== null) {
        return { ...(await this.bonusVu(profil, tirage, (await this.expirerLeBonus(partie, tirage)) ?? partie)), maintenant: this.maintenant() }
      }
      // Sa signature d'abord, puis la question servie et relue dans le même lot : son chrono part au dernier aller-retour.
      const auteur = await this.signatureDe(bonus.auteur)
      const [, lue] = await this.client.batch(
        [
          {
            sql: 'UPDATE jour_parties SET bonus_servie_le = ? WHERE profile_id = ? AND jour = ? AND bonus_servie_le IS NULL AND finie_le IS NOT NULL',
            args: [this.maintenant(), profil.id, jour],
          },
          { sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profil.id, jour] },
        ],
        'write',
      )
      return { ...(await this.bonusVu(profil, tirage, lirePartie(profil.id, jour, lue.rows[0]) ?? partie, { auteur })), maintenant: this.maintenant() }
    })
  }

  /**
   * Sa réponse à la question bonus. Arrivée après l'échéance et la marge du
   * réseau (`GRACE_MS`), elle ne compte pas ; rejouée, elle rend ce qu'elle
   * avait rendu, sans rien payer de plus.
   */
  async repondreAuBonus(profil: ProfileRec, jour: string, choix: unknown): Promise<BonusDuJour> {
    return this.avecVerrou(profil.id, async () => {
      const tirage = jourValide(jour) ? await this.tirage(jour) : null
      if (!tirage) throw new Error('Ce quiz du jour n’existe plus : recharge la page')
      const bonus = tirage.bonus
      if (!bonus) throw new Error('Pas de question bonus ce jour-là')
      const partie = await this.partieDe(profil.id, jour)
      if (!partie) throw new Error('Commence d’abord le quiz du jour')
      // Annulée pour tous pendant qu'il la lisait : rien ne s'écrit, sa vue le lui dit. Le tirage se relit sous son
      // verrou — l'annulation le change d'abord, puis défait chacun sous le sien (`annulerLeBonus`).
      if (partie.bonusLe !== null || bonus.annulee !== undefined) return this.bonusVu(profil, tirage, partie)
      if (this.neLaJouePas(bonus, profil.id) || partie.bonusServieLe === null) throw new Error('Cette question n’est pas encore posée')
      const maintenant = this.maintenant()
      // Minuit clôt la journée, sa question bonus avec : sa nuit juge déjà son dosage.
      if (jour !== jourDe(maintenant)) throw new Error('Minuit est passé : le quiz d’hier est clos')
      const aTemps = maintenant - partie.bonusServieLe <= bonus.duree * 1000 + GRACE_MS
      const retenu = typeof choix === 'number' && Number.isInteger(choix) && choix >= 0 && choix < bonus.reponses.length ? choix : null
      const pris = aTemps ? retenu : null
      const vu = await this.bonusVu(profil, tirage, await this.ecrireLeBonus(partie, pris, pris !== null && pris === bonus.bonne, maintenant))
      return !aTemps && retenu !== null && vu.revelation ? { ...vu, revelation: { ...vu.revelation, tropTard: true } } : vu
    })
  }

  /**
   * Son pouce sur la question bonus, une fois jouée : levé, baissé — il se
   * change jusqu'à minuit. Son auteur le lira au lendemain, avec la part de
   * la salle qui l'a trouvée ; le QG, pour repérer qui écrit bien.
   */
  async voterPourLeBonus(profil: ProfileRec, jour: string, brut: unknown): Promise<BonusDuJour> {
    const vote = lireLeVote(brut)
    if (vote === null) throw new Error('Un pouce levé ou baissé')
    return this.avecVerrou(profil.id, async () => {
      const tirage = jourValide(jour) ? await this.tirage(jour) : null
      if (!tirage?.bonus) throw new Error('Pas de question bonus ce jour-là')
      if (tirage.bonus.annulee !== undefined) throw new Error('Cette question bonus a été annulée pour tous : rien à noter')
      if (jour !== jourDe(this.maintenant())) throw new Error('Minuit est passé : la question bonus d’hier est close')
      const partie = await this.partieDe(profil.id, jour)
      if (partie?.bonusLe == null) throw new Error('Joue-la d’abord : on note une question qu’on a jouée')
      const [, lue] = await this.client.batch(
        [
          { sql: 'UPDATE jour_parties SET bonus_vote = ? WHERE profile_id = ? AND jour = ? AND bonus_le IS NOT NULL', args: [vote, profil.id, jour] },
          { sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profil.id, jour] },
        ],
        'write',
      )
      return this.bonusVu(profil, tirage, lirePartie(profil.id, jour, lue.rows[0]) ?? partie)
    })
  }

  /** La question bonus montrée dont l'échéance est passée sans réponse : elle compte « sans réponse ». Rend la partie d'après, ou null. */
  private async expirerLeBonus(partie: Partie, tirage: Tirage): Promise<Partie | null> {
    const b = tirage.bonus
    // Annulée pour tous : rien ne s'écrit plus pour elle, pas même « sans réponse ».
    if (!b || b.annulee !== undefined || partie.bonusServieLe === null || partie.bonusLe !== null) return null
    const maintenant = this.maintenant()
    if (maintenant - partie.bonusServieLe <= b.duree * 1000 + GRACE_MS) return null
    return this.ecrireLeBonus(partie, null, false, maintenant)
  }

  /**
   * Écrit sa question bonus jouée — ou laissée au temps —, une fois : ce
   * qu'elle rapporte se lit de sa ligne, ses confettis à chaque lecture,
   * son expérience figée (`xp_bonus`) et recopiée dans sa ligne du quiz du
   * jour, sous son verrou — et La Légende, si elle lui fait passer un cap.
   */
  private async ecrireLeBonus(partie: Partie, choix: number | null, juste: boolean, maintenant: number): Promise<Partie> {
    const [ecrite, lue] = await this.client.batch(
      [
        {
          sql: `UPDATE jour_parties SET bonus_le = ?, bonus_choix = ?, bonus_juste = ?, xp_bonus = ?
                WHERE profile_id = ? AND jour = ? AND bonus_le IS NULL AND bonus_servie_le IS NOT NULL`,
          args: [maintenant, choix, juste ? 1 : 0, juste ? XP_DE_LA_QUESTION_BONUS : 0, partie.profileId, partie.jour],
        },
        { sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [partie.profileId, partie.jour] },
      ],
      'write',
    )
    if (ecrite.rowsAffected > 0 && juste) await this.ecrireXp(partie.profileId, partie.jour)
    return lirePartie(partie.profileId, partie.jour, lue.rows[0]) ?? partie
  }

  /**
   * La question bonus telle que son téléphone la reçoit : jamais sa bonne
   * réponse avant qu'il l'ait jouée (invariant 1) — sauf à qui la connaît
   * déjà, son auteur et son relecteur, hors de leur partie en cours. Pendant
   * les dix, rien ne se lit pour elle : « Question suivante » sert sa
   * question au dernier aller-retour, et une lecture de plus mangerait son
   * chrono. `auteur` : sa signature déjà lue ; `corrigee` : le jour est clos,
   * la correction la montre à tous.
   */
  private async bonusVu(
    profil: ProfileRec,
    tirage: Tirage,
    partie: Partie | null,
    { auteur, corrigee = false }: { auteur?: BonusDuJour['auteur'] | null; corrigee?: boolean } = {},
  ): Promise<BonusDuJour> {
    const b = tirage.bonus!
    const sansLaJouer = this.neLaJouePas(b, profil.id)
    const enCours = partie !== null && partie.finieLe === null
    const annulee = b.annulee !== undefined
    // Annulée pour tous : qui ne l'a pas jouée ne la jouera plus — pendant les dix, rien ne se dit encore.
    const etat: BonusDuJour['etat'] =
      sansLaJouer ??
      (enCours ? 'a-venir' : partie?.bonusLe != null ? 'jouee' : annulee ? 'annulee' : !partie ? 'a-venir' : partie.bonusServieLe !== null ? 'en-cours' : 'a-jouer')
    // Sa signature, sauf à lui-même, et pas pendant les dix : la page ne la montre qu'avant et après.
    const signature = sansLaJouer === 'tienne' || (enCours && !corrigee) ? null : auteur === undefined ? await this.signatureDe(b.auteur) : auteur
    let vu: BonusDuJour = {
      etat,
      confettis: CONFETTIS_DE_LA_QUESTION_BONUS,
      xp: XP_DE_LA_QUESTION_BONUS,
      duree: b.duree,
      ...(signature && { auteur: signature }),
      ...(annulee && { annulee: true as const }),
    }
    if (etat === 'en-cours' && !corrigee && partie?.bonusServieLe != null) {
      vu = { ...vu, question: { jour: tirage.jour, texte: b.texte, reponses: b.reponses, categorie: b.categorie, duree: b.duree, echeance: partie.bonusServieLe + b.duree * 1000 } }
    }
    // Un jour clos, la correction la montre à tous — même montrée et jamais jouée : minuit l'a close sans rien écrire, sa nuit
    // a déjà jugé son dosage sur ceux qui l'ont jouée.
    if (etat === 'jouee' || (sansLaJouer && !enCours) || corrigee) {
      // Annulée, sa salle ne dit plus rien : ses trouvailles sont défaites (`annulerLeBonus`).
      const salle = annulee ? null : salleLue((await this.client.execute({ sql: `SELECT ${salleDuBonus('?')} AS salle`, args: [tirage.jour] })).rows[0]?.salle)
      const jouee = etat === 'jouee' && partie !== null
      const revelation: RevelationDuBonus = {
        jour: tirage.jour,
        texte: b.texte,
        reponses: b.reponses,
        bonne: b.bonne,
        categorie: b.categorie,
        anecdote: b.anecdote,
        choix: jouee ? partie.bonusChoix : null,
        // Annulée, sa colonne est remise à zéro : son choix dit encore s'il l'avait trouvée.
        juste: jouee && (annulee ? partie.bonusChoix === b.bonne : partie.bonusJuste),
        trouveePar: salle && salle.joueurs >= TROUVEE_PAR_DES ? salle.trouvees / salle.joueurs : null,
        confettis: jouee && partie.bonusJuste && !annulee ? CONFETTIS_DE_LA_QUESTION_BONUS : 0,
        xp: jouee && !annulee ? partie.xpBonus : 0,
        vote: jouee ? partie.bonusVote : null,
        ...(sansLaJouer && salle && { salle }),
      }
      vu = { ...vu, revelation }
    }
    return vu
  }

  /**
   * Annule pour tous la question bonus d'aujourd'hui (le choix du
   * propriétaire du 9 novembre 2026) : fausse, ou passée d'office alors
   * qu'elle n'aurait pas dû. Elle ne se joue plus, ne rapporte plus rien — ses
   * confettis et son expérience repartent de chez qui l'a trouvée —, ni à son
   * auteur : ni les confettis de son jour, ni La Plume, ni le défi de l'auteur
   * (`ANNULEE_POUR_TOUS`), et il n'est plus de confiance (`estDeConfiance`).
   * Son acceptation reste payée. Après minuit, le jour est clos — son dosage
   * jugé — : elle ne s'annule plus. Déjà annulée — un double clic, un essai
   * après une panne à mi-chemin —, chacun se défait encore : rien ne change à
   * qui l'est déjà.
   */
  async annulerLeBonus(jour: string): Promise<{ texte: string; reserveId: string }> {
    if (!jourValide(jour) || jour !== jourDe(this.maintenant()) || (await this.estClos(jour))) {
      throw new Error('Ce jour est clos : sa question bonus ne s’annule plus')
    }
    const bonus = await this.avecVerrou('#tirage', async () => {
      const tirage = await this.tirageLu(jour)
      const b = tirage?.bonus
      if (!tirage || !b) throw new Error('Pas de question bonus aujourd’hui')
      if (b.annulee !== undefined) return b
      const annulee = this.maintenant()
      await this.client.execute({
        sql: `UPDATE jour_bonus SET question = json_set(question, '$.annulee', ?) WHERE jour = ? AND json_extract(question, '$.annulee') IS NULL`,
        args: [annulee, jour],
      })
      // Sous le verrou du tirage, comme une annulation des dix : chacun, sous le sien, lira celle-ci.
      this.garderTirage({ ...tirage, bonus: { ...b, annulee } })
      return b
    })
    // Chacun se défait sous son verrou, ceux qui l'ont vue servie : une réponse partie avant l'annulation et écrite après
    // passe d'abord, puis se défait ; une réponse d'après lit l'annulation et n'écrit rien (`repondreAuBonus`).
    const servis = await this.client.execute({ sql: 'SELECT profile_id FROM jour_parties WHERE jour = ? AND bonus_servie_le IS NOT NULL', args: [jour] })
    await parLots(servis.rows, PROFILS_EN_VOL, r => {
      const profileId = String(r.profile_id)
      return this.avecVerrou(profileId, async () => {
        const defaite = await this.client.execute({
          sql: 'UPDATE jour_parties SET bonus_juste = 0, xp_bonus = 0 WHERE profile_id = ? AND jour = ? AND (bonus_juste <> 0 OR xp_bonus <> 0)',
          args: [profileId, jour],
        })
        // Son expérience du quiz du jour se recopie sans la question : rien ne s'y gagne, aucun palier n'est à juger.
        if (defaite.rowsAffected > 0) await this.ecrireXp(profileId, jour, false)
      })
    })
    return { texte: bonus.texte, reserveId: bonus.reserveId }
  }

  /**
   * La signature d'une question du public : son auteur tel qu'il se porte
   * (invariant de l'avatar unique). Un profil qui ne se montre plus —
   * supprimé, suspendu, que `byId` tait, masqué des classements — ne signe
   * plus : la question reste, sans nom.
   */
  private async signatureDe(auteurId: string | undefined): Promise<BonusDuJour['auteur'] | null> {
    if (!auteurId || this.masques.has(auteurId)) return null
    const auteur = await this.deps.profiles.byId(auteurId).catch(() => null)
    if (!auteur) return null
    return { nom: auteur.name, avatar: this.deps.profiles.avatarPorte(auteur), ...apparenceDeLAvatar(this.deps.profiles.apparenceDe(auteur)) }
  }

  /** Ce que la réponse à une question lui apprend. */
  private async revelationDe(profileId: string, tirage: Tirage, index: number): Promise<RevelationDuJour> {
    const r = this.revelation(tirage, index, await this.client.batch(this.lecturesDeRevelation(profileId, tirage.jour, index), 'read'))
    return this.signee(r, tirage.questions[index], profileId)
  }

  /**
   * La signature d'une question du public, à sa révélation : son auteur tel
   * qu'il se porte (invariant de l'avatar unique) — et, pour lui, « Ta
   * question ». Un profil qui ne se montre plus — supprimé, suspendu, que
   * `byId` tait, masqué des classements — ne signe plus : la question reste,
   * sans nom.
   */
  private async signee(r: RevelationDuJour, q: QuestionTiree, profileId: string): Promise<RevelationDuJour> {
    if (!q.auteur) return r
    if (q.auteur === profileId) return { ...r, tienne: true }
    const auteur = await this.signatureDe(q.auteur)
    return auteur ? { ...r, auteur } : r
  }

  /**
   * Ce qu'il a gagné sur les questions qui comptent encore, ses lignes
   * relues : points et bonnes réponses, sans la part de sa propre question —
   * qui n'a pas de ligne. Sous son verrou : une réponse en route ne s'y
   * glisse pas.
   */
  private async brutDe(profileId: string, jour: string, tirage: Tirage): Promise<{ points: number; justes: number }> {
    const res = await this.client.execute({
      sql: `SELECT COALESCE(SUM(points), 0) AS points, COALESCE(SUM(juste), 0) AS justes FROM jour_reponses
            WHERE profile_id = ? AND jour = ? AND question NOT IN (SELECT value FROM json_each(?))`,
      args: [profileId, jour, JSON.stringify(tirage.annulees)],
    })
    return { points: Number(res.rows[0]?.points ?? 0), justes: Number(res.rows[0]?.justes ?? 0) }
  }

  /** Les lectures d'une révélation : seules, ou au bout du lot qui écrit la réponse. */
  private lecturesDeRevelation(profileId: string, jour: string, index: number): InStatement[] {
    return [
      { sql: 'SELECT choix, juste, points FROM jour_reponses WHERE profile_id = ? AND jour = ? AND question = ?', args: [profileId, jour, index] },
      { sql: 'SELECT COUNT(*) AS n, COALESCE(SUM(juste), 0) AS justes FROM jour_reponses WHERE jour = ? AND question = ?', args: [jour, index] },
      { sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profileId, jour] },
    ]
  }

  private revelation(tirage: Tirage, index: number, [sienne, salle, partie]: ResultSet[]): RevelationDuJour {
    const q = tirage.questions[index]
    const r = sienne.rows[0]
    const n = Number(salle.rows[0]?.n ?? 0)
    const annulee = tirage.annulees.includes(index)
    return {
      jour: tirage.jour,
      index,
      total: tirage.questions.length,
      texte: q.texte,
      reponses: q.reponses,
      bonne: q.bonne,
      choix: r?.choix == null ? null : Number(r.choix),
      juste: Number(r?.juste ?? 0) === 1,
      points: annulee ? 0 : Number(r?.points ?? 0),
      cumul: Number(partie.rows[0]?.points ?? 0),
      anecdote: q.anecdote,
      trouveePar: n >= TROUVEE_PAR_DES ? Number(salle.rows[0]?.justes ?? 0) / n : null,
      ...(annulee && { annulee: true }),
      derniere: index + 1 >= tirage.questions.length,
    }
  }

  private async partieDe(profileId: string, jour: string): Promise<Partie | null> {
    const res = await this.client.execute({ sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profileId, jour] })
    return lirePartie(profileId, jour, res.rows[0])
  }

  /**
   * Ce que la vue lit sans dépendre de la partie — sa série, hier, le
   * classement du jour —, en un seul aller-retour : « Question suivante » le
   * lit avant de servir sa question.
   */
  private async contexteDeVue(profil: ProfileRec, jour: string, tirage: Tirage | null): Promise<ContexteDeVue> {
    const [{ serie, tenue: serieTenue, sabliers }, vainqueursDHier, sonHier, joueurs] = await Promise.all([
      this.serieGardee(profil.id, jour),
      this.vainqueursDe(jourAvant(jour)),
      this.sonJourGarde(profil, jourAvant(jour)),
      tirage ? this.joueursDu(jour, profil.id) : null,
    ])
    return { serie, serieTenue, sabliers, vainqueursDHier, sonHier, joueurs }
  }

  /** La partie telle que le téléphone la reçoit : jamais une bonne réponse avant qu'il ait répondu. */
  private async vueDe(
    profil: ProfileRec,
    jour: string,
    tirage: Tirage | null,
    partie: Partie | null,
    revelation?: RevelationDuJour,
    contexte?: ContexteDeVue,
  ): Promise<PartieDuJour> {
    const { serie, serieTenue, sabliers, vainqueursDHier, sonHier, joueurs: lus } = contexte ?? (await this.contexteDeVue(profil, jour, tirage))
    if (!tirage) {
      const moisDernier = await this.moisDernierDe(profil, jour)
      return {
        jour,
        maintenant: this.maintenant(),
        revientDemain: await this.reserveTientDemain(jour),
        total: 0,
        categories: [],
        etat: 'aucun',
        points: 0,
        justes: 0,
        xp: 0,
        medaille: null,
        rang: 0,
        joueurs: 0,
        pointsPossibles: 0,
        comptees: 0,
        serie,
        serieTenue,
        ...(sabliers > 0 && { sabliers }),
        vainqueursDHier,
        sonHier,
        ...(moisDernier && { moisDernier }),
      }
    }
    const total = tirage.questions.length
    const comptees = total - tirage.annulees.length
    const categories = [...new Set(tirage.questions.map(q => q.categorie).filter((c): c is string => !!c))]
    const joueurs = lus ?? (await this.joueursDu(jour, profil.id))
    const nom = nommer(joueurs, this.deps.profiles)
    const classes = classer(joueurs, j => j.points, nom, j => j.profil.id)
    const moi = classes.find(c => c.item.profil.id === profil.id)
    const devant = moi && classes.filter(c => c.item.points > moi.item.points).at(-1)
    const etat = !partie ? 'a-jouer' : partie.finieLe !== null ? 'finie' : 'en-cours'
    let vue: PartieDuJour = {
      jour,
      maintenant: this.maintenant(),
      total,
      categories,
      etat,
      points: partie?.points ?? 0,
      justes: partie?.justes ?? 0,
      xp: partie?.xp ?? 0,
      ...(partie && partie.xpSerie > 0 && { xpSerie: partie.xpSerie }),
      medaille: partie?.finieLe ? medailleDe(partie.justes, comptees) : null,
      rang: moi && partie ? moi.rang : 0,
      joueurs: joueurs.length,
      ...(devant && moi && { devant: { nom: nom(devant.item), ecart: devant.item.points - moi.item.points } }),
      pointsPossibles: possiblesDe(tirage),
      comptees,
      serie,
      serieTenue,
      ...(sabliers > 0 && { sabliers }),
      vainqueursDHier,
      sonHier,
    }
    if (partie && etat === 'en-cours') {
      if (partie.servieLe !== null) vue = { ...vue, question: questionVue(tirage, partie.question, partie.servieLe) }
      else if (revelation) vue = { ...vue, revelation }
      else if (partie.question > 0) vue = { ...vue, revelation: await this.revelationDe(profil.id, tirage, partie.question - 1) }
    }
    if (partie && etat === 'finie' && revelation) vue = { ...vue, revelation }
    // La question bonus, après les dix : pendant elles, son état seul — rien ne se lit pour elle (`bonusVu`).
    if (tirage.bonus) vue = { ...vue, bonus: await this.bonusVu(profil, tirage, partie) }
    if (etat === 'finie') {
      // Ce que sa partie a fait tomber : sous ce jour, sauf ce que la nuit
      // décernera (`estDeLaNuit`) ; sous le mois, la page du calendrier que
      // ce jour-ci a ouverte.
      const [duJour, duMois, eclat] = await Promise.all([
        this.deps.profiles.recompensesDuJour(profil.id, jour),
        partie ? this.deps.profiles.rangesSous(profil.id, cleDuMois(moisDe(jour))) : [],
        // L'Éclat que sa partie a fait tomber, relu sous le jour : la page
        // rechargée le redit, comme ses paliers.
        this.deps.profiles.eclatSous(profil.id, cleDuJour(jour)),
      ])
      if (eclat) vue = { ...vue, eclat }
      const tombees = duJour.filter(t => !estDeLaNuit(t.key))
      const paliers = tombees.filter(t => palierDe(t.key))
      if (paliers.length > 0) vue = { ...vue, paliers }
      const hautsFaits = tombees.filter(t => hautFait(t.key)?.famille === 'soiree')
      if (hautsFaits.length > 0) vue = { ...vue, hautsFaits }
      const divins = raconter(tombees.filter(t => t.key.startsWith('dv:')).map(t => t.key))
      if (divins.length > 0) vue = { ...vue, divins }
      const page = duMois.find(t => moisDeLaPage(t.key) && partie && t.at >= partie.commenceeLe)
      if (page) vue = { ...vue, page: moisDeLaPage(page.key)! }
      // Le timbre de la fête, que ce jour a fait tomber : il rejoint son carnet.
      const timbre = tombees.map(t => timbreDe(t.key)).find(t => t !== null)
      if (timbre) vue = { ...vue, timbre: timbreDit(timbre.saison.key, timbre.millesime) }
      // Le Sphinx, par ses paliers ; un légendaire de saison, par sa saison ;
      // le Coq au vingtième Lève-tôt ; et ce qu'ouvre la page du calendrier.
      const legendaires = this.deps.profiles.legendairesOuverts(profil.id, [...tombees.map(t => t.key), ...(page ? [page.key] : [])])
      if (legendaires.length > 0) vue = { ...vue, legendaires }
      // La montée de niveau qu'elle a faite, dite comme en fin de soirée : le
      // quiz du jour rapporte l'essentiel de l'expérience d'un assidu, et
      // ouvrait niveaux, finitions et emojis de collection sans un mot.
      if (partie) {
        const frais = await this.deps.profiles.byId(profil.id).catch(() => null)
        if (frais) {
          const gardes = this.deps.profiles.gardesOf(profil.id)
          // Tout ce que la partie a rapporté : ses points, sa série, et ce
          // qu'elle a fait tomber — ses paliers et ses hauts faits paient
          // aussi. Sans eux, le niveau qu'un palier faisait passer se lisait
          // « déjà là » avant la partie, et rien ne l'annonçait.
          const gagne = partie.xp + partie.xpSerie + partie.xpBonus + tombees.reduce((n, t) => n + xpDe(t.key), 0)
          vue = { ...vue, niveauAvant: niveauDuProfil(frais.xp - gagne, gardes), niveauApres: niveauDuProfil(frais.xp, gardes) }
        }
      }
    }
    // Les premiers jours d'un mois, le mois d'avant — pas pendant une
    // question : « Question suivante » ne lit rien de plus.
    if (etat !== 'en-cours') {
      const moisDernier = await this.moisDernierDe(profil, jour)
      if (moisDernier) vue = { ...vue, moisDernier }
    }
    // Pendant une fête, ce qui manque encore à son légendaire — ou, à qui l'a déjà, à son timbre de l'année.
    const periode = periodeDu(jour)
    if (periode) {
      const millesime = millesimeDe(periode.fin)
      const aLeLegendaire = this.deps.profiles.legendairesOf(profil.id).includes(periode.saison.legendaire)
      const aSonTimbre = this.deps.profiles.recompensesOf(profil.id).has(cleDuTimbre(periode.saison.key, millesime))
      if (!aLeLegendaire || !aSonTimbre) {
        vue = {
          ...vue,
          saison: {
            cle: periode.saison.key,
            nom: periode.saison.nom,
            legendaire: periode.saison.legendaire,
            joues: await this.joursDeSaison(profil.id, periode, jour),
            requis: periode.saison.jours,
            periode: periode.saison.periode,
            millesime,
            ...(aLeLegendaire && { aLeLegendaire: true as const }),
          },
        }
      }
    }
    return vue
  }

  /**
   * Pas de quiz aujourd'hui : la réserve en aura-t-elle un demain ? « Il
   * revient demain » ne se promet que si c'est vrai — à sec, le téléphone
   * le répétait chaque jour pendant un mois.
   */
  private async reserveTientDemain(jour: string): Promise<boolean> {
    const res = await this.client.execute({
      sql: 'SELECT COUNT(*) AS n FROM jour_reserve WHERE retiree_le IS NULL AND (posee_le IS NULL OR posee_le < ?)',
      args: [jourAvant(jourAvant(jour, -1), JOURS_AVANT_DE_REPOSER)],
    })
    return Number(res.rows[0]?.n ?? 0) > 0
  }

  // ── Le classement ───────────────────────────────────────────────────────

  /**
   * Ceux qui ont joué ce jour-là, profils fermés et masqués écartés — sauf
   * `pour`, qui se voit toujours : un profil masqué n'en est pas averti.
   */
  private async joueursDu(jour: string, pour: string | null, frais = false): Promise<Joueur[]> {
    const tous = await this.classementDe(jour, frais)
    return tous.filter(j => !this.masques.has(j.profil.id) || j.profil.id === pour)
  }

  /**
   * Tous ceux qui ont joué ce jour-là, gardés sous la révision du jour lue
   * AVANT la lecture. Lue après, une réponse écrite pendant qu'on allait
   * chercher un profil chez Turso passait pour vue : la lecture d'avant se
   * rangeait comme fraîche, et la nuit payait le podium — le laurier, le
   * Champion du jour — sur ces points-là, pour de bon. `frais` relit la base
   * quoi qu'il y ait en mémoire : la nuit ne se fie qu'à elle.
   */
  private classementDe(jour: string, frais: boolean): Promise<Joueur[]> {
    const revision = this.revisionDu(jour)
    if (!frais) {
      const garde = this.classementsGardes.get(jour)
      if (garde && garde.revision === revision) return Promise.resolve(garde.joueurs)
      const enRoute = this.classementsEnRoute.get(jour)
      if (enRoute && enRoute.revision === revision) return enRoute.promesse
    }
    const promesse = this.lireClassement(jour).then(joueurs => {
      const garde = this.classementsGardes.get(jour)
      // Une lecture plus récente déjà rangée reste : celle-ci, partie avant
      // elle, a pu croiser une réponse.
      if (!garde || garde.revision <= revision) {
        this.classementsGardes.delete(jour)
        this.classementsGardes.set(jour, { revision, joueurs })
        if (this.classementsGardes.size > 8) this.classementsGardes.delete(this.classementsGardes.keys().next().value!)
      }
      return joueurs
    })
    const enRoute = { revision, promesse }
    this.classementsEnRoute.set(jour, enRoute)
    // Un échec ne reste pas en route : la demande suivante relit la base.
    void promesse
      .finally(() => {
        if (this.classementsEnRoute.get(jour) === enRoute) this.classementsEnRoute.delete(jour)
      })
      .catch(() => {})
    return promesse
  }

  private async lireClassement(jour: string): Promise<Joueur[]> {
    const res = await this.client.execute({ sql: 'SELECT profile_id, points, finie_le, commencee_le FROM jour_parties WHERE jour = ?', args: [jour] })
    const profils = await this.deps.profiles.byIds(res.rows.map(r => String(r.profile_id)))
    const lus: Joueur[] = []
    res.rows.forEach((r, i) => {
      const profil = profils[i]
      if (profil) lus.push({ profil, points: Number(r.points), enCours: r.finie_le == null, commenceeLe: Number(r.commencee_le) })
    })
    return lus
  }

  /** Ce jour a bougé : une annulation, une relecture, un profil parti — son classement gardé ne vaut plus. */
  private reviser(jour: string) {
    this.revisions.set(jour, this.revisionDu(jour) + 1)
  }

  /**
   * Une partie vient de commencer, ou une réponse de changer les points d'un
   * joueur : le jour bouge (`reviser`), et son classement gardé, s'il était à
   * jour jusque-là, suit le changement en mémoire sous la révision neuve. Il se
   * relisait en entier à la vue suivante de chacun — toutes les parties du
   * jour, à chaque réponse de n'importe qui : à cent joueurs, quinze relectures
   * de cent lignes par seconde, un tiers du quota quotidien de Turso en une
   * heure. Ce qu'on écrit ici est ce que la base vient d'écrire — ses points,
   * sa fin — : la relecture le rendrait tel quel. Un classement déjà en retard
   * reste en retard, et se relit. Une lecture partie avant ne s'installe pas
   * par-dessus (`classementDe` garde la révision la plus récente).
   */
  private suivreAuClassement(jour: string, joueur: ProfileRec | string, changement: { points: number; enCours: boolean; commenceeLe?: number }) {
    const avant = this.revisionDu(jour)
    this.reviser(jour)
    const garde = this.classementsGardes.get(jour)
    if (!garde || garde.revision !== avant) return
    const id = typeof joueur === 'string' ? joueur : joueur.id
    const i = garde.joueurs.findIndex(j => j.profil.id === id)
    let joueurs: Joueur[]
    if (i >= 0) {
      joueurs = garde.joueurs.slice()
      joueurs[i] = { ...joueurs[i], points: changement.points, enCours: changement.enCours }
    } else if (typeof joueur !== 'string' && changement.commenceeLe !== undefined) {
      // Un joueur qui arrive : comme la relecture le trouverait, sa partie à zéro, en cours.
      joueurs = [...garde.joueurs, { profil: joueur, points: changement.points, enCours: changement.enCours, commenceeLe: changement.commenceeLe }]
    } else {
      return
    }
    this.classementsGardes.set(jour, { revision: avant + 1, joueurs })
  }

  private revisionDu(jour: string): number {
    return this.revisions.get(jour) ?? 0
  }

  /** Le classement d'un jour : tout le serveur, les règles des soirées — rang partagé, « Camille (2) ». */
  async classementDuJour(jour: string, pour: string | null): Promise<ClassementDuJour> {
    await this.clorePasses(jourDe(this.maintenant()))
    const joueurs = await this.joueursDu(jour, pour)
    const fige = await this.estClos(jour)
    // Un jour clos n'a plus de partie dont les points peuvent monter : celle
    // qu'on a laissée à minuit s'arrête là, comme son podium.
    return { ...this.lignes(fige ? joueurs.map(j => ({ ...j, enCours: false })) : joueurs, jour, pour), fige }
  }

  /** Le classement d'un mois : les points de tous ses jours, additionnés. */
  async classementDuMois(mois: string, pour: string | null): Promise<ClassementDuJour> {
    const res = await this.client.execute({
      sql: `SELECT profile_id, SUM(points) AS points, MIN(commencee_le) AS commencee_le FROM jour_parties
            WHERE jour >= ? AND jour <= ? GROUP BY profile_id`,
      args: [`${mois}-01`, `${mois}-31`],
    })
    const profils = await this.deps.profiles.byIds(res.rows.map(r => String(r.profile_id)))
    const joueurs: Joueur[] = []
    res.rows.forEach((r, i) => {
      const profil = profils[i]
      if (!profil || (this.masques.has(profil.id) && profil.id !== pour)) return
      joueurs.push({ profil, points: Number(r.points), enCours: false, commenceeLe: Number(r.commencee_le) })
    })
    return { ...this.lignes(joueurs, mois, pour), fige: moisDe(jourDe(this.maintenant())) > mois }
  }

  private lignes(joueurs: readonly Joueur[], periode: string, pour: string | null): Omit<ClassementDuJour, 'fige'> {
    const nom = nommer(joueurs, this.deps.profiles)
    const classes = classer(joueurs, j => j.points, nom, j => j.profil.id)
    const ligne = ({ item: j, rang }: { item: Joueur; rang: number }): LigneDuJour => {
      const { niveau, finition, eclat, legendaire, sceau, laurier } = this.deps.profiles.apparenceDe(j.profil)
      // Sa bordure de ligue, de mémoire : le classement ne l'attend pas.
      const bordure = this.deps.profiles.bordureDe(j.profil, legendaire)
      return {
        profileId: j.profil.id,
        nom: nom(j),
        avatar: this.deps.profiles.avatarPorte(j.profil),
        niveau,
        finition,
        ...(legendaire && { legendaire }),
        ...(sceau && { sceau }),
        ...(eclat && { eclat }),
        ...(laurier && { laurier }),
        ...(bordure && { bordure }),
        points: j.points,
        rang,
        ...(j.enCours && { enCours: true as const }),
      }
    }
    const montrees = classes.slice(0, LIGNES_MONTREES)
    const sienne = pour ? classes.find(c => c.item.profil.id === pour) : undefined
    return {
      periode,
      joueurs: joueurs.length,
      lignes: montrees.map(ligne),
      ...(sienne && !montrees.includes(sienne) && { moi: ligne(sienne) }),
      ...(sienne && { sienne: sienne.item.profil.id }),
    }
  }

  /**
   * Les premiers d'un jour clos : tous les ex æquo en tête gagnent, dans
   * l'ordre d'affichage. Lus parmi les joueurs de ce jour-là : un profil
   * masqué depuis la nuit — le prénom qui n'allait pas — ne s'annonce plus
   * sur tous les accueils, et un homonyme y garde sa marque.
   */
  private async vainqueursDe(jour: string): Promise<PartieDuJour['vainqueursDHier']> {
    // Les lauriers d'hier sont ses vainqueurs, lus à la nuit : les relire en
    // base coûtait un aller-retour à chaque vue. Les masqués s'écartent au
    // classement, d'un côté comme de l'autre.
    const premiers =
      this.lauriers.jour === jour
        ? this.lauriers.ids
        : new Set(
            (await this.client.execute({ sql: 'SELECT profile_id FROM jour_podiums WHERE jour = ? AND rang = 1', args: [jour] })).rows.map(r =>
              String(r.profile_id),
            ),
          )
    if (premiers.size === 0) return []
    const joueurs = await this.joueursDu(jour, null)
    const nom = nommer(joueurs, this.deps.profiles)
    return joueurs
      .filter(j => premiers.has(j.profil.id))
      // Avec ce qu'ils portent, comme au classement : l'emoji seul les montrait autrement.
      .map(j => ({ nom: nom(j), avatar: this.deps.profiles.avatarPorte(j.profil), ...apparenceDeLAvatar(this.deps.profiles.apparenceDe(j.profil)) }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }

  /** Son jour d'hier, gardé tant que ce jour et les masqués n'ont pas bougé (`sonsHier`). */
  private sonJourGarde(profil: ProfileRec, jour: string): Promise<PartieDuJour['sonHier']> {
    const cle = `${jour}#${this.revisionDu(jour)}#${this.versionDesMasques}`
    const garde = this.sonsHier.get(profil.id)
    if (garde && garde.cle === cle) return garde.valeur
    const valeur = this.sonJour(profil, jour)
    const entree = { cle, valeur }
    this.sonsHier.delete(profil.id)
    this.sonsHier.set(profil.id, entree)
    if (this.sonsHier.size > SONS_HIER_GARDES) this.sonsHier.delete(this.sonsHier.keys().next().value!)
    // Un échec ne reste pas gardé : la vue suivante relit la base.
    valeur.catch(() => {
      if (this.sonsHier.get(profil.id) === entree) this.sonsHier.delete(profil.id)
    })
    return valeur
  }

  /** Son jour d'hier, pour le lendemain : sa place, ses points, ce que le podium lui a payé. */
  private async sonJour(profil: ProfileRec, jour: string): Promise<PartieDuJour['sonHier']> {
    // Ensemble, et pas l'une après l'autre : trois allers-retours en série.
    const [partie, podium, tombes] = await Promise.all([
      this.partieDe(profil.id, jour),
      this.client.execute({ sql: 'SELECT xp FROM jour_podiums WHERE jour = ? AND profile_id = ?', args: [jour, profil.id] }),
      this.deps.profiles.recompensesDuJour(profil.id, jour),
    ])
    if (!partie) return null
    const [tirage, joueurs] = await Promise.all([this.tirageLu(jour), this.joueursDu(jour, profil.id)])
    const classes = classer(joueurs, j => j.points, j => j.profil.name, j => j.profil.id)
    const rang = classes.find(c => c.item.profil.id === profil.id)?.rang ?? 0
    const comptees = tirage ? tirage.questions.length - tirage.annulees.length : 0
    // Ce que la nuit a décerné seulement : le reste tombait avec la partie,
    // et sa fin l'a déjà annoncé.
    const nuit = tombes.filter(p => estDeLaNuit(p.key))
    const paliers = nuit.filter(p => palierDe(p.key))
    const hautsFaits = nuit.filter(p => !palierDe(p.key))
    const legendaires = this.deps.profiles.legendairesOuverts(profil.id, nuit.map(p => p.key))
    return {
      rang,
      joueurs: joueurs.length,
      points: partie.points,
      xpPodium: Number(podium.rows[0]?.xp ?? 0),
      medaille: medailleDe(partie.justes, comptees),
      ...(paliers.length > 0 && { paliers }),
      ...(hautsFaits.length > 0 && { hautsFaits }),
      ...(legendaires.length > 0 && { legendaires }),
    }
  }

  /** Les classements des mois clos, qui ne bougent plus : chaque visite des premiers jours du mois relisait le précédent. */
  private moisGardes = new Map<string, { joueurs: number; places: Map<string, { rang: number; points: number }> }>()

  /**
   * Les sept premiers jours d'un mois, le mois d'avant : sa place au
   * classement du mois, et ce que la clôture du mois lui a décerné. Rien s'il
   * n'y a pas joué, ni au-delà du septième jour.
   */
  private async moisDernierDe(profil: ProfileRec, jour: string): Promise<PartieDuJour['moisDernier']> {
    if (Number(jour.slice(8, 10)) > JOURS_DU_MOIS_DERNIER) return undefined
    const mois = moisAvant(moisDe(jour))
    let garde = this.moisGardes.get(mois)
    if (!garde) {
      const c = await this.classementDuMois(mois, null)
      garde = { joueurs: c.joueurs, places: new Map(c.lignes.map(l => [l.profileId, { rang: l.rang, points: l.points }])) }
      // Un mois se garde une fois clos : avant, il bouge encore.
      if (c.fige) {
        this.moisGardes.set(mois, garde)
        if (this.moisGardes.size > 3) this.moisGardes.delete(this.moisGardes.keys().next().value!)
      }
    }
    let place = garde.places.get(profil.id)
    if (!place) {
      // Hors des lignes montrées, ou masqué : il se voit toujours.
      const c = await this.classementDuMois(mois, profil.id)
      const sienne = c.moi ?? c.lignes.find(l => l.profileId === profil.id)
      if (!sienne) return undefined
      place = { rang: sienne.rang, points: sienne.points }
    }
    const recompenses = (await this.deps.profiles.rangesSous(profil.id, cleDuMois(mois)))
      .filter(r => !moisDeLaPage(r.key))
      .map(({ key, emoji, title }) => ({ key, emoji, title }))
    const legendaires = this.deps.profiles.legendairesOuverts(profil.id, recompenses.map(r => r.key))
    return { mois, rang: place.rang, joueurs: garde.joueurs, points: place.points, recompenses, ...(legendaires.length > 0 && { legendaires }) }
  }

  // ── Sa carrière au quiz du jour ─────────────────────────────────────────

  /**
   * Ce que ses paliers du quiz du jour comptent : ses jours joués — une
   * partie commencée compte, comme pour la série —, ses victoires, et ses
   * jours sans une faute (la médaille d'or, sur les questions qui comptent
   * encore).
   */
  async statsDuJour(profileId: string): Promise<StatsDuJour> {
    const garde = this.eliteGardee(profileId)
    return this.garderLElite(profileId, statsDe(await this.client.batch(lecturesDesStats(profileId, garde.jusqua), 'read'), jourDe(this.maintenant()), garde))
  }

  /**
   * Ses jours dans le premier quart déjà comptés, s'ils valent encore : sous
   * la version des masquages (une suppression la monte aussi) et celle des
   * suspensions où ils l'ont été — l'une ou l'autre changée, le rang de
   * chacun a pu bouger sur tous ses jours, et tout se recompte.
   */
  private eliteGardee(profileId: string): EliteGardee {
    const version = `${this.versionDesMasques}#${this.versionDesSuspensions}`
    const garde = this.elitesGardees.get(profileId)
    return garde?.version === version ? garde : { version, jusqua: '', n: 0 }
  }

  /** Garde ce que la lecture a compté — sauf si un masquage ou une suspension est passé pendant : elle ne vaut plus. */
  private garderLElite(profileId: string, { stats, elite }: { stats: StatsDuJour; elite: EliteGardee }): StatsDuJour {
    if (elite.version === `${this.versionDesMasques}#${this.versionDesSuspensions}`) this.elitesGardees.set(profileId, elite)
    return stats
  }

  /**
   * Un profil suspendu ou réactivé (`ProfileStore`, branché par `server.ts`) :
   * le premier quart de chaque jour se compte sans les suspendus, et chacun
   * recompte ses jours dans l'élite.
   */
  suspensionChangee(): void {
    this.versionDesSuspensions++
    // Un suspendu sort des classements (`byIds` le tait), un réactivé y revient : ceux qu'on garde se relisent — les
    // réponses les suivent en mémoire sans plus les relire (`suivreAuClassement`), et une lecture déjà en route ne
    // s'installe pas par-dessus.
    for (const jour of new Set([...this.classementsGardes.keys(), ...this.classementsEnRoute.keys()])) this.reviser(jour)
  }

  /**
   * Ce que le quiz du jour sait de lui (`Savoir`) : ses questions et ses
   * bonnes réponses, catégorie par catégorie — ses écussons de savoir, avec
   * les soirées et la campagne —, et la base de sa précision, ses QCM
   * répondus. Une question annulée pour tous ne compte pas — ni pour lui,
   * ni contre lui.
   */
  async savoirDe(profileId: string): Promise<Savoir> {
    // La catégorie se lit dans la sous-requête, que `LIMIT -1` garde à part :
    // aplatie dans le regroupement, SQLite recopiait dans son tri le JSON du
    // tirage pour chacune de ses réponses (`CampagneStore.savoirDe`). Tenu
    // d'une visite à l'autre (`savoirsGardes`), il ne fait pas d'aller-retour.
    return this.savoirsGardes.lire(
      profileId,
      {
        sql: `SELECT categorie, COUNT(*) AS questions, COUNT(choix) AS repondues, SUM(juste) AS justes
              FROM (SELECT json_extract(t.questions, '$[' || r.question || '].categorie') AS categorie, r.choix AS choix, r.juste AS juste
                    FROM jour_reponses r JOIN jour_tirages t ON t.jour = r.jour
                    WHERE r.profile_id = ?
                      AND NOT EXISTS (SELECT 1 FROM json_each(t.annulees) a WHERE a.value = r.question)
                    LIMIT -1)
              GROUP BY categorie`,
        args: [profileId],
      },
      lecture => this.client.execute(lecture),
    )
  }

  /**
   * Ce que le quiz du jour sait de chacun, d'une lecture : `savoirDe` pour
   * tous les profils qui y ont joué. La moyenne des joueurs de la carte
   * (`ProfileStore.moyennesDuSavoir`), qui ne la refait qu'une fois par
   * jour : elle parcourt toutes les réponses du quiz du jour.
   */
  async savoirsDeTous(): Promise<Map<string, Savoir>> {
    const res = await this.client.execute(
      `SELECT profile_id, categorie, COUNT(*) AS questions, COUNT(choix) AS repondues, SUM(juste) AS justes
       FROM (SELECT r.profile_id AS profile_id, json_extract(t.questions, '$[' || r.question || '].categorie') AS categorie, r.choix AS choix, r.juste AS juste
             FROM jour_reponses r JOIN jour_tirages t ON t.jour = r.jour
             WHERE NOT EXISTS (SELECT 1 FROM json_each(t.annulees) a WHERE a.value = r.question)
             LIMIT -1)
       GROUP BY profile_id, categorie`,
    )
    const lignes = new Map<string, Record<string, unknown>[]>()
    for (const r of res.rows) {
      const qui = String(r.profile_id)
      const siennes = lignes.get(qui)
      if (siennes) siennes.push(r)
      else lignes.set(qui, [r])
    }
    return new Map([...lignes].map(([qui, siennes]) => [qui, savoirDesLignes(siennes)]))
  }

  /**
   * Ses bonnes réponses au quiz du jour données avec chaque compagnon
   * (`loup` → 42) : elles le font grandir (`shared/compagnons.ts`), comme
   * elles paient ses confettis. Une question annulée pour tous ne compte pas.
   * Gardées par profil (`compagnonsGardes`).
   */
  compagnonsDe(profileId: string): Promise<Record<string, number>> {
    const version = this.versionDesCompagnons
    const garde = this.compagnonsGardes.get(profileId)
    if (garde?.version === version) return garde.lus
    const lus = this.client
      .execute({
        sql: `SELECT r.compagnon AS compagnon, COUNT(*) AS n
              FROM jour_reponses r JOIN jour_tirages t ON t.jour = r.jour
              WHERE r.profile_id = ? AND r.juste = 1 AND r.compagnon IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM json_each(t.annulees) a WHERE a.value = r.question)
              GROUP BY r.compagnon`,
        args: [profileId],
      })
      .then(res => Object.fromEntries(res.rows.map(r => [String(r.compagnon), Number(r.n)])) as Record<string, number>)
    const entree = { version, lus }
    this.compagnonsGardes.set(profileId, entree)
    // Ratée, elle se relit à la demande suivante : gardée, la promesse figerait l'échec.
    lus.catch(() => {
      if (this.compagnonsGardes.get(profileId) === entree) this.compagnonsGardes.delete(profileId)
    })
    return lus
  }

  /** Une bonne réponse de plus, ou une annulation : ses compagnons se relisent, et une lecture partie avant ne se garde pas. */
  private oublierSesCompagnons(profileId: string | null) {
    if (profileId === null) {
      this.versionDesCompagnons++
      this.compagnonsGardes.clear()
    } else this.compagnonsGardes.delete(profileId)
  }

  /**
   * Ses parties depuis un jour, et leurs bonnes réponses par catégorie : de
   * quoi juger ses missions du jour (`shared/missions.ts`). D'un aller-retour,
   * par la clé de ses parties et de ses réponses ; une question annulée pour
   * tous ne compte ni dans ses bonnes réponses ni dans les questions de sa
   * partie, comme pour ses étoiles. Et ses coffres du mois (`coffresDuMois`)
   * dans le même lot — deux allers-retours de front jusqu'au 2 novembre 2026 —,
   * la nuit close d'abord, comme pour eux.
   */
  async activiteDepuis(profileId: string, depuis: string): Promise<Pick<JournauxDesJours, 'jour' | 'jourParCategorie'> & { coffresDuMois: CoffreDuMoisLu[] }> {
    await this.clorePasses(jourDe(this.maintenant()))
    // Ses bonnes réponses par catégorie, tenues d'une visite à l'autre sous la semaine lue (`categoriesGardees`) :
    // ses parties, une ligne par jour, se relisent — une partie qui commence n'y écrit rien qui l'oublie.
    const categories = this.categoriesGardees.dans(
      profileId,
      {
        // La catégorie se lit dans la sous-requête, que `LIMIT -1` garde à part (`savoirDe`).
        sql: `SELECT jour, categorie, COUNT(*) AS n
              FROM (SELECT r.jour AS jour, json_extract(t.questions, '$[' || r.question || '].categorie') AS categorie
                    FROM jour_reponses r JOIN jour_tirages t ON t.jour = r.jour
                    WHERE r.profile_id = ? AND r.jour >= ? AND r.juste = 1
                      AND NOT EXISTS (SELECT 1 FROM json_each(t.annulees) a WHERE a.value = r.question)
                    LIMIT -1)
              GROUP BY jour, categorie`,
        args: [profileId, depuis],
      },
      depuis,
    )
    const [parties, parCategorie, coffres] = await this.client.batch(
      [
        {
          sql: `SELECT p.jour AS jour, p.finie_le AS finie_le, p.justes AS justes,
                       json_array_length(t.questions) - json_array_length(t.annulees) AS questions
                FROM jour_parties p JOIN jour_tirages t ON t.jour = p.jour
                WHERE p.profile_id = ? AND p.jour >= ?`,
          args: [profileId, depuis],
        },
        categories.instruction,
        lectureDesCoffresDuMois(profileId),
      ],
      'read',
    )
    return {
      jour: parties.rows.map(r => ({ jour: String(r.jour), finie: r.finie_le != null, justes: Number(r.justes ?? 0), questions: Number(r.questions ?? 0) })),
      jourParCategorie: categories.lue(parCategorie),
      coffresDuMois: coffresDuMoisLus(coffres.rows),
    }
  }

  /**
   * Ses confettis du quiz du jour (`shared/themes.ts`) : toutes ses bonnes
   * réponses, parties en cours comprises — une question annulée pour tous
   * est déjà retirée de chaque partie (`recompter`) —, et ce que ses
   * questions du public lui rapportent (`lectureDesJustes`).
   */
  async justesDe(profileId: string): Promise<number> {
    const res = await this.client.execute(lectureDesJustes(profileId))
    return Number(res.rows[0]?.n ?? 0)
  }

  /**
   * Les confettis du quiz du jour depuis un instant, tous profils, partie par
   * partie — une bonne réponse, un confetti, ses questions annulées déjà
   * retirées (`recompter`), et sa question bonus trouvée
   * (`CONFETTIS_D_UNE_PARTIE`) —, au moment où elle a commencé ; et ceux des
   * questions du public, à leur acceptation et au minuit du jour qui les a
   * jouées : le QG, `/admin#economie`. Par le jour, qui a son index.
   * `jusqua` : avant cet instant seulement — la mémoire du QG compte ses jours
   * finis une plage à la fois.
   */
  async confettisDepuis(depuis: number, jusqua?: number): Promise<Mouvement[]> {
    const borne = jusqua === undefined ? { sql: '', args: [] } : { sql: ' AND jour <= ? AND commencee_le < ?', args: [jourDe(jusqua - 1), jusqua] }
    const [parties, propositions] = await this.client.batch(
      [
        {
          sql: `SELECT commencee_le, ${CONFETTIS_D_UNE_PARTIE} AS confettis FROM jour_parties
                WHERE jour >= ? AND commencee_le >= ?${borne.sql} AND (justes > 0 OR bonus_juste > 0)`,
          args: [jourDe(depuis), depuis, ...borne.args],
        },
        { sql: `SELECT confettis, quand, jour FROM (${CONFETTIS_DES_PROPOSITIONS}) WHERE quand >= ? OR jour >= ?`, args: [depuis, jourDe(depuis)] },
      ],
      'read',
    )
    return [
      ...parties.rows.map(r => ({ quand: Number(r.commencee_le), confettis: Number(r.confettis) })),
      ...propositions.rows.flatMap(r => {
        const quand = typeof r.jour === 'string' ? minuitDuJour(r.jour) : Number(r.quand)
        return quand >= depuis && (jusqua === undefined || quand < jusqua) ? [{ quand, confettis: Number(r.confettis) }] : []
      }),
    ]
  }

  /** Les confettis du quiz du jour de chaque profil, depuis toujours — sa part du solde (`justesDe`) : le QG les relit une fois par jour. */
  async justesDeTous(): Promise<Map<string, number>> {
    const res = await this.client.execute(
      `SELECT profile_id, SUM(n) AS n FROM (
         SELECT profile_id, SUM(${CONFETTIS_D_UNE_PARTIE}) AS n FROM jour_parties GROUP BY profile_id
         UNION ALL
         SELECT profile_id, SUM(confettis) FROM (${CONFETTIS_DES_PROPOSITIONS}) GROUP BY profile_id
       ) GROUP BY profile_id`,
    )
    return new Map(res.rows.map(r => [String(r.profile_id), Number(r.n ?? 0)]))
  }

  /** Le jour qu'il est à Paris, à l'horloge du quiz du jour — que les tests font passer minuit. */
  aujourdhui(): string {
    return jourDe(this.maintenant())
  }

  /** Masqué du classement par l'administrateur : les autres ne le voient plus, ni sa carte. */
  estMasque(profileId: string): boolean {
    return this.masques.has(profileId)
  }

  /**
   * Monte à chaque masquage ou démasquage, à chaque suspension ou
   * réactivation : ce qui se classe sans eux et se garde — le classement des
   * collectionneurs (`core/collectionneurs.ts`) — se refait quand elle change.
   */
  versionDesExclus(): string {
    return `${this.versionDesMasques}#${this.versionDesSuspensions}`
  }

  /** Ce que la carte d'un joueur dit de son quiz du jour : les jours joués, les victoires. */
  async resumeDe(profileId: string): Promise<{ joues: number; victoires: number }> {
    const [joues, victoires] = await this.client.batch(
      [
        { sql: 'SELECT COUNT(*) AS n FROM jour_parties WHERE profile_id = ?', args: [profileId] },
        { sql: 'SELECT COUNT(*) AS n FROM jour_podiums WHERE profile_id = ? AND rang = 1', args: [profileId] },
      ],
      'read',
    )
    return { joues: Number(joues.rows[0]?.n ?? 0), victoires: Number(victoires.rows[0]?.n ?? 0) }
  }

  /**
   * Les jours joués et les victoires de chacun (`resumeDe`), pour le relevé de
   * fond des collectionneurs (`core/collectionneurs.ts`) : ce qui ouvre la
   * Nuit étoilée et le Kintsugi. D'un lot, chacune en un seul texte JSON — le
   * client de la base décode chaque ligne à grands frais ; les parties se
   * comptent sur la clé de leur table, sans en lire une colonne.
   */
  async resumesDeTous(): Promise<Map<string, { joues: number; victoires: number }>> {
    const [joues, victoires] = await this.client.batch(
      [
        'SELECT json_group_array(json_array(profile_id, n)) AS v FROM (SELECT profile_id, COUNT(*) AS n FROM jour_parties GROUP BY profile_id)',
        'SELECT json_group_array(json_array(profile_id, n)) AS v FROM (SELECT profile_id, COUNT(*) AS n FROM jour_podiums WHERE rang = 1 GROUP BY profile_id)',
      ],
      'read',
    )
    const resumes = new Map<string, { joues: number; victoires: number }>()
    for (const [id, n] of JSON.parse(String(joues.rows[0]?.v ?? '[]')) as [string, number][]) resumes.set(id, { joues: n, victoires: 0 })
    for (const [id, n] of JSON.parse(String(victoires.rows[0]?.v ?? '[]')) as [string, number][]) resumes.set(id, { joues: resumes.get(id)?.joues ?? 0, victoires: n })
    return resumes
  }

  /**
   * Ce que la fin d'une soirée lui dit du quiz du jour : sa série — que la
   * soirée vient d'allonger — et s'il a déjà joué celui d'aujourd'hui. La
   * soirée n'y renvoyait jamais : un profil créé ce soir-là ne découvrait le
   * quiz qu'en touchant « Mon profil ».
   */
  async pontDuJour(profileId: string): Promise<{ serie: number; aJoue: boolean }> {
    const jour = jourDe(this.maintenant())
    const [{ serie }, partie] = await Promise.all([
      this.serieDe(profileId, jour),
      this.client.execute({ sql: 'SELECT 1 FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profileId, jour] }),
    ])
    return { serie, aJoue: partie.rows.length > 0 }
  }

  /**
   * Ce que le rappel du soir doit savoir d'un profil (`core/rappels.ts`) :
   * combien de questions lui restent aujourd'hui — toutes s'il n'a pas
   * commencé, aucune s'il a fini, aucune non plus s'il n'y a pas de quiz —,
   * et sa série, que la soirée d'aujourd'hui a peut-être déjà tenue. Une
   * question montrée dont l'heure est passée est perdue : la partie laissée
   * sur sa dernière question est finie, même si personne n'est revenu le
   * constater (`expirer`).
   */
  async pourLeRappel(profileId: string): Promise<{ total: number; reste: number; serie: number; serieTenue: boolean }> {
    const jour = jourDe(this.maintenant())
    const tirage = await this.tirage(jour, true)
    if (!tirage) return { total: 0, reste: 0, serie: 0, serieTenue: false }
    const [partie, { serie, tenue }] = await Promise.all([this.partieDe(profileId, jour), this.serieDe(profileId, jour)])
    const total = tirage.questions.length
    let reste = total
    if (partie?.finieLe != null) reste = 0
    else if (partie) {
      reste -= partie.question
      const montree = tirage.questions[partie.question]
      if (partie.servieLe !== null && montree && this.maintenant() - partie.servieLe > montree.duree * 1000 + GRACE_MS) reste--
    }
    return { total, reste: Math.max(0, reste), serie, serieTenue: tenue }
  }

  /**
   * Le quiz du jour d'un profil, pour sa page (`CarriereDuJour`) : ses
   * médailles, sa série et son record, ses podiums, et ses trente derniers
   * jours. La nuit d'avant se clôt d'abord : son podium se compte. D'un seul
   * lot (`lecturesDeLaCarriere`).
   */
  async carriereDe(profileId: string): Promise<CarriereDuJour> {
    await this.clorePasses(jourDe(this.maintenant()))
    const lecture = this.lecturesDeLaCarriere(profileId)
    return this.carriereLue(profileId, await this.client.batch(lecture.lot, 'read'), lecture)
  }

  /**
   * Ce que l'accueil d'un profil demande au quiz du jour, d'un seul lot : sa
   * carrière (`carriereDe`), ses bonnes réponses — ses confettis du quiz du
   * jour (`justesDe`) — et les mercis de ses signalements. Lus chacun de son
   * côté, c'étaient trois allers-retours de front, et un quatrième derrière
   * pour ses trente derniers jours (le banc du 2 novembre 2026,
   * `profil-charge.test.ts`). Chaque part se rend à part : ce qui tombe en la
   * lisant n'ôte qu'elle.
   */
  accueilDe(profileId: string, depuis: number): AccueilDuJour {
    const lu = this.clorePasses(jourDe(this.maintenant())).then(async () => {
      const lecture = this.lecturesDeLaCarriere(profileId)
      const lus = await this.client.batch(
        [...lecture.lot, lectureDesJustes(profileId), lectureDesMercis(profileId, depuis), lectureDesPropositionsRelues(profileId, depuis)],
        'read',
      )
      return { lecture, lus }
    })
    return {
      carriere: lu.then(({ lecture, lus }) => this.carriereLue(profileId, lus.slice(0, lecture.lot.length), lecture)),
      justes: lu.then(({ lus }) => Number(lus[lus.length - 3].rows[0]?.n ?? 0)),
      // Ses mercis, et ce que le QG a fait des questions qu'il a proposées : le même lot, la même place sur l'accueil.
      mercis: lu.then(({ lus }) => [...mercisLus(lus[lus.length - 2]), ...propositionsRelues(lus[lus.length - 1])]),
    }
  }

  /**
   * Ce que sa carrière lit, d'un lot : ses parties, ses podiums, ses soirées
   * et ses sabliers — sa série —, puis, pour ses trente derniers jours joués
   * (`JOURS_RELUS`), cherchés dans la base même, ses bonnes réponses et leur
   * temps, et les points de leur salle — sauf ceux d'un jour déjà gardé
   * (`pointsGardes`). Ces jours-là s'attendaient d'abord : un aller-retour de
   * plus, l'un derrière l'autre, à chaque accueil (le 2 novembre 2026). La
   * révision de chaque jour se lit avant le lot : une réponse écrite pendant
   * l'aller-retour ne passe pas pour vue.
   */
  private lecturesDeLaCarriere(profileId: string): LectureDeLaCarriere {
    const aujourdhui = jourDe(this.maintenant())
    const revisions = new Map(this.revisions)
    const gardes = new Set([...this.pointsGardes].filter(([jour, g]) => g.revision === (revisions.get(jour) ?? 0)).map(([jour]) => jour))
    const derniers = `SELECT jour FROM jour_parties WHERE profile_id = ? ORDER BY jour DESC LIMIT ${JOURS_RELUS}`
    // Les jours gardés s'écartent de ses trente derniers avant d'en chercher la salle : écartés après, chacun relirait
    // tous ses joueurs pour les jeter, au quota de Turso.
    const aLire = gardes.size > 0 ? `SELECT jour FROM (${derniers}) WHERE jour NOT IN (${[...gardes].map(() => '?').join(', ')})` : derniers
    const justes = this.justesGardees.dans(profileId, {
      sql: `SELECT jour, question, ms FROM jour_reponses WHERE profile_id = ? AND juste = 1 AND jour IN (${derniers})`,
      args: [profileId, profileId],
    })
    return {
      aujourdhui,
      revisions,
      gardes,
      justes,
      lot: [
        {
          sql: `SELECT p.jour, p.points, p.justes, p.xp + p.xp_serie + p.xp_bonus AS xp, t.annulees,
                       json_array_length(t.questions) - json_array_length(t.annulees) AS comptees
                FROM jour_parties p LEFT JOIN jour_tirages t ON t.jour = p.jour
                WHERE p.profile_id = ? ORDER BY p.jour DESC`,
          args: [profileId],
        },
        { sql: 'SELECT jour, rang, xp FROM jour_podiums WHERE profile_id = ?', args: [profileId] },
        { sql: `SELECT created_at FROM profile_xp WHERE profile_id = ? AND ${HORS_LIGNES_A_PART}`, args: [profileId] },
        { sql: 'SELECT created_at FROM profile_sabliers WHERE profile_id = ?', args: [profileId] },
        justes.instruction,
        {
          sql: `SELECT jour, profile_id, points FROM jour_parties WHERE jour IN (${aLire})
                AND profile_id IN (SELECT id FROM profiles WHERE disabled_at IS NULL)`,
          args: [profileId, ...gardes],
        },
      ],
    }
  }

  /** Sa carrière (`carriereDe`), du lot de `lecturesDeLaCarriere`. */
  private carriereLue(profileId: string, [parties, podiums, soirees, sabliers, reponses, salle]: ResultSet[], lecture: LectureDeLaCarriere): CarriereDuJour {
    const { aujourdhui } = lecture
    const lues: JourLu[] = parties.rows.map(r => ({
      jour: String(r.jour),
      points: Number(r.points),
      justes: Number(r.justes),
      xp: Number(r.xp),
      comptees: Number(r.comptees ?? 0),
      annulees: lireNombres(r.annulees),
    }))
    const medailles: Record<TypeDeMedaille, number> = { or: 0, argent: 0, bronze: 0 }
    for (const p of lues) {
      const m = medailleDe(p.justes, p.comptees)
      if (m) medailles[m]++
    }
    const joues = new Set([...lues.map(p => p.jour), ...soirees.rows.map(r => jourDe(Number(r.created_at)))])
    const serie = serieAvecSabliers(
      joues,
      sabliers.rows.map(r => jourDe(Number(r.created_at))),
      aujourdhui,
    )
    const podiumDe = new Map(podiums.rows.map(r => [String(r.jour), Number(r.xp)]))
    return {
      joues: lues.length,
      serie: serie.serie,
      record: serie.record,
      sabliers: serie.sabliers,
      medailles,
      meilleurScore: lues.reduce((m, p) => Math.max(m, p.points), 0),
      podiums: podiums.rows.length,
      victoires: podiums.rows.filter(r => Number(r.rang) === 1).length,
      jours: this.joursJoues(profileId, lues.slice(0, JOURS_RELUS), podiumDe, lecture.justes.lue(reponses), salle, lecture),
    }
  }

  /**
   * Ses derniers jours, chacun avec sa place telle que le classement de ce
   * jour-là la donnait : rang partagé (`rangDansLesTries`), sans les profils
   * fermés ni les masqués — sauf lui, qui se voit toujours. Les points de la
   * salle des jours qui n'étaient pas gardés arrivent dans le lot
   * (`lecturesDeLaCarriere`), et se gardent sous la révision lue avant lui.
   */
  private joursJoues(
    profileId: string,
    recents: readonly JourLu[],
    podiumDe: ReadonlyMap<string, number>,
    justes: readonly JusteDUnJour[],
    salle: ResultSet,
    { revisions, gardes }: LectureDeLaCarriere,
  ): JourJoue[] {
    if (recents.length === 0) return []
    const jours = recents.map(p => p.jour)
    const revisionDe = (jour: string) => revisions.get(jour) ?? 0
    const manquants = jours.filter(j => !gardes.has(j))
    if (manquants.length > 0) {
      const lus = new Map<string, { id: string; points: number }[]>(manquants.map(j => [j, []]))
      for (const r of salle.rows) lus.get(String(r.jour))?.push({ id: String(r.profile_id), points: Number(r.points) })
      for (const [jour, points] of lus) {
        const garde = this.pointsGardes.get(jour)
        if (garde && garde.revision > revisionDe(jour)) continue
        this.pointsGardes.delete(jour)
        this.pointsGardes.set(jour, { revision: revisionDe(jour), points })
      }
      while (this.pointsGardes.size > JOURS_GARDES) this.pointsGardes.delete(this.pointsGardes.keys().next().value!)
    }
    // Les masqués s'écartent à la lecture — sauf lui, qui se voit toujours :
    // un masque posé ou levé vaut tout de suite, sans relire la base.
    const pointsDu = new Map<string, number[]>()
    for (const jour of jours) {
      const garde = this.pointsGardes.get(jour)
      if (garde) pointsDu.set(jour, garde.points.filter(e => e.id === profileId || !this.masques.has(e.id)).map(e => e.points))
    }
    const annuleesDu = new Map(recents.map(p => [p.jour, p.annulees]))
    const tempsDu = new Map<string, number>()
    for (const r of justes) {
      // Une question annulée ne compte plus : ni sa bonne réponse, ni son temps.
      if (annuleesDu.get(r.jour)?.includes(r.question)) continue
      tempsDu.set(r.jour, (tempsDu.get(r.jour) ?? 0) + r.ms)
    }
    return recents.map(p => {
      const tries = (pointsDu.get(p.jour) ?? [p.points]).sort((a, b) => b - a)
      return {
        jour: p.jour,
        points: p.points,
        rang: rangDansLesTries(p.points, tries),
        joueurs: tries.length,
        xp: p.xp + (podiumDe.get(p.jour) ?? 0),
        medaille: medailleDe(p.justes, p.comptees),
        comptees: p.comptees,
        justes: p.justes,
        tempsJustesMs: tempsDu.get(p.jour) ?? 0,
      }
    })
  }

  // ── La série ────────────────────────────────────────────────────────────

  /**
   * Ses jours d'affilée joués — au quiz du jour ou en soirée —, si aujourd'hui
   * y compte déjà, et les sabliers qui l'attendent. Relue sur 400 jours : la
   * série d'avant n'a pas besoin de plus — l'Ouroboros en demande cent —, et
   * la plus longue de sa vie se lit dans ses paliers (`statsDuJour`).
   */
  private async serieDe(profileId: string, aujourdhui: string): Promise<SerieDuJour> {
    return serieLue(await this.client.batch(lecturesDeLaSerie(profileId, jourAvant(aujourdhui, 400)), 'read'), aujourdhui)
  }

  /**
   * Sa série telle que sa vue la montre, de ses jours gardés (`joursDeSerieGardes`)
   * : relue seulement quand l'un de ses gestes l'a changée, ou le jour avec.
   */
  private async serieGardee(profileId: string, aujourdhui: string): Promise<SerieDuJour> {
    const lecture = lectureDeLaSerie(profileId, jourAvant(aujourdhui, 400))
    const { joues, sabliers } = await this.joursDeSerieGardes.lire(profileId, lecture, l => this.client.execute(l), aujourdhui)
    return serieAvecSabliers(new Set(joues), sabliers, aujourdhui)
  }

  /** Ses jours joués ce mois-ci (une partie commencée compte) : ce qui manque à sa page du calendrier. */
  async joursDuMois(profileId: string): Promise<number> {
    const mois = moisDe(jourDe(this.maintenant()))
    const res = await this.client.execute({
      sql: 'SELECT COUNT(*) AS n FROM jour_parties WHERE profile_id = ? AND jour >= ? AND jour <= ?',
      args: [profileId, `${mois}-01`, `${mois}-31`],
    })
    return Number(res.rows[0]?.n ?? 0)
  }

  /** Les sabliers qui l'attendent : ceux qu'il a achetés, moins ceux qu'un jour manqué a pris. */
  async sabliersDe(profileId: string): Promise<number> {
    return (await this.serieDe(profileId, jourDe(this.maintenant()))).sabliers
  }

  // ── La nuit ─────────────────────────────────────────────────────────────

  private async estClos(jour: string): Promise<boolean> {
    const res = await this.client.execute({ sql: 'SELECT 1 FROM jour_clotures WHERE jour = ?', args: [jour] })
    return res.rows.length > 0
  }

  /**
   * Clôt les jours passés qui ne l'ont pas été : le premier à revenir
   * aujourd'hui fait pour tous ce que minuit n'a pas pu faire.
   */
  async clorePasses(aujourdhui: string): Promise<void> {
    const hier = jourAvant(aujourdhui)
    const mois = moisDe(aujourdhui)
    if (this.closJusqua >= hier && this.lauriers.jour === hier && this.moisClosAvant === mois) return
    await this.avecVerrou('#nuit', async () => {
      if (this.closJusqua < hier) {
        const res = await this.client.execute({
          sql: `SELECT DISTINCT jour FROM jour_parties WHERE jour < ? AND jour NOT IN (SELECT jour FROM jour_clotures) ORDER BY jour`,
          args: [aujourdhui],
        })
        for (const r of res.rows) await this.clore(String(r.jour))
        this.closJusqua = hier
      }
      // Les jours d'un mois fini sont clos : le mois se clôt à son tour —
      // son champion, ses mois complets —, une fois.
      if (this.moisClosAvant !== mois) {
        await this.cloreLesMois(mois)
        this.moisClosAvant = mois
      }
      // La nuit close, le laurier passe à ceux d'hier.
      if (this.lauriers.jour !== hier) await this.lireLauriers(hier)
    })
  }

  /**
   * Fige un jour : son classement devient définitif, son podium est payé —
   * 25, 15 et 10, une marche de moins que la salle —, une seule fois. Un
   * profil masqué n'y monte pas ; celui qui n'a rien marqué non plus.
   */
  private async clore(jour: string) {
    if (await this.estClos(jour)) return
    // La base, pas le classement gardé : le podium se paie une fois, pour de bon.
    const joueurs = await this.joueursDu(jour, null, true)
    const classes = classer(joueurs, j => j.points, j => j.profil.name, j => j.profil.id)
    const podium = classes
      .filter(c => c.item.points > 0)
      .map(c => ({ profileId: c.item.profil.id, rang: c.rang, points: c.item.points, xp: xpDuPodium(c.rang, joueurs.length) }))
      .filter(p => p.xp > 0)
    const maintenant = this.maintenant()
    await this.client.batch(
      [
        { sql: 'INSERT OR IGNORE INTO jour_clotures (jour, joueurs, close_le) VALUES (?, ?, ?)', args: [jour, joueurs.length, maintenant] },
        ...podium.map(p => ({
          sql: 'INSERT OR IGNORE INTO jour_podiums (jour, profile_id, rang, points, xp) VALUES (?, ?, ?, ?, ?)',
          args: [jour, p.profileId, p.rang, p.points, p.xp],
        })),
      ],
      'write',
    )
    for (const p of podium) await this.avecVerrou(p.profileId, () => this.ecrireXp(p.profileId, jour))
    await this.decernerLaNuit(jour)
    console.log(`[jour] ${jour} clos : ${joueurs.length} joueur${joueurs.length > 1 ? 's' : ''}, ${podium.length} sur le podium`)
  }

  /**
   * Toute son expérience du quiz du jour, parties et podiums, recopiée dans
   * sa ligne (`LIGNE_JOUR`) — toujours sous le verrou du profil : lue puis
   * écrite, elle laisserait sinon une somme périmée par-dessus la bonne. Puis
   * les paliers du quiz du jour qu'elle lui fait atteindre, rangés sous ce
   * jour : celui de sa partie, ou celui que la nuit vient de clore.
   */
  private async ecrireXp(profileId: string, jour: string, paliers = true, lues?: ResultSet[]) {
    const [parties, podiums] = lues ?? (await this.client.batch(this.lecturesDeLExperience(profileId), 'read'))
    const xp = Number(parties.rows[0]?.xp ?? 0) + Number(podiums.rows[0]?.xp ?? 0)
    await this.deps.profiles.ecrireXpDuJour(profileId, xp, Number(parties.rows[0]?.n ?? 0))
    if (paliers) {
      await this.deps.profiles.accorderPaliersDuJour(profileId, jour, await this.statsDuJour(profileId))
      await this.accorderSaison(profileId, jour)
    }
  }

  /** Ce que son expérience du jour additionne : ses parties — leur bonus de série et leur question bonus comprise —, ses podiums. */
  private lecturesDeLExperience(profileId: string): InStatement[] {
    return [
      { sql: 'SELECT COALESCE(SUM(xp + xp_serie + xp_bonus), 0) AS xp, COUNT(*) AS n FROM jour_parties WHERE profile_id = ?', args: [profileId] },
      { sql: 'SELECT COALESCE(SUM(xp), 0) AS xp FROM jour_podiums WHERE profile_id = ?', args: [profileId] },
    ]
  }

  /**
   * Ses jours joués dans la période d'une saison, jusqu'à ce jour — une partie
   * commencée compte, comme pour la série. Jusqu'à ce jour seulement : la
   * relecture des jours passe aussi sur les premiers de la fête, et le timbre
   * se range sous le jour qui l'a vraiment fait tomber.
   */
  private async joursDeSaison(profileId: string, periode: { debut: string }, jour: string): Promise<number> {
    const res = await this.client.execute({
      sql: 'SELECT COUNT(*) AS n FROM jour_parties WHERE profile_id = ? AND jour >= ? AND jour <= ?',
      args: [profileId, periode.debut, jour],
    })
    return Number(res.rows[0]?.n ?? 0)
  }

  /**
   * Les fêtes (`shared/saisons.ts`) : assez de jours joués dans la période
   * ouvrent le légendaire de la saison, et chaque année le timbre de son
   * millésime (`shared/timbres.ts`), rangés sous ce jour.
   */
  private async accorderSaison(profileId: string, jour: string) {
    const periode = periodeDu(jour)
    if (!periode || (await this.joursDeSaison(profileId, periode, jour)) < periode.saison.jours) return
    await this.deps.profiles.accorderSaison(profileId, periode.saison, jour, millesimeDe(periode.fin))
  }

  // ── Ce que la partie, la nuit et le mois décernent ─────────────────────

  /**
   * Ce qu'une partie fait tomber en commençant : le Dernier Métro, passé
   * 23 h 30 à Paris ; la page du calendrier, au vingtième jour joué du mois
   * (`JOURS_POUR_UNE_PAGE` — une partie commencée compte, comme pour la
   * série). La page se range sous le mois : une seule par mois et par an.
   */
  private async decernerAuDebut(profileId: string, jour: string, quand: number): Promise<void> {
    if (minutesDeParis(quand) >= DEPUIS_LE_DERNIER_METRO) await this.deps.profiles.ranger(profileId, cleDuJour(jour), ['hf:dernier-metro'], quand)
    const mois = moisDe(jour)
    const res = await this.client.execute({
      sql: `SELECT COUNT(*) AS n FROM jour_parties WHERE profile_id = ? AND jour >= ? AND jour <= ?`,
      args: [profileId, `${mois}-01`, `${mois}-31`],
    })
    if (Number(res.rows[0]?.n ?? 0) >= JOURS_POUR_UNE_PAGE) {
      await this.deps.profiles.ranger(profileId, cleDuMois(mois), [cleDeLaPage(mois.slice(5, 7))], quand)
    }
  }

  /**
   * Ce qu'une partie fait tomber en finissant : le Lève-tôt, avant huit
   * heures à Paris ; et Chronos, le Divin du quiz du jour, au dernier jour
   * d'une série sans une faute assez longue (`chronosDescend` — la règle vit
   * dans `core/divins.ts`, avec celle des autres Divins).
   */
  private async decernerALaFin(profileId: string, jour: string, quand: number): Promise<void> {
    const cles: string[] = []
    if (minutesDeParis(quand) < AVANT_LE_LEVE_TOT) cles.push('hf:leve-tot')
    const res = await this.client.execute({
      sql: `SELECT p.jour FROM jour_parties p JOIN jour_tirages t ON t.jour = p.jour
            WHERE p.profile_id = ? AND p.jour > ? AND p.jour <= ? AND p.finie_le IS NOT NULL
              AND json_array_length(t.questions) > json_array_length(t.annulees)
              AND p.justes >= json_array_length(t.questions) - json_array_length(t.annulees)`,
      args: [profileId, jourAvant(jour, JOURS_DE_CHRONOS), jour],
    })
    if (chronosDescend(new Set(res.rows.map(r => String(r.jour))), jour)) cles.push('dv:chronos')
    if (cles.length > 0) await this.deps.profiles.ranger(profileId, cleDuJour(jour), cles, quand)
  }

  /**
   * Ce que la nuit décerne en clôturant un jour : ce qui se mesure aux
   * autres, quand tout le monde a joué. Le Laurier à chaque vainqueur ; le
   * Triomphe à trois victoires d'affilée ; et, dans une salle de huit au
   * moins (`SALLE_DU_JOUR`) : le Phénix du jour (vainqueur au lendemain d'un
   * jour fini dans la moitié basse), Seul au monde, la Lanterne du jour,
   * l'Éclair du jour, et le palier de L'Élite au premier quart. Le Courant
   * d'air, enfin, à qui a laissé sa partie en route. Les masqués n'y
   * comptent ni n'y gagnent rien, comme au podium.
   *
   * Rejouée — la relecture des jours passés, une nuit reprise après une
   * panne —, elle ne double rien : chaque ligne est unique sous son jour.
   */
  private async decernerLaNuit(jour: string): Promise<void> {
    const veille = jourAvant(jour)
    const avantVeille = jourAvant(jour, 2)
    const [parties, reponses, victoires, laVeille] = await this.client.batch(
      [
        {
          sql: `SELECT p.profile_id, p.points, p.question, p.servie_le, p.finie_le FROM jour_parties p
                JOIN profiles pr ON pr.id = p.profile_id AND pr.disabled_at IS NULL WHERE p.jour = ?`,
          args: [jour],
        },
        { sql: 'SELECT profile_id, question, choix, ms, juste FROM jour_reponses WHERE jour = ?', args: [jour] },
        { sql: 'SELECT jour, profile_id FROM jour_podiums WHERE rang = 1 AND jour IN (?, ?, ?)', args: [jour, veille, avantVeille] },
        {
          sql: `SELECT p.profile_id, p.points FROM jour_parties p
                JOIN profiles pr ON pr.id = p.profile_id AND pr.disabled_at IS NULL WHERE p.jour = ?`,
          args: [veille],
        },
      ],
      'read',
    )
    const tirage = await this.tirageLu(jour)
    if (!tirage) return
    const total = tirage.questions.length
    const salle = parties.rows
      .map(r => ({
        id: String(r.profile_id),
        points: Number(r.points),
        question: Number(r.question),
        servie: r.servie_le != null,
        finie: r.finie_le != null,
      }))
      .filter(j => !this.masques.has(j.id))
    const dansLaSalle = new Set(salle.map(j => j.id))
    const recompenses = new Map<string, Set<string>>()
    const donner = (id: string, cle: string) => {
      let siennes = recompenses.get(id)
      if (!siennes) recompenses.set(id, (siennes = new Set()))
      siennes.add(cle)
    }
    const vainqueurs = (j: string) => new Set(victoires.rows.filter(r => String(r.jour) === j).map(r => String(r.profile_id)))
    const [duJour, deLaVeille, deLAvantVeille] = [vainqueurs(jour), vainqueurs(veille), vainqueurs(avantVeille)]
    for (const id of duJour) {
      if (!dansLaSalle.has(id)) continue
      donner(id, 'hf:laurier')
      if (deLaVeille.has(id) && deLAvantVeille.has(id)) donner(id, 'hf:triomphe')
    }
    const grande = salle.length >= SALLE_DU_JOUR
    if (grande) {
      // Le Phénix du jour : la veille, dans la moitié basse d'une salle de huit.
      const hier = laVeille.rows.map(r => ({ id: String(r.profile_id), points: Number(r.points) })).filter(j => !this.masques.has(j.id))
      if (hier.length >= SALLE_DU_JOUR) {
        const points = hier.map(j => j.points).sort((a, b) => b - a)
        for (const j of hier) {
          if (duJour.has(j.id) && dansLaSalle.has(j.id) && rangDansLesTries(j.points, points) * 2 > hier.length) donner(j.id, 'hf:phenix-du-jour')
        }
      }
      // Seul au monde, et l'Éclair du jour : question par question.
      const parQuestion = new Map<number, { id: string; choix: number | null; ms: number | null; juste: boolean }[]>()
      for (const r of reponses.rows) {
        const id = String(r.profile_id)
        if (!dansLaSalle.has(id)) continue
        const q = Number(r.question)
        if (tirage.annulees.includes(q)) continue
        const liste = parQuestion.get(q) ?? []
        liste.push({ id, choix: r.choix == null ? null : Number(r.choix), ms: r.ms == null ? null : Number(r.ms), juste: Number(r.juste) === 1 })
        parQuestion.set(q, liste)
      }
      const eclairs = new Map<string, number>()
      for (const liste of parQuestion.values()) {
        const repondues = liste.filter(l => l.choix !== null)
        const justes = repondues.filter(l => l.juste)
        if (repondues.length >= SALLE_DU_JOUR && justes.length === 1) donner(justes[0].id, 'hf:seul-au-monde')
        const chronometrees = justes.filter(l => l.ms !== null)
        if (chronometrees.length >= 3) {
          const plusVite = Math.min(...chronometrees.map(l => l.ms!))
          for (const l of chronometrees) if (l.ms === plusVite) eclairs.set(l.id, (eclairs.get(l.id) ?? 0) + 1)
        }
      }
      for (const [id, n] of eclairs) if (n >= 3) donner(id, 'hf:eclair-du-jour')
      // La Lanterne du jour : dernier, en ayant répondu à tout — tous les ex æquo du bas.
      const plusBas = Math.min(...salle.map(j => j.points))
      const plusHaut = Math.max(...salle.map(j => j.points))
      if (plusBas < plusHaut) {
        const repondues = new Map<string, number>()
        for (const r of reponses.rows) if (r.choix != null) repondues.set(String(r.profile_id), (repondues.get(String(r.profile_id)) ?? 0) + 1)
        for (const j of salle) if (j.points === plusBas && j.finie && (repondues.get(j.id) ?? 0) >= total) donner(j.id, 'hf:lanterne-du-jour')
      }
    }
    // Le Courant d'air : commencée, et laissée avant sa dernière question.
    for (const j of salle) if (!j.finie && j.question + (j.servie ? 1 : 0) < total) donner(j.id, 'hf:courant-d-air')
    for (const [id, cles] of recompenses) await this.deps.profiles.ranger(id, cleDuJour(jour), [...cles], this.maintenant())
    // L'Élite : le premier quart d'une salle de huit fait monter son compte,
    // et peut-être son palier — sous son verrou, comme toute expérience.
    if (grande) {
      const points = salle.map(j => j.points).sort((a, b) => b - a)
      for (const j of salle) {
        if (j.points > 0 && rangDansLesTries(j.points, points) * 4 <= salle.length) {
          await this.avecVerrou(j.id, async () => this.deps.profiles.accorderPaliersDuJour(j.id, jour, await this.statsDuJour(j.id)))
        }
      }
    }
  }

  /**
   * Clôt les mois finis qui ne l'ont pas été : leur champion — le premier du
   * classement du mois, rang partagé, devant un autre au moins —, et leurs
   * mois complets — chaque jour qui avait un quiz, joué. Un mois ne compte
   * pour le Mois complet que s'il a eu presque tous ses quiz
   * (`JOURS_D_UN_MOIS_COMPLET`) : septembre 2026, ouvert le 26, n'en avait
   * que cinq. Une fois par mois, sous son drapeau — puis les champions du
   * mois dernier se relisent.
   */
  private async cloreLesMois(moisEnCours: string): Promise<void> {
    const res = await this.client.execute({
      sql: `SELECT DISTINCT substr(jour, 1, 7) AS mois FROM jour_parties WHERE jour < ?
            AND substr(jour, 1, 7) NOT IN (SELECT substr(cle, 11) FROM jour_meta WHERE cle LIKE 'mois_clos:%') ORDER BY mois`,
      args: [`${moisEnCours}-01`],
    })
    for (const r of res.rows) await this.cloreLeMois(String(r.mois))
    await this.lireChampions(moisAvant(moisEnCours))
  }

  private async cloreLeMois(mois: string): Promise<void> {
    const classement = await this.classementDuMois(mois, null)
    for (const l of classement.lignes) {
      if (l.rang === 1 && l.points > 0 && classement.joueurs >= 2) {
        await this.deps.profiles.ranger(l.profileId, cleDuMois(mois), [cleDuChampion(mois)], this.maintenant())
      }
    }
    const [tirages, parties] = await this.client.batch(
      [
        { sql: 'SELECT jour FROM jour_tirages WHERE jour >= ? AND jour <= ?', args: [`${mois}-01`, `${mois}-31`] },
        { sql: 'SELECT profile_id, jour FROM jour_parties WHERE jour >= ? AND jour <= ?', args: [`${mois}-01`, `${mois}-31`] },
      ],
      'read',
    )
    if (mois >= PREMIER_MOIS_DES_COFFRES) await this.poserLesCoffresDuMois(mois)
    const jours = new Set(tirages.rows.map(t => String(t.jour)))
    if (jours.size >= JOURS_D_UN_MOIS_COMPLET) {
      const parProfil = new Map<string, Set<string>>()
      for (const p of parties.rows) {
        const id = String(p.profile_id)
        const siens = parProfil.get(id) ?? new Set<string>()
        siens.add(String(p.jour))
        parProfil.set(id, siens)
      }
      for (const [id, siens] of parProfil) {
        if ([...jours].every(j => siens.has(j))) await this.deps.profiles.ranger(id, cleDuMois(mois), ['hf:mois-complet'], this.maintenant())
      }
    }
    await this.client.execute({
      sql: 'INSERT INTO jour_meta (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO NOTHING',
      args: [`mois_clos:${mois}`, String(this.maintenant())],
    })
    console.log(`[jour] ${mois} clos`)
  }

  /**
   * Pose le coffre de chaque joueur du mois qui se clôt : sa place au
   * classement du mois, rang partagé (`classer`, comme partout), tous les
   * joueurs et non les cinquante que l'écran montre. Comme pour le titre de
   * champion, il faut être deux au moins ; un masqué n'est pas classé. Une
   * partie à zéro point ne vaut que le coffre de bois : tous à zéro seraient
   * sinon tous premiers, et royaux. Écrit une fois (`OR IGNORE`) : la clôture
   * d'un mois qu'une panne a interrompue se rejoue sans doublon.
   */
  private async poserLesCoffresDuMois(mois: string): Promise<void> {
    const res = await this.client.execute({
      sql: `SELECT profile_id, SUM(points) AS points FROM jour_parties WHERE jour >= ? AND jour <= ? GROUP BY profile_id`,
      args: [`${mois}-01`, `${mois}-31`],
    })
    const profils = await this.deps.profiles.byIds(res.rows.map(r => String(r.profile_id)))
    const joueurs: { id: string; nom: string; points: number }[] = []
    res.rows.forEach((r, i) => {
      const profil = profils[i]
      if (profil && !this.masques.has(profil.id)) joueurs.push({ id: profil.id, nom: profil.name, points: Number(r.points) })
    })
    if (joueurs.length < 2) return
    const derniere = PLACES_DU_COFFRE_DU_MOIS.argent
    await this.client.batch(
      classer(joueurs, j => j.points, j => j.nom, j => j.id).map(({ item: j, rang }) => ({
        sql: 'INSERT OR IGNORE INTO jour_coffres_du_mois (mois, profile_id, place, points) VALUES (?, ?, ?, ?)',
        args: [mois, j.id, j.points > 0 ? rang : Math.max(rang, derniere + 1), j.points],
      })),
      'write',
    )
  }

  /** Les coffres de mois qui l'attendent, un par mois clos où il était classé : sa place, de quoi en tirer le rang du coffre. */
  async coffresDuMois(profileId: string): Promise<CoffreDuMoisLu[]> {
    // Rien ne tourne à minuit : la ligne des missions est souvent la première
    // demande du 1er du mois, et le coffre du mois serait sinon pour la suivante.
    await this.clorePasses(jourDe(this.maintenant()))
    return coffresDuMoisLus((await this.client.execute(lectureDesCoffresDuMois(profileId))).rows)
  }

  /** Relit les champions d'un mois clos : ceux que l'écran commun salue tout le mois suivant. */
  private async lireChampions(mois: string): Promise<void> {
    if (this.championsDuMois.mois === mois) return
    const res = await this.client.execute({
      sql: 'SELECT DISTINCT profile_id FROM profile_badges WHERE badge = ? AND soiree_id = ?',
      args: [cleDuChampion(mois), cleDuMois(mois)],
    })
    this.championsDuMois = { mois, ids: new Set(res.rows.map(r => String(r.profile_id))) }
  }

  /**
   * Le mois dont ce profil est le champion, s'il l'est du mois dernier : lu
   * en mémoire, pour l'instantané de la salle. Masqué, il ne s'annonce pas.
   */
  champions(profileId: string): string | null {
    const { mois, ids } = this.championsDuMois
    return mois && ids.has(profileId) && !this.masques.has(profileId) && mois === moisAvant(moisDe(jourDe(this.maintenant()))) ? mois : null
  }

  /**
   * Relit tous les jours passés avec les règles du jour, une fois par
   * version (`VERSION_DES_JOURS`) : ce qu'une nuit, une partie ou un mois
   * auraient décerné s'ils avaient connu ces règles. Les récompenses sont
   * des dérivations des journaux (invariant 20) : une nouvelle règle profite
   * aux jours d'avant — et rien ne double, chaque ligne étant unique sous son
   * jour ou son mois. Une base qui hoquette arrête le démarrage plutôt que
   * de poser le drapeau sur une relecture à moitié faite.
   */
  async relireLesJours(): Promise<{ jours: number; profils: number } | null> {
    const fait = await this.client.execute({ sql: 'SELECT valeur FROM jour_meta WHERE cle = ?', args: ['relecture_des_jours'] })
    if (Number(fait.rows[0]?.valeur ?? 0) >= VERSION_DES_JOURS) return null
    const aujourdhui = jourDe(this.maintenant())
    const [clos, parties] = await this.client.batch(
      [
        { sql: 'SELECT jour FROM jour_clotures ORDER BY jour', args: [] },
        { sql: 'SELECT profile_id, jour, commencee_le, finie_le FROM jour_parties ORDER BY jour', args: [] },
      ],
      'read',
    )
    await this.avecVerrou('#nuit', async () => {
      for (const r of clos.rows) await this.decernerLaNuit(String(r.jour))
      this.moisClosAvant = ''
      await this.cloreLesMois(moisDe(aujourdhui))
      this.moisClosAvant = moisDe(aujourdhui)
    })
    const profils = new Set<string>()
    for (const r of parties.rows) {
      const id = String(r.profile_id)
      const jour = String(r.jour)
      profils.add(id)
      await this.avecVerrou(id, async () => {
        await this.decernerAuDebut(id, jour, Number(r.commencee_le))
        if (r.finie_le != null) await this.decernerALaFin(id, jour, Number(r.finie_le))
        // Un jour de fête : sa saison et le timbre de son année (la version 2) — son profil lu d'abord, que la
        // saison déjà rangée ne se range pas une seconde fois sous un autre jour.
        if (periodeDu(jour)) {
          await this.deps.profiles.byId(id)
          await this.accorderSaison(id, jour)
        }
      })
    }
    for (const id of profils) await this.avecVerrou(id, async () => this.deps.profiles.accorderPaliersDuJour(id, aujourdhui, await this.statsDuJour(id)))
    await this.client.execute({
      sql: 'INSERT INTO jour_meta (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur',
      args: ['relecture_des_jours', String(VERSION_DES_JOURS)],
    })
    return { jours: clos.rows.length, profils: profils.size }
  }

  /**
   * Le barème du solo du 6 octobre 2026, appliqué à ce qui est déjà joué —
   * une fois, au démarrage qui l'apporte (`core/baremeDuSolo.ts`) : chaque
   * partie se recompte sur ses points (`xpDuJour`), chaque podium à son rang
   * (`xpDuPodium`), chaque partie reçoit le bonus de la série qu'elle tenait
   * ce jour-là (`seriesParJour`), et la ligne de chaque joueur se réécrit.
   * Tout se relit des journaux : rejouée, elle écrit la même chose. Rend les
   * profils dont la ligne a été réécrite.
   */
  async revaloriser(): Promise<string[]> {
    const [parties, podiums] = await this.client.batch(
      [
        {
          sql: `SELECT p.profile_id, p.jour, p.points,
                       json_array_length(t.questions) - json_array_length(t.annulees) AS comptees
                FROM jour_parties p JOIN jour_tirages t ON t.jour = p.jour`,
          args: [],
        },
        { sql: 'SELECT d.jour, d.profile_id, d.rang, c.joueurs FROM jour_podiums d JOIN jour_clotures c ON c.jour = d.jour', args: [] },
      ],
      'read',
    )
    const parProfil = new Map<string, { jour: string; points: number; comptees: number }[]>()
    for (const r of parties.rows) {
      const id = String(r.profile_id)
      if (!parProfil.has(id)) parProfil.set(id, [])
      parProfil.get(id)!.push({ jour: String(r.jour), points: Number(r.points), comptees: Number(r.comptees ?? 0) })
    }
    if (podiums.rows.length > 0) {
      await this.client.batch(
        podiums.rows.map(r => ({
          sql: 'UPDATE jour_podiums SET xp = ? WHERE jour = ? AND profile_id = ?',
          args: [xpDuPodium(Number(r.rang), Number(r.joueurs)), String(r.jour), String(r.profile_id)],
        })),
        'write',
      )
    }
    const profils = new Set([...parProfil.keys(), ...podiums.rows.map(r => String(r.profile_id))])
    const aujourdhui = jourDe(this.maintenant())
    for (const id of profils) {
      await this.avecVerrou(id, async () => {
        const series = seriesLues(await this.client.batch(lecturesDeLaSerie(id), 'read'))
        const siennes = parProfil.get(id) ?? []
        if (siennes.length > 0) {
          await this.client.batch(
            siennes.map(p => ({
              sql: 'UPDATE jour_parties SET xp = ?, xp_serie = ? WHERE profile_id = ? AND jour = ?',
              args: [xpDuJour(p.points, POINTS_MAX_PAR_QUESTION * p.comptees), xpDeSerie(series.get(p.jour) ?? 1), id, p.jour],
            })),
            'write',
          )
        }
        await this.ecrireXp(id, aujourdhui, false)
      })
    }
    return [...profils]
  }

  // ── La correction ───────────────────────────────────────────────────────

  /**
   * Les questions d'un jour, leurs réponses et leurs anecdotes : pour tous
   * une fois le jour clos, et pour celui qui a fini sa partie — « Revoir mes
   * réponses ». Avant, elles donneraient le quiz à qui ne l'a pas joué.
   */
  async correction(profil: ProfileRec, jour: string) {
    if (!jourValide(jour)) return null
    await this.clorePasses(jourDe(this.maintenant()))
    const tirage = await this.tirageLu(jour)
    if (!tirage) return null
    const partie = await this.partieDe(profil.id, jour)
    const clos = await this.estClos(jour)
    if (!clos && !partie?.finieLe) return null
    // La question bonus, au bout : jouée, ou connue d'avance — et à tous une fois le jour clos. Avant minuit, qui ne l'a pas
    // encore jouée ne la lit pas ici : il peut la jouer jusqu'à minuit.
    const bonus = tirage.bonus ? await this.bonusVu(profil, tirage, partie, { corrigee: clos }) : undefined
    const [siennes, salle] = await this.client.batch(
      [
        { sql: 'SELECT question, choix, juste, points, ms FROM jour_reponses WHERE profile_id = ? AND jour = ?', args: [profil.id, jour] },
        { sql: 'SELECT question, COUNT(*) AS n, COALESCE(SUM(juste), 0) AS justes FROM jour_reponses WHERE jour = ? GROUP BY question', args: [jour] },
      ],
      'read',
    )
    const sienne = new Map(siennes.rows.map(r => [Number(r.question), r]))
    const trouvee = new Map(salle.rows.map(r => [Number(r.question), Number(r.n) >= TROUVEE_PAR_DES ? Number(r.justes) / Number(r.n) : null]))
    // Sa propre question, s'il en a une ce jour-là : ce qu'elle lui a compté, sa moyenne sur les autres.
    const laSienne = sienneDans(tirage, profil.id)
    const gagnes = siennes.rows.filter(r => !tirage.annulees.includes(Number(r.question))).reduce((n, r) => n + Number(r.points), 0)
    return {
      jour,
      questions: tirage.questions.map((q, i) => {
        if (q.auteur === profil.id) {
          return {
            texte: q.texte,
            reponses: q.reponses,
            bonne: q.bonne,
            categorie: q.categorie,
            anecdote: q.anecdote,
            trouveePar: trouvee.get(i) ?? null,
            choix: null,
            juste: false,
            points: i === laSienne ? partDeLAuteur(gagnes, autresQuestions(tirage)) : 0,
            ms: null,
            duree: q.duree,
            rapidite: null,
            repondue: false,
            tienne: true as const,
            ...(tirage.annulees.includes(i) && { annulee: true }),
          }
        }
        const r = sienne.get(i)
        const annulee = tirage.annulees.includes(i)
        const choix = r?.choix == null ? null : Number(r.choix)
        const juste = Number(r?.juste ?? 0) === 1
        const points = annulee ? 0 : Number(r?.points ?? 0)
        // Une ligne sans choix mais avec son temps, passé l'échéance : la
        // réponse est arrivée après la fin, et la révélation l'a dit (« Trop
        // tard ! ») — la correction le redit, au lieu du temps écoulé.
        const tropTard = choix === null && r?.ms != null && Number(r.ms) > q.duree * 1000 + GRACE_MS
        return {
          texte: q.texte,
          reponses: q.reponses,
          bonne: q.bonne,
          categorie: q.categorie,
          anecdote: q.anecdote,
          trouveePar: trouvee.get(i) ?? null,
          choix,
          juste,
          points,
          // En combien de temps sa réponse est partie, sur combien de
          // secondes, et ce que la rapidité en a payé : la correction ne
          // disait que le total, et pas si l'on avait répondu vite (un retour
          // utilisateur du 13 octobre 2026). Une réponse arrivée après
          // l'échéance n'a pas compté : pas de temps à dire.
          ms: choix === null || r?.ms == null ? null : Number(r.ms),
          duree: q.duree,
          rapidite: juste && !annulee ? bonusDeRapidite(points) : null,
          repondue: !!r,
          ...(tropTard && { tropTard: true }),
          ...(annulee && { annulee: true }),
        }
      }),
      ...(bonus?.revelation && { bonus }),
    }
  }

  // ── La modération ───────────────────────────────────────────────────────

  /** Un joueur signale une erreur dans une question qu'il a jouée. */
  async signaler(profil: ProfileRec, jour: string, index: number, texte: unknown): Promise<void> {
    const propre = tronquer(String(texte ?? '').trim(), SIGNALEMENT_MAX)
    if (!propre) throw new Error('Dis en une phrase ce qui ne va pas')
    const res = await this.client.execute({
      sql: 'SELECT 1 FROM jour_reponses WHERE profile_id = ? AND jour = ? AND question = ?',
      args: [profil.id, jour, index],
    })
    if (res.rows.length === 0) throw new Error('Réponds d’abord à cette question')
    // Signalée de nouveau après une relecture, elle revient à relire : l'issue d'avant ne la suit pas.
    await this.client.execute({
      sql: `INSERT INTO jour_signalements (jour, question, profile_id, texte, cree_le) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(jour, question, profile_id) DO UPDATE SET texte = excluded.texte, cree_le = excluded.cree_le, traite_le = NULL, issue = NULL, detail = NULL`,
      args: [jour, index, profil.id, propre, this.maintenant()],
    })
  }

  /**
   * Les questions du jour signalées et pas encore relues, pour la page des
   * signalements du QG (`/admin#signalements`) : telles que leur jour les a
   * posées — et ce que chaque réponse y a recueilli —, leur version de la
   * réserve, celle que « Corriger » et « Reclasser » reprennent, et qui les
   * signale — ce qu'il en dit, ce qu'il avait répondu —, ceux déjà relus
   * avec. Un aller-retour pour les signalements, un pour tout le reste : les
   * tirages se lisent en mémoire. Les prénoms, au profil, dans la route.
   */
  async signalementsAuQg(): Promise<SignalementDuJour[]> {
    const res = await this.client.execute({
      sql: `SELECT s.jour, s.question, s.profile_id, s.texte, s.cree_le, s.traite_le, s.issue, r.choix, r.juste
            FROM jour_signalements s
            LEFT JOIN jour_reponses r ON r.profile_id = s.profile_id AND r.jour = s.jour AND r.question = s.question
            WHERE (s.jour, s.question) IN (
              SELECT jour, question FROM jour_signalements WHERE traite_le IS NULL
              GROUP BY jour, question ORDER BY MAX(cree_le) DESC LIMIT ?
            )
            ORDER BY s.cree_le DESC`,
      args: [SIGNALEMENTS_MONTRES_AU_QG],
    })
    const parQuestion = new Map<string, Record<string, unknown>[]>()
    for (const r of res.rows) {
      const cle = `${r.jour}#${r.question}`
      const lignes = parQuestion.get(cle)
      if (lignes) lignes.push(r)
      else parQuestion.set(cle, [r])
    }
    if (parQuestion.size === 0) return []
    const jours = [...new Set(res.rows.map(r => String(r.jour)))]
    const tirages = new Map(await Promise.all(jours.map(async j => [j, await this.tirageLu(j)] as const)))
    const questions = [...parQuestion.values()].flatMap(lignes => {
      const jour = String(lignes[0].jour)
      const index = Number(lignes[0].question)
      const tirage = tirages.get(jour)
      const q = tirage?.questions[index]
      return tirage && q ? [{ jour, index, tirage, q, lignes }] : []
    })
    if (questions.length === 0) return []
    const aujourdhui = jourDe(this.maintenant())
    // Ce que chaque réponse a recueilli, leur version de la réserve, et si la
    // nuit a déjà clos aujourd'hui : d'un seul lot.
    const [reserve, clos, ...recueils] = await this.client.batch(
      [
        {
          sql: `SELECT id, question, categorie, metadonnees, retiree_le FROM jour_reserve WHERE id IN (${questions.map(() => '?').join(', ')})`,
          args: questions.map(x => x.q.reserveId),
        },
        { sql: 'SELECT 1 FROM jour_clotures WHERE jour = ?', args: [aujourdhui] },
        ...questions.map(x => ({
          sql: 'SELECT choix, COUNT(*) AS n FROM jour_reponses WHERE jour = ? AND question = ? GROUP BY choix',
          args: [x.jour, x.index],
        })),
      ],
      'read',
    )
    const versions = new Map(reserve.rows.map(r => [String(r.id), versionDeLaReserve(r)]))
    const aujourdhuiClos = clos.rows.length > 0
    return questions
      .map(({ jour, index, tirage, q, lignes }, i): SignalementDuJour => {
        const parReponse = q.reponses.map(() => 0)
        let sansReponse = 0
        for (const r of recueils[i].rows) {
          if (r.choix === null) sansReponse += Number(r.n)
          else if (parReponse[Number(r.choix)] !== undefined) parReponse[Number(r.choix)] += Number(r.n)
        }
        const rapports = lignes.map(r => ({
          profileId: String(r.profile_id),
          prenom: null,
          login: null,
          texte: String(r.texte),
          le: Number(r.cree_le),
          traiteLe: r.traite_le === null ? null : Number(r.traite_le),
          issue: lireIssue(r.issue),
          // Telle qu'il l'a lue : le jour garde l'ordre de ses réponses.
          reponse: r.choix === null || r.choix === undefined ? null : (q.reponses[Number(r.choix)] ?? null),
          juste: Number(r.juste ?? 0) === 1,
        }))
        const ouverts = rapports.filter(r => r.traiteLe === null)
        return {
          jour,
          index,
          reserveId: q.reserveId,
          texte: q.texte,
          reponses: q.reponses,
          bonne: q.bonne,
          anecdote: q.anecdote,
          categorie: q.categorie,
          parReponse,
          sansReponse,
          reserve: versions.get(q.reserveId) ?? null,
          annulee: tirage.annulees.includes(index),
          // On annule tant que le jour court : après minuit, son podium est payé.
          annulable: jour === aujourdhui && !aujourdhuiClos,
          joueurs: ouverts.length,
          rapports,
          dernier: Math.max(...ouverts.map(r => r.le)),
        }
      })
      .filter(s => s.joueurs > 0)
      .sort((a, b) => b.dernier - a.dernier)
  }

  /**
   * Les questions du jour relues depuis `depuis`, la plus récente d'abord :
   * l'historique de la page des signalements. Une relecture referme d'un
   * coup les signalements ouverts d'une question, au même instant et sous
   * la même issue : ils se regroupent par là. L'intitulé, tel que son jour
   * le garde — corrigé, s'il l'a été partout.
   */
  async signalementsRelus(depuis: number): Promise<SignalementRelu[]> {
    const res = await this.client.execute({
      sql: `SELECT s.jour, s.question, s.traite_le, MAX(s.issue) AS issue, MAX(s.detail) AS detail, COUNT(*) AS n,
                   json_extract(t.questions, '$[' || s.question || '].texte') AS texte,
                   json_extract(t.questions, '$[' || s.question || '].categorie') AS categorie
            FROM jour_signalements s LEFT JOIN jour_tirages t ON t.jour = s.jour
            WHERE s.traite_le >= ?
            GROUP BY s.jour, s.question, s.traite_le ORDER BY s.traite_le DESC LIMIT ?`,
      args: [depuis, RELUS_MONTRES],
    })
    return res.rows.flatMap((r): SignalementRelu[] =>
      typeof r.texte !== 'string'
        ? []
        : [
            {
              source: 'jour',
              cle: `${r.jour}#${r.question}`,
              texte: r.texte,
              categorie: typeof r.categorie === 'string' ? r.categorie : null,
              issue: lireIssue(r.issue),
              detail: typeof r.detail === 'string' ? r.detail : null,
              quand: Number(r.traite_le),
              joueurs: Number(r.n),
              jour: String(r.jour),
            },
          ],
    )
  }

  /** Les signalements à traiter, question par question : combien, et ce qu'ils disent. */
  async signalements() {
    const res = await this.client.execute(
      `SELECT jour, question, COUNT(*) AS n, MAX(cree_le) AS dernier,
              json_group_array(texte) AS textes
       FROM jour_signalements WHERE traite_le IS NULL GROUP BY jour, question ORDER BY dernier DESC LIMIT 30`,
    )
    const aujourdhui = jourDe(this.maintenant())
    const sortie = []
    for (const r of res.rows) {
      const jour = String(r.jour)
      const index = Number(r.question)
      const tirage = await this.tirageLu(jour)
      const q = tirage?.questions[index]
      if (!tirage || !q) continue
      sortie.push({
        jour,
        index,
        reserveId: q.reserveId,
        texte: q.texte,
        bonne: q.reponses[q.bonne],
        joueurs: Number(r.n),
        textes: lireTextes(r.textes).slice(-3),
        annulee: tirage.annulees.includes(index),
        // On annule tant que le jour court : après minuit, son podium est payé.
        annulable: jour === aujourdhui && !(await this.estClos(jour)),
      })
    }
    return sortie
  }

  /**
   * Ce que le QG compte des signalements à traiter : les questions, et les
   * joueurs qui les signalent. Ceux que `signalements` montre, et eux seuls —
   * une question de son tirage : le QG en annonçait que la page ne listait pas.
   */
  async signalementsATraiter(): Promise<{ questions: number; joueurs: number }> {
    const res = await this.client.execute(
      `SELECT COUNT(DISTINCT s.jour || '#' || s.question) AS questions, COUNT(DISTINCT s.profile_id) AS joueurs
       FROM jour_signalements s JOIN jour_tirages t ON t.jour = s.jour
       WHERE s.traite_le IS NULL AND s.question < json_array_length(t.questions)`,
    )
    return { questions: Number(res.rows[0]?.questions ?? 0), joueurs: Number(res.rows[0]?.joueurs ?? 0) }
  }

  /**
   * L'avance de la réserve, et le dernier dépôt de la routine du matin : ce
   * que le QG en dit à chaque relecture. Les questions prêtes seules, par
   * l'index des questions pas encore posées — `etatDeLaReserve` parcourt
   * toute la réserve, posées comprises, pour la page qui la détaille.
   */
  async avanceDeLaReserve(): Promise<{ joursDAvance: number; dernierDepotIa: number | null }> {
    const [pretes, ia] = await this.client.batch(
      [
        // Comme `etatDeLaReserve` : une question du public sort une par jour, elle ne fait pas un dixième de jour d'avance.
        "SELECT COUNT(*) AS n FROM jour_reserve WHERE posee_le IS NULL AND retiree_le IS NULL AND source <> 'public'",
        "SELECT MAX(quand) AS quand FROM jour_apports WHERE source = 'ia'",
      ],
      'read',
    )
    const quand = ia.rows[0]?.quand
    return {
      joursDAvance: Math.floor(Number(pretes.rows[0]?.n ?? 0) / QUESTIONS_PAR_JOUR),
      dernierDepotIa: quand === null || quand === undefined ? null : Number(quand),
    }
  }

  /**
   * Les parties commencées depuis un instant, qui, quand et combien de
   * questions jouées — répondues ou laissées au temps : le QG en tire les
   * chiffres du jour, la participation des trente derniers jours et leur
   * activité. Trois colonnes seulement — une partie se lit ailleurs en
   * entier. Cherchées par leur jour, que l'index connaît, puis à l'instant
   * près : le QG les relit depuis minuit à chaque relecture. `qui` : celles
   * d'un seul profil, sa fiche au QG — par sa clé, `(profile_id, jour)`. En un
   * seul texte JSON, comme les séries de la campagne (`seriesDepuis`) : le
   * client de Turso décode chaque ligne à coups de `defineProperty`.
   *
   * Et, pour les modes côte à côte du QG (le QG 2, lot 5), sa fin, ses bonnes
   * réponses et ses questions qui comptent — deux colonnes de plus des mêmes
   * lignes, pas une de plus au quota. Ses `justes` ont déjà perdu les
   * questions annulées pour tous (`recompter`) ; ses questions posées, non :
   * les annulées des jours qui en ont viennent du même lot, par la clé des
   * tirages — un tirage par jour, une dizaine sur trente jours, aucune le
   * plus souvent —, et `comptees` ôte celles qu'il a passées. Une question
   * laissée au temps compte, comme au QG (`partDesBonnes`) : le joueur l'a vue.
   */
  async partiesDepuis(
    depuis: number,
    qui?: string,
  ): Promise<{ qui: string; quand: number; questions: number; fin: number | null; justes: number; comptees: number }[]> {
    const [res, annuleesLues] = await this.client.batch(
      [
        {
          sql: `SELECT json_group_array(json_array(profile_id, commencee_le, question, finie_le, justes, jour)) AS lignes
                FROM jour_parties WHERE jour >= ? AND commencee_le >= ?${qui === undefined ? '' : ' AND profile_id = ?'}`,
          args: qui === undefined ? [jourDe(depuis), depuis] : [jourDe(depuis), depuis, qui],
        },
        { sql: "SELECT jour, annulees FROM jour_tirages WHERE jour >= ? AND annulees <> '[]'", args: [jourDe(depuis)] },
      ],
      'read',
    )
    const annulees = new Map(annuleesLues.rows.map(r => [String(r.jour), lireNombres(r.annulees)]))
    const lignes = JSON.parse(String(res.rows[0]?.lignes ?? '[]')) as [string, number, number, number | null, number, string][]
    return lignes.map(([qui, quand, questions, fin, justes, jour]) => {
      const posees = Number(questions)
      // Les questions d'avant la sienne ont été posées : une annulée parmi elles ne compte plus pour personne.
      const otees = (annulees.get(String(jour)) ?? []).filter(i => i < posees).length
      return { qui: String(qui), quand: Number(quand), questions: posees, fin: fin === null ? null : Number(fin), justes: Number(justes), comptees: posees - otees }
    })
  }

  /**
   * Les parties commencées entre deux instants — qui, quand, ses questions
   * posées (`question`, comme l'activité les compte) —, pour la mémoire du QG
   * (`server/src/joueursDuQg.ts`) : elle écrit chaque jour fini une fois, et
   * rattrape d'un coup ceux qui manquent, un mois de journaux à la fois. Par
   * leurs jours, que l'index connaît, puis à l'instant près ; en un seul texte
   * JSON, comme `partiesDepuis`.
   */
  async partiesEntre(debut: number, fin: number): Promise<{ qui: string; quand: number; questions: number }[]> {
    const res = await this.client.execute({
      sql: `SELECT json_group_array(json_array(profile_id, commencee_le, question)) AS lignes
            FROM jour_parties WHERE jour >= ? AND jour <= ? AND commencee_le >= ? AND commencee_le < ?`,
      args: [jourDe(debut), jourDe(fin - 1), debut, fin],
    })
    const lignes = JSON.parse(String(res.rows[0]?.lignes ?? '[]')) as [string, number, number][]
    return lignes.map(([qui, quand, questions]) => ({ qui: String(qui), quand: Number(quand), questions: Number(questions) }))
  }

  // ── Le suivi du QG ──────────────────────────────────────────────────────

  /**
   * Le tirage d'aujourd'hui question par question, pour le QG : ce que
   * chaque réponse a recueilli, les questions laissées au temps, le temps
   * moyen d'une réponse, les signalements ouverts — et les parties du jour.
   * Le tirage ne se tire pas d'ici : sans joueur, il n'y a rien à suivre.
   * Les choix voyagent en un seul texte — Turso décode chaque ligne —, et
   * l'index des réponses du jour (`idx_jour_reponses_question`) les trouve.
   */
  async suiviDAujourdhui(): Promise<{
    jour: string
    parties: { commencees: number; finies: number }
    questions: QuestionDuSuivi[]
    bonus?: Omit<BonusDuSuivi, 'auteur'> & { auteurId: string | null }
  }> {
    const jour = jourDe(this.maintenant())
    const [tirage, [parties, choix, signales, duBonus]] = await Promise.all([
      this.tirage(jour),
      this.client.batch(
        [
          { sql: 'SELECT COUNT(*) AS n, COUNT(finie_le) AS finies FROM jour_parties WHERE jour = ?', args: [jour] },
          {
            sql: `SELECT json_group_array(json_array(question, choix, n, ms, chronometrees)) AS lignes FROM (
                    SELECT question, choix, COUNT(*) AS n, SUM(CASE WHEN choix IS NOT NULL THEN ms END) AS ms,
                           COUNT(CASE WHEN choix IS NOT NULL THEN ms END) AS chronometrees
                    FROM jour_reponses WHERE jour = ? GROUP BY question, choix)`,
            args: [jour],
          },
          { sql: 'SELECT question, COUNT(*) AS n FROM jour_signalements WHERE jour = ? AND traite_le IS NULL GROUP BY question', args: [jour] },
          // Sa question bonus, choix par choix, et ses pouces : de ses parties, par l'index de leur jour.
          {
            sql: `SELECT json_group_array(json_array(bonus_choix, n, pour, contre)) AS lignes FROM (
                    SELECT bonus_choix, COUNT(*) AS n, COALESCE(SUM(bonus_vote = 1), 0) AS pour, COALESCE(SUM(bonus_vote = -1), 0) AS contre
                    FROM jour_parties WHERE jour = ? AND bonus_le IS NOT NULL GROUP BY bonus_choix)`,
            args: [jour],
          },
        ],
        'read',
      ),
    ])
    const b = tirage?.bonus
    let bonus: (Omit<BonusDuSuivi, 'auteur'> & { auteurId: string | null }) | undefined
    if (b) {
      const parReponse = b.reponses.map(() => 0)
      let sansReponse = 0
      let pour = 0
      let contre = 0
      for (const [c, n, p, k] of JSON.parse(String(duBonus.rows[0]?.lignes ?? '[]')) as [number | null, number, number, number][]) {
        if (c === null || !(c >= 0 && c < parReponse.length)) sansReponse += n
        else parReponse[c] += n
        pour += p
        contre += k
      }
      const joueurs = parReponse.reduce((s, n) => s + n, 0) + sansReponse
      bonus = {
        texte: b.texte,
        categorie: b.categorie,
        reponses: b.reponses,
        bonne: b.bonne,
        auteurId: b.auteur ?? null,
        parReponse,
        sansReponse,
        joueurs,
        trouvees: parReponse[b.bonne] ?? 0,
        pour,
        contre,
        annulee: b.annulee !== undefined,
      }
    }
    const parQuestion = new Map<number, [number | null, number, number | null, number][]>()
    for (const [question, c, n, ms, chronometrees] of JSON.parse(String(choix.rows[0]?.lignes ?? '[]')) as [number, number | null, number, number | null, number][]) {
      parQuestion.set(question, [...(parQuestion.get(question) ?? []), [c, n, ms, chronometrees]])
    }
    const signalements = new Map(signales.rows.map(r => [Number(r.question), Number(r.n)]))
    return {
      jour,
      parties: { commencees: Number(parties.rows[0]?.n ?? 0), finies: Number(parties.rows[0]?.finies ?? 0) },
      questions: (tirage?.questions ?? []).map((q, index) => ({
        index,
        reserveId: q.reserveId,
        texte: q.texte,
        categorie: q.categorie,
        reponses: q.reponses,
        bonne: q.bonne,
        ...recueilDeLaQuestion(q.reponses.length, parQuestion.get(index) ?? []),
        annulee: tirage!.annulees.includes(index),
        signalements: signalements.get(index) ?? 0,
      })),
      ...(bonus && { bonus }),
    }
  }

  /** Les bonnes réponses d'un jour clos, gardées : passé minuit, rien ne s'y annule plus. */
  private bonnesGardees: { jour: string; part: Promise<PartDesBonnes | null> } | null = null

  /**
   * Les bonnes réponses d'un jour clos, sur ses questions qui comptent — les
   * annulées écartées, une question laissée au temps comptée comme une
   * faute : la même règle que `partDesBonnes`. Hier, au QG, à côté
   * d'aujourd'hui.
   */
  bonnesDUnJourClos(jour: string): Promise<PartDesBonnes | null> {
    if (this.bonnesGardees?.jour !== jour) {
      const part = (async () => {
        const tirage = await this.tirage(jour)
        if (!tirage) return null
        const res = await this.client.execute({
          sql: 'SELECT question, COUNT(*) AS n, COALESCE(SUM(juste), 0) AS justes FROM jour_reponses WHERE jour = ? GROUP BY question',
          args: [jour],
        })
        let justes = 0
        let sur = 0
        for (const r of res.rows) {
          if (tirage.annulees.includes(Number(r.question))) continue
          justes += Number(r.justes)
          sur += Number(r.n)
        }
        return { justes, sur }
      })()
      // Un échec ne reste pas en mémoire : la page suivante relit la base.
      part.catch(() => {
        if (this.bonnesGardees?.part === part) this.bonnesGardees = null
      })
      this.bonnesGardees = { jour, part }
    }
    return this.bonnesGardees.part
  }

  // ── Les questions au QG (le QG 2, lot 7) ─────────────────────────────────

  /**
   * Ce que les réponses des jours clos ont recueilli, question par question,
   * jusqu'au dernier jour clos lu (`jusqua`) : passé minuit, une réponse ne
   * s'y ajoute plus — seule la suppression d'un profil en retire, et oublie
   * tout (`oublierProfil`). Lus une fois, puis seulement les jours qui se
   * closent : relus à chaque page des questions, ils parcouraient au quota de
   * Turso toutes les réponses d'un trimestre pour en montrer celles d'aujourd'hui.
   */
  private recueilsClos: { jusqua: string; parJour: Map<string, Map<number, LigneDuRecueil[]>> } | null = null

  /**
   * Les questions posées depuis `jours` jours (aujourd'hui compris), pour la
   * page des questions du QG (`/admin#questions`) : chaque tirage tel que son
   * jour l'a figé, ce que ses réponses ont recueilli — choix par choix, leur
   * temps, la plus récente —, ses signalements ouverts, et la version de la
   * réserve de chacune. D'un seul lot, chaque lecture par son index : les
   * tirages par leur jour, la réserve par celui où elle a été posée
   * (`idx_jour_reserve_posee`), les signalements par leur clé, les réponses
   * d'aujourd'hui — et des jours clos pas encore lus — par leur jour
   * (`idx_jour_reponses_question`). Chaque partie en un seul texte JSON : le
   * client de Turso décode chaque ligne à coups de `defineProperty`.
   */
  async questionsAuQg(jours = JOURS_DES_QUESTIONS_DU_JOUR): Promise<LectureDesQuestionsDuJour> {
    const aujourdhui = jourDe(this.maintenant())
    const depuis = jourAvant(aujourdhui, jours - 1)
    const hier = jourAvant(aujourdhui)
    const gardes = this.recueilsClos
    // Les jours clos qu'on n'a pas encore lus : tous au premier appel, puis seulement ceux que minuit a clos depuis.
    const closALire = !gardes ? { apres: jourAvant(depuis), jusqua: hier } : gardes.jusqua < hier ? { apres: gardes.jusqua, jusqua: hier } : null
    const recueil = (apres: string, jusqua: string): InStatement => ({ sql: RECUEIL_DES_JOURS, args: [apres, jusqua] })
    const [tirages, reserve, signales, clos, duJour, ...lusClos] = await this.client.batch(
      [
        { sql: "SELECT json_group_array(json_array(jour, CASE WHEN json_valid(questions) THEN json(questions) END, annulees)) AS lignes FROM jour_tirages WHERE jour >= ?", args: [depuis] },
        { sql: 'SELECT json_group_array(json_array(id, question, categorie, metadonnees, retiree_le)) AS lignes FROM jour_reserve WHERE posee_le >= ?', args: [depuis] },
        { sql: 'SELECT jour, question, COUNT(*) AS n FROM jour_signalements WHERE jour >= ? AND traite_le IS NULL GROUP BY jour, question', args: [depuis] },
        { sql: 'SELECT 1 FROM jour_clotures WHERE jour = ?', args: [aujourdhui] },
        recueil(hier, aujourdhui),
        ...(closALire ? [recueil(closALire.apres, closALire.jusqua)] : []),
      ],
      'read',
    )
    const parJour = (res: ResultSet | undefined) => {
      const lignes = new Map<string, Map<number, LigneDuRecueil[]>>()
      for (const [jour, question, choix, n, ms, chronometrees, le] of JSON.parse(String(res?.rows[0]?.lignes ?? '[]')) as [string, number, number | null, number, number | null, number, number][]) {
        let duJour = lignes.get(jour)
        if (!duJour) lignes.set(jour, (duJour = new Map()))
        const siennes = duJour.get(question)
        const ligne: LigneDuRecueil = [choix, Number(n), ms === null ? null : Number(ms), Number(chronometrees), Number(le)]
        if (siennes) siennes.push(ligne)
        else duJour.set(question, [ligne])
      }
      return lignes
    }
    // Les jours clos lus se gardent ; ceux sortis de la fenêtre s'oublient.
    const desClos = new Map([...(gardes?.parJour ?? []), ...(closALire ? parJour(lusClos[0]) : [])])
    for (const jour of [...desClos.keys()]) if (jour < depuis) desClos.delete(jour)
    // Sauf si un profil parti pendant la lecture les a fait oublier : ses réponses y seraient encore, la suivante relira tout.
    if (this.recueilsClos === gardes) this.recueilsClos = { jusqua: closALire ? closALire.jusqua : gardes!.jusqua, parJour: desClos }
    const recueils = new Map([...desClos, ...parJour(duJour)])
    const signalements = new Map(signales.rows.map(r => [`${r.jour}#${r.question}`, Number(r.n)]))
    const versions = new Map<string, VersionDeLaReserve>()
    for (const [id, question, categorie, metadonnees, retireeLe] of JSON.parse(String(reserve.rows[0]?.lignes ?? '[]')) as unknown[][]) {
      const v = versionDeLaReserve({ id, question, categorie, metadonnees, retiree_le: retireeLe })
      if (v) versions.set(String(id), v)
    }
    const posees: QuestionPoseeDuJour[] = []
    for (const [jour, questions, annulees] of JSON.parse(String(tirages.rows[0]?.lignes ?? '[]')) as [string, QuestionTiree[] | null, unknown][]) {
      if (!Array.isArray(questions)) continue
      const annuleesDuJour = lireNombres(annulees)
      questions.forEach((q, index) => {
        if (!q?.reserveId) return
        posees.push({
          jour,
          index,
          question: { reserveId: q.reserveId, texte: q.texte, reponses: q.reponses, bonne: q.bonne, categorie: q.categorie ?? null, anecdote: q.anecdote ?? null },
          annulee: annuleesDuJour.includes(index),
          lignes: recueils.get(jour)?.get(index) ?? [],
          signalements: signalements.get(`${jour}#${index}`) ?? 0,
        })
      })
    }
    return { aujourdhui, aujourdhuiOuvert: clos.rows.length === 0, posees, reserve: versions }
  }

  /** Les séries en cours, gardées dix minutes : elles bougent avec les parties, pas avec les clics. */
  private seriesGardees: { a: number; jour: string; lues: Promise<SeriesLues> } | null = null

  /**
   * Les séries qui tiennent encore, pour le QG, la plus longue d'abord. Une
   * série ne s'écrit nulle part : elle se relit des jours joués, des soirées
   * et des sabliers (`serieAvecSabliers`), comme sur la page de chacun. Les
   * candidats ont joué ces derniers jours — deux sabliers couvrent au plus
   * deux jours manqués, et aujourd'hui ne coûte rien avant minuit —, et
   * chacun relit tous ses jours : une série de cent jours se compte depuis
   * son premier. Une ligne par joueur, ses jours en un texte ; les profils
   * suspendus n'y sont pas. Et les sabliers achetés depuis le premier du
   * mois, dans le même aller-retour.
   */
  seriesEnCours(): Promise<SeriesLues> {
    const maintenant = this.maintenant()
    const aujourdhui = jourDe(maintenant)
    const garde = this.seriesGardees
    if (garde && garde.jour === aujourdhui && maintenant - garde.a < SERIES_GARDEES_MS) return garde.lues
    // Joué il y a trois jours, deux sabliers couvrent les deux d'après : un jour de plus, pour le minuit de Paris.
    const depuis = jourAvant(aujourdhui, SABLIERS_MAX + 2)
    const apres = Date.UTC(Number(depuis.slice(0, 4)), Number(depuis.slice(5, 7)) - 1, Number(depuis.slice(8, 10)))
    const candidats = `WITH candidats AS (
        SELECT c.profile_id FROM (
          SELECT profile_id FROM jour_parties WHERE jour >= ?
          UNION SELECT profile_id FROM profile_xp WHERE created_at >= ? AND ${HORS_LIGNES_A_PART}
        ) c JOIN profiles pr ON pr.id = c.profile_id AND pr.disabled_at IS NULL)`
    const deSesCandidats = (table: string, colonne: string, filtre = '') => ({
      sql: `${candidats} SELECT profile_id, json_group_array(${colonne}) AS dates FROM ${table}
            WHERE profile_id IN (SELECT profile_id FROM candidats)${filtre} GROUP BY profile_id`,
      args: [depuis, apres],
    })
    const premierDuMois = minuitDe(Date.UTC(Number(aujourdhui.slice(0, 4)), Number(aujourdhui.slice(5, 7)) - 1, 1, 12))
    const lues = this.client
      .batch(
        [
          deSesCandidats('jour_parties', 'jour'),
          deSesCandidats('profile_xp', 'created_at', ` AND ${HORS_LIGNES_A_PART}`),
          deSesCandidats('profile_sabliers', 'created_at'),
          { sql: 'SELECT COUNT(*) AS n FROM profile_sabliers WHERE created_at >= ?', args: [premierDuMois] },
        ],
        'read',
      )
      .then(([parties, soirees, achats, duMois]) => {
        const lire = (rs: ResultSet, enJour: (d: string | number) => string) =>
          new Map(rs.rows.map(r => [String(r.profile_id), (JSON.parse(String(r.dates)) as (string | number)[]).map(enJour)]))
        const desParties = lire(parties, String)
        const desSoirees = lire(soirees, q => jourDe(Number(q)))
        const desSabliers = lire(achats, q => jourDe(Number(q)))
        const series: SerieDUnProfil[] = []
        // Seul aux soirées, sans partie du jour, sa série tient aussi.
        for (const profileId of new Set([...desParties.keys(), ...desSoirees.keys()])) {
          const joues = new Set([...(desParties.get(profileId) ?? []), ...(desSoirees.get(profileId) ?? [])])
          const s = serieAvecSabliers(joues, desSabliers.get(profileId) ?? [], aujourdhui)
          if (s.serie > 0) series.push({ profileId, serie: s.serie, tenue: s.tenue })
        }
        series.sort((a, b) => b.serie - a.serie || a.profileId.localeCompare(b.profileId))
        return { series, sabliersDuMois: Number(duMois.rows[0]?.n ?? 0) }
      })
    const entree = { a: maintenant, jour: aujourdhui, lues }
    this.seriesGardees = entree
    // Un échec ne reste pas en mémoire : la page suivante relit la base.
    lues.catch(() => {
      if (this.seriesGardees === entree) this.seriesGardees = null
    })
    return lues
  }

  /** Combien de profils sont masqués du classement : le QG les compte à côté du classement du mois. */
  nombreDeMasques(): number {
    return this.masques.size
  }

  /** « Garder » : la question est juste, les signalements se referment. */
  async garder(jour: string, index: number) {
    await this.client.execute(this.refermerLes(jour, index, 'gardee'))
  }

  /**
   * L'écriture qui referme les signalements ouverts d'une question, en
   * disant ce qui en a été fait (`IssueDUnSignalement`) et, pour
   * l'historique, comment — « nouvelle bonne réponse : 1997 ». Dans le lot
   * du geste : à part, une panne entre les deux laissait la question
   * corrigée et toujours à relire. Le joueur dont la remarque a servi
   * l'apprend sur son accueil (`mercisDe`).
   */
  private refermerLes(jour: string, index: number, issue: IssueDUnSignalement, detail: string | null = null): InStatement {
    return {
      sql: 'UPDATE jour_signalements SET traite_le = ?, issue = ?, detail = ? WHERE jour = ? AND question = ? AND traite_le IS NULL',
      args: [this.maintenant(), issue, detail, jour, index],
    }
  }

  /**
   * « Corriger » une question du jour signalée (le choix du 14 octobre
   * 2026, « Même réponse : partout ; autre réponse : pour la suite ») : sa
   * version de la réserve — celle que ses prochains tirages poseront —,
   * relue comme une liste collée. La même bonne réponse, à la même place :
   * une faute, un leurre, une anecdote — le jour qui l'a posée la prend
   * aussi, sur l'écran de correction de chacun, ses réponses dans l'ordre de
   * ce jour-là, et ceux qui la jouent encore aujourd'hui la lisent corrigée ;
   * son temps de lecture ne bouge pas, une question en cours garde son
   * échéance. Une autre bonne réponse ne vaut que pour la suite : le jour
   * garde la sienne. Ses points s'annulent pour tous si on le demande
   * (`annuler`), tant qu'il court — une réponse fausse, ou une question
   * ambiguë qu'on précise : ses signalements refermés, la page ne la
   * montrerait plus pour le faire après. Ils se referment.
   */
  async corriger(
    jour: string,
    index: number,
    brut: unknown,
    { annuler = false }: { annuler?: boolean } = {},
  ): Promise<{ jourAussi: boolean; nouvelle: boolean; annulee: boolean }> {
    if (!jourValide(jour) || !Number.isInteger(index)) throw new Error('Question introuvable')
    const proposee = lireLaCorrection(brut)
    if (!proposee) throw new Error('Envoie l’intitulé, les réponses, l’index de la bonne et l’anecdote')
    if (proposee.reponses.length < MIN_ANSWERS || proposee.reponses.length > MAX_ANSWERS) throw new Error(`Une question du jour a de ${MIN_ANSWERS} à ${MAX_ANSWERS} réponses`)
    if (proposee.reponses.some(r => !r)) throw new Error('Une réponse est vide : écris-la, ou retire-la')
    if (new Set(proposee.reponses.map(r => empreinteDe(r))).size < proposee.reponses.length) throw new Error('Deux réponses disent la même chose')
    if (proposee.bonne < 0 || proposee.bonne >= proposee.reponses.length) throw new Error('Coche la bonne réponse')
    // Coupée en silence, une correction trop longue perdait sa fin : on le dit plutôt.
    const trop = (t: string, max: number) => tronquer(t, max) !== t
    if (trop(proposee.texte, MAX_TEXT) || proposee.reponses.some(r => trop(r, MAX_ANSWER_TEXT)) || (proposee.anecdote !== null && trop(proposee.anecdote, MAX_ANECDOTE))) {
      throw new Error(`Trop long : l’intitulé tient en ${MAX_TEXT} caractères, une réponse en ${MAX_ANSWER_TEXT}, l’anecdote en ${MAX_ANECDOTE}`)
    }
    const corrigee = await this.avecVerrou('#tirage', async () => {
      const tirage = await this.tirageLu(jour)
      const q = tirage?.questions[index]
      if (!tirage || !q) throw new Error('Question introuvable')
      const ligne = (await this.client.execute({ sql: 'SELECT question, empreinte, retiree_le FROM jour_reserve WHERE id = ?', args: [q.reserveId] })).rows[0]
      if (!ligne) throw new Error('Cette question n’est plus dans la réserve')
      if (ligne.retiree_le !== null) throw new Error('Cette question est retirée de la réserve : on ne la corrige plus')
      const def = JSON.parse(String(ligne.question)) as QuizQuestionDef
      const avant = lectureDe(def, q.reserveId)
      if (!avant) throw new Error('Cette question ne se joue plus : retire-la de la réserve')
      // Relue comme une liste collée — ses espaces, ce que le quiz du jour
      // sait jouer —, sous son identifiant de toujours.
      const nouvelle = { ...normalizeQuestions([{ ...def, text: proposee.texte, answers: proposee.reponses, correct: proposee.bonne, anecdote: proposee.anecdote }])[0], id: def.id }
      const raison = raisonDEcarter(nouvelle)
      const apres = lectureDe(nouvelle, q.reserveId)
      if (raison || !apres) throw new Error(`Correction refusée : ${raison ?? 'incomplète'}`)
      if (memeLecture(avant, apres)) throw new Error('Rien n’a changé : « Garder » referme ses signalements')
      const empreinte = empreinteDe(nouvelle.text)
      if (empreinte !== String(ligne.empreinte)) {
        const deja = await this.client.execute({ sql: 'SELECT 1 FROM jour_reserve WHERE empreinte = ? AND id <> ?', args: [empreinte, q.reserveId] })
        if (deja.rows.length > 0) throw new Error('Cet intitulé est déjà celui d’une autre question de la réserve')
        if (await this.dansLaCampagne?.(empreinte)) throw new Error('Cet intitulé est déjà dans la campagne')
      }
      const autreReponse = bonneReponseChange(avant, apres)
      const duJour = copieCorrigee(q, avant, apres)
      const annuleAussi = annuler && !tirage.annulees.includes(index)
      if (annuleAussi && (jour !== jourDe(this.maintenant()) || (await this.estClos(jour)))) {
        throw new Error('Ce jour est clos : on ne peut plus annuler ses points. Corrige-la sans annuler.')
      }
      const detail = detailDeLaCorrection(avant, apres) + (annuleAussi ? ' · ses points annulés pour tous' : '')
      const questions = duJour ? tirage.questions.map((x, i) => (i === index ? duJour : x)) : null
      await this.client.batch(
        [
          {
            sql: 'UPDATE jour_reserve SET question = ?, empreinte = ? WHERE id = ?',
            args: [JSON.stringify(nouvelle), empreinte, q.reserveId],
          },
          ...(questions ? [{ sql: 'UPDATE jour_tirages SET questions = ? WHERE jour = ?', args: [JSON.stringify(questions), jour] }] : []),
          this.refermerLes(jour, index, 'corrigee', detail),
        ],
        'write',
      )
      if (questions) {
        this.garderTirage({ ...tirage, questions })
        // Sa catégorie a pu changer avec elle : ce que chacun sait du quiz du jour se relit.
        this.tirageChange()
      }
      if (empreinte !== String(ligne.empreinte)) this.empreintesGardees = null
      return { jourAussi: !!questions, nouvelle: autreReponse, annulee: annuleAussi }
    })
    // Hors du verrou du tirage, que l'annulation reprend.
    if (corrigee.annulee) await this.annuler(jour, index)
    return corrigee
  }

  /**
   * « Reclasser » une question du jour signalée : sa catégorie — et, quand
   * la routine l'a déjà décrite, son sous-thème et sa difficulté estimée —,
   * pour ses prochains tirages. Le jour qui l'a posée garde la sienne : les
   * réponses déjà données comptent pour la catégorie de ce jour-là, et les
   * écussons de chacun ne bougent pas. Ses signalements se referment. Sous
   * le verrou du tirage, comme « Corriger » : les deux relisent puis
   * réécrivent la même question de la réserve, et l'un effaçait l'autre.
   */
  reclasser(jour: string, index: number, brut: unknown): Promise<{ avant: Classement; apres: Classement }> {
    return this.avecVerrou('#tirage', async () => {
      const tirage = jourValide(jour) && Number.isInteger(index) ? await this.tirageLu(jour) : null
      const q = tirage?.questions[index]
      if (!q) throw new Error('Question introuvable')
      const ligne = (await this.client.execute({ sql: 'SELECT question, categorie, metadonnees, retiree_le FROM jour_reserve WHERE id = ?', args: [q.reserveId] })).rows[0]
      if (!ligne) throw new Error('Cette question n’est plus dans la réserve')
      if (ligne.retiree_le !== null) throw new Error('Cette question est retirée de la réserve : on ne la reclasse plus')
      const meta = metadonneesDe(ligne.metadonnees)
      const lu = lireLeClassement(brut, { avecMeta: !!meta })
      if (typeof lu === 'string') throw new Error(lu)
      const categorie = ligne.categorie === null ? null : String(ligne.categorie)
      const avant: Classement = {
        categorie: categorie ?? '',
        sousTheme: meta && meta.categorie === categorie ? meta.sousTheme : null,
        difficulte: meta?.difficulte ?? null,
      }
      if (avant.categorie === lu.categorie && avant.sousTheme === lu.sousTheme && avant.difficulte === lu.difficulte) {
        throw new Error('Rien n’a changé : « Garder » referme ses signalements')
      }
      const def = JSON.parse(String(ligne.question)) as QuizQuestionDef
      await this.client.batch(
        [
          {
            sql: 'UPDATE jour_reserve SET categorie = ?, question = ?, metadonnees = COALESCE(?, metadonnees) WHERE id = ?',
            args: [
              lu.categorie,
              JSON.stringify({ ...def, category: lu.categorie }),
              meta ? JSON.stringify({ ...meta, categorie: lu.categorie, sousTheme: lu.sousTheme, difficulte: lu.difficulte }) : null,
              q.reserveId,
            ],
          },
          this.refermerLes(jour, index, 'reclassee', classementEcrit(lu)),
        ],
        'write',
      )
      return { avant, apres: lu }
    })
  }

  /**
   * Annule les points d'une question d'aujourd'hui, pour tous : ce qu'elle
   * avait rapporté repart, les médailles se comptent sur les questions qui
   * restent, et l'expérience de chacun suit. Après minuit, le jour est clos
   * — son podium est payé — : il ne se réécrit plus.
   */
  async annuler(jour: string, index: number): Promise<void> {
    if (jour !== jourDe(this.maintenant()) || (await this.estClos(jour))) {
      throw new Error('Ce jour est clos : on ne peut plus annuler ses points. Retire la question de la réserve.')
    }
    await this.avecVerrou('#tirage', async () => {
      const tirage = await this.tirageLu(jour)
      if (!tirage || !Number.isInteger(index) || index < 0 || index >= tirage.questions.length) throw new Error('Question introuvable')
      if (tirage.annulees.includes(index)) return
      const annulees = [...tirage.annulees, index].sort((a, b) => a - b)
      await this.client.batch([{ sql: 'UPDATE jour_tirages SET annulees = ? WHERE jour = ?', args: [JSON.stringify(annulees), jour] }, this.refermerLes(jour, index, 'annulee')], 'write')
      // Toujours sous le verrou du tirage : chaque recompte, sous celui de
      // son profil, lit l'annulation la plus récente — comme il la lisait
      // en base. Lui passer le tirage de cette annulation-ci laissait payée
      // la question d'une autre, annulée juste après.
      this.garderTirage({ ...tirage, annulees })
      // Ses bonnes réponses ne font plus grandir personne, ni ne comptent à son savoir ou à ses missions.
      this.oublierSesCompagnons(null)
      this.tirageChange()
    })
    // Chacun se recompte sous son propre verrou. Recompté d'un seul coup pour
    // tout le jour, une réponse partie avant l'annulation et écrite après
    // réécrivait ses points par-dessus : la question annulée restait payée.
    // Sous le verrou, elle passe d'abord, et le recompte la corrige. Déjà
    // annulée — un double clic, un essai après une panne à mi-chemin —, le
    // recompte se rejoue quand même : il ne change rien à qui l'a eu.
    const parties = await this.client.execute({ sql: 'SELECT profile_id FROM jour_parties WHERE jour = ?', args: [jour] })
    await parLots(parties.rows, PROFILS_EN_VOL, r => {
      const profileId = String(r.profile_id)
      return this.avecVerrou(profileId, () => this.recompter(profileId, jour))
    })
    this.reviser(jour)
  }

  /**
   * Ses points et ses bonnes réponses d'un jour, recomptés sans les questions
   * annulées — et, le jour où sa question passe, avec sa part, sur ce qui
   * compte encore : une autre annulée change sa moyenne, la sienne annulée la
   * lui retire, comme à tous. Son expérience suit. Sous son verrou : relus
   * puis réécrits, une réponse ne s'y glisse pas.
   */
  private async recompter(profileId: string, jour: string) {
    const tirage = await this.tirageLu(jour)
    if (!tirage) return
    const brut = await this.brutDe(profileId, jour, tirage)
    const sienne = sienneDans(tirage, profileId) >= 0
    const points = brut.points + (sienne ? partDeLAuteur(brut.points, autresQuestions(tirage)) : 0)
    const justes = brut.justes + (sienne ? partDeLAuteur(brut.justes, autresQuestions(tirage)) : 0)
    await this.client.execute({
      sql: 'UPDATE jour_parties SET points = ?, justes = ?, xp = ? WHERE profile_id = ? AND jour = ?',
      args: [points, justes, xpDuJour(points, possiblesDe(tirage)), profileId, jour],
    })
    await this.ecrireXp(profileId, jour)
  }

  /** Masque un profil du classement — ou l'y remet. Il n'en est pas averti. */
  async masquer(profileId: string, masque: boolean): Promise<void> {
    await this.client.execute(
      masque
        ? { sql: 'INSERT OR IGNORE INTO jour_masques (profile_id, masque_le) VALUES (?, ?)', args: [profileId, this.maintenant()] }
        : { sql: 'DELETE FROM jour_masques WHERE profile_id = ?', args: [profileId] },
    )
    // Les classements gardés n'ont pas à se relire : les masqués s'écartent
    // à chaque lecture (`joueursDu`), après la mémoire.
    if (masque) this.masques.add(profileId)
    else this.masques.delete(profileId)
    this.versionDesMasques++
    // Masqué, il ne s'annonce plus : son laurier tombe avec, et revient s'il
    // est rendu au classement le jour même.
    const hier = jourAvant(jourDe(this.maintenant()))
    if (this.lauriers.jour === hier) await this.lireLauriers(hier)
  }

  // ── Le laurier ──────────────────────────────────────────────────────────

  /**
   * Les vainqueurs d'hier — tous les ex æquo en tête, les masqués écartés :
   * un laurier suit leur prénom toute la journée, jusque dans les soirées où
   * ils jouent. Lus en mémoire, sans attendre : chaque diffusion à toute la
   * salle les demande.
   *
   * Rien ne tourne à minuit. Passé minuit, la liste d'avant-hier se tait
   * aussitôt, et la nuit se clôt en arrière-plan si personne n'est encore
   * revenu au quiz du jour : les lauriers se posent alors sur ceux d'hier,
   * et les salles où ils jouent se rediffusent (`laurierChange`).
   */
  laureats(): ReadonlySet<string> {
    const { aujourdhui, hier } = this.joursDeLHeure()
    if (this.lauriers.jour === hier) return this.lauriers.ids
    if (!this.lauriersEnRoute && !this.ferme) {
      this.lauriersEnRoute = this.clorePasses(aujourdhui)
        .catch(e => {
          if (!this.ferme) console.error('[jour] les lauriers d’hier n’ont pas pu se lire :', e)
        })
        .finally(() => {
          this.lauriersEnRoute = null
        })
    }
    return AUCUN_LAURIER
  }

  /**
   * Aujourd'hui et hier à Paris, gardés pour l'heure en cours : minuit à
   * Paris tombe toujours sur une heure pleine du temps universel (UTC+1 ou
   * UTC+2, changements d'heure compris), alors le jour ne change jamais au
   * milieu d'une heure. `laureats` le demande pour chaque profil de chaque
   * instantané, et `Intl` le recalculait à chaque fois — deux
   * millisecondes par instantané de cinq cents profils.
   */
  private joursDeLHeure(): { aujourdhui: string; hier: string } {
    const heure = Math.floor(this.maintenant() / HEURE_MS)
    if (this.joursGardes?.heure !== heure) {
      const aujourdhui = jourDe(heure * HEURE_MS)
      this.joursGardes = { heure, aujourdhui, hier: jourAvant(aujourdhui) }
    }
    return this.joursGardes
  }

  /**
   * Relit les vainqueurs d'un jour clos, et rediffuse la salle de ceux dont
   * le laurier change : ceux qui le gagnent, ceux qui le perdent — et ceux
   * qui l'avaient déjà, que la salle a pu voir sans lui depuis minuit.
   */
  private async lireLauriers(jour: string) {
    const res = await this.client.execute({ sql: 'SELECT profile_id FROM jour_podiums WHERE jour = ? AND rang = 1', args: [jour] })
    const ids = new Set(res.rows.map(r => String(r.profile_id)).filter(id => !this.masques.has(id)))
    const avant = this.lauriers
    this.lauriers = { jour, ids }
    const touches = new Set([...ids, ...avant.ids])
    for (const id of touches) if (avant.jour !== jour || avant.ids.has(id) !== ids.has(id)) this.laurierChange?.(id)
  }

  /** Les profils masqués, et ceux qu'une recherche trouve — pour l'administration. */
  async profilsPourLAdministration(cherche: string): Promise<{ id: string; login: string; nom: string; avatar: string; masque: boolean }[]> {
    const motif = `%${cherche.trim().toLowerCase().replace(/[%_]/g, '')}%`
    const res = await this.client.execute({
      sql: cherche.trim()
        ? `SELECT id, login, name, avatar FROM profiles WHERE disabled_at IS NULL AND (lower(name) LIKE ? OR login LIKE ?) ORDER BY name LIMIT 12`
        : `SELECT id, login, name, avatar FROM profiles WHERE id IN (SELECT profile_id FROM jour_masques) ORDER BY name LIMIT 50`,
      args: cherche.trim() ? [motif, motif] : [],
    })
    return res.rows.map(r => ({
      id: String(r.id),
      login: String(r.login),
      nom: String(r.name),
      // L'avatar enregistré, tel quel : l'administrateur cherche un profil,
      // il ne regarde pas la salle — un emoji de collection redescendu y
      // reste lisible, là où `avatarPorte` montrerait l'avatar par défaut.
      avatar: String(r.avatar),
      masque: this.masques.has(String(r.id)),
    }))
  }

  /**
   * Un profil supprimé (`/admin`, « Les profils ») : ses parties, ses
   * réponses, ses podiums, ses signalements et son masque partent avec lui,
   * sous son verrou — une réponse en route n'écrit pas derrière. Les
   * classements gardés de ses jours se relisent : son prénom y restait.
   * Ce que les autres ont gagné ces jours-là ne bouge pas — son podium ne
   * remonte personne.
   */
  async oublierProfil(profileId: string): Promise<void> {
    await this.avecVerrou(profileId, async () => {
      const jours = await this.client.execute({ sql: 'SELECT DISTINCT jour FROM jour_parties WHERE profile_id = ?', args: [profileId] })
      await this.client.batch(
        [
          ...['jour_reponses', 'jour_parties', 'jour_podiums', 'jour_coffres_du_mois', 'jour_signalements', 'jour_masques', 'jour_propositions'].map(table => ({
            sql: `DELETE FROM ${table} WHERE profile_id = ?`,
            args: [profileId],
          })),
          // Ses questions acceptées restent au quiz du jour, sans signature : on n'y lit plus qui les a écrites.
          { sql: 'UPDATE jour_reserve SET auteur = NULL WHERE auteur = ?', args: [profileId] },
          // Ni qui les a relues : un profil supprimé ne se garde nulle part — ni dans les questions bonus déjà tirées.
          { sql: 'UPDATE jour_reserve SET relecteur = NULL WHERE relecteur = ?', args: [profileId] },
          { sql: `UPDATE jour_bonus SET question = json_remove(question, '$.auteur') WHERE json_extract(question, '$.auteur') = ?`, args: [profileId] },
          { sql: `UPDATE jour_bonus SET question = json_remove(question, '$.relecteur') WHERE json_extract(question, '$.relecteur') = ?`, args: [profileId] },
        ],
        'write',
      )
      for (const r of jours.rows) this.reviser(String(r.jour))
      // Les questions bonus gardées en mémoire le nommaient peut-être : elles se relisent.
      this.tiragesGardes.clear()
      // Ses réponses comptaient dans ce que les jours clos ont recueilli, au QG : ils se relisent à la page suivante.
      this.recueilsClos = null
      this.masques.delete(profileId)
      this.versionDesMasques++
      this.oublierSesCompagnons(profileId)
      this.justesGardees.oublier(profileId)
      this.savoirsGardes.oublier(profileId)
      this.categoriesGardees.oublier(profileId)
      this.joursDeSerieGardes.oublier(profileId)
    })
  }

  // ── Interne ─────────────────────────────────────────────────────────────

  /** Une chose à la fois pour cette clé : un profil, le tirage, la nuit. */
  private avecVerrou<T>(cle: string, travail: () => Promise<T>): Promise<T> {
    const avant = this.verrous.get(cle) ?? Promise.resolve()
    const suite = avant.then(travail, travail)
    const fin = suite.catch(() => {})
    this.verrous.set(cle, fin)
    void fin.then(() => {
      if (this.verrous.get(cle) === fin) this.verrous.delete(cle)
    })
    return suite
  }
}

/** Une question jouable telle que le jour la fige : ses réponses dans l'ordre de la copie, son temps de lecture compté. */
function questionTiree(p: Extract<PlayableQuestion, { kind: 'choice' }>): QuestionTiree {
  return {
    reserveId: p.id ?? '',
    texte: p.text,
    reponses: p.answers,
    bonne: p.correct,
    categorie: p.category ?? null,
    duree: p.duration,
    lectureMs: tempsDeLecture(p),
    anecdote: p.anecdote ?? null,
  }
}

/** Les points possibles d'un jour : deux cents par question qui compte encore. */
function possiblesDe(tirage: Tirage): number {
  return POINTS_MAX_PAR_QUESTION * (tirage.questions.length - tirage.annulees.length)
}

/**
 * Sa propre question dans ce jour — une question du public qu'il a proposée
 * et qui compte encore —, ou -1 : la plupart des joueurs, la plupart des
 * jours. Annulée pour tous, elle ne lui rapporte rien non plus.
 */
function sienneDans(tirage: Tirage, profileId: string): number {
  const i = tirage.questions.findIndex(q => q.auteur === profileId)
  return i >= 0 && !tirage.annulees.includes(i) ? i : -1
}

/** Les questions qui comptent, la sienne mise à part : celles sur lesquelles se prend sa moyenne. */
function autresQuestions(tirage: Tirage): number {
  return tirage.questions.length - tirage.annulees.length - 1
}

/** Ce que le joueur lit d'une question de la réserve, ses réponses dans l'ordre écrit ; null : elle ne se joue pas. */
function lectureDe(def: QuizQuestionDef, id: string): VersionLue | null {
  const p = toPlayable({ ...def, id })
  return p && p.kind === 'choice' ? { texte: p.text, reponses: p.answers, bonne: p.correct, anecdote: p.anecdote ?? null } : null
}

/**
 * La copie d'un jour, corrigée : ses réponses dans l'ordre de ce jour-là,
 * chacune remplacée par la version corrigée de sa place dans la réserve ;
 * sa bonne à la même place, son temps de lecture tel quel. Null quand le
 * jour ne la prend pas (`corrigeAussiLeJour`) : on ne devine pas.
 */
function copieCorrigee(q: QuestionTiree, avant: VersionLue, apres: VersionLue): QuestionTiree | null {
  const places = placesDuJour(q, avant)
  if (!places || !corrigeAussiLeJour(q, avant, apres)) return null
  return { ...q, texte: apres.texte, reponses: places.map(p => apres.reponses[p]), anecdote: apres.anecdote }
}

/** Les métadonnées d'une question de la réserve, quand la routine l'a décrite ; null sans elles, ou hors de la base. */
function metadonneesDe(brut: unknown): MetadonneesDeQuestion | null {
  if (typeof brut !== 'string') return null
  try {
    const m = JSON.parse(brut) as Partial<MetadonneesDeQuestion> & { horsBase?: unknown }
    return m && typeof m === 'object' && !m.horsBase && typeof m.categorie === 'string' && typeof m.sousTheme === 'string' && Number.isInteger(m.difficulte)
      ? (m as MetadonneesDeQuestion)
      : null
  } catch {
    return null
  }
}

/**
 * Une question de la réserve telle que la page des signalements la montre :
 * celle que « Corriger » reprend, et son classement, que « Reclasser »
 * change — son sous-thème, s'il est de sa catégorie.
 */
function versionDeLaReserve(r: Record<string, unknown>): VersionDeLaReserve | null {
  let def: QuizQuestionDef
  try {
    def = JSON.parse(String(r.question)) as QuizQuestionDef
  } catch {
    return null
  }
  const lue = lectureDe(def, String(r.id))
  if (!lue) return null
  const categorie = r.categorie === null || r.categorie === undefined ? null : String(r.categorie)
  const meta = metadonneesDe(r.metadonnees)
  return {
    ...lue,
    reponses: [...lue.reponses],
    categorie,
    sousTheme: meta && meta.categorie === categorie ? meta.sousTheme : null,
    difficulte: meta?.difficulte ?? null,
    retiree: r.retiree_le !== null && r.retiree_le !== undefined,
  }
}

/**
 * Le prénom de chaque joueur, marque d'homonymie comprise (« Camille (2) ») :
 * posée dans l'ordre d'arrivée, comme en soirée, elle reste au second quel
 * que soit son rang. Tout prénom du quiz du jour passe par ici — le
 * classement, « à 70 pts de », le vainqueur d'hier (invariant 17).
 */
function nommer(joueurs: readonly Joueur[], profils: Pick<ProfileStore, 'avatarPorte' | 'legendairePorte'>): (j: Joueur) => string {
  const arrivee = [...joueurs].sort((a, b) => a.commenceeLe - b.commenceeLe || a.profil.id.localeCompare(b.profil.id))
  // L'avatar qu'on voit, pas celui qu'il a en base : deux Camille qu'un
  // emoji de collection redevenu trop haut laisse sous le même 🎉 se
  // distinguent comme les autres — et deux Camille sous le même Phénix,
  // quels que soient leurs emojis d'en dessous (`visageDe`).
  const marques = nomsAffiches(
    arrivee.map(j => ({ id: j.profil.id, name: j.profil.name, avatar: profils.avatarPorte(j.profil), legendaire: profils.legendairePorte(j.profil) })),
  )
  return j => marques.get(j.profil.id) ?? j.profil.name
}

/** Ses jours dans le premier quart, comptés jusqu'à une nuit close (`jusqua`), sous une version des masquages et des suspensions (`JourStore.elitesGardees`). */
interface EliteGardee {
  version: string
  jusqua: string
  n: number
}

/** Une ligne de `jour_parties`, telle que la partie se lit — null s'il n'y en a pas. */
/**
 * Ce que ses paliers du quiz du jour comptent (`statsDuJour`) : seules, ou
 * dans le lot qui commence sa partie. Le premier quart se lit sur les jours
 * clos — la nuit fige le classement —, les masqués écartés, à huit joueurs
 * au moins (`SALLE_DU_JOUR`) : le rang de chacun est celui du classement,
 * rang partagé (invariant 15) ; seulement ceux d'après `depuis`, qu'il n'a
 * pas encore comptés, et la dernière nuit close, jusqu'où il les a comptés
 * (`EliteGardee`). La série lit ses jours joués, ses soirées et ses sabliers
 * (`serieAvecSabliers`).
 */
function lecturesDesStats(profileId: string, depuis = ''): InStatement[] {
  return [
    { sql: 'SELECT COUNT(*) AS n FROM jour_parties WHERE profile_id = ?', args: [profileId] },
    { sql: 'SELECT COUNT(*) AS n FROM jour_podiums WHERE profile_id = ? AND rang = 1', args: [profileId] },
    {
      sql: `SELECT COUNT(*) AS n FROM jour_parties p JOIN jour_tirages t ON t.jour = p.jour
            WHERE p.profile_id = ? AND p.finie_le IS NOT NULL
              AND json_array_length(t.questions) > json_array_length(t.annulees)
              AND p.justes >= json_array_length(t.questions) - json_array_length(t.annulees)`,
      args: [profileId],
    },
    {
      sql: `SELECT COUNT(*) AS n FROM (
              SELECT p.profile_id AS id, p.points,
                     RANK() OVER (PARTITION BY p.jour ORDER BY p.points DESC) AS rang,
                     COUNT(*) OVER (PARTITION BY p.jour) AS joueurs
              FROM jour_parties p
              JOIN jour_clotures c ON c.jour = p.jour
              JOIN profiles pr ON pr.id = p.profile_id AND pr.disabled_at IS NULL
              WHERE p.jour IN (SELECT jour FROM jour_parties WHERE profile_id = ? AND jour > ?)
                AND p.profile_id NOT IN (SELECT profile_id FROM jour_masques)
            ) WHERE id = ? AND joueurs >= ? AND points > 0 AND rang * 4 <= joueurs`,
      args: [profileId, depuis, profileId, SALLE_DU_JOUR],
    },
    { sql: 'SELECT MAX(jour) AS jour FROM jour_clotures', args: [] },
    // Ses questions du public jouées (La Plume), sans celles annulées pour tous : par l'index de ses propositions, puis la réserve à sa clé.
    {
      sql: `SELECT COUNT(*) AS n FROM jour_propositions p JOIN jour_reserve r ON r.id = p.reserve_id
            WHERE p.profile_id = ? AND ${JOUEE_ET_COMPTEE}`,
      args: [profileId],
    },
    ...lecturesDeLaSerie(profileId),
  ]
}

/** Ce que sa série lit : ses jours de quiz du jour, ses soirées, ses sabliers. */
/** L'instant d'un jour (`AAAA-MM-JJ`), à minuit UTC : ce que `lecturesDeLaSerie` compare aux `created_at`. */
const instantDuJour = (jour: string | undefined) => (jour ? Date.UTC(Number(jour.slice(0, 4)), Number(jour.slice(5, 7)) - 1, Number(jour.slice(8, 10))) : 0)

function lecturesDeLaSerie(profileId: string, depuis?: string): InStatement[] {
  const apres = instantDuJour(depuis)
  return [
    { sql: 'SELECT jour FROM jour_parties WHERE profile_id = ? AND jour >= ?', args: [profileId, depuis ?? ''] },
    { sql: `SELECT created_at FROM profile_xp WHERE profile_id = ? AND ${HORS_LIGNES_A_PART} AND created_at >= ?`, args: [profileId, apres] },
    { sql: 'SELECT created_at FROM profile_sabliers WHERE profile_id = ? AND created_at >= ?', args: [profileId, apres] },
  ]
}

/** Ce qui compte une série, gardé par profil (`joursDeSerieGardes`) : ses jours joués — au quiz du jour ou en soirée — et ceux de ses sabliers. */
interface JoursDeLaSerie {
  joues: readonly string[]
  sabliers: readonly string[]
}

/**
 * Les trois lectures de `lecturesDeLaSerie` en une seule instruction, chaque
 * ligne marquée de ce qu'elle est : une lecture gardée n'en tient qu'une.
 */
function lectureDeLaSerie(profileId: string, depuis: string): InStatement {
  const apres = instantDuJour(depuis)
  return {
    sql: `SELECT 'partie' AS sorte, jour AS quand FROM jour_parties WHERE profile_id = ? AND jour >= ?
          UNION ALL SELECT 'soiree', created_at FROM profile_xp WHERE profile_id = ? AND ${HORS_LIGNES_A_PART} AND created_at >= ?
          UNION ALL SELECT 'sablier', created_at FROM profile_sabliers WHERE profile_id = ? AND created_at >= ?`,
    args: [profileId, depuis, profileId, apres, profileId, apres],
  }
}

/** Ce que `lectureDeLaSerie` rend, rangé comme `serieLue` le lit. */
function joursDeLaSerie(lignes: readonly Row[]): JoursDeLaSerie {
  const joues: string[] = []
  const sabliers: string[] = []
  for (const r of lignes) {
    if (r.sorte === 'partie') joues.push(String(r.quand))
    else if (r.sorte === 'soiree') joues.push(jourDe(Number(r.quand)))
    else sabliers.push(jourDe(Number(r.quand)))
  }
  return { joues, sabliers }
}

/** Sa série, ses sabliers comptés, de ce que `lecturesDeLaSerie` a lu. */
function serieLue([jours, soirees, sabliers]: readonly ResultSet[], aujourdhui: string): SerieDuJour {
  const joues = new Set<string>([...jours.rows.map(r => String(r.jour)), ...soirees.rows.map(r => jourDe(Number(r.created_at)))])
  return serieAvecSabliers(
    joues,
    sabliers.rows.map(r => jourDe(Number(r.created_at))),
    aujourdhui,
  )
}

/** La série que chaque jour joué tenait, de ce que `lecturesDeLaSerie` a lu : le bonus de série de chaque partie. */
function seriesLues([jours, soirees, sabliers]: readonly ResultSet[]): Map<string, number> {
  const joues = new Set<string>([...jours.rows.map(r => String(r.jour)), ...soirees.rows.map(r => jourDe(Number(r.created_at)))])
  return seriesParJour(
    joues,
    sabliers.rows.map(r => jourDe(Number(r.created_at))),
  )
}

/** Les lectures de `lecturesDesStats` qui précèdent celles de sa série. */
const LECTURES_AVANT_LA_SERIE = 6

/** Ses paliers du quiz du jour, de ce que `lecturesDesStats` a lu ; ses jours dans l'élite ajoutés à ceux qu'il avait comptés (`garde`), et jusqu'où ils le sont désormais. */
function statsDe(lus: readonly ResultSet[], aujourdhui: string, garde: EliteGardee): { stats: StatsDuJour; elite: EliteGardee } {
  const [joues, victoires, sansFautes, elite, nuit, questions] = lus
  const comptee = { version: garde.version, jusqua: nuit.rows[0]?.jour == null ? garde.jusqua : String(nuit.rows[0].jour), n: garde.n + Number(elite.rows[0]?.n ?? 0) }
  return {
    stats: {
      joues: Number(joues.rows[0]?.n ?? 0),
      victoires: Number(victoires.rows[0]?.n ?? 0),
      sansFautes: Number(sansFautes.rows[0]?.n ?? 0),
      elite: comptee.n,
      serieRecord: serieLue(lus.slice(LECTURES_AVANT_LA_SERIE), aujourdhui).record,
      questions: Number(questions.rows[0]?.n ?? 0),
    },
    elite: comptee,
  }
}

function lirePartie(profileId: string, jour: string, r: Record<string, unknown> | undefined): Partie | null {
  if (!r) return null
  const vote = Number(r.bonus_vote ?? 0)
  return {
    profileId,
    jour,
    commenceeLe: Number(r.commencee_le),
    question: Number(r.question),
    servieLe: r.servie_le == null ? null : Number(r.servie_le),
    points: Number(r.points),
    justes: Number(r.justes),
    finieLe: r.finie_le == null ? null : Number(r.finie_le),
    xp: Number(r.xp),
    xpSerie: Number(r.xp_serie ?? 0),
    bonusServieLe: r.bonus_servie_le == null ? null : Number(r.bonus_servie_le),
    bonusLe: r.bonus_le == null ? null : Number(r.bonus_le),
    bonusChoix: r.bonus_choix == null ? null : Number(r.bonus_choix),
    bonusJuste: Number(r.bonus_juste ?? 0) === 1,
    xpBonus: Number(r.xp_bonus ?? 0),
    bonusVote: vote === 1 || vote === -1 ? vote : null,
  }
}

/** `travail` sur chaque élément, `n` à la fois ; les résultats dans l'ordre des éléments. */
async function parLots<T, R>(elements: readonly T[], n: number, travail: (e: T) => Promise<R>): Promise<R[]> {
  const resultats: R[] = []
  for (let i = 0; i < elements.length; i += n) resultats.push(...(await Promise.all(elements.slice(i, i + n).map(travail))))
  return resultats
}

/** La question telle que le téléphone la reçoit : ni sa bonne réponse, ni son anecdote. */
function questionVue(tirage: Tirage, index: number, servieLe: number): QuestionDuJour {
  const q = tirage.questions[index]
  return {
    jour: tirage.jour,
    index,
    total: tirage.questions.length,
    texte: q.texte,
    reponses: q.reponses,
    categorie: q.categorie,
    duree: q.duree,
    echeance: servieLe + q.duree * 1000,
  }
}

function lireNombres(brut: unknown): number[] {
  try {
    const x = JSON.parse(String(brut))
    return Array.isArray(x) ? x.filter((n): n is number => Number.isInteger(n)) : []
  } catch {
    return []
  }
}

function lireTextes(brut: unknown): string[] {
  try {
    const x = JSON.parse(String(brut))
    return Array.isArray(x) ? x.map(String) : []
  } catch {
    return []
  }
}

function lireListe(brut: unknown): { texte: string; raison: string }[] {
  try {
    const x = JSON.parse(String(brut))
    return Array.isArray(x) ? x.filter(e => e && typeof e.texte === 'string' && typeof e.raison === 'string') : []
  } catch {
    return []
  }
}
