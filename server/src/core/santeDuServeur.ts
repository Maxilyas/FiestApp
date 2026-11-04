import { randomUUID } from 'node:crypto'
import type { InStatement, Row } from '@libsql/client'
import { clientDistant, type Client } from './distante'
import { enFond, sousLeNom } from './gels'
import { releve as releveDuProcessus, type ReleveHoraire } from './pouls'
import { rendreLaMain } from './tourniquet'
import { veille as veilleDuProcessus, type Veille } from './veille'
import { lesErreursTriees, lireLeTri, type EtatDUneErreur, type PageDesErreurs, type TriDUneErreur, type TriLu } from '../../../shared/triDesErreurs'
import { APPAREILS, PAGES_MESUREES, type PageMesuree, type TelephonesDeLHeure } from '../../../shared/telephones'
import {
  ARRET_RECENT_MS,
  HEURE_MS,
  HEURES_DE_SANTE,
  PLAFONDS_INCONNUS,
  RELEVE_MS,
  SANTE_GARDEE_MS,
  SAUVEGARDES_MONTREES,
  SEUILS_DU_SERVEUR,
  SILENCE_D_UN_ARRET_MS,
  alertesDuServeur,
  debutDeLHeure,
  pageDuServeur,
  quotaDuMois,
  versionsDeLaSemaine,
  type AlertesDuServeur,
  type CeQuiGele,
  type CeQuiTournait,
  type DemarrageDuServeur,
  type ErreurDeLaSemaine,
  type ErreurEnDetail,
  type GelDeLaBoucle,
  type GelsDeLHeure,
  type HeureDeSante,
  type LecturesDUneRequete,
  type PageDuServeur,
  type PeriodeDuServeur,
  type PlafondsDuConteneur,
  type SeuilsDuServeur,
  type QuotaDeLHeure,
  type RouteDeLHeure,
  type TempsReelDeLHeure,
  type SauvegardeDeLaBase,
  type TrancheDeSante,
  type VersionDuServeur,
} from '../../../shared/santeDuServeur'

/** La semaine se remet à jour au plus une fois la minute pour la page : un rechargement ne coûte rien au quota. */
const PAGE_GARDEE_MS = 60_000
/** Les démarrages des alertes se relisent au plus toutes les dix minutes : la vue d'ensemble les demande toutes les cinq. */
const DEMARRAGES_GARDES_MS = 10 * 60_000
/** Le quota de la semaine, pour les alertes, se lit dans une semaine remise à jour dans l'heure : il se juge sur des jours. */
const QUOTA_GARDE_MS = HEURE_MS
/**
 * La première lecture de la semaine, par tranches de six heures — une poignée
 * de lignes chacune —, la main rendue entre deux : d'un seul tenant, ses 2,3 Mo
 * de relevés gelaient le serveur 2,6 s au dixième de cœur (le banc du 4
 * novembre 2026, `retours/2026-11-04/performance-du-qg.md`).
 */
const HEURES_D_UNE_TRANCHE = 6
/**
 * Une remise à jour reprend un peu avant la précédente : une ligne porte
 * l'heure où elle s'est préparée (`maj_le`), et la file qui l'envoie
 * (`ecrire`) peut la poser après une lecture faite entre-temps — celle d'un
 * démarrage qui s'éteint, celle de ce démarrage derrière un Turso lent. Deux
 * relevés de marge : une ou deux lignes relues de trop, au pire.
 */
const MARGE_DE_RELECTURE_MS = 2 * RELEVE_MS

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

/**
 * Les gels d'une heure tels que la base les garde (`core/gels.ts`) ; absents
 * d'une ligne d'avant leur relevé, ou qui ne se lisent plus : leur heure garde
 * le reste.
 */
function gelsLus(v: unknown): GelsDeLHeure | undefined {
  if (!v || typeof v !== 'object') return undefined
  const g = v as Partial<GelsDeLHeure>
  if (!Number.isFinite(g.n) || !Number.isFinite(g.totalMs)) return undefined
  const ceQuiTournait = (c: unknown): c is CeQuiTournait => !!c && typeof (c as CeQuiTournait).quoi === 'string' && Number.isFinite((c as CeQuiTournait).n)
  const plusLongs = (Array.isArray(g.plusLongs) ? g.plusLongs : [])
    .filter((p): p is GelDeLaBoucle => !!p && Number.isFinite(p.a) && Number.isFinite(p.dureeMs))
    .map(p => ({
      a: p.a,
      dureeMs: p.dureeMs,
      processeurMs: Number(p.processeurMs) || 0,
      ramasseMiettesMs: Number(p.ramasseMiettesMs) || 0,
      enCours: Array.isArray(p.enCours) ? p.enCours.filter(ceQuiTournait) : [],
    }))
  const parCe = (Array.isArray(g.parCe) ? g.parCe : []).filter(
    (c): c is CeQuiGele => !!c && typeof c.quoi === 'string' && Number.isFinite(c.n) && Number.isFinite(c.ms),
  )
  return { n: Number(g.n), totalMs: Number(g.totalMs), plusLongs, parCe, sansRien: Number(g.sansRien) || 0 }
}

const unNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const unObjet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'

/** Une route d'une ligne : chacun de ses chiffres lisible, ou elle s'ôte — pas la ligne. */
function routeLue(r: unknown): r is RouteDeLHeure {
  return unObjet(r) && typeof r.route === 'string' && [r.n, r.p50, r.p95, r.max, r.totalMs, r.refusees, r.enErreur].every(unNombre)
}

/** Une tranche d'une ligne, de même : son début et ses comptes lisibles. */
function trancheLue(t: unknown): t is TrancheDeSante {
  return unObjet(t) && unNombre(t.debut) && unNombre(t.erreurs) && unObjet(t.requetes) && unObjet(t.gels)
}

/** Une ligne de `qg_sante` ; null si son relevé ne se lit plus — une ligne illisible ôte son heure, pas la page. */
function lireHeure(r: Row): HeureDeSante | null {
  try {
    const releve = JSON.parse(String(r.releve)) as Partial<HeureDeSante>
    const enDetail = erreursLues(releve.erreursEnDetail)
    const gels = gelsLus(releve.gels)
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
      ...(gels && { gels }),
      // Absents d'une ligne d'avant le 4 novembre 2026 : la page dit depuis quand elle les a (`routesDepuis`).
      ...(Array.isArray(releve.parRoute) && { parRoute: releve.parRoute.filter(routeLue) }),
      ...(Array.isArray(releve.tranches) && { tranches: releve.tranches.filter(trancheLue) }),
      ...(telephonesLus(releve.telephones) && { telephones: telephonesLus(releve.telephones)! }),
      ...(tempsReelLu(releve.tempsReel) && { tempsReel: tempsReelLu(releve.tempsReel)! }),
    }
  } catch {
    return null
  }
}

/** Une ligne de `qg_sante` dans la semaine gardée, sous son heure et son démarrage ; récrite illisible, son heure s'en va. */
function garder(semaine: Map<string, HeureDeSante>, r: Row) {
  const cle = `${Number(r.heure)}|${String(r.demarrage)}`
  const h = lireHeure(r)
  if (h) semaine.set(cle, h)
  else semaine.delete(cle)
}

/** Le temps réel d'une heure : ses messages lisibles, comme des routes, et ses comptes ; rien d'une ligne d'avant, ou illisible. */
function tempsReelLu(t: unknown): TempsReelDeLHeure | null {
  if (!unObjet(t) || !Array.isArray(t.parMessage)) return null
  const compte = (v: unknown) => (unNombre(v) ? v : 0)
  const c = unObjet(t.chronos) ? t.chronos : {}
  return {
    parMessage: t.parMessage.filter(routeLue),
    tropTard: compte(t.tropTard),
    connexions: compte(t.connexions),
    chronos: { n: compte(c.n), enRetard: compte(c.enRetard), maxMs: compte(c.maxMs) },
  }
}

/** Ce que les téléphones ont mesuré dans une heure : ses pages lisibles, ou rien — une page illisible s'ôte, pas l'heure. */
function telephonesLus(t: unknown): TelephonesDeLHeure | null {
  if (!unObjet(t) || !Array.isArray(t.pages)) return null
  const centile = (c: unknown) => (unObjet(c) && unNombre(c.n) && unNombre(c.p75) ? { n: c.n, p75: c.p75 } : null)
  return {
    pages: t.pages
      .filter((p): p is Record<string, unknown> => unObjet(p) && (PAGES_MESUREES as readonly unknown[]).includes(p.page) && unNombre(p.vues) && unNombre(p.erreurs))
      .map(p => ({ page: p.page as PageMesuree, vues: p.vues as number, erreurs: p.erreurs as number, lcp: centile(p.lcp), inp: centile(p.inp), cls: centile(p.cls) })),
    appareils: unObjet(t.appareils) ? Object.fromEntries(Object.entries(t.appareils).filter(([a, n]) => (APPAREILS as readonly string[]).includes(a) && unNombre(n))) : {},
    installees: unNombre(t.installees) ? t.installees : 0,
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
  /**
   * Les heures de la semaine déjà lues de la base, par heure et démarrage : une
   * heure finie ne change plus — seule la dernière d'un démarrage se récrit —,
   * la base ne se relit donc que pour ce qui a changé (`relire`). La page, ses
   * versions et le quota des alertes y lisent tous.
   */
  private semaine = new Map<string, HeureDeSante>()
  /** Les démarrages de la semaine et le dernier d'avant, relus avec elle : quelques dizaines de lignes. */
  private demarragesLus: DemarrageDuServeur[] = []
  /** L'instant de la dernière remise à jour réussie ; null, la semaine n'est pas encore lue. */
  private lueJusquA: number | null = null
  /** La remise à jour en route ou la dernière faite : une seule à la fois, que tous attendent — même passé son temps. */
  private lue: { le: number; lecture: Promise<void>; finie: boolean } | null = null
  private recents: { le: number; lecture: Promise<DemarrageDuServeur[]> } | null = null
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
  /** Les seuils que l'administrateur a réglés au QG (`ReglesDuQg`, branchés par `server.ts`) ; d'office, ceux du code. */
  private seuils: () => SeuilsDuServeur = () => SEUILS_DU_SERVEUR

  /** Les règles des alertes, nées après la santé dans le démarrage, lui prêtent leurs seuils. */
  reglerLesSeuils(seuils: () => SeuilsDuServeur) {
    this.seuils = seuils
  }

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
      /**
       * La semaine remise à jour au plus une fois par…, la minute d'office
       * (`PAGE_GARDEE_MS`) ; zéro la relit en entier à chaque fois — un rendu
       * écrit sa semaine sous le serveur, à des `maj_le` d'avant sa lecture.
       */
      pageGardeeMs?: number
    } = {},
  ) {
    this.client = clientDistant(url, authToken)
    this.releve = deps.releve ?? releveDuProcessus
    this.veille = deps.veille ?? veilleDuProcessus
    this.now = deps.maintenant ?? Date.now
    this.releveMs = deps.releveMs ?? RELEVE_MS
    this.plafonds = deps.plafonds ?? PLAFONDS_INCONNUS
    this.mesuresDeLHebergeur = deps.mesuresDeLHebergeur ?? null
    this.pageGardeeMs = deps.pageGardeeMs ?? PAGE_GARDEE_MS
  }

  private readonly pageGardeeMs: number

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
        // Les sauvegardes de la base permanente, une ligne chacune, que `npm run sauvegarde` écrit en finissant
        // (`server/scripts/sauvegarde.ts`) : rien ne disait à quand remontait la dernière.
        `CREATE TABLE IF NOT EXISTS qg_sauvegardes (
           faite_le INTEGER NOT NULL,
           tables   INTEGER NOT NULL,
           lignes   INTEGER NOT NULL,
           octets   INTEGER NOT NULL,
           duree_ms INTEGER NOT NULL
         )`,
        'CREATE INDEX IF NOT EXISTS idx_qg_sauvegardes_le ON qg_sauvegardes(faite_le)',
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
    // Ses heures en texte, d'un seul tenant et sous son nom (`core/gels.ts`) : chaque route, ses tranches, les
    // téléphones et le temps réel de l'heure, toutes les dix minutes, sans requête pour les porter.
    const lignes = sousLeNom('fond · relevé du serveur', () => this.lignesAEcrire(maintenant))
    return this.ecrire([...lignes, { sql: 'UPDATE qg_demarrages SET vu_le = ? WHERE id = ?', args: [maintenant, this.id] }, ...this.purger(maintenant)])
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

  /**
   * La semaine, remise à jour si elle a plus de `gardeeMs` — après les
   * écritures en route (`file`) : la page voit ce que ce démarrage vient
   * d'écrire. Une remise à jour encore en route s'attend, même passé ce
   * temps : derrière un Turso lent, une seconde partirait sous elle, et la
   * première lecture se serait faite deux fois. Une remise à jour qui échoue
   * ne se garde pas : la suivante réessaie, et la semaine d'avant reste telle
   * qu'elle était.
   */
  private semaineFraiche(gardeeMs: number): Promise<void> {
    const maintenant = this.now()
    // À zéro — un rendu qui écrit sa semaine sous le serveur —, chaque appel relit : une lecture partie avant ce qu'il
    // vient d'écrire ne le verrait pas.
    if (!this.lue || (maintenant - this.lue.le > gardeeMs && (this.lue.finie || gardeeMs === 0))) {
      // Nommée pour la sonde des gels (`core/gels.ts`) : la première lecture court sur une trentaine d'allers-retours.
      const lecture = enFond('fond · semaine du serveur', this.file.then(() => this.relire(maintenant)))
      const lue = { le: maintenant, lecture, finie: false }
      this.lue = lue
      lecture.then(
        () => {
          lue.finie = true
        },
        () => {
          if (this.lue === lue) this.lue = null
        },
      )
    }
    return this.lue.lecture
  }

  /**
   * La semaine gardée, remise à jour : la première fois, lue en entier par
   * tranches qui rendent la main (`lireEnTranches`) ; ensuite, seulement les
   * lignes récrites depuis la remise à jour d'avant, marge comprise
   * (`MARGE_DE_RELECTURE_MS`). Relue en entier à chaque fois, la semaine
   * faisait recevoir, décoder et relire 2,3 Mo d'un seul bloc — chaque heure
   * pour les règles des alertes, QG fermé, et à chaque page « Le serveur » :
   * 2,6 s de gel pour tout le monde au dixième de cœur (le banc du 4 novembre
   * 2026, `retours/2026-11-04/performance-du-qg.md`). Les démarrages —
   * quelques dizaines de lignes, et le dernier d'avant la semaine : la sorte
   * du premier se lit dans lui — se relisent en entier, après les heures :
   * chaque heure lue a le sien.
   */
  private async relire(maintenant: number): Promise<void> {
    const debut = debutDeLHeure(maintenant) - (HEURES_DE_SANTE - 1) * HEURE_MS
    const depuis = this.pageGardeeMs > 0 && this.lueJusquA !== null ? this.lueJusquA - MARGE_DE_RELECTURE_MS : null
    // Lue en entier, une semaine neuve : celle d'avant reste tant que la lecture n'a pas fini.
    const semaine = depuis === null ? new Map<string, HeureDeSante>() : this.semaine
    if (depuis === null) await this.lireEnTranches(debut, debutDeLHeure(maintenant), semaine)
    const [demarrages, avant, recrites] = await this.client.batch(
      [
        { sql: 'SELECT * FROM qg_demarrages WHERE demarre_le >= ? ORDER BY demarre_le', args: [debut] },
        { sql: 'SELECT * FROM qg_demarrages WHERE demarre_le < ? ORDER BY demarre_le DESC LIMIT 1', args: [debut] },
        ...(depuis === null ? [] : [{ sql: 'SELECT heure, demarrage, releve FROM qg_sante WHERE heure >= ? AND maj_le > ?', args: [debut, depuis] }]),
      ],
      'read',
    )
    for (const r of recrites?.rows ?? []) garder(semaine, r)
    for (const [cle, h] of semaine) if (h.heure < debut) semaine.delete(cle)
    this.semaine = semaine
    this.demarragesLus = [...avant.rows, ...demarrages.rows].map(lireDemarrage)
    this.lueJusquA = maintenant
  }

  /**
   * Les heures de la semaine, six par six (`HEURES_D_UNE_TRANCHE`) : le client
   * décode une tranche, la main se rend, ses lignes se relisent — le plus long
   * bloc n'est plus que la plus grosse tranche. La dernière, sans borne : une
   * heure qu'un démarrage aurait datée en avance ne se perd pas.
   */
  private async lireEnTranches(debut: number, derniere: number, semaine: Map<string, HeureDeSante>): Promise<void> {
    const pas = HEURES_D_UNE_TRANCHE * HEURE_MS
    for (let de = debut; de <= derniere; de += pas) {
      const lues = await this.client.execute(
        de + pas > derniere
          ? { sql: 'SELECT heure, demarrage, releve FROM qg_sante WHERE heure >= ?', args: [de] }
          : { sql: 'SELECT heure, demarrage, releve FROM qg_sante WHERE heure >= ? AND heure < ?', args: [de, de + pas] },
      )
      await rendreLaMain()
      for (const r of lues.rows) garder(semaine, r)
    }
  }

  /** Les heures de la semaine : celles de la base, et celles de ce démarrage lues dans son relevé — plus fraîches que la base. */
  private lignesDeLaSemaine(miennes: HeureDeSante[] = this.releve.lignes(this.id)): HeureDeSante[] {
    const autres = [...this.semaine.values()].filter(h => h.demarrage !== this.id || !miennes.some(m => m.heure === h.heure))
    return [...autres, ...miennes]
  }

  /** Celui qui répond, même si son démarrage n'est pas encore écrit. */
  private courantA(maintenant: number): DemarrageDuServeur {
    return this.moi ?? { id: this.id, demarreLe: maintenant, pretEnMs: null, version: null, env: null, vuLe: maintenant, arreteLe: null }
  }

  /**
   * La page « Le serveur » sur sa période (la semaine d'office) : la semaine
   * remise à jour au plus une fois la minute — les sept jours, quelle que soit
   * la période : une heure et une journée en sont des morceaux —, et les
   * heures de ce démarrage lues dans le relevé, plus frais que la base.
   */
  async page(periode: PeriodeDuServeur = '7j'): Promise<PageDuServeur> {
    const maintenant = this.now()
    await this.semaineFraiche(this.pageGardeeMs)
    return pageDuServeur(this.lignesDeLaSemaine(), this.demarragesLus, {
      maintenant,
      courant: this.courantA(maintenant),
      plafonds: this.plafonds,
      mesuresDeLHebergeur: this.mesuresDeLHebergeur,
      periode,
    })
  }

  /**
   * Les versions de la semaine, telles que la page les montre
   * (`versionsDeLaSemaine`), sans le reste de la page : les règles des alertes
   * y lisent, une fois l'heure, les routes que la version en ligne ralentit —
   * elles calculaient la page entière pour cela.
   */
  async versions(): Promise<VersionDuServeur[]> {
    const maintenant = this.now()
    await this.semaineFraiche(this.pageGardeeMs)
    return versionsDeLaSemaine(this.lignesDeLaSemaine(), this.demarragesLus, { maintenant, courant: this.courantA(maintenant) })
  }

  /** La dernière sauvegarde notée, par son index — une ligne ; null, jamais une : la règle « Sauvegarde ancienne », une fois l'heure. */
  async derniereSauvegarde(): Promise<number | null> {
    const lue = await this.client.execute('SELECT MAX(faite_le) AS le FROM qg_sauvegardes')
    const le = lue.rows[0]?.le
    return le === null || le === undefined ? null : Number(le)
  }

  /**
   * Tous les démarrages gardés — huit jours au plus, quelques dizaines de
   * lignes —, le plus ancien d'abord : les heures de l'hébergeur (une fois
   * l'heure) et celles de chaque jour de la mémoire du QG (une fois par jour).
   */
  async demarragesGardes(): Promise<DemarrageDuServeur[]> {
    const lus = await this.client.execute('SELECT * FROM qg_demarrages ORDER BY demarre_le')
    return lus.rows.map(lireDemarrage)
  }

  private gardes: { le: number; lecture: Promise<DemarrageDuServeur[]> } | null = null

  /**
   * Les démarrages que la base garde — huit jours —, pour les repères des courbes du QG (`shared/qgEffets.ts` : ses mises
   * en ligne, ses arrêts nets) : leur seule table, par l'index de leur date, au plus toutes les dix minutes — jamais les
   * heures du relevé, que la page du serveur lit. Et l'identifiant de celui qui répond, qui ne se juge jamais arrêté net.
   * Les règles et la mémoire ont leur lecture à elles, à leur rythme (`demarragesGardes`).
   */
  async demarragesDesReperes(): Promise<{ demarrages: DemarrageDuServeur[]; courant: string; maintenant: number }> {
    const maintenant = this.now()
    if (!this.gardes || maintenant - this.gardes.le > DEMARRAGES_GARDES_MS) {
      const lecture = this.client
        .execute({ sql: 'SELECT * FROM qg_demarrages WHERE demarre_le >= ? ORDER BY demarre_le', args: [maintenant - SANTE_GARDEE_MS] })
        .then(r => r.rows.map(lireDemarrage))
      this.gardes = { le: maintenant, lecture }
      lecture.catch(() => {
        if (this.gardes?.lecture === lecture) this.gardes = null
      })
    }
    return { demarrages: await this.gardes.lecture, courant: this.id, maintenant }
  }

  /** Les dernières sauvegardes de la base, la plus récente d'abord : dix lignes par leur index, à l'ouverture de la page. */
  async sauvegardes(): Promise<SauvegardeDeLaBase[]> {
    const lues = await this.client.execute({
      sql: 'SELECT faite_le, tables, lignes, octets, duree_ms FROM qg_sauvegardes ORDER BY faite_le DESC LIMIT ?',
      args: [SAUVEGARDES_MONTREES],
    })
    return lues.rows.map(r => ({ faiteLe: Number(r.faite_le), tables: Number(r.tables), lignes: Number(r.lignes), octets: Number(r.octets), dureeMs: Number(r.duree_ms) }))
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
   * semaine lu dans la semaine gardée, remise à jour dans l'heure — il se
   * relisait à part, 170 Ko chaque heure. Une base qui se tait ôte l'arrêt net
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
    const [demarrages, semaineLue] = await Promise.all([
      this.recents.lecture.catch((e: unknown) => {
        console.error('[santé] les démarrages ne se lisent pas :', e)
        return []
      }),
      this.semaineFraiche(QUOTA_GARDE_MS).then(
        () => true,
        (e: unknown) => {
          console.error('[santé] le quota de la semaine ne se lit pas :', e)
          return false
        },
      ),
    ])
    const recentes = this.releve.lignes(this.id)
    // Les heures de ce démarrage se lisent dans son relevé, plus frais que la base ; la semaine, à l'heure qu'il est.
    const debutDeLaSemaine = debutDeLHeure(maintenant) - (HEURES_DE_SANTE - 1) * HEURE_MS
    const quota = semaineLue ? quotaDuMois(this.lignesDeLaSemaine(recentes).filter(h => h.heure >= debutDeLaSemaine), maintenant) : null
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
      seuils: this.seuils(),
    })
  }
}
