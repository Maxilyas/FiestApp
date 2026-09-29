// Les contes · Arts & lettres — du lutin au griffon.
//
// Peints en images par `server/scripts/anime/portraits.ts`, un ingrédient
// de plus à chaque palier. Le style de la branche : le livre de contes, plume et aquarelle.
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
  'br:lutin': {
    fond: ['#977fe2', '#41308f', '#140c38'],
    image: {
      perso: ['/portraits/lutin-perso-512.8f185f237d.webp', '/portraits/lutin-perso-256.b6dbadbf4d.webp'],
    },
  },
  'br:troll': {
    fond: ['#8f7bdb', '#3a2c8a', '#120b32'],
    image: {
      disque: ['/portraits/troll-disque-512.0d244ce614.webp', '/portraits/troll-disque-256.c9983f02e2.webp'],
      perso: ['/portraits/troll-perso-512.11298b6f21.webp', '/portraits/troll-perso-256.62464cbaf1.webp'],
    },
  },
  'br:yeti': {
    fond: ['#8479dc', '#342c8c', '#100b32'],
    image: {
      disque: ['/portraits/yeti-disque-512.700f2b3c10.webp', '/portraits/yeti-disque-256.733d365855.webp'],
      perso: ['/portraits/yeti-perso-512.c3cc9216a0.webp', '/portraits/yeti-perso-256.e03a0ab569.webp'],
    },
  },
  'br:fee': {
    fond: ['#a27ce0', '#4b2c94', '#190c3a'],
    image: {
      disque: ['/portraits/fee-disque-512.ccdd0840db.webp', '/portraits/fee-disque-256.262abf917f.webp'],
      perso: ['/portraits/fee-perso-512.1d757c21fd.webp', '/portraits/fee-perso-256.b1199bf05a.webp'],
    },
  },
  'br:sirene': {
    fond: ['#8e72dc', '#3b2b8e', '#140b36'],
    image: {
      disque: ['/portraits/sirene-disque-512.7fc47d8186.webp', '/portraits/sirene-disque-256.68658ac05d.webp'],
      perso: ['/portraits/sirene-perso-512.178b282963.webp', '/portraits/sirene-perso-256.fec1042260.webp'],
    },
  },
  'br:griffon': {
    fond: ['#8b6fd8', '#3a2a88', '#130b33'],
    image: {
      disque: ['/portraits/griffon-disque-512.06a59e2aea.webp', '/portraits/griffon-disque-256.ca35b4fd93.webp'],
      perso: ['/portraits/griffon-perso-512.b6dc466667.webp', '/portraits/griffon-perso-256.2c4df4881d.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { contes: DESSINS } })
