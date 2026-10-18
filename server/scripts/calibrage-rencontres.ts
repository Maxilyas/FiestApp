// Le calibrage du prototype des rencontres (`shared/rencontres.ts`, la version
// 5 du départ) : la cible de l'expédition ne change pas — le joueur moyen au
// bout une fois sur trois, le fort huit fois sur dix (le brief du 17 octobre
// 2026) —, et le propriétaire a demandé, le 18 octobre 2026, de mesurer ce
// que dure une expédition à six étages avant de toucher au nombre d'étages.
// Mesurée sur le vrai code : le vrai générateur de cartes, le vrai pli, les
// vraies règles des cartes (`refusDuJoker`), joués par les joueurs inventés de
// `calibrage-expedition.ts` — le moyen trouve ce que trouve le calibrage
// (`TAUX_DU_CALIBRAGE`), le faible et le fort sont décalés d'un logit, chacun
// a ses catégories et ses sujets forts et faibles.
//
// Sa politique, simple — pas la meilleure : avant de voir la question, il lit
// sa chance dans l'annonce. Bonne, il attaque — la Charge, Corser, Quitte ou
// double, Banco — et mise ; mauvaise, il se garde — Prudence, Sursis,
// Contre-attaque — et ne mise rien, ou Simplifier. Il pose ses pouvoirs dès
// qu'il les tire. La question vue, s'il ne la sait pas, il joue ce qui l'aide
// — Coup d'œil, Double chance, l'Énigme, Deux visages, Échange —, et devine
// parmi ce qui reste. Il prend dans les offres d'après une préférence fixe,
// campe ou achète du courage s'il lui en manque, sinon retire une carte de
// base, et suit sur la carte l'escale la plus sûre, comme la page la lui
// conseille.
//
//   npx tsx scripts/calibrage-rencontres.ts [--expeditions 1000]
import { CATEGORIES } from '../../shared/categories'
import { SUJETS } from '../../shared/sujets'
import { TAUX_DU_CALIBRAGE } from '../../shared/sentiers'
import { hasardDe } from '../../shared/missions'
import { VIES, type Niveau } from '../../shared/campagne'
import {
  ACTES,
  GARDIEN,
  MARCHES_DES_ACTES,
  POIDS_DES_ESCALES,
  POIDS_DES_ESCALES_DES_RENCONTRES,
  carteDUnActe,
  chanceSelonLaForme,
  chancesDuTrace,
  contenuDeLInconnu,
  carteEnJeu,
  escaleEnJeu,
  escalesPermises,
  gardiensDe,
  marcheDe,
  pliDeLExpedition,
  prixDeLArticle,
  refusDeLAchat,
  refusDuJoker,
  traceLePlusSur,
  type ArticleDeLEchoppe,
  type ATirer,
  type CarteDUnActe,
  type DepartDExpedition,
  type EscaleDeLaCarte,
  type EtatDeLExpedition,
  type FormeDEscale,
  type GesteDExpedition,
  type QuestionPosee,
} from '../../shared/expedition'
import { COURAGE_MAX, effaceesDuTour } from '../../shared/rencontres'

function option(nom: string, defaut: number): number {
  const i = process.argv.indexOf(`--${nom}`)
  return i >= 0 ? Number(process.argv[i + 1]) : defaut
}
const EXPEDITIONS = option('expeditions', 1000)
/** La version des règles mesurée : 6 d'office, celle des départs d'aujourd'hui — `--version 5` remesure la main de cinq cartes d'emblée. */
const VERSION = option('version', 6) === 5 ? 5 : 6

const logit = (p: number) => Math.log(p / (1 - p))
const sigmoide = (x: number) => 1 / (1 + Math.exp(-x))

const JOUEURS: [string, number][] = [
  ['faible', -1],
  ['moyen', 0],
  ['fort', 1],
]
const ECART_D_UNE_CATEGORIE = 0.5
const ECART_D_UN_SUJET = 0.8
/** La part des questions qui se répondent par une année ou un nombre : la Prédiction s'y joue. */
const PART_DES_NOMBRES = 0.15
/** La part des questions qui se datent : l'Énigme y dit le siècle. */
const PART_DES_DATEES = 0.4
/** La part des questions qui ont deux leurres de plus : Corser s'y joue. */
const PART_DES_SIX = 0.8
/** Une question de la boucle revient après sa révélation : il en a vu la bonne réponse. */
const SAIT_UNE_REPRISE = 0.7
/** Un dévoilement : douze mots ; ce qu'il sait, il le répond à mi-texte ; sinon, le texte entier. */
const MOTS_D_UN_DEVOILEMENT = 12

function normale(r: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
}

interface Joueur {
  theta: number
  categories: Map<string, number>
  sujets: Map<string, number>
}

function unJoueur(theta: number, graine: string): Joueur {
  const r = hasardDe(graine)
  return {
    theta,
    categories: new Map(CATEGORIES.map(c => [c, ECART_D_UNE_CATEGORIE * normale(r)])),
    sujets: new Map(SUJETS.map(s => [s.cle, ECART_D_UN_SUJET * normale(r)])),
  }
}

const chanceSur = (j: Joueur, marche: Niveau, categorie: string | null, sujet: string | null = null) =>
  sigmoide(logit(TAUX_DU_CALIBRAGE[marche]) + j.theta + (categorie ? (j.categories.get(categorie) ?? 0) : 0) + (sujet ? (j.sujets.get(sujet) ?? 0) : 0))

function chanceAnnoncee(j: Joueur, acte: number, e: EscaleDeLaCarte): number {
  if (e.sorte === 'source') return chanceSur(j, 'moyen', null)
  const marche = marcheDe(acte, e)
  const t = e.theme
  const p4 = !t
    ? chanceSur(j, marche, null)
    : 'sujet' in t
      ? CATEGORIES.reduce((s, c) => s + chanceSur(j, marche, c, t.sujet), 0) / CATEGORIES.length
      : t.categories.reduce((s, c) => s + chanceSur(j, marche, c), 0) / t.categories.length
  return chanceSelonLaForme(p4, e.forme ?? 'quatre')
}

const savoir = (p4: number) => Math.max(0, (p4 - 1 / 4) / (3 / 4))

interface Issue {
  auBout: boolean
  acte: number
  questions: number
  rencontres: number
  cartes: number
  ecus: number
  courage: number
}

/** Ce qu'il prend dans une offre, du meilleur au moins bon ; ce qu'il n'y nomme pas, il le laisse. */
const PREFERENCE_DES_OFFRES = [
  'double-chance',
  'bibliotheque',
  'troisieme-oeil',
  'contre-attaque',
  'sursis',
  'banco',
  'lucidite',
  'parade',
  'plume',
  'lancee',
  'corser',
  'simplifier',
  'coup-d-oeil',
  'pioche',
  'echauffement',
  'doubler-la-mise',
  'quitte-ou-double',
  'echange',
]
/** Ce qu'il retire au campement, son courage au plus haut : une carte de base d'abord, comme dans Slay the Spire. */
const A_RETIRER = ['echange', 'prudence', 'concentration']
const TALISMANS_UTILES = ['loupe', 'boussole']

function jouer(j: Joueur, graine: string, equipee: string[]): Issue {
  const sujets = SUJETS.map(s => s.cle).sort()
  // Les cartes du départ, comme le serveur les tire : à plus d'adversaires dès la version 6.
  const cartes: CarteDUnActe[] = Array.from({ length: ACTES }, (_, acte) => carteDUnActe(graine, acte, sujets, undefined, VERSION >= 6 ? POIDS_DES_ESCALES_DES_RENCONTRES : POIDS_DES_ESCALES))
  cartes.forEach((carte, acte) => {
    for (const e of carte.escales) if (e.sorte === 'question' || e.sorte === 'elite' || e.sorte === 'source') e.chance = chanceAnnoncee(j, acte, e)
    carte.chanceDuGardien = CATEGORIES.reduce((s, c) => s + chanceSur(j, MARCHES_DES_ACTES[acte].gardien, c), 0) / CATEGORIES.length
  })
  const chances = Object.fromEntries(CATEGORIES.map(c => [c, Object.fromEntries((['facile', 'moyen', 'difficile'] as const).map(m => [m, chanceSur(j, m, c)]))]))
  // Sa catégorie fétiche : sa meilleure.
  const fetiche = [...CATEGORIES].sort((a, b) => (j.categories.get(b) ?? 0) - (j.categories.get(a) ?? 0))[0]
  const depart: DepartDExpedition = {
    v: VERSION,
    graine,
    numero: 0,
    gardiens: gardiensDe(graine, new Set(equipee)),
    cartes,
    moyen: false,
    equipee,
    chances,
    chanceDeLaSource: chanceSur(j, 'moyen', null),
    fetiche,
  }
  const r = hasardDe(`${graine}:reponses`)
  const au = <T>(liste: readonly T[]) => liste[Math.floor(r() * liste.length)]
  const gestes: GesteDExpedition[] = []
  const posees: (QuestionPosee & { p4: number; sait: boolean })[] = []
  const reponses = new Map<number, boolean>()
  let jouees = 0
  let depenses = 0
  const plier = () => pliDeLExpedition(depart, gestes, posees, reponses)

  const tirer = (t: ATirer, e: EtatDeLExpedition) => {
    if (t.reprise !== undefined) {
      const avant = posees[t.reprise]
      return posees.push({ ...avant, escale: t.escale, acte: t.acte, sait: r() < Math.max(SAIT_UNE_REPRISE, savoir(avant.p4)) })
    }
    let p4: number
    let forme: FormeDEscale | undefined
    let categorie: string
    let marche: Niveau
    if (t.escale === GARDIEN) {
      marche = MARCHES_DES_ACTES[t.acte].gardien
      p4 = chanceSur(j, marche, (categorie = au(CATEGORIES)))
    } else {
      const escale = escaleEnJeu(depart, e, t.escale)!
      marche = escale.sorte === 'source' ? 'facile' : marcheDe(t.acte, escale)
      const th = escale.theme
      if (escale.sorte === 'question' || escale.sorte === 'elite') forme = escale.forme
      if (escale.sorte === 'source') p4 = chanceSur(j, 'moyen', (categorie = au(CATEGORIES)))
      else if (t.categorie) p4 = chanceSur(j, marche, (categorie = t.categorie))
      else if (!th) p4 = chanceSur(j, marche, (categorie = au(CATEGORIES)))
      else if ('sujet' in th) p4 = chanceSur(j, marche, (categorie = au(CATEGORIES)), th.sujet)
      else p4 = chanceSur(j, marche, (categorie = au(th.categories)))
    }
    const reponsesDeLaForme = forme === 'vrai-faux' ? 2 : forme === 'six' ? 6 : 4
    const nombre = forme !== 'vrai-faux' && r() < PART_DES_NOMBRES
    posees.push({
      escale: t.escale,
      acte: t.acte,
      reponses: reponsesDeLaForme,
      p4,
      sait: r() < savoir(p4),
      categorie,
      niveau: marche,
      tiree: forme ?? 'quatre',
      six: r() < PART_DES_SIX,
      datee: r() < PART_DES_DATEES,
      ...(nombre && { nombre: true, reponseEn: 'nombre' as const }),
      ...(forme && forme !== 'quatre' && { forme }),
      ...(forme === 'devoilement' && { mots: MOTS_D_UN_DEVOILEMENT }),
    })
  }

  /** Juste ou non, à la question `i` : il sait, sinon il devine parmi ce qui reste — ce que les cartes du tour y effacent. */
  const juger = (i: number, e: EtatDeLExpedition): boolean => {
    const q = posees[i]
    if (q.sait) return true
    const t = e.rencontre?.tour
    const sur = t?.surLaQuestion ?? []
    let restent = (q.reponses ?? 4) - effaceesDuTour(sur, e.rencontre?.pouvoirs ?? [], { reponses: q.reponses ?? 4, datee: q.datee })
    // L'Énigme d'une question qui se date : le siècle et le domaine écartent, en moyenne, une réponse de plus ; la loupe, sur l'Histoire.
    if (sur.includes('enigme') && q.datee) restent--
    else if (e.talismans.includes('loupe') && q.categorie === 'Histoire' && q.datee) restent--
    restent = Math.max(2, restent)
    const p = sur.includes('double-chance') ? 2 / restent : sur.includes('prediction') ? 1 / 2 : 1 / restent
    return r() < p
  }

  const peut = (e: EtatDeLExpedition, cle: string, geste?: { categorie?: string; montre?: number }) =>
    (e.rencontre ? e.rencontre.main.includes(cle) : true) && refusDuJoker(depart, e, cle, posees, geste) === null

  /** Ce qu'il joue avant de voir la question — une carte à la fois, tant qu'il en a — ; null : il voit la question. */
  const enPreparation = (e: EtatDeLExpedition, i: number): GesteDExpedition | null => {
    const rc = e.rencontre!
    const q = posees[i]
    const chance = chanceSelonLaForme(q.p4, q.forme ?? (q.reponses === 2 ? 'vrai-faux' : 'quatre'))
    const courage = e.courage ?? 0
    const jouerLa = (cle: string): GesteDExpedition => ({ quoi: 'jouer', joker: cle, position: i })
    // Ce qui ne coûte rien et donne : piocher, s'inspirer.
    for (const cle of ['reveil', 'pioche']) if (peut(e, cle)) return jouerLa(cle)
    if (rc.defausse.length >= 4 && peut(e, 'feu-d-artifice')) return jouerLa('feu-d-artifice')
    if (rc.derniereFrappe >= 6 && peut(e, 'horizon')) return jouerLa('horizon')
    // Ses pouvoirs, dès qu'il les tire : ils valent toute la rencontre.
    for (const cle of ['bibliotheque', 'troisieme-oeil', 'tresor', 'trois-tetes', 'elan', 'aube', 'boucle', 'renaissance', 'echolocation']) if (peut(e, cle)) return jouerLa(cle)
    if (courage > 30 && peut(e, 'abysses')) return jouerLa('abysses')
    const attaque = chance >= 0.6
    if (attaque) {
      if (chance >= 0.75 && peut(e, 'corser')) return jouerLa('corser')
      if (chance >= 0.85 && peut(e, 'quitte-ou-double')) return jouerLa('quitte-ou-double')
      for (const cle of ['plume', 'lancee', 'concentration', 'echauffement', 'banco']) if (peut(e, cle)) return jouerLa(cle)
      if (peut(e, 'doubler-la-mise') && (e.ecus ?? 0) >= 50) return jouerLa('doubler-la-mise')
      for (const cle of ['prudence', 'peau-de-feu']) if (peut(e, cle)) return jouerLa(cle)
    } else {
      if (chance < 0.45 && peut(e, 'simplifier')) return jouerLa('simplifier')
      if (courage <= 20 && peut(e, 'sursis')) return jouerLa('sursis')
      for (const cle of ['prudence', 'peau-de-feu', 'contre-attaque']) if (peut(e, cle)) return jouerLa(cle)
      for (const cle of ['concentration', 'plume']) if (peut(e, cle)) return jouerLa(cle)
    }
    return null
  }

  /** Sa mise, au vu de sa chance : elle ne rapporte que la moitié de ce qu'elle engage, il ne mise qu'au-dessus de deux chances sur trois. */
  const miser = (e: EtatDeLExpedition, i: number): number => {
    const q = posees[i]
    const chance = chanceSelonLaForme(q.p4, q.forme ?? (q.reponses === 2 ? 'vrai-faux' : 'quatre'))
    const voulue = chance >= 0.85 ? 40 : chance >= 0.75 ? 20 : chance >= 0.67 ? 10 : 0
    for (const m of [voulue, 20, 10, 0]) if (m <= voulue && peutMiser(e, m)) return m
    return 0
  }
  const peutMiser = (e: EtatDeLExpedition, m: number) => m * (e.rencontre?.tour.jouees.includes('doubler-la-mise') ? 2 : 1) <= e.ecus

  /** Ce qu'il joue la question sous les yeux, s'il ne la sait pas. */
  const enQuestion = (e: EtatDeLExpedition, i: number): GesteDExpedition | null => {
    const q = posees[i]
    const autre = e.autre !== null ? posees[e.autre] : undefined
    if (q.sait || autre?.sait) return null
    const courage = e.courage ?? 0
    const ordre = [
      'deux-visages',
      'mue',
      'echange',
      'double-chance',
      'prediction',
      'sagesse',
      'enigme',
      ...(courage > 30 ? ['tout-ou-rien'] : []),
      'coup-d-oeil',
      ...(courage <= 15 ? ['passe-muraille'] : []),
      'parade',
    ]
    const cle = ordre.find(c => peut(e, c, c === 'prediction' ? { montre: 0 } : undefined))
    return cle ? { quoi: 'jouer', joker: cle, position: i, ...(cle === 'prediction' && { montre: 0 }) } : null
  }

  const carteVue = (e: EtatDeLExpedition): CarteDUnActe => {
    const carte = carteEnJeu(depart, e)!
    if (!carte.escales.some(x => x.sorte === 'inconnu')) return carte
    const boussole = e.talismans.includes('boussole')
    return {
      ...carte,
      escales: carte.escales.map(x => {
        if (x.sorte !== 'inconnu') return x
        const contenu = contenuDeLInconnu(depart.graine, e.acte, x.id)
        return boussole || e.trace.includes(x.id) || (e.lanterne && contenu === 'piege') ? { ...x, contenu } : x
      }),
    }
  }

  const lePlusSur = (e: EtatDeLExpedition, permises: readonly string[]): { trace: string[]; vaincre: number } | null => {
    const carte = carteVue(e)
    let meilleur: { trace: string[]; vaincre: number } | null = null
    for (const p of permises) {
      if (p === GARDIEN) continue
      const t = traceLePlusSur(carte, e.ici, e.vies, e.acte, { debut: [p] })
      if (t.length === 0) continue
      const { vaincre } = chancesDuTrace(carte, t, e.vies, e.acte)
      if (!meilleur || vaincre > meilleur.vaincre + 1e-9) meilleur = { trace: t, vaincre }
    }
    return meilleur
  }

  /** Une carte de route qui rend son tracé plus sûr, un coffre de plus, la lanterne ; le Commandement sur sa meilleure catégorie. */
  const surLaCarte = (e: EtatDeLExpedition, permises: string[]): GesteDExpedition | null => {
    const sansRien = lePlusSur(e, permises)?.vaincre ?? 0
    for (const cle of ['detour', 'raccourci'] as const) {
      if (!peut(e, cle)) continue
      const avec = lePlusSur(e, escalesPermises(depart, { ...e, route: { ...e.route, [cle]: true } }))?.vaincre ?? 0
      if (avec > sansRien + 0.01) return { quoi: 'jouer', joker: cle }
    }
    if ((e.courage ?? 0) < 40 && peut(e, 'maison')) return { quoi: 'jouer', joker: 'maison' }
    if (peut(e, 'boule')) return { quoi: 'jouer', joker: 'boule' }
    if (!e.talismans.includes('boussole') && peut(e, 'lanterne')) return { quoi: 'jouer', joker: 'lanterne' }
    const prochaine = lePlusSur(e, permises)?.trace[0]
    const sorte = prochaine ? escaleEnJeu(depart, e, prochaine)?.sorte : undefined
    if ((sorte === 'question' || sorte === 'elite') && peut(e, 'commandement', { categorie: fetiche })) return { quoi: 'jouer', joker: 'commandement', categorie: fetiche }
    return null
  }

  const aAcheter = (e: EtatDeLExpedition): { article: ArticleDeLEchoppe; joker?: string } | null => {
    const etal = e.echoppe!
    const voulus: { article: ArticleDeLEchoppe; joker?: string }[] = [
      ...((e.courage ?? 0) <= COURAGE_MAX - 15 ? [{ article: 'vie' as const }] : []),
      ...PREFERENCE_DES_OFFRES.filter(c => etal.jokers.includes(c))
        .slice(0, 1)
        .map(cle => ({ article: 'joker' as const, joker: cle })),
      ...(etal.talisman && TALISMANS_UTILES.includes(etal.talisman) ? [{ article: 'talisman' as const }] : []),
    ]
    return voulus.find(a => refusDeLAchat(e, a) === null) ?? null
  }

  for (let pas = 0; pas < 3000; pas++) {
    let e = plier()
    for (let tour = 0; e.aTirer && tour < 3; tour++) {
      const t = e.aTirer
      for (let k = 0; k < t.combien; k++) tirer(t, e)
      e = plier()
    }
    if (e.issue !== 'en-route') {
      return { auBout: e.issue === 'au-bout', acte: e.acte, questions: reponses.size, rencontres: e.rencontres, cartes: jouees, ecus: e.ecus + depenses, courage: e.courage ?? 0 }
    }
    if (e.offre) {
      const offre = e.offre
      const voulus = PREFERENCE_DES_OFFRES.filter(c => offre.jokers.includes(c))
      const talisman = offre.talisman && TALISMANS_UTILES.includes(offre.talisman) && !voulus.some(c => c === 'double-chance' || c === 'bibliotheque') ? offre.talisman : undefined
      gestes.push({ quoi: 'prendre', jokers: talisman ? [] : voulus.slice(0, 1), ...(talisman && { talisman }) })
      continue
    }
    if (e.echoppe && e.enAttente === null) {
      const achat = aAcheter(e)
      if (achat) {
        gestes.push({ quoi: 'acheter', ...achat })
        depenses += prixDeLArticle(achat.article, achat.joker)
        continue
      }
    }
    if (e.campement) {
      const retirer = (e.courage ?? 0) >= COURAGE_MAX - 8 ? A_RETIRER.find(c => e.paquet.includes(c)) : undefined
      gestes.push({ quoi: 'camper', ...(retirer && { retirer }) })
      continue
    }
    if (e.enAttente !== null) {
      const i = e.enAttente
      const rc = e.rencontre
      if (rc && rc.tour.phase === 'preparation') {
        const g = enPreparation(e, i)
        if (g) {
          gestes.push(g)
          jouees++
          if (g.quoi === 'jouer' && (g.joker === 'corser' || g.joker === 'simplifier')) {
            // Reposée à sa nouvelle forme, comme le serveur le fait (`questionsApresLeGeste`) : ce qu'il sait, il le sait encore.
            const q = posees[i]
            posees[i] = g.joker === 'corser' ? { ...q, forme: 'six', reponses: 6 } : { ...q, forme: 'vrai-faux', reponses: 2, nombre: undefined, reponseEn: undefined }
          }
          continue
        }
        gestes.push({ quoi: 'voir', mise: miser(e, i), position: i })
        continue
      }
      if (rc) {
        const g = enQuestion(e, i)
        if (g) {
          gestes.push(g)
          jouees++
          if (g.quoi === 'jouer' && g.joker === 'passe-muraille') reponses.set(i, false)
          continue
        }
      }
      // Deux visages : celle qu'il sait, s'il en sait une.
      const cible = e.autre !== null && !posees[i].sait && posees[e.autre]?.sait ? e.autre : i
      // Un dévoilement qu'il sait se répond à mi-texte.
      if (posees[cible].forme === 'devoilement') posees[cible] = { ...posees[cible], devoile: { mots: posees[cible].sait ? MOTS_D_UN_DEVOILEMENT / 2 : MOTS_D_UN_DEVOILEMENT, sur: MOTS_D_UN_DEVOILEMENT } }
      reponses.set(cible, juger(cible, e))
      continue
    }
    const permises = escalesPermises(depart, e)
    if (permises.includes(GARDIEN)) {
      gestes.push({ quoi: 'avancer', vers: GARDIEN })
      continue
    }
    const route = surLaCarte(e, permises)
    if (route) {
      gestes.push(route)
      jouees++
      continue
    }
    gestes.push({ quoi: 'avancer', vers: lePlusSur(e, permises)?.trace[0] ?? permises[0] })
  }
  throw new Error(`l’expédition ${graine} ne finit pas`)
}

const pc = (x: number) => `${Math.round(x * 100)} %`
const virgule = (x: number) => x.toFixed(1).replace('.', ',')
const CAS: [string, string[]][] = [
  ['Le paquet de départ seul', []],
  ['Avec la Chouette et le Phénix (l’Érudit, le Rempart)', ['lg:chouette', 'lg:phenix']],
  ['Avec le Dragon d’Or et Janus (le Flambeur, le Métamorphe)', ['lg:dragon', 'lg:janus']],
]
// `--cas 0` : une seule équipée, le temps d'essayer un réglage.
const UN_CAS = process.argv.includes('--cas') ? option('cas', 0) : null
console.log(`Les rencontres (v${VERSION}) — ${EXPEDITIONS} expéditions par joueur et par équipée. Courage ${COURAGE_MAX}, ${VIES} vies d'avant en reflet.\n`)
for (const [nomDuCas, equipee] of UN_CAS === null ? CAS : [CAS[UN_CAS]]) {
  console.log(nomDuCas)
  console.log('  joueur   au bout   arrêté à l’acte 1 · 2 · 3   questions   rencontres   cartes jouées   écus   courage au bout')
  for (const [nom, theta] of JOUEURS) {
    const issues = Array.from({ length: EXPEDITIONS }, (_, k) => jouer(unJoueur(theta, `calibrage:${nom}:${k}`), `calibrage:${k}`, equipee))
    const auBout = issues.filter(i => i.auBout)
    const arrets = [0, 1, 2].map(a => issues.filter(i => !i.auBout && i.acte === a).length / EXPEDITIONS)
    const moyenne = (liste: Issue[], f: (i: Issue) => number) => (liste.length === 0 ? 0 : liste.reduce((s, i) => s + f(i), 0) / liste.length)
    console.log(
      `  ${nom.padEnd(8)} ${pc(auBout.length / EXPEDITIONS).padStart(7)}   ${arrets.map(pc).join(' · ').padStart(24)}   ${virgule(moyenne(issues, i => i.questions)).padStart(9)}   ${virgule(moyenne(issues, i => i.rencontres)).padStart(10)}   ${virgule(moyenne(issues, i => i.cartes)).padStart(13)}   ${String(Math.round(moyenne(issues, i => i.ecus))).padStart(4)}   ${virgule(moyenne(auBout, i => i.courage)).padStart(15)}`,
    )
  }
  console.log('')
}
console.log('La cible : le moyen au bout une fois sur trois, le fort huit fois sur dix (`retours/2026-10-17/expedition.md`). Questions : celles d’une expédition jouée jusqu’à sa fin, au bout ou perdue.')
