import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { formatNumber } from '../format'
import { bordurePortee, type BordureDeLigue } from '../../../shared/duels'
import { MOTIFS, motif as leMotif, prixDuMotif, type MotifDeBordure } from '../../../shared/motifs'
import { motifsEnRayon } from '../../../shared/rayons'
import { sonAvatar } from '../../../shared/sonAvatar'
import type { PublicProfileDetail } from '../../../shared/profil'

// Le rayon des bordures de la boutique (`/boutique#bordures`) : les motifs qui
// s'achètent — ceux de la boutique toute l'année, ceux de saison à leur fête
// (`shared/motifs.ts`, le choix du propriétaire du 26 novembre 2026 : « Ça ne
// me dérange pas d'avoir plus de motifs dans la boutique »). On n'achète pas
// un dessin, on habille sa bordure : chaque tuile est son avatar, entouré du
// motif à sa ligue et à ses crans — sans bordure encore, un bronze serti en
// aperçu. La ligue reste à gagner : un motif ne pousse qu'à chaque victoire.
// Ceux des duels, des ligues serties et du coffre n'y sont jamais : « Ma
// collection » dit où.

/** Sa bordure, sous ce motif : celle qu'il porte — sans bordure encore, un bronze serti en aperçu. */
export function saBordureSous(profil: PublicProfileDetail, cle: string): BordureDeLigue {
  return bordurePortee(profil.bordureChoisie ?? 'auto', profil.bordures, cle) ?? { ligue: 'bronze', crans: 12, motif: cle }
}

/** Sa tuile, dite à l'oreille d'une traite : son nom, puis son prix et ce qui manque. */
function nomDeLaCase(m: MotifDeBordure, prix: number, solde: number): string {
  return prix > solde ? `${m.nom}, ${formatNumber(prix)} confettis, encore ${formatNumber(prix - solde)}` : `${m.nom}, ${formatNumber(prix)} confettis`
}

/** L'adresse d'un motif du rayon — `/boutique#motif-vagues` — : son présentoir s'ouvre. */
export function motifDeLAdresse(hash: string): string | undefined {
  const m = /^#motif-([\w-]+)$/.exec(hash)
  const lu = m ? leMotif(m[1]) : undefined
  return lu && (lu.voie.sorte === 'boutique' || lu.voie.sorte === 'saison') ? lu.key : undefined
}

export function RayonDesMotifs({
  profil,
  envie,
  onOuvrir,
}: {
  profil: PublicProfileDetail
  /** Le motif pour lequel il économise. */
  envie?: string
  onOuvrir: (cle: string) => void
}) {
  const boutique = profil.boutique
  if (!boutique) return null
  const solde = boutique.confettis.solde
  const siens = profil.motifs ?? []
  const enRayon = motifsEnRayon(siens, boutique.jour)
  const aLui = MOTIFS.filter(m => (m.voie.sorte === 'boutique' || m.voie.sorte === 'saison') && siens.includes(m.key)).length
  const lui = sonAvatar(profil)
  return (
    <>
      {enRayon.length === 0 ? (
        <p className="card muted">Tu as tous les motifs de la boutique.</p>
      ) : (
        <ul className="rayon-grille grille-motifs" aria-label="Les motifs de bordure">
          {enRayon.map(m => {
            const prix = prixDuMotif(m, boutique.jour) ?? 0
            return (
              <li key={m.key}>
                <button
                  type="button"
                  className="article-boutique article-motif"
                  aria-haspopup="dialog"
                  aria-label={nomDeLaCase(m, prix, solde) + (envie === m.key ? ', ton envie' : '')}
                  onClick={() => onOuvrir(m.key)}
                >
                  {/* La bordure est le sujet : ce qui sort d'un médaillon se tait (`.calque-sujet`) — les ailes d'un Phénix
                      éclaté passaient le bord de la tuile et s'y coupaient (le retour du 26 novembre 2026). */}
                  <span className="article-bordure calque-sujet" aria-hidden="true">
                    <Avatar {...lui} finition={profil.finition} bordure={saBordureSous(profil, m.key)} className="article-bordure-avatar" />
                  </span>
                  {envie === m.key && (
                    <span className="article-marque">
                      <Icon name="star" />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {aLui > 0 && (
        <p className="rayon-suite">
          {`${aLui} motif${aLui > 1 ? 's' : ''} déjà à toi · `}
          <a className="link-inline" href="/profil#avatar">
            {aLui > 1 ? 'les porter' : 'le porter'}
          </a>
        </p>
      )}
    </>
  )
}
