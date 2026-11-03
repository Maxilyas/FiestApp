// Les calculs de fond sur toute la base passent en tranches
// (`shared/tranches.ts`) : au dixième de cœur de l'hébergeur, chacun gelait
// la boucle d'une traite — la mise en famille de la mesure, la préparation
// d'un tirage, la série de référence, les index de la base (le relevé des
// gels de la production, le 2 novembre 2026). Menés une tranche par tour de
// boucle (`enTranches`) ou d'une traite (`dUneTraite`), ils rendent ce qu'ils
// rendaient d'un bloc — c'est le même code.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baseDEssai } from './banc'
import { enTranches } from '../src/core/tourniquet'
import { CANDIDATES_PAR_TRANCHE, PreparationDuTirage, tirerUneEpreuve, tirerUneEpreuveEnTranches } from '../src/core/campagne'
import { regleDuPalier } from '../../shared/sentiers'
import { BaseDeLaCampagne } from '../src/core/baseCampagne'
import { serieDeReference, serieDeReferenceEnTranches } from '../src/core/modeleDuSavoir'
import { DOSSIER_DU_CONTENU, ENTREES_PAR_TRANCHE, lireLeContenu, lireLeContenuEnTranches } from '../src/core/cabinet/contenu'
import { tableauxDuDetail, tableauxDuDetailEnTranches } from '../src/core/details'
import { dUneTraite, type CalculEnTranches } from '../../shared/tranches'
import { mesuresEnFamille, mesuresEnFamilleEnTranches, niveauDeQuestion, type MesureDUneQuestion } from '../../shared/campagne'

/** Un hasard qu'on rejoue. */
function hasard(graine: number) {
  let g = graine
  return () => (g = (g * 16807) % 2147483647) / 2147483647
}

test('un calcul en tranches : chaque tranche à son tour de boucle, et le même résultat d’une traite', async () => {
  let tour = 0
  let tourne = true
  const tourner = () => {
    tour++
    if (tourne) setImmediate(tourner)
  }
  setImmediate(tourner)
  try {
    const tours: number[] = []
    function* compter(n: number): CalculEnTranches<number> {
      let somme = 0
      for (let i = 0; i < n; i++) {
        tours.push(tour)
        somme += i
        yield
      }
      return somme
    }
    assert.equal(await enTranches(compter(5)), 10)
    assert.equal(new Set(tours).size, 5, `une tranche par tour : ${tours.join(', ')}`)
    assert.equal(dUneTraite(compter(5)), 10)
  } finally {
    tourne = false
  }
})

test('la mesure en famille, en tranches : la même qu’en un bloc', async () => {
  const h = hasard(7)
  const questions = Array.from({ length: 700 }, (_, i) => ({ id: `q${i}`, difficulte: 1 + (i % 5), famille: i % 9 === 0 ? null : `f${i % 13}` }))
  const parQuestion = new Map<string, { justes: number; total: number }>()
  const premieres = new Map<string, { justes: number; total: number }>()
  for (const q of questions) {
    if (h() < 0.6) {
      const total = 1 + Math.floor(h() * 40)
      parQuestion.set(q.id, { justes: Math.floor(h() * (total + 1)), total })
    }
    if (h() < 0.5) {
      const total = 1 + Math.floor(h() * 25)
      premieres.set(q.id, { justes: Math.floor(h() * (total + 1)), total })
    }
  }
  const dUnBloc = mesuresEnFamille(questions, parQuestion, premieres)
  assert.deepEqual(dUneTraite(mesuresEnFamilleEnTranches(questions, parQuestion, premieres, 23)), dUnBloc)
  assert.deepEqual(await enTranches(mesuresEnFamilleEnTranches(questions, parQuestion, premieres, 23)), dUnBloc)
  // Ses tranches : au moins une par tranche de questions, dans chacune de ses deux passes.
  let cedees = 0
  const calcul = mesuresEnFamilleEnTranches(questions, parQuestion, premieres, 23)
  while (!calcul.next().done) cedees++
  assert.ok(cedees >= Math.floor(700 / 23), `${cedees} tranches`)
})

test('la préparation du tirage, la série de référence et la base, en tranches : les mêmes qu’en un bloc', async () => {
  const base = baseDEssai(600, { categories: ['Histoire', 'Sport', 'Nature', 'Géographie'] })
  const h = hasard(11)
  const mesure = new Map<string, MesureDUneQuestion>()
  for (const q of base.questions) if (h() < 0.7) mesure.set(q.id, { justes: Math.floor(h() * 20), total: 20 })

  // La préparation : ses marches, ses files, ses identifiants — sans préparation d'avant, puis avec.
  const prive = (p: PreparationDuTirage) => p as unknown as { files: Int32Array; categorieDeLaFile: number[]; nombreDeCategories: number; parId: Map<string, number> | null }
  const dUnBloc = new PreparationDuTirage(base.questions, new Map())
  const enFond = await enTranches(PreparationDuTirage.enTranches(base.questions, new Map(), undefined, 37))
  for (const champ of ['files', 'categorieDeLaFile', 'nombreDeCategories', 'parId'] as const) assert.deepEqual(prive(enFond)[champ], prive(dUnBloc)[champ], champ)
  const suivante = await enTranches(PreparationDuTirage.enTranches(base.questions, mesure, enFond, 37))
  assert.equal(prive(suivante).files, prive(enFond).files, 'les files des mêmes jouables se reprennent')
  const attendue = new PreparationDuTirage(base.questions, mesure, dUnBloc)
  base.questions.forEach((q, i) => {
    assert.equal(suivante.marche(i), attendue.marche(i))
    assert.equal(suivante.marche(i), niveauDeQuestion(q.meta.difficulte, mesure.get(q.id)))
  })

  // La série de référence.
  const difficulte = (q: { id: string }) => (Number(q.id.slice(5)) % 17) / 4 - 2
  assert.deepEqual(
    await enTranches(serieDeReferenceEnTranches(base.questions, (_, i) => attendue.marche(i), difficulte, 29)),
    serieDeReference(base.questions, (_, i) => attendue.marche(i), difficulte),
  )

  // La base : chaque question par son identifiant, et les empreintes.
  const refaite = await enTranches(BaseDeLaCampagne.enTranches(base.questions, 41))
  assert.deepEqual([...refaite.parId], [...base.parId])
  assert.deepEqual([...refaite.empreintes], [...base.empreintes])
  assert.equal(refaite.questions, base.questions)
})

// Le départ d'une épreuve de sentier : seize places, chacune sur toutes les
// questions de sa marche dans la catégorie — plus d'une seconde de gel au banc
// bridé (le 2 novembre 2026). Une place par tranche, au même hasard.
test('le tirage d’une épreuve, une place par tranche : le même qu’en un bloc, au même hasard', async () => {
  const base = baseDEssai(600, { categories: ['Histoire'] })
  const regle = regleDuPalier(9)!
  const places = Object.values(regle.melange).reduce((n, x) => n + (x ?? 0), 0)
  const vues = new Map(base.questions.filter((_, i) => i % 3 === 0).map((q, i) => [q.id, Date.UTC(2026, 9, 1) + i * 60_000]))
  const maintenant = Date.UTC(2026, 10, 2, 20)
  const auHasard = async <T>(graine: number, f: () => T | Promise<T>): Promise<T> => {
    const avant = Math.random
    Math.random = hasard(graine)
    try {
      return await f()
    } finally {
      Math.random = avant
    }
  }
  const ids = (tirees: readonly { question: { id: string }; niveau: string }[]) => tirees.map(x => `${x.question.id}:${x.niveau}`)
  const dUnBloc = await auHasard(5, () => tirerUneEpreuve(base.questions, regle, vues, new Map(), maintenant))
  let tranches = 0
  const calcul = tirerUneEpreuveEnTranches(base.questions, regle, vues, new Map(), maintenant)
  const enUnPas = await auHasard(5, () => {
    for (;;) {
      const r = calcul.next()
      if (r.done) return r.value
      tranches++
    }
  })
  assert.deepEqual(ids(enUnPas), ids(dUnBloc))
  assert.equal(enUnPas.length, places)
  assert.ok(tranches >= places, `${tranches} tranches pour ${places} places`)
})

// Une place d'une traite gelait encore 0,6 s au banc bridé (le 3 novembre
// 2026) : au premier tirage, chaque candidate lit sa forme pour les jumelles
// et sa réponse pour le par-cœur. Une catégorie de mille questions, toutes
// difficiles, un seul sous-thème : chaque place, après la première, repasse
// toute la marche.
test('le tirage d’une épreuve ne lit pas plus de `CANDIDATES_PAR_TRANCHE` candidates d’une traite', () => {
  const essai = baseDEssai(1000, { categories: ['Histoire'], difficultes: [4] })
  let lues = new Set<string>()
  const questions = essai.questions.map(q => {
    const copie = { ...q }
    const meta = q.meta
    Object.defineProperty(copie, 'meta', { enumerable: true, get: () => (lues.add(q.id), meta) })
    return copie
  })
  const calcul = tirerUneEpreuveEnTranches(questions, regleDuPalier(9)!, new Map(), new Map(), Date.UTC(2026, 10, 3, 20))
  const parTranche: number[] = []
  for (;;) {
    lues = new Set()
    const r = calcul.next()
    parTranche.push(lues.size)
    if (r.done) break
  }
  // La première tranche range la catégorie par marche : une passe, sans rang.
  const plus = Math.max(...parTranche.slice(1))
  assert.ok(plus > 0, `les places lisent leurs candidates (${parTranche.join(', ')})`)
  assert.ok(plus <= CANDIDATES_PAR_TRANCHE, `${plus} candidates lues d’une traite (au plus ${CANDIDATES_PAR_TRANCHE})`)
})

// Le contenu neuf du Cabinet — ses juges, et chaque entrée comparée à ses
// voisines — et les cadrages des tableaux du Détail, vérifiés sur le disque :
// d'une traite sous le premier départ d'un processus, plus d'une seconde de
// gel au banc bridé (le 3 novembre 2026). Lus en tranches, les mêmes.
test('le contenu neuf du Cabinet et les tableaux du Détail se lisent en tranches, les mêmes qu’en un bloc', async () => {
  const dUnBloc = lireLeContenu(DOSSIER_DU_CONTENU)
  const calcul = lireLeContenuEnTranches(DOSSIER_DU_CONTENU)
  let tranches = 0
  let r = calcul.next()
  for (; !r.done; r = calcul.next()) tranches++
  assert.deepEqual(r.value, dUnBloc)
  const entrees = dUnBloc.lieux.length + dUnBloc.fiches.length + dUnBloc.repliques.length + dUnBloc.frises.length
  assert.ok(entrees > 100, `${entrees} entrées livrées`)
  assert.ok(tranches >= Math.floor(entrees / ENTREES_PAR_TRANCHE), `${tranches} tranches pour ${entrees} entrées`)
  const tableaux = await tableauxDuDetailEnTranches()
  assert.ok(tableaux.length >= 50, `${tableaux.length} tableaux livrés`)
  assert.equal(tableauxDuDetail(), tableaux, 'lus une fois : le tireur les trouve lus')
})
