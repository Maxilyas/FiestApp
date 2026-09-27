// Reproduction : deux épreuves de la suite échouent pendant les saisons.
//
// Une soirée jouée pour de vrai se date à sa première question, à l'horloge
// du serveur (`laureatsDeSaison`, `core/saisons.ts`). Du 25 octobre au
// 1er novembre, du 20 au 26 décembre et du 30 décembre au 2 janvier (Paris),
// chaque soirée close à deux ouvre donc le légendaire de la saison à ses
// profils — y compris dans les tests, qui ne règlent pas cette horloge-là :
//
//   cloture.test.ts  « clore la soirée : chaque téléphone reçoit sa fin… »
//                    attend ['lg:chouette'], reçoit ['lg:chouette', 'lg:citrouille']
//   soiree.test.ts   « les prix ne se décident qu’à la clôture… »
//                    « saison:halloween » : 2 lauréats pour une seule soirée
//
// Le 25 octobre 2026, la CI de toute PR passera au rouge sans que rien n'ait
// changé — dix-neuf jours par an. Cette épreuve rejoue les deux fichiers à une
// autre date (`decale.mjs` décale Date.now et new Date(), pas les minuteurs) ;
// elle passera le jour où la suite ne dépendra plus du calendrier.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=300000 \
//     ../export/evaluations/tests/calendrier.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const SERVEUR = path.resolve(ICI, '../../../server')

/** L'environnement du fichier rejoué : sa date, et pas celui du lanceur de tests qui nous fait tourner. */
function environnement(date: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, DATE_CIBLE: date }
  // Lancé par `node --test`, ce processus porte NODE_TEST_CONTEXT : un
  // `node --test` enfant qui en hérite se croit rapporteur de son parent et
  // ne lance rien — l'épreuve passerait sans rien avoir joué.
  delete env.NODE_TEST_CONTEXT
  delete env.DECALAGE_MS
  return env
}

function jouerA(date: string, fichier: string, epreuve: string) {
  const r = spawnSync(
    'node',
    [
      '--import',
      path.join(ICI, 'decale.mjs'),
      '--import',
      'tsx',
      '--test',
      '--test-timeout=120000',
      `--test-name-pattern=${epreuve}`,
      `test/${fichier}`,
    ],
    { cwd: SERVEUR, env: environnement(date), encoding: 'utf8', timeout: 240_000 },
  )
  if (r.error) throw r.error
  const echecs = r.stdout
    .split('\n')
    .filter(l => /^\s*(not ok|error:|\+ |« saison)/.test(l))
    .join('\n')
  // Une épreuve jouée au moins : sans elle, « ok » ne voudrait rien dire.
  assert.match(r.stdout, /^# tests [1-9]/m, `rien n’a été joué :\n${r.stdout.slice(-400)}${r.stderr.slice(-400)}`)
  return { ok: r.status === 0, echecs }
}

for (const [saison, date] of [
  ['Halloween', '2026-10-31T19:00:00Z'],
  ['Noël', '2026-12-24T19:00:00Z'],
]) {
  test(`la suite passe aussi à ${saison} : la clôture et les prix ne dépendent pas du calendrier`, () => {
    const cloture = jouerA(date, 'cloture.test.ts', 'clore la soirée : chaque téléphone')
    const prix = jouerA(date, 'soiree.test.ts', 'les prix ne se décident qu’à la clôture')
    assert.ok(cloture.ok, `cloture.test.ts à ${saison} :\n${cloture.echecs}`)
    assert.ok(prix.ok, `soiree.test.ts à ${saison} :\n${prix.echecs}`)
  })
}

test('témoin : les mêmes épreuves passent le 2 novembre', () => {
  const prix = jouerA('2026-11-02T19:00:00Z', 'soiree.test.ts', 'les prix ne se décident qu’à la clôture')
  assert.ok(prix.ok, prix.echecs)
})
