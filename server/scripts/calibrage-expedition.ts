// Le calibrage de l'Expédition (`shared/expedition.ts`) : la cible du brief,
// retenue le 17 octobre 2026 — le joueur moyen au bout une fois sur trois, le
// fort huit fois sur dix —, mesurée sur le vrai code. Des joueurs inventés
// partent sur le vrai générateur (`carteDUnActe`), choisissent leur route
// comme la page la leur propose (le tracé le plus sûr, sur leur propre
// chance), et le vrai pli (`pliDeLExpedition`) juge chaque réponse, chaque
// vie et chaque joker.
//
// Le modèle est celui des sentiers (`calibrage-sentiers.ts`) : le joueur
// moyen trouve ce que trouve le calibrage (`TAUX_DU_CALIBRAGE`), le faible
// et le fort sont décalés d'un logit ; chacun a, en plus, ses catégories et
// ses sujets forts et faibles (un écart tiré pour chacun). La carte lui dit
// sa vraie chance : le modèle du savoir le connaîtrait parfaitement — en
// vrai, il se trompe, et le joueur choisit moins bien.
//
// Les jokers (l'étape 2), comme la simulation du brief : sur chaque question,
// il sait — son savoir, sous le hasard d'un sur quatre — ou ne sait pas, et
// joue alors son meilleur joker ; il ne le gâche jamais sur une question
// qu'il sait, où il joue plutôt ce qui ne demande pas de savoir (Le réveil, La
// pioche…). Il pose ce qui se pose dès qu'il l'a, prend dans les offres
// d'après une préférence fixe, campe s'il lui manque une vie — sinon retire
// son joker le plus faible —, et joue ses jokers de carte quand ils rendent
// son tracé plus sûr. Une politique simple, pas la meilleure : un vrai joueur
// garde parfois ses jokers pour le gardien.
//
// Les formes (l'étape 3) : la carte dit la chance à la forme de l'escale
// (`chanceSelonLaForme`), et qui ne sait pas devine parmi les réponses de sa
// forme — deux en vrai ou faux, six à six choix ; un dévoilement se répond
// le texte entier, comme quatre choix.
//
//   npx tsx scripts/calibrage-expedition.ts [--expeditions 2000]
import { CATEGORIES } from '../../shared/categories'
import { SUJETS } from '../../shared/sujets'
import { TAUX_DU_CALIBRAGE } from '../../shared/sentiers'
import { hasardDe } from '../../shared/missions'
import { VIES, type Niveau } from '../../shared/campagne'
import { EFFACE, joker } from '../../shared/jokers'
import {
  ACTES,
  GARDIEN,
  MARCHES_DES_ACTES,
  carteDUnActe,
  carteEnJeu,
  chanceSelonLaForme,
  chancesDuTrace,
  escaleEnJeu,
  escalesPermises,
  gardiensDe,
  marcheDe,
  pliDeLExpedition,
  refusDuJoker,
  traceLePlusSur,
  type ATirer,
  type CarteDUnActe,
  type DepartDExpedition,
  type EscaleDeLaCarte,
  type EtatDeLExpedition,
  type FormeDEscale,
  type GesteDExpedition,
  type QuestionPosee,
} from '../../shared/expedition'

function option(nom: string, defaut: number): number {
  const i = process.argv.indexOf(`--${nom}`)
  return i >= 0 ? Number(process.argv[i + 1]) : defaut
}
const EXPEDITIONS = option('expeditions', 2000)
/** Il garde ses jokers rares et légendaires pour le gardien (`--garder`). */
const GARDER = process.argv.includes('--garder')
const COMMUNS = new Set(['coup-d-oeil', 'echange'])

const logit = (p: number) => Math.log(p / (1 - p))
const sigmoide = (x: number) => 1 / (1 + Math.exp(-x))

const JOUEURS: [string, number][] = [
  ['faible', -1],
  ['moyen', 0],
  ['fort', 1],
]
/** L'écart d'une catégorie ou d'un sujet à son niveau, d'un joueur à l'autre (en logits). */
const ECART_D_UNE_CATEGORIE = 0.5
const ECART_D_UN_SUJET = 0.8
/** La part des questions qui se répondent par une année ou un nombre : la Prédiction s'y joue. */
const PART_DES_NOMBRES = 0.15
/** Une question de la boucle revient après sa révélation : il en a vu la bonne réponse. */
const SAIT_UNE_REPRISE = 0.7

/** Un tirage d'une loi normale centrée, d'un hasard qui se rejoue. */
function normale(r: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
}

/** Un joueur : son niveau, et ses écarts — par catégorie, par sujet. */
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

/** Sa chance sur une question d'une marche et d'une catégorie (sans catégorie : toutes, en moyenne). */
const chanceSur = (j: Joueur, marche: Niveau, categorie: string | null, sujet: string | null = null) =>
  sigmoide(logit(TAUX_DU_CALIBRAGE[marche]) + j.theta + (categorie ? (j.categories.get(categorie) ?? 0) : 0) + (sujet ? (j.sujets.get(sujet) ?? 0) : 0))

/** Ce que la carte lui dit d'une escale : sa chance moyenne sur ce qu'elle peut poser, à sa forme. */
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

/** Le savoir sous le hasard d'un sur quatre : la part des questions qu'il sait. */
const savoir = (p4: number) => Math.max(0, (p4 - 1 / 4) / (3 / 4))

interface Issue {
  auBout: boolean
  /** L'acte où il s'est arrêté (0 à 2) ; ACTES au bout. */
  acte: number
  questions: number
  /** Les jokers qu'il a joués. */
  jokers: number
}

/** Ce qu'il prend dans une offre, du meilleur au moins bon. */
const PREFERENCE_DES_OFFRES = ['double-chance', 'sursis', 'coup-d-oeil', 'echange', 'pioche', 'tout-ou-rien', 'detour']
/** Ce qu'il retire au campement, ses trois vies là : le moins utile d'abord. */
const A_RETIRER = ['detour', 'pioche', 'tout-ou-rien', 'echange']

/**
 * Une expédition jouée de bout en bout par ce joueur, sur la carte de cette
 * graine ; `equipee` null : l'étape 1, sans jokers.
 */
function jouer(j: Joueur, graine: string, equipee: string[] | null): Issue {
  const sujets = SUJETS.map(s => s.cle).sort()
  const cartes: CarteDUnActe[] = Array.from({ length: ACTES }, (_, acte) => carteDUnActe(graine, acte, sujets))
  cartes.forEach((carte, acte) => {
    for (const e of carte.escales) if (e.sorte === 'question' || e.sorte === 'elite' || e.sorte === 'source') e.chance = chanceAnnoncee(j, acte, e)
    carte.chanceDuGardien = CATEGORIES.reduce((s, c) => s + chanceSur(j, MARCHES_DES_ACTES[acte].gardien, c), 0) / CATEGORIES.length
  })
  const chances = Object.fromEntries(CATEGORIES.map(c => [c, Object.fromEntries((['facile', 'moyen', 'difficile'] as const).map(m => [m, chanceSur(j, m, c)]))]))
  const depart: DepartDExpedition = {
    v: equipee ? 3 : 1,
    graine,
    numero: 0,
    gardiens: gardiensDe(graine, new Set(equipee ?? [])),
    cartes,
    moyen: false,
    ...(equipee && { equipee, chances, chanceDeLaSource: chanceSur(j, 'moyen', null) }),
  }
  const r = hasardDe(`${graine}:reponses`)
  const au = <T>(liste: readonly T[]) => liste[Math.floor(r() * liste.length)]
  const gestes: GesteDExpedition[] = []
  const posees: (QuestionPosee & { p4: number; sait: boolean })[] = []
  const reponses = new Map<number, boolean>()
  let joues = 0
  const plier = () => pliDeLExpedition(depart, gestes, posees, reponses)

  /** Une question tirée pour ce que le pli demande, sa chance tirée comme le tirage : une catégorie de son thème. */
  const tirer = (t: ATirer, e: EtatDeLExpedition) => {
    const nombre = r() < PART_DES_NOMBRES
    if (t.reprise !== undefined) {
      const avant = posees[t.reprise]
      // Reposée telle qu'il l'a vue : sa forme et ses réponses comprises.
      return posees.push({
        escale: t.escale,
        acte: t.acte,
        reponses: avant.reponses ?? 4,
        p4: avant.p4,
        sait: r() < Math.max(SAIT_UNE_REPRISE, savoir(avant.p4)),
        ...(avant.nombre && { nombre: true }),
        ...(avant.forme && { forme: avant.forme }),
      })
    }
    let p4: number
    let forme: FormeDEscale | undefined
    if (t.escale === GARDIEN) p4 = chanceSur(j, MARCHES_DES_ACTES[t.acte].gardien, au(CATEGORIES))
    else {
      const escale = escaleEnJeu(depart, e, t.escale)!
      const marche = marcheDe(t.acte, escale)
      const th = escale.theme
      if (escale.sorte === 'question' || escale.sorte === 'elite') forme = escale.forme
      if (escale.sorte === 'source') p4 = chanceSur(j, 'moyen', au(CATEGORIES))
      else if (t.categorie) p4 = chanceSur(j, marche, t.categorie)
      else if (!th) p4 = chanceSur(j, marche, au(CATEGORIES))
      else if ('sujet' in th) p4 = chanceSur(j, marche, au(CATEGORIES), th.sujet)
      else p4 = chanceSur(j, marche, au(th.categories))
    }
    // Sa forme : deux réponses en vrai ou faux — pas de nombres à montrer à l'Oracle —, six à six choix.
    const reponsesDeLaForme = forme === 'vrai-faux' ? 2 : forme === 'six' ? 6 : 4
    posees.push({
      escale: t.escale,
      acte: t.acte,
      reponses: reponsesDeLaForme,
      p4,
      sait: r() < savoir(p4),
      ...(nombre && forme !== 'vrai-faux' && { nombre: true }),
      ...(forme && forme !== 'quatre' && { forme }),
    })
  }

  /** Juste ou non, à la question `i` : il sait, sinon il devine parmi ce qui reste — ce que son joker y change. */
  const juger = (i: number, e: EtatDeLExpedition): boolean => {
    if (posees[i].sait) return true
    const joue = e.joue?.joker
    let restent = (posees[i].reponses ?? 4) - (joue ? (EFFACE[joue] ?? 0) : 0) - (e.poses.includes('echolocation') && (posees[i].reponses ?? 4) > 2 ? EFFACE.echolocation : 0)
    // L'Énigme : le siècle et le domaine écartent, en moyenne, une réponse de plus.
    if (joue === 'enigme') restent--
    restent = Math.max(2, restent)
    const p = joue === 'double-chance' ? 2 / restent : joue === 'prediction' ? 1 / 2 : 1 / restent
    return r() < p
  }

  const peut = (e: EtatDeLExpedition, cle: string, geste?: { categorie?: string; montre?: number }) =>
    e.main.includes(cle) && refusDuJoker(depart, e, cle, posees, geste) === null

  /** Le joker de la question `i`, s'il en joue un. */
  const surLaQuestion = (e: EtatDeLExpedition, i: number): string | null => {
    if (e.joue) return null
    if (posees[i].sait) {
      // Il sait : rien qui aide, mais ce qui ne demande pas de savoir.
      if (e.vies < VIES && peut(e, 'reveil')) return 'reveil'
      if (peut(e, 'horizon')) return 'horizon'
      if (e.defausse.length >= 3 && peut(e, 'feu-d-artifice')) return 'feu-d-artifice'
      if (peut(e, 'pioche')) return 'pioche'
      return null
    }
    // Il ne sait pas : sur sa dernière vie, ce qui ne la coûte pas ; sinon ce qui l'aide le plus.
    const ordre =
      e.vies === 1
        ? ['mue', 'sursis', 'deux-visages', 'echange', 'passe-muraille', 'double-chance', 'prediction', 'sagesse', 'enigme', 'coup-d-oeil']
        : ['deux-visages', 'echange', 'mue', 'double-chance', 'prediction', 'sagesse', ...(e.vies >= VIES ? ['tout-ou-rien'] : []), 'enigme', 'coup-d-oeil', 'sursis']
    // `--garder` : avant le gardien, ses deux vies là, il ne joue que les communs — il garde les autres pour lui.
    const avantLeGardien = GARDER && !e.gardien && e.vies >= 2
    return ordre.find(c => (!avantLeGardien || COMMUNS.has(c)) && peut(e, c, c === 'prediction' ? { montre: 0 } : undefined)) ?? null
  }

  /** Le tracé le plus sûr d'ici, depuis chacune des escales permises — Le détour, Le raccourci les changent. */
  const lePlusSur = (e: EtatDeLExpedition, permises: readonly string[]): { trace: string[]; vaincre: number } | null => {
    const carte = carteEnJeu(depart, e)!
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

  /** Un joker de carte qui rend son tracé plus sûr ; Il connaît la maison quand une vie lui manque ; le Commandement sur sa meilleure catégorie. */
  const surLaCarte = (e: EtatDeLExpedition, permises: string[]): GesteDExpedition | null => {
    const sansRien = lePlusSur(e, permises)?.vaincre ?? 0
    for (const cle of ['detour', 'raccourci'] as const) {
      if (!peut(e, cle)) continue
      const avec = lePlusSur(e, escalesPermises(depart, { ...e, route: { ...e.route, [cle]: true } }))?.vaincre ?? 0
      if (avec > sansRien + 0.01) return { quoi: 'jouer', joker: cle }
    }
    if (e.vies < VIES && peut(e, 'maison')) return { quoi: 'jouer', joker: 'maison' }
    const prochaine = lePlusSur(e, permises)?.trace[0]
    const sorte = prochaine ? escaleEnJeu(depart, e, prochaine)?.sorte : undefined
    if ((sorte === 'question' || sorte === 'elite') && peut(e, 'commandement', { categorie: CATEGORIES[0] })) {
      const meilleure = [...CATEGORIES].sort((a, b) => (j.categories.get(b) ?? 0) - (j.categories.get(a) ?? 0))[0]
      return { quoi: 'jouer', joker: 'commandement', categorie: meilleure }
    }
    return null
  }

  /** Ce qui se pose, dès qu'il l'a — Remonter des abysses, qui coûte une vie, ses trois vies là seulement. */
  const aPoser = (e: EtatDeLExpedition) =>
    e.main.find(c => joker(c)?.sorte === 'poser' && (c !== 'abysses' || e.vies >= VIES) && refusDuJoker(depart, e, c, posees) === null)

  for (let pas = 0; pas < 1500; pas++) {
    let e = plier()
    for (let tour = 0; e.aTirer && tour < 3; tour++) {
      const t = e.aTirer
      for (let k = 0; k < t.combien; k++) tirer(t, e)
      e = plier()
    }
    if (e.issue !== 'en-route') return { auBout: e.issue === 'au-bout', acte: e.acte, questions: reponses.size, jokers: joues }
    if (e.offre) {
      const offre = e.offre
      gestes.push({ quoi: 'prendre', jokers: PREFERENCE_DES_OFFRES.filter(c => offre.jokers.includes(c)).slice(0, offre.aPrendre) })
      continue
    }
    if (e.campement) {
      const tous = [...e.paquet, ...e.main, ...e.defausse]
      const retirer = e.vies >= VIES ? A_RETIRER.find(c => tous.includes(c)) : undefined
      gestes.push({ quoi: 'camper', ...(retirer && { retirer }) })
      continue
    }
    const pose = aPoser(e)
    if (pose) {
      gestes.push({ quoi: 'jouer', joker: pose, ...(e.enAttente !== null && { position: e.enAttente }) })
      joues++
      continue
    }
    if (e.enAttente !== null) {
      const i = e.enAttente
      const cle = surLaQuestion(e, i)
      if (cle) {
        gestes.push({ quoi: 'jouer', joker: cle, position: i, ...(cle === 'prediction' && { montre: 0 }) })
        // Passe-muraille répond à sa place : traversée, comme ratée.
        if (cle === 'passe-muraille') reponses.set(i, false)
        joues++
        continue
      }
      // Deux visages : celle qu'il sait, s'il en sait une.
      const cible = e.autre !== null && !posees[i].sait && posees[e.autre]?.sait ? e.autre : i
      reponses.set(cible, juger(cible, e))
      continue
    }
    const permises = escalesPermises(depart, e)
    if (permises.includes(GARDIEN)) {
      gestes.push({ quoi: 'avancer', vers: GARDIEN })
      continue
    }
    const carte = depart.v >= 2 ? surLaCarte(e, permises) : null
    if (carte) {
      gestes.push(carte)
      joues++
      continue
    }
    gestes.push({ quoi: 'avancer', vers: lePlusSur(e, permises)?.trace[0] ?? permises[0] })
  }
  throw new Error(`l’expédition ${graine} ne finit pas`)
}

const pc = (x: number) => `${Math.round(x * 100)} %`
/** Les équipées mesurées : sans jokers (l'étape 1), le paquet de départ seul, et celle de la simulation du brief. */
const CAS: [string, string[] | null][] = [
  ['Sans jokers (l’étape 1)', null],
  ['Le paquet de départ seul', []],
  ['Avec la Chouette et le Phénix', ['lg:chouette', 'lg:phenix']],
  ['Avec Janus et le Serpent à plumes', ['lg:janus', 'lg:serpent']],
]
console.log(`L'Expédition — ${EXPEDITIONS} expéditions par joueur et par équipée.\n`)
for (const [nomDuCas, equipee] of CAS) {
  console.log(nomDuCas)
  console.log('  joueur   au bout   arrêté à l’acte 1 · 2 · 3   questions   jokers joués')
  for (const [nom, theta] of JOUEURS) {
    const issues = Array.from({ length: EXPEDITIONS }, (_, k) => jouer(unJoueur(theta, `calibrage:${nom}:${k}`), `calibrage:${k}`, equipee))
    const auBout = issues.filter(i => i.auBout).length / EXPEDITIONS
    const arrets = [0, 1, 2].map(a => issues.filter(i => !i.auBout && i.acte === a).length / EXPEDITIONS)
    const questions = issues.reduce((s, i) => s + i.questions, 0) / EXPEDITIONS
    const jokers = issues.reduce((s, i) => s + i.jokers, 0) / EXPEDITIONS
    console.log(
      `  ${nom.padEnd(8)} ${pc(auBout).padStart(7)}   ${arrets.map(pc).join(' · ').padStart(24)}   ${questions.toFixed(1).replace('.', ',').padStart(9)}   ${jokers.toFixed(1).replace('.', ',').padStart(12)}`,
    )
  }
  console.log('')
}
console.log('La cible, avec une équipée de deux jokers : le moyen une fois sur trois, le fort huit fois sur dix (`retours/2026-10-17/expedition.md`).')
