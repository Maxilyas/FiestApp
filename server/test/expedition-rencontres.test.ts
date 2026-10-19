// Le prototype des rencontres (`shared/rencontres.ts`, la version 5 du départ
// d'une expédition ; la proposition « L'Expédition en cartes », validée le
// 18 octobre 2026) : une escale à question est un adversaire à faire tomber,
// question après question. Ses règles — ce qu'une bonne réponse brise, ce
// qu'une erreur coûte, pourquoi une carte ne se joue pas, les offres — puis le
// pli qui en fait l'état d'une expédition : le courage, le tour, la pioche, la
// défausse et les épuisées, la victoire, le gardien, la source, le campement.
// Ce que le serveur en fait — la question cachée tant qu'il prépare, les
// formes que Corser et Simplifier changent — : `expedition-rencontres-routes.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GARDIEN,
  PRIX_DE_L_ECHOPPE,
  pliDeLExpedition,
  prixDeLArticle,
  refusDeLaMise,
  refusDuJoker,
  routeDisponible,
  vueDeLaRencontre,
  type CarteDUnActe,
  type DepartDExpedition,
  type EtatDeLExpedition,
  type GesteDExpedition,
  type QuestionPosee,
} from '../../shared/expedition'
import {
  CARTES_DES_RENCONTRES,
  COURAGE_DE_LA_RENAISSANCE,
  COURAGE_D_UN_CAMPEMENT,
  COURAGE_D_UNE_SOURCE,
  COURAGE_MAX,
  CARTES_PAR_QUESTION,
  ECUS_AU_DEPART,
  FRAPPE_DES_RENCONTRES,
  FRAPPE_EN_PLUS_PAR_QUESTION,
  INSPIRATION_PAR_QUESTION,
  PAQUET_DES_RENCONTRES,
  SAVOIR_DES_MARCHES,
  SCEAUX_DES_RENCONTRES,
  apercuDuTour,
  brisesDUneBonneReponse,
  carteDeRencontre,
  carteDuLegendaire,
  cartesDesActes,
  famillesDeLEquipee,
  frappeDUneErreur,
  multiplicateurDeLaForme,
  offreDeCartes,
  paquetDesRencontres,
  raretesDeLOffre,
  refusDeLaCarte,
  type ContexteDUneCarte,
} from '../../shared/rencontres'
import { JOKERS_DES_LEGENDAIRES, LEGENDAIRES_A_JOKER } from '../../shared/jokers'

// ── Les règles ──────────────────────────────────────────────────────────────

test('ce qu’une bonne réponse brise : (savoir + Charge + pouvoir) × forme, puis Banco, doublé sous Quitte ou double', () => {
  assert.equal(multiplicateurDeLaForme({ reponses: 4 }), 1)
  assert.equal(multiplicateurDeLaForme({ reponses: 2 }), 0.5, 'un vrai ou faux : le hasard fait la moitié du travail')
  assert.equal(multiplicateurDeLaForme({ reponses: 6, forme: 'six' }), 1.5)
  assert.equal(multiplicateurDeLaForme({ reponses: 4, forme: 'devoilement', devoile: { mots: 1, sur: 11 } }), 3, 'au premier mot, trois fois')
  assert.equal(multiplicateurDeLaForme({ reponses: 4, forme: 'devoilement', devoile: { mots: 11, sur: 11 } }), 1, 'au dernier, une fois')
  assert.equal(multiplicateurDeLaForme({ reponses: 4, forme: 'devoilement', devoile: { mots: 6, sur: 11 } }), 2)
  assert.equal(brisesDUneBonneReponse({ savoir: 6, charge: 4, enPlus: 0, multiplicateur: 1, banco: 0, double: false }), 10)
  assert.equal(brisesDUneBonneReponse({ savoir: 8, charge: 4, enPlus: 3, multiplicateur: 1.5, banco: 5, double: false }), 28, '(8 + 4 + 3) × 1,5 + 5')
  assert.equal(brisesDUneBonneReponse({ savoir: 6, charge: 0, enPlus: 0, multiplicateur: 0.5, banco: 0, double: true }), 6)
})

test('ce que coûte une erreur : la frappe, moins la Garde ; rien sous Sursis, double sous Tout ou rien', () => {
  assert.deepEqual(frappeDUneErreur({ frappe: 7, sauve: false, double: false, garde: 5 }), { frappe: 7, absorbee: 5, perdu: 2 })
  assert.deepEqual(frappeDUneErreur({ frappe: 7, sauve: false, double: false, garde: 9 }), { frappe: 7, absorbee: 7, perdu: 0 }, 'la Garde ne rend rien en trop')
  assert.deepEqual(frappeDUneErreur({ frappe: 7, sauve: true, double: true, garde: 0 }), { frappe: 0, absorbee: 0, perdu: 0 })
  assert.deepEqual(frappeDUneErreur({ frappe: 7, sauve: false, double: true, garde: 4 }), { frappe: 14, absorbee: 4, perdu: 10 })
})

test('l’aperçu du verdict : ce qu’elle briserait, s’il tombe, ce que coûterait une erreur — et le dévoilement, du premier mot au dernier', () => {
  const tour = { charge: 4, garde: 5, mise: 10, jouees: ['concentration', 'prudence', 'contre-attaque'] }
  const a = apercuDuTour({ v: 5, tour, pouvoirs: ['tresor'], sceaux: 12, frappe: 7, savoir: 8, question: { reponses: 4, forme: 'quatre', categorie: 'Histoire' } })
  assert.deepEqual(a.juste, { brises: 12, tombe: true, ecus: 15 }, 'le trésor : la moitié des dix écus misés, rapportée triple')
  assert.deepEqual(a.faux, { frappe: 7, absorbee: 5, perdu: 2, ecus: 10, contre: 5, charge: true })
  const d = apercuDuTour({ v: 5, tour: { charge: 0, garde: 0, mise: 0, jouees: [] }, pouvoirs: [], sceaux: 40, frappe: 5, savoir: 6, question: { reponses: 4, forme: 'devoilement', categorie: null }, mots: 9 })
  assert.deepEqual([d.juste.auPremierMot, d.juste.brises, d.juste.tombe], [18, 6, false])
})

/** Un contexte où tout se joue : une question à quatre choix, d'Histoire, qui se date, en préparation — aux règles d'avant le codex (v5). */
function contexte(plus: Partial<ContexteDUneCarte> = {}, question: Partial<NonNullable<ContexteDUneCarte['question']>> = {}): ContexteDUneCarte {
  return {
    v: 5,
    tour: { phase: 'preparation', inspiration: 3, jouees: [], surLaQuestion: [] },
    main: CARTES_DES_RENCONTRES.map(c => c.cle),
    pouvoirs: [],
    question: { reponses: 4, tiree: 'quatre', forme: 'quatre', six: true, nombre: false, datee: true, categorie: 'Histoire', ...question },
    fetiche: 'Histoire',
    courage: 50,
    derniereFrappe: 0,
    defausse: 0,
    ...plus,
  }
}

test('pourquoi une carte ne se joue pas : son moment, son inspiration, la question qu’elle vise — une seule règle', () => {
  assert.equal(refusDeLaCarte(contexte(), 'concentration'), null)
  assert.equal(refusDeLaCarte(contexte({ main: [] }), 'concentration'), 'Cette carte n’est plus dans ta main : recharge la page')
  assert.equal(refusDeLaCarte(contexte(), 'coup-d-oeil'), 'Elle se joue pendant la question : vois-la d’abord')
  const enQuestion = contexte({ tour: { phase: 'question', inspiration: 1, jouees: [], surLaQuestion: [] } })
  assert.equal(refusDeLaCarte(enQuestion, 'prudence'), 'Elle se joue avant de voir la question')
  assert.equal(refusDeLaCarte(enQuestion, 'coup-d-oeil'), null)
  assert.equal(refusDeLaCarte(enQuestion, 'parade'), 'Il lui faut 2 d’énergie : il t’en reste 1')
  assert.equal(refusDeLaCarte(contexte({ pouvoirs: ['bibliotheque'] }), 'bibliotheque'), 'Elle agit déjà dans cette rencontre')
  assert.equal(refusDeLaCarte(contexte(), 'detour'), 'Elle se joue sur le plan, entre deux escales')
  // La forme : Corser veut deux leurres, Simplifier une question à quatre choix ; une fois changée, elle ne change plus.
  assert.equal(refusDeLaCarte(contexte({}, { six: false }), 'corser'), 'Cette question n’a pas de quoi tenir six choix')
  assert.equal(refusDeLaCarte(contexte({}, { tiree: 'six', forme: 'six', reponses: 6 }), 'corser'), 'Elle est déjà à six choix')
  assert.equal(refusDeLaCarte(contexte({}, { tiree: 'vrai-faux', forme: 'vrai-faux', reponses: 2 }), 'simplifier'), 'Elle est déjà un vrai ou faux')
  const corsee = contexte({ tour: { phase: 'preparation', inspiration: 2, jouees: ['corser'], surLaQuestion: ['corser'] } }, { forme: 'six', reponses: 6 })
  assert.equal(refusDeLaCarte(corsee, 'simplifier'), 'La question a déjà changé de forme')
  // L'Érudit vit de sa catégorie fétiche.
  assert.equal(refusDeLaCarte(contexte({}, { categorie: 'Sport' }), 'plume'), 'La question n’est pas de ta catégorie fétiche, Histoire')
  assert.equal(refusDeLaCarte(contexte({ fetiche: undefined }), 'plume'), 'Tu n’as pas de catégorie fétiche')
  // Un indice sur un vrai ou faux répondrait à sa place ; la Prédiction veut des nombres ; Lucidité, une réponse effacée.
  const vraiFaux = contexte({ tour: { phase: 'question', inspiration: 3, jouees: [], surLaQuestion: [] } }, { tiree: 'vrai-faux', forme: 'vrai-faux', reponses: 2 })
  assert.equal(refusDeLaCarte(vraiFaux, 'coup-d-oeil'), 'Pas sur un vrai ou faux : elle répondrait à ta place')
  assert.equal(refusDeLaCarte(enQuestion, 'prediction'), 'La Prédiction se joue sur une année ou un nombre')
  assert.equal(refusDeLaCarte(enQuestion, 'lucidite'), 'Aucune réponse effacée sur cette question')
  const effacee = contexte({ tour: { phase: 'question', inspiration: 2, jouees: ['coup-d-oeil'], surLaQuestion: ['coup-d-oeil'] } })
  assert.equal(refusDeLaCarte(effacee, 'lucidite'), null)
  const deux = contexte({ tour: { phase: 'question', inspiration: 2, jouees: ['sagesse'], surLaQuestion: ['sagesse'] } })
  assert.equal(refusDeLaCarte(deux, 'coup-d-oeil'), 'Il ne reste plus rien à effacer', 'jamais plus que deux de moins que ses réponses')
  assert.equal(refusDeLaCarte(contexte(), 'horizon'), 'Il se joue juste après une erreur qui t’a coûté du courage')
  assert.equal(refusDeLaCarte(contexte({ derniereFrappe: 4 }), 'horizon'), null)
  assert.equal(refusDeLaCarte(contexte({ courage: 6 }), 'abysses'), 'Il te faut plus de 6 de courage pour le poser')
})

test('le catalogue : le paquet de départ, huit cartes par famille, les vingt-trois légendaires réécrits — chacun son coût, son moment, sa famille', () => {
  assert.deepEqual(paquetDesRencontres([]), [...PAQUET_DES_RENCONTRES].sort())
  assert.deepEqual(paquetDesRencontres(['lg:phenix', 'lg:chouette']).filter(c => !PAQUET_DES_RENCONTRES.includes(c)), ['renaissance', 'sagesse'])
  for (const j of JOKERS_DES_LEGENDAIRES) {
    const c = carteDuLegendaire(j.legendaire)
    assert.ok(c, `${j.legendaire} a sa carte`)
    assert.equal(c.cle, j.cle, 'la clé de son joker')
    assert.notEqual(c.famille, 'neutre')
  }
  assert.equal(CARTES_DES_RENCONTRES.filter(c => c.legendaire).length, LEGENDAIRES_A_JOKER.length)
  // Le jeu complet (le 19 octobre 2026) : huit cartes par famille — trois communes, trois rares, deux épiques —, là où le prototype en avait deux.
  const familles = new Map<string, string[]>()
  for (const c of CARTES_DES_RENCONTRES) if (!c.legendaire && c.famille !== 'neutre') familles.set(c.famille, [...(familles.get(c.famille) ?? []), c.rarete])
  assert.deepEqual(
    [...familles].map(([f, raretes]) => [f, ['commun', 'rare', 'epique'].map(r => raretes.filter(x => x === r).length)]),
    ['erudit', 'flambeur', 'metamorphe', 'elan', 'rempart', 'devin'].map(f => [f, [3, 3, 2]]),
    'chaque famille : trois communes, trois rares, deux épiques',
  )
  const neutres = CARTES_DES_RENCONTRES.filter(c => c.famille === 'neutre')
  assert.ok(neutres.filter(c => c.rarete === 'epique').length >= 2 && neutres.filter(c => c.rarete === 'rare').length >= 4, 'les neutres aussi ont leurs rares et leurs épiques')
  for (const c of CARTES_DES_RENCONTRES) {
    assert.ok(c.cout >= 0 && c.cout <= 2, `${c.cle} coûte 0, 1 ou 2`)
    assert.ok(/^[A-ZÀ-Ý0-9+«]/.test(c.effet) && /[.!?»]$/.test(c.effet), `${c.cle} : une phrase`)
  }
  assert.deepEqual(famillesDeLEquipee(['lg:lion', 'lg:dragon']), ['erudit', 'flambeur'])
  assert.deepEqual(famillesDeLEquipee(['lg:phenix', 'lg:salamandre']), ['rempart'], 'deux légendaires d’une famille, une famille')
})

test('une offre : trois cartes distinctes, de ses deux familles ou des neutres — jamais Concentration ni Prudence —, la même à chaque lecture', () => {
  const vues = new Map<string, number>()
  for (let n = 0; n < 400; n++) {
    const offre = offreDeCartes(`offre:${n}`, n % 7, ['erudit', 'flambeur'])
    assert.equal(offre.length, 3)
    assert.equal(new Set(offre).size, 3)
    assert.deepEqual(offreDeCartes(`offre:${n}`, n % 7, ['erudit', 'flambeur']), offre)
    for (const cle of offre) {
      const c = carteDeRencontre(cle)!
      assert.ok(['erudit', 'flambeur', 'neutre'].includes(c.famille), `${cle} est de ses familles, ou neutre`)
      assert.ok(!c.legendaire && cle !== 'concentration' && cle !== 'prudence', cle)
      vues.set(c.famille, (vues.get(c.famille) ?? 0) + 1)
    }
  }
  assert.ok((vues.get('erudit') ?? 0) > 200 && (vues.get('flambeur') ?? 0) > 200, `ses familles reviennent : ${[...vues].join(' · ')}`)
})

test('à l’échoppe, une carte se paie à sa rareté — celles que les jokers n’ont pas comprises', () => {
  assert.equal(prixDeLArticle('joker', 'banco'), PRIX_DE_L_ECHOPPE.rare, 'Banco, rare : vendue au prix d’une commune, elle était bradée')
  assert.equal(prixDeLArticle('joker', 'bibliotheque'), PRIX_DE_L_ECHOPPE.rare)
  assert.equal(prixDeLArticle('joker', 'corser'), PRIX_DE_L_ECHOPPE.commun)
  assert.equal(prixDeLArticle('joker', 'tout-ou-rien'), PRIX_DE_L_ECHOPPE.maudit)
  for (const c of CARTES_DES_RENCONTRES) {
    if (c.rarete === 'legendaire') continue
    assert.equal(prixDeLArticle('joker', c.cle), PRIX_DE_L_ECHOPPE[c.rarete], `${c.cle}, ${c.rarete}`)
  }
})

// ── Le pli ──────────────────────────────────────────────────────────────────

/** Une carte faite à la main : deux questions en bas, un coffre et une élite, une source et une question, deux questions, le campement, le gardien. */
function carte(): CarteDUnActe {
  const q = (categorie: string) => ({ theme: { categories: [categorie] }, forme: 'quatre' as const, chance: 0.7 })
  return {
    depart: ['e00', 'e01'],
    chanceDuGardien: 0.6,
    escales: [
      { id: 'e00', etage: 0, colonne: 0, sorte: 'question', ...q('Histoire'), suite: ['e10', 'e11'] },
      { id: 'e01', etage: 0, colonne: 1, sorte: 'question', ...q('Sport'), suite: ['e11'] },
      { id: 'e10', etage: 1, colonne: 0, sorte: 'coffre', suite: ['e20'] },
      { id: 'e11', etage: 1, colonne: 1, sorte: 'elite', ...q('Sport'), suite: ['e20', 'e21'] },
      { id: 'e20', etage: 2, colonne: 0, sorte: 'source', suite: ['e30'], chance: 0.6 },
      { id: 'e21', etage: 2, colonne: 1, sorte: 'question', ...q('Arts & lettres'), suite: ['e31'] },
      { id: 'e30', etage: 3, colonne: 0, sorte: 'question', ...q('Musique'), suite: ['cg'] },
      { id: 'e31', etage: 3, colonne: 1, sorte: 'question', ...q('Cinéma & séries'), suite: ['cg'] },
      { id: 'cg', etage: 6, colonne: 0, sorte: 'campement', suite: [GARDIEN] },
      { id: GARDIEN, etage: 7, colonne: 0, sorte: 'gardien', suite: [] },
    ],
  }
}

const depart = (graine: string, equipee: string[] = []): DepartDExpedition => ({
  v: 5,
  graine,
  numero: 10_000,
  gardiens: ['lg:kraken', 'lg:dragon', 'lg:oracle'],
  cartes: [carte(), carte(), carte()],
  moyen: true,
  equipee,
  invite: 'lg:licorne',
  chanceDeLaSource: 0.6,
  fetiche: 'Histoire',
})

/** Un journal qu'on écrit comme le serveur : chaque geste, puis ce que le pli demande de tirer — une question d'Histoire, facile, à quatre choix. */
class Journal {
  gestes: GesteDExpedition[] = []
  questions: QuestionPosee[] = []
  reponses = new Map<number, boolean>()
  forme: Partial<QuestionPosee> = {}
  constructor(readonly depart: DepartDExpedition) {}
  etat(): EtatDeLExpedition {
    return pliDeLExpedition(this.depart, this.gestes, this.questions, this.reponses)
  }
  private tirer() {
    const e = this.etat()
    if (!e.aTirer) return
    for (let k = 0; k < e.aTirer.combien; k++) {
      this.questions.push({ escale: e.aTirer.escale, acte: e.aTirer.acte, reponses: 4, niveau: 'facile', tiree: 'quatre', six: true, datee: true, categorie: 'Histoire', ...this.forme })
    }
  }
  geste(g: GesteDExpedition): EtatDeLExpedition {
    this.gestes.push(g)
    this.tirer()
    return this.etat()
  }
  avancer(vers: string) {
    return this.geste({ quoi: 'avancer', vers })
  }
  jouer(cle: string, extra: { categorie?: string; montre?: number } = {}) {
    const e = this.etat()
    return this.geste({ quoi: 'jouer', joker: cle, ...(e.enAttente !== null && { position: e.enAttente }), ...extra })
  }
  voir(mise = 0) {
    return this.geste({ quoi: 'voir', mise, position: this.etat().enAttente! })
  }
  repondre(juste: boolean) {
    let e = this.etat()
    assert.ok(e.enAttente !== null, 'une question attend')
    if (e.rencontre?.tour.phase === 'preparation') e = this.voir()
    this.reponses.set(e.enAttente!, juste)
    this.tirer()
    return this.etat()
  }
  prendre(cartes: string[] = []) {
    return this.geste({ quoi: 'prendre', jokers: cartes })
  }
  /** Une rencontre jusqu'à sa fin, en ne répondant que juste — l'offre laissée. */
  gagner(vers: string) {
    let e = this.avancer(vers)
    for (let n = 0; n < 30 && e.rencontre; n++) e = this.repondre(true)
    if (e.offre) e = this.prendre()
    return e
  }
}

/** Une graine où le scénario tient : cherchée parmi deux mille, jamais choisie — les tests jouent le vrai hasard du pli. */
function chercher(prefixe: string, equipee: string[], scenario: (j: Journal) => boolean): Journal {
  for (let n = 0; n < 2000; n++) {
    const j = new Journal(depart(`${prefixe}:${n}`, equipee))
    if (scenario(j)) return j
  }
  throw new Error(`aucune graine ne tient le scénario ${prefixe}`)
}

test('le départ des rencontres : tout son courage, ses écus pour miser, le paquet de départ et la carte de chaque légendaire', () => {
  const e = new Journal(depart('depart', ['lg:phenix'])).etat()
  assert.deepEqual([e.courage, e.ecus, e.rencontre, e.vies], [COURAGE_MAX, ECUS_AU_DEPART, null, 3])
  assert.deepEqual(e.paquet, paquetDesRencontres(['lg:phenix']))
})

test('une escale à question est une rencontre : ses sceaux, sa frappe, cinq cartes et trois d’inspiration ; la question attend, en préparation', () => {
  const j = new Journal(depart('rencontre'))
  const e = j.avancer('e00')
  const r = e.rencontre!
  assert.deepEqual([r.sorte, r.sceaux, r.max, r.frappe], ['question', SCEAUX_DES_RENCONTRES.question[0], SCEAUX_DES_RENCONTRES.question[0], FRAPPE_DES_RENCONTRES.question[0]])
  assert.deepEqual([r.tour.phase, r.tour.inspiration, r.main.length, r.pioche.length], ['preparation', INSPIRATION_PAR_QUESTION, CARTES_PAR_QUESTION, PAQUET_DES_RENCONTRES.length - CARTES_PAR_QUESTION])
  assert.equal(e.enAttente, 0)
  assert.deepEqual(escalesPermisesVides(e), true, 'en rencontre, la carte attend')
  // Rejoué, le même journal redonne la même main ; une autre graine, une autre.
  assert.deepEqual(j.etat().rencontre!.main, r.main)
  const mains = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(g => new Journal(depart(g)).avancer('e00').rencontre!.main.join()))
  assert.ok(mains.size > 1)
})

const escalesPermisesVides = (e: EtatDeLExpedition) => e.enAttente !== null

test('préparer : chaque carte coûte son inspiration, la Charge et la Garde s’ajoutent ; voir la question avec sa mise', () => {
  const j = chercher('preparer', [], k => {
    const m = k.avancer('e00').rencontre!.main
    return m.includes('concentration') && m.includes('prudence') && m.includes('coup-d-oeil')
  })
  let e = j.jouer('concentration')
  assert.deepEqual([e.rencontre!.tour.charge, e.rencontre!.tour.inspiration], [4, 2])
  e = j.jouer('prudence')
  assert.deepEqual([e.rencontre!.tour.garde, e.rencontre!.tour.inspiration], [5, 1])
  assert.equal(refusDuJoker(j.depart, e, 'coup-d-oeil', j.questions), 'Elle se joue pendant la question : vois-la d’abord')
  assert.equal(refusDeLaMise(e, 40), 'Il te manque 15 écus pour parier autant')
  assert.equal(refusDeLaMise(e, 12), 'Parie 0, 10, 20 ou 40 écus')
  e = j.voir(10)
  assert.deepEqual([e.rencontre!.tour.phase, e.rencontre!.tour.mise], ['question', 10])
  assert.equal(refusDuJoker(j.depart, e, 'concentration', j.questions) ?? refusDuJoker(j.depart, e, 'prudence', j.questions), e.rencontre!.main.some(c => c === 'concentration' || c === 'prudence') ? 'Elle se joue avant de voir la question' : null)
  e = j.jouer('coup-d-oeil')
  assert.deepEqual([e.rencontre!.tour.inspiration, e.rencontre!.tour.surLaQuestion], [0, ['coup-d-oeil']])
  // La vue : l'annonce et l'aperçu de ce tour.
  const vue = vueDeLaRencontre(j.depart, e, j.questions)!
  assert.deepEqual([vue.adversaire, vue.categorie, vue.apercu?.juste.brises, vue.apercu?.faux.perdu], ['Le Scribe', 'Histoire', SAVOIR_DES_MARCHES.facile + 4, 0])
  assert.equal(vue.mises, undefined, 'la question vue, la mise est dite')
})

test('en préparation, la vue dit de quoi refaire l’aperçu à chaque mise, et pourquoi une mise ne se fait pas — sans rien recopier de la règle', () => {
  const j = chercher('mises', [], k => k.avancer('e00').rencontre!.main.includes('concentration'))
  const e = j.jouer('concentration')
  const vue = vueDeLaRencontre(j.depart, e, j.questions)!
  assert.deepEqual(vue.mises, { 0: null, 10: null, 20: null, 40: 'Il te manque 15 écus pour parier autant' })
  assert.deepEqual([vue.annonce?.reponses, vue.annonce?.mots, vue.position], [4, undefined, 0])
  // L'aperçu que la page refait à la mise qu'elle choisit : la même règle que celui du serveur, qui voit la mise une fois dite.
  const a = vue.annonce!
  const aDix = apercuDuTour({ v: vue.v, tour: { charge: vue.charge, garde: vue.garde, mise: 10, jouees: vue.jouees }, pouvoirs: vue.pouvoirs, sceaux: vue.sceaux, frappe: vue.frappe, savoir: a.savoir, question: { reponses: a.reponses, forme: a.forme, categorie: a.categorie }, fetiche: 'Histoire' })
  const vu = vueDeLaRencontre(j.depart, j.voir(10), j.questions)!
  assert.deepEqual(aDix, vu.apercu)
})

test('juste : il brise ses sceaux, la mise paie, la série monte ; la main part à la défausse, un tour s’ouvre — la pioche vide, la défausse y revient', () => {
  const j = chercher('juste', [], k => k.avancer('e00').rencontre!.main.includes('concentration'))
  j.jouer('concentration')
  j.voir(10)
  let e = j.repondre(true)
  const r = e.rencontre!
  assert.equal(r.sceaux, SCEAUX_DES_RENCONTRES.question[0] - (SAVOIR_DES_MARCHES.facile + 4))
  assert.deepEqual([e.ecus, r.serie, r.questions, e.justes, e.coup?.brises, e.coup?.mise], [ECUS_AU_DEPART + 5, 1, 1, 1, 10, 5], 'juste, la mise rapporte la moitié de ce qu’elle engage')
  assert.deepEqual([r.tour.phase, r.tour.charge, r.tour.inspiration, r.main.length], ['preparation', 0, INSPIRATION_PAR_QUESTION, CARTES_PAR_QUESTION])
  assert.equal(r.pioche.length + r.main.length + r.defausse.length, PAQUET_DES_RENCONTRES.length, 'rien ne se perd : pioche, main, défausse')
  assert.equal(e.enAttente, 1)
})

test('faux : l’adversaire frappe, moins la Garde, et frappe plus fort à chaque question ; la mise est perdue, la série retombe', () => {
  const j = chercher('faux', [], k => k.avancer('e00').rencontre!.main.includes('prudence'))
  j.jouer('prudence')
  j.voir(10)
  let e = j.repondre(false)
  const premiere = FRAPPE_DES_RENCONTRES.question[0]
  assert.deepEqual([e.courage, e.ecus, e.coup?.absorbee, e.coup?.perdu], [COURAGE_MAX - Math.max(0, premiere - 5), ECUS_AU_DEPART - 10, Math.min(5, premiere), Math.max(0, premiere - 5)])
  const avant = e.courage!
  e = j.repondre(false)
  assert.equal(e.courage, avant - (premiere + FRAPPE_EN_PLUS_PAR_QUESTION), 'la deuxième erreur, sans Garde, frappe plus fort')
  assert.equal(e.rencontre!.serie, 0)
  assert.equal(e.vies, Math.ceil((e.courage! * 3) / COURAGE_MAX), 'les vies ne sont que le reflet du courage')
})

test('l’adversaire tombe : les écus de l’escale, une carte à choisir parmi trois — prise, elle rejoint le paquet ; ce qui s’épuise revient à la rencontre suivante', () => {
  const j = chercher('victoire', ['lg:lion'], k => k.avancer('e00').rencontre!.main.includes('echange'))
  j.voir()
  let e = j.jouer('echange')
  assert.deepEqual([e.rencontre!.epuisees, e.enAttente], [['echange'], 1], 'Échange : une autre question, et la carte s’épuise')
  for (let n = 0; n < 10 && e.rencontre; n++) e = j.repondre(true)
  assert.equal(e.rencontre, null)
  assert.ok(e.coup?.victoire && e.coup.victoire.ecus > 0, 'les écus de l’escale')
  assert.equal(e.offre?.jokers.length, 3)
  const prise = e.offre!.jokers[0]
  e = j.prendre([prise])
  assert.ok(e.paquet.includes(prise))
  e = j.avancer('e11')
  const tas = [...e.rencontre!.pioche, ...e.rencontre!.main]
  assert.equal(tas.length, e.paquet.length - 1, 'la rencontre suivante remélange tout le paquet — sauf le Commandement, une carte de route')
  assert.ok(tas.includes('echange'), 'Échange, épuisée, est revenue')
})

test('le gardien est une rencontre : vaincu, sa carte rejoint le paquet, l’acte suivant s’ouvre, ses cartes de route reviennent', () => {
  const j = new Journal(depart('gardien'))
  for (const vers of ['e00', 'e10', 'e20', 'e30']) {
    let e = j.avancer(vers)
    for (let n = 0; n < 12 && (e.rencontre || e.enAttente !== null); n++) e = j.repondre(true)
    if (e.offre) j.prendre()
  }
  j.avancer('cg')
  let e = j.geste({ quoi: 'camper' })
  e = j.avancer(GARDIEN)
  assert.deepEqual([e.rencontre?.sorte, e.rencontre?.sceaux], ['gardien', SCEAUX_DES_RENCONTRES.gardien[0]])
  for (let n = 0; n < 20 && e.rencontre; n++) e = j.repondre(true)
  assert.deepEqual([e.acte, e.rencontre, e.vaincus], [1, null, 1])
  assert.ok(e.paquet.includes('abysses'), 'la carte du Kraken vaincu')
  assert.ok(e.coup?.victoire, 'sa victoire se dit')
})

// ── La version 6 : la revue du 18 octobre 2026 ─────────────────────────────
// « Les bonus sont intéressants, peut-être qu'on en a trop au début, mettre des basiques seulement et obtenir des rares plus
// tard ? Ça fait beaucoup de bonus en main en même temps […] En tous cas en mettre moins quand c'est le mode facile. »

test('version 6 : la main grandit avec les actes — trois cartes à l’acte 1, quatre à l’acte 2 ; une expédition partie en version 5 en tire cinq', () => {
  assert.deepEqual(cartesDesActes(6), [3, 4, 5])
  assert.deepEqual(cartesDesActes(5), [CARTES_PAR_QUESTION, CARTES_PAR_QUESTION, CARTES_PAR_QUESTION])
  const j = new Journal({ ...depart('main-des-actes'), v: 6 })
  let e = j.avancer('e00')
  assert.deepEqual([e.rencontre!.main.length, e.rencontre!.pioche.length], [3, PAQUET_DES_RENCONTRES.length - 3])
  // Rejouée en version 5, la même graine tire cinq cartes : une expédition se rejoue telle qu'elle s'est jouée.
  assert.equal(new Journal(depart('main-des-actes')).avancer('e00').rencontre!.main.length, CARTES_PAR_QUESTION)
  // Jusqu'au gardien, vaincu ; l'acte 2 tire quatre cartes.
  for (let n = 0; n < 12 && (e.rencontre || e.enAttente !== null); n++) e = j.repondre(true)
  if (e.offre) j.prendre()
  for (const vers of ['e10', 'e20', 'e30']) {
    e = j.avancer(vers)
    for (let n = 0; n < 12 && (e.rencontre || e.enAttente !== null); n++) e = j.repondre(true)
    if (e.offre) j.prendre()
  }
  j.avancer('cg')
  j.geste({ quoi: 'camper' })
  e = j.avancer(GARDIEN)
  assert.equal(e.rencontre!.main.length, 3, 'le gardien de l’acte 1 aussi')
  for (let n = 0; n < 20 && e.rencontre; n++) e = j.repondre(true)
  assert.equal(e.acte, 1)
  e = j.avancer('e00')
  assert.equal(e.rencontre!.main.length, 4)
})

test('version 6 : les rares attendent l’acte 2 — une rencontre de l’acte 1 n’offre que des communes, une élite ou un coffre aucune maudite', () => {
  assert.deepEqual(raretesDeLOffre(6, 0, 'rencontre'), { commun: 1, rare: 0, maudit: 0 })
  assert.equal(raretesDeLOffre(6, 0, 'elite').maudit, 0)
  // Les actes 2 et 3, et toute expédition de la version 5, gardent les poids d'avant.
  for (const [v, acte] of [[6, 1], [6, 2], [5, 0]] as const) {
    assert.deepEqual(raretesDeLOffre(v, acte, 'rencontre'), { commun: 0.6, rare: 0.3, maudit: 0.1 })
  }
  for (let n = 0; n < 300; n++) {
    // Même une famille dont la commune est déjà prise passe aux neutres de sa rareté : sa rare ne revient pas par la bande.
    for (const cle of offreDeCartes(`acte-1:${n}`, n % 5, ['erudit', 'rempart'], raretesDeLOffre(6, 0, 'rencontre'), true)) {
      assert.equal(carteDeRencontre(cle)!.rarete, 'commun', cle)
    }
    for (const cle of offreDeCartes(`elite-1:${n}`, n % 5, ['flambeur', 'devin'], raretesDeLOffre(6, 0, 'elite'), true)) {
      assert.notEqual(carteDeRencontre(cle)!.rarete, 'maudit', cle)
    }
  }
  // Par le pli : la rencontre gagnée de l'acte 1, en version 6, n'offre que des communes.
  for (let n = 0; n < 40; n++) {
    const j = new Journal({ ...depart(`offre-v6:${n}`, ['lg:lion', 'lg:dragon']), v: 6 })
    let e = j.avancer('e00')
    for (let k = 0; k < 12 && e.rencontre; k++) e = j.repondre(true)
    for (const cle of e.offre?.jokers ?? []) assert.equal(carteDeRencontre(cle)!.rarete, 'commun', `${n} : ${cle}`)
  }
})

test('le courage à zéro : l’expédition est perdue — sauf sous Renaissance, qui relève à 15 une fois par expédition', () => {
  const tombe = new Journal(depart('tombe'))
  let e = tombe.avancer('e00')
  for (let n = 0; n < 20 && e.issue === 'en-route'; n++) e = tombe.repondre(false)
  assert.deepEqual([e.issue, e.courage, e.rencontre], ['perdue', 0, null])

  const releve = chercher('renaissance', ['lg:phenix'], k => k.avancer('e00').rencontre!.main.includes('renaissance'))
  e = releve.jouer('renaissance')
  assert.deepEqual(e.rencontre!.pouvoirs, ['renaissance'])
  for (let n = 0; n < 20 && e.coup?.renaissance === undefined && e.issue === 'en-route'; n++) e = releve.repondre(false)
  assert.equal(e.coup?.renaissance, true)
  assert.equal(e.courage, COURAGE_DE_LA_RENAISSANCE)
  assert.ok(!e.paquet.includes('renaissance'), 'une fois par expédition : elle quitte le paquet')
})

test('la source rend du courage, sans cartes ; le campement aussi — ou retire une carte du paquet', () => {
  const j = new Journal(depart('source'))
  let e = j.avancer('e00')
  e = j.repondre(false)
  e = j.repondre(false)
  for (let n = 0; n < 12 && e.rencontre; n++) e = j.repondre(true)
  if (e.offre) e = j.prendre()
  e = j.avancer('e10')
  if (e.offre) e = j.prendre()
  const avant = e.courage!
  e = j.avancer('e20')
  assert.deepEqual([e.rencontre, e.enAttente !== null], [null, true], 'une source se répond sans cartes')
  e = j.repondre(true)
  assert.equal(e.courage, Math.min(COURAGE_MAX, avant + COURAGE_D_UNE_SOURCE))
  e = j.avancer('e30')
  e = j.repondre(false)
  for (let n = 0; n < 12 && e.rencontre; n++) e = j.repondre(true)
  if (e.offre) e = j.prendre()
  const blesse = e.courage!
  assert.ok(blesse < COURAGE_MAX, 'blessé avant le campement')
  j.avancer('cg')
  e = j.geste({ quoi: 'camper' })
  assert.equal(e.courage, Math.min(COURAGE_MAX, blesse + COURAGE_D_UN_CAMPEMENT))
  const k = new Journal(depart('retirer'))
  for (const vers of ['e00', 'e10', 'e20', 'e30']) {
    let x = k.avancer(vers)
    for (let n = 0; n < 12 && (x.rencontre || x.enAttente !== null); n++) x = k.repondre(true)
    if (x.offre) k.prendre()
  }
  k.avancer('cg')
  e = k.geste({ quoi: 'camper', retirer: 'prudence' })
  assert.equal(e.paquet.filter(c => c === 'prudence').length, 3)
})

test('les cartes de route se jouent sur la carte, une fois par acte, et restent au paquet', () => {
  const j = new Journal(depart('route', ['lg:comete']))
  assert.deepEqual(routeDisponible(j.etat()), ['raccourci'])
  let e = j.jouer('raccourci')
  assert.deepEqual([e.route.raccourci, routeDisponible(e)], [true, []])
  assert.equal(refusDuJoker(j.depart, e, 'raccourci', j.questions), 'Déjà jouée dans cet acte : elle revient à l’acte suivant')
  assert.ok(e.paquet.includes('raccourci'))
  e = j.avancer(e.route.raccourci ? 'e10' : 'e00')
  assert.equal(e.ici, 'e10', 'le raccourci a sauté une escale')
})

test('les pouvoirs et les cartes des familles : Le trésor, Bibliothèque, Contre-attaque, Peau de feu, L’écholocation', () => {
  // Le trésor : sa mise gagnée rapporte triple — la moitié des dix écus misés, trois fois.
  const t = chercher('tresor', ['lg:dragon'], k => k.avancer('e00').rencontre!.main.includes('tresor'))
  t.jouer('tresor')
  t.voir(10)
  let e = t.repondre(true)
  assert.equal(e.ecus, ECUS_AU_DEPART + 15)
  // Peau de feu : la Garde qui prend toute la frappe donne 4 de Charge à la question suivante.
  const p = chercher('peau', ['lg:salamandre'], k => k.avancer('e00').rencontre!.main.includes('peau-de-feu'))
  p.jouer('peau-de-feu')
  e = p.repondre(false)
  assert.deepEqual([e.coup?.perdu, e.rencontre!.tour.charge], [0, 4])
  // L'écholocation : une réponse effacée à chaque question, et l'annonce sans sa chance.
  const ec = chercher('echo', ['lg:chauve-souris'], k => k.avancer('e00').rencontre!.main.includes('echolocation'))
  e = ec.jouer('echolocation')
  const vue = vueDeLaRencontre(ec.depart, e, ec.questions)!
  assert.equal(vue.annonce?.chance, undefined)
  assert.deepEqual(vue.pouvoirs, ['echolocation'])
})
