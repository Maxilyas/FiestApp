// Le ramasse-miettes du serveur, réglé par la commande de démarrage (le banc
// du 19 octobre 2026) : au dixième de cœur de l'hébergeur, en parallèle et
// avec son réducteur de mémoire, il figeait le serveur 1,9 s juste après le
// recalcul de la mesure et du modèle du savoir. `NODE_OPTIONS` refuse ses
// drapeaux : seule la commande de démarrage les pose, et `/healthz` dit s'ils
// ont pris. Le serveur empaqueté, lancé comme chez l'hébergeur, le vérifie
// aussi (`exploitation.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getHeapStatistics } from 'node:v8'
import { DRAPEAUX_DU_RAMASSE_MIETTES, ramasseMiettes } from '../src/core/pouls'
import { SERVEUR } from '../src/racine'
import { demarrer } from './banc'

const MO = 1024 * 1024

test('la commande de démarrage recopiée dans render.yaml et la mise en ligne porte les drapeaux du ramasse-miettes', () => {
  // Le tableau de bord de chaque service fait foi : ces deux textes sont ce qu'on y recopie.
  const commande = `cd server && exec node ${DRAPEAUX_DU_RAMASSE_MIETTES.join(' ')} dist/index.mjs`
  const racine = path.join(SERVEUR, '..')
  const render = readFileSync(path.join(racine, 'render.yaml'), 'utf8')
  assert.deepEqual(
    [...render.matchAll(/startCommand: (.+)/g)].map(m => m[1].trim()),
    [commande, commande],
    'les deux services de render.yaml',
  )
  assert.ok(readFileSync(path.join(racine, 'docs/exploitation/mise-en-ligne.md'), 'utf8').includes('`' + commande + '`'), 'la mise en ligne')
  assert.deepEqual(ramasseMiettes(DRAPEAUX_DU_RAMASSE_MIETTES, 0), { unFil: true, reducteur: false, tasMaxMo: 0 })
})

test('le ramasse-miettes se lit dans les drapeaux du démarrage, comme V8 les lit', () => {
  assert.deepEqual(ramasseMiettes([], 8195 * MO), { unFil: false, reducteur: true, tasMaxMo: 8195 })
  assert.deepEqual(ramasseMiettes(['--single-threaded-gc', '--no-memory-reducer', '--max-old-space-size=320'], 320 * MO + 12_345), {
    unFil: true,
    reducteur: false,
    tasMaxMo: 320,
  })
  // Les soulignés valent des tirets, et `--single-threaded` coupe tous les fils d'aide, ceux du ramasse-miettes compris.
  assert.deepEqual(ramasseMiettes(['--single_threaded_gc', '--no_memory_reducer'], 0), { unFil: true, reducteur: false, tasMaxMo: 0 })
  assert.equal(ramasseMiettes(['--single-threaded'], 0).unFil, true)
  // Un autre drapeau, ou un argument du script, ne dit rien du ramasse-miettes.
  assert.deepEqual(ramasseMiettes(['--import', 'tsx', '--expose-gc'], 0), { unFil: false, reducteur: true, tasMaxMo: 0 })
})

test('/healthz dit comment V8 ramasse ses miettes, et le tas qu’il s’accorde', async () => {
  const banc = await demarrer()
  try {
    const sante = (await (await fetch(`${banc.url}/healthz`)).json()) as { memoire: Record<string, unknown> }
    // Le processus des tests n'a aucun drapeau : en parallèle, avec son réducteur, le tas de sa règle.
    assert.deepEqual(sante.memoire.ramasseMiettes, { unFil: false, reducteur: true })
    assert.equal(sante.memoire.tasMaxMo, Math.round(getHeapStatistics().heap_size_limit / MO))
    assert.deepEqual(Object.keys(sante.memoire).sort(), ['connexions', 'ramasseMiettes', 'tasMaxMo', 'tasMo'])
  } finally {
    await banc.close()
  }
})
