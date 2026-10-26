// Le magasin du Cabinet de curiosités (`CabinetStore`) : les musées et les
// parties en mémoire, ce qui se lit à froid, ce qui s'écrit, et ce qui
// s'oublie. Pas une règle de jeu : il replie (`pliDeLaPartie`), écrit
// (`ecriture.ts`), garde, oublie — les règles sont pures, dans
// `shared/cabinet/`, et la vue choisit ses champs un à un (`vue.ts`).
//
// Il ne connaît la campagne que par sa porte (`core/porteDeLaCampagne.ts`) :
// le verrou du profil, la base jouable et sa mesure, le journal des réponses
// rattrapé, et le rituel d'une réponse en une fonction (`ecrireDesReponses`).
//
// Chaud, une page ne coûte rien : le musée et la partie en cours vivent en
// mémoire, les légendaires se lisent dans les profils. Froid, un seul lot de
// lectures, le journal rattrapé au bout. Un geste coûte un aller-retour, son
// verdict compris ; la fin en ajoute pour l'expérience, les paliers et le
// compagnon (la porte). Un achat, une dorure, un échange, un aller-retour
// chacun, le solde ou la visite revérifiés par la base ; le cartel d'une
// partie et « Mes réponses » d'une partie finie, un, par sa clé. À tout échec
// d'écriture, et à toute garde qui n'a rien écrit (`rowsAffected = 0`), le
// musée et la partie s'oublient : écrite ou non, on ne le sait pas, et la base
// fait foi — le magasin relit à froid et rejoue le geste une fois sur l'état
// vrai (le gabarit `ecrireLExpedition`).
//
// La fin d'une partie, un achat, une dorure et le musée lu à froid
// réconcilient ses gardiens (`gardiens.ts`) : rien de dû et pas rangé, rien
// ne coûte ; un rangement raté se refait à la page suivante, et ce que la
// partie d'hier close par le serveur réveille, la page qui suit le dit.
//
// L'heure est celle de la campagne (`maintenant`, que le banc règle) : jamais
// l'horloge de la machine ici (`cabinet-chronos.test.ts`). Le plafond des départs, lui,
// compte en temps de la machine (`Budget`) : ce n'est pas une échéance.
import { createHmac, randomUUID } from 'node:crypto'
import type { ResultSet } from '@libsql/client'
import { Budget } from '../budget'
import type { QuestionDeLaBase } from '../baseCampagne'
import type { FinDUnePartie, PorteDeLaCampagne, ReponsesEcrites, StatsEnPlus } from '../porteDeLaCampagne'
import type { calendrierDuCabinet } from '../saisons'
import {
  instructionDeLAchat,
  instructionDeLaDorure,
  instructionQuiFigeLaVisite,
  lotDeLEchange,
  lotDeLOubli,
  lotDuDepart,
  lotDuGeste,
  type FinAEcrire,
  type OeuvreAEcrire,
  type VisiteAFiger,
} from './ecriture'
import { reconcilier, type EtagereDuCabinet } from './gardiens'
import { GARDIENS_DU_CABINET, voieDuGardien } from '../../../../shared/cabinet/salles'
import { fondreLesReveils, vuesDuCabinet, type ReveilDesGardiens } from '../../../../shared/cabinet/vues'
import { laLigneDOeuvre, lectureDesOeuvres, lecturesDeLaPartie, lecturesDuMusee, laPartieLue, lireLeMusee, sallesLues, type PartieLueEnBase } from './tables'
import { fichierDuCadrage } from '../details'
import { contenuDuCabinet } from './contenu'
import { preparerLesTas } from './tirages/tas'
import { themeDuPlan, tirerLePlan } from './tirages/index'
import { CHANGEMENTS_PAR_PARTIE, DEPARTS_PAR_HEURE } from '../../../../shared/cabinet/bareme'
import { lireLeBilan, lireUnGeste } from '../../../../shared/cabinet/lecture'
import {
  AUCUN_AUTRE_JEU,
  DEMANDE_ILLISIBLE,
  PAS_AU_CABINET,
  PAS_ENCORE_A_TOI,
  cadreDuDepart,
  dorees,
  ilTeManque,
  jeuDeLEchange,
  museeDe,
  possedees,
  prixDe,
  refusDeLAchat,
  refusDeLEchange,
  serieApresUnJour,
  soldeDe,
  visiteDuJour,
  visiteEchangee,
  visitesAGarder,
  type DemandeLue,
  type LigneDOeuvre,
  type LigneDuProfil,
  type Musee,
  type PartieDuJour,
  type VisiteDuJour,
  type VisiteFigee,
} from '../../../../shared/cabinet/musee'
import { JEUX_PRETS } from '../../../../shared/cabinet/ouverture'
import {
  ILLISIBLE,
  PARTIE_FINIE,
  VERSION_DU_DEPART,
  bilanDe,
  chronoDuDepart,
  enjeuDuTirage,
  estDUnJourDAvant,
  jouerUnGeste,
  laPartieARepondu,
  pliDeLaPartie,
  type BilanDUnePartie,
  type DepartDUnePartie,
  type EtatDeLaPartie,
  type GesteDuCabinet,
  type GesteEcrit,
  type Manche,
} from '../../../../shared/cabinet/partie'
import { OEUVRES_DE_DEPART, estUneOeuvre, type CleDOeuvre } from '../../../../shared/cabinet/oeuvres'
import type { FriseATheme, Lieu } from '../../../../shared/cabinet/contenu'
import { estUneFriseDeSujet } from '../../../../shared/cabinet/pieces'
import { PREFIXE_DE_LA_FRISE, type EvenementDeLaFrise } from '../../../../shared/frise'
import { CLES_DES_JEUX, JEUX, type CleDeJeu } from '../../../../shared/cabinet/jeux/regle'
import { refusDuCadrage, type DetailTire, type EtatDuDetail } from '../../../../shared/cabinet/jeux/detail'
import { jourAvant, jourDe } from '../../../../shared/jour'
import { minuitDe } from '../../../../shared/qg'
import type { Saison } from '../../../../shared/saisons'

/** Les musées gardés en mémoire, au plus : le plus anciennement servi s'en va. Un réglage de la mémoire, pas un barème. */
export const MUSEES_GARDES = 500
/** Les parties en cours gardées en mémoire, au plus, de même. */
export const PARTIES_GARDEES = 200

/**
 * Ce que le Cabinet lit des profils : les légendaires qu'il a, par quelque voie
 * que ce soit, en mémoire — et l'étagère où ses gardiens se rangent
 * (`EtagereDuCabinet`, `gardiens.ts`) ; sans elle, rien ne se range.
 */
export interface ProfilsDuCabinet extends Partial<EtagereDuCabinet> {
  legendairesOf(profileId: string): readonly string[]
}

export interface ReglagesDuCabinet {
  /** L'heure de la campagne (`maintenantDuJour`, que le banc règle). */
  maintenant: () => number
  /** Le calendrier des fêtes du Cabinet (`calendrierDuCabinet`) : le banc et le smoke le ferment. */
  calendrier: Pick<typeof calendrierDuCabinet, 'periodeDu'>
  /**
   * Le hasard que le Cabinet tire lui-même — l'ordre des catégories de
   * l'Éclair, l'affirmation proposée, les voisins et l'ordre des titres du
   * Détail, le sujet d'une frise, ses sept événements et leurs vagues, la
   * piste du Filet — :
   * celui du serveur, `Math.random` à défaut. Le tirage à la pièce garde le
   * sien (`tirerPourUneEscale`, `laMoinsVue`, `versQuestionDeSerie`,
   * `core/tirageALaPiece.ts`), le même que les autres modes : aucun des deux
   * ne vient d'une graine que la page connaîtrait.
   */
  hasard?: () => number
}

/** Un musée en mémoire : des reflets, des faits d'acquisition, les parties du jour sans leur plan. */
interface MuseeGarde {
  profil: LigneDuProfil | null
  oeuvres: Map<string, LigneDOeuvre>
  duJour: { jour: string; parties: PartieDuJour[] }
  enCours: { id: string; jeu: CleDeJeu } | null
  /** L'expédition qui l'attend, lue au lot froid, puis tenue à jour par la campagne quand elle part ou finit (`expeditionChange`). */
  expeditionEnRoute: string | null
  /** Les saisons rangées sous `#cabinet`, relues à froid puis tenues à jour par la réconciliation (`reconcilier`). */
  sousLeCabinet: Set<string>
}

/** Une partie en mémoire : son départ figé, ses gestes écrits, le pli qui en dit l'état. */
export interface PartieGardee {
  id: string
  profileId: string
  depart: DepartDUnePartie
  gestes: GesteEcrit[]
  etat: EtatDeLaPartie
  /** Son bilan figé, une fois finie. */
  bilan: BilanDUnePartie | null
}

/** Une partie telle que la route la montre (`vueDeLaPartie`) — et, au geste qui la finit, ce que la fin a rapporté. */
export interface PartieLue extends PartieGardee {
  /** L'heure du serveur où la vue la dit : son chrono, son pouvoir, et l'heure que la page mesure (invariant 6). */
  lueA: number
  /** Ce que la fin a rapporté : l'expérience, les paliers — et les gardiens qu'elle a réveillés (`reveil`). */
  gains?: { xp: readonly number[]; recompenses: ReponsesEcrites['recompenses']; reveil?: ReveilDesGardiens }
  /**
   * La base a gardé cette partie au cartel de son œuvre — la ligne que la fin
   * lui fait rendre, jamais celle de la mémoire, qui peut ignorer le cartel
   * qu'un autre serveur lui a donné : le bilan le dit (`BilanVu.devientSonCartel`).
   */
  cartelDeSonOeuvre?: true
  /**
   * Finie, le musée du jour tel que la mémoire le tient : ce que son bilan dit
   * du reste de la journée — « Retenter » sa case, les libres qui paient
   * encore. Jamais un aller-retour pour lui : un musée que ce serveur n'a pas
   * en mémoire n'en dit rien, et le bilan s'en passe.
   */
  aujourdhui?: LectureDuJour
}

/** Le musée du jour et sa visite, comme la page les lit : ce que le bilan d'une partie d'aujourd'hui en dit (`PartieLue.aujourdhui`). */
export type LectureDuJour = Pick<LectureDuCabinet, 'musee' | 'visite' | 'jeux'>

/** Ce que la page du Cabinet lit (`pageDuCabinet`). */
export interface LectureDuCabinet {
  maintenant: number
  jour: string
  musee: Musee
  visite: VisiteDuJour
  /** Le jeu qu'un échange donnerait aujourd'hui (`jeuDeLEchange`) : la règle des échanges le lit, la graine reste ici. */
  jeuDeLEchange: CleDeJeu | null
  enCours: PartieLue | null
  expeditionEnRoute: boolean
  /** La fête du jour, au calendrier du Cabinet. */
  fete: Saison | null
  jeux: readonly CleDeJeu[]
  /**
   * Les voies des gardiens que l'étagère tient (`cabinet:phenix`) : un gardien
   * réveillé au Cabinet le dit, et une salle rouverte par une œuvre de plus le
   * sait (« Une œuvre nouvelle est arrivée »). Lues en mémoire.
   */
  rangees: ReadonlySet<string>
  /** Ce que la dépense qui rend la page vient de réveiller, et la partie d'hier que le serveur a close depuis la dernière page ; rien d'autre. */
  reveil?: ReveilDesGardiens
}

/** Ce que le bouton de l'accueil lit (`accueilDuCabinet`) : le musée et sa visite, comme la page les lit. */
export type LectureDeLAccueil = Pick<LectureDuCabinet, 'musee' | 'visite' | 'jeuDeLEchange' | 'jeux'>

/** Un geste reçu : la partie d'après, ou ce qui le refuse sans rien écrire. */
export type IssueDuGeste =
  | { partie: PartieLue }
  /** Celle d'un autre profil, ou qui n'existe pas (invariant 3). */
  | { introuvable: true }
  /** Un rang qui n'est plus le suivant — un double toucher, un autre onglet, une réponse perdue puis rejouée —, ou une partie finie : la vue d'à présent, que la page reprend. */
  | { passe: PartieLue; pourquoi: string }

export const PARTIE_INTROUVABLE = 'Cette partie est introuvable'
export const GESTE_PASSE = 'Ce geste est passé : ta partie a continué sans lui'
export const TROP_DE_DEPARTS = 'Tu joues vite : souffle une minute, puis reprends'
export const RIEN_A_TIRER = 'Ce jeu n’a pas de quoi jouer aujourd’hui : choisis-en un autre'
export const DEPART_CROISE = 'Une autre partie a commencé en même temps : recharge la page'
export const GESTE_CROISE = 'Ce geste en a croisé un autre : recharge la page'
export const TABLEAU_INTROUVABLE = 'Ce tableau n’est pas dans ta partie : recharge la page'
export const DEPENSE_CROISEE = 'Ta poussière d’or a servi ailleurs en même temps : recharge la page'
export const ECHANGE_CROISE = 'Ta visite a changé en même temps : recharge la page'

/** Ce que l'achat et la dorure dépensent : une œuvre manquante, ou le cadre d'une œuvre qu'il a. */
export type SorteDeDepense = 'achat' | 'dorure'

/** Le cartel d'une œuvre à lui, tel que le magasin le lit (`cartelDe`, `vue.ts`) : sa ligne, et la partie que son cartel garde. */
export interface CartelLu {
  oeuvre: CleDOeuvre
  /** Null : une œuvre de départ, à lui par règle, sans ligne. */
  ligne: LigneDOeuvre | null
  /** La partie relue, son bilan figé : null sans cartel de partie, ou si elle ne se relit plus. */
  partie: PartieGardee | null
}

/** Pourquoi une œuvre n'a pas de cartel à lire : une clé qui n'est pas une œuvre, ou une œuvre qui lui manque. */
export type IssueDuCartel = { cartel: CartelLu } | { introuvable: string }

/** Ce que tes murs lisent (`mursDe`, `vue.ts`) : ce qu'il a vu, et ce que le contenu livré et la base en disent encore. */
export interface LectureDesMurs {
  /**
   * Ce qu'il a vu au journal des réponses (`vuesDe`), et quand pour la dernière fois : les composés y restent sous leur
   * identifiant — chaque frise dit d'où elle vient —, et les questions qu'ils ont montrées s'y ajoutent, que `mursDe` ne lit pas.
   */
  vues: ReadonlyMap<string, number>
  lieux: readonly Lieu[]
  frises: readonly FriseATheme[]
  /** Les événements datés de la base, par l'identifiant de leur question — lus seulement s'il a rangé une frise qui en est faite. */
  evenements: ReadonlyMap<string, EvenementDeLaFrise>
}

/** Une ligne de reflets neuve : un profil qui n'a jamais rien écrit au Cabinet. */
const PROFIL_NEUF: LigneDuProfil = { poussiere: 0, serie: 0, serieJour: null, serieRecord: 0, visites: [], partie: null }

/** Les voies que le Cabinet seul range (`cabinet:phenix`) : celles de saison viennent aussi d'ailleurs, et ne disent pas le Cabinet. */
const VOIES_DU_CABINET: readonly string[] = GARDIENS_DU_CABINET.map(g => voieDuGardien(g)!)

/**
 * La ligne d'une œuvre après la fin qui la touche — la même règle que
 * l'instruction de fin (`lotDuGeste`) : un gain entre avec sa saison, son
 * cartel, sa dorure ; une œuvre déjà là prend son cartel et sa dorure sans
 * changer d'origine ni de saison, et rien de ce qu'elle avait ne s'efface.
 */
function ligneApresLaFin(avant: LigneDOeuvre | undefined, o: OeuvreAEcrire, serie: string, t: number): LigneDOeuvre {
  return {
    oeuvre: o.cle,
    origine: avant?.origine ?? o.origine,
    gagneeLe: avant?.gagneeLe ?? t,
    saison: avant ? avant.saison : o.origine === 'partie' ? o.saison : null,
    serieId: avant?.serieId ?? (o.cartel ? serie : null),
    prix: avant?.prix ?? null,
    doreeLe: avant?.doreeLe ?? (o.doree ? t : null),
    dorure: avant?.dorure ?? (o.doree ? 'partie' : null),
    prixDorure: avant?.prixDorure ?? null,
    serieDoree: avant?.serieDoree ?? (o.doree ? serie : null),
  }
}

/** Ce que la route d'un cadrage du Détail sert : son fichier, ou pourquoi pas. */
export type IssueDuCadrage =
  | { fichier: string }
  /** La partie d'un autre profil, ou qui n'existe pas (invariant 3). */
  | { introuvable: 'partie' }
  /** Un tableau qu'aucune manche de sa partie ne joue : une rechange pas prise, un tableau que Changer a remplacé, une manche pas ouverte, un autre jeu. */
  | { introuvable: 'tableau' }
  /** Un cadrage pas encore atteint, ou qui n'existe pas : la phrase de la règle (`refusDuCadrage`). */
  | { refus: string }

/** Une clé courte venue du téléphone, ou rien : une carte-bonus, une œuvre, un jeu se lisent ensuite par leur règle. */
const cle = (x: unknown): string | null => (typeof x === 'string' && x.length > 0 && x.length <= 40 ? x : null)

/**
 * Ce que la page demande à « Commencer », relu champ par champ : la règle des
 * départs (`cadreDuDepart`) juge ensuite, en mots. Une carte-bonus absente
 * vaut « aucune ».
 *
 * « Retenter » se lit par sa case, et seulement par elle : une retente qui
 * nomme une œuvre — la page ne la sait pas, elle ne peut que la forger — ne se
 * lit pas, quelle que soit l'œuvre, carte-bonus ou non, dans les mots de toute
 * demande illisible. Jugée par la règle, l'ordre de ses refus désignait
 * l'œuvre qu'une case manquée visait (l'expert de la triche, à la tablée du
 * 25 octobre 2026) : la seule visée partait, ou se refusait pour sa
 * carte-bonus quand les autres se refusaient pour la retente.
 */
export function lireLaDemande(brut: unknown): DemandeLue | null {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return null
  const b = brut as Record<string, unknown>
  const carte = b.carte === undefined || b.carte === null ? null : cle(b.carte)
  if (carte === null && b.carte !== undefined && b.carte !== null) return null
  switch (b.origine) {
    case 'visite':
      return Number.isInteger(b.case) ? { origine: 'visite', case: b.case as number, carte } : null
    case 'chasse': {
      if (b.retente !== undefined) {
        if (b.retente !== true || b.oeuvre !== undefined || b.jeu !== undefined || !Number.isInteger(b.case)) return null
        return { origine: 'chasse', case: b.case as number, retente: true, carte }
      }
      const oeuvre = cle(b.oeuvre)
      if (!oeuvre) return null
      const jeu = b.jeu === undefined ? undefined : (CLES_DES_JEUX as readonly unknown[]).includes(b.jeu) ? (b.jeu as CleDeJeu) : null
      if (jeu === null) return null
      return { origine: 'chasse', oeuvre, carte, ...(jeu !== undefined && { jeu }) }
    }
    case 'libre': {
      const jeu = cle(b.jeu)
      return jeu ? { origine: 'libre', jeu, carte } : null
    }
    default:
      return null
  }
}

/**
 * Ce que la route sert d'un tableau de cette partie : le fichier du cadrage,
 * si une manche joue ce tableau — son indice dans le plan figé — et l'a
 * atteint, ou tous la manche tranchée (`refusDuCadrage`, la règle du jeu).
 */
function cadrageDeLaPartie(p: PartieGardee, tirage: number, cadrage: number): Exclude<IssueDuCadrage, { introuvable: 'partie' }> {
  const m = p.depart.jeu === 'detail' ? p.etat.manches.find(x => x.tirage === tirage) : undefined
  if (!m) return { introuvable: 'tableau' }
  // Une manche du Détail tient l'état de son jeu : le cadrage atteint, les titres effacés.
  const refus = refusDuCadrage(m.etat as EtatDuDetail, cadrage, m.verdict !== null || p.etat.fin !== null)
  if (refus) return { refus }
  return { fichier: fichierDuCadrage((p.depart.tirages[m.tirage] as DetailTire).tableau.qid, cadrage) }
}

/**
 * La dépense est-elle déjà faite ? Une œuvre déjà achetée, un cadre déjà doré
 * à la poussière : la même requête rejouée rend la page sans rien payer. Une
 * œuvre à lui par une autre voie, un cadre doré en jouant, se refusent en
 * mots (« Elle est déjà à toi », « Son cadre est déjà doré ») : ce n'est pas
 * la même requête.
 */
function dejaPayee(g: MuseeGarde, cle: string, sorte: SorteDeDepense): boolean {
  const ligne = g.oeuvres.get(cle)
  return sorte === 'achat' ? ligne?.origine === 'achat' : ligne?.dorure === 'poussiere'
}

/**
 * Ce refus, la base pourrait-elle le démentir ? Deux seulement : la poussière
 * qui manque, ou l'œuvre à dorer pas encore à lui — l'autre serveur d'une mise
 * en ligne a pu les lui donner. Le refus même le dit, tel que la règle l'a
 * rendu : ce qu'elle dit avant — déjà à lui, déjà doré, une partie qui
 * attend, le prix changé — la mémoire, jamais en avance, ne le dément pas, et
 * ne coûte pas un aller-retour.
 */
function seDementirait(m: Musee, cle: string, refus: string, sorte: SorteDeDepense): boolean {
  const prix = prixDe(cle, sorte)
  return refus === PAS_ENCORE_A_TOI || (prix !== null && refus === ilTeManque(prix - soldeDe(m)))
}

/**
 * Ce cadrage se servira-t-il jamais de cette partie, quoi que l'autre serveur
 * d'une mise en ligne y ait joué ? Un autre jeu, un indice hors de son plan
 * figé, un cadrage hors des quatre : jamais — le départ seul le dit, et un
 * refus n'a rien à relire. Une page qui se trompe ne paie donc pas un
 * aller-retour par demande, sous le verrou du profil.
 */
function peutSeServir(d: DepartDUnePartie, tirage: number, cadrage: number): boolean {
  if (d.jeu !== 'detail' || !Number.isInteger(tirage) || tirage < 0 || tirage >= d.tirages.length) return false
  return refusDuCadrage({ cadrage: 0, effaces: [] }, cadrage, true) === null
}

export class CabinetStore {
  private readonly musees = new Map<string, MuseeGarde>()
  private readonly parties = new Map<string, PartieGardee>()
  /** Trente départs, puis un toutes les deux minutes (`DEPARTS_PAR_HEURE`) : toutes les parties s'écrivent, libres comprises. */
  private readonly departs = new Budget(DEPARTS_PAR_HEURE, DEPARTS_PAR_HEURE / 60)
  private readonly maintenant: () => number
  private readonly hasard: () => number
  /**
   * Les tas de la dernière liste de jouables, et leur préparation : la liste
   * change d'identité — la réserve du jour, un retrait, une base relue —, et
   * ses tas, gardés par elle (`tirages/tas.ts`), avec. Une liste neuve se
   * prépare une fois, en rendant la main entre deux catégories, qu'elle
   * vienne d'une page (`prechauffer`) ou d'un départ, qui l'attend.
   */
  private tas: { jouables: readonly QuestionDeLaBase[]; prets: Promise<void> } | null = null
  /**
   * Les profils dont une réconciliation des gardiens a échoué — l'étagère
   * muette : leur page suivante la refait, même chaude. Sans cela, le gardien
   * dû attendait le prochain changement du musée ou le prochain réveil.
   */
  private readonly aReveiller = new Set<string>()
  /**
   * Ce que la clôture d'une partie d'un jour d'avant a réveillé (`clore`) :
   * rien ne l'attendait — la page, un départ, une dépense passaient par là —,
   * et la page qui suit le dit, une fois. Sans cela, le gardien neuf qu'une
   * chasse laissée la veille au seuil faisait entrer se rangeait sans un mot,
   * et la réconciliation suivante, le trouvant rangé, ne le disait jamais.
   */
  private readonly aAnnoncer = new Map<string, ReveilDesGardiens>()
  /** Les événements datés des jouables, par question, rangés une fois par liste : la porte garde la liste, tes murs la lisent. */
  private evenementsGardes: { de: readonly EvenementDeLaFrise[]; parId: ReadonlyMap<string, EvenementDeLaFrise> } | null = null

  /**
   * Ce que le Cabinet ajoute aux paliers de la campagne (`statsDe`, le crochet
   * `statsEnPlus` de sa porte) : ses salles complètes, que L'Explorateur
   * compte. De la base, dans le lot même des paliers — jamais de la mémoire :
   * à la fin d'une partie, la porte range les paliers avant que le musée gardé
   * prenne l'œuvre que le lot vient d'écrire (`retenirLaFin`), et l'autre
   * serveur d'une mise en ligne a pu en écrire une. Ses œuvres par la clé du
   * profil, quatre-vingt-quatre lignes au plus, à la place des quatre lectures
   * de la renommée de l'Expédition. `server.ts` ne le branche que là où le
   * Cabinet s'ouvre : fermé, aucune salle, et L'Explorateur ne tombe pas.
   */
  readonly statsEnPlus: StatsEnPlus = {
    lectures: profileId => [lectureDesOeuvres(profileId)],
    lire: ([oeuvres]) => ({ salles: sallesLues(oeuvres) }),
  }

  constructor(
    private readonly porte: PorteDeLaCampagne,
    private readonly profils: ProfilsDuCabinet,
    private readonly reglages: ReglagesDuCabinet,
  ) {
    this.maintenant = reglages.maintenant
    this.hasard = reglages.hasard ?? Math.random
  }

  // ── La mémoire ────────────────────────────────────────────────────────

  /** Le plus récemment servi passe au bout : le plus anciennement servi s'en va le premier. */
  private garder<T>(table: Map<string, T>, cle: string, valeur: T, max: number): T {
    table.delete(cle)
    table.set(cle, valeur)
    while (table.size > max) table.delete(table.keys().next().value as string)
    return valeur
  }

  /** Écrite ou non, on ne le sait pas : la base fait foi, et la page suivante relit. */
  private oublier(profileId: string, serie?: string) {
    this.musees.delete(profileId)
    if (serie) this.parties.delete(serie)
    for (const [id, p] of this.parties) if (p.profileId === profileId) this.parties.delete(id)
  }

  /**
   * Le musée tel que les règles le lisent : ses légendaires relus des profils, en mémoire — un gardien gagné ailleurs compte
   * aussitôt. Lu à un autre jour que celui de sa mémoire — l'accueil, qui ne la touche pas —, il n'a encore joué aucune partie
   * de ce jour-là, comme le musée qu'une page relit après minuit (`musee`).
   */
  private museeVu(profileId: string, g: MuseeGarde, jour = g.duJour.jour): Musee {
    return museeDe({
      jour,
      profil: g.profil,
      oeuvres: [...g.oeuvres.values()],
      parties: g.duJour.jour === jour ? g.duJour.parties : [],
      legendaires: this.profils.legendairesOf(profileId),
      enCours: g.enCours,
    })
  }

  /**
   * Son musée, de la mémoire, sinon d'un seul lot de lectures — le journal des
   * réponses rattrapé au bout, que le tirage d'un départ lit ensuite sans
   * aller-retour. Un jour neuf repart d'une journée vide : les parties d'hier
   * ne comptent plus aux droits du jour, et ce que l'autre serveur d'une mise
   * en ligne aurait écrit entre-temps, la base le recompte au départ (D9).
   */
  private async musee(profileId: string, t: number): Promise<MuseeGarde> {
    const jour = jourDe(t)
    const garde = this.musees.get(profileId)
    if (garde) {
      if (garde.duJour.jour !== jour) garde.duJour = { jour, parties: [] }
      return this.garder(this.musees, profileId, garde, MUSEES_GARDES)
    }
    // Sans étagère — un magasin d'essai, sans profils —, ni ses saisons à relire, ni la table qui les tient.
    const avecLEtagere = !!(this.profils.recompensesOf && this.profils.ranger)
    const { lus } = await this.porte.lireAvecLeJournal(lecturesDuMusee(profileId, minuitDe(t), avecLEtagere))
    const lu = lireLeMusee(lus, avecLEtagere)
    if (lu.partieIllisible) await this.rendreLaPartieIllisible(profileId, lu.partieIllisible)
    const enCours = lu.enCours ? this.garderLaPartie(profileId, lu.enCours, null) : null
    const g = this.garder(
      this.musees,
      profileId,
      {
        profil: lu.profil && (lu.partieIllisible ? { ...lu.profil, partie: null } : lu.profil),
        oeuvres: new Map(lu.oeuvres.map(l => [l.oeuvre, l])),
        duJour: { jour, parties: lu.parties },
        enCours: enCours ? { id: enCours.id, jeu: enCours.depart.jeu } : null,
        expeditionEnRoute: lu.expeditionEnRoute,
        sousLeCabinet: new Set(lu.saisonsSousLeCabinet),
      },
      MUSEES_GARDES,
    )
    // Lu à froid — le premier passage d'un réveil, une règle de gardien changée depuis, un rangement qui avait échoué —,
    // le musée réconcilie ses gardiens, en silence : il les avait peut-être déjà, rien ne s'annonce. C'est la relecture
    // du Cabinet : une par réveil et par joueur, sans version à monter.
    await this.reveiller(profileId, this.museeVu(profileId, g), t, g)
    return g
  }

  /**
   * Réveille les gardiens que ce musée doit et que son étagère n'a pas
   * (`reconcilier`, `gardiens.ts`) : rien à ranger, rien ne coûte. Ce qui
   * échoue se refera à la page suivante (`aReveiller`) ; ne rejette jamais.
   * `g`, le musée gardé dont `m` est la vue, tient les saisons rangées.
   */
  private async reveiller(profileId: string, m: Musee, t: number, g: MuseeGarde): Promise<ReveilDesGardiens | null> {
    const { reveil, echec } = await reconcilier(this.profils, profileId, m, t, g.sousLeCabinet)
    if (echec) this.aReveiller.add(profileId)
    else this.aReveiller.delete(profileId)
    return reveil
  }

  /** Les voies des gardiens du Cabinet que son étagère tient, en mémoire. */
  private rangeesDe(profileId: string): Set<string> {
    const r = this.profils.recompensesOf?.(profileId)
    return new Set(r ? VOIES_DU_CABINET.filter(v => r.has(v)) : [])
  }

  /**
   * Une partie que sa ligne dit en cours et que ce code ne relit pas — un
   * départ d'une version inconnue, un geste troué : jamais par une règle de
   * jeu, toujours par un bogue. Le profil ne doit pas rester bloqué derrière
   * elle (« une partie à la fois ») : sa ligne la rend, et le journal le dit.
   */
  private async rendreLaPartieIllisible(profileId: string, serie: string) {
    console.error(`[cabinet] la partie ${serie} ne se relit pas : le profil la rend pour en commencer une autre`)
    await this.porte.client.execute({ sql: 'UPDATE cabinet_profils SET partie = NULL WHERE profile_id = ? AND partie = ?', args: [profileId, serie] })
  }

  /** Une partie relue, repliée et gardée ; ce que le pli ne retrouve pas de la base se dit au journal. */
  private garderLaPartie(profileId: string, lue: PartieLueEnBase, bilan: BilanDUnePartie | null): PartieGardee {
    const etat = pliDeLaPartie(lue.depart, lue.gestes)
    if (etat.ignores > 0) console.warn(`[cabinet] partie ${lue.id} : ${etat.ignores} geste(s) écrit(s) que la relecture refuse — une règle a changé sans monter la version du départ`)
    if (etat.pieces.length !== lue.position) console.warn(`[cabinet] partie ${lue.id} : ${lue.position} pièce(s) en base, le pli en range ${etat.pieces.length}`)
    const partie: PartieGardee = { id: lue.id, profileId, depart: lue.depart, gestes: lue.gestes, etat, bilan }
    return etat.fin ? partie : this.garder(this.parties, lue.id, partie, PARTIES_GARDEES)
  }

  /**
   * Une partie de ce profil : en mémoire, sinon d'un lot de deux lectures
   * cloisonnées ; null pour celle d'un autre, ou qui n'existe pas.
   *
   * Relue finie quand son musée gardé la dit encore en cours, l'autre serveur
   * d'une mise en ligne l'a finie — un cadrage, une page relisent ici la partie
   * qu'il a jouée — : ce musée ne dit plus vrai (la partie rendue, sa
   * poussière, son œuvre), et s'oublie. Gardé, il refusait tout départ
   * (« Ta partie au Détail t'attend ») derrière une partie que plus rien ne
   * pouvait finir, jusqu'au redémarrage. Ici seulement : la fin écrite par ce
   * serveur a déjà rendu la partie à son musée (`retenirLaFin`).
   */
  private async partieDe(profileId: string, serie: string): Promise<PartieGardee | null> {
    const gardee = this.parties.get(serie)
    if (gardee) return gardee.profileId === profileId ? this.garder(this.parties, serie, gardee, PARTIES_GARDEES) : null
    const [ligne, gestes] = await this.porte.client.batch(lecturesDeLaPartie(profileId, serie), 'read')
    const brute = ligne.rows[0] as Record<string, unknown> | undefined
    const lue = laPartieLue(brute, gestes.rows as Record<string, unknown>[])
    if (!lue) {
      if (brute) console.error(`[cabinet] la partie ${serie} ne se relit pas`)
      return null
    }
    const partie = this.garderLaPartie(profileId, lue, brute?.bilan ? lireLeBilan(brute.bilan) : null)
    if (partie.etat.fin && this.musees.get(profileId)?.enCours?.id === serie) this.musees.delete(profileId)
    return partie
  }

  /** La graine de sa visite du jour : `HMAC-SHA256(secret du Cabinet, profil)` — au serveur seul, faite d'un secret que la page n'a pas. */
  private graineDe(profileId: string): string {
    return createHmac('sha256', this.porte.secretDuCabinet()).update(profileId).digest('hex')
  }

  private visiteDe(profileId: string, musee: Musee, t: number): VisiteDuJour {
    return visiteDuJour(musee, { graine: this.graineDe(profileId), jour: jourDe(t), minuit: minuitDe(t), jeux: JEUX_PRETS })
  }

  /**
   * La visite du jour à figer avant un lot qui fait entrer une œuvre après
   * minuit sans être un départ — la première dépense du jour, la fin d'une
   * partie d'un jour d'avant (`instructionQuiFigeLaVisite`) —, dérivée du
   * musée d'avant ce lot ; null si la mémoire la sait déjà figée. Ce que la
   * ligne gardera, aussi : la mémoire le prend une fois le lot écrit
   * (`retenirLaVisite`).
   */
  private visiteAFiger(profileId: string, g: MuseeGarde, t: number): { aEcrire: VisiteAFiger; gardees: VisiteFigee[] } | null {
    const jour = jourDe(t)
    const avant = g.profil?.visites ?? []
    if (avant.some(v => v.jour === jour)) return null
    const gardees = visitesAGarder(this.visiteDe(profileId, this.museeVu(profileId, g), t), avant)
    return { aEcrire: { profileId, jour, visites: JSON.stringify(gardees) }, gardees }
  }

  /**
   * La visite que le lot vient de figer, au musée gardé — comme le départ
   * (`retenirLeDepart`). Figée avant par l'autre serveur d'une mise en ligne,
   * la base garde la sienne : la mémoire d'ici ne l'apprend qu'au premier lot
   * que la base refuse, qui l'oublie et relit (D9).
   */
  private retenirLaVisite(g: MuseeGarde, gel: { aEcrire: VisiteAFiger; gardees: VisiteFigee[] } | null) {
    if (gel && g.profil && !g.profil.visites.some(v => v.jour === gel.aEcrire.jour)) g.profil = { ...g.profil, visites: gel.gardees }
  }

  /**
   * Une partie telle que la route la montre, à `t` : finie, avec le musée du
   * jour que la mémoire tient (`PartieLue.aujourdhui`) — sans verrou de plus,
   * sans aller-retour, et sans faire passer le musée au bout de la mémoire.
   * Absent de la mémoire, ou d'un autre jour, le bilan s'en passe.
   */
  private lue(p: PartieGardee, t: number, plus: Omit<PartieLue, keyof PartieGardee | 'lueA' | 'aujourdhui'> = {}): PartieLue {
    const g = p.etat.fin ? this.musees.get(p.profileId) : undefined
    if (!g || g.duJour.jour !== jourDe(t)) return { ...p, ...plus, lueA: t }
    const musee = this.museeVu(p.profileId, g)
    return { ...p, ...plus, lueA: t, aujourdhui: { musee, visite: this.visiteDe(p.profileId, musee, t), jeux: JEUX_PRETS } }
  }

  // ── L'accueil ─────────────────────────────────────────────────────────

  /**
   * Le gros bouton de l'accueil d'un profil (`ProfilDAccueil.cabinet`) : ses
   * œuvres, et une case de la visite du jour qui attend — de la mémoire seule,
   * sans verrou ni aller-retour. Un musée que ce serveur n'a pas lu depuis son
   * réveil n'en dit rien (null), et le bouton garde sa ligne de toujours : la
   * plupart des profils qui ouvrent l'accueil n'ouvrent pas le Cabinet, et
   * chacun aurait payé son lot froid à chaque réveil, au quota de Turso
   * (`cabinet-charge.test.ts`). L'accueil ne garde pas non plus le musée en
   * vie : il ne le fait pas passer au bout de la mémoire. Le magasin rend la
   * lecture, la route bâtit la vue (`accueilDuCabinet`), comme pour la page.
   */
  accueil(profileId: string): LectureDeLAccueil | null {
    const g = this.musees.get(profileId)
    if (!g) return null
    const t = this.maintenant()
    const musee = this.museeVu(profileId, g, jourDe(t))
    const visite = this.visiteDe(profileId, musee, t)
    return { musee, visite, jeuDeLEchange: jeuDeLEchange(musee, visite, { graine: this.graineDe(profileId), jeux: JEUX_PRETS }), jeux: JEUX_PRETS }
  }

  // ── La page ───────────────────────────────────────────────────────────

  /**
   * Ce que la page du Cabinet lit : chaud, rien ; froid, un lot. Ses seules
   * écritures : une partie d'un jour d'avant — un téléphone éteint en pleine
   * manche, un joueur jamais revenu — se clôt ici, idempotente par sa garde,
   * sous le verrou du profil, un aller-retour, une fois ; et la réconciliation
   * des gardiens, au seul changement (`reveiller`).
   */
  async page(profileId: string): Promise<LectureDuCabinet> {
    return this.porte.avecVerrou(profileId, () => this.lecture(profileId, this.maintenant()))
  }

  /**
   * La page, sous le verrou du profil que l'appelant tient déjà — la page même,
   * ou ce qui rend la page d'après : un achat, une dorure, un échange. Rien à
   * lire chaud ; la mémoire porte déjà ce que le lot vient d'écrire. Une
   * dépense dit ce qu'elle vient de réveiller (`apres.reveil`), et toute page
   * ce que la clôture d'une partie d'hier a réveillé depuis la dernière
   * (`aAnnoncer`) ; une page lue refait la réconciliation qui avait échoué, en
   * silence — chaude seulement : à froid, le musée vient de la faire.
   */
  private async lecture(profileId: string, t: number, apres?: { reveil: ReveilDesGardiens | null }): Promise<LectureDuCabinet> {
    const chaud = this.musees.has(profileId)
    let garde = await this.musee(profileId, t)
    if (!apres && chaud && this.aReveiller.has(profileId)) await this.reveiller(profileId, this.museeVu(profileId, garde), t, garde)
    let enCours = garde.enCours ? await this.partieDe(profileId, garde.enCours.id) : null
    if (enCours?.etat.fin) {
      // Finie par l'autre serveur : son musée vient de s'oublier (`partieDe`), il se relit pour cette page-ci.
      garde = await this.musee(profileId, t)
      enCours = null
    }
    if (enCours && !enCours.etat.fin && estDUnJourDAvant(enCours.depart, jourDe(t))) {
      await this.clore(profileId, enCours, t)
      garde = await this.musee(profileId, t)
      enCours = null
    }
    const musee = this.museeVu(profileId, garde)
    const visite = this.visiteDe(profileId, musee, t)
    const reveil = fondreLesReveils(this.aAnnoncer.get(profileId), apres?.reveil)
    this.aAnnoncer.delete(profileId)
    return {
      maintenant: t,
      jour: jourDe(t),
      musee,
      visite,
      jeuDeLEchange: jeuDeLEchange(musee, visite, { graine: this.graineDe(profileId), jeux: JEUX_PRETS }),
      enCours: enCours && !enCours.etat.fin ? { ...enCours, lueA: t } : null,
      expeditionEnRoute: garde.expeditionEnRoute !== null,
      fete: this.reglages.calendrier.periodeDu(jourDe(t))?.saison ?? null,
      jeux: JEUX_PRETS,
      rangees: this.rangeesDe(profileId),
      ...(reveil && { reveil }),
    }
  }

  /**
   * La partie d'hier, close par le serveur (`clore`) : le pli la finit comme un
   * « Quitter », et la fin s'écrit. Ses manches tranchées gardent leurs
   * étoiles : au seuil, elle gagne son œuvre et peut compléter une salle — ce
   * qu'elle réveille attend la page qui suit (`aAnnoncer`).
   */
  private async clore(profileId: string, p: PartieGardee, t: number) {
    const issue = await this.ecrireUnGeste(profileId, p, { quoi: 'clore', pourquoi: 'lendemain' }, p.etat.rang, t)
    if ('refus' in issue) console.error(`[cabinet] la partie ${p.id} d’un jour d’avant ne se clôt pas : ${issue.refus}`)
    const reveil = 'partie' in issue ? issue.partie.gains?.reveil : undefined
    if (reveil) this.garder(this.aAnnoncer, profileId, fondreLesReveils(this.aAnnoncer.get(profileId), reveil) ?? reveil, MUSEES_GARDES)
  }

  /**
   * Son musée, la partie d'un jour d'avant close d'abord : un départ ou une
   * dépense ne s'arrête pas sur une partie que le joueur a laissée hier
   * (« Ta partie au Pari t'attend »), et ce qu'elle rapporte — sa poussière, son
   * œuvre — compte avant eux. Relue finie, une partie que ce musée disait en
   * cours l'a emporté avec elle (`partieDe`) : il se relit.
   */
  private async museeDuJour(profileId: string, t: number): Promise<MuseeGarde> {
    const garde = await this.musee(profileId, t)
    if (!garde.enCours) return garde
    const p = await this.partieDe(profileId, garde.enCours.id)
    if (p && !p.etat.fin && estDUnJourDAvant(p.depart, jourDe(t))) await this.clore(profileId, p, t)
    return this.musee(profileId, t)
  }

  // ── Commencer ─────────────────────────────────────────────────────────

  /**
   * Une partie qui commence : le plafond des départs,
   * le verrou du profil, la partie d'hier close d'abord, la règle des départs
   * en mots, le plan tiré sur le journal rattrapé, puis un seul lot gardé —
   * l'ouverture de la première manche comprise, son chrono parti avec la
   * réponse. Devancé par un autre onglet ou l'autre serveur d'une mise en
   * ligne, le musée s'oublie, se relit, et le départ se rejoue une fois sur
   * l'état vrai : il part, ou se refuse en mots.
   *
   * Deux heures : l'arrivée de la requête (`recueLe`, avant le verrou) dit le
   * jour, minuit et la date de la partie ; l'ouverture de la première manche
   * se prend une fois le plan tiré, juste avant le lot. Datée de l'arrivée, la
   * manche courait déjà pendant le verrou, le lot froid, la base de la
   * campagne au premier départ d'un réveil — des secondes au dixième de cœur
   * de l'hébergeur —, et le joueur voyait sa question le chrono entamé.
   */
  async commencer(profileId: string, brut: unknown): Promise<PartieLue> {
    const recueLe = this.maintenant()
    if (!this.departs.take(profileId)) throw new Error(TROP_DE_DEPARTS)
    const demande = lireLaDemande(brut)
    if (!demande) throw new Error(DEMANDE_ILLISIBLE)
    return this.porte.avecVerrou(profileId, async () => {
      for (let essai = 0; ; essai++) {
        const t = recueLe
        const jour = jourDe(t)
        const g = await this.museeDuJour(profileId, t)
        const musee = this.museeVu(profileId, g)
        const visite = this.visiteDe(profileId, musee, t)
        const cadre = cadreDuDepart(musee, demande, visite, JEUX_PRETS)
        if (typeof cadre === 'string') throw new Error(cadre)
        // Le journal rattrapé : rien à relire si une lecture est partie après la dernière réponse écrite ici.
        const { journal } = await this.porte.lireAvecLeJournal([])
        const [jouables, mesures] = await Promise.all([this.porte.jouables(), this.porte.mesures()])
        // Les tas d'une liste neuve se préparent en rendant la main : le tireur ne passe jamais toute la base d'un bloc.
        await this.tasDe(jouables)
        // Des rechanges pour Changer, là seulement où il sert : la Frise n'en tire aucune, et sa relecture n'en admet pas.
        const rechanges = cadre.carte?.pouvoir === 'changer' && JEUX[cadre.jeu].changeable ? CHANGEMENTS_PAR_PARTIE[cadre.carte.force] : 0
        const tirages = tirerLePlan(
          cadre.jeu,
          {
            porte: this.porte,
            jouables,
            mesures,
            vues: vuesDuCabinet(journal.vuesDe(profileId).vues),
            maintenant: t,
            hasard: this.hasard,
            // L'œuvre visée règle le tirage — une épique, une dorure : une marche de plus —, et l'Éclair propose les leurres
            // que la campagne choisit (l'arbitrage du 26 octobre 2026).
            enjeu: enjeuDuTirage(cadre),
            leurres: journal.leurresChoisis(),
          },
          rechanges,
        )
        if (!tirages) throw new Error(RIEN_A_TIRER)
        const theme = themeDuPlan(tirages)
        const depart: DepartDUnePartie = {
          v: VERSION_DU_DEPART,
          jeu: cadre.jeu,
          origine: cadre.origine,
          ...(cadre.visite !== undefined && { visite: cadre.visite }),
          jour,
          cible: cadre.cible,
          but: cadre.but,
          ...(cadre.retente && { retente: true as const }),
          seuil: cadre.seuil,
          payee: cadre.payee,
          carte: cadre.carte,
          chrono: chronoDuDepart(cadre.jeu, cadre.carte),
          // La graine du hasard d'Éclairer : un secret du serveur, tiré ici, jamais envoyé (`cabinet-secret.test.ts`).
          graine: randomUUID(),
          ...(theme !== undefined && { theme }),
          tirages,
        }
        const serie = randomUUID()
        // Sous une carte de Miser, la mise se décide avant de voir la manche : la page l'ouvre elle-même.
        const ouverture = cadre.carte?.pouvoir === 'miser' ? null : { geste: { quoi: 'ouvrir', manche: 0 } as GesteDuCabinet, uid: randomUUID() }
        const visites = JSON.stringify(visitesAGarder(visite, g.profil?.visites ?? []))
        // Le zéro du chrono de la première manche : le plan tiré, à l'heure du serveur (invariant 6).
        const ouverteLe = this.maintenant()
        let lus: ResultSet[]
        try {
          lus = await this.porte.client.batch(
            lotDuDepart({ profileId, serie, depart, t, ouverteLe, jour, minuit: minuitDe(t), visites, ouverture }),
            'write',
          )
        } catch (e) {
          this.oublier(profileId)
          throw e
        }
        if (lus[0].rowsAffected !== 1 || lus[1].rows.length !== 1) {
          // Devancé : quelqu'un a pris la partie, la chasse ou la case. Le refus juste se dit sur l'état vrai.
          this.oublier(profileId)
          if (essai === 0) continue
          throw new Error(DEPART_CROISE)
        }
        const payee = depart.origine === 'libre' ? Number(lus[1].rows[0].payee) === 1 : true
        const figee: DepartDUnePartie = { ...depart, payee }
        this.retenirLeDepart(g, figee, serie, t, visite)
        const gestes: GesteEcrit[] = ouverture ? [{ geste: ouverture.geste, faitLe: ouverteLe }] : []
        const partie: PartieGardee = { id: serie, profileId, depart: figee, gestes, etat: pliDeLaPartie(figee, gestes), bilan: null }
        return { ...this.garder(this.parties, serie, partie, PARTIES_GARDEES), lueA: this.maintenant() }
      }
    })
  }

  /**
   * Ce que le lot du départ a écrit, appliqué au musée gardé — la même règle que la base : la visite figée, la partie du jour.
   * La série attend sa première manche répondue (`jourCompte`, `ecrireUnGeste`).
   */
  private retenirLeDepart(g: MuseeGarde, d: DepartDUnePartie, serie: string, t: number, visite: VisiteDuJour) {
    const avant = g.profil ?? PROFIL_NEUF
    g.profil = {
      ...avant,
      visites: avant.visites.some(v => v.jour === d.jour) ? avant.visites : visitesAGarder(visite, avant.visites),
      partie: serie,
    }
    g.duJour.parties.push({
      id: serie,
      commenceeLe: t,
      finieLe: null,
      issue: null,
      origine: d.origine,
      visite: d.visite ?? null,
      jeu: d.jeu,
      cible: d.cible,
      payee: d.payee,
      total: null,
    })
    g.enCours = { id: serie, jeu: d.jeu }
  }

  // ── Un geste ──────────────────────────────────────────────────────────

  /**
   * Un geste de la page : l'heure d'arrivée prise avant
   * le verrou, la partie cloisonnée au profil, son rang (invariant 12), le
   * geste relu champ par champ, la seule règle des refus (le pli), puis ce que
   * le pli a tranché, en un lot gardé par le geste. Le rang déjà pris par
   * l'autre serveur, la partie s'oublie, se relit, et le geste se rejoue une
   * fois sur l'état vrai : il rend alors la vue de ce qui était déjà fait.
   *
   * Un rang en avance sur la mémoire dit que l'autre serveur d'une mise en
   * ligne a joué la partie depuis : la page tient sa vue de lui. Elle s'oublie
   * et se relit une fois — un aller-retour, sur ce seul cas —, et le geste se
   * joue sur l'état vrai ; sinon le refus rendait la vue de la mémoire, une
   * manche déjà tranchée encore « à jouer », que la page reprenait. Un rang en
   * retard (un double toucher, une réponse perdue puis rejouée, le cas
   * ordinaire) ne relit rien : c'est la page qui est en retard.
   */
  async geste(profileId: string, serie: string, rang: unknown, brut: unknown): Promise<IssueDuGeste> {
    const recueLe = this.maintenant()
    return this.porte.avecVerrou(profileId, async () => {
      for (let essai = 0; ; essai++) {
        const enMemoire = this.parties.has(serie)
        const p = await this.partieDe(profileId, serie)
        if (!p) return { introuvable: true }
        if (p.etat.fin) return { passe: this.lue(p, this.maintenant()), pourquoi: PARTIE_FINIE }
        if (rang !== p.etat.rang && enMemoire && essai === 0 && typeof rang === 'number' && rang > p.etat.rang) {
          this.oublier(profileId, serie)
          continue
        }
        if (rang !== p.etat.rang) return { passe: this.lue(p, this.maintenant()), pourquoi: GESTE_PASSE }
        const geste = lireUnGeste(brut)
        if (!geste) throw new Error(ILLISIBLE)
        const issue = await this.ecrireUnGeste(profileId, p, geste, p.etat.rang, recueLe)
        if ('refus' in issue) throw new Error(issue.refus)
        if ('partie' in issue) return issue
        if (essai > 0) throw new Error(GESTE_CROISE)
      }
    })
  }

  /**
   * Le geste joué au pli à `t`, puis écrit : rien que lui, ses pièces sous lui,
   * et la fin au dernier — par la porte dès qu'une réponse s'écrit, pour son
   * rituel. Rend la partie d'après, le refus en mots (rien d'écrit), ou
   * `devance` : le rang était pris, la mémoire est oubliée.
   */
  private async ecrireUnGeste(
    profileId: string,
    p: PartieGardee,
    geste: GesteDuCabinet,
    rang: number,
    t: number,
  ): Promise<{ partie: PartieLue } | { refus: string } | { devance: true }> {
    const apres = jouerUnGeste(p.depart, p.etat, geste, t)
    if (typeof apres === 'string') return { refus: apres }
    const pieces = apres.pieces.slice(p.etat.pieces.length)
    const finit = apres.fin !== null && p.etat.fin === null
    const uid = randomUUID()
    const garde = finit ? await this.musee(profileId, t) : null
    const fin = garde ? this.laFin(profileId, garde, p, apres) : null
    // Sa première manche répondue d'une visite ou d'une chasse compte le jour de son départ à la série — jamais le départ
    // seul : quittée d'emblée, ou laissée à l'échéance sans une réponse, une partie ne tient pas la série (le 26 octobre 2026).
    const jourCompte =
      p.depart.origine !== 'libre' && !laPartieARepondu(p.etat) && laPartieARepondu(apres) ? { profileId, jour: p.depart.jour, veille: jourAvant(p.depart.jour) } : null
    // La fin d'une partie d'un jour d'avant — close au matin par la page, ou jouée par-delà minuit — fige la visite du jour
    // d'abord : son départ a figé celle de son jour à elle, et l'œuvre qu'elle fait entrer, minuit ne l'avait pas.
    const gel = fin && garde && jourDe(t) !== p.depart.jour ? this.visiteAFiger(profileId, garde, t) : null
    const lot = lotDuGeste({
      serie: p.id,
      rang,
      geste,
      faitLe: t,
      uid,
      pieces,
      compagnon: this.porte.compagnonDeLaNiche(profileId),
      jourCompte,
      visite: gel?.aEcrire ?? null,
      fin: fin?.aEcrire ?? null,
    })
    let ecrites: ReponsesEcrites
    // Ce que ses gardiens annoncent, capté par la fermeture que la porte appelle entre l'expérience et les paliers.
    const capte: { reveil?: ReveilDesGardiens | null } = {}
    try {
      if (pieces.length === 0 && !fin) ecrites = { lus: await this.porte.client.batch(lot, 'write'), xp: [], recompenses: {} }
      else {
        const finDuRituel: FinDUnePartie | undefined =
          fin && garde
            ? {
                serieId: p.id,
                quand: t,
                justes: apres.pieces.filter(x => x.juste).map(x => x.repondueLe),
                ecrite: ([g]) => g.rowsAffected === 1,
                // La porte ne l'appelle que si le lot a écrit la fin : le musée qu'elle laisse est vrai.
                avantLesPaliers: async () => {
                  capte.reveil = await this.reveiller(profileId, this.museeApresLaFin(profileId, garde, p.id, fin.aEcrire, t, jourCompte?.jour ?? null), t, garde)
                },
              }
            : undefined
        ecrites = await this.porte.ecrireDesReponses(profileId, lot, finDuRituel)
      }
    } catch (e) {
      this.oublier(profileId, p.id)
      throw e
    }
    if (ecrites.lus[0].rowsAffected !== 1) {
      this.oublier(profileId, p.id)
      return { devance: true }
    }
    const gestes = [...p.gestes, { geste, faitLe: t }]
    const suite: PartieGardee = { ...p, gestes, etat: apres, bilan: fin?.aEcrire.bilan ?? null }
    if (garde) this.retenirLaVisite(garde, gel)
    // La série que le lot vient d'écrire, au musée gardé s'il y est : absent, la page suivante le relit de la base.
    const gardeDuMusee = garde ?? this.musees.get(profileId)
    if (jourCompte && gardeDuMusee?.profil) gardeDuMusee.profil = { ...gardeDuMusee.profil, ...serieApresUnJour(gardeDuMusee.profil, jourCompte.jour) }
    if (fin && garde) {
      // L'œuvre telle que la base l'a gardée : la dernière instruction du lot, lue de ses lignes (`RETURNING`), jamais de
      // son compte. La mémoire d'ici a pu ignorer le cartel que l'autre serveur d'une mise en ligne lui avait donné.
      const ecrite = fin.aEcrire.oeuvre ? laLigneDOeuvre((ecrites.lus[lot.length - 1]?.rows[0] ?? {}) as Record<string, unknown>) : null
      this.retenirLaFin(garde, suite, fin.aEcrire, t, ecrite)
      this.parties.delete(p.id)
      const reveil = capte.reveil
      return {
        partie: this.lue(suite, this.maintenant(), {
          gains: { xp: ecrites.xp, recompenses: ecrites.recompenses, ...(reveil && { reveil }) },
          ...(ecrite?.serieId === p.id && { cartelDeSonOeuvre: true as const }),
        }),
      }
    }
    this.garder(this.parties, p.id, suite, PARTIES_GARDEES)
    return { partie: { ...suite, lueA: this.maintenant() } }
  }

  /**
   * Ce que la fin écrit : le bilan, l'œuvre telle que son musée la tient à
   * présent — une chasse du matin l'a pu faire entrer avant la visite ; pendant
   * la partie, ni achat ni dorure ne la changent (`refusDeLAchat`, et la base
   * sous `partie IS NULL`).
   */
  private laFin(profileId: string, garde: MuseeGarde, p: PartieGardee, apres: EtatDeLaPartie): { aEcrire: FinAEcrire } {
    const musee = this.museeVu(profileId, garde)
    const cible = p.depart.cible
    const aLui = cible !== null && estUneOeuvre(cible) ? { possedee: possedees(musee).has(cible), doree: dorees(musee).has(cible) } : null
    const bilan = bilanDe(p.depart, apres, aLui)
    return { aEcrire: { profileId, bilan, oeuvre: this.oeuvreDeLaFin(garde, bilan, p.depart.jour) } }
  }

  /** L'œuvre que la fin touche, en une seule instruction : le gain, la dorure, le cartel d'un double. */
  private oeuvreDeLaFin(garde: MuseeGarde, bilan: BilanDUnePartie, jourDuDepart: string): OeuvreAEcrire | null {
    const cle = bilan.oeuvre
    if (cle === undefined || !estUneOeuvre(cle)) return null
    const ligne = garde.oeuvres.get(cle)
    const cartel = bilan.cartel !== null && !ligne?.serieId
    if (bilan.issue === 'gagnee' || bilan.issue === 'gagnee-doree') {
      // La saison se lit au jour de son départ, comme sa case et sa poussière, au calendrier du Cabinet — que le banc
      // ferme : une partie du 24 octobre close à la page du 25 n'est pas d'Halloween, celle du 31 finie après minuit l'est.
      const saison = this.reglages.calendrier.periodeDu(jourDuDepart)?.saison.key ?? null
      return { cle, origine: 'partie', saison, cartel: bilan.cartel !== null, doree: bilan.issue === 'gagnee-doree' }
    }
    const doree = bilan.issue === 'doree'
    if (!doree && !cartel) return null
    // Une œuvre de départ n'a pas de ligne : la sienne naît pour son cartel ou son cadre doré.
    return { cle, origine: ligne ? 'partie' : 'depart', saison: null, cartel, doree }
  }

  /**
   * Ce que le lot de fin a écrit, appliqué au musée gardé : la poussière au
   * reflet, la partie rendue si c'est la sienne, la partie du jour, et l'œuvre —
   * la ligne que la base a rendue (`ecrite`), sinon la même règle qu'elle.
   */
  private retenirLaFin(g: MuseeGarde, p: PartieGardee, fin: FinAEcrire, t: number, ecrite: LigneDOeuvre | null) {
    if (g.profil) g.profil = { ...g.profil, poussiere: g.profil.poussiere + fin.bilan.poussiere, partie: g.profil.partie === p.id ? null : g.profil.partie }
    if (g.enCours?.id === p.id) g.enCours = null
    const duJour = g.duJour.parties.find(x => x.id === p.id)
    if (duJour) Object.assign(duJour, { finieLe: t, issue: fin.bilan.issue, total: fin.bilan.total })
    if (fin.oeuvre) g.oeuvres.set(fin.oeuvre.cle, ecrite ?? ligneApresLaFin(g.oeuvres.get(fin.oeuvre.cle), fin.oeuvre, p.id, t))
  }

  /**
   * Le musée tel que la fin le laisse, sans toucher la mémoire : ses gardiens se
   * réconcilient entre l'expérience et les paliers (`avantLesPaliers`), avant
   * que la mémoire prenne la fin (`retenirLaFin`). L'œuvre change ce qu'ils
   * lisent, et la série si ce dernier geste est sa première manche répondue
   * (`jourCompte`) : le trentième jour réveille le Scarabée à cette fin-là.
   */
  private museeApresLaFin(profileId: string, g: MuseeGarde, serie: string, fin: FinAEcrire, t: number, jourCompte: string | null): Musee {
    const m = this.museeVu(profileId, g)
    const profil = jourCompte !== null && m.profil ? { ...m.profil, ...serieApresUnJour(m.profil, jourCompte) } : m.profil
    if (!fin.oeuvre) return { ...m, profil }
    const oeuvres = new Map(m.oeuvres)
    oeuvres.set(fin.oeuvre.cle, ligneApresLaFin(m.oeuvres.get(fin.oeuvre.cle), fin.oeuvre, serie, t))
    return { ...m, profil, oeuvres }
  }

  // ── Un cadrage du Détail ──────────────────────────────────────────────

  /**
   * Un cadrage d'un tableau du Détail, par l'indice du tableau dans le plan
   * figé — jamais la manche : après « Changer », la même manche joue un autre
   * tableau, et l'adresse d'avant aurait rendu du cache l'image d'avant. Seul
   * se sert le tableau qu'une manche joue — ni une rechange pas encore prise,
   * ni celui que Changer a remplacé, ni celui d'une manche pas ouverte : tirés
   * d'avance, ils se verraient avant leur tour —, et de lui le cadrage déjà
   * atteint, le premier à l'ouverture, un de plus à chaque « Reculer », tous la
   * manche tranchée (`refusDuCadrage`, invariant 1). La partie se lit en
   * mémoire, zéro aller-retour ; finie, elle n'y est plus et se relit d'un lot,
   * par sa clé. Sous le verrou du profil, comme tout ce qui lit sa partie : la
   * mémoire ne se remplit jamais derrière un geste en route.
   *
   * Refusé sur la mémoire, un cadrage qui peut se servir (`peutSeServir`) se
   * relit une fois : l'autre serveur d'une mise en ligne a pu jouer la partie
   * depuis — « Reculer », « Changer », la manche suivante, la fin —, et la page
   * tient sa vue de lui. La mémoire n'est jamais en avance sur la base (elle ne
   * prend que ce qui s'est écrit) : relue, la partie ne recule pas, et la base
   * fait foi ; relue finie, son musée s'oublie avec elle (`partieDe`). Une page
   * qui suit sa vue n'est jamais refusée : ce rattrapage ne coûte rien
   * d'ordinaire.
   */
  async cadrage(profileId: string, serie: string, tirage: number, cadrage: number): Promise<IssueDuCadrage> {
    return this.porte.avecVerrou(profileId, async () => {
      for (let essai = 0; ; essai++) {
        const enMemoire = this.parties.has(serie)
        const p = await this.partieDe(profileId, serie)
        if (!p) return { introuvable: 'partie' }
        const issue = cadrageDeLaPartie(p, tirage, cadrage)
        if ('fichier' in issue || !enMemoire || essai > 0 || !peutSeServir(p.depart, tirage, cadrage)) return issue
        this.parties.delete(serie)
      }
    })
  }

  // ── La poussière d'or : acheter, dorer ────────────────────────────────

  /** Acheter une œuvre qui lui manque, au prix que la page a montré : la page d'après, ou le refus en mots. */
  acheter(profileId: string, cle: string, prixMontre: unknown): Promise<LectureDuCabinet> {
    return this.depenser(profileId, cle, prixMontre, 'achat')
  }

  /** Dorer le cadre d'une œuvre qu'il a, au prix que la page a montré. */
  dorer(profileId: string, cle: string, prixMontre: unknown): Promise<LectureDuCabinet> {
    return this.depenser(profileId, cle, prixMontre, 'dorure')
  }

  /**
   * Une dépense de poussière d'or, sous le verrou du profil : la partie d'un
   * jour d'avant close d'abord (`museeDuJour`), la règle des refus sur le musée
   * (`refusDeLAchat` — un gardien, une clé inconnue, déjà à lui, pas encore à
   * lui, déjà doré, une partie qui attend, le prix changé, ce qu'il manque),
   * puis une seule instruction, qui revérifie le solde dans la base même (D8).
   * Un aller-retour ; la page d'après se lit en mémoire.
   *
   * Rejouée — la réponse perdue en route, l'écriture qui attend le réveil de
   * l'hébergeur (`auReveil`) —, elle ne paie pas deux fois : une œuvre déjà
   * achetée, un cadre déjà doré à la poussière rendent la page, sans rien
   * écrire. Écrite chez l'autre serveur d'une mise en ligne, la ligne que la
   * clé garde ne s'écrit pas ici (`rowsAffected = 0`) : le musée s'oublie, se
   * relit, et la dépense se rejoue une fois sur l'état vrai — faite, ou
   * refusée en mots.
   *
   * La mémoire n'est jamais en avance sur la base, mais elle peut retarder :
   * l'autre serveur a pu lui faire gagner de la poussière, ou l'œuvre. Un refus
   * que la base pourrait démentir — le solde, une œuvre pas encore à lui — se
   * relit donc une fois avant de se dire ; aucun autre ne coûte un aller-retour.
   */
  private depenser(profileId: string, cle: string, prixMontre: unknown, sorte: SorteDeDepense): Promise<LectureDuCabinet> {
    return this.porte.avecVerrou(profileId, async () => {
      for (let essai = 0; ; essai++) {
        const t = this.maintenant()
        const enMemoire = this.musees.has(profileId)
        const g = await this.museeDuJour(profileId, t)
        if (dejaPayee(g, cle, sorte)) return this.lecture(profileId, t)
        const musee = this.museeVu(profileId, g)
        const refus = refusDeLAchat(musee, cle, prixMontre, sorte)
        if (refus) {
          if (enMemoire && essai === 0 && seDementirait(musee, cle, refus, sorte)) {
            this.oublier(profileId)
            continue
          }
          throw new Error(refus)
        }
        // La règle l'a dit : une œuvre du Cabinet, au prix du jour.
        const oeuvre = cle as CleDOeuvre
        const prix = prixMontre as number
        const depense = { profileId, oeuvre, prix, t }
        const instruction = sorte === 'achat' ? instructionDeLAchat(depense) : instructionDeLaDorure({ ...depense, deDepart: OEUVRES_DE_DEPART.includes(oeuvre) })
        // La première dépense du jour fige la visite, dans le même aller-retour : achetée, l'œuvre qui complète une salle
        // dont le gardien veillait déjà ailleurs changeait la case du prochain gardien. Une dorure n'y change rien
        // aujourd'hui — ni ce qu'il possède ni ses premiers gardiens —, mais une dépense n'a qu'une règle.
        const gel = this.visiteAFiger(profileId, g, t)
        let ecrite: ResultSet
        try {
          ecrite = gel ? (await this.porte.client.batch([instruction, instructionQuiFigeLaVisite(gel.aEcrire)], 'write'))[0] : await this.porte.client.execute(instruction)
        } catch (e) {
          this.oublier(profileId)
          throw e
        }
        if (ecrite.rowsAffected !== 1) {
          // Devancé : la même dépense, ou une autre qui a pris la poussière. Le refus juste se dit sur l'état vrai.
          this.oublier(profileId)
          if (essai === 0) continue
          throw new Error(DEPENSE_CROISEE)
        }
        this.retenirLaVisite(g, gel)
        this.retenirLaDepense(g, oeuvre, sorte, prix, t)
        // Une œuvre achetée peut compléter une salle, ou le Cabinet ; une dorure, dorer une salle entière : la page d'après le dit.
        const reveil = await this.reveiller(profileId, this.museeVu(profileId, g), t, g)
        return this.lecture(profileId, t, { reveil })
      }
    })
  }

  /** Ce que l'instruction a écrit, appliqué au musée gardé : la ligne neuve d'un achat, la dorure posée sur la sienne. */
  private retenirLaDepense(g: MuseeGarde, cle: CleDOeuvre, sorte: SorteDeDepense, prix: number, t: number) {
    const avant = g.oeuvres.get(cle)
    if (sorte === 'achat') {
      g.oeuvres.set(cle, { oeuvre: cle, origine: 'achat', gagneeLe: t, saison: null, serieId: null, prix, doreeLe: null, dorure: null, prixDorure: null, serieDoree: null })
      return
    }
    g.oeuvres.set(
      cle,
      avant
        ? { ...avant, doreeLe: t, dorure: 'poussiere', prixDorure: prix }
        : { oeuvre: cle, origine: 'depart', gagneeLe: t, saison: null, serieId: null, prix: null, doreeLe: t, dorure: 'poussiere', prixDorure: prix, serieDoree: null },
    )
  }

  // ── L'échange d'un jeu de la visite ───────────────────────────────────

  /**
   * « Changer de jeu » sur une case de la visite pas encore jouée, une fois
   * par jour : le jeu neuf, celui que la règle des échanges donne
   * (`jeuDeLEchange`), l'œuvre en jeu gardée. Un lot gardé, d'un aller-retour :
   * la visite se fige si rien ne l'a encore fait, puis la case change, sous la
   * base même. Devancé — l'autre serveur d'une mise en ligne, un autre onglet a
   * échangé, ou commencé la case —, le musée s'oublie, se relit, et l'échange
   * se rejoue une fois : il passe, ou se refuse en mots. La mémoire n'est
   * jamais en avance : son refus se dit sans relire.
   */
  echanger(profileId: string, k: unknown): Promise<LectureDuCabinet> {
    return this.porte.avecVerrou(profileId, async () => {
      for (let essai = 0; ; essai++) {
        const t = this.maintenant()
        const jour = jourDe(t)
        const g = await this.musee(profileId, t)
        const musee = this.museeVu(profileId, g)
        const visite = this.visiteDe(profileId, musee, t)
        const jeu = jeuDeLEchange(musee, visite, { graine: this.graineDe(profileId), jeux: JEUX_PRETS })
        // Sans jeu à proposer, la règle refuse déjà : `jeu` n'est nul qu'avec ce refus.
        const refus = refusDeLEchange(musee, visite, k, jeu)
        if (refus !== null || jeu === null) throw new Error(refus ?? AUCUN_AUTRE_JEU)
        const kase = k as Manche
        const lot = lotDeLEchange({
          profileId,
          t,
          jour,
          minuit: minuitDe(t),
          visites: JSON.stringify(visitesAGarder(visite, g.profil?.visites ?? [])),
          case: kase,
          avant: visite.cases[kase].jeu,
          jeu,
        })
        let lus: ResultSet[]
        try {
          lus = await this.porte.client.batch(lot, 'write')
        } catch (e) {
          this.oublier(profileId)
          throw e
        }
        if (lus[1].rowsAffected !== 1) {
          this.oublier(profileId)
          if (essai === 0) continue
          throw new Error(ECHANGE_CROISE)
        }
        // La même règle que la base : la visite du jour figée, sa case à son jeu neuf, l'échange du jour pris.
        const avant = g.profil ?? PROFIL_NEUF
        g.profil = { ...avant, visites: visitesAGarder(visiteEchangee(visite, kase, jeu), avant.visites) }
        return this.lecture(profileId, t)
      }
    })
  }

  // ── Ce qui se relit : le cartel, « Mes réponses » ─────────────────────

  /**
   * Le cartel d'une œuvre à lui : sa ligne, de la mémoire, et la partie que
   * son cartel garde, relue de sa clé — un aller-retour, deux lignes — pour le
   * même pli que la partie en cours (invariant 14). Une œuvre sans cartel de
   * partie — offerte, achetée — ne lit rien de plus. Une clé qui
   * n'est pas une œuvre, ou une œuvre qui lui manque : pas de cartel.
   */
  cartel(profileId: string, cle: string): Promise<IssueDuCartel> {
    if (!estUneOeuvre(cle)) return Promise.resolve({ introuvable: PAS_AU_CABINET })
    return this.porte.avecVerrou(profileId, async () => {
      const g = await this.musee(profileId, this.maintenant())
      if (!possedees(this.museeVu(profileId, g)).has(cle)) return { introuvable: PAS_ENCORE_A_TOI }
      const ligne = g.oeuvres.get(cle) ?? null
      const partie = ligne?.serieId ? await this.partieDe(profileId, ligne.serieId) : null
      if (ligne?.serieId && !partie) console.error(`[cabinet] le cartel de ${cle} nomme la partie ${ligne.serieId}, qui ne se relit pas`)
      return { cartel: { oeuvre: cle, ligne, partie } }
    })
  }

  /**
   * Une partie de ce profil, en cours ou finie — « Mes réponses » —, par le même
   * pli que la page (invariant 14) : en cours, de la mémoire ; finie, de sa clé,
   * un aller-retour. Celle d'un autre profil, ou qui n'existe pas : null.
   */
  partie(profileId: string, serie: string): Promise<PartieLue | null> {
    return this.porte.avecVerrou(profileId, async () => {
      const p = await this.partieDe(profileId, serie)
      return p && this.lue(p, this.maintenant())
    })
  }

  /**
   * Tes murs : ce qu'il a épinglé et rangé, d'où qu'il vienne — rien ne
   * s'écrit pour eux. Le journal des réponses, rattrapé d'un aller-retour au
   * plus — aucun s'il est frais —, et le contenu livré ; la base jouable
   * seulement s'il a rangé une frise faite de ses questions — celle d'un sujet,
   * celle de l'Expédition —, la liste que la porte garde, comme au tirage. Une
   * pièce n'entre au journal qu'à son verdict : la manche en jeu n'y est pas,
   * et les murs ne disent rien qu'une révélation n'ait dit (invariant 1). Sans
   * le verrou du profil : ni sa partie ni son musée n'y sont touchés.
   */
  async murs(profileId: string): Promise<LectureDesMurs> {
    const { journal } = await this.porte.lireAvecLeJournal([])
    const { vues } = journal.vuesDe(profileId)
    const { lieux, frises } = contenuDuCabinet()
    const datees = [...vues.keys()].some(id => estUneFriseDeSujet(id) || id.startsWith(PREFIXE_DE_LA_FRISE))
    return { vues, lieux, frises, evenements: datees ? this.evenementsParQuestion(await this.porte.jouables()) : new Map() }
  }

  private evenementsParQuestion(jouables: readonly QuestionDeLaBase[]): ReadonlyMap<string, EvenementDeLaFrise> {
    const de = this.porte.evenementsDe(jouables)
    if (this.evenementsGardes?.de !== de) this.evenementsGardes = { de, parId: new Map(de.map(e => [e.id, e])) }
    return this.evenementsGardes.parId
  }

  // ── Le reste ──────────────────────────────────────────────────────────

  /**
   * La base de la campagne et les tas du Cabinet, lus en fond : la page du
   * Cabinet la lance derrière sa réponse, comme l'accueil (`prechauffageAuProfil`,
   * `server.ts`) — le premier départ d'un réveil ne les attend pas. Chaque
   * page la relance : une liste de jouables neuve depuis la dernière refait
   * ses tas en fond, avant que le départ qui suit ne les demande. Ne rejette
   * jamais : ce qui manque, le départ le refera.
   */
  prechauffer(): Promise<void> {
    this.porte.prechauffer()
    return this.porte.jouables().then(
      jouables => this.tasDe(jouables),
      e => console.error('[cabinet] base de la campagne non lue, le premier départ la lira :', e),
    )
  }

  /**
   * Les tas de cette liste de jouables, prêts : rien si c'est la dernière
   * préparée, sinon sa préparation — une catégorie par tour de boucle
   * (`preparerLesTas`), jamais d'un bloc. Un départ l'attend plutôt que de
   * passer vingt-cinq mille questions au crible sur son chemin (près d'une
   * seconde ici, dix fois plus au dixième de cœur de l'hébergeur). Ne rejette
   * jamais : ratée, elle se redemande, et le tireur fait ce qui manque.
   */
  private tasDe(jouables: readonly QuestionDeLaBase[]): Promise<void> {
    if (this.tas?.jouables !== jouables) {
      const prets: Promise<void> = preparerLesTas(this.porte, jouables).catch(e => {
        if (this.tas?.prets === prets) this.tas = null
        console.error('[cabinet] tas non préparés, le tireur fera ce qui manque :', e)
      })
      this.tas = { jouables, prets }
    }
    return this.tas.prets
  }

  /**
   * Son expédition part ou finit (`ExpeditionQuiChange`, que la campagne
   * appelle sous le verrou du profil) : la ligne « Ton expédition t'attend »
   * de sa page suit, en mémoire. Le lot froid la lit une fois par réveil ;
   * gardée telle quelle, une expédition finie la laissait jusqu'au
   * redémarrage — et, le départ fermé, elle menait à une page qui renvoie ici.
   * Un musée qui n'est pas en mémoire n'a rien à oublier : son lot froid lira
   * la base, écrite avant ce mot.
   */
  expeditionChange(profileId: string, enRoute: string | null): void {
    const garde = this.musees.get(profileId)
    if (garde) garde.expeditionEnRoute = enRoute
  }

  /**
   * Un profil supprimé : ses gestes, ses reflets et ses œuvres, **avant** que
   * la campagne efface ses séries — les gestes se trouvent par elles
   * (`supprimerProfil`, `server.ts`). Sous le verrou du profil, comme la
   * campagne : un départ ou un geste déjà en route — authentifié avant que
   * ses sessions tombent — finit d'abord, et ce qu'il a écrit s'efface avec
   * le reste ; sans lui, il recréait `cabinet_profils` derrière l'oubli, et
   * laissait des gestes sans partie au nom d'un profil supprimé. Le verrou
   * n'est pas réentrant : `supprimerProfil` appelle la campagne ensuite, qui
   * le reprend.
   */
  oublierProfil(profileId: string): Promise<void> {
    return this.porte.avecVerrou(profileId, async () => {
      this.oublier(profileId)
      await this.porte.client.batch(lotDeLOubli(profileId), 'write')
      this.oublier(profileId)
      // Ses gardiens à refaire ou à dire partent avec lui : gardés, ils ne servaient plus personne.
      this.aReveiller.delete(profileId)
      this.aAnnoncer.delete(profileId)
    })
  }
}
