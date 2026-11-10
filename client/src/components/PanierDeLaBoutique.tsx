import { useEffect } from 'react'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { Compagnon } from './Compagnon'
import './compagnons-peints'
import { apercuDe } from '../apercus'
import { espacesFines } from '../format'
import { OBJETS } from './Objets'
import { compagnon as leCompagnon } from '../../../shared/compagnons'
import type { SorteDEnvie } from '../../../shared/envie'
import { ceQuiManque, totalDuPanier, type LigneDuPanier } from '../../../shared/panier'
import { enConfettis } from '../../../shared/rayons'

// L'essai de la boutique (`shared/panier.ts`) : ce qu'on essaie — un thème
// sur toute la page, un compagnon dans sa niche — attend dans une barre, juste
// au-dessus du menu, tant qu'il y a de quoi acheter. Un seul article : sa
// vignette, son prix et son nom, la croix qui le retire, et « Garder », qui
// ouvre son présentoir sur « Confirmer » — le premier toucher de l'achat est
// donné.
// Plusieurs : « Voir », et la feuille de ce qu'on essaie, ligne par ligne, le
// total, « Tout retirer » ou « Tout garder ». Rien ne s'achète sans ce dernier
// geste, et chaque achat part au serveur l'un après l'autre
// (`unAchatALaFois`).
//
// Des cases à cocher et « Les porter tout de suite », dans la feuille d'avant,
// faisaient cinq choses à lire pour garder ce qu'on voyait déjà sur soi (la
// refonte du 10 novembre 2026) : ce qu'on garde d'ici, on le porte — c'est ce
// que la page montre.

/**
 * Le dessin d'un article, en petit — dans la barre de l'essai, sur une ligne
 * de ce qu'on essaie, sur la carte de son envie : l'aperçu du thème, le
 * compagnon à sa première forme, le décor du fond, le dessin de l'objet.
 */
export function VignetteDeLArticle({ article }: { article: { sorte: SorteDEnvie; cle: string } }) {
  if (article.sorte === 'theme') {
    const image = apercuDe(article.cle)
    return <span className="panier-vignette">{image && <img src={image} alt="" width={180} height={225} decoding="async" />}</span>
  }
  if (article.sorte === 'fond') return <span className={`panier-vignette carte-fond fond-${article.cle}`} />
  if (article.sorte === 'objet') {
    const objet = OBJETS.find(o => o.cle === article.cle)
    return <span className={`panier-vignette panier-vignette-objet objet-dessin objet-${article.cle}`}>{objet?.dessin()}</span>
  }
  const forme = leCompagnon(article.cle)?.formes[0]
  return <span className="panier-vignette panier-vignette-compagnon">{forme && <Compagnon cle={forme.key} />}</span>
}

/**
 * La barre de l'essai, au-dessus du menu. Elle pose `avec-panier` sur la
 * page, qui ne passe jamais dessous.
 */
export function BarreDuPanier({
  lignes,
  onRetirer,
  onGarder,
  onVoir,
}: {
  lignes: readonly LigneDuPanier[]
  /** Tout retirer : la page et la niche d'avant reviennent. */
  onRetirer: () => void
  /** Un seul article : son présentoir, sur « Confirmer ». */
  onGarder: (ligne: LigneDuPanier) => void
  /** Plusieurs : la feuille de ce qu'on essaie. */
  onVoir: () => void
}) {
  useEffect(() => {
    document.body.classList.add('avec-panier')
    return () => document.body.classList.remove('avec-panier')
  }, [])
  const une = lignes.length === 1 ? lignes[0] : null
  return (
    <div className="boutique-panier" role="region" aria-label="Ton essai">
      <VignetteDeLArticle article={lignes[0]} />
      {/* Son prix au-dessus de son nom, pas dans le bouton : « Garder · 🎊 1000 » ne laissait au nom du Chat des lanternes
          que cinquante pixels, en 360 de large sous une police large — cinq lignes. */}
      <span className="boutique-panier-texte">
        <span className="boutique-panier-sur">{`À l’essai · ${enConfettis(totalDuPanier(lignes))}`}</span>
        <b>{une ? une.nom : `${lignes.length} articles`}</b>
      </span>
      <button type="button" className="boutique-panier-annuler" aria-label={une ? `Retirer ${une.nom} de l’essai` : 'Tout retirer de l’essai'} onClick={onRetirer}>
        <Icon name="x" />
      </button>
      <button type="button" className="btn btn-primary" aria-haspopup="dialog" onClick={() => (une ? onGarder(une) : onVoir())}>
        {une ? 'Garder' : 'Voir'}
      </button>
    </div>
  )
}

/** « Aurore boréale et Le Loup » : la virgule entre les premiers, « et » devant le dernier. */
function aLaFrancaise(noms: readonly string[]): string {
  return noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}` : (noms[0] ?? '')
}

/**
 * Ce qu'on essaie, quand il y en a plusieurs : chaque ligne et la croix qui
 * la retire, le total, ce qui manque à son solde, puis « Tout retirer » ou
 * « Tout garder » — qui rend la main à la boutique : elle achète ligne après
 * ligne et s'arrête au premier refus, dit ici.
 */
export function FeuilleDuPanier({
  lignes,
  solde,
  busy,
  erreur,
  pris,
  onRetirer,
  onGarder,
  onFermer,
}: {
  lignes: readonly LigneDuPanier[]
  solde: number
  busy: boolean
  /** Le refus d'un achat, dit ici. */
  erreur?: string
  /** Ce qui vient d'être gardé : la feuille le dit avant de se fermer. */
  pris: readonly LigneDuPanier[] | null
  /** Retire une sorte de l'essai, ou tout. */
  onRetirer: (sorte?: LigneDuPanier['sorte']) => void
  onGarder: (lignes: readonly LigneDuPanier[]) => void
  onFermer: () => void
}) {
  const manque = ceQuiManque(lignes, solde)
  const total = totalDuPanier(lignes)
  return (
    <Feuille
      titre="Ce que tu essaies"
      onFermer={onFermer}
      className="feuille-boutique feuille-du-panier"
      pied={
        <>
          {erreur && (
            <p className="error" role="alert">
              {erreur}
            </p>
          )}
          {lignes.length > 0 ? (
            <div className="presentoir-gestes">
              <button type="button" className="btn btn-ghost" onClick={() => onRetirer()}>
                Tout retirer
              </button>
              <button type="button" className="btn btn-primary" aria-disabled={busy || manque > 0 || undefined} onClick={() => !busy && manque === 0 && onGarder(lignes)}>
                {`Tout garder · ${enConfettis(total)}`}
              </button>
            </div>
          ) : (
            <div className="presentoir-gestes presentoir-geste-seul">
              <button type="button" className="btn btn-primary" onClick={onFermer}>
                Fermer
              </button>
            </div>
          )}
        </>
      }
    >
      {pris && pris.length > 0 && (
        <p className="card theme-achete" role="status">
          {espacesFines(`${aLaFrancaise(pris.map(l => l.nom))} ${pris.length > 1 ? 'sont à toi, et tu les portes.' : 'est à toi, et tu le portes.'}`)}
        </p>
      )}
      {lignes.length > 0 && (
        <>
          <ul className="panier-lignes">
            {lignes.map(l => (
              <li key={l.sorte} className="panier-ligne">
                <VignetteDeLArticle article={l} />
                <span className="panier-ligne-texte">
                  <b>{l.nom}</b>
                  <span className="muted small">{`${l.detail} · ${enConfettis(l.prix)}`}</span>
                </span>
                <button type="button" className="boutique-panier-annuler" aria-label={`Retirer ${l.nom} de l’essai`} onClick={() => onRetirer(l.sorte)}>
                  <Icon name="x" />
                </button>
              </li>
            ))}
          </ul>
          <p className="panier-total">
            <span>Total</span>
            <b>{enConfettis(total)}</b>
          </p>
          {manque > 0 && (
            <p className="muted small" role="status">
              {espacesFines(`Il te manque ${enConfettis(manque)} pour tout garder : retire ce qui peut attendre.`)}
            </p>
          )}
        </>
      )}
    </Feuille>
  )
}
