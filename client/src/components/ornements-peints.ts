// Les ornements de la niche, peints : les calques de chaque style, chacun
// en deux tailles, `[grande, petite]`, et le plan où il se pose — au fond,
// derrière la niche, sur son cadre (sous ce qui pend devant lui), ou devant
// elle —, dans l'ordre où ils se posent.
//
// Peints en images par `server/scripts/anime/ornements.ts`, chacun dans le
// repère d'un calque : un carré de 120 unités de niche, la niche (54 × 62) au
// centre, que `Ornements.tsx` pose de même.
//
// Écrit par `server/scripts/anime/ornements.ts --livrer` : on ne le retouche
// pas à la main, on relance la chaîne. Les fichiers sont dans
// `client/public/ornements`, nommés par leur empreinte : un ornement repeint
// change d'adresse, et aucun téléphone ne garde l'ancien.
import type { CleDOrnement, StylePeint } from '../../../shared/ornements'

/** Où un calque se pose : au fond, derrière la niche, sur son cadre, ou devant elle. */
export type PlanDUnCalque = 'fond' | 'derriere' | 'cadre' | 'devant'

export interface CalquePeint {
  plan: PlanDUnCalque
  /** `[grande, petite]` : 512 et 256 pixels pour les 120 unités du calque. */
  fichiers: readonly [string, string]
}

export const ORNEMENTS_PEINTS: Readonly<Record<StylePeint, Readonly<Record<CleDOrnement, readonly CalquePeint[]>>>> = {
  feerique: {
    guirlande: [
      { plan: 'devant', fichiers: ['/ornements/guirlande-feerique-512.a28c0c10f7.webp', '/ornements/guirlande-feerique-256.d514edce2a.webp'] },
    ],
    lierre: [
      { plan: 'derriere', fichiers: ['/ornements/lierre-feerique-512.1345039a11.webp', '/ornements/lierre-feerique-256.6e699ac677.webp'] },
    ],
    arche: [
      { plan: 'cadre', fichiers: ['/ornements/arche-feerique-512.b80b2cd636.webp', '/ornements/arche-feerique-256.ed676cbbd1.webp'] },
      { plan: 'devant', fichiers: ['/ornements/etoile-feerique-512.bcc29c3b12.webp', '/ornements/etoile-feerique-256.0da7889158.webp'] },
    ],
    halo: [
      { plan: 'fond', fichiers: ['/ornements/halo-feerique-512.1505820147.webp', '/ornements/halo-feerique-256.e1da28c554.webp'] },
    ],
  },
}
