import { CHEMIN_DU_FLUX, FLUX_MUET_MS, fluxVide, recevoirLeFlux, type EtatDuFlux, type MessageDuFlux } from '../../shared/qgDirect'

/**
 * Le flux du direct du QG (`GET /api/admin/flux`, le QG 2, lot 3), écouté
 * tant qu'une page du QG le demande et que l'onglet est visible : ouvert à
 * l'affichage, fermé quand l'onglet se cache — rien ne tourne au serveur sans
 * une page qui écoute —, rouvert au retour. Un magasin hors de React
 * (`useSyncExternalStore`) : le poste de commande ne se redessine que quand
 * le direct change, la page « En direct » à chaque message.
 *
 * Muet plus de `FLUX_MUET_MS` — un proxy qui retient les réponses, un réseau
 * qui tombe —, il se dit coupé (`vivant`) : la page relit le direct toutes
 * les dix secondes comme avant, et le flux se rouvre, de plus en plus
 * rarement s'il ne revient pas.
 */
class FluxDuQgClient {
  private etat: EtatDuFlux = fluxVide()
  private vivant = false
  private ecouteurs = new Set<() => void>()
  private source: EventSource | null = null
  private dernier = 0
  private guet: ReturnType<typeof setInterval> | null = null
  private demandes = 0
  private echecs = 0

  readonly abonner = (f: () => void) => {
    this.ecouteurs.add(f)
    return () => {
      this.ecouteurs.delete(f)
    }
  }

  readonly lire = () => this.etat
  readonly estVivant = () => this.vivant

  private dire() {
    for (const f of this.ecouteurs) f()
  }

  private poserVivant(oui: boolean) {
    if (this.vivant === oui) return
    this.vivant = oui
    this.dire()
  }

  /** Une page qui veut le direct : le flux s'ouvre à la première, se ferme après la dernière. Rend de quoi s'en aller. */
  demarrer(): () => void {
    this.demandes++
    if (this.demandes === 1 && typeof EventSource !== 'undefined' && typeof document !== 'undefined') {
      this.ouvrir()
      document.addEventListener('visibilitychange', this.visibilite)
      this.guet = setInterval(this.guetter, FLUX_MUET_MS)
    }
    return () => {
      this.demandes--
      if (this.demandes > 0) return
      if (this.guet) clearInterval(this.guet)
      this.guet = null
      document.removeEventListener('visibilitychange', this.visibilite)
      this.fermer()
    }
  }

  private ouvrir() {
    if (this.source || document.visibilityState !== 'visible') return
    const source = new EventSource(CHEMIN_DU_FLUX)
    this.source = source
    source.addEventListener('flux', e => {
      let m: MessageDuFlux
      try {
        m = JSON.parse((e as MessageEvent<string>).data) as MessageDuFlux
      } catch {
        return
      }
      this.dernier = Date.now()
      this.echecs = 0
      this.etat = recevoirLeFlux(this.etat, m)
      this.vivant = true
      this.dire()
    })
    // Refusé — une session perdue, un serveur qui s'éteint —, le navigateur ne rouvre plus : le guet s'en charge.
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED && this.source === source) this.source = null
    }
  }

  private fermer() {
    this.source?.close()
    this.source = null
  }

  private readonly visibilite = () => {
    if (document.visibilityState === 'visible') this.ouvrir()
    else this.fermer()
  }

  /** Muet trop longtemps : coupé. Il se rouvre aux trois premiers tours, puis un sur huit — une minute. */
  private readonly guetter = () => {
    if (Date.now() - this.dernier <= FLUX_MUET_MS) return
    this.poserVivant(false)
    if (document.visibilityState !== 'visible') return
    this.echecs++
    if (this.echecs > 3 && this.echecs % 8 !== 0) return
    this.fermer()
    this.ouvrir()
  }
}

export const fluxDuQg = new FluxDuQgClient()
