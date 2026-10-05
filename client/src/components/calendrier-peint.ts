// Le Calendrier des Heures, peint : douze enluminures, une par mois
// (`shared/calendrier.ts`), et la version dorée de chacune, celle du
// champion du mois. Leurs fichiers vivent dans `client/public/decors`.
//
// Écrit par `server/scripts/anime/decors.ts --livrer` : on ne le retouche
// pas à la main, on relance la chaîne. Chaque fichier est nommé par son
// empreinte : une page repeinte change d'adresse, et aucun téléphone ne
// garde l'ancienne. Deux tailles, `[grande, petite]` : 512 et 256 pixels
// de côté. La clé est le mois sur deux chiffres, comme `PAGES[i].mois` ;
// pour les parcourir dans l'ordre de l'année, partir de `PAGES` : les clés
// '10', '11' et '12' sont des entiers, et `Object.keys` les range devant '01'.

export const PAGES_PEINTES: Record<string, { page: [string, string]; doree: [string, string] }> = {
  '01': {
    page: ['/decors/page-01-512.abe98b6db5.webp', '/decors/page-01-256.01c93082b9.webp'],
    doree: ['/decors/page-01-doree-512.ca8ea8d8d3.webp', '/decors/page-01-doree-256.dec1e72eba.webp'],
  },
  '02': {
    page: ['/decors/page-02-512.5bfd08aaa9.webp', '/decors/page-02-256.efef987b95.webp'],
    doree: ['/decors/page-02-doree-512.f9888caba7.webp', '/decors/page-02-doree-256.d146c9dcb2.webp'],
  },
  '03': {
    page: ['/decors/page-03-512.6c98f01f4f.webp', '/decors/page-03-256.0a10970881.webp'],
    doree: ['/decors/page-03-doree-512.c627f6b1f6.webp', '/decors/page-03-doree-256.d7d68e6415.webp'],
  },
  '04': {
    page: ['/decors/page-04-512.d4121f8dc1.webp', '/decors/page-04-256.be053119ed.webp'],
    doree: ['/decors/page-04-doree-512.7a21ca2b6b.webp', '/decors/page-04-doree-256.522c27a29e.webp'],
  },
  '05': {
    page: ['/decors/page-05-512.7c86266045.webp', '/decors/page-05-256.d5c47e4924.webp'],
    doree: ['/decors/page-05-doree-512.3de84c214d.webp', '/decors/page-05-doree-256.cf6a46e77f.webp'],
  },
  '06': {
    page: ['/decors/page-06-512.77c4676241.webp', '/decors/page-06-256.02f0c11428.webp'],
    doree: ['/decors/page-06-doree-512.bfa4bc5e12.webp', '/decors/page-06-doree-256.39b8798a25.webp'],
  },
  '07': {
    page: ['/decors/page-07-512.51add6af72.webp', '/decors/page-07-256.7ac9b0508a.webp'],
    doree: ['/decors/page-07-doree-512.f7e918a979.webp', '/decors/page-07-doree-256.4b552e67f6.webp'],
  },
  '08': {
    page: ['/decors/page-08-512.48a4d82679.webp', '/decors/page-08-256.52a17fa662.webp'],
    doree: ['/decors/page-08-doree-512.7cb70fc441.webp', '/decors/page-08-doree-256.7d00f4dd6a.webp'],
  },
  '09': {
    page: ['/decors/page-09-512.9f97c05c8f.webp', '/decors/page-09-256.e151915ed8.webp'],
    doree: ['/decors/page-09-doree-512.e44792f451.webp', '/decors/page-09-doree-256.fe843cf708.webp'],
  },
  '10': {
    page: ['/decors/page-10-512.03942dd16b.webp', '/decors/page-10-256.e40f2759d9.webp'],
    doree: ['/decors/page-10-doree-512.c2bf7bc920.webp', '/decors/page-10-doree-256.e2e1f36caa.webp'],
  },
  '11': {
    page: ['/decors/page-11-512.45a05cb3d5.webp', '/decors/page-11-256.ec3a1915cd.webp'],
    doree: ['/decors/page-11-doree-512.912b0a2bce.webp', '/decors/page-11-doree-256.acb963a439.webp'],
  },
  '12': {
    page: ['/decors/page-12-512.c4576aaec3.webp', '/decors/page-12-256.f6f1520656.webp'],
    doree: ['/decors/page-12-doree-512.e85e92511f.webp', '/decors/page-12-doree-256.ed78e29f8b.webp'],
  },
}
