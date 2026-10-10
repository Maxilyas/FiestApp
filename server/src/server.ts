import { adopterLesComptes } from './auth/profilUnique'
import express, { type NextFunction, type Request, type Response } from 'express'
import compression from 'compression'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { initDb, stampLegacySpace, wipeSpace } from './core/db'
import { PartyBackup, type ReglagesMiroir } from './core/backup'
import { photosCitees, QuizStore } from './core/quizStore'
import { seedLibrary } from './core/seed'
import { INTROUVABLE, ROBOTS_TXT, decrirePage, habillerPage } from './core/apercus'
import { clearQuizLibrary, setProgramme, setQuestionsPosees, setQuizLibrary } from './games/quiz'
import { dernieresFois } from './core/memoire'
import { ProgrammeStore } from './core/programmes'
import { SalonStore } from './core/salons'
import { CampagneStore } from './core/campagne'
import type { BaseDeLaCampagne } from './core/baseCampagne'
import { Budget } from './core/budget'
import { clientIp } from './auth/http'
import { PartageStore } from './core/partages'
import { ArchiveStore, recapOfArchive, reviewOfArchive } from './core/archive'
import type { BadgeLookup } from './core/party'
import { recalculerHistorique } from './core/recalcul'
import { reprendreLesPortraits } from './core/repriseDesPortraits'
import { appliquerLeBaremeDuSolo } from './core/baremeDuSolo'
import { ReserveDInscriptions } from './core/inscriptions'
import { SpaceRegistry } from './core/space'
import { PagesPubliques, type DemandeDePage } from './core/pages'
import { servirPrecompresse } from './core/precompresse'
import { Charge, pouls } from './core/pouls'
import { AuthStore, type AccountRec } from './auth/store'
import { ProfileStore, cleDeSoiree } from './auth/profiles'
import { mountApi } from './api'
import { JourStore } from './core/jour'
import { RappelStore } from './core/rappels'
import { erreurDeRequete, repondreErreur } from './core/http'
import { ecrireAttente, espaceDeLEntree, pageDEntree, prechargerDonnees } from './core/page'
import { parseRoute } from '../../shared/adresses'
import { donneesDeDepart } from '../../shared/depart'
import { wireSockets } from './sockets'
import { SERVEUR } from './racine'
import type { IoServer } from './core/types'
import type { ArchiveList, DerniereSoiree, PartyArchive } from '../../shared/archive'
import { MAX_PLAYERS_CEILING } from '../../shared/space'

/**
 * Ce que la page d'une soirée archivée attend la base permanente pour dire
 * 404 à une soirée qui n'existe pas. Au-delà, elle s'ouvre en 200 et dira
 * elle-même ce qu'elle peut lire.
 */
const DELAI_VERIFICATION_ARCHIVE_MS = 1500

export interface QuizServerOptions {
  port: number
  /** Base locale jetable : joueurs et état de la partie en cours. */
  dbPath: string
  /**
   * Le compte administrateur, créé au tout premier démarrage s'il n'y a
   * encore aucun compte. Le mot de passe ne sert qu'à cette création.
   */
  admin: { login: string; password: string; slug: string; name: string }
  /** Bibliothèque de quiz : fichier local (`file:...`) ou base Turso (`libsql://...`). */
  quizDbUrl: string
  quizDbToken?: string
  /** URL publique à mettre dans le QR code (prioritaire sur l'IP locale). */
  publicUrl?: string
  /**
   * Derrière le proxy d'un hébergeur : on lit l'adresse des clients dans
   * `x-forwarded-for`, et on n'accepte les connexions temps réel que depuis
   * la page servie par l'application.
   */
  online?: boolean
  /** Plafond d'invités par soirée, que même le réglage d'un espace ne dépasse pas. */
  maxPlayers?: number
  /**
   * Le nom de l'environnement quand ce n'est pas la production (« preprod »).
   * Il est posé dans la page, et le client en fait un bandeau permanent.
   * Absent en production : rien ne s'affiche, et rien ne pèse.
   */
  appEnv?: string
  /** Les délais du miroir de la soirée — les tests les resserrent, la production garde les siens. */
  miroir?: Omit<ReglagesMiroir, 'base'>
  /** Le client compilé. Les tests en donnent un de trois lignes : `client/dist` n'existe qu'après le build. */
  clientDist?: string
  /** L'heure du quiz du jour. Les tests la font passer minuit ; en ligne, celle du serveur. */
  horlogeDuJour?: () => number
  /**
   * Le jeton de la routine qui remplit la réserve du quiz du jour
   * (`RESERVE_TOKEN`, `quizDuJour.ts`). Absent : la porte n'existe pas, et
   * la réserve se remplit à la main.
   */
  jetonDeLaReserve?: string
  /**
   * La base de la campagne (`core/baseCampagne.ts`). Absente : celle du
   * dépôt, lue en fond peu après le démarrage. Les tests en donnent une
   * petite — ou de quoi la fabriquer, pour savoir quand elle se lit.
   */
  baseDeLaCampagne?: BaseDeLaCampagne | (() => BaseDeLaCampagne)
  /** Quand la base de la campagne se lit en fond, après le démarrage (`PRECHAUFFAGE_CAMPAGNE_MS`). */
  prechauffageCampagneMs?: number
  /**
   * Le rappel du soir du quiz du jour (`core/rappels.ts`) : les tests
   * regardent l'heure plus souvent, et ouvrent leur propre service de push,
   * sur la machine — en ligne, seuls ceux des navigateurs sont acceptés.
   */
  rappels?: { intervalleMs?: number; servicesDePush?: (url: URL) => boolean }
  /**
   * Le commit qui tourne, sept caractères (`RENDER_GIT_COMMIT` sur
   * l'hébergeur) : la production se promeut à la main, et rien ne disait
   * laquelle tournait.
   */
  version?: string
}

/** L'avance de la réserve du quiz du jour ne se relit pas plus souvent : `/healthz` se sonde toutes les quelques secondes. */
const RESERVE_RELUE_MS = 10 * 60_000

/**
 * La base de la campagne se lit en fond, ce délai après le démarrage : la
 * requête qui a réveillé l'hébergeur est servie d'abord. Lue à la première
 * série, elle faisait attendre 3,5 s le premier joueur de campagne après
 * chaque déploiement ou réveil, au dixième de cœur.
 */
const PRECHAUFFAGE_CAMPAGNE_MS = 20_000

/**
 * Le mot de passe d'amorçage quand `ADMIN_PASSWORD` n'est pas donné. Il est
 * écrit dans le dépôt : chez soi il dépanne, en ligne il ne crée rien.
 */
export const MOT_DE_PASSE_PAR_DEFAUT = 'demo'

/**
 * Un démarrage refusé pour une raison que l'hébergeur doit lire telle quelle :
 * le message dit quoi faire, la pile n'apprendrait rien de plus.
 */
export class DemarrageRefuse extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DemarrageRefuse'
  }
}

/** Première IP locale non interne — l'adresse que les téléphones doivent ouvrir. */
function lanAddress(): string | null {
  const all = Object.values(os.networkInterfaces())
    .flatMap(list => list ?? [])
    .filter(i => i.family === 'IPv4' && !i.internal)
  const score = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2)
  all.sort((a, b) => score(a.address) - score(b.address))
  return all[0]?.address ?? null
}

/** L'origine (schéma + hôte + port) d'une URL, ou null si elle est illisible. */
function originOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * En-têtes de durcissement. Le contenu ne vient que de l'application elle-même :
 * aucun script tiers, les deux polices et les photos sont servies ici (les
 * polices tombent sous `default-src 'self'`). Les styles en ligne sont ceux
 * que React pose sur les barres et les podiums. La politique de contenu
 * dépend de l'hôte demandé : voir `contentPolicy`.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
}

/** Un hôte, et rien d'autre : un nom ou une IPv4, ou une IPv6 entre crochets, et un port. */
const HOST = /^(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i

/**
 * La politique de contenu, pour l'hôte que la page a demandé.
 *
 * Le temps réel ne doit parler qu'à ce serveur-ci. `ws: wss:` l'autorisait
 * vers n'importe quel hôte : un script injecté un jour aurait pu envoyer la
 * soirée chez lui sans que la politique y trouve à redire. Mais l'adresse
 * change selon qui regarde — `localhost` pour l'écran commun, `192.168.…:3001`
 * pour les téléphones du wifi, l'adresse publique derrière le proxy de
 * l'hébergeur, en https donc en wss. On la reprend de l'en-tête `Host`, qui
 * est exactement l'hôte que la page va rappeler. `'self'` seul suffirait aux
 * navigateurs récents, qui l'étendent à ws et wss ; pas aux plus anciens, et
 * le téléphone d'un invité n'est pas toujours récent.
 *
 * `Host` vient du client : il ne décide que de la réponse faite à ce
 * client-là, et il n'entre dans la politique que s'il a la forme d'un hôte —
 * sinon `Host: x; script-src *` la réécrirait.
 *
 * `frame-ancestors 'none'` : aucune page n'a à encadrer l'application, et un
 * cadre invisible posé sur une page tierce ferait cliquer à l'insu de qui
 * regarde. Le cookie `SameSite=Lax` n'y voyagerait déjà pas, mais la page des
 * invités n'en a pas besoin.
 */
function contentPolicy(host: string | undefined): string {
  const realtime = host && HOST.test(host) ? ` ws://${host} wss://${host}` : ''
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src 'self'${realtime}`,
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

/** Au-delà, une soirée qu'on n'a pas close n'est plus « en cours » pour `/profil`. */
const SOIREE_ACTIVE_MS = 12 * 3600_000

/** Les pages publiques d'un espace, telles que le client les route. */
const PUBLIC_PAGES = ['souvenir', 'stats', 'bilan', 'bilan/fiches']

/**
 * Des démarrages qui ne dépendent pas l'un de l'autre, menés de front. Tous
 * finissent avant qu'un échec remonte : rien n'écrit plus dans la base quand
 * le démarrage a échoué, et c'est la première panne qui se dit.
 */
async function deFront(...travaux: Promise<unknown>[]): Promise<void> {
  const issues = await Promise.allSettled(travaux)
  const panne = issues.find((i): i is PromiseRejectedResult => i.status === 'rejected')
  if (panne) throw panne.reason
}

export async function createQuizServer(opts: QuizServerOptions) {
  const debutDuDemarrage = Date.now()
  const maxPlayersCeiling = opts.maxPlayers ?? MAX_PLAYERS_CEILING
  const app = express()
  const httpServer = createServer(app)

  app.disable('x-powered-by')
  // L'analyseur de requête « étendu » d'Express repose sur `qs`, dont les
  // versions accessibles à Express 4 traînent deux failles de déni de service.
  // Aucune adresse de l'application ne lit de paramètre d'URL : l'analyseur
  // simple de Node suffit, et cette bibliothèque n'est plus jamais appelée.
  app.set('query parser', 'simple')
  // Un seul saut de proxy devant nous en ligne : c'est lui qui écrit la
  // dernière adresse de `x-forwarded-for`, celle qu'on lit.
  if (opts.online) app.set('trust proxy', 1)
  // Le temps de chaque route d'API, sous son modèle : ce qu'un joueur attend,
  // mesuré là où Turso est vraiment loin — `/healthz` le dit (`core/pouls.ts`).
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) return next()
    const debut = performance.now()
    res.on('finish', () => {
      const modele: unknown = req.route?.path
      if (typeof modele === 'string') pouls.noterRoute(`${req.method} ${modele}`, performance.now() - debut)
    })
    next()
  })
  // Le chemin d'un invité, du scan à la salle d'attente, pèse encore 320 Ko
  // de JS à nu, 106 Ko compressé — cinquante téléphones en 4G au moment du
  // scan font vite la différence. Les fichiers du paquet arrivent déjà
  // compressés (`core/precompresse.ts`), les pages publiques aussi
  // (`core/pages.ts`) : `compression()` ne compresse plus que le reste, et
  // laisse passer ce qui porte déjà son encodage.
  app.use(compression())
  app.use((req, res, next) => {
    res.set(SECURITY_HEADERS)
    res.set('Content-Security-Policy', contentPolicy(req.headers.host))
    next()
  })

  // Le temps réel n'accepte que les pages servies par l'application. Les
  // scripts de test et de charge n'envoient pas d'origine : ils passent. Chez
  // soi, sans URL publique, tout passe — l'écran commun peut être ouvert en
  // `localhost` pendant que les téléphones utilisent l'adresse du wifi.
  const allowedOrigin = opts.online ? originOf(opts.publicUrl) : null
  const io: IoServer = new Server(httpServer, {
    // Le battement de cœur : un ping toutes les 10 s, 8 s pour y répondre.
    // Une liaison morte se voit donc en 18 s au plus, des deux côtés — au
    // lieu de 45 s avec les réglages par défaut (25 + 20), mesurés à 43,6 s :
    // plus qu'une question entière, pendant laquelle un téléphone tombé du
    // wifi n'affichait rien et l'écran commun le comptait encore parmi les
    // présents. Huit secondes de grâce restent larges pour la 4G d'une salle
    // bondée. Le prix : un ping et un pong de quelques octets toutes les dix
    // secondes, soit ~300 octets avec les en-têtes TCP et TLS — pour 150
    // téléphones, 4,5 Ko/s côté serveur et 100 Ko par heure et par forfait.
    pingInterval: 10_000,
    pingTimeout: 8_000,
    cors: { origin: allowedOrigin ?? true },
    allowRequest: (req, callback) => {
      const origin = req.headers.origin
      const ok = !allowedOrigin || !origin || origin === allowedOrigin
      callback(ok ? null : 'origine refusée', ok)
    },
  })

  const db = initDb(opts.dbPath)

  // ── Le démarrage, dans l'ordre ──────────────────────────────────────────
  //
  // Les comptes d'abord : tout le reste est rangé par espace, et ce qui date
  // d'avant les espaces — bibliothèque, photos, archives, soirée en cours —
  // est rattaché à celui de l'administrateur, sans rien copier ni effacer.
  const auth = new AuthStore(opts.quizDbUrl, opts.quizDbToken)
  await auth.init()
  const hadAccounts = auth.count() > 0
  // Le mot de passe d'amorçage ne sert qu'à créer l'administrateur, sur une
  // base encore vide : c'est là, et seulement là, qu'il doit être un vrai.
  // Exigé à chaque démarrage, il empêchait la production de se réveiller une
  // fois la variable retirée — ce que la documentation demande de faire, et
  // sur l'offre gratuite chaque réveil est un démarrage.
  if (!hadAccounts && opts.online && (!opts.admin.password || opts.admin.password === MOT_DE_PASSE_PAR_DEFAUT)) {
    auth.close()
    db.close()
    throw new DemarrageRefuse(
      'ADMIN_PASSWORD manquant : la base n’a encore aucun compte, et en ligne l’administrateur ne se crée pas avec le mot de passe par défaut. ' +
        'Définis ADMIN_PASSWORD dans les variables du service ; une fois le compte créé, tu pourras la retirer.',
    )
  }
  const defaultSpace = await auth.ensureDefaultSpace(opts.admin)
  if (!hadAccounts) console.log(`[comptes] administrateur « ${opts.admin.login} » créé, espace « ${opts.admin.slug} »`)

  // Le disque d'un hébergeur gratuit est effacé à chaque redémarrage : les
  // soirées (invités, points, parties) sont donc recopiées dans la base
  // distante, et rechargées ici si la base locale est repartie vide. La base
  // locale fait foi : c'est d'elle qu'une resynchronisation relit un espace.
  const backup = new PartyBackup(opts.quizDbUrl, opts.quizDbToken, { ...opts.miroir, base: db })
  const restaurer = async () => {
    await backup.init(defaultSpace)
    const restored = await backup.restoreInto(db)
    if (restored.players > 0 || restored.teams > 0) {
      console.log(
        `[soirée] ${restored.players} invités, ${restored.teams} équipes, ${restored.scores} gains, ${restored.answers} réponses` +
          (restored.sessions > 0 ? ` et ${restored.sessions > 1 ? `${restored.sessions} parties` : 'la partie'} en cours` : '') +
          (restored.spaces > 1 ? ` (${restored.spaces} espaces)` : '') +
          ' rechargés après redémarrage',
      )
    }
    const stamped = stampLegacySpace(db, defaultSpace)
    if (stamped > 0) console.log(`[espaces] ${stamped} lignes d'avant les comptes rattachées à « ${opts.admin.slug} »`)
  }

  // Les profils des joueurs récurrents. Ils vivent dans la base permanente,
  // avec les comptes : un profil traverse les soirées et les animateurs, et la
  // base locale, elle, est vidée à chaque « Nouvelle soirée ».
  const profiles = new ProfileStore(opts.quizDbUrl, opts.quizDbToken)
  // Le quiz du jour, pour les profils : sa réserve, ses parties, ses nuits.
  const maintenantDuJour = opts.horlogeDuJour ?? Date.now
  const jour = new JourStore(opts.quizDbUrl, opts.quizDbToken, { profiles, maintenant: maintenantDuJour })
  // Son rappel du soir, aux téléphones qui l'ont demandé. Les services de push
  // veulent de quoi joindre qui les sollicite : l'adresse publique du serveur.
  const adressePublique = originOf(opts.publicUrl)
  const rappels = new RappelStore(opts.quizDbUrl, opts.quizDbToken, {
    profiles,
    jour,
    maintenant: maintenantDuJour,
    sujet: adressePublique?.startsWith('https://') ? adressePublique : 'mailto:fiestapp@example.com',
    ...opts.rappels,
  })
  // Bibliothèque de quiz : le stockage permanent, séparé de la base jetable.
  const store = new QuizStore(opts.quizDbUrl, opts.quizDbToken)
  // Les programmes de soirée : celui de ce soir, par espace, est ce que la
  // console propose au lancement.
  const programmes = new ProgrammeStore(opts.quizDbUrl, opts.quizDbToken)
  // Les partages : les codes, et le catalogue du serveur.
  const partages = new PartageStore(opts.quizDbUrl, opts.quizDbToken)
  // Les codes des salons : six chiffres pour entrer chez quelqu'un.
  const salons = new SalonStore(opts.quizDbUrl, opts.quizDbToken)
  // La campagne solo : ses séries, tirées de sa base à elle (`core/baseCampagne.ts`),
  // loin de la réserve du quiz du jour.
  const campagne = new CampagneStore(opts.quizDbUrl, opts.quizDbToken, {
    maintenant: maintenantDuJour,
    ...(opts.baseDeLaCampagne && { base: opts.baseDeLaCampagne }),
    empreintesDuJour: () => jour.empreintes(),
    ecrireXp: (profileId, xp, jours) => profiles.ecrireXpDeCampagne(profileId, xp, jours),
    recompenses: profiles,
  })
  // L'historique des soirées vit avec la bibliothèque : c'est l'autre chose
  // qui doit survivre à tout.
  const archives = new ArchiveStore(opts.quizDbUrl, opts.quizDbToken)

  /**
   * Deux écritures du même espace lancent deux relectures, qui reviennent
   * de Turso à leur rythme : la plus ancienne, arrivée la dernière, remettait
   * en mémoire la version d'avant la correction — et « Lancer » la jouait
   * jusqu'à l'écriture suivante. Chaque relecture prend un numéro, et seule
   * la dernière partie pose ce qu'elle a lu.
   */
  const derniereRelecture = () => {
    const tours = new Map<string, number>()
    return async <T>(spaceId: string, lire: () => Promise<T>, poser: (lu: T) => void) => {
      const tour = (tours.get(spaceId) ?? 0) + 1
      tours.set(spaceId, tour)
      const lu = await lire()
      if (tours.get(spaceId) === tour) poser(lu)
    }
  }
  const relireLaBibliotheque = derniereRelecture()
  /** Recharge la bibliothèque d'un espace — ou toutes, au démarrage. */
  const refreshLibrary = async (spaceId?: string) => {
    if (spaceId) return relireLaBibliotheque(spaceId, () => store.all(spaceId), quizzes => setQuizLibrary(spaceId, quizzes))
    for (const [id, quizzes] of await store.allBySpace()) setQuizLibrary(id, quizzes)
  }
  const relireLeProgramme = derniereRelecture()
  const refreshProgramme = async (spaceId?: string) => {
    if (spaceId) {
      return relireLeProgramme(spaceId, () => programmes.actif(spaceId), programme => {
        setProgramme(spaceId, programme)
        // Un quiz ajouté pendant le dernier podium : la soirée continue.
        registry.peek(spaceId)?.reconsidererCloture()
      })
    }
    for (const [id, programme] of await programmes.actifs()) setProgramme(id, programme)
  }

  // Le miroir et ces magasins ne dépendent que des comptes, pas l'un de
  // l'autre : ils s'ouvrent de front. L'un après l'autre, chaque réveil de
  // l'hébergeur attendait soixante allers-retours en série avant d'ouvrir
  // le port — trois secondes à 50 ms, pendant lesquelles le premier invité
  // qui scannait le QR regardait une page blanche.
  let imported = 0
  await deFront(
    restaurer(),
    profiles.init(),
    jour.init(),
    rappels.init(),
    (async () => {
      await store.init(defaultSpace)
      imported = await seedLibrary(store, defaultSpace)
      await refreshLibrary()
    })(),
    (async () => {
      await programmes.init()
      await refreshProgramme()
    })(),
    partages.init(),
    salons.init(),
    campagne.init(),
    (async () => {
      await archives.init(defaultSpace)
      // Le tirage d'un quiz choisit d'abord les questions jamais posées : il
      // lit ce que l'historique en sait, relu après chaque rangement.
      for (const [spaceId, memoire] of await archives.memoiresDeTous()) setQuestionsPosees(spaceId, dernieresFois(memoire))
    })(),
  )
  if (imported > 0) console.log(`[quiz] ${imported} quiz importés depuis server/content/quiz/`)
  // La carrière d'un profil compte son quiz du jour, pour ses paliers : le
  // quiz du jour dépend des profils, et se branche donc sur eux après coup.
  profiles.statsDuJour = id => jour.statsDuJour(id)
  // Le laurier du vainqueur d'hier, lu en mémoire à chaque diffusion — et le
  // champion du mois dernier, que l'écran commun salue à son entrée.
  profiles.laurierDe = id => jour.laureats().has(id)
  profiles.championDe = id => jour.champions(id)
  // Le laurier d'argent du défi de la semaine : ses vainqueurs, lus en
  // mémoire ; un profil masqué depuis le perd aussitôt.
  profiles.argentDe = id => campagne.vainqueursDuDefi().has(id) && !jour.estMasque(id)
  campagne.profils = profiles
  campagne.masque = id => jour.estMasque(id)
  // Ce que le quiz du jour et la campagne savent de lui : ses écussons et sa
  // précision, avec les soirées. Les catégories du quiz du jour ouvraient
  // aussi ses portraits : la reprise les relit une fois
  // (`core/repriseDesPortraits.ts`).
  profiles.savoirDuJour = id => jour.savoirDe(id)
  profiles.savoirDeCampagne = id => campagne.savoirDe(id)
  // Les sentiers du savoir ouvrent ses portraits et ses titres de maître ;
  // ses vies achetées en confettis sont chez le profil, qui tient le solde.
  profiles.paliersDesSentiers = id => campagne.paliersDe(id)
  campagne.viesAchetees = id => profiles.viesAcheteesDe(id)
  campagne.viesAcheteesDepuis = depuis => profiles.viesAcheteesDepuis(depuis)
  // Ses bonnes réponses du quiz du jour lui valent des confettis, comme celles des soirées.
  profiles.justesDuJour = id => jour.justesDe(id)
  profiles.confettisDeCampagne = id => campagne.confettisDe(id)
  // Ses paliers de campagne, pour les jauges de sa page ; son calendrier du quiz du jour.
  profiles.statsDeCampagne = id => campagne.statsDe(id)
  profiles.moisDuJour = () => jour.aujourdhui()
  profiles.joursDuMois = id => jour.joursDuMois(id)
  // Le quiz du jour ne pose rien que la campagne ait déjà, ni l'inverse : branché
  // après l'amorce de la réserve, qui n'a pas à lire la base.
  jour.dansLaCampagne = empreinte => campagne.dansLaBase(empreinte)
  // Un seul profil : chaque compte d'animateur d'avant reçoit le sien, une
  // fois (`auth/profilUnique.ts`). Une base neuve n'a rien d'avant.
  const unique = await adopterLesComptes(auth, profiles, !hadAccounts)
  if (unique.adoptes.length > 0) console.log(`[profils] ${unique.adoptes.length} compte(s) d'animateur rattaché(s) à un profil neuf`)
  if (unique.laisses.length > 0) {
    console.log(`[profils] ${unique.laisses.length} compte(s) laissé(s) sans profil — identifiant déjà pris : à rattacher dans « Les salons »`)
  }
  const relireLaMemoire = derniereRelecture()
  archives.surEcriture(spaceId => {
    relireLaMemoire(spaceId, () => archives.memoire(spaceId), memoire => setQuestionsPosees(spaceId, dernieresFois(memoire))).catch(e =>
      console.error('[historique] mémoire des quiz :', e),
    )
  })

  // L'expérience se relit avec le barème du jour : une fois, au premier
  // démarrage qui le change. Les soirées en cours — celles que le disque ou
  // le miroir viennent de rendre — n'ont pas fini de se jouer : elles se
  // recréditeront à leur prochain quiz.
  const enCours = new Set(
    (db.prepare('SELECT space_id, id FROM soiree').all() as { space_id: string; id: string }[]).map(r =>
      cleDeSoiree(r.space_id, r.id),
    ),
  )
  const debutDuRecalcul = Date.now()
  const recalcul = await recalculerHistorique({ profiles, archives, enCours })
  if (recalcul) {
    console.log(
      `[profils] expérience recalculée au barème du jour : ${recalcul.soirees} soirées relues, ` +
        `${recalcul.lignes} lignes revalorisées, ${recalcul.profils} profils, en ${Date.now() - debutDuRecalcul} ms`,
    )
  }
  // Les avatars du savoir se gagnent sur les sentiers : chacun garde ce qu'il
  // avait, en paliers — une fois, après le recalcul, qui a relu les soirées
  // dont il compte les bonnes réponses.
  const reprise = await reprendreLesPortraits({ profiles, campagne }, !hadAccounts)
  if (reprise && reprise.profils > 0) {
    console.log(
      `[sentiers] ${reprise.portraits} portrait(s) de ${reprise.profils} profil(s) repris en paliers` +
        (reprise.otes > 0 ? ` ; ${reprise.otes} portrait(s) porté(s) qu'ils n'avaient plus, ôté(s)` : ''),
    )
  }

  // Le quiz du jour relit ses jours passés avec les règles du jour, une fois
  // par version : ce que la nuit, la partie et le mois auraient décerné
  // (`relireLesJours`) — les lauriers d'avant, les pages du calendrier…
  const debutDesJours = Date.now()
  const jours = await jour.relireLesJours()
  if (jours) console.log(`[jour] ${jours.jours} jour(s) relu(s), ${jours.profils} profil(s), en ${Date.now() - debutDesJours} ms`)
  // La campagne aussi : les hauts faits de ses séries passées, ses paliers.
  const series = await campagne.relireLesSeries()
  if (series) console.log(`[campagne] ${series.series} série(s) relue(s), ${series.profils} profil(s)`)
  // Le barème du solo (le 6 octobre 2026) : ce qui s'est déjà joué au quiz
  // du jour et en campagne se recompte au barème du jour, une fois, et les
  // niveaux gelés de l'ancienne courbe se rattrapent (`core/baremeDuSolo.ts`).
  const solo = await appliquerLeBaremeDuSolo({ profiles, jour, campagne }, !hadAccounts)
  if (solo && hadAccounts) {
    console.log(
      `[profils] barème du solo : ${solo.jour} joueur(s) du quiz du jour, ${solo.campagne} de la campagne, ` +
        `${solo.paliers} ligne(s) de paliers, ${solo.rattrapes} niveau(x) gelé(s) rattrapé(s), ${solo.legendes} palier(s) de La Légende`,
    )
  }

  let boundPort = opts.port
  const wifi = process.env.WIFI_SSID
    ? { ssid: process.env.WIFI_SSID, pass: process.env.WIFI_PASS ?? '' }
    : null

  // Les espaces dont la soirée est en train de se clore : elle compte déjà
  // pour close dans les paliers des autres (`soireesEnCoursAilleurs`) — et
  // dans ceux que décernent le quiz du jour et le défi (`soireesEnCours`).
  const cloturesEnCours = new Set<string>()
  // Une soirée par espace, réveillée à la première connexion ; celles dont
  // une partie était en cours à l'extinction repartent tout de suite.
  const registry = new SpaceRegistry({
    db,
    io,
    backup,
    archives,
    auth,
    profiles,
    wifi,
    baseUrl: () => {
      if (opts.publicUrl) return opts.publicUrl.replace(/\/+$/, '')
      const ip = lanAddress()
      return ip ? `http://${ip}:${boundPort}` : null
    },
    maxPlayersCeiling,
    cloturesEnCours,
    jour,
    salons,
  })
  // L'Éclat tiré au quiz du jour ou au défi fait tomber La Pluie d'Éclats
  // sans compter ceux des soirées qui se jouent encore : un essai effacé
  // ensuite aurait laissé le palier sans son Éclat.
  profiles.soireesEnCours = () =>
    new Set(
      (db.prepare('SELECT space_id, id FROM soiree').all() as { space_id: string; id: string }[])
        .filter(r => !cloturesEnCours.has(r.space_id))
        .map(r => cleDeSoiree(r.space_id, r.id)),
    )
  // Un laurier qui change de tête — la nuit close, un profil masqué, le
  // défi de la semaine clos — se voit dans la salle où il joue sans attendre
  // la diffusion suivante.
  const laurierChange = (profileId: string) => {
    for (const rt of registry.all()) {
      if (!rt.party.findByProfile(profileId)) continue
      rt.broadcastSnapshot()
      // Les lignes d'un podium, d'une estimation portent aussi le laurier
      // (`distinctions`) : un podium laissé à l'écran gardait ceux de la
      // veille jusqu'à la diffusion suivante de la partie.
      rt.engine.rafraichirVues()
    }
  }
  jour.laurierChange = laurierChange
  campagne.laurierChange = laurierChange
  const woken = registry.wakeRunning()
  if (woken > 0) console.log(`[espaces] ${woken} partie${woken > 1 ? 's' : ''} en cours reprise${woken > 1 ? 's' : ''}`)

  // La réserve d'inscriptions des invités, par adresse et par espace — de
  // quoi en compter les refus (`mesure()`).
  const inscriptions = new ReserveDInscriptions()
  wireSockets(io, { registry, auth, profiles, trustProxy: !!opts.online, inscriptions })

  /**
   * Supprime un compte et tout ce qu'il a laissé. L'ordre compte : d'abord
   * ce qui vit (sessions, connexions, soirée en mémoire), puis le disque
   * local, le miroir distant, l'historique et la bibliothèque, et le compte
   * en tout dernier — si une écriture distante échoue en route, il reste un
   * compte désactivé sur lequel réessayer, pas des données sans maître.
   */
  const removeAccount = async (accountId: string, { reprendre = false }: { reprendre?: boolean } = {}) => {
    const login = auth.byId(accountId)?.login ?? accountId
    // Les écrans communs tombent avec les sessions ; les téléphones oublient
    // leur invité, puis sont coupés — ils se reconnectent et apprennent que
    // l'adresse ne mène plus nulle part.
    await auth.revokeAllSessions(accountId)
    io.to(`space:${accountId}`).emit('player:removed')
    io.in(`space:${accountId}`).disconnectSockets(true)
    registry.drop(accountId)
    clearQuizLibrary(accountId)
    wipeSpace(db, accountId)
    await backup.settle()
    await backup.forSpace(accountId).reset()
    // Avant l'historique : une panne en route laisse le compte, et un second
    // essai retrouve ce qu'il reste à reprendre dans les lignes des profils.
    const reprises = reprendre ? await profiles.retirerEspace(accountId) : 0
    const soirees = await archives.removeSpace(accountId)
    await programmes.removeSpace(accountId)
    await partages.removeSpace(accountId)
    await salons.removeSpace(accountId)
    const { quizzes, images } = await store.removeSpace(accountId)
    await auth.remove(accountId)
    // Une page publique lue pendant le ménage a pu réveiller la soirée.
    registry.drop(accountId)
    console.log(
      `[comptes] compte « ${login} » supprimé : ${quizzes} quiz, ${images} photos, ${soirees} soirées archivées` +
        (reprendre ? ` — ce que ${reprises} soirée${reprises > 1 ? 's' : ''} avai${reprises > 1 ? 'ent' : 't'} crédité, repris aux joueurs` : ''),
    )
  }

  /**
   * Supprime un profil (`/admin`, « Les profils ») — les refus sont dans la
   * route (`profilsAdmin.ts`). L'ordre compte, comme pour un compte : d'abord
   * ce qui vit (ses sessions de joueur, les consoles qu'il a ouvertes), puis
   * l'espace qu'il tenait — détaché, jamais supprimé : son salon, ses quiz et
   * les souvenirs des soirées qu'on y a jouées restent, et l'administrateur
   * le supprime à part s'il le veut —, le quiz du jour, la campagne, et sa
   * fiche en tout dernier : une écriture qui échoue en route laisse un profil
   * sur lequel réessayer, pas des lignes sans maître. Ce que ses soirées ont
   * rapporté aux autres joueurs leur reste.
   */
  const supprimerProfil = async (profileId: string): Promise<{ salon: 'detache' | null }> => {
    const login = (await profiles.byId(profileId))?.login ?? profileId
    await profiles.revokeAll(profileId)
    await auth.revokeProfileSessions(profileId)
    const salon = auth.byProfile(profileId)
    if (salon) await auth.linkProfile(salon.id, null)
    await jour.oublierProfil(profileId)
    await rappels.oublierProfil(profileId)
    await campagne.oublierProfil(profileId)
    await profiles.supprimer(profileId)
    console.log(`[profils] profil « ${login} » supprimé` + (salon ? `, détaché de « ${salon.login} »` : ''))
    return { salon: salon ? 'detache' : null }
  }

  // Filet de sécurité : un client qui aurait silencieusement raté une diffusion
  // se répare tout seul. Toutes les cinq minutes suffisent — une reconnexion
  // reçoit de toute façon un classement frais, et le dédoublonnage rendait
  // l'ancien rythme de 30 secondes aussi inutile que coûteux.
  const charge = new Charge()
  const resync = setInterval(() => {
    for (const runtime of registry.all()) runtime.sendSnapshot(true)
  }, 300_000)

  // Point de santé : sert au service de réveil (l'hébergeur gratuit endort
  // l'application sans trafic) et aux mesures de charge. Rien par espace.
  //
  // Le miroir y dit sa santé — écritures en attente, échecs, depuis quand,
  // dernier succès —, tous espaces confondus : on jouait une soirée entière
  // avec lui en panne sans que rien ne le montre, et tout se perdait au
  // réveil. Mais `ok` reste vrai, et la réponse un 200 : Render redémarre
  // une instance dont la santé échoue, et un redémarrage, c'est le disque
  // effacé — la file et tout ce qu'elle attendait d'envoyer avec.
  //
  // Et la charge, pour savoir si le serveur tient (`core/pouls.ts`) : tout
  // agrégé, sans un nom ni une adresse — la route est publique —, et lu sans
  // parcourir aucun journal. `spaces` compte les espaces chargés depuis le
  // démarrage, `quizzes` les parties ouvertes, podium compris : gardés tels
  // quels pour qui les lit déjà ; `espacesActifs` et `quizEnCours` disent ce
  // qui vit vraiment — « puis-je déployer ? ».
  /**
   * L'avance de la réserve du quiz du jour et son dernier apport, pour un
   * coup d'œil avant une soirée : la réserve qui s'épuise, la routine qui ne
   * dépose plus. Relue en arrière-plan, au plus toutes les dix minutes —
   * `/healthz` répond avec ce qu'il a, sans attendre la base ni rien dire
   * d'une question.
   */
  const reserve: { lueLe: number; enRoute: boolean; etat: { joursDAvance: number; dernierApport: number | null } | null } = {
    lueLe: 0,
    enRoute: false,
    etat: null,
  }
  const reserveDuJour = () => {
    if (!reserve.enRoute && Date.now() - reserve.lueLe > RESERVE_RELUE_MS) {
      reserve.enRoute = true
      jour
        .etatDeLaReserve()
        .then(e => {
          reserve.etat = { joursDAvance: e.joursDAvance, dernierApport: e.apports[0]?.quand ?? null }
          reserve.lueLe = Date.now()
        })
        .catch(e => console.error('[healthz] la réserve du quiz du jour ne se lit pas :', e))
        .finally(() => {
          reserve.enRoute = false
        })
    }
    return reserve.etat
  }

  app.get('/healthz', (_req, res) => {
    // Ce qui répond toujours ; chaque mesure, ensuite, sous son propre
    // filet. Sous `ulimit -n 64`, `process.memoryUsage()` lève EMFILE : une
    // mesure qui tombe ne doit pas faire tomber la réponse, ni l'instance.
    const corps: Record<string, unknown> = {
      ok: true,
      env: opts.appEnv ?? 'production',
      version: opts.version ?? null,
      uptime: Math.round(process.uptime()),
    }
    const mesurer = (nom: string, mesure: () => Record<string, unknown>) => {
      try {
        Object.assign(corps, mesure())
      } catch (e) {
        console.error(`[healthz] la mesure « ${nom} » a échoué :`, e)
      }
    }
    mesurer('espaces', () => {
      const runtimes = registry.all()
      let joueurs = 0
      let actifs = 0
      let enCours = 0
      let podiums = 0
      for (const rt of runtimes) {
        const connectes = rt.party.connectedPlayerIds().length
        const phase = rt.engine.summary() ? rt.engine.phase() : null
        joueurs += connectes
        if (connectes > 0 || phase) actifs++
        if (phase === 'finished') podiums++
        else if (phase) enCours++
      }
      return {
        spaces: runtimes.length,
        players: joueurs,
        quizzes: runtimes.filter(rt => rt.engine.summary()).length,
        espacesActifs: actifs,
        quizEnCours: enCours,
        podiumsAffiches: podiums,
      }
    })
    // Le plafond d'invités de chaque soirée, que même le réglage d'un espace
    // ne dépasse pas (`MAX_PLAYERS`) : le seul garde-fou contre la salle de
    // 300 qui fait céder le dixième de cœur. Il borne chaque espace, pas
    // leur somme.
    corps.maxPlayers = maxPlayersCeiling
    mesurer('mémoire', () => {
      const memoire = process.memoryUsage()
      return {
        rssMo: Math.round(memoire.rss / 1024 / 1024),
        memoire: { tasMo: Math.round(memoire.heapUsed / 1024 / 1024), connexions: io.engine.clientsCount },
      }
    })
    mesurer('charge', () => ({ charge: charge.lire() }))
    mesurer('pages', () => {
      const calculs = pouls.pagesCalculees.lire()
      return {
        pages: {
          calculs: pouls.calculsDePage,
          parMin: pouls.pagesServies.lire().n,
          calculsParMin: calculs.n,
          p95Ms: calculs.p95,
          maxMs: calculs.max,
          ...pages.etat(),
        },
      }
    })
    mesurer('inscriptions', () => ({ inscriptions: pouls.inscriptions() }))
    mesurer('réponses', () => ({ reponses: { tropTardParMin: pouls.tropTard.lire().n } }))
    mesurer('miroir', () => {
      const miroir = pouls.miroir.lire()
      return { miroir: { ...backup.sante(), latenceP95Ms: miroir.p95, latenceMaxMs: miroir.max, envoisParMin: miroir.n } }
    })
    mesurer('jour', () => ({ jour: reserveDuJour() }))
    // Ce que la routine du matin a déposé dans la base de la campagne : une
    // routine qui ne tourne plus se voit à sa date.
    mesurer('campagne', () => ({ campagne: campagne.santeDeLaBase() }))
    // La dernière tournée du rappel du soir : combien sont partis, combien
    // ont échoué — un service de push qui refuse tout se voit ici.
    mesurer('rappels', () => ({ rappels: rappels.bilan() }))
    mesurer('base', () => {
      const base = pouls.base.lireAvecMediane()
      return { base: { allersRetoursParMin: base.n, p50Ms: base.p50, p95Ms: base.p95, maxMs: base.max } }
    })
    mesurer('routes', () => ({ routes: pouls.lireRoutes() }))
    res.json(corps)
  })

  // ── Les pages publiques d'un espace : souvenir, bilan, historique ──
  //
  // Publiques, comme avant les comptes : ce sont des pages à partager aux
  // invités, pas des outils d'animation. L'espace est dans l'adresse ; un
  // nom inconnu vaut « introuvable », sans plus de détail.

  interface SpaceLocals {
    account: AccountRec
  }
  const withSpace = (req: Request, res: Response, next: NextFunction) => {
    const account = auth.bySlug(req.params.slug)
    if (!account) return res.status(404).json({ error: 'Soirée introuvable' })
    ;(res.locals as SpaceLocals).account = account
    next()
  }
  const spaceOf = (res: Response) => (res.locals as SpaceLocals).account

  app.get('/s/:slug/space.json', withSpace, (_req, res) => res.json(auth.publicSpace(spaceOf(res))))
  // Entre deux soirées, ces pages n'avaient plus rien à montrer : la clôture
  // efface la soirée en cours, et l'invité qui rouvrait le lendemain le
  // souvenir scanné au podium lisait « La soirée n'a pas encore commencé ».
  // Tant que la suivante n'a rien joué, elles désignent la dernière soirée
  // close (`derniere`), et la page la montre à sa place. Une base distante
  // muette ne prive que de ce lien : la soirée en cours, elle, se lit en
  // local, et s'affiche quand même.
  const avecLaDerniere = async <T extends object>(
    account: AccountRec,
    sorte: 'recap' | 'bilan',
    page: T,
    provisoire: () => void,
  ): Promise<T & { derniere?: DerniereSoiree }> => {
    const derniere = await registry.get(account.id).derniereClose().catch((e: unknown) => {
      console.error(`[soirees] la dernière soirée de « ${account.slug} » ne se lit pas :`, e)
      provisoire()
      return null
    })
    if (!derniere) return page
    // Sa page part avec : le téléphone la montre à la place de la soirée
    // vide, et la demandait aussitôt — un aller-retour de plus, à chaque
    // ouverture entre deux soirées. Gardée comme demandée seule
    // (`demandeArchivee`), et provisoire avec elle ; muette, la page de
    // l'espace part sans elle, et le téléphone la demande, comme avant.
    const archivee = await pages.lire(demandeArchivee(sorte, account, derniere.id), provisoire).catch((e: unknown) => {
      console.error(`[soirees] la dernière soirée de « ${account.slug} » ne se joint pas :`, e)
      provisoire()
      return null
    })
    return { ...page, derniere: archivee ? { ...derniere, page: archivee } : derniere }
  }

  // Le souvenir et le bilan se gardent, calculés une fois pour toute la
  // salle qui scanne le QR (`core/pages.ts`). Celles de la soirée en cours
  // se gardent tant que ses journaux ne bougent pas, une minute au plus ;
  // celles d'une soirée archivée, tant que l'historique de l'espace ne bouge
  // pas. Les réglages de l'espace sont dans l'empreinte : son nom, sa
  // couleur changent la page.
  const pages = new PagesPubliques()
  const reglagesDe = (account: AccountRec) => JSON.stringify(auth.publicSpace(account))
  const pageEnCours = (sorte: 'recap' | 'bilan') => (req: Request, res: Response) => {
    const account = spaceOf(res)
    const rt = registry.get(account.id)
    pages
      .servir(req, res, {
        place: `${account.id}|${sorte}`,
        empreinte: `${rt.empreinteDesPages()}|${reglagesDe(account)}`,
        dureeMs: 60_000,
        sorte: sorte === 'recap' ? 'souvenir en cours' : 'bilan en cours',
        calculer: provisoire =>
          avecLaDerniere(account, sorte, sorte === 'recap' ? rt.liveRecap() : rt.liveReview(), provisoire),
      })
      .catch((e: unknown) => repondreErreur(req, res, e))
  }
  app.get('/s/:slug/recap.json', withSpace, pageEnCours('recap'))
  app.get('/s/:slug/bilan.json', withSpace, pageEnCours('bilan'))

  // L'historique : la soirée en cours et les soirées archivées.
  //
  // Pages publiques : une panne n'y montre qu'une phrase neutre. Le message
  // d'une LibsqlError nomme les tables, celui de JSON.parse recopie le début
  // de la ligne abîmée — l'un et l'autre partent au journal, pas au visiteur.
  app.get('/s/:slug/soirees.json', withSpace, (req, res) => {
    const account = spaceOf(res)
    archives
      .list(account.id)
      .then(list => {
        const rt = registry.get(account.id)
        // La soirée en cours se range toute seule après chaque quiz : elle est
        // déjà dans la liste, mais elle se montre à part, « en cours », sous
        // le titre qu'elle y porte.
        const enCours = rt.soireeId()
        const rangee = list.find(a => a.id === enCours)
        const current = rt.currentSummary()
        const body: ArchiveList = {
          current: current && rangee ? { ...current, id: rangee.id, title: rangee.title } : current,
          archives: list.filter(a => a.id !== enCours),
          space: auth.publicSpace(account),
        }
        res.json(body)
      })
      .catch((e: unknown) => repondreErreur(req, res, e))
  })

  // La carte d'un invité de la soirée en cours : ce qu'on voit en touchant son
  // nom. Publique, comme le souvenir — et cloisonnée : l'invité d'un autre
  // espace vaut « introuvable ».
  app.get('/s/:slug/joueurs/:id.json', withSpace, (req, res) => {
    const account = spaceOf(res)
    registry
      .get(account.id)
      .carteDe(req.params.id)
      .then(carte => (carte ? res.json(carte) : res.status(404).json({ error: 'Joueur introuvable' })))
      .catch((e: unknown) => repondreErreur(req, res, e))
  })

  // Une archive ne garde que l'emoji de l'inscription : ce que les profils
  // portent — le légendaire, la finition, l'Éclat — se lit sur eux, chargés
  // d'un coup, par la règle de la salle (`badgeDe`). Le bilan montrait un
  // emoji à celui qui portait un légendaire. Un profil supprimé ou fermé
  // garde son emoji ; une base muette ne prive que de ça : la page part en
  // emojis, sans se garder.
  const apparencesDe = async (archive: PartyArchive, provisoire: () => void): Promise<BadgeLookup> => {
    const ids = [...new Set(archive.players.flatMap(p => (p.profileId ? [p.profileId] : [])))]
    const lus = await profiles.byIds(ids).catch((e: unknown) => {
      console.error('[soirees] les profils d’une soirée archivée ne se lisent pas :', e)
      provisoire()
      return []
    })
    const actifs = new Set(lus.flatMap(p => (p ? [p.id] : [])))
    return (profileId, avatar) => (actifs.has(profileId) ? profiles.badgeDe(profileId, avatar) : undefined)
  }

  // Une soirée archivée se relit avec les mêmes pages que celle en cours.
  // Chaque requête téléchargeait l'archive entière — 2 Mo pour 150 invités —
  // et la réanalysait : elle se garde désormais comme les autres pages, et
  // ne se relit que si l'historique de l'espace a bougé — ou au bout de dix
  // minutes, ce que les profils portent ayant pu changer.
  const PAGE_ARCHIVEE: Record<'recap' | 'bilan', (archive: PartyArchive, apparences: BadgeLookup) => object> = {
    recap: recapOfArchive,
    bilan: reviewOfArchive,
  }
  const demandeArchivee = (sorte: 'recap' | 'bilan', account: AccountRec, id: string): DemandeDePage => ({
    place: `${account.id}|${sorte}|${id}`,
    empreinte: `${archives.revision(account.id)}|${reglagesDe(account)}`,
    dureeMs: 10 * 60_000,
    sorte: sorte === 'recap' ? 'souvenir archivé' : 'bilan archivé',
    calculer: async provisoire => {
      const found = await archives.get(account.id, id)
      if (!found) return null
      const apparences = await apparencesDe(found.archive, provisoire)
      return { ...PAGE_ARCHIVEE[sorte](found.archive, apparences), archive: found.summary, space: auth.publicSpace(account) }
    },
  })
  const archived = (sorte: 'recap' | 'bilan') => (req: Request, res: Response) => {
    pages.servir(req, res, demandeArchivee(sorte, spaceOf(res), req.params.id)).catch((e: unknown) => repondreErreur(req, res, e))
  }
  app.get('/s/:slug/soirees/:id/recap.json', withSpace, archived('recap'))
  app.get('/s/:slug/soirees/:id/bilan.json', withSpace, archived('bilan'))

  // Les adresses d'avant les espaces — celles des liens déjà partagés et des
  // QR déjà imprimés — mènent à l'espace par défaut, celui de l'administrateur.
  const defaultSlug = () => auth.defaultAccount()?.slug ?? opts.admin.slug
  app.get(['/recap.json', '/bilan.json', '/soirees.json'], (req, res) => {
    res.redirect(302, `/s/${defaultSlug()}${req.path}`)
  })
  app.get(['/soirees/:id/recap.json', '/soirees/:id/bilan.json'], (req, res) => {
    res.redirect(302, `/s/${defaultSlug()}${req.path}`)
  })
  app.get(
    [
      ...PUBLIC_PAGES.map(p => `/${p}`),
      '/soirees',
      '/soirees/:id',
      ...PUBLIC_PAGES.map(p => `/soirees/:id/${p}`),
    ],
    (req, res) => {
      res.redirect(302, `/${defaultSlug()}${req.path}`)
    },
  )

  mountApi(app, {
    store,
    archives,
    auth,
    profiles,
    jour,
    rappels,
    campagne,
    maintenant: maintenantDuJour,
    jetonDeLaReserve: opts.jetonDeLaReserve ?? null,
    online: !!opts.online,
    publicOrigin: allowedOrigin,
    onLibraryChanged: refreshLibrary,
    programmes,
    onProgrammeChanged: refreshProgramme,
    partages,
    // Les parties de l'espace encore sur le disque, terminées comprises :
    // c'est leur copie du quiz que l'archivage rangera, photos avec.
    photosEnJeu: spaceId =>
      (db.prepare('SELECT state FROM sessions WHERE space_id = ?').all(spaceId) as { state: string }[]).flatMap(r =>
        photosCitees(r.state),
      ),
    removeAccount,
    soireeEnCours: spaceId => registry.get(spaceId).soireeId(),
    ouvrirSalon: (spaceId, opts) => registry.get(spaceId).ouvrirSalon(opts),
    // La base locale est le registre de la soirée en cours : la clôture et
    // l'essai effacé la vident, un invité exclu en sort. Mais une soirée
    // qu'on n'a pas close reste là jusqu'à la suivante : sans son dernier
    // signe de vie (une arrivée, un quiz qui avance) de moins de douze
    // heures, « Revenir chez Nadia » renvoyait le lendemain vers une salle vide.
    // Toute soirée pas encore close, active ou laissée en plan : sa clôture
    // créditerait ce profil — d'où le refus de le supprimer avant.
    soireesPasCloses: profileId =>
      (db.prepare('SELECT DISTINCT space_id FROM players WHERE profile_id = ? AND space_id IS NOT NULL').all(profileId) as { space_id: string }[]).map(
        r => r.space_id,
      ),
    supprimerProfil,
    soireesOuJeJoue: profileId =>
      (
        db
          .prepare(
            `SELECT DISTINCT p.space_id FROM players p
             WHERE p.profile_id = ? AND p.space_id IS NOT NULL
               AND MAX(
                 (SELECT COALESCE(MAX(created_at), 0) FROM players WHERE space_id = p.space_id),
                 (SELECT COALESCE(MAX(updated_at), 0) FROM sessions WHERE space_id = p.space_id)
               ) > ?`,
          )
          .all(profileId, Date.now() - SOIREE_ACTIVE_MS) as { space_id: string }[]
      ).map(r => r.space_id),
    // Une soirée endormie n'a personne à prévenir : elle lira les réglages
    // au réveil.
    espaceChange: spaceId => registry.peek(spaceId)?.broadcastSnapshot(),
    profilChange: profileId => {
      for (const rt of registry.all()) if (rt.party.findByProfile(profileId)) rt.broadcastSnapshot()
    },
  })

  // Photos livrées avec le dépôt (les photos ajoutées depuis l'éditeur, elles,
  // vivent en base et sont servies par /media/image/:id).
  const quizMedia = path.resolve(SERVEUR, 'content/quiz/images')
  if (fs.existsSync(quizMedia)) app.use('/media/quiz', express.static(quizMedia))

  // Une adresse d'API, de photo ou de données inconnue est une erreur, pas la
  // page d'accueil : un client qui reçoit du HTML là où il attend du JSON ne
  // comprend rien à ce qui lui arrive.
  app.use(['/api', '/media', '/s'], (_req, res) => res.status(404).json({ error: 'Introuvable' }))

  app.get('/robots.txt', (_req, res) => res.type('text').send(ROBOTS_TXT))

  // En prod, le serveur sert aussi le client compilé (un seul process à héberger).
  const clientDist = opts.clientDist ?? path.resolve(SERVEUR, '../client/dist')
  if (fs.existsSync(clientDist)) {
    // Les fichiers compilés portent une empreinte dans leur nom : un an de
    // cache, sans jamais revalider. La page d'accueil, elle, doit toujours
    // être redemandée — c'est elle qui pointe vers la bonne empreinte.
    app.use('/assets', servirPrecompresse(path.join(clientDist, 'assets'), { maxAge: '1y', immutable: true }))
    app.use(
      '/assets',
      express.static(path.join(clientDist, 'assets'), { maxAge: '1y', immutable: true, fallthrough: false }),
    )
    // Les polices ne portent pas d'empreinte, mais elles ne changent pour
    // ainsi dire jamais : un mois de cache, et cinquante téléphones ne les
    // redemandent pas à chaque ouverture.
    app.use('/fonts', express.static(path.join(clientDist, 'fonts'), { maxAge: '30d', fallthrough: false }))
    // Les portraits peints des branches portent leur empreinte dans leur nom
    // (`server/scripts/anime/livrer.ts`) : un an, comme le paquet. Une salle
    // où vingt invités portent le même en fait une seule requête chacun, une
    // fois pour toutes.
    app.use('/portraits', express.static(path.join(clientDist, 'portraits'), { maxAge: '1y', immutable: true, fallthrough: false }))
    // Les légendaires et les Divins peints de même (`server/scripts/anime/legendaires.ts`).
    app.use('/medaillons', express.static(path.join(clientDist, 'medaillons'), { maxAge: '1y', immutable: true, fallthrough: false }))
    // Les décors peints — le calendrier, les thèmes peints, les fonds de carte — de même (`server/scripts/anime/decors.ts`).
    app.use('/decors', express.static(path.join(clientDist, 'decors'), { maxAge: '1y', immutable: true, fallthrough: false }))
    // La page d'accueil est lue une fois et gardée en mémoire — elle ne change
    // pas d'un déploiement à l'autre. Hors production, on y glisse le nom de
    // l'environnement : c'est le seul endroit qui atteint TOUTES les pages,
    // y compris l'éditeur de quiz, où se tromper de base coûte le plus cher.
    // Le dossier peut exister sans la page — un build interrompu, un
    // `dist/` à moitié nettoyé. Lire sans vérifier ferait échouer le
    // DÉMARRAGE du serveur, là où l'ancien `sendFile` se contentait d'une
    // erreur par requête. Un serveur qui ne démarre pas est bien pire.
    const indexPath = path.join(clientDist, 'index.html')
    let indexHtml = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : ''
    if (opts.appEnv && indexHtml) {
      const meta = `<meta name="app-env" content="${opts.appEnv.replace(/[^\w.-]/g, '')}">`
      indexHtml = indexHtml.replace('</head>', `  ${meta}\n  </head>`)
    }
    /**
     * Les codes manqués, par adresse : vingt d'affilée, puis deux par minute.
     * Une tablée qui se trompe d'un chiffre ne s'en aperçoit pas ; un script
     * qui énumère le million de codes y mettrait un an. Un code juste ne
     * coûte rien, mais ne se cherche plus une fois la réserve épuisée.
     */
    const codesManques = new Budget(20, 2)
    // Chaque adresse porte son statut et ses balises : un aperçu de lien
    // n'exécute pas le client. Voir `core/apercus.ts`.
    const servirPage = (chemin: string, req: Request, res: Response, next: NextFunction) => {
      res.set('Cache-Control', 'no-cache')
      if (!indexHtml) return res.status(404).type('text').send('Client non compilé (npm run build)')
      const ip = clientIp(req)
      const decision = decrirePage(
        chemin,
        slug => {
          const compte = auth.bySlug(slug)
          return compte && compte.slug === slug ? auth.publicSpace(compte) : undefined
        },
        code => {
          if (!codesManques.peut(ip)) return null
          const compte = salons.espaceDuCode(code)
          const espace = compte ? auth.byId(compte) : undefined
          if (espace && !espace.disabledAt) return auth.publicSpace(espace)
          codesManques.take(ip)
          return undefined
        },
      )
      const requete = req.url.slice(req.path.length)
      if ('redirection' in decision) return res.redirect(302, decision.redirection + requete)
      const envoyer = (page: typeof decision) => {
        if (!page.indexable) res.set('X-Robots-Tag', 'noindex, nofollow')
        const base = opts.publicUrl ? opts.publicUrl.replace(/\/+$/, '') : `${req.protocol}://${req.get('host')}`
        let html = habillerPage(indexHtml, page, base, chemin)
        // Le téléphone d'un invité reçoit aussi l'en-tête de son entrée
        // (`core/page.ts`) : l'attente l'écrit avant que le script n'arrive.
        const entree = page.statut === 200 ? espaceDeLEntree(chemin) : null
        const compte = entree ? auth.bySlug(entree) : undefined
        const espace = compte && compte.slug === entree ? auth.publicSpace(compte) : undefined
        if (espace) html = pageDEntree(html, espace)
        // Ce que la page demandera dès son code arrivé part avec son script
        // (`shared/depart.ts`), et son attente est déjà écrite.
        if (page.statut === 200) html = prechargerDonnees(html, donneesDeDepart(parseRoute(chemin)))
        res.status(page.statut).type('html').send(ecrireAttente(html, espace))
      }
      if (!decision.archive) return envoyer(decision)
      // Une soirée archivée se cherche dans la base permanente. Muette, elle
      // ne fait pas déclarer introuvable une soirée qui existe : la page
      // s'ouvre, et dira elle-même ce qu'elle peut lire.
      const compte = auth.bySlug(decision.archive.spaceSlug)
      if (!compte) return envoyer(INTROUVABLE)
      // Muette, elle ne répond qu'au bout de dix secondes (`distante.ts`) :
      // autant de page blanche avant le moindre octet. Passé ce délai, la
      // page part comme sur une panne.
      let delai: NodeJS.Timeout | undefined
      const muette = new Promise<'muette'>(r => {
        delai = setTimeout(() => r('muette'), DELAI_VERIFICATION_ARCHIVE_MS)
      })
      Promise.race([archives.existe(compte.id, decision.archive.id), muette])
        .then(existe => envoyer(existe === false ? INTROUVABLE : decision))
        .catch((e: unknown) => {
          console.error('[pages] une soirée archivée ne se vérifie pas :', e)
          envoyer(decision)
        })
        .finally(() => clearTimeout(delai))
        .catch(next)
    }
    // `/index.html` demandé tel quel partait du disque, sans le bandeau de la
    // préproduction : il passe par la même page que l'accueil.
    app.get('/index.html', (req, res, next) => servirPage('/', req, res, next))
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }))
    // Un fichier absent (une icône, `favicon.ico` d'une vieille version)
    // est un 404, pas la page d'accueil. Seulement les extensions que l'on
    // sert : « /chez.nadia », dicté au téléphone, n'est pas un fichier — il
    // ouvre l'application, qui y lit `chez-nadia`.
    app.get(/\.(?:ico|png|jpe?g|gif|svg|webp|js|mjs|css|map|json|webmanifest|txt|xml|woff2?)$/i, (_req, res) =>
      res.status(404).type('text').send('Introuvable'),
    )
    app.get('*', (req, res, next) => servirPage(req.path, req, res, next))
  }

  // En tout dernier : ce qu'aucune route n'a su lire répond en JSON, sans pile.
  app.use(erreurDeRequete)

  await new Promise<void>(resolve => httpServer.listen(opts.port, resolve))
  const address = httpServer.address()
  const port = typeof address === 'object' && address ? address.port : opts.port
  boundPort = port
  // Sur l'hébergeur, le seul endroit où lire ce que vaut vraiment
  // `MAX_PLAYERS` : c'est son tableau de bord qui fait foi, pas render.yaml.
  console.log(
    `[serveur] prêt en ${Date.now() - debutDuDemarrage} ms — au plus ${maxPlayersCeiling} invités par soirée` +
      (opts.maxPlayers ? '' : ' (MAX_PLAYERS non défini : le plafond du code)') +
      (opts.version ? ` — version ${opts.version}` : ''),
  )
  // La base de la campagne, en fond et par tranches qui rendent la main
  // (`lireLaBaseSansBloquer`) : personne ne l'attend plus à sa première série.
  const prechauffage = setTimeout(() => campagne.prechauffer(), opts.prechauffageCampagneMs ?? PRECHAUFFAGE_CAMPAGNE_MS)
  prechauffage.unref()
  // Le rappel du soir regarde l'heure, chaque minute.
  rappels.demarrer()

  return {
    httpServer,
    io,
    port,
    close: () =>
      new Promise<void>(resolve => {
        clearInterval(resync)
        clearTimeout(prechauffage)
        // Plus un rappel ne part : la tournée en route s'arrête au téléphone suivant.
        rappels.arreter()
        charge.arreter()
        registry.stopAll()
        io.close(async () => {
          // La file du miroir se vide d'abord, dans le délai qu'on lui laisse :
          // la base locale doit rester ouverte d'ici là — une resynchronisation
          // en attente la relit.
          await backup.close()
          db.close()
          store.close()
          programmes.close()
          partages.close()
          salons.close()
          campagne.close()
          archives.close()
          auth.close()
          jour.close()
          rappels.close()
          // Les profils en dernier : un crédit d'expérience parti avec la fin
          // du dernier quiz garde ainsi le plus long sursis pour aboutir. On ne
          // les refermait jamais.
          profiles.close()
          resolve()
        })
      }),
  }
}
