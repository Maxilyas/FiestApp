// La santé du serveur sur sept jours, au QG (`/admin#serveur`, les choix du
// 13 octobre 2026) : ce que les joueurs attendent — un aller-retour vers
// Turso, une route d'API —, les réveils et les arrêts, les erreurs, et la
// charge — processeur, boucle, mémoire, à côté des invités connectés —,
// heure par heure, gardés dans la base permanente : la mémoire et la base
// locale s'effacent à chaque réveil de l'hébergeur, et `/healthz` ne dit que
// la minute en cours. La charge, d'abord laissée au direct, a rejoint la
// page le même jour : sans elle, la page disait qu'une soirée avait été
// lente, pas pourquoi — et seule la production dira combien d'invités le
// dixième de cœur de l'hébergeur tient (`core/pouls.ts`). Le 17 octobre 2026,
// ce que Render montre de dehors l'a rejointe, mesuré du dedans : les
// requêtes par statut, les connexions ouvertes, le réseau, et les plafonds
// lus dans le conteneur.
//
// Des dérivations pures : le serveur les calcule sur ce que la base garde
// (`server/src/core/santeDuServeur.ts`), les tests les jouent sans serveur.

import { formatNumber } from './typographie'
import { lireLeTri, type ParVersion, type TriDUneErreur } from './triDesErreurs'
import type { PanneDUnMode } from './pannes'

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
 * lui-même à 5 s (`server/src/core/connexions.ts`). Une connexion que la
 * boucle gelée a gardée au-delà se referme avant le prochain aller-retour
 * (`refermerLesAttardees`) : Turso l'a peut-être fermée entre-temps.
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
  /**
   * Le pic des connexions ouvertes sur le serveur — chaque téléphone et
   * chaque écran du temps réel en tient une, chaque page en cours de
   * chargement aussi —, et celui des clients du temps réel seuls
   * (`compteurDeConnexions`, `core/pouls.ts`). Absents des lignes d'avant le
   * 17 octobre 2026.
   */
  connexionsMax?: number
  tempsReelMax?: number
  /**
   * Ce que la machine a envoyé et reçu sur l'heure, en kilo-octets
   * (`sondeDuReseau`) : les pages aux téléphones, les allers-retours vers
   * Turso, tout ce qui passe par son réseau. Absents hors d'une machine qui
   * le dit, et des lignes d'avant le 17 octobre 2026.
   */
  envoyesKo?: number
  recusKo?: number
}

/**
 * Les requêtes HTTP d'une heure, par famille de statut (le minutage de
 * `server.ts`) : les pages, les fichiers et l'API. Ni le temps réel, qui
 * passe à côté d'Express, ni les sondes de `/healthz`, que l'hébergeur et le
 * réveil envoient sans cesse : elles auraient noyé les heures calmes.
 */
export interface RequetesDeLHeure {
  /** 2xx. */
  reussies: number
  /** 3xx : une redirection, ou « pas changé » — le téléphone garde déjà le fichier. */
  redirigees: number
  /** 4xx : une page introuvable, une session expirée, la réserve d'inscriptions qui dit non. */
  refusees: number
  /** 5xx : les routes en erreur serveur. */
  enErreur: number
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

/**
 * Une erreur serveur en détail, comme l'heure la garde (le souhait du
 * propriétaire du 17 octobre 2026 : « mieux voir les erreurs, d'où elles
 * proviennent, et des détails en cliquant dessus ») : les mêmes — même
 * source, même sorte, même message — se comptent ensemble (`cleDeLErreur`).
 * Le journal du service garde tout, mais rien n'y dit où chercher.
 */
export interface ErreurEnDetail {
  /** Sa source, comme au compte de l'heure : la route sous son modèle, l'événement d'un socket, une exception échappée. */
  source: string
  /** Sa sorte — `TypeError`, `LibsqlError` —, et son code quand elle en a un (`SQLITE_BUSY`, `ECONNRESET`). */
  nom: string
  code: string | null
  /** Son message et ceux de ses causes, nettoyés — ni jeton, ni paramètre d'adresse — et coupés (`core/erreurs.ts`). */
  message: string
  /** Le premier cadre de la pile qui vient du dépôt : la fonction et son fichier — d'où elle vient. */
  ou: string | null
  /** La pile d'appels, ses cadres lisibles, du plus proche au plus lointain. */
  pile: string[]
  n: number
  premiere: number
  derniere: number
}

/** Au-delà, une erreur de plus dans l'heure se compte à sa source sans son détail : une panne en boucle ne remplit pas la base. */
export const ERREURS_EN_DETAIL = 12

/**
 * Ce qui fait deux erreurs « les mêmes » : leur source, leur sorte, leur
 * message — ses nombres et ses identifiants mis à part, sans quoi chaque
 * « délai de 10 012 ms dépassé » ferait la sienne.
 */
export function cleDeLErreur(e: Pick<ErreurEnDetail, 'source' | 'nom' | 'message'>): string {
  const message = e.message.replace(/\b[0-9a-f]{8,}\b/gi, '…').replace(/\d+/g, '#')
  return `${e.source}|${e.nom}|${message}`
}

/**
 * Le quota de Turso, en lignes par mois — celui de l'offre gratuite, pour
 * toute l'organisation : la préproduction, les sauvegardes et les scripts y
 * lisent aussi. Une requête compte chaque ligne qu'elle parcourt, pas celles
 * qu'elle rend : le 22 octobre 2026, 333 millions de lignes lues sur les 500
 * du mois, sans que rien ne le dise (`server/src/core/quotaDeTurso.ts`).
 */
export const QUOTA_DES_LIGNES_LUES = 500_000_000
export const QUOTA_DES_LIGNES_ECRITES = 10_000_000
/**
 * La part du quota que ce serveur prendrait en trente jours, au rythme de
 * la semaine, au-delà de laquelle « À traiter » le dit : la moitié — il
 * n'est pas seul à le lire, et un mois qui dépasse arrête la base de tous.
 */
export const PART_DU_QUOTA_EN_ALERTE = 50
/** Au-delà, l'alerte passe au rouge : à ce rythme, le mois ne tient plus qu'avec une préproduction qui ne lit rien. */
export const PART_DU_QUOTA_EN_ROUGE = 80
/** Un rythme ne se juge pas sur moins d'un jour : un réveil relit d'un coup tout le journal des réponses. */
export const HEURES_POUR_PROJETER = 24

/** « 312 millions de lignes », « 1,5 million de lignes », « 48 000 lignes » : un compte du quota, lisible d'un coup d'œil. */
export function enLignes(n: number): string {
  if (n >= 1_000_000) {
    const millions = Math.round(n / 100_000) / 10
    return `${formatNumber(millions)} million${millions >= 2 ? 's' : ''} de lignes`
  }
  return `${formatNumber(Math.round(n))} ligne${n >= 2 ? 's' : ''}`
}
/** Les requêtes lourdes qu'une heure garde, et que la page nomme, au plus : au-delà, elles comptent sans leur nom. */
export const REQUETES_PAR_HEURE = 8
export const REQUETES_MONTREES = 8

/** Une instruction lourde (`LIGNES_D_UNE_LOURDE`, au serveur), par le début de son texte : combien de fois, et ce qu'elle a lu en tout. */
export interface LecturesDUneRequete {
  requete: string
  n: number
  lues: number
}

/**
 * Ce que Turso a compté d'une heure : les allers-retours, les lignes lues et
 * écrites, et les requêtes qui ont lu le plus — le reste, petites
 * lectures comprises, se lit par différence.
 */
export interface QuotaDeLHeure {
  appels: number
  lues: number
  ecrites: number
  lourdes: LecturesDUneRequete[]
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
  /** Les mêmes, en détail — douze au plus (`ERREURS_EN_DETAIL`) ; absent d'une heure sans erreur, et des lignes d'avant le 17 octobre 2026. */
  erreursEnDetail?: ErreurEnDetail[]
  /** Les envois au miroir qui ont échoué : l'écran commun le dit déjà, la semaine s'en souvient. */
  miroir: number
  /** Null sans un relevé de charge — une heure à peine commencée, ou une ligne d'avant. */
  charge: ChargeDeLHeure | null
  /** Null pour une ligne d'avant le compte des connexions. */
  connexions: ConnexionsDeLHeure | null
  /** Null pour une ligne d'avant le compte des requêtes, le 17 octobre 2026. */
  requetes: RequetesDeLHeure | null
  /** Ce que Turso a compté au quota ; absent d'une ligne d'avant le 22 octobre 2026, null d'une heure sans aller-retour. */
  quota?: QuotaDeLHeure | null
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
  /** Ses erreurs par source, la plus fréquente d'abord : la légende de l'heure les nomme. */
  erreursParSource: { source: string; n: number }[]
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
  /** Les requêtes servies, par famille de statut ; null pour une heure d'avant leur compte. */
  requetes: RequetesDeLHeure | null
  /** Le pic des connexions ouvertes et celui des clients du temps réel ; null sans relevé qui le dise. */
  connexionsOuvertes: number | null
  tempsReel: number | null
  /** Ce que la machine a envoyé et reçu, en mégaoctets ; null sans relevé qui le dise. */
  envoyesMo: number | null
  recusMo: number | null
  /** Les lignes que Turso a comptées à ce serveur, lues et écrites ; null pour une heure d'avant leur compte, ou sans aller-retour. */
  lignesLues: number | null
  lignesEcrites: number | null
}

/**
 * Le quota de Turso vu de ce serveur, sur les heures de la semaine qu'il a
 * comptées : ce qu'il a lu et écrit, ce que ce rythme ferait en trente jours
 * — les heures endormies, où rien ne se lit, comptent pour rien —, sa part
 * du quota, et les requêtes qui lisent le plus.
 */
export interface QuotaDuMois {
  /** Le début de la première heure comptée : avant, le serveur ne comptait pas. */
  depuis: number
  lues: number
  ecrites: number
  luesSurTrenteJours: number
  ecritesSurTrenteJours: number
  /** La part du quota des lignes lues que ce rythme prendrait, en pour cent. */
  part: number
  /** La part du quota des lignes écrites, de même. */
  partEcrite: number
  /** Les requêtes qui ont lu le plus, chacune sa part de tout ce qui a été lu, en pour cent. */
  lourdes: (LecturesDUneRequete & { part: number })[]
}

/**
 * Les plafonds du conteneur, lus dans son cgroup au démarrage
 * (`plafondsDuConteneur`, `core/pouls.ts`) : le processeur en pour cent d'un
 * cœur, la mémoire en mégaoctets. Null quand la machine ne les dit pas — un
 * PC, un Mac — : la page reprend ceux de l'offre gratuite, écrits dans le
 * code.
 */
export interface PlafondsDuConteneur {
  processeurPct: number | null
  memoireMo: number | null
}

export interface PageDuServeur {
  maintenant: number
  /** Le démarrage qui répond. */
  enMarche: { depuis: number; version: string | null; env: string | null }
  /** Ceux du démarrage qui répond : un changement d'offre déplace le trait de toute la semaine. */
  plafonds: PlafondsDuConteneur
  /**
   * La page des mesures de l'hébergeur (`RENDER_SERVICE_ID`) : il garde aussi
   * les siennes, vues de dehors. Null hors de l'hébergeur.
   */
  mesuresDeLHebergeur: string | null
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
  /** Les erreurs de la semaine en détail, la plus récente d'abord (`ERREURS_MONTREES` au plus). */
  erreurs: ErreurDeLaSemaine[]
  /**
   * Celles de la semaine qui n'ont pas leur détail, par source : d'avant le
   * 17 octobre 2026, ou au-delà de douze par heure. Comptées, jamais perdues.
   */
  erreursSansDetail: { source: string; n: number }[]
  /** Le quota de Turso, au rythme de la semaine ; null avant la première heure comptée. */
  quota: QuotaDuMois | null
}

/** Une erreur de la semaine : ses heures et ses versions, les mêmes de chaque heure fondues. */
export interface ErreurDeLaSemaine extends ErreurEnDetail {
  cle: string
  /** Les heures où elle est tombée, et combien de fois, la plus récente d'abord. */
  heures: { heure: number; n: number }[]
  /** Les versions des démarrages où elle est tombée : encore là après une mise en ligne, elle n'est pas réparée. */
  versions: string[]
  /** Combien de fois sous chaque version, et la dernière, la plus récente d'abord : son tri les lit (`lireLeTri`). */
  parVersion: ParVersion[]
}

/** Les erreurs que la page détaille, au plus : une panne en boucle n'en fait qu'une, et la semaine en compte rarement plus. */
export const ERREURS_MONTREES = 50

/** Ce qui, du serveur, attend un geste dans « À traiter » (le choix du 13 octobre 2026 : les quatre ; les pannes, le 19). */
export interface AlertesDuServeur {
  /** Les modes de jeu en panne à l'instant (`core/veille.ts`) : ce qui presse le plus. */
  pannes: PanneDUnMode[]
  /** Le dernier démarrage arrêté net, ces dernières vingt-quatre heures : vers quand — son dernier signe. */
  arretNet: { vers: number } | null
  /**
   * Les erreurs serveur à regarder depuis le début de l'heure d'avant — ni les
   * ignorées, ni les réglées qui ne sont pas revenues (`lireLeTri`) —, et la
   * source qui en donne le plus.
   */
  erreurs: { n: number; depuis: number; source: string } | null
  /** Turso au-delà d'une seconde, au 95ᵉ centile de l'heure. */
  tursoLent: { p95: number; depuis: number } | null
  /** La mémoire du processus, quand elle approche le plafond de l'hébergeur. */
  memoireMo: number | null
  /**
   * Le quota de Turso, quand ce serveur en prendrait la moitié en trente
   * jours au rythme de la semaine (`PART_DU_QUOTA_EN_ALERTE`), jugé sur un
   * jour au moins ; absent d'un serveur qui ne le dit pas encore.
   */
  quota?: { part: number; luesSurTrenteJours: number } | null
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
  // Les connexions et le réseau, de même : le pire des pics, la somme des volumes, de ceux qui les disent.
  const dits = (cle: 'connexionsMax' | 'tempsReelMax' | 'envoyesKo' | 'recusKo') => [a[cle], b[cle]].filter((v): v is number => typeof v === 'number')
  const pic = (cle: 'connexionsMax' | 'tempsReelMax') => (dits(cle).length ? { [cle]: Math.max(...dits(cle)) } : {})
  const volume = (cle: 'envoyesKo' | 'recusKo') => (dits(cle).length ? { [cle]: dits(cle).reduce((s, v) => s + v, 0) } : {})
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
    ...pic('connexionsMax'),
    ...pic('tempsReelMax'),
    ...volume('envoyesKo'),
    ...volume('recusKo'),
  }
}

/** Les requêtes de deux démarrages dans la même heure : elles s'ajoutent. */
export function fondreRequetes(a: RequetesDeLHeure | null, b: RequetesDeLHeure | null): RequetesDeLHeure | null {
  if (!a) return b
  if (!b) return a
  return { reussies: a.reussies + b.reussies, redirigees: a.redirigees + b.redirigees, refusees: a.refusees + b.refusees, enErreur: a.enErreur + b.enErreur }
}

/** Toutes les requêtes servies d'une heure. */
export const requetesServies = (r: RequetesDeLHeure) => r.reussies + r.redirigees + r.refusees + r.enErreur

/** Des requêtes lourdes, les mêmes fondues par leur texte, la plus gourmande d'abord, `auPlus`. */
function fondreLesLourdes(lourdes: readonly LecturesDUneRequete[], auPlus: number): LecturesDUneRequete[] {
  const parTexte = new Map<string, LecturesDUneRequete>()
  for (const l of lourdes) {
    const avant = parTexte.get(l.requete)
    parTexte.set(l.requete, avant ? { requete: l.requete, n: avant.n + l.n, lues: avant.lues + l.lues } : { ...l })
  }
  return [...parTexte.values()].sort((a, b) => b.lues - a.lues || (a.requete < b.requete ? -1 : 1)).slice(0, auPlus)
}

/** Le quota de deux démarrages dans la même heure : les comptes s'ajoutent, leurs requêtes lourdes se fondent par leur texte. */
export function fondreQuotas(a: QuotaDeLHeure | null, b: QuotaDeLHeure | null): QuotaDeLHeure | null {
  if (!a) return b
  if (!b) return a
  return { appels: a.appels + b.appels, lues: a.lues + b.lues, ecrites: a.ecrites + b.ecrites, lourdes: fondreLesLourdes([...a.lourdes, ...b.lourdes], REQUETES_PAR_HEURE) }
}

/** Une part, en pour cent, au dixième. */
const partDe = (n: number, sur: number) => (sur > 0 ? Math.round((n / sur) * 1000) / 10 : 0)

/**
 * Le quota de Turso au rythme des heures comptées (`QuotaDuMois`) : tout ce
 * qui a été lu depuis la première, ramené à trente jours — les heures d'un
 * serveur endormi, sans ligne, comptent pour rien, comme elles comptent au
 * quota. Null sans une heure comptée.
 */
export function quotaDuMois(lignes: readonly Pick<HeureDeSante, 'heure' | 'quota'>[], maintenant: number): QuotaDuMois | null {
  const comptees = lignes.flatMap(l => (l.quota && l.quota.appels > 0 ? [{ heure: l.heure, quota: l.quota }] : []))
  if (comptees.length === 0) return null
  const depuis = comptees.reduce((min, l) => Math.min(min, l.heure), Infinity)
  const lues = comptees.reduce((s, l) => s + l.quota.lues, 0)
  const ecrites = comptees.reduce((s, l) => s + l.quota.ecrites, 0)
  const duree = Math.max(HEURE_MS, maintenant - depuis)
  const surTrenteJours = (n: number) => Math.round((n / duree) * 30 * 24 * HEURE_MS)
  const luesSurTrenteJours = surTrenteJours(lues)
  const ecritesSurTrenteJours = surTrenteJours(ecrites)
  return {
    depuis,
    lues,
    ecrites,
    luesSurTrenteJours,
    ecritesSurTrenteJours,
    part: partDe(luesSurTrenteJours, QUOTA_DES_LIGNES_LUES),
    partEcrite: partDe(ecritesSurTrenteJours, QUOTA_DES_LIGNES_ECRITES),
    lourdes: fondreLesLourdes(
      comptees.flatMap(l => l.quota.lourdes),
      REQUETES_MONTREES,
    ).map(l => ({ ...l, part: partDe(l.lues, lues) })),
  }
}

/** Des kilo-octets en mégaoctets, au dixième : le graphique gradue en mégaoctets ronds. */
const enMo = (ko: number | undefined) => (typeof ko === 'number' ? Math.round((ko / 1024) * 10) / 10 : null)

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
  let requetes: RequetesDeLHeure | null = null
  let quota: QuotaDeLHeure | null = null
  let miroir = 0
  for (const l of lignes) {
    base = fondreReleves(base, l.base)
    routes = fondreReleves(routes, l.routes)
    // Une ligne d'avant la charge n'en porte pas, ni d'avant le compte des connexions, ni d'avant celui des requêtes, ni du quota.
    charge = fondreCharges(charge, l.charge ?? null)
    connexions = fondreConnexions(connexions, l.connexions ?? null)
    requetes = fondreRequetes(requetes, l.requetes ?? null)
    quota = fondreQuotas(quota, l.quota ?? null)
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
    requetes,
    quota,
  }
}

const totalDesErreurs = (erreurs: Record<string, number>) => Object.values(erreurs).reduce((s, n) => s + n, 0)

/** Les erreurs par source, la plus fréquente d'abord. */
const parSource = (erreurs: Record<string, number>) =>
  Object.entries(erreurs)
    .map(([source, n]) => ({ source, n }))
    .sort((a, b) => b.n - a.n || (a.source < b.source ? -1 : 1))

/**
 * Les erreurs de la semaine en détail : les mêmes (`cleDeLErreur`) fondues
 * d'une heure et d'un démarrage à l'autre — leur compte, leurs heures, les
 * versions où elles sont tombées —, la plus récente d'abord ; le message et
 * la pile, ceux de leur dernière heure. Et ce qui n'a pas son détail, par
 * source : le compte de l'heure le garde toujours.
 */
export function erreursDeLaSemaine(
  lignes: readonly HeureDeSante[],
  versionDe: (demarrage: string) => string | null,
): { erreurs: ErreurDeLaSemaine[]; sansDetail: { source: string; n: number }[] } {
  const fondues = new Map<string, ErreurDeLaSemaine & { parHeure: Map<number, number>; vues: Map<string | null, ParVersion> }>()
  const comptees = new Map<string, number>()
  const detaillees = new Map<string, number>()
  for (const l of lignes) {
    for (const [source, n] of Object.entries(l.erreurs)) comptees.set(source, (comptees.get(source) ?? 0) + n)
    for (const e of l.erreursEnDetail ?? []) {
      detaillees.set(e.source, (detaillees.get(e.source) ?? 0) + e.n)
      const cle = cleDeLErreur(e)
      let f = fondues.get(cle)
      if (!f) fondues.set(cle, (f = { ...e, pile: [...e.pile], cle, heures: [], versions: [], parVersion: [], parHeure: new Map(), vues: new Map() }))
      else {
        if (e.derniere > f.derniere) Object.assign(f, { message: e.message, code: e.code, ou: e.ou, pile: [...e.pile], derniere: e.derniere })
        f.n += e.n
        f.premiere = Math.min(f.premiere, e.premiere)
      }
      f.parHeure.set(l.heure, (f.parHeure.get(l.heure) ?? 0) + e.n)
      // Hors de l'hébergeur, sans version : son tri le lit quand même — toute rechute la fait revenir.
      const version = versionDe(l.demarrage)
      const vue = f.vues.get(version)
      f.vues.set(version, { version, n: (vue?.n ?? 0) + e.n, derniere: Math.max(vue?.derniere ?? 0, e.derniere) })
    }
  }
  const erreurs = [...fondues.values()]
    .sort((a, b) => b.derniere - a.derniere)
    .slice(0, ERREURS_MONTREES)
    .map(({ parHeure, vues, ...e }) => ({
      ...e,
      heures: [...parHeure].map(([heure, n]) => ({ heure, n })).sort((a, b) => b.heure - a.heure),
      versions: [...vues.keys()].filter((v): v is string => v !== null).sort(),
      parVersion: [...vues.values()].sort((a, b) => b.derniere - a.derniere),
    }))
  const sansDetail = [...comptees]
    .map(([source, n]) => ({ source, n: n - (detaillees.get(source) ?? 0) }))
    .filter(s => s.n > 0)
    .sort((a, b) => b.n - a.n || (a.source < b.source ? -1 : 1))
  return { erreurs, sansDetail }
}

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

/** Une machine qui ne dit pas ses plafonds. */
export const PLAFONDS_INCONNUS: PlafondsDuConteneur = { processeurPct: null, memoireMo: null }

/**
 * La page « Le serveur » : sept jours heure par heure, les démarrages et les
 * arrêts nets, et quatre chiffres. `demarrages` porte aussi le dernier
 * démarrage d'avant la semaine : la sorte du premier se lit dans lui.
 */
export function pageDuServeur(
  lignes: readonly HeureDeSante[],
  demarrages: readonly DemarrageDuServeur[],
  {
    maintenant,
    courant,
    plafonds = PLAFONDS_INCONNUS,
    mesuresDeLHebergeur = null,
  }: { maintenant: number; courant: DemarrageDuServeur; plafonds?: PlafondsDuConteneur; mesuresDeLHebergeur?: string | null },
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
      erreursParSource: h ? parSource(h.erreurs) : [],
      miroir: h?.miroir ?? 0,
      processeur: h?.charge?.processeur ?? null,
      gele: h?.charge?.gelePct ?? null,
      boucle: h?.charge?.boucleMaxMs ?? null,
      memoire: h?.charge?.memoireMaxMo ?? null,
      invites: h?.charge?.invitesMax ?? null,
      connexionsNeuves: h ? partDesConnexionsNeuves(h.base, h.connexions) : null,
      connexions: h?.connexions ?? null,
      requetes: h?.requetes ?? null,
      connexionsOuvertes: h?.charge?.connexionsMax ?? null,
      tempsReel: h?.charge?.tempsReelMax ?? null,
      envoyesMo: enMo(h?.charge?.envoyesKo),
      recusMo: enMo(h?.charge?.recusKo),
      lignesLues: h?.quota?.lues ?? null,
      lignesEcrites: h?.quota?.ecrites ?? null,
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
  // Les erreurs en détail, sur les heures de la semaine ; leur version, celle du démarrage qui les a relevées.
  const versions = new Map(tous.map(d => [d.id, d.version]))
  const enDetail = erreursDeLaSemaine(
    lignes.filter(l => l.heure >= debut && l.heure <= derniere),
    id => versions.get(id) ?? null,
  )

  return {
    maintenant,
    enMarche: { depuis: courant.demarreLe, version: courant.version, env: courant.env },
    plafonds,
    mesuresDeLHebergeur,
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
    erreurs: enDetail.erreurs,
    erreursSansDetail: enDetail.sansDetail,
    quota: quotaDuMois(
      lignes.filter(l => l.heure >= debut && l.heure <= derniere),
      maintenant,
    ),
  }
}

/**
 * Les erreurs d'une heure de ce démarrage qui restent à regarder, par source :
 * une ignorée ne sonne plus, une réglée seulement si elle est revenue sous une
 * version qui ne l'avait pas vue (`lireLeTri`). Celles qui n'ont pas leur
 * détail — au-delà de douze dans l'heure — ne se trient pas : elles comptent.
 */
function erreursARegarder(h: HeureDeSante, tri: ReadonlyMap<string, TriDUneErreur>, version: string | null): Map<string, number> {
  const aRegarder = new Map<string, number>()
  const ajouter = (source: string, n: number) => {
    if (n > 0) aRegarder.set(source, (aRegarder.get(source) ?? 0) + n)
  }
  const detaillees = new Map<string, number>()
  for (const e of h.erreursEnDetail ?? []) {
    detaillees.set(e.source, (detaillees.get(e.source) ?? 0) + e.n)
    if (lireLeTri([{ version, n: e.n, derniere: e.derniere }], tri.get(cleDeLErreur(e))).etat === 'a-regarder') ajouter(e.source, e.n)
  }
  for (const [source, n] of Object.entries(h.erreurs)) ajouter(source, n - (detaillees.get(source) ?? 0))
  return aRegarder
}

/**
 * Ce qui, du serveur, mérite une ligne dans « À traiter ». `recentes` : le
 * relevé de ce démarrage — l'heure en cours, et celle d'avant si elle la
 * précède —, sous sa version (`version`) ; `demarrages`, ceux qui ont donné
 * signe de vie ce dernier jour ; `tri`, ce que l'administrateur a dit des
 * erreurs (`/admin#erreurs`) — l'alerte rouge sonnait pour chacune, un
 * hoquet de Turso déjà connu compris. Les erreurs comptent depuis le début
 * de l'heure d'avant : une erreur de 20 h 59 se voit encore à 21 h 05.
 */
export function alertesDuServeur({
  recentes,
  demarrages,
  memoireMo,
  maintenant,
  courant,
  version = null,
  tri = new Map(),
  pannes = [],
  quota = null,
}: {
  recentes: readonly HeureDeSante[]
  demarrages: readonly DemarrageDuServeur[]
  memoireMo: number | null
  maintenant: number
  courant: string
  version?: string | null
  tri?: ReadonlyMap<string, TriDUneErreur>
  pannes?: readonly PanneDUnMode[]
  /** Le quota de Turso au rythme de la semaine (`quotaDuMois`), relu au plus toutes les heures. */
  quota?: QuotaDuMois | null
}): AlertesDuServeur {
  const cetteHeure = debutDeLHeure(maintenant)
  const lues = recentes.filter(h => h.heure === cetteHeure || h.heure === cetteHeure - HEURE_MS).sort((a, b) => a.heure - b.heure)

  const sources = new Map<string, number>()
  let depuis: number | null = null
  for (const h of lues) {
    const aRegarder = erreursARegarder(h, tri, version)
    if (aRegarder.size > 0) depuis ??= h.heure
    for (const [s, n] of aRegarder) sources.set(s, (sources.get(s) ?? 0) + n)
  }
  const total = [...sources.values()].reduce((s, n) => s + n, 0)
  const premiere = [...sources].sort((a, b) => b[1] - a[1])[0]

  // Turso se juge sur l'heure en cours dès qu'elle a assez d'allers-retours, sinon sur celle d'avant.
  const jugee = [...lues].reverse().find(h => (h.base?.n ?? 0) >= ALLERS_RETOURS_POUR_JUGER)
  const arrets = demarrages.filter(d => arreteNet(d, maintenant, courant) && maintenant - d.vuLe <= ARRET_RECENT_MS).sort((a, b) => b.vuLe - a.vuLe)

  return {
    pannes: [...pannes],
    arretNet: arrets[0] ? { vers: arrets[0].vuLe } : null,
    erreurs: total > 0 && premiere ? { n: total, depuis: depuis ?? cetteHeure, source: premiere[0] } : null,
    tursoLent: jugee?.base && jugee.base.p95 > TURSO_LENT_MS ? { p95: jugee.base.p95, depuis: jugee.heure } : null,
    memoireMo: memoireMo !== null && memoireMo > MEMOIRE_PLAFOND_MO ? memoireMo : null,
    quota:
      quota && quota.part >= PART_DU_QUOTA_EN_ALERTE && maintenant - quota.depuis >= HEURES_POUR_PROJETER * HEURE_MS
        ? { part: quota.part, luesSurTrenteJours: quota.luesSurTrenteJours }
        : null,
  }
}
