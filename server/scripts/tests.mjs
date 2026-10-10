// Lance les tests de server/test/ avec node:test (`npm test`), ou ceux qu'on
// lui nomme : `node scripts/tests.mjs test/miroir.test.ts`.
//
// Quand c'est Claude Code qui les lance — il pose CLAUDECODE=1 dans chacune de
// ses commandes —, le compte rendu passe en `dot` : un point par épreuve, et
// les échecs en entier à la fin. Hors d'un terminal, node:test écrit en TAP :
// 500 Ko pour toute la suite, et d'une commande qui échoue, Claude Code ne
// rend que 10 000 caractères pris dans les 30 000 premiers — l'épreuve en
// échec n'y était jamais, et il fallait relancer neuf minutes de tests pour
// la trouver. Un terminal et la CI gardent l'affichage d'avant.
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

// La liste se fait ici plutôt que par un motif : Node 20, que le dépôt
// accepte encore, ne développe pas `test/*.test.ts` de lui-même.
const nommes = process.argv.slice(2)
const fichiers = nommes.length > 0
  ? nommes
  : readdirSync('test').filter(f => f.endsWith('.test.ts')).sort().map(f => `test/${f}`)

const options = ['--import', 'tsx', '--test', '--test-timeout=120000']
if (process.env.CLAUDECODE) options.push('--test-reporter=dot')

const lancement = spawnSync(process.execPath, [...options, ...fichiers], { stdio: 'inherit' })
if (lancement.error) throw lancement.error
// Tué par un signal, il n'a pas de code : c'est un échec, pas un succès.
process.exit(lancement.status ?? 1)
