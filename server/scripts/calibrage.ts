// Combien de quiz faut-il pour débloquer chaque légendaire ?
//
// Une simulation, sur le vrai code : des bandes d'amis jouent des soirées
// entières, et chaque soirée passe par `hautsFaitsDeSoiree` et
// `relevesDeSoiree`, exactement comme à la clôture. On note, pour chaque
// joueur, le quiz où chaque légendaire tombe — avec les règles du catalogue,
// et avec d'autres seuils qu'on voudrait essayer.
//
// Les joueurs sont inventés, pas les règles : un niveau, une vitesse, une
// distraction, un flair pour les estimations, tirés au hasard (graine fixe,
// le résultat se rejoue à l'identique). Le format se règle en ligne de
// commande, parce que c'est lui qui décide de tout : un Grand Chelem sur huit
// questions n'a rien à voir avec un Grand Chelem sur quarante-deux.
//
//   npx tsx scripts/calibrage.ts                          # 2 quiz × 50 questions, 12 joueurs
//   npx tsx scripts/calibrage.ts --quiz 3 --questions 12 --joueurs 8
//
// Ce qu'il affiche, pour chaque légendaire et chaque seuil essayé, le
// nombre de quiz qu'il faut : au premier de la bande qui le décroche (la
// médiane sur toutes les bandes) — c'est lui que les seuils du catalogue
// visent, une vingtaine de quiz —, au quart des joueurs le plus doué pour
// lui, au joueur médian ; puis la part des joueurs qui l'ont au bout de
// vingt quiz.
//
// Et les niveaux : l'expérience de chaque soirée, créditée comme à la clôture
// (hauts faits et paliers compris), puis le niveau qu'elle donne sur la
// courbe du jour et sur d'autres qu'on voudrait essayer.
//
// Et la rareté de chaque haut fait — de soirée, et chaque palier de
// carrière : la part des joueurs qui l'ont au bout de dix, vingt et quarante
// soirées, et en moyenne sur toutes. C'est cette moyenne qui range « ses plus
// beaux hauts faits » sur la carte d'un joueur (`PART_DES_JOUEURS`,
// `shared/hautsfaits.ts`) : l'expérience qu'un haut fait rapporte le dit mal
// — L'Oracle paie 50, et trois joueurs sur quatre l'ont en dix soirées.
//
// Et les écussons de savoir (`shared/ecussons.ts`) : les questions prennent
// une catégorie — quiz à thème, quiz mélangés dont une partie seulement est
// classée —, une part des joueurs joue au quiz du jour entre deux soirées, et
// l'on compte les écussons que chaque jeu de seuils donne, soirée après
// soirée. Les catégories se tirent sur un hasard à part : les mesures d'avant
// se rejouent à l'identique. (Les avatars du savoir s'y mesuraient aussi :
// ils se gagnent maintenant sur les sentiers, que mesure
// `calibrage-sentiers.ts`.)
//
//   npx tsx scripts/calibrage.ts --themes 0.4 --classees 0.6 --jour 0.3 --jours 6
import { hautsFaitsDeSoiree, xpDesHautsFaits } from '../src/core/hautsfaits'
import { buildProgress, relevesDeSoiree } from '../src/core/progress'
import type { AnswerRow } from '../src/core/answers'
import type { ScoreEntry } from '../src/core/scores'
import type { PlayerRec } from '../src/core/party'
import { pointsDesEstimations, pointsDuChoix, tempsDeLecture } from '../src/games/quiz'
import { XP_PAR_PALIER, carriereDe, niveauPour, type Carriere, type GainSoiree, type ReleveSoiree } from '../../shared/profil'
import { HAUTS_FAITS_DE_CARRIERE, HAUTS_FAITS_DE_SOIREE, HAUTS_FAITS_REGAGNABLES, XP_PALIER, clePalier, palierDe, paliersAtteints } from '../../shared/hautsfaits'
import { LEGENDAIRES, conditionTenue, type Condition } from '../../shared/legendaires'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { SEUILS_ECUSSON, justesParCategorie } from '../../shared/ecussons'
import { CATEGORIES_DU_JOUR } from '../src/core/consigne'

// ── Le format ─────────────────────────────────────────────────────────────

function option(nom: string, defaut: number): number {
  const i = process.argv.indexOf(`--${nom}`)
  return i >= 0 ? Number(process.argv[i + 1]) : defaut
}

const QUIZ_PAR_SOIREE = option('quiz', 2)
const QUESTIONS_PAR_QUIZ = option('questions', 50)
/** Une question sur six est une estimation. */
const PART_ESTIMATIONS = option('estimations', 0.17)
const JOUEURS = option('joueurs', 12)
const BANDES = option('bandes', 120)
const SOIREES = option('soirees', 40)
const GRAINE = option('graine', 1)
/** Les quiz à thème : toutes leurs questions dans une seule catégorie. */
const PART_THEMES = option('themes', 0.3)
/**
 * Dans un quiz mélangé, les questions que l'animateur a classées : la moitié
 * — c'est la part des quiz livrés avec le dépôt, et rien n'oblige à classer.
 */
const PART_CLASSEES = option('classees', 0.5)
/** Les joueurs qui jouent au quiz du jour entre deux soirées. */
const PART_DU_JOUR = option('jour', 0.3)
/** Leurs parties du jour entre deux soirées. */
const PARTIES_ENTRE_DEUX = option('jours', 6)
const DUREE_S = 20
/**
 * Le temps de lecture d'une question type : cinquante-cinq caractères et
 * quatre réponses de sept — la moyenne des quiz livrés avec le dépôt.
 */
const LECTURE_MS = tempsDeLecture({
  kind: 'choice',
  text: 'x'.repeat(55),
  answers: Array.from({ length: 4 }, () => 'x'.repeat(7)),
  correct: 0,
  duration: DUREE_S,
  image: null,
  observeSeconds: null,
})

// ── Le hasard, rejouable ──────────────────────────────────────────────────

/** mulberry32 : la même graine rejoue la même suite. */
function generateur(graine: number): () => number {
  let etat = graine >>> 0
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0
    let t = etat
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hasard = generateur(GRAINE)
/**
 * Le hasard des catégories et du quiz du jour, à part : tirées sur le même,
 * elles décalaient toute la suite, et les légendaires, les niveaux et la
 * rareté ne se rejouaient plus à l'identique.
 */
const hasardDuSavoir = generateur(GRAINE * 7919 + 104729)
const entre = (a: number, b: number) => a + (b - a) * hasard()
function normale(): number {
  const u = Math.max(1e-12, hasard())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * hasard())
}
const sigmoide = (x: number) => 1 / (1 + Math.exp(-x))

// ── Les joueurs ───────────────────────────────────────────────────────────

interface Joueur {
  id: string
  /** Le niveau, centré sur zéro : +2, c'est le premier de la bande à coup sûr. */
  niveau: number
  /** Le temps médian d'une réponse, en secondes. */
  vitesse: number
  /** La part des questions qu'il laisse passer, faute de temps ou d'attention. */
  distraction: number
  /** Par quiz, la chance de s'absenter quelques questions — le bar, la cuisine. */
  absence: number
  /** L'écart typique de ses estimations, en logarithme. */
  flou: number
  /** La chance de connaître une estimation au chiffre près. */
  exact: number
}

function inventer(id: string): Joueur {
  const niveau = normale()
  const distrait = hasard() < 0.25
  return {
    id,
    niveau,
    vitesse: entre(3, 8),
    distraction: distrait ? entre(0.03, 0.08) : entre(0.003, 0.02),
    absence: distrait ? entre(0.2, 0.5) : entre(0.02, 0.15),
    flou: 0.35 + 0.6 * sigmoide(-niveau) + entre(0, 0.3),
    exact: 0.02 + 0.2 * sigmoide(1.5 * (niveau - 0.5)),
  }
}

// ── Une soirée ────────────────────────────────────────────────────────────

interface Question {
  kind: 'choice' | 'number'
  difficulte: number
  choix: number
  cible: number
  /** Estimations : la dureté de la question, qui étire les écarts de tout le monde. */
  durete: number
  /** Estimations : un chiffre qu'on peut savoir (27 pays) ou qu'on devine (la pression sur Vénus). */
  connue: boolean
}

function question(): Question {
  if (hasard() < PART_ESTIMATIONS) {
    return {
      kind: 'number',
      difficulte: 0,
      choix: 0,
      cible: Math.round(10 ** entre(1, 4)),
      durete: entre(0.5, 1.6),
      connue: hasard() < 0.4,
    }
  }
  return { kind: 'choice', difficulte: normale() * 1.1, choix: hasard() < 0.2 ? 2 : 4, cible: 0, durete: 0, connue: false }
}

/**
 * Ce que pèse chaque catégorie dans les quiz des animateurs : la culture
 * générale et le cinéma reviennent plus souvent que la cuisine, et la fête
 * n'a qu'un quiz de temps en temps.
 */
const POIDS: Record<Categorie, number> = {
  'Culture générale': 1.4,
  Histoire: 1.1,
  Géographie: 1.1,
  Sciences: 1,
  Nature: 1,
  'Cinéma & séries': 1.3,
  Musique: 1.2,
  'Arts & lettres': 0.8,
  Sport: 0.9,
  Cuisine: 0.8,
  'Jeux & pop culture': 1,
  'Autour de la fête': 0.6,
}
const POIDS_TOTAL = CATEGORIES.reduce((n, c) => n + POIDS[c], 0)
function tirerCategorie(): Categorie {
  let x = hasardDuSavoir() * POIDS_TOTAL
  for (const c of CATEGORIES) if ((x -= POIDS[c]) < 0) return c
  return CATEGORIES[CATEGORIES.length - 1]
}

function soiree(bande: Joueur[], numero: number) {
  const players: PlayerRec[] = bande.map(j => ({
    id: j.id,
    name: j.id,
    avatar: '🦊',
    token: j.id,
    teamId: null,
    profileId: j.id,
    createdAt: 0,
  }))
  const answers: AnswerRow[] = []
  const scores: ScoreEntry[] = []
  for (let k = 0; k < QUIZ_PAR_SOIREE; k++) {
    const sessionId = `s${numero}-${k}`
    const theme = hasardDuSavoir() < PART_THEMES ? tirerCategorie() : null
    // Les absences du quiz : une fenêtre de quelques questions, pour qui s'en va.
    const absents = new Map<string, [number, number]>()
    for (const j of bande) {
      if (hasard() < j.absence) {
        const debut = Math.floor(entre(0, QUESTIONS_PAR_QUIZ))
        absents.set(j.id, [debut, debut + Math.floor(entre(3, 10))])
      }
    }
    for (let q = 0; q < QUESTIONS_PAR_QUIZ; q++) {
      const qu = question()
      const categorie = theme ?? (hasardDuSavoir() < PART_CLASSEES ? tirerCategorie() : null)
      const lignes: AnswerRow[] = []
      for (const j of bande) {
        const fenetre = absents.get(j.id)
        const present = !fenetre || q < fenetre[0] || q >= fenetre[1]
        let ms = Math.round(1000 * j.vitesse * Math.exp(0.25 * qu.difficulte + 0.4 * normale()))
        ms = Math.max(600, ms)
        const repond = present && hasard() >= j.distraction && ms < DUREE_S * 1000
        const ligne: AnswerRow = {
          sessionId,
          quizTitle: 'Simulé',
          qIndex: q,
          kind: qu.kind,
          playerId: j.id,
          answered: repond,
          correct: null,
          choice: null,
          value: null,
          target: qu.kind === 'number' ? qu.cible : null,
          ms: repond ? ms : null,
          changes: 0,
          points: 0,
          durationMs: DUREE_S * 1000,
          observed: false,
          category: categorie,
          createdAt: 0,
        }
        if (repond && qu.kind === 'choice') {
          const hasardPur = 1 / qu.choix
          const p = hasardPur + (1 - hasardPur) * sigmoide(1.7 * (j.niveau - qu.difficulte))
          const juste = hasard() < p
          ligne.correct = juste
          ligne.choice = juste ? 0 : 1 + Math.floor(hasard() * (qu.choix - 1))
          // Le barème de `games/quiz.ts`, le vrai : le temps de lecture offert, puis la rapidité.
          if (juste) ligne.points = pointsDuChoix(ms, DUREE_S * 1000, LECTURE_MS)
        } else if (repond) {
          const pile = qu.connue && hasard() < j.exact * 2
          const brut = pile ? qu.cible : qu.cible * Math.exp(j.flou * qu.durete * normale())
          // On tape des nombres ronds : deux chiffres significatifs.
          const ordre = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, brut))) - 1)
          ligne.value = pile ? qu.cible : Math.max(0, Math.round(brut / ordre) * ordre)
        }
        lignes.push(ligne)
      }
      if (qu.kind === 'number') {
        const estimees = lignes.filter(l => l.answered && l.value !== null)
        // Le barème de `games/quiz.ts`, le vrai : la participation, puis la distance.
        const points = pointsDesEstimations(qu.cible, estimees.map(l => l.value!))
        estimees.forEach((l, i) => (l.points = points[i]))
      }
      for (const l of lignes) {
        answers.push(l)
        if (l.answered) scores.push({ playerId: l.playerId, sessionId, points: l.points, reason: 'q', createdAt: 0 })
      }
    }
  }
  const live = { players, scores, answers }
  return { live, faits: hautsFaitsDeSoiree(live), releves: relevesDeSoiree(live, { cloture: true }) }
}

// ── Ce qu'on mesure ───────────────────────────────────────────────────────

/**
 * Une règle à essayer : une condition du catalogue — lue par `conditionTenue`,
 * comme en production —, ou un seuil sur un chiffre de la carrière, pour
 * essayer ce qui tomberait entre deux paliers.
 */
type Regle = { condition: Condition } | { carriere: 'soirees' | 'reflexes'; seuil: number }

/** Ce qu'un joueur a rangé : ses hauts faits de soirée comptés, ses paliers, et sa carrière. */
interface Suivi {
  soirees: { releve: ReleveSoiree; gain: GainSoiree; spaceId: string }[]
  recompenses: Map<string, number>
  carriere: Carriere
}

function tenue(r: Regle, s: Suivi): boolean {
  if ('condition' in r) return conditionTenue(r.condition, s.recompenses)
  return s.carriere[r.carriere] >= r.seuil
}

const decrire = (r: Regle): string =>
  'carriere' in r
    ? `${r.carriere} ≥ ${r.seuil}`
    : 'toutes' in r.condition
      ? r.condition.toutes.map(c => decrire({ condition: c })).join(' et ')
      : 'fois' in r.condition
        ? `${r.condition.hautFait} × ${r.condition.fois}`
        : `${r.condition.hautFait} palier ${r.condition.palier}`

/**
 * Ceux que la bande simulée ne peut pas gagner : elle joue toujours chez le
 * même hôte, sous le même emoji, sans Éclat, et ne change jamais d'avis ; et
 * jamais au quiz du jour, que ses paliers comptent (le Sphinx avec). Leur
 * rareté dépend d'une habitude ou d'un tirage, pas du jeu — le rapport les
 * signale au lieu de les dire impossibles.
 */
const NON_SIMULES = new Set([
  'hf:globe-trotteur',
  'hf:collection',
  'hf:eclats',
  'hf:girouette',
  ...HAUTS_FAITS_DE_CARRIERE.filter(h => h.duJour || h.deCampagne).map(h => h.key),
  ...HAUTS_FAITS_REGAGNABLES.filter(h => h.origine).map(h => h.key),
])
/**
 * Les légendaires que la bande peut gagner : ceux dont la première voie est
 * simulée — leurs voies du quiz du jour et de la campagne ne le sont pas. Ni
 * le Sphinx (le quiz du jour), ni ceux de saison : la bande joue sans date ;
 * ni ceux qui demandent les trois mondes à la fois.
 */
const LEGENDAIRES_SIMULES = LEGENDAIRES.flatMap(l => {
  const c = l.condition
  return 'toutes' in c || NON_SIMULES.has(c.hautFait) || l.saison ? [] : [{ ...l, condition: c }]
})


/** Ce qu'on essaie, légendaire par légendaire : la règle du catalogue, puis d'autres seuils. */
const ESSAIS: Record<string, Regle[]> = Object.fromEntries(
  LEGENDAIRES_SIMULES.map(l => {
    const c = l.condition
    const autres: Regle[] =
      'fois' in c
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].filter(n => n !== c.fois).map(n => ({ condition: { hautFait: c.hautFait, fois: n } }))
        : [1, 2, 3].filter(p => p !== c.palier).map(p => ({ condition: { hautFait: c.hautFait, palier: p } }))
    // Entre deux paliers : les seuils qu'un palier ne propose pas.
    if (c.hautFait === 'hf:reflexe') autres.push(...[150, 200, 250, 300].map(n => ({ carriere: 'reflexes' as const, seuil: n })))
    if (c.hautFait === 'hf:habitue') autres.push(...[8, 12, 15].map(n => ({ carriere: 'soirees' as const, seuil: n })))
    // Le Triplé demande trois quiz dans la soirée : à deux par soirée, on
    // regarde aussi ce que donnerait le Doublé.
    if (l.key === 'lg:dragon') autres.push(...[2, 3, 4, 5, 6].map(n => ({ condition: { hautFait: 'hf:double', fois: n } })))
    return [l.key, [{ condition: c }, ...autres]]
  }),
)

/** Les hauts faits dont on mesure la difficulté : ceux de soirée, et chaque palier de carrière. */
const CLES_MESUREES = [
  ...HAUTS_FAITS_DE_SOIREE.map(h => h.key),
  ...HAUTS_FAITS_DE_CARRIERE.flatMap(h => [1, 2, 3].map(p => clePalier(h.key, p))),
]

/** Les seuils qu'on essaie pour les écussons : ceux du catalogue (bronze, argent, or), puis d'autres. */
const ESSAIS_ECUSSONS: number[][] = [[...SEUILS_ECUSSON], [15, 60, 150], [25, 100, 250]].filter(
  (e, i, tous) => tous.findIndex(x => x.join() === e.join()) === i,
)

/** Un joueur et ses écussons, soirée après soirée, pour chaque jeu de seuils. */
interface TrajetDuSavoir {
  duJour: boolean
  /** Par jeu de seuils : les écussons (paliers additionnés sur les douze catégories) après chaque soirée. */
  ouverts: Map<string, number[]>
  /** Par jeu de seuils : les écussons d'or après chaque soirée. */
  derniers: Map<string, number[]>
}
const trajets: TrajetDuSavoir[] = []

/** Une partie du quiz du jour : dix QCM, sur les catégories du jour (pas la fête). */
function partieDuJour(j: Joueur, justes: Record<string, { justes: number }>) {
  for (let q = 0; q < 10; q++) {
    const categorie = CATEGORIES_DU_JOUR[Math.floor(hasardDuSavoir() * CATEGORIES_DU_JOUR.length)]
    const u = Math.max(1e-12, hasardDuSavoir())
    const difficulte = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * hasardDuSavoir()) * 1.1
    const p = 0.25 + 0.75 * sigmoide(1.7 * (j.niveau - difficulte))
    if (hasardDuSavoir() < p) (justes[categorie] ??= { justes: 0 }).justes++
  }
}

// ── La simulation ─────────────────────────────────────────────────────────

/** Pour chaque essai, le quiz où il tombe, joueur par joueur (Infinity : jamais dans la simulation). */
const tombes = new Map<string, number[]>()
/** Pour chaque essai, le quiz où il tombe pour le premier de chaque bande. */
const premiers = new Map<string, number[]>()
/** L'expérience de chaque joueur après chaque soirée, bande par bande. */
const experiences: number[][][] = []
/** Pour chaque haut fait et chaque palier, la soirée où il tombe la première fois, joueur par joueur. */
const premieresFois = new Map<string, number[]>()
const cle = (key: string, r: Regle) => `${key}|${decrire(r)}`

for (let b = 0; b < BANDES; b++) {
  const bande = Array.from({ length: JOUEURS }, (_, i) => inventer(`b${b}j${i}`))
  const suivis = new Map<string, Suivi>(
    bande.map(j => [j.id, { soirees: [], recompenses: new Map(), carriere: carriereDe([], { eclats: 0, niveau: 1 }) }]),
  )
  const quand = new Map<string, Map<string, number>>(bande.map(j => [j.id, new Map()]))
  const xp = new Map<string, number>(bande.map(j => [j.id, 0]))
  const trajectoires = bande.map(() => [] as number[])
  const decroches = new Map<string, Map<string, number>>(bande.map(j => [j.id, new Map()]))
  const duJour = new Map(bande.map(j => [j.id, hasardDuSavoir() < PART_DU_JOUR]))
  const justesDuJour = new Map<string, Record<string, { justes: number }>>(bande.map(j => [j.id, {}]))
  const sesTrajets = new Map<string, TrajetDuSavoir>(
    bande.map(j => [j.id, { duJour: duJour.get(j.id)!, ouverts: new Map(), derniers: new Map() }]),
  )
  for (let s = 1; s <= SOIREES; s++) {
    // Entre deux soirées, ceux qui y jouent font leurs parties du jour.
    if (s > 1) for (const j of bande) if (duJour.get(j.id)) for (let d = 0; d < PARTIES_ENTRE_DEUX; d++) partieDuJour(j, justesDuJour.get(j.id)!)
    const { live, faits, releves } = soiree(bande, s)
    const credits = new Map(
      buildProgress(live, { cloture: true, hautsFaits: new Map([...faits].map(([id, c]) => [id, xpDesHautsFaits(c)])) }).map(g => [
        g.playerId,
        g.xp,
      ]),
    )
    for (const [i, j] of bande.entries()) {
      const suivi = suivis.get(j.id)!
      // Comme à la clôture : les hauts faits de la soirée se rangent, la
      // carrière s'additionne, et les paliers tombent sur elle — chacun avec
      // son expérience. La Légende, qui suit le niveau, est laissée de côté :
      // elle dépend de la courbe qu'on essaie.
      for (const f of faits.get(j.id) ?? []) suivi.recompenses.set(f, (suivi.recompenses.get(f) ?? 0) + 1)
      const x = releves.get(j.id)
      if (x) suivi.soirees.push({ releve: x.releve, gain: x.gain, spaceId: 'bande' })
      suivi.carriere = carriereDe(suivi.soirees, { eclats: 0, niveau: 1 })
      // Ses bonnes réponses par catégorie, comme les compte le profil : les
      // soirées qui comptent, et le quiz du jour.
      const savoir = justesParCategorie(suivi.carriere.categories, justesDuJour.get(j.id)!)
      const trajet = sesTrajets.get(j.id)!
      for (const seuils of ESSAIS_ECUSSONS) {
        const k = seuils.join(' ')
        const n = CATEGORIES.reduce((t, c) => t + seuils.filter(x => savoir[c] >= x).length, 0)
        const d = CATEGORIES.filter(c => savoir[c] >= seuils[seuils.length - 1]).length
        trajet.ouverts.set(k, [...(trajet.ouverts.get(k) ?? []), n])
        trajet.derniers.set(k, [...(trajet.derniers.get(k) ?? []), d])
      }
      let gagne = credits.get(j.id) ?? 0
      for (const palier of paliersAtteints(suivi.carriere)) {
        if (!suivi.recompenses.has(palier)) gagne += XP_PALIER[palierDe(palier)!.palier - 1]
        suivi.recompenses.set(palier, 1)
      }
      xp.set(j.id, xp.get(j.id)! + gagne)
      trajectoires[i].push(xp.get(j.id)!)
      // La première soirée de chaque haut fait. La Légende suit le niveau, que
      // la carrière simulée ne porte pas : il se lit sur la courbe du jour.
      const siens = decroches.get(j.id)!
      for (const f of suivi.recompenses.keys()) if (!siens.has(f)) siens.set(f, s)
      const niveau = niveauPour(xp.get(j.id)!)
      for (const [palier, seuil] of [[1, 10], [2, 20], [3, 30]]) {
        const f = clePalier('hf:legende', palier)
        if (niveau >= seuil && !siens.has(f)) siens.set(f, s)
      }
      const siennes = quand.get(j.id)!
      for (const [key, essais] of Object.entries(ESSAIS)) {
        for (const r of essais) {
          const k = cle(key, r)
          if (!siennes.has(k) && tenue(r, suivi)) siennes.set(k, s * QUIZ_PAR_SOIREE)
        }
      }
    }
  }
  for (const [key, essais] of Object.entries(ESSAIS)) {
    for (const r of essais) {
      const k = cle(key, r)
      const liste = tombes.get(k) ?? []
      const siens = bande.map(j => quand.get(j.id)!.get(k) ?? Infinity)
      liste.push(...siens)
      tombes.set(k, liste)
      premiers.set(k, [...(premiers.get(k) ?? []), Math.min(...siens)])
    }
  }
  experiences.push(trajectoires)
  trajets.push(...sesTrajets.values())
  for (const [, siens] of decroches) {
    for (const cle of CLES_MESUREES) {
      const xs = premieresFois.get(cle) ?? []
      xs.push(siens.get(cle) ?? Infinity)
      premieresFois.set(cle, xs)
    }
  }
}

// ── Le rapport ────────────────────────────────────────────────────────────

const quantile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.floor(q * (xs.length - 1))]
const ecrire = (n: number) => (Number.isFinite(n) ? String(n) : `>${SOIREES * QUIZ_PAR_SOIREE}`)

console.log(
  `${QUIZ_PAR_SOIREE} quiz × ${QUESTIONS_PAR_QUIZ} questions, ${JOUEURS} joueurs, ` +
    `${BANDES} bandes × ${SOIREES} soirées (${SOIREES * QUIZ_PAR_SOIREE} quiz chacune)\n`,
)
console.log('légendaire      règle                    1er de la bande  quart le + doué  médiane  ≤ 20 quiz')
for (const l of LEGENDAIRES) {
  if (!ESSAIS[l.key]) {
    console.log(`${l.nom.padEnd(16).slice(0, 16)}  ${(l.saison ? 'non simulé : sa saison' : 'non simulé : le quiz du jour').padEnd(25)}`)
    continue
  }
  for (const [i, r] of ESSAIS[l.key].entries()) {
    const xs = tombes.get(cle(l.key, r))!
    const part = xs.filter(x => x <= 20).length / xs.length
    const regle = decrire(r)
    console.log(
      `${(i === 0 ? l.nom : '').padEnd(16).slice(0, 16)}${(i === 0 ? '* ' : '  ') + regle.padEnd(25)}` +
        `${ecrire(quantile(premiers.get(cle(l.key, r))!, 0.5)).padStart(8)}` +
        `${ecrire(quantile(xs, 0.25)).padStart(15)}${ecrire(quantile(xs, 0.5)).padStart(14)}${`${Math.round(part * 100)} %`.padStart(10)}`,
    )
  }
}
console.log('\n* la règle du catalogue')

// ── Les niveaux ───────────────────────────────────────────────────────────

/** Le niveau que donne cette expérience sur une courbe de ce pas (`niveauPour`). */
const niveauSur = (pas: number, xpTotale: number) => Math.floor(Math.sqrt(Math.max(0, xpTotale) / pas)) + 1
const COURBES = [...new Set([XP_PAR_PALIER, 25, 50, 60, 75, 100, 125, 150])]
const REPERES = [1, 3, 5, 10, 20, 40].filter(s => s <= SOIREES)
/** La première soirée où l'on atteint ce niveau (Infinity : jamais dans la simulation). */
const atteint = (pas: number, trajectoire: number[], niveau: number) => {
  const i = trajectoire.findIndex(x => niveauSur(pas, x) >= niveau)
  return i < 0 ? Infinity : i + 1
}
const soirees = (n: number) => (Number.isFinite(n) ? String(n) : `>${SOIREES}`)

console.log(`\nNiveaux — joueur médian · meilleur de la bande, après n soirées ; « niv. 10 » : soirées pour y arriver`)
console.log(`${'courbe'.padEnd(12)}${REPERES.map(s => `après ${s}`.padStart(11)).join('')}${'niv. 10'.padStart(11)}${'niv. 2 le 1er soir'.padStart(20)}`)
for (const pas of COURBES) {
  const cellules = REPERES.map(s => {
    const tous = experiences.flatMap(b => b.map(t => niveauSur(pas, t[s - 1])))
    const meilleurs = experiences.map(b => Math.max(...b.map(t => niveauSur(pas, t[s - 1]))))
    return `${quantile(tous, 0.5)} · ${quantile(meilleurs, 0.5)}`.padStart(11)
  })
  const dix = experiences.flatMap(b => b.map(t => atteint(pas, t, 10)))
  const dixMeilleurs = experiences.map(b => Math.min(...b.map(t => atteint(pas, t, 10))))
  const deux = experiences.flatMap(b => b.map(t => niveauSur(pas, t[0]) >= 2)).filter(Boolean).length / (BANDES * JOUEURS)
  console.log(
    `${`${pas === XP_PAR_PALIER ? '* ' : '  '}${pas} × (n−1)²`.padEnd(12)}${cellules.join('')}` +
      `${`${soirees(quantile(dix, 0.5))} · ${soirees(quantile(dixMeilleurs, 0.5))}`.padStart(11)}${`${Math.round(deux * 100)} %`.padStart(20)}`,
  )
}
console.log('\n* la courbe du jour (XP_PAR_PALIER)')

// ── La rareté des hauts faits ─────────────────────────────────────────────

const REPERES_RARETE = [10, 20, 40].filter(n => n <= SOIREES)
const part = (xs: number[], soirees: number) => xs.filter(x => x <= soirees).length / xs.length
/**
 * La part des joueurs qui l'ont, soirée après soirée, en moyenne sur toutes :
 * un palier que tout le monde finit par avoir, mais tard (L'Habitué · Or, à
 * vingt-cinq soirées), passe ainsi après un exploit que presque personne n'a
 * — au bout de vingt soirées seulement, il comptait pour introuvable.
 */
const partMoyenne = (xs: number[]) => xs.reduce((n, x) => n + Math.max(0, SOIREES - x + 1), 0) / (xs.length * SOIREES)
console.log(`\nRareté — part des joueurs qui ont chaque haut fait au bout de n soirées, et en moyenne sur les ${SOIREES}`)
console.log(`${'haut fait'.padEnd(26)}${REPERES_RARETE.map(n => `${n} soirées`.padStart(12)).join('')}${'moyenne'.padStart(12)}`)
const mesurees: [string, number][] = []
for (const cle of CLES_MESUREES) {
  if (NON_SIMULES.has(cle.replace(/:[123]$/, ''))) {
    console.log(`${cle.padEnd(26)}${'non simulé'.padStart(12)}`)
    continue
  }
  const xs = premieresFois.get(cle) ?? []
  const pc = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`.padStart(12)
  console.log(`${cle.padEnd(26)}${REPERES_RARETE.map(n => pc(part(xs, n))).join('')}${pc(partMoyenne(xs))}`)
  mesurees.push([cle, partMoyenne(xs)])
}
// Ce qui se recopie dans `PART_DES_JOUEURS`, moyenné sur les trois formats de
// RECOMPENSES.md (5.2) : un seul format ferait du Triplé un impossible.
console.log(`\nPART_DES_JOUEURS (moyenne sur les ${SOIREES} soirées) :`)
for (const [cle, p] of mesurees) console.log(`  '${cle}': ${p.toFixed(4)},`)

// ── Les écussons de savoir ────────────────────────────────────────────────

const REPERES_SAVOIR = [1, 3, 5, 10, 20, 40].filter(n => n <= SOIREES)
/** Les soirées dont on regarde si elles donnent un écusson : les vingt premières. */
const PREMIERES = Math.min(20, SOIREES)
console.log(
  `\nÉcussons de savoir — ${Math.round(PART_THEMES * 100)} % de quiz à thème, ${Math.round(PART_CLASSEES * 100)} % des questions ` +
    `classées dans les autres ; ${Math.round(PART_DU_JOUR * 100)} % des joueurs font ${PARTIES_ENTRE_DEUX} parties du jour entre deux soirées`,
)
console.log(
  `Écussons (sur ${CATEGORIES.length * 3}) : médiane · 9e décile, après n soirées ; « donnent » : part médiane des ` +
    `${PREMIERES} premières soirées qui en donnent un ; « 1er soir » : qui en a un après la première ; « un or » : qui a un écusson d'or après ${SOIREES}`,
)
for (const [nom, groupe] of [
  ['soirées seules', trajets.filter(t => !t.duJour)],
  ['avec le quiz du jour', trajets.filter(t => t.duJour)],
] as const) {
  console.log(`\n${nom} (${groupe.length} joueurs)`)
  console.log(
    `${'seuils'.padEnd(26)}${REPERES_SAVOIR.map(n => `après ${n}`.padStart(11)).join('')}${'donnent'.padStart(10)}${'1er soir'.padStart(10)}${'un or'.padStart(8)}`,
  )
  for (const seuils of ESSAIS_ECUSSONS) {
    const k = seuils.join(' ')
    const cellules = REPERES_SAVOIR.map(n => {
      const xs = groupe.map(t => t.ouverts.get(k)![n - 1])
      return `${quantile(xs, 0.5)} · ${quantile(xs, 0.9)}`.padStart(11)
    })
    const ouvrent = groupe.map(t => {
      const o = t.ouverts.get(k)!
      return o.slice(0, PREMIERES).filter((x, i) => x > (i === 0 ? 0 : o[i - 1])).length / PREMIERES
    })
    const premierSoir = groupe.filter(t => t.ouverts.get(k)![0] > 0).length / groupe.length
    const unOr = groupe.filter(t => t.derniers.get(k)![SOIREES - 1] > 0).length / groupe.length
    const pc = (x: number) => `${Math.round(x * 100)} %`
    console.log(
      `${`${seuils === ESSAIS_ECUSSONS[0] ? '* ' : '  '}${k}`.padEnd(26)}${cellules.join('')}` +
        `${pc(quantile(ouvrent, 0.5)).padStart(10)}${pc(premierSoir).padStart(10)}${pc(unOr).padStart(8)}`,
    )
  }
}
console.log('\n* les seuils du catalogue (SEUILS_ECUSSON)')
