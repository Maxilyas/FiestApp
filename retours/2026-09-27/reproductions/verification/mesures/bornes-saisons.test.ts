// Contre-expertise de tests-1 : la suite rougit-elle vraiment pendant les
// saisons, et à partir de quand exactement ?
//
// 1. Le calendrier, en pur : combien de jours de Paris, sur une année, font
//    tomber une saison (`periodeDu`) — l'expert en annonce dix-neuf.
// 2. La borne du 25 octobre, sur la vraie épreuve de `cloture.test.ts` :
//    rejouée à 23 h 30 le 24 octobre (heure de Paris) puis à 0 h 30 le 25. Le
//    premier passage sert aussi de témoin : la même épreuve, sous la même
//    horloge décalée, passe hors saison — ce n'est pas le décalage qui la casse.
// 3. La dernière heure du Nouvel An (le 2 janvier à 23 h 30, Paris) sur
//    l'épreuve des prix de `soiree.test.ts` : l'expert ne l'a jouée que le 31.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=600000 \
//     ../export/evaluations/verification/mesures/bornes-saisons.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { periodeDu } from '../../../../shared/saisons'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const SERVEUR = path.resolve(ICI, '../../../../server')

test('le calendrier : dix-neuf jours par an, du 25 octobre au 2 janvier', () => {
  const jours: string[] = []
  // Du 3 janvier 2026 au 2 janvier 2027 : une année entière, un seul Nouvel An.
  for (let t = Date.UTC(2026, 0, 3, 12); t <= Date.UTC(2027, 0, 2, 12); t += 86_400_000) {
    const jour = new Date(t).toISOString().slice(0, 10)
    if (periodeDu(jour)) jours.push(jour)
  }
  assert.equal(jours.length, 19)
  assert.equal(jours[0], '2026-10-25')
  assert.equal(jours.at(-1), '2027-01-02')
})

function jouerA(instant: number, fichier: string, epreuve: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, INSTANT_VISE_MS: String(instant) }
  // Hérité, NODE_TEST_CONTEXT ferait de l'enfant un rapporteur muet.
  delete env.NODE_TEST_CONTEXT
  delete env.ECART_MS
  const r = spawnSync(
    'node',
    ['--import', path.join(ICI, 'horloge.mjs'), '--import', 'tsx', '--test', '--test-timeout=120000', `--test-name-pattern=${epreuve}`, `test/${fichier}`],
    { cwd: SERVEUR, env, encoding: 'utf8', timeout: 240_000 },
  )
  if (r.error) throw r.error
  assert.match(r.stdout, /^# tests 1$/m, `une seule épreuve doit avoir été jouée :\n${r.stdout.slice(-600)}`)
  const pourquoi = r.stdout
    .split('\n')
    .filter(l => /^\s*(not ok|\+ |- |« saison)|lauréats|lg:/.test(l))
    .join('\n')
  return { passe: r.status === 0, pourquoi }
}

const CLOTURE = ['cloture.test.ts', 'clore la soirée : chaque téléphone'] as const
const PRIX = ['soiree.test.ts', 'les prix ne se décident qu’à la clôture'] as const

test('témoin : le 24 octobre à 23 h 30 (Paris), la clôture passe sous l’horloge décalée', () => {
  const r = jouerA(Date.UTC(2026, 9, 24, 21, 30), ...CLOTURE)
  assert.ok(r.passe, r.pourquoi)
})

test('le 25 octobre à 0 h 30 (Paris), la même épreuve de clôture passe encore', () => {
  const r = jouerA(Date.UTC(2026, 9, 24, 22, 30), ...CLOTURE)
  assert.ok(r.passe, `cloture.test.ts, une heure plus tard :\n${r.pourquoi}`)
})

test('le 2 janvier à 23 h 30 (Paris), l’épreuve des prix passe encore', () => {
  const r = jouerA(Date.UTC(2027, 0, 2, 22, 30), ...PRIX)
  assert.ok(r.passe, `soiree.test.ts, le dernier soir du Nouvel An :\n${r.pourquoi}`)
})

test('le 3 janvier à 0 h 30 (Paris), l’épreuve des prix passe', () => {
  const r = jouerA(Date.UTC(2027, 0, 2, 23, 30), ...PRIX)
  assert.ok(r.passe, r.pourquoi)
})
