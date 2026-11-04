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
import { BaseDeLaCampagne, DOSSIER_DE_LA_BASE, lireLaBase, lireLaBasePreparee, preparerLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { parCoeurCalcule, parCoeurDe, sujetsDeLaQuestion } from '../src/core/campagne'
import { motsDeLaCategorie, qcmDeLaCategorie, verdictCalcule } from '../src/core/cabinet/tirages/tas'
import { jumelles, signeAPreparer, signeDe } from '../src/core/jumelles'
import { preparationDeLaQuestion } from '../src/core/preparationDeLaBase'
import { QCM_DU_CABINET, preparationDe, type PreparationDUneQuestion } from '../src/core/preparees'

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
    writeFileSync(preparee, texte.replace(/^\{"version":\d+,/, '{"version":0,'))
    assert.deepEqual(await lireLaBasePreparee(preparee, dossier), { motif: 'format 0' })
    writeFileSync(preparee, texte.replace(/^\{"version":\d+,/, '{"version":1,'))
    assert.deepEqual(await lireLaBasePreparee(preparee, dossier), { motif: 'format 1' }, 'une ligne par question nue, d’avant ce que le build en calcule')
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

// Ses sujets, sa famille et les cribles du Cabinet ne dépendent que de la
// question et du code : le build les calcule une fois (`preparationDeLaQuestion`),
// et un réveil les reprend — les cribles seuls tenaient le dixième de cœur dix
// secondes à chaque réveil (le 3 novembre 2026).
test('ce que le build calcule de chaque question se relit avec elle, et chaque lecteur le reprend au lieu de le refaire', async () => {
  const { dossier, preparee, effacer } = petiteBase()
  try {
    preparerLaBase(preparee, dossier, preparationDeLaQuestion)
    const relue = await lireLaBasePreparee(preparee, dossier)
    assert.ok('lue' in relue, 'motif' in relue ? relue.motif : '')
    for (const q of relue.lue.questions) assert.deepEqual(preparationDe(q), preparationDeLaQuestion(q), q.id)
    // Les questions du dossier relues par le juge, comme une correction du QG : des objets neufs, sans préparation.
    assert.ok(lireLaBase(dossier).questions.every(q => preparationDe(q) === undefined))

    // Ce que les lecteurs lisent est bien ce qui s'est rangé à côté de la question, pas un calcul refait : une
    // préparation inventée, qu'aucune règle ne donnerait, se lit telle quelle.
    preparerLaBase(preparee, dossier, () => ({ sujets: ['sujet-du-build'], famille: 'famille-du-build', cabinet: QCM_DU_CABINET }))
    const inventee = await lireLaBasePreparee(preparee, dossier)
    assert.ok('lue' in inventee)
    const questions = inventee.lue.questions
    assert.ok(questions.every(q => sujetsDeLaQuestion(q)[0] === 'sujet-du-build'))
    const porte = { deLaCategorie: (jouables: readonly QuestionDeLaBase[], c: string) => jouables.filter(q => q.meta.categorie === c) }
    // Toutes au Pari et à l'Éclair, même celles que le crible écarterait (un vrai ou faux, un intitulé trop long) ; aucune au Mot.
    assert.equal(qcmDeLaCategorie(porte, questions, 'Histoire').length, questions.length)
    assert.ok(questions.some(q => !verdictCalcule(q).qcm), 'au moins une que le crible écarte, pour que l’épreuve dise quelque chose')
    assert.equal(motsDeLaCategorie(porte, questions, 'Histoire').length, 0)
  } finally {
    effacer()
  }
})

// La signature des jumelles et ce qui s'apprend par cœur : chaque processus les
// calculait au premier tirage de chaque catégorie — sans accent, mot par mot —,
// la moitié du départ d'une épreuve à froid, 260 ms sur un vrai cœur pour toute
// la base (le banc du 3 novembre 2026). Rangés au build, ils doivent dire au
// tirage exactement ce que le calcul dirait, ou les épreuves changeraient.
test('la signature des jumelles et le par-cœur rangés au build valent, sur toute la base, ceux que le serveur calcule', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-base-'))
  const preparee = path.join(dir, 'index.campagne.ndjson')
  try {
    // Les seules colonnes de ce test : les cribles du Cabinet coûteraient une seconde de plus.
    preparerLaBase(preparee, undefined, q => ({ sujets: [], famille: null, cabinet: 0, ...signeAPreparer(q), parCoeur: parCoeurCalcule(q) }))
    const relue = await lireLaBasePreparee(preparee)
    assert.ok('lue' in relue, 'motif' in relue ? relue.motif : '')
    let rangees = 0
    let parCoeur = 0
    for (const q of relue.lue.questions) {
      // La même question, sans préparation : le serveur la calcule, comme une correction du QG.
      assert.deepEqual(signeDe(q), signeDe({ texte: q.texte, reponses: q.reponses }), q.id)
      assert.equal(parCoeurDe(q), parCoeurCalcule(q), q.id)
      if (preparationDe(q)?.forme !== undefined) rangees++
      if (parCoeurDe(q)) parCoeur++
    }
    assert.equal(rangees, relue.lue.questions.length, 'chaque signature rangée')
    assert.ok(parCoeur > 1000 && parCoeur < relue.lue.questions.length / 2, `${parCoeur} questions par cœur`)
    // En colonnes par blocs : d'une seule ligne, celles de toute la base faisaient un `JSON.parse` de 2,2 Mo, d'un bloc.
    let plusLongue = 0
    for (const ligne of readFileSync(preparee, 'utf8').split('\n')) plusLongue = Math.max(plusLongue, ligne.length)
    assert.ok(plusLongue < 300_000, `une ligne de ${plusLongue} caractères`)
    // Une réponse qui porterait le séparateur du build ne range rien : elle se calcule à chaque processus.
    assert.equal(signeAPreparer({ texte: 'Laquelle ?', reponses: ['Une\u001fdeux', 'Trois', 'Quatre'] }), undefined)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('le tirage lit la signature des jumelles et le par-cœur que le build a rangés, pas un calcul refait', async () => {
  const { dossier, preparee, effacer } = petiteBase()
  /** La base relue sous une préparation inventée, qu'aucune règle ne donnerait. */
  const sous = async (inventee: (q: QuestionDeLaBase) => Partial<PreparationDUneQuestion>) => {
    preparerLaBase(preparee, dossier, q => ({ sujets: [], famille: null, cabinet: 0, ...inventee(q) }))
    const relue = await lireLaBasePreparee(preparee, dossier)
    assert.ok('lue' in relue, 'motif' in relue ? relue.motif : '')
    return relue.lue.questions
  }
  const nue = (q: QuestionDeLaBase) => ({ texte: q.texte, reponses: q.reponses })
  try {
    // Deux questions que le calcul ne dit pas jumelles, et dont chacune l'est d'elle-même.
    const [a, b] = await sous(() => ({}))
    assert.ok(!jumelles(nue(a), nue(b)) && jumelles(nue(a), nue(a)), 'deux questions qui ne se ressemblent pas, pour que l’épreuve dise quelque chose')

    // La même forme rangée : jumelles.
    const memeForme = await sous(() => ({ forme: 'forme-du-build', nettes: null, parCoeur: true }))
    assert.ok(jumelles(memeForme[0], memeForme[1]))
    assert.ok(memeForme.every(q => parCoeurDe(q)))
    // Les mêmes réponses nettes rangées, sous deux formes : jumelles aussi.
    const { nettes } = signeAPreparer({ texte: 'Comment appelle-t-on le petit de la chèvre ?', reponses: ['Le chevreau', "L'agneau", 'Le veau', 'Le poulain'] })!
    assert.equal(typeof nettes, 'string', 'des réponses nettes qui ne sont pas les réponses en minuscules : elles se rangent')
    const memesReponses = await sous(q => ({ forme: `forme-${q.id}`, nettes, parCoeur: false }))
    assert.ok(jumelles(memesReponses[0], memesReponses[1]))
    assert.ok(memesReponses.every(q => !parCoeurDe(q)))
    assert.ok(memesReponses.some(q => parCoeurCalcule(q)), 'au moins une que le calcul dit par cœur')
    // Aucune forme rangée — un vrai ou faux : pas même jumelle d'elle-même.
    const sansForme = await sous(() => ({ forme: null, nettes: null }))
    assert.ok(!jumelles(sansForme[0], sansForme[0]))
  } finally {
    effacer()
  }
})
