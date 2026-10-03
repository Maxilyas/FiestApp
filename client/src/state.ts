import { useSyncExternalStore } from 'react'
import type { PartySnapshot } from '../../shared/types'
import {
  estUnRetour,
  finAGarder,
  finLisible,
  soireeCloseLisible,
  type ClotureDeSoiree,
  type FinDeSoiree,
  type GainAnnonce,
  type ProgresDeQuiz,
  type SoireeClose,
} from '../../shared/fin'
import { currentSlug, route } from './routes'

export interface SessionView {
  sessionId: string
  view: unknown
}

export interface Me {
  playerId: string
  token: string
}

/**
 * Le prénom et l'avatar retenus sur CE téléphone pour CET espace.
 *
 * Rien à voir avec un profil de joueur (`PublicProfile`, côté serveur, avec
 * son niveau et ses badges) : ce n'est qu'une commodité locale, celle qui
 * évite de retaper son prénom après un rafraîchissement. La confusion entre
 * les deux a failli coûter cher — d'où ce nom-là.
 */
export interface ChoixLocal {
  name: string
  avatar: string
}

export interface Toast {
  kind: 'info' | 'error'
  message: string
}

export interface AppState {
  connected: boolean
  snapshot: PartySnapshot | null
  me: Me | null
  views: Record<string, SessionView>
  toast: Toast | null
  /** Téléphone : la soirée est close, voici la sienne — jusqu'à ce qu'il passe à la suivante. */
  fin: FinDeSoiree | null
  /** Téléphone : ce que le dernier podium vient de lui rapporter, le temps de le fêter. */
  gain: GainAnnonce | null
  /** Écran commun : la soirée qu'on vient de clore, à annoncer à la salle. */
  cloture: ClotureDeSoiree | null
  /** Écran commun : les montées de niveau du dernier podium. */
  progres: ProgresDeQuiz | null
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/**
 * Écrit sans jamais casser la page. Cookies bloqués, navigateur intégré d'une
 * messagerie, Safari en navigation privée : le stockage peut lever une
 * exception à la moindre écriture. Ce qu'on y range n'est qu'une commodité —
 * se re-présenter après un rafraîchissement — et un invité inscrit doit entrer
 * dans la soirée même si son téléphone refuse de s'en souvenir : sans ce
 * filet, « Rejoindre la soirée » restait grisé pour toujours alors que le
 * serveur l'avait bel et bien inscrit.
 */
function writeSafe(write: (storage: Storage) => void) {
  try {
    write(localStorage)
  } catch {
    // La mémoire seule en moins : un rafraîchissement ramènera à l'entrée.
  }
}

// Ce que le téléphone retient est rangé par espace : un invité de deux
// soirées différentes a une identité dans chacune, et le jeton de l'une ne
// vaut rien dans l'autre.
const meKey = (slug: string) => `quizz.me.${slug}`
// La clé garde son ancien nom : la renommer ferait oublier leur prénom à tous
// les téléphones qui ont déjà joué, et leur ferait repasser par l'entrée.
const choixKey = (slug: string) => `quizz.profile.${slug}`

/** L'invité mémorisé sur ce téléphone pour cet espace, s'il y a joué. */
export function readMe(slug: string): Me | null {
  return readJson<Me>(meKey(slug))
}

// ── La fin de soirée, gardée ─────────────────────────────────────────────
//
// Elle ne vivait qu'en mémoire : un rechargement, le retour du navigateur
// depuis le souvenir qu'elle venait d'ouvrir, un redémarrage du serveur — et
// l'invité retombait sur « Entrer dans la soirée », sans rien de la veille.
// Elle se range maintenant sur le téléphone, par espace ; rien n'en part.
// Elle se rouvre quand on revient sur la page, jamais quand on y arrive :
// qui arrive vient jouer, et l'entrée la propose en une ligne.

const finKey = (slug: string) => `quizz.fin.${slug}`
const FIN_PREFIXE = 'quizz.fin.'

/** Une fin de soirée rouverte au rechargement, tant qu'on ne l'a pas quittée, et pas le surlendemain. */
const FIN_ROUVERTE_MS = 12 * 3600 * 1000
/** « La dernière soirée » se propose une semaine : c'est le lendemain qu'on la cherche. */
const DERNIERE_MS = 7 * 24 * 3600 * 1000

/**
 * La forme de l'entrée gardée. Une page d'une autre version rouvrait une fin
 * rangée sous une autre forme, et restait sur « Oups » : une entrée d'une
 * autre version ne se relit pas. Change-la quand `SoireeGardee` ou
 * `FinDeSoiree` changent de forme.
 */
const VERSION_GARDEE = 1

/** Ce que le téléphone garde de la dernière soirée close d'un espace. */
export interface SoireeGardee {
  v: typeof VERSION_GARDEE
  soiree: SoireeClose
  /** Son identifiant dans l'archive, pour « Mon bilan » ; absent si on ne le sait pas. */
  joueurId?: string
  /**
   * La fin entière, quand le téléphone l'a reçue — sans le récit d'un Divin
   * (`finAGarder`). Elle s'efface dès qu'on passe à la suivante, ou au-delà
   * de douze heures : sur un téléphone prêté, `/<espace>` rouvrait la fin de
   * l'emprunteur.
   */
  fin?: FinDeSoiree
  recueLe: number
  /**
   * Faux dès qu'on passe à la soirée suivante, ou qu'on arrive sur la page
   * pour jouer : la fin ne se rouvre plus d'elle-même.
   */
  ouverte: boolean
}

function ecrireGardee(slug: string, g: SoireeGardee) {
  writeSafe(storage => storage.setItem(finKey(slug), JSON.stringify(g)))
}

/**
 * L'entrée gardée, relue avant de servir : d'une autre version ou abîmée,
 * elle ne sert pas ; sa fin, illisible ou vieille de plus de douze heures,
 * s'efface — et s'efface aussi du stockage.
 */
function lireGardee(slug: string): SoireeGardee | null {
  const g = readJson<Partial<SoireeGardee>>(finKey(slug))
  if (!g || g.v !== VERSION_GARDEE || !soireeCloseLisible(g.soiree) || typeof g.recueLe !== 'number') return null
  const lue: SoireeGardee = {
    v: VERSION_GARDEE,
    soiree: g.soiree,
    ...(typeof g.joueurId === 'string' && { joueurId: g.joueurId }),
    recueLe: g.recueLe,
    ouverte: g.ouverte === true,
  }
  if (g.fin === undefined) return lue
  if (finLisible(g.fin) && Date.now() - g.recueLe < FIN_ROUVERTE_MS) return { ...lue, fin: g.fin }
  ecrireGardee(slug, lue)
  return lue
}

/** Vrai tant que la fin affichée vient du stockage, et pas du serveur à l'instant. */
let finDuTelephone = false

/** La fin affichée a été rouverte depuis le téléphone, pas reçue du serveur. */
export function finRouverte(): boolean {
  return finDuTelephone
}

/** Comment la page s'est chargée, tel que le navigateur le dit (`estUnRetour`) ; muet, c'est une arrivée. */
function chargementDeLaPage(): string | number | undefined {
  try {
    const entree = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return entree?.type ?? performance.navigation?.type
  } catch {
    return undefined
  }
}

/**
 * Vrai tant qu'on arrive sur la page — un lien, le QR, « Jouer depuis cet
 * appareil » — et qu'elle n'a encore montré aucun écran de la soirée
 * (`premierEcranMontre`). Qui arrive vient jouer : une fin de la soirée
 * d'avant ne l'arrête plus (`finARouvrir`, `recevoirFinRendue`).
 */
let arrivee = !estUnRetour(chargementDeLaPage())

/** Le premier écran de la soirée est montré : le téléphone n'arrive plus, il y est. */
export function premierEcranMontre() {
  arrivee = false
}

/**
 * Garde la fin reçue du serveur. Montrée, elle se rouvre au retour sur la
 * page ; sinon le téléphone n'en garde que la soirée, que l'entrée propose en
 * une ligne — « mon bilan » compris.
 */
export function garderFin(slug: string, fin: FinDeSoiree, montree = true) {
  finDuTelephone = false
  ecrireGardee(slug, {
    v: VERSION_GARDEE,
    soiree: fin.soiree,
    ...(fin.joueurId && { joueurId: fin.joueurId }),
    ...(montree && { fin: finAGarder(fin) }),
    recueLe: Date.now(),
    ouverte: montree,
  })
}

/**
 * La fin que le serveur rend au jeton d'une soirée close (`soiree-close`) :
 * le téléphone n'était pas là à la clôture. Réveillé sur la page où il
 * jouait, ou revenu dessus, il la reçoit comme s'il avait été là. Arrivé pour
 * jouer — l'animateur qui rouvre la soirée sur son téléphone depuis sa
 * console, l'invité qui rescanne le QR —, il n'en garde que la soirée, et
 * l'entrée s'ouvre : l'onglet laissé en arrière-plan pendant la clôture
 * montrait sinon la fin d'avant, qui ne partait que par « Rejoindre la
 * soirée suivante ».
 */
export function recevoirFinRendue(slug: string, fin: FinDeSoiree) {
  oublierIdentite(slug)
  garderFin(slug, fin, !arrivee)
  if (!arrivee) setState({ fin })
}

/** Une soirée close sans sa fin (le serveur l'avait oubliée) : de quoi la revoir, au moins. */
export function garderSoireeClose(slug: string, soiree: SoireeClose) {
  const avant = lireGardee(slug)
  // La même soirée, déjà gardée avec sa fin : on ne l'appauvrit pas.
  if (avant?.soiree.id === soiree.id) return
  ecrireGardee(slug, { v: VERSION_GARDEE, soiree, recueLe: Date.now(), ouverte: false })
}

/** La fin gardée ne se rouvrira plus : sa soirée reste gardée pour le lendemain, sa fin s'efface. */
function fermerGardee(slug: string, g: SoireeGardee) {
  const { fin: _, ...sansFin } = g
  ecrireGardee(slug, { ...sansFin, ouverte: false })
}

/** On passe à la soirée suivante : la fin quitte l'écran, et ne se rouvrira plus. */
export function quitterFin(slug: string) {
  const g = lireGardee(slug)
  if (g) fermerGardee(slug, g)
  finDuTelephone = false
  setState({ fin: null })
}

/** La dernière soirée close de cet espace, gardée ici cette semaine. */
export function soireeGardee(slug: string): SoireeGardee | null {
  const g = lireGardee(slug)
  return g && Date.now() - g.recueLe < DERNIERE_MS ? g : null
}

/** La plus récente des soirées closes gardées sur ce téléphone, tous espaces confondus : l'accueil la propose. */
export function derniereSoireeGardee(): SoireeGardee | null {
  let slugs: string[] = []
  try {
    slugs = Object.keys(localStorage)
      .filter(k => k.startsWith(FIN_PREFIXE))
      .map(k => k.slice(FIN_PREFIXE.length))
  } catch {
    return null
  }
  return (
    slugs
      .map(soireeGardee)
      .filter((g): g is SoireeGardee => !!g)
      .sort((a, b) => b.recueLe - a.recueLe)[0] ?? null
  )
}

/**
 * La fin à rouvrir au chargement : reçue il y a peu, lisible, jamais
 * quittée, le téléphone n'incarne personne — et l'on revient sur la page :
 * un rechargement, le retour du navigateur depuis le bilan qu'elle venait
 * d'ouvrir. Qui y arrive vient jouer : elle ne se rouvre pas, ni plus tard
 * au rechargement de l'entrée. La page la retire aussi si la soirée suivante
 * a déjà lancé une partie (`PlayerApp`).
 */
function finARouvrir(slug: string): FinDeSoiree | null {
  if (readMe(slug)) return null
  const g = lireGardee(slug)
  if (!g?.ouverte || !g.fin) return null
  if (arrivee) {
    fermerGardee(slug, g)
    return null
  }
  finDuTelephone = true
  return g.fin
}

const slugAtLoad = currentSlug()

let state: AppState = {
  connected: false,
  snapshot: null,
  me: slugAtLoad ? readMe(slugAtLoad) : null,
  views: {},
  toast: null,
  // Sur la page du jeu seulement : le bilan qu'elle ouvre dans cet onglet lit
  // aussi ce module, et, arrivé là par son lien, il fermait la fin — le
  // retour du navigateur ne la retrouvait plus.
  fin: route.kind === 'join' ? finARouvrir(route.slug) : null,
  gain: null,
  cloture: null,
  progres: null,
}

const listeners = new Set<() => void>()

export function getState(): AppState {
  return state
}

export function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getState,
  )
}

export function saveMe(slug: string, me: Me) {
  writeSafe(storage => storage.setItem(meKey(slug), JSON.stringify(me)))
  setState({ me })
}

/** L'animateur a exclu ce téléphone : il oublie son identité et repart à l'entrée. */
export function forgetMe(slug: string) {
  writeSafe(storage => {
    storage.removeItem(meKey(slug))
    storage.removeItem(choixKey(slug))
  })
  setState({ me: null, views: {} })
}

/**
 * Ce que ce téléphone a déjà choisi ici.
 *
 * Il sert deux fois : à pré-remplir l'entrée quand ce téléphone doit y
 * repasser — exclu pendant son sommeil, « Nouvelle soirée » : la reconnexion,
 * elle, ne se fait plus qu'au jeton —, et à savoir que l'entrée a déjà été vue
 * dans cet espace — un écran de connexion qu'on repousse deux fois devient un
 * péage.
 */
export function loadChoix(slug: string): ChoixLocal | null {
  return readJson<ChoixLocal>(choixKey(slug))
}

export function saveChoix(slug: string, choix: ChoixLocal) {
  writeSafe(storage => storage.setItem(choixKey(slug), JSON.stringify(choix)))
}

let toastTimer: ReturnType<typeof setTimeout> | undefined
export function showToast(toast: Toast) {
  clearTimeout(toastTimer)
  setState({ toast })
  toastTimer = setTimeout(() => setState({ toast: null }), 4000)
}

// Même raison que socket.ts : le store est un singleton, pas hot-remplaçable.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())

/**
 * Ce téléphone n'est plus personne ici — son jeton ne désigne plus aucun
 * invité (exclu pendant qu'il dormait, « Nouvelle soirée ») — mais il garde
 * le prénom et l'avatar qu'il avait choisis : l'entrée les propose
 * pré-remplis, et l'on repasse par l'écran d'équipe. `forgetMe`, lui, efface
 * aussi ce choix.
 */
export function oublierIdentite(slug: string) {
  oublierJeton(slug)
  setState({ me: null, views: {} })
}

/**
 * Le jeton seul, sans toucher à l'écran : pour la page qui s'en va. Vider
 * l'état d'abord démontait la garde du retour (`useGardeRetour`), dont le
 * `history.back()` annulait le départ vers l'accueil.
 */
export function oublierJeton(slug: string) {
  try {
    localStorage.removeItem(meKey(slug))
  } catch {
    // Stockage refusé (navigation privée, quota) : oublier en mémoire suffit
    // pour montrer l'entrée tout de suite.
  }
}
