import { useState, type ReactNode } from 'react'
import { NOM_FINITION, type PublicProfileDetail } from '../../../shared/profil'
import { portrait } from '../../../shared/branches'
import { nomDuTitre } from '../../../shared/sentiers'
import { fond } from '../../../shared/fonds'
import { theme } from '../../../shared/themes'
import type { ChoixDuProfil } from './choix'
import { MesAvatars, MesFinitions, MonFond, MonTitre } from './Apparence'
import { AtlasDesAvatars } from './AtlasDesAvatars'
import { Identite } from './Identite'
import { Icon } from './Icon'
import { Onglets, type Onglet } from './Onglets'
import { TropheesAtlas } from './TropheesAtlas'
import { CarriereAtlas } from './CarriereAtlas'
import { MesThemes, RayonDesThemes, RayonDesVies } from './Boutique'

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

type OngletAvatars = 'emojis' | 'legendaires' | 'savoir'

const ONGLETS_AVATARS: Onglet<OngletAvatars>[] = [
  { id: 'emojis', nom: 'Emojis', icone: 'sparkles' },
  { id: 'legendaires', nom: 'Légendaires', icone: 'star' },
  { id: 'savoir', nom: 'Savoir', icone: 'book' },
]

/** L'onglet qu'on ouvre d'abord : celui de ce qu'il porte. */
function ongletDuDebut(porte: string | null | undefined): OngletAvatars {
  if (portrait(porte)) return 'savoir'
  return porte ? 'legendaires' : 'emojis'
}

/**
 * « Mes avatars », en trois onglets : les emojis dans leur grille, les
 * légendaires dans leur écrin, le savoir en atlas. Chaque famille garde
 * l'allure qui lui va : un emoji se choisit d'un coup d'œil, un légendaire
 * se contemple, une branche se parcourt. Ce que la salle voit est en tête
 * du profil (`Identite`) : l'écran est aux avatars.
 */
export function PanneauAvatars({ profil, busy, enregistrer }: Props) {
  const [onglet, setOnglet] = useState<OngletAvatars>(() => ongletDuDebut(profil.legendaire))
  return (
    <>
      <Onglets
        onglets={ONGLETS_AVATARS}
        actif={onglet}
        onChoisir={setOnglet}
        label="Mes avatars"
        idOnglet={id => `avatars-${id}`}
        idPanneau={id => `panneau-${id}`}
        className="onglets-avatars"
      />
      <div role="tabpanel" id={`panneau-${onglet}`} aria-labelledby={`avatars-${onglet}`} className="panneau-avatars">
        {onglet === 'emojis' ? (
          // La grille des emojis de toujours, seule : ses onglets de familles
          // et son mode d'emploi feraient doublon avec ceux-ci.
          <div className="une-famille">
            <MesAvatars profil={profil} busy={busy} enregistrer={enregistrer} familleInitiale="emojis" />
          </div>
        ) : (
          <AtlasDesAvatars key={onglet} profil={profil} onglet={onglet} busy={busy} enregistrer={enregistrer} />
        )}
      </div>
    </>
  )
}

/** Les réglages de « Mon style », chacun son écran (`ProfilApp`, `#style-finition`…). */
export type Reglage = 'finition' | 'titre' | 'fond' | 'theme'

/**
 * « Mon style » : sa carte en tête — c'est ce qu'on change —, puis quatre
 * lignes qui disent ce qui est choisi, chacune ouvrant son écran — le thème
 * compris : ceux qu'on a se portent ici, la boutique ne vend que les autres.
 */
export function PanneauStyle({ profil, onReglage }: Props & { onReglage: (r: Reglage) => void }) {
  const titre = nomDuTitre(profil.titre)
  const finition = profil.finitionChoisie === 'auto' ? `Auto · ${NOM_FINITION[profil.finition]}` : NOM_FINITION[profil.finition]
  const lignes: { r: Reglage; icone: ReactNode; nom: string; valeur: string }[] = [
    { r: 'finition', icone: <Icon name="sparkles" />, nom: 'Finition', valeur: finition },
    { r: 'titre', icone: <Icon name="award" />, nom: 'Titre', valeur: titre ?? 'Aucun' },
    { r: 'fond', icone: <Icon name="image" />, nom: 'Fond de carte', valeur: fond(profil.fond)?.nom ?? 'Aucun' },
    { r: 'theme', icone: <Icon name="palette" />, nom: 'Thème', valeur: theme(profil.theme ?? 'velours')?.nom ?? 'Velours' },
  ]
  return (
    <>
      <Identite profil={profil} />
      <ul className="style-liste">
        {lignes.map(l => (
          <li key={l.r}>
            <button type="button" onClick={() => onReglage(l.r)}>
              <span className="style-icone">{l.icone}</span>
              <span className="style-nom">{l.nom}</span>
              <span className="style-valeur">{l.valeur}</span>
              <Icon name="chevron-down" className="style-chevron" />
            </button>
          </li>
        ))}
      </ul>
      <p className="muted small center">La finition, le titre et le fond se voient ci-dessus, et sur ta carte.</p>
    </>
  )
}

/** Un réglage du style, seul sur son écran, sa carte au-dessus, qui reste en vue : on voit ce qu'on change. */
export function PanneauReglage({ reglage, profil, busy, enregistrer }: Props & { reglage: Reglage }) {
  return (
    <>
      <div className="identite-collante">
        <Identite profil={profil} />
      </div>
      {reglage === 'finition' && <MesFinitions profil={profil} busy={busy} enregistrer={enregistrer} />}
      {reglage === 'titre' && <MonTitre profil={profil} busy={busy} enregistrer={enregistrer} />}
      {reglage === 'fond' && <MonFond profil={profil} busy={busy} enregistrer={enregistrer} />}
      {reglage === 'theme' && <MesThemes profil={profil} busy={busy} enregistrer={enregistrer} />}
    </>
  )
}

type RayonDeLaBoutique = 'themes' | 'vies'

const RAYONS: Onglet<RayonDeLaBoutique>[] = [
  { id: 'themes', nom: 'Thèmes' },
  { id: 'vies', nom: 'Vies' },
]

/** L'adresse du rayon des vies : un lien peut y mener (`/boutique#vies`). */
const ADRESSE_DES_VIES = '#vies'

/**
 * La boutique, en deux rayons sous une barre fine : les thèmes — ce qui
 * reste à prendre, une rareté à la fois —, et les vies des sentiers. Posées
 * sous la vitrine, les vies ne se trouvaient qu'en la faisant défiler toute
 * (la remarque du propriétaire du 5 octobre 2026). Changer de rayon n'empile
 * rien : le retour du téléphone quitte la boutique, comme avant.
 */
export function PanneauBoutique({
  profil,
  busy,
  acheter,
  onSolde,
}: Props & { acheter: (cle: string) => Promise<string | null>; /** Des vies achetées : le solde que le serveur rend. */ onSolde: (solde: number) => void }) {
  const [rayon, setRayon] = useState<RayonDeLaBoutique>(() => (window.location.hash === ADRESSE_DES_VIES ? 'vies' : 'themes'))
  const choisir = (r: RayonDeLaBoutique) => {
    history.replaceState(history.state, '', r === 'vies' ? ADRESSE_DES_VIES : `${window.location.pathname}${window.location.search}`)
    setRayon(r)
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
        {rayon === 'themes' ? <RayonDesThemes profil={profil} busy={busy} acheter={acheter} /> : <RayonDesVies profil={profil} onSolde={onSolde} />}
      </div>
    </>
  )
}

export function PanneauTrophees({ profil, busy, enregistrer }: Props) {
  return <TropheesAtlas profil={profil} busy={busy} enregistrer={enregistrer} />
}

export function PanneauCarriere({ profil }: { profil: PublicProfileDetail }) {
  return <CarriereAtlas profil={profil} />
}

export { MesSoirees as PanneauSoirees } from './MesSoirees'
