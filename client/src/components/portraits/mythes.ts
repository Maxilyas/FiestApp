// Les mythologies · Histoire — du Minotaure à Athéna.
//
// Peints en images par `server/scripts/anime/portraits.ts`, un ingrédient
// de plus à chaque palier. Le style de la branche : l’anime.
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
  'br:minotaure': {
    fond: ['#5577d6', '#1d3486', '#091436'],
    image: {
      perso: ['/portraits/minotaure-perso-512.43002d0857.webp', '/portraits/minotaure-perso-256.05ad88a8b2.webp'],
    },
  },
  'br:gorgone': {
    fond: ['#4f6acb', '#1c2d7c', '#0a1233'],
    image: {
      disque: ['/portraits/gorgone-disque-512.7ef9cf6382.webp', '/portraits/gorgone-disque-256.8550c6f59f.webp'],
      perso: ['/portraits/gorgone-perso-512.c91c3a5903.webp', '/portraits/gorgone-perso-256.05c6e6eddb.webp'],
    },
  },
  'br:thor': {
    fond: ['#4d7ad4', '#1a3888', '#07143a'],
    image: {
      disque: ['/portraits/thor-disque-512.74a2b4dede.webp', '/portraits/thor-disque-256.9484384a59.webp'],
      perso: ['/portraits/thor-perso-512.bfd7bde240.webp', '/portraits/thor-perso-256.b4ac471b56.webp'],
    },
  },
  'br:anubis': {
    fond: ['#4a70d0', '#1b3180', '#081234'],
    image: {
      disque: ['/portraits/anubis-disque-512.6ee21ccfd1.webp', '/portraits/anubis-disque-256.c6b063be50.webp'],
      perso: ['/portraits/anubis-perso-512.aef19695a2.webp', '/portraits/anubis-perso-256.502bca8637.webp'],
    },
  },
  'br:poseidon': {
    fond: ['#4379cf', '#163a82', '#061536'],
    image: {
      disque: ['/portraits/poseidon-disque-512.2c2587e727.webp', '/portraits/poseidon-disque-256.ae376c807a.webp'],
      perso: ['/portraits/poseidon-perso-512.89e1b1b034.webp', '/portraits/poseidon-perso-256.b7007df3ab.webp'],
    },
  },
  'br:athena': {
    fond: ['#5a74d6', '#22368a', '#0b1438'],
    image: {
      disque: ['/portraits/athena-disque-512.af9a1dd87e.webp', '/portraits/athena-disque-256.bc92ae6a29.webp'],
      perso: ['/portraits/athena-perso-512.3112136256.webp', '/portraits/athena-perso-256.f9cd077a2f.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { mythes: DESSINS } })
