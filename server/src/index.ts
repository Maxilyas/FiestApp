import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createQuizServer } from './server'

const here = path.dirname(fileURLToPath(import.meta.url))

const port = Number(process.env.PORT ?? 3001)
const dbPath = process.env.DB_PATH ?? path.resolve(here, '../data/quizz.db')
const hostKey = process.env.HOST_KEY ?? 'romane'
const publicUrl = process.env.PUBLIC_URL

createQuizServer({ port, dbPath, hostKey, publicUrl }).then(server => {
  console.log(`🎉 Quizz Romane 30 — serveur prêt sur http://localhost:${server.port}`)
  console.log(`   Écran commun : http://localhost:${server.port}/host?key=${hostKey}`)
})
