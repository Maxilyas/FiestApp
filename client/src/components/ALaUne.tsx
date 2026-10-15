import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Dessin } from './Avatar'
import { apercuDe } from '../apercus'
import { gemme } from '../gemmes'
import { espacesFines, formatNumber } from '../format'
import { aLaUne, jusquAuBoutDeSaSaison, type ALaUne } from '../../../shared/aLaUne'
import { compagnon, PRIX_D_UN_COMPAGNON } from '../../../shared/compagnons'
import { prixDe, theme as themeDe, type BoutiqueDuProfil, type RareteDeTheme } from '../../../shared/themes'

// Le bandeau « À la une » de l'accueil (la maquette C, `shared/aLaUne.ts`) :
// un objet de la boutique à la fois, son dessin qui déborde du bandeau par la
// gauche — le compagnon qui flotte, l'écran du thème penché —, et un toucher
// mène à sa place dans la boutique. Il passe au suivant toutes les quelques
// secondes, jamais sous le doigt ni sous le focus, et pas du tout si le
// système demande moins de mouvement : il intrigue sans rien bousculer.

/** Le temps d'un objet à la une, avant le suivant. */
const TOUR_MS = 6500

function sansMouvement(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

/** Ce qu'est un thème, à son genre : les raretés s'écrivent au féminin, la boutique dit « Peu commune ». */
const UN_THEME: Readonly<Record<RareteDeTheme, string>> = {
  offert: 'Un thème offert',
  commune: 'Un thème commun',
  peucommune: 'Un thème peu commun',
  rare: 'Un thème rare',
  epique: 'Un thème épique',
  legendaire: 'Un thème légendaire',
}

/** Le surtitre : la saison qui va partir d'abord, puis ce que son solde paie déjà — le chiffre seul ne disait pas à quoi il sert. */
function surtitre(prix: number, solde: number, saison = false): string {
  if (saison) return 'De saison'
  return solde >= prix ? 'À ta portée' : 'À la une'
}

/** Ce qu'un objet à la une montre : son dessin, ce qu'il est, son nom, sa ligne, son adresse. */
function contenuDe(u: ALaUne, solde: number): { href: string; classe: string; style?: CSSProperties; visuel: ReactNode; sur: string; nom: string; detail: string } | null {
  if (u.sorte === 'compagnon') {
    const c = compagnon(u.cle)
    const forme = c?.formes[0]
    if (!c || !forme) return null
    return {
      href: '/boutique#compagnons',
      classe: `une-compagnon une-${c.key}`,
      visuel: <Dessin cle={forme.key} />,
      sur: surtitre(PRIX_D_UN_COMPAGNON, solde),
      nom: c.nom,
      detail: `${c.le === 'la' ? 'Elle' : 'Il'} grandit avec toi · 🎊 ${formatNumber(PRIX_D_UN_COMPAGNON)}`,
    }
  }
  const t = themeDe(u.cle)
  if (!t) return null
  const image = apercuDe(t.key)
  const fin = u.saison ? jusquAuBoutDeSaSaison(t) : null
  return {
    href: `/boutique#theme-${t.key}`,
    classe: 'une-theme',
    style: gemme(t.rarete),
    visuel: image ? <img src={image} alt="" width={48} height={60} decoding="async" /> : <Icon name="palette" />,
    sur: surtitre(prixDe(t), solde, u.saison),
    nom: t.nom,
    detail: `${UN_THEME[t.rarete]} · 🎊 ${formatNumber(prixDe(t))}${fin ? ` · ${fin}` : ''}`,
  }
}

/**
 * Le bandeau : l'objet du moment, en lien vers lui, et des points qui disent
 * qu'il y en a d'autres. Rien s'il a tout ce que la boutique vend.
 */
export function BandeauALaUne({ boutique }: { boutique: BoutiqueDuProfil }) {
  const cles = `${boutique.jour}|${boutique.possedes.join()}|${(boutique.compagnons ?? []).map(c => c.compagnon).join()}`
  const une = useMemo(() => aLaUne(boutique), [cles])
  const [i, setI] = useState(0)
  const [retenu, setRetenu] = useState(false)
  const [calme] = useState(sansMouvement)
  useEffect(() => {
    if (calme || retenu || une.length < 2) return
    const t = window.setInterval(() => setI(x => (x + 1) % une.length), TOUR_MS)
    return () => window.clearInterval(t)
  }, [calme, retenu, une.length])
  const ici = une.length > 0 ? i % une.length : 0
  const c = une.length > 0 ? contenuDe(une[ici], boutique.confettis.solde) : null
  if (!c) return null
  return (
    <a
      // Une clé par objet : son entrée se rejoue à chaque passage.
      key={ici}
      className={`une ${c.classe}`}
      style={c.style}
      href={c.href}
      onPointerEnter={() => setRetenu(true)}
      onPointerLeave={() => setRetenu(false)}
      onFocus={() => setRetenu(true)}
      onBlur={() => setRetenu(false)}
    >
      <span className="une-visuel" aria-hidden="true">
        {c.visuel}
      </span>
      <span className="une-texte">
        <span className="une-sur">{espacesFines(c.sur)}</span>
        <b className="une-nom">{c.nom}</b>
        <span className="une-detail">{espacesFines(c.detail)}</span>
      </span>
      <span className="une-aller" aria-hidden="true">
        <Icon name="chevron-right" />
      </span>
      {une.length > 1 && (
        <span className="une-points" aria-hidden="true">
          {une.map((_, j) => (
            <i key={j} className={j === ici ? 'une-point-ici' : undefined} />
          ))}
        </span>
      )}
    </a>
  )
}
