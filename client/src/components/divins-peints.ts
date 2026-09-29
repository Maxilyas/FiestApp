// Les cinq Divins, peints : leurs fichiers, dans `client/public/medaillons`.
//
// Écrit par `server/scripts/anime/legendaires.ts --livrer` : on ne le retouche
// pas à la main, on relance la chaîne. Chaque fichier est nommé par son
// empreinte : un médaillon repeint change d'adresse, et aucun téléphone ne
// garde l'ancien. Deux tailles, `[grande, petite]` : 512 et 256 pixels pour
// le côté du bijou.

/** Le bijou de chaque Divin, détouré, sur tout le carré. */
export const BADGES: Record<string, [string, string]> = {
  'dv:helios': ['/medaillons/helios-badge-512.a87e348896.webp', '/medaillons/helios-badge-256.5e47419a4a.webp'],
  'dv:seraphin': ['/medaillons/seraphin-badge-512.31ec9eaab6.webp', '/medaillons/seraphin-badge-256.23fdeea5bd.webp'],
  'dv:lotus': ['/medaillons/lotus-badge-512.8053817c5e.webp', '/medaillons/lotus-badge-256.3dfaf3f75c.webp'],
  'dv:arbre': ['/medaillons/arbre-badge-512.14866b86d0.webp', '/medaillons/arbre-badge-256.c9e89ac66b.webp'],
  'dv:dechu': ['/medaillons/dechu-badge-512.9afe2c80ce.webp', '/medaillons/dechu-badge-256.5de7f44830.webp'],
}
