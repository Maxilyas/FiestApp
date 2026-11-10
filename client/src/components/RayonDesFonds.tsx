import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { formatNumber } from '../format'
import { FONDS_EN_BOUTIQUE, PRIX_D_UN_FOND, type Fond } from '../../../shared/fonds'
import { fondsEnRayon } from '../../../shared/rayons'
import { sonAvatar } from '../../../shared/sonAvatar'
import type { PublicProfileDetail } from '../../../shared/profil'

// Le rayon des fonds de la boutique (`/boutique#fonds`) : les douze fonds des
// savoirs, un par catégorie de questions, les seuls qui s'achètent
// (`shared/fonds.ts`, le souhait du propriétaire du 15 octobre 2026). On
// n'achète pas un décor, on habille sa carte : chaque tuile est une petite
// carte, son avatar posé sur le décor, quatre par rangée (la refonte du
// 10 novembre 2026) — douze pastilles sous une grande carte ne montraient un
// décor qu'en le touchant, et le rayon faisait 620 px de haut. Toucher une
// tuile ouvre son présentoir : sa carte en plus grand, son prénom dessus,
// puis l'achat. Les fonds du trésor n'y sont pas — ils ne sortent que du
// coffre de la semaine, et « Ma collection » dit où.

export type EtatDuFond = 'porte' | 'a-toi' | 'a-vendre' | 'trop-cher'

export function etatDuFond(f: Fond, porte: string | null, siens: ReadonlySet<string>, solde: number): EtatDuFond {
  if (f.key === porte) return 'porte'
  if (siens.has(f.key)) return 'a-toi'
  return PRIX_D_UN_FOND > solde ? 'trop-cher' : 'a-vendre'
}

/** Sa tuile, dite à l'oreille d'une traite : son nom, son savoir, puis ce qu'il est pour lui. */
function nomDeLaCase(f: Fond, etat: EtatDuFond, solde: number): string {
  const nom = `${f.nom}, ${f.savoir}`
  if (etat === 'porte') return `${nom}, porté`
  if (etat === 'a-toi') return `${nom}, à toi`
  if (etat === 'trop-cher') return `${nom}, ${formatNumber(PRIX_D_UN_FOND)} confettis, encore ${formatNumber(PRIX_D_UN_FOND - solde)}`
  return `${nom}, ${formatNumber(PRIX_D_UN_FOND)} confettis`
}

/** L'adresse d'un fond du rayon — `/boutique#fond-jazz`, la fiche d'un fond dans « Ma collection » — : son présentoir s'ouvre. */
export function fondDeLAdresse(hash: string): string | undefined {
  const m = /^#fond-([\w-]+)$/.exec(hash)
  return m ? FONDS_EN_BOUTIQUE.find(f => f.key === m[1])?.key : undefined
}

/**
 * Sa carte, posée sur ce fond : son avatar et son prénom en tête, comme la
 * carte que la salle ouvre en touchant son nom, le savoir du fond au pied.
 */
export function SaCarte({ f, profil }: { f: Fond; profil: PublicProfileDetail }) {
  return (
    <span className={`fond-carte carte-fond fond-carte-grande fond-${f.key}`} aria-hidden="true">
      <span className="fond-carte-tete">
        <Avatar {...sonAvatar(profil)} finition={profil.finition} className="fond-carte-avatar" />
        <b>{profil.name}</b>
      </span>
      {f.savoir && <span className="fond-carte-savoir">{f.savoir}</span>}
    </span>
  )
}

export function RayonDesFonds({
  profil,
  envie,
  onOuvrir,
}: {
  profil: PublicProfileDetail
  /** Le fond pour lequel il économise. */
  envie?: string
  onOuvrir: (cle: string) => void
}) {
  const boutique = profil.boutique
  if (!boutique || !profil.fonds) return null
  const solde = boutique.confettis.solde
  const porte = profil.fond ?? null
  const siens = new Set(profil.fonds)
  const enRayon = fondsEnRayon(profil.fonds)
  const aLui = FONDS_EN_BOUTIQUE.length - enRayon.length
  const lui = sonAvatar(profil)
  return (
    <>
      {enRayon.length === 0 ? (
        <p className="card muted">Tu as les douze fonds des savoirs.</p>
      ) : (
        <ul className="rayon-grille grille-fonds" aria-label="Les fonds des savoirs">
          {enRayon.map(f => (
            <li key={f.key}>
              <button
                type="button"
                className="article-boutique article-fond"
                aria-haspopup="dialog"
                aria-label={nomDeLaCase(f, etatDuFond(f, porte, siens, solde), solde) + (envie === f.key ? ', ton envie' : '')}
                onClick={() => onOuvrir(f.key)}
              >
                {/* Le décor reste nocturne sous tous les thèmes (`.carte-fond`) : sa tuile aussi. */}
                <span className={`article-carte carte-fond fond-${f.key}`} aria-hidden="true">
                  <Avatar {...lui} finition={profil.finition} className="article-carte-avatar" />
                </span>
                {envie === f.key && (
                  <span className="article-marque">
                    <Icon name="star" />
                  </span>
                )}
                <span className="article-pied">
                  <b className="article-nom">{f.savoir}</b>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {aLui > 0 && (
        <p className="rayon-suite">
          {`${aLui} fond${aLui > 1 ? 's' : ''} déjà à toi · `}
          <a className="link-inline" href="/profil#fond">
            {aLui > 1 ? 'les porter' : 'le porter'}
          </a>
        </p>
      )}
    </>
  )
}
