import type { PanneDUnMode } from './pannes'
import type { EtatDuPoint } from './pointDuMatin'
import { formatNumber } from './typographie'
import { HEURE_MS, MEMOIRE_PLAFOND_MO, PART_DU_QUOTA_EN_ALERTE, SAUVEGARDE_ANCIENNE_MS, TURSO_LENT_MS } from './santeDuServeur'

/**
 * Les alertes du QG et leurs incidents (le QG 2, lot 8 ; la proposition du 3
 * novembre 2026, « Les alertes et les incidents ») : les six alertes qui
 * existaient — la panne d'un mode, l'arrêt net, les erreurs à regarder, Turso
 * lent, la mémoire, le quota — et huit de plus — le ressenti dégradé, le taux
 * d'erreur, un gel long, le miroir en retard, la réserve du quiz du jour, le
 * silence anormal, le rappel du soir en échec, la version qui ralentit. Puis
 * deux arrêts que rien ne guettait (la revue d'expert du 4 novembre 2026,
 * `retours/2026-11-04/experts/analyse-et-management.md`, P1.5) : la sauvegarde
 * trop ancienne, et les heures de l'hébergeur. Chaque règle a son seuil,
 * réglable — un réglage d'exploitation, jamais un barème du jeu —, sa gravité,
 * et sonne au QG et, si on le choisit, sur le téléphone de l'administrateur.
 * Chaque fois qu'elle s'ouvre, un incident naît, avec son début, sa fin, sa
 * cause et un mot.
 */

export const GRAVITES = ['critique', 'serieux', 'veille'] as const
export type Gravite = (typeof GRAVITES)[number]
export const NOM_DE_LA_GRAVITE: Record<Gravite, string> = { critique: 'critique', serieux: 'sérieuse', veille: 'à surveiller' }

export const CLES_DES_REGLES = [
  'panne',
  'arret-net',
  'erreurs',
  'miroir',
  'taux-d-erreur',
  'memoire',
  'sauvegarde',
  'ressenti',
  'turso-lent',
  'gel-long',
  'quota',
  'hebergeur',
  'version',
  'reserve',
  'rappel',
  'silence',
] as const
export type CleDeRegle = (typeof CLES_DES_REGLES)[number]

/** Un seuil réglable : sa valeur d'office, ses bornes, son pas, son unité. */
export interface SeuilDUneRegle {
  defaut: number
  /**
   * Sa valeur d'office sur un serveur qui n'est pas la production — la
   * préproduction (`APP_ENV`) : les heures de l'hébergeur se partagent entre
   * les deux services, et la production en prend d'office la plus grande part.
   */
  horsProduction?: number
  min: number
  max: number
  pas: number
  unite: 'ms' | 'Mo' | '%' | 'jours' | 'heures'
}

/** La page où l'on agit sur ce qu'une règle dit. */
export type PageDUneRegle = 'erreurs' | 'serveur' | 'base' | 'jour' | 'direct'

export interface RegleDuQg {
  cle: CleDeRegle
  nom: string
  /** Ce qu'elle guette, en une phrase : le seuil s'y lit. */
  quoi: string
  seuil: SeuilDUneRegle | null
  /** Sur quoi elle se juge. */
  sur: string
  gravite: Gravite
  /**
   * Le téléphone sonne d'office : la panne d'un mode, depuis le 19 octobre 2026 ; le taux d'erreur et le miroir, proposés
   * avec elle ; les heures de l'hébergeur, dont l'épuisement suspend les deux services jusqu'au 1er.
   */
  telephone: boolean
  page: PageDUneRegle
  /**
   * Venue avec la page des alertes ou après elle : les huit de la proposition du 3 novembre 2026, les deux de la revue
   * du 4. Les six autres sonnaient déjà au QG.
   */
  neuve: boolean
}

/** Un jour, pour les seuils qui se comptent en jours. */
const JOUR_MS = 24 * HEURE_MS

/**
 * Les heures éveillées que l'offre gratuite de Render donne chaque mois, aux
 * deux services ensemble — la production et la préproduction : épuisées, elles
 * les suspendent tous deux jusqu'au 1er (règle `exploitation.md`).
 */
export const HEURES_DE_L_OFFRE = 750

/**
 * La part de la production, d'office : la veille de cron-job.org la tient
 * éveillée de 7 h à minuit, environ 520 heures d'un mois de trente jours, 540
 * d'un mois de trente et un — plus quelques visites de nuit. La moitié des 750
 * l'aurait dite en alerte tout le mois, sans rien de changé ; la préproduction
 * prend d'office le reste (`horsProduction`), et chacun se règle sur sa part.
 */
export const HEURES_DE_LA_PRODUCTION = 560

export const REGLES_DU_QG: readonly RegleDuQg[] = [
  {
    cle: 'panne',
    nom: 'Un mode de jeu en panne',
    quoi: 'une route d’un mode échoue trois fois en dix minutes, et plus souvent qu’elle ne réussit',
    seuil: null,
    sur: 'dix minutes',
    gravite: 'critique',
    telephone: true,
    page: 'erreurs',
    neuve: false,
  },
  {
    cle: 'arret-net',
    nom: 'Arrêt net',
    quoi: 'un démarrage sans extinction propre ni signe de vie depuis vingt minutes',
    seuil: null,
    sur: 'vingt-quatre heures',
    gravite: 'critique',
    telephone: false,
    page: 'serveur',
    neuve: false,
  },
  {
    cle: 'erreurs',
    nom: 'Erreurs serveur à regarder',
    quoi: 'une erreur que tu n’as ni réglée ni ignorée, depuis le début de l’heure d’avant',
    seuil: null,
    sur: 'l’heure',
    gravite: 'serieux',
    telephone: false,
    page: 'erreurs',
    neuve: false,
  },
  {
    cle: 'miroir',
    nom: 'Miroir en retard',
    quoi: 'une soirée qui ne se sauvegarde plus : Turso en échec, ou un salon en retard',
    seuil: null,
    sur: 'l’instant',
    gravite: 'critique',
    telephone: true,
    page: 'base',
    neuve: true,
  },
  {
    cle: 'taux-d-erreur',
    nom: 'Taux d’erreur',
    quoi: 'la part des requêtes en erreur serveur, sur cinquante requêtes au moins',
    seuil: { defaut: 1, min: 0.5, max: 50, pas: 0.5, unite: '%' },
    sur: 'un quart d’heure',
    gravite: 'serieux',
    telephone: true,
    page: 'erreurs',
    neuve: true,
  },
  {
    cle: 'memoire',
    nom: 'Mémoire haute',
    quoi: 'la mémoire du processus, sur les 512 Mo de l’hébergeur',
    seuil: { defaut: MEMOIRE_PLAFOND_MO, min: 200, max: 510, pas: 10, unite: 'Mo' },
    sur: 'l’instant',
    gravite: 'serieux',
    telephone: false,
    page: 'serveur',
    neuve: false,
  },
  {
    // La page « Base et miroir » la disait en rouge, mais rien ne sonnait : un geste sans retour — un espace supprimé
    // « en reprenant » — ou une panne de Turso coûtait l'historique sans qu'on l'ait vu venir.
    cle: 'sauvegarde',
    nom: 'Sauvegarde ancienne',
    quoi: 'la dernière sauvegarde de la base permanente (npm run sauvegarde) date de plus de tant de jours, ou il n’y en a jamais eu',
    seuil: { defaut: SAUVEGARDE_ANCIENNE_MS / JOUR_MS, min: 1, max: 60, pas: 1, unite: 'jours' },
    sur: 'chaque heure',
    gravite: 'serieux',
    telephone: false,
    page: 'base',
    neuve: true,
  },
  {
    cle: 'ressenti',
    nom: 'Ressenti dégradé',
    quoi: 'ce qu’un joueur attend — le 95ᵉ centile des routes d’API —, sur vingt appels au moins',
    seuil: { defaut: 800, min: 200, max: 5000, pas: 50, unite: 'ms' },
    sur: 'dix minutes',
    gravite: 'veille',
    telephone: false,
    page: 'direct',
    neuve: true,
  },
  {
    cle: 'turso-lent',
    nom: 'Turso lent',
    quoi: 'le 95ᵉ centile d’un aller-retour vers la base, sur vingt au moins',
    seuil: { defaut: TURSO_LENT_MS, min: 200, max: 5000, pas: 50, unite: 'ms' },
    sur: 'l’heure',
    gravite: 'veille',
    telephone: false,
    page: 'base',
    neuve: false,
  },
  {
    cle: 'gel-long',
    nom: 'Gel long',
    quoi: 'la boucle figée d’un seul tenant — toute la salle attend',
    seuil: { defaut: 3000, min: 1000, max: 30000, pas: 500, unite: 'ms' },
    sur: 'la minute',
    gravite: 'veille',
    telephone: false,
    page: 'serveur',
    neuve: true,
  },
  {
    cle: 'quota',
    nom: 'Quota de Turso',
    quoi: 'ce que ce serveur lirait en trente jours au rythme de la semaine, en part des 500 millions de lignes du mois',
    seuil: { defaut: PART_DU_QUOTA_EN_ALERTE, min: 10, max: 100, pas: 5, unite: '%' },
    sur: 'sept jours',
    gravite: 'veille',
    telephone: false,
    page: 'base',
    neuve: false,
  },
  {
    // Chaque service ne voit que ses heures : son seuil se règle sur sa part des 750, celle de la production d'office
    // (`HEURES_DE_LA_PRODUCTION`), le reste ailleurs. Le téléphone d'office : un quota épuisé ne se rattrape pas.
    cle: 'hebergeur',
    nom: 'Heures de l’hébergeur',
    quoi: 'les heures que ce service aura passées éveillé ce mois-ci, au rythme des sept derniers jours — l’offre gratuite en donne 750 aux deux services ensemble',
    seuil: { defaut: HEURES_DE_LA_PRODUCTION, horsProduction: HEURES_DE_L_OFFRE - HEURES_DE_LA_PRODUCTION, min: 50, max: HEURES_DE_L_OFFRE, pas: 10, unite: 'heures' },
    sur: 'sept jours',
    gravite: 'serieux',
    telephone: true,
    page: 'serveur',
    neuve: true,
  },
  {
    cle: 'version',
    nom: 'Version qui ralentit',
    quoi: 'une route ralentie d’un tiers ou plus face à la version d’avant, sur vingt appels de chaque côté',
    seuil: null,
    sur: 'depuis la mise en ligne',
    gravite: 'veille',
    telephone: false,
    page: 'serveur',
    neuve: true,
  },
  {
    cle: 'reserve',
    nom: 'Réserve du quiz du jour',
    quoi: 'les jours d’avance de la réserve',
    seuil: { defaut: 7, min: 1, max: 30, pas: 1, unite: 'jours' },
    sur: 'chaque jour',
    gravite: 'veille',
    telephone: false,
    page: 'jour',
    // « À traiter » la disait déjà, à sept jours ; elle devient une règle, son seuil réglable.
    neuve: true,
  },
  {
    cle: 'rappel',
    nom: 'Rappel du soir en échec',
    quoi: 'la part des envois en échec à la dernière tournée, sur cinq envois au moins',
    seuil: { defaut: 10, min: 1, max: 100, pas: 1, unite: '%' },
    sur: 'chaque tournée',
    gravite: 'veille',
    telephone: false,
    page: 'jour',
    neuve: true,
  },
  {
    cle: 'silence',
    nom: 'Silence anormal',
    quoi: 'personne n’a joué de 19 h à 22 h, le serveur debout tout du long — la panne qu’aucune erreur ne dit',
    seuil: null,
    sur: 'chaque soir',
    gravite: 'veille',
    telephone: false,
    page: 'direct',
    neuve: true,
  },
]

export const REGLE: Record<CleDeRegle, RegleDuQg> = Object.fromEntries(REGLES_DU_QG.map(r => [r.cle, r])) as Record<CleDeRegle, RegleDuQg>

export const estUneRegle = (cle: unknown): cle is CleDeRegle => typeof cle === 'string' && (CLES_DES_REGLES as readonly string[]).includes(cle)

/** Ce que l'administrateur a réglé d'une règle : son seuil, son téléphone. Ce qui n'y est pas vaut d'office. */
export interface ReglageDUneRegle {
  seuil?: number
  telephone?: boolean
}
export type ReglagesDuQg = Partial<Record<CleDeRegle, ReglageDUneRegle>>

/** Ce qui vaut d'office sur ce serveur quand ce n'est pas le défaut du catalogue : la part de la préproduction des heures de l'hébergeur. */
export type DefautsDesSeuils = Partial<Record<CleDeRegle, number>>

/** Les seuils d'office d'un serveur : ceux du catalogue en production, la part `horsProduction` ailleurs. */
export function defautsDesSeuils(production: boolean): DefautsDesSeuils {
  if (production) return {}
  return Object.fromEntries(REGLES_DU_QG.flatMap(r => (r.seuil?.horsProduction === undefined ? [] : [[r.cle, r.seuil.horsProduction]])))
}

/** Le seuil d'office d'une règle sur ce serveur ; null pour une règle sans seuil. */
export const defautDe = (cle: CleDeRegle, defauts: DefautsDesSeuils = {}): number | null => {
  const seuil = REGLE[cle].seuil
  return seuil ? (defauts[cle] ?? seuil.defaut) : null
}

export const seuilDe = (cle: CleDeRegle, reglages: ReglagesDuQg, defauts: DefautsDesSeuils = {}): number | null => {
  const defaut = defautDe(cle, defauts)
  return defaut === null ? null : (reglages[cle]?.seuil ?? defaut)
}
export const sonneAuTelephone = (cle: CleDeRegle, reglages: ReglagesDuQg): boolean => reglages[cle]?.telephone ?? REGLE[cle].telephone

/** « 800 ms », « 1 % », « 450 Mo », « 7 jours », « 560 h » : un seuil, dit avec son unité. */
export function seuilEcrit(cle: CleDeRegle, valeur: number): string {
  const unite = REGLE[cle].seuil?.unite
  if (unite === 'jours') return `${formatNumber(valeur)} jour${valeur > 1 ? 's' : ''}`
  if (unite === 'ms' && valeur >= 1000) return `${formatNumber(Math.round(valeur / 100) / 10)} s`
  // Insécable : au téléphone, « h » seul en début de ligne ne se lisait pas (`heureEcrite`).
  if (unite === 'heures') return `${formatNumber(valeur)} h`
  return `${formatNumber(valeur)} ${unite ?? ''}`.trim()
}

/**
 * Un réglage reçu, relu : un seuil dans ses bornes et sur son pas, un
 * téléphone vrai ou faux. Un seuil hors bornes se refuse en clair — jamais
 * ramené en silence à la borne : l'administrateur croirait avoir réglé ce
 * qu'il a tapé. Rend le réglage entier, ce qui vaut d'office retiré — d'office
 * sur ce serveur (`defauts`) : la part de la préproduction ne s'écrit pas.
 */
export function lireLeReglage(cle: CleDeRegle, brut: unknown, avant: ReglageDUneRegle = {}, defauts: DefautsDesSeuils = {}): ReglageDUneRegle {
  if (!brut || typeof brut !== 'object') throw new Error('Un réglage attendu : un seuil, un téléphone.')
  const { seuil, telephone } = brut as { seuil?: unknown; telephone?: unknown }
  const regle = REGLE[cle]
  const neuf: ReglageDUneRegle = { ...avant }
  if (seuil !== undefined) {
    if (!regle.seuil) throw new Error('Cette règle n’a pas de seuil à régler.')
    if (typeof seuil !== 'number' || !Number.isFinite(seuil)) throw new Error('Le seuil est un nombre.')
    const { min, max, pas } = regle.seuil
    if (seuil < min || seuil > max) throw new Error(`Le seuil va de ${seuilEcrit(cle, min)} à ${seuilEcrit(cle, max)}.`)
    // Sur son pas, sans les poussières de la virgule flottante : 0,5 + 0,5 + 0,5 reste 1,5.
    const pose = Math.round(Math.round(seuil / pas) * pas * 1000) / 1000
    if (pose === defautDe(cle, defauts)) delete neuf.seuil
    else neuf.seuil = pose
  }
  if (telephone !== undefined) {
    if (typeof telephone !== 'boolean') throw new Error('Le téléphone sonne, ou non.')
    if (telephone === regle.telephone) delete neuf.telephone
    else neuf.telephone = telephone
  }
  return neuf
}

/**
 * Ce que le serveur sait, à un instant, pour juger chaque règle : tout se lit
 * en mémoire ou dans ce que la santé du serveur garde déjà (`core/regles.ts`
 * le compose), rien de plus vers Turso. Un champ absent ne se juge pas : sa
 * règle reste au calme.
 */
export interface ReleveDesAlertes {
  maintenant: number
  pannes: readonly PanneDUnMode[]
  arretNet: { vers: number } | null
  erreurs: { n: number; source: string } | null
  /** Turso au 95ᵉ centile de l'heure jugée, sur assez d'allers-retours. */
  turso: { p95: number } | null
  memoireMo: number | null
  /** Le quota du mois au rythme de la semaine, en part des 500 millions, jugé sur un jour au moins. */
  quotaPart: number | null
  /** Ce qu'un joueur attend sur dix minutes : le 95ᵉ centile pondéré, et combien d'appels. */
  ressenti: { p95: number; appels: number } | null
  /** Le quart d'heure : les requêtes et celles en erreur serveur. */
  requetes: { n: number; enErreur: number } | null
  /** Le pire gel de la boucle sur la minute. */
  gelMs: number | null
  miroir: { enEchecDepuis: string | null; espacesEnRetard: number } | null
  reserveJours: number | null
  rappel: { envoyes: number; echecs: number } | null
  /** La soirée de 19 h à 22 h, quand elle est jugée : le serveur debout tout du long, et ce qui s'y est joué. */
  soir: { joue: number } | null
  /** Les routes que la dernière version a ralenties. */
  ralenties: readonly { route: string; avant: number; apres: number }[]
  /**
   * La dernière sauvegarde notée (`qg_sauvegardes`), relue une fois l'heure : `derniere` nulle, il n'y en a jamais eu.
   * Absente, pas encore lue — elle ne se juge pas.
   */
  sauvegarde?: { derniere: number | null } | null
  /**
   * Les heures éveillées de ce service ce mois-ci : celles déjà faites, et ce qu'elles seront à la fin du mois au rythme
   * des sept derniers jours (`heuresDuMois`, `shared/santeDuServeur.ts`), relues une fois l'heure.
   */
  hebergeur?: { faites: number; projetees: number } | null
}

/** Les appels et les requêtes en deçà desquels une part ou un centile ne se juge pas. */
export const APPELS_POUR_LE_RESSENTI = 20
export const REQUETES_POUR_LE_TAUX = 50
export const ENVOIS_POUR_LE_RAPPEL = 5

const ms = (v: number) => (v >= 1000 ? `${formatNumber(Math.round(v / 100) / 10)} s` : `${formatNumber(Math.round(v))} ms`)

/**
 * Les règles ouvertes à cet instant, chacune sa cause en une phrase — pure :
 * le serveur la joue chaque minute, le test sur des relevés inventés. La
 * cause ne cite jamais un joueur : une route, un mode, un chiffre.
 */
export function reglesOuvertes(r: ReleveDesAlertes, reglages: ReglagesDuQg, defauts: DefautsDesSeuils = {}): Map<CleDeRegle, string> {
  const ouvertes = new Map<CleDeRegle, string>()
  const seuil = (cle: CleDeRegle) => seuilDe(cle, reglages, defauts) ?? 0
  if (r.pannes.length > 0) ouvertes.set('panne', `${r.pannes.map(p => p.mode).join(', ')} : ${formatNumber(r.pannes.reduce((n, p) => n + p.echecs, 0))} échecs`)
  if (r.arretNet) ouvertes.set('arret-net', 'un démarrage s’est arrêté sans s’éteindre')
  if (r.erreurs) ouvertes.set('erreurs', `${formatNumber(r.erreurs.n)} erreur${r.erreurs.n > 1 ? 's' : ''}, surtout ${r.erreurs.source}`)
  if (r.miroir && (r.miroir.enEchecDepuis || r.miroir.espacesEnRetard > 0)) {
    ouvertes.set('miroir', r.miroir.enEchecDepuis ? 'Turso refuse les écritures de la soirée' : `${formatNumber(r.miroir.espacesEnRetard)} salon${r.miroir.espacesEnRetard > 1 ? 's' : ''} en retard`)
  }
  if (r.requetes && r.requetes.n >= REQUETES_POUR_LE_TAUX) {
    const part = (r.requetes.enErreur / r.requetes.n) * 100
    if (part > seuil('taux-d-erreur')) ouvertes.set('taux-d-erreur', `${formatNumber(Math.round(part * 10) / 10)} % des requêtes en erreur (${formatNumber(r.requetes.enErreur)} sur ${formatNumber(r.requetes.n)})`)
  }
  if (r.memoireMo !== null && r.memoireMo > seuil('memoire')) ouvertes.set('memoire', `${formatNumber(r.memoireMo)} Mo`)
  if (r.ressenti && r.ressenti.appels >= APPELS_POUR_LE_RESSENTI && r.ressenti.p95 > seuil('ressenti')) {
    ouvertes.set('ressenti', `${ms(r.ressenti.p95)} au 95ᵉ centile, sur ${formatNumber(r.ressenti.appels)} appels`)
  }
  if (r.turso && r.turso.p95 > seuil('turso-lent')) ouvertes.set('turso-lent', `${ms(r.turso.p95)} au 95ᵉ centile`)
  if (r.gelMs !== null && r.gelMs > seuil('gel-long')) ouvertes.set('gel-long', `la boucle figée ${ms(r.gelMs)}`)
  if (r.quotaPart !== null && r.quotaPart >= seuil('quota')) ouvertes.set('quota', `${formatNumber(Math.round(r.quotaPart))} % du quota du mois à ce rythme`)
  const pire = [...r.ralenties].sort((a, b) => b.apres / b.avant - a.apres / a.avant)[0]
  if (pire) ouvertes.set('version', `${pire.route} : ${ms(pire.avant)} → ${ms(pire.apres)}${r.ralenties.length > 1 ? `, et ${r.ralenties.length - 1} autre${r.ralenties.length > 2 ? 's' : ''}` : ''}`)
  if (r.reserveJours !== null && r.reserveJours < seuil('reserve')) ouvertes.set('reserve', `${formatNumber(r.reserveJours)} jour${r.reserveJours > 1 ? 's' : ''} d’avance`)
  if (r.rappel) {
    const envois = r.rappel.envoyes + r.rappel.echecs
    if (envois >= ENVOIS_POUR_LE_RAPPEL && (r.rappel.echecs / envois) * 100 > seuil('rappel')) {
      ouvertes.set('rappel', `${formatNumber(r.rappel.echecs)} envoi${r.rappel.echecs > 1 ? 's' : ''} en échec sur ${formatNumber(envois)}`)
    }
  }
  if (r.soir && r.soir.joue === 0) ouvertes.set('silence', 'personne n’a joué de 19 h à 22 h')
  // Jamais de sauvegarde : ouverte aussi — un serveur neuf a tout à perdre, et la cause dit quoi faire.
  if (r.sauvegarde) {
    const { derniere } = r.sauvegarde
    if (derniere === null) ouvertes.set('sauvegarde', 'aucune sauvegarde notée : npm run sauvegarde, depuis un ordinateur')
    else if (r.maintenant - derniere > seuil('sauvegarde') * JOUR_MS) {
      const jours = Math.floor((r.maintenant - derniere) / JOUR_MS)
      ouvertes.set('sauvegarde', `la dernière date de ${formatNumber(jours)} jour${jours > 1 ? 's' : ''}`)
    }
  }
  if (r.hebergeur && r.hebergeur.projetees >= seuil('hebergeur')) {
    const { faites, projetees } = r.hebergeur
    ouvertes.set(
      'hebergeur',
      `${formatNumber(Math.round(projetees))} h ce mois-ci à ce rythme, déjà ${formatNumber(Math.round(faites))} — sur ${formatNumber(HEURES_DE_L_OFFRE)} pour les deux services`,
    )
  }
  return ouvertes
}

/** Un incident : une règle ouverte, de son début à sa fin, sa cause, et le mot que l'administrateur y a laissé. */
export interface IncidentDuQg {
  id: number
  regle: CleDeRegle
  gravite: Gravite
  debut: number
  fin: number | null
  cause: string
  mot: string | null
}

/** Un mot sur un incident, comme celui d'une erreur triée. */
export const MOT_D_UN_INCIDENT_MAX = 120

/** Les trois semaines de la frise, et les trente jours des chiffres. */
export const JOURS_DE_LA_FRISE = 21
export const JOURS_DES_INCIDENTS = 30

/**
 * Une règle se referme après cinq minutes au calme : un ressenti qui frôle
 * son seuil ne fait pas naître un incident par minute. Elle s'ouvre, elle,
 * dès la première minute.
 */
export const CALME_POUR_CLORE_MS = 5 * 60_000

/** Une règle telle que la page la montre : sa définition, son réglage, son état. */
export interface RegleALaPage {
  cle: CleDeRegle
  seuil: number | null
  /** Le seuil d'office sur ce serveur (`defautDe`) : la saisie le dit ; absent d'un serveur d'avant, celui du catalogue. */
  defaut?: number | null
  telephone: boolean
  ouverte: { depuis: number; cause: string } | null
  /** Le début du dernier incident de la règle, ouvert ou clos. */
  derniere: number | null
}

export interface PageDesAlertes {
  maintenant: number
  regles: RegleALaPage[]
  /** Les incidents des trente derniers jours, le plus récent d'abord. */
  incidents: IncidentDuQg[]
  /** Les téléphones que les alertes font sonner. */
  telephones: number
  /** Le point du matin, son heure et sa notification, à côté des téléphones (`shared/pointDuMatin.ts`) ; absent d'un serveur d'avant. */
  point?: EtatDuPoint
}

/** Les chiffres des trente jours : les incidents, leur durée médiane une fois clos, et la part du temps où aucun mode n'était en panne. */
export function chiffresDesIncidents(incidents: readonly IncidentDuQg[], maintenant: number, jours = JOURS_DES_INCIDENTS) {
  const debut = maintenant - jours * 86_400_000
  const recents = incidents.filter(i => (i.fin ?? maintenant) >= debut)
  const durees = recents.filter(i => i.fin !== null).map(i => i.fin! - i.debut).sort((a, b) => a - b)
  const mediane = durees.length ? durees[Math.floor((durees.length - 1) / 2)] : null
  // Les pannes peuvent se chevaucher (deux modes tombés à part) : on fond leurs plages avant de les compter.
  const plages = recents
    .filter(i => i.regle === 'panne')
    .map(i => [Math.max(i.debut, debut), i.fin ?? maintenant] as const)
    .sort((a, b) => a[0] - b[0])
  let enPanne = 0
  let jusqua = debut
  for (const [de, a] of plages) {
    if (a <= jusqua) continue
    enPanne += a - Math.max(de, jusqua)
    jusqua = a
  }
  return {
    n: recents.length,
    critiques: recents.filter(i => i.gravite === 'critique').length,
    retourMedianMs: mediane,
    disponibilite: Math.round((1 - enPanne / (maintenant - debut)) * 10_000) / 100,
    pannesMs: enPanne,
  }
}

/**
 * Les règles qu'« À traiter » ne disait pas encore : les autres — une panne,
 * le miroir, un arrêt net, les erreurs, la mémoire, le quota, Turso, la
 * réserve, le rappel — y ont leur ligne depuis longtemps, lue à part. La
 * sauvegarde et les heures de l'hébergeur n'en avaient aucune.
 */
export const REGLES_NEUVES_A_TRAITER: readonly CleDeRegle[] = ['taux-d-erreur', 'ressenti', 'gel-long', 'version', 'silence', 'sauvegarde', 'hebergeur']

/** Une règle ouverte qu'« À traiter » montre. */
export interface AlerteATraiter {
  cle: CleDeRegle
  cause: string
  depuis: number
}
