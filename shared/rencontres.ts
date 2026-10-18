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
// Un prototype, en préproduction seulement (`RENCONTRES_EN_PRODUCTION`) : ses
// chiffres sont des ordres de grandeur, que le calibrage et une semaine de jeu
// fixeront (`server/scripts/calibrage-rencontres.ts`).

import type { Niveau } from './campagne'
import type { FormeDEscale, ThemeDEscale } from './expedition'
import { EFFACE } from './jokers'
import { hasardDe } from './missions'

/**
 * Les rencontres partent hors de la production seulement : la préproduction,
 * `npm run dev` et les tests les jouent ; en production, une expédition part
 * toujours aux règles d'avant (la version 4). Passé à `true`, le départ les
 * propose partout.
 */
export const RENCONTRES_EN_PRODUCTION = false

// ── Les règles chiffrées : des choix de produit (`docs/reference/baremes.md`) ──

/** Le courage, au départ et au plus : ce qui remplace les trois vies. */
export const COURAGE_MAX = 50
/** L'inspiration de chaque question : de quoi jouer deux ou trois cartes. L'écran l'appelle « énergie », le mot de tous les jeux. */
export const INSPIRATION_PAR_QUESTION = 3
/** Les cartes tirées à chaque question ; ce qu'il n'en joue pas part à la défausse. */
export const CARTES_PAR_QUESTION = 5
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

/** Une offre de cartes : trois, une à prendre ; chaque carte tirée de l'une de ses deux familles, `PART_D_UNE_FAMILLE` chacune, sinon des neutres. */
export const CARTES_PAR_OFFRE = 3
export const PART_D_UNE_FAMILLE = 0.4
/** Les raretés d'une offre : après une rencontre, et — rare plus souvent — après une élite, dans un coffre ou à l'échoppe. */
export const RARETES_D_UNE_RENCONTRE: Readonly<Record<'commun' | 'rare' | 'maudit', number>> = { commun: 0.6, rare: 0.3, maudit: 0.1 }
export const RARETES_D_UNE_ELITE: Readonly<Record<'commun' | 'rare' | 'maudit', number>> = { commun: 0.3, rare: 0.6, maudit: 0.1 }

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
  rarete: 'commun' | 'rare' | 'maudit' | 'legendaire'
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
  /** Jouée, elle quitte la rencontre ; elle revient à la suivante. */
  epuisement?: true
  /** Un indice : la réponse qu'elle aide ne mesure rien de son savoir (`JOKERS_QUI_AIDENT`). */
  indice?: true
  maudit?: true
  /** Le légendaire qui la donne (`lg:phenix`). */
  legendaire?: string
}

/** Le paquet de tous, et les neutres que les offres proposent. */
const NEUTRES: readonly CarteDeRencontre[] = [
  { cle: 'concentration', nom: 'Concentration', cout: 1, moment: 'preparation', famille: 'neutre', rarete: 'commun', effet: 'Si tu réponds juste, l’adversaire perd 4 de plus.', resume: '+4 si juste' },
  { cle: 'prudence', nom: 'Prudence', cout: 1, moment: 'preparation', famille: 'neutre', rarete: 'commun', effet: 'Bouclier 5 : si tu te trompes, il pare 5 de l’attaque.', resume: 'Bouclier 5' },
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
  { cle: 'pioche', nom: 'La pioche', cout: 0, moment: 'preparation', famille: 'neutre', rarete: 'commun', epuisement: true, effet: 'Tire deux cartes de plus.', resume: '+2 cartes' },
  {
    cle: 'arret-sur-image',
    nom: 'Arrêt sur image',
    cout: 1,
    moment: 'reflexe',
    famille: 'neutre',
    rarete: 'commun',
    effet: 'Sur une question mot à mot : le texte s’arrête cinq secondes, et ton gain avec lui.',
    resume: 'Pause 5 s',
  },
  { cle: 'detour', nom: 'Le détour', cout: 0, moment: 'route', famille: 'neutre', rarete: 'commun', effet: 'Ton pas suivant peut aller à n’importe quelle escale de l’étage du dessus.', resume: 'Va où tu veux' },
  {
    cle: 'double-chance',
    nom: 'Double chance',
    cout: 2,
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
    effet: 'Si la question est de ta catégorie fétiche et que tu réponds juste, l’adversaire perd 5 de plus.',
    resume: '+5 si fétiche',
  },
  {
    cle: 'bibliotheque',
    nom: 'Bibliothèque',
    cout: 1,
    moment: 'pouvoir',
    famille: 'erudit',
    rarete: 'rare',
    effet: 'Pour toute la rencontre : tes bonnes réponses de ta catégorie fétiche lui font perdre 3 de plus.',
    resume: 'Fétiche +3',
  },
  { cle: 'doubler-la-mise', nom: 'Doubler la mise', cout: 0, moment: 'preparation', famille: 'flambeur', rarete: 'commun', effet: 'Ton pari compte double, gain comme perte.', resume: 'Pari ×2' },
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
    cle: 'corser',
    nom: 'Corser',
    cout: 1,
    moment: 'preparation',
    famille: 'metamorphe',
    rarete: 'commun',
    effet: 'La question passe à six choix : plus dure, mais l’adversaire perd une fois et demie plus.',
    resume: '6 choix ×1,5',
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
  { cle: 'echauffement', nom: 'Échauffement', cout: 0, moment: 'preparation', famille: 'elan', rarete: 'commun', effet: 'Ajoute 1 à ta série de bonnes réponses d’affilée.', resume: 'Série +1' },
  {
    cle: 'lancee',
    nom: 'Lancée',
    cout: 1,
    moment: 'preparation',
    famille: 'elan',
    rarete: 'commun',
    effet: 'Si tu réponds juste, l’adversaire perd 2 de plus par bonne réponse de ta série.',
    resume: '+2 par série',
  },
  { cle: 'parade', nom: 'Parade', cout: 2, moment: 'reflexe', famille: 'rempart', rarete: 'commun', effet: 'Bouclier 6, une fois la question vue : si tu te trompes, il pare 6 de l’attaque.', resume: 'Bouclier 6' },
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
    cle: 'lucidite',
    nom: 'Lucidité',
    cout: 1,
    moment: 'reflexe',
    famille: 'devin',
    rarete: 'commun',
    effet: 'Si une réponse est effacée et que tu réponds juste, l’adversaire perd 5 de plus.',
    resume: '+5 si effacée',
  },
  {
    cle: 'troisieme-oeil',
    nom: 'Troisième œil',
    cout: 2,
    moment: 'pouvoir',
    famille: 'devin',
    rarete: 'rare',
    effet: 'Pour toute la rencontre : chaque indice que tu joues lui fait perdre 3 de plus, si tu réponds juste.',
    resume: 'Indices +3',
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
  },
  { cle: 'reveil', nom: 'Le réveil', legendaire: 'lg:coq', cout: 0, moment: 'preparation', famille: 'elan', rarete: 'legendaire', epuisement: true, effet: '+2 d’énergie pour cette question.', resume: '+2 énergie' },
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
  { cle: 'tresor', nom: 'Le trésor', legendaire: 'lg:dragon', cout: 1, moment: 'pouvoir', famille: 'flambeur', rarete: 'legendaire', effet: 'Pour toute la rencontre : tes paris gagnés rapportent triple.', resume: 'Pari gagné ×3' },
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
  },
  {
    cle: 'lanterne',
    nom: 'La lanterne',
    legendaire: 'lg:citrouille',
    cout: 0,
    moment: 'route',
    famille: 'devin',
    rarete: 'legendaire',
    effet: 'Les pièges de l’inconnu se montrent sur la carte, jusqu’au bout de l’acte.',
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

/** Tout le catalogue des rencontres. */
export const CARTES_DES_RENCONTRES: readonly CarteDeRencontre[] = [...NEUTRES, ...DES_FAMILLES, ...DES_LEGENDAIRES]

const PAR_CLE = new Map(CARTES_DES_RENCONTRES.map(c => [c.cle, c]))

/** Une carte par sa clé ; undefined : elle n'est pas du catalogue des rencontres. */
export function carteDeRencontre(cle: unknown): CarteDeRencontre | undefined {
  return typeof cle === 'string' ? PAR_CLE.get(cle) : undefined
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

export function paquetDesRencontres(equipee: readonly string[]): string[] {
  return [...PAQUET_DES_RENCONTRES, ...equipee.flatMap(cle => carteDuLegendaire(cle)?.cle ?? [])].sort()
}

/** Le nom et la devise de chaque famille, ce que la page en dit. */
export const FAMILLES_DE_CARTES: Readonly<Record<FamilleDeCartes, { nom: string; devise: string }>> = {
  erudit: { nom: 'L’Érudit', devise: 'Je connais mon rayon' },
  flambeur: { nom: 'Le Flambeur', devise: 'Je parie sur moi' },
  metamorphe: { nom: 'Le Métamorphe', devise: 'Je change la question' },
  elan: { nom: 'L’Élan', devise: 'Je ne m’arrête plus' },
  rempart: { nom: 'Le Rempart', devise: 'Je tiens bon' },
  devin: { nom: 'Le Devin', devise: 'Je lis les signes' },
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

/** Ce que les offres proposent hors des familles : les neutres, sans Concentration ni Prudence — comme Slay the Spire ne propose pas ses frappes de base. */
const NEUTRES_DES_OFFRES = NEUTRES.filter(c => c.cle !== 'concentration' && c.cle !== 'prudence').map(c => c.cle)

/**
 * Une offre de cartes — après une rencontre, une élite, dans un coffre, à
 * l'échoppe : trois cartes distinctes, chacune tirée d'une famille de son
 * équipée (`PART_D_UNE_FAMILLE` chacune), sinon des neutres, à une rareté
 * tirée à ses poids. Du hasard de la graine et du rang de l'offre : recharger
 * ne la change pas. Une famille ou une rareté qui n'a plus rien à proposer
 * cède la place aux neutres.
 */
export function offreDeCartes(graine: string, rang: number, familles: readonly FamilleDeCartes[], poids: Readonly<Record<'commun' | 'rare' | 'maudit', number>> = RARETES_D_UNE_RENCONTRE): string[] {
  const r = hasardDe(`${graine}:offre:${rang}`)
  const prises: string[] = []
  const raretes = Object.entries(poids) as ['commun' | 'rare' | 'maudit', number][]
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
    const tas = famille ? DES_FAMILLES.filter(c => c.famille === famille).map(c => c.cle) : NEUTRES_DES_OFFRES
    const libres = tas.filter(cle => !prises.includes(cle))
    const aSaRarete = libres.filter(cle => PAR_CLE.get(cle)?.rarete === rarete)
    const candidates = aSaRarete.length > 0 ? aSaRarete : libres.length > 0 ? libres : NEUTRES_DES_OFFRES.filter(cle => !prises.includes(cle))
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
  /** Ce que le tour suivant reçoit de plus : L'élan, Peau de feu. */
  suivant: { cartes: number; inspiration: number; charge: number }
  /** Ce que la dernière erreur lui a coûté de courage : L'horizon le rend. */
  derniereFrappe: number
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

/** La forme multiplie ce que brise une bonne réponse : ×0,5 en vrai ou faux, ×1,5 à six choix, de ×3 à ×1 au dévoilement selon le mot. */
export function multiplicateurDeLaForme(q: FormeDUneQuestion): number {
  if ((q.reponses ?? 4) <= 2) return MULTIPLICATEUR_DU_VRAI_OU_FAUX
  if (q.forme === 'six') return MULTIPLICATEUR_DU_SIX_CHOIX
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
export const enJeu = (t: Pick<TourDeRencontre, 'mise' | 'jouees'>) => t.mise * (t.jouees.includes('doubler-la-mise') ? 2 : 1)

/** Ce qu'une mise gagnée rapporte, net : la moitié de ce qu'elle engage — triple sous Le trésor, triple sous Quitte ou double, cinq fois sous les deux. */
export const gainDeLaMise = (t: Pick<TourDeRencontre, 'mise' | 'jouees'>, pouvoirs: readonly string[]) =>
  Math.round(enJeu(t) * PART_GAGNEE_D_UNE_MISE) * (1 + (pouvoirs.includes('tresor') ? 2 : 0) + (t.jouees.includes('quitte-ou-double') ? 2 : 0))

/** Les réponses qu'effacent les cartes du tour et L'écholocation — jamais plus que deux de moins que ses réponses : sinon la carte répondrait à sa place. */
export function effaceesDuTour(surLaQuestion: readonly string[], pouvoirs: readonly string[], q: { reponses: number; datee?: boolean }): number {
  if (q.reponses <= 2) return 0
  let n = 0
  for (const cle of surLaQuestion) n += EFFACE[cle] ?? 0
  // Le Sphinx d'une question qui ne se date pas efface au lieu de souffler : sinon, la carte ne servait à rien.
  if (surLaQuestion.includes('enigme') && !q.datee) n += 1
  if (pouvoirs.includes('echolocation')) n += EFFACE.echolocation ?? 1
  return Math.min(n, q.reponses - 2)
}

/** Les chiffres d'un tour qu'une carte change : ce qu'il lui reste d'inspiration, sa Charge, sa Garde, sa série. */
export interface ChiffresDuTour {
  inspiration: number
  charge: number
  garde: number
  serie: number
}

/**
 * Ce qu'une carte jouée fait aux chiffres du tour — l'inspiration qu'elle
 * coûte, la Charge, la Garde, la série : la seule règle, que le pli applique
 * (`pliDeLExpedition`) et que la page relit, carte levée, pour dire ce
 * qu'elle changerait avant qu'on la joue (« je veux que ce soit bien
 * compréhensible pour des novices », le 18 octobre 2026). Ce qu'elle fait
 * d'autre — tirer des cartes, changer de question, la reposer à une autre
 * forme —, le pli seul le fait.
 */
export function chiffresApresLaCarte(cle: string, avant: ChiffresDuTour, pouvoirs: readonly string[]): ChiffresDuTour {
  const carte = carteDeRencontre(cle)
  if (!carte) return { ...avant }
  const x = { ...avant, inspiration: avant.inspiration - carte.cout }
  switch (cle) {
    case 'concentration':
      x.charge += 4
      break
    case 'prudence':
      x.garde += 5
      break
    case 'peau-de-feu':
      x.garde += 8
      break
    case 'parade':
      x.garde += 6
      break
    case 'simplifier':
      x.garde += 3
      break
    case 'plume':
    case 'lucidite':
      x.charge += 5
      break
    case 'lancee':
      x.charge += 2 * avant.serie
      break
    case 'echauffement':
      x.serie += 1
      break
    case 'reveil':
      x.inspiration += 2
      break
  }
  // Troisième œil : chaque indice frappe aussi.
  if (carte.indice && pouvoirs.includes('troisieme-oeil')) x.charge += 3
  return x
}

/**
 * La forme où une carte repose la question : Corser à six choix, Simplifier
 * en vrai ou faux — ce qu'il en faut à l'aperçu d'une carte levée. Le serveur
 * repose la vraie question de la base (`questionsApresLeGeste`).
 */
export function formeApresLaCarte(cle: string, q: { forme: FormeDEscale; reponses: number }): { forme: FormeDEscale; reponses: number } {
  if (cle === 'corser') return { forme: 'six', reponses: 6 }
  if (cle === 'simplifier') return { forme: 'vrai-faux', reponses: 2 }
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
  tour: Pick<TourDeRencontre, 'phase' | 'inspiration' | 'jouees' | 'surLaQuestion'>
  main: readonly string[]
  pouvoirs: readonly string[]
  question: QuestionDuTour | null
  fetiche?: string
  courage: number
  derniereFrappe: number
  defausse: number
}

const aJoueSurLaQuestion = (c: ContexteDUneCarte, cle: string) => c.tour.surLaQuestion.includes(cle)

/**
 * Pourquoi cette carte ne se joue pas maintenant, en rencontre — null : elle
 * se joue. Une seule règle : le pli l'applique, le serveur la renvoie en
 * refus, la vue la porte pour chaque carte de la main, et la page n'en
 * recopie rien. Les cartes de route ont la leur, sur la carte.
 */
export function refusDeLaCarte(c: ContexteDUneCarte, cle: string): string | null {
  const carte = carteDeRencontre(cle)
  if (!carte) return 'Cette carte ne se lit pas : recharge la page'
  if (carte.moment === 'route') return 'Elle se joue sur la carte, entre deux escales'
  if (!c.main.includes(cle)) return 'Cette carte n’est plus dans ta main : recharge la page'
  const avant = carte.moment === 'preparation' || carte.moment === 'pouvoir'
  if (avant && c.tour.phase !== 'preparation') return 'Elle se joue avant de voir la question'
  if (carte.moment === 'reflexe' && c.tour.phase !== 'question') return 'Elle se joue pendant la question : vois-la d’abord'
  if (carte.moment === 'pouvoir' && c.pouvoirs.includes(cle)) return 'Elle agit déjà dans cette rencontre'
  // L'inspiration du code se dit « énergie » à l'écran (le 18 octobre 2026 : « l'histoire de l'inspiration n'est pas du tout claire »).
  if (carte.cout > c.tour.inspiration) return `Il lui faut ${carte.cout} d’énergie : il t’en reste ${c.tour.inspiration}`
  const q = c.question
  if (!q) return 'Elle se joue sur une question'
  const changee = aJoueSurLaQuestion(c, 'corser') || aJoueSurLaQuestion(c, 'simplifier')
  const effacees = effaceesDuTour(c.tour.surLaQuestion, c.pouvoirs, q)
  switch (cle) {
    case 'coup-d-oeil':
    case 'sagesse':
    case 'tout-ou-rien':
      if (q.reponses <= 2) return 'Pas sur un vrai ou faux : elle répondrait à ta place'
      if (effacees >= q.reponses - 2) return 'Il ne reste plus rien à effacer'
      return null
    case 'double-chance':
      if (q.reponses <= 2) return 'Pas sur un vrai ou faux : elle répondrait à ta place'
      return aJoueSurLaQuestion(c, cle) ? 'Déjà jouée sur cette question' : null
    case 'enigme':
      return aJoueSurLaQuestion(c, cle) ? 'Le Sphinx a déjà parlé' : null
    case 'prediction':
      if (!q.nombre || q.reponses <= 2) return 'La Prédiction se joue sur une année ou un nombre'
      return aJoueSurLaQuestion(c, cle) ? 'L’Oracle a déjà parlé' : null
    case 'deux-visages':
      if (q.forme === 'devoilement') return 'Pas sur un dévoilement : deux textes à la fois, tu n’en lirais aucun'
      return aJoueSurLaQuestion(c, cle) ? 'Déjà deux questions à l’écran' : null
    case 'arret-sur-image':
      if (q.forme !== 'devoilement') return 'Arrêt sur image se joue sur un dévoilement'
      return aJoueSurLaQuestion(c, cle) ? 'Le texte s’est déjà arrêté' : null
    case 'plume':
      if (!c.fetiche) return 'Tu n’as pas de catégorie fétiche'
      return q.categorie === c.fetiche ? null : `La question n’est pas de ta catégorie fétiche, ${c.fetiche}`
    case 'corser':
      if (changee) return 'La question a déjà changé de forme'
      if (q.tiree !== 'quatre' && q.tiree !== 'devoilement') return q.tiree === 'six' ? 'Elle est déjà à six choix' : 'Pas sur un vrai ou faux'
      return q.six ? null : 'Cette question n’a pas de quoi tenir six choix'
    case 'simplifier':
      if (changee) return 'La question a déjà changé de forme'
      // La forme du tirage, jamais celle d'à présent : rejouée, la question déjà simplifiée refuserait Simplifier qui l'a faite.
      return q.tiree === 'vrai-faux' ? 'Elle est déjà un vrai ou faux' : null
    case 'doubler-la-mise':
    case 'quitte-ou-double':
    case 'banco':
    case 'contre-attaque':
    case 'sursis':
      return c.tour.jouees.includes(cle) ? 'Déjà jouée à cette question' : null
    case 'lucidite':
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

/** L'aperçu d'un tour, avec ce que ses cartes y ont fait : la même règle que le verdict. */
export function apercuDuTour(o: {
  tour: Pick<TourDeRencontre, 'charge' | 'garde' | 'mise' | 'jouees'>
  pouvoirs: readonly string[]
  sceaux: number
  frappe: number
  savoir: number
  question: { reponses: number; forme: FormeDEscale; categorie: string | null }
  fetiche?: string
  /** Un dévoilement : ses mots. */
  mots?: number
}): ApercuDuTour {
  const t = o.tour
  const mise = enJeu(t)
  const enPlus = o.pouvoirs.includes('bibliotheque') && o.fetiche && o.question.categorie === o.fetiche ? 3 : 0
  const brises = (multiplicateur: number) =>
    brisesDUneBonneReponse({ savoir: o.savoir, charge: t.charge, enPlus, multiplicateur, banco: t.jouees.includes('banco') ? Math.floor(mise / 5) : 0, double: t.jouees.includes('quitte-ou-double') })
  const devoilement = o.question.forme === 'devoilement' && (o.mots ?? 0) > 1
  const auDernier = brises(multiplicateurDeLaForme({ reponses: o.question.reponses, forme: devoilement ? 'quatre' : o.question.forme }))
  const auPremier = devoilement ? brises(multiplicateurDeLaForme({ reponses: o.question.reponses, forme: 'devoilement', devoile: { mots: 1, sur: o.mots! } })) : undefined
  const f = frappeDUneErreur({
    frappe: o.frappe,
    sauve: t.jouees.includes('sursis') || t.jouees.includes('mue'),
    double: t.jouees.includes('tout-ou-rien') || t.jouees.includes('quitte-ou-double'),
    garde: t.garde,
  })
  return {
    juste: { brises: auDernier, ...(auPremier !== undefined && { auPremierMot: auPremier }), tombe: Math.max(auDernier, auPremier ?? 0) >= o.sceaux, ecus: mise > 0 ? gainDeLaMise(t, o.pouvoirs) : 0 },
    faux: { ...f, ecus: mise, contre: t.jouees.includes('contre-attaque') ? f.absorbee : 0, charge: t.charge > 0 },
  }
}

/** La rencontre telle que la page la reçoit (v5). */
export interface VueDeLaRencontre {
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
  annonce?: AnnonceDuTour
  apercu?: ApercuDuTour
}
