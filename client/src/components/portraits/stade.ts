// Le stade · Sport — de la nageuse à la danseuse étoile.
//
// Peints en images par `server/scripts/anime/portraits.ts`, un ingrédient
// de plus à chaque palier. Le style de la branche : le low poly.
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
  'br:nageuse': {
    fond: ['#f5a8b6', '#a3405e', '#351028'],
    image: {
      perso: ['/portraits/nageuse-perso-512.21e34d7a6e.webp', '/portraits/nageuse-perso-256.126d283eb3.webp'],
    },
  },
  'br:cycliste': {
    fond: ['#f6b0a0', '#ad4550', '#39121c'],
    image: {
      disque: ['/portraits/cycliste-disque-512.7893241622.webp', '/portraits/cycliste-disque-256.9cca9baa9a.webp'],
      perso: ['/portraits/cycliste-perso-512.a2b19fb41a.webp', '/portraits/cycliste-perso-256.e703cd1cf4.webp'],
    },
  },
  'br:surfeur': {
    fond: ['#f8b89c', '#b84c5a', '#3d1224'],
    image: {
      disque: ['/portraits/surfeur-disque-512.9de3b78af1.webp', '/portraits/surfeur-disque-256.4c0d83bd4d.webp'],
      perso: ['/portraits/surfeur-perso-512.7db764bf6a.webp', '/portraits/surfeur-perso-256.5f81436117.webp'],
    },
  },
  'br:skieuse': {
    fond: ['#efaac8', '#963c70', '#300f2e'],
    image: {
      disque: ['/portraits/skieuse-disque-512.5ea9e98b9b.webp', '/portraits/skieuse-disque-256.28fadc25e6.webp'],
      perso: ['/portraits/skieuse-perso-512.d95067f9db.webp', '/portraits/skieuse-perso-256.b87db01edd.webp'],
    },
  },
  'br:boxeur': {
    fond: ['#f4a4ba', '#a33c62', '#380f28'],
    image: {
      disque: ['/portraits/boxeur-disque-512.b2bc2295b7.webp', '/portraits/boxeur-disque-256.1e254dfff8.webp'],
      perso: ['/portraits/boxeur-perso-512.878906ec2d.webp', '/portraits/boxeur-perso-256.7789d803c7.webp'],
    },
  },
  'br:danseuse': {
    fond: ['#f2a6b8', '#9a3d62', '#33102a'],
    image: {
      disque: ['/portraits/danseuse-disque-512.162d4e8b69.webp', '/portraits/danseuse-disque-256.38e6561e7c.webp'],
      perso: ['/portraits/danseuse-perso-512.2e96df4b8f.webp', '/portraits/danseuse-perso-256.be92301bf1.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { stade: DESSINS } })
