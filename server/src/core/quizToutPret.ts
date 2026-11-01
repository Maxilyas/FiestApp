import { CATEGORIES, type Categorie } from '../../../shared/categories'
import { NIVEAUX, niveauDeQuestion, type MesureDUneQuestion, type Niveau } from '../../../shared/campagne'
import type { Aleatoire } from '../../../shared/hasard'
import { DEFAULT_DURATION, type QuizDef, type QuizQuestionDef } from '../../../shared/library'
import {
  AGE_DES_ENFANTS,
  DIFFICULTES_DU_QUIZ,
  DUREE_D_UNE_ESTIMATION,
  NOMBRE_DU_QUIZ_PAR_DEFAUT,
  UNE_ESTIMATION_SUR,
  nommerLesCategories,
  type ChoixDuQuiz,
  type DifficulteDuQuiz,
} from '../../../shared/quizToutPret'
import { rubriqueDe, sujetParCle } from '../../../shared/sujets'
import type { QuestionDeLaBase } from './baseCampagne'
import { cibleDeLEstimation, lireLEstimation } from './estimation'
import { empreinteDe } from './jour'
import { DejaPrises } from './jumelles'
import { reponsesAuRangTire } from './rangDeLaBonne'

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

/** L'inverse : l'identifiant dans la base d'une question tirée — null pour une question écrite à la main. */
export const idDeLaBase = (dansLeQuiz: string | undefined) => (dansLeQuiz?.startsWith('base-') ? dansLeQuiz.slice('base-'.length) : null)

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
 * Les marches où une estimation se tire : celles de ses QCM (`planDuQuiz`).
 * Un quiz facile n'en prend que de faciles, un quiz corsé jamais une facile,
 * et seul un quiz corsé prend une experte — « En quelle année Michelin
 * a-t-il ajouté sa troisième étoile ? ». « Combien font 6 × 7 ? » tombait
 * dans « 30 questions corsées », la guerre des Six Jours dans « 10 questions
 * faciles » (l'expert du quiz tout prêt, le 11 octobre 2026).
 */
const MARCHES_DES_ESTIMATIONS: Record<DifficulteDuQuiz, readonly Niveau[]> = {
  facile: ['facile'],
  progressive: ['facile', 'moyen', 'difficile'],
  corsee: ['moyen', 'difficile', 'expert'],
}

// Ce qu'une question vise jouée au plus près, et pourquoi elle ne s'y prête pas :
// une règle à part (`core/estimation.ts`), que le Filet du Cabinet lit aussi.
// Réexportée pour ses lecteurs d'avant — `verifier --nombres`, les épreuves.
export { cibleDeLEstimation, lireLEstimation }

/** Une année seule, telle qu'une réponse l'écrit : « 1988 », « -52 ». */
const ANNEE_SEULE = /^-?\d{1,4}$/

/**
 * Un QCM d'années dont seule la bonne tombe dans l'époque que le titre
 * annonce : « Les années 80 », et 1972, 1992, 1997 ou 1988 pour la création
 * du GIEC — le titre, en tête de chaque question à l'écran commun, soufflait
 * la réponse (l'expert du quiz tout prêt, le 11 octobre 2026).
 */
export function souffleeParLEpoque(q: Pick<QuestionDeLaBase, 'reponses' | 'bonne'>, [debut, fin]: readonly [number, number]): boolean {
  const annees = q.reponses.map(r => (ANNEE_SEULE.test(r.trim()) ? Number(r.trim()) : null))
  if (annees.some(a => a === null)) return false
  const dedans = (a: number | null) => a !== null && a >= debut && a <= fin
  return dedans(annees[q.bonne]) && annees.filter(dedans).length === 1
}

/** L'âge que la base donne à « ce qu'un enfant connaît avant de bien lire » (`consigneCampagne.ts`). */
const AGE_DES_PETITS = 6

/**
 * « Des enfants jouent » : ce qu'un enfant connaît — l'âge de six ans, ou une
 * facile de dix ans. L'âge de la base dit ce qu'un enfant comprend, pas ce
 * qu'il sait : filtré à dix ans seulement, trois questions sur quatre
 * passaient, et Tati, Nougaro et Tarantino entraient dans un quiz d'enfants
 * (l'expert du quiz tout prêt, le 11 octobre 2026). Le reste de dix ans ne
 * vient plus qu'en dernier recours (`composerUnQuiz`).
 */
export const pourUnEnfant = (q: QuestionDeLaBase) => q.meta.ageMin <= AGE_DES_PETITS || (q.meta.ageMin <= AGE_DES_ENFANTS && q.meta.difficulte <= 1)

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

/** Combien de fois chaque catégorie et chaque sous-thème ont déjà servi, d'une marche à l'autre — et les questions déjà prises, pour reconnaître leurs jumelles. */
interface Servies {
  categories: Map<string, number>
  sousThemes: Map<string, number>
  deja: DejaPrises
}

const compte = (m: ReadonlyMap<string, number>, cle: string) => m.get(cle) ?? 0
const cleDuSousTheme = (q: QuestionDeLaBase) => `${q.meta.categorie}\u0000${q.meta.sousTheme}`

/**
 * `n` questions de `dispo`, les catégories à tour de rôle — la moins servie
 * du quiz d'abord, d'une marche à l'autre : sans ce compte commun, chaque
 * marche repartait de zéro, et l'histoire pouvait ouvrir les trois pendant
 * que le sport n'en avait aucune —, puis dans chacune son sous-thème le
 * moins servi, et, de ce sous-thème, une question qui n'est la jumelle
 * d'aucune déjà prise (`jumelles`) : un quiz de géographie de vingt
 * questions posait deux capitales, un quiz de cinéma deux « Qui a réalisé le
 * film… » (le 12 octobre 2026). À égalité, l'ordre reçu.
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
    let moins = Infinity
    for (const q of file) moins = Math.min(moins, compte(servies.sousThemes, cleDuSousTheme(q)))
    // La première du sous-thème le moins servi qui n'est pas une jumelle ; toutes jumelles, la première.
    let k = -1
    let premiere = -1
    for (let i = 0; i < file.length; i++) {
      if (compte(servies.sousThemes, cleDuSousTheme(file[i])) !== moins) continue
      if (premiere < 0) premiere = i
      if (!servies.deja.jumelle(file[i])) {
        k = i
        break
      }
    }
    const [q] = file.splice(k < 0 ? premiere : k, 1)
    tirees.push(q)
    servies.categories.set(categorie, compte(servies.categories, categorie) + 1)
    servies.sousThemes.set(cleDuSousTheme(q), compte(servies.sousThemes, cleDuSousTheme(q)) + 1)
    servies.deja.prendre(q)
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

/**
 * Une question de la base, telle qu'un quiz la garde : un QCM ordinaire, sa
 * catégorie, son anecdote à la révélation. Des années, des nombres, des
 * jours : le rang de la bonne se tire, ses leurres avec (`reponsesAuRangTire`)
 * — sauf si ce tirage laissait la bonne seule dans l'époque du titre, ce que
 * la question écrite ne faisait pas (`souffleeParLEpoque`).
 */
function versLeQuiz(q: QuestionDeLaBase, aleatoire: Aleatoire, epoque?: readonly [number, number]): QuizQuestionDef {
  const tirees = reponsesAuRangTire(q, aleatoire)
  const { reponses, bonne } = tirees && !(epoque && souffleeParLEpoque(tirees, epoque)) ? tirees : q
  return {
    id: idDansLeQuiz(q.id),
    kind: 'choice',
    text: q.texte,
    answers: [...reponses],
    correct: bonne,
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
 * Une passe du tirage : les jamais posées ou les posées ; si des enfants
 * jouent, ce qu'un enfant connaît seulement ; et les réponses soufflées par
 * leur racine, aux dernières passes seulement.
 */
interface Passe {
  fraiches: boolean
  enfantines: boolean
  soufflees: boolean
}

/**
 * Les questions d'un quiz tout prêt, dans l'ordre où elles se jouent : les
 * marches du plan (`planDuQuiz`), les catégories à tour de rôle dans chacune,
 * sans deux jumelles quand il y a mieux (`aTourDeRole`)
 * — et, s'il en veut, une estimation sur cinq, tirée d'abord, sur le même
 * plan, placée à intervalles (`placesDesEstimations`). Rien de ce que sa
 * bibliothèque a déjà ; d'abord ce que ses soirées n'ont jamais posé, puis
 * ce qu'elles ont posé il y a le plus longtemps — qui joue souvent avec les
 * mêmes amis ne leur repose pas les mêmes questions. Des enfants jouent :
 * ce qu'un enfant connaît passe devant, même déjà posé (`pourUnEnfant`).
 * Une marche qui manque de questions emprunte à sa voisine : mieux vaut une
 * question un peu plus dure qu'une question déjà posée. Moins que demandé
 * quand le choix est étroit, moins d'estimations quand la base n'en a pas ;
 * jamais une question deux fois.
 *
 * `mesures` : la part de joueurs de la campagne qui ont trouvé chaque
 * question — ce qui corrige sa difficulté estimée (`niveauDeQuestion`).
 */
export function composerUnQuiz(
  questions: readonly QuestionDeLaBase[],
  sujetsDe: (q: QuestionDeLaBase) => readonly string[],
  mesures: ReadonlyMap<string, MesureDUneQuestion>,
  choix: ChoixDuQuiz,
  deja: DejaDansLEspace,
  aleatoire: Aleatoire = Math.random,
): QuizQuestionDef[] {
  const filtre = choix.categories.length > 0 ? new Set<string>(choix.categories) : null
  const epoque = choix.sujet ? sujetParCle(choix.sujet)?.annees : undefined
  const parNiveau = new Map<Niveau, QuestionDeLaBase[]>(NIVEAUX.map(n => [n, []]))
  const estimables = new Map<Niveau, QuestionDeLaBase[]>(NIVEAUX.map(n => [n, []]))
  const niveaux = new Map<string, Niveau>()
  const cibles = new Map<string, { target: number; unit: string }>()
  const marchesDesEstimations = new Set(MARCHES_DES_ESTIMATIONS[choix.difficulte])
  for (const q of battre(questions, aleatoire)) {
    if (choix.sujet ? !sujetsDe(q).includes(choix.sujet) : filtre && !filtre.has(q.meta.categorie)) continue
    if (choix.enfants && q.meta.ageMin > AGE_DES_ENFANTS) continue
    if (deja.ids.has(idDansLeQuiz(q.id)) || deja.empreintes.has(q.empreinte)) continue
    if (epoque && souffleeParLEpoque(q, epoque)) continue
    const niveau = niveauDeQuestion(q.meta.difficulte, mesures.get(q.id))
    // Un vrai ou faux pour finir un quiz corsé : un pile ou face de clôture.
    if (niveau === 'expert' && q.reponses.length === 2) continue
    niveaux.set(q.id, niveau)
    parNiveau.get(niveau)!.push(q)
    const cible = choix.estimations && marchesDesEstimations.has(niveau) ? cibleDeLEstimation(q) : null
    if (cible) {
      cibles.set(q.id, cible)
      estimables.get(niveau)!.push(q)
    }
  }
  const poseeLe = (q: QuestionDeLaBase) => deja.posees.get(idDansLeQuiz(q.id))
  // Une réponse soufflée par sa racine — « Les Deux Fridas » pour Frida Kahlo — ne vient qu'en dernier recours,
  // après tout le reste, déjà posé compris : la salle la trouve sans la savoir (l'expert du quiz tout prêt, le
  // 11 octobre 2026). Ce n'est pas un refus : une sur quatre, à peu près, ne souffle rien.
  const passes: readonly Passe[] = [false, true].flatMap(soufflees => [
    ...(choix.enfants
      ? [
          { fraiches: true, enfantines: true, soufflees },
          { fraiches: false, enfantines: true, soufflees },
        ]
      : []),
    { fraiches: true, enfantines: false, soufflees },
    { fraiches: false, enfantines: false, soufflees },
  ])
  /** Ce que la passe prend : les jamais posées, au hasard du battage ; ou les posées, la plus anciennement d'abord. */
  const deLaPasse = (dispo: readonly QuestionDeLaBase[], passe: Passe) => {
    const ici = dispo.filter(
      q => !prises.has(q.id) && (poseeLe(q) === undefined) === passe.fraiches && (!passe.enfantines || pourUnEnfant(q)) && (passe.soufflees || !q.soufflee),
    )
    return passe.fraiches ? ici : ici.sort((a, b) => poseeLe(a)! - poseeLe(b)!)
  }
  const prises = new Set<string>()
  const servies: Servies = { categories: new Map(), sousThemes: new Map(), deja: new DejaPrises() }
  /** Les questions de chaque marche du plan, passe après passe ; une marche qui manque emprunte à sa voisine — jamais hors de `permises`. */
  const tirerLePlan = (plan: readonly { niveau: Niveau; n: number }[], dans: ReadonlyMap<Niveau, readonly QuestionDeLaBase[]>, permises?: ReadonlySet<Niveau>) => {
    const marches: QuestionDeLaBase[][] = plan.map(() => [])
    for (const passe of passes) {
      plan.forEach((marche, i) => {
        for (const niveau of [marche.niveau, ...VOISINES[marche.niveau]]) {
          if (permises && !permises.has(niveau)) continue
          const manque = marche.n - marches[i].length
          if (manque <= 0) break
          for (const q of aTourDeRole(deLaPasse(dans.get(niveau)!, passe), manque, servies)) {
            prises.add(q.id)
            marches[i].push(q)
          }
        }
      })
    }
    return marches.flat()
  }

  // Les estimations d'abord : la base en a peu, et le tour de rôle des
  // catégories, commun, range ensuite les QCM autour d'elles. Elles montent
  // comme le quiz — leur plan, puis de la plus facile à la plus dure :
  // tirées au hasard des marches, une difficile tombait une fois sur trois à
  // la quatrième question, dans les « faciles d'abord ».
  const voulues = choix.estimations ? Math.round(choix.nombre / UNE_ESTIMATION_SUR) : 0
  const rang = (q: QuestionDeLaBase) => NIVEAUX.indexOf(niveaux.get(q.id)!)
  const estimations = tirerLePlan(planDuQuiz(choix.difficulte, voulues), estimables, marchesDesEstimations).sort((a, b) => rang(a) - rang(b))

  const qcm = tirerLePlan(planDuQuiz(choix.difficulte, choix.nombre - estimations.length), parNiveau)
  const total = qcm.length + estimations.length
  const places = placesDesEstimations(total, estimations.length)
  const quiz: QuizQuestionDef[] = []
  for (let i = 0, e = 0, c = 0; i < total; i++) {
    // Sa place venue — ou plus un QCM pour la remplir —, l'estimation suivante.
    if (e < estimations.length && (i >= places[e] || c >= qcm.length)) {
      const q = estimations[e++]
      quiz.push(versLEstimation(q, cibles.get(q.id)!))
    } else quiz.push(versLeQuiz(qcm[c++], aleatoire, epoque))
  }
  return quiz
}

/** `a` passe-t-il avant `b` ? Deux rangs se lisent de gauche à droite. */
function passeAvant(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

/**
 * Une autre question à la place de celle qu'on n'aime pas, dans un quiz tout
 * prêt (« Une autre », dans l'éditeur). Retirer Tarantino du quiz des
 * enfants le laissait à quatorze questions, et rien ne tirait sa voisine dans
 * la base (l'animatrice exigeante, le 11 octobre 2026, constat 8). La
 * voisine est de la même catégorie, de la même marche — l'ordre d'un quiz
 * progressif tient —, de la même sorte — une estimation pour une
 * estimation —, pas plus vieille d'âge — un quiz d'enfants le reste —, ni
 * de la bibliothèque, ni du quiz, ni la jumelle d'une de ses autres
 * questions (`jumelles`). Elle partage d'abord les sujets de la remplacée —
 * son époque, son thème —, puis, sans jumelle, sa rubrique — son
 * sous-thème : un quiz composé sur le football le reste —, puis vient ce que
 * les soirées n'ont jamais posé, puis le plus anciennement posé ; à égalité,
 * au hasard. Null quand la base n'a plus rien de semblable — ou que la
 * remplacée n'en vient pas.
 *
 * `quiz` : les identifiants des questions du quiz tel que l'éditeur l'a, pas
 * encore enregistré.
 */
export function uneAutreQuestion(
  questions: readonly QuestionDeLaBase[],
  sujetsDe: (q: QuestionDeLaBase) => readonly string[],
  mesures: ReadonlyMap<string, MesureDUneQuestion>,
  remplacee: { id: string; kind: QuizQuestionDef['kind'] },
  quiz: readonly string[],
  deja: DejaDansLEspace,
  aleatoire: Aleatoire = Math.random,
): QuizQuestionDef | null {
  const parId = new Map(questions.map(q => [idDansLeQuiz(q.id), q]))
  const origine = parId.get(remplacee.id)
  if (!origine) return null
  const niveauDe = (q: QuestionDeLaBase) => niveauDeQuestion(q.meta.difficulte, mesures.get(q.id))
  const niveau = niveauDe(origine)
  const estimation = remplacee.kind === 'number'
  // Sa rubrique passe après la jumelle (`rubriqueDe`) : comptée avec ses sujets, elle ferait préférer une jumelle du même sous-thème.
  const saRubrique = rubriqueDe(origine.meta)
  const sesSujets = sujetsDe(origine).filter(s => s !== saRubrique)
  const exclues = new Set(quiz)
  const autres = new DejaPrises()
  for (const id of quiz) {
    const q = parId.get(id)
    if (q && id !== remplacee.id) autres.prendre(q)
  }
  let meilleure: { q: QuestionDeLaBase; rang: number[] } | null = null
  for (const q of battre(questions, aleatoire)) {
    const id = idDansLeQuiz(q.id)
    if (q === origine || exclues.has(id) || deja.ids.has(id) || deja.empreintes.has(q.empreinte)) continue
    if (q.meta.categorie !== origine.meta.categorie || q.meta.ageMin > origine.meta.ageMin || niveauDe(q) !== niveau) continue
    if (estimation ? !cibleDeLEstimation(q) : niveau === 'expert' && q.reponses.length === 2) continue
    const lesSiens = sujetsDe(q)
    const posee = deja.posees.get(id)
    // Le plus petit gagne : ses sujets manquants, la jumelle, une autre rubrique, la réponse soufflée par sa racine,
    // puis jamais posée, puis la plus anciennement posée.
    const rang = [
      sesSujets.filter(s => !lesSiens.includes(s)).length,
      autres.jumelle(q) ? 1 : 0,
      rubriqueDe(q.meta) === saRubrique ? 0 : 1,
      q.soufflee ? 1 : 0,
      posee === undefined ? 0 : 1,
      posee ?? 0,
    ]
    if (!meilleure || passeAvant(rang, meilleure.rang)) meilleure = { q, rang }
  }
  if (!meilleure) return null
  const cible = estimation ? cibleDeLEstimation(meilleure.q) : null
  // L'époque de la remplacée, s'il y en a une : la voisine la partage d'abord, et son titre ne doit pas souffler l'année tirée.
  const epoque = sesSujets.map(s => sujetParCle(s)?.annees).find(a => a !== undefined)
  return cible ? versLEstimation(meilleure.q, cible) : versLeQuiz(meilleure.q, aleatoire, epoque)
}

/**
 * Son titre : « Histoire · 15 questions », « Les années 80 · 10 questions
 * faciles », « Un peu de tout · 30 questions corsées ». Trois catégories
 * nommées au plus : le titre tient sur une ligne de « Mes quiz ». Et
 * « · en famille » quand des enfants jouent : rien ne le disait, et l'on ne
 * retrouvait pas le quiz composé pour eux.
 */
export function titreDuQuizToutPret(choix: ChoixDuQuiz, nombre: number): string {
  const c: readonly Categorie[] = choix.categories
  const sujet = choix.sujet ? sujetParCle(choix.sujet)?.nom : undefined
  const de = sujet ?? nommerLesCategories(c) ?? 'Un peu de tout'
  const adjectif = choix.difficulte === 'facile' ? ' faciles' : choix.difficulte === 'corsee' ? ' corsées' : ''
  return `${de} · ${nombre} question${nombre > 1 ? 's' : ''}${adjectif}${choix.enfants ? ' · en famille' : ''}`
}
