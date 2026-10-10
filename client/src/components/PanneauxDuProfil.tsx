import { useState } from 'react'
import { NOM_FINITION, type PublicProfileDetail } from '../../../shared/profil'
import { compteDeLaCollection, type Compte } from '../../../shared/collection'
import { vitrineDeLaCarte } from '../../../shared/carte'
import { recompensesDe } from '../../../shared/proches'
import { gerbe } from '../../../shared/gerbes'
import { apercuDe } from '../apercus'
import type { ChoixDuProfil } from './choix'
import { MaGerbe, MesAvatars, MesFinitions, MonFond, MonTitre } from './Apparence'
import { MaVitrine } from './Trophees'
import { Identite } from './Identite'
import { Icon } from './Icon'
import { Onglets, type Onglet } from './Onglets'
import { CarriereAtlas } from './CarriereAtlas'
import { MesThemes, RayonDesObjets, RayonDesThemes } from './Boutique'
import { objetDeLAdresse, type CleDObjet } from './Objets'

// Le contenu des écrans du profil — « Mon avatar », « Ma carte », « Mon
// thème », « Ma collection » — et de la boutique, que la page charge à la
// demande (`ProfilApp`) : ils portent les dessins de tous les médaillons, et
// l'accueil anonyme, qui ne montre que « Me connecter » et « Rejoindre une
// soirée », les téléchargeait avec lui.
//
// Les trois premiers sont ceux où l'on choisit ce qu'on porte, rangés par
// qui le voit : ils ne montrent que ce qu'on a. Tout le reste, et où le
// gagner, vit dans « Ma collection », où l'on ne règle rien.

interface Props {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: ChoixDuProfil) => void
}

/**
 * Ce que les tuiles du profil montrent en plus de son en-tête : le total de
 * sa collection, les hauts faits de sa vitrine, sa gerbe et l'aperçu de son
 * thème. Ici, avec les écrans : leurs catalogues — fonds, gerbes, aperçus
 * des thèmes — n'ont rien à faire sur le chemin de l'accueil anonyme, qui
 * partage le fichier des tuiles (`ProfilApp`) : près de trois kilos de plus.
 */
export function apercusDesTuiles(profil: PublicProfileDetail): {
  collection: Compte
  vitrine: string
  gerbe: { nom: string; particule: string } | null
  apercuDuTheme: string | undefined
} {
  const saGerbe = gerbe(profil.gerbe)
  return {
    collection: compteDeLaCollection(profil).total,
    vitrine: vitrineDeLaCarte(profil.vitrine, profil.vitrineChoisie ?? null, recompensesDe(profil.hautsFaits))
      .map(b => b.emoji)
      .join(''),
    gerbe: saGerbe ? { nom: saGerbe.nom, particule: saGerbe.particules[0] } : null,
    apercuDuTheme: apercuDe(profil.theme ?? 'velours'),
  }
}

/**
 * « Mon avatar » : ce que la salle voit à côté de son prénom. Sa carte en
 * tête, collée pendant qu'on choisit — on se voit changer —, puis la
 * finition sur sa ligne, et ses avatars, ceux qu'il a seulement. La finition
 * vivait dans « Mon style », loin de l'avatar qu'elle habille : on la
 * cherchait (la remarque du 5 octobre 2026).
 */
export function PanneauMonAvatar({ profil, busy, enregistrer }: Props) {
  const avatars = compteDeLaCollection(profil).familles.find(f => f.famille === 'avatars')
  const reste = avatars ? avatars.total - avatars.acquis : 0
  return (
    <>
      <div className="identite-collante">
        <Identite profil={profil} />
      </div>
      <MaFinition profil={profil} busy={busy} enregistrer={enregistrer} />
      <MesAvatars profil={profil} busy={busy} enregistrer={enregistrer} aMoi />
      {reste > 0 && (
        <a className="link-inline lien-boutique" href="#collection">
          <Icon name="award" />
          {`${reste} autre${reste > 1 ? 's' : ''} à gagner : où et comment, dans « Ma collection »`}
        </a>
      )}
    </>
  )
}

/**
 * La finition, sur une ligne qui dit celle qu'il porte ; touchée, sa grille
 * se déplie dessous. Dépliée d'office, ses huit cases repoussaient ses
 * avatars de plus d'un écran — et l'on vient surtout changer d'avatar.
 */
function MaFinition({ profil, busy, enregistrer }: Props) {
  const [ouverte, setOuverte] = useState(false)
  const valeur = profil.finitionChoisie === 'auto' ? `Auto · ${NOM_FINITION[profil.finition]}` : NOM_FINITION[profil.finition]
  return (
    <div className="ma-finition">
      <ul className="style-liste">
        <li>
          <button type="button" aria-expanded={ouverte} aria-controls="mes-finitions" onClick={() => setOuverte(o => !o)}>
            <span className="style-icone">
              <Icon name="sparkles" />
            </span>
            <span className="style-nom">Finition</span>
            <span className="style-valeur">{valeur}</span>
            <Icon name="chevron-down" className="style-chevron" />
          </button>
        </li>
      </ul>
      {ouverte && (
        <div id="mes-finitions">
          <MesFinitions profil={profil} busy={busy} enregistrer={enregistrer} />
        </div>
      )}
    </div>
  )
}

/**
 * « Ma carte » : ce qu'on voit en touchant son prénom — son titre, sa
 * vitrine, son fond —, sa carte collée en tête. La vitrine vivait dans les
 * trophées, le titre et le fond dans « Mon style » : trois écrans pour une
 * carte. Le reste s'y remplit tout seul.
 */
export function PanneauMaCarte({ profil, busy, enregistrer }: Props) {
  return (
    <>
      <div className="identite-collante">
        <Identite profil={profil} />
      </div>
      <MonTitre profil={profil} busy={busy} enregistrer={enregistrer} />
      <MaVitrine profil={profil} busy={busy} enregistrer={enregistrer} />
      <MonFond profil={profil} busy={busy} enregistrer={enregistrer} />
      <p className="muted small center">Le reste de ta carte se remplit tout seul : tes légendaires, tes écussons, tes chiffres, tes prix.</p>
    </>
  )
}

/**
 * « Mon thème » : ce que lui seul voit — le thème qui habille ses pages, la
 * gerbe qui éclate à ses bonnes réponses. Ses thèmes seulement : la boutique
 * vend les autres, la collection dit où gagner ceux qui ne se vendent pas.
 */
export function PanneauMonTheme({ profil, busy, enregistrer }: Props) {
  return (
    <>
      <MesThemes profil={profil} busy={busy} enregistrer={enregistrer} />
      <MaGerbe profil={profil} busy={busy} enregistrer={enregistrer} />
    </>
  )
}

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
