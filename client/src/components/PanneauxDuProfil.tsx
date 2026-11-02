import type { PublicProfileDetail } from '../../../shared/profil'
import { compteDeLaCollection, type Compte } from '../../../shared/collection'
import { CarriereAtlas } from './CarriereAtlas'
import { nouveautesDuProfil } from './Loge'
import type { NouveautesDeLaLoge } from '../../../shared/piecesDeLaLoge'

// Le contenu des écrans du profil — la loge, où l'on change ce qu'on porte
// (son avatar, son titre, sa vitrine, son fond, son thème, sa gerbe), « Ma
// collection », sa carrière, ses soirées — et de la boutique, que la page
// charge à la demande (`ProfilApp`) : ils portent les dessins de tous les
// médaillons, et l'accueil anonyme, qui ne montre que « Me connecter » et
// « Rejoindre une soirée », les téléchargeait avec lui.
//
// La loge ne montre que ce qu'on a. Tout le reste, et où le gagner, vit
// dans « Ma collection », où l'on ne règle rien.

/**
 * Ce que les boutons du profil disent en plus de leur nom : le total de sa
 * collection, et ce que la loge a de neuf depuis son dernier passage
 * (« M'habiller », et « Profil » dans la barre du menu). Ici, avec les
 * écrans : leurs catalogues n'ont rien à faire sur le chemin de l'accueil
 * anonyme, qui partage le fichier du profil (`ProfilApp`).
 */
export function apercusDesTuiles(profil: PublicProfileDetail): { collection: Compte; nouveautes: NouveautesDeLaLoge } {
  return { collection: compteDeLaCollection(profil).total, nouveautes: nouveautesDuProfil(profil) }
}

/** La loge : tout ce qu'on porte, sur son écran (`Loge.tsx`). */
export { Loge as PanneauLoge, nouveautesDuProfil, retenirLesPremiersVus } from './Loge'

export { MaCollection as PanneauCollection } from './Collection'

/**
 * La boutique, d'un seul tenant : « À la une », puis ses quatre rayons à la
 * suite — les thèmes, les compagnons, les fonds, le comptoir des objets —, et
 * l'essai de ce qui s'y prête, avec son panier (`LaBoutique.tsx`).
 */
export { PanneauBoutique } from './LaBoutique'

export function PanneauCarriere({ profil }: { profil: PublicProfileDetail }) {
  return <CarriereAtlas profil={profil} />
}

export { MesSoirees as PanneauSoirees } from './MesSoirees'
