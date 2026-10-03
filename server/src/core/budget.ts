/**
 * Un seau à jetons par clé — une adresse, un identifiant… : `burst` essais
 * d'un coup, puis `refillPerMinute` qui reviennent au fil du temps. Les
 * inscriptions des invités passaient déjà par là ; la connexion des
 * animateurs s'en sert aussi.
 *
 * Mesuré avant ces limites : 200 inscriptions en moins d'une seconde depuis
 * une même adresse, et 41 000 clés par seconde testables sur une connexion.
 */
export const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export class Budget {
  private buckets = new Map<string, { tokens: number; at: number }>()

  constructor(
    private burst: number,
    private refillPerMinute: number,
    /** Les tests et les essais à la maison passent par l'adresse locale, sans limite. */
    private opts: { skipLoopback?: boolean } = {},
  ) {}

  take(key: string, cost = 1): boolean {
    if (this.opts.skipLoopback && LOOPBACK.has(key)) return true
    const now = Date.now()
    const b = this.buckets.get(key) ?? { tokens: this.burst, at: now }
    b.tokens = Math.min(this.burst, b.tokens + ((now - b.at) / 60_000) * this.refillPerMinute)
    b.at = now
    const ok = b.tokens >= cost
    if (ok) b.tokens -= cost
    this.buckets.set(key, b)
    if (this.buckets.size > 2000) this.prune(now)
    return ok
  }

  /**
   * Vrai s'il reste de quoi payer `cost`, sans rien prendre : un code de
   * salon ne se cherche pas quand l'adresse a épuisé ses essais — sinon le
   * bon code, trouvé au bout de la liste, passerait quand même.
   */
  peut(key: string, cost = 1): boolean {
    if (this.opts.skipLoopback && LOOPBACK.has(key)) return true
    const b = this.buckets.get(key)
    if (!b) return this.burst >= cost
    return Math.min(this.burst, b.tokens + ((Date.now() - b.at) / 60_000) * this.refillPerMinute) >= cost
  }

  /** Remet une clé à neuf — après une connexion réussie, par exemple. */
  forget(key: string) {
    this.buckets.delete(key)
  }

  private prune(now: number) {
    for (const [key, b] of this.buckets) if (now - b.at > 10 * 60_000) this.buckets.delete(key)
  }
}
