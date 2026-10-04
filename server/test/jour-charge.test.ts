// Le quiz du jour sur Turso : ce qu'une visite coûte à la base permanente.
//
// L'audit du 27 septembre 2026 (`retours/2026-09-27/`, axe 14) : au réveil de
// l'hébergeur, les joueurs d'hier se chargeaient un par un — trois
// allers-retours chacun, huit à la fois —, sous le verrou de la nuit que
// l'accueil attend aussi [perf-serveur-1] ; et l'accueil d'un profil
// relisait les points de tous les joueurs de ses trente derniers jours, à
// chaque visite [perf-serveur-3]. En production, chaque `execute` et chaque
// `batch` est un aller-retour HTTP vers Turso (20 à 80 ms) : on les compte
// sur le fichier `file:` qui en tient lieu. Rien ne dépend de la charge de la
// machine.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { connexionAnimateur, demarrer, ecrire, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { JourStore } from '../src/core/jour'
import { jourAvant, jourDe } from '../../shared/jour'

ProfileStore.tirageEclat = () => false

// ── Le compteur ───────────────────────────────────────────────────────────

/** Ce que la base permanente a servi pendant une mesure. */
const compte = { actif: false, appels: 0, lignes: 0, unParUn: 0, tirages: 0 }

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    const res = await origine.apply(this, args)
    if (compte.actif) {
      compte.appels++
      const lots = (methode === 'batch' ? res : [res]) as { rows: unknown[] }[]
      for (const l of lots) compte.lignes += l.rows.length
      const premiere = (methode === 'batch' ? (args[0] as unknown[])[0] : args[0]) as string | { sql: string }
      const sql = typeof premiere === 'string' ? premiere : premiere.sql
      if (sql.startsWith('SELECT * FROM profiles WHERE id = ?')) compte.unParUn++
      if (sql.startsWith('SELECT questions, annulees FROM jour_tirages')) compte.tirages++
    }
    return res
  }
}

async function mesurer(travail: () => Promise<unknown>): Promise<{ appels: number; lignes: number; unParUn: number; tirages: number }> {
  Object.assign(compte, { actif: true, appels: 0, lignes: 0, unParUn: 0, tirages: 0 })
  try {
    await travail()
    return { appels: compte.appels, lignes: compte.lignes, unParUn: compte.unParUn, tirages: compte.tirages }
  } finally {
    compte.actif = false
  }
}

// ── Un serveur qui a vécu ─────────────────────────────────────────────────

/** Dimanche 27 septembre 2026, 19 h à Paris. */
const SOIR = Date.UTC(2026, 8, 27, 17, 0)
const AUJOURDHUI = '2026-09-27'
const JOUEURS = 60
const JOURS = 30

/**
 * Soixante profils qui ont tous joué les trente derniers jours, écrits
 * directement dans la base permanente : la veille n'est pas close, la
 * première demande du jour la clôt.
 */
function peupler(fichier: string): { ids: string[]; cookie: (id: string) => string } {
  const db = new Database(fichier)
  const ids = Array.from({ length: JOUEURS }, (_, i) => `charge-${String(i).padStart(3, '0')}`)
  const jetons = new Map(ids.map((id, i) => [id, `jetoncharge${String(i).padStart(3, '0')}${'x'.repeat(28)}`]))
  const avant = SOIR - 200 * 86400_000
  db.transaction(() => {
    const profil = db.prepare(`INSERT INTO profiles (id, login, name, avatar, finition, password_hash, recovery_hash, xp, created_at, last_seen_at)
                               VALUES (?, ?, ?, '🦊', 'auto', 'x', 'x', 0, ?, ?)`)
    const session = db.prepare(`INSERT INTO profile_sessions (id, profile_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, 'charge')`)
    ids.forEach((id, i) => {
      profil.run(id, `charge${i}`, `Joueur ${i}`, avant, avant)
      session.run(createHash('sha256').update(jetons.get(id)!).digest('hex'), id, avant, SOIR + 300 * 86400_000, avant)
    })
    const tirage = db.prepare(`INSERT INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', ?)`)
    const partie = db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp)
                               VALUES (?, ?, ?, 10, NULL, ?, 6, ?, 30)`)
    const cloture = db.prepare(`INSERT INTO jour_clotures (jour, joueurs, close_le) VALUES (?, ?, ?)`)
    for (let k = JOURS; k >= 1; k--) {
      const jour = jourAvant(AUJOURDHUI, k)
      const debut = SOIR - k * 86400_000
      const questions = Array.from({ length: 10 }, (_, q) => ({
        reserveId: `res-${jour}-${q}`,
        texte: `Question ${q + 1} du ${jour} ?`,
        reponses: ['Oui', 'Non', 'Peut-être', 'Jamais'],
        bonne: q % 4,
        categorie: 'Culture générale',
        duree: 20,
        lectureMs: 3000,
      }))
      tirage.run(jour, JSON.stringify(questions), debut - 3600_000)
      ids.forEach((id, i) => partie.run(id, jour, debut + i * 1000, ((i * 37 + k * 11) % 20) * 100, debut + i * 1000 + 250_000))
      if (k >= 2) cloture.run(jour, JOUEURS, debut + 86400_000)
    }
  })()
  db.close()
  return { ids, cookie: id => `qz_joueur=${jetons.get(id)}` }
}

let banc: Banc
let gens: ReturnType<typeof peupler>
const poster = (chemin: string, cookie: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => {
    const lu = (await r.json()) as any
    assert.equal(r.status, 200, `${chemin} : ${lu.error}`)
    return lu
  })
const lire = (chemin: string, cookie: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => {
    assert.equal(r.status, 200, `${chemin} : ${r.status}`)
    return r.json() as Promise<any>
  })

before(async () => {
  banc = await demarrer({ horlogeDuJour: () => SOIR })
  gens = peupler(banc.quizDbUrl.replace(/^file:/, ''))
  await banc.redemarrer()
  // La nuit d'hier se clôt une fois pour toutes.
  await lire('/api/jour', gens.cookie(gens.ids[0]))
})

after(() => banc.close())

// ── Au réveil ─────────────────────────────────────────────────────────────

test('au réveil, le quiz du jour charge les joueurs d’hier d’un coup, pas un par un', async () => {
  // La mémoire des profils repart vide à chaque sommeil de l'hébergeur, et
  // le podium d'hier se relit à la première visite — l'accueil l'attend.
  await banc.redemarrer()
  const m = await mesurer(() => lire('/api/jour', gens.cookie(gens.ids[0])))
  // Le visiteur se charge lui-même, par sa session ; les joueurs d'hier, d'un coup.
  assert.ok(m.unParUn <= 1, `${m.unParUn} profils chargés un par un`)
  // Quelques allers-retours, quel que soit le nombre de joueurs d'hier : trois par joueur, avant.
  assert.ok(m.appels <= 25, `${m.appels} allers-retours vers la base permanente (${JOUEURS} joueurs hier)`)
})

test('au réveil, le classement du mois charge ses joueurs d’un coup', async () => {
  await banc.redemarrer()
  const m = await mesurer(() => lire('/api/jour/classement?mois=2026-09', gens.cookie(gens.ids[0])))
  assert.ok(m.unParUn <= 1, `${m.unParUn} profils chargés un par un`)
  assert.ok(m.appels <= 25, `${m.appels} allers-retours`)
})

// ── L'accueil ─────────────────────────────────────────────────────────────

test('l’accueil d’un profil ne relit pas les points de toute la salle de ses trente derniers jours', async () => {
  // Une première visite (d'un autre) peut lire ces jours une fois : c'est la
  // suivante qu'on compte.
  const premiere = await lire('/api/joueur/moi', gens.cookie(gens.ids[1]))
  const m = await mesurer(() => lire('/api/joueur/moi', gens.cookie(gens.ids[2])))
  assert.ok(m.lignes <= 400, `${m.lignes} lignes rendues par la base (${JOUEURS} joueurs × ${JOURS} jours)`)
  // Et la place de chaque jour reste celle du classement de ce jour-là.
  const jours = premiere.profile.jour.jours as { jour: string; rang: number; joueurs: number; points: number }[]
  assert.equal(jours.length, JOURS)
  for (const j of jours) {
    const k = Math.round((Date.parse(`${AUJOURDHUI}T12:00:00Z`) - Date.parse(`${j.jour}T12:00:00Z`)) / 86400_000)
    const points = Array.from({ length: JOUEURS }, (_, i) => ((i * 37 + k * 11) % 20) * 100)
    assert.equal(j.joueurs, JOUEURS, j.jour)
    assert.equal(j.rang, 1 + points.filter(p => p > j.points).length, `${j.jour} : rang partagé, un de plus que ceux devant`)
  }
})

test('un profil masqué quitte les places tout de suite, sans relire la base', async () => {
  const avant = (await lire('/api/joueur/moi', gens.cookie(gens.ids[3]))).profile.jour.jours as { jour: string; joueurs: number }[]
  const admin = await connexionAnimateur(banc.url)
  const r = await ecrire(banc.url, '/api/admin/jour/masquer', { profileId: gens.ids[4], masque: true }, admin)
  assert.equal(r.status, 200)
  const apres = (await lire('/api/joueur/moi', gens.cookie(gens.ids[3]))).profile.jour.jours as { jour: string; joueurs: number }[]
  assert.equal(apres[0].joueurs, avant[0].joueurs - 1, 'le masqué ne compte plus')
  // Lui se voit toujours.
  const lui = (await lire('/api/joueur/moi', gens.cookie(gens.ids[4]))).profile.jour.jours as { joueurs: number }[]
  assert.equal(lui[0].joueurs, avant[0].joueurs)
})

// ── L'ouverture de la page ────────────────────────────────────────────────

test('le quiz du jour et la campagne s’ouvrent sur le profil léger, sans aller-retour', async () => {
  // Les deux pages lisaient le détail du profil — historique, hauts faits,
  // boutique : huit allers-retours —, et n'ouvraient leur partie qu'après,
  // pour un thème et un niveau.
  const cookie = gens.cookie(gens.ids[30])
  const detail = await lire('/api/joueur/moi', cookie)
  let leger: any
  const m = await mesurer(async () => {
    leger = await lire('/api/joueur/moi?leger', cookie)
  })
  assert.equal(m.appels, 0, `${m.appels} allers-retours pour le profil léger`)
  for (const cle of ['id', 'name', 'avatar', 'niveau', 'acquis', 'requis', 'finition', 'legendaire', 'theme', 'laurier']) {
    assert.deepEqual(leger.profile[cle], detail.profile[cle], cle)
  }
  assert.equal(leger.profile.soirees, undefined, 'sans l’historique de ses soirées')
  assert.deepEqual(await fetch(`${banc.url}/api/joueur/moi?leger`).then(r => r.json()), { profile: null }, 'sans profil')
  for (const page of ['JourApp', 'CampagneApp']) {
    const source = readFileSync(new URL(`../../client/src/views/${page}.tsx`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /\.moi\(\)/, `${page} ne lit plus le détail du profil`)
  }
})

// ── Une partie, une annulation ────────────────────────────────────────────

test('une réponse ne relit pas le tirage, et lit sa révélation dans le lot qui l’écrit', async () => {
  // Six allers-retours en série sous les doigts du joueur, dont le tirage
  // du jour — cinq kilo-octets — relu à chaque geste [perf-serveur-4].
  const cookie = gens.cookie(gens.ids[10])
  const etat = await poster('/api/jour/commencer', cookie)
  const m = await mesurer(() => poster('/api/jour/repondre', cookie, { jour: AUJOURDHUI, index: etat.question.index, choix: 0 }))
  assert.equal(m.tirages, 0, 'le tirage du jour est en mémoire')
  assert.ok(m.appels <= 3, `${m.appels} allers-retours pour une réponse`)
  const suivante = await mesurer(() => poster('/api/jour/suivante', cookie))
  assert.equal(suivante.tirages, 0)
})

test('« Annuler pour tous » ne relit pas le tirage pour chaque joueur, et chacun est recompté', async () => {
  // Une fois par joueur, sous son verrou : 501 lectures du tirage pour cinq
  // cents joueurs, au-delà des vingt secondes de la page d'administration
  // [perf-serveur-5].
  const joueurs = gens.ids.slice(20, 26)
  const bonne = () =>
    JSON.parse(
      (new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true }).prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(AUJOURDHUI) as {
        questions: string
      }).questions,
    )[0].bonne as number
  for (const id of joueurs) {
    const etat = await poster('/api/jour/commencer', gens.cookie(id))
    assert.equal(etat.question.index, 0)
    const r = await poster('/api/jour/repondre', gens.cookie(id), { jour: AUJOURDHUI, index: 0, choix: bonne() })
    assert.ok(r.points > 0, 'la première question trouvée paie')
  }
  const admin = await connexionAnimateur(banc.url)
  const m = await mesurer(async () => {
    const r = await ecrire(banc.url, '/api/admin/jour/annuler', { jour: AUJOURDHUI, index: 0 }, admin)
    assert.equal(r.status, 200)
  })
  assert.ok(m.tirages <= 1, `le tirage relu ${m.tirages} fois pour ${joueurs.length} joueurs`)
  // Recomptés sur le tirage qui porte l'annulation : la question 0 ne paie plus.
  for (const id of joueurs) assert.equal((await lire('/api/jour', gens.cookie(id))).points, 0, id)
})

// ── La course ─────────────────────────────────────────────────────────────

test('des profils chargés d’un coup n’écrasent pas celui qui a changé pendant l’aller-retour', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-charge-'))
  const url = `file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`
  const profils = new ProfileStore(url)
  const froid = new ProfileStore(url)
  try {
    await profils.init()
    const { profile: alice } = await profils.register({ login: 'alice', password: 'motdepasse1', name: 'Alice', avatar: '🦊' })
    const { profile: bob } = await profils.register({ login: 'bob', password: 'motdepasse1', name: 'Bob', avatar: '🐻' })
    // Un magasin à froid, comme au réveil, dont la lecture groupée traîne.
    await froid.init()
    const client = (froid as any).client
    const batch = client.batch.bind(client)
    let lacher!: () => void
    const retenue = new Promise<void>(r => (lacher = r))
    client.batch = async (...args: unknown[]) => {
      const res = await batch(...args)
      if (JSON.stringify(args[0]).includes('FROM profiles WHERE id IN')) await retenue
      return res
    }
    const enVol = froid.byIds([alice.id, bob.id, 'inconnu'])
    // Pendant l'aller-retour, Alice change d'emoji : son profil arrive en
    // mémoire, à jour.
    await froid.update(alice.id, { avatar: '🐸' })
    lacher()
    const [a, b, personne] = await enVol
    assert.equal(froid.cached(alice.id)?.avatar, '🐸', 'la ligne lue avant le changement n’écrase pas le profil à jour')
    assert.equal(a?.avatar, '🐸')
    assert.equal(b?.name, 'Bob')
    assert.equal(personne, null)
  } finally {
    froid.close()
    profils.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── Le laurier, à chaque instantané ───────────────────────────────────────

test('le laurier ne recalcule pas le jour de Paris à chaque profil, et le jour change à minuit pile', async () => {
  // `laureats()` est lu pour chaque profil de chaque instantané : `Intl`
  // à chaque appel, deux millisecondes par instantané de cinq cents
  // profils [jour-regles-14].
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-charge-'))
  const url = `file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`
  // Samedi 24 octobre 2026, 23 h 30 à Paris, la veille du passage à l'heure d'hiver.
  const horloge = { t: Date.UTC(2026, 9, 24, 21, 30) }
  const profils = new ProfileStore(url)
  const jour = new JourStore(url, undefined, { profiles: profils, maintenant: () => horloge.t })
  const intl = Intl.DateTimeFormat.prototype
  const formatToParts = intl.formatToParts
  try {
    await profils.init()
    await jour.init()
    let appels = 0
    intl.formatToParts = function (this: Intl.DateTimeFormat, ...args: Parameters<Intl.DateTimeFormat['formatToParts']>) {
      appels++
      return formatToParts.apply(this, args)
    }
    for (let i = 0; i < 500; i++) jour.laureats()
    intl.formatToParts = formatToParts
    assert.ok(appels <= 1, `le jour de Paris calculé ${appels} fois pour 500 lectures du laurier`)
    await (jour as any).lauriersEnRoute
    const joursA = (t: number): { aujourdhui: string; hier: string } => {
      horloge.t = t
      const { aujourdhui, hier } = (jour as any).joursDeLHeure()
      return { aujourdhui, hier }
    }
    // Minuit à Paris : à l'heure d'été, 22 h UTC ; à l'heure d'hiver, 23 h UTC.
    assert.deepEqual(joursA(Date.UTC(2026, 9, 24, 21, 59, 59, 999)), { aujourdhui: '2026-10-24', hier: '2026-10-23' })
    assert.deepEqual(joursA(Date.UTC(2026, 9, 24, 22, 0)), { aujourdhui: '2026-10-25', hier: '2026-10-24' })
    assert.deepEqual(joursA(Date.UTC(2026, 9, 25, 22, 59, 59, 999)), { aujourdhui: '2026-10-25', hier: '2026-10-24' })
    assert.deepEqual(joursA(Date.UTC(2026, 9, 25, 23, 0)), { aujourdhui: '2026-10-26', hier: '2026-10-25' })
    // Et, sur une année, jamais un autre jour que celui que `jourDe` lit.
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 17 * 60_000 + 1) {
      assert.equal(joursA(t).aujourdhui, jourDe(t), new Date(t).toISOString())
    }
  } finally {
    intl.formatToParts = formatToParts
    jour.close()
    profils.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
