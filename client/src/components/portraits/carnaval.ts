// Le carnaval · Autour de la fête — de la piñata au masque de Venise.
//
// Peints en images par `server/scripts/anime/portraits.ts`, un ingrédient
// de plus à chaque palier. Le style de la branche : l’art déco.
//
// Écrit par `server/scripts/anime/livrer.ts` : on ne le retouche pas à la
// main, on relance la chaîne. Les fichiers sont dans `client/public/portraits`,
// nommés par leur empreinte : un portrait repeint change d'adresse, et aucun
// téléphone ne garde l'ancien. Les couleurs sont celles du disque, qui attend
// l'image et reçoit le visage du premier palier.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import type { DessinDePortrait } from './outils'

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:pinata': {
    fond: ['#3aa0a4', '#155056', '#061a1d'],
    image: {
      perso: ['/portraits/pinata-perso-512.f56278540d.webp', '/portraits/pinata-perso-256.64bed3d9c3.webp'],
    },
  },
  'br:fetard': {
    fond: ['#35969a', '#134a50', '#05181b'],
    image: {
      disque: ['/portraits/fetard-disque-512.0d82dfd34b.webp', '/portraits/fetard-disque-256.7011468bed.webp'],
      perso: ['/portraits/fetard-perso-512.4223f224e2.webp', '/portraits/fetard-perso-256.e587279a3c.webp'],
    },
  },
  'br:arlequin': {
    fond: ['#3d9c9a', '#16504c', '#061b19'],
    image: {
      disque: ['/portraits/arlequin-disque-512.9f597f066d.webp', '/portraits/arlequin-disque-256.3c75ea6fec.webp'],
      perso: ['/portraits/arlequin-perso-512.3319ca6a8c.webp', '/portraits/arlequin-perso-256.03250457c0.webp'],
    },
  },
  'br:magicien': {
    fond: ['#2f8a94', '#10414c', '#041519'],
    image: {
      disque: ['/portraits/magicien-disque-512.4b5ec8ae0a.webp', '/portraits/magicien-disque-256.81e06a1f22.webp'],
      perso: ['/portraits/magicien-perso-512.cc53f77637.webp', '/portraits/magicien-perso-256.0742dfa24f.webp'],
    },
  },
  'br:disco': {
    fond: ['#3ba0a8', '#154c58', '#06181f'],
    image: {
      disque: ['/portraits/disco-disque-512.8b02113c4f.webp', '/portraits/disco-disque-256.f14a285e37.webp'],
      perso: ['/portraits/disco-perso-512.922028f8fd.webp', '/portraits/disco-perso-256.d13010ea24.webp'],
    },
  },
  'br:venise': {
    fond: ['#35969a', '#134a50', '#05181b'],
    image: {
      disque: ['/portraits/venise-disque-512.aa7c1ea224.webp', '/portraits/venise-disque-256.a7fce3ed0e.webp'],
      perso: ['/portraits/venise-perso-512.075bf4dd3b.webp', '/portraits/venise-perso-256.6267456a53.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { carnaval: DESSINS } })
