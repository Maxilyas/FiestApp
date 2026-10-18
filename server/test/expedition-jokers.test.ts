// Les jokers de l'Expédition (l'étape 2 du brief, `retours/2026-10-17/expedition.md`),
// tels que le pli les joue (`pliDeLExpedition`) : la main tirée à chaque
// question, un joker par question, la défausse rendue à l'acte suivant, les
// posés jusqu'au bout de l'acte, les offres des coffres et des élites, le
// campement qui retire un joker — et chaque joker qui fait ce qu'il dit, et
// rien de plus. Aucune main n'est choisie : une graine se cherche où le
// joker se tire, et le hasard reste celui du pli. Ce que le serveur en fait
// — l'équipée, les réponses effacées, la colonne `joker` — : `expedition.test.ts`
// et `expedition-mesure.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GARDIEN,
  carteEnJeu,
  escalesPermises,
  gardiensDe,
  indiceDeLEnigme,
  inviteDuJour,
  offreDeJokers,
  paquetDeDepart,
  pliDeLExpedition,
  refusDeLEquipee,
  refusDuJoker,
  reponsesEffacees,
  sensDeLOracle,
  type CarteDUnActe,
  type DepartDExpedition,
  type EtatDeLExpedition,
  type GesteDExpedition,
  type QuestionPosee,
} from '../../shared/expedition'
import { JOKERS_DES_LEGENDAIRES, JOKERS_SANS_LEGENDAIRE, LEGENDAIRES_A_JOKER, MAIN_MAX, PAQUET_DE_DEPART } from '../../shared/jokers'

/**
 * Une carte faite à la main, où chaque joker a de quoi jouer : deux questions
 * en bas, un coffre et une élite, une source et une question, deux questions
 * encore, le campement, le gardien.
 */
function carte(): CarteDUnActe {
  const q = (categorie: string) => ({ theme: { categories: [categorie] }, forme: 'quatre' as const, chance: 0.7 })
  return {
    depart: ['e00', 'e01'],
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
const sorteDe = (id: string) => carte().escales.find(x => x.id === id)!.sorte

const depart = (graine: string, equipee: string[] = []): DepartDExpedition => ({
  v: 2,
  graine,
  numero: 10_000,
  gardiens: ['lg:kraken', 'lg:dragon', 'lg:oracle'],
  cartes: [carte(), carte(), carte()],
  moyen: true,
  equipee,
  invite: 'lg:licorne',
  chanceDeLaSource: 0.6,
})

/** Un journal qu'on écrit comme le serveur : chaque geste, puis ce que le pli demande de tirer. */
class Journal {
  gestes: GesteDExpedition[] = []
  questions: QuestionPosee[] = []
  reponses = new Map<number, boolean>()
  /** Ce que chaque question tirée dit d'elle : quatre réponses, sauf ce que le test demande. */
  forme: Partial<QuestionPosee> = {}
  constructor(readonly depart: DepartDExpedition) {}
  etat(): EtatDeLExpedition {
    return pliDeLExpedition(this.depart, this.gestes, this.questions, this.reponses)
  }
  private tirer() {
    const e = this.etat()
    if (!e.aTirer) return
    for (let k = 0; k < e.aTirer.combien; k++) this.questions.push({ escale: e.aTirer.escale, acte: e.aTirer.acte, reponses: 4, ...this.forme })
  }
  geste(g: GesteDExpedition): EtatDeLExpedition {
    this.gestes.push(g)
    this.tirer()
    return this.etat()
  }
  avancer(vers: string) {
    return this.geste({ quoi: 'avancer', vers })
  }
  /** Joue un joker ; fait pendant une question, le geste porte sa position, comme le serveur l'écrit. */
  jouer(cle: string, extra: { categorie?: string; montre?: number } = {}) {
    const e = this.etat()
    return this.geste({ quoi: 'jouer', joker: cle, ...(e.enAttente !== null && { position: e.enAttente }), ...extra })
  }
  repondre(juste: boolean, position?: number) {
    const e = this.etat()
    assert.ok(e.enAttente !== null, 'une question attend')
    this.reponses.set(position ?? e.enAttente!, juste)
    this.tirer()
    return this.etat()
  }
  prendre(jokers: string[] = []) {
    return this.geste({ quoi: 'prendre', jokers })
  }
  /** Une escale, et sa question jugée — l'offre d'une élite passée. */
  passer(vers: string, juste = true) {
    let e = this.avancer(vers)
    if (e.enAttente !== null) e = this.repondre(juste)
    if (e.offre) e = this.prendre()
    return e
  }
  /** Le gardien, en ne répondant que juste. */
  vaincre() {
    let e = this.avancer(GARDIEN)
    while (e.gardien) e = this.repondre(true)
    return e
  }
}

/** Une graine où le scénario tient : cherchée parmi trois mille, jamais choisie — les tests jouent le vrai hasard du pli. */
function chercher(prefixe: string, equipee: string[], scenario: (j: Journal) => boolean, forme: Partial<QuestionPosee> = {}): Journal {
  for (let n = 0; n < 3000; n++) {
    const j = new Journal(depart(`${prefixe}:${n}`, equipee))
    j.forme = forme
    if (scenario(j)) return j
  }
  throw new Error(`aucune graine ne tient le scénario ${prefixe}`)
}

/** Le joker en main à la première question (e00) — un joker de l'équipée, ou du paquet de départ. */
const enMainDEntree = (cle: string, equipee: string[] = [], forme: Partial<QuestionPosee> = {}) => chercher(cle, equipee, j => j.avancer('e00').main.includes(cle), forme)

/** Un joker sans légendaire : offert par le coffre (e10), pris, puis tiré à la source ou à la question d'après (e30), qui attend. */
const enMainDuCoffre = (cle: string) =>
  chercher(cle, [], j => {
    j.passer('e00')
    if (!j.avancer('e10').offre?.jokers.includes(cle)) return false
    j.prendre([cle])
    j.passer('e20')
    return j.avancer('e30').main.includes(cle)
  })

test('le paquet de départ et l’équipée ; la main tire à chaque question, trois au plus ; rejoué, le même journal redonne la même main', () => {
  assert.deepEqual(paquetDeDepart([]), [...PAQUET_DE_DEPART].sort())
  assert.deepEqual(paquetDeDepart(['lg:phenix', 'lg:chouette']), ['coup-d-oeil', 'coup-d-oeil', 'coup-d-oeil', 'echange', 'renaissance', 'sagesse'])
  const j = new Journal(depart('main', ['lg:phenix']))
  assert.deepEqual([j.etat().paquet.length, j.etat().main.length], [5, 0], 'rien en main avant la première question')
  let e = j.avancer('e00')
  assert.deepEqual([e.main.length, e.paquet.length], [1, 4], 'une question, un joker tiré')
  e = j.repondre(true)
  e = j.avancer('e11')
  e = j.repondre(true)
  assert.equal(e.main.length, 2)
  assert.ok(e.offre, 'une élite trouvée offre un joker')
  e = j.prendre()
  e = j.passer('e21')
  e = j.avancer('e31')
  assert.equal(e.main.length, MAIN_MAX)
  e = j.repondre(true)
  e = j.avancer('cg')
  e = j.geste({ quoi: 'camper' })
  e = j.avancer(GARDIEN)
  assert.equal(e.main.length, MAIN_MAX, 'trois au plus : la main pleine ne tire plus')
  // Rejoué, le même journal : la même main, le même paquet — recharger ne retire rien.
  const encore = pliDeLExpedition(j.depart, [...j.gestes], [...j.questions], new Map(j.reponses))
  assert.deepEqual([encore.main, encore.paquet], [e.main, e.paquet])
  const mains = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(g => new Journal(depart(g, ['lg:phenix'])).avancer('e00').main.join()))
  assert.ok(mains.size > 1, 'une autre graine, une autre main')
})

test('un joker par question ; joué, il part à la défausse, qui ne revient qu’à l’acte suivant ; les posés finissent avec l’acte ; vaincu, le gardien glisse son joker', () => {
  const j = enMainDEntree('echange', ['lg:phenix'])
  let e = j.jouer('echange')
  assert.deepEqual([e.joue?.joker, e.defausse], ['echange', ['echange']])
  e = j.repondre(true)
  const total = e.main.length + e.paquet.length + e.defausse.length
  e = j.passer('e10')
  e = j.passer('e20')
  e = j.passer('e30')
  e = j.avancer('cg')
  e = j.geste({ quoi: 'camper' })
  assert.ok(e.defausse.includes('echange'), 'la défausse attend l’acte suivant')
  e = j.vaincre()
  assert.equal(e.acte, 1)
  assert.deepEqual(e.defausse, [], 'la défausse est revenue au paquet')
  assert.ok(e.paquet.includes('echange') || e.main.includes('echange'))
  assert.ok(e.paquet.includes('abysses') || e.main.includes('abysses'), 'Remonter des abysses, le joker du Kraken vaincu')
  assert.equal(e.main.length + e.paquet.length, total + 1, 'la défausse rendue, et le joker du gardien')

  // Posé, un joker agit jusqu'au bout de l'acte, puis rejoint la défausse — et le paquet de l'acte suivant.
  const k = enMainDEntree('aube', ['lg:scarabee'])
  e = k.jouer('aube')
  assert.deepEqual(e.poses, ['aube'])
  assert.equal(refusDuJoker(k.depart, e, 'aube', k.questions), 'Ce joker n’est plus dans ta main : recharge la page')
  e = k.repondre(true)
  e = k.passer('e10')
  e = k.passer('e20')
  e = k.passer('e30')
  e = k.avancer('cg')
  e = k.geste({ quoi: 'camper' })
  assert.deepEqual(e.poses, ['aube'], 'jusqu’au bout de l’acte')
  e = k.vaincre()
  assert.deepEqual(e.poses, [], 'il finit avec l’acte')
  assert.ok(e.paquet.includes('aube') || e.main.includes('aube'))
})

test('un coffre offre trois jokers sans légendaire, une élite trouvée aussi ; on en prend un, ou rien ; ratée, l’élite n’offre rien', () => {
  for (let n = 0; n < 200; n++) {
    const offre = offreDeJokers(`offre:${n}`, n % 5)
    assert.equal(new Set(offre).size, 3, 'trois jokers distincts')
    assert.ok(offre.every(cle => JOKERS_SANS_LEGENDAIRE.some(x => x.cle === cle)), 'jamais un joker de légendaire')
  }
  assert.deepEqual(offreDeJokers('graine', 2), offreDeJokers('graine', 2), 'du hasard de la graine et du rang')
  const j = new Journal(depart('coffre'))
  j.passer('e00')
  let e = j.avancer('e10')
  assert.deepEqual([e.offre?.jokers.length, e.offre?.aPrendre], [3, 1])
  assert.deepEqual(escalesPermises(j.depart, e), [], 'une offre attend : il prend avant d’avancer')
  const voulu = e.offre!.jokers[1]
  e = j.prendre([voulu, e.offre!.jokers[2]])
  assert.equal(e.offre, null)
  assert.ok(e.paquet.includes(voulu), 'le joker choisi rejoint le paquet')
  assert.equal(e.paquet.length + e.main.length, 5, 'un seul, même si l’on en demande deux')

  const k = new Journal(depart('elite'))
  k.passer('e01')
  k.avancer('e11')
  e = k.repondre(false)
  assert.deepEqual([e.offre, e.vies], [null, 2], 'ratée, une vie, et rien')
})

test('au campement : une vie, ou un joker retiré de son paquet', () => {
  const jusquAuCampement = (j: Journal) => {
    j.passer('e00', false)
    j.passer('e11')
    j.passer('e21')
    j.passer('e31')
    return j.avancer('cg')
  }
  const k = new Journal(depart('camp'))
  let e = jusquAuCampement(k)
  assert.deepEqual([e.campement, e.vies], [true, 2])
  assert.deepEqual(escalesPermises(k.depart, e), [], 'il choisit avant le gardien')
  const tous = e.paquet.length + e.main.length + e.defausse.length
  e = k.geste({ quoi: 'camper', retirer: 'coup-d-oeil' })
  assert.deepEqual([e.campement, e.vies], [false, 2])
  assert.equal(e.paquet.length + e.main.length + e.defausse.length, tous - 1, 'un Coup d’œil de moins')
  assert.deepEqual(escalesPermises(k.depart, e), [GARDIEN])
  const l = new Journal(depart('camp'))
  jusquAuCampement(l)
  assert.equal(l.geste({ quoi: 'camper' }).vies, 3, 'ou une vie')
})

test('les jokers des vies : Sursis, Tout ou rien, La mue, Le réveil, L’horizon', () => {
  // Sursis : ratée, elle ne coûte rien.
  let j = enMainDuCoffre('sursis')
  j.jouer('sursis')
  assert.equal(j.repondre(false).vies, 3)
  // Tout ou rien : ratée quand même, deux vies.
  j = enMainDuCoffre('tout-ou-rien')
  j.jouer('tout-ou-rien')
  assert.equal(j.repondre(false).vies, 1)
  // La mue : une autre question de la même escale, qui ne coûte pas de vie si elle est ratée.
  j = enMainDEntree('mue', ['lg:serpent'])
  const avant = j.etat().enAttente!
  let e = j.jouer('mue')
  assert.equal(e.enAttente, avant + 1, 'une autre question, au rang suivant')
  assert.equal(j.questions[avant + 1].escale, j.questions[avant].escale, 'de la même escale')
  e = j.repondre(false)
  assert.deepEqual([e.vies, e.passees], [3, avant + 2], 'celle d’avant ne se pose plus')
  // Le réveil et L'horizon ne se jouent pas pour rien.
  j = enMainDEntree('reveil', ['lg:coq'])
  assert.equal(refusDuJoker(j.depart, j.etat(), 'reveil', j.questions), 'Tu as déjà tes trois vies')
  j = enMainDEntree('horizon', ['lg:trou-noir'])
  assert.equal(refusDuJoker(j.depart, j.etat(), 'horizon', j.questions), 'L’horizon se joue juste après une erreur qui t’a coûté une vie')
})

test('L’horizon rend la vie de l’erreur et vide le prochain coffre ; Le réveil rend une vie', () => {
  const j = chercher('horizon', ['lg:trou-noir', 'lg:coq'], k => {
    k.passer('e01', false)
    if (!k.avancer('e11').main.includes('horizon')) return false
    k.jouer('horizon')
    k.repondre(false)
    return k.avancer('e21').main.includes('reveil')
  })
  let e = j.etat()
  assert.deepEqual([e.vies, e.coffreVide], [2, true], 'l’erreur de e01 rendue, puis celle de l’élite')
  e = j.jouer('reveil')
  assert.equal(e.vies, 3)
  e = j.repondre(true)
  j.passer('e31')
  j.avancer('cg')
  j.geste({ quoi: 'camper' })
  e = j.vaincre()
  assert.equal(e.acte, 1)
  j.passer('e00')
  e = j.avancer('e10')
  assert.deepEqual(e.offre, { jokers: [], aPrendre: 0 }, 'L’horizon a vidé le coffre suivant')
  e = j.prendre()
  assert.deepEqual([e.coffreVide, e.offre], [false, null])
})

test('les jokers posés : Renaissance, Peau de feu, L’aube, Remonter des abysses', () => {
  // Renaissance : la dernière vie perdue, il renaît avec une — une fois.
  let j = enMainDEntree('renaissance', ['lg:phenix'])
  let e = j.jouer('renaissance')
  e = j.repondre(false)
  e = j.passer('e11', false)
  e = j.passer('e21', false)
  assert.deepEqual([e.issue, e.vies], ['en-route', 1], 'il renaît')
  assert.ok(!e.poses.includes('renaissance') && e.defausse.includes('renaissance'), 'une fois, puis la défausse')
  e = j.passer('e31', false)
  assert.equal(e.issue, 'perdue')

  // Peau de feu : sur sa dernière vie, sa première erreur ne coûte rien.
  j = enMainDEntree('peau-de-feu', ['lg:salamandre'])
  j.jouer('peau-de-feu')
  assert.equal(j.repondre(false).vies, 2, 'pas sur sa dernière vie : l’erreur coûte')
  assert.equal(j.passer('e11', false).vies, 1)
  e = j.passer('e21', false)
  assert.equal(e.vies, 1, 'sur sa dernière vie, la première erreur ne coûte rien')
  assert.ok(e.defausse.includes('peau-de-feu'))
  assert.equal(j.passer('e31', false).issue, 'perdue', 'la seconde, si')

  // L'aube : l'acte fini sans erreur depuis qu'elle est posée rend une vie — ni source ni campement pour la rendre ici.
  const jusquAuBout = (k: Journal, poserAvant: boolean) => {
    k.repondre(false)
    k.avancer('e11')
    if (poserAvant) k.jouer('aube')
    k.repondre(true)
    k.prendre()
    k.passer('e21')
    k.passer('e31')
    k.avancer('cg')
    k.geste({ quoi: 'camper', retirer: 'coup-d-oeil' })
    return k.vaincre()
  }
  e = jusquAuBout(enMainDEntree('aube', ['lg:scarabee']), true)
  assert.deepEqual([e.acte, e.vies], [1, 3], 'sans erreur depuis qu’elle est posée : une vie de plus')
  e = jusquAuBout(enMainDEntree('aube', ['lg:scarabee']), false)
  assert.equal(e.vies, 2, 'jamais posée : rien')

  // Remonter des abysses : le poser coûte une vie ; sur la dernière, trois bonnes réponses d'affilée en rendent une.
  j = enMainDEntree('abysses', ['lg:kraken'])
  e = j.jouer('abysses')
  assert.deepEqual([e.vies, e.poses], [2, ['abysses']], 'le poser coûte une vie')
  e = j.repondre(false)
  assert.equal(e.vies, 1)
  j.passer('e11')
  assert.equal(j.passer('e21').vies, 1)
  e = j.passer('e31')
  assert.equal(e.vies, 2, 'trois bonnes réponses sur sa dernière vie en rendent une')
  assert.equal(refusDuJoker(j.depart, { ...e, vies: 1, main: ['abysses'], poses: [] }, 'abysses', j.questions), 'Il te faut deux vies pour le poser : il en coûte une')
})

test('les jokers des questions : Échange, Deux visages, Passe-muraille, La pioche, Le feu d’artifice', () => {
  // Échange : une autre question de la même escale, sans tirer de joker de plus ; un seul joker par question.
  let j = enMainDEntree('echange')
  const i = j.etat().enAttente!
  const main = j.etat().main.length
  let e = j.jouer('echange')
  assert.deepEqual([e.enAttente, e.main.length, e.joue?.joker], [i + 1, main - 1, 'echange'])
  e = j.repondre(true)
  assert.deepEqual([e.justes, e.passees], [1, i + 2])

  // Deux visages : deux questions, au choix — il répond à l'une, l'autre ne se pose pas.
  j = enMainDEntree('deux-visages', ['lg:janus'])
  const a = j.etat().enAttente!
  e = j.jouer('deux-visages')
  assert.deepEqual([e.enAttente, e.autre, j.questions.length], [a, a + 1, a + 2], 'l’autre question est tirée')
  e = j.repondre(true, a + 1)
  assert.deepEqual([e.enAttente, e.autre, e.passees, e.justes], [null, null, a + 2, 1])

  // Passe-muraille : traversée — ni vie perdue, ni bonne réponse ; le serveur l'écrit comme ratée.
  j = enMainDEntree('passe-muraille', ['lg:fantome'])
  j.jouer('passe-muraille')
  e = j.repondre(false)
  assert.deepEqual([e.vies, e.justes, e.enAttente], [3, 0, null])

  // La pioche : deux jokers de plus, à la place du joker de cette question.
  j = enMainDuCoffre('pioche')
  const avant = j.etat()
  e = j.jouer('pioche')
  assert.equal(e.main.length, Math.min(MAIN_MAX, avant.main.length - 1 + 2, avant.main.length - 1 + avant.paquet.length))
  assert.equal(refusDuJoker(j.depart, e, e.main[0], j.questions), 'Un seul joker par question')

  // Le feu d'artifice : toute la défausse revient au paquet — pas lui.
  j = enMainDEntree('feu-d-artifice', ['lg:bouquet'])
  assert.equal(refusDuJoker(j.depart, j.etat(), 'feu-d-artifice', j.questions), 'Ta défausse est vide')
  j = chercher('artifice', ['lg:bouquet'], k => {
    k.avancer('e00')
    if (!k.etat().main.includes('coup-d-oeil')) return false
    k.jouer('coup-d-oeil')
    k.repondre(true)
    return k.avancer('e11').main.includes('feu-d-artifice')
  })
  e = j.jouer('feu-d-artifice')
  assert.deepEqual(e.defausse, ['feu-d-artifice'])
  assert.ok(e.paquet.includes('coup-d-oeil'), 'le Coup d’œil joué est revenu au paquet')
})

test('les jokers de carte : Le détour, Le raccourci, Le Commandement, Il connaît la maison — jamais pendant une question', () => {
  // Le détour : n'importe quelle escale de l'étage du dessus.
  let j = chercher('detour', [], k => {
    k.passer('e00')
    if (!k.avancer('e10').offre?.jokers.includes('detour')) return false
    k.prendre(['detour'])
    return k.avancer('e20').main.includes('detour')
  })
  assert.equal(refusDuJoker(j.depart, j.etat(), 'detour', j.questions), 'Ce joker se joue sur le plan, entre deux escales')
  let e = j.repondre(true)
  assert.deepEqual(escalesPermises(j.depart, e), ['e30'])
  e = j.jouer('detour')
  assert.deepEqual(escalesPermises(j.depart, e), ['e30', 'e31'], 'n’importe quelle escale de l’étage du dessus')
  e = j.avancer('e31')
  assert.equal(e.route.detour, false, 'il a servi')

  // Le raccourci : une escale de plus, sautée sans être jouée.
  j = chercher('raccourci', ['lg:comete'], k => k.avancer('e01').main.includes('raccourci'))
  j.repondre(true)
  e = j.jouer('raccourci')
  assert.deepEqual(escalesPermises(j.depart, e).sort(), ['e20', 'e21'], 'de e01, par e11, sans la jouer')
  e = j.avancer('e21')
  assert.deepEqual([e.trace, e.route.raccourci], [['e01', 'e21'], false], 'l’escale sautée n’est pas passée')

  // Le Commandement : la catégorie de l'escale suivante.
  j = chercher('lion', ['lg:lion'], k => k.avancer('e01').main.includes('commandement'))
  e = j.repondre(true)
  assert.equal(refusDuJoker(j.depart, e, 'commandement', j.questions, { categorie: 'Cuisine imaginaire' }), 'Choisis une des douze catégories')
  e = j.jouer('commandement', { categorie: 'Cuisine' })
  assert.equal(e.route.commandement, 'Cuisine')
  e = j.avancer('e11')
  assert.deepEqual([e.categorie, e.route.commandement], ['Cuisine', null], 'l’élite pose une question de cuisine')
  e = j.repondre(true)
  assert.equal(e.categorie, null)

  // Il connaît la maison : une question de l'étage du dessus devient une source ou un coffre, reliée à lui.
  j = chercher('maison', ['lg:renard'], k => k.avancer('e00').main.includes('maison'))
  j.repondre(true)
  j.avancer('e10')
  e = j.prendre()
  assert.deepEqual(escalesPermises(j.depart, e), ['e20'])
  e = j.jouer('maison')
  assert.equal(e.maisons.length, 1)
  const m = e.maisons[0]
  assert.deepEqual([m.vers, m.depuis], ['e21', 'e10'], 'la seule question au-dessus, dans une colonne voisine')
  assert.equal(carteEnJeu(j.depart, e)!.escales.find(x => x.id === 'e21')!.sorte, m.sorte)
  assert.deepEqual(escalesPermises(j.depart, e), ['e20', 'e21'], 'reliée à lui')
  assert.equal(sorteDe('e21'), 'question', 'la carte du départ ne bouge pas')
})

test('La boucle : sa prochaine erreur revient à la prochaine escale à question ; retrouvée, elle rend sa vie', () => {
  const j = enMainDEntree('boucle', ['lg:ouroboros'])
  let e = j.jouer('boucle')
  const ratee = e.enAttente!
  e = j.repondre(false)
  assert.equal(e.vies, 2)
  assert.deepEqual(e.boucle, { reprise: ratee, position: null })
  // Le coffre n'est pas une escale à question : elle attend la suivante.
  e = j.passer('e10')
  assert.deepEqual(e.boucle, { reprise: ratee, position: null })
  e = j.avancer('e20')
  assert.equal(e.boucle?.position, null, 'une source n’en est pas une non plus')
  e = j.repondre(true)
  e = j.avancer('e30')
  assert.equal(e.boucle?.position, e.enAttente)
  const sansElle = pliDeLExpedition(j.depart, j.gestes, j.questions.slice(0, -1), j.reponses)
  assert.equal(sansElle.aTirer?.reprise, ratee, 'le serveur repose la question ratée')
  e = j.repondre(true)
  assert.deepEqual([e.vies, e.boucle], [3, null], 'retrouvée, elle rend sa vie')
  assert.ok(e.defausse.includes('boucle'))
})

test('Trois têtes, Le trésor, L’élan : deux jokers par question et quatre en main ; deux à prendre au coffre ; un de plus après trois bonnes', () => {
  let j = enMainDEntree('trois-tetes', ['lg:chimere', 'lg:dragon'])
  let e = j.jouer('trois-tetes')
  e = j.repondre(true)
  j.passer('e11')
  e = j.avancer('e21')
  assert.equal(e.main.length, 4, 'deux par question, quatre en main')

  j = enMainDEntree('tresor', ['lg:dragon'])
  j.jouer('tresor')
  j.repondre(true)
  e = j.avancer('e10')
  assert.equal(e.offre?.aPrendre, 2)
  e = j.prendre(e.offre!.jokers.slice(0, 2))
  assert.equal(e.paquet.length + e.main.length + e.poses.length, 5 + 2, 'deux jokers pris au coffre')

  j = enMainDEntree('elan', ['lg:tigre'])
  j.jouer('elan')
  j.repondre(true)
  j.passer('e11')
  const avant = j.etat().main.length
  e = j.avancer('e21')
  const tire = e.main.length - avant
  e = j.repondre(true)
  assert.equal(e.main.length, Math.min(MAIN_MAX, avant + tire + 1), 'la troisième bonne réponse d’affilée tire un joker de plus')
})

test('un joker qui efface ou qui double ne se joue pas sur un vrai ou faux ; la Prédiction, sur une année ou un nombre', () => {
  const vraiFaux = enMainDEntree('coup-d-oeil', [], { reponses: 2 })
  assert.equal(refusDuJoker(vraiFaux.depart, vraiFaux.etat(), 'coup-d-oeil', vraiFaux.questions), 'Pas sur un vrai ou faux : il répondrait à ta place')
  const avant = vraiFaux.etat()
  const apres = vraiFaux.jouer('coup-d-oeil')
  assert.deepEqual([apres.joue, apres.main], [null, avant.main], 'le pli ignore un geste refusé')
  const sagesse = enMainDEntree('sagesse', ['lg:chouette'], { reponses: 2 })
  assert.equal(refusDuJoker(sagesse.depart, sagesse.etat(), 'sagesse', sagesse.questions), 'Pas sur un vrai ou faux : il répondrait à ta place')

  const oracle = enMainDEntree('prediction', ['lg:oracle'])
  assert.equal(refusDuJoker(oracle.depart, oracle.etat(), 'prediction', oracle.questions), 'La Prédiction se joue sur une année ou un nombre')
  const annees = enMainDEntree('prediction', ['lg:oracle'], { nombre: true })
  assert.equal(refusDuJoker(annees.depart, annees.etat(), 'prediction', annees.questions, { montre: 7 }), 'Montre une des réponses à l’Oracle')
  assert.equal(refusDuJoker(annees.depart, annees.etat(), 'prediction', annees.questions, { montre: 2 }), null)
})

test('un joker posé juste après une réponse se compte après elle : L’aube ne pardonne pas l’erreur d’avant', () => {
  const apres = enMainDEntree('aube', ['lg:scarabee'])
  apres.repondre(false)
  // Posé sur la carte, après l'erreur : elle ne compte pas contre lui.
  assert.equal(apres.jouer('aube').aube, true, 'l’erreur d’avant ne l’éteint pas')
  // Posé pendant la question, avant sa réponse ratée : elle l'éteint.
  const avant = enMainDEntree('aube', ['lg:scarabee'])
  avant.jouer('aube')
  assert.equal(avant.repondre(false).aube, false)
})

test('un joker joué sur une question du gardien après la première reste joué une fois la question répondue', () => {
  // Le 18 octobre 2026 : le pli jugeait d'un coup toutes les questions répondues du gardien, avant le joker qui visait la
  // deuxième — rejoué après la réponse, il revenait dans la main, et Tout ou rien n'y coûtait plus qu'une vie.
  const j = chercher('gardien-vise', [], k => {
    for (const vers of ['e00', 'e10', 'e20', 'e30']) k.passer(vers)
    k.avancer('cg')
    k.geste({ quoi: 'camper' })
    k.avancer(GARDIEN)
    return k.repondre(true).main.includes('coup-d-oeil')
  })
  const deuxieme = j.etat().enAttente
  let e = j.jouer('coup-d-oeil')
  assert.deepEqual([e.joue?.joker, e.defausse], ['coup-d-oeil', ['coup-d-oeil']], 'joué sur la deuxième question')
  e = j.repondre(false)
  assert.ok(e.enAttente !== deuxieme, 'la question est passée')
  assert.deepEqual(e.defausse, ['coup-d-oeil'], 'répondue, la question garde son joker : il ne revient pas dans la main')
  assert.equal(e.gardien?.ratees, 1)

  // Tout ou rien sur la deuxième : ratée, deux vies — pas une, comme si rien n'avait été joué.
  const t = chercher('gardien-tout-ou-rien', [], k => {
    k.passer('e00')
    if (!k.avancer('e10').offre?.jokers.includes('tout-ou-rien')) return false
    k.prendre(['tout-ou-rien'])
    for (const vers of ['e20', 'e30']) k.passer(vers)
    k.avancer('cg')
    k.geste({ quoi: 'camper' })
    k.avancer(GARDIEN)
    return k.repondre(true).main.includes('tout-ou-rien')
  })
  const vies = t.etat().vies
  t.jouer('tout-ou-rien')
  assert.equal(t.repondre(false).vies, vies - 2)
})

test('l’invité du jour, le même pour tous ; l’équipée : deux des siens au plus, ou l’invité ; jamais un gardien', () => {
  assert.equal(inviteDuJour('2026-10-17'), inviteDuJour('2026-10-17'))
  assert.ok(LEGENDAIRES_A_JOKER.includes(inviteDuJour('2026-10-17')))
  const invites = new Set(Array.from({ length: 40 }, (_, k) => inviteDuJour(`2026-11-${k}`)))
  assert.ok(invites.size > 5, 'il change d’un jour à l’autre')
  const siens = new Set(['lg:phenix', 'lg:chouette', 'lg:lion'])
  assert.equal(refusDeLEquipee(['lg:phenix', 'lg:chouette'], siens, 'lg:janus'), null)
  assert.equal(refusDeLEquipee(['lg:phenix', 'lg:janus'], siens, 'lg:janus'), null, 'l’invité part sans être à lui')
  assert.equal(refusDeLEquipee(['lg:phenix', 'lg:chouette', 'lg:lion'], siens, 'lg:janus'), 'Ton équipe tient 2 légendaires : laisses-en un')
  assert.equal(refusDeLEquipee(['lg:dragon'], siens, 'lg:janus'), 'Ce légendaire n’est pas à toi : seul l’invité du jour part sans être à toi')
  assert.equal(refusDeLEquipee(['lg:phenix', 'lg:phenix'], siens, 'lg:janus'), 'Un légendaire ne part qu’une fois')
  for (let n = 0; n < 50; n++) {
    const invite = inviteDuJour(`jour-${n}`)
    assert.ok(!gardiensDe(`graine-${n}`, new Set(), invite).includes(invite), 'l’invité du jour ne garde aucun acte')
  }
})

test('ce que montrent les jokers d’une question : les réponses effacées, l’indice de l’Énigme, ce que dit l’Oracle', () => {
  const q = { reponses: ['A', 'B', 'C', 'D'], bonne: 2 }
  const une = reponsesEffacees('g', 4, q, 1)
  const deux = reponsesEffacees('g', 4, q, 2)
  assert.equal(une.length, 1)
  assert.ok(!une.includes(2) && !deux.includes(2), 'jamais la bonne')
  assert.ok(deux.includes(une[0]), 'celle d’un Coup d’œil reste effacée quand un autre s’y ajoute')
  assert.equal(reponsesEffacees('g', 4, q, 3).length, 2, 'deux au plus sur quatre : une de plus, et il répondrait')
  assert.deepEqual(reponsesEffacees('g', 4, { reponses: ['Vrai', 'Faux'], bonne: 0 }, 1), [])
  assert.equal(indiceDeLEnigme({ categorie: 'Histoire', date: { valeur: '1789-07-14' } }), 'Le XVIIIe siècle · Histoire')
  assert.equal(indiceDeLEnigme({ categorie: 'Histoire', date: { valeur: '-44' } }), 'Le Ier siècle av. J.-C. · Histoire')
  assert.equal(indiceDeLEnigme({ categorie: 'Histoire', date: { valeur: '1800', precision: 'siecle' } }), 'Le XIXe siècle · Histoire')
  assert.equal(indiceDeLEnigme({ categorie: 'Sport', date: null }), 'Elle ne se date pas · Sport')
  const annees = { reponses: ['1914', '1789', '1848', '1968'], bonne: 2 }
  assert.deepEqual([sensDeLOracle(annees, 1), sensDeLOracle(annees, 3), sensDeLOracle(annees, 2)], ['haut', 'bas', 'juste'])
  assert.equal(sensDeLOracle({ reponses: ['8 848 m', '6 194 m', '4 808 m', '5 895 m'], bonne: 0 }, 3), 'haut')
  assert.equal(sensDeLOracle({ reponses: ['44 av. J.-C.', '79', '410', '1453'], bonne: 0 }, 1), 'bas')
})

test('vingt-trois jokers de légendaires — vingt et un, puis la Citrouille et le Sapin avec les écus —, aucun pour un Divin ; chacun sa sorte, et ce qu’il fait', () => {
  assert.equal(JOKERS_DES_LEGENDAIRES.length, 23)
  assert.ok(LEGENDAIRES_A_JOKER.every(cle => cle.startsWith('lg:')), 'les Divins n’en ont aucun (invariant 21)')
  for (const j of [...JOKERS_DES_LEGENDAIRES, ...JOKERS_SANS_LEGENDAIRE]) {
    assert.ok(['jouer', 'poser', 'carte'].includes(j.sorte), j.cle)
    assert.ok(j.effet.length > 10, j.cle)
  }
  assert.ok(sorteDe('e00') === 'question')
})
