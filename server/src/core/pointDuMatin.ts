import { clientDistant, type Client } from './distante'
import { jourAvant, jourDe, minutesDeParis } from '../../../shared/jour'
import { minuitDuJour, type ChiffresDUnJour } from '../../../shared/qgJoueurs'
import { FIN_DU_POINT, JOURS_DU_POINT, jourDuPoint, messageDuPoint, pointDuMatin, type EntreeDuPoint, type EtatDuPoint, type HierDuQg, type PointRegle } from '../../../shared/pointDuMatin'
import type { MessageDuQg } from '../../../shared/pannes'
import type { IncidentDuQg } from '../../../shared/qgAlertes'

/** Le point regarde l'heure chaque minute, comme le rappel du soir. */
export const TOUR_DU_POINT_MS = 60_000

/** Raté avant que rien ne parte — une base qui se tait —, il se refait cinq minutes plus tard, comme le rappel du soir. */
const RELANCE_DU_POINT_MS = 5 * 60_000

/** Les points passés se gardent deux mois : la page des alertes ne lit que le dernier. */
const JOURS_DES_POINTS = 60

/** Ce que le QG branche sur le point, une fois ses routes montées (`mountQg`) : ce qui attend un geste, et le nom des salons. */
export interface BranchementDuPoint {
  /** Les lignes de « À traiter », comptées comme le poste de commande les liste (`lesChosesATraiter`). */
  choses: () => Promise<number>
  /** Le nom de quelques salons (`lesSalons`) : la page les montre, la notification jamais. */
  salons: (spaceIds: readonly string[]) => Promise<Map<string, string>>
}

export interface DepsDuPoint {
  /** Son réglage tel qu'il vaut (`ReglesDuQg.pointDuMatin`), et ce qui vaut d'office. */
  reglage: () => PointRegle
  dOffice: () => PointRegle
  /** La mémoire du QG à jour jusqu'à hier (`audienceDuQg.aJour`) : c'est son passage qui l'écrit. */
  aJour: () => Promise<void>
  /** La mémoire sait déjà la veille — le point est passé, ou la page des joueurs : en mémoire, sans rien lire. */
  memoireAJour: () => boolean
  /** Les chiffres des jours finis depuis un jour (`MemoireDuQg.joursDepuis`). */
  jours: (de: string) => Promise<ReadonlyMap<string, ChiffresDUnJour>>
  /** Les incidents qui ont couru entre deux instants (`ReglesDuQg.incidentsEntre`). */
  incidents: (debut: number, fin: number) => Promise<IncidentDuQg[]>
  /** Les téléphones de l'administrateur déjà prévenus des pannes (`AlertesDuQg.prevenir`). */
  prevenir: (m: MessageDuQg) => Promise<{ envoyes: number }>
  /** L'heure du serveur — celle du quiz du jour, que les tests avancent. */
  maintenant: () => number
  /** Le pas de son tour ; null, il ne tourne pas — le banc ne le lance que pour qui le demande. */
  tourMs?: number | null
}

/**
 * Le point du matin au serveur (la revue d'expert du 4 novembre 2026, P1.4 ;
 * sa dérivation, `shared/pointDuMatin.ts`) : chaque minute, s'il est l'heure
 * réglée (8 h 40 d'office), son passage écrit la mémoire de la veille
 * (`aJour` — elle ne dépend plus d'une visite de la page des joueurs), puis,
 * une seule fois par jour, la notification part aux téléphones de
 * l'administrateur : une réservation en base avant l'envoi (`qg_points`, une
 * ligne par jour), comme le rappel du soir (`jour_rappels.dernier_jour`) — un
 * redémarrage ou l'autre serveur d'une mise en ligne ne la renvoie pas. Il tient
 * aussi ce que le poste de commande lit de la veille (« Hier, en bref »), lu de
 * la mémoire une fois et gardé jusqu'à minuit.
 */
export class LePointDuMatin {
  private client: Client
  private minuterie: ReturnType<typeof setInterval> | null = null
  private enRoute: Promise<void> | null = null
  /** Le jour dont le point est passé ici : la réservation fait foi, ceci évite de la redemander chaque minute. */
  private faitPour: string | null = null
  private pasAvant = 0
  private ferme = false
  private branche: BranchementDuPoint | null = null
  /** La veille lue de la mémoire, gardée jusqu'à minuit : le poste de commande la redemande sans rien relire. */
  private veille: { aujourdhui: string; lue: Promise<EntreeDuPoint | null> } | null = null

  constructor(
    url: string,
    authToken: string | undefined,
    private deps: DepsDuPoint,
  ) {
    this.client = clientDistant(url, authToken)
  }

  /** Sa table, au démarrage de front (`deFront`, `server.ts`). */
  async init() {
    await this.client.execute(
      `CREATE TABLE IF NOT EXISTS qg_points (
         jour       TEXT PRIMARY KEY,
         reserve_le INTEGER NOT NULL,
         envoye_le  INTEGER,
         telephones INTEGER,
         corps      TEXT
       )`,
    )
  }

  brancher(b: BranchementDuPoint) {
    this.branche = b
  }

  /** Regarde l'heure à chaque tour, jusqu'à la fermeture. */
  demarrer() {
    if (this.minuterie || this.ferme || this.deps.tourMs === null) return
    this.minuterie = setInterval(() => void this.tour(), this.deps.tourMs ?? TOUR_DU_POINT_MS)
    // Une horloge ne retient pas un processus qu'on arrête.
    this.minuterie.unref()
  }

  arreter() {
    this.ferme = true
    if (this.minuterie) clearInterval(this.minuterie)
    this.minuterie = null
  }

  /** Le point s'il est l'heure et qu'il n'est pas passé — rend celui qui est en route, ou null s'il n'y a rien à faire. */
  tour(): Promise<void> | null {
    if (this.ferme) return null
    if (this.enRoute) return this.enRoute
    const maintenant = this.deps.maintenant()
    const aujourdhui = jourDe(maintenant)
    if (this.faitPour === aujourdhui || Date.now() < this.pasAvant) return null
    if (minutesDeParis(maintenant) < this.deps.reglage().minutes) return null
    this.enRoute = this.faire(aujourdhui, maintenant)
      .then(() => {
        this.faitPour = aujourdhui
      })
      .catch(e => {
        if (this.ferme) return
        this.pasAvant = Date.now() + RELANCE_DU_POINT_MS
        console.error('[point] le point du matin a échoué, il reprendra dans cinq minutes :', e)
      })
      .finally(() => {
        this.enRoute = null
      })
    return this.enRoute
  }

  private async faire(aujourdhui: string, maintenant: number): Promise<void> {
    // La mémoire de la veille d'abord, sur chaque serveur : une lecture si elle est déjà à jour — et c'est elle que le point raconte.
    await this.deps.aJour()
    const [reserve] = await this.client.batch(
      [
        { sql: 'INSERT INTO qg_points (jour, reserve_le) VALUES (?, ?) ON CONFLICT(jour) DO NOTHING', args: [aujourdhui, maintenant] },
        { sql: 'DELETE FROM qg_points WHERE jour < ?', args: [jourAvant(aujourdhui, JOURS_DES_POINTS)] },
      ],
      'write',
    )
    // Déjà passé : l'autre serveur d'une mise en ligne, ou celui-ci avant un redémarrage.
    if (reserve.rowsAffected === 0) return
    let parti = false
    try {
      // Coupé, ou passé midi : la mémoire est écrite, rien ne sonne.
      if (!this.deps.reglage().actif || minutesDeParis(this.deps.maintenant()) >= FIN_DU_POINT) return
      const entree = await this.lireLaVeille(aujourdhui)
      const choses = entree && this.branche ? await this.branche.choses().catch(() => null) : null
      // La mémoire ne sait rien d'hier : une base où personne n'a encore joué.
      const point = entree && pointDuMatin({ ...entree, aTraiter: choses })
      if (!point) return
      const message = messageDuPoint(point)
      const { envoyes } = await this.deps.prevenir(message)
      parti = true
      await this.client
        .execute({ sql: 'UPDATE qg_points SET envoye_le = ?, telephones = ?, corps = ? WHERE jour = ?', args: [this.deps.maintenant(), envoyes, message.corps, aujourdhui] })
        .catch(e => console.warn('[point] le point parti ne se note pas :', e instanceof Error ? e.message : e))
    } catch (e) {
      // Rien n'est parti : la réservation se rend, et le point se refait au tour d'après sa relance.
      if (!parti) await this.client.execute({ sql: 'DELETE FROM qg_points WHERE jour = ? AND envoye_le IS NULL', args: [aujourdhui] }).catch(() => {})
      throw e
    }
  }

  /** La veille telle que le point la lit, une fois la mémoire à jour : gardée jusqu'à minuit — elle ne bouge plus —, oubliée si la lecture échoue. */
  private lireLaVeille(aujourdhui: string): Promise<EntreeDuPoint | null> {
    if (this.veille?.aujourdhui === aujourdhui) return this.veille.lue
    const garde = { aujourdhui, lue: this.lire(aujourdhui) }
    this.veille = garde
    garde.lue.catch(() => {
      if (this.veille === garde) this.veille = null
    })
    return garde.lue
  }

  /** La mémoire de la veille et de ses semaines, ses incidents, le nom de ses salons : trente-cinq lignes et quelques incidents, par leurs clés. */
  private async lire(aujourdhui: string): Promise<EntreeDuPoint | null> {
    const hier = jourAvant(aujourdhui)
    const [jours, incidents] = await Promise.all([this.deps.jours(jourAvant(hier, JOURS_DU_POINT - 1)), this.deps.incidents(minuitDuJour(hier), minuitDuJour(aujourdhui))])
    const chiffres = jours.get(hier)
    if (!chiffres) return null
    const espaces = [...new Set((chiffres.soirees ?? []).map(s => s.espace))]
    const salons = espaces.length > 0 && this.branche ? await this.branche.salons(espaces) : new Map<string, string>()
    return {
      hier,
      jours: [...jours]
        .filter(([j]) => j <= hier)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([j, c]) => jourDuPoint(j, c)),
      incidents: incidents.map(i => ({ regle: i.regle, debut: i.debut, fin: i.fin })),
      salons: Object.fromEntries(salons),
    }
  }

  /**
   * « Hier, en bref » (`GET /api/admin/qg/hier`) : le réglage du point, et la
   * veille si la mémoire la sait — lue une fois, gardée jusqu'à minuit. Tant
   * qu'elle ne la sait pas, rien ne se lit : c'est le point qui l'écrit, à son
   * heure, ou la page des joueurs, à sa visite.
   */
  async hier(): Promise<HierDuQg> {
    const maintenant = this.deps.maintenant()
    const aujourdhui = jourDe(maintenant)
    const entree = this.veille?.aujourdhui === aujourdhui || this.deps.memoireAJour() ? await this.lireLaVeille(aujourdhui) : null
    return { maintenant, point: this.deps.reglage(), entree }
  }

  /** Ce que la page des alertes dit du point : son réglage, ce qui vaut d'office, et le dernier passé — une ligne, par sa clé. */
  async etat(): Promise<EtatDuPoint> {
    const lu = await this.client.execute('SELECT jour, envoye_le, telephones FROM qg_points ORDER BY jour DESC LIMIT 1')
    const l = lu.rows[0]
    return {
      ...this.deps.reglage(),
      dOffice: this.deps.dOffice(),
      dernier: l
        ? { jour: String(l.jour), envoyeLe: l.envoye_le === null || l.envoye_le === undefined ? null : Number(l.envoye_le), telephones: l.telephones === null || l.telephones === undefined ? null : Number(l.telephones) }
        : null,
    }
  }

  close() {
    this.arreter()
    this.client.close()
  }
}
