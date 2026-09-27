import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Le dossier `server/`, d'où qu'on lance le serveur.
 *
 * `tsx src/index.ts` lit chaque module à sa place ; le serveur empaqueté
 * (`dist/index.mjs`, `scripts/empaqueter.ts`) n'est plus qu'un fichier, où le
 * `import.meta.url` de chaque module vaut celui du paquet. Un chemin compté
 * depuis `src/core/` y menait hors du dépôt : la bibliothèque livrée ne
 * s'importait plus, et le quiz du jour démarrait sans réserve. Ce module et le
 * paquet vivent à la même profondeur, un étage sous `server/` : c'est la seule
 * chose que le code suppose — un chemin du serveur se compte depuis ici.
 */
export const SERVEUR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
