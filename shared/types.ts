// Types partagés entre le client et le serveur.

/** Joueur tel que visible par tout le monde. */
export interface PublicPlayer {
  id: string
  name: string
  avatar: string
  connected: boolean
  /** Score cumulé sur toute la soirée (tous les quiz confondus). */
  score: number
}

/** La partie de quiz en cours — il n'y en a jamais plus d'une à la fois. */
export interface SessionSummary {
  id: string
  participantIds: string[]
}

/** État global de la soirée, diffusé à tous les écrans. */
export interface PartySnapshot {
  players: PublicPlayer[]
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
  /** Nombre de quiz joués dans la soirée. */
  quizCount: number
  /** Total des points distribués. */
  totalPoints: number
  /** Le plus gros coup sur une seule question. */
  bestShot: { name: string; avatar: string; points: number; reason: string } | null
  /** Celui qui a marqué sur le plus de questions. */
  steadiest: { name: string; avatar: string; count: number } | null
}
