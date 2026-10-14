import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { Laurier } from './Laurier'
import { Icon } from './Icon'
import { formatNumber } from '../format'
import { brilleChez, type ProfilDAccueil, type PublicProfileDetail } from '../../../shared/profil'
import { cibleEclat } from '../../../shared/legendaires'
import { bordurePortee } from '../../../shared/duels'

/**
 * La bordure de ligue qu'il porte : ses bordures viennent du détail de sa
 * page, ou, à l'accueil, du bouton des duels — celle qu'il a choisie, sinon
 * sa plus haute qui a un cran.
 */
function saBordure(profil: ProfilDAccueil & Pick<PublicProfileDetail, 'bordures'>) {
  return bordurePortee(profil.bordureChoisie ?? 'auto', profil.bordures ?? profil.duels?.bordures)
}

/**
 * Soi-même, sur une ligne, en tête de l'accueil et du profil : son avatar,
 * son prénom, sa barre d'expérience et ses confettis — sans cadre, ces pages
 * sont aux gros boutons. À l'accueil, un toucher mène à son profil ; sur son
 * profil, il ouvre sa carte comme la salle l'ouvre en touchant son nom
 * (`onCarte`), l'œil au bout pour le dire.
 */
export function IdentiteLigne({ profil, onCarte }: { profil: ProfilDAccueil & Pick<PublicProfileDetail, 'bordures'>; onCarte?: () => void }) {
  const contenu = (
    <>
      <Avatar
        className="player-avatar big"
        avatar={profil.avatar}
        finition={profil.finition}
        eclat={brilleChez(profil, cibleEclat(profil.legendaire, profil.avatar))}
        legendaire={profil.legendaire ?? undefined}
        bordure={saBordure(profil)}
      />
      <span className="identite-texte">
        <span className="identite-nom">
          {profil.name}
          <Laurier laurier={profil.laurier} />
          <Niveau niveau={profil.niveau} />
        </span>
        <XpMince profil={profil} />
      </span>
    </>
  )
  return onCarte ? (
    <button type="button" className="identite-ligne" aria-label={`${profil.name} : voir ma carte comme la salle la voit`} onClick={onCarte}>
      {contenu}
      <span className="identite-oeil" aria-hidden="true">
        <Icon name="eye" />
      </span>
    </button>
  ) : (
    <a className="identite-ligne" href="/profil" aria-label={`${profil.name} : mon profil`}>
      {contenu}
    </a>
  )
}

/** La barre d'expérience, fine : où l'on en est, sans un bloc — et ses confettis au bout de la ligne, où l'œil passe déjà. */
export function XpMince({ profil }: { profil: ProfilDAccueil }) {
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
