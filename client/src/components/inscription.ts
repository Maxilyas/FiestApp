// Ce que l'inscription propose d'office — un avatar tiré au hasard,
// l'identifiant déduit du prénom —, à l'entrée d'un invité comme sur
// l'accueil (`ProfilForm`). À part, et sans rien d'autre : `ProfilForm` les
// prenait à `Entree.tsx`, et l'accueil, le profil et la boutique emportaient
// avec eux toute l'entrée d'un invité, sa reprise de place et socket.io —
// 13 Ko compressés de script qu'ils n'utilisaient jamais
// (`retours/2026-10-05/affichage-des-pages.md` ; `medaillons.test.ts` y veille).
import { AVATARS } from '../../../shared/avatars'
import { sansAccent } from '../../../shared/homonymes'
import { ApiError } from '../api'

/** Un avatar au hasard : sans ça, tous ceux qui ne touchent à rien arrivent identiques. */
export const tirage = () => AVATARS[Math.floor(Math.random() * AVATARS.length)]

/** « Camille » → « camille » : un identifiant proposé, qu'on peut changer. */
export const identifiantPour = (prenom: string) =>
  sansAccent(prenom).replace(/[^a-z0-9._-]+/g, '').slice(0, 32)

/**
 * Un refus de l'inscription qui vise l'identifiant : pris — le serveur en
 * propose un libre —, ou mal formé. Lui seul ouvre le champ de
 * l'identifiant. Tout refus l'ouvrait : « mimosa » refusé faisait paraître
 * « Ton identifiant, pour te reconnecter » entre le mot de passe et son
 * message, qui se lisait sous l'identifiant, et le champ de plus poussait
 * « Créer mon profil » sous le clavier d'un petit téléphone à 130 % (Jeanne,
 * la tablée du 26 octobre 2026). Les motifs sont ceux du serveur
 * (`profileRoutes.ts`, `ProfileStore.register`), qu'on ne retouche pas :
 * `connexion-claire.test.ts` les lit par la vraie route.
 */
export const refusDeLIdentifiant = (e: unknown): boolean =>
  e instanceof ApiError && (!!e.suggestion || /identifiant|déjà pris/i.test(e.message))

/**
 * Un refus du mot de passe choisi (`passwordProblem` : trop court, trop
 * long) : il se dit sous son champ, jamais sous l'identifiant. « Caractères »
 * dit aussi la forme d'un identifiant : celui-là passe d'abord.
 */
export const refusDuMotDePasse = (e: unknown): boolean =>
  e instanceof ApiError && !refusDeLIdentifiant(e) && /mot de passe|caractères/i.test(e.message)
