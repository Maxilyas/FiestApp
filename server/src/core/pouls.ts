import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Server, Socket } from 'node:net'
import { monitorEventLoopDelay, performance, type IntervalHistogram } from 'node:perf_hooks'
import { getHeapStatistics } from 'node:v8'
import {
  APPELS_POUR_UNE_LENTE,
  CE_QUI_GELE_PAR_HEURE,
  ERREURS_EN_DETAIL,
  GARDE_DE_NODE_MS,
  GELS_EN_DETAIL,
  REQUETES_PAR_HEURE,
  cleDeLErreur,
  debutDeLHeure,
  debutDeLaTranche,
  type ChargeDeLHeure,
  type ErreurEnDetail,
  type GelDeLaBoucle,
  type GelsDeLHeure,
  type HeureDeSante,
  type PlafondsDuConteneur,
  type QuotaDeLHeure,
  type Releve,
  type RequetesDeLHeure,
  type RouteDeLHeure,
  type TrancheDeSante,
} from '../../../shared/santeDuServeur'
import { detailDeLErreur, type DetailDUneErreur } from './erreurs'
import type { CoutDUnAllerRetour } from './quotaDeTurso'
import type { ModeDuQg } from '../../../shared/qg'
import {
  EVENEMENTS_DES_ROUTES,
  EVENEMENTS_DU_FIL,
  PAS_DU_DIRECT_MS,
  POINTS_DU_DIRECT,
  PRESENCE_MS,
  debutDuPas,
  modesAZero,
  type EvenementDuFil,
  type FaitDuFil,
  type MesureDuPas,
  type PointDuDirect,
} from '../../../shared/qgDirect'

// Le pouls du serveur : ce que `/healthz` dit de la charge, pour savoir, sur
// l'hébergeur, si le serveur tient. Rien ne le disait : la tablée du 24
// septembre a mesuré au dixième de cœur ce qui cède d'abord, mais seule la
// production dira si ce dixième est un plafond strict.
//
// Trois règles, parce que la route est publique et que l'hébergeur la sonde :
// tout est agrégé, sans aucun nom ni adresse ; tout se lit en temps constant,
// sans parcourir de journal ; et rien ici ne peut faire échouer la réponse —
// chaque mesure y passe sous son propre filet (`server.ts`) : un `/healthz`
// en échec, et Render redémarre l'instance, disque effacé.
//
// « Par minute » veut dire ici : sur la minute en cours et la précédente,
// donc sur une à deux minutes selon l'instant de la lecture.

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
    const { n, max, p95 } = this.lireAvecMediane()
    return { n, max, p95 }
  }

  /** La même lecture, la médiane en plus : le temps qu'on ressent le plus souvent, quand le 95ᵉ centile dit le pire courant. */
  lireAvecMediane(): { n: number; max: number; p50: number; p95: number } {
    this.tourner()
    const valeurs = [...this.precedent.valeurs, ...this.courant.valeurs].sort((a, b) => a - b)
    const centile = (c: number) => (valeurs.length ? Math.round(valeurs[Math.min(valeurs.length - 1, Math.floor(valeurs.length * c))]) : 0)
    return {
      n: this.precedent.n + this.courant.n,
      max: Math.round(Math.max(this.precedent.max, this.courant.max)),
      p50: centile(0.5),
      p95: centile(0.95),
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

/** Les routes d'API suivies, au plus : il y en a moins, et la mémoire reste bornée quoi qu'il arrive. */
const ROUTES_SUIVIES = 120

/**
 * Les compteurs que les modules nourrissent : un seul par processus, comme
 * le processeur qu'ils décrivent.
 */
export class Pouls {
  /** Le temps de calcul d'une page publique — souvenir ou bilan. */
  readonly pagesCalculees: Fenetre
  /** Les pages publiques servies, calculées ou reprises. */
  readonly pagesServies: Fenetre
  /** Combien de ms un chronomètre de partie a sonné après son échéance. */
  readonly chronos: Fenetre
  /** La durée d'un envoi au miroir, dans la base distante. */
  readonly miroir: Fenetre
  /** Les réponses d'invités refusées pour « trop tard ». */
  readonly tropTard: Fenetre
  /** Les inscriptions refusées par la réserve. */
  readonly refus: Fenetre
  /**
   * Chaque aller-retour vers la base permanente (`distante.ts`). Les mesures
   * du 4 octobre 2026 supposaient 30 ms : seule la production dit ce que
   * Turso coûte vraiment d'ici, et donc ce que vaut un aller-retour de moins.
   */
  readonly base: Fenetre
  /**
   * Les connexions vers la base (`connexions.ts`) : celles qui s'ouvrent —
   * chacune refait sa poignée de main —, celles que la base referme
   * d'elle-même pendant qu'on les garde, et les allers-retours tombés en route.
   */
  readonly connexions: Fenetre
  readonly refermeesParLaBase: Fenetre
  readonly echecsDeLaBase: Fenetre
  /**
   * L'entretien des connexions (`QUIZ_DB_KEEPWARM`) : ses battements — un
   * `SELECT 1` avant qu'une connexion ait trois secondes de calme —, ceux qui sont tombés, et les
   * connexions qu'ils ont dû ouvrir. À part : ni le temps de Turso, ni ses
   * échecs, ni la part des connexions neuves ne les comptent.
   */
  readonly battements: Fenetre
  readonly battementsTombes: Fenetre
  readonly ouvertesParUnBattement: Fenetre
  /** Le temps de chaque route d'API, sous son modèle (`GET /api/jour`) — jamais l'adresse, qui peut porter un identifiant. */
  private routes = new Map<string, Fenetre>()
  /**
   * Toutes les routes d'API ensemble, sur la dernière minute : ce qu'un
   * joueur attend à l'instant — le voyant du poste de commande du QG 2, quand
   * la page « Le serveur » le dit heure par heure.
   */
  readonly toutesLesRoutes: Fenetre

  constructor(private readonly now: () => number = Date.now) {
    this.pagesCalculees = new Fenetre(now)
    this.pagesServies = new Fenetre(now)
    this.chronos = new Fenetre(now)
    this.miroir = new Fenetre(now)
    this.tropTard = new Fenetre(now)
    this.refus = new Fenetre(now)
    this.base = new Fenetre(now)
    this.connexions = new Fenetre(now)
    this.refermeesParLaBase = new Fenetre(now)
    this.echecsDeLaBase = new Fenetre(now)
    this.battements = new Fenetre(now)
    this.battementsTombes = new Fenetre(now)
    this.ouvertesParUnBattement = new Fenetre(now)
    this.toutesLesRoutes = new Fenetre(now)
    this.adressesDebut = now()
  }

  noterRoute(modele: string, ms: number) {
    this.toutesLesRoutes.noter(ms)
    let fenetre = this.routes.get(modele)
    if (!fenetre) {
      if (this.routes.size >= ROUTES_SUIVIES) return
      this.routes.set(modele, (fenetre = new Fenetre(this.now)))
    }
    fenetre.noter(ms)
  }

  /** Les routes appelées sur la dernière minute, et leur temps : ce qu'un joueur attend, en production. */
  lireRoutes(): Record<string, { parMin: number; p50Ms: number; p95Ms: number; maxMs: number }> {
    const lues: Record<string, { parMin: number; p50Ms: number; p95Ms: number; maxMs: number }> = {}
    for (const modele of [...this.routes.keys()].sort()) {
      const l = this.routes.get(modele)!.lireAvecMediane()
      if (l.n > 0) lues[modele] = { parMin: l.n, p50Ms: l.p50, p95Ms: l.p95, maxMs: l.max }
    }
    return lues
  }

  /** Le total des calculs de page depuis le démarrage : les tests le lisent. */
  calculsDePage = 0

  /** Les adresses de la minute en cours, et celles de la précédente : comme une `Fenetre`. */
  private adressesMinute = new Set<string>()
  private adressesAvant = new Set<string>()
  private adressesDebut: number
  private adressesParEspace = new Map<string, Set<string>>()

  /**
   * Une inscription passée par la réserve. Rend ce que la réserve a dit,
   * pour se glisser autour de son appel sans en changer le sens.
   *
   * Si toute une salle de téléphones en 4G tombe sous une ou deux adresses,
   * c'est que l'adresse lue est celle d'un proxy — et la réserve, commune à
   * toute la salle. D'où le compte des adresses distinctes.
   */
  reserve(spaceId: string, adresse: string, accepte: boolean): boolean {
    this.tournerAdresses()
    const cle = empreinteDAdresse(adresse)
    if (this.adressesMinute.size < ADRESSES_PAR_ESPACE) this.adressesMinute.add(cle)
    let vues = this.adressesParEspace.get(spaceId)
    if (!vues) this.adressesParEspace.set(spaceId, (vues = new Set()))
    if (vues.size < ADRESSES_PAR_ESPACE) vues.add(cle)
    // Le refus, lui, s'écrit au journal par la réserve elle-même
    // (`core/inscriptions.ts`), une ligne par clé et par minute, avec la
    // réserve qui a dit non et le nombre d'entrées de `x-forwarded-for` :
    // une seconde ligne ici la doublait.
    if (!accepte) this.refus.noter()
    return accepte
  }

  /** Les adresses distinctes qu'un espace a vues depuis sa dernière clôture — et on repart de zéro. */
  adressesVues(spaceId: string): number {
    const n = this.adressesParEspace.get(spaceId)?.size ?? 0
    this.adressesParEspace.delete(spaceId)
    return n
  }

  /**
   * Tourne aussi à la lecture : ne tournant qu'à l'inscription, la fenêtre
   * gardait les 150 adresses de l'arrivée trois heures plus tard.
   */
  private tournerAdresses() {
    const t = this.now()
    if (t - this.adressesDebut < 60_000) return
    this.adressesAvant = t - this.adressesDebut < 120_000 ? this.adressesMinute : new Set()
    this.adressesMinute = new Set()
    this.adressesDebut = t - ((t - this.adressesDebut) % 60_000)
  }

  inscriptions() {
    this.tournerAdresses()
    let distinctes = this.adressesAvant.size
    for (const cle of this.adressesMinute) if (!this.adressesAvant.has(cle)) distinctes++
    return { refusParMin: this.refus.lire().n, clesDistinctes: distinctes }
  }
}

export const pouls = new Pouls()

// ── Le relevé de l'heure ──────────────────────────────────────────────────

/** Au-delà, l'échantillon d'une heure ne grandit plus : il se renouvelle au hasard, comme celui d'une minute. */
const ECHANTILLON_HORAIRE = 400
const ECHANTILLON_PAR_ROUTE = 60
/** Les sources d'erreur suivies dans une heure, au plus : au-delà, elles comptent sous « autre ». */
const SOURCES_SUIVIES = 20
/** Les requêtes lourdes suivies dans une heure, au plus : au-delà, elles comptent sous `AUTRES_REQUETES`. L'heure n'en écrit que les plus gourmandes (`REQUETES_PAR_HEURE`). */
const REQUETES_SUIVIES = 60
const AUTRES_REQUETES = 'autres requêtes'
/** Ce qui tournait pendant les gels, suivi dans une heure, au plus : au-delà, sous « autre chose ». L'heure n'en écrit que `CE_QUI_GELE_PAR_HEURE`. */
const CE_QUI_GELE_SUIVI = 60
const AUTRE_CHOSE = 'autre chose'

/** Une grandeur sur une heure : combien, la pire, et un échantillon borné pour ses centiles. */
class Mesure {
  n = 0
  max = 0
  private valeurs: number[] = []

  constructor(private readonly taille: number) {}

  noter(valeur: number) {
    this.n++
    if (valeur > this.max) this.max = valeur
    if (this.valeurs.length < this.taille) this.valeurs.push(valeur)
    else {
      const i = Math.floor(Math.random() * this.n)
      if (i < this.taille) this.valeurs[i] = valeur
    }
  }

  lire(): Releve | null {
    if (this.n === 0) return null
    const v = [...this.valeurs].sort((a, b) => a - b)
    const centile = (c: number) => Math.round(v[Math.min(v.length - 1, Math.floor(v.length * c))])
    return { n: this.n, p50: centile(0.5), p95: centile(0.95), max: Math.round(this.max) }
  }
}

/** Les échantillons d'une tranche : cinq minutes n'ont pas besoin des quatre cents de l'heure. */
const ECHANTILLON_D_UNE_TRANCHE = 60

/** Ajoute une réponse à des requêtes comptées par famille de statut. */
function compterLeStatut(r: RequetesDeLHeure, statut: number) {
  if (statut >= 500) r.enErreur++
  else if (statut >= 400) r.refusees++
  else if (statut >= 300) r.redirigees++
  else r.reussies++
}

/**
 * Cinq minutes de l'heure (`TrancheDeSante`) : ce qu'un joueur attend, Turso,
 * les requêtes, les erreurs, la charge, les gels — ce que la page « Le
 * serveur » montre sur une heure. Ni les routes une à une, ni le quota, ni le
 * détail des gels : l'heure les garde, et douze tranches de cent vingt routes
 * auraient fait de chaque ligne un petit livre.
 */
class Tranche {
  readonly routes = new Mesure(ECHANTILLON_D_UNE_TRANCHE)
  readonly base = new Mesure(ECHANTILLON_D_UNE_TRANCHE)
  readonly requetes: RequetesDeLHeure = { reussies: 0, redirigees: 0, refusees: 0, enErreur: 0 }
  erreurs = 0
  private charge = { n: 0, processeur: 0, boucleMaxMs: 0, memoireMaxMo: 0, invitesMax: 0 }
  private gels = { n: 0, maxMs: 0 }

  constructor(readonly debut: number) {}

  noterCharge(c: ReleveDeCharge) {
    const k = this.charge
    k.n++
    k.processeur += c.processeur
    k.boucleMaxMs = Math.max(k.boucleMaxMs, c.boucleMaxMs)
    if (c.memoireMo !== null) k.memoireMaxMo = Math.max(k.memoireMaxMo, c.memoireMo)
    k.invitesMax = Math.max(k.invitesMax, c.invites)
  }

  gel(dureeMs: number) {
    this.gels.n++
    this.gels.maxMs = Math.max(this.gels.maxMs, dureeMs)
  }

  lue(): TrancheDeSante {
    const k = this.charge
    return {
      debut: this.debut,
      routes: this.routes.lire(),
      base: this.base.lire(),
      requetes: { ...this.requetes },
      erreurs: this.erreurs,
      charge:
        k.n === 0
          ? null
          : {
              n: k.n,
              processeur: Math.round((k.processeur / k.n) * 10) / 10,
              boucleMaxMs: Math.round(k.boucleMaxMs),
              memoireMaxMo: Math.round(k.memoireMaxMo),
              invitesMax: k.invitesMax,
            },
      gels: { n: this.gels.n, maxMs: Math.round(this.gels.maxMs) },
    }
  }
}

/** Une route sur l'heure : son échantillon, le temps qu'elle a pris en tout, ses refus et ses erreurs. */
interface RouteSuivie {
  mesure: Mesure
  totalMs: number
  refusees: number
  enErreur: number
}

class Heure {
  readonly base = new Mesure(ECHANTILLON_HORAIRE)
  readonly routes = new Mesure(ECHANTILLON_HORAIRE)
  private parRoute = new Map<string, RouteSuivie>()
  /** Ses tranches de cinq minutes, créées à leur première mesure. */
  private tranches = new Map<number, Tranche>()
  private erreurs = new Map<string, number>()
  /** Les erreurs de l'heure en détail, les mêmes comptées ensemble (`cleDeLErreur`). */
  private enDetail = new Map<string, ErreurEnDetail>()
  miroir = 0
  private charge = {
    n: 0,
    processeur: 0,
    processeurMax: 0,
    boucleMaxMs: 0,
    memoireMaxMo: 0,
    invitesMax: 0,
    geles: 0,
    gele: 0,
    geleMax: 0,
    // Null tant qu'aucun relevé ne les a dits : une machine qui se tait n'écrit pas un zéro.
    connexionsMax: null as number | null,
    tempsReelMax: null as number | null,
    envoyes: null as number | null,
    recus: null as number | null,
  }
  private requetes: RequetesDeLHeure = { reussies: 0, redirigees: 0, refusees: 0, enErreur: 0 }
  private quota = { appels: 0, lues: 0, ecrites: 0, lourdes: new Map<string, { n: number; lues: number }>() }
  private gels = { n: 0, totalMs: 0, plusLongs: [] as GelDeLaBoucle[], parCe: new Map<string, { n: number; ms: number }>(), sansRien: 0 }
  private liaison = {
    ouvertes: 0,
    refermeesParLaBase: 0,
    plusJeuneRefermeeMs: null as number | null,
    echecs: 0,
    annonceeMs: null as number | null,
    battements: 0,
    battementsTombes: 0,
    ouvertesParUnBattement: 0,
  }

  constructor(readonly debut: number) {}

  /** La tranche de cinq minutes d'un instant de l'heure. */
  tranche(quand: number): Tranche {
    const debut = debutDeLaTranche(quand)
    let t = this.tranches.get(debut)
    if (!t) this.tranches.set(debut, (t = new Tranche(debut)))
    return t
  }

  connexion() {
    this.liaison.ouvertes++
  }

  connexionParUnBattement() {
    this.liaison.ouvertesParUnBattement++
  }

  battements(n: number) {
    this.liaison.battements += n
  }

  battementTombe() {
    this.liaison.battementsTombes++
  }

  annonceDeLaBase(ms: number) {
    this.liaison.annonceeMs = Math.max(this.liaison.annonceeMs ?? 0, ms)
  }

  refermeeParLaBase(ageMs: number) {
    const l = this.liaison
    l.refermeesParLaBase++
    l.plusJeuneRefermeeMs = l.plusJeuneRefermeeMs === null ? ageMs : Math.min(l.plusJeuneRefermeeMs, ageMs)
  }

  echecDeLaBase() {
    this.liaison.echecs++
  }

  noterBase(ms: number, quand: number) {
    this.base.noter(ms)
    this.tranche(quand).base.noter(ms)
  }

  noterCharge(c: ReleveDeCharge, quand: number) {
    this.tranche(quand).noterCharge(c)
    const k = this.charge
    k.n++
    k.processeur += c.processeur
    k.processeurMax = Math.max(k.processeurMax, c.processeur)
    k.boucleMaxMs = Math.max(k.boucleMaxMs, c.boucleMaxMs)
    if (c.memoireMo !== null) k.memoireMaxMo = Math.max(k.memoireMaxMo, c.memoireMo)
    k.invitesMax = Math.max(k.invitesMax, c.invites)
    if (typeof c.gelePct === 'number') {
      k.geles++
      k.gele += c.gelePct
      k.geleMax = Math.max(k.geleMax, c.gelePct)
    }
    if (typeof c.connexions === 'number') k.connexionsMax = Math.max(k.connexionsMax ?? 0, c.connexions)
    if (typeof c.tempsReel === 'number') k.tempsReelMax = Math.max(k.tempsReelMax ?? 0, c.tempsReel)
    if (typeof c.envoyesOctets === 'number') k.envoyes = (k.envoyes ?? 0) + c.envoyesOctets
    if (typeof c.recusOctets === 'number') k.recus = (k.recus ?? 0) + c.recusOctets
  }

  requete(statut: number, quand: number) {
    compterLeStatut(this.requetes, statut)
    compterLeStatut(this.tranche(quand).requetes, statut)
  }

  noterQuota(c: CoutDUnAllerRetour) {
    const q = this.quota
    q.appels++
    q.lues += c.lues
    q.ecrites += c.ecrites
    for (const l of c.lourdes) {
      const cle = q.lourdes.has(l.requete) || q.lourdes.size < REQUETES_SUIVIES ? l.requete : AUTRES_REQUETES
      const avant = q.lourdes.get(cle)
      if (avant) {
        avant.n++
        avant.lues += l.lues
      } else q.lourdes.set(cle, { n: 1, lues: l.lues })
    }
  }

  /** Un gel de la boucle (`SondeDesGels`) : compté, gardé s'il est des plus longs, et ce qui tournait, chacun une fois. */
  gel(g: GelDeLaBoucle, quand: number) {
    this.tranche(quand).gel(g.dureeMs)
    const k = this.gels
    k.n++
    k.totalMs += g.dureeMs
    if (g.enCours.length === 0) k.sansRien++
    for (const { quoi } of g.enCours) {
      const cle = k.parCe.has(quoi) || k.parCe.size < CE_QUI_GELE_SUIVI ? quoi : AUTRE_CHOSE
      const avant = k.parCe.get(cle)
      if (avant) {
        avant.n++
        avant.ms += g.dureeMs
      } else k.parCe.set(cle, { n: 1, ms: g.dureeMs })
    }
    k.plusLongs.push(g)
    k.plusLongs.sort((a, b) => b.dureeMs - a.dureeMs || b.a - a.a)
    if (k.plusLongs.length > GELS_EN_DETAIL) k.plusLongs.length = GELS_EN_DETAIL
  }

  private gelsLus(): GelsDeLHeure {
    const k = this.gels
    return {
      n: k.n,
      totalMs: Math.round(k.totalMs),
      plusLongs: k.plusLongs.map(g => ({ ...g, enCours: g.enCours.map(c => ({ ...c })) })),
      parCe: [...k.parCe]
        .map(([quoi, c]) => ({ quoi, n: c.n, ms: Math.round(c.ms) }))
        .sort((a, b) => b.ms - a.ms || b.n - a.n || (a.quoi < b.quoi ? -1 : 1))
        .slice(0, CE_QUI_GELE_PAR_HEURE),
      sansRien: k.sansRien,
    }
  }

  private quotaLu(): QuotaDeLHeure | null {
    const q = this.quota
    if (q.appels === 0) return null
    const lourdes = [...q.lourdes]
      .map(([requete, l]) => ({ requete, n: l.n, lues: l.lues }))
      .sort((a, b) => b.lues - a.lues || (a.requete < b.requete ? -1 : 1))
      .slice(0, REQUETES_PAR_HEURE)
    return { appels: q.appels, lues: q.lues, ecrites: q.ecrites, lourdes }
  }

  private chargeLue(): ChargeDeLHeure | null {
    const k = this.charge
    if (k.n === 0) return null
    return {
      n: k.n,
      processeur: Math.round((k.processeur / k.n) * 10) / 10,
      processeurMax: Math.round(k.processeurMax * 10) / 10,
      boucleMaxMs: Math.round(k.boucleMaxMs),
      memoireMaxMo: Math.round(k.memoireMaxMo),
      invitesMax: k.invitesMax,
      // Absent hors d'un conteneur qui le dit : un PC, un Mac.
      ...(k.geles > 0 && { gelePct: Math.round((k.gele / k.geles) * 10) / 10, geleMaxPct: Math.round(k.geleMax * 10) / 10 }),
      ...(k.connexionsMax !== null && { connexionsMax: k.connexionsMax }),
      ...(k.tempsReelMax !== null && { tempsReelMax: k.tempsReelMax }),
      ...(k.envoyes !== null && { envoyesKo: Math.round(k.envoyes / 1024) }),
      ...(k.recus !== null && { recusKo: Math.round(k.recus / 1024) }),
    }
  }

  /** Une route d'API servie : son temps, son statut — sans lui (un appelant d'avant), elle compte comme une réponse. */
  route(modele: string, ms: number, statut: number | null, quand: number) {
    this.routes.noter(ms)
    this.tranche(quand).routes.noter(ms)
    let suivie = this.parRoute.get(modele)
    if (!suivie) {
      if (this.parRoute.size >= ROUTES_SUIVIES) return
      this.parRoute.set(modele, (suivie = { mesure: new Mesure(ECHANTILLON_PAR_ROUTE), totalMs: 0, refusees: 0, enErreur: 0 }))
    }
    suivie.mesure.noter(ms)
    suivie.totalMs += ms
    if (statut !== null && statut >= 500) suivie.enErreur++
    else if (statut !== null && statut >= 400) suivie.refusees++
  }

  erreur(source: string, detail: DetailDUneErreur | null, quand: number) {
    this.tranche(quand).erreurs++
    const cle = this.erreurs.has(source) || this.erreurs.size < SOURCES_SUIVIES ? source : 'autre'
    this.erreurs.set(cle, (this.erreurs.get(cle) ?? 0) + 1)
    if (!detail) return
    // Sous la source de son compte : ce que la page dit « sans détail » se lit par différence.
    const enDetail = { source: cle, ...detail }
    const meme = this.enDetail.get(cleDeLErreur(enDetail))
    if (meme) {
      meme.n++
      meme.derniere = quand
    } else if (this.enDetail.size < ERREURS_EN_DETAIL) {
      this.enDetail.set(cleDeLErreur(enDetail), { ...enDetail, n: 1, premiere: quand, derniere: quand })
    }
  }

  ligne(demarrage: string, chaudes: boolean): HeureDeSante {
    const l = this.liaison
    // Chaque route de l'heure, la plus coûteuse au serveur d'abord : la page « Le serveur » les trie et les compare.
    const parRoute: RouteDeLHeure[] = [...this.parRoute]
      .map(([route, s]) => ({ route, s, r: s.mesure.lire() }))
      .filter((x): x is { route: string; s: RouteSuivie; r: Releve } => x.r !== null)
      .map(({ route, s, r }) => ({ route, ...r, totalMs: Math.round(s.totalMs), refusees: s.refusees, enErreur: s.enErreur }))
      .sort((a, b) => b.totalMs - a.totalMs || (a.route < b.route ? -1 : 1))
    const lentes = parRoute
      .filter(r => r.n >= APPELS_POUR_UNE_LENTE)
      .map(r => ({ route: r.route, n: r.n, p95: r.p95 }))
      .sort((a, b) => b.p95 - a.p95)
      .slice(0, 3)
    return {
      heure: this.debut,
      demarrage,
      base: this.base.lire(),
      routes: this.routes.lire(),
      lentes,
      erreurs: Object.fromEntries(this.erreurs),
      ...(this.enDetail.size > 0 && { erreursEnDetail: [...this.enDetail.values()].map(e => ({ ...e, pile: [...e.pile] })) }),
      miroir: this.miroir,
      charge: this.chargeLue(),
      connexions: {
        ouvertes: l.ouvertes,
        refermeesParLaBase: l.refermeesParLaBase,
        plusJeuneRefermeeMs: l.plusJeuneRefermeeMs === null ? null : Math.round(l.plusJeuneRefermeeMs),
        echecs: l.echecs,
        gardeMs: GARDE_DE_NODE_MS,
        annonceeMs: l.annonceeMs,
        chaudes,
        battements: l.battements,
        battementsTombes: l.battementsTombes,
        ouvertesParUnBattement: l.ouvertesParUnBattement,
      },
      requetes: { ...this.requetes },
      quota: this.quotaLu(),
      // Toujours, même à zéro : une heure qui les relève sans en avoir eu se distingue d'une ligne d'avant.
      gels: this.gelsLus(),
      // Toujours aussi, même vides : une heure du QG 2 qui n'a rien servi se distingue d'une ligne d'avant leur relevé.
      parRoute,
      tranches: [...this.tranches.values()].sort((a, b) => a.debut - b.debut).map(t => t.lue()),
    }
  }
}

/** Un relevé de charge, toutes les dix secondes (`Charge`) : le processeur en pour cent d'un cœur, le pire gel, la mémoire, les invités connectés. */
export interface ReleveDeCharge {
  processeur: number
  boucleMaxMs: number
  memoireMo: number | null
  invites: number
  /** La part du relevé où l'hébergeur a gelé le processus faute de processeur (`sondeDuGel`) ; null hors d'un conteneur qui le dit. */
  gelePct?: number | null
  /** Les connexions ouvertes sur le serveur à cet instant (`compteurDeConnexions`), et les clients du temps réel. */
  connexions?: number | null
  tempsReel?: number | null
  /** Ce que la machine a envoyé et reçu depuis le relevé d'avant, en octets (`sondeDuReseau`) ; null hors d'une machine qui le dit. */
  envoyesOctets?: number | null
  recusOctets?: number | null
}

// ── Le direct du QG (le QG 2, lot 3) ──────────────────────────────────────

/** Les échantillons d'un pas de dix secondes : de quoi un centile, sans plus. */
const ECHANTILLON_D_UN_PAS = 40

/** La charge d'un relevé, telle que le direct la garde. */
interface ChargeDuPas {
  processeur: number
  boucleMaxMs: number
  memoireMo: number | null
  invites: number
  tempsReel: number | null
}

/** Le pas en cours du direct : ce que le relevé reçoit pendant ses dix secondes. */
class PasDuDirect {
  readonly routes = new Mesure(ECHANTILLON_D_UN_PAS)
  readonly base = new Mesure(ECHANTILLON_D_UN_PAS)
  requetes = 0
  refusees = 0
  enErreur = 0
  erreurs = 0
  gels = 0
  charge: ChargeDuPas | null = null
  constructor(readonly debut: number) {}
}

const mesureDuPas = (m: Mesure): MesureDuPas | null => m.lire()

/**
 * Le direct du QG (le QG 2, lot 3, le 4 novembre 2026 : « voir … sur du temps
 * réel ») : ce que le relevé de l'heure reçoit, au pas de dix secondes sur
 * quinze minutes (`POINTS_DU_DIRECT`), les joueurs de chaque mode et le fil
 * de ce qui arrive — en mémoire seulement, nourri par le relevé
 * (`ReleveHoraire.direct`) et lu par le flux du QG (`GET /api/admin/flux`).
 * Quelques dizaines de kilo-octets : quatre-vingt-dix pas, quatre-vingts
 * événements, un instant par profil passé ces cinq minutes.
 *
 * Un joueur compte dans un mode tant qu'il est passé sur une de ses routes ces
 * cinq dernières minutes (`joueur`, le minutage de `server.ts`) : son profil
 * ne sort jamais d'ici, seul leur nombre. En soirée, les invités connectés.
 */
export class DirectDuServeur {
  private points: PointDuDirect[] = []
  private pas: PasDuDirect
  private presences = new Map<ModeDuQg, Map<string, number>>()
  private fil: EvenementDuFil[] = []
  private prochainId = 1
  private prochainRang = 1

  constructor(private readonly now: () => number = Date.now) {
    this.pas = new PasDuDirect(debutDuPas(now()))
  }

  /**
   * Le pas qu'il est. Celui d'avant, fini, rejoint l'anneau, et les pas
   * passés sans rien aussi, vides — le temps du graphique reste continu ; un
   * serveur resté muet plus de quinze minutes ne remplit que ce qui se voit.
   */
  private courant(): PasDuDirect {
    const debut = debutDuPas(this.now())
    if (debut === this.pas.debut) return this.pas
    this.points.push(this.figer(this.pas))
    const premierVide = Math.max(this.pas.debut + PAS_DU_DIRECT_MS, debut - POINTS_DU_DIRECT * PAS_DU_DIRECT_MS)
    for (let a = premierVide; a < debut; a += PAS_DU_DIRECT_MS) this.points.push(this.figer(new PasDuDirect(a)))
    if (this.points.length > POINTS_DU_DIRECT) this.points.splice(0, this.points.length - POINTS_DU_DIRECT)
    this.pas = new PasDuDirect(debut)
    return this.pas
  }

  /**
   * Un pas en point. La charge se relève toutes les dix secondes, sans se
   * caler sur les pas : un pas qui n'en a pas reçu reprend celle du pas
   * d'avant, s'il en avait une — un relevé tombé de l'autre côté du pas ne
   * fait pas un trou dans la courbe.
   */
  private figer(p: PasDuDirect, maintenant?: number): PointDuDirect {
    const fin = maintenant ?? p.debut + PAS_DU_DIRECT_MS
    const avant = this.points.at(-1)
    const reprise = avant && avant.a === p.debut - PAS_DU_DIRECT_MS && avant.processeur !== null ? avant : null
    const c = p.charge
    const modes = modesAZero()
    for (const [mode, vus] of this.presences) {
      let n = 0
      for (const [profil, quand] of vus) {
        if (quand > fin - PRESENCE_MS) n++
        // Le ménage, au passage : celui qui n'est plus passé depuis cinq minutes ne revient pas dans un pas d'avant.
        else if (maintenant === undefined && quand <= this.now() - PRESENCE_MS) vus.delete(profil)
      }
      modes[mode] = n
    }
    const invites = c ? c.invites : reprise ? reprise.invites : null
    modes.soiree = invites ?? 0
    return {
      a: p.debut,
      requetes: p.requetes,
      refusees: p.refusees,
      enErreur: p.enErreur,
      erreurs: p.erreurs,
      routes: mesureDuPas(p.routes),
      base: mesureDuPas(p.base),
      processeur: c ? Math.round(c.processeur * 10) / 10 : (reprise?.processeur ?? null),
      boucleMaxMs: c ? Math.round(c.boucleMaxMs) : (reprise?.boucleMaxMs ?? null),
      memoireMo: c ? c.memoireMo : (reprise?.memoireMo ?? null),
      invites,
      tempsReel: c ? c.tempsReel : (reprise?.tempsReel ?? null),
      gels: p.gels,
      modes,
    }
  }

  route(modele: string, ms: number, statut: number | null) {
    this.courant().routes.noter(ms)
    const fait = statut !== null && statut < 400 ? EVENEMENTS_DES_ROUTES[modele] : undefined
    if (fait) this.evenement(fait)
  }

  requete(statut: number) {
    const p = this.courant()
    p.requetes++
    if (statut >= 500) p.enErreur++
    else if (statut >= 400) p.refusees++
  }

  base(ms: number) {
    this.courant().base.noter(ms)
  }

  /** Une erreur serveur : comptée dans son pas, et dite au fil par sa source et son code — jamais son message, qui peut citer un joueur. */
  erreur(source: string, code: string | null) {
    this.courant().erreurs++
    this.evenement({ sorte: 'erreur', mode: null, texte: `Erreur serveur · ${source}${code ? ` · ${code}` : ''}` })
  }

  charge(c: ReleveDeCharge) {
    this.courant().charge = { processeur: c.processeur, boucleMaxMs: c.boucleMaxMs, memoireMo: c.memoireMo, invites: c.invites, tempsReel: c.tempsReel ?? null }
  }

  gel() {
    this.courant().gels++
  }

  /** Un profil passé sur une route d'un mode : il y compte cinq minutes. */
  joueur(mode: ModeDuQg, profil: string) {
    let vus = this.presences.get(mode)
    if (!vus) this.presences.set(mode, (vus = new Map()))
    vus.set(profil, this.now())
  }

  /**
   * Une ligne du fil. La même, arrivée dans le même pas, se compte avec la
   * précédente (« 3 × ») et reprend un rang neuf : la page qui l'avait la
   * remplace — une panne qui fait tomber cent requêtes ne noie pas le fil.
   */
  evenement(fait: FaitDuFil) {
    const a = this.now()
    const dernier = this.fil.find(e => e.texte === fait.texte && e.sorte === fait.sorte && a - e.a < PAS_DU_DIRECT_MS)
    if (dernier) {
      dernier.n++
      dernier.a = a
      dernier.rang = this.prochainRang++
      return
    }
    this.fil.unshift({ id: this.prochainId++, rang: this.prochainRang++, a, sorte: fait.sorte, mode: fait.mode, texte: fait.texte, n: 1 })
    if (this.fil.length > EVENEMENTS_DU_FIL) this.fil.length = EVENEMENTS_DU_FIL
  }

  /**
   * Ce qu'une page n'a pas encore : les pas finis après `depuisPoint`, le pas
   * en cours tel qu'il est, les événements de rang au-delà de `depuisRang` —
   * du plus ancien au plus récent — et où elle en sera.
   */
  lire(depuisPoint = 0, depuisRang = 0) {
    const pas = this.courant()
    const fil = this.fil.filter(e => e.rang > depuisRang).sort((a, b) => a.rang - b.rang)
    return {
      points: this.points.filter(p => p.a > depuisPoint),
      enCours: this.figer(pas, this.now()),
      fil,
      dernierPoint: this.points.at(-1)?.a ?? depuisPoint,
      dernierRang: this.prochainRang - 1,
    }
  }

  remettreAZero() {
    this.points = []
    this.pas = new PasDuDirect(debutDuPas(this.now()))
    this.presences.clear()
    this.fil = []
  }
}

/**
 * Le relevé de l'heure : ce que la page « Le serveur » du QG garde sur sept
 * jours (`core/santeDuServeur.ts` l'écrit dans la base permanente). Un seul
 * par processus, que les modules nourrissent comme le pouls : les
 * allers-retours vers Turso (`distante.ts`), les routes et chaque requête
 * servie par son statut (`server.ts`), les
 * erreurs serveur — d'une route (`repondreErreur`), d'un socket
 * (`ecouter`, `messagePourEcran`), une exception échappée (`index.ts`) —,
 * chacune avec son détail (`core/erreurs.ts`), les échecs du miroir
 * (`backup.ts`). L'heure d'avant reste à côté de la
 * suivante : ses dernières minutes s'écrivent après coup.
 */
export class ReleveHoraire {
  private courante: Heure
  private precedente: Heure | null = null
  /** Les connexions vers la base gardées chaudes, réglé une fois pour le processus (`connexions.ts`) : chaque heure l'écrit à côté de ses comptes. */
  private gardeesChaudes = false
  /** Le direct du QG : ce que le relevé reçoit, au pas de dix secondes, en mémoire seulement. */
  readonly direct: DirectDuServeur

  constructor(private readonly now: () => number = Date.now) {
    this.courante = new Heure(debutDeLHeure(now()))
    this.direct = new DirectDuServeur(now)
  }

  private heure(): Heure {
    const debut = debutDeLHeure(this.now())
    if (debut !== this.courante.debut) {
      this.precedente = this.courante
      this.courante = new Heure(debut)
    }
    return this.courante
  }

  base(ms: number) {
    this.heure().noterBase(ms, this.now())
    this.direct.base(ms)
  }

  /** Une route d'API servie, sous son modèle : son temps et son statut, pour sa ligne, pour la tranche de cinq minutes et pour le direct. */
  route(modele: string, ms: number, statut: number | null = null) {
    this.heure().route(modele, ms, statut, this.now())
    this.direct.route(modele, ms, statut)
  }

  /** Une requête servie — une page, un fichier, une route d'API —, comptée par la famille de son statut. */
  requete(statut: number) {
    this.heure().requete(statut, this.now())
    this.direct.requete(statut)
  }

  /**
   * Une erreur serveur, sous sa source, et ce qu'elle était (`e`) : sa sorte,
   * son message nettoyé, d'où elle vient (`detailDeLErreur`). `sansMessage` :
   * une erreur dont le message cite ce que le joueur a envoyé. Le détail se
   * lit sous son propre filet : celui qui tombe se tait, l'erreur se compte.
   */
  erreur(source: string, e?: unknown, { sansMessage = false }: { sansMessage?: boolean } = {}) {
    let detail: DetailDUneErreur | null = null
    if (e !== undefined) {
      try {
        detail = detailDeLErreur(e, { sansMessage })
      } catch {
        // Une pile illisible, un getter qui lève : l'erreur reste comptée.
      }
    }
    this.heure().erreur(source, detail, this.now())
    this.direct.erreur(source, detail?.code ?? null)
  }

  echecDuMiroir() {
    this.heure().miroir++
  }

  /** Ce qu'un aller-retour vers Turso a coûté au quota (`compterLeQuota`, `distante.ts`) : ses lignes lues et écrites, et ses instructions lourdes. */
  quota(c: CoutDUnAllerRetour) {
    this.heure().noterQuota(c)
  }

  charge(c: ReleveDeCharge) {
    this.heure().noterCharge(c, this.now())
    this.direct.charge(c)
  }

  /** Un gel de la boucle de plus d'une demi-seconde, et ce qui tournait (`SondeDesGels`, `core/gels.ts`), dans l'heure où il a fini. */
  gel(g: GelDeLaBoucle) {
    this.heure().gel(g, this.now())
    this.direct.gel()
  }

  /** Une connexion ouverte vers la base, une qu'elle a refermée d'elle-même (à quel âge), un aller-retour tombé en route, le délai qu'elle annonce. */
  connexion() {
    this.heure().connexion()
  }

  /** L'entretien des connexions : ses battements, ceux qui sont tombés, les connexions qu'ils ont ouvertes. */
  battements(n: number) {
    this.heure().battements(n)
  }

  battementTombe() {
    this.heure().battementTombe()
  }

  connexionParUnBattement() {
    this.heure().connexionParUnBattement()
  }

  annonceDeLaBase(ms: number) {
    this.heure().annonceDeLaBase(ms)
  }

  refermeeParLaBase(ageMs: number) {
    this.heure().refermeeParLaBase(ageMs)
  }

  echecDeLaBase() {
    this.heure().echecDeLaBase()
  }

  chaudes(oui: boolean) {
    this.gardeesChaudes = oui
  }

  /** L'heure d'avant, si elle reste, et celle-ci : ce qu'un relevé écrit sous son démarrage. */
  lignes(demarrage: string): HeureDeSante[] {
    const courante = this.heure()
    const c = this.gardeesChaudes
    return this.precedente ? [this.precedente.ligne(demarrage, c), courante.ligne(demarrage, c)] : [courante.ligne(demarrage, c)]
  }

  /** Un serveur neuf part de zéro : celui d'avant, dans le même processus — les tests —, n'a rien à lui léguer. */
  remettreAZero() {
    this.courante = new Heure(debutDeLHeure(this.now()))
    this.precedente = null
    this.direct.remettreAZero()
  }
}

export const releve = new ReleveHoraire()

/**
 * Où le conteneur dit le temps qu'il a passé gelé faute de processeur, et en
 * quelle unité : cgroup v2, puis les deux noms de cgroup v1, en nanosecondes.
 */
const SOURCES_DU_GEL: readonly { fichier: string; cle: string; enMicrosecondes: number }[] = [
  { fichier: '/sys/fs/cgroup/cpu.stat', cle: 'throttled_usec', enMicrosecondes: 1 },
  { fichier: '/sys/fs/cgroup/cpu/cpu.stat', cle: 'throttled_time', enMicrosecondes: 1 / 1000 },
  { fichier: '/sys/fs/cgroup/cpu,cpuacct/cpu.stat', cle: 'throttled_time', enMicrosecondes: 1 / 1000 },
]

/**
 * Le temps où l'hébergeur a gelé le processus faute de processeur, cumulé, en
 * microsecondes — la sonde, ou null hors d'un conteneur qui le dit (un PC, un
 * Mac). Le dixième de cœur de l'offre gratuite se distribue par tranches de
 * dix millisecondes tous les dixièmes de seconde : un calcul qui en demande
 * plus attend la tranche suivante, et chaque aller-retour vers Turso en cours
 * attend avec lui. Le 16 octobre 2026, la boucle de la production se figeait
 * deux secondes chaque heure quand Turso répondait en cent millisecondes, et
 * rien ne disait si ce gel venait de l'hébergeur (la revue du 14 octobre,
 * perf-turso-12) : c'est ce que dit cette sonde. Le fichier se choisit une
 * fois ; une lecture qui tombe ensuite se tait (null), le pouls continue.
 */
export function sondeDuGel(lire: (fichier: string) => string = f => readFileSync(f, 'utf8')): (() => number | null) | null {
  const valeur = (s: (typeof SOURCES_DU_GEL)[number]): number | null => {
    const m = new RegExp(`^${s.cle} (\\d+)$`, 'm').exec(lire(s.fichier))
    return m ? Number(m[1]) * s.enMicrosecondes : null
  }
  for (const s of SOURCES_DU_GEL) {
    try {
      if (valeur(s) === null) continue
    } catch {
      continue
    }
    return () => {
      try {
        return valeur(s)
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * Ce que la machine a envoyé et reçu depuis qu'elle tourne, en octets, toutes
 * ses interfaces hors la boucle locale (`/proc/net/dev`) — la sonde, ou null
 * hors d'une machine qui le dit (un Mac, Windows). Dans le conteneur de
 * l'hébergeur, c'est le serveur seul : les pages aux téléphones, le temps
 * réel, et chaque aller-retour vers Turso, qui compte dans ce qu'il reçoit.
 * Sur un PC, c'est tout le PC. Comme le gel : une lecture qui tombe ensuite se
 * tait, le pouls continue.
 */
export function sondeDuReseau(lire: (fichier: string) => string = f => readFileSync(f, 'utf8')): (() => { recus: number; envoyes: number } | null) | null {
  const lu = (): { recus: number; envoyes: number } | null => {
    let recus = 0
    let envoyes = 0
    let interfaces = 0
    for (const ligne of lire('/proc/net/dev').split('\n')) {
      // « eth0: 1234 5 0 0 0 0 0 0 5678 9 0 … » : huit colonnes reçues, puis huit envoyées ; les deux lignes de tête n'ont pas de deux-points.
      const m = /^\s*([^\s:]+):\s*(.*)$/.exec(ligne)
      if (!m || m[1] === 'lo') continue
      const colonnes = m[2].trim().split(/\s+/).map(Number)
      if (colonnes.length < 16 || colonnes.some(c => !Number.isFinite(c))) continue
      recus += colonnes[0]
      envoyes += colonnes[8]
      interfaces++
    }
    return interfaces > 0 ? { recus, envoyes } : null
  }
  try {
    if (lu() === null) return null
  } catch {
    return null
  }
  return () => {
    try {
      return lu()
    } catch {
      return null
    }
  }
}

/** Au-delà d'un tébioctet, une limite de mémoire n'en est pas une : cgroup v1 dit 2⁶³, arrondi à la page, quand rien ne borne. */
const MEMOIRE_SANS_PLAFOND = 2 ** 40

/**
 * Les plafonds du conteneur, lus une fois dans son cgroup : le processeur
 * (cgroup v2 `cpu.max`, « 10000 100000 » pour un dixième de cœur ; v1
 * `cpu.cfs_quota_us` sur `cpu.cfs_period_us`) et la mémoire (`memory.max`,
 * v1 `memory.limit_in_bytes`). La page « Le serveur » les traçait d'après
 * l'offre gratuite, écrite dans le code : une autre offre, et le trait
 * mentait. « max » ou -1 : pas de plafond. Null quand la machine ne les dit
 * pas — un PC, un Mac — : la page reprend ceux du code.
 */
export function plafondsDuConteneur(lire: (fichier: string) => string = f => readFileSync(f, 'utf8')): PlafondsDuConteneur {
  // La première source qui répond un nombre ; un fichier absent passe la main au suivant.
  const premiere = (...sources: (() => number | null)[]): number | null => {
    for (const source of sources) {
      try {
        const v = source()
        if (v !== null && Number.isFinite(v) && v > 0) return v
      } catch {
        // Pas ce cgroup-là.
      }
    }
    return null
  }
  const nombre = (fichier: string) => {
    const t = lire(fichier).trim()
    return t === 'max' || t === '-1' ? null : Number(t)
  }
  const processeur = premiere(
    () => {
      const [quota, periode] = lire('/sys/fs/cgroup/cpu.max').trim().split(/\s+/)
      return quota === 'max' ? null : (Number(quota) / Number(periode)) * 100
    },
    ...['/sys/fs/cgroup/cpu', '/sys/fs/cgroup/cpu,cpuacct'].map(dossier => () => {
      const quota = nombre(`${dossier}/cpu.cfs_quota_us`)
      return quota === null ? null : (quota / Number(lire(`${dossier}/cpu.cfs_period_us`).trim())) * 100
    }),
  )
  const memoire = premiere(
    () => nombre('/sys/fs/cgroup/memory.max'),
    () => nombre('/sys/fs/cgroup/memory/memory.limit_in_bytes'),
  )
  return {
    processeurPct: processeur === null ? null : Math.round(processeur * 10) / 10,
    memoireMo: memoire === null || memoire >= MEMOIRE_SANS_PLAFOND ? null : Math.round(memoire / 1024 / 1024),
  }
}

/**
 * Ce que la commande de démarrage de l'hébergeur dit au ramasse-miettes (le
 * banc du 19 octobre 2026, `ramasseMiettes`) : un seul fil — ses fils d'aide
 * se disputaient le dixième de cœur sans finir plus tôt — ; pas de réducteur
 * de mémoire — il recompactait le tas au repos, 1,9 s de serveur figé — ; et
 * le tas plafonné, puisque plus rien ne le recompacte et que V8 ne lit pas les
 * 512 Mo du conteneur : 320 Mo, quand le serveur en tient 80 à 150 vivants.
 * `render.yaml` et la mise en ligne la recopient (`ramasse-miettes.test.ts`).
 */
export const DRAPEAUX_DU_RAMASSE_MIETTES = ['--single-threaded-gc', '--no-memory-reducer', '--max-old-space-size=320'] as const

/** Comment V8 ramasse ses miettes, tel que la commande de démarrage le lui dit, et le tas qu'il s'accorde. */
export interface RamasseMiettes {
  /** Sur le seul fil de la boucle (`--single-threaded-gc`). */
  unFil: boolean
  /** Le réducteur de mémoire, qui recompacte le tas au repos (`--no-memory-reducer` l'éteint). */
  reducteur: boolean
  /** Le tas que V8 s'accorde, en mégaoctets : `--max-old-space-size`, sinon sa règle — qui ne lit pas le conteneur. */
  tasMaxMo: number
}

/**
 * Le ramasse-miettes de ce processus (le banc du 19 octobre 2026). Au
 * dixième de cœur de l'hébergeur, V8 ramasse comme sur toute la machine : ses
 * fils d'aide — quatre, que Node lui donne — se disputent le dixième sans
 * finir plus tôt, et un tas qu'il croit de huit gigaoctets (il ne lit pas le
 * conteneur), il le recompacte au repos — une pause de 1,9 s au banc, juste
 * après le recalcul de la mesure et du modèle du savoir, quand tout semblait
 * calme. Ce qui le
 * règle tient dans la commande de démarrage (`NODE_OPTIONS` refuse ces
 * drapeaux) : `/healthz` et le journal de démarrage disent s'ils ont pris.
 */
export function ramasseMiettes(drapeaux: readonly string[] = process.execArgv, tasMax: number = getHeapStatistics().heap_size_limit): RamasseMiettes {
  // V8 lit `--single_threaded_gc` comme `--single-threaded-gc`, et `--single-threaded` l'emporte.
  const lus = drapeaux.map(d => d.replace(/_/g, '-'))
  return {
    unFil: lus.includes('--single-threaded-gc') || lus.includes('--single-threaded'),
    reducteur: !lus.includes('--no-memory-reducer') && !lus.includes('--nomemory-reducer'),
    tasMaxMo: Math.round(tasMax / 1024 / 1024),
  }
}

/**
 * Les connexions ouvertes sur le serveur, comptées à leur ouverture et à leur
 * fermeture : chaque téléphone et chaque écran du temps réel en tient une —
 * le temps réel passe par elle —, chaque page en cours de chargement aussi.
 * Comptées plutôt que demandées (`getConnections`, qui répond plus tard) :
 * le relevé de la charge les lit sans attendre.
 */
export function compteurDeConnexions(serveur: Server): () => number {
  let ouvertes = 0
  serveur.on('connection', (socket: Socket) => {
    ouvertes++
    socket.once('close', () => ouvertes--)
  })
  return () => ouvertes
}

/** Une mesure de plus au relevé, sous son propre filet : celle qui tombe se tait, le relevé part. */
function tenter<T>(mesure: () => T): T | null {
  try {
    return mesure()
  } catch {
    return null
  }
}

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
  private releves: { cpuPct: number; occupePct: number; p99Ms: number; maxMs: number; gelePct: number | null }[] = []
  private readonly versLHeure: ReleveHoraire
  private readonly invites: () => number
  private readonly gel: (() => number | null) | null
  private gelAvant: number | null
  private readonly connexions: (() => number) | null
  private readonly tempsReel: (() => number) | null
  private readonly reseau: (() => { recus: number; envoyes: number } | null) | null
  private reseauAvant: { recus: number; envoyes: number } | null

  /**
   * Chaque relevé part aussi au relevé de l'heure (`releve`), avec la mémoire
   * et les invités connectés — `invites`, que le serveur compte dans ses
   * soirées : la page « Le serveur » du QG montre la charge à côté de la
   * salle qui la fait —, le gel que l'hébergeur a imposé (`gel`, la sonde
   * du conteneur : `sondeDuGel`), les connexions ouvertes et les clients du
   * temps réel (`connexions`, `tempsReel`, que le serveur compte), et ce que
   * la machine a envoyé et reçu (`reseau`, `sondeDuReseau`).
   */
  constructor(
    periodeMs = 10_000,
    deps: {
      releve?: ReleveHoraire
      invites?: () => number
      gel?: (() => number | null) | null
      connexions?: () => number
      tempsReel?: () => number
      reseau?: (() => { recus: number; envoyes: number } | null) | null
    } = {},
  ) {
    this.versLHeure = deps.releve ?? releve
    this.invites = deps.invites ?? (() => 0)
    this.gel = deps.gel === undefined ? sondeDuGel() : deps.gel
    this.gelAvant = this.gel?.() ?? null
    this.connexions = deps.connexions ?? null
    this.tempsReel = deps.tempsReel ?? null
    this.reseau = deps.reseau === undefined ? sondeDuReseau() : deps.reseau
    this.reseauAvant = this.reseau?.() ?? null
    this.histogramme = monitorEventLoopDelay({ resolution: RESOLUTION_MS })
    this.histogramme.enable()
    // Le relevé lit l'histogramme puis le remet à zéro, et la remise à zéro
    // oublie l'instant de son dernier réveil : échu pendant un gel, le relevé
    // passait juste après lui, avant le réveil de l'histogramme — le gel ne
    // comptait nulle part. Un gel de deux secondes s'y perdait une fois sur
    // cinq, un de dix à chaque fois (le 2 novembre 2026, `gels.test.ts`). Un
    // tour de boucle d'abord : l'histogramme, échu lui aussi, le note avant.
    this.minuterie = setInterval(() => setImmediate(() => this.arrete || this.relever()), periodeMs)
    this.minuterie.unref()
  }

  private arrete = false

  private relever() {
    const maintenant = performance.now()
    const ecoule = maintenant - this.instant
    const cpu = process.cpuUsage(this.cpu)
    const elu = performance.eventLoopUtilization(this.elu)
    // Le gel de l'hébergeur depuis le relevé d'avant ; une lecture qui se tait ne compte pas.
    const gel = this.gel?.() ?? null
    const geleMs = gel !== null && this.gelAvant !== null ? Math.max(0, gel - this.gelAvant) / 1000 : null
    if (gel !== null) this.gelAvant = gel
    const r = {
      cpuPct: ((cpu.user + cpu.system) / 1000 / ecoule) * 100,
      occupePct: elu.utilization * 100,
      // L'histogramme compte en nanosecondes, résolution comprise : c'est le
      // retard au-delà de ce qu'on attendait qu'on veut lire.
      p99Ms: Math.max(0, this.histogramme.percentile(99) / 1e6 - RESOLUTION_MS),
      maxMs: Math.max(0, this.histogramme.max / 1e6 - RESOLUTION_MS),
      // Compté sur chaque cœur où le processus attendait : borné au temps écoulé.
      gelePct: geleMs === null ? null : Math.min(100, (geleMs / ecoule) * 100),
    }
    this.releves.push(r)
    if (this.releves.length > 6) this.releves.shift()
    // Le réseau depuis le relevé d'avant ; un compteur qui recule — une
    // interface recréée — ne compte pas, il sert de départ au suivant.
    const reseau = this.reseau?.() ?? null
    const avant = this.reseauAvant
    const envoyes = reseau && avant && reseau.envoyes >= avant.envoyes ? reseau.envoyes - avant.envoyes : null
    const recus = reseau && avant && reseau.recus >= avant.recus ? reseau.recus - avant.recus : null
    if (reseau) this.reseauAvant = reseau
    // Au relevé de l'heure, sous son propre filet : une mesure qui tombe —
    // la mémoire lève EMFILE sous `ulimit -n 64` — ne doit pas arrêter le pouls.
    try {
      let memoireMo: number | null = null
      try {
        memoireMo = Math.round(process.memoryUsage().rss / 1024 / 1024)
      } catch {
        // La mémoire se tait, le reste du relevé part.
      }
      this.versLHeure.charge({
        processeur: r.cpuPct,
        boucleMaxMs: r.maxMs,
        memoireMo,
        invites: this.invites(),
        gelePct: r.gelePct,
        connexions: this.connexions && tenter(this.connexions),
        tempsReel: this.tempsReel && tenter(this.tempsReel),
        envoyesOctets: envoyes,
        recusOctets: recus,
      })
    } catch (e) {
      console.error('[pouls] le relevé de charge n’a pas pu s’écrire dans l’heure :', e)
    }
    this.histogramme.reset()
    this.cpu = process.cpuUsage()
    this.elu = performance.eventLoopUtilization()
    this.instant = maintenant
  }

  lire() {
    const chronos = pouls.chronos.lire()
    const r = this.releves
    const moyenne = (f: (x: (typeof r)[number]) => number) =>
      r.length ? Math.round(r.reduce((s, x) => s + f(x), 0) / r.length) : null
    const pire = (f: (x: (typeof r)[number]) => number) => (r.length ? Math.round(Math.max(...r.map(f))) : null)
    const geles = r.map(x => x.gelePct).filter((x): x is number => x !== null)
    return {
      cpuPct: moyenne(x => x.cpuPct),
      boucleOccupeePct: moyenne(x => x.occupePct),
      retardBoucleP99Ms: pire(x => x.p99Ms),
      retardBoucleMaxMs: pire(x => x.maxMs),
      // La part du temps où l'hébergeur a gelé le processus faute de processeur, en moyenne et au pire ; null hors d'un conteneur qui le dit.
      geleePct: geles.length ? Math.round(geles.reduce((s, x) => s + x, 0) / geles.length) : null,
      geleeMaxPct: geles.length ? Math.round(Math.max(...geles)) : null,
      retardChronosMaxMs: chronos.max,
      // Combien de chronomètres ont sonné : un retard de 0 ne veut rien dire
      // si aucun n'a été mesuré.
      chronosMesures: chronos.n,
    }
  }

  arreter() {
    this.arrete = true
    clearInterval(this.minuterie)
    this.histogramme.disable()
  }
}
