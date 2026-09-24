import { createHash, randomBytes } from 'node:crypto'
import { monitorEventLoopDelay, performance, type IntervalHistogram } from 'node:perf_hooks'

// Le pouls du serveur : ce que `/healthz` dit de la charge, pour savoir, sur
// l'hébergeur, si le serveur tient. Rien ne le disait : la tablée du 24
// septembre a mesuré au dixième de cœur ce qui cède d'abord, mais seule la
// production dira si ce dixième est un plafond strict.
//
// Trois règles, parce que la route est publique et que l'hébergeur la sonde :
// tout est agrégé, sans aucun nom ni adresse ; tout se lit en temps constant,
// sans parcourir de journal ; et rien ici ne peut faire échouer la réponse —
// un `/healthz` en échec, et Render redémarre l'instance, disque effacé.

/** Au-delà, un échantillon de minute ne grandit plus : il se renouvelle au hasard. */
const ECHANTILLON = 200

interface Seau {
  n: number
  max: number
  valeurs: number[]
}

const seauVide = (): Seau => ({ n: 0, max: 0, valeurs: [] })

/**
 * Une grandeur suivie sur la dernière minute : combien de fois, la pire, et
 * un 95ᵉ centile tiré d'un échantillon borné. Deux seaux d'une minute — le
 * courant et le précédent — : la lecture couvre donc entre une et deux
 * minutes, sans jamais garder plus de deux cents valeurs chacun.
 */
export class Fenetre {
  private courant = seauVide()
  private precedent = seauVide()
  private debut: number

  constructor(private readonly now: () => number = Date.now) {
    this.debut = now()
  }

  private tourner() {
    const t = this.now()
    if (t - this.debut < 60_000) return
    // Plus de deux minutes sans rien : le précédent aussi est périmé.
    this.precedent = t - this.debut < 120_000 ? this.courant : seauVide()
    this.courant = seauVide()
    this.debut = t - ((t - this.debut) % 60_000)
  }

  noter(valeur = 0) {
    this.tourner()
    const s = this.courant
    s.n++
    if (valeur > s.max) s.max = valeur
    if (s.valeurs.length < ECHANTILLON) s.valeurs.push(valeur)
    else {
      // L'échantillonnage en réservoir : chaque valeur de la minute a la même
      // chance d'y rester, quelle que soit sa place.
      const i = Math.floor(Math.random() * s.n)
      if (i < ECHANTILLON) s.valeurs[i] = valeur
    }
  }

  lire(): { n: number; max: number; p95: number } {
    this.tourner()
    const valeurs = [...this.precedent.valeurs, ...this.courant.valeurs].sort((a, b) => a - b)
    const p95 = valeurs.length ? valeurs[Math.min(valeurs.length - 1, Math.floor(valeurs.length * 0.95))] : 0
    return {
      n: this.precedent.n + this.courant.n,
      max: Math.round(Math.max(this.precedent.max, this.courant.max)),
      p95: Math.round(p95),
    }
  }
}

/**
 * Les adresses vues par la réserve d'inscriptions, sous une empreinte salée
 * au démarrage : le journal peut dire « la même adresse » sans l'écrire.
 */
const SEL = randomBytes(8)
function empreinteDAdresse(adresse: string): string {
  return createHash('sha256').update(SEL).update(adresse).digest('hex').slice(0, 8)
}

/** Au-delà, un espace ne retient plus de nouvelle adresse : le compte reste un ordre de grandeur. */
const ADRESSES_PAR_ESPACE = 2_000

/**
 * Les compteurs que les modules nourrissent : un seul par processus, comme
 * le processeur qu'ils décrivent.
 */
class Pouls {
  /** Le temps de calcul d'une page publique — souvenir ou bilan. */
  readonly pagesCalculees = new Fenetre()
  /** Les pages publiques servies, calculées ou reprises. */
  readonly pagesServies = new Fenetre()
  /** Combien de ms un chronomètre de partie a sonné après son échéance. */
  readonly chronos = new Fenetre()
  /** La durée d'un envoi au miroir, dans la base distante. */
  readonly miroir = new Fenetre()
  /** Les réponses d'invités refusées pour « trop tard ». */
  readonly tropTard = new Fenetre()
  /** Les inscriptions refusées par la réserve. */
  readonly refus = new Fenetre()

  /** Le total des calculs de page depuis le démarrage : les tests le lisent. */
  calculsDePage = 0

  private adressesMinute = new Set<string>()
  private adressesDebut = Date.now()
  private refusesMinute = new Set<string>()
  private adressesParEspace = new Map<string, Set<string>>()

  /**
   * Une inscription passée par la réserve. Rend ce que la réserve a dit,
   * pour se glisser autour de son appel sans en changer le sens.
   *
   * Si toute une salle de téléphones en 4G tombe sous une ou deux adresses,
   * c'est que l'adresse lue est celle d'un proxy — et la réserve, commune à
   * toute la salle. D'où le compte des adresses distinctes.
   */
  reserve(spaceId: string, adresse: string, accepte: boolean, sauts: number): boolean {
    if (Date.now() - this.adressesDebut >= 60_000) {
      this.adressesMinute.clear()
      this.refusesMinute.clear()
      this.adressesDebut = Date.now()
    }
    const cle = empreinteDAdresse(adresse)
    if (this.adressesMinute.size < ADRESSES_PAR_ESPACE) this.adressesMinute.add(cle)
    let vues = this.adressesParEspace.get(spaceId)
    if (!vues) this.adressesParEspace.set(spaceId, (vues = new Set()))
    if (vues.size < ADRESSES_PAR_ESPACE) vues.add(cle)
    if (!accepte) {
      this.refus.noter()
      if (!this.refusesMinute.has(cle)) {
        this.refusesMinute.add(cle)
        console.warn(
          `[inscriptions] réserve épuisée pour l’adresse ${cle} — ${sauts} entrée${sauts > 1 ? 's' : ''} dans x-forwarded-for`,
        )
      }
    }
    return accepte
  }

  /** Les adresses distinctes qu'un espace a vues depuis sa dernière clôture — et on repart de zéro. */
  adressesVues(spaceId: string): number {
    const n = this.adressesParEspace.get(spaceId)?.size ?? 0
    this.adressesParEspace.delete(spaceId)
    return n
  }

  inscriptions() {
    return { refusParMin: this.refus.lire().n, clesDistinctes: this.adressesMinute.size }
  }
}

export const pouls = new Pouls()

/** La période de l'histogramme de retard : voir `Charge`. */
const RESOLUTION_MS = 100

/**
 * La charge du processus, relevée toutes les dix secondes et gardée sur la
 * dernière minute : `/healthz` lit le dernier relevé, sans rien mesurer.
 *
 * Le retard de la boucle passe par un histogramme à 100 ms de résolution. À
 * 1 ms, la sonde d'un expert réveillait le processus mille fois par seconde
 * et presque doublait le processeur qu'elle mesurait (vérifié avec et sans).
 * Au repos, mesuré seul : 11,5 ms de processeur par seconde à 1 ms, 3,9 à
 * 20 ms, 1,6 à 50 ms, 0,9 à 100 ms — moins d'un centième du dixième de cœur
 * de l'hébergeur. Un gel de la boucle se voit quand même en entier : c'est
 * l'écart au réveil attendu qui se mesure, pas le réveil. L'occupation, elle,
 * se lit par `eventLoopUtilization`, qui n'arme rien.
 */
export class Charge {
  private histogramme: IntervalHistogram
  private minuterie: ReturnType<typeof setInterval>
  private cpu = process.cpuUsage()
  private elu = performance.eventLoopUtilization()
  private instant = performance.now()
  private releves: { cpuPct: number; occupePct: number; p99Ms: number; maxMs: number }[] = []

  constructor(periodeMs = 10_000) {
    this.histogramme = monitorEventLoopDelay({ resolution: RESOLUTION_MS })
    this.histogramme.enable()
    this.minuterie = setInterval(() => this.relever(), periodeMs)
    this.minuterie.unref()
  }

  private relever() {
    const maintenant = performance.now()
    const ecoule = maintenant - this.instant
    const cpu = process.cpuUsage(this.cpu)
    const elu = performance.eventLoopUtilization(this.elu)
    this.releves.push({
      cpuPct: ((cpu.user + cpu.system) / 1000 / ecoule) * 100,
      occupePct: elu.utilization * 100,
      // L'histogramme compte en nanosecondes, résolution comprise : c'est le
      // retard au-delà de ce qu'on attendait qu'on veut lire.
      p99Ms: Math.max(0, this.histogramme.percentile(99) / 1e6 - RESOLUTION_MS),
      maxMs: Math.max(0, this.histogramme.max / 1e6 - RESOLUTION_MS),
    })
    if (this.releves.length > 6) this.releves.shift()
    this.histogramme.reset()
    this.cpu = process.cpuUsage()
    this.elu = performance.eventLoopUtilization()
    this.instant = maintenant
  }

  lire() {
    const r = this.releves
    const moyenne = (f: (x: (typeof r)[number]) => number) =>
      r.length ? Math.round(r.reduce((s, x) => s + f(x), 0) / r.length) : null
    const pire = (f: (x: (typeof r)[number]) => number) => (r.length ? Math.round(Math.max(...r.map(f))) : null)
    return {
      cpuPct: moyenne(x => x.cpuPct),
      boucleOccupeePct: moyenne(x => x.occupePct),
      retardBoucleP99Ms: pire(x => x.p99Ms),
      retardBoucleMaxMs: pire(x => x.maxMs),
      retardChronosMaxMs: pouls.chronos.lire().max,
    }
  }

  arreter() {
    clearInterval(this.minuterie)
    this.histogramme.disable()
  }
}
