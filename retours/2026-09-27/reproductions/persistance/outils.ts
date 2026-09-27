// Les outils des épreuves de persistance : parler à un serveur comme un
// téléphone, un écran commun ou une page d'animateur — sans importer une
// ligne de code serveur, pour qu'une même épreuve pilote le code d'avant
// (a6fc98b, la copie de travail `avant/`) et celui d'aujourd'hui.
//
// Recopiés de `server/test/banc.ts` (identique dans les deux versions).
import { io as clientIo, type Socket } from 'socket.io-client'
import Database from 'better-sqlite3'

export type { Socket }

export const ADMIN = { login: 'antoine', password: 'banc-pass-1', slug: 'banc', name: 'Antoine' }

const ouverts = new Set<Socket>()
const derniers = new WeakMap<Socket, { snapshot?: any }>()

export function connecter(url: string, cookie?: string): Socket {
  const socket = clientIo(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    ...(cookie && { extraHeaders: { Cookie: cookie } }),
  })
  ouverts.add(socket)
  const etat: { snapshot?: any } = {}
  derniers.set(socket, etat)
  socket.on('party:snapshot', (s: unknown) => {
    etat.snapshot = s
  })
  return socket
}

export function fermerTout() {
  for (const s of ouverts) s.close()
  ouverts.clear()
}

export function emitAck<T = any>(socket: Socket, event: string, payload?: unknown, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`accusé attendu en vain : ${event}`)), timeoutMs)
    ;(socket as any).emit(event, payload, (res: T) => {
      clearTimeout(to)
      resolve(res)
    })
  })
}

export function attendre<T = any>(socket: Socket, event: string, pred: (p: T) => boolean, label: string, timeoutMs = 15000): Promise<T> {
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

export function ecrire(url: string, chemin: string, body: unknown, cookie?: string, method = 'POST') {
  return fetch(`${url}${chemin}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', ...(cookie && { Cookie: cookie }) },
    body: JSON.stringify(body),
  })
}

export async function lireJson(url: string, chemin: string, cookie?: string): Promise<{ status: number; corps: any }> {
  const r = await fetch(`${url}${chemin}`, { headers: cookie ? { Cookie: cookie } : {} })
  const texte = await r.text()
  let corps: any = texte
  try {
    corps = JSON.parse(texte)
  } catch {}
  return { status: r.status, corps }
}

export function cookieDe(res: Response, nom: 'qz_session' | 'qz_joueur' = 'qz_session'): string {
  const m = new RegExp(`${nom}=([^;]+)`).exec(res.headers.get('set-cookie') ?? '')
  if (!m) throw new Error(`la réponse ne pose pas le cookie ${nom} (${res.status})`)
  return `${nom}=${m[1]}`
}

export async function connexionAnimateur(url: string, login = ADMIN.login, password = ADMIN.password) {
  const res = await ecrire(url, '/api/auth/login', { login, password })
  if (!res.ok) throw new Error(`connexion de ${login} refusée (${res.status})`)
  return cookieDe(res)
}

export async function inscrireProfil(url: string, login: string, name: string, avatar = '🦊', password = 'motdepasse1') {
  const res = await ecrire(url, '/api/joueur/inscription', { login, password, name, avatar })
  if (res.status !== 201) throw new Error(`inscription du profil ${login} refusée (${res.status}) ${await res.text()}`)
  return cookieDe(res, 'qz_joueur')
}

export function qcm(text: string, answers: string[] = ['Oui', 'Non'], correct = 0, duration = 20) {
  return { kind: 'choice', text, answers, correct, duration, image: null }
}

export async function creerQuiz(url: string, cookie: string, questions: unknown[], title = 'Quiz du banc') {
  const created = await ecrire(url, '/api/quizzes', { title }, cookie)
  if (!created.ok) throw new Error(`création du quiz refusée (${created.status})`)
  const { id } = (await created.json()) as { id: string }
  const saved = await ecrire(url, `/api/quizzes/${id}`, { title, questions }, cookie, 'PUT')
  if (!saved.ok) throw new Error(`enregistrement du quiz refusé (${saved.status})`)
  return id
}

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
  nom: string
}

export async function invite(url: string, name: string, avatar = '🦊', opts: { slug?: string; cookie?: string; token?: string } = {}): Promise<Invite> {
  const slug = opts.slug ?? ADMIN.slug
  const socket = connecter(url, opts.cookie)
  const watched = await emitAck<{ ok: boolean; error?: string }>(socket, 'party:watch', { slug })
  if (!watched.ok) throw new Error(`suivre la soirée ${slug} : ${watched.error}`)
  const res = await emitAck<any>(socket, 'player:join', { slug, name, avatar, ...(opts.token && { token: opts.token }) })
  if (!res.ok) throw new Error(`${name} n’a pas pu rejoindre : ${res.error}`)
  return { socket, playerId: res.playerId, token: res.token, nom: name }
}

export async function lancerQuiz(host: Socket, packId: string, multiplier = 1): Promise<string> {
  const pick = attendre<any>(host, 'session:view', p => p.view.phase === 'pickPack', 'la liste des quiz')
  ;(host as any).emit('host:launch')
  const sessionId = (await pick).sessionId as string
  ;(host as any).emit('host:command', { sessionId, command: { type: 'selectPack', packId, multiplier } })
  return sessionId
}

export const patienter = (ms: number) => new Promise(r => setTimeout(r, ms))

export type Reponses = [Invite, number][][]

/**
 * Joue `questions.length` questions d'un quiz lancé : chaque invité répond, puis
 * « Suivant ». Rend l'identifiant de la partie. `jusqua` : s'arrête APRÈS avoir
 * répondu à la question d'indice `jusqua`, sans la révéler (partie laissée en cours).
 */
export async function jouerQuiz(
  host: Socket,
  quizId: string,
  questions: Reponses,
  opts: { jusqua?: number; terminer?: boolean } = {},
): Promise<string> {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 20_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    revelee.catch(() => {})
    for (const [qui, choice] of questions[q]) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
      if (!ack.ok) throw new Error(`réponse ${q + 1} de ${qui.nom} refusée : ${ack.error}`)
    }
    if (opts.jusqua === q) return sessionId
    await revelee
    suivante =
      q + 1 < questions.length
        ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `la question ${q + 2}`)
        : vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  if (opts.terminer !== false) (host as any).emit('host:endSession', { sessionId })
  return sessionId
}

/** « Clore la soirée », et le toast qui dit si c'est fait. */
export async function clore(host: Socket, titre = 'Une soirée') {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 30_000)
  ;(host as any).emit('host:closeParty', { title: titre })
  return toast
}

// ── Lire une base comme on irait vérifier à la main ──────────────────────

export function lire<T = any>(chemin: string, sql: string, ...args: unknown[]): T[] {
  const db = new Database(chemin, { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}

export function ecrireEnBase(chemin: string, fn: (db: Database.Database) => void) {
  const db = new Database(chemin, { fileMustExist: true })
  try {
    fn(db)
  } finally {
    db.close()
  }
}

/** Toutes les tables d'une base sqlite (hors tables internes), avec leur nombre de lignes. */
export function comptes(chemin: string): Record<string, number> {
  const db = new Database(chemin, { readonly: true, fileMustExist: true })
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[]
    return Object.fromEntries(tables.map(t => [t.name, (db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get() as { n: number }).n]))
  } finally {
    db.close()
  }
}
