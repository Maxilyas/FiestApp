// Types partagés entre le client et le serveur.
import type { ArchiveSummary, DerniereSoiree } from './archive'
import type { PublicSpace } from './space'
import type { Finition } from './profil'

/** Joueur tel que visible par tout le monde. */
export interface PublicPlayer {
  id: string
  name: string
  avatar: string
  /**
   * Son téléphone est-il connecté ? Seul l'écran commun le reçoit : dans
   * l'instantané des téléphones, chaque veille d'écran renvoyait sinon toute
   * la salle à tout le monde.
   */
  connected?: boolean
  /** Score cumulé sur toute la soirée (tous les quiz confondus). */
  score: number
  /** Son équipe, ou null tant qu'il n'en a pas choisi. */
  teamId: string | null
  /**
   * Ce qu'un profil ajoute — et rien du tout pour un invité anonyme.
   *
   * Ces trois champs sont absents, pas à zéro : un invité sans profil ne doit
   * porter ni « Niv. 0 » ni pastille grise. L'absence, pas l'infériorité. Ils
   * ne donnent d'ailleurs aucun avantage de jeu, seulement du prestige.
   */
  niveau?: number
  finition?: Finition
  /** Son avatar a éclaté : il brille, et lui seul. */
  eclat?: boolean
  /** L'avatar dessiné qu'il porte — légendaire ou Divin : il remplace l'emoji à l'écran. */
  legendaire?: string
  /**
   * Le prénom à afficher quand un homonyme porte le même avatar — « Camille
   * (2) ». Absent, et non pas égal au prénom, dans l'immense majorité des
   * cas : l'instantané part à toute la salle, il ne porte que ce qui diffère.
   */
  nomAffiche?: string
}

/**
 * Une équipe et son score au quiz.
 *
 * Le score retenu est la **moyenne par membre**, pas le total : les équipes
 * n'ont jamais exactement le même effectif, et une équipe de neuf gagnerait
 * mécaniquement contre une équipe de six.
 */
export interface PublicTeam {
  id: string
  name: string
  emoji: string
  /** Ordre d'affichage, stable — c'est celui de la création. */
  position: number
  memberCount: number
  /** Somme des points des membres — affichée à titre indicatif. */
  total: number
  /**
   * La moyenne de l'équipe (`moyenneAuProrata`, `shared/teams.ts`) : pour
   * chaque question, la moyenne des lignes du journal jouées pour elle, et la
   * somme de ces moyennes. Elle donne les points d'équipe ; les prix s'y
   * ajoutent, et ce sont eux qui classent.
   */
  average: number
  /** Points de prix attribués à la main par l'animateur, cumulés. */
  bonus: number
}

/** Un prix remis par l'animateur, sur la même échelle que le barème du quiz. */
export interface TeamBonus {
  id: string
  teamId: string
  points: number
  reason: string
  createdAt: number
}

/** La partie de quiz en cours — il n'y en a jamais plus d'une à la fois. */
export interface SessionSummary {
  id: string
  participantIds: string[]
}

/** État global de la soirée, diffusé à tous les écrans. */
export interface PartySnapshot {
  players: PublicPlayer[]
  teams: PublicTeam[]
  /** Les prix déjà remis — l'animateur doit pouvoir en retirer un. */
  bonuses: TeamBonus[]
  session: SessionSummary | null
  /** URL à faire ouvrir aux téléphones — c'est elle qu'on met dans le QR code. */
  joinUrl: string | null
  /** Wifi de la soirée (env WIFI_SSID/WIFI_PASS) — affiché en QR sur l'écran commun. */
  wifi: { ssid: string; pass: string } | null
  /** L'espace de la soirée : son nom dans l'adresse, ses titres. */
  space: PublicSpace
  /**
   * La base permanente refuse les écritures de la soirée depuis un moment :
   * la soirée continue, mais un réveil sur disque effacé perdrait ce qui
   * attend. Envoyé à l'écran commun seulement, et absent quand tout va bien
   * — il ne change qu'aux transitions, jamais à chaque essai.
   */
  sauvegardeEnRetard?: true
}

/** Page souvenir : ce qu'il reste de la soirée, le lendemain. */
export interface RecapRow {
  name: string
  avatar: string
  points: number
}

/** Le détail d'un joueur sur toute la soirée, dérivé du journal des réponses. */
export interface PlayerStat {
  playerId: string
  name: string
  avatar: string
  teamId: string | null
  points: number
  /** Questions où il était dans la partie (les retardataires en ont moins). */
  asked: number
  answered: number
  missed: number
  correct: number
  wrong: number
  /** % de bonnes réponses parmi les QCM auxquels il a répondu. */
  accuracy: number | null
  /** Temps de réponse moyen sur ses bonnes réponses, en ms. */
  avgMs: number | null
  bestMs: number | null
  /** Plus longues séries de bonnes / de mauvaises réponses. */
  bestStreak: number
  worstStreak: number
  /** Nombre de fois où il s'est ravisé avant la révélation. */
  changes: number
  /** Réponses validées dans la dernière seconde. */
  lastSecond: number
  /** Fois où il était seul sur sa réponse / où il a suivi la majorité. */
  alone: number
  followed: number
  /** Estimations : nombre jouées, exactes, écart relatif moyen, biais signé. */
  guesses: number
  exact: number
  avgGapPct: number | null
  bias: number | null
  /**
   * Le coup d'œil de ses estimations : en moyenne, la part de la salle que
   * chacune bat ou égale — ce que la précision est aux QCM. Null sans
   * estimation mesurée à une autre.
   */
  coupDOeil: number | null
  /** Sa base : les estimations mesurées à au moins une autre proposition. */
  estimationsComparees: number
}

/**
 * Un prix de fin de soirée. L'application le calcule et le propose ; c'est
 * l'animateur qui décide de le remettre et de combien de points il le dote.
 */
export interface Award {
  key: string
  emoji: string
  title: string
  /** La règle du prix, telle qu'on l'annonce à la salle. */
  rule: string
  /** Le chiffre qui le justifie (« 2,4 s de moyenne »). */
  detail: string
  /** Le lauréat, quand le prix distingue une personne. */
  player: { playerId: string; name: string; avatar: string } | null
  /** L'équipe qui encaisserait les points — null si le lauréat n'en a pas. */
  teamId: string | null
}

export interface PartyStats {
  players: PlayerStat[]
  awards: Award[]
  /** Questions posées sur toute la soirée, tous quiz confondus. */
  questions: number
  /** Réponses enregistrées — zéro tant qu'aucun quiz n'a été joué. */
  logged: number
}

export interface Recap {
  ranking: RecapRow[]
  /** Les équipes et leur score au quiz — `rankTeams` en tire le classement. */
  teams: PublicTeam[]
  /** Toutes les statistiques de la soirée, prix compris. */
  stats: PartyStats
  /** Nombre de quiz joués dans la soirée. */
  quizCount: number
  /** Total des points distribués. */
  totalPoints: number
  /** Le plus gros coup sur une seule question. */
  bestShot: { name: string; avatar: string; points: number; reason: string } | null
  /** Celui qui a marqué sur le plus de questions. */
  steadiest: { name: string; avatar: string; count: number } | null
  /**
   * Le vainqueur de chaque quiz de la soirée — autant de prix à remettre. Des
   * ex æquo ont chacun leur ligne, avec la même partie : c'est elle, et pas
   * le titre, qui dit qu'ils ont gagné ensemble. Absente des pages d'avant.
   */
  quizWinners: { title: string; name: string; avatar: string; points: number; sessionId?: string }[]
  /**
   * Les prix remis à l'écran, prix libres compris, du premier au dernier.
   * Le palmarès (`stats.awards`) dit ce que l'application a calculé ; ceci
   * dit ce que l'animateur a remis — « Le coup de cœur de Sam » n'existe
   * que là.
   */
  bonuses: TeamBonus[]
  /** Présent quand la page relit une soirée archivée plutôt que celle en cours. */
  archive?: ArchiveSummary
  /**
   * L'identifiant de la soirée en cours dans l'historique, dès qu'elle a joué :
   * « Copier » et « Partager » donnaient `/<espace>/souvenir`, l'adresse qui
   * changera de soirée à la suivante. L'archive existe dès le premier quiz
   * rangé. Absent d'un serveur d'avant.
   */
  soireeId?: string
  /** Présent quand la soirée en cours n'a rien joué : la dernière soirée close, à montrer à sa place. */
  derniere?: DerniereSoiree
  /** L'espace dont la page parle — ses titres, sa date. */
  space?: PublicSpace
}
