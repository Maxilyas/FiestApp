// Le prototype des rencontres (la proposition « L'Expédition en cartes »,
// validée par le propriétaire le 18 octobre 2026 : « C'est good lance le
// prototype avec tes recos »). Une escale à question n'est plus une question :
// c'est un adversaire à faire tomber, question après question — « une
// question dans les escales semble trop peu ». Chaque question est un tour :
// l'annonce dit ce qui vient, on prépare ses cartes et sa mise sans voir la
// question, puis on la voit, on joue ses réflexes, on répond. Juste, on brise
// ses sceaux ; faux, il frappe, moins la Garde. Le courage remplace les trois
// vies : sans points, la Garde et les combos n'avaient pas de prise.
//
// Ici, ce qui ne dépend que des règles : le catalogue des cartes, leurs refus,
// ce qu'une réponse brise et ce qu'une erreur coûte, l'aperçu du verdict, les
// offres par familles. Le pli (`pliDeLExpedition`, `shared/expedition.ts`) en
// fait l'état d'une expédition de la version 5 ; le serveur seul tire et juge
// (invariant 1) ; la page dessine.
//
// D'abord un prototype, en préproduction seulement ; le jeu partout depuis le
// 19 octobre 2026 (« je pense que l'on part sur ça donc ne plus demander ça,
// c'est vraiment le jeu maintenant », `RENCONTRES_EN_PRODUCTION`). Ses
// chiffres se mesurent au calibrage (`server/scripts/calibrage-rencontres.ts`).

import type { Niveau } from './campagne'
import type { FormeDEscale, ThemeDEscale } from './expedition'
import { EFFACE } from './jokers'
import { hasardDe } from './missions'

/**
 * Les rencontres partent partout, la production comprise, et le départ ne les
 * demande plus : c'est le jeu. Repassé à `false`, la production repartirait
 * aux règles d'avant (la version 4, ses trois vies et ses jokers) — de quoi
 * les refermer d'une ligne si elles cassaient là-bas ; la préproduction,
 * `npm run dev` et les tests les gardent.
 */
export const RENCONTRES_EN_PRODUCTION = true

// ── Les règles chiffrées : des choix de produit (`docs/reference/baremes.md`) ──

/** Le courage, au départ et au plus : ce qui remplace les trois vies. */
export const COURAGE_MAX = 50
/** L'inspiration de chaque question : de quoi jouer deux ou trois cartes. L'écran l'appelle « énergie », le mot de tous les jeux. */
export const INSPIRATION_PAR_QUESTION = 3
/**
 * Depuis le jeu complet (v8), l'énergie suit les actes : deux à l'acte 1,
 * trois ensuite. Trois cartes pour trois d'énergie, presque toutes à 0 ou 1,
 * se jouaient toutes à chaque question — « on joue toutes les cartes à tous
 * les tours car ça coûte pas beaucoup d'énergie et du coup y'a aucune
 * réflexion » (le propriétaire, le 19 octobre 2026). Deux sur trois : on
 * choisit, l'attaque ou le bouclier ; la main qui grandit (`CARTES_DES_ACTES`)
 * garde ensuite une carte de plus que ce qu'on paie.
 */
export const ENERGIE_DES_ACTES: readonly number[] = [2, 3, 3]

/** L'énergie de chaque question, acte par acte, à la version d'un départ — avant le jeu complet, trois partout. */
export const energieDesActes = (v: number): number[] => (v >= VERSION_DU_JEU_COMPLET ? [...ENERGIE_DES_ACTES] : ENERGIE_DES_ACTES.map(() => INSPIRATION_PAR_QUESTION))
/** Les cartes tirées à chaque question (v5) ; ce qu'il n'en joue pas part à la défausse. */
export const CARTES_PAR_QUESTION = 5
/**
 * Depuis la version 6, la main grandit avec les actes : trois cartes à
 * l'acte 1, aux questions faciles, quatre à l'acte 2, cinq à l'acte 3. Cinq
 * d'emblée, on ne savait plus laquelle jouer (« ça fait bcp de bonus en main
 * en même temps, on s'y perd. En tous cas en mettre moins quand c'est le mode
 * facile », la revue du propriétaire du 18 octobre 2026).
 */
export const CARTES_DES_ACTES: readonly number[] = [3, 4, 5]

/** Les cartes que chaque question tire, acte par acte, à la version d'un départ. */
export const cartesDesActes = (v: number): number[] => (v >= 6 ? [...CARTES_DES_ACTES] : CARTES_DES_ACTES.map(() => CARTES_PAR_QUESTION))

/** Celles d'une question de cet acte. */
export const cartesParQuestion = (v: number, acte: number) => cartesDesActes(v)[Math.min(Math.max(0, acte), CARTES_DES_ACTES.length - 1)]
/** Ses écus au départ : de quoi miser dès la première rencontre. */
export const ECUS_AU_DEPART = 25
/** Ce qu'il peut miser avant de voir la question. */
export const MISES: readonly number[] = [0, 10, 20, 40]
/**
 * Juste, une mise rapporte la moitié de ce qu'elle engage ; fausse, elle est
 * perdue entière : elle ne vaut le coup qu'à deux chances sur trois. À un
 * contre un, miser rapportait dès une chance sur deux — toujours, en
 * facile —, et le calibrage finissait l'expédition sur six cents à mille
 * écus : l'échoppe n'était plus un choix.
 */
export const PART_GAGNEE_D_UNE_MISE = 0.5
/** Ce que le Flambeur gagne d'écus sur une bonne réponse (le jeu complet) : Pourboire, Cagnotte, Rafle — à part de son pari. */
export const ECUS_DU_POURBOIRE = 8
export const ECUS_DE_LA_CAGNOTTE = 5
export const ECUS_DE_LA_RAFLE = 10

/** Ce qu'une bonne réponse brise, selon la marche de la question : son savoir. */
export const SAVOIR_DES_MARCHES: Readonly<Record<Niveau, number>> = { facile: 6, moyen: 8, difficile: 11, expert: 14 }
/** La forme multiplie ce que brise une bonne réponse : le hasard fait la moitié d'un vrai ou faux, six choix en demandent plus. */
export const MULTIPLICATEUR_DU_VRAI_OU_FAUX = 0.5
export const MULTIPLICATEUR_DU_SIX_CHOIX = 1.5
/** Au dévoilement, trois fois plus au premier mot, puis il descend, mot à mot, jusqu'à une fois au dernier. */
export const DEVOILEMENT_AU_PREMIER_MOT = 3

/** Une rencontre : un adversaire d'une escale à question, d'une élite, ou le gardien de l'acte. */
export type SorteDeRencontre = 'question' | 'elite' | 'gardien'

/**
 * Les sceaux d'un adversaire, acte par acte : à la marche de chaque acte et
 * avec une Concentration, deux bonnes réponses pour une escale, deux ou trois
 * pour une élite, trois ou quatre pour un gardien — une de plus, souvent,
 * sans elle. À 16, 20, 24 (et 40 à 52 pour un gardien), le joueur moyen
 * n'allait au bout qu'une fois sur quatre, en quarante-cinq questions.
 */
export const SCEAUX_DES_RENCONTRES: Readonly<Record<SorteDeRencontre, readonly number[]>> = {
  question: [12, 16, 20],
  elite: [22, 26, 32],
  gardien: [32, 36, 44],
}
/** Ce qu'il frappe à la première erreur, acte par acte ; puis sa frappe grandit à chaque question : une rencontre qui traîne coûte cher. */
export const FRAPPE_DES_RENCONTRES: Readonly<Record<SorteDeRencontre, readonly number[]>> = {
  question: [5, 6, 7],
  elite: [7, 8, 9],
  gardien: [8, 9, 10],
}
export const FRAPPE_EN_PLUS_PAR_QUESTION = 2

/** Ce que rendent une source retrouvée, un campement, l'échoppe ; ce que prend un piège de l'inconnu. */
export const COURAGE_D_UNE_SOURCE = 12
export const COURAGE_D_UN_CAMPEMENT = 15
export const COURAGE_A_L_ECHOPPE = 15
export const COURAGE_D_UN_PIEGE = 8
/** Renaissance : il renaît avec ce courage — une fois par expédition. */
export const COURAGE_DE_LA_RENAISSANCE = 15
/** L'aube : ce que rend chaque bonne réponse de la rencontre, une fois l'adversaire tombé. */
export const COURAGE_DE_L_AUBE = 3
/** Remonter des abysses : ce qu'il coûte à poser, le courage sous lequel il soigne, et ce qu'il rend à chaque bonne réponse. */
export const COUT_DES_ABYSSES = 6
export const SEUIL_DES_ABYSSES = 20
export const COURAGE_DES_ABYSSES = 4
/** Ce que rendent Panacée — une fois par expédition —, Second souffle — une fois par rencontre — et Pansement, sur une bonne réponse (le jeu complet). */
export const COURAGE_DE_LA_PANACEE = 15
export const COURAGE_DU_SECOND_SOUFFLE = 6
export const COURAGE_DU_PANSEMENT = 4
/** Surmenage (le jeu complet) : ce que l'attaque fait de plus, si l'on se trompe — le prix de ses deux d'énergie. */
export const FRAPPE_DU_SURMENAGE = 6
/** Les boucliers du jeu complet : Caméléon à chaque question changée, Cuirasse à chaque question, Astrolabe à chaque indice joué. */
export const BOUCLIER_DU_CAMELEON = 4
export const BOUCLIER_DE_LA_CUIRASSE = 3
export const BOUCLIER_DE_L_ASTROLABE = 3
/**
 * Les pouvoirs qui frappent de plus (le jeu complet) : l'Encyclopédie, par
 * bonne réponse déjà donnée dans la rencontre ; le Prisme, sur chaque bonne
 * réponse, plus à six choix. Mesurés seuls (`calibrage-rencontres.ts
 * --cartes`), l'Encyclopédie à 2 pour deux d'énergie et le Prisme à six
 * choix seulement retiraient au joueur moyen neuf points chacun : on ne
 * gagnait pas à les prendre.
 */
export const ENCYCLOPEDIE_PAR_JUSTE = 3
export const PRISME_PAR_JUSTE = 2
export const PRISME_A_SIX_CHOIX = 6
/**
 * Représailles : la part de ce que le bouclier pare que l'adversaire perd,
 * arrondie au-dessus. Entière, pour une d'énergie et toute la rencontre, elle
 * menait le joueur moyen au bout 91 fois sur cent contre 56 sans rien prendre :
 * Prudence, la carte de base, devenait une attaque.
 */
export const PART_DES_REPRESAILLES = 0.5

/**
 * Une carte améliorée fait la même chose, en mieux (« Est-ce que l'on
 * pourrait pas aussi avoir un système d'amélioration des cartes ? », le
 * propriétaire, le 19 octobre 2026) : un chiffre plus haut, une d'énergie de
 * moins, une carte tirée de plus, ou elle ne quitte plus la rencontre. Voici
 * ceux de ses chiffres que la règle lit d'une constante — « _PLUS », comme le
 * « + » de son nom (« Panacée+ ») ; les autres s'écrivent dans la règle même,
 * à côté de ceux de sa carte (`chiffresApresLaCarte`, `siJuste`…).
 */
export const ECUS_DU_POURBOIRE_PLUS = 12
export const ECUS_DE_LA_CAGNOTTE_PLUS = 8
export const ECUS_DE_LA_RAFLE_PLUS = 15
export const COURAGE_DE_LA_PANACEE_PLUS = 25
export const COURAGE_DU_SECOND_SOUFFLE_PLUS = 10
export const COURAGE_DU_PANSEMENT_PLUS = 7
export const BOUCLIER_DU_CAMELEON_PLUS = 7
export const BOUCLIER_DE_LA_CUIRASSE_PLUS = 5
export const BOUCLIER_DE_L_ASTROLABE_PLUS = 5
export const ENCYCLOPEDIE_PAR_JUSTE_PLUS = 4
export const PRISME_PAR_JUSTE_PLUS = 3
export const PRISME_A_SIX_CHOIX_PLUS = 9
/**
 * La part des cartes d'une offre qui arrivent améliorées, acte par acte :
 * aucune à l'acte 1, une sur quatre à l'acte 2, une sur deux à l'acte 3 —
 * comme dans Slay the Spire, plus loin on va, mieux on trouve. Tirée sur son
 * propre fil (`graine:amelioree:rang`) : les cartes de l'offre restent celles
 * qu'elle tirait.
 */
export const CHANCE_D_UNE_OFFRE_AMELIOREE: readonly number[] = [0, 0.25, 0.5]

/**
 * Une fiole : ce qui ne sert qu'une fois (la proposition du codex — « un
 * filet aux débutants », qui donne enfin un usage aux écus de l'échoppe).
 * Elle se boit quand on veut, même la question sous les yeux ; elle
 * s'achète à l'échoppe et se trouve dans un coffre, à la place d'une carte ;
 * elle ne vit que l'expédition. Deux places au plus : les garder toutes pour
 * le gardien ne serait plus un choix.
 */
export type CleDeFiole = 'courage' | 'energie' | 'clairvoyance'
export interface Fiole {
  cle: CleDeFiole
  nom: string
  /** Ce qu'elle fait, en minuscule : il suit son nom. */
  effet: string
}
export const FIOLES_MAX = 2
/** Ce que rend la fiole de courage : moins que le courage de l'échoppe, qu'on ne garde pas pour plus tard. */
export const COURAGE_D_UNE_FIOLE = 10
/** Ce que donne la fiole d'énergie, pour la question en cours : de quoi jouer une carte de plus. */
export const ENERGIE_D_UNE_FIOLE = 2
export const FIOLES: readonly Fiole[] = [
  { cle: 'courage', nom: 'Fiole de courage', effet: `+${COURAGE_D_UNE_FIOLE} de courage` },
  { cle: 'energie', nom: 'Fiole d’énergie', effet: `+${ENERGIE_D_UNE_FIOLE} d’énergie pour cette question` },
  { cle: 'clairvoyance', nom: 'Fiole de clairvoyance', effet: 'efface une mauvaise réponse' },
]
export const fioleDe = (cle: string): Fiole | undefined => FIOLES.find(f => f.cle === cle)
/**
 * La fiole de clairvoyance bue sur la question : elle s'y range avec les
 * cartes qui la visent (`TourDeRencontre.surLaQuestion`), sous cette clé —
 * les réponses qu'elle efface se comptent avec les leurs, une autre question
 * (Échange, La mue) repart sans elle, et la réponse est aidée.
 */
export const CLAIRVOYANCE_SUR_LA_QUESTION = 'fiole-clairvoyance'

/** Une offre de cartes : trois, une à prendre ; chaque carte tirée de l'une de ses deux familles, `PART_D_UNE_FAMILLE` chacune, sinon des neutres. */
export const CARTES_PAR_OFFRE = 3
export const PART_D_UNE_FAMILLE = 0.4
/** Les raretés que tire une offre : l'épique depuis le jeu complet (v8). */
export type RareteDOffre = 'commun' | 'rare' | 'epique' | 'maudit'
/**
 * Les raretés d'une offre : après une rencontre, et — rare plus souvent —
 * après une élite, dans un coffre ou à l'échoppe. Une rareté absente ne se
 * tire pas : les poids d'avant le jeu complet n'ont pas d'épique, et une
 * offre d'alors se rejoue telle qu'elle s'est jouée.
 */
export type PoidsDesRaretes = Readonly<Partial<Record<RareteDOffre, number>>>
export const RARETES_D_UNE_RENCONTRE: PoidsDesRaretes = { commun: 0.6, rare: 0.3, maudit: 0.1 }
export const RARETES_D_UNE_ELITE: PoidsDesRaretes = { commun: 0.3, rare: 0.6, maudit: 0.1 }
/**
 * Depuis le jeu complet (v8) : une épique de temps en temps après une
 * rencontre, souvent après une élite — « il n'y a vraiment pas beaucoup de
 * rare / épique dans le jeu » (le 19 octobre 2026). L'acte 1 garde ses
 * communes (`RARETES_DE_L_ACTE_1_DU_JEU_COMPLET`).
 */
export const RARETES_DU_JEU_COMPLET: Readonly<Record<'rencontre' | 'elite', PoidsDesRaretes>> = {
  rencontre: { commun: 0.55, rare: 0.3, epique: 0.07, maudit: 0.08 },
  elite: { commun: 0.25, rare: 0.47, epique: 0.2, maudit: 0.08 },
}
/**
 * Depuis la version 6, les rares attendent : à l'acte 1, une rencontre ne
 * propose que des communes, une élite, un coffre ou l'échoppe des communes et
 * quelques rares, et aucune maudite — « mettre des basiques seulement et
 * obtenir des rares plus tard » (la revue du 18 octobre 2026). Les actes 2 et
 * 3 gardent les poids de la version 5.
 */
export const RARETES_DE_L_ACTE_1: Readonly<Record<'rencontre' | 'elite', PoidsDesRaretes>> = {
  rencontre: { commun: 1, rare: 0, maudit: 0 },
  elite: { commun: 0.6, rare: 0.4, maudit: 0 },
}
/** L'acte 1 du jeu complet (v8) : des communes après une rencontre ; une élite, un coffre, l'échoppe, une rare souvent, une épique parfois. */
export const RARETES_DE_L_ACTE_1_DU_JEU_COMPLET: Readonly<Record<'rencontre' | 'elite', PoidsDesRaretes>> = {
  rencontre: { commun: 1 },
  elite: { commun: 0.55, rare: 0.37, epique: 0.08 },
}

/** Les raretés d'une offre — d'une rencontre, sinon d'une élite, d'un coffre, de l'échoppe —, à cet acte et à la version d'un départ. */
export function raretesDeLOffre(v: number, acte: number, quelle: 'rencontre' | 'elite'): PoidsDesRaretes {
  if (v >= VERSION_DU_JEU_COMPLET) return acte <= 0 ? RARETES_DE_L_ACTE_1_DU_JEU_COMPLET[quelle] : RARETES_DU_JEU_COMPLET[quelle]
  if (v >= 6 && acte <= 0) return RARETES_DE_L_ACTE_1[quelle]
  return quelle === 'rencontre' ? RARETES_D_UNE_RENCONTRE : RARETES_D_UNE_ELITE
}

// ── Les cartes ─────────────────────────────────────────────────────────────

/**
 * Quand une carte se joue : avant de voir la question — c'est un pari —, la
 * question sous les yeux, posée pour toute la rencontre, ou sur la carte,
 * entre deux escales — une fois par acte, jamais tirée en rencontre.
 */
export type MomentDUneCarte = 'preparation' | 'reflexe' | 'pouvoir' | 'route'

/** Les six familles de la proposition, et les neutres : les deux légendaires de l'équipée choisissent les siennes. */
export type FamilleDeCartes = 'erudit' | 'flambeur' | 'metamorphe' | 'elan' | 'rempart' | 'devin' | 'neutre'

export interface CarteDeRencontre {
  /** La clé d'un joker d'avant quand la carte en vient (`renaissance`, `coup-d-oeil`) : un légendaire garde la sienne. */
  cle: string
  nom: string
  /** Ce qu'elle coûte d'inspiration ; une carte de route ne coûte rien. */
  cout: number
  moment: MomentDUneCarte
  famille: FamilleDeCartes
  /**
   * Sa rareté — l'épique depuis le jeu complet (`VERSION_DU_JEU_COMPLET`) :
   * entre la rare et la légendaire, la carte autour de laquelle un paquet se
   * construit. Une maudite est forte et coûte.
   */
  rarete: 'commun' | 'rare' | 'epique' | 'maudit' | 'legendaire'
  /**
   * Une phrase, qui commence par ce qu'elle fait — en mots de tous les jours :
   * « l'adversaire perd », « bouclier », « pari ». « Je veux que ce soit très
   * simple à comprendre […] pour des novices » (le propriétaire, le 18
   * octobre 2026) : « +4 de Charge » ne disait rien à qui découvrait.
   */
  effet: string
  /**
   * Ce qu'elle fait en deux ou trois mots, sur sa face dans la main : on le lit
   * sans la lever. Deux lignes au plus, de neuf signes chacune — la largeur
   * d'une carte sur cinq en 360 pixels.
   */
  resume: string
  /**
   * Son chiffre, sur sa face dans la main — « +4 », « 5 », « ×2 » : ce qu'on
   * compare d'un coup d'œil. Rien quand son dessin suffit. La main ne montre
   * plus de mots : « Y'a trop de détails écrits en dessous de chaque icône,
   * ne pas les mettre direct mais les faire apparaître si on clique dessus »
   * (la revue du propriétaire, le 18 octobre 2026) — touchée, elle se lève et
   * dit tout.
   */
  valeur?: string
  /** Jouée, elle quitte la rencontre ; elle revient à la suivante. */
  epuisement?: true
  /** Un indice : la réponse qu'elle aide ne mesure rien de son savoir (`JOKERS_QUI_AIDENT`). */
  indice?: true
  maudit?: true
  /** Le légendaire qui la donne (`lg:phenix`). */
  legendaire?: string
  /**
   * Ce qu'elle était avant le codex (v5, v6), quand il l'a retouchée : un
   * départ d'avant se rejoue à ses chiffres d'alors (`carteALaVersion`).
   */
  avantLeCodex?: Partial<Pick<CarteDeRencontre, 'cout' | 'effet' | 'resume' | 'valeur'>>
  /**
   * La version du départ qui la connaît : venue avec le jeu complet, elle
   * n'entre jamais dans les offres d'un départ d'avant — rejouées, elles
   * tireraient une autre carte sous les pieds de qui joue.
   */
  depuis?: number
  /** Jouée, elle quitte son paquet : une fois par expédition (Panacée). */
  unique?: true
  /**
   * Ce qu'elle devient améliorée (le jeu complet) — au campement, à
   * l'échoppe, ou trouvée telle dans une offre —, sous sa clé suivie de « + »
   * (`ameliorer`). Absente, elle ne s'améliore pas : une maudite, une carte de
   * route, la carte d'un légendaire.
   */
  amelioration?: Amelioration
  /** C'est un exemplaire amélioré : sa clé et son nom finissent par « + ». */
  amelioree?: true
}

/** Ce que l'amélioration change à une carte, et ce qu'elle y gagne, dit en quelques mots. */
export interface Amelioration {
  /** Ce qu'elle gagne, comparée à sa carte — « +6 au lieu de +4 », « Gratuite » : le campement et l'échoppe le disent avant qu'on choisisse. */
  gain: string
  cout?: number
  effet?: string
  resume?: string
  valeur?: string
  /** Jouée, elle ne quitte plus la rencontre : elle va à la défausse, et revient. */
  durable?: true
}

/**
 * La version du départ qui joue le codex (`shared/codex.ts`) — et ses cartes
 * retouchées, le même soir : prises sans compter, presque toutes celles qu'on
 * gagne faisaient perdre le joueur qui les prenait. Les cartes de base
 * valaient plus — Concentration, Prudence, une d'énergie chacune —, et le
 * joueur moyen qui ne prenait rien allait au bout 37 fois sur cent, 28 s'il
 * prenait tout (`calibrage-rencontres.ts`, le 18 octobre 2026). Débloquer ne
 * doit jamais affaiblir : une carte de famille fait toujours un peu, et plus
 * dans son cas — Plume, Lucidité, Échauffement —, Parade et Troisième œil
 * coûtent une d'énergie, Lancée compte la bonne réponse qu'elle vise, la
 * Bibliothèque frappe sur toutes.
 */
export const VERSION_DU_CODEX = 7

/**
 * La version du départ qui joue le jeu complet (le 19 octobre 2026 : « Il n'y
 * a vraiment pas beaucoup de rare / épique dans le jeu comme carte, cela donne
 * pas beaucoup de diversité. Tu pourrais pas donner un jeu complet ? ») : huit
 * cartes par famille — trois communes, trois rares, deux épiques —, des
 * neutres de plus, la rareté épique dans les offres ; et l'énergie de l'acte 1
 * à deux (`ENERGIE_DES_ACTES` : « on joue toutes les cartes à tous les tours
 * car ça coûte pas beaucoup d'énergie et du coup y'a aucune réflexion »).
 */
export const VERSION_DU_JEU_COMPLET = 8

/** Le paquet de tous, et les neutres que les offres proposent. */
const NEUTRES: readonly CarteDeRencontre[] = [
  { cle: 'concentration', nom: 'Concentration', cout: 1, moment: 'preparation', famille: 'neutre', rarete: 'commun', effet: 'Si tu réponds juste, l’adversaire perd 4 de plus.', resume: '+4 si juste', valeur: '+4' },
  { cle: 'prudence', nom: 'Prudence', cout: 1, moment: 'preparation', famille: 'neutre', rarete: 'commun', effet: 'Bouclier 5 : si tu te trompes, il pare 5 de l’attaque.', resume: 'Bouclier 5', valeur: '5' },
  { cle: 'coup-d-oeil', nom: 'Coup d’œil', cout: 1, moment: 'reflexe', famille: 'neutre', rarete: 'commun', indice: true, effet: 'Efface une mauvaise réponse.', resume: 'Efface 1 réponse' },
  {
    cle: 'echange',
    nom: 'Échange',
    cout: 0,
    moment: 'reflexe',
    famille: 'neutre',
    rarete: 'commun',
    epuisement: true,
    effet: 'Change de question : une autre, posée par le même adversaire.',
    resume: 'Autre question',
  },
  { cle: 'pioche', nom: 'La pioche', cout: 0, moment: 'preparation', famille: 'neutre', rarete: 'commun', epuisement: true, effet: 'Tire deux cartes de plus.', resume: '+2 cartes', valeur: '+2' },
  {
    cle: 'arret-sur-image',
    nom: 'Arrêt sur image',
    cout: 1,
    moment: 'reflexe',
    famille: 'neutre',
    rarete: 'commun',
    effet: 'Sur une question mot à mot : le texte s’arrête cinq secondes, et ton gain avec lui.',
    resume: 'Pause 5 s',
    valeur: '5 s',
  },
  { cle: 'detour', nom: 'Le détour', cout: 0, moment: 'route', famille: 'neutre', rarete: 'commun', effet: 'Ton pas suivant peut aller à n’importe quelle escale de l’étage du dessus.', resume: 'Va où tu veux' },
  // Le jeu complet (v8) : une attaque qu'on joue en voyant la question — la Concentration de qui sait.
  {
    cle: 'evidence',
    nom: 'Évidence',
    cout: 1,
    moment: 'reflexe',
    famille: 'neutre',
    rarete: 'commun',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Une fois la question vue : si tu réponds juste, l’adversaire perd 4 de plus.',
    resume: '+4 si juste',
    valeur: '+4',
  },
  {
    cle: 'double-chance',
    nom: 'Double chance',
    // Une d'énergie depuis le jeu complet : à deux, elle prenait toute la question de l'acte 1, et retirait six points au joueur moyen qui la prenait.
    cout: 1,
    moment: 'reflexe',
    famille: 'neutre',
    rarete: 'rare',
    indice: true,
    epuisement: true,
    effet: 'Choisis deux réponses : il suffit que l’une soit juste.',
    resume: '2 réponses',
  },
  { cle: 'sursis', nom: 'Sursis', cout: 2, moment: 'preparation', famille: 'neutre', rarete: 'rare', epuisement: true, effet: 'Si tu te trompes, l’adversaire ne t’attaque pas.', resume: 'Erreur gratuite' },
  {
    cle: 'meditation',
    nom: 'Méditation',
    cout: 0,
    moment: 'preparation',
    famille: 'neutre',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    epuisement: true,
    effet: '+1 d’énergie pour cette question, et tu tires une carte de plus.',
    resume: 'Énergie et carte',
    valeur: '+1',
  },
  {
    cle: 'sang-froid',
    nom: 'Sang-froid',
    cout: 1,
    moment: 'reflexe',
    famille: 'neutre',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Une fois la question vue : bouclier 4 — et si tu réponds juste, l’adversaire perd 4 de plus.',
    resume: 'Bouclier 4 et +4',
    valeur: '4',
  },
  {
    cle: 'panacee',
    nom: 'Panacée',
    cout: 1,
    moment: 'preparation',
    famille: 'neutre',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    epuisement: true,
    unique: true,
    effet: `Tu reprends ${COURAGE_DE_LA_PANACEE} de courage. Jouée, elle quitte ton paquet.`,
    resume: `+${COURAGE_DE_LA_PANACEE} courage`,
    valeur: `+${COURAGE_DE_LA_PANACEE}`,
  },
  {
    cle: 'maitrise',
    nom: 'Maîtrise',
    cout: 2,
    moment: 'pouvoir',
    famille: 'neutre',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Pour toute la rencontre : +1 d’énergie à chaque question, celle-ci comprise.',
    resume: '+1 énergie',
    valeur: '+1',
  },
  {
    cle: 'tout-ou-rien',
    nom: 'Tout ou rien',
    cout: 0,
    moment: 'reflexe',
    famille: 'neutre',
    rarete: 'maudit',
    maudit: true,
    indice: true,
    effet: 'Efface deux mauvaises réponses. Mais si tu te trompes quand même, son attaque double.',
    resume: 'Efface 2, risqué',
  },
  {
    cle: 'quitte-ou-double',
    nom: 'Quitte ou double',
    cout: 0,
    moment: 'preparation',
    famille: 'neutre',
    rarete: 'maudit',
    maudit: true,
    effet: 'Si tu as juste, l’adversaire perd le double et ton pari rapporte triple. Si tu te trompes, son attaque double.',
    resume: 'Tout ×2',
    valeur: '×2',
  },
  {
    cle: 'surmenage',
    nom: 'Surmenage',
    cout: 0,
    moment: 'preparation',
    famille: 'neutre',
    rarete: 'maudit',
    maudit: true,
    depuis: VERSION_DU_JEU_COMPLET,
    effet: `+2 d’énergie pour cette question, et tu tires une carte. Mais si tu te trompes, son attaque fait ${FRAPPE_DU_SURMENAGE} de plus.`,
    resume: 'Énergie, risqué',
    valeur: '+2',
  },
]

/**
 * Deux cartes par famille, pour le prototype (« Le paquet de départ et douze
 * cartes, deux par famille ») : de quoi sentir chaque façon de gagner avant
 * d'écrire les autres.
 */
const DES_FAMILLES: readonly CarteDeRencontre[] = [
  {
    cle: 'plume',
    nom: 'Plume',
    cout: 0,
    moment: 'preparation',
    famille: 'erudit',
    rarete: 'commun',
    effet: 'Si tu réponds juste, l’adversaire perd 2 de plus — 6 si la question est de ta catégorie fétiche.',
    resume: '+2, +6 fétiche',
    valeur: '+2',
    avantLeCodex: { effet: 'Si la question est de ta catégorie fétiche et que tu réponds juste, l’adversaire perd 5 de plus.', resume: '+5 si fétiche', valeur: '+5' },
  },
  {
    cle: 'savoir-faire',
    nom: 'Savoir-faire',
    cout: 1,
    moment: 'preparation',
    famille: 'erudit',
    rarete: 'commun',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Si tu réponds juste, l’adversaire perd 4 de plus — 7 si la question n’est pas facile.',
    resume: '+4 ou +7',
    valeur: '+4',
  },
  {
    cle: 'memoire',
    nom: 'Mémoire',
    cout: 1,
    moment: 'reflexe',
    famille: 'erudit',
    rarete: 'commun',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Une fois la question vue : si tu réponds juste, l’adversaire perd 3 de plus, et tu tires une carte de plus à la question suivante.',
    resume: '+3, +1 carte',
    valeur: '+3',
  },
  {
    cle: 'bibliotheque',
    nom: 'Bibliothèque',
    cout: 1,
    moment: 'pouvoir',
    famille: 'erudit',
    rarete: 'rare',
    effet: 'Pour toute la rencontre : tes bonnes réponses lui font perdre 1 de plus — 3 celles de ta catégorie fétiche.',
    resume: '+1, +3 fétiche',
    valeur: '+1',
    avantLeCodex: { effet: 'Pour toute la rencontre : tes bonnes réponses de ta catégorie fétiche lui font perdre 3 de plus.', resume: 'Fétiche +3', valeur: '+3' },
  },
  {
    cle: 'lecon',
    nom: 'Leçon',
    cout: 1,
    moment: 'preparation',
    famille: 'erudit',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Si tu réponds juste, l’adversaire perd 4 de plus — et 4 de plus encore à la question suivante.',
    resume: '+4, deux fois',
    valeur: '+4',
  },
  {
    cle: 'expose',
    nom: 'Exposé',
    cout: 1,
    moment: 'preparation',
    famille: 'erudit',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: `Si tu réponds juste, l’adversaire perd une fois de plus ce que vaut la question : ${SAVOIR_DES_MARCHES.facile} en facile, ${SAVOIR_DES_MARCHES.moyen} en moyenne, ${SAVOIR_DES_MARCHES.difficile} en difficile.`,
    resume: 'Valeur ×2',
    valeur: '×2',
  },
  {
    cle: 'encyclopedie',
    nom: 'Encyclopédie',
    cout: 1,
    moment: 'pouvoir',
    famille: 'erudit',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: `Pour toute la rencontre : chaque bonne réponse lui fait perdre ${ENCYCLOPEDIE_PAR_JUSTE} de plus par bonne réponse déjà donnée dans la rencontre.`,
    resume: `+${ENCYCLOPEDIE_PAR_JUSTE} par juste`,
    valeur: `+${ENCYCLOPEDIE_PAR_JUSTE}`,
  },
  {
    cle: 'genie',
    nom: 'Génie',
    cout: 1,
    moment: 'preparation',
    famille: 'erudit',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Si tu réponds juste, l’adversaire perd 8 de plus — 14 si la question est de ta catégorie fétiche.',
    resume: '+8, +14 fétiche',
    valeur: '+8',
  },
  { cle: 'doubler-la-mise', nom: 'Doubler la mise', cout: 0, moment: 'preparation', famille: 'flambeur', rarete: 'commun', effet: 'Ton pari compte double, gain comme perte.', resume: 'Pari ×2', valeur: '×2' },
  {
    cle: 'pourboire',
    nom: 'Pourboire',
    cout: 0,
    moment: 'preparation',
    famille: 'flambeur',
    rarete: 'commun',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: `Si tu réponds juste, tu gagnes ${ECUS_DU_POURBOIRE} écus. Et tu tires une carte.`,
    resume: `+${ECUS_DU_POURBOIRE} écus +1 carte`,
  },
  {
    cle: 'cagnotte',
    nom: 'Cagnotte',
    cout: 1,
    moment: 'preparation',
    famille: 'flambeur',
    rarete: 'commun',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: `Si tu réponds juste, l’adversaire perd 4 de plus et tu gagnes ${ECUS_DE_LA_CAGNOTTE} écus.`,
    resume: `+4 et ${ECUS_DE_LA_CAGNOTTE} écus`,
    valeur: '+4',
  },
  {
    cle: 'banco',
    nom: 'Banco',
    cout: 1,
    moment: 'preparation',
    famille: 'flambeur',
    rarete: 'rare',
    effet: 'Si tu as juste, ton pari frappe aussi : l’adversaire perd 1 de plus par tranche de cinq écus pariés.',
    resume: 'Le pari frappe',
  },
  {
    cle: 'assurance',
    nom: 'Assurance',
    cout: 0,
    moment: 'preparation',
    famille: 'flambeur',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Si tu te trompes, ton pari t’est rendu. Et tu tires une carte.',
    resume: 'Assuré, +1 carte',
  },
  {
    cle: 'fortune',
    nom: 'Fortune',
    cout: 1,
    moment: 'preparation',
    famille: 'flambeur',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Si tu réponds juste, l’adversaire perd 1 de plus par tranche de dix écus que tu as.',
    resume: '+1 par 10 écus',
  },
  {
    cle: 'pactole',
    nom: 'Pactole',
    cout: 1,
    moment: 'pouvoir',
    famille: 'flambeur',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Pour toute la rencontre : quand ton pari gagne, l’adversaire perd aussi autant qu’il te rapporte.',
    resume: 'Le gain frappe',
  },
  {
    cle: 'rafle',
    nom: 'Rafle',
    cout: 2,
    moment: 'preparation',
    famille: 'flambeur',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: `Si tu réponds juste, l’adversaire perd 14 de plus et tu gagnes ${ECUS_DE_LA_RAFLE} écus.`,
    resume: `+14 et ${ECUS_DE_LA_RAFLE} écus`,
    valeur: '+14',
  },
  {
    cle: 'corser',
    nom: 'Corser',
    cout: 1,
    moment: 'preparation',
    famille: 'metamorphe',
    rarete: 'commun',
    effet: 'La question passe à six choix : plus dure, mais l’adversaire perd une fois et demie plus.',
    resume: '6 choix ×1,5',
    valeur: '×1,5',
  },
  {
    cle: 'simplifier',
    nom: 'Simplifier',
    cout: 0,
    moment: 'preparation',
    famille: 'metamorphe',
    rarete: 'commun',
    effet: 'La question passe en vrai ou faux : plus facile, mais l’adversaire perd moitié moins. Et bouclier 3.',
    resume: 'Vrai ou faux',
  },
  {
    cle: 'volte-face',
    nom: 'Volte-face',
    cout: 1,
    moment: 'reflexe',
    famille: 'metamorphe',
    rarete: 'commun',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Change de question : une autre, posée par le même adversaire — et si tu as juste, il perd 3 de plus.',
    resume: 'Change et +3',
    valeur: '+3',
  },
  {
    cle: 'prisme',
    nom: 'Prisme',
    cout: 1,
    moment: 'pouvoir',
    famille: 'metamorphe',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: `Pour toute la rencontre : tes bonnes réponses lui font perdre ${PRISME_PAR_JUSTE} de plus — ${PRISME_A_SIX_CHOIX} à six choix.`,
    resume: `+${PRISME_PAR_JUSTE}, +${PRISME_A_SIX_CHOIX} à six`,
    valeur: `+${PRISME_PAR_JUSTE}`,
  },
  {
    cle: 'miroir',
    nom: 'Miroir',
    cout: 1,
    moment: 'preparation',
    famille: 'metamorphe',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'La question passe en vrai ou faux, sans rien y perdre : l’adversaire perd autant qu’à quatre choix.',
    resume: 'Vrai ou faux, ×1',
  },
  {
    cle: 'cameleon',
    nom: 'Caméléon',
    cout: 1,
    moment: 'pouvoir',
    famille: 'metamorphe',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: `Pour toute la rencontre : chaque fois que tu changes la question, ou sa forme, bouclier ${BOUCLIER_DU_CAMELEON}.`,
    resume: 'Bouclier si change',
    valeur: `${BOUCLIER_DU_CAMELEON}`,
  },
  {
    cle: 'metamorphose',
    nom: 'Métamorphose',
    cout: 1,
    moment: 'pouvoir',
    famille: 'metamorphe',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Pour toute la rencontre : un vrai ou faux lui fait perdre autant qu’une question à quatre choix, et six choix le double.',
    resume: 'Formes gagnantes',
  },
  {
    cle: 'polymorphe',
    nom: 'Polymorphe',
    cout: 0,
    moment: 'preparation',
    famille: 'metamorphe',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'La question passe à six choix, et l’adversaire perd le double, pas une fois et demie.',
    resume: '6 choix ×2',
    valeur: '×2',
  },
  {
    cle: 'echauffement',
    nom: 'Échauffement',
    cout: 0,
    moment: 'preparation',
    famille: 'elan',
    rarete: 'commun',
    effet: 'Si tu réponds juste, l’adversaire perd 2 de plus. Et ta série compte une bonne réponse de plus.',
    resume: '+2, série +1',
    valeur: '+2',
    avantLeCodex: { effet: 'Ajoute 1 à ta série de bonnes réponses d’affilée.', resume: 'Série +1', valeur: '+1' },
  },
  {
    cle: 'lancee',
    nom: 'Lancée',
    cout: 1,
    moment: 'preparation',
    famille: 'elan',
    rarete: 'commun',
    effet: 'Si tu réponds juste, l’adversaire perd 2 de plus par bonne réponse de ta série, celle-ci comprise.',
    avantLeCodex: { effet: 'Si tu réponds juste, l’adversaire perd 2 de plus par bonne réponse de ta série.' },
    resume: '+2 par série',
    valeur: '+2',
  },
  {
    cle: 'foulee',
    nom: 'Foulée',
    cout: 0,
    moment: 'preparation',
    famille: 'elan',
    rarete: 'commun',
    depuis: VERSION_DU_JEU_COMPLET,
    epuisement: true,
    effet: '+1 d’énergie pour cette question.',
    resume: '+1 énergie',
    valeur: '+1',
  },
  {
    cle: 'acceleration',
    nom: 'Accélération',
    cout: 0,
    moment: 'preparation',
    famille: 'elan',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Si tu réponds juste, la question suivante te donne 1 d’énergie et une carte de plus.',
    resume: 'Énergie après',
  },
  {
    cle: 'rythme',
    nom: 'Rythme',
    cout: 1,
    moment: 'pouvoir',
    famille: 'elan',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Pour toute la rencontre : chaque bonne réponse lui fait perdre 1 de plus par bonne réponse de ta série, celle-ci comprise.',
    resume: '+1 par série',
    valeur: '+1',
  },
  {
    cle: 'sprint',
    nom: 'Sprint',
    cout: 0,
    moment: 'preparation',
    famille: 'elan',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    epuisement: true,
    effet: 'Tu tires deux cartes, et +1 d’énergie pour cette question.',
    resume: 'Cartes et énergie',
    valeur: '+2',
  },
  {
    cle: 'vent-arriere',
    nom: 'Vent arrière',
    cout: 1,
    moment: 'pouvoir',
    famille: 'elan',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Pour toute la rencontre : après chaque bonne réponse, la question suivante te donne 1 d’énergie de plus.',
    resume: 'Énergie si juste',
    valeur: '+1',
  },
  {
    cle: 'inarretable',
    nom: 'Inarrêtable',
    cout: 1,
    moment: 'pouvoir',
    famille: 'elan',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Ta série compte une bonne réponse de plus. Et pour toute la rencontre, une erreur ne la fait plus retomber.',
    resume: 'Série tenue',
  },
  {
    cle: 'parade',
    nom: 'Parade',
    cout: 1,
    moment: 'reflexe',
    famille: 'rempart',
    rarete: 'commun',
    effet: 'Bouclier 6, une fois la question vue : si tu te trompes, il pare 6 de l’attaque.',
    resume: 'Bouclier 6',
    valeur: '6',
    avantLeCodex: { cout: 2 },
  },
  {
    cle: 'muraille',
    nom: 'Muraille',
    cout: 2,
    moment: 'preparation',
    famille: 'rempart',
    rarete: 'commun',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Bouclier 12 : si tu te trompes, il pare 12 de l’attaque.',
    resume: 'Bouclier 12',
    valeur: '12',
  },
  {
    cle: 'pansement',
    nom: 'Pansement',
    cout: 0,
    moment: 'preparation',
    famille: 'rempart',
    rarete: 'commun',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: `Si tu réponds juste, tu reprends ${COURAGE_DU_PANSEMENT} de courage.`,
    resume: `Soin ${COURAGE_DU_PANSEMENT} si juste`,
    valeur: `+${COURAGE_DU_PANSEMENT}`,
  },
  {
    cle: 'contre-attaque',
    nom: 'Contre-attaque',
    cout: 1,
    moment: 'preparation',
    famille: 'rempart',
    rarete: 'rare',
    effet: 'Si tu te trompes, ton bouclier riposte : l’adversaire perd ce qu’il a paré.',
    resume: 'Riposte',
  },
  {
    cle: 'cuirasse',
    nom: 'Cuirasse',
    cout: 1,
    moment: 'pouvoir',
    famille: 'rempart',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: `Pour toute la rencontre : bouclier ${BOUCLIER_DE_LA_CUIRASSE} à chaque question, celle-ci comprise.`,
    resume: 'Bouclier permanent',
    valeur: `${BOUCLIER_DE_LA_CUIRASSE}`,
  },
  {
    cle: 'second-souffle',
    nom: 'Second souffle',
    cout: 1,
    moment: 'preparation',
    famille: 'rempart',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    epuisement: true,
    effet: `Tu reprends ${COURAGE_DU_SECOND_SOUFFLE} de courage.`,
    resume: `+${COURAGE_DU_SECOND_SOUFFLE} courage`,
    valeur: `+${COURAGE_DU_SECOND_SOUFFLE}`,
  },
  {
    cle: 'bastion',
    nom: 'Bastion',
    cout: 2,
    moment: 'pouvoir',
    famille: 'rempart',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Pour toute la rencontre : ton bouclier ne tombe plus après une question — il ne s’use que de ce qu’il pare.',
    resume: 'Bouclier qui reste',
  },
  {
    cle: 'represailles',
    nom: 'Représailles',
    cout: 2,
    moment: 'pouvoir',
    famille: 'rempart',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: 'Pour toute la rencontre : ce que ton bouclier pare, l’adversaire en perd la moitié.',
    resume: 'Riposte, moitié',
  },
  {
    cle: 'lucidite',
    nom: 'Lucidité',
    cout: 0,
    moment: 'reflexe',
    famille: 'devin',
    rarete: 'commun',
    effet: 'Si tu réponds juste, l’adversaire perd 2 de plus — 5 si une réponse est effacée.',
    resume: '+2, +5 effacée',
    valeur: '+2',
    avantLeCodex: { cout: 1, effet: 'Si une réponse est effacée et que tu réponds juste, l’adversaire perd 5 de plus.', resume: '+5 si effacée', valeur: '+5' },
  },
  {
    cle: 'augure',
    nom: 'Augure',
    cout: 0,
    moment: 'preparation',
    famille: 'devin',
    rarete: 'commun',
    depuis: VERSION_DU_JEU_COMPLET,
    indice: true,
    epuisement: true,
    effet: 'Une mauvaise réponse s’effacera de la question, avant même que tu la voies.',
    resume: 'Efface 1 d’avance',
  },
  {
    cle: 'presage',
    nom: 'Présage',
    cout: 1,
    moment: 'reflexe',
    famille: 'devin',
    rarete: 'commun',
    depuis: VERSION_DU_JEU_COMPLET,
    indice: true,
    effet: 'Efface une mauvaise réponse, et tu tires une carte.',
    resume: 'Efface 1, +1 carte',
  },
  {
    cle: 'troisieme-oeil',
    nom: 'Troisième œil',
    avantLeCodex: { cout: 2 },
    cout: 1,
    moment: 'pouvoir',
    famille: 'devin',
    rarete: 'rare',
    effet: 'Pour toute la rencontre : chaque indice que tu joues lui fait perdre 3 de plus, si tu réponds juste.',
    resume: 'Indices +3',
    valeur: '+3',
  },
  {
    cle: 'voyance',
    nom: 'Voyance',
    cout: 1,
    moment: 'reflexe',
    famille: 'devin',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    indice: true,
    effet: 'Efface deux mauvaises réponses.',
    resume: 'Efface 2',
  },
  {
    cle: 'astrolabe',
    nom: 'Astrolabe',
    cout: 1,
    moment: 'pouvoir',
    famille: 'devin',
    rarete: 'rare',
    depuis: VERSION_DU_JEU_COMPLET,
    effet: `Pour toute la rencontre : chaque indice que tu joues te donne bouclier ${BOUCLIER_DE_L_ASTROLABE}.`,
    resume: 'Indices : bouclier',
    valeur: `${BOUCLIER_DE_L_ASTROLABE}`,
  },
  {
    cle: 'vision',
    nom: 'Vision',
    cout: 2,
    moment: 'pouvoir',
    famille: 'devin',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    indice: true,
    effet: 'Pour toute la rencontre : une mauvaise réponse s’efface à chaque question.',
    resume: 'Efface 1, toujours',
  },
  {
    cle: 'revelation',
    nom: 'Révélation',
    cout: 1,
    moment: 'reflexe',
    famille: 'devin',
    rarete: 'epique',
    depuis: VERSION_DU_JEU_COMPLET,
    indice: true,
    epuisement: true,
    effet: 'Il ne reste que deux réponses : la bonne et une autre. Et si tu as juste, l’adversaire perd 4 de plus.',
    resume: 'Reste 2, +4',
    valeur: '+4',
  },
]

/**
 * Les cartes des légendaires : les vingt-trois jokers d'avant, réécrits pour
 * la rencontre. Leur clé reste celle de leur joker — `jokerDuLegendaire` les
 * trouve —, leur famille vient de la proposition : c'est elle que l'équipée
 * apporte aux offres.
 */
const DES_LEGENDAIRES: readonly CarteDeRencontre[] = [
  {
    cle: 'renaissance',
    nom: 'Renaissance',
    legendaire: 'lg:phenix',
    cout: 1,
    moment: 'pouvoir',
    famille: 'rempart',
    rarete: 'legendaire',
    effet: 'Pour toute la rencontre : si ton courage tombe à zéro, tu renais avec 15. Une fois par expédition.',
    resume: 'Renaître',
  },
  {
    cle: 'peau-de-feu',
    nom: 'Peau de feu',
    legendaire: 'lg:salamandre',
    cout: 1,
    moment: 'preparation',
    famille: 'rempart',
    rarete: 'legendaire',
    effet: 'Bouclier 8. S’il pare toute l’attaque, ta bonne réponse suivante lui fera perdre 4 de plus.',
    resume: 'Bouclier 8',
    valeur: '8',
  },
  {
    cle: 'aube',
    nom: 'L’aube',
    legendaire: 'lg:scarabee',
    cout: 1,
    moment: 'pouvoir',
    famille: 'rempart',
    rarete: 'legendaire',
    effet: 'Quand l’adversaire tombe, tu reprends 3 de courage par bonne réponse de la rencontre.',
    resume: 'Soin à la fin',
    valeur: '+3',
  },
  {
    cle: 'reveil',
    nom: 'Le réveil',
    legendaire: 'lg:coq',
    cout: 0,
    moment: 'preparation',
    famille: 'elan',
    rarete: 'legendaire',
    epuisement: true,
    effet: '+2 d’énergie pour cette question.',
    resume: '+2 énergie',
    valeur: '+2',
  },
  {
    cle: 'boucle',
    nom: 'La boucle',
    legendaire: 'lg:ouroboros',
    cout: 1,
    moment: 'pouvoir',
    famille: 'rempart',
    rarete: 'legendaire',
    effet: 'Pour toute la rencontre : ta prochaine erreur revient à la question suivante ; retrouvée, elle te rend son courage.',
    resume: 'Seconde chance',
  },
  { cle: 'sagesse', nom: 'Sagesse', legendaire: 'lg:chouette', cout: 1, moment: 'reflexe', famille: 'erudit', rarete: 'legendaire', indice: true, effet: 'Efface deux mauvaises réponses.', resume: 'Efface 2 réponses' },
  {
    cle: 'enigme',
    nom: 'Énigme',
    legendaire: 'lg:sphinx',
    cout: 1,
    moment: 'reflexe',
    famille: 'devin',
    rarete: 'legendaire',
    indice: true,
    effet: 'Le Sphinx te souffle quand et de quoi parle la question. Elle ne se date pas ? Il efface une mauvaise réponse.',
    resume: 'Un indice',
  },
  {
    cle: 'prediction',
    nom: 'Prédiction',
    legendaire: 'lg:oracle',
    cout: 1,
    moment: 'reflexe',
    famille: 'devin',
    rarete: 'legendaire',
    indice: true,
    effet: 'Sur une année ou un nombre : montre une réponse, l’Oracle dit « plus haut » ou « plus bas ».',
    resume: 'Plus ou moins',
  },
  {
    cle: 'deux-visages',
    nom: 'Deux visages',
    legendaire: 'lg:janus',
    cout: 1,
    moment: 'reflexe',
    famille: 'metamorphe',
    rarete: 'legendaire',
    indice: true,
    effet: 'Une seconde question s’affiche : tu réponds à celle que tu veux.',
    resume: 'Question au choix',
  },
  {
    cle: 'mue',
    nom: 'La mue',
    legendaire: 'lg:serpent',
    cout: 1,
    moment: 'reflexe',
    famille: 'metamorphe',
    rarete: 'legendaire',
    epuisement: true,
    effet: 'Change de question : une autre, du même adversaire. Si tu te trompes à la nouvelle, elle ne te coûte rien.',
    resume: 'Autre question',
  },
  {
    cle: 'commandement',
    nom: 'Commandement',
    legendaire: 'lg:lion',
    cout: 0,
    moment: 'route',
    famille: 'erudit',
    rarete: 'legendaire',
    effet: 'Tu choisis la catégorie de l’escale suivante : toute sa rencontre la pose.',
    resume: 'Thème au choix',
  },
  {
    cle: 'elan',
    nom: 'L’élan',
    legendaire: 'lg:tigre',
    cout: 1,
    moment: 'pouvoir',
    famille: 'elan',
    rarete: 'legendaire',
    effet: 'Pour toute la rencontre : toutes les trois bonnes réponses d’affilée, deux cartes et 1 d’énergie de plus à la question suivante.',
    resume: 'Série = cartes',
  },
  {
    cle: 'trois-tetes',
    nom: 'Trois têtes',
    legendaire: 'lg:chimere',
    cout: 2,
    moment: 'pouvoir',
    famille: 'metamorphe',
    rarete: 'legendaire',
    effet: 'Pour toute la rencontre : tu tires deux cartes de plus à chaque question.',
    resume: '+2 cartes',
    valeur: '+2',
  },
  { cle: 'raccourci', nom: 'Le raccourci', legendaire: 'lg:comete', cout: 0, moment: 'route', famille: 'elan', rarete: 'legendaire', effet: 'Tu sautes une escale.', resume: 'Saute 1 escale' },
  {
    cle: 'maison',
    nom: 'Il connaît la maison',
    legendaire: 'lg:renard',
    cout: 0,
    moment: 'route',
    famille: 'flambeur',
    rarete: 'legendaire',
    effet: 'Une source ou un coffre s’ouvre à l’étage du dessus, relié à toi.',
    resume: 'Coffre ou source',
  },
  { cle: 'tresor', nom: 'Le trésor', legendaire: 'lg:dragon', cout: 1, moment: 'pouvoir', famille: 'flambeur', rarete: 'legendaire', effet: 'Pour toute la rencontre : tes paris gagnés rapportent triple.', resume: 'Pari gagné ×3', valeur: '×3' },
  {
    cle: 'feu-d-artifice',
    nom: 'Le feu d’artifice',
    legendaire: 'lg:bouquet',
    cout: 1,
    moment: 'preparation',
    famille: 'elan',
    rarete: 'legendaire',
    epuisement: true,
    effet: 'Ta défausse revient dans ta pioche, et tu tires trois cartes.',
    resume: '+3 cartes',
    valeur: '+3',
  },
  {
    cle: 'lanterne',
    nom: 'La lanterne',
    legendaire: 'lg:citrouille',
    cout: 0,
    moment: 'route',
    famille: 'devin',
    rarete: 'legendaire',
    effet: 'Les pièges de l’inconnu se montrent sur le plan, jusqu’au bout de l’acte.',
    resume: 'Voir les pièges',
  },
  {
    cle: 'boule',
    nom: 'Une boule pour chacun',
    legendaire: 'lg:sapin',
    cout: 0,
    moment: 'route',
    famille: 'flambeur',
    rarete: 'legendaire',
    effet: 'Un coffre de plus s’ouvre à l’étage du dessus, relié à toi.',
    resume: '+1 coffre',
    valeur: '+1',
  },
  {
    cle: 'abysses',
    nom: 'Remonter des abysses',
    legendaire: 'lg:kraken',
    cout: 0,
    moment: 'pouvoir',
    famille: 'rempart',
    rarete: 'legendaire',
    maudit: true,
    effet: 'La poser coûte 6 de courage. Pour toute la rencontre, sous 20 de courage, chaque bonne réponse t’en rend 4.',
    resume: 'Soin si bas',
    valeur: '+4',
  },
  {
    cle: 'passe-muraille',
    nom: 'Passe-muraille',
    legendaire: 'lg:fantome',
    cout: 0,
    moment: 'reflexe',
    famille: 'devin',
    rarete: 'legendaire',
    maudit: true,
    indice: true,
    epuisement: true,
    effet: 'Tu passes la question : ni toi ni l’adversaire ne perdez rien. Elle part à ton carnet.',
    resume: 'Passer',
  },
  {
    cle: 'horizon',
    nom: 'L’horizon',
    legendaire: 'lg:trou-noir',
    cout: 0,
    moment: 'preparation',
    famille: 'flambeur',
    rarete: 'legendaire',
    maudit: true,
    epuisement: true,
    effet: 'Juste après une erreur : le courage qu’elle t’a coûté te revient — mais ta prochaine récompense est vide.',
    resume: 'Courage rendu',
  },
  {
    cle: 'echolocation',
    nom: 'L’écholocation',
    legendaire: 'lg:chauve-souris',
    cout: 1,
    moment: 'pouvoir',
    famille: 'devin',
    rarete: 'legendaire',
    maudit: true,
    indice: true,
    effet: 'Pour toute la rencontre : une mauvaise réponse s’efface à chaque question — mais tu ne vois plus tes chances.',
    resume: 'Efface 1, toujours',
  },
]

/**
 * Ce que l'amélioration fait de chaque carte qui en a une (le jeu complet), à
 * la manière de Slay the Spire : un chiffre plus haut — de la moitié environ —,
 * une d'énergie de moins, une carte tirée de plus, ou elle ne quitte plus la
 * rencontre. Ni les maudites, ni la carte de route, ni celles des légendaires :
 * une malédiction ne s'arrange pas, et un légendaire est déjà au sommet. Ce
 * que dit son texte, la règle le fait (`chiffresApresLaCarte`, `siJuste`… ;
 * `expedition-ameliorations.test.ts` lève et joue chacune).
 */
const AMELIORATIONS: Readonly<Record<string, Amelioration>> = {
  // Les neutres.
  concentration: { gain: '+6 au lieu de +4', effet: 'Si tu réponds juste, l’adversaire perd 6 de plus.', resume: '+6 si juste', valeur: '+6' },
  prudence: { gain: 'Bouclier 8 au lieu de 5', effet: 'Bouclier 8 : si tu te trompes, il pare 8 de l’attaque.', resume: 'Bouclier 8', valeur: '8' },
  'coup-d-oeil': { gain: 'Gratuite', cout: 0 },
  echange: { gain: 'Plus seulement une fois par rencontre', durable: true },
  pioche: { gain: 'Trois cartes au lieu de deux', effet: 'Tire trois cartes de plus.', resume: '+3 cartes', valeur: '+3' },
  'arret-sur-image': { gain: 'Gratuite', cout: 0 },
  evidence: { gain: '+6 au lieu de +4', effet: 'Une fois la question vue : si tu réponds juste, l’adversaire perd 6 de plus.', resume: '+6 si juste', valeur: '+6' },
  'double-chance': { gain: 'Gratuite', cout: 0 },
  sursis: { gain: '1 d’énergie au lieu de 2', cout: 1 },
  meditation: { gain: 'Deux cartes au lieu d’une', effet: '+1 d’énergie pour cette question, et tu tires deux cartes de plus.', resume: 'Énergie, 2 cartes' },
  'sang-froid': {
    gain: 'Bouclier 6 et +6, au lieu de 4',
    effet: 'Une fois la question vue : bouclier 6 — et si tu réponds juste, l’adversaire perd 6 de plus.',
    resume: 'Bouclier 6 et +6',
    valeur: '6',
  },
  panacee: {
    gain: `+${COURAGE_DE_LA_PANACEE_PLUS} au lieu de +${COURAGE_DE_LA_PANACEE}`,
    effet: `Tu reprends ${COURAGE_DE_LA_PANACEE_PLUS} de courage. Jouée, elle quitte ton paquet.`,
    resume: `+${COURAGE_DE_LA_PANACEE_PLUS} courage`,
    valeur: `+${COURAGE_DE_LA_PANACEE_PLUS}`,
  },
  maitrise: { gain: '1 d’énergie au lieu de 2', cout: 1 },
  // L'Érudit.
  plume: {
    gain: '+3 et +8 au lieu de +2 et +6',
    effet: 'Si tu réponds juste, l’adversaire perd 3 de plus — 8 si la question est de ta catégorie fétiche.',
    resume: '+3, +8 fétiche',
    valeur: '+3',
  },
  'savoir-faire': {
    gain: '+6 ou +10 au lieu de +4 ou +7',
    effet: 'Si tu réponds juste, l’adversaire perd 6 de plus — 10 si la question n’est pas facile.',
    resume: '+6 ou +10',
    valeur: '+6',
  },
  memoire: {
    gain: '+5 au lieu de +3',
    effet: 'Une fois la question vue : si tu réponds juste, l’adversaire perd 5 de plus, et tu tires une carte de plus à la question suivante.',
    resume: '+5, +1 carte',
    valeur: '+5',
  },
  bibliotheque: {
    gain: '+2 et +5 au lieu de +1 et +3',
    effet: 'Pour toute la rencontre : tes bonnes réponses lui font perdre 2 de plus — 5 celles de ta catégorie fétiche.',
    resume: '+2, +5 fétiche',
    valeur: '+2',
  },
  lecon: {
    gain: '+6 au lieu de +4, les deux fois',
    effet: 'Si tu réponds juste, l’adversaire perd 6 de plus — et 6 de plus encore à la question suivante.',
    resume: '+6, deux fois',
    valeur: '+6',
  },
  expose: { gain: 'Gratuite', cout: 0 },
  encyclopedie: {
    gain: `+${ENCYCLOPEDIE_PAR_JUSTE_PLUS} par bonne réponse au lieu de +${ENCYCLOPEDIE_PAR_JUSTE}`,
    effet: `Pour toute la rencontre : chaque bonne réponse lui fait perdre ${ENCYCLOPEDIE_PAR_JUSTE_PLUS} de plus par bonne réponse déjà donnée dans la rencontre.`,
    resume: `+${ENCYCLOPEDIE_PAR_JUSTE_PLUS} par juste`,
    valeur: `+${ENCYCLOPEDIE_PAR_JUSTE_PLUS}`,
  },
  genie: {
    gain: '+12 et +20 au lieu de +8 et +14',
    effet: 'Si tu réponds juste, l’adversaire perd 12 de plus — 20 si la question est de ta catégorie fétiche.',
    resume: '+12, +20 fétiche',
    valeur: '+12',
  },
  // Le Flambeur.
  'doubler-la-mise': { gain: 'Tu tires une carte en plus', effet: 'Ton pari compte double, gain comme perte. Et tu tires une carte.', resume: 'Pari ×2, +1 carte' },
  pourboire: {
    gain: `${ECUS_DU_POURBOIRE_PLUS} écus au lieu de ${ECUS_DU_POURBOIRE}`,
    effet: `Si tu réponds juste, tu gagnes ${ECUS_DU_POURBOIRE_PLUS} écus. Et tu tires une carte.`,
    resume: `+${ECUS_DU_POURBOIRE_PLUS} écus +1 carte`,
  },
  cagnotte: {
    gain: `+6 et ${ECUS_DE_LA_CAGNOTTE_PLUS} écus, au lieu de +4 et ${ECUS_DE_LA_CAGNOTTE}`,
    effet: `Si tu réponds juste, l’adversaire perd 6 de plus et tu gagnes ${ECUS_DE_LA_CAGNOTTE_PLUS} écus.`,
    resume: `+6 et ${ECUS_DE_LA_CAGNOTTE_PLUS} écus`,
    valeur: '+6',
  },
  banco: { gain: 'Gratuite', cout: 0 },
  assurance: { gain: 'Deux cartes au lieu d’une', effet: 'Si tu te trompes, ton pari t’est rendu. Et tu tires deux cartes.', resume: 'Assuré, +2 cartes' },
  fortune: { gain: 'Gratuite', cout: 0 },
  pactole: { gain: 'Gratuite', cout: 0 },
  rafle: {
    gain: `+20 et ${ECUS_DE_LA_RAFLE_PLUS} écus, au lieu de +14 et ${ECUS_DE_LA_RAFLE}`,
    effet: `Si tu réponds juste, l’adversaire perd 20 de plus et tu gagnes ${ECUS_DE_LA_RAFLE_PLUS} écus.`,
    resume: `+20 et ${ECUS_DE_LA_RAFLE_PLUS} écus`,
    valeur: '+20',
  },
  // Le Métamorphe.
  corser: { gain: 'Gratuite', cout: 0 },
  simplifier: { gain: 'Bouclier 6 au lieu de 3', effet: 'La question passe en vrai ou faux : plus facile, mais l’adversaire perd moitié moins. Et bouclier 6.' },
  'volte-face': { gain: 'Gratuite', cout: 0 },
  prisme: {
    gain: `+${PRISME_PAR_JUSTE_PLUS} et +${PRISME_A_SIX_CHOIX_PLUS} au lieu de +${PRISME_PAR_JUSTE} et +${PRISME_A_SIX_CHOIX}`,
    effet: `Pour toute la rencontre : tes bonnes réponses lui font perdre ${PRISME_PAR_JUSTE_PLUS} de plus — ${PRISME_A_SIX_CHOIX_PLUS} à six choix.`,
    resume: `+${PRISME_PAR_JUSTE_PLUS}, +${PRISME_A_SIX_CHOIX_PLUS} à six`,
    valeur: `+${PRISME_PAR_JUSTE_PLUS}`,
  },
  miroir: { gain: 'Gratuite', cout: 0 },
  cameleon: {
    gain: `Bouclier ${BOUCLIER_DU_CAMELEON_PLUS} au lieu de ${BOUCLIER_DU_CAMELEON}`,
    effet: `Pour toute la rencontre : chaque fois que tu changes la question, ou sa forme, bouclier ${BOUCLIER_DU_CAMELEON_PLUS}.`,
    valeur: `${BOUCLIER_DU_CAMELEON_PLUS}`,
  },
  metamorphose: { gain: 'Gratuite', cout: 0 },
  polymorphe: { gain: 'Bouclier 4 en plus', effet: 'La question passe à six choix, et l’adversaire perd le double, pas une fois et demie. Et bouclier 4.' },
  // L'Élan.
  echauffement: {
    gain: '+4 au lieu de +2',
    effet: 'Si tu réponds juste, l’adversaire perd 4 de plus. Et ta série compte une bonne réponse de plus.',
    resume: '+4, série +1',
    valeur: '+4',
  },
  lancee: {
    gain: '+3 par bonne réponse au lieu de +2',
    effet: 'Si tu réponds juste, l’adversaire perd 3 de plus par bonne réponse de ta série, celle-ci comprise.',
    resume: '+3 par série',
    valeur: '+3',
  },
  foulee: { gain: '+2 d’énergie au lieu de +1', effet: '+2 d’énergie pour cette question.', resume: '+2 énergie', valeur: '+2' },
  acceleration: { gain: 'Deux cartes au lieu d’une', effet: 'Si tu réponds juste, la question suivante te donne 1 d’énergie et deux cartes de plus.' },
  rythme: { gain: 'Gratuite', cout: 0 },
  sprint: { gain: 'Trois cartes au lieu de deux', effet: 'Tu tires trois cartes, et +1 d’énergie pour cette question.', valeur: '+3' },
  'vent-arriere': { gain: 'Gratuite', cout: 0 },
  inarretable: { gain: 'Gratuite', cout: 0 },
  // Le Rempart.
  parade: { gain: 'Bouclier 9 au lieu de 6', effet: 'Bouclier 9, une fois la question vue : si tu te trompes, il pare 9 de l’attaque.', resume: 'Bouclier 9', valeur: '9' },
  muraille: { gain: 'Bouclier 16 au lieu de 12', effet: 'Bouclier 16 : si tu te trompes, il pare 16 de l’attaque.', resume: 'Bouclier 16', valeur: '16' },
  pansement: {
    gain: `+${COURAGE_DU_PANSEMENT_PLUS} au lieu de +${COURAGE_DU_PANSEMENT}`,
    effet: `Si tu réponds juste, tu reprends ${COURAGE_DU_PANSEMENT_PLUS} de courage.`,
    resume: `Soin ${COURAGE_DU_PANSEMENT_PLUS} si juste`,
    valeur: `+${COURAGE_DU_PANSEMENT_PLUS}`,
  },
  'contre-attaque': { gain: 'Gratuite', cout: 0 },
  cuirasse: {
    gain: `Bouclier ${BOUCLIER_DE_LA_CUIRASSE_PLUS} au lieu de ${BOUCLIER_DE_LA_CUIRASSE}`,
    effet: `Pour toute la rencontre : bouclier ${BOUCLIER_DE_LA_CUIRASSE_PLUS} à chaque question, celle-ci comprise.`,
    valeur: `${BOUCLIER_DE_LA_CUIRASSE_PLUS}`,
  },
  'second-souffle': {
    gain: `+${COURAGE_DU_SECOND_SOUFFLE_PLUS} au lieu de +${COURAGE_DU_SECOND_SOUFFLE}`,
    effet: `Tu reprends ${COURAGE_DU_SECOND_SOUFFLE_PLUS} de courage.`,
    resume: `+${COURAGE_DU_SECOND_SOUFFLE_PLUS} courage`,
    valeur: `+${COURAGE_DU_SECOND_SOUFFLE_PLUS}`,
  },
  bastion: { gain: '1 d’énergie au lieu de 2', cout: 1 },
  represailles: { gain: '1 d’énergie au lieu de 2', cout: 1 },
  // Le Devin.
  lucidite: {
    gain: '+3 et +8 au lieu de +2 et +5',
    effet: 'Si tu réponds juste, l’adversaire perd 3 de plus — 8 si une réponse est effacée.',
    resume: '+3, +8 effacée',
    valeur: '+3',
  },
  augure: { gain: 'Plus seulement une fois par rencontre', durable: true },
  presage: { gain: 'Gratuite', cout: 0 },
  'troisieme-oeil': {
    gain: '+5 par indice au lieu de +3',
    effet: 'Pour toute la rencontre : chaque indice que tu joues lui fait perdre 5 de plus, si tu réponds juste.',
    resume: 'Indices +5',
    valeur: '+5',
  },
  voyance: { gain: 'Gratuite', cout: 0 },
  astrolabe: {
    gain: `Bouclier ${BOUCLIER_DE_L_ASTROLABE_PLUS} au lieu de ${BOUCLIER_DE_L_ASTROLABE}`,
    effet: `Pour toute la rencontre : chaque indice que tu joues te donne bouclier ${BOUCLIER_DE_L_ASTROLABE_PLUS}.`,
    valeur: `${BOUCLIER_DE_L_ASTROLABE_PLUS}`,
  },
  vision: { gain: '1 d’énergie au lieu de 2', cout: 1 },
  revelation: { gain: 'Gratuite', cout: 0 },
}

/** Tout le catalogue des rencontres ; une carte qui s'améliore porte ce qu'elle devient (`amelioration`). */
export const CARTES_DES_RENCONTRES: readonly CarteDeRencontre[] = [...NEUTRES, ...DES_FAMILLES, ...DES_LEGENDAIRES].map(c =>
  AMELIORATIONS[c.cle] ? { ...c, amelioration: AMELIORATIONS[c.cle] } : c,
)

// ── Les cartes améliorées ──

/** La clé d'un exemplaire amélioré : celle de sa carte, suivie de « + » — comme son nom, « Concentration+ ». */
export const ameliorer = (cle: string) => `${cle}+`
/** Cet exemplaire est-il amélioré ? */
export const estAmelioree = (cle: string) => cle.endsWith('+')
/** La carte d'un exemplaire, amélioré ou non : ce que lit chaque règle qui la reconnaît — un refus, ce qu'elle fait, l'écran qui la dessine. */
export const baseDe = (cle: string) => (estAmelioree(cle) ? cle.slice(0, -1) : cle)
/**
 * Cette carte est-elle dans la liste — jouée, posée, sur la question —,
 * améliorée ou non ? Les tas d'une rencontre portent la clé de l'exemplaire :
 * cherché sous sa seule clé, Sursis+ jouée ne sauvait rien
 * (`expedition-ameliorations.test.ts` relit le code pour qu'aucune règle ne
 * cherche plus ainsi une carte qui s'améliore).
 */
export const parmi = (liste: readonly string[], cle: string) => liste.includes(cle) || liste.includes(ameliorer(cle))
/** Y est-elle améliorée ? */
export const amelioreeParmi = (liste: readonly string[], cle: string) => liste.includes(ameliorer(cle))

/**
 * Un exemplaire amélioré, tel que la règle et la page le lisent : sa clé et
 * son nom suivis de « + », ses chiffres neufs — venu avec le jeu complet,
 * comme les améliorations. Il garde `amelioration`, de quoi dire ce qu'il a
 * gagné.
 */
function exemplaireAmeliore(c: CarteDeRencontre, a: Amelioration): CarteDeRencontre {
  const { gain: _gain, durable, ...neuf } = a
  const x: CarteDeRencontre = { ...c, ...neuf, cle: ameliorer(c.cle), nom: `${c.nom}+`, amelioree: true, depuis: Math.max(c.depuis ?? 0, VERSION_DU_JEU_COMPLET) }
  delete x.avantLeCodex
  if (durable) delete x.epuisement
  return x
}

/** Les exemplaires améliorés : hors du catalogue — le codex et les offres l'énumèrent —, mais chacun se lit par sa clé. */
const AMELIOREES: readonly CarteDeRencontre[] = CARTES_DES_RENCONTRES.flatMap(c => (c.amelioration ? [exemplaireAmeliore(c, c.amelioration)] : []))

const PAR_CLE = new Map([...CARTES_DES_RENCONTRES, ...AMELIOREES].map(c => [c.cle, c]))

/** Une carte par sa clé — un exemplaire amélioré compris —, telle que le codex la joue ; undefined : elle n'est pas du catalogue des rencontres. */
export function carteDeRencontre(cle: unknown): CarteDeRencontre | undefined {
  return typeof cle === 'string' ? PAR_CLE.get(cle) : undefined
}

/**
 * Pourquoi cette carte ne s'améliore pas — null : elle s'améliore. Une seule
 * règle, au campement comme à l'échoppe : le pli l'applique, le serveur la
 * renvoie, la page la dit. Un exemplaire de son paquet, pas encore amélioré,
 * d'une carte qui a son amélioration.
 */
export function refusDeLAmelioration(paquet: readonly string[], cle: string): string | null {
  const c = carteDeRencontre(cle)
  if (!c || !paquet.includes(cle)) return 'Cette carte n’est pas dans ton paquet'
  if (c.amelioree) return 'Elle est déjà améliorée'
  if (!c.amelioration) {
    return c.maudit ? 'Une carte maudite ne s’améliore pas' : c.legendaire ? 'La carte d’un légendaire ne s’améliore pas' : 'Une carte de route ne s’améliore pas'
  }
  return null
}

/**
 * Une carte telle qu'un départ de cette version la joue : avant le codex (v5,
 * v6), à ses chiffres d'alors — rejouée aux règles neuves, une expédition
 * partie avant changerait sous les pieds de qui joue. Tout ce qui lit son
 * coût ou ce qu'elle dit dans une expédition passe par ici.
 */
export function carteALaVersion(cle: unknown, v: number): CarteDeRencontre | undefined {
  const c = carteDeRencontre(cle)
  return c?.avantLeCodex && v < VERSION_DU_CODEX ? { ...c, ...c.avantLeCodex } : c
}

/** La carte d'un légendaire (`lg:phenix`), s'il en a une. */
export function carteDuLegendaire(cle: unknown): CarteDeRencontre | undefined {
  return DES_LEGENDAIRES.find(c => c.legendaire === cle)
}

/** Une carte de route ne se tire jamais en rencontre : elle se joue sur la carte, une fois par acte. */
export const estDeRoute = (cle: string) => PAR_CLE.get(cle)?.moment === 'route'

/** Les cartes qui se tirent en rencontre : tout le paquet, sauf celles de route. */
export const cartesDeCombat = (paquet: readonly string[]) => paquet.filter(cle => PAR_CLE.has(cle) && !estDeRoute(cle))

/**
 * Le paquet de départ des rencontres : Concentration et Prudence quatre fois
 * chacune — l'attaque et la défense de Slay the Spire —, Coup d'œil, Échange.
 * Puis la carte de chaque légendaire de l'équipée.
 */
export const PAQUET_DES_RENCONTRES: readonly string[] = ['concentration', 'concentration', 'concentration', 'concentration', 'prudence', 'prudence', 'prudence', 'prudence', 'coup-d-oeil', 'echange']

/**
 * Un style de jeu : une famille, choisie au départ (le 19 octobre 2026 : « Pour
 * les cartes il faut vraiment plus de gameplay différents […] j'ai
 * l'impression de piocher tout le temps la même chose et de pas avoir à
 * choisir de style de jeu »). Ses offres tiraient une famille au hasard de
 * ce que le paquet tenait déjà, et le paquet partait le même pour tous : rien
 * ne disait quelle façon de gagner on jouait. Les neutres sont à tout le monde.
 */
export type StyleDeJeu = Exclude<FamilleDeCartes, 'neutre'>

/**
 * Les deux cartes qu'un style met dans le paquet de départ — des communes que
 * son niveau ouvre avec lui (`ECHELLE`, `shared/codex.ts`) : dès la première
 * question, on joue son style.
 */
export const CARTES_DE_DEPART_DU_STYLE: Readonly<Record<StyleDeJeu, readonly [string, string]>> = {
  rempart: ['parade', 'pansement'],
  erudit: ['plume', 'savoir-faire'],
  devin: ['augure', 'presage'],
  flambeur: ['pourboire', 'cagnotte'],
  elan: ['echauffement', 'lancee'],
  metamorphe: ['corser', 'simplifier'],
}

/**
 * La carte de base que chacune remplace : une attaque prend la place d'une
 * Concentration, une protection celle d'une Prudence, un indice — qui sert à
 * l'une comme à l'autre — une de chaque. Mesuré le 19 octobre 2026
 * (`calibrage-rencontres.ts --styles`) : prises toutes deux à la place d'une
 * Concentration et d'une Prudence, les cartes d'attaque laissaient le paquet
 * de l'Érudit, du Flambeur et de l'Élan sans assez de boucliers.
 */
export const BASES_REMPLACEES_PAR_LE_STYLE: Readonly<Record<StyleDeJeu, readonly [string, string]>> = {
  rempart: ['prudence', 'prudence'],
  erudit: ['concentration', 'concentration'],
  devin: ['concentration', 'prudence'],
  flambeur: ['concentration', 'concentration'],
  elan: ['concentration', 'concentration'],
  metamorphe: ['concentration', 'prudence'],
}

/** Les styles, dans l'ordre où le codex les ouvre (`ECHELLE`). */
export const STYLES = Object.keys(CARTES_DE_DEPART_DU_STYLE) as StyleDeJeu[]

export const estUnStyle = (x: unknown): x is StyleDeJeu => (STYLES as readonly unknown[]).includes(x)

/**
 * Le paquet de départ des rencontres, et la carte de chaque légendaire de
 * l'équipée. Un style (le 19 octobre 2026) y pose ses deux cartes à la place
 * de deux cartes de base (`BASES_REMPLACEES_PAR_LE_STYLE`) ; sans style — un
 * départ d'avant lui —, celui de toujours.
 */
export function paquetDesRencontres(equipee: readonly string[], style?: StyleDeJeu): string[] {
  const base = [...PAQUET_DES_RENCONTRES]
  if (style) {
    for (const remplacee of BASES_REMPLACEES_PAR_LE_STYLE[style]) base.splice(base.indexOf(remplacee), 1)
    base.push(...CARTES_DE_DEPART_DU_STYLE[style])
  }
  return [...base, ...equipee.flatMap(cle => carteDuLegendaire(cle)?.cle ?? [])].sort()
}

/**
 * Le nom et la devise de chaque famille, ce que la page en dit — et, pour un
 * style, sa façon de gagner en une phrase de tous les jours (`jeu`) : le
 * départ la dit sous le style choisi, les règles sous chacun.
 */
export const FAMILLES_DE_CARTES: Readonly<Record<FamilleDeCartes, { nom: string; devise: string; jeu?: string }>> = {
  erudit: { nom: 'L’Érudit', devise: 'Je connais mon rayon', jeu: 'Il frappe fort quand il sait — plus encore sur sa catégorie fétiche.' },
  flambeur: { nom: 'Le Flambeur', devise: 'Je parie sur moi', jeu: 'Il gagne des écus et les parie ; ses gains frappent aussi.' },
  metamorphe: { nom: 'Le Métamorphe', devise: 'Je change la question', jeu: 'Six choix pour frapper plus, un vrai ou faux pour risquer moins.' },
  elan: { nom: 'L’Élan', devise: 'Je ne m’arrête plus', jeu: 'Chaque bonne réponse d’affilée frappe plus fort que la précédente.' },
  rempart: { nom: 'Le Rempart', devise: 'Je tiens bon', jeu: 'Il gagne en tenant, à coups de boucliers et de courage.' },
  devin: { nom: 'Le Devin', devise: 'Je lis les signes', jeu: 'Il efface les mauvaises réponses avant de choisir.' },
  neutre: { nom: 'Les neutres', devise: 'Pour tout le monde' },
}

/** Les familles de son équipée, dans l'ordre de ses places, sans doublon : les offres en tirent leurs cartes. */
export function famillesDeLEquipee(equipee: readonly string[]): FamilleDeCartes[] {
  const familles: FamilleDeCartes[] = []
  for (const cle of equipee) {
    const f = carteDuLegendaire(cle)?.famille
    if (f && f !== 'neutre' && !familles.includes(f)) familles.push(f)
  }
  return familles
}

/**
 * Ce que les offres d'avant le codex proposent hors des familles : les
 * neutres, sans Concentration ni Prudence — comme Slay the Spire ne propose
 * pas ses frappes de base —, ni les cartes venues après elles (`depuis`) :
 * rejouée, une offre de la version 5 ou 6 tirerait parmi plus de cartes, et
 * une autre que celle qu'elle a tirée.
 */
const NEUTRES_DES_OFFRES = NEUTRES.filter(c => c.cle !== 'concentration' && c.cle !== 'prudence' && !c.depuis).map(c => c.cle)
/** Les cartes de famille de ces offres-là, de même. */
const FAMILLES_DES_OFFRES = DES_FAMILLES.filter(c => !c.depuis)

/**
 * Une offre de cartes — après une rencontre, une élite, dans un coffre, à
 * l'échoppe : trois cartes distinctes, chacune tirée d'une famille de son
 * équipée (`PART_D_UNE_FAMILLE` chacune), sinon des neutres, à une rareté
 * tirée à ses poids. Du hasard de la graine et du rang de l'offre : recharger
 * ne la change pas. Une famille ou une rareté qui n'a plus rien à proposer
 * cède la place aux neutres. `stricte` (v6) : une famille épuisée à sa rareté
 * passe aux neutres de la même rareté avant ses autres cartes — sans quoi la
 * rare de l'Érudit revenait par la bande à l'acte 1, où les rares attendent.
 * Le hasard tiré reste le même : une offre de la version 5 se rejoue telle
 * qu'elle s'est jouée.
 */
export function offreDeCartes(graine: string, rang: number, familles: readonly FamilleDeCartes[], poids: PoidsDesRaretes = RARETES_D_UNE_RENCONTRE, stricte = false): string[] {
  const r = hasardDe(`${graine}:offre:${rang}`)
  const prises: string[] = []
  const raretes = Object.entries(poids) as [RareteDOffre, number][]
  for (let essai = 0; prises.length < CARTES_PAR_OFFRE && essai < 60; essai++) {
    const t = r()
    const famille = t < PART_D_UNE_FAMILLE ? familles[0] : t < 2 * PART_D_UNE_FAMILLE ? familles[1] : undefined
    const u = r()
    let cumul = 0
    let rarete = raretes[0][0]
    for (const [nom, p] of raretes) {
      cumul += p
      if (u < cumul) {
        rarete = nom
        break
      }
    }
    const tas = famille ? FAMILLES_DES_OFFRES.filter(c => c.famille === famille).map(c => c.cle) : NEUTRES_DES_OFFRES
    const libres = tas.filter(cle => !prises.includes(cle))
    const aSaRarete = libres.filter(cle => PAR_CLE.get(cle)?.rarete === rarete)
    const neutresASaRarete = stricte ? NEUTRES_DES_OFFRES.filter(cle => !prises.includes(cle) && PAR_CLE.get(cle)?.rarete === rarete) : []
    const candidates =
      aSaRarete.length > 0 ? aSaRarete : neutresASaRarete.length > 0 ? neutresASaRarete : libres.length > 0 ? libres : NEUTRES_DES_OFFRES.filter(cle => !prises.includes(cle))
    if (candidates.length > 0) prises.push(candidates[Math.floor(r() * candidates.length)])
  }
  return prises
}

// ── Les adversaires ────────────────────────────────────────────────────────

/** L'adversaire de chaque catégorie : l'escale dit sa catégorie, il l'incarne. Leurs ruses viendront à l'étape des adversaires. */
export const ADVERSAIRES: Readonly<Record<string, string>> = {
  'Culture générale': 'Le Touche-à-tout',
  Histoire: 'Le Scribe',
  Géographie: 'Le Cartographe',
  Sciences: 'L’Alchimiste',
  Nature: 'La Ronce',
  'Cinéma & séries': 'Le Critique',
  Musique: 'La Sirène',
  'Arts & lettres': 'Le Faussaire',
  Sport: 'L’Arbitre',
  Cuisine: 'Le Gourmet',
  'Jeux & pop culture': 'Le Maître du jeu',
  'Autour de la fête': 'Le Fêtard',
}

/** L'adversaire d'une escale : celui de sa catégorie — de celle du Commandement —, le Bouffon d'un mélange, le Spécialiste d'un thème pointu. */
export function adversaireDe(theme: ThemeDEscale | undefined, categorie?: string | null): string {
  if (categorie) return ADVERSAIRES[categorie] ?? 'Le Touche-à-tout'
  if (!theme) return 'Le Touche-à-tout'
  if ('sujet' in theme) return 'Le Spécialiste'
  return theme.categories.length > 1 ? 'Le Bouffon' : (ADVERSAIRES[theme.categories[0]] ?? 'Le Touche-à-tout')
}

// ── Une rencontre ──────────────────────────────────────────────────────────

/** Les sceaux d'un adversaire, à cet acte. */
export const sceauxDe = (sorte: SorteDeRencontre, acte: number) => SCEAUX_DES_RENCONTRES[sorte][Math.min(Math.max(0, acte), 2)]
/** Sa frappe à la première erreur, à cet acte. */
export const frappeDe = (sorte: SorteDeRencontre, acte: number) => FRAPPE_DES_RENCONTRES[sorte][Math.min(Math.max(0, acte), 2)]

/** Le tour d'une question : l'annonce et la préparation, puis la question sous les yeux. */
export interface TourDeRencontre {
  phase: 'preparation' | 'question'
  inspiration: number
  /** S'ajoute à ce que brise la bonne réponse ; une erreur la fait retomber. */
  charge: number
  /** Prend la frappe d'une erreur ; elle tombe après la question. */
  garde: number
  /** La mise annoncée en voyant la question ; Doubler la mise la compte double. */
  mise: number
  /** Toutes les cartes jouées à ce tour, dans l'ordre. */
  jouees: string[]
  /** Celles qui visent la question à l'écran — un indice, une forme : une autre question (Échange, La mue) repart sans elles. */
  surLaQuestion: string[]
  /** La Prédiction : la réponse montrée à l'Oracle. */
  montre?: number
}

/** Ce qu'une réponse vient de faire : la page le dit, et la réponse de l'expédition le rend. */
export interface CoupDeRencontre {
  juste: boolean
  /** Les sceaux brisés — Contre-attaque en brise aussi sur une erreur. */
  brises: number
  /** Une erreur : sa frappe, ce que la Garde en a pris, le courage perdu. */
  frappe: number
  absorbee: number
  perdu: number
  /** Ce que la mise a rapporté, ou coûté (négatif). */
  mise: number
  /** Juste : les écus de ses cartes, à part du pari, et le courage repris — Pourboire, Cagnotte, Rafle, Pansement (le jeu complet). Absents sans. */
  ecus?: number
  courage?: number
  /** Passe-muraille : traversée, ni frappe ni sceaux. */
  traversee?: true
  /** Renaissance : tombé à zéro, il renaît. */
  renaissance?: true
  /** L'adversaire tombe : les écus et le courage de la victoire. */
  victoire?: { ecus: number; courage: number }
}

/** Une rencontre en cours, telle que le pli la tient. */
export interface RencontreEnCours {
  sorte: SorteDeRencontre
  /** L'escale où elle se joue — `g`, le gardien. */
  escale: string
  sceaux: number
  max: number
  /** Sa frappe de base ; elle grandit de `FRAPPE_EN_PLUS_PAR_QUESTION` à chaque question jugée. */
  frappe: number
  questions: number
  /** Ses bonnes réponses d'affilée dans la rencontre. */
  serie: number
  /** La catégorie que le Commandement a imposée à l'escale : toutes ses questions la posent. */
  categorie: string | null
  pouvoirs: string[]
  pioche: string[]
  main: string[]
  defausse: string[]
  epuisees: string[]
  tour: TourDeRencontre
  /**
   * Ce que le tour suivant reçoit de plus : L'élan, Peau de feu — et, depuis
   * le jeu complet, Mémoire, Leçon, Accélération, Vent arrière, et le
   * bouclier que Bastion garde.
   */
  suivant: { cartes: number; inspiration: number; charge: number; garde: number }
  /** Ses bonnes réponses dans la rencontre, d'affilée ou non : Encyclopédie en frappe plus fort (le jeu complet). */
  trouvees: number
  /** Ce que la dernière erreur lui a coûté de courage : L'horizon le rend. */
  derniereFrappe: number
  /** Le courage que ses frappes lui ont pris dans la rencontre : un gardien vaincu sans en perdre est un exploit (le codex). */
  perdu: number
  /** L'aube : ses bonnes réponses depuis qu'elle est posée. */
  aube: number
  /** La boucle : l'erreur à reposer, ce qu'elle a coûté, le rang où elle se repose. */
  boucle: { reprise: number; perte: number; position: number | null } | null
}

/** Ce qu'il frappe à la prochaine erreur, la Garde pas encore comptée. */
export const frappeDeLaQuestion = (r: Pick<RencontreEnCours, 'frappe' | 'questions'>) => r.frappe + FRAPPE_EN_PLUS_PAR_QUESTION * r.questions

/** Ce qu'une question doit dire d'elle pour le calcul : ses réponses, sa forme, le mot où sa réponse est arrivée. */
export interface FormeDUneQuestion {
  reponses?: number
  forme?: FormeDEscale
  devoile?: { mots: number; sur: number }
}

/** Le six choix de Métamorphose et de Polymorphe : le double, pas une fois et demie (le jeu complet). */
export const MULTIPLICATEUR_DU_SIX_CHOIX_METAMORPHOSE = 2

/**
 * La forme multiplie ce que brise une bonne réponse : ×0,5 en vrai ou faux,
 * ×1,5 à six choix, de ×3 à ×1 au dévoilement selon le mot. Ce que les cartes
 * y changent (le jeu complet) : sous Métamorphose, un vrai ou faux vaut une
 * question à quatre choix, et six choix le double ; Miroir, sur la question,
 * le vrai ou faux qu'il pose ; Polymorphe, les six choix qu'il pose.
 */
export function multiplicateurDeLaForme(q: FormeDUneQuestion, cartes?: { pouvoirs: readonly string[]; surLaQuestion: readonly string[] }): number {
  const metamorphose = !!cartes && parmi(cartes.pouvoirs, 'metamorphose')
  if ((q.reponses ?? 4) <= 2) return metamorphose || (!!cartes && parmi(cartes.surLaQuestion, 'miroir')) ? 1 : MULTIPLICATEUR_DU_VRAI_OU_FAUX
  if (q.forme === 'six') return metamorphose || (!!cartes && parmi(cartes.surLaQuestion, 'polymorphe')) ? MULTIPLICATEUR_DU_SIX_CHOIX_METAMORPHOSE : MULTIPLICATEUR_DU_SIX_CHOIX
  if (q.forme === 'devoilement' && q.devoile && q.devoile.sur > 0) {
    const mots = Math.min(q.devoile.sur, Math.max(1, q.devoile.mots))
    return 1 + ((DEVOILEMENT_AU_PREMIER_MOT - 1) * (q.devoile.sur - mots)) / Math.max(1, q.devoile.sur - 1)
  }
  return 1
}

/**
 * Ce que brise une bonne réponse : (son savoir + sa Charge + ce qu'un pouvoir
 * y ajoute) × sa forme, puis ce que Banco y joint, le tout doublé par Quitte
 * ou double.
 */
export function brisesDUneBonneReponse(o: { savoir: number; charge: number; enPlus: number; multiplicateur: number; banco: number; double: boolean }): number {
  const x = Math.round((o.savoir + o.charge + o.enPlus) * o.multiplicateur) + o.banco
  return o.double ? x * 2 : x
}

/** Ce que coûte une erreur : sa frappe — rien sous Sursis ou La mue, double sous Tout ou rien et Quitte ou double —, ce que la Garde en prend, le reste. */
export function frappeDUneErreur(o: { frappe: number; sauve: boolean; double: boolean; garde: number }): { frappe: number; absorbee: number; perdu: number } {
  const frappe = o.sauve ? 0 : o.double ? o.frappe * 2 : o.frappe
  const absorbee = Math.min(Math.max(0, o.garde), frappe)
  return { frappe, absorbee, perdu: frappe - absorbee }
}

/** La mise en jeu : celle annoncée, double sous Doubler la mise. */
export const enJeu = (t: Pick<TourDeRencontre, 'mise' | 'jouees'>) => t.mise * (parmi(t.jouees, 'doubler-la-mise') ? 2 : 1)

/** Ce qu'une mise gagnée rapporte, net : la moitié de ce qu'elle engage — triple sous Le trésor, triple sous Quitte ou double, cinq fois sous les deux. */
export const gainDeLaMise = (t: Pick<TourDeRencontre, 'mise' | 'jouees'>, pouvoirs: readonly string[]) =>
  Math.round(enJeu(t) * PART_GAGNEE_D_UNE_MISE) * (1 + (pouvoirs.includes('tresor') ? 2 : 0) + (t.jouees.includes('quitte-ou-double') ? 2 : 0))

/**
 * Combien de mauvaises réponses chaque carte efface : celles des jokers
 * (`EFFACE`), et celles du jeu complet — Augure, Présage, Voyance ; Vision,
 * posée, à chaque question. Révélation efface tout ce qui peut l'être.
 */
export const EFFACE_DES_CARTES: Readonly<Record<string, number>> = { ...EFFACE, augure: 1, presage: 1, voyance: 2, vision: 1 }

/** Les pouvoirs qui effacent une réponse à chaque question : L'écholocation, Vision (le jeu complet). */
export const POUVOIRS_QUI_EFFACENT: readonly string[] = ['echolocation', 'vision']

/** Les réponses qu'effacent les cartes du tour, la fiole de clairvoyance, L'écholocation et Vision — jamais plus que deux de moins que ses réponses : sinon la carte répondrait à sa place. */
export function effaceesDuTour(surLaQuestion: readonly string[], pouvoirs: readonly string[], q: { reponses: number; datee?: boolean }): number {
  if (q.reponses <= 2) return 0
  let n = 0
  for (const cle of surLaQuestion) {
    const b = baseDe(cle)
    n += cle === CLAIRVOYANCE_SUR_LA_QUESTION ? 1 : b === 'revelation' ? q.reponses : (EFFACE_DES_CARTES[b] ?? 0)
  }
  // Le Sphinx d'une question qui ne se date pas efface au lieu de souffler : sinon, la carte ne servait à rien.
  if (surLaQuestion.includes('enigme') && !q.datee) n += 1
  for (const cle of POUVOIRS_QUI_EFFACENT) if (parmi(pouvoirs, cle)) n += EFFACE_DES_CARTES[cle] ?? 1
  return Math.min(n, q.reponses - 2)
}

/**
 * Les cartes qui visent la question dès la préparation : elles changent sa
 * forme (Corser, Simplifier, Miroir, Polymorphe) ou y effacent une réponse
 * avant qu'il la voie (Augure). Comme celles qu'on joue la question sous les
 * yeux, elles se rangent sur elle (`TourDeRencontre.surLaQuestion`) : une
 * autre question — Échange, Volte-face, La mue — repart sans elles.
 */
const SUR_LA_QUESTION_DES_LA_PREPARATION: ReadonlySet<string> = new Set(['corser', 'simplifier', 'miroir', 'polymorphe', 'augure'])

/** Cette carte, jouée, vise-t-elle la question à l'écran ? */
export const viseLaQuestion = (c: Pick<CarteDeRencontre, 'cle' | 'moment'>) => c.moment === 'reflexe' || SUR_LA_QUESTION_DES_LA_PREPARATION.has(baseDe(c.cle))

/** Les cartes qui changent la question — sa forme, ou la question elle-même — : Caméléon y lève son bouclier. */
export const CHANGENT_LA_QUESTION: ReadonlySet<string> = new Set(['corser', 'simplifier', 'miroir', 'polymorphe', 'echange', 'volte-face', 'mue'])

/** Les cartes qui posent une autre question, du même adversaire : celle d'avant ne se pose plus. */
export const CHANGENT_DE_QUESTION: ReadonlySet<string> = new Set(['echange', 'volte-face', 'mue'])

/** Cet exemplaire, joué, pose-t-il une autre question ? Amélioré ou non. */
export const changeDeQuestion = (cle: string) => CHANGENT_DE_QUESTION.has(baseDe(cle))

/** Ce qu'une carte jouée sur une question en fait : sa forme neuve, que le serveur repose de sa question de la base. */
export const FORME_DE_LA_CARTE: Readonly<Record<string, FormeDEscale>> = { corser: 'six', polymorphe: 'six', simplifier: 'vrai-faux', miroir: 'vrai-faux' }

/** La forme où cet exemplaire repose la question, amélioré ou non ; undefined : il n'y touche pas. */
export const formeDeLaCarte = (cle: string): FormeDEscale | undefined => FORME_DE_LA_CARTE[baseDe(cle)]

/** Une carte qui change la forme de la question : une seule fois par question. */
const changeLaForme = (cle: string) => formeDeLaCarte(cle) !== undefined

/**
 * Ce qu'une bonne réponse rapporte de plus, des cartes jouées à ce tour (le
 * jeu complet) : les écus de Pourboire, Cagnotte et Rafle — à part de ceux du
 * pari —, et le courage de Pansement. Le verdict (`pliDeLExpedition`) et
 * l'aperçu (`apercuDuTour`) les lisent tous deux ici : chaque carte jouée
 * compte, deux Pourboire en paient deux — et chaque exemplaire amélioré, ses
 * chiffres à lui.
 */
export function siJuste(jouees: readonly string[]): { ecus: number; courage: number } {
  let ecus = 0
  let courage = 0
  for (const cle of jouees) {
    const plus = estAmelioree(cle)
    switch (baseDe(cle)) {
      case 'pourboire':
        ecus += plus ? ECUS_DU_POURBOIRE_PLUS : ECUS_DU_POURBOIRE
        break
      case 'cagnotte':
        ecus += plus ? ECUS_DE_LA_CAGNOTTE_PLUS : ECUS_DE_LA_CAGNOTTE
        break
      case 'rafle':
        ecus += plus ? ECUS_DE_LA_RAFLE_PLUS : ECUS_DE_LA_RAFLE
        break
      case 'pansement':
        courage += plus ? COURAGE_DU_PANSEMENT_PLUS : COURAGE_DU_PANSEMENT
        break
    }
  }
  return { ecus, courage }
}

/** Ce que l'attaque fait de plus sur une erreur, des cartes jouées à ce tour : Surmenage. */
export const frappeEnPlus = (jouees: readonly string[]) => jouees.filter(cle => cle === 'surmenage').length * FRAPPE_DU_SURMENAGE

/** Ce que coûte un pari perdu : rien sous Assurance. */
export const pariPerdu = (t: Pick<TourDeRencontre, 'mise' | 'jouees'>) => (parmi(t.jouees, 'assurance') ? 0 : enJeu(t))

/** Ce que l'adversaire perd sur une erreur, de ce que le bouclier a paré : tout sous Contre-attaque jouée à ce tour, la moitié sous Représailles posée — l'une s'ajoute à l'autre. */
export const riposte = (absorbee: number, jouees: readonly string[], pouvoirs: readonly string[]) =>
  (parmi(jouees, 'contre-attaque') ? absorbee : 0) + (parmi(pouvoirs, 'represailles') ? Math.ceil(absorbee * PART_DES_REPRESAILLES) : 0)

/**
 * Ce que le tour suivant reçoit d'une bonne réponse, des cartes jouées à ce
 * tour et des pouvoirs posés (le jeu complet) : Mémoire, une carte ; Leçon, ses
 * points ; Accélération, une d'énergie et une carte — deux, améliorée ; Vent
 * arrière, une d'énergie.
 */
export function suiteDUneBonneReponse(jouees: readonly string[], pouvoirs: readonly string[]): { cartes: number; inspiration: number; charge: number } {
  const x = { cartes: 0, inspiration: 0, charge: 0 }
  for (const cle of jouees) {
    const plus = estAmelioree(cle)
    switch (baseDe(cle)) {
      case 'memoire':
        x.cartes += 1
        break
      case 'lecon':
        x.charge += plus ? 6 : 4
        break
      case 'acceleration':
        x.inspiration += 1
        x.cartes += plus ? 2 : 1
        break
    }
  }
  if (parmi(pouvoirs, 'vent-arriere')) x.inspiration += 1
  return x
}

/** Les chiffres d'un tour qu'une carte change : ce qu'il lui reste d'inspiration, sa Charge, sa Garde, sa série. */
export interface ChiffresDuTour {
  inspiration: number
  charge: number
  garde: number
  serie: number
}

/**
 * Ce que les chiffres d'une carte lisent de son départ et de la question :
 * la version — les cartes retouchées par le codex —, la catégorie fétiche
 * de la question (Plume, Génie), les réponses déjà effacées (Lucidité) ; et,
 * depuis le jeu complet, sa marche (Savoir-faire), ce qu'elle vaut (Exposé),
 * les écus qu'il a (Fortune). L'annonce dit les deux premières à la page, la
 * vue les écus.
 */
export interface ContexteDesChiffres {
  v: number
  /** La question est de sa catégorie fétiche. */
  fetiche?: boolean
  /** Les réponses que les cartes du tour y ont effacées (`effaceesDuTour`). */
  effacees?: number
  /** La marche de la question. */
  niveau?: Niveau
  /** Ce que vaut sa bonne réponse, avant les cartes : son savoir (`SAVOIR_DES_MARCHES`). */
  savoir?: number
  /** Les écus qu'il a. */
  ecus?: number
}

/**
 * Ce qu'une carte jouée fait aux chiffres du tour — l'inspiration qu'elle
 * coûte, la Charge, la Garde, la série : la seule règle, que le pli applique
 * (`pliDeLExpedition`) et que la page relit, carte levée, pour dire ce
 * qu'elle changerait avant qu'on la joue (« je veux que ce soit bien
 * compréhensible pour des novices », le 18 octobre 2026). Ce qu'elle fait
 * d'autre — tirer des cartes, changer de question, la reposer à une autre
 * forme —, le pli seul le fait. Aux chiffres de la version de son départ
 * (`carteALaVersion`), et à ceux d'un exemplaire amélioré (`plus`).
 */
export function chiffresApresLaCarte(cle: string, avant: ChiffresDuTour, pouvoirs: readonly string[], contexte: ContexteDesChiffres): ChiffresDuTour {
  const carte = carteALaVersion(cle, contexte.v)
  if (!carte) return { ...avant }
  const codex = contexte.v >= VERSION_DU_CODEX
  const plus = !!carte.amelioree
  const x = { ...avant, inspiration: avant.inspiration - carte.cout }
  switch (baseDe(cle)) {
    case 'concentration':
    case 'evidence':
      x.charge += plus ? 6 : 4
      break
    case 'prudence':
      x.garde += plus ? 8 : 5
      break
    case 'peau-de-feu':
      x.garde += 8
      break
    case 'parade':
      x.garde += plus ? 9 : 6
      break
    case 'simplifier':
      x.garde += plus ? 6 : 3
      break
    case 'polymorphe':
      if (plus) x.garde += 4
      break
    // Avant le codex, Plume et Lucidité ne se jouaient que dans leur cas (`refusDeLaCarte`) : ailleurs, des cartes mortes en main.
    case 'plume':
      x.charge += !codex || contexte.fetiche ? (codex ? (plus ? 8 : 6) : 5) : plus ? 3 : 2
      break
    case 'lucidite':
      x.charge += !codex || (contexte.effacees ?? 0) > 0 ? (plus ? 8 : 5) : plus ? 3 : 2
      break
    case 'lancee':
      // Avec le codex, la bonne réponse qu'elle vise compte dans la série : sans elle, la première d'une série ne frappait pas.
      x.charge += (plus ? 3 : 2) * (avant.serie + (codex ? 1 : 0))
      break
    case 'echauffement':
      x.serie += 1
      if (codex) x.charge += plus ? 4 : 2
      break
    case 'reveil':
      x.inspiration += 2
      break
    // Le jeu complet (v8).
    case 'volte-face':
      x.charge += 3
      break
    case 'memoire':
      x.charge += plus ? 5 : 3
      break
    case 'cagnotte':
    case 'lecon':
      x.charge += plus ? 6 : 4
      break
    case 'revelation':
      x.charge += 4
      break
    case 'sang-froid':
      x.garde += plus ? 6 : 4
      x.charge += plus ? 6 : 4
      break
    case 'savoir-faire':
      x.charge += contexte.niveau && contexte.niveau !== 'facile' ? (plus ? 10 : 7) : plus ? 6 : 4
      break
    case 'expose':
      x.charge += contexte.savoir ?? 0
      break
    case 'genie':
      x.charge += contexte.fetiche ? (plus ? 20 : 14) : plus ? 12 : 8
      break
    case 'fortune':
      x.charge += Math.floor(Math.max(0, contexte.ecus ?? 0) / 10)
      break
    case 'rafle':
      x.charge += plus ? 20 : 14
      break
    case 'muraille':
      x.garde += plus ? 16 : 12
      break
    case 'cuirasse':
      x.garde += plus ? BOUCLIER_DE_LA_CUIRASSE_PLUS : BOUCLIER_DE_LA_CUIRASSE
      break
    case 'meditation':
    case 'maitrise':
    case 'sprint':
      x.inspiration += 1
      break
    case 'foulee':
      x.inspiration += plus ? 2 : 1
      break
    case 'surmenage':
      x.inspiration += 2
      break
    case 'inarretable':
      x.serie += 1
      break
  }
  // Troisième œil : chaque indice frappe aussi ; Astrolabe (le jeu complet) : il protège.
  if (carte.indice && parmi(pouvoirs, 'troisieme-oeil')) x.charge += amelioreeParmi(pouvoirs, 'troisieme-oeil') ? 5 : 3
  if (carte.indice && parmi(pouvoirs, 'astrolabe')) x.garde += amelioreeParmi(pouvoirs, 'astrolabe') ? BOUCLIER_DE_L_ASTROLABE_PLUS : BOUCLIER_DE_L_ASTROLABE
  // Caméléon : changer la question, ou sa forme, lève un bouclier.
  if (CHANGENT_LA_QUESTION.has(baseDe(cle)) && parmi(pouvoirs, 'cameleon')) x.garde += amelioreeParmi(pouvoirs, 'cameleon') ? BOUCLIER_DU_CAMELEON_PLUS : BOUCLIER_DU_CAMELEON
  return x
}

/**
 * La forme où une carte repose la question : à six choix (Corser,
 * Polymorphe), en vrai ou faux (Simplifier, Miroir) — ce qu'il en faut à
 * l'aperçu d'une carte levée. Le serveur repose la vraie question de la base
 * (`questionsApresLeGeste`).
 */
export function formeApresLaCarte(cle: string, q: { forme: FormeDEscale; reponses: number }): { forme: FormeDEscale; reponses: number } {
  const forme = formeDeLaCarte(cle)
  if (forme === 'six') return { forme: 'six', reponses: 6 }
  if (forme === 'vrai-faux') return { forme: 'vrai-faux', reponses: 2 }
  return q
}

/** Ce que la question qui attend dit d'elle aux règles des cartes : jamais sa bonne réponse. */
export interface QuestionDuTour {
  reponses: number
  /** La forme où elle a été tirée — celle de l'escale, ou un vrai ou faux né tel. */
  tiree: FormeDEscale
  /** La forme où elle se pose à présent, Corser ou Simplifier passés. */
  forme: FormeDEscale
  /** Elle a deux leurres de plus : Corser s'y joue. */
  six: boolean
  /** Ses réponses sont des années ou des nombres : la Prédiction s'y joue. */
  nombre: boolean
  /** Elle se date : le Sphinx en dit le siècle. */
  datee: boolean
  categorie: string | null
}

/** Ce qu'il faut savoir pour dire si une carte se joue. */
export interface ContexteDUneCarte {
  /** La version de son départ : son coût et ses règles en dépendent (`carteALaVersion`). */
  v: number
  tour: Pick<TourDeRencontre, 'phase' | 'inspiration' | 'jouees' | 'surLaQuestion'>
  main: readonly string[]
  pouvoirs: readonly string[]
  question: QuestionDuTour | null
  fetiche?: string
  courage: number
  derniereFrappe: number
  defausse: number
}

/** Cette carte — améliorée ou non : c'est la même — est-elle déjà jouée sur la question ? */
const aJoueSurLaQuestion = (c: ContexteDUneCarte, cle: string) => parmi(c.tour.surLaQuestion, cle)

/**
 * Pourquoi cette carte ne se joue pas maintenant, en rencontre — null : elle
 * se joue. Une seule règle : le pli l'applique, le serveur la renvoie en
 * refus, la vue la porte pour chaque carte de la main, et la page n'en
 * recopie rien. Les cartes de route ont la leur, sur le plan. Un exemplaire
 * amélioré se refuse pour les mêmes raisons que sa carte — deux Cuirasse, dont
 * une améliorée, n'en font pas deux posées.
 */
export function refusDeLaCarte(c: ContexteDUneCarte, cle: string): string | null {
  const carte = carteALaVersion(cle, c.v)
  // Une carte venue après son départ ne s'y joue pas : son paquet ne l'a jamais tirée.
  if (!carte || (carte.depuis ?? 0) > c.v) return 'Cette carte ne se lit pas : recharge la page'
  if (carte.moment === 'route') return 'Elle se joue sur le plan, entre deux escales'
  if (!c.main.includes(cle)) return 'Cette carte n’est plus dans ta main : recharge la page'
  const base = baseDe(cle)
  const avant = carte.moment === 'preparation' || carte.moment === 'pouvoir'
  if (avant && c.tour.phase !== 'preparation') return 'Elle se joue avant de voir la question'
  if (carte.moment === 'reflexe' && c.tour.phase !== 'question') return 'Elle se joue pendant la question : vois-la d’abord'
  if (carte.moment === 'pouvoir' && parmi(c.pouvoirs, base)) return 'Elle agit déjà dans cette rencontre'
  // L'inspiration du code se dit « énergie » à l'écran (le 18 octobre 2026 : « l'histoire de l'inspiration n'est pas du tout claire »).
  if (carte.cout > c.tour.inspiration) return `Il lui faut ${carte.cout} d’énergie : il t’en reste ${c.tour.inspiration}`
  const q = c.question
  if (!q) return 'Elle se joue sur une question'
  const changee = c.tour.surLaQuestion.some(changeLaForme)
  const effacees = effaceesDuTour(c.tour.surLaQuestion, c.pouvoirs, q)
  switch (base) {
    case 'coup-d-oeil':
    case 'sagesse':
    case 'tout-ou-rien':
    case 'augure':
    case 'presage':
    case 'voyance':
    case 'revelation':
      if (q.reponses <= 2) return 'Pas sur un vrai ou faux : elle répondrait à ta place'
      if (effacees >= q.reponses - 2) return 'Il ne reste plus rien à effacer'
      return null
    case 'double-chance':
      if (q.reponses <= 2) return 'Pas sur un vrai ou faux : elle répondrait à ta place'
      return aJoueSurLaQuestion(c, base) ? 'Déjà jouée sur cette question' : null
    case 'enigme':
      return aJoueSurLaQuestion(c, base) ? 'Le Sphinx a déjà parlé' : null
    case 'prediction':
      if (!q.nombre || q.reponses <= 2) return 'La Prédiction se joue sur une année ou un nombre'
      return aJoueSurLaQuestion(c, base) ? 'L’Oracle a déjà parlé' : null
    case 'deux-visages':
      if (q.forme === 'devoilement') return 'Pas sur un dévoilement : deux textes à la fois, tu n’en lirais aucun'
      return aJoueSurLaQuestion(c, base) ? 'Déjà deux questions à l’écran' : null
    case 'arret-sur-image':
      if (q.forme !== 'devoilement') return 'Arrêt sur image se joue sur un dévoilement'
      return aJoueSurLaQuestion(c, base) ? 'Le texte s’est déjà arrêté' : null
    case 'plume':
      // Depuis le codex, elle se joue partout : sa catégorie fétiche ne fait que frapper plus fort (`chiffresApresLaCarte`).
      if (c.v >= VERSION_DU_CODEX) return null
      if (!c.fetiche) return 'Tu n’as pas de catégorie fétiche'
      return q.categorie === c.fetiche ? null : `La question n’est pas de ta catégorie fétiche, ${c.fetiche}`
    case 'corser':
    case 'polymorphe':
      if (changee) return 'La question a déjà changé de forme'
      if (q.tiree !== 'quatre' && q.tiree !== 'devoilement') return q.tiree === 'six' ? 'Elle est déjà à six choix' : 'Pas sur un vrai ou faux'
      return q.six ? null : 'Cette question n’a pas de quoi tenir six choix'
    case 'simplifier':
    case 'miroir':
      if (changee) return 'La question a déjà changé de forme'
      // La forme du tirage, jamais celle d'à présent : rejouée, la question déjà simplifiée refuserait Simplifier qui l'a faite.
      return q.tiree === 'vrai-faux' ? 'Elle est déjà un vrai ou faux' : null
    case 'doubler-la-mise':
    case 'quitte-ou-double':
    case 'banco':
    case 'contre-attaque':
    case 'sursis':
    case 'assurance':
      return parmi(c.tour.jouees, base) ? 'Déjà jouée à cette question' : null
    case 'panacee':
    case 'second-souffle':
      return c.courage >= COURAGE_MAX ? 'Ton courage est au plus haut' : null
    case 'lucidite':
      if (c.v >= VERSION_DU_CODEX) return null
      return effacees > 0 ? null : 'Aucune réponse effacée sur cette question'
    case 'horizon':
      return c.derniereFrappe > 0 ? null : 'Il se joue juste après une erreur qui t’a coûté du courage'
    case 'feu-d-artifice':
      return c.defausse > 0 ? null : 'Ta défausse est vide'
    case 'abysses':
      return c.courage > COUT_DES_ABYSSES ? null : `Il te faut plus de ${COUT_DES_ABYSSES} de courage pour le poser`
    default:
      return null
  }
}

/** Ce que la page annonce de la question qui vient, avant de la voir : jamais sa bonne réponse, ni son texte. */
export interface AnnonceDuTour {
  categorie: string | null
  niveau: Niveau
  /** Sa forme à présent — celle de l'escale, ou ce que Corser et Simplifier en ont fait. */
  forme: FormeDEscale
  /**
   * Combien de réponses elle propose, et les mots d'un dévoilement : la page
   * refait l'aperçu à la mise qu'il choisit (`apercuDuTour`), sans recopier
   * une règle. Ni l'un ni l'autre ne dit la question : la vue de la question
   * les porte aussi.
   */
  reponses: number
  mots?: number
  /** Ses réponses sont des années, ou des nombres. */
  reponseEn?: 'annee' | 'nombre'
  /** Sa chance de la trouver, à sa forme — sans elle sous L'écholocation. */
  chance?: number
  /** Ce que brise une bonne réponse, avant Charge et forme : son savoir. */
  savoir: number
}

/** L'aperçu du verdict, au-dessus du bouton : ce qu'une bonne réponse briserait, ce qu'une erreur coûterait. */
export interface ApercuDuTour {
  juste: {
    brises: number
    /** Un dévoilement : ce qu'elle brise au premier mot ; `brises`, au dernier. */
    auPremierMot?: number
    /** Il tombe. */
    tombe: boolean
    /** Ce que rapporte la mise. */
    ecus: number
    /** Les écus de ses cartes, à part de son pari : Pourboire, Cagnotte, Rafle (le jeu complet) — absent sans. */
    ecusDesCartes?: number
    /** Le courage qu'il reprendrait : Pansement (le jeu complet) — absent sans. */
    courage?: number
  }
  faux: {
    frappe: number
    absorbee: number
    perdu: number
    /** Ce que coûte la mise. */
    ecus: number
    /** Contre-attaque : ce qu'elle briserait. */
    contre: number
    /** Sa Charge retombe. */
    charge: boolean
  }
}

/**
 * Ce que la Bibliothèque posée ajoute à une bonne réponse : 3 sur sa
 * catégorie fétiche ; depuis le codex, 1 sur toutes les autres. Le verdict
 * (`pliDeLExpedition`) et l'aperçu la lisent tous deux ici.
 */
export function enPlusDeLaBibliotheque(o: { v: number; pouvoirs: readonly string[]; fetiche?: string; categorie?: string | null }): number {
  if (!parmi(o.pouvoirs, 'bibliotheque')) return 0
  const plus = amelioreeParmi(o.pouvoirs, 'bibliotheque')
  if (o.fetiche && o.categorie === o.fetiche) return plus ? 5 : 3
  return o.v >= VERSION_DU_CODEX ? (plus ? 2 : 1) : 0
}

/**
 * Ce que les pouvoirs posés ajoutent à une bonne réponse, avant sa forme : la
 * Bibliothèque (`enPlusDeLaBibliotheque`) et, depuis le jeu complet,
 * l'Encyclopédie — `ENCYCLOPEDIE_PAR_JUSTE` par bonne réponse déjà donnée
 * dans la rencontre —, le Prisme — `PRISME_PAR_JUSTE`, `PRISME_A_SIX_CHOIX` à
 * six choix —, le Rythme — 1 par bonne réponse de sa série, celle-ci
 * comprise. Le verdict (`pliDeLExpedition`) et l'aperçu la lisent tous deux
 * ici.
 */
export function enPlusDesPouvoirs(o: {
  v: number
  pouvoirs: readonly string[]
  fetiche?: string
  categorie?: string | null
  /** Ses bonnes réponses déjà données dans la rencontre. */
  trouvees?: number
  /** Sa série avant cette réponse. */
  serie?: number
  forme?: FormeDEscale
}): number {
  let n = enPlusDeLaBibliotheque(o)
  if (parmi(o.pouvoirs, 'encyclopedie')) n += (amelioreeParmi(o.pouvoirs, 'encyclopedie') ? ENCYCLOPEDIE_PAR_JUSTE_PLUS : ENCYCLOPEDIE_PAR_JUSTE) * (o.trouvees ?? 0)
  if (parmi(o.pouvoirs, 'prisme')) {
    const plus = amelioreeParmi(o.pouvoirs, 'prisme')
    n += o.forme === 'six' ? (plus ? PRISME_A_SIX_CHOIX_PLUS : PRISME_A_SIX_CHOIX) : plus ? PRISME_PAR_JUSTE_PLUS : PRISME_PAR_JUSTE
  }
  if (parmi(o.pouvoirs, 'rythme')) n += (o.serie ?? 0) + 1
  return n
}

/**
 * Ce qui s'ajoute à une bonne réponse après sa forme : Banco — 1 par tranche
 * de cinq écus pariés — et, depuis le jeu complet, Pactole — ce que le pari
 * rapporte. Doublé, avec le reste, par Quitte ou double.
 */
export const enPlusApresLaForme = (t: Pick<TourDeRencontre, 'mise' | 'jouees'>, pouvoirs: readonly string[]) =>
  (parmi(t.jouees, 'banco') ? Math.floor(enJeu(t) / 5) : 0) + (parmi(pouvoirs, 'pactole') && enJeu(t) > 0 ? gainDeLaMise(t, pouvoirs) : 0)

/** L'aperçu d'un tour, avec ce que ses cartes y ont fait : la même règle que le verdict. */
export function apercuDuTour(o: {
  /** La version de son départ (`enPlusDeLaBibliotheque`). */
  v: number
  tour: Pick<TourDeRencontre, 'charge' | 'garde' | 'mise' | 'jouees'> & Partial<Pick<TourDeRencontre, 'surLaQuestion'>>
  pouvoirs: readonly string[]
  sceaux: number
  frappe: number
  savoir: number
  question: { reponses: number; forme: FormeDEscale; categorie: string | null }
  fetiche?: string
  /** Un dévoilement : ses mots. */
  mots?: number
  /** Ses bonnes réponses déjà données dans la rencontre, et sa série : l'Encyclopédie et le Rythme en frappent (le jeu complet). */
  trouvees?: number
  serie?: number
}): ApercuDuTour {
  const t = o.tour
  const mise = enJeu(t)
  const enPlus = enPlusDesPouvoirs({ v: o.v, pouvoirs: o.pouvoirs, fetiche: o.fetiche, categorie: o.question.categorie, trouvees: o.trouvees, serie: o.serie, forme: o.question.forme })
  const cartes = { pouvoirs: o.pouvoirs, surLaQuestion: t.surLaQuestion ?? [] }
  const brises = (multiplicateur: number) =>
    brisesDUneBonneReponse({ savoir: o.savoir, charge: t.charge, enPlus, multiplicateur, banco: enPlusApresLaForme(t, o.pouvoirs), double: t.jouees.includes('quitte-ou-double') })
  const devoilement = o.question.forme === 'devoilement' && (o.mots ?? 0) > 1
  const auDernier = brises(multiplicateurDeLaForme({ reponses: o.question.reponses, forme: devoilement ? 'quatre' : o.question.forme }, cartes))
  const auPremier = devoilement ? brises(multiplicateurDeLaForme({ reponses: o.question.reponses, forme: 'devoilement', devoile: { mots: 1, sur: o.mots! } }, cartes)) : undefined
  const f = frappeDUneErreur({
    frappe: o.frappe + frappeEnPlus(t.jouees),
    sauve: parmi(t.jouees, 'sursis') || t.jouees.includes('mue'),
    double: t.jouees.includes('tout-ou-rien') || t.jouees.includes('quitte-ou-double'),
    garde: t.garde,
  })
  const plus = siJuste(t.jouees)
  return {
    juste: {
      brises: auDernier,
      ...(auPremier !== undefined && { auPremierMot: auPremier }),
      tombe: Math.max(auDernier, auPremier ?? 0) >= o.sceaux,
      ecus: mise > 0 ? gainDeLaMise(t, o.pouvoirs) : 0,
      ...(plus.ecus > 0 && { ecusDesCartes: plus.ecus }),
      ...(plus.courage > 0 && { courage: plus.courage }),
    },
    faux: { ...f, ecus: pariPerdu(t), contre: riposte(f.absorbee, t.jouees, o.pouvoirs), charge: t.charge > 0 },
  }
}

/** La rencontre telle que la page la reçoit (v5). */
export interface VueDeLaRencontre {
  /** La version de son départ : les cartes se lisent à ses chiffres (`carteALaVersion`), l'aperçu d'une carte levée aussi. */
  v: number
  sorte: SorteDeRencontre
  adversaire: string
  /** Sa catégorie — son emblème —, ou le thème pointu de l'escale. */
  categorie?: string
  sujet?: string
  sceaux: number
  max: number
  /** Ce qu'il frappe à la prochaine erreur, la Garde pas encore comptée. */
  frappe: number
  questions: number
  serie: number
  /** Ses bonnes réponses dans la rencontre : l'Encyclopédie en frappe (le jeu complet), l'aperçu d'une carte levée la compte. */
  trouvees: number
  /** Les écus qu'il a : Fortune en frappe (le jeu complet), l'aperçu d'une carte levée les lit. */
  ecus: number
  phase: 'preparation' | 'question'
  /**
   * Le rang de la question qui attend : en préparation, elle ne part pas
   * (invariant 1), mais les cartes et la mise la visent quand même — un
   * geste dit ce qu'il visait (invariant 12).
   */
  position?: number
  inspiration: number
  charge: number
  garde: number
  mise: number
  jouees: string[]
  /** Celles qui visent la question : Miroir et Polymorphe y changent ce que vaut sa forme (le jeu complet). */
  surLaQuestion: string[]
  pouvoirs: string[]
  main: string[]
  /** Combien de cartes attendent dans la pioche : leur ordre est le hasard du serveur. */
  pioche: number
  defausse: string[]
  epuisees: string[]
  /** Pour chaque carte de la main, pourquoi elle ne se joue pas maintenant — null : elle se joue (`refusDeLaCarte`). */
  refus: Record<string, string | null>
  /** En préparation, pour chaque mise, pourquoi elle ne se fait pas — null : elle se fait (`refusDeLaMise`). */
  mises?: Record<number, string | null>
  /** Le pari n'est pas encore ouvert à son niveau d'explorateur (le codex, v7) : la page ne le propose pas. */
  pari?: false
  /** La question sous les yeux, les réponses que les cartes du tour y ont effacées : Lucidité en frappe plus fort. */
  effacees?: number
  annonce?: AnnonceDuTour
  apercu?: ApercuDuTour
}
