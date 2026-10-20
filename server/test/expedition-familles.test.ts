// Les familles en façons de répondre (la version 14 du départ, le 20 octobre
// 2026 — l'étape 6 de « La question au centre », `retours/2026-10-20/les-familles.md`).
// Le plan : « Le Devin souffle, le Métamorphe change la forme, l'Érudit joue
// sa catégorie fétiche, le Flambeur parie, l'Élan enchaîne, le Rempart donne
// une seconde chance » ; le propriétaire, ce matin-là : « Un second essai »,
// « Oui, sur sa réponse », « Oui » pour la fétiche, et six styles. Les cartes
// reprises et retouchées à leur version, leurs refus, le second essai et ce
// qui revient dans le pli, puis par les routes — l'essai écrit au journal des
// gestes, sans bonne réponse — et à l'écran. Une expédition de la version 13
// se rejoue à ses règles : `expedition-question-au-centre.test.ts` et les
// suivants.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ECHELLE_DES_FAMILLES, EXPLOITS, NIVEAU_MAX, codexDuNiveau, niveauDuStyle, ouvertureDe, stylesDuNiveau } from '../../shared/codex'
import {
  CARTES_DES_RENCONTRES,
  CRANS_DE_POLYMORPHE,
  CRANS_D_UNE_QUESTION_DURE,
  FAMILLES_DE_CARTES,
  MISE_DE_FORTUNE,
  PAQUET_EN_QUESTION,
  RETIREES_EN_QUESTION,
  STYLES_DES_FAMILLES,
  STYLES_EN_QUESTION,
  VERSION_DES_FAMILLES,
  VERSION_DE_LA_FRISE,
  VERSION_DU_DETAIL,
  ameliorer,
  aDeQuoiEssayerEncore,
  carteALaVersion,
  carteDeRencontre,
  attaqueEnQuestion,
  cartesTireesDuTour,
  changeDeQuestion,
  chiffresApresLaCarte,
  cransDesPouvoirs,
  cransDUneBonneReponse,
  estDuPari,
  effaceesAvecLEssai,
  effaceesDuTour,
  formeDeLaCarte,
  jeuDuStyle,
  paquetDesRencontres,
  refusDeLaCarte,
  revientSiJuste,
  secondEssaiDuTour,
  type ContexteDUneCarte,
  type QuestionDuTour,
} from '../../shared/rencontres'
import { pliDeLExpedition, refusDUneCarte, reponsesEffacees, secondEssaiEnAttente, type DepartDExpedition, type VueDeLExpedition } from '../../shared/expedition'
import { Journal, depart, pieces, rendre, rien, texte, type Composant } from './expedition-journal'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

const V = VERSION_DES_FAMILLES

/** Les dix-sept cartes que la question au centre avait retirées, et que les familles reprennent sous leur nom et leur peinture. */
const REPRISES = [
  'astrolabe',
  'miroir',
  'metamorphose',
  'cameleon',
  'lecon',
  'fortune',
  'foulee',
  'acceleration',
  'vent-arriere',
  'parade',
  'muraille',
  'pansement',
  'contre-attaque',
  'cuirasse',
  'second-souffle',
  'bastion',
  'represailles',
]
/**
 * Les onze qu'elles retouchent : mortes en main, qui ne servaient qu'au hasard de la fétiche, qu'à leur deuxième bonne réponse,
 * qu'à qui pariait — les cartes du pari servent aussi à l'aveugle — ou qu'à une série que presque rien ne lit plus ; et la carte de
 * départ de l'Élan, qui revient comme les siennes.
 */
const RETOUCHEES = ['troisieme-oeil', 'prisme', 'rythme', 'bibliotheque', 'encyclopedie', 'doubler-la-mise', 'banco', 'assurance', 'pactole', 'echauffement', 'inarretable']
/** Celles qui se jouent à l'annonce, avec le pari, en plus de la carte de la question — Pactole aussi, qui s'y pose. */
const DU_PARI = ['doubler-la-mise', 'banco', 'assurance']

/** Un départ des familles, au codex entier, dont les offres ne tirent que ces cartes. */
const enV14 = (g: string, cartes: string[], plus: Partial<DepartDExpedition> = {}): DepartDExpedition => {
  const codex = codexDuNiveau(NIVEAU_MAX, [], [], V)
  return depart(g, [], { v: V, codex: { ...codex, cartes }, ...plus })
}

/**
 * Un journal où cette carte est dans la main de l'élite, la question sous les
 * yeux, où elle se joue — `preparer` pose la question d'abord. Sans pari : sa
 * mise brouillerait les écus de Fortune. Une graine cherchée, jamais choisie.
 */
function dansLaMain(cle: string, preparer?: (j: Journal) => void, plus: Partial<DepartDExpedition> = {}): Journal {
  for (let n = 0; n < 3000; n++) {
    const j = new Journal(enV14(`familles:${cle}:${n}`, [cle], plus))
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
        if (e.rencontre?.tour.phase === 'preparation') e = j.voir(0)
        if (e.rencontre?.tour.phase === 'question' && refusDUneCarte(j.depart, e, cle, j.questions) === null) return j
      }
      e = j.repondre(false)
    }
  }
  throw new Error(`aucune graine ne met ${cle} dans une main où elle se joue`)
}

// ── Les cartes et l'échelle ─────────────────────────────────────────────────

test('les familles reprennent dix-sept cartes et en retouchent onze, à leur version : la version 13 les garde telles qu’elle les a jouées', () => {
  for (const cle of REPRISES) {
    assert.ok(RETIREES_EN_QUESTION.has(cle), `${cle} était retirée`)
    assert.equal(carteALaVersion(cle, VERSION_DE_LA_FRISE), undefined, `${cle} : pas en version 13`)
    const c = carteALaVersion(cle, V)
    assert.ok(c, `${cle} revient`)
    assert.equal(c.cout, 0, cle)
    assert.equal(c.epuisement, undefined, `${cle} revient à l’acte suivant, comme les autres`)
    assert.notEqual(c.effet, carteDeRencontre(cle)!.effet, `${cle} : un effet neuf`)
    // Améliorée aussi, à ses mots à elle.
    const plus = carteALaVersion(ameliorer(cle), V)
    assert.ok(plus?.amelioree && plus.effet !== c.effet, `${cle}+`)
    assert.equal(refusDeLaCarte({ ...contexte(), v: VERSION_DE_LA_FRISE, main: [cle] }, cle), 'Cette carte ne se lit pas : recharge la page')
  }
  for (const cle of RETOUCHEES) assert.notEqual(carteALaVersion(cle, V)!.effet, carteALaVersion(cle, VERSION_DE_LA_FRISE)!.effet, `${cle} retouchée`)
  // Astrolabe, le Prisme, Métamorphose, le Rythme et Caméléon se jouent la question sous les yeux, plus en pouvoirs ; la Bibliothèque,
  // Cuirasse, Bastion, Représailles, Vent arrière, Troisième œil et Inarrêtable, pour toute la rencontre ; les cartes du pari, à
  // l'annonce.
  for (const cle of ['astrolabe', 'prisme', 'metamorphose', 'rythme', 'cameleon']) assert.equal(carteALaVersion(cle, V)!.moment, 'reflexe', cle)
  for (const cle of ['bibliotheque', 'cuirasse', 'bastion', 'represailles', 'vent-arriere', 'troisieme-oeil', 'inarretable']) assert.equal(carteALaVersion(cle, V)!.moment, 'pouvoir', cle)
  for (const cle of DU_PARI) assert.ok(estDuPari(cle) && carteALaVersion(cle, V)!.moment === 'preparation', cle)
  // Elles aident à répondre : la réponse qu'elles aident ne mesure rien — Troisième œil et le Rythme, posés, celles qui suivent.
  for (const cle of ['astrolabe', 'prisme', 'troisieme-oeil', 'rythme']) assert.ok(carteALaVersion(cle, V)!.indice, cle)
  const aV13 = CARTES_DES_RENCONTRES.filter(c => carteALaVersion(c.cle, VERSION_DE_LA_FRISE))
  const aV14 = CARTES_DES_RENCONTRES.filter(c => carteALaVersion(c.cle, V))
  assert.equal(aV14.length, aV13.length + REPRISES.length)
  // L'échelle : chaque carte à gagner une fois — ni légendaire, ni carte d'exploit —, les reprises comprises.
  const exploits = new Set(EXPLOITS.map(x => x.carte))
  const aGagner = aV14.filter(c => !c.legendaire && !exploits.has(c.cle)).map(c => c.cle)
  const echelle = ECHELLE_DES_FAMILLES.flatMap(m => m.cartes)
  assert.equal(echelle.length, new Set(echelle).size, 'aucune deux fois')
  assert.deepEqual([...echelle].sort(), [...aGagner].sort())
  for (const cle of REPRISES) assert.equal(ouvertureDe(cle, VERSION_DE_LA_FRISE), null, `${cle} ne s’ouvre pas en version 13`)
  // Le Rempart et ses trois communes au niveau 4.
  for (const cle of ['parade', 'muraille', 'pansement']) assert.deepEqual(ouvertureDe(cle, V), { niveau: 4 }, cle)
})

test('six styles : le Rempart revient au niveau 4, chacun dit sa façon de répondre ; la version 13 garde ses cinq et ses phrases', () => {
  assert.deepEqual(stylesDuNiveau(NIVEAU_MAX, V), [...STYLES_DES_FAMILLES])
  assert.deepEqual(stylesDuNiveau(3, V), [...STYLES_EN_QUESTION])
  assert.equal(niveauDuStyle('rempart', V), 4)
  assert.deepEqual(stylesDuNiveau(NIVEAU_MAX, VERSION_DE_LA_FRISE), [...STYLES_EN_QUESTION])
  // Son paquet : Parade et Pansement, à la place d'une Concentration et d'un Coup d'œil ; un Rempart retenu sur un téléphone ne change
  // rien à la version 13.
  const sans = [...PAQUET_EN_QUESTION]
  for (const b of ['concentration', 'coup-d-oeil']) sans.splice(sans.indexOf(b), 1)
  assert.deepEqual(paquetDesRencontres([], 'rempart', V), [...sans, 'parade', 'pansement'].sort())
  assert.deepEqual(paquetDesRencontres([], 'rempart', VERSION_DE_LA_FRISE), [...PAQUET_EN_QUESTION].sort())
  for (const s of STYLES_DES_FAMILLES) {
    assert.ok(jeuDuStyle(s, V), s)
    assert.notEqual(jeuDuStyle(s, V), FAMILLES_DE_CARTES[s].jeu, `${s} : sa façon de répondre`)
    assert.equal(jeuDuStyle(s, VERSION_DE_LA_FRISE), FAMILLES_DE_CARTES[s].jeu, `${s} : en version 13, sa phrase d'avant`)
  }
  assert.match(jeuDuStyle('rempart', V)!, /seconde chance/)
})

// ── Les refus ───────────────────────────────────────────────────────────────

/** Ce que la règle des cartes lit, une question d'Histoire à quatre choix sous les yeux — sa réponse se compose. */
function contexte(question: Partial<QuestionDuTour> = {}, plus: Partial<ContexteDUneCarte> = {}): ContexteDUneCarte {
  return {
    v: V,
    tour: { phase: 'question', inspiration: 0, jouees: [], surLaQuestion: [] },
    main: [],
    pouvoirs: [],
    question: { reponses: 4, tiree: 'quatre', forme: 'quatre', six: true, nombre: false, datee: false, categorie: 'Histoire', compose: true, ...question },
    fetiche: 'Histoire',
    courage: 50,
    derniereFrappe: 0,
    defausse: 0,
    ecus: 50,
    ...plus,
  }
}
const refus = (cle: string, question: Partial<QuestionDuTour> = {}, plus: Partial<ContexteDUneCarte> = {}) => refusDeLaCarte({ ...contexte(question, plus), main: [cle] }, cle)
const VRAI_FAUX = { reponses: 2, tiree: 'vrai-faux', forme: 'vrai-faux' } as const

test('chaque carte des familles se refuse là où elle ne servirait pas, en disant pourquoi', () => {
  // Astrolabe, comme L'initiale : ni un vrai ou faux, ni une année, ni une frise ; à composer, elle pose sa lettre.
  assert.equal(refus('astrolabe'), null)
  assert.equal(refus('astrolabe', VRAI_FAUX), 'Pas sur un vrai ou faux : elle répondrait à ta place')
  assert.equal(refus('astrolabe', { nombre: true }), 'Pas sur une année ou un nombre : elle se joue sur des mots')
  assert.equal(refus('astrolabe', { forme: 'frise', tiree: 'frise' }), 'Pas sur une frise : elle n’a pas de mot à écrire')
  assert.equal(refus('astrolabe', { forme: 'lettres', tiree: 'lettres', reponses: 13 }), null)
  // Métamorphose : une réponse qui se compose, une seule forme par question.
  const changee: Partial<ContexteDUneCarte> = { tour: { phase: 'question', inspiration: 0, jouees: [], surLaQuestion: ['corser'] } }
  assert.equal(refus('metamorphose'), null)
  assert.equal(refus('metamorphose', { compose: false }), 'Sa réponse ne se compose pas : trop de mots, ou des chiffres')
  assert.equal(refus('metamorphose', { tiree: 'lettres', forme: 'lettres', reponses: 13 }), 'Elle est déjà à composer')
  assert.equal(refus('metamorphose', VRAI_FAUX), 'Pas sur un vrai ou faux : sa réponse est Vrai ou Faux')
  assert.equal(refus('metamorphose', { tiree: 'frise', forme: 'frise' }), 'Pas sur une frise : elle n’a pas de mot à composer')
  assert.equal(refus('metamorphose', {}, changee), 'La question a déjà changé de forme')
  // Miroir, comme Simplifier : tout ce qui n'est pas déjà un vrai ou faux, ni une frise — une réponse qui ne se compose pas aussi.
  assert.equal(refus('miroir'), null)
  assert.equal(refus('miroir', { compose: false }), null)
  assert.equal(refus('miroir', { tiree: 'lettres', forme: 'lettres', reponses: 13 }), null)
  assert.equal(refus('miroir', VRAI_FAUX), 'Elle est déjà un vrai ou faux')
  assert.equal(refus('miroir', { tiree: 'frise', forme: 'frise' }), 'Pas sur une frise : elle n’a pas de forme plus simple')
  assert.equal(refus('miroir', {}, changee), 'La question a déjà changé de forme')
  // Le Prisme, comme Corser : deux leurres de plus — un vrai ou faux tiré d'une question à quatre choix repasse à six, aux familles
  // seulement ; un vrai ou faux né tel n'en a pas.
  for (const cle of ['prisme', 'corser', 'polymorphe']) {
    assert.equal(refus(cle), null, cle)
    assert.equal(refus(cle, { six: false }), 'Cette question n’a pas de quoi tenir six choix', cle)
    assert.equal(refus(cle, { tiree: 'six', forme: 'six', reponses: 6 }), 'Elle est déjà à six choix', cle)
    assert.equal(refus(cle, { ...VRAI_FAUX, six: true }), null, `${cle} sur un vrai ou faux`)
    assert.equal(refus(cle, { ...VRAI_FAUX, six: false }), 'Cette question n’a pas de quoi tenir six choix', `${cle} sur un vrai ou faux né tel`)
  }
  assert.equal(refus('corser', { ...VRAI_FAUX, six: true }, { v: VERSION_DE_LA_FRISE }), 'Pas sur un vrai ou faux', 'la version 13 ne corse pas un vrai ou faux')
  // Les cartes du pari, une fois chacune à l'annonce.
  for (const cle of DU_PARI) {
    const annonce: Partial<ContexteDUneCarte> = { tour: { phase: 'preparation', inspiration: 0, jouees: [], surLaQuestion: [] } }
    assert.equal(refus(cle, {}, annonce), null, cle)
    assert.equal(refus(cle, {}, { tour: { phase: 'preparation', inspiration: 0, jouees: [cle], surLaQuestion: [] } }), 'Déjà jouée à cette question', cle)
    assert.equal(refus(cle), 'Elle se joue avec le pari, avant de voir la question', `${cle} : à l'annonce seulement`)
  }
  // L'Érudit : sa catégorie fétiche ; le Flambeur : de quoi miser ; Contre-attaque, partout — plus fort juste après une erreur.
  for (const cle of ['lecon', 'bibliotheque']) assert.equal(refus(cle, {}, { fetiche: undefined }), 'Tu n’as pas de catégorie fétiche : l’Érudit en choisit une au départ', cle)
  assert.equal(refus('fortune', {}, { ecus: MISE_DE_FORTUNE - 1 }), `Il te faut ${MISE_DE_FORTUNE} écus pour miser : tu en as ${MISE_DE_FORTUNE - 1}`)
  assert.equal(refus('fortune', {}, { ecus: MISE_DE_FORTUNE }), null)
  assert.equal(refus('contre-attaque'), null)
  // Le Rythme, comme Coup d'œil : rien à effacer d'un vrai ou faux, ni quand il ne reste que deux réponses.
  assert.equal(refus('rythme'), null)
  assert.equal(refus('rythme', VRAI_FAUX), 'Pas sur un vrai ou faux : elle répondrait à ta place')
  assert.equal(refus('rythme', {}, { pouvoirs: ['vision', 'echolocation'] }), 'Il ne reste plus rien à effacer')
  // Le second essai : jamais sur un vrai ou faux, ni à deux réponses près, ni deux fois — Second souffle ne soigne plus.
  for (const cle of ['parade', 'second-souffle']) {
    assert.equal(refus(cle), null, cle)
    assert.equal(refus(cle, {}, { courage: 50 }), null, `${cle} au courage plein`)
    assert.equal(refus(cle, VRAI_FAUX), 'Pas sur un vrai ou faux : le second essai répondrait à ta place')
    assert.equal(refus(cle, {}, { pouvoirs: ['vision', 'echolocation'] }), 'Il ne reste que deux réponses : le second essai répondrait à ta place')
    assert.equal(refus(cle, {}, { tour: { phase: 'question', inspiration: 0, jouees: [], surLaQuestion: [], essai: 'cuirasse' } }), 'Ta réponse s’est déjà effacée une fois : réponds encore')
  }
  // Rendue par le Bastion, la question se rejoue sans carte — elle aurait sinon gardé la sienne pour après ; par Cuirasse, non.
  const essai = (de: string): Partial<ContexteDUneCarte> => ({ tour: { phase: 'question', inspiration: 0, jouees: [], surLaQuestion: [], essai: de } })
  assert.equal(refus('coup-d-oeil', {}, essai('bastion+')), 'Le Bastion t’a rendu ta réponse : elle se rejoue sans carte')
  assert.equal(refus('coup-d-oeil', {}, essai('cuirasse')), null)
  assert.equal(refus('coup-d-oeil', {}, { ...essai('bastion'), v: VERSION_DE_LA_FRISE }), null, 'la version 13 n’a pas de Bastion')
})

// ── Le second essai ─────────────────────────────────────────────────────────

test('le second essai : une carte par question — Parade, Second souffle —, Bastion quand il ne joue rien d’autre, Cuirasse à la première ; ni vrai ou faux, ni sous Double chance', () => {
  const q4 = { reponses: 4 }
  const tour = (jouees: string[] = [], essai?: string) => ({ jouees, ...(essai && { essai }) })
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(['parade']), pouvoirs: [], question: q4 }), 'parade')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(['second-souffle+']), pouvoirs: [], question: q4 }), 'second-souffle+')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(), pouvoirs: ['bastion'], question: q4 }), 'bastion')
  // Bastion se paie de la carte de la question : posé sur elle, il en est la carte ; une autre jouée, il se tait — le pari mis à part.
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(['bastion+']), pouvoirs: ['bastion+'], question: q4 }), 'bastion+')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(['concentration']), pouvoirs: ['bastion'], question: q4 }), null, 'une autre carte jouée')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(['doubler-la-mise']), pouvoirs: ['bastion'], question: q4 }), 'bastion', 'une carte du pari ne compte pas')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(['concentration']), pouvoirs: ['bastion', 'cuirasse'], essais: 0, question: q4 }), 'cuirasse', 'Cuirasse, elle, laisse jouer')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(), pouvoirs: ['cuirasse'], essais: 0, question: q4 }), 'cuirasse')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(), pouvoirs: ['cuirasse'], essais: 1, question: q4 }), null, 'la première erreur seulement')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(), pouvoirs: ['cuirasse+'], essais: 1, question: q4 }), 'cuirasse+', 'les deux premières, améliorée')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(['parade'], 'parade'), pouvoirs: ['bastion'], question: q4 }), null, 'un seul par question')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(['parade']), pouvoirs: [], question: { reponses: 2 } }), null, 'pas sur un vrai ou faux')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(['double-chance']), pouvoirs: ['cuirasse'], essais: 0, question: q4 }), null, 'Double chance : il ne resterait rien à choisir')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(['coup-d-oeil']), pouvoirs: ['cuirasse'], essais: 0, question: q4, effacees: 2 }), null, 'deux réponses de moins')
  assert.equal(secondEssaiDuTour({ v: V, tour: tour(['coup-d-oeil']), pouvoirs: ['cuirasse'], essais: 0, question: q4, effacees: 1 }), 'cuirasse')
  assert.equal(secondEssaiDuTour({ v: VERSION_DE_LA_FRISE, tour: tour(['parade']), pouvoirs: [], question: q4 }), null, 'la version 13 n’en a pas')
  // À composer, sur une frise : on recompose, on reclasse — rien ne s'efface.
  assert.equal(aDeQuoiEssayerEncore({ reponses: 13, forme: 'lettres' }, 3), true)
  assert.equal(aDeQuoiEssayerEncore({ reponses: 4, forme: 'frise' }, 2), true)
  assert.equal(effaceesAvecLEssai({ surLaQuestion: [], essai: 'parade' }, [], { reponses: 4 }), 1, 'la réponse ratée compte parmi les effacées')
  assert.equal(effaceesAvecLEssai({ surLaQuestion: [], essai: 'parade' }, [], { reponses: 13, forme: 'lettres' }), 0)
  // Sa réponse ratée s'efface d'abord, puis ce que les cartes effacent, au même hasard — deux au plus sur quatre.
  const q = { reponses: ['A', 'B', 'C', 'D'], bonne: 2 }
  for (let k = 0; k < 40; k++) {
    assert.deepEqual(reponsesEffacees(`g${k}`, k, q, 0, 3), [3])
    const deux = reponsesEffacees(`g${k}`, k, q, 1, 3)
    assert.ok(deux.includes(3) && deux.length === 2 && !deux.includes(2), String(deux))
    assert.equal(reponsesEffacees(`g${k}`, k, q, 5, 3).length, 2)
    assert.deepEqual(reponsesEffacees(`g${k}`, k, q, 1, 2), reponsesEffacees(`g${k}`, k, q, 1), 'la bonne ne s’efface jamais')
  }
})

test('dans le pli : ratée sous Parade, sa réponse s’efface — ni jugée, ni attaque —, et il répond encore ; fausse encore, l’attaque ; juste, ses crans', () => {
  const j = dansLaMain('parade')
  const avant = j.etat()
  const courage = avant.courage!
  const crans = avant.rencontre!.sceaux
  const frappe = j.vue().frappe
  // Levée, elle le promet : « Si tu te trompes : tu réponds encore ».
  let e = j.jouer('parade')
  assert.equal(j.vue().apercu!.faux.essai, true)
  e = j.rater(3)
  assert.equal(e.rencontre!.tour.essai, 'parade')
  assert.equal(e.courage, courage, 'il ne t’attaque pas')
  assert.equal(e.rencontre!.sceaux, crans)
  assert.equal(e.enAttente, avant.enAttente, 'la même question attend')
  assert.equal(e.rencontre!.questions, avant.rencontre!.questions, 'rien n’est jugé')
  assert.equal(secondEssaiEnAttente(j.depart, e, j.questions), null, 'un seul par question')
  assert.equal(j.vue().effacees, 1, 'sa réponse ratée ne se propose plus')
  assert.equal(j.vue().essai, 'parade')
  assert.equal(j.vue().apercu!.faux.essai, undefined, 'la seconde fois, l’attaque')
  const juste = j.copie()
  e = j.repondre(false)
  assert.equal(e.courage, courage - frappe)
  assert.equal(e.coup!.perdu, frappe)
  e = juste.repondre(true)
  assert.equal(e.coup!.juste, true)
  assert.equal(e.rencontre?.sceaux ?? 0, Math.max(0, crans - e.coup!.brises))
  // Un essai que la règle ne donne pas — sans carte du Rempart — ne change rien : la question attend sa réponse.
  const sansRien = dansLaMain('concentration')
  const q = sansRien.etat().enAttente
  const g = sansRien.geste({ quoi: 'essai', position: q! })
  assert.equal(g.rencontre!.tour.essai, undefined)
  assert.equal(g.enAttente, q)
})

test('Bastion donne un second essai à chaque question de la rencontre où il ne joue rien d’autre, Cuirasse à la première erreur ; Second souffle et Représailles frappent après', () => {
  // Bastion, posé sur une question : celle-ci et les suivantes.
  const j = dansLaMain('bastion')
  j.jouer('bastion')
  let e = j.rater()
  assert.equal(e.rencontre!.tour.essai, 'bastion')
  e = j.repondre(false)
  if (e.rencontre) {
    if (e.rencontre.tour.phase === 'preparation') j.voir(0)
    assert.ok(secondEssaiEnAttente(j.depart, j.etat(), j.questions), 'la question suivante aussi')
    // Une carte jouée sur elle, et il se tait ; rendue sans carte, elle se rejoue sans carte.
    const main = j.etat().rencontre!.main.filter(c => refusDUneCarte(j.depart, j.etat(), c, j.questions) === null && !changeDeQuestion(c, V))
    if (main.length > 0) {
      const avecUneCarte = j.copie()
      avecUneCarte.jouer(main[0])
      assert.equal(secondEssaiEnAttente(avecUneCarte.depart, avecUneCarte.etat(), avecUneCarte.questions), null, `${main[0]} jouée : plus de second essai`)
    }
    e = j.rater()
    assert.equal(e.rencontre!.tour.essai, 'bastion')
    for (const c of main) assert.equal(refusDUneCarte(j.depart, e, c, j.questions), 'Le Bastion t’a rendu ta réponse : elle se rejoue sans carte', c)
  }
  // Cuirasse : la première erreur de la rencontre, une fois.
  const k = dansLaMain('cuirasse')
  k.jouer('cuirasse')
  e = k.rater()
  assert.equal(e.rencontre!.tour.essai, 'cuirasse')
  assert.equal(e.rencontre!.essais, 1)
  e = k.repondre(false)
  if (e.rencontre) {
    if (e.rencontre.tour.phase === 'preparation') k.voir(0)
    assert.equal(secondEssaiEnAttente(k.depart, k.etat(), k.questions), null, 'servie une fois')
  }
  // Second souffle : juste au second essai, un cran de plus.
  const s = dansLaMain('second-souffle')
  const sansCarte = s.copie()
  s.jouer('second-souffle')
  s.rater()
  const avec = s.repondre(true).coup!.brises
  const nue = sansCarte.repondre(true).coup!.brises
  assert.equal(avec, nue + 1)
  // Représailles : chaque bonne réponse juste après une erreur, deux crans de plus.
  assert.equal(cransDesPouvoirs({ pouvoirs: ['represailles'], v: V, ratee: true }), 2)
  assert.equal(cransDesPouvoirs({ pouvoirs: ['represailles+'], v: V, ratee: true }), 3)
  assert.equal(cransDesPouvoirs({ pouvoirs: ['represailles'], v: V }), 0)
})

// ── Ce qui revient, ce qui fait tirer, ce qui mise ──────────────────────────

test('l’Élan : Foulée revient dans sa main s’il a juste, toute carte sous Vent arrière ; fausse, elle reste à la défausse', () => {
  assert.equal(revientSiJuste('foulee+', []), true)
  assert.equal(revientSiJuste('concentration', ['vent-arriere']), true)
  assert.equal(revientSiJuste('concentration', []), false)
  const j = dansLaMain('foulee')
  const faux = j.copie()
  j.jouer('foulee')
  let e = j.repondre(true)
  // Revenue avant que la main tire : elle a sa place, même si l'adversaire tombe.
  assert.deepEqual(e.coup!.revenues, ['foulee'])
  assert.ok(e.cycle!.main.includes('foulee') && !e.cycle!.defausse.includes('foulee'), 'revenue dans sa main')
  faux.jouer('foulee')
  e = faux.repondre(false)
  assert.equal(e.coup!.revenues, undefined)
  assert.ok(e.cycle!.defausse.includes('foulee'), 'fausse : à la défausse')
  // Vent arrière posé : la carte jouée à la question suivante revient, sa réponse juste.
  const v = dansLaMain('vent-arriere')
  v.jouer('vent-arriere')
  e = v.repondre(true)
  if (!e.rencontre) return
  if (e.rencontre.tour.phase === 'preparation') e = v.voir(0)
  const carte = e.rencontre!.main.find(c => refusDUneCarte(v.depart, e, c, v.questions) === null && !carteALaVersion(c, V)?.legendaire && carteALaVersion(c, V)?.moment !== 'pouvoir' && !['echange', 'volte-face', 'lecon'].includes(c))
  if (!carte) return
  v.jouer(carte)
  e = v.repondre(true)
  if (!e.coup!.victoire) assert.deepEqual(e.coup!.revenues, [carte])
})

test('ce qui fait tirer : Accélération si juste, Pansement et Muraille si faux — Muraille sans attaque', () => {
  assert.equal(cartesTireesDuTour(['acceleration'], true, V), 2)
  assert.equal(cartesTireesDuTour(['acceleration+'], true, V), 3)
  assert.equal(cartesTireesDuTour(['acceleration'], false, V), 0)
  assert.equal(cartesTireesDuTour(['pansement'], false, V), 2)
  assert.equal(cartesTireesDuTour(['pansement+'], false, V), 3)
  assert.equal(cartesTireesDuTour(['muraille'], false, V), 1)
  assert.equal(cartesTireesDuTour(['pansement'], true, V), 0)
  assert.equal(cartesTireesDuTour(['pansement'], false, VERSION_DE_LA_FRISE), 0)
  // Muraille : l'erreur ne l'attaque pas.
  const m = dansLaMain('muraille')
  const courage = m.etat().courage
  m.jouer('muraille')
  const e = m.repondre(false)
  assert.equal(e.courage, courage)
  assert.equal(e.coup!.perdu, 0)
  // Pansement, sa main d'acte ouverte de trois cartes : sur une erreur, il en tire plus que sur une bonne réponse.
  const rempart = (g: string) => {
    for (let n = 0; n < 400; n++) {
      const j = new Journal(enV14(`${g}:${n}`, [], { style: 'rempart' }))
      const e = j.avancer('e00')
      if (e.rencontre?.tour.phase === 'preparation') j.voir(0)
      if (j.etat().rencontre!.main.includes('pansement')) return j
    }
    throw new Error('aucune main d’ouverture ne tient Pansement')
  }
  const p = rempart('pansement')
  const juste = p.copie()
  p.jouer('pansement')
  juste.jouer('pansement')
  const avant = p.etat().tirages
  const surErreur = p.repondre(false).tirages - avant
  const surJuste = juste.repondre(true).tirages - avant
  assert.ok(surErreur > surJuste, `${surErreur} cartes sur une erreur, ${surJuste} sur une bonne réponse`)
})

test('Fortune mise ses écus la question sous les yeux : juste, il en gagne autant et un cran de plus ; fausse, il les perd — mais l’adversaire ne l’attaque pas', () => {
  const j = dansLaMain('fortune')
  const ecus = j.etat().ecus
  const courage = j.etat().courage
  const sans = j.copie().repondre(true).coup!.brises
  const faux = j.copie()
  j.jouer('fortune')
  assert.equal(j.vue().apercu!.juste.ecusDesCartes, MISE_DE_FORTUNE)
  assert.equal(j.vue().apercu!.faux.ecusDesCartes, MISE_DE_FORTUNE)
  assert.equal(j.vue().apercu!.faux.frappe, 0, 'levée, elle le promet')
  let e = j.repondre(true)
  assert.equal(e.coup!.ecus, MISE_DE_FORTUNE)
  assert.equal(e.coup!.brises, sans + 1)
  assert.ok(e.ecus >= ecus + MISE_DE_FORTUNE)
  faux.jouer('fortune')
  e = faux.repondre(false)
  assert.equal(e.coup!.ecus, -MISE_DE_FORTUNE)
  assert.equal(e.ecus, ecus - MISE_DE_FORTUNE)
  assert.equal(e.coup!.perdu, 0)
  assert.equal(e.courage, courage)
})

// ── La fétiche, les formes, ce qu'on souffle ────────────────────────────────

test('l’Érudit fait venir sa fétiche : Leçon change de question pour une de sa catégorie, la Bibliothèque aussi — et pose les suivantes', () => {
  const plus = { fetiche: 'Sport' }
  // Leçon, la Bibliothèque : une autre question, que le serveur tire dans sa fétiche.
  for (const cle of ['lecon', 'bibliotheque']) {
    const j = dansLaMain(cle, undefined, plus)
    const i = j.etat().enAttente!
    const e = pliDeLExpedition(j.depart, [...j.gestes, { quoi: 'jouer', joker: cle, position: i }], j.questions, j.reponses)
    assert.equal(e.enAttente, i + 1, cle)
    assert.equal(e.aTirer?.categorie, 'Sport', cle)
  }
  // La Bibliothèque, posée : les questions suivantes de la rencontre aussi.
  const b = dansLaMain('bibliotheque', undefined, plus)
  b.jouer('bibliotheque')
  const n = b.etat().enAttente!
  b.reponses.set(n, false)
  const e = pliDeLExpedition(b.depart, b.gestes, b.questions, b.reponses)
  if (e.rencontre) assert.equal(e.aTirer?.categorie, 'Sport')
  // À sa version : une expédition partie en version 13 la joue telle qu'elle l'a tirée.
  assert.equal(changeDeQuestion('bibliotheque', V), true)
  assert.equal(changeDeQuestion('bibliotheque', VERSION_DE_LA_FRISE), false, 'en version 13, elle attend les suivantes')
})

test('le Métamorphe choisit la forme : Miroir en vrai ou faux à deux crans, Métamorphose à composer — trois —, le Prisme à six choix, trois réponses effacées ; Caméléon paie ce qui n’est pas à quatre choix', () => {
  assert.equal(formeDeLaCarte('miroir', V), 'vrai-faux')
  assert.equal(formeDeLaCarte('metamorphose+', V), 'lettres')
  assert.equal(formeDeLaCarte('prisme', V), 'six')
  assert.equal(formeDeLaCarte('prisme', VERSION_DE_LA_FRISE), undefined)
  for (const [cle, crans] of [
    ['miroir', 2],
    ['metamorphose', CRANS_DE_POLYMORPHE],
    ['prisme', CRANS_D_UNE_QUESTION_DURE],
  ] as const) {
    const j = dansLaMain(cle, k => void k.poser({ compose: true }))
    const nue = j.copie().repondre(true).coup!.brises
    j.jouer(cle)
    assert.equal(j.questions[j.etat().enAttente!].forme, formeDeLaCarte(cle, V), `${cle} : reposée`)
    if (cle === 'prisme') assert.equal(j.vue().effacees, 3, 'trois réponses effacées')
    const e = j.repondre(true)
    // Ses crans à la place de ceux de sa forme d'avant : une question facile à quatre choix en vaut un.
    assert.equal(e.coup!.brises, nue - 1 + crans, cle)
  }
  // Caméléon, joué sur la question : un cran de plus si juste — deux sur une question qui n'est pas à quatre choix, celle de l'escale ;
  // un de plus encore, amélioré. Ses chiffres (`chiffresApresLaCarte`), puis le verdict, la règle même du pli et de l'aperçu.
  const sienne = (cle: string) => ({ charge: chiffresApresLaCarte(cle, { inspiration: 0, charge: 0, garde: 0, serie: 0 }, [], { v: V }).charge, mise: 0, jouees: [cle], surLaQuestion: [] })
  const crans = (question: { reponses: number; forme?: 'quatre' | 'six' | 'vrai-faux' }, cle: string) => cransDUneBonneReponse({ question, tour: sienne(cle), pouvoirs: [], v: V })
  assert.equal(crans({ reponses: 4 }, 'cameleon'), 2, 'à quatre choix, sans forme : un de plus')
  assert.equal(crans({ reponses: 4, forme: 'quatre' }, 'cameleon'), 2)
  assert.equal(crans({ reponses: 2, forme: 'vrai-faux' }, 'cameleon'), 3, 'un vrai ou faux : deux de plus')
  assert.equal(crans({ reponses: 6, forme: 'six' }, 'cameleon+'), CRANS_D_UNE_QUESTION_DURE + 3)
  // Plus de question tirée à six choix sous lui : le serveur la tire à la forme de son escale.
  const c = dansLaMain('cameleon')
  c.jouer('cameleon')
  const n = c.etat().enAttente!
  c.reponses.set(n, false)
  assert.equal((pliDeLExpedition(c.depart, c.gestes, c.questions, c.reponses).aTirer as Record<string, unknown> | null)?.forme, undefined)
})

test('le Devin souffle : Astrolabe efface une réponse et dit l’initiale, Troisième œil une lettre à chaque question — un cran par bonne réponse, sans les crans d’avant', () => {
  assert.equal(effaceesDuTour(['astrolabe'], [], { reponses: 4 }), 1)
  assert.equal(effaceesDuTour(['astrolabe+'], [], { reponses: 4 }), 2)
  // Troisième œil : jusqu'à la version 13, chaque indice frappait un cran de plus ; plus aux familles.
  const chiffres = (v: number) => chiffresApresLaCarte('coup-d-oeil', { inspiration: 0, charge: 0, garde: 0, serie: 0 }, ['troisieme-oeil'], { v }).charge
  assert.equal(chiffres(VERSION_DE_LA_FRISE), 1)
  assert.equal(chiffres(V), 0)
  // Posé, il souffle : une bonne réponse ne vaut plus qu'un cran — six choix et Concentration n'y ajoutent rien.
  const corsee = (pouvoirs: string[], v = V) =>
    cransDUneBonneReponse({ question: { reponses: 6, forme: 'six' }, tour: { charge: 1, mise: 0, jouees: ['concentration'], surLaQuestion: [] }, pouvoirs, v })
  assert.equal(corsee([]), CRANS_D_UNE_QUESTION_DURE + 1)
  assert.equal(corsee(['troisieme-oeil']), 1)
  assert.equal(corsee(['troisieme-oeil+']), 1)
  assert.equal(corsee(['troisieme-oeil'], VERSION_DE_LA_FRISE), CRANS_D_UNE_QUESTION_DURE + 1, 'la version 13 ne le plafonne pas')
  // Il se ferme à sa prochaine erreur : la défausse le reprend, et le verdict le dit ; juste, il reste.
  const oeil = dansLaMain('troisieme-oeil')
  oeil.jouer('troisieme-oeil')
  const juste = oeil.copie()
  let e = oeil.repondre(false)
  assert.deepEqual(e.coup!.retombees, ['troisieme-oeil'])
  assert.ok(!e.rencontre?.pouvoirs.includes('troisieme-oeil') && e.cycle!.defausse.includes('troisieme-oeil'))
  e = juste.repondre(true)
  assert.equal(e.coup!.retombees, undefined)
  if (e.rencontre) assert.ok(e.rencontre.pouvoirs.includes('troisieme-oeil'), 'juste, il souffle encore')
  // Le Prisme et le Rythme d'avant, des crans ; plus aux familles.
  assert.equal(cransDesPouvoirs({ pouvoirs: ['prisme'], forme: 'six', v: VERSION_DE_LA_FRISE }), 1)
  assert.equal(cransDesPouvoirs({ pouvoirs: ['prisme'], forme: 'six', v: V }), 0)
  assert.equal(cransDesPouvoirs({ pouvoirs: ['rythme'], serie: 4, v: VERSION_DE_LA_FRISE }), 1)
  assert.equal(cransDesPouvoirs({ pouvoirs: ['rythme'], serie: 4, v: V }), 0)
})

test('l’Élan enchaîne : le Rythme efface et revient s’il a juste, Foulée frappe deux crans et revient ; Vent arrière frappe chaque bonne réponse de la rencontre', () => {
  // Le Rythme : une réponse effacée — deux, amélioré —, et sa bonne réponse le rend à sa main, comme Foulée.
  assert.equal(effaceesDuTour(['rythme'], [], { reponses: 4 }), 1)
  assert.equal(effaceesDuTour(['rythme+'], [], { reponses: 4 }), 2)
  assert.equal(revientSiJuste('rythme+', []), true)
  const j = dansLaMain('rythme')
  j.jouer('rythme')
  assert.equal(j.vue().effacees, 1)
  const faux = j.copie()
  let e = j.repondre(true)
  assert.deepEqual(e.coup!.revenues, ['rythme'])
  e = faux.repondre(false)
  assert.ok(e.cycle!.defausse.includes('rythme'), 'fausse : à la défausse')
  // Foulée et Accélération : deux crans de plus — Foulée trois, améliorée —, série ou non.
  const charge = (cle: string, serie = 0) => chiffresApresLaCarte(cle, { inspiration: 0, charge: 0, garde: 0, serie }, [], { v: V }).charge
  assert.deepEqual([charge('foulee'), charge('foulee', 2), charge('foulee+'), charge('acceleration'), charge('acceleration+')], [2, 2, 3, 2, 2])
  // Vent arrière : deux à chaque bonne réponse tant qu'il est posé, et il tient toute la rencontre — une erreur ne le fait pas retomber.
  assert.equal(cransDesPouvoirs({ pouvoirs: ['vent-arriere'], v: V }), 2)
  assert.equal(cransDesPouvoirs({ pouvoirs: ['vent-arriere+'], serie: 3, v: V }), 2)
  // L'Encyclopédie de l'Érudit, de même, dès la première bonne réponse : un.
  assert.equal(cransDesPouvoirs({ pouvoirs: ['encyclopedie'], trouvees: 0, v: V }), 1)
  assert.equal(cransDesPouvoirs({ pouvoirs: ['encyclopedie'], trouvees: 0, v: VERSION_DE_LA_FRISE }), 0, 'la version 13 attendait la deuxième')
  const v = dansLaMain('vent-arriere')
  v.jouer('vent-arriere')
  e = v.repondre(false)
  assert.equal(e.coup!.retombees, undefined)
  if (e.rencontre) assert.ok(e.rencontre.pouvoirs.includes('vent-arriere'))
})

test('la carte de départ de l’Élan revient s’il a juste ; Inarrêtable, posé, pardonne sa prochaine erreur — sans attaque — puis retombe', () => {
  // Échauffement : un cran de plus et la série, comme à la version 13 — et sa bonne réponse le rend à sa main, comme Foulée.
  assert.ok(revientSiJuste('echauffement', []) && revientSiJuste('echauffement+', []))
  assert.deepEqual(chiffresApresLaCarte('echauffement', { inspiration: 0, charge: 0, garde: 0, serie: 0 }, [], { v: V }), { inspiration: 0, charge: 1, garde: 0, serie: 1 })
  const ech = dansLaMain('echauffement')
  const faux = ech.copie()
  ech.jouer('echauffement')
  let e = ech.repondre(true)
  assert.deepEqual(e.coup!.revenues, ['echauffement'])
  faux.jouer('echauffement')
  assert.ok(faux.repondre(false).cycle!.defausse.includes('echauffement'), 'fausse : à la défausse')
  // Inarrêtable : l'erreur ne l'attaque pas tant qu'il est posé — la version 13 tenait la série, et attaquait.
  const tour = { jouees: [], surLaQuestion: [] }
  assert.equal(attaqueEnQuestion({ frappe: 6, tour, pouvoirs: ['inarretable'], v: V }), 0)
  assert.equal(attaqueEnQuestion({ frappe: 6, tour, pouvoirs: ['inarretable+'], v: V }), 0)
  assert.equal(attaqueEnQuestion({ frappe: 6, tour, pouvoirs: ['inarretable'], v: VERSION_DE_LA_FRISE }), 6)
  const j = dansLaMain('inarretable')
  const courage = j.etat().courage
  j.jouer('inarretable')
  const juste = j.copie()
  e = j.repondre(false)
  assert.equal(e.coup!.perdu, 0)
  assert.equal(e.courage, courage)
  // Elle a servi : la défausse le reprend, le verdict le dit — et l'erreur d'après attaque.
  assert.deepEqual(e.coup!.retombees, ['inarretable'])
  assert.ok(!e.rencontre?.pouvoirs.includes('inarretable') && e.cycle!.defausse.includes('inarretable'))
  if (e.rencontre) {
    if (e.rencontre.tour.phase === 'preparation') j.voir(0)
    assert.ok(j.repondre(false).coup!.perdu > 0, 'la suivante attaque')
  }
  // Juste, il reste posé, pour la prochaine.
  e = juste.repondre(true)
  assert.equal(e.coup!.retombees, undefined)
  if (e.rencontre) assert.ok(e.rencontre.pouvoirs.includes('inarretable'))
})

/**
 * Un journal où cette carte du pari est dans la main de l'élite, à l'annonce — avant la question, où elle se joue. Une graine
 * cherchée, jamais choisie.
 */
function aLAnnonce(cle: string): Journal {
  // Une carte jouée à chaque question fait de la place : une main pleine ne tire plus — la carte prise en route attendrait dans la pioche.
  const joueUneCarte = (j: Journal) => {
    const e = j.etat()
    const autre = e.rencontre?.main.find(k => k !== cle && refusDUneCarte(j.depart, e, k, j.questions) === null)
    if (autre) j.jouer(autre)
  }
  for (let n = 0; n < 3000; n++) {
    const j = new Journal(enV14(`familles:annonce:${cle}:${n}`, [cle]))
    let e = j.avancer('e00')
    if (e.rencontre!.tour.phase === 'preparation') e = j.voir(0)
    joueUneCarte(j)
    j.gagner()
    j.prendreSiOfferte(cle)
    j.avancer('e10')
    j.prendreSiOfferte(cle)
    e = j.avancer('e20')
    for (let q = 0; q < 4 && e.rencontre?.sorte === 'elite'; q++) {
      if (e.rencontre.tour.phase === 'preparation' && e.rencontre.main.includes(cle) && refusDUneCarte(j.depart, e, cle, j.questions) === null) return j
      j.voir(0)
      joueUneCarte(j)
      e = j.repondre(false)
    }
  }
  throw new Error(`aucune graine ne met ${cle} dans une main à l’annonce`)
}

test('les cartes du pari servent sans parier : Banco et Doubler la mise frappent, Assurance pare l’attaque, Pactole frappe toute la rencontre — à l’annonce, en plus de la carte de la question', () => {
  for (const [cle, plus] of [
    ['banco', 2],
    ['doubler-la-mise', 1],
  ] as const) {
    const j = aLAnnonce(cle)
    const nue = j.copie()
    nue.voir(0)
    const sans = nue.repondre(true).coup!.brises
    j.jouer(cle)
    j.voir(0)
    // La question vue, une carte se joue encore : celles du pari ne comptent pas pour la carte de la question.
    const autre = j.etat().rencontre!.main.find(k => !estDuPari(k))
    if (autre) assert.notEqual(refusDUneCarte(j.depart, j.etat(), autre, j.questions), 'Une carte par question : tu en as déjà joué une', cle)
    assert.equal(j.repondre(true).coup!.brises, sans + plus, `${cle} : ses crans, sans pari`)
  }
  // Assurance : l'erreur ne l'attaque pas — la version 13 la laissait attaquer.
  const a = aLAnnonce('assurance')
  const courage = a.etat().courage
  a.jouer('assurance')
  a.voir(0)
  const e = a.repondre(false)
  assert.equal(e.coup!.perdu, 0)
  assert.equal(e.courage, courage)
  const tour = { jouees: ['assurance'], surLaQuestion: [] }
  assert.equal(attaqueEnQuestion({ frappe: 6, tour, pouvoirs: [], v: V }), 0)
  assert.equal(attaqueEnQuestion({ frappe: 6, tour, pouvoirs: [], v: VERSION_DE_LA_FRISE }), 6)
  // Banco, son pari gagné : un cran de plus encore.
  const banco = (mise: number, cle = 'banco') =>
    cransDUneBonneReponse({ question: { reponses: 4 }, tour: { charge: chiffresApresLaCarte(cle, { inspiration: 0, charge: 0, garde: 0, serie: 0 }, [], { v: V }).charge, mise, jouees: [cle], surLaQuestion: [] }, pouvoirs: [], v: V })
  assert.deepEqual([banco(0), banco(10), banco(0, 'banco+'), banco(10, 'banco+')], [3, 4, 4, 5])
  // Pactole, posé à l'annonce : chaque bonne réponse de la rencontre, un cran — deux, son pari gagné ; la version 13 attendait le pari.
  assert.deepEqual(
    [cransDesPouvoirs({ pouvoirs: ['pactole'], v: V }), cransDesPouvoirs({ pouvoirs: ['pactole'], gagne: true, v: V }), cransDesPouvoirs({ pouvoirs: ['pactole+'], gagne: true, v: V })],
    [1, 2, 3],
  )
  assert.equal(cransDesPouvoirs({ pouvoirs: ['pactole'], v: VERSION_DE_LA_FRISE }), 0)
})

// ── La carte levée tient sa promesse ────────────────────────────────────────

/** Ce qu'il faut à une carte pour se jouer : sa réponse qui se compose, une erreur juste avant. */
const POUR_SE_JOUER: Readonly<Record<string, (j: Journal) => void>> = {
  metamorphose: j => void j.poser({ compose: true }),
  'contre-attaque': j => void j.repondre(false),
}

test('chaque carte des familles, levée, promet ce que le pli fait de sa bonne réponse', async () => {
  const { apercuALaMise, changementDeLaCarte } = await pieces()
  // Leçon et la Bibliothèque changent de question : l'aperçu d'une autre question ne se promet pas. Celles du pari se jouent à
  // l'annonce : leur test à elles.
  for (const cle of [...REPRISES, ...RETOUCHEES].filter(c => c !== 'lecon' && c !== 'bibliotheque' && c !== 'pactole' && !DU_PARI.includes(c))) {
    const j = dansLaMain(cle, POUR_SE_JOUER[cle])
    const avant = j.vue()
    assert.equal(avant.refus[cle], null, `${cle} se joue ici`)
    const promis = changementDeLaCarte(avant, 0, 'Histoire', cle)
    const avantLaCarte = apercuALaMise(avant, 0, 'Histoire')!
    j.jouer(cle)
    const apres = apercuALaMise(j.vue(), 0, 'Histoire')!
    if (promis) assert.deepEqual(promis.apres.juste.brises, apres.juste.brises, `${cle} : ce qu’elle promet, juste`)
    else assert.deepEqual(apres.juste.brises, avantLaCarte.juste.brises, `${cle} : ne changeant rien, elle ne promet rien`)
    const e = j.repondre(true)
    assert.equal(e.coup!.brises, Math.min(apres.juste.brises, e.coup!.brises + (e.rencontre?.sceaux ?? 0)), `${cle} : les crans promis`)
    if (!e.coup!.victoire) assert.equal(e.coup!.brises, apres.juste.brises, `${cle} : les crans promis`)
  }
})

// ── Par les routes ──────────────────────────────────────────────────────────

let banc: Banc

before(async () => {
  banc = await demarrer({ baseDeLaCampagne: baseDEssai(240, { categories: ['Histoire'] }), questionAuCentre: true })
})

after(() => banc.close())

const lire = (cookie: string, chemin = '/api/expedition') => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (cookie: string, chemin: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const geste = (cookie: string, v: VueDeLExpedition, g: unknown) => poster(cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: g })

function base<T>(fn: (db: Database.Database) => T, ecriture = false): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: !ecriture, fileMustExist: true })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/** Les questions telles que l'expédition les garde, bonne réponse comprise : ce que seul le serveur sait. */
const questionsDe = (id: string): { reponses: string[]; bonne: number }[] =>
  base(db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions))

/**
 * Partir aux familles, puis récrire le départ gardé : le Rempart pour style,
 * les escales du premier étage en questions d'Histoire à quatre choix, et une
 * graine où la main de l'acte s'ouvre sur Parade — cherchée par le vrai pli.
 */
async function partirAuRempart(cookie: string): Promise<VueDeLExpedition> {
  const r = await poster(cookie, '/api/expedition', { rencontres: true, questionAuCentre: true })
  assert.equal(r.status, 200, r.corps.error)
  const v = r.corps as VueDeLExpedition
  base(db => {
    const d = JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(v.id) as { expedition: string }).expedition) as DepartDExpedition
    // La préproduction part au détail (v15), qui garde les familles : le Rempart s'y joue à leurs règles.
    assert.equal(d.v, VERSION_DU_DETAIL)
    d.style = 'rempart'
    for (const e of d.cartes[0].escales) {
      if (e.etage !== 0) continue
      for (const cle of ['curiosite', 'chance'] as const) delete e[cle]
      Object.assign(e, { sorte: 'question', theme: { categories: ['Histoire'] }, forme: 'quatre', chance: 0.7 })
    }
    const graine = Array.from({ length: 2000 }, (_, k) => `familles:route:${k}`).find(g => pliDeLExpedition({ ...d, graine: g }, [], [], new Map()).cycle?.main.includes('parade'))
    assert.ok(graine, 'une graine qui ouvre la main sur Parade')
    d.graine = graine
    db.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(d), v.id)
  }, true)
  await banc.redemarrer()
  return (await lire(cookie)).corps.expedition
}

test('par les routes : ratée sous Parade, l’essai s’écrit au journal des gestes — ni bonne réponse, ni anecdote —, sa réponse effacée ; la seconde se juge, aidée', async () => {
  const c = await inscrireProfil(banc.url, 'rempart', 'Rempart')
  let v = await partirAuRempart(c)
  assert.equal(v.cartes!.v, VERSION_DU_DETAIL)
  v = (await geste(c, v, { quoi: 'avancer', vers: v.carte!.depart[0] })).corps.expedition
  if (v.rencontre!.phase === 'preparation') v = (await geste(c, v, { quoi: 'voir', mise: 0, position: v.rencontre!.position })).corps.expedition
  const q = v.question!
  const gardee = questionsDe(v.id)[q.index]
  assert.equal(v.rencontre!.refus.parade, null)
  v = (await geste(c, v, { quoi: 'jouer', joker: 'parade', position: q.index })).corps.expedition
  assert.equal(v.rencontre!.apercu!.faux.essai, true)
  // Une page ne peut pas écrire d'essai elle-même.
  const force = await geste(c, v, { quoi: 'essai', position: q.index })
  assert.equal(force.status, 400)
  const fausse = (gardee.bonne + 1) % gardee.reponses.length
  const essai = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q.index, choix: fausse })
  assert.equal(essai.status, 200, essai.corps.error)
  // Invariant 1 : rien ne dit la bonne réponse.
  assert.equal(essai.corps.essai, 'parade')
  assert.equal(essai.corps.bonne, -1)
  assert.equal(essai.corps.anecdote, null)
  assert.equal(essai.corps.coup, undefined)
  v = essai.corps.expedition
  assert.equal(v.question!.index, q.index, 'la même question attend')
  assert.equal((v.question as unknown as { bonne?: number }).bonne, undefined, 'sans sa bonne réponse')
  assert.deepEqual(v.question!.effacees, [fausse], 'sa réponse ratée ne se propose plus')
  assert.equal(v.rencontre!.essai, 'parade')
  // À l'écran : ce qui s'est passé, et ce qu'il fait maintenant — la réponse ratée éteinte.
  const { Escale } = await page()
  const html = await rendre(Escale, { vue: v, avant: null, question: v.question, reponse: null, choix: null, busy: false, erreur: '', onRepondre: rien, onJouer: rien, onSuite: rien, onPartir: rien, onSignaler: rien })
  assert.match(texte(html), /Raté — Parade efface ta réponse : réponds encore\./)
  const ecrits = base(db => db.prepare('SELECT geste FROM expedition_gestes WHERE serie_id = ? ORDER BY rang').all(v.id) as { geste: string }[]).map(g => JSON.parse(g.geste))
  assert.deepEqual(ecrits.at(-1), { quoi: 'essai', position: q.index, choix: fausse })
  assert.equal(base(db => db.prepare('SELECT COUNT(*) AS n FROM campagne_reponses WHERE serie_id = ?').get(v.id) as { n: number }).n, 0, 'aucune réponse écrite')
  // Relue après un redémarrage, l'expédition retrouve son essai.
  await banc.redemarrer()
  v = (await lire(c)).corps.expedition
  assert.deepEqual(v.question!.effacees, [fausse])
  // La seconde : juste, jugée — aidée, sous la clé de Parade.
  const juste = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q.index, choix: gardee.bonne })
  assert.equal(juste.status, 200, juste.corps.error)
  assert.equal(juste.corps.juste, true)
  assert.equal(juste.corps.bonne, gardee.bonne)
  const ligne = base(db => db.prepare('SELECT choix, juste, joker FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(v.id, q.index)) as Record<string, unknown>
  assert.deepEqual(ligne, { choix: gardee.bonne, juste: 1, joker: 'parade' })
})

// ── À l'écran ───────────────────────────────────────────────────────────────

/** La page, chargée par son adresse : le typage du serveur ne lit pas le JSX du client. */
const page = (): Promise<{ Escale: Composant }> => import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)

test('à l’écran : « Tu réponds encore » à l’aperçu, les règles et la façon de répondre de chaque style — la version 13 n’en dit rien', async () => {
  const { Apercu, FeuilleDesRegles } = (await pieces()) as unknown as { Apercu: Composant; FeuilleDesRegles: Composant }
  const j = dansLaMain('parade')
  j.jouer('parade')
  const apercu = texte(await rendre(Apercu, { a: j.vue().apercu }))
  assert.match(apercu, /Si tu te trompes Tu réponds encore/)
  assert.match(apercu, /raté encore, tu perds \d+/)
  const regles = async (v: number) => texte(await rendre(FeuilleDesRegles, { rencontres: true, v, codex: codexDuNiveau(NIVEAU_MAX, [], [], v), ascension: 0, onFermer: rien }))
  const v14 = await regles(V)
  assert.match(v14, /Un second essai — les cartes du Rempart : ratée, ta réponse s’efface, rien n’est jugé, et tu réponds encore\. Jamais sur un vrai ou faux\./)
  for (const s of STYLES_DES_FAMILLES) assert.ok(v14.includes(jeuDuStyle(s, V)!.replace(/^./, x => x.toLowerCase())), s)
  assert.doesNotMatch(await regles(VERSION_DE_LA_FRISE), /second essai/i)
  // Posés, Troisième œil et Inarrêtable ne tiennent que jusqu'à la prochaine erreur : la ligne le dit, pas « toute la rencontre ».
  const { ceQueLaCarteAFait } = (await pieces()) as unknown as { ceQueLaCarteAFait: (cle: string, v?: number) => string | null }
  assert.equal(ceQueLaCarteAFait('troisieme-oeil', V), '« Troisième œil » souffle jusqu’à ta prochaine erreur')
  assert.equal(ceQueLaCarteAFait('inarretable', V), '« Inarrêtable » pardonne ta prochaine erreur')
  assert.equal(ceQueLaCarteAFait('inarretable', VERSION_DE_LA_FRISE), '« Inarrêtable » agit pour toute la rencontre')
})
