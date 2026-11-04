import type { Request, Response } from 'express'
import { pouls, releve } from './core/pouls'
import type { DirectDuQg, SoireeDuQg } from '../../shared/qg'
import type { PlafondsDuConteneur } from '../../shared/santeDuServeur'
import { ENVOI_DU_FLUX_MS, evenementsDesSoirees, type MessageDuFlux, type RouteDuDirect } from '../../shared/qgDirect'

/** Une page du QG abonnée au flux, et où elle en est : ses pas, son fil, ce qu'elle a du direct et des routes. */
interface Abonne {
  res: Response
  dernierPoint: number
  dernierRang: number
  /** Le direct qu'elle a — ce qui en change d'un geste : ses soirées, ses invités, le miroir —, et quand il est parti. */
  direct: string | null
  directEnvoyeLe: number
  routes: string | null
  premier: boolean
}

/** Le direct repart au moins toutes les dix secondes : la mémoire et le processeur du poste de commande suivent. */
const DIRECT_AU_PLUS_TARD_MS = 10_000

/** Les routes de la dernière minute, la plus coûteuse au serveur d'abord — ses appels fois sa médiane, comme la table du serveur. */
function routesDeLaMinute(): RouteDuDirect[] {
  return Object.entries(pouls.lireRoutes())
    .map(([route, r]) => ({ route, parMin: r.parMin, p50: Math.round(r.p50Ms), p95: Math.round(r.p95Ms), max: Math.round(r.maxMs) }))
    .sort((a, b) => b.parMin * b.p50 - a.parMin * a.p50 || b.parMin - a.parMin || (a.route < b.route ? -1 : 1))
}

/**
 * Le flux du direct du QG (`GET /api/admin/flux`, `text/event-stream`, le QG
 * 2, lot 3 ; « le direct par un flux », la recommandation suivie le 4
 * novembre 2026) : toutes les deux secondes, à chaque page abonnée, ce qui a
 * changé depuis son message d'avant — les pas de dix secondes finis, le pas
 * en cours, le fil, et le direct du poste de commande et les routes de la
 * minute s'ils ont bougé. Une connexion par onglet, que la page ferme quand
 * elle se cache : rien ne tourne sans abonné, et rien ne va à Turso — le
 * direct se lit en mémoire et dans la base locale, comme avant, sans les dix
 * secondes d'attente.
 *
 * Le serveur le referme à sa fermeture (`fermer`) : une réponse ouverte
 * retiendrait sa fermeture, et le miroir qui se vide derrière elle.
 */
export class FluxDuQg {
  private abonnes = new Set<Abonne>()
  private minuterie: ReturnType<typeof setInterval> | null = null
  private soireesAvant: SoireeDuQg[] | null = null
  private enRoute = false
  private ferme = false
  private lireLeDirect: (() => Promise<DirectDuQg>) | null = null

  constructor(private readonly opts: { envoiMs?: number; plafonds: PlafondsDuConteneur }) {}

  /** La route du QG le branche sur le direct du poste de commande. */
  brancher(lire: () => Promise<DirectDuQg>) {
    this.lireLeDirect = lire
  }

  /** Combien de pages l'écoutent : les tests le lisent. */
  get ecoutes(): number {
    return this.abonnes.size
  }

  ouvrir(req: Request, res: Response) {
    // Il dure ce que la page reste ouverte : ce n'est pas une attente (le minutage de `server.ts`).
    res.locals.auFilDuTemps = true
    if (this.ferme) {
      res.status(503).end()
      return
    }
    // `no-transform` : la compression le garderait pour elle jusqu'à en avoir assez à compresser.
    res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' })
    res.flushHeaders()
    req.socket.setNoDelay(true)
    // Coupé, le navigateur rouvre trois secondes après : un redémarrage, une mise en ligne.
    res.write('retry: 3000\n\n')
    const a: Abonne = { res, dernierPoint: 0, dernierRang: 0, direct: null, directEnvoyeLe: 0, routes: null, premier: true }
    this.abonnes.add(a)
    const fini = () => {
      this.abonnes.delete(a)
      if (this.abonnes.size === 0) this.arreterLaMinuterie()
    }
    req.on('close', fini)
    res.on('error', fini)
    if (!this.minuterie) {
      this.minuterie = setInterval(() => void this.tour(), this.opts.envoiMs ?? ENVOI_DU_FLUX_MS)
      this.minuterie.unref()
    }
    // Le premier message sans attendre le tour : la page s'ouvre sur l'état du serveur.
    void this.tour()
  }

  private arreterLaMinuterie() {
    if (this.minuterie) clearInterval(this.minuterie)
    this.minuterie = null
  }

  /**
   * Un tour : le direct lu une fois pour toutes les pages, ce qui a changé
   * dans les soirées passé au fil, puis chacune son message. Un tour à la
   * fois : un réveil de Turso qui tient une lecture n'en empile pas d'autres.
   */
  private async tour() {
    if (this.enRoute || this.abonnes.size === 0) return
    this.enRoute = true
    try {
      let direct: DirectDuQg | null = null
      try {
        direct = this.lireLeDirect ? await this.lireLeDirect() : null
      } catch (e) {
        // Le direct se tait le temps d'un tour ; les pas, le fil et les routes partent.
        console.warn('[qg] le direct du flux ne se lit pas :', e instanceof Error ? e.message : e)
      }
      if (direct) {
        if (this.soireesAvant) for (const fait of evenementsDesSoirees(this.soireesAvant, direct.soirees)) releve.direct.evenement(fait)
        this.soireesAvant = direct.soirees
      }
      const routes = routesDeLaMinute()
      for (const a of this.abonnes) this.envoyer(a, direct, routes)
    } finally {
      this.enRoute = false
    }
  }

  private envoyer(a: Abonne, direct: DirectDuQg | null, routes: RouteDuDirect[]) {
    const lu = releve.direct.lire(a.dernierPoint, a.dernierRang)
    const m: MessageDuFlux = { maintenant: Date.now(), points: lu.points, enCours: lu.enCours, fil: lu.fil }
    if (a.premier) {
      m.debut = true
      m.plafonds = this.opts.plafonds
    }
    if (direct) {
      // Le direct repart quand ses soirées, ses invités, ses profils en ligne ou son miroir changent, sinon toutes les
      // dix secondes, comme la relecture d'avant : sa mémoire, son processeur bougent à chaque tour, et les pas les
      // disent déjà à la seconde.
      const cle = JSON.stringify([direct.soirees, direct.invitesConnectes, direct.profilsEnLigne, direct.miroir])
      const maintenant = Date.now()
      if (cle !== a.direct || maintenant - a.directEnvoyeLe >= DIRECT_AU_PLUS_TARD_MS) {
        m.direct = direct
        a.direct = cle
        a.directEnvoyeLe = maintenant
      }
    }
    const cleDesRoutes = JSON.stringify(routes)
    if (cleDesRoutes !== a.routes) {
      m.routes = routes
      a.routes = cleDesRoutes
    }
    a.dernierPoint = lu.dernierPoint
    a.dernierRang = lu.dernierRang
    a.premier = false
    try {
      a.res.write(`event: flux\ndata: ${JSON.stringify(m)}\n\n`)
    } catch {
      this.abonnes.delete(a)
    }
  }

  /** La fermeture du serveur : chaque page coupée, plus un tour. Elle rouvrira sur le serveur suivant. */
  fermer() {
    this.ferme = true
    this.arreterLaMinuterie()
    for (const a of this.abonnes) a.res.end()
    this.abonnes.clear()
  }
}
