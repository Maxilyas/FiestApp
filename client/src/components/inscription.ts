// Ce que l'inscription propose d'office — un avatar tiré au hasard,
// l'identifiant déduit du prénom —, à l'entrée d'un invité comme sur
// l'accueil (`ProfilForm`). À part, et sans rien d'autre : `ProfilForm` les
// prenait à `Entree.tsx`, et l'accueil, le profil et la boutique emportaient
// avec eux toute l'entrée d'un invité, sa reprise de place et socket.io —
// 13 Ko compressés de script qu'ils n'utilisaient jamais
// (`retours/2026-10-05/affichage-des-pages.md` ; `medaillons.test.ts` y veille).
import { AVATARS } from '../../../shared/avatars'
import { sansAccent } from '../../../shared/homonymes'

/** Un avatar au hasard : sans ça, tous ceux qui ne touchent à rien arrivent identiques. */
export const tirage = () => AVATARS[Math.floor(Math.random() * AVATARS.length)]

/** « Camille » → « camille » : un identifiant proposé, qu'on peut changer. */
export const identifiantPour = (prenom: string) =>
  sansAccent(prenom).replace(/[^a-z0-9._-]+/g, '').slice(0, 32)
