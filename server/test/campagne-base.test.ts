// La base de la campagne (`server/content/campagne/`), telle que le dépôt la
// livre : des questions écrites et étiquetées d'avance, rien qu'à la
// campagne. Une entrée défectueuse n'y entre pas en silence — le serveur
// l'écarterait à sa lecture —, et la base ne recule jamais.
//
// Elle a grandi lot par lot (`scripts/base-campagne.ts`) : le plancher
// `AU_MOINS` monte avec elle, et chaque catégorie, chaque sous-thème et
// chaque marche ont leur minimum — une catégorie qu'un fichier écrasé
// viderait, ou une marche qu'un lot trop facile laisserait à sec, se verrait
// ici avant de se jouer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { DOSSIER_DE_LA_BASE, QUESTIONS_PAR_TRANCHE, fichierDeCategorie, lireLaBase, lireLaBaseSansBloquer, lireQuestionDeLaBase } from '../src/core/baseCampagne'
import { empreinteDe } from '../src/core/jour'
import { SERVEUR } from '../src/racine'
import { CATEGORIES } from '../../shared/categories'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { NIVEAUX, QUESTIONS_PAR_SERIE, niveauDeQuestion, type Niveau } from '../../shared/campagne'
import { sansAccent } from '../../shared/homonymes'

/**
 * Ce que la base a déjà : elle ne descend jamais sous ce nombre (un fichier
 * écrasé, un rangement raté). Un retrait voulu le baisse dans le même commit,
 * et dit pourquoi : le 10 octobre 2026, trente-huit questions qui posaient le
 * même fait qu'une autre (`voisines`, `retirer`) — 5 012 questions, 4 974
 * faits.
 */
const AU_MOINS = 4970

const { questions, refusees } = lireLaBase()

test('chaque entrée de la base se relit sans défaut', () => {
  assert.deepEqual(refusees.slice(0, 10), [], `${refusees.length} entrée(s) que le serveur écarterait`)
})

test('la base ne recule jamais', () => {
  assert.ok(questions.length >= AU_MOINS, `${questions.length} questions, ${AU_MOINS} au moins`)
})

test('une série peut monter jusqu’à l’expert', () => {
  const compte: Record<Niveau, number> = { facile: 0, moyen: 0, difficile: 0, expert: 0 }
  for (const q of questions) compte[niveauDeQuestion(q.meta.difficulte)]++
  // Après les quinze premières, une série joue l'expert jusqu'au bout : il en faut au moins une série entière.
  for (const n of NIVEAUX) assert.ok(compte[n] >= QUESTIONS_PAR_SERIE, `${n} : ${compte[n]}`)
})

test('chaque catégorie a de quoi tenir plusieurs séries', () => {
  for (const c of CATEGORIES) {
    const n = questions.filter(q => q.meta.categorie === c).length
    assert.ok(n >= 150, `${c} : ${n} questions, 150 au moins`)
  }
})

test('chaque sous-thème a ses questions : aucun n’est resté vide', () => {
  for (const c of CATEGORIES) {
    for (const st of SOUS_THEMES[c]) {
      const n = questions.filter(q => q.meta.categorie === c && q.meta.sousTheme === st.cle).length
      assert.ok(n >= 15, `${c} › ${st.cle} : ${n} questions, 15 au moins`)
    }
  }
})

test('chaque marche a de quoi composer des séries, en tout et dans chaque catégorie', () => {
  // La marche d'une question se lit comme le serveur la lit à l'écriture, avant toute mesure des réponses.
  const compte = (garde: (q: (typeof questions)[number]) => boolean, n: Niveau) =>
    questions.filter(q => garde(q) && niveauDeQuestion(q.meta.difficulte) === n).length
  for (const n of NIVEAUX) {
    assert.ok(compte(() => true, n) >= 300, `${n} : ${compte(() => true, n)} questions en tout, 300 au moins`)
    for (const c of CATEGORIES) {
      const k = compte(q => q.meta.categorie === c, n)
      assert.ok(k >= 10, `${c} › ${n} : ${k} questions, 10 au moins`)
    }
  }
})

test('les douze fichiers de catégorie sont là', () => {
  const presents = new Set(readdirSync(DOSSIER_DE_LA_BASE).filter(f => f.endsWith('.json')))
  assert.equal(CATEGORIES.length, 12)
  for (const c of CATEGORIES) assert.ok(presents.has(fichierDeCategorie(c)), `${fichierDeCategorie(c)} manque`)
})

test('la base ne reprend aucune question des quiz livrés, dont le quiz du jour s’est amorcé', () => {
  const dossier = path.join(SERVEUR, 'content/quiz')
  const livres = new Set<string>()
  for (const f of readdirSync(dossier).filter(f => f.endsWith('.json'))) {
    for (const q of (JSON.parse(readFileSync(path.join(dossier, f), 'utf8')) as { questions: { text: string }[] }).questions) livres.add(empreinteDe(q.text))
  }
  assert.deepEqual(
    questions.filter(q => livres.has(q.empreinte)).map(q => q.texte),
    [],
  )
})

test('un fichier par catégorie, une question par ligne : une relecture de PR se fait question par question', () => {
  const connus = new Set(CATEGORIES.map(fichierDeCategorie))
  for (const f of readdirSync(DOSSIER_DE_LA_BASE).filter(f => f.endsWith('.json'))) {
    assert.ok(connus.has(f), `${f} n’est le fichier d’aucune catégorie`)
    const lignes = readFileSync(path.join(DOSSIER_DE_LA_BASE, f), 'utf8').trimEnd().split('\n')
    assert.equal(lignes[0], '[', f)
    assert.equal(lignes.at(-1), ']', f)
    for (const l of lignes.slice(1, -1)) assert.match(l, /^\{"id":"[a-z0-9]{8}",.*\},?$/, `${f} : ${l.slice(0, 60)}`)
  }
})

test('le serveur lit la base sans se figer : il rend la main toutes les quelques centaines de questions', async () => {
  // Lue d'un bloc, la base tenait le serveur 0,4 s : aucune soirée ne
  // recevait rien pendant ce temps, ni question ni accusé de réponse.
  let tours = 0
  let lue = false
  const tourner = () => {
    if (lue) return
    tours++
    setImmediate(tourner)
  }
  setImmediate(tourner)
  const base = await lireLaBaseSansBloquer()
  lue = true
  assert.equal(base.questions.length, questions.length, 'la même base que d’une traite')
  assert.ok(tours >= Math.floor(questions.length / QUESTIONS_PAR_TRANCHE), `${tours} tours de boucle pendant la lecture de ${questions.length} questions`)
})

test('la bonne réponse écrite dans l’intitulé se refuse en mot entier, où qu’elle soit', () => {
  // Le juge ne compile plus une expression par question : le verdict, lui, ne bouge pas.
  const brutes: { texte: string; reponses: string[]; bonne: number }[] = JSON.parse(readFileSync(path.join(DOSSIER_DE_LA_BASE, fichierDeCategorie('Histoire')), 'utf8'))
  const entree = brutes.find(e => e.reponses.length === 4 && /^[a-z]{5,}$/.test(sansAccent(e.reponses[e.bonne])))
  assert.ok(entree, 'une entrée dont la bonne réponse est un seul mot')
  const mot = entree.reponses[entree.bonne]
  const verdict = (texte: string) => {
    const lu = lireQuestionDeLaBase({ ...entree, texte })
    return 'refus' in lu ? lu.refus : 'acceptée'
  }
  const ecrite = 'la bonne réponse est écrite dans l’intitulé'
  assert.equal(verdict(`${mot}, est-ce la bonne réponse à cette question ?`), ecrite, 'en tête')
  assert.equal(verdict(`Quelle est la bonne réponse, sinon ${mot} ?`), ecrite, 'entre deux espaces')
  assert.equal(verdict(`Quelle est la bonne réponse ? (${mot.toUpperCase()})`), ecrite, 'sans casse, entre parenthèses')
  assert.equal(verdict(`Entre ${mot}s et ${mot}, quelle est la bonne réponse ?`), ecrite, 'la seconde fois seulement en mot entier')
  assert.equal(verdict(`Quelle est la bonne réponse, des ${mot}s mises à part ?`), 'acceptée', 'au milieu d’un mot plus long')
  assert.equal(verdict(`Quelle est la bonne réponse, au sur${mot} près ?`), 'acceptée', 'collée à la fin d’un mot')
  assert.equal(verdict('Quelle est donc la bonne réponse à cette question-ci ?'), 'acceptée')
})
