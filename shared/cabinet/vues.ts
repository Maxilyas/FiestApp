// Ce que la page du Cabinet reçoit du serveur : la page du musée, une partie,
// le cartel d'une œuvre, les murs, le bouton de l'accueil. Des types, que la
// page lit en `import type` — elle ne juge rien —, et une seule fonction pure,
// les vues dépliées (`vuesDuCabinet`), que le tirage du serveur lit.
//
// La vue du serveur (`core/cabinet/vue.ts`) choisit chaque champ un à un, et
// délègue le corps d'une manche à `montrer` du jeu, sa révélation à `reveler`
// (invariant 1) : un champ neuf du plan n'y part jamais de lui-même — le piège
// `montree` de l'Expédition. Ce qui ne part jamais avant le verdict de sa
// manche, et `cabinet-secret.test.ts` le cherche dans chaque vue : les
// coordonnées, la commune et le département d'un lieu ; l'ordre et l'année
// d'un nouveau venu de la frise, sauf celle qu'Éclairer dévoile ; le mot ; le
// tableau, son titre et l'index du bon ; la valeur du Filet ; la bonne réponse
// du Pari, et sa seconde question avant « Parier » ; le vrai ou faux d'une
// affirmation ; la réponse, les clés et les indices cachés d'une fiche ; le mot
// et « qui » d'une réplique, et si le mot choisi était bon. Jamais les
// rechanges de Changer, jamais la graine, jamais l'œuvre visée d'une case de
// la visite tant qu'elle n'est pas gagnée.
//
// Ces types naissent complets (lot B3) : la chaîne du serveur les remplit,
// celle de la page les lit, sans y toucher. Deux champs s'y sont ajoutés
// depuis, du côté du serveur : l'indice du tirage d'une manche
// (`VueDeLaPartie.tirage`, `RevelationVue.tirage`), sans lequel la page ne
// compose pas l'adresse d'une image du Détail (`adresseDUnCadrage`) ; et ce
// que la partie d'un cartel a fait à son œuvre (`Cartel.partie.issue`) : une
// œuvre achetée puis dorée en jouant ne l'a pas gagnée, et son cartel n'a pas
// à le dire.

import type { CleDeCompagnon } from '../compagnons'
import { PREFIXE_DE_LA_FRISE } from '../frise'
import type { PalierTombe } from '../jour'
import type { CleDeSaison } from '../saisons'
import type { CleDOeuvre, Rarete } from './oeuvres'
import { deplier } from './pieces'
import type { CleDePouvoir, Force } from './pouvoirs'
import type { CleDeSalle } from './salles'
import type { EnjeuDUneCase, OrigineDUneOeuvre } from './musee'
import type { BilanDUnePartie, FinDUneManche, IssueDUnePartie, Manche, OrigineDUnePartie, PhaseDeLaPartie } from './partie'
import type { MancheMontree, RevelationDUneManche } from './jeux/index'
import type { CleDeJeu } from './jeux/regle'

// ── La page du musée — `GET /api/cabinet` ─────────────────────────────────

/** Une œuvre, telle qu'une salle la montre : possédée, sa peinture ; un cadre vide, où la trouver et ce qu'il faut. */
export interface OeuvreVue {
  cle: CleDOeuvre
  nom: string
  rarete: Rarete
  possedee: boolean
  doree: boolean
  /** Comment elle est entrée : son cartel le dit (« Rapportée de l'Expédition ») ; `depart` pour les quatre offertes. */
  origine?: OrigineDUneOeuvre
  /** Le jeu où elle se trouve (« Elle se trouve au Filet »), et s'il est livré (« bientôt » sinon). */
  jeu: CleDeJeu
  bientot?: true
  /** Les étoiles qu'il faut sur neuf, à sa rareté. */
  seuil: number
  /** Ce que coûte de l'acheter, manquante, ou de la dorer, à lui et pas dorée. */
  prix?: number
}

/** Un gardien, réveillé ou non, et par quelle voie : par le Cabinet, ou déjà à lui d'ailleurs — « Le Phénix veillait déjà ». */
export interface GardienVu {
  legendaire: string
  reveille: boolean
  voie?: 'cabinet' | 'ailleurs'
  /** « La salle du Rempart complète », « Tous les cadres du Devin dorés », « 30 jours de visite ou de chasse d'affilée ». */
  condition: string
  pouvoir: CleDePouvoir
}

export interface SalleVue {
  cle: CleDeSalle
  nom: string
  devise: string
  oeuvres: OeuvreVue[]
  complete: boolean
  doree: boolean
  /** Ses deux gardiens : le premier à la salle complète, le second à tous ses cadres dorés. */
  gardiens: [GardienVu, GardienVu]
  /** Une œuvre peinte arrivée dans une salle qu'il avait complète : « Une œuvre nouvelle est arrivée ». Son gardien reste réveillé. */
  nouvelle?: true
}

/** Une case de la visite du jour : son jeu, son enjeu — jamais l'œuvre visée d'une case pas gagnée. */
export interface CaseVue {
  jeu: CleDeJeu
  enJeu: EnjeuDUneCase
  faite: boolean
  issue?: IssueDUnePartie
  /** Gagnée ou dorée : l'œuvre, maintenant qu'elle est à lui. */
  oeuvre?: CleDOeuvre
  bientot?: true
}

export interface VisiteVue {
  jour: string
  cases: CaseVue[]
  /** « Changer de jeu », une fois par jour, une case pas encore jouée : la seule règle des refus le dit. */
  echange: { possible: boolean; refus?: string }
}

/** Ce qu'une fête fait au Cabinet, pendant elle seulement : son nom, et son gardien tant qu'il dort. */
export interface FeteVue {
  cle: CleDeSaison
  nom: string
  /** « Gagne une œuvre, et la Citrouille se réveillera. » */
  gardien?: { legendaire: string; dit: string }
}

export interface PageDuCabinet {
  /** L'heure du serveur : la page mesure son horloge (invariant 6). */
  maintenant: number
  /** La réponse est partie sans `X-Requested-With` — le préchargement (`shared/depart.ts`) : sa mesure ne vaut pas. */
  prechargee?: true
  salles: SalleVue[]
  gardiens: { tous: GardienVu[]; prochain?: { legendaire: string; dit: string } }
  visite: VisiteVue
  /** Ce qui reste aujourd'hui : « elles reviennent à minuit ». */
  chasses: { restent: number; parJour: number }
  libres: { paientEncore: number; parJour: number }
  /** « 12 jours de visite d'affilée. Joue aujourd'hui pour garder ta série. » */
  serie: { jours: number; aJouer: boolean; record: number }
  /** Le solde de poussière d'or. */
  poussiere: number
  /** La partie ouverte, telle que le pli la dit à `maintenant`. */
  enCours: VueDeLaPartie | null
  fete: FeteVue | null
  /** Une expédition l'attend encore : « Ton expédition t'attend : la finir ». */
  expedition: 'en-route' | null
  /** Les œuvres rapportées de l'Expédition, pour l'annonce d'un seul coup. */
  rapportees: number
  /** Les jeux livrés : un cadre vide d'un autre jeu dit « bientôt ». */
  jeux: CleDeJeu[]
}

// ── Une partie — `POST /api/cabinet/partie`, son geste, sa relecture ──────

/** La carte-bonus emportée : son pouvoir, sa force, ce qu'il en reste, ce qu'elle fait à ce jeu. */
export interface CarteVue {
  cle: string
  pouvoir: CleDePouvoir
  force: Force
  /** Les usages qui restent : Éclairer, Changer, la mise ; les deux autres agissent seuls. */
  reste: number
  /** « Éclairer : dévoile l'année d'un nouveau venu — 2 indices par partie ». */
  dit: string
}

/** La révélation d'une manche tranchée : le corps de son jeu, et ce qu'en dit la partie. */
export interface RevelationVue {
  manche: Manche
  /**
   * L'indice, dans le plan figé, du contenu que la manche a joué — après
   * « Changer », une rechange : l'adresse du tableau entier du Détail le porte
   * (`adresseDUnCadrage`), jamais l'indice de la manche à sa place — le cache du
   * téléphone rendrait l'image d'avant. Toujours posé par la vue ; facultatif
   * pour les révélations écrites à la main des épreuves de la page.
   */
  tirage?: number
  fin: FinDUneManche
  /** Les positions de ses pièces que « Signaler une erreur » vise : les seules questions de la base — le Pari, le Mot, le Filet. */
  signalables: number[]
  corps: RevelationDUneManche
}

/** Ce qu'une manche vaut, à présent : ses étoiles après les pouvoirs, et pourquoi elles diffèrent (« +4 : mise gagnée »). */
export interface MancheVue {
  etoiles: number | null
  naturel: number | null
  note?: string
  /** Comment elle s'est tranchée : la révélation d'une manche quittée le dit, même au bon mot. */
  fin?: FinDUneManche
  /**
   * Sa révélation, tranchée : « Mes réponses » d'une partie finie montre la
   * même vue que la partie en cours, chaque manche révélée (le même pli). La
   * partie en cours ne la porte pas ici : seule la manche qu'elle vient de
   * trancher se révèle, dans `VueDeLaPartie.revelation`.
   */
  revelation?: RevelationVue
}

/** Le cartel que garde la partie, en clair : la manche, sa question telle que la partie l'a lue, la réponse, « Le savais-tu ? ». */
export interface CartelDuBilan {
  manche: Manche
  sujet: string
  reponse: string
  anecdote: string | null
}

/** Ce que la fin d'une partie a rapporté : l'écran des gains de la campagne (`CeQueTuGagnes`, `NouveauxTrophees`, `APorter`). */
export interface GainsDuCabinet {
  /** L'expérience de ses bonnes réponses, créditée une fois à la fin. */
  xp: number
  confettis: number
  recompenses?: PalierTombe[]
  /** Les gardiens qu'elle a réveillés, à annoncer en grand ; déjà à lui par une autre voie, aucun. */
  legendaires?: string[]
  /** La luciole, à la première salle complète. */
  compagnon?: CleDeCompagnon
}

/** Le bilan à l'écran : le bilan figé, l'œuvre et son cartel, et ce que la fin a rapporté (la fin seule le sait). */
export interface BilanVu extends Omit<BilanDUnePartie, 'v' | 'cartel'> {
  /** Le cartel de l'œuvre, en clair — le bilan figé n'en garde que la manche (`BilanDUnePartie.cartel`) ; null : aucune manche n'a d'anecdote. */
  cartel: CartelDuBilan | null
  seuil: number | null
  /** « Pas assez d'étoiles cette fois. Il en fallait 6. L'œuvre reste à gagner. » */
  dit: string
  oeuvre?: CleDOeuvre
  /** Une salle complète, un gardien qui veillait déjà : « Salle complète ! Le Phénix veillait déjà sur elle. » */
  gardiens?: { legendaire: string; neuf: boolean }[]
  gains?: GainsDuCabinet
}

export interface VueDeLaPartie {
  id: string
  maintenant: number
  /** Le rang du prochain geste (invariant 12). */
  rang: number
  jeu: CleDeJeu
  origine: OrigineDUnePartie
  /**
   * Ce qui est en jeu, sans nommer l'œuvre visée d'une visite tant qu'elle
   * n'est pas gagnée : la forme même d'une case de la visite (`EnjeuDUneCase`),
   * que la page dessine d'une seule façon ; null en partie libre.
   */
  enJeu: EnjeuDUneCase | null
  seuil: number | null
  carte: CarteVue | null
  manche: Manche
  /**
   * L'indice, dans le plan figé, du contenu de la manche où il en est — la
   * sienne, ou la rechange que « Changer » a prise ; absent avant la première
   * manche. L'adresse d'une image du Détail le porte (`adresseDUnCadrage`) : il
   * ne désigne jamais deux tableaux, et le cache du téléphone ne rend pas
   * l'image d'avant. Rien d'une rechange à venir : seulement combien ont servi.
   */
  tirage?: number
  phase: PhaseDeLaPartie
  manches: MancheVue[]
  /** Sur neuf. */
  total: number
  /** L'échéance de l'étape en cours, à l'heure du serveur ; sous la pause, figée tant qu'il en reste. */
  chrono?: { echeance: number; dureeMs: number; pauseResteMs?: number }
  /** Le pouvoir de la carte-bonus, maintenant : la page grise sans rien recopier. */
  pouvoir?: { jouable: boolean; refus?: string }
  /** La manche qui se joue, sans sa réponse. */
  enCours?: MancheMontree
  revelation?: RevelationVue
  bilan?: BilanVu
}

// ── Ce qu'on apprend ──────────────────────────────────────────────────────

/** Le cartel d'une œuvre : ce que la partie qui l'a fait entrer lui a appris, ou un cartel d'office. */
export interface Cartel {
  oeuvre: CleDOeuvre
  origine: OrigineDUneOeuvre
  /** D'une partie : la manche qu'il garde, relue par le même pli que la partie en cours (invariant 14). */
  partie?: {
    id: string
    jeu: CleDeJeu
    theme?: string
    /** « le 24 octobre 2026 ». */
    jour: string
    /** « 7 sur 9 ». */
    total: number
    /**
     * Ce que cette partie a fait à l'œuvre : la gagner (`gagnee`, `gagnee-doree`),
     * ou, l'œuvre déjà à lui — achetée, rapportée, offerte, ou gagnée par une
     * partie sans rien à raconter —, la dorer ou la doubler (`doree`, `double`).
     * Le serveur le dit toujours ; facultatif pour les cartels écrits à la main
     * des épreuves de la page.
     */
    issue?: IssueDUnePartie
    sujet: string
    reponse: string
    anecdote: string | null
  }
  /** « Rapportée de l'Expédition », « Achetée avec ta poussière d'or… », « Offerte à ton arrivée… », « Entrée dans ton musée le …, gagnée en jouant. ». */
  dit?: string
  doree: boolean
}

/** Tes murs : ce qu'il a appris, d'où qu'il vienne — rien ne s'écrit pour eux. */
export interface MursDuCabinet {
  lieux: { id: string; nom: string; commune: string; departement: string; date: string; annee: number; lat: number; lon: number; vuLe: number }[]
  /** La frise personnelle, du plus ancien au plus récent. */
  dates: { libelle: string; annee: number; de: 'cabinet' | 'expedition'; vuLe: number }[]
}

/** Le gros bouton de l'accueil : « Ton musée : 27 œuvres sur 84 », « À jouer » tant que la visite n'est pas faite. */
export interface CabinetDAccueil {
  oeuvres: number
  sur: number
  aJouer: boolean
}

// ── Les vues dépliées ─────────────────────────────────────────────────────

/**
 * Ce qu'il a vu, déplié pour le Cabinet : un composé de l'Éclair ou d'une
 * frise de sujet vaut une vue de chacune de ses questions, à la même heure —
 * une question vue à l'Éclair ne revient pas au Pari avant sept jours. Une
 * frise de l'Expédition aussi (`frise:<id>+<id>…`, une ligne pour toute la
 * frise) : elle a dit l'année de chacun de ses événements, et sans elle un
 * événement rangé hier là-bas repassait pour frais dans la Frise du Cabinet.
 * Le plus récent l'emporte. La série, elle, lit `vuesDe` tel quel : une
 * question vue dans un composé peut y revenir, sans danger — la série ne
 * reprend pas ce que l'Éclair a récrit.
 */
export function vuesDuCabinet(vues: ReadonlyMap<string, number>): Map<string, number> {
  const depliees = new Map<string, number>()
  for (const [id, le] of vues) {
    const questions = id.startsWith(PREFIXE_DE_LA_FRISE) ? id.slice(PREFIXE_DE_LA_FRISE.length).split('+') : deplier(id)
    for (const q of questions) depliees.set(q, Math.max(le, depliees.get(q) ?? Number.NEGATIVE_INFINITY))
  }
  return depliees
}
