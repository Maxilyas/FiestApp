// L’arcade · Jeux & pop culture — du slime au chevalier, en pixels.
//
// Peints en images par `server/scripts/anime/portraits.ts`, un ingrédient
// de plus à chaque palier. Le style de la branche : le pixel art.
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
  'br:slime': {
    fond: ['#4cc2c8', '#16607a', '#07192b'],
    image: {
      perso: ['/portraits/slime-perso-512.6bbfddb979.webp', '/portraits/slime-perso-256.f82bc9a207.webp'],
    },
  },
  'br:squelette': {
    fond: ['#4ab0cf', '#155277', '#061729'],
    image: {
      disque: ['/portraits/squelette-disque-512.8701a2572f.webp', '/portraits/squelette-disque-256.112926de62.webp'],
      perso: ['/portraits/squelette-perso-512.67f43b3748.webp', '/portraits/squelette-perso-256.faeaa3cdc1.webp'],
    },
  },
  'br:coffre': {
    fond: ['#3fbac4', '#135a73', '#061a28'],
    image: {
      disque: ['/portraits/coffre-disque-512.9caafbe3dc.webp', '/portraits/coffre-disque-256.51af663874.webp'],
      perso: ['/portraits/coffre-perso-512.9197ec710e.webp', '/portraits/coffre-perso-256.12d0d1df14.webp'],
    },
  },
  'br:archere': {
    fond: ['#48bccf', '#175c7e', '#07192d'],
    image: {
      disque: ['/portraits/archere-disque-512.b487fa77e9.webp', '/portraits/archere-disque-256.f5a9ba47f5.webp'],
      perso: ['/portraits/archere-perso-512.22579fd294.webp', '/portraits/archere-perso-256.0d1abce3f8.webp'],
    },
  },
  'br:mage': {
    fond: ['#52b6d6', '#1a5580', '#08172e'],
    image: {
      disque: ['/portraits/mage-disque-512.6a1e3586a9.webp', '/portraits/mage-disque-256.c39d3eb544.webp'],
      perso: ['/portraits/mage-perso-512.65aa091e71.webp', '/portraits/mage-perso-256.9ee85dd6a6.webp'],
    },
  },
  'br:chevalier': {
    fond: ['#45b9cc', '#16597a', '#07192b'],
    image: {
      disque: ['/portraits/chevalier-disque-512.e59b195c46.webp', '/portraits/chevalier-disque-256.098d28bb90.webp'],
      perso: ['/portraits/chevalier-perso-512.3bce4b7031.webp', '/portraits/chevalier-perso-256.cf002813dd.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { arcade: DESSINS } })
