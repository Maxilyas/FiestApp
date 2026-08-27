import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDb } from './core/db'
import { Party } from './core/party'
import { ScoreLedger } from './core/scores'
import { GameEngine } from './core/engine'
import { PartyBackup } from './core/backup'
import { QuizStore } from './core/quizStore'
import { seedLibrary } from './core/seed'
import { quizModule, setQuizLibrary } from './games/quiz'
import { mountApi } from './api'
import { wireSockets } from './sockets'
import type { IoServer } from './core/types'
import type { PartySnapshot } from '../../shared/types'

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

export async function createQuizServer(opts: QuizServerOptions) {
  const app = express()
  const httpServer = createServer(app)
  const io: IoServer = new Server(httpServer, { cors: { origin: true } })

  const db = initDb(opts.dbPath)

  // Le disque d'un hébergeur gratuit est effacé à chaque redémarrage : la
  // soirée (invités et points) est donc recopiée dans la base distante, et
  // rechargée ici si la base locale est repartie vide.
  const backup = new PartyBackup(opts.quizDbUrl, opts.quizDbToken)
  await backup.init()
  const restored = await backup.restoreInto(db)
  if (restored.players > 0) {
    console.log(`[soirée] ${restored.players} invités et ${restored.scores} gains rechargés après redémarrage`)
  }

  const party = new Party(db, backup)
  const ledger = new ScoreLedger(db, backup)

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
  const buildSnapshot = (): PartySnapshot => {
    const ip = lanAddress()
    return {
      players: party.publicPlayers(ledger.allTotals()),
      session: engine.summary(),
      joinUrl: opts.publicUrl ?? (ip ? `http://${ip}:${boundPort}` : null),
      wifi,
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
    const snapshot = buildSnapshot()
    const json = JSON.stringify(snapshot)
    if (!force && json === lastSnapshot) return
    lastSnapshot = json
    io.emit('party:snapshot', snapshot)
  }

  const broadcastSnapshot = () => {
    if (pending) return
    pending = setTimeout(() => {
      pending = null
      sendSnapshot()
    }, 120)
  }

  const engine = new GameEngine(
    { db, io, party, ledger, onScoresChanged: broadcastSnapshot, onSessionChanged: broadcastSnapshot },
    quizModule,
  )
  engine.restore()

  /** Repart d'une soirée vierge — les essais d'avant la fête ne doivent pas y traîner. */
  const resetParty = async () => {
    const running = engine.activeSessionId
    if (running) engine.endSession(running)
    party.clearAll()
    ledger.clearAll()
    await backup.reset()
    broadcastSnapshot()
  }

  wireSockets(io, { party, engine, hostKey: opts.hostKey, buildSnapshot, broadcastSnapshot, resetParty })

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

  // En prod, le serveur sert aussi le client compilé (un seul process à héberger).
  const clientDist = path.resolve(here, '../../client/dist')
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist))
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))
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
