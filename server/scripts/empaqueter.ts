// `npm run build` : le serveur en un seul fichier, `server/dist/index.mjs`.
//
// Sur l'offre gratuite, chaque réveil est un démarrage, et `tsx` y
// transpilait tout le serveur : 0,8 à 1 s de processeur et 40 Mo de mémoire
// de plus que le paquet, sur un dixième de cœur — quelques secondes de page
// blanche de plus pour le premier invité qui scanne le QR [exploitation-6].
// Le paquet se construit une fois, avec le client, et `node dist/index.mjs`
// le lance ; `node --import tsx src/index.ts` marche toujours, pour qui n'a
// pas changé sa commande de démarrage.
//
// Les dépendances restent dans node_modules (`packages: 'external'`) :
// better-sqlite3 et libsql y gardent leurs binaires, et le paquet ne contient
// que le code du dépôt. Il vit un étage sous `server/`, comme `src/index.ts` :
// c'est ce que `SERVEUR` (`src/racine.ts`) suppose pour retrouver les quiz
// livrés, les photos et le client. `exploitation.test.ts` démarre un paquet
// construit par cette même fonction.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const SERVEUR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function empaqueter(sortie = path.join(SERVEUR, 'dist/index.mjs')): Promise<void> {
  await build({
    entryPoints: [path.join(SERVEUR, 'src/index.ts')],
    outfile: sortie,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external',
    logLevel: 'warning',
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await empaqueter()
