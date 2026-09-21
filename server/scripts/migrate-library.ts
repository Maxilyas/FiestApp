// Transfère la bibliothèque de quiz d'une base à une autre — typiquement du
// fichier local vers Turso au moment du déploiement, pour ne pas ressaisir
// les questions écrites avant.
//
//   npm run migrate -w server -- --to libsql://xxx.turso.io --token eyJ...
//   … --from-slug romane --slug romane     (l'espace source et l'espace cible, par leur nom dans l'adresse)
//
// Par défaut la source est la base locale (server/data/quizzes.db) et les
// quiz vont de l'espace par défaut de la source à l'espace par défaut de la
// destination — celui de l'administrateur. La destination doit avoir démarré
// au moins une fois : c'est le serveur qui y crée les comptes. Les quiz déjà
// présents à destination sont écrasés par ceux de la source (même id).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type Client } from '@libsql/client'
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

/** L'identifiant d'un espace : par son nom dans l'adresse, sinon celui par défaut. Null si la base n'a pas de comptes. */
async function spaceOf(client: Client, slug: string | undefined): Promise<string | null> {
  try {
    if (slug) {
      const res = await client.execute({ sql: 'SELECT id FROM accounts WHERE slug = ?', args: [slug] })
      return res.rows[0] ? String(res.rows[0].id) : null
    }
    const res = await client.execute({ sql: 'SELECT value FROM meta WHERE key = ?', args: ['default_space'] })
    return res.rows[0] ? String(res.rows[0].value) : null
  } catch {
    return null
  }
}

const source = createClient({ url: fromUrl, authToken: fromToken })
const targetClient = createClient({ url: toUrl, authToken: toToken })

const toSpace = await spaceOf(targetClient, arg('slug'))
if (!toSpace) {
  console.error(
    arg('slug')
      ? `❌ Aucun espace « ${arg('slug')} » à destination.`
      : '❌ La base de destination n’a pas encore de comptes : démarre le serveur dessus une fois (il crée l’administrateur), puis relance.',
  )
  process.exit(1)
}
// On passe par le store pour la destination : il crée les tables au besoin.
const target = new QuizStore(toUrl, toToken)
await target.init(toSpace)

console.log(`📚 ${fromUrl}`)
console.log(`   → ${toUrl} (espace ${arg('slug') ?? 'par défaut'})`)

// Une source d'avant les comptes n'a pas de colonne d'espace : on prend tout.
const fromSpace = await spaceOf(source, arg('from-slug'))
const quizzes = fromSpace
  ? await source.execute({ sql: 'SELECT * FROM quizzes WHERE space_id = ? OR space_id IS NULL', args: [fromSpace] })
  : await source.execute('SELECT * FROM quizzes')
for (const row of quizzes.rows) {
  await targetClient.execute({
    sql: `INSERT INTO quizzes (id, title, questions, created_at, updated_at, space_id)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title = excluded.title, questions = excluded.questions,
            updated_at = excluded.updated_at, space_id = excluded.space_id`,
    args: [
      String(row.id),
      String(row.title),
      String(row.questions),
      Number(row.created_at),
      Number(row.updated_at),
      toSpace,
    ],
  })
}

// Les photos sont référencées par leur URL dans les questions : sans elles,
// les quiz arriveraient à destination avec des images cassées.
// Les photos récentes sont en octets (`bytes`), les anciennes en base64
// (`data`) : on recopie les deux colonnes telles quelles.
let images = { rows: [] as Record<string, unknown>[] }
try {
  images = fromSpace
    ? await source.execute({ sql: 'SELECT * FROM quiz_images WHERE space_id = ? OR space_id IS NULL', args: [fromSpace] })
    : await source.execute('SELECT * FROM quiz_images')
} catch {
  // Une source sans table de photos : rien à recopier.
}
for (const row of images.rows) {
  const raw = row.bytes as unknown
  const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : null
  await targetClient.execute({
    sql: `INSERT INTO quiz_images (id, mime, data, bytes, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING`,
    args: [String(row.id), String(row.mime), String(row.data ?? ''), bytes, Number(row.created_at), toSpace],
  })
}

// Marque la destination comme déjà amorcée : sinon le premier démarrage
// réimporterait les quiz JSON livrés avec le dépôt par-dessus les vrais.
await target.setFlag('seeded', '1')

console.log(`✅ ${quizzes.rows.length} quiz et ${images.rows.length} photo(s) transférés`)
source.close()
targetClient.close()
target.close()
