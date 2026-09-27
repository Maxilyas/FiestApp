// Le processeur qu'une partie du quiz du jour coûte au serveur, mesuré sur un
// vrai processus (`node --import tsx src/index.ts`, la commande de Render) :
// temps utilisateur + système lus dans /proc, avant et après 50 parties.
// Borne haute : ici la base permanente est un fichier, et SQLite travaille dans
// le processus ; avec Turso, le serveur paie à la place le HTTP et le décodage
// des réponses. L'horloge est la vraie (le 27 septembre 2026 est aujourd'hui).
//   cd server && nice -n 10 node --import tsx --test --test-timeout=600000 ../export/evaluations/perf-serveur/cpu.test.ts
import { test } from 'node:test'
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { peupler } from './peupler'

const SERVEUR = path.resolve(import.meta.dirname, '../../../server')
const TICKS = Number(execSync('getconf CLK_TCK').toString().trim())

function cpuMs(pid: number): number {
  const champs = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')
  return ((Number(champs[11]) + Number(champs[12])) * 1000) / TICKS
}

async function lancer(dir: string, port: number): Promise<ChildProcess> {
  const enfant = spawn('node', ['--import', 'tsx', ...(process.env.PROTOTYPE ? ['--import', path.resolve(import.meta.dirname, 'prototype.ts')] : []), 'src/index.ts'], {
    cwd: SERVEUR,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: path.join(dir, 'locale.db'),
      QUIZ_DB_URL: `file:${path.join(dir, 'permanente.db')}`,
      ADMIN_PASSWORD: 'banc-pass-1',
      ADMIN_SLUG: 'banc',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await new Promise<void>((res, rej) => {
    const to = setTimeout(() => rej(new Error('serveur pas prêt')), 60_000)
    enfant.stdout!.on('data', (b: Buffer) => {
      if (b.toString().includes('prêt')) {
        clearTimeout(to)
        res()
      }
    })
    enfant.on('exit', c => rej(new Error(`serveur sorti (${c})`)))
  })
  return enfant
}

const arreter = (e: ChildProcess) => new Promise<void>(res => (e.exitCode !== null ? res() : (e.once('exit', () => res()), e.kill('SIGTERM'))))

test('le processeur d’une partie du quiz du jour', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'perf-cpu-'))
  const port = 4300 + Math.floor(Math.random() * 500)
  const url = `http://localhost:${port}`
  let enfant = await lancer(dir, port)
  try {
    await arreter(enfant)
    const fichier = path.join(dir, 'permanente.db')
    const spaceId = (new Database(fichier, { readonly: true }).prepare('SELECT id FROM accounts WHERE slug = ?').get('banc') as { id: string }).id
    const pop = peupler(fichier, { spaceId, aujourdhui: '2026-09-27' })
    enfant = await lancer(dir, port)
    const pid = enfant.pid!
    const get = (c: string, chemin: string) => fetch(`${url}${chemin}`, { headers: { Cookie: c } }).then(r => r.json() as Promise<any>)
    const post = (c: string, chemin: string, corps: unknown = {}) =>
      fetch(`${url}${chemin}`, { method: 'POST', headers: { Cookie: c, 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' }, body: JSON.stringify(corps) }).then(
        r => r.json() as Promise<any>,
      )
    // La nuit d'hier se clôt, les profils se chargent : l'état ordinaire du soir.
    const t0 = cpuMs(pid)
    await get(pop.cookie(pop.ids[0]), '/api/jour')
    const nuit = cpuMs(pid) - t0
    await new Promise(r => setTimeout(r, 500))
    const bonnes = () => {
      const db = new Database(fichier, { readonly: true })
      const r = db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get('2026-09-27') as { questions: string }
      db.close()
      return (JSON.parse(r.questions) as { bonne: number }[]).map(q => q.bonne)
    }
    const passes: Record<string, number>[] = []
    for (const [debut, fin] of [
      [1, 51],
      [51, 101],
    ]) {
      const cpu: Record<string, number> = { moi: 0, jour: 0, commencer: 0, repondre: 0, suivante: 0 }
      const mesure = async (cle: string, f: () => Promise<unknown>) => {
        const a = cpuMs(pid)
        await f()
        cpu[cle] += cpuMs(pid) - a
      }
      const a0 = cpuMs(pid)
      for (let k = debut; k < fin; k++) {
        const c = pop.cookie(pop.ids[k])
        await mesure('moi', () => get(c, '/api/joueur/moi'))
        await mesure('jour', () => get(c, '/api/jour'))
        let e: any
        await mesure('commencer', async () => (e = await post(c, '/api/jour/commencer')))
        const b = bonnes()
        while (e.question) {
          const i = e.question.index
          await mesure('repondre', () => post(c, '/api/jour/repondre', { jour: e.jour, index: i, choix: (k + i) % 4 ? b[i] : (b[i] + 1) % 4 }))
          await mesure('suivante', async () => (e = await post(c, '/api/jour/suivante')))
        }
        await mesure('moi', () => get(c, '/api/joueur/moi'))
      }
      const total = cpuMs(pid) - a0
      passes.push({ parties: fin - debut, totalMs: Math.round(total), parPartieMs: Math.round(total / (fin - debut)), ...Object.fromEntries(Object.entries(cpu).map(([k, v]) => [k, Math.round(v)])) })
    }
    const sortie = { charge: execSync('uptime').toString().trim(), tick: `${1000 / TICKS} ms`, nuitCloseMs: Math.round(nuit), passes }
    console.log(JSON.stringify(sortie, null, 1))
    writeFileSync(new URL(process.env.PROTOTYPE ? './mesures-cpu-prototype.json' : './mesures-cpu.json', import.meta.url), JSON.stringify(sortie, null, 1))
  } finally {
    await arreter(enfant)
    rmSync(dir, { recursive: true, force: true })
  }
})
