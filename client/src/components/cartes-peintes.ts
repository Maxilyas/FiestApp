// Les cartes peintes de l'Expédition : l'illustration de chaque carte sans
// légendaire (`shared/rencontres.ts`) ; celle d’un légendaire est son
// médaillon. Leurs fichiers vivent dans `client/public/cartes`.
//
// Écrit par `server/scripts/anime/cartes.ts --livrer` : on ne le retouche
// pas à la main, on relance la chaîne. Chaque fichier est nommé par son
// empreinte : une carte repeinte change d'adresse. Deux tailles,
// `[grande, petite]` : 480 × 360 pour la carte levée, 240 × 180 ailleurs.

export const CARTES_PEINTES: Readonly<Record<string, readonly [string, string]>> = {
  'concentration': ['/cartes/concentration-480.c8487ef3dd.webp', '/cartes/concentration-240.623615a701.webp'],
  'prudence': ['/cartes/prudence-480.e5cbb197d8.webp', '/cartes/prudence-240.21d6534c69.webp'],
  'coup-d-oeil': ['/cartes/coup-d-oeil-480.b026e5a2f9.webp', '/cartes/coup-d-oeil-240.eeb70f6949.webp'],
  'echange': ['/cartes/echange-480.9f23cafe27.webp', '/cartes/echange-240.ae08607f81.webp'],
  'pioche': ['/cartes/pioche-480.e8fa1a0781.webp', '/cartes/pioche-240.dfc2dec97d.webp'],
  'arret-sur-image': ['/cartes/arret-sur-image-480.77eb946a73.webp', '/cartes/arret-sur-image-240.121c9bd7f5.webp'],
  'detour': ['/cartes/detour-480.6d6d524f74.webp', '/cartes/detour-240.b887e50987.webp'],
  'double-chance': ['/cartes/double-chance-480.11156140c0.webp', '/cartes/double-chance-240.9e775462d8.webp'],
  'sursis': ['/cartes/sursis-480.3b14776591.webp', '/cartes/sursis-240.311a50950b.webp'],
  'tout-ou-rien': ['/cartes/tout-ou-rien-480.d05efe30f9.webp', '/cartes/tout-ou-rien-240.c8eb13bf07.webp'],
  'quitte-ou-double': ['/cartes/quitte-ou-double-480.d8768be78c.webp', '/cartes/quitte-ou-double-240.1aa11a4270.webp'],
  'plume': ['/cartes/plume-480.7c106b83cc.webp', '/cartes/plume-240.6e32ec3d8a.webp'],
  'bibliotheque': ['/cartes/bibliotheque-480.a1db51e580.webp', '/cartes/bibliotheque-240.85e8ccb253.webp'],
  'doubler-la-mise': ['/cartes/doubler-la-mise-480.41c13bb63a.webp', '/cartes/doubler-la-mise-240.a5ba98c720.webp'],
  'banco': ['/cartes/banco-480.48cd5f725e.webp', '/cartes/banco-240.9adf48b27a.webp'],
  'corser': ['/cartes/corser-480.af6916118b.webp', '/cartes/corser-240.01c9eae5b2.webp'],
  'simplifier': ['/cartes/simplifier-480.6d9161e578.webp', '/cartes/simplifier-240.ecbf11521e.webp'],
  'echauffement': ['/cartes/echauffement-480.4fbef83f5f.webp', '/cartes/echauffement-240.8bc48698d0.webp'],
  'lancee': ['/cartes/lancee-480.e51ccccaa4.webp', '/cartes/lancee-240.ff226bff97.webp'],
  'parade': ['/cartes/parade-480.da3db066dc.webp', '/cartes/parade-240.ca2f022902.webp'],
  'contre-attaque': ['/cartes/contre-attaque-480.f581cc7b3b.webp', '/cartes/contre-attaque-240.30eef47235.webp'],
  'lucidite': ['/cartes/lucidite-480.8747a5dd4f.webp', '/cartes/lucidite-240.a176490121.webp'],
  'troisieme-oeil': ['/cartes/troisieme-oeil-480.8f7fb3723f.webp', '/cartes/troisieme-oeil-240.a3366717dc.webp'],
}
