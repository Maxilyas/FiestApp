import { clientDistant, type Client } from './distante'
import {
  CALME_POUR_CLORE_MS,
  CLES_DES_REGLES,
  JOURS_DES_INCIDENTS,
  MOT_D_UN_INCIDENT_MAX,
  REGLE,
  REGLES_NEUVES_A_TRAITER,
  defautDe,
  defautsDesSeuils,
  estUneRegle,
  lireLeReglage,
  reglesOuvertes,
  seuilDe,
  seuilEcrit,
  sonneAuTelephone,
  type AlerteATraiter,
  type CleDeRegle,
  type DefautsDesSeuils,
  type IncidentDuQg,
  type PageDesAlertes,
  type ReglageDUneRegle,
  type ReglagesDuQg,
  type ReleveDesAlertes,
} from '../../../shared/qgAlertes'
import {
  SEUILS_DU_SERVEUR,
  heuresDuMois,
  type AlertesDuServeur,
  type DemarrageDuServeur,
  type HeuresDeLHebergeur,
  type PageDuServeur,
  type SeuilsDuServeur,
} from '../../../shared/santeDuServeur'
import type { MessageDuQg } from '../../../shared/pannes'
import { espacesFines } from '../../../shared/typographie'
import { jourAvant, jourDe, minutesDeParis } from '../../../shared/jour'
import { minuitDuJour } from '../../../shared/qgJoueurs'
import type { DirectDuServeur } from './pouls'

/** Chaque règle se juge une fois la minute. */
export const TOUR_DES_REGLES_MS = 60_000

/** Une règle ouverte, et l'incident qui la raconte. */
interface Ouverte {
  /** La ligne de `qg_incidents` ; null si la base l'a refusée — l'alerte vit quand même. */
  id: number | null
  debut: number
  cause: string
  /** Depuis quand elle ne se dit plus : elle se referme après `CALME_POUR_CLORE_MS`. */
  calmeDepuis: number | null
}

const messageDOuverture = (cle: CleDeRegle, cause: string): MessageDuQg => ({
  titre: espacesFines(`Alerte : ${REGLE[cle].nom}`),
  corps: espacesFines(`${cause[0].toUpperCase()}${cause.slice(1)}. Touche pour voir les alertes.`),
  url: '/admin#alertes',
  tag: `qg-alerte-${cle}`,
})
const messageDeRetour = (cle: CleDeRegle): MessageDuQg => ({
  titre: espacesFines(`Au calme : ${REGLE[cle].nom}`),
  corps: 'Plus rien depuis cinq minutes.',
  url: '/admin#alertes',
  tag: `qg-alerte-${cle}`,
})

/**
 * Les règles des alertes du QG et leurs incidents (le QG 2, lot 8) : les
 * réglages de l'administrateur (`qg_reglages`, une ligne par règle réglée —
 * son seuil, son téléphone), lus au démarrage et tenus en mémoire ; et chaque
 * minute, les règles jugées sur ce que le serveur sait déjà (`deps.lire` : la
 * santé du serveur, le direct, le miroir, la réserve, le rappel — rien de plus
 * vers Turso), un incident ouvert à la première minute où une règle se dit,
 * refermé après cinq minutes de calme (`qg_incidents` : une écriture à
 * l'ouverture, une à la fermeture). Une règle qui sonne au téléphone le dit à
 * l'ouverture et au retour au calme — sauf la panne d'un mode, que la veille
 * dit déjà (`server.ts`, `direLaVeille`).
 */
export class ReglesDuQg {
  private client: Client
  private reglages: ReglagesDuQg = {}
  private ouvertes = new Map<CleDeRegle, Ouverte>()
  private minuterie: ReturnType<typeof setInterval> | null = null
  private enRoute = false
  /** Les écritures l'une après l'autre : un réglage et un incident partis ensemble finissent dans l'ordre. */
  private file: Promise<unknown> = Promise.resolve()
  /** Ce qui vaut d'office sur ce serveur : hors de la production, la part de la préproduction des heures de l'hébergeur. */
  readonly defauts: DefautsDesSeuils

  constructor(
    url: string,
    authToken: string | undefined,
    private deps: {
      lire: () => Promise<ReleveDesAlertes>
      prevenir: (m: MessageDuQg) => void
      maintenant?: () => number
      tourMs?: number
      /** Ce serveur est la production (`APP_ENV` absent) ; d'office, oui. */
      production?: boolean
    },
  ) {
    this.client = clientDistant(url, authToken)
    this.defauts = defautsDesSeuils(deps.production ?? true)
  }

  private now() {
    return (this.deps.maintenant ?? Date.now)()
  }

  private enFile<T>(ecrire: () => Promise<T>): Promise<T> {
    const suite = this.file.then(ecrire, ecrire)
    this.file = suite.catch(() => {})
    return suite
  }

  async init() {
    const [, , , lus, encore] = await this.client.batch(
      [
        // Une ligne par règle réglée : ce qui vaut d'office n'y est pas.
        `CREATE TABLE IF NOT EXISTS qg_reglages (
           cle    TEXT PRIMARY KEY,
           valeur TEXT NOT NULL,
           maj_le INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS qg_incidents (
           id      INTEGER PRIMARY KEY AUTOINCREMENT,
           regle   TEXT NOT NULL,
           gravite TEXT NOT NULL,
           debut   INTEGER NOT NULL,
           fin     INTEGER,
           cause   TEXT NOT NULL,
           mot     TEXT
         )`,
        'CREATE INDEX IF NOT EXISTS idx_qg_incidents_debut ON qg_incidents(debut)',
        // Dans le même aller-retour : un réveil de l'hébergeur n'en paie pas un de plus.
        'SELECT cle, valeur FROM qg_reglages',
        'SELECT id, regle, debut, cause FROM qg_incidents WHERE fin IS NULL ORDER BY debut',
      ],
      'write',
    )
    for (const r of lus.rows) {
      const cle = String(r.cle)
      if (!estUneRegle(cle)) continue
      // Relu par la même règle qu'à l'écriture : un seuil que le code a resserré depuis se tait, la règle reprend son défaut.
      try {
        this.reglages[cle] = lireLeReglage(cle, JSON.parse(String(r.valeur)), {}, this.defauts)
      } catch {
        // Un réglage illisible n'empêche pas de démarrer.
      }
    }
    // Les incidents laissés ouverts par le serveur d'avant continuent : la première minute dira s'ils durent.
    for (const r of encore.rows) {
      const cle = String(r.regle)
      if (estUneRegle(cle)) this.ouvertes.set(cle, { id: Number(r.id), debut: Number(r.debut), cause: String(r.cause), calmeDepuis: null })
    }
  }

  demarrer() {
    if (this.minuterie) return
    this.minuterie = setInterval(() => void this.tour(), this.deps.tourMs ?? TOUR_DES_REGLES_MS)
    this.minuterie.unref()
  }

  arreter() {
    if (this.minuterie) clearInterval(this.minuterie)
    this.minuterie = null
  }

  /** Ce que la santé du serveur juge avec : les seuils réglés de Turso, de la mémoire et du quota. */
  seuilsDuServeur(): SeuilsDuServeur {
    return {
      tursoLentMs: seuilDe('turso-lent', this.reglages, this.defauts) ?? SEUILS_DU_SERVEUR.tursoLentMs,
      memoireMo: seuilDe('memoire', this.reglages, this.defauts) ?? SEUILS_DU_SERVEUR.memoireMo,
      partDuQuota: seuilDe('quota', this.reglages, this.defauts) ?? SEUILS_DU_SERVEUR.partDuQuota,
    }
  }

  /** Le seuil de la réserve du quiz du jour : « À traiter » le lit (`ATraiterDuQg.seuilDeLaReserve`). */
  seuilDeLaReserve(): number {
    return seuilDe('reserve', this.reglages, this.defauts) ?? 0
  }

  /** L'âge d'une sauvegarde qui la fait dire ancienne, en jours : la page « Base et miroir » la peint au même seuil que la règle. */
  joursDUneSauvegarde(): number {
    return seuilDe('sauvegarde', this.reglages, this.defauts) ?? 0
  }

  /** La panne d'un mode sonne-t-elle au téléphone ? La veille le demande avant de prévenir. */
  sonne(cle: CleDeRegle): boolean {
    return sonneAuTelephone(cle, this.reglages)
  }

  /** Les règles neuves ouvertes, pour « À traiter » : les autres y ont déjà leur ligne. */
  aTraiter(): AlerteATraiter[] {
    return REGLES_NEUVES_A_TRAITER.flatMap(cle => {
      const o = this.ouvertes.get(cle)
      return o && o.calmeDepuis === null ? [{ cle, cause: o.cause, depuis: o.debut }] : []
    })
  }

  /**
   * Un tour : chaque règle jugée, les incidents ouverts et refermés, les
   * téléphones prévenus. Un tour à la fois — une lecture qui traîne n'en
   * empile pas — et sous son propre filet : une base qui se tait ne fait pas
   * tomber le serveur, l'alerte vit en mémoire.
   */
  async tour(): Promise<void> {
    if (this.enRoute) return
    this.enRoute = true
    try {
      const releve = await this.deps.lire()
      const maintenant = releve.maintenant
      const dites = reglesOuvertes(releve, this.reglages, this.defauts)
      for (const [cle, cause] of dites) {
        const deja = this.ouvertes.get(cle)
        if (deja) {
          deja.calmeDepuis = null
          deja.cause = cause
          continue
        }
        const o: Ouverte = { id: null, debut: maintenant, cause, calmeDepuis: null }
        this.ouvertes.set(cle, o)
        try {
          const r = await this.enFile(() =>
            this.client.execute({ sql: 'INSERT INTO qg_incidents (regle, gravite, debut, cause) VALUES (?, ?, ?, ?)', args: [cle, REGLE[cle].gravite, maintenant, cause] }),
          )
          o.id = r.lastInsertRowid === undefined ? null : Number(r.lastInsertRowid)
        } catch (e) {
          console.warn(`[alertes] l’incident « ${REGLE[cle].nom} » ne s’écrit pas :`, e instanceof Error ? e.message : e)
        }
        if (cle !== 'panne' && this.sonne(cle)) this.deps.prevenir(messageDOuverture(cle, cause))
      }
      for (const [cle, o] of [...this.ouvertes]) {
        if (dites.has(cle)) continue
        o.calmeDepuis ??= maintenant
        if (maintenant - o.calmeDepuis < CALME_POUR_CLORE_MS) continue
        this.ouvertes.delete(cle)
        if (o.id !== null) {
          const id = o.id
          await this.enFile(() => this.client.execute({ sql: 'UPDATE qg_incidents SET fin = ? WHERE id = ? AND fin IS NULL', args: [o.calmeDepuis, id] })).catch(e =>
            console.warn(`[alertes] l’incident « ${REGLE[cle].nom} » ne se referme pas :`, e instanceof Error ? e.message : e),
          )
        }
        if (cle !== 'panne' && this.sonne(cle)) this.deps.prevenir(messageDeRetour(cle))
      }
    } catch (e) {
      console.warn('[alertes] les règles ne se jugent pas :', e instanceof Error ? e.message : e)
    } finally {
      this.enRoute = false
    }
  }

  /**
   * Un réglage changé : relu par sa règle (`lireLeReglage`), refusé s'il ne
   * change rien — le journal ne note que ce qui change —, écrit, puis tenu en
   * mémoire. Rend ce qu'il était et ce qu'il devient, pour la phrase du journal.
   */
  async regler(cle: CleDeRegle, brut: unknown): Promise<{ avant: ReglageDUneRegle; apres: ReglageDUneRegle }> {
    return this.enFile(async () => {
      const avant = this.reglages[cle] ?? {}
      const apres = lireLeReglage(cle, brut, avant, this.defauts)
      if (JSON.stringify(avant) === JSON.stringify(apres)) throw new Error('Ce réglage est déjà celui-là.')
      if (Object.keys(apres).length === 0) await this.client.execute({ sql: 'DELETE FROM qg_reglages WHERE cle = ?', args: [cle] })
      else
        await this.client.execute({
          sql: 'INSERT INTO qg_reglages (cle, valeur, maj_le) VALUES (?, ?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur, maj_le = excluded.maj_le',
          args: [cle, JSON.stringify(apres), this.now()],
        })
      if (Object.keys(apres).length === 0) delete this.reglages[cle]
      else this.reglages[cle] = apres
      return { avant, apres }
    })
  }

  /** Le mot d'un incident, comme celui d'une erreur triée : 120 caractères au plus, refusé plus long — jamais coupé. Vide, il s'efface. */
  async noterUnMot(id: number, brut: unknown): Promise<IncidentDuQg | null> {
    if (typeof brut !== 'string') throw new Error('Un mot attendu.')
    const mot = brut.trim()
    if ([...mot].length > MOT_D_UN_INCIDENT_MAX) throw new Error(`Un mot de ${MOT_D_UN_INCIDENT_MAX} caractères au plus.`)
    return this.enFile(async () => {
      const r = await this.client.execute({ sql: 'UPDATE qg_incidents SET mot = ? WHERE id = ? RETURNING id, regle, gravite, debut, fin, cause, mot', args: [mot || null, id] })
      const l = r.rows[0]
      return l ? incidentLu(l) : null
    })
  }

  /** La page des alertes : chaque règle, son réglage et son état ; les incidents des trente derniers jours, par leur index. */
  async page(telephones: number): Promise<PageDesAlertes> {
    const maintenant = this.now()
    const depuis = maintenant - JOURS_DES_INCIDENTS * 86_400_000
    const r = await this.client.execute({
      sql: 'SELECT id, regle, gravite, debut, fin, cause, mot FROM qg_incidents WHERE debut >= ? OR fin IS NULL ORDER BY debut DESC',
      args: [depuis],
    })
    const incidents = r.rows.map(incidentLu).filter((i): i is IncidentDuQg => i !== null)
    return {
      maintenant,
      regles: CLES_DES_REGLES.map(cle => {
        const o = this.ouvertes.get(cle)
        return {
          cle,
          seuil: seuilDe(cle, this.reglages, this.defauts),
          defaut: defautDe(cle, this.defauts),
          telephone: this.sonne(cle),
          ouverte: o && o.calmeDepuis === null ? { depuis: o.debut, cause: o.cause } : null,
          derniere: incidents.find(i => i.regle === cle)?.debut ?? null,
        }
      }),
      incidents,
      telephones,
    }
  }

  /** « Seuil de « Ressenti dégradé » : 900 ms (avant 800 ms) » : la phrase d'un réglage, pour le journal. */
  static phraseDuReglage(cle: CleDeRegle, avant: ReglageDUneRegle, apres: ReglageDUneRegle, defauts: DefautsDesSeuils = {}): string {
    const regle = REGLE[cle]
    const morceaux: string[] = []
    const seuilAvant = avant.seuil ?? defautDe(cle, defauts) ?? undefined
    const seuilApres = apres.seuil ?? defautDe(cle, defauts) ?? undefined
    if (regle.seuil && seuilAvant !== seuilApres && seuilApres !== undefined && seuilAvant !== undefined) {
      morceaux.push(`seuil ${seuilEcrit(cle, seuilApres)} (avant ${seuilEcrit(cle, seuilAvant)})`)
    }
    const telAvant = avant.telephone ?? regle.telephone
    const telApres = apres.telephone ?? regle.telephone
    if (telAvant !== telApres) morceaux.push(telApres ? 'sonne au téléphone' : 'ne sonne plus au téléphone')
    return `Alerte réglée : ${regle.nom} — ${morceaux.join(', ')}`
  }

  close() {
    this.arreter()
    this.client.close()
  }
}

/**
 * Les versions ne se relisent qu'une fois l'heure : la page du serveur sur sept jours lit toute la semaine. La dernière
 * sauvegarde et les heures de l'hébergeur de même : elles se jugent en jours.
 */
const VERSIONS_GARDEES_MS = 3_600_000

/**
 * Ce qu'une lecture à l'heure garde : sa valeur, et quand. Une lecture qui
 * échoue garde la précédente et se refait au tour suivant — sans quoi un
 * hoquet de Turso aurait refermé l'incident d'une sauvegarde ancienne.
 */
function alHeure<T>(lire: () => Promise<T>): (maintenant: number) => Promise<T | undefined> {
  let gardee: { le: number; valeur: T } | null = null
  return async maintenant => {
    if (gardee && maintenant - gardee.le <= VERSIONS_GARDEES_MS) return gardee.valeur
    try {
      gardee = { le: maintenant, valeur: await lire() }
    } catch (e) {
      console.warn('[alertes] une lecture à l’heure ne se fait pas :', e instanceof Error ? e.message : e)
    }
    return gardee?.valeur
  }
}

/**
 * Ce que les règles lisent, composé de ce que le serveur sait déjà : la
 * santé du serveur (ses alertes, gardées par elle ; ses versions, une fois
 * l'heure), le direct en mémoire (le ressenti sur dix minutes, les requêtes
 * sur un quart d'heure, le pire gel de la minute, ce qui s'est joué le soir),
 * le miroir, la réserve du quiz du jour (une lecture par ses questions
 * prêtes), la dernière tournée du rappel ; et une fois l'heure, la dernière
 * sauvegarde (une ligne, par son index) et les heures de l'hébergeur (les
 * démarrages des huit jours gardés, et les jours plus anciens du mois que la
 * mémoire du QG sait). Rien d'autre vers Turso.
 */
export function lecteurDesAlertes(d: {
  alertes: (memoireMo: number | null) => Promise<AlertesDuServeur>
  versions: () => Promise<PageDuServeur['versions']>
  direct: Pick<DirectDuServeur, 'lire' | 'jeuEntre'>
  miroir: () => { enEchecDepuis: string | null; espacesEnRetard: number } | null
  reserve: () => Promise<{ joursDAvance: number } | null>
  rappel: () => { envoyes: number; echecs: number } | null
  memoireMo: () => number | null
  version: string | null
  maintenant?: () => number
  /** La dernière sauvegarde notée (`qg_sauvegardes`) ; null, jamais une. */
  sauvegarde?: () => Promise<number | null>
  /** Les heures éveillées de ce service ce mois-ci (`heuresDeLHebergeur`). */
  hebergeur?: () => Promise<HeuresDeLHebergeur | null>
}): () => Promise<ReleveDesAlertes> {
  let versions: { le: number; ralenties: ReleveDesAlertes['ralenties'] } | null = null
  const sauvegarde = d.sauvegarde && alHeure(d.sauvegarde)
  const hebergeur = d.hebergeur && alHeure(d.hebergeur)
  return async () => {
    const maintenant = (d.maintenant ?? Date.now)()
    const memoireMo = d.memoireMo()
    if (!versions || maintenant - versions.le > VERSIONS_GARDEES_MS) {
      // Seule la version qui tourne se juge : celle d'avant a fini de ralentir.
      const lues = await d.versions().catch(() => [])
      versions = { le: maintenant, ralenties: lues[0] && d.version && lues[0].version === d.version ? lues[0].ralenties : [] }
    }
    const [derniereSauvegarde, heures] = await Promise.all([sauvegarde?.(maintenant), hebergeur?.(maintenant)])
    const [a, reserve] = await Promise.all([d.alertes(memoireMo), d.reserve().catch(() => null)])
    const { points, enCours } = d.direct.lire()
    const tous = [...points, enCours]
    const dixMinutes = tous.slice(-60)
    const unQuart = tous.slice(-90)
    const uneMinute = tous.slice(-6)
    const appels = dixMinutes.reduce((n, p) => n + (p.routes?.n ?? 0), 0)
    // Le 95ᵉ centile de dix minutes : celui de chaque pas, pondéré par ses appels — comme celui d'une semaine (`cumulsDesRoutes`).
    const ressenti = appels > 0 ? { p95: Math.round(dixMinutes.reduce((s, p) => s + (p.routes ? p.routes.p95 * p.routes.n : 0), 0) / appels), appels } : null
    const gel = Math.max(0, ...uneMinute.map(p => p.boucleMaxMs ?? 0))
    // Le soir se juge de 22 h à minuit, sur 19 h - 22 h, si le serveur l'a écouté tout du long.
    const minutes = minutesDeParis(maintenant)
    let soir: ReleveDesAlertes['soir'] = null
    if (minutes >= 22 * 60) {
      const debut = maintenant - (maintenant % 60_000) - (minutes - 19 * 60) * 60_000
      const joue = d.direct.jeuEntre(debut, debut + 3 * 3_600_000)
      soir = joue === null ? null : { joue }
    }
    const miroir = d.miroir()
    return {
      maintenant,
      pannes: a.pannes,
      arretNet: a.arretNet,
      erreurs: a.erreurs && { n: a.erreurs.n, source: a.erreurs.source },
      turso: a.tursoLent && { p95: a.tursoLent.p95 },
      memoireMo,
      quotaPart: a.quota?.part ?? null,
      ressenti,
      requetes: { n: unQuart.reduce((n, p) => n + p.requetes, 0), enErreur: unQuart.reduce((n, p) => n + p.enErreur, 0) },
      gelMs: gel > 0 ? gel : null,
      miroir: miroir && { enEchecDepuis: miroir.enEchecDepuis, espacesEnRetard: miroir.espacesEnRetard },
      reserveJours: reserve?.joursDAvance ?? null,
      rappel: d.rappel(),
      soir,
      ralenties: versions.ralenties,
      // Pas encore lue (une base muette au premier tour) : rien ne se juge — ni « jamais sauvegardé » par erreur.
      ...(derniereSauvegarde !== undefined && { sauvegarde: { derniere: derniereSauvegarde } }),
      ...(heures !== undefined && { hebergeur: heures && { faites: heures.faites, projetees: heures.projetees } }),
    }
  }
}

/**
 * Les heures éveillées de ce service ce mois-ci, au rythme de la semaine : les
 * jours du mois de Paris jusqu'à aujourd'hui, ceux que les démarrages gardés
 * couvrent lus sur eux, les plus anciens dans la mémoire du QG (`qg_jours`) —
 * un mois a au plus trente et une lignes —, le reste au rythme (`heuresDuMois`).
 */
export async function heuresDeLHebergeur(d: {
  demarrages: () => Promise<DemarrageDuServeur[]>
  /** Les heures éveillées des jours finis que la mémoire sait, depuis un jour ; null, elle ne le sait pas. */
  heuresDesJours: (depuis: string) => Promise<ReadonlyMap<string, number | null>>
  courant: string
  maintenant: number
}): Promise<HeuresDeLHebergeur> {
  const aujourdhui = jourDe(d.maintenant)
  const premier = `${aujourdhui.slice(0, 8)}01`
  const [annee, mois] = aujourdhui.split('-').map(Number)
  const premierDuSuivant = jourDe(Date.UTC(annee, mois, 1, 12))
  const [demarrages, memoire] = await Promise.all([d.demarrages(), d.heuresDesJours(premier)])
  const jours: { debut: number; fin: number; heures: number | null }[] = []
  for (let j = premier; j <= aujourdhui; j = jourAvant(j, -1)) {
    jours.push({ debut: minuitDuJour(j), fin: j === aujourdhui ? d.maintenant : minuitDuJour(jourAvant(j, -1)), heures: memoire.get(j) ?? null })
  }
  return heuresDuMois({ demarrages, maintenant: d.maintenant, courant: d.courant, finDuMois: minuitDuJour(premierDuSuivant), jours })
}

function incidentLu(l: Record<string, unknown>): IncidentDuQg | null {
  const regle = String(l.regle)
  if (!estUneRegle(regle)) return null
  const gravite = String(l.gravite)
  return {
    id: Number(l.id),
    regle,
    gravite: gravite === 'critique' || gravite === 'serieux' || gravite === 'veille' ? gravite : REGLE[regle].gravite,
    debut: Number(l.debut),
    fin: l.fin === null || l.fin === undefined ? null : Number(l.fin),
    cause: String(l.cause),
    mot: typeof l.mot === 'string' && l.mot ? l.mot : null,
  }
}
