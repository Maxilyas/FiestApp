import { useSyncExternalStore } from 'react'
import type { PartySnapshot } from '../../shared/types'
import type { ClotureDeSoiree, FinDeSoiree, GainAnnonce, ProgresDeQuiz, SoireeClose } from '../../shared/fin'
import { currentSlug } from './routes'

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

const finKey = (slug: string) => `quizz.fin.${slug}`
const FIN_PREFIXE = 'quizz.fin.'

/** Une fin de soirée rouverte au rechargement, tant qu'on ne l'a pas quittée, et pas le surlendemain. */
const FIN_ROUVERTE_MS = 12 * 3600 * 1000
/** « La dernière soirée » se propose une semaine : c'est le lendemain qu'on la cherche. */
const DERNIERE_MS = 7 * 24 * 3600 * 1000

/** Ce que le téléphone garde de la dernière soirée close d'un espace. */
export interface SoireeGardee {
  soiree: SoireeClose
  /** Son identifiant dans l'archive, pour « Mon bilan » ; absent si on ne le sait pas. */
  joueurId?: string
  /** La fin entière, quand le téléphone l'a reçue. */
  fin?: FinDeSoiree
  recueLe: number
  /** Faux dès qu'on passe à la soirée suivante : la fin ne se rouvre plus d'elle-même. */
  ouverte: boolean
}

export function garderFin(slug: string, fin: FinDeSoiree) {
  const g: SoireeGardee = { soiree: fin.soiree, joueurId: fin.joueurId, fin, recueLe: Date.now(), ouverte: true }
  writeSafe(storage => storage.setItem(finKey(slug), JSON.stringify(g)))
}

/** Une soirée close sans sa fin (le serveur l'avait oubliée) : de quoi la revoir, au moins. */
export function garderSoireeClose(slug: string, soiree: SoireeClose) {
  const avant = readJson<SoireeGardee>(finKey(slug))
  // La même soirée, déjà gardée avec sa fin : on ne l'appauvrit pas.
  if (avant?.soiree?.id === soiree.id) return
  const g: SoireeGardee = { soiree, recueLe: Date.now(), ouverte: false }
  writeSafe(storage => storage.setItem(finKey(slug), JSON.stringify(g)))
}

/** On passe à la soirée suivante : la fin reste gardée, mais ne se rouvre plus. */
export function quitterFin(slug: string) {
  const g = readJson<SoireeGardee>(finKey(slug))
  if (g) writeSafe(storage => storage.setItem(finKey(slug), JSON.stringify({ ...g, ouverte: false })))
  setState({ fin: null })
}

/** La dernière soirée close de cet espace, gardée ici cette semaine. */
export function soireeGardee(slug: string): SoireeGardee | null {
  const g = readJson<SoireeGardee>(finKey(slug))
  if (!g?.soiree?.id || typeof g.recueLe !== 'number') return null
  return Date.now() - g.recueLe < DERNIERE_MS ? g : null
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

/** La fin à rouvrir au chargement : reçue il y a peu, jamais quittée, et le téléphone n'incarne personne. */
function finARouvrir(slug: string): FinDeSoiree | null {
  if (readMe(slug)) return null
  const g = soireeGardee(slug)
  return g?.fin && g.ouverte && Date.now() - g.recueLe < FIN_ROUVERTE_MS ? g.fin : null
}

const slugAtLoad = currentSlug()

let state: AppState = {
  connected: false,
  snapshot: null,
  me: slugAtLoad ? readMe(slugAtLoad) : null,
  views: {},
  toast: null,
  fin: slugAtLoad ? finARouvrir(slugAtLoad) : null,
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
  try {
    localStorage.removeItem(meKey(slug))
  } catch {
    // Stockage refusé (navigation privée, quota) : oublier en mémoire suffit
    // pour montrer l'entrée tout de suite.
  }
  setState({ me: null, views: {} })
}
