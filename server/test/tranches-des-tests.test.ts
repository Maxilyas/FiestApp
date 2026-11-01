// Les tests de la CI se répartissent sur quatre machines (le 1er novembre
// 2026 : une seule prenait 14 min 46, et la borne de quinze minutes coupait
// le smoke des PR qui ajoutaient des tests). Le découpage ne doit rien
// perdre : chaque fichier de `server/test/` dans une tranche et une seule,
// chaque tranche lancée par la CI, et la vérification qui garde son nom
// (`verifier`) rouge dès qu'une tranche l'est — sautée, une vérification
// passe pour réussie aux yeux de GitHub.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const serveur = fileURLToPath(new URL('..', import.meta.url))
const tousLesFichiers = readdirSync(new URL('.', import.meta.url))
  .filter(f => f.endsWith('.test.ts'))
  .sort()
  .map(f => `test/${f}`)

/** Ce que `tests.mjs` lancerait, sans rien lancer (`--liste`) ; `node --test` lancé d'une épreuve ne lance rien. */
function lance(...args: string[]) {
  const { NODE_TEST_CONTEXT: _contexte, ...env } = process.env
  return spawnSync(process.execPath, ['scripts/tests.mjs', ...args], { cwd: serveur, env, encoding: 'utf8' })
}
/**
 * La liste entière : sous la charge, elle s'arrêtait une fois sur trois au
 * milieu, code 0, quand le script sortait par `process.exit()` derrière son
 * écriture — ce test la relit dix-neuf fois, au milieu des autres fichiers.
 */
function liste(...args: string[]): string[] {
  const r = lance(...args, '--liste')
  assert.equal(r.status, 0, r.stderr)
  return r.stdout.split('\n').filter(Boolean)
}

test('chaque fichier de server/test/ dans une tranche et une seule, quel que soit leur nombre', () => {
  assert.ok(tousLesFichiers.length > 300, `seulement ${tousLesFichiers.length} fichiers lus`)
  assert.deepEqual(liste(), tousLesFichiers, 'sans tranche, tous, dans l’ordre des noms')
  for (const tranches of [2, 3, 4, 7]) {
    const vus = Array.from({ length: tranches }, (_, i) => liste(`--tranche=${i + 1}/${tranches}`))
    assert.deepEqual([...vus.flat()].sort(), tousLesFichiers, `${tranches} tranches : tous les fichiers, chacun une fois`)
    // À tour de rôle : jamais plus d'un fichier d'écart d'une tranche à l'autre.
    const tailles = vus.map(v => v.length)
    assert.ok(Math.max(...tailles) - Math.min(...tailles) <= 1, `${tranches} tranches : ${tailles.join(', ')}`)
  }
  // Des fichiers nommés se découpent de même : les deux de la première tranche, le troisième dans la seconde.
  assert.deepEqual(liste('test/a.test.ts', 'test/b.test.ts', 'test/c.test.ts', '--tranche=1/2'), ['test/a.test.ts', 'test/c.test.ts'])
  assert.deepEqual(liste('test/a.test.ts', '--tranche=2/2'), [])
})

test('une tranche illisible ou une option inconnue se refusent en mots, sans rien lancer', () => {
  for (const faux of ['--tranche=5/4', '--tranche=0/4', '--tranche=deux/4', '--tranche=2', '--tranches=2/4']) {
    const r = lance(faux)
    assert.equal(r.status, 2, faux)
    assert.match(r.stderr, /écris --tranche=2\/4|seules --tranche=2\/4 et --liste existent/, faux)
  }
  // Une tranche vide ne lance pas `node --test` sans fichier, qui chercherait ses propres motifs partout.
  const vide = lance('test/a.test.ts', '--tranche=2/2')
  assert.equal(vide.status, 0)
  assert.match(vide.stdout, /Tranche 2\/2 : aucun fichier\./)
})

test('la CI lance chaque tranche, et `verifier` ne passe que si les tranches et le bout en bout sont passés', () => {
  const ci = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const total = /--tranche=\$\{\{ matrix\.tranche \}\}\/(\d+)/.exec(ci)?.[1]
  assert.ok(total, 'la commande des tests porte sa tranche')
  const matrice = /^\s+tranche: \[([\d, ]+)\]$/m.exec(ci)?.[1].split(',').map(n => Number(n.trim()))
  assert.deepEqual(matrice, Array.from({ length: Number(total) }, (_, i) => i + 1), 'une machine par tranche, de 1 au total')
  assert.match(ci, /^\s+fail-fast: false$/m, 'une tranche qui échoue laisse les autres dire leurs échecs')
  // Le typecheck, le build et le smoke ont gardé leur place.
  for (const etape of ['npm run check', 'npm run build', 'npm run smoke']) assert.match(ci, new RegExp(`run: ${etape}$`, 'm'), etape)
  // `verifier` attend tout le reste, se juge même quand une tranche échoue, et rougit avec elle.
  const verifier = ci.slice(ci.indexOf('\n  verifier:'))
  assert.match(verifier, /needs: \[tests, bout-en-bout\]/)
  assert.match(verifier, /if: always\(\)/)
  assert.match(verifier, /test "\$\{\{ needs\.tests\.result \}\}" = success/)
  assert.match(verifier, /test "\$\{\{ needs\.bout-en-bout\.result \}\}" = success/)
  // Rien d'autre ne vient après lui : un job oublié de ses `needs` n'en serait pas gardé.
  const jobs = [...ci.slice(ci.indexOf('\njobs:')).matchAll(/^ {2}([a-z-]+):$/gm)].map(m => m[1])
  assert.deepEqual(jobs, ['tests', 'bout-en-bout', 'verifier'])
})
