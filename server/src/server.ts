import express from 'express'
import compression from 'compression'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDb } from './core/db'
import { Party } from './core/party'
import { Teams } from './core/teams'
import { ScoreLedger } from './core/scores'
import { AnswerLog } from './core/answers'
import { computeStats } from './core/stats'
import { GameEngine } from './core/engine'
import { PartyBackup } from './core/backup'
import { QuizStore } from './core/quizStore'
import { seedLibrary } from './core/seed'
import { quizModule, setQuizLibrary } from './games/quiz'
import { mountApi } from './api'
import { wireSockets } from './sockets'
import type { IoServer } from './core/types'
import type { PartySnapshot } from '../../shared/types'
import { teamScores } from '../../shared/teams'

export interface QuizServerOptions {
  port: number
  /** Base locale jetable : joueurs et état de la partie en cours. */
  dbPath: string
  hostKey: string
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
  /** Inscriptions au-delà desquelles la soirée est déclarée complète. */
  maxPlayers?: number
}

/** Cinquante invités attendus : trois fois plus, c'est déjà un robot. */
const DEFAULT_MAX_PLAYERS = 150

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
 * aucun script tiers, aucune police téléchargée, les photos sont servies ici.
 * Les styles en ligne sont ceux que React pose sur les barres et les podiums.
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

  // Le disque d'un hébergeur gratuit est effacé à chaque redémarrage : la
  // soirée (invités, points, partie en cours) est donc recopiée dans la base
  // distante, et rechargée ici si la base locale est repartie vide.
  const backup = new PartyBackup(opts.quizDbUrl, opts.quizDbToken)
  await backup.init()
  const restored = await backup.restoreInto(db)
  if (restored.players > 0 || restored.teams > 0) {
    console.log(
      `[soirée] ${restored.players} invités, ${restored.teams} équipes, ${restored.scores} gains, ${restored.answers} réponses` +
        (restored.sessions > 0 ? ' et la partie en cours' : '') +
        ' rechargés après redémarrage',
    )
  }

  const party = new Party(db, backup)
  const teams = new Teams(db, backup)
  const ledger = new ScoreLedger(db, backup)
  const answers = new AnswerLog(db, backup)

  // Bibliothèque de quiz : le stockage permanent, séparé de la base jetable.
  const store = new QuizStore(opts.quizDbUrl, opts.quizDbToken)
  await store.init()
  const imported = await seedLibrary(store)
  if (imported > 0) console.log(`[quiz] ${imported} quiz importés depuis server/content/quiz/`)
  const refreshLibrary = async () => setQuizLibrary(await store.all())
  await refreshLibrary()

  let boundPort = opts.port
  const wifi = process.env.WIFI_SSID
    ? { ssid: process.env.WIFI_SSID, pass: process.env.WIFI_PASS ?? '' }
    : null
  /**
   * L'état de la soirée. Le wifi n'est envoyé qu'à l'écran commun : c'est lui
   * qui l'affiche en QR, les téléphones n'ont pas à recevoir le mot de passe.
   */
  const buildSnapshot = (forHost: boolean): PartySnapshot => {
    const ip = lanAddress()
    const players = party.publicPlayers(ledger.allTotals())
    const bonuses = teams.allBonuses()
    return {
      players,
      teams: teamScores(teams.all(), players, bonuses),
      bonuses,
      session: engine.summary(),
      joinUrl: opts.publicUrl ?? (ip ? `http://${ip}:${boundPort}` : null),
      wifi: forHost ? wifi : null,
    }
  }
  // Diffusion du classement : deux garde-fous mesurés sur une soirée simulée.
  //
  // · Regroupement — à l'arrivée des invités, cinquante inscriptions en
  //   quelques secondes déclenchaient cinquante diffusions complètes à tout
  //   le monde. On n'en envoie qu'une par fenêtre courte.
  // · Dédoublonnage — un classement identique au précédent ne part pas. Sans
  //   ça, le filet de sécurité périodique renvoyait 4 Ko à chaque téléphone
  //   toutes les 30 secondes pendant toute la fête, pour rien.
  let lastSnapshot = ''
  let pending: ReturnType<typeof setTimeout> | null = null

  const sendSnapshot = (force = false) => {
    const snapshot = buildSnapshot(false)
    const json = JSON.stringify(snapshot)
    if (!force && json === lastSnapshot) return
    lastSnapshot = json
    io.except('hosts').emit('party:snapshot', snapshot)
    io.to('hosts').emit('party:snapshot', wifi ? { ...snapshot, wifi } : snapshot)
  }

  const broadcastSnapshot = () => {
    if (pending) return
    pending = setTimeout(() => {
      pending = null
      sendSnapshot()
    }, 120)
  }

  const engine = new GameEngine(
    {
      db,
      io,
      party,
      ledger,
      answers,
      backup,
      onScoresChanged: broadcastSnapshot,
      onSessionChanged: broadcastSnapshot,
    },
    quizModule,
  )
  engine.restore()

  /** Repart d'une soirée vierge — les essais d'avant la fête ne doivent pas y traîner. */
  const resetParty = async () => {
    const running = engine.activeSessionId
    if (running) engine.endSession(running)
    party.clearAll()
    teams.clearAll()
    ledger.clearAll()
    answers.clearAll()
    await backup.reset()
    broadcastSnapshot()
  }

  wireSockets(io, {
    party,
    teams,
    answers,
    engine,
    hostKey: opts.hostKey,
    trustProxy: !!opts.online,
    maxPlayers: opts.maxPlayers ?? DEFAULT_MAX_PLAYERS,
    buildSnapshot,
    broadcastSnapshot,
    resetParty,
  })

  // Filet de sécurité : un client qui aurait silencieusement raté une diffusion
  // se répare tout seul. Toutes les cinq minutes suffisent — une reconnexion
  // reçoit de toute façon un classement frais, et le dédoublonnage rendait
  // l'ancien rythme de 30 secondes aussi inutile que coûteux.
  const resync = setInterval(() => sendSnapshot(true), 300_000)

  // Point de santé : sert au service de réveil (l'hébergeur gratuit endort
  // l'application sans trafic) et aux mesures de charge.
  app.get('/healthz', (_req, res) => {
    res.json({
      ok: true,
      uptime: Math.round(process.uptime()),
      players: party.connectedPlayerIds().length,
      quizzes: engine.summary() ? 1 : 0,
      rssMo: Math.round(process.memoryUsage().rss / 1024 / 1024),
    })
  })

  // Page souvenir : volontairement publique, pour que les invités puissent la
  // regarder le lendemain sans clé d'animateur.
  app.get('/recap.json', (_req, res) => {
    const totals = ledger.allTotals()
    const players = party.publicPlayers(totals)
    const byId = new Map(players.map(p => [p.id, p]))
    const row = (id: string) => byId.get(id)

    const best = db
      .prepare('SELECT player_id, points, reason FROM score_entries WHERE points > 0 ORDER BY points DESC LIMIT 1')
      .get() as { player_id: string; points: number; reason: string } | undefined
    const steady = db
      .prepare('SELECT player_id, COUNT(*) AS n FROM score_entries WHERE points > 0 GROUP BY player_id ORDER BY n DESC LIMIT 1')
      .get() as { player_id: string; n: number } | undefined
    const quizzes = db
      .prepare('SELECT COUNT(DISTINCT session_id) AS n FROM score_entries WHERE session_id IS NOT NULL')
      .get() as { n: number }
    const distributed = db.prepare('SELECT COALESCE(SUM(points), 0) AS n FROM score_entries').get() as { n: number }

    const bestPlayer = best ? row(best.player_id) : undefined
    const steadyPlayer = steady ? row(steady.player_id) : undefined

    // Un vainqueur par quiz : autant de prix à remettre, et chacun garde une
    // chance même si le classement général lui échappe. Une requête par quiz
    // plutôt qu'une seule très habile — il y en a une poignée dans la soirée,
    // et le résultat se relit sans effort.
    const sessions = db
      .prepare(
        `SELECT session_id, MIN(created_at) AS started
         FROM score_entries WHERE session_id IS NOT NULL
         GROUP BY session_id ORDER BY started ASC`,
      )
      .all() as { session_id: string }[]

    const topOfSession = db.prepare(
      `SELECT player_id, SUM(points) AS total FROM score_entries
       WHERE session_id = ? GROUP BY player_id ORDER BY total DESC LIMIT 1`,
    )
    // Le titre est repris du libellé écrit par le module de jeu, qui a la
    // forme « Quiz « … » — Q3 ». Les lignes d'annulation ne l'ont pas.
    const titleOfSession = db.prepare(
      `SELECT reason FROM score_entries WHERE session_id = ? AND reason LIKE 'Quiz %' LIMIT 1`,
    )

    const quizWinners: { title: string; name: string; avatar: string; points: number }[] = []
    for (const { session_id } of sessions) {
      const top = topOfSession.get(session_id) as { player_id: string; total: number } | undefined
      const winner = top ? row(top.player_id) : undefined
      if (!top || !winner || top.total <= 0) continue
      const reason = (titleOfSession.get(session_id) as { reason: string } | undefined)?.reason ?? ''
      quizWinners.push({
        title: /^Quiz « (.+) » — Q\d+$/.exec(reason)?.[1] ?? 'Un quiz',
        name: winner.name,
        avatar: winner.avatar,
        points: top.total,
      })
    }

    res.json({
      ranking: players
        .filter(p => p.score !== 0)
        .sort((a, b) => b.score - a.score)
        .map(p => ({ name: p.name, avatar: p.avatar, points: p.score })),
      teams: teamScores(teams.all(), players, teams.allBonuses()),
      stats: computeStats(answers.all(), players),
      quizCount: quizzes.n,
      totalPoints: distributed.n,
      bestShot:
        best && bestPlayer
          ? { name: bestPlayer.name, avatar: bestPlayer.avatar, points: best.points, reason: best.reason }
          : null,
      steadiest:
        steady && steadyPlayer
          ? { name: steadyPlayer.name, avatar: steadyPlayer.avatar, count: steady.n }
          : null,
      quizWinners,
    })
  })

  mountApi(app, { store, hostKey: opts.hostKey, onLibraryChanged: refreshLibrary })

  const here = path.dirname(fileURLToPath(import.meta.url))

  // Photos livrées avec le dépôt (les photos ajoutées depuis l'éditeur, elles,
  // vivent en base et sont servies par /media/image/:id).
  const quizMedia = path.resolve(here, '../content/quiz/images')
  if (fs.existsSync(quizMedia)) app.use('/media/quiz', express.static(quizMedia))

  // Une adresse d'API ou de photo inconnue est une erreur, pas la page
  // d'accueil : un client qui reçoit du HTML là où il attend du JSON ne
  // comprend rien à ce qui lui arrive.
  app.use(['/api', '/media'], (_req, res) => res.status(404).json({ error: 'Introuvable' }))

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
        engine.stop()
        io.close(async () => {
          db.close()
          store.close()
          // Les écritures distantes en vol doivent aboutir avant de couper.
          await backup.close()
          resolve()
        })
      }),
  }
}
