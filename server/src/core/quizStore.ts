import { randomUUID } from 'node:crypto'
import { clientDistant, type Client } from './distante'
import {
  MAX_ANSWERS,
  MAX_DURATION,
  MIN_DURATION,
  DEFAULT_DURATION,
  MAX_OBSERVE,
  MIN_OBSERVE,
  newQuestionId,
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
 * Photos gardées en mémoire après lecture. Une photo pèse ~150 Ko et cinquante
 * téléphones la demandent au même instant : sans ce cache, c'est cinquante
 * lectures dans la base distante pour le même contenu, à chaque question.
 */
const IMAGE_CACHE_SIZE = 40
/** Identifiants de question acceptés tels quels — le reste en reçoit un neuf. */
const QUESTION_ID = /^[\w-]{1,48}$/

/**
 * Les photos envoyées depuis l'éditeur qu'un texte cite, par identifiant :
 * les questions d'un quiz, l'état d'une partie, une soirée archivée. On lit
 * le texte brut plutôt que sa structure : un état qu'on ne saurait plus
 * analyser protège encore ses photos.
 */
export function photosCitees(texte: string): string[] {
  return [...texte.matchAll(/\/media\/image\/([0-9a-f-]{36})/g)].map(m => m[1])
}

/**
 * Bibliothèque de quiz : le seul stockage qui doit survivre à tout (l'état
 * d'une partie, lui, est jetable). Le client libSQL parle aussi bien à un
 * fichier local (`file:...`) qu'à une base Turso hébergée (`libsql://...`) —
 * même code, on ne change qu'une variable d'environnement au déploiement.
 *
 * Chaque quiz et chaque photo appartiennent à un espace (un compte) : toute
 * lecture ou écriture d'animateur passe par le sien, et un identifiant
 * étranger vaut « introuvable ».
 */
export class QuizStore {
  private client: Client
  private imageCache = new Map<string, { mime: string; bytes: Buffer }>()

  constructor(url: string, authToken?: string) {
    this.client = clientDistant(url, authToken)
  }

  /**
   * Crée les tables, puis rattache à l'espace par défaut les quiz et les
   * photos d'avant les espaces. Idempotent : rien n'est copié ni effacé.
   */
  async init(defaultSpace: string) {
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS quizzes (
           id         TEXT PRIMARY KEY,
           title      TEXT NOT NULL,
           questions  TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           updated_at INTEGER NOT NULL,
           space_id   TEXT
         )`,
        `CREATE TABLE IF NOT EXISTS quiz_images (
           id         TEXT PRIMARY KEY,
           mime       TEXT NOT NULL,
           data       TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           bytes      BLOB,
           space_id   TEXT
         )`,
        `CREATE TABLE IF NOT EXISTS meta (
           key   TEXT PRIMARY KEY,
           value TEXT NOT NULL
         )`,
      ],
      'write',
    )
    // Les photos étaient stockées en base64 dans `data`, un tiers plus lourd
    // que les octets eux-mêmes. Elles vont désormais dans `bytes` ; les
    // anciennes restent lisibles. Puis les espaces sont arrivés. libsql n'a
    // pas d'« ADD COLUMN IF NOT EXISTS », alors on tente et on ignore le refus.
    for (const alter of [
      'ALTER TABLE quiz_images ADD COLUMN bytes BLOB',
      'ALTER TABLE quizzes ADD COLUMN space_id TEXT',
      'ALTER TABLE quiz_images ADD COLUMN space_id TEXT',
    ]) {
      try {
        await this.client.execute(alter)
      } catch {
        // Colonne déjà là : c'est le cas normal après le premier démarrage.
      }
    }
    await this.client.batch(
      [
        'CREATE INDEX IF NOT EXISTS idx_quizzes_space ON quizzes(space_id)',
        'CREATE INDEX IF NOT EXISTS idx_quiz_images_space ON quiz_images(space_id)',
        { sql: 'UPDATE quizzes SET space_id = ? WHERE space_id IS NULL', args: [defaultSpace] },
        { sql: 'UPDATE quiz_images SET space_id = ? WHERE space_id IS NULL', args: [defaultSpace] },
      ],
      'write',
    )
  }

  // ── Quiz ────────────────────────────────────────────────────────────────

  async list(spaceId: string): Promise<QuizSummary[]> {
    const res = await this.client.execute({
      sql: 'SELECT id, title, questions, updated_at FROM quizzes WHERE space_id = ? ORDER BY updated_at DESC',
      args: [spaceId],
    })
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

  /** Tous les quiz d'un espace, questions comprises — alimente le cache du module de jeu. */
  async all(spaceId: string): Promise<QuizDef[]> {
    const res = await this.client.execute({
      sql: 'SELECT * FROM quizzes WHERE space_id = ? ORDER BY updated_at DESC',
      args: [spaceId],
    })
    return res.rows.map(rowToQuiz)
  }

  /** Toutes les bibliothèques d'un coup, au démarrage : une par espace. */
  async allBySpace(): Promise<Map<string, QuizDef[]>> {
    const res = await this.client.execute('SELECT * FROM quizzes ORDER BY updated_at DESC')
    const bySpace = new Map<string, QuizDef[]>()
    for (const row of res.rows) {
      const spaceId = String(row.space_id ?? '')
      if (!bySpace.has(spaceId)) bySpace.set(spaceId, [])
      bySpace.get(spaceId)!.push(rowToQuiz(row))
    }
    return bySpace
  }

  async get(spaceId: string, id: string): Promise<QuizDef | null> {
    const res = await this.client.execute({
      sql: 'SELECT * FROM quizzes WHERE id = ? AND space_id = ?',
      args: [id, spaceId],
    })
    return res.rows[0] ? rowToQuiz(res.rows[0]) : null
  }

  async create(spaceId: string, title: unknown, questions: unknown = [], id: string = randomUUID()): Promise<QuizDef> {
    const now = Date.now()
    const quiz: QuizDef = {
      id,
      title: cleanTitle(title),
      questions: normalizeQuestions(questions),
      updatedAt: now,
    }
    await this.client.execute({
      sql: 'INSERT INTO quizzes (id, title, questions, created_at, updated_at, space_id) VALUES (?, ?, ?, ?, ?, ?)',
      args: [quiz.id, quiz.title, JSON.stringify(quiz.questions), now, now, spaceId],
    })
    return quiz
  }

  async save(spaceId: string, id: string, title: unknown, questions: unknown): Promise<QuizDef | null> {
    const now = Date.now()
    const quiz: QuizDef = {
      id,
      title: cleanTitle(title),
      questions: normalizeQuestions(questions),
      updatedAt: now,
    }
    const res = await this.client.execute({
      sql: 'UPDATE quizzes SET title = ?, questions = ?, updated_at = ? WHERE id = ? AND space_id = ?',
      args: [quiz.title, JSON.stringify(quiz.questions), now, id, spaceId],
    })
    return res.rowsAffected === 0 ? null : quiz
  }

  async remove(spaceId: string, id: string): Promise<boolean> {
    const res = await this.client.execute({
      sql: 'DELETE FROM quizzes WHERE id = ? AND space_id = ?',
      args: [id, spaceId],
    })
    return res.rowsAffected > 0
  }

  async duplicate(spaceId: string, id: string): Promise<QuizDef | null> {
    const source = await this.get(spaceId, id)
    if (!source) return null
    return this.create(spaceId, `${source.title} (copie)`, source.questions)
  }

  async count(spaceId: string): Promise<number> {
    const res = await this.client.execute({ sql: 'SELECT COUNT(*) AS n FROM quizzes WHERE space_id = ?', args: [spaceId] })
    return Number(res.rows[0]?.n ?? 0)
  }

  // ── Images ──────────────────────────────────────────────────────────────

  /** Enregistre une image envoyée en dataURL (déjà compressée côté navigateur). */
  async saveImage(spaceId: string, dataUrl: unknown): Promise<string> {
    if (typeof dataUrl !== 'string' || dataUrl.length > MAX_IMAGE_DATAURL) {
      throw new Error('Image trop lourde')
    }
    const match = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
    if (!match || !IMAGE_MIMES.includes(match[1])) throw new Error("Format d'image non supporté")
    const id = randomUUID()
    // `data` reste vide : c'est la colonne historique, gardée pour relire les
    // photos d'avant.
    await this.client.execute({
      sql: "INSERT INTO quiz_images (id, mime, data, bytes, created_at, space_id) VALUES (?, ?, '', ?, ?, ?)",
      args: [id, match[1], Buffer.from(match[2], 'base64'), Date.now(), spaceId],
    })
    return id
  }

  /**
   * Efface la bibliothèque entière d'un espace, photos comprises : son
   * compte est supprimé. Les photos sortent aussi du cache — leur adresse
   * est publique, elles resteraient servies sinon.
   */
  async removeSpace(spaceId: string): Promise<{ quizzes: number; images: number }> {
    const images = await this.client.execute({ sql: 'SELECT id FROM quiz_images WHERE space_id = ?', args: [spaceId] })
    const [quizzes] = await this.client.batch(
      [
        { sql: 'DELETE FROM quizzes WHERE space_id = ?', args: [spaceId] },
        { sql: 'DELETE FROM quiz_images WHERE space_id = ?', args: [spaceId] },
      ],
      'write',
    )
    for (const row of images.rows) this.imageCache.delete(String(row.id))
    return { quizzes: quizzes.rowsAffected, images: images.rows.length }
  }

  /**
   * Supprime les photos d'un espace que plus rien n'utilise.
   *
   * On ne peut pas effacer les photos d'un quiz au moment où on le supprime :
   * dupliquer un quiz recopie les mêmes URL, donc deux quiz peuvent partager
   * une photo. Et la bibliothèque n'est pas seule à s'en servir : on ne
   * regardait qu'elle, et supprimer un quiz joué effaçait les photos du bilan
   * de sa soirée archivée ; retoucher pendant la fête le quiz qui se jouait
   * effaçait celle que les téléphones allaient demander. Une photo n'est donc
   * orpheline que si aucun quiz, aucune soirée archivée et aucune partie
   * encore sur le disque local (`enJeu`, fourni par l'appelant) ne la cite.
   */
  async pruneImages(spaceId: string, graceMs = IMAGE_GRACE_MS, enJeu: Iterable<string> = []): Promise<number> {
    // Une photo tout juste envoyée n'est référencée qu'au moment où l'on
    // enregistre la question. Sans ce délai de grâce, un ménage déclenché
    // entre les deux l'effacerait sous les doigts de l'animateur.
    const stored = await this.client.execute({
      sql: 'SELECT id FROM quiz_images WHERE space_id = ? AND created_at < ?',
      args: [spaceId, Date.now() - graceMs],
    })
    if (stored.rows.length === 0) return 0
    const orphans = new Set(stored.rows.map(r => String(r.id)))

    const quizzes = await this.client.execute({ sql: 'SELECT questions FROM quizzes WHERE space_id = ?', args: [spaceId] })
    for (const row of quizzes.rows) for (const id of photosCitees(String(row.questions))) orphans.delete(id)
    for (const id of enJeu) orphans.delete(id)
    // Le cas courant — une question retouchée, pas une photo retirée — s'arrête
    // ici, sans avoir lu l'historique.
    if (orphans.size === 0) return 0

    // L'historique, ensuite. On ne lit que les soirées qui citent une photo,
    // une à une : celui d'un espace pèse vite plusieurs mégaoctets, et on
    // s'arrête dès que tout est justifié. Une lecture qui échoue fait échouer
    // le ménage entier — dans le doute, on n'efface rien.
    const archives = await this.client.execute({
      sql: "SELECT id FROM soirees WHERE space_id = ? AND data LIKE '%/media/image/%'",
      args: [spaceId],
    })
    for (const row of archives.rows) {
      if (orphans.size === 0) return 0
      const archive = await this.client.execute({
        sql: 'SELECT data FROM soirees WHERE space_id = ? AND id = ?',
        args: [spaceId, row.id],
      })
      for (const id of photosCitees(String(archive.rows[0]?.data ?? ''))) orphans.delete(id)
    }
    if (orphans.size === 0) return 0

    await this.client.batch(
      [...orphans].map(id => ({ sql: 'DELETE FROM quiz_images WHERE id = ? AND space_id = ?', args: [id, spaceId] })),
      'write',
    )
    for (const id of orphans) this.imageCache.delete(id)
    return orphans.size
  }

  async getImage(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
    const cached = this.imageCache.get(id)
    if (cached) return cached
    const res = await this.client.execute({
      sql: 'SELECT mime, data, bytes FROM quiz_images WHERE id = ?',
      args: [id],
    })
    const row = res.rows[0]
    if (!row) return null
    const raw = row.bytes as unknown
    const bytes =
      raw instanceof ArrayBuffer
        ? Buffer.from(raw)
        : raw instanceof Uint8Array
          ? Buffer.from(raw)
          : Buffer.from(String(row.data), 'base64')
    const image = { mime: String(row.mime), bytes }
    // Une photo ne change jamais : le cache n'a pas à se soucier de fraîcheur,
    // seulement de taille — la plus ancienne sort quand il est plein.
    if (this.imageCache.size >= IMAGE_CACHE_SIZE) {
      const oldest = this.imageCache.keys().next().value
      if (oldest !== undefined) this.imageCache.delete(oldest)
    }
    this.imageCache.set(id, image)
    return image
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
    const observe = Number(q?.observeSeconds)
    return {
      // L'éditeur s'appuie sur cet identifiant pour suivre chaque carte ; les
      // quiz écrits avant en reçoivent un ici, une fois pour toutes.
      id: typeof q?.id === 'string' && QUESTION_ID.test(q.id) ? q.id : newQuestionId(),
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
      // Absent des quiz écrits avant la photo « mémoire » : elle reste alors
      // affichée. Comme pour `target`, le null explicite doit être testé avant
      // la conversion — `Number(null)` vaut 0, pas NaN.
      observeSeconds:
        q?.observeSeconds === null || q?.observeSeconds === undefined || !Number.isFinite(observe)
          ? null
          : Math.min(MAX_OBSERVE, Math.max(MIN_OBSERVE, Math.round(observe))),
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
