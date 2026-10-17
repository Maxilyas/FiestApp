// Le compte rendu de `npm test` en CI (`server/scripts/tests.mjs`) : le
// journal d'une exécution se lit par sa fin — GitHub n'en rend que les cinq
// mille dernières lignes, et le TAP de toute la suite en fait quinze mille.
// Le 17 octobre 2026, deux exécutions rouges d'une épreuve sur 1 754 n'ont
// pas pu dire laquelle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

test('en CI, le TAP reste tel quel, et les épreuves en échec se redisent après le décompte', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-compte-rendu-'))
  const fichier = path.join(dir, 'exemple.test.ts')
  writeFileSync(
    fichier,
    [
      "import { test } from 'node:test'",
      "import assert from 'node:assert/strict'",
      "test('une épreuve qui passe', () => {})",
      "test('une épreuve qui échoue', () => assert.equal(1, 2, 'le motif de l’échec'))",
      '',
    ].join('\n'),
  )
  try {
    // Lancé par Claude Code, le compte rendu serait en points : la CI ne pose
    // que `CI`. Et `node --test` lancé d'une épreuve ne lance rien, s'il sait
    // qu'il y est (`NODE_TEST_CONTEXT`).
    const { CLAUDECODE: _claude, NODE_TEST_CONTEXT: _contexte, ...env } = process.env
    const lance = spawnSync(process.execPath, ['scripts/tests.mjs', fichier], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...env, CI: 'true' },
      encoding: 'utf8',
    })
    assert.equal(lance.status, 1, lance.stderr)
    const sortie = lance.stdout
    assert.match(sortie, /^not ok \d+ - une épreuve qui échoue$/m, 'le TAP d’avant, épreuve par épreuve')
    const fin = sortie.slice(sortie.lastIndexOf('# fail'))
    assert.match(fin, /Failed tests:[\s\S]*une épreuve qui échoue[\s\S]*le motif de l’échec/, 'l’échec redit en entier, à la fin du journal')
    assert.doesNotMatch(fin, /une épreuve qui passe/, 'les autres n’y sont pas')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
