// La forêt · Nature — de l'écureuil au cerf.
//
// Peints en images par `server/scripts/anime/portraits.ts`, un ingrédient
// de plus à chaque palier. Le style de la branche : le papier découpé.
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
  'br:ecureuil': {
    fond: ['#86c47a', '#2f6b3c', '#0d2614'],
    image: {
      perso: ['/portraits/ecureuil-perso-512.88ab1f33e5.webp', '/portraits/ecureuil-perso-256.a441091590.webp'],
    },
  },
  'br:blaireau': {
    fond: ['#6fae8a', '#265a44', '#0a1f17'],
    image: {
      disque: ['/portraits/blaireau-disque-512.0e099f813a.webp', '/portraits/blaireau-disque-256.a61c52e1d6.webp'],
      perso: ['/portraits/blaireau-perso-512.b3643ade43.webp', '/portraits/blaireau-perso-256.bf31109bb2.webp'],
    },
  },
  'br:lynx': {
    fond: ['#9cc47e', '#3b6536', '#10230f'],
    image: {
      disque: ['/portraits/lynx-disque-512.60177db325.webp', '/portraits/lynx-disque-256.34c4380ea8.webp'],
      perso: ['/portraits/lynx-perso-512.2e40084f6d.webp', '/portraits/lynx-perso-256.7144e9bab8.webp'],
    },
  },
  'br:loup': {
    fond: ['#4f9a86', '#1a4a3d', '#081b16'],
    image: {
      disque: ['/portraits/loup-disque-512.103463286e.webp', '/portraits/loup-disque-256.8347162dd4.webp'],
      perso: ['/portraits/loup-perso-512.0f2da68abb.webp', '/portraits/loup-perso-256.f1cd52a86f.webp'],
    },
  },
  'br:ours': {
    fond: ['#6aa97a', '#255339', '#0a1e13'],
    image: {
      disque: ['/portraits/ours-disque-512.65f49a53de.webp', '/portraits/ours-disque-256.cbbb2f26b7.webp'],
      perso: ['/portraits/ours-perso-512.7a9f06ee1b.webp', '/portraits/ours-perso-256.d78dde6a04.webp'],
    },
  },
  'br:cerf': {
    fond: ['#5aa97c', '#1f4f39', '#0a1f16'],
    image: {
      disque: ['/portraits/cerf-disque-512.140fcb66e2.webp', '/portraits/cerf-disque-256.f5bfeda92e.webp'],
      perso: ['/portraits/cerf-perso-512.829e6ac0f3.webp', '/portraits/cerf-perso-256.4e052d476c.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { foret: DESSINS } })
