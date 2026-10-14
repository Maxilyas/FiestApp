// La documentation de FiestApp — le `README.md` de la racine et `docs/` — se
// relit contre le code.
//
// Le 14 octobre 2026, elle tenait en quatre récits écrits au fil des lots —
// `README.md` faisait 148 Ko, `RECOMPENSES.md` 88 Ko, `MISE-EN-LIGNE.md`
// 65 Ko, `PARCOURS-ENTREE.md` 47 Ko — qui ne disaient plus l'application : des
// fichiers renommés, des barèmes d'avant, la feuille de route arrêtée au lot 26
// quand la campagne, les sentiers, les duels et la boutique étaient livrés.
// Elle a été réécrite contre le code, en pages rangées par besoin du lecteur.
// Ce test garde ce qui peut l'être sans la relire : un fichier cité qui
// disparaît, un lien qui casse, une route, un événement, une variable, une
// table ou une adresse qui naît sans sa ligne dans la référence — ou qui y
// reste après sa mort —, et un barème qui change de valeur sans le dire.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ACCOUNT_PAGES } from '../../shared/adresses'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const lire = (f: string) => readFileSync(path.join(racine, f), 'utf8')

/** Les fichiers du dépôt, suivis ou nouveaux — pas ce que git ignore. */
const FICHIERS = new Set(
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: racine, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean),
)
const DOSSIERS = new Set([...FICHIERS].flatMap(f => f.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/'))))

function sous(dossier: string, extension: RegExp): string[] {
  return readdirSync(path.join(racine, dossier), { recursive: true })
    .map(f => path.posix.join(dossier, String(f).split(path.sep).join('/')))
    .filter(f => extension.test(f) && !f.includes('node_modules') && statSync(path.join(racine, f)).isFile())
    .sort()
}

/** Les pages de la documentation : la porte d'entrée, puis tout `docs/`. */
const PAGES = ['README.md', ...sous('docs', /\.md$/)]

/** Une page sans ses blocs de code : un exemple de commande n'est pas un lien. */
const horsDesBlocs = (texte: string) => texte.replace(/^(```|~~~)[\s\S]*?^\1/gm, '')

/** L'ancre que GitHub donne à un titre. */
function ancre(titre: string): string {
  return titre
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-')
}

function ancresDe(texte: string): Set<string> {
  const vues = new Map<string, number>()
  const ancres = new Set<string>()
  for (const ligne of horsDesBlocs(texte).split('\n')) {
    const m = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(ligne)
    if (!m) continue
    const brut = ancre(m[1].replace(/`/g, ''))
    const n = vues.get(brut) ?? 0
    vues.set(brut, n + 1)
    ancres.add(n === 0 ? brut : `${brut}-${n}`)
  }
  for (const m of texte.matchAll(/<a\s+(?:name|id)="([^"]+)"/g)) ancres.add(m[1])
  return ancres
}

/** Les cellules entre accents graves de la première colonne des tableaux d'une page. */
function premieresColonnes(texte: string): string[] {
  return [...horsDesBlocs(texte).matchAll(/^\|\s*`([^`]+)`/gm)].map(m => m[1])
}

/** Les titres d'une page écrits comme un nom de code : « ### `player:join` ». */
function titresEnCode(texte: string): string[] {
  return [...horsDesBlocs(texte).matchAll(/^#{2,4}\s+`([^`]+)`\s*$/gm)].map(m => m[1])
}

function sourcesDe(...dossiers: string[]): string[] {
  return dossiers.flatMap(d => sous(d, /\.(ts|tsx|mjs)$/))
}

test('chaque fichier cité par la documentation existe encore', () => {
  const perdus: string[] = []
  for (const page of PAGES) {
    for (const [, cite] of lire(page).matchAll(/`([^`\s]+)`/g)) {
      // Un chemin du dépôt, pas une adresse (`/api/…`), un motif, un gabarit
      // (`<espace>`), ni ce que le build ou le serveur fabriquent.
      if (!/^(client|server|shared|docs|\.claude|\.github|retours)\//.test(cite)) continue
      if (/[*<>…{}$:?=,]/.test(cite)) continue
      if (/^(server|client)\/dist\/|^server\/data\//.test(cite)) continue
      const net = cite.replace(/\/$/, '')
      if (!FICHIERS.has(net) && !DOSSIERS.has(net)) perdus.push(`${page} → ${cite}`)
    }
  }
  assert.deepEqual(perdus, [], 'des fichiers cités ont disparu ou changé de nom : corrige la page, ou le chemin')
})

test('chaque lien mène à une page qui existe, et chaque ancre à un titre', () => {
  const morts: string[] = []
  for (const page of PAGES) {
    const texte = lire(page)
    for (const [, cible] of horsDesBlocs(texte).matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      if (/^(https?:|mailto:)/.test(cible)) continue
      const [fichier, fragment] = cible.split('#')
      const vise = fichier ? path.posix.normalize(path.posix.join(path.posix.dirname(page), decodeURIComponent(fichier))) : page
      if (!existsSync(path.join(racine, vise))) {
        morts.push(`${page} → ${cible}`)
        continue
      }
      if (fragment && vise.endsWith('.md') && !ancresDe(lire(vise)).has(decodeURIComponent(fragment))) {
        morts.push(`${page} → ${cible} (pas de titre « #${fragment} »)`)
      }
    }
  }
  assert.deepEqual(morts, [], 'des liens de la documentation ne mènent nulle part')
})

test('chaque page de docs/ se trouve depuis le sommaire', () => {
  // Une page que rien ne lie n'est lue par personne, et vieillit sans témoin.
  const sommaire = lire('docs/README.md')
  const liees = new Set(
    [...horsDesBlocs(sommaire).matchAll(/\]\(([^)#\s]+)/g)].map(([, cible]) => path.posix.normalize(path.posix.join('docs', cible))),
  )
  const orphelines = PAGES.filter(p => p.startsWith('docs/') && p !== 'docs/README.md' && !liees.has(p))
  assert.deepEqual(orphelines, [], 'ajoute ces pages au sommaire, docs/README.md')
})

test('chaque commande npm citée existe', () => {
  const scripts = new Set(
    ['package.json', 'server/package.json', 'client/package.json'].flatMap(f => Object.keys(JSON.parse(lire(f)).scripts ?? {})),
  )
  const inconnues = PAGES.flatMap(page => [...lire(page).matchAll(/npm run ([a-z][\w:-]*)/g)].map(m => m[1]).filter(s => !scripts.has(s)).map(s => `${page} → npm run ${s}`))
  assert.deepEqual(inconnues, [])
})

test('chaque route HTTP du serveur est dans la référence, et rien qu\'elles', () => {
  // Une route qui naît sans sa ligne n'existe pour personne d'autre que son
  // auteur ; une ligne qui survit à sa route envoie le lecteur sur un 404.
  const routes = new Set<string>()
  for (const f of sourcesDe('server/src')) {
    for (const m of readFileSync(path.join(racine, f), 'utf8').matchAll(/\.(get|post|put|patch|delete)\(\s*(['`])(\/[^'`]*)\2/g)) {
      if (!m[3].includes('${')) routes.add(`${m[1].toUpperCase()} ${m[3]}`)
    }
  }
  assert.ok(routes.size > 100, `seulement ${routes.size} routes lues : la lecture du code a cassé`)
  const reference = lire('docs/reference/api-http.md')
  const documentees = new Set([...horsDesBlocs(reference).matchAll(/^\|\s*`(GET|POST|PUT|PATCH|DELETE)`\s*\|\s*`([^`]+)`/gm)].map(m => `${m[1]} ${m[2]}`))
  assert.deepEqual([...routes].filter(r => !documentees.has(r)).sort(), [], 'routes absentes de docs/reference/api-http.md : ajoute leur ligne (| `GET` | `/api/…` | accès | rôle | fichier |)')
  assert.deepEqual([...documentees].filter(r => !routes.has(r)).sort(), [], 'docs/reference/api-http.md décrit des routes que le serveur n\'a plus')
})

test('chaque événement temps réel est dans la référence, et rien qu\'eux', () => {
  // Les clés des deux interfaces du protocole — `toast` n'a pas de
  // deux-points : un premier inventaire, qui les cherchait, l'avait oublié.
  const protocole = lire('shared/events.ts')
  const evenements = new Set<string>()
  for (const sens of ['ClientToServerEvents', 'ServerToClientEvents']) {
    const debut = protocole.indexOf(`export interface ${sens} {`)
    assert.ok(debut >= 0, `${sens} introuvable dans shared/events.ts`)
    for (const m of protocole.slice(debut, protocole.indexOf('\n}', debut)).matchAll(/^ {2}'([^']+)'\s*:/gm)) evenements.add(m[1])
  }
  assert.ok(evenements.size > 20, `seulement ${evenements.size} événements lus dans shared/events.ts`)
  const documentes = new Set(titresEnCode(lire('docs/reference/evenements-temps-reel.md')).filter(t => /^[a-zA-Z]+(:[a-zA-Z:]+)?$/.test(t)))
  assert.deepEqual([...evenements].filter(e => !documentes.has(e)).sort(), [], 'événements absents de docs/reference/evenements-temps-reel.md : ajoute leur section (### `nom:evenement`)')
  assert.deepEqual([...documentes].filter(e => !evenements.has(e)).sort(), [], 'docs/reference/evenements-temps-reel.md décrit des événements que shared/events.ts n\'a plus')
})

test('chaque variable d\'environnement est dans la référence, et rien qu\'elles', () => {
  const lues = new Set<string>()
  for (const f of [...sourcesDe('server/src', 'shared', 'server/scripts', 'client/src'), 'client/vite.config.ts']) {
    const texte = readFileSync(path.join(racine, f), 'utf8')
    for (const m of texte.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)|process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]|import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g)) {
      lues.add(m[1] ?? m[2] ?? m[3])
    }
  }
  // Ce que Vite pose lui-même, sans qu'on le règle.
  for (const v of ['DEV', 'PROD', 'MODE', 'BASE_URL', 'SSR']) lues.delete(v)
  const configuration = lire('docs/reference/configuration.md')
  const documentees = new Set(premieresColonnes(configuration).filter(c => /^[A-Z_][A-Z0-9_]*$/.test(c)))
  const ailleurs = lire('docs/reference/commandes.md')
  const absentes = [...lues].filter(v => !documentees.has(v) && !new RegExp('`' + v + '`').test(ailleurs)).sort()
  assert.deepEqual(absentes, [], 'variables lues par le code et absentes de docs/reference/configuration.md (ou de commandes.md, pour celles d\'un script)')
  const connues = lire('render.yaml') + lire('.github/workflows/ci.yml')
  const fantomes = [...documentees].filter(v => !lues.has(v) && !connues.includes(v)).sort()
  assert.deepEqual(fantomes, [], 'docs/reference/configuration.md décrit des variables que plus rien ne lit')
})

test('chaque table des deux bases est dans la référence, et rien qu\'elles', () => {
  const tables = new Set<string>()
  for (const f of sourcesDe('server/src')) {
    for (const m of readFileSync(path.join(racine, f), 'utf8').matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z][a-z0-9_]*)/g)) tables.add(m[1])
  }
  assert.ok(tables.size > 40, `seulement ${tables.size} tables lues`)
  const documentees = new Set(titresEnCode(lire('docs/reference/base-de-donnees.md')).filter(t => /^[a-z][a-z0-9_]*$/.test(t)))
  assert.deepEqual([...tables].filter(t => !documentees.has(t)).sort(), [], 'tables absentes de docs/reference/base-de-donnees.md : ajoute leur section (### `nom_de_table`)')
  assert.deepEqual([...documentees].filter(t => !tables.has(t)).sort(), [], 'docs/reference/base-de-donnees.md décrit des tables que plus rien ne crée')
})

test('chaque adresse de page est dans la référence', () => {
  const reference = lire('docs/reference/adresses.md')
  const absentes = [
    ...ACCOUNT_PAGES.map(p => `/${p}`),
    ...['souvenir', 'stats', 'bilan', 'bilan/fiches', 'soirees'].map(p => `/<espace>/${p}`),
  ].filter(a => !reference.includes('`' + a + '`'))
  assert.deepEqual(absentes, [], 'adresses absentes de docs/reference/adresses.md (shared/adresses.ts les ouvre)')
})

test('chaque barème de la référence existe, à la valeur dite', async () => {
  // Les barèmes sont des choix de produit (CLAUDE.md) : une valeur qui change
  // doit se dire — ici, en changeant aussi sa ligne. Une constante exportée
  // et numérique se compare à sa valeur ; les autres, à leur déclaration.
  const lignes = [...horsDesBlocs(lire('docs/reference/baremes.md')).matchAll(/^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|([^|]*)\|\s*`([^`]+)`/gm)]
  assert.ok(lignes.length > 30, `seulement ${lignes.length} barèmes lus dans docs/reference/baremes.md`)
  const ecarts: string[] = []
  const modules = new Map<string, Record<string, unknown>>()
  for (const [, nom, brute, fichier] of lignes) {
    if (!FICHIERS.has(fichier)) {
      ecarts.push(`${nom} : ${fichier} n'existe pas`)
      continue
    }
    if (!new RegExp(`\\b${nom}\\b\\s*(?::[^=]+)?=`).test(lire(fichier))) {
      ecarts.push(`${nom} : pas déclarée dans ${fichier}`)
      continue
    }
    if (!/\.tsx?$/.test(fichier)) continue
    if (!modules.has(fichier)) modules.set(fichier, await import(pathToFileURL(path.join(racine, fichier)).href))
    const valeur = modules.get(fichier)![nom]
    // Un nombre nu, écrit comme on l'écrit en français (« 1 000 », « 0,8 ») :
    // c'est la valeur du code. « 24 h » ou « 1/40 » se lisent, ne se comparent
    // pas — l'unité vit dans la colonne de ce que la constante règle.
    const ecrite = /^\s*(−|-)?\s*(\d[\d   ]*(?:,\d+)?)\s*$/.exec(brute.replace(/`/g, ''))
    if (typeof valeur !== 'number' || !ecrite) continue
    const lue = Number(ecrite[2].replace(/[   ]/g, '').replace(',', '.')) * (ecrite[1] ? -1 : 1)
    if (Math.abs(lue - valeur) > 1e-9) ecarts.push(`${nom} vaut ${valeur} dans ${fichier}, la référence dit ${brute.trim()}`)
  }
  assert.deepEqual(ecarts, [], 'docs/reference/baremes.md ne dit plus le code')
})

test('la porte d\'entrée reste une porte', () => {
  // Le README racine faisait 148 Ko : chaque lot y ajoutait son paragraphe, et
  // plus personne ne le lisait. Il présente, montre comment démarrer et mène à
  // `docs/` ; le détail vit dans les pages.
  const texte = lire('README.md')
  assert.ok(texte.length <= 20_000, `README.md fait ${texte.length} caractères : le détail va dans docs/`)
})
