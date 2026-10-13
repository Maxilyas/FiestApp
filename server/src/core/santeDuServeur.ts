import { randomUUID } from 'node:crypto'
import type { InStatement, Row } from '@libsql/client'
import { clientDistant, type Client } from './distante'
import { releve as releveDuProcessus, type ReleveHoraire } from './pouls'
import {
  ARRET_RECENT_MS,
  HEURE_MS,
  HEURES_DE_SANTE,
  RELEVE_MS,
  SANTE_GARDEE_MS,
  SILENCE_D_UN_ARRET_MS,
  alertesDuServeur,
  debutDeLHeure,
  pageDuServeur,
  type AlertesDuServeur,
  type DemarrageDuServeur,
  type HeureDeSante,
  type PageDuServeur,
} from '../../../shared/santeDuServeur'

/** La page se relit au plus une fois la minute : un rechargement ne coûte rien au quota. */
const PAGE_GARDEE_MS = 60_000
/** Les démarrages des alertes se relisent au plus toutes les dix minutes : la vue d'ensemble les demande toutes les cinq. */
const DEMARRAGES_GARDES_MS = 10 * 60_000

const nombreOuNull = (v: unknown) => (v === null || v === undefined ? null : Number(v))

function lireDemarrage(r: Row): DemarrageDuServeur {
  return {
    id: String(r.id),
    demarreLe: Number(r.demarre_le),
    pretEnMs: nombreOuNull(r.pret_en_ms),
    version: r.version === null ? null : String(r.version),
    env: r.env === null ? null : String(r.env),
    vuLe: Number(r.vu_le),
    arreteLe: nombreOuNull(r.arrete_le),
  }
}

/** Une ligne de `qg_sante` ; null si son relevé ne se lit plus — une ligne illisible ôte son heure, pas la page. */
function lireHeure(r: Row): HeureDeSante | null {
  try {
    const releve = JSON.parse(String(r.releve)) as Partial<HeureDeSante>
    return {
      heure: Number(r.heure),
      demarrage: String(r.demarrage),
      base: releve.base ?? null,
      routes: releve.routes ?? null,
      lentes: Array.isArray(releve.lentes) ? releve.lentes : [],
      erreurs: releve.erreurs && typeof releve.erreurs === 'object' ? releve.erreurs : {},
      miroir: Number(releve.miroir ?? 0),
      charge: releve.charge ?? null,
    }
  } catch {
    return null
  }
}

/**
 * La santé du serveur dans la base permanente (les choix du 13 octobre 2026) :
 * une ligne par heure et par démarrage (`qg_sante`), réécrite toutes les dix
 * minutes depuis le relevé de l'heure (`pouls.ts`), et une ligne par
 * démarrage (`qg_demarrages`) — quand, prêt en combien, quelle version, son
 * dernier signe, son extinction propre. Un démarrage sans extinction et sans
 * signe s'est arrêté net : c'est la seule façon de le savoir, la mémoire part
 * avec lui. Huit jours gardés, la page en montre sept.
 *
 * Rien ici ne fait attendre une réponse ni tomber le serveur : les écritures
 * partent l'une après l'autre (`file`), après coup, et un échec se dit au
 * journal du serveur.
 */
export class SanteDuServeur {
  private client: Client
  /** Ce démarrage : son identifiant, tiré au lancement. */
  readonly id = randomUUID()
  private moi: DemarrageDuServeur | null = null
  private minuterie: ReturnType<typeof setInterval> | null = null
  private file: Promise<void> = Promise.resolve()
  private purgeeLe = 0
  private lue: { le: number; lecture: Promise<{ heures: HeureDeSante[]; demarrages: DemarrageDuServeur[] }> } | null = null
  private recents: { le: number; lecture: Promise<DemarrageDuServeur[]> } | null = null
  private readonly releve: ReleveHoraire
  private readonly now: () => number
  private readonly releveMs: number

  constructor(
    url: string,
    authToken?: string,
    deps: { maintenant?: () => number; releve?: ReleveHoraire; releveMs?: number } = {},
  ) {
    this.client = clientDistant(url, authToken)
    this.releve = deps.releve ?? releveDuProcessus
    this.now = deps.maintenant ?? Date.now
    this.releveMs = deps.releveMs ?? RELEVE_MS
  }

  async init() {
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS qg_sante (
           heure     INTEGER NOT NULL,
           demarrage TEXT NOT NULL,
           releve    TEXT NOT NULL,
           maj_le    INTEGER NOT NULL,
           PRIMARY KEY (heure, demarrage)
         )`,
        `CREATE TABLE IF NOT EXISTS qg_demarrages (
           id         TEXT PRIMARY KEY,
           demarre_le INTEGER NOT NULL,
           pret_en_ms INTEGER,
           version    TEXT,
           env        TEXT,
           vu_le      INTEGER NOT NULL,
           arrete_le  INTEGER
         )`,
        'CREATE INDEX IF NOT EXISTS idx_qg_demarrages_le ON qg_demarrages(demarre_le)',
        'CREATE INDEX IF NOT EXISTS idx_qg_demarrages_vu ON qg_demarrages(vu_le)',
      ],
      'write',
    )
  }

  /** Le démarrage qui répond, tel que la page le montre ; null avant qu'il soit prêt. */
  courant(): DemarrageDuServeur | null {
    return this.moi && { ...this.moi }
  }

  /**
   * Le serveur est prêt : son démarrage s'écrit, et le relevé part toutes les
   * dix minutes. Après l'ouverture du port, jamais avant : un réveil
   * n'attend pas un aller-retour de plus.
   */
  demarrer(d: { demarreLe: number; pretEnMs: number; version: string | null; env: string | null }) {
    const maintenant = this.now()
    this.moi = { id: this.id, demarreLe: d.demarreLe, pretEnMs: d.pretEnMs, version: d.version, env: d.env, vuLe: maintenant, arreteLe: null }
    void this.ecrire([
      {
        sql: 'INSERT INTO qg_demarrages (id, demarre_le, pret_en_ms, version, env, vu_le, arrete_le) VALUES (?, ?, ?, ?, ?, ?, NULL)',
        args: [this.id, d.demarreLe, d.pretEnMs, d.version, d.env, maintenant],
      },
      ...this.purger(maintenant),
    ])
    this.minuterie = setInterval(() => void this.relever(), this.releveMs)
    this.minuterie.unref()
  }

  /** Ce qui a vieilli de plus de huit jours s'en va — au plus une fois l'heure. */
  private purger(maintenant: number): InStatement[] {
    if (maintenant - this.purgeeLe < HEURE_MS) return []
    this.purgeeLe = maintenant
    const limite = maintenant - SANTE_GARDEE_MS
    return [
      { sql: 'DELETE FROM qg_sante WHERE heure < ?', args: [limite] },
      { sql: 'DELETE FROM qg_demarrages WHERE vu_le < ?', args: [limite] },
    ]
  }

  private lignesAEcrire(maintenant: number): InStatement[] {
    return this.releve.lignes(this.id).map(l => {
      const { heure, demarrage, ...reste } = l
      return {
        sql: `INSERT INTO qg_sante (heure, demarrage, releve, maj_le) VALUES (?, ?, ?, ?)
              ON CONFLICT (heure, demarrage) DO UPDATE SET releve = excluded.releve, maj_le = excluded.maj_le`,
        args: [heure, demarrage, JSON.stringify(reste), maintenant],
      }
    })
  }

  /** Le relevé de l'heure — et de celle d'avant, si elle reste —, et le signe de vie, d'un seul lot. */
  relever(): Promise<void> {
    if (!this.moi) return this.file
    const maintenant = this.now()
    this.moi.vuLe = maintenant
    return this.ecrire([
      ...this.lignesAEcrire(maintenant),
      { sql: 'UPDATE qg_demarrages SET vu_le = ? WHERE id = ?', args: [maintenant, this.id] },
      ...this.purger(maintenant),
    ])
  }

  /**
   * L'extinction propre — la veille de l'hébergeur, une mise en ligne : le
   * dernier relevé, et l'heure de l'arrêt. Sans elle, ce démarrage passerait
   * pour arrêté net.
   */
  async arreter(): Promise<void> {
    if (this.minuterie) clearInterval(this.minuterie)
    this.minuterie = null
    if (this.moi && this.moi.arreteLe === null) {
      const maintenant = this.now()
      this.moi.vuLe = maintenant
      this.moi.arreteLe = maintenant
      await this.ecrire([
        ...this.lignesAEcrire(maintenant),
        { sql: 'UPDATE qg_demarrages SET vu_le = ?, arrete_le = ? WHERE id = ?', args: [maintenant, maintenant, this.id] },
      ])
    }
    await this.file
    this.client.close()
  }

  private ecrire(instructions: InStatement[]): Promise<void> {
    this.file = this.file
      .then(() => this.client.batch(instructions, 'write'))
      .then(
        () => {},
        e => console.error('[santé] le relevé du serveur n’a pas pu s’écrire :', e),
      )
    return this.file
  }

  /** Sept jours de relevés et les démarrages de la semaine, plus le dernier d'avant : la sorte du premier se lit dans lui. */
  private async lire(maintenant: number) {
    const debut = debutDeLHeure(maintenant) - (HEURES_DE_SANTE - 1) * HEURE_MS
    const [heures, demarrages, avant] = await this.client.batch(
      [
        { sql: 'SELECT heure, demarrage, releve FROM qg_sante WHERE heure >= ?', args: [debut] },
        { sql: 'SELECT * FROM qg_demarrages WHERE demarre_le >= ? ORDER BY demarre_le', args: [debut] },
        { sql: 'SELECT * FROM qg_demarrages WHERE demarre_le < ? ORDER BY demarre_le DESC LIMIT 1', args: [debut] },
      ],
      'read',
    )
    return {
      heures: heures.rows.map(lireHeure).filter((h): h is HeureDeSante => h !== null),
      demarrages: [...avant.rows, ...demarrages.rows].map(lireDemarrage),
    }
  }

  /**
   * La page « Le serveur » : la base relue au plus une fois la minute, et
   * les heures de ce démarrage lues dans le relevé, plus frais que la base.
   */
  async page(): Promise<PageDuServeur> {
    const maintenant = this.now()
    if (!this.lue || maintenant - this.lue.le > PAGE_GARDEE_MS) {
      const lecture = this.file.then(() => this.lire(maintenant))
      this.lue = { le: maintenant, lecture }
      // Une lecture qui échoue ne se garde pas : la suivante réessaie.
      lecture.catch(() => {
        if (this.lue?.lecture === lecture) this.lue = null
      })
    }
    const { heures, demarrages } = await this.lue.lecture
    const miennes = this.releve.lignes(this.id)
    const autres = heures.filter(h => h.demarrage !== this.id || !miennes.some(m => m.heure === h.heure))
    const courant = this.moi ?? { id: this.id, demarreLe: maintenant, pretEnMs: null, version: null, env: null, vuLe: maintenant, arreteLe: null }
    return pageDuServeur([...autres, ...miennes], demarrages, { maintenant, courant })
  }

  /**
   * Ce qui, du serveur, attend un geste dans « À traiter » : les erreurs et
   * Turso lus dans le relevé, la mémoire mesurée à l'instant, et les
   * démarrages de ce dernier jour relus au plus toutes les dix minutes. Une
   * base qui se tait ôte l'arrêt net, pas le reste.
   */
  async alertes(memoireMo: number | null): Promise<AlertesDuServeur> {
    const maintenant = this.now()
    if (!this.recents || maintenant - this.recents.le > DEMARRAGES_GARDES_MS) {
      const lecture = this.client
        .execute({ sql: 'SELECT * FROM qg_demarrages WHERE vu_le >= ?', args: [maintenant - ARRET_RECENT_MS - SILENCE_D_UN_ARRET_MS] })
        .then(r => r.rows.map(lireDemarrage))
      this.recents = { le: maintenant, lecture }
      lecture.catch(() => {
        if (this.recents?.lecture === lecture) this.recents = null
      })
    }
    const demarrages = await this.recents.lecture.catch((e: unknown) => {
      console.error('[santé] les démarrages ne se lisent pas :', e)
      return []
    })
    return alertesDuServeur({ recentes: this.releve.lignes(this.id), demarrages, memoireMo, maintenant, courant: this.id })
  }
}
