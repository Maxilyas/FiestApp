// Types partagés entre le client et le serveur.

/** Joueur tel que visible par tout le monde. */
export interface PublicPlayer {
  id: string
  name: string
  avatar: string
  connected: boolean
  /** Score cumulé sur toute la soirée (tous les quiz confondus). */
  score: number
  /** Son équipe, ou null tant qu'il n'en a pas choisi. */
  teamId: string | null
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
  /** total ÷ memberCount, arrondi. C'est lui qui classe les équipes. */
  average: number
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
  session: SessionSummary | null
  /** URL à faire ouvrir aux téléphones — c'est elle qu'on met dans le QR code. */
  joinUrl: string | null
  /** Wifi de la soirée (env WIFI_SSID/WIFI_PASS) — affiché en QR sur l'écran commun. */
  wifi: { ssid: string; pass: string } | null
}

/** Page souvenir : ce qu'il reste de la soirée, le lendemain. */
export interface RecapRow {
  name: string
  avatar: string
  points: number
}

export interface Recap {
  ranking: RecapRow[]
  /** Les équipes et leur score au quiz — `rankTeams` en tire le classement. */
  teams: PublicTeam[]
  /** Nombre de quiz joués dans la soirée. */
  quizCount: number
  /** Total des points distribués. */
  totalPoints: number
  /** Le plus gros coup sur une seule question. */
  bestShot: { name: string; avatar: string; points: number; reason: string } | null
  /** Celui qui a marqué sur le plus de questions. */
  steadiest: { name: string; avatar: string; count: number } | null
  /** Le vainqueur de chaque quiz de la soirée — autant de prix à remettre. */
  quizWinners: { title: string; name: string; avatar: string; points: number }[]
}
