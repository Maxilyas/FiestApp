// Les compagnons peints : les fichiers de chaque forme — ses humeurs, que la
// niche échange en place à la révélation —, le monde vivant de leur forme
// ultime, et leur métamorphose de lumière, que l'Éclat ouvre : une forme de
// plus.
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
    humeurs: {
      ravi: ['/compagnons/loup-louveteau-ravi-512.4d63e62d26.webp', '/compagnons/loup-louveteau-ravi-256.6ea4dd2137.webp'],
      depite: ['/compagnons/loup-louveteau-depite-512.234918b39c.webp', '/compagnons/loup-louveteau-depite-256.2499370afd.webp'],
      triomphe: ['/compagnons/loup-louveteau-triomphe-512.7ee7b629ac.webp', '/compagnons/loup-louveteau-triomphe-256.0430a58873.webp'],
    },
  },
  'cp:loup-jeune': {
    disque: ['/compagnons/loup-jeune-disque-512.4f3483d374.webp', '/compagnons/loup-jeune-disque-256.d16245aa72.webp'],
    perso: ['/compagnons/loup-jeune-perso-512.8b9450ee34.webp', '/compagnons/loup-jeune-perso-256.abf42c9290.webp'],
    humeurs: {
      ravi: ['/compagnons/loup-jeune-ravi-512.39d071c2c0.webp', '/compagnons/loup-jeune-ravi-256.5860d73fd3.webp'],
      depite: ['/compagnons/loup-jeune-depite-512.dec6e577ab.webp', '/compagnons/loup-jeune-depite-256.68d28f5ab3.webp'],
      triomphe: ['/compagnons/loup-jeune-triomphe-512.b199c17935.webp', '/compagnons/loup-jeune-triomphe-256.dc81952109.webp'],
    },
  },
  'cp:loup-adulte': {
    disque: ['/compagnons/loup-adulte-disque-512.5f5c41d34f.webp', '/compagnons/loup-adulte-disque-256.b5f2f212d4.webp'],
    perso: ['/compagnons/loup-adulte-perso-512.99655a3d29.webp', '/compagnons/loup-adulte-perso-256.10abd4a8fd.webp'],
    humeurs: {
      ravi: ['/compagnons/loup-adulte-ravi-512.3c3aaa5655.webp', '/compagnons/loup-adulte-ravi-256.3fcce7db40.webp'],
      depite: ['/compagnons/loup-adulte-depite-512.9c264e23da.webp', '/compagnons/loup-adulte-depite-256.cec5b53b00.webp'],
      triomphe: ['/compagnons/loup-adulte-triomphe-512.2033ce56a9.webp', '/compagnons/loup-adulte-triomphe-256.72bb2e6237.webp'],
    },
  },
  'cp:loup-ultime': {
    disque: ['/compagnons/loup-ultime-disque-512.0d1ffab4ca.webp', '/compagnons/loup-ultime-disque-256.a28641f316.webp'],
    perso: ['/compagnons/loup-ultime-perso-512.d40242a86f.webp', '/compagnons/loup-ultime-perso-256.610728a646.webp'],
    humeurs: {
      ravi: ['/compagnons/loup-ultime-ravi-512.f8ff0ba2dc.webp', '/compagnons/loup-ultime-ravi-256.8100297051.webp'],
      depite: ['/compagnons/loup-ultime-depite-512.0fa215351b.webp', '/compagnons/loup-ultime-depite-256.42b44e7ac4.webp'],
      triomphe: ['/compagnons/loup-ultime-triomphe-512.b3bb66b752.webp', '/compagnons/loup-ultime-triomphe-256.0910a2f8ef.webp'],
    },
    vivant: {
      rubans: ['/compagnons/loup-ultime-vivant-rubans-512.ef4fdaa542.webp', '/compagnons/loup-ultime-vivant-rubans-256.f7beac4ff2.webp'],
    },
  },
  'cp:loup-tempete': {
    disque: ['/compagnons/loup-eclat-tempete-disque-512.fa1bb6ac7d.webp', '/compagnons/loup-eclat-tempete-disque-256.31cb1d0bb9.webp'],
    perso: ['/compagnons/loup-eclat-tempete-perso-512.ea6d90d657.webp', '/compagnons/loup-eclat-tempete-perso-256.5c3a9d3bfa.webp'],
    humeurs: {
      ravi: ['/compagnons/loup-eclat-tempete-ravi-512.53256141ac.webp', '/compagnons/loup-eclat-tempete-ravi-256.fe3d144cce.webp'],
      depite: ['/compagnons/loup-eclat-tempete-depite-512.d2dfdd7bd1.webp', '/compagnons/loup-eclat-tempete-depite-256.3d24d28d97.webp'],
      triomphe: ['/compagnons/loup-eclat-tempete-triomphe-512.4b36c82a90.webp', '/compagnons/loup-eclat-tempete-triomphe-256.f8e97888da.webp'],
    },
  },
  'cp:chat-chaton': {
    perso: ['/compagnons/chat-chaton-perso-512.87e13a2b28.webp', '/compagnons/chat-chaton-perso-256.9a1e4eae94.webp'],
    humeurs: {
      ravi: ['/compagnons/chat-chaton-ravi-512.3c22951e8b.webp', '/compagnons/chat-chaton-ravi-256.0290251640.webp'],
      depite: ['/compagnons/chat-chaton-depite-512.428e03daac.webp', '/compagnons/chat-chaton-depite-256.db8d06bf40.webp'],
      triomphe: ['/compagnons/chat-chaton-triomphe-512.288691295b.webp', '/compagnons/chat-chaton-triomphe-256.b62641d498.webp'],
    },
  },
  'cp:chat-jeune': {
    disque: ['/compagnons/chat-jeune-disque-512.b7e37eb905.webp', '/compagnons/chat-jeune-disque-256.91d0525b0d.webp'],
    perso: ['/compagnons/chat-jeune-perso-512.6adb68472b.webp', '/compagnons/chat-jeune-perso-256.ded493939b.webp'],
    humeurs: {
      ravi: ['/compagnons/chat-jeune-ravi-512.23b46cf84e.webp', '/compagnons/chat-jeune-ravi-256.eec0c99aa1.webp'],
      depite: ['/compagnons/chat-jeune-depite-512.cdc969e19e.webp', '/compagnons/chat-jeune-depite-256.67b663d487.webp'],
      triomphe: ['/compagnons/chat-jeune-triomphe-512.ff4cd1503f.webp', '/compagnons/chat-jeune-triomphe-256.20106f170a.webp'],
    },
  },
  'cp:chat-adulte': {
    disque: ['/compagnons/chat-adulte-disque-512.b3976cb4b8.webp', '/compagnons/chat-adulte-disque-256.11cc7bb551.webp'],
    perso: ['/compagnons/chat-adulte-perso-512.3b650b6bbb.webp', '/compagnons/chat-adulte-perso-256.6dd20c1a1e.webp'],
    humeurs: {
      ravi: ['/compagnons/chat-adulte-ravi-512.4e84a5ee6c.webp', '/compagnons/chat-adulte-ravi-256.0d3588c08c.webp'],
      depite: ['/compagnons/chat-adulte-depite-512.5caab5dd1b.webp', '/compagnons/chat-adulte-depite-256.6fd98bb77a.webp'],
      triomphe: ['/compagnons/chat-adulte-triomphe-512.53519f6da6.webp', '/compagnons/chat-adulte-triomphe-256.b9b84bd74a.webp'],
    },
  },
  'cp:chat-esprit': {
    disque: ['/compagnons/chat-esprit-disque-512.cfdf86bff6.webp', '/compagnons/chat-esprit-disque-256.bfebf160dd.webp'],
    perso: ['/compagnons/chat-esprit-perso-512.8e20b00408.webp', '/compagnons/chat-esprit-perso-256.3620435a2d.webp'],
    humeurs: {
      ravi: ['/compagnons/chat-esprit-ravi-512.f56ecc209f.webp', '/compagnons/chat-esprit-ravi-256.9ebbff3783.webp'],
      depite: ['/compagnons/chat-esprit-depite-512.744a9d69d4.webp', '/compagnons/chat-esprit-depite-256.fc4abc6485.webp'],
      triomphe: ['/compagnons/chat-esprit-triomphe-512.3ea4903728.webp', '/compagnons/chat-esprit-triomphe-256.8709bf1304.webp'],
    },
    vivant: {
      feux: ['/compagnons/chat-esprit-vivant-feux-512.0282eca064.webp', '/compagnons/chat-esprit-vivant-feux-256.37d251a356.webp'],
      lanternes: ['/compagnons/chat-esprit-vivant-lanternes-512.06e7fdf59f.webp', '/compagnons/chat-esprit-vivant-lanternes-256.7b842a2d40.webp'],
    },
  },
  'cp:chat-soleil': {
    disque: ['/compagnons/chat-eclat-soleil-disque-512.2855b4da7c.webp', '/compagnons/chat-eclat-soleil-disque-256.a04db3982c.webp'],
    perso: ['/compagnons/chat-eclat-soleil-perso-512.4429f7993a.webp', '/compagnons/chat-eclat-soleil-perso-256.df0c206e38.webp'],
    humeurs: {
      ravi: ['/compagnons/chat-eclat-soleil-ravi-512.14d0086454.webp', '/compagnons/chat-eclat-soleil-ravi-256.e4d2fd4175.webp'],
      depite: ['/compagnons/chat-eclat-soleil-depite-512.7de2bd4bb9.webp', '/compagnons/chat-eclat-soleil-depite-256.e3599a6f07.webp'],
      triomphe: ['/compagnons/chat-eclat-soleil-triomphe-512.7b8ea1b251.webp', '/compagnons/chat-eclat-soleil-triomphe-256.5cbcefcc81.webp'],
    },
  },
  'cp:tortue-bebe': {
    perso: ['/compagnons/tortue-bebe-perso-512.f7457465d2.webp', '/compagnons/tortue-bebe-perso-256.15f75b1d81.webp'],
    humeurs: {
      ravi: ['/compagnons/tortue-bebe-ravi-512.e56d9e68c4.webp', '/compagnons/tortue-bebe-ravi-256.6eddbeee36.webp'],
      depite: ['/compagnons/tortue-bebe-depite-512.5e3ad9912a.webp', '/compagnons/tortue-bebe-depite-256.9e32242d98.webp'],
      triomphe: ['/compagnons/tortue-bebe-triomphe-512.e74ef0aabf.webp', '/compagnons/tortue-bebe-triomphe-256.f6dd469432.webp'],
    },
  },
  'cp:tortue-jeune': {
    disque: ['/compagnons/tortue-jeune-disque-512.0128330159.webp', '/compagnons/tortue-jeune-disque-256.afa13da3ae.webp'],
    perso: ['/compagnons/tortue-jeune-perso-512.253923516e.webp', '/compagnons/tortue-jeune-perso-256.0c649250bf.webp'],
    humeurs: {
      ravi: ['/compagnons/tortue-jeune-ravi-512.1b681502ba.webp', '/compagnons/tortue-jeune-ravi-256.d177438b3e.webp'],
      depite: ['/compagnons/tortue-jeune-depite-512.e893b40033.webp', '/compagnons/tortue-jeune-depite-256.46bab54e39.webp'],
      triomphe: ['/compagnons/tortue-jeune-triomphe-512.fd3d5c4e7d.webp', '/compagnons/tortue-jeune-triomphe-256.1408b32d5b.webp'],
    },
  },
  'cp:tortue-adulte': {
    disque: ['/compagnons/tortue-adulte-disque-512.f56425ec50.webp', '/compagnons/tortue-adulte-disque-256.01b0b65f3e.webp'],
    perso: ['/compagnons/tortue-adulte-perso-512.b600008fda.webp', '/compagnons/tortue-adulte-perso-256.4f5603e6a6.webp'],
    humeurs: {
      ravi: ['/compagnons/tortue-adulte-ravi-512.fe147396c7.webp', '/compagnons/tortue-adulte-ravi-256.5ef25ca00d.webp'],
      depite: ['/compagnons/tortue-adulte-depite-512.88091ad266.webp', '/compagnons/tortue-adulte-depite-256.b1a3aae242.webp'],
      triomphe: ['/compagnons/tortue-adulte-triomphe-512.eaeeb45b52.webp', '/compagnons/tortue-adulte-triomphe-256.721300146b.webp'],
    },
  },
  'cp:tortue-ile': {
    disque: ['/compagnons/tortue-ile-disque-512.b8c7889314.webp', '/compagnons/tortue-ile-disque-256.181376fe54.webp'],
    perso: ['/compagnons/tortue-ile-perso-512.33b2dd6942.webp', '/compagnons/tortue-ile-perso-256.718d312b9f.webp'],
    humeurs: {
      ravi: ['/compagnons/tortue-ile-ravi-512.1611a2097a.webp', '/compagnons/tortue-ile-ravi-256.b5bfbc658b.webp'],
      depite: ['/compagnons/tortue-ile-depite-512.943c0d02c4.webp', '/compagnons/tortue-ile-depite-256.5c31c807d4.webp'],
      triomphe: ['/compagnons/tortue-ile-triomphe-512.d2d2fe1f56.webp', '/compagnons/tortue-ile-triomphe-256.0a7733387a.webp'],
    },
    vivant: {
      brume: ['/compagnons/tortue-ile-vivant-brume-512.36c0026f6d.webp', '/compagnons/tortue-ile-vivant-brume-256.efa2a254c4.webp'],
      oiseaux: ['/compagnons/tortue-ile-vivant-oiseaux-512.2f594abf90.webp', '/compagnons/tortue-ile-vivant-oiseaux-256.3b20a56fb7.webp'],
    },
  },
  'cp:tortue-fleurs': {
    disque: ['/compagnons/tortue-eclat-fleurs-disque-512.df9283f0f6.webp', '/compagnons/tortue-eclat-fleurs-disque-256.79e6e5af21.webp'],
    perso: ['/compagnons/tortue-eclat-fleurs-perso-512.e442a39d9e.webp', '/compagnons/tortue-eclat-fleurs-perso-256.beea4b6d4f.webp'],
    humeurs: {
      ravi: ['/compagnons/tortue-eclat-fleurs-ravi-512.6ba3575dc8.webp', '/compagnons/tortue-eclat-fleurs-ravi-256.566b1cda58.webp'],
      depite: ['/compagnons/tortue-eclat-fleurs-depite-512.2dd068feb4.webp', '/compagnons/tortue-eclat-fleurs-depite-256.d8359c20fc.webp'],
      triomphe: ['/compagnons/tortue-eclat-fleurs-triomphe-512.e8ee23bcbc.webp', '/compagnons/tortue-eclat-fleurs-triomphe-256.94207d061f.webp'],
    },
  },
  'cp:luciole-ver': {
    perso: ['/compagnons/luciole-ver-perso-512.a4b9d40260.webp', '/compagnons/luciole-ver-perso-256.ff6a0533fc.webp'],
    humeurs: {
      ravi: ['/compagnons/luciole-ver-ravi-512.5aaeb61c2c.webp', '/compagnons/luciole-ver-ravi-256.2ef053343c.webp'],
      depite: ['/compagnons/luciole-ver-depite-512.9e5d5d062f.webp', '/compagnons/luciole-ver-depite-256.c0b1a60aca.webp'],
      triomphe: ['/compagnons/luciole-ver-triomphe-512.bcd601085f.webp', '/compagnons/luciole-ver-triomphe-256.50413c4e33.webp'],
    },
  },
  'cp:luciole-jeune': {
    disque: ['/compagnons/luciole-jeune-disque-512.8e8c95a620.webp', '/compagnons/luciole-jeune-disque-256.a522f02370.webp'],
    perso: ['/compagnons/luciole-jeune-perso-512.57b52d6147.webp', '/compagnons/luciole-jeune-perso-256.8b78361cad.webp'],
    humeurs: {
      ravi: ['/compagnons/luciole-jeune-ravi-512.15db7ce90a.webp', '/compagnons/luciole-jeune-ravi-256.cfd4876f5d.webp'],
      depite: ['/compagnons/luciole-jeune-depite-512.f3f3648d5b.webp', '/compagnons/luciole-jeune-depite-256.1703065855.webp'],
      triomphe: ['/compagnons/luciole-jeune-triomphe-512.79133a54dd.webp', '/compagnons/luciole-jeune-triomphe-256.8003ff0679.webp'],
    },
  },
  'cp:luciole-adulte': {
    disque: ['/compagnons/luciole-adulte-disque-512.a92a966b06.webp', '/compagnons/luciole-adulte-disque-256.47272a5157.webp'],
    perso: ['/compagnons/luciole-adulte-perso-512.e5127129d8.webp', '/compagnons/luciole-adulte-perso-256.7be24ca457.webp'],
    humeurs: {
      ravi: ['/compagnons/luciole-adulte-ravi-512.4161f11092.webp', '/compagnons/luciole-adulte-ravi-256.b7c6e8b56b.webp'],
      depite: ['/compagnons/luciole-adulte-depite-512.2c6d7cc3c9.webp', '/compagnons/luciole-adulte-depite-256.4e3c905825.webp'],
      triomphe: ['/compagnons/luciole-adulte-triomphe-512.bae43399ec.webp', '/compagnons/luciole-adulte-triomphe-256.2f39993e10.webp'],
    },
  },
  'cp:luciole-constellation': {
    disque: ['/compagnons/luciole-constellation-disque-512.5de93a1eb8.webp', '/compagnons/luciole-constellation-disque-256.eb550ad55a.webp'],
    perso: ['/compagnons/luciole-constellation-perso-512.7f0f972adc.webp', '/compagnons/luciole-constellation-perso-256.a684dbff5b.webp'],
    humeurs: {
      ravi: ['/compagnons/luciole-constellation-ravi-512.45457017a0.webp', '/compagnons/luciole-constellation-ravi-256.8aba8e9d69.webp'],
      depite: ['/compagnons/luciole-constellation-depite-512.2b8c1525a6.webp', '/compagnons/luciole-constellation-depite-256.c18ae38bb5.webp'],
      triomphe: ['/compagnons/luciole-constellation-triomphe-512.4d3fa17565.webp', '/compagnons/luciole-constellation-triomphe-256.688ae63366.webp'],
    },
    vivant: {
      lucioles: ['/compagnons/luciole-constellation-vivant-lucioles-512.7d7c1ec9b9.webp', '/compagnons/luciole-constellation-vivant-lucioles-256.942a9acee8.webp'],
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Compagnon, compagnons: DESSINS })
