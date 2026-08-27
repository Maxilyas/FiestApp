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
  const party = new Party(db)
  const ledger = new ScoreLedger(db)

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
  const broadcastSnapshot = () => io.emit('party:snapshot', buildSnapshot())

  const engine = new GameEngine(
    { db, io, party, ledger, onScoresChanged: broadcastSnapshot, onSessionChanged: broadcastSnapshot },
    quizModule,
  )
  engine.restore()

  wireSockets(io, { party, engine, hostKey: opts.hostKey, buildSnapshot, broadcastSnapshot })

  // Filet de sécurité : re-synchronise tous les écrans périodiquement.
  // Un client qui aurait raté un broadcast (blip réseau, onglet endormi)
  // se répare tout seul, sans F5.
  const resync = setInterval(broadcastSnapshot, 30_000)

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
        io.close(() => {
          db.close()
          store.close()
          resolve()
        })
      }),
  }
}
