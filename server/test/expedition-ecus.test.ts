// Les écus de l'Expédition (l'étape 4 du brief, `retours/2026-10-17/expedition.md`),
// tels que le pli les compte (`pliDeLExpedition`) : une escale trouvée paie
// selon la chance qu'elle annonçait, un gardien vaincu, un coffre passé ;
// l'échoppe les dépense ; l'inconnu cache un marchand, un piège ou un
// légendaire de passage ; les talismans tiennent jusqu'au bout ; Quitte ou
// double triple ou coûte deux vies. Ce que le serveur en fait — les écus qui
// meurent avec l'expédition, l'inconnu qui ne part pas avant d'être dévoilé,
// la loupe — : `expedition-echoppe.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ECUS_AU_PREMIER_MOT,
  ECUS_DES_PISTES,
  ECUS_D_UNE_ELITE,
  ECUS_D_UN_COFFRE_LAISSE,
  ECUS_D_UN_GARDIEN,
  GARDIEN,
  PRIX_DE_L_ECHOPPE,
  carteDUnActe,
  contenuDeLInconnu,
  ecusDeLaReponse,
  ecusEsperes,
  legendaireDePassage,
  offreDeJokers,
  pliDeLExpedition,
  prixDeLEscale,
  refusDeLAchat,
  refusDuJoker,
  talismanDeLOffre,
  viesAuBout,
  type CarteDUnActe,
  type DepartDExpedition,
  type EtatDeLExpedition,
  type GesteDExpedition,
  type QuestionPosee,
} from '../../shared/expedition'
import { jokerDuLegendaire, JOKERS_SANS_LEGENDAIRE, TALISMANS } from '../../shared/jokers'

/**
 * Une carte faite à la main, où chaque sorte de l'étape 4 a sa place : en bas
 * une question d'Histoire verte et un thème pointu rouge ; un coffre et une
 * élite de sport bleue ; une échoppe et un inconnu ; un vrai ou faux de sport
 * noir et un dévoilement bleu ; le campement, le gardien.
 */
function carte(): CarteDUnActe {
  return {
    depart: ['e00', 'e01'],
    escales: [
      { id: 'e00', etage: 0, colonne: 0, sorte: 'question', theme: { categories: ['Histoire'] }, forme: 'quatre', chance: 0.8, suite: ['e10', 'e11'] },
      { id: 'e01', etage: 0, colonne: 1, sorte: 'question', theme: { sujet: 'annees-80' }, forme: 'quatre', chance: 0.3, suite: ['e11'] },
      { id: 'e10', etage: 1, colonne: 0, sorte: 'coffre', suite: ['e20'] },
      { id: 'e11', etage: 1, colonne: 1, sorte: 'elite', theme: { categories: ['Sport'] }, forme: 'quatre', chance: 0.5, suite: ['e20', 'e21'] },
      { id: 'e20', etage: 2, colonne: 0, sorte: 'echoppe', suite: ['e30'] },
      { id: 'e21', etage: 2, colonne: 1, sorte: 'inconnu', suite: ['e31'] },
      { id: 'e30', etage: 3, colonne: 0, sorte: 'question', theme: { categories: ['Sport'] }, forme: 'vrai-faux', chance: 0.1, suite: ['cg'] },
      { id: 'e31', etage: 3, colonne: 1, sorte: 'question', theme: { categories: ['Musique'] }, forme: 'devoilement', chance: 0.6, suite: ['cg'] },
      { id: 'cg', etage: 6, colonne: 0, sorte: 'campement', suite: [GARDIEN] },
      { id: GARDIEN, etage: 7, colonne: 0, sorte: 'gardien', suite: [] },
    ],
  }
}

const depart = (graine: string, v: DepartDExpedition['v'] = 4, equipee: string[] = []): DepartDExpedition => ({
  v,
  graine,
  numero: 10_000,
  gardiens: ['lg:kraken', 'lg:dragon', 'lg:oracle'],
  cartes: [carte(), carte(), carte()],
  moyen: true,
  equipee,
  invite: 'lg:licorne',
  chanceDeLaSource: 0.6,
})

/** Un journal qu'on écrit comme le serveur : chaque geste, puis ce que le pli demande de tirer — chaque question dit sa catégorie et sa forme. */
class Journal {
  gestes: GesteDExpedition[] = []
  questions: QuestionPosee[] = []
  reponses = new Map<number, boolean>()
  constructor(readonly depart: DepartDExpedition) {}
  etat(): EtatDeLExpedition {
    return pliDeLExpedition(this.depart, this.gestes, this.questions, this.reponses)
  }
  private tirer() {
    const e = this.etat()
    if (!e.aTirer) return
    const escale = this.depart.cartes[e.aTirer.acte].escales.find(x => x.id === e.aTirer!.escale)
    const theme = escale?.theme
    const categorie = e.aTirer.categorie ?? (theme && 'categories' in theme ? theme.categories[0] : 'Culture générale')
    for (let k = 0; k < e.aTirer.combien; k++) {
      this.questions.push({
        escale: e.aTirer.escale,
        acte: e.aTirer.acte,
        reponses: escale?.forme === 'vrai-faux' ? 2 : escale?.forme === 'six' ? 6 : 4,
        categorie,
        ...(escale?.forme && escale.forme !== 'quatre' && { forme: escale.forme }),
      })
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
  jouer(cle: string, extra: { categorie?: string } = {}) {
    const e = this.etat()
    return this.geste({ quoi: 'jouer', joker: cle, ...(e.enAttente !== null && { position: e.enAttente }), ...extra })
  }
  /** Une réponse ; un dévoilement dit à quel mot elle arrive, comme le serveur le relit de son heure. */
  repondre(juste: boolean, devoile?: { mots: number; sur: number }) {
    const e = this.etat()
    assert.ok(e.enAttente !== null, 'une question attend')
    if (devoile) this.questions[e.enAttente!] = { ...this.questions[e.enAttente!], devoile }
    this.reponses.set(e.enAttente!, juste)
    this.tirer()
    return this.etat()
  }
  prendre(jokers: string[] = [], talisman?: string) {
    return this.geste({ quoi: 'prendre', jokers, ...(talisman && { talisman }) })
  }
  acheter(article: 'vie' | 'joker' | 'talisman' | 'retirer', joker?: string) {
    return this.geste({ quoi: 'acheter', article, ...(joker && { joker }) })
  }
  vaincre() {
    let e = this.avancer(GARDIEN)
    while (e.gardien) e = this.repondre(true)
    return e
  }
}

/** Une graine où le scénario tient : cherchée, jamais choisie — les tests jouent le vrai hasard du pli. */
function chercher(prefixe: string, scenario: (j: Journal) => boolean, v: DepartDExpedition['v'] = 4, equipee: string[] = []): Journal {
  for (let n = 0; n < 3000; n++) {
    const j = new Journal(depart(`${prefixe}:${n}`, v, equipee))
    if (scenario(j)) return j
  }
  throw new Error(`aucune graine ne tient le scénario ${prefixe}`)
}

test('les écus d’une escale : la couleur de sa chance, doublés sur un thème pointu, divisés par deux en vrai ou faux', () => {
  assert.deepEqual(
    [0.9, 0.6, 0.3, 0.1].map(chance => ecusDeLaReponse({ chance })),
    [ECUS_DES_PISTES.verte, ECUS_DES_PISTES.bleue, ECUS_DES_PISTES.rouge, ECUS_DES_PISTES.noire],
    'verte, bleue, rouge, noire',
  )
  assert.equal(ecusDeLaReponse({ chance: 0.3, sujet: true }), 2 * ECUS_DES_PISTES.rouge)
  assert.equal(ecusDeLaReponse({ chance: 0.1, vraiFaux: true }), ECUS_DES_PISTES.noire / 2)
  assert.equal(ecusDeLaReponse({ chance: 0.6, sport: true }), 2 * ECUS_DES_PISTES.bleue, 'le maillot jaune')
  assert.equal(ecusDeLaReponse({ chance: 0.6, elite: true }), ECUS_DES_PISTES.bleue + ECUS_D_UNE_ELITE)
  assert.equal(ecusDeLaReponse({ chance: 0.6, elite: true, quitteOuDouble: true }), 3 * (ECUS_DES_PISTES.bleue + ECUS_D_UNE_ELITE), 'Quitte ou double triple le tout')
  // Ce que la carte promet, sans ce que la réponse y changera.
  const [e00, e01, , e11, , , e30] = carte().escales
  assert.deepEqual([e00, e01, e11, e30].map(prixDeLEscale), [5, 40, 35, 15])

  // Le pli les compte : une question verte, une élite bleue.
  const j = new Journal(depart('compte'))
  j.avancer('e00')
  let e = j.repondre(true)
  assert.equal(e.ecus, ECUS_DES_PISTES.verte)
  j.avancer('e11')
  e = j.repondre(true)
  assert.equal(e.ecus, ECUS_DES_PISTES.verte + ECUS_DES_PISTES.bleue + ECUS_D_UNE_ELITE)
  // Ratée, une escale ne paie rien.
  const k = new Journal(depart('compte'))
  k.avancer('e01')
  assert.equal(k.repondre(false).ecus, 0)
})

test('au dévoilement, trois fois le prix au premier mot, puis il descend jusqu’au prix de l’escale', () => {
  const bleue = ECUS_DES_PISTES.bleue
  assert.equal(ecusDeLaReponse({ chance: 0.6, devoile: { mots: 1, sur: 11 } }), ECUS_AU_PREMIER_MOT * bleue)
  assert.equal(ecusDeLaReponse({ chance: 0.6, devoile: { mots: 6, sur: 11 } }), 2 * bleue, 'à mi-chemin, deux fois')
  assert.equal(ecusDeLaReponse({ chance: 0.6, devoile: { mots: 11, sur: 11 } }), bleue, 'au dernier mot, le prix de l’escale')

  // Dans le pli : la réponse dit son mot, comme le serveur le relit de son heure.
  const j = chercher('devoile', x => {
    x.avancer('e01')
    x.repondre(true)
    x.avancer('e11')
    x.repondre(true)
    const e = x.etat()
    return !!e.offre && e.offre.jokers.length > 0
  })
  j.prendre()
  const e = j.etat()
  const avant = e.ecus
  j.avancer('e21')
  // L'inconnu peut prendre une vie ou ouvrir son échoppe : peu importe, le pas suivant mène au dévoilement.
  j.avancer('e31')
  const apres = j.repondre(true, { mots: 1, sur: 11 })
  assert.equal(apres.ecus - avant, ECUS_AU_PREMIER_MOT * bleue)
})

test('un gardien vaincu paie les siens, et un coffre passé sans rien prendre ; vide, il n’avait rien à laisser', () => {
  const j = new Journal(depart('gardien'))
  j.avancer('e00')
  j.repondre(true)
  let e = j.avancer('e10')
  assert.ok(e.offre?.coffre, 'un coffre le dit')
  e = j.prendre()
  assert.equal(e.ecus, ECUS_DES_PISTES.verte + ECUS_D_UN_COFFRE_LAISSE)
  j.avancer('e20')
  j.avancer('e30')
  j.repondre(false)
  j.avancer('cg')
  e = j.geste({ quoi: 'camper' })
  const avant = e.ecus
  e = j.vaincre()
  assert.equal(e.acte, 1)
  assert.equal(e.ecus - avant, ECUS_D_UN_GARDIEN)

  // Pris, un joker du coffre ne paie rien de plus.
  const k = new Journal(depart('gardien'))
  k.avancer('e00')
  k.repondre(true)
  const offre = k.avancer('e10').offre!
  assert.equal(k.prendre([offre.jokers[0]]).ecus, ECUS_DES_PISTES.verte)
})

test('Quitte ou double : juste, les écus de l’escale triplent ; faux, deux vies ; ni sur une source ni au gardien', () => {
  // Quitte ou double en main à la question d'après le coffre : offert, pris, tiré.
  const trouver = () =>
    chercher('qod', x => {
      x.avancer('e00')
      x.repondre(true)
      const o = x.avancer('e10').offre
      if (!o?.jokers.includes('quitte-ou-double')) return false
      x.prendre(['quitte-ou-double'])
      x.avancer('e20')
      return x.avancer('e30').main.includes('quitte-ou-double')
    })
  const j = trouver()
  const avant = j.etat().ecus
  j.jouer('quitte-ou-double')
  let e = j.repondre(true)
  assert.equal(e.ecus - avant, 3 * Math.round(ECUS_DES_PISTES.noire / 2), 'le vrai ou faux noir, triplé')
  const k = trouver()
  k.jouer('quitte-ou-double')
  e = k.repondre(false)
  assert.equal(e.vies, 1, 'deux vies')

  // Une source, le gardien ne paient pas d'écus par question.
  const sans = new Journal(depart('qod-refus'))
  const etat: EtatDeLExpedition = { ...sans.etat(), main: ['quitte-ou-double'], enAttente: 0, gardien: { trouvees: 0, ratees: 0, debut: 0 } }
  assert.match(refusDuJoker(sans.depart, etat, 'quitte-ou-double', [{ escale: GARDIEN, acte: 0, reponses: 4 }]) ?? '', /question ou une élite/)
  // Une expédition partie avant les écus ne le voit jamais dans ses offres.
  for (let rang = 0; rang < 300; rang++) assert.ok(!offreDeJokers('avant', rang, 3).includes('quitte-ou-double'))
})

test('l’échoppe : ses prix, chaque article une fois, une vie sous trois, de quoi payer — et le talisman tient jusqu’au bout', () => {
  // Assez d'écus pour tout : une élite trouvée, le coffre passé.
  const j = new Journal(depart('echoppe'))
  j.avancer('e00')
  j.repondre(true)
  j.avancer('e10')
  j.prendre()
  let e = j.avancer('e20')
  assert.ok(e.echoppe, 'l’échoppe ouvre son étal')
  assert.equal(e.echoppe!.jokers.length, 3)
  assert.ok(e.echoppe!.talisman, 'un talisman à vendre')
  const ecus = e.ecus
  assert.equal(ecus, ECUS_DES_PISTES.verte + ECUS_D_UN_COFFRE_LAISSE)
  assert.equal(refusDeLAchat(e, { article: 'vie' }), 'Tu as déjà tes trois vies')
  assert.match(refusDeLAchat(e, { article: 'talisman' }) ?? '', /^Il te manque \d+ écus$/)

  // De quoi acheter : quatre élites plus tard, sur une autre graine où tout s'achète.
  const riche = chercher('riche', x => {
    x.avancer('e00')
    x.repondre(true)
    x.avancer('e10')
    x.prendre()
    return x.avancer('e20').echoppe?.jokers.some(c => JOKERS_SANS_LEGENDAIRE.find(y => y.cle === c)?.rarete === 'commun') ?? false
  })
  // Le pli ne connaît que ses gestes : on lui donne les écus qu'un long acte aurait gagnés en relisant l'état.
  const etat = { ...riche.etat(), ecus: 200, vies: 2 }
  const commun = etat.echoppe!.jokers.find(c => JOKERS_SANS_LEGENDAIRE.find(y => y.cle === c)?.rarete === 'commun')!
  assert.equal(refusDeLAchat(etat, { article: 'vie' }), null)
  assert.equal(refusDeLAchat(etat, { article: 'joker', joker: commun }), null)
  assert.equal(refusDeLAchat(etat, { article: 'joker', joker: 'sagesse' }), 'Ce joker n’est pas à l’étal')
  assert.equal(refusDeLAchat(etat, { article: 'retirer', joker: 'coup-d-oeil' }), null)
  assert.equal(refusDeLAchat(etat, { article: 'retirer', joker: 'renaissance' }), 'Ce joker n’est pas dans ton paquet')
  assert.equal(refusDeLAchat({ ...etat, echoppe: { ...etat.echoppe!, achats: ['vie'] } }, { article: 'vie' }), 'Une vie par échoppe')
  assert.equal(refusDeLAchat({ ...etat, echoppe: null }, { article: 'vie' }), 'Il n’y a pas d’échoppe ici')
  assert.deepEqual(PRIX_DE_L_ECHOPPE, { vie: 40, commun: 20, rare: 35, maudit: 15, talisman: 50, retirer: 15, fiole: 25 })
})

test('acheter, dans le pli : les écus se dépensent, l’article arrive, et le talisman reste jusqu’au bout de l’expédition', () => {
  const communDe = (e: EtatDeLExpedition) => e.echoppe?.jokers.find(c => JOKERS_SANS_LEGENDAIRE.find(y => y.cle === c)?.rarete === 'commun')
  // Une graine où l'élite offre un talisman — il se prend à la place d'un joker — et où l'échoppe d'après vend un commun.
  const trouvee = chercher('talisman', x => {
    x.avancer('e00')
    x.repondre(true)
    x.avancer('e11')
    const offre = x.repondre(true).offre
    if (offre?.talisman === undefined) return false
    x.prendre([offre.jokers[0]], offre.talisman)
    return communDe(x.avancer('e20')) !== undefined
  })
  // Rejouée pas à pas.
  const j = new Journal(trouvee.depart)
  j.avancer('e00')
  j.repondre(true)
  j.avancer('e11')
  const offre = j.repondre(true).offre!
  const jokers = (x: EtatDeLExpedition) => x.paquet.length + x.main.length + x.defausse.length + x.poses.length
  const avant = jokers(j.etat())
  let e = j.prendre([offre.jokers[0]], offre.talisman)
  assert.deepEqual(e.talismans, [offre.talisman])
  assert.equal(jokers(e), avant, 'pas de joker avec lui : il en prend la place')
  e = j.avancer('e20')
  const ecus = e.ecus
  assert.equal(ecus, ECUS_DES_PISTES.verte + ECUS_DES_PISTES.bleue + ECUS_D_UNE_ELITE)
  const commun = communDe(e)!
  e = j.acheter('joker', commun)
  assert.equal(e.ecus, ecus - PRIX_DE_L_ECHOPPE.commun)
  assert.ok(e.paquet.includes(commun) || e.main.includes(commun))
  assert.deepEqual(e.echoppe!.achats, [commun])
  // Le même deux fois : le pli l'ignore, comme le serveur le refuse.
  assert.equal(j.acheter('joker', commun).ecus, ecus - PRIX_DE_L_ECHOPPE.commun)
  // Un achat garde le prix payé, que le journal écrit : un barème changé ne le refait pas.
  const k = new Journal(trouvee.depart)
  k.gestes = j.gestes.slice(0, -2)
  k.questions = j.questions
  k.reponses = j.reponses
  assert.equal(k.geste({ quoi: 'acheter', article: 'joker', joker: commun, prix: 7 }).ecus, ecus - 7, 'au prix que le journal garde')
  // En avançant, l'échoppe se quitte ; le talisman reste, acte après acte.
  e = j.avancer('e30')
  assert.equal(e.echoppe, null)
  j.repondre(true)
  j.avancer('cg')
  j.geste({ quoi: 'camper' })
  e = j.vaincre()
  assert.equal(e.acte, 1)
  assert.deepEqual(e.talismans, [offre.talisman], 'un talisman tient jusqu’au bout')
})

test('l’inconnu : un marchand ouvre son échoppe, un piège prend une vie, un légendaire de passage prête son joker jusqu’au bout de l’acte', () => {
  // Les trois contenus existent, à parts égales, du hasard de la graine et de l'escale.
  const parts = { marchand: 0, piege: 0, passage: 0 }
  for (let n = 0; n < 3000; n++) parts[contenuDeLInconnu(`p:${n}`, 0, 'e21')]++
  for (const [quoi, n] of Object.entries(parts)) assert.ok(n > 850 && n < 1150, `${quoi} : ${n} sur 3000`)

  const jusquALInconnu = (contenu: string) =>
    chercher(`inconnu-${contenu}`, x => {
      if (contenuDeLInconnu(x.depart.graine, 0, 'e21') !== contenu) return false
      x.avancer('e01')
      x.repondre(true)
      x.avancer('e11')
      x.repondre(true)
      x.prendre()
      return true
    })

  const marchand = jusquALInconnu('marchand')
  let e = marchand.avancer('e21')
  assert.deepEqual(e.inconnu, { contenu: 'marchand' })
  assert.ok(e.echoppe, 'le marchand ouvre son échoppe')

  const piege = jusquALInconnu('piege')
  const vies = piege.etat().vies
  e = piege.avancer('e21')
  assert.deepEqual(e.inconnu, { contenu: 'piege' })
  assert.equal(e.vies, vies - 1)

  const passage = jusquALInconnu('passage')
  e = passage.avancer('e21')
  const legendaire = legendaireDePassage(passage.depart.graine, 0, 'e21', [])
  assert.deepEqual(e.inconnu, { contenu: 'passage', legendaire })
  const sonJoker = jokerDuLegendaire(legendaire)!.cle
  assert.ok(e.main.includes(sonJoker), 'son joker est dans la main')
  assert.deepEqual(e.passages, [sonJoker])
  // Au bout de l'acte, il s'en va — joué ou non.
  e = passage.avancer('e31')
  passage.repondre(true)
  passage.avancer('cg')
  passage.geste({ quoi: 'camper' })
  e = passage.vaincre()
  const partout = [...e.main, ...e.paquet, ...e.defausse, ...e.poses]
  // Le gardien vaincu, le Kraken, glisse le sien : seul lui peut rester.
  assert.equal(partout.filter(c => c === sonJoker).length, jokerDuLegendaire('lg:kraken')?.cle === sonJoker ? 1 : 0, 'il quitte l’expédition avec l’acte')
  assert.deepEqual(e.passages, [])
})

test('un joker de passage retiré s’en va seul : le même, glissé par un gardien, reste', () => {
  // Le Kraken, vaincu à l'acte 1, glisse son joker ; à l'acte 2, l'inconnu prête le même. En retirer un au
  // campement retire celui de passage : au bout de l'acte, celui du gardien reste — il partait avec l'autre.
  const kraken = jokerDuLegendaire('lg:kraken')!.cle
  const j = chercher('passage-retire', x => {
    if (contenuDeLInconnu(x.depart.graine, 1, 'e21') !== 'passage') return false
    if (legendaireDePassage(x.depart.graine, 1, 'e21', []) !== 'lg:kraken') return false
    // L'acte 1, sans l'inconnu : une question, un coffre laissé, l'échoppe, un vrai ou faux, le campement.
    x.avancer('e00')
    x.repondre(true)
    x.avancer('e10')
    x.prendre()
    x.avancer('e20')
    x.avancer('e30')
    x.repondre(true)
    x.avancer('cg')
    x.geste({ quoi: 'camper' })
    return x.vaincre().acte === 1
  })
  const compte = (e: EtatDeLExpedition) => [...e.main, ...e.paquet, ...e.defausse, ...e.poses].filter(c => c === kraken).length
  assert.equal(compte(j.etat()), 1, 'le Kraken vaincu a glissé le sien')
  j.avancer('e01')
  j.repondre(true)
  j.avancer('e11')
  j.repondre(true)
  j.prendre()
  let e = j.avancer('e21')
  assert.deepEqual(e.passages, [kraken])
  assert.equal(compte(e), 2, 'l’inconnu prête le même')
  j.avancer('e31')
  j.repondre(true)
  j.avancer('cg')
  e = j.geste({ quoi: 'camper', retirer: kraken })
  assert.equal(compte(e), 1)
  assert.deepEqual(e.passages, [], 'celui de passage est parti')
  e = j.vaincre()
  assert.equal(e.acte, 2)
  assert.equal(compte(e), 1, 'celui du gardien reste')
})

test('un piège sur la dernière vie finit l’expédition ; Renaissance posée le relève', () => {
  const sur = (equipee: string[]) =>
    chercher(
      `piege-fin-${equipee.length}`,
      x => {
        if (contenuDeLInconnu(x.depart.graine, 0, 'e21') !== 'piege') return false
        x.avancer('e01')
        if (equipee.length > 0) {
          if (!x.etat().main.includes('renaissance')) return false
          x.jouer('renaissance')
        }
        x.repondre(false)
        x.avancer('e11')
        x.repondre(false)
        return x.etat().vies === 1
      },
      4,
      equipee,
    )
  const j = sur([])
  let e = j.avancer('e21')
  assert.equal(e.issue, 'perdue')
  assert.equal(e.vies, 0)
  const k = sur(['lg:phenix'])
  e = k.avancer('e21')
  assert.equal(e.issue, 'en-route')
  assert.equal(e.vies, 1, 'Renaissance : il renaît avec une')
})

test('la lanterne et la boule : les pièges se montrent, un coffre s’ouvre au-dessus', () => {
  // La Citrouille et le Sapin, dans l'équipée : leurs jokers en main à la première question.
  const j = chercher('lanterne', x => x.avancer('e00').main.includes('lanterne'), 4, ['lg:citrouille'])
  j.repondre(true)
  let e = j.jouer('lanterne')
  assert.equal(e.lanterne, true)
  assert.equal(refusDuJoker(j.depart, { ...e, main: ['lanterne'] }, 'lanterne', j.questions), 'La lanterne est déjà allumée')

  const k = chercher('boule', x => x.avancer('e00').main.includes('boule'), 4, ['lg:sapin'])
  k.repondre(true)
  e = k.jouer('boule')
  assert.equal(e.maisons.length, 1)
  assert.equal(e.maisons[0].sorte, 'coffre', 'toujours un coffre')
  assert.ok(['e10', 'e11'].includes(e.maisons[0].vers))
})

test('une expédition partie avant les écus se rejoue telle qu’elle s’est jouée : ni écus, ni échoppe, ni inconnu, ni talisman', () => {
  const j = new Journal(depart('avant', 3))
  j.avancer('e00')
  let e = j.repondre(true)
  assert.equal(e.ecus, 0)
  e = j.avancer('e10')
  assert.equal(e.offre?.coffre, undefined)
  assert.equal(e.offre?.talisman, undefined)
  e = j.prendre()
  assert.equal(e.ecus, 0)
  e = j.avancer('e20')
  assert.equal(e.echoppe, null, 'une échoppe ne s’y ouvre pas : une carte d’avant n’en avait pas')
})

test('les talismans de l’offre sont rares, jamais deux fois le même ; l’échoppe en vend toujours un, tant qu’il en reste', () => {
  let offerts = 0
  for (let rang = 0; rang < 2000; rang++) if (talismanDeLOffre('rare', rang, [], false)) offerts++
  assert.ok(offerts > 200 && offerts < 400, `${offerts} offres sur 2000 en proposent un`)
  const tous = TALISMANS.map(t => t.cle)
  for (let rang = 0; rang < 50; rang++) {
    assert.ok(talismanDeLOffre('echoppe', rang, [], true))
    assert.equal(talismanDeLOffre('echoppe', rang, tous, true), null, 'il les a tous')
    const un = talismanDeLOffre('echoppe', rang, tous.slice(1), true)
    assert.equal(un, tous[0], 'celui qui lui manque')
  }
})

test('le tracé compte un piège sur trois dans l’inconnu qu’il ne voit pas ; et les écus qu’il promet', () => {
  const c = carte()
  const avecInconnu = viesAuBout(c, ['e01', 'e11', 'e21'], 3)
  const inconnu = c.escales.find(x => x.id === 'e21')!
  // Dévoilé — marchand —, il ne coûte rien.
  inconnu.contenu = 'marchand'
  const avecMarchand = viesAuBout(c, ['e01', 'e11', 'e21'], 3)
  assert.ok(avecInconnu[3] < avecMarchand[3], 'un piège possible coûte des vies')
  assert.equal(ecusEsperes(carte(), ['e00', 'e11']), Math.round(0.8 * 5 + 0.5 * (10 + ECUS_D_UNE_ELITE)))
})

test('la carte tire l’échoppe et l’inconnu depuis les écus', () => {
  let echoppes = 0
  let inconnus = 0
  for (let n = 0; n < 500; n++) {
    for (const e of carteDUnActe(`carte:${n}`, 0, []).escales) {
      if (e.sorte === 'echoppe') echoppes++
      if (e.sorte === 'inconnu') inconnus++
    }
  }
  assert.ok(echoppes > 0 && inconnus > echoppes, `${echoppes} échoppes, ${inconnus} inconnus sur 500 cartes`)
})
