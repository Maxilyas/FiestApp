// Sauvegarde la base permanente dans un fichier SQL daté : comptes, quiz,
// photos, soirées archivées, profils, miroir de la soirée en cours — tout ce
// que le serveur ne saurait pas refaire. Turso garde un historique, mais de
// quelques jours seulement selon le forfait, et il disparaît avec la base ;
// ce fichier-ci se garde aussi longtemps qu'on veut, où on veut.
//
//   npm run sauvegarde                                  (QUIZ_DB_URL et QUIZ_DB_TOKEN de l'environnement)
//   npm run sauvegarde -- libsql://xxx.turso.io --token eyJ...
//   npm run sauvegarde -- file:server/data/quizzes.db
//   … --out dossier                                     (par défaut : export/sauvegardes/)
//
// Le fichier se restaure dans une base NEUVE, vide :
//
//   turso db shell nouvelle-base < export/sauvegardes/….sql
//   sqlite3 restauree.db < export/sauvegardes/….sql
//
// Il contient les comptes — mots de passe hachés, empreintes de session — :
// il se garde comme un secret. `export/` est ignoré par git.
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { once } from 'node:events'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clientDistant, pourquoiInjoignable } from '../src/core/distante'

const options = new Map<string, string>()
const positional: string[] = []
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) options.set(argv[i].slice(2), argv[++i] ?? '')
  else positional.push(argv[i])
}

const here = path.dirname(fileURLToPath(import.meta.url))
// `npm run` lance le script depuis server/ : un chemin relatif se lit depuis
// le dossier où la commande a été tapée, que npm garde dans INIT_CWD.
const ouOnEst = process.env.INIT_CWD ?? process.cwd()

function echouer(message: string): never {
  console.error(`❌ ${message}`)
  process.exit(1)
}

const demandee = positional[0] ?? options.get('db') ?? process.env.QUIZ_DB_URL
const token = options.get('token') ?? process.env.QUIZ_DB_TOKEN
if (!demandee) {
  echouer(
    'Quelle base ? Donne son adresse : npm run sauvegarde -- libsql://ta-base.turso.io --token ton-jeton ' +
      '(ou définis QUIZ_DB_URL et QUIZ_DB_TOKEN).',
  )
}

/**
 * Une base `file:` relative se lit depuis là où la commande a été tapée, et
 * elle doit exister : libsql en créerait une vide, et l'on sauvegarderait du
 * vide sans un mot.
 */
function resoudre(url: string): string {
  if (!url.startsWith('file:')) return url
  const brut = url.split('?')[0]
  const chemin = path.resolve(ouOnEst, brut.startsWith('file://') ? fileURLToPath(brut) : brut.slice('file:'.length))
  if (!existsSync(chemin)) echouer(`Base introuvable : ${chemin}`)
  return `file:${chemin.replace(/\\/g, '/')}`
}
const url = resoudre(demandee)

/** La base telle qu'on peut l'écrire : son hôte ou son fichier, jamais un jeton glissé dans l'adresse. */
function lisible(adresse: string): string {
  if (adresse.startsWith('file:')) return adresse
  try {
    const u = new URL(adresse)
    return `${u.protocol}//${u.host}`
  } catch {
    return 'adresse illisible'
  }
}

/** Le nom du fichier : celui de la base, puis la date et l'heure de ce PC. */
function nomDuFichier(): string {
  let base = 'base'
  try {
    base = url.startsWith('file:') ? path.basename(url.slice('file:'.length)).replace(/\.[^.]*$/, '') : new URL(url).hostname.split('.')[0]
  } catch {
    // Une adresse illisible garde le nom générique ; la date suffit à la retrouver.
  }
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const quand = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  return `${base.replace(/[^\w.-]+/g, '-') || 'base'}-${quand}.sql`
}

// ── Écrire une valeur en SQL ──────────────────────────────────────────────

function octets(v: unknown): Buffer {
  if (v instanceof ArrayBuffer) return Buffer.from(v)
  if (ArrayBuffer.isView(v)) return Buffer.from(v.buffer, v.byteOffset, v.byteLength)
  return Buffer.from(String(v ?? ''), 'utf8')
}

/**
 * Une valeur telle que SQLite la relira, type compris — c'est `typeof()` qui
 * le dit, pas une supposition : « 3.0 » relu « 3 » deviendrait un entier dans
 * une colonne sans type. Les textes arrivent en octets (voir `copier`).
 */
function litteral(type: string, v: unknown): string {
  switch (type) {
    case 'null':
      return 'NULL'
    case 'integer':
      return String(v)
    case 'real': {
      const n = Number(v)
      if (!Number.isFinite(n)) return n > 0 ? '9e999' : '-9e999'
      const s = String(n)
      return /[.eE]/.test(s) ? s : `${s}.0`
    }
    case 'text': {
      const brut = octets(v)
      const s = brut.toString('utf8')
      // Un retour à la ligne ou un NUL passent en hexadécimal, tout comme un
      // texte qui ne serait pas de l'UTF-8 valide : une instruction tient sur
      // UNE ligne, qu'aucun outil ligne à ligne ni aucune conversion de fins
      // de ligne ne coupera, et les octets reviennent tels quels.
      if (/[\u0000\r\n]/.test(s) || !Buffer.from(s, 'utf8').equals(brut)) return `CAST(X'${brut.toString('hex')}' AS TEXT)`
      return `'${s.replace(/'/g, "''")}'`
    }
    default:
      return `X'${octets(v).toString('hex')}'`
  }
}

const nom = (identifiant: string) => `"${identifiant.replace(/"/g, '""')}"`

// ── La copie ──────────────────────────────────────────────────────────────

/**
 * Les tables internes de SQLite et de Turso : la base neuve les a déjà, ou
 * les recrée seule. Les réécrire échouerait.
 */
const INTERNES = /^(sqlite_|_litestream|libsql_|_cf_)/

/**
 * Le poids visé d'une page. Une photo pèse ~150 Ko, une soirée archivée
 * jusqu'à quelques mégaoctets, et une réponse de la base a sa limite : tout
 * lire d'un coup échouerait sur une vraie base. On lit donc par pages,
 * dimensionnées sur la ligne la plus lourde de chaque table.
 */
const PAGE_OCTETS = 2_000_000
const PAGE_LIGNES_MAX = 500

// Un script lancé à la main peut attendre plus longtemps qu'un téléphone.
const client = clientDistant(url, token, { delaiMs: 60_000, intMode: 'bigint' })

const dossier = path.resolve(ouOnEst, options.get('out') ?? path.resolve(here, '../../export/sauvegardes'))
mkdirSync(dossier, { recursive: true })
const final = path.join(dossier, nomDuFichier())
// Écrit à côté, renommé à la fin : un fichier qui porte le bon nom est complet.
const partiel = `${final}.partiel`
const flux = createWriteStream(partiel, { encoding: 'utf8' })
let erreurDisque: Error | null = null
flux.on('error', e => (erreurDisque = e))

async function ecrire(texte: string) {
  if (erreurDisque) throw erreurDisque
  if (!flux.write(texte)) await once(flux, 'drain')
}

/** Recopie les lignes d'une table, page par page. Rend leur nombre. */
async function copier(table: { name: string; sql: string }): Promise<number> {
  const info = (await client.execute(`PRAGMA table_info(${nom(table.name)})`)).rows
  const colonnes = info.map(c => String(c.name))
  const liste = colonnes.map(nom).join(', ')
  const poids = colonnes.map(c => `IFNULL(LENGTH(CAST(${nom(c)} AS BLOB)), 0)`).join(' + ')
  const mesure = await client.execute(`SELECT MAX(${poids}) AS lourde FROM ${nom(table.name)}`)
  const lourde = Number(mesure.rows[0]?.lourde ?? 0)
  const parPage = Math.max(1, Math.min(PAGE_LIGNES_MAX, Math.floor(PAGE_OCTETS / Math.max(lourde, 1))))
  // On avance sur `rowid` : une page ne dépend pas de ce qu'on a déjà lu.
  // Une table WITHOUT ROWID (aucune ici) avancerait sur sa clé.
  const sansRowid = /\bWITHOUT\s+ROWID\b/i.test(table.sql)
  const cle = info
    .filter(c => Number(c.pk) > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map(c => nom(String(c.name)))
    .join(', ')
  // Chaque colonne revient avec son type ; un texte revient en octets, car le
  // client libsql coupe un texte à son premier caractère NUL.
  const lecture = colonnes
    .map((c, i) => `typeof(${nom(c)}) AS t${i}, CASE typeof(${nom(c)}) WHEN 'text' THEN CAST(${nom(c)} AS BLOB) ELSE ${nom(c)} END AS v${i}`)
    .join(', ')
  let copiees = 0
  let dernier: unknown = null
  for (;;) {
    const page = sansRowid
      ? await client.execute({
          sql: `SELECT ${lecture} FROM ${nom(table.name)} ORDER BY ${cle} LIMIT ? OFFSET ?`,
          args: [parPage, copiees],
        })
      : await client.execute({
          sql: `SELECT rowid AS __rang__, ${lecture} FROM ${nom(table.name)}${dernier === null ? '' : ' WHERE rowid > ?'} ORDER BY rowid LIMIT ?`,
          args: dernier === null ? [parPage] : [dernier as bigint, parPage],
        })
    for (const ligne of page.rows) {
      const valeurs = colonnes.map((_, i) => litteral(String(ligne[`t${i}`]), ligne[`v${i}`]))
      await ecrire(`INSERT INTO ${nom(table.name)} (${liste}) VALUES (${valeurs.join(', ')});\n`)
    }
    copiees += page.rows.length
    if (page.rows.length < parPage) return copiees
    dernier = page.rows[page.rows.length - 1].__rang__
  }
}

console.log(`💾 ${lisible(url)}`)
try {
  const objets = (await client.execute('SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY rowid')).rows
    .map(r => ({ type: String(r.type), name: String(r.name), table: String(r.tbl_name), sql: String(r.sql) }))
    .filter(o => !INTERNES.test(o.name) && !INTERNES.test(o.table))
  const tables = objets.filter(o => o.type === 'table')

  await ecrire(
    [
      '-- FiestApp : sauvegarde de la base permanente',
      `-- Base : ${lisible(url)}`,
      `-- Faite le ${new Date().toLocaleString('fr-FR')} (heure de ce PC)`,
      '-- À restaurer dans une base NEUVE : turso db shell <base> < ce-fichier.sql, ou sqlite3 <fichier.db> < ce-fichier.sql',
      // Une seule transaction : sqlite3 restaure en secondes au lieu de
      // minutes, et une restauration interrompue ne laisse rien à moitié.
      'BEGIN TRANSACTION;',
      '',
    ].join('\n'),
  )
  let total = 0
  for (const table of tables) {
    await ecrire(`${table.sql};\n`)
    const n = await copier(table)
    total += n
    console.log(`   ${table.name.padEnd(18)} ${String(n).padStart(7)} ligne${n > 1 ? 's' : ''}`)
  }
  // Index, vues et déclencheurs après les données, comme `sqlite3 .dump` :
  // un index se construit plus vite d'un coup qu'une ligne à la fois.
  for (const autre of objets.filter(o => o.type !== 'table')) await ecrire(`${autre.sql};\n`)
  await ecrire(`COMMIT;\n-- Fin de la sauvegarde : ${tables.length} tables, ${total} lignes.\n`)
  await new Promise<void>((resolve, reject) => flux.end((e?: Error | null) => (e ? reject(e) : resolve())))
  if (erreurDisque) throw erreurDisque
  renameSync(partiel, final)

  const mo = (statSync(final).size / 1024 / 1024).toFixed(1).replace('.', ',')
  const relatif = path.relative(ouOnEst, final)
  const affiche = relatif && !relatif.startsWith('..') ? relatif : final
  console.log(`✅ ${tables.length} tables, ${total} lignes, ${mo} Mo → ${affiche}`)
  console.log('   À restaurer dans une base NEUVE, vide :')
  console.log(`     turso db shell <nouvelle-base> < ${affiche}`)
  console.log(`     sqlite3 restauree.db < ${affiche}`)
  console.log('   Ce fichier contient les comptes (mots de passe hachés) : garde-le comme un secret.')
  client.close()
} catch (e) {
  flux.destroy()
  rmSync(partiel, { force: true })
  const raison = pourquoiInjoignable(e)
  echouer(
    raison
      ? `Base injoignable (${lisible(url)}) : ${raison}. Vérifie l’adresse et le jeton (--token, ou QUIZ_DB_TOKEN).`
      : `Sauvegarde interrompue, aucun fichier écrit : ${e instanceof Error ? e.message : String(e)}`,
  )
}
