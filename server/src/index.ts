import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createQuizServer } from './server'

const here = path.dirname(fileURLToPath(import.meta.url))

const port = Number(process.env.PORT ?? 3001)
const dbPath = process.env.DB_PATH ?? path.resolve(here, '../data/quizz.db')
const hostKey = process.env.HOST_KEY ?? 'romane'
const publicUrl = process.env.PUBLIC_URL

// Par défaut la bibliothèque vit dans un fichier local, à côté de la base de
// partie. En ligne, on pointe QUIZ_DB_URL vers Turso : le code ne change pas.
const quizDbUrl =
  process.env.QUIZ_DB_URL ?? `file:${path.resolve(path.dirname(dbPath), 'quizzes.db').replace(/\\/g, '/')}`
const quizDbToken = process.env.QUIZ_DB_TOKEN

createQuizServer({ port, dbPath, hostKey, quizDbUrl, quizDbToken, publicUrl }).then(server => {
  console.log(`🎉 Quizz Romane 30 — serveur prêt sur http://localhost:${server.port}`)
  console.log(`   Écran commun : http://localhost:${server.port}/host?key=${hostKey}`)
  console.log(`   Mes quiz     : http://localhost:${server.port}/edit?key=${hostKey}`)
})
