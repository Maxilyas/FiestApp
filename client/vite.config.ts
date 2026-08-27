import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // accessible depuis les téléphones sur le même wifi
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/media': { target: 'http://localhost:3001' },
    },
  },
})
