import { createHash } from 'node:crypto'
import { gzip } from 'node:zlib'
import { promisify } from 'node:util'
import { performance } from 'node:perf_hooks'
import type { Request, Response } from 'express'
import { pouls } from './pouls'

// Les pages publiques d'un espace — le souvenir et le bilan, de la soirée en
// cours comme d'une soirée archivée —, calculées une fois pour toute la salle.
//
// Le QR du podium et celui de la clôture y mènent toute la salle d'un coup,
// et chaque requête recalculait tout : cinquante scans d'une soirée de 150
// invités × 40 questions demandaient 3,7 s de processeur, soit 32 s de
// serveur figé au dixième de cœur de l'hébergeur — pour TOUS les espaces.
// Désormais, la page se garde sous une empreinte des journaux dont elle se
// dérive, et la première requête d'une rafale calcule pendant que les autres
// attendent sa promesse : cinquante requêtes, un calcul, une compression.
//
// Les dérivations restent pures et partagées (invariant 14) : on ne garde
// que leur résultat. La place porte toujours l'espace (invariant 3) : une
// empreinte oubliée montrerait une page en retard, jamais celle d'un autre.

const gzipAsync = promisify(gzip)

/** Au-delà, une page se dit au journal : c'est elle qui fige la soirée des autres. */
const PAGE_LENTE_MS = 500

/**
 * Ce que gardent toutes les pages ensemble, au plus. Le bilan d'une soirée de
 * 150 invités × 40 questions pèse quelques Mo en clair : de quoi tenir une
 * poignée de grandes soirées, loin des 512 Mo de l'offre gratuite.
 */
const OCTETS_MAX = 48 * 1024 * 1024

/** Un corps de page tel qu'il part : le JSON, et sa version compressée, faite une fois et à part de la boucle. */
class Corps {
  private gz: Promise<Buffer> | null = null
  /**
   * Posée d'avance : sans elle, Express hachait le corps entier à chaque
   * envoi pour en tirer la sienne — quelques Mo par scan.
   */
  readonly etag: string
  constructor(readonly brut: Buffer) {
    this.etag = `W/"${brut.length.toString(16)}-${createHash('sha1').update(brut).digest('base64url').slice(0, 27)}"`
  }

  compresse(): Promise<Buffer> {
    // zlib travaille dans le pool de libuv : la boucle continue de servir
    // les soirées pendant qu'on compresse un bilan de plusieurs Mo.
    return (this.gz ??= gzipAsync(this.brut))
  }
}

interface Entree {
  empreinte: string
  provisoire: boolean
  expire: number
  /** Null : rien à montrer (une soirée archivée introuvable) — et rien de gardé. */
  corps: Promise<Corps | null>
  octets: number
}

export interface DemandeDePage {
  /** Où se range la page : l'espace, la sorte de page, la soirée. Jamais sans l'espace. */
  place: string
  /** Ce dont la page se dérive : deux empreintes égales donnent la même page. */
  empreinte: string
  /** Au-delà, la page se recalcule quand même : ce que l'empreinte ne voit pas (un niveau monté) finit par y paraître. */
  dureeMs: number
  /** Pour le journal : « souvenir en cours », « bilan archivé »… Jamais un nom. */
  sorte: string
  /**
   * Le calcul lui-même. Null : 404. `provisoire()` sert la page à qui
   * l'attend sans la garder : une base distante muette l'a privée d'une
   * partie, la requête suivante réessaiera.
   */
  calculer: (provisoire: () => void) => Promise<object | null>
}

export class PagesPubliques {
  /** Dans l'ordre d'usage : la plus ancienne part la première quand la place manque. */
  private entrees = new Map<string, Entree>()
  private octets = 0

  constructor(private readonly octetsMax = OCTETS_MAX) {}

  private oublier(place: string) {
    const e = this.entrees.get(place)
    if (!e) return
    this.octets -= e.octets
    this.entrees.delete(place)
  }

  /** La page de cette place, calculée ou reprise — la même promesse pour toute la rafale. */
  private obtenir(d: DemandeDePage): Promise<Corps | null> {
    const deja = this.entrees.get(d.place)
    if (deja && deja.empreinte === d.empreinte && deja.expire > Date.now()) {
      // Remise en fin de file : la place la plus demandée reste.
      this.entrees.delete(d.place)
      this.entrees.set(d.place, deja)
      return deja.corps
    }
    this.oublier(d.place)
    const entree: Entree = {
      empreinte: d.empreinte,
      provisoire: false,
      expire: Date.now() + d.dureeMs,
      octets: 0,
      corps: null!,
    }
    entree.corps = this.fabriquer(d, () => (entree.provisoire = true)).then(
      corps => {
        // Une page plus récente a pu prendre la place entre-temps : on ne
        // compte que celle qui y est encore.
        if (this.entrees.get(d.place) !== entree) return corps
        if (!corps || entree.provisoire) {
          this.oublier(d.place)
          return corps
        }
        entree.octets = corps.brut.length
        this.octets += entree.octets
        for (const [place, e] of this.entrees) {
          if (this.octets <= this.octetsMax || place === d.place) break
          this.oublier(place)
        }
        return corps
      },
      (e: unknown) => {
        // Une panne ne se garde pas : la requête suivante réessaie.
        if (this.entrees.get(d.place) === entree) this.oublier(d.place)
        throw e
      },
    )
    this.entrees.set(d.place, entree)
    return entree.corps
  }

  private async fabriquer(d: DemandeDePage, provisoire: () => void): Promise<Corps | null> {
    pouls.calculsDePage++
    const debut = performance.now()
    const page = await d.calculer(provisoire)
    const corps = page ? new Corps(Buffer.from(JSON.stringify(page))) : null
    const ms = performance.now() - debut
    pouls.pagesCalculees.noter(ms)
    if (ms > PAGE_LENTE_MS) {
      console.warn(
        `[pages] ${d.sorte} calculé en ${Math.round(ms)} ms — ${Math.round((corps?.brut.length ?? 0) / 1024)} Ko`,
      )
    }
    return corps
  }

  /**
   * Sert la page : gardée si elle tient encore, calculée sinon — une seule
   * fois pour toutes les requêtes qui arrivent pendant le calcul. Compressée
   * ici, une fois pour toutes : `compression()` laisse passer une réponse
   * déjà encodée.
   */
  async servir(req: Request, res: Response, d: DemandeDePage): Promise<void> {
    pouls.pagesServies.noter()
    const corps = await this.obtenir(d)
    if (!corps) {
      res.status(404).json({ error: 'Soirée introuvable' })
      return
    }
    res.type('json')
    res.vary('Accept-Encoding')
    // Express répond alors 304 à qui a déjà cette page.
    res.set('ETag', corps.etag)
    if (corps.brut.length > 1024 && req.acceptsEncodings('gzip', 'identity') === 'gzip') {
      const gz = await corps.compresse()
      res.set('Content-Encoding', 'gzip')
      res.send(gz)
      return
    }
    res.send(corps.brut)
  }

  /** Pour `/healthz` : combien de pages gardées, et leur poids. */
  etat() {
    return { gardees: this.entrees.size, octets: this.octets }
  }
}
