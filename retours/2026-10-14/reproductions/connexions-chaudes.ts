// Les connexions gardées chaudes (perf-turso-13, `QUIZ_DB_KEEPWARM`), sur le
// banc : le vrai serveur et le vrai client libsql, contre un faux Turso qui
// referme ses connexions après 5 s de calme sans le dire — ce que la
// production a montré le 14 octobre 2026 — et fait payer à une connexion
// neuve sa poignée de main : 196 ms de plus que les 29 d'un aller-retour,
// 225 contre 29 en production.
//
// Une joueuse ouvre l'accueil, la campagne, joue une série au rythme des
// vrais joueurs — l'écart entre deux réponses tiré de ceux de la production,
// quatorze jours de campagne —, revient après une pause sur la page des
// duels, puis sur l'accueil. Deux fois, le même tirage : sans l'entretien,
// puis avec. Ce qu'on compte se lit dans les compteurs du serveur lui-même
// (le relevé de l'heure), comme la page « Le serveur » : aucune requête vers
// le faux Turso pendant la partie — elle passerait par les connexions du
// serveur.
//
//   cd server && node --import tsx ../retours/2026-10-14/reproductions/connexions-chaudes.ts [réponses]
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { DEPOT, DONNEES, RACINE, attendre, fauxTurso } from './outils.ts'
const { demarrer, inscrireProfil, ecrire } = await import(`${DEPOT}/server/test/banc.ts`)
const { releve } = await import(`${DEPOT}/server/src/core/pouls.ts`)

const require = createRequire(path.join(RACINE, 'server/package.json'))
const Database = require('better-sqlite3')

const REPONSES = Number(process.argv[2] ?? 12)
/** L'aller-retour gardé, et ce qu'une connexion neuve y ajoute (production, 14 octobre 2026). */
const LATENCE_MS = 29
const POIGNEE_MS = 196
/** Le délai d'inactivité de Turso, lu en production le même jour. */
const TURSO_REFERME_MS = 5_000

// L'écart entre deux réponses d'une même partie de campagne, en production (le 14 octobre 2026, sept
// jours, 5 706 écarts), par seconde de 0 à 14, puis au-delà — tiré au-delà entre 15 et 25 s pour tenir
// le banc en quelques minutes : passé 5 s, Turso a refermé la connexion, qu'on attende 6 ou 60 s.
const PAR_SECONDE = [6, 29, 27, 91, 244, 436, 542, 520, 510, 450, 407, 356, 317, 235, 206, 1330]
const TOTAL = PAR_SECONDE.reduce((s, n) => s + n, 0)

let graine = 11
const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647
function unEcart(): number {
  let r = hasard() * TOTAL
  for (let s = 0; s < PAR_SECONDE.length; s++) {
    r -= PAR_SECONDE[s]
    if (r < 0) return s < 15 ? (s + hasard()) * 1000 : 15_000 + hasard() * 10_000
  }
  return 15_000
}

/** Les comptes du relevé de l'heure, tous démarrages et heures confondus — comme la page les fond. */
function comptes() {
  return (releve.lignes('banc') as any[]).reduce(
    (t, l) => ({
      allers: t.allers + (l.base?.n ?? 0),
      ouvertes: t.ouvertes + (l.connexions?.ouvertes ?? 0),
      refermees: t.refermees + (l.connexions?.refermeesParLaBase ?? 0),
      echecs: t.echecs + (l.connexions?.echecs ?? 0),
      battements: t.battements + (l.connexions?.battements ?? 0),
      tombes: t.tombes + (l.connexions?.battementsTombes ?? 0),
      ouvertesParUnBattement: t.ouvertesParUnBattement + (l.connexions?.ouvertesParUnBattement ?? 0),
    }),
    { allers: 0, ouvertes: 0, refermees: 0, echecs: 0, battements: 0, tombes: 0, ouvertesParUnBattement: 0 },
  )
}

interface Pas {
  quoi: string
  attenteAvantMs: number
  ms: number
  allers: number
  ouvertes: number
}

async function partie(avecEntretien: boolean, ecarts: number[]) {
  const fichier = path.join(DONNEES, `chaudes-${avecEntretien ? 'avec' : 'sans'}.db`)
  const faux = await fauxTurso(fichier)
  await faux.latence(LATENCE_MS)
  await faux.connexions({ refermeApresMs: TURSO_REFERME_MS, poigneeMs: POIGNEE_MS })
  const banc = await demarrer({ quizDbUrl: faux.url, connexionsChaudes: avecEntretien, prechauffageCampagneMs: 300, rappels: { intervalleMs: 3_600_000 } })
  const pas: Pas[] = []
  try {
    const cookie = await inscrireProfil(banc.url, 'joueuse', 'Joueuse', '🦊')
    // La base de la campagne se lit en fond ; puis le calme : ce que le démarrage a ouvert se referme.
    await attendre(9_000)
    const debut = comptes()
    const mesurer = async (quoi: string, attenteAvantMs: number, f: () => Promise<Response>) => {
      await attendre(attenteAvantMs)
      const avant = comptes()
      const t = performance.now()
      const r = await f()
      const corps = await r.json().catch(() => null)
      const ms = performance.now() - t
      // Ce qui part après la réponse — une écriture en fond — compte pour le pas.
      await attendre(LATENCE_MS * 3 + 30)
      const apres = comptes()
      pas.push({ quoi, attenteAvantMs: Math.round(attenteAvantMs), ms: Math.round(ms), allers: apres.allers - avant.allers, ouvertes: apres.ouvertes - avant.ouvertes })
      if (!r.ok) throw new Error(`${quoi} → ${r.status} ${JSON.stringify(corps)?.slice(0, 120)}`)
      return corps
    }
    const lire = (chemin: string) => () => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })
    await mesurer('accueil', 0, lire('/api/joueur/moi?accueil'))
    await mesurer('campagne', 6_000, lire('/api/campagne'))
    const serie = await mesurer('série : commencer', 2_000, () => ecrire(banc.url, '/api/campagne/serie', {}, cookie))
    const questions = (() => {
      const db = new Database(fichier, { readonly: true })
      try {
        return JSON.parse(db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie.id).questions) as { bonne: number; reponses: string[] }[]
      } finally {
        db.close()
      }
    })()
    for (let i = 0; i < Math.min(REPONSES, questions.length); i++) {
      const q = questions[i]
      const choix = i % 4 === 3 ? (q.bonne + 1) % q.reponses.length : q.bonne
      const fin = await mesurer('série : une réponse', ecarts[i], () => ecrire(banc.url, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix }, cookie))
      if (fin?.finie) break
    }
    await mesurer('duels, après une pause', 20_000, lire('/api/duels'))
    await mesurer('accueil', 8_000, lire('/api/joueur/moi?accueil'))
    const fin = comptes()
    return {
      pas,
      total: Object.fromEntries(Object.entries(fin).map(([k, v]) => [k, (v as number) - (debut as any)[k]])),
    }
  } finally {
    await banc.close()
    faux.fermer()
  }
}

const mediane = (v: number[]) => {
  const t = [...v].sort((a, b) => a - b)
  return t.length ? t[Math.floor(t.length / 2)] : 0
}

const ecarts = Array.from({ length: REPONSES }, unEcart)
console.log(`écarts entre deux réponses (s) : ${ecarts.map(e => (e / 1000).toFixed(1)).join(', ')}`)
const resultats: Record<string, Awaited<ReturnType<typeof partie>>> = {}
for (const avec of [false, true]) {
  const nom = avec ? 'avec l’entretien' : 'sans l’entretien'
  const t = performance.now()
  resultats[nom] = await partie(avec, ecarts)
  console.log(`\n## ${nom} (${Math.round((performance.now() - t) / 1000)} s)`)
  const r = resultats[nom]
  for (const p of r.pas) console.log(`  ${p.quoi.padEnd(26)} après ${String((p.attenteAvantMs / 1000).toFixed(1)).padStart(5)} s : ${String(p.ms).padStart(4)} ms, ${p.allers} aller(s)-retour(s), ${p.ouvertes} connexion(s) ouverte(s)`)
  const reponses = r.pas.filter(p => p.quoi === 'série : une réponse')
  console.log(`  réponses : médiane ${mediane(reponses.map(p => p.ms))} ms, pire ${Math.max(...reponses.map(p => p.ms))} ms ; ${reponses.filter(p => p.ouvertes > 0).length} sur ${reponses.length} ont ouvert une connexion`)
  console.log(`  pages : ${r.pas.filter(p => p.quoi !== 'série : une réponse').map(p => `${p.quoi} ${p.ms} ms`).join(' · ')}`)
  console.log(`  en tout : ${JSON.stringify(r.total)}`)
}
writeFileSync(path.join(DONNEES, 'resultats-chaudes.json'), JSON.stringify({ ecarts, resultats }, null, 2))
process.exit(0)
