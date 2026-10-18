// La base de la campagne vérifiée au build (le banc du 16 octobre 2026,
// `retours/2026-10-16/`, perf-gel-9) : à chaque réveil, le serveur repassait
// ses vingt-quatre mille questions au juge — 1,3 s de processeur, treize
// secondes de serveur saturé au dixième de cœur de l'hébergeur, trois à
// onze fois par jour —, pour une base qui n'avait pas changé depuis le
// build. `npm run build` la vérifie une fois et la range à côté du paquet
// (`preparerLaBase`) ; le paquet la relit telle quelle, ligne par ligne
// (`lireLaBasePreparee`), et se replie sur le dossier quand elle ne le dit
// plus.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { BaseDeLaCampagne, DOSSIER_DE_LA_BASE, lireLaBase, lireLaBasePreparee, preparerLaBase } from '../src/core/baseCampagne'

/** Un dossier jetable : une base d'une seule catégorie, les trente premières questions de l'histoire, une par ligne comme le dépôt les range. */
function petiteBase(): { dossier: string; preparee: string; effacer: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-base-'))
  const dossier = path.join(dir, 'campagne')
  mkdirSync(dossier)
  const lignes = readFileSync(path.join(DOSSIER_DE_LA_BASE, 'histoire.json'), 'utf8').trimEnd().split('\n')
  const trente = lignes.slice(1, 31).map(l => l.replace(/,$/, ''))
  writeFileSync(path.join(dossier, 'histoire.json'), `[\n${trente.join(',\n')}\n]\n`)
  return { dossier, preparee: path.join(dir, 'index.campagne.ndjson'), effacer: () => rmSync(dir, { recursive: true, force: true }) }
}

test('la base préparée au build se relit telle quelle : les mêmes questions, dans le même ordre, que le juge les a rendues', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-base-'))
  const preparee = path.join(dir, 'index.campagne.ndjson')
  try {
    const verifiee = preparerLaBase(preparee)
    assert.ok(verifiee.questions.length > 20_000)
    // Et la boucle reprend la main au fil du fichier : un seul JSON.parse de
    // ses vingt-cinq mégaoctets figerait le serveur deux secondes au dixième
    // de cœur.
    let tours = 0
    let lue = false
    const tourner = () => {
      if (lue) return
      tours++
      setImmediate(tourner)
    }
    setImmediate(tourner)
    const relue = await lireLaBasePreparee(preparee)
    lue = true
    assert.ok('lue' in relue, 'motif' in relue ? relue.motif : '')
    assert.deepStrictEqual(relue.lue.questions, verifiee.questions)
    assert.deepStrictEqual(relue.lue.refusees, verifiee.refusees)
    assert.ok(tours >= 100, `${tours} tours de boucle pendant la lecture`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('le juge ne repasse pas : le build l’a déjà été', async () => {
  const { dossier, preparee, effacer } = petiteBase()
  try {
    preparerLaBase(preparee, dossier)
    // Une ligne que le juge refuserait — un intitulé trop court —, glissée après le build.
    const entorse = { ...JSON.parse(readFileSync(preparee, 'utf8').split('\n')[1]), id: 'zzzzzzzz', texte: 'Court ?' }
    appendFileSync(preparee, `${JSON.stringify(entorse)}\n`)
    const relue = await lireLaBasePreparee(preparee, dossier)
    assert.ok('lue' in relue)
    assert.equal(relue.lue.questions.length, 31)
    assert.equal(relue.lue.questions.at(-1)?.id, 'zzzzzzzz')
  } finally {
    effacer()
  }
})

test('une base préparée qui ne dit plus le dossier s’écarte, et le serveur relit et vérifie le dossier', async () => {
  const { dossier, preparee, effacer } = petiteBase()
  const avertissements: string[] = []
  const warn = console.warn
  console.warn = (...args: unknown[]) => avertissements.push(args.join(' '))
  try {
    assert.deepEqual(await lireLaBasePreparee(preparee, dossier), { motif: 'absente' })
    preparerLaBase(preparee, dossier)
    assert.ok('lue' in (await lireLaBasePreparee(preparee, dossier)))
    // Un autre format : un paquet d'avant, ou d'après.
    const texte = readFileSync(preparee, 'utf8')
    writeFileSync(preparee, texte.replace('{"version":1,', '{"version":0,'))
    assert.deepEqual(await lireLaBasePreparee(preparee, dossier), { motif: 'format 0' })
    writeFileSync(preparee, `${texte.split('\n')[0]}\n{"id":`)
    const illisible = await lireLaBasePreparee(preparee, dossier)
    assert.ok('motif' in illisible && illisible.motif.startsWith('illisible'), JSON.stringify(illisible))
    writeFileSync(preparee, '')
    assert.deepEqual(await lireLaBasePreparee(preparee, dossier), { motif: 'vide' })
    // Un fichier de la base qui change après le build : une question de moins.
    preparerLaBase(preparee, dossier)
    const fichier = path.join(dossier, 'histoire.json')
    const lignes = readFileSync(fichier, 'utf8').trimEnd().split('\n')
    writeFileSync(fichier, `${[...lignes.slice(0, -3), lignes.at(-3)!.replace(/,$/, ''), lignes.at(-1)].join('\n')}\n`)
    assert.deepEqual(await lireLaBasePreparee(preparee, dossier), { motif: 'le dossier a changé depuis le build' })
    const base = await BaseDeLaCampagne.depuisLeDossier(dossier, preparee)
    assert.equal(base.questions.length, 29, 'le dossier relu et vérifié, tel qu’il est')
    assert.deepStrictEqual(base.questions, lireLaBase(dossier).questions)
    assert.ok(avertissements.some(a => /base préparée écartée \(le dossier a changé depuis le build\)/.test(a)), avertissements.join('\n'))
  } finally {
    console.warn = warn
    effacer()
  }
})
