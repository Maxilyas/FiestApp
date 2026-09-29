import type { PublicProfileDetail } from '../../../shared/profil'
import type { ChoixDuProfil } from './choix'
import { ApercuSalle, MesAvatars, MesFinitions, MonFond, MonTitre } from './Apparence'
import { MaVitrine, MesEcussons, MesHautsFaits, MesPrix, MonQuizDuJour } from './Trophees'
import { MesThemes } from './Boutique'

// Le contenu des onglets « Apparence » et « Trophées » du profil, que la page
// charge à la demande (`ProfilApp`) : ils portent les dessins de tous les
// médaillons, et l'accueil anonyme, qui ne montre que « Me connecter » et
// « Rejoindre une soirée », les téléchargeait avec lui.

interface Props {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: ChoixDuProfil) => void
}

export function PanneauApparence({ profil, busy, enregistrer, acheter }: Props & { acheter: (cle: string) => Promise<string | null> }) {
  return (
    <>
      <ApercuSalle profil={profil} />
      <MesAvatars profil={profil} busy={busy} enregistrer={enregistrer} />
      <MesFinitions profil={profil} busy={busy} enregistrer={enregistrer} />
      <MonTitre profil={profil} busy={busy} enregistrer={enregistrer} />
      <MonFond profil={profil} busy={busy} enregistrer={enregistrer} />
      {/* Les thèmes, avec les cartes : ce qui change l'allure, pas le jeu. */}
      <MesThemes profil={profil} busy={busy} enregistrer={enregistrer} acheter={acheter} />
    </>
  )
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
