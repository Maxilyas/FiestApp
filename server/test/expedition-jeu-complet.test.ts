// Le jeu complet de l'Expédition (`VERSION_DU_JEU_COMPLET`, la version 8 du
// départ). Le propriétaire, le 19 octobre 2026 : « Il n'y a vraiment pas
// beaucoup de rare / épique dans le jeu comme carte, cela donne pas beaucoup
// de diversité. Tu pourrais pas donner un jeu complet ? » — huit cartes par
// famille, des neutres de plus, l'épique dans les offres. Puis, le même jour :
// « on joue toute les cartes à tous les tours car ça coûte pas beaucoup
// d'énergie et du coup y'a aucune réflexion » — deux d'énergie à l'acte 1.
// Chaque carte neuve dans le pli ; levée, elle annonce ce que le serveur fait ;
// une expédition d'avant se rejoue à ses règles d'alors. Par les routes — le
// départ en version 8, l'énergie que la vue dit — :
// `expedition-rencontres-routes.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { ENERGIE_EN_ASCENSION, NIVEAU_MAX, codexDuNiveau, energieDesActesALAscension, energieDuTour, offreDuCodex } from '../../shared/codex'
import {
  BOUCLIER_DE_LA_CUIRASSE,
  BOUCLIER_DE_L_ASTROLABE,
  BOUCLIER_DU_CAMELEON,
  CARTES_DES_ACTES,
  CARTES_DES_RENCONTRES,
  CHANGENT_DE_QUESTION,
  CHANGENT_LA_QUESTION,
  COURAGE_DE_LA_PANACEE,
  COURAGE_DU_PANSEMENT,
  COURAGE_DU_SECOND_SOUFFLE,
  COURAGE_MAX,
  ECUS_DE_LA_CAGNOTTE,
  ECUS_DE_LA_RAFLE,
  ECUS_DU_POURBOIRE,
  ENCYCLOPEDIE_PAR_JUSTE,
  ENERGIE_DES_ACTES,
  FAMILLES_DE_CARTES,
  FRAPPE_DU_SURMENAGE,
  INSPIRATION_PAR_QUESTION,
  MULTIPLICATEUR_DU_SIX_CHOIX,
  MULTIPLICATEUR_DU_VRAI_OU_FAUX,
  PART_DES_REPRESAILLES,
  PRISME_A_SIX_CHOIX,
  PRISME_PAR_JUSTE,
  RARETES_DE_L_ACTE_1_DU_JEU_COMPLET,
  RARETES_DU_JEU_COMPLET,
  SAVOIR_DES_MARCHES,
  VERSION_DU_CODEX,
  VERSION_DU_JEU_COMPLET,
  apercuDuTour,
  carteDeRencontre,
  chiffresApresLaCarte,
  effaceesDuTour,
  energieDesActes,
  frappeDeLaQuestion,
  multiplicateurDeLaForme,
  offreDeCartes,
  raretesDeLOffre,
  refusDeLaCarte,
  riposte,
  type CarteDeRencontre,
  type ContexteDUneCarte,
  type ContexteDesChiffres,
  type FamilleDeCartes,
} from '../../shared/rencontres'
import { PRIX_DE_L_ECHOPPE, prixDeLArticle } from '../../shared/expedition'
import { Journal, avecEnMain, depart, enMain, pieces, rendre, rien, texte } from './expedition-journal'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

/** Les cartes venues avec le jeu complet. */
const NEUVES: readonly CarteDeRencontre[] = CARTES_DES_RENCONTRES.filter(c => c.depuis === VERSION_DU_JEU_COMPLET)

// ── L'énergie et les offres ─────────────────────────────────────────────────

test(`l’énergie suit les actes : ${ENERGIE_DES_ACTES[0]} à l’acte 1, ${ENERGIE_DES_ACTES[1]} ensuite ; une expédition d’avant garde ses ${INSPIRATION_PAR_QUESTION} ; le cran 4 de l’Ascension en ôte partout`, () => {
  assert.deepEqual(energieDesActes(VERSION_DU_JEU_COMPLET), [2, 3, 3])
  assert.deepEqual(energieDesActes(VERSION_DU_CODEX), [INSPIRATION_PAR_QUESTION, INSPIRATION_PAR_QUESTION, INSPIRATION_PAR_QUESTION])
  assert.deepEqual(
    energieDesActesALAscension(VERSION_DU_JEU_COMPLET, 4),
    [2, 3, 3].map(n => n - ENERGIE_EN_ASCENSION),
  )
  assert.deepEqual(energieDesActesALAscension(VERSION_DU_JEU_COMPLET, 3), [2, 3, 3], 'le cran 4 seul touche à l’énergie')
  assert.deepEqual([energieDuTour(VERSION_DU_JEU_COMPLET, 0, 0), energieDuTour(VERSION_DU_JEU_COMPLET, 9, 0)], [2, 3], 'au-delà du dernier acte, celle du dernier')
  // Par le pli : trois cartes en main pour deux d'énergie — il choisit.
  let e = new Journal(depart('energie', [])).avancer('e00')
  assert.deepEqual([e.rencontre!.tour.inspiration, e.rencontre!.main.length], [2, CARTES_DES_ACTES[0]])
  const deux = new Journal(depart('energie', []))
  deux.acte()
  deux.prendreSiOfferte()
  e = deux.avancer('e00')
  assert.deepEqual([e.acte, e.rencontre!.tour.inspiration, e.rencontre!.main.length], [1, 3, CARTES_DES_ACTES[1]], 'à l’acte 2, trois, et quatre cartes')
  // Rejouée en version 7, la même graine a ses trois d'énergie : une expédition se rejoue telle qu'elle s'est jouée.
  assert.equal(new Journal(depart('energie', [], { v: VERSION_DU_CODEX })).avancer('e00').rencontre!.tour.inspiration, INSPIRATION_PAR_QUESTION)
  assert.equal(new Journal(depart('energie', [], { ascension: 4 })).avancer('e00').rencontre!.tour.inspiration, 2 - ENERGIE_EN_ASCENSION)
})

test('les offres : des communes après une rencontre de l’acte 1 ; une épique parfois après une élite, un coffre ou à l’échoppe, et plus tard après une rencontre ; aucune maudite à l’acte 1', () => {
  assert.deepEqual(raretesDeLOffre(VERSION_DU_JEU_COMPLET, 0, 'rencontre'), { commun: 1 })
  assert.deepEqual(raretesDeLOffre(VERSION_DU_JEU_COMPLET, 0, 'elite'), RARETES_DE_L_ACTE_1_DU_JEU_COMPLET.elite)
  for (const acte of [1, 2]) {
    for (const quelle of ['rencontre', 'elite'] as const) assert.deepEqual(raretesDeLOffre(VERSION_DU_JEU_COMPLET, acte, quelle), RARETES_DU_JEU_COMPLET[quelle])
  }
  // Avant le jeu complet, aucune épique : une offre rejouée se tire comme elle s'est tirée.
  for (const v of [5, 6, VERSION_DU_CODEX]) {
    for (const acte of [0, 1, 2]) for (const quelle of ['rencontre', 'elite'] as const) assert.equal(raretesDeLOffre(v, acte, quelle).epique, undefined, `version ${v}`)
  }
  const toutes = codexDuNiveau(NIVEAU_MAX, []).cartes
  const compte = (acte: number, quelle: 'rencontre' | 'elite') => {
    const n: Record<string, number> = { commun: 0, rare: 0, epique: 0, maudit: 0 }
    for (let k = 0; k < 400; k++) {
      for (const cle of offreDuCodex(`complet:${acte}:${quelle}:${k}`, k % 7, toutes, [], raretesDeLOffre(VERSION_DU_JEU_COMPLET, acte, quelle))) n[carteDeRencontre(cle)!.rarete]++
    }
    return n
  }
  const rencontre1 = compte(0, 'rencontre')
  assert.deepEqual([rencontre1.rare, rencontre1.epique, rencontre1.maudit], [0, 0, 0], 'une rencontre de l’acte 1 : des communes')
  const elite1 = compte(0, 'elite')
  assert.ok(elite1.epique > 0 && elite1.maudit === 0, `une élite de l’acte 1 : ${elite1.epique} épiques, ${elite1.maudit} maudites`)
  const rencontre2 = compte(1, 'rencontre')
  assert.ok(rencontre2.epique > 0 && rencontre2.maudit > 0, `à l’acte 2, une rencontre aussi : ${rencontre2.epique} épiques, ${rencontre2.maudit} maudites`)
  const elite2 = compte(1, 'elite')
  assert.ok(elite2.epique > 2 * rencontre2.epique, `l’élite bien plus souvent : ${elite2.epique} contre ${rencontre2.epique}`)
  // À l'échoppe, une épique se paie plus cher qu'une rare.
  assert.deepEqual(
    ['genie', 'lecon', 'evidence', 'surmenage'].map(cle => prixDeLArticle('joker', cle)),
    [PRIX_DE_L_ECHOPPE.epique, PRIX_DE_L_ECHOPPE.rare, PRIX_DE_L_ECHOPPE.commun, PRIX_DE_L_ECHOPPE.maudit],
  )
  assert.ok(PRIX_DE_L_ECHOPPE.epique > PRIX_DE_L_ECHOPPE.rare)
})

/** Le contexte d'une carte, en préparation, au courage plein : chaque carte en main, une question d'Histoire à quatre choix. */
const contexte = (v: number, plus: Partial<ContexteDUneCarte> = {}): ContexteDUneCarte => ({
  v,
  tour: { phase: 'preparation', inspiration: 3, jouees: [], surLaQuestion: [] },
  main: CARTES_DES_RENCONTRES.map(c => c.cle),
  pouvoirs: [],
  question: { reponses: 4, tiree: 'quatre', forme: 'quatre', six: true, nombre: false, datee: true, categorie: 'Histoire' },
  fetiche: 'Histoire',
  courage: COURAGE_MAX,
  derniereFrappe: 0,
  defausse: 0,
  ...plus,
})

test('une expédition d’avant le jeu complet se rejoue telle qu’elle s’est jouée : ses offres ne tirent aucune carte neuve, et aucune ne s’y joue', () => {
  assert.equal(NEUVES.length, 42)
  const familles = (Object.keys(FAMILLES_DE_CARTES) as FamilleDeCartes[]).filter(f => f !== 'neutre')
  for (let k = 0; k < 300; k++) {
    const deux = [familles[k % familles.length], familles[(k + 1) % familles.length]]
    for (const v of [5, 6]) {
      for (const quelle of ['rencontre', 'elite'] as const) {
        for (const cle of offreDeCartes(`avant:${k}`, k % 5, deux, raretesDeLOffre(v, 1 + (k % 2), quelle), v >= 6)) {
          assert.equal(carteDeRencontre(cle)!.depuis, undefined, `${cle}, venue après la version ${v}`)
        }
      }
    }
  }
  for (const c of NEUVES) {
    assert.equal(refusDeLaCarte(contexte(VERSION_DU_CODEX), c.cle), 'Cette carte ne se lit pas : recharge la page', c.cle)
  }
})

// ── Chaque carte, levée puis jouée ──────────────────────────────────────────

test(`chaque carte du jeu complet, levée, annonce ce que le serveur fait : ${NEUVES.length} cartes`, async () => {
  const { apercuALaMise, changementDeLaCarte } = await pieces()
  for (const c of NEUVES) {
    const j = avecEnMain(c.cle)
    // Une carte de pendant la question se joue la question vue, son pari dit.
    if (c.moment === 'reflexe') j.voir(10)
    const avant = j.vue()
    assert.equal(avant.refus[c.cle], null, `${c.cle} se joue ici`)
    const promis = changementDeLaCarte(avant, 10, 'Histoire', c.cle)
    assert.ok(promis, `${c.cle} promet quelque chose`)
    assert.deepEqual(promis.avant, apercuALaMise(avant, 10, 'Histoire'))
    const position = j.etat().enAttente
    const e = j.jouer(c.cle)
    assert.ok(e.rencontre!.tour.jouees.includes(c.cle), `${c.cle} jouée`)
    if (CHANGENT_DE_QUESTION.has(c.cle)) assert.notEqual(e.enAttente, position, `${c.cle} : une autre question`)
    assert.deepEqual(promis.apres, apercuALaMise(j.vue(), 10, 'Histoire'), `${c.cle} : la carte levée annonçait ce que le serveur a fait`)
  }
})

test('les chiffres des cartes neuves : ce que chacune ajoute au tour — une seule règle, que le pli applique et que la carte levée annonce', () => {
  const avant = { inspiration: 3, charge: 0, garde: 0, serie: 2 }
  const ch = (cle: string, plus: Partial<ContexteDesChiffres> = {}, pouvoirs: string[] = []) => chiffresApresLaCarte(cle, avant, pouvoirs, { v: VERSION_DU_JEU_COMPLET, ...plus })
  // Ce que l'adversaire perd de plus, si tu as juste.
  assert.deepEqual(['evidence', 'cagnotte', 'memoire', 'volte-face'].map(cle => ch(cle).charge), [4, 4, 3, 3])
  assert.deepEqual([ch('lecon').charge, ch('revelation').charge, ch('rafle').charge], [4, 4, 14])
  assert.deepEqual(['facile', 'moyen', 'difficile'].map(niveau => ch('savoir-faire', { niveau: niveau as 'facile' }).charge), [4, 7, 7])
  assert.equal(ch('expose', { savoir: SAVOIR_DES_MARCHES.moyen }).charge, SAVOIR_DES_MARCHES.moyen, 'une fois de plus ce que vaut la question')
  assert.deepEqual([ch('genie').charge, ch('genie', { fetiche: true }).charge], [8, 14])
  assert.deepEqual([ch('fortune', { ecus: 9 }).charge, ch('fortune', { ecus: 57 }).charge], [0, 5], 'un par tranche de dix écus')
  // Les boucliers.
  assert.deepEqual([ch('muraille').garde, ch('cuirasse').garde, ch('sang-froid').garde, ch('sang-froid').charge], [12, BOUCLIER_DE_LA_CUIRASSE, 4, 4])
  assert.deepEqual([ch('coup-d-oeil', {}, ['astrolabe']).garde, ch('augure', {}, ['astrolabe']).garde, ch('concentration', {}, ['astrolabe']).garde], [BOUCLIER_DE_L_ASTROLABE, BOUCLIER_DE_L_ASTROLABE, 0], 'Astrolabe : chaque indice protège')
  for (const cle of CHANGENT_LA_QUESTION) {
    assert.equal(ch(cle, {}, ['cameleon']).garde - ch(cle).garde, BOUCLIER_DU_CAMELEON, `${cle}, sous Caméléon`)
  }
  assert.equal(ch('concentration', {}, ['cameleon']).garde, 0)
  // L'énergie qui reste, la carte payée.
  assert.deepEqual(['meditation', 'foulee', 'sprint'].map(cle => ch(cle).inspiration), [4, 4, 4], 'gratuites, elles en donnent une')
  assert.equal(ch('maitrise').inspiration, 3 - 2 + 1, 'Maîtrise compte déjà pour cette question')
  assert.equal(ch('surmenage').inspiration, 3 + 2)
  assert.equal(ch('inarretable').serie, avant.serie + 1)
})

test('pourquoi une carte neuve ne se joue pas : une seule règle', () => {
  const v = VERSION_DU_JEU_COMPLET
  for (const cle of ['panacee', 'second-souffle']) {
    assert.equal(refusDeLaCarte(contexte(v), cle), 'Ton courage est au plus haut', cle)
    assert.equal(refusDeLaCarte(contexte(v, { courage: COURAGE_MAX - 1 }), cle), null, cle)
  }
  const vraiFaux = { question: { reponses: 2, tiree: 'vrai-faux' as const, forme: 'vrai-faux' as const, six: false, nombre: false, datee: true, categorie: 'Histoire' } }
  const enQuestion = (surLaQuestion: string[] = [], inspiration = 3) => ({ tour: { phase: 'question' as const, inspiration, jouees: [...surLaQuestion], surLaQuestion } })
  assert.equal(refusDeLaCarte(contexte(v, vraiFaux), 'augure'), 'Pas sur un vrai ou faux : elle répondrait à ta place')
  for (const cle of ['presage', 'voyance', 'revelation']) assert.equal(refusDeLaCarte(contexte(v, { ...vraiFaux, ...enQuestion() }), cle), 'Pas sur un vrai ou faux : elle répondrait à ta place', cle)
  assert.equal(refusDeLaCarte(contexte(v, enQuestion(['revelation'])), 'voyance'), 'Il ne reste plus rien à effacer', 'Révélation n’a laissé que deux réponses')
  assert.equal(refusDeLaCarte(contexte(v, vraiFaux), 'miroir'), 'Elle est déjà un vrai ou faux')
  assert.equal(refusDeLaCarte(contexte(v, vraiFaux), 'polymorphe'), 'Pas sur un vrai ou faux')
  assert.equal(refusDeLaCarte(contexte(v, { question: { ...contexte(v).question!, six: false } }), 'polymorphe'), 'Cette question n’a pas de quoi tenir six choix')
  // Une forme à la fois.
  const apres = (cle: string) => ({ tour: { phase: 'preparation' as const, inspiration: 3, jouees: [cle], surLaQuestion: [cle] } })
  assert.equal(refusDeLaCarte(contexte(v, apres('polymorphe')), 'miroir'), 'La question a déjà changé de forme')
  assert.equal(refusDeLaCarte(contexte(v, apres('miroir')), 'corser'), 'La question a déjà changé de forme')
  assert.equal(refusDeLaCarte(contexte(v, { tour: { phase: 'preparation', inspiration: 3, jouees: ['assurance'], surLaQuestion: [] } }), 'assurance'), 'Déjà jouée à cette question')
  assert.equal(refusDeLaCarte(contexte(v, { pouvoirs: ['maitrise'] }), 'maitrise'), 'Elle agit déjà dans cette rencontre')
  assert.equal(refusDeLaCarte(contexte(v, { tour: { phase: 'preparation', inspiration: 1, jouees: [], surLaQuestion: [] } }), 'rafle'), 'Il lui faut 2 d’énergie : il t’en reste 1')
  assert.equal(refusDeLaCarte(contexte(v, enQuestion([], 1)), 'sang-froid'), null, 'une seule, la question vue')
  assert.equal(refusDeLaCarte(contexte(v), 'evidence'), 'Elle se joue pendant la question : vois-la d’abord')
})

// ── Dans le pli ─────────────────────────────────────────────────────────────

test(`Panacée : ${COURAGE_DE_LA_PANACEE} de courage, une fois par expédition — jouée, elle quitte son paquet ; Second souffle, ${COURAGE_DU_SECOND_SOUFFLE}, revient à la rencontre suivante`, () => {
  const j = avecEnMain('panacee')
  const courage = j.etat().courage!
  assert.ok(courage < COURAGE_MAX)
  let e = j.jouer('panacee')
  assert.equal(e.courage, Math.min(COURAGE_MAX, courage + COURAGE_DE_LA_PANACEE))
  assert.ok(!e.paquet.includes('panacee'), 'elle quitte son paquet')
  e = j.gagner()
  j.prendreSiOfferte()
  e = j.avancer('e30')
  assert.ok(![...e.rencontre!.pioche, ...e.rencontre!.main].includes('panacee'), 'la rencontre suivante ne la tire plus')
  const s = avecEnMain('second-souffle')
  const avant = s.etat().courage!
  e = s.jouer('second-souffle')
  assert.equal(e.courage, Math.min(COURAGE_MAX, avant + COURAGE_DU_SECOND_SOUFFLE))
  assert.ok(e.rencontre!.epuisees.includes('second-souffle') && e.paquet.includes('second-souffle'), 'épuisée pour la rencontre, gardée au paquet')
})

test('ce qu’une bonne réponse rapporte de plus : les écus du Flambeur, à part du pari ; le courage du Pansement — rien sur une erreur ; Assurance rend le pari perdu', () => {
  for (const [cle, ecus] of [
    ['pourboire', ECUS_DU_POURBOIRE],
    ['cagnotte', ECUS_DE_LA_CAGNOTTE],
    ['rafle', ECUS_DE_LA_RAFLE],
  ] as const) {
    const j = avecEnMain(cle)
    j.jouer(cle)
    j.voir(10)
    const avant = j.etat().ecus
    assert.equal(j.vue().apercu?.juste.ecusDesCartes, ecus, `${cle} : l’aperçu le dit`)
    const faux = j.copie()
    const e = j.repondre(true)
    assert.equal(e.rencontre?.sorte, 'elite', 'l’élite tient encore : pas d’écus de victoire')
    assert.deepEqual([e.coup?.mise, e.coup?.ecus, e.ecus - avant], [5, ecus, 5 + ecus], cle)
    const f = faux.repondre(false)
    assert.deepEqual([f.coup?.ecus, f.ecus - avant], [undefined, -10], `${cle} : rien sur une erreur, le pari perdu`)
  }
  const p = avecEnMain('pansement')
  p.jouer('pansement')
  const courage = p.etat().courage!
  let e = p.repondre(true)
  assert.deepEqual([e.coup?.courage, e.courage], [COURAGE_DU_PANSEMENT, Math.min(COURAGE_MAX, courage + COURAGE_DU_PANSEMENT)])
  const a = avecEnMain('assurance')
  a.jouer('assurance')
  a.voir(10)
  const ecus = a.etat().ecus
  assert.equal(a.vue().apercu?.faux.ecus, 0, 'l’aperçu ne dit plus de pari perdu')
  e = a.repondre(false)
  assert.equal(e.ecus, ecus, 'son pari rendu')
})

test(`Surmenage, la maudite : deux d’énergie de plus, mais si tu te trompes son attaque fait ${FRAPPE_DU_SURMENAGE} de plus`, () => {
  const j = avecEnMain('surmenage')
  let e = j.etat()
  assert.equal(e.acte, 1, 'une maudite ne s’offre qu’à partir de l’acte 2')
  const avant = e.rencontre!.tour.inspiration
  e = j.jouer('surmenage')
  assert.equal(e.rencontre!.tour.inspiration, avant + 2)
  const frappe = frappeDeLaQuestion(e.rencontre!)
  assert.equal(j.vue().apercu?.faux.frappe, frappe + FRAPPE_DU_SURMENAGE)
  const courage = e.courage!
  e = j.repondre(false)
  assert.deepEqual([e.coup?.frappe, e.courage], [frappe + FRAPPE_DU_SURMENAGE, courage - (frappe + FRAPPE_DU_SURMENAGE)])
})

test('ce qui tient toute la rencontre : Maîtrise et Cuirasse à chaque question, Bastion garde son bouclier, Inarrêtable sa série, Représailles riposte', () => {
  const m = avecEnMain('maitrise')
  let e = m.jouer('maitrise')
  assert.equal(e.rencontre!.tour.inspiration, 2 - 2 + 1)
  e = m.repondre(true)
  assert.equal(e.rencontre!.tour.inspiration, 2 + 1, 'la question suivante aussi')
  const c = avecEnMain('cuirasse')
  e = c.jouer('cuirasse')
  assert.equal(e.rencontre!.tour.garde, BOUCLIER_DE_LA_CUIRASSE)
  e = c.repondre(false)
  assert.equal(e.rencontre!.tour.garde, BOUCLIER_DE_LA_CUIRASSE, 'chaque question')
  // Bastion : posé, puis un bouclier de Prudence — il reste après une bonne réponse, et ne s'use que de ce qu'il pare.
  const b = avecEnMain('bastion', k => {
    k.jouer('bastion')
    k.repondre(true)
    return enMain(k, 'prudence')
  })
  e = b.jouer('prudence')
  assert.equal(e.rencontre!.tour.garde, 5)
  e = b.repondre(true)
  assert.equal(e.rencontre!.tour.garde, 5, 'gardé après une bonne réponse')
  const frappe = frappeDeLaQuestion(e.rencontre!)
  e = b.repondre(false)
  assert.deepEqual([e.coup?.absorbee, e.rencontre!.tour.garde], [Math.min(5, frappe), Math.max(0, 5 - frappe)], 'usé de ce qu’il a paré')
  const i = avecEnMain('inarretable')
  e = i.jouer('inarretable')
  assert.equal(e.rencontre!.serie, 1)
  e = i.repondre(true)
  assert.equal(e.rencontre!.serie, 2)
  e = i.repondre(false)
  assert.equal(e.rencontre!.serie, 2, 'une erreur ne la fait plus retomber')
  // Représailles, posée, puis un bouclier de Prudence : ce qu'il pare, l'adversaire en perd la moitié, arrondie au-dessus.
  const r = avecEnMain('represailles', k => {
    k.jouer('represailles')
    k.repondre(true)
    return enMain(k, 'prudence')
  })
  e = r.jouer('prudence')
  const sceaux = e.rencontre!.sceaux
  const pare = Math.min(5, frappeDeLaQuestion(e.rencontre!))
  assert.equal(r.vue().apercu?.faux.contre, Math.ceil(pare * PART_DES_REPRESAILLES))
  e = r.repondre(false)
  assert.deepEqual([e.coup?.absorbee, e.rencontre!.sceaux], [pare, sceaux - Math.ceil(pare * PART_DES_REPRESAILLES)])
  // Contre-attaque jouée par-dessus : tout, plus la moitié.
  assert.equal(riposte(5, ['contre-attaque'], ['represailles']), 5 + 3)
  assert.equal(riposte(5, [], []), 0)
})

test('ce qu’une bonne réponse laisse à la suivante — Leçon, Mémoire, Accélération, Vent arrière — ; ce qu’Encyclopédie et Rythme comptent', () => {
  const l = avecEnMain('lecon')
  let e = l.jouer('lecon')
  assert.equal(e.rencontre!.tour.charge, 4)
  e = l.repondre(true)
  assert.deepEqual([e.coup?.brises, e.rencontre!.tour.charge], [SAVOIR_DES_MARCHES.facile + 4, 4], 'et 4 de plus encore à la suivante')
  const m = avecEnMain('memoire')
  m.voir()
  m.jouer('memoire')
  e = m.repondre(true)
  assert.equal(e.rencontre!.main.length, CARTES_DES_ACTES[0] + 1, 'une carte de plus')
  const a = avecEnMain('acceleration')
  a.jouer('acceleration')
  e = a.repondre(true)
  assert.deepEqual([e.rencontre!.tour.inspiration, e.rencontre!.main.length], [2 + 1, CARTES_DES_ACTES[0] + 1])
  const faux = avecEnMain('acceleration')
  faux.jouer('acceleration')
  e = faux.repondre(false)
  assert.deepEqual([e.rencontre!.tour.inspiration, e.rencontre!.main.length], [2, CARTES_DES_ACTES[0]], 'rien sur une erreur')
  const v = avecEnMain('vent-arriere')
  v.jouer('vent-arriere')
  e = v.repondre(true)
  assert.equal(e.rencontre!.tour.inspiration, 2 + 1)
  e = v.repondre(false)
  assert.equal(e.rencontre!.tour.inspiration, 2, 'après une erreur, rien')
  e = v.repondre(true)
  assert.equal(e.rencontre!.tour.inspiration, 2 + 1, 'pour toute la rencontre')
  // Encyclopédie : 2 de plus par bonne réponse déjà donnée dans la rencontre.
  const enc = avecEnMain('encyclopedie')
  enc.jouer('encyclopedie')
  e = enc.repondre(true)
  assert.equal(e.coup?.brises, SAVOIR_DES_MARCHES.facile)
  e = enc.repondre(false)
  e = enc.repondre(true)
  assert.equal(e.coup?.brises, SAVOIR_DES_MARCHES.facile + ENCYCLOPEDIE_PAR_JUSTE, 'une erreur entre deux ne l’efface pas')
  // Rythme : 1 de plus par bonne réponse de sa série, celle-ci comprise.
  const r = avecEnMain('rythme')
  r.jouer('rythme')
  e = r.repondre(true)
  assert.equal(e.coup?.brises, SAVOIR_DES_MARCHES.facile + 1)
  e = r.repondre(true)
  assert.equal(e.coup?.brises, SAVOIR_DES_MARCHES.facile + 2)
})

test('les formes : sous Métamorphose, un vrai ou faux vaut une question à quatre choix et six choix le double ; Miroir et Polymorphe, à la question qu’ils posent ; Prisme frappe à six choix', () => {
  const sans = { pouvoirs: [], surLaQuestion: [] }
  const vf = { reponses: 2 }
  const six = { reponses: 6, forme: 'six' as const }
  const quatre = { reponses: 4, forme: 'quatre' as const }
  assert.deepEqual([vf, six, quatre].map(q => multiplicateurDeLaForme(q, sans)), [MULTIPLICATEUR_DU_VRAI_OU_FAUX, MULTIPLICATEUR_DU_SIX_CHOIX, 1])
  assert.deepEqual([vf, six, quatre].map(q => multiplicateurDeLaForme(q, { pouvoirs: ['metamorphose'], surLaQuestion: [] })), [1, 2, 1])
  assert.equal(multiplicateurDeLaForme(vf, { pouvoirs: [], surLaQuestion: ['miroir'] }), 1)
  assert.equal(multiplicateurDeLaForme(vf, { pouvoirs: [], surLaQuestion: ['simplifier'] }), MULTIPLICATEUR_DU_VRAI_OU_FAUX, 'Simplifier, lui, coûte la moitié')
  assert.equal(multiplicateurDeLaForme(six, { pouvoirs: [], surLaQuestion: ['polymorphe'] }), 2)
  assert.equal(multiplicateurDeLaForme(six, { pouvoirs: [], surLaQuestion: ['corser'] }), MULTIPLICATEUR_DU_SIX_CHOIX)
  // Par le pli : la question reposée, comme le serveur la repose.
  const p = avecEnMain('polymorphe')
  p.jouer('polymorphe')
  assert.equal(p.vue().annonce?.reponses, 6)
  assert.equal(p.repondre(true).coup?.brises, SAVOIR_DES_MARCHES.facile * 2)
  const m = avecEnMain('miroir')
  m.jouer('miroir')
  assert.equal(m.vue().annonce?.reponses, 2)
  assert.equal(m.repondre(true).coup?.brises, SAVOIR_DES_MARCHES.facile, 'un vrai ou faux, sans rien y perdre')
  const meta = avecEnMain('metamorphose')
  meta.jouer('metamorphose')
  meta.poser({ tiree: 'vrai-faux', forme: 'vrai-faux', reponses: 2 })
  assert.equal(meta.repondre(true).coup?.brises, SAVOIR_DES_MARCHES.facile)
  // Le Prisme : chaque bonne réponse frappe plus, six choix plus encore.
  const pr = avecEnMain('prisme')
  pr.jouer('prisme')
  assert.equal(pr.repondre(true).coup?.brises, SAVOIR_DES_MARCHES.facile + PRISME_PAR_JUSTE)
  pr.poser({ tiree: 'six', forme: 'six', reponses: 6 })
  assert.equal(pr.repondre(true).coup?.brises, Math.round((SAVOIR_DES_MARCHES.facile + PRISME_A_SIX_CHOIX) * MULTIPLICATEUR_DU_SIX_CHOIX))
})

test('les indices du Devin : Augure efface avant même qu’il voie la question, Présage efface et pioche, Voyance deux, Vision à chaque question, Révélation n’en laisse que deux', () => {
  assert.deepEqual(
    [effaceesDuTour(['augure'], [], { reponses: 4 }), effaceesDuTour(['voyance'], [], { reponses: 4 }), effaceesDuTour([], ['vision'], { reponses: 4 }), effaceesDuTour(['revelation'], [], { reponses: 6 }), effaceesDuTour(['revelation'], ['vision'], { reponses: 4 })],
    [1, 2, 1, 4, 2],
  )
  assert.equal(effaceesDuTour(['voyance'], ['vision'], { reponses: 2 }), 0, 'rien sur un vrai ou faux')
  const a = avecEnMain('augure')
  a.jouer('augure')
  a.voir()
  assert.equal(a.vue().effacees, 1)
  const p = avecEnMain('presage')
  p.voir()
  const main = p.etat().rencontre!.main.length
  const e = p.jouer('presage')
  assert.deepEqual([p.vue().effacees, e.rencontre!.main.length], [1, main], 'jouée, une carte tirée à sa place')
  const v = avecEnMain('vision')
  v.jouer('vision')
  v.voir()
  assert.equal(v.vue().effacees, 1)
  v.repondre(true)
  v.voir()
  assert.equal(v.vue().effacees, 1, 'la question suivante aussi')
  for (const [cle, n] of [
    ['voyance', 2],
    ['revelation', 2],
  ] as const) {
    const j = avecEnMain(cle)
    j.voir()
    j.jouer(cle)
    assert.equal(j.vue().effacees, n, cle)
  }
})

test('les cartes qui tirent et qui donnent de l’énergie : Sprint, Méditation, Foulée, Surmenage — Pourboire et Assurance tirent à leur place — et Pactole, dont le pari gagné frappe', () => {
  for (const [cle, tirees, energie, epuisee] of [
    ['sprint', 2, 1, true],
    ['meditation', 1, 1, true],
    ['foulee', 0, 1, true],
    ['surmenage', 1, 2, false],
    ['pourboire', 1, 0, false],
    ['assurance', 1, 0, false],
  ] as const) {
    const j = avecEnMain(cle)
    const avant = j.etat().rencontre!
    const e = j.jouer(cle)
    assert.deepEqual([e.rencontre!.main.length, e.rencontre!.tour.inspiration], [avant.main.length - 1 + tirees, avant.tour.inspiration + energie], cle)
    assert.equal(e.rencontre!.epuisees.includes(cle), epuisee, `${cle} : ${epuisee ? 'une fois par rencontre' : 'à la défausse'}`)
  }
  const p = avecEnMain('pactole')
  p.jouer('pactole')
  p.voir(10)
  assert.equal(p.repondre(true).coup?.brises, SAVOIR_DES_MARCHES.facile + 5, 'le pari rapporte 5 : il perd 5 de plus')
})

// ── À l'écran ───────────────────────────────────────────────────────────────

test('à l’écran : l’épique porte la gemme de l’album, la maudite son rouge à elle ; Panacée dit « une fois par expédition » ; l’aperçu dit les écus et le courage des cartes ; les règles, l’énergie de chaque acte', async () => {
  const p = await pieces()
  assert.deepEqual(p.gemmeDeLaCarte(carteDeRencontre('genie')!), { '--gemme': '#b77bff' })
  assert.deepEqual(p.gemmeDeLaCarte(carteDeRencontre('surmenage')!), { '--gemme': '#d4506e' }, 'une maudite qui ressemblerait à une épique se prendrait pour une récompense')
  const panacee = texte(await rendre(p.CarteLevee, { cle: 'panacee', onReposer: rien }))
  assert.match(panacee, /épique/)
  assert.match(panacee, /une fois par expédition/)
  assert.match(texte(await rendre(p.CarteLevee, { cle: 'second-souffle', onReposer: rien })), /une fois par rencontre/)
  const tour = (jouees: string[]) => ({ charge: 0, garde: 0, mise: 0, jouees })
  const de = (jouees: string[]) =>
    apercuDuTour({ v: VERSION_DU_JEU_COMPLET, tour: tour(jouees), pouvoirs: [], sceaux: 22, frappe: 7, savoir: SAVOIR_DES_MARCHES.facile, question: { reponses: 4, forme: 'quatre', categorie: 'Histoire' } })
  const a = de(['pourboire', 'pansement'])
  assert.deepEqual([a.juste.ecusDesCartes, a.juste.courage], [ECUS_DU_POURBOIRE, COURAGE_DU_PANSEMENT])
  const tuiles = texte(await rendre(p.Apercu, { a }))
  assert.match(tuiles, new RegExp(`\\+${ECUS_DU_POURBOIRE} écus de tes cartes`))
  assert.match(tuiles, new RegExp(`\\+${COURAGE_DU_PANSEMENT} de courage`))
  const nu = de([])
  assert.deepEqual([nu.juste.ecusDesCartes, nu.juste.courage], [undefined, undefined], 'sans elles, la ligne ne se dit pas')
  assert.equal(p.energieDite([2, 3, 3]), '2 d’énergie à l’acte 1, 3 ensuite')
  assert.equal(p.energieDite([3, 3, 3]), '3 d’énergie')
  const regles = texte(await rendre(p.FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], energie: [2, 3, 3], onFermer: rien }))
  assert.match(regles, /Tu en as 2 à chaque question de l’acte 1, 3 ensuite\./)
  assert.match(texte(await rendre(p.FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], energie: [3, 3, 3], onFermer: rien })), /Tu en as 3 à chaque question\./)
})
