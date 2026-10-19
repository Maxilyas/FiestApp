// Les huit familles de l'Expédition (`VERSION_DES_HUIT_FAMILLES`, la version
// 9 du départ). Le propriétaire, le 19 octobre 2026 : « Pour les cartes il faut
// vraiment plus de gameplay différents. Quitte à rajouter des communes aussi. »
// Deux styles qui jouent autrement : le Sophiste sème le doute — l'adversaire
// perd des points à chaque question, juste ou fausse —, le Téméraire paie en
// courage et frappe d'autant plus qu'il en a perdu. Chaque carte dans le pli ;
// levée, elle annonce ce que le serveur fait ; une expédition d'avant n'en tire
// aucune. Par les routes — le départ en version 9 — : `expedition-styles.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {
  BOUCLIER_DE_L_OBJECTION,
  CARTES_DES_RENCONTRES,
  CARTES_DES_ACTES,
  COURAGE_DE_L_ADRENALINE,
  COURAGE_DE_LA_FOUGUE,
  COURAGE_DU_COUP_DE_SANG,
  COURAGE_MAX,
  DOUTE_DE_L_ENGRENAGE,
  DOUTE_DE_L_INSINUATION,
  DOUTE_DE_LA_HANTISE,
  DOUTE_DE_LA_RUMEUR,
  SAVOIR_DES_MARCHES,
  SEUIL_DU_DERNIER_CARRE,
  VERSION_DES_HUIT_FAMILLES,
  VERSION_DU_JEU_COMPLET,
  apercuDuTour,
  chiffresApresLaCarte,
  courageDeLaCarte,
  douteApresLaQuestion,
  douteDUneErreur,
  enPlusApresLaForme,
  frappeDeLaQuestion,
  refusDeLaCarte,
  riposte,
  rongeDuDoute,
  siJuste,
  type CarteDeRencontre,
  type ContexteDUneCarte,
  type ContexteDesChiffres,
  type CoupDeRencontre,
  type VueDeLaRencontre,
} from '../../shared/rencontres'
import { Journal, avecEnMain, depart, pieces, rendre, rien, texte, type Composant } from './expedition-journal'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

/** Les cartes venues avec les huit familles. */
const HUIT: readonly CarteDeRencontre[] = CARTES_DES_RENCONTRES.filter(c => c.depuis === VERSION_DES_HUIT_FAMILLES)

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

/**
 * Un journal du Sophiste — Insinuation et Rumeur dans son paquet de départ —
 * dont la première main, à la rencontre d'en bas, tient ces cartes : une
 * graine cherchée, jamais choisie.
 */
function auSophiste(cartes: readonly string[]): Journal {
  for (let n = 0; n < 600; n++) {
    const j = new Journal(depart(`sophiste:${n}`, [], { v: VERSION_DES_HUIT_FAMILLES, style: 'sophiste' }))
    const e = j.avancer('e00')
    if (cartes.every(c => e.rencontre?.main.includes(c))) return j
  }
  throw new Error(`aucune graine ne met ${cartes.join(' et ')} dans la première main du Sophiste`)
}

// ── Le catalogue ────────────────────────────────────────────────────────────

test('seize cartes, deux familles de huit — trois communes, trois rares, deux épiques — ; une expédition d’avant n’en tire aucune, et aucune ne s’y joue', () => {
  assert.equal(HUIT.length, 16)
  for (const famille of ['sophiste', 'temeraire']) {
    const siennes = HUIT.filter(c => c.famille === famille)
    assert.deepEqual(['commun', 'rare', 'epique'].map(r => siennes.filter(c => c.rarete === r).length), [3, 3, 2], famille)
  }
  for (const c of HUIT) {
    assert.equal(refusDeLaCarte(contexte(VERSION_DU_JEU_COMPLET), c.cle), 'Cette carte ne se lit pas : recharge la page', `${c.cle}, en version 8`)
    assert.ok(c.amelioration, `${c.cle} s’améliore`)
  }
})

// ── Chaque carte, levée puis jouée ──────────────────────────────────────────

/** Zizanie double un doute : la Rumeur, que le Sophiste a de départ, jouée d'abord dans la même main. */
const SCENARIO: Record<string, { autre: { style: 'sophiste' }; main: (j: Journal) => boolean; avant: (j: Journal) => void }> = {
  zizanie: { autre: { style: 'sophiste' }, main: j => !!j.etat().rencontre?.main.includes('rumeur'), avant: j => void j.jouer('rumeur') },
}

test(`chaque carte des huit familles, levée, annonce ce que le serveur fait : ${HUIT.length} cartes`, async () => {
  const { apercuALaMise, changementDeLaCarte } = await pieces()
  for (const c of HUIT) {
    const s = SCENARIO[c.cle]
    const j = avecEnMain(c.cle, s?.main, s?.autre)
    s?.avant(j)
    // Une carte de pendant la question se joue la question vue, son pari dit.
    if (c.moment === 'reflexe') j.voir(10)
    const avant = j.vue()
    assert.equal(avant.v, VERSION_DES_HUIT_FAMILLES)
    assert.equal(avant.refus[c.cle], null, `${c.cle} se joue ici`)
    const promis = changementDeLaCarte(avant, 10, 'Histoire', c.cle)
    assert.ok(promis, `${c.cle} promet quelque chose`)
    assert.deepEqual(promis.avant, apercuALaMise(avant, 10, 'Histoire'))
    const e = j.jouer(c.cle)
    assert.ok(e.rencontre!.tour.jouees.includes(c.cle), `${c.cle} jouée`)
    assert.deepEqual(promis.apres, apercuALaMise(j.vue(), 10, 'Histoire'), `${c.cle} : la carte levée annonçait ce que le serveur a fait`)
  }
})

// ── Le doute ────────────────────────────────────────────────────────────────

test('le doute : avant le verdict, juste ou faux, il perd autant qu’il doute — jamais plus qu’il ne lui reste —, puis il ne doute plus', () => {
  assert.deepEqual([rongeDuDoute(20, 3), rongeDuDoute(2, 5), rongeDuDoute(20, 0)], [3, 2, 0])
  assert.deepEqual([douteApresLaQuestion(3, []), douteApresLaQuestion(0, []), douteApresLaQuestion(3, ['paranoia'])], [0, 0, 3], 'Paranoïa : il ne retombe plus')
  assert.deepEqual(
    [douteApresLaQuestion(3, ['hantise']), douteApresLaQuestion(3, ['hantise+', 'paranoia'])],
    [DOUTE_DE_LA_HANTISE, 3 + DOUTE_DE_LA_HANTISE],
    'Hantise en sème pour la question suivante',
  )
  // Dans le pli : Insinuation jouée, une erreur — il perd 3 avant de frapper, et frappe quand même.
  const j = avecEnMain('insinuation')
  let e = j.jouer('insinuation')
  assert.deepEqual([e.rencontre!.doute, j.vue().doute], [DOUTE_DE_L_INSINUATION, DOUTE_DE_L_INSINUATION])
  const sceaux = e.rencontre!.sceaux
  const frappe = frappeDeLaQuestion(e.rencontre!)
  const courage = e.courage!
  j.voir()
  assert.deepEqual([j.vue().apercu?.doute, j.vue().apercu?.faux.perdu], [DOUTE_DE_L_INSINUATION, frappe], 'l’aperçu le dit des deux côtés')
  e = j.repondre(false)
  assert.deepEqual([e.coup?.doute, e.rencontre!.sceaux, e.rencontre!.doute, e.courage], [DOUTE_DE_L_INSINUATION, sceaux - DOUTE_DE_L_INSINUATION, 0, courage - frappe])
  // La question suivante : plus de doute, ce que la réponse brise seulement.
  e = j.repondre(true)
  assert.deepEqual([e.coup?.doute, e.coup?.brises, e.rencontre!.sceaux], [undefined, SAVOIR_DES_MARCHES.facile, sceaux - DOUTE_DE_L_INSINUATION - SAVOIR_DES_MARCHES.facile])
  // Une autre rencontre repart sans doute.
  assert.equal(new Journal(depart('sans-doute', ['insinuation'])).avancer('e00').rencontre!.doute, 0)
})

test('tombé de son doute, il ne frappe pas : l’aperçu le dit, le pli le fait, et la mise est perdue quand même ; sous Paranoïa, son doute revient à chaque question', () => {
  // L'aperçu : deux points, trois de doute.
  const a = apercuDuTour({ v: VERSION_DES_HUIT_FAMILLES, tour: { charge: 0, garde: 0, mise: 10, jouees: [] }, pouvoirs: [], sceaux: 2, frappe: 9, savoir: 6, question: { reponses: 4, forme: 'quatre', categorie: 'Histoire' }, doute: 3 })
  assert.deepEqual([a.doute, a.juste.tombe, a.faux.tombe, a.faux.frappe, a.faux.perdu, a.faux.ecus], [2, true, true, 0, 0, 10])
  // Le pli : Paranoïa posée et la Rumeur jouée contre l'élite — deux de doute à chaque question. Deux bonnes réponses, deux
  // erreurs : il ne lui reste que ce qu'il perdra de doute ; la question d'après, ratée, ne l'empêche pas de tomber.
  const j = avecEnMain('paranoia', k => !!k.etat().rencontre?.main.includes('rumeur'), { style: 'sophiste' })
  j.jouer('paranoia')
  let e = j.jouer('rumeur')
  assert.equal(e.rencontre!.doute, DOUTE_DE_LA_RUMEUR)
  j.repondre(true)
  e = j.repondre(true)
  assert.equal(e.rencontre!.doute, DOUTE_DE_LA_RUMEUR, 'il ne retombe plus')
  j.repondre(false)
  e = j.repondre(false)
  const reste = e.rencontre!.sceaux
  assert.ok(reste > 0 && reste <= e.rencontre!.doute, `il lui reste ${reste}, il doute de ${e.rencontre!.doute}`)
  j.voir()
  assert.equal(j.vue().apercu?.faux.tombe, true)
  const courage = j.etat().courage
  e = j.repondre(false)
  assert.equal(e.rencontre, null, 'il est tombé')
  assert.deepEqual([e.coup?.juste, e.coup?.frappe, e.coup?.doute, !!e.coup?.victoire, e.courage], [false, 0, reste, true, courage])
})

test('ce qui sème le doute : Engrenage à chaque erreur, Hantise à chaque question, Zizanie le double, Objection avec un bouclier ; Coup de grâce en frappe', () => {
  const avant = { inspiration: 3, charge: 0, garde: 0, serie: 0, doute: 4 }
  const ch = (cle: string, pouvoirs: string[] = [], plus: Partial<ContexteDesChiffres> = {}) => chiffresApresLaCarte(cle, avant, pouvoirs, { v: VERSION_DES_HUIT_FAMILLES, ...plus })
  assert.deepEqual([ch('zizanie').doute, ch('zizanie+').doute], [8, 8])
  assert.deepEqual([ch('objection').doute, ch('objection').garde], [4 + 2, BOUCLIER_DE_L_OBJECTION])
  // Hantise : à sa question, ses chiffres ; les autres cartes n'en sèment pas — elle mettait 1 de doute à chacune, deux ou trois par question.
  assert.deepEqual([ch('hantise', ['hantise']).doute, ch('concentration', ['hantise']).doute], [4 + DOUTE_DE_LA_HANTISE, 4], 'Hantise : la question où elle est jouée')
  assert.deepEqual([douteDUneErreur(['engrenage']), douteDUneErreur([])], [DOUTE_DE_L_ENGRENAGE, 0])
  // Dans le pli : posée, 1 de doute à cette question, puis à chacune des suivantes, juste ou fausse.
  const h = avecEnMain('hantise')
  let d = h.jouer('hantise')
  assert.equal(d.rencontre!.doute, DOUTE_DE_LA_HANTISE)
  d = h.repondre(true)
  assert.deepEqual([d.coup?.doute, d.rencontre!.doute], [DOUTE_DE_LA_HANTISE, DOUTE_DE_LA_HANTISE])
  d = h.repondre(false)
  assert.deepEqual([d.coup?.doute, d.rencontre!.doute], [DOUTE_DE_LA_HANTISE, DOUTE_DE_LA_HANTISE])
  assert.deepEqual([enPlusApresLaForme({ mise: 0, jouees: ['coup-de-grace'] }, [], 5), enPlusApresLaForme({ mise: 0, jouees: [] }, [], 5)], [5, 0])
  // Zizanie ne double rien sans doute ; Coup de grâce une fois par question.
  assert.equal(refusDeLaCarte(contexte(VERSION_DES_HUIT_FAMILLES), 'zizanie'), 'Il ne doute pas encore : sème d’abord le doute')
  assert.equal(refusDeLaCarte(contexte(VERSION_DES_HUIT_FAMILLES, { doute: 2 }), 'zizanie'), null)
  assert.equal(refusDeLaCarte(contexte(VERSION_DES_HUIT_FAMILLES, { tour: { phase: 'preparation', inspiration: 3, jouees: ['coup-de-grace'], surLaQuestion: [] } }), 'coup-de-grace'), 'Déjà jouée à cette question')
  // Engrenage, posé : une erreur sème le doute pour la question suivante.
  const g = avecEnMain('engrenage')
  g.jouer('engrenage')
  const e = g.repondre(false)
  assert.equal(e.rencontre!.doute, DOUTE_DE_L_ENGRENAGE)
  // Coup de grâce : si juste, il perd en plus autant qu'il doutait en répondant.
  const c = avecEnMain('coup-de-grace', k => !!k.etat().rencontre?.main.includes('rumeur'), { style: 'sophiste' })
  c.jouer('rumeur')
  c.jouer('coup-de-grace')
  const f = c.repondre(true)
  assert.deepEqual([f.coup?.doute, f.coup?.brises], [DOUTE_DE_LA_RUMEUR, SAVOIR_DES_MARCHES.facile + DOUTE_DE_LA_RUMEUR])
})

// ── Le courage en jeu ───────────────────────────────────────────────────────

test('le courage en jeu : Fougue et Coup de sang se paient — et jamais du dernier —, Cicatrices, Dernier carré et Baroud frappent de ce qui manque, Témérité ôte le bouclier', () => {
  assert.deepEqual([courageDeLaCarte('fougue'), courageDeLaCarte('coup-de-sang'), courageDeLaCarte('coup-de-sang+'), courageDeLaCarte('concentration')], [COURAGE_DE_LA_FOUGUE, COURAGE_DU_COUP_DE_SANG, COURAGE_DU_COUP_DE_SANG - 1, 0])
  assert.equal(refusDeLaCarte(contexte(VERSION_DES_HUIT_FAMILLES, { courage: COURAGE_DE_LA_FOUGUE }), 'fougue'), `Il te faut plus de ${COURAGE_DE_LA_FOUGUE} de courage pour la jouer`)
  assert.equal(refusDeLaCarte(contexte(VERSION_DES_HUIT_FAMILLES, { courage: COURAGE_DE_LA_FOUGUE + 1 }), 'fougue'), null)
  const avant = { inspiration: 3, charge: 0, garde: 5, serie: 0 }
  const ch = (cle: string, courage?: number) => chiffresApresLaCarte(cle, avant, [], { v: VERSION_DES_HUIT_FAMILLES, ...(courage !== undefined && { courage }) })
  assert.deepEqual([ch('fougue').charge, ch('fougue').inspiration, ch('coup-de-sang').inspiration], [8, 3, 5])
  assert.deepEqual([ch('cicatrices').charge, ch('cicatrices', 30).charge, ch('cicatrices+', 30).charge], [3, 3 + 5, 4 + 6], 'un de plus par tranche de courage qui manque')
  assert.deepEqual([ch('dernier-carre', SEUIL_DU_DERNIER_CARRE).charge, ch('dernier-carre', SEUIL_DU_DERNIER_CARRE - 1).charge], [5, 14])
  assert.deepEqual([ch('baroud').charge, ch('baroud', 21).charge, ch('baroud+', 21).charge], [0, 15, 4 + 15], 'la moitié de ce qui manque, arrondie au-dessus')
  assert.deepEqual([ch('temerite').garde, ch('temerite').charge], [0, 9])
  // Dans le pli : Fougue prend son courage sur-le-champ ; Coup de sang aussi, contre deux d'énergie et la carte qu'il tire à sa
  // place — de l'énergie sans carte à jouer ne servait à rien.
  const f = avecEnMain('fougue')
  const courage = f.etat().courage!
  let e = f.jouer('fougue')
  assert.deepEqual([e.courage, e.rencontre!.tour.charge], [courage - COURAGE_DE_LA_FOUGUE, 8])
  const s = avecEnMain('coup-de-sang')
  const energie = s.etat().rencontre!.tour.inspiration
  const main = s.etat().rencontre!.main.length
  e = s.jouer('coup-de-sang')
  assert.deepEqual([e.courage, e.rencontre!.tour.inspiration, e.rencontre!.main.length], [courage - COURAGE_DU_COUP_DE_SANG, energie + 2, main])
})

test('Adrénaline rend du courage à chaque bonne réponse ; Berserk : de ce que l’attaque lui prend, l’adversaire perd la moitié', () => {
  assert.equal(siJuste([], ['adrenaline']).courage, COURAGE_DE_L_ADRENALINE)
  assert.equal(siJuste([], ['adrenaline+']).courage, COURAGE_DE_L_ADRENALINE + 1)
  assert.deepEqual([riposte(0, [], ['berserk'], 7), riposte(5, [], ['berserk', 'represailles'], 2), riposte(0, [], [], 7)], [4, 1 + 3, 0], 'chaque moitié arrondie au-dessus')
  const a = avecEnMain('adrenaline')
  a.jouer('adrenaline')
  const courage = a.etat().courage!
  let e = a.repondre(true)
  assert.deepEqual([e.coup?.courage, e.courage], [COURAGE_DE_L_ADRENALINE, Math.min(COURAGE_MAX, courage + COURAGE_DE_L_ADRENALINE)])
  const b = avecEnMain('berserk')
  e = b.jouer('berserk')
  const sceaux = e.rencontre!.sceaux
  const frappe = frappeDeLaQuestion(e.rencontre!)
  b.voir()
  const moitie = Math.ceil(frappe / 2)
  assert.equal(b.vue().apercu?.faux.contre, moitie, 'l’aperçu dit sa riposte')
  e = b.repondre(false)
  assert.deepEqual([e.coup?.perdu, e.coup?.brises, e.rencontre!.sceaux], [frappe, moitie, sceaux - moitie])
})

// ── À l'écran ───────────────────────────────────────────────────────────────

/** Les pièces de la page qu'il faut ici en plus de celles du journal. */
type PiecesDuDoute = {
  Adversaire: Composant
  adversaireALaRevelation: (avant: VueDeLaRencontre, coup: CoupDeRencontre | null | undefined, apres: VueDeLaRencontre | null | undefined) => { sceaux: number; doute: number }
  Apercu: Composant
  FeuilleDesRegles: Composant
  verdictDeLaRencontre: (c: CoupDeRencontre, adversaire: string, finie: boolean) => { titre: string; lignes: string[] }
  ceQueLaCarteAFait: (cle: string) => string | null
}

test('le doute à l’écran : sa pastille sous l’adversaire, l’aperçu des deux côtés, l’en-tête de la révélation, le verdict ; ce que Fougue a coûté ; les règles d’une expédition des huit familles', async () => {
  const p = (await pieces()) as unknown as PiecesDuDoute
  const j = auSophiste(['rumeur'])
  j.jouer('rumeur')
  j.voir()
  const r: VueDeLaRencontre = j.vue()
  const adversaire = await rendre(p.Adversaire, { r, gardien: '', acte: 0 })
  assert.match(adversaire, /<span class="exp-doute">.*Doute 2<\/span>/)
  assert.match(adversaire, /il doute\s: il perdra 2 à cette question, juste ou fausse/)
  const apercu = texte(await rendre(p.Apercu, { a: r.apercu }))
  assert.match(apercu, new RegExp(`Si tu as juste Il perd ${2 + SAVOIR_DES_MARCHES.facile} dont 2 de son doute`))
  assert.match(apercu, /son doute : il perd 2/)
  // Une erreur : à la révélation, l'en-tête dit ce que le pli lui a laissé — le doute compté, et perdu. Lu de la vue d'avant
  // seule, il gardait ses points d'avant le doute et sa pastille.
  const e = j.repondre(false)
  const apres = j.vue()
  const revele = p.adversaireALaRevelation(r, e.coup, apres)
  assert.deepEqual(revele, { sceaux: r.sceaux - 2, doute: 0 })
  assert.equal(revele.sceaux, apres.sceaux)
  const enTete = await rendre(p.Adversaire, { r, gardien: '', acte: 0, ...revele, compact: true })
  assert.match(enTete, new RegExp(`<b>${r.sceaux - 2} points</b>`))
  assert.doesNotMatch(enTete, /exp-doute/)
  const verdict = p.verdictDeLaRencontre({ juste: true, brises: 6, frappe: 0, absorbee: 0, perdu: 0, mise: 0, doute: 2 }, 'Le Scribe', false)
  assert.deepEqual([verdict.titre, verdict.lignes[0]], ['Juste ! Le Scribe perd 8', 'Dont 2 de son doute'])
  const tombe = p.verdictDeLaRencontre({ juste: false, brises: 0, frappe: 0, absorbee: 0, perdu: 0, mise: -10, doute: 1, victoire: { ecus: 6, courage: 0 } }, 'Le Scribe', false)
  assert.equal(tombe.titre, 'Raté… mais son doute fait tomber Le Scribe !')
  assert.ok(!tombe.lignes.some(l => /quand même/.test(l)), tombe.lignes.join(' · '))
  assert.equal(p.ceQueLaCarteAFait('fougue'), `« Fougue » t’a coûté ${COURAGE_DE_LA_FOUGUE} de courage`)
  // Les règles : le doute et le courage qu'on paie, les huit styles — rien de tout ça pour une expédition partie en version 8.
  const regles = (v: number) => rendre(p.FeuilleDesRegles, { rencontres: true, parQuestion: CARTES_DES_ACTES, codex: { regles: [] }, v, onFermer: rien })
  const neuves = texte(await regles(VERSION_DES_HUIT_FAMILLES))
  assert.match(neuves, /Un adversaire qui doute perd autant de points à cette question, juste ou fausse, puis il ne doute plus\. Tombé de son doute, il ne t’attaque pas\./)
  assert.match(neuves, /Une carte qui se paie en courage ne se joue pas s’il ne t’en reste pas plus que son prix\./)
  assert.match(neuves, /Le Sophiste — « Je sème le doute »/)
  assert.match(neuves, /Le Téméraire — « Je joue avec le feu »/)
  const avant = texte(await regles(VERSION_DU_JEU_COMPLET))
  assert.doesNotMatch(avant, /doute|Sophiste|Téméraire/)
})
