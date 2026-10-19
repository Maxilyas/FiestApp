// Compile un script du banc comme le paquet de production
// (`server/scripts/empaqueter.ts`) : esbuild, sans `keepNames` — sous tsx,
// chaque fonction fléchée passe par `__name` —, et la base de la campagne
// vérifiée au build, relue telle quelle (`server/dist/index.campagne.ndjson`,
// `npm run build` d'abord). Chaque module garde son `import.meta.url`
// d'origine : les chemins du banc, du faux Turso et du serveur (`SERVEUR`)
// restent ceux de tsx, où que tombe le fichier compilé.
//
//   cd server && node --import tsx ../retours/2026-10-16/reproductions/compiler.ts \
//     ../retours/2026-10-16/reproductions/banc-gel.ts ../export/banc/banc-gel.mjs
//   PROFILER=1 node ../export/banc/banc-gel.mjs
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const [entree, sortie] = process.argv.slice(2)
if (!entree || !sortie) throw new Error('usage : compiler.ts <script du banc> <sortie.mjs>')
await build({
  entryPoints: [entree],
  outfile: sortie,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  logLevel: 'warning',
  // Relatif à `server/src/core/baseCampagne.ts`, dont l'adresse reste la sienne.
  define: { __BASE_PREPAREE__: JSON.stringify('../../dist/index.campagne.ndjson') },
  plugins: [
    {
      name: 'adresse-d-origine',
      setup(b) {
        b.onLoad({ filter: /\.m?ts$/ }, async args => ({
          contents: (await readFile(args.path, 'utf8')).replaceAll('import.meta.url', JSON.stringify(pathToFileURL(args.path).href)),
          loader: 'ts',
        }))
      },
    },
  ],
})
console.log(`compilé : ${sortie}`)
