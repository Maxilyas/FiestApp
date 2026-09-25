import { io, type Socket } from 'socket.io-client'
import type {
  AbsentDuMemeNom,
  ActionAck,
  ClientToServerEvents,
  JoinAck,
  PlaceRendue,
  ServerToClientEvents,
} from '../../shared/events'
import type { PublicProfile } from '../../shared/profil'
import { MOTIFS } from '../../shared/erreurs'
import { forgetMe, garderFin, getState, oublierIdentite, setState, showToast } from './state'
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
  if (info?.reason) return
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

// La soirée est close : le téléphone montre sa fin de soirée, et n'incarne
// plus personne. Il garde son prénom : la soirée suivante le proposera.
socket.on('soiree:fin', fin => {
  const slug = currentSlug()
  if (slug) {
    oublierIdentite(slug)
    garderFin(slug, fin)
  }
  setState({ fin, gain: null })
})

// Au podium d'un quiz : de quoi fêter un niveau, au lieu d'un simple toast.
socket.on('player:gain', gain => setState({ gain }))

// L'écran commun : la clôture à annoncer, et les montées de niveau du podium.
// Le bandeau du dernier podium s'efface : la clôture prend tout l'écran.
socket.on('soiree:cloture', cloture => setState({ cloture, progres: null }))
socket.on('soiree:progres', progres => setState({ progres }))

socket.on('toast', showToast)

/** Le temps accordé à la sonde : une heure du serveur ne met pas deux secondes à revenir. */
const SONDE_MS = 2000
let sondeEnCours = false

/**
 * La liaison vit-elle encore ? Sinon, on la rouvre sans attendre.
 *
 * Un téléphone qui sort de veille garde souvent une connexion morte que
 * socket.io croit vivante : il ne l'apprend qu'au battement de cœur manqué,
 * une question entière plus tard. Pendant ce temps, rien ne part et rien
 * n'arrive, sans un mot. On demande donc l'heure au serveur — la question la
 * plus légère qui soit — et le silence suffit à trancher.
 */
async function verifierLiaison() {
  if (!socket.connected || sondeEnCours) return
  sondeEnCours = true
  const sondee = socket.id
  const vivante = await new Promise<boolean>(resolve => {
    const minuteur = setTimeout(() => resolve(false), SONDE_MS)
    socket.emit('time:sync', {}, () => {
      clearTimeout(minuteur)
      resolve(true)
    })
  })
  sondeEnCours = false
  // Une reconnexion a pu se faire entre-temps : c'est l'ancienne liaison qui
  // s'est tue, pas celle-ci.
  if (vivante || !socket.connected || socket.id !== sondee) return
  socket.disconnect()
  socket.connect()
}

// Au retour au premier plan : écran rallumé, onglet retrouvé, appel terminé.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void verifierLiaison()
})
// Et au retour du réseau : la 4G qui revient après un tunnel laisse la même
// connexion morte derrière elle.
window.addEventListener('online', () => void verifierLiaison())

/**
 * Au-delà, un accusé n'arrivera plus. Dix secondes : un aller-retour en 4G
 * dans une salle bondée, plus la lecture d'un profil dans la base distante,
 * y tiennent largement — et un invité debout devant un bouton grisé
 * n'attendra pas davantage.
 */
const ACCUSE_TIMEOUT_MS = 10_000

/**
 * Émet et attend l'accusé, mais pas indéfiniment. Passé le délai, rejette
 * avec le motif à afficher (`MOTIFS.reseau` ou `MOTIFS.silence`).
 *
 * Sans délai, une coupure laissait « Rejoindre la soirée » grisé sans un mot,
 * et un paquet perdu ne se débloquait jamais.
 *
 * Et on n'écrit que sur une liaison qui a une chance d'aboutir. Hors
 * connexion, socket.io garderait le message en réserve pour le rejouer au
 * retour ; et quand le navigateur se sait hors ligne, le message confié à la
 * liaison morte peut encore être délivré quand le réseau revient. Dans les
 * deux cas, il arrive après le délai — après que l'invité a réessayé — et
 * l'inscrit deux fois : « Camille » et « Camille (2) ». On attend donc, dans
 * le délai, une liaison et un réseau, puis on émet une seule fois.
 */
function demander<T>(emettre: (ack: (res: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let fini = false
    let parti = false
    const nettoyer = () => {
      clearTimeout(minuteur)
      socket.off('connect', tenter)
      window.removeEventListener('online', tenter)
    }
    const tenter = () => {
      if (fini || parti || !socket.connected || !navigator.onLine) return
      parti = true
      emettre(res => {
        if (fini) return
        fini = true
        nettoyer()
        resolve(res)
      })
    }
    const minuteur = setTimeout(() => {
      fini = true
      nettoyer()
      reject(new Error(navigator.onLine ? MOTIFS.silence : MOTIFS.reseau))
      // Un accusé qui ne revient pas, c'est presque toujours une liaison
      // morte que le téléphone n'a pas encore vue : on s'en assure.
      void verifierLiaison()
    }, ACCUSE_TIMEOUT_MS)
    socket.on('connect', tenter)
    window.addEventListener('online', tenter)
    tenter()
  })
}

/**
 * Suivre une soirée sans y jouer encore : la page d'inscription reçoit alors
 * ses instantanés — les équipes, « X déjà connectés ». Refusé si le nom de
 * l'espace ne mène nulle part.
 *
 * Sans réponse dans le délai, la promesse est REJETÉE plutôt que résolue en
 * échec : `ok: false` veut dire « cette adresse ne mène à rien », et un
 * serveur muet ne dit pas ça. La liaison est alors vérifiée, et rouverte si
 * elle est morte — ce qui relance la présentation.
 */
export function watchParty(
  slug: string,
): Promise<{ ok: boolean; error?: string; profile?: PublicProfile }> {
  return demander(ack => socket.emit('party:watch', { slug }, ack))
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
  // Un serveur muet devient un refus ordinaire, avec son motif : l'entrée
  // l'affiche sous le bouton, et l'invité sait qu'il peut réessayer.
  return demander<JoinAck>(ack =>
    socket.emit('player:join', { slug, name, avatar, token, teamId }, ack),
  ).catch((e: Error): JoinAck => ({ ok: false, error: e.message }))
}

/**
 * Reprendre sa place avec le code de l'animateur. `token` : l'identité que ce
 * téléphone portait jusque-là, s'il en avait une — le serveur l'efface si
 * elle n'a rien joué. Résout un refus, comme `joinAsPlayer`.
 */
export function reprendrePlace(slug: string, code: string, token?: string): Promise<JoinAck> {
  return demander<JoinAck>(ack => socket.emit('player:reprendre', { slug, code, token }, ack)).catch(
    (e: Error): JoinAck => ({ ok: false, error: e.message }),
  )
}

/**
 * L'invité hors ligne qui porte ce prénom, s'il y en a un. Une panne vaut
 * « personne » : l'avis est une aide, pas un passage obligé.
 */
export function horsLigneDuMemeNom(slug: string, name: string): Promise<AbsentDuMemeNom | undefined> {
  return demander<{ ok: boolean; absent?: AbsentDuMemeNom }>(ack => socket.emit('player:horsLigne', { slug, name }, ack))
    .then(res => (res.ok ? res.absent : undefined))
    .catch(() => undefined)
}

/** La console fait paraître le code qui rend sa place à un invité hors ligne. */
export function rendrePlace(playerId: string): Promise<PlaceRendue> {
  return demander<PlaceRendue>(ack => socket.emit('host:rendrePlace', { playerId }, ack)).catch(
    (e: Error): PlaceRendue => ({ ok: false, error: e.message }),
  )
}

export function setMyTeam(teamId: string | null): Promise<{ ok: boolean; error?: string }> {
  return demander<{ ok: boolean; error?: string }>(ack =>
    socket.emit('player:setTeam', { teamId }, ack),
  ).catch((e: Error) => ({ ok: false, error: e.message }))
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
 * L'accusé d'une réponse, vu du téléphone : un délai dépassé dit en plus si
 * la réponse attend dans la file de socket.io (elle partira au retour du
 * réseau) ou si elle est partie dans le vide (il faut la retoucher).
 */
export type EnvoiAck = ActionAck | { ok: false; reason: 'timeout'; error: string; enFile: boolean }

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
  /**
   * L'accusé qui arrive après le délai. Hors ligne, socket.io garde la
   * réponse et l'envoie à la reconnexion : le serveur la refuse alors, à
   * raison, si la question est finie — mais le téléphone, qui avait déjà
   * conclu « pas partie », ne le disait jamais.
   */
  tardif?: (res: ActionAck) => void,
): Promise<EnvoiAck> {
  const numero = ++derniereReponse
  /**
   * Le premier accusé arrivé après son délai. Sur un réseau lent, celui du
   * premier envoi arrive pendant le renvoi : c'est lui qui fait foi, pas le
   * délai du renvoi — sinon le téléphone lisait « bien arrivée », puis « pas
   * partie », et restait sur « pas partie » d'une réponse enregistrée.
   */
  let dejaRecu: ActionAck | null = null
  /** L'envoi en attente de son accusé : un accusé tardif le libère aussitôt. */
  let enAttente: ((res: ActionAck) => void) | null = null
  /** Ce que la promesse a rendu ; un accusé tardif ne se dit que s'il le contredit. */
  let issue: EnvoiAck | null = null
  let tardifDit = false
  const envoyer = () =>
    new Promise<EnvoiAck>(resolve => {
      // socket.io ne garde une réponse pour la reconnexion que s'il se sait
      // déconnecté. Tant qu'il se croit relié — un wifi sans internet, le
      // passage du wifi à la 4G : jusqu'à dix-huit secondes —, il l'écrit
      // dans un transport mort, et elle est perdue. Seule la première
      // mérite la promesse « elle partira ».
      const enFile = !socket.connected
      let settled = false
      const settle = (res: EnvoiAck) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(res)
      }
      enAttente = settle
      // Sans ce garde-fou, une réponse partie dans le vide laisserait la
      // promesse en suspens pour toujours — donc le joueur sans nouvelle.
      const timer = setTimeout(
        () =>
          settle({
            ok: false,
            reason: 'timeout',
            enFile,
            error: enFile
              ? 'Ta réponse n’est pas encore partie — elle partira dès que le réseau revient'
              : 'Ta réponse n’est pas partie — touche-la à nouveau',
          }),
        ACTION_TIMEOUT_MS,
      )
      socket.emit('player:action', { sessionId, action, slug, token }, (res: ActionAck) => {
        if (settled) {
          dejaRecu ??= res
          enAttente?.(res)
          // Un doublon (l'envoi et son renvoi, livrés ensemble à la
          // reconnexion) ne se dit qu'une fois, et seulement si la promesse
          // avait conclu au délai : sinon, elle a déjà tout dit.
          if (issue && !issue.ok && issue.reason === 'timeout' && !tardifDit && numero === derniereReponse) {
            tardifDit = true
            tardif?.(res)
          }
        }
        settle(res)
      })
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

  return envoyer()
    .then(res => {
      if (res.ok || res.reason !== 'timeout') return res
      if (numero !== derniereReponse || !encoreOuverte()) return res
      return envoyer().then(r => (!r.ok && r.reason === 'timeout' && dejaRecu ? dejaRecu : r))
    })
    .then(res => {
      issue = res
      return res
    })
}

/**
 * L'écran commun se présente. Rien à envoyer : la session de l'animateur est
 * dans le cookie, que le navigateur joint à la poignée de main. En retour,
 * son espace — ou un refus s'il n'est pas connecté.
 *
 * Comme `watchParty`, REJETTE sans réponse dans le délai : `ok: false`
 * ramène au formulaire de connexion, et un serveur muet n'a rien dit de la
 * session.
 */
export function helloHost(): Promise<{ ok: boolean; slug?: string; name?: string; branchee?: true }> {
  return demander(ack => socket.emit('host:hello', {}, ack))
}

// En dev, un hot-reload de ce module créerait une 2e connexion socket branchée
// sur un store neuf → UI figée jusqu'au F5. On force un vrai rechargement.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
