// Le Filet en deux temps en production, du 10 au 12 novembre 2026 (`../le-filet-en-deux-ecrans.md`) : le retour que le
// propriétaire rapportait — « c'est toujours trop dur, des questions trop difficiles ; les indices n'aident pas
// forcément ; énormément d'infos à l'écran, avec en plus un timer qui tourne » — relu sur les manches réelles. Chaque
// manche se rejuge par la règle partagée, sur son tirage figé et ses gestes. En lecture seule, des totaux : chaque
// profil devient un numéro en mémoire, jamais écrit ; ni nom, ni identifiant, ni l'adresse de la base.
//
//   cd server && NODE_USE_ENV_PROXY=1 node --import tsx ../retours/2026-11-12/reproductions/le-filet-en-production.ts <quoi>
//
//   manches     les manches du nouveau Filet : réussite par acte et par classement, les aides, le curseur, le temps
//   questions   chaque question posée : ce qu'on y a lancé, son indice — rien d'un joueur
//   jeux        les dix jeux depuis le 10 novembre (ou la date donnée), aux étoiles des épreuves conclues
//   actes       la loi des étoiles de chaque acte au classement d'aujourd'hui (`acteDuFilet`, décalé d'un cran) : les
//               lancers du Filet d'avant rejoués en deux temps, comme le 9 novembre — le joueur modèle du calibrage
//               (`LOI_DU_FILET_PAR_ACTE`, `server/scripts/calibrage-cabinet.ts`) —, et les manches réelles à côté
//
// Jamais `QUIZ_DB_URL` : `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN`, un jeton en lecture seule.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { acteDuFilet, etoilesDuLancer, milieuDeLaTranche, seTendEnDeuxTemps, type FiletEnDeuxTempsTire } from '../../../shared/cabinet/jeux/filetEnDeuxTemps'

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

/** Le contenu du Filet, par question : son classement et sa note du panel, d'où vient son acte. */
const CONTENU = new Map<string, { chacun?: boolean; panel: number; indice: string | null }>(
  (JSON.parse(fs.readFileSync(path.join(RACINE, 'server/content/cabinet/filet.json'), 'utf8')) as { id: string; chacun?: boolean; panel: number; indice: string | null }[]).map(e => [e.id, e]),
)
const acteDe = (id: string): number | null => {
  const e = CONTENU.get(id)
  return e ? acteDuFilet(e) : null
}
const ACTES = ['I', 'II', 'III']

/** Les parties du Filet, leur plan figé et leurs gestes à leur heure. */
async function lesParties() {
  const series = await lire(`SELECT id, profile_id, cabinet FROM campagne_series WHERE mode = 'cabinet' AND cabinet LIKE '%"jeu":"filet"%' ORDER BY commencee_le`)
  const gestes = new Map<unknown, { g: any; le: number }[]>()
  for (let i = 0; i < series.length; i += 50) {
    const lot = series.slice(i, i + 50).map(s => s.id)
    const r = await lire(`SELECT serie_id, geste, fait_le FROM cabinet_gestes WHERE serie_id IN (${lot.map(() => '?').join(',')}) ORDER BY serie_id, rang`, lot)
    for (const g of r) gestes.set(g.serie_id, [...(gestes.get(g.serie_id) ?? []), { g: JSON.parse(String(g.geste)), le: Number(g.fait_le) }])
  }
  return series.map(s => ({ id: String(s.id), profil: s.profile_id, depart: JSON.parse(String(s.cabinet)), gestes: gestes.get(s.id) ?? [] })).filter(p => p.depart.jeu === 'filet')
}

interface Manche {
  joueur: number
  jour: string
  /** L'acte de l'étape de la traversée ; null hors d'une traversée. */
  acteJoue: number | null
  t: FiletEnDeuxTempsTire
  aides: { cle: string; offerte: boolean }[]
  lancer: { epoque: number; x: number } | null
  auto: boolean
  ms: number | null
  /** Ce que valait le lancer, avant les aides. */
  avant: number
}

/** Les manches ouvertes du nouveau Filet : après un « Changer », la rechange qu'elle a jouée, et les seules aides d'après. */
async function lesManches(): Promise<Manche[]> {
  const numero = new Map<unknown, number>()
  const manches: Manche[] = []
  for (const p of await lesParties()) {
    const d = p.depart
    if (!d.tirages?.some((t: any) => t.deuxTemps)) continue
    if (!numero.has(p.profil)) numero.set(p.profil, numero.size)
    const etape: string | undefined = d.traversee?.etape
    const acteJoue = etape && /^a(\d)/.test(etape) ? Number(/^a(\d)/.exec(etape)![1]) : null
    let changes = 0
    for (let m = 0; m < 3; m++) {
      const siens = p.gestes.filter(x => x.g.manche === m)
      const ouvert = siens.find(x => x.g.quoi === 'ouvrir')
      if (!ouvert) continue
      let tirage = m
      for (const x of siens) if (x.g.quoi === 'changer') tirage = 3 + changes++
      const t = d.tirages[tirage] as FiletEnDeuxTempsTire
      if (!t?.deuxTemps) continue
      const apres = siens.slice(siens.map(x => x.g.quoi).lastIndexOf('changer') + 1)
      const aides: Manche['aides'] = []
      for (const x of apres) {
        if (x.g.quoi === 'aide') aides.push({ cle: x.g.aide, offerte: false })
        if (x.g.quoi === 'eclairer') aides.push({ cle: ['epoques', 'indice'][x.g.affirmation] ?? '?', offerte: true })
      }
      const rep = siens.find(x => x.g.quoi === 'repondre')
      const lancer = rep?.g.reponse?.filet ?? null
      let pause = 0
      let depuis: number | null = null
      for (const x of siens) {
        if (x.g.quoi === 'pause') depuis = x.le
        if (x.g.quoi === 'reprendre' && depuis !== null) {
          pause += x.le - depuis
          depuis = null
        }
      }
      manches.push({ joueur: numero.get(p.profil)!, jour: d.jour, acteJoue, t, aides, lancer, auto: rep?.g.auto === true, ms: rep ? rep.le - ouvert.le - pause : null, avant: etoilesDuLancer(t, lancer) })
    }
  }
  return manches
}

const net = (m: Manche) => Math.max(0, m.avant - m.aides.filter(a => !a.offerte).length)
function ligne(nom: string, ms: Manche[]) {
  if (!ms.length) return
  const d = [0, 1, 2, 3].map(e => ms.filter(m => m.avant === e).length)
  const lances = ms.filter(m => m.lancer)
  console.log(
    `${nom.padEnd(32)} ${String(ms.length).padStart(4)}  ratées ${pct(d[0], ms.length)}  ★ ${pct(d[1], ms.length)}  ★★ ${pct(d[2], ms.length)}  ★★★ ${pct(d[3], ms.length)}  ★/manche ${moy(ms.map(m => m.avant)).toFixed(2)} (aides payées : ${moy(ms.map(net)).toFixed(2)})  bonne époque ${pct(lances.filter(m => m.t.bonnes.includes(m.lancer!.epoque)).length, lances.length)}`,
  )
}

if (quoi === 'manches') {
  const manches = await lesManches()
  console.log(`${manches.length} manches ouvertes du Filet en deux temps, ${new Set(manches.map(m => m.joueur)).size} joueurs, du ${manches[0]?.jour} au ${manches.at(-1)?.jour}\n`)
  ligne('toutes', manches)
  console.log('\nÀ l’acte où elles se sont jouées :')
  for (const a of [0, 1, 2]) ligne(`  acte ${ACTES[a]}`, manches.filter(m => m.acteJoue === a))
  console.log('\nAu classement de leur question (`filet.json`) :')
  const classe = (m: Manche) => {
    const c = CONTENU.get(m.t.question.id)
    return !c ? 'hors du contenu' : c.chacun ? 'chaque Français' : c.panel >= 50 ? 'panel ≥ 50' : c.panel >= 25 ? 'panel 25–49' : 'panel < 25'
  }
  for (const c of ['chaque Français', 'panel ≥ 50', 'panel 25–49', 'panel < 25', 'hors du contenu']) ligne(`  ${c}`, manches.filter(m => classe(m) === c))
  console.log('\nUne année, une grandeur :')
  ligne('  années', manches.filter(m => m.t.annee))
  ligne('  grandeurs', manches.filter(m => !m.t.annee))
  console.log('\nLes aides :')
  const avec = (cle: string, offerte?: boolean) => manches.filter(m => m.aides.some(a => a.cle === cle && (offerte === undefined || a.offerte === offerte)))
  console.log(`  l’indice : pris ${avec('indice').length} fois sur ${manches.filter(m => m.t.indice !== null).length} manches qui en proposent un (payé ${avec('indice', false).length}, offert ${avec('indice', true).length})`)
  console.log(`  « Deux époques de moins » : prise ${avec('epoques').length} fois (payée ${avec('epoques', false).length}, offerte ${avec('epoques', true).length})`)
  ligne('  sans aucune aide', manches.filter(m => m.aides.length === 0))
  ligne('  avec l’indice', manches.filter(m => m.aides.some(a => a.cle === 'indice')))
  ligne('  avec « Deux époques de moins »', manches.filter(m => m.aides.some(a => a.cle === 'epoques')))
  console.log('\nLe curseur :')
  const lances = manches.filter(m => m.lancer)
  const auMilieu = lances.filter(m => m.lancer!.x === milieuDeLaTranche(m.t.tranches[m.lancer!.epoque]))
  console.log(`  laissé au milieu de l’époque : ${auMilieu.length} lancers sur ${lances.length}`)
  ligne('  laissé au milieu', auMilieu)
  ligne('  déplacé', lances.filter(m => !auMilieu.includes(m)))
  console.log('\nLe temps (45 s de chrono) :')
  const temps = manches.filter(m => m.ms !== null).map(m => m.ms! / 1000)
  console.log(`  de l’ouverture au lancer : médiane ${centile(temps, 0.5).toFixed(0)} s, trois quarts sous ${centile(temps, 0.75).toFixed(0)} s, neuf dixièmes sous ${centile(temps, 0.9).toFixed(0)} s`)
  console.log(`  parties d’elles-mêmes à l’échéance : ${manches.filter(m => m.auto).length} sur ${manches.length}`)
  const avecIndice = manches.filter(m => m.ms !== null && m.aides.some(a => a.cle === 'indice')).map(m => (m.ms! / 1000).toFixed(0))
  console.log(`  avec l’indice : ${avecIndice.join(' s, ')} s`)
} else if (quoi === 'questions') {
  const parQuestion = new Map<string, Manche[]>()
  for (const m of await lesManches()) parQuestion.set(m.t.question.id, [...(parQuestion.get(m.t.question.id) ?? []), m])
  const lignes = [...parQuestion].map(([id, ms]) => ({ id, ms, moyenne: moy(ms.map(m => m.avant)) })).sort((a, b) => a.moyenne - b.moyenne)
  for (const l of lignes) {
    const t = l.ms[0].t
    const c = CONTENU.get(l.id)
    const lancers = l.ms.map(m => (m.lancer ? `${m.lancer.x}${m.t.bonnes.includes(m.lancer.epoque) ? ' (bonne époque)' : ''}${m.aides.length ? ` [${m.aides.map(a => a.cle + (a.offerte ? ' offerte' : '')).join(', ')}]` : ''}` : 'sans lancer'))
    console.log(`${l.moyenne.toFixed(1)} ★ · ${c ? (c.chacun ? 'chaque Français' : `panel ${c.panel}`) : '?'} · ${t.question.texte} → ${t.valeur}${t.unite ? ` ${t.unite}` : ''}\n      lancé : ${lancers.join(' ; ')}${t.indice ? `\n      indice : ${t.indice}` : ''}`)
  }
} else if (quoi === 'jeux') {
  // Les étoiles de chaque manche conclue (`cabinet_traversee_gestes`, le geste `conclure`), traversées en route comprises.
  const depuis = Date.parse(process.argv[3] ?? '2026-11-10T00:00:00+01:00')
  const conclus = (await lire(`SELECT geste FROM cabinet_traversee_gestes WHERE fait_le >= ? AND geste LIKE '%"quoi":"conclure"%'`, [depuis])).map(r => JSON.parse(String(r.geste)))
  const jeux = new Map<string, { jeu: string; assaut: boolean; deuxTemps: boolean }>()
  for (let i = 0; i < conclus.length; i += 50) {
    const lot = conclus.slice(i, i + 50).map(p => p.partie)
    const r = await lire(
      `SELECT id, json_extract(cabinet, '$.jeu') AS jeu, json_extract(cabinet, '$.traversee.assaut') AS assaut, (cabinet LIKE '%"deuxTemps":true%') AS dt FROM campagne_series WHERE id IN (${lot.map(() => '?').join(',')})`,
      lot,
    )
    for (const x of r) jeux.set(String(x.id), { jeu: String(x.jeu), assaut: Number(x.assaut ?? 0) > 0, deuxTemps: Number(x.dt) === 1 })
  }
  const T = new Map<string, { parties: number; assauts: number; etoiles: number[] }>()
  for (const p of conclus) {
    const j = jeux.get(p.partie)
    if (!j) continue
    const cle = j.jeu === 'filet' ? (j.deuxTemps ? 'filet (deux temps)' : 'filet (d’avant)') : j.jeu
    const t = T.get(cle) ?? { parties: 0, assauts: 0, etoiles: [] }
    t.parties++
    if (j.assaut) t.assauts++
    for (const m of p.manches ?? []) if (m && typeof m.etoiles === 'number') t.etoiles.push(m.etoiles)
    T.set(cle, t)
  }
  console.log(`${conclus.length} parties conclues depuis le ${new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(depuis))}`)
  console.log('jeu                   parties  dont assauts  manches  zéro ★  ★★ et plus  ★/manche')
  const zero = (t: { etoiles: number[] }) => t.etoiles.filter(e => e === 0).length / Math.max(1, t.etoiles.length)
  for (const [k, t] of [...T].sort((a, b) => zero(b[1]) - zero(a[1]))) {
    console.log(`${k.padEnd(20)} ${String(t.parties).padStart(8)}  ${String(t.assauts).padStart(12)}  ${String(t.etoiles.length).padStart(7)}  ${pct(t.etoiles.filter(e => e === 0).length, t.etoiles.length)}  ${pct(t.etoiles.filter(e => e >= 2).length, t.etoiles.length).padStart(10)}  ${moy(t.etoiles).toFixed(2).padStart(8)}`)
  }
  const tout = [...T.values()].flatMap(t => t.etoiles)
  console.log(`\ntous les jeux : ${tout.length} manches, zéro ★ ${pct(tout.filter(e => e === 0).length, tout.length).trim()}, ${moy(tout).toFixed(2)} ★ par manche`)
} else if (quoi === 'actes') {
  // Le Filet d'avant, rejoué en deux temps à la règle du cahier (`../../2026-11-09/reproductions/filet-en-production.ts`,
  // `deuxTemps`) : le curseur réel dit ce que le joueur croyait. Une borne basse — il se posait sur une longue piste.
  const borneDuDemi = (k: number) => (k % 2 === 0 ? 10 ** (k / 2) : 3 * 10 ** ((k - 1) / 2))
  const trancheDe = (v: number) => {
    let k = 0
    while (borneDuDemi(k + 1) <= v) k++
    return k
  }
  const rejoue = (valeur: number, annee: boolean, x: number): number => {
    if (annee) {
      const T = valeur >= 1800 ? 25 : valeur >= 1500 ? 50 : 100
      const e = Math.abs(x - valeur)
      if (e <= Math.max(1, Math.round(T / 12))) return 3
      if (e <= Math.round(T / 4)) return 2
      return Math.floor(x / T) === Math.floor(valeur / T) ? 1 : 0
    }
    const p = Math.round((1000 * Math.abs(x - valeur)) / valeur) / 10
    if (p <= 6) return 3
    if (p <= 25) return 2
    if (x < 1) return 0
    const kx = trancheDe(x)
    const kv = trancheDe(valeur)
    return kx === kv || (valeur === borneDuDemi(kv) && kx === kv - 1) ? 1 : 0
  }
  const lancers: { id: string; etoiles: number }[] = []
  for (const p of await lesParties()) {
    for (const g of p.gestes) {
      // Une manche changée joue sa rechange, ailleurs dans le plan : elle ne se rejuge pas ici.
      if (g.g.quoi !== 'repondre' || p.gestes.some(x => x.g.quoi === 'changer' && x.g.manche === g.g.manche)) continue
      const t = p.depart.tirages[g.g.manche]
      if (!t || t.jeu !== 'filet' || t.deuxTemps || !g.g.reponse?.filet) continue
      if (acteDe(t.question.id) === null || !seTendEnDeuxTemps(t.valeur, t.annee, 2026)) continue
      lancers.push({ id: t.question.id, etoiles: rejoue(t.valeur, t.annee, g.g.reponse.filet.x) })
    }
  }
  const reelles = await lesManches()
  console.log(`${lancers.length} lancers du Filet d’avant sur une question que le Filet pose encore, rejoués en deux temps\n`)
  console.log('classement de la question            lancers  questions  réussies  ★/manche     0 ★    1 ★    2 ★    3 ★   | manches réelles du nouveau Filet')
  const loiDe = (s: number[]) => [0, 1, 2, 3].map(k => Math.round((1000 * s.filter(x => x === k).length) / Math.max(1, s.length)) / 1000)
  const dire = (nom: string, garde: (id: string) => boolean) => {
    const ici = lancers.filter(l => garde(l.id))
    const s = ici.map(l => l.etoiles)
    const r = reelles.filter(m => garde(m.t.question.id))
    console.log(
      `${nom.padEnd(35)}  ${String(s.length).padStart(7)}  ${String(new Set(ici.map(l => l.id)).size).padStart(9)}  ${pct(s.filter(Boolean).length, s.length).padStart(8)}  ${moy(s).toFixed(2).padStart(8)}  ${loiDe(s).map(x => pct(Math.round(1000 * x), 1000)).join('  ')}   | ${r.length} manches, ${pct(r.filter(m => m.avant > 0).length, r.length).trim()} réussies, ${r.length ? moy(r.map(m => m.avant)).toFixed(2) : '—'} ★`,
    )
    return loiDe(s)
  }
  // Le premier acte où chaque question se pose (`acteDuFilet`) : son classement.
  const chacun = dire('chaque Français (acte I)', id => acteDe(id) === 0)
  dire('panel à 50 % et plus (acte II)', id => acteDe(id) === 1)
  dire('panel de 25 à 49 (acte III)', id => acteDe(id) === 2)
  // Hors de ce que chaque Français sait placer, la note du panel ne trie presque rien, et cinq lancers ne font pas une loi :
  // le joueur modèle du calibrage tient la même pour les deux.
  const panel = dire('panel à 25 % et plus, ensemble', id => acteDe(id) === 1 || acteDe(id) === 2)
  console.log(`\nLOI_DU_FILET_PAR_ACTE = ${JSON.stringify([chacun, panel, panel])}`)
  // Ce qu'un acte pose (`sePoseALActe`), au compte de son contenu : l'acte II tire aussi ce que chaque Français sait placer.
  const n = [0, 1, 2].map(a => [...CONTENU.values()].filter(e => acteDuFilet(e) === a).length)
  const reussies = (loi: number[]) => 1 - loi[0]
  const etoiles = (loi: number[]) => loi[1] + 2 * loi[2] + 3 * loi[3]
  const part = n[0] / (n[0] + n[1])
  console.log(`\nLe contenu : ${n[0]} questions que chaque Français sait placer, ${n[1]} au panel à 50 % et plus, ${n[2]} de 25 à 49, ${CONTENU.size - n[0] - n[1] - n[2]} que le Filet ne pose plus`)
  console.log('Ce que la loi promet, une question tirée au hasard dans ce que l’acte pose :')
  console.log(`  acte I    ${pct(Math.round(1000 * reussies(chacun)), 1000).trim()} de manches réussies, ${etoiles(chacun).toFixed(2)} ★`)
  console.log(`  acte II   ${pct(Math.round(1000 * (part * reussies(chacun) + (1 - part) * reussies(panel))), 1000).trim()} de manches réussies, ${(part * etoiles(chacun) + (1 - part) * etoiles(panel)).toFixed(2)} ★`)
  console.log(`  acte III  ${pct(Math.round(1000 * reussies(panel)), 1000).trim()} de manches réussies, ${etoiles(panel).toFixed(2)} ★`)
} else {
  throw new Error(`« ${quoi} » : manches, questions, jeux ou actes`)
}
