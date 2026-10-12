import type { IssueDeRencontre } from '../../../shared/campagne'
import type { CleDeLigue, EnjeuDuDuel } from '../../../shared/duels'

// Ce qu'une rencontre — un duel classé (`shared/duels.ts`) — écrit d'elle-même,
// sur l'écran de la partie (`CampagneApp`) comme dans la page des duels
// (`Duels.tsx`) : quelques lignes, que la campagne garde sans faire venir le
// code des duels.

/** Le score d'une rencontre, toi d'abord : « Toi 7 – Tom 6 ». */
export const scoreDeRencontre = (toi: number, a: { nom: string }, lui: number) => `Toi ${toi} – ${a.nom} ${lui}`

/** Ce que dit une rencontre finie, en un mot. */
export const MOT_DE_L_ISSUE: Record<IssueDeRencontre, string> = { gagnee: 'Gagné', egalite: 'Égalité', perdue: 'Perdu' }

/** Un écart de cote, signé : « +14 », « −9 » — le vrai signe moins —, « ±0 ». */
export const ecartSigne = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0')

/**
 * Celui qu'on affronte dans un duel contre quelqu'un, tel que la partie le
 * dit à chaque question : son prénom, son avatar, sa ligue — et la sienne,
 * pour les anneaux de la fin —, s'il a déjà joué, et ce que le duel met en
 * jeu sur sa cote. Jamais son score : il se dévoile à sa dernière réponse
 * (le souhait du propriétaire du 12 octobre 2026 : « à battre : 8 » se lisait
 * avant même la première question).
 */
export interface ContreEnJeu {
  nom: string
  avatar: string
  ligue?: CleDeLigue
  maLigue?: CleDeLigue
  /** Il l'a lancé et joué : son score attend la dernière réponse. Sinon, il jouera après. */
  aDejaJoue?: true
  enjeu?: EnjeuDuDuel
}
