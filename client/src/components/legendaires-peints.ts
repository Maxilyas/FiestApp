// Les vingt-six légendaires, peints : leurs fichiers, dans `client/public/medaillons`.
//
// Écrit par `server/scripts/anime/legendaires.ts --livrer` : on ne le retouche
// pas à la main, on relance la chaîne. Chaque fichier est nommé par son
// empreinte : un médaillon repeint change d'adresse, et aucun téléphone ne
// garde l'ancien. Deux tailles, `[grande, petite]` : 512 et 256 pixels pour
// le disque (le médaillon en fait 90 % du côté).

export interface ImagesDeLegendaire {
  /** L'illustration, sur le carré du disque. */
  art: [string, string]
  /** Sa version rare, éclatée : la même pose, ses couleurs rares. */
  rare: [string, string]
  /** La créature seule, détourée : sa forme fait la silhouette d'un légendaire à gagner. */
  perso: string
  /** La créature rare, dans un cadre plus large (−20 → 120 du disque) : ce qui sort du cadre d'un éclaté. */
  rarePerso: [string, string]
}

export const IMAGES: Record<string, ImagesDeLegendaire> = {
  'lg:phenix': {
    art: ['/medaillons/phenix-art-512.18630863d2.webp', '/medaillons/phenix-art-256.257aabb53a.webp'],
    rare: ['/medaillons/phenix-rare-512.fc5ec899ba.webp', '/medaillons/phenix-rare-256.7c9c523705.webp'],
    perso: '/medaillons/phenix-perso-256.4fa8d59862.webp',
    rarePerso: ['/medaillons/phenix-rare-perso-512.73df41a272.webp', '/medaillons/phenix-rare-perso-256.8d58dd186f.webp'],
  },
  'lg:dragon': {
    art: ['/medaillons/dragon-art-512.6da8eda0c3.webp', '/medaillons/dragon-art-256.9cd66655bb.webp'],
    rare: ['/medaillons/dragon-rare-512.3e14457768.webp', '/medaillons/dragon-rare-256.614dbc5f41.webp'],
    perso: '/medaillons/dragon-perso-256.b30b523163.webp',
    rarePerso: ['/medaillons/dragon-rare-perso-512.b0a9259e8e.webp', '/medaillons/dragon-rare-perso-256.a4e17dac96.webp'],
  },
  'lg:oracle': {
    art: ['/medaillons/oracle-art-512.d5e831f0aa.webp', '/medaillons/oracle-art-256.1d77b00318.webp'],
    rare: ['/medaillons/oracle-rare-512.99f40b7601.webp', '/medaillons/oracle-rare-256.4e3c9a4574.webp'],
    perso: '/medaillons/oracle-perso-256.48550049cc.webp',
    rarePerso: ['/medaillons/oracle-rare-perso-512.9452fe1763.webp', '/medaillons/oracle-rare-perso-256.00e74b52a0.webp'],
  },
  'lg:chouette': {
    art: ['/medaillons/chouette-art-512.3aff95d402.webp', '/medaillons/chouette-art-256.8f82d5901a.webp'],
    rare: ['/medaillons/chouette-rare-512.f835b54ce3.webp', '/medaillons/chouette-rare-256.eeff261cab.webp'],
    perso: '/medaillons/chouette-perso-256.546491cc14.webp',
    rarePerso: ['/medaillons/chouette-rare-perso-512.d9689c548a.webp', '/medaillons/chouette-rare-perso-256.2f6e3cc092.webp'],
  },
  'lg:tigre': {
    art: ['/medaillons/tigre-art-512.a5058d66db.webp', '/medaillons/tigre-art-256.f901482740.webp'],
    rare: ['/medaillons/tigre-rare-512.bec80beb85.webp', '/medaillons/tigre-rare-256.1a4f050e9c.webp'],
    perso: '/medaillons/tigre-perso-256.92dfbe0341.webp',
    rarePerso: ['/medaillons/tigre-rare-perso-512.3cfddab0a8.webp', '/medaillons/tigre-rare-perso-256.6a2da616bc.webp'],
  },
  'lg:licorne': {
    art: ['/medaillons/licorne-art-512.b2ea7e3322.webp', '/medaillons/licorne-art-256.3c14a22f17.webp'],
    rare: ['/medaillons/licorne-rare-512.1def09df07.webp', '/medaillons/licorne-rare-256.a3bc7119cd.webp'],
    perso: '/medaillons/licorne-perso-256.4a340a68dc.webp',
    rarePerso: ['/medaillons/licorne-rare-perso-512.9c3259c5b1.webp', '/medaillons/licorne-rare-perso-256.212a514e50.webp'],
  },
  'lg:lion': {
    art: ['/medaillons/lion-art-512.f1e7460ab4.webp', '/medaillons/lion-art-256.45c3d13d4d.webp'],
    rare: ['/medaillons/lion-rare-512.f1212cb3f2.webp', '/medaillons/lion-rare-256.89eebc4ee9.webp'],
    perso: '/medaillons/lion-perso-256.8f874f8e61.webp',
    rarePerso: ['/medaillons/lion-rare-perso-512.e486988eed.webp', '/medaillons/lion-rare-perso-256.3da642414c.webp'],
  },
  'lg:renard': {
    art: ['/medaillons/renard-art-512.11cd028c4e.webp', '/medaillons/renard-art-256.b6fafdb43c.webp'],
    rare: ['/medaillons/renard-rare-512.e7a3d959e6.webp', '/medaillons/renard-rare-256.9a58c28d29.webp'],
    perso: '/medaillons/renard-perso-256.f308af6644.webp',
    rarePerso: ['/medaillons/renard-rare-perso-512.f6bed49fcb.webp', '/medaillons/renard-rare-perso-256.9ef16c87cc.webp'],
  },
  'lg:comete': {
    art: ['/medaillons/comete-art-512.015fc05b7e.webp', '/medaillons/comete-art-256.985a35a4a8.webp'],
    rare: ['/medaillons/comete-rare-512.4d30a89ce1.webp', '/medaillons/comete-rare-256.d1adea2e8e.webp'],
    perso: '/medaillons/comete-perso-256.ff08529fc8.webp',
    rarePerso: ['/medaillons/comete-rare-perso-512.be97f4a82f.webp', '/medaillons/comete-rare-perso-256.6abbc99465.webp'],
  },
  'lg:kraken': {
    art: ['/medaillons/kraken-art-512.b49c3e29a3.webp', '/medaillons/kraken-art-256.309e2e7da4.webp'],
    rare: ['/medaillons/kraken-rare-512.7336b33f55.webp', '/medaillons/kraken-rare-256.62a576e2b5.webp'],
    perso: '/medaillons/kraken-perso-256.d2458796cb.webp',
    rarePerso: ['/medaillons/kraken-rare-perso-512.0d89f7a51c.webp', '/medaillons/kraken-rare-perso-256.f56858bc34.webp'],
  },
  'lg:fantome': {
    art: ['/medaillons/fantome-art-512.b74c26c014.webp', '/medaillons/fantome-art-256.2d20bb51f5.webp'],
    rare: ['/medaillons/fantome-rare-512.9c13bc2c30.webp', '/medaillons/fantome-rare-256.441f04ee90.webp'],
    perso: '/medaillons/fantome-perso-256.cfa08958f6.webp',
    rarePerso: ['/medaillons/fantome-rare-perso-512.2ce3bd2e86.webp', '/medaillons/fantome-rare-perso-256.ba4294339f.webp'],
  },
  'lg:trou-noir': {
    art: ['/medaillons/trou-noir-art-512.234ca4cf48.webp', '/medaillons/trou-noir-art-256.b41d3e33c4.webp'],
    rare: ['/medaillons/trou-noir-rare-512.75c9c73233.webp', '/medaillons/trou-noir-rare-256.06a777ad9a.webp'],
    perso: '/medaillons/trou-noir-perso-256.d9759e1a3d.webp',
    rarePerso: ['/medaillons/trou-noir-rare-perso-512.085d643fb0.webp', '/medaillons/trou-noir-rare-perso-256.7d61afd459.webp'],
  },
  'lg:sphinx': {
    art: ['/medaillons/sphinx-art-512.a4edf24c1b.webp', '/medaillons/sphinx-art-256.d99e90441c.webp'],
    rare: ['/medaillons/sphinx-rare-512.e6372b5059.webp', '/medaillons/sphinx-rare-256.111e19899c.webp'],
    perso: '/medaillons/sphinx-perso-256.55696cae31.webp',
    rarePerso: ['/medaillons/sphinx-rare-perso-512.15085cf30f.webp', '/medaillons/sphinx-rare-perso-256.edfa44ceb1.webp'],
  },
  'lg:citrouille': {
    art: ['/medaillons/citrouille-art-512.7be6345193.webp', '/medaillons/citrouille-art-256.592b377918.webp'],
    rare: ['/medaillons/citrouille-rare-512.0711e59ee5.webp', '/medaillons/citrouille-rare-256.b04e6e2df0.webp'],
    perso: '/medaillons/citrouille-perso-256.e4932cb859.webp',
    rarePerso: ['/medaillons/citrouille-rare-perso-512.4cbeaf9791.webp', '/medaillons/citrouille-rare-perso-256.962fa6c055.webp'],
  },
  'lg:sapin': {
    art: ['/medaillons/sapin-art-512.091e8561f9.webp', '/medaillons/sapin-art-256.49c7c9c033.webp'],
    rare: ['/medaillons/sapin-rare-512.256dd1cb7e.webp', '/medaillons/sapin-rare-256.13c46d9b97.webp'],
    perso: '/medaillons/sapin-perso-256.07d7fc9f6a.webp',
    rarePerso: ['/medaillons/sapin-rare-perso-512.881d1c336b.webp', '/medaillons/sapin-rare-perso-256.cb6f9f8135.webp'],
  },
  'lg:bouquet': {
    art: ['/medaillons/bouquet-art-512.8ec0269025.webp', '/medaillons/bouquet-art-256.d2dc738ce0.webp'],
    rare: ['/medaillons/bouquet-rare-512.d62c59d7e6.webp', '/medaillons/bouquet-rare-256.f17f70c00f.webp'],
    perso: '/medaillons/bouquet-perso-256.3c96f2c985.webp',
    rarePerso: ['/medaillons/bouquet-rare-perso-512.d2362df665.webp', '/medaillons/bouquet-rare-perso-256.9f2bb27c25.webp'],
  },
  'lg:aigle': {
    art: ['/medaillons/aigle-art-512.f6b481108b.webp', '/medaillons/aigle-art-256.97c138bb70.webp'],
    rare: ['/medaillons/aigle-rare-512.f2ce0e762f.webp', '/medaillons/aigle-rare-256.14d377346e.webp'],
    perso: '/medaillons/aigle-perso-256.c8c02ed69f.webp',
    rarePerso: ['/medaillons/aigle-rare-perso-512.f43a58e941.webp', '/medaillons/aigle-rare-perso-256.9213fa9e06.webp'],
  },
  'lg:ouroboros': {
    art: ['/medaillons/ouroboros-art-512.4feeed8462.webp', '/medaillons/ouroboros-art-256.4314e255f9.webp'],
    rare: ['/medaillons/ouroboros-rare-512.f9fea04f56.webp', '/medaillons/ouroboros-rare-256.771f0050c2.webp'],
    perso: '/medaillons/ouroboros-perso-256.8d332c5df5.webp',
    rarePerso: ['/medaillons/ouroboros-rare-perso-512.20b8770946.webp', '/medaillons/ouroboros-rare-perso-256.0b25c442d2.webp'],
  },
  'lg:scarabee': {
    art: ['/medaillons/scarabee-art-512.c4daa01feb.webp', '/medaillons/scarabee-art-256.69af1ef161.webp'],
    rare: ['/medaillons/scarabee-rare-512.148a922307.webp', '/medaillons/scarabee-rare-256.5a2ee93594.webp'],
    perso: '/medaillons/scarabee-perso-256.ab2be6e901.webp',
    rarePerso: ['/medaillons/scarabee-rare-perso-512.5bb5d15730.webp', '/medaillons/scarabee-rare-perso-256.3161eb2f59.webp'],
  },
  'lg:coq': {
    art: ['/medaillons/coq-art-512.e865b79748.webp', '/medaillons/coq-art-256.cb489768ad.webp'],
    rare: ['/medaillons/coq-rare-512.8d55613115.webp', '/medaillons/coq-rare-256.40d591dbad.webp'],
    perso: '/medaillons/coq-perso-256.ca1968cab2.webp',
    rarePerso: ['/medaillons/coq-rare-perso-512.27f7d0822a.webp', '/medaillons/coq-rare-perso-256.579fa0b342.webp'],
  },
  'lg:chauve-souris': {
    art: ['/medaillons/chauve-souris-art-512.0d277d19c7.webp', '/medaillons/chauve-souris-art-256.4ac0fd6c25.webp'],
    rare: ['/medaillons/chauve-souris-rare-512.f1aa756fba.webp', '/medaillons/chauve-souris-rare-256.63b020deac.webp'],
    perso: '/medaillons/chauve-souris-perso-256.15410b7e5f.webp',
    rarePerso: ['/medaillons/chauve-souris-rare-perso-512.b9e9a4013b.webp', '/medaillons/chauve-souris-rare-perso-256.a7935e3a41.webp'],
  },
  'lg:salamandre': {
    art: ['/medaillons/salamandre-art-512.b0de778d68.webp', '/medaillons/salamandre-art-256.b647706a87.webp'],
    rare: ['/medaillons/salamandre-rare-512.7c110fb18c.webp', '/medaillons/salamandre-rare-256.d0c2c0a7a4.webp'],
    perso: '/medaillons/salamandre-perso-256.3bb4959f92.webp',
    rarePerso: ['/medaillons/salamandre-rare-perso-512.8053dd434b.webp', '/medaillons/salamandre-rare-perso-256.0189a48502.webp'],
  },
  'lg:elephant': {
    art: ['/medaillons/elephant-art-512.f01fdb59ff.webp', '/medaillons/elephant-art-256.b21b0b3c71.webp'],
    rare: ['/medaillons/elephant-rare-512.4827845427.webp', '/medaillons/elephant-rare-256.68b7073559.webp'],
    perso: '/medaillons/elephant-perso-256.8710ec8112.webp',
    rarePerso: ['/medaillons/elephant-rare-perso-512.1c7d6a8fa2.webp', '/medaillons/elephant-rare-perso-256.4777e067a1.webp'],
  },
  'lg:serpent': {
    art: ['/medaillons/serpent-art-512.17cb1e7b16.webp', '/medaillons/serpent-art-256.e6fc441ec7.webp'],
    rare: ['/medaillons/serpent-rare-512.a515e817b7.webp', '/medaillons/serpent-rare-256.5a29008a3e.webp'],
    perso: '/medaillons/serpent-perso-256.59205bbff7.webp',
    rarePerso: ['/medaillons/serpent-rare-perso-512.dfee47abb9.webp', '/medaillons/serpent-rare-perso-256.468e0650d7.webp'],
  },
  'lg:chimere': {
    art: ['/medaillons/chimere-art-512.aa4a8f67c7.webp', '/medaillons/chimere-art-256.f45a9fedde.webp'],
    rare: ['/medaillons/chimere-rare-512.b0c69d1e95.webp', '/medaillons/chimere-rare-256.59622da526.webp'],
    perso: '/medaillons/chimere-perso-256.9b9a428241.webp',
    rarePerso: ['/medaillons/chimere-rare-perso-512.52447b57d5.webp', '/medaillons/chimere-rare-perso-256.db3a5045b7.webp'],
  },
  'lg:janus': {
    art: ['/medaillons/janus-art-512.a918e51f79.webp', '/medaillons/janus-art-256.017b698b51.webp'],
    rare: ['/medaillons/janus-rare-512.4a2c63cc5d.webp', '/medaillons/janus-rare-256.c07d8ecea7.webp'],
    perso: '/medaillons/janus-perso-256.e1a0dd05bd.webp',
    rarePerso: ['/medaillons/janus-rare-perso-512.b27cadd4ad.webp', '/medaillons/janus-rare-perso-256.03a8536e17.webp'],
  },
}
