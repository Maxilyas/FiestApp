import type { PublicProfileDetail } from '../../../shared/profil'
import type { ChoixDuProfil } from './choix'
import { ApercuSalle, MesAvatars, MesFinitions, MonFond, MonTitre } from './Apparence'
import { MaVitrine, MesEcussons, MesHautsFaits, MesPrix, MonQuizDuJour } from './Trophees'
import { MesThemes } from './Boutique'

// Le contenu des écrans du profil — ses avatars, son style, ses trophées —
// et de la boutique, que la page charge à la demande (`ProfilApp`) : ils
// portent les dessins de tous les médaillons, et l'accueil anonyme, qui ne
// montre que « Me connecter » et « Rejoindre une soirée », les
// téléchargeait avec lui.

interface Props {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: ChoixDuProfil) => void
}

/** « Mes avatars » : ce que la salle voit, puis les trois familles. */
export function PanneauAvatars({ profil, busy, enregistrer }: Props) {
  return (
    <>
      <ApercuSalle profil={profil} />
      <MesAvatars profil={profil} busy={busy} enregistrer={enregistrer} />
    </>
  )
}

/** « Mon style » : la finition, le titre, le fond de la carte — ce qui change l'allure, pas le jeu. */
export function PanneauStyle({ profil, busy, enregistrer }: Props) {
  return (
    <>
      <ApercuSalle profil={profil} />
      <MesFinitions profil={profil} busy={busy} enregistrer={enregistrer} />
      <MonTitre profil={profil} busy={busy} enregistrer={enregistrer} />
      <MonFond profil={profil} busy={busy} enregistrer={enregistrer} />
    </>
  )
}

/** La boutique : les thèmes, achetés et portés d'un geste. */
export function PanneauBoutique({ profil, busy, enregistrer, acheter }: Props & { acheter: (cle: string) => Promise<string | null> }) {
  return <MesThemes profil={profil} busy={busy} enregistrer={enregistrer} acheter={acheter} />
}

export function PanneauTrophees({ profil, busy, enregistrer }: Props) {
  return (
    <>
      <MaVitrine profil={profil} busy={busy} enregistrer={enregistrer} />
      <MonQuizDuJour jour={profil.jour} />
      <MesHautsFaits profil={profil} />
      <MesEcussons ecussons={profil.ecussons} />
      <MesPrix prix={profil.prix} />
    </>
  )
}
