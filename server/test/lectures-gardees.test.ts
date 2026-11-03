// Ce que l'accueil garde d'un joueur entre deux visites (`core/lecturesGardees.ts`) : ses épreuves de sentier
// validées et ses bonnes réponses du quiz du jour sur trente jours — les deux plus grosses lectures de chaque accueil
// de la production, 14 % de ce qu'elle lisait au quota de Turso (le 3 novembre 2026). D'abord la règle seule,
// l'horloge à la main ; puis le vrai serveur à la fraîcheur de la production, qui compte ce que chaque accueil
// demande à la base, et ce qu'une réponse lui fait relire.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { InStatement, ResultSet } from '@libsql/client'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { LECTURES_GARDEES_MS, LecturesGardees } from '../src/core/lecturesGardees'
import { ProfileStore } from '../src/auth/profiles'
import { gainVide, releveVide } from '../../shared/profil'

ProfileStore.tirageEclat = () => false

// ── La règle seule ────────────────────────────────────────────────────────

const LECTURE: InStatement = { sql: 'SELECT n FROM t WHERE id = ?', args: ['x'] }
const lu = (...ns: number[]) => ({ rows: ns.map(n => ({ n })) }) as unknown as ResultSet
const gardees = (horloge: { t: number }, auPlus?: number) => new LecturesGardees(60_000, () => horloge.t, lignes => lignes.map(r => Number(r.n)), auPlus)

test('une lecture se garde le temps de sa fraîcheur : la visite suivante ne lit rien, et rend ce que la première a lu', () => {
  const horloge = { t: 0 }
  const g = gardees(horloge)
  const premiere = g.dans('lea', LECTURE)
  assert.equal(premiere.instruction, LECTURE)
  assert.deepEqual(premiere.lue(lu(1, 2)), [1, 2])

  horloge.t += 59_999
  const seconde = g.dans('lea', LECTURE)
  // Une instruction garde sa place dans le lot, et ses voisines la leur : elle ne lit rien.
  assert.notEqual(seconde.instruction, LECTURE)
  assert.match((seconde.instruction as { sql: string }).sql, /^SELECT 1 WHERE 0$/)
  assert.deepEqual(seconde.lue(lu()), [1, 2])
  // Un autre joueur se lit à part.
  assert.equal(g.dans('tom', LECTURE).instruction, LECTURE)

  // Sa fraîcheur passée — l'autre serveur d'une mise en ligne a pu écrire —, elle se relit.
  horloge.t += 1
  assert.equal(g.dans('lea', LECTURE).instruction, LECTURE)
})

test('ce qu’une écriture oublie se relit, et une lecture partie avant elle ne s’installe pas après', () => {
  const g = gardees({ t: 0 })
  g.dans('lea', LECTURE).lue(lu(1))
  g.oublier('lea')
  const relue = g.dans('lea', LECTURE)
  assert.equal(relue.instruction, LECTURE)

  // Partie avant une écriture, revenue après : elle a pu lire l'état d'avant. Elle le rend à qui l'attendait…
  g.oublier('lea')
  assert.deepEqual(relue.lue(lu(1)), [1])
  // … mais ne le garde pas pour la visite suivante.
  assert.equal(g.dans('lea', LECTURE).instruction, LECTURE)
  assert.equal(g.tenues, 0)

  // Partie après, elle se garde.
  g.dans('lea', LECTURE).lue(lu(1, 3))
  assert.deepEqual(g.dans('lea', LECTURE).lue(lu()), [1, 3])
})

test('à fraîcheur nulle, rien ne se garde — le banc, qui écrit dans la base à la main', () => {
  const g = new LecturesGardees(0, () => 0, lignes => lignes.length)
  g.dans('lea', LECTURE).lue(lu(1))
  assert.equal(g.dans('lea', LECTURE).instruction, LECTURE)
  assert.equal(g.tenues, 0)
})

test('seuls les joueurs de la dernière fraîcheur restent en mémoire, jamais plus que la borne', () => {
  const horloge = { t: 0 }
  const g = gardees(horloge, 3)
  for (const id of ['a', 'b', 'c', 'd']) g.dans(id, LECTURE).lue(lu(1))
  assert.equal(g.tenues, 3)
  // Le plus anciennement lu est parti ; les autres restent.
  assert.equal(g.dans('a', LECTURE).instruction, LECTURE)
  assert.notEqual(g.dans('b', LECTURE).instruction, LECTURE)

  // Ce qui a passé sa fraîcheur ne servira plus : l'arrivée suivante le fait partir.
  horloge.t += 60_000
  g.dans('e', LECTURE).lue(lu(1))
  assert.equal(g.tenues, 1)
})

// ── Le vrai serveur, à la fraîcheur de la production ─────────────────────

/** Ce que la base permanente a reçu pendant une mesure : chaque instruction, en texte. */
const compte = { actif: false, sql: [] as string[] }

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    if (compte.actif) {
      const instructions = methode === 'batch' ? (args[0] as unknown[]) : [args[0]]
      for (const i of instructions) compte.sql.push((typeof i === 'string' ? i : (i as { sql: string }).sql).replace(/\s+/g, ' ').trim())
    }
    return origine.apply(this, args)
  }
}

async function mesurer<T>(travail: () => Promise<T>): Promise<{ sql: string[]; resultat: T }> {
  Object.assign(compte, { actif: true, sql: [] })
  try {
    const resultat = await travail()
    return { sql: compte.sql, resultat }
  } finally {
    compte.actif = false
  }
}

/** Ses épreuves validées, telles que ses sentiers les lisent (`lectureDesValidees`). */
const SES_VALIDEES = /^SELECT branche, palier, justes, seuil FROM campagne_series WHERE profile_id = \? AND mode = 'sentier' AND issue = 'validee'$/
/** Ses bonnes réponses de ses trente derniers jours, telles que sa carrière les lit (`lecturesDeLaCarriere`). */
const SES_JUSTES_DU_JOUR = /^SELECT jour, question, ms FROM jour_reponses WHERE profile_id = \? AND juste = 1 AND jour IN/
/** Ce que le quiz du jour sait de lui, catégorie par catégorie (`JourStore.savoirDe`) : sa carte et sa page le lisent. */
const SON_SAVOIR_DU_JOUR = /^SELECT categorie, COUNT\(\*\) AS questions, COUNT\(choix\) AS repondues, SUM\(juste\) AS justes FROM \(SELECT json_extract\(t\.questions/
/** Ses bonnes réponses du jour par catégorie depuis le lundi d'avant, que ses missions jugent (`JourStore.activiteDepuis`). */
const SES_CATEGORIES_DU_JOUR = /^SELECT jour, categorie, COUNT\(\*\) AS n FROM \(SELECT r\.jour AS jour/
const combien = (m: { sql: string[] }, motif: RegExp) => m.sql.filter(s => motif.test(s)).length

let banc: Banc

const lire = (cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => {
    const corps = (await r.json()) as any
    assert.equal(r.status, 200, `${chemin} : ${r.status} ${corps.error ?? ''}`)
    return corps
  })
const poster = (cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => {
    const lu = (await r.json()) as any
    assert.equal(r.status, 200, `${chemin} : ${r.status} ${lu.error ?? ''}`)
    return lu
  })
const accueil = (cookie: string) => mesurer(() => lire(cookie, '/api/joueur/moi?accueil').then(r => r.profile))

/** La bonne réponse d'une question de `baseDEssai` : celle qui commence par « Bonne ». */
const bonneDe = (q: { reponses: string[] }) => q.reponses.findIndex(r => r.startsWith('Bonne'))

/** Les bonnes réponses du tirage d'un jour, lues en base : le téléphone ne les voit jamais. */
const bonnesDuJour = (jour: string) =>
  enBase(db => (JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string }).questions) as { bonne: number }[]).map(q => q.bonne))

/** Sa partie du jour commencée, et sa première question trouvée : rend la partie, et la question jouée. */
async function uneBonneReponseDuJour(cookie: string, suivante = false): Promise<{ jour: string; index: number }> {
  const etat = await poster(cookie, suivante ? '/api/jour/suivante' : '/api/jour/commencer')
  const index = etat.question.index as number
  await poster(cookie, '/api/jour/repondre', { jour: etat.jour, index, choix: bonnesDuJour(etat.jour)[index] })
  return { jour: etat.jour, index }
}

/** La base permanente du banc, lue à part : les bonnes réponses du jour, et ce qui s'y est écrit. */
function enBase<T>(lecture: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return lecture(db)
  } finally {
    db.close()
  }
}

before(async () => {
  // Les lectures gardées comme en ligne : le banc les met à zéro, ses épreuves écrivant dans la base à la main.
  banc = await demarrer({ baseDeLaCampagne: baseDEssai(120, { categories: ['Nature'] }), fraicheurDesLecturesMs: LECTURES_GARDEES_MS })
})

after(() => banc.close())

test('l’accueil garde ses épreuves validées d’une visite à l’autre, et les relit après sa réponse d’épreuve', async () => {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
  // Le premier palier de la forêt, validé sans faute.
  let e = await poster(lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 })
  while (!e.finie && e.question) e = (await poster(lea, `/api/campagne/epreuve/${e.id}/reponse`, { index: e.question.index, choix: bonneDe(e.question) })).epreuve

  const premiere = await accueil(lea)
  const seconde = await accueil(lea)
  assert.equal(combien(seconde, SES_VALIDEES), 0, `relues à la seconde visite :\n${seconde.sql.join('\n')}`)
  // Ce qu'il en voit ne change pas : le sentier qu'il avance, son solde — ses étoiles en confettis.
  assert.equal(premiere.resultat.campagne.avance.branche, 'foret')
  assert.deepEqual(seconde.resultat.campagne, premiere.resultat.campagne)
  assert.equal(seconde.resultat.boutique.solde, premiere.resultat.boutique.solde)

  // Une réponse d'épreuve les change peut-être : la visite suivante les relit, une fois.
  const deux = await poster(lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 2 })
  await poster(lea, `/api/campagne/epreuve/${deux.id}/reponse`, { index: deux.question.index, choix: bonneDe(deux.question) })
  const apres = await accueil(lea)
  assert.equal(combien(apres, SES_VALIDEES), 1, `pas relues après sa réponse :\n${apres.sql.join('\n')}`)
  assert.equal(combien(await accueil(lea), SES_VALIDEES), 0)
})

test('l’accueil garde ses bonnes réponses du quiz du jour d’une visite à l’autre, et les relit après sa bonne réponse', async () => {
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom')
  const id = (await lire(tom, '/api/joueur/moi?leger')).profile.id as string
  await uneBonneReponseDuJour(tom)

  const premiere = await accueil(tom)
  assert.equal(combien(premiere, SES_JUSTES_DU_JOUR), 1, `pas relues après sa bonne réponse :\n${premiere.sql.join('\n')}`)
  const seconde = await accueil(tom)
  assert.equal(combien(seconde, SES_JUSTES_DU_JOUR), 0, `relues à la seconde visite :\n${seconde.sql.join('\n')}`)
  assert.deepEqual(seconde.resultat.jour.jours, premiere.resultat.jour.jours)

  // Sa bonne réponse suivante rejoint ses trente derniers jours : relues, avec elle.
  await uneBonneReponseDuJour(tom, true)
  const apres = await accueil(tom)
  assert.equal(combien(apres, SES_JUSTES_DU_JOUR), 1, `pas relues après sa bonne réponse :\n${apres.sql.join('\n')}`)
  const [aujourdhui] = apres.resultat.jour.jours
  assert.equal(aujourdhui.justes, 2)
  const temps = enBase(db => (db.prepare('SELECT SUM(ms) AS ms FROM jour_reponses WHERE profile_id = ? AND juste = 1').get(id) as { ms: number }).ms)
  assert.equal(aujourdhui.tempsJustesMs, temps)
})

test('sa carte garde ce que le quiz du jour sait de lui jusqu’à sa réponse suivante, et une question annulée pour tous le fait relire à chacun', async () => {
  const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé')
  const carte = () => mesurer(() => lire(zoe, '/api/joueur/carte'))
  const { jour, index } = await uneBonneReponseDuJour(zoe)

  const premiere = await carte()
  assert.equal(combien(premiere, SON_SAVOIR_DU_JOUR), 1, `pas relu après sa réponse :\n${premiere.sql.join('\n')}`)
  const seconde = await carte()
  assert.equal(combien(seconde, SON_SAVOIR_DU_JOUR), 0, `relu à la seconde visite :\n${seconde.sql.join('\n')}`)
  assert.deepEqual(seconde.resultat, premiere.resultat)

  // Sa réponse suivante, même fausse, compte à ce qu'il sait : relu.
  const etat = await poster(zoe, '/api/jour/suivante')
  await poster(zoe, '/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: (bonnesDuJour(etat.jour)[etat.question.index] + 1) % 2 })
  assert.equal(combien(await carte(), SON_SAVOIR_DU_JOUR), 1, 'pas relu après sa mauvaise réponse')
  assert.equal(combien(await carte(), SON_SAVOIR_DU_JOUR), 0)

  // Une question annulée pour tous ne compte plus, ni pour lui ni contre lui : ce que chacun en gardait se relit.
  const admin = await connexionAnimateur(banc.url)
  assert.equal((await ecrire(banc.url, '/api/admin/jour/annuler', { jour, index }, admin)).status, 200)
  assert.equal(combien(await carte(), SON_SAVOIR_DU_JOUR), 1, 'pas relu après l’annulation')
})

test('ses missions gardent ses bonnes réponses du jour par catégorie, et les relisent après sa bonne réponse', async () => {
  const max = await inscrireProfil(banc.url, 'max', 'Max')
  const missions = () => mesurer(() => lire(max, '/api/joueur/missions'))
  await uneBonneReponseDuJour(max)

  const premiere = await missions()
  assert.equal(combien(premiere, SES_CATEGORIES_DU_JOUR), 1, `pas relues après sa bonne réponse :\n${premiere.sql.join('\n')}`)
  const seconde = await missions()
  assert.equal(combien(seconde, SES_CATEGORIES_DU_JOUR), 0, `relues à la seconde visite :\n${seconde.sql.join('\n')}`)
  assert.deepEqual(seconde.resultat.missions, premiere.resultat.missions)

  await uneBonneReponseDuJour(max, true)
  assert.equal(combien(await missions(), SES_CATEGORIES_DU_JOUR), 1, 'pas relues après sa bonne réponse')
})

// ── Le quiz du jour, d'une question à l'autre ────────────────────────────

/** Sa série, telle que sa vue la lit : ses sabliers en sont, d'une instruction à part ou dans l'union (`lectureDeLaSerie`). */
const SA_SERIE = /FROM profile_sabliers WHERE profile_id = \? AND created_at >= \?/
/** Le classement du jour, relu en entier (`lireClassement`). */
const LE_CLASSEMENT = /^SELECT profile_id, points, finie_le, commencee_le FROM jour_parties WHERE jour = \?$/

test('« Question suivante » ne relit pas sa série : elle se garde, jusqu’au sablier qu’il achète', async () => {
  // Chaque question relisait ses 400 derniers jours, ses soirées et ses sabliers (`contexteDeVue`), dix fois par partie.
  const ana = await inscrireProfil(banc.url, 'ana', 'Ana')
  const id = (await lire(ana, '/api/joueur/moi?leger')).profile.id as string
  const debut = await poster(ana, '/api/jour/commencer')
  await poster(ana, '/api/jour/repondre', { jour: debut.jour, index: debut.question.index, choix: bonnesDuJour(debut.jour)[debut.question.index] })
  const suivante = await mesurer(() => poster(ana, '/api/jour/suivante'))
  assert.equal(combien(suivante, SA_SERIE), 0, `relue à la question suivante :\n${suivante.sql.join('\n')}`)
  // Elle dit ce qu'elle disait au début de sa partie, lue alors après l'avoir commencée.
  assert.deepEqual([suivante.resultat.serie, suivante.resultat.serieTenue, suivante.resultat.sabliers], [debut.serie, debut.serieTenue, debut.sabliers])

  // Un sablier acheté compte à sa série : sa vue suivante la relit, avec lui.
  const admin = await connexionAnimateur(banc.url)
  assert.equal((await ecrire(banc.url, `/api/admin/profils/${id}/confettis`, { confettis: 100 }, admin)).status, 200)
  await poster(ana, '/api/jour/sablier', { nombre: 1 })
  const apres = await mesurer(() => lire(ana, '/api/jour'))
  assert.equal(combien(apres, SA_SERIE), 1, `pas relue après le sablier :\n${apres.sql.join('\n')}`)
  assert.equal(apres.resultat.sabliers, 1)
})

test('chaque soirée créditée, remise au barème ou retirée le dit au quiz du jour, qui relit sa série gardée', async () => {
  // Une soirée compte à sa série comme une partie du jour : gardée par-dessus, la vue dirait « en danger » le soir même.
  const dossier = mkdtempSync(path.join(tmpdir(), 'serie-du-jour-'))
  const profils = new ProfileStore(`file:${path.join(dossier, 'profils.db')}`)
  await profils.init()
  const dits: string[] = []
  profils.serieChangee = profileId => dits.push(profileId)
  try {
    const { profile } = await profils.register({ login: 'eli', password: 'motdepasse1', name: 'Éli', avatar: '🦊' })
    const soiree = { spaceId: 'salon', gain: gainVide(), releve: releveVide(), xp: 10 }
    const gestes: [string, () => Promise<unknown>][] = [
      ['une soirée créditée', () => profils.creditSoiree({ profileId: profile.id, soireeId: 's1', ...soiree })],
      ['une soirée close d’un lot', () => profils.crediterSoireeEntiere('s2', 'salon', [{ profileId: profile.id, ...soiree }])],
      ['une soirée remise au barème', () => profils.remettreAuBareme(profile.id, 's1')],
      ['une soirée retirée', () => profils.retirerSoiree(profile.id, 's2')],
      ['une soirée effacée', () => profils.retirerSoireeEntiere('s1', 'salon')],
    ]
    for (const [quoi, geste] of gestes) {
      dits.length = 0
      await geste()
      assert.ok(dits.includes(profile.id), `${quoi} : le quiz du jour n’en sait rien`)
    }
  } finally {
    profils.close()
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('le classement du jour suit en mémoire chaque partie et chaque réponse : la vue suivante des autres ne relit pas toutes les parties du jour', async () => {
  // Chaque réponse de n'importe qui le faisait relire en entier à la vue suivante de chacun : à cent joueurs, quinze
  // relectures de cent lignes par seconde.
  const eva = await inscrireProfil(banc.url, 'eva', 'Éva')
  const noe = await inscrireProfil(banc.url, 'noe', 'Noé')
  const evaId = (await lire(eva, '/api/joueur/moi?leger')).profile.id as string
  const { jour } = await uneBonneReponseDuJour(eva)
  // Noé arrive, puis répond : chaque fois, le jour bouge.
  await uneBonneReponseDuJour(noe)
  const vue = await mesurer(() => poster(eva, '/api/jour/suivante'))
  assert.equal(combien(vue, LE_CLASSEMENT), 0, `relu après l’arrivée et la réponse de Noé :\n${vue.sql.join('\n')}`)

  // Ce qu'elle en voit est ce que la base dit : sa place, le nombre de joueurs, l'écart avec qui la précède.
  const parties = enBase(db => db.prepare('SELECT profile_id AS id, points FROM jour_parties WHERE jour = ?').all(jour) as { id: string; points: number }[])
  const siens = parties.find(p => p.id === evaId)!.points
  const devant = parties.filter(p => p.points > siens).map(p => p.points)
  assert.equal(vue.resultat.joueurs, parties.length)
  assert.equal(vue.resultat.rang, 1 + devant.length)
  assert.equal(vue.resultat.devant?.ecart, devant.length > 0 ? Math.min(...devant) - siens : undefined)

  // Gardé d'une réponse à l'autre, il ne se relit plus de lui-même : un profil suspendu le quitte quand même, à la vue
  // suivante — la base le tait (`byIds`), le classement gardé aussi —, et y revient réactivé.
  const admin = await connexionAnimateur(banc.url)
  const noeId = (await lire(noe, '/api/joueur/moi?leger')).profile.id as string
  assert.equal((await ecrire(banc.url, `/api/admin/profils/${noeId}/suspendre`, {}, admin)).status, 200)
  assert.equal((await lire(eva, '/api/jour')).joueurs, parties.length - 1, 'le suspendu compte encore au classement gardé')
  assert.equal((await ecrire(banc.url, `/api/admin/profils/${noeId}/reactiver`, {}, admin)).status, 200)
  assert.equal((await lire(eva, '/api/jour')).joueurs, parties.length, 'le réactivé ne revient pas au classement gardé')
})
