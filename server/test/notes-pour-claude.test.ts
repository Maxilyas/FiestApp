// La mémoire de Claude pour ce dépôt : `CLAUDE.md` à la racine, chargé à
// chaque session et dans chaque agent, et le détail de chaque domaine dans
// `.claude/rules/`, qui n'arrive que quand Claude ouvre un fichier du domaine.
//
// Le 6 octobre 2026, `CLAUDE.md` faisait 126 Ko — 60 % de plus en trois
// jours, chaque fonctionnalité y ajoutant sa phrase —, relus à chaque requête
// de chaque session et de chaque agent de la tablée. La doc de Claude Code
// vise moins de 200 lignes : au-delà, il en suit moins bien les consignes.
// Ce test garde la racine courte, et les règles chargeables : une règle dont
// l'en-tête ne se lit pas se charge à chaque session, sans un mot d'erreur.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const lire = (f: string) => readFileSync(path.join(racine, f), 'utf8')

const REGLES = readdirSync(path.join(racine, '.claude/rules')).filter(f => f.endsWith('.md')).sort()

/** Les fichiers du dépôt, suivis ou nouveaux — pas ce que git ignore (`node_modules`, `dist`). */
const FICHIERS = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: racine,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)

/**
 * Les motifs d'une règle, lus comme Claude Code les lit — mais sans pardon :
 * il ne lit qu'un champ, `paths`, et un en-tête qu'il ne sait pas lire fait
 * charger la règle partout. On n'accepte donc que la forme simple, un motif
 * entre guillemets par ligne.
 */
function motifsDe(nom: string): string[] {
  const lignes = lire(`.claude/rules/${nom}`).split('\n')
  assert.equal(lignes[0], '---', `${nom} : l'en-tête ouvre le fichier`)
  assert.equal(lignes[1], 'paths:', `${nom} : une règle sans paths: se chargerait à chaque session — sa place serait CLAUDE.md`)
  const motifs: string[] = []
  for (const ligne of lignes.slice(2)) {
    if (ligne === '---') {
      assert.ok(motifs.length > 0, `${nom} : aucun motif`)
      return motifs
    }
    const m = /^ {2}- "([^"]+)"$/.exec(ligne)
    assert.ok(m, `${nom} : « ${ligne} » — un motif par ligne, entre guillemets`)
    motifs.push(m[1])
  }
  assert.fail(`${nom} : l'en-tête ne se ferme pas`)
}

/** `a/{b,c}.ts` devient `a/b.ts` et `a/c.ts`, comme Claude Code développe les accolades. */
function developper(motif: string): string[] {
  const m = /\{([^{}]*)\}/.exec(motif)
  if (!m) return [motif]
  return m[1].split(',').flatMap(choix => developper(motif.slice(0, m.index) + choix + motif.slice(m.index + m[0].length)))
}

function versRegExp(motif: string): RegExp {
  let source = ''
  for (let i = 0; i < motif.length; i++) {
    const c = motif[i]
    if (c === '*' && motif[i + 1] === '*') {
      // `**/` : n'importe quels dossiers, aucun compris ; `**` en bout : tout.
      if (motif[i + 2] === '/') {
        source += '(?:.*/)?'
        i += 2
      } else {
        source += '.*'
        i += 1
      }
    } else if (c === '*') source += '[^/]*'
    else if (c === '?') source += '[^/]'
    else source += c.replace(/[.+^$()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${source}$`)
}

test('la racine tient en moins de 200 lignes', () => {
  const texte = lire('CLAUDE.md')
  const lignes = texte.split('\n').length
  // Une connaissance de plus va dans la règle de son domaine : la racine ne
  // grandit que d'une commande, d'un invariant ou d'une convention de tout le
  // dépôt. Si elle doit vraiment grandir, c'est une décision : on la dit.
  assert.ok(lignes <= 200, `CLAUDE.md fait ${lignes} lignes`)
  assert.ok(texte.length <= 24_000, `CLAUDE.md fait ${texte.length} caractères`)
})

test('chaque règle a un en-tête paths: que Claude Code sait lire', () => {
  assert.ok(REGLES.length > 0)
  for (const nom of REGLES) motifsDe(nom)
})

test('chaque motif de chaque règle désigne au moins un fichier', () => {
  // Un fichier renommé laisserait sa règle muette : elle ne se chargerait
  // plus jamais, et personne ne s'en apercevrait. Chaque branche d'accolade
  // compte à part — une coquille dans `{jour,rapels}` ne se cache pas derrière
  // sa voisine.
  for (const nom of REGLES) {
    for (const motif of motifsDe(nom)) {
      for (const branche of developper(motif)) {
        const re = versRegExp(branche)
        assert.ok(FICHIERS.some(f => re.test(f)), `${nom} : « ${branche} » ne désigne aucun fichier`)
      }
    }
  }
})

test('la carte de la racine nomme chaque règle, et rien qu\'elles', () => {
  const nommees = new Set(
    lire('CLAUDE.md')
      .split('\n')
      .filter(l => l.startsWith('| '))
      .flatMap(l => [...l.matchAll(/`([a-z0-9-]+\.md)`/g)].map(m => m[1])),
  )
  assert.deepEqual([...nommees].sort(), REGLES, 'la carte de CLAUDE.md et .claude/rules/ divergent')
})

test('chaque fichier cité par la mémoire existe encore', () => {
  // Les chemins s'écrivent courts dans la mémoire : `core/…` pour
  // `server/src/core/…`, `components/…` pour `client/src/components/…`.
  const PREFIXES = ['', 'server/src/', 'client/src/', 'server/', 'client/', 'client/src/components/', 'shared/']
  // Ce que le build fabrique : cité à bon droit, jamais dans le dépôt.
  const CONSTRUITS = new Set(['dist/index.mjs', 'server/dist/index.mjs'])
  const memoire = [
    'CLAUDE.md',
    ...REGLES.map(f => `.claude/rules/${f}`),
    ...readdirSync(path.join(racine, '.claude/skills')).map(d => `.claude/skills/${d}/SKILL.md`),
    ...readdirSync(path.join(racine, '.claude/agents')).map(f => `.claude/agents/${f}`),
  ]
  const fichiers = new Set(FICHIERS)
  const perdus: string[] = []
  for (const doc of memoire) {
    const ici = path.posix.dirname(doc) + '/'
    for (const [, cite] of lire(doc).matchAll(/`([^`\s]+)`/g)) {
      // Un chemin de fichier, pas un motif, un gabarit (`<clé>`), une adresse
      // (`/api/…`) ni un dossier hors du dépôt.
      if (!cite.includes('/') || !/\.(tsx?|mjs|js|css|md|json|sh|ya?ml|svg|txt)$/.test(cite)) continue
      if (/[*<>…{}$:]/.test(cite) || cite.startsWith('/') || cite.startsWith('../') || cite.startsWith('export/')) continue
      if (CONSTRUITS.has(cite)) continue
      if (![...PREFIXES, ici].some(p => fichiers.has(path.posix.normalize(p + cite)))) perdus.push(`${doc} → ${cite}`)
    }
  }
  assert.deepEqual(perdus, [], 'des fichiers cités ont disparu ou changé de nom')
})
