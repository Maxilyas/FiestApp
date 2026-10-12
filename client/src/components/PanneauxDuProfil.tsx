import { useState } from 'react'
import type { PublicProfileDetail } from '../../../shared/profil'
import { compteDeLaCollection, type Compte } from '../../../shared/collection'
import { vitrineDeLaCarte } from '../../../shared/carte'
import { recompensesDe } from '../../../shared/proches'
import { gerbe } from '../../../shared/gerbes'
import { FONDS } from '../../../shared/fonds'
import { apercuDe } from '../apercus'
import type { ChoixDuProfil } from './choix'
import { Onglets, type Onglet } from './Onglets'
import { CarriereAtlas } from './CarriereAtlas'
import { RayonDesObjets, RayonDesThemes } from './Boutique'
import { objetDeLAdresse, type CleDObjet } from './Objets'
import { nouveautesDuVestiaire } from './Loge'
import type { ApercusDuVestiaire } from './Vestiaire'

// Le contenu des écrans du profil — la loge, où l'on change ce qu'on porte
// (son avatar, son titre, sa vitrine, son fond, son thème, sa gerbe), « Ma
// collection », sa carrière, ses soirées — et de la boutique, que la page
// charge à la demande (`ProfilApp`) : ils portent les dessins de tous les
// médaillons, et l'accueil anonyme, qui ne montre que « Me connecter » et
// « Rejoindre une soirée », les téléchargeait avec lui.
//
// La loge ne montre que ce qu'on a. Tout le reste, et où le gagner, vit
// dans « Ma collection », où l'on ne règle rien.

interface Props {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: ChoixDuProfil) => void
}

/**
 * Ce que le profil montre en plus de son en-tête : le total de sa
 * collection, et pour le vestiaire les hauts faits de sa vitrine — une case
 * chacun —, sa gerbe, l'aperçu de son thème et ce qui est nouveau depuis son
 * dernier passage dans la loge. Ici, avec les écrans : leurs catalogues —
 * fonds, gerbes, aperçus des thèmes — n'ont rien à faire sur le chemin de
 * l'accueil anonyme, qui partage le fichier du profil (`ProfilApp`) : près
 * de trois kilos de plus.
 */
export function apercusDesTuiles(profil: PublicProfileDetail): ApercusDuVestiaire & { collection: Compte } {
  const saGerbe = gerbe(profil.gerbe)
  return {
    collection: compteDeLaCollection(profil).total,
    vitrine: vitrineDeLaCarte(profil.vitrine, profil.vitrineChoisie ?? null, recompensesDe(profil.hautsFaits)).map(b => ({ emoji: b.emoji, nom: b.title })),
    // Le Velours d'office : il n'est pas du catalogue des fonds.
    fond: FONDS.find(f => f.key === profil.fond)?.nom ?? 'Velours',
    // Trois de ses particules au plus, comme sa case dans « Ma gerbe ».
    gerbe: saGerbe ? { nom: saGerbe.nom, particules: saGerbe.particules.slice(0, 3) } : null,
    apercuDuTheme: apercuDe(profil.theme ?? 'velours'),
    nouveautes: nouveautesDuVestiaire(profil),
  }
}

/** La loge : tout ce qu'on porte, sur un écran (`Loge.tsx`). */
export { Loge as PanneauLoge, retenirLesPremiersVus } from './Loge'

export { MaCollection as PanneauCollection } from './Collection'

type RayonDeLaBoutique = 'themes' | 'objets'

const RAYONS: Onglet<RayonDeLaBoutique>[] = [
  { id: 'themes', nom: 'Thèmes' },
  { id: 'objets', nom: 'Objets' },
]

/** L'adresse du rayon des objets : un lien peut y mener (`/boutique#objets`). */
const ADRESSE_DES_OBJETS = '#objets'

/**
 * Le rayon et l'objet qu'ouvre l'adresse : `#objets`, le rayon ; `#objet-sablier`,
 * sa fiche dépliée (le lien de la série, au quiz du jour) ; et `#vies`, celle
 * d'avant, quand le rayon ne vendait que les vies.
 */
function lireRayon(): { rayon: RayonDeLaBoutique; objet?: CleDObjet } {
  const h = window.location.hash
  if (h === ADRESSE_DES_OBJETS) return { rayon: 'objets' }
  if (h === '#vies') return { rayon: 'objets', objet: 'vie' }
  const objet = objetDeLAdresse(h)
  return objet ? { rayon: 'objets', objet } : { rayon: 'themes' }
}

/**
 * La boutique, en deux rayons sous une barre fine : les thèmes — ce qui
 * reste à prendre, une rareté à la fois —, et les objets — les vies des
 * sentiers, le sablier de la série, et ce qui viendra. Posées sous la
 * vitrine, les vies ne se trouvaient qu'en la faisant défiler toute (la
 * remarque du propriétaire du 5 octobre 2026). Changer de rayon n'empile
 * rien : le retour du téléphone quitte la boutique, comme avant.
 */
export function PanneauBoutique({
  profil,
  busy,
  acheter,
  onSolde,
}: Props & { acheter: (cle: string, porter: boolean) => Promise<string | null>; /** Un objet acheté : le solde que le serveur rend. */ onSolde: (solde: number) => void }) {
  const [{ rayon, objet }, setLu] = useState(lireRayon)
  const choisir = (r: RayonDeLaBoutique) => {
    history.replaceState(history.state, '', r === 'objets' ? ADRESSE_DES_OBJETS : `${window.location.pathname}${window.location.search}`)
    setLu({ rayon: r })
  }
  return (
    <>
      <Onglets
        onglets={RAYONS}
        actif={rayon}
        onChoisir={choisir}
        label="Les rayons de la boutique"
        idOnglet={id => `boutique-${id}`}
        idPanneau={() => 'rayon-de-la-boutique'}
        className="onglets-fins"
      />
      <div className="rayon-de-la-boutique" role="tabpanel" id="rayon-de-la-boutique" aria-labelledby={`boutique-${rayon}`}>
        {rayon === 'themes' ? (
          <RayonDesThemes profil={profil} busy={busy} acheter={acheter} />
        ) : (
          <RayonDesObjets profil={profil} ouvert={objet} onSolde={onSolde} />
        )}
      </div>
    </>
  )
}

export function PanneauCarriere({ profil }: { profil: PublicProfileDetail }) {
  return <CarriereAtlas profil={profil} />
}

export { MesSoirees as PanneauSoirees } from './MesSoirees'
