// Le banc d'essai des tests : un vrai serveur sur une base jetable, et de quoi
// lui parler comme le feraient un téléphone, l'écran commun ou la page d'un
// animateur.
//
// Chaque fichier de test démarre le sien. C'est la leçon du smoke : une soirée
// jouée au milieu d'un scénario partagé fausse tout ce qui suit, et le
// symptôme ne désigne jamais la section fautive. Ici, rien n'est partagé —
// `node --test` peut lancer les fichiers en parallèle.
import { io as clientIo, type Socket } from 'socket.io-client'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createQuizServer, type QuizServerOptions } from '../src/server'
import type { QuizQuestionDef } from '../../shared/library'

export type { Socket }

/** L'administrateur du banc : créé au premier démarrage, retrouvé aux suivants. */
export const ADMIN = { login: 'antoine', password: 'banc-pass-1', slug: 'banc', name: 'Antoine' }

type Serveur = Awaited<ReturnType<typeof createQuizServer>>

export interface Banc {
  /** L'adresse du serveur en cours — elle change à chaque redémarrage. */
  url: string
  server: Serveur
  /** Le dossier jetable qui porte les deux bases. */
  dir: string
  /** La base locale, celle que l'hébergeur efface. */
  dbPath: string
  /** La base « permanente » (un fichier `file:` qui tient le rôle de Turso). */
  quizDbUrl: string
  /**
   * Éteint puis rallume le serveur sur les mêmes bases. `disqueEfface` rejoue
   * ce que fait l'offre gratuite de l'hébergeur à chaque réveil : la base
   * locale disparaît, seule la permanente (et son miroir) reste.
   */
  redemarrer(opts?: { disqueEfface?: boolean }): Promise<void>
  /** Éteint le serveur et efface le dossier. À appeler dans un `after()`. */
  close(): Promise<void>
}

export async function demarrer(opts: Partial<QuizServerOptions> = {}): Promise<Banc> {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-banc-'))
  const dbPath = path.join(dir, 'locale.db')
  const quizDbUrl = `file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`
  // Le premier démarrage prend un port libre ; les suivants reprennent le
  // même, pour qu'un téléphone qui se reconnecte tout seul retrouve le serveur.
  let port = 0
  const lancer = () => createQuizServer({ port, dbPath, quizDbUrl, admin: ADMIN, ...opts })
  let server = await lancer()
  port = server.port
  const banc: Banc = {
    url: `http://localhost:${server.port}`,
    server,
    dir,
    dbPath,
    quizDbUrl,
    async redemarrer({ disqueEfface = false } = {}) {
      await server.close()
      // Le serveur referme ses connexions HTTP inactives, mais le client HTTP
      // de Node garde les siennes en réserve et ne l'apprend qu'au tour
      // suivant de sa boucle. Sans ce répit, la première requête après un
      // redémarrage rapide partait sur une connexion morte (« other side
      // closed ») : le même port, un autre serveur.
      await patienter(50)
      if (disqueEfface) {
        for (const suffixe of ['', '-wal', '-shm']) rmSync(`${dbPath}${suffixe}`, { force: true })
      }
      server = await lancer()
      banc.server = server
      banc.url = `http://localhost:${server.port}`
    },
    async close() {
      // Un socket laissé ouvert se reconnecterait sans fin et empêcherait le
      // fichier de test de se terminer : on les ferme tous, même après un échec.
      for (const socket of ouverts) socket.close()
      ouverts.clear()
      await server.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
  return banc
}

// ── Parler au serveur ─────────────────────────────────────────────────────

/** Toutes les connexions ouvertes par le banc, pour les refermer quoi qu'il arrive. */
const ouverts = new Set<Socket>()

/** Le dernier instantané reçu par chaque connexion. */
const derniers = new WeakMap<Socket, { snapshot?: any }>()

/** Une connexion temps réel, avec le cookie qu'un navigateur joindrait à la poignée de main. */
export function connecter(url: string, cookie?: string): Socket {
  const socket = clientIo(url, {
    transports: ['websocket'],
    forceNew: true,
    ...(cookie && { extraHeaders: { Cookie: cookie } }),
  })
  ouverts.add(socket)
  // Le serveur envoie l'instantané juste derrière l'accusé de `host:hello` ou
  // de `party:watch`, souvent dans le même paquet réseau : un écouteur posé
  // après avoir attendu l'accusé arrive trop tard. On retient donc toujours le
  // dernier, dès la connexion.
  const etat: { snapshot?: any } = {}
  derniers.set(socket, etat)
  socket.on('party:snapshot', (s: unknown) => {
    etat.snapshot = s
  })
  return socket
}

/** Le dernier instantané reçu qui satisfait le prédicat — ou le prochain. */
export function instantane<T = any>(
  socket: Socket,
  pred: (s: T) => boolean = () => true,
  label = 'un instantané',
): Promise<T> {
  const deja = derniers.get(socket)?.snapshot
  if (deja && pred(deja)) return Promise.resolve(deja)
  return attendre<T>(socket, 'party:snapshot', pred, label)
}

/** Émet et attend l'accusé. Un accusé qui ne vient pas est une erreur, pas une attente infinie. */
export function emitAck<T = any>(socket: Socket, event: string, payload?: unknown, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`accusé attendu en vain : ${event}`)), timeoutMs)
    ;(socket as any).emit(event, payload, (res: T) => {
      clearTimeout(to)
      resolve(res)
    })
  })
}

/** Attend le premier événement qui satisfait le prédicat. */
export function attendre<T = any>(
  socket: Socket,
  event: string,
  pred: (p: T) => boolean,
  label: string,
  timeoutMs = 8000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => {
      socket.off(event, handler as any)
      reject(new Error(`délai dépassé en attendant : ${label}`))
    }, timeoutMs)
    const handler = (p: T) => {
      if (!pred(p)) return
      clearTimeout(to)
      socket.off(event, handler as any)
      resolve(p)
    }
    socket.on(event, handler as any)
  })
}

/**
 * Une écriture telle que la page la ferait : avec l'en-tête maison qui la
 * distingue d'un formulaire piégé.
 */
export function ecrire(url: string, chemin: string, body: unknown, cookie?: string, method = 'POST') {
  return fetch(`${url}${chemin}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'quizz',
      ...(cookie && { Cookie: cookie }),
    },
    body: JSON.stringify(body),
  })
}

/** Le cookie posé par une réponse, tel que le navigateur le renverrait. `qz_session` : animateur ; `qz_joueur` : profil. */
export function cookieDe(res: Response, nom: 'qz_session' | 'qz_joueur' = 'qz_session'): string {
  const m = new RegExp(`${nom}=([^;]+)`).exec(res.headers.get('set-cookie') ?? '')
  if (!m) throw new Error(`la réponse ne pose pas le cookie ${nom} (${res.status})`)
  return `${nom}=${m[1]}`
}

/** Se connecte comme animateur et rend le cookie de session. */
export async function connexionAnimateur(url: string, login = ADMIN.login, password = ADMIN.password) {
  const res = await ecrire(url, '/api/auth/login', { login, password })
  if (!res.ok) throw new Error(`connexion de ${login} refusée (${res.status})`)
  return cookieDe(res)
}

/** Crée un profil de joueur et rend son cookie. */
export async function inscrireProfil(url: string, login: string, name: string, avatar = '🦊', password = 'motdepasse1') {
  const res = await ecrire(url, '/api/joueur/inscription', { login, password, name, avatar })
  if (res.status !== 201) throw new Error(`inscription du profil ${login} refusée (${res.status})`)
  return cookieDe(res, 'qz_joueur')
}

// ── Préparer une partie ───────────────────────────────────────────────────

/** Une question à choix, jouable telle quelle. */
export function qcm(text: string, answers: string[] = ['Oui', 'Non'], correct = 0, duration = 20): Partial<QuizQuestionDef> {
  return { kind: 'choice', text, answers, correct, duration, image: null }
}

/** Une estimation, jouable telle quelle. */
export function estimation(text: string, target: number, unit = '', duration = 20): Partial<QuizQuestionDef> {
  return { kind: 'number', text, target, unit, duration, image: null, answers: [], correct: 0 }
}

/** Crée un quiz dans l'espace de l'animateur connecté et rend son identifiant. */
export async function creerQuiz(url: string, cookie: string, questions: Partial<QuizQuestionDef>[], title = 'Quiz du banc') {
  const created = await ecrire(url, '/api/quizzes', { title }, cookie)
  if (!created.ok) throw new Error(`création du quiz refusée (${created.status})`)
  const { id } = (await created.json()) as { id: string }
  const saved = await ecrire(url, `/api/quizzes/${id}`, { title, questions }, cookie, 'PUT')
  if (!saved.ok) throw new Error(`enregistrement du quiz refusé (${saved.status})`)
  return id
}

/** L'écran commun, présenté avec la session de l'animateur. */
export async function ecranCommun(url: string, cookie: string): Promise<Socket> {
  const host = connecter(url, cookie)
  const hello = await emitAck<{ ok: boolean }>(host, 'host:hello', {})
  if (!hello.ok) throw new Error('l’écran commun a été refusé')
  return host
}

export interface Invite {
  socket: Socket
  playerId: string
  token: string
}

/**
 * Un invité qui suit la soirée puis la rejoint — anonyme, ou avec le cookie de
 * son profil. Avec `token`, c'est un téléphone qui se re-présente après un
 * redémarrage : il retrouve son invité, et le prénom envoyé ne compte pas.
 */
export async function invite(
  url: string,
  name: string,
  avatar = '🦊',
  opts: { slug?: string; cookie?: string; token?: string } = {},
): Promise<Invite> {
  const slug = opts.slug ?? ADMIN.slug
  const socket = connecter(url, opts.cookie)
  const watched = await emitAck<{ ok: boolean; error?: string }>(socket, 'party:watch', { slug })
  if (!watched.ok) throw new Error(`suivre la soirée ${slug} : ${watched.error}`)
  const res = await emitAck<any>(socket, 'player:join', { slug, name, avatar, ...(opts.token && { token: opts.token }) })
  if (!res.ok) throw new Error(`${name} n’a pas pu rejoindre : ${res.error}`)
  return { socket, playerId: res.playerId, token: res.token }
}

/**
 * Lance un quiz depuis l'écran commun et rend l'identifiant de la partie. La
 * première question arrive trois secondes plus tard (le compte à rebours).
 */
export async function lancerQuiz(host: Socket, packId: string, multiplier = 1): Promise<string> {
  const pick = attendre<any>(host, 'session:view', p => p.view.phase === 'pickPack', 'la liste des quiz')
  ;(host as any).emit('host:launch')
  const sessionId = (await pick).sessionId as string
  ;(host as any).emit('host:command', { sessionId, command: { type: 'selectPack', packId, multiplier } })
  return sessionId
}

/** Laisse passer les diffusions regroupées (instantanés, miroir) avant de lire l'état. */
export const patienter = (ms: number) => new Promise(r => setTimeout(r, ms))
