import { type CSSProperties, type ReactNode } from 'react'
import { Compagnon, teintesDuCompagnon } from './Compagnon'
import './compagnons-peints'
import { apercuDe } from '../apercus'
import { gemme } from '../gemmes'
import { espacesFines, formatNumber } from '../format'
import { aLaUne, jusquAuBoutDeSaSaison, type ALaUne } from '../../../shared/aLaUne'
import { PRIX_D_UN_COMPAGNON, compagnon as leCompagnon } from '../../../shared/compagnons'
import { PRIX_D_UN_FOND, fond as leFond } from '../../../shared/fonds'
import { NOM_DE_RARETE, prixDe, theme as leTheme, type BoutiqueDuProfil } from '../../../shared/themes'
import type { EssaiDeLaBoutique, SorteDEssai } from '../../../shared/panier'

// « À la une », en tête de la boutique (la refonte du 1er novembre 2026) : ce
// que le bandeau de l'accueil met en avant ce jour-là — un compagnon, un
// thème, de saison d'abord, un fond des savoirs (`shared/aLaUne.ts`, la même
// règle, le même jour sur tous ses appareils) —, ici en grandes cartes qu'on
// fait glisser, chacune avec ses deux gestes : l'essayer tout de suite, ou
// voir sa fiche. Rien de ce qu'il a déjà, et rien du tout s'il a tout.

/** « 🎊 1000 », le prix collé à son confetti : sur deux lignes, le nombre partait seul sous lui. */
const enConfettis = (n: number) => `🎊 ${formatNumber(n)}`

/** La sorte de l'essai pour une sorte de la une : un compagnon s'essaie dans la niche. */
const SORTE: Record<ALaUne['sorte'], SorteDEssai> = { theme: 'theme', fond: 'fond', compagnon: 'compagnon' }

/** Ce qu'une carte de la une montre : son dessin, ce qu'elle est, son nom, sa ligne. */
function contenuDe(u: ALaUne): { style?: CSSProperties; visuel: ReactNode; sur: string; nom: string; detail: string } | null {
  if (u.sorte === 'compagnon') {
    const c = leCompagnon(u.cle)
    const forme = c?.formes[0]
    if (!c || !forme) return null
    const { aura, fond } = teintesDuCompagnon(c.key)
    return {
      style: { '--aura': aura, '--scene': fond[1], '--nuit': fond[2] } as CSSProperties,
      visuel: <Compagnon cle={forme.key} grand />,
      sur: 'Compagnon',
      nom: c.nom,
      detail: `${c.le === 'la' ? 'Elle' : 'Il'} grandit avec toi · ${enConfettis(PRIX_D_UN_COMPAGNON)}`,
    }
  }
  if (u.sorte === 'fond') {
    const f = leFond(u.cle)
    if (!f?.savoir) return null
    return {
      visuel: <span className={`une-boutique-decor carte-fond fond-${f.key}`} />,
      sur: 'Fond de carte',
      nom: f.nom,
      detail: `${f.savoir} · ${enConfettis(PRIX_D_UN_FOND)}`,
    }
  }
  const t = leTheme(u.cle)
  if (!t) return null
  const image = apercuDe(t.key)
  const fin = u.saison ? jusquAuBoutDeSaSaison(t) : null
  return {
    style: gemme(t.rarete),
    visuel: image ? <img src={image} alt="" width={180} height={225} decoding="async" /> : null,
    sur: fin ? `De saison · ${fin}` : 'Thème',
    nom: t.nom,
    detail: `${NOM_DE_RARETE[t.rarete]} · ${enConfettis(prixDe(t))}`,
  }
}

export function UneDeLaBoutique({
  boutique,
  essai,
  onEssayer,
  onVoir,
}: {
  boutique: BoutiqueDuProfil
  essai: EssaiDeLaBoutique
  /** L'essayer — ou, déjà à l'essai, l'ôter. */
  onEssayer: (sorte: SorteDEssai, cle: string) => void
  /** Sa fiche — pour un fond, sa carte dans son rayon. */
  onVoir: (sorte: SorteDEssai, cle: string) => void
}) {
  const une = aLaUne(boutique)
  if (une.length === 0) return null
  return (
    <ul className="une-boutique" aria-label="À la une">
      {une.map(u => {
        const c = contenuDe(u)
        if (!c) return null
        const sorte = SORTE[u.sorte]
        const essaye = essai[sorte] === u.cle
        return (
          <li key={`${u.sorte}-${u.cle}`} className={`une-boutique-carte une-boutique-${u.sorte}`} style={c.style}>
            <span className="une-boutique-visuel" aria-hidden="true">
              {c.visuel}
            </span>
            <span className="une-boutique-texte">
              <span className="une-boutique-sur">{espacesFines(c.sur)}</span>
              <b className="une-boutique-nom">{c.nom}</b>
              <span className="une-boutique-detail">{espacesFines(c.detail)}</span>
            </span>
            <span className="une-boutique-gestes">
              {/* Un interrupteur : son nom ne change pas, `aria-pressed` dit s'il est à l'essai. */}
              <button type="button" className="btn btn-primary" aria-pressed={essaye} onClick={() => onEssayer(sorte, u.cle)}>
                L’essayer<span className="sr-only">{` : ${c.nom}`}</span>
              </button>
              <button type="button" className="btn btn-ghost" aria-haspopup={u.sorte === 'fond' ? undefined : 'dialog'} onClick={() => onVoir(sorte, u.cle)}>
                Voir<span className="sr-only">{` : ${c.nom}`}</span>
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
