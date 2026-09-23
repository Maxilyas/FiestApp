// Transfère la bibliothèque de quiz d'une base à une autre — typiquement du
// fichier local vers Turso au moment du déploiement, pour ne pas ressaisir
// les questions écrites avant.
//
//   npm run migrate -w server -- --to libsql://xxx.turso.io --token eyJ...
//   … --from-slug demo --slug demo         (l'espace source et l'espace cible, par leur nom dans l'adresse)
//
// Par défaut la source est la base locale (server/data/quizzes.db) et les
// quiz vont de l'espace par défaut de la source à l'espace par défaut de la
// destination — celui de l'administrateur. La destination doit avoir démarré
// au moins une fois : c'est le serveur qui y crée les comptes.
//
// Un quiz déjà présent dans l'espace cible (même identifiant) y est mis à
// jour : relancer la commande est sans risque. Un quiz présent dans un AUTRE
// espace n'y est jamais touché — l'identifiant d'un quiz est unique dans
// toute la base, pas son espace : l'ancienne version réécrivait l'espace de
// la ligne, et envoyer sa bibliothèque à un ami la retirait de la sienne.
// L'espace cible reçoit alors sa propre copie, photos comprises, sous un
// identifiant tiré de l'original et de l'espace : relancer retrouve cette
// copie au lieu d'en faire une autre.
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clientDistant, type Client } from '../src/core/distante'
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

// Un script lancé à la main peut attendre plus longtemps qu'un téléphone :
// la lecture des photos de la source pèse, elle, plusieurs mégaoctets.
const source = clientDistant(fromUrl, fromToken, { delaiMs: 60_000 })
const targetClient = clientDistant(toUrl, toToken, { delaiMs: 60_000 })

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
// Et il rattache les lignes sans espace à celui qu'on lui donne : ce doit être
// l'espace PAR DÉFAUT de la destination, pas celui qu'on vise — sinon
// `--slug chez-bob` donnerait à Bob ce qui revient à l'administrateur.
const target = new QuizStore(toUrl, toToken)
await target.init((await spaceOf(targetClient, undefined)) ?? toSpace)

console.log(`📚 ${fromUrl}`)
console.log(`   → ${toUrl} (espace ${arg('slug') ?? 'par défaut'})`)

/** À qui appartient déjà chaque identifiant, à destination. */
async function proprietaires(table: 'quizzes' | 'quiz_images'): Promise<Map<string, string>> {
  const res = await targetClient.execute(`SELECT id, space_id FROM ${table}`)
  return new Map(res.rows.map(r => [String(r.id), String(r.space_id ?? '')]))
}
const quizDeja = await proprietaires('quizzes')
const photosDeja = await proprietaires('quiz_images')

/**
 * L'identifiant de la copie d'une ligne dans l'espace cible : toujours le
 * même pour le même original et le même espace. Il a la forme d'un UUID, car
 * c'est ainsi que les adresses de photo sont reconnues (`/media/image/…`).
 */
function idDeCopie(id: string): string {
  const h = createHash('sha256').update(`${toSpace}:${id}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

/**
 * Où écrire une ligne de la source : sous son identifiant s'il est libre ou
 * déjà à l'espace cible, sinon sous celui de sa copie — et nulle part si même
 * celui-là est pris ailleurs (un hasard qu'on signale plutôt que d'écraser).
 */
function destination(id: string, deja: Map<string, string>): string | null {
  const proprietaire = deja.get(id)
  if (proprietaire === undefined || proprietaire === toSpace) return id
  const copie = idDeCopie(id)
  const sien = deja.get(copie)
  return sien === undefined || sien === toSpace ? copie : null
}

// Les photos d'abord : une photo recopiée sous un autre identifiant change
// d'adresse, et les questions qui la citent doivent suivre.
// Les photos récentes sont en octets (`bytes`), les anciennes en base64
// (`data`) : on recopie les deux colonnes telles quelles.
const fromSpace = await spaceOf(source, arg('from-slug'))
let images = { rows: [] as Record<string, unknown>[] }
try {
  images = fromSpace
    ? await source.execute({ sql: 'SELECT * FROM quiz_images WHERE space_id = ? OR space_id IS NULL', args: [fromSpace] })
    : await source.execute('SELECT * FROM quiz_images')
} catch {
  // Une source sans table de photos : rien à recopier.
}
const adresses = new Map<string, string>()
let photosCopiees = 0
let photosIgnorees = 0
for (const row of images.rows) {
  const id = String(row.id)
  const cible = destination(id, photosDeja)
  if (!cible) {
    console.warn(`⚠️  photo ${id} ignorée : son identifiant et celui de sa copie sont pris dans d'autres espaces`)
    photosIgnorees++
    continue
  }
  if (cible !== id) {
    adresses.set(`/media/image/${id}`, `/media/image/${cible}`)
    photosCopiees++
  }
  const raw = row.bytes as unknown
  const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw instanceof Uint8Array ? raw : null
  // Une photo ne change jamais : déjà là, dans cet espace, elle est à jour.
  await targetClient.execute({
    sql: `INSERT INTO quiz_images (id, mime, data, bytes, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING`,
    args: [cible, String(row.mime), String(row.data ?? ''), bytes, Number(row.created_at), toSpace],
  })
  photosDeja.set(cible, toSpace)
}

// Une source d'avant les comptes n'a pas de colonne d'espace : on prend tout.
const quizzes = fromSpace
  ? await source.execute({ sql: 'SELECT * FROM quizzes WHERE space_id = ? OR space_id IS NULL', args: [fromSpace] })
  : await source.execute('SELECT * FROM quizzes')
let quizCopies = 0
let quizIgnores = 0
for (const row of quizzes.rows) {
  const id = String(row.id)
  const cible = destination(id, quizDeja)
  if (!cible) {
    console.warn(`⚠️  quiz « ${String(row.title)} » ignoré : son identifiant et celui de sa copie sont pris dans d'autres espaces`)
    quizIgnores++
    continue
  }
  if (cible !== id) quizCopies++
  let questions = String(row.questions)
  for (const [avant, apres] of adresses) questions = questions.replaceAll(avant, apres)
  // Jamais `space_id` dans la mise à jour : une ligne ne change pas d'espace.
  // Et le `WHERE` refuse d'écrire sur la ligne d'un autre, même si la base
  // avait bougé depuis la lecture des propriétaires.
  await targetClient.execute({
    sql: `INSERT INTO quizzes (id, title, questions, created_at, updated_at, space_id)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title = excluded.title, questions = excluded.questions,
            updated_at = excluded.updated_at
          WHERE quizzes.space_id = excluded.space_id`,
    args: [cible, String(row.title), questions, Number(row.created_at), Number(row.updated_at), toSpace],
  })
  quizDeja.set(cible, toSpace)
}

// Marque la destination comme déjà amorcée : sinon le premier démarrage
// réimporterait les quiz JSON livrés avec le dépôt par-dessus les vrais.
await target.setFlag('seeded', '1')

console.log(`✅ ${quizzes.rows.length - quizIgnores} quiz et ${images.rows.length - photosIgnorees} photo(s) transférés`)
if (quizCopies > 0 || photosCopiees > 0) {
  console.log(
    `   dont ${quizCopies} quiz et ${photosCopiees} photo(s) en copie : ils existaient déjà dans un autre espace, qui les garde tels quels`,
  )
}
source.close()
targetClient.close()
target.close()
