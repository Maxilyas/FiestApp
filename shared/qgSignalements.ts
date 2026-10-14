// Les signalements au QG (`/admin#signalements`, le choix du 14 octobre 2026,
// sur maquettes : « Une page qui remplace les sections ») : ce que les
// joueurs signalent au quiz du jour et en campagne — sentiers, parcours, défi
// de la semaine et duels compris —, réuni sur une page, avec les mêmes gestes
// partout — corriger, reclasser, retirer, garder, et au quiz du jour annuler
// ses points pour tous — ; puis ce qui a été fait des questions relues ces
// trente jours. Chaque geste écrit son issue sur les signalements qu'il
// referme : l'historique la relit, et le joueur dont la remarque a servi
// l'apprend sur son accueil (`ISSUES_QUI_SERVENT`, `phraseDuMerci`). Les
// dérivations sont pures : la page et les tests les relisent.

import { bonneReponseChange, type CorrectionDeQuestion, type SignalementDeCampagne } from './campagne'
import { CATEGORIES } from './categories'
import { SOUS_THEMES } from './etiquettes'
import type { IssueQuiSert } from './profil'

/** Ce qu'un geste a fait d'une question signalée — et de ses signalements, qu'il referme. */
export type IssueDUnSignalement = 'gardee' | IssueQuiSert

const ISSUES: readonly IssueDUnSignalement[] = ['gardee', 'corrigee', 'reclassee', 'retiree', 'annulee']

/**
 * Les issues qui disent au joueur que sa remarque a servi : « Garder » ne
 * dit rien — la question était juste, et on ne le lui reproche pas.
 */
export const ISSUES_QUI_SERVENT: readonly IssueQuiSert[] = ['corrigee', 'reclassee', 'retiree', 'annulee']

/** Une issue lue en base : null pour un signalement relu avant qu'on les écrive. */
export function lireIssue(brut: unknown): IssueDUnSignalement | null {
  return ISSUES.includes(brut as IssueDUnSignalement) ? (brut as IssueDUnSignalement) : null
}

/**
 * Ce que l'écran de l'administrateur envoie pour corriger une question —
 * au quiz du jour comme en campagne —, mis en forme : des textes sur une
 * ligne, sans espaces en trop — le juge de la base refuserait un retour à la
 * ligne collé avec l'intitulé. Chaque mode dit le reste. Null : pas une
 * correction.
 */
export function lireLaCorrection(brut: unknown): CorrectionDeQuestion | null {
  if (!brut || typeof brut !== 'object') return null
  const b = brut as Record<string, unknown>
  if (typeof b.texte !== 'string' || !Array.isArray(b.reponses) || !b.reponses.every(r => typeof r === 'string')) return null
  if (typeof b.bonne !== 'number' || !Number.isInteger(b.bonne)) return null
  if (b.anecdote !== null && b.anecdote !== undefined && typeof b.anecdote !== 'string') return null
  const uneLigne = (t: string) => t.replace(/\s+/g, ' ').trim()
  const anecdote = typeof b.anecdote === 'string' ? b.anecdote.trim() : ''
  return { texte: uneLigne(b.texte), reponses: (b.reponses as string[]).map(uneLigne), bonne: b.bonne, anecdote: anecdote || null }
}

/** La correction ne change rien à ce qu'on lit : rangée pour rien, elle se refuse — « Garder » referme. */
export function memeLecture(avant: VersionLue, apres: VersionLue): boolean {
  return (
    avant.texte === apres.texte &&
    avant.anecdote === apres.anecdote &&
    avant.bonne === apres.bonne &&
    avant.reponses.length === apres.reponses.length &&
    avant.reponses.every((r, i) => r === apres.reponses[i])
  )
}

/** L'historique de la page : les questions relues ces trente jours. */
export const JOURS_DES_RELUS = 30
/**
 * Les questions à relire que la page lit de chaque mode, les plus récemment
 * signalées d'abord : le quiz du jour et la campagne lisent la même, et la
 * page dit, à ce compte, que d'autres attendent.
 */
export const SIGNALEMENTS_MONTRES_AU_QG = 50
/** Les questions relues que l'historique montre, les plus récentes d'abord. */
export const RELUS_MONTRES = 100
/** Ce que le merci cite d'une question : son début, de quoi la reconnaître sur un téléphone. */
export const QUESTION_DU_MERCI = 70

/** Un joueur qui signale une question du jour : qui, ce qu'il en dit, quand, et ce qu'il avait répondu. */
export interface RapportDuJour {
  profileId: string
  /** Son prénom et son identifiant, lus au profil ; null : le profil n'existe plus. */
  prenom: string | null
  login: string | null
  texte: string
  le: number
  traiteLe: number | null
  issue: IssueDUnSignalement | null
  /** Sa réponse, telle qu'il l'a lue ce jour-là ; null : laissée au temps. */
  reponse: string | null
  juste: boolean
}

/** Une question du jour telle que la réserve la garde : celle que ses prochains tirages poseront, et que « Corriger » reprend. */
export interface VersionDeLaReserve {
  texte: string
  /** Dans l'ordre où elle a été écrite : chaque jour les mélange à sa façon. */
  reponses: string[]
  bonne: number
  anecdote: string | null
  categorie: string | null
  /** Ses métadonnées, quand la routine l'a déjà décrite ; sans elles, seule sa catégorie se reclasse. */
  sousTheme: string | null
  difficulte: number | null
  retiree: boolean
}

/** Une question du jour signalée, pour la page des signalements. */
export interface SignalementDuJour {
  jour: string
  index: number
  reserveId: string
  /** Telle que son jour l'a posée — ses réponses dans l'ordre joué —, et ce que chacune a recueilli. */
  texte: string
  reponses: string[]
  bonne: number
  anecdote: string | null
  categorie: string | null
  parReponse: number[]
  sansReponse: number
  /** Sa version de la réserve ; null si elle n'y est plus. */
  reserve: VersionDeLaReserve | null
  annulee: boolean
  /** On annule ses points tant que son jour court : après minuit, son podium est payé. */
  annulable: boolean
  /** Combien de joueurs la signalent encore. */
  joueurs: number
  /** Ce que chacun en dit, les plus récents d'abord, ceux déjà relus compris. */
  rapports: RapportDuJour[]
  dernier: number
}

/** Une question relue : ce qui en a été fait, quand, et combien de joueurs la signalaient. */
export interface SignalementRelu {
  source: 'jour' | 'campagne'
  /** Au quiz du jour, `2026-10-14#3` ; en campagne, l'identifiant de la question. */
  cle: string
  texte: string
  categorie: string | null
  /** Null : relue avant qu'on écrive les issues, le 14 octobre 2026. */
  issue: IssueDUnSignalement | null
  detail: string | null
  quand: number
  joueurs: number
  /** Au quiz du jour : le jour qui l'a posée. */
  jour?: string
}

/** Ce que la page des signalements lit (`GET /api/admin/signalements`). */
export interface PageDesSignalements {
  maintenant: number
  jour: SignalementDuJour[]
  campagne: SignalementDeCampagne[]
  relus: SignalementRelu[]
}

/** Ce qu'on reclasse d'une question : sa catégorie, son sous-thème, sa difficulté estimée à l'écriture. */
export interface Classement {
  categorie: string
  sousTheme: string | null
  difficulte: number | null
}

/** Le nom d'un sous-thème, « Civilisations anciennes » pour `civilisations`. */
export function nomDuSousTheme(categorie: string, cle: string): string {
  return (SOUS_THEMES as Record<string, readonly { cle: string; nom: string }[]>)[categorie]?.find(s => s.cle === cle)?.nom ?? cle
}

/**
 * Ce que l'écran envoie pour reclasser une question, relu : une catégorie
 * connue, un sous-thème de cette catégorie, une difficulté de 1 à 5. Une
 * question sans métadonnées — une question du jour que la routine n'a pas
 * encore décrite — ne reclasse que sa catégorie. Une chaîne : le refus, à
 * dire tel quel.
 */
export function lireLeClassement(brut: unknown, { avecMeta }: { avecMeta: boolean }): Classement | string {
  if (!brut || typeof brut !== 'object') return 'Choisis une catégorie'
  const b = brut as Record<string, unknown>
  const categorie = CATEGORIES.find(c => c === b.categorie)
  if (!categorie) return 'Choisis une catégorie de la liste'
  if (!avecMeta) return { categorie, sousTheme: null, difficulte: null }
  const sousTheme = SOUS_THEMES[categorie].find(s => s.cle === b.sousTheme)?.cle
  if (!sousTheme) return `Choisis un sous-thème de la catégorie « ${categorie} »`
  const difficulte = Number(b.difficulte)
  if (!Number.isInteger(difficulte) || difficulte < 1 || difficulte > 5) return 'La difficulté va de 1 à 5'
  return { categorie, sousTheme, difficulte }
}

/** Le classement d'une question en une ligne : « Histoire › Civilisations anciennes · difficulté 4 ». */
export function classementEcrit(c: Classement): string {
  return [c.sousTheme ? `${c.categorie} › ${nomDuSousTheme(c.categorie, c.sousTheme)}` : c.categorie || 'sans catégorie', c.difficulte ? `difficulté ${c.difficulte}` : null]
    .filter(Boolean)
    .join(' · ')
}

/** Ce qu'un reclassement a changé, pour le journal du QG : « Géographie › Fleuves… · difficulté 2 → Histoire › … · difficulté 4 ». */
export function classementAuJournal(avant: Classement, apres: Classement): string {
  return `${classementEcrit(avant)} → ${classementEcrit(apres)}`
}

/** Ce que l'administrateur corrige d'une question : ce que le joueur lit. */
export interface VersionLue {
  texte: string
  reponses: readonly string[]
  bonne: number
  anecdote: string | null
}

/**
 * La place dans la réserve de chaque réponse d'un jour — il les a mélangées
 * à sa façon —, quand il a posé cette version-là : ses réponses, la même
 * bonne. Null sinon : la réserve a été corrigée depuis, ou le jour a posé
 * une version d'avant.
 */
export function placesDuJour(copie: { reponses: readonly string[]; bonne: number }, reserve: VersionLue): number[] | null {
  const places = copie.reponses.map(r => reserve.reponses.indexOf(r))
  const fidele = places.length === reserve.reponses.length && places.every(p => p >= 0) && new Set(places).size === places.length && places[copie.bonne] === reserve.bonne
  return fidele ? places : null
}

/**
 * Le jour qui a posé une question prend-il sa correction (le choix du 14
 * octobre 2026, « Même réponse : partout ; autre réponse : pour la
 * suite ») ? La même bonne réponse, à la même place, autant de réponses —
 * chacun de ses joueurs a répondu par la place, pas par le texte —, et le
 * jour a posé la version de la réserve. L'écran le dit avant
 * d'enregistrer, le serveur le décide.
 */
export function corrigeAussiLeJour(copie: { reponses: readonly string[]; bonne: number }, avant: VersionLue, apres: VersionLue): boolean {
  return !bonneReponseChange(avant, apres) && apres.bonne === avant.bonne && apres.reponses.length === avant.reponses.length && placesDuJour(copie, avant) !== null
}

/**
 * Ce qu'une correction a changé, pour l'historique : « nouvelle bonne
 * réponse : la Sicile », ou les parties retouchées — « l'intitulé,
 * l'anecdote ».
 */
export function detailDeLaCorrection(avant: VersionLue, apres: VersionLue): string {
  if (bonneReponseChange(avant, apres)) return `nouvelle bonne réponse : ${apres.reponses[apres.bonne] ?? ''}`
  const parties = [
    avant.texte !== apres.texte && 'l’intitulé',
    (avant.reponses.length !== apres.reponses.length || avant.reponses.some((r, i) => r !== apres.reponses[i]) || avant.bonne !== apres.bonne) && 'les réponses',
    avant.anecdote !== apres.anecdote && 'l’anecdote',
  ].filter((p): p is string => !!p)
  return parties.join(', ')
}

/** L'issue d'une question relue, en un mot ou deux, pour l'historique. */
export function issueEcrite(issue: IssueDUnSignalement | null): string {
  switch (issue) {
    case 'gardee':
      return 'Gardée'
    case 'corrigee':
      return 'Corrigée'
    case 'reclassee':
      return 'Reclassée'
    case 'retiree':
      return 'Retirée'
    case 'annulee':
      return 'Points annulés pour tous'
    default:
      return 'Relue'
  }
}

/** Ce qui a été fait d'une question relue, en une ligne : « Corrigée · l’anecdote », « Retirée de la réserve ». */
export function issueDuRelu(r: Pick<SignalementRelu, 'source' | 'issue' | 'detail'>): string {
  const issue = r.issue === 'retiree' ? (r.source === 'jour' ? 'Retirée de la réserve' : 'Retirée de la campagne') : issueEcrite(r.issue)
  return r.detail ? `${issue} · ${r.detail}` : issue
}

/** Combien de questions relues ont eu chaque issue — et combien avant qu'on les écrive (`relue`). */
export function compteDesRelus(relus: readonly SignalementRelu[]): Record<IssueDUnSignalement | 'relue', number> {
  const compte = { gardee: 0, corrigee: 0, reclassee: 0, retiree: 0, annulee: 0, relue: 0 }
  for (const r of relus) compte[r.issue ?? 'relue']++
  return compte
}

/** Trier les questions à relire : la plus signalée d'abord, ou la plus récente. */
export type TriDesSignalements = 'signalees' | 'recentes'

export function trierLesSignalements<T extends { joueurs: number; dernier: number }>(liste: readonly T[], tri: TriDesSignalements): T[] {
  return [...liste].sort((a, b) => (tri === 'signalees' ? b.joueurs - a.joueurs : 0) || b.dernier - a.dernier)
}
