// L’espace · Sciences — du robot à l’astronaute.
//
// Peints en images par `server/scripts/anime/portraits.ts`, un ingrédient
// de plus à chaque palier. Le style de la branche : la SF pulp des années 50.
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
  'br:robot': {
    fond: ['#5a66d6', '#1d236e', '#080b27'],
    image: {
      perso: ['/portraits/robot-perso-512.edcac8f555.webp', '/portraits/robot-perso-256.4c21e8e6e9.webp'],
    },
  },
  'br:extraterrestre': {
    fond: ['#5d5ccf', '#1f1f6a', '#090927'],
    image: {
      disque: ['/portraits/extraterrestre-disque-512.f78a273c45.webp', '/portraits/extraterrestre-disque-256.67007eae5d.webp'],
      perso: ['/portraits/extraterrestre-perso-512.faac8caf8c.webp', '/portraits/extraterrestre-perso-256.dd6ea2c4e7.webp'],
    },
  },
  'br:chat': {
    fond: ['#5864d2', '#1b2269', '#070a26'],
    image: {
      disque: ['/portraits/chat-disque-512.0b54e5b312.webp', '/portraits/chat-disque-256.ad59ac6d7f.webp'],
      perso: ['/portraits/chat-perso-512.cbb5ba7b78.webp', '/portraits/chat-perso-256.28d337bd98.webp'],
    },
  },
  'br:astronome': {
    fond: ['#5360cc', '#1a2066', '#070a24'],
    image: {
      disque: ['/portraits/astronome-disque-512.7f4e432190.webp', '/portraits/astronome-disque-256.ba4370a8cb.webp'],
      perso: ['/portraits/astronome-perso-512.4aecdd0d2d.webp', '/portraits/astronome-perso-256.559799d51a.webp'],
    },
  },
  'br:savante': {
    fond: ['#5b62d4', '#1c226c', '#080a27'],
    image: {
      disque: ['/portraits/savante-disque-512.b4b3c4baae.webp', '/portraits/savante-disque-256.137bb0ed05.webp'],
      perso: ['/portraits/savante-perso-512.25aaace6dd.webp', '/portraits/savante-perso-256.5158f62cbf.webp'],
    },
  },
  'br:astronaute': {
    fond: ['#5561d0', '#1b2168', '#070a25'],
    image: {
      disque: ['/portraits/astronaute-disque-512.993e51e573.webp', '/portraits/astronaute-disque-256.367dd6ab07.webp'],
      perso: ['/portraits/astronaute-perso-512.689e9e83ed.webp', '/portraits/astronaute-perso-256.31be268589.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { espace: DESSINS } })
