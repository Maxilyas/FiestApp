// Chaque fichier de `server/test/` a sa ligne dans `docs/contribuer/tests.md`,
// la liste rangée par thème où l'on cherche le fichier d'une épreuve neuve.
//
// La page le demandait (« Un fichier neuf y prend sa ligne dans le commit qui
// le crée »), et rien ne le gardait : le 26 octobre 2026, quatre-vingt-dix-huit
// fichiers n'y avaient pas la leur — l'Expédition et le Cabinet de curiosités
// entiers —, et une épreuve neuve sur ces thèmes ne trouvait pas son fichier.
// `documentation.test.ts` ne lit que l'autre sens : un fichier cité qui
// n'existe plus. Ici, chaque fichier a sa puce sous son thème, une seule ;
// seules les trois aides de tous, que la page décrit chacune en tête de son
// paragraphe (« Les trois aides »), s'en passent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const page = readFileSync(path.join(racine, 'docs/contribuer/tests.md'), 'utf8')

/** Une section de la page, de son titre au titre suivant du même rang. */
function section(titre: string): string {
  const debut = page.indexOf(`\n## ${titre}\n`)
  assert.ok(debut >= 0, `la section « ${titre} » de docs/contribuer/tests.md`)
  const fin = page.indexOf('\n## ', debut + 1)
  return page.slice(debut, fin < 0 ? undefined : fin)
}

/** Les puces de la liste par thème — « - `server/test/<nom>` — ce qu'il garde » —, dans l'ordre. */
const PUCES = [...section('Les fichiers de test, par thème').matchAll(/^- `server\/test\/([^`]+)`/gm)].map(m => m[1])
/** Les aides de tous, chacune nommée en tête de son paragraphe : « `server/test/banc.ts` démarre… ». */
const AIDES = [...section('Les trois aides').matchAll(/^`server\/test\/([^`]+)`/gm)].map(m => m[1])
const FICHIERS = readdirSync(path.join(racine, 'server/test'), { withFileTypes: true })
  .filter(e => e.isFile())
  .map(e => e.name)
  .sort()

test('les trois aides de tous sont décrites, chacune en tête de son paragraphe', () => {
  assert.deepEqual([...AIDES].sort(), ['banc.ts', 'relais.ts', 'salle.ts'])
})

test('chaque fichier de server/test/ a sa ligne sous son thème, dans docs/contribuer/tests.md', () => {
  const sansLigne = FICHIERS.filter(f => !PUCES.includes(f) && !AIDES.includes(f))
  assert.deepEqual(sansLigne, [], 'chacun sa puce « - `server/test/<nom>` — ce qu’il garde », sous son thème')
})

test('une seule ligne par fichier', () => {
  assert.deepEqual(
    PUCES.filter((p, i) => PUCES.indexOf(p) !== i),
    [],
  )
})
