import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { Compagnon } from './Compagnon'
import './compagnons-peints'
import { apercuDe } from '../apercus'
import { espacesFines, formatNumber } from '../format'
import { compagnon as leCompagnon } from '../../../shared/compagnons'
import { ceQuiManque, totalDuPanier, type LigneDuPanier } from '../../../shared/panier'

// Le panier d'essai de la boutique (`shared/panier.ts`) : ce qu'on essaie —
// un thème sur toute la page, un fond sur sa carte, un compagnon dans sa
// niche — s'additionne dans une barre, juste au-dessus du menu, tant qu'il y
// a de quoi acheter. « Tout prendre » ouvre le panier : chaque ligne cochée,
// le total, ce qui manque, « Les porter tout de suite » ; « Annuler » rend la
// page, la carte et la niche d'avant. Rien ne s'achète sans ce dernier geste,
// et chaque achat part au serveur l'un après l'autre (`unAchatALaFois`).

const enConfettis = (n: number) => `🎊 ${formatNumber(n)}`

/**
 * La barre de l'essai, au-dessus du menu : la croix qui rend tout, ce qu'on
 * essaie — une ligne par son nom, plusieurs comptées —, et « Prendre », le
 * total au bout. « Annuler » en toutes lettres ne laissait au nom que quatre
 * lettres en 360 de large (« Auro… »). Elle pose `avec-panier` sur la page,
 * qui ne passe jamais dessous.
 */
export function BarreDuPanier({ lignes, onAnnuler, onPrendre }: { lignes: readonly LigneDuPanier[]; onAnnuler: () => void; onPrendre: () => void }) {
  useEffect(() => {
    document.body.classList.add('avec-panier')
    return () => document.body.classList.remove('avec-panier')
  }, [])
  const une = lignes.length === 1 ? lignes[0] : null
  return (
    <div className="boutique-panier" role="region" aria-label="Ton essai">
      <button type="button" className="boutique-panier-annuler" aria-label="Annuler l’essai" onClick={onAnnuler}>
        <Icon name="x" />
      </button>
      <span className="boutique-panier-texte">
        <b>{une ? une.nom : `${lignes.length} à l’essai`}</b>
        <span className="muted small">{une ? 'À l’essai' : lignes.map(l => l.nom).join(' · ')}</span>
      </span>
      <button type="button" className="btn btn-primary" aria-haspopup="dialog" onClick={onPrendre}>
        {`${une ? 'Prendre' : 'Tout prendre'} · ${enConfettis(totalDuPanier(lignes))}`}
      </button>
    </div>
  )
}

/** Le dessin d'une ligne, en petit : l'aperçu du thème, la carte à son fond, le compagnon à sa première forme. */
function Vignette({ ligne }: { ligne: LigneDuPanier }) {
  if (ligne.sorte === 'theme') {
    const image = apercuDe(ligne.cle)
    return <span className="panier-vignette">{image && <img src={image} alt="" width={180} height={225} decoding="async" />}</span>
  }
  if (ligne.sorte === 'fond') return <span className={`panier-vignette carte-fond fond-${ligne.cle}`} />
  const forme = leCompagnon(ligne.cle)?.formes[0]
  return <span className="panier-vignette panier-vignette-compagnon">{forme && <Compagnon cle={forme.key} />}</span>
}

/** « Aurore boréale, Le Vitrail et Le Loup » : la virgule entre les premiers, « et » devant le dernier. */
function aLaFrancaise(noms: readonly string[]): string {
  return noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}` : (noms[0] ?? '')
}

/** Ce que « porter » fait de chaque sorte, dit sous la case. */
const CE_QUE_FAIT_PORTER = { theme: 'le thème habille tes pages', fond: 'le fond tapisse ta carte', compagnon: 'le compagnon s’installe dans ta niche' }

/**
 * Le panier : chaque ligne, cochée d'office, le total de ce qui est coché, ce
 * qui manque à son solde — « décoche ce qui peut attendre » —, et s'il les
 * porte tout de suite. « Prendre » rend la main à la boutique, qui achète
 * ligne après ligne et s'arrête au premier refus, dit ici.
 */
export function FeuilleDuPanier({
  lignes,
  solde,
  busy,
  erreur,
  pris,
  onPrendre,
  onFermer,
}: {
  lignes: readonly LigneDuPanier[]
  solde: number
  busy: boolean
  /** Le refus d'un achat, dit ici. */
  erreur?: string
  /** Ce qui vient d'être pris, et s'il le porte : le panier le dit avant de se fermer. */
  pris: { lignes: readonly LigneDuPanier[]; porter: boolean } | null
  onPrendre: (lignes: readonly LigneDuPanier[], porter: boolean) => void
  onFermer: () => void
}) {
  // Les sortes décochées : ce qui reste coché suit le panier, une ligne prise s'en va d'elle-même.
  const [decochees, setDecochees] = useState<ReadonlySet<string>>(() => new Set())
  const [porter, setPorter] = useState(true)
  const cochees = lignes.filter(l => !decochees.has(l.sorte))
  const manque = ceQuiManque(cochees, solde)
  const plusieurs = cochees.length > 1
  const effets = cochees.map(l => CE_QUE_FAIT_PORTER[l.sorte]).join(', ')
  const ceQuIlFait = effets ? `${effets.charAt(0).toUpperCase()}${effets.slice(1)}. Sinon, ta loge ${plusieurs ? 'les' : 'le'} garde.` : 'Rien de coché.'
  const basculer = (sorte: string) =>
    setDecochees(d => {
      const n = new Set(d)
      if (n.has(sorte)) n.delete(sorte)
      else n.add(sorte)
      return n
    })
  return (
    <Feuille
      titre="Ton essai"
      onFermer={onFermer}
      className="feuille-boutique feuille-du-panier"
      pied={
        lignes.length > 0 && (
          <button type="button" className="btn btn-primary btn-block" aria-disabled={busy || manque > 0 || cochees.length === 0 || undefined} onClick={() => !busy && manque === 0 && cochees.length > 0 && onPrendre(cochees, porter)}>
            {cochees.length === 0
              ? 'Rien de coché'
              : manque > 0
                ? `Il te manque ${formatNumber(manque)} confetti${manque > 1 ? 's' : ''}`
                : `${plusieurs ? `Prendre les ${cochees.length}` : 'Le prendre'} · ${enConfettis(totalDuPanier(cochees))}`}
          </button>
        )
      }
    >
      {pris && pris.lignes.length > 0 && (
        <p className="card theme-achete" role="status">
          {espacesFines(
            `${aLaFrancaise(pris.lignes.map(l => l.nom))} ${pris.lignes.length > 1 ? 'sont' : 'est'} à toi${pris.porter ? '.' : ` : ta loge ${pris.lignes.length > 1 ? 'les' : 'le'} garde, à porter quand tu veux.`}`,
          )}
        </p>
      )}
      {lignes.length > 0 && (
        <>
          <ul className="panier-lignes">
            {lignes.map(l => (
              <li key={l.sorte}>
                <label className="panier-ligne">
                  <Vignette ligne={l} />
                  <span className="panier-ligne-texte">
                    <b>{l.nom}</b>
                    <span className="muted small">{`${l.detail} · ${enConfettis(l.prix)}`}</span>
                  </span>
                  <input type="checkbox" checked={!decochees.has(l.sorte)} onChange={() => basculer(l.sorte)} />
                </label>
              </li>
            ))}
          </ul>
          <p className="panier-total">
            <span>Total</span>
            <b>{enConfettis(totalDuPanier(cochees))}</b>
          </p>
          {manque > 0 && (
            <p className="muted small" role="status">
              {cochees.length > 1
                ? espacesFines(`Il te manque ${formatNumber(manque)} confetti${manque > 1 ? 's' : ''} : décoche ce qui peut attendre.`)
                : espacesFines(`Il te manque ${formatNumber(manque)} confetti${manque > 1 ? 's' : ''} : une bonne réponse, un confetti.`)}
            </p>
          )}
          <label className="panier-porter">
            <input type="checkbox" checked={porter} onChange={() => setPorter(p => !p)} />
            <span>
              <b>{plusieurs ? 'Les porter tout de suite' : 'Le porter tout de suite'}</b>
              <span className="muted small">{espacesFines(ceQuIlFait)}</span>
            </span>
          </label>
        </>
      )}
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
    </Feuille>
  )
}
