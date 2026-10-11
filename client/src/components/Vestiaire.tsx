import { useState } from 'react'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { Laurier } from './Laurier'
import { Icon } from './Icon'
import { XpMince } from './Identite'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { espacesFines } from '../format'
import { brilleChez, type PublicProfileDetail } from '../../../shared/profil'
import { cibleEclat } from '../../../shared/legendaires'
import { nomDuTitre } from '../../../shared/sentiers'
import { theme } from '../../../shared/themes'

/** Sa carte entière, comme la salle la voit, au toucher : rien ne la télécharge avant. */
const carteJoueur = aLaDemande(() => import('./CarteJoueur'))

/** Les pages où l'on change ce qu'on porte : une par pièce, que sa place sur la carte ouvre. */
export type EcranDuVestiaire = 'avatar' | 'titre' | 'vitrine' | 'fond' | 'theme' | 'gerbe'

/** Ce que le vestiaire montre en plus de l'en-tête du profil : il vient avec les écrans (`apercusDesTuiles`). */
export interface ApercusDuVestiaire {
  vitrine: { emoji: string; nom: string }[]
  /** Le nom du fond porté : « Velours », d'office. */
  fond: string
  /** Sa gerbe — trois de ses particules —, ou aucune. */
  gerbe: { nom: string; particules: string[] } | null
  apercuDuTheme: string | undefined
}

/** Trois cases à la vitrine d'une carte (`VITRINE_MAX`, `shared/carte.ts`). */
const CASES_DE_LA_VITRINE = 3

/**
 * Ce qu'on porte, en une image qu'on touche : sa carte telle que la salle la
 * voit — son fond, son avatar, son titre, sa vitrine —, puis ce que lui seul
 * voit, son thème et sa gerbe, côte à côte. Chaque pièce ouvre sa page, en
 * haut (le souhait du propriétaire du 11 octobre 2026 : « quelque chose de
 * visuel qui permettrait de cliquer sur les différents éléments », puis
 * « une page dédiée » à chacun). Trois tuiles disaient « Mon avatar », « Ma
 * carte », « Mon thème » : il fallait savoir ce que chacune rangeait.
 */
export function Vestiaire({
  profil,
  apercus,
  nomPorte,
  onOuvrir,
}: {
  profil: PublicProfileDetail
  /** Absents tant que les écrans n'ont pas fini d'arriver : les places sont gardées. */
  apercus: ApercusDuVestiaire | undefined
  /** L'avatar porté par son nom, et sa finition : « Le Phénix · Holo ». */
  nomPorte: string
  onOuvrir: (ecran: EcranDuVestiaire) => void
}) {
  const [carteOuverte, setCarteOuverte] = useState(false)
  const laCarte = useALaDemande(carteJoueur, carteOuverte)
  const titre = nomDuTitre(profil.titre)
  const sonTheme = theme(profil.theme ?? 'velours') ?? theme('velours')!
  const vitrine = apercus?.vitrine ?? []
  // Sans gerbe portée, il n'en veut aucune : sans choix, chacun porte les confettis.
  const nomDeLaGerbe = apercus ? (apercus.gerbe?.nom ?? 'Aucune') : ''
  return (
    <div className="vestiaire">
      <div className={'vestiaire-carte' + (profil.fond ? ` carte-fond fond-${profil.fond}` : '')}>
        <div className="vestiaire-tete">
          <button type="button" className="vestiaire-avatar" aria-label={`Mon avatar, ${nomPorte} : le changer`} onClick={() => onOuvrir('avatar')}>
            <Avatar
              className="player-avatar big"
              avatar={profil.avatar}
              finition={profil.finition}
              eclat={brilleChez(profil, cibleEclat(profil.legendaire, profil.avatar))}
              legendaire={profil.legendaire ?? undefined}
            />
            <span className="vestiaire-crayon" aria-hidden="true">
              <Icon name="edit" />
            </span>
          </button>
          <div className="vestiaire-qui-suis-je">
            <span className="identite-nom">
              {profil.name}
              <Laurier laurier={profil.laurier} />
              <Niveau niveau={profil.niveau} />
            </span>
            {/* Sans titre, la place dit qu'il s'en choisit un : on ne devine pas une case vide. */}
            <button
              type="button"
              className={'vestiaire-titre' + (titre ? '' : ' vestiaire-vide')}
              aria-label={titre ? `Mon titre, ${titre} : le changer` : 'Choisir un titre'}
              onClick={() => onOuvrir('titre')}
            >
              {titre ? espacesFines(`« ${titre} »`) : 'Choisir un titre'}
              <Icon name="edit" />
            </button>
          </div>
        </div>
        {/* La vitrine et le fond, chacun sa ligne : ce que la carte montre de plus. */}
        <button
          type="button"
          className="vestiaire-vitrine"
          aria-label={vitrine.length > 0 ? `Ma vitrine, ${vitrine.map(b => b.nom).join(', ')} : la changer` : 'Ma vitrine : la remplir'}
          onClick={() => onOuvrir('vitrine')}
        >
          <span className="vestiaire-etiquette">Ma vitrine</span>
          <span className="vestiaire-cases" aria-hidden="true">
            {Array.from({ length: CASES_DE_LA_VITRINE }, (_, i) => (
              <span key={i} className={'vestiaire-case' + (vitrine[i] ? '' : ' vestiaire-vide')}>
                {vitrine[i]?.emoji ?? (apercus ? '' : '·')}
              </span>
            ))}
          </span>
          <Icon name="edit" />
        </button>
        <button
          type="button"
          className="vestiaire-fond"
          aria-label={`Le fond de ma carte${apercus ? `, ${apercus.fond}` : ''} : le changer`}
          onClick={() => onOuvrir('fond')}
        >
          <Icon name="image" />
          <span className="vestiaire-etiquette">Fond de carte</span>
          <span className="vestiaire-valeur">{apercus?.fond ?? ''}</span>
          <Icon name="edit" />
        </button>
        <XpMince profil={profil} />
      </div>
      <p className="vestiaire-qui">
        <Icon name="eye" />
        {espacesFines('La salle voit ton avatar ; ta carte s’ouvre quand on touche ton nom.')}
      </p>
      <button type="button" className="link-inline vestiaire-voir" onClick={() => setCarteOuverte(true)}>
        Voir ma carte en entier, comme la salle
      </button>
      {/* Ce que lui seul voit, côte à côte : deux pièces, deux pages. Le thème
          et la gerbe tenaient sur un seul bouton, et la gerbe se cherchait
          sous les thèmes. */}
      <div className="vestiaire-pour-moi">
        <button type="button" className="vestiaire-perso" aria-label={`Mon thème, ${sonTheme.nom} : le changer`} onClick={() => onOuvrir('theme')}>
          <span className="mini-theme" aria-hidden="true">
            {apercus?.apercuDuTheme && <img src={apercus.apercuDuTheme} alt="" width={46} height={58} decoding="async" />}
          </span>
          <b>Mon thème</b>
          <span className="vestiaire-valeur">{sonTheme.nom}</span>
          <Icon name="edit" />
        </button>
        <button type="button" className="vestiaire-perso" aria-label={`Ma gerbe${apercus ? `, ${nomDeLaGerbe}` : ''} : la changer`} onClick={() => onOuvrir('gerbe')}>
          <span className={'mini-gerbe' + (apercus?.gerbe ? '' : ' mini-gerbe-vide')} aria-hidden="true">
            {apercus?.gerbe?.particules.map((p, i) => <span key={i}>{p}</span>)}
          </span>
          <b>Ma gerbe</b>
          <span className="vestiaire-valeur">{nomDeLaGerbe}</span>
          <Icon name="edit" />
        </button>
      </div>
      <p className="vestiaire-qui">
        <Icon name="eye" />
        {espacesFines('Toi seul les vois : ton thème habille tes pages, ta gerbe éclate à tes bonnes réponses.')}
      </p>
      {carteOuverte && laCarte && laCarte !== 'perdu' && <laCarte.CarteJoueur adresse="/api/joueur/carte" onFermer={() => setCarteOuverte(false)} />}
    </div>
  )
}
