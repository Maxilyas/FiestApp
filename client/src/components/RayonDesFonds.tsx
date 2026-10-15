import { Fragment, useState } from 'react'
import { Avatar } from './Avatar'
import { choixDialog } from './Dialog'
import { useFiche } from './Boutique'
import { espacesFines, formatNumber } from '../format'
import { FONDS_EN_BOUTIQUE, PRIX_D_UN_FOND, type Fond } from '../../../shared/fonds'
import { CONFETTIS_D_UNE_MISSION, CONFETTIS_DES_TROIS, MISSIONS_PAR_JOUR } from '../../../shared/missions'
import { sonAvatar } from '../../../shared/sonAvatar'
import type { PublicProfileDetail } from '../../../shared/profil'

// Le rayon des fonds de la boutique (`/boutique#fonds`) : les douze fonds des
// savoirs, un par catégorie de questions, les seuls qui s'achètent
// (`shared/fonds.ts`, le souhait du propriétaire du 15 octobre 2026). Chacun
// en carte, sa propre carte posée dessus — son avatar et son prénom, comme
// la salle les voit quand elle touche son nom : on n'achète pas un décor, on
// habille sa carte. Toucher une carte ouvre sa fiche sous sa rangée, la carte
// en grand, et l'achat, comme un thème : le porter tout de suite, ou le
// garder pour plus tard. Les fonds du trésor n'y sont pas — ils ne sortent
// que du coffre de la semaine, et « Ma collection » dit où.

type EtatDuFond = 'porte' | 'a-toi' | 'a-vendre' | 'trop-cher'

const enConfettis = (n: number) => `🎊 ${formatNumber(n)}`

/** Ce que ses missions d'un jour rapportent au plus : la piste qu'on montre à qui n'a pas encore de quoi. */
const CONFETTIS_DES_MISSIONS = MISSIONS_PAR_JOUR * CONFETTIS_D_UNE_MISSION + CONFETTIS_DES_TROIS

function etatDuFond(f: Fond, porte: string | null, siens: ReadonlySet<string>, solde: number): EtatDuFond {
  if (f.key === porte) return 'porte'
  if (siens.has(f.key)) return 'a-toi'
  return PRIX_D_UN_FOND > solde ? 'trop-cher' : 'a-vendre'
}

/** Sa case, dite à l'oreille d'une traite : son nom, son savoir, puis ce qu'il est pour lui. */
function nomDeLaCase(f: Fond, etat: EtatDuFond, solde: number): string {
  const nom = `${f.nom}, ${f.savoir}`
  if (etat === 'porte') return `${nom}, porté`
  if (etat === 'a-toi') return `${nom}, à toi`
  if (etat === 'trop-cher') return `${nom}, ${formatNumber(PRIX_D_UN_FOND)} confettis, encore ${formatNumber(PRIX_D_UN_FOND - solde)}`
  return `${nom}, ${formatNumber(PRIX_D_UN_FOND)} confettis`
}

/** L'adresse d'un fond du rayon — `/boutique#fond-jazz`, la fiche d'un fond dans « Ma collection » — : sa fiche s'ouvre dépliée. */
export function fondDeLAdresse(hash: string): string | undefined {
  const m = /^#fond-([\w-]+)$/.exec(hash)
  return m ? FONDS_EN_BOUTIQUE.find(f => f.key === m[1])?.key : undefined
}

/**
 * Sa carte, posée sur le fond : son avatar et son prénom en tête, comme la
 * carte que la salle ouvre — en petit dans le rayon, figée comme dans une
 * liste ; en grand dans la fiche. Le savoir du fond au pied.
 */
function SaCarte({ f, profil, grand = false }: { f: Fond; profil: PublicProfileDetail; grand?: boolean }) {
  return (
    <span className={`fond-carte carte-fond fond-${f.key}` + (grand ? ' fond-carte-grande' : '')} aria-hidden="true">
      <span className="fond-carte-tete">
        <Avatar {...sonAvatar(profil)} finition={profil.finition} className={grand ? 'fond-carte-avatar' : 'lb-avatar'} />
        <b>{profil.name}</b>
      </span>
      <span className="fond-carte-savoir">{f.savoir}</span>
    </span>
  )
}

export function RayonDesFonds({
  profil,
  busy,
  acheter,
}: {
  profil: PublicProfileDetail
  busy: boolean
  /** Achète — et porte, ou garde pour plus tard : rend le motif d'un refus, ou null. */
  acheter: (cle: string, porter: boolean) => Promise<string | null>
}) {
  const [ouvert, setOuvert] = useState<string | null>(() => (typeof window === 'undefined' ? null : (fondDeLAdresse(window.location.hash) ?? null)))
  const [erreur, setErreur] = useState('')
  const [achete, setAchete] = useState<{ f: Fond; porte: boolean } | null>(null)
  const porte = profil.fond ?? null
  const detail = useFiche(ouvert, porte ?? '')
  const boutique = profil.boutique
  if (!boutique || !profil.fonds) return null
  const solde = boutique.confettis.solde
  const siens = new Set(profil.fonds)
  const aLui = FONDS_EN_BOUTIQUE.filter(f => siens.has(f.key)).length

  const toucher = (cle: string) => {
    setErreur('')
    setOuvert(o => (o === cle ? null : cle))
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
    <section className="rayon-fonds">
      <p className="gemme-legende">
        <b>Un fond par savoir</b> · {espacesFines(`${enConfettis(PRIX_D_UN_FOND)} chacun — derrière ta carte, quand quelqu’un touche ton nom.`)}
      </p>
      {solde < 0 && <p className="muted small">Une soirée retirée de l’historique a repris ses confettis. Tes fonds, eux, te restent.</p>}
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
      <div className="vitrine-fonds" role="group" aria-label="Les fonds des savoirs">
        {FONDS_EN_BOUTIQUE.map(f => {
          const etat = etatDuFond(f, porte, siens, solde)
          const pied =
            etat === 'porte'
              ? 'Porté'
              : etat === 'a-toi'
                ? 'À toi'
                : etat === 'trop-cher'
                  ? `encore ${formatNumber(PRIX_D_UN_FOND - solde)}`
                  : enConfettis(PRIX_D_UN_FOND)
          return (
            <Fragment key={f.key}>
              <button
                type="button"
                className={
                  'fond-vitrine' +
                  (etat === 'trop-cher' ? ' fond-cher' : '') +
                  (etat === 'porte' ? ' fond-porte' : '') +
                  (etat === 'a-toi' ? ' fond-a-toi' : '') +
                  (ouvert === f.key ? ' ouverte' : '')
                }
                aria-expanded={ouvert === f.key}
                aria-controls={ouvert === f.key ? 'detail-fond' : undefined}
                aria-label={nomDeLaCase(f, etat, solde)}
                onClick={() => toucher(f.key)}
              >
                <SaCarte f={f} profil={profil} />
                <span className="fond-vitrine-pied">
                  <b>{f.nom}</b>
                  <span className="fond-vitrine-prix">{pied}</span>
                </span>
              </button>
              {ouvert === f.key && (
                <div id="detail-fond" className="fiche-case fond-fiche" ref={detail}>
                  <div className="galerie-detail detail-case detail-fond">
                    <span className="detail-famille muted">{`${f.savoir} · ${enConfettis(PRIX_D_UN_FOND)}`}</span>
                    <b className="galerie-detail-nom">{f.nom}</b>
                    <SaCarte f={f} profil={profil} grand />
                    <p className="muted small">{espacesFines('Derrière ta carte, quand quelqu’un touche ton nom : la salle le voit, l’écran commun garde le sien.')}</p>
                    {etat === 'porte' && <p className="muted small">C’est lui qui tapisse ta carte.</p>}
                    {etat === 'a-toi' && (
                      <a className="btn btn-small btn-primary" href={`/profil?essayer=${f.key}#fond`}>
                        L’essayer sur ma carte
                      </a>
                    )}
                    {etat === 'a-vendre' && (
                      <>
                        <p className="muted small">{`Il coûte ${formatNumber(PRIX_D_UN_FOND)} confettis : il t’en restera ${formatNumber(solde - PRIX_D_UN_FOND)}.`}</p>
                        <button type="button" className="btn btn-small btn-primary" aria-disabled={busy || undefined} onClick={() => void acheterLe(f)}>
                          {`L’acheter · ${enConfettis(PRIX_D_UN_FOND)}`}
                        </button>
                      </>
                    )}
                    {etat === 'trop-cher' && (
                      <>
                        <p className="muted small">
                          Il coûte {formatNumber(PRIX_D_UN_FOND)} confettis : <b>encore {formatNumber(PRIX_D_UN_FOND - solde)}</b>.{' '}
                          {espacesFines(`Tes missions du jour en rapportent jusqu’à ${CONFETTIS_DES_MISSIONS} chaque jour.`)}
                        </p>
                        <a className="link-inline" href="/#missions">
                          Mes missions du jour
                        </a>
                      </>
                    )}
                    {erreur && (
                      <p className="error" role="alert">
                        {erreur}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Fragment>
          )
        })}
      </div>
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
    </section>
  )
}
