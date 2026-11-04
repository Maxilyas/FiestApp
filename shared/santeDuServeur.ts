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
import { telephonesDeLaPeriode, type TelephonesDeLHeure } from './telephones'
import type { ClientToServerEvents } from './events'

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

/**
 * Les seuils des alertes du serveur que l'administrateur règle au QG (la page
 * des alertes, le QG 2, lot 8 : un réglage d'exploitation, pas un barème) ;
 * d'office, ceux du code. `alertesDuServeur` les lit, « À traiter » avec.
 */
export interface SeuilsDuServeur {
  tursoLentMs: number
  memoireMo: number
  partDuQuota: number
}
export const SEUILS_DU_SERVEUR: SeuilsDuServeur = { tursoLentMs: TURSO_LENT_MS, memoireMo: MEMOIRE_PLAFOND_MO, partDuQuota: PART_DU_QUOTA_EN_ALERTE }
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

/** Ce qui tournait pendant un gel : un modèle de route, un message du temps réel, un chronomètre de partie, une tâche de fond — et combien à la fois. */
export interface CeQuiTournait {
  quoi: string
  n: number
}

/**
 * Un gel de la boucle de plus d'une demi-seconde (`SondeDesGels`,
 * `server/src/core/gels.ts`) : quand il a fini, combien il a duré, le
 * processeur que le processus a pris pendant — au dixième de cœur de
 * l'hébergeur, un dixième de sa durée : un calcul que l'hébergeur a fait
 * attendre ; bien moins, le processus attendait autre chose —, ce que le
 * ramasse-miettes en a pris, et ce qui tournait.
 */
export interface GelDeLaBoucle {
  a: number
  dureeMs: number
  processeurMs: number
  ramasseMiettesMs: number
  enCours: CeQuiTournait[]
}

/** Chaque chose qui tournait pendant des gels : dans combien, et leur durée cumulée. */
export interface CeQuiGele {
  quoi: string
  n: number
  ms: number
}

/**
 * Les gels d'une heure (le 2 novembre 2026, « savoir ce qui gèle ») :
 * combien, leur durée cumulée, les plus longs en détail, ce qui tournait
 * pendant — le plus souvent d'abord —, et ceux où rien de nommé ne tournait.
 * Le graphique de la charge disait le pire gel de l'heure, pas sa cause.
 */
export interface GelsDeLHeure {
  n: number
  totalMs: number
  plusLongs: GelDeLaBoucle[]
  parCe: CeQuiGele[]
  sansRien: number
}

/** Les gels qu'une heure garde en détail, et ce qui tournait qu'elle nomme, au plus. */
export const GELS_EN_DETAIL = 5
export const CE_QUI_GELE_PAR_HEURE = 12
/** Ce que la page en montre sur la semaine. */
export const GELS_MONTRES = 8
export const CE_QUI_GELE_MONTRE = 12

// ── Le QG 2 : chaque route chaque heure, les tranches de cinq minutes ─────
// (le lot 2 de la proposition du 3 novembre 2026, `retours/2026-11-03/le-qg.md`) :
// la page « Le serveur » se lit sur la période de la barre — une heure, une
// journée, une semaine —, et ses routes se trient. Pas une table de plus :
// tout tient dans la ligne JSON de l'heure, que le relevé réécrit déjà toutes
// les dix minutes (`qg_sante`) — pas une ligne de plus écrite ni lue au quota.

/** Une tranche de la page sur une heure : cinq minutes. */
export const TRANCHE_MS = 5 * 60_000
export const TRANCHES_PAR_HEURE = HEURE_MS / TRANCHE_MS
export const debutDeLaTranche = (instant: number) => Math.floor(instant / TRANCHE_MS) * TRANCHE_MS

/** Une route d'API sur une heure, sous son modèle : ses appels, ses temps, et ses réponses refusées ou en erreur. */
export interface RouteDeLHeure extends Releve {
  route: string
  /** Le temps qu'elle a pris au serveur, toutes ses réponses ensemble, en millisecondes : ses appels fois son temps. */
  totalMs: number
  /** Ses réponses 4xx, puis 5xx. */
  refusees: number
  enErreur: number
}

/**
 * Le temps réel d'une heure (le QG 2, l'onglet « Temps réel » de la page du
 * serveur) : ce que les téléphones et les écrans envoient par la liaison,
 * relevé par `ecouter()` (`sockets.ts`), où passe chaque message d'un client.
 * Une soirée vit là, pas dans les routes : un « Révéler » qui traîne, des
 * réponses refusées « trop tard », des téléphones qui se reconnectent sans
 * cesse ne se voyaient nulle part.
 */
export interface TempsReelDeLHeure {
  /**
   * Chaque message reçu sous son nom (`player:action`), comme une route : ses
   * arrivées, son temps jusqu'à l'accusé — ce que le client attend ; jusqu'à
   * son issue s'il n'en attend pas —, le temps qu'il a pris au serveur, ses
   * refus (`refusees` : un accusé `ok: false` — trop tard, en pause, inconnu…)
   * et ses pannes (`enErreur` : une exception, que `ecouter()` rattrape). Le
   * plus coûteux d'abord.
   */
  parMessage: RouteDeLHeure[]
  /** Les réponses d'invités arrivées après la révélation (`too-late`), parmi les refus. */
  tropTard: number
  /** Les liaisons ouvertes dans l'heure : un téléphone qui se reconnecte en ouvre une de plus. */
  connexions: number
  /** Les chronomètres des parties sonnés dans l'heure, ceux sonnés plus d'une seconde après leur échéance, et le pire retard. */
  chronos: { n: number; enRetard: number; maxMs: number }
}

/** Un chronomètre en retard au-delà d'une seconde : la révélation que la salle attend se voit traîner. */
export const CHRONO_EN_RETARD_MS = 1000

/**
 * Ce que chaque message du temps réel fait, en mots, sous son nom dans la
 * table : `player:horsLigne` ne dit rien à qui ne lit pas `sockets.ts`. Le
 * contrat entier — un message de plus, et le typage demande ses mots.
 */
export const CE_QUE_FAIT_LE_MESSAGE: Record<keyof ClientToServerEvents, string> = {
  'time:sync': 'L’heure du serveur, que chaque écran demande',
  'party:watch': 'Une page qui suit la soirée',
  'player:join': 'Un invité qui entre, ou se re-présente',
  'player:action': 'Une réponse d’invité',
  'player:reprendre': 'Une place reprise par un code',
  'player:horsLigne': 'Un prénom cherché parmi les absents',
  'player:setTeam': 'Un invité qui change d’équipe',
  'host:hello': 'Un écran d’animateur qui se présente',
  'host:launch': 'Un quiz lancé',
  'host:command': 'Un geste de la partie : révéler, la suite…',
  'host:endSession': 'Un quiz terminé',
  'host:closeParty': 'Une soirée close',
  'host:discardParty': 'Un essai effacé',
  'host:resetParty': 'Une clôture, d’une page d’avant',
  'host:archiveParty': 'Un rangement, d’une page d’avant',
  'host:renamePlayer': 'Un invité renommé',
  'host:removePlayer': 'Un invité exclu',
  'host:rendrePlace': 'Un code pour rendre sa place',
  'host:createTeam': 'Une équipe créée',
  'host:updateTeam': 'Une équipe changée',
  'host:removeTeam': 'Une équipe retirée',
  'host:seedTeams': 'Les équipes tirées',
  'host:assignPlayer': 'Un invité placé dans une équipe',
  'host:awardTeam': 'Un prix remis',
  'host:removeBonus': 'Un prix retiré',
  'host:scene': 'L’écran de la salle changé : podium, prix…',
  'host:telecommande': 'La barre du chef qui se signale',
}

/** Cinq minutes d'un démarrage : ce qu'un joueur attend, Turso, les requêtes, les erreurs, la charge, les gels. */
export interface TrancheDeSante {
  debut: number
  routes: Releve | null
  base: Releve | null
  requetes: RequetesDeLHeure
  erreurs: number
  /** Null sans un relevé de charge dans la tranche (il en part un toutes les dix secondes) ; `n`, leur nombre. */
  charge: { n: number; processeur: number; boucleMaxMs: number; memoireMaxMo: number; invitesMax: number } | null
  gels: { n: number; maxMs: number }
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
  /** Ses gels de plus d'une demi-seconde, et ce qui tournait ; absent d'une ligne d'avant le 2 novembre 2026 — après, une heure sans gel en compte zéro. */
  gels?: GelsDeLHeure
  /** Chaque route appelée dans l'heure, la plus coûteuse d'abord ; absent d'une ligne d'avant le 4 novembre 2026. */
  parRoute?: RouteDeLHeure[]
  /** Ses tranches de cinq minutes, de la plus ancienne à la dernière ; absent d'une ligne d'avant le 4 novembre 2026. */
  tranches?: TrancheDeSante[]
  /** Ce que les téléphones des joueurs ont mesuré dans l'heure (`POST /api/mesures`) ; absent d'une heure sans mesure, ou d'avant le 4 novembre 2026. */
  telephones?: TelephonesDeLHeure
  /** Les messages de la liaison, ses connexions, ses chronomètres ; absent d'une ligne d'avant le 4 novembre 2026 — après, une heure sans message en compte zéro. */
  tempsReel?: TempsReelDeLHeure
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
  /** Ses gels de plus d'une demi-seconde, et le plus long, avec ce qui tournait ; null sans gel, ou pour une heure d'avant leur relevé. */
  gels: { n: number; plusLong: GelDeLaBoucle } | null
}

/** Les gels de la semaine : ceux des heures qui les relèvent, fondus (`gelsDeLaSemaine`). */
export interface GelsDeLaSemaine extends GelsDeLHeure {
  /** La première heure qui les relève : avant, le serveur ne savait pas. */
  depuis: number
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

/** La période de la page « Le serveur » : une heure en tranches de cinq minutes, une journée et une semaine heure par heure. */
export const PERIODES_DU_SERVEUR = ['1h', '24h', '7j'] as const
export type PeriodeDuServeur = (typeof PERIODES_DU_SERVEUR)[number]

/** La période lue d'une adresse : une inconnue, ou trente jours — le relevé n'en garde que huit —, vaut la semaine. */
export function periodeDuServeur(lue: unknown): PeriodeDuServeur {
  return (PERIODES_DU_SERVEUR as readonly unknown[]).includes(lue) ? (lue as PeriodeDuServeur) : '7j'
}

/**
 * Une route sur la période : ses appels, sa médiane et son 95ᵉ centile —
 * ceux de ses heures, moyennés par leurs appels : le pire d'une semaine
 * n'aurait dit que son réveil le plus froid —, sa pire réponse, sa part du
 * temps du serveur, ses appels heure par heure, et la période d'avant.
 */
export interface RouteDeLaPeriode extends RouteDeLHeure {
  /** Sa part de tout le temps que les routes ont pris au serveur, en pour cent : ce qui mérite d'être optimisé d'abord. */
  part: number
  /** Ses appels heure par heure sur la période ; vide sur une heure, que ses chiffres ne découpent pas. */
  parHeure: number[]
  /** La même route sur la période d'avant, de même longueur ; null si elle n'y a pas été appelée. */
  avant: { n: number; p95: number } | null
}

/** Assez d'appels, des deux côtés, pour dire qu'une route a ralenti d'une version à l'autre. */
export const APPELS_POUR_COMPARER = 20
/** Ralentie : un tiers de plus au 95ᵉ centile moyen que sous la version d'avant. */
export const RALENTIE_DE = 4 / 3

/** Une version du serveur sur la semaine, et ce qu'elle a changé face à celle d'avant (`versionsDuServeur`). */
export interface VersionDuServeur {
  version: string
  /** Son premier démarrage de la semaine, et son dernier signe. */
  depuis: number
  jusqua: number
  /** Les heures où elle a répondu. */
  heures: number
  /** Ce qu'un joueur a attendu sous elle : la médiane et le 95ᵉ centile moyens de ses heures, pondérés par leurs appels. */
  routes: { n: number; p50: number; p95: number } | null
  requetes: number
  /** Ses erreurs serveur pour mille requêtes servies ; null sans requête comptée. */
  erreursPourMille: number | null
  /** Le processeur moyen, en pour cent d'un cœur, et le pic de mémoire ; null sans relevé de charge. */
  processeur: number | null
  memoireMaxMo: number | null
  /** Les routes plus lentes d'un tiers au moins que sous la version d'avant, la plus ralentie d'abord (trois au plus). */
  ralenties: { route: string; avant: number; apres: number }[]
}

export interface PageDuServeur {
  maintenant: number
  /** La période lue, et le pas de ses seaux : une heure, ou cinq minutes sur une heure. */
  periode: PeriodeDuServeur
  pas: number
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
  /** Les gels de la période et ce qui tournait pendant ; null avant la première heure qui les relève. */
  gels: GelsDeLaSemaine | null
  /**
   * Chaque route de la période, la plus coûteuse au serveur d'abord
   * (`routesDeLaPeriode`) — sur une heure, celles de l'heure en cours et de la
   * précédente : une route n'a pas de tranches. `routesDepuis`, la première
   * heure qui les relève : avant le 4 novembre 2026, rien.
   */
  routes: RouteDeLaPeriode[]
  routesDepuis: number | null
  /** Les versions de la semaine, la plus récente d'abord, chacune comparée à celle d'avant. */
  versions: VersionDuServeur[]
  /** Ce que les téléphones des joueurs ont mesuré sur la période (`telephonesDeLaPeriode`, le QG 2, lot 9) ; absent d'un serveur d'avant. */
  telephones?: TelephonesDeLHeure
  /** Le temps réel sur la période (`tempsReelDeLaPeriode`) ; absent d'un serveur d'avant. */
  tempsReel?: TempsReelDeLaPeriode
}

/** Le temps réel d'une période : ses messages en table, comme les routes, et ce que ses heures ont compté. */
export interface TempsReelDeLaPeriode {
  messages: RouteDeLaPeriode[]
  /** Tous les messages ensemble, leurs refus et leurs pannes. */
  recus: number
  refuses: number
  enPanne: number
  tropTard: number
  connexions: number
  chronos: { n: number; enRetard: number; maxMs: number }
  /** Le pic des clients de la liaison, lu dans la charge (`tempsReelMax`) ; null sans relevé qui le dise. */
  clientsMax: number | null
  /** La première heure qui relève le temps réel : avant le 4 novembre 2026, rien. */
  depuis: number | null
}

/**
 * La file du miroir d'un salon (`PartyBackup.voies`) : ce qui attend de partir
 * vers Turso, ses échecs d'affilée, depuis quand, son dernier envoi réussi, et
 * s'il affiche « Sauvegarde en retard » sur son écran commun. Des chiffres
 * seulement : le salon par son nom, jamais ce que la file porte.
 */
export interface VoieDuMiroir {
  spaceId: string
  salon: { nom: string; avatar: string | null }
  enAttente: number
  echecs: number
  enEchecDepuis: number | null
  dernierSucces: number | null
  enRetard: boolean
}

/** Une sauvegarde de la base permanente (`npm run sauvegarde`, `qg_sauvegardes`) : quand, ce qu'elle a copié, combien de temps. */
export interface SauvegardeDeLaBase {
  faiteLe: number
  tables: number
  lignes: number
  octets: number
  dureeMs: number
}

/** Au-delà d'une semaine sans sauvegarde, la page « Base et miroir » le dit en rouge. */
export const SAUVEGARDE_ANCIENNE_MS = 7 * 24 * HEURE_MS
/** Les sauvegardes que la page montre : les plus récentes. */
export const SAUVEGARDES_MONTREES = 10

/** La page « Base et miroir » (`GET /api/admin/base`) : le miroir salon par salon, les dernières sauvegardes. */
export interface BaseDuQg {
  maintenant: number
  miroir: VoieDuMiroir[]
  sauvegardes: SauvegardeDeLaBase[]
  /** L'âge qui la dit ancienne : le seuil de la règle « Sauvegarde ancienne », tel qu'il est réglé ; absent, `SAUVEGARDE_ANCIENNE_MS`. */
  ancienneApresMs?: number
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

/** Ce qui tournait pendant des gels, fondu par son nom — les gels et leurs durées s'ajoutent —, ce qui a couvert le plus de gel d'abord, `auPlus`. */
function fondreCeQuiGele(listes: readonly (readonly CeQuiGele[])[], auPlus: number): CeQuiGele[] {
  const parNom = new Map<string, CeQuiGele>()
  for (const liste of listes) {
    for (const c of liste) {
      const avant = parNom.get(c.quoi)
      parNom.set(c.quoi, avant ? { quoi: c.quoi, n: avant.n + c.n, ms: avant.ms + c.ms } : { ...c })
    }
  }
  return [...parNom.values()].sort((a, b) => b.ms - a.ms || b.n - a.n || (a.quoi < b.quoi ? -1 : 1)).slice(0, auPlus)
}

/**
 * Les gels de deux démarrages dans la même heure — ou de toute une semaine,
 * avec ce qu'elle en montre : les comptes s'ajoutent, les plus longs se
 * rangent ensemble, ce qui tournait se fond par son nom.
 */
export function fondreGels(a: GelsDeLHeure | null, b: GelsDeLHeure | null, plusLongs = GELS_EN_DETAIL, nommes = CE_QUI_GELE_PAR_HEURE): GelsDeLHeure | null {
  if (!a) return b
  if (!b) return a
  return {
    n: a.n + b.n,
    totalMs: a.totalMs + b.totalMs,
    plusLongs: [...a.plusLongs, ...b.plusLongs].sort((x, y) => y.dureeMs - x.dureeMs || y.a - x.a).slice(0, plusLongs),
    parCe: fondreCeQuiGele([a.parCe, b.parCe], nommes),
    sansRien: a.sansRien + b.sansRien,
  }
}

/** Les gels des heures qui les relèvent, fondus, depuis la première ; null si aucune ne les relève encore. */
export function gelsDeLaSemaine(heures: readonly Pick<HeureDeSante, 'heure' | 'gels'>[]): GelsDeLaSemaine | null {
  let gels: GelsDeLHeure | null = null
  let depuis = Infinity
  for (const h of heures) {
    if (!h.gels) continue
    depuis = Math.min(depuis, h.heure)
    gels = fondreGels(gels, h.gels, GELS_MONTRES, CE_QUI_GELE_MONTRE)
  }
  return gels ? { ...gels, depuis } : null
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
  let gels: GelsDeLHeure | null = null
  let miroir = 0
  for (const l of lignes) {
    base = fondreReleves(base, l.base)
    routes = fondreReleves(routes, l.routes)
    // Une ligne d'avant la charge n'en porte pas, ni d'avant le compte des connexions, ni d'avant celui des requêtes, ni du quota, ni des gels.
    charge = fondreCharges(charge, l.charge ?? null)
    connexions = fondreConnexions(connexions, l.connexions ?? null)
    requetes = fondreRequetes(requetes, l.requetes ?? null)
    quota = fondreQuotas(quota, l.quota ?? null)
    gels = fondreGels(gels, l.gels ?? null)
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
    ...(gels && { gels }),
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
export const finDe = (d: DemarrageDuServeur, maintenant: number, courant: string) => d.arreteLe ?? (d.id === courant ? maintenant : d.vuLe)

/**
 * Le temps éveillé entre deux instants, en millisecondes : la réunion des vies
 * des démarrages — de leur départ à leur fin (`finDe`) —, deux vies qui se
 * chevauchent comptées une fois : à une mise en ligne, l'ancien serveur vit
 * encore un instant à côté du nouveau, et l'hébergeur ne facture qu'un service.
 */
export function eveilleEntre(demarrages: readonly DemarrageDuServeur[], debut: number, fin: number, maintenant: number, courant: string): number {
  const vies = demarrages
    .map(d => [Math.max(debut, d.demarreLe), Math.min(fin, finDe(d, maintenant, courant))] as const)
    .filter(([de, a]) => a > de)
    .sort((x, y) => x[0] - y[0])
  let total = 0
  let jusqua = -Infinity
  for (const [de, a] of vies) {
    if (a <= jusqua) continue
    total += a - Math.max(de, jusqua)
    jusqua = a
  }
  return total
}

/** Le rythme des heures de l'hébergeur : les sept derniers jours, que les démarrages gardés couvrent tout entiers. */
export const JOURS_DU_RYTHME = 7

/** Les heures éveillées d'un service ce mois-ci : faites, et projetées à la fin du mois au rythme de la semaine. */
export interface HeuresDeLHebergeur {
  faites: number
  projetees: number
  /** Les heures d'un jour moyen des sept derniers. */
  rythme: number
}

/**
 * Les heures que ce service aura passées éveillé ce mois-ci, au rythme des
 * sept derniers jours (la revue d'expert du 4 novembre 2026, P1.5) : celles
 * déjà faites, puis le reste du mois à ce rythme. Les jours que les
 * démarrages gardés couvrent (`SANTE_GARDEE_MS` : un démarrage vivant pendant
 * l'un d'eux a donné signe de vie depuis) se comptent sur eux ; les plus
 * anciens, sur la mémoire du QG (`qg_jours`) ; un jour qu'elle ne sait pas se
 * compte au rythme. `jours` : les jours du mois jusqu'à aujourd'hui, chacun
 * ses bornes et ce que la mémoire en sait. Le mois est celui de Paris : celui
 * de l'hébergeur part à une heure ou deux près, sur sept cent cinquante.
 */
export function heuresDuMois({
  demarrages,
  maintenant,
  courant,
  finDuMois,
  jours,
}: {
  demarrages: readonly DemarrageDuServeur[]
  maintenant: number
  courant: string
  finDuMois: number
  jours: readonly { debut: number; fin: number; heures: number | null }[]
}): HeuresDeLHebergeur {
  const couvertDepuis = maintenant - SANTE_GARDEE_MS
  let faites = 0
  let inconnu = 0
  for (const j of jours) {
    const fin = Math.min(j.fin, maintenant)
    if (fin <= j.debut) continue
    if (j.debut >= couvertDepuis) faites += eveilleEntre(demarrages, j.debut, fin, maintenant, courant)
    else if (j.heures !== null) faites += j.heures * HEURE_MS
    else inconnu += fin - j.debut
  }
  const semaine = JOURS_DU_RYTHME * 24 * HEURE_MS
  const part = eveilleEntre(demarrages, maintenant - semaine, maintenant, maintenant, courant) / semaine
  return {
    faites: faites / HEURE_MS,
    projetees: (faites + (inconnu + Math.max(0, finDuMois - maintenant)) * part) / HEURE_MS,
    rythme: part * 24,
  }
}

/** Une machine qui ne dit pas ses plafonds. */
export const PLAFONDS_INCONNUS: PlafondsDuConteneur = { processeurPct: null, memoireMo: null }

/** Ce que des heures disent d'une route : ses appels, et ses centiles en sommes pondérées par leurs appels. */
interface CumulDUneRoute {
  n: number
  s50: number
  s95: number
  max: number
  totalMs: number
  refusees: number
  enErreur: number
}

/** Ce qu'une ligne dit, route par route — ses routes, ou ses messages du temps réel, qui s'écrivent pareil. */
type LireLaTable<L> = (l: L) => readonly RouteDeLHeure[] | undefined
const sesRoutes: LireLaTable<Pick<HeureDeSante, 'parRoute'>> = l => l.parRoute

function cumulsDesRoutes<L>(lignes: readonly L[], lire: LireLaTable<L>): Map<string, CumulDUneRoute> {
  const cumuls = new Map<string, CumulDUneRoute>()
  for (const l of lignes) {
    for (const r of lire(l) ?? []) {
      if (r.n <= 0) continue
      const c = cumuls.get(r.route) ?? { n: 0, s50: 0, s95: 0, max: 0, totalMs: 0, refusees: 0, enErreur: 0 }
      c.n += r.n
      c.s50 += r.p50 * r.n
      c.s95 += r.p95 * r.n
      c.max = Math.max(c.max, r.max)
      c.totalMs += r.totalMs
      c.refusees += r.refusees
      c.enErreur += r.enErreur
      cumuls.set(r.route, c)
    }
  }
  return cumuls
}

const routeDuCumul = (route: string, c: CumulDUneRoute): RouteDeLHeure => ({
  route,
  n: c.n,
  p50: Math.round(c.s50 / c.n),
  p95: Math.round(c.s95 / c.n),
  max: Math.round(c.max),
  totalMs: Math.round(c.totalMs),
  refusees: c.refusees,
  enErreur: c.enErreur,
})

/**
 * La table des routes : celles des heures `[debut, fin]`, la plus coûteuse au
 * serveur d'abord — ses appels fois son temps —, chacune sa part, ses appels
 * heure par heure, et sa ligne de la période d'avant (`[avantDebut, avantFin]`).
 * Ses centiles sont ceux de ses heures, moyennés par leurs appels, comme « la
 * plus lente » de la semaine.
 */
export function routesDeLaPeriode(
  lignes: readonly Pick<HeureDeSante, 'heure' | 'parRoute'>[],
  bornes: { debut: number; fin: number; avantDebut: number; avantFin: number },
): RouteDeLaPeriode[] {
  return tableDeLaPeriode(lignes, sesRoutes, bornes)
}

/**
 * Les messages du temps réel d'une période, en table comme les routes
 * (`TempsReelDeLHeure.parMessage`, qui s'écrit comme `parRoute`) : le plus
 * coûteux au serveur d'abord, sa part, ses arrivées heure par heure, la période
 * d'avant.
 */
export function messagesDeLaPeriode(
  lignes: readonly Pick<HeureDeSante, 'heure' | 'tempsReel'>[],
  bornes: { debut: number; fin: number; avantDebut: number; avantFin: number },
): RouteDeLaPeriode[] {
  return tableDeLaPeriode(lignes, l => l.tempsReel?.parMessage, bornes)
}

function tableDeLaPeriode<L extends { heure: number }>(
  lignes: readonly L[],
  lire: LireLaTable<L>,
  { debut, fin, avantDebut, avantFin }: { debut: number; fin: number; avantDebut: number; avantFin: number },
): RouteDeLaPeriode[] {
  const dans = lignes.filter(l => l.heure >= debut && l.heure <= fin)
  const cumuls = cumulsDesRoutes(dans, lire)
  const avant = cumulsDesRoutes(
    lignes.filter(l => l.heure >= avantDebut && l.heure <= avantFin),
    lire,
  )
  const total = [...cumuls.values()].reduce((s, c) => s + c.totalMs, 0)
  // Les appels heure par heure, d'un seul passage : chercher chaque route dans chaque heure coûtait 120 × 168 × 120
  // comparaisons à chaque ouverture, au dixième de cœur de l'hébergeur.
  const heures = Math.max(0, Math.round((fin - debut) / HEURE_MS) + 1)
  const parHeure = new Map<string, number[]>()
  if (heures > 2) {
    for (const l of dans) {
      const i = Math.round((l.heure - debut) / HEURE_MS)
      for (const r of lire(l) ?? []) {
        let serie = parHeure.get(r.route)
        if (!serie) parHeure.set(r.route, (serie = Array.from({ length: heures }, () => 0)))
        serie[i] += r.n
      }
    }
  }
  return [...cumuls]
    .map(([route, c]) => {
      const a = avant.get(route)
      return {
        ...routeDuCumul(route, c),
        part: total > 0 ? Math.round((c.totalMs / total) * 1000) / 10 : 0,
        parHeure: parHeure.get(route) ?? [],
        avant: a ? { n: a.n, p95: Math.round(a.s95 / a.n) } : null,
      }
    })
    .sort((a, b) => b.totalMs - a.totalMs || b.n - a.n || (a.route < b.route ? -1 : 1))
}

/**
 * Le temps réel d'une période (`[debut, fin]`, sa période d'avant pour l'écart
 * de chaque message) : les messages en table, et ce que les heures ont compté —
 * les refus, les pannes, les « trop tard », les liaisons ouvertes, les
 * chronomètres, le pic des clients. Null sans une heure qui le relève : un
 * serveur d'avant le 4 novembre 2026 n'en dit rien, et la page le dit.
 */
export function tempsReelDeLaPeriode(
  lignes: readonly Pick<HeureDeSante, 'heure' | 'tempsReel' | 'charge'>[],
  bornes: { debut: number; fin: number; avantDebut: number; avantFin: number },
): TempsReelDeLaPeriode | null {
  const relevees = lignes.filter(l => l.tempsReel !== undefined)
  if (relevees.length === 0) return null
  const dans = lignes.filter(l => l.heure >= bornes.debut && l.heure <= bornes.fin)
  const t: Omit<TempsReelDeLaPeriode, 'messages' | 'depuis'> = {
    recus: 0,
    refuses: 0,
    enPanne: 0,
    tropTard: 0,
    connexions: 0,
    chronos: { n: 0, enRetard: 0, maxMs: 0 },
    clientsMax: null,
  }
  for (const l of dans) {
    const r = l.tempsReel
    if (typeof l.charge?.tempsReelMax === 'number') t.clientsMax = Math.max(t.clientsMax ?? 0, l.charge.tempsReelMax)
    if (!r) continue
    for (const m of r.parMessage) {
      t.recus += m.n
      t.refuses += m.refusees
      t.enPanne += m.enErreur
    }
    t.tropTard += r.tropTard
    t.connexions += r.connexions
    t.chronos.n += r.chronos.n
    t.chronos.enRetard += r.chronos.enRetard
    t.chronos.maxMs = Math.max(t.chronos.maxMs, r.chronos.maxMs)
  }
  return { ...t, messages: messagesDeLaPeriode(lignes, bornes), depuis: Math.min(...relevees.map(l => l.heure)) }
}

/**
 * Les versions de la semaine, chacune comparée à celle d'avant : ce qu'un
 * joueur a attendu sous elle, ses erreurs pour mille requêtes, son processeur
 * et sa mémoire, et les routes qu'elle a ralenties d'un tiers et plus, sur
 * assez d'appels des deux côtés (`APPELS_POUR_COMPARER`, `RALENTIE_DE`). Hors
 * de l'hébergeur, un démarrage n'a pas de version : il n'y est pas. La plus
 * récente d'abord.
 */
export function versionsDuServeur(
  lignes: readonly HeureDeSante[],
  demarrages: readonly DemarrageDuServeur[],
  maintenant: number,
  courant: string,
): VersionDuServeur[] {
  const parVersion = new Map<string, { demarrages: DemarrageDuServeur[]; lignes: HeureDeSante[] }>()
  for (const d of demarrages) {
    if (!d.version) continue
    const v = parVersion.get(d.version) ?? { demarrages: [], lignes: [] }
    v.demarrages.push(d)
    parVersion.set(d.version, v)
  }
  const versionDe = new Map(demarrages.map(d => [d.id, d.version]))
  for (const l of lignes) {
    const version = versionDe.get(l.demarrage)
    if (version) parVersion.get(version)?.lignes.push(l)
  }
  const ordre = [...parVersion].sort(([, a], [, b]) => Math.min(...a.demarrages.map(d => d.demarreLe)) - Math.min(...b.demarrages.map(d => d.demarreLe)))
  const versions: VersionDuServeur[] = []
  let avant: Map<string, CumulDUneRoute> | null = null
  for (const [version, v] of ordre) {
    let n = 0
    let s50 = 0
    let s95 = 0
    let requetes = 0
    let erreurs = 0
    let releves = 0
    let processeur = 0
    let memoire: number | null = null
    for (const l of v.lignes) {
      if (l.routes && l.routes.n > 0) {
        n += l.routes.n
        s50 += l.routes.p50 * l.routes.n
        s95 += l.routes.p95 * l.routes.n
      }
      if (l.requetes) requetes += requetesServies(l.requetes)
      erreurs += totalDesErreurs(l.erreurs)
      if (l.charge && l.charge.n > 0) {
        releves += l.charge.n
        processeur += l.charge.processeur * l.charge.n
        memoire = Math.max(memoire ?? 0, l.charge.memoireMaxMo)
      }
    }
    const routes = cumulsDesRoutes(v.lignes, sesRoutes)
    const ralenties: VersionDuServeur['ralenties'] = []
    for (const [route, c] of avant ?? []) {
      const ici = routes.get(route)
      if (!ici || ici.n < APPELS_POUR_COMPARER || c.n < APPELS_POUR_COMPARER) continue
      const p95Avant = c.s95 / c.n
      const p95Apres = ici.s95 / ici.n
      if (p95Avant > 0 && p95Apres >= p95Avant * RALENTIE_DE) ralenties.push({ route, avant: Math.round(p95Avant), apres: Math.round(p95Apres) })
    }
    ralenties.sort((a, b) => b.apres / b.avant - a.apres / a.avant)
    versions.push({
      version,
      depuis: Math.min(...v.demarrages.map(d => d.demarreLe)),
      jusqua: Math.max(...v.demarrages.map(d => finDe(d, maintenant, courant))),
      heures: new Set(v.lignes.map(l => l.heure)).size,
      routes: n > 0 ? { n, p50: Math.round(s50 / n), p95: Math.round(s95 / n) } : null,
      requetes,
      erreursPourMille: requetes > 0 ? Math.round((erreurs / requetes) * 10_000) / 10 : null,
      processeur: releves > 0 ? Math.round((processeur / releves) * 10) / 10 : null,
      memoireMaxMo: memoire,
      ralenties: ralenties.slice(0, 3),
    })
    // Une version sans route mesurée ne sert pas de point de comparaison : la suivante se compare à la dernière qui en a.
    if (routes.size > 0) avant = routes
  }
  return versions.reverse()
}

/** Les tranches de cinq minutes de lignes d'heures, tous démarrages fondus, par leur début. */
export function tranchesFondues(lignes: readonly Pick<HeureDeSante, 'tranches'>[]): Map<number, TrancheDeSante> {
  const fondues = new Map<number, TrancheDeSante>()
  for (const l of lignes) {
    for (const t of l.tranches ?? []) {
      const a = fondues.get(t.debut)
      if (!a) {
        fondues.set(t.debut, { ...t, requetes: { ...t.requetes }, charge: t.charge && { ...t.charge }, gels: { ...t.gels } })
        continue
      }
      // Deux démarrages dans les mêmes cinq minutes — une mise en ligne : la moyenne se pondère, les pics gardent le pire.
      const ca = a.charge
      const cb = t.charge
      fondues.set(t.debut, {
        debut: t.debut,
        routes: fondreReleves(a.routes, t.routes),
        base: fondreReleves(a.base, t.base),
        requetes: fondreRequetes(a.requetes, t.requetes) ?? a.requetes,
        erreurs: a.erreurs + t.erreurs,
        charge:
          ca && cb
            ? {
                n: ca.n + cb.n,
                processeur: Math.round(((ca.processeur * ca.n + cb.processeur * cb.n) / (ca.n + cb.n)) * 10) / 10,
                boucleMaxMs: Math.max(ca.boucleMaxMs, cb.boucleMaxMs),
                memoireMaxMo: Math.max(ca.memoireMaxMo, cb.memoireMaxMo),
                invitesMax: Math.max(ca.invitesMax, cb.invitesMax),
              }
            : (ca ?? cb),
        gels: { n: a.gels.n + t.gels.n, maxMs: Math.max(a.gels.maxMs, t.gels.maxMs) },
      })
    }
  }
  return fondues
}

/** Combien d'heures de lignes chaque période lit : sur une heure, l'heure en cours et la précédente, que ses tranches couvrent. */
const HEURES_DE_LA_PERIODE: Record<PeriodeDuServeur, number> = { '1h': 2, '24h': 24, '7j': HEURES_DE_SANTE }

/**
 * La page « Le serveur » sur sa période (`periode`, la semaine d'office) : ses
 * seaux — une heure, ou cinq minutes sur une heure (`tranches`) —, les
 * démarrages et les arrêts nets, quatre chiffres, chaque route, les gels, et
 * les versions de la semaine. `demarrages` porte aussi le dernier démarrage
 * d'avant la semaine : la sorte du premier se lit dans lui. Le quota se
 * projette toujours sur la semaine : une heure n'en dit rien.
 */
export function pageDuServeur(
  lignes: readonly HeureDeSante[],
  demarrages: readonly DemarrageDuServeur[],
  {
    maintenant,
    courant,
    plafonds = PLAFONDS_INCONNUS,
    mesuresDeLHebergeur = null,
    periode = '7j',
  }: { maintenant: number; courant: DemarrageDuServeur; plafonds?: PlafondsDuConteneur; mesuresDeLHebergeur?: string | null; periode?: PeriodeDuServeur },
): PageDuServeur {
  const derniere = debutDeLHeure(maintenant)
  const nHeures = HEURES_DE_LA_PERIODE[periode]
  const debut = derniere - (nHeures - 1) * HEURE_MS
  const debutDeLaSemaine = derniere - (HEURES_DE_SANTE - 1) * HEURE_MS
  const pas = periode === '1h' ? TRANCHE_MS : HEURE_MS
  // Les seaux des graphiques : les heures de la période, ou les douze dernières tranches de cinq minutes.
  const premierSeau = periode === '1h' ? debutDeLaTranche(maintenant) - (TRANCHES_PAR_HEURE - 1) * TRANCHE_MS : debut
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
  const tranches = periode === '1h' ? tranchesFondues(lignes.filter(l => l.heure >= debut && l.heure <= derniere)) : null
  for (let heure = debut; heure <= derniere; heure += HEURE_MS) {
    const h = fondreLHeure(parHeure.get(heure) ?? [])
    if (h) fondues.push(h)
    // Sur une heure, les seaux sont les tranches, plus bas : l'heure ne sert qu'aux chiffres, aux erreurs et aux gels.
    if (tranches) continue
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
      gels: h?.gels && h.gels.n > 0 && h.gels.plusLongs[0] ? { n: h.gels.n, plusLong: h.gels.plusLongs[0] } : null,
    })
  }
  // Une heure en cinq minutes : ce que les tranches relèvent — ce qu'un joueur attend, Turso, les requêtes, les erreurs,
  // la charge. Ni les connexions, ni le quota, ni le réseau, ni le détail des gels : l'heure seule les garde.
  if (tranches) {
    for (let t = premierSeau; t <= debutDeLaTranche(maintenant); t += TRANCHE_MS) {
      const tr = tranches.get(t)
      heures.push({
        heure: t,
        eveille: !!tr || vies.some(([de, a]) => de < t + TRANCHE_MS && a >= t),
        base: tr?.base?.p95 ?? null,
        routes: tr?.routes?.p95 ?? null,
        erreurs: tr?.erreurs ?? 0,
        erreursParSource: [],
        miroir: 0,
        processeur: tr?.charge?.processeur ?? null,
        gele: null,
        boucle: tr?.charge?.boucleMaxMs ?? null,
        memoire: tr?.charge?.memoireMaxMo ?? null,
        invites: tr?.charge?.invitesMax ?? null,
        connexionsNeuves: null,
        connexions: null,
        requetes: tr?.requetes ?? null,
        connexionsOuvertes: null,
        tempsReel: null,
        envoyesMo: null,
        recusMo: null,
        lignesLues: null,
        lignesEcrites: null,
        gels: null,
      })
    }
  }

  // Les erreurs de la période, par source.
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

  // Les événements : chaque démarrage de la période, et chaque arrêt net.
  const evenements: EvenementDuServeur[] = []
  tous.forEach((d, i) => {
    if (d.demarreLe >= premierSeau) {
      evenements.push({ quand: d.demarreLe, sorte: sorteDuDemarrage(d, tous[i - 1], maintenant, courant.id), pretEnMs: d.pretEnMs, version: d.version })
    }
    if (arreteNet(d, maintenant, courant.id) && d.vuLe >= premierSeau) evenements.push({ quand: d.vuLe, sorte: 'arret-net', pretEnMs: null, version: d.version })
  })
  evenements.sort((a, b) => b.quand - a.quand)
  const demarresCetteSemaine = tous.filter(d => d.demarreLe >= premierSeau)
  const prets = demarresCetteSemaine.map(d => d.pretEnMs).filter((ms): ms is number => ms !== null)
  // Les erreurs en détail, sur les heures de la semaine ; leur version, celle du démarrage qui les a relevées.
  const versions = new Map(tous.map(d => [d.id, d.version]))
  const enDetail = erreursDeLaSemaine(
    lignes.filter(l => l.heure >= debut && l.heure <= derniere),
    id => versions.get(id) ?? null,
  )

  const relevees = lignes.filter(l => l.parRoute !== undefined).map(l => l.heure)
  // Le temps réel, comme les routes : ses messages en table, la période d'avant pour leur écart.
  const tempsReel = tempsReelDeLaPeriode(lignes, { debut, fin: derniere, avantDebut: debut - nHeures * HEURE_MS, avantFin: debut - HEURE_MS })
  return {
    maintenant,
    periode,
    pas,
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
      lignes.filter(l => l.heure >= debutDeLaSemaine && l.heure <= derniere),
      maintenant,
    ),
    gels: gelsDeLaSemaine(fondues),
    routes: routesDeLaPeriode(lignes, { debut, fin: derniere, avantDebut: debut - nHeures * HEURE_MS, avantFin: debut - HEURE_MS }),
    routesDepuis: relevees.length > 0 ? Math.min(...relevees) : null,
    // Les téléphones, sur les heures de la période — sur une heure, celle en cours et la précédente, comme les routes.
    telephones: telephonesDeLaPeriode(lignes.filter(l => l.heure >= debut && l.heure <= derniere).map(l => l.telephones)),
    ...(tempsReel && { tempsReel }),
    versions: versionsDuServeur(
      lignes.filter(l => l.heure >= debutDeLaSemaine && l.heure <= derniere),
      tous,
      maintenant,
      courant.id,
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
  seuils = SEUILS_DU_SERVEUR,
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
  /** Les seuils réglés au QG (`ReglesDuQg`, le QG 2, lot 8) ; d'office, ceux du code. */
  seuils?: SeuilsDuServeur
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
    tursoLent: jugee?.base && jugee.base.p95 > seuils.tursoLentMs ? { p95: jugee.base.p95, depuis: jugee.heure } : null,
    memoireMo: memoireMo !== null && memoireMo > seuils.memoireMo ? memoireMo : null,
    quota:
      quota && quota.part >= seuils.partDuQuota && maintenant - quota.depuis >= HEURES_POUR_PROJETER * HEURE_MS
        ? { part: quota.part, luesSurTrenteJours: quota.luesSurTrenteJours }
        : null,
  }
}
