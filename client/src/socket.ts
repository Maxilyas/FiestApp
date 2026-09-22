import { io, type Socket } from 'socket.io-client'
import type { ActionAck, ClientToServerEvents, JoinAck, ServerToClientEvents } from '../../shared/events'
import type { PublicProfile } from '../../shared/profil'
import { forgetMe, getState, oublierIdentite, setState, showToast } from './state'
import { applySample, resetClock, serverNow } from './clock'
import { currentSlug } from './routes'

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  // WebSocket d'abord : la négociation par défaut ouvre une liaison en
  // « long-polling » puis la remplace, soit deux ou trois allers-retours de
  // plus par téléphone au moment du scan. Le repli reste là pour les réseaux
  // qui bloquent le WebSocket.
  transports: ['websocket', 'polling'],
  tryAllTransports: true,
})

/**
 * Mesures d'horloge prises à chaque connexion. Trois suffisent : on ne garde
 * que la plus rapide, et la quatrième n'améliorerait plus grand-chose pour un
 * chronomètre qui se lit à la seconde.
 */
const CLOCK_SAMPLES = 3
const CLOCK_TIMEOUT_MS = 2000

/** Cale l'horloge de cet écran sur celle du serveur. Sans bruit si ça échoue. */
async function syncClock() {
  for (let i = 0; i < CLOCK_SAMPLES; i++) {
    const sentAt = Date.now()
    const res = await new Promise<{ serverNow: number } | null>(resolve => {
      const timer = setTimeout(() => resolve(null), CLOCK_TIMEOUT_MS)
      socket.emit('time:sync', {}, r => {
        clearTimeout(timer)
        resolve(r)
      })
    })
    // Serveur muet ou connexion reperdue : on garde l'écart connu et on
    // remesurera à la prochaine connexion.
    if (!res) return
    applySample({ serverTime: res.serverNow, sentAt, receivedAt: Date.now() })
  }
}

socket.on('connect', () => {
  setState({ connected: true })
  // Une coupure a pu durer : l'écart d'avant ne fait plus autorité.
  resetClock()
  void syncClock()
})
socket.on('disconnect', () => setState({ connected: false }))
socket.on('party:snapshot', snapshot => setState({ snapshot }))
socket.on('session:view', payload =>
  setState({ views: { ...getState().views, [payload.sessionId]: payload } }),
)
socket.on('session:ended', ({ sessionId }) => {
  const views = { ...getState().views }
  delete views[sessionId]
  setState({ views })
})
socket.on('player:removed', info => {
  // Un téléphone qui s'est re-présenté avec un jeton que la soirée ne connaît
  // plus : l'accusé de son `player:join` s'en est déjà chargé. Ce signal-là
  // ne sert qu'aux pages d'une ancienne version, qui ne lisent pas l'accusé.
  if (info?.reason === 'unknown-token') return
  // On oublie l'identité : le téléphone revient à l'écran d'inscription.
  const slug = currentSlug()
  if (slug) forgetMe(slug)
  else setState({ me: null, views: {} })
  showToast({ kind: 'info', message: "L'animateur t'a retiré de la soirée" })
})

// « Nouvelle soirée » : l'invité de ce téléphone n'existe plus. On oublie qui
// il était, pas son prénom : l'entrée le propose pré-rempli, écran d'équipe
// compris, pour rejoindre la soirée suivante. Sans ce signal, le téléphone
// restait devant un en-tête vide et « 0 pts », et le quiz suivant partait
// sans lui.
socket.on('party:reset', () => {
  const avait = !!getState().me
  const slug = currentSlug()
  if (slug) oublierIdentite(slug)
  else setState({ me: null, views: {} })
  if (avait) showToast({ kind: 'info', message: 'Nouvelle soirée ! Rejoins-la pour jouer' })
})

socket.on('toast', showToast)

/**
 * Suivre une soirée sans y jouer encore : la page d'inscription reçoit alors
 * ses instantanés — les équipes, « X déjà connectés ». Refusé si le nom de
 * l'espace ne mène nulle part.
 */
export function watchParty(
  slug: string,
): Promise<{ ok: boolean; error?: string; profile?: PublicProfile }> {
  return new Promise(resolve => socket.emit('party:watch', { slug }, resolve))
}

export function joinAsPlayer(
  slug: string,
  // Absents = « prends ceux de mon profil ». Quelqu'un qui les a choisis en
  // créant son profil n'a pas à les rechoisir sur le pas de la porte ; un
  // téléphone qui se reconnecte avec son jeton n'a rien à redire non plus.
  name?: string,
  avatar?: string,
  token?: string,
  // Omis à la reconnexion : le serveur garde alors l'équipe déjà choisie.
  teamId?: string | null,
): Promise<JoinAck> {
  return new Promise(resolve =>
    socket.emit('player:join', { slug, name, avatar, token, teamId }, resolve),
  )
}

export function setMyTeam(teamId: string | null): Promise<{ ok: boolean; error?: string }> {
  return new Promise(resolve => socket.emit('player:setTeam', { teamId }, resolve))
}

/**
 * Au-delà, on considère la réponse perdue. Large : une question dure au moins
 * dix secondes, et en 4G dans une salle bondée un aller-retour peut traîner.
 * Mieux vaut un accusé tardif qu'un faux « pas partie » qui ferait retaper un
 * joueur dont la réponse était déjà enregistrée.
 */
const ACTION_TIMEOUT_MS = 4000

/**
 * Le numéro de la dernière réponse envoyée. Seule la dernière a droit à un
 * renvoi : renvoyer un premier choix après qu'on en a tapé un second
 * écraserait le bon.
 */
let derniereReponse = 0

/**
 * Envoie une réponse et attend l'accusé de réception.
 *
 * L'espace et le jeton voyagent avec : un téléphone qui sort d'une coupure a,
 * côté serveur, une connexion toute neuve qui ne sait plus ni quelle soirée
 * elle suit ni qui elle est — et socket.io lui fait vider sa file d'attente
 * avant que la page ait pu se re-présenter. Sans eux, la réponse tapée pendant
 * la coupure était jetée en silence.
 *
 * Un accusé qui ne vient pas ne dit pas que la réponse est perdue, seulement
 * qu'on n'en sait rien : tant que sa question est ouverte, on la renvoie une
 * fois. C'est sans risque depuis qu'elle porte la question qu'elle vise — en
 * retard, le serveur la refuse au lieu de l'inscrire sur la suivante ; déjà
 * reçue, il la confirme sans rien réécrire.
 */
export function sendPlayerAction(
  sessionId: string,
  action: unknown,
  slug: string,
  token?: string,
): Promise<ActionAck> {
  const numero = ++derniereReponse
  const envoyer = () =>
    new Promise<ActionAck>(resolve => {
      let settled = false
      const settle = (res: ActionAck) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(res)
      }
      // Sans ce garde-fou, une réponse partie dans le vide laisserait la
      // promesse en suspens pour toujours — donc le joueur sans nouvelle.
      const timer = setTimeout(
        () => settle({ ok: false, reason: 'timeout', error: 'Ta réponse n’est pas partie — vérifie ta connexion' }),
        ACTION_TIMEOUT_MS,
      )
      socket.emit('player:action', { sessionId, action, slug, token }, settle)
    })

  /** La question que vise la réponse est-elle encore ouverte, à l'heure du serveur ? */
  const encoreOuverte = () => {
    const vise = action as { qIndex?: unknown; round?: unknown } | null
    const vue = getState().views[sessionId]?.view as
      | { phase?: string; qIndex?: number; round?: number; deadline?: number; paused?: boolean }
      | undefined
    return (
      !!vue &&
      // Sans tour, la réponse ne dit pas assez quelle question elle vise pour
      // qu'un renvoi tardif soit reconnu : on ne prend pas le risque.
      typeof vise?.round === 'number' &&
      vue.phase === 'question' &&
      !vue.paused &&
      vue.qIndex === vise.qIndex &&
      vue.round === vise.round &&
      typeof vue.deadline === 'number' &&
      serverNow() < vue.deadline
    )
  }

  return envoyer().then(res => {
    if (res.ok || res.reason !== 'timeout') return res
    if (numero !== derniereReponse || !encoreOuverte()) return res
    return envoyer()
  })
}

/**
 * L'écran commun se présente. Rien à envoyer : la session de l'animateur est
 * dans le cookie, que le navigateur joint à la poignée de main. En retour,
 * son espace — ou un refus s'il n'est pas connecté.
 */
export function helloHost(): Promise<{ ok: boolean; slug?: string; name?: string }> {
  return new Promise(resolve => socket.emit('host:hello', {}, resolve))
}

// En dev, un hot-reload de ce module créerait une 2e connexion socket branchée
// sur un store neuf → UI figée jusqu'au F5. On force un vrai rechargement.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
