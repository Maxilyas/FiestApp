// Les outils du banc : le faux Turso dans un processus à part, l'application
// Express attrapée pour lire ses routes, et les chemins.
//
// `DEPOT` désigne le dépôt qu'on mesure — celui-ci par défaut, ou un autre
// arbre (`git worktree add ../hier c3b2f99`, puis `DEPOT=../hier`) : c'est
// ainsi que la synthèse compare le code d'hier soir à celui du jour. Les
// modules (better-sqlite3, express, tsx) viennent toujours de ce dépôt-ci.
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

export const ICI = path.dirname(fileURLToPath(import.meta.url))
export const RACINE = path.resolve(ICI, '../../..')
export const DEPOT = path.resolve(process.env.DEPOT ?? RACINE)
/** Les bases jetables du banc : hors de git (`export/` est ignoré). */
export const DONNEES = path.resolve(process.env.DONNEES ?? path.join(RACINE, 'export/perf-turso'))
mkdirSync(DONNEES, { recursive: true })

export interface Aller {
  etiquette: string
  t: number
  ms: number
  sqliteMs: number
  instructions: number
  sqls: string[]
  octets: number
}
export interface Plan {
  sql: string
  plan: string[]
  scans: string[]
  n: number
  ms: number
  lignes: number
  etiquettes: string[]
}
export interface Faux {
  url: string
  enfant: ChildProcess
  etiquette(e: string): Promise<void>
  latence(ms: number): Promise<void>
  remise(): Promise<void>
  releve(): Promise<{ allers: Aller[]; plans: Plan[] }>
  fermer(): void
}

/** Démarre le faux Turso sur `fichier` ; `neuf` l'efface d'abord. */
export async function fauxTurso(fichier: string, { neuf = true } = {}): Promise<Faux> {
  if (neuf) for (const s of ['', '-wal', '-shm']) rmSync(fichier + s, { force: true })
  const enfant = spawn(process.execPath, ['--import', 'tsx', path.join(ICI, 'faux-turso.ts'), fichier, '0'], {
    cwd: path.join(RACINE, 'server'),
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const port = await new Promise<number>((resolve, reject) => {
    enfant.once('exit', c => reject(new Error(`faux Turso arrêté (${c})`)))
    enfant.stdout!.on('data', (b: Buffer) => {
      const m = /PORT (\d+)/.exec(String(b))
      if (m) resolve(Number(m[1]))
    })
  })
  const url = `http://127.0.0.1:${port}`
  const poster = (chemin: string, corps: unknown) => fetch(`${url}${chemin}`, { method: 'POST', body: JSON.stringify(corps) }).then(r => r.json())
  return {
    url,
    enfant,
    etiquette: async e => void (await poster('/__etiquette', { etiquette: e })),
    latence: async ms => void (await poster('/__latence', { ms })),
    remise: async () => void (await poster('/__remise', {})),
    releve: async () => (await fetch(`${url}/__releve`)).json(),
    fermer: () => void enfant.kill(),
  }
}

// L'application Express du serveur, attrapée à sa première requête (comme `journal.test.ts`).
interface Couche {
  route?: { path: string | string[]; methods: Record<string, boolean> }
}
let application: { _router: { stack: Couche[] } } | null = null
const traiter = (express as any).application.handle
;(express as any).application.handle = function (this: any, ...args: unknown[]) {
  application ??= this
  return traiter.apply(this, args)
}

/** Les routes de l'application, `GET /api/jour`, telles que le routeur les tient. */
export function routes(): string[] {
  if (!application) return []
  return application._router.stack.flatMap(c => {
    const r = c.route
    if (!r) return []
    const chemins = Array.isArray(r.path) ? r.path : [r.path]
    return chemins.flatMap(p => Object.keys(r.methods).map(m => `${m.toUpperCase()} ${p}`))
  })
}

export const attendre = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Regroupe des allers-retours en vagues : ceux partis à quelques millisecondes d'écart sont en vol ensemble. */
export function vagues(allers: readonly Aller[], ecartMs = 8): Aller[][] {
  const v: Aller[][] = []
  for (const a of [...allers].sort((x, y) => x.t - y.t)) {
    const derniere = v.at(-1)
    if (derniere && a.t - derniere[0].t <= ecartMs) derniere.push(a)
    else v.push([a])
  }
  return v
}
