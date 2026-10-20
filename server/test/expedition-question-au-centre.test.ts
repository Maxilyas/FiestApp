// La question au centre (la version 10 du départ, le 19 octobre 2026 —
// l'étape 2 du plan validé par le propriétaire, `retours/2026-10-19/la-question-au-centre.md`).
// Un testeur : « Ça fait pas trop sens de jouer une carte avant de voir une
// question […] faut exploiter davantage le système de question que le système
// de combat » ; le propriétaire : « Une carte par question. Les cartes
// reviennent à l'acte suivant. Rempart en pause. » L'adversaire en crans —
// des bonnes réponses —, son attaque toujours la même ; la question d'abord,
// une carte par question, sans énergie ; la main de l'acte, gardée d'une
// question à l'autre, sa défausse rendue à l'acte suivant ; le pari seul
// avant la question. Les règles et le pli, puis les routes — le drapeau qui
// l'ouvre en préproduction seulement, la question gardée tant qu'il parie —,
// puis l'écran. Les versions d'avant se rejouent à leurs règles :
// `expedition-rencontres.test.ts` et les autres.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { questionAuCentreOuverte } from '../src/expedition'
import { CATEGORIES } from '../../shared/categories'
import {
  ASCENSION_EN_QUESTION,
  ECHELLE_EN_QUESTION,
  EXPLOITS,
  FRAPPE_EN_ASCENSION,
  NIVEAU_MAX,
  ascensionDe,
  codexDuNiveau,
  cransDeLAdversaire,
  frappeDeLAdversaire,
  mainMaxEnQuestion,
  offreDuCodex,
  ouvertureDe,
  stylesDuNiveau,
} from '../../shared/codex'
import {
  BASES_REMPLACEES_EN_QUESTION,
  CARTES_DE_DEPART_DU_STYLE,
  CARTES_DES_RENCONTRES,
  COURAGE_MAX,
  CRANS_DES_RENCONTRES,
  CRANS_DE_POLYMORPHE,
  CRANS_D_UNE_QUESTION_DURE,
  FAMILLES_DE_CARTES,
  MAIN_A_L_OUVERTURE_DE_L_ACTE,
  MAIN_MAX_EN_QUESTION,
  MAIN_MAX_SOUS_TROIS_TETES,
  PAQUET_EN_QUESTION,
  QUESTION_AU_CENTRE_EN_PRODUCTION,
  RETIREES_EN_QUESTION,
  STYLES,
  STYLES_EN_QUESTION,
  VERSION_DE_LA_QUESTION_AU_CENTRE,
  VERSION_DES_FAMILLES,
  VERSION_DU_DETAIL,
  VERSION_DES_HUIT_FAMILLES,
  carteALaVersion,
  carteDeRencontre,
  cransDeLaForme,
  estDuPari,
  paquetDesRencontres,
  refusDeLaCarte,
  seJoueEnQuestion,
  type CarteDeRencontre,
  type ContexteDUneCarte,
  type VueDeLaRencontre,
} from '../../shared/rencontres'
import { GARDIEN, refusDUneCarte, type DepartDExpedition, type FormeDEscale, type VueDeLExpedition } from '../../shared/expedition'
import { Journal, depart, pieces, rien, texte, type Composant } from './expedition-journal'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

const V = VERSION_DE_LA_QUESTION_AU_CENTRE

/** Un départ de la question au centre, à ce niveau du codex : le pari dès le niveau 2. Ses offres ne tirent que les cartes de l'essai, s'il en dit. */
const enQuestion = (graine: string, niveau = NIVEAU_MAX, plus: Partial<DepartDExpedition> = {}, cartes?: string[]): DepartDExpedition => {
  const codex = codexDuNiveau(niveau, [], [], V)
  return depart(graine, [], { v: V, codex: { ...codex, cartes: cartes ?? codex.cartes }, ...plus })
}

/** Les cartes de la question au centre, telles qu'elle les joue. */
const EN_QUESTION: readonly CarteDeRencontre[] = CARTES_DES_RENCONTRES.filter(c => seJoueEnQuestion(c.cle)).map(c => carteALaVersion(c.cle, V)!)

// ── Ce qu'elle garde, ce qu'elle retire ─────────────────────────────────────

test('soixante-deux cartes restent, quarante-deux partent — aucune ne s’y joue, ne s’y ouvre ni ne s’y offre ; l’échelle ouvre chaque carte à gagner une fois', () => {
  assert.equal(EN_QUESTION.length, 62)
  assert.equal(RETIREES_EN_QUESTION.size, 42)
  // Les coups de pouce viennent après elle (v11, `expedition-coups-de-pouce.test.ts`) : une expédition de la version 10 ne les connaît pas.
  assert.equal(EN_QUESTION.length + RETIREES_EN_QUESTION.size, CARTES_DES_RENCONTRES.filter(c => (c.depuis ?? 0) <= V).length, 'chaque carte reste ou part')
  for (const cle of RETIREES_EN_QUESTION) {
    assert.ok(carteDeRencontre(cle), `${cle} est une carte`)
    assert.equal(seJoueEnQuestion(cle), false, cle)
    assert.equal(carteALaVersion(cle, V), undefined, cle)
    assert.equal(ouvertureDe(cle, V), null, `${cle} ne s’ouvre plus`)
    // Les versions d'avant la gardent, telle qu'elles l'ont jouée.
    assert.ok(carteALaVersion(cle, VERSION_DES_HUIT_FAMILLES), cle)
  }
  // Ni énergie, ni épuisement : une carte de la question au centre ne coûte rien, et revient à l'acte suivant.
  for (const c of EN_QUESTION) {
    assert.equal(c.cout, 0, c.cle)
    assert.equal(c.epuisement, undefined, c.cle)
    assert.equal(c.unique, undefined, c.cle)
  }
  // L'échelle : chaque carte à gagner une fois — ni légendaire, ni carte d'exploit —, aucune retirée.
  const exploits = new Set(EXPLOITS.map(x => x.carte))
  const aGagner = EN_QUESTION.filter(c => !c.legendaire && !exploits.has(c.cle)).map(c => c.cle)
  const echelle = ECHELLE_EN_QUESTION.flatMap(m => m.cartes)
  assert.equal(echelle.length, new Set(echelle).size, 'aucune deux fois')
  assert.deepEqual([...echelle].sort(), [...aGagner].sort())
  assert.equal(echelle.length, 36)
  // Au codex entier, ses exploits faits : toutes les cartes qui restent, sauf celles des légendaires qu'il n'a pas.
  const tout = codexDuNiveau(NIVEAU_MAX, [], EXPLOITS.map(x => x.cle), V)
  assert.deepEqual(
    tout.cartes,
    EN_QUESTION.filter(c => !c.legendaire).map(c => c.cle),
  )
  for (let k = 0; k < 200; k++) {
    for (const cle of offreDuCodex(`centre:offre:${k}`, k % 6, tout.cartes, [], { commun: 3, rare: 2, epique: 1, maudit: 1 })) {
      assert.equal(seJoueEnQuestion(cle), true, `${cle} offerte`)
    }
  }
})

test('cinq styles : le Rempart attend l’étape 6, le Sophiste et le Téméraire partent ; chaque paquet de départ ne tient que des cartes de la question au centre', () => {
  assert.deepEqual(stylesDuNiveau(NIVEAU_MAX, V), [...STYLES_EN_QUESTION])
  assert.deepEqual(stylesDuNiveau(1, V), ['devin', 'erudit', 'metamorphe'], 'trois au niveau 1, le Métamorphe à la place du Rempart')
  for (const s of ['rempart', 'sophiste', 'temeraire'] as const) assert.ok(!STYLES_EN_QUESTION.includes(s), s)
  assert.deepEqual(paquetDesRencontres([], undefined, V), [...PAQUET_EN_QUESTION].sort())
  for (const s of STYLES_EN_QUESTION) {
    const paquet = paquetDesRencontres([], s, V)
    assert.equal(paquet.length, PAQUET_EN_QUESTION.length, s)
    for (const cle of paquet) assert.ok(seJoueEnQuestion(cle), `${s} : ${cle}`)
    for (const cle of CARTES_DE_DEPART_DU_STYLE[s]) assert.ok(paquet.includes(cle), `${s} part avec ${cle}`)
    // Ce qu'elles remplacent est de même usage : un indice pour un indice, une carte qui frappe pour une Concentration.
    const sans = [...PAQUET_EN_QUESTION]
    for (const b of BASES_REMPLACEES_EN_QUESTION[s]!) sans.splice(sans.indexOf(b), 1)
    assert.deepEqual(paquet, [...sans, ...CARTES_DE_DEPART_DU_STYLE[s]].sort(), s)
  }
  // Un style qu'elle n'a pas — un téléphone qui le retiendrait — n'y change rien.
  for (const s of STYLES.filter(x => !STYLES_EN_QUESTION.includes(x))) assert.deepEqual(paquetDesRencontres([], s, V), [...PAQUET_EN_QUESTION].sort(), s)
})

// ── L'adversaire en crans ───────────────────────────────────────────────────

test(`l’adversaire en crans : ${CRANS_DES_RENCONTRES.question.join('-')} pour une escale, ${CRANS_DES_RENCONTRES.elite.join('-')} pour une élite, ${CRANS_DES_RENCONTRES.gardien.join('-')} pour un gardien ; une bonne réponse en prend un, ${CRANS_D_UNE_QUESTION_DURE} à six choix ou trouvée tôt, ${CRANS_DE_POLYMORPHE} sous Polymorphe`, () => {
  for (const sorte of ['question', 'elite', 'gardien'] as const) {
    for (const acte of [0, 1, 2]) assert.equal(cransDeLAdversaire(sorte, acte, 0), CRANS_DES_RENCONTRES[sorte][acte], `${sorte}, acte ${acte + 1}`)
  }
  for (const acte of [0, 1, 2]) {
    assert.ok(CRANS_DES_RENCONTRES.elite[acte] > CRANS_DES_RENCONTRES.question[acte], 'une élite demande plus')
    assert.ok(CRANS_DES_RENCONTRES.gardien[acte] >= CRANS_DES_RENCONTRES.elite[acte], 'un gardien au moins autant')
  }
  const forme = (f: FormeDEscale, reponses: number, devoile?: { mots: number; sur: number }) => cransDeLaForme({ forme: f, reponses, ...(devoile && { devoile }) })
  assert.deepEqual([forme('quatre', 4), forme('vrai-faux', 2), forme('six', 6)], [1, 1, CRANS_D_UNE_QUESTION_DURE], 'un vrai ou faux vaut un cran, comme quatre choix')
  assert.equal(cransDeLaForme({ forme: 'six', reponses: 6 }, ['polymorphe']), CRANS_DE_POLYMORPHE)
  // Un dévoilement trouvé avant la moitié de ses mots, deux crans ; après, un.
  assert.deepEqual([forme('devoilement', 4, { mots: 1, sur: 10 }), forme('devoilement', 4, { mots: 5, sur: 10 }), forme('devoilement', 4, { mots: 6, sur: 10 })], [CRANS_D_UNE_QUESTION_DURE, CRANS_D_UNE_QUESTION_DURE, 1])
  // Deux réponses effacées sur quatre, il n'en reste que deux : elle vaut un cran, comme un vrai ou faux.
  assert.equal(forme('six', 2), 1)

  // Dans le pli : ses crans, son attaque qui ne grandit plus d'une question à l'autre.
  const j = new Journal(enQuestion('crans', 1))
  let e = j.avancer('e00')
  const r = e.rencontre!
  assert.deepEqual([r.sceaux, r.max, r.enCrans], [CRANS_DES_RENCONTRES.question[0], CRANS_DES_RENCONTRES.question[0], true])
  assert.equal(r.frappe, frappeDeLAdversaire('question', 0, 0))
  e = j.repondre(false)
  const premiere = e.coup!.frappe
  e = j.repondre(false)
  assert.deepEqual([premiere, e.coup!.frappe], [r.frappe, r.frappe], 'toujours la même attaque')
  assert.equal(e.courage, COURAGE_MAX - 2 * r.frappe)
  e = j.repondre(true)
  assert.deepEqual([e.coup!.juste, e.coup!.brises, e.rencontre!.sceaux], [true, 1, CRANS_DES_RENCONTRES.question[0] - 1])
})

test('l’Ascension retraduite : une bonne réponse de plus aux élites et aux gardiens, une encore aux gardiens du cran 5, une carte de moins dans la main au cran 4 ; l’attaque et le repos comme avant', () => {
  assert.equal(ascensionDe(V), ASCENSION_EN_QUESTION)
  assert.equal(ASCENSION_EN_QUESTION.length, 5)
  for (const acte of [0, 1, 2]) {
    assert.equal(cransDeLAdversaire('question', acte, 5), CRANS_DES_RENCONTRES.question[acte], 'une escale à question ne change pas')
    assert.equal(cransDeLAdversaire('elite', acte, 1), CRANS_DES_RENCONTRES.elite[acte] + 1)
    assert.equal(cransDeLAdversaire('gardien', acte, 4), CRANS_DES_RENCONTRES.gardien[acte] + 1)
    assert.equal(cransDeLAdversaire('gardien', acte, 5), CRANS_DES_RENCONTRES.gardien[acte] + 2)
  }
  assert.deepEqual([mainMaxEnQuestion(false, 3), mainMaxEnQuestion(false, 4), mainMaxEnQuestion(true, 0), mainMaxEnQuestion(true, 4)], [MAIN_MAX_EN_QUESTION, MAIN_MAX_EN_QUESTION - 1, MAIN_MAX_SOUS_TROIS_TETES, MAIN_MAX_SOUS_TROIS_TETES - 1])
  // Le pli : au cran 2, l'attaque de plus ; au cran 4, la main pleine à trois.
  const j = new Journal(enQuestion('ascension', 1, { ascension: 4 }))
  let e = j.avancer('e00')
  assert.equal(e.rencontre!.frappe, frappeDeLAdversaire('question', 0, 0) + FRAPPE_EN_ASCENSION)
  e = j.repondre(false)
  e = j.repondre(false)
  assert.equal(e.cycle!.main.length, MAIN_MAX_EN_QUESTION - 1, 'trois cartes au plus')
})

// ── Le tour ─────────────────────────────────────────────────────────────────

test('le tour s’ouvre sur la question : au niveau 1, sans pari, d’emblée ; dès le pari, l’annonce d’abord ; un dévoilement aussi, dont les mots ne courent qu’une fois vus', () => {
  const debutant = new Journal(enQuestion('tour:1', 1))
  let e = debutant.avancer('e00')
  assert.equal(e.pari, false)
  assert.equal(e.rencontre!.tour.phase, 'question', 'la question d’abord')
  assert.equal(debutant.vue().phase, 'question')
  // Un dévoilement, même au niveau 1 : l'annonce, puis « Voir la question ».
  debutant.poser({ forme: 'devoilement', mots: 10 })
  assert.equal(debutant.etat().rencontre!.tour.phase, 'preparation')
  e = debutant.voir(0)
  assert.equal(e.rencontre!.tour.phase, 'question')

  const aguerri = new Journal(enQuestion('tour:max'))
  e = aguerri.avancer('e00')
  assert.equal(e.pari, true)
  assert.equal(e.rencontre!.tour.phase, 'preparation', 'l’annonce et son pari')
  const v = aguerri.vue()
  assert.ok(v.mises && v.mises[10] === null, 'le pari se choisit')
  assert.deepEqual(aguerri.voir(10).rencontre!.tour, { ...e.rencontre!.tour, phase: 'question', mise: 10 }, 'voir dit la mise, et ne touche à rien d’autre')
})

test('la main de l’acte : trois cartes à son ouverture, une après chaque question, quatre au plus ; gardée d’une rencontre à l’autre ; jouée, une carte part à la défausse, qui revient à l’acte suivant', () => {
  const j = new Journal(enQuestion('main', 1))
  let e = j.etat()
  const paquet = e.paquet
  assert.equal(e.cycle!.main.length, MAIN_A_L_OUVERTURE_DE_L_ACTE)
  assert.equal(e.cycle!.pioche.length, paquet.length - MAIN_A_L_OUVERTURE_DE_L_ACTE)
  e = j.avancer('e00')
  assert.deepEqual(e.rencontre!.main, e.cycle!.main, 'la rencontre tient la main de l’acte')
  const avant = [...e.cycle!.main]
  // Une carte jouée : elle part à la défausse, et la question suivante en tire une.
  const jouee = avant.find(cle => refusDUneCarte(j.depart, e, cle, j.questions) === null)!
  e = j.jouer(jouee)
  assert.deepEqual([e.cycle!.main.length, e.cycle!.defausse], [MAIN_A_L_OUVERTURE_DE_L_ACTE - 1, [jouee]])
  e = j.repondre(false)
  assert.equal(e.cycle!.main.length, MAIN_A_L_OUVERTURE_DE_L_ACTE, 'une carte vient après la question')
  e = j.repondre(false)
  assert.equal(e.cycle!.main.length, MAIN_MAX_EN_QUESTION)
  e = j.repondre(false)
  assert.equal(e.cycle!.main.length, MAIN_MAX_EN_QUESTION, 'quatre au plus : la suivante reste dans la pioche')
  const gardee = [...e.cycle!.main]
  j.gagner()
  j.prendreSiOfferte()
  e = j.avancer('e10')
  j.prendreSiOfferte()
  e = j.avancer('e20')
  assert.deepEqual(e.rencontre!.main, gardee, 'ce qu’il n’a pas joué, il le garde')
  assert.deepEqual(e.cycle!.defausse, [jouee], 'pas de remélange en route')
  // L'acte suivant : tout revient, et la main en tire trois.
  j.gagner()
  j.prendreSiOfferte()
  j.avancer('e30')
  j.gagner()
  j.prendreSiOfferte()
  j.avancer('cg')
  j.geste({ quoi: 'camper' })
  j.avancer(GARDIEN)
  e = j.gagner()
  assert.equal(e.acte, 1)
  // Tout son paquet de combat — la carte du gardien vaincu comprise —, moins les trois de la main.
  const deCombat = e.paquet.filter(cle => carteALaVersion(cle, V)?.moment !== 'route' && (e.pari || !estDuPari(cle))).length
  assert.deepEqual([e.cycle!.main.length, e.cycle!.defausse.length, e.cycle!.pioche.length], [MAIN_A_L_OUVERTURE_DE_L_ACTE, 0, deCombat - MAIN_A_L_OUVERTURE_DE_L_ACTE])
})

/** Le contexte d'une carte, au courage plein, sur une question d'Histoire à quatre choix — en préparation, ou la question vue. */
const contexte = (plus: Partial<ContexteDUneCarte> = {}): ContexteDUneCarte => ({
  v: V,
  tour: { phase: 'question', inspiration: 0, jouees: [], surLaQuestion: [] },
  main: EN_QUESTION.map(c => c.cle),
  pouvoirs: [],
  question: { reponses: 4, tiree: 'quatre', forme: 'quatre', six: true, nombre: false, datee: true, categorie: 'Histoire' },
  fetiche: 'Histoire',
  courage: COURAGE_MAX,
  derniereFrappe: 0,
  defausse: 1,
  pari: true,
  ...plus,
})

test('une carte par question, la question sous les yeux : la deuxième se refuse ; à l’annonce, seules celles du pari se jouent — et pas avant que le pari s’ouvre', () => {
  const avant = contexte({ tour: { phase: 'preparation', inspiration: 0, jouees: [], surLaQuestion: [] } })
  for (const c of EN_QUESTION.filter(x => x.moment !== 'route')) {
    if (estDuPari(c.cle)) {
      assert.equal(refusDeLaCarte(avant, c.cle), null, `${c.cle}, à l’annonce`)
      assert.equal(refusDeLaCarte(contexte(), c.cle), 'Elle se joue avec le pari, avant de voir la question', `${c.cle}, la question vue`)
      assert.equal(refusDeLaCarte({ ...avant, pari: false }, c.cle), 'Elle se joue avec le pari, qui n’est pas encore ouvert à ton niveau', c.cle)
    } else {
      assert.equal(refusDeLaCarte(avant, c.cle), 'Elle se joue la question sous les yeux : vois-la d’abord', `${c.cle}, à l’annonce`)
      // Une seule, la question sous les yeux — celles du pari, jouées à l'annonce, n'en sont pas (le brief : « plus, à l'annonce, celles du pari »).
      assert.equal(refusDeLaCarte(contexte({ tour: { phase: 'question', inspiration: 0, jouees: ['concentration'], surLaQuestion: [] } }), c.cle), 'Une carte par question : tu en as déjà joué une', c.cle)
      if (refusDeLaCarte(contexte(), c.cle) === null) assert.equal(refusDeLaCarte(contexte({ tour: { phase: 'question', inspiration: 0, jouees: ['banco'], surLaQuestion: [] } }), c.cle), null, `${c.cle}, après Banco`)
    }
  }
  // Le Réveil a besoin d'une défausse ; Augure attend la question suivante — il ne se refuse jamais pour un vrai ou faux.
  assert.notEqual(refusDeLaCarte(contexte({ defausse: 0 }), 'reveil'), null)
  assert.equal(refusDeLaCarte(contexte({ question: { ...contexte().question!, reponses: 2, forme: 'vrai-faux', tiree: 'vrai-faux' } }), 'augure'), null)

  // Dans le pli : la deuxième carte jouée ne fait rien.
  const j = new Journal(enQuestion('une-par-question', 1))
  let e = j.avancer('e00')
  const [premiere, seconde] = e.rencontre!.main.filter(cle => refusDUneCarte(j.depart, e, cle, j.questions) === null)
  e = j.jouer(premiere)
  assert.equal(refusDUneCarte(j.depart, e, seconde, j.questions), 'Une carte par question : tu en as déjà joué une')
  const sans = j.etat()
  e = j.jouer(seconde)
  assert.deepEqual([e.rencontre!.tour.jouees, e.cycle!.main], [sans.rencontre!.tour.jouees, sans.cycle!.main], 'refusée, elle reste dans la main')

  // Les cartes du pari dorment hors de l'acte tant que le pari n'est pas ouvert : Le trésor du Dragon d'Or, au niveau 1.
  const tresor = new Journal(enQuestion('tresor', 1, { equipee: ['lg:dragon'], invite: 'lg:dragon' })).etat()
  assert.ok(tresor.paquet.includes('tresor'))
  assert.ok(!tresor.cycle!.pioche.includes('tresor') && !tresor.cycle!.main.includes('tresor'), 'ni dans la pioche, ni dans la main')
})

/**
 * Un journal où cette carte est dans la main, et s'y joue : prise en bas puis
 * au coffre — ou là d'office, celle d'un légendaire de l'équipée —, tirée à
 * une question de l'élite ; une maudite à l'acte 2, l'acte 1 n'en offrant
 * aucune. Une carte jouée en bas, d'abord : la défausse a de quoi revenir (Le
 * réveil, Le feu d'artifice). `preparer`, la question à sa forme (Arrêt sur
 * image). Une graine cherchée, jamais choisie.
 */
function dansLaMain(cle: string, plus: Partial<DepartDExpedition> = {}, preparer?: (j: Journal) => void): Journal {
  const pari = estDuPari(cle)
  const legendaire = carteDeRencontre(cle)?.legendaire
  const maudite = carteDeRencontre(cle)!.rarete === 'maudit'
  for (let n = 0; n < 2000; n++) {
    const j = new Journal(enQuestion(`centre:${cle}:${n}`, NIVEAU_MAX, legendaire ? { equipee: [legendaire], invite: legendaire, ...plus } : plus, legendaire ? ['concentration'] : [cle]))
    if (maudite) {
      j.acte()
      j.prendreSiOfferte()
    }
    let e = j.avancer('e00')
    if (e.rencontre!.tour.phase === 'preparation') e = j.voir(0)
    const autre = e.rencontre!.main.find(k => k !== cle && k !== 'prediction' && refusDUneCarte(j.depart, e, k, j.questions) === null)
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
        if (!pari && e.rencontre!.tour.phase === 'preparation') e = j.voir(10)
        if (e.rencontre!.tour.phase === (pari ? 'preparation' : 'question') && refusDUneCarte(j.depart, e, cle, j.questions) === null) return j
      }
      e = j.repondre(false)
    }
  }
  throw new Error(`aucune graine ne met ${cle} dans une main où elle se joue`)
}

test(`chaque carte de la question au centre, levée, promet ce que le serveur fait — et sa bonne réponse prend les crans promis : ${EN_QUESTION.filter(c => c.moment !== 'route').length} cartes`, async () => {
  const { apercuALaMise, changementDeLaCarte } = await pieces()
  for (const c of EN_QUESTION.filter(x => x.moment !== 'route')) {
    // Arrêt sur image se joue sur un dévoilement, la Prédiction sur une année ou un nombre.
    const preparer = c.cle === 'arret-sur-image' ? (k: Journal) => k.poser({ forme: 'devoilement', mots: 10 }) : c.cle === 'prediction' ? (k: Journal) => k.poser({ nombre: true }) : undefined
    const j = dansLaMain(c.cle, {}, preparer)
    const avant = j.vue()
    assert.equal(avant.refus[c.cle], null, `${c.cle} se joue ici`)
    const promis = changementDeLaCarte(avant, 10, 'Histoire', c.cle)
    assert.ok(promis, `${c.cle} promet quelque chose`)
    assert.deepEqual(promis.avant, apercuALaMise(avant, 10, 'Histoire'))
    let e = c.cle === 'prediction' ? j.geste({ quoi: 'jouer', joker: c.cle, position: j.etat().enAttente!, montre: 1 }) : j.jouer(c.cle)
    assert.ok(e.rencontre!.tour.jouees.includes(c.cle), `${c.cle} jouée`)
    assert.ok(c.moment === 'pouvoir' ? e.rencontre!.pouvoirs.includes(c.cle) : e.cycle!.defausse.includes(c.cle), `${c.cle} : ses pouvoirs, sinon sa défausse`)
    assert.deepEqual(promis.apres, apercuALaMise(j.vue(), 10, 'Histoire'), `${c.cle} : la carte levée annonçait ce que le serveur a fait`)
    // Une carte du pari se joue à l'annonce : la question se voit ensuite, le pari dit.
    if (estDuPari(c.cle)) e = j.voir(10)
    e = j.repondre(true)
    if (c.cle === 'passe-muraille') {
      assert.equal(e.coup!.traversee, true, 'ni trouvée ni ratée')
      continue
    }
    assert.equal(e.coup!.brises, promis.apres.juste.brises, `${c.cle} : les crans promis`)
    assert.equal(e.coup!.mise, promis.apres.juste.ecus, `${c.cle} : le pari promis`)
  }
})

test('Augure efface d’avance la question suivante qui a de quoi effacer ; Le réveil rend la dernière carte de la défausse ; Le feu d’artifice rend toute la défausse et remplit la main ; Renaissance sauve d’une erreur fatale, une fois', () => {
  // Augure : rien sur celle-ci, une réponse effacée à la suivante.
  {
    const j = dansLaMain('augure')
    j.jouer('augure')
    assert.equal(j.vue().effacees ?? 0, 0, 'pas sur la question où il est joué')
    assert.deepEqual(j.etat().dAvance, ['augure'])
    let e = j.repondre(false)
    if (e.rencontre!.tour.phase === 'preparation') e = j.voir(0)
    assert.equal(j.vue().effacees, 1, 'la question suivante')
    assert.deepEqual(e.dAvance, [])
  }
  // Le réveil : la dernière carte jouée revient.
  {
    const j = dansLaMain('reveil')
    const defausse = [...j.etat().cycle!.defausse]
    const e = j.jouer('reveil')
    assert.ok(e.cycle!.main.includes(defausse.at(-1)!), `${defausse.at(-1)} revient`)
    assert.deepEqual(e.cycle!.defausse, [...defausse.slice(0, -1), 'reveil'])
  }
  // Le feu d'artifice : la défausse dans la pioche, puis la main pleine.
  {
    const j = dansLaMain('feu-d-artifice')
    const defausse = j.etat().cycle!.defausse.length
    assert.ok(defausse > 0, 'de quoi revenir')
    const e = j.jouer('feu-d-artifice')
    assert.deepEqual(e.cycle!.defausse, ['feu-d-artifice'])
    assert.ok(e.cycle!.main.length === MAIN_MAX_EN_QUESTION || e.cycle!.pioche.length === 0, 'la main pleine')
  }
  // Renaissance : posée, l'erreur qui finirait l'expédition ne coûte rien — puis la carte quitte le paquet.
  {
    const j = dansLaMain('renaissance')
    let e = j.jouer('renaissance')
    assert.ok(e.rencontre!.pouvoirs.includes('renaissance'))
    for (let n = 0; n < 30 && e.courage! > e.rencontre!.frappe; n++) e = j.repondre(false)
    const courage = e.courage!
    assert.ok(courage <= e.rencontre!.frappe && courage > 0, `au bord : ${courage}`)
    e = j.repondre(false)
    assert.deepEqual([e.coup!.renaissance, e.coup!.perdu, e.courage], [true, 0, courage])
    assert.notEqual(e.issue, 'perdue')
    assert.ok(!e.paquet.includes('renaissance') && !e.rencontre!.pouvoirs.includes('renaissance'), 'une fois par expédition')
    e = j.repondre(false)
    assert.equal(e.issue, 'perdue', 'la suivante ne pardonne pas')
  }
})

test('une carte améliorée, dans la question au centre : un cran ou une carte de plus — les mêmes qui s’améliorent qu’avant elle', () => {
  for (const c of CARTES_DES_RENCONTRES.filter(x => seJoueEnQuestion(x.cle))) {
    const v10 = carteALaVersion(c.cle, V)!
    assert.equal(!!v10.amelioration, !!c.amelioration, `${c.cle} s’améliore comme avant`)
    if (v10.amelioration) assert.ok(v10.amelioration.effet && v10.amelioration.gain, `${c.cle} : ce qu’elle gagne`)
  }
})

// ── Par les routes ──────────────────────────────────────────────────────────

test(`le drapeau : la préproduction, \`npm run dev\` et les tests — la production attend (${QUESTION_AU_CENTRE_EN_PRODUCTION})`, () => {
  assert.equal(QUESTION_AU_CENTRE_EN_PRODUCTION, false, 'la préproduction d’abord')
  assert.equal(questionAuCentreOuverte({ online: true, env: 'production' }), false)
  assert.equal(questionAuCentreOuverte({ online: true, env: 'preprod' }), true)
  assert.equal(questionAuCentreOuverte({ online: false, env: 'production' }), true)
})

let banc: Banc
let sansElle: Banc

before(async () => {
  const base = baseDEssai(480, { categories: [...CATEGORIES] })
  banc = await demarrer({ baseDeLaCampagne: base, questionAuCentre: true })
  sansElle = await demarrer({ baseDeLaCampagne: base })
})

after(async () => {
  await banc.close()
  await sansElle.close()
})

const lire = (b: Banc, cookie: string) => fetch(`${b.url}/api/expedition`, { headers: { Cookie: cookie } }).then(async r => (await r.json()) as any)
const poster = (b: Banc, cookie: string, chemin: string, corps: unknown = {}) => ecrire(b.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** La base permanente du banc, le temps d'une lecture ou d'une écriture. */
function base<T>(b: Banc, fn: (db: Database.Database) => T, ecriture = false): T {
  const db = new Database(b.quizDbUrl.replace(/^file:/, ''), { readonly: !ecriture, fileMustExist: true })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/**
 * Partir, puis récrire le départ gardé — le premier étage en questions
 * d'Histoire à quatre choix, et le niveau du codex qu'il faut —, et
 * redémarrer le serveur pour qu'il le relise.
 */
async function partirEnQuestion(cookie: string, niveau: number): Promise<VueDeLExpedition> {
  const r = await poster(banc, cookie, '/api/expedition', { rencontres: true, questionAuCentre: true })
  assert.equal(r.status, 200, r.corps.error)
  const v = r.corps as VueDeLExpedition
  base(
    banc,
    db => {
      const d = JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(v.id) as { expedition: string }).expedition) as DepartDExpedition
      for (const e of d.cartes[0].escales) {
        if (e.etage !== 0) continue
        Object.assign(e, { sorte: 'question', theme: { categories: ['Histoire'] }, forme: 'quatre', chance: 0.7 })
      }
      d.codex = codexDuNiveau(niveau, [], [], V)
      db.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(d), v.id)
    },
    true,
  )
  await banc.redemarrer()
  return (await lire(banc, cookie)).expedition
}

const geste = (cookie: string, v: VueDeLExpedition, g: unknown) => poster(banc, cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: g })

/** La bonne réponse de la question à l'écran : ce que seul le serveur sait. */
const bonneDe = (v: VueDeLExpedition) =>
  base(banc, db => (JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(v.id) as { questions: string }).questions) as { bonne: number }[])[v.rencontre!.position!].bonne)

test('par les routes : la page la propose, le départ la prend — sa main de l’acte, son codex ; au niveau 1, la question part avec le pas ; sa bonne réponse prend un cran', async () => {
  const c = await inscrireProfil(banc.url, 'centre1', 'Centre')
  const page = await lire(banc, c)
  assert.equal(page.prochaine.questionAuCentre, true)
  assert.deepEqual(page.prochaine.codex.styles, stylesDuNiveau(1, V), 'ses styles à lui')
  let v = await partirEnQuestion(c, 1)
  // Elle part avec ses coups de pouce (v11), ses curiosités (v12), sa frise (v13), ses familles (v14) et son détail (v15) : la
  // question au centre, la forme à composer, les escales bonus, les événements à ranger, les cartes reprises, le second essai et
  // les tableaux.
  assert.equal(v.cartes!.v, VERSION_DU_DETAIL)
  assert.equal(v.cartes!.main!.length, MAIN_A_L_OUVERTURE_DE_L_ACTE)
  assert.equal(v.cartes!.mainMax, MAIN_MAX_EN_QUESTION)
  for (const cle of v.cartes!.paquet) assert.ok(seJoueEnQuestion(cle), cle)
  const r = await geste(c, v, { quoi: 'avancer', vers: v.carte!.depart[0] })
  assert.equal(r.status, 200, r.corps.error)
  v = r.corps.expedition
  assert.equal(v.rencontre!.phase, 'question')
  assert.equal(v.rencontre!.crans, true)
  assert.equal(v.rencontre!.sceaux, CRANS_DES_RENCONTRES.question[0])
  assert.ok(v.question && v.question.reponses.length === 4, 'la question, d’emblée')
  const rep = await poster(banc, c, `/api/expedition/${v.id}/reponse`, { position: v.question.index, choix: bonneDe(v) })
  assert.equal(rep.status, 200, rep.corps.error)
  assert.equal(rep.corps.coup.brises, 1)
  assert.equal(rep.corps.expedition.rencontre.sceaux, CRANS_DES_RENCONTRES.question[0] - 1)
  assert.equal(rep.corps.expedition.cartes.main.length, MAIN_A_L_OUVERTURE_DE_L_ACTE + 1, 'une carte vient après la question')
})

test('par les routes : dès le pari, la question reste au serveur tant qu’il parie, et sa réponse attend « Voir la question »', async () => {
  const c = await inscrireProfil(banc.url, 'centre2', 'Pari')
  let v = await partirEnQuestion(c, NIVEAU_MAX)
  const r = await geste(c, v, { quoi: 'avancer', vers: v.carte!.depart[0] })
  v = r.corps.expedition
  assert.equal(v.rencontre!.phase, 'preparation')
  assert.equal(v.question, undefined, 'invariant 1 : rien de la question avant de la voir')
  assert.ok(v.rencontre!.annonce, 'son annonce')
  const tot = await poster(banc, c, `/api/expedition/${v.id}/reponse`, { position: v.rencontre!.position, choix: 0 })
  assert.notEqual(tot.status, 200, 'répondre avant de voir')
  const vue = await geste(c, v, { quoi: 'voir', mise: 10, position: v.rencontre!.position })
  assert.equal(vue.status, 200, vue.corps.error)
  assert.ok(vue.corps.expedition.question, 'la question, vue')
})

test('sans le drapeau, la page ne la propose pas, et le départ qui la demande reste en version 9', async () => {
  const c = await inscrireProfil(sansElle.url, 'centre3', 'Avant')
  const page = await lire(sansElle, c)
  assert.equal(page.prochaine.questionAuCentre, undefined)
  const r = await poster(sansElle, c, '/api/expedition', { rencontres: true, questionAuCentre: true })
  assert.equal(r.status, 200, r.corps.error)
  assert.equal(r.corps.cartes.v, VERSION_DES_HUIT_FAMILLES)
  assert.equal(r.corps.cartes.main, undefined)
})

// ── L'écran ─────────────────────────────────────────────────────────────────

const JARGON = /sceau|\bCharge\b|\bGarde\b|inspiration|✦/i

interface PiecesEnQuestion {
  Adversaire: Composant
  MainDeRencontre: Composant
  CarteLevee: Composant
  AvantApres: Composant
  FeuilleDesRegles: Composant
  VersionDesCartes: React.Context<number>
}
const piecesEnQuestion = async () => (await pieces()) as unknown as PiecesEnQuestion

/** Une pièce rendue à la version 10, comme `ExpeditionApp` la pose (`VersionDesCartes`). */
async function rendreEnQuestion(composant: Composant, props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { VersionDesCartes } = await piecesEnQuestion()
  return renderToStaticMarkup(React.createElement(VersionDesCartes.Provider, { value: V }, React.createElement(composant, props)))
}

/** Les crans d'un adversaire rendus : pleins, et ceux qui palpitent. */
const crans = (html: string) => ({ pleins: (html.match(/exp-cran-plein/g) ?? []).length, vises: (html.match(/exp-cran-vise/g) ?? []).length })

test('à l’écran, l’adversaire en crans : ceux qu’une bonne réponse prendrait palpitent — une Concentration en fait palpiter un de plus —, son attaque cartes comptées, éteinte sous Sursis', async () => {
  const { Adversaire } = await piecesEnQuestion()
  const j = new Journal(enQuestion('ecran:crans', 1))
  j.avancer('e00')
  const r: VueDeLaRencontre = j.vue()
  let html = await rendreEnQuestion(Adversaire, { r, gardien: 'lg:kraken', acte: 0, compact: true })
  assert.deepEqual(crans(html), { pleins: CRANS_DES_RENCONTRES.question[0], vises: 1 })
  assert.match(texte(html), new RegExp(`${CRANS_DES_RENCONTRES.question[0]} crans`))
  assert.doesNotMatch(texte(html), JARGON)
  assert.match(html, /aria-label="[^"]*une bonne réponse lui en prend 1[^"]*"/)
  // Les deux crans palpitent sous Concentration : une bonne réponse le ferait tomber.
  const avec = (cle: string) => ({ ...r, ...{ charge: cle === 'concentration' ? 1 : 0, jouees: [cle] }, apercu: undefined })
  const deCartes = await pieces()
  html = await rendreEnQuestion(Adversaire, { r: avec('concentration'), apercu: deCartes.apercuALaMise(avec('concentration'), 0, 'Histoire'), gardien: 'lg:kraken', acte: 0, compact: true })
  assert.deepEqual(crans(html), { pleins: CRANS_DES_RENCONTRES.question[0], vises: CRANS_DES_RENCONTRES.question[0] })
  assert.match(html, /une bonne réponse le fait tomber/)
  html = await rendreEnQuestion(Adversaire, { r: avec('sursis'), apercu: deCartes.apercuALaMise(avec('sursis'), 0, 'Histoire'), gardien: 'lg:kraken', acte: 0, compact: true })
  assert.match(html, /exp-attaque exp-attaque-moindre/)
  assert.match(html, /son attaque\s*:\s*0"/u)
  // À la révélation, ce qu'il lui reste seulement : plus rien ne palpite.
  html = await rendreEnQuestion(Adversaire, { r, sceaux: 1, gardien: 'lg:kraken', acte: 0, compact: true })
  assert.deepEqual(crans(html), { pleins: 1, vises: 0 })
})

test('à l’écran, la main : sans énergie ni coût au coin ; à l’annonce, celles du pari d’abord, le reste éteint pour la question ; la question vue, toutes ; vide, elle dit d’où viennent les cartes', async () => {
  const { MainDeRencontre, CarteLevee } = await piecesEnQuestion()
  const refus = Object.fromEntries(['banco', 'concentration', 'coup-d-oeil'].map(cle => [cle, estDuPari(cle) ? null : 'Elle se joue la question sous les yeux : vois-la d’abord']))
  const pile = { compte: 5, mot: 'pioche', dit: 'Ta pioche : 5 cartes', onOuvrir: rien }
  let html = await rendreEnQuestion(MainDeRencontre, { cles: ['concentration', 'banco', 'coup-d-oeil'], refus, busy: false, pile, phase: 'preparation', onJouer: rien })
  assert.doesNotMatch(html, /exp-energie|exp-vc-cout/, 'ni orbe, ni coût')
  const maintenant = html.indexOf('Maintenant')
  const pendant = html.indexOf('Pendant la question')
  assert.ok(maintenant >= 0 && pendant > maintenant, 'le pari d’abord, puis le reste')
  assert.ok(html.indexOf('data-carte="banco"') < pendant && html.indexOf('data-carte="concentration"') > pendant)
  assert.equal((html.match(/exp-face-eteinte/g) ?? []).length, 2)
  html = await rendreEnQuestion(MainDeRencontre, { cles: ['concentration', 'coup-d-oeil'], refus: { concentration: null, 'coup-d-oeil': null }, busy: false, pile, phase: 'question', onJouer: rien })
  assert.doesNotMatch(html, /Maintenant|Pendant la question/)
  assert.equal((html.match(/data-carte=/g) ?? []).length, 2)
  html = await rendreEnQuestion(MainDeRencontre, { cles: [], refus: {}, busy: false, pile, phase: 'question', onJouer: rien })
  assert.match(texte(html), /Ta main est vide : une carte y vient après chaque question/)
  // Levée : ce qu'elle fait, quand, et rien de l'énergie.
  html = await rendreEnQuestion(CarteLevee, { cle: 'concentration', refus: null, busy: false, changement: null, onJouer: rien, onReposer: rien })
  assert.match(texte(html), /l’adversaire perd un cran de plus/)
  assert.match(texte(html), /La question sous les yeux/)
  assert.doesNotMatch(texte(html), /énergie/)
  assert.doesNotMatch(texte(html), JARGON)
  // L'amélioration, avant et après (au campement, à l'échoppe) : ses phrases à la version 10, ni coût ni « gratuite ».
  const { AvantApres } = await piecesEnQuestion()
  const avantApres = texte(await rendreEnQuestion(AvantApres, { cle: 'concentration' }))
  assert.match(avantApres, /l’adversaire perd un cran de plus\..*la question vue.*deux sur une question difficile/)
  assert.doesNotMatch(avantApres, /énergie|gratuite/i)
})

test('les règles de la question au centre : la question d’abord, les crans, une carte par question, la main de l’acte et sa défausse ; le pari et ses cartes ; cinq styles ; ni énergie, ni bouclier', async () => {
  const { FeuilleDesRegles } = await piecesEnQuestion()
  const codex = codexDuNiveau(NIVEAU_MAX, [], [], V)
  const t = texte(await rendreEnQuestion(FeuilleDesRegles, { rencontres: true, v: V, codex: { ...codex, regles: codex.regles, styles: codex.styles }, ascension: 0, onFermer: rien }))
  for (const attendu of [
    'La question d’abord',
    'l’adversaire perd un cran',
    'Une carte par question',
    `Ta main tire ${MAIN_A_L_OUVERTURE_DE_L_ACTE} cartes à l’ouverture de chaque acte`,
    'revient à l’acte suivant',
    'Les cartes du pari',
    'Ses crans rayés, qui palpitent',
  ]) {
    assert.ok(t.includes(attendu), `« ${attendu} »`)
  }
  for (const s of STYLES_EN_QUESTION) assert.ok(t.includes(FAMILLES_DE_CARTES[s].nom), FAMILLES_DE_CARTES[s].nom)
  assert.doesNotMatch(t, JARGON)
  assert.doesNotMatch(t, /énergie|bouclier/i)
  assert.doesNotMatch(t, /Le Sophiste|Le Téméraire|Le Rempart/)
  // Chaque cran, au milieu de sa phrase : « Cran 1 : les élites… ».
  for (const c of ASCENSION_EN_QUESTION) assert.ok(t.includes(`Cran ${c.cran} : ${c.regle.charAt(0).toLowerCase()}${c.regle.slice(1)}.`), `le cran ${c.cran} : « ${c.regle} »`)
})
