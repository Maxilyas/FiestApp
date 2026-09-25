// Vues et actions du Quiz (QCM style Kahoot + estimation chiffrée).
import type { QuestionKind, Variante } from '../library'
import type { Distinctions } from '../profil'
import type { Multiplicateur } from '../programme'

/**
 * `observe` : la photo est projetée seule, sans la question ni les réponses.
 * C'est ce qui rend le jeu de mémoire possible — sans cette phase, il suffirait
 * de répondre pendant que la photo est encore à l'écran.
 */
/**
 * `cible` : une estimation en direct (`enDirect`) est close, et l'animateur
 * tape la bonne réponse — le poids du gâteau — avant la révélation.
 */
export type QuizPhase = 'pickPack' | 'getReady' | 'intertitre' | 'observe' | 'question' | 'cible' | 'reveal' | 'finished'

/** « Qui dans la salle ? » : un invité, et les votes qu'il a reçus. */
export interface VoteDeSondage {
  name: string
  avatar: string
  votes: number
}

export interface QuizPackInfo {
  id: string
  title: string
  questionCount: number
  /** Déjà joué ce soir : l'animateur ne le relance pas sans le savoir. */
  joueCeSoir?: true
  /**
   * Ce qui se dérive de ses questions, pour le reconnaître sans l'ouvrir :
   * ses catégories (la plus fréquente d'abord), ses estimations, sa durée
   * estimée en secondes. Absents d'une partie lancée avant qu'ils existent.
   */
  categories?: string[]
  estimations?: number
  dureeS?: number
  /** Sa place au programme de ce soir (1 pour le premier), et son multiplicateur réglé d'avance. */
  auProgramme?: { rang: number; multiplier: Multiplicateur }
}

/**
 * Le programme de ce soir, vu de la console au moment de choisir
 * (`shared/programme.ts`). Écrans d'animateur seulement : il annonce les
 * titres à venir, et les téléphones n'ont pas à les lire.
 */
export interface ProgrammeDuSoir {
  titre: string
  /** Les quiz du programme qui se jouent encore. */
  total: number
  /** Le premier qu'on n'a pas joué ce soir, et celui d'après ; null quand tout est joué. */
  prochain: string | null
  ensuite: string | null
}

/**
 * Ce que la soirée transmet au quiz qu'on lance : l'enchaînement choisi au
 * quiz d'avant — il repassait « au clic » à chaque quiz — et les quiz déjà
 * joués. Oublié à la clôture, avec les parties de la soirée.
 */
export interface LancementDeQuiz {
  autoNextSeconds?: number | null
  joues?: string[]
}

export interface QuizPodiumRow extends Distinctions {
  name: string
  avatar: string
  points: number
  /**
   * Le rang partagé, calculé sur tout le classement : l'écran commun affiche
   * la suite du podium à partir du quatrième, et un quatrième ex æquo du
   * troisième ne saurait pas sinon qu'il est troisième.
   */
  rank: number
}

/**
 * Un voisin au classement du quiz, tel qu'un téléphone le reçoit : qui, ses
 * points, son rang. Le téléphone le décore lui-même — prénom affiché, avatar,
 * niveau — avec l'instantané de la salle qu'il a déjà : décorés au serveur,
 * deux voisins par téléphone feraient décorer toute la salle à chaque
 * révélation, et un prénom renommé ne les suivrait pas.
 */
export interface VoisinAuClassement {
  id: string
  points: number
  rang: number
}

/**
 * Sa place au classement du quiz, entre deux questions : ceux qui
 * l'encadrent, et d'où il vient. Quelques octets par téléphone, lus dans un
 * classement trié une fois pour toute la salle — jamais le classement
 * entier, qui ferait à 500 invités 500 lignes pour chacun des 500 téléphones.
 */
export interface PlaceAuQuiz {
  // « Sur combien » n'y est pas : il dépend de toute la salle, et une
  // exclusion pendant la révélation renverrait sa vue à chaque téléphone. Le
  // téléphone le lit dans l'instantané, que l'exclusion renvoie déjà à tous.
  /** Le plus proche strictement devant lui — un ex æquo n'est pas devant. Absent pour qui mène. */
  devant?: VoisinAuClassement
  /** Le plus proche strictement derrière lui. Absent pour le dernier. */
  derriere?: VoisinAuClassement
  /** Combien d'autres partagent son rang. Absent : personne. */
  exAequo?: number
  /**
   * Son rang avant la question révélée, quand il a changé. Absent tant que
   * personne n'avait marqué : à zéro, tout le monde était premier ex æquo, et
   * chacun aurait « perdu des places » qu'il n'avait jamais eues.
   */
  avant?: number
}

/** Estimation : ce que chacun a proposé, du plus proche au plus loin. */
export interface QuizGuessRow extends Distinctions {
  name: string
  avatar: string
  value: number
  points: number
  /** Le rang partagé à égalité d'écart : 7,9 et 8,1 pour 8 sont premiers ensemble. */
  rank: number
}

export interface QuizPlayerView {
  phase: QuizPhase
  qIndex: number
  /**
   * Le tour : il avance chaque fois qu'une question est posée, « Reposer »
   * compris. Même numéro, autre tour — c'est ce qui distingue une question
   * reposée de sa première fois. Les réponses le renvoient (voir `Visee`).
   * Absent d'une partie lancée avant qu'il existe.
   */
  round?: number
  qCount: number
  kind?: QuestionKind
  yourChoice: number | null
  /** Estimation : le nombre proposé, modifiable tant que tout le monde n'a pas répondu. */
  yourGuess?: number | null
  // question + reveal
  text?: string
  answers?: string[]
  unit?: string
  /** La catégorie de la question, si elle en porte une : l'écran l'affiche au-dessus. */
  category?: string
  image?: string | null
  /** La photo a été observée puis retirée : à répondre de mémoire. */
  photoGone?: boolean
  deadline?: number
  /** Secondes allouées à la question — pour la barre de temps qui se vide. */
  duration?: number
  /** Points multipliés pour ce quiz (1, 2 ou 3) — annoncé à toute la salle. */
  multiplier?: number
  /** L'animateur a figé le chronomètre : plus personne ne peut répondre. */
  paused?: boolean
  /** Temps restant figé, en millisecondes (uniquement en pause). */
  remainingMs?: number
  // reveal
  /** Vrai si le joueur vient d'arriver : il n'a pas raté la question, il n'était pas là. */
  justArrived?: boolean
  /** L'intertitre qui précède la question — « Manche 2 : le cinéma » —, pendant sa diapo. */
  intertitre?: string
  /** QCM : sa variante (`shared/library.ts`). Pour un sondage, `answers` sont les invités. */
  variante?: Variante
  /** « Plusieurs » et « ordre » : ce que le joueur a envoyé — les cases cochées, l'ordre choisi. */
  yourChoices?: number[] | null
  /** À la révélation : les bonnes réponses (« plusieurs »), le bon ordre (« ordre »). */
  bonnes?: number[]
  ordre?: number[]
  /** À la révélation d'une variante : juste ou non, pour ce joueur. */
  yourCorrect?: boolean
  /** Sondage, à la révélation : les invités les plus désignés. */
  votes?: VoteDeSondage[]
  /** « Le saviez-vous ? » — à la révélation seulement : avant, il trahirait la réponse. */
  anecdote?: string
  /** La photo de la révélation, distincte de celle de la question — à la révélation seulement. */
  imageRevelation?: string
  correct?: number
  target?: number
  yourPoints?: number | null
  /**
   * L'animateur a annulé les points de la question. `yourPoints` passe alors
   * à null, et le téléphone doit le dire plutôt qu'afficher « + pts ».
   */
  cancelled?: boolean
  yourQuizTotal?: number
  /** Rang dans le quiz, partagé à égalité : trois joueurs à zéro sont premiers ensemble. */
  yourQuizRank?: number
  /**
   * Sa place au classement du quiz — à la révélation et au podium, pour qui a
   * joué. Jamais pendant la question : les points ne tombent qu'à la
   * révélation, et rien ne s'y calcule pour une réponse.
   */
  place?: PlaceAuQuiz
  // finished
  podium?: QuizPodiumRow[]
  /**
   * Au podium : un autre quiz s'est joué avant celui-ci, ce soir. Le
   * classement de la soirée n'est plus celui du quiz, et le téléphone dit
   * les deux — au premier quiz, ils n'en font qu'un.
   */
  soireeEntamee?: true
  /**
   * Sa ligne sur le podium (0 à 2), s'il y monte. Le podium est le même pour
   * toute la salle ; seule cette place dépend du téléphone, pour qu'il s'y
   * voie surligné comme au classement de la salle d'attente.
   */
  yourPodiumIndex?: number
}

/** Un invité que la question attend encore, tel que la console le montre. */
export interface QuizAttendu {
  playerId: string
  /** Le nom affiché, marque d'homonymie comprise : « Camille (2) ». */
  name: string
  avatar: string
  /** Son téléphone ne répond plus : c'est peut-être une panne définitive. */
  horsLigne?: true
  /**
   * L'animateur a choisi de ne plus l'attendre : la question se révèle sans
   * lui. Il peut toujours répondre, et redevient attendu à la première
   * question qu'on pose une fois qu'il est revenu.
   */
  dispense?: true
}

export interface QuizHostView {
  phase: QuizPhase
  qIndex: number
  /** Le tour de la question — voir `QuizPlayerView.round`. Les commandes le renvoient. */
  round?: number
  qCount: number
  packTitle?: string
  /** Points multipliés pour ce quiz (1, 2 ou 3). */
  multiplier?: number
  kind?: QuestionKind
  // pickPack
  packs?: QuizPackInfo[]
  programme?: ProgrammeDuSoir
  /** L'intertitre, pendant sa diapo (voir `QuizPlayerView.intertitre`). */
  intertitre?: string
  /** À la révélation : l'anecdote et la photo qui l'accompagne. */
  anecdote?: string
  imageRevelation?: string
  /**
   * La note de l'animateur : les écrans d'animateur la reçoivent, et seule
   * la télécommande la montre — la télé, c'est la salle qui la lit.
   */
  note?: string
  /** QCM : sa variante ; à la révélation, ses bonnes réponses et son bon ordre. */
  variante?: Variante
  bonnes?: number[]
  ordre?: number[]
  /** Sondage, à la révélation : les invités les plus désignés, et combien ont voté. */
  votes?: VoteDeSondage[]
  /** Estimation en direct : la cible se tape à la révélation (phase `cible`). */
  enDirect?: boolean
  /** Blind test : l'extrait que joue l'écran commun — jamais les téléphones. */
  son?: string
  // question + reveal
  text?: string
  answers?: string[]
  unit?: string
  /** La catégorie de la question, si elle en porte une : l'écran l'affiche au-dessus. */
  category?: string
  image?: string | null
  /** La photo a été observée puis retirée : à répondre de mémoire. */
  photoGone?: boolean
  deadline?: number
  /** Secondes allouées à la question — pour la barre de temps qui se vide. */
  duration?: number
  paused?: boolean
  remainingMs?: number
  /** Secondes avant la question suivante, ou null si l'animateur pilote. */
  autoNextSeconds?: number | null
  /** Échéance de l'enchaînement automatique, pendant une révélation. */
  autoNextAt?: number
  /** L'enchaînement attend le clic : personne n'a répondu à la question révélée. */
  autoNextSuspendu?: boolean
  answeredCount?: number
  participantCount?: number
  /**
   * Ceux que la question attend encore — la vue de l'animateur seulement,
   * jamais celle d'un téléphone. Les hors-ligne d'abord : c'est d'eux que
   * l'animateur a besoin, le fantôme dont le téléphone est mort attendu à
   * chaque question.
   */
  attendus?: QuizAttendu[]
  /** Attendus au-delà de la liste : une grande salle n'a pas besoin de cinq cents prénoms. */
  attendusEnPlus?: number
  // reveal + finished
  correct?: number
  target?: number
  counts?: number[]
  guesses?: QuizGuessRow[]
  fastest?: { name: string; ms: number } | null
  /** Les points de la question révélée ont été annulés. */
  cancelled?: boolean
  standings?: QuizPodiumRow[]
}

/**
 * La question à laquelle s'adresse une réponse : son numéro, et son tour.
 *
 * Sans elle, une réponse tapée sur la question 1 et retenue par une coupure
 * s'inscrivait sur la question 2, que l'invité n'avait jamais vue — chrono
 * compté depuis le début de la 2, et parfois « le plus rapide ». Le serveur la
 * refuse maintenant comme « trop tard ».
 *
 * Facultative : un téléphone resté sur une page d'avant ne l'envoie pas, et
 * garde l'ancien comportement.
 */
export interface QuestionVisee {
  qIndex?: number
  round?: number
}

/**
 * Le moment qu'une commande de l'animateur visait : la question, et la phase
 * qu'il avait sous les yeux.
 *
 * « Suivant » se lisait selon la phase COURANTE : un « Révéler » arrivé juste
 * après la révélation automatique devenait « Question suivante », et la salle
 * ne voyait ni la bonne réponse ni le classement. Une commande qui ne vise
 * plus le moment présent — double clic, deux écrans, enchaînement automatique
 * qui croise le clic — est ignorée sans un mot : c'est un doublon, pas un ordre.
 */
export interface Visee extends QuestionVisee {
  phase?: QuizPhase
}

export type QuizAction =
  | ({ type: 'answer'; choice: number } & QuestionVisee)
  | ({ type: 'guess'; value: number } & QuestionVisee)
  /** « Plusieurs » : les cases cochées. */
  | ({ type: 'answers'; choices: number[] } & QuestionVisee)
  /** « Ordre » : les réponses dans l'ordre choisi, en index de celles montrées. */
  | ({ type: 'order'; order: number[] } & QuestionVisee)

export type QuizCommand =
  /** `multiplier` : 1 par défaut, 2 ou 3 pour un quiz qui compte double ou triple. */
  | { type: 'selectPack'; packId: string; multiplier?: number }
  | ({ type: 'next' } & Visee)
  /** Fige le chronomètre (discours, gâteau qui arrive…) et le repart. */
  | { type: 'pause' }
  | { type: 'resume' }
  /** Retire les points de la question révélée — quand la réponse était fausse. */
  | ({ type: 'cancel' } & Visee)
  /** Annule et repose la même question. */
  | ({ type: 'replay' } & Visee)
  /** Estimation en direct : la bonne réponse, tapée par l'animateur — elle révèle. */
  | ({ type: 'cible'; value: number } & Visee)
  /** Enchaîne les questions tout seul après N secondes ; null = manuel. */
  | { type: 'autoNext'; seconds: number | null }
  /**
   * Ne plus attendre cet invité hors ligne : la révélation automatique
   * revient. C'est l'animateur qui choisit — le serveur, lui, attend toujours
   * un téléphone muet, qui n'a peut-être qu'un hoquet de réseau.
   */
  | { type: 'nePlusAttendre'; playerId: string }
