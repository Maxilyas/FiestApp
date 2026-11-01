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
//
// La CI le garde, et redit ses échecs à la fin : son journal se lit par la
// fin — GitHub n'en rend que les cinq mille dernières lignes, et le TAP de
// la suite en fait quinze mille. Le 17 octobre 2026, deux exécutions rouges
// d'une épreuve sur 1 754 n'ont pas pu dire laquelle.
//
// Deux options, que la CI emploie :
//   --tranche=2/4  ne lance que la deuxième tranche sur quatre — le fichier de
//                  rang i (dans l'ordre des noms) va à la tranche i modulo 4 :
//                  chaque fichier dans une tranche et une seule, quel que soit
//                  le nombre de fichiers (`tranches-des-tests.test.ts`) ;
//   --liste        écrit les fichiers qu'il lancerait, et n'en lance aucun.
//
// Le script pose son code de sortie et laisse Node finir, jamais
// `process.exit()` : vers un tuyau, ce qu'il venait d'écrire n'était pas
// toujours parti — sous la charge, une liste de 338 fichiers s'arrêtait une
// fois sur trois à la 172ᵉ, code 0 (le 1er novembre 2026), et le
// récapitulatif des échecs de la CI, écrit juste avant de sortir, risquait
// le même sort.
import { readFileSync, readdirSync, rmSync } from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function lancer() {
  const args = process.argv.slice(2)
  const nommes = args.filter(a => !a.startsWith('--'))
  const drapeaux = args.filter(a => a.startsWith('--'))
  const inconnus = drapeaux.filter(d => d !== '--liste' && !d.startsWith('--tranche='))
  if (inconnus.length > 0) {
    console.error(`Option inconnue : ${inconnus.join(' ')} — seules --tranche=2/4 et --liste existent.`)
    return 2
  }

  let [rang, tranches] = [1, 1]
  const tranche = drapeaux.find(d => d.startsWith('--tranche='))
  if (tranche) {
    const lu = /^--tranche=(\d+)\/(\d+)$/.exec(tranche)
    if (!lu || Number(lu[1]) < 1 || Number(lu[1]) > Number(lu[2])) {
      console.error(`Tranche illisible : ${tranche} — écris --tranche=2/4, de 1 au nombre de tranches.`)
      return 2
    }
    ;[rang, tranches] = [Number(lu[1]), Number(lu[2])]
  }

  // La liste se fait ici plutôt que par un motif : Node 20, que le dépôt
  // accepte encore, ne développe pas `test/*.test.ts` de lui-même.
  const tous = nommes.length > 0
    ? nommes
    : readdirSync('test').filter(f => f.endsWith('.test.ts')).sort().map(f => `test/${f}`)
  const fichiers = tous.filter((_, i) => i % tranches === rang - 1)

  if (drapeaux.includes('--liste')) {
    process.stdout.write(fichiers.map(f => `${f}\n`).join(''))
    return 0
  }
  // Sans fichier, `node --test` chercherait ses propres motifs dans tout le
  // dossier : une tranche vide ne lance rien, et le dit.
  if (fichiers.length === 0) {
    console.log(`Tranche ${rang}/${tranches} : aucun fichier.`)
    return 0
  }
  if (tranches > 1) console.log(`Tranche ${rang}/${tranches} : ${fichiers.length} fichiers sur ${tous.length}.`)

  const options = ['--import', 'tsx', '--test', '--test-timeout=120000']

  // Deux fichiers à la fois par cœur, seize au plus. Près de la moitié de la
  // suite attend de vraies minuteries — l'ouverture d'une question, le calme
  // avant sa révélation, la grâce — sans rien calculer : le 1er novembre 2026,
  // trois fichiers à la fois sur quatre cœurs (le défaut de node, un de moins
  // que de cœurs) prenaient 12 min 05 pour 21 min de processeur ; huit à la
  // fois, 6 min 21, tout passé, près du plancher de ce processeur sur quatre
  // cœurs. Seize au plus : chaque fichier démarre ses serveurs, et une grosse
  // machine en lancerait autant que sa mémoire en tient mal. `--test-concurrency`
  // n'existe que depuis Node 20.10 : avant, le défaut de node.
  const [majeure, mineure] = process.versions.node.split('.').map(Number)
  if (majeure > 20 || (majeure === 20 && mineure >= 10)) options.push(`--test-concurrency=${Math.min(16, 2 * availableParallelism())}`)

  // En CI, un second compte rendu, en points, dans un fichier : ses échecs en entier.
  const recapitulatif = !process.env.CLAUDECODE && process.env.CI ? path.join(tmpdir(), `tests-${process.pid}.txt`) : null
  if (process.env.CLAUDECODE) options.push('--test-reporter=dot')
  else if (recapitulatif) options.push('--test-reporter=tap', '--test-reporter-destination=stdout', '--test-reporter=dot', `--test-reporter-destination=${recapitulatif}`)

  const lancement = spawnSync(process.execPath, [...options, ...fichiers], { stdio: 'inherit' })
  if (lancement.error) throw lancement.error
  if (recapitulatif) {
    try {
      const lu = readFileSync(recapitulatif, 'utf8')
      const echecs = lu.indexOf('Failed tests:')
      if (echecs >= 0) process.stdout.write(`\n${lu.slice(echecs)}`)
      rmSync(recapitulatif, { force: true })
    } catch {
      // Sans récapitulatif, le TAP dit déjà tout : il n'empêche rien.
    }
  }
  // Tué par un signal, il n'a pas de code : c'est un échec, pas un succès.
  return lancement.status ?? 1
}

process.exitCode = lancer()
