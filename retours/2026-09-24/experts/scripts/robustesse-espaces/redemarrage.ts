// Un redémarrage en pleine question, dans deux espaces à la fois : les deux
// reprennent-elles, chronomètres réarmés (invariant 5) ?
//
// Le serveur tourne pour de vrai (`src/index.ts` dans un processus enfant,
// comme exploitation.test.ts). A et B sont en pleine question, un invité de
// chacun a déjà répondu ; C a des invités mais pas de partie. Quatre coupures :
//   1. SIGTERM, même disque       — l'arrêt propre, chez soi
//   2. SIGKILL, même disque       — le PC qui plante
//   3. SIGTERM, disque effacé     — le redémarrage de l'hébergeur
//   4. SIGKILL, disque effacé     — l'instance tuée net (mémoire), sur l'hébergeur
// Après chaque coupure : la même question, la même échéance, la réponse déjà
// donnée, et la révélation qui tombe toute seule, à l'heure, dans A ET B.
//
//   cd server && node --import tsx ../retours/2026-09-24/experts/scripts/robustesse-espaces/redemarrage.ts
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { createServer } from 'node:net'
import {
  ADMIN,
  attendre,
  bilan,
  connecter,
  connexionAnimateur,
  creerQuiz,
  DOSSIER,
  ecrire,
  emitAck,
  essai,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Invite,
  type Socket,
} from './commun'

const dir = path.join(DOSSIER, 'redemarrage')
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
const dbPath = path.join(dir, 'locale.db')
const port = await new Promise<number>(r => {
  const s = createServer().listen(0, () => {
    const p = (s.address() as any).port
    s.close(() => r(p))
  })
})
const url = `http://localhost:${port}`
const env = {
  ...process.env,
  PORT: String(port),
  DB_PATH: dbPath,
  QUIZ_DB_URL: `file:${path.join(dir, 'permanente.db')}`,
  ADMIN_LOGIN: ADMIN.login,
  ADMIN_PASSWORD: ADMIN.password,
  ADMIN_SLUG: ADMIN.slug,
  ADMIN_NAME: ADMIN.name,
}
for (const k of ['RENDER', 'NODE_ENV', 'NODE_OPTIONS', 'PUBLIC_URL', 'APP_ENV']) delete (env as any)[k]

let proc: ChildProcess | null = null
let journal = ''
async function lancer() {
  journal = ''
  proc = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: path.resolve(DOSSIER, '../../../server'), env, stdio: ['ignore', 'pipe', 'pipe'] })
  proc.stdout!.on('data', d => (journal += d))
  proc.stderr!.on('data', d => (journal += d))
  const debut = Date.now()
  while (!/serveur prêt/.test(journal)) {
    if (Date.now() - debut > 60_000) throw new Error(`pas prêt :\n${journal}`)
    await patienter(100)
  }
  return Date.now() - debut
}
async function couper(signal: 'SIGTERM' | 'SIGKILL', disqueEfface: boolean) {
  const fin = new Promise(r => proc!.once('close', r))
  proc!.kill(signal)
  await fin
  if (disqueEfface) for (const s of ['', '-wal', '-shm']) rmSync(`${dbPath}${s}`, { force: true })
}

const ouverts: Socket[] = []
const ecran = async (cookie: string) => {
  const h = connecter(url, cookie)
  ouverts.push(h)
  const vue = attendre<any>(h, 'session:view', () => true, 'la vue de l’écran', 10_000).catch(() => null)
  const ok: any = await emitAck(h, 'host:hello', {})
  if (!ok.ok) throw new Error('écran refusé')
  return { h, vue: await vue }
}

try {
  await lancer()
  const A = { cookie: await connexionAnimateur(url), slug: ADMIN.slug }
  const admin = A.cookie
  const creer = async (login: string, slug: string) => {
    const r: any = await (await ecrire(url, '/api/admin/accounts', { login, name: login, slug }, admin)).json()
    const act = await ecrire(url, '/api/auth/activate', { token: r.activation.token, password: `motdepasse-${login}` })
    return { cookie: /qz_session=[^;]+/.exec(act.headers.get('set-cookie') ?? '')![0], slug }
  }
  const B = await creer('bruno', 'chez-bruno')
  const C = await creer('chloe', 'chez-chloe')
  const esp = { A, B, C } as const
  const quiz: Record<string, string> = {}
  for (const n of ['A', 'B'] as const) quiz[n] = await creerQuiz(url, esp[n].cookie, [qcm(`${n}1`, ['Oui', 'Non'], 0, 20), qcm(`${n}2`, ['Oui', 'Non'], 0, 20)])
  const salle: Record<string, Invite[]> = {}
  for (const n of ['A', 'B', 'C'] as const) {
    salle[n] = []
    for (const p of ['Alba', 'Basile']) {
      const i = await invite(url, `${p}${n}`, '🦊', { slug: esp[n].slug })
      ouverts.push(i.socket)
      salle[n].push(i)
    }
  }

  const coupures: [string, 'SIGTERM' | 'SIGKILL', boolean][] = [
    ['SIGTERM, même disque', 'SIGTERM', false],
    ['SIGKILL, même disque', 'SIGKILL', false],
    ['SIGTERM, disque effacé', 'SIGTERM', true],
    ['SIGKILL, disque effacé', 'SIGKILL', true],
  ]
  const mesures: string[] = []
  for (const [nom, signal, efface] of coupures) {
    // A et B lancent leur quiz, et un invité de chacun répond.
    const avant: Record<string, any> = {}
    for (const n of ['A', 'B'] as const) {
      const { h } = await ecran(esp[n].cookie)
      const sid = await lancerQuiz(h, quiz[n])
      const q = await attendre<any>(h, 'session:view', p => p.sessionId === sid && p.view.phase === 'question', `question de ${n}`, 20_000)
      const ack: any = await emitAck(salle[n][0].socket, 'player:action', { sessionId: sid, action: { type: 'answer', choice: 0 } })
      avant[n] = { sid, deadline: q.view.deadline, qIndex: q.view.qIndex, repondu: ack.ok }
    }
    // Le temps que le miroir parte… ou pas : la coupure tombe 300 ms après la réponse.
    await patienter(300)
    await couper(signal, efface)
    for (const s of ouverts.splice(0)) s.close()
    const reveil = await lancer()
    const reprise = /(\d+) parties? en cours reprises?/.exec(journal)?.[1] ?? '0'
    for (const n of ['A', 'B'] as const) {
      const { h, vue } = await ecran(esp[n].cookie)
      const memes = vue && vue.sessionId === avant[n].sid && vue.view.phase === 'question' && vue.view.qIndex === avant[n].qIndex
      // Les téléphones se re-présentent avec leur jeton.
      const retour = await Promise.all(salle[n].map(i => invite(url, '', '', { slug: esp[n].slug, token: i.token }).catch(e => e as Error)))
      const revenus = retour.filter(r => !(r instanceof Error)) as Invite[]
      revenus.forEach((r, k) => {
        ouverts.push(r.socket)
        salle[n][k] = r
      })
      const reveal = await attendre<any>(h, 'session:view', p => p.sessionId === avant[n].sid && p.view.phase === 'reveal', `révélation de ${n}`, 30_000).catch(() => null)
      const retard = reveal ? Date.now() - avant[n].deadline : null
      essai(
        `${nom} — ${n} reprend la même question, à la même échéance`,
        !!memes && vue.view.deadline === avant[n].deadline,
        vue ? `${vue.view.phase} q${vue.view.qIndex}, échéance ${vue.view.deadline === avant[n].deadline ? 'identique' : `${vue.view.deadline - avant[n].deadline} ms d’écart`}` : 'aucune partie',
      )
      essai(`${nom} — ${n} : les invités se re-présentent avec leur jeton`, revenus.length === salle[n].length, `${revenus.length}/${salle[n].length}`)
      essai(`${nom} — ${n} : la réponse donnée avant la coupure est gardée`, vue?.view.answeredCount === 1, `answeredCount ${vue?.view.answeredCount}`)
      essai(`${nom} — ${n} : la révélation tombe toute seule (chrono réarmé)`, !!reveal, retard === null ? 'jamais' : `${retard} ms après l’échéance d’origine`)
      mesures.push(`${nom} ; ${n} ; réveil ${reveil} ms ; parties reprises au démarrage ${reprise} ; révélation ${retard ?? '—'} ms après l'échéance`)
      ;(h as any).emit('host:endSession', { sessionId: avant[n].sid })
    }
    // C, sans partie, garde ses invités.
    const c: any = await (await fetch(`${url}/s/${C.slug}/soirees.json`)).json()
    void c
    const cRetour = await Promise.all(salle.C.map(i => invite(url, '', '', { slug: C.slug, token: i.token }).catch(() => null)))
    essai(`${nom} — C (sans partie) retrouve ses invités`, cRetour.every(Boolean), `${cRetour.filter(Boolean).length}/2`)
    cRetour.forEach((r, k) => r && (ouverts.push(r.socket), (salle.C[k] = r)))
    await patienter(500)
  }
  console.log('\nMesures :\n' + mesures.join('\n'))
} finally {
  for (const s of ouverts) s.close()
  if (proc && proc.exitCode === null) {
    const fin = new Promise(r => proc!.once('close', r))
    proc.kill('SIGTERM')
    await fin
  }
}
process.exit(bilan() > 0 ? 1 : 0)
