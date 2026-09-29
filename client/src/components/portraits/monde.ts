// Le tour du monde · Culture générale — du kangourou au panda roux.
//
// Peints en images par `server/scripts/anime/portraits.ts`, un ingrédient
// de plus à chaque palier. Le style de la branche : l’affiche de voyage des années 30.
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
  'br:kangourou': {
    fond: ['#6cbfc4', '#236a7a', '#0a2830'],
    image: {
      perso: ['/portraits/kangourou-perso-512.89ac1e0ad7.webp', '/portraits/kangourou-perso-256.751be32340.webp'],
    },
  },
  'br:lama': {
    fond: ['#5fb3cf', '#1f5e80', '#0a2434'],
    image: {
      disque: ['/portraits/lama-disque-512.029a0f9efd.webp', '/portraits/lama-disque-256.d6241799ad.webp'],
      perso: ['/portraits/lama-perso-512.074caec323.webp', '/portraits/lama-perso-256.fb7db023cd.webp'],
    },
  },
  'br:fennec': {
    fond: ['#72c6bf', '#236b73', '#0a282c'],
    image: {
      disque: ['/portraits/fennec-disque-512.495166d615.webp', '/portraits/fennec-disque-256.8fe8fbde66.webp'],
      perso: ['/portraits/fennec-perso-512.2f84fd78c4.webp', '/portraits/fennec-perso-256.0497a80922.webp'],
    },
  },
  'br:axolotl': {
    fond: ['#58b0c9', '#1c5b79', '#0a2331'],
    image: {
      disque: ['/portraits/axolotl-disque-512.bd6656563f.webp', '/portraits/axolotl-disque-256.6da2eaa7db.webp'],
      perso: ['/portraits/axolotl-perso-512.0ca1409174.webp', '/portraits/axolotl-perso-256.59b7f6b8ea.webp'],
    },
  },
  'br:pangolin': {
    fond: ['#68bcc0', '#22656f', '#0a262c'],
    image: {
      disque: ['/portraits/pangolin-disque-512.f4d9fab2b9.webp', '/portraits/pangolin-disque-256.d501fb6ba1.webp'],
      perso: ['/portraits/pangolin-perso-512.2707f6839d.webp', '/portraits/pangolin-perso-256.59fe898bba.webp'],
    },
  },
  'br:panda-roux': {
    fond: ['#63b6c7', '#22627c', '#0b2632'],
    image: {
      disque: ['/portraits/panda-roux-disque-512.01de430220.webp', '/portraits/panda-roux-disque-256.f6b3673649.webp'],
      perso: ['/portraits/panda-roux-perso-512.4cfffa6728.webp', '/portraits/panda-roux-perso-256.ff1059f959.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { monde: DESSINS } })
