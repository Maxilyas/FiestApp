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
