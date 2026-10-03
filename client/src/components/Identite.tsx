import { useState } from 'react'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { Laurier } from './Laurier'
import { Icon } from './Icon'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { espacesFines, formatNumber } from '../format'
import { brilleChez, type PublicProfileDetail } from '../../../shared/profil'
import { cibleEclat } from '../../../shared/legendaires'
import { hautFait } from '../../../shared/hautsfaits'

/** Sa carte, au toucher de sa ligne : rien ne la télécharge avant. */
const carteJoueur = aLaDemande(() => import('./CarteJoueur'))

/**
 * Soi-même, en tête de l'accueil et du profil : son avatar, son prénom, son
 * titre, sa barre d'expérience et ses confettis au bout — une ligne qu'on
 * touche pour voir sa carte comme la salle la voit. Le fond de carte qu'il
 * porte la tapisse : on le voit sans ouvrir la carte.
 */
export function Identite({ profil, titreVisible = true }: { profil: PublicProfileDetail; titreVisible?: boolean }) {
  const [ouverte, setOuverte] = useState(false)
  const laCarte = useALaDemande(carteJoueur, ouverte)
  const titre = titreVisible && profil.titre ? hautFait(profil.titre) : null
  return (
    <>
      <button
        type="button"
        className={'identite' + (profil.fond ? ` carte-fond fond-${profil.fond}` : '')}
        aria-label="Ma carte : la voir comme la salle la voit"
        onClick={() => setOuverte(true)}
      >
        <Avatar
          className="player-avatar big"
          avatar={profil.avatar}
          finition={profil.finition}
          eclat={brilleChez(profil, cibleEclat(profil.legendaire, profil.avatar))}
          legendaire={profil.legendaire ?? undefined}
        />
        <span className="identite-texte">
          <span className="identite-nom">
            {profil.name}
            <Laurier laurier={profil.laurier} />
            <Niveau niveau={profil.niveau} />
          </span>
          {titre && <span className="identite-titre">{espacesFines(`« ${titre.title} »`)}</span>}
          <XpMince profil={profil} />
        </span>
        <span className="identite-carte">
          Ma carte <Icon name="chevron-down" />
        </span>
      </button>
      {ouverte && laCarte && laCarte !== 'perdu' && <laCarte.CarteJoueur adresse="/api/joueur/carte" onFermer={() => setOuverte(false)} />}
    </>
  )
}

/**
 * Soi-même, sur une ligne, en tête de l'accueil : son avatar, son prénom, sa
 * barre d'expérience et ses confettis — sans cadre, l'accueil est aux gros
 * boutons. Un toucher mène à son profil, où la carte s'ouvre.
 */
export function IdentiteLigne({ profil }: { profil: PublicProfileDetail }) {
  return (
    <a className="identite-ligne" href="/profil" aria-label={`${profil.name} : mon profil`}>
      <Avatar
        className="player-avatar big"
        avatar={profil.avatar}
        finition={profil.finition}
        eclat={brilleChez(profil, cibleEclat(profil.legendaire, profil.avatar))}
        legendaire={profil.legendaire ?? undefined}
      />
      <span className="identite-texte">
        <span className="identite-nom">
          {profil.name}
          <Laurier laurier={profil.laurier} />
          <Niveau niveau={profil.niveau} />
        </span>
        <XpMince profil={profil} />
      </span>
    </a>
  )
}

/** La barre d'expérience, fine : où l'on en est, sans un bloc — et ses confettis au bout de la ligne, où l'œil passe déjà. */
export function XpMince({ profil }: { profil: PublicProfileDetail }) {
  const part = profil.requis > 0 ? Math.min(100, (profil.acquis / profil.requis) * 100) : 100
  const solde = profil.boutique?.confettis.solde
  return (
    <span className="xp-mince" role="progressbar" aria-label={`Niveau ${profil.niveau}`} aria-valuemin={0} aria-valuemax={profil.requis || 1} aria-valuenow={profil.requis > 0 ? profil.acquis : 1}>
      <span className="xp-mince-barre">
        <span style={{ width: `${part}%` }} />
      </span>
      <span className="xp-mince-texte">
        <span>{profil.requis > 0 ? `${formatNumber(profil.requis - profil.acquis)} XP → niv. ${profil.niveau + 1}` : 'Au sommet'}</span>
        {solde !== undefined && (
          <span className="xp-confettis" title="Tes confettis : une bonne réponse, un confetti">
            <span aria-hidden="true">🎊</span> {formatNumber(solde)}
            <span className="sr-only"> confettis</span>
          </span>
        )}
      </span>
    </span>
  )
}
