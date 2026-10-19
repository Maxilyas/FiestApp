// L'amélioration des cartes de l'Expédition (le jeu complet). Le propriétaire,
// le 19 octobre 2026 : « Est-ce que l'on pourrait pas aussi avoir un système
// d'amélioration des cartes ? » — la forge de Slay the Spire : au campement, à
// l'échoppe, et dans les offres des actes 2 et 3, une carte de son paquet
// devient sa version « + ». Chaque améliorée, levée, annonce ce que le serveur
// fait, et fait plus que sa carte ; aucune règle ne cherche une carte qui
// s'améliore sous sa seule clé. Par les routes — le campement, l'échoppe,
// Double chance+ — : `expedition-rencontres-routes.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { NIVEAU_MAX, codexDuNiveau, offreDuCodex } from '../../shared/codex'
import {
  BOUCLIER_DE_LA_CUIRASSE_PLUS,
  CARTES_DES_RENCONTRES,
  CHANCE_D_UNE_OFFRE_AMELIOREE,
  COURAGE_DE_LA_PANACEE,
  COURAGE_DE_LA_PANACEE_PLUS,
  COURAGE_DU_SECOND_SOUFFLE,
  COURAGE_DU_SECOND_SOUFFLE_PLUS,
  COURAGE_MAX,
  ECUS_AU_DEPART,
  VERSION_DES_HUIT_FAMILLES,
  VERSION_DU_CODEX,
  VERSION_DU_JEU_COMPLET,
  ameliorer,
  amelioreeParmi,
  apercuDuTour,
  baseDe,
  carteDeRencontre,
  carteDuLegendaire,
  changeDeQuestion,
  chiffresApresLaCarte,
  courageDeLaCarte,
  douteDUneErreur,
  effaceesDuTour,
  enJeu,
  enPlusDesPouvoirs,
  estAmelioree,
  formeDeLaCarte,
  multiplicateurDeLaForme,
  pariPerdu,
  parmi,
  raretesDeLOffre,
  refusDeLAmelioration,
  refusDeLaCarte,
  riposte,
  siJuste,
  suiteDUneBonneReponse,
  viseLaQuestion,
  type CarteDeRencontre,
  type ChiffresDuTour,
  type ContexteDUneCarte,
} from '../../shared/rencontres'
import { GARDIEN, PRIX_DE_L_ECHOPPE, prixDeLArticle, refusDeLAchat, type CarteDUnActe, type DepartDExpedition, type EtatDeLExpedition } from '../../shared/expedition'
import { Journal, avecEnMainAmelioree, carte, depart, pieces, rendre, rien, texte } from './expedition-journal'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

/** Les cartes qui s'améliorent, et leur exemplaire amélioré. */
const AMELIORABLES: readonly CarteDeRencontre[] = CARTES_DES_RENCONTRES.filter(c => c.amelioration)
const plusDe = (c: CarteDeRencontre) => carteDeRencontre(ameliorer(c.cle))!

// ── Le catalogue ────────────────────────────────────────────────────────────

test('soixante-dix-sept cartes s’améliorent — ni les maudites, ni la carte de route, ni celles des légendaires — ; l’améliorée a son « + », son gain, et change ce qu’on voit', () => {
  // Soixante et une au jeu complet, seize de plus avec les huit familles (la version 9).
  assert.equal(AMELIORABLES.length, 77)
  for (const c of CARTES_DES_RENCONTRES) {
    const devrait = c.rarete !== 'maudit' && c.rarete !== 'legendaire' && c.moment !== 'route'
    assert.equal(!!c.amelioration, devrait, c.cle)
    if (!devrait) assert.equal(carteDeRencontre(ameliorer(c.cle)), undefined, `${c.cle} n’a pas d’exemplaire « + »`)
  }
  for (const c of AMELIORABLES) {
    const p = plusDe(c)
    assert.deepEqual([p.cle, p.nom, p.amelioree, baseDe(p.cle), estAmelioree(p.cle), estAmelioree(c.cle)], [`${c.cle}+`, `${c.nom}+`, true, c.cle, true, false])
    assert.ok((p.depuis ?? 0) >= VERSION_DU_JEU_COMPLET, `${c.cle}+ : venue avec le jeu complet`)
    // Ce qu'elle reste : sa famille, sa rareté, son moment, son indice.
    assert.deepEqual([p.famille, p.rarete, p.moment, !!p.indice, !!p.unique], [c.famille, c.rarete, c.moment, !!c.indice, !!c.unique], c.cle)
    // Ce qui change se voit : son coût, son texte, ou elle ne quitte plus la rencontre.
    const durable = !!c.epuisement && !p.epuisement
    assert.ok(p.cout < c.cout || p.effet !== c.effet || durable, `${c.cle}+ ne change rien qu’on voie`)
    assert.ok(p.cout <= c.cout, `${c.cle}+ ne coûte pas plus`)
    const gain = c.amelioration!.gain
    if (p.cout < c.cout) assert.equal(gain, p.cout === 0 ? 'Gratuite' : `${p.cout} d’énergie au lieu de ${c.cout}`, c.cle)
    if (durable) assert.equal(gain, 'Plus seulement une fois par rencontre', c.cle)
    // Son chiffre se lit dans son texte, quand celui de sa carte s'y lisait en chiffres (Pioche les dit en lettres).
    const enChiffres = (x: CarteDeRencontre) => !!x.valeur && /^\+?\d+$/.test(x.valeur) && new RegExp(`\\b${x.valeur.replace('+', '')}\\b`).test(x.effet)
    if (enChiffres(c) && p.valeur !== c.valeur) assert.ok(enChiffres(p), `${c.cle}+ : « ${p.valeur} » dans « ${p.effet} »`)
  }
  assert.equal(carteDeRencontre('concentration++'), undefined, 'une seule amélioration')
})

// ── Ce qu'elle fait de plus ─────────────────────────────────────────────────

const AVANT: ChiffresDuTour = { inspiration: 3, charge: 0, garde: 0, serie: 2 }

/**
 * Ce qu'une carte jouée vaut, chiffre par chiffre, aux règles du pli — dans plusieurs cas : fétiche ou non, une marche, une réponse
 * effacée, le courage entamé ; le doute qu'elle sème, celui qu'elle sème posée à chaque erreur, le courage qu'elle coûte (en
 * moins : moins cher, c'est mieux).
 */
function valeurs(cle: string): number[] {
  const out: number[] = []
  for (const contexte of [{}, { fetiche: true }, { niveau: 'moyen' as const }, { effacees: 1 }, { courage: 15 }]) {
    const x = chiffresApresLaCarte(cle, { ...AVANT, doute: 2 }, [], { v: VERSION_DES_HUIT_FAMILLES, savoir: 8, ecus: 60, ...contexte })
    out.push(x.inspiration, x.charge, x.garde, x.serie, x.doute ?? 0)
  }
  // Posée, ce qu'elle fait aux autres cartes : un indice, une question changée.
  out.push(chiffresApresLaCarte('coup-d-oeil', AVANT, [cle], { v: VERSION_DU_JEU_COMPLET }).charge, chiffresApresLaCarte('coup-d-oeil', AVANT, [cle], { v: VERSION_DU_JEU_COMPLET }).garde)
  out.push(chiffresApresLaCarte('echange', AVANT, [cle], { v: VERSION_DU_JEU_COMPLET }).garde)
  const juste = siJuste([cle], [cle])
  const suite = suiteDUneBonneReponse([cle], [cle])
  out.push(juste.ecus, juste.courage, suite.cartes, suite.inspiration, suite.charge, douteDUneErreur([cle]), -courageDeLaCarte(cle))
  for (const forme of ['quatre', 'six'] as const) out.push(enPlusDesPouvoirs({ v: VERSION_DU_JEU_COMPLET, pouvoirs: [cle], fetiche: 'Histoire', categorie: 'Histoire', trouvees: 2, serie: 1, forme }))
  return out
}

/** Les améliorations qui ne se chiffrent pas, que le pli fait — chacune vérifiée plus bas : une carte tirée de plus, du courage, la rencontre gardée. */
const DANS_LE_PLI = new Set(['pioche', 'sprint', 'meditation', 'assurance', 'doubler-la-mise', 'panacee', 'second-souffle', 'echange', 'augure', 'rumeur'])

test('chaque carte améliorée fait plus que sa carte : jamais moins nulle part, mieux quelque part — un chiffre, son coût, ou ce que le pli fait', () => {
  for (const c of AMELIORABLES) {
    const base = valeurs(c.cle)
    const plus = valeurs(ameliorer(c.cle))
    for (let k = 0; k < base.length; k++) assert.ok(plus[k] >= base[k], `${c.cle}+ fait moins que ${c.cle} (chiffre ${k} : ${plus[k]} < ${base[k]})`)
    const mieux = plus.some((x, k) => x > base[k]) || DANS_LE_PLI.has(c.cle)
    assert.ok(mieux, `${c.cle}+ ne fait rien de plus`)
  }
})

test('ce que la règle lit d’une carte améliorée jouée ou posée : la même chose que de sa carte, à ses chiffres', () => {
  assert.equal(enJeu({ mise: 10, jouees: ['doubler-la-mise+'] }), 20, 'Doubler la mise+ double le pari')
  assert.equal(pariPerdu({ mise: 10, jouees: ['assurance+'] }), 0, 'Assurance+ rend le pari')
  assert.deepEqual([riposte(6, ['contre-attaque+'], []), riposte(6, [], ['represailles+'])], [6, 3])
  assert.equal(multiplicateurDeLaForme({ reponses: 2 }, { pouvoirs: ['metamorphose+'], surLaQuestion: [] }), 1)
  assert.equal(multiplicateurDeLaForme({ reponses: 2 }, { pouvoirs: [], surLaQuestion: ['miroir+'] }), 1)
  assert.equal(multiplicateurDeLaForme({ reponses: 6, forme: 'six' }, { pouvoirs: [], surLaQuestion: ['polymorphe+'] }), 2)
  const q = { reponses: 4, datee: true }
  assert.deepEqual(
    [effaceesDuTour(['coup-d-oeil+'], [], q), effaceesDuTour(['voyance+'], [], q), effaceesDuTour(['revelation+'], [], q), effaceesDuTour([], ['vision+'], q), effaceesDuTour(['augure+'], [], q)],
    [1, 2, 2, 1, 1],
  )
  assert.ok(viseLaQuestion(carteDeRencontre('augure+')!) && viseLaQuestion(carteDeRencontre('miroir+')!))
  assert.deepEqual([changeDeQuestion('echange+'), changeDeQuestion('volte-face+'), formeDeLaCarte('corser+'), formeDeLaCarte('simplifier+')], [true, true, 'six', 'vrai-faux'])
  assert.ok(parmi(['sursis+'], 'sursis') && !amelioreeParmi(['sursis'], 'sursis'))
  const apercu = apercuDuTour({
    v: VERSION_DU_JEU_COMPLET,
    tour: { charge: 0, garde: 0, mise: 0, jouees: ['sursis+'] },
    pouvoirs: [],
    sceaux: 12,
    frappe: 5,
    savoir: 6,
    question: { reponses: 4, forme: 'quatre', categorie: 'Histoire' },
  })
  assert.equal(apercu.faux.perdu, 0, 'Sursis+ sauve de l’attaque')
})

/** Le contexte d'une carte, en préparation, au courage plein : chaque carte du catalogue en main, et chaque exemplaire amélioré. */
const contexte = (plus: Partial<ContexteDUneCarte> = {}): ContexteDUneCarte => ({
  v: VERSION_DU_JEU_COMPLET,
  tour: { phase: 'preparation', inspiration: 3, jouees: [], surLaQuestion: [] },
  main: [...CARTES_DES_RENCONTRES.map(c => c.cle), ...AMELIORABLES.map(c => ameliorer(c.cle))],
  pouvoirs: [],
  question: { reponses: 4, tiree: 'quatre', forme: 'quatre', six: true, nombre: false, datee: true, categorie: 'Histoire' },
  fetiche: 'Histoire',
  courage: COURAGE_MAX,
  derniereFrappe: 0,
  defausse: 0,
  ...plus,
})

test('une carte améliorée se refuse pour les mêmes raisons que sa carte — deux Cuirasse, dont une améliorée, n’en font pas deux posées', () => {
  assert.equal(refusDeLaCarte(contexte({ pouvoirs: ['cuirasse'] }), 'cuirasse+'), 'Elle agit déjà dans cette rencontre')
  assert.equal(refusDeLaCarte(contexte({ pouvoirs: ['cuirasse+'] }), 'cuirasse'), 'Elle agit déjà dans cette rencontre')
  const question = (jouees: string[], surLaQuestion: string[] = jouees) => ({ tour: { phase: 'question' as const, inspiration: 3, jouees, surLaQuestion } })
  assert.equal(refusDeLaCarte(contexte(question(['double-chance'])), 'double-chance+'), 'Déjà jouée sur cette question')
  assert.equal(refusDeLaCarte(contexte({ tour: { phase: 'preparation', inspiration: 3, jouees: ['sursis'], surLaQuestion: [] } }), 'sursis+'), 'Déjà jouée à cette question')
  assert.equal(refusDeLaCarte(contexte({ tour: { phase: 'preparation', inspiration: 3, jouees: ['corser+'], surLaQuestion: ['corser+'] } }), 'miroir'), 'La question a déjà changé de forme')
  const vraiFaux = { question: { reponses: 2, tiree: 'vrai-faux' as const, forme: 'vrai-faux' as const, six: false, nombre: false, datee: true, categorie: 'Histoire' } }
  assert.equal(refusDeLaCarte(contexte({ ...vraiFaux, ...question([]) }), 'coup-d-oeil+'), 'Pas sur un vrai ou faux : elle répondrait à ta place')
  assert.equal(refusDeLaCarte(contexte({ tour: { phase: 'preparation', inspiration: 1, jouees: [], surLaQuestion: [] } }), 'muraille+'), 'Il lui faut 2 d’énergie : il t’en reste 1')
  assert.equal(refusDeLaCarte(contexte({ tour: { phase: 'preparation', inspiration: 1, jouees: [], surLaQuestion: [] } }), 'bastion+'), null, 'Bastion+ : une d’énergie')
  // Une expédition d'avant le jeu complet n'en a jamais tiré.
  assert.equal(refusDeLaCarte(contexte({ v: VERSION_DU_CODEX }), 'concentration+'), 'Cette carte ne se lit pas : recharge la page')
})

// ── Chaque carte améliorée, levée puis jouée ────────────────────────────────

/**
 * Ce qu'il faut à une carte pour se jouer dans la main de l'élite : Arrêt sur image, un dévoilement ; Zizanie, un doute à doubler
 * — Rumeur, que le Sophiste a de départ, jouée d'abord.
 */
const POUR_SE_JOUER: Record<string, (j: Journal) => void> = {
  'arret-sur-image': j => {
    j.poser({ forme: 'devoilement', mots: 12, tiree: 'devoilement' })
  },
  zizanie: j => {
    j.jouer('rumeur')
  },
}

/** Le départ et la main qu'il lui faut : Zizanie, la Rumeur dans la même main. */
const MAIN_POUR_SE_JOUER: Record<string, { autre: Partial<DepartDExpedition>; main: (j: Journal) => boolean }> = {
  zizanie: { autre: { style: 'sophiste' }, main: j => !!j.etat().rencontre?.main.includes('rumeur') },
}

test(`chaque carte améliorée, levée, annonce ce que le serveur fait : ${AMELIORABLES.length} cartes`, async () => {
  const { apercuALaMise, changementDeLaCarte } = await pieces()
  for (const c of AMELIORABLES) {
    const p = ameliorer(c.cle)
    const besoin = MAIN_POUR_SE_JOUER[c.cle]
    const j = avecEnMainAmelioree(c.cle, besoin?.main, 1, besoin?.autre)
    POUR_SE_JOUER[c.cle]?.(j)
    // Une carte de pendant la question se joue la question vue, son pari dit.
    if (c.moment === 'reflexe') j.voir(10)
    const avant = j.vue()
    assert.equal(avant.refus[p], null, `${p} se joue ici`)
    const promis = changementDeLaCarte(avant, 10, 'Histoire', p)
    assert.ok(promis, `${p} promet quelque chose`)
    assert.deepEqual(promis.avant, apercuALaMise(avant, 10, 'Histoire'))
    const position = j.etat().enAttente
    const e = j.jouer(p)
    assert.ok(e.rencontre!.tour.jouees.includes(p), `${p} jouée`)
    if (changeDeQuestion(p)) assert.notEqual(e.enAttente, position, `${p} : une autre question`)
    assert.deepEqual(promis.apres, apercuALaMise(j.vue(), 10, 'Histoire'), `${p} : la carte levée annonçait ce que le serveur a fait`)
  }
})

// ── Dans le pli ─────────────────────────────────────────────────────────────

/** Combien de cartes de plus dans la main, la carte jouée ôtée. */
const tirees = (avant: EtatDeLExpedition, apres: EtatDeLExpedition) => apres.rencontre!.main.length - (avant.rencontre!.main.length - 1)

test('ce que le pli fait de plus : une carte tirée de plus, la rencontre gardée, un bouclier ou une énergie de plus à chaque question', () => {
  // Les cartes qui tirent : améliorées, une de plus — Doubler la mise+ en tire une, où sa carte n'en tirait pas.
  for (const [cle, combien] of [
    ['pioche', 3],
    ['sprint', 3],
    ['meditation', 2],
    ['assurance', 2],
    ['doubler-la-mise', 1],
  ] as const) {
    const j = avecEnMainAmelioree(cle, k => k.etat().rencontre!.pioche.length >= 3)
    const avant = j.etat()
    assert.equal(tirees(avant, j.jouer(ameliorer(cle))), combien, `${cle}+ tire ${combien} cartes`)
  }
  // Échange+, Augure+ et Rumeur+ ne quittent plus la rencontre : jouées, elles vont à la défausse.
  for (const cle of ['echange', 'augure', 'rumeur']) {
    const j = avecEnMainAmelioree(cle)
    if (carteDeRencontre(cle)!.moment === 'reflexe') j.voir()
    const r = j.jouer(ameliorer(cle)).rencontre!
    assert.ok(r.defausse.includes(ameliorer(cle)) && !r.epuisees.includes(ameliorer(cle)), `${cle}+ à la défausse, pas aux épuisées`)
  }
  // Cuirasse+ : bouclier 5 à cette question, puis à chaque question.
  const cuirasse = avecEnMainAmelioree('cuirasse')
  assert.equal(cuirasse.jouer('cuirasse+').rencontre!.tour.garde, BOUCLIER_DE_LA_CUIRASSE_PLUS)
  const suivante = cuirasse.repondre(true)
  if (suivante.rencontre) assert.equal(suivante.rencontre.tour.garde, BOUCLIER_DE_LA_CUIRASSE_PLUS, 'et à la question suivante')
  // Maîtrise+ : posée pour une d'énergie, elle en rend une — à l'acte 1, il lui en reste deux.
  assert.equal(avecEnMainAmelioree('maitrise').jouer('maitrise+').rencontre!.tour.inspiration, 2)
  // Sursis+ : une erreur ne coûte rien.
  const sursis = avecEnMainAmelioree('sursis')
  const courage = sursis.etat().courage
  sursis.jouer('sursis+')
  assert.equal(sursis.repondre(false).courage, courage, 'Sursis+ : rien de perdu')
})

test('ce que reprennent Panacée+ et Second souffle+ : plus de courage — et Panacée+ quitte son paquet, cet exemplaire-là', () => {
  for (const [cle, plus, sans] of [
    ['panacee', COURAGE_DE_LA_PANACEE_PLUS, COURAGE_DE_LA_PANACEE],
    ['second-souffle', COURAGE_DU_SECOND_SOUFFLE_PLUS, COURAGE_DU_SECOND_SOUFFLE],
  ] as const) {
    // Trois erreurs en bas : de quoi voir la différence sous le plafond.
    const j = avecEnMainAmelioree(cle, () => true, 3)
    const avant = j.etat().courage!
    assert.ok(Math.min(COURAGE_MAX, avant + plus) > Math.min(COURAGE_MAX, avant + sans), `${avant} de courage : la différence se voit`)
    const apres = j.jouer(ameliorer(cle))
    assert.equal(apres.courage, Math.min(COURAGE_MAX, avant + plus), `${cle}+ rend ${plus}`)
    assert.ok(plus > sans)
    if (cle === 'panacee') assert.ok(!apres.paquet.includes('panacee+'), 'une fois par expédition : l’exemplaire joué quitte son paquet')
  }
})

// ── Où elle s'améliore ──────────────────────────────────────────────────────

/** Un plan dont l'escale du bas est un campement, puis une échoppe, puis une question. */
function carteDuCampement(): CarteDUnActe {
  const c = carte()
  return {
    ...c,
    escales: c.escales.map(e =>
      e.id === 'e00' ? { id: 'e00', etage: 0, colonne: 0, sorte: 'campement' as const, suite: ['e10'] } : e.id === 'e10' ? { id: 'e10', etage: 1, colonne: 0, sorte: 'echoppe' as const, suite: ['e20'] } : e,
    ),
  }
}

test('au campement : une carte de son paquet améliorée, cet exemplaire seul ; ce qui ne s’améliore pas ne se fait pas', () => {
  const plans = { cartes: [carteDuCampement(), carte(), carte()] }
  const j = new Journal(depart('forge', [], plans))
  let e = j.avancer('e00')
  assert.ok(e.campement)
  // Ce qui ne s'améliore pas : le pli l'ignore, le campement attend.
  for (const cle of ['surmenage', 'detour', 'concentration+', 'echange+']) assert.ok(j.copie().geste({ quoi: 'camper', ameliorer: cle }).campement, cle)
  assert.ok(j.copie().geste({ quoi: 'camper', ameliorer: 'concentration', retirer: 'prudence' }).campement, 'un choix à la fois')
  e = j.geste({ quoi: 'camper', ameliorer: 'concentration' })
  assert.equal(e.campement, false)
  assert.deepEqual([e.paquet.filter(c => c === 'concentration').length, e.paquet.filter(c => c === 'concentration+').length], [3, 1])
  assert.equal(e.courage, COURAGE_MAX, 'pas de repos : il a amélioré')
  // Une expédition d'avant le jeu complet n'améliore rien.
  const avant = new Journal(depart('forge', [], { ...plans, v: VERSION_DU_CODEX }))
  avant.avancer('e00')
  assert.ok(avant.geste({ quoi: 'camper', ameliorer: 'concentration' }).campement)
  // La règle, et ses mots — la carte d'un légendaire comprise.
  const phenix = carteDuLegendaire('lg:phenix')!.cle
  const paquet = ['concentration', 'concentration+', 'surmenage', phenix, 'detour']
  assert.deepEqual(
    ['echange', 'concentration+', 'surmenage', phenix, 'detour', 'concentration'].map(c => refusDeLAmelioration(paquet, c)),
    ['Cette carte n’est pas dans ton paquet', 'Elle est déjà améliorée', 'Une carte maudite ne s’améliore pas', 'La carte d’un légendaire ne s’améliore pas', 'Une carte de route ne s’améliore pas', null],
  )
})

test(`à l’échoppe : une carte améliorée, ${PRIX_DE_L_ECHOPPE.ameliorer} écus, une fois — aux règles du campement ; une échoppe d’avant le jeu complet n’en améliore aucune`, () => {
  assert.equal(prixDeLArticle('ameliorer', 'prudence'), PRIX_DE_L_ECHOPPE.ameliorer)
  assert.ok(PRIX_DE_L_ECHOPPE.ameliorer <= ECUS_AU_DEPART, 'de quoi en payer une dès le départ')
  const plans = { cartes: [carteDuCampement(), carte(), carte()] }
  const j = new Journal(depart('etal', [], plans))
  j.avancer('e00')
  j.geste({ quoi: 'camper' })
  let e = j.avancer('e10')
  assert.equal(e.echoppe?.ameliorer, true)
  assert.equal(refusDeLAchat(e, { article: 'ameliorer', joker: 'surmenage' }), 'Cette carte n’est pas dans ton paquet')
  assert.equal(refusDeLAchat(e, { article: 'ameliorer', joker: 'prudence' }), null)
  const ecus = e.ecus
  e = j.geste({ quoi: 'acheter', article: 'ameliorer', joker: 'prudence', prix: PRIX_DE_L_ECHOPPE.ameliorer })
  assert.ok(e.paquet.includes('prudence+'))
  assert.equal(e.ecus, ecus - PRIX_DE_L_ECHOPPE.ameliorer)
  assert.equal(refusDeLAchat({ ...e, ecus: 100 }, { article: 'ameliorer', joker: 'concentration' }), 'Une carte améliorée par échoppe')
  // Avant le jeu complet, l'échoppe ne le propose pas.
  const avant = new Journal(depart('etal', [], { ...plans, v: VERSION_DU_CODEX }))
  avant.avancer('e00')
  avant.geste({ quoi: 'camper' })
  const vieille = avant.avancer('e10')
  assert.equal(vieille.echoppe?.ameliorer, undefined)
  assert.equal(refusDeLAchat(vieille, { article: 'ameliorer', joker: 'prudence' }), 'On n’améliore pas de carte ici')
})

test(`dans les offres : aucune améliorée à l’acte 1, ${CHANCE_D_UNE_OFFRE_AMELIOREE[1] * 100} % à l’acte 2, ${CHANCE_D_UNE_OFFRE_AMELIOREE[2] * 100} % à l’acte 3 — sur leur propre fil : les cartes offertes restent celles que l’offre tirait`, () => {
  const toutes = codexDuNiveau(NIVEAU_MAX, []).cartes
  const quelle: Record<string, 'rencontre' | 'elite'> = { e00: 'rencontre', e10: 'elite', e20: 'elite', e30: 'rencontre' }
  const par: { offertes: number; ameliorees: number }[] = [0, 1, 2].map(() => ({ offertes: 0, ameliorees: 0 }))
  for (let n = 0; n < 60; n++) {
    const j = new Journal(depart(`offres:${n}`, toutes))
    for (let acte = 0; acte < 3; acte++) {
      for (const vers of ['e00', 'e10', 'e20', 'e30']) {
        j.avancer(vers)
        const e = j.gagner()
        if (!e.offre || e.offre.jokers.length === 0) continue
        // Ce que l'offre tirait, sans améliorer : les mêmes cartes, à la même place.
        const attendue = offreDuCodex(j.depart.graine, e.offres - 1, toutes, e.paquet, raretesDeLOffre(VERSION_DU_JEU_COMPLET, e.acte, quelle[vers]))
        assert.deepEqual(e.offre.jokers.map(baseDe), attendue, `offre ${e.offres - 1}`)
        for (const cle of e.offre.jokers) {
          if (!carteDeRencontre(baseDe(cle))?.amelioration) continue
          par[acte].offertes++
          if (estAmelioree(cle)) par[acte].ameliorees++
        }
        j.prendre([])
      }
      j.avancer('cg')
      j.geste({ quoi: 'camper' })
      j.avancer(GARDIEN)
      j.gagner()
      j.prendreSiOfferte()
    }
  }
  assert.equal(par[0].ameliorees, 0, 'l’acte 1 n’en propose aucune')
  for (const acte of [1, 2]) {
    const part = par[acte].ameliorees / par[acte].offertes
    assert.ok(Math.abs(part - CHANCE_D_UNE_OFFRE_AMELIOREE[acte]) < 0.1, `acte ${acte + 1} : ${Math.round(part * 100)} % améliorées, sur ${par[acte].offertes}`)
  }
  // Prise, elle entre améliorée dans son paquet.
  const j = new Journal(depart('prise', toutes))
  j.acte()
  j.prendreSiOfferte()
  let prise: string | undefined
  for (const vers of ['e00', 'e10', 'e20', 'e30']) {
    j.avancer(vers)
    const e = j.gagner()
    const plus = e.offre?.jokers.find(estAmelioree)
    if (plus && !prise) {
      prise = plus
      assert.ok(j.prendre([plus]).paquet.includes(plus))
    } else j.prendre([])
  }
  assert.ok(prise, 'une carte améliorée offerte à l’acte 2')
})

// ── La garde ────────────────────────────────────────────────────────────────

test('aucune règle ne cherche une carte qui s’améliore sous sa seule clé : elle passerait à côté de son exemplaire « + »', () => {
  const cles = new Set(AMELIORABLES.map(c => c.cle))
  const fichiers = [
    'shared/rencontres.ts',
    'shared/expedition.ts',
    'shared/codex.ts',
    'server/src/core/campagne.ts',
    'server/src/expedition.ts',
    'server/scripts/calibrage-rencontres.ts',
    'client/src/views/ExpeditionApp.tsx',
    'client/src/views/RencontresDExpedition.tsx',
  ]
  for (const f of fichiers) {
    const source = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')
    for (const m of source.matchAll(/([\w.?!]+)\.includes\('([a-z-]+)'\)/g)) {
      assert.ok(!cles.has(m[2]), `${f} : « ${m[0]} » — un exemplaire amélioré n’y serait pas vu ; parmi(…, '${m[2]}') le voit`)
    }
  }
})

// ── À l'écran ───────────────────────────────────────────────────────────────

test('à l’écran : la carte améliorée porte son « + » vert et son nom « + », la même peinture que sa carte ; levée, ce qu’elle a gagné', async () => {
  const { CarteDessinee, CarteLevee, comptesDesCartes } = await pieces()
  const base = await rendre(CarteDessinee, { c: carteDeRencontre('concentration'), taille: 'main' })
  const plus = await rendre(CarteDessinee, { c: carteDeRencontre('concentration+'), taille: 'main' })
  assert.match(plus, /class="exp-vc exp-vc-main exp-vc-amelioree"/)
  assert.match(plus, /<b class="exp-vc-ameliore">\+<\/b>/)
  assert.doesNotMatch(base, /exp-vc-ameliore/)
  const peinture = (html: string) => /<img class="exp-vc-peinture" src="([^"]+)"/.exec(html)?.[1]
  assert.ok(peinture(base) && peinture(base) === peinture(plus), 'la peinture de sa carte')
  assert.match(plus, />\+6</, 'son chiffre amélioré')
  const levee = texte(await rendre(CarteLevee, { cle: 'concentration+', onReposer: rien }))
  assert.match(levee, /Concentration\+/)
  assert.match(levee, /améliorée : \+6 au lieu de \+4/)
  // Au codex, une carte dit ce que l'amélioration lui donnerait ; une maudite, rien.
  assert.match(texte(await rendre(CarteLevee, { cle: 'prudence', avecAmelioration: true, onReposer: rien })), /Améliorée : bouclier 8 au lieu de 5/)
  assert.doesNotMatch(texte(await rendre(CarteLevee, { cle: 'surmenage', avecAmelioration: true, onReposer: rien })), /Améliorée/)
  // Dans un tas, l'exemplaire amélioré suit sa carte.
  assert.deepEqual(
    comptesDesCartes(['prudence+', 'concentration', 'prudence', 'echange']).map(x => x.cle),
    ['concentration', 'prudence', 'prudence+', 'echange'],
  )
})

test('avant de choisir : la carte et son amélioration côte à côte, ce que fait chacune et ce qu’elle y gagne ; les règles du jeu complet le disent, celles d’avant non', async () => {
  const { AvantApres, FeuilleDesRegles } = await pieces()
  const html = await rendre(AvantApres, { cle: 'prudence' })
  assert.deepEqual([...html.matchAll(/class="exp-vc exp-vc-rangee[^"]*"/g)].length, 2)
  assert.match(html, /exp-vc-amelioree/)
  // Chacune sa phrase entière, son coût et son moment : « 5 › 8 » et « Bouclier 8 au lieu de 5 » seuls ne disaient ni ce que fait
  // la carte, ni ce que fera son amélioration (un retour du 19 octobre 2026).
  const dit = texte(html)
  assert.match(dit, /Prudence : Bouclier 5 : si tu te trompes, il pare 5 de l’attaque\. 1 d’énergie · avant la question/)
  assert.match(dit, /Prudence\+ : Bouclier 8 : si tu te trompes, il pare 8 de l’attaque\. 1 d’énergie · avant la question/)
  assert.match(dit, /Bouclier 8 au lieu de 5/)
  // Moins chère : la même phrase, et ce qu'elle coûte dessous.
  const gratuite = texte(await rendre(AvantApres, { cle: 'coup-d-oeil' }))
  assert.match(gratuite, /Coup d’œil : Efface une mauvaise réponse\. 1 d’énergie · pendant la question/)
  assert.match(gratuite, /Coup d’œil\+ : Efface une mauvaise réponse\. gratuite · pendant la question/)
  // Elle revient : « une fois par rencontre » sous sa carte, plus sous l'améliorée.
  const revient = texte(await rendre(AvantApres, { cle: 'echange' }))
  assert.match(revient, /Échange : Change de question : une autre, posée par le même adversaire\. gratuite · pendant la question · une fois par rencontre/)
  assert.match(revient, /Échange\+ : Change de question : une autre, posée par le même adversaire\. gratuite · pendant la question Plus seulement une fois par rencontre/)
  assert.equal(await rendre(AvantApres, { cle: 'surmenage' }), '', 'une maudite ne s’améliore pas')
  const regles = (v: number) => rendre(FeuilleDesRegles, { rencontres: true, v, onFermer: rien })
  const neuves = texte(await regles(VERSION_DU_JEU_COMPLET))
  assert.match(neuves, /Tes cartes améliorées/)
  assert.match(neuves, new RegExp(`L’échoppe en améliore une, ${PRIX_DE_L_ECHOPPE.ameliorer} écus`))
  assert.match(neuves, /une sur 4 à l’acte 2, une sur 2 à l’acte 3/)
  assert.doesNotMatch(texte(await regles(VERSION_DU_CODEX)), /améliorée/)
})
