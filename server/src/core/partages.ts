import { randomInt, randomUUID } from 'node:crypto'
import { clientDistant, type Client } from './distante'
import { photosCitees } from './quizStore'
import { tronquer } from '../../../shared/avatars'
import { normalizeQuestions, type QuizQuestionDef } from '../../../shared/library'
import { normaliserReglages, type ReglagesDuQuiz } from '../../../shared/hasard'
import { ALPHABET_DU_CODE, LONGUEUR_DU_CODE, type EntreeDuCatalogue, type StatutAuCatalogue } from '../../../shared/partage'

/**
 * Partager un quiz (rapport du 25 septembre 2026, lot 6) — toujours par une
 * copie, jamais par un quiz « public ».
 *
 * À quelqu'un, sur ce serveur : un code court, valable sept jours et
 * révocable. Le propriétaire ouvre la porte ; le destinataire reçoit une
 * copie et n'apprend rien d'autre (invariant 3). À tous : une copie proposée
 * au catalogue, que l'administrateur publie ou refuse. Un quiz vivant
 * partagé bougerait sous les pieds des autres ; public, il livrerait ses
 * réponses aux invités qui animent aussi, et les prénoms qu'on écrit pour
 * une fête.
 *
 * Chaque copie est un instantané, pris au moment du geste : le quiz peut
 * être retouché ou supprimé ensuite sans rien changer à ce qui a été
 * partagé. Ses photos restent celles de l'espace qui partage, protégées du
 * ménage tant que le partage vit (`photosProtegees`) ; le destinataire en
 * reçoit une copie à lui.
 */

/** Un quiz tel qu'on le partage : son titre, ses questions, ses réglages. */
export interface Instantane {
  titre: string
  questions: QuizQuestionDef[]
  reglages: ReglagesDuQuiz
}

/** Sept jours : le temps d'envoyer le code et qu'on s'en serve, pas de quoi traîner. */
export const DUREE_DU_PARTAGE_MS = 7 * 24 * 3600 * 1000
/** Assez pour partager un quiz à toute une bande, pas de quoi remplir la base. */
export const MAX_PARTAGES_ACTIFS = 30

function lireInstantane(texte: unknown): Instantane | null {
  try {
    const brut = JSON.parse(String(texte)) as Partial<Instantane>
    if (!brut || typeof brut.titre !== 'string') return null
    return { titre: brut.titre, questions: normalizeQuestions(brut.questions), reglages: normaliserReglages(brut.reglages) }
  } catch {
    return null
  }
}

/** « K7X2QF » tiré au hasard, sans les caractères qu'on confond (0 et O, 1, I et L). */
function tirerCode(): string {
  return Array.from({ length: LONGUEUR_DU_CODE }, () => ALPHABET_DU_CODE[randomInt(ALPHABET_DU_CODE.length)]).join('')
}

export class PartageStore {
  private client: Client

  constructor(url: string, authToken?: string) {
    this.client = clientDistant(url, authToken)
  }

  async init() {
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS partages (
           code       TEXT PRIMARY KEY,
           space_id   TEXT NOT NULL,
           quiz_id    TEXT NOT NULL,
           snapshot   TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           expires_at INTEGER NOT NULL,
           revoked_at INTEGER,
           recus      INTEGER NOT NULL DEFAULT 0
         )`,
        'CREATE INDEX IF NOT EXISTS idx_partages_space ON partages(space_id)',
        `CREATE TABLE IF NOT EXISTS catalogue (
           id          TEXT PRIMARY KEY,
           space_id    TEXT NOT NULL,
           quiz_id     TEXT NOT NULL,
           auteur      TEXT NOT NULL,
           titre       TEXT NOT NULL,
           description TEXT NOT NULL,
           questions   INTEGER NOT NULL,
           snapshot    TEXT NOT NULL,
           statut      TEXT NOT NULL,
           created_at  INTEGER NOT NULL,
           updated_at  INTEGER NOT NULL
         )`,
        'CREATE INDEX IF NOT EXISTS idx_catalogue_statut ON catalogue(statut)',
      ],
      'write',
    )
  }

  // ── Les codes de partage ─────────────────────────────────────────────

  /** Un code neuf pour ce quiz, sur l'instantané donné. */
  async partager(spaceId: string, quizId: string, instantane: Instantane): Promise<{ code: string; expiresAt: number }> {
    const now = Date.now()
    const actifs = await this.client.execute({
      sql: 'SELECT COUNT(*) AS n FROM partages WHERE space_id = ? AND revoked_at IS NULL AND expires_at > ?',
      args: [spaceId, now],
    })
    if (Number(actifs.rows[0]?.n ?? 0) >= MAX_PARTAGES_ACTIFS) {
      throw new Error(`Tu as déjà ${MAX_PARTAGES_ACTIFS} codes de partage en cours : annule ceux qui ne servent plus`)
    }
    const expiresAt = now + DUREE_DU_PARTAGE_MS
    // Un code déjà pris — une chance sur des centaines de millions — se retire.
    for (let essai = 0; essai < 5; essai++) {
      const code = tirerCode()
      try {
        await this.client.execute({
          sql: 'INSERT INTO partages (code, space_id, quiz_id, snapshot, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
          args: [code, spaceId, quizId, JSON.stringify(instantane), now, expiresAt],
        })
        return { code, expiresAt }
      } catch (e) {
        if (!/UNIQUE|PRIMARY/i.test(String((e as Error).message))) throw e
      }
    }
    throw new Error('Aucun code libre : réessaie')
  }

  /** Les codes encore valables d'un quiz, pour les annuler. */
  async partagesDuQuiz(spaceId: string, quizId: string): Promise<{ code: string; expiresAt: number; recus: number }[]> {
    const res = await this.client.execute({
      sql: `SELECT code, expires_at, recus FROM partages
            WHERE space_id = ? AND quiz_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC`,
      args: [spaceId, quizId, Date.now()],
    })
    return res.rows.map(r => ({ code: String(r.code), expiresAt: Number(r.expires_at), recus: Number(r.recus) }))
  }

  /** Annule un code de cet espace. Faux s'il n'est pas le sien — ou n'existe pas. */
  async revoquer(spaceId: string, code: string): Promise<boolean> {
    const res = await this.client.execute({
      sql: 'UPDATE partages SET revoked_at = ? WHERE code = ? AND space_id = ? AND revoked_at IS NULL',
      args: [Date.now(), code, spaceId],
    })
    return res.rowsAffected > 0
  }

  /**
   * Ce qu'un code donne à recevoir : l'instantané, « perime » s'il a expiré
   * ou a été annulé, null s'il n'existe pas. Chaque réception se compte.
   */
  async recevoir(code: string): Promise<Instantane | 'perime' | null> {
    const res = await this.client.execute({ sql: 'SELECT * FROM partages WHERE code = ?', args: [code] })
    const r = res.rows[0]
    if (!r) return null
    if (r.revoked_at !== null || Number(r.expires_at) <= Date.now()) return 'perime'
    const instantane = lireInstantane(r.snapshot)
    if (!instantane) return null
    await this.client.execute({ sql: 'UPDATE partages SET recus = recus + 1 WHERE code = ?', args: [code] })
    return instantane
  }

  // ── Le catalogue ─────────────────────────────────────────────────────

  /**
   * Propose une copie au catalogue. Une proposition encore en attente pour ce
   * quiz est remplacée — on la corrige avant qu'elle soit lue — ; une copie
   * déjà publiée reste en ligne jusqu'à ce que l'administrateur publie la
   * nouvelle.
   */
  async proposer(spaceId: string, quizId: string, auteur: string, description: unknown, instantane: Instantane): Promise<EntreeDuCatalogue> {
    const texte = typeof description === 'string' ? tronquer(description.trim().replace(/\s+/g, ' '), 200).trim() : ''
    if (!texte) throw new Error('Écris une phrase pour dire à quoi sert ce quiz')
    const now = Date.now()
    const enAttente = await this.client.execute({
      sql: "SELECT id FROM catalogue WHERE space_id = ? AND quiz_id = ? AND statut = 'propose'",
      args: [spaceId, quizId],
    })
    const id = enAttente.rows[0] ? String(enAttente.rows[0].id) : randomUUID()
    await this.client.execute({
      sql: `INSERT INTO catalogue (id, space_id, quiz_id, auteur, titre, description, questions, snapshot, statut, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'propose', ?, ?)
            ON CONFLICT(id) DO UPDATE SET auteur = excluded.auteur, titre = excluded.titre, description = excluded.description,
              questions = excluded.questions, snapshot = excluded.snapshot, updated_at = excluded.updated_at`,
      args: [id, spaceId, quizId, auteur, instantane.titre, texte, instantane.questions.length, JSON.stringify(instantane), now, now],
    })
    return (await this.entree(id))!.entree
  }

  /** Les entrées du catalogue — toutes, ou d'un statut —, sans leurs questions. */
  async catalogue(statut?: StatutAuCatalogue): Promise<EntreeDuCatalogue[]> {
    const res = await this.client.execute(
      statut
        ? { sql: 'SELECT * FROM catalogue WHERE statut = ? ORDER BY updated_at DESC', args: [statut] }
        : 'SELECT * FROM catalogue ORDER BY updated_at DESC',
    )
    return res.rows.map(versEntree)
  }

  async entree(id: string): Promise<{ entree: EntreeDuCatalogue; instantane: Instantane } | null> {
    const res = await this.client.execute({ sql: 'SELECT * FROM catalogue WHERE id = ?', args: [id] })
    const r = res.rows[0]
    const instantane = r ? lireInstantane(r.snapshot) : null
    return r && instantane ? { entree: versEntree(r), instantane } : null
  }

  async changerStatut(id: string, statut: StatutAuCatalogue): Promise<boolean> {
    const res = await this.client.execute({
      sql: 'UPDATE catalogue SET statut = ?, updated_at = ? WHERE id = ?',
      args: [statut, Date.now(), id],
    })
    return res.rowsAffected > 0
  }

  // ── Le ménage ────────────────────────────────────────────────────────

  /**
   * Les photos de l'espace qu'un partage encore vivant cite — un code
   * valable, une copie proposée ou publiée : le ménage des photos ne doit
   * pas les effacer, le destinataire les recopiera à la réception.
   */
  async photosProtegees(spaceId: string): Promise<string[]> {
    const [partages, catalogue] = await this.client.batch(
      [
        {
          sql: 'SELECT snapshot FROM partages WHERE space_id = ? AND revoked_at IS NULL AND expires_at > ?',
          args: [spaceId, Date.now()],
        },
        { sql: "SELECT snapshot FROM catalogue WHERE space_id = ? AND statut IN ('propose', 'publie')", args: [spaceId] },
      ],
      'read',
    )
    return [...partages.rows, ...catalogue.rows].flatMap(r => photosCitees(String(r.snapshot)))
  }

  /** Tout ce qu'un espace a partagé : son compte est supprimé, ses copies publiées avec. */
  async removeSpace(spaceId: string): Promise<void> {
    await this.client.batch(
      [
        { sql: 'DELETE FROM partages WHERE space_id = ?', args: [spaceId] },
        { sql: 'DELETE FROM catalogue WHERE space_id = ?', args: [spaceId] },
      ],
      'write',
    )
  }

  close() {
    this.client.close()
  }
}

function versEntree(r: Record<string, unknown>): EntreeDuCatalogue {
  return {
    id: String(r.id),
    titre: String(r.titre),
    description: String(r.description),
    auteur: String(r.auteur),
    questionCount: Number(r.questions),
    statut: String(r.statut) as StatutAuCatalogue,
    updatedAt: Number(r.updated_at),
  }
}
