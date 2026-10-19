import { Icon, type IconName } from './Icon'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { phraseDuMerci, type AnnonceDeLAdministrateur } from '../../../shared/profil'

const ICONE: Record<AnnonceDeLAdministrateur['sorte'], IconName> = {
  confettis: 'sparkles',
  merci: 'heart',
  prenom: 'edit',
  annonce: 'megaphone',
}

const nConfettis = (n: number) => `+${formatNumber(n)} confetti${n > 1 ? 's' : ''}`

/**
 * Une carte de ce que l'administrateur dit au joueur, en tête de son accueil
 * (`AnnoncesDeLAdministrateur`) — et la même à l'aperçu du QG, qui montre une
 * annonce telle que les joueurs la liront (`QgAnnonces`). Le bouton la range :
 * « Merci » sous un cadeau, « Avec plaisir » sous un merci, « Compris » sous
 * une annonce qui n'offre rien — un « Merci » y remerciait d'une maintenance.
 * Sans `onRanger`, l'aperçu : le bouton n'est qu'une image, rien ne s'y arrête
 * au clavier. Un merci et une annonce, plus longs, posent leur bouton sous
 * leur texte : à côté, au téléphone, il laissait au message trois mots par
 * ligne, sur sept lignes.
 */
export function CarteDeLAdministrateur({ annonce: a, prenom, onRanger }: { annonce: AnnonceDeLAdministrateur; prenom: string; onRanger?: () => void }) {
  const libelle = a.sorte === 'merci' ? 'Avec plaisir' : a.sorte === 'annonce' && a.confettis === 0 ? 'Compris' : 'Merci'
  return (
    <li className={'annonce-admin' + (a.sorte === 'merci' || a.sorte === 'annonce' ? ' annonce-admin-pile' : '')}>
      <span className="annonce-admin-icone" aria-hidden="true">
        <Icon name={ICONE[a.sorte]} />
      </span>
      <span className="annonce-admin-texte">
        {a.sorte === 'confettis' ? (
          <>
            <b>{nConfettis(a.confettis)}</b>
            {a.mot && <span>{espacesFines(`« ${a.mot} »`)}</span>}
            <span className="muted small">— de l’administrateur</span>
          </>
        ) : a.sorte === 'merci' ? (
          <>
            <b>{espacesFines(`Merci, ${prenom} !`)}</b>
            <span>{espacesFines(phraseDuMerci(a))}</span>
            <span className="muted small">— de l’administrateur</span>
          </>
        ) : a.sorte === 'annonce' ? (
          <>
            {/* Ce qu'elle lui a offert à lui : rien s'il n'était pas là pour le recevoir. */}
            <b>{a.confettis > 0 ? `${nConfettis(a.confettis)}, à tous les joueurs` : 'À tous les joueurs'}</b>
            <span>{espacesFines(a.message)}</span>
            <span className="muted small">— de l’administrateur</span>
          </>
        ) : (
          <>
            <b>Ton prénom a changé</b>
            <span>{espacesFines(`L’administrateur l’a changé en « ${a.nom} ».`)}</span>
          </>
        )}
      </span>
      {onRanger ? (
        <button type="button" className="annonce-admin-merci" onClick={onRanger}>
          {libelle}
        </button>
      ) : (
        <span className="annonce-admin-merci" aria-hidden="true">
          {libelle}
        </span>
      )}
    </li>
  )
}
