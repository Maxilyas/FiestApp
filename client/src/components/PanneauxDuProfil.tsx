import { useState } from 'react'
import type { PublicProfileDetail } from '../../../shared/profil'
import { compteDeLaCollection, type Compte } from '../../../shared/collection'
import type { ChoixDuProfil } from './choix'
import { Onglets, type Onglet } from './Onglets'
import { CarriereAtlas } from './CarriereAtlas'
import { RayonDesObjets, RayonDesThemes } from './Boutique'
import { RayonDesCompagnons, compagnonDeLAdresse } from './RayonDesCompagnons'
import { RayonDesFonds, fondDeLAdresse } from './RayonDesFonds'
import { objetDeLAdresse, type CleDObjet } from './Objets'
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

interface Props {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: ChoixDuProfil) => void
}

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

type RayonDeLaBoutique = 'themes' | 'compagnons' | 'fonds' | 'objets'

const RAYONS: Onglet<RayonDeLaBoutique>[] = [
  { id: 'themes', nom: 'Thèmes' },
  { id: 'compagnons', nom: 'Compagnons' },
  { id: 'fonds', nom: 'Fonds' },
  { id: 'objets', nom: 'Objets' },
]

/** L'adresse du rayon des objets : un lien peut y mener (`/boutique#objets`). */
const ADRESSE_DES_OBJETS = '#objets'
/** Celle des compagnons : l'album et la loge y mènent (`/boutique#compagnons`). */
const ADRESSE_DES_COMPAGNONS = '#compagnons'
/** Celle des fonds : la loge et la collection y mènent (`/boutique#fonds`, `#fond-jazz` pour un seul). */
const ADRESSE_DES_FONDS = '#fonds'

/**
 * Le rayon et l'objet qu'ouvre l'adresse : `#objets`, le rayon ; `#objet-sablier`,
 * sa fiche dépliée (le lien de la série, au quiz du jour) ; et `#vies`, celle
 * d'avant, quand le rayon ne vendait que les vies ; `#compagnons`, leur rayon,
 * et `#compagnon-chat`, sa vitrine ouverte sur lui (`compagnonDeLAdresse`) ;
 * `#fonds`, le leur, et `#fond-jazz`, la fiche d'un fond (`fondDeLAdresse`).
 */
function lireRayon(): { rayon: RayonDeLaBoutique; objet?: CleDObjet } {
  const h = window.location.hash
  if (h === ADRESSE_DES_COMPAGNONS || compagnonDeLAdresse(h) !== null) return { rayon: 'compagnons' }
  if (h === ADRESSE_DES_FONDS || fondDeLAdresse(h)) return { rayon: 'fonds' }
  if (h === ADRESSE_DES_OBJETS) return { rayon: 'objets' }
  if (h === '#vies') return { rayon: 'objets', objet: 'vie' }
  const objet = objetDeLAdresse(h)
  return objet ? { rayon: 'objets', objet } : { rayon: 'themes' }
}

/**
 * La boutique, en quatre rayons sous une barre fine : les thèmes — ce qui
 * reste à prendre, une rareté à la fois —, les compagnons — qui vivent dans
 * sa niche et grandissent avec lui —, les fonds des savoirs, un par catégorie, et les
 * objets — les vies des sentiers, le sablier de la série, et ce qui viendra.
 * Posées sous la vitrine, les vies ne se trouvaient qu'en la faisant défiler
 * toute (la remarque du propriétaire du 5 octobre 2026). Changer de rayon
 * n'empile rien : le retour du téléphone quitte la boutique, comme avant.
 */
export function PanneauBoutique({
  profil,
  busy,
  enregistrer,
  acheter,
  acheterCompagnon,
  acheterFond,
  onSolde,
}: Props & {
  acheter: (cle: string, porter: boolean) => Promise<string | null>
  acheterCompagnon: (cle: string, porter: boolean) => Promise<string | null>
  acheterFond: (cle: string, porter: boolean) => Promise<string | null>
  /** Un objet acheté : le solde que le serveur rend. */
  onSolde: (solde: number) => void
}) {
  const [{ rayon, objet }, setLu] = useState(lireRayon)
  const choisir = (r: RayonDeLaBoutique) => {
    const ici = `${window.location.pathname}${window.location.search}`
    const adresse = { objets: ADRESSE_DES_OBJETS, compagnons: ADRESSE_DES_COMPAGNONS, fonds: ADRESSE_DES_FONDS, themes: ici }[r]
    history.replaceState(history.state, '', adresse)
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
        ) : rayon === 'compagnons' ? (
          <RayonDesCompagnons profil={profil} busy={busy} acheter={acheterCompagnon} installer={cle => enregistrer({ niche: cle })} />
        ) : rayon === 'fonds' ? (
          <RayonDesFonds profil={profil} busy={busy} acheter={acheterFond} />
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
