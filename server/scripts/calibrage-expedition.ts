// Le calibrage de l'Expédition (`shared/expedition.ts`) : la cible du brief,
// retenue le 17 octobre 2026 — le joueur moyen au bout une fois sur trois, le
// fort huit fois sur dix —, mesurée sur le vrai code. Des joueurs inventés
// partent sur le vrai générateur (`carteDUnActe`), choisissent leur route
// comme la page la leur propose (`traceLePlusSur`, sur leur propre chance),
// et le vrai pli (`pliDeLExpedition`) juge chaque réponse et chaque vie.
//
// Le modèle est celui des sentiers (`calibrage-sentiers.ts`) : le joueur
// moyen trouve ce que trouve le calibrage (`TAUX_DU_CALIBRAGE`), le faible
// et le fort sont décalés d'un logit ; chacun a, en plus, ses catégories et
// ses sujets forts et faibles (un écart tiré pour chacun). La carte lui dit
// sa vraie chance : le modèle du savoir le connaîtrait parfaitement — en
// vrai, il se trompe, et le joueur choisit moins bien.
//
// L'étape 1 n'a pas de jokers : le brief prévoyait, sans eux, le moyen au
// bout trois fois sur cent et le fort 38 fois. Les jokers (l'étape 2) font le
// mode ; ce script les mesurera avec eux.
//
//   npx tsx scripts/calibrage-expedition.ts [--expeditions 2000]
import { CATEGORIES } from '../../shared/categories'
import { SUJETS } from '../../shared/sujets'
import { TAUX_DU_CALIBRAGE } from '../../shared/sentiers'
import { hasardDe } from '../../shared/missions'
import type { Niveau } from '../../shared/campagne'
import {
  ACTES,
  GARDIEN,
  MARCHES_DES_ACTES,
  carteDUnActe,
  escalesPermises,
  marcheDe,
  pliDeLExpedition,
  questionsDuGardien,
  traceLePlusSur,
  type CarteDUnActe,
  type EscaleDeLaCarte,
  type GesteDExpedition,
  type QuestionPosee,
} from '../../shared/expedition'

function option(nom: string, defaut: number): number {
  const i = process.argv.indexOf(`--${nom}`)
  return i >= 0 ? Number(process.argv[i + 1]) : defaut
}
const EXPEDITIONS = option('expeditions', 2000)

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

/** Ce que la carte lui dit d'une escale : sa chance moyenne sur ce qu'elle peut poser. */
function chanceAnnoncee(j: Joueur, acte: number, e: EscaleDeLaCarte): number {
  if (e.sorte === 'source') return chanceSur(j, 'moyen', null)
  const marche = marcheDe(acte, e)
  const t = e.theme
  if (!t) return chanceSur(j, marche, null)
  if ('sujet' in t) return CATEGORIES.reduce((s, c) => s + chanceSur(j, marche, c, t.sujet), 0) / CATEGORIES.length
  return t.categories.reduce((s, c) => s + chanceSur(j, marche, c), 0) / t.categories.length
}

/** La chance d'une question tirée pour l'escale : sa catégorie tirée parmi celles du thème, comme le tirage. */
function chanceTiree(j: Joueur, acte: number, e: EscaleDeLaCarte, r: () => number): number {
  const au = <T>(liste: readonly T[]) => liste[Math.floor(r() * liste.length)]
  if (e.sorte === 'gardien') return chanceSur(j, MARCHES_DES_ACTES[acte].gardien, au(CATEGORIES))
  if (e.sorte === 'source') return chanceSur(j, 'moyen', au(CATEGORIES))
  const marche = marcheDe(acte, e)
  const t = e.theme
  if (!t) return chanceSur(j, marche, au(CATEGORIES))
  if ('sujet' in t) return chanceSur(j, marche, au(CATEGORIES), t.sujet)
  return chanceSur(j, marche, au(t.categories))
}

interface Issue {
  auBout: boolean
  /** L'acte où il s'est arrêté (0 à 2) ; ACTES au bout. */
  acte: number
  questions: number
}

/** Une expédition jouée de bout en bout par ce joueur, sur la carte de cette graine. */
function jouer(j: Joueur, graine: string): Issue {
  const sujets = SUJETS.map(s => s.cle).sort()
  const cartes: CarteDUnActe[] = Array.from({ length: ACTES }, (_, acte) => carteDUnActe(graine, acte, sujets))
  cartes.forEach((carte, acte) => {
    for (const e of carte.escales) if (e.sorte === 'question' || e.sorte === 'elite' || e.sorte === 'source') e.chance = chanceAnnoncee(j, acte, e)
    carte.chanceDuGardien = CATEGORIES.reduce((s, c) => s + chanceSur(j, MARCHES_DES_ACTES[acte].gardien, c), 0) / CATEGORIES.length
  })
  const depart = { v: 1 as const, graine, cartes, gardiens: ['a', 'b', 'c'] }
  const r = hasardDe(`${graine}:reponses`)
  const gestes: GesteDExpedition[] = []
  const questions: QuestionPosee[] = []
  const chances: number[] = []
  const reponses = new Map<number, boolean>()
  for (let pas = 0; pas < 500; pas++) {
    const e = pliDeLExpedition(depart, gestes, questions, reponses)
    if (e.issue !== 'en-route') return { auBout: e.issue === 'au-bout', acte: e.acte, questions: reponses.size }
    if (e.enAttente !== null) {
      reponses.set(e.enAttente, r() < chances[e.enAttente])
      continue
    }
    const permises = escalesPermises(depart, e)
    const vers = permises.includes(GARDIEN) ? GARDIEN : (traceLePlusSur(cartes[e.acte], e.ici, e.vies, e.acte)[0] ?? permises[0])
    gestes.push({ quoi: 'avancer', vers })
    const escale = cartes[e.acte].escales.find(x => x.id === vers)!
    const n = escale.sorte === 'gardien' ? questionsDuGardien(e.acte, e.vies) : escale.sorte === 'campement' ? 0 : 1
    for (let i = 0; i < n; i++) {
      questions.push({ escale: vers, acte: e.acte })
      chances.push(chanceTiree(j, e.acte, escale, r))
    }
  }
  throw new Error(`l’expédition ${graine} ne finit pas`)
}

const pc = (x: number) => `${Math.round(x * 100)} %`
console.log(`L'Expédition, sans jokers (l'étape 1) — ${EXPEDITIONS} expéditions par joueur.\n`)
console.log('joueur   au bout   arrêté à l’acte 1 · 2 · 3   questions')
for (const [nom, theta] of JOUEURS) {
  const issues = Array.from({ length: EXPEDITIONS }, (_, k) => jouer(unJoueur(theta, `calibrage:${nom}:${k}`), `calibrage:${k}`))
  const auBout = issues.filter(i => i.auBout).length / EXPEDITIONS
  const arrets = [0, 1, 2].map(a => issues.filter(i => !i.auBout && i.acte === a).length / EXPEDITIONS)
  const questions = issues.reduce((s, i) => s + i.questions, 0) / EXPEDITIONS
  console.log(`${nom.padEnd(8)} ${pc(auBout).padStart(7)}   ${arrets.map(pc).join(' · ').padStart(24)}   ${questions.toFixed(1).replace('.', ',').padStart(9)}`)
}
console.log('\nLa cible, avec une équipée de deux jokers : le moyen une fois sur trois, le fort huit fois sur dix (`retours/2026-10-17/expedition.md`).')
