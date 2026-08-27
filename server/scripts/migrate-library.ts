// Transfère la bibliothèque de quiz d'une base à une autre — typiquement du
// fichier local vers Turso au moment du déploiement, pour ne pas ressaisir
// les questions écrites avant.
//
//   npm run migrate -w server -- --to libsql://xxx.turso.io --token eyJ...
//
// Par défaut la source est la base locale (server/data/quizzes.db). Les quiz
// déjà présents à destination sont écrasés par ceux de la source (même id).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { QuizStore } from '../src/core/quizStore'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const here = path.dirname(fileURLToPath(import.meta.url))
const defaultSource = `file:${path.resolve(here, '../data/quizzes.db').replace(/\\/g, '/')}`

const fromUrl = arg('from') ?? process.env.QUIZ_DB_URL_FROM ?? defaultSource
const fromToken = arg('from-token') ?? process.env.QUIZ_DB_TOKEN_FROM
const toUrl = arg('to') ?? process.env.QUIZ_DB_URL
const toToken = arg('token') ?? process.env.QUIZ_DB_TOKEN

if (!toUrl) {
  console.error('Usage : npm run migrate -w server -- --to libsql://... --token ...')
  console.error(`         (source par défaut : ${defaultSource})`)
  process.exit(1)
}

const source = createClient({ url: fromUrl, authToken: fromToken })
// On passe par le store pour la destination : il crée les tables au besoin.
const target = new QuizStore(toUrl, toToken)
await target.init()
const targetClient = createClient({ url: toUrl, authToken: toToken })

console.log(`📚 ${fromUrl}`)
console.log(`   → ${toUrl}`)

const quizzes = await source.execute('SELECT * FROM quizzes')
for (const row of quizzes.rows) {
  await targetClient.execute({
    sql: `INSERT INTO quizzes (id, title, questions, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title = excluded.title, questions = excluded.questions,
            updated_at = excluded.updated_at`,
    args: [
      String(row.id),
      String(row.title),
      String(row.questions),
      Number(row.created_at),
      Number(row.updated_at),
    ],
  })
}

// Les photos sont référencées par leur URL dans les questions : sans elles,
// les quiz arriveraient à destination avec des images cassées.
const images = await source.execute('SELECT * FROM quiz_images')
for (const row of images.rows) {
  await targetClient.execute({
    sql: `INSERT INTO quiz_images (id, mime, data, created_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING`,
    args: [String(row.id), String(row.mime), String(row.data), Number(row.created_at)],
  })
}

// Marque la destination comme déjà amorcée : sinon le premier démarrage
// réimporterait les quiz JSON livrés avec le dépôt par-dessus les vrais.
await target.setFlag('seeded', '1')

console.log(`✅ ${quizzes.rows.length} quiz et ${images.rows.length} photo(s) transférés`)
source.close()
targetClient.close()
target.close()
