// Ce que la page du profil, la pastille de « Profil » et la page des duels
// coûtent à la base permanente — et au processeur du serveur. Le banc du
// 16 octobre 2026, au volume de la production et au dixième de cœur de
// l'hébergeur : chaque aller-retour vers Turso y coûte deux millisecondes de
// processeur (le `fetch`, le décodage du client libsql), l'accueil de quatre
// joueurs à la fois figeait le serveur deux secondes, et Turso, lui,
// répondait vite. La pastille refaisait toute la page du profil — seize
// allers-retours en quatre vagues —, la page relisait ses sentiers quatre fois
// et ses duels deux, et la page des duels décodait les soixante questions de
// chacune de ses onze dernières rencontres. On compte sur le fichier `file:`
// qui tient lieu de Turso, comme `jour-charge.test.ts` : rien ne dépend de la
// charge de la machine.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { VIES } from '../../shared/campagne'
import { FONDS_EN_BOUTIQUE } from '../../shared/fonds'
import { ceQuIlAPorter, nouveautes } from '../../shared/loge'
import { PIECES_DE_LA_LOGE, compteDesNouveautes } from '../../shared/piecesDeLaLoge'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

// ── Le compteur ───────────────────────────────────────────────────────────

/** Ce que la base permanente a servi pendant une mesure : chaque instruction, et ses lignes. */
const compte = { actif: false, appels: 0, finis: 0, lectures: [] as { sql: string; lignes: Record<string, unknown>[] }[] }

const sqlDe = (s: unknown) => (typeof s === 'string' ? s : (s as { sql: string }).sql).replace(/\s+/g, ' ').trim()

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    // Un aller-retour dure au moins un tour de boucle, comme sur le réseau :
    // ce qui part ensemble est en vol ensemble, et le rang d'un appel dit
    // combien d'allers-retours il a attendus (`enSerie`).
    const rang = compte.finis + 1
    if (compte.actif) await new Promise<void>(r => setImmediate(r))
    const res = await origine.apply(this, args)
    if (compte.actif) {
      compte.appels++
      compte.finis = Math.max(compte.finis, rang)
      const instructions = methode === 'batch' ? (args[0] as unknown[]) : [args[0]]
      const resultats = (methode === 'batch' ? res : [res]) as { rows: Record<string, unknown>[] }[]
      resultats.forEach((r, i) => compte.lectures.push({ sql: sqlDe(instructions[i]), lignes: r.rows }))
    }
    return res
  }
}

async function mesurer<T>(travail: () => Promise<T>): Promise<{ appels: number; enSerie: number; lectures: typeof compte.lectures; resultat: T }> {
  Object.assign(compte, { actif: true, appels: 0, finis: 0, lectures: [] })
  try {
    const resultat = await travail()
    return { appels: compte.appels, enSerie: compte.finis, lectures: compte.lectures, resultat }
  } finally {
    compte.actif = false
  }
}

const enClair = (m: { lectures: { sql: string }[] }) => m.lectures.map(l => l.sql.slice(0, 90)).join('\n')

// ── Jeanne, qui a joué ────────────────────────────────────────────────────

const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })
let banc: Banc
let cookie: string

const lire = (chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => {
    const lu = (await r.json()) as any
    assert.equal(r.status, 200, `${chemin} : ${r.status} ${lu.error ?? ''}`)
    return lu
  })

before(async () => {
  banc = await demarrer({ baseDeLaCampagne: BASE, prechauffageCampagneMs: 3_600_000 })
  cookie = await inscrireProfil(banc.url, 'jeanne', 'Jeanne')
  const id = (await lire('/api/joueur/moi?leger')).profile.id as string
  // Ce qu'elle a, écrit dans la base permanente : un thème et un fond achetés,
  // deux sentiers commencés — deux portraits —, deux trophées, et douze duels
  // au dé finis, chacun ses soixante questions gardées, comme en production.
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const t = Date.now() - 86400_000
    db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, ?)').run(id, 'jungle', t)
    db.prepare('INSERT INTO profile_fonds (profile_id, fond, prix, created_at) VALUES (?, ?, 0, ?)').run(id, FONDS_EN_BOUTIQUE[0].key, t)
    const acquis = db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)')
    acquis.run(id, 'foret', 4, t)
    acquis.run(id, 'mythes', 2, t)
    const badge = db.prepare('INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    badge.run(id, 'hf:phenix', 's1', '', '🔥', 'Le Phénix', t)
    badge.run(id, 'hf:bavard:1', 's1', '', '💬', 'Le Bavard', t)
    const questions = JSON.stringify(BASE.questions.slice(0, 60).map(q => ({ id: q.id, texte: q.texte, reponses: q.reponses, bonne: q.bonne, categorie: q.meta.categorie, anecdote: q.anecdote, niveau: 'facile' })))
    const rencontre = db.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'rencontre', ?)`,
    )
    for (let i = 0; i < 12; i++) {
      const justes = 6 + (i % 4)
      const adversaire = { serie: randomUUID(), profil: '', simule: true, reponses: [...Array(7).fill(true), ...Array(VIES).fill(false)] }
      rencontre.run(randomUUID(), id, questions, justes + VIES, justes, t + i * 60_000, t + i * 60_000 + 30_000, JSON.stringify(adversaire))
    }
  } finally {
    db.close()
  }
  // Ses trophées entrent en mémoire avec son profil, au réveil.
  await banc.redemarrer()
})

after(() => banc.close())

// ── La pastille de « Profil » ─────────────────────────────────────────────

test('la pastille de « Profil » se compte d’une seule vague, sans refaire la page — et compte ce que la page compterait', async () => {
  // Rien de vu dans aucune pièce : tout ce qu'elle a est neuf, chaque clé se compte.
  const vide = Object.fromEntries(PIECES_DE_LA_LOGE.map(p => [p.id, []]))
  assert.equal((await ecrire(banc.url, '/api/joueur/vus', { vus: vide }, cookie, 'PUT')).status, 200)
  // La nuit close, son profil en mémoire, comme sur un serveur réveillé depuis un moment.
  await lire('/api/joueur/nouveautes')
  const m = await mesurer(() => lire('/api/joueur/nouveautes'))
  assert.equal(m.enSerie, 1, `${m.enSerie} allers-retours l’un derrière l’autre :\n${enClair(m)}`)
  assert.ok(m.appels <= 5, `${m.appels} allers-retours — la page entière en faisait seize :\n${enClair(m)}`)

  // Le même compte que la règle de la loge sur le détail de sa page.
  const detail = (await lire('/api/joueur/moi')).profile
  assert.deepEqual(m.resultat, compteDesNouveautes(nouveautes(ceQuIlAPorter(detail), detail.vusDeLaLoge)))
  // Et elle a de quoi compter, pièce par pièce : ses portraits et sa bordure, ses titres et sa vitrine, son fond, ses thèmes.
  for (const piece of ['avatar', 'titre', 'vitrine', 'fond', 'theme'] as const) assert.ok((m.resultat.pieces[piece] ?? 0) > 0, `${piece} : ${JSON.stringify(m.resultat)}`)
  assert.ok(detail.bordures?.length > 0, 'une bordure de ligue, de ses duels')
})

// ── La page du profil ─────────────────────────────────────────────────────

test('la page du profil lit ses sentiers et ses duels une fois, d’un seul lot avec ses confettis de campagne', async () => {
  await lire('/api/joueur/moi')
  const m = await mesurer(() => lire('/api/joueur/moi'))
  const sentiers = m.lectures.filter(l => /FROM sentier_acquis/.test(l.sql))
  const duels = m.lectures.filter(l => /ses_justes/.test(l.sql))
  assert.equal(sentiers.length, 1, `ses sentiers lus ${sentiers.length} fois :\n${enClair(m)}`)
  assert.equal(duels.length, 1, `ses duels lus ${duels.length} fois :\n${enClair(m)}`)
  assert.ok(m.appels <= 12, `${m.appels} allers-retours — seize avant :\n${enClair(m)}`)
  // Ce qu'elle en voit ne change pas : ses portraits, son solde, sa bordure.
  const { profile } = m.resultat
  assert.deepEqual(profile.sentiers, { foret: 4, mythes: 2 })
  assert.ok(profile.boutique.possedes.includes('jungle'))
  assert.ok(profile.bordures.length > 0)
})

test('l’accueil lit ses sentiers une fois pour son solde, et une fois pour son bouton', async () => {
  await lire('/api/joueur/moi?accueil')
  const m = await mesurer(() => lire('/api/joueur/moi?accueil'))
  const sentiers = m.lectures.filter(l => /FROM sentier_acquis/.test(l.sql))
  assert.ok(sentiers.length <= 2, `ses sentiers lus ${sentiers.length} fois :\n${enClair(m)}`)
  assert.equal(m.enSerie, 1, enClair(m))
})

// ── La page des duels ─────────────────────────────────────────────────────

test('la page des duels ne décode pas les questions de ses rencontres finies', async () => {
  await lire('/api/duels')
  const m = await mesurer(() => lire('/api/duels'))
  const rencontres = m.lectures.find(l => /mode = 'rencontre' ORDER BY commencee_le DESC LIMIT/.test(l.sql))
  assert.ok(rencontres, enClair(m))
  assert.ok(rencontres.lignes.length > 0)
  // Soixante questions par rencontre, vingt kilo-octets en production : seule une rencontre en route en a besoin.
  for (const r of rencontres.lignes) {
    if (r.finie_le !== null) assert.ok(r.questions === '[]', `une rencontre finie relit ses questions (${String(r.questions).length} caractères)`)
  }
  // La page n'en dit pas moins : ses dix dernières, leur score, et sa cote.
  assert.equal(m.resultat.dernieres.length, 10)
  assert.deepEqual(
    m.resultat.dernieres.map((d: any) => d.justes),
    Array.from({ length: 10 }, (_, i) => 6 + ((11 - i) % 4)),
  )
  assert.equal(m.resultat.joues, 12)
})
