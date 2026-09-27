// `npm run sauvegarde` sur une base permanente BIEN REMPLIE — comptes,
// profils et leur carrière, archives, bibliothèque et photo, programme,
// partage, quiz du jour joué et clos (parties, réponses, podiums,
// signalement, profil masqué, paliers du jour rangés sous le jour), et une
// soirée en cours au miroir — puis restaurée dans une base NEUVE, comme le
// dit MISE-EN-LIGNE.md, et comparée table par table, ligne par ligne,
// valeur et type compris. Enfin, le serveur d'aujourd'hui démarre sur la
// base restaurée, disque effacé : chaque profil s'y relit à l'identique, et
// la soirée en cours revient du miroir restauré.
//
// Base de départ : celle que l'épreuve de migration laisse
// (`../migration/apres-disque-efface/permanente.db`).
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=240000 ../export/evaluations/persistance/sauvegarde/sauvegarde.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createQuizServer } from '../../../../server/src/server'
import { ProfileStore } from '../../../../server/src/auth/profiles'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  ecranCommun,
  ecrire,
  emitAck,
  fermerTout,
  invite,
  lancerQuiz,
  lire,
  lireJson,
  patienter,
  qcm,
} from '../outils'

ProfileStore.tirageEclat = () => false

const ICI = import.meta.dirname
const SERVEUR = path.resolve(ICI, '../../../../server')
const SOURCE = path.resolve(ICI, '../migration/apres-disque-efface/permanente.db')
const avant = JSON.parse(readFileSync(path.resolve(ICI, '../migration/base-avant/avant.json'), 'utf8'))

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)

const poster = (url: string, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function tirage(fichier: string, jour: string): { bonne: number }[] {
  const r = lire<{ questions: string }>(fichier, 'SELECT questions FROM jour_tirages WHERE jour = ?', jour)[0]
  return r ? JSON.parse(r.questions) : []
}

async function jouerLeJour(url: string, fichier: string, cookie: string, juste: (i: number) => boolean) {
  let etat = (await poster(url, cookie, '/api/jour/commencer')).corps
  const questions = tirage(fichier, etat.jour)
  while (etat.question) {
    const i = etat.question.index
    const choix = juste(i) ? questions[i].bonne : (questions[i].bonne + 1) % 2
    const r = await poster(url, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(url, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

/** Toute une base, table par table : chaque ligne avec le type SQLite de chaque valeur. */
function contenu(fichier: string) {
  const db = new Database(fichier, { readonly: true, fileMustExist: true })
  try {
    const objets = db
      .prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name")
      .all() as { type: string; name: string; tbl_name: string; sql: string }[]
    const tables: Record<string, string[]> = {}
    for (const t of objets.filter(o => o.type === 'table')) {
      const colonnes = (db.prepare(`PRAGMA table_info("${t.name}")`).all() as { name: string }[]).map(c => c.name)
      const lecture = colonnes.map(c => `typeof("${c}") || ':' || quote("${c}")`).join(" || '|' || ")
      tables[t.name] = (db.prepare(`SELECT ${lecture || "''"} AS l FROM "${t.name}"`).all() as { l: string }[]).map(r => r.l).sort()
    }
    return { objets, tables }
  } finally {
    db.close()
  }
}

function executer(args: string[]): Promise<{ code: number | null; sortie: string }> {
  return new Promise(resolve => {
    const p = spawn(process.execPath, ['--import', 'tsx', ...args], { cwd: SERVEUR, env: { ...process.env, INIT_CWD: SERVEUR } })
    let sortie = ''
    p.stdout.on('data', d => (sortie += d))
    p.stderr.on('data', d => (sortie += d))
    p.on('close', code => resolve({ code, sortie }))
  })
}

test('la sauvegarde d’une base bien remplie se restaure à l’identique, et le serveur y repart', async () => {
  assert.ok(existsSync(SOURCE), 'lancer d’abord l’épreuve de migration')
  const dir = path.join(ICI, 'travail')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const pleine = path.join(dir, 'pleine.db')
  copyFileSync(SOURCE, pleine)

  // ── 1. Remplir : tout ce que le code d'aujourd'hui écrit dans la base permanente ──
  const horloge = { t: DEBUT }
  let server = await createQuizServer({
    port: 0,
    dbPath: path.join(dir, 'locale.db'),
    quizDbUrl: `file:${pleine}`,
    admin: ADMIN,
    horlogeDuJour: () => horloge.t,
  })
  let url = `http://localhost:${server.port}`
  let vusAvantSauvegarde: Record<string, any> = {}
  try {
    const cookie = await connexionAnimateur(url)
    const { alice, bruno, chloe, david } = avant.profils
    // Le quiz du jour : trois parties, un signalement, un profil masqué.
    await jouerLeJour(url, pleine, alice.cookie, () => true)
    await jouerLeJour(url, pleine, bruno.cookie, i => i % 3 !== 0)
    await jouerLeJour(url, pleine, chloe.cookie, i => i % 2 === 0)
    assert.equal((await poster(url, chloe.cookie, '/api/jour/signaler', { jour: '2026-09-26', index: 0, texte: 'La réponse me semble fausse' })).status, 200)
    const david_ = (await lireJson(url, '/api/joueur/moi', david.cookie)).corps.profile
    assert.equal((await poster(url, cookie, '/api/admin/jour/masquer', { profileId: david_.id, masque: true })).status, 200)
    // Minuit passe : la nuit se clôt à la première demande — podium, expérience, Champion du jour.
    horloge.t += 24 * 3600_000
    assert.equal((await lireJson(url, '/api/jour', alice.cookie)).status, 200)
    await patienter(300)
    // Une photo, un programme, un code de partage.
    const photo = await ecrire(url, '/api/images', { dataUrl: `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 0, 1, 2, 3]).toString('base64')}` }, cookie)
    assert.equal(photo.status, 201, await photo.text())
    const quiz = await creerQuiz(url, cookie, [qcm('Sauvegardée ?'), qcm('Restaurée ?')], 'Le quiz de la sauvegarde')
    assert.equal((await poster(url, cookie, '/api/programmes', { titre: 'Ce soir', entrees: [{ quizId: quiz, multiplicateur: 1 }] })).status, 201)
    assert.equal((await poster(url, cookie, `/api/quizzes/${quiz}/partage`)).status, 201)
    // Une soirée en cours, au miroir : deux invités, une question révélée.
    const host = await ecranCommun(url, cookie)
    const a = await invite(url, 'Alice', '🦊', { cookie: alice.cookie })
    const b = await invite(url, 'Zoé', '🐸')
    const sessionId = await lancerQuiz(host, quiz)
    await attendre<any>(host, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question', 'la question', 15_000)
    for (const j of [a, b]) await emitAck(j.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
    await attendre<any>(host, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'reveal', 'la révélation', 15_000)
    await patienter(2500)
    for (const [cle, p] of Object.entries<any>(avant.profils)) vusAvantSauvegarde[cle] = (await lireJson(url, '/api/joueur/moi', p.cookie)).corps.profile
  } finally {
    fermerTout()
    await server.close()
  }
  const remplie = Object.fromEntries(Object.entries(contenu(pleine).tables).map(([t, l]) => [t, l.length]))
  console.log('base remplie :', remplie)
  for (const t of Object.keys(remplie)) if (!['activations', 'catalogue', 'profile_eclats', 'profile_legendaires', 'profile_niveaux', 'party_bonus', 'party_teams', 'party_soiree'].includes(t)) {
    assert.ok(remplie[t] > 0, `la table ${t} a des lignes à sauvegarder`)
  }

  // ── 2. Sauvegarder, restaurer dans une base neuve ──────────────────────
  const sortie = path.join(dir, 'sauvegardes')
  const r = await executer(['scripts/sauvegarde.ts', `file:${pleine}`, '--out', sortie])
  console.log(r.sortie)
  assert.equal(r.code, 0)
  const fichiers = readdirSync(sortie)
  assert.equal(fichiers.length, 1)
  const restauree = path.join(dir, 'restauree.db')
  const neuve = new Database(restauree)
  neuve.exec(readFileSync(path.join(sortie, fichiers[0]), 'utf8'))
  neuve.close()

  // ── 3. Comparer, table par table, ligne par ligne ─────────────────────
  const a = contenu(pleine)
  const b = contenu(restauree)
  assert.deepEqual(b.objets, a.objets, 'les mêmes tables, index et déclencheurs, au texte près')
  for (const t of Object.keys(a.tables)) {
    assert.equal(b.tables[t]?.length, a.tables[t].length, `autant de lignes dans ${t}`)
    assert.deepEqual(b.tables[t], a.tables[t], `les mêmes lignes dans ${t}, valeurs et types compris`)
  }

  // ── 4. Le serveur repart sur la base restaurée, disque effacé ──────────
  server = await createQuizServer({
    port: 0,
    dbPath: path.join(dir, 'locale-restauree.db'),
    quizDbUrl: `file:${restauree}`,
    admin: ADMIN,
    horlogeDuJour: () => horloge.t,
  })
  url = `http://localhost:${server.port}`
  try {
    for (const [cle, p] of Object.entries<any>(avant.profils)) {
      const vu = (await lireJson(url, '/api/joueur/moi', p.cookie)).corps.profile
      assert.ok(vu, `${cle} se reconnecte sur la base restaurée`)
      for (const champ of ['xp', 'niveau', 'badges', 'legendaires', 'eclats', 'titre']) {
        assert.deepEqual(vu[champ], vusAvantSauvegarde[cle][champ], `${cle} : ${champ}`)
      }
    }
    const host = connecter(url, avant.cookie)
    const hello = await emitAck<any>(host, 'host:hello', {})
    assert.equal(hello.ok, true, 'l’animateur garde sa session')
    await patienter(300)
    const instantane = (host as any)
    void instantane
    const invites = lire<{ n: number }>(path.join(dir, 'locale-restauree.db'), 'SELECT COUNT(*) AS n FROM players')[0].n
    assert.equal(invites, 2, 'la soirée en cours revient du miroir restauré')
  } finally {
    fermerTout()
    await server.close()
  }
})
