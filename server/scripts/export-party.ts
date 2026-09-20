// Exporte le bilan de la soirée en fichiers : un JSON complet et trois CSV
// qui s'ouvrent dans Excel — une ligne par invité avec une colonne par
// question, une ligne par question, une ligne par équipe.
//
//   npm run export -- https://quizz-romane-30.onrender.com
//   npm run export -- --db libsql://xxx.turso.io --token eyJ...
//   npm run export                         (la base locale, chez soi)
//   … --soiree 2026-09-19-k7x2q            (une soirée de l'historique, cf. /soirees)
//   … --out dossier                        (par défaut : export/)
//
// Avec une adresse, le script demande /bilan.json au serveur : c'est le plus
// simple, l'adresse est publique. Avec --db, il lit la base distante lui-même,
// pour le jour où le serveur ne répond plus.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { reviewFromDatabase, reviewFromServer, writeExport } from '../src/core/export'

const options = new Map<string, string>()
const positional: string[] = []
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) options.set(argv[i].slice(2), argv[++i] ?? '')
  else positional.push(argv[i])
}

const here = path.dirname(fileURLToPath(import.meta.url))
const url = positional[0]
const dbUrl =
  options.get('db') ??
  (url ? undefined : (process.env.QUIZ_DB_URL ?? `file:${path.resolve(here, '../data/quizzes.db').replace(/\\/g, '/')}`))
const dbToken = options.get('token') ?? process.env.QUIZ_DB_TOKEN
const soiree = options.get('soiree')
// Chaque soirée archivée a son dossier : l'export de la suivante n'écrase pas celui-ci.
const outDir = path.resolve(options.get('out') ?? path.resolve(here, '../../export', soiree ?? ''))

console.log((url ? `🌐 ${url}` : `🗄️  ${dbUrl}`) + (soiree ? ` · soirée ${soiree}` : ''))
const review = url ? await reviewFromServer(url, soiree) : await reviewFromDatabase(dbUrl!, dbToken, soiree)
if (review.questions.length === 0) {
  console.error('Aucune question au journal : rien à exporter.')
  process.exit(1)
}
const written = writeExport(review, outDir)
const played = review.players.filter(p => p.stat.asked > 0).length
console.log(
  `✅ ${played} invités, ${review.questions.length} questions, ${review.quizzes.length} quiz, ${review.teams.length} équipes`,
)
if (review.unresolved > 0) {
  console.log(
    `⚠️  ${review.unresolved} question(s) sans intitulé : le quiz a été supprimé ou renommé depuis la soirée. Les numéros restent.`,
  )
}
for (const f of written) console.log(`   → ${path.relative(process.cwd(), f) || f}`)
