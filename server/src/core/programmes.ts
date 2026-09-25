import { randomUUID } from 'node:crypto'
import { clientDistant, type Client } from './distante'
import {
  MAX_PROGRAMMES,
  normaliserEntrees,
  titreDeProgramme,
  type EntreeDeProgramme,
  type Programme,
} from '../../../shared/programme'

/**
 * Les programmes de soirée (`shared/programme.ts`) : dans la base
 * permanente, comme la bibliothèque dont ils rangent les quiz — ils servent
 * encore l'an prochain. Chaque programme appartient à un espace, et un
 * identifiant étranger vaut « introuvable » (invariant 3).
 *
 * Les entrées ne sont pas vérifiées ici contre la bibliothèque : un quiz
 * supprimé depuis reste une ligne morte, que la lecture de la console écarte
 * (`avancementDuProgramme`) et que l'éditeur ne montre pas.
 */
export class ProgrammeStore {
  private client: Client

  constructor(url: string, authToken?: string) {
    this.client = clientDistant(url, authToken)
  }

  async init() {
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS programmes (
           id         TEXT PRIMARY KEY,
           space_id   TEXT NOT NULL,
           titre      TEXT NOT NULL,
           entrees    TEXT NOT NULL,
           actif      INTEGER NOT NULL DEFAULT 0,
           created_at INTEGER NOT NULL,
           updated_at INTEGER NOT NULL
         )`,
        'CREATE INDEX IF NOT EXISTS idx_programmes_space ON programmes(space_id)',
      ],
      'write',
    )
  }

  /** Les programmes d'un espace, le plus récemment retouché d'abord. */
  async list(spaceId: string): Promise<Programme[]> {
    const res = await this.client.execute({
      sql: 'SELECT * FROM programmes WHERE space_id = ? ORDER BY updated_at DESC',
      args: [spaceId],
    })
    return res.rows.map(versProgramme)
  }

  async get(spaceId: string, id: string): Promise<Programme | null> {
    const res = await this.client.execute({ sql: 'SELECT * FROM programmes WHERE id = ? AND space_id = ?', args: [id, spaceId] })
    return res.rows[0] ? versProgramme(res.rows[0]) : null
  }

  /** Le programme de ce soir de chaque espace qui en a un — au démarrage, pour la console. */
  async actifs(): Promise<Map<string, Programme>> {
    const res = await this.client.execute('SELECT * FROM programmes WHERE actif = 1')
    return new Map(res.rows.map(r => [String(r.space_id), versProgramme(r)]))
  }

  async actif(spaceId: string): Promise<Programme | null> {
    const res = await this.client.execute({ sql: 'SELECT * FROM programmes WHERE space_id = ? AND actif = 1', args: [spaceId] })
    return res.rows[0] ? versProgramme(res.rows[0]) : null
  }

  /**
   * Un programme neuf, qui devient celui de ce soir : on le commence pour la
   * soirée qui vient. L'ancien reste, rangé, et se reprend d'un geste.
   */
  async creer(spaceId: string, titre: unknown, entrees: unknown): Promise<Programme> {
    const n = await this.client.execute({ sql: 'SELECT COUNT(*) AS n FROM programmes WHERE space_id = ?', args: [spaceId] })
    if (Number(n.rows[0]?.n ?? 0) >= MAX_PROGRAMMES) {
      throw new Error(`Tu as déjà ${MAX_PROGRAMMES} programmes : supprime ceux des soirées passées pour en commencer un`)
    }
    const id = randomUUID()
    const now = Date.now()
    await this.client.batch(
      [
        { sql: 'UPDATE programmes SET actif = 0 WHERE space_id = ?', args: [spaceId] },
        {
          sql: 'INSERT INTO programmes (id, space_id, titre, entrees, actif, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
          args: [id, spaceId, titreDeProgramme(titre), JSON.stringify(normaliserEntrees(entrees)), now, now],
        },
      ],
      'write',
    )
    return (await this.get(spaceId, id))!
  }

  /** Renomme, range, règle : ce qui n'est pas donné ne change pas. Null s'il n'est pas de cet espace. */
  async modifier(spaceId: string, id: string, patch: { titre?: unknown; entrees?: unknown }): Promise<Programme | null> {
    const avant = await this.get(spaceId, id)
    if (!avant) return null
    const titre = patch.titre === undefined ? avant.titre : titreDeProgramme(patch.titre)
    const entrees: EntreeDeProgramme[] = patch.entrees === undefined ? avant.entrees : normaliserEntrees(patch.entrees)
    await this.client.execute({
      sql: 'UPDATE programmes SET titre = ?, entrees = ?, updated_at = ? WHERE id = ? AND space_id = ?',
      args: [titre, JSON.stringify(entrees), Date.now(), id, spaceId],
    })
    return this.get(spaceId, id)
  }

  /** En fait le programme de ce soir — ou plus aucun, avec `actif` à faux. */
  async activer(spaceId: string, id: string, actif: boolean): Promise<boolean> {
    if (!(await this.get(spaceId, id))) return false
    await this.client.batch(
      [
        { sql: 'UPDATE programmes SET actif = 0 WHERE space_id = ?', args: [spaceId] },
        ...(actif ? [{ sql: 'UPDATE programmes SET actif = 1 WHERE id = ? AND space_id = ?', args: [id, spaceId] }] : []),
      ],
      'write',
    )
    return true
  }

  async supprimer(spaceId: string, id: string): Promise<boolean> {
    const res = await this.client.execute({ sql: 'DELETE FROM programmes WHERE id = ? AND space_id = ?', args: [id, spaceId] })
    return res.rowsAffected > 0
  }

  /** Tous les programmes d'un espace dont le compte est supprimé. */
  async removeSpace(spaceId: string): Promise<number> {
    const res = await this.client.execute({ sql: 'DELETE FROM programmes WHERE space_id = ?', args: [spaceId] })
    return res.rowsAffected
  }

  close() {
    this.client.close()
  }
}

function versProgramme(row: Record<string, unknown>): Programme {
  let entrees: unknown = []
  try {
    entrees = JSON.parse(String(row.entrees))
  } catch {
    // Une ligne illisible vaut un programme vide, pas une console en panne.
  }
  return {
    id: String(row.id),
    titre: String(row.titre),
    entrees: normaliserEntrees(entrees),
    actif: Number(row.actif) === 1,
    updatedAt: Number(row.updated_at),
  }
}
