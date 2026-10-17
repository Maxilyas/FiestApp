import { randomBytes, randomUUID } from 'node:crypto'
import type { InStatement, ResultSet } from '@libsql/client'
import { ajouterColonne, clientDistant, type Client } from './distante'
import { BaseDeLaCampagne, entreeDeLaBase, lireQuestionDeLaBase, type QuestionDeLaBase } from './baseCampagne'
import {
  DEPOT_MAX,
  PLAFOND_PAR_CATEGORIE_ET_PAR_JOUR,
  QUESTIONS_PAR_CATEGORIE_ET_PAR_JOUR,
  commandeDeLaCategorie,
  consigneCommune,
  empreintesDesLivres,
  partDeLaCategorie,
} from './consigneCampagne'
import { IndexDesFaits, indexSansBloquer, motifDuMemeFait } from './memeFait'
import { DejaPrises } from './jumelles'
import {
  CHANCES_PAR_TRANCHE,
  ajusterSansBloquer,
  chanceDeLEpreuve,
  chanceSurLaMarche,
  chancesSurLaSerie,
  difficulteSansModele,
  forceDuJoueur,
  forcePourLeNiveau,
  indiceDeCategorie,
  scoreAttendu,
  scoreDeReference,
  serieDeReference,
  type ForceDUnJoueur,
  type ModeleDuSavoir,
  type SerieDeReference,
} from './modeleDuSavoir'
import { jourAvant, jourDe, minutesAvantMinuit, type PalierTombe } from '../../../shared/jour'
import { hautFait, palierDe, titreDePalier } from '../../../shared/hautsfaits'
import { CHANCE_ECLAT_DU_DEFI, type AnnonceDeLAdministrateur, type StatsDeCampagne } from '../../../shared/profil'
import {
  ISSUES_QUI_SERVENT,
  QUESTION_DU_MERCI,
  RELUS_MONTRES,
  SIGNALEMENTS_MONTRES_AU_QG,
  classementEcrit,
  detailDeLaCorrection,
  lireIssue,
  lireLaCorrection,
  lireLeClassement,
  memeLecture,
  type Classement,
  type IssueDUnSignalement,
  type SignalementRelu,
} from '../../../shared/qgSignalements'
import { extrait } from './journalDesGestes'
import { cleDeSerie, cleDuDefi, type ProfileRec, type ProfileStore } from '../auth/profiles'
import { classer, rangPartage } from '../../../shared/classement'
import { nomsAffiches, sansAccent } from '../../../shared/homonymes'
import { tronquer } from '../../../shared/avatars'
import { CATEGORIES } from '../../../shared/categories'
import { savoirDesLignes, type Savoir } from '../../../shared/ecussons'
import { BRANCHES, branche as brancheParCle, deLaBranche, type CleDeBranche, type Paliers } from '../../../shared/branches'
import { SOUS_THEMES } from '../../../shared/etiquettes'
import { chapitreDuPalier } from '../../../shared/chapitres'
import { SUJETS, sujetParCle, sujetsDe } from '../../../shared/sujets'
import type { BaseDuQuizToutPret } from '../../../shared/quizToutPret'
import {
  AUTOMATE,
  COTE_DE_DEPART,
  DUELS_DE_L_HISTOIRE,
  DUELS_PAR_SUITE,
  FACE_A_FACE_MONTRES,
  JOUEURS_A_PORTEE,
  JOUEURS_CROISES,
  JOUEURS_TROUVES,
  JOURS_DE_L_HISTOIRE,
  JOURS_DU_CLASSEMENT,
  LETTRES_POUR_CHERCHER,
  LIGNES_DU_CLASSEMENT,
  LIGUES,
  SCORE_DE_REFERENCE,
  bilanDesDuels,
  bordurePortee,
  confettisDesLigues,
  enjeuContre,
  enjeuDuDe,
  ligueDe,
  ligueDeLaSemaine,
  niveauPourLeDuel,
  pageDeLHistoire,
  recompenseDeLaSemaine,
  releverLesDuels,
  type BilanDesDuels,
  type ClassementDesDuels,
  type CleDeLigue,
  type CoteApresLeDuel,
  type Croisement,
  type DuelContre,
  type DuelDeLHistoire,
  type DuelJoue,
  type DuelOuvert,
  type DuelRaconte,
  type DuelsDAccueil,
  type EnjeuDuDuel,
  type EtatDesDuels,
  type FaceAFace,
  type JoueurADefier,
  type JoueurCroise,
  type LigneDesDuels,
  type OuEnEstLeDuel,
  type PageDHistoire,
  type QuiAffronte,
  type ReleveDesDuels,
  type SemaineDesDuels,
  type BordureDeLigue,
} from '../../../shared/duels'
import { divin } from '../../../shared/divins'
import {
  AJOUTS_MONTRES,
  AMIS_MONTRES,
  DEFIS_RECUS_MONTRES,
  DUELS_OUVERTS_MAX,
  DUREE_D_UN_DUEL_MS,
  LETTRES_D_UN_CODE,
  LONGUEUR_D_UN_CODE,
  lireCodeDuDuel,
  type AmiDeCampagne,
  type AmisDeLaFeuille,
  type SonApparence,
  type DefiRecu,
  type DuelEntreAmis,
  type MesAmis,
  type ResumeDuDuel,
  NIVEAUX,
  QUESTIONS_PAR_MARCHE,
  QUESTIONS_PAR_SERIE,
  JOUEURS_POUR_LE_DEFI,
  QUESTIONS_POUR_JOUER,
  RECORD_DU_TOUR_DU_MONDE,
  SIGNALEMENT_MAX,
  VIES,
  CONTREDITES_MONTREES,
  bonneReponseChange,
  familleDeQuestion,
  formeDeReponse,
  issueDeRencontre,
  marcheContredite,
  mesuresEnFamille,
  minutesAvantLundi,
  niveauDeQuestion,
  semaineAvant,
  semaineDe,
  ordreDeSerie,
  xpDeCampagne,
  xpDeLaBonneReponse,
  xpDuJourDeCampagne,
  type AdminDeLaCampagne,
  type Adversaire,
  type AdversaireEnJeu,
  type AjoutsDeLaRoutine,
  type CoupDeLaRencontre,
  type MesRencontres,
  type RencontreDeCampagne,
  type ResumeDeRencontre,
  type CommandeDeLaBase,
  type DepotDeLaBase,
  type CorrectionDeCampagne,
  type CorrectionDeQuestion,
  type ChoixDeLaCampagne,
  type DefiDeLaSemaine,
  type EtatDeCampagne,
  type FinDeSerie,
  type LigneDuDefi,
  type MesureDUneQuestion,
  type Niveau,
  type QuestionCorrigee,
  type QuestionDeCampagne,
  type RapportDeSignalement,
  type ReponseDeCampagne,
  type SerieDeCampagne,
  type SignalementDeCampagne,
} from '../../../shared/campagne'
import {
  JOURS_DE_SA_PROGRESSION,
  PALIERS,
  PALIER_DU_MAITRE,
  PREMIERES_REPONSES_POUR_SA_CHANCE,
  PRIX_D_UNE_VIE,
  REPONSES_DE_SA_PROGRESSION,
  QUESTIONS_PAR_EPREUVE,
  SANS_VRAI_FAUX_DES,
  VIES_PAR_JOUR,
  confettisDeLaNouvelleNote,
  confettisDesEtoiles,
  couleurDePiste,
  epreuveFinie,
  etoilesDe,
  issueDe,
  melangePropre,
  memeMelange,
  refusDuMelange,
  regleDuPalier,
  sentierQuOnAvance,
  statsDesSentiers,
  titreDeMaitre,
  viesDe,
  xpDuPalier,
  type AdminDesSentiers,
  type ChanceDuSentier,
  type Melange,
  type MelangesRegles,
  type DefiDAccueil,
  type EpreuveDeSentier,
  type EtatDesSentiers,
  type FinDEpreuve,
  type IssueDEpreuve,
  type JoueurBloque,
  type RegleDuPalier,
  type ReponseDEpreuve,
  type SentierDuJoueur,
  type SentiersDAccueil,
  type StatsDuPalier,
  type VieDesSentiers,
} from '../../../shared/sentiers'
import {
  PALIERS_DES_SUJETS,
  QUESTIONS_POUR_UN_SENTIER_DE_SUJET,
  SEUIL_D_UN_SUJET,
  epreuveDeSujetFinie,
  etoilesDuSujet,
  issueDuSujet,
  regleDuPalierDeSujet,
  type EpreuveDeSujet,
  type EtatDesSujets,
  type ReponseDuSujet,
  type SentierDeSujet,
} from '../../../shared/sentiersDeSujets'
import { JOURS_DU_QG, jourDeLInstant, joursDesMinuits, minuitsDeParis } from '../../../shared/qg'
import { DUELS_EN_ATTENTE_MONTRES, LIGNES_DU_CLASSEMENT_AU_QG, joueursParLigue, type JoueurDuDuel, type SuiviDesDuels } from '../../../shared/qgDuels'
import { etoilesDansLeTemps, liguesDansLeTemps, type EpreuveValidee, type Mouvement } from '../../../shared/qgEconomie'
import type { JournauxDesJours } from '../../../shared/missions'
import {
  PARCOURS_AU_QG,
  lesPlusRatees,
  viesAcheteesParJour,
  viesPerduesParJour,
  type DefiAuQg,
  type ParcoursAuQg,
  type SuiviDeLaCampagne,
  type ViesAuQg,
} from '../../../shared/qgCampagne'
import {
  INTERVALLES_DE_REVISION,
  QUESTIONS_PAR_REVISION,
  suiteDeLaRevision,
  suiviDeLaQuestion,
  type EnAvance,
  type EtatDuCarnet,
  type FaitAppris,
  type PartDuCarnet,
  type SuiviDeRevision,
} from '../../../shared/revision'
import {
  ACTES,
  GARDIEN,
  MARCHES_DES_ACTES,
  aUneQuestion,
  carteDUnActe,
  chanceDuJoueurMoyen,
  chanceSelonLaForme,
  escalesPermises,
  gardiensDe,
  graineDe,
  marcheDe,
  numeroDeLaCarte,
  pliDeLExpedition,
  questionsDuGardien,
  type ApresUnGeste,
  type CarteDUnActe,
  type DepartDExpedition,
  type EscaleDeLaCarte,
  type EtatDeLExpedition,
  type GesteDExpedition,
  type PageDeLExpedition,
  type ReponseDExpedition,
  type ThemeDEscale,
  type VueDeLExpedition,
} from '../../../shared/expedition'
import { cleDeLExpedition } from '../../../shared/legendaires'

/** Une question de la série, telle que le serveur la garde : la bonne réponse avec. */
interface QuestionDeSerie {
  /**
   * Son identifiant dans la base de la campagne (`baseCampagne.ts`). Une
   * série d'avant la base (le 3 octobre 2026) gardait celui de la réserve du
   * quiz du jour, sous le nom `reserveId` : `versSerie` le relit.
   */
  id: string
  texte: string
  reponses: string[]
  bonne: number
  categorie: string | null
  anecdote: string | null
  niveau: Niveau
  /** Son sous-thème : une série d'avant les sentiers ne le gardait pas. */
  sousTheme?: string
  /**
   * Une révision : ses rendez-vous réussis quand elle l'a tirée — de quoi dire
   * après chaque réponse où en est la question sans relire tout le journal.
   * Le carnet, lui, se relit toujours dans le journal (`suiviDeLaQuestion`).
   */
  etape?: number
  /** Une révision de tout le carnet : la question reprise en avance — pas encore à son rendez-vous, ou déjà apprise. */
  enAvance?: EnAvance
  /** Une expédition : l'escale et l'acte où elle a été tirée — le pli range chaque réponse à sa place (`pliDeLExpedition`). */
  escale?: string
  acte?: number
  /**
   * Une source de l'expédition l'a reprise du carnet : comme une révision,
   * sa réponse a été lue — ni la mesure, ni les écussons, ni L'Érudit ne la
   * comptent (`HORS_DU_CARNET`). Le carnet, lui, la compte.
   */
  carnet?: true
}

/**
 * Une réponse `r` de la série `s` qui n'est pas une question reprise du
 * carnet par une source de l'expédition (`QuestionDeSerie.carnet`) : sa bonne
 * réponse avait été lue, comme en révision.
 */
const HORS_DU_CARNET = "json_extract(s.questions, '$[' || r.position || '].carnet') IS NULL"

/**
 * Une série de la campagne, ou une épreuve des sentiers (`mode`) : les mêmes
 * tables, le même journal de réponses — l'expérience, les confettis, la
 * mesure des difficultés et « jamais vues d'abord » les comptent ensemble,
 * sans rien savoir des sentiers.
 */
interface Serie {
  id: string
  profileId: string
  questions: QuestionDeSerie[]
  index: number
  vies: number
  justes: number
  finieLe: number | null
  /**
   * Une révision du carnet (`shared/revision.ts`) n'a pas de vies : ses
   * erreurs remettent la question au lendemain, rien de plus. Une rencontre
   * rejoue la série finie d'un autre joueur, contre son score. Une épreuve
   * d'un sentier à thème (`sujet`) monte un sujet en six paliers, sans vies.
   */
  mode: 'serie' | 'sentier' | 'defi' | 'duel' | 'revision' | 'rencontre' | 'sujet' | 'expedition'
  /** L'épreuve d'un sentier : sa branche, son palier, son seuil figé au départ — un seuil réglé ensuite ne change pas une épreuve en cours. */
  branche: CleDeBranche | null
  palier: number | null
  seuil: number | null
  rejeu: boolean
  issue: IssueDEpreuve | null
  /**
   * Une épreuve en jeu : la chance de la valider que la page des sentiers lui
   * annonçait à son départ (`chanceAuDepart`) — Contre toute attente la relit
   * à sa fin. Null sans annonce : un rejeu, moins de vingt premières
   * réponses, le modèle du savoir pas encore ajusté, une épreuve d'avant.
   */
  chance?: number | null
  /** Les catégories qu'elle a choisies ; null : toutes (`categoriesRetenues`). */
  categories?: string[] | null
  /** Le sujet qu'elle suit à travers les catégories (`shared/sujets.ts`) ; ses catégories sont alors null. */
  sujet?: string | null
  /** Un défi de la semaine : le lundi de sa semaine, qui le clôt. */
  semaine?: string | null
  /** Un défi entre amis : son code (`campagne_duels`). */
  duel?: string | null
  /** Une rencontre : qui elle affronte (`AdversaireGarde`). */
  adversaire?: AdversaireGarde | null
  /** Une expédition : son départ — sa graine, ses gardiens, ses trois cartes (`DepartDExpedition`). */
  expedition?: DepartDExpedition | null
}

/**
 * L'adversaire d'une rencontre, tel qu'elle le garde : sa série, son profil,
 * et ses réponses dans l'ordre — recopiées au départ : un profil supprimé
 * emporte ses séries, la rencontre garde ce qu'il avait fait. Automate
 * depuis le 13 octobre 2026 (`simule`) ; avant, la série finie d'un autre
 * joueur, que les rencontres d'alors gardent et montrent.
 */
interface AdversaireGarde {
  serie: string
  profil: string
  reponses: boolean[]
  /**
   * Automate, l'adversaire simulé (`partieDAutomate`) : ni série ni profil —
   * `serie` est celle de la rencontre, `profil` vide —, ses réponses tirées
   * au départ et gardées comme celles d'un joueur.
   */
  simule?: true
}

/** Un défi entre amis, tel que sa table le garde : son tirage figé, ce qu'il fait jouer, quand il ferme. */
interface Duel {
  code: string
  auteur: string
  questions: QuestionDeSerie[]
  categories: string[] | null
  sujet: string | null
  creeLe: number
  fermeLe: number
  /** Quand sa fermeture a figé les tentatives laissées en route ; null : pas encore. */
  closLe: number | null
  /** Un duel classé : qui a été défié, et les deux cotes au lancement ; null : un défi entre amis d'avant, amical. */
  adversaire: string | null
  coteAuteur: number | null
  coteAdversaire: number | null
  /** Quand qui l'a lancé a vu son résultat, joué des deux côtés ; null : pas encore — l'accueil le compte. */
  vuLe: number | null
}

/** La difficulté mesurée se relit au plus toutes les dix minutes : elle bouge lentement, et chaque série la lit. */
const MESURES_GARDEES_MS = 10 * 60_000
/**
 * Lue dans ses deux dernières minutes, elle se relit en fond (`mesures`) :
 * la requête qui l'aurait trouvée périmée — un tirage, un dé — attendait
 * l'aller-retour de toute la mesure et son calcul, 1,2 à 1,4 s au dixième
 * de cœur de l'hébergeur (le banc du 16 octobre 2026).
 */
const MESURE_EN_AVANCE_MS = 2 * 60_000
/**
 * Le modèle du savoir se refait au plus toutes les demi-heures, et seulement
 * quand un dé le demande : il relit les réponses de tout le monde, et ses
 * difficultés bougent lentement — la force de qui lance le dé, elle, se
 * relit à chaque dé.
 */
const MODELE_GARDE_MS = 30 * 60_000
/** Un ajustement raté ne se retente pas avant une minute : une base muette ne se fait pas relire à chaque dé. */
const MODELE_RETENTE_MS = 60_000
/** Combien de séries en cours restent en mémoire (`enCours`) : celles qu'on joue, et de la marge pour celles qu'on a laissées. */
const SERIES_GARDEES = 500
const HEURE_MS = 3600_000
/** Les séries de la campagne, sans les épreuves des sentiers : une ligne d'avant les sentiers n'a pas de mode. */
const SERIES = "COALESCE(mode, 'serie') = 'serie'"
/** Ce que l'administration relit des épreuves : trois mois suffisent à régler un palier. */
const STATS_DES_SENTIERS_MS = 90 * 24 * HEURE_MS
/** Les plus bloqués que l'administration nomme : de quoi voir qui décroche, pas un annuaire. */
const BLOQUES_MONTRES = 10
/**
 * Les trente jours des parcours et des vies, au QG, se gardent dix minutes :
 * la page de la campagne se rouvre à chaque passage, et chaque relecture de
 * trente jours compte au quota de Turso — comme les séries du quiz du jour.
 */
const TRENTE_JOURS_GARDES_MS = 10 * 60_000
/**
 * Une épreuve ratée coûte sa vie au jour de sa fin, mais se cherche par le
 * jour où elle a commencé (`idx_campagne_series_commencee`) : une semaine de
 * marge couvre celle laissée en route puis reprise.
 */
const MARGE_D_UNE_EPREUVE_MS = 7 * 24 * HEURE_MS
/** Ce qu'un classement du défi montre ; au-delà, sa propre ligne à part — comme au quiz du jour. */
const LIGNES_DU_DEFI = 50
/**
 * Ses duels qu'on lui rappelle, les plus récents : ses défis entre amis — de
 * quoi retrouver un lien perdu —, ses derniers duels joués, ses résultats à
 * voir. Jamais ce qui l'attend encore : la page montre tous ceux en route.
 */
const DUELS_MONTRES = 10
/** Ce que le carnet redonne de ce qu'il a appris : les plus récents, de quoi relire sans tout charger. */
const FAITS_MONTRES = 100
/** Ses rencontres qu'on lui rappelle : les plus récentes. */
const RENCONTRES_MONTREES = 10
/** Les cotes du classement des duels se relisent au plus toutes les dix minutes, et à chaque duel fini ici. */
const COTES_GARDEES_MS = 10 * 60_000
/** Les bordures demandées à quelques millisecondes d'écart se lisent ensemble : une vague d'arrivées, une requête. */
const BORDURES_GROUPEES_MS = 30
const AUCUN_VAINQUEUR: ReadonlySet<string> = new Set()
/** La réserve du quiz du jour d'une campagne qui n'en a pas : un banc, un script. */
const AUCUNE_EMPREINTE: ReadonlySet<string> = new Set()
/** Ce qu'on lit de chaque source des joueurs croisés : de quoi en garder assez une fois ses amis et les masqués écartés. */
const CANDIDATS_PAR_SOURCE = 12
/** Au défi de la semaine, ses derniers venus, parmi lesquels on cherche ceux de son score. */
const CANDIDATS_DU_DEFI = 50
/** La part de chaque source parmi les joueurs croisés, avant que la place qui reste aille au plus proche : six soirées ne cachent pas un adversaire. */
const CROISES_PAR_SOURCE: Record<Croisement, number> = { soiree: 3, duel: 2, defi: 2, niveau: JOUEURS_CROISES }
/** Du plus proche au plus lointain : l'ordre où ils se montrent. */
const ORDRE_DES_CROISEMENTS: readonly Croisement[] = ['soiree', 'duel', 'defi', 'niveau']

/** Les deux sens de sa liste d'amis, lus d'un aller-retour (`cercleDe`). */
interface CercleDAmis {
  /** Ses amis, les plus récents d'abord (`AMIS_MONTRES` au plus). */
  amis: string[]
  estAmi: (id: string) => boolean
  /** Ami l'un de l'autre : chacun a l'autre dans sa liste. */
  reciproque: (id: string) => boolean
  /** Retiré de sa liste — jusqu'à ce qu'il le rajoute, ou qu'ils jouent de nouveau un défi ensemble. */
  aRetire: (id: string) => boolean
  /** Ceux qui l'ont ajouté sans qu'il les ait ajoutés, ni retirés (`AJOUTS_MONTRES` au plus). */
  tOntAjoute: string[]
}

/**
 * La campagne solo (`shared/campagne.ts`) : ses séries, dans la base
 * permanente comme le quiz du jour — une série reprise demain sur un autre
 * téléphone retrouve sa question. Toute la règle est ici : le téléphone ne
 * reçoit jamais la bonne réponse avant d'avoir répondu (invariant 1), et
 * c'est le serveur qui compte les vies.
 *
 * Ses questions viennent de sa base à elle (`baseCampagne.ts`), jamais de
 * la réserve du quiz du jour, dont elle écarte même les intitulés
 * (`empreintesDuJour`). Une question jamais vue d'un joueur passe devant
 * celles qu'il a déjà vues, et parmi elles la plus anciennement vue
 * (`parFraicheur`). Sa difficulté part de l'estimation de l'écriture
 * et se corrige par les réponses de campagne (`niveauDeQuestion`).
 * Une bonne réponse y rapporte l'expérience d'une bonne réponse en soirée,
 * sans plafond (`xpDeCampagne`), dans sa ligne à part (`LIGNE_CAMPAGNE`) ;
 * et un confetti, comme au quiz du jour (`duProfil`).
 */
/**
 * Ce que la campagne demande aux profils pour décerner ses récompenses —
 * ses hauts faits de série, ses paliers, et les légendaires qu'ils ouvrent :
 * le profil tient l'étagère (`ProfileStore`), la campagne sait ce qui s'est
 * joué. Sans lui (un test qui n'en a pas besoin), elle ne décerne rien.
 */
export interface RecompensesDeCampagne {
  ranger(profileId: string, sous: string, cles: readonly string[], quand?: number): Promise<string[]>
  /** Ce qu'il a déjà sur son étagère, et combien de fois (`ProfileStore.recompensesOf`). */
  recompensesOf(profileId: string): ReadonlyMap<string, number>
  accorderPaliersDeCampagne(profileId: string, sous: string, stats: StatsDeCampagne): Promise<string[]>
  legendairesOuverts(profileId: string, tombes: readonly string[]): string[]
  tirerUnEclat(profileId: string, sous: string, chance: number): Promise<{ avatar: string; paliers: string[] } | null>
  /** Les légendaires qu'il a (`ProfileStore.legendairesOf`) : l'expédition tire ses gardiens parmi les autres. */
  legendairesOf?(profileId: string): string[]
}

/** Sa ligue, sa cote et ses bordures de ligue (`coteDe`) : sa carte, la bordure qu'il choisit. */
export interface CoteDesDuels {
  ligue: CleDeLigue
  cote: number
  bordures: BordureDeLigue[]
}

/** Ce que la campagne dit d'un profil à son solde et à sa page, d'une seule lecture (`CampagneStore.duProfil`). */
export interface CampagneDuProfil {
  /** Ses confettis de campagne : ses bonnes réponses, les étoiles de ses sentiers, les ligues de ses semaines closes. */
  confettis: number
  /** Ses paliers validés, sentier par sentier (`paliersDe`). */
  paliers: Paliers
  /** Null tant qu'il n'a fini aucun duel classé (`coteDe`). */
  duels: CoteDesDuels | null
}

/** Ce qu'une fin de série ou d'épreuve annonce : ce qui est tombé, et les légendaires que ça ouvre. */
interface Recompenses {
  recompenses?: PalierTombe[]
  legendaires?: string[]
}

/** Ce que la fin d'un défi annonce en plus : l'Éclat, s'il est tombé. */
interface RecompensesDuDefi extends Recompenses {
  eclat?: string
}

export class CampagneStore {
  private client: Client
  /** L'étagère des profils (`RecompensesDeCampagne`), branchée par le serveur. */
  private recompenses: RecompensesDeCampagne | null
  private maintenant: () => number
  private verrous = new Map<string, Promise<unknown>>()
  /** La base du dépôt, lue à la première demande sans figer le serveur (`BaseDeLaCampagne.depuisLeDossier`) ; les tests en donnent une petite. */
  private fichiers: () => Promise<BaseDeLaCampagne>
  /**
   * Ce que la routine du matin a déposé (`campagne_ajouts`) : lu au
   * démarrage, tenu à jour à chaque dépôt. La base qu'on joue, c'est le
   * dépôt et ceux-là ensemble (`base`) — sans déploiement : une question
   * déposée à 7 h se joue à 7 h.
   */
  private ajouts: { question: QuestionDeLaBase; ajouteeLe: number }[] = []
  /**
   * Les corrections de l'administrateur (`campagne_corrections`), sous
   * l'identifiant de la question corrigée : sa version corrigée — sous le
   * même identifiant, ou sous un neuf quand la bonne réponse a changé
   * (`bonneReponseChange`). Lues au démarrage, appliquées à la base qu'on
   * joue (`base`) ; peu nombreuses, gardées en mémoire.
   */
  private corrections = new Map<string, { question: QuestionDeLaBase; corrigeeLe: number }>()
  /** Monte à chaque correction : la base fusionnée se refait. */
  private versionDesCorrections = 0
  /** Le dépôt, les ajouts et les corrections ensemble, refaits quand l'un d'eux change. */
  private fusion: { fichiers: BaseDeLaCampagne; ajouts: number; corrections: number; base: BaseDeLaCampagne } | null = null
  /** Les intitulés des quiz livrés, lus au premier dépôt : la base ne les reprend pas. */
  private livres: Set<string> | null = null
  /**
   * Les faits de la base (`core/memeFait.ts`), pour écarter un dépôt qui en
   * pose un qu'elle a déjà sous un autre intitulé : bâtis au premier dépôt
   * sans figer le serveur, puis tenus à jour de ce qui entre. Une correction
   * ne les refait pas : la version d'avant y reste, et n'écarte qu'un fait
   * de plus.
   */
  private faits: Promise<IndexDesFaits<QuestionDeLaBase>> | null = null
  /** Les intitulés de la réserve du quiz du jour (`JourStore.empreintes`) : la campagne n'en pose aucun. */
  private empreintesDuJour: () => Promise<ReadonlySet<string>>
  /** Écrit sa ligne d'expérience (`ProfileStore.ecrireXpDeCampagne`). */
  private ecrireXp: (profileId: string, xp: number, jours: number) => Promise<unknown>
  /** Les questions retirées après un signalement : la campagne ne les tire plus. Peu nombreuses, gardées en mémoire. */
  private retirees = new Set<string>()
  /**
   * La série en cours de chaque profil : relue en base à chaque réponse,
   * elle coûtait un aller-retour sous les doigts du joueur. Tenue à jour
   * sous son verrou, après chaque écriture réussie ; oubliée au moindre
   * échec — écrite ou non, on ne le sait pas, et la base fait alors foi.
   */
  private enCours = new Map<string, Serie>()
  /**
   * La rencontre que le dé a promise à chaque profil sans pouvoir l'écrire
   * (`commencerUneRencontre` répond avant l'écriture) : sa première réponse
   * dit quoi faire, au lieu de « introuvable ». Oubliée au dé suivant.
   */
  private rencontresPerdues = new Map<string, string>()
  /** Les questions du défi de chaque semaine jouée depuis le démarrage : figées en base, relues une fois. */
  private tirages = new Map<string, QuestionDeSerie[]>()
  /**
   * Les mélanges réglés depuis le QG (`sentier_melanges`), en mémoire : chaque
   * épreuve qui commence les lit, et chaque page des sentiers les montre. Peu
   * nombreux — un par palier au plus —, lus au démarrage, tenus à jour à
   * chaque réglage.
   */
  private melanges = new Map<number, { melange: Melange; regleLe: number }>()
  /** Les défis entre amis lus depuis le démarrage : leur tirage et leur fermeture sont figés, relus une fois. */
  private duels = new Map<string, Duel>()
  /** Le score fini de qui a lancé un duel classé, par code : celui qu'il a défié le joue pour le battre (`scoreABattre`). */
  private scoresABattre = new Map<string, number>()
  /** Les vainqueurs du défi de la semaine passée (`vainqueursDuDefi`), lus à sa clôture. */
  private argent: { semaine: string; ids: ReadonlySet<string> } = { semaine: '', ids: AUCUN_VAINQUEUR }
  private argentEnRoute: Promise<void> | null = null
  /**
   * Les duels classés de tout le monde, relus pour le classement
   * (`classementDesDuels`) : une lecture de toutes les rencontres finies,
   * gardée jusqu'au prochain duel fini ici — ou dix minutes au plus, le temps
   * que les quatre semaines du classement glissent.
   */
  private cotes: { lu: number; parProfil: Promise<Map<string, ReleveDesDuels>> } | null = null
  /**
   * Les bordures de ligue déjà relues, pour la salle et les classements
   * (`borduresEnMemoire`) : l'instantané les lit à chaque diffusion, et ni
   * lui ni un classement n'attendent la base. Toutes se lisent une fois en
   * fond après le démarrage (`prechauffer`) ; puis retenues à chaque
   * relecture de duels — d'un joueur ou de tous —, et relues en fond quand
   * un profil inconnu se montre (`connaitreLesBordures`) ; celles qu'on
   * relit encore, ou qui viennent d'échouer, ne se redemandent pas.
   */
  private bordures = new Map<string, readonly BordureDeLigue[]>()
  /**
   * Le tour de la lecture qui a retenu chacune : une lecture partie avant
   * une plus récente — le classement relu pendant qu'il finissait un duel —
   * ne l'écrase pas avec ce qu'elle avait lu d'avant.
   */
  private tourDesBordures = 0
  private bordureDuTour = new Map<string, number>()
  /**
   * Toutes lues d'un coup (`toutesLesCotes`) : un profil encore inconnu n'a
   * alors aucun duel classé, et sa bordure n'a plus rien à relire — son
   * premier duel la retiendra.
   */
  private borduresChaudes = false
  private borduresEnRoute = new Set<string>()
  /** Celles qu'on lira à la prochaine requête groupée (`lireLesBorduresAttendues`). */
  private borduresAttendues = new Set<string>()
  private lectureDesBordures: ReturnType<typeof setTimeout> | null = null
  /** Sa bordure vient d'arriver ou de gagner un cran : la salle où il joue se rediffuse (branché au démarrage). */
  bordureChange?: (profileId: string) => void
  /** La semaine dont toutes les précédentes sont closes : `cloreLesDefis` ne relit rien d'autre jusqu'au lundi suivant. */
  private closAvant: string | null = null
  private semaineGardee: { heure: number; semaine: string; passee: string } | null = null
  /** Les trente jours des parcours et des vies au QG, gardés dix minutes (`TRENTE_JOURS_GARDES_MS`). */
  private trenteJoursGardes: { minuit: number; jusqua: number; lus: Promise<Pick<SuiviDeLaCampagne, 'parcours' | 'vies'>> } | null = null
  /** Les duels classés lancés sur trente jours, au QG : gardés de même. */
  private lancesGardes: { minuit: number; jusqua: number; lus: Promise<Pick<SuiviDesDuels, 'lances' | 'jouesDesDeuxCotes'>> } | null = null
  private ferme = false
  /**
   * Les profils, pour nommer le classement du défi et ses vainqueurs
   * (`ProfileStore`) ; les masqués du quiz du jour, qu'il écarte aussi ; et
   * de quoi rediffuser la salle d'un laurier d'argent qui change de tête.
   * Branchés au démarrage, comme les vies achetées.
   */
  profils?: Pick<ProfileStore, 'byIds' | 'avatarPorte' | 'legendairePorte' | 'apparenceDe'> &
    Partial<Pick<ProfileStore, 'chercher' | 'enLigne' | 'compagnonsDeSoiree' | 'bordureDe' | 'cached' | 'compagnonPorte' | 'faireGrandir'>>
  masque?: (profileId: string) => boolean
  laurierChange?: (profileId: string) => void
  /**
   * La mesure des difficultés : les comptes du journal, relus au plus toutes
   * les dix minutes (`brutes`, et `premieres` pour les familles), et ce que
   * les familles en font pour la base d'où elle a été tirée (`parQuestion`,
   * refait quand la base change).
   */
  private mesuresGardees: {
    a: number
    brutes: Map<string, { justes: number; total: number }>
    premieres: Map<string, { justes: number; total: number }>
    base: BaseDeLaCampagne | null
    parQuestion: ReadonlyMap<string, MesureDUneQuestion>
    /** Sa suivante est partie en fond (`MESURE_EN_AVANCE_MS`) : une fois, même ratée — une base muette ne se fait pas relire à chaque requête. */
    relueEnFond?: boolean
  } | null = null
  /** La relecture des comptes en cours (`mesures`). */
  private mesuresEnRoute: Promise<void> | null = null
  /** La famille de chaque question, par base (`famillesDe`). */
  private famillesGardees = new WeakMap<BaseDeLaCampagne, readonly { id: string; difficulte: number; famille: string | null }[]>()
  /**
   * Le modèle du savoir (`core/modeleDuSavoir.ts`) : les difficultés de la
   * base et la force de chacun, ajustées ensemble sur les premières réponses
   * de tous. Refait en fond, à la demande du dé, au plus toutes les
   * demi-heures (`MODELE_GARDE_MS`) — jamais sur son chemin : le dé lit celui
   * qu'il y a, et avant le premier, la part de ceux qui ont trouvé chaque
   * question (`difficulteSansModele`).
   */
  private savoir: { a: number; modele: ModeleDuSavoir; dureeMs: number } | null = null
  private savoirEnRoute: Promise<void> | null = null
  private savoirRateLe = Number.NEGATIVE_INFINITY
  /** La série de référence du dé, refaite quand les jouables, leur mesure ou le modèle changent : onze mille questions à ranger. */
  private referenceGardee: {
    jouables: readonly QuestionDeLaBase[]
    mesure: ReadonlyMap<string, MesureDUneQuestion>
    modele: ModeleDuSavoir | null
    reference: SerieDeReference
  } | null = null
  /** Les questions jouables, toutes catégories, et ce dont elles sont faites : la base, la réserve du jour, les retraits (`jouables`). */
  private jouablesGardees: { base: BaseDeLaCampagne; duJour: ReadonlySet<string>; retirees: number; questions: readonly QuestionDeLaBase[] } | null = null
  /** Les catégories et les sujets de chaque liste de jouables (`choixDe`). */
  private choixGardes = new WeakMap<readonly QuestionDeLaBase[], ChoixDeLaCampagne>()
  /** Combien chaque sujet compte de questions, par liste de jouables (`sujetsComptes`). */
  private comptesDesSujets = new WeakMap<readonly QuestionDeLaBase[], ReadonlyMap<string, number>>()
  /** Les jouables de chaque sujet, par liste de jouables (`duSujet`). */
  private listesDesSujets = new WeakMap<readonly QuestionDeLaBase[], Map<string, readonly QuestionDeLaBase[]>>()
  /** Ce que le tirage d'une série relit de chaque liste de jouables, à sa mesure (`tirage`). */
  private preparations = new WeakMap<readonly QuestionDeLaBase[], PreparationDuTirage>()

  constructor(
    url: string,
    authToken?: string,
    opts: {
      maintenant?: () => number
      base?: BaseDeLaCampagne | (() => BaseDeLaCampagne)
      empreintesDuJour?: () => Promise<ReadonlySet<string>>
      ecrireXp?: (profileId: string, xp: number, jours: number) => Promise<unknown>
      recompenses?: RecompensesDeCampagne
    } = {},
  ) {
    this.client = clientDistant(url, authToken)
    this.recompenses = opts.recompenses ?? null
    this.maintenant = opts.maintenant ?? Date.now
    const donnee = opts.base
    let lue: Promise<BaseDeLaCampagne> | null = null
    this.fichiers =
      donnee instanceof BaseDeLaCampagne
        ? async () => donnee
        : () =>
            (lue ??= (donnee ? (async () => donnee())() : BaseDeLaCampagne.depuisLeDossier()).catch(e => {
              // Ratée, elle se relit à la demande suivante : gardée, la promesse la figerait.
              lue = null
              throw e
            }))
    // Toujours le même ensemble vide : un neuf à chaque lecture refaisait les jouables, et tout ce qui s'en tire, à chaque demande.
    this.empreintesDuJour = opts.empreintesDuJour ?? (async () => AUCUNE_EMPREINTE)
    this.ecrireXp = opts.ecrireXp ?? (async () => {})
  }

  /**
   * La base qu'on joue : celle du dépôt, ce que la routine y a ajouté, et ce
   * que l'administrateur y a corrigé (`appliquerLesCorrections`). Refaite
   * seulement quand l'un d'eux change — une série la lit à chaque fois. Un
   * ajout que le dépôt aurait rangé depuis (même identifiant, même intitulé)
   * n'y entre pas deux fois.
   */
  private async base(): Promise<BaseDeLaCampagne> {
    const fichiers = await this.fichiers()
    if (this.ajouts.length === 0 && this.corrections.size === 0) return fichiers
    const f = this.fusion
    if (f && f.fichiers === fichiers && f.ajouts === this.ajouts.length && f.corrections === this.versionDesCorrections) return f.base
    const ids = new Set(fichiers.parId.keys())
    const enPlus = this.ajouts.map(a => a.question).filter(q => !ids.has(q.id) && !fichiers.empreintes.has(q.empreinte))
    const base = new BaseDeLaCampagne(appliquerLesCorrections([...fichiers.questions, ...enPlus], this.corrections))
    this.fusion = { fichiers, ajouts: this.ajouts.length, corrections: this.versionDesCorrections, base }
    return base
  }

  /**
   * Ses bonnes réponses de campagne, jour par jour (Paris) : de quoi relire
   * toute sa ligne d'expérience, et dire ce qu'aujourd'hui a rapporté. Relues
   * en entier à chaque fois : un total tenu à côté se serait perdu au premier
   * hoquet de la base, quand celui-ci se refait à la bonne réponse suivante.
   */
  private async justesParJour(profileId: string): Promise<Map<string, number>> {
    return justesParJourDe((await this.client.execute(lectureDesJustes(profileId))).rows)
  }

  async init() {
    const resultats = await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS campagne_series (
           id           TEXT PRIMARY KEY,
           profile_id   TEXT NOT NULL,
           questions    TEXT NOT NULL,
           position     INTEGER NOT NULL,
           vies         INTEGER NOT NULL,
           justes       INTEGER NOT NULL DEFAULT 0,
           commencee_le INTEGER NOT NULL,
           finie_le     INTEGER
         )`,
        'CREATE INDEX IF NOT EXISTS idx_campagne_series_profil ON campagne_series(profile_id, commencee_le)',
        // Le QG relit les séries de tout le monde depuis minuit, toutes les cinq minutes : sans index, la table entière.
        'CREATE INDEX IF NOT EXISTS idx_campagne_series_commencee ON campagne_series(commencee_le)',
        // reserve_id : l'identifiant de la question dans la base de la
        // campagne — dans la réserve du quiz du jour, pour une réponse
        // d'avant la base. Le nom est resté.
        `CREATE TABLE IF NOT EXISTS campagne_reponses (
           serie_id    TEXT NOT NULL,
           position    INTEGER NOT NULL,
           reserve_id  TEXT NOT NULL,
           choix       INTEGER,
           juste       INTEGER NOT NULL,
           repondue_le INTEGER NOT NULL,
           PRIMARY KEY (serie_id, position)
         )`,
        // Un signalement par joueur et par question : le renvoyer remplace le précédent.
        `CREATE TABLE IF NOT EXISTS campagne_signalements (
           question_id TEXT NOT NULL,
           profile_id  TEXT NOT NULL,
           serie_id    TEXT NOT NULL,
           texte       TEXT NOT NULL,
           cree_le     INTEGER NOT NULL,
           traite_le   INTEGER,
           PRIMARY KEY (question_id, profile_id)
         )`,
        // Ses signalements relus ce dernier mois, que chaque accueil relit pour
        // le remercier (`mercisDe`) : sans index, la table entière à chaque visite.
        'CREATE INDEX IF NOT EXISTS idx_campagne_signalements_profil ON campagne_signalements(profile_id, traite_le)',
        `CREATE TABLE IF NOT EXISTS campagne_retraits (
           question_id TEXT PRIMARY KEY,
           retiree_le  INTEGER NOT NULL
         )`,
        // Ce que la routine du matin dépose : une entrée de la base par ligne,
        // dans la forme des fichiers du dépôt (`entreeDeLaBase`).
        `CREATE TABLE IF NOT EXISTS campagne_ajouts (
           id          TEXT PRIMARY KEY,
           categorie   TEXT NOT NULL,
           entree      TEXT NOT NULL,
           ajoutee_le  INTEGER NOT NULL
         )`,
        // Ce que l'administrateur corrige d'une question signalée : sa version
        // corrigée, dans la forme des fichiers du dépôt — sous le même
        // identifiant, ou sous un neuf quand la bonne réponse a changé.
        `CREATE TABLE IF NOT EXISTS campagne_corrections (
           question_id TEXT PRIMARY KEY,
           entree      TEXT NOT NULL,
           corrigee_le INTEGER NOT NULL
         )`,
        // Les mélanges que l'administrateur a réglés depuis le QG, palier par
        // palier, pour les douze sentiers : ceux du code ailleurs (`PALIERS`).
        `CREATE TABLE IF NOT EXISTS sentier_melanges (
           palier   INTEGER PRIMARY KEY,
           melange  TEXT NOT NULL,
           regle_le INTEGER NOT NULL
         )`,
        // Dans le même aller-retour : un réveil de l'hébergeur n'en paie pas un de plus.
        'SELECT question_id FROM campagne_retraits',
        'SELECT entree, ajoutee_le FROM campagne_ajouts ORDER BY ajoutee_le',
        'SELECT question_id, entree, corrigee_le FROM campagne_corrections',
        'SELECT palier, melange, regle_le FROM sentier_melanges',
      ],
      'write',
    )
    const [retraits, ajouts, corrections, melanges] = resultats.slice(-4)
    for (const r of retraits.rows) this.retirees.add(String(r.question_id))
    // Un mélange que les règles du jour refusent — une marche de plus, un palier de moins — se tait : le palier reprend celui du code.
    for (const r of melanges.rows) {
      const palier = Number(r.palier)
      const m = lireMelange(r.melange)
      if (m && refusDuMelange(palier, m) === null) this.melanges.set(palier, { melange: melangePropre(m), regleLe: Number(r.regle_le) })
      else console.warn(`[campagne] le mélange réglé du palier ${palier} n’est plus valable : le palier reprend celui du code`)
    }
    // Relues par le juge du jour : une règle durcie depuis les écarte, comme une ligne du dépôt.
    let illisibles = 0
    for (const r of ajouts.rows) {
      const lu = relireUneEntree(r.entree)
      if ('refus' in lu) illisibles++
      else this.ajouts.push({ question: lu.question, ajouteeLe: Number(r.ajoutee_le) })
    }
    if (illisibles > 0) console.warn(`[campagne] ${illisibles} question(s) déposée(s) par la routine écartée(s) : le juge de la base ne les accepte plus`)
    illisibles = 0
    for (const r of corrections.rows) {
      const lu = relireUneEntree(r.entree)
      if ('refus' in lu) illisibles++
      else this.corrections.set(String(r.question_id), { question: lu.question, corrigeeLe: Number(r.corrigee_le) })
    }
    if (illisibles > 0) console.warn(`[campagne] ${illisibles} correction(s) de l’administration écartée(s) : le juge de la base ne les accepte plus`)
    // Les épreuves des sentiers vivent dans les mêmes tables que les séries :
    // de quoi les reconnaître, et ce qu'elles visaient. Le schéma se lit une
    // fois par table (`ajouterColonne`) ; une base muette arrête le démarrage.
    for (const [colonne, type] of [
      ['mode', "TEXT NOT NULL DEFAULT 'serie'"],
      ['branche', 'TEXT'],
      ['palier', 'INTEGER'],
      ['seuil', 'INTEGER'],
      ['rejeu', 'INTEGER NOT NULL DEFAULT 0'],
      ['issue', 'TEXT'],
      // Les catégories qu'une série a choisies, en JSON — NULL : toutes. Le
      // Tour du monde et les records par catégorie lisent les séries d'une
      // seule ; la Grande Série, celles de toutes.
      ['categories', 'TEXT'],
      // Le sujet d'une série qui traverse les catégories (`shared/sujets.ts`) :
      // ses catégories restent NULL, mais elle n'est pas une série de toutes.
      ['sujet', 'TEXT'],
      // Un défi de la semaine : le lundi de sa semaine.
      ['semaine', 'TEXT'],
      // Un défi entre amis : son code (`campagne_duels`).
      ['duel', 'TEXT'],
      // Une rencontre : son adversaire, en JSON (`AdversaireGarde`).
      ['adversaire', 'TEXT'],
      // Une épreuve en jeu : la chance que la page lui annonçait à son départ
      // (`chanceAuDepart`). Ce qu'elle dit au joueur ne se reconstruit pas
      // après coup : le modèle se refait, ses réponses changent sa force.
      ['chance', 'REAL'],
    ] as const) {
      await ajouterColonne(this.client, 'campagne_series', colonne, type)
    }
    await this.client.batch(
      [
        'CREATE INDEX IF NOT EXISTS idx_campagne_series_sentiers ON campagne_series(profile_id, mode, branche, palier)',
        // Les paliers que chacun tenait de ses portraits d'avant les sentiers
        // (`core/repriseDesPortraits.ts`) : écrits une fois, jamais repris.
        `CREATE TABLE IF NOT EXISTS sentier_acquis (
           profile_id TEXT NOT NULL,
           branche    TEXT NOT NULL,
           paliers    INTEGER NOT NULL,
           retenu_le  INTEGER NOT NULL,
           PRIMARY KEY (profile_id, branche)
         )`,
        `CREATE TABLE IF NOT EXISTS campagne_meta (
           cle    TEXT PRIMARY KEY,
           valeur TEXT NOT NULL
         )`,
        // Le défi de chaque semaine : ses questions, tirées au premier qui
        // l'ouvre et figées — la même série pour tous —, et sa clôture, qui
        // range ses vainqueurs.
        `CREATE TABLE IF NOT EXISTS campagne_defis (
           semaine    TEXT PRIMARY KEY,
           questions  TEXT NOT NULL,
           tire_le    INTEGER NOT NULL,
           clos_le    INTEGER,
           vainqueurs TEXT
         )`,
        'CREATE INDEX IF NOT EXISTS idx_campagne_series_defi ON campagne_series(mode, semaine)',
        // Les défis entre amis : un tirage figé sous un code, que son lien
        // donne à qui le reçoit ; une semaine pour le relever.
        `CREATE TABLE IF NOT EXISTS campagne_duels (
           code       TEXT PRIMARY KEY,
           auteur     TEXT NOT NULL,
           questions  TEXT NOT NULL,
           categories TEXT,
           sujet      TEXT,
           cree_le    INTEGER NOT NULL,
           ferme_le   INTEGER NOT NULL,
           clos_le    INTEGER
         )`,
        'CREATE INDEX IF NOT EXISTS idx_campagne_duels_auteur ON campagne_duels(auteur, ferme_le)',
        // Les duels de tous par leur date, au QG — lancés sur trente jours, en attente, fermés sans réponse : sans index, la table entière.
        'CREATE INDEX IF NOT EXISTS idx_campagne_duels_cree ON campagne_duels(cree_le)',
        'CREATE INDEX IF NOT EXISTS idx_campagne_series_duel ON campagne_series(mode, duel)',
        // Un défi envoyé à un ami : il l'attend sous son onglet du défi, sans lien à faire suivre.
        `CREATE TABLE IF NOT EXISTS campagne_envois (
           code       TEXT NOT NULL,
           profile_id TEXT NOT NULL,
           envoye_le  INTEGER NOT NULL,
           PRIMARY KEY (code, profile_id)
         )`,
        'CREATE INDEX IF NOT EXISTS idx_campagne_envois_profil ON campagne_envois(profile_id, envoye_le)',
        // Les amis choisis au lancement : il leur part à la dernière réponse
        // de celui qui l'a lancé — son score à battre avec lui.
        `CREATE TABLE IF NOT EXISTS campagne_envois_prevus (
           code       TEXT NOT NULL,
           profile_id TEXT NOT NULL,
           PRIMARY KEY (code, profile_id)
         )`,
        // Un ami retiré de sa liste — jusqu'à ce qu'ils jouent de nouveau ensemble.
        `CREATE TABLE IF NOT EXISTS campagne_amis_retires (
           profile_id TEXT NOT NULL,
           ami        TEXT NOT NULL,
           retire_le  INTEGER NOT NULL,
           PRIMARY KEY (profile_id, ami)
         )`,
        // Un ami ajouté à la main — trouvé par son prénom : sa liste à lui,
        // sans demande ni attente.
        `CREATE TABLE IF NOT EXISTS campagne_amis_ajoutes (
           profile_id TEXT NOT NULL,
           ami        TEXT NOT NULL,
           ajoute_le  INTEGER NOT NULL,
           PRIMARY KEY (profile_id, ami)
         )`,
        // Et lues dans l'autre sens — qui l'a ajouté, qui l'a retiré —, à
        // chaque ouverture de la feuille des amis et de la carte d'un ami
        // (`cercleDe`) : sans index, la table entière.
        'CREATE INDEX IF NOT EXISTS idx_campagne_amis_ajoutes_ami ON campagne_amis_ajoutes(ami)',
        'CREATE INDEX IF NOT EXISTS idx_campagne_amis_retires_ami ON campagne_amis_retires(ami)',
      ],
      'write',
    )
    // Un duel classé contre quelqu'un (`shared/duels.ts`) : qui a été défié,
    // et les deux cotes au lancement — chacun bouge contre celle de l'autre.
    // Puis quand qui l'a lancé a vu son résultat : joué le second, l'autre le
    // voit à sa dernière réponse ; lui l'apprenait au hasard d'une liste.
    // Puis, avec la montée (le 14 octobre 2026), leurs deux cotes cachées au
    // lancement : la cote cachée de chacun bouge contre celle de l'autre.
    for (const [colonne, type] of [
      ['adversaire', 'TEXT'],
      ['cote_auteur', 'INTEGER'],
      ['cote_adversaire', 'INTEGER'],
      ['vu_le', 'INTEGER'],
      ['cote_cachee_auteur', 'INTEGER'],
      ['cote_cachee_adversaire', 'INTEGER'],
    ] as const) {
      await ajouterColonne(this.client, 'campagne_duels', colonne, type)
    }
    await this.client.execute('CREATE INDEX IF NOT EXISTS idx_campagne_duels_adversaire ON campagne_duels(adversaire, ferme_le)')
    // Le compagnon porté à chaque réponse (`compagnonsDe`), venu le 13
    // octobre 2026 : ses bonnes réponses le font grandir.
    await ajouterColonne(this.client, 'campagne_reponses', 'compagnon', 'TEXT')
    // Ce qu'un geste du QG a fait d'une question signalée, et comment
    // (`IssueDUnSignalement`), venus le 14 octobre 2026 avec la page des
    // signalements : son historique les relit, et le joueur dont la remarque
    // a servi l'apprend sur son accueil. Relus avant, ils n'en ont pas.
    await ajouterColonne(this.client, 'campagne_signalements', 'issue', 'TEXT')
    await ajouterColonne(this.client, 'campagne_signalements', 'detail', 'TEXT')
    // L'Expédition (le 17 octobre 2026) : une partie d'un autre mode, son
    // départ en JSON — sa graine, ses gardiens, ses trois cartes, gardées
    // telles quelles (`DepartDExpedition`) —, et le journal de ses gestes, dont
    // son état se replie (`pliDeLExpedition`) : rien ne s'écrit à côté.
    await ajouterColonne(this.client, 'campagne_series', 'expedition', 'TEXT')
    await this.client.execute(
      `CREATE TABLE IF NOT EXISTS expedition_gestes (
         serie_id TEXT NOT NULL,
         rang     INTEGER NOT NULL,
         geste    TEXT NOT NULL,
         fait_le  INTEGER NOT NULL,
         PRIMARY KEY (serie_id, rang)
       )`,
    )
  }

  /** Le compagnon qu'il porte (`loup`), que la ligne de sa réponse retient ; null sans compagnon. */
  private compagnonPorte(profileId: string): string | null {
    const p = this.profils?.cached?.(profileId)
    return p && this.profils?.compagnonPorte ? this.profils.compagnonPorte(p) : null
  }

  /**
   * Son compagnon grandit à la fin d'une partie — série, épreuve, parcours —,
   * jamais pendant une question (`ProfileStore.faireGrandir`). Une base qui
   * hoquette le laisse grandir à la lecture suivante : la partie, elle, est finie.
   */
  private async faireGrandir(profileId: string): Promise<void> {
    await this.profils?.faireGrandir?.(profileId).catch(e => console.error('[campagne] compagnon :', e))
  }

  /** Un geste à la fois par profil : deux onglets qui répondent ensemble ne comptent pas deux fois. */
  private avecVerrou<T>(cle: string, travail: () => Promise<T>): Promise<T> {
    const avant = this.verrous.get(cle) ?? Promise.resolve()
    const suite = avant.then(travail, travail)
    const garde = suite.catch(() => {})
    this.verrous.set(cle, garde)
    void garde.then(() => {
      if (this.verrous.get(cle) === garde) this.verrous.delete(cle)
    })
    return suite
  }

  /**
   * Un geste qui répond avant d'avoir tout écrit : la réponse part dès
   * qu'elle est prête, mais le verrou du profil tient jusqu'à ce que
   * l'écriture aboutisse — le geste d'après l'attend, et ne trouve jamais une
   * série à moitié commencée. `ecriture` ne rejette pas : elle range
   * elle-même son échec.
   */
  private avecVerrouJusquALEcriture<T>(cle: string, travail: () => Promise<{ reponse: T; ecriture?: Promise<void> }>): Promise<T> {
    return new Promise<T>((rendre, refuser) => {
      void this.avecVerrou(cle, async () => {
        try {
          const { reponse, ecriture } = await travail()
          rendre(reponse)
          await ecriture
        } catch (e) {
          refuser(e)
        }
      })
    })
  }

  /**
   * Les questions que la campagne peut poser : la base, moins les retirées et
   * celles de la réserve du quiz du jour. Toutes catégories, la liste se garde
   * jusqu'à ce que l'une des trois change (`jouablesGardees`) : le dé, une
   * série, la page de la campagne la lisent à chaque fois, onze mille
   * questions passées au crible au dixième de cœur de l'hébergeur. Elle est
   * la même pour tous : personne ne la modifie.
   */
  private async jouables(categories?: readonly string[]): Promise<readonly QuestionDeLaBase[]> {
    const [duJour, base] = await Promise.all([this.empreintesDuJour(), this.base()])
    let g = this.jouablesGardees
    // Un retrait ne se reprend jamais : leur nombre dit qu'il en est venu un.
    if (!g || g.base !== base || g.duJour !== duJour || g.retirees !== this.retirees.size) {
      const questions = base.questions.filter(q => !this.retirees.has(q.id) && !duJour.has(q.empreinte))
      g = this.jouablesGardees = { base, duJour, retirees: this.retirees.size, questions }
    }
    const filtre = categories && categories.length > 0 ? new Set(categories) : null
    return filtre ? g.questions.filter(q => filtre.has(q.meta.categorie)) : g.questions
  }

  /**
   * La part de joueurs qui ont trouvé chaque question de la base, en
   * campagne, et celle de sa famille (`mesuresEnFamille`) : ce qui corrige sa
   * difficulté estimée (`niveauDeQuestion`). Les réponses se relisent au plus
   * toutes les dix minutes ; les familles, aussi quand la base change — un
   * reclassement du QG vaut dès le tirage suivant.
   */
  async mesures(): Promise<ReadonlyMap<string, MesureDUneQuestion>> {
    const gardee = this.mesuresGardees
    const age = gardee ? this.maintenant() - gardee.a : Infinity
    const perimee = age >= MESURES_GARDEES_MS
    // Dans ses deux dernières minutes, elle se relit en fond, et ses tirages
    // se préparent avec elle (`relireLaMesureEnFond`) : qui la demande d'ici
    // là reçoit encore celle-ci.
    const enAvance = !perimee && age >= MESURES_GARDEES_MS - MESURE_EN_AVANCE_MS && !gardee!.relueEnFond
    // Une seule relecture pour ceux qui la trouvent périmée ensemble — le
    // préchauffage, le modèle du savoir, deux tirages : chacun relisait tous
    // les comptes, et chacun refaisait une mesure neuve, que les tirages
    // préparés (`tirage`) prenaient pour une autre.
    if ((perimee || enAvance) && !this.mesuresEnRoute) {
      this.mesuresEnRoute = this.mesuresBrutes()
        .then(lues => {
          this.mesuresGardees = { a: this.maintenant(), ...lues, base: null, parQuestion: lues.brutes }
        })
        .finally(() => {
          this.mesuresEnRoute = null
        })
      if (enAvance) {
        gardee!.relueEnFond = true
        this.relireLaMesureEnFond(this.mesuresEnRoute)
      }
    }
    const [base] = await Promise.all([this.base(), perimee ? this.mesuresEnRoute : null])
    // Encore bonne, celle qu'il a trouvée : la neuve, arrivée pendant qu'il
    // attendait, ferait ses familles sur son chemin — c'est la relecture en
    // fond qui les fait.
    const garde = perimee ? this.mesuresGardees! : gardee!
    if (garde.base !== base) {
      garde.parQuestion = mesuresEnFamille(this.famillesDe(base), garde.brutes, garde.premieres)
      garde.base = base
    }
    return garde.parQuestion
  }

  /**
   * La mesure relue avant d'être due (`MESURE_EN_AVANCE_MS`), puis ses
   * familles et la préparation des tirages de toutes les catégories : la
   * requête suivante les trouve faits. Ratée, rien ne change — celle d'avant
   * sert jusqu'à son heure, puis se relit sur le chemin de la requête, comme
   * avant.
   */
  private relireLaMesureEnFond(enRoute: Promise<void>): void {
    enRoute
      .then(async () => {
        if (this.ferme) return
        const [jouables, mesure] = await Promise.all([this.jouables(), this.mesures()])
        if (!this.ferme) this.tirage(jouables, mesure)
      })
      .catch(e => {
        if (!this.ferme) console.warn('[campagne] mesure non relue en fond — elle se relira à son heure :', e instanceof Error ? e.message : e)
      })
  }

  /**
   * Les bonnes réponses et les réponses de chaque question, telles que le
   * journal les dit (`brutes`) ; et les mêmes sur la seule première réponse
   * de chacun (`premieres`), dont se comptent les familles. D'un aller-retour.
   */
  private async mesuresBrutes(): Promise<{ brutes: Map<string, { justes: number; total: number }>; premieres: Map<string, { justes: number; total: number }> }> {
    // Sans les révisions du carnet : elles ne reposent que ce qu'on a raté,
    // dont on a lu la bonne réponse la veille — comptées, elles feraient
    // passer pour faciles les questions que tout le monde rate une fois. En
    // un seul texte, comme ce qu'il a vu (`lectureDesVues`) : une ligne par
    // question jouée — onze mille — se décodait sur le chemin de la requête
    // qui la trouvait périmée, le dé d'un joueur toutes les dix minutes. Une
    // réponse sans série — un test qui l'écrit à la main — compte pour un
    // joueur à elle seule. Un tableau de triplets plutôt qu'un objet : sept
    // mille clés d'objet se décodaient trois fois plus lentement — 13 ms pour
    // les deux textes, 4 en tableaux (le banc du 17 octobre 2026).
    // Ni ce qu'une source de l'expédition reprend du carnet (`QuestionDeSerie.carnet`) :
    // lues d'un coup, les quelques questions des expéditions, plutôt qu'une
    // série relue par réponse. Les premières réponses n'en ont pas besoin :
    // une question du carnet a toujours la sienne avant, celle qu'il a ratée.
    const [brutes, premieres] = await this.client.batch(
      [
        `SELECT json_group_array(json_array(reserve_id, justes, total)) AS mesures FROM (
           SELECT reserve_id, SUM(juste) AS justes, COUNT(*) AS total FROM campagne_reponses
           WHERE serie_id NOT IN (SELECT id FROM campagne_series WHERE mode = 'revision')
             AND serie_id || ':' || position NOT IN (
               SELECT e.id || ':' || j.key FROM campagne_series e, json_each(e.questions) j
               WHERE e.mode = 'expedition' AND json_extract(j.value, '$.carnet') = 1
             )
           GROUP BY reserve_id
         )`,
        `SELECT json_group_array(json_array(reserve_id, justes, total)) AS mesures FROM (
           SELECT reserve_id, SUM(juste) AS justes, COUNT(*) AS total FROM (
             SELECT r.reserve_id AS reserve_id, ${PREMIERE_REPONSE} AS juste
             FROM campagne_reponses r LEFT JOIN campagne_series s ON s.id = r.serie_id
             WHERE COALESCE(s.mode, 'serie') <> 'revision'
             GROUP BY COALESCE(s.profile_id, r.serie_id), r.reserve_id
           ) GROUP BY reserve_id
         )`,
      ],
      'read',
    )
    const lire = (texte: unknown) => {
      const lues = new Map<string, { justes: number; total: number }>()
      if (typeof texte !== 'string') return lues
      for (const [id, justes, total] of JSON.parse(texte) as [unknown, unknown, unknown][]) lues.set(String(id), { justes: Number(justes), total: Number(total) })
      return lues
    }
    return { brutes: lire(brutes.rows[0]?.mesures), premieres: lire(premieres.rows[0]?.mesures) }
  }

  /**
   * La famille de chaque question de la base (`familleDeQuestion`), lue une
   * fois par base : vingt-quatre mille formes de réponse à reconnaître toutes
   * les dix minutes, sur le chemin de la requête qui trouve la mesure
   * périmée, c'était du temps pris à tout le serveur pour rien.
   */
  private famillesDe(base: BaseDeLaCampagne): readonly { id: string; difficulte: number; famille: string | null }[] {
    let familles = this.famillesGardees.get(base)
    if (!familles) {
      familles = base.questions.map(q => ({
        id: q.id,
        difficulte: q.meta.difficulte,
        famille: familleDeQuestion({ categorie: q.meta.categorie, difficulte: q.meta.difficulte, forme: formeDeReponse({ reponses: q.reponses, bonne: q.bonne, valeur: q.meta.valeur }) }),
      }))
      this.famillesGardees.set(base, familles)
    }
    return familles
  }

  /**
   * Le modèle du savoir tel qu'il est — null avant le premier ajustement —,
   * et, s'il a vieilli, le suivant lancé en fond : qui le demande ne
   * l'attend jamais.
   */
  private modeleDuSavoir(): ModeleDuSavoir | null {
    const garde = this.savoir
    const maintenant = this.maintenant()
    const vieilli = !garde || maintenant - garde.a >= MODELE_GARDE_MS
    if (vieilli && !this.savoirEnRoute && !this.ferme && maintenant - this.savoirRateLe >= MODELE_RETENTE_MS) {
      this.savoirEnRoute = this.ajusterLeSavoir()
        .catch(e => {
          this.savoirRateLe = this.maintenant()
          if (!this.ferme) console.warn('[campagne] le modèle du savoir ne s’est pas ajusté — le dé garde celui d’avant :', e instanceof Error ? e.message : e)
        })
        .finally(() => {
          this.savoirEnRoute = null
        })
    }
    return garde?.modele ?? null
  }

  /**
   * L'ajustement du modèle du savoir, en fond et par tranches
   * (`ajusterSansBloquer`), reparti de celui d'avant : sur les premières
   * réponses de tout le monde, d'une lecture (`LECTURE_DU_SAVOIR`), et sur
   * toute la base — une question retirée depuis dit encore la force de qui
   * l'a jouée.
   */
  private async ajusterLeSavoir(): Promise<void> {
    const debut = performance.now()
    const [base, jouables, mesure, lu] = await Promise.all([this.base(), this.jouables(), this.mesures(), this.client.execute(LECTURE_DU_SAVOIR)])
    const depart = this.savoir?.modele ?? null
    const joueurs = await premieresDeTous(lu.rows)
    const modele = await ajusterSansBloquer(
      {
        questions: new Map(base.questions.map(q => [q.id, q.meta])),
        joueurs,
        forceDeDepart: this.referencePour(jouables, mesure, depart).forceDeDepart,
        depart,
      },
      () => this.ferme,
    )
    if (modele) this.savoir = { a: this.maintenant(), modele, dureeMs: Math.round(performance.now() - debut) }
  }

  /**
   * Ce que `/healthz` dit du modèle du savoir — agrégé, sans un nom : quand il
   * s'est ajusté, sur combien, et ce que ça a duré, rendu de main compris —
   * au dixième de cœur de l'hébergeur, c'est lui qu'on surveille.
   */
  santeDuSavoir(): { ajusteLe: number | null; joueurs: number; reponses: number; passes: number; dureeMs: number | null; rateLe: number | null } {
    const s = this.savoir
    return {
      ajusteLe: s && Number.isFinite(s.a) ? s.a : null,
      joueurs: s?.modele.forces.size ?? 0,
      reponses: s?.modele.reponses ?? 0,
      passes: s?.modele.passes ?? 0,
      dureeMs: s?.dureeMs ?? null,
      rateLe: Number.isFinite(this.savoirRateLe) ? this.savoirRateLe : null,
    }
  }

  /**
   * La série de référence du dé (`serieDeReference`) : les marches du tirage
   * (`niveauDeQuestion`), et les difficultés du modèle — ou, sans lui, celles
   * de la part qui a trouvé (`difficulteSansModele`). Gardée tant que rien de
   * cela ne change. Les marches, la préparation du tirage de ces jouables les
   * a lues à cette mesure (`tirage`) : la série de référence les relisait
   * toutes, à chaque mesure neuve.
   */
  private referencePour(
    jouables: readonly QuestionDeLaBase[],
    mesure: ReadonlyMap<string, MesureDUneQuestion>,
    modele: ModeleDuSavoir | null,
  ): SerieDeReference {
    const g = this.referenceGardee
    if (g && g.jouables === jouables && g.mesure === mesure && g.modele === modele) return g.reference
    const preparee = this.tirage(jouables, mesure)
    const reference = serieDeReference(
      jouables,
      (_, i) => preparee.marche(i),
      q => modele?.difficultes.get(q.id) ?? difficulteSansModele(q.meta.difficulte, mesure.get(q.id)),
    )
    this.referenceGardee = { jouables, mesure, modele, reference }
    return reference
  }

  /** Les questions qu'il a vues — répondues, en série, en épreuve ou au défi —, et quand pour la dernière fois (`parFraicheur`). */
  private async vuesPar(profileId: string): Promise<Map<string, number>> {
    return lireLesVues((await this.client.execute(lectureDesVues(profileId))).rows).vues
  }

  /**
   * Ce que la campagne peut poser — ses catégories, ses sujets jouables —,
   * les mêmes pour tous : sans toucher à la base, et compté une fois par
   * liste de jouables (`choixDe`). La préparation d'un duel n'a besoin que
   * de cela, et l'attendait dans tout l'état de la campagne — quatre lectures
   * de son passé avant de s'ouvrir, 800 ms en production (le retour du
   * propriétaire du 13 octobre 2026 : « l'attente est perceptible »).
   */
  async choix(): Promise<ChoixDeLaCampagne> {
    return this.choixDe(await this.jouables())
  }

  /** Les catégories et les sujets de ces jouables : vingt-sept sujets sur vingt-quatre mille questions, recomptés à chaque ouverture de la campagne. */
  private choixDe(jouables: readonly QuestionDeLaBase[]): ChoixDeLaCampagne {
    let choix = this.choixGardes.get(jouables)
    if (!choix) this.choixGardes.set(jouables, (choix = { categories: parCategorie(jouables), sujets: this.sujetsJouables(jouables) }))
    return choix
  }

  /**
   * Combien de ces jouables chaque sujet compte, une fois par liste : la page
   * de la campagne, le quiz tout prêt et les parcours de thème les
   * recomptaient chacun, à chaque ouverture.
   */
  private sujetsComptes(jouables: readonly QuestionDeLaBase[]): ReadonlyMap<string, number> {
    let compte = this.comptesDesSujets.get(jouables)
    if (!compte) {
      const neuf = new Map<string, number>()
      for (const q of jouables) for (const s of sujetsDeLaQuestion(q)) neuf.set(s, (neuf.get(s) ?? 0) + 1)
      this.comptesDesSujets.set(jouables, (compte = neuf))
    }
    return compte
  }

  /**
   * Les jouables d'un sujet, gardées avec leur liste : une série, un duel ou
   * un parcours sur un sujet repassaient les vingt-quatre mille au crible, et
   * gardées, leur tirage se prépare une fois (`tirage`).
   */
  private duSujet(jouables: readonly QuestionDeLaBase[], cle: string): readonly QuestionDeLaBase[] {
    let parSujet = this.listesDesSujets.get(jouables)
    if (!parSujet) this.listesDesSujets.set(jouables, (parSujet = new Map()))
    let siennes = parSujet.get(cle)
    if (!siennes) parSujet.set(cle, (siennes = jouables.filter(q => sujetsDeLaQuestion(q).includes(cle))))
    return siennes
  }

  /**
   * Le tirage d'une série sur ces jouables, préparé une fois pour leur
   * mesure (`PreparationDuTirage`) : la liste de toutes les catégories, ou
   * d'un sujet, se garde tant que la base, la réserve du jour et les retraits
   * ne changent pas, et la mesure dix minutes.
   */
  private tirage(jouables: readonly QuestionDeLaBase[], mesure: ReadonlyMap<string, MesureDUneQuestion>): PreparationDuTirage {
    let p = this.preparations.get(jouables)
    if (!p || p.mesure !== mesure) this.preparations.set(jouables, (p = new PreparationDuTirage(jouables, mesure, p)))
    return p
  }

  /** Les sujets qui ont de quoi faire une série, comptés sur ce que la campagne peut poser. */
  private sujetsJouables(jouables: readonly QuestionDeLaBase[]): { sujet: string; questions: number }[] {
    const compte = this.sujetsComptes(jouables)
    return SUJETS.filter(s => (compte.get(s.cle) ?? 0) >= QUESTIONS_POUR_JOUER).map(s => ({ sujet: s.cle, questions: compte.get(s.cle)! }))
  }

  /**
   * Ce que la première ouverture de la campagne et le premier tirage après
   * un réveil faisaient d'un bloc, fait en fond : les sujets de chaque
   * question, par tranches qui rendent la main, et ce que la campagne en
   * propose (`choixDe`) — 1,5 s de serveur figé au dixième de cœur de
   * l'hébergeur (le banc du 16 octobre 2026) —, puis la préparation de ses
   * tirages, à la mesure du moment (`tirage`).
   */
  private async preparerEnFond(): Promise<void> {
    const jouables = await this.jouables()
    for (let debut = 0; debut < jouables.length && !this.ferme; debut += SUJETS_PAR_TRANCHE) {
      for (let i = debut; i < Math.min(debut + SUJETS_PAR_TRANCHE, jouables.length); i++) sujetsDeLaQuestion(jouables[i])
      await new Promise<void>(rendre => setImmediate(rendre))
    }
    if (this.ferme) return
    this.choixDe(jouables)
    const mesure = await this.mesures()
    if (!this.ferme) this.tirage(jouables, mesure)
  }

  /**
   * Ce qu'un quiz tout prêt peut tirer pour une soirée (`core/quizToutPret.ts`) :
   * les questions que la campagne pose — ni retirées, ni de la réserve du quiz
   * du jour —, et la part de joueurs qui ont trouvé chacune, qui corrige sa
   * difficulté estimée.
   */
  async pourLesSoirees(): Promise<{ questions: readonly QuestionDeLaBase[]; mesures: ReadonlyMap<string, MesureDUneQuestion> }> {
    const [questions, mesures] = await Promise.all([this.jouables(), this.mesures()])
    return { questions, mesures }
  }

  /**
   * La marche de questions de la base, par leur identifiant dans la base — à
   * leur difficulté lissée par les réponses de campagne, comme au tirage du
   * quiz tout prêt (`niveauDeQuestion`) : l'éditeur la montre. Une question
   * qui n'est plus dans la base n'en a pas.
   */
  async marchesDe(ids: readonly string[]): Promise<Map<string, Niveau>> {
    const [base, mesures] = await Promise.all([this.base(), this.mesures()])
    const marches = new Map<string, Niveau>()
    for (const id of ids) {
      const q = base.parId.get(id)
      if (q) marches.set(id, niveauDeQuestion(q.meta.difficulte, mesures.get(id)))
    }
    return marches
  }

  /** Ce que la base offre à un quiz tout prêt : son total, et les catégories et les sujets qui ont de quoi en faire un. */
  async baseDesSoirees(): Promise<BaseDuQuizToutPret> {
    const jouables = await this.jouables()
    const { categories, sujets } = this.choixDe(jouables)
    const parCategorie = new Map(categories.map(c => [c.categorie, c.questions]))
    return {
      total: jouables.length,
      categories: CATEGORIES.filter(c => (parCategorie.get(c) ?? 0) >= QUESTIONS_POUR_JOUER),
      sujets: sujets.map(s => s.sujet),
    }
  }

  async etat(profileId: string): Promise<EtatDeCampagne> {
    const [series, jouables, parJour, enCours, records] = await Promise.all([
      this.client.execute({
        sql: `SELECT COUNT(*) AS n, COALESCE(MAX(justes), 0) AS record FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL AND ${SERIES}`,
        args: [profileId],
      }),
      this.jouables(),
      this.justesParJour(profileId),
      this.serieEnCours(profileId),
      this.recordsParCategorie(profileId),
    ])
    const aujourdhui = parJour.get(jourDe(this.maintenant())) ?? 0
    const { categories, sujets } = this.choixDe(jouables)
    return {
      record: Number(series.rows[0]?.record ?? 0),
      series: Number(series.rows[0]?.n ?? 0),
      xpAujourdhui: xpDuJourDeCampagne(aujourdhui),
      justesAujourdhui: aujourdhui,
      enCours: enCours ? vueDeSerie(enCours) : null,
      categories,
      sujets,
      questions: jouables.length,
      records: [...records].map(([categorie, record]) => ({ categorie, record })),
    }
  }

  // ── Les récompenses ─────────────────────────────────────────────────────

  /**
   * Ce que la campagne compte pour ses paliers : le record d'une série,
   * ses questions expertes trouvées et toutes ses bonnes réponses —
   * épreuves des sentiers comprises pour ces deux-là —, et ce que ses
   * épreuves ont validé sur les sentiers (`statsDesSentiers`). Le niveau
   * d'une question est celui que la série lui donnait quand elle l'a posée.
   */
  async statsDe(profileId: string): Promise<StatsDeCampagne> {
    const [record, justes, expertes, validees] = await this.client.batch(
      [
        {
          sql: `SELECT COALESCE(MAX(justes), 0) AS n FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL AND ${SERIES}`,
          args: [profileId],
        },
        { sql: 'SELECT COALESCE(SUM(justes), 0) AS n FROM campagne_series WHERE profile_id = ?', args: [profileId] },
        // Une experte retrouvée en révision — ou à une source de l'expédition,
        // qui la reprend du carnet — ne compte pas pour L'Érudit : on en aurait
        // fait trois d'une seule, ratée exprès.
        {
          sql: `SELECT COUNT(*) AS n FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
                WHERE s.profile_id = ? AND s.mode <> 'revision' AND ${HORS_DU_CARNET} AND r.juste = 1 AND json_extract(s.questions, '$[' || r.position || '].niveau') = 'expert'`,
          args: [profileId],
        },
        this.lectureDesValidees(profileId),
      ],
      'read',
    )
    return {
      record: Number(record.rows[0]?.n ?? 0),
      justes: Number(justes.rows[0]?.n ?? 0),
      expertes: Number(expertes.rows[0]?.n ?? 0),
      // Ses épreuves seules : un palier repris des portraits d'avant n'a pas d'étoile.
      ...statsDesSentiers(sentiersLus([], validees.rows)),
    }
  }

  /** Son record dans chaque catégorie jouée seule : la meilleure série d'une seule catégorie. */
  async recordsParCategorie(profileId: string): Promise<Map<string, number>> {
    const res = await this.client.execute({
      sql: `SELECT json_extract(categories, '$[0]') AS categorie, MAX(justes) AS record FROM campagne_series
            WHERE profile_id = ? AND finie_le IS NOT NULL AND ${SERIES} AND categories IS NOT NULL AND json_array_length(categories) = 1
            GROUP BY categorie`,
      args: [profileId],
    })
    return new Map(res.rows.filter(r => r.categorie != null).map(r => [String(r.categorie), Number(r.record)]))
  }

  /**
   * Ce qu'une série finie fait tomber : le Funambule (neuf bonnes réponses
   * d'affilée sur sa dernière vie), Sans une égratignure (les expertes
   * atteintes sans perdre une vie), la Grande Série (trente bonnes réponses
   * dans une série de toutes les catégories), le Tour du monde (dix dans une
   * série de chacune des douze) — puis les paliers que sa campagne atteint.
   */
  private async recompenserLaSerie(profileId: string, s: Serie): Promise<Recompenses> {
    if (!this.recompenses) return {}
    try {
      const res = await this.client.execute({ sql: 'SELECT position, juste FROM campagne_reponses WHERE serie_id = ? ORDER BY position', args: [s.id] })
      const cles = hautsFaitsDeLaSerie(
        s,
        res.rows.map(r => Number(r.juste) === 1),
      )
      // Une fois : sa condition tenue le reste, et il tombait à chaque série
      // d'après — « Nouveau haut fait » à chaque fin, et maintenant qu'il
      // paie, de l'expérience à chaque série perdue en trois questions.
      if (!this.recompenses.recompensesOf(profileId).has('hf:tour-du-monde') && (await this.tourDuMondeFait(profileId))) cles.push('hf:tour-du-monde')
      return await this.recompenser(profileId, s.id, cles, s.finieLe ?? this.maintenant())
    } catch (e) {
      // La série est rangée : une étagère muette n'y change rien, la relecture rattrapera.
      console.error('[campagne] récompenses de la série non rangées :', e)
      return {}
    }
  }

  /** Dix bonnes réponses dans une série de chacune des douze catégories, jouée seule. */
  private async tourDuMondeFait(profileId: string): Promise<boolean> {
    const records = await this.recordsParCategorie(profileId)
    return CATEGORIES.every(c => (records.get(c) ?? 0) >= RECORD_DU_TOUR_DU_MONDE)
  }

  /** Range ces hauts faits sous la série, puis les paliers qu'elle fait atteindre, et dit ce que tout cela ouvre. */
  private async recompenser(profileId: string, serieId: string, cles: readonly string[], quand: number): Promise<Recompenses> {
    if (!this.recompenses) return {}
    const sous = cleDeSerie(serieId)
    const neufs = await this.recompenses.ranger(profileId, sous, cles, quand)
    const paliers = await this.recompenses.accorderPaliersDeCampagne(profileId, sous, await this.statsDe(profileId))
    const tombees = [...neufs, ...paliers]
    if (tombees.length === 0) return {}
    const legendaires = this.recompenses.legendairesOuverts(profileId, tombees)
    return {
      recompenses: tombees.map(tombee),
      ...(legendaires.length > 0 && { legendaires }),
    }
  }

  /**
   * Relit toutes les séries finies avec les règles du jour, une fois par
   * version (`VERSION_DES_SERIES`) : ce que leur fin aurait décerné, et les
   * paliers que la campagne de chacun atteint. Les séries d'avant la colonne
   * des catégories y gagnent la leur, lue sur leurs questions : toutes de la
   * même catégorie, c'était une série d'une seule.
   */
  async relireLesSeries(): Promise<{ series: number; profils: number } | null> {
    if (!this.recompenses) return null
    const fait = await this.client.execute({ sql: 'SELECT valeur FROM campagne_meta WHERE cle = ?', args: ['relecture_des_series'] })
    if (Number(fait.rows[0]?.valeur ?? 0) >= VERSION_DES_SERIES) return null
    const res = await this.client.execute(`SELECT * FROM campagne_series WHERE finie_le IS NOT NULL AND ${SERIES} ORDER BY finie_le`)
    const profils = new Set<string>()
    for (const r of res.rows) {
      const s = versSerie(r)
      profils.add(s.profileId)
      // Une série à sujet a ses catégories NULL sans être d'avant la colonne : elle n'en gagne pas.
      if (r.categories == null && r.sujet == null) {
        const toutes = new Set(s.questions.map(q => q.categorie).filter(Boolean))
        if (toutes.size === 1) {
          s.categories = [...toutes] as string[]
          await this.client.execute({ sql: 'UPDATE campagne_series SET categories = ? WHERE id = ?', args: [JSON.stringify(s.categories), s.id] })
        }
      }
      await this.avecVerrou(s.profileId, () => this.recompenserLaSerie(s.profileId, s))
    }
    // Les épreuves comptent pour Le Marathonien et L'Érudit : un passage par profil.
    const joueurs = await this.client.execute(`SELECT DISTINCT profile_id FROM campagne_series WHERE finie_le IS NOT NULL`)
    for (const r of joueurs.rows) {
      const id = String(r.profile_id)
      profils.add(id)
      await this.avecVerrou(id, async () => this.recompenses!.accorderPaliersDeCampagne(id, cleDeSerie('relecture'), await this.statsDe(id)))
    }
    await this.client.execute({
      sql: 'INSERT INTO campagne_meta (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur',
      args: ['relecture_des_series', String(VERSION_DES_SERIES)],
    })
    return { series: res.rows.length, profils: profils.size }
  }

  /**
   * Relit les épreuves des sentiers une fois par version
   * (`VERSION_DES_EPREUVES`) : ce que leur fin aurait fait tomber
   * d'elles-mêmes (`hautsFaitsDeLEpreuve`), puis les paliers que la campagne
   * de chacun atteint — les pistes des sentiers tombent à qui les tenait déjà
   * (le 15 octobre 2026). Contre toute attente ne se relit que sur les
   * épreuves qui ont gardé leur chance : avant la colonne, rien n'avait été
   * annoncé. Un passage par joueur des sentiers, pas par série : monter
   * `VERSION_DES_SERIES` aurait relu les cinq cents séries, au démarrage que
   * l'hébergeur attend. Ajoute sans rien reprendre.
   */
  async relireLesEpreuves(): Promise<{ epreuves: number; profils: number } | null> {
    if (!this.recompenses) return null
    const fait = await this.client.execute({ sql: 'SELECT valeur FROM campagne_meta WHERE cle = ?', args: ['relecture_des_epreuves'] })
    if (Number(fait.rows[0]?.valeur ?? 0) >= VERSION_DES_EPREUVES) return null
    const res = await this.client.execute(
      `SELECT id, profile_id, branche, palier, rejeu, issue, justes, chance, finie_le FROM campagne_series WHERE mode = 'sentier' ORDER BY commencee_le`,
    )
    // Ses échecs en jeu sur chaque palier, épreuve après épreuve : Contre toute attente ne tombe que du premier coup.
    const echecs = new Map<string, number>()
    const profils = new Set<string>()
    for (const r of res.rows) {
      const profileId = String(r.profile_id)
      profils.add(profileId)
      if (r.finie_le === null || r.finie_le === undefined) continue
      const issue: IssueDEpreuve | null = r.issue === 'validee' ? 'validee' : r.issue === 'ratee' ? 'ratee' : null
      const e = { palier: Number(r.palier), rejeu: Number(r.rejeu ?? 0) === 1, issue, chance: r.chance === null || r.chance === undefined ? null : Number(r.chance) }
      const cle = `${profileId}|${String(r.branche)}|${e.palier}`
      const cles = hautsFaitsDeLEpreuve(e, Number(r.justes), echecs.get(cle) ?? 0)
      if (!e.rejeu && e.issue === 'ratee') echecs.set(cle, (echecs.get(cle) ?? 0) + 1)
      if (cles.length > 0) await this.avecVerrou(profileId, () => this.recompenses!.ranger(profileId, cleDeSerie(String(r.id)), cles, Number(r.finie_le)))
    }
    for (const id of profils) {
      await this.avecVerrou(id, async () => this.recompenses!.accorderPaliersDeCampagne(id, cleDeSerie('relecture'), await this.statsDe(id)))
    }
    await this.client.execute({
      sql: 'INSERT INTO campagne_meta (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur',
      args: ['relecture_des_epreuves', String(VERSION_DES_EPREUVES)],
    })
    return { epreuves: res.rows.length, profils: profils.size }
  }

  /**
   * Une série neuve — la précédente, laissée en route, s'arrête là. Chaque
   * marche tire d'abord parmi les questions que ce joueur n'a jamais vues :
   * il ne revoit une question qu'une fois toutes les autres de sa marche
   * passées, la plus anciennement vue d'abord (`parFraicheur`), et la base
   * en compte des milliers ; ses catégories, puis leurs sous-thèmes, y
   * passent à tour de rôle, sans deux jumelles (`tirerUneSerie`). Sur un sujet
   * (`shared/sujets.ts`), ses catégories n'y sont pour rien : il les
   * traverse toutes.
   */
  commencer(profileId: string, categories?: readonly string[], sujet?: string): Promise<SerieDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const suivi = sujet === undefined ? undefined : sujetParCle(sujet)
      if (sujet !== undefined && !suivi) throw new Error('Ce sujet n’existe plus : choisis-en un autre')
      const [toutes, mesure, vues, laissee] = await Promise.all([this.jouables(suivi ? undefined : categories), this.mesures(), this.vuesPar(profileId), this.serieEnCours(profileId)])
      const jouables = suivi ? this.duSujet(toutes, suivi.cle) : toutes
      if (jouables.length < QUESTIONS_POUR_JOUER) {
        throw new Error(
          suivi
            ? 'Pas assez de questions sur ce sujet pour l’instant : choisis-en un autre'
            : categories && categories.length > 0
              ? 'Pas assez de questions dans ces catégories : ajoutes-en une autre'
              : 'La campagne n’a pas encore de questions à poser : reviens bientôt',
        )
      }
      const maintenant = this.maintenant()
      const questions = this.tirage(jouables, mesure)
        .tirer(vues, maintenant)
        .map(x => versQuestionDeSerie(x.question, x.niveau))
      const serie: Serie = {
        id: randomUUID(),
        profileId,
        questions,
        index: 0,
        vies: VIES,
        justes: 0,
        finieLe: null,
        mode: 'serie',
        branche: null,
        palier: null,
        seuil: null,
        rejeu: false,
        issue: null,
        categories: suivi ? null : lireCategories(categoriesRetenues(categories)),
        sujet: suivi?.cle ?? null,
      }
      this.enCours.delete(profileId)
      await this.client.batch(
        [
          // La série laissée en route s'arrête : une seule à la fois. Une épreuve des sentiers, elle, attend.
          { sql: `UPDATE campagne_series SET finie_le = ? WHERE profile_id = ? AND finie_le IS NULL AND ${SERIES}`, args: [maintenant, profileId] },
          {
            sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, categories, sujet)
                  VALUES (?, ?, ?, 0, ?, 0, ?, NULL, ?, ?)`,
            args: [serie.id, profileId, JSON.stringify(questions), VIES, maintenant, serie.categories ? JSON.stringify(serie.categories) : null, serie.sujet ?? null],
          },
        ],
        'write',
      )
      this.garderEnCours(serie)
      // La série laissée finit comme une série abandonnée : ce qu'elle a
      // joué fait tomber ses hauts faits — trente bonnes réponses avant de
      // poser le téléphone font la Grande Série. Rien ne s'annonce : la
      // nouvelle commence, et la collection les garde.
      if (laissee) await this.recompenserLaSerie(profileId, { ...laissee, finieLe: maintenant })
      return vueDeSerie(serie)
    })
  }

  /**
   * Abandonner une série — « Recommencer » alors qu'il reste des vies (un
   * retour de joueur du 10 octobre 2026) : elle finit là, comme perdue. Ni
   * vie ni expérience en jeu — une série perdue n'en coûte pas non plus — ;
   * son record et ses hauts faits se lisent sur ce qu'elle a joué. Le défi
   * de la semaine n'a qu'une tentative : elle ne s'abandonne pas.
   */
  abandonnerSerie(profileId: string, id: string): Promise<FinDeSerie> {
    return this.avecVerrou(profileId, async () => {
      const gardee = this.enCours.get(profileId)
      const s = gardee?.id === id ? gardee : await this.serie(profileId, id)
      if (s?.mode === 'defi' || s?.mode === 'duel') throw new Error('Le défi n’a qu’une tentative : elle ne s’abandonne pas')
      if (s?.mode === 'rencontre') throw new Error('Une rencontre se joue jusqu’au bout : elle ne s’abandonne pas')
      if (!s || s.mode !== 'serie') throw new Error('Cette série est introuvable')
      if (s.finieLe !== null) throw new Error('Cette série est finie : commence-en une autre')
      const maintenant = this.maintenant()
      const [avant] = await this.client.batch(
        [
          { sql: `SELECT COALESCE(MAX(justes), 0) AS record FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL AND ${SERIES}`, args: [profileId] },
          { sql: 'UPDATE campagne_series SET finie_le = ? WHERE id = ? AND finie_le IS NULL', args: [maintenant, s.id] },
        ],
        'write',
      )
      this.enCours.delete(profileId)
      const recordAvant = Number(avant.rows[0]?.record ?? 0)
      const gagnees = await this.recompenserLaSerie(profileId, { ...s, finieLe: maintenant })
      return {
        justes: s.justes,
        recordAvant,
        ...(s.justes > recordAvant && { record: true }),
        ...(s.index > 0 && { niveauAtteint: plusHaute(s.questions.slice(0, s.index)) }),
        ...gagnees,
      }
    })
  }

  /** La série en cours d'un profil, gardée — la plus récente en dernier, pour oublier d'abord la plus ancienne. */
  private garderEnCours(serie: Serie) {
    this.enCours.delete(serie.profileId)
    this.enCours.set(serie.profileId, serie)
    if (this.enCours.size > SERIES_GARDEES) this.enCours.delete(this.enCours.keys().next().value!)
  }

  /** La série en cours de ce profil, s'il en a une. */
  async serieEnCours(profileId: string): Promise<Serie | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND finie_le IS NULL AND ${SERIES} ORDER BY commencee_le DESC LIMIT 1`,
      args: [profileId],
    })
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  private async serie(profileId: string, id: string): Promise<Serie | null> {
    const res = await this.client.execute({ sql: 'SELECT * FROM campagne_series WHERE id = ? AND profile_id = ?', args: [id, profileId] })
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  /**
   * Une réponse : juste ou non, une vie de moins sinon, et la question
   * suivante. Une réponse qui ne vise pas la question en cours — un double
   * toucher, un onglet resté derrière — ne compte pas : elle reçoit l'état.
   */
  repondre(profileId: string, id: string, index: number, choix: unknown): Promise<ReponseDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const gardee = this.enCours.get(profileId)
      const s = gardee?.id === id ? gardee : await this.serie(profileId, id)
      // Le dé l'a promise sans pouvoir l'écrire (`commencerUneRencontre`) : il n'y a rien à jouer.
      if (!s && this.rencontresPerdues.get(profileId) === id) throw new Error('Ce duel n’a pas pu commencer : relance le dé')
      // Le voisin n'en sait pas plus (invariant 3) : la série d'un autre est introuvable.
      if (!s || (s.mode !== 'serie' && s.mode !== 'defi' && s.mode !== 'duel' && s.mode !== 'revision' && s.mode !== 'rencontre')) throw new Error('Cette série est introuvable')
      // Lundi à minuit, le défi se clôt : son classement est figé, sa vainqueur rangé.
      if (s.mode === 'defi' && s.semaine !== this.semaineDeLHeure().semaine) throw new Error('Ce défi est clos : celui de cette semaine t’attend')
      // Un défi entre amis ferme au bout de sa semaine, tentatives en route comprises.
      if (s.mode === 'duel' && (await this.duelFerme(s.duel))) throw new Error('Ce défi est fermé : son classement est figé')
      if (s.finieLe !== null) {
        throw new Error(
          s.mode === 'defi'
            ? 'Tu as relevé le défi de cette semaine : le prochain ouvre lundi'
            : s.mode === 'duel'
              ? 'Tu as relevé ce défi : son classement t’attend'
              : s.mode === 'revision'
                ? 'Cette révision est finie : ton carnet t’attend'
                : s.mode === 'rencontre'
                  ? 'Ce duel est fini : relance le dé pour en jouer un autre'
                  : 'Cette série est finie : commence-en une autre',
        )
      }
      if (index !== s.index) throw new Error('Cette question est passée : la série a continué sans elle')
      const q = s.questions[s.index]
      const c = typeof choix === 'number' && Number.isInteger(choix) && choix >= 0 && choix < q.reponses.length ? choix : null
      const juste = c === q.bonne
      // Une révision n'a pas de vies : on y vient apprendre ce qu'on a raté,
      // et l'erreur remet seulement la question au lendemain.
      const vies = juste || s.mode === 'revision' ? s.vies : s.vies - 1
      const justes = s.justes + (juste ? 1 : 0)
      const position = s.index + 1
      // Un duel gagné n'a plus rien à jouer : sa cote ne lit que gagné, perdu
      // ou égal. Il continuait jusqu'à la troisième erreur — soixante
      // questions au plus —, sous « −36 si tu perds », et qui partait content
      // d'avoir gagné laissait un duel en route, sans cote (l'experte du jeu
      // solo, le 11 octobre 2026). Le score à battre : celui de la série
      // rejouée, ou celui de qui l'a lancé, pour qui joue un duel en second.
      const aBattre = s.mode === 'rencontre' && s.adversaire ? sesJustesEnTout(s.adversaire) : await this.scoreABattre(s)
      const gagne = aBattre !== null && justes > aBattre
      const finie = vies <= 0 || position >= s.questions.length || gagne
      const maintenant = this.maintenant()
      // Tout dans un lot : le record se lit avant d'écrire la fin — battu, la
      // fin le dit, et l'ancien avec —, ses bonnes réponses après la sienne,
      // de quoi relire sa ligne d'expérience. Chacun coûtait un aller-retour.
      const lot: InStatement[] = [
        {
          sql: 'INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [s.id, s.index, q.id, c, juste ? 1 : 0, maintenant, this.compagnonPorte(profileId)],
        },
        {
          sql: 'UPDATE campagne_series SET position = ?, vies = ?, justes = ?, finie_le = ? WHERE id = ?',
          args: [position, vies, justes, finie ? maintenant : null, s.id],
        },
      ]
      // Le record est celui des séries : un défi a son classement à lui.
      const record = finie && s.mode === 'serie'
      if (record) lot.unshift({ sql: `SELECT COALESCE(MAX(justes), 0) AS record FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL AND ${SERIES}`, args: [profileId] })
      // Une rencontre finie est un duel classé : ses duels se relisent après
      // elle, dans le même lot — sa fin dit sa cote. Un duel contre quelqu'un
      // aussi : joué des deux côtés, il compte, et sa fin la dit de même.
      const contre = finie && s.mode === 'duel' ? await this.duelDe(s.duel) : null
      const classe = !!contre?.adversaire
      const lectureDuDuel = finie && (s.mode === 'rencontre' || classe) ? lot.push(lectureDesDuels(profileId, this.maintenant())) - 1 : -1
      if (juste) lot.push(...lecturesDeLExperience(profileId))
      // Le tour de ses bordures, pris avant le lot qui les relit avec son duel.
      const tourDesBordures = ++this.tourDesBordures
      let res: ResultSet[]
      try {
        res = await this.client.batch(lot, 'write')
      } catch (e) {
        this.enCours.delete(profileId)
        throw e
      }
      if (finie) this.enCours.delete(profileId)
      else this.garderEnCours({ ...s, index: position, vies, justes })
      // Le classement des duels se relira : sa cote vient de bouger.
      if (lectureDuDuel >= 0) this.cotes = null
      const releve = lectureDuDuel >= 0 ? releverLesDuels(duelsLus(res[lectureDuDuel].rows), semaineDeLInstant) : null
      // Un cran de plus à sa bordure, peut-être : la salle où il joue le verra.
      if (releve) this.retenirLesBordures(profileId, releve.bordures, tourDesBordures)
      const coteApres = releve ? this.coteApres(releve, s.id) : null
      // Et sa place au classement, sa cote d'après comptée : la carte du verdict la dit.
      const rang = coteApres ? await this.rangAuxDuels(profileId) : undefined
      const duel = coteApres && rang !== undefined ? { ...coteApres, rang } : coteApres
      // Joué des deux côtés : la cote de l'autre a bougé aussi — ses bordures
      // se relisent, s'il en a de retenues —, et sa fin à lui dit le score d'en face.
      if (classe && duel && contre) this.relireLesBorduresDe(contre.auteur === profileId ? contre.adversaire : contre.auteur)
      const enFace = classe && duel && contre ? await this.enFaceDuDuel(contre, profileId) : null
      const avant = record ? Number(res[0].rows[0]?.record ?? 0) : 0
      const xp = juste ? await this.crediter(profileId, res.slice(-2)) : 0
      const revision = s.mode === 'revision'
      const gagnees = !finie
        ? {}
        : revision
          ? await this.recompenserLaRevision(profileId, s.id, maintenant)
          : await this.recompenserLaSerie(profileId, { ...s, index: position, vies, justes, finieLe: maintenant })
      // L'Éclat du défi se tire ici, à sa tentative finie — jamais dans
      // `recompenserLaSerie`, que la relecture des séries rejoue.
      const eclat = finie && s.mode === 'defi' && s.semaine ? await this.tirerLEclat(profileId, s.semaine) : {}
      // Un duel classé n'a pas de classement : deux joueurs, un score contre l'autre.
      const defi =
        finie && s.mode === 'defi' && s.semaine
          ? await this.placeAuDefi(s.semaine, profileId)
          : finie && s.mode === 'duel' && s.duel && !classe
            ? await this.placeAuDuel(s.duel, profileId)
            : null
      // Finie, une révision redit son carnet : ce qu'elle a appris, ce qui reste à revoir.
      const carnet = finie && revision ? await this.carnetApres(profileId) : null
      // Le défi qu'il a lancé, joué jusqu'au bout : il part aux amis choisis au lancement.
      const partiA = finie && s.mode === 'duel' && s.duel ? await this.partirAuxPrevus(profileId, s.duel) : []
      if (finie) await this.faireGrandir(profileId)
      return {
        juste,
        xp,
        bonne: q.bonne,
        anecdote: q.anecdote,
        vies,
        justes,
        finie,
        ...(finie && !revision && { niveauAtteint: plusHaute(s.questions.slice(0, position)) }),
        ...(record && { recordAvant: avant }),
        ...(record && justes > avant && { record: true }),
        ...(defi && { defi }),
        ...(partiA.length > 0 && { partiA }),
        // Un duel classé qu'il a joué le premier : sa cote bougera quand l'autre l'aura joué.
        ...(classe && !duel && { classe: true as const }),
        ...(enFace && { contre: enFace }),
        ...(revision && { revision: suiteDeLaRevision(q.etape ?? 0, juste, q.enAvance, jourDe(maintenant)) }),
        ...(carnet && { carnet }),
        // Une rencontre : ce que son adversaire avait fait de la même question, et les deux scores.
        ...(s.mode === 'rencontre' && s.adversaire && { rencontre: coupDeLaRencontre(s.adversaire, s.index, justes, finie) }),
        ...(duel && { duel }),
        ...(!finie && { suivante: questionMontree(s.questions[position], position) }),
        ...ensemble(gagnees, eclat),
      }
    })
  }

  /**
   * L'Éclat du défi de la semaine : une chance sur `CHANCE_ECLAT_DU_DEFI`,
   * tirée quand sa tentative finit — une fois par semaine : il n'y en a
   * qu'une, et elle ne finit qu'une fois. Rangé sous la semaine
   * (`cleDuDefi`), avec les paliers de La Pluie d'Éclats qu'il fait tomber ;
   * rend ce que la fin du défi en annonce.
   */
  private async tirerLEclat(profileId: string, semaine: string): Promise<RecompensesDuDefi> {
    if (!this.recompenses) return {}
    try {
      const tire = await this.recompenses.tirerUnEclat(profileId, cleDuDefi(semaine), CHANCE_ECLAT_DU_DEFI)
      if (!tire) return {}
      const legendaires = this.recompenses.legendairesOuverts(profileId, tire.paliers)
      return {
        eclat: tire.avatar,
        ...(tire.paliers.length > 0 && { recompenses: tire.paliers.map(tombee) }),
        ...(legendaires.length > 0 && { legendaires }),
      }
    } catch (e) {
      // Le défi est rangé : un Éclat que la base refuse tombe à côté, comme un tirage manqué.
      console.error('[campagne] Éclat du défi non rangé :', e)
      return {}
    }
  }

  /**
   * Une bonne réponse vient d'entrer : sa ligne d'expérience se relit en
   * entier (`lecturesDeLExperience`, lues dans le lot qui l'écrit), sous le
   * verrou du profil où l'on est déjà. Rend ce que cette réponse rapporte —
   * double parmi les vingt premières du jour. Une base qui refuse d'écrire la
   * ligne ne fait pas échouer la réponse, déjà rangée : la bonne réponse
   * suivante réécrit la ligne entière.
   */
  private async crediter(profileId: string, lues: readonly ResultSet[]): Promise<number> {
    const { parJour, xp } = experienceLue(lues)
    try {
      await this.ecrireXp(profileId, xp, parJour.size)
      return xpDeLaBonneReponse(parJour.get(jourDe(this.maintenant())) ?? 1)
    } catch (e) {
      console.error('[campagne] expérience non écrite, la prochaine bonne réponse la réécrira :', e)
      return 0
    }
  }

  /**
   * Le barème du solo du 6 octobre 2026, appliqué à ce qui est déjà joué —
   * une fois, au démarrage qui l'apporte (`core/baremeDuSolo.ts`) : la ligne
   * de chaque joueur de la campagne se réécrit de ses réponses et de ses
   * paliers, au barème du jour. Rend les profils réécrits.
   */
  async revaloriser(): Promise<string[]> {
    const joueurs = await this.client.execute('SELECT DISTINCT profile_id FROM campagne_series')
    const ids = joueurs.rows.map(r => String(r.profile_id))
    for (const id of ids) {
      await this.avecVerrou(id, async () => {
        const { parJour, xp } = experienceLue(await this.client.batch(lecturesDeLExperience(id), 'read'))
        await this.ecrireXp(id, xp, parJour.size)
      })
    }
    return ids
  }

  /** « Mes réponses », une série finie : chaque question posée, sa bonne réponse, la sienne, et l'anecdote. */
  async correction(profileId: string, id: string): Promise<CorrectionDeCampagne[]> {
    const s = await this.serie(profileId, id)
    if (!s) throw new Error('Cette série est introuvable')
    // En cours, la correction donnerait les réponses de la question qu'on a sous les yeux.
    if (s.finieLe === null) throw new Error('La correction attend la fin de la série')
    // Le défi de la semaine se corrige à sa clôture : finie, la sienne
    // soufflerait ses réponses à ceux qui jouent encore.
    if (s.mode === 'defi' && s.semaine === this.semaineDeLHeure().semaine) throw new Error('La correction du défi s’ouvre à sa clôture, lundi')
    // Un défi entre amis de même : finie, la sienne soufflerait ses réponses à
    // ceux qu'il a défiés. Un duel classé joué des deux côtés, lui, n'a plus
    // personne à qui les souffler : personne d'autre n'y joue (`dansLeDuel`).
    if (s.mode === 'duel' && !(await this.duelFerme(s.duel)) && !(await this.joueDesDeuxCotes(s.duel))) {
      throw new Error((await this.duelDe(s.duel))?.adversaire ? 'La correction du duel s’ouvre quand vous l’aurez joué tous les deux' : 'La correction du défi s’ouvre à sa fermeture : tes amis jouent encore')
    }
    const res = await this.client.execute({ sql: 'SELECT position, choix, juste FROM campagne_reponses WHERE serie_id = ? ORDER BY position', args: [s.id] })
    return res.rows.map(r => {
      const q = s.questions[Number(r.position)]
      return {
        texte: q.texte,
        reponses: q.reponses,
        bonne: q.bonne,
        choix: r.choix === null ? null : Number(r.choix),
        juste: Number(r.juste) === 1,
        niveau: q.niveau,
        anecdote: q.anecdote,
      }
    })
  }

  /** Lit la base en fond, sans rien attendre : la première série la trouve prête (`PRECHAUFFAGE_CAMPAGNE_MS`, `server.ts`). */
  prechauffer(): void {
    this.base().catch(e => console.error('[campagne] base non lue en fond — la première série la relira :', e))
    // Ses sujets et la préparation de ses tirages : la première ouverture de la campagne et le premier tirage les trouvent faits.
    this.preparerEnFond().catch(e => console.warn('[campagne] sujets et tirages non préparés en fond — la première demande les fera :', e instanceof Error ? e.message : e))
    // Les bordures de ligue de tous, d'une lecture : les classements du jour
    // et du défi les montrent sans rien attendre (`borduresEnMemoire`).
    this.toutesLesCotes().catch(e => console.warn('[campagne] bordures de ligue non lues en fond — chacune se relira à la demande :', e instanceof Error ? e.message : e))
    // Le modèle du savoir : le premier dé le trouve ajusté.
    this.modeleDuSavoir()
  }

  /** Cet intitulé est-il dans la base ? La réserve du quiz du jour le refuse alors (`JourStore.dansLaCampagne`). */
  async dansLaBase(empreinte: string): Promise<boolean> {
    return (await this.base()).empreintes.has(empreinte)
  }

  /**
   * Ce que la campagne dit d'un profil à son solde et à sa page, d'un seul
   * aller-retour. Ses confettis de campagne : une bonne réponse, un confetti
   * — séries, épreuves et défis —, ce que paient les étoiles de ses
   * sentiers, la meilleure note de chaque palier (`confettisDesEtoiles`), et
   * chaque semaine close de ses duels, sa meilleure ligue
   * (`confettisDesLigues`) ; et, des mêmes lignes, ses paliers (`paliersDe`)
   * et sa cote (`coteDe`). Le solde relisait ses sentiers à part, et la page
   * du profil ses sentiers trois fois et ses duels deux : au dixième de cœur
   * de l'hébergeur, chaque aller-retour coûte au serveur deux millisecondes
   * de processeur, et les accueils de quatre joueurs à la fois le figeaient
   * deux secondes (le banc du 16 octobre 2026). Relus à chaque lecture.
   */
  async duProfil(profileId: string): Promise<CampagneDuProfil> {
    const tour = ++this.tourDesBordures
    const [justes, acquis, validees, duels] = await this.client.batch(
      [
        { sql: 'SELECT COALESCE(SUM(justes), 0) AS n FROM campagne_series WHERE profile_id = ?', args: [profileId] },
        ...this.lecturesDesSentiers(profileId),
        lectureDesDuels(profileId, this.maintenant()),
      ],
      'read',
    )
    const sentiers = sentiersLus(acquis.rows, validees.rows)
    const releve = this.releveLu(profileId, duels.rows, tour)
    const ligues = confettisDesLigues(releve, this.semaineDeLHeure().semaine)
    return {
      confettis: Number(justes.rows[0]?.n ?? 0) + confettisDesEtoiles(sentiers) + ligues,
      paliers: paliersCommences(sentiers),
      duels: coteDuReleve(releve),
    }
  }

  /**
   * Ses parties de campagne finies ou jouées depuis un instant, et leurs
   * réponses, de tous les modes : de quoi juger ses missions du jour
   * (`shared/missions.ts`), jour par jour. D'un aller-retour, par l'index de
   * ses séries ; une partie commencée une semaine plus tôt — une épreuve
   * laissée, reprise — compte encore ses réponses du jour (`MARGE_D_UNE_EPREUVE_MS`).
   * La catégorie est celle que la série a gardée de sa question, comme pour
   * ses écussons.
   */
  async activiteDepuis(profileId: string, depuis: number): Promise<Pick<JournauxDesJours, 'series' | 'reponses'>> {
    const commencees = depuis - MARGE_D_UNE_EPREUVE_MS
    const [series, reponses] = await this.client.batch(
      [
        {
          sql: `SELECT id, mode, issue, finie_le FROM campagne_series
                WHERE profile_id = ? AND commencee_le >= ? AND (finie_le IS NULL OR finie_le >= ?)`,
          args: [profileId, commencees, depuis],
        },
        // Une question qu'une source de l'expédition reprend du carnet paie, mais ne dit rien
        // de son savoir, comme une révision : sans catégorie, elle ne compte qu'en bonne réponse.
        {
          sql: `SELECT r.serie_id AS serie, s.mode AS mode, r.juste AS juste, r.repondue_le AS le,
                       CASE WHEN ${HORS_DU_CARNET} THEN json_extract(s.questions, '$[' || r.position || '].categorie') END AS categorie
                FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
                WHERE s.profile_id = ? AND s.commencee_le >= ? AND r.repondue_le >= ? AND r.choix IS NOT NULL
                LIMIT -1`,
          args: [profileId, commencees, depuis],
        },
      ],
      'read',
    )
    return {
      series: series.rows.map(r => ({
        id: String(r.id),
        mode: String(r.mode ?? 'serie'),
        issue: r.issue == null ? null : String(r.issue),
        finieLe: r.finie_le == null ? null : Number(r.finie_le),
      })),
      reponses: reponses.rows.map(r => ({
        serie: String(r.serie),
        mode: String(r.mode ?? 'serie'),
        juste: Number(r.juste) === 1,
        le: Number(r.le),
        categorie: r.categorie == null ? null : String(r.categorie),
      })),
    }
  }

  /**
   * Ses bonnes réponses de campagne données en portant chaque compagnon
   * (`loup` → 42) — séries, épreuves, parcours, révisions, défis et duels,
   * comme ses confettis : elles le font grandir (`shared/compagnons.ts`).
   * Les étoiles et les ligues, qui paient sans être des réponses, n'y
   * comptent pas.
   */
  async compagnonsDe(profileId: string): Promise<Record<string, number>> {
    const res = await this.client.execute({
      sql: `SELECT r.compagnon AS compagnon, COUNT(*) AS n
            FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
            WHERE s.profile_id = ? AND r.juste = 1 AND r.compagnon IS NOT NULL
            GROUP BY r.compagnon`,
      args: [profileId],
    })
    return Object.fromEntries(res.rows.map(r => [String(r.compagnon), Number(r.n)]))
  }

  /**
   * Ce que la campagne sait de lui (`Savoir`) — séries, épreuves des
   * sentiers et défis ensemble : ses questions et ses bonnes réponses,
   * catégorie par catégorie — ses écussons de savoir et « Ma carrière »,
   * avec les soirées et le quiz du jour —, et la base de sa précision. La
   * catégorie est celle que la série a gardée de sa question : une question
   * corrigée ou retirée depuis ne reprend pas ce qu'il a su ce jour-là, pas
   * plus que son expérience ou ses confettis.
   */
  async savoirDe(profileId: string): Promise<Savoir> {
    // La catégorie se lit dans la sous-requête, que `LIMIT -1` garde à part :
    // aplatie dans le regroupement, SQLite recopiait dans son tri le JSON
    // entier de la série — soixante questions — pour chacune de ses
    // réponses. Six fois plus lent pour un joueur de cinq cents séries, et
    // la carte la lit à chaque toucher sur son nom. Les révisions du carnet
    // n'y sont pas : elles reposent ce qu'il a raté, réponse lue la veille,
    // et sa précision y gagnait ce qu'il venait d'apprendre par cœur — ni ce
    // qu'une source de l'expédition reprend du carnet.
    const res = await this.client.execute({
      sql: `SELECT categorie, COUNT(*) AS questions, COUNT(choix) AS repondues, SUM(juste) AS justes
            FROM (SELECT json_extract(s.questions, '$[' || r.position || '].categorie') AS categorie, r.choix AS choix, r.juste AS juste
                  FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
                  WHERE s.profile_id = ? AND s.mode <> 'revision' AND ${HORS_DU_CARNET}
                  LIMIT -1)
            GROUP BY categorie`,
      args: [profileId],
    })
    return savoirDesLignes(res.rows)
  }

  // ── Le carnet de révision ───────────────────────────────────────────────
  //
  // Ce qu'il a raté revient le lendemain, puis trois jours après, puis une
  // semaine (`shared/revision.ts`) : retrouvé à chaque rendez-vous, c'est
  // appris. Rien ne se tient à côté : le carnet se relit dans le journal des
  // réponses, comme l'expérience. Une révision est une série d'un autre mode
  // (`mode = 'revision'`), sans vies : ses bonnes réponses paient comme en
  // série — un confetti, l'expérience d'une bonne réponse —, mais ni la
  // mesure des difficultés ni la précision ne la comptent, elle ne repose que
  // ce qu'il a raté.

  /**
   * Ce que ses réponses disent de chaque question qu'il a ratée
   * (`suiviDeLaQuestion`), lues dans l'ordre où elles sont venues. Le défi de
   * la semaine qui court et un défi entre amis ouvert n'y entrent qu'à leur
   * clôture : leur correction attend, le carnet aussi — il redonnerait leurs
   * réponses à ceux qui jouent encore.
   */
  private async suivisDe(profileId: string): Promise<Map<string, SuiviDeRevision>> {
    const res = await this.client.execute({
      sql: `WITH miennes AS (
              SELECT r.reserve_id AS id, r.juste AS juste, r.repondue_le AS le, r.serie_id AS serie, r.position AS position
              FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
              WHERE s.profile_id = ?
                AND NOT (s.mode = 'defi' AND s.semaine >= ?)
                AND NOT (s.mode = 'duel' AND s.duel IN (SELECT code FROM campagne_duels WHERE ferme_le > ?))
            )
            SELECT id, juste, le FROM miennes WHERE id IN (SELECT id FROM miennes WHERE juste = 0)
            ORDER BY le, serie, position`,
      args: [profileId, this.semaineDeLHeure().semaine, this.maintenant()],
    })
    const parQuestion = new Map<string, { le: number; juste: boolean }[]>()
    for (const r of res.rows) {
      const id = String(r.id)
      const passage = { le: Number(r.le), juste: Number(r.juste) === 1 }
      const passages = parQuestion.get(id)
      if (passages) passages.push(passage)
      else parQuestion.set(id, [passage])
    }
    const suivis = new Map<string, SuiviDeRevision>()
    for (const [id, passages] of parQuestion) {
      const suivi = suiviDeLaQuestion(passages)
      if (suivi) suivis.set(id, suivi)
    }
    return suivis
  }

  /** Sa révision laissée en route, s'il en a une : elle se reprend. */
  private async revisionEnCours(profileId: string): Promise<Serie | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'revision' AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1`,
      args: [profileId],
    })
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  /**
   * Son carnet : ce qui est à revoir aujourd'hui, ce qui revient demain et
   * plus tard, ce qu'il a appris — parmi les questions que la campagne pose
   * encore : retirée ou remplacée depuis, une question n'y est plus. Puis ce
   * qu'il tient de chaque catégorie et de chaque sujet, de quoi viser une
   * révision (`commencerRevision`).
   */
  async carnet(profileId: string): Promise<EtatDuCarnet> {
    const [suivis, jouables, ouverte] = await Promise.all([this.suivisDe(profileId), this.jouables(), this.revisionEnCours(profileId)])
    const parId = new Map(jouables.map(q => [q.id, q]))
    const aujourdhui = jourDe(this.maintenant())
    const demain = jourAvant(aujourdhui, -1)
    const carnet: EtatDuCarnet = { aRevoir: 0, demain: 0, plusTard: 0, prochainJour: null, appris: 0, enCours: ouverte ? vueDeSerie(ouverte) : null, categories: [], sujets: [] }
    const parCategorie = new Map<string, PartDuCarnet>()
    const parSujet = new Map<string, PartDuCarnet>()
    const compter = (parts: Map<string, PartDuCarnet>, cle: string, due: boolean) => {
      const part = parts.get(cle) ?? { aRevoir: 0, enTout: 0 }
      part.enTout++
      if (due) part.aRevoir++
      parts.set(cle, part)
    }
    for (const [id, s] of suivis) {
      const q = parId.get(id)
      if (!q) continue
      const due = !s.apprise && s.revientLe <= aujourdhui
      if (s.apprise) carnet.appris++
      else if (due) carnet.aRevoir++
      else {
        if (s.revientLe === demain) carnet.demain++
        else carnet.plusTard++
        if (!carnet.prochainJour || s.revientLe < carnet.prochainJour) carnet.prochainJour = s.revientLe
      }
      compter(parCategorie, q.meta.categorie, due)
      for (const sujet of sujetsDeLaQuestion(q)) compter(parSujet, sujet, due)
    }
    carnet.categories = CATEGORIES.filter(c => parCategorie.has(c)).map(categorie => ({ categorie, ...parCategorie.get(categorie)! }))
    carnet.sujets = SUJETS.filter(s => parSujet.has(s.cle)).map(s => ({ sujet: s.cle, ...parSujet.get(s.cle)! }))
    return carnet
  }

  /** Le carnet relu à la fin d'une révision ; une base qui se tait l'ôte de la réponse, pas la réponse. */
  private async carnetApres(profileId: string): Promise<EtatDuCarnet | null> {
    try {
      return await this.carnet(profileId)
    } catch (e) {
      console.error('[campagne] carnet non relu après la révision :', e)
      return null
    }
  }

  /**
   * Ce qu'il a appris, le plus récent d'abord — les cent derniers : la
   * question, sa réponse, son anecdote. Jamais ce qui reste à revoir : la
   * bonne réponse attend son rendez-vous.
   */
  async faitsAppris(profileId: string): Promise<FaitAppris[]> {
    const [suivis, jouables] = await Promise.all([this.suivisDe(profileId), this.jouables()])
    const parId = new Map(jouables.map(q => [q.id, q]))
    const faits: FaitAppris[] = []
    for (const [id, s] of suivis) {
      const q = parId.get(id)
      if (s.apprise && q) faits.push({ texte: q.texte, reponse: q.reponses[q.bonne], anecdote: q.anecdote, categorie: q.meta.categorie, le: s.le })
    }
    return faits.sort((a, b) => b.le.localeCompare(a.le)).slice(0, FAITS_MONTRES)
  }

  /**
   * Une révision : les questions dont le rendez-vous est arrivé, les plus en
   * retard d'abord, dix au plus (`QUESTIONS_PAR_REVISION`). Celle qu'il a
   * laissée en route se reprend — sauf à la recommencer (`recommencer`),
   * comme une série : elle se referme là, et ses réponses restent au carnet,
   * qui se relit dans le journal. Tout le carnet (`tout`) : puis celles qui
   * attendent leur rendez-vous, la plus proche d'abord, puis les apprises,
   * la plus anciennement apprise d'abord — « rien à revoir aujourd'hui »
   * était une impasse (le choix du 11 octobre 2026) ; revue en avance, une
   * question retrouvée garde sa place (`apresUnPassage`), ratée, elle revient
   * demain. Une série en cours, elle, attend : la révision ne la clôt pas.
   *
   * Elle vise des catégories ou un sujet (`categories`, `sujet`), comme une
   * série : seules leurs questions du carnet y entrent, et la révision les
   * garde — recommencée, elle vise ce que visait l'autre (le retour d'un
   * joueur du 14 octobre 2026 : « cibler un thème à revoir »).
   */
  commencerRevision(profileId: string, o: { tout?: boolean; recommencer?: boolean; categories?: readonly string[]; sujet?: string } = {}): Promise<SerieDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const ouverte = await this.revisionEnCours(profileId)
      if (ouverte && !o.recommencer) {
        this.garderEnCours(ouverte)
        return vueDeSerie(ouverte)
      }
      // Recommencée, elle revoit ce que revoyait l'autre : tout le carnet si l'autre le revoyait, et sur ce qu'il visait.
      const tout = !!o.tout || !!ouverte?.questions.some(q => q.enAvance)
      const sujet = ouverte ? (ouverte.sujet ?? undefined) : o.sujet
      const suivi = sujet === undefined ? undefined : sujetParCle(sujet)
      // Celle qu'on recommence suivait un sujet qui n'est plus : la neuve revoit tout le carnet, plutôt que de refuser.
      if (sujet !== undefined && !suivi && !ouverte) throw new Error('Ce sujet n’existe plus : choisis-en un autre')
      const categories = suivi ? null : lireCategories(categoriesRetenues(ouverte ? (ouverte.categories ?? undefined) : o.categories))
      const visee = (q: QuestionDeLaBase) => (suivi ? sujetsDeLaQuestion(q).includes(suivi.cle) : !categories || categories.includes(q.meta.categorie))
      const [suivis, jouables, mesure] = await Promise.all([this.suivisDe(profileId), this.jouables(), this.mesures()])
      const aujourdhui = jourDe(this.maintenant())
      const parId = new Map(jouables.map(q => [q.id, q]))
      const dues: { q: QuestionDeLaBase; etape: number; revientLe: string }[] = []
      const enRoute: { q: QuestionDeLaBase; etape: number; revientLe: string }[] = []
      const apprises: { q: QuestionDeLaBase; le: string }[] = []
      for (const [id, s] of suivis) {
        const q = parId.get(id)
        if (!q || !visee(q)) continue
        if (s.apprise) apprises.push({ q, le: s.le })
        else if (s.revientLe <= aujourdhui) dues.push({ q, etape: s.etape, revientLe: s.revientLe })
        else enRoute.push({ q, etape: s.etape, revientLe: s.revientLe })
      }
      // Battues avant d'être rangées : à rendez-vous égal, ni l'ordre de la
      // base ni celui des séries ne décide ; puis dans le désordre, pour que
      // les catégories se mêlent.
      const tirees: { q: QuestionDeLaBase; etape: number; enAvance?: EnAvance }[] = melanger(dues).sort((a, b) => a.revientLe.localeCompare(b.revientLe))
      if (tout) {
        for (const d of melanger(enRoute).sort((a, b) => a.revientLe.localeCompare(b.revientLe))) tirees.push({ ...d, enAvance: { revientLe: d.revientLe } })
        for (const a of melanger(apprises).sort((x, y) => x.le.localeCompare(y.le))) tirees.push({ q: a.q, etape: INTERVALLES_DE_REVISION.length, enAvance: { apprise: true } })
      }
      if (tirees.length === 0) {
        throw new Error(
          suivis.size === 0
            ? 'Ton carnet est vide : une question ratée t’y attendra le lendemain'
            : !suivi && !categories
              ? 'Rien à revoir aujourd’hui : reviens demain, ou revois tout ton carnet'
              : enRoute.length + apprises.length === 0
                ? 'Rien sur ce choix dans ton carnet : choisis autre chose'
                : 'Rien à revoir aujourd’hui sur ce choix : revois-le en avance, ou choisis autre chose',
        )
      }
      if (ouverte) {
        await this.client.execute({ sql: 'UPDATE campagne_series SET finie_le = ? WHERE id = ? AND finie_le IS NULL', args: [this.maintenant(), ouverte.id] })
        if (this.enCours.get(profileId)?.id === ouverte.id) this.enCours.delete(profileId)
      }
      const questions = melanger(tirees.slice(0, QUESTIONS_PAR_REVISION)).map(d => ({
        ...versQuestionDeSerie(d.q, niveauDeQuestion(d.q.meta.difficulte, mesure.get(d.q.id))),
        etape: d.etape,
        ...(d.enAvance && { enAvance: d.enAvance }),
      }))
      const serie: Serie = {
        id: randomUUID(),
        profileId,
        questions,
        index: 0,
        vies: VIES,
        justes: 0,
        finieLe: null,
        mode: 'revision',
        branche: null,
        palier: null,
        seuil: null,
        rejeu: false,
        issue: null,
        categories,
        sujet: suivi?.cle ?? null,
      }
      await this.client.execute({
        sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, categories, sujet)
              VALUES (?, ?, ?, 0, ?, 0, ?, NULL, 'revision', ?, ?)`,
        args: [serie.id, profileId, JSON.stringify(questions), VIES, this.maintenant(), categories ? JSON.stringify(categories) : null, serie.sujet ?? null],
      })
      this.garderEnCours(serie)
      return vueDeSerie(serie)
    })
  }

  /**
   * La fin d'une révision : aucun haut fait de série — elle n'en est pas
   * une —, seulement les paliers que ses bonnes réponses font atteindre (Le
   * Marathonien). Une étagère qui se tait n'y change rien : la révision est
   * rangée, et la suivante les relira.
   */
  private async recompenserLaRevision(profileId: string, serieId: string, quand: number): Promise<Recompenses> {
    try {
      return await this.recompenser(profileId, serieId, [], quand)
    } catch (e) {
      console.error('[campagne] récompenses de la révision non rangées :', e)
      return {}
    }
  }

  // ── Le défi de la semaine ───────────────────────────────────────────────
  //
  // La même série pour tous, du lundi au dimanche (`shared/campagne.ts`) :
  // une série d'un autre mode (`mode = 'defi'`, sous son lundi), dans les
  // mêmes tables — l'expérience, les confettis et les hauts faits de série
  // la comptent sans rien en savoir ; le record des séries, non. Rien ne
  // tourne le lundi à minuit : la première demande de la semaine clôt les
  // précédentes (`cloreLesDefis`), comme la nuit du quiz du jour.

  /**
   * La semaine de Paris et la précédente, gardées pour l'heure : le laurier
   * d'argent les demande pour chaque profil de chaque instantané, et minuit
   * à Paris tombe toujours sur une heure pleine du temps universel.
   */
  private semaineDeLHeure(): { semaine: string; passee: string } {
    const heure = Math.floor(this.maintenant() / HEURE_MS)
    if (this.semaineGardee?.heure !== heure) {
      const semaine = semaineDe(jourDe(heure * HEURE_MS))
      this.semaineGardee = { heure, semaine, passee: semaineAvant(semaine) }
    }
    return this.semaineGardee
  }

  /**
   * Les questions du défi d'une semaine : tirées au premier qui l'ouvre,
   * dans toute la base, marche par marche comme une série — sans « jamais
   * vues d'abord », qui ne vaut que pour un joueur —, puis figées en base :
   * une question retirée ou ajoutée en cours de semaine ne change pas la
   * série des autres. Deux serveurs qui tirent ensemble gardent le premier
   * tirage écrit. Sans assez de questions, rien ne se fige.
   */
  private tirageDuDefi(semaine: string): Promise<QuestionDeSerie[]> {
    const garde = this.tirages.get(semaine)
    if (garde) return Promise.resolve(garde)
    return this.avecVerrou('#defi', async () => {
      const deja = this.tirages.get(semaine)
      if (deja) return deja
      const lire = async () => {
        const res = await this.client.execute({ sql: 'SELECT questions FROM campagne_defis WHERE semaine = ?', args: [semaine] })
        return res.rows[0] ? (JSON.parse(String(res.rows[0].questions)) as QuestionDeSerie[]) : null
      }
      let questions = await lire()
      if (!questions) {
        const [jouables, mesure] = await Promise.all([this.jouables(), this.mesures()])
        if (jouables.length < QUESTIONS_POUR_JOUER) return []
        const tirees = this.tirage(jouables, mesure)
          .tirer()
          .map(x => versQuestionDeSerie(x.question, x.niveau))
        await this.client.execute({
          sql: 'INSERT INTO campagne_defis (semaine, questions, tire_le) VALUES (?, ?, ?) ON CONFLICT(semaine) DO NOTHING',
          args: [semaine, JSON.stringify(tirees), this.maintenant()],
        })
        questions = (await lire()) ?? tirees
      }
      this.tirages.set(semaine, questions)
      for (const k of [...this.tirages.keys()]) if (k < semaineAvant(semaine)) this.tirages.delete(k)
      return questions
    })
  }

  /** Sa tentative au défi d'une semaine, s'il l'a commencée. */
  private async tentativeDuDefi(profileId: string, semaine: string): Promise<Serie | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'defi' AND semaine = ? ORDER BY commencee_le LIMIT 1`,
      args: [profileId, semaine],
    })
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  /**
   * Relever le défi de la semaine : une seule tentative. Laissée en route,
   * elle se reprend — sans chronomètre, rien ne presse avant lundi ; finie,
   * le défi attend la semaine suivante. Une série en cours, elle, attend :
   * le défi ne la clôt pas.
   */
  commencerLeDefi(profileId: string): Promise<SerieDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const { semaine } = this.semaineDeLHeure()
      const deja = await this.tentativeDuDefi(profileId, semaine)
      if (deja?.finieLe != null) throw new Error('Tu as relevé le défi de cette semaine : le prochain ouvre lundi')
      if (deja) {
        this.garderEnCours(deja)
        return vueDeSerie(deja)
      }
      const questions = await this.tirageDuDefi(semaine)
      if (questions.length < QUESTIONS_POUR_JOUER) throw new Error('Le défi n’a pas encore de questions à poser : reviens bientôt')
      const serie: Serie = {
        id: randomUUID(),
        profileId,
        questions,
        index: 0,
        vies: VIES,
        justes: 0,
        finieLe: null,
        mode: 'defi',
        branche: null,
        palier: null,
        seuil: null,
        rejeu: false,
        issue: null,
        categories: null,
        semaine,
      }
      await this.client.execute({
        sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, semaine)
              VALUES (?, ?, ?, 0, ?, 0, ?, NULL, 'defi', ?)`,
        args: [serie.id, profileId, JSON.stringify(questions), VIES, this.maintenant(), semaine],
      })
      this.garderEnCours(serie)
      return vueDeSerie(serie)
    })
  }

  /**
   * La page du défi : sa semaine et le temps qui reste, sa tentative, le
   * classement — et la semaine passée : ses vainqueurs, qui portent le
   * laurier d'argent, et sa place à lui. La première demande de la semaine
   * clôt les précédentes.
   */
  async defi(profileId: string): Promise<DefiDeLaSemaine> {
    await this.cloreLesDefis()
    const { semaine, passee } = this.semaineDeLHeure()
    const [tentative, classement, avant, vainqueurs] = await Promise.all([
      this.tentativeDuDefi(profileId, semaine),
      this.classementDuDefi(semaine, profileId),
      this.tentativeDuDefi(profileId, passee),
      this.vainqueursDe(passee),
    ])
    let saSemainePassee: DefiDeLaSemaine['saSemainePassee']
    if (avant && avant.index > 0) {
      const place = await this.placeAuDefi(passee, profileId)
      if (place) {
        saSemainePassee = {
          serie: avant.id,
          justes: avant.justes,
          ...place,
          recompenses: vainqueurs.ids.includes(profileId) ? [tombee('hf:defi')] : [],
        }
      }
    }
    return {
      semaine,
      minutesRestantes: minutesAvantLundi(this.maintenant()),
      tentative: tentative ? vueDeSerie(tentative) : null,
      ...classement,
      vainqueurs: vainqueurs.montres,
      ...(saSemainePassee && { saSemainePassee }),
    }
  }

  /** Le classement du défi d'une semaine (`classementDesTentatives`), ouvert tant que c'est la semaine. */
  private classementDuDefi(semaine: string, pour: string | null): Promise<Pick<DefiDeLaSemaine, 'joueurs' | 'lignes' | 'moi' | 'sienne'>> {
    return this.classementDesTentatives({ mode: 'defi', semaine }, semaine === this.semaineDeLHeure().semaine, pour)
  }

  /**
   * Le classement d'un défi — de la semaine, ou entre amis : ses bonnes
   * réponses, rang partagé (invariant 15), ceux qui ont répondu à une
   * question au moins — les masqués du quiz du jour écartés, sauf pour
   * eux-mêmes. Nommé comme au quiz du jour : un homonyme y garde sa marque.
   */
  private async classementDesTentatives(
    defi: { mode: 'defi'; semaine: string } | { mode: 'duel'; code: string },
    ouverte: boolean,
    pour: string | null,
  ): Promise<Pick<DefiDeLaSemaine, 'joueurs' | 'lignes' | 'moi' | 'sienne'>> {
    const res = await this.client.execute(
      defi.mode === 'defi'
        ? { sql: `SELECT profile_id, justes, finie_le, commencee_le FROM campagne_series WHERE mode = 'defi' AND semaine = ? AND position > 0`, args: [defi.semaine] }
        : { sql: `SELECT profile_id, justes, finie_le, commencee_le FROM campagne_series WHERE mode = 'duel' AND duel = ? AND position > 0`, args: [defi.code] },
    )
    const profils = this.profils ? await this.profils.byIds(res.rows.map(r => String(r.profile_id))) : []
    const joueurs: { profil: ProfileRec; justes: number; enCours: boolean; commenceeLe: number }[] = []
    res.rows.forEach((r, i) => {
      const profil = profils[i]
      if (!profil || (this.masque?.(profil.id) && profil.id !== pour)) return
      joueurs.push({ profil, justes: Number(r.justes), enCours: ouverte && r.finie_le === null, commenceeLe: Number(r.commencee_le) })
    })
    const p = this.profils
    if (!p) return { joueurs: 0, lignes: [] }
    const arrivee = [...joueurs].sort((a, b) => a.commenceeLe - b.commenceeLe || a.profil.id.localeCompare(b.profil.id))
    const marques = nomsAffiches(arrivee.map(j => ({ id: j.profil.id, name: j.profil.name, avatar: p.avatarPorte(j.profil), legendaire: p.legendairePorte(j.profil) })))
    const nom = (j: (typeof joueurs)[number]) => marques.get(j.profil.id) ?? j.profil.name
    const classes = classer(joueurs, j => j.justes, nom, j => j.profil.id)
    const ligne = ({ item: j, rang }: (typeof classes)[number]): LigneDuDefi => {
      const { niveau, finition, eclat, legendaire, laurier } = p.apparenceDe(j.profil)
      // Sa bordure de ligue, de mémoire : le classement ne l'attend pas.
      const bordure = p.bordureDe?.(j.profil, legendaire)
      return {
        profileId: j.profil.id,
        nom: nom(j),
        avatar: p.avatarPorte(j.profil),
        niveau,
        finition,
        ...(legendaire && { legendaire }),
        ...(eclat && { eclat: true as const }),
        ...(laurier && { laurier }),
        ...(bordure && { bordure }),
        justes: j.justes,
        rang,
        ...(j.enCours && { enCours: true as const }),
      }
    }
    const montrees = classes.slice(0, LIGNES_DU_DEFI)
    const sienne = pour ? classes.find(c => c.item.profil.id === pour) : undefined
    return {
      joueurs: joueurs.length,
      lignes: montrees.map(ligne),
      ...(sienne && !montrees.includes(sienne) && { moi: ligne(sienne) }),
      ...(sienne && { sienne: sienne.item.profil.id }),
    }
  }

  /** Sa place au défi d'une semaine, s'il y a répondu : ce que la fin de sa tentative lui dit. */
  private async placeAuDefi(semaine: string, profileId: string): Promise<{ rang: number; joueurs: number } | null> {
    const c = await this.classementDuDefi(semaine, profileId)
    const sienne = c.moi ?? c.lignes.find(l => l.profileId === profileId)
    return sienne ? { rang: sienne.rang, joueurs: c.joueurs } : null
  }

  /** Les vainqueurs d'une semaine close : leurs identifiants, et ce que la page en montre. */
  private async vainqueursDe(semaine: string): Promise<{ ids: string[]; montres: DefiDeLaSemaine['vainqueurs'] }> {
    const res = await this.client.execute({ sql: 'SELECT vainqueurs FROM campagne_defis WHERE semaine = ? AND clos_le IS NOT NULL', args: [semaine] })
    const ids = lireVainqueurs(res.rows[0]?.vainqueurs).filter(id => !this.masque?.(id))
    const profils = ids.length > 0 && this.profils ? await this.profils.byIds(ids) : []
    return {
      ids,
      montres: profils.flatMap(p => (p ? [{ nom: p.name, avatar: this.profils!.avatarPorte(p), ...sonApparence(this.profils!, p) }] : [])),
    }
  }

  /**
   * Clôt les défis des semaines passées qui ne le sont pas encore : leurs
   * premiers — tous les ex æquo, à deux joueurs au moins, une bonne réponse
   * au moins — reçoivent le Vainqueur du défi, rangé sous la semaine ; les
   * tentatives laissées en route s'arrêtent là. Puis relit les vainqueurs de
   * la semaine passée, qui portent le laurier d'argent. Une fois par semaine
   * et par serveur ; rejouée, elle ne range rien deux fois.
   */
  async cloreLesDefis(): Promise<void> {
    const { semaine, passee } = this.semaineDeLHeure()
    const faite = () => this.closAvant === semaine && this.argent.semaine === passee
    if (faite()) return
    await this.avecVerrou('#defi-cloture', async () => {
      if (faite()) return
      const ouvertes = await this.client.execute({ sql: 'SELECT semaine FROM campagne_defis WHERE clos_le IS NULL AND semaine < ? ORDER BY semaine', args: [semaine] })
      for (const r of ouvertes.rows) await this.cloreLeDefi(String(r.semaine))
      await this.lireLArgent(passee)
      this.closAvant = semaine
    })
  }

  private async cloreLeDefi(semaine: string): Promise<void> {
    const res = await this.client.execute({
      sql: `SELECT profile_id, justes FROM campagne_series WHERE mode = 'defi' AND semaine = ? AND position > 0`,
      args: [semaine],
    })
    const joueurs = res.rows.map(r => ({ id: String(r.profile_id), justes: Number(r.justes) })).filter(j => !this.masque?.(j.id))
    const classes = classer(joueurs, j => j.justes, j => j.id, j => j.id)
    const vainqueurs = joueurs.length >= JOUEURS_POUR_LE_DEFI ? classes.filter(c => c.rang === 1 && c.item.justes > 0).map(c => c.item.id) : []
    const maintenant = this.maintenant()
    for (const id of vainqueurs) await this.recompenses?.ranger(id, cleDuDefi(semaine), ['hf:defi'], maintenant)
    await this.client.batch(
      [
        { sql: `UPDATE campagne_series SET finie_le = ? WHERE mode = 'defi' AND semaine = ? AND finie_le IS NULL`, args: [maintenant, semaine] },
        { sql: 'UPDATE campagne_defis SET clos_le = ?, vainqueurs = ? WHERE semaine = ? AND clos_le IS NULL', args: [maintenant, JSON.stringify(vainqueurs), semaine] },
      ],
      'write',
    )
    for (const s of this.enCours.values()) if (s.mode === 'defi' && s.semaine === semaine) this.enCours.delete(s.profileId)
    console.log(`[campagne] défi du ${semaine} clos : ${joueurs.length} joueur${joueurs.length > 1 ? 's' : ''}, ${vainqueurs.length} vainqueur${vainqueurs.length > 1 ? 's' : ''}`)
  }

  /** Relit les vainqueurs de la semaine passée, et rediffuse la salle de ceux dont le laurier d'argent change. */
  private async lireLArgent(semaine: string): Promise<void> {
    const { ids } = await this.vainqueursDe(semaine)
    const avant = this.argent
    const neufs = new Set(ids)
    this.argent = { semaine, ids: neufs }
    for (const id of new Set([...neufs, ...avant.ids])) if (avant.semaine !== semaine || avant.ids.has(id) !== neufs.has(id)) this.laurierChange?.(id)
  }

  // ── Le défi entre amis ──────────────────────────────────────────────────
  //
  // Le défi de la semaine, contre qui l'on veut (`shared/campagne.ts`) : un
  // tirage figé sous un code, que son lien donne ; chacun le joue une fois,
  // dans la semaine, comme une série d'un autre mode (`mode = 'duel'`) —
  // l'expérience, les confettis et les hauts faits de série la comptent, le
  // record des séries non. Ni laurier ni haut fait à lui : on gagnerait à se
  // défier soi-même d'un second profil. Rien ne tourne à sa fermeture : la
  // première lecture d'après fige ce qui restait en route (`fermerLeDuel`).

  /** Un défi entre amis par son code, lu une fois. */
  private async duelDe(code: string | null | undefined): Promise<Duel | null> {
    if (!code) return null
    const garde = this.duels.get(code)
    if (garde) return garde
    const res = await this.client.execute({ sql: 'SELECT * FROM campagne_duels WHERE code = ?', args: [code] })
    const r = res.rows[0]
    if (!r) return null
    const duel: Duel = {
      code,
      auteur: String(r.auteur),
      questions: JSON.parse(String(r.questions)) as QuestionDeSerie[],
      categories: lireCategories(r.categories),
      sujet: typeof r.sujet === 'string' ? r.sujet : null,
      creeLe: Number(r.cree_le),
      fermeLe: Number(r.ferme_le),
      closLe: r.clos_le === null || r.clos_le === undefined ? null : Number(r.clos_le),
      adversaire: typeof r.adversaire === 'string' && r.adversaire ? r.adversaire : null,
      coteAuteur: r.cote_auteur === null || r.cote_auteur === undefined ? null : Number(r.cote_auteur),
      coteAdversaire: r.cote_adversaire === null || r.cote_adversaire === undefined ? null : Number(r.cote_adversaire),
      vuLe: r.vu_le === null || r.vu_le === undefined ? null : Number(r.vu_le),
    }
    this.duels.set(code, duel)
    if (this.duels.size > SERIES_GARDEES) this.duels.delete(this.duels.keys().next().value!)
    return duel
  }

  /** Peut-il y jouer, le voir ? Un défi entre amis, qui a son code ; un duel classé, ses deux joueurs seulement. */
  private dansLeDuel(duel: Duel, profileId: string): boolean {
    return !duel.adversaire || duel.auteur === profileId || duel.adversaire === profileId
  }

  /** Ce défi a-t-il fermé ? Inconnu, il l'est : rien ne s'y joue plus. */
  private async duelFerme(code: string | null | undefined): Promise<boolean> {
    const d = await this.duelDe(code)
    return !d || this.maintenant() >= d.fermeLe
  }

  /**
   * Le score à battre d'un duel classé, pour celui qu'on a défié : il ne le
   * reçoit qu'à la dernière réponse de qui l'a lancé, ce score est donc fini,
   * et gardé — il ne change plus. Pour qui l'a lancé, rien : il joue le
   * premier, sans score à battre.
   */
  private async scoreABattre(s: Serie): Promise<number | null> {
    if (s.mode !== 'duel') return null
    const duel = await this.duelDe(s.duel)
    if (!duel?.adversaire || duel.adversaire !== s.profileId) return null
    const garde = this.scoresABattre.get(duel.code)
    if (garde !== undefined) return garde
    const t = await this.tentativeDuDuel(duel.auteur, duel.code)
    if (t?.finieLe == null) return null
    this.scoresABattre.set(duel.code, t.justes)
    if (this.scoresABattre.size > SERIES_GARDEES) this.scoresABattre.delete(this.scoresABattre.keys().next().value!)
    return t.justes
  }

  /** Un duel classé joué jusqu'au bout par ses deux joueurs : il n'a plus rien à cacher. */
  private async joueDesDeuxCotes(code: string | null | undefined): Promise<boolean> {
    const d = await this.duelDe(code)
    if (!d?.adversaire) return false
    const [a, b] = await Promise.all([this.tentativeDuDuel(d.auteur, d.code), this.tentativeDuDuel(d.adversaire, d.code)])
    return a?.finieLe != null && b?.finieLe != null
  }

  /**
   * Celui d'en face, à un duel classé qu'il vient de finir le second : son
   * prénom, son avatar et son score — sa fin dit qui l'a gagné, comme celle
   * d'une rencontre. Masqué, « Un joueur », sans son profil : on ne le
   * retrouve pas pour une revanche.
   */
  private async enFaceDuDuel(duel: Duel, profileId: string): Promise<(Adversaire & { profileId?: string }) | null> {
    const autre = profileId === duel.auteur ? duel.adversaire : duel.auteur
    if (!autre) return null
    const [[p], t] = await Promise.all([this.profils ? this.profils.byIds([autre]) : Promise.resolve([null]), this.tentativeDuDuel(autre, duel.code)])
    if (!t) return null
    const nomme = p && this.profils && !this.masque?.(p.id)
    // Ce qu'il porte avec : son légendaire sur la carte du verdict, pas l'emoji d'en dessous.
    return nomme
      ? { nom: p.name, avatar: this.profils!.avatarPorte(p), ...sonApparence(this.profils!, p), justes: t.justes, profileId: p.id }
      : { nom: 'Un joueur', avatar: '🎲', justes: t.justes }
  }

  /** Sa tentative à un défi entre amis, s'il l'a commencée. */
  private async tentativeDuDuel(profileId: string, code: string): Promise<Serie | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'duel' AND duel = ? ORDER BY commencee_le LIMIT 1`,
      args: [profileId, code],
    })
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  /** Sa tentative neuve à un défi entre amis : son tirage, ses catégories ou son sujet — les hauts faits de série les lisent. */
  private async releverLeDuel(profileId: string, duel: Duel, lot: InStatement[] = []): Promise<Serie> {
    const serie: Serie = {
      id: randomUUID(),
      profileId,
      questions: duel.questions,
      index: 0,
      vies: VIES,
      justes: 0,
      finieLe: null,
      mode: 'duel',
      branche: null,
      palier: null,
      seuil: null,
      rejeu: false,
      issue: null,
      categories: duel.categories,
      sujet: duel.sujet,
      duel: duel.code,
    }
    await this.client.batch(
      [
        ...lot,
        {
          sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, categories, sujet, duel)
                VALUES (?, ?, ?, 0, ?, 0, ?, NULL, 'duel', ?, ?, ?)`,
          args: [serie.id, profileId, JSON.stringify(duel.questions), VIES, this.maintenant(), duel.categories ? JSON.stringify(duel.categories) : null, duel.sujet, duel.code],
        },
      ],
      'write',
    )
    this.garderEnCours(serie)
    return serie
  }

  /**
   * Qui il défie en duel classé : un profil qui existe — ni lui-même, ni un
   * masqué, qui se dit introuvable comme un inconnu —, et un seul duel ouvert
   * entre eux deux : un second le relancerait avant que l'autre ait joué le
   * premier, ou passerait devant celui qu'on lui a envoyé.
   */
  private async adversaireDuDuel(profileId: string, id: string): Promise<string> {
    if (id === profileId) throw new Error('Tu ne peux pas te défier toi-même : choisis quelqu’un d’autre')
    const [lui] = this.profils ? await this.profils.byIds([id]) : [null]
    if (!lui || this.masque?.(lui.id)) throw new Error('Ce joueur est introuvable : cherche-le de nouveau')
    const ouvert = await this.duelOuvertEntre(profileId, lui.id)
    if (ouvert) throw new Error(REFUS_D_UN_SECOND_DUEL[ouvert.ou](lui.name))
    return lui.id
  }

  /**
   * Le duel classé ouvert entre eux deux — pas encore joué des deux côtés —,
   * s'il y en a un, et où il en est pour lui (`OuEnEstLeDuel`). Une seule
   * règle pour le refus d'un second (`adversaireDuDuel`) et pour la carte de
   * l'autre, qui le dit à la place de « Défier » (`faceAFace`) : elle
   * proposait de défier qui l'on défiait déjà, et le refus ne tombait qu'au
   * bout de la préparation (le retour du propriétaire du 15 octobre 2026).
   * Deux défis lancés de part et d'autre au même instant passent chacun sous
   * le verrou de son auteur : le plus ancien parle.
   */
  private async duelOuvertEntre(profileId: string, autre: string): Promise<DuelOuvert | null> {
    const ouvert = await this.client.execute({
      // Et de quoi dire où il en est : reçu, joué par qui l'a lancé.
      sql: `SELECT d.code, d.auteur,
              EXISTS (SELECT 1 FROM campagne_envois e WHERE e.code = d.code AND e.profile_id = ?) AS recu,
              EXISTS (SELECT 1 FROM campagne_series s WHERE s.mode = 'duel' AND s.duel = d.code AND s.profile_id = d.auteur AND s.finie_le IS NOT NULL) AS joue
            FROM campagne_duels d
            WHERE d.ferme_le > ? AND ((d.auteur = ? AND d.adversaire = ?) OR (d.auteur = ? AND d.adversaire = ?))
              AND (SELECT COUNT(*) FROM campagne_series s WHERE s.mode = 'duel' AND s.duel = d.code AND s.finie_le IS NOT NULL AND s.profile_id IN (d.auteur, d.adversaire)) < 2
            ORDER BY d.cree_le, d.code
            LIMIT 1`,
      args: [profileId, this.maintenant(), profileId, autre, autre, profileId],
    })
    const r = ouvert.rows[0]
    if (!r) return null
    const joue = Number(r.joue) === 1
    if (String(r.auteur) === profileId) return { ou: joue ? 'chez-l-autre' : 'a-finir', code: String(r.code) }
    if (Number(r.recu) === 1) return { ou: 'a-relever', code: String(r.code) }
    // Pas encore parti, ou retenu — il l'avait retiré de ses amis (`aRetire`) : il n'est pas encore à lui, son code non plus.
    return { ou: joue ? 'retenu' : 'a-venir' }
  }

  /**
   * L'a-t-il retiré de ses amis, sans l'avoir ajouté ni joué avec lui depuis ?
   * Ses duels ne lui parviennent plus — sans que l'autre l'apprenne : il
   * attend comme on attend quelqu'un qui ne joue pas.
   */
  private async aRetire(profileId: string, ami: string): Promise<boolean> {
    const res = await this.client.execute({
      sql: `SELECT r.retire_le,
              (SELECT MAX(ajoute_le) FROM campagne_amis_ajoutes WHERE profile_id = r.profile_id AND ami = r.ami) AS ajoute_le,
              (SELECT MAX(s.commencee_le) FROM campagne_series s JOIN campagne_duels d ON d.code = s.duel
                WHERE s.mode = 'duel' AND ((s.profile_id = r.profile_id AND d.auteur = r.ami) OR (s.profile_id = r.ami AND d.auteur = r.profile_id))) AS joue_le
            FROM campagne_amis_retires r WHERE r.profile_id = ? AND r.ami = ?`,
      args: [profileId, ami],
    })
    const r = res.rows[0]
    if (!r) return false
    const depuis = Math.max(Number(r.ajoute_le ?? -Infinity), Number(r.joue_le ?? -Infinity))
    return Number(r.retire_le) >= depuis
  }

  /**
   * Lancer un défi entre amis : un tirage sur ses catégories ou son sujet,
   * marche par marche comme une série — sans « jamais vues d'abord », qui ne
   * vaut que pour lui —, figé sous un code neuf ; et sa propre tentative,
   * qui commence là. Une série en cours, elle, attend. Pas plus de
   * `DUELS_OUVERTS_MAX` défis entre amis ouverts à la fois ; un duel classé
   * n'a pas de plafond, un seul ouvert par adversaire (`adversaireDuDuel`).
   * Les amis choisis (`amis`) — les siens seulement : un identifiant qui n'en
   * est pas un ne reçoit rien, sans qu'il l'apprenne — l'attendent à sa
   * dernière réponse (`campagne_envois_prevus`, `envoyerLesPrevus`).
   */
  creerUnDuel(
    profileId: string,
    categories?: readonly string[],
    sujet?: string,
    amis?: unknown,
    adversaire?: unknown,
  ): Promise<{ code: string; serie: SerieDeCampagne; enjeu?: EnjeuDuDuel }> {
    return this.avecVerrou(profileId, async () => {
      const maintenant = this.maintenant()
      // Un duel classé n'a pas de plafond : un seul ouvert par adversaire
      // (`adversaireDuDuel`) — cinq qui attendaient bloquaient le sixième, et le
      // propriétaire veut « autant de défis en cours que possible » (le
      // 13 octobre 2026). Un défi entre amis d'avant garde le sien.
      if (typeof adversaire !== 'string' || !adversaire) {
        const ouverts = await this.client.execute({
          sql: 'SELECT COUNT(*) AS n FROM campagne_duels WHERE auteur = ? AND ferme_le > ? AND adversaire IS NULL',
          args: [profileId, maintenant],
        })
        if (Number(ouverts.rows[0]?.n ?? 0) >= DUELS_OUVERTS_MAX) throw new Error(`Tu as déjà ${DUELS_OUVERTS_MAX} duels qui attendent d’être joués : attends que l’un d’eux le soit, ou qu’il ferme`)
      }
      const suivi = sujet === undefined ? undefined : sujetParCle(sujet)
      if (sujet !== undefined && !suivi) throw new Error('Ce sujet n’existe plus : choisis-en un autre')
      // Un duel classé contre quelqu'un : lui seul l'attend, à sa dernière réponse.
      const contre = typeof adversaire === 'string' && adversaire ? await this.adversaireDuDuel(profileId, adversaire) : null
      const voulus = contre ? new Set<string>() : idsVoulus(amis)
      const [toutes, mesure, sesAmis, cotes, vues] = await Promise.all([
        this.jouables(suivi ? undefined : categories),
        this.mesures(),
        voulus.size > 0 ? this.idsDesAmis(profileId) : Promise.resolve([]),
        // Les deux cotes au lancement : chacun bougera contre celle de l'autre.
        contre ? Promise.all([this.releveDesDuels(profileId), this.releveDesDuels(contre)]) : null,
        // Ce que l'un et l'autre ont vu : tiré pour personne, le duel reposait à
        // son auteur la question vue dix minutes plus tôt dans son épreuve
        // (l'experte du jeu solo, le 11 octobre 2026).
        Promise.all([this.vuesPar(profileId), contre ? this.vuesPar(contre) : new Map<string, number>()]).then(([a, b]) => {
          for (const [id, le] of b) if (le > (a.get(id) ?? -Infinity)) a.set(id, le)
          return a
        }),
      ])
      const prevus = contre ? [contre] : sesAmis.filter(id => voulus.has(id))
      const jouables = suivi ? this.duSujet(toutes, suivi.cle) : toutes
      if (jouables.length < QUESTIONS_POUR_JOUER) {
        throw new Error(suivi ? 'Pas assez de questions sur ce sujet pour l’instant : choisis-en un autre' : 'Pas assez de questions pour ce défi : choisis d’autres catégories')
      }
      const questions = this.tirage(jouables, mesure)
        .tirer(vues, maintenant)
        .map(x => versQuestionDeSerie(x.question, x.niveau))
      const retenues = suivi ? null : lireCategories(categoriesRetenues(categories))
      for (let essai = 0; ; essai++) {
        const duel: Duel = {
          code: nouveauCode(),
          auteur: profileId,
          questions,
          categories: retenues,
          sujet: suivi?.cle ?? null,
          creeLe: maintenant,
          fermeLe: maintenant + DUREE_D_UN_DUEL_MS,
          closLe: null,
          adversaire: contre,
          coteAuteur: cotes ? cotes[0].cote : null,
          coteAdversaire: cotes ? cotes[1].cote : null,
          vuLe: null,
        }
        try {
          // Le défi, ses amis choisis et sa première tentative dans le même lot : l'un ne va pas sans l'autre.
          const serie = await this.releverLeDuel(profileId, duel, [
            {
              // Les deux cotes de chacun, figées : celle qu'on voit, contre laquelle bouge celle
              // de l'autre ; la cachée, contre laquelle bouge sa cachée (la montée, `shared/duels.ts`).
              sql: `INSERT INTO campagne_duels (code, auteur, questions, categories, sujet, cree_le, ferme_le, adversaire, cote_auteur, cote_adversaire,
                                                cote_cachee_auteur, cote_cachee_adversaire)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                duel.code,
                profileId,
                JSON.stringify(questions),
                retenues ? JSON.stringify(retenues) : null,
                duel.sujet,
                maintenant,
                duel.fermeLe,
                duel.adversaire,
                duel.coteAuteur,
                duel.coteAdversaire,
                cotes ? cotes[0].cachee : null,
                cotes ? cotes[1].cachee : null,
              ],
            },
            ...prevus.map(id => ({ sql: 'INSERT INTO campagne_envois_prevus (code, profile_id) VALUES (?, ?)', args: [duel.code, id] })),
          ])
          this.duels.set(duel.code, duel)
          // Ce qu'il met en jeu, que sa partie redit à chaque question : contre la cote d'en face, figée ici — lui l'a lancé.
          return { code: duel.code, serie: vueDeSerie(serie), ...(cotes && { enjeu: enjeuContre(cotes[0], cotes[1].cote, true) }) }
        } catch (e) {
          // Un code déjà pris — une chance sur des centaines de millions — : on en tire un autre, une fois.
          if (essai > 0 || !String((e as Error).message).includes('UNIQUE')) throw e
        }
      }
    })
  }

  /**
   * Relever un défi entre amis : une seule tentative. Laissée en route, elle
   * se reprend ; finie, le défi attend les autres. Fermé, il ne se joue plus.
   */
  releverUnDuel(profileId: string, brut: unknown): Promise<SerieDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const duel = await this.duelDe(lireCodeDuDuel(brut))
      // Un duel classé ne se joue qu'à deux : pour un troisième, il n'existe pas.
      if (!duel || !this.dansLeDuel(duel, profileId)) throw new Error('Ce défi est introuvable : vérifie son lien')
      if (this.maintenant() >= duel.fermeLe) throw new Error('Ce défi est fermé : son classement est figé')
      const deja = await this.tentativeDuDuel(profileId, duel.code)
      if (deja?.finieLe != null) throw new Error('Tu as relevé ce défi : son classement t’attend')
      if (deja) {
        this.garderEnCours(deja)
        return vueDeSerie(deja)
      }
      return vueDeSerie(await this.releverLeDuel(profileId, duel))
    })
  }

  /**
   * Fermé, un défi fige une fois ce qui restait en route : la correction de
   * chacun s'ouvre, et la page ne dit plus « en cours ».
   */
  private async fermerLeDuel(duel: Duel): Promise<void> {
    if (duel.closLe !== null || this.maintenant() < duel.fermeLe) return
    await this.client.batch(
      [
        { sql: `UPDATE campagne_series SET finie_le = ? WHERE mode = 'duel' AND duel = ? AND finie_le IS NULL`, args: [duel.fermeLe, duel.code] },
        { sql: 'UPDATE campagne_duels SET clos_le = ? WHERE code = ? AND clos_le IS NULL', args: [this.maintenant(), duel.code] },
      ],
      'write',
    )
    duel.closLe = this.maintenant()
    for (const s of [...this.enCours.values()]) if (s.mode === 'duel' && s.duel === duel.code) this.enCours.delete(s.profileId)
  }

  /** La page d'un défi entre amis : qui l'a lancé, ce qu'il fait jouer, le temps qui reste, sa tentative et le classement. */
  async duel(profileId: string, brut: unknown): Promise<DuelEntreAmis> {
    const duel = await this.duelDe(lireCodeDuDuel(brut))
    if (!duel || !this.dansLeDuel(duel, profileId)) throw new Error('Ce défi est introuvable : vérifie son lien')
    await this.fermerLeDuel(duel)
    const ouvert = this.maintenant() < duel.fermeLe
    const autre = duel.adversaire ? (duel.auteur === profileId ? duel.adversaire : duel.auteur) : null
    const [tentative, classement, [auteur, defie], releve, enFace, cotes] = await Promise.all([
      this.tentativeDuDuel(profileId, duel.code),
      this.classementDesTentatives({ mode: 'duel', code: duel.code }, ouvert, profileId),
      this.profils ? this.profils.byIds(duel.adversaire ? [duel.auteur, duel.adversaire] : [duel.auteur]) : Promise.resolve([null, null]),
      // Un duel classé joué des deux côtés : ce qu'il a fait à sa cote.
      duel.adversaire ? this.releveDesDuels(profileId) : null,
      // Et le score d'en face, à battre, une fois qu'il l'a joué.
      autre ? this.tentativeDuDuel(autre, duel.code) : null,
      // Les cotes de tous, gardées : la ligue de chacun des deux.
      duel.adversaire ? this.toutesLesCotes() : null,
    ])
    // Sa ligue, s'il a fini un duel classé — l'anneau de son avatar et le bord
    // de sa carte en prennent la couleur ; rien sinon : l'absence, pas une
    // ligue de bronze.
    const saLigue = (id: string) => {
      const r = cotes?.get(id)
      return r && r.joues > 0 ? { ligue: ligueDe(r.cote).cle } : null
    }
    // Masqué au quiz du jour, l'auteur ne se nomme pas plus ici, sauf à lui-même.
    const nomme = auteur && (!this.masque?.(auteur.id) || auteur.id === profileId)
    const ecart = releve && tentative ? releve.ecarts.get(tentative.id)?.ecart : undefined
    // Pas encore joué jusqu'au bout : ce qu'il met en jeu, contre la cote d'en face figée au lancement — on sait pour quoi on joue —,
    // et la part de qui l'a lancé.
    const coteDEnFace = duel.auteur === profileId ? duel.coteAdversaire : duel.coteAuteur
    const enjeu = releve && ouvert && tentative?.finieLe == null && coteDEnFace !== null ? enjeuContre(releve, coteDEnFace, duel.auteur === profileId) : null
    const defieNomme = defie && (!this.masque?.(defie.id) || defie.id === profileId)
    const contre =
      duel.adversaire && defie !== undefined
        ? {
            nom: defieNomme ? defie.name : 'Un joueur',
            avatar: defie && this.profils ? this.profils.avatarPorte(defie) : '🎲',
            ...(duel.adversaire === profileId && { toi: true as const }),
            ...(defieNomme && saLigue(defie.id)),
            // Ce qu'il porte : son légendaire sur sa carte, pas l'emoji d'en dessous. Sans sa bordure : l'anneau
            // de sa ligue la dit déjà, et la page ne la montre pas.
            ...(defieNomme && this.profils && sonApparence(this.profils, defie)),
          }
        : null
    // Le sien, ouvert : à qui il partira à sa dernière réponse — ou, joué
    // jusqu'au bout et resté en route (un envoi raté), il part maintenant.
    let prevus: string[] = []
    if (duel.auteur === profileId && ouvert) {
      if (tentative?.finieLe != null) await this.partirAuxPrevus(profileId, duel.code)
      else prevus = await this.prenomsDesPrevus(duel.code)
    }
    // Le score d'en face d'un duel classé ne part qu'une fois sa propre
    // tentative finie, ou le duel fermé — la ligne du score non plus : on le
    // voyait avant même de jouer (le souhait du propriétaire du 12 octobre
    // 2026). Sa carte se retourne à sa dernière réponse.
    const cache = !!duel.adversaire && ouvert && tentative?.finieLe == null
    // Joué des deux côtés : sa cote juste après ce duel, sa ligue, et sa place aujourd'hui.
    const sonEcart = ecart !== undefined && tentative ? releve?.ecarts.get(tentative.id) : undefined
    const rang = sonEcart ? await this.rangAuxDuels(profileId) : undefined
    // Vu pour la première fois par qui l'a lancé : sa page retourne la carte du verdict, l'accueil ne le compte plus.
    const nouveau = !!duel.adversaire && duel.auteur === profileId && ecart !== undefined && duel.vuLe === null
    if (nouveau) await this.retenirLeResultatVu(duel)
    // La revanche, contre celui d'en face : jamais un masqué, ni un profil parti.
    const enFaceDeLui = duel.auteur === profileId ? defie : auteur
    // Avec ce qu'il porte : la préparation de la revanche le montrait en emoji.
    const revanche =
      sonEcart && enFaceDeLui && !this.masque?.(enFaceDeLui.id) && this.profils
        ? { profileId: enFaceDeLui.id, nom: enFaceDeLui.name, avatar: this.profils.avatarPorte(enFaceDeLui), ...sonApparence(this.profils, enFaceDeLui) }
        : null
    return {
      code: duel.code,
      auteur: {
        nom: nomme ? auteur.name : 'Un joueur',
        avatar: nomme && this.profils ? this.profils.avatarPorte(auteur) : '🎲',
        ...(duel.auteur === profileId && { toi: true as const }),
        ...(nomme && saLigue(auteur.id)),
        ...(nomme && this.profils && sonApparence(this.profils, auteur)),
      },
      ...(duel.sujet && { sujet: duel.sujet }),
      ...(duel.categories && duel.categories.length > 0 && { categories: duel.categories }),
      minutesRestantes: ouvert ? Math.max(1, Math.ceil((duel.fermeLe - this.maintenant()) / 60_000)) : 0,
      tentative: tentative ? vueDeSerie(tentative) : null,
      ...(prevus.length > 0 && { prevus }),
      ...(contre && { contre }),
      ...(ecart !== undefined && { ecart }),
      ...(enjeu && { enjeu }),
      ...(enFace?.finieLe != null && !cache && { aBattre: enFace.justes }),
      // Ouvert, un duel classé ne compte qu'une fois joué des deux côtés : son écart dit qu'il l'est.
      ...(contre && ouvert && ecart !== undefined && { corrige: true as const }),
      ...(nouveau && { nouveau: true as const }),
      ...(sonEcart &&
        releve && {
          apres: {
            cote: sonEcart.avant + sonEcart.ecart,
            ligue: ligueDe(sonEcart.avant + sonEcart.ecart).cle,
            ...(rang !== undefined && { rang }),
            // Sa semaine, que la carte du verdict dit en losanges sous elle.
            semaine: this.semaineDesDuels(releve),
          },
        }),
      ...(revanche && { revanche }),
      ...classement,
      ...(cache && { lignes: classement.lignes.filter(l => l.profileId === profileId), moi: undefined }),
    }
  }

  /**
   * Qui a lancé ce duel vient de voir son résultat : l'accueil ne le compte
   * plus. La première lecture l'écrit ; une base qui hoquette ne lui coûte
   * pas sa page — le résultat se redira nouveau à la suivante.
   */
  private async retenirLeResultatVu(duel: Duel): Promise<void> {
    const maintenant = this.maintenant()
    try {
      await this.client.execute({ sql: 'UPDATE campagne_duels SET vu_le = ? WHERE code = ? AND vu_le IS NULL', args: [maintenant, duel.code] })
      duel.vuLe = maintenant
    } catch (e) {
      console.warn('[campagne] le résultat vu d’un duel n’est pas retenu :', e instanceof Error ? e.message : e)
    }
  }

  /** Sa place à un défi entre amis, s'il y a répondu : ce que la fin de sa tentative lui dit. */
  private async placeAuDuel(code: string, profileId: string): Promise<{ rang: number; joueurs: number } | null> {
    const c = await this.classementDesTentatives({ mode: 'duel', code }, true, profileId)
    const sienne = c.moi ?? c.lignes.find(l => l.profileId === profileId)
    return sienne ? { rang: sienne.rang, joueurs: c.joueurs } : null
  }

  /**
   * Ses défis entre amis — lancés ou relevés — des trente derniers jours, les
   * plus récents d'abord : un lien perdu ne perd pas le défi. Leurs scores
   * d'un seul aller-retour, classés comme leur page les classe.
   */
  async mesDuels(profileId: string): Promise<ResumeDuDuel[]> {
    const depuis = this.maintenant() - 30 * 24 * HEURE_MS
    const res = await this.client.execute({
      // Les duels classés ont leur liste à eux (`duelsContre`).
      sql: `SELECT code FROM campagne_duels
            WHERE ferme_le > ? AND adversaire IS NULL AND (auteur = ? OR code IN (SELECT duel FROM campagne_series WHERE profile_id = ? AND mode = 'duel'))
            ORDER BY cree_le DESC LIMIT ?`,
      args: [depuis, profileId, profileId, DUELS_MONTRES],
    })
    const duels = (await Promise.all(res.rows.map(r => this.duelDe(String(r.code))))).filter((d): d is Duel => d !== null)
    if (duels.length === 0) return []
    const tentatives = await this.client.execute({
      sql: `SELECT duel, profile_id, justes FROM campagne_series WHERE mode = 'duel' AND position > 0 AND duel IN (${duels.map(() => '?').join(', ')})`,
      args: duels.map(d => d.code),
    })
    const auteurs = this.profils ? await this.profils.byIds(duels.map(d => d.auteur)) : []
    return duels.map((d, i) => {
      const joueurs = tentatives.rows
        .filter(r => String(r.duel) === d.code)
        .map(r => ({ id: String(r.profile_id), justes: Number(r.justes) }))
        .filter(j => !this.masque?.(j.id) || j.id === profileId)
      const sienne = classer(joueurs, j => j.justes, j => j.id, j => j.id).find(c => c.item.id === profileId)
      const auteur = auteurs[i]
      return {
        code: d.code,
        auteur: d.auteur === profileId ? 'toi' : auteur && !this.masque?.(auteur.id) ? auteur.name : 'Un joueur',
        ...(d.sujet && { sujet: d.sujet }),
        ...(d.categories && d.categories.length > 0 && { categories: d.categories }),
        joueurs: joueurs.length,
        justes: sienne ? sienne.item.justes : null,
        rang: sienne ? sienne.rang : null,
        minutesRestantes: Math.max(0, Math.ceil((d.fermeLe - this.maintenant()) / 60_000)),
      }
    })
  }

  // ── Ses amis ────────────────────────────────────────────────────────────
  //
  // Ceux qui ont relevé un de ses défis entre amis, ou dont il a relevé un
  // (`shared/campagne.ts`) : la liste se relit dans le journal des
  // tentatives, rien ne s'y ajoute à la main. On leur envoie un défi d'un
  // toucher (`campagne_envois`) ; on en retire un (`campagne_amis_retires`),
  // qui revient s'ils jouent de nouveau ensemble. Un masqué n'y paraît
  // jamais, et ses défis ne parviennent à personne.

  /** Ses amis, les plus récents d'abord : leur identifiant, et quand il les a ajoutés ou joué avec eux pour la dernière fois. */
  private async idsDesAmis(profileId: string): Promise<string[]> {
    const [ensemble, retires] = await this.client.batch(
      [
        {
          // Ceux qu'il a ajoutés ; les tentatives des autres à ses défis entre
          // amis, et les siennes aux leurs. Un duel classé contre quelqu'un
          // du classement n'en fait pas un ami : il l'ajoute, s'il veut.
          sql: `SELECT ami, MAX(le) AS le FROM (
                  SELECT ami, ajoute_le AS le FROM campagne_amis_ajoutes WHERE profile_id = ?
                  UNION ALL
                  SELECT s.profile_id AS ami, s.commencee_le AS le FROM campagne_duels d JOIN campagne_series s ON s.mode = 'duel' AND s.duel = d.code
                   WHERE d.auteur = ? AND s.profile_id <> ? AND d.adversaire IS NULL
                  UNION ALL
                  SELECT d.auteur AS ami, s.commencee_le AS le FROM campagne_series s JOIN campagne_duels d ON d.code = s.duel
                   WHERE s.profile_id = ? AND s.mode = 'duel' AND d.auteur <> ? AND d.adversaire IS NULL
                ) GROUP BY ami ORDER BY le DESC LIMIT ?`,
          args: [profileId, profileId, profileId, profileId, profileId, AMIS_MONTRES * 2],
        },
        { sql: 'SELECT ami, retire_le FROM campagne_amis_retires WHERE profile_id = ?', args: [profileId] },
      ],
      'read',
    )
    const retire = new Map(retires.rows.map(r => [String(r.ami), Number(r.retire_le)]))
    return ensemble.rows
      .filter(r => !this.masque?.(String(r.ami)) && !(Number(r.le) <= (retire.get(String(r.ami)) ?? -Infinity)))
      .slice(0, AMIS_MONTRES)
      .map(r => String(r.ami))
  }

  /**
   * Ses amis, et les défis ouverts qu'ils lui ont envoyés sans qu'il les ait
   * relevés. Lus pour un de ses défis (`code`), ceux à qui il est déjà parti
   * ou qui l'ont relevé le disent : rien à leur renvoyer.
   */
  async mesAmis(profileId: string, code?: unknown): Promise<MesAmis> {
    const maintenant = this.maintenant()
    const [ids, envois, cotes, rangs] = await Promise.all([
      this.idsDesAmis(profileId),
      this.client.execute({
        // Et le score à battre de qui l'a lancé, sa tentative finie — d'un défi
        // entre amis seulement : celui d'un duel classé se dévoile à la
        // dernière réponse de qui le relève (le souhait du propriétaire du
        // 12 octobre 2026 : on le voyait avant même de jouer).
        sql: `SELECT e.code, CASE WHEN d.adversaire IS NULL THEN (SELECT s.justes FROM campagne_series s WHERE s.mode = 'duel' AND s.duel = e.code AND s.profile_id = d.auteur AND s.finie_le IS NOT NULL) END AS score,
                     EXISTS (SELECT 1 FROM campagne_amis_retires r WHERE r.profile_id = e.profile_id AND r.ami = d.auteur) AS retire
              FROM campagne_envois e JOIN campagne_duels d ON d.code = e.code
              WHERE e.profile_id = ? AND d.ferme_le > ? AND ${DEFI_A_LUI}
                AND NOT EXISTS (SELECT 1 FROM campagne_series s WHERE s.profile_id = e.profile_id AND s.mode = 'duel' AND s.duel = e.code)
                AND NOT EXISTS (SELECT 1 FROM campagne_amis_retires r WHERE r.profile_id = e.profile_id AND r.ami = d.auteur AND d.adversaire IS NOT NULL AND r.retire_le >= d.cree_le)
              ORDER BY e.envoye_le DESC LIMIT ?`,
        args: [profileId, maintenant, DEFIS_RECUS_MONTRES],
      }),
      // Sa ligue et sa place, sur la ligne de chaque ami.
      this.toutesLesCotes(),
      this.rangsDuClassement(),
    ])
    // Pour un de ses défis : à qui il est déjà parti, et qui l'a relevé.
    const vise = await this.duelDe(lireCodeDuDuel(code))
    const p = this.profils
    if (!p) return { amis: [], recus: [] }
    const deja = new Map<string, 'recu' | 'releve'>()
    if (vise && vise.auteur === profileId) {
      const [envoyes, releves] = await this.client.batch(
        [
          { sql: 'SELECT profile_id FROM campagne_envois WHERE code = ?', args: [vise.code] },
          { sql: `SELECT profile_id FROM campagne_series WHERE mode = 'duel' AND duel = ?`, args: [vise.code] },
        ],
        'read',
      )
      for (const r of envoyes.rows) deja.set(String(r.profile_id), 'recu')
      // Relevé, il l'a plus que reçu.
      for (const r of releves.rows) deja.set(String(r.profile_id), 'releve')
    }
    const profils = (await p.byIds(ids)).filter((x): x is ProfileRec => x !== null)
    // Deux amis du même prénom et du même avatar se distinguent à l'affichage, jamais en base (invariant 17).
    const marques = nomsAffiches(profils.map(x => ({ id: x.id, name: x.name, avatar: p.avatarPorte(x), legendaire: p.legendairePorte(x) })))
    const amis: AmiDeCampagne[] = profils.map(x => ({
      profileId: x.id,
      nom: marques.get(x.id) ?? x.name,
      avatar: p.avatarPorte(x),
      ...sonApparence(p, x, cotes.get(x.id)),
      ...(deja.has(x.id) && { deja: deja.get(x.id) }),
      ...this.saCote(cotes.get(x.id), rangs.get(x.id)),
    }))
    // Sa liste se lit comme un classement : la plus haute cote d'abord ; ceux
    // qui n'ont fini aucun duel classé ensuite, dans l'ordre où ils sont venus.
    amis.sort((a, b) => (b.cote ?? -Infinity) - (a.cote ?? -Infinity) || 0)
    // Un défi entre amis vient d'un ami, ou de qui l'a mis dans les siens
    // sans qu'il l'ait mis dans les siens — l'accueil le compte, et la page
    // ne le montrait qu'à ses amis à lui : compté, introuvable (le
    // 13 octobre 2026). Un retiré ou un masqué n'envoie rien ; un duel
    // classé, de qui l'a défié, sauf s'il l'avait retiré de ses amis avant.
    const sesAmis = new Set(ids)
    const score = new Map(envois.rows.map(r => [String(r.code), r.score === null || r.score === undefined ? null : Number(r.score)]))
    const retire = new Set(envois.rows.filter(r => Number(r.retire) === 1).map(r => String(r.code)))
    const duels = (await Promise.all(envois.rows.map(r => this.duelDe(String(r.code))))).filter(
      (d): d is Duel => d !== null && !this.masque?.(d.auteur) && (d.adversaire === profileId || sesAmis.has(d.auteur) || !retire.has(d.code)),
    )
    const auteurs = new Map(profils.map(x => [x.id, x]))
    // Qui l'a défié sans être son ami : lu d'un coup.
    const inconnus = [...new Set(duels.map(d => d.auteur).filter(id => !auteurs.has(id)))]
    for (const x of inconnus.length > 0 ? await p.byIds(inconnus) : []) if (x) auteurs.set(x.id, x)
    const recus: DefiRecu[] = duels.flatMap(d => {
      const auteur = auteurs.get(d.auteur)
      if (!auteur) return []
      const s = score.get(d.code)
      return [
        {
          code: d.code,
          auteur: { nom: marques.get(auteur.id) ?? auteur.name, avatar: p.avatarPorte(auteur), ...sonApparence(p, auteur, cotes.get(auteur.id)) },
          ...(d.sujet && { sujet: d.sujet }),
          ...(d.categories && d.categories.length > 0 && { categories: d.categories }),
          minutesRestantes: Math.max(1, Math.ceil((d.fermeLe - maintenant) / 60_000)),
          ...(d.adversaire && { classe: true as const }),
          ...(s !== null && s !== undefined && { score: s }),
        },
      ]
    })
    return { amis, recus, ...(vise?.auteur === profileId && { sien: true as const }) }
  }

  /** Sa cote, sa ligue et sa place, tels qu'une ligne d'ami ou de recherche les dit — rien tant qu'il n'a fini aucun duel classé. */
  private saCote(r: ReleveDesDuels | undefined, rang: number | undefined): { cote?: number; ligue?: CleDeLigue; rang?: number } {
    if (!r || r.joues === 0) return {}
    return { cote: r.cote, ligue: ligueDe(r.cote).cle, ...(rang !== undefined && { rang }) }
  }

  /**
   * La place de chacun au classement des duels, comme il la dit (`classementDesDuels`) :
   * ceux qui ont joué ces quatre dernières semaines, sans les masqués — rang
   * partagé, un de plus que ceux qui ont strictement plus (invariant 15).
   */
  private async rangsDuClassement(): Promise<Map<string, number>> {
    const cotes = await this.toutesLesCotes()
    const depuis = this.maintenant() - JOURS_DU_CLASSEMENT * 24 * HEURE_MS
    const classes = [...cotes].filter(([id, r]) => r.dernierLe !== null && r.dernierLe >= depuis && !this.masque?.(id)).map(([id, r]) => ({ id, cote: r.cote }))
    const rangs = new Map<string, number>()
    for (const c of classes) rangs.set(c.id, 1 + classes.filter(x => x.cote > c.cote).length)
    return rangs
  }

  /**
   * Ajouter un ami à sa liste, trouvé par son prénom : sans demande ni
   * attente — sa liste à lui. Un profil qui n'existe pas, un masqué ou
   * lui-même ne s'ajoutent pas ; ajouté après l'avoir retiré, il revient.
   */
  async ajouterUnAmi(profileId: string, ami: unknown): Promise<{ ok: true }> {
    if (typeof ami !== 'string' || !ami || ami === profileId) throw new Error('Ce joueur est introuvable : cherche-le de nouveau')
    const [lui] = this.profils ? await this.profils.byIds([ami]) : [null]
    if (!lui || this.masque?.(lui.id)) throw new Error('Ce joueur est introuvable : cherche-le de nouveau')
    await this.client.batch(
      [
        {
          sql: `INSERT INTO campagne_amis_ajoutes (profile_id, ami, ajoute_le) VALUES (?, ?, ?)
                ON CONFLICT (profile_id, ami) DO UPDATE SET ajoute_le = excluded.ajoute_le`,
          args: [profileId, lui.id, this.maintenant()],
        },
        // Rajouté, il n'est plus retiré : ses duels reçus avant le retrait reparaissent.
        { sql: 'DELETE FROM campagne_amis_retires WHERE profile_id = ? AND ami = ?', args: [profileId, lui.id] },
      ],
      'write',
    )
    // Le duel qu'il lui avait lancé pendant qu'il était retiré l'attend
    // maintenant : retenu, il bloquait la paire jusqu'à sa fermeture — un
    // duel ouvert qu'il ne voyait nulle part.
    const retenus = await this.client.execute({
      sql: `SELECT d.code FROM campagne_duels d
            JOIN campagne_series s ON s.mode = 'duel' AND s.duel = d.code AND s.profile_id = d.auteur AND s.finie_le IS NOT NULL
            WHERE d.auteur = ? AND d.adversaire = ? AND d.ferme_le > ?
              AND NOT EXISTS (SELECT 1 FROM campagne_envois e WHERE e.code = d.code AND e.profile_id = d.adversaire)
              AND NOT EXISTS (SELECT 1 FROM campagne_series t WHERE t.mode = 'duel' AND t.duel = d.code AND t.profile_id = d.adversaire)`,
      args: [lui.id, profileId, this.maintenant()],
    })
    if (retenus.rows.length > 0) {
      await this.client.batch(
        retenus.rows.map(r => ({ sql: 'INSERT OR IGNORE INTO campagne_envois (code, profile_id, envoye_le) VALUES (?, ?, ?)', args: [String(r.code), profileId, this.maintenant()] })),
        'write',
      )
    }
    return { ok: true }
  }

  /**
   * Chercher quelqu'un à défier, ou à ajouter : par son prénom, sans les
   * accents — « lea » trouve Léa —, ni lui-même, ni un masqué. Chacun dit sa
   * ligue, sa cote, sa place, et s'il est déjà son ami. Jamais son
   * identifiant de connexion : on le trouve par lui, on ne le lit pas.
   */
  async chercherDesJoueurs(profileId: string, brut: unknown): Promise<JoueurADefier[]> {
    const texte = typeof brut === 'string' ? tronquer(brut.trim(), 40) : ''
    const p = this.profils
    if (!p?.chercher || sansAccent(texte).length < LETTRES_POUR_CHERCHER) return []
    const trouves = (await p.chercher(texte, JOUEURS_TROUVES + 1)).filter(x => x.id !== profileId && !this.masque?.(x.id)).slice(0, JOUEURS_TROUVES)
    if (trouves.length === 0) return []
    const [amis, cotes, rangs] = await Promise.all([this.idsDesAmis(profileId), this.toutesLesCotes(), this.rangsDuClassement()])
    const sesAmis = new Set(amis)
    const marques = nomsAffiches(trouves.map(x => ({ id: x.id, name: x.name, avatar: p.avatarPorte(x), legendaire: p.legendairePorte(x) })))
    return trouves.map(x => ({
      profileId: x.id,
      nom: marques.get(x.id) ?? x.name,
      avatar: p.avatarPorte(x),
      ...sonApparence(p, x, cotes.get(x.id)),
      ...this.saCote(cotes.get(x.id), rangs.get(x.id)),
      ...(sesAmis.has(x.id) && { ami: true as const }),
    }))
  }

  /**
   * Les deux sens de sa liste, d'un aller-retour. Ses amis, comme
   * `idsDesAmis` les lit — ceux qu'il a ajoutés, ceux de ses défis entre
   * amis —, les plus récents d'abord ; ceux qui l'ont dans la leur — qui l'ont
   * ajouté, ou joué un défi entre amis avec lui : la même ligne se lit des
   * deux côtés —, sauf qui l'a retiré depuis ; et ceux qui l'ont ajouté sans
   * qu'il les ait ajoutés, ni retirés. Un masqué n'y paraît jamais.
   */
  private async cercleDe(profileId: string): Promise<CercleDAmis> {
    const [sesAjouts, defis, leursAjouts, sesRetraits, leursRetraits] = await this.client.batch(
      [
        { sql: 'SELECT ami, ajoute_le AS le FROM campagne_amis_ajoutes WHERE profile_id = ?', args: [profileId] },
        {
          // Les défis entre amis joués ensemble, d'un côté ou de l'autre : chacun est l'ami de l'autre.
          sql: `SELECT ami, MAX(le) AS le FROM (
                  SELECT s.profile_id AS ami, s.commencee_le AS le FROM campagne_duels d JOIN campagne_series s ON s.mode = 'duel' AND s.duel = d.code
                   WHERE d.auteur = ? AND s.profile_id <> ? AND d.adversaire IS NULL
                  UNION ALL
                  SELECT d.auteur AS ami, s.commencee_le AS le FROM campagne_series s JOIN campagne_duels d ON d.code = s.duel
                   WHERE s.profile_id = ? AND s.mode = 'duel' AND d.auteur <> ? AND d.adversaire IS NULL
                ) GROUP BY ami`,
          args: [profileId, profileId, profileId, profileId],
        },
        { sql: 'SELECT profile_id AS ami, ajoute_le AS le FROM campagne_amis_ajoutes WHERE ami = ?', args: [profileId] },
        { sql: 'SELECT ami, retire_le AS le FROM campagne_amis_retires WHERE profile_id = ?', args: [profileId] },
        { sql: 'SELECT profile_id AS ami, retire_le AS le FROM campagne_amis_retires WHERE ami = ?', args: [profileId] },
      ],
      'read',
    )
    const parAmi = (res: ResultSet) => new Map(res.rows.map(r => [String(r.ami), Number(r.le)]))
    const [ses, communs, leurs, sesRetires, leursRetires] = [sesAjouts, defis, leursAjouts, sesRetraits, leursRetraits].map(parAmi)
    const plusRecent = (a: number | undefined, b: number | undefined) => (a === undefined ? b : b === undefined ? a : Math.max(a, b))
    // Comme `idsDesAmis` : un retrait tient jusqu'à ce qu'ils jouent de nouveau ensemble, ou qu'il le rajoute.
    const tient = (le: number | undefined, retire: number | undefined) => le !== undefined && !(le <= (retire ?? -Infinity))
    const lesSiens = new Map<string, number>()
    for (const id of new Set([...ses.keys(), ...communs.keys()])) {
      const le = plusRecent(ses.get(id), communs.get(id))
      if (le !== undefined && !this.masque?.(id) && tient(le, sesRetires.get(id))) lesSiens.set(id, le)
    }
    const lAOntDansLaLeur = (id: string) => tient(plusRecent(leurs.get(id), communs.get(id)), leursRetires.get(id))
    return {
      amis: [...lesSiens]
        .sort((a, b) => b[1] - a[1])
        .slice(0, AMIS_MONTRES)
        .map(([id]) => id),
      estAmi: id => lesSiens.has(id),
      reciproque: id => lesSiens.has(id) && lAOntDansLaLeur(id),
      aRetire: id => sesRetires.has(id),
      // Jamais un qu'il a retiré : il l'a écarté, et le rajouter se fait par son prénom.
      tOntAjoute: [...leurs]
        .filter(([id]) => !lesSiens.has(id) && !sesRetires.has(id) && !this.masque?.(id) && lAOntDansLaLeur(id))
        .sort((a, b) => b[1] - a[1])
        .slice(0, AJOUTS_MONTRES)
        .map(([id]) => id),
    }
  }

  /**
   * La feuille des amis (`GET /api/duels/amis`) : sa liste, lue comme un
   * classement — la plus haute cote d'abord —, qui est en ligne parmi ceux
   * qui l'ont ajouté aussi, puis ceux qui l'ont ajouté sans qu'il les ait
   * ajoutés. « En ligne » ne se dit jamais d'un ami à sens unique : on ajoute
   * n'importe qui par son prénom, sans qu'il accepte, et un inconnu
   * guetterait sinon quand il se connecte. Puis des joueurs qu'il a croisés,
   * à ajouter d'un toucher — ni ceux qui l'ont ajouté, déjà au-dessus.
   */
  async amisDeLaFeuille(profileId: string): Promise<AmisDeLaFeuille> {
    const p = this.profils
    if (!p) return { amis: [], tOntAjoute: [], croises: [] }
    // Les sources des joueurs croisés se lisent avec sa liste, et tous leurs profils d'un coup : la feuille ne prend pas un aller-retour de plus.
    const [cercle, cotes, rangs, sources] = await Promise.all([this.cercleDe(profileId), this.toutesLesCotes(), this.rangsDuClassement(), this.sourcesDesCroises(profileId)])
    const candidats = { ...sources, niveau: this.prochesDeSaCote(profileId, cotes) }
    const lus = new Map(
      (await p.byIds([...new Set([...cercle.amis, ...cercle.tOntAjoute, ...Object.values(candidats).flat()])]))
        .filter((x): x is ProfileRec => x !== null)
        .map(x => [x.id, x]),
    )
    // Ni ceux qui l'ont ajouté : la feuille les montre au-dessus.
    const croises = this.choisirLesCroises(profileId, candidats, cercle, new Set(cercle.tOntAjoute), id => lus.has(id))
    const montres = [...cercle.amis, ...cercle.tOntAjoute, ...croises.map(c => c.id)].flatMap(id => lus.get(id) ?? [])
    // Deux du même prénom et du même avatar se distinguent à l'affichage, jamais en base (invariant 17) — d'une section à l'autre aussi.
    const marques = nomsAffiches(montres.map(x => ({ id: x.id, name: x.name, avatar: p.avatarPorte(x), legendaire: p.legendairePorte(x) })))
    const ligne = (id: string): AmiDeCampagne[] => {
      const x = lus.get(id)
      return x ? [{ profileId: x.id, nom: marques.get(x.id) ?? x.name, avatar: p.avatarPorte(x), ...sonApparence(p, x, cotes.get(x.id)), ...this.saCote(cotes.get(x.id), rangs.get(x.id)) }] : []
    }
    const amis = cercle.amis.flatMap(id => ligne(id).map(a => ({ ...a, ...(cercle.reciproque(id) && p.enLigne?.(id) && { enLigne: true as const }) })))
    amis.sort((a, b) => (b.cote ?? -Infinity) - (a.cote ?? -Infinity) || 0)
    return { amis, tOntAjoute: cercle.tOntAjoute.flatMap(ligne), croises: croises.flatMap(c => ligne(c.id).map(a => ({ ...a, croise: c.croise }))) }
  }

  /**
   * Des joueurs qu'il a croisés (`GET /api/duels/croises`, le souhait du
   * propriétaire du 11 octobre 2026 : « dans les défis, c'est dommage que ça
   * montre pas des joueurs pour les ajouter en ami ») : de quoi défier ou
   * ajouter quelqu'un sans connaître son prénom (`choisirLesCroises`).
   */
  async joueursCroises(profileId: string): Promise<JoueurCroise[]> {
    const p = this.profils
    if (!p) return []
    const [cercle, cotes, rangs, sources] = await Promise.all([this.cercleDe(profileId), this.toutesLesCotes(), this.rangsDuClassement(), this.sourcesDesCroises(profileId)])
    const candidats = { ...sources, niveau: this.prochesDeSaCote(profileId, cotes) }
    const lus = new Map(
      (await p.byIds([...new Set(Object.values(candidats).flat())])).filter((x): x is ProfileRec => x !== null).map(x => [x.id, x]),
    )
    const croises = this.choisirLesCroises(profileId, candidats, cercle, new Set(), id => lus.has(id)).map(c => ({ profil: lus.get(c.id)!, croise: c.croise }))
    const marques = nomsAffiches(croises.map(({ profil: x }) => ({ id: x.id, name: x.name, avatar: p.avatarPorte(x), legendaire: p.legendairePorte(x) })))
    return croises.map(({ profil: x, croise }) => ({
      profileId: x.id,
      nom: marques.get(x.id) ?? x.name,
      avatar: p.avatarPorte(x),
      ...sonApparence(p, x, cotes.get(x.id)),
      ...this.saCote(cotes.get(x.id), rangs.get(x.id)),
      croise,
    }))
  }

  /**
   * Ce que chaque source des joueurs croisés propose, du plus proche au plus
   * lointain, d'un aller-retour : ceux de ses dernières soirées
   * (`compagnonsDeSoiree` : il était dans la salle), les plus récents
   * d'abord ; ses adversaires de duel — une rencontre, un duel lancé ou reçu ;
   * ceux du défi de la semaine — au score le plus proche du sien s'il l'a
   * joué, les derniers venus sinon. Rien ne se tient à côté : tout se relit
   * dans les journaux.
   */
  private async sourcesDesCroises(profileId: string): Promise<Record<Exclude<Croisement, 'niveau'>, string[]>> {
    const { semaine } = this.semaineDeLHeure()
    const [soiree, [duels, defi]] = await Promise.all([
      this.profils?.compagnonsDeSoiree ? this.profils.compagnonsDeSoiree(profileId, CANDIDATS_PAR_SOURCE) : Promise.resolve([]),
      this.client.batch(
        [
          {
            // Ses rencontres — l'adversaire gardé avec sa série, qu'elles nomment —, les duels qu'il a lancés, et ceux qu'on lui a envoyés.
            // Une ligne illisible ne fait pas tomber la feuille : `json_extract` refuse un JSON mal formé.
            sql: `SELECT qui, MAX(le) AS le FROM (
                    SELECT json_extract(adversaire, '$.profil') AS qui, commencee_le AS le FROM campagne_series
                     WHERE profile_id = ? AND mode = 'rencontre' AND adversaire IS NOT NULL AND json_valid(adversaire)
                       AND json_extract(adversaire, '$.simule') IS NULL
                    UNION ALL
                    SELECT adversaire AS qui, cree_le AS le FROM campagne_duels WHERE auteur = ? AND adversaire IS NOT NULL
                    UNION ALL
                    SELECT d.auteur AS qui, e.envoye_le AS le FROM campagne_envois e JOIN campagne_duels d ON d.code = e.code
                     WHERE e.profile_id = ? AND d.adversaire = ?
                  ) WHERE qui IS NOT NULL GROUP BY qui ORDER BY le DESC LIMIT ?`,
            args: [profileId, profileId, profileId, profileId, CANDIDATS_PAR_SOURCE],
          },
          {
            sql: `SELECT profile_id, justes FROM campagne_series WHERE mode = 'defi' AND semaine = ? AND position > 0 ORDER BY commencee_le DESC LIMIT ?`,
            args: [semaine, CANDIDATS_DU_DEFI],
          },
        ],
        'read',
      ),
    ])
    const sienne = defi.rows.find(r => String(r.profile_id) === profileId)
    return {
      soiree,
      duel: duels.rows.map(r => String(r.qui)),
      // Au défi, ceux qui en sont où il en est, s'il l'a joué : un adversaire à sa mesure.
      defi: defi.rows
        .map((r, i) => ({ id: String(r.profile_id), ecart: sienne ? Math.abs(Number(r.justes) - Number(sienne.justes)) : 0, i }))
        .sort((a, b) => a.ecart - b.ecart || a.i - b.i)
        .map(d => d.id),
    }
  }

  /** Les classés de ces quatre dernières semaines, de la cote la plus proche de la sienne — celle de départ, s'il n'en a pas : un débutant croise des débutants. */
  private prochesDeSaCote(profileId: string, cotes: Map<string, ReleveDesDuels>): string[] {
    const sa = cotes.get(profileId)
    const maCote = sa && sa.joues > 0 ? sa.cote : COTE_DE_DEPART
    const depuis = this.maintenant() - JOURS_DU_CLASSEMENT * 24 * HEURE_MS
    return [...cotes]
      .filter(([id, r]) => id !== profileId && r.joues > 0 && r.dernierLe !== null && r.dernierLe >= depuis && !this.masque?.(id))
      .sort(([, a], [, b]) => Math.abs(a.cote - maCote) - Math.abs(b.cote - maCote) || (b.dernierLe ?? 0) - (a.dernierLe ?? 0))
      .slice(0, CANDIDATS_PAR_SOURCE)
      .map(([id]) => id)
  }

  /**
   * Les joueurs croisés, choisis parmi ce que proposent leurs sources, du
   * plus proche au plus lointain — ses soirées, ses duels, le défi de la
   * semaine, puis, pour compléter, sa cote : chacune sa part d'abord
   * (`CROISES_PAR_SOURCE` : six soirées ne cachent pas un adversaire), puis
   * la place qui reste au plus proche. Ni lui, ni un masqué, ni un ami, ni
   * qui il a retiré, ni un profil qui n'existe plus (`existe`), ni `exclus` ;
   * `JOUEURS_CROISES` au plus, rangés par ce qui les fait paraître.
   */
  private choisirLesCroises(
    profileId: string,
    candidats: Record<Croisement, readonly string[]>,
    cercle: CercleDAmis,
    exclus: ReadonlySet<string>,
    existe: (id: string) => boolean,
  ): { id: string; croise: Croisement }[] {
    const pris = new Map<string, Croisement>()
    const prendre = (croise: Croisement, part: number) => {
      let n = 0
      for (const id of candidats[croise]) {
        if (pris.size >= JOUEURS_CROISES || n >= part) return
        if (id === profileId || pris.has(id) || !existe(id) || exclus.has(id) || cercle.estAmi(id) || cercle.aRetire(id) || this.masque?.(id)) continue
        pris.set(id, croise)
        n++
      }
    }
    const vus: Croisement[] = ['soiree', 'duel', 'defi']
    for (const croise of vus) prendre(croise, CROISES_PAR_SOURCE[croise])
    // La place qui reste : une soirée de plus avant un inconnu de son niveau.
    for (const croise of vus) prendre(croise, JOUEURS_CROISES)
    prendre('niveau', JOUEURS_CROISES)
    // Chacun dans l'ordre de sa source : le plus récent, le plus proche.
    return [...pris].sort((a, b) => ORDRE_DES_CROISEMENTS.indexOf(a[1]) - ORDRE_DES_CROISEMENTS.indexOf(b[1])).map(([id, croise]) => ({ id, croise }))
  }

  /**
   * Un joueur touché hors d'une soirée (`GET /api/duels/joueurs/:id`) : ce
   * que la recherche dirait de lui — sa ligue, sa cote, sa place, s'il est
   * son ami —, sa propre cote, relue, pour que la préparation dise ce qui se
   * joue, et le duel déjà ouvert entre eux, que sa carte dit au lieu de
   * « Défier » (`duelOuvertEntre`, la règle même du refus). Ni lui-même, ni
   * un masqué, ni un inconnu : null.
   */
  async faceAFace(profileId: string, autre: unknown): Promise<FaceAFace | null> {
    const p = this.profils
    if (!p || typeof autre !== 'string' || !autre || autre === profileId || this.masque?.(autre)) return null
    const [lui] = await p.byIds([autre])
    if (!lui) return null
    const [cercle, cotes, rangs, moi, enCours] = await Promise.all([
      this.cercleDe(profileId),
      this.toutesLesCotes(),
      this.rangsDuClassement(),
      this.releveDesDuels(profileId),
      this.duelOuvertEntre(profileId, lui.id),
    ])
    return {
      joueur: {
        profileId: lui.id,
        nom: lui.name,
        avatar: p.avatarPorte(lui),
        ...sonApparence(p, lui, cotes.get(lui.id)),
        ...this.saCote(cotes.get(lui.id), rangs.get(lui.id)),
        ...(cercle.estAmi(lui.id) && { ami: true as const }),
      },
      moi: { cote: moi.cote, joues: moi.joues, ...(moi.plancher !== null && { plancher: moi.plancher }) },
      ...(enCours && { enCours }),
    }
  }

  /**
   * Envoyer un de ses défis à des amis : il les attend sous leur onglet du
   * défi. Seulement les siens, ouverts, et seulement à ses amis : un
   * identifiant qui n'en est pas un ne reçoit rien, sans que l'envoyeur
   * l'apprenne (invariant 3).
   */
  async envoyerUnDuel(profileId: string, brut: unknown, amis: unknown): Promise<{ envoyes: number }> {
    const duel = await this.duelDe(lireCodeDuDuel(brut))
    if (!duel || duel.auteur !== profileId) throw new Error('Ce défi est introuvable : vérifie son lien')
    if (this.maintenant() >= duel.fermeLe) throw new Error('Ce défi est fermé : lances-en un autre depuis la série')
    const voulus = idsVoulus(amis)
    const destinataires = (await this.idsDesAmis(profileId)).filter(id => voulus.has(id))
    if (destinataires.length > 0) {
      await this.client.batch(
        destinataires.map(id => ({ sql: 'INSERT OR IGNORE INTO campagne_envois (code, profile_id, envoye_le) VALUES (?, ?, ?)', args: [duel.code, id, this.maintenant()] })),
        'write',
      )
    }
    return { envoyes: destinataires.length }
  }

  /**
   * Le défi qu'il a lancé, joué jusqu'au bout : il part aux amis choisis au
   * lancement — encore ses amis, et qui ne l'ont pas déjà relevé par son
   * lien —, sans faire sonner leur téléphone : seul le quiz du jour a sa
   * notification, et leur accueil le dit. Rend leurs prénoms, pour la fin de
   * sa tentative. Une seule fois : les prévus s'effacent en partant.
   */
  private async envoyerLesPrevus(duel: Duel): Promise<string[]> {
    const prevus = await this.client.execute({
      sql: `SELECT p.profile_id, EXISTS (SELECT 1 FROM campagne_series s WHERE s.profile_id = p.profile_id AND s.mode = 'duel' AND s.duel = p.code) AS joue
            FROM campagne_envois_prevus p WHERE p.code = ?`,
      args: [duel.code],
    })
    // Personne de choisi : rien à écrire, la fin de sa tentative n'attend pas un aller-retour de plus.
    if (prevus.rows.length === 0) return []
    // Un duel classé part à qui a été défié — sauf s'il avait retiré de ses
    // amis celui qui le défie ; un défi entre amis, à ses amis seulement.
    const [amis, bloque] = await Promise.all([
      duel.adversaire ? null : this.idsDesAmis(duel.auteur).then(ids => new Set(ids)),
      duel.adversaire ? this.aRetire(duel.adversaire, duel.auteur) : false,
    ])
    const destinataires = prevus.rows
      .filter(r => !Number(r.joue))
      .map(r => String(r.profile_id))
      .filter(id => (amis ? amis.has(id) : !bloque && id === duel.adversaire))
    // Envoyé à la main avant sa dernière réponse, il les attend déjà : l'envoi ne se double pas.
    await this.client.batch(
      [
        ...destinataires.map(id => ({ sql: 'INSERT OR IGNORE INTO campagne_envois (code, profile_id, envoye_le) VALUES (?, ?, ?)', args: [duel.code, id, this.maintenant()] })),
        { sql: 'DELETE FROM campagne_envois_prevus WHERE code = ?', args: [duel.code] },
      ],
      'write',
    )
    // Un duel classé se dit parti même retenu : celui qui défie n'apprend pas qu'on l'a retiré.
    return this.prenomsDe(duel.adversaire ? [duel.adversaire] : destinataires)
  }

  /**
   * Sa dernière réponse au défi qu'il a lancé : il part à ceux qu'il avait
   * choisis. Un envoi raté ne coûte pas sa réponse, déjà écrite : les prévus
   * restent, et sa page les envoie à sa prochaine visite (`duel`).
   */
  private async partirAuxPrevus(profileId: string, code: string): Promise<string[]> {
    const duel = await this.duelDe(code)
    if (!duel || duel.auteur !== profileId) return []
    try {
      return await this.envoyerLesPrevus(duel)
    } catch (e) {
      console.warn('[campagne] un défi n’est pas parti à ses amis choisis, il partira de sa page :', e instanceof Error ? e.message : e)
      return []
    }
  }

  /** Les prénoms des amis choisis au lancement d'un défi, qui l'attendent encore. */
  private async prenomsDesPrevus(code: string): Promise<string[]> {
    const res = await this.client.execute({ sql: 'SELECT profile_id FROM campagne_envois_prevus WHERE code = ?', args: [code] })
    return this.prenomsDe(res.rows.map(r => String(r.profile_id)))
  }

  /** Les prénoms de ces profils, marqués s'ils se confondent entre eux (invariant 17). */
  private async prenomsDe(ids: readonly string[]): Promise<string[]> {
    const p = this.profils
    if (!p || ids.length === 0) return []
    const profils = (await p.byIds([...ids])).filter((x): x is ProfileRec => x !== null)
    const marques = nomsAffiches(profils.map(x => ({ id: x.id, name: x.name, avatar: p.avatarPorte(x), legendaire: p.legendairePorte(x) })))
    return profils.map(x => marques.get(x.id) ?? x.name)
  }

  /** Retirer un ami de sa liste : ni lui ni ses défis n'y paraissent plus, jusqu'à ce qu'ils jouent de nouveau ensemble. */
  async retirerUnAmi(profileId: string, ami: unknown): Promise<{ ok: true }> {
    if (typeof ami === 'string' && ami && ami !== profileId) {
      await this.client.execute({
        sql: `INSERT INTO campagne_amis_retires (profile_id, ami, retire_le) VALUES (?, ?, ?)
              ON CONFLICT (profile_id, ami) DO UPDATE SET retire_le = excluded.retire_le`,
        args: [profileId, ami, this.maintenant()],
      })
    }
    return { ok: true }
  }

  // ── Affronter un inconnu ────────────────────────────────────────────────
  //
  // Un adversaire tout de suite (`shared/campagne.ts`) : la série finie d'un
  // autre joueur, de son niveau, rejouée — ses questions, dans le même
  // ordre, contre son score. Une série d'un autre mode (`mode = 'rencontre'`)
  // qui garde son adversaire (`AdversaireGarde`) : l'expérience, les
  // confettis et les hauts faits de série la comptent, le record des séries
  // non. Ni classement, ni laurier, ni Éclat.

  /** Qui l'on affronte, tel que la page le montre : un profil masqué ou parti ne se nomme pas. */
  private async adversaireVu(a: AdversaireGarde): Promise<Adversaire> {
    if (a.simule) return automateVu(a)
    const p = this.profils ? ((await this.profils.byIds([a.profil]))[0] ?? null) : null
    const nomme = p && !this.masque?.(p.id)
    return {
      nom: nomme ? p.name : 'Un joueur',
      avatar: nomme && this.profils ? this.profils.avatarPorte(p) : '🎲',
      ...(nomme && this.profils && sonApparence(this.profils, p)),
      justes: a.reponses.filter(Boolean).length,
    }
  }

  /**
   * Les réponses d'Automate sur une série neuve, son score tenu à ce qu'on
   * attend de lui (`partieDAutomate`). Un test qui le remplace fixe son
   * score : la cote d'un duel s'y vérifie au point près, comme contre un
   * joueur.
   */
  static reponsesDAutomate(automate: AutomateDuDe): boolean[] {
    return partieDAutomate(automate.chances, automate.cible)
  }

  /**
   * Ce qu'Automate jouera contre lui sur ces questions (`AutomateDuDe`) : sa
   * force, relue de toutes ses premières réponses (`forceDuJoueur`) — la
   * série qu'il vient de finir comprise —, ses écarts de catégorie, et le
   * niveau de son placement ou de sa cote ; puis ses chances sur chaque
   * question, aux difficultés du modèle. Sans un seul ajustement encore, la
   * part de ceux qui ont trouvé chaque question en tient lieu.
   */
  private automatePour(
    premieres: ReadonlyMap<string, boolean>,
    releve: ReleveDesDuels,
    questions: readonly QuestionDeLaBase[],
    base: BaseDeLaCampagne,
    jouables: readonly QuestionDeLaBase[],
    mesure: ReadonlyMap<string, MesureDUneQuestion>,
  ): AutomateDuDe {
    const modele = this.savoir?.modele ?? null
    const difficulteDe = (q: QuestionDeLaBase) => modele?.difficultes.get(q.id) ?? difficulteSansModele(q.meta.difficulte, mesure.get(q.id))
    const reference = this.referencePour(jouables, mesure, modele)
    const lui = forceDuJoueur(
      premieres,
      id => {
        const q = base.parId.get(id)
        return q && { categorie: q.meta.categorie, difficulte: difficulteDe(q) }
      },
      reference.forceDeDepart,
    )
    // Sans une réponse, le joueur de la cote de départ (`SCORE_DE_REFERENCE`). Placé,
    // celui de sa cote cachée : la montée porte celle qu'on voit au-dessus de son niveau.
    const sonNiveau = lui.reponses === 0 ? SCORE_DE_REFERENCE : scoreDeReference(lui.force, lui.ecarts, reference)
    const niveau = niveauPourLeDuel(releve.joues, releve.cachee, sonNiveau)
    const force = forcePourLeNiveau(niveau, lui.ecarts, reference)
    const chances = chancesSurLaSerie(
      questions.map(q => ({ difficulte: difficulteDe(q), categorie: q.meta.categorie })),
      force,
      lui.ecarts,
    )
    return { chances, cible: scoreAttendu(chances), niveau }
  }

  /**
   * Le dé : celle qu'il a laissée en route reprend, sur ce qu'elle jouait ;
   * sinon, Automate, l'adversaire simulé, sur une série neuve tirée pour lui
   * comme une série de la campagne — sur ses catégories ou son sujet, s'il en
   * a choisi (le souhait du propriétaire du 16 octobre 2026 : « je ne peux
   * pas choisir le thème ») —, qui joue comme lui à son niveau
   * (`automatePour`). Jamais plus la série finie d'un autre joueur : elle
   * montrait son profil — celui d'un ami, sur un serveur de quelques amis —
   * quand il n'était pas là, et « c'est trompeur » (le propriétaire, le
   * 13 octobre 2026). Une série en cours, elle, attend.
   *
   * Le dé ne tire qu'à « Jouer le duel » : ce qu'il met en jeu ne dépend plus
   * du tirage (`enjeuDuDe`), sa feuille le dit avant. Il tirait d'abord, et
   * sa feuille fermée laissait un duel en cours que le joueur n'avait pas
   * lancé (le même retour). Tirée, la rencontre est à lui : laissée, elle
   * reprend, et elle ne s'abandonne pas.
   *
   * Tout ce qu'il lui faut de la base permanente part d'un seul aller-retour
   * — sa rencontre laissée, sa cote, ce qu'il a vu et ses premières
   * réponses, d'un même texte —, et le dé répond sans attendre que la
   * rencontre s'écrive : le verrou du profil tient jusque-là, et sa première
   * réponse l'attend (`avecVerrouJusquALEcriture`) — lire une question prend
   * plus longtemps qu'un aller-retour. Lu en deux fois, puis écrit, le dé
   * attendait trois allers-retours vers Turso l'un derrière l'autre, 230 ms
   * chacun en médiane (le retour du propriétaire du 13 octobre 2026 :
   * « l'attente est perceptible » ; `duels-attente.test.ts`) ; il n'en attend
   * plus qu'un. Le prix, que le propriétaire a accepté le même jour : une
   * écriture ratée ne se dit plus au toucher, mais à la première réponse
   * (`rencontresPerdues`). Une rencontre laissée, qui se reprend, a lu ses
   * vues pour rien : moins cher qu'un aller-retour de plus à chaque dé.
   */
  commencerUneRencontre(profileId: string, choix: { categories?: readonly string[]; sujet?: string } = {}): Promise<RencontreDeCampagne> {
    return this.avecVerrouJusquALEcriture(profileId, async () => {
      this.rencontresPerdues.delete(profileId)
      const maintenant = this.maintenant()
      const suivi = choix.sujet === undefined ? undefined : sujetParCle(choix.sujet)
      // La base et sa mesure, gardées en mémoire, partent à côté ; une
      // rencontre reprise s'en passe, et leur échec ne compte qu'au tirage.
      // Toutes les jouables avec celles du choix : Automate se règle sur une
      // série de toutes les catégories (`automatePour`).
      const tirage = Promise.all([this.base(), this.jouables(), this.jouables(suivi ? undefined : choix.categories), this.mesures()])
      tirage.catch(() => {})
      // Le modèle du savoir, s'il a vieilli, se refait en fond : sa lecture
      // part avec celles du dé, que rien n'attend derrière elle.
      this.modeleDuSavoir()
      const tour = ++this.tourDesBordures
      const [laissee, duels, vues] = await this.client.batch(
        [
          { sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'rencontre' AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1`, args: [profileId] },
          lectureDesDuels(profileId, maintenant),
          lectureDesVues(profileId),
        ],
        'read',
      )
      // Sa cote : ce que la rencontre met en jeu se redit à chaque question.
      const releve = this.releveLu(profileId, duels.rows, tour)
      const ouverte = laissee.rows[0] ? versSerie(laissee.rows[0]) : null
      if (ouverte?.adversaire) {
        this.garderEnCours(ouverte)
        return {
          reponse: {
            serie: vueDeSerie(ouverte),
            adversaire: enJeu(await this.adversaireVu(ouverte.adversaire)),
            sesJustes: sesJustesAvant(ouverte),
            enjeu: enjeuDuDe(releve.cote),
          },
        }
      }
      if (choix.sujet !== undefined && !suivi) throw new Error('Ce sujet n’existe plus : choisis-en un autre')
      const [base, toutes, duChoix, mesure] = await tirage
      // Sur un sujet, sa liste gardée, comme une série : son tirage se prépare une fois (`duSujet`, `tirage`).
      const jouables = suivi ? this.duSujet(duChoix, suivi.cle) : duChoix
      if (jouables.length < QUESTIONS_POUR_JOUER) {
        throw new Error(
          suivi
            ? 'Pas assez de questions sur ce sujet pour l’instant : choisis-en un autre'
            : choix.categories && choix.categories.length > 0
              ? 'Pas assez de questions dans ces catégories : ajoutes-en une autre'
              : 'La campagne n’a pas encore de questions à poser : reviens bientôt',
        )
      }
      const { vues: sesVues, premieres } = lireLesVues(vues.rows)
      const tirees = this.tirage(jouables, mesure).tirer(sesVues, maintenant)
      // Placé, il affronte le niveau de sa cote ; avant, celui de ses réponses.
      // Sur un thème, ses écarts de catégorie y jouent : il rate où il rate.
      const automate = this.automatePour(premieres, releve, tirees.map(x => x.question), base, toutes, mesure)
      const id = randomUUID()
      const adversaire: AdversaireGarde = { serie: id, profil: '', reponses: CampagneStore.reponsesDAutomate(automate), simule: true }
      const serie: Serie = {
        id,
        profileId,
        questions: tirees.map(x => versQuestionDeSerie(x.question, x.niveau)),
        index: 0,
        vies: VIES,
        justes: 0,
        finieLe: null,
        mode: 'rencontre',
        branche: null,
        palier: null,
        seuil: null,
        rejeu: false,
        issue: null,
        categories: suivi ? null : lireCategories(categoriesRetenues(choix.categories)),
        sujet: suivi?.cle ?? null,
        adversaire,
      }
      // La réponse d'abord : rien ne doit plus lever entre l'écriture lancée
      // et le verrou qui l'attend.
      const reponse: RencontreDeCampagne = {
        serie: vueDeSerie(serie),
        adversaire: enJeu(await this.adversaireVu(adversaire)),
        sesJustes: 0,
        enjeu: enjeuDuDe(releve.cote),
      }
      // Gardée une fois écrite, comme toute série (`enCours`). Ratée, rien ne
      // l'est : sa première réponse la cherche en base, et dit de relancer le dé.
      const ecriture = this.client
        .execute({
          sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, categories, sujet, adversaire)
                VALUES (?, ?, ?, 0, ?, 0, ?, NULL, 'rencontre', ?, ?, ?)`,
          args: [serie.id, profileId, JSON.stringify(serie.questions), VIES, maintenant, serie.categories ? JSON.stringify(serie.categories) : null, serie.sujet ?? null, JSON.stringify(adversaire)],
        })
        .then(
          () => this.garderEnCours(serie),
          (e: unknown) => {
            this.rencontresPerdues.set(profileId, serie.id)
            console.warn('[campagne] une rencontre ne s’est pas écrite :', e instanceof Error ? e.message : e)
          },
        )
      return { reponse, ecriture }
    })
  }

  /** Ses rencontres : celle laissée en route, et les dernières jouées, leur issue — leurs adversaires lus d'un coup. */
  async mesRencontres(profileId: string): Promise<MesRencontres> {
    return (await this.rencontresEtDuels(profileId)).rencontres
  }

  /**
   * Ses rencontres, et ses duels classés relus — d'un aller-retour : chaque
   * rencontre finie dit ce qu'elle a fait à sa cote, celle en route ce
   * qu'elle met en jeu. Et, pour sa page, contre qui chacun s'est joué
   * (`racontes`), dans le même lot : son bilan et son historique.
   */
  private async rencontresEtDuels(profileId: string, racontes = false): Promise<{ rencontres: MesRencontres; releve: ReleveDesDuels; racontes: DuelRaconte[] }> {
    const [res, duels, adversaires] = await this.client.batch(
      [
        // Les questions de la seule rencontre en route, qui se reprend : une
        // finie n'en dit que son score. Les soixante de chacune — vingt
        // kilo-octets — faisaient décoder trois cents kilo-octets à chaque
        // ouverture de la page (le banc du 16 octobre 2026).
        {
          sql: `SELECT id, profile_id, position, vies, justes, finie_le, mode, categories, sujet, adversaire,
                       CASE WHEN finie_le IS NULL THEN questions ELSE '[]' END AS questions
                FROM campagne_series WHERE profile_id = ? AND mode = 'rencontre' ORDER BY commencee_le DESC LIMIT ?`,
          args: [profileId, RENCONTRES_MONTREES + 1],
        },
        lectureDesDuels(profileId, this.maintenant()),
        ...(racontes ? [lectureDesAdversaires(profileId)] : []),
      ],
      'read',
    )
    const joues = duelsLus(duels.rows)
    const releve = releverLesDuels(joues, semaineDeLInstant)
    const rencontres = res.rows.map(versSerie).filter(s => s.adversaire)
    // Les joueurs qu'il a affrontés au dé, avant Automate : Automate n'a pas de
    // profil — demandé quand même, son identifiant vide repartait vers la base
    // à chaque ouverture de la page, introuvable et jamais gardé.
    const affrontes = [...new Set(rencontres.filter(s => !s.adversaire!.simule).map(s => s.adversaire!.profil))]
    const lus = affrontes.length > 0 && this.profils ? await this.profils.byIds(affrontes) : []
    const profilDe = new Map(affrontes.map((id, i) => [id, lus[i] ?? null]))
    const vu = (s: Serie): Adversaire => {
      if (s.adversaire!.simule) return automateVu(s.adversaire!)
      const p = profilDe.get(s.adversaire!.profil)
      const nomme = p && !this.masque?.(p.id)
      return {
        nom: nomme ? p.name : 'Un joueur',
        avatar: nomme && this.profils ? this.profils.avatarPorte(p) : '🎲',
        ...(nomme && this.profils && sonApparence(this.profils, p)),
        justes: s.adversaire!.reponses.filter(Boolean).length,
      }
    }
    const ouverte = rencontres.find(s => s.finieLe === null) ?? null
    return {
      releve,
      racontes: adversaires ? duelsRacontes(joues, adversaires.rows) : [],
      rencontres: {
        enCours: ouverte
          ? {
              serie: vueDeSerie(ouverte),
              adversaire: enJeu(vu(ouverte)),
              sesJustes: sesJustesAvant(ouverte),
              enjeu: enjeuDuDe(releve.cote),
            }
          : null,
        passees: rencontres
          .filter(s => s.finieLe !== null)
          .slice(0, RENCONTRES_MONTREES)
          .map((s): ResumeDeRencontre => {
            const adversaire = vu(s)
            const ecart = releve.ecarts.get(s.id)?.ecart
            return { serie: s.id, adversaire, justes: s.justes, issue: issueDeRencontre(s.justes, adversaire.justes), le: s.finieLe!, ...(ecart !== undefined && { ecart }) }
          }),
      },
    }
  }

  // ── Les duels classés (`shared/duels.ts`) ───────────────────────────────
  //
  // Une rencontre finie est un duel classé : la cote se relit dans le journal
  // des rencontres à chaque lecture (`releverLesDuels`) — rien ne se tient à
  // côté, et une règle changée vaut pour tout ce qui a été joué. Celle d'un
  // joueur, d'une requête à lui ; celles du classement, d'une lecture de
  // toutes, gardée jusqu'au prochain duel fini (`cotes`).

  /** Ses duels classés, relus : sa cote, ses semaines — et ses bordures, retenues pour la salle. */
  private async releveDesDuels(profileId: string): Promise<ReleveDesDuels> {
    const tour = ++this.tourDesBordures
    return this.releveLu(profileId, (await this.client.execute(lectureDesDuels(profileId, this.maintenant()))).rows, tour)
  }

  /** Ses duels classés, de lignes de `lectureDesDuels` parties au tour `tour` — seules, ou dans un lot : ses bordures retenues avec. */
  private releveLu(profileId: string, lignes: readonly Record<string, unknown>[], tour: number): ReleveDesDuels {
    const r = releverLesDuels(duelsLus(lignes), semaineDeLInstant)
    this.retenirLesBordures(profileId, r.bordures, tour)
    return r
  }

  /**
   * Retient ses bordures pour la salle et les classements, lues au tour
   * `tour` — sauf si une lecture plus récente les a déjà retenues. Changées
   * — un cran de plus, une ligue de plus —, la salle où il joue se
   * rediffuse ; arrivées vides, il n'y a rien à montrer de plus.
   */
  private retenirLesBordures(profileId: string, bordures: readonly BordureDeLigue[], tour: number) {
    if ((this.bordureDuTour.get(profileId) ?? 0) > tour) return
    this.bordureDuTour.set(profileId, tour)
    const avant = this.bordures.get(profileId)
    this.bordures.set(profileId, bordures)
    if (avant ? JSON.stringify(avant) !== JSON.stringify(bordures) : bordures.length > 0) this.bordureChange?.(profileId)
  }

  /** Ses bordures de ligue, de mémoire : undefined tant qu'elles ne sont pas relues. */
  borduresEnMemoire(profileId: string): readonly BordureDeLigue[] | undefined {
    return this.bordures.get(profileId)
  }

  /**
   * Relit ses bordures en fond, une fois — un profil qui entre dans une
   * soirée : sa salle se rediffuse quand elles arrivent. Jamais attendu ; et
   * les arrivées proches se lisent d'une seule requête
   * (`lireLesBorduresAttendues`) : la salle qui revient d'un redémarrage
   * en faisait une par téléphone.
   */
  connaitreLesBordures(profileId: string, relire = false): void {
    if (this.ferme || this.borduresEnRoute.has(profileId) || (!relire && this.bordures.has(profileId))) return
    // Toutes lues : inconnu, il n'a joué aucun duel classé — rien à relire.
    if (!relire && this.borduresChaudes) {
      this.bordures.set(profileId, [])
      return
    }
    this.borduresEnRoute.add(profileId)
    this.borduresAttendues.add(profileId)
    if (!this.lectureDesBordures) {
      this.lectureDesBordures = setTimeout(() => void this.lireLesBorduresAttendues(), BORDURES_GROUPEES_MS)
      this.lectureDesBordures.unref()
    }
  }

  /**
   * Les bordures attendues, d'une requête. Une base qui se tait ne se
   * redemande pas avant une minute : chaque téléphone qui se re-présente
   * relancerait sinon la même lecture.
   */
  private async lireLesBorduresAttendues(): Promise<void> {
    this.lectureDesBordures = null
    const ids = [...this.borduresAttendues]
    this.borduresAttendues.clear()
    if (ids.length === 0 || this.ferme) return
    const tour = ++this.tourDesBordures
    try {
      const res = await this.client.execute(lectureDesDuels(ids, this.maintenant()))
      // Chacun ses lignes, dans l'ordre du journal ; sans duel, aucune : il est connu quand même.
      const parJoueur = new Map<string, Record<string, unknown>[]>(ids.map(id => [id, []]))
      for (const r of res.rows) parJoueur.get(String(r.profile_id))?.push(r)
      for (const [id, lignes] of parJoueur) {
        this.borduresEnRoute.delete(id)
        this.retenirLesBordures(id, releverLesDuels(duelsLus(lignes), semaineDeLInstant).bordures, tour)
      }
    } catch (e) {
      console.warn('[campagne] les bordures de ligue de la salle ne se lisent pas :', e instanceof Error ? e.message : e)
      setTimeout(() => {
        for (const id of ids) this.borduresEnRoute.delete(id)
      }, 60_000).unref()
    }
  }

  /**
   * Un duel joué des deux côtés bouge aussi la cote de l'autre : ses
   * bordures se relisent en fond — gardées pendant ce temps : effacées, la
   * salle les perdait jusqu'à leur retour. Toujours, même jamais lues :
   * une fois toutes lues, une bordure inconnue veut dire « aucun duel ».
   */
  private relireLesBorduresDe(profileId: string | null | undefined): void {
    if (profileId) this.connaitreLesBordures(profileId, true)
  }

  /**
   * Sa ligue, sa cote et ses bordures de ligue, pour sa carte et pour la
   * bordure qu'il choisit ; null tant qu'il n'a fini aucun duel classé —
   * l'absence, pas une ligue de bronze.
   */
  async coteDe(profileId: string): Promise<CoteDesDuels | null> {
    return coteDuReleve(await this.releveDesDuels(profileId))
  }

  /** Sa semaine de duels, telle que sa page la dit : ses duels, sa meilleure ligue, ce qu'elle rapportera lundi. */
  private semaineDesDuels(r: ReleveDesDuels): SemaineDesDuels {
    const s = r.semaines.get(this.semaineDeLHeure().semaine)
    return { duels: s?.duels ?? 0, ligue: ligueDeLaSemaine(s, r.cote).cle, confettis: recompenseDeLaSemaine(s), minutesRestantes: minutesAvantLundi(this.maintenant()) }
  }

  /** Ce qu'un duel fini a fait à sa cote, lu sur le relevé qui le compte déjà ; null : ce n'en est pas un. */
  private coteApres(r: ReleveDesDuels, serie: string): CoteApresLeDuel | null {
    const e = r.ecarts.get(serie)
    if (!e) return null
    const apres = e.avant + e.ecart
    return { avant: e.avant, apres, ecart: e.ecart, ligueAvant: ligueDe(e.avant).cle, ligue: ligueDe(apres).cle, semaine: this.semaineDesDuels(r) }
  }

  /** Les cotes de tous, pour le classement : relues d'une lecture, gardées jusqu'au prochain duel fini (`COTES_GARDEES_MS` au plus). */
  private toutesLesCotes(): Promise<Map<string, ReleveDesDuels>> {
    const maintenant = this.maintenant()
    if (this.cotes && maintenant - this.cotes.lu < COTES_GARDEES_MS) return this.cotes.parProfil
    const parProfil = (async () => {
      const tour = ++this.tourDesBordures
      const res = await this.client.execute(lectureDesDuels(null, this.maintenant()))
      const parJoueur = new Map<string, Record<string, unknown>[]>()
      for (const r of res.rows) {
        const id = String(r.profile_id)
        const lignes = parJoueur.get(id)
        if (lignes) lignes.push(r)
        else parJoueur.set(id, [r])
      }
      const releves = new Map([...parJoueur].map(([id, lignes]) => [id, releverLesDuels(duelsLus(lignes), semaineDeLInstant)]))
      // Les bordures de tous, au passage : la salle et les classements les
      // lisent de mémoire, et qui n'est pas ici n'a joué aucun duel classé.
      for (const [id, r] of releves) this.retenirLesBordures(id, r.bordures, tour)
      this.borduresChaudes = true
      return releves
    })()
    const garde = { lu: maintenant, parProfil }
    this.cotes = garde
    // Ratée, elle se relit à la demande suivante : gardée, la promesse figerait l'échec.
    parProfil.catch(() => {
      if (this.cotes === garde) this.cotes = null
    })
    return parProfil
  }

  /**
   * Le classement des duels : la cote de ceux qui ont fini un duel classé ces
   * quatre dernières semaines (`JOURS_DU_CLASSEMENT`), rang partagé
   * (invariant 15) — les masqués du quiz du jour écartés, sauf pour
   * eux-mêmes —, nommé comme au défi : un homonyme y garde sa marque, le
   * second arrivé aux duels la porte.
   */
  async classementDesDuels(pour: string | null): Promise<ClassementDesDuels> {
    const p = this.profils
    if (!p) return { joueurs: 0, lignes: [] }
    const cotes = await this.toutesLesCotes()
    const depuis = this.maintenant() - JOURS_DU_CLASSEMENT * 24 * HEURE_MS
    const ids = [...cotes].filter(([, r]) => r.dernierLe !== null && r.dernierLe >= depuis).map(([id]) => id)
    const profils = await p.byIds(ids)
    const joueurs = profils.flatMap(profil =>
      profil && (!this.masque?.(profil.id) || profil.id === pour) ? [{ profil, releve: cotes.get(profil.id)! }] : [],
    )
    const arrivee = [...joueurs].sort((a, b) => (a.releve.premierLe ?? 0) - (b.releve.premierLe ?? 0) || a.profil.id.localeCompare(b.profil.id))
    const marques = nomsAffiches(arrivee.map(j => ({ id: j.profil.id, name: j.profil.name, avatar: p.avatarPorte(j.profil), legendaire: p.legendairePorte(j.profil) })))
    const nom = (j: (typeof joueurs)[number]) => marques.get(j.profil.id) ?? j.profil.name
    const classes = classer(joueurs, j => j.releve.cote, nom, j => j.profil.id)
    // La place de chacun au lundi : les flèches de chaque ligne, comme un tableau sportif.
    const auLundi = this.rangsAuLundi(joueurs, nom)
    const ligne = ({ item: j, rang }: (typeof classes)[number]): LigneDesDuels => {
      const { niveau, finition, eclat, legendaire, laurier } = p.apparenceDe(j.profil)
      // Sa bordure de ligue, lue sur le même relevé que sa cote — jamais sous un Divin.
      const bordure = legendaire && divin(legendaire) ? null : bordurePortee(j.profil.bordure, j.releve.bordures)
      const avant = auLundi.get(j)
      return {
        profileId: j.profil.id,
        nom: nom(j),
        avatar: p.avatarPorte(j.profil),
        niveau,
        finition,
        ...(legendaire && { legendaire }),
        ...(eclat && { eclat: true as const }),
        ...(laurier && { laurier }),
        ...(bordure && { bordure }),
        cote: j.releve.cote,
        ligue: ligueDe(j.releve.cote).cle,
        rang,
        duels: j.releve.joues,
        ...(avant !== undefined && avant !== rang && { progression: avant - rang }),
      }
    }
    const montrees = classes.slice(0, LIGNES_DU_CLASSEMENT)
    const i = pour ? classes.findIndex(c => c.item.profil.id === pour) : -1
    const sienne = i >= 0 ? classes[i] : undefined
    const sonLundi = sienne && auLundi.get(sienne.item)
    return {
      joueurs: joueurs.length,
      lignes: montrees.map(ligne),
      ...(sienne && !montrees.includes(sienne) && { moi: ligne(sienne) }),
      ...(sienne && { sienne: sienne.item.profil.id }),
      // Sa ligne entre ses deux voisins : l'onglet du classement les montre, même au-delà des lignes envoyées.
      ...(sienne && { autour: classes.slice(Math.max(0, i - 1), i + 2).map(ligne) }),
      ...(sienne && sonLundi !== undefined && { progression: sonLundi - sienne.rang }),
      ...(pour && aSaPortee(classes, pour, cotes.get(pour)?.cote ?? COTE_DE_DEPART, !!sienne, ligne)),
    }
  }

  /**
   * La place de chacun au lundi : celle que donnerait la cote de chacun au
   * lundi (`SemaineJouee.debut` — sans duel cette semaine, sa cote n'a pas
   * bougé). Ceux qui ont joué leur premier duel cette semaine n'étaient pas
   * classés : ils ne comptent devant personne, et eux-mêmes, tout neufs,
   * n'ont rien gagné qu'on puisse dire — ils n'y sont pas. La règle des
   * rangs reste celle de tous les classements (invariant 15).
   */
  private rangsAuLundi<T extends { profil: ProfileRec; releve: ReleveDesDuels }>(joueurs: readonly T[], nom: (j: T) => string): Map<T, number> {
    const semaine = this.semaineDeLHeure().semaine
    const auLundi = (j: T) => j.releve.semaines.get(semaine)?.debut ?? j.releve.cote
    const dejaClasse = (j: T) => j.releve.joues > (j.releve.semaines.get(semaine)?.duels ?? 0)
    return new Map(classer(joueurs.filter(dejaClasse), auLundi, nom, j => j.profil.id).map(c => [c.item, c.rang]))
  }

  /**
   * Sa place au classement des duels — 1 + ceux qui sont strictement devant
   * (invariant 15) —, comptée sur les cotes de tous (`toutesLesCotes`) sans
   * lire un seul profil : ceux que le classement nomme, un duel ces quatre
   * dernières semaines et pas masqués. Rien tant qu'il n'y est pas : la carte
   * du verdict la dit sous sa cote.
   */
  private async rangAuxDuels(profileId: string): Promise<number | undefined> {
    const cotes = await this.toutesLesCotes()
    const depuis = this.maintenant() - JOURS_DU_CLASSEMENT * 24 * HEURE_MS
    const sienne = cotes.get(profileId)
    if (!sienne || sienne.dernierLe === null || sienne.dernierLe < depuis) return undefined
    const autres = [...cotes].filter(([id, r]) => id !== profileId && r.dernierLe !== null && r.dernierLe >= depuis && !this.masque?.(id)).map(([, r]) => r.cote)
    return rangPartage(sienne.cote, autres)
  }

  /**
   * La page des duels (`GET /api/duels`) : sa cote et sa ligue, sa semaine —
   * et la passée, si elle a payé —, le classement, son duel en route et ses
   * derniers. Ses rencontres et ses duels d'un aller-retour, le classement
   * et ses duels contre quelqu'un de front : ceux-ci attendaient le premier
   * lot, dont ils ne dépendent pas, puis se lisaient en deux fois — trois
   * allers-retours l'un derrière l'autre à chaque ouverture de la page (le
   * 13 octobre 2026 ; `duels-attente.test.ts`).
   */
  async etatDesDuels(profileId: string): Promise<EtatDesDuels> {
    const maintenant = this.maintenant()
    const [{ rencontres, releve, racontes }, classement, sesDuels] = await Promise.all([
      this.rencontresEtDuels(profileId, true),
      this.classementDesDuels(profileId),
      this.client.batch(lecturesDesDuelsContre(profileId, maintenant), 'read'),
    ])
    // Les cotes de tous, que le classement vient de lire : la ligue de chacun de ses adversaires.
    const cotes = await this.toutesLesCotes()
    // Son bilan et son historique de front avec ses duels en cours : chacun lit ses adversaires, de mémoire le plus souvent.
    const [contre, { bilan, historique }] = await Promise.all([this.duelsContre(profileId, maintenant, sesDuels, releve, cotes), this.bilanEtHistoire(racontes, releve, maintenant, cotes)])
    const passee = releve.semaines.get(this.semaineDeLHeure().passee)
    const payee = recompenseDeLaSemaine(passee)
    return {
      cote: releve.cote,
      ligue: ligueDe(releve.cote).cle,
      joues: releve.joues,
      // La ligue gardée, que ce que la page dit d'un duel ne traverse pas (`enjeuContre`).
      ...(releve.plancher !== null && { plancher: releve.plancher }),
      semaine: this.semaineDesDuels(releve),
      ...(passee && payee > 0 && { semainePassee: { ligue: ligueDe(passee.meilleure).cle, duels: passee.duels, confettis: payee } }),
      classement,
      enCours: rencontres.enCours,
      dernieres: rencontres.passees,
      contre,
      bilan,
      historique,
    }
  }

  /**
   * Son bilan — ses records, ses face-à-face, la courbe de sa cote — et la
   * première page de son historique, relus de son journal raconté. Un
   * face-à-face ne nomme ni un masqué ni un profil parti, il n'y paraît pas ;
   * une ligne d'historique dit « Un joueur », comme ses duels en cours.
   */
  private async bilanEtHistoire(
    racontes: readonly DuelRaconte[],
    releve: ReleveDesDuels,
    maintenant: number,
    cotes: ReadonlyMap<string, ReleveDesDuels>,
  ): Promise<{ bilan: BilanDesDuels; historique: PageDHistoire }> {
    const { plusBelle, faceAFace, ...chiffres } = bilanDesDuels(racontes, releve.ecarts)
    const page = pageDeLHistoire(racontes, releve.ecarts, maintenant - JOURS_DE_L_HISTOIRE * 24 * HEURE_MS, DUELS_DE_L_HISTOIRE)
    // Un masqué se sait en mémoire, sans rien lire ; un profil parti, à sa lecture : de quoi en remplacer quelques-uns.
    const faces = faceAFace.filter(f => f.contre === '' || !this.masque?.(f.contre)).slice(0, 2 * FACE_A_FACE_MONTRES)
    const qui = await this.quiAffrontes([...faces.map(f => f.contre), ...(plusBelle ? [plusBelle.contre] : []), ...page.duels.map(d => d.contre)], cotes)
    const nommes = faces.flatMap(f => (qui.get(f.contre) ? [{ ...f, contre: qui.get(f.contre)! }] : [])).slice(0, FACE_A_FACE_MONTRES)
    // Deux adversaires du même prénom et du même avatar se distinguent à l'affichage, jamais en base (invariant 17).
    const marques = nomsAffiches(nommes.map(f => ({ id: f.contre.profileId ?? '', name: f.contre.nom, avatar: f.contre.avatar, legendaire: f.contre.legendaire })))
    return {
      bilan: {
        ...chiffres,
        ...(plusBelle && { plusBelle: { ...plusBelle, contre: qui.get(plusBelle.contre) ?? UN_JOUEUR } }),
        faceAFace: nommes.map(f => ({ ...f, contre: { ...f.contre, nom: marques.get(f.contre.profileId ?? '') ?? f.contre.nom } })),
      },
      historique: { duels: page.duels.map(d => ligneDHistoire(d, qui.get(d.contre) ?? UN_JOUEUR)), suite: page.suite },
    }
  }

  /**
   * Contre qui, tel que son bilan et son historique le disent : chaque profil
   * nommé — sa ligue, ce qu'il porte, sans sa bordure : l'anneau dit déjà sa
   * ligue —, Automate pour '' ; `null` pour un masqué ou un profil parti. Lus
   * d'un coup, de mémoire le plus souvent (`byIds`).
   */
  private async quiAffrontes(ids: readonly string[], cotes: ReadonlyMap<string, ReleveDesDuels>): Promise<Map<string, QuiAffronte | null>> {
    const profils = [...new Set(ids)].filter(id => id !== '')
    const lus = profils.length > 0 && this.profils ? await this.profils.byIds(profils) : []
    const qui = new Map<string, QuiAffronte | null>([['', { nom: AUTOMATE.nom, avatar: AUTOMATE.avatar }]])
    profils.forEach((id, i) => {
      const p = lus[i] ?? null
      if (!p || this.masque?.(p.id) || !this.profils) return void qui.set(id, null)
      const saCote = cotes.get(id)
      qui.set(id, {
        profileId: id,
        nom: p.name,
        avatar: this.profils.avatarPorte(p),
        ...(saCote && saCote.joues > 0 && { ligue: ligueDe(saCote.cote).cle }),
        ...sonApparence(this.profils, p),
      })
    })
    return qui
  }

  /**
   * La suite de son historique, au « Voir plus » : vingt duels de plus, après
   * le dernier qu'il a sous les yeux — sa date et sa série —, un mois au plus.
   */
  async historiqueDesDuels(profileId: string, le: unknown, cle: unknown): Promise<PageDHistoire> {
    const apres = { le: typeof le === 'string' ? Number(le) : NaN, cle: typeof cle === 'string' ? tronquer(cle, 64) : '' }
    if (!Number.isFinite(apres.le) || !apres.cle) throw new Error('Cette page de ton historique est introuvable : recharge la page')
    const maintenant = this.maintenant()
    const [duels, adversaires] = await this.client.batch([lectureDesDuels(profileId, maintenant), lectureDesAdversaires(profileId)], 'read')
    const joues = duelsLus(duels.rows)
    const releve = releverLesDuels(joues, semaineDeLInstant)
    const page = pageDeLHistoire(duelsRacontes(joues, adversaires.rows), releve.ecarts, maintenant - JOURS_DE_L_HISTOIRE * 24 * HEURE_MS, DUELS_PAR_SUITE, apres)
    const qui = await this.quiAffrontes(page.duels.map(d => d.contre), await this.toutesLesCotes())
    return { duels: page.duels.map(d => ligneDHistoire(d, qui.get(d.contre) ?? UN_JOUEUR)), suite: page.suite }
  }

  /**
   * Ses duels contre quelqu'un, des trente derniers jours : ceux où c'est à
   * lui de jouer d'abord, puis ceux qui attendent l'autre, puis les joués et
   * les fermés, les plus récents d'abord. Un duel qu'on lui a lancé ne paraît
   * qu'une fois parti : avant la dernière réponse de qui le défie, il
   * n'existe pas pour lui. Le score d'en face ne s'y lit qu'une fois sa
   * propre tentative finie ; chaque adversaire, sa ligue (`cotes`). Lus d'un
   * lot (`lecturesDesDuelsContre`).
   */
  private async duelsContre(
    profileId: string,
    maintenant: number,
    [lignes, tentatives, recus]: readonly ResultSet[],
    releve: ReleveDesDuels,
    cotes?: ReadonlyMap<string, ReleveDesDuels>,
  ): Promise<DuelContre[]> {
    const duels = lignes.rows.map(duelContreLu).filter(d => d.adversaire)
    if (duels.length === 0) return []
    const recu = new Set(recus.rows.map(r => String(r.code)))
    const tentative = (code: string, id: string) => tentatives.rows.find(r => String(r.duel) === code && String(r.profile_id) === id)
    const autres = [...new Set(duels.map(d => (d.auteur === profileId ? d.adversaire! : d.auteur)))]
    const profils = this.profils ? await this.profils.byIds(autres) : []
    const parId = new Map(autres.map((id, i) => [id, profils[i] ?? null]))
    const vus = duels.flatMap((d): DuelContre[] => {
      const lance = d.auteur === profileId
      const autre = lance ? d.adversaire! : d.auteur
      // Lancé contre lui : rien tant qu'il ne lui est pas parti.
      if (!lance && !recu.has(d.code)) return []
      const sienne = tentative(d.code, profileId)
      const enFace = tentative(d.code, autre)
      // Fermé, une tentative commencée compte sur ce qu'elle a atteint (`lectureDesDuels`).
      const ferme = d.fermeLe <= maintenant
      const finie = (t: Record<string, unknown> | undefined) => t !== undefined && ((t.finie_le !== null && t.finie_le !== undefined) || ferme)
      const p = parId.get(autre)
      const nomme = p && !this.masque?.(p.id)
      const joue = finie(sienne) && finie(enFace)
      const ecart = joue ? releve.ecarts.get(String(sienne!.id))?.ecart : undefined
      // Quand il a compté : la seconde tentative finie — une tentative laissée en route compte à la fermeture.
      const le = joue ? Math.max(Number(sienne!.finie_le ?? d.fermeLe), Number(enFace!.finie_le ?? d.fermeLe)) : undefined
      const saCote = cotes?.get(autre)
      return [
        {
          code: d.code,
          contre: {
            profileId: autre,
            nom: nomme ? p.name : 'Un joueur',
            avatar: nomme && this.profils ? this.profils.avatarPorte(p) : '🎲',
            ...(nomme && saCote && saCote.joues > 0 && { ligue: ligueDe(saCote.cote).cle }),
            // Ce qu'il porte : son légendaire dans « En cours », comme au classement de la même page — sans sa
            // bordure, que l'anneau de sa ligue dit déjà.
            ...(nomme && this.profils && sonApparence(this.profils, p)),
          },
          lance,
          ...(d.sujet && { sujet: d.sujet }),
          ...(d.categories && d.categories.length > 0 && { categories: d.categories }),
          justes: finie(sienne) ? Number(sienne!.justes) : null,
          // Le score d'en face, une fois les deux tentatives finies : le résultat. Le score à battre ne part
          // jamais avant sa dernière réponse — il se voyait avant même de jouer (le 12 octobre 2026).
          sesJustes: joue ? Number(enFace!.justes) : null,
          ...(ecart !== undefined && { ecart }),
          ...(le !== undefined && { le }),
          // Joué des deux côtés, pas encore vu par qui l'a lancé : son résultat l'attend.
          ...(lance && ecart !== undefined && d.vuLe === null && { nouveau: true as const }),
          minutesRestantes: Math.max(0, Math.ceil((d.fermeLe - maintenant) / 60_000)),
        },
      ]
    })
    // À lui de jouer d'abord, puis ce qui attend l'autre, puis le reste.
    const ordre = (d: DuelContre) => (d.minutesRestantes > 0 && d.justes === null ? 0 : d.minutesRestantes > 0 && d.sesJustes === null ? 1 : 2)
    return vus.map((d, i) => ({ d, i })).sort((a, b) => ordre(a.d) - ordre(b.d) || a.i - b.i).map(({ d }) => d)
  }

  /**
   * Ce que le bouton des duels dit sur l'accueil : sa ligue, sa cote, sa
   * semaine — et, devant, un défi qu'un ami lui a envoyé ou son duel laissé en
   * route. D'un aller-retour, lu de front avec ses sentiers.
   */
  async accueilDesDuels(profileId: string): Promise<DuelsDAccueil> {
    const maintenant = this.maintenant()
    const siens = sesDuelsContre(profileId, maintenant)
    const [duels, recus, ouverte, resultats] = await this.client.batch(
      [
        lectureDesDuels(profileId, maintenant),
        lectureDesDefisRecus(profileId, maintenant),
        { sql: `SELECT adversaire FROM campagne_series WHERE profile_id = ? AND mode = 'rencontre' AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1`, args: [profileId] },
        // Ses duels joués des deux côtés dont il n'a pas vu le résultat — lus de la règle
        // qui les montre sur la page (`lecturesDesDuelsContre`) : compté ici, chacun y paraît.
        {
          sql: `${siens.sql} SELECT code, adversaire FROM campagne_duels WHERE code IN (${RESULTATS_A_VOIR}) ORDER BY cree_le DESC`,
          args: [...siens.args, DUELS_MONTRES],
        },
      ],
      'read',
    )
    const releve = releverLesDuels(duelsLus(duels.rows), semaineDeLInstant)
    const passee = releve.semaines.get(this.semaineDeLHeure().passee)
    const payee = recompenseDeLaSemaine(passee)
    // Ni un masqué, ni un ami qu'il a retiré : ce que la page des duels montre (`mesAmis`), sans relire toute sa liste d'amis.
    const auteurs = recus.rows.map(r => String(r.auteur)).filter(a => !this.masque?.(a))
    const adversaire = lireAdversaire(ouverte.rows[0]?.adversaire)
    const premierResultat = resultats.rows[0]
    const [dernier, contre, joueContre] = await Promise.all([
      auteurs.length > 0 && this.profils ? this.profils.byIds([auteurs[0]]).then(([x]) => x) : null,
      adversaire ? this.adversaireVu(adversaire) : null,
      premierResultat && this.profils ? this.profils.byIds([String(premierResultat.adversaire)]).then(([x]) => x) : null,
    ])
    return {
      cote: releve.cote,
      ligue: ligueDe(releve.cote).cle,
      joues: releve.joues,
      semaine: (({ duels, ligue }) => ({ duels, ligue }))(this.semaineDesDuels(releve)),
      ...(dernier && { defisRecus: { n: auteurs.length, de: dernier.name } }),
      // Un masqué ne se nomme pas, même ici : « Un joueur a joué ton duel ».
      ...(premierResultat && {
        resultats: {
          n: resultats.rows.length,
          de: joueContre && !this.masque?.(joueContre.id) ? joueContre.name : 'Un joueur',
          code: String(premierResultat.code),
        },
      }),
      ...(contre && { enCours: { nom: contre.nom } }),
      ...(passee && payee > 0 && { semainePassee: { ligue: ligueDe(passee.meilleure).cle, confettis: payee } }),
      // Ses bordures de ligue : l'accueil montre celle qu'il porte autour de son avatar.
      ...(releve.bordures.length > 0 && { bordures: releve.bordures }),
    }
  }

  /**
   * Les vainqueurs du défi de la semaine passée : le laurier d'argent suit
   * leur prénom toute la semaine. Lus en mémoire, sans attendre — chaque
   * diffusion à toute la salle les demande. Le lundi, ceux d'avant se taisent
   * aussitôt, et la semaine se clôt en arrière-plan si personne n'a encore
   * ouvert le défi.
   */
  vainqueursDuDefi(): ReadonlySet<string> {
    const { passee } = this.semaineDeLHeure()
    if (this.argent.semaine === passee) return this.argent.ids
    if (!this.argentEnRoute && !this.ferme) {
      this.argentEnRoute = this.cloreLesDefis()
        .catch(e => {
          if (!this.ferme) console.error('[campagne] le défi de la semaine passée n’a pas pu se clore :', e)
        })
        .finally(() => {
          this.argentEnRoute = null
        })
    }
    return AUCUN_VAINQUEUR
  }

  // ── Les sentiers du savoir ──────────────────────────────────────────────
  //
  // Le second mode de la campagne (`shared/sentiers.ts`) : douze paliers par
  // branche, une épreuve de seize questions par palier, des vies du jour.
  // Une épreuve est une série d'un autre mode, dans les mêmes tables ; les
  // paliers validés, les étoiles et les vies se lisent dans ce journal à
  // chaque fois — rien ne se tient à côté qu'un hoquet de la base fausserait.

  /** Ses vies achetées (`ProfileStore.viesAcheteesDe`), branchées au démarrage : les confettis sont chez le profil, les vies ici. */
  viesAchetees?: (profileId: string) => Promise<number>
  /** Les vies achetées depuis un instant, tous profils : l'administration le dit. */
  viesAcheteesDepuis?: (depuis: number) => Promise<number>
  /** Les achats de vies depuis un instant, un par ligne, avec leur prix : le QG les dit jour par jour (`ProfileStore.achatsDeViesDepuis`). */
  achatsDeViesDepuis?: (depuis: number) => Promise<{ quand: number; nombre: number; prix: number }[]>

  /** Ce qu'il tenait d'avant les sentiers, et ses épreuves validées : les deux lectures de ses sentiers. */
  private lecturesDesSentiers(profileId: string): InStatement[] {
    return [{ sql: 'SELECT branche, paliers FROM sentier_acquis WHERE profile_id = ?', args: [profileId] }, this.lectureDesValidees(profileId)]
  }

  /** Ses épreuves validées, rejeux compris : ses paliers et leurs étoiles (`sentiersLus`). */
  private lectureDesValidees(profileId: string): InStatement {
    return {
      sql: `SELECT branche, palier, justes, seuil FROM campagne_series WHERE profile_id = ? AND mode = 'sentier' AND issue = 'validee'`,
      args: [profileId],
    }
  }

  /**
   * Les paliers validés de chaque sentier commencé : ceux d'avant les
   * sentiers, et ses épreuves validées — ce qui ouvre ses portraits. Un
   * sentier pas encore commencé n'y paraît pas.
   */
  async paliersDe(profileId: string): Promise<Paliers> {
    const [acquis, validees] = await this.client.batch(this.lecturesDesSentiers(profileId), 'read')
    return paliersCommences(sentiersLus(acquis.rows, validees.rows))
  }

  /** Ses épreuves ratées, chacune au jour où elle l'a été : ce qui a coûté ses vies. */
  private lectureDesEchecs(profileId: string): InStatement {
    return {
      sql: `SELECT finie_le FROM campagne_series WHERE profile_id = ? AND mode = 'sentier' AND rejeu = 0 AND issue = 'ratee' AND finie_le IS NOT NULL`,
      args: [profileId],
    }
  }

  /** L'épreuve qu'il a laissée en cours, s'il en a une : une seule à la fois. */
  private lectureDeLEpreuveOuverte(profileId: string): InStatement {
    return {
      sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'sentier' AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1`,
      args: [profileId],
    }
  }

  /** Ses vies : celles du jour, et sa réserve (`viesDe`), relues dans le journal de ses épreuves ratées. */
  private viesLues(echecs: readonly Record<string, unknown>[], achetees: number): VieDesSentiers {
    const maintenant = this.maintenant()
    const parJour = new Map<string, number>()
    for (const r of echecs) {
      const jour = jourDe(Number(r.finie_le))
      parJour.set(jour, (parJour.get(jour) ?? 0) + 1)
    }
    const { jour, reserve } = viesDe(parJour, achetees, jourDe(maintenant))
    return { jour, reserve, parJour: VIES_PAR_JOUR, prix: PRIX_D_UNE_VIE, renouveleesLe: maintenant + minutesAvantMinuit(maintenant) * 60_000 }
  }

  private async vies(profileId: string): Promise<VieDesSentiers> {
    const [echecs, achetees] = await Promise.all([this.client.execute(this.lectureDesEchecs(profileId)), this.viesAchetees?.(profileId) ?? 0])
    return this.viesLues(echecs.rows, achetees)
  }

  private async epreuveEnCours(profileId: string): Promise<Serie | null> {
    const res = await this.client.execute(this.lectureDeLEpreuveOuverte(profileId))
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  /**
   * Tout ce que ses sentiers disent de lui — ses paliers, ses vies, l'épreuve
   * laissée — en un lot, à côté de ses vies achetées, qui sont chez le
   * profil : deux allers-retours de front, l'accueil les attend. La page des
   * sentiers y ajoute ses premières réponses (`avecSesPremieres`), dans le
   * même lot : sa chance sur chaque sentier ne coûte pas un aller-retour.
   */
  private async lireLesSentiers(
    profileId: string,
    avecSesPremieres = false,
  ): Promise<{ sentiers: SentierDuJoueur[]; vies: VieDesSentiers; ouverte: Serie | null; premieres: Map<string, PremiereReponse> | null }> {
    const [[acquis, validees, echecs, ouverte, premieres], achetees] = await Promise.all([
      this.client.batch(
        [
          ...this.lecturesDesSentiers(profileId),
          this.lectureDesEchecs(profileId),
          this.lectureDeLEpreuveOuverte(profileId),
          ...(avecSesPremieres ? [lectureDesPremieres(profileId)] : []),
        ],
        'read',
      ),
      this.viesAchetees?.(profileId) ?? 0,
    ])
    return {
      sentiers: sentiersLus(acquis.rows, validees.rows),
      vies: this.viesLues(echecs.rows, achetees),
      ouverte: ouverte.rows[0] ? versSerie(ouverte.rows[0]) : null,
      premieres: premieres ? lireLesPremieres(premieres.rows) : null,
    }
  }

  /**
   * La page des sentiers : ses vies, chaque sentier — ses paliers, ses
   * étoiles —, l'épreuve qu'il a laissée, et sa chance sur chacun
   * (`chancesPourLui`).
   */
  async etatDesSentiers(profileId: string): Promise<EtatDesSentiers> {
    // Le modèle du savoir tel qu'il est — refait en fond s'il a vieilli, jamais
    // attendu : sans lui, la page ne dit pas de chance. Les questions et leur
    // mesure, gardées en mémoire, partent de front avec la lecture.
    const modele = this.modeleDuSavoir()
    const tirage = modele ? Promise.all([this.base(), this.jouables(), this.mesures()]) : null
    tirage?.catch(() => {})
    const { sentiers, vies, ouverte, premieres } = await this.lireLesSentiers(profileId, modele !== null)
    let pourToi: ChanceDuSentier[] | undefined
    if (modele && tirage && premieres) {
      try {
        pourToi = this.chancesPourLui(profileId, sentiers, premieres, modele, ...(await tirage))
      } catch (e) {
        // Sa chance n'est qu'un renseignement : la page s'ouvre sans elle.
        console.warn('[campagne] chance des sentiers non calculée :', e instanceof Error ? e.message : e)
      }
    }
    // Les mélanges réglés au QG : la page lit la difficulté d'un palier dessus, pas sur celui du code.
    return {
      vies,
      sentiers,
      epreuve: ouverte ? vueDEpreuve(ouverte) : null,
      ...(this.melanges.size > 0 && { melanges: this.melangesRegles() }),
      ...(pourToi && { pourToi }),
    }
  }

  /**
   * Sa chance de valider le palier qui l'attend, sur chaque sentier
   * (`chanceDeLEpreuve`) — et, s'il a assez répondu depuis dans la
   * catégorie, ce qu'elle valait il y a une semaine, aux difficultés
   * d'aujourd'hui : ce que ses réponses ont changé, rien d'autre. Sa force se
   * relit de ses premières réponses à chaque fois, partie de celle du modèle,
   * comme au dé : le modèle, refait en fond, n'a peut-être pas vu sa
   * dernière épreuve. Rien sous `PREMIERES_REPONSES_POUR_SA_CHANCE`
   * premières réponses : la page ne dirait que la chance d'un joueur moyen.
   */
  private chancesPourLui(
    profileId: string,
    sentiers: readonly SentierDuJoueur[],
    premieres: ReadonlyMap<string, PremiereReponse>,
    modele: ModeleDuSavoir,
    base: BaseDeLaCampagne,
    jouables: readonly QuestionDeLaBase[],
    mesure: ReadonlyMap<string, MesureDUneQuestion>,
  ): ChanceDuSentier[] | undefined {
    const { reference, forceDe } = this.forceSurLesSentiers(profileId, modele, base, jouables, mesure)
    const depuis = this.maintenant() - JOURS_DE_SA_PROGRESSION * 24 * HEURE_MS
    const toutes = new Map<string, boolean>()
    const avant = new Map<string, boolean>()
    // Ses premières réponses par catégorie, d'avant la semaine et de la
    // semaine : sa chance d'avant ne se dit que là où il avait déjà répondu,
    // et où il a répondu depuis. Sans les premières, elle ne disait que son
    // niveau d'ailleurs — « 27 % il y a une semaine » sur un sport qu'il
    // n'avait jamais joué ; sans les secondes, rien de ce qu'il a fait.
    const anciennes = new Array<number>(CATEGORIES.length).fill(0)
    const recentes = new Array<number>(CATEGORIES.length).fill(0)
    for (const [id, p] of premieres) {
      toutes.set(id, p.juste)
      const c = indiceDeCategorie(base.parId.get(id)?.meta.categorie ?? '')
      if (p.le < depuis) {
        avant.set(id, p.juste)
        if (c >= 0) anciennes[c]++
      } else if (c >= 0) recentes[c]++
    }
    const lui = forceDe(toutes)
    if (lui.reponses < PREMIERES_REPONSES_POUR_SA_CHANCE) return undefined
    const luiAvant = forceDe(avant, lui)
    const avantSeLit = luiAvant.reponses >= PREMIERES_REPONSES_POUR_SA_CHANCE
    const melanges = this.melangesRegles()
    return sentiers.flatMap((s): ChanceDuSentier[] => {
      const regle = regleDuPalier(s.paliers + 1, melanges)
      const c = indiceDeCategorie(brancheParCle(s.branche)?.categorie ?? '')
      if (!regle || c < 0) return []
      const progresse = avantSeLit && anciennes[c] >= REPONSES_DE_SA_PROGRESSION && recentes[c] >= REPONSES_DE_SA_PROGRESSION
      return [{ branche: s.branche, palier: regle.n, chance: saChanceSur(reference, c, lui, regle), ...(progresse && { avant: saChanceSur(reference, c, luiAvant, regle) }) }]
    })
  }

  /**
   * De quoi dire sa chance sur un palier : la série de référence de chaque
   * catégorie, et sa force relue de premières réponses (`forceDuJoueur`) —
   * partie de celle du modèle, comme au dé : refait en fond, il n'a peut-être
   * pas vu sa dernière épreuve. La page (`chancesPourLui`) et le départ d'une
   * épreuve (`chanceAuDepart`) la lisent par ici : Contre toute attente juge
   * l'épreuve à la chance même que la page annonçait.
   */
  private forceSurLesSentiers(
    profileId: string,
    modele: ModeleDuSavoir,
    base: BaseDeLaCampagne,
    jouables: readonly QuestionDeLaBase[],
    mesure: ReadonlyMap<string, MesureDUneQuestion>,
  ): { reference: SerieDeReference; forceDe: (premieres: ReadonlyMap<string, boolean>, depart?: ForceDUnJoueur) => ForceDUnJoueur } {
    const reference = this.referencePour(jouables, mesure, modele)
    const question = (id: string) => {
      const q = base.parId.get(id)
      return q && { categorie: q.meta.categorie, difficulte: modele.difficultes.get(id) ?? difficulteSansModele(q.meta.difficulte, mesure.get(id)) }
    }
    return { reference, forceDe: (premieres, depart = modele.forces.get(profileId)) => forceDuJoueur(premieres, question, reference.forceDeDepart, depart) }
  }

  /**
   * La chance que la page des sentiers lui annonce sur ce palier
   * (`chancesPourLui`), au départ d'une épreuve en jeu : gardée avec elle
   * (`campagne_series.chance`), Contre toute attente la relit à sa fin. Ses
   * premières réponses viennent de la lecture que le tirage vient de faire :
   * pas un aller-retour de plus. Null sans modèle — il se lance en fond —,
   * sous vingt premières réponses, comme la page, ou si le calcul échoue : ce
   * n'est qu'un renseignement, l'épreuve part sans lui.
   */
  private async chanceAuDepart(
    profileId: string,
    categorie: string,
    regle: RegleDuPalier,
    premieres: ReadonlyMap<string, boolean>,
    mesure: ReadonlyMap<string, MesureDUneQuestion>,
  ): Promise<number | null> {
    const modele = this.modeleDuSavoir()
    const c = indiceDeCategorie(categorie)
    if (!modele || c < 0) return null
    try {
      const [base, jouables] = await Promise.all([this.base(), this.jouables()])
      const { reference, forceDe } = this.forceSurLesSentiers(profileId, modele, base, jouables, mesure)
      const lui = forceDe(premieres)
      return lui.reponses < PREMIERES_REPONSES_POUR_SA_CHANCE ? null : saChanceSur(reference, c, lui, regle)
    } catch (e) {
      console.warn('[campagne] chance de l’épreuve non gardée :', e instanceof Error ? e.message : e)
      return null
    }
  }

  /** Les mélanges réglés depuis le QG, palier par palier ; vide : ceux du code. */
  melangesRegles(): MelangesRegles {
    return Object.fromEntries([...this.melanges].map(([palier, r]) => [palier, r.melange]))
  }

  /**
   * Règle le mélange d'un palier, pour les douze sentiers — ou le rend à
   * celui du code (`null`). Seules les épreuves qui commencent le tirent :
   * une épreuve en cours garde ses questions, un palier validé ne se reprend
   * jamais, et les étoiles se lisent au seuil de leur épreuve. Rend le
   * mélange d'avant et celui d'après, pour le journal du QG. Un réglage qui
   * ne changerait rien se refuse : le journal ne note que ce qui a changé.
   */
  async reglerLeMelange(n: unknown, melange: unknown): Promise<{ palier: number; avant: Melange; apres: Melange; origine: boolean }> {
    const refus = melange === null ? null : refusDuMelange(n, melange)
    if (refus) throw new Error(refus)
    const regle = regleDuPalier(n)
    if (!regle) throw new Error('Ce palier n’existe pas')
    if (regle.maitre) throw new Error('Le palier de maître garde ses seize expertes : seuls les douze paliers se règlent')
    const avant = this.melanges.get(regle.n)?.melange ?? regle.melange
    const apres = melange === null ? regle.melange : melangePropre(melange as Melange)
    if (memeMelange(apres, avant)) throw new Error(melange === null ? 'Ce palier a déjà son mélange d’origine' : 'Ce palier pose déjà ce mélange')
    // Celui du code : pas un réglage, le palier y revient.
    const origine = memeMelange(apres, regle.melange)
    const maintenant = this.maintenant()
    await this.client.execute(
      origine
        ? { sql: 'DELETE FROM sentier_melanges WHERE palier = ?', args: [regle.n] }
        : {
            sql: `INSERT INTO sentier_melanges (palier, melange, regle_le) VALUES (?, ?, ?)
                  ON CONFLICT(palier) DO UPDATE SET melange = excluded.melange, regle_le = excluded.regle_le`,
            args: [regle.n, JSON.stringify(apres), maintenant],
          },
    )
    if (origine) this.melanges.delete(regle.n)
    else this.melanges.set(regle.n, { melange: apres, regleLe: maintenant })
    return { palier: regle.n, avant, apres, origine }
  }

  /**
   * Ce que le bouton de la campagne dit sur l'accueil : ses vies, le sentier
   * qu'il avance (`sentierQuOnAvance`) — rien tant qu'il n'en a commencé
   * aucun, ni épreuve ni portrait d'avant —, et ce que son carnet a à revoir
   * aujourd'hui : c'est le rendez-vous du lendemain, que l'accueil taisait —
   * l'onglet le comptait, deux écrans plus loin (l'experte du jeu solo, le
   * 11 octobre 2026). Compté sans la base, qu'un démarrage n'a peut-être pas
   * encore lue : seules les questions retirées en sortent. Et le défi de la
   * semaine, qu'on ne trouvait qu'au troisième onglet (`defiDAccueil`). Les
   * défis des amis sont au bouton des duels (`accueilDesDuels`).
   */
  async accueilDesSentiers(profileId: string): Promise<SentiersDAccueil> {
    const [{ sentiers, vies, ouverte }, suivis, defi] = await Promise.all([
      this.lireLesSentiers(profileId),
      this.suivisDe(profileId),
      // Une base qui s'en tait n'ôte que lui : le bouton garde son sentier et son carnet.
      this.defiDAccueil(profileId).catch(e => {
        console.error('[campagne] défi de l’accueil illisible :', e)
        return null
      }),
    ])
    const laissee = ouverte?.branche && ouverte.palier ? { branche: ouverte.branche, palier: ouverte.palier } : null
    const aRevoir = this.compterARevoir(suivis)
    return { vies: vies.jour + vies.reserve, avance: sentierQuOnAvance(sentiers, laissee), ...(aRevoir > 0 && { aRevoir }), ...(defi && { defi }) }
  }

  /** Les questions de son carnet à revoir aujourd'hui, comme l'accueil les compte : le tirage de ses missions du jour en propose une révision. */
  async aRevoirDe(profileId: string): Promise<number> {
    return this.compterARevoir(await this.suivisDe(profileId))
  }

  /** Ce que son carnet a à revoir aujourd'hui, parmi les questions que la campagne pose encore — la même règle que la page du carnet. */
  private compterARevoir(suivis: ReadonlyMap<string, SuiviDeRevision>): number {
    const aujourdhui = jourDe(this.maintenant())
    let aRevoir = 0
    for (const [id, s] of suivis) if (!s.apprise && s.revientLe <= aujourdhui && !this.retirees.has(id)) aRevoir++
    return aRevoir
  }

  /**
   * Le défi de la semaine sur le bouton de la campagne, en une lecture, de
   * front avec le reste : ceux qui l'ont relevé — une réponse au moins, comme
   * son classement —, le sien s'il l'a ouvert, s'il en a relevé un une
   * semaine passée, et le lundi, le jour où il est neuf. Rien s'il l'a fini,
   * ni à qui n'a jamais joué la campagne : son bouton lui dit d'abord ce
   * qu'on y fait.
   */
  private async defiDAccueil(profileId: string): Promise<DefiDAccueil | null> {
    const { semaine } = this.semaineDeLHeure()
    const res = await this.client.execute({
      sql: `SELECT
              (SELECT COUNT(*) FROM campagne_series WHERE mode = 'defi' AND semaine = ? AND position > 0) AS joueurs,
              (SELECT finie_le IS NOT NULL FROM campagne_series WHERE profile_id = ? AND mode = 'defi' AND semaine = ? ORDER BY commencee_le LIMIT 1) AS finie,
              EXISTS (SELECT 1 FROM campagne_series WHERE profile_id = ? AND mode = 'defi' AND semaine < ?) AS habitue,
              EXISTS (SELECT 1 FROM campagne_series WHERE profile_id = ?) AS joue`,
      args: [semaine, profileId, semaine, profileId, semaine, profileId],
    })
    const r = res.rows[0]
    // `finie` : null sans tentative, 0 ouverte, 1 finie.
    if (!r || !Number(r.joue) || Number(r.finie) === 1) return null
    return {
      joueurs: Number(r.joueurs),
      ...(r.finie != null && { commence: true as const }),
      ...(Number(r.habitue) > 0 && { habitue: true as const }),
      ...(semaine === jourDe(this.maintenant()) && { neuf: true as const }),
    }
  }

  /**
   * Une épreuve : le palier qui suit le dernier validé, ou un palier déjà
   * validé, rejoué sans risque. Celle qu'il avait laissée sur ce palier
   * reprend telle quelle ; une autre laissée sans rien risquer — un rejeu,
   * ou déjà validée — se referme d'elle-même ; une autre encore en jeu
   * l'attend : il la finit, ou l'abandonne (`abandonnerEpreuve`). Il faut une
   * vie pour risquer un palier, aucune pour en rejouer un.
   */
  commencerEpreuve(profileId: string, cle: unknown, n: unknown): Promise<EpreuveDeSentier> {
    return this.avecVerrou(profileId, async () => {
      const b = brancheParCle(cle)
      if (!b) throw new Error('Ce sentier n’existe pas')
      // Le mélange du jour, réglé au QG ou celui du code : l'épreuve le tire maintenant, et ses questions ne bougent plus.
      const regle = regleDuPalier(n, this.melangesRegles())
      if (!regle) throw new Error('Ce palier n’existe pas')
      const [paliers, ouverte] = await Promise.all([this.paliersDe(profileId), this.epreuveEnCours(profileId)])
      if (ouverte) {
        if (ouverte.branche === b.key && ouverte.palier === regle.n) {
          this.garderEnCours(ouverte)
          return vueDEpreuve(ouverte)
        }
        const autre = brancheParCle(ouverte.branche)
        if (!ouverte.rejeu && ouverte.issue !== 'validee') {
          throw new Error(`Une épreuve t’attend : le palier ${ouverte.palier}${autre ? ` du sentier ${deLaBranche(autre)}` : ''}. Finis-la, ou abandonne-la.`)
        }
        await this.client.execute({ sql: 'UPDATE campagne_series SET finie_le = ? WHERE id = ?', args: [this.maintenant(), ouverte.id] })
        this.enCours.delete(profileId)
        // Validée, ce qu'elle a fait d'elle-même lui reste, rangé sans fin pour
        // le dire — sans quoi Contre toute attente, validé à la dixième
        // question puis laissé, se perdrait ici. Ses paliers attendent la fin
        // suivante, qui les annonce.
        if (ouverte.issue === 'validee') await this.recompenses?.ranger(profileId, cleDeSerie(ouverte.id), await this.hautsFaitsDe(ouverte), this.maintenant())
      }
      const valides = paliers[b.key] ?? 0
      if (regle.n > valides + 1) throw new Error(`Valide d’abord le palier ${valides + 1}`)
      const rejeu = regle.n <= valides
      if (!rejeu) {
        const vies = await this.vies(profileId)
        if (vies.jour + vies.reserve <= 0) throw new Error('Plus de vies pour aujourd’hui : elles reviennent à minuit, ou rachètes-en en confettis')
      }
      // Ce qu'il a vu, et sa première réponse à chacune : le tirage lit l'un, sa chance l'autre.
      const [jouables, mesure, lues] = await Promise.all([
        this.jouables([b.categorie]),
        this.mesures(),
        this.client.execute(lectureDesVues(profileId)).then(r => lireLesVues(r.rows)),
      ])
      // Les huit premiers paliers posent le thème de leur chapitre (`shared/chapitres.ts`).
      const chapitre = chapitreDuPalier(b.key, regle.n)?.sousThemes ?? []
      const questions = tirerUneEpreuve(jouables, regle, lues.vues, mesure, this.maintenant(), chapitre).map(x => versQuestionDeSerie(x.question, x.niveau))
      const chance = rejeu ? null : await this.chanceAuDepart(profileId, b.categorie, regle, lues.premieres, mesure)
      const e: Serie = {
        id: randomUUID(),
        profileId,
        questions,
        index: 0,
        vies: 0,
        justes: 0,
        finieLe: null,
        mode: 'sentier',
        branche: b.key,
        palier: regle.n,
        seuil: regle.seuil,
        rejeu,
        issue: null,
        chance,
      }
      await this.client.execute({
        sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, branche, palier, seuil, rejeu, issue, chance)
              VALUES (?, ?, ?, 0, 0, 0, ?, NULL, 'sentier', ?, ?, ?, ?, NULL, ?)`,
        args: [e.id, profileId, JSON.stringify(questions), this.maintenant(), b.key, regle.n, regle.seuil, rejeu ? 1 : 0, chance],
      })
      this.garderEnCours(e)
      return vueDEpreuve(e)
    })
  }

  /**
   * Une réponse d'épreuve : juste ou non, la bonne et l'anecdote, comme dans
   * la série, et la suite. Validée dès le seuil atteint — c'est écrit tout
   * de suite : une épreuve laissée là compte quand même —, elle continue
   * jusqu'à la seizième question, pour les étoiles ; ratée dès que les
   * erreurs dépassent ce que le seuil permet, elle s'arrête, et le journal
   * compte la vie perdue. Une bonne réponse paie comme dans la série : un
   * confetti, l'expérience d'une bonne réponse.
   */
  repondreEpreuve(profileId: string, id: string, index: number, choix: unknown): Promise<ReponseDEpreuve> {
    return this.avecVerrou(profileId, async () => {
      const gardee = this.enCours.get(profileId)
      const e = gardee?.id === id ? gardee : await this.serie(profileId, id)
      // Le voisin n'en sait pas plus (invariant 3) : l'épreuve d'un autre est introuvable.
      if (!e || e.mode !== 'sentier' || !e.branche || !e.palier) throw new Error('Cette épreuve est introuvable')
      if (e.finieLe !== null) throw new Error('Cette épreuve est finie')
      if (index !== e.index) throw new Error('Cette question est passée : l’épreuve a continué sans elle')
      const q = e.questions[e.index]
      const c = typeof choix === 'number' && Number.isInteger(choix) && choix >= 0 && choix < q.reponses.length ? choix : null
      const juste = c === q.bonne
      const justes = e.justes + (juste ? 1 : 0)
      const position = e.index + 1
      const seuil = e.seuil ?? regleDuPalier(e.palier)?.seuil ?? QUESTIONS_PAR_EPREUVE
      // Validée, elle le reste : les erreurs d'après ne la défont pas.
      const issue = e.issue ?? issueDe(justes, position, seuil)
      const finie = position >= e.questions.length || epreuveFinie(justes, position, seuil)
      const maintenant = this.maintenant()
      const lot: InStatement[] = [
        {
          sql: 'INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [e.id, e.index, q.id, c, juste ? 1 : 0, maintenant, this.compagnonPorte(profileId)],
        },
        {
          sql: 'UPDATE campagne_series SET position = ?, justes = ?, issue = ?, finie_le = ? WHERE id = ?',
          args: [position, justes, issue, finie ? maintenant : null, e.id],
        },
      ]
      // Finie et validée : ses épreuves validées d'avant sur ce palier — sa
      // meilleure note, pour dire un record et ce que paient ses étoiles, et
      // combien de fois il l'avait déjà validé : à la première, le palier paie
      // (`xpDuPalier`).
      const valideeIci = e.issue === null && issue === 'validee'
      if ((finie && issue === 'validee') || valideeIci) {
        lot.unshift({
          sql: `SELECT justes, seuil FROM campagne_series
                WHERE profile_id = ? AND mode = 'sentier' AND branche = ? AND palier = ? AND issue = 'validee' AND id <> ?`,
          args: [profileId, e.branche, e.palier, e.id],
        })
      }
      if (juste) lot.push(...lecturesDeLExperience(profileId))
      let res: ResultSet[]
      try {
        res = await this.client.batch(lot, 'write')
      } catch (err) {
        this.enCours.delete(profileId)
        throw err
      }
      const apres: Serie = { ...e, index: position, justes, issue, finieLe: finie ? maintenant : null }
      if (finie) this.enCours.delete(profileId)
      else this.garderEnCours(apres)
      const xp = juste ? await this.crediter(profileId, res.slice(-2)) : 0
      const reponse: ReponseDEpreuve = { juste, bonne: q.bonne, anecdote: q.anecdote, xp, epreuve: vueDEpreuve(apres) }
      // Validé pour la première fois : sa ligne, que la bonne réponse vient
      // de réécrire, le compte déjà ; la réponse le dit.
      const dAvant = valideeIci || (finie && issue === 'validee') ? res[0].rows : []
      if (valideeIci && xp > 0 && dAvant.length === 0) reponse.xpPalier = xpDuPalier(e.palier)
      if (finie && issue === 'validee') Object.assign(reponse, finDeLEpreuveValidee(e, justes, seuil, dAvant))
      if (issue === 'ratee' && !e.rejeu) reponse.vies = await this.vies(profileId)
      // Ses bonnes réponses comptent pour Le Marathonien et L'Érudit, comme
      // celles d'une série ; ses paliers et ses étoiles pour les pistes des
      // sentiers ; et ses exploits tombent avec (`hautsFaitsDe`).
      if (finie) Object.assign(reponse, await this.recompenser(profileId, e.id, await this.hautsFaitsDe(apres), this.maintenant()))
      if (finie) await this.faireGrandir(profileId)
      return reponse
    })
  }

  /**
   * Ce qu'une épreuve finie fait tomber d'elle-même (`hautsFaitsDeLEpreuve`).
   * Ses échecs d'avant sur ce palier ne se lisent que pour une épreuve validée
   * que sa chance annonçait en piste noire : une lecture de plus pour ces
   * rares-là, aucune pour les autres.
   */
  private async hautsFaitsDe(e: Serie): Promise<string[]> {
    if (!e.branche || !e.palier) return []
    const enNoir = !e.rejeu && e.issue === 'validee' && e.chance != null && couleurDePiste(e.chance) === 'noire'
    const echecs = enNoir
      ? Number(
          (
            await this.client.execute({
              sql: `SELECT COUNT(*) AS n FROM campagne_series
                    WHERE profile_id = ? AND mode = 'sentier' AND branche = ? AND palier = ? AND rejeu = 0 AND issue = 'ratee' AND id <> ?`,
              args: [e.profileId, e.branche, e.palier, e.id],
            })
          ).rows[0]?.n ?? 0,
        )
      : 0
    return hautsFaitsDeLEpreuve({ palier: e.palier, rejeu: e.rejeu, issue: e.issue, chance: e.chance }, e.justes, echecs)
  }

  /**
   * Abandonner une épreuve : un palier en jeu compte comme raté — une vie de
   * moins, sinon on fermerait l'application à la dixième erreur pour ne rien
   * perdre ; un rejeu, ou une épreuve déjà validée, se referme sans rien
   * coûter. Validée, elle s'arrête là comme à sa dernière question, et rend
   * sa fin — ses étoiles, le portrait ou le titre qu'elle ouvre, ce qui
   * tombe : arrêtée, elle sautait l'écran qui révèle le portrait, la
   * récompense même des sentiers (l'experte du jeu solo, le 11 octobre 2026).
   */
  abandonnerEpreuve(profileId: string, id: string): Promise<FinDEpreuve | null> {
    return this.avecVerrou(profileId, async () => {
      const e = await this.serie(profileId, id)
      if (!e || e.mode !== 'sentier' || !e.branche || !e.palier) throw new Error('Cette épreuve est introuvable')
      const maintenant = this.maintenant()
      const ouverte = e.finieLe === null
      if (ouverte) {
        const issue = e.issue ?? (e.rejeu ? null : 'ratee')
        await this.client.execute({ sql: 'UPDATE campagne_series SET issue = ?, finie_le = ? WHERE id = ?', args: [issue, maintenant, e.id] })
      }
      this.enCours.delete(profileId)
      if (!ouverte || e.issue !== 'validee') return null
      const seuil = e.seuil ?? regleDuPalier(e.palier)?.seuil ?? QUESTIONS_PAR_EPREUVE
      const avant = await this.client.execute({
        sql: `SELECT justes, seuil FROM campagne_series
              WHERE profile_id = ? AND mode = 'sentier' AND branche = ? AND palier = ? AND issue = 'validee' AND id <> ?`,
        args: [profileId, e.branche, e.palier, e.id],
      })
      return {
        epreuve: vueDEpreuve({ ...e, finieLe: maintenant }),
        ...finDeLEpreuveValidee(e, e.justes, seuil, avant.rows),
        // Ce qu'elle a fait compte comme à sa dernière question.
        ...(await this.recompenser(profileId, e.id, await this.hautsFaitsDe(e), maintenant)),
      }
    })
  }

  /** L'épreuve de sentier qu'il a laissée en jeu, pour la fiche d'un joueur au QG : où, depuis quand, et si l'abandonner lui coûterait une vie. */
  async epreuveLaissee(profileId: string): Promise<{ sentier: string; palier: number; depuis: number; vieEnJeu: boolean } | null> {
    const ligne = (await this.client.execute(this.lectureDeLEpreuveOuverte(profileId))).rows[0]
    const e = ligne ? versSerie(ligne) : null
    const b = e?.branche ? brancheParCle(e.branche) : undefined
    if (!ligne || !e || !b || !e.palier) return null
    return { sentier: b.nom, palier: e.palier, depuis: Number(ligne.commencee_le), vieEnJeu: !e.rejeu && e.issue !== 'validee' }
  }

  /**
   * Libère l'épreuve qu'il a laissée en jeu (« Libérer une épreuve de
   * sentier », au QG) : une seule à la fois, et tant qu'elle attend, il n'en
   * commence aucune autre. Refermée sans coûter de vie — son issue reste
   * vide, comme un rejeu : ni les vies (`lectureDesEchecs`) ni
   * l'administration des sentiers ne la comptent ratée. Validée, elle
   * s'arrête comme « Arrêter là », ses bonnes réponses comptées. Null s'il
   * n'y avait rien à libérer.
   */
  libererEpreuve(profileId: string): Promise<{ sentier: string; palier: number } | null> {
    return this.avecVerrou(profileId, async () => {
      const e = await this.epreuveEnCours(profileId)
      const b = e?.branche ? brancheParCle(e.branche) : undefined
      if (!e || !b || !e.palier) return null
      const maintenant = this.maintenant()
      await this.client.execute({ sql: 'UPDATE campagne_series SET finie_le = ? WHERE id = ? AND finie_le IS NULL', args: [maintenant, e.id] })
      this.enCours.delete(profileId)
      if (e.issue === 'validee') await this.recompenser(profileId, e.id, await this.hautsFaitsDe(e), maintenant)
      return { sentier: b.nom, palier: e.palier }
    })
  }

  // ── Les sentiers à thème ────────────────────────────────────────────────
  //
  // Un sujet de la campagne (`shared/sujets.ts`) monté en six paliers de dix
  // questions, sans vies (`shared/sentiersDeSujets.ts`) — à l'écran, depuis
  // le 12 octobre 2026, un parcours de thème et ses étapes, dans l'onglet
  // « Apprendre » (`Parcours.tsx`). Une épreuve est une
  // série d'un autre mode (`mode = 'sujet'`, son sujet, son palier, son seuil
  // figé) : l'expérience, les confettis, la mesure des difficultés et le
  // carnet la comptent sans rien en savoir ; les vies, les paliers à portrait
  // et l'administration des sentiers ne regardent que les leurs.

  /** Les questions qu'un sujet peut poser : la base jouable, sur lui. */
  private async jouablesDuSujet(cle: string): Promise<readonly QuestionDeLaBase[]> {
    return this.duSujet(await this.jouables(), cle)
  }

  /** Ses sentiers à thème : ceux que la base sert assez — leurs paliers, leurs étoiles —, et l'épreuve laissée en route. */
  async etatDesSujets(profileId: string): Promise<EtatDesSujets> {
    const [[validees, ouverte], jouables] = await Promise.all([
      this.client.batch(
        [
          { sql: `SELECT sujet, palier, justes, seuil FROM campagne_series WHERE profile_id = ? AND mode = 'sujet' AND issue = 'validee'`, args: [profileId] },
          { sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'sujet' AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1`, args: [profileId] },
        ],
        'read',
      ),
      this.jouables(),
    ])
    const compte = this.sujetsComptes(jouables)
    const parSujet = new Map<string, SentierDeSujet>()
    for (const s of SUJETS) {
      if ((compte.get(s.cle) ?? 0) >= QUESTIONS_POUR_UN_SENTIER_DE_SUJET) parSujet.set(s.cle, { sujet: s.cle, paliers: 0, etoiles: PALIERS_DES_SUJETS.map(() => 0) })
    }
    for (const r of validees.rows) {
      const s = parSujet.get(String(r.sujet))
      const palier = Number(r.palier)
      if (!s || !regleDuPalierDeSujet(palier)) continue
      s.paliers = Math.max(s.paliers, palier)
      s.etoiles[palier - 1] = Math.max(s.etoiles[palier - 1], etoilesDuSujet(Number(r.justes), Number(r.seuil ?? SEUIL_D_UN_SUJET)))
    }
    return { sujets: [...parSujet.values()], epreuve: ouverte.rows[0] ? vueDEpreuveDeSujet(versSerie(ouverte.rows[0])) : null }
  }

  /**
   * Une épreuve d'un sentier à thème : le palier qui suit le dernier validé,
   * ou un palier validé, rejoué. Celle laissée sur ce palier reprend ; une
   * autre laissée se referme — sans vies, rien ne se perd à la quitter. La
   * page les appelle des parcours de thème, et leurs paliers des étapes (le
   * choix du 12 octobre 2026, quand ils ont quitté les sentiers pour l'onglet
   * « Apprendre ») : ses refus disent ses mots.
   */
  commencerUnSujet(profileId: string, cle: unknown, n: unknown): Promise<EpreuveDeSujet> {
    return this.avecVerrou(profileId, async () => {
      const suivi = sujetParCle(cle)
      if (!suivi) throw new Error('Ce parcours n’existe pas')
      const regle = regleDuPalierDeSujet(n)
      if (!regle) throw new Error('Cette étape n’existe pas')
      const etat = await this.etatDesSujets(profileId)
      const sentier = etat.sujets.find(s => s.sujet === suivi.cle)
      if (!sentier) throw new Error('Ce parcours n’a pas encore assez de questions : reviens bientôt')
      const ouverte = etat.epreuve
      if (ouverte) {
        if (ouverte.sujet === suivi.cle && ouverte.palier === regle.n) {
          const laissee = await this.serie(profileId, ouverte.id)
          if (laissee) {
            this.garderEnCours(laissee)
            return vueDEpreuveDeSujet(laissee)
          }
        }
        await this.client.execute({ sql: 'UPDATE campagne_series SET finie_le = ? WHERE id = ? AND finie_le IS NULL', args: [this.maintenant(), ouverte.id] })
        this.enCours.delete(profileId)
      }
      if (regle.n > sentier.paliers + 1) throw new Error(`Valide d’abord l’étape ${sentier.paliers + 1}`)
      const [jouables, mesure, vues] = await Promise.all([this.jouablesDuSujet(suivi.cle), this.mesures(), this.vuesPar(profileId)])
      const questions = tirerUneEpreuve(jouables, regle, vues, mesure, this.maintenant()).map(x => versQuestionDeSerie(x.question, x.niveau))
      const e: Serie = {
        id: randomUUID(),
        profileId,
        questions,
        index: 0,
        vies: 0,
        justes: 0,
        finieLe: null,
        mode: 'sujet',
        branche: null,
        palier: regle.n,
        seuil: regle.seuil,
        rejeu: regle.n <= sentier.paliers,
        issue: null,
        categories: null,
        sujet: suivi.cle,
      }
      await this.client.execute({
        sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, palier, seuil, rejeu, issue, sujet)
              VALUES (?, ?, ?, 0, 0, 0, ?, NULL, 'sujet', ?, ?, ?, NULL, ?)`,
        args: [e.id, profileId, JSON.stringify(questions), this.maintenant(), regle.n, regle.seuil, e.rejeu ? 1 : 0, suivi.cle],
      })
      this.garderEnCours(e)
      return vueDEpreuveDeSujet(e)
    })
  }

  /**
   * Une réponse d'épreuve de sujet : comme aux sentiers — validée dès le
   * seuil, elle va au bout pour les étoiles ; ratée dès que le seuil n'est
   * plus possible —, sans vie à perdre. Une bonne réponse paie comme en
   * série : un confetti, l'expérience d'une bonne réponse.
   */
  repondreAuSujet(profileId: string, id: string, index: number, choix: unknown): Promise<ReponseDuSujet> {
    return this.avecVerrou(profileId, async () => {
      const gardee = this.enCours.get(profileId)
      const e = gardee?.id === id ? gardee : await this.serie(profileId, id)
      // Le voisin n'en sait pas plus (invariant 3) : l'épreuve d'un autre est introuvable.
      if (!e || e.mode !== 'sujet' || !e.sujet || !e.palier) throw new Error('Cette épreuve est introuvable')
      if (e.finieLe !== null) throw new Error('Cette épreuve est finie')
      if (index !== e.index) throw new Error('Cette question est passée : l’épreuve a continué sans elle')
      const q = e.questions[e.index]
      const c = typeof choix === 'number' && Number.isInteger(choix) && choix >= 0 && choix < q.reponses.length ? choix : null
      const juste = c === q.bonne
      const justes = e.justes + (juste ? 1 : 0)
      const position = e.index + 1
      const seuil = e.seuil ?? SEUIL_D_UN_SUJET
      // Validée, elle le reste : les erreurs d'après ne la défont pas.
      const issue = e.issue ?? issueDuSujet(justes, position, seuil)
      const finie = position >= e.questions.length || epreuveDeSujetFinie(justes, position, seuil)
      const maintenant = this.maintenant()
      const lot: InStatement[] = [
        {
          sql: 'INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [e.id, e.index, q.id, c, juste ? 1 : 0, maintenant, this.compagnonPorte(profileId)],
        },
        { sql: 'UPDATE campagne_series SET position = ?, justes = ?, issue = ?, finie_le = ? WHERE id = ?', args: [position, justes, issue, finie ? maintenant : null, e.id] },
      ]
      // Finie et validée : ses notes d'avant sur ce palier, pour dire une meilleure.
      if (finie && issue === 'validee') {
        lot.unshift({
          sql: `SELECT justes FROM campagne_series WHERE profile_id = ? AND mode = 'sujet' AND sujet = ? AND palier = ? AND issue = 'validee' AND id <> ?`,
          args: [profileId, e.sujet, e.palier, e.id],
        })
      }
      if (juste) lot.push(...lecturesDeLExperience(profileId))
      let res: ResultSet[]
      try {
        res = await this.client.batch(lot, 'write')
      } catch (err) {
        this.enCours.delete(profileId)
        throw err
      }
      const apres: Serie = { ...e, index: position, justes, issue, finieLe: finie ? maintenant : null }
      if (finie) this.enCours.delete(profileId)
      else this.garderEnCours(apres)
      const xp = juste ? await this.crediter(profileId, res.slice(-2)) : 0
      const reponse: ReponseDuSujet = { juste, bonne: q.bonne, anecdote: q.anecdote, xp, epreuve: vueDEpreuveDeSujet(apres) }
      if (finie && issue === 'validee') {
        const avant = Math.max(0, ...res[0].rows.map(r => Number(r.justes)))
        reponse.etoiles = etoilesDuSujet(justes, seuil)
        if (avant > 0 && justes > avant) reponse.record = true
      }
      // Ses bonnes réponses comptent pour Le Marathonien, validée ou non,
      // comme celles d'une épreuve des sentiers. Une étagère qui se tait n'y
      // change rien : l'épreuve est rangée, et la fin suivante les relira.
      if (finie) {
        try {
          Object.assign(reponse, await this.recompenser(profileId, e.id, [], this.maintenant()))
        } catch (err) {
          console.error('[campagne] récompenses de l’épreuve à thème non rangées :', err)
        }
        await this.faireGrandir(profileId)
      }
      return reponse
    })
  }

  /**
   * Les paliers que chacun tenait de ses portraits d'avant les sentiers
   * (`core/repriseDesPortraits.ts`) : écrits une fois, en lots ; un acquis
   * déjà là garde le plus haut des deux.
   */
  async retenirAcquis(lignes: readonly { profileId: string; branche: CleDeBranche; paliers: number }[]): Promise<void> {
    const maintenant = this.maintenant()
    for (let i = 0; i < lignes.length; i += 200) {
      await this.client.batch(
        lignes.slice(i, i + 200).map(l => ({
          sql: `INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)
                ON CONFLICT(profile_id, branche) DO UPDATE SET paliers = MAX(paliers, excluded.paliers)`,
          args: [l.profileId, l.branche, l.paliers, maintenant],
        })),
        'write',
      )
    }
  }

  /**
   * Les sentiers, côté administrateur, toutes branches ou une seule. Palier
   * par palier, ce que les vraies épreuves des trois derniers mois disent :
   * qui l'a tenté, qui l'a validé et en combien d'essais, qui y reste bloqué
   * et ce qu'il y a laissé, la chance d'un essai à chaque seuil, la part de
   * bonnes réponses. Les bonnes réponses par marche de question, que le
   * calibrage suppose. Et où chacun en est aujourd'hui : ceux qui attendent
   * un palier sans l'avoir tenté, les plus bloqués. De quoi régler un seuil
   * ou un mélange sur des faits. Les rejeux se comptent à part : ils ne
   * risquent rien, et ne disent rien d'un premier essai.
   */
  async adminDesSentiers(cle: unknown): Promise<AdminDesSentiers> {
    const b = brancheParCle(cle) ?? null
    const maintenant = this.maintenant()
    const semaine = maintenant - 7 * 24 * HEURE_MS
    const depuis = maintenant - STATS_DES_SENTIERS_MS
    const filtre = b ? ' AND branche = ?' : ''
    const avec = (...args: number[]) => (b ? [...args, b.key] : args)
    const [[lignes, recentes, parNiveau, resumes, acquis], achetees] = await Promise.all([
      this.client.batch(
        [
          {
            sql: `SELECT profile_id, branche, palier, issue, rejeu, seuil, position, justes, commencee_le FROM campagne_series
                  WHERE mode = 'sentier' AND issue IS NOT NULL AND commencee_le > ?${filtre}
                  ORDER BY commencee_le`,
            args: avec(depuis),
          },
          {
            sql: `SELECT COUNT(*) AS n, COUNT(DISTINCT profile_id) AS joueurs,
                         SUM(CASE WHEN rejeu = 0 AND issue = 'ratee' THEN 1 ELSE 0 END) AS perdues,
                         SUM(CASE WHEN rejeu = 0 AND issue = 'validee' THEN 1 ELSE 0 END) AS validees
                  FROM campagne_series WHERE mode = 'sentier' AND commencee_le > ?${filtre}`,
            args: avec(semaine),
          },
          // Chaque réponse retrouve la marche de sa question dans l'épreuve
          // qui la gardait : le JSON de l'épreuve se lit une fois pour ses
          // seize réponses (`CROSS JOIN` garde cet ordre-là).
          // Palier par palier : de quoi estimer, au QG, un autre mélange (`tauxDuPalier`).
          {
            sql: `SELECT s.palier AS palier, json_extract(q.value, '$.niveau') AS niveau, COUNT(*) AS n, SUM(r.juste) AS justes
                  FROM campagne_series s CROSS JOIN json_each(s.questions) q
                  JOIN campagne_reponses r ON r.serie_id = s.id AND r.position = q.key
                  WHERE s.mode = 'sentier' AND s.rejeu = 0 AND s.commencee_le > ?${b ? ' AND s.branche = ?' : ''}
                  GROUP BY s.palier, niveau`,
            args: avec(depuis),
          },
          // Où chacun en est, sur toutes ses épreuves : un résumé par joueur, sentier et palier.
          {
            sql: `SELECT profile_id, branche, palier, rejeu, issue, COUNT(*) AS n, MAX(commencee_le) AS dernier
                  FROM campagne_series WHERE mode = 'sentier'${filtre}
                  GROUP BY profile_id, branche, palier, rejeu, issue`,
            args: avec(),
          },
          { sql: `SELECT profile_id, branche, paliers FROM sentier_acquis${b ? ' WHERE branche = ?' : ''}`, args: avec() },
        ],
        'read',
      ),
      this.viesAcheteesDepuis?.(semaine) ?? 0,
    ])

    // Les essais de chacun sur chaque palier, dans l'ordre : le premier dit « du premier coup ».
    const essais = new Map<string, { issue: IssueDEpreuve; seuil: number; abandon: boolean; questions: number; justes: number }[]>()
    const rejeux = new Map<number, { joues: number; valides: number }>()
    // Ce que disent les épreuves commencées depuis chaque réglage : trois mois mêlent l'ancien mélange et le nouveau.
    const reglages = [...this.melanges].map(([palier, r]) => ({ palier, melange: r.melange, regleLe: r.regleLe, essais: 0, validees: 0 }))
    for (const r of lignes.rows) {
      const palier = Number(r.palier)
      const issue: IssueDEpreuve = r.issue === 'validee' ? 'validee' : 'ratee'
      if (Number(r.rejeu ?? 0) === 1) {
        const c = rejeux.get(palier) ?? { joues: 0, valides: 0 }
        c.joues++
        if (issue === 'validee') c.valides++
        rejeux.set(palier, c)
        continue
      }
      const reglage = reglages.find(x => x.palier === palier && Number(r.commencee_le) >= x.regleLe)
      if (reglage) {
        reglage.essais++
        if (issue === 'validee') reglage.validees++
      }
      const seuil = Number(r.seuil ?? regleDuPalier(palier)?.seuil ?? QUESTIONS_PAR_EPREUVE)
      const questions = Number(r.position ?? 0)
      const justes = Number(r.justes ?? 0)
      const k = `${palier}|${r.profile_id}|${r.branche}`
      const liste = essais.get(k) ?? []
      // Ratée sans la faute de trop : quittée en route (`abandonnerEpreuve`).
      liste.push({ issue, seuil, abandon: issue === 'ratee' && questions - justes <= QUESTIONS_PAR_EPREUVE - seuil, questions, justes })
      essais.set(k, liste)
    }

    // Où chacun en est aujourd'hui : le plus haut palier validé de chaque
    // sentier commencé — ses épreuves, et ce que la reprise lui a retenu
    // (`sentier_acquis`). Un sentier repris des portraits d'avant, jamais
    // joué, n'est pas en route : il ne compte pas.
    const enRoute = new Map<string, { haut: number; tentes: Set<number>; echecs: Map<number, { n: number; dernier: number }> }>()
    for (const r of resumes.rows) {
      const k = `${r.profile_id}|${r.branche}`
      const p = enRoute.get(k) ?? { haut: 0, tentes: new Set<number>(), echecs: new Map() }
      enRoute.set(k, p)
      const palier = Number(r.palier)
      if (r.issue === 'validee') p.haut = Math.max(p.haut, palier)
      if (Number(r.rejeu ?? 0) === 0) {
        p.tentes.add(palier)
        if (r.issue === 'ratee') p.echecs.set(palier, { n: Number(r.n), dernier: Number(r.dernier) })
      }
    }
    for (const r of acquis.rows) {
      const p = enRoute.get(`${r.profile_id}|${r.branche}`)
      if (p) p.haut = Math.max(p.haut, Number(r.paliers))
    }
    const enAttente = new Map<number, number>()
    const bloques: JoueurBloque[] = []
    for (const [k, p] of enRoute) {
      const suivant = p.haut + 1
      if (suivant > PALIER_DU_MAITRE) continue
      if (!p.tentes.has(suivant)) {
        enAttente.set(suivant, (enAttente.get(suivant) ?? 0) + 1)
        continue
      }
      const echecs = p.echecs.get(suivant)
      if (echecs && echecs.n >= 2 && suivant < PALIER_DU_MAITRE) {
        const [profileId, branche] = k.split('|')
        bloques.push({ profileId, branche: branche as CleDeBranche, palier: suivant, echecs: echecs.n, dernier: echecs.dernier })
      }
    }
    bloques.sort((x, y) => y.echecs - x.echecs || y.dernier - x.dernier)

    const paliers: StatsDuPalier[] = PALIERS.map(regle => {
      const groupes = [...essais].filter(([k]) => k.startsWith(`${regle.n}|`)).map(([, liste]) => liste)
      const tous = groupes.flat()
      const valide = (g: (typeof tous)[number][]) => g.some(e => e.issue === 'validee')
      const parSeuil = new Map<number, { essais: number; validees: number }>()
      for (const e of tous) {
        const c = parSeuil.get(e.seuil) ?? { essais: 0, validees: 0 }
        c.essais++
        if (e.issue === 'validee') c.validees++
        parSeuil.set(e.seuil, c)
      }
      return {
        palier: regle.n,
        joueurs: groupes.length,
        valides: groupes.filter(valide).length,
        premierCoup: groupes.filter(g => g[0].issue === 'validee').length,
        essais: tous.length,
        echecsDesBloques: groupes.filter(g => !valide(g)).reduce((n, g) => n + g.length, 0),
        abandons: tous.filter(e => e.abandon).length,
        questions: tous.reduce((n, e) => n + e.questions, 0),
        justes: tous.reduce((n, e) => n + e.justes, 0),
        seuils: [...parSeuil].sort(([x], [y]) => y - x).map(([seuil, c]) => ({ seuil, ...c })),
        enAttente: enAttente.get(regle.n) ?? 0,
        rejeux: rejeux.get(regle.n)?.joues ?? 0,
        rejeuxValides: rejeux.get(regle.n)?.valides ?? 0,
      }
    })
    const semaineLue = recentes.rows[0]
    return {
      semaine: {
        joueurs: Number(semaineLue?.joueurs ?? 0),
        epreuves: Number(semaineLue?.n ?? 0),
        viesAchetees: achetees,
        viesPerdues: Number(semaineLue?.perdues ?? 0),
        paliersValides: Number(semaineLue?.validees ?? 0),
      },
      branche: b?.key ?? null,
      paliers,
      niveaux: NIVEAUX.map(niveau => {
        const lignes = parNiveau.rows.filter(x => x.niveau === niveau)
        return { niveau, questions: lignes.reduce((n, r) => n + Number(r.n ?? 0), 0), justes: lignes.reduce((n, r) => n + Number(r.justes ?? 0), 0) }
      }),
      niveauxParPalier: parNiveau.rows.flatMap(r =>
        NIVEAUX.includes(r.niveau as Niveau) ? [{ palier: Number(r.palier), niveau: r.niveau as Niveau, questions: Number(r.n ?? 0), justes: Number(r.justes ?? 0) }] : [],
      ),
      reglages: reglages.sort((x, y) => x.palier - y.palier),
      bloques: bloques.slice(0, BLOQUES_MONTRES),
    }
  }

  // ── La routine du matin ─────────────────────────────────────────────────

  /**
   * Ce que la routine doit écrire aujourd'hui (Paris) : par catégorie,
   * combien encore — la commande moins ce qu'elle a déjà déposé, si elle
   * repasse —, les sous-thèmes et les difficultés qui manquent le plus
   * (`commandeDeLaCategorie`), et sa part de la consigne, avec les intitulés
   * déjà écrits dans ces sous-thèmes-là : la catégorie entière ferait des
   * consignes de plus en plus longues à mesure que la base grandit. La
   * consigne commune, une fois pour toutes (`consigneCommune`).
   */
  async commandeDuJour(): Promise<CommandeDeLaBase> {
    const base = await this.base()
    const aujourdhui = jourDe(this.maintenant())
    const categories = CATEGORIES.map(categorie => {
      const deposees = this.ajouts.filter(a => a.question.meta.categorie === categorie && jourDe(a.ajouteeLe) === aujourdhui).length
      const aEcrire = Math.max(0, QUESTIONS_PAR_CATEGORIE_ET_PAR_JOUR - deposees)
      if (aEcrire === 0) return { categorie, aEcrire, quotas: [], consigne: null }
      const existantes = base.questions.filter(q => q.meta.categorie === categorie && !this.retirees.has(q.id))
      const quotas = commandeDeLaCategorie(
        categorie,
        existantes.map(q => ({ sousTheme: q.meta.sousTheme, difficulte: q.meta.difficulte })),
        aEcrire,
      )
      const vises = new Set(quotas.map(q => q.cle))
      const deja = existantes.filter(q => vises.has(q.meta.sousTheme)).map(q => q.texte)
      return { categorie, aEcrire, quotas, consigne: partDeLaCategorie(categorie, quotas, deja) }
    })
    const aEcrire = categories.reduce((n, c) => n + c.aEcrire, 0)
    return { aEcrire, parEnvoi: DEPOT_MAX, consigneCommune: aEcrire > 0 ? consigneCommune({ sorte: 'routine' }) : null, categories }
  }

  /**
   * Le dépôt de la routine : chaque entrée relue par le juge de la base
   * (`lireQuestionDeLaBase`), comme une ligne du dépôt ; écartée, avec sa
   * raison, si elle est d'une autre catégorie, déjà dans la base, dans la
   * réserve du quiz du jour ou dans un quiz livré, si elle pose un fait que
   * la base ou ce dépôt pose déjà (`IndexDesFaits`), ou si la catégorie a
   * atteint son plafond du jour. Rangée sous un identifiant neuf, et jouable
   * tout de suite. Un dépôt à la fois : deux routines lancées ensemble ne
   * passeraient pas le plafond, ni ne rangeraient deux fois le même intitulé.
   */
  deposer(categorie: unknown, entrees: unknown): Promise<DepotDeLaBase> {
    return this.avecVerrou('#depot', async () => {
      const c = CATEGORIES.find(x => x === categorie)
      if (!c) throw new Error(`Catégorie inconnue : ${String(categorie)}`)
      if (!Array.isArray(entrees) || entrees.length === 0) throw new Error('Envoie les questions dans « entrees », un tableau au format de la consigne')
      if (entrees.length > DEPOT_MAX) throw new Error(`${DEPOT_MAX} questions au plus par envoi : coupe le lot en plusieurs`)
      const [base, duJour] = await Promise.all([this.base(), this.empreintesDuJour()])
      this.livres ??= empreintesDesLivres()
      const faits = await (this.faits ??= indexSansBloquer(base.questions).catch(e => {
        // Raté, il se rebâtit au dépôt suivant : gardée, la promesse le figerait.
        this.faits = null
        throw e
      }))
      // Ce dépôt à part : écrit seulement si le lot passe, il rejoint ensuite les faits de la base.
      const dansCeDepot = new IndexDesFaits<QuestionDeLaBase>()
      const ids = new Set(base.parId.keys())
      const vues = new Set<string>()
      const aujourdhui = jourDe(this.maintenant())
      let place = PLAFOND_PAR_CATEGORIE_ET_PAR_JOUR - this.ajouts.filter(a => a.question.meta.categorie === c && jourDe(a.ajouteeLe) === aujourdhui).length
      const ecartees: DepotDeLaBase['ecartees'] = []
      const acceptees: QuestionDeLaBase[] = []
      for (const brut of entrees) {
        const texte = tronquer(String((brut as { texte?: unknown } | null)?.texte ?? ''), 120)
        const lu = lireQuestionDeLaBase(brut, { sansId: true })
        if ('refus' in lu) {
          ecartees.push({ texte, motif: lu.refus })
          continue
        }
        const q = lu.question
        const memeFait = faits.chercher(q) ?? dansCeDepot.chercher(q)
        const motif =
          q.meta.categorie !== c
            ? `d’une autre catégorie (${q.meta.categorie}) : dépose-la avec la sienne`
            : base.empreintes.has(q.empreinte)
              ? 'déjà dans la base'
              : duJour.has(q.empreinte)
                ? 'déjà dans la réserve du quiz du jour'
                : this.livres.has(q.empreinte)
                  ? 'déjà dans un quiz livré'
                  : vues.has(q.empreinte)
                    ? 'deux fois dans ce dépôt'
                    : memeFait
                      ? motifDuMemeFait(memeFait)
                      : place <= 0
                        ? `la catégorie a reçu ses ${PLAFOND_PAR_CATEGORIE_ET_PAR_JOUR} questions du jour`
                        : null
        if (motif) {
          ecartees.push({ texte, motif })
          continue
        }
        vues.add(q.empreinte)
        place--
        const rangee = { ...q, id: nouvelIdentifiant(ids) }
        dansCeDepot.ajouter(rangee)
        acceptees.push(rangee)
      }
      if (acceptees.length > 0) {
        const maintenant = this.maintenant()
        await this.client.batch(
          acceptees.map(q => ({
            sql: 'INSERT INTO campagne_ajouts (id, categorie, entree, ajoutee_le) VALUES (?, ?, ?, ?)',
            args: [q.id, c, JSON.stringify(entreeDeLaBase(q)), maintenant],
          })),
          'write',
        )
        // Écrites : elles se jouent tout de suite. La base fusionnée se refait à la prochaine lecture.
        for (const q of acceptees) {
          this.ajouts.push({ question: q, ajouteeLe: maintenant })
          faits.ajouter(q)
        }
      }
      return { ajoutees: acceptees.length, ecartees }
    })
  }

  /**
   * Ce que la routine a ajouté : de quoi voir qu'elle tourne, et relire ses
   * dernières questions — dans leur version du jour, corrigées depuis s'il
   * le faut (`base`).
   */
  private ajoutsDeLaRoutine(base: BaseDeLaCampagne): AjoutsDeLaRoutine {
    const maintenant = this.maintenant()
    const aujourdhui = jourDe(maintenant)
    const derniers = this.ajouts.slice(-20).reverse()
    return {
      aujourdhui: this.ajouts.filter(a => jourDe(a.ajouteeLe) === aujourdhui).length,
      septJours: this.ajouts.filter(a => a.ajouteeLe > maintenant - 7 * 24 * HEURE_MS).length,
      total: this.ajouts.length,
      dernierLe: this.ajouts.at(-1)?.ajouteeLe ?? null,
      derniers: derniers.map(({ question: deposee, ajouteeLe }) => {
        const q = base.parId.get(deposee.id) ?? deposee
        const remplacante = this.corrections.get(q.id)?.question.id
        return {
          id: q.id,
          texte: q.texte,
          categorie: q.meta.categorie,
          sousTheme: q.meta.sousTheme,
          difficulte: q.meta.difficulte,
          ajouteeLe,
          retiree: this.retirees.has(q.id),
          ...(remplacante !== undefined && remplacante !== q.id && { remplacee: true as const }),
        }
      }),
    }
  }

  /** Pour `/healthz` : agrégé, lu en mémoire, sans un intitulé — la route est publique. */
  santeDeLaBase(): { ajoutees: number; dernierApport: number | null } {
    return { ajoutees: this.ajouts.length, dernierApport: this.ajouts.at(-1)?.ajouteeLe ?? null }
  }

  /**
   * Les séries commencées depuis un instant, de tous les modes — série,
   * épreuve, parcours, révision, défi, duel, rencontre — : qui, quand, dans
   * quel mode, et combien de questions jouées (`position`, qui avance à
   * chaque réponse). Le QG en tire ses chiffres du jour, ses participations
   * et l'activité de chaque mode ; une série d'avant les modes n'en a pas
   * (null) : c'est une série. `qui` : celles d'un seul profil, sa fiche au
   * QG — par l'index `(profile_id, commencee_le)`.
   */
  async seriesDepuis(depuis: number, qui?: string): Promise<{ qui: string; quand: number; mode: string | null; questions: number }[]> {
    const res = await this.client.execute({
      sql: `SELECT profile_id, commencee_le, mode, position FROM campagne_series WHERE commencee_le >= ?${qui === undefined ? '' : ' AND profile_id = ?'}`,
      args: qui === undefined ? [depuis] : [depuis, qui],
    })
    return res.rows.map(r => ({
      qui: String(r.profile_id),
      quand: Number(r.commencee_le),
      mode: r.mode === null ? null : String(r.mode),
      questions: Number(r.position),
    }))
  }

  /** Ce que le QG compte des signalements à relire : les questions, et les joueurs qui les signalent. */
  async signalementsATraiter(): Promise<{ questions: number; joueurs: number }> {
    const res = await this.client.execute(
      'SELECT COUNT(DISTINCT question_id) AS questions, COUNT(DISTINCT profile_id) AS joueurs FROM campagne_signalements WHERE traite_le IS NULL',
    )
    return { questions: Number(res.rows[0]?.questions ?? 0), joueurs: Number(res.rows[0]?.joueurs ?? 0) }
  }

  /**
   * La campagne au QG (`/admin#campagne`) : les paliers validés aujourd'hui,
   * le défi de la semaine, les parcours de thème et les vies des trente
   * derniers jours. Ce qu'on joue jour par jour vient de la vue d'ensemble,
   * qui l'a déjà lu (`campagneDeLaVue`).
   */
  async suiviAuQg(): Promise<SuiviDeLaCampagne> {
    const maintenant = this.maintenant()
    const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
    const [paliers, defi, trente] = await Promise.all([this.paliersDuJourAuQg(minuits[minuits.length - 1]), this.defiAuQg(), this.trenteJoursAuQg(minuits)])
    return { maintenant, jours: joursDesMinuits(minuits), paliers, defi, ...trente }
  }

  /** Les paliers validés depuis minuit, hors rejeu, et ceux du premier coup : aucune épreuve d'avant sur ce palier de ce sentier. */
  private async paliersDuJourAuQg(minuit: number): Promise<SuiviDeLaCampagne['paliers']> {
    const res = await this.client.execute({
      sql: `SELECT COUNT(*) AS valides,
                   SUM(CASE WHEN EXISTS (SELECT 1 FROM campagne_series p
                                         WHERE p.profile_id = s.profile_id AND p.mode = 'sentier' AND p.branche = s.branche AND p.palier = s.palier
                                           AND p.rejeu = 0 AND p.commencee_le < s.commencee_le) THEN 0 ELSE 1 END) AS premier_coup
            FROM campagne_series s
            WHERE s.commencee_le >= ? AND s.mode = 'sentier' AND s.rejeu = 0 AND s.issue = 'validee'`,
      args: [minuit],
    })
    return { valides: Number(res.rows[0]?.valides ?? 0), premierCoup: Number(res.rows[0]?.premier_coup ?? 0) }
  }

  /**
   * Le défi de la semaine, au QG : ses joueurs comptés comme son classement
   * — ni les masqués ni les suspendus —, ses scores, sa question la plus
   * ratée, la semaine d'avant. Sans jamais le tirer (`tirageDuDefi` le
   * ferait, et l'administrateur n'est pas un joueur) ni clore la semaine
   * passée : la première demande d'un joueur le fait.
   */
  private async defiAuQg(): Promise<DefiAuQg> {
    const { semaine, passee } = this.semaineDeLHeure()
    const gardees = this.tirages.get(semaine)
    const [tirage, tentatives, parQuestion, avant, close] = await this.client.batch(
      [
        // Un tirage déjà lu ne se relit pas : soixante questions figées, avec leurs réponses.
        { sql: `SELECT ${gardees ? "'[]'" : 'questions'} AS questions FROM campagne_defis WHERE semaine = ?`, args: [semaine] },
        { sql: `SELECT profile_id, justes, finie_le, commencee_le FROM campagne_series WHERE mode = 'defi' AND semaine = ? AND position > 0`, args: [semaine] },
        {
          sql: `SELECT r.position AS position, COUNT(*) AS n, SUM(r.juste) AS justes
                FROM campagne_series s JOIN campagne_reponses r ON r.serie_id = s.id
                WHERE s.mode = 'defi' AND s.semaine = ? GROUP BY r.position`,
          args: [semaine],
        },
        { sql: `SELECT profile_id FROM campagne_series WHERE mode = 'defi' AND semaine = ? AND position > 0`, args: [passee] },
        { sql: 'SELECT vainqueurs, clos_le FROM campagne_defis WHERE semaine = ?', args: [passee] },
      ],
      'read',
    )
    const tire = tirage.rows.length > 0
    const questions = gardees ?? (tire ? (JSON.parse(String(tirage.rows[0].questions)) as QuestionDeSerie[]) : [])
    const [profils, profilsDAvant] = this.profils
      ? await Promise.all([this.profils.byIds(tentatives.rows.map(r => String(r.profile_id))), this.profils.byIds(avant.rows.map(r => String(r.profile_id)))])
      : [[], []]
    const compte = (p: ProfileRec | null | undefined): p is ProfileRec => !!p && !this.masque?.(p.id)
    const joueurs = tentatives.rows.flatMap((r, i) => {
      const p = profils[i]
      return compte(p) ? [{ profil: p, justes: Number(r.justes), finieLe: r.finie_le === null ? null : Number(r.finie_le), commenceeLe: Number(r.commencee_le) }] : []
    })
    const finies = joueurs.filter(j => j.finieLe !== null)
    const scores = new Array<number>(finies.length > 0 ? Math.max(...finies.map(j => j.justes)) + 1 : 0).fill(0)
    for (const j of finies) scores[j.justes]++
    const haut = joueurs.length > 0 ? Math.max(...joueurs.map(j => j.justes)) : 0
    // Celui qui tient le meilleur score le premier — commencé le premier : une égalité ne départage pas mieux.
    const enTete = joueurs.filter(j => j.justes === haut).sort((a, b) => a.commenceeLe - b.commenceeLe || a.profil.id.localeCompare(b.profil.id))
    const premier = enTete[0]
    const r = close.rows[0]
    return {
      semaine,
      tire,
      minutesRestantes: minutesAvantLundi(this.maintenant()),
      joueurs: joueurs.length,
      finies: finies.length,
      scores,
      meilleur:
        premier && this.profils
          ? {
              justes: haut,
              nom: premier.profil.name,
              avatar: this.profils.avatarPorte(premier.profil),
              // Ce qu'il porte, comme au classement du défi.
              ...sonApparence(this.profils, premier.profil),
              quand: premier.finieLe,
              exAequo: enTete.length - 1,
            }
          : null,
      ratees: lesPlusRatees(
        parQuestion.rows.flatMap(x => {
          const q = questions[Number(x.position)]
          return q ? [{ index: Number(x.position), texte: q.texte, categorie: q.categorie, reponses: Number(x.n), justes: Number(x.justes ?? 0) }] : []
        }),
      ),
      passee: r ? { semaine: passee, joueurs: profilsDAvant.filter(compte).length, vainqueurs: r.clos_le === null ? null : lireVainqueurs(r.vainqueurs).length } : null,
    }
  }

  /**
   * Les parcours de thème et les vies des trente derniers jours, lus ensemble
   * et gardés dix minutes : rien n'y bouge d'une minute à l'autre que la
   * page doive voir, et trente jours relus à chaque ouverture comptaient au
   * quota de Turso. Une lecture qui échoue ne se garde pas.
   */
  private trenteJoursAuQg(minuits: readonly number[]): Promise<Pick<SuiviDeLaCampagne, 'parcours' | 'vies'>> {
    const maintenant = this.maintenant()
    const minuit = minuits[minuits.length - 1]
    const garde = this.trenteJoursGardes
    if (garde && garde.minuit === minuit && maintenant < garde.jusqua) return garde.lus
    const lus = this.lireTrenteJoursAuQg(minuits, maintenant)
    this.trenteJoursGardes = { minuit, jusqua: maintenant + TRENTE_JOURS_GARDES_MS, lus }
    lus.catch(() => {
      if (this.trenteJoursGardes?.lus === lus) this.trenteJoursGardes = null
    })
    return lus
  }

  private async lireTrenteJoursAuQg(minuits: readonly number[], maintenant: number): Promise<Pick<SuiviDeLaCampagne, 'parcours' | 'vies'>> {
    const depuis = minuits[0]
    const derniere = PALIERS_DES_SUJETS.length
    const [[parcours, echecs], achats] = await Promise.all([
      this.client.batch(
        [
          {
            sql: `SELECT sujet, COUNT(DISTINCT profile_id) AS joueurs,
                         COUNT(DISTINCT CASE WHEN issue = 'validee' THEN profile_id || '|' || palier END) AS etapes,
                         COUNT(DISTINCT CASE WHEN issue = 'validee' AND palier = ? THEN profile_id END) AS finis
                  FROM campagne_series WHERE commencee_le >= ? AND mode = 'sujet' AND sujet IS NOT NULL
                  GROUP BY sujet`,
            args: [derniere, depuis],
          },
          // Chaque joueur ses échecs en un texte : une ligne par épreuve ratée ferait décoder des milliers de lignes.
          {
            sql: `SELECT profile_id, json_group_array(finie_le) AS fins FROM campagne_series
                  WHERE commencee_le >= ? AND mode = 'sentier' AND rejeu = 0 AND issue = 'ratee' AND finie_le >= ?
                  GROUP BY profile_id`,
            args: [depuis - MARGE_D_UNE_EPREUVE_MS, depuis],
          },
        ],
        'read',
      ),
      this.achatsDeViesDepuis?.(depuis) ?? [],
    ])
    const lignes = parcours.rows.map(r => {
      const sujet = String(r.sujet)
      return { sujet, nom: sujetParCle(sujet)?.nom ?? sujet, joueurs: Number(r.joueurs), etapes: Number(r.etapes), finis: Number(r.finis) }
    })
    lignes.sort((a, b) => b.joueurs - a.joueurs || b.etapes - a.etapes || a.nom.localeCompare(b.nom, 'fr'))
    const epreuvesRatees = echecs.rows.flatMap(r => (JSON.parse(String(r.fins)) as number[]).map(quand => ({ qui: String(r.profile_id), quand })))
    const vies: ViesAuQg = { ...viesPerduesParJour(epreuvesRatees, minuits, maintenant), ...viesAcheteesParJour(achats, minuits, maintenant) }
    const suivis: ParcoursAuQg = { lignes: lignes.slice(0, PARCOURS_AU_QG), commences: lignes.reduce((n, l) => n + l.joueurs, 0), sujets: lignes.length }
    return { parcours: suivis, vies }
  }

  /**
   * Les duels au QG (`/admin#duels`) : les duels classés lancés jour par jour
   * sur trente jours, les ligues et le classement tels que les joueurs les
   * voient, ce que la semaine passée a versé en confettis de ligue, et les
   * duels qui attendent leur adversaire. Les cotes sont celles du classement
   * (`toutesLesCotes`), gardées : rien ne se relit pour le QG.
   */
  async suiviDesDuelsAuQg(): Promise<SuiviDesDuels> {
    const maintenant = this.maintenant()
    const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
    const [lances, attente, cotes, classement] = await Promise.all([
      this.duelsLancesAuQg(minuits),
      this.duelsEnAttenteAuQg(maintenant),
      this.toutesLesCotes(),
      this.classementDesDuels(null),
    ])
    // Les ligues de ceux que le classement compte : ces quatre semaines, ni masqués ni suspendus.
    const depuis = maintenant - JOURS_DU_CLASSEMENT * 24 * HEURE_MS
    const actifs = [...cotes].filter(([, r]) => r.dernierLe !== null && r.dernierLe >= depuis)
    const profils = this.profils ? await this.profils.byIds(actifs.map(([id]) => id)) : []
    const classes = actifs.filter(([id], i) => profils[i] && !this.masque?.(id)).map(([, r]) => ligueDe(r.cote).cle)
    // Ce que la semaine passée a versé : à chacun, masqué ou non — les confettis sont à lui.
    const { passee } = this.semaineDeLHeure()
    let payes = 0
    let confettis = 0
    for (const r of cotes.values()) {
      const paye = recompenseDeLaSemaine(r.semaines.get(passee))
      if (paye > 0) {
        payes++
        confettis += paye
      }
    }
    return {
      maintenant,
      jours: joursDesMinuits(minuits),
      ...lances,
      ligues: joueursParLigue(classes, LIGUES.map(l => l.cle)),
      semainePassee: { semaine: passee, payes, confettis },
      classement: { joueurs: classement.joueurs, lignes: classement.lignes.slice(0, LIGNES_DU_CLASSEMENT_AU_QG) },
      attente,
    }
  }

  /** Les duels classés lancés chaque jour sur trente jours, et ceux joués des deux côtés : gardés dix minutes, comme les vies. */
  private duelsLancesAuQg(minuits: readonly number[]): Promise<Pick<SuiviDesDuels, 'lances' | 'jouesDesDeuxCotes'>> {
    const maintenant = this.maintenant()
    const minuit = minuits[minuits.length - 1]
    const garde = this.lancesGardes
    if (garde && garde.minuit === minuit && maintenant < garde.jusqua) return garde.lus
    const lus = (async () => {
      const res = await this.client.execute({
        sql: `SELECT d.cree_le AS quand,
                     (SELECT COUNT(DISTINCT s.profile_id) FROM campagne_series s
                       WHERE s.mode = 'duel' AND s.duel = d.code AND s.profile_id IN (d.auteur, d.adversaire) AND s.finie_le IS NOT NULL) = 2 AS joue
              FROM campagne_duels d WHERE d.cree_le >= ? AND d.adversaire IS NOT NULL`,
        args: [minuits[0]],
      })
      const lances = minuits.map(() => 0)
      let joues = 0
      for (const r of res.rows) {
        const quand = Number(r.quand)
        const i = quand <= maintenant ? jourDeLInstant(minuits, quand) : -1
        if (i >= 0) lances[i]++
        if (Number(r.joue) === 1) joues++
      }
      return { lances, jouesDesDeuxCotes: joues }
    })()
    this.lancesGardes = { minuit, jusqua: maintenant + TRENTE_JOURS_GARDES_MS, lus }
    lus.catch(() => {
      if (this.lancesGardes?.lus === lus) this.lancesGardes = null
    })
    return lus
  }

  /**
   * Les duels classés partis à celui qu'ils défient (`campagne_envois`) et
   * qu'il n'a pas commencés : ceux qui attendent encore, les plus près
   * d'expirer d'abord, et ceux fermés ainsi ces sept derniers jours — ils ne
   * comptent pour personne. Lus par leur date de lancement : un duel ouvert
   * a été lancé il y a moins d'une semaine (`DUREE_D_UN_DUEL_MS`).
   */
  private async duelsEnAttenteAuQg(maintenant: number): Promise<SuiviDesDuels['attente']> {
    const res = await this.client.execute({
      sql: `SELECT d.code, d.auteur, d.adversaire, d.ferme_le, e.envoye_le
            FROM campagne_duels d JOIN campagne_envois e ON e.code = d.code AND e.profile_id = d.adversaire
            WHERE d.cree_le > ? AND d.adversaire IS NOT NULL AND d.ferme_le > ?
              AND NOT EXISTS (SELECT 1 FROM campagne_series s WHERE s.mode = 'duel' AND s.duel = d.code AND s.profile_id = d.adversaire)
            ORDER BY d.ferme_le, d.code`,
      args: [maintenant - 2 * DUREE_D_UN_DUEL_MS, maintenant - 7 * 24 * HEURE_MS],
    })
    const ouverts = res.rows.filter(r => Number(r.ferme_le) > maintenant)
    const montres = ouverts.slice(0, DUELS_EN_ATTENTE_MONTRES)
    const ids = [...new Set(montres.flatMap(r => [String(r.auteur), String(r.adversaire)]))]
    const profils = this.profils ? await this.profils.byIds(ids) : []
    const parId = new Map(ids.map((id, i) => [id, profils[i]]))
    const joueur = (id: string): JoueurDuDuel => {
      const p = parId.get(id)
      // Ce qu'il porte, comme les joueurs le voient : l'emoji seul montrait autrement qui porte un légendaire.
      return { id, nom: p?.name ?? 'Un profil parti', avatar: p && this.profils ? this.profils.avatarPorte(p) : '·', ...(p && this.profils && sonApparence(this.profils, p)) }
    }
    return {
      duels: montres.map(r => ({
        code: String(r.code),
        auteur: joueur(String(r.auteur)),
        adversaire: joueur(String(r.adversaire)),
        envoyeLe: Number(r.envoye_le),
        fermeLe: Number(r.ferme_le),
      })),
      total: ouverts.length,
      plusAncien: ouverts.length > 0 ? Math.min(...ouverts.map(r => Number(r.envoye_le))) : null,
      fermesSansReponse: res.rows.length - ouverts.length,
    }
  }

  /**
   * Annuler un duel classé que celui qu'il défie n'a pas commencé (le choix
   * du 13 octobre 2026) : il se ferme tout de suite, comme à son expiration —
   * il ne compte pour personne, et sort des duels « à jouer » de l'autre.
   * Sous le verrou de l'adversaire : il ne peut pas le commencer pendant ce
   * temps. Commencé, il compte déjà : il se refuse.
   */
  async annulerUnDuel(brut: unknown): Promise<{ code: string; auteur: string; adversaire: string }> {
    const duel = await this.duelDe(lireCodeDuDuel(brut))
    if (!duel || !duel.adversaire) throw new Error('Ce duel classé n’existe pas')
    const adversaire = duel.adversaire
    return this.avecVerrou(adversaire, async () => {
      const maintenant = this.maintenant()
      if (maintenant >= duel.fermeLe) throw new Error('Ce duel est déjà fermé')
      const commence = await this.client.execute({
        sql: `SELECT 1 FROM campagne_series WHERE mode = 'duel' AND duel = ? AND profile_id = ? LIMIT 1`,
        args: [duel.code, adversaire],
      })
      if (commence.rows.length > 0) throw new Error('Ce duel est commencé des deux côtés : il compte déjà, il ne s’annule plus')
      await this.client.execute({ sql: 'UPDATE campagne_duels SET ferme_le = ? WHERE code = ? AND ferme_le > ?', args: [maintenant, duel.code, maintenant] })
      // Le duel gardé en mémoire se ferme avec : la page de l'un et de l'autre le lit là.
      duel.fermeLe = maintenant
      return { code: duel.code, auteur: duel.auteur, adversaire }
    })
  }

  /**
   * Ce que la campagne a payé depuis un instant, tous profils (le QG,
   * `/admin#economie`) : ses bonnes réponses heure par heure — séries,
   * épreuves, parcours, révisions, défis, duels : un confetti chacune —,
   * les étoiles des sentiers à l'épreuve qui atteint la note, et les ligues
   * des duels au lundi qui paie la semaine. Les réponses se cherchent par
   * leur série, une semaine de marge (`MARGE_D_UNE_EPREUVE_MS`) : sans index
   * sur `repondue_le`, la table entière.
   */
  async economieDepuis(depuis: number): Promise<{ justes: Mouvement[]; etoiles: Mouvement[]; ligues: Mouvement[] }> {
    const [justes, payes] = await Promise.all([
      this.client.execute({
        sql: `SELECT r.repondue_le / ${HEURE_MS} AS heure, COUNT(*) AS n
              FROM campagne_series s JOIN campagne_reponses r ON r.serie_id = s.id
              WHERE s.commencee_le >= ? AND r.repondue_le >= ? AND r.juste = 1
              GROUP BY heure`,
        args: [depuis - MARGE_D_UNE_EPREUVE_MS, depuis],
      }),
      this.etoilesEtLigues(),
    ])
    const depuisLa = (m: readonly Mouvement[]) => m.filter(x => x.quand >= depuis)
    return {
      justes: justes.rows.map(r => ({ quand: Number(r.heure) * HEURE_MS, confettis: Number(r.n) })),
      etoiles: depuisLa(payes.etoiles.mouvements),
      ligues: depuisLa(payes.ligues.mouvements),
    }
  }

  /**
   * Les confettis de campagne de chaque profil, aux règles de `duProfil`
   * — ses bonnes réponses, ses étoiles, ses ligues —, tous profils d'un coup :
   * la circulation du QG, relue une fois par jour.
   */
  async confettisDeTous(): Promise<Map<string, number>> {
    const [justes, payes] = await Promise.all([
      this.client.execute('SELECT profile_id, SUM(justes) AS n FROM campagne_series GROUP BY profile_id'),
      this.etoilesEtLigues(),
    ])
    const tous = new Map(justes.rows.map(r => [String(r.profile_id), Number(r.n ?? 0)]))
    for (const parProfil of [payes.etoiles.parProfil, payes.ligues.parProfil]) {
      for (const [id, n] of parProfil) tous.set(id, (tous.get(id) ?? 0) + n)
    }
    return tous
  }

  /**
   * Ce que paient les étoiles et les ligues, qui n'écrivent aucune ligne :
   * relu de toutes les épreuves validées (`etoilesDansLeTemps`, aux règles
   * de `sentiersLus`) et des cotes du classement, déjà gardées
   * (`liguesDansLeTemps`).
   */
  private async etoilesEtLigues(): Promise<{ etoiles: ReturnType<typeof etoilesDansLeTemps>; ligues: ReturnType<typeof liguesDansLeTemps> }> {
    const [validees, cotes] = await Promise.all([
      this.client.execute(
        `SELECT profile_id, branche, palier, justes, seuil, commencee_le, finie_le FROM campagne_series WHERE mode = 'sentier' AND issue = 'validee'`,
      ),
      this.toutesLesCotes(),
    ])
    const epreuves: EpreuveValidee[] = validees.rows.map(r => ({
      profil: String(r.profile_id),
      branche: String(r.branche),
      palier: Number(r.palier),
      justes: Number(r.justes),
      seuil: r.seuil == null ? null : Number(r.seuil),
      // Validée, une épreuve en cours compte déjà ses étoiles : à son début.
      quand: Number(r.finie_le ?? r.commencee_le),
    }))
    return { etoiles: etoilesDansLeTemps(epreuves), ligues: liguesDansLeTemps(cotes, this.semaineDeLHeure().semaine) }
  }

  // ── Les signalements ────────────────────────────────────────────────────

  /**
   * Un joueur signale une erreur dans une question qu'il vient de jouer —
   * après sa réponse : avant, il signalerait sans avoir vu la bonne. Un
   * second signalement du même joueur remplace le premier.
   */
  async signaler(profileId: string, serieId: string, index: number, texte: unknown): Promise<void> {
    const propre = tronquer(String(texte ?? '').trim(), SIGNALEMENT_MAX)
    if (!propre) throw new Error('Dis en une phrase ce qui ne va pas')
    const s = await this.serie(profileId, serieId)
    if (!s) throw new Error('Cette série est introuvable')
    if (!Number.isInteger(index) || index < 0 || index >= s.index) throw new Error('Réponds d’abord à cette question')
    const q = s.questions[index]
    if (!(await this.base()).parId.has(q.id)) throw new Error('Cette question n’est plus dans la campagne')
    // Signalée de nouveau après une relecture, elle revient à relire : l'issue d'avant ne la suit pas.
    await this.client.execute({
      sql: `INSERT INTO campagne_signalements (question_id, profile_id, serie_id, texte, cree_le) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(question_id, profile_id) DO UPDATE SET serie_id = excluded.serie_id, texte = excluded.texte, cree_le = excluded.cree_le,
                                                               traite_le = NULL, issue = NULL, detail = NULL`,
      args: [q.id, profileId, s.id, propre, this.maintenant()],
    })
  }

  /**
   * Les questions signalées et pas encore relues, la plus récente d'abord :
   * qui les signale — ce qu'il en dit, où il l'a jouée, ce qu'il y a
   * répondu —, ceux déjà relus avec, et ce que disent toutes les réponses de
   * campagne. Sa réponse se lit dans la version qu'il a jouée, que sa série
   * garde — réponses mélangées, et peut-être corrigées depuis — : seule
   * cette question en revient (`json_extract`), pas la série entière. Les
   * prénoms se lisent au profil, dans la route (`campagne.ts`).
   */
  async signalements(): Promise<SignalementDeCampagne[]> {
    const [res, base, fichiers, mesure] = await Promise.all([
      this.client.execute(
        `SELECT g.question_id, g.profile_id, g.texte, g.cree_le, g.traite_le, g.issue, s.mode, s.branche, s.palier, r.choix, r.juste,
                json_extract(s.questions, '$[' || r.position || ']') AS vue
         FROM campagne_signalements g
         LEFT JOIN campagne_series s ON s.id = g.serie_id
         LEFT JOIN campagne_reponses r ON r.serie_id = g.serie_id AND r.reserve_id = g.question_id
         WHERE g.question_id IN (
           SELECT question_id FROM campagne_signalements WHERE traite_le IS NULL
           GROUP BY question_id ORDER BY MAX(cree_le) DESC LIMIT ${SIGNALEMENTS_MONTRES_AU_QG}
         )
         ORDER BY g.cree_le DESC`,
      ),
      this.base(),
      this.fichiers(),
      this.mesures(),
    ])
    // Les remplaçantes : nées d'une correction qui a changé la bonne réponse.
    const remplacantes = new Map<string, number>()
    for (const [ancienne, c] of this.corrections) if (c.question.id !== ancienne) remplacantes.set(c.question.id, c.corrigeeLe)
    const parQuestion = new Map<string, Record<string, unknown>[]>()
    for (const r of res.rows) {
      const id = String(r.question_id)
      const lignes = parQuestion.get(id)
      if (lignes) lignes.push(r)
      else parQuestion.set(id, [r])
    }
    const sortie: SignalementDeCampagne[] = []
    for (const [id, lignes] of parQuestion) {
      const q = base.parId.get(id)
      if (!q) continue
      const rapports = lignes.map(r => rapportDe(r, q))
      const ouverts = rapports.filter(r => r.traiteLe === null)
      if (ouverts.length === 0) continue
      const surPlace = this.corrections.get(id)
      sortie.push({
        questionId: q.id,
        texte: q.texte,
        reponses: q.reponses,
        bonne: q.bonne,
        anecdote: q.anecdote,
        categorie: q.meta.categorie,
        sousTheme: q.meta.sousTheme,
        difficulte: q.meta.difficulte,
        niveau: niveauDeQuestion(q.meta.difficulte, mesure.get(q.id)),
        // Ses réponses à elle : la part de sa famille ne se lit qu'au tirage.
        mesure: { justes: mesure.get(q.id)?.justes ?? 0, total: mesure.get(q.id)?.total ?? 0 },
        origine: remplacantes.has(q.id) ? 'correction' : fichiers.parId.has(q.id) ? 'depot' : 'routine',
        corrigeeLe: surPlace?.question.id === q.id ? surPlace.corrigeeLe : (remplacantes.get(q.id) ?? null),
        ...(this.retirees.has(q.id) && { retiree: true as const }),
        joueurs: ouverts.length,
        rapports,
        dernier: Math.max(...ouverts.map(r => r.le)),
      })
    }
    return sortie.sort((a, b) => b.dernier - a.dernier)
  }

  /** L'intitulé d'une question de la base, retirée comprise : ce que le journal du QG en dit. */
  async texteDeLaQuestion(questionId: string): Promise<string | null> {
    return (await this.base()).parId.get(questionId)?.texte ?? null
  }

  /** « Garder » : la question est juste, ses signalements se referment. */
  async garder(questionId: string): Promise<void> {
    await this.client.execute(this.refermerLes(questionId, 'gardee'))
  }

  /**
   * L'écriture qui referme les signalements ouverts d'une question, en
   * disant ce qui en a été fait (`IssueDUnSignalement`) et, pour
   * l'historique, comment — « nouvelle bonne réponse : la Sicile ». Dans le
   * lot du geste : à part, une panne entre les deux laissait la question
   * corrigée et toujours à relire. Le joueur dont la remarque a servi
   * l'apprend sur son accueil (`mercisDe`).
   */
  private refermerLes(questionId: string, issue: IssueDUnSignalement, detail: string | null = null): InStatement {
    return {
      sql: 'UPDATE campagne_signalements SET traite_le = ?, issue = ?, detail = ? WHERE question_id = ? AND traite_le IS NULL',
      args: [this.maintenant(), issue, detail, questionId],
    }
  }

  /**
   * « Retirer » : la campagne ne la tire plus, pour personne — les séries en
   * cours la gardent, elles l'ont déjà. Ses signalements se referment avec.
   * Pour la reprendre plutôt que la perdre, il y a « Corriger ». Déjà
   * retirée — on la signale d'une série tirée avant —, il ne reste qu'à
   * refermer ce qu'on en dit.
   */
  async retirer(questionId: string): Promise<void> {
    if (!(await this.base()).parId.has(questionId)) throw new Error('Cette question n’est pas dans la base')
    await this.client.batch(
      [
        { sql: 'INSERT OR IGNORE INTO campagne_retraits (question_id, retiree_le) VALUES (?, ?)', args: [questionId, this.maintenant()] },
        this.refermerLes(questionId, 'retiree'),
      ],
      'write',
    )
    this.retirees.add(questionId)
  }

  /**
   * « Corriger » : la question se joue désormais dans sa version corrigée,
   * relue par le juge de la base comme une ligne du dépôt. La même bonne
   * réponse, le même identifiant : ses réponses passées et sa difficulté
   * mesurée la suivent. Une autre bonne réponse, et ce n'est plus la même
   * question (`bonneReponseChange`) : elle repart sous un identifiant neuf,
   * sans les mesures de l'ancienne, qui est retirée — et sans ce qui
   * justifiait l'ancienne réponse (son explication, sa valeur, sa date).
   * Les séries déjà tirées, le défi de la semaine compris, gardent la
   * version qu'elles ont lue. Ses signalements se referment.
   *
   * Rangée dans Turso, pas dans les fichiers du dépôt : elle vaut sans
   * déploiement, et l'emporte sur la ligne du fichier tant qu'elle existe.
   * Sous le verrou des dépôts : un identifiant neuf ou un intitulé ne se
   * prennent pas deux fois.
   */
  corriger(questionId: string, brut: unknown): Promise<QuestionCorrigee> {
    return this.avecVerrou('#depot', async () => {
      const [base, duJour] = await Promise.all([this.base(), this.empreintesDuJour()])
      const avant = base.parId.get(questionId)
      if (!avant) throw new Error('Cette question n’est pas dans la base')
      if (this.retirees.has(questionId)) throw new Error('Cette question est retirée de la campagne : on ne la corrige plus')
      const proposee = lireLaCorrection(brut)
      if (!proposee) throw new Error('Envoie l’intitulé, les réponses, l’index de la bonne et l’anecdote')
      // Rangée pour rien, elle masquerait encore la ligne du fichier le jour où on la reprendrait dans le dépôt.
      if (memeLecture(avant, proposee)) throw new Error('Rien n’a changé : « Garder » referme ses signalements')
      const nouvelle = bonneReponseChange(avant, proposee)
      const lu = lireQuestionDeLaBase({
        ...entreeDeLaBase(avant),
        ...proposee,
        leurres: leurresApres(avant, proposee),
        ...(nouvelle && { explication: '', valeur: null, date: null }),
      })
      if ('refus' in lu) throw new Error(`Correction refusée : ${lu.refus}`)
      // Un intitulé neuf n'est celui d'aucune autre question jouable : ni de
      // la base, ni de la réserve du quiz du jour, ni d'un quiz livré.
      if (lu.question.empreinte !== avant.empreinte) {
        this.livres ??= empreintesDesLivres()
        const e = lu.question.empreinte
        if (base.questions.some(x => x.id !== questionId && x.empreinte === e && !this.retirees.has(x.id))) throw new Error('Cet intitulé est déjà celui d’une autre question de la campagne')
        if (duJour.has(e)) throw new Error('Cet intitulé est déjà dans la réserve du quiz du jour')
        if (this.livres.has(e)) throw new Error('Cet intitulé est déjà dans un quiz livré')
      }
      const corrigee = { ...lu.question, id: nouvelle ? nouvelIdentifiant(new Set(base.parId.keys())) : questionId }
      const maintenant = this.maintenant()
      await this.client.batch(
        [
          {
            sql: `INSERT INTO campagne_corrections (question_id, entree, corrigee_le) VALUES (?, ?, ?)
                  ON CONFLICT(question_id) DO UPDATE SET entree = excluded.entree, corrigee_le = excluded.corrigee_le`,
            args: [questionId, JSON.stringify(entreeDeLaBase(corrigee)), maintenant],
          },
          ...(nouvelle ? [{ sql: 'INSERT OR IGNORE INTO campagne_retraits (question_id, retiree_le) VALUES (?, ?)', args: [questionId, maintenant] }] : []),
          this.refermerLes(questionId, 'corrigee', detailDeLaCorrection(avant, corrigee)),
        ],
        'write',
      )
      // Écrite : elle se joue tout de suite. La base fusionnée se refait à la prochaine lecture.
      this.corrections.set(questionId, { question: corrigee, corrigeeLe: maintenant })
      this.versionDesCorrections++
      if (nouvelle) this.retirees.add(questionId)
      return { id: corrigee.id, nouvelle }
    })
  }

  /**
   * « Reclasser » une question signalée (le choix du 14 octobre 2026) : sa
   * catégorie, son sous-thème, sa difficulté estimée à l'écriture. Rangée
   * comme une correction sur place — son identifiant, ses réponses passées
   * et sa difficulté mesurée la suivent —, relue par le juge de la base :
   * elle rejoint les séries, les sentiers et le défi de sa nouvelle
   * catégorie dès le prochain tirage. Les réponses déjà données gardent la
   * leur, que leur série a gardée : les écussons de chacun ne bougent pas.
   * Ses signalements se referment.
   */
  reclasser(questionId: string, brut: unknown): Promise<{ avant: Classement; apres: Classement }> {
    return this.avecVerrou('#depot', async () => {
      const base = await this.base()
      const avant = base.parId.get(questionId)
      if (!avant) throw new Error('Cette question n’est pas dans la base')
      if (this.retirees.has(questionId)) throw new Error('Cette question est retirée de la campagne : on ne la reclasse plus')
      const lu = lireLeClassement(brut, { avecMeta: true })
      if (typeof lu === 'string') throw new Error(lu)
      const classe: Classement = { categorie: avant.meta.categorie, sousTheme: avant.meta.sousTheme, difficulte: avant.meta.difficulte }
      if (classe.categorie === lu.categorie && classe.sousTheme === lu.sousTheme && classe.difficulte === lu.difficulte) {
        throw new Error('Rien n’a changé : « Garder » referme ses signalements')
      }
      const relue = lireQuestionDeLaBase({ ...entreeDeLaBase(avant), categorie: lu.categorie, sousTheme: lu.sousTheme, difficulte: lu.difficulte })
      if ('refus' in relue) throw new Error(`Reclassement refusé : ${relue.refus}`)
      const reclassee = { ...relue.question, id: questionId }
      const maintenant = this.maintenant()
      await this.client.batch(
        [
          {
            sql: `INSERT INTO campagne_corrections (question_id, entree, corrigee_le) VALUES (?, ?, ?)
                  ON CONFLICT(question_id) DO UPDATE SET entree = excluded.entree, corrigee_le = excluded.corrigee_le`,
            args: [questionId, JSON.stringify(entreeDeLaBase(reclassee)), maintenant],
          },
          this.refermerLes(questionId, 'reclassee', classementEcrit(lu)),
        ],
        'write',
      )
      this.corrections.set(questionId, { question: reclassee, corrigeeLe: maintenant })
      this.versionDesCorrections++
      return { avant: classe, apres: lu }
    })
  }

  /**
   * Les questions relues depuis `depuis`, la plus récente d'abord :
   * l'historique de la page des signalements. Une relecture referme d'un
   * coup les signalements ouverts d'une question, au même instant et sous la
   * même issue : ils se regroupent par là. L'intitulé, tel que la base le
   * garde sous cet identifiant — celui qu'on a signalé, quand une correction
   * l'a remplacée par une neuve.
   */
  async relus(depuis: number): Promise<SignalementRelu[]> {
    const [res, base] = await Promise.all([
      this.client.execute({
        sql: `SELECT question_id, traite_le, MAX(issue) AS issue, MAX(detail) AS detail, COUNT(*) AS n
              FROM campagne_signalements WHERE traite_le >= ?
              GROUP BY question_id, traite_le ORDER BY traite_le DESC LIMIT ?`,
        args: [depuis, RELUS_MONTRES],
      }),
      this.base(),
    ])
    return res.rows.flatMap((r): SignalementRelu[] => {
      const q = base.parId.get(String(r.question_id))
      return q
        ? [
            {
              source: 'campagne',
              cle: q.id,
              texte: q.texte,
              categorie: q.meta.categorie,
              issue: lireIssue(r.issue),
              detail: typeof r.detail === 'string' ? r.detail : null,
              quand: Number(r.traite_le),
              joueurs: Number(r.n),
            },
          ]
        : []
    })
  }

  /**
   * Les questions de la campagne qu'il a signalées et dont sa remarque a
   * servi — corrigée, reclassée, retirée —, relues depuis `depuis` : son
   * accueil le remercie, une fois par téléphone. Une question gardée ne dit
   * rien. Une requête par son index, dans le lot de l'accueil ; la base ne
   * se lit que s'il y a de quoi remercier.
   */
  async mercisDe(profileId: string, depuis: number): Promise<AnnonceDeLAdministrateur[]> {
    const res = await this.client.execute({
      sql: `SELECT question_id, traite_le, issue FROM campagne_signalements
            WHERE profile_id = ? AND traite_le >= ? AND issue IN (${ISSUES_QUI_SERVENT.map(() => '?').join(', ')})`,
      args: [profileId, depuis, ...ISSUES_QUI_SERVENT],
    })
    if (res.rows.length === 0) return []
    const base = await this.base()
    return res.rows.flatMap((r): AnnonceDeLAdministrateur[] => {
      const issue = lireIssue(r.issue)
      const q = base.parId.get(String(r.question_id))
      if (!issue || issue === 'gardee' || !q) return []
      return [{ id: `merci:campagne:${q.id}:${r.traite_le}`, sorte: 'merci', mode: 'campagne', issue, question: extrait(q.texte, QUESTION_DU_MERCI), le: Number(r.traite_le) }]
    })
  }

  /** L'écran de l'administrateur : la base, ce qu'on en joue, et les signalements à relire. */
  async administration(): Promise<AdminDeLaCampagne> {
    const [jouables, signalements, base, mesure] = await Promise.all([this.jouables(), this.signalements(), this.base(), this.mesures()])
    // Ce que les réponses contredisent, les plus nettes d'abord : ce que les familles n'ont pas reclassé d'elles-mêmes.
    const contredites = jouables
      .flatMap(q => {
        const c = marcheContredite(q.meta.difficulte, mesure.get(q.id))
        return c ? [{ q, c, m: mesure.get(q.id)! }] : []
      })
      .sort((a, b) => b.c.force - a.c.force)
    return {
      contredites: contredites.slice(0, CONTREDITES_MONTREES).map(({ q, c, m }) => ({
        questionId: q.id,
        texte: q.texte,
        reponses: q.reponses,
        bonne: q.bonne,
        categorie: q.meta.categorie,
        sousTheme: q.meta.sousTheme,
        difficulte: q.meta.difficulte,
        niveau: c.niveau,
        niveauMesure: c.niveauMesure,
        mesure: { justes: m.justes, total: m.total },
        difficulteProposee: c.difficulteProposee,
      })),
      contreditesEnTout: contredites.length,
      questions: base.questions.length,
      jouables: jouables.length,
      retirees: this.retirees.size,
      parCategorie: parCategorie(jouables),
      parDifficulte: CATEGORIES.map(categorie => {
        const difficultes = [0, 0, 0, 0, 0]
        for (const q of jouables) if (q.meta.categorie === categorie) difficultes[q.meta.difficulte - 1]++
        return { categorie, difficultes }
      }),
      ajouts: this.ajoutsDeLaRoutine(base),
      signalements,
    }
  }

  // ── L'Expédition ────────────────────────────────────────────────────────
  //
  // Trois actes, chacun une carte tirée au sort, un gardien au bout de chacun,
  // un légendaire à garder au bout du troisième (`shared/expedition.ts`, le
  // brief du 17 octobre 2026). Une partie d'un autre mode
  // (`mode = 'expedition'`) : ses réponses vont au journal de toutes les
  // parties — l'expérience, les confettis, le carnet et « jamais vues
  // d'abord » les comptent sans rien en savoir ; son état se replie de son
  // départ, de ses gestes (`expedition_gestes`) et de ses réponses. Chaque
  // geste se lit, se juge sur le pli, puis s'écrit d'un lot, sous le verrou du
  // profil.

  /** Ce qu'une expédition a de quoi replier : sa ligne, ses gestes, ses réponses — d'un aller-retour. */
  private async lireLExpedition(profileId: string, id: string): Promise<ExpeditionLue | null> {
    const [series, gestes, reponses] = await this.client.batch(
      [
        { sql: `SELECT * FROM campagne_series WHERE id = ? AND profile_id = ? AND mode = 'expedition'`, args: [id, profileId] },
        { sql: 'SELECT geste FROM expedition_gestes WHERE serie_id = ? ORDER BY rang', args: [id] },
        { sql: 'SELECT position, juste FROM campagne_reponses WHERE serie_id = ?', args: [id] },
      ],
      'read',
    )
    return expeditionLue(series.rows[0], gestes.rows, reponses.rows)
  }

  /** Les légendaires qu'il a : l'expédition tire ses gardiens parmi les autres. */
  private legendairesDe(profileId: string): ReadonlySet<string> {
    return new Set(this.recompenses?.legendairesOf?.(profileId) ?? [])
  }

  /**
   * La page de l'expédition : celle qu'il a en route, sinon la prochaine — son
   * numéro et ses gardiens, annoncés avant le départ, que le départ
   * retrouve : la graine de la n-ième expédition d'un profil ne change pas
   * (`graineDe`). Un aller-retour.
   */
  async pageDeLExpedition(profileId: string): Promise<PageDeLExpedition> {
    const enRoute = `SELECT id FROM campagne_series WHERE profile_id = ? AND mode = 'expedition' AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1`
    const [series, gestes, reponses, compte] = await this.client.batch(
      [
        { sql: `SELECT * FROM campagne_series WHERE id = (${enRoute})`, args: [profileId] },
        { sql: `SELECT geste FROM expedition_gestes WHERE serie_id = (${enRoute}) ORDER BY rang`, args: [profileId] },
        { sql: `SELECT position, juste FROM campagne_reponses WHERE serie_id = (${enRoute})`, args: [profileId] },
        { sql: `SELECT COUNT(*) AS n FROM campagne_series WHERE profile_id = ? AND mode = 'expedition'`, args: [profileId] },
      ],
      'read',
    )
    const lue = expeditionLue(series.rows[0], gestes.rows, reponses.rows)
    const graine = graineDe(profileId, Number(compte.rows[0]?.n ?? 0))
    const siens = this.legendairesDe(profileId)
    const gardiens = gardiensDe(graine, siens)
    return {
      expedition: lue ? vueDeLExpedition(lue, plier(lue), siens) : null,
      prochaine: { numero: numeroDeLaCarte(graine), gardiens, aLui: gardiens.filter(g => siens.has(g)) },
    }
  }

  /**
   * Partir : ses trois cartes et ses gardiens, tirés de la graine de sa
   * prochaine expédition, et la chance qu'il a sur chaque escale, gardée avec
   * elle. Une à la fois : celle qu'il a laissée l'attend.
   */
  partirEnExpedition(profileId: string): Promise<VueDeLExpedition> {
    return this.avecVerrou(profileId, async () => {
      const [ouverte, compte] = await this.client.batch(
        [
          { sql: `SELECT id FROM campagne_series WHERE profile_id = ? AND mode = 'expedition' AND finie_le IS NULL LIMIT 1`, args: [profileId] },
          { sql: `SELECT COUNT(*) AS n FROM campagne_series WHERE profile_id = ? AND mode = 'expedition'`, args: [profileId] },
        ],
        'read',
      )
      if (ouverte.rows.length > 0) throw new Error('Ton expédition t’attend : reprends-la, ou abandonne-la d’abord')
      const jouables = await this.jouables()
      if (jouables.length < QUESTIONS_POUR_JOUER) throw new Error('L’expédition n’a pas encore de questions à poser : reviens bientôt')
      const graine = graineDe(profileId, Number(compte.rows[0]?.n ?? 0))
      // Les thèmes pointus : les sujets qui ont de quoi tirer, comme un parcours de thème — dans l'ordre de leur clé, pour que la graine redonne la même carte.
      const sujets = [...this.sujetsComptes(jouables)]
        .filter(([, n]) => n >= QUESTIONS_POUR_UN_SENTIER_DE_SUJET)
        .map(([cle]) => cle)
        .sort()
      const cartes = Array.from({ length: ACTES }, (_, acte) => carteDUnActe(graine, acte, sujets))
      const moyen = await this.chancesDeLExpedition(profileId, cartes, jouables)
      const siens = this.legendairesDe(profileId)
      const depart: DepartDExpedition = { v: 1, graine, numero: numeroDeLaCarte(graine), gardiens: gardiensDe(graine, siens), cartes, moyen }
      const id = randomUUID()
      await this.client.execute({
        sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, expedition)
              VALUES (?, ?, '[]', 0, ?, 0, ?, NULL, 'expedition', ?)`,
        args: [id, profileId, VIES, this.maintenant(), JSON.stringify(depart)],
      })
      const serie: Serie = {
        id,
        profileId,
        questions: [],
        index: 0,
        vies: VIES,
        justes: 0,
        finieLe: null,
        mode: 'expedition',
        branche: null,
        palier: null,
        seuil: null,
        rejeu: false,
        issue: null,
        expedition: depart,
      }
      const lue: ExpeditionLue = { serie, depart, gestes: [], reponses: new Map() }
      return vueDeLExpedition(lue, plier(lue), siens)
    })
  }

  /**
   * Sa chance sur chaque escale, au départ (le choix du brief : « se calcule
   * et se garde avec elle », comme la chance d'une épreuve) : celle que le
   * modèle du savoir lui prête à la marche de l'escale, sur ses catégories —
   * à parts égales dans un mélange, au poids de leurs questions dans un
   * sujet —, ramenée à sa forme. Sans modèle, ou sous vingt premières
   * réponses, celle d'un joueur moyen — la page le dit (`moyen`). Ce n'est
   * qu'un renseignement : un calcul raté part sans lui.
   */
  private async chancesDeLExpedition(profileId: string, cartes: CarteDUnActe[], jouables: readonly QuestionDeLaBase[]): Promise<boolean> {
    const modele = this.modeleDuSavoir()
    let sa: { reference: SerieDeReference; lui: ForceDUnJoueur } | null = null
    if (modele) {
      try {
        const [base, mesure, lues] = await Promise.all([this.base(), this.mesures(), this.client.execute(lectureDesVues(profileId))])
        const { reference, forceDe } = this.forceSurLesSentiers(profileId, modele, base, jouables, mesure)
        const lui = forceDe(lireLesVues(lues.rows).premieres)
        if (lui.reponses >= PREMIERES_REPONSES_POUR_SA_CHANCE) sa = { reference, lui }
      } catch (e) {
        console.warn('[expedition] chances non calculées :', e instanceof Error ? e.message : e)
      }
    }
    const partsDuSujet = new Map<string, { c: number; poids: number }[]>()
    const parts = (theme: ThemeDEscale): { c: number; poids: number }[] => {
      if ('categories' in theme) return theme.categories.map(cat => ({ c: indiceDeCategorie(cat), poids: 1 }))
      let lues = partsDuSujet.get(theme.sujet)
      if (!lues) {
        const compte = new Map<number, number>()
        for (const q of this.duSujet(jouables, theme.sujet)) {
          const c = indiceDeCategorie(q.meta.categorie)
          compte.set(c, (compte.get(c) ?? 0) + 1)
        }
        partsDuSujet.set(theme.sujet, (lues = [...compte].map(([c, poids]) => ({ c, poids }))))
      }
      return lues
    }
    const chance = (marche: Niveau, theme?: ThemeDEscale): number => {
      if (!sa) return chanceDuJoueurMoyen(marche)
      // Hors d'une catégorie (−1), sa chance se lit sur toutes (`chanceSurLaMarche`) : un gardien, une source.
      const lesParts = theme ? parts(theme) : [{ c: -1, poids: 1 }]
      let somme = 0
      let total = 0
      for (const { c, poids } of lesParts) {
        somme += poids * chanceSurLaMarche(sa.reference, marche, c, sa.lui.force + (c >= 0 ? (sa.lui.ecarts[c] ?? 0) : 0))
        total += poids
      }
      return total > 0 ? somme / total : chanceDuJoueurMoyen(marche)
    }
    cartes.forEach((carte, acte) => {
      for (const e of carte.escales) {
        if (e.sorte === 'question' || e.sorte === 'elite') e.chance = arrondiDeChance(chanceSelonLaForme(chance(marcheDe(acte, e), e.theme), e.forme ?? 'quatre'))
        // Une source repose une erreur de son carnet : une question qu'il a ratée, que sa chance sur une moyenne de toutes les catégories résume.
        else if (e.sorte === 'source') e.chance = arrondiDeChance(chance('moyen'))
      }
      carte.chanceDuGardien = arrondiDeChance(chance(MARCHES_DES_ACTES[acte].gardien))
    })
    return sa === null
  }

  /**
   * Un geste : avancer vers une escale reliée — sa question tirée dans le
   * même lot —, ou garder un gardien au bout de l'acte 3. Le geste dit le
   * rang qu'il croit suivre : un double toucher, un second onglet ne jouent
   * pas deux fois (invariant 12, porté au solo).
   */
  gesteDExpedition(profileId: string, id: string, rang: unknown, brut: unknown): Promise<ApresUnGeste> {
    return this.avecVerrou(profileId, async () => {
      const l = await this.lireLExpedition(profileId, id)
      if (!l) throw new Error('Cette expédition est introuvable')
      if (l.serie.finieLe !== null) throw new Error('Cette expédition est finie : pars pour une autre')
      if (rang !== l.gestes.length + 1) throw new Error('Ce geste est passé : l’expédition a continué sans lui')
      const g = lireGeste(brut)
      if (!g) throw new Error('Ce geste ne se lit pas : recharge la page')
      const avant = plier(l)
      const maintenant = this.maintenant()
      if (g.quoi === 'garder') return this.garderUnGardien(profileId, l, avant, g, maintenant)
      if (g.quoi !== 'avancer') throw new Error('Ce geste ne se lit pas : recharge la page')
      if (!escalesPermises(l.depart, avant).includes(g.vers)) throw new Error('Cette escale n’est pas sur ta route : choisis-en une reliée à la tienne')
      const escale = l.depart.cartes[avant.acte].escales.find(e => e.id === g.vers)!
      const tirees = aUneQuestion(escale.sorte) ? await this.tirerPourLEscale(profileId, l, escale, avant) : []
      const questions = [...l.serie.questions, ...tirees]
      const gestes = [...l.gestes, g]
      const apres = pliDeLExpedition(l.depart, gestes, questionsPosees(questions), l.reponses)
      await this.client.batch(
        [
          { sql: 'INSERT INTO expedition_gestes (serie_id, rang, geste, fait_le) VALUES (?, ?, ?, ?)', args: [l.serie.id, gestes.length, JSON.stringify(g), maintenant] },
          tirees.length > 0
            ? { sql: 'UPDATE campagne_series SET questions = ?, position = ?, vies = ? WHERE id = ?', args: [JSON.stringify(questions), apres.enAttente ?? apres.passees, apres.vies, l.serie.id] }
            : { sql: 'UPDATE campagne_series SET position = ?, vies = ? WHERE id = ?', args: [apres.enAttente ?? apres.passees, apres.vies, l.serie.id] },
        ],
        'write',
      )
      return { expedition: vueDeLExpedition({ ...l, serie: { ...l.serie, questions }, gestes }, apres, this.legendairesDe(profileId)) }
    })
  }

  /**
   * Garder un gardien, au bout de l'acte 3 : un légendaire de plus. La ligne
   * qui le lui donne se range d'abord — un rangement qui échoue ne laisse pas
   * une expédition finie sans son légendaire : le geste se rejoue —, puis
   * l'expédition se clôt.
   */
  private async garderUnGardien(profileId: string, l: ExpeditionLue, avant: EtatDeLExpedition, g: Extract<GesteDExpedition, { quoi: 'garder' }>, maintenant: number): Promise<ApresUnGeste> {
    if (avant.issue !== 'au-bout') throw new Error('Va au bout de l’acte 3 pour garder un gardien')
    if (!l.depart.gardiens.includes(g.legendaire)) throw new Error('Ce gardien n’est pas de ton expédition')
    const legendaires = this.recompenses ? this.recompenses.legendairesOuverts(profileId, await this.recompenses.ranger(profileId, cleDeSerie(l.serie.id), [cleDeLExpedition(g.legendaire)], maintenant)) : []
    const gestes = [...l.gestes, g]
    const apres = pliDeLExpedition(l.depart, gestes, questionsPosees(l.serie.questions), l.reponses)
    await this.client.batch(
      [
        { sql: 'INSERT INTO expedition_gestes (serie_id, rang, geste, fait_le) VALUES (?, ?, ?, ?)', args: [l.serie.id, gestes.length, JSON.stringify(g), maintenant] },
        { sql: `UPDATE campagne_series SET finie_le = ?, issue = 'legendaire' WHERE id = ?`, args: [maintenant, l.serie.id] },
      ],
      'write',
    )
    const gains = await this.recompenserLExpedition(profileId, l.serie.id, maintenant)
    await this.faireGrandir(profileId)
    const tous = [...new Set([...legendaires, ...(gains.legendaires ?? [])])]
    return {
      expedition: vueDeLExpedition({ ...l, serie: { ...l.serie, finieLe: maintenant }, gestes }, apres, this.legendairesDe(profileId)),
      ...(gains.recompenses && { recompenses: gains.recompenses }),
      ...(tous.length > 0 && { legendaires: tous }),
    }
  }

  /**
   * Une réponse : juste ou non, et ce que le pli en fait — une vie de moins à
   * une question ratée, une de plus à une source retrouvée, le gardien qui
   * tombe et l'acte suivant qui s'ouvre. Une bonne réponse paie comme en
   * série : un confetti, l'expérience d'une bonne réponse.
   */
  repondreEnExpedition(profileId: string, id: string, position: unknown, choix: unknown): Promise<ReponseDExpedition> {
    return this.avecVerrou(profileId, async () => {
      const l = await this.lireLExpedition(profileId, id)
      if (!l) throw new Error('Cette expédition est introuvable')
      if (l.serie.finieLe !== null) throw new Error('Cette expédition est finie : pars pour une autre')
      const avant = plier(l)
      if (avant.enAttente === null || position !== avant.enAttente) throw new Error('Cette question est passée : l’expédition a continué sans elle')
      const i = avant.enAttente
      const q = l.serie.questions[i]
      if (!q) throw new Error('Cette question n’est pas encore tirée : recharge la page')
      const c = typeof choix === 'number' && Number.isInteger(choix) && choix >= 0 && choix < q.reponses.length ? choix : null
      const juste = c === q.bonne
      const reponses = new Map(l.reponses).set(i, juste)
      let questions = l.serie.questions
      let apres = pliDeLExpedition(l.depart, l.gestes, questionsPosees(questions), reponses)
      // Le gardien attend encore sans question tirée pour lui — une vie rendue en plein combat, à l'étape des jokers : une de plus.
      if (apres.gardien && apres.enAttente !== null && apres.enAttente >= questions.length) {
        const gardien = l.depart.cartes[apres.acte].escales.find(e => e.id === GARDIEN)!
        questions = [...questions, ...(await this.tirerPourLEscale(profileId, { ...l, serie: { ...l.serie, questions } }, gardien, apres, 1))]
        apres = pliDeLExpedition(l.depart, l.gestes, questionsPosees(questions), reponses)
      }
      const finie = apres.issue === 'perdue'
      const maintenant = this.maintenant()
      const position_ = apres.enAttente ?? apres.passees
      const lot: InStatement[] = [
        {
          sql: 'INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [l.serie.id, i, q.id, c, juste ? 1 : 0, maintenant, this.compagnonPorte(profileId)],
        },
        questions !== l.serie.questions
          ? {
              sql: 'UPDATE campagne_series SET questions = ?, position = ?, vies = ?, justes = ?, finie_le = ?, issue = ? WHERE id = ?',
              args: [JSON.stringify(questions), position_, apres.vies, apres.justes, finie ? maintenant : null, finie ? 'perdue' : null, l.serie.id],
            }
          : {
              sql: 'UPDATE campagne_series SET position = ?, vies = ?, justes = ?, finie_le = ?, issue = ? WHERE id = ?',
              args: [position_, apres.vies, apres.justes, finie ? maintenant : null, finie ? 'perdue' : null, l.serie.id],
            },
      ]
      if (juste) lot.push(...lecturesDeLExperience(profileId))
      const res = await this.client.batch(lot, 'write')
      const xp = juste ? await this.crediter(profileId, res.slice(-2)) : 0
      const gains = finie ? await this.recompenserLExpedition(profileId, l.serie.id, maintenant) : {}
      if (finie) await this.faireGrandir(profileId)
      const vaincu = apres.vaincus > avant.vaincus ? l.depart.gardiens[avant.acte] : undefined
      return {
        juste,
        bonne: q.bonne,
        anecdote: q.anecdote,
        xp,
        expedition: vueDeLExpedition({ ...l, serie: { ...l.serie, questions, finieLe: finie ? maintenant : null }, reponses }, apres, this.legendairesDe(profileId)),
        ...(vaincu && { vaincu }),
        ...gains,
      }
    })
  }

  /** Abandonner l'expédition : elle finit là, sans légendaire ; ce qu'elle a joué compte, comme une série abandonnée. */
  abandonnerLExpedition(profileId: string, id: string): Promise<ApresUnGeste> {
    return this.avecVerrou(profileId, async () => {
      const l = await this.lireLExpedition(profileId, id)
      if (!l) throw new Error('Cette expédition est introuvable')
      if (l.serie.finieLe !== null) throw new Error('Cette expédition est finie : pars pour une autre')
      const maintenant = this.maintenant()
      const gestes: GesteDExpedition[] = [...l.gestes, { quoi: 'abandonner' }]
      const apres = pliDeLExpedition(l.depart, gestes, questionsPosees(l.serie.questions), l.reponses)
      await this.client.batch(
        [
          { sql: 'INSERT INTO expedition_gestes (serie_id, rang, geste, fait_le) VALUES (?, ?, ?, ?)', args: [l.serie.id, gestes.length, JSON.stringify({ quoi: 'abandonner' }), maintenant] },
          { sql: `UPDATE campagne_series SET finie_le = ?, issue = 'abandonnee' WHERE id = ?`, args: [maintenant, l.serie.id] },
        ],
        'write',
      )
      const gains = await this.recompenserLExpedition(profileId, l.serie.id, maintenant)
      await this.faireGrandir(profileId)
      return { expedition: vueDeLExpedition({ ...l, serie: { ...l.serie, finieLe: maintenant }, gestes }, apres, this.legendairesDe(profileId)), ...gains }
    })
  }

  /** Ce que la fin d'une expédition fait tomber : les paliers de la campagne que ses bonnes réponses font atteindre — Le Marathonien. */
  private async recompenserLExpedition(profileId: string, serieId: string, quand: number): Promise<Recompenses> {
    try {
      return await this.recompenser(profileId, serieId, [], quand)
    } catch (e) {
      // L'expédition est rangée : une étagère muette n'y change rien, la fin suivante les relira.
      console.error('[expedition] récompenses non rangées :', e)
      return {}
    }
  }

  /**
   * Les questions d'une escale : une, à sa marche et sur son thème — un
   * sujet, une catégorie, un mélange —, jamais vue d'abord ; une erreur de
   * son carnet pour une source, la plus en retard d'abord, sinon une facile ;
   * de quoi aller au bout de ses vies pour un gardien, toutes catégories, sans
   * vrai ou faux — une chance sur deux à la porte de l'acte suivant. Ce que
   * l'expédition a déjà posé passe en dernier, comme vu à l'instant.
   */
  private async tirerPourLEscale(profileId: string, l: ExpeditionLue, escale: EscaleDeLaCarte, e: EtatDeLExpedition, combien?: number): Promise<QuestionDeSerie[]> {
    const maintenant = this.maintenant()
    const source = escale.sorte === 'source'
    const [toutes, mesure, lues, suivis] = await Promise.all([
      this.jouables(),
      this.mesures(),
      this.client.execute(lectureDesVues(profileId)).then(r => lireLesVues(r.rows)),
      source ? this.suivisDe(profileId) : null,
    ])
    const dejaPosees = new Set(l.serie.questions.map(q => q.id))
    const vues = new Map(lues.vues)
    for (const id of dejaPosees) vues.set(id, maintenant)
    const acte = e.acte
    const rangee = (q: QuestionDeLaBase, niveau: Niveau): QuestionDeSerie => ({ ...versQuestionDeSerie(q, niveau), escale: escale.id, acte })
    if (suivis) {
      const parId = new Map(toutes.map(q => [q.id, q]))
      const aRevoir = [...suivis]
        .flatMap(([id, s]) => (!s.apprise && parId.has(id) && !dejaPosees.has(id) ? [{ id, le: s.revientLe }] : []))
        .sort((a, b) => a.le.localeCompare(b.le))
      const q = aRevoir.length > 0 ? parId.get(aRevoir[0].id)! : null
      // Reprise du carnet, elle le dit : sa réponse a été lue, rien ne la mesure (`HORS_DU_CARNET`).
      if (q) return [{ ...rangee(q, niveauDeQuestion(q.meta.difficulte, mesure.get(q.id))), carnet: true }]
    }
    const gardien = escale.sorte === 'gardien'
    const marche: Niveau = source ? 'facile' : marcheDe(acte, escale)
    const n = combien ?? (gardien ? questionsDuGardien(acte, e.vies) : 1)
    const theme = escale.theme
    let pool: readonly QuestionDeLaBase[] = toutes
    if (theme && 'sujet' in theme) pool = this.duSujet(toutes, theme.sujet)
    else if (theme) {
      const categories = new Set(theme.categories)
      pool = toutes.filter(q => categories.has(q.meta.categorie))
    }
    // Un thème qui n'a plus de quoi tirer — une base qui a changé depuis le départ — tire dans toute la base.
    if (pool.length < n * 2) pool = toutes
    const melange: Melange = { [marche]: n }
    const regle: RegleDuPalier = { n: 0, melange, seuil: 0, avatar: null, maitre: false, sansVraiFaux: gardien, touteLaCategorie: false }
    return tirerUneEpreuve(pool, regle, vues, mesure, maintenant).map(x => rangee(x.question, x.niveau))
  }

  /** Un profil supprimé : ses séries, leurs réponses et ses signalements, sous son verrou. */
  oublierProfil(profileId: string): Promise<void> {
    return this.avecVerrou(profileId, async () => {
      this.enCours.delete(profileId)
      await this.client.batch(
        [
          { sql: 'DELETE FROM campagne_reponses WHERE serie_id IN (SELECT id FROM campagne_series WHERE profile_id = ?)', args: [profileId] },
          { sql: 'DELETE FROM expedition_gestes WHERE serie_id IN (SELECT id FROM campagne_series WHERE profile_id = ?)', args: [profileId] },
          { sql: 'DELETE FROM campagne_series WHERE profile_id = ?', args: [profileId] },
          { sql: 'DELETE FROM campagne_signalements WHERE profile_id = ?', args: [profileId] },
          { sql: 'DELETE FROM sentier_acquis WHERE profile_id = ?', args: [profileId] },
          // Ce qu'on lui a envoyé — ou prévu de lui envoyer —, ce qu'il a envoyé, et les listes d'amis où il était — retiré ou ajouté.
          { sql: 'DELETE FROM campagne_envois WHERE profile_id = ? OR code IN (SELECT code FROM campagne_duels WHERE auteur = ?)', args: [profileId, profileId] },
          { sql: 'DELETE FROM campagne_envois_prevus WHERE profile_id = ? OR code IN (SELECT code FROM campagne_duels WHERE auteur = ?)', args: [profileId, profileId] },
          { sql: 'DELETE FROM campagne_amis_retires WHERE profile_id = ? OR ami = ?', args: [profileId, profileId] },
          { sql: 'DELETE FROM campagne_amis_ajoutes WHERE profile_id = ? OR ami = ?', args: [profileId, profileId] },
        ],
        'write',
      )
      // Ses duels sont partis avec ses séries : le classement se relira sans lui, et ses bordures sont oubliées.
      this.cotes = null
      this.bordures.delete(profileId)
      this.bordureDuTour.delete(profileId)
      // Ses réponses aussi : le modèle du savoir l'oublie, et se refera sans elles au prochain dé.
      if (this.savoir) {
        const forces = new Map(this.savoir.modele.forces)
        forces.delete(profileId)
        this.savoir = { ...this.savoir, a: Number.NEGATIVE_INFINITY, modele: { ...this.savoir.modele, forces } }
      }
    })
  }

  close() {
    this.ferme = true
    this.client.close()
  }
}

/**
 * La lecture de ses bonnes réponses, comptées par heure : une ligne par
 * bonne réponse — des milliers pour un fidèle — repartait de Turso à chaque
 * bonne réponse. Seule (`justesParJour`), ou au bout du lot qui écrit une
 * réponse.
 */
function lectureDesJustes(profileId: string): InStatement {
  return {
    sql: `SELECT CAST(r.repondue_le / ${HEURE_MS} AS INTEGER) AS heure, COUNT(*) AS n
          FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
          WHERE s.profile_id = ? AND r.juste = 1 GROUP BY heure`,
    args: [profileId],
  }
}

/**
 * Sa première réponse à une question, dans une agrégation SQL : celle de son
 * premier instant — `MIN(repondue_le * 2 + juste)` range par instant, et sa
 * parité dit si elle était juste. Une révision ne pose que ce qu'il a déjà
 * vu : sa première réponse n'y est jamais.
 */
const PREMIERE_REPONSE = 'MIN(r.repondue_le * 2 + r.juste) % 2'

/**
 * Les questions qu'il a vues, quand pour la dernière fois, et sa première
 * réponse à chacune — le modèle du savoir la lit au dé (`forceDuJoueur`) et
 * au départ d'une épreuve, pour la chance qu'elle garde (`chanceAuDepart`) :
 * seule (`vuesPar`), ou dans le lot qui prépare le dé
 * (`commencerUneRencontre`). En un seul texte (`json_group_object`) : une
 * ligne par question — des milliers pour un fidèle — se décodait ligne à
 * ligne à chaque série et à chaque dé, 235 Ko et 9,6 ms pour trois mille,
 * quatre à dix fois plus au dixième de cœur de l'hébergeur ; en un texte,
 * 79 Ko et 2,3 ms. Sa première réponse y passe dans le même texte : lue à
 * part, elle reparcourait toutes ses réponses une seconde fois.
 */
function lectureDesVues(profileId: string): InStatement {
  return {
    sql: `SELECT json_group_object(reserve_id, json_array(le, juste)) AS vues FROM (
            SELECT r.reserve_id, MAX(r.repondue_le) AS le, ${PREMIERE_REPONSE} AS juste
            FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
            WHERE s.profile_id = ? GROUP BY r.reserve_id
          )`,
    args: [profileId],
  }
}

/** Sa première réponse à une question : quand, et si elle était juste. */
interface PremiereReponse {
  le: number
  juste: boolean
}

/**
 * Ses premières réponses, chacune avec son instant : la page des sentiers y
 * relit sa force d'aujourd'hui et celle d'il y a une semaine
 * (`chancesPourLui`). `MIN(repondue_le * 2 + juste)` dit les deux d'un
 * nombre — l'instant de la première, et sa parité si elle était juste —,
 * comme `PREMIERE_REPONSE` ; et en un seul texte, comme ce qu'il a vu
 * (`lectureDesVues`).
 */
function lectureDesPremieres(profileId: string): InStatement {
  return {
    sql: `SELECT json_group_object(reserve_id, k) AS premieres FROM (
            SELECT r.reserve_id, MIN(r.repondue_le * 2 + r.juste) AS k
            FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
            WHERE s.profile_id = ? GROUP BY r.reserve_id
          )`,
    args: [profileId],
  }
}

/** Le texte de `lectureDesPremieres`, question par question. */
function lireLesPremieres(lignes: readonly Record<string, unknown>[]): Map<string, PremiereReponse> {
  const texte = lignes[0]?.premieres
  const lu = typeof texte === 'string' ? (JSON.parse(texte) as Record<string, unknown>) : {}
  const premieres = new Map<string, PremiereReponse>()
  for (const [id, k] of Object.entries(lu)) {
    const n = Number(k)
    if (Number.isFinite(n)) premieres.set(id, { le: Math.floor(n / 2), juste: n % 2 === 1 })
  }
  return premieres
}

/** Une chance au millième : ce que la page en écrit, sans faire voyager seize décimales. */
const arrondiDeChance = (x: number) => Math.round(x * 1000) / 1000

/** Sa chance de valider un palier d'une catégorie, à sa force (`chanceDeLEpreuve`) : celle que la page écrit, et que l'épreuve garde. */
const saChanceSur = (reference: SerieDeReference, c: number, f: Pick<ForceDUnJoueur, 'force' | 'ecarts'>, regle: RegleDuPalier): number =>
  arrondiDeChance(chanceDeLEpreuve(reference, c, f.force + (f.ecarts[c] ?? 0), regle.melange, regle.seuil))

/** Le texte de `lectureDesVues` : ce qu'il a vu, question par question (`parFraicheur`), et sa première réponse à chacune. */
function lireLesVues(lignes: readonly Record<string, unknown>[]): { vues: Map<string, number>; premieres: Map<string, boolean> } {
  const texte = lignes[0]?.vues
  const lu = typeof texte === 'string' ? (JSON.parse(texte) as Record<string, unknown>) : {}
  const vues = new Map<string, number>()
  const premieres = new Map<string, boolean>()
  for (const [id, valeur] of Object.entries(lu)) {
    if (!Array.isArray(valeur)) continue
    vues.set(id, Number(valeur[0]))
    premieres.set(id, Number(valeur[1]) === 1)
  }
  return { vues, premieres }
}

/**
 * Les premières réponses de tout le monde, pour ajuster le modèle du savoir
 * (`ajusterLeSavoir`) : une ligne par joueur, ses réponses en un texte. En un
 * seul texte, cent mille réponses se décodaient d'un bloc, et le serveur ne
 * répondait plus à personne ; une ligne par réponse, chacune se décodait à
 * coups de `defineProperty`. Une ligne par joueur se lit entre deux tranches
 * (`premieresDeTous`).
 */
const LECTURE_DU_SAVOIR = `SELECT profile_id, json_group_object(reserve_id, juste) AS premieres FROM (
    SELECT s.profile_id AS profile_id, r.reserve_id AS reserve_id, ${PREMIERE_REPONSE} AS juste
    FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
    GROUP BY s.profile_id, r.reserve_id
  ) GROUP BY profile_id`

/** Les lignes de `LECTURE_DU_SAVOIR`, joueur par joueur — en rendant la main de temps en temps : des milliers de réponses chacun. */
async function premieresDeTous(lignes: readonly Record<string, unknown>[]): Promise<Map<string, Map<string, boolean>>> {
  const joueurs = new Map<string, Map<string, boolean>>()
  let lues = 0
  for (const r of lignes) {
    const texte = r.premieres
    const lu = typeof texte === 'string' ? (JSON.parse(texte) as Record<string, unknown>) : {}
    const siennes = new Map<string, boolean>()
    for (const [id, juste] of Object.entries(lu)) siennes.set(id, Number(juste) === 1)
    joueurs.set(String(r.profile_id), siennes)
    lues += siennes.size
    if (lues >= CHANCES_PAR_TRANCHE) {
      lues = 0
      await new Promise<void>(rendre => setImmediate(rendre))
    }
  }
  return joueurs
}

/**
 * Ses duels classés finis (`shared/duels.ts`) — ou ceux de tout le monde,
 * pour le classement : chacun ses bonnes réponses et celles du score à
 * battre, comptées dans la base sans faire voyager les réponses de
 * l'adversaire. Une rencontre au gardé illisible ne compte pas : elle ne dit
 * pas ce qu'elle affrontait. `scripts/calibrage-duels.ts` la lit telle quelle :
 * il mesure sur une vraie base le journal même que la cote relit.
 */
export function lectureDesDuels(qui: string | readonly string[] | null, maintenant: number): InStatement {
  // Et ses duels contre quelqu'un, joués des deux côtés : chacun sa tentative,
  // celle d'en face, la cote d'en face figée au lancement — datés du second
  // qui a fini, quand le duel s'est joué. Un seul des deux n'en fait pas un.
  // Commencés tous deux, ils comptent aussi à la fermeture, sur les scores
  // atteints : qui joue en second voit le score à battre, et s'arrêter en
  // route, une fois battu, ne doit pas effacer le duel. Jamais commencé, il
  // ne compte pas : personne ne perd de points en dormant. Ceux d'un
  // joueur, de plusieurs à la fois — la salle qui revient —, ou de tous.
  // Avec la montée, la cote cachée d'en face figée avec l'autre, et s'il l'a
  // lancé : qui provoque y gagne un point de plus (`shared/duels.ts`).
  const ids = qui === null ? null : typeof qui === 'string' ? [qui] : qui
  const parmi = ids && (ids.length === 1 ? '= ?' : `IN (${ids.map(() => '?').join(', ')})`)
  return {
    sql: `SELECT id, profile_id, justes, finie_le, ses_justes, cote_adverse, cote_cachee_adverse, lance FROM (
            SELECT id, profile_id, justes, finie_le, (SELECT COUNT(*) FROM json_each(adversaire, '$.reponses') WHERE type = 'true') AS ses_justes,
                   NULL AS cote_adverse, NULL AS cote_cachee_adverse, 0 AS lance
            FROM campagne_series
            WHERE ${parmi ? `profile_id ${parmi} AND ` : ''}mode = 'rencontre' AND finie_le IS NOT NULL AND adversaire IS NOT NULL AND json_valid(adversaire)
            UNION ALL
            SELECT m.id, m.profile_id, m.justes, MAX(COALESCE(m.finie_le, d.ferme_le), COALESCE(o.finie_le, d.ferme_le)) AS finie_le, o.justes AS ses_justes,
                   CASE WHEN m.profile_id = d.auteur THEN d.cote_adversaire ELSE d.cote_auteur END AS cote_adverse,
                   CASE WHEN m.profile_id = d.auteur THEN d.cote_cachee_adversaire ELSE d.cote_cachee_auteur END AS cote_cachee_adverse,
                   CASE WHEN m.profile_id = d.auteur THEN 1 ELSE 0 END AS lance
            FROM campagne_duels d
            JOIN campagne_series m ON m.mode = 'duel' AND m.duel = d.code AND m.profile_id IN (d.auteur, d.adversaire) AND (m.finie_le IS NOT NULL OR d.ferme_le <= ?)
            JOIN campagne_series o ON o.mode = 'duel' AND o.duel = d.code AND o.profile_id IN (d.auteur, d.adversaire) AND o.profile_id <> m.profile_id
                                  AND (o.finie_le IS NOT NULL OR d.ferme_le <= ?)
            WHERE d.adversaire IS NOT NULL${parmi ? ` AND m.profile_id ${parmi}` : ''}
          ) ORDER BY finie_le, id`,
    args: ids ? [...ids, maintenant, maintenant, ...ids] : [maintenant, maintenant],
  }
}

/**
 * Contre qui il a joué chacun de ses duels classés, sous sa série : un profil
 * — celui qu'il a défié ou qui l'a défié, celui dont une rencontre d'avant
 * rejouait la série —, '' pour Automate ; le code d'un duel contre quelqu'un,
 * que sa ligne d'historique rouvre ; s'il n'en a pas vu le résultat. Le
 * journal (`lectureDesDuels`) ne le dit pas : le classement le lit pour tout
 * le monde, sans en avoir besoin.
 */
function lectureDesAdversaires(profileId: string): InStatement {
  return {
    sql: `SELECT id, CASE WHEN json_extract(adversaire, '$.simule') THEN '' ELSE json_extract(adversaire, '$.profil') END AS contre, NULL AS code, 0 AS a_voir
          FROM campagne_series
          WHERE profile_id = ? AND mode = 'rencontre' AND finie_le IS NOT NULL AND adversaire IS NOT NULL AND json_valid(adversaire)
          UNION ALL
          SELECT m.id, CASE WHEN d.auteur = m.profile_id THEN d.adversaire ELSE d.auteur END, d.code, d.auteur = m.profile_id AND d.vu_le IS NULL
          FROM campagne_series m JOIN campagne_duels d ON d.code = m.duel
          WHERE m.profile_id = ? AND m.mode = 'duel' AND d.adversaire IS NOT NULL`,
    args: [profileId, profileId],
  }
}

/** Ses duels du journal, chacun contre qui (`lectureDesAdversaires`) : un duel dont on ne sait pas contre qui ne se raconte pas. */
function duelsRacontes(duels: readonly DuelJoue[], adversaires: readonly Record<string, unknown>[]): DuelRaconte[] {
  const parSerie = new Map(adversaires.map(r => [String(r.id), r]))
  return duels.flatMap((d): DuelRaconte[] => {
    const a = parSerie.get(d.serie)
    if (!a || typeof a.contre !== 'string') return []
    return [
      {
        ...d,
        contre: a.contre,
        ...(typeof a.code === 'string' && { code: a.code }),
        ...(Number(a.a_voir) === 1 && { aVoir: true as const }),
      },
    ]
  })
}

/**
 * Ceux qu'il peut aller chercher (`ClassementDesDuels.aPortee`) : les joueurs
 * classés juste au-dessus de sa cote, le plus proche d'abord — une cote égale
 * n'est pas devant lui (invariant 15) ; classé ou pas, de sa cote à lui. Sans
 * personne au-dessus, ceux qui le suivent : en tête du classement, ceux qui
 * le talonnent (`enTete`). `classes` : du plus haut au plus bas.
 */
function aSaPortee<C extends { item: { profil: ProfileRec; releve: ReleveDesDuels } }>(
  classes: readonly C[],
  pour: string,
  cote: number,
  classe: boolean,
  ligne: (c: C) => LigneDesDuels,
): Pick<ClassementDesDuels, 'aPortee' | 'enTete'> {
  const autres = classes.filter(c => c.item.profil.id !== pour)
  const dessus = autres.filter(c => c.item.releve.cote > cote).slice(-JOUEURS_A_PORTEE).reverse()
  if (dessus.length > 0) return { aPortee: dessus.map(ligne) }
  const dessous = autres.filter(c => c.item.releve.cote < cote).slice(0, JOUEURS_A_PORTEE)
  if (dessous.length === 0) return {}
  return { aPortee: dessous.map(ligne), ...(classe && { enTete: true as const }) }
}

/** Un adversaire qu'on ne nomme plus — masqué, ou parti —, comme ses duels en cours le disent. */
const UN_JOUEUR: QuiAffronte = { nom: 'Un joueur', avatar: '🎲' }

/** Une ligne de son historique, et ce qu'un toucher rouvre : la page d'un duel contre quelqu'un, la correction d'un duel au dé. */
const ligneDHistoire = (d: DuelRaconte & { ecart: number }, contre: QuiAffronte): DuelDeLHistoire => ({
  cle: d.serie,
  contre,
  justes: d.justes,
  sesJustes: d.sesJustes,
  ecart: d.ecart,
  le: d.finiLe,
  ...(d.code ? { code: d.code } : { serie: d.serie }),
})

/**
 * Ses duels contre quelqu'un des trente derniers jours, chacun ce qui le
 * range : une table de travail (`WITH siens`) que l'accueil et la page lisent
 * d'une même règle. `ouvert` ; `joue`, joué des deux côtés — chacun sa
 * tentative finie, ou commencée et le duel fermé : ce qui compte
 * (`lectureDesDuels`) ; `a_voir`, lancé par lui et son résultat pas encore vu
 * (`vu_le`). Un duel qu'on lui a lancé n'est à lui qu'une fois parti
 * (`campagne_envois`) : avant, il ne prend la place de rien.
 */
function sesDuelsContre(profileId: string, maintenant: number): { sql: string; args: (string | number)[] } {
  return {
    sql: `WITH siens AS (
            SELECT d.code, d.cree_le, d.ferme_le > ? AS ouvert, d.auteur = ? AND d.vu_le IS NULL AS a_voir,
                   (SELECT COUNT(DISTINCT s.profile_id) FROM campagne_series s
                     WHERE s.mode = 'duel' AND s.duel = d.code AND s.profile_id IN (d.auteur, d.adversaire)
                       AND (s.finie_le IS NOT NULL OR d.ferme_le <= ?)) = 2 AS joue
            FROM campagne_duels d
            WHERE d.adversaire IS NOT NULL AND (d.auteur = ? OR d.adversaire = ?) AND d.cree_le > ?
              AND (d.auteur = ? OR EXISTS (SELECT 1 FROM campagne_envois e WHERE e.code = d.code AND e.profile_id = ?))
          )`,
    args: [maintenant, profileId, maintenant, profileId, profileId, maintenant - 30 * 24 * HEURE_MS, profileId, profileId],
  }
}

/**
 * Ses résultats à voir, parmi `siens`, les plus récents d'abord : ceux que
 * l'accueil compte sont ceux que la page montre — départagés par leur code,
 * pour que deux duels de la même milliseconde ne tombent pas chacun d'un côté
 * de la limite.
 */
const RESULTATS_A_VOIR = 'SELECT code FROM siens WHERE joue AND a_voir ORDER BY cree_le DESC, code LIMIT ?'

/**
 * Ses duels contre quelqu'un, d'un lot (`duelsContre`) : les duels — sans
 * leurs questions, que la page ne montre pas —, leurs tentatives, et ceux qui
 * lui sont partis. Tous ceux qui sont en route, à jouer ou chez l'autre ; ses
 * résultats à voir, comme l'accueil les compte ; puis les plus récents des
 * autres, joués ou fermés, pour l'historique. Elle ne lisait que ses dix
 * derniers duels lancés ou reçus : un duel plus ancien qui attendait encore
 * en sortait, et l'accueil le comptait toujours en rouge — introuvable (le
 * retour du propriétaire du 13 octobre 2026 : « j'ai deux notifications mais
 * je les vois pas dans "En cours" ni dans l'historique »).
 */
function lecturesDesDuelsContre(profileId: string, maintenant: number): InStatement[] {
  const siens = sesDuelsContre(profileId, maintenant)
  const montres = `${siens.sql}, montres AS (
      SELECT code FROM siens WHERE ouvert AND NOT joue
      UNION SELECT code FROM (${RESULTATS_A_VOIR})
      UNION SELECT code FROM (SELECT code FROM siens WHERE NOT (ouvert AND NOT joue) AND NOT (joue AND a_voir) ORDER BY cree_le DESC LIMIT ?)
    )`
  const args = [...siens.args, DUELS_MONTRES, DUELS_MONTRES]
  return [
    { sql: `${montres} SELECT code, auteur, adversaire, categories, sujet, ferme_le, vu_le FROM campagne_duels WHERE code IN (SELECT code FROM montres) ORDER BY cree_le DESC`, args },
    { sql: `${montres} SELECT id, duel, profile_id, justes, finie_le FROM campagne_series WHERE mode = 'duel' AND duel IN (SELECT code FROM montres)`, args },
    { sql: `${montres} SELECT code FROM campagne_envois WHERE profile_id = ? AND code IN (SELECT code FROM montres)`, args: [...args, profileId] },
  ]
}

/** Un duel contre quelqu'un, tel que `lecturesDesDuelsContre` le lit : ce que sa ligne dit de lui. */
const duelContreLu = (r: Record<string, unknown>): Pick<Duel, 'code' | 'auteur' | 'categories' | 'sujet' | 'fermeLe' | 'vuLe'> & { adversaire: string } => ({
  code: String(r.code),
  auteur: String(r.auteur),
  adversaire: typeof r.adversaire === 'string' ? r.adversaire : '',
  categories: lireCategories(r.categories),
  sujet: typeof r.sujet === 'string' ? r.sujet : null,
  fermeLe: Number(r.ferme_le),
  vuLe: r.vu_le === null || r.vu_le === undefined ? null : Number(r.vu_le),
})

/** Des lignes de `lectureDesDuels` aux duels qu'elles racontent. */
export const duelsLus = (lignes: readonly Record<string, unknown>[]): DuelJoue[] =>
  lignes.map(r => ({
    serie: String(r.id),
    justes: Number(r.justes),
    sesJustes: Number(r.ses_justes),
    finiLe: Number(r.finie_le),
    ...(r.cote_adverse !== null && r.cote_adverse !== undefined && { coteAdverse: Number(r.cote_adverse) }),
    ...(r.cote_cachee_adverse !== null && r.cote_cachee_adverse !== undefined && { coteCacheeAdverse: Number(r.cote_cachee_adverse) }),
    ...(Number(r.lance) === 1 && { lance: true as const }),
  }))

/** La semaine de Paris d'un instant : la clé sous laquelle ses duels se comptent. */
const semaineDeLInstant = (instant: number) => semaineDe(jourDe(instant))

/**
 * Tout ce que sa ligne d'expérience compte : ses bonnes réponses, heure par
 * heure, et les paliers des sentiers qu'il a validés en jouant — une fois
 * chacun (`xpDuPalier`). Lues ensemble, au bout du lot qui écrit une bonne
 * réponse : la ligne se réécrit toujours en entier, et une ligne sans ses
 * paliers les aurait repris.
 */
function lecturesDeLExperience(profileId: string): InStatement[] {
  return [
    lectureDesJustes(profileId),
    {
      sql: `SELECT DISTINCT branche, palier FROM campagne_series WHERE profile_id = ? AND mode = 'sentier' AND issue = 'validee'`,
      args: [profileId],
    },
  ]
}

/** Sa ligne d'expérience de campagne, de ce que `lecturesDeLExperience` a lu. */
function experienceLue([justes, paliers]: readonly ResultSet[]): { parJour: Map<string, number>; xp: number } {
  const parJour = justesParJourDe(justes.rows)
  const xp = xpDeCampagne(parJour.values()) + paliers.rows.reduce((n, r) => n + xpDuPalier(Number(r.palier)), 0)
  return { parJour, xp }
}

/** Des heures aux jours de Paris : il change de jour à une heure pile, hiver comme été — une heure n'est jamais à cheval sur deux jours. */
function justesParJourDe(lignes: readonly Record<string, unknown>[]): Map<string, number> {
  const parJour = new Map<string, number>()
  for (const r of lignes) {
    const jour = jourDe(Number(r.heure) * HEURE_MS)
    parJour.set(jour, (parJour.get(jour) ?? 0) + Number(r.n))
  }
  return parJour
}

/**
 * La version des règles de la campagne que la relecture a appliquées aux
 * séries passées (`relireLesSeries`) : 1 depuis ses hauts faits et ses
 * paliers (le 5 octobre 2026). Une règle de plus la fait monter.
 */
const VERSION_DES_SERIES = 1

/**
 * La version des règles des épreuves que la relecture a appliquées aux
 * épreuves passées (`relireLesEpreuves`) : 1 depuis les trophées des
 * sentiers (le 15 octobre 2026). Une règle de plus la fait monter.
 */
const VERSION_DES_EPREUVES = 1

/** Le Funambule : autant de bonnes réponses d'affilée sur sa dernière vie. */
export const FUNAMBULE = 9
/** La Grande Série : autant de bonnes réponses dans une série de toutes les catégories. */
export const GRANDE_SERIE = 30
/**
 * Sans une égratignure : les expertes doivent venir après les trois marches
 * complètes — quinze questions. Une catégorie jouée seule, qui n'a pas cinq
 * questions de chaque marche, les sert plus tôt : ce n'est pas le même
 * exploit.
 */
const AVANT_LES_EXPERTES = 3 * QUESTIONS_PAR_MARCHE

/** Les catégories qu'une série retient en base : aucune ou toutes, c'est NULL — toutes. */
function categoriesRetenues(categories?: readonly string[]): string | null {
  const choisies = [...new Set(categories ?? [])].filter(c => (CATEGORIES as readonly string[]).includes(c))
  return choisies.length === 0 || choisies.length >= CATEGORIES.length ? null : JSON.stringify(choisies)
}

/**
 * Les hauts faits d'une série finie, lus sur ses réponses dans l'ordre :
 * dérivation pure, comme ceux d'une soirée. Le Funambule compte les bonnes
 * réponses d'affilée après la deuxième erreur ; Sans une égratignure, que
 * tout était juste jusqu'à la première experte ; la Grande Série, une série
 * de toutes les catégories (`categories` NULL) — pas celle d'un sujet, qui
 * les traverse sans les poser toutes.
 */
export function hautsFaitsDeLaSerie(
  s: { questions: readonly { niveau: Niveau }[]; justes: number; categories?: readonly string[] | null; sujet?: string | null },
  justes: readonly boolean[],
): string[] {
  const cles: string[] = []
  let erreurs = 0
  let derniereVie = 0
  let meilleure = 0
  for (const j of justes) {
    if (!j) {
      erreurs++
      derniereVie = 0
    } else if (erreurs === VIES - 1) {
      derniereVie++
      meilleure = Math.max(meilleure, derniereVie)
    }
  }
  if (meilleure >= FUNAMBULE) cles.push('hf:funambule')
  const experte = s.questions.findIndex(q => q.niveau === 'expert')
  if (experte >= AVANT_LES_EXPERTES && justes.length > experte - 1 && justes.slice(0, experte).every(Boolean)) cles.push('hf:intact')
  if (s.justes >= GRANDE_SERIE && !s.categories && !s.sujet) cles.push('hf:grande-serie')
  return cles
}

/**
 * Les hauts faits d'une épreuve finie, lus sur elle : L'Impeccable — seize
 * sur seize, dès le palier où le vrai ou faux s'arrête — et Contre toute
 * attente — validée quand la chance gardée à son départ l'annonçait en piste
 * noire, sans un échec avant elle sur ce palier (`echecs`). Une épreuve en
 * jeu seulement : un rejeu se rejoue à volonté, sans rien risquer.
 * Dérivation pure, comme ceux d'une série : la fin d'une épreuve et la
 * relecture la lisent pareil.
 */
export function hautsFaitsDeLEpreuve(
  e: { palier: number; rejeu: boolean; issue: IssueDEpreuve | null; chance?: number | null },
  justes: number,
  echecs: number,
): string[] {
  if (e.rejeu || e.issue !== 'validee') return []
  const cles: string[] = []
  if (justes >= QUESTIONS_PAR_EPREUVE && e.palier >= SANS_VRAI_FAUX_DES) cles.push('hf:impeccable')
  if (echecs === 0 && e.chance !== null && e.chance !== undefined && couleurDePiste(e.chance) === 'noire') cles.push('hf:contre-toute-attente')
  return cles
}

/** La fin d'une série et l'Éclat de son défi, en une annonce : ce qui est tombé à la suite, chaque légendaire une fois. */
function ensemble(serie: Recompenses, defi: RecompensesDuDefi): RecompensesDuDefi {
  const recompenses = [...(serie.recompenses ?? []), ...(defi.recompenses ?? [])]
  const legendaires = [...new Set([...(serie.legendaires ?? []), ...(defi.legendaires ?? [])])]
  return {
    ...(recompenses.length > 0 && { recompenses }),
    ...(legendaires.length > 0 && { legendaires }),
    ...(defi.eclat && { eclat: defi.eclat }),
  }
}

/** Ce qu'une fin annonce d'une clé tombée : son emoji et son titre — « L'Alpiniste · Argent » pour un palier. */
function tombee(cle: string): PalierTombe {
  const p = palierDe(cle)
  const h = hautFait(cle)
  return { key: cle, emoji: p ? p.hautFait.emoji : (h?.emoji ?? '✨'), title: p ? titreDePalier(p.hautFait, p.palier) : (h?.title ?? cle) }
}

/** Un mélange réglé, tel que `sentier_melanges` le garde ; null s'il ne se lit pas. */
function lireMelange(brut: unknown): Melange | null {
  if (typeof brut !== 'string') return null
  try {
    const lu: unknown = JSON.parse(brut)
    return lu && typeof lu === 'object' && !Array.isArray(lu) ? (lu as Melange) : null
  } catch {
    return null
  }
}

/** Les vainqueurs d'un défi clos, tels que la clôture les a écrits. */
function lireVainqueurs(brut: unknown): string[] {
  if (typeof brut !== 'string') return []
  try {
    const lu: unknown = JSON.parse(brut)
    return Array.isArray(lu) ? lu.map(String) : []
  } catch {
    return []
  }
}

function versSerie(r: Record<string, unknown>): Serie {
  const questions = (JSON.parse(String(r.questions)) as (QuestionDeSerie & { reserveId?: string })[]).map(({ reserveId, ...q }) => ({ ...q, id: q.id ?? reserveId ?? '' }))
  return {
    id: String(r.id),
    profileId: String(r.profile_id),
    questions,
    index: Number(r.position),
    vies: Number(r.vies),
    justes: Number(r.justes),
    finieLe: r.finie_le === null || r.finie_le === undefined ? null : Number(r.finie_le),
    // Un mode inconnu se lit en série — une ligne d'avant les modes n'en a pas ; l'expédition garde le sien, ou une série l'accepterait.
    mode:
      r.mode === 'sentier' || r.mode === 'defi' || r.mode === 'duel' || r.mode === 'revision' || r.mode === 'rencontre' || r.mode === 'sujet' || r.mode === 'expedition'
        ? r.mode
        : 'serie',
    branche: brancheParCle(r.branche)?.key ?? null,
    palier: r.palier === null || r.palier === undefined ? null : Number(r.palier),
    seuil: r.seuil === null || r.seuil === undefined ? null : Number(r.seuil),
    rejeu: Number(r.rejeu ?? 0) === 1,
    issue: r.issue === 'validee' || r.issue === 'ratee' ? r.issue : null,
    chance: r.chance === null || r.chance === undefined ? null : Number(r.chance),
    categories: lireCategories(r.categories),
    sujet: typeof r.sujet === 'string' ? r.sujet : null,
    semaine: typeof r.semaine === 'string' ? r.semaine : null,
    duel: typeof r.duel === 'string' ? r.duel : null,
    adversaire: lireAdversaire(r.adversaire),
    expedition: lireDepartDExpedition(r.expedition),
  }
}

/** Le départ qu'une expédition a gardé ; null : pas une expédition, ou illisible. */
function lireDepartDExpedition(brut: unknown): DepartDExpedition | null {
  if (typeof brut !== 'string') return null
  try {
    const lu = JSON.parse(brut) as DepartDExpedition
    return lu && lu.v === 1 && Array.isArray(lu.cartes) && Array.isArray(lu.gardiens) ? lu : null
  } catch {
    return null
  }
}

/** Un geste du journal d'une expédition, tel que la page l'envoie ; null s'il ne se lit pas. L'abandon a sa route. */
function lireGeste(brut: unknown): GesteDExpedition | null {
  if (!brut || typeof brut !== 'object') return null
  const g = brut as Record<string, unknown>
  if (g.quoi === 'avancer' && typeof g.vers === 'string' && g.vers.length <= 8) return { quoi: 'avancer', vers: g.vers }
  if (g.quoi === 'garder' && typeof g.legendaire === 'string' && g.legendaire.length <= 40) return { quoi: 'garder', legendaire: g.legendaire }
  return null
}

/** Un geste tel que le journal le garde, abandon compris ; null s'il ne se lit plus. */
function gesteGarde(brut: unknown): GesteDExpedition | null {
  try {
    const lu: unknown = JSON.parse(String(brut))
    return lu && typeof lu === 'object' && (lu as { quoi?: unknown }).quoi === 'abandonner' ? { quoi: 'abandonner' } : lireGeste(lu)
  } catch {
    return null
  }
}

/** Une expédition lue : sa partie, son départ, ses gestes dans l'ordre, ses réponses par rang de question. */
interface ExpeditionLue {
  serie: Serie
  depart: DepartDExpedition
  gestes: GesteDExpedition[]
  reponses: Map<number, boolean>
}

function expeditionLue(ligne: Record<string, unknown> | undefined, gestes: readonly Record<string, unknown>[], reponses: readonly Record<string, unknown>[]): ExpeditionLue | null {
  if (!ligne) return null
  const serie = versSerie(ligne)
  if (serie.mode !== 'expedition' || !serie.expedition) return null
  return {
    serie,
    depart: serie.expedition,
    gestes: gestes.map(r => gesteGarde(r.geste)).filter((g): g is GesteDExpedition => g !== null),
    reponses: new Map(reponses.map(r => [Number(r.position), Number(r.juste) === 1])),
  }
}

/** Où chaque question a été tirée : ce que le pli range. */
const questionsPosees = (questions: readonly QuestionDeSerie[]) => questions.map(q => ({ escale: q.escale ?? '', acte: q.acte ?? 0 }))

/** L'état d'une expédition lue (`pliDeLExpedition`). */
const plier = (l: ExpeditionLue) => pliDeLExpedition(l.depart, l.gestes, questionsPosees(l.serie.questions), l.reponses)

/**
 * Ce que la page reçoit d'une expédition : la carte de l'acte en cours —
 * ses escales, leurs thèmes et la chance qu'il a sur chacune, publiques —,
 * où il en est, et la question qui attend, sans sa bonne réponse ni son
 * anecdote (invariant 1). `possedes` : ses légendaires, pour marquer les
 * gardiens déjà à lui.
 */
function vueDeLExpedition(l: ExpeditionLue, e: EtatDeLExpedition, possedes: ReadonlySet<string>): VueDeLExpedition {
  const q = e.enAttente === null ? undefined : l.serie.questions[e.enAttente]
  return {
    id: l.serie.id,
    numero: l.depart.numero,
    acte: e.acte,
    gardiens: l.depart.gardiens.map((cle, i) => ({ cle, vaincu: i < e.vaincus, ...(possedes.has(cle) && { aLui: true as const }) })),
    carte: e.acte < ACTES ? (l.depart.cartes[e.acte] ?? null) : null,
    ici: e.ici,
    trace: e.trace,
    permises: escalesPermises(l.depart, e),
    vies: e.vies,
    justes: e.justes,
    ...(q && e.enAttente !== null && { question: { ...questionMontree(q, e.enAttente), escale: q.escale ?? '' } }),
    ...(e.gardien && { gardien: { trouvees: e.gardien.trouvees, aTrouver: MARCHES_DES_ACTES[e.acte].aTrouver } }),
    issue: e.issue,
    ...(e.garde && { garde: e.garde }),
    moyen: l.depart.moyen,
    rang: l.gestes.length,
  }
}

/** L'adversaire qu'une rencontre a gardé ; null : pas une rencontre, ou illisible. */
function lireAdversaire(brut: unknown): AdversaireGarde | null {
  if (typeof brut !== 'string') return null
  try {
    const lu = JSON.parse(brut) as Record<string, unknown>
    if (typeof lu.serie !== 'string' || typeof lu.profil !== 'string' || !Array.isArray(lu.reponses)) return null
    return { serie: lu.serie, profil: lu.profil, reponses: lu.reponses.map(x => x === true), ...(lu.simule === true && { simule: true as const }) }
  } catch {
    return null
  }
}

/** Les bonnes réponses de l'adversaire sur les questions qu'une rencontre a déjà jouées : le score d'en face, à la reprise. */
function sesJustesAvant(s: Serie): number {
  return s.adversaire ? s.adversaire.reponses.slice(0, s.index).filter(Boolean).length : 0
}

/** Son score entier : celui à battre, qui fait la cote d'en face sur la cachée (`coteDuScore`) — sur celle qu'on voit, le dé se joue à chances égales. */
const sesJustesEnTout = (a: AdversaireGarde): number => a.reponses.filter(Boolean).length

/** Un défi envoyé (`e`, sur son duel `d`) qui est bien à lui : un défi entre amis, ou le duel classé qui le défie. */
const DEFI_A_LUI = '(d.adversaire IS NULL OR d.adversaire = e.profile_id)'

/** Pourquoi un second duel classé contre le même ne se lance pas : où en est le premier (`duelOuvertEntre`), et quoi faire. */
const REFUS_D_UN_SECOND_DUEL: Record<OuEnEstLeDuel, (nom: string) => string> = {
  'a-finir': nom => `Tu as déjà un duel en cours contre ${nom} : finis-le, il partira à ta dernière réponse`,
  'chez-l-autre': nom => `Tu as déjà un duel en cours contre ${nom} : il attend d’être joué`,
  'a-relever': nom => `${nom} t’a déjà défié : relève son duel d’abord, en tête de tes duels`,
  'a-venir': nom => `${nom} t’a déjà défié : son duel t’arrivera à sa dernière réponse`,
  retenu: nom => `${nom} t’a déjà défié : remets ce profil dans tes amis pour recevoir son duel`,
}

/**
 * Les défis que ses amis lui ont envoyés et qu'il n'a pas relevés, les plus
 * récents d'abord : ni ceux d'un ami qu'il a retiré, ni ceux qui ont fermé.
 * Un duel classé n'est qu'à qui il défie (`DEFI_A_LUI`) : envoyé à un autre
 * par la porte des défis entre amis, il se comptait ici sans paraître nulle
 * part — personne d'autre ne peut le jouer.
 */
function lectureDesDefisRecus(profileId: string, maintenant: number): InStatement {
  return {
    sql: `SELECT d.auteur FROM campagne_envois e JOIN campagne_duels d ON d.code = e.code
          WHERE e.profile_id = ? AND d.ferme_le > ? AND ${DEFI_A_LUI}
            AND NOT EXISTS (SELECT 1 FROM campagne_series s WHERE s.profile_id = e.profile_id AND s.mode = 'duel' AND s.duel = e.code)
            AND NOT EXISTS (SELECT 1 FROM campagne_amis_retires r WHERE r.profile_id = e.profile_id AND r.ami = d.auteur)
          ORDER BY e.envoye_le DESC LIMIT ?`,
    args: [profileId, maintenant, DEFIS_RECUS_MONTRES],
  }
}

/**
 * Ce qu'une réponse de rencontre dit de l'adversaire sur la même question, et
 * les deux scores — finie, son issue contre son score entier, et ce score,
 * enfin : il ne part pas avant (`AdversaireEnJeu`).
 */
function coupDeLaRencontre(a: AdversaireGarde, index: number, toi: number, finie: boolean): CoupDeLaRencontre {
  const total = a.reponses.filter(Boolean).length
  return {
    lui: index < a.reponses.length ? a.reponses[index] : null,
    toi,
    sesJustes: a.reponses.slice(0, index + 1).filter(Boolean).length,
    ...(finie && { issue: issueDeRencontre(toi, total), enTout: total }),
  }
}

/** L'adversaire d'une rencontre qui se joue : son prénom, son avatar, ce qu'il porte — son score entier attend la dernière réponse. */
const enJeu = ({ justes, ...lui }: Adversaire): AdversaireEnJeu => lui

// ── Automate, l'adversaire simulé ────────────────────────────────────────
//
// Le dé ne joue que contre lui (le 13 octobre 2026). Il rejouait d'abord la
// série finie d'un autre joueur — son prénom, son avatar —, et disparaissait
// sur un serveur de quelques amis, qui les avaient vite toutes affrontées :
// Automate le relayait (le dé « tout le temps disponible »), puis l'a
// remplacé — la série d'un ami qui n'était pas là, sous son profil, « c'est
// trompeur » (le propriétaire, le même jour). Une série neuve, présentée
// comme simulée.
//
// Il joue comme qui lance le dé, tel que le modèle du savoir le mesure
// (`core/modeleDuSavoir.ts`, le choix du propriétaire du même soir, après
// « est-ce que l'automate pourrait apprendre du niveau des personnes et
// s'adapter en continu ? ») : ses écarts de catégorie sont les siens — il
// rate où il rate —, à la force de son niveau. Pendant le placement, ce
// niveau est ce que toutes ses réponses de campagne disent de lui, relues à
// chaque dé ; ensuite, celui de sa cote (`niveauPourLeDuel`), qui a appris
// de ses duels. Il vaut sur une série tirée pour lui, en moyenne
// (`serieDeReference`) : sur celle qu'on lui tire, plus dure pour lui — ses
// catégories faibles, des questions que les réponses ont dites plus
// dures —, Automate fait moins bien lui aussi. Avant, ses chances se
// décalaient pour que son score attendu soit ce niveau sur chaque série,
// quelles qu'en soient les questions : une série tombée sur les points
// faibles de qui jouait le désavantageait d'autant. L'effet reste modeste
// tant que la base est si grande : le dé fait tourner les douze catégories,
// et une question n'a presque jamais assez de réponses pour qu'on la sache
// plus dure que son estimation d'écriture (`scripts/calibrage-automate.ts`).
// Son score se tient à deux bonnes réponses de ce qu'on attend de lui sur
// cette série (`ECART_D_AUTOMATE`), et sa série finit à sa troisième faute,
// comme celle d'un joueur allé au bout de ses vies : la cote cachée lit son
// score pareil (`coteDuScore`). Celle qu'on voit le compte, depuis le
// 16 octobre 2026, comme un adversaire de sa cote (`forceQuOnVoit`). Son nom
// et son avatar vivent dans `shared/duels.ts` (`AUTOMATE`) : la feuille du dé
// les montre avant qu'il ait rien tiré.

/**
 * Ce que le dé demande à Automate (`CampagneStore.reponsesDAutomate`) : ses
 * chances question par question, le score qu'on attend de lui sur cette
 * série, et le niveau qu'il vise — son score moyen sur une série tirée pour
 * qui le joue.
 */
export interface AutomateDuDe {
  chances: number[]
  cible: number
  niveau: number
}

/**
 * L'écart le plus grand entre le score d'Automate et ce qu'on attend de lui
 * sur la série : deux bonnes réponses — un choix de produit, celui du
 * propriétaire du 13 octobre 2026, après « parfois la différence était
 * énorme ». Libre, son score s'en écartait de quatre ou plus un duel sur
 * cinq — de cinq à onze au niveau huit, huit fois sur dix — : des défaites de
 * dix réponses, des victoires sans partie, un enjeu de « +7 / −17 » à
 * « +17 / −7 ». À une seule, tous les duels se ressembleraient, et l'enjeu
 * trahirait son score. Depuis le modèle du savoir, ce qu'on attend de lui
 * suit la série : son score peut s'écarter un peu plus du niveau de la cote,
 * quand la série est plus dure ou plus facile pour qui la joue.
 */
export const ECART_D_AUTOMATE = 2

/** Les parties d'Automate qu'on tire au plus pour tomber dans cet écart : plus d'une sur deux y tombe. */
const PARTIES_D_AUTOMATE = 50

/** Automate tel que la page le montre : son nom, son avatar, et qu'il est simulé. */
const automateVu = (a: AdversaireGarde): Adversaire => ({ ...AUTOMATE, simule: true, justes: a.reponses.filter(Boolean).length })

/** Une partie, ses chances données : juste ou faux, question par question, jusqu'à la troisième faute, ou au bout des questions. */
export function jouerSesChances(chances: readonly number[], hasard: () => number = Math.random): boolean[] {
  const reponses: boolean[] = []
  let fautes = 0
  for (const chance of chances) {
    const juste = hasard() < chance
    reponses.push(juste)
    if (!juste && ++fautes >= VIES) break
  }
  return reponses
}

/**
 * La partie d'Automate, son score tenu à `ECART_D_AUTOMATE` de `cible` — ce
 * qu'on attend de lui sur cette série : elle se retire tant qu'elle tombe
 * plus loin. Sa façon de jouer ne change pas, il rate toujours d'abord ce
 * qui est difficile pour lui. Au bout de `PARTIES_D_AUTOMATE`, la plus
 * proche : un score qu'une série ne laisse pas atteindre ne bloque rien.
 */
export function partieDAutomate(chances: readonly number[], cible: number, hasard: () => number = Math.random): boolean[] {
  const ecart = (r: readonly boolean[]) => Math.abs(r.filter(Boolean).length - cible)
  let meilleure = jouerSesChances(chances, hasard)
  for (let i = 1; i < PARTIES_D_AUTOMATE && ecart(meilleure) > ECART_D_AUTOMATE; i++) {
    const autre = jouerSesChances(chances, hasard)
    if (ecart(autre) < ecart(meilleure)) meilleure = autre
  }
  return meilleure
}

/** Un code de défi entre amis, à recopier sans se tromper (`LETTRES_D_UN_CODE`). */
function nouveauCode(): string {
  return Array.from(randomBytes(LONGUEUR_D_UN_CODE), o => LETTRES_D_UN_CODE[o % LETTRES_D_UN_CODE.length]).join('')
}

/** Ce que la lecture des sujets en fond passe d'une traite avant de rendre la main (`preparerEnFond`) : une à deux millisecondes. */
const SUJETS_PAR_TRANCHE = 1000

/**
 * Les sujets d'une question de la base, lus une fois : la page de la
 * campagne les compte à chaque ouverture, vingt-quatre mille questions et
 * vingt-sept sujets — au dixième de cœur de l'hébergeur, recompté à chaque
 * fois, la page attendait. Lus en fond après le démarrage
 * (`preparerEnFond`).
 */
const SUJETS_LUS = new WeakMap<QuestionDeLaBase, readonly string[]>()
export function sujetsDeLaQuestion(q: QuestionDeLaBase): readonly string[] {
  let lus = SUJETS_LUS.get(q)
  if (!lus) SUJETS_LUS.set(q, (lus = sujetsDe(q.meta)))
  return lus
}

/**
 * Ce qu'un joueur porte, sur une ligne d'ami, de recherche ou de défi reçu,
 * comme au classement (`SonApparence`) : l'emoji seul lui donnait deux
 * visages sur la même page.
 */
function sonApparence(p: Pick<ProfileStore, 'apparenceDe'>, x: ProfileRec, releve?: ReleveDesDuels): SonApparence {
  const { finition, eclat, legendaire } = p.apparenceDe(x)
  // Sa bordure de ligue, quand ses duels sont lus avec lui — jamais sous un
  // Divin, qui a sa propre lumière.
  const bordure = legendaire && divin(legendaire) ? null : bordurePortee(x.bordure, releve?.bordures)
  // Mat, c'est l'avatar sans rien autour : sa ligne n'a rien de plus à dire.
  return { ...(finition !== 'mat' && { finition }), ...(legendaire && { legendaire }), ...(eclat && { eclat: true as const }), ...(bordure && { bordure }) }
}

/** Les amis qu'une page désigne : des identifiants, pas plus qu'elle n'en montre — le reste ne désigne personne. */
function idsVoulus(brut: unknown): Set<string> {
  return new Set(Array.isArray(brut) ? brut.filter((a): a is string => typeof a === 'string').slice(0, AMIS_MONTRES) : [])
}

/** Les catégories retenues d'une série : null — toutes, ou une série d'avant la colonne. */
function lireCategories(brut: unknown): string[] | null {
  if (typeof brut !== 'string') return null
  try {
    const lu: unknown = JSON.parse(brut)
    return Array.isArray(lu) ? lu.map(String) : null
  } catch {
    return null
  }
}

/**
 * Une question de la base, telle que la série la garde : ses réponses
 * mélangées pour cette série-ci — on ne retient pas une place —, sauf
 * « Vrai » et « Faux », qui restent dans cet ordre.
 */
function versQuestionDeSerie(q: QuestionDeLaBase, niveau: Niveau): QuestionDeSerie {
  const ordre = q.reponses.length === 2 ? [0, 1] : melanger(q.reponses.map((_, i) => i))
  return {
    id: q.id,
    texte: q.texte,
    reponses: ordre.map(i => q.reponses[i]),
    bonne: ordre.indexOf(q.bonne),
    categorie: q.meta.categorie,
    anecdote: q.anecdote,
    niveau,
    sousTheme: q.meta.sousTheme,
  }
}

/** Ce que le téléphone reçoit d'une question : jamais la bonne réponse ni l'anecdote avant la sienne. */
function questionMontree(q: QuestionDeSerie, index: number): QuestionDeCampagne {
  return { index, texte: q.texte, reponses: q.reponses, categorie: q.categorie, niveau: q.niveau, ...(q.sousTheme && { sousTheme: q.sousTheme }) }
}

function vueDeSerie(s: Serie): SerieDeCampagne {
  const finie = s.finieLe !== null
  // Une révision dit aussi ce qu'elle vise : sa fin propose d'en revoir encore, sur le même choix.
  const choisie = s.mode === 'serie' || s.mode === 'duel' || s.mode === 'rencontre' || s.mode === 'revision'
  return {
    id: s.id,
    vies: s.vies,
    justes: s.justes,
    total: s.questions.length,
    finie,
    ...(!finie && s.questions[s.index] && { question: questionMontree(s.questions[s.index], s.index) }),
    ...(choisie && s.categories && s.categories.length > 0 && { categories: s.categories }),
    ...(choisie && s.sujet && { sujet: s.sujet }),
  }
}

/** La marche la plus haute parmi des questions jouées : « jusqu'au niveau difficile ». */
function plusHaute(questions: readonly QuestionDeSerie[]): Niveau {
  return NIVEAUX[Math.max(0, ...questions.map(q => NIVEAUX.indexOf(q.niveau)))]
}

/** Les catégories et leur nombre de questions, dans l'ordre fixe de la liste (`shared/categories.ts`). */
function parCategorie(questions: readonly QuestionDeLaBase[]): { categorie: string; questions: number }[] {
  const compte = new Map<string, number>()
  for (const q of questions) compte.set(q.meta.categorie, (compte.get(q.meta.categorie) ?? 0) + 1)
  return CATEGORIES.filter(c => compte.has(c)).map(c => ({ categorie: c, questions: compte.get(c)! }))
}

/** Une entrée de la base rangée dans Turso — un dépôt de la routine, une correction —, relue par le juge du jour. */
function relireUneEntree(brut: unknown): { question: QuestionDeLaBase } | { refus: string } {
  try {
    return lireQuestionDeLaBase(JSON.parse(String(brut)))
  } catch {
    return { refus: 'JSON illisible' }
  }
}

/**
 * Les corrections de l'administrateur, sur la base du dépôt et de la
 * routine : les remplaçantes d'abord — une question neuve, sous son propre
 * identifiant —, puis les corrections sur place, qui prennent la place de la
 * version d'avant. Une remplaçante se corrige donc comme les autres. Une
 * correction sur place dont la question a quitté la base ne la fait pas
 * revenir.
 */
function appliquerLesCorrections(
  questions: readonly QuestionDeLaBase[],
  corrections: ReadonlyMap<string, { question: QuestionDeLaBase }>,
): QuestionDeLaBase[] {
  const parId = new Map(questions.map(q => [q.id, q]))
  for (const [ancienne, c] of corrections) if (c.question.id !== ancienne && !parId.has(c.question.id)) parId.set(c.question.id, c.question)
  for (const [id, c] of corrections) if (c.question.id === id && parId.has(id)) parId.set(id, c.question)
  return [...parId.values()]
}

/**
 * Les leurres d'une question corrigée. Ses mauvaises réponses d'abord : le
 * juge les y veut toutes, et n'en garde que huit. Puis ceux d'avant qu'on
 * ne montrait pas. Une réponse que la correction a ôtée n'en est plus un :
 * on l'ôte parce qu'elle trompait mal — juste, elle aussi, ou ambiguë. La
 * bonne réponse n'en est jamais un.
 */
export function leurresApres(avant: QuestionDeLaBase, apres: CorrectionDeQuestion): string[] {
  const juste = sansAccent(apres.reponses[apres.bonne] ?? '')
  const restent = new Set(apres.reponses.map(sansAccent))
  const otees = new Set(avant.reponses.map(sansAccent).filter(r => !restent.has(r)))
  const vus = new Set<string>()
  const leurres: string[] = []
  for (const l of [...apres.reponses.filter((_, i) => i !== apres.bonne), ...avant.meta.leurres]) {
    const cle = sansAccent(l)
    if (cle === juste || otees.has(cle) || vus.has(cle)) continue
    vus.add(cle)
    leurres.push(l)
  }
  return leurres
}

/**
 * Un signalement, tel que l'administration le lit : sa ligne, sa série et
 * sa réponse jointes (`signalements`). La version qu'il a jouée — réponses
 * dans l'ordre de sa série — dit ce qu'il a répondu, et si la base a changé
 * depuis : corrigée ici, ou dans son fichier.
 */
function rapportDe(r: Record<string, unknown>, q: QuestionDeLaBase): RapportDeSignalement {
  const vue = lireLaVersionJouee(r.vue)
  const choix = r.choix === null || r.choix === undefined ? null : Number(r.choix)
  const ou = r.mode === 'sentier' || r.mode === 'defi' || r.mode === 'duel' || r.mode === 'revision' || r.mode === 'rencontre' || r.mode === 'sujet' || r.mode === 'expedition' ? r.mode : 'serie'
  return {
    profileId: String(r.profile_id),
    prenom: null,
    login: null,
    texte: String(r.texte),
    le: Number(r.cree_le),
    traiteLe: r.traite_le === null || r.traite_le === undefined ? null : Number(r.traite_le),
    issue: lireIssue(r.issue),
    ou,
    ...(ou === 'sentier' && typeof r.branche === 'string' && { branche: r.branche }),
    ...(ou === 'sentier' && r.palier !== null && r.palier !== undefined && { palier: Number(r.palier) }),
    reponse: vue && choix !== null ? (vue.reponses[choix] ?? null) : null,
    juste: r.juste === null || r.juste === undefined ? null : Number(r.juste) === 1,
    ...(vue && !memeVersion(vue, q) && { versionDAvant: true as const }),
  }
}

/** La question telle qu'une série l'a gardée (`QuestionDeSerie`) : ce qu'il en faut pour lire une réponse. Null : illisible. */
function lireLaVersionJouee(brut: unknown): { texte: string; reponses: string[]; bonne: number; anecdote: string | null } | null {
  if (typeof brut !== 'string') return null
  try {
    const v = JSON.parse(brut) as Record<string, unknown>
    if (typeof v.texte !== 'string' || !Array.isArray(v.reponses) || typeof v.bonne !== 'number') return null
    return { texte: v.texte, reponses: v.reponses.map(String), bonne: v.bonne, anecdote: typeof v.anecdote === 'string' ? v.anecdote : null }
  } catch {
    return null
  }
}

/** La même version qu'une question de la base : le même intitulé, les mêmes réponses — dans n'importe quel ordre, la série les mélange —, la même bonne, la même anecdote. */
function memeVersion(vue: { texte: string; reponses: string[]; bonne: number; anecdote: string | null }, q: QuestionDeLaBase): boolean {
  const triees = (r: readonly string[]) => [...r].sort().join('\n')
  return vue.texte === q.texte && triees(vue.reponses) === triees(q.reponses) && vue.reponses[vue.bonne] === q.reponses[q.bonne] && vue.anecdote === q.anecdote
}

function melanger<T>(liste: readonly T[]): T[] {
  const copie = [...liste]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

/** Un identifiant neuf de huit caractères, comme ceux que le rangement du dépôt tire (`base-campagne.ts ranger`). */
function nouvelIdentifiant(pris: Set<string>): string {
  for (;;) {
    const id = Array.from(randomBytes(8), o => 'abcdefghijklmnopqrstuvwxyz0123456789'[o % 36]).join('')
    if (!pris.has(id)) {
      pris.add(id)
      return id
    }
  }
}

/** Une épreuve de sentier à thème telle que sa page la reprend : jamais la bonne réponse de la question en cours. */
function vueDEpreuveDeSujet(e: Serie): EpreuveDeSujet {
  const finie = e.finieLe !== null
  return {
    id: e.id,
    sujet: e.sujet ?? '',
    palier: e.palier ?? 1,
    rejeu: e.rejeu,
    seuil: e.seuil ?? SEUIL_D_UN_SUJET,
    justes: e.justes,
    fausses: e.index - e.justes,
    total: e.questions.length,
    issue: e.issue,
    finie,
    ...(!finie && e.questions[e.index] && { question: questionMontree(e.questions[e.index], e.index) }),
  }
}

/** Une épreuve telle que sa page la reprend : jamais la bonne réponse de la question en cours. */
function vueDEpreuve(e: Serie): EpreuveDeSentier {
  const finie = e.finieLe !== null
  return {
    id: e.id,
    branche: e.branche!,
    palier: e.palier!,
    rejeu: e.rejeu,
    seuil: e.seuil ?? regleDuPalier(e.palier)?.seuil ?? QUESTIONS_PAR_EPREUVE,
    justes: e.justes,
    fausses: e.index - e.justes,
    total: e.questions.length,
    issue: e.issue,
    finie,
    ...(!finie && e.questions[e.index] && { question: questionMontree(e.questions[e.index], e.index) }),
  }
}

/**
 * Ce que dit la fin d'une épreuve validée — à sa dernière question, ou
 * arrêtée là une fois validée (`abandonnerEpreuve`) : ses étoiles, un record,
 * ce que paie sa meilleure note, et, conquis — pas rejoué —, le portrait ou le
 * titre de maître que le palier ouvre. `avant` : ses autres épreuves validées
 * sur ce palier.
 */
function finDeLEpreuveValidee(
  e: Serie,
  justes: number,
  seuil: number,
  avant: readonly Record<string, unknown>[],
): Pick<ReponseDEpreuve, 'etoiles' | 'record' | 'confettisDesEtoiles' | 'avatar' | 'maitre'> {
  const meilleure = Math.max(0, ...avant.map(r => Number(r.justes)))
  const etoilesAvant = Math.max(0, ...avant.map(r => etoilesDe(Number(r.justes), Number(r.seuil ?? seuil))))
  const etoiles = etoilesDe(justes, seuil)
  const confettis = confettisDeLaNouvelleNote(etoilesAvant, etoiles)
  const regle = e.rejeu ? undefined : regleDuPalier(e.palier)
  const b = brancheParCle(e.branche!)!
  return {
    etoiles,
    ...(meilleure > 0 && justes > meilleure && { record: true }),
    ...(confettis > 0 && { confettisDesEtoiles: confettis }),
    ...(regle?.avatar !== null && regle?.avatar !== undefined && { avatar: b.portraits[regle.avatar].key }),
    ...(regle?.maitre && { maitre: titreDeMaitre(b) }),
  }
}

/**
 * Ses sentiers, des deux lectures (`lecturesDesSentiers`) : pour chaque
 * branche, le plus haut de ce qu'il tenait d'avant et de ses épreuves
 * validées — elles se suivent : valider le septième, c'est avoir les six
 * d'avant —, et la meilleure note de chaque palier en étoiles.
 */
function sentiersLus(acquis: readonly Record<string, unknown>[], validees: readonly Record<string, unknown>[]): SentierDuJoueur[] {
  const parBranche = new Map(BRANCHES.map(b => [b.key, { acquis: 0, haut: 0, etoiles: PALIERS.map(() => 0) }]))
  for (const r of acquis) {
    const s = parBranche.get(String(r.branche) as CleDeBranche)
    if (s) s.acquis = Math.max(s.acquis, Number(r.paliers))
  }
  for (const r of validees) {
    const s = parBranche.get(String(r.branche) as CleDeBranche)
    const palier = Number(r.palier)
    const regle = regleDuPalier(palier)
    if (!s || !regle) continue
    s.haut = Math.max(s.haut, palier)
    s.etoiles[palier - 1] = Math.max(s.etoiles[palier - 1], etoilesDe(Number(r.justes), Number(r.seuil ?? regle.seuil)))
  }
  return BRANCHES.map(b => {
    const s = parBranche.get(b.key)!
    return { branche: b.key, paliers: Math.min(PALIER_DU_MAITRE, Math.max(s.acquis, s.haut)), acquis: s.acquis, etoiles: s.etoiles }
  })
}

/** Ses paliers validés, sentier par sentier (`sentiersLus`) : un sentier pas encore commencé n'y paraît pas. */
function paliersCommences(sentiers: readonly SentierDuJoueur[]): Paliers {
  return Object.fromEntries(sentiers.filter(s => s.paliers > 0).map(s => [s.branche, s.paliers]))
}

/** Sa ligue, sa cote et ses bordures, d'un relevé de ses duels ; null tant qu'il n'a fini aucun duel classé — l'absence, pas une ligue de bronze. */
function coteDuReleve(r: ReleveDesDuels): CoteDesDuels | null {
  return r.joues > 0 ? { ligue: ligueDe(r.cote).cle, cote: r.cote, bordures: r.bordures } : null
}

/**
 * D'où emprunter quand un niveau manque à la catégorie : le même, puis le
 * plus dur d'à côté, puis le plus facile. Une base qui grandit chaque matin
 * finit par remplir chaque niveau ; d'ici là, une épreuve se joue toujours.
 */
const EMPRUNTS: Readonly<Record<Niveau, readonly Niveau[]>> = {
  facile: ['facile', 'moyen', 'difficile', 'expert'],
  moyen: ['moyen', 'difficile', 'facile', 'expert'],
  difficile: ['difficile', 'expert', 'moyen', 'facile'],
  expert: ['expert', 'difficile', 'moyen', 'facile'],
}

/**
 * Une question vue ces dernières vingt-quatre heures ne revient qu'en
 * dernier recours. Une fois les jamais vues d'une marche épuisées, le tirage
 * reprenait les déjà vues au hasard : celle d'il y a cinq minutes valait
 * celle d'il y a trois semaines, et qui usait ses douze vies sur un palier
 * revoyait le soir même les questions qu'il venait de rater (un retour de
 * joueur, le 10 octobre 2026). Une redite d'hier soir se remarque ; celle
 * d'il y a trois semaines est une révision.
 */
export const VUE_RECENTE_MS = 24 * HEURE_MS

/** Ce qu'un joueur a vu d'une question : jamais, ou quand pour la dernière fois — et si c'était ces dernières vingt-quatre heures. */
function fraicheurDe(vues: ReadonlyMap<string, number>, maintenant: number) {
  return (id: string): { recente: number; vue: number; le: number } => {
    const le = vues.get(id)
    return le === undefined ? { recente: 0, vue: 0, le: 0 } : { recente: classeDeFraicheur(le, maintenant) === 2 ? 1 : 0, vue: 1, le }
  }
}

/**
 * La même fraîcheur en un chiffre, sans rien bâtir : 0 jamais vue, 1 vue,
 * 2 vue ces dernières vingt-quatre heures. Un tirage la lit pour chacune de
 * ses vues.
 */
const classeDeFraicheur = (le: number | undefined, maintenant: number): 0 | 1 | 2 => (le === undefined ? 0 : maintenant - le < VUE_RECENTE_MS ? 2 : 1)

/**
 * Les questions rangées par ce qu'un joueur en a vu : les jamais vues
 * d'abord, puis les déjà vues de la plus anciennement vue à la plus récente,
 * celles des dernières vingt-quatre heures en tout dernier. Chaque groupe
 * garde l'ordre qu'on lui donne — le hasard du battage, pour les jamais
 * vues —, et seules les vues se trient, d'un tri stable. L'ordre où une
 * série tire chaque marche : `PreparationDuTirage` le suit sur des indices,
 * sans ranger toute la base ; il se dit et se vérifie ici
 * (`duels-attente.test.ts` le compare au tri d'avant).
 */
export function parFraicheur<T extends { id: string }>(questions: readonly T[], vues: ReadonlyMap<string, number>, maintenant: number): T[] {
  const jamaisVues: T[] = []
  const vuesAvant: { q: T; le: number }[] = []
  const recentes: { q: T; le: number }[] = []
  for (const q of questions) {
    const le = vues.get(q.id)
    if (le === undefined) jamaisVues.push(q)
    else (classeDeFraicheur(le, maintenant) === 2 ? recentes : vuesAvant).push({ q, le })
  }
  const parDate = (a: { le: number }, b: { le: number }) => a.le - b.le
  return [...jamaisVues, ...vuesAvant.sort(parDate).map(x => x.q), ...recentes.sort(parDate).map(x => x.q)]
}

/**
 * Ce que les marches d'un même tirage tiennent en commun : combien chaque
 * catégorie et chaque sous-thème ont servi, par leur indice dans le tirage
 * (`FileDuTour`), et, si l'on veut, les questions déjà prises, pour
 * reconnaître leurs jumelles (`DejaPrises`).
 */
interface Servies<T> {
  categories: number[]
  sousThemes: number[]
  deja?: { jumelle(q: T): boolean; prendre(q: T): void }
}

/**
 * Une file d'une marche : les questions d'un sous-thème de sa catégorie, par
 * leur rang dans la classe de fraîcheur ouverte — l'ordre du battage, ou la
 * plus anciennement vue d'abord. Ses rangs montent ; celui de sa tête
 * départage deux files à égalité.
 */
interface FileDuTour {
  categorie: number
  sousTheme: number
  rangs: number[]
}

/** Une classe de fraîcheur, bâtie à son ouverture : ses files, et la question de chaque rang. */
interface ClasseDuTour<T> {
  files: readonly FileDuTour[]
  question: (rang: number) => T
}

/** Les jamais vues, les vues, celles des dernières vingt-quatre heures (`classeDeFraicheur`). */
const CLASSES_DE_FRAICHEUR = 3

/**
 * Combien de questions d'une file se regardent pour en trouver une qui n'est
 * la jumelle d'aucune déjà prise : au-delà, la file passe pour jumelle — une
 * famille entière ne se fouille pas à chaque place.
 */
const REGARD_DES_JUMELLES = 12

/**
 * Une marche où les catégories passent à tour de rôle, puis, dans chacune,
 * ses sous-thèmes. Tirée au hasard, une série reflétait la base : après les
 * faits de Wikidata, quatre questions expertes sur dix venaient de l'art ou
 * du cinéma, « Depuis 2010 » posait du cinéma une fois sur deux, et une série
 * de musique une musique de film sur trois (le 11 octobre 2026). La fraîcheur
 * passe devant — une jamais vue d'une catégorie déjà servie bat une déjà vue
 * d'une autre, une vue d'hier soir reste en dernier — ; à fraîcheur égale, la
 * catégorie la moins servie, puis son sous-thème le moins servi, puis une
 * question qui n'est la jumelle d'aucune déjà prise (`jumelles`) — la file
 * de son sous-thème en cherche une parmi ses premières —, puis l'ordre reçu :
 * le hasard du battage, ou la plus anciennement vue (`parFraicheur`). Elle se
 * tire en plusieurs fois (`prendre`), et plusieurs marches partagent leurs
 * comptes (`Servies`) : une série prend cinq questions de chacune dans
 * l'ordre où elle les pose, puis le reste. Chaque classe de fraîcheur ne se
 * bâtit qu'à son ouverture (`classes`) — une fois la précédente vide : une
 * marche qui a des jamais vues ne range jamais ses vues.
 */
class TourDeRole<T> {
  private classe = -1
  private ouverte: ClasseDuTour<T> | null = null

  constructor(
    private readonly classes: (classe: number) => ClasseDuTour<T>,
    private readonly servies: Servies<T>,
  ) {}

  /** Les `n` questions suivantes de la marche, moins quand elle n'en a plus. */
  prendre(n: number): T[] {
    const { categories, sousThemes, deja } = this.servies
    const tirees: T[] = []
    while (tirees.length < n) {
      const choix = this.suivante()
      if (!choix) break
      const { file, i } = choix
      const [rang] = file.rangs.splice(i, 1)
      const q = this.ouverte!.question(rang)
      tirees.push(q)
      categories[file.categorie]++
      sousThemes[file.sousTheme]++
      deja?.prendre(q)
    }
    return tirees
  }

  private suivante(): { file: FileDuTour; i: number } | null {
    const { categories, sousThemes, deja } = this.servies
    for (;;) {
      // Les files de la catégorie la moins servie, et de son sous-thème le moins servi.
      let moinsDeCategorie = Infinity
      let moinsDeSousTheme = Infinity
      let egales: FileDuTour[] = []
      for (const f of this.ouverte?.files ?? []) {
        if (f.rangs.length === 0) continue
        const c = categories[f.categorie]
        const s = sousThemes[f.sousTheme]
        if (c < moinsDeCategorie || (c === moinsDeCategorie && s < moinsDeSousTheme)) {
          moinsDeCategorie = c
          moinsDeSousTheme = s
          egales = [f]
        } else if (c === moinsDeCategorie && s === moinsDeSousTheme) egales.push(f)
      }
      if (egales.length === 0) {
        if (!this.ouvrirLaClasseSuivante()) return null
        continue
      }
      egales.sort((a, b) => a.rangs[0] - b.rangs[0])
      if (!deja) return { file: egales[0], i: 0 }
      // La question reçue la première parmi celles qui ne sont pas des
      // jumelles : les rangs d'une file montent, et une file dont la tête
      // vient après la meilleure trouvée n'a rien de mieux.
      const question = this.ouverte!.question
      let meilleure: { file: FileDuTour; i: number } | null = null
      for (const f of egales) {
        if (meilleure && f.rangs[0] > meilleure.file.rangs[meilleure.i]) break
        for (let i = 0; i < Math.min(f.rangs.length, REGARD_DES_JUMELLES); i++) {
          if (meilleure && f.rangs[i] > meilleure.file.rangs[meilleure.i]) break
          if (!deja.jumelle(question(f.rangs[i]))) {
            meilleure = { file: f, i }
            break
          }
        }
      }
      return meilleure ?? { file: egales[0], i: 0 }
    }
  }

  private ouvrirLaClasseSuivante(): boolean {
    if (++this.classe >= CLASSES_DE_FRAICHEUR) return false
    this.ouverte = this.classes(this.classe)
    return true
  }
}

/**
 * Une marche seule, catégories et sous-thèmes à tour de rôle (`TourDeRole`),
 * dans l'ordre reçu : le rang d'une question est sa place dans sa classe de
 * fraîcheur. Ne range que les `max` premières : une série n'en lit pas plus,
 * et la base en compte des milliers par marche.
 */
export function aTourDeRole<T extends { id: string; meta: { categorie: string; sousTheme: string } }>(
  questions: readonly T[],
  vues: ReadonlyMap<string, number>,
  maintenant: number,
  max = QUESTIONS_PAR_SERIE,
): T[] {
  const parClasse: T[][] = Array.from({ length: CLASSES_DE_FRAICHEUR }, () => [])
  for (const q of questions) parClasse[classeDeFraicheur(vues.get(q.id), maintenant)].push(q)
  const categories = new Map<string, number>()
  const sousThemes = new Map<string, Map<string, number>>()
  let nombreDeSousThemes = 0
  const indices = parClasse.map(liste =>
    liste.map(({ meta: { categorie, sousTheme } }) => {
      if (!categories.has(categorie)) categories.set(categorie, categories.size)
      let siens = sousThemes.get(categorie)
      if (!siens) sousThemes.set(categorie, (siens = new Map()))
      let s = siens.get(sousTheme)
      if (s === undefined) siens.set(sousTheme, (s = nombreDeSousThemes++))
      return { categorie: categories.get(categorie)!, sousTheme: s }
    }),
  )
  const servies: Servies<T> = { categories: new Array(categories.size).fill(0), sousThemes: new Array(nombreDeSousThemes).fill(0) }
  return new TourDeRole<T>(classe => {
    const liste = parClasse[classe]
    const files = new Map<number, FileDuTour>()
    indices[classe].forEach(({ categorie, sousTheme }, rang) => {
      let f = files.get(sousTheme)
      if (!f) files.set(sousTheme, (f = { categorie, sousTheme, rangs: [] }))
      f.rangs.push(rang)
    })
    return { files: [...files.values()], question: rang => liste[rang] }
  }, servies).prendre(max)
}

/**
 * Les questions d'une série — une série, un défi de la semaine, un duel —,
 * dans l'ordre où elle les pose (`ordreDeSerie`) : chaque marche rangée par
 * fraîcheur, ses catégories à tour de rôle (`TourDeRole`). Sans `vues`,
 * toutes passent pour jamais vues : le défi se tire pour tous. Les marches
 * se tirent dans cet ordre-là — cinq de chacune, de la facile à l'experte,
 * puis le reste en repartant de l'experte — et partagent leurs comptes :
 * les catégories et les sous-thèmes tournent d'une marche à l'autre — chaque
 * marche repartait de zéro, et une même catégorie pouvait ouvrir les
 * quatre —, et une jumelle se juge sur tout ce que la série a posé avant
 * elle : une série du petit écran posait cinq « Qui a créé la série… » en
 * vingt questions, une de géographie trois capitales (le 12 octobre 2026).
 * Le serveur garde la préparation de ses jouables (`PreparationDuTirage`) ;
 * celle-ci la refait à chaque appel.
 */
export function tirerUneSerie(
  jouables: readonly QuestionDeLaBase[],
  mesure: ReadonlyMap<string, MesureDUneQuestion>,
  vues: ReadonlyMap<string, number> = new Map(),
  maintenant = 0,
): { question: QuestionDeLaBase; niveau: Niveau }[] {
  return new PreparationDuTirage(jouables, mesure).tirer(vues, maintenant)
}

/**
 * Ce qu'un tirage de série relit de chaque question jouable — sa marche, sa
 * catégorie et son sous-thème —, lu une fois par liste de jouables et par
 * mesure des difficultés, qui ne change qu'au plus toutes les dix minutes
 * (`CampagneStore.tirage`). Un tirage battait les vingt-quatre mille
 * questions, puis les repassait quatre fois — rangées par fraîcheur, par
 * marche, par classe, par file — pour en prendre soixante : 13 à 25 ms de
 * processeur à chaque série, chaque défi, chaque duel, chaque dé, dix fois
 * plus au dixième de cœur de l'hébergeur (le banc du 16 octobre 2026). Il ne
 * lui reste que le battage, sur des indices, et une passe qui range les
 * jamais vues dans leur file ; ses vues se marquent depuis ses vues, pas
 * depuis la base, et ne se trient qu'au besoin.
 *
 * La série est la même qu'avant, question pour question, au même hasard :
 * le battage tire le hasard comme `melanger`, et un rang ne se compare qu'à
 * un autre de la même marche et de la même classe — la place au battage
 * pour les jamais vues, la place parmi les vues triées pour les autres,
 * dans l'ordre même des rangs d'avant (`tirage-prepare.test.ts` les
 * compare).
 */
export class PreparationDuTirage {
  /** La marche de chaque question (son indice dans `NIVEAUX`), à cette mesure. */
  private readonly marches: Uint8Array
  /** La file de chaque question : sa catégorie et son sous-thème, un indice pour les deux. */
  private readonly files: Int32Array
  /** La catégorie de chaque file, par son indice. */
  private readonly categorieDeLaFile: number[] = []
  private readonly nombreDeCategories: number
  /** Chaque question par son identifiant ; null quand deux le partagent — les vues se lisent alors question par question. */
  private readonly parId: Map<string, number> | null

  /** `avant`, la préparation des mêmes jouables à une autre mesure : leurs files et leurs identifiants n'en dépendent pas. */
  constructor(
    readonly questions: readonly QuestionDeLaBase[],
    readonly mesure: ReadonlyMap<string, MesureDUneQuestion>,
    avant?: PreparationDuTirage,
  ) {
    const n = questions.length
    this.marches = new Uint8Array(n)
    for (let i = 0; i < n; i++) this.marches[i] = NIVEAUX.indexOf(niveauDeQuestion(questions[i].meta.difficulte, mesure.get(questions[i].id)))
    if (avant?.questions === questions) {
      this.files = avant.files
      this.categorieDeLaFile = avant.categorieDeLaFile
      this.nombreDeCategories = avant.nombreDeCategories
      this.parId = avant.parId
      return
    }
    this.files = new Int32Array(n)
    const categories = new Map<string, number>()
    const filesParCategorie = new Map<string, Map<string, number>>()
    const parId = new Map<string, number>()
    let doublon = false
    for (let i = 0; i < n; i++) {
      const q = questions[i]
      const { categorie, sousTheme } = q.meta
      let parSousTheme = filesParCategorie.get(categorie)
      if (!parSousTheme) {
        filesParCategorie.set(categorie, (parSousTheme = new Map()))
        categories.set(categorie, categories.size)
      }
      let f = parSousTheme.get(sousTheme)
      if (f === undefined) {
        parSousTheme.set(sousTheme, (f = this.categorieDeLaFile.length))
        this.categorieDeLaFile.push(categories.get(categorie)!)
      }
      this.files[i] = f
      if (parId.has(q.id)) doublon = true
      else parId.set(q.id, i)
    }
    this.nombreDeCategories = categories.size
    this.parId = doublon ? null : parId
  }

  /** La marche de la `i`-ième question, à cette mesure : la série de référence du dé la relit d'ici (`referencePour`). */
  marche(i: number): Niveau {
    return NIVEAUX[this.marches[i]]
  }

  /** Une série pour ce joueur : `vues`, ce qu'il a vu et quand (aucune, pour le défi, tiré pour tous). */
  tirer(vues: ReadonlyMap<string, number> = new Map(), maintenant = 0): { question: QuestionDeLaBase; niveau: Niveau }[] {
    const { questions, marches: marcheDe, files: fileDe, categorieDeLaFile } = this
    const n = questions.length
    const nombreDeFiles = categorieDeLaFile.length
    // Le battage de `melanger`, sur les indices : les mêmes tirages du hasard, dans le même ordre.
    const ordre = new Int32Array(n)
    for (let i = 0; i < n; i++) ordre[i] = i
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const x = ordre[i]
      ordre[i] = ordre[j]
      ordre[j] = x
    }
    // Ce qu'il a vu, et quand : depuis ses vues — quelques centaines —, pas depuis la base.
    const classe = new Uint8Array(n)
    const vueLe = new Float64Array(n)
    const marquer = (i: number, le: number | undefined) => {
      classe[i] = classeDeFraicheur(le, maintenant)
      if (le !== undefined) vueLe[i] = le
    }
    if (vues.size > 0) {
      if (this.parId) {
        for (const [id, le] of vues) {
          const i = this.parId.get(id)
          if (i !== undefined) marquer(i, le)
        }
      } else for (let i = 0; i < n; i++) marquer(i, vues.get(questions[i].id))
    }
    // Les jamais vues, dans l'ordre du battage, chacune dans la file de sa
    // marche ; les vues à part, dans ce même ordre, pour leurs classes.
    const seaux: (number[] | undefined)[] = new Array(NIVEAUX.length * nombreDeFiles)
    const vuesParClasse: number[][] = [[], []]
    for (let p = 0; p < n; p++) {
      const i = ordre[p]
      const c = classe[i]
      if (c === 0) (seaux[marcheDe[i] * nombreDeFiles + fileDe[i]] ??= []).push(p)
      else vuesParClasse[c - 1].push(p)
    }
    // Les vues de la plus anciennement vue à la plus récente, d'un tri
    // stable sur l'ordre du battage, comme `parFraicheur` : triées à la
    // première marche qui en a besoin, une fois pour toutes.
    const triees: (number[] | null)[] = [null, null]
    const vuesTriees = (c: 1 | 2) => (triees[c - 1] ??= vuesParClasse[c - 1].sort((a, b) => vueLe[ordre[a]] - vueLe[ordre[b]]))
    const classeDeLaMarche = (m: number, c: number): ClasseDuTour<QuestionDeLaBase> => {
      if (c === 0) {
        const files: FileDuTour[] = []
        for (let f = 0; f < nombreDeFiles; f++) {
          const rangs = seaux[m * nombreDeFiles + f]
          if (rangs) files.push({ categorie: categorieDeLaFile[f], sousTheme: f, rangs })
        }
        return { files, question: p => questions[ordre[p]] }
      }
      // Une classe de vues : le rang, la place parmi toutes les vues de cette classe, triées.
      const liste = vuesTriees(c as 1 | 2)
      const parFile = new Map<number, FileDuTour>()
      for (let r = 0; r < liste.length; r++) {
        const i = ordre[liste[r]]
        if (marcheDe[i] !== m) continue
        let f = parFile.get(fileDe[i])
        if (!f) parFile.set(fileDe[i], (f = { categorie: categorieDeLaFile[fileDe[i]], sousTheme: fileDe[i], rangs: [] }))
        f.rangs.push(r)
      }
      return { files: [...parFile.values()], question: r => questions[ordre[liste[r]]] }
    }
    const servies: Servies<QuestionDeLaBase> = {
      categories: new Array(this.nombreDeCategories).fill(0),
      sousThemes: new Array(nombreDeFiles).fill(0),
      deja: new DejaPrises(),
    }
    const tours = NIVEAUX.map((_, m) => new TourDeRole<QuestionDeLaBase>(c => classeDeLaMarche(m, c), servies))
    const parMarche: Record<Niveau, QuestionDeLaBase[]> = { facile: [], moyen: [], difficile: [], expert: [] }
    NIVEAUX.forEach((niveau, m) => parMarche[niveau].push(...tours[m].prendre(QUESTIONS_PAR_MARCHE)))
    let reste = QUESTIONS_PAR_SERIE - NIVEAUX.reduce((s, niveau) => s + parMarche[niveau].length, 0)
    for (let m = NIVEAUX.length - 1; m >= 0; m--) {
      const suite = tours[m].prendre(reste)
      parMarche[NIVEAUX[m]].push(...suite)
      reste -= suite.length
    }
    return ordreDeSerie(parMarche, QUESTIONS_PAR_SERIE)
  }
}

/** `a` passe-t-il avant `b` ? Deux rangs se lisent de gauche à droite. */
function passeAvant(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

/**
 * Les seize questions d'une épreuve, tirées dans la catégorie de son sentier
 * selon le mélange de son palier : jamais vues d'abord, puis les sous-thèmes
 * les moins servis, puis les déjà vues de la plus anciennement vue à la plus
 * récente (`parFraicheur`). Aux paliers « toute la catégorie », chaque
 * sous-thème passe d'abord, même par une question déjà vue : on ne valide
 * pas le stade sur le seul football — mais jamais par une question vue ces
 * dernières vingt-quatre heures, qui ne sort qu'en dernier recours, partout
 * (`VUE_RECENTE_MS`). Avant, un chapitre (`shared/chapitres.ts`) : ses
 * sous-thèmes passent devant le reste de la catégorie, même par une question
 * déjà vue — c'est son thème —, ses sous-thèmes servis à tour de rôle ; le
 * reste ne complète que ce que le thème n'a plus de frais. Une marche
 * épuisée de jamais vues reste sa marche : emprunter au voisin changerait la
 * difficulté du palier, que ses mélanges ont mesurée. Pas de vrai ou faux là
 * où le palier n'en veut pas, ni deux questions jumelles quand la marche en a
 * d'autres aussi fraîches (`jumelles`). Dans le désordre : chaque question
 * peut être la difficile.
 */
export function tirerUneEpreuve(
  jouables: readonly QuestionDeLaBase[],
  regle: RegleDuPalier,
  vues: ReadonlyMap<string, number>,
  mesure: ReadonlyMap<string, MesureDUneQuestion>,
  maintenant: number,
  /** Les sous-thèmes du chapitre de ce palier (`chapitreDuPalier`) ; vide : aucun chapitre. */
  chapitre: readonly string[] = [],
): { question: QuestionDeLaBase; niveau: Niveau }[] {
  const pool = regle.sansVraiFaux ? jouables.filter(q => q.reponses.length !== 2) : jouables
  // Seize aux sentiers, dix à ceux d'un sujet (`shared/sentiersDeSujets.ts`) : son mélange le dit.
  const aTirer = Object.values(regle.melange).reduce((n, x) => n + (x ?? 0), 0)
  if (pool.length < aTirer) throw new Error('Ce sentier n’a pas encore assez de questions : reviens bientôt')
  const parNiveau: Record<Niveau, QuestionDeLaBase[]> = { facile: [], moyen: [], difficile: [], expert: [] }
  for (const q of melanger(pool)) parNiveau[niveauDeQuestion(q.meta.difficulte, mesure.get(q.id))].push(q)
  const usage = new Map<string, number>()
  const prises = new Set<string>()
  const deja = new DejaPrises()
  const fraicheur = fraicheurDe(vues, maintenant)
  const duChapitre = regle.touteLaCategorie ? new Set<string>() : new Set(chapitre)
  // Le rang d'une question pour la place suivante — le plus petit gagne : une
  // vue d'hier soir en dernier, partout ; puis, aux paliers « toute la
  // catégorie », le sous-thème le moins servi avant la jamais vue ; dans un
  // chapitre, son thème avant tout le reste, puis la jamais vue, puis le
  // sous-thème le moins servi ; ailleurs, la jamais vue d'abord ; puis la
  // jumelle d'une question déjà prise après les autres (`jumelles` : quatre
  // « Comment appelle-t-on le petit de… », mêmes leurres, dans une épreuve de
  // la forêt — l'experte du jeu solo, le 11 octobre 2026), à fraîcheur et à
  // sous-thème égaux, jamais devant une jamais vue ; enfin la plus
  // anciennement vue.
  const rang = (q: QuestionDeLaBase): number[] => {
    const servi = usage.get(q.meta.sousTheme) ?? 0
    const f = fraicheur(q.id)
    const jumelle = deja.jumelle(q) ? 1 : 0
    if (regle.touteLaCategorie) return [f.recente, servi, f.vue, jumelle, f.le]
    if (duChapitre.size > 0) return [f.recente, duChapitre.has(q.meta.sousTheme) ? 0 : 1, f.vue, servi, jumelle, f.le]
    return [f.recente, f.vue, servi, jumelle, f.le]
  }
  const tirees: { question: QuestionDeLaBase; niveau: Niveau }[] = []
  for (const [niveau, combien] of Object.entries(regle.melange) as [Niveau, number][]) {
    for (let i = 0; i < combien; i++) {
      for (const n of EMPRUNTS[niveau]) {
        let meilleure: QuestionDeLaBase | null = null
        let sonRang: number[] | null = null
        for (const q of parNiveau[n]) {
          if (prises.has(q.id)) continue
          const r = rang(q)
          if (!sonRang || passeAvant(r, sonRang)) {
            meilleure = q
            sonRang = r
            // Jamais vue, du thème, d'un sous-thème encore à servir : rien ne fera mieux.
            if (r.every(x => x === 0)) break
          }
        }
        if (meilleure) {
          prises.add(meilleure.id)
          deja.prendre(meilleure)
          usage.set(meilleure.meta.sousTheme, (usage.get(meilleure.meta.sousTheme) ?? 0) + 1)
          tirees.push({ question: meilleure, niveau: n })
          break
        }
      }
    }
  }
  return melanger(tirees)
}

/** Les sous-thèmes d'une catégorie, pour dire qu'une épreuve les couvre : le catalogue de l'étiquetage. */
export const sousThemesDe = (categorie: string): readonly string[] =>
  ((SOUS_THEMES as Record<string, readonly { cle: string }[]>)[categorie] ?? []).map(s => s.cle)
