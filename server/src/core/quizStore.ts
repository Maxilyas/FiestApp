import { randomUUID } from 'node:crypto'
import { createClient, type Client } from '@libsql/client'
import {
  MAX_ANSWERS,
  MAX_DURATION,
  MIN_DURATION,
  DEFAULT_DURATION,
  playableQuestions,
  type QuizDef,
  type QuizQuestionDef,
  type QuizSummary,
} from '../../../shared/library'

/** Image trop lourde = base qui gonfle pour rien. Le navigateur compresse avant d'envoyer. */
const MAX_IMAGE_DATAURL = 2_000_000
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_QUESTIONS = 100
/** Délai avant qu'une photo sans quiz soit considérée comme abandonnée. */
const IMAGE_GRACE_MS = 60 * 60 * 1000

/**
 * Bibliothèque de quiz : le seul stockage qui doit survivre à tout (l'état
 * d'une partie, lui, est jetable). Le client libSQL parle aussi bien à un
 * fichier local (`file:...`) qu'à une base Turso hébergée (`libsql://...`) —
 * même code, on ne change qu'une variable d'environnement au déploiement.
 */
export class QuizStore {
  private client: Client

  constructor(url: string, authToken?: string) {
    this.client = createClient({ url, authToken })
  }

  async init() {
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS quizzes (
           id         TEXT PRIMARY KEY,
           title      TEXT NOT NULL,
           questions  TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           updated_at INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS quiz_images (
           id         TEXT PRIMARY KEY,
           mime       TEXT NOT NULL,
           data       TEXT NOT NULL,
           created_at INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS meta (
           key   TEXT PRIMARY KEY,
           value TEXT NOT NULL
         )`,
      ],
      'write',
    )
  }

  // ── Quiz ────────────────────────────────────────────────────────────────

  async list(): Promise<QuizSummary[]> {
    const res = await this.client.execute(
      'SELECT id, title, questions, updated_at FROM quizzes ORDER BY updated_at DESC',
    )
    return res.rows.map(row => {
      const quiz = rowToQuiz(row)
      return {
        id: quiz.id,
        title: quiz.title,
        questionCount: quiz.questions.length,
        readyCount: playableQuestions(quiz).length,
        updatedAt: quiz.updatedAt,
      }
    })
  }

  /** Tous les quiz, questions comprises — alimente le cache du module de jeu. */
  async all(): Promise<QuizDef[]> {
    const res = await this.client.execute('SELECT * FROM quizzes ORDER BY updated_at DESC')
    return res.rows.map(rowToQuiz)
  }

  async get(id: string): Promise<QuizDef | null> {
    const res = await this.client.execute({ sql: 'SELECT * FROM quizzes WHERE id = ?', args: [id] })
    return res.rows[0] ? rowToQuiz(res.rows[0]) : null
  }

  async create(title: unknown, questions: unknown = [], id: string = randomUUID()): Promise<QuizDef> {
    const now = Date.now()
    const quiz: QuizDef = {
      id,
      title: cleanTitle(title),
      questions: normalizeQuestions(questions),
      updatedAt: now,
    }
    await this.client.execute({
      sql: 'INSERT INTO quizzes (id, title, questions, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      args: [quiz.id, quiz.title, JSON.stringify(quiz.questions), now, now],
    })
    return quiz
  }

  async save(id: string, title: unknown, questions: unknown): Promise<QuizDef | null> {
    const now = Date.now()
    const quiz: QuizDef = {
      id,
      title: cleanTitle(title),
      questions: normalizeQuestions(questions),
      updatedAt: now,
    }
    const res = await this.client.execute({
      sql: 'UPDATE quizzes SET title = ?, questions = ?, updated_at = ? WHERE id = ?',
      args: [quiz.title, JSON.stringify(quiz.questions), now, id],
    })
    return res.rowsAffected === 0 ? null : quiz
  }

  async remove(id: string): Promise<boolean> {
    const res = await this.client.execute({ sql: 'DELETE FROM quizzes WHERE id = ?', args: [id] })
    return res.rowsAffected > 0
  }

  async duplicate(id: string): Promise<QuizDef | null> {
    const source = await this.get(id)
    if (!source) return null
    return this.create(`${source.title} (copie)`, source.questions)
  }

  async count(): Promise<number> {
    const res = await this.client.execute('SELECT COUNT(*) AS n FROM quizzes')
    return Number(res.rows[0]?.n ?? 0)
  }

  // ── Images ──────────────────────────────────────────────────────────────

  /** Enregistre une image envoyée en dataURL (déjà compressée côté navigateur). */
  async saveImage(dataUrl: unknown): Promise<string> {
    if (typeof dataUrl !== 'string' || dataUrl.length > MAX_IMAGE_DATAURL) {
      throw new Error('Image trop lourde')
    }
    const match = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
    if (!match || !IMAGE_MIMES.includes(match[1])) throw new Error("Format d'image non supporté")
    const id = randomUUID()
    await this.client.execute({
      sql: 'INSERT INTO quiz_images (id, mime, data, created_at) VALUES (?, ?, ?, ?)',
      args: [id, match[1], match[2], Date.now()],
    })
    return id
  }

  /**
   * Supprime les photos que plus aucun quiz n'utilise.
   *
   * On ne peut pas effacer les photos d'un quiz au moment où on le supprime :
   * dupliquer un quiz recopie les mêmes URL, donc deux quiz peuvent partager
   * une photo. On regarde donc l'ensemble de la bibliothèque avant d'effacer.
   */
  async pruneImages(graceMs = IMAGE_GRACE_MS): Promise<number> {
    // Une photo tout juste envoyée n'est référencée qu'au moment où l'on
    // enregistre la question. Sans ce délai de grâce, un ménage déclenché
    // entre les deux l'effacerait sous les doigts de l'animateur.
    const [stored, quizzes] = await Promise.all([
      this.client.execute({
        sql: 'SELECT id FROM quiz_images WHERE created_at < ?',
        args: [Date.now() - graceMs],
      }),
      this.client.execute('SELECT questions FROM quizzes'),
    ])
    if (stored.rows.length === 0) return 0

    const used = new Set<string>()
    for (const row of quizzes.rows) {
      for (const [, id] of String(row.questions).matchAll(/\/media\/image\/([0-9a-f-]{36})/g)) {
        used.add(id)
      }
    }

    const orphans = stored.rows.map(r => String(r.id)).filter(id => !used.has(id))
    if (orphans.length === 0) return 0
    await this.client.batch(
      orphans.map(id => ({ sql: 'DELETE FROM quiz_images WHERE id = ?', args: [id] })),
      'write',
    )
    return orphans.length
  }

  async getImage(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
    const res = await this.client.execute({
      sql: 'SELECT mime, data FROM quiz_images WHERE id = ?',
      args: [id],
    })
    const row = res.rows[0]
    if (!row) return null
    return { mime: String(row.mime), bytes: Buffer.from(String(row.data), 'base64') }
  }

  // ── Méta ────────────────────────────────────────────────────────────────

  async getFlag(key: string): Promise<string | null> {
    const res = await this.client.execute({ sql: 'SELECT value FROM meta WHERE key = ?', args: [key] })
    return res.rows[0] ? String(res.rows[0].value) : null
  }

  async setFlag(key: string, value: string) {
    await this.client.execute({
      sql: 'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      args: [key, value],
    })
  }

  close() {
    this.client.close()
  }
}

// ── Nettoyage des données venant du navigateur ────────────────────────────

function cleanTitle(title: unknown): string {
  const clean = String(title ?? '').trim().slice(0, 80)
  return clean || 'Quiz sans titre'
}

/**
 * Borne ce qui arrive du navigateur sans rien jeter : un brouillon incomplet
 * reste enregistré tel quel (on ne perd jamais une saisie), c'est `toPlayable`
 * qui décidera au lancement du quiz s'il est jouable.
 */
export function normalizeQuestions(raw: unknown): QuizQuestionDef[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX_QUESTIONS).map((q: any): QuizQuestionDef => {
    const answers: string[] = []
    for (let i = 0; i < MAX_ANSWERS; i++) {
      const a = Array.isArray(q?.answers) ? q.answers[i] : ''
      answers.push(typeof a === 'string' ? a.slice(0, 120) : '')
    }
    const correct = Number(q?.correct)
    const duration = Number(q?.duration)
    const target = Number(q?.target)
    return {
      // Les quiz écrits avant l'arrivée des estimations n'ont pas de `kind`.
      kind: q?.kind === 'number' ? 'number' : 'choice',
      text: typeof q?.text === 'string' ? q.text.slice(0, 300) : '',
      answers,
      target: q?.target === null || q?.target === undefined || !Number.isFinite(target) ? null : target,
      unit: typeof q?.unit === 'string' ? q.unit.slice(0, 12) : '',
      correct: Number.isInteger(correct) && correct >= 0 && correct < MAX_ANSWERS ? correct : 0,
      duration: Number.isFinite(duration)
        ? Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(duration)))
        : DEFAULT_DURATION,
      // Une URL d'image ne peut venir que du serveur (/media/…) : on refuse le reste.
      image: typeof q?.image === 'string' && q.image.startsWith('/media/') ? q.image : null,
    }
  })
}

function rowToQuiz(row: Record<string, unknown>): QuizDef {
  let questions: QuizQuestionDef[] = []
  try {
    questions = normalizeQuestions(JSON.parse(String(row.questions)))
  } catch {
    questions = []
  }
  return {
    id: String(row.id),
    title: String(row.title),
    questions,
    updatedAt: Number(row.updated_at),
  }
}
