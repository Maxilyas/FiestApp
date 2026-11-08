// Le Cabinet de curiosités en production, le 8 novembre 2026 (`../le-cabinet-en-production.md`) : la question du
// propriétaire — « comment il se comporte en prod ? les joueurs sont-ils contents ? faudrait-il augmenter le volume
// de données ? ». En lecture seule, des totaux : chaque profil devient un numéro en mémoire, jamais écrit ; ni nom,
// ni identifiant, ni l'adresse de la base.
//
//   cd server && NODE_USE_ENV_PROXY=1 node --import tsx ../retours/2026-11-08/reproductions/le-cabinet-en-production.ts <quoi>
//
//   traversees   jour par jour, puis chaque traversée finie : son issue, son acte, ses gardiens, sa durée ; où l'on perd
//   joueurs      chaque joueur du Cabinet, anonyme : ses traversées, ses victoires, et s'il joue encore ailleurs
//   jeux         les manches de chaque jeu dans les traversées : réussite, zéro étoile, cœurs perdus, temps, par acte
//   choix        ce qu'ils prennent sur la carte quand ils ont le choix : une préférence révélée, jeu par jeu
//   redites      le contenu déjà posé dans une autre partie, jeu par jeu ; ce que les plus assidus ont vu des réservoirs
//   routes       les routes du Cabinet au relevé de chaque heure (`qg_sante`, huit jours) : appels, temps, erreurs
//   tas          (sans la production) ce que la base livrée donne aux jeux qui y puisent, marche par marche
//
// Jamais `QUIZ_DB_URL` : `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN`, un jeton en lecture seule.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(path.join(RACINE, 'server/package.json'))
const quoi = process.argv[2] ?? 'traversees'

type Ligne = Record<string, unknown>
let client: { execute: (s: string | { sql: string; args: unknown[] }) => Promise<{ rows: Ligne[] }> } | null = null
async function lire(sql: string, args: unknown[] = []): Promise<Ligne[]> {
  if (!/^\s*(SELECT|WITH)\b/i.test(sql)) throw new Error('des SELECT seulement')
  if (!client) {
    const url = process.env.PROD_LECTURE_URL
    const authToken = process.env.PROD_LECTURE_TOKEN
    if (!url || !authToken) throw new Error('PROD_LECTURE_URL et PROD_LECTURE_TOKEN, un jeton en lecture seule — jamais QUIZ_DB_URL')
    const { createClient } = require('@libsql/client')
    client = createClient({ url: url.replace(/^libsql:/, 'https:'), authToken })
  }
  try {
    return (await client!.execute({ sql, args })).rows
  } catch (e) {
    if (String((e as Error)?.message).includes('ENOTFOUND')) throw new Error('hôte introuvable : NODE_USE_ENV_PROXY=1 devant, dans le cloud')
    throw e
  }
}

const JOUR_MS = 86_400_000
const jourDe = (t: number) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(t))
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : '—')
const centile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN
}
const anonymes = () => {
  const n = new Map<unknown, number>()
  return (p: unknown) => (n.has(p) ? n.get(p)! : (n.set(p, n.size), n.size - 1))
}

interface Epreuve { partie: string; jeu: string; acte: number; gardien?: true; etoiles: (number | null)[]; durees?: (number | null)[]; quittee?: true; perdue?: true; vaincu?: true; coeurs?: number }
interface Resume { acte: number; vaincus: string[]; assauts: number[]; epreuves: Epreuve[]; dernier: number | null }
/** Les traversées finies, leur départ (version) et leur résumé (`cabinet_traversees.resume`, `shared/cabinet/resume.ts`). */
async function traverseesFinies() {
  const rows = await lire(`SELECT commencee_le, finie_le, issue, json_extract(depart, '$.v') AS v, resume FROM cabinet_traversees WHERE finie_le IS NOT NULL AND resume IS NOT NULL ORDER BY commencee_le`)
  return rows.map(r => ({ debut: Number(r.commencee_le), fin: Number(r.finie_le), issue: (r.issue as string | null) ?? 'rendue', v: Number(r.v), resume: JSON.parse(String(r.resume)) as Resume }))
}
const ACTES = ['I', 'II', 'III']

if (quoi === 'traversees') {
  const toutes = await lire(`SELECT commencee_le, finie_le, issue, profile_id FROM cabinet_traversees ORDER BY commencee_le`)
  const parJour = new Map<string, { n: number; gagnees: number; perdues: number; abandonnees: number; enRoute: number; joueurs: Set<unknown> }>()
  for (const r of toutes) {
    const j = jourDe(Number(r.commencee_le))
    const x = parJour.get(j) ?? { n: 0, gagnees: 0, perdues: 0, abandonnees: 0, enRoute: 0, joueurs: new Set() }
    x.n++
    x.joueurs.add(r.profile_id)
    if (r.finie_le == null) x.enRoute++
    else if (r.issue === 'gagnee') x.gagnees++
    else if (r.issue === 'perdue') x.perdues++
    else if (r.issue === 'abandonnee') x.abandonnees++
    parJour.set(j, x)
  }
  const epreuves = await lire(`SELECT commencee_le FROM campagne_series WHERE mode = 'cabinet'`)
  const epreuvesDuJour = new Map<string, number>()
  for (const r of epreuves) epreuvesDuJour.set(jourDe(Number(r.commencee_le)), (epreuvesDuJour.get(jourDe(Number(r.commencee_le))) ?? 0) + 1)
  console.log('== Jour par jour (heure de Paris)\njour        commencées  gagnées  perdues  abandonnées  en route  joueurs  épreuves')
  for (const [j, x] of parJour) console.log(`${j}  ${String(x.n).padStart(10)}  ${String(x.gagnees).padStart(7)}  ${String(x.perdues).padStart(7)}  ${String(x.abandonnees).padStart(11)}  ${String(x.enRoute).padStart(8)}  ${String(x.joueurs.size).padStart(7)}  ${String(epreuvesDuJour.get(j) ?? 0).padStart(8)}`)

  const finies = await traverseesFinies()
  console.log('\n== Chaque traversée finie\njour        version  issue        acte  vaincus  épreuves  assauts   minutes')
  for (const t of finies) {
    console.log(`${jourDe(t.debut)}  ${String(t.v).padStart(7)}  ${t.issue.padEnd(11)}  ${ACTES[t.resume.acte].padStart(4)}  ${String(t.resume.vaincus.length).padStart(7)}  ${String(t.resume.epreuves.length).padStart(8)}  ${JSON.stringify(t.resume.assauts).padEnd(8)}  ${((t.fin - t.debut) / 60_000).toFixed(1).padStart(8)}`)
  }
  const v3 = finies.filter(t => t.v >= 3)
  const issues = new Map<string, number>()
  for (const t of v3) issues.set(t.issue, (issues.get(t.issue) ?? 0) + 1)
  console.log(`\n== Depuis la version 3 (le 2 novembre 2026) : ${v3.length} finies — ${[...issues].map(([k, n]) => `${k} ${n} (${pct(n, v3.length)})`).join(', ')}`)
  const ou = new Map<string, number>()
  for (const t of v3.filter(t => t.issue === 'perdue')) {
    const derniere = t.resume.epreuves.at(-1)
    const k = `acte ${ACTES[t.resume.acte]} · ${derniere?.gardien ? 'contre le gardien' : 'à une épreuve'} · ${derniere?.jeu ?? '—'}`
    ou.set(k, (ou.get(k) ?? 0) + 1)
  }
  console.log('Où se perd une traversée (sa dernière épreuve) :')
  for (const [k, n] of [...ou].sort()) console.log(`  ${k.padEnd(48)} ${n}`)
  // D'une traite : commencée et finie dans les trois heures, menée jusqu'à l'acte III.
  const dUneTraite = v3.filter(t => t.resume.acte === 2 && t.fin - t.debut < 3 * 3_600_000)
  const minutes = dUneTraite.map(t => (t.fin - t.debut) / 60_000)
  console.log(`Jusqu'à l'acte III d'une traite : ${dUneTraite.length} traversées, médiane ${centile(minutes, 0.5).toFixed(0)} min (de ${Math.min(...minutes).toFixed(0)} à ${Math.max(...minutes).toFixed(0)}), ${centile(dUneTraite.map(t => t.resume.epreuves.length), 0.5)} épreuves en médiane`)
  const laissees = await lire(`SELECT (SELECT COUNT(*) FROM cabinet_traversee_gestes g WHERE g.traversee_id = t.id) AS gestes FROM cabinet_traversees t WHERE finie_le IS NULL`)
  console.log(`En route : ${laissees.length}, dont ${laissees.filter(r => Number(r.gestes) === 0).length} jamais allées plus loin que le choix des cartes`)
} else if (quoi === 'joueurs') {
  const rows = await lire(`
    WITH t AS (SELECT profile_id, COUNT(*) AS trav, SUM(issue = 'gagnee') AS gagnees, SUM(issue = 'perdue') AS perdues,
                      SUM(issue = 'abandonnee') AS abandonnees, SUM(finie_le IS NULL) AS laissees, MAX(commencee_le) AS derniere
                 FROM cabinet_traversees GROUP BY profile_id)
    SELECT t.trav, t.gagnees, t.perdues, t.abandonnees, t.laissees, t.derniere,
           (SELECT COUNT(*) FROM campagne_series s WHERE s.profile_id = t.profile_id AND s.mode = 'cabinet') AS epreuves,
           (SELECT MAX(commencee_le) FROM campagne_series s WHERE s.profile_id = t.profile_id) AS derniere_activite,
           (SELECT COUNT(*) FROM campagne_series s WHERE s.profile_id = t.profile_id AND s.mode <> 'cabinet' AND s.commencee_le > t.derniere) AS ailleurs_apres
      FROM t ORDER BY t.trav DESC, t.derniere DESC`)
  console.log('traversées  gagnées  perdues  abandonnées  laissées  épreuves  dernière traversée  dernière partie (tous modes)  parties ailleurs depuis')
  for (const r of rows) {
    console.log(`${String(r.trav).padStart(10)}  ${String(r.gagnees ?? 0).padStart(7)}  ${String(r.perdues ?? 0).padStart(7)}  ${String(r.abandonnees ?? 0).padStart(11)}  ${String(r.laissees).padStart(8)}  ${String(r.epreuves).padStart(8)}  ${jourDe(Number(r.derniere)).padStart(18)}  ${jourDe(Number(r.derniere_activite)).padStart(28)}  ${String(r.ailleurs_apres).padStart(23)}`)
  }
  const sansVictoire = rows.filter(r => !Number(r.gagnees))
  console.log(`\n${rows.length} joueurs ; ${sansVictoire.length} sans une traversée gagnée, dont la dernière date du ${sansVictoire.map(r => jourDe(Number(r.derniere))).sort().at(-1)} au plus tard`)
  const actifs = await lire(`SELECT COUNT(DISTINCT profile_id) AS n FROM campagne_series WHERE commencee_le > ?`, [Date.now() - 7 * JOUR_MS])
  console.log(`Profils qui ont joué la campagne (tous modes) ces sept jours : ${actifs[0].n}`)
} else if (quoi === 'jeux') {
  const v3 = (await traverseesFinies()).filter(t => t.v >= 3)
  const parJeu = new Map<string, { epreuves: number; assauts: number; quittees: number; fatales: number; coeurs: number; manches: number[]; durees: number[]; avant: number[]; apres: number[] }>()
  const parActe = new Map<string, number[]>()
  for (const t of v3) {
    const avantLe4 = jourDe(t.debut) <= '2026-11-03'
    for (const e of t.resume.epreuves) {
      const x = parJeu.get(e.jeu) ?? { epreuves: 0, assauts: 0, quittees: 0, fatales: 0, coeurs: 0, manches: [], durees: [], avant: [], apres: [] }
      x.epreuves++
      if (e.gardien) x.assauts++
      if (e.quittee) x.quittees++
      if (e.perdue) x.fatales++
      x.coeurs += e.coeurs ?? 0
      for (const s of e.etoiles) if (s !== null) (x.manches.push(s), (avantLe4 ? x.avant : x.apres).push(s))
      for (const d of e.durees ?? []) if (d !== null) x.durees.push(d / 1000)
      parJeu.set(e.jeu, x)
      const k = `acte ${ACTES[e.acte]} · ${e.gardien ? 'gardien' : 'épreuves'}`
      parActe.set(k, [...(parActe.get(k) ?? []), ...e.etoiles.filter((s): s is number => s !== null)])
    }
  }
  const juste = (xs: number[]) => pct(xs.filter(s => s >= 2).length, xs.length)
  const zero = (xs: number[]) => pct(xs.filter(s => s === 0).length, xs.length)
  console.log(`Les manches des ${v3.length} traversées finies depuis la version 3 — juste : deux étoiles naturelles au moins (\`justeDeLaPiece\`)`)
  console.log('jeu        manches  justes  zéro ★  ★★★   épreuves  assauts  quittées  fatales  cœurs perdus  temps médian  p90   justes jusqu’au 3/11 → depuis')
  for (const [jeu, x] of [...parJeu].sort((a, b) => b[1].manches.length - a[1].manches.length)) {
    console.log(`${jeu.padEnd(9)}  ${String(x.manches.length).padStart(7)}  ${juste(x.manches).padStart(6)}  ${zero(x.manches).padStart(6)}  ${pct(x.manches.filter(s => s === 3).length, x.manches.length).padStart(5)}  ${String(x.epreuves).padStart(8)}  ${String(x.assauts).padStart(7)}  ${String(x.quittees).padStart(8)}  ${String(x.fatales).padStart(7)}  ${String(x.coeurs).padStart(12)}  ${(x.durees.length ? `${centile(x.durees, 0.5).toFixed(0)} s` : '—').padStart(12)}  ${(x.durees.length ? `${centile(x.durees, 0.9).toFixed(0)} s` : '—').padStart(4)}   ${juste(x.avant)} → ${juste(x.apres)}`)
  }
  console.log('\nPar acte :')
  for (const [k, xs] of [...parActe].sort()) console.log(`  ${k.padEnd(22)} ${String(xs.length).padStart(4)} manches, ${juste(xs)} justes, ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)} ★ en moyenne`)
  console.log('\n(Le temps de chaque manche n’est écrit que depuis le 4 novembre 2026.)')
} else if (quoi === 'choix') {
  const traversees = await lire(`SELECT id, depart FROM cabinet_traversees`)
  const tousLesGestes = await lire(`SELECT traversee_id, geste FROM cabinet_traversee_gestes ORDER BY traversee_id, rang`)
  const gestes = new Map<unknown, { quoi: string; etape?: string }[]>()
  for (const r of tousLesGestes) gestes.set(r.traversee_id, [...(gestes.get(r.traversee_id) ?? []), JSON.parse(String(r.geste))])
  interface Etape { id: string; sorte: string; jeu?: string; suivantes?: string[] }
  const propose = new Map<string, number>()
  const pris = new Map<string, number>()
  const nom = (e: Etape) => (e.sorte === 'epreuve' ? e.jeu! : e.sorte)
  for (const r of traversees) {
    const d = JSON.parse(String(r.depart)) as { actes: { etapes: Etape[] }[] }
    const etapes = new Map(d.actes.flatMap(a => a.etapes.map(e => [e.id, e] as const)))
    let ici: Etape | undefined = d.actes[0].etapes.find(e => e.sorte === 'depart')
    for (const g of gestes.get(r.id) ?? []) {
      if ((g.quoi !== 'epreuve' && g.quoi !== 'aller') || !g.etape) continue
      const vers = etapes.get(g.etape)
      if (!vers) continue
      const offertes = (ici?.suivantes ?? []).map(id => etapes.get(id)).filter((e): e is Etape => e !== undefined)
      // Un choix : plusieurs étapes atteignables, et celle qu'il a prise parmi elles.
      if (ici && ici.id !== vers.id && offertes.length > 1 && offertes.some(e => e.id === vers.id)) {
        for (const e of offertes) propose.set(nom(e), (propose.get(nom(e)) ?? 0) + 1)
        pris.set(nom(vers), (pris.get(nom(vers)) ?? 0) + 1)
      }
      ici = vers
      if (vers.sorte !== 'epreuve' && vers.sorte !== 'coffre' && vers.sorte !== 'marchand') {
        // Le gardien : l'acte suivant repart de son départ.
        const acte = Number(vers.id.slice(1, vers.id.indexOf('r')))
        ici = d.actes[acte + 1]?.etapes.find(e => e.sorte === 'depart') ?? ici
      }
    }
  }
  console.log(`${[...pris.values()].reduce((a, b) => a + b, 0)} choix sur la carte\nétape      proposée  prise  taux`)
  for (const [k, n] of [...propose].sort((a, b) => (pris.get(b[0]) ?? 0) / b[1] - (pris.get(a[0]) ?? 0) / a[1])) {
    console.log(`${k.padEnd(9)}  ${String(n).padStart(8)}  ${String(pris.get(k) ?? 0).padStart(5)}  ${pct(pris.get(k) ?? 0, n).padStart(4)}`)
  }
} else if (quoi === 'redites') {
  // Chaque réponse des joueurs du Cabinet, tous modes : ce qu'une pièce a posé (déplié) avait-il déjà été posé à ce
  // joueur dans une autre partie ? Une frise à thème se ramène à sa frise — ses trois manches la jouent, sans redite ;
  // ce qu'une manche a montré de plus (les leurres du Détail, ce que « Changer » a remplacé) compte vu.
  const rows = await lire(`
    SELECT s.profile_id AS p, s.id AS serie, s.mode AS mode, r.reserve_id AS id, r.repondue_le AS le, r.juste AS juste,
           CASE WHEN s.mode = 'cabinet' THEN json_extract(s.questions, '$[' || r.position || '].cabinet.jeu') END AS jeu,
           CASE WHEN s.mode = 'cabinet' THEN json_extract(s.questions, '$[' || r.position || '].cabinet.montre') END AS montre
      FROM campagne_series s JOIN campagne_reponses r ON r.serie_id = s.id
     WHERE s.profile_id IN (SELECT DISTINCT profile_id FROM campagne_series WHERE mode = 'cabinet')`)
  const joueur = anonymes()
  const deplie = (id: string): string[] => {
    for (const p of ['cab:eclair:', 'cab:quiz:', 'cab:frise:s:']) if (id.startsWith(p)) return id.slice(p.length).split('+')
    return id.startsWith('cab:frise:t:') ? [id.slice(0, id.lastIndexOf(':'))] : [id]
  }
  const evenements = rows
    .map(r => ({ j: joueur(r.p), serie: String(r.serie), mode: String(r.mode), id: String(r.id), le: Number(r.le), juste: Number(r.juste), jeu: r.jeu == null ? null : String(r.jeu), montre: r.montre ? (JSON.parse(String(r.montre)) as string[]) : [] }))
    .sort((a, b) => a.le - b.le)
  const vus = new Map<number, Map<string, { le: number; serie: string; joue: boolean }>>()
  const parJeu = new Map<string, { pieces: number; redites: number; dejaJouees: number; leurres: number; sous24h: number; justesR: number; justesN: number }>()
  const parJoueurEtJour = new Map<string, Map<string, number>>()
  for (const e of evenements) {
    const siens = vus.get(e.j) ?? (vus.set(e.j, new Map()), vus.get(e.j)!)
    const contenus = deplie(e.id)
    if (e.mode === 'cabinet' && e.jeu) {
      const x = parJeu.get(e.jeu) ?? { pieces: 0, redites: 0, dejaJouees: 0, leurres: 0, sous24h: 0, justesR: 0, justesN: 0 }
      x.pieces++
      const avant = contenus.map(c => siens.get(c)).filter(v => v !== undefined && v.serie !== e.serie).sort((a, b) => b!.le - a!.le)[0]
      if (avant) {
        x.redites++
        x.justesR += e.juste
        if (avant.joue) x.dejaJouees++
        else x.leurres++
        if (e.le - avant.le < JOUR_MS) x.sous24h++
      } else x.justesN += e.juste
      parJeu.set(e.jeu, x)
      const m = parJoueurEtJour.get(e.jeu) ?? (parJoueurEtJour.set(e.jeu, new Map()), parJoueurEtJour.get(e.jeu)!)
      m.set(`${e.j}|${jourDe(e.le)}`, (m.get(`${e.j}|${jourDe(e.le)}`) ?? 0) + 1)
    }
    for (const c of contenus) siens.set(c, { le: e.le, serie: e.serie, joue: true })
    // Montré de nouveau, il compte vu à cette heure-ci — et joué, s'il l'avait été avant.
    for (const c of e.montre) {
      const avant = siens.get(c)
      if (!avant || avant.le < e.le) siens.set(c, { le: e.le, serie: e.serie, joue: avant?.joue ?? false })
    }
  }
  console.log('jeu        pièces  redites  déjà jouées  leurre seul  < 24 h  justes (redites)  justes (neuves)  manches par jour joué (médiane, pire)')
  for (const [jeu, x] of [...parJeu].sort((a, b) => b[1].pieces - a[1].pieces)) {
    const jours = [...parJoueurEtJour.get(jeu)!.values()]
    console.log(`${jeu.padEnd(9)}  ${String(x.pieces).padStart(6)}  ${`${x.redites} (${pct(x.redites, x.pieces)})`.padStart(7)}  ${String(x.dejaJouees).padStart(11)}  ${String(x.leurres).padStart(11)}  ${String(x.sous24h).padStart(6)}  ${pct(x.justesR, x.redites).padStart(16)}  ${pct(x.justesN, x.pieces - x.redites).padStart(15)}  ${centile(jours, 0.5)}, ${Math.max(...jours)}`)
  }
  // Les réservoirs hors de la base, et ce que les plus assidus en ont vu — joué, ou montré au Détail.
  const reservoirs: [string, string, number][] = [
    ['Détail (tableaux)', 'cab:tableau:', 100],
    ['Indices (fiches)', 'cab:qui:', 66],
    ['Épingle (lieux)', 'cab:lieu:', 90],
    ['Réplique (répliques)', 'cab:replique:', 66],
    ['Frise (frises à thème)', 'cab:frise:t:', 18],
  ]
  console.log('\nréservoir                 taille  vus par les trois plus assidus de ce jeu')
  for (const [nomDuReservoir, prefixe, taille] of reservoirs) {
    const parJoueur = [...vus.values()].map(m => [...m.keys()].filter(c => c.startsWith(prefixe)).length).sort((a, b) => b - a)
    console.log(`${nomDuReservoir.padEnd(24)}  ${String(taille).padStart(6)}  ${parJoueur.slice(0, 3).join(', ')}`)
  }
} else if (quoi === 'routes') {
  const rows = await lire(`SELECT s.heure, s.releve FROM qg_sante s JOIN qg_demarrages d ON d.id = s.demarrage WHERE d.env = 'production' ORDER BY s.heure`)
  const parJour = new Map<string, { n: number; total: number; pire95: number; max: number }>()
  let erreurs = 0
  let erreursDuCabinet = 0
  for (const r of rows) {
    const h = JSON.parse(String(r.releve)) as { parRoute?: { route: string; n: number; p95: number; max: number; totalMs: number }[]; erreurs?: Record<string, number> }
    for (const p of h.parRoute ?? []) {
      if (!p.route.includes('/api/cabinet')) continue
      const k = `${jourDe(Number(r.heure))}  ${p.route}`
      const x = parJour.get(k) ?? { n: 0, total: 0, pire95: 0, max: 0 }
      x.n += p.n
      x.total += p.totalMs
      x.pire95 = Math.max(x.pire95, p.p95)
      x.max = Math.max(x.max, p.max)
      parJour.set(k, x)
    }
    for (const [source, n] of Object.entries(h.erreurs ?? {})) {
      erreurs += Number(n) || 0
      if (source.includes('cabinet')) erreursDuCabinet += Number(n) || 0
    }
  }
  console.log(`${rows.length} heures relevées ; erreurs serveur : ${erreurs}, dont ${erreursDuCabinet} au Cabinet\njour        route                                                  appels  moyenne  pire p95 d’une heure  pire`)
  for (const [k, x] of [...parJour].sort()) console.log(`${k.padEnd(66)}  ${String(x.n).padStart(6)}  ${`${Math.round(x.total / x.n)} ms`.padStart(7)}  ${`${x.pire95} ms`.padStart(20)}  ${x.max} ms`)
} else if (quoi === 'tas') {
  // Sans la production : la base livrée, au crible même des tas (`verdictCalcule`) — un QCM pour le Pari, l'Éclair et
  // le Quiz, un mot pour le Mot mystère, une valeur pour le Filet —, par la difficulté estimée à l'écriture.
  const { lireLaBase } = await import('../../../server/src/core/baseCampagne.ts')
  const { verdictCalcule } = await import('../../../server/src/core/cabinet/tirages/tas.ts')
  const questions = lireLaBase().questions
  const parDifficulte = new Map<number, number[]>()
  const filetParCategorie = new Map<string, number[]>()
  for (const q of questions) {
    const v = verdictCalcule(q)
    const d = Number(q.meta.difficulte ?? 3)
    const x = parDifficulte.get(d) ?? [0, 0, 0, 0]
    x[0]++
    if (v.qcm) x[1]++
    if (v.mot) x[2]++
    if (v.valeur) x[3]++
    parDifficulte.set(d, x)
    if (v.valeur) {
      const c = filetParCategorie.get(String(q.meta.categorie)) ?? [0, 0, 0, 0, 0]
      c[d - 1]++
      filetParCategorie.set(String(q.meta.categorie), c)
    }
  }
  console.log(`${questions.length} questions\ndifficulté  questions  QCM (Pari, Éclair, Quiz)  mots (Mot)  valeurs (Filet)`)
  for (const [d, x] of [...parDifficulte].sort((a, b) => a[0] - b[0])) console.log(`${String(d).padStart(10)}  ${String(x[0]).padStart(9)}  ${String(x[1]).padStart(24)}  ${String(x[2]).padStart(10)}  ${String(x[3]).padStart(15)}`)
  console.log('\nLe Filet, catégorie par catégorie (difficulté 1 à 5)')
  for (const [c, x] of [...filetParCategorie].sort()) console.log(`  ${c.padEnd(20)} ${x.map(n => String(n).padStart(4)).join('')}`)
} else {
  throw new Error(`« ${quoi} » : traversees, joueurs, jeux, choix, redites, routes ou tas`)
}
