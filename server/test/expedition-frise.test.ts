// La frise (la version 13 du départ, le 20 octobre 2026 — l'étape 5 de « La
// question au centre », `retours/2026-10-20/la-frise.md`). Le testeur : « des
// événements à remettre dans l'ordre » ; le propriétaire, parti se coucher :
// « je te laisse continuer les étapes et appliquer tes recommandations ».
// Quatre événements de la base, rangés du plus ancien au plus récent : leur
// ligne, le choix de la frise, le générateur, les cartes, le pli, les routes,
// l'écran.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireLaBase } from '../src/core/baseCampagne'
import { codexDuNiveau } from '../../shared/codex'
import { CATEGORIES } from '../../shared/categories'
import { anneeDe } from '../../shared/sujets'
import { hasardDe } from '../../shared/missions'
import {
  ECART_DE_LA_FRISE,
  EVENEMENTS_D_UNE_FRISE,
  PREFIXE_DE_LA_FRISE,
  QUESTION_DE_LA_FRISE,
  anneeDite,
  choisirLaFrise,
  evenementsDates,
  friseJuste,
  lireUnOrdre,
  ordreDansLeTemps,
  ordreGarde,
  ordreMontre,
  refusDuLibelle,
  type EvenementDeLaFrise,
} from '../../shared/frise'
import {
  CRANS_D_UNE_QUESTION_DURE,
  VERSION_DES_CURIOSITES,
  VERSION_DE_LA_FRISE,
  cransDeLaForme,
  effaceesDuTour,
  refusDeLaCarte,
  type ContexteDUneCarte,
  type QuestionDuTour,
} from '../../shared/rencontres'
import {
  POIDS_DES_ESCALES_DES_RENCONTRES,
  POIDS_DES_FORMES_A_COMPOSER,
  POIDS_DES_FORMES_A_LA_FRISE,
  carteDUnActe,
  chanceSelonLaForme,
  pliDeLExpedition,
  type DepartDExpedition,
  type VueDeLExpedition,
} from '../../shared/expedition'
import { Journal, depart, pieces, rendre, rien, texte, type Composant } from './expedition-journal'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

const V = VERSION_DE_LA_FRISE
const LIGNES = JSON.parse(readFileSync(new URL('../content/frises/evenements.json', import.meta.url), 'utf8')) as { id: string; evenement: string }[]

/** Un événement d'essai, de cette année et de cette catégorie. */
const evenement = (id: string, annee: number, categorie = 'Histoire'): EvenementDeLaFrise => ({ id, evenement: `L’événement ${id}`, annee, categorie })

// ── Une ligne, le choix de quatre événements ────────────────────────────────

test('une ligne d’événement dit ce qui s’est passé, jamais quand — un nom de roi ou un titre ne date rien', () => {
  for (const bonne of ['La prise de la Bastille', 'François Ier est fait prisonnier à Pavie', 'La naissance de la Ve République', 'Les Beatles sortent Help!', 'Neil Armstrong marche sur la Lune', 'Apollo 11 se pose sur la Lune']) {
    assert.equal(refusDuLibelle(bonne), null, bonne)
  }
  for (const [mauvaise, pourquoi] of [
    ['La prise de la Bastille en 1789', 'une année'],
    ['Le sacre de Charlemagne, en 800', 'une année de trois chiffres'],
    ['Le début du XIXe siècle', 'un siècle'],
    ['Le disco des années 70', 'une décennie'],
    ['César conquiert la Gaule, av. J.-C', 'avant Jésus-Christ'],
    ['La prise de la Bastille.', 'le point d’une phrase'],
    ['la prise de la Bastille', 'une minuscule en tête'],
    ['La Lune', 'trop court'],
    [`La ${'très '.repeat(20)}longue ligne`, 'trop long'],
    [' La prise de la Bastille', 'un espace au bord'],
    [42, 'pas une ligne'],
  ] as const) {
    assert.notEqual(refusDuLibelle(mauvaise), null, pourquoi)
  }
  assert.equal(anneeDite(1789), '1789')
  assert.equal(anneeDite(-52), '52 av. J.-C.')
})

test('quatre événements, dans l’ordre du temps, à l’écart de la marche ; ceux qu’il n’a jamais vus d’abord ; trop serrés, l’écart se divise, jamais deux de la même année', () => {
  const tas = [1500, 1540, 1580, 1620, 1660, 1700, 1701, 1702].map((a, i) => evenement(`e${i}`, a))
  for (let n = 0; n < 200; n++) {
    const f = choisirLaFrise(tas, ECART_DE_LA_FRISE.facile, hasardDe(`frise:${n}`))!
    assert.equal(f.length, EVENEMENTS_D_UNE_FRISE)
    assert.ok(f.every((e, k) => k === 0 || e.annee - f[k - 1].annee >= ECART_DE_LA_FRISE.facile), f.map(e => e.annee).join(' '))
  }
  // Ce qu'il a déjà vu passe après : quatre jamais vus suffisent.
  const vus = new Set(['e0', 'e1', 'e2', 'e3'])
  for (let n = 0; n < 50; n++) {
    const f = choisirLaFrise(tas, 1, hasardDe(`frise:vus:${n}`), id => vus.has(id))!
    assert.ok(f.every(e => !vus.has(e.id)), f.map(e => e.id).join(' '))
  }
  // Une catégorie serrée — cinquante ans en tout — : l'écart se divise, jusqu'à ce qu'elle tienne.
  const serre = [1980, 1990, 2000, 2010, 2020].map((a, i) => evenement(`s${i}`, a))
  const f = choisirLaFrise(serre, ECART_DE_LA_FRISE.facile, hasardDe('frise:serre'))!
  assert.equal(new Set(f.map(e => e.annee)).size, 4)
  // Trois années différentes seulement : pas de frise.
  assert.equal(choisirLaFrise([1990, 1990, 2000, 2010].map((a, i) => evenement(`m${i}`, a)), 1, hasardDe('frise:meme')), null)
})

test('l’ordre montré n’est jamais le bon ; ce que le téléphone envoie, ce que le serveur juge et garde', () => {
  for (let n = 0; n < 300; n++) {
    const montre = ordreMontre(4, hasardDe(`montre:${n}`))
    assert.deepEqual([...montre].sort(), [0, 1, 2, 3])
    assert.ok(!montre.every((x, i) => x === i), montre.join(''))
  }
  const montre = [2, 0, 3, 1]
  // Le bon ordre, par le rang des cartes à l'écran : celle qui montre le rang 0, puis le 1…
  const bon = [0, 1, 2, 3].map(k => montre.indexOf(k))
  assert.ok(friseJuste(ordreDansLeTemps(bon, montre)))
  assert.ok(!friseJuste(ordreDansLeTemps([0, 1, 2, 3], montre)))
  assert.deepEqual(lireUnOrdre([3, 1, 0, 2], 4), [3, 1, 0, 2])
  for (const brut of [[0, 1, 2], [0, 1, 1, 2], [0, 1, 2, 4], [0, 1, 2, 1.5], '0123', null, 3]) assert.equal(lireUnOrdre(brut, 4), null, JSON.stringify(brut))
  assert.deepEqual(ordreGarde('1032', 4), [1, 0, 3, 2])
  assert.equal(ordreGarde('103', 4), null)
  assert.equal(ordreGarde('1x32', 4), null)
  // Ce qu'une carte date : autant que ce qu'elle effacerait, jamais les quatre ; le même hasard, les mêmes.
  assert.deepEqual(evenementsDates(hasardDe('date'), 4, 0), [])
  assert.equal(evenementsDates(hasardDe('date'), 4, 1).length, 1)
  assert.equal(evenementsDates(hasardDe('date'), 4, 9).length, 3)
  assert.deepEqual(evenementsDates(hasardDe('date'), 4, 2), evenementsDates(hasardDe('date'), 4, 2))
})

// ── Le contenu ──────────────────────────────────────────────────────────────

test('les événements livrés : chacun une question datée de la base, une ligne qui ne date rien, une fois — et de quoi faire une frise facile dans chaque catégorie', () => {
  const parId = new Map(lireLaBase().questions.map(q => [q.id, q]))
  // Au moins ce qui a été livré le 20 octobre 2026 — 1 309 événements, 47 en cuisine au moins : un rangement qui en perdrait se verrait.
  assert.ok(LIGNES.length >= 1309, `${LIGNES.length} événements`)
  assert.equal(new Set(LIGNES.map(l => l.id)).size, LIGNES.length, 'chacun une fois')
  assert.equal(new Set(LIGNES.map(l => l.evenement)).size, LIGNES.length, 'chaque ligne une fois')
  const parCategorie = new Map<string, EvenementDeLaFrise[]>()
  for (const l of LIGNES) {
    assert.equal(refusDuLibelle(l.evenement), null, `${l.id} : ${l.evenement}`)
    const q = parId.get(l.id)
    assert.ok(q, `${l.id} (${l.evenement}) : plus dans la base — retire-le, ou récris la question qui l’a remplacée`)
    assert.ok(q.meta.date && ['annee', 'mois', 'jour'].includes(q.meta.date.precision), `${l.id} : datée à l’année près`)
    const e = { id: l.id, evenement: l.evenement, annee: anneeDe(q.meta.date)!, categorie: q.meta.categorie }
    parCategorie.set(e.categorie, [...(parCategorie.get(e.categorie) ?? []), e])
  }
  for (const c of CATEGORIES) {
    const tas = parCategorie.get(c) ?? []
    assert.ok(tas.length >= 40, `${c} : ${tas.length} événements`)
    assert.ok(choisirLaFrise(tas, ECART_DE_LA_FRISE.facile, hasardDe(`livres:${c}`)), `${c} : une frise facile`)
  }
})

// ── Le générateur ───────────────────────────────────────────────────────────

test('la version 13 : une escale sur dix en frise dès l’étage 2, sur le même tirage — ni la sorte ni le thème d’une escale ne bougent', () => {
  let frises = 0
  let formes = 0
  for (let i = 0; i < 300; i++) {
    const tirer = (poids: typeof POIDS_DES_FORMES_A_LA_FRISE) => carteDUnActe(`frise:${i}`, i % 3, [], undefined, POIDS_DES_ESCALES_DES_RENCONTRES, poids, true)
    const avant = tirer(POIDS_DES_FORMES_A_COMPOSER)
    const apres = tirer(POIDS_DES_FORMES_A_LA_FRISE)
    assert.ok(!avant.escales.some(e => e.forme === 'frise'), 'la version 12 n’en pose aucune')
    assert.deepEqual(
      apres.escales.map(e => [e.id, e.sorte, JSON.stringify(e.theme), e.curiosite]),
      avant.escales.map(e => [e.id, e.sorte, JSON.stringify(e.theme), e.curiosite]),
      'la même carte, à la forme près',
    )
    for (const e of apres.escales) {
      if (e.etage === 0) assert.notEqual(e.forme, 'frise', 'le premier étage ne change pas')
      else if (e.forme) {
        formes++
        if (e.forme === 'frise') frises++
      }
    }
  }
  assert.ok(Math.abs(frises / formes - 0.1) < 0.025, `${frises} frises sur ${formes} escales`)
})

// ── Les cartes et le pli ────────────────────────────────────────────────────

/** Une frise sous les yeux : ce que les règles des cartes en lisent. */
const surUneFrise = (main: string[], q: Partial<QuestionDuTour> = {}, surLaQuestion: string[] = []): ContexteDUneCarte => ({
  v: V,
  tour: { phase: 'question', inspiration: 0, jouees: [...surLaQuestion], surLaQuestion },
  main,
  pouvoirs: [],
  question: { reponses: 4, tiree: 'frise', forme: 'frise', six: false, nombre: false, datee: false, categorie: 'Histoire', ...q },
  courage: 50,
  derniereFrappe: 0,
  defausse: 1,
})

test('une frise : deux crans, un hasard d’un sur vingt-quatre ; ce qu’une carte effacerait, elle le date — deux au plus —, et ce qui n’y a pas de sens se refuse en le disant', () => {
  assert.equal(cransDeLaForme({ forme: 'frise', reponses: 4 }), CRANS_D_UNE_QUESTION_DURE)
  assert.ok(Math.abs(chanceSelonLaForme(0.25, 'frise') - 1 / 24) < 1e-9, 'au hasard, une fois sur vingt-quatre')
  assert.equal(chanceSelonLaForme(1, 'frise'), 1)
  const frise = { reponses: 4, forme: 'frise' as const }
  assert.equal(effaceesDuTour(['coup-d-oeil'], [], frise), 1)
  assert.equal(effaceesDuTour(['voyance'], [], frise), 2)
  assert.equal(effaceesDuTour(['revelation'], [], frise), 2, 'deux au plus : les deux autres restent à placer')
  assert.equal(effaceesDuTour(['repere'], [], frise), 1, 'Le repère date un événement')
  assert.equal(effaceesDuTour(['enigme'], [], frise), 1, 'le Sphinx aussi')
  for (const cle of ['coup-d-oeil', 'repere']) assert.equal(refusDeLaCarte(surUneFrise([cle]), cle), null, cle)
  // Deux déjà datés — la Voyance d'une autre main, posée avant : Coup d'œil n'a plus rien à dater.
  const dejaDeux = surUneFrise(['coup-d-oeil'])
  assert.equal(refusDeLaCarte({ ...dejaDeux, tour: { ...dejaDeux.tour, surLaQuestion: ['voyance'] } }, 'coup-d-oeil'), 'Deux événements sont déjà datés : les autres sont à toi')
  for (const [cle, refus] of [
    ['double-chance', 'Pas sur une frise : elle n’a pas de choix'],
    ['corser', 'Pas sur une frise : elle n’a pas de choix à corser'],
    ['polymorphe', 'Pas sur une frise : elle n’a pas de choix à corser'],
    ['simplifier', 'Pas sur une frise : elle n’a pas de forme plus simple'],
    ['deux-visages', 'Pas sur une frise : deux frises à ranger, tu n’en finirais aucune'],
    ['prediction', 'Pas sur une frise : l’Oracle n’a aucune réponse à montrer'],
    ['initiale', 'Pas sur une frise : elle n’a pas de mot à écrire'],
    ['lettre', 'Pas sur une frise : elle n’a pas de mot à écrire'],
    ['arret-sur-image', 'Arrêt sur image se joue sur un dévoilement'],
  ]) {
    assert.equal(refusDeLaCarte(surUneFrise([cle]), cle), refus, cle)
  }
})

test('dans le pli, une frise rangée prend deux crans — trois sous Concentration', () => {
  for (let n = 0; n < 500; n++) {
    const j = new Journal(depart(`frise:pli:${n}`, [], { v: V, codex: codexDuNiveau(1, [], [], V) }))
    j.avancer('e00')
    j.poser({ forme: 'frise', tiree: 'frise', reponses: 4, datee: false })
    const e = j.etat()
    if (!e.rencontre?.main.includes('concentration') || e.rencontre.tour.phase !== 'question') continue
    assert.equal(j.vue().apercu!.juste.brises, CRANS_D_UNE_QUESTION_DURE)
    j.jouer('concentration')
    assert.equal(j.vue().apercu!.juste.brises, CRANS_D_UNE_QUESTION_DURE + 1)
    const juste = j.repondre(true)
    assert.equal(juste.coup!.brises, CRANS_D_UNE_QUESTION_DURE + 1)
    return
  }
  assert.fail('aucune graine ne met Concentration dans la première main')
})

// ── Par les routes ──────────────────────────────────────────────────────────

/** Une petite base d'Histoire, et les questions de la vraie que ses événements d'Histoire récrivent. */
const EVENEMENTS_D_HISTOIRE = (() => {
  const ids = new Set(LIGNES.map(l => l.id))
  return lireLaBase().questions.filter(q => ids.has(q.id) && q.meta.categorie === 'Histoire')
})()
const BASE = new BaseDeLaCampagne([...baseDEssai(120, { categories: ['Histoire'] }).questions, ...EVENEMENTS_D_HISTOIRE])

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

/** Les questions telles que l'expédition les garde : l'ordre du temps et les années, que seul le serveur sait. */
const questionsDe = (id: string): { id: string; reponses: string[]; frise?: { annees: number[]; montre: number[] } }[] =>
  base(db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions))

/** Le bon ordre d'une frise gardée, par le rang de ses cartes à l'écran. */
const bonOrdre = (montre: readonly number[]) => montre.map((_, k) => montre.indexOf(k))

/**
 * Partir en version 13, puis récrire le départ gardé : les escales des deux
 * premiers étages, des questions d'Histoire en frise ; une graine où la main
 * de l'acte s'ouvre avec cette carte — Coup d'œil d'office, cherchée par le
 * vrai pli —, et redémarrer le serveur pour qu'il le relise.
 */
async function partirALaFrise(cookie: string, carte = 'coup-d-oeil'): Promise<VueDeLExpedition> {
  const r = await poster(cookie, '/api/expedition', { rencontres: true, questionAuCentre: true })
  assert.equal(r.status, 200, r.corps.error)
  const v = r.corps as VueDeLExpedition
  base(db => {
    const d = JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(v.id) as { expedition: string }).expedition) as DepartDExpedition
    assert.equal(d.v, V)
    for (const e of d.cartes[0].escales) {
      if (e.etage > 1) continue
      for (const cle of ['curiosite', 'chance'] as const) delete e[cle]
      Object.assign(e, { sorte: 'question', theme: { categories: ['Histoire'] }, forme: 'frise' })
    }
    const premiere = { escale: d.cartes[0].depart[0], acte: 0, reponses: 4, niveau: 'facile' as const, tiree: 'frise' as const, forme: 'frise' as const, six: false, datee: false, categorie: 'Histoire' }
    const graine = Array.from({ length: 2000 }, (_, k) => `frise:route:${k}`).find(
      g => pliDeLExpedition({ ...d, graine: g }, [{ quoi: 'avancer', vers: d.cartes[0].depart[0] }], [premiere], new Map()).cycle?.main.includes(carte),
    )
    assert.ok(graine, `une graine qui ouvre la main sur ${carte}`)
    d.graine = graine
    db.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(d), v.id)
  }, true)
  await banc.redemarrer()
  return (await lire(cookie, '/api/expedition')).corps.expedition
}

const geste = (cookie: string, v: VueDeLExpedition, g: unknown) => poster(cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: g })

/** La page, chargée par son adresse : le typage du serveur ne lit pas le JSX du client. */
const page = (): Promise<{ Escale: Composant; PoserLaFrise: Composant }> => import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)

test('par les routes et à l’écran : une frise — ses événements dans un ordre qui n’est pas le bon, sans années ; datée par Coup d’œil ; rangée, deux crans ; ratée, l’ordre gardé et corrigé ; ni mesure, ni carnet, ni signalement', async () => {
  const c = await inscrireProfil(banc.url, 'historien', 'Historien')
  let v = await partirALaFrise(c)
  assert.equal(v.cartes!.v, V)
  v = (await geste(c, v, { quoi: 'avancer', vers: v.carte!.depart[0] })).corps.expedition
  const q = v.question!
  const gardee = questionsDe(v.id)[q.index]
  // Invariant 1 : quatre lignes dans l'ordre montré, ni l'ordre du temps ni une année ; la question gardée, si.
  assert.ok(gardee.id.startsWith(PREFIXE_DE_LA_FRISE), gardee.id)
  assert.equal(q.texte, QUESTION_DE_LA_FRISE)
  assert.equal(q.forme, 'frise')
  assert.deepEqual(q.reponses, [])
  assert.deepEqual(q.frise!.annees, [null, null, null, null])
  assert.deepEqual(q.frise!.evenements, gardee.frise!.montre.map(i => gardee.reponses[i]))
  assert.notDeepEqual(q.frise!.evenements, gardee.reponses, 'jamais dans le bon ordre')
  assert.ok(gardee.frise!.annees.every((a, k) => k === 0 || a > gardee.frise!.annees[k - 1]), 'gardée dans l’ordre du temps')
  for (const a of gardee.frise!.annees) assert.ok(!JSON.stringify(v).includes(`"${a}"`) && !JSON.stringify(v.question).includes(String(a)), `${a} ne part pas`)
  // Coup d'œil : un événement daté, à son année.
  assert.equal(v.rencontre!.refus['coup-d-oeil'], null)
  v = (await geste(c, v, { quoi: 'jouer', joker: 'coup-d-oeil', position: q.index })).corps.expedition
  const datees = v.question!.frise!.annees.flatMap((a, i) => (a === null ? [] : [i]))
  assert.equal(datees.length, 1)
  assert.equal(v.question!.frise!.annees[datees[0]], gardee.frise!.annees[gardee.frise!.montre[datees[0]]])
  // L'écran : ses places, ses cartes, l'année datée sous la sienne, « Valider » qui attend les quatre.
  const { Escale, PoserLaFrise } = await page()
  const html = await rendre(Escale, { vue: v, avant: null, question: v.question, reponse: null, choix: null, busy: false, erreur: '', onRepondre: rien, onJouer: rien, onSuite: rien, onPartir: rien, onSignaler: rien })
  assert.match(texte(html), /Le plus ancien.*Le plus récent/)
  // Ce qu'on lit : l'apostrophe droite rendue courbe, les espaces fines ordinaires (`texte`).
  for (const e of v.question!.frise!.evenements) assert.ok(texte(html).includes(e.replace(/'/g, '’').replace(/[\s  ]+/g, ' ')), e)
  assert.match(texte(html), new RegExp(`${v.question!.frise!.annees[datees[0]]}`))
  assert.match(texte(html), /Encore 4 événements/)
  assert.match(await rendre(PoserLaFrise, { frise: v.question!.frise, busy: false, onValider: rien }), /aria-disabled="true"[^>]*>Encore 4 événements/)
  // Un ordre qui n'en est pas un : refusé, rien ne compte.
  const bancal = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q.index, choix: [0, 0, 1, 2] })
  assert.equal(bancal.status, 400)
  assert.equal(bancal.corps.error, 'Pose les quatre événements sur la frise, puis valide')
  // Rangée : deux crans, la frise dans l'ordre du temps et ses années.
  const juste = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q.index, choix: bonOrdre(gardee.frise!.montre) })
  assert.equal(juste.status, 200, juste.corps.error)
  assert.equal(juste.corps.juste, true)
  assert.equal(juste.corps.coup.brises, CRANS_D_UNE_QUESTION_DURE)
  assert.deepEqual(juste.corps.frise, { evenements: gardee.reponses, annees: gardee.frise!.annees })
  const revele = texte(await rendre(Escale, { vue: juste.corps.expedition, avant: v, question: v.question, reponse: juste.corps, choix: 0, busy: false, erreur: '', onRepondre: rien, onJouer: rien, onSuite: rien, onPartir: rien, onSignaler: rien }))
  assert.ok(revele.indexOf(String(gardee.frise!.annees[0])) < revele.indexOf(String(gardee.frise!.annees[3])), 'rangée, la plus ancienne d’abord')
  assert.doesNotMatch(revele, /Signaler une erreur/, 'une frise ne se signale pas')
  // La suivante — une autre frise, l'adversaire tombé, sa carte laissée : ratée, l'ordre qu'il a donné, gardé.
  v = juste.corps.expedition
  if (v.offre) v = (await geste(c, v, { quoi: 'prendre', jokers: [] })).corps.expedition
  v = (await geste(c, v, { quoi: 'avancer', vers: v.permises[0] })).corps.expedition
  const q2 = v.question!
  const g2 = questionsDe(v.id)[q2.index]
  assert.ok(g2.id.startsWith(PREFIXE_DE_LA_FRISE) && g2.id !== gardee.id, `${g2.id} après ${gardee.id}`)
  assert.ok(!g2.id.slice(PREFIXE_DE_LA_FRISE.length).split('+').some(e => gardee.id.includes(e)), 'jamais vus dans une frise d’abord')
  const faux = [3, 2, 1, 0].map(k => g2.frise!.montre.indexOf(k))
  const rate = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q2.index, choix: faux })
  assert.equal(rate.status, 200, rate.corps.error)
  assert.equal(rate.corps.juste, false)
  const ligne = base(db => db.prepare('SELECT reserve_id, choix, forme, composee FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(v.id, q2.index)) as Record<string, unknown>
  assert.deepEqual(ligne, { reserve_id: g2.id, choix: -1, forme: 'frise', composee: '3210' })
  // Ni le carnet, ni le signalement : quatre questions de la base, aucune n'est celle qu'il a jouée.
  const carnet = (await lire(c, '/api/campagne/carnet')).corps
  assert.deepEqual([carnet.aRevoir, carnet.demain, carnet.plusTard], [0, 0, 0])
  const signale = await poster(c, `/api/campagne/serie/${v.id}/signalement`, { index: q2.index, texte: 'Une date fausse' })
  assert.equal(signale.status, 400)
  assert.equal(signale.corps.error, 'Une frise ne se signale pas : seules les questions de la campagne le peuvent')
  // « Mes réponses » : la frise rangée, et où il avait mis chacun.
  assert.equal((await poster(c, `/api/expedition/${v.id}/abandon`)).status, 200)
  const correction = (await lire(c, `/api/campagne/serie/${v.id}/correction`)).corps
  assert.deepEqual(correction[q2.index].reponses, g2.reponses)
  assert.deepEqual(correction[q2.index].frise, { annees: g2.frise!.annees, sienne: [3, 2, 1, 0] })
  assert.deepEqual(correction[q.index].frise, { annees: gardee.frise!.annees })
  const { SerieCorrigee } = (await import(new URL('../../client/src/components/SerieCorrigee.tsx', import.meta.url).href)) as { SerieCorrigee: Composant }
  // Une question par corrigé : la frise rangée a ses propres lignes.
  const mesReponses = (await rendre(SerieCorrigee, { correction })).split('<li class="corrige ').slice(1)
  assert.match(mesReponses[q2.index], /class="frise-rangee"/)
  assert.match(texte(mesReponses[q2.index]), /tu l’avais en 4ᵉ/, 'le plus ancien, mis en dernier')
  assert.doesNotMatch(mesReponses[q2.index], /corrige-bonne/, 'pas de bonne réponse à encadrer')
})

test('Échange sur une frise : une autre frise, d’autres événements — l’escale garde sa forme', async () => {
  // Échange est du paquet de départ de la question au centre : la frise ne le refuse pas, et la question neuve se tire à sa forme.
  const c = await inscrireProfil(banc.url, 'chroniqueuse', 'Chroniqueuse')
  let v = await partirALaFrise(c, 'echange')
  v = (await geste(c, v, { quoi: 'avancer', vers: v.carte!.depart[0] })).corps.expedition
  const q = v.question!
  const premiere = questionsDe(v.id)[q.index]
  assert.equal(v.rencontre!.refus.echange, null)
  const apres = await geste(c, v, { quoi: 'jouer', joker: 'echange', position: q.index })
  assert.equal(apres.status, 200, apres.corps.error)
  v = apres.corps.expedition
  const q2 = v.question!
  assert.notEqual(q2.index, q.index)
  assert.equal(q2.forme, 'frise')
  assert.equal(q2.frise!.evenements.length, 4)
  const autre = questionsDe(v.id)[q2.index]
  assert.ok(autre.id.startsWith(PREFIXE_DE_LA_FRISE), autre.id)
  const ceux = (id: string) => id.slice(PREFIXE_DE_LA_FRISE.length).split('+')
  assert.ok(!ceux(autre.id).some(e => ceux(premiere.id).includes(e)), 'ceux de la frise échangée sont déjà vus : jamais d’abord')
  const juste = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q2.index, choix: bonOrdre(autre.frise!.montre) })
  assert.equal(juste.status, 200, juste.corps.error)
  assert.equal(juste.corps.juste, true)
})

test('à l’écran : les règles de la version 13 disent la frise ; celles de la version 12 n’en disent rien', async () => {
  const { FeuilleDesRegles } = (await pieces()) as unknown as { FeuilleDesRegles: Composant }
  const regles = async (v: number) => texte(await rendre(FeuilleDesRegles, { rencontres: true, v, codex: codexDuNiveau(1, [], [], v), ascension: 0, onFermer: rien }))
  assert.match(await regles(V), /Une frise : quatre événements à remettre dans l’ordre, du plus ancien au plus récent — juste en entier\. Les cartes qui effacent en datent, deux au plus\./)
  assert.match(await regles(V), /sur une frise, ou quand/)
  assert.doesNotMatch(await regles(VERSION_DES_CURIOSITES), /frise/i)
})
