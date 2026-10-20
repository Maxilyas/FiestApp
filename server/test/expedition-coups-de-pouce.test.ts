// Les coups de pouce et les lettres (la version 11 du départ, le 19 octobre
// 2026 — l'étape 3 de « La question au centre », `retours/2026-10-19/les-coups-de-pouce.md`).
// Le testeur : « Ça manque un peu de cartes pour donner des indices […] des
// lettres présentes dans la réponse […] comme un pendu » ; le propriétaire :
// « Jusqu'à deux mots, 12 lettres », trois cartes, une escale sur cinq. La
// forme à composer — ses cases, ses tuiles, sa réponse jugée au serveur — et
// L'initiale, Le repère, La lettre : les règles, le pli, les routes, l'écran.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireLaBase, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { hasardDe } from '../../shared/missions'
import { LETTRES_A_COMPOSER_MAX, LETTRES_EN_TROP, compositionDite, gabaritDe, lireUneComposition, seCompose, signesDe, tuilesDe } from '../../shared/lettres'
import { ECHELLE_DES_COUPS_DE_POUCE, ECHELLE_EN_QUESTION, EXPLOITS, NIVEAU_MAX, codexDuNiveau, ouvertureDe } from '../../shared/codex'
import {
  CARTES_DES_RENCONTRES,
  CRANS_DES_RENCONTRES,
  CRANS_D_UNE_QUESTION_DURE,
  VERSION_DE_LA_QUESTION_AU_CENTRE,
  VERSION_DES_COUPS_DE_POUCE,
  VERSION_DE_LA_FRISE,
  VERSION_DES_HUIT_FAMILLES,
  ameliorer,
  carteALaVersion,
  cransDeLaForme,
  effaceesDuTour,
  refusDeLAmelioration,
  refusDeLaCarte,
  seJoueEnQuestion,
  type ContexteDUneCarte,
  type QuestionDuTour,
} from '../../shared/rencontres'
import {
  POIDS_DES_ESCALES_DES_RENCONTRES,
  POIDS_DES_FORMES,
  POIDS_DES_FORMES_A_COMPOSER,
  PRIX_DE_L_ECHOPPE,
  carteDUnActe,
  casesPosees,
  ceQueDitLInitiale,
  ceQueDitLaLettre,
  ceQueDitLeRepere,
  chanceSelonLaForme,
  pliDeLExpedition,
  prixDeLArticle,
  questionAComposer,
  refusDUneCarte,
  type DepartDExpedition,
  type FormeDEscale,
  type GesteDExpedition,
  type VueDeLExpedition,
} from '../../shared/expedition'
import { Journal, depart, pieces, rendre, rien, texte, type Composant } from './expedition-journal'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

const V = VERSION_DES_COUPS_DE_POUCE
const COUPS_DE_POUCE = ['repere', 'lettre', 'initiale']

/** Un hasard tiré d'une graine : celui du tirage, rejoué. */
const graine = (g: string) => hasardDe(`essai:${g}`)

// ── La forme à composer ─────────────────────────────────────────────────────

test('une réponse se compose de deux mots au plus et de quatre à douze lettres : ses cases, ses signes posés d’office, son article devant', () => {
  assert.deepEqual(gabaritDe('Victor Hugo'), { mots: [Array(6).fill(null), Array(4).fill(null)], lettres: 'VICTORHUGO' })
  // L'article ne se compose pas : il se pose devant les cases, à l'apostrophe de l'écran.
  assert.deepEqual(gabaritDe('La cochenille'), { article: 'La', mots: [Array(10).fill(null)], lettres: 'COCHENILLE' })
  assert.deepEqual(gabaritDe('L\'Odyssée'), { article: 'L’', mots: [Array(7).fill(null)], lettres: 'ODYSSEE' })
  // Le trait d'union et l'apostrophe restent dans le mot, posés d'office ; les accents tombent, « Œ » fait deux lettres.
  assert.deepEqual(gabaritDe('Saint-Exupéry')!.mots, [[null, null, null, null, null, '-', null, null, null, null, null, null, null]])
  assert.equal(gabaritDe('Saint-Exupéry')!.lettres, 'SAINTEXUPERY')
  assert.deepEqual(gabaritDe('Aujourd’hui')!.mots[0].filter(c => c !== null), ['’'])
  assert.equal(gabaritDe('Œdipe')!.lettres, 'OEDIPE')
  // Ce qui ne se compose pas : trop long, trop court, trois mots, un chiffre, une lettre hors de l'alphabet, un signe au bout.
  for (const r of ['Jean-Paul Sartre', 'Zoé', 'Le Petit Prince Charmant', 'Apollo 11', '1515', 'Ørsted', 'Saint-', 'Rock & roll']) assert.equal(gabaritDe(r), null, r)
  assert.equal(gabaritDe('Le Petit Prince')!.lettres, 'PETITPRINCE', 'deux mots après l’article')
  assert.equal(LETTRES_A_COMPOSER_MAX, 12)
  // Ce que le téléphone envoie : ses lettres, autant que de cases.
  assert.equal(lireUneComposition('VICTORHUGO', 10), 'VICTORHUGO')
  for (const x of ['VICTOR HUGO', 'victorhugo', 'VICTORHUG', 3, null, ['V']]) assert.equal(lireUneComposition(x, 10), null, String(x))
  assert.equal(compositionDite(gabaritDe('Saint-Exupéry')!.mots, 'SAINTEXUPERY'), 'SAINT-EXUPERY')
  assert.equal(compositionDite(gabaritDe('Victor Hugo')!.mots, 'VICTORHUGE'), 'VICTOR HUGE')
})

test('une question se pose à composer si sa bonne réponse se compose et que son intitulé ne parle pas de ses choix : six sur dix de la base', () => {
  const q = (texte: string, reponses: string[], bonne = 0) => ({ texte, reponses, bonne })
  assert.equal(seCompose(q('Qui a écrit Les Misérables ?', ['Victor Hugo', 'Émile Zola', 'Balzac', 'Flaubert'])), true)
  assert.equal(seCompose(q('Vrai ou faux : la Lune est un satellite ?', ['Vrai', 'Faux'])), false, 'un vrai ou faux n’a rien à composer')
  // « Laquelle de ces villes » ne se répond pas sans ses choix.
  for (const t of ['Laquelle de ces villes est la plus peuplée ?', 'Parmi les pays suivants, lequel est une île ?', 'Quel est l’intrus ?']) {
    assert.equal(seCompose(q(t, ['Lyon', 'Paris', 'Marseille', 'Lille'])), false, t)
  }
  // Mesuré sur la base livrée (le 19 octobre 2026 : 60,7 %) — le choix du propriétaire, deux mots de douze lettres au plus.
  const { questions } = lireLaBase()
  const choix = questions.filter(x => x.reponses.length > 2)
  const part = choix.filter(seCompose).length / choix.length
  assert.ok(part > 0.55 && part < 0.66, `${(part * 100).toFixed(1)} % de la base se compose`)
})

test('ses tuiles : ses lettres et trois de trop qu’elle n’a pas, mélangées — jamais dans l’ordre de la réponse', () => {
  for (const reponse of ['Victor Hugo', 'NASA', 'Elle', 'Saint-Exupéry', 'La cochenille']) {
    const { lettres } = gabaritDe(reponse)!
    for (let k = 0; k < 300; k++) {
      const { tuiles, enTrop } = tuilesDe(lettres, graine(`${reponse}:${k}`))
      assert.equal(tuiles.length, lettres.length + LETTRES_EN_TROP)
      assert.equal(enTrop.length, LETTRES_EN_TROP)
      const deTrop = enTrop.map(i => tuiles[i])
      assert.ok(deTrop.every(l => !lettres.includes(l)), `${reponse} : une lettre de trop qu’elle n’a pas`)
      const siennes = tuiles.filter((_, i) => !enTrop.includes(i))
      assert.deepEqual([...siennes].sort(), [...lettres].sort(), `${reponse} : toutes ses lettres`)
      assert.notEqual(siennes.join(''), lettres, `${reponse} : jamais dans l’ordre`)
    }
  }
})

test('la version 11 : une escale à composer sur cinq dès l’étage 2, sur le même tirage que la version 10 — le premier étage ne change pas', () => {
  let questions = 0
  let aComposer = 0
  for (let i = 0; i < 400; i++) {
    const avant = carteDUnActe(`pouce:${i}`, i % 3, [], undefined, POIDS_DES_ESCALES_DES_RENCONTRES)
    const apres = carteDUnActe(`pouce:${i}`, i % 3, [], undefined, POIDS_DES_ESCALES_DES_RENCONTRES, POIDS_DES_FORMES_A_COMPOSER)
    assert.deepEqual(
      apres.escales.map(({ forme: _forme, ...e }) => e),
      avant.escales.map(({ forme: _forme, ...e }) => e),
      'les mêmes escales, les mêmes thèmes : seule la forme change',
    )
    assert.ok(!avant.escales.some(e => e.forme === 'lettres'), 'la version 10 n’en pose aucune')
    for (const e of apres.escales) {
      if (!e.forme) continue
      if (e.etage === 0) assert.equal(e.forme, avant.escales.find(x => x.id === e.id)!.forme, 'le premier étage ne change pas')
      else {
        questions++
        if (e.forme === 'lettres') aComposer++
      }
    }
  }
  assert.ok(Math.abs(aComposer / questions - 0.2) < 0.03, `${aComposer} sur ${questions}`)
  assert.equal(POIDS_DES_FORMES_A_COMPOSER.reduce((s, p) => s + p.part, 0).toFixed(6), (1).toFixed(6))
  assert.ok(!POIDS_DES_FORMES.some(p => p.forme === 'lettres'))
})

/** Le contexte d'une carte sur une question à composer de la question au centre, la question sous les yeux. */
const surUneQuestionAComposer = (main: string[], q: Partial<QuestionDuTour> = {}, surLaQuestion: string[] = []): ContexteDUneCarte => ({
  v: V,
  tour: { phase: 'question', inspiration: 0, jouees: [...surLaQuestion], surLaQuestion },
  main,
  pouvoirs: [],
  question: { reponses: 13, tiree: 'lettres', forme: 'lettres', six: false, nombre: false, datee: false, categorie: 'Histoire', ...q },
  courage: 50,
  derniereFrappe: 0,
  defausse: 1,
})

test('à composer : deux crans, un hasard d’un sur dix ; ses lettres de trop s’effacent toutes, et ce qui n’y a pas de sens se refuse en le disant', () => {
  assert.equal(cransDeLaForme({ forme: 'lettres', reponses: 13 }), CRANS_D_UNE_QUESTION_DURE)
  assert.ok(Math.abs(chanceSelonLaForme(0.25, 'lettres') - 0.1) < 1e-9, 'au hasard, une fois sur dix')
  assert.equal(chanceSelonLaForme(1, 'lettres'), 1)
  assert.ok(chanceSelonLaForme(0.7, 'lettres') < chanceSelonLaForme(0.7, 'quatre'), 'plus dure qu’à quatre choix')
  // Les cartes qui effacent retirent les lettres de trop — toutes, Révélation : il reste à les mettre dans l'ordre.
  const lettres = { reponses: 13, forme: 'lettres' as FormeDEscale }
  assert.equal(effaceesDuTour(['coup-d-oeil'], [], lettres), 1)
  assert.equal(effaceesDuTour(['voyance'], [], lettres), 2)
  assert.equal(effaceesDuTour(['revelation'], [], lettres), LETTRES_EN_TROP)
  assert.equal(effaceesDuTour(['coup-d-oeil', 'voyance', 'coup-d-oeil'], ['vision'], lettres), LETTRES_EN_TROP)
  assert.equal(refusDeLaCarte(surUneQuestionAComposer(['coup-d-oeil']), 'coup-d-oeil'), null)
  assert.equal(refusDeLaCarte(surUneQuestionAComposer(['coup-d-oeil'], {}, ['revelation']), 'coup-d-oeil'), 'Une carte par question : tu en as déjà joué une')
  // Ce qui se refuse, et pourquoi.
  for (const [cle, refus] of [
    ['corser', 'Pas sur une question à composer : elle n’a pas de choix à corser'],
    ['polymorphe', 'Pas sur une question à composer : elle n’a pas de choix à corser'],
    ['double-chance', 'Pas sur une question à composer : elle n’a pas de choix'],
    ['deux-visages', 'Pas sur une question à composer : deux réponses à composer, tu n’en finirais aucune'],
    ['prediction', 'Pas sur une question à composer : l’Oracle n’a aucune réponse à montrer'],
    ['arret-sur-image', 'Arrêt sur image se joue sur un dévoilement'],
  ]) {
    assert.equal(refusDeLaCarte(surUneQuestionAComposer([cle], { nombre: true }), cle), refus, cle)
  }
  // Simplifier en est la porte de sortie : la question repasse en vrai ou faux.
  assert.equal(refusDeLaCarte(surUneQuestionAComposer(['simplifier']), 'simplifier'), null)
  // L'initiale et La lettre y posent leurs lettres, même sur « Huit » ; à choix, pas sur un vrai ou faux, ni sur une année.
  for (const cle of ['initiale', 'lettre']) {
    assert.equal(refusDeLaCarte(surUneQuestionAComposer([cle], { nombre: true }), cle), null, cle)
    assert.equal(refusDeLaCarte(surUneQuestionAComposer([cle], { forme: 'vrai-faux', tiree: 'vrai-faux', reponses: 2 }), cle), 'Pas sur un vrai ou faux : elle répondrait à ta place')
    assert.equal(refusDeLaCarte(surUneQuestionAComposer([cle], { forme: 'quatre', tiree: 'quatre', reponses: 4, nombre: true }), cle), 'Pas sur une année ou un nombre : elle se joue sur des mots')
  }
  // Le repère dit l'époque partout où elle ne dit pas la réponse ; sans époque à dire — la question ne se date pas, ou sa réponse est
  // une année —, il efface, comme le Sphinx : mesuré seul, il ne disait que le domaine six fois sur dix, et retirait des points.
  const datee = { reponses: 4, datee: true }
  assert.equal(effaceesDuTour(['repere'], [], datee), 0, 'l’époque, rien d’effacé')
  assert.equal(effaceesDuTour(['repere+'], [], { reponses: 4 }), 1, 'sans époque, une réponse effacée')
  assert.equal(effaceesDuTour(['repere'], [], { ...datee, nombre: true }), 1, 'une année : l’époque la dirait')
  assert.equal(effaceesDuTour(['repere'], [], lettres), 1, 'à composer, une lettre de trop')
  assert.equal(effaceesDuTour(['repere'], [], { ...lettres, datee: true }), 0)
  const repere = (q: Partial<QuestionDuTour>, sur: string[] = []) => refusDeLaCarte({ ...surUneQuestionAComposer(['repere'], q), pouvoirs: sur }, 'repere')
  assert.equal(repere({ forme: 'vrai-faux', tiree: 'vrai-faux', reponses: 2, datee: true }), null, 'un vrai ou faux qui se date')
  assert.equal(repere({ forme: 'vrai-faux', tiree: 'vrai-faux', reponses: 2 }), 'Pas d’époque à dire de ce vrai ou faux, et rien à y effacer')
  assert.equal(repere({}), null, 'à composer, sans époque : une lettre de trop s’en va')
  assert.equal(repere({ forme: 'quatre', tiree: 'quatre', reponses: 4, nombre: true, datee: true }), null)
  // Plus rien à effacer : sans époque, il se tait ; avec, il la dit encore.
  assert.equal(repere({ forme: 'quatre', tiree: 'quatre', reponses: 3 }, ['echolocation']), 'Il ne reste plus rien à effacer')
  assert.equal(repere({ forme: 'quatre', tiree: 'quatre', reponses: 3, datee: true }, ['echolocation']), null)
})

// ── Les trois cartes ────────────────────────────────────────────────────────

test('trois cartes neuves, à la version 11 seulement : au codex du niveau 1 et du niveau 3, améliorées dans la question au centre', () => {
  for (const cle of COUPS_DE_POUCE) {
    assert.equal(carteALaVersion(cle, VERSION_DES_HUIT_FAMILLES), undefined, `${cle} : pas dans la production`)
    assert.equal(carteALaVersion(cle, VERSION_DE_LA_QUESTION_AU_CENTRE), undefined, `${cle} : pas dans une expédition de la version 10`)
    assert.equal(seJoueEnQuestion(cle), false)
    assert.equal(seJoueEnQuestion(cle, V), true)
    const c = carteALaVersion(cle, V)!
    assert.deepEqual([c.cout, c.moment, c.famille, !!c.indice], [0, 'reflexe', 'neutre', true], cle)
    // Améliorée : elle en dit plus.
    const p = carteALaVersion(ameliorer(cle), V)!
    assert.ok(p.amelioree && p.effet !== c.effet, `${cle}+`)
    assert.equal(refusDeLAmelioration([cle], cle), null, `${cle} s’améliore`)
    assert.equal(carteALaVersion(ameliorer(cle), VERSION_DE_LA_QUESTION_AU_CENTRE), undefined)
  }
  assert.deepEqual(COUPS_DE_POUCE.map(cle => carteALaVersion(cle, V)!.rarete), ['commun', 'commun', 'rare'])
  assert.equal(prixDeLArticle('joker', 'initiale'), PRIX_DE_L_ECHOPPE.rare)
  assert.equal(prixDeLArticle('joker', 'repere'), PRIX_DE_L_ECHOPPE.commun)
  // L'échelle : celle de la question au centre, Le repère et La lettre au niveau 1, L'initiale au 3 ; chaque carte à gagner, une fois.
  assert.deepEqual(
    ECHELLE_DES_COUPS_DE_POUCE.map(m => m.cartes.filter(cle => !ECHELLE_EN_QUESTION.find(x => x.niveau === m.niveau)!.cartes.includes(cle))),
    [['repere', 'lettre'], [], ['initiale'], [], [], [], [], [], [], []],
  )
  const aGagner = CARTES_DES_RENCONTRES.filter(c => !c.legendaire && seJoueEnQuestion(c.cle, V)).map(c => c.cle)
  const ouvertes = [...ECHELLE_DES_COUPS_DE_POUCE.flatMap(m => m.cartes), ...EXPLOITS.flatMap(x => x.carte ?? [])]
  assert.deepEqual([...ouvertes].sort(), [...aGagner].sort(), 'chaque carte à gagner, une fois')
  assert.deepEqual(COUPS_DE_POUCE.map(cle => ouvertureDe(cle, V)), [{ niveau: 1 }, { niveau: 1 }, { niveau: 3 }])
  assert.deepEqual(COUPS_DE_POUCE.map(cle => ouvertureDe(cle, VERSION_DE_LA_QUESTION_AU_CENTRE)), [null, null, null])
  const un = codexDuNiveau(1, [], [], V).cartes
  assert.ok(un.includes('repere') && un.includes('lettre') && !un.includes('initiale'))
  assert.ok(codexDuNiveau(3, [], [], V).cartes.includes('initiale'))
  assert.ok(!codexDuNiveau(NIVEAU_MAX, [], [], VERSION_DE_LA_QUESTION_AU_CENTRE).cartes.some(cle => COUPS_DE_POUCE.includes(cle)), 'le codex d’une expédition de la version 10 ne les a pas')
})

test('ce qu’elles soufflent à choix : l’initiale, une lettre que d’autres réponses n’ont pas, l’époque — sinon une réponse effacée', () => {
  const tragiques = { reponses: ['Eschyle', 'Sophocle', 'Euripide', 'Aristophane'], bonne: 1 }
  assert.equal(ceQueDitLInitiale(tragiques, false), 'Elle commence par S')
  assert.equal(ceQueDitLInitiale(tragiques, true), 'Elle commence par S et finit par E')
  assert.equal(ceQueDitLInitiale({ reponses: ['La cochenille', 'Le puceron', 'La coccinelle', 'Le criquet'], bonne: 0 }, false), 'Sans son article, elle commence par C')
  assert.equal(ceQueDitLInitiale({ reponses: ['Victor Hugo', 'Émile Zola', 'Balzac', 'Flaubert'], bonne: 0 }, true), 'Elle commence par V et finit par O')
  // La lettre : une des siennes qu'une réponse encore à l'écran n'a pas — la même à chaque lecture.
  for (let k = 0; k < 200; k++) {
    const dit = ceQueDitLaLettre(`g${k}`, k % 7, tragiques, [], false)
    const l = /^Elle contient un ([A-Z])$/.exec(dit)?.[1]
    assert.ok(l && 'SOPHOCLE'.includes(l), dit)
    assert.ok(['ESCHYLE', 'EURIPIDE', 'ARISTOPHANE'].some(a => !a.includes(l)), `${l} écarte une réponse`)
    assert.equal(ceQueDitLaLettre(`g${k}`, k % 7, tragiques, [], false), dit, 'la même à chaque lecture')
    assert.match(ceQueDitLaLettre(`g${k}`, k % 7, tragiques, [], true), /^Elle contient un [A-Z] et un [A-Z]$/)
  }
  // Une réponse effacée ne compte plus : la lettre dite écarte une de celles qui restent.
  for (let k = 0; k < 50; k++) {
    const l = /un ([A-Z])$/.exec(ceQueDitLaLettre(`h${k}`, 0, tragiques, [0, 2], false))![1]
    assert.ok(!'ARISTOPHANE'.includes(l) || 'SOPHOCLE'.split('').every(x => 'ARISTOPHANE'.includes(x)), l)
  }
  assert.deepEqual(signesDe('L’Odyssée'), ['ODYSSEE'])
  // Le repère : l'époque — la décennie, le siècle avant l'an mil ou daté au siècle —, sinon ce qu'il efface ; le domaine en plus, amélioré.
  const sousTheme = SOUS_THEMES.Histoire[0]
  const histoire = { categorie: 'Histoire', sousTheme: sousTheme.cle }
  assert.equal(ceQueDitLeRepere({ ...histoire, date: { valeur: '1248', precision: 'annee' } }, false), 'Son époque : les années 1240')
  assert.equal(ceQueDitLeRepere({ ...histoire, date: { valeur: '1869-11-17', precision: 'jour' } }, false), 'Son époque : les années 1860')
  assert.equal(ceQueDitLeRepere({ ...histoire, date: { valeur: '1250', precision: 'siecle' } }, false), 'Son époque : le XIIIe siècle')
  assert.equal(ceQueDitLeRepere({ ...histoire, date: { valeur: '476', precision: 'annee' } }, false), 'Son époque : le Ve siècle')
  assert.equal(ceQueDitLeRepere({ ...histoire, date: { valeur: '-490', precision: 'annee' } }, false), 'Son époque : le Ve siècle av. J.-C.')
  assert.equal(ceQueDitLeRepere({ ...histoire, date: { valeur: '1248', precision: 'annee' } }, true), `Son époque : les années 1240 · Son domaine : Histoire, ${sousTheme.nom}`)
  assert.equal(ceQueDitLeRepere(histoire, false), 'Pas d’époque à dire : une mauvaise réponse s’efface')
  assert.equal(ceQueDitLeRepere(histoire, true), `Pas d’époque à dire : une mauvaise réponse s’efface · Son domaine : Histoire, ${sousTheme.nom}`)
  assert.equal(ceQueDitLeRepere({ ...histoire, forme: 'lettres' }, false), 'Pas d’époque à dire : une lettre de trop s’en va')
  // Une réponse en années : l'époque la dirait — il efface.
  assert.equal(ceQueDitLeRepere({ ...histoire, date: { valeur: '1515', precision: 'annee' }, nombre: true }, false), 'Pas d’époque à dire : une mauvaise réponse s’efface')
})

test('à composer, L’initiale et La lettre posent leurs lettres dans ses cases, et les cartes qui effacent retirent ses lettres de trop', () => {
  const q = { reponses: ['Victor Hugo', 'Émile Zola', 'Balzac', 'Flaubert'], bonne: 0, ...tuilesDe('VICTORHUGO', graine('hugo')) }
  const nue = questionAComposer('graine', 4, q, 0, [])!
  assert.deepEqual(nue.mots, [Array(6).fill(null), Array(4).fill(null)])
  assert.deepEqual(nue.posees, [])
  assert.deepEqual(nue.tuiles.map(t => t.lettre), q.tuiles)
  // Les lettres de trop s'en vont, deux puis toutes : il reste ses lettres, dans le désordre du tirage.
  const deux = questionAComposer('graine', 4, q, 2, [])!
  assert.equal(deux.tuiles.length, q.tuiles.length - 2)
  assert.ok(q.tuiles.every((_, i) => deux.tuiles.some(t => t.n === i) || q.enTrop.includes(i)))
  const toutes = questionAComposer('graine', 4, q, 9, [])!
  assert.deepEqual(toutes.tuiles.map(t => t.lettre).sort(), [...'VICTORHUGO'].sort())
  // Celle qu'une graine retire d'abord le reste quand une autre carte en retire une de plus.
  const une = questionAComposer('graine', 4, q, 1, [])!
  assert.equal(une.tuiles.length, deux.tuiles.length + 1)
  assert.ok(deux.tuiles.every(t => une.tuiles.some(x => x.n === t.n)))
  // L'initiale pose la première — et la dernière, améliorée —, et prend sa tuile.
  const initiale = questionAComposer('graine', 4, q, 0, ['initiale'])!
  assert.deepEqual(initiale.posees, [{ rang: 0, lettre: 'V' }])
  assert.equal(initiale.tuiles.length, q.tuiles.length - 1)
  assert.equal(initiale.tuiles.filter(t => t.lettre === 'V').length, 0)
  assert.deepEqual(questionAComposer('graine', 4, q, 0, ['initiale+'])!.posees, [{ rang: 0, lettre: 'V' }, { rang: 9, lettre: 'O' }])
  // La lettre en pose une ailleurs qu'en tête — deux, améliorée —, la même à chaque lecture.
  for (let k = 0; k < 100; k++) {
    const p = casesPosees(`g${k}`, k, 10, ['lettre'])
    assert.equal(p.length, 1)
    assert.ok(p[0] > 0 && p[0] < 10)
    assert.deepEqual(casesPosees(`g${k}`, k, 10, ['lettre']), p)
    assert.equal(new Set(casesPosees(`g${k}`, k, 10, ['lettre+'])).size, 2)
  }
  // Jamais plus que deux de moins que ses cases : il reste toujours de quoi composer.
  assert.deepEqual(casesPosees('g', 0, 4, ['initiale+', 'lettre+']), [0, 3])
  // Ce qui reste — les posées et les tuiles qui ne sont pas de trop — recompose la réponse.
  const lettre = questionAComposer('graine', 4, q, LETTRES_EN_TROP, ['lettre+'])!
  const reste = lettre.tuiles.map(t => t.lettre)
  for (const p of lettre.posees) reste.push(p.lettre)
  assert.deepEqual(reste.sort(), [...'VICTORHUGO'].sort())
})

// ── Dans le pli ─────────────────────────────────────────────────────────────

/** Un départ des coups de pouce, au codex entier, dont les offres ne tirent que ces cartes. */
const enV11 = (g: string, cartes: string[]): DepartDExpedition => {
  const codex = codexDuNiveau(NIVEAU_MAX, [], [], V)
  return depart(g, [], { v: V, codex: { ...codex, cartes } })
}

/** Un journal où cette carte est dans la main de l'élite, la question sous les yeux, où elle se joue. */
function dansLaMain(cle: string, preparer?: (j: Journal) => void): Journal {
  for (let n = 0; n < 2000; n++) {
    const j = new Journal(enV11(`pouce:${cle}:${n}`, [cle]))
    let e = j.avancer('e00')
    if (e.rencontre!.tour.phase === 'preparation') e = j.voir(0)
    // Une carte jouée en bas fait de la place : prise en route, la carte rejoint la pioche de l'acte, et une main pleine n'en tire plus.
    const autre = e.rencontre!.main.find(k => k !== cle && refusDUneCarte(j.depart, e, k, j.questions) === null)
    if (autre) j.jouer(autre)
    j.gagner()
    j.prendreSiOfferte(cle)
    j.avancer('e10')
    j.prendreSiOfferte(cle)
    e = j.avancer('e20')
    for (let q = 0; q < 3 && e.rencontre?.sorte === 'elite'; q++) {
      if (e.rencontre.main.includes(cle)) {
        preparer?.(j)
        e = j.etat()
        if (e.rencontre!.tour.phase === 'preparation') e = j.voir(10)
        if (e.rencontre!.tour.phase === 'question' && refusDUneCarte(j.depart, e, cle, j.questions) === null) return j
      }
      e = j.repondre(false)
    }
  }
  throw new Error(`aucune graine ne met ${cle} dans une main où elle se joue`)
}

test('chaque coup de pouce, levé, promet ce que le serveur fait — rien de plus contre l’adversaire —, joué, il vise la question et rejoint la défausse', async () => {
  const { apercuALaMise, changementDeLaCarte } = await pieces()
  for (const cle of COUPS_DE_POUCE) {
    const j = dansLaMain(cle)
    const avant = j.vue()
    assert.equal(avant.refus[cle], null, `${cle} se joue ici`)
    const promis = changementDeLaCarte(avant, 10, 'Histoire', cle)!
    assert.deepEqual(promis.avant, apercuALaMise(avant, 10, 'Histoire'))
    let e = j.jouer(cle)
    assert.ok(e.rencontre!.tour.surLaQuestion.includes(cle) && e.cycle!.defausse.includes(cle), `${cle} : sur la question, puis à la défausse`)
    assert.deepEqual(promis.apres, apercuALaMise(j.vue(), 10, 'Histoire'))
    assert.equal(promis.apres.juste.brises, promis.avant.juste.brises, `${cle} : une aide, pas un cran de plus`)
    e = j.repondre(true)
    assert.equal(e.coup!.brises, promis.apres.juste.brises, `${cle} : les crans promis`)
  }
})

test('dans le pli, une bonne réponse composée prend deux crans — trois sous Concentration —, et une lettre de trop s’efface comme une réponse', () => {
  const j = dansLaMain('concentration', k => void k.poser({ forme: 'lettres', tiree: 'lettres', reponses: 13 }))
  const vue = j.vue()
  assert.equal(vue.annonce?.forme ?? 'lettres', 'lettres')
  assert.equal(vue.apercu!.juste.brises, CRANS_D_UNE_QUESTION_DURE)
  j.jouer('concentration')
  assert.equal(j.vue().apercu!.juste.brises, CRANS_D_UNE_QUESTION_DURE + 1)
  const e = j.repondre(true)
  assert.equal(e.coup!.brises, CRANS_D_UNE_QUESTION_DURE + 1)
  // Coup d'œil sur une question à composer : une lettre de trop de moins, comptée comme une réponse effacée.
  const k = dansLaMain('coup-d-oeil', x => void x.poser({ forme: 'lettres', tiree: 'lettres', reponses: 13 }))
  k.jouer('coup-d-oeil')
  assert.equal(k.vue().effacees, 1)
})

// ── Par les routes ──────────────────────────────────────────────────────────

/** Des réponses qui se composent : deux mots au plus, de quatre à douze lettres. */
const MOTS = [
  'Sophocle', 'Eschyle', 'Euripide', 'Pindare', 'Platon', 'Socrate', 'Aristote', 'Hérodote', 'Plutarque', 'Virgile', 'Horace', 'Ovide',
  'Lucrèce', 'Sénèque', 'Cicéron', 'Tacite', 'Suétone', 'Juvénal', 'Catulle', 'Properce', 'Tibulle', 'Pétrone', 'Apulée', 'Plaute',
  'Térence', 'Salluste', 'Tite-Live', 'Victor Hugo', 'Émile Zola', 'Balzac', 'Flaubert', 'Stendhal', 'Molière', 'Racine', 'Corneille',
  'Voltaire', 'Rousseau', 'Diderot', 'Montaigne', 'Rabelais', 'Ronsard', 'Villon', 'Pascal', 'Descartes', 'Colette', 'Proust', 'Camus',
  'Sartre', 'Beauvoir', 'Duras', 'Gide', 'Mauriac', 'Cocteau', 'Apollinaire', 'Verlaine', 'Rimbaud', 'Baudelaire', 'Mallarmé', 'Nerval',
]

/** Une question d'Histoire à composer — 2 facile, 3 moyenne, 4 difficile —, ses mauvaises réponses et trois leurres de plus. */
function question(i: number, difficulte: number): QuestionDeLaBase {
  const choix = [0, 1, 2, 3, 4, 5, 6].map(k => MOTS[(i * 7 + k) % MOTS.length])
  const lu = lireQuestionDeLaBase({
    id: `pouce${String(i).padStart(3, '0')}`,
    texte: `Qui est l’auteur ancien numéro ${i} de l’essai ?`,
    reponses: choix.slice(0, 4),
    bonne: 0,
    anecdote: `L'anecdote de l’auteur ${i}.`,
    categorie: 'Histoire',
    sousTheme: SOUS_THEMES.Histoire[0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: { valeur: String(1000 + i * 7), precision: 'annee' },
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: choix.slice(1),
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${i} : ${lu.refus}`)
  return lu.question
}

const BASE = new BaseDeLaCampagne([2, 3, 4].flatMap((d, m) => Array.from({ length: 30 }, (_, i) => question(m * 30 + i, d))))

let banc: Banc

before(async () => {
  banc = await demarrer({ baseDeLaCampagne: BASE, questionAuCentre: true })
})

after(() => banc.close())

const lire = (cookie: string, chemin: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (cookie: string, chemin: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(fn: (db: Database.Database) => T, ecriture = false): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: !ecriture, fileMustExist: true })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

interface QuestionGardee {
  texte: string
  reponses: string[]
  bonne: number
  forme?: string
  tuiles?: string[]
  enTrop?: number[]
  proposee?: string
}

/** Les questions telles que l'expédition les garde, bonne réponse comprise : ce que seul le serveur sait. */
const questionsDe = (id: string): QuestionGardee[] => base(db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions))

/**
 * Partir en question au centre, puis récrire le départ gardé — le premier
 * étage en escales à composer, et ce que `forcer` y change —, et redémarrer
 * le serveur pour qu'il le relise.
 */
async function partirAComposer(cookie: string, corps: object = {}, forcer: (d: DepartDExpedition) => void = () => {}): Promise<VueDeLExpedition> {
  const r = await poster(cookie, '/api/expedition', { rencontres: true, questionAuCentre: true, ...corps })
  assert.equal(r.status, 200, r.corps.error)
  const v = r.corps as VueDeLExpedition
  base(db => {
    const d = JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(v.id) as { expedition: string }).expedition) as DepartDExpedition
    for (const e of d.cartes[0].escales) if (e.etage === 0) Object.assign(e, { sorte: 'question', theme: { categories: ['Histoire'] }, forme: 'lettres', chance: 0.5 })
    forcer(d)
    db.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(d), v.id)
  }, true)
  await banc.redemarrer()
  return (await lire(cookie, '/api/expedition')).corps.expedition
}

const geste = (cookie: string, v: VueDeLExpedition, g: unknown) => poster(cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: g })

test('par les routes : une question à composer — ses cases et ses tuiles, jamais ses réponses ; ses lettres jugées au serveur, deux crans ; fausse, ce qu’il a composé, gardé et corrigé', async () => {
  const c = await inscrireProfil(banc.url, 'pouce1', 'Pouce')
  let v = await partirAComposer(c)
  // Le départ prend la version de la préproduction : les curiosités (v12) et la frise (v13) prolongent les coups de pouce, qu'elles gardent.
  assert.equal(v.cartes!.v, VERSION_DE_LA_FRISE)
  const r = await geste(c, v, { quoi: 'avancer', vers: v.carte!.depart[0] })
  assert.equal(r.status, 200, r.corps.error)
  v = r.corps.expedition
  const q = v.question!
  assert.equal(q.forme, 'lettres')
  // Invariant 1 : ni ses choix, ni sa bonne réponse ; ses cases, ses tuiles.
  assert.deepEqual(q.reponses, [])
  const gardee = questionsDe(v.id)[q.index]
  const bonne = gardee.reponses[gardee.bonne]
  const g = gabaritDe(bonne)!
  assert.ok(!JSON.stringify(v).includes(bonne), 'la bonne réponse ne part pas')
  for (const autre of gardee.reponses) assert.ok(!JSON.stringify(v).includes(`"${autre}"`), `${autre} ne part pas`)
  assert.deepEqual(q.composer!.mots, g.mots)
  assert.deepEqual(q.composer!.tuiles.map(t => t.lettre), gardee.tuiles)
  assert.equal(gardee.enTrop!.length, LETTRES_EN_TROP)
  assert.ok(!JSON.stringify(v).includes('enTrop'), 'les lettres de trop restent au serveur')
  // Une composition qui ne remplit pas ses cases — ou un choix d'une question à choix — ne se lit pas : rien ne compte.
  for (const choix of [g.lettres.slice(1), 0, `${g.lettres} `]) {
    const mal = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q.index, choix })
    assert.equal(mal.status, 400, String(choix))
    assert.equal(mal.corps.error, 'Remplis toutes ses cases, puis valide')
  }
  // Fausse : il attaque ; la page apprend ce qu'il fallait composer, et la réponse garde ce qu'il a composé.
  const fausse = g.lettres[0] === 'Z' ? `Y${g.lettres.slice(1)}` : `Z${g.lettres.slice(1)}`
  const rate = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q.index, choix: fausse })
  assert.equal(rate.status, 200, rate.corps.error)
  assert.equal(rate.corps.juste, false)
  assert.equal(rate.corps.bonneReponse, bonne)
  const ligne = base(db => db.prepare('SELECT choix, forme, joker, composee FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(v.id, q.index)) as Record<string, unknown>
  assert.deepEqual(ligne, { choix: -1, forme: 'lettres', joker: null, composee: fausse })
  // La suivante — le même adversaire, une autre question à composer : juste, elle lui prend deux crans.
  v = rate.corps.expedition
  const q2 = v.question!
  assert.equal(q2.forme, 'lettres')
  const g2 = gabaritDe(questionsDe(v.id)[q2.index].reponses[questionsDe(v.id)[q2.index].bonne])!
  const juste = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q2.index, choix: g2.lettres })
  assert.equal(juste.status, 200, juste.corps.error)
  assert.equal(juste.corps.juste, true)
  assert.equal(juste.corps.coup.brises, CRANS_D_UNE_QUESTION_DURE)
  assert.equal(CRANS_DES_RENCONTRES.question[0], CRANS_D_UNE_QUESTION_DURE, 'l’escale du bas tombe d’une seule réponse composée')
  // « Mes réponses » : la bonne seule, et ce qu'il a composé, dans ses cases.
  const fin = await poster(c, `/api/expedition/${v.id}/abandon`)
  assert.equal(fin.status, 200, fin.corps.error)
  const correction = (await lire(c, `/api/campagne/serie/${v.id}/correction`)).corps
  assert.deepEqual(correction[q.index], {
    texte: gardee.texte,
    reponses: [bonne, compositionDite(g.mots, fausse)],
    bonne: 0,
    choix: 1,
    juste: false,
    niveau: correction[q.index].niveau,
    anecdote: correction[q.index].anecdote,
    composee: fausse,
  })
  assert.deepEqual([correction[q2.index].reponses, correction[q2.index].choix, correction[q2.index].juste], [[questionsDe(v.id)[q2.index].reponses[questionsDe(v.id)[q2.index].bonne]], 0, true])
})

test('par les routes : Simplifier repose une question à composer en vrai ou faux — ses tuiles s’en vont, sa réponse se choisit', async () => {
  const c = await inscrireProfil(banc.url, 'pouce2', 'Simple')
  // Le Métamorphe part avec Simplifier : une graine où elle est dans la main de l'acte.
  let v = await partirAComposer(c, { style: 'metamorphe' }, d => {
    for (let k = 0; k < 5000; k++) {
      const essai = new Journal({ ...d, graine: `simplifier:${k}` })
      const e = essai.avancer(d.cartes[0].depart[0])
      if (e.rencontre?.main.includes('simplifier')) {
        d.graine = essai.depart.graine
        return
      }
    }
    throw new Error('aucune graine ne met Simplifier en main')
  })
  v = (await geste(c, v, { quoi: 'avancer', vers: v.carte!.depart[0] })).corps.expedition
  assert.equal(v.question!.forme, 'lettres')
  assert.equal(v.rencontre!.refus.simplifier, null)
  const r = await geste(c, v, { quoi: 'jouer', joker: 'simplifier', position: v.question!.index })
  assert.equal(r.status, 200, r.corps.error)
  v = r.corps.expedition
  const q = v.question!
  assert.equal(q.forme, 'vrai-faux')
  assert.deepEqual(q.reponses, ['Vrai', 'Faux'])
  assert.ok(q.proposee, 'sa réponse proposée')
  assert.equal(q.composer, undefined)
  const gardee = questionsDe(v.id)[q.index]
  assert.deepEqual([gardee.tuiles, gardee.enTrop], [undefined, undefined])
  const rep = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q.index, choix: gardee.bonne })
  assert.equal(rep.status, 200, rep.corps.error)
  assert.equal(rep.corps.juste, true)
})

/**
 * Un coup de pouce en main à la première rencontre : le coffre du premier pas
 * le propose — son codex, au niveau 1, n'ouvre que lui aux offres —, il le
 * prend, et la main de l'acte le tire après la première question de l'escale
 * d'après — ouverte avant le coffre, elle ne le tire qu'à son tour : une
 * graine cherchée par le vrai pli. L'escale d'après pose ses questions à
 * cette forme.
 */
function forcerLeCoupDePouce(d: DepartDExpedition, cle: string, forme: FormeDEscale): { coffre: string; question: string } {
  d.codex = { ...codexDuNiveau(1, [], [], V), cartes: [cle] }
  const carte = d.cartes[0]
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  const coffre = parId.get(carte.depart[0])!
  coffre.sorte = 'coffre'
  delete coffre.theme
  delete coffre.forme
  delete coffre.chance
  const question = parId.get(coffre.suite[0])!
  Object.assign(question, { sorte: 'question', theme: { categories: ['Histoire'] }, forme, chance: 0.5 })
  const gestes: GesteDExpedition[] = [
    { quoi: 'avancer', vers: coffre.id },
    { quoi: 'prendre', jokers: [cle] },
    { quoi: 'avancer', vers: question.id },
  ]
  // Sa première question, ratée : l'adversaire reste, et la main tire.
  const premiere = { escale: question.id, acte: 0, reponses: forme === 'lettres' ? 13 : 4, niveau: 'facile' as const, tiree: forme, ...(forme !== 'quatre' && { forme }), six: false, datee: true, categorie: 'Histoire' }
  for (let k = 0; k < 5000; k++) {
    const essai = { ...d, graine: `pouce:${cle}:${k}` }
    if (!pliDeLExpedition(essai, gestes.slice(0, 1), [], new Map()).offre?.jokers.includes(cle)) continue
    if (pliDeLExpedition(essai, gestes, [premiere], new Map([[0, false]])).cycle?.main.includes(cle)) {
      d.graine = essai.graine
      return { coffre: coffre.id, question: question.id }
    }
  }
  throw new Error(`aucune graine ne met ${cle} en main`)
}

/** Le coffre, le coup de pouce pris, l'escale d'après, sa première question ratée : la suivante sous les yeux, et la carte jouée sur elle. */
async function jusquAuCoupDePouce(c: string, cle: string, forme: FormeDEscale): Promise<VueDeLExpedition> {
  let chemin = { coffre: '', question: '' }
  let v = await partirAComposer(c, {}, d => {
    chemin = forcerLeCoupDePouce(d, cle, forme)
  })
  v = (await geste(c, v, { quoi: 'avancer', vers: chemin.coffre })).corps.expedition
  assert.deepEqual(v.offre?.jokers, [cle], 'le coffre le propose')
  v = (await geste(c, v, { quoi: 'prendre', jokers: [cle] })).corps.expedition
  v = (await geste(c, v, { quoi: 'avancer', vers: chemin.question })).corps.expedition
  const premiere = questionsDe(v.id)[v.question!.index]
  const ratee = forme === 'lettres' ? 'Z'.repeat(gabaritDe(premiere.reponses[premiere.bonne])!.lettres.length) : (premiere.bonne + 1) % 4
  v = (await poster(c, `/api/expedition/${v.id}/reponse`, { position: v.question!.index, choix: ratee })).corps.expedition
  assert.equal(v.question?.forme ?? 'quatre', forme)
  assert.equal(v.rencontre!.refus[cle], null, `${cle} se joue`)
  const r = await geste(c, v, { quoi: 'jouer', joker: cle, position: v.question!.index })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps.expedition
}

test('par les routes : chaque coup de pouce souffle ce que le serveur calcule — à choix, une ligne ; à composer, ses lettres dans les cases ; la réponse aidée garde sa carte', async () => {
  for (const cle of COUPS_DE_POUCE) {
    const c = await inscrireProfil(banc.url, `pouce-${cle}`, 'Pouce')
    const v = await jusquAuCoupDePouce(c, cle, 'quatre')
    const q = v.question!
    const gardee = questionsDe(v.id)[q.index]
    const bonne = gardee.reponses[gardee.bonne]
    assert.equal(q.pouces?.length, 1, cle)
    if (cle === 'repere') assert.match(q.pouces![0], /^Son époque : les années \d+0$/)
    if (cle === 'initiale') assert.equal(q.pouces![0], `Elle commence par ${signesDe(bonne)[0][0]}`)
    if (cle === 'lettre') assert.ok(signesDe(bonne).join('').includes(/un ([A-Z])$/.exec(q.pouces![0])![1]), q.pouces![0])
    const rep = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q.index, choix: gardee.bonne })
    assert.equal(rep.status, 200, rep.corps.error)
    const ligne = base(db => db.prepare('SELECT joker FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(v.id, q.index)) as { joker: string }
    assert.equal(ligne.joker, cle, 'une réponse aidée ne mesure rien')
  }
  // À composer, L'initiale pose sa lettre en tête, et sa tuile s'en va.
  const c = await inscrireProfil(banc.url, 'pouce-composee', 'Pouce')
  const v = await jusquAuCoupDePouce(c, 'initiale', 'lettres')
  const q = v.question!
  const gardee = questionsDe(v.id)[q.index]
  const g = gabaritDe(gardee.reponses[gardee.bonne])!
  assert.equal(q.pouces, undefined, 'rien à dire : la lettre est dans sa case')
  assert.deepEqual(q.composer!.posees, [{ rang: 0, lettre: g.lettres[0] }])
  assert.equal(q.composer!.tuiles.length, gardee.tuiles!.length - 1)
  const rep = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q.index, choix: g.lettres })
  assert.equal(rep.corps.juste, true)
})

// ── L'écran ─────────────────────────────────────────────────────────────────

/** La page, chargée par son adresse : le typage du serveur ne lit pas le JSX du client. */
const page = (): Promise<{ ComposerLaReponse: Composant; LaBonneReponse: Composant }> => import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)

test('à l’écran : ses cases mot par mot, l’article devant, les signes et les lettres posées d’office, ses tuiles dessous ; la révélation dit ce qu’il a composé', async () => {
  const { ComposerLaReponse, LaBonneReponse } = await page()
  // « La Sainte-Barbe », L'initiale jouée : l'article devant, le trait d'union posé, le S en tête.
  const composer = questionAComposer('g', 0, { reponses: ['La Sainte-Barbe'], bonne: 0, ...tuilesDe(gabaritDe('La Sainte-Barbe')!.lettres, graine('barbe')) }, 0, ['initiale'])!
  const html = await rendre(ComposerLaReponse, { composer, busy: false, onValider: rien })
  const t = texte(html)
  assert.match(html, /<span class="exp-article">La<\/span>/)
  assert.equal((html.match(/class="exp-case[" ]/g) ?? []).length, gabaritDe('La Sainte-Barbe')!.lettres.length, 'une case par lettre')
  assert.match(html, /<span class="exp-signe" aria-hidden="true">-<\/span>/)
  assert.match(html, /class="exp-case exp-case-posee"[^>]*aria-label="Lettre 1 : S, posée d’office"/)
  assert.equal((html.match(/class="exp-tuile"/g) ?? []).length, composer.tuiles.length)
  assert.match(t, /Effacer/)
  assert.match(t, new RegExp(`Encore ${gabaritDe('La Sainte-Barbe')!.lettres.length - 1} lettres`), 'Valider attend que tout soit plein')
  // La révélation : ce qu'il a composé, dans ses cases, et ce qu'il fallait composer.
  const lu = (x: string) => texte(x).trim()
  const question = { reponses: [], composer: questionAComposer('g', 0, { reponses: ['Victor Hugo'], bonne: 0, ...tuilesDe('VICTORHUGO', graine('v')) }, 0, [])! }
  assert.equal(lu(await rendre(LaBonneReponse, { question, reponse: { bonne: 0, juste: false, bonneReponse: 'Victor Hugo' }, choix: 0, composee: 'VICTORHUGE' })), 'Tu as composé VICTOR HUGE — c’était Victor Hugo')
  assert.equal(lu(await rendre(LaBonneReponse, { question, reponse: { bonne: 0, juste: true, bonneReponse: 'Victor Hugo' }, choix: 0, composee: 'VICTORHUGO' })), 'La bonne réponse : Victor Hugo')
  // Une case vide a une largeur, pas seulement une base : sans, son mot tombait à zéro dans sa rangée, et toutes ses cases avec — elles
  // n'existaient qu'au balisage (le rendu en 360 × 640, le 19 octobre 2026).
  const regle = /\.exp-case \{([^}]*)\}/.exec(readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8'))?.[1] ?? ''
  assert.match(regle, /(?:^|;)\s*width: \d+px/, `.exp-case {${regle}}`)
})

test('les règles de la version 11 disent la forme à composer et les coups de pouce ; celles de la version 10 n’en disent rien', async () => {
  const { FeuilleDesRegles } = (await pieces()) as unknown as { FeuilleDesRegles: Composant }
  const regles = async (v: number) => texte(await rendre(FeuilleDesRegles, { rencontres: true, v, codex: codexDuNiveau(1, [], [], v), ascension: 0, onFermer: rien }))
  const onze = await regles(V)
  assert.match(onze, /À composer : pas de choix — touche ses lettres dans l’ordre de la réponse\. Trois sont de trop : les cartes qui effacent les retirent\./)
  assert.match(onze, /Les coups de pouce te soufflent la réponse/)
  assert.match(onze, /deux à six choix, à composer, ou/)
  const dix = await regles(VERSION_DE_LA_QUESTION_AU_CENTRE)
  assert.doesNotMatch(dix, /À composer|coups de pouce/)
})
