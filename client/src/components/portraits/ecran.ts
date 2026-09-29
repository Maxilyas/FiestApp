// Le grand écran · Cinéma & séries — du cow-boy à la star.
//
// Peints en images par `server/scripts/anime/portraits.ts`, un ingrédient
// de plus à chaque palier. Le style de la branche : l’affiche de cinéma, du noir et blanc au Technicolor.
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
  'br:cow-boy': {
    fond: ['#d9645a', '#7e1d1c', '#2b0808'],
    image: {
      perso: ['/portraits/cow-boy-perso-512.f8dcf31dd0.webp', '/portraits/cow-boy-perso-256.b617e0f7fd.webp'],
    },
  },
  'br:vampire': {
    fond: ['#c94a6c', '#6c1030', '#22040f'],
    image: {
      disque: ['/portraits/vampire-disque-512.c0760ddaec.webp', '/portraits/vampire-disque-256.0d812937d1.webp'],
      perso: ['/portraits/vampire-perso-512.b00119752d.webp', '/portraits/vampire-perso-256.be6d3b5317.webp'],
    },
  },
  'br:detective': {
    fond: ['#c4535e', '#6a1622', '#22060a'],
    image: {
      disque: ['/portraits/detective-disque-512.26e6b93400.webp', '/portraits/detective-disque-256.d9042e3ea6.webp'],
      perso: ['/portraits/detective-perso-512.3f0c99a562.webp', '/portraits/detective-perso-256.2e69b0fc84.webp'],
    },
  },
  'br:pirate': {
    fond: ['#d5566a', '#7a1426', '#2a0610'],
    image: {
      disque: ['/portraits/pirate-disque-512.04b54fa6fd.webp', '/portraits/pirate-disque-256.b302c50bda.webp'],
      perso: ['/portraits/pirate-perso-512.ee4e8ef172.webp', '/portraits/pirate-perso-256.69b32c8b76.webp'],
    },
  },
  'br:super-heroine': {
    fond: ['#e0606e', '#861a2c', '#2d0712'],
    image: {
      disque: ['/portraits/super-heroine-disque-512.9c64cb64b4.webp', '/portraits/super-heroine-disque-256.0f5171b896.webp'],
      perso: ['/portraits/super-heroine-perso-512.94bf012592.webp', '/portraits/super-heroine-perso-256.3a97141a55.webp'],
    },
  },
  'br:star': {
    fond: ['#dc5f78', '#7f1834', '#2b0614'],
    image: {
      disque: ['/portraits/star-disque-512.e1f03e62ee.webp', '/portraits/star-disque-256.120adb5e95.webp'],
      perso: ['/portraits/star-perso-512.be1cdfa458.webp', '/portraits/star-perso-256.4dfeb90786.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { ecran: DESSINS } })
