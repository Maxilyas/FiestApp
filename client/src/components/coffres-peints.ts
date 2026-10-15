// Les coffres de la semaine, peints : chacun fermé, puis ouvert sur la même
// pose (`shared/coffre.ts`, ses quatre rangs). Leurs fichiers vivent dans
// `client/public/decors`, détourés, rognés au même cadre : posés l’un sur
// l’autre, la caisse ne saute pas quand le couvercle s’ouvre. `rapport` :
// la hauteur sur la largeur, pour réserver leur place.
//
// Écrit par `server/scripts/anime/decors.ts --livrer` : on ne le retouche
// pas à la main, on relance la chaîne. Chaque fichier est nommé par son
// empreinte : un coffre repeint change d'adresse. `fente` : où la lumière
// filtre sous le couvercle fermé, en part de la hauteur.

import type { RangDuCoffre } from '../../../shared/coffre'

export const COFFRES_PEINTS: Partial<Record<RangDuCoffre, { ferme: string; ouvert: string; rapport: number; fente: number }>> = {
  bois: { ferme: '/decors/coffre-bois-ferme-480.fd781d0867.webp', ouvert: '/decors/coffre-bois-ouvert-480.3dba2f806c.webp', rapport: 1.004, fente: 0.561 },
  argent: { ferme: '/decors/coffre-argent-ferme-480.238e8767b8.webp', ouvert: '/decors/coffre-argent-ouvert-480.b70c6de278.webp', rapport: 0.844, fente: 0.507 },
  or: { ferme: '/decors/coffre-or-ferme-480.0edeb67704.webp', ouvert: '/decors/coffre-or-ouvert-480.a54632c28f.webp', rapport: 1.047, fente: 0.55 },
  royal: { ferme: '/decors/coffre-royal-ferme-480.2d0e0ecadb.webp', ouvert: '/decors/coffre-royal-ouvert-480.d46479f367.webp', rapport: 0.965, fente: 0.578 },
}
