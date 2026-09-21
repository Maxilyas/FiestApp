import express, { type NextFunction, type Request, type Response } from 'express'
import compression from 'compression'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDb, stampLegacySpace } from './core/db'
import { PartyBackup } from './core/backup'
import { QuizStore } from './core/quizStore'
import { seedLibrary } from './core/seed'
import { setQuizLibrary } from './games/quiz'
import { ArchiveStore, recapOfArchive, reviewOfArchive } from './core/archive'
import { SpaceRegistry } from './core/space'
import { AuthStore, type AccountRec } from './auth/store'
import { mountApi } from './api'
import { wireSockets } from './sockets'
import type { IoServer } from './core/types'
import type { ArchiveList, PartyArchive } from '../../shared/archive'
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
 * que React pose sur les barres et les podiums.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' ws: wss:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
}

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
  app.use((_req, res, next) => {
    res.set(SECURITY_HEADERS)
    next()
  })

  // Le temps réel n'accepte que les pages servies par l'application. Les
  // scripts de test et de charge n'envoient pas d'origine : ils passent. Chez
  // soi, sans URL publique, tout passe — l'écran commun peut être ouvert en
  // `localhost` pendant que les téléphones utilisent l'adresse du wifi.
  const allowedOrigin = opts.online ? originOf(opts.publicUrl) : null
  const io: IoServer = new Server(httpServer, {
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
  const defaultSpace = await auth.ensureDefaultSpace(opts.admin)
  if (!hadAccounts) console.log(`[comptes] administrateur « ${opts.admin.login} » créé, espace « ${opts.admin.slug} »`)

  // Le disque d'un hébergeur gratuit est effacé à chaque redémarrage : les
  // soirées (invités, points, parties en cours) sont donc recopiées dans la
  // base distante, et rechargées ici si la base locale est repartie vide.
  const backup = new PartyBackup(opts.quizDbUrl, opts.quizDbToken)
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

  wireSockets(io, { registry, auth, trustProxy: !!opts.online })

  // Filet de sécurité : un client qui aurait silencieusement raté une diffusion
  // se répare tout seul. Toutes les cinq minutes suffisent — une reconnexion
  // reçoit de toute façon un classement frais, et le dédoublonnage rendait
  // l'ancien rythme de 30 secondes aussi inutile que coûteux.
  const resync = setInterval(() => {
    for (const runtime of registry.all()) runtime.sendSnapshot(true)
  }, 300_000)

  // Point de santé : sert au service de réveil (l'hébergeur gratuit endort
  // l'application sans trafic) et aux mesures de charge. Rien par espace.
  app.get('/healthz', (_req, res) => {
    const runtimes = registry.all()
    res.json({
      ok: true,
      uptime: Math.round(process.uptime()),
      spaces: runtimes.length,
      players: runtimes.reduce((n, rt) => n + rt.party.connectedPlayerIds().length, 0),
      quizzes: runtimes.filter(rt => rt.engine.summary()).length,
      rssMo: Math.round(process.memoryUsage().rss / 1024 / 1024),
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
  app.get('/s/:slug/recap.json', withSpace, (_req, res) => res.json(registry.get(spaceOf(res).id).liveRecap()))
  app.get('/s/:slug/bilan.json', withSpace, (_req, res) => res.json(registry.get(spaceOf(res).id).liveReview()))

  // L'historique : la soirée en cours et les soirées archivées.
  app.get('/s/:slug/soirees.json', withSpace, (_req, res) => {
    const account = spaceOf(res)
    archives
      .list(account.id)
      .then(list => {
        const body: ArchiveList = {
          current: registry.get(account.id).currentSummary(),
          archives: list,
          space: auth.publicSpace(account),
        }
        res.json(body)
      })
      .catch((e: Error) => res.status(500).json({ error: e.message }))
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
      .catch((e: Error) => res.status(500).json({ error: e.message }))
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
    online: !!opts.online,
    publicOrigin: allowedOrigin,
    onLibraryChanged: refreshLibrary,
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
    app.get('*', (_req, res) => {
      res.set('Cache-Control', 'no-cache')
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }

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
          db.close()
          store.close()
          archives.close()
          auth.close()
          // Les écritures distantes en vol doivent aboutir avant de couper.
          await backup.close()
          resolve()
        })
      }),
  }
}
