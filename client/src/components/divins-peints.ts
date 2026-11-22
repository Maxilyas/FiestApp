// Les dix-huit Divins, peints : leurs fichiers, dans `client/public/medaillons`.
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
  'dv:chronos': ['/medaillons/chronos-badge-512.6eacc6e35f.webp', '/medaillons/chronos-badge-256.619ef457b5.webp'],
  'dv:athena': ['/medaillons/athena-badge-512.663b8591ca.webp', '/medaillons/athena-badge-256.1e95842c1f.webp'],
  'dv:thot': ['/medaillons/thot-badge-512.3cd3e1a612.webp', '/medaillons/thot-badge-256.6630c5d97e.webp'],
  'dv:demiurge': ['/medaillons/demiurge-badge-512.6089dfa42d.webp', '/medaillons/demiurge-badge-256.7053814191.webp'],
  'dv:ariane': ['/medaillons/ariane-badge-512.a497509793.webp', '/medaillons/ariane-badge-256.da3abf00c3.webp'],
  'dv:mnemosyne': ['/medaillons/mnemosyne-badge-512.b935c2e651.webp', '/medaillons/mnemosyne-badge-256.62ceff4849.webp'],
  'dv:heracles': ['/medaillons/heracles-badge-512.1db97bde6c.webp', '/medaillons/heracles-badge-256.c17600064c.webp'],
  'dv:sisyphe': ['/medaillons/sisyphe-badge-512.0fce7c1842.webp', '/medaillons/sisyphe-badge-256.d4690488c0.webp'],
  'dv:nike': ['/medaillons/nike-badge-512.ad74565b7e.webp', '/medaillons/nike-badge-256.e0e92a8040.webp'],
  'dv:osiris': ['/medaillons/osiris-badge-512.b76b11790d.webp', '/medaillons/osiris-badge-256.ba6dadaf99.webp'],
  'dv:hecate': ['/medaillons/hecate-badge-512.4c8ed7b525.webp', '/medaillons/hecate-badge-256.b04364eab7.webp'],
  'dv:artemis': ['/medaillons/artemis-badge-512.25c5f323ae.webp', '/medaillons/artemis-badge-256.0e62092381.webp'],
  'dv:pantheon': ['/medaillons/pantheon-badge-512.aaae25cc02.webp', '/medaillons/pantheon-badge-256.151975879c.webp'],
}
