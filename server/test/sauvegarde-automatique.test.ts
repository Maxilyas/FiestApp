// La sauvegarde automatique de la base permanente (`.github/workflows/sauvegarde.yml`) :
// chaque nuit, `npm run sauvegarde` sur une machine de GitHub, son fichier
// chiffré. Le dépôt est public — tout compte GitHub lit le journal d'une
// exécution et télécharge ses fichiers —, et c'est un jeton de la base de
// production qui y tourne : ce que le fichier promet se garde ici, ligne à
// ligne, avant qu'une retouche anodine — un cache, une étiquette, un `echo` de
// trop, un déclencheur de plus — ne laisse sortir la base en clair ou le jeton
// vers du code qui n'est pas celui de `main`.
//
// Et le jeton qui lui suffit : lire la base et ajouter une ligne à
// `qg_sauvegardes`. La note de la sauvegarde envoyait toujours un `CREATE TABLE
// IF NOT EXISTS` — sans effet, la table existant déjà, mais refusé à un tel
// jeton : le QG ne l'aurait jamais vue, et la règle « Sauvegarde ancienne »
// aurait sonné chaque semaine sur une base sauvegardée chaque nuit.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { SanteDuServeur } from '../src/core/santeDuServeur'
import { fauxTursoHrana } from './hrana'

const SERVEUR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORKFLOW = readFileSync(path.join(SERVEUR, '../.github/workflows/sauvegarde.yml'), 'utf8')

const dossiers: string[] = []
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true })
})

/** Le script de sauvegarde lancé jusqu'au bout, comme la commande : son code et ce qu'il a dit. */
function sauvegarder(args: string[], env: Record<string, string> = {}): Promise<{ code: number | null; sortie: string }> {
  const propre: NodeJS.ProcessEnv = { ...process.env }
  for (const cle of ['QUIZ_DB_URL', 'QUIZ_DB_TOKEN', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete propre[cle]
  const proc = spawn(process.execPath, ['--import', 'tsx', 'scripts/sauvegarde.ts', ...args], {
    cwd: SERVEUR,
    env: { ...propre, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let sortie = ''
  proc.stdout.on('data', d => (sortie += d))
  proc.stderr.on('data', d => (sortie += d))
  return new Promise(resolve => proc.on('close', code => resolve({ code, sortie })))
}

// ── Le jeton ─────────────────────────────────────────────────────────────

test('un jeton qui ne peut que lire la base et y noter sa sauvegarde suffit', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-sauvegarde-auto-'))
  dossiers.push(dir)
  const fichier = path.join(dir, 'permanente.db')
  // Une base où le serveur a démarré : c'est lui qui crée `qg_sauvegardes`.
  const sante = new SanteDuServeur(`file:${fichier}`)
  await sante.init()
  await sante.arreter()
  const avant = new Database(fichier)
  avant.exec("CREATE TABLE comptes (id INTEGER PRIMARY KEY, login TEXT); INSERT INTO comptes (login) VALUES ('antoine'), ('lea')")
  avant.close()

  // Les droits du jeton de la sauvegarde automatique, à la façon de Turso
  // (`-p all:data_read -p qg_sauvegardes:data_add`) : tout lire, ajouter une
  // ligne à une table, ouvrir et fermer la transaction de son lot — rien d'autre.
  const turso = await fauxTursoHrana(fichier, {
    droits: (sql, lecture) =>
      lecture || /^\s*(BEGIN|COMMIT|ROLLBACK|END)\b/i.test(sql) || /^\s*INSERT\s+INTO\s+"?qg_sauvegardes"?\s/i.test(sql),
  })
  try {
    const sortie = path.join(dir, 'sauvegardes')
    const r = await sauvegarder([turso.adresse, '--token', 'jeton-d-essai', '--out', sortie])
    assert.equal(r.code, 0, r.sortie)
    assert.deepEqual(turso.refusees, [], 'rien de ce que ce jeton ne peut pas faire ne lui a été demandé')
    assert.doesNotMatch(r.sortie, /ne la verra pas/, r.sortie)
    const fichiers = readdirSync(sortie)
    assert.equal(fichiers.length, 1, fichiers.join(', '))
    assert.match(readFileSync(path.join(sortie, fichiers[0]), 'utf8'), /INSERT INTO "comptes" \("id", "login"\) VALUES \(2, 'lea'\);/)
  } finally {
    await turso.fermer()
  }
  const apres = new Database(fichier, { readonly: true })
  const notees = apres.prepare('SELECT tables, lignes FROM qg_sauvegardes').all() as { tables: number; lignes: number }[]
  apres.close()
  assert.equal(notees.length, 1, 'la sauvegarde notée : la page « Base et miroir » du QG la voit')
  assert.ok(notees[0].lignes >= 2, `ses lignes comptées : ${notees[0].lignes}`)
})

// ── Le fichier de GitHub ─────────────────────────────────────────────────

/** Le bloc d'une clé du premier niveau : ses lignes jusqu'à la clé suivante. */
function bloc(cle: string): string {
  const m = new RegExp(`^${cle}:\\n((?:(?: .*)?\\n)*)`, 'm').exec(WORKFLOW)
  assert.ok(m, `la clé « ${cle} » au premier niveau`)
  return m[1]
}

/** Les clés d'un bloc à un niveau d'indentation, sans les commentaires. */
const clesDe = (texte: string, espaces: number) => [...texte.matchAll(new RegExp(`^ {${espaces}}([a-z_-]+):`, 'gm'))].map(m => m[1])

/** Les étapes de l'unique job, chacune son texte, dans l'ordre. */
const ETAPES = WORKFLOW.slice(WORKFLOW.indexOf('\n    steps:\n'))
  .split(/\n(?= {6}- )/)
  .slice(1)
/** L'étape qui porte ce nom. */
function etape(nom: string): string {
  const e = ETAPES.find(t => t.startsWith(`      - name: ${nom}\n`))
  assert.ok(e, `l'étape « ${nom} »`)
  return e
}

test('la sauvegarde ne part que la nuit ou à la main, depuis main, le jeton de l’exécution en lecture', () => {
  // Ni `push`, ni `pull_request`, ni surtout `pull_request_target` : le code
  // d'une proposition de modification ne tourne jamais à côté du jeton.
  assert.deepEqual(clesDe(bloc('on'), 2), ['schedule', 'workflow_dispatch'])
  assert.deepEqual(clesDe(bloc('permissions'), 2), ['contents'])
  assert.match(bloc('permissions'), /^ {2}contents: read$/m)
  assert.equal(WORKFLOW.match(/^\s*permissions:/gm)?.length, 1, 'aucun job n’élargit les droits du jeton de l’exécution')
  assert.deepEqual(clesDe(WORKFLOW.slice(WORKFLOW.indexOf('\njobs:')), 2), ['sauvegarder'], 'un seul job')
  // Les secrets ne vont qu'à `main`, par l'environnement que GitHub garde.
  assert.match(WORKFLOW, /^ {4}if: github\.ref == 'refs\/heads\/main'$/m)
  assert.match(WORKFLOW, /^ {4}environment: sauvegarde$/m)
  // `bash` nommé : `-o pipefail`, sans quoi `gzip | age` qui échoue passerait.
  assert.match(bloc('defaults'), /^ {4}shell: bash$/m)
})

test('rien ne tourne à côté du jeton que le fichier de verrouillage et des actions tenues par leur empreinte', () => {
  const actions = [...WORKFLOW.matchAll(/^\s*(?:- )?uses: (.+)$/gm)].map(m => m[1])
  assert.ok(actions.length >= 3, actions.join(', '))
  for (const a of actions) assert.match(a, /^actions\/[a-z-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/, `${a} : une action de GitHub, par l'empreinte de son code`)
  assert.match(etape('Le code'), /persist-credentials: false/)
  assert.doesNotMatch(WORKFLOW, /^\s*cache:/m, 'aucun cache : rien de ce qu’une autre exécution a rangé')
  assert.match(etape('Les dépendances'), /run: npm ci --no-audit --no-fund --ignore-scripts$/m)
  // Rien de GitHub ne s'écrit dans un script : il passe par l'environnement.
  for (const e of ETAPES) {
    const script = /run: \|?\n?([\s\S]*)$/.exec(e)?.[1] ?? ''
    assert.doesNotMatch(script, /\$\{\{/, `${e.split('\n')[0].trim()} : pas de \${{ … }} dans un script`)
  }
})

test('le jeton de la base ne vit que dans l’étape de la sauvegarde, et ce qu’elle dit reste hors du journal public', () => {
  const avecSecrets = ETAPES.filter(e => e.includes('secrets.'))
  assert.equal(avecSecrets.length, 1, 'une seule étape lit les secrets')
  const sauvegarde = etape('La sauvegarde')
  assert.equal(avecSecrets[0], sauvegarde)
  assert.deepEqual(
    [...sauvegarde.matchAll(/^ {10}([A-Z_]+): \$\{\{ secrets\.([A-Z_]+) \}\}$/gm)].map(m => [m[1], m[2]]),
    [
      ['QUIZ_DB_URL', 'SAUVEGARDE_DB_URL'],
      ['QUIZ_DB_TOKEN', 'SAUVEGARDE_DB_TOKEN'],
    ],
  )
  assert.doesNotMatch(WORKFLOW.slice(0, WORKFLOW.indexOf('\n    steps:\n')), /secrets\./, 'aucun secret au niveau du job')
  // L'adresse de la base, ses tables, une erreur : dans un fichier qui part chiffré.
  const commande = sauvegarde.split('\n').filter(l => l.includes('npm run sauvegarde'))
  assert.equal(commande.length, 1, commande.join('\n'))
  assert.match(commande[0], /npm run sauvegarde -- --out "\$RUNNER_TEMP\/clair\/sql" > "\$RUNNER_TEMP\/clair\/journal\.txt" 2>&1/)
})

test('seuls des fichiers chiffrés quittent la machine', () => {
  const cles = etape('Les clés du chiffrement')
  // Des clés publiques seulement : une clé privée collée là ne passerait pas.
  assert.ok(cles.includes("grep -qvE '^age1[0-9a-z]{58}$'"), cles)
  assert.match(cles, /DESTINATAIRES: \$\{\{ vars\.SAUVEGARDE_DESTINATAIRES \}\}/)
  const chiffrement = etape('Le chiffrement')
  assert.match(chiffrement, /gzip -9 -c "\$1" \| age -R "\$RUNNER_TEMP\/destinataires\.txt" -o "\$2"/)
  assert.ok(chiffrement.includes(`[ "$(head -c 21 "$2")" = 'age-encryption.org/v1' ]`), 'l’en-tête de age vérifié sur ce qui sort')
  assert.match(chiffrement, /rm -rf "\$RUNNER_TEMP\/clair"/)
  const envoi = etape('Les fichiers chiffrés')
  assert.match(envoi, /^ {10}path: \$\{\{ runner\.temp \}\}\/chiffre\/\*\.age$/m)
  assert.match(envoi, /^ {10}if-no-files-found: error$/m)
  assert.match(envoi, /^ {10}retention-days: 30$/m)
  // Un seul envoi, et c'est celui-là.
  assert.equal(ETAPES.filter(e => /upload-artifact/.test(e)).length, 1)
})
