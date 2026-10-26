import { AUCUNE_BORDURE, bordurePortee, choixDeBordure, ligueParCle, type BordureDeLigue, type CleDeLigue } from '../../../shared/duels'
import { ajouterColonne, clientDistant, type Client } from '../core/distante'
import type { InStatement, ResultSet, Row } from '@libsql/client'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { hashPassword, verifyPassword } from './password'
import { AVATARS, cleanAvatar, cleanName, COLLECTION, DEFAULT_AVATAR, niveauRequis, tronquer } from '../../../shared/avatars'
import {
  AUCUN_JOUR,
  AUCUNE_CAMPAGNE,
  CHANCE_ECLAT,
  carriereDe,
  choixDeFinition,
  clesQuiBrillent,
  ficheDe,
  finitionPortee,
  finitionsOuvertes,
  gainVide,
  niveauDuProfil,
  niveauPour,
  niveauSurCourbe,
  progression,
  releveVide,
  soireeQuiCompte,
  xpDuNiveau,
  ANNONCE_MS,
  CONFETTIS_PAR_DON_MAX,
  MOT_D_UN_DON_MAX,
  XP,
  type AnnonceDeLAdministrateur,
  type Carriere,
  type Finition,
  type FinitionChoisie,
  type GainSoiree,
  type NiveauGarde,
  type PublicProfile,
  type PublicProfileDetail,
  type ReleveSoiree,
  type StatsDeCampagne,
  type StatsDuJour,
} from '../../../shared/profil'
import { rareteDe, type BadgePorte } from '../../../shared/badges'
import {
  HAUTS_FAITS_DE_CARRIERE,
  HAUTS_FAITS_DE_SOIREE,
  HAUTS_FAITS_HORS_SOIREE,
  HAUTS_FAITS_REGAGNABLES,
  VITRINE_MAX,
  clePalier,
  hautFait,
  hautsFaitsGagnes,
  origineDe,
  palierDe,
  paliersAtteints,
  paliersDeCampagneAtteints,
  paliersDuJourAtteints,
  paliersDesEclats,
  paliersDuNiveau,
  titreDePalier,
  xpDe,
  xpHorsDesSoirees,
  type HautFaitVu,
} from '../../../shared/hautsfaits'
import { fond, fondsOuverts, FONDS_EN_BOUTIQUE, PRIX_D_UN_FOND, type CleDeFond } from '../../../shared/fonds'
import { AUCUNE_GERBE, GERBE_PAR_DEFAUT, gerbe, gerbeOuverte, gerbesOuvertes, type CleDeGerbe } from '../../../shared/gerbes'
import {
  ceQueDonnentLesConfettis,
  confettisDeSoiree,
  enBoutique,
  nConfettis,
  prixDe,
  theme as themeDuCatalogue,
  themeGagne,
  THEMES,
  type BoutiqueDuProfil,
  type ConfettisDeLaFin,
} from '../../../shared/themes'
import { cleDeSaison, saison, type Saison } from '../../../shared/saisons'
import {
  cibleEclat,
  conditionTenue,
  estEnReserve,
  estUneVoieRangee,
  legendaire,
  legendaireDeLExpedition,
  legendaireDuCabinet,
  PREFIXE_DE_LA_RESERVE,
  PREFIXE_DES_DONS_D_ECLAT,
  legendairesDebloques,
  legendairesOuvertsPar,
  sqlHorsDesVoiesRangees,
  type Condition,
} from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { lireLesVus, type VusDeLaLoge } from '../../../shared/piecesDeLaLoge'
import { gainsDesMissions, lireLaMission, RANG_DES_TROIS, type Mission } from '../../../shared/missions'
import { cleDeLObjet, lireLObjet, moisDuCoffreValide, rangDuCoffre, rangDuCoffreDuMois, type CoffreOuvert, type ObjetDuTresor, type RangDuCoffre } from '../../../shared/coffre'
import { ETOILES_DE_LA_CUEILLETTE, type Envie } from '../../../shared/soins'
import { nomDeLObjet, phraseDeLObjet, tirerLeCoffre } from '../../../shared/tresor'
import type { Rarete } from '../../../shared/badges'
import { brancheDe, deLaBranche, nomDansLaPhrase, portrait, portraitsOuverts, type Paliers } from '../../../shared/branches'
import {
  COMPAGNONS,
  JUSTES_DES_FORMES,
  MONTREE_DE_LA_METAMORPHOSE,
  NOM_D_UN_COMPAGNON_MAX,
  PRIX_D_UN_COMPAGNON,
  compagnon as compagnonDuCatalogue,
  compagnonDe,
  avecLui,
  cheminDeLaLuciole,
  compagnonDeLaNiche,
  formeDeCompagnon,
  formesOuvertes,
  metamorphoseOuverte,
  pourLAvoir,
  rangAtteint,
  type CleDeCompagnon,
  type Compagnon,
  type CompagnonAcquis,
  type CompagnonPossede,
  type FormeDeCompagnon,
} from '../../../shared/compagnons'
import {
  PALIERS_DE_LA_NICHE,
  STYLES_D_ORNEMENT,
  STYLE_D_OFFICE,
  lireLesOrnements,
  ornement as ornementDuCatalogue,
  paliersDeLaNicheAtteints,
  type ReglageDesOrnements,
  type StyleDOrnement,
} from '../../../shared/ornements'
import { formatNumber } from '../../../shared/typographie'
import { PRIX_D_UNE_VIE, VIES_PAR_ACHAT_MAX, brancheDuMaitre, maitresDe } from '../../../shared/sentiers'
import { PRIX_D_UN_SABLIER, SABLIERS_MAX, jourAvant, jourDe, moisDuChampion, niveauDuLaurier, titreDuChampion, titresDeChampion, type LaurierPorte, type NiveauDeLaurier } from '../../../shared/jour'
import type { Achat, Mouvement, SorteDeVente } from '../../../shared/qgEconomie'
import type { SoireeDUnProfil } from '../../../shared/qgActivite'
import { PAGES, PREFIXE_DES_PAGES, moisDeLaPage, pagesDorees, pagesOuvertes } from '../../../shared/calendrier'
import { additionnerCategories, additionnerSavoirs, justesParCategorie, type Savoir } from '../../../shared/ecussons'
import { isValidLogin, normalizeLogin } from '../../../shared/space'
import { sansAccent } from '../../../shared/homonymes'
import { divinsDebloques, raconter } from '../core/divins'
import { titreDuPrix } from '../core/stats'
import type { ArchiveStore } from '../core/archive'
import type { CampagneDuProfil, CoteDesDuels } from '../core/campagne'
import type { ProfileBadge } from '../core/party'
import type { CeQueLaLogeLit } from '../../../shared/loge'
import {
  ANNONCES_MONTREES,
  MOTS_MONTRES,
  NOTE_MAX,
  lireLaQuestion,
  lireLaReponse,
  lireLeMessage,
  lireLesConfettis,
  type AccuseDeReponse,
  type AnnonceAuQg,
  type QuestionAPoser,
  type QuestionAuQg,
  type QuestionDAnnonce,
  type SorteDeQuestion,
} from '../../../shared/annonces'

/** Chaque champ de `T` donné, même vide : un champ de plus dans `T` ne s'oublie pas en silence là où on le remplit. */
type ToutDonne<T> = { [K in keyof Required<T>]: undefined extends T[K] ? T[K] | undefined : T[K] }

/**
 * Les profils des joueurs récurrents, leurs sessions, leur expérience et
 * leurs éclats.
 *
 * Tout vit dans la base permanente, avec les comptes et les archives — la
 * base locale de la soirée est jetable, et « Nouvelle soirée » la vide. Un
 * profil traverse donc les soirées, et les animateurs : c'est tout l'intérêt.
 *
 * ── Ce qui diffère d'`AuthStore`, et pourquoi ────────────────────────────
 *
 * `AuthStore` garde tous les comptes en mémoire : il y en a une poignée. Les
 * profils, eux, peuvent se compter par milliers — on ne les charge donc pas
 * tous. Seules les sessions montent en mémoire (c'est le chemin chaud : une
 * résolution par inscription à une soirée), et un profil s'y range la
 * première fois qu'on le lit. Une soirée en touche au plus quelques
 * dizaines, pas la base entière.
 *
 * Comme pour les comptes, la base s'écrit d'abord et la mémoire suit : un
 * mot de passe que Turso refusait ouvrait quand même le profil jusqu'au
 * redémarrage, et un code de secours s'y consommait sans que le neuf ait
 * été montré à personne.
 */
export interface ProfileRec {
  id: string
  login: string
  name: string
  avatar: string
  /** Ce qu'il a choisi de porter : `auto` porte toujours la plus belle finition qu'il a. */
  finition: FinitionChoisie
  /**
   * L'avatar dessiné qu'il porte à la place de son emoji, s'il en porte un :
   * un légendaire (`lg:…`) ou un Divin (`dv:…`). Une seule colonne : on ne
   * porte jamais qu'un avatar à la fois.
   */
  legendaire: string | null
  /**
   * Le titre qu'il porte sous son prénom : la clé d'un haut fait gagné
   * (`hf:oracle`), qui s'écrit de son nom. Relu à chaque affichage : une
   * soirée retirée de l'historique emporte le haut fait, et le titre avec.
   */
  titre: string | null
  /**
   * Les hauts faits que sa carte montre, s'il les a choisis : leurs clés, en
   * JSON. Null : les plus durs à obtenir, d'office (`plusBeaux`).
   */
  vitrine: string | null
  /**
   * Le fond de sa carte, s'il en a choisi un (`shared/fonds.ts`). Relu à
   * chaque affichage (`fondPorte`) : celui qu'il ne mérite plus cesse de se
   * voir, sans que rien ne soit réécrit.
   */
  fond: string | null
  /**
   * Le thème qui habille son téléphone (`shared/themes.ts`), s'il en porte
   * un autre que Velours : un offert, ou un thème acheté. Un achat ne se
   * reprend jamais — rien à relire à l'affichage, sinon que le thème existe
   * encore.
   */
  theme: string | null
  /**
   * La gerbe de ses bonnes réponses (`shared/gerbes.ts`), s'il en a choisi
   * une — null : celle de tous ; `AUCUNE_GERBE` : aucune. Relue à chaque
   * affichage (`gerbePortee`), comme le fond.
   */
  gerbe: string | null
  /**
   * La bordure de ligue qu'il porte autour de son avatar (`shared/duels.ts`),
   * s'il l'a choisie — null : `auto`, sa plus haute qui a un cran ;
   * `AUCUNE_BORDURE` : aucune. Ses crans se relisent dans ses duels.
   */
  bordure: string | null
  /**
   * Le compagnon qu'il a installé dans sa niche (`loup`), s'il en a choisi un
   * — null : celui que la règle désigne (`compagnonDeLaNiche`). C'est lui qui
   * grandit de ses bonnes réponses.
   */
  niche: string | null
  passwordHash: string
  /** Le code de secours, haché lui aussi : la base qui fuit ne rend personne. */
  recoveryHash: string
  xp: number
  createdAt: number
  lastSeenAt: number | null
  /** Suspendu par l'administrateur, depuis : ni connexion, ni place aux classements. */
  disabledAt: number | null
  /** Renommé par l'administrateur, quand : son accueil le lui dit, une fois. Jamais quand il change lui-même. */
  renommeLe: number | null
}

interface ProfileSessionRec {
  id: string
  profileId: string
  expiresAt: number
  lastSeenAt: number
}

/**
 * Une récompense de soirée et son lauréat — un profil, jamais un invité
 * anonyme : un prix (L'Éclair, Le Cancre…) ou un haut fait de soirée.
 */
export interface PrixDeSoiree {
  profileId: string
  badge: string
  emoji: string
  title: string
}

/**
 * La ligne d'expérience qui porte les paliers de carrière. Un palier ne tombe
 * qu'une fois, sur toute la carrière : son expérience ne peut pas vivre dans
 * la ligne d'une soirée, que chaque crédit remplace. Elle a donc la sienne,
 * recalculée à chaque palier décerné — et l'historique des soirées l'ignore.
 * Depuis le 6 octobre 2026, elle porte aussi les hauts faits du quiz du jour
 * et de la campagne, qui ne se rangent sous aucune soirée
 * (`xpHorsDesSoirees`) : recalculée de même à chaque haut fait rangé.
 */
export const LIGNE_PALIERS = '#paliers'

/** Ce que la ligne des paliers compte, en SQL : les paliers de carrière, les hauts faits hors des soirées. */
const BADGES_DE_LA_LIGNE = `(badge GLOB 'hf:*:[123]' OR badge IN (${HAUTS_FAITS_HORS_SOIREE.map(h => `'${h.key}'`).join(', ')}))`

/**
 * La ligne d'expérience du quiz du jour : toutes ses parties et tous ses
 * podiums, recalculés par `core/jour.ts` à chaque gain. Comme celle des
 * paliers, elle compte dans le total et le niveau, mais l'historique des
 * soirées l'ignore : le quiz du jour ne fait ni une soirée pour L'Habitué, ni
 * une réponse pour Le Bavard — la carrière reste celle des soirées.
 */
export const LIGNE_JOUR = '#jour'

/**
 * La ligne d'expérience de la campagne solo : ses bonnes réponses, sans
 * plafond (`xpDeCampagne`), recalculées par `core/campagne.ts` à
 * chaque bonne réponse. Comme celle du quiz du jour, elle compte dans le
 * total et le niveau, mais l'historique des soirées l'ignore.
 */
export const LIGNE_CAMPAGNE = '#campagne'

/**
 * La ligne du rattrapage des niveaux gelés (`rattraperLesNiveauxGeles`) :
 * écrite une fois, le 6 octobre 2026, et jamais recalculée — elle n'a rien
 * à relire, et recalculée, elle reprendrait ce que le profil gagne ensuite.
 */
export const LIGNE_RATTRAPAGE = '#rattrapage'

/**
 * La ligne d'expérience des missions du jour (`shared/missions.ts`) : chaque
 * mission faite, et chaque jour aux trois faites, recomptés de
 * `profile_missions` à chaque mission faite (`accomplirDesMissions`). Comme
 * celles du quiz du jour et de la campagne, elle compte dans le total et le
 * niveau, et l'historique des soirées l'ignore.
 */
export const LIGNE_MISSIONS = '#missions'

/**
 * Les lignes qui ne sont pas des soirées : tout ce qui lit `profile_xp`
 * comme des soirées les écarte — l'historique, la série du jour. Une ligne
 * de plus s'ajoute ici, et nulle part ailleurs.
 */
export const LIGNES_A_PART: readonly string[] = [LIGNE_PALIERS, LIGNE_JOUR, LIGNE_CAMPAGNE, LIGNE_RATTRAPAGE, LIGNE_MISSIONS]

/** `NOT IN (…)` des lignes à part, à poser dans une requête qui lit les soirées. */
export const HORS_LIGNES_A_PART = `soiree_id NOT IN (${LIGNES_A_PART.map(l => `'${l}'`).join(', ')})`

/**
 * Ce que le QG lit d'une ligne de soirée : qui, quand, les quiz qu'il y a
 * joués et les questions qu'on lui a posées — tirés du détail dans la base
 * même, sans le faire voyager (ses catégories en font l'essentiel). Une ligne
 * illisible compte zéro au lieu de faire échouer la lecture.
 */
const COLONNES_D_UNE_SOIREE_DU_QG = `profile_id, created_at,
  CASE WHEN json_valid(detail) THEN json_extract(detail, '$.releve.quizJoues') END AS quiz,
  CASE WHEN json_valid(detail) THEN json_extract(detail, '$.releve.questions') END AS questions`

/** Une soirée d'un profil, telle que le QG la compte (`COLONNES_D_UNE_SOIREE_DU_QG`). */
const soireeDuQg = (r: Row): SoireeDUnProfil => ({ qui: String(r.profile_id), quand: Number(r.created_at), quiz: Number(r.quiz ?? 0), questions: Number(r.questions ?? 0) })

/** Ses dernières soirées, où l'on cherche qui il a croisé (`compagnonsDeSoiree`) : au-delà, on ne se souvient plus de qui était là. */
const SOIREES_DES_CROISES = 5

/**
 * Le nom sous lequel un jour range les paliers du quiz du jour qu'il a fait
 * tomber (`#jour:2026-09-26`) : aucune soirée ne le porte, et en retirer une
 * ne les reprend donc jamais.
 */
export const cleDuJour = (jour: string) => `${LIGNE_JOUR}:${jour}`

/**
 * La version du barème qui a écrit une ligne d'expérience : 2 depuis le
 * barème au mérite, 3 depuis qu'il paie dès deux joueurs et que l'animateur
 * gagne chez lui, 4 depuis les Divins — l'expérience n'a pas bougé, mais
 * les soirées d'avant doivent se relire pour qu'un Divin y descende aussi —,
 * 5 depuis que deux estimations à égale distance sont ex æquo même quand la
 * virgule flottante les séparait (0,7 et 0,9 pour 0,8) : l'expérience du
 * plus proche allait à un seul des deux ; 6 depuis le coup d'œil — le relevé
 * compte la part de la salle que chaque estimation bat ou égale, et le prix
 * du coup d'œil (clé `devin`) se juge dessus. L'expérience n'a pas bougé, mais les soirées d'avant
 * doivent se relire pour que la fiche le montre ; 7 depuis les saisons — une
 * soirée d'Halloween, de Noël ou du Nouvel An ouvre leur légendaire, et
 * celles rangées avant #59 ne l'auraient ouvert qu'au barème suivant, d'un
 * coup et sans que personne sache pourquoi.
 * Une ligne d'une version d'avant se relit au démarrage (`recalcul.ts`) —
 * son format, lui, n'a pas changé depuis la 2.
 */
export const VERSION_BAREME = 7

/** La première version dont les lignes portent le relevé complet. */
const VERSION_RELEVE_COMPLET = 2

/**
 * Chaque fois que la règle d'un légendaire s'est durcie : les règles d'avant,
 * et le drapeau, dans `meta`, qui dit que ce qu'elles avaient donné est
 * retenu (`garderLesLegendairesAcquis`). Durcir encore, c'est ajouter une
 * entrée — jamais en modifier une : son drapeau est déjà posé en production.
 */
const DURCISSEMENTS: { drapeau: string; avant: Record<string, Condition> }[] = [
  // Septembre 2026 : l'Oracle, le Tigre et le Lion tombaient d'un seul haut
  // fait, la Comète au Réflexe Argent, le Fantôme en deux soirées, le Trou
  // Noir en trois.
  {
    drapeau: 'legendaires_durcis',
    avant: {
      'lg:oracle': { hautFait: 'hf:oracle', fois: 1 },
      'lg:tigre': { hautFait: 'hf:foudre', fois: 1 },
      'lg:lion': { hautFait: 'hf:roi', fois: 1 },
      'lg:comete': { hautFait: 'hf:reflexe', palier: 2 },
      'lg:fantome': { hautFait: 'hf:somnambule', fois: 2 },
      'lg:trou-noir': { hautFait: 'hf:cosmique', fois: 3 },
    },
  },
]

/**
 * Chaque fois que la courbe des niveaux s'est durcie : le pas d'avant, et le
 * drapeau, dans `meta`, qui dit que les niveaux atteints sous elle sont
 * gardés (`garderLesNiveauxAtteints`). Durcir encore, c'est ajouter une
 * entrée — jamais en modifier une : son drapeau est déjà posé en production.
 */
const COURBES_D_AVANT: { drapeau: string; pas: number }[] = [
  // Septembre 2026 : le niveau n demandait 25 × (n − 1)².
  { drapeau: 'courbe_durcie', pas: 25 },
]

/** Le drapeau, dans `meta`, qui dit que les niches jamais choisies sont figées (`installerLesNiches`). */
const NICHES_INSTALLEES = 'niches_installees'

/** Une règle relue en base, si elle en est une. */
function lireCondition(brut: unknown): Condition | null {
  try {
    const c = JSON.parse(String(brut))
    if (typeof c?.hautFait !== 'string') return null
    if (Number.isInteger(c.fois) && c.fois > 0) return { hautFait: c.hautFait, fois: c.fois }
    if (Number.isInteger(c.palier) && c.palier > 0) return { hautFait: c.hautFait, palier: c.palier }
    return null
  } catch {
    return null
  }
}

/**
 * Combien de profils `byIds` demande par aller-retour : assez pour les
 * joueurs d'un jour chargés d'un coup, assez peu pour qu'une liste
 * d'identifiants reste loin de la borne des paramètres de SQLite.
 */
const PROFILS_PAR_PAQUET = 200

/** Une ligne de `profile_missions` : une mission tirée — ou la ligne des trois, sans mission —, faite ou non. */
export interface LigneDeMission {
  jour: string
  rang: number
  /** La mission tirée ; null pour la ligne des trois, ou une mission qui ne se lit plus. */
  mission: Mission | null
  faiteLe: number | null
}

function lireLigneDeMission(r: Record<string, unknown>): LigneDeMission {
  let mission: Mission | null = null
  try {
    mission = lireLaMission(JSON.parse(String(r.mission)))
  } catch {
    // Illisible, elle se tait : sa ligne garde ce qu'elle a payé, faite ou non.
  }
  return { jour: String(r.jour), rang: Number(r.rang), mission, faiteLe: r.faite_le == null ? null : Number(r.faite_le) }
}

/**
 * Ce que la base garde de ses soins (`shared/soins.ts`), lu d'un aller-retour
 * pour sa page : `core/soins.ts` en dérive ses envies, sa complicité, ses
 * trouvailles et ses jardins.
 */
export interface LignesDesSoins {
  /** Le jardin de chacun de ses compagnons, tel qu'il est écrit. */
  jardins: Map<string, Record<string, string>>
  /** Ses envies comblées du jour lu. */
  envies: { compagnon: string; envie: string }[]
  /** Tous ses cadeaux ouverts, du plus ancien au plus récent. */
  cadeaux: { compagnon: string; jour: string; objet: string; grand: boolean }[]
  /** Son record à la cueillette, compagnon par compagnon. */
  records: Map<string, number>
  /** Ses parties à trois étoiles, tous compagnons confondus. */
  troisEtoiles: number
  /** L'heure de sa dernière partie : la suivante l'attend. */
  derniereCueillette: number | null
}

/** Un jardin écrit en JSON, relu : une place vers une clé, rien d'autre — ce qui ne se lit pas se tait. */
function lireLeJardin(brut: unknown): Record<string, string> {
  if (typeof brut !== 'string' || brut === '') return {}
  try {
    const v: unknown = JSON.parse(brut)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string'))
  } catch {
    return {}
  }
}

/** Ce que la mémoire garde de chacun de ses compagnons : sa plus haute forme, les paliers de sa niche, et ce qu'il en a réglé. */
interface SienEnMemoire {
  rang: number
  nom: string | null
  /** La forme qu'il montre dans sa niche, d'avant sa plus haute, ou sa métamorphose (`MONTREE_DE_LA_METAMORPHOSE`) ; null : la plus haute. */
  montree: number | null
  /** Les paliers de sa niche atteints avec lui (`PALIERS_DE_LA_NICHE`), de 0 à 4 : ils ne font que monter. Absent, aucun. */
  paliers?: number
  /** Ses ornements réglés autrement que d'office (`{ guirlande: 'cache' }`) ; absent ou vide : tous montrés, peints. */
  ornements?: ReglageDesOrnements
}

/** Une ligne de `profile_compagnons`, rangée avec ses compagnons : un compagnon que le catalogue ne connaît plus ne se garde pas. */
function lireCompagnon(siens: Map<CleDeCompagnon, SienEnMemoire> | undefined, r: Record<string, unknown>) {
  const c = compagnonDuCatalogue(String(r.compagnon))
  if (!siens || !c) return
  const rang = Math.max(0, Math.min(c.formes.length - 1, Number(r.rang) || 0))
  const montree = r.montree == null ? null : Number(r.montree)
  // Sa plus haute, ou une forme qu'il n'a pas : ce n'est plus un choix. Sa
  // métamorphose, si, à sa forme ultime : elle ne se montre que tant que
  // l'Éclat brille sur lui (`formeDansLaNiche`), que ce démarrage n'a peut-être
  // pas encore lu — et revient avec lui.
  const choisie = montree !== null && Number.isInteger(montree) && ((montree >= 0 && montree < rang) || (montree === MONTREE_DE_LA_METAMORPHOSE && !!c.lumiere && rang >= c.lumiere.rang))
  siens.set(c.key, {
    rang,
    nom: typeof r.nom === 'string' && r.nom ? r.nom : null,
    montree: choisie ? montree : null,
    paliers: Math.max(0, Math.min(PALIERS_DE_LA_NICHE.length, Math.floor(Number(r.paliers) || 0))),
    ornements: lireLesOrnements(r.ornements),
  })
}

/** Le nom qu'il donne à un compagnon : nettoyé comme un prénom, plus court ; vide, il n'en a plus. */
function nomDeCompagnon(brut: unknown): string | null {
  return tronquer(cleanName(brut), NOM_D_UN_COMPAGNON_MAX).trim() || null
}

/** Les prénoms qu'une recherche parcourt (`chercher`), relus au plus une fois la minute. */
const ANNUAIRE_GARDE_MS = 60_000

/** La rareté de chaque badge (`populationBadges`), relue au plus toutes les dix minutes : elle bouge lentement. */
const POPULATION_GARDEE_MS = 10 * 60_000

/** Un an : un invité ne doit pas avoir à se reconnecter d'une fête à l'autre. */
const SESSION_MS = 365 * 24 * 3600 * 1000
const SLIDE_EVERY_MS = 7 * 24 * 3600 * 1000

/**
 * « En ligne » : passé ces cinq dernières minutes — une page, une partie,
 * toute requête qui dit son profil (`sessionProfileId`). La feuille des amis
 * le montre entre amis réciproques seulement (`CampagneStore.amisDeLaFeuille`) :
 * on ajoute n'importe qui par son prénom, sans qu'il accepte, et un inconnu
 * guetterait sinon quand il se connecte.
 */
export const EN_LIGNE_MS = 5 * 60_000

const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

/** L'identifiant d'une session : l'empreinte de son jeton — ce qu'on en retient ailleurs, jamais le jeton. */
export const idDeSession = (token: string): string => fingerprint(token)

/**
 * L'alphabet du code de secours : ni I, ni L, ni O, ni U — on le recopie à la
 * main depuis une capture d'écran, et ces quatre-là se confondent avec 1, 0
 * et V. Seize caractères font quatre-vingts bits, largement de quoi.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'

function newRecoveryCode(): string {
  const bytes = randomBytes(16)
  const chars = [...bytes].map(b => ALPHABET[b % ALPHABET.length])
  return [0, 4, 8, 12].map(i => chars.slice(i, i + 4).join('')).join('-')
}

/** Ce que l'utilisateur tape, tel qu'on le compare : sans tirets ni casse. */
const normalizeRecovery = (raw: unknown) =>
  String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Relit le détail d'une soirée.
 *
 * Trois générations de lignes : les toutes premières ne portaient que le gain
 * de l'ancien barème (présence, réponses, justesse, podium, quiz) ; les
 * suivantes y ajoutaient un relevé de quatre chiffres ; celles du barème au
 * mérite (`v` ≥ 2) portent le relevé complet. Une ligne d'avant se relit en
 * relevé complet, les chiffres qu'elle n'avait pas à zéro — mieux que de
 * perdre une soirée de carrière.
 *
 * Le format se reconnaît à `v ≥ 2`, pas à la version du jour : quand le
 * barème change, une ligne de la veille lue comme « l'ancien barème » perdait
 * ses catégories, ses séries — et l'Éclat, qui se décide sur son gain, se
 * tirait une seconde fois.
 */
export function decodeDetail(raw: string): { v: number; gain: GainSoiree; releve: ReleveSoiree } {
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { v: 0, gain: gainVide(), releve: releveVide() }
  }
  if (typeof parsed?.v === 'number' && parsed.v >= VERSION_RELEVE_COMPLET) {
    return {
      v: parsed.v,
      gain: { ...gainVide(), ...parsed.gain },
      releve: { ...releveVide(), ...parsed.releve, categories: { ...(parsed.releve?.categories ?? {}) } },
    }
  }
  // L'ancien barème : 1 par réponse, 2 par bonne réponse, 60/40/25 pour le
  // podium, 15 par quiz gagné.
  const ancien = parsed?.gain ?? parsed ?? {}
  const vieux = parsed?.releve
  const releve = releveVide()
  releve.reponses = Number(vieux?.reponses ?? ancien.reponses ?? 0)
  releve.qcm = releve.reponses
  releve.questions = releve.reponses
  releve.justes = Number(vieux?.justes ?? Math.round(Number(ancien.justesse ?? 0) / 2))
  releve.rang = Number(vieux?.rang ?? (Number(ancien.podium) > 0 ? [60, 40, 25].indexOf(Number(ancien.podium)) + 1 : 0))
  releve.quizGagnes = Number(vieux?.quiz ?? Math.round(Number(ancien.quiz ?? 0) / 15))
  return { v: 1, gain: gainVide(), releve }
}

/**
 * Les bonnes réponses données avec chaque compagnon dans ses soirées qui
 * comptent (`soireeQuiCompte`) : seule la soirée jouée à plusieurs rapporte un
 * confetti, et seul ce qui en rapporte le fait grandir.
 */
function justesDesSoirees(soirees: readonly { gain: GainSoiree; releve: ReleveSoiree }[]): Record<string, number> {
  const justes: Record<string, number> = {}
  for (const s of soirees) {
    if (!soireeQuiCompte(s.gain)) continue
    for (const [c, n] of Object.entries(s.releve.compagnons ?? {})) justes[c] = (justes[c] ?? 0) + (n ?? 0)
  }
  return justes
}

/** La ligne d'expérience d'un profil pour une soirée : remplacée, jamais ajoutée (invariant 10). */
function ligneDeCredit(input: {
  profileId: string
  soireeId: string
  spaceId: string
  gain: GainSoiree
  releve: ReleveSoiree
  xp: number
  /** L'invité que ce profil était ce soir-là ; absent, celui déjà retenu reste. */
  playerId?: string
}) {
  return {
    sql: `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at, joueur_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(profile_id, soiree_id) DO UPDATE SET xp = excluded.xp, detail = excluded.detail,
            joueur_id = COALESCE(excluded.joueur_id, profile_xp.joueur_id)`,
    args: [
      input.profileId,
      input.soireeId,
      input.spaceId,
      input.xp,
      JSON.stringify({ v: VERSION_BAREME, gain: input.gain, releve: input.releve }),
      Date.now(),
      input.playerId ?? null,
    ],
  }
}

/**
 * Une ligne de l'ancien barème, revalorisée au nouveau quand on n'a plus de
 * quoi la recalculer — sa soirée n'est pas dans l'historique. On ne garde
 * que ce que le relevé dit encore : ses réponses et ses bonnes réponses. La
 * présence et les podiums de l'ancien barème s'en vont.
 */
export function revaloriser(releve: ReleveSoiree): { gain: GainSoiree; xp: number } {
  const gain = gainVide()
  gain.reponses = releve.reponses * XP.reponse
  gain.justesse = releve.justes * XP.juste
  return { gain, xp: gain.reponses + gain.justesse }
}

/**
 * Une soirée désignée par son espace et son nom : les noms d'avant
 * l'empreinte de l'espace (`archiveIdOf`) peuvent se répéter d'un espace à
 * l'autre.
 */
export const cleDeSoiree = (spaceId: string, soireeId: string): string => `${spaceId}#${soireeId}`

/** Le rangement des récompenses d'un mois du quiz du jour : la page du calendrier, le champion, le mois complet. */
export const cleDuMois = (mois: string) => `#mois:${mois}`

/** Le rangement des récompenses d'une série de campagne. */
export const cleDeSerie = (serieId: string) => `#campagne:${serieId}`

/** Le rangement des gardiens du Cabinet de curiosités : sa clé fixe vit avec les salles (`shared/cabinet/salles.ts`). */
export { RANGEMENT_DU_CABINET } from '../../../shared/cabinet/salles'

/** Le rangement des récompenses d'un défi de la semaine, sous son lundi : la clôture y range son vainqueur. */
export const cleDuDefi = (semaine: string) => `#defi:${semaine}`

/** L'étiquette d'une saison gagnée, d'où qu'elle vienne : son emoji, que rien n'affiche, et son nom. */
const etiquetteDeSaison = (s: Saison) => ({ emoji: s.emoji, title: `Saison : ${s.nom}` })

/**
 * L'emoji et le titre d'une clé rangée hors d'une soirée, recopiés sur sa
 * ligne comme ceux d'un prix : une étagère se relit des années plus tard,
 * même si un titre a changé entre-temps.
 */
function etiquetteDe(cle: string): { emoji: string; title: string } {
  const h = hautFait(cle)
  if (h) return { emoji: h.emoji, title: h.title }
  const p = palierDe(cle)
  if (p) return { emoji: p.hautFait.emoji, title: titreDePalier(p.hautFait, p.palier) }
  const champion = titreDuChampion(cle)
  if (champion) return { emoji: '🏆', title: champion }
  const page = moisDeLaPage(cle)
  if (page) return { emoji: '📜', title: `Le calendrier : ${PAGES.find(x => x.mois === page)?.nom ?? page}` }
  const d = divin(cle)
  if (d) return { emoji: '✨', title: d.nom }
  const l = legendaireDeLExpedition(cle)
  if (l) return { emoji: '🧭', title: `L’Expédition : ${l.nom}` }
  const g = legendaireDuCabinet(cle)
  if (g) return { emoji: '🏛️', title: `Le Cabinet : ${g.nom}` }
  // Une saison rangée hors du quiz du jour — le Cabinet, sa fête : la même étiquette qu'`accorderSaison` lui donne.
  const s = cle.startsWith('saison:') ? saison(cle) : undefined
  if (s) return etiquetteDeSaison(s)
  return { emoji: '✨', title: cle }
}

/** Une annonce à tous, telle que l'accueil la lit (`qg_annonces`, `shared/annonces.ts`). */
export interface AnnonceATous {
  id: string
  message: string
  /** Ce qu'elle offre à chacun ; 0, un message seul. */
  confettis: number
  le: number
  /** Sa question, tant qu'il n'y a pas répondu et qu'elle est ouverte. */
  question?: QuestionAPoser
}

/**
 * Le don qu'une annonce à tous fait à un profil : son identifiant se déduit
 * des deux. Une annonce rejouée — un second envoi après un délai dépassé —
 * ne donne pas deux fois, et l'accueil reconnaît, parmi ses dons, ceux que
 * l'annonce dit déjà : sans ça, il lisait le même cadeau deux fois.
 */
const donDeLAnnonce = (annonce: string, profil: string) => `annonce:${annonce}:${profil}`
/** Le don d'une réponse à la question d'une annonce : une par profil, rejouée elle ne donne pas deux fois. */
const donDeLaReponse = (annonce: string, profil: string) => `annonce-reponse:${annonce}:${profil}`
const estUnDonDAnnonce = (don: string) => don.startsWith('annonce:') || don.startsWith('annonce-reponse:')

/** L'identifiant d'une annonce, tiré par la page qui l'envoie : de quoi la reconnaître si elle repart. */
const ID_D_ANNONCE = /^[0-9a-z-]{8,40}$/i

const COLONNES_D_UNE_ANNONCE = 'id, message, confettis, destinataires, created_at, retiree_le'
const annonceDuQg = (r: Row, question: QuestionAuQg | null = null): AnnonceAuQg => ({
  id: String(r.id),
  question,
  message: String(r.message),
  confettis: Number(r.confettis),
  destinataires: Number(r.destinataires),
  le: Number(r.created_at),
  retireeLe: r.retiree_le == null ? null : Number(r.retiree_le),
})

export class ProfileStore {
  private client: Client
  private profiles = new Map<string, ProfileRec>()
  private sessions = new Map<string, ProfileSessionRec>()
  /**
   * Quand chaque profil est passé pour la dernière fois (`enLigne`), en
   * mémoire seulement : rien ne s'écrit à chaque requête, et un redémarrage
   * l'oublie — personne n'y est « en ligne » d'avant.
   */
  private vus = new Map<string, number>()
  /** Les emojis éclatés, par profil — chargés avec le profil. */
  private eclats = new Map<string, Set<string>>()
  /**
   * Ceux qu'il a éteints : l'avatar a éclaté pour lui, il le garde, mais porte
   * sa version d'origine. Chargés avec les éclats ; seule l'apparence les
   * lit — la collection, la carrière et ses paliers comptent tout ce qui a
   * éclaté.
   */
  private eteints = new Map<string, Set<string>>()
  /**
   * Ses Éclats en réserve (`PREFIXE_DE_LA_RESERVE`) : chaque ligne
   * `reserve:<uid>` de `profile_eclats`, tenue à part des Éclats éclatés —
   * `eclats` ne compte, ne montre et ne fait briller que ce qui a éclaté.
   * Chargée avec eux ; une entrée absente vaut zéro.
   */
  private reserves = new Map<string, Set<string>>()
  /**
   * Ses récompenses rangées, par profil : chaque clé d'étagère et le nombre de
   * soirées où elle est tombée. Chargées avec le profil, tenues à jour à
   * chaque écriture : les avatars légendaires qu'il a débloqués s'en
   * déduisent, et l'instantané qui part à toute la salle les lit sans
   * aller-retour.
   */
  private recompenses = new Map<string, Map<string, number>>()
  /** Son étagère (`etagereDe`), par la table de ses récompenses qu'elle a lue : une écriture qui les recompte en pose une neuve. */
  private etageres = new WeakMap<ReadonlyMap<string, number>, Promise<readonly Omit<BadgePorte, 'porteurs' | 'rarete'>[]>>()
  /**
   * Ses compagnons achetés, le rang de la plus haute forme atteinte par
   * chacun — jamais perdue —, son nom et la forme qu'il montre dans sa niche.
   * Chargés avec le profil : l'instantané de la salle lit la forme qu'il porte
   * sans aller-retour (`legendairePorte`).
   */
  private compagnons = new Map<string, Map<CleDeCompagnon, SienEnMemoire>>()
  /**
   * Les bonnes réponses de ses soirées qui comptent, compagnon par compagnon
   * (`ReleveSoiree.compagnons`) : ce que la croissance de ses compagnons lit de
   * ses soirées (`compagnonsDe`). Elle relisait tout son historique — une ligne
   * de `profile_xp` par soirée jouée — à chaque fin d'une partie du solo, un
   * compagnon dans la niche : dix fois par jour au Cabinet, un aller-retour en
   * série de plus sur le bilan, et une lecture qui grandit avec ses soirées (la
   * revue de sobriété du 25 octobre 2026). Gardées tant qu'aucune ligne de ses
   * soirées ne change : chaque écriture de l'une d'elles les oublie
   * (`oublierSesSoirees`), une fois écrite — une lecture partie avant elle s'en
   * va avec. Une soirée créditée par l'autre serveur d'une mise en ligne ne s'y
   * voit qu'à la suivante d'ici, ou au réveil : un compagnon qui aurait dû
   * grandir grandit alors, rien ne se perd (son rang ne fait que monter).
   */
  private justesDesSoireesGardees = new Map<string, Promise<Readonly<Record<string, number>>>>()
  /**
   * Ce que ses coffres de la semaine lui ont donné (`fond:dragon`,
   * `gerbe:papillons`, `theme:jungle`…), par profil. Chargé avec le profil :
   * un fond ou une gerbe du trésor se lit sans aller-retour — la gerbe part
   * avec son profil léger, le fond se vérifie quand il le porte.
   */
  private tresors = new Map<string, Set<string>>()
  /**
   * Les fonds des savoirs qu'il a achetés (`profile_fonds`), par profil.
   * Chargés avec le profil, comme son trésor : le fond qu'il porte se
   * vérifie sans aller-retour.
   */
  private fondsAchetes = new Map<string, Set<string>>()
  /**
   * Les légendaires qu'il avait gagnés avant que leurs règles se durcissent,
   * avec la règle d'alors : il les garde tant qu'elle tient. Écrits au
   * démarrage qui durcit une règle (`DURCISSEMENTS`), et tous chargés au
   * démarrage — ils ne bougent plus ensuite.
   */
  private acquis = new Map<string, Map<string, Condition>>()
  /**
   * Les niveaux qu'il avait atteints sur une courbe d'avant, quand elle s'est
   * durcie : il les garde tant que cette courbe les lui donne encore. Écrits
   * au démarrage qui durcit la courbe (`COURBES_D_AVANT`), et tous chargés au
   * démarrage — ils ne bougent plus ensuite.
   */
  private gardes = new Map<string, NiveauGarde[]>()

  /**
   * Ce que le quiz du jour compte pour ses paliers (`JourStore.statsDuJour`),
   * branché au démarrage : le quiz du jour dépend des profils, pas l'inverse.
   * Sans lui, une carrière n'a pas de quiz du jour.
   */
  statsDuJour?: (profileId: string) => Promise<StatsDuJour>

  /**
   * Un profil suspendu ou réactivé : le quiz du jour recompte le premier
   * quart de chacun, qui ne compte pas les suspendus (`JourStore.suspensionChangee`,
   * branché au démarrage comme `statsDuJour`).
   */
  suspensionChangee?: () => void

  /**
   * A-t-il gagné le quiz du jour d'hier (`JourStore.laureats`) ? Branché au
   * démarrage, comme `statsDuJour`, et lu en mémoire : il sert à chaque
   * diffusion à toute la salle.
   */
  laurierDe?: (profileId: string) => boolean

  /**
   * Le mois dont il est le champion, s'il l'est du mois dernier
   * (`JourStore.champions`) : sa carte le dit tout le mois suivant, et l'écran
   * commun le salue quand il entre dans une soirée. Lu en mémoire, comme le
   * laurier.
   */
  championDe?: (profileId: string) => string | null

  /**
   * A-t-il fini premier du défi de la semaine passée, en campagne
   * (`CampagneStore.vainqueursDuDefi`) ? Branché au démarrage, lu en
   * mémoire comme le laurier du jour : le laurier d'argent suit son prénom
   * toute la semaine.
   */
  argentDe?: (profileId: string) => boolean

  /**
   * L'allure de son laurier : ses victoires, toutes comptées (`hf:laurier`,
   * une ligne par victoire), le font grandir — vert, d'or, serti, étoilé.
   * Il vient de gagner : au moins le premier.
   */
  niveauDuLaurierDe(profileId: string): NiveauDeLaurier {
    return niveauDuLaurier(Math.max(1, this.recompensesOf(profileId).get('hf:laurier') ?? 0))
  }

  /**
   * Le laurier qui suit son prénom (`LaurierPorte`) : celui du quiz du jour
   * d'hier, sinon l'argent du défi de la semaine passée — le jour passe
   * devant, il ne dure qu'un jour.
   */
  laurierPorte(profileId: string): LaurierPorte | undefined {
    if (this.laurierDe?.(profileId)) return this.niveauDuLaurierDe(profileId)
    return this.argentDe?.(profileId) ? 'argent' : undefined
  }

  /**
   * Ce que le quiz du jour sait de lui (`JourStore.savoirDe`) — ses bonnes
   * réponses par catégorie, la base de sa précision —, branché au démarrage
   * comme `statsDuJour` : ses écussons, « Ma carrière » et sa précision, avec
   * les soirées et la campagne (`savoirHorsSoirees`). Ses catégories
   * ouvraient aussi les portraits des branches avec celles des soirées,
   * jusqu'aux sentiers — la reprise les relit une fois
   * (`core/repriseDesPortraits.ts`).
   */
  savoirDuJour?: (profileId: string) => Promise<Savoir>

  /**
   * Ce que la campagne sait de lui — séries, épreuves des sentiers, défis
   * (`CampagneStore.savoirDe`) : ses écussons, « Ma carrière » et sa
   * précision, avec les soirées et le quiz du jour. Branché au démarrage
   * comme `campagneDuProfil`.
   */
  savoirDeCampagne?: (profileId: string) => Promise<Savoir>

  /**
   * Les paliers validés de chacun de ses sentiers (`CampagneStore.paliersDe`),
   * branchés au démarrage : ils ouvrent ses portraits et ses titres de
   * maître. Les sentiers vivent dans la campagne, qui dépend des profils.
   */
  paliersDesSentiers?: (profileId: string) => Promise<Paliers>

  /**
   * Ses bonnes réponses au quiz du jour, toutes parties comprises
   * (`JourStore.justesDe`) : ses confettis du quiz du jour. Branchées au
   * démarrage comme `statsDuJour`.
   */
  justesDuJour?: (profileId: string) => Promise<number>

  /**
   * Ce que la campagne dit de lui, d'une seule lecture (`CampagneStore.duProfil`) :
   * ses confettis de campagne — un par bonne réponse, comme au quiz du jour,
   * et ce que paient les étoiles de ses sentiers (`CONFETTIS_DES_ETOILES`) et
   * les ligues de ses duels, des choix de produit dits avec la campagne —, ses
   * paliers des sentiers et sa cote. Le solde lisait ses paliers à part, pour
   * ses maîtres. Branchée au démarrage comme `justesDuJour`.
   */
  campagneDuProfil?: (profileId: string) => Promise<CampagneDuProfil>

  /**
   * Ses bonnes réponses du quiz du jour et de la campagne données en portant
   * chaque compagnon (`JourStore.compagnonsDe`, `CampagneStore.compagnonsDe`) :
   * avec celles de ses soirées, elles le font grandir (`compagnonsDe`).
   * Branchées au démarrage comme `justesDuJour`.
   */
  compagnonsDuJour?: (profileId: string) => Promise<Record<string, number>>
  compagnonsDeCampagne?: (profileId: string) => Promise<Record<string, number>>

  /** Ce que sa campagne compte pour ses paliers (`CampagneStore.statsDe`) : les jauges de sa page. */
  statsDeCampagne?: (profileId: string) => Promise<StatsDeCampagne>

  /**
   * Les rencontres de l'expédition s'ouvrent sur ce serveur (`rencontresOuvertes`) :
   * les trophées réservés à elles (`montreParLeServeur` — L'Explorateur) ne
   * partent qu'alors dans la page du profil et la loge. Posé au démarrage
   * comme `statsDeCampagne` ; un serveur qui ne le dit pas les tait.
   */
  rencontres = false

  /**
   * Sa ligue des duels, sa cote et ses bordures de ligue (`CampagneStore.coteDe`),
   * pour sa carte et pour la bordure qu'il choisit ; null tant qu'il n'a fini
   * aucun duel classé.
   */
  duelsDe?: (profileId: string) => Promise<CoteDesDuels | null>

  /**
   * Ses bordures de ligue, de mémoire (`CampagneStore.borduresEnMemoire`) :
   * l'instantané de la salle les lit à chaque diffusion, sans jamais
   * attendre la base — undefined tant qu'elles ne sont pas relues.
   */
  borduresDe?: (profileId: string) => readonly BordureDeLigue[] | undefined

  /**
   * Les faire relire, en fond, une fois (`CampagneStore.connaitreLesBordures`) :
   * un profil que la salle ou un classement montre avant qu'elles soient
   * connues. Sa salle se rediffuse quand elles arrivent.
   */
  connaitreSesBordures?: (profileId: string) => void

  /** Le mois du quiz du jour (`2026-10`), à son horloge, et ses jours joués ce mois-ci : sa page du calendrier. */
  moisDuJour?: () => string
  joursDuMois?: (profileId: string) => Promise<number>

  /**
   * Les soirées qui se jouent encore, tous espaces confondus (`cleDeSoiree`),
   * branchées au démarrage sur la base locale — celle dont la clôture est en
   * cours compte pour close, comme à une clôture (`soireesEnCoursAilleurs`).
   * Un Éclat tiré au quiz du jour ou au défi n'y compte pas leurs Éclats
   * pour ses paliers (`tirerUnEclat`).
   */
  soireesEnCours?: () => ReadonlySet<string>

  /**
   * Les achats en cours, un par profil : deux achats partis ensemble — deux
   * onglets, un double toucher — liraient le même solde, et dépenseraient
   * deux fois les mêmes confettis.
   */
  private achatsEnCours = new Map<string, Promise<unknown>>()

  constructor(url: string, authToken?: string) {
    this.client = clientDistant(url, authToken)
  }

  /** Son quiz du jour, pour sa carrière : rien plutôt qu'une page en panne si la base se tait. */
  private async statsDuJourDe(profileId: string): Promise<StatsDuJour> {
    try {
      return (await this.statsDuJour?.(profileId)) ?? AUCUN_JOUR
    } catch (e) {
      console.error('[profil] quiz du jour illisible pour la carrière :', e)
      return AUCUN_JOUR
    }
  }

  async init() {
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS profiles (
           id            TEXT PRIMARY KEY,
           login         TEXT NOT NULL UNIQUE,
           name          TEXT NOT NULL,
           avatar        TEXT NOT NULL,
           finition      TEXT NOT NULL DEFAULT 'auto',
           password_hash TEXT NOT NULL,
           recovery_hash TEXT NOT NULL,
           xp            INTEGER NOT NULL DEFAULT 0,
           created_at    INTEGER NOT NULL,
           last_seen_at  INTEGER,
           disabled_at   INTEGER
         )`,
        // Les inscriptions depuis minuit, que le QG relit (`activiteDepuis`) : sans index, tous les profils à chaque fois.
        `CREATE INDEX IF NOT EXISTS idx_profiles_cree ON profiles(created_at)`,
        `CREATE TABLE IF NOT EXISTS profile_sessions (
           id           TEXT PRIMARY KEY,
           profile_id   TEXT NOT NULL,
           created_at   INTEGER NOT NULL,
           expires_at   INTEGER NOT NULL,
           last_seen_at INTEGER NOT NULL,
           user_agent   TEXT NOT NULL DEFAULT ''
         )`,
        `CREATE INDEX IF NOT EXISTS idx_profile_sessions_profile ON profile_sessions(profile_id)`,
        // Une ligne par profil et par soirée. La clé primaire rend la
        // consolidation idempotente : archiver deux fois la même soirée
        // recalcule au lieu de créditer deux fois.
        `CREATE TABLE IF NOT EXISTS profile_xp (
           profile_id TEXT NOT NULL,
           soiree_id  TEXT NOT NULL,
           space_id   TEXT NOT NULL,
           xp         INTEGER NOT NULL,
           detail     TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (profile_id, soiree_id)
         )`,
        // Lue par soirée — qui l'a jouée avec lui (`compagnonsDeSoiree`) — : sans index, la table entière à chaque lecture.
        `CREATE INDEX IF NOT EXISTS idx_profile_xp_soiree ON profile_xp(soiree_id, space_id)`,
        // Lue depuis minuit par le QG, à chaque relecture (`activiteDepuis`) : sans index, la table entière.
        `CREATE INDEX IF NOT EXISTS idx_profile_xp_quand ON profile_xp(created_at)`,
        // Une ligne par badge ET par soirée où il est tombé : la clé rend la
        // consolidation idempotente, et compter les lignes donne gratuitement
        // le nombre de fois où un prix a été décroché.
        `CREATE TABLE IF NOT EXISTS profile_badges (
           profile_id TEXT NOT NULL,
           badge      TEXT NOT NULL,
           soiree_id  TEXT NOT NULL,
           space_id   TEXT NOT NULL,
           emoji      TEXT NOT NULL,
           title      TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (profile_id, badge, soiree_id)
         )`,
        `CREATE INDEX IF NOT EXISTS idx_profile_badges_badge ON profile_badges(badge)`,
        `CREATE TABLE IF NOT EXISTS profile_eclats (
           profile_id TEXT NOT NULL,
           avatar     TEXT NOT NULL,
           soiree_id  TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (profile_id, avatar)
         )`,
        // Les Éclats tombés ces trente jours, au QG (« Éclats et légendaires ») : lus par leur date, sans parcourir la table.
        'CREATE INDEX IF NOT EXISTS idx_profile_eclats_quand ON profile_eclats(created_at)',
        // Les niveaux atteints sur une courbe d'avant, quand elle s'est durcie.
        `CREATE TABLE IF NOT EXISTS profile_niveaux (
           profile_id TEXT NOT NULL,
           pas        INTEGER NOT NULL,
           niveau     INTEGER NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (profile_id, pas)
         )`,
        // Les légendaires gagnés avant que leurs règles se durcissent, avec
        // la règle sous laquelle ils étaient tombés, en JSON.
        `CREATE TABLE IF NOT EXISTS profile_legendaires (
           profile_id TEXT NOT NULL,
           legendaire TEXT NOT NULL,
           regle      TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (profile_id, legendaire)
         )`,
        `CREATE TABLE IF NOT EXISTS meta (
           key   TEXT PRIMARY KEY,
           value TEXT NOT NULL
         )`,
        // Les thèmes achetés en confettis, une ligne par thème, jamais
        // effacée : un solde qui passe sous zéro — une soirée retirée — ne
        // reprend rien. Le prix payé s'écrit avec : un thème qui changerait
        // de rareté ne rembourserait ni ne referait payer personne.
        `CREATE TABLE IF NOT EXISTS profile_achats (
           profile_id TEXT NOT NULL,
           theme      TEXT NOT NULL,
           prix       INTEGER NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (profile_id, theme)
         )`,
        // Les achats des trente derniers jours, au QG (`economieDepuis`) : lus par leur date, comme les vies et les sabliers.
        'CREATE INDEX IF NOT EXISTS idx_profile_achats_quand ON profile_achats(created_at)',
        // Les vies des sentiers achetées en confettis, un achat par ligne,
        // jamais effacée, avec ce qu'il a coûté : comme un thème, un achat ne
        // se reprend pas, et un prix changé ne refait payer personne. Les
        // vies qui restent se relisent dans le journal des épreuves
        // (`CampagneStore.vies`).
        `CREATE TABLE IF NOT EXISTS profile_vies (
           id         TEXT PRIMARY KEY,
           profile_id TEXT NOT NULL,
           nombre     INTEGER NOT NULL,
           prix       INTEGER NOT NULL,
           created_at INTEGER NOT NULL
         )`,
        'CREATE INDEX IF NOT EXISTS idx_profile_vies ON profile_vies(profile_id)',
        // Les vies des trente derniers jours, au QG : lues par leur date, sans parcourir la table.
        'CREATE INDEX IF NOT EXISTS idx_profile_vies_quand ON profile_vies(created_at)',
        // Les sabliers de la série du quiz du jour, achetés en confettis, un
        // par ligne, jamais effacée : comme une vie, un achat ne se reprend
        // pas. Ceux qui restent se relisent des jours joués
        // (`serieAvecSabliers`) — rien ne se compte à côté.
        `CREATE TABLE IF NOT EXISTS profile_sabliers (
           id         TEXT PRIMARY KEY,
           profile_id TEXT NOT NULL,
           prix       INTEGER NOT NULL,
           created_at INTEGER NOT NULL
         )`,
        'CREATE INDEX IF NOT EXISTS idx_profile_sabliers ON profile_sabliers(profile_id)',
        // Les sabliers du mois, au QG : lus par leur date, sans parcourir la table.
        'CREATE INDEX IF NOT EXISTS idx_profile_sabliers_quand ON profile_sabliers(created_at)',
        // Les compagnons achetés en confettis (`shared/compagnons.ts`), une
        // ligne par compagnon, jamais effacée, avec ce qu'il a coûté — comme
        // un thème. Et le rang de la plus haute forme qu'il a atteinte : ses
        // bonnes réponses se relisent dans les journaux, mais une forme
        // atteinte ne se perd jamais, même quand une soirée retirée en
        // reprend (`compagnonsDe`). Son nom, la forme qu'il montre dans sa
        // niche, les paliers de sa niche et ses ornements viennent après coup
        // (`nom`, `montree`, `paliers`, `ornements` : plus bas).
        `CREATE TABLE IF NOT EXISTS profile_compagnons (
           profile_id TEXT NOT NULL,
           compagnon  TEXT NOT NULL,
           prix       INTEGER NOT NULL,
           rang       INTEGER NOT NULL DEFAULT 0,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (profile_id, compagnon)
         )`,
        'CREATE INDEX IF NOT EXISTS idx_profile_compagnons_quand ON profile_compagnons(created_at)',
        // Les fonds des savoirs achetés en confettis (`shared/fonds.ts`), une
        // ligne par fond, jamais effacée, avec ce qu'il a coûté — comme un
        // thème : un prix changé ne rembourse ni ne refait payer personne.
        `CREATE TABLE IF NOT EXISTS profile_fonds (
           profile_id TEXT NOT NULL,
           fond       TEXT NOT NULL,
           prix       INTEGER NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (profile_id, fond)
         )`,
        'CREATE INDEX IF NOT EXISTS idx_profile_fonds_quand ON profile_fonds(created_at)',
        // Les confettis que l'administrateur offre, un don par ligne, jamais
        // effacée : comptés dans le solde à chaque lecture (`boutiqueDe`),
        // comme ce qu'il gagne en jouant, et dits une fois sur son accueil.
        `CREATE TABLE IF NOT EXISTS profile_dons (
           id         TEXT PRIMARY KEY,
           profile_id TEXT NOT NULL,
           confettis  INTEGER NOT NULL,
           mot        TEXT,
           created_at INTEGER NOT NULL
         )`,
        'CREATE INDEX IF NOT EXISTS idx_profile_dons ON profile_dons(profile_id)',
        'CREATE INDEX IF NOT EXISTS idx_profile_dons_quand ON profile_dons(created_at)',
        // Les annonces de l'administrateur à tous (`shared/annonces.ts`), une
        // ligne chacune, jamais effacée — retirée, elle se tait. Les confettis
        // qu'elle offre sont des dons, un par profil (`annoncerATous`) : le
        // solde, l'économie et la suppression d'un profil les lisent déjà.
        `CREATE TABLE IF NOT EXISTS qg_annonces (
           id            TEXT PRIMARY KEY,
           message       TEXT NOT NULL,
           confettis     INTEGER NOT NULL,
           destinataires INTEGER NOT NULL,
           created_at    INTEGER NOT NULL,
           retiree_le    INTEGER
         )`,
        // La question qu'une annonce peut poser (`shared/annonces.ts`) : une ligne
        // par annonce qui en pose une, ses choix en JSON ; close, elle ne se montre
        // plus aux joueurs et ses résultats restent. Les réponses : une par profil
        // et par annonce, la clé primaire en fait un vote unique.
        `CREATE TABLE IF NOT EXISTS qg_annonce_questions (
           annonce_id TEXT PRIMARY KEY,
           sorte      TEXT NOT NULL,
           choix      TEXT NOT NULL,
           recompense INTEGER NOT NULL,
           close_le   INTEGER
         )`,
        `CREATE TABLE IF NOT EXISTS qg_annonce_reponses (
           annonce_id TEXT NOT NULL,
           profile_id TEXT NOT NULL,
           reponse    TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (annonce_id, profile_id)
         )`,
        'CREATE INDEX IF NOT EXISTS idx_qg_annonce_reponses_profil ON qg_annonce_reponses(profile_id)',
        // Celles du dernier mois, lues avec les dons de chaque accueil : par leur date, sans parcourir la table.
        'CREATE INDEX IF NOT EXISTS idx_qg_annonces_quand ON qg_annonces(created_at)',
        // Ce qu'il a déjà vu dans sa loge, pièce par pièce (`VusDeLaLoge`, en
        // JSON) : la pastille rouge de « Profil » compte ce qu'il a et qui n'y
        // est pas. Retenu sur le téléphone jusqu'au 14 octobre 2026, ce qu'on
        // regardait sur l'ordinateur se redisait nouveau sur le téléphone.
        `CREATE TABLE IF NOT EXISTS profile_loge_vus (
           profile_id TEXT PRIMARY KEY,
           vus        TEXT NOT NULL,
           retenu_le  INTEGER NOT NULL
         )`,
        // Ses missions du jour (`shared/missions.ts`) : les trois tirées à sa
        // première visite du jour, figées (`mission`, en JSON), et la ligne
        // des trois (`rang` 3, `mission` vide) — le tampon de la semaine.
        // Seul s'écrit ce qui est fait (`faite_le`), jamais repris : le solde
        // et l'expérience se relisent de ces lignes, l'avancement des
        // journaux de chaque mode.
        `CREATE TABLE IF NOT EXISTS profile_missions (
           profile_id TEXT NOT NULL,
           jour       TEXT NOT NULL,
           rang       INTEGER NOT NULL,
           mission    TEXT NOT NULL,
           tiree_le   INTEGER NOT NULL,
           faite_le   INTEGER,
           PRIMARY KEY (profile_id, jour, rang)
         )`,
        // Les missions faites ces trente jours, au QG (`economieDepuis`) : lues par leur date, sans parcourir la table.
        'CREATE INDEX IF NOT EXISTS idx_profile_missions_faite ON profile_missions(faite_le)',
        // Ses coffres de la semaine ouverts (`shared/coffre.ts`), un par
        // semaine, jamais modifiés : le tirage se fait une fois, à
        // l'ouverture, et le coffre rouvert redonne ce qu'il a donné. Un thème
        // ou un compagnon s'écrit aussi dans sa table, à prix nul ; un fond ou
        // une gerbe du trésor ne vit qu'ici.
        `CREATE TABLE IF NOT EXISTS profile_coffres (
           profile_id TEXT NOT NULL,
           semaine    TEXT NOT NULL,
           tampons    INTEGER NOT NULL,
           rang       TEXT NOT NULL,
           rarete     TEXT NOT NULL,
           objet      TEXT NOT NULL,
           confettis  INTEGER NOT NULL DEFAULT 0,
           ouvert_le  INTEGER NOT NULL,
           PRIMARY KEY (profile_id, semaine)
         )`,
        'CREATE INDEX IF NOT EXISTS idx_profile_coffres_quand ON profile_coffres(ouvert_le)',
        // Ses soins (`shared/soins.ts`, la maquette validée le 20 octobre
        // 2026) : ses envies du jour comblées, une ligne par envie, par jour
        // et par compagnon, jamais effacée — seul s'écrit ce qui est fait,
        // comme une mission.
        `CREATE TABLE IF NOT EXISTS profile_envies (
           profile_id TEXT NOT NULL,
           compagnon  TEXT NOT NULL,
           jour       TEXT NOT NULL,
           envie      TEXT NOT NULL,
           faite_le   INTEGER NOT NULL,
           PRIMARY KEY (profile_id, compagnon, jour, envie)
         )`,
        // Ses cadeaux ouverts, un par jour et par compagnon, jamais modifiés :
        // le tirage se fait une fois, et rouvert, le cadeau redonne ce qu'il
        // a donné. Sa complicité les compte, et ses trouvailles s'en relisent
        // (`shared/trouvailles.ts`) — rien ne se compte à côté.
        `CREATE TABLE IF NOT EXISTS profile_cadeaux (
           profile_id TEXT NOT NULL,
           compagnon  TEXT NOT NULL,
           jour       TEXT NOT NULL,
           objet      TEXT NOT NULL,
           grand      INTEGER NOT NULL DEFAULT 0,
           ouvert_le  INTEGER NOT NULL,
           PRIMARY KEY (profile_id, compagnon, jour)
         )`,
        // Ses parties de cueillette, une ligne chacune : son record avec
        // chaque compagnon, ses parties à trois étoiles — l'étoile filante en
        // demande dix —, et l'heure de la dernière, que la suivante attend.
        `CREATE TABLE IF NOT EXISTS profile_cueillettes (
           profile_id TEXT NOT NULL,
           compagnon  TEXT NOT NULL,
           jouee_le   INTEGER NOT NULL,
           score      INTEGER NOT NULL,
           PRIMARY KEY (profile_id, jouee_le)
         )`,
      ],
      'write',
    )
    // L'avatar légendaire porté est arrivé avec les hauts faits : une base
    // d'avant n'a pas la colonne. Une panne ici arrête le démarrage, plutôt
    // que de laisser tourner un serveur qui écrirait dans une colonne absente.
    await ajouterColonne(this.client, 'profiles', 'legendaire', 'TEXT')
    // Le titre sous le prénom, et la vitrine qu'on choisit soi-même.
    await ajouterColonne(this.client, 'profiles', 'titre', 'TEXT')
    await ajouterColonne(this.client, 'profiles', 'vitrine', 'TEXT')
    // Le fond de sa carte, qu'on choisit parmi ceux qu'on a gagnés.
    await ajouterColonne(this.client, 'profiles', 'fond', 'TEXT')
    // Le thème de son téléphone, qu'il porte parmi ceux qu'il a.
    await ajouterColonne(this.client, 'profiles', 'theme', 'TEXT')
    // La gerbe de ses bonnes réponses, qu'il choisit parmi celles qu'il a gagnées.
    await ajouterColonne(this.client, 'profiles', 'gerbe', 'TEXT')
    // La bordure de ligue qu'il porte, parmi celles de ses duels.
    await ajouterColonne(this.client, 'profiles', 'bordure', 'TEXT')
    // Le compagnon qu'il installe dans sa niche, parmi ceux qu'il a adoptés.
    await ajouterColonne(this.client, 'profiles', 'niche', 'TEXT')
    // Ce qu'il règle de chacun, dans sa niche : son nom, et la forme qu'il y
    // montre quand ce n'est pas la plus haute (null : la plus haute, qui suit
    // sa croissance).
    await ajouterColonne(this.client, 'profile_compagnons', 'nom', 'TEXT')
    await ajouterColonne(this.client, 'profile_compagnons', 'montree', 'INTEGER')
    // Après sa forme ultime, sa niche s'embellit (`shared/ornements.ts`) : les
    // paliers atteints avec lui — gardés comme son rang, ils ne font que
    // monter — et ce qu'il a réglé de ses ornements, en JSON (null : tous
    // montrés, dessinés).
    await ajouterColonne(this.client, 'profile_compagnons', 'paliers', 'INTEGER')
    await ajouterColonne(this.client, 'profile_compagnons', 'ornements', 'TEXT')
    // Son jardin, autour de sa niche (`shared/trouvailles.ts`) : la trouvaille
    // de chaque place occupée, en JSON (null : rien de posé). Lu par sa page
    // seule, jamais avec le profil : la niche du coin n'en montre rien.
    await ajouterColonne(this.client, 'profile_compagnons', 'jardin', 'TEXT')
    // Quand l'administrateur l'a renommé : son accueil le lui dit, une fois.
    await ajouterColonne(this.client, 'profiles', 'renomme_le', 'INTEGER')
    // L'Éclat qu'il a éteint, pour porter la version d'origine de son avatar.
    await ajouterColonne(this.client, 'profile_eclats', 'eteint', 'INTEGER')
    // Le joueur qu'on était ce soir-là, pour ouvrir SON bilan depuis « Mes
    // soirées » : sans lui, le bilan redemandait « Qui es-tu ? ». Une ligne
    // d'avant la colonne le retrouve dans l'archive (`retenirJoueur`).
    await ajouterColonne(this.client, 'profile_xp', 'joueur_id', 'TEXT')
    await this.garderLesLegendairesAcquis()
    await this.garderLesNiveauxAtteints()
    await this.installerLesNiches()
    for (const r of (await this.client.execute('SELECT profile_id, pas, niveau FROM profile_niveaux')).rows) {
      const garde = { pas: Number(r.pas), niveau: Number(r.niveau) }
      if (!(garde.pas > 0) || !(garde.niveau > 1)) continue
      const id = String(r.profile_id)
      this.gardes.set(id, [...(this.gardes.get(id) ?? []), garde])
    }
    for (const r of (await this.client.execute('SELECT profile_id, legendaire, regle FROM profile_legendaires')).rows) {
      const regle = lireCondition(r.regle)
      if (!regle) continue
      const id = String(r.profile_id)
      let siens = this.acquis.get(id)
      if (!siens) this.acquis.set(id, (siens = new Map()))
      siens.set(String(r.legendaire), regle)
    }
    const now = Date.now()
    await this.client.execute({ sql: 'DELETE FROM profile_sessions WHERE expires_at <= ?', args: [now] })
    // Les sessions seules montent en mémoire : la poignée de main d'un socket
    // ne peut pas attendre un aller-retour vers la base distante.
    const rows = await this.client.execute('SELECT id, profile_id, expires_at, last_seen_at FROM profile_sessions')
    for (const r of rows.rows) {
      this.sessions.set(String(r.id), {
        id: String(r.id),
        profileId: String(r.profile_id),
        expiresAt: Number(r.expires_at),
        lastSeenAt: Number(r.last_seen_at),
      })
    }
  }

  // ── Lecture ─────────────────────────────────────────────────────────────

  /** Le profil s'il est déjà en mémoire — sans aller-retour. */
  cached(id: string): ProfileRec | undefined {
    return this.profiles.get(id)
  }

  /** Le profil, chargé au besoin. Null s'il n'existe pas ou s'il est fermé. */
  async byId(id: string): Promise<ProfileRec | null> {
    const known = this.profiles.get(id)
    if (known) return known.disabledAt ? null : known
    // D'un aller-retour, ses Éclats et ses récompenses avec (`byIds`) : sa
    // fiche, puis ses Éclats, puis ses récompenses en faisaient trois, l'un
    // derrière l'autre, à sa première requête après chaque réveil de
    // l'hébergeur — avant tout ce que sa page avait à lire.
    return (await this.byIds([id]))[0]
  }

  /**
   * Des profils d'un coup, dans l'ordre demandé : ceux qui manquent en
   * mémoire arrivent en un aller-retour par paquet, avec leurs Éclats et
   * leurs récompenses. Chargés un par un — trois allers-retours chacun,
   * huit à la fois —, les deux cents joueurs d'hier faisaient attendre au
   * réveil toute visite du quiz du jour et de l'accueil, sous le verrou de
   * la nuit (12 s à cinq cents joueurs et 50 ms par aller-retour). Null
   * pour un profil inconnu ou fermé.
   */
  async byIds(ids: readonly string[]): Promise<(ProfileRec | null)[]> {
    const manquants = [...new Set(ids)].filter(id => !this.profiles.has(id))
    for (let i = 0; i < manquants.length; i += PROFILS_PAR_PAQUET) {
      const paquet = manquants.slice(i, i + PROFILS_PAR_PAQUET)
      const marques = paquet.map(() => '?').join(', ')
      const [lignes, eclats, badges, compagnons, coffres, fonds] = await this.client.batch(
        [
          { sql: `SELECT * FROM profiles WHERE id IN (${marques})`, args: paquet },
          { sql: `SELECT profile_id, avatar, eteint FROM profile_eclats WHERE profile_id IN (${marques})`, args: paquet },
          {
            sql: `SELECT profile_id, badge, COUNT(*) AS n FROM profile_badges WHERE profile_id IN (${marques}) GROUP BY profile_id, badge`,
            args: paquet,
          },
          { sql: `SELECT profile_id, compagnon, rang, nom, montree, paliers, ornements FROM profile_compagnons WHERE profile_id IN (${marques})`, args: paquet },
          // Dans le même lot : le trésor de ses coffres n'ajoute pas un aller-retour à son premier passage.
          { sql: `SELECT profile_id, objet FROM profile_coffres WHERE profile_id IN (${marques})`, args: paquet },
          { sql: `SELECT profile_id, fond FROM profile_fonds WHERE profile_id IN (${marques})`, args: paquet },
        ],
        'read',
      )
      const eclatsDe = new Map<string, Set<string>>(paquet.map(id => [id, new Set()]))
      const eteintsDe = new Map<string, Set<string>>(paquet.map(id => [id, new Set()]))
      const reservesDe = new Map<string, Set<string>>(paquet.map(id => [id, new Set()]))
      for (const r of eclats.rows) {
        const avatar = String(r.avatar)
        if (estEnReserve(avatar)) {
          reservesDe.get(String(r.profile_id))?.add(avatar)
          continue
        }
        eclatsDe.get(String(r.profile_id))?.add(avatar)
        if (Number(r.eteint) === 1) eteintsDe.get(String(r.profile_id))?.add(avatar)
      }
      const recompensesDe = new Map<string, Map<string, number>>(paquet.map(id => [id, new Map()]))
      for (const r of badges.rows) recompensesDe.get(String(r.profile_id))?.set(String(r.badge), Number(r.n))
      const compagnonsDe = new Map<string, Map<CleDeCompagnon, SienEnMemoire>>(paquet.map(id => [id, new Map()]))
      for (const r of compagnons.rows) lireCompagnon(compagnonsDe.get(String(r.profile_id)), r)
      const tresorsDe = new Map<string, Set<string>>(paquet.map(id => [id, new Set()]))
      for (const r of coffres.rows) tresorsDe.get(String(r.profile_id))?.add(String(r.objet))
      const fondsDe = new Map<string, Set<string>>(paquet.map(id => [id, new Set()]))
      for (const r of fonds.rows) fondsDe.get(String(r.profile_id))?.add(String(r.fond))
      for (const r of lignes.rows) {
        const id = String(r.id)
        // Arrivé en mémoire pendant l'aller-retour — un geste, un renommage —,
        // il garde sa version : la ligne lue avant écraserait l'objet à jour.
        if (this.profiles.has(id)) continue
        this.profiles.set(id, this.lireLigne(r))
        if (!this.eclats.has(id)) {
          this.eclats.set(id, eclatsDe.get(id)!)
          this.eteints.set(id, eteintsDe.get(id)!)
          this.reserves.set(id, reservesDe.get(id)!)
        }
        if (!this.recompenses.has(id)) this.recompenses.set(id, recompensesDe.get(id)!)
        if (!this.compagnons.has(id)) this.compagnons.set(id, compagnonsDe.get(id)!)
        if (!this.tresors.has(id)) this.tresors.set(id, tresorsDe.get(id)!)
        if (!this.fondsAchetes.has(id)) this.fondsAchetes.set(id, fondsDe.get(id)!)
      }
    }
    return ids.map(id => {
      const p = this.profiles.get(id)
      return p && !p.disabledAt ? p : null
    })
  }

  /**
   * Les profils dont le prénom contient ce texte — sans les accents ni la
   * casse : « lea » trouve Léa —, ou dont l'identifiant commence par lui,
   * ceux dont le prénom commence par lui d'abord. Pour défier quelqu'un ou
   * l'ajouter à ses amis (`CampagneStore.chercherDesJoueurs`) : l'appelant
   * écarte les masqués, et ne montre jamais l'identifiant. Les prénoms se
   * relisent au plus une fois la minute — une frappe ne coûte pas une
   * lecture de tous les profils —, et dès qu'un profil naît ou change de
   * prénom ici.
   */
  async chercher(texte: string, limite: number): Promise<ProfileRec[]> {
    const cherche = sansAccent(texte)
    if (!cherche) return []
    const maintenant = Date.now()
    if (!this.annuaire || maintenant - this.annuaire.lu > ANNUAIRE_GARDE_MS) {
      const res = await this.client.execute('SELECT id, name, login FROM profiles WHERE disabled_at IS NULL')
      this.annuaire = { lu: maintenant, lignes: res.rows.map(r => ({ id: String(r.id), nom: sansAccent(String(r.name)), login: String(r.login) })) }
    }
    const trouves = this.annuaire.lignes
      .filter(l => l.nom.includes(cherche) || l.login.startsWith(cherche))
      .sort((a, b) => Number(!a.nom.startsWith(cherche)) - Number(!b.nom.startsWith(cherche)) || a.nom.localeCompare(b.nom))
      .slice(0, limite)
    return (await this.byIds(trouves.map(l => l.id))).filter((p): p is ProfileRec => p !== null)
  }

  /**
   * Ceux qui ont joué ses dernières soirées avec lui — la même soirée du même
   * espace, une ligne d'expérience chacun —, les plus récents d'abord : des
   * joueurs croisés, à défier ou à ajouter (`CampagneStore.joueursCroises`).
   * Seulement les siennes : il était dans la salle, il les a vus. Les lignes à
   * part ne sont pas des soirées (`HORS_LIGNES_A_PART`) : celle du quiz du
   * jour le ferait croiser tout le serveur.
   */
  async compagnonsDeSoiree(profileId: string, limite: number): Promise<string[]> {
    const res = await this.client.execute({
      sql: `SELECT x.profile_id, MAX(x.created_at) AS le
            FROM (SELECT space_id, soiree_id FROM profile_xp WHERE profile_id = ? AND ${HORS_LIGNES_A_PART} ORDER BY created_at DESC LIMIT ?) s
            JOIN profile_xp x ON x.soiree_id = s.soiree_id AND x.space_id = s.space_id
            WHERE x.profile_id <> ?
            GROUP BY x.profile_id ORDER BY le DESC LIMIT ?`,
      args: [profileId, SOIREES_DES_CROISES, profileId, limite],
    })
    return res.rows.map(r => String(r.profile_id))
  }

  async byLogin(login: unknown): Promise<ProfileRec | null> {
    const clean = normalizeLogin(login)
    if (!clean) return null
    for (const p of this.profiles.values()) if (p.login === clean) return p.disabledAt ? null : p
    const rows = await this.client.execute({ sql: 'SELECT * FROM profiles WHERE login = ?', args: [clean] })
    return this.remember(rows.rows[0])
  }

  /** Comme `byLogin`, suspendu compris : la connexion lui dit qu'il l'est. */
  private async parLoginMemeSuspendu(login: unknown): Promise<ProfileRec | null> {
    const clean = normalizeLogin(login)
    if (!clean) return null
    const actif = await this.byLogin(clean)
    if (actif) return actif
    // `byLogin` l'a rangé en mémoire, mais tait un profil suspendu.
    for (const p of this.profiles.values()) if (p.login === clean) return p
    return null
  }

  /**
   * Un identifiant libre, proche de celui qu'on voulait : « camille » pris,
   * on propose « camille2 ».
   *
   * Sans ça, une invitée qui n'y connaît rien reste debout dans le noir
   * devant un refus qu'elle ne sait pas contourner — et le chemin le plus
   * court devient alors « tant pis, je joue sans compte ». Rend une chaîne
   * vide si rien de propre ne se trouve : l'appelant s'en passe.
   */
  async suggestLogin(souhaite: unknown): Promise<string> {
    // On retire un suffixe de chiffres déjà présent : « camille2 » pris, on
    // propose « camille3 », pas « camille22 ».
    const base = normalizeLogin(souhaite).replace(/\d+$/, '').slice(0, 28)
    if (!base) return ''
    for (let n = 2; n <= 99; n++) {
      const essai = `${base}${n}`
      if (isValidLogin(essai) && !(await this.byLogin(essai))) return essai
    }
    return ''
  }

  /** Les emojis qui ont éclaté pour ce profil. */
  eclatsOf(id: string): string[] {
    return [...(this.eclats.get(id) ?? [])]
  }

  /** Ceux qu'il a éteints pour porter leur version d'origine — toujours parmi les siens. */
  eteintsOf(id: string): string[] {
    const siens = this.eclats.get(id)
    return [...(this.eteints.get(id) ?? [])].filter(k => siens?.has(k))
  }

  /** Cet avatar brille-t-il sur lui ? Éclaté pour lui, et pas éteint — un compagnon, sous toutes ses formes (`clesQuiBrillent`). */
  brilleChez(id: string, cle: string): boolean {
    return clesQuiBrillent(this.eclats.get(id) ?? [], cle).some(k => !this.eteints.get(id)?.has(k))
  }

  /** Ses récompenses rangées : chaque clé d'étagère, et le nombre de soirées où elle est tombée. */
  recompensesOf(id: string): ReadonlyMap<string, number> {
    return this.recompenses.get(id) ?? new Map()
  }

  /** Les niveaux qu'il garde d'une courbe d'avant. */
  gardesOf(id: string): NiveauGarde[] {
    return this.gardes.get(id) ?? []
  }

  /** Son niveau — celui qu'il garde d'une courbe d'avant, s'il est plus haut. */
  niveauOf(p: ProfileRec): number {
    return niveauDuProfil(p.xp, this.gardesOf(p.id))
  }

  /** Les avatars légendaires que ce profil a débloqués — ceux d'avant leur durcissement compris. */
  legendairesOf(id: string): string[] {
    return legendairesDebloques(this.recompensesOf(id), this.acquis.get(id))
  }

  /** Ceux que ces paliers, tout juste tombés, lui ont ouverts (voir `legendairesOuvertsPar`). */
  legendairesOuverts(id: string, tombes: readonly string[]): string[] {
    return legendairesOuvertsPar(tombes, this.recompensesOf(id), this.acquis.get(id))
  }

  /** Ce que ses coffres de la semaine lui ont donné (`fond:dragon`…), de mémoire : chargé avec le profil. */
  tresorsOf(id: string): ReadonlySet<string> {
    return this.tresors.get(id) ?? new Set()
  }

  /** Les fonds des savoirs qu'il a achetés, de mémoire : chargés avec le profil. */
  fondsAchetesOf(id: string): ReadonlySet<string> {
    return this.fondsAchetes.get(id) ?? new Set()
  }

  /** Les fonds de carte qu'il peut porter : son niveau, son quiz du jour, ses paliers de carrière, ses maîtres des sentiers, ses coffres, ses achats (`shared/fonds.ts`). */
  fondsOuvertsDe(p: ProfileRec, jour: { joues: number; victoires: number }, maitres = 0): CleDeFond[] {
    return fondsOuverts({
      niveau: this.niveauOf(p),
      jour,
      recompenses: this.recompensesOf(p.id),
      maitres,
      tresors: this.tresorsOf(p.id),
      achetes: this.fondsAchetesOf(p.id),
    })
  }

  /** Le fond qu'on voit derrière sa carte : celui qu'il a choisi, s'il le mérite encore. */
  fondPorte(p: ProfileRec, jour: { joues: number; victoires: number }, maitres = 0): CleDeFond | null {
    const choisi = fond(p.fond)
    return choisi && this.fondsOuvertsDe(p, jour, maitres).includes(choisi.key) ? choisi.key : null
  }

  /**
   * Ses fonds, relus : celui qu'il porte et tous ceux qu'il a — la boutique
   * les rend avec un fond acheté, que la page montre aussitôt à lui, et que
   * la loge propose sans recharger.
   */
  async fondsAJour(p: ProfileRec): Promise<{ fond: CleDeFond | null; fonds: CleDeFond[] }> {
    const [jour, paliers] = await Promise.all([this.statsDuJourDe(p.id), this.paliersDe(p.id)])
    const maitres = maitresDe(paliers).length
    return { fond: this.fondPorte(p, jour, maitres), fonds: this.fondsOuvertsDe(p, jour, maitres) }
  }

  /**
   * La gerbe de ses bonnes réponses : celle qu'il a choisie, s'il la mérite
   * encore ; sinon celle de tous (`GERBE_PAR_DEFAUT`) ; aucune s'il l'a
   * demandé (`AUCUNE_GERBE`).
   */
  gerbePortee(p: ProfileRec): CleDeGerbe | null {
    if (p.gerbe === AUCUNE_GERBE) return null
    const choisie = gerbe(p.gerbe)
    return choisie && gerbeOuverte(choisie, this.recompensesOf(p.id), this.tresorsOf(p.id)) ? choisie.key : GERBE_PAR_DEFAUT
  }

  /** Le thème qui habille son téléphone : celui qu'il porte, s'il existe encore ; null, Velours. */
  themePorte(p: ProfileRec): string | null {
    return themeDuCatalogue(p.theme)?.key ?? null
  }

  /**
   * Les thèmes et les fonds qu'il a achetés et ce qu'il les a payés, ce que
   * lui ont coûté ses vies des sentiers, ses sabliers et ses compagnons, et
   * les confettis que l'administrateur lui a offerts : un seul aller-retour.
   * `annonces` : les annonces à tous faites depuis, et depuis son inscription,
   * dans le même lot — l'accueil les dit sans un aller-retour de plus.
   */
  private async achatsDe(
    profileId: string,
    annonces?: { depuis: number; inscritLe: number },
  ): Promise<{
    themes: Map<string, number>
    vies: number
    sabliers: number
    compagnons: number
    fonds: Map<string, number>
    dons: { id: string; confettis: number; mot: string | null; le: number }[]
    /** Ce que ses missions faites et ses coffres lui ont donné en confettis. */
    missions: number
    coffres: number
    aTous: AnnonceATous[]
  }> {
    const [themes, vies, sabliers, compagnons, fonds, dons, missions, coffres, aTous] = await this.client.batch(
      [
        { sql: 'SELECT theme, prix FROM profile_achats WHERE profile_id = ?', args: [profileId] },
        { sql: 'SELECT COALESCE(SUM(prix), 0) AS prix FROM profile_vies WHERE profile_id = ?', args: [profileId] },
        { sql: 'SELECT COALESCE(SUM(prix), 0) AS prix FROM profile_sabliers WHERE profile_id = ?', args: [profileId] },
        { sql: 'SELECT COALESCE(SUM(prix), 0) AS prix FROM profile_compagnons WHERE profile_id = ?', args: [profileId] },
        // Chaque fond, pas leur somme : « À la une » ne met en avant que ceux qu'il n'a pas.
        { sql: 'SELECT fond, prix FROM profile_fonds WHERE profile_id = ?', args: [profileId] },
        { sql: 'SELECT id, confettis, mot, created_at FROM profile_dons WHERE profile_id = ? ORDER BY created_at DESC', args: [profileId] },
        // Dans le même lot : les missions et les coffres n'ajoutent pas un aller-retour au solde.
        {
          sql: `SELECT COALESCE(SUM(rang < ?), 0) AS faites, COALESCE(SUM(rang = ?), 0) AS trois FROM profile_missions WHERE profile_id = ? AND faite_le IS NOT NULL`,
          args: [RANG_DES_TROIS, RANG_DES_TROIS, profileId],
        },
        { sql: 'SELECT COALESCE(SUM(confettis), 0) AS n FROM profile_coffres WHERE profile_id = ?', args: [profileId] },
        // Une annonce faite avant son inscription n'est pas pour lui : il n'était pas là.
        ...(annonces
          ? [
              {
                // Sa question, tant qu'elle est ouverte et qu'il n'y a pas répondu : la carte la pose avec le message.
                sql: `SELECT a.id, a.message, a.confettis, a.created_at, q.sorte, q.choix, q.recompense, q.close_le, r.profile_id AS deja
                      FROM qg_annonces a
                      LEFT JOIN qg_annonce_questions q ON q.annonce_id = a.id
                      LEFT JOIN qg_annonce_reponses r ON r.annonce_id = a.id AND r.profile_id = ?
                      WHERE a.created_at >= ? AND a.created_at >= ? AND a.retiree_le IS NULL ORDER BY a.created_at DESC`,
                args: [profileId, annonces.depuis, annonces.inscritLe],
              },
            ]
          : []),
      ],
      'read',
    )
    return {
      themes: new Map(themes.rows.map(r => [String(r.theme), Number(r.prix)])),
      vies: Number(vies.rows[0]?.prix ?? 0),
      sabliers: Number(sabliers.rows[0]?.prix ?? 0),
      compagnons: Number(compagnons.rows[0]?.prix ?? 0),
      fonds: new Map(fonds.rows.map(r => [String(r.fond), Number(r.prix)])),
      dons: dons.rows.map(r => ({ id: String(r.id), confettis: Number(r.confettis), mot: r.mot == null ? null : String(r.mot), le: Number(r.created_at) })),
      missions: gainsDesMissions(Number(missions.rows[0]?.faites ?? 0), Number(missions.rows[0]?.trois ?? 0)).confettis,
      coffres: Number(coffres.rows[0]?.n ?? 0),
      aTous: (aTous?.rows ?? []).map(r => ({
        id: String(r.id),
        message: String(r.message),
        confettis: Number(r.confettis),
        le: Number(r.created_at),
        ...(r.sorte != null && r.close_le == null && r.deja == null && {
          question: { sorte: String(r.sorte) as SorteDeQuestion, choix: JSON.parse(String(r.choix)) as string[], recompense: Number(r.recompense) },
        }),
      })),
    }
  }

  /**
   * Sa boutique : ses confettis, les thèmes qu'il a — les offerts, ceux
   * qu'il a achetés —, celui qu'il porte, et ses compagnons.
   *
   * Une bonne réponse, un confetti : ses soirées qui comptent
   * (`confettisDeSoiree`), son quiz du jour et sa campagne — et les étoiles
   * de ses sentiers —, plus ce que l'administrateur lui a offert, ses
   * missions du jour faites et ses coffres de la semaine, moins ce qu'il a
   * dépensé : ses thèmes, ses vies des sentiers, ses sabliers, ses
   * compagnons, ses fonds.
   * Dérivés à chaque lecture, comme l'expérience : rétroactifs, et une
   * soirée retirée de l'historique emporte les siens. Le solde peut alors
   * passer sous zéro ; un achat, lui, ne se reprend jamais, un don non plus.
   *
   * `soirees`, quand on vient de relire son historique : sa page le lit déjà.
   */
  async boutiqueDe(
    p: ProfileRec,
    jour: string,
    soirees?: readonly { gain: GainSoiree; releve: ReleveSoiree }[],
    campagne?: Promise<CampagneDuProfil>,
  ): Promise<BoutiqueDuProfil> {
    return (await this.boutiqueEtDons(p, jour, soirees, campagne)).boutique
  }

  /**
   * Sa boutique, et les dons de l'administrateur qu'elle a comptés, le plus
   * récent d'abord : l'accueil les annonce, la fiche du QG les additionne. Et
   * les annonces à tous de ce dernier mois (`ANNONCE_MS`), dans la même
   * lecture : l'accueil les dit avec les dons qu'elles lui ont faits.
   * `campagne`, quand sa page l'a déjà demandée (`campagneDuProfil`).
   */
  async boutiqueEtDons(
    p: ProfileRec,
    jour: string,
    soirees?: readonly { gain: GainSoiree; releve: ReleveSoiree }[],
    campagne?: Promise<CampagneDuProfil>,
  ): Promise<{ boutique: BoutiqueDuProfil; dons: { id: string; confettis: number; mot: string | null; le: number }[]; aTous: AnnonceATous[] }> {
    const historique = soirees ?? this.historiqueOf(p.id)
    const [lues, achats, duJour, deCampagne, compagnons] = await Promise.all([
      historique,
      this.achatsDe(p.id, { depuis: Date.now() - ANNONCE_MS, inscritLe: p.createdAt }),
      this.justesDuJour?.(p.id) ?? 0,
      // Ses confettis de campagne, et ses maîtres, qui ouvrent le thème qui se gagne : la même lecture.
      campagne ?? this.lectureDeCampagne(p.id),
      this.compagnonsDe(p, historique),
    ])
    const offerts = achats.dons.reduce((n, d) => n + d.confettis, 0)
    const gagnes =
      lues.reduce((n, s) => n + confettisDeSoiree(s.gain, s.releve), 0) + duJour + deCampagne.confettis + offerts + achats.missions + achats.coffres
    const somme = (prix: Map<string, number>) => [...prix.values()].reduce((n, x) => n + x, 0)
    const depenses = somme(achats.themes) + achats.vies + achats.sabliers + achats.compagnons + somme(achats.fonds)
    const fondsAchetes = FONDS_EN_BOUTIQUE.filter(f => achats.fonds.has(f.key)).map(f => f.key)
    return {
      boutique: {
        confettis: { gagnes, depenses, solde: gagnes - depenses },
        possedes: this.themesPossedes(p, achats.themes, maitresDe(deCampagne.paliers).length),
        porte: this.themePorte(p),
        jour,
        // Absents sans compagnon ni fond acheté : rien de plus à lire pour qui n'en a pas.
        ...(compagnons.length > 0 && { compagnons }),
        ...(fondsAchetes.length > 0 && { fondsAchetes }),
      },
      dons: achats.dons,
      aTous: achats.aTous,
    }
  }

  /** Ce que la campagne dit de lui (`campagneDuProfil`) ; rien, sans campagne branchée — un test qui n'en a pas besoin. */
  private lectureDeCampagne(profileId: string): Promise<CampagneDuProfil> {
    return this.campagneDuProfil?.(profileId) ?? Promise.resolve({ confettis: 0, paliers: {}, duels: null })
  }

  /** Les thèmes qu'il a : les offerts, ceux qu'il a achetés, ceux que ses trophées et ses maîtres ouvrent. */
  private themesPossedes(p: ProfileRec, achetes: ReadonlyMap<string, number>, maitres: number): string[] {
    return THEMES.filter(t => t.rarete === 'offert' || achetes.has(t.key) || themeGagne(t, { maitres, recompenses: this.recompensesOf(p.id) })).map(t => t.key)
  }

  /**
   * Ce qu'il a déjà vu de chaque pièce de sa loge, null s'il n'y est jamais
   * passé. Une ligne illisible vaut une loge jamais vue : la page la refait,
   * plutôt que de crier « nouveau » sur tout ce qu'il a.
   */
  async vusDeLaLoge(profileId: string): Promise<VusDeLaLoge | null> {
    const res = await this.client.execute({ sql: 'SELECT vus FROM profile_loge_vus WHERE profile_id = ?', args: [profileId] })
    const brut = res.rows[0]?.vus
    if (brut == null) return null
    try {
      return lireLesVus(JSON.parse(String(brut)))
    } catch {
      return null
    }
  }

  /** Retient ce qu'il a vu, tel que la page le calcule (`retenirLesVus`, réduit par `lireLesVus`) : la ligne d'avant s'efface. */
  async retenirLesVusDeLaLoge(profileId: string, vus: VusDeLaLoge): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO profile_loge_vus (profile_id, vus, retenu_le) VALUES (?, ?, ?)
            ON CONFLICT(profile_id) DO UPDATE SET vus = excluded.vus, retenu_le = excluded.retenu_le`,
      args: [profileId, JSON.stringify(vus), Date.now()],
    })
  }

  // ── Les missions du jour et le coffre de la semaine ─────────────────────
  //
  // Ce qui s'en écrit, et rien d'autre : les missions tirées, celles faites,
  // les coffres ouverts. Leur avancement se relit des journaux de chaque
  // mode, et l'orchestration — tirer, juger, ouvrir — vit dans
  // `core/missions.ts`, qui connaît le quiz du jour et la campagne.

  /** Ses lignes de missions depuis un jour, dans l'ordre : chaque mission tirée (null si elle ne se lit plus), et ce qui est fait. */
  async lignesDesMissions(profileId: string, depuis: string): Promise<LigneDeMission[]> {
    const res = await this.client.execute({
      sql: 'SELECT jour, rang, mission, faite_le FROM profile_missions WHERE profile_id = ? AND jour >= ? ORDER BY jour, rang',
      args: [profileId, depuis],
    })
    return res.rows.map(lireLigneDeMission)
  }

  /**
   * Tire ses missions d'un jour, une fois : deux lectures parties ensemble
   * tirent les mêmes (la graine de `tirerLesMissions`), et la seconde
   * n'écrit rien. La ligne des trois naît avec elles. Rend les lignes du jour
   * telles que la base les garde.
   */
  async tirerLesMissions(profileId: string, jour: string, missions: readonly Mission[], quand: number): Promise<LigneDeMission[]> {
    const inserer = (rang: number, mission: string) => ({
      sql: `INSERT INTO profile_missions (profile_id, jour, rang, mission, tiree_le) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(profile_id, jour, rang) DO NOTHING`,
      args: [profileId, jour, rang, mission, quand],
    })
    const res = await this.client.batch(
      [
        ...missions.map((m, rang) => inserer(rang, JSON.stringify(m))),
        inserer(RANG_DES_TROIS, '{}'),
        { sql: 'SELECT jour, rang, mission, faite_le FROM profile_missions WHERE profile_id = ? AND jour = ? ORDER BY rang', args: [profileId, jour] },
      ],
      'write',
    )
    return res[res.length - 1].rows.map(lireLigneDeMission)
  }

  /**
   * Retient ce qui vient d'être fait — jamais repris : une mission faite le
   * reste, même si un journal se corrige ensuite —, puis réécrit la ligne
   * d'expérience des missions sur toutes ses lignes faites, le total avec, et
   * fait juger La Légende, comme le quiz du jour. Rend ce que cette écriture
   * a fait : une lecture d'à côté a pu en retenir une juste avant.
   */
  async accomplirDesMissions(profileId: string, faites: readonly { jour: string; rang: number; quand: number }[]): Promise<{ jour: string; rang: number }[]> {
    if (faites.length === 0) return []
    const res = await this.client.batch(
      faites.map(f => ({
        sql: 'UPDATE profile_missions SET faite_le = ? WHERE profile_id = ? AND jour = ? AND rang = ? AND faite_le IS NULL',
        args: [f.quand, profileId, f.jour, f.rang],
      })),
      'write',
    )
    const neuves = faites.filter((_, i) => res[i].rowsAffected > 0)
    if (neuves.length === 0) return []
    // Recomptée dans la transaction qui l'écrit, sur ce que la base garde à
    // cet instant : deux écritures croisées ne laissent jamais le plus petit
    // compte au-dessus du plus grand. La version, en entier (invariant 20).
    await this.recalculerTotal(profileId, {
      sql: `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at)
            SELECT ?, ?, '', COALESCE(SUM(CASE WHEN rang = ? THEN ? ELSE ? END), 0),
                   json_object('v', CAST(? AS INTEGER), 'missions', COALESCE(SUM(rang < ?), 0), 'trois', COALESCE(SUM(rang = ?), 0)), ?
            FROM profile_missions WHERE profile_id = ? AND faite_le IS NOT NULL
            ON CONFLICT(profile_id, soiree_id) DO UPDATE SET xp = excluded.xp, detail = excluded.detail`,
      args: [
        profileId,
        LIGNE_MISSIONS,
        RANG_DES_TROIS,
        gainsDesMissions(0, 1).xp,
        gainsDesMissions(1, 0).xp,
        VERSION_BAREME,
        RANG_DES_TROIS,
        RANG_DES_TROIS,
        Date.now(),
        profileId,
      ],
    })
    // Une source d'expérience de plus fait juger La Légende (règle `recompenses.md`), rangée sous le jour.
    await this.accorderLaLegende(profileId, cleDuJour(neuves[neuves.length - 1].jour))
    return neuves.map(({ jour, rang }) => ({ jour, rang }))
  }

  /** Les jours où ses trois missions sont faites, avant un jour (exclu) : ses tampons, semaine par semaine. */
  async joursAuxTrois(profileId: string, avant: string): Promise<string[]> {
    const res = await this.client.execute({
      sql: 'SELECT jour FROM profile_missions WHERE profile_id = ? AND rang = ? AND faite_le IS NOT NULL AND jour < ? ORDER BY jour',
      args: [profileId, RANG_DES_TROIS, avant],
    })
    return res.rows.map(r => String(r.jour))
  }

  /** Les semaines de ses coffres déjà ouverts. */
  async semainesDesCoffres(profileId: string): Promise<Set<string>> {
    const res = await this.client.execute({ sql: 'SELECT semaine FROM profile_coffres WHERE profile_id = ?', args: [profileId] })
    return new Set(res.rows.map(r => String(r.semaine)))
  }

  /** Le coffre d'une semaine, s'il est ouvert : ce qu'il a donné. */
  async coffreDe(profileId: string, semaine: string): Promise<CoffreOuvert | null> {
    const res = await this.client.execute({
      sql: 'SELECT semaine, tampons, rang, rarete, objet, confettis, ouvert_le FROM profile_coffres WHERE profile_id = ? AND semaine = ?',
      args: [profileId, semaine],
    })
    const r = res.rows[0]
    const objet = r ? lireLObjet(r.objet, Number(r.confettis)) : null
    if (!r || !objet) return null
    // Un coffre du mois garde sa place dans la colonne des tampons : il n'en a pas.
    const duMois = moisDuCoffreValide(String(r.semaine))
    return {
      semaine: String(r.semaine),
      tampons: duMois ? 0 : Number(r.tampons),
      ...(duMois && { place: Number(r.tampons) }),
      rang: String(r.rang) as RangDuCoffre,
      rarete: String(r.rarete) as Rarete,
      objet,
      nom: nomDeLObjet(objet),
      detail: phraseDeLObjet(objet),
      ouvertLe: Number(r.ouvert_le),
    }
  }

  /**
   * Ouvre le coffre d'une semaine : le tirage, une fois — rouvert, il redonne
   * ce qu'il a donné —, puis ce qu'il donne, dans le même lot : un thème ou
   * un compagnon dans sa table, à prix nul — offert, il se porte et grandit
   * comme acheté, et la boutique ne le propose plus —, un fond ou une gerbe
   * du trésor ici seulement. Un compagnon s'installe dans une niche vide,
   * jamais à la place de celui qui y vit. Un achat à la fois
   * (`unAchatALaFois`) : un thème acheté pendant l'ouverture serait sinon
   * tiré une seconde fois.
   */
  ouvrirUnCoffre(
    profileId: string,
    semaine: string,
    tampons: number,
    { hasard, jour, quand }: { hasard: () => number; jour: string; quand: number },
  ): Promise<CoffreOuvert> {
    return this.unAchatALaFois(profileId, async () => {
      const deja = await this.coffreDe(profileId, semaine)
      if (deja) return deja
      // Un coffre du mois : sa clé est le mois, et `tampons` y est sa place au classement.
      const duMois = moisDuCoffreValide(semaine)
      const rang = duMois ? rangDuCoffreDuMois(tampons) : rangDuCoffre(tampons)
      if (!rang) throw new Error('Pas de coffre cette semaine-là : aucun tampon.')
      const rec = await this.require(profileId)
      const achetes = await this.client.execute({ sql: 'SELECT theme FROM profile_achats WHERE profile_id = ?', args: [profileId] })
      const themes = new Set(achetes.rows.map(r => String(r.theme)))
      const tresors = this.tresorsOf(profileId)
      const compagnons = this.compagnons.get(profileId)
      const possede = (o: ObjetDuTresor) =>
        o.sorte === 'theme' ? themes.has(o.cle) : o.sorte === 'compagnon' ? !!compagnons?.has(o.cle as CleDeCompagnon) : o.sorte !== 'confettis' && tresors.has(cleDeLObjet(o))
      const { objet, rarete } = tirerLeCoffre(rang, { possede, hasard, jour })
      // Une niche vide s'écrit : celui qui y vit déjà — le seul, ou le plus
      // grand —, sinon celui qu'il donne. Laissée vide, un second compagnon
      // premier du catalogue l'aurait prise à forme égale.
      const niche = objet.sorte === 'compagnon' && !rec.niche ? (this.compagnonDeLaNiche(rec) ?? (objet.cle as CleDeCompagnon)) : null
      await this.client.batch(
        [
          {
            sql: `INSERT INTO profile_coffres (profile_id, semaine, tampons, rang, rarete, objet, confettis, ouvert_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [profileId, semaine, tampons, rang, rarete, cleDeLObjet(objet), objet.sorte === 'confettis' ? objet.confettis : 0, quand],
          },
          ...(objet.sorte === 'theme'
            ? [{ sql: 'INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, ?) ON CONFLICT(profile_id, theme) DO NOTHING', args: [profileId, objet.cle, quand] }]
            : []),
          ...(objet.sorte === 'compagnon'
            ? [
                {
                  sql: 'INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 0, 0, ?) ON CONFLICT(profile_id, compagnon) DO NOTHING',
                  args: [profileId, objet.cle, quand],
                },
              ]
            : []),
          ...(niche ? [{ sql: 'UPDATE profiles SET niche = ? WHERE id = ? AND niche IS NULL', args: [niche, profileId] }] : []),
        ],
        'write',
      )
      let siens = this.tresors.get(profileId)
      if (!siens) this.tresors.set(profileId, (siens = new Set()))
      siens.add(cleDeLObjet(objet))
      if (objet.sorte === 'compagnon') {
        let ses = this.compagnons.get(profileId)
        if (!ses) this.compagnons.set(profileId, (ses = new Map()))
        if (!ses.has(objet.cle as CleDeCompagnon)) ses.set(objet.cle as CleDeCompagnon, { rang: 0, nom: null, montree: null })
      }
      if (niche && !rec.niche) rec.niche = niche
      return {
        semaine,
        tampons: duMois ? 0 : tampons,
        ...(duMois && { place: tampons }),
        rang,
        rarete,
        objet,
        nom: nomDeLObjet(objet),
        detail: phraseDeLObjet(objet),
        ouvertLe: quand,
      }
    })
  }

  /** Ses parties de soirée créditées depuis un instant, et leurs confettis : la mission des bonnes réponses les compte aussi. */
  async soireesDepuis(profileId: string, depuis: number): Promise<{ le: number; confettis: number }[]> {
    const res = await this.client.execute({
      sql: `SELECT detail, created_at FROM profile_xp WHERE profile_id = ? AND created_at >= ? AND ${HORS_LIGNES_A_PART}`,
      args: [profileId, depuis],
    })
    return res.rows.map(r => {
      const { gain, releve } = decodeDetail(String(r.detail))
      return { le: Number(r.created_at), confettis: confettisDeSoiree(gain, releve) }
    })
  }

  /**
   * Ce que l'administrateur a fait pour lui ce dernier mois, à lui dire une
   * fois sur son accueil (`ANNONCE_MS`) : ses dons, son prénom changé, et les
   * mercis de ses signalements qui ont servi — que le quiz du jour et la
   * campagne ont déjà lus sur le mois —, le plus récent d'abord ; et ce qu'il
   * a dit à tous (`aTous`), chaque annonce avec les confettis qu'elle lui a
   * offerts — ses dons à elle ne se redisent pas à part. Son téléphone retient
   * ce qu'il a déjà montré.
   */
  annoncesDe(
    p: ProfileRec,
    dons: readonly { id: string; confettis: number; mot: string | null; le: number }[],
    maintenant: number,
    mercis: readonly AnnonceDeLAdministrateur[] = [],
    aTous: readonly AnnonceATous[] = [],
  ): AnnonceDeLAdministrateur[] {
    const annonces: AnnonceDeLAdministrateur[] = dons
      .filter(d => maintenant - d.le < ANNONCE_MS && !estUnDonDAnnonce(d.id))
      .map(d => ({ id: `don:${d.id}`, sorte: 'confettis' as const, confettis: d.confettis, mot: d.mot, le: d.le }))
    if (p.renommeLe !== null && maintenant - p.renommeLe < ANNONCE_MS) {
      annonces.push({ id: `prenom:${p.renommeLe}`, sorte: 'prenom', nom: p.name, le: p.renommeLe })
    }
    // Les confettis d'une annonce sont ceux de SON don : suspendu à son envoi, il
    // n'en a pas reçu, et l'annonce ne les lui promet pas.
    const parId = new Map(dons.map(d => [d.id, d.confettis]))
    for (const a of aTous) {
      if (maintenant - a.le >= ANNONCE_MS) continue
      annonces.push({
        id: `annonce:${a.id}`,
        sorte: 'annonce',
        message: a.message,
        confettis: parId.get(donDeLAnnonce(a.id, p.id)) ?? 0,
        le: a.le,
        ...(a.question && { question: a.question }),
      })
    }
    return [...annonces, ...mercis].sort((a, b) => b.le - a.le)
  }

  /**
   * Ses compagnons achetés, la plus haute forme de chacun, son nom, la forme
   * qu'il montre et son Éclat — qui vaut pour toutes ses formes, et ouvre sa
   * métamorphose à la forme ultime —, les paliers de sa niche et ce qu'il a
   * réglé de ses ornements : de mémoire, dans l'ordre du catalogue.
   */
  compagnonsOf(id: string): CompagnonPossede[] {
    const siens = this.compagnons.get(id)
    if (!siens?.size) return []
    return COMPAGNONS.flatMap(c => {
      const s = siens.get(c.key)
      return s
        ? [
            {
              compagnon: c.key,
              rang: s.rang,
              ...(s.nom && { nom: s.nom }),
              ...(s.montree !== null && { montree: s.montree }),
              ...(this.brilleChez(id, c.formes[0].key) && { eclat: true as const }),
              ...(s.paliers && { paliers: s.paliers }),
              ...(s.ornements && Object.keys(s.ornements).length > 0 && { ornements: { ...s.ornements } }),
            },
          ]
        : []
    })
  }

  /**
   * Ses compagnons, et ce qui les fait grandir : ses bonnes réponses données
   * en portant chacun — celles qui lui rapportent un confetti : ses soirées
   * qui comptent, son quiz du jour, sa campagne (le choix du 13 octobre
   * 2026). Relues dans les journaux à chaque lecture, comme ses confettis.
   *
   * Une forme atteinte ne se perd jamais : le rang monte ici dès que ses
   * bonnes réponses passent un seuil (`JUSTES_DES_FORMES`), et ne redescend
   * plus, même quand une soirée retirée en reprend. Et il grandit pour de
   * bon : qui portait sa plus haute forme porte la nouvelle — qui avait
   * choisi d'en porter une d'avant la garde. Après sa forme ultime, les
   * paliers de sa niche montent de même (`PALIERS_DE_LA_NICHE`), et ne se
   * perdent pas davantage.
   *
   * `soirees`, quand on vient de relire son historique — ou qu'on le relit ;
   * `deCampagne`, ses bonnes réponses de campagne telles que la fin d'une
   * partie de la campagne vient de les laisser (`faireGrandir`), à la place
   * de la lecture d'une page (`compagnonsDeCampagne`).
   */
  async compagnonsDe(
    p: ProfileRec,
    soirees?: readonly { gain: GainSoiree; releve: ReleveSoiree }[] | Promise<readonly { gain: GainSoiree; releve: ReleveSoiree }[]>,
    deCampagne?: () => Promise<Record<string, number>>,
  ): Promise<CompagnonAcquis[]> {
    const possedes = this.compagnonsOf(p.id)
    if (possedes.length === 0) return []
    const muette = (mode: string) => (e: unknown): Record<string, number> => {
      console.error(`[profil] ${mode} illisible pour ses compagnons :`, e)
      return {}
    }
    const rien: Record<string, number> = {}
    const lireLaCampagne = deCampagne ?? (this.compagnonsDeCampagne && (() => this.compagnonsDeCampagne!(p.id)))
    const [deSesSoirees, duJour, deLaCampagne] = await Promise.all([
      soirees ? Promise.resolve(soirees).then(justesDesSoirees) : this.justesDeSesSoirees(p.id),
      this.compagnonsDuJour?.(p.id).catch(muette('quiz du jour')) ?? rien,
      lireLaCampagne?.().catch(muette('campagne')) ?? rien,
    ])
    const justesDe = (c: CleDeCompagnon) => (deSesSoirees[c] ?? 0) + (duJour[c] ?? 0) + (deLaCampagne[c] ?? 0)
    const acquis = possedes.map(({ montree, paliers: avant, ...a }) => {
      const justes = justesDe(a.compagnon)
      const rang = Math.max(a.rang, rangAtteint(justes))
      const paliers = Math.max(avant ?? 0, paliersDeLaNicheAtteints(justes))
      // Une forme atteinte reprend la place de celle qu'il montrait (`grandir`) ;
      // un palier de sa niche, non : c'est elle qui s'embellit, lui ne change pas.
      return { ...a, rang, justes, ...(montree !== undefined && rang === a.rang && { montree }), ...(paliers > 0 && { paliers }) }
    })
    const grandis = acquis.filter((a, i) => a.rang > possedes[i].rang || (a.paliers ?? 0) > (possedes[i].paliers ?? 0))
    if (grandis.length > 0) await this.grandir(p, grandis, possedes)
    return acquis
  }

  /** Ses bonnes réponses de soirée, compagnon par compagnon : gardées (`justesDesSoireesGardees`), sinon relues de son historique. */
  private justesDeSesSoirees(profileId: string): Promise<Readonly<Record<string, number>>> {
    let gardees = this.justesDesSoireesGardees.get(profileId)
    if (!gardees) {
      const lues = this.historiqueOf(profileId).then(justesDesSoirees)
      this.justesDesSoireesGardees.set(profileId, (gardees = lues))
      // Ratée, la lecture ne se garde pas : la suivante la refait.
      lues.catch(() => {
        if (this.justesDesSoireesGardees.get(profileId) === lues) this.justesDesSoireesGardees.delete(profileId)
      })
    }
    return gardees
  }

  /**
   * Une ligne de ses soirées a changé — créditée, retirée, remise au barème —,
   * ou peut-être : écrite ou non, on ne le sait pas, et la base fait foi. Ce
   * qu'on en gardait s'oublie, après l'écriture : une lecture partie avant
   * elle ne la sait pas.
   */
  private oublierSesSoirees(profileIds: Iterable<string>): void {
    for (const id of profileIds) this.justesDesSoireesGardees.delete(id)
  }

  /**
   * Fait grandir le compagnon de sa niche, si ses bonnes réponses l'ont mené
   * à sa forme suivante : à la fin d'un quiz, d'une partie du quiz du jour,
   * d'une série — jamais pendant une question. Rend vrai s'il a grandi : la
   * salle où il joue le voit alors, s'il le porte. Sans compagnon, rien ne se
   * lit — `deCampagne` non plus : la campagne le passe à la fin de ses
   * parties, et ne paie rien pour qui n'a pas de niche.
   */
  async faireGrandir(profileId: string, deCampagne?: () => Promise<Record<string, number>>): Promise<boolean> {
    const p = this.profiles.get(profileId)
    if (!p || !this.compagnonDeLaNiche(p)) return false
    const avant = this.compagnonsOf(profileId)
    const apres = await this.compagnonsDe(p, undefined, deCampagne)
    return apres.some(a => a.rang > (avant.find(x => x.compagnon === a.compagnon)?.rang ?? 0))
  }

  /**
   * Retient les formes que ses compagnons viennent d'atteindre, et les
   * paliers de leur niche, et fait porter la nouvelle forme à qui portait la
   * plus haute d'avant. Une seule écriture : le rang et les paliers ne font
   * que monter (`MAX`), même si deux lectures se croisent. La forme qu'il
   * montrait dans sa niche laisse la place à la nouvelle : il grandit sous
   * ses yeux, et la reprend s'il préfère. Un palier seul n'y touche pas : sa
   * niche s'embellit, lui ne change pas — ni dans sa niche, ni sur lui.
   */
  private async grandir(p: ProfileRec, grandis: readonly CompagnonPossede[], avant: readonly CompagnonPossede[]): Promise<void> {
    const lu = p.legendaire
    const porte = formeDeCompagnon(lu)
    const rangDAvant = (g: CompagnonPossede) => avant.find(a => a.compagnon === g.compagnon)?.rang ?? 0
    const aGrandi = (g: CompagnonPossede) => g.rang > rangDAvant(g)
    // Sa plus haute d'avant, et rien d'autre : sa métamorphose, qui garde le
    // rang de la forme ultime, serait devenue sa forme ultime au premier palier.
    const suit = grandis.find(g => aGrandi(g) && porte?.compagnon === g.compagnon && !porte.metamorphose && porte.rang === rangDAvant(g))
    const nouvelle = suit && compagnonDuCatalogue(suit.compagnon)?.formes[suit.rang]
    await this.client.batch(
      [
        ...grandis.map(g => ({
          sql: `UPDATE profile_compagnons SET rang = MAX(rang, ?), paliers = MAX(COALESCE(paliers, 0), ?)${aGrandi(g) ? ', montree = NULL' : ''} WHERE profile_id = ? AND compagnon = ?`,
          args: [g.rang, g.paliers ?? 0, p.id, g.compagnon],
        })),
        ...(nouvelle ? [{ sql: 'UPDATE profiles SET legendaire = ? WHERE id = ? AND legendaire = ?', args: [nouvelle.key, p.id, lu] }] : []),
      ],
      'write',
    )
    const siens = this.compagnons.get(p.id)
    for (const g of grandis) {
      const s = siens?.get(g.compagnon)
      if (!s) continue
      if (aGrandi(g)) s.montree = null
      s.rang = Math.max(s.rang, g.rang)
      s.paliers = Math.max(s.paliers ?? 0, g.paliers ?? 0)
    }
    // Un avatar choisi pendant l'écriture l'emporte, en base comme ici : la
    // condition de l'`UPDATE` l'a déjà gardé.
    if (nouvelle && p.legendaire === lu) p.legendaire = nouvelle.key
  }

  /**
   * Achète un compagnon, à sa première forme (`PRIX_D_UN_COMPAGNON`) : il
   * s'installe dans sa niche — c'est lui qui grandira —, ou attend son tour
   * (`installer: false`) et celui qui y vit la garde. Il ne devient jamais
   * son avatar d'ici (le 19 octobre 2026 : « ça le met sur notre avatar et
   * dans la niche ») : on le porte en le choisissant, dans la loge. Refusé en
   * clair : déjà à lui, pas assez de confettis — un autre onglet a pu
   * dépenser entre-temps.
   */
  acheterCompagnon(id: string, cle: unknown, jour: string, { installer = true }: { installer?: boolean } = {}): Promise<ProfileRec> {
    return this.unAchatALaFois(id, async () => {
      const rec = await this.require(id)
      const c = compagnonDuCatalogue(cle)
      if (!c) throw new Error('Ce compagnon n’existe pas')
      if (this.compagnons.get(id)?.has(c.key)) throw new Error(`${c.nom} est déjà à toi`)
      // La luciole ne se vend pas : seul un appel forgé la demanderait, la boutique ne la montre pas.
      if (c.gagne) throw new Error(`${c.nom} ne s’achète pas : ${c.le === 'la' ? 'elle' : 'il'} rejoint qui ${cheminDeLaLuciole()}`)
      const manque = PRIX_D_UN_COMPAGNON - (await this.boutiqueDe(rec, jour)).confettis.solde
      if (manque > 0) throw new Error(`Il te manque ${nConfettis(manque)} pour ${nomDansLaPhrase(c.nom)}`)
      // Celui qui y vit la garde en toutes lettres : laissée à la règle, la
      // niche irait au plus grand, qui n'est pas forcément lui.
      const niche = installer ? c.key : (this.compagnonDeLaNiche(rec) ?? c.key)
      await this.client.batch(
        [
          {
            sql: 'INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, ?, 0, ?)',
            args: [id, c.key, PRIX_D_UN_COMPAGNON, Date.now()],
          },
          { sql: 'UPDATE profiles SET niche = ? WHERE id = ?', args: [niche, id] },
        ],
        'write',
      )
      let siens = this.compagnons.get(id)
      if (!siens) this.compagnons.set(id, (siens = new Map()))
      siens.set(c.key, { rang: 0, nom: null, montree: null })
      rec.niche = niche
      return rec
    })
  }

  /**
   * Offre un compagnon qui ne s'achète pas — la luciole, à la Première
   * traversée (`COMPAGNON_DE_L_EXPEDITION`) — à prix nul, comme un coffre :
   * il se porte et grandit comme acheté, et ni le solde ni les ventes du QG
   * ne le comptent. Une niche vide l'accueille, jamais à la place de celui
   * qui y vit, et il ne devient pas son avatar. Rend vrai s'il est neuf :
   * déjà à lui, rien ne change — la fin d'une expédition et le rattrapage du
   * démarrage le redemandent sans crainte. Un profil suspendu ne le reçoit
   * qu'en base : réactivé, il le trouve chez lui.
   */
  offrirUnCompagnon(id: string, cle: CleDeCompagnon, quand: number): Promise<boolean> {
    return this.unAchatALaFois(id, async () => {
      const rec = await this.byId(id)
      if (this.compagnons.get(id)?.has(cle)) return false
      // Une niche vide s'écrit, comme au coffre : celui qui y vit déjà — le seul, ou le plus grand —, sinon lui.
      const niche = rec && !rec.niche ? (this.compagnonDeLaNiche(rec) ?? cle) : null
      const [ajout] = await this.client.batch(
        [
          {
            sql: 'INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 0, 0, ?) ON CONFLICT(profile_id, compagnon) DO NOTHING',
            args: [id, cle, quand],
          },
          ...(niche ? [{ sql: 'UPDATE profiles SET niche = ? WHERE id = ? AND niche IS NULL', args: [niche, id] }] : []),
        ],
        'write',
      )
      if (rec) {
        let siens = this.compagnons.get(id)
        if (!siens) this.compagnons.set(id, (siens = new Map()))
        if (!siens.has(cle)) siens.set(cle, { rang: 0, nom: null, montree: null })
        if (niche && !rec.niche) rec.niche = niche
      }
      return ajout.rowsAffected > 0
    })
  }

  /**
   * Ce qu'il règle d'un de ses compagnons, dans sa niche : son nom — que sa
   * carte montre aussi (le propriétaire, le 19 octobre 2026 : « Le compagnon
   * sur la carte doit avoir son nom ») —, la forme qu'il y montre, parmi
   * celles qu'il a atteintes — sa plus haute, ou null, la rend à sa
   * croissance —, et ses ornements : chacun de ceux qu'il a gagnés, montré
   * dans un style, ou caché (`ornements`, fondus dans ce qu'il avait réglé).
   * Refusé en clair : un compagnon qu'il n'a pas, une forme ou un ornement
   * pas encore atteints.
   */
  async reglerCompagnon(id: string, cle: unknown, patch: { nom?: unknown; montree?: unknown; ornements?: unknown }): Promise<ProfileRec> {
    const rec = await this.require(id)
    const c = compagnonDuCatalogue(cle)
    if (!c) throw new Error('Ce compagnon n’existe pas')
    if (!this.compagnons.get(id)?.has(c.key)) throw new Error(pourLAvoir(c))
    const champs: Partial<Pick<SienEnMemoire, 'nom' | 'montree' | 'ornements'>> = {}
    // Vérifiés sur ses bonnes réponses du moment, comme une forme qu'on
    // porte : ce qu'il vient d'atteindre se règle sans attendre. Relues une
    // fois pour tout le geste.
    let relus: CompagnonAcquis[] | undefined
    const sienDuMoment = async () => (relus ??= await this.compagnonsDe(rec)).find(a => a.compagnon === c.key)
    if (patch.nom !== undefined) champs.nom = nomDeCompagnon(patch.nom)
    if (patch.montree === null) champs.montree = null
    else if (patch.montree !== undefined) {
      const n = typeof patch.montree === 'number' && Number.isInteger(patch.montree) ? patch.montree : -1
      const f = n === MONTREE_DE_LA_METAMORPHOSE ? c.lumiere : c.formes[n]
      if (!f) throw new Error('Cette forme n’existe pas')
      const sien = await sienDuMoment()
      this.verifierLaForme(f, c, sien)
      // Sa plus haute n'est pas un choix : elle suivra sa croissance. Sa
      // métamorphose, si : elle ne se gagne pas en grandissant.
      champs.montree = f.metamorphose ? MONTREE_DE_LA_METAMORPHOSE : f.rang < sien.rang ? f.rang : null
    }
    if (patch.ornements !== undefined) {
      const voulus = patch.ornements
      if (!voulus || typeof voulus !== 'object' || Array.isArray(voulus)) throw new Error('Cet ornement n’existe pas')
      const paliers = (await sienDuMoment())?.paliers ?? 0
      const regles: ReglageDesOrnements = { ...this.compagnons.get(id)?.get(c.key)?.ornements }
      for (const [cleDOrnement, style] of Object.entries(voulus)) {
        const o = ornementDuCatalogue(cleDOrnement)
        if (!o) throw new Error('Cet ornement n’existe pas')
        if (!STYLES_D_ORNEMENT.includes(style as StyleDOrnement)) throw new Error('Ce style d’ornement n’existe pas')
        if (paliers < o.palier) throw new Error(`${o.nom.charAt(0).toUpperCase()}${o.nom.slice(1)} : à ${formatNumber(o.justes)} bonnes réponses données ${avecLui(c)}`)
        // Le style d'office ne se retient pas : un ornement remontré redevient comme les autres.
        if (style === STYLE_D_OFFICE) delete regles[o.key]
        else regles[o.key] = style as StyleDOrnement
      }
      champs.ornements = regles
    }
    const colonnes = (['nom', 'montree', 'ornements'] as const).filter(k => k in champs)
    if (colonnes.length === 0) return rec
    // Ses ornements s'écrivent en JSON — et rien quand tout est d'office.
    const valeur = (k: (typeof colonnes)[number]) =>
      k === 'ornements' ? (Object.keys(champs.ornements ?? {}).length > 0 ? JSON.stringify(champs.ornements) : null) : (champs[k] ?? null)
    await this.client.execute({
      sql: `UPDATE profile_compagnons SET ${colonnes.map(k => `${k} = ?`).join(', ')} WHERE profile_id = ? AND compagnon = ?`,
      args: [...colonnes.map(valeur), id, c.key],
    })
    const s = this.compagnons.get(id)?.get(c.key)
    if (s) Object.assign(s, champs)
    // Montrée dans sa niche, sa métamorphose est trouvée : ni « Décorer » ni
    // la loge ne la disent plus nouvelle. Une base qui hoquette ici ne défait
    // pas ce qu'il vient de régler.
    if (champs.montree === MONTREE_DE_LA_METAMORPHOSE && c.lumiere) {
      await this.voirDansLaLoge(id, c.lumiere.key).catch(e => console.error('[profil] loge illisible :', e))
    }
    return rec
  }

  /**
   * Refuse en clair une forme qu'il n'a pas, à porter ou à montrer : un
   * compagnon pas adopté, une forme pas encore atteinte — sa métamorphose, qui
   * demande aussi l'Éclat sur lui (`metamorphoseOuverte`).
   */
  private verifierLaForme(f: FormeDeCompagnon, c: Compagnon, sien: CompagnonPossede | undefined): asserts sien is CompagnonPossede {
    if (!sien) throw new Error(pourLAvoir(c))
    if (f.metamorphose) {
      if (!metamorphoseOuverte(sien)) throw new Error(`${f.nom} s’ouvre à sa forme ultime, quand l’Éclat tombe sur ${c.le === 'la' ? 'elle' : 'lui'}`)
    } else if (sien.rang < f.rang) throw new Error(`${f.nom} arrive à ${JUSTES_DES_FORMES[f.rang]} bonnes réponses données ${avecLui(c)}`)
  }

  /**
   * Ses métamorphoses ouvertes qu'il n'a pas encore vues dans sa loge : « Ma
   * niche » les marque « Nouveau », comme la loge (`ceQuIlAPorter`). Rien tant
   * qu'il n'a jamais regardé ses avatars — sa première visite retiendra
   * tout —, et pas une lecture de plus sans métamorphose : la niche lit sa
   * route à la première réponse de chaque page.
   */
  async metamorphosesNeuves(id: string, compagnons: readonly CompagnonPossede[]): Promise<string[]> {
    const ouvertes = formesOuvertes(compagnons).filter(k => formeDeCompagnon(k)?.metamorphose)
    if (ouvertes.length === 0) return []
    // La base s'est tue sur ce qu'il a vu : rien de nouveau, plutôt que sa niche en panne.
    const vus = (
      await this.vusDeLaLoge(id).catch(e => {
        console.error('[profil] loge illisible :', e)
        return null
      })
    )?.avatar
    return vus ? ouvertes.filter(k => !vus.includes(k)) : []
  }

  /** Un avatar trouvé hors de sa loge — sa métamorphose, montrée dans sa niche — : vu, comme si la loge l'avait montré. */
  private async voirDansLaLoge(id: string, cle: string): Promise<void> {
    const vus = await this.vusDeLaLoge(id)
    if (!vus?.avatar || vus.avatar.includes(cle)) return
    await this.retenirLesVusDeLaLoge(id, { ...vus, avatar: [...vus.avatar, cle] })
  }

  // ── Ses soins : ses envies, ses cadeaux, ses cueillettes, son jardin ──────
  // (`shared/soins.ts`, `shared/trouvailles.ts`) : ce que la base garde, et
  // rien d'autre — juger une envie, tirer un cadeau, vérifier un jardin vit
  // dans `core/soins.ts`.

  /** Tout ce que la page de son compagnon lit de ses soins, d'un aller-retour : ses jardins, ses envies du jour, ses cadeaux, ses cueillettes. */
  async lignesDesSoins(profileId: string, jour: string): Promise<LignesDesSoins> {
    const [jardins, envies, cadeaux, records, cueillettes] = await this.client.batch(
      [
        { sql: 'SELECT compagnon, jardin FROM profile_compagnons WHERE profile_id = ?', args: [profileId] },
        { sql: 'SELECT compagnon, envie FROM profile_envies WHERE profile_id = ? AND jour = ?', args: [profileId, jour] },
        { sql: 'SELECT compagnon, jour, objet, grand FROM profile_cadeaux WHERE profile_id = ? ORDER BY jour', args: [profileId] },
        { sql: 'SELECT compagnon, MAX(score) AS record FROM profile_cueillettes WHERE profile_id = ? GROUP BY compagnon', args: [profileId] },
        {
          sql: 'SELECT COALESCE(SUM(score >= ?), 0) AS trois, MAX(jouee_le) AS derniere FROM profile_cueillettes WHERE profile_id = ?',
          args: [ETOILES_DE_LA_CUEILLETTE[ETOILES_DE_LA_CUEILLETTE.length - 1], profileId],
        },
      ],
      'read',
    )
    const total = cueillettes.rows[0]
    return {
      jardins: new Map(jardins.rows.map(r => [String(r.compagnon), lireLeJardin(r.jardin)])),
      envies: envies.rows.map(r => ({ compagnon: String(r.compagnon), envie: String(r.envie) })),
      cadeaux: cadeaux.rows.map(r => ({ compagnon: String(r.compagnon), jour: String(r.jour), objet: String(r.objet), grand: Number(r.grand) === 1 })),
      records: new Map(records.rows.map(r => [String(r.compagnon), Number(r.record) || 0])),
      troisEtoiles: Number(total?.trois) || 0,
      derniereCueillette: total?.derniere == null ? null : Number(total.derniere),
    }
  }

  /** Comble une envie du jour, une fois : la seconde n'écrit rien. */
  async comblerUneEnvie(profileId: string, compagnon: string, jour: string, envie: Envie, quand: number): Promise<void> {
    await this.client.execute({
      sql: 'INSERT INTO profile_envies (profile_id, compagnon, jour, envie, faite_le) VALUES (?, ?, ?, ?, ?) ON CONFLICT(profile_id, compagnon, jour, envie) DO NOTHING',
      args: [profileId, compagnon, jour, envie, quand],
    })
  }

  /**
   * Ouvre le cadeau d'un jour, une fois : deux ouvertures parties ensemble
   * tirent le même (la graine de `core/soins.ts`), et la seconde n'écrit
   * rien. Rend le cadeau tel que la base le garde.
   */
  async ecrireLeCadeau(profileId: string, compagnon: string, jour: string, objet: string, grand: boolean, quand: number): Promise<{ objet: string; grand: boolean }> {
    const [, lu] = await this.client.batch(
      [
        {
          sql: 'INSERT INTO profile_cadeaux (profile_id, compagnon, jour, objet, grand, ouvert_le) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(profile_id, compagnon, jour) DO NOTHING',
          args: [profileId, compagnon, jour, objet, grand ? 1 : 0, quand],
        },
        { sql: 'SELECT objet, grand FROM profile_cadeaux WHERE profile_id = ? AND compagnon = ? AND jour = ?', args: [profileId, compagnon, jour] },
      ],
      'write',
    )
    const r = lu.rows[0]
    return { objet: String(r.objet), grand: Number(r.grand) === 1 }
  }

  /** Écrit une partie de cueillette, et l'envie de jouer qu'elle comble — la première du jour ; les suivantes n'en écrivent pas d'autre. */
  async ecrireLaCueillette(profileId: string, compagnon: string, jour: string, score: number, quand: number): Promise<void> {
    await this.client.batch(
      [
        { sql: 'INSERT INTO profile_cueillettes (profile_id, compagnon, jouee_le, score) VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, jouee_le) DO NOTHING', args: [profileId, compagnon, quand, score] },
        {
          sql: "INSERT INTO profile_envies (profile_id, compagnon, jour, envie, faite_le) VALUES (?, ?, ?, 'jeu', ?) ON CONFLICT(profile_id, compagnon, jour, envie) DO NOTHING",
          args: [profileId, compagnon, jour, quand],
        },
      ],
      'write',
    )
  }

  /** Son jardin, tel que `core/soins.ts` l'a vérifié — vide, la colonne se vide. */
  async ecrireLeJardin(profileId: string, compagnon: string, jardin: Readonly<Record<string, string>>): Promise<void> {
    await this.client.execute({
      sql: 'UPDATE profile_compagnons SET jardin = ? WHERE profile_id = ? AND compagnon = ?',
      args: [Object.keys(jardin).length > 0 ? JSON.stringify(jardin) : null, profileId, compagnon],
    })
  }

  /**
   * Achète un fond des savoirs (`PRIX_D_UN_FOND`) — et le porte derrière sa
   * carte, ou le garde pour plus tard, comme un thème. Refusé en clair : déjà
   * à lui, un fond qui ne se vend pas — il se gagne, ou ne sort que du coffre
   * de la semaine —, pas assez de confettis : un autre onglet a pu dépenser
   * entre-temps.
   */
  acheterFond(id: string, cle: unknown, jour: string, { porter = true }: { porter?: boolean } = {}): Promise<ProfileRec> {
    return this.unAchatALaFois(id, async () => {
      const rec = await this.require(id)
      const f = fond(cle)
      if (!f) throw new Error('Ce fond n’existe pas')
      if (f.tresor) throw new Error('Ce fond ne se vend pas : il ne sort que du coffre de la semaine')
      if (!f.savoir) throw new Error(`Ce fond ne se vend pas : il se gagne avec ${f.regle}`)
      if (this.fondsAchetesOf(id).has(f.key)) throw new Error(`${f.nom} est déjà à toi`)
      const manque = PRIX_D_UN_FOND - (await this.boutiqueDe(rec, jour)).confettis.solde
      if (manque > 0) throw new Error(`Il te manque ${nConfettis(manque)} pour ${nomDansLaPhrase(f.nom)}`)
      await this.client.batch(
        [
          { sql: 'INSERT INTO profile_fonds (profile_id, fond, prix, created_at) VALUES (?, ?, ?, ?)', args: [id, f.key, PRIX_D_UN_FOND, Date.now()] },
          ...(porter ? [{ sql: 'UPDATE profiles SET fond = ? WHERE id = ?', args: [f.key, id] }] : []),
        ],
        'write',
      )
      let siens = this.fondsAchetes.get(id)
      if (!siens) this.fondsAchetes.set(id, (siens = new Set()))
      siens.add(f.key)
      if (porter) rec.fond = f.key
      return rec
    })
  }

  /** Ce que sa fin de soirée dit de ses confettis : ceux de ce soir, son solde, le thème qu'il vise. */
  async confettisDeLaFin(p: ProfileRec, gagnes: number, jour: string): Promise<ConfettisDeLaFin> {
    const boutique = await this.boutiqueDe(p, jour)
    const solde = boutique.confettis.solde
    return { gagnes, solde, ...ceQueDonnentLesConfettis(boutique.possedes, solde, jour) }
  }

  /**
   * Achète un thème — et le porte, ou le garde pour plus tard. On le portait
   * toujours, « on n'achète pas un habillage pour le laisser au placard » ;
   * mais on achète aussi un thème de saison avant qu'il ne parte, ou pour
   * compléter son album, sans quitter celui qu'on aime (un retour de joueur
   * du 10 octobre 2026). Refusé en clair — pas assez de confettis, hors de
   * sa saison, déjà à lui : la page ne le propose pas, mais un autre onglet
   * a pu dépenser entre-temps.
   */
  acheterTheme(id: string, cle: unknown, jour: string, { porter = true }: { porter?: boolean } = {}): Promise<ProfileRec> {
    return this.unAchatALaFois(id, async () => {
      const rec = await this.require(id)
      const t = themeDuCatalogue(cle)
      if (!t) throw new Error('Ce thème n’existe pas')
      const boutique = await this.boutiqueDe(rec, jour)
      if (boutique.possedes.includes(t.key)) throw new Error('Ce thème est déjà à toi')
      if (t.gagne) throw new Error(`Le thème ${t.nom} ne se vend pas : il se gagne avec ${t.gagne.regle}`)
      if (t.saison && !enBoutique(t, jour)) throw new Error(`Le thème ${t.nom} revient en boutique ${t.saison.periode}`)
      const prix = prixDe(t)
      const manque = prix - boutique.confettis.solde
      if (manque > 0) throw new Error(`Il te manque ${nConfettis(manque)} pour le thème ${t.nom}`)
      await this.client.batch(
        [
          {
            sql: 'INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, ?, ?)',
            args: [id, t.key, prix, Date.now()],
          },
          ...(porter ? [{ sql: 'UPDATE profiles SET theme = ? WHERE id = ?', args: [t.key, id] }] : []),
        ],
        'write',
      )
      if (porter) rec.theme = t.key
      return rec
    })
  }

  /**
   * Achète des vies pour les sentiers du savoir, au prix du jour
   * (`PRIX_D_UNE_VIE`) : elles attendent dans sa réserve, après celles du
   * jour, et ne périment pas. Refusé en clair s'il manque des confettis — un
   * autre onglet a pu dépenser entre-temps.
   */
  acheterVies(id: string, nombre: unknown, jour: string): Promise<number> {
    return this.unAchatALaFois(id, async () => {
      const rec = await this.require(id)
      const n = typeof nombre === 'number' && Number.isInteger(nombre) ? nombre : NaN
      if (!(n >= 1 && n <= VIES_PAR_ACHAT_MAX)) throw new Error(`Choisis de 1 à ${VIES_PAR_ACHAT_MAX} vies`)
      const prix = n * PRIX_D_UNE_VIE
      const manque = prix - (await this.boutiqueDe(rec, jour)).confettis.solde
      if (manque > 0) throw new Error(`Il te manque ${nConfettis(manque)} pour ${n > 1 ? `${n} vies` : 'une vie'}`)
      await this.client.execute({
        sql: 'INSERT INTO profile_vies (id, profile_id, nombre, prix, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [randomUUID(), id, n, prix, Date.now()],
      })
      return n
    })
  }

  /**
   * Achète un sablier pour sa série du quiz du jour, au prix du jour
   * (`PRIX_D_UN_SABLIER`) : il attend dans sa réserve qu'un jour manqué le
   * prenne. Deux au plus en réserve (`SABLIERS_MAX`) — au-delà, refusé en
   * clair, comme un solde trop court. La réserve se relit des jours joués
   * (`sabliersDe`), qu'on lui passe : le quiz du jour les connaît. `quand`
   * est l'heure du quiz du jour : un sablier ne couvre que les jours manqués
   * après son achat, et la série se lit à cette horloge-là.
   */
  acheterSablier(id: string, jour: string, enReserve: (profileId: string) => Promise<number>, quand = Date.now(), nombre = 1): Promise<number> {
    return this.unAchatALaFois(id, async () => {
      if (!Number.isInteger(nombre) || nombre < 1 || nombre > SABLIERS_MAX) throw new Error(`Un ou ${SABLIERS_MAX} sabliers à la fois`)
      const rec = await this.require(id)
      const deja = await enReserve(id)
      if (deja >= SABLIERS_MAX) throw new Error(`Tu as déjà ${SABLIERS_MAX} sabliers : un jour manqué en prendra un`)
      if (deja + nombre > SABLIERS_MAX) {
        const place = SABLIERS_MAX - deja
        throw new Error(`Tu as déjà ${deja > 1 ? `${deja} sabliers` : 'un sablier'} : il n’y a de place que pour ${place > 1 ? `${place} de plus` : 'un autre'}`)
      }
      const manque = nombre * PRIX_D_UN_SABLIER - (await this.boutiqueDe(rec, jour)).confettis.solde
      if (manque > 0) throw new Error(`Il te manque ${nConfettis(manque)} pour ${nombre > 1 ? `${nombre} sabliers` : 'un sablier'}`)
      // Une ligne par sablier, dans un seul lot : la série en compte un par jour manqué.
      await this.client.batch(
        Array.from({ length: nombre }, () => ({
          sql: 'INSERT INTO profile_sabliers (id, profile_id, prix, created_at) VALUES (?, ?, ?, ?)',
          args: [randomUUID(), id, PRIX_D_UN_SABLIER, quand],
        })),
        'write',
      )
      return enReserve(id)
    })
  }

  /** Toutes les vies qu'il a achetées : la campagne en retire celles qu'il a prises (`viesDe`). */
  async viesAcheteesDe(profileId: string): Promise<number> {
    const res = await this.client.execute({ sql: 'SELECT COALESCE(SUM(nombre), 0) AS n FROM profile_vies WHERE profile_id = ?', args: [profileId] })
    return Number(res.rows[0]?.n ?? 0)
  }

  /** Les vies achetées depuis cet instant, tous profils : l'administration dit si la boutique sert. */
  async viesAcheteesDepuis(depuis: number): Promise<number> {
    const res = await this.client.execute({ sql: 'SELECT COALESCE(SUM(nombre), 0) AS n FROM profile_vies WHERE created_at > ?', args: [depuis] })
    return Number(res.rows[0]?.n ?? 0)
  }

  /** Les achats de vies depuis cet instant, tous profils, avec ce qu'ils ont coûté : le QG les dit jour par jour. */
  async achatsDeViesDepuis(depuis: number): Promise<{ quand: number; nombre: number; prix: number }[]> {
    const res = await this.client.execute({ sql: 'SELECT created_at, nombre, prix FROM profile_vies WHERE created_at >= ?', args: [depuis] })
    return res.rows.map(r => ({ quand: Number(r.created_at), nombre: Number(r.nombre), prix: Number(r.prix) }))
  }

  /**
   * Ce que la page de l'économie lit des profils depuis un instant (le QG,
   * `/admin#economie`), tous profils, d'un aller-retour et par les index des
   * dates : les confettis de chaque soirée, au barème du solde
   * (`confettisDeSoiree`) et à sa première ligne de crédit ; les dons de
   * l'administrateur ; chaque achat, au prix payé ; les Éclats tombés.
   */
  async economieDepuis(depuis: number): Promise<{
    soirees: Mouvement[]
    dons: Mouvement[]
    missions: Mouvement[]
    coffres: Mouvement[]
    achats: Achat[]
    eclats: { quand: number; soiree: string }[]
  }> {
    const [soirees, dons, themes, compagnons, fonds, vies, sabliers, eclats, missions, coffres] = await this.client.batch(
      [
        // Une soirée se nomme d'abord par son jour (`archiveIdOf`) : lue par son nom, les lignes à part
        // (`#jour`…) n'en sont pas. La veille comprise : un premier quiz fini après minuit crédite le lendemain.
        { sql: 'SELECT detail, created_at FROM profile_xp WHERE soiree_id >= ? AND created_at >= ?', args: [jourAvant(jourDe(depuis), 1), depuis] },
        { sql: 'SELECT confettis, created_at FROM profile_dons WHERE created_at >= ?', args: [depuis] },
        // Un thème ou un compagnon tiré d'un coffre s'écrit à prix nul : ce n'est pas un achat.
        { sql: 'SELECT theme, prix, created_at FROM profile_achats WHERE created_at >= ? AND prix > 0', args: [depuis] },
        { sql: 'SELECT compagnon, prix, created_at FROM profile_compagnons WHERE created_at >= ? AND prix > 0', args: [depuis] },
        { sql: 'SELECT fond, prix, created_at FROM profile_fonds WHERE created_at >= ?', args: [depuis] },
        { sql: 'SELECT nombre, prix, created_at FROM profile_vies WHERE created_at >= ?', args: [depuis] },
        { sql: 'SELECT prix, created_at FROM profile_sabliers WHERE created_at >= ?', args: [depuis] },
        { sql: 'SELECT soiree_id, created_at FROM profile_eclats WHERE created_at >= ? AND soiree_id NOT LIKE ?', args: [depuis, `${PREFIXE_DES_DONS_D_ECLAT}%`] },
        { sql: 'SELECT rang, faite_le FROM profile_missions WHERE faite_le >= ?', args: [depuis] },
        { sql: 'SELECT confettis, ouvert_le FROM profile_coffres WHERE ouvert_le >= ? AND confettis > 0', args: [depuis] },
      ],
      'read',
    )
    const achat = (sorte: Achat['sorte'], r: Record<string, unknown>, objets: number, article: string | null): Achat => ({
      sorte,
      quand: Number(r.created_at),
      confettis: Number(r.prix),
      objets,
      article,
    })
    return {
      soirees: soirees.rows
        .map(r => {
          const { gain, releve } = decodeDetail(String(r.detail))
          return { quand: Number(r.created_at), confettis: confettisDeSoiree(gain, releve) }
        })
        .filter(m => m.confettis > 0),
      dons: dons.rows.map(r => ({ quand: Number(r.created_at), confettis: Number(r.confettis) })),
      // Chaque mission faite paie la sienne, la ligne des trois son bonus — aux règles du solde (`gainsDesMissions`).
      missions: missions.rows.map(r => ({
        quand: Number(r.faite_le),
        confettis: Number(r.rang) === RANG_DES_TROIS ? gainsDesMissions(0, 1).confettis : gainsDesMissions(1, 0).confettis,
      })),
      coffres: coffres.rows.map(r => ({ quand: Number(r.ouvert_le), confettis: Number(r.confettis) })),
      achats: [
        ...themes.rows.map(r => achat('themes', r, 1, String(r.theme))),
        ...compagnons.rows.map(r => achat('compagnons', r, 1, String(r.compagnon))),
        ...fonds.rows.map(r => achat('fonds', r, 1, String(r.fond))),
        ...vies.rows.map(r => achat('vies', r, Number(r.nombre), null)),
        ...sabliers.rows.map(r => achat('sabliers', r, 1, null)),
      ],
      eclats: eclats.rows.map(r => ({ quand: Number(r.created_at), soiree: String(r.soiree_id) })),
    }
  }

  /**
   * La part des profils dans chaque solde, tous profils, aux règles de
   * `boutiqueEtDons` sans rien écrire — sans les compagnons qui grandissent
   * à sa lecture : ce que chacun a gagné en soirée, ses dons, ses dépenses.
   * Le quiz du jour et la campagne viennent de leurs magasins. Toutes les
   * lignes, soirées comprises : le QG ne relit les soldes qu'une fois par
   * jour (`/admin#economie`).
   */
  async partsDesSoldes(): Promise<
    Map<string, { soirees: number; dons: number; missions: number; coffres: number; depenses: number; vuLe: number | null; suspendu: boolean }>
  > {
    const [profils, soirees, dons, missions, coffres, ...depenses] = await this.client.batch(
      [
        'SELECT id, last_seen_at, disabled_at FROM profiles',
        `SELECT profile_id, detail FROM profile_xp WHERE ${HORS_LIGNES_A_PART}`,
        'SELECT profile_id, SUM(confettis) AS n FROM profile_dons GROUP BY profile_id',
        {
          sql: 'SELECT profile_id, SUM(rang < ?) AS faites, SUM(rang = ?) AS trois FROM profile_missions WHERE faite_le IS NOT NULL GROUP BY profile_id',
          args: [RANG_DES_TROIS, RANG_DES_TROIS],
        },
        'SELECT profile_id, SUM(confettis) AS n FROM profile_coffres GROUP BY profile_id',
        'SELECT profile_id, SUM(prix) AS n FROM profile_achats GROUP BY profile_id',
        'SELECT profile_id, SUM(prix) AS n FROM profile_vies GROUP BY profile_id',
        'SELECT profile_id, SUM(prix) AS n FROM profile_sabliers GROUP BY profile_id',
        'SELECT profile_id, SUM(prix) AS n FROM profile_compagnons GROUP BY profile_id',
        'SELECT profile_id, SUM(prix) AS n FROM profile_fonds GROUP BY profile_id',
      ],
      'read',
    )
    const parts = new Map(
      profils.rows.map(r => [
        String(r.id),
        { soirees: 0, dons: 0, missions: 0, coffres: 0, depenses: 0, vuLe: r.last_seen_at == null ? null : Number(r.last_seen_at), suspendu: r.disabled_at != null },
      ]),
    )
    for (const r of missions.rows) {
      const part = parts.get(String(r.profile_id))
      if (part) part.missions += gainsDesMissions(Number(r.faites ?? 0), Number(r.trois ?? 0)).confettis
    }
    for (const r of coffres.rows) {
      const part = parts.get(String(r.profile_id))
      if (part) part.coffres += Number(r.n ?? 0)
    }
    for (const r of soirees.rows) {
      const part = parts.get(String(r.profile_id))
      if (!part) continue
      const { gain, releve } = decodeDetail(String(r.detail))
      part.soirees += confettisDeSoiree(gain, releve)
    }
    for (const r of dons.rows) {
      const part = parts.get(String(r.profile_id))
      if (part) part.dons += Number(r.n)
    }
    for (const res of depenses) {
      for (const r of res.rows) {
        const part = parts.get(String(r.profile_id))
        if (part) part.depenses += Number(r.n)
      }
    }
    return parts
  }

  /** Les thèmes, les compagnons et les fonds vendus, chacun ses ventes depuis toujours et depuis un instant : le QG, « Les meilleures ventes ». */
  async ventesDepuis(depuis: number): Promise<{ sorte: SorteDeVente; article: string; ventes: number; recentes: number }[]> {
    const [themes, compagnons, fonds] = await this.client.batch(
      [
        // Un thème offert ne se vend pas : à prix nul, ce n'est pas une vente.
        { sql: 'SELECT theme AS article, COUNT(*) AS ventes, SUM(created_at >= ?) AS recentes FROM profile_achats WHERE prix > 0 GROUP BY theme', args: [depuis] },
        { sql: 'SELECT compagnon AS article, COUNT(*) AS ventes, SUM(created_at >= ?) AS recentes FROM profile_compagnons WHERE prix > 0 GROUP BY compagnon', args: [depuis] },
        { sql: 'SELECT fond AS article, COUNT(*) AS ventes, SUM(created_at >= ?) AS recentes FROM profile_fonds WHERE prix > 0 GROUP BY fond', args: [depuis] },
      ],
      'read',
    )
    const lire = (sorte: SorteDeVente) => (r: Record<string, unknown>) => ({
      sorte,
      article: String(r.article),
      ventes: Number(r.ventes),
      recentes: Number(r.recentes ?? 0),
    })
    return [...themes.rows.map(lire('theme')), ...compagnons.rows.map(lire('compagnon')), ...fonds.rows.map(lire('fond'))]
  }

  /**
   * Les légendaires portés, clé par clé : ceux qu'un profil porte vraiment
   * (`legendairePorte` — rendu avec sa soirée, il ne se porte plus), ni
   * suspendu, ni Divin, ni portrait, ni compagnon. Les porteurs se chargent
   * d'un aller-retour (`byIds`) : le QG ne les compte qu'une fois par jour.
   */
  async legendairesPortes(): Promise<Map<string, number>> {
    const res = await this.client.execute("SELECT id FROM profiles WHERE legendaire LIKE 'lg:%' AND disabled_at IS NULL")
    const portes = new Map<string, number>()
    for (const p of await this.byIds(res.rows.map(r => String(r.id)))) {
      const porte = p ? this.legendairePorte(p) : null
      if (porte?.startsWith('lg:')) portes.set(porte, (portes.get(porte) ?? 0) + 1)
    }
    return portes
  }

  /**
   * Un achat à la fois par profil : deux partis ensemble — deux onglets, un
   * double toucher — liraient le même solde, et dépenseraient deux fois les
   * mêmes confettis. Le suivant attend celui-ci, qu'il réussisse ou non ; le
   * dernier parti libère la place.
   */
  private unAchatALaFois<T>(id: string, travail: () => Promise<T>): Promise<T> {
    const avant = this.achatsEnCours.get(id) ?? Promise.resolve()
    const achat = avant.then(travail)
    const fin = achat.catch(() => {})
    this.achatsEnCours.set(id, fin)
    void fin.then(() => {
      if (this.achatsEnCours.get(id) === fin) this.achatsEnCours.delete(id)
    })
    return achat
  }

  /** Les Divins descendus sur ce profil — la liste, jamais ce qui les a fait descendre. */
  divinsOf(id: string): string[] {
    return divinsDebloques(this.recompensesOf(id), this.acquis.get(id))
  }

  /**
   * Ce qu'une soirée a rangé sur l'étagère de chacun — prix, hauts faits,
   * paliers, Divins —, par profil, dans l'ordre où c'est tombé.
   *
   * La clôture raconte à partir d'ici, pas de ce que son propre passage
   * vient d'écrire : reprise après un refus du miroir, elle trouvait tout
   * déjà rangé par la tentative d'avant, et la fin de chaque téléphone se
   * taisait sur la Chouette, le Divin ou le palier que la soirée avait fait
   * tomber.
   */
  async rangesSousLaSoiree(soireeId: string, spaceId: string): Promise<Map<string, string[]>> {
    const res = await this.client.execute({
      sql: 'SELECT profile_id, badge FROM profile_badges WHERE space_id = ? AND soiree_id = ? ORDER BY created_at, rowid',
      args: [spaceId, soireeId],
    })
    const ranges = new Map<string, string[]>()
    for (const r of res.rows) {
      const id = String(r.profile_id)
      ranges.set(id, [...(ranges.get(id) ?? []), String(r.badge)])
    }
    return ranges
  }

  /**
   * Les légendaires et les Divins qu'il avait avant une soirée : son
   * étagère, moins une soirée pour chaque ligne que celle-ci y a rangée — un
   * haut fait tombé trois soirs en compte encore deux.
   */
  avantLaSoiree(id: string, deLaSoiree: readonly string[]): { legendaires: string[]; divins: string[] } {
    const avant = new Map(this.recompensesOf(id))
    for (const cle of deLaSoiree) {
      const n = (avant.get(cle) ?? 0) - 1
      if (n > 0) avant.set(cle, n)
      else avant.delete(cle)
    }
    const acquis = this.acquis.get(id)
    return { legendaires: legendairesDebloques(avant, acquis), divins: divinsDebloques(avant, acquis) }
  }

  /**
   * La courbe des niveaux s'est durcie : un profil garde le niveau qu'il avait
   * atteint. Au premier démarrage qui apporte la nouvelle courbe, chacun
   * retient le niveau que lui donnait l'ancienne, s'il est plus haut — et le
   * garde tant qu'elle le lui donne encore (`niveauDuProfil`). Même
   * mécanique que pour les légendaires : une transaction par durcissement,
   * avec son drapeau, pour que ce qui s'est joué entre-temps suive la courbe
   * du jour.
   */
  private async garderLesNiveauxAtteints(): Promise<void> {
    for (const { drapeau, pas } of COURBES_D_AVANT) {
      const fait = await this.client.execute({ sql: 'SELECT 1 FROM meta WHERE key = ?', args: [drapeau] })
      if (fait.rows.length > 0) continue
      const now = Date.now()
      const gardes = (await this.client.execute('SELECT id, xp FROM profiles')).rows.flatMap(r => {
        const xp = Number(r.xp ?? 0)
        const niveau = niveauSurCourbe(xp, pas)
        // Seul ce que la courbe du jour ne donne pas encore a besoin d'être gardé.
        return niveau > niveauPour(xp) ? [{ id: String(r.id), niveau }] : []
      })
      await this.client.batch(
        [
          ...gardes.map(g => ({
            sql: `INSERT INTO profile_niveaux (profile_id, pas, niveau, created_at) VALUES (?, ?, ?, ?)
                  ON CONFLICT(profile_id, pas) DO NOTHING`,
            args: [g.id, pas, g.niveau, now],
          })),
          { sql: 'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING', args: [drapeau, String(now)] },
        ],
        'write',
      )
      if (gardes.length > 0) console.log(`[profils] ${gardes.length} niveau(x) atteint(s) avant le durcissement de la courbe, gardé(s)`)
    }
  }

  /**
   * Un légendaire s'est durci : ce qu'un profil avait débloqué sous la règle
   * d'avant lui reste. Au premier démarrage qui apporte la nouvelle, chacun
   * retient, avec sa règle d'alors, chaque légendaire qu'il avait — il le
   * garde tant qu'elle tient : une soirée qu'on retire de l'historique
   * emporte encore ce qu'elle avait fait tomber.
   *
   * Chaque durcissement part en une transaction, avec le drapeau qui dit que
   * c'est fait : un démarrage interrompu recommence de zéro, le suivant ne
   * refait rien. Et ce qui tombe après s'en tient à la règle du jour — sans
   * le drapeau, chaque démarrage aurait rendu aux anciennes règles tout ce
   * qui s'était joué entre-temps. Une base neuve n'a rien à retenir, et pose
   * seulement le drapeau. Un légendaire déjà retenu garde sa première règle,
   * la plus douce.
   */
  private async garderLesLegendairesAcquis(): Promise<void> {
    for (const { drapeau, avant } of DURCISSEMENTS) {
      const fait = await this.client.execute({ sql: 'SELECT 1 FROM meta WHERE key = ?', args: [drapeau] })
      if (fait.rows.length > 0) continue
      const res = await this.client.execute('SELECT profile_id, badge, COUNT(*) AS n FROM profile_badges GROUP BY profile_id, badge')
      const parProfil = new Map<string, Map<string, number>>()
      for (const r of res.rows) {
        const id = String(r.profile_id)
        let m = parProfil.get(id)
        if (!m) parProfil.set(id, (m = new Map()))
        m.set(String(r.badge), Number(r.n))
      }
      const now = Date.now()
      const retenus = [...parProfil].flatMap(([profileId, recompenses]) =>
        Object.entries(avant)
          .filter(([, regle]) => conditionTenue(regle, recompenses))
          .map(([cle, regle]) => ({
            sql: `INSERT INTO profile_legendaires (profile_id, legendaire, regle, created_at) VALUES (?, ?, ?, ?)
                  ON CONFLICT(profile_id, legendaire) DO NOTHING`,
            args: [profileId, cle, JSON.stringify(regle), now],
          })),
      )
      await this.client.batch(
        [...retenus, { sql: 'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING', args: [drapeau, String(now)] }],
        'write',
      )
      if (retenus.length > 0) console.log(`[profils] ${retenus.length} légendaire(s) gagné(s) avant leur durcissement, gardé(s)`)
    }
  }

  /**
   * L'avatar dessiné qu'il porte, s'il l'a vraiment : un légendaire ou un
   * Divin rendu avec sa soirée (exclusion, essai effacé) ne se porte plus.
   * Un portrait, lui, s'est vérifié quand il l'a pris (`update`) : un palier
   * validé ne se reprend jamais — ni soirée retirée, ni épreuve effacée. Un
   * compagnon, s'il l'a acheté et a atteint sa forme — une forme atteinte ne
   * se perd jamais ; sa métamorphose, tant que l'Éclat brille sur lui : la
   * soirée retirée qui l'avait fait tomber la reprend.
   */
  legendairePorte(p: ProfileRec): string | null {
    if (!p.legendaire) return null
    if (portrait(p.legendaire)) return p.legendaire
    const forme = formeDeCompagnon(p.legendaire)
    if (forme) {
      const atteinte = (this.compagnons.get(p.id)?.get(forme.compagnon)?.rang ?? -1) >= forme.rang
      return atteinte && (!forme.metamorphose || this.brilleChez(p.id, forme.key)) ? forme.key : null
    }
    const a = divin(p.legendaire) ? this.divinsOf(p.id) : this.legendairesOf(p.id)
    return a.includes(p.legendaire) ? p.legendaire : null
  }

  /**
   * Le compagnon de sa niche (`loup`), s'il en a un : la ligne de chacune de
   * ses réponses le retient, et ses bonnes réponses le font grandir — qu'il le
   * porte ou non. Lu de mémoire : la salle le demande à chaque réponse.
   */
  compagnonDeLaNiche(p: ProfileRec): CleDeCompagnon | null {
    return compagnonDeLaNiche(p.niche, this.compagnonsOf(p.id))
  }

  /**
   * Les niches jamais choisies, figées une fois (le 19 octobre 2026) : la
   * règle donnait à qui n'avait rien choisi le compagnon qu'il portait, et
   * ôter son avatar faisait déménager son compagnon — et grandir un autre.
   * Chacun garde ce qu'elle lui donnait : celui qu'il portait, s'il en a
   * atteint la forme, sinon le plus grand des siens. Ce qui vient ensuite —
   * une adoption, un coffre — écrit sa niche ; seul un `niche: null` envoyé
   * la rend à la règle, qui ne lit plus l'avatar. Une transaction, avec son
   * drapeau : un démarrage interrompu recommence, le suivant ne refait rien.
   */
  private async installerLesNiches(): Promise<void> {
    if (await this.drapeau(NICHES_INSTALLEES)) return
    const lignes = await this.client.execute(
      'SELECT p.id, p.legendaire, c.compagnon, c.rang FROM profiles p JOIN profile_compagnons c ON c.profile_id = p.id WHERE p.niche IS NULL',
    )
    const parProfil = new Map<string, { portait: unknown; siens: Map<CleDeCompagnon, SienEnMemoire> }>()
    for (const r of lignes.rows) {
      const id = String(r.id)
      let lui = parProfil.get(id)
      if (!lui) parProfil.set(id, (lui = { portait: r.legendaire, siens: new Map() }))
      lireCompagnon(lui.siens, r)
    }
    const installees = [...parProfil].flatMap(([id, { portait, siens }]) => {
      const forme = formeDeCompagnon(portait)
      const porte = forme && (siens.get(forme.compagnon)?.rang ?? -1) >= forme.rang ? forme.compagnon : null
      const niche = compagnonDeLaNiche(porte, [...siens].map(([compagnon, s]) => ({ compagnon, rang: s.rang })))
      return niche ? [{ sql: 'UPDATE profiles SET niche = ? WHERE id = ? AND niche IS NULL', args: [niche, id] }] : []
    })
    await this.client.batch(
      [...installees, { sql: 'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING', args: [NICHES_INSTALLEES, String(Date.now())] }],
      'write',
    )
    if (installees.length > 0) console.log(`[profils] ${installees.length} niche(s) jamais choisie(s), figée(s) sur ce qu'elle(s) montrai(en)t`)
  }

  /**
   * Son savoir d'avant les sentiers, relu en base : ses bonnes réponses par
   * catégorie, soirées qui comptent et quiz du jour ensemble — ce qui
   * ouvrait ses portraits. La reprise le relit une fois
   * (`core/repriseDesPortraits.ts`) ; ses écussons, eux, comptent aussi la
   * campagne (`savoirHorsSoirees`).
   */
  async savoirDe(profileId: string): Promise<Record<string, number>> {
    const [soirees, jour] = await Promise.all([this.historiqueOf(profileId), this.savoirDuJour?.(profileId).then(s => s.categories) ?? {}])
    return justesParCategorie(carriereDe(soirees, { eclats: 0, niveau: 1 }).categories, jour)
  }

  /**
   * Ce qu'il sait hors des soirées — le quiz du jour, la campagne (séries,
   * épreuves des sentiers, défis) —, lu d'un coup : ses bonnes réponses par
   * catégorie et la base de sa précision. Elles s'ajoutent à celles de sa
   * carrière pour ses écussons, « Ma carrière » et sa précision
   * (`additionnerCategories`, `ficheDe`), sur sa page comme sur sa carte : un
   * seul chemin, pour que la salle ne lise pas d'autres chiffres que lui.
   * Une base qui se tait ôte la part de son mode, pas la page ni la carte.
   */
  async savoirHorsSoirees(profileId: string): Promise<Savoir> {
    const rien = (): Savoir => ({ categories: {}, qcm: 0, justes: 0 })
    const muette = (mode: string) => (e: unknown): Savoir => {
      console.error(`[profil] ${mode} illisible pour ses écussons et sa précision :`, e)
      return rien()
    }
    const [jour, campagne] = await Promise.all([
      this.savoirDuJour?.(profileId).catch(muette('quiz du jour')) ?? rien(),
      this.savoirDeCampagne?.(profileId).catch(muette('campagne')) ?? rien(),
    ])
    return additionnerSavoirs(jour, campagne)
  }

  /** Les paliers validés de ses sentiers : ce qui ouvre ses portraits et ses titres de maître. Aucun tant que la campagne n'est pas branchée. */
  async paliersDe(profileId: string): Promise<Paliers> {
    return (await this.paliersDesSentiers?.(profileId)) ?? {}
  }

  /**
   * Un avatar se porte s'il n'est pas de collection, ou si le niveau du
   * profil l'a ouvert. Sans profil, jamais : l'invité anonyme ne montre rien
   * qui dise ce qui lui manque, ni ce qu'un profil lui aurait donné.
   */
  peutPorter(p: ProfileRec | null, avatar: string): boolean {
    const requis = niveauRequis(avatar)
    return requis === 0 || (!!p && this.niveauOf(p) >= requis)
  }

  /**
   * L'avatar qu'il porte, s'il le peut encore : une soirée retirée de
   * l'historique qui le fait redescendre sous le niveau de son emoji de
   * collection laisse la place à l'avatar par défaut, sans rien réécrire —
   * il le retrouve dès qu'il remonte.
   */
  avatarPorte(p: ProfileRec): string {
    return this.peutPorter(p, p.avatar) ? p.avatar : DEFAULT_AVATAR
  }

  /**
   * Le titre qu'il porte, s'il l'a encore : une soirée retirée emporte son
   * haut fait, et le titre avec. Celui d'un maître s'est vérifié quand il
   * l'a pris (`update`) : son palier ne se reprend jamais.
   */
  titrePorte(p: ProfileRec): string | null {
    if (!p.titre) return null
    if (brancheDuMaitre(p.titre)) return p.titre
    const recompenses = this.recompensesOf(p.id)
    if (moisDuChampion(p.titre)) return (recompenses.get(p.titre) ?? 0) > 0 ? p.titre : null
    return hautsFaitsGagnes(recompenses).includes(p.titre) ? p.titre : null
  }

  /**
   * Les hauts faits qu'il a choisi de montrer, réduits à ceux qu'il a
   * encore ; null s'il laisse la carte montrer les plus durs — ou s'il ne
   * lui en reste aucun.
   */
  vitrineChoisie(p: ProfileRec): string[] | null {
    let cles: unknown
    try {
      cles = p.vitrine ? JSON.parse(p.vitrine) : null
    } catch {
      return null
    }
    if (!Array.isArray(cles)) return null
    const gagnes = new Set(hautsFaitsGagnes(this.recompensesOf(p.id)))
    const encore = cles.map(String).filter(k => gagnes.has(k))
    return encore.length > 0 ? encore : null
  }

  toPublic(p: ProfileRec): PublicProfile {
    const { niveau, acquis, requis } = progression(p.xp, this.gardesOf(p.id))
    const laurier = this.laurierPorte(p.id)
    const champion = this.championDe?.(p.id)
    const compagnons = this.compagnonsOf(p.id)
    const niche = this.compagnonDeLaNiche(p)
    return {
      id: p.id,
      login: p.login,
      name: p.name,
      avatar: this.avatarPorte(p),
      // La finition qu'on voit sur lui : celle qu'il a épinglée s'il peut
      // encore la porter, la plus belle qu'il a sinon.
      finition: finitionPortee(p.finition, niveau),
      finitionChoisie: choixDeFinition(p.finition, niveau),
      bordureChoisie: choixDeBordure(p.bordure),
      xp: p.xp,
      niveau,
      acquis,
      requis,
      ouvertes: finitionsOuvertes(niveau),
      eclats: this.eclatsOf(p.id),
      eclatsEteints: this.eteintsOf(p.id),
      // Toujours dit, zéro compris : la page fond ce profil dans celui qu'elle tient, et un champ absent garderait la réserve d'avant.
      eclatsEnReserve: this.reserveOf(p.id),
      // Un Divin ne se compte pas : un « 4 badges » devenu « 5 » sans rien
      // de neuf sur l'étagère dirait qu'il s'est passé quelque chose. Ni une
      // voie rangée — une saison, un légendaire gardé au bout de
      // l'expédition, un gardien réveillé au Cabinet : ils ne se montrent que
      // par leur légendaire.
      badges: [...(this.recompenses.get(p.id)?.keys() ?? [])].filter(k => !k.startsWith('dv:') && !estUneVoieRangee(k) && !moisDeLaPage(k)).length,
      legendaire: this.legendairePorte(p),
      legendaires: this.legendairesOf(p.id),
      divins: raconter(this.divinsOf(p.id)),
      // Absents sans compagnon, comme le laurier : rien de plus à lire pour qui n'en a pas.
      ...(compagnons.length > 0 && { compagnons }),
      ...(niche && { niche }),
      titre: this.titrePorte(p),
      vitrineChoisie: this.vitrineChoisie(p),
      ...(laurier && { laurier }),
      ...(champion && { champion }),
      theme: this.themePorte(p),
      gerbe: this.gerbePortee(p),
    }
  }

  /**
   * Le profil au complet, pour sa propre page : l'étagère, l'historique, la
   * fiche de carrière et tous les hauts faits, gagnés ou non. Cela coûte
   * quelques requêtes, et n'a donc rien à faire dans l'accusé de réception
   * que reçoit chaque téléphone qui rejoint une soirée. `paliers`, quand sa
   * page les a déjà demandés (`campagneDuProfil`).
   */
  async toDetail(
    p: ProfileRec,
    espace?: (spaceId: string) => { nom: string; slug: string } | null,
    historique?: Pick<ArchiveStore, 'titres' | 'joueurDuProfil'>,
    paliers?: Promise<Paliers>,
  ): Promise<PublicProfileDetail> {
    const [vitrine, soirees] = await Promise.all([this.badgesOf(p.id), this.historiqueOf(p.id)])
    // Le titre que l'historique donne AUJOURD'HUI à chaque soirée — un
    // renommage s'y voit, ce qu'un titre recopié au crédit n'aurait pas fait.
    const titres = historique ? await historique.titres(soirees.map(s => ({ spaceId: s.spaceId, id: s.soireeId }))) : new Map()
    for (const s of soirees) {
      // Une ligne créditée avant qu'on retienne l'invité le retrouve dans
      // l'archive, une fois pour toutes. Sans archive, pas de bilan à ouvrir.
      // Une archive qui ne le nomme pas (rangée avant les profils) retient
      // une chaîne vide : sinon on la relirait à chaque visite.
      if (s.joueurId !== null || !historique || !titres.has(`${s.spaceId}#${s.soireeId}`)) continue
      // Une panne (archive muette, écriture refusée) n'ôte que le lien de ce
      // soir : elle faisait répondre 500 à toute la page, et l'accueil
      // proposait « Retrouver mon profil » à quelqu'un de connecté. Rien
      // n'est retenu, et la prochaine visite relira.
      try {
        s.joueurId = await historique.joueurDuProfil(s.spaceId, s.soireeId, p.id)
        await this.retenirJoueur(p.id, s.soireeId, s.joueurId ?? '')
      } catch (e) {
        console.error(`[profil] joueur de « ${s.soireeId} » non relu :`, e)
      }
    }
    // Ses maîtres ouvrent le Cabinet de curiosités : lus avec son quiz du jour
    // et sa campagne, sans attendre l'un l'autre.
    // Le mois en cours du quiz du jour, et ses jours joués : ce qui manque à sa page du calendrier.
    const moisDuCalendrier = (this.moisDuJour?.() ?? '').slice(5, 7)
    const [jour, maitres, campagne, joursCeMois, ailleurs] = await Promise.all([
      this.statsDuJourDe(p.id),
      (paliers ?? this.paliersDe(p.id)).then(
        x => maitresDe(x).length,
        e => {
          console.error('[profil] sentiers illisibles pour ses fonds :', e)
          return 0
        },
      ),
      (this.statsDeCampagne?.(p.id) ?? Promise.resolve(AUCUNE_CAMPAGNE)).catch(e => {
        console.error('[profil] campagne illisible pour sa carrière :', e)
        return AUCUNE_CAMPAGNE
      }),
      (this.joursDuMois?.(p.id) ?? Promise.resolve(0)).catch(() => 0),
      this.savoirHorsSoirees(p.id),
    ])
    const carriere = carriereDe(soirees, {
      eclats: this.eclatsOf(p.id).length,
      niveau: this.niveauOf(p),
      jour,
      campagne,
    })
    return {
      ...this.toPublic(p),
      vitrine,
      soirees: soirees.map(s => {
        const chez = espace?.(s.spaceId) ?? null
        return {
          soireeId: s.soireeId,
          chez: chez?.nom ?? null,
          slug: chez?.slug ?? null,
          ...(espace && s.spaceId && !chez && { espaceFerme: true as const }),
          titre: titres.get(`${s.spaceId}#${s.soireeId}`) ?? null,
          joueurId: s.joueurId || null,
          xp: s.xp,
          gain: s.gain,
          releve: s.releve,
          at: s.at,
        }
      }),
      // Sa précision et ce qu'il sait, par catégorie : tous les modes de jeu.
      fiche: ficheDe(carriere, ailleurs),
      categories: additionnerCategories(carriere.categories, ailleurs.categories),
      hautsFaits: await this.hautsFaitsVus(p.id, carriere, vitrine),
      fond: this.fondPorte(p, jour, maitres),
      ...this.ouvertsDe(p, jour, maitres),
      calendrier: {
        pages: pagesOuvertes(this.recompensesOf(p.id)),
        dorees: pagesDorees(this.recompensesOf(p.id)),
        mois: moisDuCalendrier,
        joursCeMois,
      },
    }
  }

  /**
   * Ce qu'il peut porter que ses trophées, son quiz du jour, ses coffres et
   * ses maîtres lui ouvrent, de mémoire : ses fonds, ses gerbes, ses titres
   * datés. Sa page (`toDetail`) et ce que sa loge compte (`ceQueLaLogeLit`)
   * le lisent d'ici.
   */
  private ouvertsDe(p: ProfileRec, jour: { joues: number; victoires: number }, maitres: number) {
    return {
      fonds: this.fondsOuvertsDe(p, jour, maitres),
      gerbes: gerbesOuvertes(this.recompensesOf(p.id), this.tresorsOf(p.id)),
      titresDates: titresDeChampion(this.recompensesOf(p.id)),
    }
  }

  /**
   * Ce que sa loge compte de neuf (`ceQuIlAPorter`), sans le reste de sa
   * page : la pastille rouge de « Profil », que l'accueil, ses quiz, son
   * compte et le QG demandent à chaque affichage. Elle refaisait toute la
   * page — seize allers-retours vers la base, en quatre vagues, deux fois
   * ceux de l'accueil qu'elle accompagne — pour cinq lectures, ici d'une
   * seule vague (le banc du 16 octobre 2026 : au dixième de cœur de
   * l'hébergeur, chaque aller-retour coûte deux millisecondes de
   * processeur). Chaque champ vient du même endroit que dans sa page —
   * `profil-charge.test.ts` compare les deux comptes —, et le type oblige à
   * les donner tous : un champ que la loge lirait de plus ne s'oublierait
   * pas ici.
   */
  async ceQueLaLogeLit(p: ProfileRec): Promise<CeQueLaLogeLit> {
    const [etagere, jour, achats, campagne] = await Promise.all([
      this.etagereDe(p.id),
      this.statsDuJourDe(p.id),
      // Une base qui se tait ôte ce qu'elle dit — ses thèmes, ses sentiers,
      // ses bordures —, comme à sa page, pas tout le compte.
      this.achatsDe(p.id).catch(e => {
        console.error('[profil] boutique illisible pour sa loge :', e)
        return null
      }),
      this.lectureDeCampagne(p.id).catch(e => {
        console.error('[profil] campagne illisible pour sa loge :', e)
        return null
      }),
    ])
    const maitres = campagne ? maitresDe(campagne.paliers).length : 0
    const { niveau, ouvertes, eclats, legendaires, divins, compagnons } = this.toPublic(p)
    const lit: ToutDonne<CeQueLaLogeLit> = {
      niveau,
      ouvertes,
      eclats,
      legendaires,
      divins,
      compagnons,
      vitrine: etagere.map(r => ({ key: r.key })),
      hautsFaits: await this.hautsFaitsVus(p.id, null, []),
      sentiers: campagne?.paliers,
      bordures: campagne?.duels?.bordures,
      boutique: achats ? { possedes: this.themesPossedes(p, achats.themes, maitres) } : undefined,
      ...this.ouvertsDe(p, jour, maitres),
    }
    return lit
  }

  /**
   * Tout le catalogue des hauts faits, vu par ce profil : ceux de soirée avec
   * le nombre de fois, ceux de carrière avec leur palier et leur jauge. Ce
   * qu'on n'a pas encore se montre aussi — savoir ce qui vient donne envie de
   * revenir. Sans `carriere`, sans jauge : la loge ne compte que ce qu'il a.
   */
  private async hautsFaitsVus(id: string, carriere: Carriere | null, vitrine: readonly BadgePorte[]): Promise<HautFaitVu[]> {
    const recompenses = this.recompensesOf(id)
    const rarete = new Map(vitrine.map(b => [b.key, b]))
    const soiree: HautFaitVu[] = HAUTS_FAITS_REGAGNABLES.map(h => {
      const porte = rarete.get(h.key)
      const origine = origineDe(h)
      return {
        key: h.key,
        famille: 'soiree',
        ...(origine && { origine }),
        emoji: h.emoji,
        title: h.title,
        rule: h.rule,
        ton: h.ton,
        fois: recompenses.get(h.key) ?? 0,
        ...(porte && { rarete: porte.rarete, porteurs: porte.porteurs }),
      }
    })
    // Un trophée réservé aux rencontres ne se cite que là où elles s'ouvrent : l'album ne lui fait pas de case sans lui.
    const carrieres: HautFaitVu[] = HAUTS_FAITS_DE_CARRIERE.filter(h => !h.montreParLeServeur || this.rencontres).map(h => {
      let palier = 0
      for (let i = 1; i <= 3; i++) if ((recompenses.get(clePalier(h.key, i)) ?? 0) > 0) palier = i
      const porte = palier > 0 ? rarete.get(clePalier(h.key, palier)) : undefined
      const origine = origineDe(h)
      return {
        key: h.key,
        famille: 'carriere',
        ...(origine && { origine }),
        emoji: h.emoji,
        title: h.title,
        rule: h.mesure,
        ruleUne: h.mesureUne,
        ton: 'eclat',
        fois: palier,
        ...(carriere && { valeur: h.valeur(carriere) }),
        prochain: palier < 3 ? h.paliers[palier] : null,
        ...(porte && { rarete: porte.rarete, porteurs: porte.porteurs }),
      }
    })
    return [...soiree, ...carrieres]
  }

  // ── Inscription, connexion ──────────────────────────────────────────────

  /**
   * Crée un profil et rend le code de secours — la seule fois où il existe en
   * clair. Sans adresse e-mail : un profil est un bonus, pas une nécessité, et
   * le chemin anonyme reste ouvert à qui perd le sien.
   */
  async register(input: {
    login: unknown
    password: string
    name: unknown
    avatar: unknown
  }): Promise<{ profile: ProfileRec; recovery: string }> {
    const login = normalizeLogin(input.login)
    if (!isValidLogin(login)) {
      throw new Error('Identifiant : 2 à 32 caractères, lettres, chiffres, point, tiret')
    }
    const name = cleanName(input.name)
    if (!name) throw new Error('Il faut un prénom')
    if (await this.byLogin(login)) throw new Error('Cet identifiant est déjà pris')
    const recovery = newRecoveryCode()
    // Un profil neuf est au niveau 1 : aucun emoji de collection ne lui va
    // encore, et l'écran d'inscription n'en propose pas.
    const avatar = input.avatar ? cleanAvatar(input.avatar) : DEFAULT_AVATAR
    const rec: ProfileRec = {
      id: randomUUID(),
      login,
      name,
      avatar: niveauRequis(avatar) === 0 ? avatar : DEFAULT_AVATAR,
      finition: 'auto',
      legendaire: null,
      titre: null,
      vitrine: null,
      fond: null,
      theme: null,
      gerbe: null,
      bordure: null,
      niche: null,
      passwordHash: await hashPassword(input.password),
      recoveryHash: await hashPassword(normalizeRecovery(recovery)),
      xp: 0,
      createdAt: Date.now(),
      lastSeenAt: null,
      disabledAt: null,
      renommeLe: null,
    }
    await this.client
      .execute({
        sql: `INSERT INTO profiles (id, login, name, avatar, finition, password_hash, recovery_hash, xp, created_at, last_seen_at, disabled_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL)`,
        args: [rec.id, rec.login, rec.name, rec.avatar, rec.finition, rec.passwordHash, rec.recoveryHash, rec.createdAt],
      })
      .catch(e => {
        // Deux hachages séparent la vérification du dessus de cette écriture :
        // deux inscriptions simultanées au même identifiant — un envoi
        // retenté par un réseau hésitant — y passent ensemble, et la base
        // refuse la seconde. Elle doit lire « déjà pris », pas « Erreur serveur ».
        if (String((e as { message?: unknown } | null)?.message ?? '').includes('UNIQUE constraint failed: profiles.login')) {
          throw new Error('Cet identifiant est déjà pris')
        }
        throw e
      })
    this.profiles.set(rec.id, rec)
    this.eclats.set(rec.id, new Set())
    this.eteints.set(rec.id, new Set())
    this.recompenses.set(rec.id, new Map())
    this.compagnons.set(rec.id, new Map())
    this.tresors.set(rec.id, new Set())
    this.fondsAchetes.set(rec.id, new Set())
    // Né à l'instant, il se trouve tout de suite : l'ami qui le cherche est souvent à côté de lui.
    this.annuaire = null
    return { profile: rec, recovery }
  }

  /**
   * Un profil pour un compte d'animateur d'avant, qui n'en avait pas (un
   * seul profil, le choix du 3 octobre 2026) : le même identifiant, le même
   * mot de passe — son haché, recopié tel quel —, le nom du compte. Son code
   * de secours est tiré et jamais montré : la personne se connecte comme
   * avant, avec ses identifiants ; le jour où elle change de mot de passe,
   * c'est à son profil. Rend le profil, ou null si l'identifiant n'en ferait
   * pas un (format, ou déjà pris).
   */
  async adopter(compte: { login: string; name: string; passwordHash: string }): Promise<ProfileRec | null> {
    const login = normalizeLogin(compte.login)
    if (!isValidLogin(login) || (await this.byLogin(login))) return null
    const rec: ProfileRec = {
      id: randomUUID(),
      login,
      name: cleanName(compte.name) || login,
      avatar: DEFAULT_AVATAR,
      finition: 'auto',
      legendaire: null,
      titre: null,
      vitrine: null,
      fond: null,
      theme: null,
      gerbe: null,
      bordure: null,
      niche: null,
      passwordHash: compte.passwordHash,
      recoveryHash: await hashPassword(normalizeRecovery(newRecoveryCode())),
      xp: 0,
      createdAt: Date.now(),
      lastSeenAt: null,
      disabledAt: null,
      renommeLe: null,
    }
    await this.client.execute({
      sql: `INSERT INTO profiles (id, login, name, avatar, finition, password_hash, recovery_hash, xp, created_at, last_seen_at, disabled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL)`,
      args: [rec.id, rec.login, rec.name, rec.avatar, rec.finition, rec.passwordHash, rec.recoveryHash, rec.createdAt],
    })
    this.profiles.set(rec.id, rec)
    this.eclats.set(rec.id, new Set())
    this.eteints.set(rec.id, new Set())
    this.recompenses.set(rec.id, new Map())
    this.compagnons.set(rec.id, new Map())
    this.tresors.set(rec.id, new Set())
    this.fondsAchetes.set(rec.id, new Set())
    this.annuaire = null
    return rec
  }

  /** Un drapeau de la base permanente : une migration faite une fois pour toutes. */
  async drapeau(cle: string): Promise<boolean> {
    return (await this.client.execute({ sql: 'SELECT 1 FROM meta WHERE key = ?', args: [cle] })).rows.length > 0
  }

  async poserDrapeau(cle: string): Promise<void> {
    await this.client.execute({ sql: 'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING', args: [cle, String(Date.now())] })
  }

  /**
   * Le profil derrière un identifiant et un mot de passe, ou null. Un
   * identifiant inconnu coûte le même temps qu'un mot de passe faux : rien,
   * pas même la durée, ne dit si le profil existe.
   */
  async verify(login: unknown, password: string, fallbackHash: string): Promise<ProfileRec | null> {
    const verifie = await this.verifier(login, password, fallbackHash)
    return verifie && !verifie.suspendu ? verifie.profil : null
  }

  /**
   * Comme `verify`, avec le haché qu'on a vérifié : ce qui s'ouvre ensuite
   * se compare à lui (`profileRoutes.ts`, la connexion). Relu sur le profil
   * après coup, il était déjà celui d'un changement de mot de passe parti
   * entre-temps. Un profil suspendu se vérifie aussi, et le dit
   * (`suspendu`) : « incorrect » faisait retaper un mot de passe juste — ne
   * l'apprend que qui le connaît déjà, comme un compte en pause.
   */
  async verifier(login: unknown, password: string, fallbackHash: string): Promise<{ profil: ProfileRec; hachage: string; suspendu: boolean } | null> {
    const found = await this.parLoginMemeSuspendu(login)
    const hachage = found?.passwordHash
    const ok = await verifyPassword(password, hachage ?? fallbackHash)
    // Changé pendant que scrypt tournait : l'ancien mot de passe ne vaut plus rien.
    return found && hachage && ok && found.passwordHash === hachage ? { profil: found, hachage, suspendu: found.disabledAt !== null } : null
  }

  async setPassword(id: string, password: string): Promise<void> {
    const rec = await this.require(id)
    const passwordHash = await hashPassword(password)
    await this.client.execute({
      sql: 'UPDATE profiles SET password_hash = ? WHERE id = ?',
      args: [passwordHash, id],
    })
    rec.passwordHash = passwordHash
  }

  /** Réinitialise par le code de secours. Le code est consommé : on en rend un neuf. */
  async useRecovery(login: unknown, code: unknown, password: string, fallbackHash: string): Promise<string | null> {
    const found = await this.byLogin(login)
    const verifie = found?.recoveryHash
    const ok = await verifyPassword(normalizeRecovery(code), verifie ?? fallbackHash)
    if (!found || !ok) return null
    const recovery = newRecoveryCode()
    const passwordHash = await hashPassword(password)
    const recoveryHash = await hashPassword(normalizeRecovery(recovery))
    // Seulement si le code vérifié est encore celui de la base : deux
    // demandes parties ensemble — deux onglets, un envoi rejoué — passaient
    // toutes deux la vérification, et chacune montrait un code neuf ; seul le
    // dernier écrit valait, et l'autre écran faisait noter un code mort.
    const ecrit = await this.client.execute({
      sql: 'UPDATE profiles SET password_hash = ?, recovery_hash = ? WHERE id = ? AND recovery_hash = ?',
      args: [passwordHash, recoveryHash, found.id, verifie ?? null],
    })
    if (ecrit.rowsAffected === 0) return null
    found.passwordHash = passwordHash
    found.recoveryHash = recoveryHash
    // Un mot de passe changé ferme les sessions ouvertes ailleurs.
    await this.revokeAll(found.id)
    return recovery
  }

  /**
   * Change ce qu'un joueur choisit lui-même : son prénom, son emoji, sa
   * finition, son avatar légendaire ou divin.
   *
   * Choisir un emoji ôte le légendaire : on porte l'un ou l'autre. Un
   * légendaire ou un Divin qu'on n'a pas débloqué est refusé en clair — la
   * page ne le propose pas, seul un appel forgé l'enverrait.
   */
  async update(
    id: string,
    patch: {
      name?: unknown
      avatar?: unknown
      finition?: unknown
      legendaire?: unknown
      titre?: unknown
      vitrine?: unknown
      fond?: unknown
      theme?: unknown
      gerbe?: unknown
      eclat?: unknown
      bordure?: unknown
      niche?: unknown
      /** L'avatar sur lequel il dépense un Éclat en réserve (`donnerUnEclat`) : définitif. */
      eclatDeReserve?: unknown
    },
  ): Promise<ProfileRec> {
    const rec = await this.require(id)
    // Seules les colonnes demandées s'écrivent : la mémoire ne suit qu'après
    // coup, et un prénom changé sur le téléphone pendant que la tablette
    // change l'emoji ne doit pas revenir en arrière.
    const champs: Partial<Pick<ProfileRec, 'name' | 'avatar' | 'finition' | 'legendaire' | 'titre' | 'vitrine' | 'fond' | 'theme' | 'gerbe' | 'bordure' | 'niche'>> = {}
    if (patch.name !== undefined) {
      const name = cleanName(patch.name)
      if (!name) throw new Error('Il faut un prénom')
      champs.name = name
    }
    if (patch.avatar !== undefined) {
      const avatar = cleanAvatar(patch.avatar)
      const requis = niveauRequis(avatar)
      if (requis > this.niveauOf(rec)) throw new Error(`Cet avatar s’ouvre au niveau ${requis}`)
      champs.avatar = avatar
      champs.legendaire = null
    }
    if (patch.finition !== undefined) champs.finition = choixDeFinition(patch.finition, this.niveauOf(rec))
    if (patch.legendaire !== undefined) {
      if (patch.legendaire === null || patch.legendaire === '') champs.legendaire = null
      else if (legendaire(patch.legendaire) && this.legendairesOf(id).includes(String(patch.legendaire))) {
        champs.legendaire = String(patch.legendaire)
      } else if (divin(patch.legendaire) && this.divinsOf(id).includes(String(patch.legendaire))) {
        champs.legendaire = String(patch.legendaire)
      } else if (divin(patch.legendaire)) throw new Error('Ce Divin n’est pas encore descendu sur toi')
      else if (portrait(patch.legendaire)) {
        const p = portrait(patch.legendaire)!
        if (!portraitsOuverts(await this.paliersDe(id)).includes(p.key)) {
          throw new Error(`Ce portrait se gagne au palier ${p.palier} du sentier ${deLaBranche(brancheDe(p))}`)
        }
        champs.legendaire = p.key
      } else if (formeDeCompagnon(patch.legendaire)) {
        // Sa forme se vérifie sur ses bonnes réponses du moment : une forme
        // qu'il vient d'atteindre se porte sans attendre une autre lecture.
        const f = formeDeCompagnon(patch.legendaire)!
        this.verifierLaForme(f, compagnonDe(f), (await this.compagnonsDe(rec)).find(a => a.compagnon === f.compagnon))
        champs.legendaire = f.key
      } else throw new Error('Cet avatar légendaire n’est pas encore à toi')
    }
    // Le compagnon de sa niche : l'un de ceux qu'il a adoptés ; null le rend
    // à la règle (`compagnonDeLaNiche`).
    if (patch.niche !== undefined) {
      if (patch.niche === null || patch.niche === '') champs.niche = null
      else {
        const c = compagnonDuCatalogue(patch.niche)
        if (!c) throw new Error('Ce compagnon n’existe pas')
        if (!this.compagnons.get(id)?.has(c.key)) throw new Error(pourLAvoir(c))
        champs.niche = c.key
      }
    }
    // Un titre, une vitrine : seulement ce qu'il a gagné. La page ne propose
    // rien d'autre ; seul un appel forgé l'enverrait.
    if (patch.titre !== undefined) {
      const maitre = brancheDuMaitre(patch.titre)
      if (patch.titre === null || patch.titre === '') champs.titre = null
      else if (maitre) {
        if (!maitresDe(await this.paliersDe(id)).includes(maitre.key)) {
          throw new Error(`Ce titre se gagne au palier de maître du sentier ${deLaBranche(maitre)}`)
        }
        champs.titre = String(patch.titre)
      } else if (hautsFaitsGagnes(this.recompensesOf(id)).includes(String(patch.titre))) champs.titre = String(patch.titre)
      else if (moisDuChampion(String(patch.titre)) && (this.recompensesOf(id).get(String(patch.titre)) ?? 0) > 0) champs.titre = String(patch.titre)
      else throw new Error('Ce titre se gagne d’abord : c’est le nom d’un de tes hauts faits')
    }
    if (patch.vitrine !== undefined) {
      if (patch.vitrine === null) champs.vitrine = null
      else {
        const gagnes = new Set(hautsFaitsGagnes(this.recompensesOf(id)))
        const cles = Array.isArray(patch.vitrine) ? [...new Set(patch.vitrine.map(String))] : []
        if (cles.length === 0 || cles.length > VITRINE_MAX || !cles.every(k => gagnes.has(k))) {
          throw new Error(`Choisis de 1 à ${VITRINE_MAX} hauts faits parmi ceux que tu as gagnés`)
        }
        champs.vitrine = JSON.stringify(cles)
      }
    }
    // Un fond de carte : seulement l'un de ceux qu'il a gagnés.
    if (patch.fond !== undefined) {
      if (patch.fond === null || patch.fond === '') champs.fond = null
      else {
        const choisi = fond(patch.fond)
        if (!choisi) throw new Error('Ce fond de carte n’existe pas')
        const [jour, paliers] = await Promise.all([this.statsDuJourDe(id), this.paliersDe(id)])
        if (!this.fondsOuvertsDe(rec, jour, maitresDe(paliers).length).includes(choisi.key)) {
          throw new Error(`Ce fond se gagne d’abord : ${choisi.regle}`)
        }
        champs.fond = choisi.key
      }
    }
    // Un thème : l'un de ceux qu'il a, offerts ou achetés. Velours, celui de
    // toutes les soirées, s'écrit null.
    if (patch.theme !== undefined) {
      const vide = patch.theme === null || patch.theme === ''
      const choisi = vide ? null : themeDuCatalogue(patch.theme)
      if (!vide && !choisi) throw new Error('Ce thème n’existe pas')
      if (!choisi || choisi.key === 'velours') champs.theme = null
      else {
        if (choisi.gagne) {
          const maitres = 'maitres' in choisi.gagne.par ? maitresDe(await this.paliersDe(id)).length : 0
          if (!themeGagne(choisi, { maitres, recompenses: this.recompensesOf(id) })) {
            throw new Error(`Le thème ${choisi.nom} se gagne avec ${choisi.gagne.regle}`)
          }
        } else if (choisi.rarete !== 'offert' && !(await this.achatsDe(id)).themes.has(choisi.key)) {
          throw new Error(`Le thème ${choisi.nom} s’achète d’abord, en confettis`)
        }
        champs.theme = choisi.key
      }
    }
    // Une gerbe : seulement l'une de celles qu'il a gagnées ; null, celle de
    // tous ; et qui n'en veut aucune le dit (`AUCUNE_GERBE`).
    if (patch.gerbe !== undefined) {
      if (patch.gerbe === null || patch.gerbe === '') champs.gerbe = null
      else if (patch.gerbe === AUCUNE_GERBE) champs.gerbe = AUCUNE_GERBE
      else {
        const choisie = gerbe(patch.gerbe)
        if (!choisie) throw new Error('Cette gerbe n’existe pas')
        if (!gerbeOuverte(choisie, this.recompensesOf(id), this.tresorsOf(id))) throw new Error(`Cette gerbe se gagne avec ${choisie.regle}`)
        champs.gerbe = choisie.key
      }
    }
    // Une bordure de ligue : `auto` s'écrit null ; une ligue, seulement s'il
    // l'a atteinte en duel — ses crans, eux, se relisent à chaque lecture.
    if (patch.bordure !== undefined) {
      const auto = patch.bordure === null || patch.bordure === '' || patch.bordure === 'auto'
      const choix = auto ? 'auto' : choixDeBordure(patch.bordure)
      if (!auto && choix === 'auto') throw new Error('Cette bordure n’existe pas')
      if (choix !== 'auto' && choix !== AUCUNE_BORDURE) {
        const duels = await this.duelsDe?.(id)
        if (!duels?.bordures.some(b => b.ligue === choix)) throw new Error(`Cette bordure s’ouvre en atteignant la ${ligueParCle(choix).nom.toLowerCase()} en duel`)
      }
      champs.bordure = choix === 'auto' ? null : choix
    }
    // Un Éclat se garde, qu'on le porte ou non : on peut préférer la version
    // d'origine de l'avatar qui a éclaté, et y revenir. Seulement sur ce qui a
    // éclaté pour lui ; le reste de la carrière n'en sait rien.
    let eclat: { cle: string; eteint: boolean } | null = null
    if (patch.eclat !== undefined) {
      const e = patch.eclat as { cle?: unknown; brille?: unknown } | null
      const cle = typeof e?.cle === 'string' ? e.cle : ''
      if (!cle || !this.eclats.get(id)?.has(cle)) throw new Error('Cet avatar n’a pas éclaté pour toi')
      if (typeof e?.brille !== 'boolean') throw new Error('Choisis sa version rare ou sa version d’origine')
      eclat = { cle, eteint: !e.brille }
    }
    const aEclater = patch.eclatDeReserve !== undefined ? await this.verifierUnAvatarAEclater(rec, patch.eclatDeReserve) : null
    const colonnes = Object.keys(champs) as (keyof typeof champs)[]
    // Un prénom qu'il change lui-même tait l'annonce de celui que
    // l'administrateur avait changé : sur un autre téléphone, elle lui aurait
    // présenté son propre choix comme celui de l'administrateur.
    const taireLAnnonce = champs.name !== undefined && champs.name !== rec.name && rec.renommeLe !== null
    if (colonnes.length > 0) {
      await this.client.execute({
        sql: `UPDATE profiles SET ${[...colonnes.map(c => `${c} = ?`), ...(taireLAnnonce ? ['renomme_le = NULL'] : [])].join(', ')} WHERE id = ?`,
        args: [...colonnes.map(c => champs[c]!), id],
      })
      Object.assign(rec, champs)
      if (taireLAnnonce) rec.renommeLe = null
      // Un prénom changé se cherche sous le nouveau dès maintenant (`chercher`).
      if ('name' in champs) this.annuaire = null
    }
    if (eclat) {
      await this.client.execute({
        sql: 'UPDATE profile_eclats SET eteint = ? WHERE profile_id = ? AND avatar = ?',
        args: [eclat.eteint ? 1 : null, id, eclat.cle],
      })
      let eteints = this.eteints.get(id)
      if (!eteints) this.eteints.set(id, (eteints = new Set()))
      if (eclat.eteint) eteints.add(eclat.cle)
      else eteints.delete(eclat.cle)
    }
    if (aEclater) await this.depenserUnEclat(id, aEclater)
    return rec
  }

  async touchSeen(id: string): Promise<void> {
    const rec = this.profiles.get(id)
    if (!rec) return
    const now = Date.now()
    await this.client.execute({ sql: 'UPDATE profiles SET last_seen_at = ? WHERE id = ?', args: [now, id] })
    rec.lastSeenAt = now
  }

  // ── Sessions ────────────────────────────────────────────────────────────

  async createSession(profileId: string, userAgent: string): Promise<string> {
    const token = newToken()
    const now = Date.now()
    const rec: ProfileSessionRec = {
      id: fingerprint(token),
      profileId,
      expiresAt: now + SESSION_MS,
      lastSeenAt: now,
    }
    await this.client.execute({
      sql: `INSERT INTO profile_sessions (id, profile_id, created_at, expires_at, last_seen_at, user_agent)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [rec.id, profileId, now, rec.expiresAt, now, userAgent.slice(0, 200)],
    })
    this.sessions.set(rec.id, rec)
    return token
  }

  /**
   * L'identifiant du profil derrière un jeton, sans toucher à la base :
   * synchrone, pour que la poignée de main d'un socket n'attende pas. Le
   * profil lui-même se charge ensuite, avec `byId`.
   *
   * La mémoire y passe devant la base, exprès et sans risque : une session
   * expirée restée en base s'efface au démarrage suivant, et une expiration
   * qui n'aurait pas glissé en base ne fait que redemander le mot de passe.
   */
  sessionProfileId(token: string): string | null {
    const session = this.sessions.get(fingerprint(token))
    if (!session) return null
    const now = Date.now()
    if (session.expiresAt <= now) {
      this.sessions.delete(session.id)
      this.client.execute({ sql: 'DELETE FROM profile_sessions WHERE id = ?', args: [session.id] }).catch(() => {})
      return null
    }
    if (now - session.lastSeenAt > SLIDE_EVERY_MS) {
      session.lastSeenAt = now
      session.expiresAt = now + SESSION_MS
      this.client
        .execute({
          sql: 'UPDATE profile_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?',
          args: [now, session.expiresAt, session.id],
        })
        .catch(() => {})
    }
    this.vus.set(session.profileId, now)
    return session.profileId
  }

  /** Passé ces cinq dernières minutes (`EN_LIGNE_MS`) — à l'horloge de la machine, comme les sessions. */
  enLigne(profileId: string, maintenant = Date.now()): boolean {
    const vu = this.vus.get(profileId)
    return vu !== undefined && maintenant - vu < EN_LIGNE_MS
  }

  /** Combien de profils sont en ligne : le direct du QG, lu en mémoire comme `enLigne`. */
  combienEnLigne(maintenant = Date.now()): number {
    let n = 0
    for (const vu of this.vus.values()) if (maintenant - vu < EN_LIGNE_MS) n++
    return n
  }

  /**
   * Ce que le QG compte d'un profil depuis un instant, d'un seul lot : les
   * inscriptions, les achats — thèmes, vies, sabliers — et les soirées où il
   * a été crédité, à l'heure de leur premier crédit — la ligne se remplace,
   * sa date reste (`ligneDeCredit`) ; les lignes à part, `#jour` ou
   * `#campagne`, n'en sont pas. Des dates, qui pour les soirées, et ce qu'il
   * y a joué : de quoi compter le jour, les profils actifs et leur activité.
   */
  async activiteDepuis(depuis: number): Promise<{ inscriptions: number[]; achats: number[]; soirees: SoireeDUnProfil[] }> {
    const [inscrits, achats, soirees] = await this.client.batch(
      [
        { sql: 'SELECT created_at FROM profiles WHERE created_at >= ?', args: [depuis] },
        {
          sql: `SELECT created_at FROM profile_achats WHERE created_at >= ?
                UNION ALL SELECT created_at FROM profile_vies WHERE created_at >= ?
                UNION ALL SELECT created_at FROM profile_sabliers WHERE created_at >= ?`,
          args: [depuis, depuis, depuis],
        },
        { sql: `SELECT ${COLONNES_D_UNE_SOIREE_DU_QG} FROM profile_xp WHERE created_at >= ? AND ${HORS_LIGNES_A_PART}`, args: [depuis] },
      ],
      'read',
    )
    return {
      inscriptions: inscrits.rows.map(r => Number(r.created_at)),
      achats: achats.rows.map(r => Number(r.created_at)),
      soirees: soirees.rows.map(soireeDuQg),
    }
  }

  /** Les soirées d'un seul profil depuis un instant, lues comme celles de `activiteDepuis` : sa fiche au QG. */
  async soireesDuQgDe(profileId: string, depuis: number): Promise<SoireeDUnProfil[]> {
    const res = await this.client.execute({
      sql: `SELECT ${COLONNES_D_UNE_SOIREE_DU_QG} FROM profile_xp WHERE profile_id = ? AND created_at >= ? AND ${HORS_LIGNES_A_PART}`,
      args: [profileId, depuis],
    })
    return res.rows.map(soireeDuQg)
  }

  /**
   * Le profil d'une session encore ouverte, sans la faire glisser ni rien
   * écrire : le rappel du soir (`core/rappels.ts`) ne vaut que pour un
   * téléphone resté connecté — une déconnexion, un mot de passe changé, un
   * profil supprimé ou un an sans revenir le défont d'eux-mêmes.
   */
  profilDeLaSession(sessionId: string): string | null {
    const session = this.sessions.get(sessionId)
    return session && session.expiresAt > Date.now() ? session.profileId : null
  }

  /** Le profil derrière un jeton, chargé au besoin. */
  async bySession(token: string): Promise<ProfileRec | null> {
    const id = this.sessionProfileId(token)
    return id ? this.byId(id) : null
  }

  async revokeSession(token: string): Promise<void> {
    const id = fingerprint(token)
    // Oubliée en mémoire avant d'être effacée en base, une session que Turso
    // refusait d'effacer ne se retentait plus : elle revenait au réveil.
    if (!this.sessions.has(id)) return
    await this.client.execute({ sql: 'DELETE FROM profile_sessions WHERE id = ?', args: [id] })
    this.sessions.delete(id)
  }

  async revokeAll(profileId: string): Promise<void> {
    // Celles qu'on connaît avant d'écrire, et celles-là seulement : une
    // session ouverte pendant l'aller-retour, oubliée ici mais restée en
    // base, ressusciterait au réveil.
    const ids = [...this.sessions.values()].filter(s => s.profileId === profileId).map(s => s.id)
    await this.client.execute({ sql: 'DELETE FROM profile_sessions WHERE profile_id = ?', args: [profileId] })
    for (const id of ids) this.sessions.delete(id)
  }

  // ── Expérience et éclats ────────────────────────────────────────────────

  /**
   * Crédite (ou recrédite) une soirée. La ligne est remplacée, jamais
   * ajoutée : la soirée se recrédite après chaque quiz puis à sa clôture, et
   * le total doit rester celui du journal, pas celui des passages. Le total
   * du profil est ensuite recalculé de toutes ses lignes.
   */
  async creditSoiree(input: {
    profileId: string
    soireeId: string
    spaceId: string
    gain: GainSoiree
    releve: ReleveSoiree
    xp: number
    /** L'invité que ce profil était ce soir-là ; absent, celui déjà retenu reste. */
    playerId?: string
  }): Promise<number> {
    // La ligne et le total dans le même envoi : un aller-retour de moins par
    // profil, à chaque fin de quiz et à la clôture — et le total n'est
    // jamais lu entre les deux.
    try {
      return await this.recalculerTotal(input.profileId, ligneDeCredit(input))
    } finally {
      this.oublierSesSoirees([input.profileId])
    }
  }

  /**
   * Les crédits de toute une soirée en un seul aller-retour : ses lignes,
   * puis le total de chaque profil touché. Le recalcul au barème du jour en
   * faisait deux par profil, soirée après soirée : 3 094 requêtes pour 101
   * soirées, 68 s de démarrage à 20 ms de latence — avant l'ouverture du
   * port. Même lignes, mêmes totaux que `creditSoiree`.
   */
  async crediterSoireeEntiere(
    soireeId: string,
    spaceId: string,
    gains: { profileId: string; gain: GainSoiree; releve: ReleveSoiree; xp: number; playerId?: string }[],
  ): Promise<void> {
    if (gains.length === 0) return
    const ids = [...new Set(gains.map(g => g.profileId))]
    let resultats: ResultSet[]
    try {
      resultats = await this.client.batch(
        [
          ...gains.map(g => ligneDeCredit({ ...g, soireeId, spaceId })),
          ...ids.map(id => ({
            sql: 'UPDATE profiles SET xp = (SELECT COALESCE(SUM(xp), 0) FROM profile_xp WHERE profile_id = ?) WHERE id = ?',
            args: [id, id],
          })),
          { sql: `SELECT id, xp FROM profiles WHERE id IN (${ids.map(() => '?').join(', ')})`, args: ids },
        ],
        'write',
      )
    } finally {
      this.oublierSesSoirees(ids)
    }
    for (const r of resultats[resultats.length - 1].rows) {
      const rec = this.profiles.get(String(r.id))
      if (rec) rec.xp = Number(r.xp)
    }
  }

  /**
   * Relit en un aller-retour les totaux et les récompenses de ces profils.
   * Après des écritures menées de front, la mémoire a pu garder la réponse
   * arrivée la dernière plutôt que la plus récente : la base, elle, fait foi.
   */
  async relireProfils(profileIds: string[]): Promise<void> {
    if (profileIds.length === 0) return
    const res = await this.client.execute({
      sql: `SELECT id, xp FROM profiles WHERE id IN (${profileIds.map(() => '?').join(', ')})`,
      args: profileIds,
    })
    for (const r of res.rows) {
      const rec = this.profiles.get(String(r.id))
      if (rec) rec.xp = Number(r.xp)
    }
    this.porteurs = null
    await this.recompterRecompenses(profileIds)
  }

  /**
   * Le total d'un profil, recalculé de toutes ses lignes — en base, puis en
   * mémoire. `avant`, s'il est donné, s'écrit dans la même transaction.
   */
  private async recalculerTotal(profileId: string, avant?: InStatement): Promise<number> {
    const res = await this.client.batch(
      [
        ...(avant ? [avant] : []),
        {
          sql: 'UPDATE profiles SET xp = (SELECT COALESCE(SUM(xp), 0) FROM profile_xp WHERE profile_id = ?) WHERE id = ?',
          args: [profileId, profileId],
        },
        { sql: 'SELECT xp FROM profiles WHERE id = ?', args: [profileId] },
      ],
      'write',
    )
    const apres = res[res.length - 1]
    const total = Number(apres.rows[0]?.xp ?? 0)
    const rec = this.profiles.get(profileId)
    if (rec) rec.xp = total
    return total
  }

  /**
   * Reprend à un profil ce qu'une soirée lui avait crédité : sa ligne
   * d'expérience, l'Éclat tiré sous son nom, et ce qu'elle avait rangé sur
   * son étagère. Le total se recalcule sur ce qui reste, dans la même
   * transaction — le profil n'est jamais lu entre les deux. Un Éclat tiré
   * lors d'une autre soirée reste : il n'a rien à voir avec celle-ci. Rend
   * le nouveau total.
   */
  async retirerSoiree(profileId: string, soireeId: string): Promise<number> {
    let eclats: ResultSet
    try {
      ;[eclats] = await this.client.batch(
        [
          { sql: 'SELECT avatar FROM profile_eclats WHERE profile_id = ? AND soiree_id = ?', args: [profileId, soireeId] },
          { sql: 'DELETE FROM profile_eclats WHERE profile_id = ? AND soiree_id = ?', args: [profileId, soireeId] },
          { sql: 'DELETE FROM profile_xp WHERE profile_id = ? AND soiree_id = ?', args: [profileId, soireeId] },
          { sql: 'DELETE FROM profile_badges WHERE profile_id = ? AND soiree_id = ?', args: [profileId, soireeId] },
        ],
        'write',
      )
    } finally {
      this.oublierSesSoirees([profileId])
    }
    for (const r of eclats.rows) {
      this.eclats.get(profileId)?.delete(String(r.avatar))
      this.eteints.get(profileId)?.delete(String(r.avatar))
      this.reserves.get(profileId)?.delete(String(r.avatar))
    }
    this.porteurs = null
    await this.ecrireXpDesPaliers(profileId)
    await this.recompterRecompenses([profileId])
    return this.recalculerTotal(profileId)
  }

  /**
   * Reprend tout ce que les soirées d'un espace avaient crédité — archivées
   * ou en cours : son compte est supprimé, et l'administrateur a choisi de
   * reprendre (un compte qui fabriquait des soirées). Soirée par soirée,
   * comme on la retire de l'historique ; interrompu, un second essai reprend
   * où il en était. Rend le nombre de soirées reprises.
   */
  async retirerEspace(spaceId: string): Promise<number> {
    if (!spaceId) return 0
    const res = await this.client.execute({
      sql: 'SELECT soiree_id FROM profile_xp WHERE space_id = ? UNION SELECT soiree_id FROM profile_badges WHERE space_id = ?',
      args: [spaceId, spaceId],
    })
    const soirees = res.rows.map(r => String(r.soiree_id))
    for (const soireeId of soirees) await this.retirerSoireeEntiere(soireeId, spaceId)
    return soirees.length
  }

  /**
   * Efface tout ce qu'une soirée avait crédité, à tous ses profils : c'était
   * un essai, ou on la retire de l'historique. Expérience, Éclats, prix,
   * hauts faits — et les paliers de carrière qu'elle avait fait tomber : une
   * soirée qui n'a pas eu lieu ne laisse rien derrière elle. Rend les profils
   * touchés.
   */
  async retirerSoireeEntiere(soireeId: string, spaceId: string): Promise<string[]> {
    // Tout se lit d'abord, sans rien changer : les profils touchés, et les
    // paliers qu'ils garderont une fois la soirée partie.
    const [xp, badges, eclats] = await this.client.batch(
      [
        { sql: 'SELECT DISTINCT profile_id FROM profile_xp WHERE soiree_id = ? AND space_id = ?', args: [soireeId, spaceId] },
        { sql: 'SELECT DISTINCT profile_id FROM profile_badges WHERE soiree_id = ? AND space_id = ?', args: [soireeId, spaceId] },
        { sql: 'SELECT profile_id, avatar FROM profile_eclats WHERE soiree_id = ?', args: [soireeId] },
      ],
      'read',
    )
    const touches = [...new Set([...xp.rows, ...badges.rows, ...eclats.rows].map(r => String(r.profile_id)))]
    const paliers = new Map<string, string[]>(touches.map(id => [id, []]))
    if (touches.length > 0) {
      const restants = await this.client.execute({
        sql: `SELECT profile_id, badge FROM profile_badges
              WHERE profile_id IN (${touches.map(() => '?').join(', ')}) AND ${BADGES_DE_LA_LIGNE}
                AND NOT (soiree_id = ? AND space_id = ?)`,
        args: [...touches, soireeId, spaceId],
      })
      for (const r of restants.rows) paliers.get(String(r.profile_id))?.push(String(r.badge))
    }
    // Puis un seul lot, qui passe entier ou pas du tout : les lignes de la
    // soirée, et avec elles la ligne des paliers et le total de chaque
    // profil. Effacée à moitié — les lignes parties, les totaux pas encore
    // réécrits —, la soirée laissait des profils faux qu'un second essai ne
    // retrouvait plus : il ne voyait plus rien à reprendre.
    try {
      await this.client.batch(
        [
          { sql: 'DELETE FROM profile_xp WHERE soiree_id = ? AND space_id = ?', args: [soireeId, spaceId] },
          { sql: 'DELETE FROM profile_badges WHERE soiree_id = ? AND space_id = ?', args: [soireeId, spaceId] },
          // Les Éclats ne portent pas l'espace : l'identifiant d'une soirée
          // (sa date, une empreinte de l'heure et une de l'espace) suffit à la
          // désigner. Celles d'avant l'empreinte de l'espace n'en ont pas : deux
          // d'entre elles nées à la même milliseconde se confondraient ici.
          { sql: 'DELETE FROM profile_eclats WHERE soiree_id = ?', args: [soireeId] },
          ...touches.flatMap(id => [
            this.ligneDesPaliers(id, paliers.get(id)!),
            { sql: 'UPDATE profiles SET xp = (SELECT COALESCE(SUM(xp), 0) FROM profile_xp WHERE profile_id = ?) WHERE id = ?', args: [id, id] },
          ]),
        ],
        'write',
      )
    } finally {
      this.oublierSesSoirees(touches)
    }
    for (const r of eclats.rows) {
      this.eclats.get(String(r.profile_id))?.delete(String(r.avatar))
      this.eteints.get(String(r.profile_id))?.delete(String(r.avatar))
      this.reserves.get(String(r.profile_id))?.delete(String(r.avatar))
    }
    this.porteurs = null
    await this.recompterRecompenses(touches)
    if (touches.length > 0) {
      const totaux = await this.client.execute({
        sql: `SELECT id, xp FROM profiles WHERE id IN (${touches.map(() => '?').join(', ')})`,
        args: touches,
      })
      for (const r of totaux.rows) {
        const rec = this.profiles.get(String(r.id))
        if (rec) rec.xp = Number(r.xp ?? 0)
      }
    }
    return touches
  }

  /**
   * Ceux qui ne sont plus dans la soirée rendent ce qu'elle leur avait
   * crédité : l'invité exclu (invariant 10). Son exclusion le reprend sur le
   * moment (`rendreCredit`), mais un hoquet de la base à cet instant, et
   * personne ne le rejouait — les crédits suivants et la clôture ne
   * réécrivent que les profils encore là. La clôture reprend donc, pour la
   * soirée entière, les lignes de ceux qu'elle ne crédite plus. Rend les
   * profils touchés.
   */
  async retirerAbsents(soireeId: string, spaceId: string, presents: readonly string[]): Promise<string[]> {
    const res = await this.client.execute({
      sql: 'SELECT DISTINCT profile_id FROM profile_xp WHERE soiree_id = ? AND space_id = ?',
      args: [soireeId, spaceId],
    })
    const absents = res.rows.map(r => String(r.profile_id)).filter(id => !presents.includes(id))
    for (const id of absents) await this.retirerSoiree(id, soireeId)
    return absents
  }

  /**
   * Ce que cette soirée avait déjà crédité à ce profil, s'il y a une ligne —
   * de quoi savoir si l'Éclat s'y est déjà tiré.
   */
  async creditPrecedent(profileId: string, soireeId: string): Promise<{ xp: number; gain: GainSoiree } | null> {
    const rows = await this.client.execute({
      sql: 'SELECT xp, detail FROM profile_xp WHERE profile_id = ? AND soiree_id = ? LIMIT 1',
      args: [profileId, soireeId],
    })
    const r = rows.rows[0]
    return r ? { xp: Number(r.xp), gain: decodeDetail(String(r.detail)).gain } : null
  }

  /**
   * Ce qui éclatera si l'Éclat tombe sur ce profil ce soir : le légendaire
   * qu'il porte, ou l'emoji qu'il a joué (`cibleEclat`). Un compagnon n'éclate
   * qu'une fois, quelle que soit sa forme : déjà éclaté, la cible est son
   * Éclat d'avant, et le tirage tombe dans le vide (`grantEclat`).
   */
  cibleEclatDe(profileId: string, emoji: string): string {
    const p = this.profiles.get(profileId)
    const cible = cibleEclat(p ? this.legendairePorte(p) : null, emoji)
    return clesQuiBrillent(this.eclats.get(profileId) ?? [], cible)[0] ?? cible
  }

  /**
   * Ce qui a éclaté pour ce profil sous ce nom — une soirée, un jour du quiz
   * du jour, une semaine du défi —, s'il y en a un : la fin de la soirée ou
   * de la partie l'annonce. Tombé en silence, un Éclat passait inaperçu, et
   * plus encore sous un légendaire.
   */
  async eclatSous(profileId: string, sous: string): Promise<string | null> {
    // Rien n'a jamais éclaté pour lui : la fin du quiz du jour, relue à
    // chaque visite, ne demande rien de plus à la base.
    if (this.eclats.get(profileId)?.size === 0) return null
    const res = await this.client.execute({
      sql: 'SELECT avatar FROM profile_eclats WHERE profile_id = ? AND soiree_id = ? ORDER BY created_at LIMIT 1',
      args: [profileId, sous],
    })
    return res.rows.length > 0 ? String(res.rows[0].avatar) : null
  }

  /**
   * Fait éclater un emoji ou un légendaire pour ce profil, définitivement.
   * Rend faux s'il brillait déjà — le tirage est alors tombé dans le vide, et
   * c'est très bien : l'Éclat est une surprise, pas une récompense due.
   */
  async grantEclat(profileId: string, avatar: string, soireeId: string): Promise<boolean> {
    const deja = this.eclats.get(profileId)
    if (deja?.has(avatar)) return false
    const res = await this.client.execute({
      sql: `INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at)
            VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, avatar) DO NOTHING`,
      args: [profileId, avatar, soireeId, Date.now()],
    })
    if (res.rowsAffected === 0) return false
    deja?.add(avatar)
    return true
  }

  /**
   * Le tirage de l'Éclat : une chance sur `chance` — `CHANCE_ECLAT`, une fois
   * par soirée ; au quiz du jour et au défi de la semaine, la leur
   * (`tirerUnEclat`). Un test qui le remplace le fait taire, ou tomber,
   * partout à la fois.
   */
  static tirageEclat(chance: number = CHANCE_ECLAT, hasard: () => number = Math.random): boolean {
    return hasard() * chance < 1
  }

  /**
   * L'Éclat hors d'une soirée — à la fin d'une partie du quiz du jour, d'une
   * tentative du défi de la semaine —, tiré par qui l'appelle une seule fois
   * par partie : une partie ne finit qu'une fois. Il tombe, comme en soirée,
   * sur ce qu'il porte (`cibleEclatDe`), et se range sous `sous` — le jour,
   * la semaine : aucune soirée ne porte ce nom, en retirer une ne le reprend
   * donc jamais. Puis les paliers de La Pluie d'Éclats qu'il fait atteindre,
   * sous le même nom. Rend ce qui a éclaté et ces paliers, ou null : le
   * tirage est tombé à côté, ou sur un avatar qui brillait déjà.
   */
  async tirerUnEclat(profileId: string, sous: string, chance: number): Promise<{ avatar: string; paliers: string[] } | null> {
    if (!ProfileStore.tirageEclat(chance)) return null
    const profil = await this.byId(profileId)
    if (!profil) return null
    const avatar = await this.donnerUnEclat(profileId, this.avatarPorte(profil), sous)
    // En réserve, il ne compte pour la Pluie d'Éclats que dépensé (`depenserUnEclat`).
    return { avatar, paliers: estEnReserve(avatar) ? [] : await this.accorderPaliersDesEclats(profileId, sous) }
  }

  /**
   * Le tirage a réussi : l'Éclat tombe sur ce qu'il porte (`cibleEclatDe`),
   * ou, si cela avait déjà éclaté, il attend en réserve — il se perdait, et
   * le joueur qui portait un avatar éclaté ne gagnait rien d'un tirage heureux.
   * Rend ce qui a éclaté, ou la clé de l'Éclat en réserve (`estEnReserve`).
   */
  async donnerUnEclat(profileId: string, emoji: string, sous: string): Promise<string> {
    const avatar = this.cibleEclatDe(profileId, emoji)
    if (await this.grantEclat(profileId, avatar, sous)) return avatar
    const cle = `${PREFIXE_DE_LA_RESERVE}${randomUUID()}`
    await this.client.execute({
      sql: 'INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, ?, ?, ?)',
      args: [profileId, cle, sous, Date.now()],
    })
    let reserve = this.reserves.get(profileId)
    if (!reserve) this.reserves.set(profileId, (reserve = new Set()))
    reserve.add(cle)
    return cle
  }

  /** Combien d'Éclats attendent d'être dépensés (`donnerUnEclat`). */
  reserveOf(profileId: string): number {
    return this.reserves.get(profileId)?.size ?? 0
  }

  /**
   * Vérifie qu'un Éclat en réserve peut éclater cet avatar : il en a un, c'est
   * un avatar à lui (légendaire, portrait, forme d'un compagnon, emoji de son
   * niveau), pas un Divin, et il n'a pas déjà éclaté. Rend la clé nettoyée ;
   * le refus se dit en clair — seul un appel forgé l'enverrait.
   */
  private async verifierUnAvatarAEclater(rec: ProfileRec, brute: unknown): Promise<string> {
    if (this.reserveOf(rec.id) === 0) throw new Error('Tu n’as aucun Éclat en réserve')
    const cle = typeof brute === 'string' ? brute : ''
    if (divin(cle)) throw new Error('Un Divin n’éclate jamais')
    const f = formeDeCompagnon(cle)
    const p = portrait(cle)
    if (legendaire(cle)) {
      if (!this.legendairesOf(rec.id).includes(cle)) throw new Error('Cet avatar légendaire n’est pas encore à toi')
    } else if (p) {
      if (!portraitsOuverts(await this.paliersDe(rec.id)).includes(p.key)) throw new Error('Ce portrait n’est pas encore à toi')
    } else if (f) {
      this.verifierLaForme(f, compagnonDe(f), (await this.compagnonsDe(rec)).find(a => a.compagnon === f.compagnon))
    } else if (AVATARS.includes(cle) || COLLECTION.some(c => c.emoji === cle)) {
      if (niveauRequis(cle) > this.niveauOf(rec)) throw new Error(`Cet avatar s’ouvre au niveau ${niveauRequis(cle)}`)
    } else throw new Error('Choisis un de tes avatars')
    if (clesQuiBrillent(this.eclatsOf(rec.id), cle).length > 0) throw new Error('Cet avatar a déjà éclaté')
    return cle
  }

  /**
   * Dépense un Éclat en réserve sur un avatar vérifié (`verifierUnAvatarAEclater`).
   * La ligne de la réserve devient celle de l'avatar : elle garde la soirée,
   * le jour ou la semaine où l'Éclat est tombé, et suit leur sort. La
   * mémoire change avant la base, d'un seul tenant : deux dépenses parties
   * ensemble ne prennent ni le même Éclat ni le même avatar. Puis les
   * paliers de La Pluie d'Éclats qu'il fait atteindre, sous le même nom.
   */
  private async depenserUnEclat(profileId: string, cle: string): Promise<void> {
    const reserve = this.reserves.get(profileId)
    const uid = reserve && [...reserve][0]
    let siens = this.eclats.get(profileId)
    if (!siens) this.eclats.set(profileId, (siens = new Set()))
    if (!reserve || !uid) throw new Error('Tu n’as aucun Éclat en réserve')
    if (clesQuiBrillent([...siens], cle).length > 0) throw new Error('Cet avatar a déjà éclaté')
    reserve.delete(uid)
    siens.add(cle)
    let sous: string
    try {
      const lue = await this.client.execute({ sql: 'SELECT soiree_id FROM profile_eclats WHERE profile_id = ? AND avatar = ?', args: [profileId, uid] })
      sous = String(lue.rows[0]?.soiree_id ?? '')
      const res = await this.client.execute({
        sql: 'UPDATE profile_eclats SET avatar = ? WHERE profile_id = ? AND avatar = ?',
        args: [cle, profileId, uid],
      })
      if (!sous || res.rowsAffected === 0) throw new Error('Cet Éclat n’est plus là')
    } catch (e) {
      siens.delete(cle)
      // Une soirée effacée pendant ce temps a repris sa ligne : l'Éclat n'existe plus.
      if (!(e instanceof Error && e.message === 'Cet Éclat n’est plus là')) reserve.add(uid)
      throw e
    }
    await this.accorderPaliersDesEclats(profileId, sous).catch(e => console.error('[éclat] paliers non rangés :', e))
  }

  /**
   * Les paliers de La Pluie d'Éclats qu'un Éclat tiré hors d'une soirée fait
   * atteindre, rangés sous `sous`. Les Éclats d'une soirée qui se joue
   * encore n'y comptent pas, comme à une clôture (`accorderPaliers`) :
   * effacée comme un essai, elle laissait le palier sans son Éclat. Sa
   * clôture, si elle est gardée, les recomptera.
   */
  private async accorderPaliersDesEclats(profileId: string, sous: string): Promise<string[]> {
    const enCours = this.soireesEnCours?.() ?? new Set<string>()
    const ecartees = enCours.size === 0 ? [] : (await this.historiqueOf(profileId)).filter(s => enCours.has(cleDeSoiree(s.spaceId, s.soireeId)))
    const eclats = await this.eclatsHors(profileId, new Set(ecartees.map(s => s.soireeId)))
    return this.accorderDesPaliers(profileId, sous, paliersDesEclats(eclats))
  }

  /**
   * Combien d'avatars ont éclaté pour lui, sans ceux des soirées écartées
   * (leurs noms). Les Éclats ne portent que le nom de la soirée : un nom
   * d'avant l'empreinte de l'espace partagé avec une soirée écartée l'écarte
   * aussi — un palier qui attend, jamais un palier de trop.
   */
  private async eclatsHors(profileId: string, noms: ReadonlySet<string>): Promise<number> {
    if (noms.size === 0) return this.eclatsOf(profileId).length
    const res = await this.client.execute({ sql: 'SELECT soiree_id, avatar FROM profile_eclats WHERE profile_id = ?', args: [profileId] })
    // Un Éclat en réserve n'a pas encore éclaté : il ne compte pas.
    return res.rows.filter(r => !estEnReserve(String(r.avatar)) && !noms.has(String(r.soiree_id))).length
  }

  // ── L'étagère ───────────────────────────────────────────────────────────
  //
  // Une ligne par récompense ET par soirée où elle est tombée : la clé rend
  // la consolidation idempotente, et compter les lignes donne gratuitement
  // le nombre de fois. Trois sortes de lignes s'y côtoient :
  //   · les prix de soirée (`eclair`, `cancre`…), ceux du palmarès ;
  //   · les hauts faits de soirée (`hf:phenix`…), qui se regagnent ;
  //   · les paliers de carrière (`hf:bavard:2`), qui ne tombent qu'une fois.
  // L'emoji et le titre sont recopiés dans chaque ligne : une étagère se
  // relit des années plus tard, même si le catalogue a oublié la récompense.
  // Elle montre un prix du palmarès sous son nom du jour (`titreDuPrix`), le
  // reste sous le titre de sa ligne la plus récente (`badgesOf`).

  /**
   * Range les récompenses d'une soirée — prix et hauts faits —, en
   * REMPLAÇANT celles qu'un passage précédent de la même soirée avait rangées.
   *
   * Le retrait vise toute la soirée, pas seulement ses invités du moment : un
   * invité exclu n'a plus de réponses au journal, et le prix qu'il portait est
   * retombé sur quelqu'un d'autre. Les paliers de carrière, eux, ne se
   * reprennent pas ici — ils récompensent une habitude, pas une soirée.
   */
  async remplacerRecompensesDeSoiree(soireeId: string, spaceId: string, laureats: PrixDeSoiree[]): Promise<void> {
    const now = Date.now()
    const deSoiree = `space_id = ? AND soiree_id = ? AND badge NOT GLOB 'hf:*:[123]' AND badge NOT LIKE 'carriere:%'`
    const [avant] = await this.client.batch(
      [
        { sql: `SELECT DISTINCT profile_id FROM profile_badges WHERE ${deSoiree}`, args: [spaceId, soireeId] },
        { sql: `DELETE FROM profile_badges WHERE ${deSoiree}`, args: [spaceId, soireeId] },
        ...laureats.map(l => ({
          sql: `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(profile_id, badge, soiree_id) DO NOTHING`,
          args: [l.profileId, l.badge, soireeId, spaceId, l.emoji, l.title, now],
        })),
      ],
      'write',
    )
    this.porteurs = null
    await this.recompterRecompenses([...new Set([...avant.rows.map(r => String(r.profile_id)), ...laureats.map(l => l.profileId)])])
  }

  /**
   * Décerne les paliers de carrière que ce profil vient d'atteindre, sous le
   * nom de la soirée qui les a fait tomber, et crédite leur expérience. Rend
   * ceux qui sont nouveaux — il n'y a qu'à la première fois qu'ils comptent.
   */
  async accorderPaliers(
    profileId: string,
    soireeId: string,
    spaceId: string,
    enCours: ReadonlySet<string> = new Set(),
  ): Promise<string[]> {
    // Un palier ne se décide que sur des soirées closes. Celles qui se
    // jouent encore ailleurs sont déjà créditées, au verdict de chaque quiz
    // (invariant 10) : les compter faisait tomber L'Habitué sur un essai en
    // cours dans un autre espace — et le palier restait, rangé sous le nom
    // de celle-ci, quand l'essai s'effaçait. L'autre soirée le recroisera à
    // sa propre clôture, si elle est gardée.
    const carriere = await this.careerOf(profileId, enCours)
    const deja = this.recompensesOf(profileId)
    const neufs = paliersAtteints(carriere).filter(cle => !deja.has(cle))
    if (neufs.length === 0) return []
    const now = Date.now()
    await this.client.batch(
      neufs.map(cle => {
        const { hautFait, palier } = palierDe(cle)!
        return {
          sql: `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(profile_id, badge, soiree_id) DO NOTHING`,
          args: [profileId, cle, soireeId, spaceId, hautFait.emoji, titreDePalier(hautFait, palier), now],
        }
      }),
      'write',
    )
    this.porteurs = null
    await this.recompterRecompenses([profileId])
    await this.ecrireXpDesPaliers(profileId)
    await this.recalculerTotal(profileId)
    return neufs
  }

  /**
   * Décerne les paliers du quiz du jour qu'il vient d'atteindre — L'Assidu,
   * Le Champion du jour, Le Sans-Faute —, et ceux de La Légende que son
   * niveau atteint (`paliersDuNiveau`) : l'expérience du jour vient d'y
   * entrer. Rangés sous le jour qui les a fait tomber (`cleDuJour`), leur
   * expérience créditée avec celle des autres paliers. Rend ceux qui sont
   * nouveaux.
   */
  async accorderPaliersDuJour(profileId: string, jour: string, stats: StatsDuJour): Promise<string[]> {
    const profil = await this.byId(profileId)
    return this.accorderDesPaliers(profileId, cleDuJour(jour), [...paliersDuJourAtteints(stats), ...(profil ? paliersDuNiveau(this.niveauOf(profil)) : [])])
  }

  /**
   * Décerne les paliers de la campagne qu'il vient d'atteindre — L'Alpiniste,
   * L'Érudit, Le Marathonien, et ceux des sentiers : Le Randonneur, La
   * Constellation, Le Cartographe —, rangés sous la série ou l'épreuve qui
   * les a fait tomber (`cleDeSerie`), leur expérience créditée avec celle des
   * autres paliers. Rend ceux qui sont nouveaux.
   */
  async accorderPaliersDeCampagne(profileId: string, sous: string, stats: StatsDeCampagne): Promise<string[]> {
    return this.accorderDesPaliers(profileId, sous, paliersDeCampagneAtteints(stats))
  }

  /** Range ceux de ces paliers qu'il n'a pas encore, et repaie la ligne des paliers. */
  private async accorderDesPaliers(profileId: string, sous: string, atteints: readonly string[]): Promise<string[]> {
    const deja = this.recompensesOf(profileId)
    const neufs = atteints.filter(cle => !deja.has(cle))
    if (neufs.length === 0) return []
    const now = Date.now()
    await this.client.batch(
      neufs.map(cle => {
        const { hautFait, palier } = palierDe(cle)!
        return {
          sql: `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at)
                VALUES (?, ?, ?, '', ?, ?, ?) ON CONFLICT(profile_id, badge, soiree_id) DO NOTHING`,
          args: [profileId, cle, sous, hautFait.emoji, titreDePalier(hautFait, palier), now],
        }
      }),
      'write',
    )
    this.porteurs = null
    await this.recompterRecompenses([profileId])
    await this.ecrireXpDesPaliers(profileId)
    await this.recalculerTotal(profileId)
    return neufs
  }

  /**
   * Range des récompenses sous un jour, un mois, une série ou une semaine
   * (`#jour:…`, `#mois:…`, `#campagne:…`, `#defi:…`) : un haut fait du
   * quiz du jour ou de la campagne, une page du calendrier, un titre de
   * champion du mois, un Divin. Une seule ligne par clé et par rangement —
   * la clé primaire le garantit, et rejouer la nuit ou la relecture ne
   * double rien. Rend celles qui sont neuves : ce que la page annonce. Un
   * haut fait neuf du quiz du jour ou de la campagne paie son expérience dans
   * la ligne des paliers (`xpHorsDesSoirees`) ; le reste — une page, un
   * titre, un Divin — n'en rapporte pas. `quand` est l'heure du quiz du jour,
   * celle qui dit ce qu'une partie a fait tomber (`created_at` comparé à son
   * début), et que les tests font passer minuit.
   *
   * Une clé que la mémoire n'avait pas et que la base avait déjà dit une
   * mémoire en retard — la réponse d'un lot d'avant perdue après l'écriture, un
   * recompte tombé derrière, l'autre serveur d'une mise en ligne : elle se
   * relit. Sans cela, rien ne la rattrapait avant le redémarrage — le
   * légendaire rangé restait refusé à qui voulait le porter, et chaque appel
   * réécrivait la même ligne pour rien (`cabinet-gardiens.test.ts`).
   */
  async ranger(profileId: string, sous: string, cles: readonly string[], quand = Date.now()): Promise<string[]> {
    const uniques = [...new Set(cles)]
    if (uniques.length === 0) return []
    const now = quand
    const enMemoire = this.recompenses.get(profileId)
    const res = await this.client.batch(
      uniques.map(cle => {
        const { emoji, title } = etiquetteDe(cle)
        return {
          sql: `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at)
                VALUES (?, ?, ?, '', ?, ?, ?) ON CONFLICT(profile_id, badge, soiree_id) DO NOTHING`,
          args: [profileId, cle, sous, emoji, title, now],
        }
      }),
      'write',
    )
    const neuves = uniques.filter((_, i) => res[i].rowsAffected > 0)
    const rattrapees = enMemoire ? uniques.filter((cle, i) => res[i].rowsAffected === 0 && !enMemoire.has(cle)) : []
    if (neuves.length > 0 || rattrapees.length > 0) {
      this.porteurs = null
      await this.recompterRecompenses([profileId])
    }
    // Une rattrapée paie aussi : la ligne des paliers se dérive de la base, et le lot perdu ne l'avait pas refaite.
    if ([...neuves, ...rattrapees].some(cle => xpDe(cle) > 0)) {
      await this.ecrireXpDesPaliers(profileId)
      await this.recalculerTotal(profileId)
    }
    return neuves
  }

  /** Ce qui est rangé sous un jour, un mois ou une série, dans l'ordre où c'est tombé. */
  async rangesSous(profileId: string, sous: string): Promise<{ key: string; emoji: string; title: string; at: number }[]> {
    const res = await this.client.execute({
      sql: `SELECT badge, emoji, title, created_at FROM profile_badges WHERE profile_id = ? AND soiree_id = ? ORDER BY created_at, badge`,
      args: [profileId, sous],
    })
    return res.rows.map(r => ({ key: String(r.badge), emoji: String(r.emoji), title: String(r.title), at: Number(r.created_at) }))
  }

  /**
   * Ce que ce jour a fait tomber, rangé sous lui : les paliers du quiz du
   * jour — à la fin de sa partie, ou à la nuit qui l'a clos — et la saison
   * qu'il a ouverte.
   */
  async recompensesDuJour(profileId: string, jour: string): Promise<{ key: string; emoji: string; title: string }[]> {
    const res = await this.client.execute({
      sql: `SELECT badge, emoji, title FROM profile_badges WHERE profile_id = ? AND soiree_id = ? ORDER BY created_at, badge`,
      args: [profileId, cleDuJour(jour)],
    })
    return res.rows.map(r => ({ key: String(r.badge), emoji: String(r.emoji), title: String(r.title) }))
  }

  /** Les paliers du quiz du jour que ce jour a fait tomber, seuls. */
  async paliersDuJourTombes(profileId: string, jour: string): Promise<{ key: string; emoji: string; title: string }[]> {
    return (await this.recompensesDuJour(profileId, jour)).filter(r => palierDe(r.key))
  }

  /**
   * Une saison gagnée au quiz du jour (`shared/saisons.ts`), rangée sous le
   * jour qui l'a ouverte, comme ses paliers : aucune soirée ne la porte, et
   * en retirer une ne la reprend pas. Rend vrai si elle est neuve.
   */
  async accorderSaison(profileId: string, s: Saison, jour: string): Promise<boolean> {
    const cle = cleDeSaison(s)
    if (this.recompensesOf(profileId).has(cle)) return false
    const { emoji, title } = etiquetteDeSaison(s)
    await this.client.execute({
      sql: `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at)
            VALUES (?, ?, ?, '', ?, ?, ?) ON CONFLICT(profile_id, badge, soiree_id) DO NOTHING`,
      args: [profileId, cle, cleDuJour(jour), emoji, title, Date.now()],
    })
    this.porteurs = null
    await this.recompterRecompenses([profileId])
    return true
  }

  /**
   * Les paliers de La Légende que son niveau atteint, rangés sous `sous` : le
   * barème du solo vient de le faire monter, sans partie ni soirée pour les
   * décerner (`core/baremeDuSolo.ts`). Rend ceux qui sont nouveaux.
   */
  async accorderLaLegende(profileId: string, sous: string): Promise<string[]> {
    const profil = await this.byId(profileId)
    return profil ? this.accorderDesPaliers(profileId, sous, paliersDuNiveau(this.niveauOf(profil))) : []
  }

  /**
   * La ligne des paliers de chacun, réécrite une fois (`core/baremeDuSolo.ts`)
   * : ses paliers au barème du jour (`XP_PALIER`), et les hauts faits du quiz
   * du jour et de la campagne, qui ne payaient rien jusque-là. Rend les
   * profils réécrits.
   */
  async revaloriserLesPaliers(): Promise<string[]> {
    const res = await this.client.execute(
      `SELECT DISTINCT profile_id FROM profile_badges WHERE ${BADGES_DE_LA_LIGNE} AND profile_id IN (SELECT id FROM profiles)`,
    )
    const ids = res.rows.map(r => String(r.profile_id))
    for (const id of ids) {
      await this.ecrireXpDesPaliers(id)
      await this.recalculerTotal(id)
    }
    return ids
  }

  /**
   * Les niveaux gelés de l'ancienne courbe, rattrapés une fois (le choix du
   * 6 octobre 2026, `core/baremeDuSolo.ts`). Un niveau gardé
   * (`profile_niveaux`) tient tant que la courbe du jour ne l'a pas rejoint,
   * et pendant ce temps rien ne monte : 2 500 points en septembre gardaient
   * le niveau 11, et le douzième en demandait 7 260 — plus de cent quiz du
   * jour sans un niveau, quand un niveau 11 en coûte 1 260. Chacun reçoit,
   * dans sa ligne à part (`LIGNE_RATTRAPAGE`), ce qui manque pour que la
   * courbe du jour lui donne le niveau qu'il porte : son niveau ne bouge pas,
   * sa barre repart du début de ce niveau, comme pour tout le monde. Rejoué
   * après une panne, il trouve la ligne déjà écrite et n'y touche plus.
   * Rend les profils rattrapés.
   */
  async rattraperLesNiveauxGeles(): Promise<string[]> {
    const res = await this.client.execute('SELECT id, xp FROM profiles')
    const rattrapes: string[] = []
    for (const r of res.rows) {
      const id = String(r.id)
      const gardes = this.gardesOf(id)
      if (gardes.length === 0) continue
      const total = Number(r.xp ?? 0)
      const niveau = niveauDuProfil(total, gardes)
      if (niveau <= niveauPour(total)) continue
      await this.recalculerTotal(id, {
        sql: `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at)
              VALUES (?, ?, '', ?, ?, ?)
              ON CONFLICT(profile_id, soiree_id) DO UPDATE SET xp = profile_xp.xp + excluded.xp, detail = excluded.detail`,
        args: [id, LIGNE_RATTRAPAGE, xpDuNiveau(niveau) - total, JSON.stringify({ v: VERSION_BAREME, niveau }), Date.now()],
      })
      rattrapes.push(id)
    }
    return rattrapes
  }

  /**
   * La ligne d'expérience des paliers de carrière et des hauts faits hors des
   * soirées, recalculée de ce que son étagère range (voir `LIGNE_PALIERS`).
   * Effacée quand il n'en porte plus aucun.
   */
  private async ecrireXpDesPaliers(profileId: string): Promise<void> {
    const res = await this.client.execute({
      sql: `SELECT badge FROM profile_badges WHERE profile_id = ? AND ${BADGES_DE_LA_LIGNE}`,
      args: [profileId],
    })
    await this.client.execute(this.ligneDesPaliers(profileId, res.rows.map(r => String(r.badge))))
  }

  /**
   * La ligne d'expérience des paliers d'un profil, telle que son étagère la
   * fait — une entrée par ligne rangée, doublons compris : un haut fait du
   * quiz du jour paie chaque jour où il tombe. Effacée s'il n'a plus rien.
   */
  private ligneDesPaliers(profileId: string, badges: readonly string[]): InStatement {
    const xp = xpHorsDesSoirees(badges)
    if (xp === 0) {
      return { sql: 'DELETE FROM profile_xp WHERE profile_id = ? AND soiree_id = ?', args: [profileId, LIGNE_PALIERS] }
    }
    const paliers = [...new Set(badges.filter(cle => palierDe(cle)))]
    const hautsFaits = badges.length - badges.filter(cle => palierDe(cle)).length
    return {
      sql: `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at)
            VALUES (?, ?, '', ?, ?, ?)
            ON CONFLICT(profile_id, soiree_id) DO UPDATE SET xp = excluded.xp, detail = excluded.detail`,
      args: [profileId, LIGNE_PALIERS, xp, JSON.stringify({ v: VERSION_BAREME, paliers, hautsFaits }), Date.now()],
    }
  }

  /**
   * Remet d'aplomb les récompenses gardées en mémoire pour ces profils.
   *
   * Elles partent dans l'accusé de chaque téléphone qui se présente à une
   * soirée (le nombre de badges, les légendaires débloqués), et dans
   * l'instantané de toute la salle (le légendaire porté) : on les relit
   * après chaque écriture plutôt que de compter sur une relecture qui ne
   * viendrait jamais.
   */
  private async recompterRecompenses(profileIds: string[]): Promise<void> {
    if (profileIds.length === 0) return
    const res = await this.client.execute({
      sql: `SELECT profile_id, badge, COUNT(*) AS n FROM profile_badges
            WHERE profile_id IN (${profileIds.map(() => '?').join(', ')}) GROUP BY profile_id, badge`,
      args: profileIds,
    })
    const parProfil = new Map<string, Map<string, number>>(profileIds.map(id => [id, new Map()]))
    for (const r of res.rows) parProfil.get(String(r.profile_id))?.set(String(r.badge), Number(r.n))
    for (const [id, m] of parProfil) this.recompenses.set(id, m)
  }

  /**
   * L'étagère d'un profil : chaque badge, le nombre de fois qu'il est tombé,
   * et ce que sa rareté vaut dans la population du moment.
   */
  async badgesOf(profileId: string): Promise<BadgePorte[]> {
    const [etagere, { porteurs, profils }] = await Promise.all([this.etagereDe(profileId), this.populationBadges()])
    return etagere.map(b => {
      const n = porteurs.get(b.key) ?? 1
      return { ...b, porteurs: n, rarete: rareteDe(n, profils) }
    })
  }

  /**
   * Les lignes de son étagère, sans leur rareté : ce que sa loge compte
   * (`ceQueLaLogeLit`) n'en a pas besoin. Gardées tant que ses récompenses
   * ne changent pas : chaque écriture les recompte (`recompterRecompenses`)
   * et pose une table neuve, la clé de cette mémoire (`etageres`). Relues,
   * elles parcouraient toutes ses récompenses à chaque page du profil, chaque
   * carte, chaque loge — 934 lignes au quota de Turso pour le plus fidèle,
   * 5 % du quota à elles seules, le 23 octobre 2026.
   */
  private etagereDe(profileId: string): Promise<readonly Omit<BadgePorte, 'porteurs' | 'rarete'>[]> {
    const cle = this.recompenses.get(profileId)
    // Pas en mémoire : relue, sans rien garder — sa table viendra avec lui.
    if (!cle) return this.lireLEtagere(profileId)
    let gardee = this.etageres.get(cle)
    if (!gardee) {
      const lue = this.lireLEtagere(profileId)
      this.etageres.set(cle, lue)
      // Ratée, elle se relit à la demande suivante : gardée, la promesse figerait l'échec.
      lue.catch(() => {
        if (this.etageres.get(cle) === lue) this.etageres.delete(cle)
      })
      gardee = lue
    }
    return gardee
  }

  private async lireLEtagere(profileId: string): Promise<Omit<BadgePorte, 'porteurs' | 'rarete'>[]> {
    // Les Divins n'y sont pas : ils ont leur galerie, et une étagère qui
    // dirait « tombé le 12 mars » raconterait ce qu'on a fait ce soir-là.
    // Les voies rangées non plus — les saisons, un légendaire gardé au bout
    // de l'expédition, un gardien réveillé au Cabinet : elles ne se montrent
    // que par leur légendaire (`sqlHorsDesVoiesRangees`) ; ni les pages du
    // calendrier, qui ont leur page.
    const rows = await this.client.execute({
      // Par clé seule : un prix renommé porte deux noms en base, l'ancien et
      // le nouveau, et l'étagère le montrait deux fois. L'emoji et le titre
      // viennent de la ligne la plus récente : pris au MAX(), un haut fait
      // renommé aurait montré le nom que l'alphabet range en dernier.
      sql: `SELECT badge, emoji, title, fois, dernier FROM (
              SELECT badge, emoji, title,
                     COUNT(*) OVER (PARTITION BY badge) AS fois,
                     MAX(created_at) OVER (PARTITION BY badge) AS dernier,
                     ROW_NUMBER() OVER (PARTITION BY badge ORDER BY created_at DESC, soiree_id DESC) AS n
              FROM profile_badges WHERE profile_id = ? AND badge NOT LIKE 'dv:%' AND ${sqlHorsDesVoiesRangees('badge')} AND badge NOT LIKE '${PREFIXE_DES_PAGES}%'
            ) WHERE n = 1 ORDER BY dernier DESC`,
      args: [profileId],
    })
    return rows.rows.map(r => {
      const key = String(r.badge)
      return {
        key,
        emoji: String(r.emoji),
        title: titreDuPrix(key) ?? String(r.title),
        fois: Number(r.fois),
        dernier: Number(r.dernier),
      }
    })
  }

  /**
   * Combien de profils portent chaque badge, et combien il y a de profils en
   * tout. La rareté se calcule, elle ne se décrète pas — mais elle bouge
   * lentement : on la garde dix minutes (`POPULATION_GARDEE_MS`) plutôt que
   * de la recompter à chaque ouverture d'une page — chaque recompte parcourt
   * toutes les récompenses de tous.
   */
  private porteurs: { at: number; porteurs: Map<string, number>; profils: number } | null = null
  /** Les prénoms sans accents et les identifiants de tous, pour `chercher`. */
  private annuaire: { lu: number; lignes: { id: string; nom: string; login: string }[] } | null = null

  private async populationBadges(): Promise<{ porteurs: Map<string, number>; profils: number }> {
    const frais = this.porteurs && Date.now() - this.porteurs.at < POPULATION_GARDEE_MS
    if (frais && this.porteurs) return this.porteurs
    const [compte, parBadge] = await Promise.all([
      this.client.execute('SELECT COUNT(*) AS n FROM profiles WHERE disabled_at IS NULL'),
      this.client.execute(
        'SELECT badge, COUNT(DISTINCT profile_id) AS n FROM profile_badges GROUP BY badge',
      ),
    ])
    const porteurs = new Map<string, number>()
    for (const r of parBadge.rows) porteurs.set(String(r.badge), Number(r.n))
    this.porteurs = { at: Date.now(), porteurs, profils: Number(compte.rows[0]?.n ?? 0) }
    return this.porteurs
  }

  // ── L'administration ────────────────────────────────────────────────────

  /**
   * Les profils que l'administrateur cherche — un prénom, un identifiant —,
   * ou, sans recherche, les derniers vus : trente au plus. Avec ce que la
   * liste en dit : son niveau, ses soirées, sa dernière visite. Les
   * suspendus aussi : c'est d'ici qu'on les réactive.
   */
  async pourLAdministration(cherche: string): Promise<{ total: number; profils: { profil: ProfileRec; niveau: number; soirees: number }[] }> {
    const mots = cherche.trim().toLowerCase().replace(/[%_]/g, '')
    const motif = `%${mots}%`
    const [compte, trouves] = await this.client.batch(
      [
        'SELECT COUNT(*) AS n FROM profiles',
        mots
          ? { sql: `SELECT id FROM profiles WHERE lower(name) LIKE ? OR login LIKE ? ORDER BY name LIMIT 30`, args: [motif, motif] }
          : `SELECT id FROM profiles ORDER BY COALESCE(last_seen_at, created_at) DESC LIMIT 30`,
      ],
      'read',
    )
    const ids = trouves.rows.map(r => String(r.id))
    const soirees = await this.soireesDe(ids)
    // `byIds` les charge tous en mémoire, mais tait les suspendus : on les relit là.
    await this.byIds(ids)
    const profils = ids.flatMap(id => {
      const p = this.profiles.get(id)
      return p ? [{ profil: p, niveau: this.niveauOf(p), soirees: soirees.get(id) ?? 0 }] : []
    })
    return { total: Number(compte.rows[0]?.n ?? 0), profils }
  }

  /** Les soirées de chacun dans l'historique, d'un aller-retour : les lignes à part n'en sont pas. */
  async soireesDe(ids: readonly string[]): Promise<Map<string, number>> {
    const soirees = new Map<string, number>()
    if (ids.length === 0) return soirees
    const res = await this.client.execute({
      sql: `SELECT profile_id, COUNT(*) AS n FROM profile_xp WHERE profile_id IN (${ids.map(() => '?').join(', ')}) AND ${HORS_LIGNES_A_PART} GROUP BY profile_id`,
      args: [...ids],
    })
    for (const r of res.rows) soirees.set(String(r.profile_id), Number(r.n))
    return soirees
  }

  /** Un profil pour l'administrateur : suspendu compris, que `byId` tait. Null s'il n'existe pas. */
  async pourLAdministrateur(id: string): Promise<ProfileRec | null> {
    await this.byIds([id])
    return this.profiles.get(id) ?? null
  }

  /** Des profils pour l'administrateur, ceux qui ne sont pas en mémoire chargés par paquets (`byIds`) : suspendus compris ; ceux qui n'existent plus manquent. */
  async pourLAdministrateurDe(ids: readonly string[]): Promise<ProfileRec[]> {
    await this.byIds(ids)
    return ids.flatMap(id => this.profiles.get(id) ?? [])
  }

  /**
   * Offre des confettis, au nom de l'administrateur — un don par ligne,
   * définitif comme un achat, compté dans le solde à chaque lecture et dit une
   * fois sur l'accueil du joueur, avec son mot. Entre 1 et
   * `CONFETTIS_PAR_DON_MAX` : un geste pour quelqu'un, pas une économie à côté.
   */
  async offrirDesConfettis(id: string, confettis: unknown, mot: unknown): Promise<{ confettis: number; mot: string | null }> {
    const n = typeof confettis === 'number' ? confettis : Number.NaN
    if (!Number.isInteger(n) || n < 1 || n > CONFETTIS_PAR_DON_MAX) throw new Error(`Entre 1 et ${CONFETTIS_PAR_DON_MAX} confettis par don`)
    const propre = typeof mot === 'string' ? tronquer(mot.replace(/\s+/g, ' ').trim(), MOT_D_UN_DON_MAX) : ''
    await this.client.execute({
      sql: 'INSERT INTO profile_dons (id, profile_id, confettis, mot, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [randomUUID(), id, n, propre || null, Date.now()],
    })
    return { confettis: n, mot: propre || null }
  }

  /**
   * Un Éclat offert par l'administrateur : il arrive en réserve (`donnerUnEclat`),
   * que le joueur dépense sur l'avatar de son choix. Rangé sous un nom qu'aucune
   * soirée, aucun jour ni aucune semaine ne porte (`#don:`) : rien ne le reprend
   * en passant, et le QG ne le compte pas parmi les Éclats tirés. Pour tester
   * comme pour offrir ; jamais à un profil suspendu, qui ne le verrait pas.
   */
  async offrirUnEclat(id: string): Promise<number> {
    const cle = `${PREFIXE_DE_LA_RESERVE}${randomUUID()}`
    await this.client.execute({
      sql: 'INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, ?, ?, ?)',
      args: [id, cle, `${PREFIXE_DES_DONS_D_ECLAT}${randomUUID()}`, Date.now()],
    })
    let reserve = this.reserves.get(id)
    if (!reserve) this.reserves.set(id, (reserve = new Set()))
    reserve.add(cle)
    return reserve.size
  }

  /**
   * Une annonce à tous (`shared/annonces.ts`) : un message, et des confettis
   * pour chacun — un don par profil, comme celui de la fiche d'un joueur —,
   * écrits d'un seul lot : l'annonce et ses dons ensemble, ou rien. Pour les
   * profils d'aujourd'hui, sans les suspendus, qui ne la verraient pas ; ceux
   * qui naîtront ensuite ne la recevront pas : elle parle d'avant eux.
   *
   * `id` vient de la page qui l'envoie, et ne change qu'une fois l'annonce
   * partie : un envoi rejoué — la réponse perdue en route, le geste refait —
   * retrouve l'annonce faite (`nouvelle` faux) au lieu d'offrir une seconde
   * fois à tout le monde.
   */
  async annoncerATous(demande: { id: unknown; message: unknown; confettis: unknown; question?: unknown }): Promise<{ annonce: AnnonceAuQg; nouvelle: boolean }> {
    const message = lireLeMessage(demande.message)
    const confettis = lireLesConfettis(demande.confettis)
    const id = typeof demande.id === 'string' && ID_D_ANNONCE.test(demande.id) ? demande.id : randomUUID()
    const maintenant = Date.now()
    const question = lireLaQuestion(demande.question)
    const lot = await this.client.batch(
      [
        {
          sql: `INSERT OR IGNORE INTO qg_annonces (id, message, confettis, destinataires, created_at)
                SELECT ?, ?, ?, COUNT(*), ? FROM profiles WHERE disabled_at IS NULL AND created_at <= ?`,
          args: [id, message, confettis, maintenant, maintenant],
        },
        // À l'heure de l'annonce, la première fois qu'elle est partie : rejouée,
        // elle ne donne rien aux profils venus depuis, et ses dons déjà faits restent seuls.
        {
          sql: `INSERT OR IGNORE INTO profile_dons (id, profile_id, confettis, mot, created_at)
                SELECT 'annonce:' || a.id || ':' || p.id, p.id, a.confettis, NULL, a.created_at
                FROM qg_annonces a JOIN profiles p ON p.disabled_at IS NULL AND p.created_at <= a.created_at
                WHERE a.id = ? AND a.confettis > 0 AND a.retiree_le IS NULL`,
          args: [id],
        },
        // Sa question, dans le même lot — et seulement pour l'annonce née dans ce lot : rejouée avec une
        // question, une annonce déjà faite n'en gagne pas une.
        ...(question
          ? [
              {
                sql: `INSERT OR IGNORE INTO qg_annonce_questions (annonce_id, sorte, choix, recompense)
                      SELECT id, ?, ?, ? FROM qg_annonces WHERE id = ? AND created_at = ?`,
                args: [question.sorte, JSON.stringify(question.choix), question.recompense, id, maintenant],
              },
            ]
          : []),
        { sql: `SELECT ${COLONNES_D_UNE_ANNONCE} FROM qg_annonces WHERE id = ?`, args: [id] },
      ],
      'write',
    )
    const ligne = lot[lot.length - 1].rows[0]
    if (!ligne) throw new Error('L’annonce n’a pas pu partir : réessaie')
    const questions = await this.questionsDuQg([id])
    return { annonce: annonceDuQg(ligne, questions.get(id) ?? null), nouvelle: lot[0].rowsAffected > 0 }
  }

  /**
   * Les questions des annonces données, chacune avec ce qu'elle a récolté : les
   * comptes (un vote, une note), la moyenne et les mots libres avec le prénom de
   * qui les a écrits. Un seul aller-retour.
   */
  private async questionsDuQg(ids: readonly string[]): Promise<Map<string, QuestionAuQg>> {
    const rendu = new Map<string, QuestionAuQg>()
    if (ids.length === 0) return rendu
    const marques = ids.map(() => '?').join(', ')
    const [questions, comptes, mots] = await this.client.batch(
      [
        { sql: `SELECT annonce_id, sorte, choix, recompense, close_le FROM qg_annonce_questions WHERE annonce_id IN (${marques})`, args: [...ids] },
        {
          sql: `SELECT annonce_id, reponse, COUNT(*) AS n FROM qg_annonce_reponses WHERE annonce_id IN (${marques}) GROUP BY annonce_id, reponse`,
          args: [...ids],
        },
        {
          sql: `SELECT r.annonce_id, r.reponse, r.created_at, p.name
                FROM qg_annonce_reponses r
                JOIN qg_annonce_questions q ON q.annonce_id = r.annonce_id AND q.sorte = 'mot'
                LEFT JOIN profiles p ON p.id = r.profile_id
                WHERE r.annonce_id IN (${marques}) ORDER BY r.created_at DESC`,
          args: [...ids],
        },
      ],
      'read',
    )
    for (const q of questions.rows) {
      const id = String(q.annonce_id)
      const sorte = String(q.sorte) as SorteDeQuestion
      const choix = JSON.parse(String(q.choix)) as string[]
      const rangees = comptes.rows.filter(c => String(c.annonce_id) === id)
      const reponses = rangees.reduce((t, c) => t + Number(c.n), 0)
      const taille = sorte === 'vote' ? choix.length : sorte === 'note' ? NOTE_MAX : 0
      const decompte = Array.from({ length: taille }, () => 0)
      if (sorte === 'vote') for (const c of rangees) decompte[Number(c.reponse)] += Number(c.n)
      if (sorte === 'note') for (const c of rangees) decompte[Number(c.reponse) - 1] += Number(c.n)
      rendu.set(id, {
        sorte,
        choix,
        recompense: Number(q.recompense),
        fermeeLe: q.close_le == null ? null : Number(q.close_le),
        resultats: {
          reponses,
          comptes: decompte,
          moyenne: sorte === 'note' && reponses > 0 ? decompte.reduce((t, n, i) => t + n * (i + 1), 0) / reponses : null,
          mots: mots.rows
            .filter(m => String(m.annonce_id) === id)
            .slice(0, MOTS_MONTRES)
            .map(m => ({ prenom: m.name == null ? 'Un profil supprimé' : String(m.name), texte: String(m.reponse), le: Number(m.created_at) })),
        },
      })
    }
    return rendu
  }

  /** Les annonces faites, la plus récente d'abord, et les profils qui recevraient la prochaine : un aller-retour. */
  async annoncesAuQg(): Promise<{ profils: number; annonces: AnnonceAuQg[] }> {
    const [annonces, compte] = await this.client.batch(
      [
        { sql: `SELECT ${COLONNES_D_UNE_ANNONCE} FROM qg_annonces ORDER BY created_at DESC LIMIT ?`, args: [ANNONCES_MONTREES] },
        'SELECT COUNT(*) AS n FROM profiles WHERE disabled_at IS NULL',
      ],
      'read',
    )
    const questions = await this.questionsDuQg(annonces.rows.map(r => String(r.id)))
    return { profils: Number(compte.rows[0]?.n ?? 0), annonces: annonces.rows.map(r => annonceDuQg(r, questions.get(String(r.id)) ?? null)) }
  }

  /**
   * Retire une annonce : l'accueil la tait à qui ne l'avait pas encore lue —
   * une faute dans le message, une nouvelle qui ne tient plus. Ses confettis
   * restent : un don ne se reprend pas. Null si elle n'existe pas.
   */
  async retirerLAnnonce(id: string): Promise<AnnonceAuQg | null> {
    const [retiree, lue] = await this.client.batch(
      [
        { sql: 'UPDATE qg_annonces SET retiree_le = ? WHERE id = ? AND retiree_le IS NULL', args: [Date.now(), id] },
        { sql: `SELECT ${COLONNES_D_UNE_ANNONCE} FROM qg_annonces WHERE id = ?`, args: [id] },
      ],
      'write',
    )
    const ligne = lue.rows[0]
    if (!ligne) return null
    if (retiree.rowsAffected === 0) throw new Error('Cette annonce est déjà retirée : recharge le QG')
    return annonceDuQg(ligne, (await this.questionsDuQg([id])).get(id) ?? null)
  }

  /**
   * Clôt la question d'une annonce : les joueurs ne la voient plus, ceux qui ont
   * répondu gardent leurs confettis, et les résultats restent au QG. Null si
   * l'annonce n'existe pas.
   */
  async cloreLaQuestion(id: string): Promise<AnnonceAuQg | null> {
    const [close, lue] = await this.client.batch(
      [
        { sql: 'UPDATE qg_annonce_questions SET close_le = ? WHERE annonce_id = ? AND close_le IS NULL', args: [Date.now(), id] },
        { sql: `SELECT ${COLONNES_D_UNE_ANNONCE} FROM qg_annonces WHERE id = ?`, args: [id] },
      ],
      'write',
    )
    const ligne = lue.rows[0]
    if (!ligne) return null
    const question = (await this.questionsDuQg([id])).get(id)
    if (!question) throw new Error('Cette annonce ne pose pas de question')
    if (close.rowsAffected === 0) throw new Error('Cette question est déjà close : recharge le QG')
    return annonceDuQg(ligne, question)
  }

  /**
   * La réponse d'un profil à la question d'une annonce : une seule, et la
   * récompense avec elle — un don dont l'identifiant se déduit de l'annonce et du
   * profil, écrit dans le même lot que la réponse. Rejouée (la réponse perdue en
   * route), elle ne donne pas deux fois. `introuvable` : l'annonce n'existe pas,
   * est retirée, parlait d'avant lui ou date de plus d'un mois — l'accueil ne la
   * dit plus ; `fermee` : l'administrateur a clos la question ; `deja` : il a répondu.
   */
  async repondreALAnnonce(p: ProfileRec, annonceId: string, reponse: unknown): Promise<{ etat: 'ok'; accuse: AccuseDeReponse } | { etat: 'introuvable' | 'fermee' | 'deja' }> {
    const lue = await this.client.execute({
      sql: `SELECT a.created_at, a.retiree_le, q.sorte, q.choix, q.recompense, q.close_le, r.profile_id AS deja
            FROM qg_annonces a
            JOIN qg_annonce_questions q ON q.annonce_id = a.id
            LEFT JOIN qg_annonce_reponses r ON r.annonce_id = a.id AND r.profile_id = ?
            WHERE a.id = ?`,
      args: [p.id, annonceId],
    })
    const ligne = lue.rows[0]
    const maintenant = Date.now()
    if (!ligne || ligne.retiree_le != null || Number(ligne.created_at) < p.createdAt || maintenant - Number(ligne.created_at) >= ANNONCE_MS) return { etat: 'introuvable' }
    if (ligne.close_le != null) return { etat: 'fermee' }
    if (ligne.deja != null) return { etat: 'deja' }
    const question: QuestionDAnnonce = { sorte: String(ligne.sorte) as SorteDeQuestion, choix: JSON.parse(String(ligne.choix)) as string[], recompense: Number(ligne.recompense) }
    const lueReponse = lireLaReponse(question, reponse)
    await this.client.batch(
      [
        { sql: 'INSERT OR IGNORE INTO qg_annonce_reponses (annonce_id, profile_id, reponse, created_at) VALUES (?, ?, ?, ?)', args: [annonceId, p.id, lueReponse, maintenant] },
        ...(question.recompense > 0
          ? [
              {
                sql: 'INSERT OR IGNORE INTO profile_dons (id, profile_id, confettis, mot, created_at) VALUES (?, ?, ?, NULL, ?)',
                args: [donDeLaReponse(annonceId, p.id), p.id, question.recompense, maintenant],
              },
            ]
          : []),
      ],
      'write',
    )
    return { etat: 'ok', accuse: { confettis: question.recompense } }
  }

  /**
   * Tire un code de secours neuf, que l'administrateur transmet au joueur qui
   * ne peut plus se connecter : il le tape dans « Mot de passe oublié ? », la
   * porte de toujours, qui lui en rend un autre. L'ancien ne vaut plus rien.
   * Rien d'autre ne bouge : ni son mot de passe, ni ses sessions — il n'a
   * rien perdu de plus qu'avant.
   */
  async nouveauCodeDeSecours(id: string): Promise<string> {
    const rec = await this.require(id)
    const code = newRecoveryCode()
    const recoveryHash = await hashPassword(normalizeRecovery(code))
    await this.client.execute({ sql: 'UPDATE profiles SET recovery_hash = ? WHERE id = ?', args: [recoveryHash, id] })
    rec.recoveryHash = recoveryHash
    return code
  }

  /**
   * L'administrateur change un prénom qui ne va pas — jamais pour départager
   * deux homonymes, qui se règlent à l'affichage (invariant 17). Les archives
   * gardent l'ancien, une soirée en cours aussi (sa fiche ne se redéclare
   * pas, invariant 9) ; son accueil le lui dit, une fois (`renommeLe`).
   */
  async renommer(id: string, nom: unknown): Promise<{ avant: string; apres: string }> {
    const rec = await this.pourLAdministrateur(id)
    if (!rec) throw new Error('Ce profil est introuvable')
    const apres = cleanName(nom)
    if (!apres) throw new Error('Il faut un prénom')
    if (apres === rec.name) throw new Error('C’est déjà son prénom')
    const maintenant = Date.now()
    await this.client.execute({ sql: 'UPDATE profiles SET name = ?, renomme_le = ? WHERE id = ?', args: [apres, maintenant, id] })
    const avant = rec.name
    rec.name = apres
    rec.renommeLe = maintenant
    // La recherche des joueurs relit les prénoms : celui-ci a changé.
    this.annuaire = null
    return { avant, apres }
  }

  /**
   * Suspend un profil : ses sessions tombent, il ne se connecte plus — le bon
   * mot de passe le lui dit (`verifier`) —, et il disparaît partout où l'on
   * lit les profils (`byId`, `byIds` : les classements, la recherche, les
   * cartes). Rien ne s'efface : réactivé, il retrouve tout.
   */
  async suspendre(id: string): Promise<void> {
    const rec = await this.require(id)
    const maintenant = Date.now()
    await this.client.execute({ sql: 'UPDATE profiles SET disabled_at = ? WHERE id = ?', args: [maintenant, id] })
    rec.disabledAt = maintenant
    this.suspensionChangee?.()
    await this.revokeAll(id)
    this.annuaire = null
    this.porteurs = null
  }

  async reactiver(id: string): Promise<void> {
    const rec = await this.pourLAdministrateur(id)
    if (!rec) throw new Error('Ce profil est introuvable')
    await this.client.execute({ sql: 'UPDATE profiles SET disabled_at = NULL WHERE id = ?', args: [id] })
    rec.disabledAt = null
    this.suspensionChangee?.()
    this.annuaire = null
    this.porteurs = null
  }

  /** Tous les profils qui existent encore : le recalcul ne recrédite pas un profil supprimé. */
  async idsExistants(): Promise<Set<string>> {
    const res = await this.client.execute('SELECT id FROM profiles')
    return new Set(res.rows.map(r => String(r.id)))
  }

  /**
   * Supprime un profil, et tout ce qui n'était qu'à lui : ses sessions, ses
   * lignes d'expérience, son étagère, ses éclats, ses légendaires et ses
   * niveaux gardés, ses achats. En un seul lot, la fiche en dernier ; puis la
   * mémoire. Ce que ses soirées ont rapporté aux autres joueurs reste à eux :
   * rien ici ne touche une ligne qui n'est pas la sienne. Le quiz du jour, la
   * campagne et son salon se défont avant, chacun chez lui (`server.ts`).
   */
  async supprimer(profileId: string): Promise<void> {
    await this.client.batch(
      [
        ...[
          'profile_sessions',
          'profile_xp',
          'profile_badges',
          'profile_eclats',
          'profile_legendaires',
          'profile_niveaux',
          'profile_achats',
          'profile_vies',
          'profile_sabliers',
          'profile_compagnons',
          'profile_fonds',
          'profile_dons',
          'qg_annonce_reponses',
          'profile_loge_vus',
          'profile_missions',
          'profile_coffres',
          'profile_envies',
          'profile_cadeaux',
          'profile_cueillettes',
        ].map(table => ({
          sql: `DELETE FROM ${table} WHERE profile_id = ?`,
          args: [profileId],
        })),
        { sql: 'DELETE FROM profiles WHERE id = ?', args: [profileId] },
      ],
      'write',
    )
    for (const s of [...this.sessions.values()]) if (s.profileId === profileId) this.sessions.delete(s.id)
    for (const carte of [
      this.profiles,
      this.justesDesSoireesGardees,
      this.eclats,
      this.eteints,
      this.reserves,
      this.recompenses,
      this.compagnons,
      this.tresors,
      this.fondsAchetes,
      this.acquis,
      this.gardes,
      this.achatsEnCours,
      this.vus,
    ]) {
      carte.delete(profileId)
    }
    // La rareté des hauts faits se compte sur la population : elle a changé.
    this.porteurs = null
  }

  // ── Carrière et historique ──────────────────────────────────────────────

  /** Toutes les soirées d'un profil, de la plus récente à la plus ancienne. */
  async historiqueOf(profileId: string): Promise<
    {
      soireeId: string
      spaceId: string
      xp: number
      gain: GainSoiree
      releve: ReleveSoiree
      at: number
      joueurId: string | null
    }[]
  > {
    const rows = await this.client.execute({
      sql: `SELECT soiree_id, space_id, xp, detail, created_at, joueur_id FROM profile_xp
            WHERE profile_id = ? AND ${HORS_LIGNES_A_PART} ORDER BY created_at DESC`,
      args: [profileId],
    })
    return rows.rows.map(r => {
      const { gain, releve } = decodeDetail(String(r.detail))
      return {
        soireeId: String(r.soiree_id),
        spaceId: String(r.space_id),
        xp: Number(r.xp),
        gain,
        releve,
        at: Number(r.created_at),
        joueurId: r.joueur_id == null ? null : String(r.joueur_id),
      }
    })
  }

  /**
   * Retient le joueur qu'un profil était lors d'une soirée créditée avant
   * qu'on le retienne — retrouvé dans l'archive, où le rattachement survit.
   * Une fois écrit, on ne relit plus l'archive pour lui.
   */
  async retenirJoueur(profileId: string, soireeId: string, joueurId: string): Promise<void> {
    await this.client.execute({
      sql: 'UPDATE profile_xp SET joueur_id = ? WHERE profile_id = ? AND soiree_id = ? AND joueur_id IS NULL',
      args: [joueurId, profileId, soireeId],
    })
  }

  /**
   * Ce qu'un profil a accumulé sur toutes ses soirées — sa fiche, et la base
   * des paliers de carrière. `sauf` écarte des soirées (`cleDeSoiree`) : les
   * paliers n'y comptent pas celles qui se jouent encore.
   */
  async careerOf(profileId: string, sauf: ReadonlySet<string> = new Set()): Promise<Carriere> {
    const toutes = await this.historiqueOf(profileId)
    const soirees = toutes.filter(s => !sauf.has(cleDeSoiree(s.spaceId, s.soireeId)))
    const rec = await this.byId(profileId)
    const jour = await this.statsDuJourDe(profileId)
    if (soirees.length === toutes.length) {
      return carriereDe(soirees, { eclats: this.eclatsOf(profileId).length, niveau: rec ? this.niveauOf(rec) : 1, jour })
    }
    // Les soirées écartées ont aussi porté l'expérience du profil, et peut-
    // être un Éclat : les laisser dans le niveau ou le compte d'Éclats, c'était
    // faire tomber `hf:eclats:1` sur l'Éclat d'un essai qu'on efface ensuite.
    // Le niveau se relit sans elles, gardes comprises (invariant 22).
    const ecartees = toutes.filter(s => sauf.has(cleDeSoiree(s.spaceId, s.soireeId)))
    const eclats = await this.eclatsHors(profileId, new Set(ecartees.map(s => s.soireeId)))
    const xpEcartee = ecartees.reduce((n, s) => n + s.xp, 0)
    const niveau = rec ? niveauDuProfil(Math.max(0, rec.xp - xpEcartee), this.gardesOf(profileId)) : 1
    return carriereDe(soirees, { eclats, niveau, jour })
  }

  // ── Le recalcul ─────────────────────────────────────────────────────────

  /**
   * Les lignes d'expérience écrites avec un barème d'avant — et combien
   * d'anciens badges de carrière traînent encore. C'est ce qui décide du
   * recalcul au démarrage (`server/src/core/recalcul.ts`).
   */
  async aRecalculer(): Promise<{ lignes: { profileId: string; soireeId: string; spaceId: string; detail: string }[]; anciensBadges: number }> {
    const [lignes, badges] = await Promise.all([
      this.client.execute({
        sql: `SELECT profile_id, soiree_id, space_id, detail FROM profile_xp WHERE detail NOT LIKE ?`,
        args: [`{"v":${VERSION_BAREME},%`],
      }),
      this.client.execute(`SELECT COUNT(*) AS n FROM profile_badges WHERE badge LIKE 'carriere:%'`),
    ])
    return {
      lignes: lignes.rows.map(r => ({
        profileId: String(r.profile_id),
        soireeId: String(r.soiree_id),
        spaceId: String(r.space_id),
        detail: String(r.detail),
      })),
      anciensBadges: Number(badges.rows[0]?.n ?? 0),
    }
  }

  /**
   * Retire les badges de l'ancien catalogue de carrière (« Le Fidèle »,
   * « Le Pilier »…) : les paliers de carrière les reprennent sous leurs
   * nouveaux noms, et le recalcul les redécerne. Rend les profils touchés.
   */
  async oublierAnciensBadgesDeCarriere(): Promise<string[]> {
    const [avant] = await this.client.batch(
      [
        `SELECT DISTINCT profile_id FROM profile_badges WHERE badge LIKE 'carriere:%'`,
        `DELETE FROM profile_badges WHERE badge LIKE 'carriere:%'`,
      ],
      'write',
    )
    const touches = avant.rows.map(r => String(r.profile_id))
    this.porteurs = null
    await this.recompterRecompenses(touches)
    return touches
  }

  /**
   * Remet au barème du jour une ligne qu'aucun recalcul ne sait relire : celle
   * des paliers, ou celle d'une soirée absente de l'historique — la soirée en
   * cours, qui se recréditera à son prochain quiz. Son expérience ne bouge
   * pas, seule sa version : restée à l'ancienne, elle se serait retrouvée « à
   * recalculer » à chaque démarrage, et tout l'historique avec elle.
   */
  async remettreAuBareme(profileId: string, soireeId: string): Promise<void> {
    if (soireeId === LIGNE_PALIERS) {
      await this.ecrireXpDesPaliers(profileId)
      await this.recalculerTotal(profileId)
      return
    }
    if (soireeId === LIGNE_JOUR || soireeId === LIGNE_CAMPAGNE || soireeId === LIGNE_RATTRAPAGE || soireeId === LIGNE_MISSIONS) {
      // Le quiz du jour, la campagne et les missions ne dépendent pas du barème des soirées,
      // ni le rattrapage, écrit une fois pour toutes : leur ligne garde
      // son expérience, et ne prend que la version du jour. En entier : le
      // nombre lié part en flottant, et `{"v":7.0,…}` n'était jamais « du
      // jour » pour `aRecalculer` — tout l'historique se relisait à chaque
      // démarrage.
      await this.client.execute({
        sql: `UPDATE profile_xp SET detail = json_set(detail, '$.v', CAST(? AS INTEGER)) WHERE profile_id = ? AND soiree_id = ?`,
        args: [VERSION_BAREME, profileId, soireeId],
      })
      return
    }
    const rows = await this.client.execute({
      sql: 'SELECT detail FROM profile_xp WHERE profile_id = ? AND soiree_id = ?',
      args: [profileId, soireeId],
    })
    const r = rows.rows[0]
    if (!r) return
    const { gain, releve } = decodeDetail(String(r.detail))
    try {
      await this.client.execute({
        sql: 'UPDATE profile_xp SET detail = ? WHERE profile_id = ? AND soiree_id = ?',
        args: [JSON.stringify({ v: VERSION_BAREME, gain, releve }), profileId, soireeId],
      })
    } finally {
      // Relu d'un format d'avant (`decodeDetail`), son détail a pu changer de forme : ce qu'on en gardait aussi.
      this.oublierSesSoirees([profileId])
    }
  }

  /**
   * Écrit la ligne du quiz du jour (`LIGNE_JOUR`) : son expérience entière,
   * parties et podiums, que `core/jour.ts` recalcule de ses tables — et le
   * total avec, dans la même transaction. Effacée à zéro. Rend le profil à
   * jour, ou null s'il n'existe plus.
   */
  async ecrireXpDuJour(profileId: string, xp: number, jours: number): Promise<ProfileRec | null> {
    const ecrire: InStatement =
      xp > 0
        ? {
            sql: `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at)
                  VALUES (?, ?, '', ?, ?, ?)
                  ON CONFLICT(profile_id, soiree_id) DO UPDATE SET xp = excluded.xp, detail = excluded.detail`,
            args: [profileId, LIGNE_JOUR, xp, JSON.stringify({ v: VERSION_BAREME, jours }), Date.now()],
          }
        : { sql: 'DELETE FROM profile_xp WHERE profile_id = ? AND soiree_id = ?', args: [profileId, LIGNE_JOUR] }
    await this.recalculerTotal(profileId, ecrire)
    return this.byId(profileId)
  }

  /**
   * Écrit la ligne de la campagne (`LIGNE_CAMPAGNE`) : son expérience entière,
   * que `core/campagne.ts` recalcule de ses réponses, et le total avec, dans
   * la même transaction. Effacée à zéro. Toujours sous le verrou du profil
   * de la campagne : lue puis écrite, une somme périmée passerait sinon par
   * dessus la bonne.
   */
  async ecrireXpDeCampagne(profileId: string, xp: number, jours: number): Promise<ProfileRec | null> {
    const ecrire: InStatement =
      xp > 0
        ? {
            sql: `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at)
                  VALUES (?, ?, '', ?, ?, ?)
                  ON CONFLICT(profile_id, soiree_id) DO UPDATE SET xp = excluded.xp, detail = excluded.detail`,
            args: [profileId, LIGNE_CAMPAGNE, xp, JSON.stringify({ v: VERSION_BAREME, jours }), Date.now()],
          }
        : { sql: 'DELETE FROM profile_xp WHERE profile_id = ? AND soiree_id = ?', args: [profileId, LIGNE_CAMPAGNE] }
    await this.recalculerTotal(profileId, ecrire)
    return this.byId(profileId)
  }

  /**
   * Ce que la salle voit d'un profil, au-delà de son prénom : son niveau, sa
   * finition, le légendaire qu'il porte, et s'il brille (l'Éclat tombe sur ce
   * qu'il porte : le légendaire, ou l'emoji).
   */
  apparenceDe(
    p: ProfileRec,
    avatar: string = this.avatarPorte(p),
  ): { niveau: number; finition: Finition; eclat: boolean; legendaire?: string; laurier?: LaurierPorte; champion?: string } {
    const niveau = this.niveauOf(p)
    const legendaire = this.legendairePorte(p)
    const laurier = this.laurierPorte(p.id)
    const champion = this.championDe?.(p.id)
    return {
      niveau,
      finition: finitionPortee(p.finition, niveau),
      // Éteint, un Éclat ne se voit plus : il porte la version d'origine.
      eclat: this.brilleChez(p.id, cibleEclat(legendaire, avatar)),
      ...(legendaire && { legendaire }),
      ...(laurier && { laurier }),
      ...(champion && { champion }),
    }
  }

  /**
   * Ce que la salle voit d'un invité rattaché à ce profil, l'emoji de sa
   * fiche à la main. Lu en mémoire : l'instantané l'appelle à chaque
   * diffusion, et un profil est déjà chargé quand son joueur s'inscrit. Les
   * pages d'une soirée archivée le lisent aussi, leurs profils chargés
   * d'avance (`byIds`) : la même règle, le même avatar qu'en salle.
   */
  badgeDe(profileId: string, avatar: string): ProfileBadge | undefined {
    const profile = this.cached(profileId)
    if (!profile) return undefined
    // Un emoji de collection qu'il n'ouvre plus : l'avatar qu'il porte à sa
    // place, que la fiche reprend (`Party.relireAvatars`).
    const porte = this.peutPorter(profile, avatar) ? avatar : this.avatarPorte(profile)
    // Ce qui brille, c'est ce qu'il porte ce soir : le légendaire éclaté, ou l'emoji joué.
    const apparence = this.apparenceDe(profile, porte)
    const bordure = this.bordureDe(profile, apparence.legendaire)
    return { ...apparence, ...(bordure && { bordure }), ...(porte !== avatar && { avatar: porte }) }
  }

  /**
   * La bordure de ligue qu'il porte, de mémoire (`borduresDe`) — jamais sous
   * un Divin : la salle et les classements la lisent sans attendre la base.
   * Pas encore relue, elle se fait relire en fond (`connaitreSesBordures`),
   * et la lecture suivante la montre.
   */
  bordureDe(p: ProfileRec, legendaire: string | undefined = this.legendairePorte(p) ?? undefined): BordureDeLigue | null {
    if (legendaire && divin(legendaire)) return null
    const bordures = this.borduresDe?.(p.id)
    if (!bordures) this.connaitreSesBordures?.(p.id)
    return bordurePortee(p.bordure, bordures)
  }

  /** Les profils qui ont au moins une ligne d'expérience, c'est-à-dire qui ont joué. */
  async profilsAvecExperience(): Promise<string[]> {
    const res = await this.client.execute('SELECT DISTINCT profile_id FROM profile_xp')
    return res.rows.map(r => String(r.profile_id))
  }

  /**
   * Referme la connexion à la base permanente, comme les quatre autres
   * magasins. Le serveur qui s'arrêtait l'oubliait : la base restait ouverte
   * jusqu'à la sortie du processus, et chaque redémarrage d'un test en
   * laissait une de plus derrière lui.
   */
  close() {
    this.client.close()
  }

  // ── Internes ────────────────────────────────────────────────────────────

  private async require(id: string): Promise<ProfileRec> {
    const rec = await this.byId(id)
    if (!rec) throw new Error('Profil introuvable')
    return rec
  }

  /** Range une ligne de base en mémoire, avec ses éclats. */
  private async remember(row: unknown): Promise<ProfileRec | null> {
    if (!row) return null
    const rec = this.lireLigne(row)
    this.profiles.set(rec.id, rec)
    // Les éclats et les récompenses arrivent avec le profil : ils partent
    // dans l'accusé d'inscription à une soirée, qui est synchrone, et dans
    // l'instantané de toute la salle.
    if (!this.eclats.has(rec.id)) {
      const eclats = await this.client.execute({ sql: 'SELECT avatar, eteint FROM profile_eclats WHERE profile_id = ?', args: [rec.id] })
      const eclates = eclats.rows.filter(e => !estEnReserve(String(e.avatar)))
      this.eclats.set(rec.id, new Set(eclates.map(e => String(e.avatar))))
      this.eteints.set(rec.id, new Set(eclates.filter(e => Number(e.eteint) === 1).map(e => String(e.avatar))))
      this.reserves.set(rec.id, new Set(eclats.rows.map(e => String(e.avatar)).filter(estEnReserve)))
      await this.recompterRecompenses([rec.id])
    }
    if (!this.compagnons.has(rec.id)) {
      const siens = new Map<CleDeCompagnon, SienEnMemoire>()
      const res = await this.client.execute({ sql: 'SELECT compagnon, rang, nom, montree, paliers, ornements FROM profile_compagnons WHERE profile_id = ?', args: [rec.id] })
      for (const r of res.rows) lireCompagnon(siens, r)
      this.compagnons.set(rec.id, siens)
    }
    if (!this.tresors.has(rec.id)) {
      const res = await this.client.execute({ sql: 'SELECT objet FROM profile_coffres WHERE profile_id = ?', args: [rec.id] })
      this.tresors.set(rec.id, new Set(res.rows.map(r => String(r.objet))))
    }
    if (!this.fondsAchetes.has(rec.id)) {
      const res = await this.client.execute({ sql: 'SELECT fond FROM profile_fonds WHERE profile_id = ?', args: [rec.id] })
      this.fondsAchetes.set(rec.id, new Set(res.rows.map(r => String(r.fond))))
    }
    return rec.disabledAt ? null : rec
  }

  /** Une ligne de `profiles`, telle que la mémoire la garde. */
  private lireLigne(row: unknown): ProfileRec {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      login: String(r.login),
      name: String(r.name),
      avatar: String(r.avatar),
      // Borné à la lecture : `auto`, ou une finition qu'il a. L'ancienne
      // valeur par défaut, `mat`, se lit `auto` — personne ne l'avait choisie,
      // c'est ce qu'on donnait à tout le monde.
      finition:
        r.finition === 'mat' ? 'auto' : choixDeFinition(r.finition, niveauDuProfil(Number(r.xp ?? 0), this.gardesOf(String(r.id)))),
      legendaire: typeof r.legendaire === 'string' && r.legendaire ? r.legendaire : null,
      titre: typeof r.titre === 'string' && r.titre ? r.titre : null,
      vitrine: typeof r.vitrine === 'string' && r.vitrine ? r.vitrine : null,
      fond: typeof r.fond === 'string' && r.fond ? r.fond : null,
      theme: typeof r.theme === 'string' && r.theme ? r.theme : null,
      gerbe: typeof r.gerbe === 'string' && r.gerbe ? r.gerbe : null,
      bordure: typeof r.bordure === 'string' && r.bordure ? r.bordure : null,
      niche: typeof r.niche === 'string' && r.niche ? r.niche : null,
      passwordHash: String(r.password_hash),
      recoveryHash: String(r.recovery_hash),
      xp: Number(r.xp ?? 0),
      createdAt: Number(r.created_at),
      lastSeenAt: r.last_seen_at === null || r.last_seen_at === undefined ? null : Number(r.last_seen_at),
      disabledAt: r.disabled_at === null || r.disabled_at === undefined ? null : Number(r.disabled_at),
      renommeLe: r.renomme_le === null || r.renomme_le === undefined ? null : Number(r.renomme_le),
    }
  }
}
