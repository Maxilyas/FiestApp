import type { ReactNode } from 'react'
import { PRIX_D_UN_SABLIER, SABLIERS_MAX } from '../../../shared/jour'
import { PRIX_D_UNE_VIE, VIES_PAR_ACHAT_MAX } from '../../../shared/sentiers'
import { PRIX_D_UN_ECLAT } from '../../../shared/profil'

// Les objets qui s'achètent en confettis — une vie des sentiers, un sablier
// pour la série du quiz du jour, un Éclat pour qui n'a pas de chance —, et
// leurs dessins.
// À part de la boutique : la page du quiz du jour montre ses sabliers sans
// télécharger la boutique entière.

/**
 * Un sablier dessiné. Plein, son sable : le haut qui s'écoule, le filet, le
 * tas au fond ; vide, sa seule silhouette. Il se teinte de `currentColor` —
 * l'or des sabliers qu'on a, la retenue de ceux qui manquent.
 */
export function Sablier({ plein = true, className }: { plein?: boolean; className?: string }) {
  return (
    <svg className={'sablier' + (plein ? ' sablier-plein' : ' sablier-vide') + (className ? ` ${className}` : '')} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className="sablier-monture" d="M5.5 2.5h13M5.5 21.5h13" />
      <path className="sablier-verre" d="M7.2 2.5c0 4.6 3.6 6.4 3.6 9.5s-3.6 4.9-3.6 9.5h9.6c0-4.6-3.6-6.4-3.6-9.5s3.6-4.9 3.6-9.5" />
      {plein && (
        <>
          <path className="sablier-sable" d="M8.9 6.2h6.2c-.5 2.1-2.3 3.3-3.1 4.6-.8-1.3-2.6-2.5-3.1-4.6Z" />
          <path className="sablier-filet" d="M12 11v5" />
          <path className="sablier-sable" d="M8.3 20.3c.6-2 2.4-3 3.7-4.4 1.3 1.4 3.1 2.4 3.7 4.4Z" />
        </>
      )}
    </svg>
  )
}

/** Un cœur de vie, plein : les vies des sentiers, comme celles de la série. */
export function CoeurDeVie({ className }: { className?: string }) {
  return (
    <svg className={'coeur-de-vie' + (className ? ` ${className}` : '')} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
    </svg>
  )
}

/** Les sabliers de la série en petit : un par place, pleins ceux qu'on a. */
export function PucesDeSabliers({ sabliers }: { sabliers: number }) {
  return (
    <span className="sabliers-puces" aria-hidden="true">
      {Array.from({ length: SABLIERS_MAX }, (_, i) => (
        <Sablier key={i} plein={i < sabliers} />
      ))}
    </span>
  )
}

/**
 * Un Éclat dessiné : une gemme taillée, ses facettes aux couleurs de l'Éclat
 * — celles qu'un avatar éclaté prend —, et deux étincelles.
 */
export function GemmeDEclat({ className }: { className?: string }) {
  return (
    <svg className={'gemme-d-eclat' + (className ? ` ${className}` : '')} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className="eclat-facette-a" d="M7 4.5h10l3.5 4.5L12 20.5 3.5 9Z" />
      <path className="eclat-facette-b" d="M3.5 9h17L12 20.5Z" />
      <path className="eclat-facette-c" d="M7 4.5 9.5 9 12 4.5 14.5 9 17 4.5" />
      <path className="eclat-etincelle" d="M20 1.5v3M18.5 3h3M3.5 15.5v3M2 17h3" />
    </svg>
  )
}

export type CleDObjet = 'vie' | 'sablier' | 'eclat'

/** Un objet de la boutique : ce qu'il est, ce qu'il coûte, et combien on peut en prendre d'un coup. */
export interface Objet {
  cle: CleDObjet
  /** Court : il tient sur une ligne de sa case. */
  nom: string
  /** Où il sert, sous son nom dans sa fiche. */
  pour: string
  /** « 2 vies », « 1 sablier ». */
  compte: (n: number) => string
  prix: number
  /** Ce qu'il fait, en une phrase. */
  dit: string
  /** Ce qu'il change pour lui, en quelques mots : le comptoir de la boutique le met en avant. */
  accroche: string
  dessin: () => ReactNode
  /** Au plus, d'un achat — ou ce qui reste de place, pour le sablier. */
  maximum: number
  /** Ce que dit sa fiche quand il n'y a plus de place : rien à acheter. */
  plein?: string
}

export const OBJETS: readonly Objet[] = [
  {
    cle: 'vie',
    nom: 'Vie',
    pour: 'Sentiers du savoir',
    compte: n => `${n} vie${n > 1 ? 's' : ''}`,
    prix: PRIX_D_UNE_VIE,
    dit: 'Un palier raté coûte une vie. Celles-ci vont dans ta réserve : elles servent après celles du jour, et ne périment pas.',
    accroche: 'Un palier raté ne t’arrête plus.',
    dessin: () => <CoeurDeVie />,
    maximum: VIES_PAR_ACHAT_MAX,
  },
  {
    cle: 'sablier',
    nom: 'Sablier',
    pour: 'Série du quiz du jour',
    compte: n => `${n} sablier${n > 1 ? 's' : ''}`,
    prix: PRIX_D_UN_SABLIER,
    dit: 'Un jour sans quiz du jour en prend un, et ta série tient — sans compter ce jour-là. Achète-le avant le jour manqué, ou ce jour-là avant minuit.',
    accroche: 'Un jour manqué ne casse plus ta série.',
    dessin: () => <Sablier />,
    maximum: SABLIERS_MAX,
    plein: 'Tu as tes deux sabliers : un jour manqué en prendra un, et tu pourras le remplacer.',
  },
  {
    cle: 'eclat',
    nom: 'Éclat',
    pour: 'Pour ceux qui n’ont pas de chance',
    compte: n => `${n} Éclat${n > 1 ? 's' : ''}`,
    prix: PRIX_D_UN_ECLAT,
    dit: 'Il attend dans ta loge, et tu choisis l’avatar qui éclate : il change de couleurs, pour toujours. Tu vois chacun éclaté avant de choisir.',
    accroche: 'L’avatar de ton choix change de couleurs, pour toujours.',
    dessin: () => <GemmeDEclat />,
    // Un à la fois : il coûte cher, et se dépense d'abord.
    maximum: 1,
  },
]

/** L'adresse d'un objet dans la boutique : la fiche s'ouvre d'elle-même (`/boutique#objet-sablier`). */
export const adresseDeLObjet = (cle: CleDObjet) => `/boutique#objet-${cle}`

/** L'objet dont l'adresse ouvre la fiche (`#objet-sablier`), ou rien. */
export const objetDeLAdresse = (hash: string): CleDObjet | undefined => OBJETS.find(o => hash === `#objet-${o.cle}`)?.cle
