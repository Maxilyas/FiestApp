// Les douze pages du calendrier des Heures, peintes : leurs fichiers, dans
// `client/public/decors`.
//
// Écrit par `server/scripts/anime/decors.ts --livrer` : on ne le retouche pas
// à la main, on relance la chaîne. Chaque fichier est nommé par son
// empreinte. Deux tailles, `[grande, petite]` : 512 et 256 pixels. Tant que
// la chaîne n'a rien livré, la table est vide, et la page montre le mois en
// lettres sur le vélin.

export const PAGES_PEINTES: Record<string, { page: [string, string]; doree: [string, string] }> = {}
