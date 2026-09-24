import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

/**
 * Les fichiers du paquet, compressés une fois pour toutes au build : un
 * `.br` en brotli 11 et un `.gz` en gzip 9 à côté de chacun, que le serveur
 * sert selon ce que le téléphone accepte (`server/src/core/precompresse.ts`).
 *
 * Ils étaient recompressés à chaque téléphone, en brotli rapide — plus gros
 * que gzip —, et c'était la moitié du processeur d'une arrivée (15 ms sur
 * 30) : le prix de toute une salle qui scanne le QR en même temps. Les
 * fichiers portent leur empreinte et ne changent jamais : autant y passer
 * le temps une fois, au build, où il ne gêne personne.
 */
function precompresser(): Plugin {
  let dossier = ''
  return {
    name: 'fiestapp-precompresser',
    apply: 'build',
    configResolved(config) {
      dossier = path.resolve(config.root, config.build.outDir, config.build.assetsDir)
    },
    closeBundle() {
      if (!fs.existsSync(dossier)) return
      for (const nom of fs.readdirSync(dossier)) {
        // Les photos et les polices sont déjà compressées : rien à gagner.
        if (!/\.(js|css|svg|json|html)$/.test(nom)) continue
        const fichier = path.join(dossier, nom)
        const brut = fs.readFileSync(fichier)
        if (brut.length < 1024) continue
        const br = brotliCompressSync(brut, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
            [constants.BROTLI_PARAM_SIZE_HINT]: brut.length,
          },
        })
        const gz = gzipSync(brut, { level: 9 })
        if (br.length < brut.length) fs.writeFileSync(`${fichier}.br`, br)
        if (gz.length < brut.length) fs.writeFileSync(`${fichier}.gz`, gz)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), precompresser()],
  server: {
    host: true, // accessible depuis les téléphones sur le même wifi
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      // La bibliothèque de quiz de l'espace animateur (/edit). Sans ce proxy,
      // Vite répondrait sa page d'accueil à un appel d'API — le navigateur
      // recevrait du HTML là où il attend du JSON.
      '/api': { target: 'http://localhost:3001' },
      '/media': { target: 'http://localhost:3001' },
      // Les pages souvenir, bilan et historique lisent leurs chiffres sous
      // /s/<espace>/… (une clé « /s » avalerait /souvenir et /stats).
      '^/s/': { target: 'http://localhost:3001' },
      // Les adresses d'avant les espaces : le serveur les redirige vers
      // l'espace de l'administrateur, et Vite sert la page d'arrivée.
      '^/(recap|bilan|soirees)\\.json$': { target: 'http://localhost:3001' },
      '^/(souvenir|stats|bilan|soirees)(/|$)': { target: 'http://localhost:3001' },
    },
  },
})
