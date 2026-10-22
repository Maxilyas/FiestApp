import { randomUUID } from 'node:crypto'
import type { InStatement, Row } from '@libsql/client'
import { clientDistant, type Client } from './distante'
import { releve as releveDuProcessus, type ReleveHoraire } from './pouls'
import { veille as veilleDuProcessus, type Veille } from './veille'
import { lesErreursTriees, lireLeTri, type EtatDUneErreur, type PageDesErreurs, type TriDUneErreur, type TriLu } from '../../../shared/triDesErreurs'
import {
  ARRET_RECENT_MS,
  HEURE_MS,
  HEURES_DE_SANTE,
  PLAFONDS_INCONNUS,
  RELEVE_MS,
  SANTE_GARDEE_MS,
  SILENCE_D_UN_ARRET_MS,
  alertesDuServeur,
  debutDeLHeure,
  pageDuServeur,
  quotaDuMois,
  type AlertesDuServeur,
  type DemarrageDuServeur,
  type ErreurDeLaSemaine,
  type ErreurEnDetail,
  type HeureDeSante,
  type LecturesDUneRequete,
  type PageDuServeur,
  type PlafondsDuConteneur,
  type QuotaDeLHeure,
} from '../../../shared/santeDuServeur'

/** La page se relit au plus une fois la minute : un rechargement ne coûte rien au quota. */
const PAGE_GARDEE_MS = 60_000
/** Les démarrages des alertes se relisent au plus toutes les dix minutes : la vue d'ensemble les demande toutes les cinq. */
const DEMARRAGES_GARDES_MS = 10 * 60_000
/** Le quota de la semaine, pour les alertes, se relit au plus toutes les heures : il se juge sur des jours. */
const QUOTA_GARDE_MS = HEURE_MS

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

/** Les erreurs en détail d'une ligne, celles qui se lisent : une seule de travers ne doit pas faire tomber la page qui les liste. */
function erreursLues(v: unknown): ErreurEnDetail[] {
  if (!Array.isArray(v)) return []
  return v
    .filter(
      (e): e is ErreurEnDetail =>
        !!e &&
        typeof e === 'object' &&
        ['source', 'nom', 'message'].every(cle => typeof e[cle] === 'string') &&
        ['n', 'premiere', 'derniere'].every(cle => Number.isFinite(e[cle])) &&
        Array.isArray(e.pile) &&
        e.pile.every((c: unknown) => typeof c === 'string'),
    )
    .map(e => ({ ...e, code: typeof e.code === 'string' ? e.code : null, ou: typeof e.ou === 'string' ? e.ou : null }))
}

/** Un tri de `qg_erreurs` ; null s'il ne se lit plus — la ligne illisible laisse son erreur à regarder. */
function lireTri(r: Row): [string, TriDUneErreur] | null {
  if (r.etat !== 'reglee' && r.etat !== 'ignoree') return null
  let versions: unknown
  try {
    versions = JSON.parse(String(r.versions))
  } catch {
    return null
  }
  if (!Array.isArray(versions) || !versions.every(v => typeof v === 'string')) return null
  return [String(r.cle), { etat: r.etat, note: r.note === null ? null : String(r.note), depuis: Number(r.depuis), versions }]
}

/** Le quota d'une heure, s'il se lit : un relevé de travers ôte son quota, pas la page. */
function quotaLu(v: unknown): QuotaDeLHeure | null {
  if (!v || typeof v !== 'object') return null
  const q = v as Record<string, unknown>
  if (!['appels', 'lues', 'ecrites'].every(cle => Number.isFinite(q[cle]))) return null
  const lourdes = Array.isArray(q.lourdes)
    ? q.lourdes.filter((l): l is LecturesDUneRequete => !!l && typeof l.requete === 'string' && Number.isFinite(l.n) && Number.isFinite(l.lues))
    : []
  return { appels: Number(q.appels), lues: Number(q.lues), ecrites: Number(q.ecrites), lourdes }
}

/** Le quota d'une heure tel que `json_extract` le rend, un texte ; null s'il ne se lit pas. */
function quotaDuTexte(v: unknown): QuotaDeLHeure | null {
  if (typeof v !== 'string') return null
  try {
    return quotaLu(JSON.parse(v))
  } catch {
    return null
  }
}

/** Une ligne de `qg_sante` ; null si son relevé ne se lit plus — une ligne illisible ôte son heure, pas la page. */
function lireHeure(r: Row): HeureDeSante | null {
  try {
    const releve = JSON.parse(String(r.releve)) as Partial<HeureDeSante>
    const enDetail = erreursLues(releve.erreursEnDetail)
    return {
      heure: Number(r.heure),
      demarrage: String(r.demarrage),
      base: releve.base ?? null,
      routes: releve.routes ?? null,
      lentes: Array.isArray(releve.lentes) ? releve.lentes : [],
      erreurs: releve.erreurs && typeof releve.erreurs === 'object' ? releve.erreurs : {},
      ...(enDetail.length > 0 && { erreursEnDetail: enDetail }),
      miroir: Number(releve.miroir ?? 0),
      charge: releve.charge ?? null,
      connexions: releve.connexions ?? null,
      requetes: releve.requetes ?? null,
      quota: quotaLu(releve.quota),
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
  /** Le quota de chaque heure de la semaine, sans le reste du relevé : les alertes n'ont besoin que de lui. */
  private quotas: { le: number; lecture: Promise<Pick<HeureDeSante, 'heure' | 'demarrage' | 'quota'>[]> } | null = null
  /**
   * Ce que l'administrateur a dit des erreurs (`/admin#erreurs`), lu au
   * démarrage et tenu en mémoire : les alertes de la vue d'ensemble le lisent
   * toutes les cinq minutes, sans un aller-retour. Gardé au-delà des huit
   * jours du relevé : une erreur ignorée qui retombe dans un mois le reste.
   */
  private tris = new Map<string, TriDUneErreur>()
  private readonly releve: ReleveHoraire
  private readonly veille: Pick<Veille, 'pannes'>
  private readonly now: () => number
  private readonly releveMs: number
  private readonly plafonds: PlafondsDuConteneur
  private readonly mesuresDeLHebergeur: string | null

  /**
   * `plafonds` : ceux du conteneur, lus une fois au démarrage
   * (`plafondsDuConteneur`) ; `mesuresDeLHebergeur` : la page de ses
   * mesures sur son tableau de bord, que la page « Le serveur » propose.
   */
  constructor(
    url: string,
    authToken?: string,
    deps: {
      maintenant?: () => number
      releve?: ReleveHoraire
      veille?: Pick<Veille, 'pannes'>
      releveMs?: number
      plafonds?: PlafondsDuConteneur
      mesuresDeLHebergeur?: string | null
    } = {},
  ) {
    this.client = clientDistant(url, authToken)
    this.releve = deps.releve ?? releveDuProcessus
    this.veille = deps.veille ?? veilleDuProcessus
    this.now = deps.maintenant ?? Date.now
    this.releveMs = deps.releveMs ?? RELEVE_MS
    this.plafonds = deps.plafonds ?? PLAFONDS_INCONNUS
    this.mesuresDeLHebergeur = deps.mesuresDeLHebergeur ?? null
  }

  async init() {
    const lus = await this.client.batch(
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
        // Le tri des erreurs, une ligne par erreur triée (`cleDeLErreur`) : sans ligne, elle est à regarder.
        `CREATE TABLE IF NOT EXISTS qg_erreurs (
           cle      TEXT PRIMARY KEY,
           etat     TEXT NOT NULL,
           note     TEXT,
           depuis   INTEGER NOT NULL,
           versions TEXT NOT NULL
         )`,
        'SELECT cle, etat, note, depuis, versions FROM qg_erreurs',
      ],
      'write',
    )
    this.tris = new Map(lus[lus.length - 1].rows.map(lireTri).filter((t): t is [string, TriDUneErreur] => t !== null))
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
    return pageDuServeur([...autres, ...miennes], demarrages, { maintenant, courant, plafonds: this.plafonds, mesuresDeLHebergeur: this.mesuresDeLHebergeur })
  }

  /**
   * La page des erreurs (`/admin#erreurs`) : celles de la semaine, lues comme
   * la page « Le serveur » — la base au plus une fois la minute, ce démarrage
   * dans son relevé —, chacune sous son tri.
   */
  async erreurs(): Promise<Pick<PageDesErreurs, 'maintenant' | 'enMarche' | 'erreurs' | 'sansDetail'>> {
    const page = await this.page()
    return {
      maintenant: page.maintenant,
      enMarche: { depuis: page.enMarche.depuis, version: page.enMarche.version },
      erreurs: lesErreursTriees(page.erreurs, this.tris),
      sansDetail: page.erreursSansDetail,
    }
  }

  /**
   * L'administrateur trie une erreur de la semaine : réglée — avec les
   * versions qui l'ont vue tomber jusqu'ici : y retomber n'est pas revenir —,
   * ignorée, ou remise à regarder, qui efface son tri. Un geste qui ne change
   * rien est refusé, comme ailleurs au QG. Rend l'erreur et son tri d'avant,
   * pour le journal ; null si elle n'est plus dans la semaine.
   */
  async trier(cle: string, etat: EtatDUneErreur, note: string | null): Promise<{ erreur: ErreurDeLaSemaine; avant: TriLu } | null> {
    const erreur = (await this.page()).erreurs.find(e => e.cle === cle)
    if (!erreur) return null
    const tri = this.tris.get(cle)
    const avant = lireLeTri(erreur.parVersion, tri)
    if (avant.etat === etat && (etat === 'a-regarder' || note === tri?.note)) {
      throw new Error(etat === 'a-regarder' ? 'Cette erreur est déjà à regarder' : etat === 'reglee' ? 'Cette erreur est déjà réglée' : 'Cette erreur est déjà ignorée')
    }
    if (etat === 'a-regarder') {
      await this.client.execute({ sql: 'DELETE FROM qg_erreurs WHERE cle = ?', args: [cle] })
      this.tris.delete(cle)
    } else {
      // Une note changée garde sa date : seul un nouveau tri la refait.
      const neuf: TriDUneErreur = avant.etat === etat && tri ? { ...tri, note } : { etat, note, depuis: this.now(), versions: erreur.versions }
      await this.client.execute({
        sql: 'INSERT OR REPLACE INTO qg_erreurs (cle, etat, note, depuis, versions) VALUES (?, ?, ?, ?, ?)',
        args: [cle, neuf.etat, neuf.note, neuf.depuis, JSON.stringify(neuf.versions)],
      })
      this.tris.set(cle, neuf)
    }
    return { erreur, avant }
  }

  /**
   * Ce qui, du serveur, attend un geste dans « À traiter » : les modes en
   * panne, que la veille voit tomber ; les erreurs à regarder et Turso lus
   * dans le relevé, la mémoire mesurée à l'instant, les démarrages de ce
   * dernier jour relus au plus toutes les dix minutes, et le quota de la
   * semaine au plus toutes les heures. Une base qui se tait ôte l'arrêt net
   * et le quota, pas le reste.
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
    if (!this.quotas || maintenant - this.quotas.le > QUOTA_GARDE_MS) {
      const lecture = this.client
        .execute({
          sql: `SELECT heure, demarrage, json_extract(releve, '$.quota') AS quota FROM qg_sante WHERE heure >= ? AND json_valid(releve)`,
          args: [debutDeLHeure(maintenant) - (HEURES_DE_SANTE - 1) * HEURE_MS],
        })
        .then(r => r.rows.map(l => ({ heure: Number(l.heure), demarrage: String(l.demarrage), quota: quotaDuTexte(l.quota) })))
      this.quotas = { le: maintenant, lecture }
      lecture.catch(() => {
        if (this.quotas?.lecture === lecture) this.quotas = null
      })
    }
    const [demarrages, quotas] = await Promise.all([
      this.recents.lecture.catch((e: unknown) => {
        console.error('[santé] les démarrages ne se lisent pas :', e)
        return []
      }),
      this.quotas.lecture.catch((e: unknown) => {
        console.error('[santé] le quota de la semaine ne se lit pas :', e)
        return null
      }),
    ])
    const recentes = this.releve.lignes(this.id)
    // Les heures de ce démarrage se lisent dans son relevé, plus frais que la base.
    const quota = quotas && quotaDuMois([...quotas.filter(h => h.demarrage !== this.id || !recentes.some(m => m.heure === h.heure)), ...recentes], maintenant)
    return alertesDuServeur({
      recentes,
      demarrages,
      memoireMo,
      maintenant,
      courant: this.id,
      version: this.moi?.version ?? null,
      tri: this.tris,
      pannes: this.veille.pannes(),
      quota,
    })
  }
}
