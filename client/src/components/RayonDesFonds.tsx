import { useState } from 'react'
import { Avatar } from './Avatar'
import { choixDialog } from './Dialog'
import { espacesFines, formatNumber } from '../format'
import { FONDS_EN_BOUTIQUE, PRIX_D_UN_FOND, fond as leFond, type Fond } from '../../../shared/fonds'
import { CONFETTIS_D_UNE_MISSION, CONFETTIS_DES_TROIS, MISSIONS_PAR_JOUR } from '../../../shared/missions'
import { sonAvatar } from '../../../shared/sonAvatar'
import type { PublicProfileDetail } from '../../../shared/profil'

// Le rayon des fonds de la boutique (`/boutique#fonds`) : les douze fonds des
// savoirs, un par catégorie de questions, les seuls qui s'achètent
// (`shared/fonds.ts`, le souhait du propriétaire du 15 octobre 2026). On
// n'achète pas un décor, on habille sa carte : la sienne en grand — son
// avatar, son prénom, comme la salle les voit quand elle touche son nom —, et
// dessous les douze décors en pastilles. En toucher une l'essaie : sa carte la
// porte aussitôt, rien ne s'enregistre (la refonte du 1er novembre 2026 —
// douze cartes à la file, chacune sa fiche, ne se comparaient pas sur la même
// carte). Puis l'achat, comme un thème : le porter tout de suite, ou le
// garder pour plus tard. Les fonds du trésor n'y sont pas — ils ne sortent que
// du coffre de la semaine, et « Ma collection » dit où.

type EtatDuFond = 'porte' | 'a-toi' | 'a-vendre' | 'trop-cher'

const enConfettis = (n: number) => `🎊 ${formatNumber(n)}`

/** Ce que ses missions d'un jour rapportent au plus : la piste qu'on montre à qui n'a pas encore de quoi. */
const CONFETTIS_DES_MISSIONS = MISSIONS_PAR_JOUR * CONFETTIS_D_UNE_MISSION + CONFETTIS_DES_TROIS

function etatDuFond(f: Fond, porte: string | null, siens: ReadonlySet<string>, solde: number): EtatDuFond {
  if (f.key === porte) return 'porte'
  if (siens.has(f.key)) return 'a-toi'
  return PRIX_D_UN_FOND > solde ? 'trop-cher' : 'a-vendre'
}

/** Sa pastille, dite à l'oreille d'une traite : son nom, son savoir, puis ce qu'il est pour lui. */
function nomDeLaCase(f: Fond, etat: EtatDuFond, solde: number): string {
  const nom = `${f.nom}, ${f.savoir}`
  if (etat === 'porte') return `${nom}, porté`
  if (etat === 'a-toi') return `${nom}, à toi`
  if (etat === 'trop-cher') return `${nom}, ${formatNumber(PRIX_D_UN_FOND)} confettis, encore ${formatNumber(PRIX_D_UN_FOND - solde)}`
  return `${nom}, ${formatNumber(PRIX_D_UN_FOND)} confettis`
}

/** L'adresse d'un fond du rayon — `/boutique#fond-jazz`, la fiche d'un fond dans « Ma collection » — : sa carte le porte à l'essai. */
export function fondDeLAdresse(hash: string): string | undefined {
  const m = /^#fond-([\w-]+)$/.exec(hash)
  return m ? FONDS_EN_BOUTIQUE.find(f => f.key === m[1])?.key : undefined
}

/**
 * Sa carte, en grand, posée sur le fond qu'elle montre — celui qu'il essaie,
 * sinon celui qu'il porte, sinon aucun : son avatar et son prénom en tête,
 * comme la carte que la salle ouvre, le savoir du fond au pied.
 */
function SaCarte({ f, profil }: { f: Fond | undefined; profil: PublicProfileDetail }) {
  return (
    <span className={'fond-carte carte-fond fond-carte-grande' + (f ? ` fond-${f.key}` : '')} aria-hidden="true">
      <span className="fond-carte-tete">
        <Avatar {...sonAvatar(profil)} finition={profil.finition} className="fond-carte-avatar" />
        <b>{profil.name}</b>
      </span>
      {f?.savoir && <span className="fond-carte-savoir">{f.savoir}</span>}
    </span>
  )
}

export function RayonDesFonds({
  profil,
  busy,
  essai,
  onEssayer,
  acheter,
}: {
  profil: PublicProfileDetail
  busy: boolean
  /** Le fond que sa carte essaie. */
  essai?: string
  /** Essayer un fond sur sa carte ; rien : la carte reprend le sien. */
  onEssayer: (cle: string | undefined) => void
  /** Achète — et porte, ou garde pour plus tard : rend le motif d'un refus, ou null. */
  acheter: (cle: string, porter: boolean) => Promise<string | null>
}) {
  const [erreur, setErreur] = useState('')
  const [achete, setAchete] = useState<{ f: Fond; porte: boolean } | null>(null)
  const boutique = profil.boutique
  if (!boutique || !profil.fonds) return null
  const solde = boutique.confettis.solde
  const porte = profil.fond ?? null
  const siens = new Set(profil.fonds)
  const aLui = FONDS_EN_BOUTIQUE.filter(f => siens.has(f.key)).length
  // Ce que la carte montre : l'essai, sinon ce qu'il porte — un fond du trésor aussi —, sinon rien.
  const montre = leFond(essai ?? porte)
  const etat = montre?.savoir ? etatDuFond(montre, porte, siens, solde) : null

  const essayer = (cle: string) => {
    setErreur('')
    setAchete(null)
    onEssayer(essai === cle ? undefined : cle)
  }
  const acheterLe = async (f: Fond) => {
    if (busy) return
    setErreur('')
    setAchete(null)
    const choix = await choixDialog({
      title: `${f.nom} · ${f.savoir}`,
      message: `Il coûte ${formatNumber(PRIX_D_UN_FOND)} confettis : il t’en restera ${formatNumber(solde - PRIX_D_UN_FOND)}.`,
      confirmLabel: `Acheter et porter · ${enConfettis(PRIX_D_UN_FOND)}`,
      alternative: { label: 'L’acheter seulement' },
      cancelLabel: 'Plus tard',
    })
    if (!choix) return
    const porter = choix.geste === 'confirmer'
    const refus = await acheter(f.key, porter)
    if (refus) return setErreur(refus)
    setAchete({ f, porte: porter })
  }

  return (
    <div className="rayon-fonds">
      {solde < 0 && <p className="muted small">Une soirée retirée de l’historique a repris ses confettis. Tes fonds, eux, te restent.</p>}
      <div className="cabine-des-fonds">
        <SaCarte f={montre} profil={profil} />
        <div className="cabine-texte" aria-live="polite">
          <b className="cabine-nom">{montre ? montre.nom : 'Ta carte, sans fond'}</b>
          <span className="muted small">
            {!montre?.savoir
              ? espacesFines('Touche un décor : ta carte le porte à l’essai.')
              : etat === 'porte'
                ? `${montre.savoir} · porté`
                : etat === 'a-toi'
                  ? `${montre.savoir} · à toi`
                  : `${montre.savoir} · ${enConfettis(PRIX_D_UN_FOND)}`}
          </span>
        </div>
        {montre?.savoir && etat === 'a-vendre' && (
          <>
            <p className="muted small">{`Il coûte ${formatNumber(PRIX_D_UN_FOND)} confettis : il t’en restera ${formatNumber(solde - PRIX_D_UN_FOND)}.`}</p>
            <button type="button" className="btn btn-primary" aria-disabled={busy || undefined} onClick={() => void acheterLe(montre)}>
              {`L’acheter · ${enConfettis(PRIX_D_UN_FOND)}`}
            </button>
          </>
        )}
        {montre?.savoir && etat === 'trop-cher' && (
          <p className="muted small">
            Il coûte {formatNumber(PRIX_D_UN_FOND)} confettis : <b>encore {formatNumber(PRIX_D_UN_FOND - solde)}</b>.{' '}
            {espacesFines(`Tes missions du jour en rapportent jusqu’à ${CONFETTIS_DES_MISSIONS} chaque jour : `)}
            <a className="link-inline" href="/#missions">
              mes missions
            </a>
          </p>
        )}
        {montre?.savoir && etat === 'a-toi' && !achete && (
          <a className="btn btn-ghost" href={`/profil?essayer=${montre.key}#fond`}>
            Le porter
          </a>
        )}
        {achete && (
          <p className="card theme-achete" role="status">
            {achete.porte ? (
              `${achete.f.nom} tapisse ta carte.`
            ) : (
              <>
                {`${achete.f.nom} est à toi : `}
                <a className="link-inline" href={`/profil?essayer=${achete.f.key}#fond`}>
                  le porter
                </a>
                {' quand tu veux.'}
              </>
            )}
          </p>
        )}
        {erreur && (
          <p className="error" role="alert">
            {erreur}
          </p>
        )}
      </div>
      {/* Les douze décors : une pastille chacun, sa peinture ; un interrupteur — son nom ne change pas, `aria-pressed` dit s'il est sur la carte. */}
      <ul className="fonds-pastilles" aria-label="Les fonds des savoirs">
        {FONDS_EN_BOUTIQUE.map(f => {
          const e = etatDuFond(f, porte, siens, solde)
          return (
            <li key={f.key}>
              <button
                type="button"
                className={`fond-pastille carte-fond fond-${f.key}`}
                aria-pressed={montre?.key === f.key}
                aria-label={nomDeLaCase(f, e, solde)}
                onClick={() => essayer(f.key)}
              >
                {(e === 'porte' || e === 'a-toi') && (
                  <span className="fond-pastille-coche" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="muted small center">
        {aLui === 0 ? (
          'Aucun encore à toi.'
        ) : (
          <>
            {`${aLui} sur ${FONDS_EN_BOUTIQUE.length} à toi : `}
            <a className="link-inline" href="/profil#fond">
              {aLui > 1 ? 'les porter' : 'le porter'}
            </a>
          </>
        )}
      </p>
    </div>
  )
}
