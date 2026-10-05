// L'Éclat hors des soirées (le choix du 5 octobre 2026) : une chance sur
// quarante à chaque partie finie du quiz du jour, une sur vingt à la
// tentative finie du défi de la semaine. Il ne tombait qu'en soirée.
//
// Ce qui doit tenir : un seul tirage par partie — jamais pendant, jamais au
// rechargement —, rien en campagne, qui se rejoue à volonté ; une fin qui le
// dit, et le redit ; La Pluie d'Éclats qui tombe là où il tombe, sans
// compter l'Éclat d'une soirée qui se joue encore. Chaque test échouait
// avant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  attendre,
  baseDEssai,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore, cleDuDefi, cleDuJour } from '../src/auth/profiles'
import { CHANCE_ECLAT, CHANCE_ECLAT_DU_DEFI, CHANCE_ECLAT_DU_JOUR } from '../../shared/profil'
import { XP_PALIER } from '../../shared/hautsfaits'

// Le hasard ne décide de rien ici : chaque test dit ce que le tirage rend.
ProfileStore.tirageEclat = () => false

/** Mardi 6 octobre 2026, 10 h à Paris : un jour hors saison, dans la semaine du défi du lundi 5. */
const MARDI = Date.UTC(2026, 9, 6, 8, 0)
const JOUR = '2026-10-06'
const SEMAINE = '2026-10-05'
const BASE = baseDEssai(120)

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer({ horlogeDuJour: () => MARDI, baseDeLaCampagne: BASE })
  try {
    await scenario(banc)
  } finally {
    ProfileStore.tirageEclat = () => false
    await banc.close()
  }
}

/** Le tirage, espionné : chaque chance qu'on lui demande, et ce qu'il rend. */
function espionner(rend: boolean): number[] {
  const chances: number[] = []
  ProfileStore.tirageEclat = (chance = CHANCE_ECLAT) => {
    chances.push(chance)
    return rend
  }
  return chances
}

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** La base permanente, le temps d'une lecture. */
function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) =>
  base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Ce qui a éclaté pour lui, et sous quel nom c'est rangé. */
const eclatsDe = (banc: Banc, login: string) =>
  base(banc, db =>
    db.prepare('SELECT avatar, soiree_id FROM profile_eclats WHERE profile_id = ? ORDER BY created_at').all(idDe(banc, login)),
  ) as { avatar: string; soiree_id: string }[]

/** Ses paliers de La Pluie d'Éclats, et sous quel nom. */
const pluieDe = (banc: Banc, login: string) =>
  base(banc, db =>
    db.prepare(`SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'hf:eclats:%' ORDER BY badge`).all(idDe(banc, login)),
  ) as { badge: string; soiree_id: string }[]

/** Sa ligne d'expérience des paliers. */
const xpDesPaliers = (banc: Banc, login: string) =>
  base(banc, db => {
    const r = db.prepare(`SELECT xp FROM profile_xp WHERE profile_id = ? AND soiree_id = '#paliers'`).get(idDe(banc, login)) as { xp: number } | undefined
    return r?.xp ?? 0
  })

async function jusqua(vrai: () => boolean, quoi: string) {
  for (const limite = Date.now() + 10_000; !vrai(); await patienter(100)) {
    if (Date.now() > limite) assert.fail(`${quoi} n’est pas venu`)
  }
}

/**
 * Joue la partie du jour jusqu'au bout, une faute à la première question —
 * un sans-faute ferait tomber son palier. `avantLaFin` regarde juste avant
 * la dernière réponse. Rend la vue de la partie finie.
 */
async function jouerLeJour(banc: Banc, cookie: string, avantLaFin: () => void = () => {}) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = base(banc, db =>
    JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions),
  ) as { bonne: number; reponses: string[] }[]
  while (etat.question) {
    const i = etat.question.index
    if (i === questions.length - 1) avantLaFin()
    const choix = i === 0 ? (questions[i].bonne + 1) % questions[i].reponses.length : questions[i].bonne
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

/**
 * Répond à une série de campagne — ou au défi — jusqu'à sa fin : deux bonnes
 * réponses, puis trois fautes. `avantLaFin` regarde juste avant la dernière.
 * Rend sa dernière réponse.
 */
async function jusquAuBout(banc: Banc, cookie: string, serie: { id: string; question: { index: number } }, avantLaFin: () => void = () => {}) {
  const questions = base(banc, db =>
    JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie.id) as { questions: string }).questions),
  ) as { bonne: number; reponses: string[] }[]
  let derniere: any = null
  let fautes = 0
  for (let i = serie.question.index; !derniere?.finie; i++) {
    const juste = i < 2
    if (!juste && fautes === 2) avantLaFin()
    const q = questions[i]
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: juste ? q.bonne : (q.bonne + 1) % q.reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    if (!juste) fautes++
    derniere = r.corps
  }
  return derniere
}

test('au quiz du jour, une chance sur quarante, tirée une fois : quand la partie finit', () =>
  avecBanc(async banc => {
    // Bob n'a pas de chance : un tirage, et rien ne tombe.
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const rate = espionner(false)
    const finBob = await jouerLeJour(banc, bob)
    assert.equal(finBob.etat, 'finie')
    assert.deepEqual(rate, [CHANCE_ECLAT_DU_JOUR])
    assert.equal(finBob.eclat, undefined)
    assert.deepEqual(eclatsDe(banc, 'bob'), [])

    // Alice en a : rien pendant la partie, un tirage quand elle finit.
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const chances = espionner(true)
    const fin = await jouerLeJour(banc, alice, () => assert.deepEqual(chances, [], 'rien ne se tire pendant la partie'))
    assert.deepEqual(chances, [CHANCE_ECLAT_DU_JOUR], 'un tirage, à la chance du quiz du jour')
    // Ce qu'elle porte éclate, rangé sous le jour : aucune soirée ne le reprendra.
    assert.deepEqual(eclatsDe(banc, 'alice'), [{ avatar: '🦊', soiree_id: cleDuJour(JOUR) }])
    // La fin le dit, avec La Pluie d'Éclats qu'il fait tomber, rangée au même nom et payée.
    assert.equal(fin.eclat, '🦊')
    assert.ok(fin.paliers?.some((p: any) => p.key === 'hf:eclats:1'), 'La Pluie d’Éclats · Bronze s’annonce')
    assert.deepEqual(pluieDe(banc, 'alice'), [{ badge: 'hf:eclats:1', soiree_id: cleDuJour(JOUR) }])
    assert.equal(xpDesPaliers(banc, 'alice'), XP_PALIER[0])

    // La page rechargée le redit, sans retirer au sort.
    const relue = (await lire(banc, alice, '/api/jour')).corps
    assert.equal(relue.eclat, '🦊')
    assert.deepEqual(chances, [CHANCE_ECLAT_DU_JOUR])
    assert.deepEqual((await lire(banc, alice, '/api/joueur/moi')).corps.profile.eclats, ['🦊'])
    // Et celle de Bob, toujours rien.
    assert.equal((await lire(banc, bob, '/api/jour')).corps.eclat, undefined)
  }))

test('au défi de la semaine, une chance sur vingt à la tentative finie — la série de campagne n’en tire pas', () =>
  avecBanc(async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const chances = espionner(true)
    // Une série se rejoue à volonté : elle ne tire rien.
    const serie = await jusquAuBout(banc, lea, (await poster(banc, lea, '/api/campagne/serie')).corps)
    assert.equal(serie.eclat, undefined)
    assert.deepEqual(chances, [], 'pas d’Éclat en campagne')

    // Le défi : rien pendant, un tirage quand la tentative finit.
    const defi = (await poster(banc, lea, '/api/campagne/defi')).corps
    assert.ok(defi.id, defi.error)
    const fin = await jusquAuBout(banc, lea, defi, () => assert.deepEqual(chances, [], 'rien ne se tire pendant le défi'))
    assert.deepEqual(chances, [CHANCE_ECLAT_DU_DEFI], 'un tirage, à la chance du défi')
    assert.equal(fin.eclat, '🦊')
    assert.ok(
      fin.recompenses?.some((r: any) => r.key === 'hf:eclats:1' && /Pluie/.test(r.title)),
      'La Pluie d’Éclats · Bronze s’annonce avec la fin du défi',
    )
    assert.ok(fin.defi, 'sa place au classement reste dite')
    assert.deepEqual(eclatsDe(banc, 'lea'), [{ avatar: '🦊', soiree_id: cleDuDefi(SEMAINE) }])
    assert.deepEqual(pluieDe(banc, 'lea'), [{ badge: 'hf:eclats:1', soiree_id: cleDuDefi(SEMAINE) }])

    // Une seule tentative : le défi ne se rejoue pas, le tirage non plus.
    assert.equal((await poster(banc, lea, '/api/campagne/defi')).status, 400)
    assert.deepEqual(chances, [CHANCE_ECLAT_DU_DEFI])
  }))

// ── Une soirée qui se joue encore ─────────────────────────────────────────

/** Joue un quiz d'une question depuis l'écran commun, chacun sa réponse, jusqu'au podium. */
async function jouerQuiz(host: Socket, quizId: string, reponses: [Invite, number][]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 20_000)
  const sessionId = await lancerQuiz(host, quizId)
  await vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la question')
  const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
  for (const [qui, choice] of reponses) {
    const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
    assert.equal(ack.ok, true, `réponse refusée : ${ack.error}`)
  }
  await revelee
  const podium = vue(sessionId, v => v.phase === 'finished', 'le podium')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  await podium
  ;(host as any).emit('host:endSession', { sessionId })
}

/** Un geste de fin de soirée depuis l'écran commun, et son toast. */
async function geste(host: Socket, event: 'host:closeParty' | 'host:discardParty') {
  const toast = attendre<any>(host, 'toast', () => true, event, 20_000)
  ;(host as any).emit(event, {})
  const t = await toast
  assert.equal(t.kind, 'info', `${event} a échoué : ${t.message}`)
}

test('l’Éclat d’un essai qui se joue encore ne compte pas pour La Pluie d’Éclats du quiz du jour', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const remi = await inscrireProfil(banc.url, 'remi', 'Rémi', '🐧')
    const host = await ecranCommun(banc.url, cookie)
    const porter = async (avatar: string) => assert.equal((await ecrire(banc.url, '/api/joueur/moi', { avatar }, remi, 'PUT')).status, 200)
    ProfileStore.tirageEclat = () => true

    // Une soirée close : 🐧 éclate, et La Pluie d'Éclats · Bronze tombe à sa clôture.
    await jouerQuiz(host, quiz, [
      [await invite(banc.url, 'Rémi', '🐧', { cookie: remi }), 0],
      [await invite(banc.url, 'Fig', '🐻'), 1],
    ])
    await jusqua(() => eclatsDe(banc, 'remi').length === 1, 'l’Éclat de la soirée')
    await geste(host, 'host:closeParty')
    assert.deepEqual(pluieDe(banc, 'remi').map(p => p.badge), ['hf:eclats:1'])

    // Un essai qui se joue encore : 🦊 éclate dès son premier verdict.
    await porter('🦊')
    await jouerQuiz(host, quiz, [
      [await invite(banc.url, 'Rémi', '🦊', { cookie: remi }), 0],
      [await invite(banc.url, 'Fig', '🐻'), 1],
    ])
    await jusqua(() => eclatsDe(banc, 'remi').length === 2, 'l’Éclat de l’essai')

    // Le quiz du jour en 🐼 : trois avatars éclatés, mais l'essai n'est pas
    // clos — deux comptent, et l'argent (trois) ne tombe pas.
    await porter('🐼')
    const fin = await jouerLeJour(banc, remi)
    assert.equal(fin.eclat, '🐼')
    assert.equal(eclatsDe(banc, 'remi').length, 3)
    assert.deepEqual(pluieDe(banc, 'remi').map(p => p.badge), ['hf:eclats:1'], 'pas d’argent sur l’Éclat d’un essai en cours')

    // L'essai s'efface, son Éclat avec : rien de ce qu'il aurait fait tomber ne reste.
    ProfileStore.tirageEclat = () => false
    await geste(host, 'host:discardParty')
    await jusqua(() => eclatsDe(banc, 'remi').length === 2, 'le départ de l’Éclat de l’essai')
    assert.deepEqual(
      eclatsDe(banc, 'remi').map(e => e.avatar),
      ['🐧', '🐼'],
    )
    assert.deepEqual(pluieDe(banc, 'remi').map(p => p.badge), ['hf:eclats:1'])
  }))
