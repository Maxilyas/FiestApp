// Les océans · Géographie — de l’hippocampe au narval.
//
// Peints en images par `server/scripts/anime/portraits.ts`, un ingrédient
// de plus à chaque palier. Le style de la branche : l’estampe japonaise.
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
  'br:hippocampe': {
    fond: ['#41b2ca', '#10577a', '#041b2e'],
    image: {
      perso: ['/portraits/hippocampe-perso-512.b4d492a7d3.webp', '/portraits/hippocampe-perso-256.e9fbbfd760.webp'],
    },
  },
  'br:tortue': {
    fond: ['#3aa2cf', '#0d4b72', '#03172c'],
    image: {
      disque: ['/portraits/tortue-disque-512.924e4f2a2f.webp', '/portraits/tortue-disque-256.e608821f10.webp'],
      perso: ['/portraits/tortue-perso-512.804561ad59.webp', '/portraits/tortue-perso-256.e79602da78.webp'],
    },
  },
  'br:meduse': {
    fond: ['#39aac6', '#0e4c69', '#03182a'],
    image: {
      disque: ['/portraits/meduse-disque-512.d86056732a.webp', '/portraits/meduse-disque-256.6e17778a70.webp'],
      perso: ['/portraits/meduse-perso-512.cfe749aac7.webp', '/portraits/meduse-perso-256.37935083ef.webp'],
    },
  },
  'br:raie': {
    fond: ['#4ab6d6', '#115f88', '#041e34'],
    image: {
      disque: ['/portraits/raie-disque-512.9e79596da1.webp', '/portraits/raie-disque-256.a3d0e43399.webp'],
      perso: ['/portraits/raie-perso-512.cad017d6fe.webp', '/portraits/raie-perso-256.0ef822edab.webp'],
    },
  },
  'br:baleine': {
    fond: ['#44a8cc', '#0f4e78', '#03172b'],
    image: {
      disque: ['/portraits/baleine-disque-512.521d75ff2c.webp', '/portraits/baleine-disque-256.32d7fbf3e7.webp'],
      perso: ['/portraits/baleine-perso-512.00a223437d.webp', '/portraits/baleine-perso-256.5b4a529097.webp'],
    },
  },
  'br:narval': {
    fond: ['#3a9dc4', '#0c476a', '#021628'],
    image: {
      disque: ['/portraits/narval-disque-512.38c137e908.webp', '/portraits/narval-disque-256.7d74d31cb8.webp'],
      perso: ['/portraits/narval-perso-512.2af3b14d50.webp', '/portraits/narval-perso-256.8a17aa5fba.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { oceans: DESSINS } })
