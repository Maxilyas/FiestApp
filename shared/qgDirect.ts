import type { DirectDuQg, ModeDuQg, SoireeDuQg } from './qg'
import { modeDeLaSource, type ModeSurveille } from './pannes'
import { formatNumber } from './typographie'

/**
 * Le direct du QG (le QG 2, lot 3, le 4 novembre 2026 : « je ne peux pas
 * trier, voir sur une durée précise, sur du temps réel ») : ce que le serveur
 * mesure à la seconde, gardé en mémoire au pas de dix secondes sur quinze
 * minutes, la présence de chaque mode et le fil de ce qui arrive — poussés par
 * un flux (`GET /api/admin/flux`, `text/event-stream`) toutes les deux secondes
 * tant qu'un onglet du QG est visible. Rien n'en va à Turso, rien n'en reste
 * après un redémarrage, et rien n'y nomme un joueur.
 */

/** Le flux : la page l'ouvre, le serveur l'écarte de ce qui gèle (`server.ts`). */
export const CHEMIN_DU_FLUX = '/api/admin/flux'

/** Le pas du direct : celui du relevé de la charge (`Charge`), dix secondes. */
export const PAS_DU_DIRECT_MS = 10_000
/** Quinze minutes de pas, gardées en mémoire. */
export const POINTS_DU_DIRECT = 90
/** Un message du flux toutes les deux secondes. */
export const ENVOI_DU_FLUX_MS = 2_000
/** Un joueur compte dans son mode tant qu'il y est passé ces cinq dernières minutes — comme « en ligne » (`EN_LIGNE_MS`). */
export const PRESENCE_MS = 5 * 60_000
/** Les événements du fil gardés en mémoire. */
export const EVENEMENTS_DU_FIL = 80
/**
 * Une page qui n'a rien reçu du flux depuis ce délai le croit coupé — un
 * proxy qui retient les réponses, un réseau qui tombe — et relit le direct
 * comme avant, toutes les dix secondes, jusqu'à ce qu'il revienne.
 */
export const FLUX_MUET_MS = 7_000

export const debutDuPas = (instant: number) => Math.floor(instant / PAS_DU_DIRECT_MS) * PAS_DU_DIRECT_MS

/** Un temps sur un pas : combien d'appels, la médiane, le 95ᵉ centile, le pire. */
export interface MesureDuPas {
  n: number
  p50: number
  p95: number
  max: number
}

/** Dix secondes du serveur. */
export interface PointDuDirect {
  /** Le début du pas. */
  a: number
  /** Les requêtes servies — les pages, les fichiers, l'API ; ni le temps réel, ni `/healthz` —, dont refusées (4xx) et en erreur (5xx). */
  requetes: number
  refusees: number
  enErreur: number
  /** Les erreurs serveur : les routes, les sockets, les exceptions échappées. */
  erreurs: number
  /** Ce qu'un joueur attend : les routes d'API ensemble. */
  routes: MesureDuPas | null
  /** Un aller-retour vers Turso. */
  base: MesureDuPas | null
  /** La charge du dernier relevé (toutes les dix secondes) : le processeur d'un cœur en pour cent, le pire gel de la boucle, la mémoire. */
  processeur: number | null
  boucleMaxMs: number | null
  memoireMo: number | null
  /** Les invités connectés à une soirée, et les clients du temps réel. */
  invites: number | null
  tempsReel: number | null
  /** Les gels de la boucle de plus d'une demi-seconde finis dans le pas. */
  gels: number
  /** Les joueurs de chaque mode à la fin du pas : les profils passés sur ses routes ces cinq dernières minutes ; en soirée, les invités connectés. */
  modes: Record<ModeDuQg, number>
}

export const modesAZero = (): Record<ModeDuQg, number> => ({ soiree: 0, campagne: 0, cabinet: 0, jour: 0, duel: 0 })

export const pointVide = (a: number): PointDuDirect => ({
  a,
  requetes: 0,
  refusees: 0,
  enErreur: 0,
  erreurs: 0,
  routes: null,
  base: null,
  processeur: null,
  boucleMaxMs: null,
  memoireMo: null,
  invites: null,
  tempsReel: null,
  gels: 0,
  modes: modesAZero(),
})

export const SORTES_DU_FIL = ['partie', 'soiree', 'profil', 'boutique', 'erreur', 'serveur'] as const
export type SorteDuFil = (typeof SORTES_DU_FIL)[number]

/** Les filtres du fil : ce qui se joue, ce qui s'achète et naît, ce qui casse. */
export const FILTRES_DU_FIL: { cle: 'tout' | 'parties' | 'soirees' | 'profils' | 'technique'; nom: string; sortes: readonly SorteDuFil[] }[] = [
  { cle: 'tout', nom: 'Tout', sortes: SORTES_DU_FIL },
  { cle: 'parties', nom: 'Parties', sortes: ['partie'] },
  { cle: 'soirees', nom: 'Soirées', sortes: ['soiree'] },
  { cle: 'profils', nom: 'Profils et boutique', sortes: ['profil', 'boutique'] },
  { cle: 'technique', nom: 'Erreurs et serveur', sortes: ['erreur', 'serveur'] },
]

/** Ce qui arrive, une ligne du fil. Les mêmes, arrivés dans le même pas, se comptent ensemble (`n`). */
export interface EvenementDuFil {
  id: number
  /** Son rang dans le fil, refait quand il change (`n`) : la page reprend ce qui a bougé depuis le rang qu'elle a. */
  rang: number
  a: number
  sorte: SorteDuFil
  mode: ModeDuQg | null
  texte: string
  n: number
}

/** Ce qu'un événement dit, avant d'avoir son rang et son heure. */
export interface FaitDuFil {
  sorte: SorteDuFil
  mode: ModeDuQg | null
  texte: string
}

/**
 * Les routes qui racontent quelque chose au fil, quand elles réussissent :
 * une partie qui commence, un profil qui naît, un achat. Sans un nom : « une
 * partie du quiz du jour commence », jamais qui. Une route renommée en sort
 * en silence — `qg-direct.test.ts` relit chacune dans le routeur.
 */
export const EVENEMENTS_DES_ROUTES: Record<string, FaitDuFil> = {
  'POST /api/joueur/inscription': { sorte: 'profil', mode: null, texte: 'Un profil est né' },
  'POST /api/joueur/themes': { sorte: 'boutique', mode: null, texte: 'Un thème acheté' },
  'POST /api/joueur/compagnons': { sorte: 'boutique', mode: null, texte: 'Un compagnon adopté' },
  'POST /api/joueur/fonds': { sorte: 'boutique', mode: null, texte: 'Un fond de carte acheté' },
  'POST /api/campagne/vies': { sorte: 'boutique', mode: 'campagne', texte: 'Une vie achetée' },
  'POST /api/jour/commencer': { sorte: 'partie', mode: 'jour', texte: 'Une partie du quiz du jour commence' },
  'POST /api/campagne/serie': { sorte: 'partie', mode: 'campagne', texte: 'Une série de campagne commence' },
  'POST /api/campagne/defi': { sorte: 'partie', mode: 'campagne', texte: 'Une tentative du défi de la semaine' },
  'POST /api/campagne/sentiers/epreuve': { sorte: 'partie', mode: 'campagne', texte: 'Une épreuve des sentiers commence' },
  'POST /api/campagne/sujets/epreuve': { sorte: 'partie', mode: 'campagne', texte: 'Une étape d’un parcours de thème commence' },
  'POST /api/campagne/revision': { sorte: 'partie', mode: 'campagne', texte: 'Une révision commence' },
  'POST /api/campagne/duel': { sorte: 'partie', mode: 'duel', texte: 'Un duel est lancé' },
  'POST /api/campagne/rencontre': { sorte: 'partie', mode: 'duel', texte: 'Une rencontre contre Automate' },
  'POST /api/cabinet/partie': { sorte: 'partie', mode: 'cabinet', texte: 'Une partie du Cabinet commence' },
  'POST /api/cabinet/traversee': { sorte: 'partie', mode: 'cabinet', texte: 'Une traversée du Cabinet commence' },
}

/** Le mode du QG d'une route, pour la présence : le défi compte en campagne ; la boutique, l'accueil, les soirées (comptées par leurs téléphones) n'en sont pas. */
const MODE_DU_QG: Partial<Record<ModeSurveille, ModeDuQg>> = { jour: 'jour', campagne: 'campagne', defi: 'campagne', duels: 'duel', cabinet: 'cabinet' }

export function modeDuDirect(route: string): ModeDuQg | null {
  // La page des duels (`/duels`) lit ses routes à part de la campagne : un joueur qui y regarde son classement est aux duels.
  if (/^[A-Z]+ \/api\/duels(\/|$)/.test(route)) return 'duel'
  const surveille = modeDeLaSource(route)
  return surveille ? (MODE_DU_QG[surveille] ?? null) : null
}

const invites = (n: number) => `${formatNumber(n)} invité${n > 1 ? 's' : ''}`
const telephones = (n: number) => `${formatNumber(n)} téléphone${n > 1 ? 's' : ''}`

/**
 * Ce qui a changé dans les soirées d'un tour du flux à l'autre, en lignes du
 * fil : une soirée qui s'ouvre, un quiz qui commence ou finit, une soirée
 * laissée en plan, une soirée close. Des soirées des autres, rien que des
 * chiffres — le salon, le numéro du quiz, ses invités —, jamais le quiz, la
 * question, un prénom ni un titre (règle `qg.md`).
 */
export function evenementsDesSoirees(avant: readonly SoireeDuQg[], apres: readonly SoireeDuQg[]): FaitDuFil[] {
  const faits: FaitDuFil[] = []
  const dire = (s: SoireeDuQg, quoi: string) => faits.push({ sorte: 'soiree', mode: 'soiree', texte: `${s.salon.nom} · ${quoi}` })
  const d = new Map(avant.map(s => [s.spaceId, s]))
  for (const s of apres) {
    const a = d.get(s.spaceId)
    d.delete(s.spaceId)
    if (!a) {
      dire(s, `une soirée s’ouvre · ${invites(s.inscrits)}`)
      if (s.partie) dire(s, `le quiz ${s.partie.quiz} commence · ${telephones(s.connectes)}`)
      continue
    }
    const fini = a.partie && (!s.partie || s.partie.quiz !== a.partie.quiz)
    if (fini && a.partie) dire(s, `le quiz ${a.partie.quiz} est fini`)
    if (s.partie && (!a.partie || s.partie.quiz !== a.partie.quiz)) dire(s, `le quiz ${s.partie.quiz} commence · ${telephones(s.connectes)}`)
    if (a.etat === 'en-cours' && s.etat === 'en-plan') dire(s, 'laissée en plan')
  }
  for (const s of d.values()) dire(s, 'la soirée est close')
  return faits
}

/** Une route de la dernière minute, telle que le direct la montre. */
export interface RouteDuDirect {
  route: string
  parMin: number
  p50: number
  p95: number
  max: number
}

/** Un message du flux : ce qui a changé depuis le précédent — tout, au premier (`debut`). */
export interface MessageDuFlux {
  maintenant: number
  debut?: true
  /** Le direct du poste de commande, quand il a changé. */
  direct?: DirectDuQg
  /** Les pas finis depuis le message d'avant, du plus ancien au plus récent. */
  points: PointDuDirect[]
  /** Le pas en cours, entamé. */
  enCours: PointDuDirect
  /** Les routes d'API de la dernière minute, quand elles ont changé. */
  routes?: RouteDuDirect[]
  /** Les événements neufs ou recomptés depuis le message d'avant, du plus ancien au plus récent. */
  fil: EvenementDuFil[]
  /** Les plafonds du conteneur, au premier message. */
  plafonds?: { processeurPct: number | null; memoireMo: number | null }
}

/** Ce que la page tient du flux, message après message. */
export interface EtatDuFlux {
  maintenant: number
  direct: DirectDuQg | null
  points: PointDuDirect[]
  enCours: PointDuDirect | null
  routes: RouteDuDirect[]
  fil: EvenementDuFil[]
  plafonds: { processeurPct: number | null; memoireMo: number | null }
}

export const fluxVide = (): EtatDuFlux => ({ maintenant: 0, direct: null, points: [], enCours: null, routes: [], fil: [], plafonds: { processeurPct: null, memoireMo: null } })

/**
 * Un message reçu, posé sur ce que la page tient : un premier message la
 * remet à zéro ; les suivants ajoutent leurs pas — quinze minutes au plus —,
 * remplacent un événement recompté, et ne touchent au direct et aux routes
 * que s'ils les portent. Pure : la page et `qg-direct.test.ts` la partagent.
 */
export function recevoirLeFlux(etat: EtatDuFlux, m: MessageDuFlux): EtatDuFlux {
  const base = m.debut ? fluxVide() : etat
  const points = [...base.points.filter(p => !m.points.some(q => q.a === p.a)), ...m.points].sort((a, b) => a.a - b.a).slice(-POINTS_DU_DIRECT)
  const parId = new Map(base.fil.map(e => [e.id, e]))
  for (const e of m.fil) parId.set(e.id, e)
  const fil = [...parId.values()].sort((a, b) => b.id - a.id).slice(0, EVENEMENTS_DU_FIL)
  return {
    maintenant: m.maintenant,
    // Le même objet tant qu'aucun direct neuf n'arrive : le poste de commande ne se redessine que s'il change.
    direct: m.direct ?? base.direct,
    points,
    enCours: m.enCours,
    routes: m.routes ?? base.routes,
    fil,
    plafonds: m.plafonds ?? base.plafonds,
  }
}
