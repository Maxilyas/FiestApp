// Le démarrage ordinaire (rien à migrer, rien à recalculer), avant et après
// les PR #58 et #59 : combien d'allers-retours vers la base permanente avant
// d'ouvrir le port, et ce que cela fait à 50 ms l'aller-retour. Le code
// d'avant est `a6fc98b`, extrait par `git archive` dans `avant/`.
//   cd server && nice -n 10 node --import tsx --test --test-timeout=300000 ../export/evaluations/perf-serveur/demarrage.test.ts
import { test } from 'node:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { mesurer, type Mesure } from './compteur'
import { createQuizServer as apres } from '../../../server/src/server'
import { createQuizServer as avant } from './avant/server/src/server'

const ADMIN = { login: 'antoine', password: 'banc-pass-1', slug: 'banc', name: 'Antoine' }

async function deuxDemarrages(nom: string, creer: typeof apres): Promise<Mesure[]> {
  const dir = mkdtempSync(path.join(tmpdir(), 'perf-demarrage-'))
  const opts = { port: 0, dbPath: path.join(dir, 'locale.db'), quizDbUrl: `file:${path.join(dir, 'permanente.db')}`, admin: ADMIN }
  try {
    const premier = await mesurer(`${nom} — premier démarrage (base vide)`, () => creer(opts), 50)
    await premier.resultat.close()
    const second = await mesurer(`${nom} — démarrage ordinaire`, () => creer(opts), 50)
    await second.resultat.close()
    return [premier.mesure, second.mesure]
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('le démarrage ordinaire, avant et après #58 et #59', async () => {
  const charge = execSync('uptime').toString().trim()
  const mesures = [...(await deuxDemarrages('a6fc98b (avant #58)', avant as typeof apres)), ...(await deuxDemarrages('b57035c (aujourd’hui)', apres))]
  const parFichier = (m: Mesure) => {
    const f: Record<string, number> = {}
    for (const [k, v] of Object.entries(m.parAppelant)) {
      const fichier = /\(([^:]+):/.exec(k)?.[1] ?? '?'
      f[fichier] = (f[fichier] ?? 0) + v
    }
    return f
  }
  const sortie = { charge, mesures: mesures.map(m => ({ quoi: m.quoi, appels: m.appels, enSerie: m.enSerie, ms: m.ms, parFichier: parFichier(m) })) }
  console.log(JSON.stringify(sortie, null, 1))
  writeFileSync(new URL('./mesures-demarrage.json', import.meta.url), JSON.stringify(sortie, null, 1))
})
