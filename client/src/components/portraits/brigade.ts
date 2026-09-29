// La brigade · Cuisine — du croissant au chef.
//
// Peints en images par `server/scripts/anime/portraits.ts`, un ingrédient
// de plus à chaque palier. Le style de la branche : la pâte à modeler.
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
  'br:croissant': {
    fond: ['#d9784a', '#8a3517', '#2e0e04'],
    image: {
      perso: ['/portraits/croissant-perso-512.23887ff73b.webp', '/portraits/croissant-perso-256.ccf98ed67c.webp'],
    },
  },
  'br:macaron': {
    fond: ['#f0a068', '#a04c24', '#3c1708'],
    image: {
      disque: ['/portraits/macaron-disque-512.d900829b26.webp', '/portraits/macaron-disque-256.ea5f9d7228.webp'],
      perso: ['/portraits/macaron-perso-512.ac5db939b5.webp', '/portraits/macaron-perso-256.98933dc499.webp'],
    },
  },
  'br:boulanger': {
    fond: ['#f4a868', '#a85026', '#3f180a'],
    image: {
      disque: ['/portraits/boulanger-disque-512.c4554acefb.webp', '/portraits/boulanger-disque-256.f0267a840e.webp'],
      perso: ['/portraits/boulanger-perso-512.305ba24cb4.webp', '/portraits/boulanger-perso-256.13571605ee.webp'],
    },
  },
  'br:patissiere': {
    fond: ['#f09a62', '#9e4622', '#3a1508'],
    image: {
      disque: ['/portraits/patissiere-disque-512.8306251ce2.webp', '/portraits/patissiere-disque-256.9f37c66f03.webp'],
      perso: ['/portraits/patissiere-perso-512.487df9fced.webp', '/portraits/patissiere-perso-256.b798c8e1a2.webp'],
    },
  },
  'br:sommelier': {
    fond: ['#eb9a60', '#9a4420', '#381405'],
    image: {
      disque: ['/portraits/sommelier-disque-512.1c21436814.webp', '/portraits/sommelier-disque-256.694732f5e9.webp'],
      perso: ['/portraits/sommelier-perso-512.cb629278a2.webp', '/portraits/sommelier-perso-256.b8bfc36dcf.webp'],
    },
  },
  'br:chef': {
    fond: ['#f2a064', '#a24a22', '#3d1608'],
    image: {
      disque: ['/portraits/chef-disque-512.43d0984f62.webp', '/portraits/chef-disque-256.f6822bc79b.webp'],
      perso: ['/portraits/chef-perso-512.8ea3dc2bfa.webp', '/portraits/chef-perso-256.de37f961ff.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { brigade: DESSINS } })
