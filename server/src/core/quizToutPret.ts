import { CATEGORIES, type Categorie } from '../../../shared/categories'
import { NIVEAUX, niveauDeQuestion, type Niveau } from '../../../shared/campagne'
import type { Aleatoire } from '../../../shared/hasard'
import { DEFAULT_DURATION, MAX_UNIT, type QuizDef, type QuizQuestionDef } from '../../../shared/library'
import { lireNombreEnTete } from '../../../shared/nombres'
import {
  AGE_DES_ENFANTS,
  DIFFICULTES_DU_QUIZ,
  DUREE_D_UNE_ESTIMATION,
  NOMBRE_DU_QUIZ_PAR_DEFAUT,
  UNE_ESTIMATION_SUR,
  type ChoixDuQuiz,
  type DifficulteDuQuiz,
} from '../../../shared/quizToutPret'
import { sujetParCle } from '../../../shared/sujets'
import type { QuestionDeLaBase } from './baseCampagne'
import { empreinteDe } from './jour'

/**
 * Un quiz tout prêt, tiré de la base de la campagne (`shared/quizToutPret.ts`
 * dit pourquoi). Le tirage est une dérivation pure : la base, ses mesures,
 * ce que l'espace a déjà, et le hasard qu'on lui passe — les épreuves le
 * fixent.
 */

/** Cinq questions au moins : en dessous, le podium du quiz ne rapporte rien (`TIRAGE_MIN`). */
export const NOMBRE_MIN = 5
/** Cinquante au plus : la moitié de ce qu'un quiz tient (`MAX_QUESTIONS`), de quoi le retoucher. */
export const NOMBRE_MAX = 50

/**
 * L'identifiant d'une question tirée, dans le quiz : le sien dans la base,
 * préfixé. Il ne change pas d'un quiz à l'autre, et la mémoire des soirées
 * (`core/memoire.ts`), qui suit les questions par leur identifiant, sait
 * qu'elle a déjà été posée — même dans un quiz supprimé depuis.
 */
export const idDansLeQuiz = (idDeLaBase: string) => `base-${idDeLaBase}`

/** Le choix envoyé par un navigateur, ou null s'il ne se lit pas. Ce qui manque prend sa valeur par défaut. */
export function lireChoixDuQuiz(brut: unknown): ChoixDuQuiz | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null
  const b = brut as Record<string, unknown>
  const categories = b.categories ?? []
  if (!Array.isArray(categories) || categories.some(c => !(CATEGORIES as readonly unknown[]).includes(c))) return null
  const sujet = b.sujet ?? null
  if (sujet !== null && !sujetParCle(sujet)) return null
  const difficulte = b.difficulte ?? 'progressive'
  if (!DIFFICULTES_DU_QUIZ.some(d => d.cle === difficulte)) return null
  const nombre = b.nombre ?? NOMBRE_DU_QUIZ_PAR_DEFAUT
  if (typeof nombre !== 'number' || !Number.isInteger(nombre) || nombre < NOMBRE_MIN || nombre > NOMBRE_MAX) return null
  if (b.enfants !== undefined && typeof b.enfants !== 'boolean') return null
  if (b.estimations !== undefined && typeof b.estimations !== 'boolean') return null
  return {
    // Dans l'ordre de la liste, pas dans celui des touchers : le titre se lit pareil.
    categories: CATEGORIES.filter(c => categories.includes(c)),
    sujet: sujet as string | null,
    difficulte: difficulte as DifficulteDuQuiz,
    nombre,
    enfants: b.enfants === true,
    estimations: b.estimations === true,
  }
}

/**
 * Combien de questions de chaque marche, dans l'ordre où elles se jouent.
 * Facile : que des faciles. Progressive : deux cinquièmes de faciles, deux
 * de moyennes, un de difficiles — la salle se met en jambes, puis on
 * départage. Corsée : un cinquième de moyennes pour s'échauffer, des
 * difficiles, et des expertes pour finir. Ailleurs, jamais d'experte : en
 * soirée, une question que trois joueurs sur quatre ratent fait taire la
 * salle.
 */
export function planDuQuiz(difficulte: DifficulteDuQuiz, nombre: number): { niveau: Niveau; n: number }[] {
  const part = (p: number) => Math.round(nombre * p)
  const plan: [Niveau, number][] =
    difficulte === 'facile'
      ? [['facile', nombre]]
      : difficulte === 'progressive'
        ? [
            ['facile', part(0.4)],
            ['moyen', nombre - part(0.4) - part(0.2)],
            ['difficile', part(0.2)],
          ]
        : [
            ['moyen', part(0.2)],
            ['difficile', nombre - part(0.2) - part(0.2)],
            ['expert', part(0.2)],
          ]
  return plan.filter(([, n]) => n > 0).map(([niveau, n]) => ({ niveau, n }))
}

/**
 * Les marches où une estimation se tire : comme ses QCM, un quiz facile n'en
 * prend que de faciles et de moyennes, et seul un quiz corsé prend une
 * experte — « En quelle année Michelin a-t-il ajouté sa troisième étoile ? ».
 */
const MARCHES_DES_ESTIMATIONS: Record<DifficulteDuQuiz, readonly Niveau[]> = {
  facile: ['facile', 'moyen'],
  progressive: ['facile', 'moyen', 'difficile'],
  corsee: NIVEAUX,
}

/** « Lequel de ces… », « parmi » : un intitulé qui suppose des choix ne se pose pas sans eux. */
const FORMULE_DE_QCM = /\b(parmi|de ces|lequel|laquelle|lesquels|lesquelles|ci-dessous)\b/i

/**
 * Ce qu'une question de la base vise, jouée en estimation — ou null. Sa
 * bonne réponse doit être ce nombre (`valeur`, que la base donne aussi à une
 * question dont un nombre n'est qu'un détail) ; plus de dix, ou à virgule :
 * « Combien d'anneaux sur le drapeau olympique ? » se devine, ne s'estime
 * pas ; et son intitulé doit se lire sans les choix. Une unité trop longue
 * pour l'écran (`MAX_UNIT` : « images par seconde ») s'efface — l'intitulé
 * la dit déjà.
 */
export function cibleDeLEstimation(q: QuestionDeLaBase): { target: number; unit: string } | null {
  const valeur = q.meta.valeur
  if (!valeur || q.reponses.length !== 4) return null
  if (Number.isInteger(valeur.nombre) && valeur.nombre <= 10) return null
  if (lireNombreEnTete(q.reponses[q.bonne])?.valeur !== valeur.nombre) return null
  if (FORMULE_DE_QCM.test(q.texte)) return null
  return { target: valeur.nombre, unit: Array.from(valeur.unite).length <= MAX_UNIT ? valeur.unite : '' }
}

/**
 * Les places des estimations parmi `total` questions, réparties : jamais la
 * première — la salle se met en jambes d'un toucher —, et l'une après
 * l'autre si elles se suivent faute de QCM.
 */
export function placesDesEstimations(total: number, estimations: number): number[] {
  return Array.from({ length: estimations }, (_, i) => Math.round(((i + 1) * total) / (estimations + 1)) - 1)
}

/** Où emprunter quand une marche manque de questions : la plus proche d'abord. */
const VOISINES: Record<Niveau, readonly Niveau[]> = {
  facile: ['moyen'],
  moyen: ['facile', 'difficile'],
  difficile: ['moyen', 'expert'],
  expert: ['difficile'],
}

/** Ce que l'espace a déjà : rien de sa bibliothèque ne revient, et ce que ses soirées ont posé passe après le reste. */
export interface DejaDansLEspace {
  /** Les identifiants des questions de sa bibliothèque, quiz archivés compris. */
  ids: ReadonlySet<string>
  /** Leurs intitulés (`empreinteDe`) : un quiz dupliqué change les identifiants, pas les intitulés. */
  empreintes: ReadonlySet<string>
  /** Les questions que ses soirées ont posées, et quand pour la dernière fois (`dernieresFois`). */
  posees: ReadonlyMap<string, number>
}

export function dejaDansLEspace(bibliotheque: readonly Pick<QuizDef, 'questions'>[], posees: ReadonlyMap<string, number>): DejaDansLEspace {
  const ids = new Set<string>()
  const empreintes = new Set<string>()
  for (const quiz of bibliotheque) {
    for (const q of quiz.questions) {
      if (q.id) ids.add(q.id)
      if (q.text) empreintes.add(empreinteDe(q.text))
    }
  }
  return { ids, empreintes, posees }
}

/** Combien de fois chaque catégorie et chaque sous-thème ont déjà servi, d'une marche à l'autre. */
interface Servies {
  categories: Map<string, number>
  sousThemes: Map<string, number>
}

const compte = (m: ReadonlyMap<string, number>, cle: string) => m.get(cle) ?? 0
const cleDuSousTheme = (q: QuestionDeLaBase) => `${q.meta.categorie}\u0000${q.meta.sousTheme}`

/**
 * `n` questions de `dispo`, les catégories à tour de rôle — la moins servie
 * du quiz d'abord, d'une marche à l'autre : sans ce compte commun, chaque
 * marche repartait de zéro, et l'histoire pouvait ouvrir les trois pendant
 * que le sport n'en avait aucune —, puis dans chacune son sous-thème le
 * moins servi ; à égalité, l'ordre reçu.
 */
function aTourDeRole(dispo: readonly QuestionDeLaBase[], n: number, servies: Servies): QuestionDeLaBase[] {
  const files = new Map<string, QuestionDeLaBase[]>()
  for (const q of dispo) {
    const file = files.get(q.meta.categorie)
    if (file) file.push(q)
    else files.set(q.meta.categorie, [q])
  }
  const tirees: QuestionDeLaBase[] = []
  while (tirees.length < n) {
    let categorie: string | null = null
    for (const [c, file] of files) {
      if (file.length > 0 && (categorie === null || compte(servies.categories, c) < compte(servies.categories, categorie))) categorie = c
    }
    if (categorie === null) break
    const file = files.get(categorie)!
    let k = 0
    for (let i = 1; i < file.length; i++) {
      if (compte(servies.sousThemes, cleDuSousTheme(file[i])) < compte(servies.sousThemes, cleDuSousTheme(file[k]))) k = i
    }
    const [q] = file.splice(k, 1)
    tirees.push(q)
    servies.categories.set(categorie, compte(servies.categories, categorie) + 1)
    servies.sousThemes.set(cleDuSousTheme(q), compte(servies.sousThemes, cleDuSousTheme(q)) + 1)
  }
  return tirees
}

/** Une permutation au hasard (Fisher-Yates) : à fraîcheur égale, deux quiz composés pareil ne se ressemblent pas. */
function battre<T>(items: readonly T[], aleatoire: Aleatoire): T[] {
  const copie = [...items]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(aleatoire() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

/** Une question de la base jouée en estimation : sa cible et son unité, trente secondes pour taper. */
function versLEstimation(q: QuestionDeLaBase, cible: { target: number; unit: string }): QuizQuestionDef {
  return {
    id: idDansLeQuiz(q.id),
    kind: 'number',
    text: q.texte,
    answers: [],
    correct: 0,
    target: cible.target,
    unit: cible.unit,
    duration: DUREE_D_UNE_ESTIMATION,
    image: null,
    observeSeconds: null,
    category: q.meta.categorie,
    ...(q.anecdote && { anecdote: q.anecdote }),
  }
}

/** Une question de la base, telle qu'un quiz la garde : un QCM ordinaire, sa catégorie, son anecdote à la révélation. */
function versLeQuiz(q: QuestionDeLaBase): QuizQuestionDef {
  return {
    id: idDansLeQuiz(q.id),
    kind: 'choice',
    text: q.texte,
    answers: [...q.reponses],
    correct: q.bonne,
    target: null,
    unit: '',
    duration: DEFAULT_DURATION,
    image: null,
    observeSeconds: null,
    category: q.meta.categorie,
    ...(q.anecdote && { anecdote: q.anecdote }),
  }
}

/**
 * Les questions d'un quiz tout prêt, dans l'ordre où elles se jouent : les
 * marches du plan (`planDuQuiz`), les catégories à tour de rôle dans chacune
 * — et, s'il en veut, une estimation sur cinq, tirée d'abord, placée à
 * intervalles (`placesDesEstimations`). Rien de ce que sa bibliothèque a
 * déjà ; d'abord ce que ses soirées n'ont jamais posé, puis ce qu'elles ont
 * posé il y a le plus longtemps — qui joue souvent avec les mêmes amis ne
 * leur repose pas les mêmes questions. Une marche qui manque de questions
 * emprunte à sa voisine : mieux vaut une question un peu plus dure qu'une
 * question déjà posée. Moins que demandé quand le choix est étroit, moins
 * d'estimations quand la base n'en a pas ; jamais une question deux fois.
 *
 * `mesures` : la part de joueurs de la campagne qui ont trouvé chaque
 * question — ce qui corrige sa difficulté estimée (`niveauDeQuestion`).
 */
export function composerUnQuiz(
  questions: readonly QuestionDeLaBase[],
  sujetsDe: (q: QuestionDeLaBase) => readonly string[],
  mesures: ReadonlyMap<string, { justes: number; total: number }>,
  choix: ChoixDuQuiz,
  deja: DejaDansLEspace,
  aleatoire: Aleatoire = Math.random,
): QuizQuestionDef[] {
  const filtre = choix.categories.length > 0 ? new Set<string>(choix.categories) : null
  const parNiveau = new Map<Niveau, QuestionDeLaBase[]>(NIVEAUX.map(n => [n, []]))
  const cibles = new Map<string, { target: number; unit: string }>()
  const marchesDesEstimations = new Set(MARCHES_DES_ESTIMATIONS[choix.difficulte])
  const estimables: QuestionDeLaBase[] = []
  for (const q of battre(questions, aleatoire)) {
    if (choix.sujet ? !sujetsDe(q).includes(choix.sujet) : filtre && !filtre.has(q.meta.categorie)) continue
    if (choix.enfants && q.meta.ageMin > AGE_DES_ENFANTS) continue
    if (deja.ids.has(idDansLeQuiz(q.id)) || deja.empreintes.has(q.empreinte)) continue
    const niveau = niveauDeQuestion(q.meta.difficulte, mesures.get(q.id))
    parNiveau.get(niveau)!.push(q)
    const cible = choix.estimations && marchesDesEstimations.has(niveau) ? cibleDeLEstimation(q) : null
    if (cible) {
      cibles.set(q.id, cible)
      estimables.push(q)
    }
  }
  const poseeLe = (q: QuestionDeLaBase) => deja.posees.get(idDansLeQuiz(q.id))
  /** Les jamais posées, au hasard du battage ; ou les posées, la plus anciennement d'abord. */
  const deLaPasse = (dispo: readonly QuestionDeLaBase[], fraiches: boolean) => {
    const ici = dispo.filter(q => !prises.has(q.id) && (poseeLe(q) === undefined) === fraiches)
    return fraiches ? ici : ici.sort((a, b) => poseeLe(a)! - poseeLe(b)!)
  }
  const prises = new Set<string>()
  const servies: Servies = { categories: new Map(), sousThemes: new Map() }

  // Les estimations d'abord : la base en a peu, et le tour de rôle des
  // catégories, commun, range ensuite les QCM autour d'elles.
  const voulues = choix.estimations ? Math.round(choix.nombre / UNE_ESTIMATION_SUR) : 0
  const estimations: QuestionDeLaBase[] = []
  for (const fraiches of [true, false]) {
    for (const q of aTourDeRole(deLaPasse(estimables, fraiches), voulues - estimations.length, servies)) {
      prises.add(q.id)
      estimations.push(q)
    }
  }

  const plan = planDuQuiz(choix.difficulte, choix.nombre - estimations.length)
  const marches: QuestionDeLaBase[][] = plan.map(() => [])
  for (const fraiches of [true, false]) {
    plan.forEach((marche, i) => {
      for (const niveau of [marche.niveau, ...VOISINES[marche.niveau]]) {
        const manque = marche.n - marches[i].length
        if (manque <= 0) break
        for (const q of aTourDeRole(deLaPasse(parNiveau.get(niveau)!, fraiches), manque, servies)) {
          prises.add(q.id)
          marches[i].push(q)
        }
      }
    })
  }

  const qcm = marches.flat()
  const total = qcm.length + estimations.length
  const places = placesDesEstimations(total, estimations.length)
  const quiz: QuizQuestionDef[] = []
  for (let i = 0, e = 0, c = 0; i < total; i++) {
    // Sa place venue — ou plus un QCM pour la remplir —, l'estimation suivante.
    if (e < estimations.length && (i >= places[e] || c >= qcm.length)) {
      const q = estimations[e++]
      quiz.push(versLEstimation(q, cibles.get(q.id)!))
    } else quiz.push(versLeQuiz(qcm[c++]))
  }
  return quiz
}

/**
 * Son titre : « Histoire · 15 questions », « Les années 80 · 10 questions
 * faciles », « Un peu de tout · 30 questions corsées ». Trois catégories
 * nommées au plus : le titre tient sur une ligne de « Mes quiz ».
 */
export function titreDuQuizToutPret(choix: ChoixDuQuiz, nombre: number): string {
  const c: readonly Categorie[] = choix.categories
  const sujet = choix.sujet ? sujetParCle(choix.sujet)?.nom : undefined
  const de =
    sujet ??
    (c.length === 0 || c.length === CATEGORIES.length
      ? 'Un peu de tout'
      : c.length === 1
        ? c[0]
        : c.length === 2
          ? `${c[0]} et ${c[1]}`
          : c.length === 3
            ? `${c[0]}, ${c[1]} et ${c[2]}`
            : `${c[0]}, ${c[1]} et ${c.length - 2} autres`)
  const adjectif = choix.difficulte === 'facile' ? ' faciles' : choix.difficulte === 'corsee' ? ' corsées' : ''
  return `${de} · ${nombre} question${nombre > 1 ? 's' : ''}${adjectif}`
}
