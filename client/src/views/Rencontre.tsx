import type { Adversaire, IssueDeRencontre } from '../../../shared/campagne'
import type { EnjeuDuDuel } from '../../../shared/duels'

// Ce qu'une rencontre — un duel classé (`shared/duels.ts`) — écrit d'elle-même,
// sur l'écran de la partie (`CampagneApp`) comme dans la page des duels
// (`Duels.tsx`) : quelques lignes, que la campagne garde sans faire venir le
// code des duels.

/** Le score d'une rencontre, toi d'abord : « Toi 7 – Tom 6 ». */
export const scoreDeRencontre = (toi: number, a: Adversaire, lui = a.justes) => `Toi ${toi} – ${a.nom} ${lui}`

/** Ce que dit une rencontre finie, en un mot. */
export const MOT_DE_L_ISSUE: Record<IssueDeRencontre, string> = { gagnee: 'Gagné', egalite: 'Égalité', perdue: 'Perdu' }

/** Un écart de cote, signé : « +14 », « −9 » — le vrai signe moins —, « ±0 ». */
export const ecartSigne = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0')

/**
 * Celui qu'on affronte dans un duel contre quelqu'un, tel que la partie le
 * dit à chaque question : son prénom, son avatar, son score s'il l'a déjà
 * joué — à battre —, et ce que le duel met en jeu sur sa cote.
 */
export interface ContreEnJeu {
  nom: string
  avatar: string
  justes: number | null
  enjeu?: EnjeuDuDuel
}
