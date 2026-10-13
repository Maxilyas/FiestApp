// Les compagnons peints : les fichiers de chaque forme, et le monde vivant de
// leur forme ultime.
//
// Peints en images par `server/scripts/anime/compagnons.ts`, dans un seul
// style — la peinture lumineuse : une collection.
//
// Écrit par `server/scripts/anime/livrer-compagnons.ts` : on ne le retouche
// pas à la main, on relance la chaîne. Les fichiers sont dans
// `client/public/compagnons`, nommés par leur empreinte : un compagnon repeint
// change d'adresse, et aucun téléphone ne garde l'ancien.
import { inscrireDessin } from './medaillons'
import { Compagnon, type DessinDeCompagnon } from './Compagnon'

export const DESSINS: Record<string, DessinDeCompagnon> = {
  'cp:loup-louveteau': {
    perso: ['/compagnons/loup-louveteau-perso-512.100e072e6e.webp', '/compagnons/loup-louveteau-perso-256.4243eb1edf.webp'],
  },
  'cp:loup-jeune': {
    disque: ['/compagnons/loup-jeune-disque-512.4f3483d374.webp', '/compagnons/loup-jeune-disque-256.d16245aa72.webp'],
    perso: ['/compagnons/loup-jeune-perso-512.8b9450ee34.webp', '/compagnons/loup-jeune-perso-256.abf42c9290.webp'],
  },
  'cp:loup-adulte': {
    disque: ['/compagnons/loup-adulte-disque-512.5f5c41d34f.webp', '/compagnons/loup-adulte-disque-256.b5f2f212d4.webp'],
    perso: ['/compagnons/loup-adulte-perso-512.99655a3d29.webp', '/compagnons/loup-adulte-perso-256.10abd4a8fd.webp'],
  },
  'cp:loup-ultime': {
    disque: ['/compagnons/loup-ultime-disque-512.0d1ffab4ca.webp', '/compagnons/loup-ultime-disque-256.a28641f316.webp'],
    perso: ['/compagnons/loup-ultime-perso-512.d40242a86f.webp', '/compagnons/loup-ultime-perso-256.610728a646.webp'],
    vivant: {
      rubans: ['/compagnons/loup-ultime-vivant-rubans-512.ef4fdaa542.webp', '/compagnons/loup-ultime-vivant-rubans-256.f7beac4ff2.webp'],
    },
  },
  'cp:chat-chaton': {
    perso: ['/compagnons/chat-chaton-perso-512.87e13a2b28.webp', '/compagnons/chat-chaton-perso-256.9a1e4eae94.webp'],
  },
  'cp:chat-jeune': {
    disque: ['/compagnons/chat-jeune-disque-512.b7e37eb905.webp', '/compagnons/chat-jeune-disque-256.91d0525b0d.webp'],
    perso: ['/compagnons/chat-jeune-perso-512.6adb68472b.webp', '/compagnons/chat-jeune-perso-256.ded493939b.webp'],
  },
  'cp:chat-adulte': {
    disque: ['/compagnons/chat-adulte-disque-512.b3976cb4b8.webp', '/compagnons/chat-adulte-disque-256.11cc7bb551.webp'],
    perso: ['/compagnons/chat-adulte-perso-512.3b650b6bbb.webp', '/compagnons/chat-adulte-perso-256.6dd20c1a1e.webp'],
  },
  'cp:chat-esprit': {
    disque: ['/compagnons/chat-esprit-disque-512.cfdf86bff6.webp', '/compagnons/chat-esprit-disque-256.bfebf160dd.webp'],
    perso: ['/compagnons/chat-esprit-perso-512.8e20b00408.webp', '/compagnons/chat-esprit-perso-256.3620435a2d.webp'],
    vivant: {
      feux: ['/compagnons/chat-esprit-vivant-feux-512.0282eca064.webp', '/compagnons/chat-esprit-vivant-feux-256.37d251a356.webp'],
      lanternes: ['/compagnons/chat-esprit-vivant-lanternes-512.06e7fdf59f.webp', '/compagnons/chat-esprit-vivant-lanternes-256.7b842a2d40.webp'],
    },
  },
  'cp:tortue-bebe': {
    perso: ['/compagnons/tortue-bebe-perso-512.f7457465d2.webp', '/compagnons/tortue-bebe-perso-256.15f75b1d81.webp'],
  },
  'cp:tortue-jeune': {
    disque: ['/compagnons/tortue-jeune-disque-512.0128330159.webp', '/compagnons/tortue-jeune-disque-256.afa13da3ae.webp'],
    perso: ['/compagnons/tortue-jeune-perso-512.253923516e.webp', '/compagnons/tortue-jeune-perso-256.0c649250bf.webp'],
  },
  'cp:tortue-adulte': {
    disque: ['/compagnons/tortue-adulte-disque-512.f56425ec50.webp', '/compagnons/tortue-adulte-disque-256.01b0b65f3e.webp'],
    perso: ['/compagnons/tortue-adulte-perso-512.b600008fda.webp', '/compagnons/tortue-adulte-perso-256.4f5603e6a6.webp'],
  },
  'cp:tortue-ile': {
    disque: ['/compagnons/tortue-ile-disque-512.b8c7889314.webp', '/compagnons/tortue-ile-disque-256.181376fe54.webp'],
    perso: ['/compagnons/tortue-ile-perso-512.33b2dd6942.webp', '/compagnons/tortue-ile-perso-256.718d312b9f.webp'],
    vivant: {
      brume: ['/compagnons/tortue-ile-vivant-brume-512.36c0026f6d.webp', '/compagnons/tortue-ile-vivant-brume-256.efa2a254c4.webp'],
      oiseaux: ['/compagnons/tortue-ile-vivant-oiseaux-512.2f594abf90.webp', '/compagnons/tortue-ile-vivant-oiseaux-256.3b20a56fb7.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Compagnon, compagnons: DESSINS })
