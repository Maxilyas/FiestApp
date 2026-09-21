import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
