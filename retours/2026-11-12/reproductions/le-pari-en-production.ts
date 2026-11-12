// Le Pari en production (`../le-pari.md`) : après le Filet, l'autre jeu très en dessous des autres — 64 % de manches à
// zéro étoile depuis le 2 novembre 2026. D'où viennent ces zéros : la première question ratée, ou le pari perdu ? Chaque
// manche réelle se relit sur son plan figé et ses gestes. En lecture seule, des totaux : chaque profil devient un numéro
// en mémoire, jamais écrit ; ni nom, ni identifiant, ni l'adresse de la base.
//
//   cd server && NODE_USE_ENV_PROXY=1 node --import tsx ../retours/2026-11-12/reproductions/le-pari-en-production.ts <quoi>
//
//   manches     d'où viennent les zéros ; par acte, épreuve ou assaut ; par marche ; garder ou parier ; le temps
//   questions   chaque question posée, sa marche, ce qu'on y a répondu — rien d'un joueur
//   quiz        les questions du Quiz, une à une, marche par marche : le même QCM de la base, sans rien à parier
//   traversees  les traversées commencées depuis le 2 novembre (ou la date donnée), par issue : ce que le calibrage
//               compare à son joueur moyen
//
// Jamais `QUIZ_DB_URL` : `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN`, un jeton en lecture seule.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PariTire } from '../../../shared/cabinet/jeux/pari'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(path.join(RACINE, 'server/package.json'))
const quoi = process.argv[2] ?? 'manches'

type Ligne = Record<string, unknown>
let client: { execute: (s: { sql: string; args: unknown[] }) => Promise<{ rows: Ligne[] }> } | null = null
async function lire(sql: string, args: unknown[] = []): Promise<Ligne[]> {
  if (!/^\s*(SELECT|WITH)\b/i.test(sql)) throw new Error('des SELECT seulement')
  if (!client) {
    const url = process.env.PROD_LECTURE_URL
    const authToken = process.env.PROD_LECTURE_TOKEN
    if (!url || !authToken) throw new Error('PROD_LECTURE_URL et PROD_LECTURE_TOKEN, un jeton en lecture seule — jamais QUIZ_DB_URL')
    client = require('@libsql/client').createClient({ url: url.replace(/^libsql:/, 'https:'), authToken })
  }
  return (await client!.execute({ sql, args })).rows
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : '—').padStart(5)
const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const centile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN
}
const ACTES = ['I', 'II', 'III']
const MARCHES = ['facile', 'moyen', 'difficile', 'expert']

/** Les parties d'un jeu depuis l'ouverture de la traversée, leur plan figé et leurs gestes à leur heure. */
async function lesParties(jeu: string) {
  const series = await lire(`SELECT id, profile_id, cabinet FROM campagne_series WHERE mode = 'cabinet' AND cabinet LIKE ? ORDER BY commencee_le`, [`%"jeu":"${jeu}"%`])
  const gestes = new Map<unknown, { g: any; le: number }[]>()
  for (let i = 0; i < series.length; i += 50) {
    const lot = series.slice(i, i + 50).map(s => s.id)
    const r = await lire(`SELECT serie_id, geste, fait_le FROM cabinet_gestes WHERE serie_id IN (${lot.map(() => '?').join(',')}) ORDER BY serie_id, rang`, lot)
    for (const g of r) gestes.set(g.serie_id, [...(gestes.get(g.serie_id) ?? []), { g: JSON.parse(String(g.geste)), le: Number(g.fait_le) }])
  }
  return series.map(s => ({ profil: s.profile_id, depart: JSON.parse(String(s.cabinet)), gestes: gestes.get(s.id) ?? [] })).filter(p => p.depart.jeu === jeu && p.depart.traversee)
}

/** L'acte d'une épreuve, et si c'est un assaut de gardien : son étape (`a<acte>r…`), son rang d'assaut. */
const ouSeJoue = (depart: any) => {
  const etape: string = depart.traversee?.etape ?? ''
  const acte = /^a(\d)/.test(etape) ? Number(/^a(\d)/.exec(etape)![1]) : null
  return { acte, assaut: Number(depart.traversee?.assaut ?? 0) > 0 }
}

interface Manche {
  joueur: number
  jour: string
  acte: number | null
  assaut: boolean
  t: PariTire
  /** Sa réponse à la première question : juste, fausse, ou rien — partie d'elle-même à l'échéance, ou la manche laissée. */
  q1: 'juste' | 'fausse' | 'sans'
  /** Juste à la première : ce qu'il a fait de ses étoiles. */
  choix: 'garder' | 'parier' | null
  q2: 'juste' | 'fausse' | 'sans' | null
  etoiles: number
  eclairee: [boolean, boolean]
  /** De l'ouverture à la réponse, puis de « Juste ! » au choix, puis du pari à la réponse — en secondes, les pauses ôtées de la première. */
  temps: [number | null, number | null, number | null]
  auto: boolean
}

async function lesManches(): Promise<Manche[]> {
  const numero = new Map<unknown, number>()
  const manches: Manche[] = []
  for (const p of await lesParties('pari')) {
    if (!numero.has(p.profil)) numero.set(p.profil, numero.size)
    let changes = 0
    for (let m = 0; m < 3; m++) {
      const siens = p.gestes.filter(x => x.g.manche === m)
      const ouvert = siens.find(x => x.g.quoi === 'ouvrir')
      if (!ouvert) continue
      let tirage = m
      for (const x of siens) if (x.g.quoi === 'changer') tirage = 3 + changes++
      const t = p.depart.tirages[tirage] as PariTire
      if (!t?.q1) continue
      // Après un « Changer », la manche repart de sa première question.
      const apres = siens.slice(siens.map(x => x.g.quoi).lastIndexOf('changer') + 1)
      const reponses = apres.filter(x => x.g.quoi === 'repondre')
      const r1 = reponses[0]
      const c1 = r1?.g.reponse?.pari?.choix
      const q1: Manche['q1'] = c1 === undefined || c1 === null ? 'sans' : c1 === t.q1.bonne ? 'juste' : 'fausse'
      const decide = q1 === 'juste' ? apres.find(x => x.le >= r1.le && (x.g.quoi === 'garder' || x.g.quoi === 'parier')) : undefined
      // Juste, puis rien : laissée au choix, ses étoiles sont gardées (`juger`).
      const choix: Manche['choix'] = q1 !== 'juste' ? null : decide?.g.quoi === 'parier' ? 'parier' : 'garder'
      const r2 = choix === 'parier' ? reponses[1] : undefined
      const c2 = r2?.g.reponse?.pari?.choix
      const q2: Manche['q2'] = choix !== 'parier' ? null : c2 === undefined || c2 === null ? 'sans' : c2 === t.q2.bonne ? 'juste' : 'fausse'
      let pause = 0
      let depuis: number | null = null
      for (const x of siens) {
        if (x.g.quoi === 'pause') depuis = x.le
        if (x.g.quoi === 'reprendre' && depuis !== null) {
          pause += x.le - depuis
          depuis = null
        }
      }
      const eclairs = apres.filter(x => x.g.quoi === 'eclairer')
      manches.push({
        joueur: numero.get(p.profil)!,
        jour: p.depart.jour,
        ...ouSeJoue(p.depart),
        t,
        q1,
        choix,
        q2,
        etoiles: q1 !== 'juste' ? 0 : choix === 'garder' ? 2 : q2 === 'juste' ? 3 : 0,
        eclairee: [eclairs.some(x => !r1 || x.le <= r1.le), eclairs.some(x => decide !== undefined && x.le >= decide.le)],
        temps: [r1 ? (r1.le - ouvert.le - pause) / 1000 : null, decide ? (decide.le - r1.le) / 1000 : null, r2 && decide ? (r2.le - decide.le) / 1000 : null],
        auto: reponses.some(x => x.g.auto === true),
      })
    }
  }
  return manches
}

function ligne(nom: string, ms: Manche[]) {
  if (!ms.length) return
  const n = ms.length
  const q1 = ms.filter(m => m.q1 === 'juste').length
  const paries = ms.filter(m => m.choix === 'parier')
  console.log(
    `${nom.padEnd(30)} ${String(n).padStart(4)}  zéro ★ ${pct(ms.filter(m => m.etoiles === 0).length, n)}  ★/manche ${moy(ms.map(m => m.etoiles)).toFixed(2)}  | 1re juste ${pct(q1, n)}  | parient ${pct(paries.length, q1)} des justes, gagnent ${pct(paries.filter(m => m.q2 === 'juste').length, paries.length)}`,
  )
}

if (quoi === 'manches') {
  const manches = await lesManches()
  const n = manches.length
  console.log(`${n} manches ouvertes du Pari, ${new Set(manches.map(m => m.joueur)).size} joueurs, du ${manches[0]?.jour} au ${manches.at(-1)?.jour}\n`)
  const zero = manches.filter(m => m.etoiles === 0)
  console.log(`D'où viennent les ${zero.length} manches à zéro étoile (${pct(zero.length, n).trim()}) :`)
  const part = (nom: string, ms: Manche[]) => console.log(`  ${nom.padEnd(44)} ${String(ms.length).padStart(4)}  ${pct(ms.length, n)} des manches, ${pct(ms.length, zero.length)} des zéros`)
  part('la première question, fausse', manches.filter(m => m.q1 === 'fausse'))
  part('la première question, sans réponse', manches.filter(m => m.q1 === 'sans'))
  part('le pari perdu, sa question fausse', manches.filter(m => m.q2 === 'fausse'))
  part('le pari perdu, sa question sans réponse', manches.filter(m => m.q2 === 'sans'))
  console.log(`Et les autres : ${manches.filter(m => m.choix === 'garder').length} gardées (★★), ${manches.filter(m => m.q2 === 'juste').length} paris gagnés (★★★)\n`)
  ligne('toutes', manches)
  console.log('\nÉpreuve ou assaut, acte par acte :')
  for (const assaut of [false, true]) for (const a of [0, 1, 2]) ligne(`  ${assaut ? 'assaut' : 'épreuve'}, acte ${ACTES[a]}`, manches.filter(m => m.assaut === assaut && m.acte === a))
  console.log('\nÀ la marche de la première question :')
  for (const k of MARCHES) ligne(`  ${k}`, manches.filter(m => m.t.q1.niveau === k))
  console.log('\nLa question du pari, à sa marche (ceux qui parient) :')
  for (const k of MARCHES) {
    const ms = manches.filter(m => m.choix === 'parier' && m.t.q2.niveau === k)
    if (ms.length) console.log(`  ${k.padEnd(12)} ${String(ms.length).padStart(3)} paris, ${pct(ms.filter(m => m.q2 === 'juste').length, ms.length).trim()} gagnés`)
  }
  console.log('\nÉclairer (une mauvaise réponse effacée) :')
  ligne('  la première éclairée', manches.filter(m => m.eclairee[0]))
  ligne('  la première sans aide', manches.filter(m => !m.eclairee[0]))
  console.log('\nLe temps (35 s par question, aucun chrono au choix) :')
  const t = (k: 0 | 1 | 2) => manches.map(m => m.temps[k]).filter((x): x is number => x !== null)
  for (const [nom, k] of [['la première question', 0], ['garder ou parier', 1], ['la question du pari', 2]] as const)
    console.log(`  ${nom.padEnd(22)} médiane ${centile(t(k), 0.5).toFixed(0)} s, neuf dixièmes sous ${centile(t(k), 0.9).toFixed(0)} s (${t(k).length})`)
  console.log(`  parties d'elles-mêmes à l'échéance : ${manches.filter(m => m.auto).length} sur ${n}`)
  console.log('\nPar joueur, sans nom : manches, zéro étoile, première juste')
  for (const j of [...new Set(manches.map(m => m.joueur))]) {
    const ms = manches.filter(m => m.joueur === j)
    console.log(`  n° ${String(j).padStart(2)} : ${String(ms.length).padStart(3)} manches, zéro ${pct(ms.filter(m => m.etoiles === 0).length, ms.length)}, 1re juste ${pct(ms.filter(m => m.q1 === 'juste').length, ms.length)}, parie ${ms.filter(m => m.choix === 'parier').length} fois`)
  }
} else if (quoi === 'questions') {
  const manches = await lesManches()
  const vues = new Map<string, { texte: string; niveau: string; bonne: string; juste: number; fausse: number; sans: number; role: string; choisies: Map<string, number> }>()
  const noter = (q: PariTire['q1'], role: string, issue: 'juste' | 'fausse' | 'sans') => {
    const v = vues.get(q.id + role) ?? { texte: q.texte, niveau: q.niveau, bonne: q.reponses[q.bonne], juste: 0, fausse: 0, sans: 0, role, choisies: new Map() }
    v[issue]++
    vues.set(q.id + role, v)
  }
  for (const m of manches) {
    noter(m.t.q1, '1re', m.q1)
    if (m.q2) noter(m.t.q2, 'pari', m.q2)
  }
  for (const v of [...vues.values()].sort((a, b) => a.role.localeCompare(b.role) || MARCHES.indexOf(a.niveau) - MARCHES.indexOf(b.niveau)))
    console.log(`[${v.role} · ${v.niveau}] ${v.juste} juste, ${v.fausse} fausse${v.sans ? `, ${v.sans} sans réponse` : ''} — ${v.texte} → ${v.bonne}`)
} else if (quoi === 'quiz') {
  // Le Quiz pose les mêmes QCM de la base, quatre par manche, à la marche de l'acte : ce que vaut une question seule.
  const parMarche = new Map<string, { n: number; justes: number }>()
  const parLieu = new Map<string, { n: number; justes: number }>()
  for (const p of await lesParties('quiz')) {
    const lieu = ouSeJoue(p.depart)
    let changes = 0
    for (let m = 0; m < 3; m++) {
      const siens = p.gestes.filter(x => x.g.manche === m)
      let tirage = m
      for (const x of siens) if (x.g.quoi === 'changer') tirage = 3 + changes++
      const t = p.depart.tirages[tirage]
      const rep = siens.filter(x => x.g.quoi === 'repondre').at(-1)?.g.reponse?.quiz?.choix as (number | null)[] | undefined
      if (!t?.questions || !rep) continue
      t.questions.forEach((q: PariTire['q1'], k: number) => {
        for (const [carte, cle] of [[parMarche, q.niveau], [parLieu, `${lieu.assaut ? 'assaut' : 'épreuve'}, acte ${lieu.acte === null ? '—' : ACTES[lieu.acte]}`]] as const) {
          const x = carte.get(cle) ?? { n: 0, justes: 0 }
          x.n++
          if (rep[k] === q.bonne) x.justes++
          carte.set(cle, x)
        }
      })
    }
  }
  console.log('Les questions du Quiz, une à une — à leur marche :')
  for (const k of MARCHES) if (parMarche.has(k)) console.log(`  ${k.padEnd(12)} ${String(parMarche.get(k)!.n).padStart(4)} questions, ${pct(parMarche.get(k)!.justes, parMarche.get(k)!.n).trim()} justes`)
  console.log('… et là où elles se posent :')
  for (const [k, x] of [...parLieu].sort()) console.log(`  ${k.padEnd(20)} ${String(x.n).padStart(4)} questions, ${pct(x.justes, x.n).trim()} justes`)
} else if (quoi === 'traversees') {
  const depuis = Date.parse(process.argv[3] ?? '2026-11-02T00:00:00+01:00')
  const issues = await lire(`SELECT issue, COUNT(*) AS n FROM cabinet_traversees WHERE commencee_le >= ? GROUP BY issue`, [depuis])
  const joueurs = await lire(`SELECT COUNT(DISTINCT profile_id) AS n FROM cabinet_traversees WHERE commencee_le >= ?`, [depuis])
  const n = (k: string | null) => Number(issues.find(r => r.issue === k)?.n ?? 0)
  const finies = n('gagnee') + n('perdue') + n('abandonnee')
  console.log(`Depuis le ${new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(depuis))} : ${joueurs[0].n} joueurs, ${finies} traversées finies — ${n('gagnee')} gagnées (${pct(n('gagnee'), finies).trim()}), ${n('perdue')} perdues, ${n('abandonnee')} abandonnées —, ${n(null)} en route`)
} else {
  throw new Error(`« ${quoi} » : manches, questions, quiz ou traversees`)
}
