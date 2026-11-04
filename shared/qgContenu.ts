// Le contenu au QG (le QG 2, lot 7 — la proposition du 3 novembre 2026,
// `retours/2026-11-03/le-qg.md`) : « Questions » (`/admin#questions`), toutes
// les questions jouées de la campagne — ses séries, épreuves, défis, duels, et
// le Cabinet quand il pose une question de la base — et du quiz du jour au même
// endroit, chacune avec ce que ses réponses disent d'elle ; et « Réserves et
// base » (`/admin#reserves`), ce qui nourrit les deux modes : la réserve du
// quiz du jour, la base de la campagne catégorie par marche, le contenu neuf
// du Cabinet. Jamais une question de soirée : ce sont les quiz des animateurs,
// et des soirées des autres, le QG ne lit que des chiffres.
//
// Les dérivations sont pures : le serveur les mène — en tranches quand elles
// passent toute la base —, la page et les tests les relisent. La marche d'une
// question de campagne n'est jamais recalculée ici : c'est celle où la
// campagne la tire (`niveauDeQuestion`, la préparation du tirage), et ce que
// ses réponses contredisent, la règle de la campagne (`marcheContredite`).

import {
  NIVEAUX,
  REPONSES_POUR_MESURER,
  TAUX_A_PRIORI,
  difficultePourLaPart,
  forceDuDesaccord,
  marcheContredite,
  MODES_DE_SERIE,
  niveauDeQuestion,
  niveauMesure,
  type AjoutsDeLaRoutine,
  type MesureDUneQuestion,
  type Niveau,
} from './campagne'
import { tronquer } from './avatars'
import type { Fiche, FriseATheme, Lieu, Replique } from './cabinet/contenu'
import { pourChercher } from './library'
import { modeDeLaSerie } from './qg'
import { recueilDeLaQuestion } from './qgDuJour'
import type { VersionDeLaReserve, VersionLue } from './qgSignalements'
import { QUESTIONS_D_UNE_TRANCHE, dUneTraite, type CalculEnTranches } from './tranches'

// ── Les questions ───────────────────────────────────────────────────────────

/** Où une question se joue : les modes du QG, sans les soirées. */
export const MODES_DES_QUESTIONS = ['jour', 'campagne', 'cabinet', 'duel'] as const
export type ModeDUneQuestion = (typeof MODES_DES_QUESTIONS)[number]

/** Ce que le filtre retient : toutes, celles que leurs réponses contredisent, les pièges, les signalées. */
export const ETATS_DES_QUESTIONS = ['toutes', 'contredites', 'pieges', 'signalees'] as const
export type EtatDesQuestions = (typeof ETATS_DES_QUESTIONS)[number]

/** Les colonnes qui se trient. */
export const TRIS_DES_QUESTIONS = ['texte', 'mode', 'categorie', 'marche', 'reponses', 'bonnes', 'temps', 'signalements', 'derniere'] as const
export type TriDesQuestions = (typeof TRIS_DES_QUESTIONS)[number]

/** Les lignes d'une page : des milliers de questions ne vont pas dans la page d'un téléphone. */
export const QUESTIONS_PAR_PAGE = 50

/**
 * Combien de lignes la recherche, le tri et les tuiles passent d'une traite
 * (`enTranches`) : ramener un intitulé à ce qu'une recherche lit coûte bien
 * plus qu'une ligne d'un calcul de la base — cinquante millisecondes pour
 * vingt mille intitulés sur un vrai cœur, et le tri par intitulé sans eux
 * près d'une seconde (le banc du 4 novembre 2026). Cinq cents par tranche en
 * restent aux deux ou trois millisecondes d'une tranche de la base, intitulés
 * à ramener compris ; mille en prenaient six.
 */
export const LIGNES_D_UNE_TRANCHE = 500

/**
 * Sous ce quart de bonnes réponses, une question est un piège : à quatre
 * réponses, le hasard en trouverait autant — une mauvaise l'emporte. Jugée sur
 * `REPONSES_POUR_MESURER` réponses au moins, comme une marche.
 */
export const PART_D_UN_PIEGE = 0.25

/**
 * Les jours du quiz du jour que la page relit, aujourd'hui compris : un
 * trimestre, comme les soirées du QG (`JOURS_DES_SOIREES`). Ses jours clos se
 * lisent une fois par jour et se gardent ; la campagne, elle, se lit depuis
 * toujours, dans le journal des réponses en mémoire.
 */
export const JOURS_DES_QUESTIONS_DU_JOUR = 90

/**
 * Ce que la page garde de sa lecture : une minute — on la trie, on la filtre,
 * on la feuillette sans relire la base ; un geste du QG sur une question la
 * fait relire aussitôt (`ContenuDuQg.oublier`).
 */
export const CONTENU_GARDE_MS = 60_000

/** Ce que la page demande : un mode, un état, un mot de l'intitulé, une colonne et son sens, une page. */
export interface FiltreDesQuestions {
  mode: ModeDUneQuestion | null
  etat: EtatDesQuestions
  mot: string
  /** Null : l'ordre de l'état — les plus jouées ; les plus nettes des contredites, les moins trouvées des pièges, les plus signalées. */
  tri: TriDesQuestions | null
  sens: 'monte' | 'descend'
  page: number
}

/** Le mot cherché, au plus : un intitulé de la base tient en deux cents signes. */
export const MOT_CHERCHE_MAX = 80

/** Ce que l'adresse demande, relu : rien de ce qui n'est pas dans la liste, une page entière et positive. */
export function lireLeFiltre(brut: Record<string, unknown>): FiltreDesQuestions {
  const parmi = <T extends string>(liste: readonly T[], v: unknown): T | null => ((liste as readonly unknown[]).includes(v) ? (v as T) : null)
  const page = Number(brut.page)
  const mot = typeof brut.mot === 'string' ? tronquer(brut.mot.trim(), MOT_CHERCHE_MAX) : ''
  return {
    mode: parmi(MODES_DES_QUESTIONS, brut.mode),
    etat: parmi(ETATS_DES_QUESTIONS, brut.etat) ?? 'toutes',
    mot,
    tri: parmi(TRIS_DES_QUESTIONS, brut.tri),
    sens: brut.sens === 'monte' ? 'monte' : 'descend',
    page: Number.isInteger(page) && page > 0 ? page : 0,
  }
}

/** Ce que chaque réponse a recueilli, la bonne marquée. */
export interface ReponseRecueillie {
  texte: string
  bonne: boolean
  n: number
}

/**
 * De quoi agir sur une question depuis sa feuille, avec les gestes mêmes de la
 * page des signalements (`QgSignalements.tsx`) — au quiz du jour, par le jour
 * qui l'a posée en dernier et sa place ce jour-là ; en campagne, par son
 * identifiant.
 */
export type GestesDUneQuestion =
  | {
      source: 'jour'
      jour: string
      index: number
      reserveId: string
      /** Telle que son jour l'a posée : ses réponses dans l'ordre joué — ses joueurs ont répondu par la place. */
      copie: { reponses: string[]; bonne: number }
      anecdote: string | null
      /** Sa version de la réserve, celle que « Corriger » et « Reclasser » reprennent ; null si elle n'y est plus. */
      reserve: VersionDeLaReserve | null
      /** Son jour court encore, la nuit ne l'a pas clos : ses points s'annulent encore pour tous. */
      annulable: boolean
    }
  | {
      source: 'campagne'
      questionId: string
      version: VersionLue & { reponses: string[] }
      sousTheme: string
    }

/** Une question jouée, telle que la page la liste et l'ouvre. */
export interface QuestionAuQg {
  /** `jour:<réserve>` ou `campagne:<identifiant>` : unique sur la page. */
  cle: string
  source: 'jour' | 'campagne'
  texte: string
  categorie: string | null
  /** Où elle s'est jouée, dans l'ordre de `MODES_DES_QUESTIONS` — le premier se dit dans la colonne. */
  modes: ModeDUneQuestion[]
  /** Sa difficulté estimée, de 1 à 5 : à l'écriture en campagne, par la routine qui l'a décrite au quiz du jour. */
  difficulte: number | null
  /** La marche annoncée : celle où la campagne la tire ; au quiz du jour, celle de son estimation. */
  marche: Niveau | null
  /** Celle que disent ses seules réponses, dès cinq. */
  marcheMesuree: Niveau | null
  /** Ses réponses disent une autre marche que la sienne : de combien (`forceDuDesaccord`), et la difficulté qu'elles proposent. */
  contredite: { force: number; difficulteProposee: number } | null
  /** Ses réponses comptées et ses bonnes : au quiz du jour, toutes ; en campagne, celles de la mesure — nues, hors révision. */
  reponses: number
  justes: number
  /** Le temps moyen d'une réponse donnée, en millisecondes — le quiz du jour seul a un chrono. */
  msMoyen: number | null
  /** Ses signalements pas encore relus. */
  signalements: number
  /** La dernière fois posée : sa dernière réponse. */
  derniere: number
  /** Retirée — de la réserve, ou de la campagne — : elle ne se pose plus. */
  retiree: boolean
  /** Au quiz du jour, ses points annulés pour tous, le jour qui l'a posée en dernier. */
  annulee: boolean
  recueil: ReponseRecueillie[]
  /** Posées sans réponse — le temps, une réponse arrivée après —, ou d'une réponse qui n'est plus parmi les siennes. */
  autres: number
  gestes: GestesDUneQuestion
}

/** La part de bonnes réponses d'une question, dès `REPONSES_POUR_MESURER` réponses ; null avant : cinq joueurs ne disent rien. */
export function partDeBonnes(q: Pick<QuestionAuQg, 'reponses' | 'justes'>): number | null {
  return q.reponses >= REPONSES_POUR_MESURER ? q.justes / q.reponses : null
}

/** Un piège : moins d'un quart de bonnes réponses, sur assez de réponses pour le dire. */
export function estUnPiege(q: Pick<QuestionAuQg, 'reponses' | 'justes'>): boolean {
  const part = partDeBonnes(q)
  return part !== null && part < PART_D_UN_PIEGE
}

/** Où une question s'est jouée : les bits des modes de ses parties (`bitDuMode`), en modes du QG. */
export function modesDeLaQuestion(bits: number): ModeDUneQuestion[] {
  const vus = new Set<ModeDUneQuestion>()
  MODES_DE_SERIE.forEach((mode, i) => {
    if (bits & (1 << i)) vus.add(modeDeLaSerie(mode))
  })
  return MODES_DES_QUESTIONS.filter(m => vus.has(m))
}

// ── La campagne ─────────────────────────────────────────────────────────────

/** Une question de la base, telle que le QG la lit : de quoi la nommer, la juger et la corriger. */
export interface QuestionDeLaBaseLue {
  id: string
  texte: string
  reponses: readonly string[]
  bonne: number
  anecdote: string | null
  meta: { categorie: string; sousTheme: string; difficulte: number }
}

/** Ce que la campagne sait de ses questions, tel que le magasin le prête à la page des questions (`CampagneStore.questionsAuQg`). */
export interface LectureDesQuestionsDeLaCampagne {
  /** Les jouables, dans l'ordre de la préparation du tirage : `marche(i)` y lit celle de la `i`-ième. */
  jouables: readonly QuestionDeLaBaseLue[]
  marche: (i: number) => Niveau
  /** La mesure de la campagne, celle que ses tirages lisent : ce que ses réponses contredisent se juge là. */
  mesure: ReadonlyMap<string, MesureDUneQuestion>
  /** Chaque question posée, sa dernière fois et ses modes (`JournalDesReponses.questionsJouees`). */
  jouees: ReadonlyMap<string, Readonly<{ derniere: number; modes: number }>>
  /** Ses réponses nues hors révision, à jour du journal (`compteDe`) — et ses mauvaises réponses choisies, sur les mêmes. */
  compte: (id: string) => Readonly<{ justes: number; total: number }> | undefined
  leurres: ReadonlyMap<string, ReadonlyMap<string, number>>
  /** Ses signalements pas encore relus. */
  signalements: ReadonlyMap<string, number>
}

/** Une question de la campagne, pour la page. */
export function questionDeLaCampagneAuQg(q: QuestionDeLaBaseLue, marche: Niveau, jouee: Readonly<{ derniere: number; modes: number }>, l: LectureDesQuestionsDeLaCampagne): QuestionAuQg {
  const mesure = l.mesure.get(q.id)
  const contredite = marcheContredite(q.meta.difficulte, mesure)
  const compte = l.compte(q.id) ?? { justes: 0, total: 0 }
  const choisis = l.leurres.get(q.id)
  const recueil: ReponseRecueillie[] = q.reponses.map((texte, k) => ({ texte, bonne: k === q.bonne, n: k === q.bonne ? compte.justes : (choisis?.get(texte) ?? 0) }))
  // Les leurres qu'une série a posés à la place des siens — une année tirée parmi
  // six (`reponsesAuRangTire`), la version d'avant une correction — ont été
  // choisis aussi : ils se disent après, le plus choisi d'abord.
  const ailleurs = [...(choisis ?? [])].filter(([texte]) => !q.reponses.includes(texte)).sort((a, b) => b[1] - a[1])
  for (const [texte, n] of ailleurs) recueil.push({ texte, bonne: false, n })
  const comptees = recueil.reduce((s, r) => s + r.n, 0)
  return {
    cle: `campagne:${q.id}`,
    source: 'campagne',
    texte: q.texte,
    categorie: q.meta.categorie,
    modes: modesDeLaQuestion(jouee.modes),
    difficulte: q.meta.difficulte,
    marche,
    // Sur la mesure qui juge la contradiction : une marche mesurée d'un compte, un « contredite » d'un autre se démentiraient.
    marcheMesuree: mesure ? niveauMesure(mesure.justes, mesure.total) : null,
    contredite: contredite && { force: contredite.force, difficulteProposee: contredite.difficulteProposee },
    reponses: compte.total,
    justes: compte.justes,
    msMoyen: null,
    signalements: l.signalements.get(q.id) ?? 0,
    derniere: jouee.derniere,
    retiree: false,
    annulee: false,
    recueil,
    autres: Math.max(0, compte.total - comptees),
    gestes: {
      source: 'campagne',
      questionId: q.id,
      version: { texte: q.texte, reponses: [...q.reponses], bonne: q.bonne, anecdote: q.anecdote },
      sousTheme: q.meta.sousTheme,
    },
  }
}

/**
 * Les questions jouées de la campagne, une tranche de la base à la fois
 * (`enTranches`) : ses jouables passent toutes — vingt-cinq mille —, et seules
 * celles qu'une partie a posées entrent. Une question retirée ou mise dans la
 * réserve du quiz du jour n'est plus jouable : elle n'y est pas.
 */
export function* questionsDeLaCampagneEnTranches(l: LectureDesQuestionsDeLaCampagne, tranche = QUESTIONS_D_UNE_TRANCHE): CalculEnTranches<QuestionAuQg[]> {
  const lignes: QuestionAuQg[] = []
  for (let i = 0; i < l.jouables.length; i++) {
    if (i > 0 && i % tranche === 0) yield
    const q = l.jouables[i]
    const jouee = l.jouees.get(q.id)
    if (jouee) lignes.push(questionDeLaCampagneAuQg(q, l.marche(i), jouee, l))
  }
  return lignes
}

// ── Le quiz du jour ─────────────────────────────────────────────────────────

/**
 * Ce que ses réponses ont recueilli, choix par choix, comme le suivi du jour
 * les groupe (`recueilDeLaQuestion`) : `[choix, n, ms, chronometrees, derniere]`
 * — `choix` nul pour une question posée sans réponse, `derniere` l'instant de
 * la plus récente.
 */
export type LigneDuRecueil = readonly [number | null, number, number | null, number, number]

/** Une question posée un jour, telle que son tirage la garde, et ce que ses réponses ont recueilli. */
export interface QuestionPoseeDuJour {
  jour: string
  index: number
  question: { reserveId: string; texte: string; reponses: readonly string[]; bonne: number; categorie: string | null; anecdote: string | null }
  annulee: boolean
  lignes: readonly LigneDuRecueil[]
  signalements: number
}

/** Ce que le quiz du jour prête à la page des questions (`JourStore.questionsAuQg`). */
export interface LectureDesQuestionsDuJour {
  aujourdhui: string
  /** Aujourd'hui pas encore clos par la nuit : ses questions s'annulent encore. */
  aujourdhuiOuvert: boolean
  posees: readonly QuestionPoseeDuJour[]
  /** Chaque question de la réserve posée, par son identifiant. */
  reserve: ReadonlyMap<string, VersionDeLaReserve>
}

/**
 * Les questions du quiz du jour, une ligne par question de la réserve : une
 * réserve à sec en repose une ancienne, et ses jours se fondent — chacun ses
 * réponses dans son ordre, rapportées par leur texte à l'ordre du dernier jour
 * qui l'a posée, celui de ses gestes. La marche annoncée est celle de son
 * estimation : le quiz du jour ne tire pas par marche, et rien n'y corrige
 * l'estimation de la routine ; ses réponses la contredisent à la même mesure
 * qu'en campagne (`forceDuDesaccord`). Une question que personne n'a encore
 * vue — le tirage d'aujourd'hui, au matin — n'est pas jouée.
 */
export function questionsDuJourAuQg(l: LectureDesQuestionsDuJour): QuestionAuQg[] {
  const parReserve = new Map<string, QuestionPoseeDuJour[]>()
  for (const p of l.posees) {
    const siennes = parReserve.get(p.question.reserveId)
    if (siennes) siennes.push(p)
    else parReserve.set(p.question.reserveId, [p])
  }
  const lignes: QuestionAuQg[] = []
  for (const [reserveId, posees] of parReserve) {
    const derniere = posees.reduce((a, b) => (b.jour > a.jour || (b.jour === a.jour && b.index > a.index) ? b : a))
    const { reponses, bonne } = derniere.question
    const fondues: [number | null, number, number | null, number][] = []
    let ailleurs = 0
    let derniereReponse = -Infinity
    for (const p of posees) {
      for (const [choix, n, ms, chronometrees, le] of p.lignes) {
        if (le > derniereReponse) derniereReponse = le
        if (choix === null) {
          fondues.push([null, n, ms, chronometrees])
          continue
        }
        const place = reponses.indexOf(p.question.reponses[choix] ?? '')
        if (place < 0) ailleurs += n
        else fondues.push([place, n, ms, chronometrees])
      }
    }
    if (derniereReponse === -Infinity) continue
    const recueil = recueilDeLaQuestion(reponses.length, fondues)
    const justes = recueil.parReponse[bonne] ?? 0
    const total = recueil.parReponse.reduce((s, n) => s + n, 0) + recueil.sansReponse + ailleurs
    const reserve = l.reserve.get(reserveId) ?? null
    const difficulte = reserve?.difficulte ?? null
    const marche = difficulte !== null ? niveauDeQuestion(difficulte) : null
    const marcheMesuree = niveauMesure(justes, total)
    lignes.push({
      cle: `jour:${reserveId}`,
      source: 'jour',
      texte: derniere.question.texte,
      // Celle de la réserve, que ses prochains tirages poseront — un reclassement s'y lit aussitôt — ; sinon celle de son jour.
      categorie: reserve?.categorie ?? derniere.question.categorie,
      modes: ['jour'],
      difficulte,
      marche,
      marcheMesuree,
      contredite:
        difficulte !== null && marche !== null && marcheMesuree !== null && marche !== marcheMesuree
          ? { force: forceDuDesaccord(justes / total, TAUX_A_PRIORI[difficulte] ?? TAUX_A_PRIORI[3], total), difficulteProposee: difficultePourLaPart(justes / total) }
          : null,
      reponses: total,
      justes,
      msMoyen: recueil.msMoyen,
      signalements: posees.reduce((s, p) => s + p.signalements, 0),
      derniere: derniereReponse,
      retiree: reserve === null || reserve.retiree,
      annulee: derniere.annulee,
      recueil: reponses.map((texte, k) => ({ texte, bonne: k === bonne, n: recueil.parReponse[k] ?? 0 })),
      autres: recueil.sansReponse + ailleurs,
      gestes: {
        source: 'jour',
        jour: derniere.jour,
        index: derniere.index,
        reserveId,
        copie: { reponses: [...reponses], bonne },
        anecdote: derniere.question.anecdote,
        reserve,
        annulable: derniere.jour === l.aujourdhui && l.aujourdhuiOuvert,
      },
    })
  }
  return lignes
}

// ── Trier, filtrer, feuilleter ──────────────────────────────────────────────

/** Les tuiles de la page : sur toutes les questions jouées, quel que soit le filtre. */
export interface TotauxDesQuestions {
  jouees: number
  contredites: number
  pieges: number
  signalees: number
  parMode: Record<ModeDUneQuestion, number>
}

/** Les tuiles, une tranche de lignes à la fois : toute la campagne jouée y passe à chaque lecture. */
export function* totauxDesQuestionsEnTranches(lignes: readonly QuestionAuQg[], tranche = LIGNES_D_UNE_TRANCHE): CalculEnTranches<TotauxDesQuestions> {
  const parMode = Object.fromEntries(MODES_DES_QUESTIONS.map(m => [m, 0])) as Record<ModeDUneQuestion, number>
  let contredites = 0
  let pieges = 0
  let signalees = 0
  for (let i = 0; i < lignes.length; i++) {
    if (i > 0 && i % tranche === 0) yield
    const q = lignes[i]
    for (const m of q.modes) parMode[m]++
    if (q.contredite) contredites++
    if (estUnPiege(q)) pieges++
    if (q.signalements > 0) signalees++
  }
  return { jouees: lignes.length, contredites, pieges, signalees, parMode }
}

/** Les tuiles d'une traite : les tests, et ce qui n'a que quelques lignes. */
export const totauxDesQuestions = (lignes: readonly QuestionAuQg[]): TotauxDesQuestions => dUneTraite(totauxDesQuestionsEnTranches(lignes))

/** Ce qu'une recherche lit d'une question : son intitulé et sa catégorie, sans casse ni accents. */
export const cherchableDe = (q: Pick<QuestionAuQg, 'texte' | 'categorie'>): string => pourChercher(`${q.texte} ${q.categorie ?? ''}`)

/** La valeur d'une colonne ; null ne se trie pas — elle va au bout, dans un sens comme dans l'autre. */
function valeurDe(q: QuestionAuQg, tri: TriDesQuestions, cherchable: (q: QuestionAuQg) => string): number | string | null {
  switch (tri) {
    case 'texte':
      return cherchable(q)
    case 'mode':
      return MODES_DES_QUESTIONS.indexOf(q.modes[0] ?? 'campagne')
    case 'categorie':
      return q.categorie
    case 'marche':
      // Une contredite après sa marche sœur : l'œil les trouve ensemble.
      return q.marche === null ? null : NIVEAUX.indexOf(q.marche) * 2 + (q.contredite ? 1 : 0)
    case 'reponses':
      return q.reponses
    case 'bonnes':
      return partDeBonnes(q)
    case 'temps':
      return q.msMoyen
    case 'signalements':
      return q.signalements
    case 'derniere':
      return q.derniere
  }
}

/** Deux valeurs, la nulle au bout ; `sens` ne retourne que les valeurs. */
function comparer(a: number | string | null, b: number | string | null, sens: 1 | -1): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  if (typeof a === 'string' || typeof b === 'string') return String(a) < String(b) ? -sens : String(a) > String(b) ? sens : 0
  return (a - b) * sens
}

/** À égalité, la plus jouée d'abord, puis la clé : l'ordre ne bouge pas d'une lecture à l'autre. */
const departage = (a: QuestionAuQg, b: QuestionAuQg) => b.reponses - a.reponses || (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0)

/** L'ordre d'un état, sans colonne choisie : ce qu'on vient y chercher d'abord. */
function pertinence(etat: EtatDesQuestions): (a: QuestionAuQg, b: QuestionAuQg) => number {
  switch (etat) {
    case 'contredites':
      // Les plus nettes d'abord, comme la liste de la campagne le faisait (le souhait du 15 octobre 2026).
      return (a, b) => (b.contredite?.force ?? 0) - (a.contredite?.force ?? 0) || departage(a, b)
    case 'pieges':
      return (a, b) => comparer(partDeBonnes(a), partDeBonnes(b), 1) || departage(a, b)
    case 'signalees':
      return (a, b) => b.signalements - a.signalements || b.derniere - a.derniere || departage(a, b)
    case 'toutes':
      return (a, b) => departage(a, b) || b.derniere - a.derniere
  }
}

/**
 * Un tri en tranches (`CalculEnTranches`) : des morceaux de `tranche` lignes
 * triés chacun d'une traite, puis fondus deux à deux, chaque fusion cédant
 * toutes les `tranche` places. D'une traite, vingt mille questions prenaient
 * dix à vingt millisecondes sur un vrai cœur — un gel au dixième de cœur de
 * l'hébergeur, à chaque colonne touchée. L'ordre est celui d'un tri ordinaire
 * pour toute comparaison qui départage chaque paire (la clé de chaque
 * question la départage ici, `departage`).
 */
export function* trierEnTranches<T>(lignes: readonly T[], ordre: (a: T, b: T) => number, tranche = LIGNES_D_UNE_TRANCHE): CalculEnTranches<T[]> {
  let morceaux: T[][] = []
  for (let i = 0; i < lignes.length; i += tranche) {
    if (i > 0) yield
    morceaux.push(lignes.slice(i, i + tranche).sort(ordre))
  }
  while (morceaux.length > 1) {
    const fondus: T[][] = []
    for (let m = 0; m < morceaux.length; m += 2) {
      const a = morceaux[m]
      const b = morceaux[m + 1]
      if (!b) {
        fondus.push(a)
        continue
      }
      yield
      const fondu: T[] = []
      let i = 0
      let j = 0
      while (i < a.length && j < b.length) {
        // À égalité, celle du premier morceau d'abord : le tri reste stable.
        fondu.push(ordre(b[j], a[i]) < 0 ? b[j++] : a[i++])
        if (fondu.length % tranche === 0) yield
      }
      while (i < a.length) fondu.push(a[i++])
      while (j < b.length) fondu.push(b[j++])
      fondus.push(fondu)
    }
    morceaux = fondus
  }
  return morceaux[0] ?? []
}

/** Ce que le filtre garde d'une question : son mode, son état, son mot (déjà ramené à ce qu'une recherche lit). */
function estRetenue(q: QuestionAuQg, filtre: FiltreDesQuestions, mot: string, cherchable: (q: QuestionAuQg) => string): boolean {
  return (
    (filtre.mode === null || q.modes.includes(filtre.mode)) &&
    (filtre.etat === 'toutes' ||
      (filtre.etat === 'contredites' && q.contredite !== null) ||
      (filtre.etat === 'pieges' && estUnPiege(q)) ||
      (filtre.etat === 'signalees' && q.signalements > 0)) &&
    (!mot || cherchable(q).includes(mot))
  )
}

/**
 * Les questions que le filtre retient — son mode, son état, son mot —, dans
 * son ordre ; la page n'y est pour rien. Une tranche de lignes à la fois : le
 * filtre lit la valeur de la colonne de chaque question en passant — l'intitulé
 * ramené à ce qu'une recherche lit compris, que le serveur garde par question
 * (`cherchable`) —, puis le tri ne compare plus que ces valeurs
 * (`trierEnTranches`).
 */
export function* questionsRetenuesEnTranches(
  lignes: readonly QuestionAuQg[],
  filtre: FiltreDesQuestions,
  cherchable: (q: QuestionAuQg) => string = cherchableDe,
  tranche = LIGNES_D_UNE_TRANCHE,
): CalculEnTranches<QuestionAuQg[]> {
  const mot = pourChercher(filtre.mot)
  const { tri, etat } = filtre
  const retenues: { q: QuestionAuQg; valeur: number | string | null }[] = []
  for (let i = 0; i < lignes.length; i++) {
    if (i > 0 && i % tranche === 0) yield
    const q = lignes[i]
    if (!estRetenue(q, filtre, mot, cherchable)) continue
    // La valeur qui range : la colonne choisie, ou la part de bonnes réponses d'un piège — l'ordre des autres états lit ses champs tels quels.
    retenues.push({ q, valeur: tri !== null ? valeurDe(q, tri, cherchable) : etat === 'pieges' ? partDeBonnes(q) : null })
  }
  if (lignes.length > 0) yield
  const sens = filtre.sens === 'monte' ? 1 : -1
  const parEtat = pertinence(etat)
  type Retenue = (typeof retenues)[number]
  const ordre: (a: Retenue, b: Retenue) => number =
    tri !== null
      ? (a, b) => comparer(a.valeur, b.valeur, sens) || departage(a.q, b.q)
      : etat === 'pieges'
        ? (a, b) => comparer(a.valeur, b.valeur, 1) || departage(a.q, b.q)
        : (a, b) => parEtat(a.q, b.q)
  const triees = yield* trierEnTranches(retenues, ordre, tranche)
  return triees.map(r => r.q)
}

/** Les mêmes, d'une traite : les tests, et ce qui n'a que quelques lignes. */
export const questionsRetenues = (lignes: readonly QuestionAuQg[], filtre: FiltreDesQuestions, cherchable: (q: QuestionAuQg) => string = cherchableDe): QuestionAuQg[] =>
  dUneTraite(questionsRetenuesEnTranches(lignes, filtre, cherchable))

/** Une page de questions retenues : la page demandée, ramenée dans celles qui existent. */
export function unePage(retenues: readonly QuestionAuQg[], page: number): { page: number; pages: number; lignes: QuestionAuQg[] } {
  const pages = Math.max(1, Math.ceil(retenues.length / QUESTIONS_PAR_PAGE))
  const p = Math.min(Math.max(0, page), pages - 1)
  return { page: p, pages, lignes: retenues.slice(p * QUESTIONS_PAR_PAGE, (p + 1) * QUESTIONS_PAR_PAGE) }
}

/** Ce que la page des questions lit (`GET /api/admin/questions`). */
export interface PageDesQuestions {
  maintenant: number
  /** Quand la lecture a été faite : la page la garde une minute (`CONTENU_GARDE_MS`). */
  lueLe: number
  totaux: TotauxDesQuestions
  /** Le filtre tel que le serveur l'a compris, sa page ramenée dans celles qui existent. */
  filtre: FiltreDesQuestions
  /** Les questions qu'il retient, et en combien de pages. */
  total: number
  pages: number
  lignes: QuestionAuQg[]
  /** Les jours du quiz du jour qu'elle lit (`JOURS_DES_QUESTIONS_DU_JOUR`) ; la campagne, depuis toujours. */
  joursDuJour: number
}

// ── Les réserves et la base ─────────────────────────────────────────────────

/** Les jours de dépôts que la page dessine, aujourd'hui compris : ce que la routine du matin a fait ces deux semaines. */
export const JOURS_DES_APPORTS = 14

/** La réserve du quiz du jour, telle que la page « Réserves et base » la lit. */
export interface ReserveDuJourAuQg {
  pretes: number
  joursDAvance: number
  posees: number
  retirees: number
  /** Les derniers apports, ce qu'ils ont ajouté et écarté — et pourquoi. */
  apports: { quand: number; source: string; ajoutees: number; ecartees: { texte: string; raison: string }[] }[]
  /** Les questions prêtes de chaque catégorie, la plus fournie d'abord — celles du public mises à part : elles ont leur file. */
  parCategorie: { categorie: string | null; pretes: number }[]
  /** Ce qui est entré dans la réserve, jour par jour (`JOURS_DES_APPORTS`) : la routine du matin, puis le reste — une liste collée, une question du public. */
  parJour: { jour: string; routine: number; autres: number }[]
  /** Une routine la remplit : `RESERVE_TOKEN` est posé sur le serveur. */
  remplissage: { automatique: boolean }
}

/** Ce qu'une case de la base compte : ses questions jouables, et celles que leurs réponses contredisent. */
export interface CaseDeLaBase {
  jouables: number
  contredites: number
}

/** La base de la campagne, catégorie par catégorie. */
export interface CategorieDeLaBase {
  categorie: string
  /** Une case par marche, dans l'ordre de `NIVEAUX` : la marche où la campagne tire chaque question. */
  marches: CaseDeLaBase[]
  /** Ses jouables par difficulté estimée à l'écriture, de 1 à 5 : ce que la routine rattrape. */
  difficultes: number[]
}

/** La base de la campagne, telle que la page « Réserves et base » la lit. */
export interface BaseDeLaCampagneAuQg {
  /** Toute la base, ce que la campagne peut en poser — moins les retirées et celles de la réserve du jour —, et les retirées. */
  questions: number
  jouables: number
  retirees: number
  carte: CategorieDeLaBase[]
  ajouts: AjoutsDeLaRoutine
}

/**
 * La carte de la base, catégorie par marche, une tranche de jouables à la
 * fois : la marche de chacune est celle où la campagne la tire (`marche(i)`,
 * la préparation du tirage — jamais recalculée ici), une contredite l'est par
 * la règle de la campagne (`marcheContredite`, sur sa mesure). Les catégories
 * dans l'ordre où la base les donne (`categories`), puis celles qu'elle aurait
 * en plus.
 */
export function* carteDeLaBaseEnTranches(
  jouables: readonly Pick<QuestionDeLaBaseLue, 'id' | 'meta'>[],
  marche: (i: number) => Niveau,
  mesure: ReadonlyMap<string, MesureDUneQuestion>,
  categories: readonly string[],
  tranche = QUESTIONS_D_UNE_TRANCHE,
): CalculEnTranches<CategorieDeLaBase[]> {
  const parCategorie = new Map<string, CategorieDeLaBase>(
    categories.map(categorie => [categorie, { categorie, marches: NIVEAUX.map(() => ({ jouables: 0, contredites: 0 })), difficultes: [0, 0, 0, 0, 0] }]),
  )
  for (let i = 0; i < jouables.length; i++) {
    if (i > 0 && i % tranche === 0) yield
    const q = jouables[i]
    let c = parCategorie.get(q.meta.categorie)
    if (!c) parCategorie.set(q.meta.categorie, (c = { categorie: q.meta.categorie, marches: NIVEAUX.map(() => ({ jouables: 0, contredites: 0 })), difficultes: [0, 0, 0, 0, 0] }))
    const case_ = c.marches[NIVEAUX.indexOf(marche(i))]
    case_.jouables++
    if (marcheContredite(q.meta.difficulte, mesure.get(q.id))) case_.contredites++
    if (q.meta.difficulte >= 1 && q.meta.difficulte <= 5) c.difficultes[q.meta.difficulte - 1]++
  }
  return [...parCategorie.values()]
}

/** Une sorte du contenu neuf du Cabinet : le jeu qui la joue, ses entrées, et ses thèmes — ou ses catégories. */
export interface SorteDuContenuAuQg {
  sorte: 'lieux' | 'fiches' | 'repliques' | 'frises'
  /** Le jeu qui la pose, et ce que ses groupes sont : « les thèmes », « les catégories ». */
  jeu: string
  entrees: number
  groupes: { nom: string; entrees: number }[]
}

/** Le contenu neuf du Cabinet — ce qui n'est pas une question de la base —, tel que la page le compte. */
export interface ContenuDuCabinetAuQg {
  sortes: SorteDuContenuAuQg[]
}

/**
 * Le contenu neuf du Cabinet, compté : les lieux de l'Épingle par leur thème
 * — une partie en joue trois d'un même —, les fiches des Indices, les
 * répliques et les frises à thème par leur catégorie : une frise est son
 * thème, et ses thèmes, un chacun, ne disaient rien (le rendu du 4 novembre
 * 2026). Le Quiz et les autres jeux posent des questions de la base : ils sont
 * dans la carte de la base.
 */
export function contenuDuCabinetAuQg(contenu: { lieux: readonly Lieu[]; fiches: readonly Fiche[]; repliques: readonly Replique[]; frises: readonly FriseATheme[] }): ContenuDuCabinetAuQg {
  const groupes = (noms: readonly string[]) => {
    const n = new Map<string, number>()
    for (const nom of noms) n.set(nom, (n.get(nom) ?? 0) + 1)
    return [...n].map(([nom, entrees]) => ({ nom, entrees })).sort((a, b) => b.entrees - a.entrees || (a.nom < b.nom ? -1 : 1))
  }
  return {
    sortes: [
      { sorte: 'lieux', jeu: 'l’Épingle', entrees: contenu.lieux.length, groupes: groupes(contenu.lieux.map(l => l.theme)) },
      { sorte: 'fiches', jeu: 'les Indices', entrees: contenu.fiches.length, groupes: groupes(contenu.fiches.map(f => f.categorie)) },
      { sorte: 'repliques', jeu: 'la Réplique', entrees: contenu.repliques.length, groupes: groupes(contenu.repliques.map(r => r.categorie)) },
      { sorte: 'frises', jeu: 'la Frise', entrees: contenu.frises.length, groupes: groupes(contenu.frises.map(f => f.categorie)) },
    ],
  }
}

/** Ce que la page « Réserves et base » lit (`GET /api/admin/reserves`). */
export interface PageDesReserves {
  maintenant: number
  jour: ReserveDuJourAuQg
  campagne: BaseDeLaCampagneAuQg
  /** Null : le contenu du Cabinet ne s'est pas lu. */
  cabinet: ContenuDuCabinetAuQg | null
}
