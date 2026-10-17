// La santé du serveur sur sept jours, au QG (`/admin#serveur`, les choix du
// 13 octobre 2026) : ce que les joueurs attendent — un aller-retour vers
// Turso, une route d'API —, les réveils et les arrêts, les erreurs, et la
// charge — processeur, boucle, mémoire, à côté des invités connectés —,
// heure par heure, gardés dans la base permanente : la mémoire et la base
// locale s'effacent à chaque réveil de l'hébergeur, et `/healthz` ne dit que
// la minute en cours. La charge, d'abord laissée au direct, a rejoint la
// page le même jour : sans elle, la page disait qu'une soirée avait été
// lente, pas pourquoi — et seule la production dira combien d'invités le
// dixième de cœur de l'hébergeur tient (`core/pouls.ts`).
//
// Des dérivations pures : le serveur les calcule sur ce que la base garde
// (`server/src/core/santeDuServeur.ts`), les tests les jouent sans serveur.

import { formatNumber } from './typographie'

export const HEURE_MS = 3_600_000
/** Ce que la page montre. */
export const JOURS_DE_SANTE = 7
export const HEURES_DE_SANTE = JOURS_DE_SANTE * 24
/** Ce que la base garde : un jour de plus que la page n'en montre, pour l'heure à cheval sur le bord. */
export const SANTE_GARDEE_MS = (JOURS_DE_SANTE + 1) * 24 * HEURE_MS
/**
 * L'heure en cours se réécrit toutes les dix minutes, et le démarrage dit
 * qu'il vit : un arrêt net n'emporte que ces minutes-là. Une ligne par heure
 * et par démarrage — six écritures de l'heure ne font qu'une ligne au quota.
 */
export const RELEVE_MS = 10 * 60_000
/**
 * Sans extinction propre, et sans un signe depuis deux relevés, un démarrage
 * s'est arrêté net — plantage, mémoire pleine. Un seul relevé de silence ne
 * suffit pas : à une mise en ligne, l'ancien serveur vit encore quelques
 * instants à côté du nouveau, et son extinction s'écrit après.
 */
export const SILENCE_D_UN_ARRET_MS = 2 * RELEVE_MS
/** Au-delà d'une seconde au 95ᵉ centile, chaque page attend la base. */
export const TURSO_LENT_MS = 1000
/**
 * La garde du `fetch` de Node : undici referme une connexion restée inactive
 * 4 s quand le serveur ne dit pas son délai (`keepAliveTimeout`). Turso ne le
 * dit pas, et chaque connexion rouverte repayait sa poignée de main — 225 ms
 * l'aller-retour contre 29 sur une connexion gardée, en production, le 14
 * octobre 2026. Une garde plus longue n'y pouvait rien : Turso referme
 * lui-même à 5 s (`server/src/core/connexions.ts`).
 */
export const GARDE_DE_NODE_MS = 4_000
/** Un 95ᵉ centile ne se juge pas sur trois allers-retours : ceux du réveil, plus lents, le feraient mentir. */
export const ALLERS_RETOURS_POUR_JUGER = 20
/** L'hébergeur gratuit donne 512 Mo et tue l'instance au-delà : l'alerte s'allume un peu avant. */
export const MEMOIRE_PLAFOND_MO = 450
export const MEMOIRE_DE_L_HEBERGEUR_MO = 512
/** Et un dixième de cœur : au-delà, le processus attend son tour — le trait du graphique du processeur. */
export const PROCESSEUR_DE_L_HEBERGEUR_PCT = 10
/** Un arrêt net se signale un jour durant. */
export const ARRET_RECENT_MS = 24 * HEURE_MS
/** Une route n'est « la plus lente » que sur assez d'appels : un seul appel lent au réveil n'en dit rien. */
export const APPELS_POUR_UNE_LENTE = 5
export const APPELS_POUR_LA_PLUS_LENTE = 20

/** Le début de l'heure d'un instant — la même à Paris, dont le décalage compte en heures entières. */
export const debutDeLHeure = (instant: number) => Math.floor(instant / HEURE_MS) * HEURE_MS

/** « 180 ms », « 1,4 s » : un temps de réponse, insécable — « ms » seul en début de ligne ne se lisait pas. */
export function tempsDeReponse(ms: number): string {
  return ms < 1000 ? `${formatNumber(Math.round(ms))} ms` : `${formatNumber(Math.round(ms / 100) / 10)} s`
}

// ── Ce que la base garde ──────────────────────────────────────────────────

/** Une grandeur sur une heure : combien, la médiane, le 95ᵉ centile, la pire — en millisecondes. */
export interface Releve {
  n: number
  p50: number
  p95: number
  max: number
}

export interface RouteLente {
  /** Le modèle de la route (`GET /api/jour`), jamais son adresse : elle peut porter un identifiant. */
  route: string
  n: number
  p95: number
}

/**
 * La charge d'une heure, relevée toutes les dix secondes (`Charge`,
 * `core/pouls.ts`) : le processeur en moyenne et au pire, le pire gel de la
 * boucle, le pic de mémoire, et le pic d'invités connectés — la salle qui la
 * fait. `n` : les relevés, pour fondre deux démarrages de la même heure.
 */
export interface ChargeDeLHeure {
  n: number
  /** En pour cent d'un cœur : l'hébergeur gratuit n'en donne qu'un dixième. */
  processeur: number
  processeurMax: number
  boucleMaxMs: number
  memoireMaxMo: number
  invitesMax: number
  /**
   * La part de l'heure où l'hébergeur a gelé le processus faute de
   * processeur, en moyenne et au pire relevé (`sondeDuGel`, `core/pouls.ts`) :
   * ce qui fige la boucle et allonge chaque aller-retour vers Turso, sans que
   * Turso y soit pour rien. Absente hors d'un conteneur qui le dit, et des
   * lignes d'avant le 16 octobre 2026.
   */
  gelePct?: number
  geleMaxPct?: number
}

/**
 * Les connexions vers Turso d'une heure (`core/connexions.ts`, la revue du 14
 * octobre 2026) : celles qui se sont ouvertes — chacune a refait sa poignée
 * de main —, celles que la base a refermées d'elle-même, les allers-retours
 * tombés en route, la garde en vigueur, et l'entretien qui les garde chaudes.
 * Une garde plus longue que le délai de Turso se voyait aux deux comptes du
 * milieu : c'est ainsi qu'on l'a lu, 5 s, le 14 octobre 2026.
 */
export interface ConnexionsDeLHeure {
  /** Ouvertes pour un joueur — celles qu'un battement a ouvertes comptent à part. */
  ouvertes: number
  /** Refermées par la base pendant que le serveur les gardait : son délai d'inactivité est plus court que la garde. */
  refermeesParLaBase: number
  /** L'âge de la plus jeune qu'elle a refermée : le délai de Turso tient en dessous. Null si elle n'en a refermé aucune. */
  plusJeuneRefermeeMs: number | null
  /** Réseau coupé, connexion fermée sous la requête, délai dépassé. */
  echecs: number
  /** Combien de temps une connexion inactive se garde : celle de Node (`GARDE_DE_NODE_MS`) — 30 s dans les heures du 14 octobre 2026 où `QUIZ_DB_KEEPALIVE_MS` valait. */
  gardeMs: number
  /**
   * Le délai que la base annonce (`Keep-Alive: timeout=…`), le plus long de
   * l'heure ; null si elle n'en dit rien. Undici le préfère à la garde : une
   * garde plus longue ne sert à rien, la base referme à son heure.
   */
  annonceeMs: number | null
  /** Gardées chaudes cette heure-là (`QUIZ_DB_KEEPWARM`) ; absent d'une ligne d'avant l'entretien. */
  chaudes?: boolean
  /** Les battements de l'entretien — un `SELECT 1` avant qu'une connexion ait trois secondes de calme, tant qu'un joueur est là —, ceux qui sont tombés, et les connexions qu'ils ont dû ouvrir. */
  battements?: number
  battementsTombes?: number
  ouvertesParUnBattement?: number
}

/** Une heure d'un démarrage, telle que la base la garde (`qg_sante`). */
export interface HeureDeSante {
  heure: number
  demarrage: string
  /** Les allers-retours vers Turso. */
  base: Releve | null
  /** Les routes d'API, toutes ensemble : ce qu'un joueur attend. */
  routes: Releve | null
  /** Les trois routes les plus lentes de l'heure, au 95ᵉ centile, appelées au moins cinq fois. */
  lentes: RouteLente[]
  /** Les erreurs serveur, par source : une route (`POST /api/jour/reponse`), un socket (`socket host:launch`), une exception échappée. */
  erreurs: Record<string, number>
  /** Les envois au miroir qui ont échoué : l'écran commun le dit déjà, la semaine s'en souvient. */
  miroir: number
  /** Null sans un relevé de charge — une heure à peine commencée, ou une ligne d'avant. */
  charge: ChargeDeLHeure | null
  /** Null pour une ligne d'avant le compte des connexions. */
  connexions: ConnexionsDeLHeure | null
}

/** Un démarrage du serveur, tel que la base le garde (`qg_demarrages`). */
export interface DemarrageDuServeur {
  id: string
  demarreLe: number
  /** Du lancement du serveur au port ouvert : ce qu'un réveil fait attendre, l'hébergeur en plus. */
  pretEnMs: number | null
  /** Le commit qui tourne, sept caractères ; null hors de l'hébergeur. */
  version: string | null
  env: string | null
  /** Son dernier signe : un relevé, toutes les dix minutes. */
  vuLe: number
  /** Son extinction propre — la veille de l'hébergeur, une mise en ligne ; null s'il vit encore, ou s'il s'est arrêté net. */
  arreteLe: number | null
}

// ── Ce que la page montre ─────────────────────────────────────────────────

/**
 * Pourquoi le serveur a démarré, lu dans le démarrage d'avant : une version
 * neuve, une mise en ligne ; l'ancien éteint juste après, une relance ;
 * l'ancien arrêté net, un redémarrage ; sinon, le réveil après la veille de
 * l'hébergeur — la nuit, ou un quart d'heure sans visite.
 */
export type SorteDeDemarrage = 'reveil' | 'mise-en-ligne' | 'relance' | 'apres-arret'

export interface EvenementDuServeur {
  quand: number
  sorte: SorteDeDemarrage | 'arret-net'
  /** Un démarrage : le temps qu'il a mis à être prêt. */
  pretEnMs: number | null
  version: string | null
}

export interface HeureDuServeur {
  heure: number
  /** Le serveur vivait à cette heure-là ; sinon l'hébergeur l'avait endormi — rien n'y a été mesuré. */
  eveille: boolean
  /** Le 95ᵉ centile de Turso et des routes ; null sans un appel. */
  base: number | null
  routes: number | null
  erreurs: number
  miroir: number
  /** La charge de l'heure : le processeur en moyenne (en pour cent d'un cœur), le pire gel, les pics de mémoire et d'invités ; null sans relevé. */
  processeur: number | null
  /** La part de l'heure gelée par l'hébergeur, faute de processeur ; null sans relevé qui le dise. */
  gele: number | null
  boucle: number | null
  memoire: number | null
  invites: number | null
  /** La part des allers-retours vers Turso qui ont ouvert leur connexion, en pour cent ; null sans aller-retour, ou pour une heure d'avant le compte. */
  connexionsNeuves: number | null
  connexions: ConnexionsDeLHeure | null
}

export interface PageDuServeur {
  maintenant: number
  /** Le démarrage qui répond. */
  enMarche: { depuis: number; version: string | null; env: string | null }
  /** Les cent soixante-huit dernières heures, de la plus ancienne à celle-ci. */
  heures: HeureDuServeur[]
  chiffres: {
    demarrages: { n: number; plusLongMs: number | null }
    arretsNets: number
    erreurs: { n: number; derniere: number | null; sources: { source: string; n: number }[] }
    /** Le 95ᵉ centile de la dernière heure mesurée, et celui d'habitude : la médiane des heures de la semaine. */
    base: { derniere: number | null; habituelle: number | null }
    routes: { derniere: number | null; habituelle: number | null; plusLente: { route: string; p95: number } | null }
  }
  /** Les démarrages et les arrêts nets, du plus récent au plus ancien. */
  evenements: EvenementDuServeur[]
}

/** Ce qui, du serveur, attend un geste dans « À traiter » (le choix du 13 octobre 2026 : les quatre). */
export interface AlertesDuServeur {
  /** Le dernier démarrage arrêté net, ces dernières vingt-quatre heures : vers quand — son dernier signe. */
  arretNet: { vers: number } | null
  /** Les erreurs serveur depuis le début de l'heure d'avant, et la source qui en donne le plus. */
  erreurs: { n: number; depuis: number; source: string } | null
  /** Turso au-delà d'une seconde, au 95ᵉ centile de l'heure. */
  tursoLent: { p95: number; depuis: number } | null
  /** La mémoire du processus, quand elle approche le plafond de l'hébergeur. */
  memoireMo: number | null
}

// ── Les dérivations ───────────────────────────────────────────────────────

/**
 * Deux relevés d'une même heure — deux démarrages s'y sont suivis — en un :
 * les appels s'ajoutent, la médiane se pondère, le 95ᵉ centile et le pire
 * gardent le pire des deux. Un centile ne s'additionne pas : le pire est le
 * seul qui ne ment pas dans le bon sens.
 */
export function fondreReleves(a: Releve | null, b: Releve | null): Releve | null {
  if (!a || a.n === 0) return b && b.n > 0 ? b : null
  if (!b || b.n === 0) return a
  const n = a.n + b.n
  return { n, p50: Math.round((a.p50 * a.n + b.p50 * b.n) / n), p95: Math.max(a.p95, b.p95), max: Math.max(a.max, b.max) }
}

/** La charge de deux démarrages dans la même heure : la moyenne se pondère par les relevés, les pics gardent le pire. */
export function fondreCharges(a: ChargeDeLHeure | null, b: ChargeDeLHeure | null): ChargeDeLHeure | null {
  if (!a || a.n === 0) return b && b.n > 0 ? b : null
  if (!b || b.n === 0) return a
  const n = a.n + b.n
  // Le gel ne se pondère que sur les relevés qui le disent : une ligne d'avant n'en dit rien.
  const geles = [a, b].filter((c): c is ChargeDeLHeure & { gelePct: number } => typeof c.gelePct === 'number')
  const relevesGeles = geles.reduce((s, c) => s + c.n, 0)
  return {
    n,
    processeur: Math.round(((a.processeur * a.n + b.processeur * b.n) / n) * 10) / 10,
    processeurMax: Math.max(a.processeurMax, b.processeurMax),
    boucleMaxMs: Math.max(a.boucleMaxMs, b.boucleMaxMs),
    memoireMaxMo: Math.max(a.memoireMaxMo, b.memoireMaxMo),
    invitesMax: Math.max(a.invitesMax, b.invitesMax),
    ...(geles.length > 0 && {
      gelePct: Math.round((geles.reduce((s, c) => s + c.gelePct * c.n, 0) / relevesGeles) * 10) / 10,
      geleMaxPct: Math.max(...geles.map(c => c.geleMaxPct ?? c.gelePct)),
    }),
  }
}

/**
 * Les connexions de deux démarrages dans la même heure : les comptes
 * s'ajoutent, la plus jeune refermée reste la plus jeune, la garde la plus
 * longue l'emporte, et l'heure est gardée chaude si l'un des deux l'a été.
 * Deux lignes d'avant l'entretien n'en disent rien.
 */
export function fondreConnexions(a: ConnexionsDeLHeure | null, b: ConnexionsDeLHeure | null): ConnexionsDeLHeure | null {
  if (!a) return b
  if (!b) return a
  const ages = [a.plusJeuneRefermeeMs, b.plusJeuneRefermeeMs].filter((ms): ms is number => ms !== null)
  const annonces = [a.annonceeMs, b.annonceeMs].filter((ms): ms is number => typeof ms === 'number')
  const entretien = a.chaudes !== undefined || b.chaudes !== undefined
  const somme = (cle: 'battements' | 'battementsTombes' | 'ouvertesParUnBattement') => (a[cle] ?? 0) + (b[cle] ?? 0)
  return {
    ouvertes: a.ouvertes + b.ouvertes,
    refermeesParLaBase: a.refermeesParLaBase + b.refermeesParLaBase,
    plusJeuneRefermeeMs: ages.length ? Math.min(...ages) : null,
    echecs: a.echecs + b.echecs,
    gardeMs: Math.max(a.gardeMs, b.gardeMs),
    annonceeMs: annonces.length ? Math.max(...annonces) : null,
    ...(entretien && {
      chaudes: !!(a.chaudes || b.chaudes),
      battements: somme('battements'),
      battementsTombes: somme('battementsTombes'),
      ouvertesParUnBattement: somme('ouvertesParUnBattement'),
    }),
  }
}

/**
 * La part des allers-retours qui ont ouvert leur connexion, en pour cent :
 * à 100, chacun a refait sa poignée de main. Un aller-retour tombé en route
 * a pu ouvrir la sienne sans compter parmi ceux qui ont abouti — d'où la
 * borne.
 */
export function partDesConnexionsNeuves(base: Releve | null, connexions: ConnexionsDeLHeure | null): number | null {
  if (!connexions || !base || base.n === 0) return null
  return Math.min(100, Math.round((connexions.ouvertes / base.n) * 100))
}

/** Les lignes d'une même heure, tous démarrages confondus. */
export function fondreLHeure(lignes: readonly HeureDeSante[]): Omit<HeureDeSante, 'demarrage'> | null {
  if (lignes.length === 0) return null
  const erreurs: Record<string, number> = {}
  const lentes = new Map<string, RouteLente>()
  let base: Releve | null = null
  let routes: Releve | null = null
  let charge: ChargeDeLHeure | null = null
  let connexions: ConnexionsDeLHeure | null = null
  let miroir = 0
  for (const l of lignes) {
    base = fondreReleves(base, l.base)
    routes = fondreReleves(routes, l.routes)
    // Une ligne d'avant la charge n'en porte pas, ni d'avant le compte des connexions.
    charge = fondreCharges(charge, l.charge ?? null)
    connexions = fondreConnexions(connexions, l.connexions ?? null)
    miroir += l.miroir
    for (const [source, n] of Object.entries(l.erreurs)) erreurs[source] = (erreurs[source] ?? 0) + n
    for (const r of l.lentes) {
      const avant = lentes.get(r.route)
      lentes.set(r.route, avant ? { route: r.route, n: avant.n + r.n, p95: Math.max(avant.p95, r.p95) } : r)
    }
  }
  return {
    heure: lignes[0].heure,
    base,
    routes,
    lentes: [...lentes.values()].sort((a, b) => b.p95 - a.p95).slice(0, 3),
    erreurs,
    miroir,
    charge,
    connexions,
  }
}

const totalDesErreurs = (erreurs: Record<string, number>) => Object.values(erreurs).reduce((s, n) => s + n, 0)

/** La médiane d'une liste, arrondie ; null si elle est vide. */
function mediane(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) return null
  const v = [...valeurs].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return Math.round(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2)
}

/**
 * Un démarrage arrêté net : ni extinction propre, ni signe depuis deux
 * relevés, et ce n'est pas celui qui répond. Celui qui vit encore à côté —
 * l'ancien, juste après une mise en ligne — n'est pas jugé tant qu'il donne
 * signe de vie.
 */
export function arreteNet(d: DemarrageDuServeur, maintenant: number, courant: string): boolean {
  return d.id !== courant && d.arreteLe === null && maintenant - d.vuLe > SILENCE_D_UN_ARRET_MS
}

/** L'ancien serveur éteint dans la minute de ce démarrage : on l'a relancé, il ne dormait pas. */
const RELEVE_DE_L_ANCIEN_MS = 60_000

/** Pourquoi ce démarrage, lu dans celui d'avant (`SorteDeDemarrage`). */
export function sorteDuDemarrage(d: DemarrageDuServeur, avant: DemarrageDuServeur | undefined, maintenant: number, courant: string): SorteDeDemarrage {
  if (!avant) return 'reveil'
  if (d.version && avant.version && d.version !== avant.version) return 'mise-en-ligne'
  if (avant.arreteLe === null) return arreteNet(avant, maintenant, courant) ? 'apres-arret' : 'relance'
  return avant.arreteLe >= d.demarreLe - RELEVE_DE_L_ANCIEN_MS ? 'relance' : 'reveil'
}

/** Jusqu'où un démarrage a vécu : son extinction, sinon maintenant s'il répond, sinon son dernier signe. */
const finDe = (d: DemarrageDuServeur, maintenant: number, courant: string) => d.arreteLe ?? (d.id === courant ? maintenant : d.vuLe)

/**
 * La page « Le serveur » : sept jours heure par heure, les démarrages et les
 * arrêts nets, et quatre chiffres. `demarrages` porte aussi le dernier
 * démarrage d'avant la semaine : la sorte du premier se lit dans lui.
 */
export function pageDuServeur(
  lignes: readonly HeureDeSante[],
  demarrages: readonly DemarrageDuServeur[],
  { maintenant, courant }: { maintenant: number; courant: DemarrageDuServeur },
): PageDuServeur {
  const derniere = debutDeLHeure(maintenant)
  const debut = derniere - (HEURES_DE_SANTE - 1) * HEURE_MS
  // Celui qui répond, même si son démarrage n'est pas encore arrivé jusqu'à la base.
  const tous = [...demarrages.filter(d => d.id !== courant.id), courant].sort((a, b) => a.demarreLe - b.demarreLe)

  const parHeure = new Map<number, HeureDeSante[]>()
  for (const l of lignes) {
    if (l.heure < debut || l.heure > derniere) continue
    parHeure.set(l.heure, [...(parHeure.get(l.heure) ?? []), l])
  }
  const vies = tous.map(d => [d.demarreLe, finDe(d, maintenant, courant.id)] as const)
  const heures: HeureDuServeur[] = []
  const fondues: Omit<HeureDeSante, 'demarrage'>[] = []
  for (let heure = debut; heure <= derniere; heure += HEURE_MS) {
    const h = fondreLHeure(parHeure.get(heure) ?? [])
    if (h) fondues.push(h)
    heures.push({
      heure,
      eveille: h !== null || vies.some(([de, a]) => de < heure + HEURE_MS && a >= heure),
      base: h?.base?.p95 ?? null,
      routes: h?.routes?.p95 ?? null,
      erreurs: h ? totalDesErreurs(h.erreurs) : 0,
      miroir: h?.miroir ?? 0,
      processeur: h?.charge?.processeur ?? null,
      gele: h?.charge?.gelePct ?? null,
      boucle: h?.charge?.boucleMaxMs ?? null,
      memoire: h?.charge?.memoireMaxMo ?? null,
      invites: h?.charge?.invitesMax ?? null,
      connexionsNeuves: h ? partDesConnexionsNeuves(h.base, h.connexions) : null,
      connexions: h?.connexions ?? null,
    })
  }

  // Les erreurs de la semaine, par source.
  const sources = new Map<string, number>()
  for (const h of fondues) for (const [s, n] of Object.entries(h.erreurs)) sources.set(s, (sources.get(s) ?? 0) + n)
  const avecErreurs = heures.filter(h => h.erreurs > 0)

  // La plus lente de la semaine : son 95ᵉ centile moyen, pondéré par ses appels, sur assez d'appels.
  const lentes = new Map<string, { n: number; somme: number }>()
  for (const h of fondues) {
    for (const r of h.lentes) {
      const avant = lentes.get(r.route) ?? { n: 0, somme: 0 }
      lentes.set(r.route, { n: avant.n + r.n, somme: avant.somme + r.p95 * r.n })
    }
  }
  const plusLente = [...lentes]
    .filter(([, l]) => l.n >= APPELS_POUR_LA_PLUS_LENTE)
    .map(([route, l]) => ({ route, p95: Math.round(l.somme / l.n) }))
    .sort((a, b) => b.p95 - a.p95)[0]

  const mesurees = (f: (h: Omit<HeureDeSante, 'demarrage'>) => Releve | null) => fondues.map(f).filter((r): r is Releve => r !== null)
  const base = mesurees(h => h.base)
  const routes = mesurees(h => h.routes)
  const assez = (rs: Releve[]) => rs.filter(r => r.n >= APPELS_POUR_UNE_LENTE).map(r => r.p95)

  // Les événements : chaque démarrage de la semaine, et chaque arrêt net.
  const evenements: EvenementDuServeur[] = []
  tous.forEach((d, i) => {
    if (d.demarreLe >= debut) {
      evenements.push({ quand: d.demarreLe, sorte: sorteDuDemarrage(d, tous[i - 1], maintenant, courant.id), pretEnMs: d.pretEnMs, version: d.version })
    }
    if (arreteNet(d, maintenant, courant.id) && d.vuLe >= debut) evenements.push({ quand: d.vuLe, sorte: 'arret-net', pretEnMs: null, version: d.version })
  })
  evenements.sort((a, b) => b.quand - a.quand)
  const demarresCetteSemaine = tous.filter(d => d.demarreLe >= debut)
  const prets = demarresCetteSemaine.map(d => d.pretEnMs).filter((ms): ms is number => ms !== null)

  return {
    maintenant,
    enMarche: { depuis: courant.demarreLe, version: courant.version, env: courant.env },
    heures,
    chiffres: {
      demarrages: { n: demarresCetteSemaine.length, plusLongMs: prets.length ? Math.max(...prets) : null },
      arretsNets: evenements.filter(e => e.sorte === 'arret-net').length,
      erreurs: {
        n: avecErreurs.reduce((s, h) => s + h.erreurs, 0),
        derniere: avecErreurs.at(-1)?.heure ?? null,
        sources: [...sources]
          .map(([source, n]) => ({ source, n }))
          .sort((a, b) => b.n - a.n)
          .slice(0, 3),
      },
      base: { derniere: base.at(-1)?.p95 ?? null, habituelle: mediane(assez(base)) },
      routes: { derniere: routes.at(-1)?.p95 ?? null, habituelle: mediane(assez(routes)), plusLente: plusLente ?? null },
    },
    evenements,
  }
}

/**
 * Ce qui, du serveur, mérite une ligne dans « À traiter ». `recentes` : le
 * relevé de ce démarrage — l'heure en cours, et celle d'avant si elle la
 * précède — ; `demarrages`, ceux qui ont donné signe de vie ce dernier jour.
 * Les erreurs comptent depuis le début de l'heure d'avant : une erreur de
 * 20 h 59 se voit encore à 21 h 05.
 */
export function alertesDuServeur({
  recentes,
  demarrages,
  memoireMo,
  maintenant,
  courant,
}: {
  recentes: readonly HeureDeSante[]
  demarrages: readonly DemarrageDuServeur[]
  memoireMo: number | null
  maintenant: number
  courant: string
}): AlertesDuServeur {
  const cetteHeure = debutDeLHeure(maintenant)
  const lues = recentes.filter(h => h.heure === cetteHeure || h.heure === cetteHeure - HEURE_MS).sort((a, b) => a.heure - b.heure)

  const sources = new Map<string, number>()
  for (const h of lues) for (const [s, n] of Object.entries(h.erreurs)) sources.set(s, (sources.get(s) ?? 0) + n)
  const total = [...sources.values()].reduce((s, n) => s + n, 0)
  const premiere = [...sources].sort((a, b) => b[1] - a[1])[0]
  const depuis = lues.find(h => totalDesErreurs(h.erreurs) > 0)?.heure ?? cetteHeure

  // Turso se juge sur l'heure en cours dès qu'elle a assez d'allers-retours, sinon sur celle d'avant.
  const jugee = [...lues].reverse().find(h => (h.base?.n ?? 0) >= ALLERS_RETOURS_POUR_JUGER)
  const arrets = demarrages.filter(d => arreteNet(d, maintenant, courant) && maintenant - d.vuLe <= ARRET_RECENT_MS).sort((a, b) => b.vuLe - a.vuLe)

  return {
    arretNet: arrets[0] ? { vers: arrets[0].vuLe } : null,
    erreurs: total > 0 && premiere ? { n: total, depuis, source: premiere[0] } : null,
    tursoLent: jugee?.base && jugee.base.p95 > TURSO_LENT_MS ? { p95: jugee.base.p95, depuis: jugee.heure } : null,
    memoireMo: memoireMo !== null && memoireMo > MEMOIRE_PLAFOND_MO ? memoireMo : null,
  }
}
