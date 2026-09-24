import express, { type NextFunction, type Request, type Response } from 'express'
import compression from 'compression'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDb, stampLegacySpace, wipeSpace } from './core/db'
import { PartyBackup, type ReglagesMiroir } from './core/backup'
import { photosCitees, QuizStore } from './core/quizStore'
import { seedLibrary } from './core/seed'
import { clearQuizLibrary, setQuizLibrary } from './games/quiz'
import { ArchiveStore, recapOfArchive, reviewOfArchive } from './core/archive'
import { recalculerHistorique } from './core/recalcul'
import { SpaceRegistry } from './core/space'
import { AuthStore, type AccountRec } from './auth/store'
import { ProfileStore } from './auth/profiles'
import { mountApi } from './api'
import { erreurDeRequete, repondreErreur } from './core/http'
import { wireSockets } from './sockets'
import type { IoServer } from './core/types'
import type { ArchiveList, DerniereSoiree, PartyArchive } from '../../shared/archive'
import { MAX_PLAYERS_CEILING } from '../../shared/space'

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
}

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

export async function createQuizServer(opts: QuizServerOptions) {
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
  // Le JS de l'application pèse 320 Ko à nu, 100 Ko compressé — cinquante
  // téléphones en 4G au moment du scan font vite la différence.
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

  // Les profils des joueurs récurrents. Ils vivent dans la base permanente,
  // avec les comptes : un profil traverse les soirées et les animateurs, et la
  // base locale, elle, est vidée à chaque « Nouvelle soirée ».
  const profiles = new ProfileStore(opts.quizDbUrl, opts.quizDbToken)
  await profiles.init()

  // Bibliothèque de quiz : le stockage permanent, séparé de la base jetable.
  const store = new QuizStore(opts.quizDbUrl, opts.quizDbToken)
  await store.init(defaultSpace)
  const imported = await seedLibrary(store, defaultSpace)
  if (imported > 0) console.log(`[quiz] ${imported} quiz importés depuis server/content/quiz/`)
  /** Recharge la bibliothèque d'un espace — ou toutes, au démarrage. */
  const refreshLibrary = async (spaceId?: string) => {
    if (spaceId) return setQuizLibrary(spaceId, await store.all(spaceId))
    for (const [id, quizzes] of await store.allBySpace()) setQuizLibrary(id, quizzes)
  }
  await refreshLibrary()

  // L'historique des soirées vit avec la bibliothèque : c'est l'autre chose
  // qui doit survivre à tout.
  const archives = new ArchiveStore(opts.quizDbUrl, opts.quizDbToken)
  await archives.init(defaultSpace)

  // L'expérience se relit avec le barème du jour : une fois, au premier
  // démarrage qui le change. Les soirées en cours — celles que le disque ou
  // le miroir viennent de rendre — n'ont pas fini de se jouer : elles se
  // recréditeront à leur prochain quiz.
  const enCours = new Set((db.prepare('SELECT id FROM soiree').all() as { id: string }[]).map(r => r.id))
  const recalcul = await recalculerHistorique({ profiles, archives, enCours })
  if (recalcul) {
    console.log(
      `[profils] expérience recalculée au barème du jour : ${recalcul.soirees} soirées relues, ` +
        `${recalcul.lignes} lignes revalorisées, ${recalcul.profils} profils`,
    )
  }

  let boundPort = opts.port
  const wifi = process.env.WIFI_SSID
    ? { ssid: process.env.WIFI_SSID, pass: process.env.WIFI_PASS ?? '' }
    : null

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
    maxPlayersCeiling: opts.maxPlayers ?? MAX_PLAYERS_CEILING,
  })
  const woken = registry.wakeRunning()
  if (woken > 0) console.log(`[espaces] ${woken} partie${woken > 1 ? 's' : ''} en cours reprise${woken > 1 ? 's' : ''}`)

  wireSockets(io, { registry, auth, profiles, trustProxy: !!opts.online })

  /**
   * Supprime un compte et tout ce qu'il a laissé. L'ordre compte : d'abord
   * ce qui vit (sessions, connexions, soirée en mémoire), puis le disque
   * local, le miroir distant, l'historique et la bibliothèque, et le compte
   * en tout dernier — si une écriture distante échoue en route, il reste un
   * compte désactivé sur lequel réessayer, pas des données sans maître.
   */
  const removeAccount = async (accountId: string) => {
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
    const soirees = await archives.removeSpace(accountId)
    const { quizzes, images } = await store.removeSpace(accountId)
    await auth.remove(accountId)
    // Une page publique lue pendant le ménage a pu réveiller la soirée.
    registry.drop(accountId)
    console.log(
      `[comptes] compte « ${login} » supprimé : ${quizzes} quiz, ${images} photos, ${soirees} soirées archivées`,
    )
  }

  // Filet de sécurité : un client qui aurait silencieusement raté une diffusion
  // se répare tout seul. Toutes les cinq minutes suffisent — une reconnexion
  // reçoit de toute façon un classement frais, et le dédoublonnage rendait
  // l'ancien rythme de 30 secondes aussi inutile que coûteux.
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
  app.get('/healthz', (_req, res) => {
    const runtimes = registry.all()
    res.json({
      ok: true,
      env: opts.appEnv ?? 'production',
      uptime: Math.round(process.uptime()),
      spaces: runtimes.length,
      players: runtimes.reduce((n, rt) => n + rt.party.connectedPlayerIds().length, 0),
      quizzes: runtimes.filter(rt => rt.engine.summary()).length,
      rssMo: Math.round(process.memoryUsage().rss / 1024 / 1024),
      miroir: backup.sante(),
    })
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
  const avecLaDerniere = async <T extends object>(account: AccountRec, page: T): Promise<T & { derniere?: DerniereSoiree }> => {
    const rt = registry.get(account.id)
    if (rt.aJoue()) return page
    const derniere = await archives.derniere(account.id, rt.soireeId()).catch((e: unknown) => {
      console.error(`[soirees] la dernière soirée de « ${account.slug} » ne se lit pas :`, e)
      return null
    })
    return derniere ? { ...page, derniere } : page
  }
  app.get('/s/:slug/recap.json', withSpace, (req, res) => {
    const account = spaceOf(res)
    avecLaDerniere(account, registry.get(account.id).liveRecap())
      .then(page => res.json(page))
      .catch((e: unknown) => repondreErreur(req, res, e))
  })
  app.get('/s/:slug/bilan.json', withSpace, (req, res) => {
    const account = spaceOf(res)
    avecLaDerniere(account, registry.get(account.id).liveReview())
      .then(page => res.json(page))
      .catch((e: unknown) => repondreErreur(req, res, e))
  })

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

  // Une soirée archivée se relit avec les mêmes pages que celle en cours.
  const archived = (build: (archive: PartyArchive) => object) => (req: Request, res: Response) => {
    const account = spaceOf(res)
    archives
      .get(account.id, req.params.id)
      .then(found => {
        if (!found) return res.status(404).json({ error: 'Soirée introuvable' })
        res.json({ ...build(found.archive), archive: found.summary, space: auth.publicSpace(account) })
      })
      .catch((e: unknown) => repondreErreur(req, res, e))
  }
  app.get('/s/:slug/soirees/:id/recap.json', withSpace, archived(recapOfArchive))
  app.get('/s/:slug/soirees/:id/bilan.json', withSpace, archived(reviewOfArchive))

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
    online: !!opts.online,
    publicOrigin: allowedOrigin,
    onLibraryChanged: refreshLibrary,
    // Les parties de l'espace encore sur le disque, terminées comprises :
    // c'est leur copie du quiz que l'archivage rangera, photos avec.
    photosEnJeu: spaceId =>
      (db.prepare('SELECT state FROM sessions WHERE space_id = ?').all(spaceId) as { state: string }[]).flatMap(r =>
        photosCitees(r.state),
      ),
    removeAccount,
    soireeEnCours: spaceId => registry.get(spaceId).soireeId(),
    // La base locale est le registre de la soirée en cours : la clôture et
    // l'essai effacé la vident, un invité exclu en sort. Mais une soirée
    // qu'on n'a pas close reste là jusqu'à la suivante : sans son dernier
    // signe de vie (une arrivée, un quiz qui avance) de moins de douze
    // heures, « Revenir chez Nadia » renvoyait le lendemain vers une salle vide.
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
  })

  const here = path.dirname(fileURLToPath(import.meta.url))

  // Photos livrées avec le dépôt (les photos ajoutées depuis l'éditeur, elles,
  // vivent en base et sont servies par /media/image/:id).
  const quizMedia = path.resolve(here, '../content/quiz/images')
  if (fs.existsSync(quizMedia)) app.use('/media/quiz', express.static(quizMedia))

  // Une adresse d'API, de photo ou de données inconnue est une erreur, pas la
  // page d'accueil : un client qui reçoit du HTML là où il attend du JSON ne
  // comprend rien à ce qui lui arrive.
  app.use(['/api', '/media', '/s'], (_req, res) => res.status(404).json({ error: 'Introuvable' }))

  // En prod, le serveur sert aussi le client compilé (un seul process à héberger).
  const clientDist = path.resolve(here, '../../client/dist')
  if (fs.existsSync(clientDist)) {
    // Les fichiers compilés portent une empreinte dans leur nom : un an de
    // cache, sans jamais revalider. La page d'accueil, elle, doit toujours
    // être redemandée — c'est elle qui pointe vers la bonne empreinte.
    app.use(
      '/assets',
      express.static(path.join(clientDist, 'assets'), { maxAge: '1y', immutable: true, fallthrough: false }),
    )
    // Les polices ne portent pas d'empreinte, mais elles ne changent pour
    // ainsi dire jamais : un mois de cache, et cinquante téléphones ne les
    // redemandent pas à chaque ouverture.
    app.use('/fonts', express.static(path.join(clientDist, 'fonts'), { maxAge: '30d', fallthrough: false }))
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }))

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
    app.get('*', (_req, res) => {
      res.set('Cache-Control', 'no-cache')
      if (!indexHtml) return res.status(404).type('text').send('Client non compilé (npm run build)')
      res.type('html').send(indexHtml)
    })
  }

  // En tout dernier : ce qu'aucune route n'a su lire répond en JSON, sans pile.
  app.use(erreurDeRequete)

  await new Promise<void>(resolve => httpServer.listen(opts.port, resolve))
  const address = httpServer.address()
  const port = typeof address === 'object' && address ? address.port : opts.port
  boundPort = port

  return {
    httpServer,
    io,
    port,
    close: () =>
      new Promise<void>(resolve => {
        clearInterval(resync)
        registry.stopAll()
        io.close(async () => {
          // La file du miroir se vide d'abord, dans le délai qu'on lui laisse :
          // la base locale doit rester ouverte d'ici là — une resynchronisation
          // en attente la relit.
          await backup.close()
          db.close()
          store.close()
          archives.close()
          auth.close()
          // Les profils en dernier : un crédit d'expérience parti avec la fin
          // du dernier quiz garde ainsi le plus long sursis pour aboutir. On ne
          // les refermait jamais.
          profiles.close()
          resolve()
        })
      }),
  }
}
