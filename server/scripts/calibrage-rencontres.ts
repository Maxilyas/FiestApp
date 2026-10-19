// Le calibrage du prototype des rencontres (`shared/rencontres.ts`, la version
// 5 du départ) : la cible de l'expédition ne change pas — le joueur moyen au
// bout une fois sur trois, le fort huit fois sur dix (le brief du 17 octobre
// 2026) —, et le propriétaire a demandé, le 18 octobre 2026, de mesurer ce
// que dure une expédition à six étages avant de toucher au nombre d'étages.
// Mesurée sur le vrai code : le vrai générateur de cartes, le vrai pli, les
// vraies règles des cartes (`refusDuJoker`), joués par les joueurs inventés de
// `calibrage-expedition.ts` — le moyen trouve ce que trouve le calibrage
// (`TAUX_DU_CALIBRAGE`), le faible et le fort sont décalés d'un logit, chacun
// a ses catégories et ses sujets forts et faibles.
//
// Sa politique, simple — pas la meilleure : avant de voir la question, il lit
// sa chance dans l'annonce. Bonne, il attaque — la Charge, Corser, Quitte ou
// double, Banco — et mise ; mauvaise, il se garde — Prudence, Sursis,
// Contre-attaque — et ne mise rien, ou Simplifier. Il pose ses pouvoirs dès
// qu'il les tire. La question vue, s'il ne la sait pas, il joue ce qui l'aide
// — Coup d'œil, Double chance, l'Énigme, Deux visages, Échange —, et devine
// parmi ce qui reste. Il prend dans les offres d'après une préférence fixe,
// campe ou achète du courage s'il lui en manque, sinon retire une carte de
// base, et suit sur la carte l'escale la plus sûre, comme la page la lui
// conseille.
//
// Depuis le codex (la version 7, le 18 octobre 2026), il se mesure niveau par
// niveau d'explorateur : ses offres ne tirent que les cartes que son niveau a
// ouvertes, le pari, les talismans et la catégorie fétiche attendent le leur,
// l'invité du jour prête sa carte et les légendaires qu'il a gardés ouvrent la
// leur au trésor d'un gardien ; puis la carrière, du niveau 1, expédition
// après expédition. Le joueur a appris : il ne prend que ce qui vaut, deux
// fois au plus (`PREFERENCE_DU_CODEX`). Mesuré le même soir, aux cartes
// retouchées : le moyen va au bout 43 fois sur cent au niveau 1, 47 au 3, 61
// au 6 avec deux légendaires, 51 au 10 avec quatre ; le codex entier en
// treize expéditions. La proposition visait 15 % au niveau 1 : les cartes
// seules n'y mènent pas — l'issue tient à ce qu'il sait —, il faudrait durcir
// les adversaires des premiers niveaux, ce qu'on attend d'une semaine de jeu.
//
// Les exploits (le même soir) : la carrière dit quand chacun tombe. Au premier
// réglage — un adversaire ordinaire d'une seule réponse, n'importe quel
// gardien sans perdre de courage, dix d'affilée —, le moyen les faisait tous
// à sa première expédition ; réglés — une élite, le gardien de l'acte 3,
// vingt d'affilée —, il fait chacun six fois sur dix en vingt expéditions, le
// fort presque toujours, le faible une ou deux fois sur dix ; le gros pari
// tombe à la deuxième ou la troisième pour tous, dès que le pari s'ouvre.
//
// L'Ascension (le 19 octobre 2026) : `--ascension 3` joue chaque cas au cran
// 3 ; `--ascensions` mesure, au codex entier, chaque cran l'un après l'autre —
// ce que chacun retire au fort, pour qui elle est faite. Mesurée le même jour
// (trois cents expéditions par case) : le fort va au bout 93 fois sur cent
// sans cran, puis 88, 80, 75, 65 et 43 ; le moyen 56, puis 39, 23, 15, 7 et
// 0. Aux premiers chiffres — 4 points, 2 de frappe, partir avec 40 de
// courage —, les crans 1, 2 et 4 ne retiraient au fort que 1 à 4 points ;
// partir avec 30 ne lui en retirait aucun — le campement et la source le
// remontaient avant qu'il en manque : une énergie de moins, si.
//
// Le jeu complet (la version 8, le 19 octobre 2026) : quarante-deux cartes
// de plus, et deux d'énergie à l'acte 1. Chaque carte s'est mesurée seule
// (`--cartes`) : Représailles, entière pour une d'énergie, menait le moyen au
// bout 91 fois sur cent contre 56 sans rien prendre ; la plupart des cartes à
// deux d'énergie ne valaient pas Concentration et Prudence ensemble. Retouchées
// — et le joueur qui prend désormais l'attaque qui frappe le plus par point
// d'énergie, plutôt que dans un ordre fixe —, de Représailles, +14, à −6 au
// plus bas, les neuves restent dans le bruit de la mesure, à ±5. Puis,
// six cents expéditions par case, contre la version 7 au même joueur : le
// moyen va au bout 47 fois sur cent au niveau 1 (42), 66 au 3 (53), 75 au 6
// (67), 70 au 10 (57) ; le fort 95 à 98 (90 à 97) ; le faible 7 à 29 (5 à
// 19) — le jeu complet, bien choisi, rend l'expédition plus facile. L'énergie
// de l'acte 1 ne change presque rien au moyen ; le faible s'y arrête une fois
// sur sept au lieu d'une sur douze. L'Ascension, au codex entier : le fort
// 98, puis 96, 90, 85, 70 et 55 ; le moyen 72, puis 63, 42, 34, 12 et 3.
// Double chance, passée à une d'énergie après ces mesures (+5 seule), a
// rejoint ses préférences ensuite.
//
// Les huit familles (la version 9, d'office depuis, le 19 octobre 2026) : le
// Sophiste et son doute, le Téméraire et son courage. Le doute frappe juste
// ou faux : aux premiers chiffres, Insinuation seule menait le moyen au bout
// 90 fois sur cent contre 50 ; réglées, les seize vont de Berserk, +18, à −2.
// Au niveau 10 sans légendaire, trois cents expéditions par case (le faible,
// le moyen, le fort) : sans style, 32, 78 et 99 ; le Sophiste suivi, 42, 79
// et 98 ; le Téméraire suivi, 11, 62 et 96, avisé, 26, 76 et 97.
//
// La question au centre (la version 10, `--version 10`, le 19 octobre 2026) :
// un autre joueur, qui voit la question d'abord — à l'annonce, il ne joue que
// le pari et ses cartes —, puis la sait ou non. S'il la sait, il joue ce qui
// ajoute des crans quand il en faut (`cransAvec`, la règle même du pli), un
// pouvoir dans une rencontre longue, sinon ce qui sert plus tard ; s'il ne la
// sait pas, l'aide qui lui laisse la meilleure chance (`chanceApres`) — une
// autre question l'emporte souvent : il la sait autant que celle-ci —, et
// faute d'aide, ce qui rend l'erreur gratuite. Une carte par question ; ses
// rares, ses épiques et ses légendaires attendent une élite ou le gardien.
// Chaque carte seule (`--cartes`, au niveau 10) : Révélation +9, Sursis +7,
// Génie et Exposé +6 ; Troisième œil, Rythme, Prisme, Tout ou rien et Doubler
// la mise −7 ou −8 — elles tiennent une place de la main pour rien. Il ne
// prend que ce qui vaut (`PREFERENCE_EN_QUESTION`). Trois cents expéditions par
// case, aux crans du brief (2, 3, 4-3-3) : le faible, le moyen et le fort au
// bout 3, 49 et 97 fois sur cent au niveau 1, 7, 58 et 97 au niveau 10, en 31
// à 36 questions. Retenus, 2-2-3, 3-4-4 et 4-4-4 (`CRANS_DES_RENCONTRES`) : 1,
// 32 et 92 au niveau 1 — le moyen à la cible —, 3, 44 et 94 au niveau 10, en
// 31 à 39 questions. Le
// fort ne descend pas à huit sur dix sans que le moyen tombe sous un sur
// cinq : deux d'attaque de plus, 0, 18 et 86. À ces crans, les styles suivis,
// au niveau 10, pour le moyen : le Devin 45, sans style 44, le Métamorphe 34,
// l'Érudit 32, le Flambeur 29, l'Élan 28 — leurs cartes valent moins que les
// autres ; l'Ascension, au codex entier : le fort 94, puis 93, 83, 78, 75 et
// 65 ; le moyen 44, puis 31, 15, 11, 10 et 7.
//
// Les coups de pouce et les lettres (la version 11, `--version 11`, le
// 19 octobre 2026) : une escale sur cinq à composer dès l'étage 2 — qu'il
// trouve une fois sur dix sans la savoir, deux de plus sur dix par lettre de
// trop retirée, par lettre posée et par époque dite (`chanceDeComposer`) —, et
// trois cartes : L'initiale et La lettre parmi ses aides, au partage mesuré
// sur la base livrée (`PARTAGENT_L_INITIALE`, `PARTAGENT_LA_LETTRE`), Le
// repère comme l'Énigme. Chaque carte seule : La lettre +8 au niveau 1 et +6
// au 10, sur mille expéditions ; L'initiale +6 au 10 ; Le repère, qui ne
// disait que le domaine sans époque à dire, −3 et −6 au niveau 1 — retouché
// pour effacer, comme le Sphinx, +0 et −4. Trois cents expéditions par case :
// le faible, le moyen et le fort au bout 1, 30 et 92 fois sur cent au niveau 1,
// 2, 45 et 92 au niveau 10 ; la forme seule ne déplace rien (1, 31 et 92), les
// coups de pouce rendent trois à six points au moyen à mesure qu'il les ouvre.
//
//   npx tsx scripts/calibrage-rencontres.ts [--expeditions 1000] [--version 11] [--cas 0] [--niveau 3] [--sans-fioles] [--ascension 2] [--ascensions] [--seule genie] [--cartes [genie,lecon]] [--part 1/4] [--style devin] [--styles] [--avise]
import { CATEGORIES } from '../../shared/categories'
import { SUJETS } from '../../shared/sujets'
import { TAUX_DU_CALIBRAGE } from '../../shared/sentiers'
import { hasardDe } from '../../shared/missions'
import { VIES, type Niveau } from '../../shared/campagne'
import {
  ACTES,
  GARDIEN,
  MARCHES_DES_ACTES,
  bilanDuPli,
  POIDS_DES_ESCALES,
  POIDS_DES_ESCALES_DES_RENCONTRES,
  POIDS_DES_FORMES,
  POIDS_DES_FORMES_A_COMPOSER,
  carteDUnActe,
  chanceSelonLaForme,
  chancesDuTrace,
  contenuDeLInconnu,
  carteEnJeu,
  escaleEnJeu,
  escalesPermises,
  gardiensDe,
  inviteDuJour,
  marcheDe,
  pliDeLExpedition,
  prixDeLArticle,
  refusDeLAchat,
  refusDeLaFiole,
  refusDuJoker,
  traceLePlusSur,
  type ArticleDeLEchoppe,
  type ATirer,
  type CarteDUnActe,
  type DepartDExpedition,
  type EscaleDeLaCarte,
  type EtatDeLExpedition,
  type FormeDEscale,
  type GesteDExpedition,
  type QuestionPosee,
} from '../../shared/expedition'
import {
  CARTES_DE_DEPART_DU_STYLE,
  CARTES_DES_RENCONTRES,
  COURAGE_MAX,
  FIOLES_MAX,
  INSPIRATION_PAR_QUESTION,
  SAVOIR_DES_MARCHES,
  VERSION_DE_LA_QUESTION_AU_CENTRE,
  VERSION_DES_COUPS_DE_POUCE,
  ameliorer,
  attaqueEnQuestion,
  baseDe,
  carteALaVersion,
  carteDeRencontre,
  chiffresApresLaCarte,
  cransDUneBonneReponse,
  effaceesDuTour,
  estAmelioree,
  estUnStyle,
  formeDeLaCarte,
  frappeDeLaQuestion,
  parmi,
  refusDeLAmelioration,
  seJoueEnQuestion,
  viseLaQuestion,
  type CleDeFiole,
  type FormeDUneQuestion,
  type StyleDeJeu,
} from '../../shared/rencontres'
import { ASCENSION_MAX, EXPLOITS, NIVEAUX, ascensionDe, codexDuNiveau, mainMaxEnQuestion, niveauDe, renommeeDe, type CleDExploit } from '../../shared/codex'
import { LETTRES_EN_TROP } from '../../shared/lettres'

function option(nom: string, defaut: number): number {
  const i = process.argv.indexOf(`--${nom}`)
  return i >= 0 ? Number(process.argv[i + 1]) : defaut
}
const EXPEDITIONS = option('expeditions', 1000)
/**
 * La version des règles mesurée : 9 d'office, celle des départs de la
 * production — les huit familles ; `--version 11` mesure les coups de pouce
 * et les lettres, que la préproduction joue d'abord, `--version 10` la
 * question au centre d'avant eux ; `--version 8` remesure le jeu complet
 * d'avant les huit familles, `--version 7` le codex d'avant lui, `--version 6`
 * la main qui grandit avec les actes sans le codex, `--version 5` la main de
 * cinq cartes d'emblée.
 */
const VERSION = ([5, 6, 7, 8, 9, 10, 11] as const).find(v => v === option('version', 9)) ?? 9
/** La question au centre (v10) : la question d'abord, l'adversaire en crans, une carte par question — un autre joueur, plus bas. */
const EN_QUESTION = VERSION >= VERSION_DE_LA_QUESTION_AU_CENTRE
/** Les coups de pouce et les lettres (v11) : une escale sur cinq à composer dès l'étage 2, L'initiale, Le repère et La lettre. */
const A_COMPOSER = VERSION >= VERSION_DES_COUPS_DE_POUCE

const logit = (p: number) => Math.log(p / (1 - p))
const sigmoide = (x: number) => 1 / (1 + Math.exp(-x))

const JOUEURS: [string, number][] = [
  ['faible', -1],
  ['moyen', 0],
  ['fort', 1],
]
const ECART_D_UNE_CATEGORIE = 0.5
const ECART_D_UN_SUJET = 0.8
/** La part des questions qui se répondent par une année ou un nombre : la Prédiction s'y joue. */
const PART_DES_NOMBRES = 0.15
/** La part des questions qui se datent : l'Énigme y dit le siècle. */
const PART_DES_DATEES = 0.4
/** La part des questions qui ont deux leurres de plus : Corser s'y joue. */
const PART_DES_SIX = 0.8
/** Une question de la boucle revient après sa révélation : il en a vu la bonne réponse. */
const SAIT_UNE_REPRISE = 0.7
/** Un dévoilement : douze mots ; ce qu'il sait, il le répond à mi-texte ; sinon, le texte entier. */
const MOTS_D_UN_DEVOILEMENT = 12
/** Une réponse à composer (v11) : huit lettres — 7,9 en moyenne sur la base livrée, de quatre à douze —, ses tuiles trois de plus. */
const LETTRES_D_UNE_REPONSE = 8
/**
 * Ce que L'initiale et La lettre laissent d'une question à choix qu'il ne sait
 * pas (v11), mesuré sur la base livrée le 19 octobre 2026 — ses vingt-six mille
 * questions à quatre choix : la part des autres réponses qui commencent comme
 * la bonne, ou qui ont la lettre dite. Seule à commencer ainsi deux fois sur
 * trois, L'initiale le fait trouver 80 fois sur cent, sa fin en plus 93 ; La
 * lettre 60, deux lettres 81. À six choix ou après un effacement, la même part
 * de ce qui reste.
 */
const PARTAGENT_L_INITIALE = 0.145
const PARTAGENT_L_INITIALE_ET_LA_FIN = 0.05
const PARTAGENT_LA_LETTRE = 0.35
const PARTAGENT_LES_DEUX_LETTRES = 0.14
/** Sa chance parmi `restent` réponses, quand chacune des autres répond encore à l'indice à la chance `s` : l'espérance de 1 / (1 + K), K de loi binomiale (restent − 1, s). */
const parmiCeQuiRepond = (restent: number, s: number) => (1 - (1 - s) ** restent) / (restent * s)
/**
 * Sa chance de composer une réponse qu'il ne sait pas (v11) : une sur dix, le
 * hasard de la forme (`chanceSelonLaForme`) ; chaque lettre de trop retirée,
 * chaque lettre posée et l'époque d'une question qui se date lui ôtent deux
 * réponses sur dix — une sur deux au mieux. Un modèle, pas une mesure : il n'y
 * a pas de base de compositions ratées.
 */
const chanceDeComposer = (aides: number) => 1 / Math.max(2, 10 - 2 * aides)

function normale(r: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
}

interface Joueur {
  theta: number
  categories: Map<string, number>
  sujets: Map<string, number>
}

function unJoueur(theta: number, graine: string): Joueur {
  const r = hasardDe(graine)
  return {
    theta,
    categories: new Map(CATEGORIES.map(c => [c, ECART_D_UNE_CATEGORIE * normale(r)])),
    sujets: new Map(SUJETS.map(s => [s.cle, ECART_D_UN_SUJET * normale(r)])),
  }
}

const chanceSur = (j: Joueur, marche: Niveau, categorie: string | null, sujet: string | null = null) =>
  sigmoide(logit(TAUX_DU_CALIBRAGE[marche]) + j.theta + (categorie ? (j.categories.get(categorie) ?? 0) : 0) + (sujet ? (j.sujets.get(sujet) ?? 0) : 0))

function chanceAnnoncee(j: Joueur, acte: number, e: EscaleDeLaCarte): number {
  if (e.sorte === 'source') return chanceSur(j, 'moyen', null)
  const marche = marcheDe(acte, e)
  const t = e.theme
  const p4 = !t
    ? chanceSur(j, marche, null)
    : 'sujet' in t
      ? CATEGORIES.reduce((s, c) => s + chanceSur(j, marche, c, t.sujet), 0) / CATEGORIES.length
      : t.categories.reduce((s, c) => s + chanceSur(j, marche, c), 0) / t.categories.length
  return chanceSelonLaForme(p4, e.forme ?? 'quatre')
}

const savoir = (p4: number) => Math.max(0, (p4 - 1 / 4) / (3 / 4))

interface Issue {
  auBout: boolean
  acte: number
  questions: number
  rencontres: number
  cartes: number
  ecus: number
  courage: number
  /** La renommée qu'elle rapporte (`renommeeDe`), au bout ou non. */
  renommee: number
  /** Les exploits qu'elle a faits : la carrière ouvre leur carte à la suivante. */
  exploits: CleDExploit[]
  /** Ses trois gardiens : au bout, la carrière en garde un. */
  gardiens: string[]
  /** Les fioles qu'il a bues (le codex). */
  bues: number
  /**
   * La variété (« Ton style », le 19 octobre 2026 : « j'ai l'impression de
   * piocher tout le temps la même chose ») : les cartes différentes que ses
   * offres lui ont proposées, et celles qu'il a jouées.
   */
  offertes: number
  differentes: number
}

/** Ce qu'il prend dans une offre aux règles d'avant le codex (v5, v6), du meilleur au moins bon ; ce qu'il n'y nomme pas, il le laisse. */
const PREFERENCE_DES_OFFRES = [
  'double-chance',
  'bibliotheque',
  'troisieme-oeil',
  'contre-attaque',
  'sursis',
  'banco',
  'lucidite',
  'parade',
  'plume',
  'lancee',
  'corser',
  'simplifier',
  'coup-d-oeil',
  'pioche',
  'echauffement',
  'doubler-la-mise',
  'quitte-ou-double',
  'echange',
]
/** Ce qu'il retire au campement, son courage au plus haut, aux règles d'avant : une carte de base d'abord, comme dans Slay the Spire. */
const A_RETIRER = ['echange', 'prudence', 'concentration']
/**
 * Au codex (v7), un joueur qui a appris : il prend la carte de l'offre qui
 * vaut le plus, mesurée — chacune seule, deux au plus, contre ne rien prendre
 * (le 18 octobre 2026, aux cartes retouchées : de Contre-attaque, dix-huit
 * points de plus pour le moyen au bout, à Troisième œil, quatre de moins ;
 * avant les retouches, Lancée en retirait onze) —, jamais une troisième de
 * la même, et ne retire que les plus faibles.
 */
const PREFERENCE_DU_CODEX_7 = [
  'contre-attaque',
  'echange',
  'simplifier',
  'pioche',
  'lucidite',
  'plume',
  'sursis',
  'echauffement',
  'coup-d-oeil',
  'corser',
  'double-chance',
  'bibliotheque',
  'quitte-ou-double',
  'detour',
  'parade',
  'lancee',
  'doubler-la-mise',
  'banco',
  'arret-sur-image',
  'tout-ou-rien',
  'troisieme-oeil',
]
const A_RETIRER_DU_CODEX_7 = ['troisieme-oeil', 'tout-ou-rien', 'arret-sur-image', 'banco', 'doubler-la-mise', 'lancee']
/**
 * Au jeu complet (le 19 octobre 2026, `--cartes`, ses offres ne proposant
 * qu'elle, deux cent cinquante expéditions au niveau 10) : de Représailles,
 * quatorze points de plus pour le moyen au bout, Panacée treize, Maîtrise
 * dix, Cuirasse neuf, à Troisième œil, dix de moins. À deux d'énergie à
 * l'acte 1, ce qui ne battait pas Concentration et Prudence ensemble restait
 * en dessous de zéro : il n'en prend que ce qui en vaut, à ±5 près — la
 * mesure d'une carte n'en est pas plus fine.
 */
const PREFERENCE_DU_JEU_COMPLET = [
  'represailles',
  'panacee',
  'maitrise',
  'cuirasse',
  'contre-attaque',
  'detour',
  'sprint',
  'vision',
  'double-chance',
  'bastion',
  'miroir',
  'encyclopedie',
  'meditation',
  'sang-froid',
  'lucidite',
  'plume',
  'second-souffle',
  'prisme',
  'augure',
  'muraille',
  'genie',
  'foulee',
  'sursis',
]
const A_RETIRER_DU_JEU_COMPLET = ['troisieme-oeil', 'tout-ou-rien', 'lancee', 'arret-sur-image', 'surmenage', 'lecon', 'doubler-la-mise', 'banco']
/**
 * Aux huit familles (le 19 octobre 2026, `--cartes`, retouchées) : Berserk,
 * dix-huit points de plus pour le moyen au bout, Insinuation huit, Engrenage,
 * Adrénaline et Témérité sept, Hantise et Rumeur six ; les autres à ±5 près,
 * ou qui ne valent qu'avec le doute d'une autre — Zizanie, Coup de grâce,
 * Paranoïa.
 */
const PREFERENCE_DES_HUIT_FAMILLES = [
  'berserk',
  ...PREFERENCE_DU_JEU_COMPLET.slice(0, 4),
  'insinuation',
  'engrenage',
  'adrenaline',
  'temerite',
  'hantise',
  'rumeur',
  ...PREFERENCE_DU_JEU_COMPLET.slice(4),
]
/**
 * À la question au centre (la version 10, le 19 octobre 2026), chaque carte
 * mesurée seule (`--cartes --version 10`, deux cent cinquante expéditions au
 * niveau 10, contre ne rien prendre — le moyen y va au bout 57 fois sur cent,
 * le fort 98) : Révélation, neuf points de plus pour le moyen, Sursis sept,
 * Génie et Exposé six, Rafle, Voyance, Polymorphe et Présage quatre ; puis,
 * dans le bruit de la mesure, de Détour à Vision. Une troisième Échange ou un
 * quatrième Coup d'œil n'ajoutent rien, et ce qui ne vaut que dans son cas —
 * Troisième œil, Rythme, Prisme, Tout ou rien, Doubler la mise, Arrêt sur
 * image : sept points de moins — tient une place de la main pour rien : une
 * carte par question, chaque place compte. Il ne prend que ce qui y vaut.
 */
const PREFERENCE_EN_QUESTION = [
  'revelation',
  'sursis',
  'genie',
  'expose',
  'rafle',
  'voyance',
  'polymorphe',
  'presage',
  'detour',
  'double-chance',
  'cagnotte',
  'corser',
  'simplifier',
  'augure',
  'volte-face',
  'vision',
]
/** Ce qu'il retire à la question au centre, son courage au plus haut : celles qui y valent moins que rien, mesurées — la plus faible d'abord. */
const A_RETIRER_EN_QUESTION = ['troisieme-oeil', 'rythme', 'prisme', 'tout-ou-rien', 'doubler-la-mise', 'arret-sur-image', 'savoir-faire', 'plume', 'inarretable']
/**
 * Aux coups de pouce (la version 11, le 19 octobre 2026, chaque carte seule
 * contre ne rien prendre) : La lettre, huit points de plus pour le moyen au
 * bout au niveau 1, six au niveau 10, sur mille expéditions ; L'initiale six au
 * niveau 10, sur deux cent cinquante. Le repère, retouché, ne change rien au
 * moyen : il ne le prend pas.
 */
const PREFERENCE_DES_COUPS_DE_POUCE = [...PREFERENCE_EN_QUESTION.slice(0, 4), 'lettre', 'initiale', ...PREFERENCE_EN_QUESTION.slice(4)]
/** Ce que prend et retire le joueur qui a appris, à la version mesurée. */
const PREFERENCE_DU_CODEX = A_COMPOSER
  ? PREFERENCE_DES_COUPS_DE_POUCE
  : EN_QUESTION
    ? PREFERENCE_EN_QUESTION
    : VERSION >= 9
      ? PREFERENCE_DES_HUIT_FAMILLES
      : VERSION >= 8
        ? PREFERENCE_DU_JEU_COMPLET
        : PREFERENCE_DU_CODEX_7
const A_RETIRER_DU_CODEX = EN_QUESTION ? A_RETIRER_EN_QUESTION : VERSION >= 8 ? A_RETIRER_DU_JEU_COMPLET : A_RETIRER_DU_CODEX_7
const EXEMPLAIRES_DU_CODEX = 2
/** Les pouvoirs qu'il pose dès qu'il les tire : ils valent toute la rencontre — ceux du jeu complet compris. */
const POUVOIRS_JOUES = [
  'bibliotheque',
  'troisieme-oeil',
  'tresor',
  'trois-tetes',
  'elan',
  'aube',
  'boucle',
  'renaissance',
  'echolocation',
  'maitrise',
  'vision',
  'encyclopedie',
  'pactole',
  'metamorphose',
  'prisme',
  'rythme',
  'vent-arriere',
  'inarretable',
  'cuirasse',
  'bastion',
  'represailles',
  'cameleon',
  'astrolabe',
  // Les huit familles (v9).
  'engrenage',
  'paranoia',
  'hantise',
  'adrenaline',
  'berserk',
]
/**
 * À la question au centre (v10), les pouvoirs qu'il pose quand la rencontre est
 * longue — une élite, un gardien, et encore deux bonnes réponses à donner : une
 * carte par question, un cran de plus à chaque bonne réponse vaut plus qu'un
 * seul. Ceux qui effacent et ceux qui tirent des cartes ensuite ; les maudits,
 * jamais.
 */
const POUVOIRS_EN_QUESTION = ['encyclopedie', 'aube', 'vision', 'echolocation', 'bibliotheque', 'prisme', 'rythme', 'trois-tetes', 'elan', 'troisieme-oeil', 'inarretable', 'boucle', 'renaissance']
/** Ce qu'il joue s'il sait la réponse : ce qui ajoute des crans (`cransAvec`) — Corser et Polymorphe la corsent, Quitte ou double la double. */
const ATTAQUES_EN_QUESTION = ['genie', 'expose', 'rafle', 'polymorphe', 'quitte-ou-double', 'plume', 'savoir-faire', 'lancee', 'corser', 'concentration', 'cagnotte', 'memoire', 'echauffement', 'lucidite', 'revelation', 'peau-de-feu']
/** Ce qui l'aide s'il ne la sait pas : il joue celle qui lui laisse la meilleure chance (`chanceApres`) — les coups de pouce de la version 11 compris. */
const AIDES_EN_QUESTION = [
  'deux-visages',
  'revelation',
  'voyance',
  'sagesse',
  'tout-ou-rien',
  'double-chance',
  'echange',
  'volte-face',
  'mue',
  'prediction',
  'enigme',
  'vision',
  'echolocation',
  'coup-d-oeil',
  'presage',
  'simplifier',
  'initiale',
  'lettre',
  'repere',
]
/**
 * Les cartes qui frappent de plus si la réponse est juste, jouées avant la question : il prend celle qui frappe le plus par point
 * d'énergie (`parEnergie`) — Cicatrices, Dernier carré et Baroud au courage qui lui manque (les huit familles).
 */
const ATTAQUES = ['genie', 'rafle', 'expose', 'plume', 'lancee', 'lecon', 'savoir-faire', 'concentration', 'cagnotte', 'fortune', 'echauffement', 'cicatrices', 'dernier-carre', 'baroud']
/**
 * `--seule genie` : ses offres ne proposent que cette carte — et les
 * légendaires qu'il a —, il la prend, deux au plus : ce qu'elle vaut seule ;
 * `--seule rien`, rien. Parmi les soixante cartes du codex entier, une carte
 * ne passait qu'une fois par expédition, et ce qu'elle valait se perdait dans
 * le bruit. `--cartes` les mesure toutes ainsi, chacune contre rien (le jeu
 * complet, le 19 octobre 2026 : une carte n'entre dans l'échelle que si elle
 * vaut d'être prise) ; `--part 2/3`, le deuxième tiers d'entre elles — trois
 * processus à la fois.
 */
const SEULE = (() => {
  const i = process.argv.indexOf('--seule')
  return i >= 0 ? process.argv[i + 1] : null
})()
const TOUTES_LES_CARTES = process.argv.includes('--cartes')
/** `--cartes genie,lecon` : ces cartes seules, plutôt que toutes — de quoi remesurer une retouche sans tout refaire. */
const CARTES_MESUREES = (() => {
  const suite = process.argv[process.argv.indexOf('--cartes') + 1]
  return TOUTES_LES_CARTES && suite && !suite.startsWith('--') ? suite.split(',') : null
})()
const PART = (() => {
  const i = process.argv.indexOf('--part')
  const [k, n] = i >= 0 ? process.argv[i + 1].split('/').map(Number) : [1, 1]
  return { k, n }
})()
const TALISMANS_UTILES = ['loupe', 'boussole']
/**
 * Les fioles (le codex), comme les boirait un joueur qui a appris : le
 * courage sous ce seuil — même la question sous les yeux —, l'énergie contre
 * une élite ou un gardien, la clairvoyance sur une question qu'il ne sait pas.
 * Au coffre, il la prend quand aucune des meilleures cartes n'y est, ou quand
 * le courage lui manque ; à l'échoppe, après le courage, avant une carte.
 */
const COURAGE_POUR_BOIRE = 20
const MEILLEURES_DU_CODEX = PREFERENCE_DU_CODEX.slice(0, 6)
/** `--sans-fioles` : les mêmes départs sans leur règle — ce qu'elles changent. */
const SANS_FIOLES = process.argv.includes('--sans-fioles')
/**
 * `--sans-ameliorations` : le même joueur, qui n'améliore jamais rien — ni au
 * campement, ni à l'échoppe — : ce que ses améliorations lui valent. Les
 * offres en proposent encore d'améliorées, la règle du jeu complet.
 */
const SANS_AMELIORATIONS = process.argv.includes('--sans-ameliorations')
/**
 * La carte qu'il améliore d'abord : la meilleure qu'il prend, puis les cartes
 * de base, qu'il tire le plus souvent — un exemplaire chacune.
 */
const ORDRE_DES_AMELIORATIONS = [...PREFERENCE_DU_CODEX, ...(EN_QUESTION ? ['concentration', 'coup-d-oeil', 'echange', 'double-chance', 'sursis'] : ['concentration', 'prudence', 'coup-d-oeil', 'echange'])]
/** `--ascension 2` : les départs du codex à ce cran ; `--ascensions` : chaque cran, au codex entier. */
const ASCENSION_MESUREE = Math.min(Math.max(0, option('ascension', 0)), ASCENSION_MAX)
const TOUTES_LES_ASCENSIONS = process.argv.includes('--ascensions')
/**
 * « Ton style » (le 19 octobre 2026) : `--style devin` fait partir chaque cas
 * avec ce style — s'il n'est pas encore ouvert à son niveau, le premier des
 * siens, comme le serveur ; `--styles` mesure, niveau par niveau, chaque style
 * ouvert contre le départ sans style. Avec un style, le joueur le suit : il
 * prend d'abord une carte de sa famille — la meilleure qu'il connaisse, sinon
 * une autre —, n'en retire aucune au campement et améliore les siennes
 * d'abord. Le pire cas d'un style : le joueur qui s'y tient, même quand une
 * carte d'ailleurs vaudrait plus.
 */
const STYLE_MESURE = (() => {
  const i = process.argv.indexOf('--style')
  return i >= 0 && estUnStyle(process.argv[i + 1]) ? process.argv[i + 1] : undefined
})() as StyleDeJeu | undefined
const TOUS_LES_STYLES = process.argv.includes('--styles')
/** `--avise` : le joueur qui part avec son style mais ne prend que ce qui vaut — ce que le style lui-même change, sans le suivre. */
const SUIT_SON_STYLE = !process.argv.includes('--avise')
/** Les cartes d'un style que le joueur qui le suit prend, de la meilleure qu'il connaisse aux autres. */
function cartesDuStyle(style: StyleDeJeu): string[] {
  // À la question au centre, celles qu'elle garde seulement : les autres ne s'y offrent plus.
  const siennes = CARTES_DES_RENCONTRES.filter(c => c.famille === style && !c.legendaire && (!EN_QUESTION || seJoueEnQuestion(c.cle, VERSION))).map(c => c.cle)
  return [...PREFERENCE_DU_CODEX.filter(c => siennes.includes(c)), ...siennes.filter(c => !PREFERENCE_DU_CODEX.includes(c))]
}

/**
 * Une équipée mesurée : aux règles d'avant (v5, v6), les légendaires qu'il
 * emmène ; au codex (v7), son niveau d'explorateur et les légendaires qu'il a
 * gardés — l'invité du jour, tiré pour chaque expédition, prête sa carte.
 */
interface Cas {
  nom: string
  equipee: string[]
  niveau?: number
  /** Au codex : les exploits qu'il a faits — leurs cartes ouvertes. */
  exploits?: CleDExploit[]
  /** Au codex : le style qu'il choisit au départ (`--style`, `--styles`). */
  style?: StyleDeJeu
}

function jouer(j: Joueur, graine: string, cas: Cas, ascension = ASCENSION_MESUREE, seule: string | null = SEULE): Issue {
  const sujets = SUJETS.map(s => s.cle).sort()
  // Les cartes du départ, comme le serveur les tire : à plus d'adversaires dès la version 6, une escale sur cinq à composer dès la 11.
  const cartes: CarteDUnActe[] = Array.from({ length: ACTES }, (_, acte) =>
    carteDUnActe(graine, acte, sujets, undefined, VERSION >= 6 ? POIDS_DES_ESCALES_DES_RENCONTRES : POIDS_DES_ESCALES, A_COMPOSER ? POIDS_DES_FORMES_A_COMPOSER : POIDS_DES_FORMES),
  )
  cartes.forEach((carte, acte) => {
    for (const e of carte.escales) if (e.sorte === 'question' || e.sorte === 'elite' || e.sorte === 'source') e.chance = chanceAnnoncee(j, acte, e)
    carte.chanceDuGardien = CATEGORIES.reduce((s, c) => s + chanceSur(j, MARCHES_DES_ACTES[acte].gardien, c), 0) / CATEGORIES.length
  })
  const chances = Object.fromEntries(CATEGORIES.map(c => [c, Object.fromEntries((['facile', 'moyen', 'difficile'] as const).map(m => [m, chanceSur(j, m, c)]))]))
  // Sa catégorie fétiche : sa meilleure — au codex, à son niveau seulement, comme le serveur la garde.
  const fetiche = [...CATEGORIES].sort((a, b) => (j.categories.get(b) ?? 0) - (j.categories.get(a) ?? 0))[0]
  // Au codex, l'invité du jour d'un jour tiré de la graine ; ses légendaires gardés ouvrent leur carte, et ne gardent plus d'acte.
  const invite = inviteDuJour(graine)
  // À la version mesurée : la question au centre a son échelle, ses styles et ses soixante-deux cartes.
  const tout = VERSION >= 7 ? codexDuNiveau(cas.niveau ?? 1, cas.equipee, cas.exploits ?? [], VERSION) : undefined
  // À une version d'avant (`--version 7`, `--version 8`), les cartes et les styles d'alors seulement : l'échelle d'aujourd'hui range aussi les neuves.
  const connue = (cle: string) => (carteDeRencontre(cle)?.depuis ?? 0) <= VERSION
  const avant = tout && { ...tout, cartes: tout.cartes.filter(connue), styles: tout.styles.filter(s => CARTES_DE_DEPART_DU_STYLE[s].every(connue)) }
  // Sous `--seule`, ses offres ne tirent qu'elle, et les légendaires qu'il a : prise dès qu'elle passe.
  const ouvert = avant && seule !== null ? { ...avant, cartes: avant.cartes.filter(c => c === seule || carteDeRencontre(c)?.rarete === 'legendaire') } : avant
  const codex = ouvert && SANS_FIOLES ? { ...ouvert, regles: ouvert.regles.filter(r => r !== 'fioles') } : ouvert
  // Son style : celui du cas, s'il est ouvert à son niveau — sinon le premier des siens, comme le serveur (`partirEnExpedition`).
  const voulu = cas.style ?? STYLE_MESURE
  const style = codex && voulu && codex.styles.length > 0 ? (codex.styles.includes(voulu) ? voulu : codex.styles[0]) : undefined
  const depart: DepartDExpedition = {
    v: VERSION,
    graine,
    numero: 0,
    gardiens: codex ? gardiensDe(graine, new Set(cas.equipee), invite) : gardiensDe(graine, new Set(cas.equipee)),
    cartes,
    moyen: false,
    equipee: codex ? [invite] : cas.equipee,
    chances,
    chanceDeLaSource: chanceSur(j, 'moyen', null),
    // Sa catégorie fétiche, comme le serveur la garde : à son niveau, et à l'Érudit seul quand un style est posé.
    ...((!codex || codex.regles.includes('fetiche')) && (!style || style === 'erudit') && { fetiche }),
    ...(codex && { codex }),
    ...(style && { style }),
    // L'Ascension ne vit qu'au codex : le pli l'ignore ailleurs.
    ...(codex && ascension > 0 && { ascension }),
  }
  const r = hasardDe(`${graine}:reponses`)
  const au = <T>(liste: readonly T[]) => liste[Math.floor(r() * liste.length)]
  const gestes: GesteDExpedition[] = []
  const posees: (QuestionPosee & { p4: number; sait: boolean })[] = []
  const reponses = new Map<number, boolean>()
  let jouees = 0
  let depenses = 0
  const offertes = new Set<string>()
  const differentes = new Set<string>()
  /** Une carte jouée : comptée, et sa carte de base parmi les différentes. */
  const joue = (g: GesteDExpedition) => {
    jouees++
    if (g.quoi === 'jouer') differentes.add(baseDe(g.joker))
  }
  const plier = () => pliDeLExpedition(depart, gestes, posees, reponses)

  const tirer = (t: ATirer, e: EtatDeLExpedition) => {
    if (t.reprise !== undefined) {
      const avant = posees[t.reprise]
      return posees.push({ ...avant, escale: t.escale, acte: t.acte, sait: r() < Math.max(SAIT_UNE_REPRISE, savoir(avant.p4)) })
    }
    let p4: number
    let forme: FormeDEscale | undefined
    let categorie: string
    let marche: Niveau
    if (t.escale === GARDIEN) {
      marche = MARCHES_DES_ACTES[t.acte].gardien
      p4 = chanceSur(j, marche, (categorie = au(CATEGORIES)))
    } else {
      const escale = escaleEnJeu(depart, e, t.escale)!
      marche = escale.sorte === 'source' ? 'facile' : marcheDe(t.acte, escale)
      const th = escale.theme
      if (escale.sorte === 'question' || escale.sorte === 'elite') forme = escale.forme
      if (escale.sorte === 'source') p4 = chanceSur(j, 'moyen', (categorie = au(CATEGORIES)))
      else if (t.categorie) p4 = chanceSur(j, marche, (categorie = t.categorie))
      else if (!th) p4 = chanceSur(j, marche, (categorie = au(CATEGORIES)))
      else if ('sujet' in th) p4 = chanceSur(j, marche, (categorie = au(CATEGORIES)), th.sujet)
      else p4 = chanceSur(j, marche, (categorie = au(th.categories)))
    }
    // À composer, ses réponses sont ses tuiles ; et une réponse qui se compose n'est jamais une année ni un nombre.
    const reponsesDeLaForme = forme === 'vrai-faux' ? 2 : forme === 'six' ? 6 : forme === 'lettres' ? LETTRES_D_UNE_REPONSE + LETTRES_EN_TROP : 4
    const nombre = forme !== 'vrai-faux' && forme !== 'lettres' && r() < PART_DES_NOMBRES
    posees.push({
      escale: t.escale,
      acte: t.acte,
      reponses: reponsesDeLaForme,
      p4,
      sait: r() < savoir(p4),
      categorie,
      niveau: marche,
      tiree: forme ?? 'quatre',
      six: r() < PART_DES_SIX,
      datee: r() < PART_DES_DATEES,
      ...(nombre && { nombre: true, reponseEn: 'nombre' as const }),
      ...(forme && forme !== 'quatre' && { forme }),
      ...(forme === 'devoilement' && { mots: MOTS_D_UN_DEVOILEMENT }),
    })
  }

  /**
   * Sa chance de trouver la question `q` sans la savoir, ces cartes sur elle et
   * ces pouvoirs posés : il devine parmi ce qui reste — ce que les cartes y
   * effacent, et une réponse de plus que l'époque écarte d'une question qui se
   * date —, parmi ce qui répond encore à L'initiale ou à La lettre (v11) ; à
   * composer, `chanceDeComposer`.
   */
  const chanceSansSavoir = (q: QuestionPosee, sur: readonly string[], pouvoirs: readonly string[], talismans: readonly string[]): number => {
    const n = q.reponses ?? 4
    const effacees = effaceesDuTour(sur, pouvoirs, { reponses: n, datee: q.datee, nombre: q.nombre, forme: q.forme })
    // L'époque : le siècle de l'Énigme, celui de la loupe sur l'Histoire, la décennie du repère — qui ne dit jamais celle d'une réponse
    // en années : il y efface, comme sur une question qui ne se date pas (`effaceesDuTour`).
    const epoque = !!q.datee && (sur.includes('enigme') || (parmi(sur, 'repere') && !q.nombre) || (talismans.includes('loupe') && q.categorie === 'Histoire'))
    if (q.forme === 'lettres') {
      const posees = sur.reduce((s, c) => s + (baseDe(c) === 'initiale' || baseDe(c) === 'lettre' ? (estAmelioree(c) ? 2 : 1) : 0), 0)
      return chanceDeComposer(effacees + Math.min(posees, LETTRES_D_UNE_REPONSE - 2) + (epoque ? 1 : 0))
    }
    const restent = Math.max(2, n - effacees - (epoque ? 1 : 0))
    if (parmi(sur, 'double-chance')) return 2 / restent
    if (sur.includes('prediction')) return 1 / 2
    const initiale = sur.find(c => baseDe(c) === 'initiale')
    if (initiale) return parmiCeQuiRepond(restent, estAmelioree(initiale) ? PARTAGENT_L_INITIALE_ET_LA_FIN : PARTAGENT_L_INITIALE)
    const lettre = sur.find(c => baseDe(c) === 'lettre')
    if (lettre) return parmiCeQuiRepond(restent, estAmelioree(lettre) ? PARTAGENT_LES_DEUX_LETTRES : PARTAGENT_LA_LETTRE)
    return 1 / restent
  }

  /** Juste ou non, à la question `i` : il sait, sinon il devine (`chanceSansSavoir`). */
  const juger = (i: number, e: EtatDeLExpedition): boolean => {
    const q = posees[i]
    if (q.sait) return true
    return r() < chanceSansSavoir(q, e.rencontre?.tour.surLaQuestion ?? [], e.rencontre?.pouvoirs ?? [], e.talismans)
  }

  /** L'exemplaire de cette carte qu'il jouerait : l'amélioré s'il l'a en main (le jeu complet), sinon l'autre. */
  const exemplaire = (e: EtatDeLExpedition, cle: string) => (e.rencontre?.main.includes(ameliorer(cle)) ? ameliorer(cle) : cle)

  const peut = (e: EtatDeLExpedition, cle: string, geste?: { categorie?: string; montre?: number }) => {
    const k = exemplaire(e, cle)
    return (e.rencontre ? e.rencontre.main.includes(k) : true) && refusDuJoker(depart, e, k, posees, geste) === null
  }

  /**
   * Ce qu'une carte d'attaque ajouterait à ce que perd l'adversaire, par point
   * d'énergie, à la règle même du pli (`chiffresApresLaCarte`) : joués dans un
   * ordre fixe, Fortune passait après Concentration même à deux cents écus, et
   * Génie, à deux d'énergie, avant tout le reste. L'exemplaire qu'il a en main,
   * amélioré ou non.
   */
  const parEnergie = (e: EtatDeLExpedition, i: number, cle: string) => {
    const rc = e.rencontre!
    const q = posees[i]
    const niveau = q.niveau ?? 'facile'
    const t = rc.tour
    const k = exemplaire(e, cle)
    const apres = chiffresApresLaCarte(k, { inspiration: t.inspiration, charge: t.charge, garde: t.garde, serie: rc.serie, doute: rc.doute }, rc.pouvoirs, {
      v: VERSION,
      fetiche: !!depart.fetiche && q.categorie === depart.fetiche,
      niveau,
      savoir: SAVOIR_DES_MARCHES[niveau],
      ecus: e.ecus,
      courage: e.courage ?? COURAGE_MAX,
    })
    return (apres.charge - t.charge) / Math.max(1, carteALaVersion(k, VERSION)?.cout ?? 1)
  }

  /** Ce qu'il joue avant de voir la question — une carte à la fois, tant qu'il en a — ; null : il voit la question. */
  const enPreparation = (e: EtatDeLExpedition, i: number): GesteDExpedition | null => {
    const rc = e.rencontre!
    const q = posees[i]
    const chance = chanceSelonLaForme(q.p4, q.forme ?? (q.reponses === 2 ? 'vrai-faux' : 'quatre'))
    const courage = e.courage ?? 0
    const jouerLa = (cle: string): GesteDExpedition => ({ quoi: 'jouer', joker: exemplaire(e, cle), position: i })
    // Ce qui ne coûte rien et donne : piocher, s'inspirer — Pourboire tire une carte à sa place ; la Rumeur sème le doute (v9).
    for (const cle of ['reveil', 'pioche', 'sprint', 'meditation', 'foulee', 'pourboire', 'rumeur']) if (peut(e, cle)) return jouerLa(cle)
    // Les huit familles : Coup de sang, s'il a de quoi dépenser l'énergie qu'il paie de son courage — la carte qu'il tire en plus ;
    // le doute, qui frappe juste ou faux — Insinuation, puis Zizanie sur un doute qui vaut d'être doublé.
    const payantes = rc.main.filter(c => (carteALaVersion(c, VERSION)?.cout ?? 0) >= 1).length
    if (courage > 25 && payantes >= 1 && peut(e, 'coup-de-sang')) return jouerLa('coup-de-sang')
    if (peut(e, 'insinuation')) return jouerLa('insinuation')
    if (rc.doute >= 2 && peut(e, 'zizanie')) return jouerLa('zizanie')
    if (rc.defausse.length >= 4 && peut(e, 'feu-d-artifice')) return jouerLa('feu-d-artifice')
    if (rc.derniereFrappe >= 6 && peut(e, 'horizon')) return jouerLa('horizon')
    // Le courage, quand il en manque (le jeu complet) : Panacée ne sert qu'une fois, il la garde pour un vrai besoin.
    if (courage <= 30 && peut(e, 'panacee')) return jouerLa('panacee')
    if (courage <= COURAGE_MAX - 10 && peut(e, 'second-souffle')) return jouerLa('second-souffle')
    // Ses pouvoirs, dès qu'il les tire : ils valent toute la rencontre.
    for (const cle of POUVOIRS_JOUES) if (peut(e, cle)) return jouerLa(cle)
    if (courage > 30 && peut(e, 'abysses')) return jouerLa('abysses')
    const attaque = chance >= 0.6
    // Son pari assuré, s'il va parier (`miser`).
    if (chance >= 0.67 && e.pari && peut(e, 'assurance')) return jouerLa('assurance')
    if (attaque) {
      if (chance >= 0.75) for (const cle of ['polymorphe', 'corser']) if (peut(e, cle)) return jouerLa(cle)
      if (chance >= 0.85 && peut(e, 'quitte-ou-double')) return jouerLa('quitte-ou-double')
      if (chance >= 0.7 && peut(e, 'surmenage')) return jouerLa('surmenage')
      // Ce qui ne coûte rien d'abord, puis l'attaque qui frappe le plus par point d'énergie.
      for (const cle of ['acceleration', 'pansement']) if (peut(e, cle)) return jouerLa(cle)
      // Le Téméraire : Fougue tant qu'il a du courage à payer, Témérité sûr de lui ; Coup de grâce sur un doute qui frappe (v9).
      if (courage > 15 && peut(e, 'fougue')) return jouerLa('fougue')
      if (chance >= 0.75 && courage > 20 && peut(e, 'temerite')) return jouerLa('temerite')
      if (rc.doute >= 2 && peut(e, 'coup-de-grace')) return jouerLa('coup-de-grace')
      const attaques = ATTAQUES.filter(cle => peut(e, cle)).sort((a, b) => parEnergie(e, i, b) - parEnergie(e, i, a))
      if (attaques.length > 0) return jouerLa(attaques[0])
      if (peut(e, 'banco')) return jouerLa('banco')
      if (peut(e, 'doubler-la-mise') && (e.ecus ?? 0) >= 50) return jouerLa('doubler-la-mise')
      for (const cle of ['prudence', 'peau-de-feu', 'muraille']) if (peut(e, cle)) return jouerLa(cle)
    } else {
      if (chance < 0.45) for (const cle of ['miroir', 'simplifier']) if (peut(e, cle)) return jouerLa(cle)
      if (courage <= 20 && peut(e, 'sursis')) return jouerLa('sursis')
      if (peut(e, 'augure')) return jouerLa('augure')
      for (const cle of ['muraille', 'prudence', 'peau-de-feu', 'contre-attaque']) if (peut(e, cle)) return jouerLa(cle)
      // Puis ce qui frappe : le Téméraire aussi — sans quoi Fougue et Cicatrices, ses cartes de départ, restaient en main là où
      // Concentration se jouait, et le joueur faible qui part avec ce style allait au bout 20 fois sur cent au lieu de 31.
      for (const cle of ['concentration', 'plume', 'echauffement', 'savoir-faire', 'cicatrices', 'dernier-carre']) if (peut(e, cle)) return jouerLa(cle)
      if (courage > 30 && peut(e, 'fougue')) return jouerLa('fougue')
    }
    return null
  }

  /** Sa mise, au vu de sa chance : elle ne rapporte que la moitié de ce qu'elle engage, il ne mise qu'au-dessus de deux chances sur trois. */
  const miser = (e: EtatDeLExpedition, i: number): number => {
    // Le pari pas encore ouvert à son niveau (v7) : le pli refuserait sa mise.
    if (!e.pari) return 0
    const q = posees[i]
    const chance = chanceSelonLaForme(q.p4, q.forme ?? (q.reponses === 2 ? 'vrai-faux' : 'quatre'))
    const voulue = chance >= 0.85 ? 40 : chance >= 0.75 ? 20 : chance >= 0.67 ? 10 : 0
    for (const m of [voulue, 20, 10, 0]) if (m <= voulue && peutMiser(e, m)) return m
    return 0
  }
  const peutMiser = (e: EtatDeLExpedition, m: number) => m * (e.rencontre && parmi(e.rencontre.tour.jouees, 'doubler-la-mise') ? 2 : 1) <= e.ecus

  /**
   * Ce qu'il joue la question sous les yeux : s'il la sait, ce qui frappe sans
   * rien coûter — Lucidité — et, sur un dévoilement, Arrêt sur image ; sinon,
   * ce qui l'aide.
   */
  const enQuestion = (e: EtatDeLExpedition, i: number): GesteDExpedition | null => {
    const q = posees[i]
    const autre = e.autre !== null ? posees[e.autre] : undefined
    if (q.sait) {
      // Il la sait : ce qui frappe — le jeu complet en a, à jouer la question vue ; Lucidité, gratuite, d'abord ; l'Objection sème encore son doute (v9).
      const cle = [...(q.forme === 'devoilement' ? ['arret-sur-image'] : []), 'lucidite', 'evidence', 'memoire', 'sang-froid', 'objection'].find(c => peut(e, c))
      return cle ? { quoi: 'jouer', joker: exemplaire(e, cle), position: i } : null
    }
    if (autre?.sait) return null
    const courage = e.courage ?? 0
    const ordre = [
      'deux-visages',
      'mue',
      'echange',
      'volte-face',
      'double-chance',
      'prediction',
      'sagesse',
      'revelation',
      'voyance',
      'enigme',
      ...(courage > 30 ? ['tout-ou-rien'] : []),
      'coup-d-oeil',
      'presage',
      'lucidite',
      ...(courage <= 15 ? ['passe-muraille'] : []),
      'sang-froid',
      'objection',
      'parade',
    ]
    const cle = ordre.find(c => peut(e, c, c === 'prediction' ? { montre: 0 } : undefined))
    return cle ? { quoi: 'jouer', joker: exemplaire(e, cle), position: i, ...(cle === 'prediction' && { montre: 0 }) } : null
  }

  // ── La question au centre (v10) : il voit la question, puis joue une carte au plus ──

  /**
   * Les crans qu'une bonne réponse ferait perdre, cette carte jouée en plus —
   * aucune : `null` —, à la règle même du pli : ses chiffres
   * (`chiffresApresLaCarte`), la forme où elle repose la question, les pouvoirs
   * qu'elle pose, puis `cransDUneBonneReponse`. Un dévoilement qu'il sait se
   * répond à mi-texte : la première moitié de ses mots, deux crans.
   */
  const cransAvec = (e: EtatDeLExpedition, i: number, cle: string | null): number => {
    const rc = e.rencontre!
    const q = posees[i]
    const t = rc.tour
    let question: FormeDUneQuestion = {
      reponses: q.reponses ?? 4,
      forme: q.forme ?? (q.reponses === 2 ? 'vrai-faux' : 'quatre'),
      ...(q.forme === 'devoilement' && { devoile: { mots: MOTS_D_UN_DEVOILEMENT / 2, sur: MOTS_D_UN_DEVOILEMENT } }),
    }
    let tour: Parameters<typeof cransDUneBonneReponse>[0]['tour'] = t
    let pouvoirs = rc.pouvoirs
    let serie = rc.serie
    if (cle !== null) {
      const k = exemplaire(e, cle)
      const carte = carteALaVersion(k, VERSION)
      if (!carte) return cransAvec(e, i, null)
      const vers = formeDeLaCarte(k)
      if (vers === 'six') question = { reponses: 6, forme: 'six' }
      else if (vers === 'vrai-faux') question = { reponses: 2, forme: 'vrai-faux' }
      const niveau = q.niveau ?? 'facile'
      const apres = chiffresApresLaCarte(k, { inspiration: t.inspiration, charge: t.charge, garde: t.garde, serie: rc.serie }, rc.pouvoirs, {
        v: VERSION,
        fetiche: !!depart.fetiche && q.categorie === depart.fetiche,
        effacees: effaceesDuTour(t.surLaQuestion, rc.pouvoirs, { reponses: q.reponses ?? 4, datee: q.datee, nombre: q.nombre, forme: q.forme }),
        niveau,
        savoir: SAVOIR_DES_MARCHES[niveau],
        ecus: e.ecus,
        courage: e.courage ?? COURAGE_MAX,
      })
      serie = apres.serie
      tour = { ...t, charge: apres.charge, jouees: [...t.jouees, k], surLaQuestion: viseLaQuestion(carte) && baseDe(k) !== 'augure' ? [...t.surLaQuestion, k] : t.surLaQuestion }
      if (carte.moment === 'pouvoir') pouvoirs = [...rc.pouvoirs, k]
    }
    return cransDUneBonneReponse({ question, tour, pouvoirs, fetiche: depart.fetiche, categorie: q.categorie, trouvees: rc.trouvees, serie, aube: !rc.aubeEteinte })
  }

  /**
   * Sa chance de trouver la question qu'il ne sait pas, cette carte jouée — aucune :
   * `null` : il devine parmi ce qui reste, comme `juger`. Une question neuve du
   * même adversaire (Échange, Volte-face, La mue), il la sait autant que
   * celle-ci ; deux au choix (Deux visages), la seconde.
   */
  const chanceApres = (e: EtatDeLExpedition, i: number, cle: string | null): number => {
    const rc = e.rencontre!
    const q = posees[i]
    const n = q.reponses ?? 4
    const sait = savoir(q.p4)
    // À composer (v11), la règle même du verdict simulé : la carte jouée ajoutée à la question — ou aux pouvoirs, si elle se pose.
    if (q.forme === 'lettres') {
      const sur = rc.tour.surLaQuestion
      if (cle === null) return chanceSansSavoir(q, sur, rc.pouvoirs, e.talismans)
      const k = exemplaire(e, cle)
      switch (baseDe(cle)) {
        case 'simplifier':
          return 1 / 2
        case 'echange':
        case 'volte-face':
        case 'mue':
          return sait + (1 - sait) * chanceDeComposer(0)
        default:
          return carteALaVersion(k, VERSION)?.moment === 'pouvoir'
            ? chanceSansSavoir(q, sur, [...rc.pouvoirs, k], e.talismans)
            : chanceSansSavoir(q, [...sur, k], rc.pouvoirs, e.talismans)
      }
    }
    let restent = n - effaceesDuTour(rc.tour.surLaQuestion, rc.pouvoirs, { reponses: n, datee: q.datee, nombre: q.nombre })
    const dejaDatee = !!q.datee && (rc.tour.surLaQuestion.includes('enigme') || (e.talismans.includes('loupe') && q.categorie === 'Histoire'))
    if (dejaDatee) restent--
    restent = Math.max(2, restent)
    if (cle === null) return 1 / restent
    switch (baseDe(cle)) {
      // Les coups de pouce (v11) : la décennie d'une question qui se date — rien de plus, son siècle déjà dit —, sinon une réponse
      // effacée ; et ce qui répond encore à l'initiale ou à la lettre dite.
      case 'repere':
        return q.datee && !q.nombre && dejaDatee ? 1 / restent : 1 / Math.max(2, restent - 1)
      case 'initiale':
        return parmiCeQuiRepond(restent, estAmelioree(exemplaire(e, cle)) ? PARTAGENT_L_INITIALE_ET_LA_FIN : PARTAGENT_L_INITIALE)
      case 'lettre':
        return parmiCeQuiRepond(restent, estAmelioree(exemplaire(e, cle)) ? PARTAGENT_LES_DEUX_LETTRES : PARTAGENT_LA_LETTRE)
      case 'coup-d-oeil':
      case 'presage':
      case 'vision':
      case 'echolocation':
      case 'enigme':
        return 1 / Math.max(2, restent - 1)
      case 'voyance':
      case 'sagesse':
      case 'tout-ou-rien':
        return 1 / Math.max(2, restent - 2)
      case 'revelation':
      case 'simplifier':
        return 1 / 2
      case 'double-chance':
        return Math.min(1, 2 / restent)
      case 'prediction':
        return q.nombre ? 1 / 2 : 1 / restent
      case 'echange':
      case 'volte-face':
      case 'mue':
        return sait + (1 - sait) / n
      case 'deux-visages':
        return sait + (1 - sait) / restent
      default:
        return 1 / restent
    }
  }

  /**
   * À l'annonce (v10) : le pari seul, avant de voir la question — et ses cartes,
   * s'il va parier : Le trésor et Pactole pour une élite ou un gardien, son pari
   * assuré, Banco, doublé quand il est sûr de lui. Null : il voit la question.
   * Une annonce sans pari — un dévoilement, au niveau 1 — ne demande rien.
   */
  const enAnnonce = (e: EtatDeLExpedition, i: number): GesteDExpedition | null => {
    const rc = e.rencontre!
    const mise = miser(e, i)
    if (mise <= 0) return null
    const q = posees[i]
    const chance = chanceSelonLaForme(q.p4, q.forme ?? (q.reponses === 2 ? 'vrai-faux' : 'quatre'))
    const jouerLa = (cle: string): GesteDExpedition => ({ quoi: 'jouer', joker: exemplaire(e, cle), position: i })
    if (rc.sorte !== 'question') for (const cle of ['tresor', 'pactole']) if (peut(e, cle)) return jouerLa(cle)
    if (peut(e, 'assurance')) return jouerLa('assurance')
    if (peut(e, 'banco')) return jouerLa('banco')
    if (chance >= 0.8 && e.ecus >= 2 * mise && peut(e, 'doubler-la-mise')) return jouerLa('doubler-la-mise')
    return null
  }

  /**
   * La question sous les yeux (v10) : une carte au plus. S'il la sait, ce qui
   * ajoute des crans, quand il en faut — un pouvoir dans une rencontre longue —,
   * sinon ce qui sert plus tard (Augure, Pourboire, Le réveil) ; s'il ne la
   * sait pas, d'abord ce qui sauve d'une erreur qui finirait l'expédition, puis
   * l'aide qui lui laisse la meilleure chance, et faute d'aide, ce qui rend
   * l'erreur gratuite quand elle coûte cher. Ses rares, ses épiques et ses
   * légendaires attendent une élite ou le gardien, sa main pleine mise à part :
   * une carte de plus s'y perdrait.
   */
  const enQuestionAuCentre = (e: EtatDeLExpedition, i: number): GesteDExpedition | null => {
    const rc = e.rencontre!
    const q = posees[i]
    const autre = e.autre !== null ? posees[e.autre] : undefined
    const courage = e.courage ?? 0
    const avecMontre = (cle: string) => (baseDe(cle) === 'prediction' ? { montre: 0 } : undefined)
    const jouerLa = (cle: string): GesteDExpedition => ({ quoi: 'jouer', joker: exemplaire(e, cle), position: i, ...avecMontre(cle) })
    const peutLa = (cle: string) => peut(e, cle, avecMontre(cle))
    const pleine = rc.main.length >= mainMaxEnQuestion(rc.pouvoirs.includes('trois-tetes'), e.ascension)
    const garder = (cle: string) => rc.sorte === 'question' && !pleine && ['rare', 'epique', 'legendaire'].includes(carteDeRencontre(cle)?.rarete ?? '')
    const libres = (liste: readonly string[]) => liste.filter(c => peutLa(c) && !garder(c))
    const rang: Record<string, number> = { commun: 0, maudit: 1, rare: 1, epique: 2, legendaire: 3 }
    const rarete = (cle: string) => rang[carteDeRencontre(cle)?.rarete ?? 'commun'] ?? 0
    // L'erreur d'avant effacée lui rend son courage, s'il en manque — sa récompense suivante vide.
    if (rc.derniereFrappe >= 6 && courage <= 30 && peutLa('horizon')) return jouerLa('horizon')
    const restants = rc.sceaux
    const longue = rc.sorte !== 'question'
    if (q.sait || autre?.sait) {
      const sans = cransAvec(e, i, null)
      const plusTard = () => {
        const cle = libres(['augure', 'pourboire', ...(rc.defausse.length > 0 && rc.main.length <= 2 ? ['reveil'] : [])])[0]
        return cle ? jouerLa(cle) : null
      }
      // Il tombe de toute façon : rien à frapper, ce qui sert plus tard.
      if (sans >= restants) return plusTard()
      if (longue && restants - sans >= 2) {
        const pouvoir = libres(POUVOIRS_EN_QUESTION)[0]
        if (pouvoir) return jouerLa(pouvoir)
      }
      // Ce qui ajoute le plus de crans — sans compter ceux qu'il n'a plus à faire perdre —, la plus commune à crans égaux.
      const attaques = libres(ATTAQUES_EN_QUESTION)
        .map(c => ({ c, n: Math.min(restants, cransAvec(e, i, c)) }))
        .filter(x => x.n > sans)
        .sort((a, b) => b.n - a.n || rarete(a.c) - rarete(b.c))
      if (attaques.length > 0) return jouerLa(attaques[0].c)
      return plusTard()
    }
    // Deux visages joué, l'autre ne se sait pas non plus : plus rien à jouer, une carte par question.
    const attaque = attaqueEnQuestion({ frappe: frappeDeLaQuestion(rc), tour: rc.tour, pouvoirs: rc.pouvoirs })
    if (courage <= attaque) {
      const sauve = ['sursis', 'peau-de-feu', 'renaissance', 'passe-muraille'].find(peutLa)
      if (sauve) return jouerLa(sauve)
    }
    const base = chanceApres(e, i, null)
    const aides = libres(AIDES_EN_QUESTION.filter(c => c !== 'tout-ou-rien' || courage > 2 * attaque + 10))
      .map(c => ({ c, p: chanceApres(e, i, c) }))
      .sort((a, b) => b.p - a.p || rarete(a.c) - rarete(b.c))
    if (aides.length > 0 && aides[0].p > base + 0.05) return jouerLa(aides[0].c)
    if (attaque >= 7 || courage <= 20) {
      const sauve = libres(['sursis', 'peau-de-feu'])[0]
      if (sauve) return jouerLa(sauve)
    }
    return null
  }

  /** Une carte qui repose la question à une autre forme — Corser, Simplifier, Polymorphe, Miroir —, comme le serveur (`questionsApresLeGeste`) : ce qu'il sait, il le sait encore. */
  const reposer = (g: GesteDExpedition, i: number) => {
    const vers = g.quoi === 'jouer' ? formeDeLaCarte(g.joker) : undefined
    if (!vers) return
    const q = posees[i]
    posees[i] = vers === 'six' ? { ...q, forme: 'six', reponses: 6 } : { ...q, forme: 'vrai-faux', reponses: 2, nombre: undefined, reponseEn: undefined }
  }

  const carteVue = (e: EtatDeLExpedition): CarteDUnActe => {
    const carte = carteEnJeu(depart, e)!
    if (!carte.escales.some(x => x.sorte === 'inconnu')) return carte
    const boussole = e.talismans.includes('boussole')
    return {
      ...carte,
      escales: carte.escales.map(x => {
        if (x.sorte !== 'inconnu') return x
        const contenu = contenuDeLInconnu(depart.graine, e.acte, x.id)
        return boussole || e.trace.includes(x.id) || (e.lanterne && contenu === 'piege') ? { ...x, contenu } : x
      }),
    }
  }

  const lePlusSur = (e: EtatDeLExpedition, permises: readonly string[]): { trace: string[]; vaincre: number } | null => {
    const carte = carteVue(e)
    let meilleur: { trace: string[]; vaincre: number } | null = null
    for (const p of permises) {
      if (p === GARDIEN) continue
      const t = traceLePlusSur(carte, e.ici, e.vies, e.acte, { debut: [p] })
      if (t.length === 0) continue
      const { vaincre } = chancesDuTrace(carte, t, e.vies, e.acte)
      if (!meilleur || vaincre > meilleur.vaincre + 1e-9) meilleur = { trace: t, vaincre }
    }
    return meilleur
  }

  /** Une carte de route qui rend son tracé plus sûr, un coffre de plus, la lanterne ; le Commandement sur sa meilleure catégorie. */
  const surLaCarte = (e: EtatDeLExpedition, permises: string[]): GesteDExpedition | null => {
    const sansRien = lePlusSur(e, permises)?.vaincre ?? 0
    for (const cle of ['detour', 'raccourci'] as const) {
      if (!peut(e, cle)) continue
      const avec = lePlusSur(e, escalesPermises(depart, { ...e, route: { ...e.route, [cle]: true } }))?.vaincre ?? 0
      if (avec > sansRien + 0.01) return { quoi: 'jouer', joker: cle }
    }
    if ((e.courage ?? 0) < 40 && peut(e, 'maison')) return { quoi: 'jouer', joker: 'maison' }
    if (peut(e, 'boule')) return { quoi: 'jouer', joker: 'boule' }
    if (!e.talismans.includes('boussole') && peut(e, 'lanterne')) return { quoi: 'jouer', joker: 'lanterne' }
    const prochaine = lePlusSur(e, permises)?.trace[0]
    const sorte = prochaine ? escaleEnJeu(depart, e, prochaine)?.sorte : undefined
    if ((sorte === 'question' || sorte === 'elite') && peut(e, 'commandement', { categorie: fetiche })) return { quoi: 'jouer', joker: 'commandement', categorie: fetiche }
    return null
  }

  /**
   * Ce qu'il voudrait parmi ces cartes, du meilleur au moins bon — l'exemplaire
   * offert, l'amélioré d'abord (le jeu complet) : au codex, jamais une de plus
   * qu'il n'en garde — sous `--seule`, elle seule.
   */
  // Le joueur qui suit son style : ses cartes d'abord, à prendre comme à améliorer, et aucune à retirer.
  const sonStyle = style && SUIT_SON_STYLE ? cartesDuStyle(style) : []
  const preference = [...new Set([...sonStyle, ...PREFERENCE_DU_CODEX])]
  const ordreDesAmeliorations = [...new Set([...sonStyle, ...ORDRE_DES_AMELIORATIONS])]
  const aRetirer = (codex ? A_RETIRER_DU_CODEX : A_RETIRER).filter(c => !sonStyle.includes(c))
  const aPrendre = (e: EtatDeLExpedition, cartes: readonly string[]) =>
    (codex ? (seule !== null ? [seule] : preference) : PREFERENCE_DES_OFFRES).flatMap(c => {
      const offert = cartes.includes(ameliorer(c)) ? ameliorer(c) : cartes.includes(c) ? c : null
      if (offert === null) return []
      return codex && e.paquet.filter(x => baseDe(x) === c).length >= EXEMPLAIRES_DU_CODEX ? [] : [offert]
    })

  /** Les cartes de son paquet qu'il améliorerait (le jeu complet), la première d'abord ; aucune sous `--sans-ameliorations`. */
  const aAmeliorer = (e: EtatDeLExpedition): string[] => {
    if (SANS_AMELIORATIONS || VERSION < 8) return []
    const rang = (cle: string) => (ordreDesAmeliorations.includes(cle) ? ordreDesAmeliorations.indexOf(cle) : ordreDesAmeliorations.length)
    return [...new Set(e.paquet.filter(cle => refusDeLAmelioration(e.paquet, cle) === null))].sort((a, b) => rang(a) - rang(b))
  }

  const aAcheter = (e: EtatDeLExpedition): { article: ArticleDeLEchoppe; joker?: string } | null => {
    const etal = e.echoppe!
    const voulus: { article: ArticleDeLEchoppe; joker?: string }[] = [
      ...((e.courage ?? 0) <= COURAGE_MAX - 15 ? [{ article: 'vie' as const }] : []),
      ...(etal.fiole ? [{ article: 'fiole' as const }] : []),
      // Le jeu complet : une carte améliorée, après le courage et la fiole, avant une carte neuve.
      ...(etal.ameliorer
        ? aAmeliorer(e)
            .slice(0, 1)
            .map(cle => ({ article: 'ameliorer' as const, joker: cle }))
        : []),
      ...aPrendre(e, etal.jokers)
        .slice(0, 1)
        .map(cle => ({ article: 'joker' as const, joker: cle })),
      ...(etal.talisman && TALISMANS_UTILES.includes(etal.talisman) ? [{ article: 'talisman' as const }] : []),
    ]
    return voulus.find(a => refusDeLAchat(e, a) === null) ?? null
  }

  /** La fiole qu'il boirait maintenant — `i` : la question qui attend, que le geste vise —, ou null. */
  const aBoire = (e: EtatDeLExpedition, i: number | null): GesteDExpedition | null => {
    const boire = (fiole: CleDeFiole): GesteDExpedition | null =>
      e.fioles.includes(fiole) && refusDeLaFiole(e, fiole, posees) === null ? { quoi: 'boire', fiole, ...(i !== null && { position: i }) } : null
    const rc = e.rencontre
    return (
      ((e.courage ?? COURAGE_MAX) <= COURAGE_POUR_BOIRE ? boire('courage') : null) ??
      (rc?.tour.phase === 'preparation' && rc.sorte !== 'question' && rc.tour.inspiration <= INSPIRATION_PAR_QUESTION ? boire('energie') : null) ??
      (rc?.tour.phase === 'question' && i !== null && !posees[i].sait ? boire('clairvoyance') : null)
    )
  }

  for (let pas = 0; pas < 3000; pas++) {
    let e = plier()
    for (let tour = 0; e.aTirer && tour < 3; tour++) {
      const t = e.aTirer
      for (let k = 0; k < t.combien; k++) tirer(t, e)
      e = plier()
    }
    if (e.issue !== 'en-route') {
      return {
        auBout: e.issue === 'au-bout',
        acte: e.acte,
        questions: reponses.size,
        rencontres: e.rencontres,
        cartes: jouees,
        ecus: e.ecus + depenses,
        courage: e.courage ?? 0,
        renommee: renommeeDe(bilanDuPli(e)),
        exploits: e.exploits,
        gardiens: depart.gardiens,
        bues: gestes.filter(g => g.quoi === 'boire').length,
        offertes: offertes.size,
        differentes: differentes.size,
      }
    }
    if (e.offre) {
      const offre = e.offre
      for (const c of offre.jokers) offertes.add(baseDe(c))
      // Le coffre d'un gardien (v7) ouvre sur une légendaire : il la prend d'abord.
      const legendaires = offre.jokers.filter(c => carteDeRencontre(c)?.rarete === 'legendaire')
      const voulus = [...legendaires, ...aPrendre(e, offre.jokers)]
      const talisman =
        offre.talisman && TALISMANS_UTILES.includes(offre.talisman) && !voulus.some(c => baseDe(c) === 'double-chance' || baseDe(c) === 'bibliotheque') ? offre.talisman : undefined
      // La fiole d'un coffre, à la place d'une carte : s'il n'y voit pas l'une des meilleures, ou si le courage lui manque.
      const fiole =
        !talisman && offre.fiole && e.fioles.length < FIOLES_MAX && (!voulus.some(c => MEILLEURES_DU_CODEX.includes(c)) || ((e.courage ?? 0) <= 30 && offre.fiole === 'courage'))
          ? offre.fiole
          : undefined
      gestes.push({ quoi: 'prendre', jokers: talisman || fiole ? [] : voulus.slice(0, 1), ...(talisman && { talisman }), ...(fiole && { fiole }) })
      continue
    }
    if (e.echoppe && e.enAttente === null) {
      const achat = aAcheter(e)
      if (achat) {
        gestes.push({ quoi: 'acheter', ...achat })
        depenses += prixDeLArticle(achat.article, achat.joker)
        continue
      }
    }
    if (e.campement) {
      // Le jeu complet : son courage assez haut, il améliore sa meilleure carte plutôt que de se reposer — la forge de Slay the Spire.
      const ameliorer = (e.courage ?? 0) >= COURAGE_MAX - 15 ? aAmeliorer(e)[0] : undefined
      const retirer = !ameliorer && (e.courage ?? 0) >= COURAGE_MAX - 8 ? aRetirer.find(c => e.paquet.includes(c)) : undefined
      gestes.push({ quoi: 'camper', ...(retirer && { retirer }), ...(ameliorer && { ameliorer }) })
      continue
    }
    if (e.enAttente !== null) {
      const i = e.enAttente
      const rc = e.rencontre
      const bue = aBoire(e, i)
      if (bue) {
        gestes.push(bue)
        continue
      }
      if (rc && rc.tour.phase === 'preparation') {
        // À la question au centre, l'annonce ne tient que le pari et ses cartes.
        const g = EN_QUESTION ? enAnnonce(e, i) : enPreparation(e, i)
        if (g) {
          gestes.push(g)
          joue(g)
          reposer(g, i)
          continue
        }
        gestes.push({ quoi: 'voir', mise: miser(e, i), position: i })
        continue
      }
      if (rc) {
        const g = EN_QUESTION ? enQuestionAuCentre(e, i) : enQuestion(e, i)
        if (g) {
          gestes.push(g)
          joue(g)
          if (g.quoi === 'jouer' && g.joker === 'passe-muraille') reponses.set(i, false)
          // À la question au centre, Corser, Simplifier et Polymorphe se jouent la question vue.
          if (EN_QUESTION) reposer(g, i)
          continue
        }
      }
      // Deux visages : celle qu'il sait, s'il en sait une.
      const cible = e.autre !== null && !posees[i].sait && posees[e.autre]?.sait ? e.autre : i
      // Un dévoilement qu'il sait se répond à mi-texte — au tiers, le texte arrêté par Arrêt sur image.
      const arrete = !!e.rencontre && parmi(e.rencontre.tour.surLaQuestion, 'arret-sur-image')
      if (posees[cible].forme === 'devoilement') {
        const mots = posees[cible].sait ? MOTS_D_UN_DEVOILEMENT / (arrete ? 3 : 2) : MOTS_D_UN_DEVOILEMENT
        posees[cible] = { ...posees[cible], devoile: { mots, sur: MOTS_D_UN_DEVOILEMENT } }
      }
      reponses.set(cible, juger(cible, e))
      continue
    }
    // Sur le plan, son courage au plus bas : la fiole avant le pas suivant.
    const bue = aBoire(e, null)
    if (bue) {
      gestes.push(bue)
      continue
    }
    const permises = escalesPermises(depart, e)
    if (permises.includes(GARDIEN)) {
      gestes.push({ quoi: 'avancer', vers: GARDIEN })
      continue
    }
    const route = surLaCarte(e, permises)
    if (route) {
      gestes.push(route)
      joue(route)
      continue
    }
    gestes.push({ quoi: 'avancer', vers: lePlusSur(e, permises)?.trace[0] ?? permises[0] })
  }
  throw new Error(`l’expédition ${graine} ne finit pas`)
}

const pc = (x: number) => `${Math.round(x * 100)} %`
const virgule = (x: number) => x.toFixed(1).replace('.', ',')
const CAS: Cas[] =
  VERSION >= 7
    ? [
        { nom: 'Niveau 1 — sa première expédition, sans légendaire, la catégorie fétiche ouverte', equipee: [], niveau: 1 },
        { nom: 'Niveau 3 — le pari et les fioles ouverts', equipee: [], niveau: 3 },
        { nom: 'Niveau 6 — toutes les règles ouvertes, la Chouette et le Phénix gardés', equipee: ['lg:chouette', 'lg:phenix'], niveau: 6 },
        {
          nom: 'Niveau 10 — le codex entier, ses exploits faits, quatre légendaires gardés',
          equipee: ['lg:chouette', 'lg:phenix', 'lg:dragon', 'lg:janus'],
          niveau: 10,
          exploits: EXPLOITS.map(x => x.cle),
        },
      ]
    : [
        { nom: 'Le paquet de départ seul', equipee: [] },
        { nom: 'Avec la Chouette et le Phénix (l’Érudit, le Rempart)', equipee: ['lg:chouette', 'lg:phenix'] },
        { nom: 'Avec le Dragon d’Or et Janus (le Flambeur, le Métamorphe)', equipee: ['lg:dragon', 'lg:janus'] },
      ]
// `--cas 0` : un seul cas — un niveau au codex, une équipée avant —, le temps d'essayer un réglage ; `--niveau 4` : ce niveau seul, sans légendaire.
const UN_CAS = process.argv.includes('--cas') ? option('cas', 0) : null
const UN_NIVEAU: Cas | null = process.argv.includes('--niveau') ? { nom: `Niveau ${option('niveau', 1)}, sans légendaire`, equipee: [], niveau: option('niveau', 1) } : null
console.log(
  `Les rencontres (v${VERSION}) — ${EXPEDITIONS} expéditions par joueur et par équipée. Courage ${COURAGE_MAX}, ${VIES} vies d'avant en reflet.${ASCENSION_MESUREE > 0 ? ` Au cran ${ASCENSION_MESUREE} de l'Ascension.` : ''}\n`,
)
const moyenne = (liste: Issue[], f: (i: Issue) => number) => (liste.length === 0 ? 0 : liste.reduce((s, i) => s + f(i), 0) / liste.length)
/**
 * L'Ascension, cran par cran (`--ascensions`) : au codex entier — celui qui
 * va déjà au bout, pour qui elle est faite —, ce que chaque cran retire à
 * chacun, et ce qu'il lui reste de courage quand il y arrive.
 */
if (VERSION >= 7 && TOUTES_LES_ASCENSIONS) {
  const cas = UN_NIVEAU ?? CAS[UN_CAS ?? CAS.length - 1]
  console.log(`L’Ascension — ${cas.nom}, cran par cran.`)
  console.log(`  cran   ${JOUEURS.map(([nom]) => nom.padStart(7)).join('   ')}   questions du moyen   son courage au bout`)
  for (let cran = 0; cran <= ASCENSION_MAX; cran++) {
    const parJoueur = JOUEURS.map(([nom, theta]) => Array.from({ length: EXPEDITIONS }, (_, k) => jouer(unJoueur(theta, `calibrage:${nom}:${k}`), `calibrage:${k}`, cas, cran)))
    const moyen = parJoueur[1]
    console.log(
      `  ${String(cran).padStart(4)}   ${parJoueur.map(issues => pc(issues.filter(i => i.auBout).length / EXPEDITIONS).padStart(7)).join('   ')}   ${virgule(moyenne(moyen, i => i.questions)).padStart(18)}   ${virgule(moyenne(moyen.filter(i => i.auBout), i => i.courage)).padStart(19)}   ${cran > 0 ? ascensionDe(VERSION)[cran - 1].regle : 'sans cran'}`,
    )
  }
  console.log('')
}
/**
 * Chaque carte seule (`--cartes`), au codex entier : le joueur ne prend
 * qu'elle, deux au plus, contre ne rien prendre — ce qu'elle ajoute au bout,
 * pour le moyen et le fort. Une carte qui retire des points ne vaut pas sa
 * place : on la retouche avant de la ranger (le jeu complet, le 19 octobre
 * 2026 ; au codex, « débloquer ne doit jamais affaiblir »).
 */
if (VERSION >= 7 && TOUTES_LES_CARTES) {
  const cas = UN_NIVEAU ?? CAS[UN_CAS ?? CAS.length - 1]
  const mesures = ['moyen', 'fort'] as const
  const auBout = (seule: string) =>
    mesures.map(nom => {
      const theta = JOUEURS.find(([n]) => n === nom)![1]
      return Array.from({ length: EXPEDITIONS }, (_, k) => jouer(unJoueur(theta, `calibrage:${nom}:${k}`), `calibrage:${k}`, cas, ASCENSION_MESUREE, seule)).filter(i => i.auBout).length / EXPEDITIONS
    })
  console.log(`Chaque carte seule — ${cas.nom}, ${EXPEDITIONS} expéditions par joueur, contre ne rien prendre${PART.n > 1 ? ` (part ${PART.k} sur ${PART.n})` : ''}.`)
  const rien = auBout('rien')
  console.log(`  ${'rien'.padEnd(18)} ${rien.map(pc).join(' · ')}`)
  const aMesurer = CARTES_DES_RENCONTRES.filter(c => !c.legendaire && c.cle !== 'concentration' && c.cle !== 'prudence' && (!EN_QUESTION || seJoueEnQuestion(c.cle, VERSION)))
    .filter(c => !CARTES_MESUREES || CARTES_MESUREES.includes(c.cle))
    .filter((_, n) => n % PART.n === PART.k - 1)
  const lignes = aMesurer.map(c => {
    const a = auBout(c.cle)
    return { cle: c.cle, rarete: c.rarete, a, ecart: a.map((x, n) => Math.round((x - rien[n]) * 100)) }
  })
  for (const l of lignes.sort((x, y) => y.ecart[0] + y.ecart[1] - (x.ecart[0] + x.ecart[1])))
    console.log(`  ${l.cle.padEnd(18)} ${l.a.map(pc).join(' · ')}   ${l.ecart.map(x => (x >= 0 ? `+${x}` : `${x}`)).join(' · ')}   ${l.rarete}`)
  console.log('')
}
/**
 * Chaque style (`--styles`), niveau par niveau : la part qui va au bout, pour
 * les trois joueurs, de celui qui suit son style contre le départ sans style —
 * et la variété du moyen : les cartes différentes que ses offres lui
 * proposent, et celles qu'il joue.
 */
if (VERSION >= 7 && TOUS_LES_STYLES) {
  console.log(`Les styles — ${EXPEDITIONS} expéditions par joueur ; avec un style, le joueur le suit.`)
  for (const cas of UN_NIVEAU ? [UN_NIVEAU] : UN_CAS === null ? CAS : [CAS[UN_CAS]]) {
    console.log(cas.nom)
    console.log(`  style        ${JOUEURS.map(([nom]) => nom.padStart(7)).join('   ')}   offertes   jouées`)
    for (const style of [undefined, ...codexDuNiveau(cas.niveau ?? 1, cas.equipee, [], VERSION).styles]) {
      const parJoueur = JOUEURS.map(([nom, theta]) => Array.from({ length: EXPEDITIONS }, (_, k) => jouer(unJoueur(theta, `calibrage:${nom}:${k}`), `calibrage:${k}`, { ...cas, style })))
      const moyen = parJoueur[1]
      console.log(
        `  ${(style ?? 'sans style').padEnd(12)} ${parJoueur.map(issues => pc(issues.filter(i => i.auBout).length / EXPEDITIONS).padStart(7)).join('   ')}   ${virgule(moyenne(moyen, i => i.offertes)).padStart(8)}   ${virgule(moyenne(moyen, i => i.differentes)).padStart(6)}`,
      )
    }
    console.log('')
  }
}
for (const cas of TOUTES_LES_ASCENSIONS || TOUTES_LES_CARTES || TOUS_LES_STYLES ? [] : UN_NIVEAU ? [UN_NIVEAU] : UN_CAS === null ? CAS : [CAS[UN_CAS]]) {
  console.log(cas.nom)
  console.log('  joueur   au bout   arrêté à l’acte 1 · 2 · 3   questions   rencontres   cartes jouées   écus   courage au bout   renommée   fioles bues')
  for (const [nom, theta] of JOUEURS) {
    const issues = Array.from({ length: EXPEDITIONS }, (_, k) => jouer(unJoueur(theta, `calibrage:${nom}:${k}`), `calibrage:${k}`, cas))
    const auBout = issues.filter(i => i.auBout)
    const arrets = [0, 1, 2].map(a => issues.filter(i => !i.auBout && i.acte === a).length / EXPEDITIONS)
    console.log(
      `  ${nom.padEnd(8)} ${pc(auBout.length / EXPEDITIONS).padStart(7)}   ${arrets.map(pc).join(' · ').padStart(24)}   ${virgule(moyenne(issues, i => i.questions)).padStart(9)}   ${virgule(moyenne(issues, i => i.rencontres)).padStart(10)}   ${virgule(moyenne(issues, i => i.cartes)).padStart(13)}   ${String(Math.round(moyenne(issues, i => i.ecus))).padStart(4)}   ${virgule(moyenne(auBout, i => i.courage)).padStart(15)}   ${String(Math.round(moyenne(issues, i => i.renommee))).padStart(8)}   ${virgule(moyenne(issues, i => i.bues)).padStart(11)}`,
    )
  }
  console.log('')
}

/**
 * Au codex, la carrière : des joueurs partis du niveau 1 enchaînent les
 * expéditions, chacune au codex de leur renommée d'alors ; au bout, ils
 * gardent un gardien qu'ils n'avaient pas, dont la carte rejoint leur codex.
 * Combien d'expéditions pour chaque niveau, et combien vont au bout en
 * chemin : ce que le joueur vit, là où le tableau d'au-dessus fige un niveau.
 * Ses exploits aussi : faits, leur carte s'ouvre à l'expédition suivante —
 * et quand chacun tombe, et pour combien de joueurs en vingt expéditions.
 */
// Pas sous `--cartes` : chaque carte seule se mesure à un niveau, et la carrière doublait le temps de la mesure pour rien.
if (VERSION >= 7 && !UN_NIVEAU && UN_CAS === null && !TOUTES_LES_ASCENSIONS && !TOUS_LES_STYLES && !TOUTES_LES_CARTES) {
  const CARRIERES = Math.max(20, Math.round(EXPEDITIONS / 10))
  const LONGUEUR = 20
  const TRANCHES: [string, number, number][] = [
    ['les 3 premières', 0, 3],
    ['de la 4e à la 10e', 3, 10],
    ['de la 11e à la 20e', 10, 20],
  ]
  console.log(`La carrière — ${CARRIERES} joueurs de chaque sorte, ${LONGUEUR} expéditions chacun, du niveau 1.`)
  console.log(`  joueur   expéditions pour le niveau ${NIVEAUX.slice(1).map((_, i) => i + 2).join(' · ')}   au bout : ${TRANCHES.map(([nom]) => nom).join(' · ')}`)
  const parExploit = new Map<string, { nom: string; premieres: number[] }[]>()
  for (const [nom, theta] of JOUEURS) {
    // Pour chaque niveau, l'expédition — comptée de 1 — où chaque carrière l'a atteint ; Infinity : pas en vingt.
    const atteint: number[][] = NIVEAUX.slice(1).map(() => [])
    const exploitsFaits: number[][] = EXPLOITS.map(() => [])
    const tranches = TRANCHES.map(() => ({ auBout: 0, jouees: 0 }))
    for (let c = 0; c < CARRIERES; c++) {
      const j = unJoueur(theta, `carriere:${nom}:${c}`)
      const siens: string[] = []
      const faits: CleDExploit[] = []
      let renommee = 0
      const premiere = NIVEAUX.slice(1).map(() => Infinity)
      const premierExploit = EXPLOITS.map(() => Infinity)
      for (let k = 0; k < LONGUEUR; k++) {
        const issue = jouer(j, `carriere:${nom}:${c}:${k}`, { nom, equipee: siens, niveau: niveauDe(renommee), exploits: [...faits] })
        renommee += issue.renommee
        const garde = issue.auBout ? issue.gardiens.find(g => !siens.includes(g)) : undefined
        if (garde) siens.push(garde)
        for (const x of issue.exploits) if (!faits.includes(x)) faits.push(x)
        NIVEAUX.slice(1).forEach((seuil, n) => {
          if (renommee >= seuil && premiere[n] === Infinity) premiere[n] = k + 1
        })
        EXPLOITS.forEach((x, n) => {
          if (faits.includes(x.cle) && premierExploit[n] === Infinity) premierExploit[n] = k + 1
        })
        const t = TRANCHES.findIndex(([, de, a]) => k >= de && k < a)
        tranches[t].jouees++
        if (issue.auBout) tranches[t].auBout++
      }
      premiere.forEach((k, n) => atteint[n].push(k))
      premierExploit.forEach((k, n) => exploitsFaits[n].push(k))
    }
    const mediane = (liste: number[]) => [...liste].sort((a, b) => a - b)[Math.floor(liste.length / 2)]
    const pour = atteint.map(liste => (mediane(liste) === Infinity ? '—' : String(mediane(liste))))
    console.log(`  ${nom.padEnd(8)} ${pour.join(' · ').padEnd(44)}   ${tranches.map(t => pc(t.auBout / t.jouees)).join(' · ')}`)
    parExploit.set(nom, exploitsFaits.map((premieres, n) => ({ nom: EXPLOITS[n].cle, premieres })))
  }
  console.log('')
  // Chaque exploit : la part des joueurs qui l'ont fait en vingt expéditions, et à la combientième la médiane d'entre eux.
  console.log(`Les exploits — en ${LONGUEUR} expéditions : la part des joueurs qui l'ont fait, et à la combientième, pour la médiane d'entre eux.`)
  console.log(`  joueur   ${EXPLOITS.map(x => x.cle).join(' · ')}`)
  for (const [nom, exploits] of parExploit) {
    const dits = exploits.map(({ premieres }) => {
      const faites = premieres.filter(k => k !== Infinity).sort((a, b) => a - b)
      return faites.length === 0 ? '—' : `${pc(faites.length / premieres.length)} (${faites[Math.floor(faites.length / 2)]}e)`
    })
    console.log(`  ${nom.padEnd(8)} ${dits.join(' · ')}`)
  }
  console.log('')
}
console.log(
  VERSION >= 7
    ? 'La cible du codex : on progresse en jouant — un niveau à chaque expédition au début, le codex entier en une douzaine pour le moyen — et débloquer n’affaiblit jamais : le moyen ne va pas moins souvent au bout à mesure qu’il monte. Questions : celles d’une expédition jouée jusqu’à sa fin, au bout ou perdue ; une carrière : la médiane des joueurs.'
    : 'La cible : le moyen au bout une fois sur trois, le fort huit fois sur dix (`retours/2026-10-17/expedition.md`). Questions : celles d’une expédition jouée jusqu’à sa fin, au bout ou perdue.',
)
