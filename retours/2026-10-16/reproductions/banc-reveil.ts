// Le banc du réveil (l'étape 3) : la base de la campagne relue et vérifiée,
// comme le faisait chaque démarrage, contre la base vérifiée au build et
// relue telle quelle — le temps, le processeur, le plus long bloc de la
// boucle et le nombre de fois où elle reprend la main.
//
// Compilé comme en production (voir `banc-tirage.ts`), depuis `server/` :
//
//   npx esbuild ../retours/2026-10-16/reproductions/banc-reveil.ts --bundle --platform=node \
//     --format=esm --packages=external --outfile=../export/banc/banc-reveil.mjs && node ../export/banc/banc-reveil.mjs
import path from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import { lireLaBasePreparee, lireLaBaseSansBloquer, preparerLaBase } from '../../../server/src/core/baseCampagne'

const DOSSIER = path.resolve(process.env.DOSSIER ?? 'content/campagne')
const dir = mkdtempSync(path.join(tmpdir(), 'banc-reveil-'))
const PREPAREE = path.join(dir, 'index.campagne.ndjson')
preparerLaBase(PREPAREE, DOSSIER)

const processeur = () => {
  const c = process.cpuUsage()
  return (c.user + c.system) / 1000
}

async function mesurer(nom: string, f: () => Promise<unknown>) {
  let tours = 0
  let fini = false
  const tourner = () => {
    if (fini) return
    tours++
    setImmediate(tourner)
  }
  setImmediate(tourner)
  const boucle = monitorEventLoopDelay({ resolution: 1 })
  boucle.enable()
  const c = processeur()
  const t = performance.now()
  await f()
  fini = true
  boucle.disable()
  console.log(
    `${nom.padEnd(30)} ${(performance.now() - t).toFixed(0).padStart(5)} ms · processeur ${(processeur() - c).toFixed(0).padStart(5)} ms · plus long bloc ${(boucle.max / 1e6).toFixed(0).padStart(3)} ms · ${tours} tours`,
  )
}

try {
  for (let i = 0; i < 2; i++) {
    await mesurer('relue et vérifiée (le juge)', () => lireLaBaseSansBloquer(DOSSIER))
    await mesurer('vérifiée au build, relue', () => lireLaBasePreparee(PREPAREE, DOSSIER))
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}
