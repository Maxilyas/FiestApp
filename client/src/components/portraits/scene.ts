// La scène · Musique — du DJ au chef d’orchestre.
//
// Peints en images par `server/scripts/anime/portraits.ts`, un ingrédient
// de plus à chaque palier. Le style de la branche : le pop art.
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
  'br:dj': {
    fond: ['#e45aa3', '#6a1f7a', '#1e0a2a'],
    image: {
      perso: ['/portraits/dj-perso-512.165b693b7f.webp', '/portraits/dj-perso-256.5a77196aeb.webp'],
    },
  },
  'br:rockeuse': {
    fond: ['#ea5a96', '#72185e', '#210822'],
    image: {
      disque: ['/portraits/rockeuse-disque-512.bf6926669d.webp', '/portraits/rockeuse-disque-256.283b9610a9.webp'],
      perso: ['/portraits/rockeuse-perso-512.9c75141e54.webp', '/portraits/rockeuse-perso-256.eb7b88c7b9.webp'],
    },
  },
  'br:jazzman': {
    fond: ['#c85aae', '#521f78', '#170a2a'],
    image: {
      disque: ['/portraits/jazzman-disque-512.4058096234.webp', '/portraits/jazzman-disque-256.ed1f8e4b1c.webp'],
      perso: ['/portraits/jazzman-perso-512.097f17e068.webp', '/portraits/jazzman-perso-256.86d194416a.webp'],
    },
  },
  'br:violoniste': {
    fond: ['#df6ab4', '#652082', '#1c0a2c'],
    image: {
      disque: ['/portraits/violoniste-disque-512.b571e2baa3.webp', '/portraits/violoniste-disque-256.6ffded0439.webp'],
      perso: ['/portraits/violoniste-perso-512.d6f43fe7c9.webp', '/portraits/violoniste-perso-256.6ef9dfa008.webp'],
    },
  },
  'br:cantatrice': {
    fond: ['#d654b0', '#5e1a7a', '#1a0828'],
    image: {
      disque: ['/portraits/cantatrice-disque-512.8f543e56a6.webp', '/portraits/cantatrice-disque-256.cb52f74ff9.webp'],
      perso: ['/portraits/cantatrice-perso-512.9409f02fb1.webp', '/portraits/cantatrice-perso-256.495fb5c54b.webp'],
    },
  },
  'br:maestro': {
    fond: ['#e2609c', '#6e1f6e', '#200a26'],
    image: {
      disque: ['/portraits/maestro-disque-512.14fceaf119.webp', '/portraits/maestro-disque-256.dc8f86fc0e.webp'],
      perso: ['/portraits/maestro-perso-512.5e87873218.webp', '/portraits/maestro-perso-256.e7bfe5fa1d.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { scene: DESSINS } })
