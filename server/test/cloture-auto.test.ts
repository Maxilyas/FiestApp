// La soirée d'un salon s'enregistre toute seule après le dernier quiz de son
// programme.
//
// Au téléphone, plus de « Clore la soirée » à trouver : le programme dit où
// elle s'arrête. Son dernier podium reste à l'écran le temps qu'on le
// regarde (`SpaceRuntime.delaiClotureAuto`), puis chacun reçoit sa fin de
// soirée. L'écran commun d'avant garde son geste de fin et ne clôt jamais
// rien seul ; un quiz relancé, ou ajouté au programme pendant le podium,
// défait l'échéance.
import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  attendre,
  connexionAnimateur,
  cookieDe,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  inscrireProfil,
  instantane,
  invite,
  patienter,
  qcm,
  type Banc,
  type Socket,
} from './banc'
import { SpaceRuntime } from '../src/core/space'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

let banc: Banc
before(async () => {
  banc = await demarrer()
})
after(() => banc.close())
beforeEach(() => {
  SpaceRuntime.delaiClotureAuto = 400
})

/** Joue un quiz d'une question jusqu'à son podium, la bonne réponse donnée par le premier invité. */
async function jouerJusquAuPodium(ecran: Socket, quizId: string, joueur: Socket) {
  const choix = attendre<any>(ecran, 'session:view', p => p.view.phase === 'pickPack', 'le choix')
  ;(ecran as any).emit('host:launch', { depuis: null })
  const { sessionId, view } = await choix
  const question = attendre<any>(joueur, 'session:view', p => p.view.phase === 'question', 'la question')
  ;(ecran as any).emit('host:command', { sessionId, command: { type: 'selectPack', packId: quizId, phase: 'pickPack', qIndex: 0, round: view.round } }, () => {})
  const q = (await question).view
  ;(joueur as any).emit('player:action', { sessionId, action: { type: 'answer', choice: 0, qIndex: 0, round: q.round } }, () => {})
  const revele = attendre<any>(ecran, 'session:view', p => p.view.phase === 'reveal', 'la révélation')
  ;(ecran as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'question', qIndex: 0, round: q.round } }, () => {})
  const r = (await revele).view
  const podium = attendre<any>(ecran, 'session:view', p => p.view.phase === 'finished', 'le podium')
  ;(ecran as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: 0, round: r.round } }, () => {})
  await podium
  return sessionId as string
}

/** Un salon ouvert depuis un téléphone, son programme d'un quiz, et deux invités. */
async function salon(login: string) {
  const profil = await inscrireProfil(banc.url, login, login)
  const espaceRes = await ecrire(banc.url, '/api/joueur/espace', {}, profil)
  const console_ = cookieDe(espaceRes)
  const { espace } = (await espaceRes.json()) as { espace: { slug: string } }
  const quiz = await creerQuiz(banc.url, console_, [qcm('La seule ?')], 'Le quiz du soir')
  const programme = (await (await ecrire(banc.url, '/api/programmes', { titre: 'Ce soir', entrees: [{ quizId: quiz, multiplier: 1 }] }, console_)).json()) as {
    id: string
  }
  await ecrire(banc.url, '/api/joueur/salon', {}, profil)
  const ecran = await ecranCommun(banc.url, console_)
  const a = await invite(banc.url, 'Alice', '🦊', { slug: espace.slug })
  const b = await invite(banc.url, 'Bruno', '🐼', { slug: espace.slug })
  return { profil, console_, quiz, programme, ecran, a, b, slug: espace.slug }
}

test('le dernier quiz du programme joué, la soirée s’enregistre seule, son podium regardé', async () => {
  const s = await salon('chef1')
  const fin = attendre<any>(s.a.socket, 'soiree:fin', () => true, 'la fin de soirée', 8000)
  await jouerJusquAuPodium(s.ecran, s.quiz, s.a.socket)
  const arme = await instantane<{ clotureAuto?: number }>(s.a.socket, x => typeof x.clotureAuto === 'number', 'l’échéance annoncée')
  assert.ok(arme.clotureAuto! > Date.now() - 50, 'une échéance à venir, que le téléphone décompte')
  const { soiree } = await fin
  assert.ok(soiree, 'chacun reçoit sa fin de soirée')
  const apres = await instantane<{ players: unknown[]; clotureAuto?: number }>(s.ecran, x => x.players.length === 0, 'la soirée vide')
  assert.equal(apres.clotureAuto, undefined)
})

test('« Ouvrir le salon » le lendemain efface la clôture de la veille sur la télé', async () => {
  // L'écran commun gardait « La soirée est close » jusqu'au premier invité :
  // le chef qui rouvrait son salon la voyait encore (la remarque du
  // 4 octobre 2026). Ouvrir le salon, c'est commencer la soirée suivante.
  const s = await salon('chef0')
  const fin = attendre<any>(s.a.socket, 'soiree:fin', () => true, 'la fin de soirée', 8000)
  await jouerJusquAuPodium(s.ecran, s.quiz, s.a.socket)
  await fin
  await instantane<{ scene?: { ecran: string } }>(s.ecran, x => x.scene?.ecran === 'cloture', 'la clôture à l’écran')
  // Un écran qui se présente ne la quitte pas : elle s'y montre encore.
  const autre = await ecranCommun(banc.url, s.console_)
  assert.equal((await instantane<{ scene?: { ecran: string } }>(autre)).scene?.ecran, 'cloture')
  assert.ok((await ecrire(banc.url, '/api/joueur/salon', {}, s.profil)).ok)
  const apres = await instantane<{ scene?: unknown; players: unknown[] }>(s.ecran, x => x.scene === undefined, 'la clôture effacée')
  assert.equal(apres.players.length, 0, 'une salle neuve, sans personne encore')
})

test('l’écran commun d’avant ne clôt jamais rien seul', async () => {
  const admin = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, admin, [qcm('Une ?')], 'Quiz du banc')
  assert.ok((await ecrire(banc.url, '/api/programmes', { titre: 'Ce soir', entrees: [{ quizId: quiz, multiplier: 1 }] }, admin)).ok)
  const ecran = await ecranCommun(banc.url, admin)
  const a = await invite(banc.url, 'Alice', '🦊')
  await invite(banc.url, 'Bruno', '🐼')
  await jouerJusquAuPodium(ecran, quiz, a.socket)
  await patienter(800)
  const snap = await instantane<{ players: unknown[]; clotureAuto?: number }>(ecran)
  assert.equal(snap.clotureAuto, undefined, 'pas d’échéance')
  assert.equal(snap.players.length, 2, 'la soirée continue jusqu’à « Clore la soirée »')
})

test('un quiz ajouté au programme pendant le dernier podium défait l’échéance', async () => {
  SpaceRuntime.delaiClotureAuto = 1500
  const s = await salon('chef2')
  await jouerJusquAuPodium(s.ecran, s.quiz, s.a.socket)
  await instantane<{ clotureAuto?: number }>(s.ecran, x => typeof x.clotureAuto === 'number', 'l’échéance annoncée')
  const encore = await creerQuiz(banc.url, s.console_, [qcm('Encore ?')], 'Encore un')
  const modif = await ecrire(
    banc.url,
    `/api/programmes/${s.programme.id}`,
    { entrees: [{ quizId: s.quiz, multiplier: 1 }, { quizId: encore, multiplier: 1 }] },
    s.console_,
    'PUT',
  )
  assert.ok(modif.ok)
  await instantane<{ clotureAuto?: number }>(s.ecran, x => x.clotureAuto === undefined, 'l’échéance défaite')
  await patienter(1800)
  const snap = await instantane<{ players: unknown[] }>(s.ecran)
  assert.equal(snap.players.length, 2, 'la soirée continue : un quiz l’attend encore')
})

test('« Terminer le quiz » sur le dernier du programme clôt la soirée sans attendre', async () => {
  // L'échéance laisse regarder un podium ; terminer à la main, c'est dire
  // qu'on a fini : le chef restait trente secondes dans la salle d'attente,
  // son code en grand, au lieu de sa fin de soirée.
  SpaceRuntime.delaiClotureAuto = 60_000
  const s = await salon('chef3')
  const choix = attendre<any>(s.ecran, 'session:view', p => p.view.phase === 'pickPack', 'le choix')
  ;(s.ecran as any).emit('host:launch', { depuis: null })
  const { sessionId, view } = await choix
  const question = attendre<any>(s.a.socket, 'session:view', p => p.view.phase === 'question', 'la question')
  ;(s.ecran as any).emit('host:command', { sessionId, command: { type: 'selectPack', packId: s.quiz, phase: 'pickPack', qIndex: 0, round: view.round } }, () => {})
  const q = (await question).view
  // Une question révélée : le quiz compte comme joué, même terminé avant son podium.
  ;(s.a.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: 0, qIndex: 0, round: q.round } }, () => {})
  const revele = attendre<any>(s.ecran, 'session:view', p => p.view.phase === 'reveal', 'la révélation')
  ;(s.ecran as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'question', qIndex: 0, round: q.round } }, () => {})
  await revele
  const fin = attendre<any>(s.a.socket, 'soiree:fin', () => true, 'la fin de soirée, tout de suite', 5000)
  ;(s.ecran as any).emit('host:endSession', { sessionId })
  assert.ok((await fin).soiree)
})

test('le podium regardé, l’échéance armée : « Terminer le quiz » n’attend pas son bout', async () => {
  SpaceRuntime.delaiClotureAuto = 60_000
  const s = await salon('chef4')
  const sessionId = await jouerJusquAuPodium(s.ecran, s.quiz, s.a.socket)
  await instantane<{ clotureAuto?: number }>(s.ecran, x => typeof x.clotureAuto === 'number', 'l’échéance annoncée')
  const fin = attendre<any>(s.a.socket, 'soiree:fin', () => true, 'la fin de soirée, tout de suite', 5000)
  ;(s.ecran as any).emit('host:endSession', { sessionId })
  assert.ok((await fin).soiree)
})

test('« Terminer le quiz » quand le programme en garde un autre : la soirée continue', async () => {
  SpaceRuntime.delaiClotureAuto = 400
  const s = await salon('chef5')
  const encore = await creerQuiz(banc.url, s.console_, [qcm('Encore ?')], 'Encore un')
  assert.ok(
    (await ecrire(banc.url, `/api/programmes/${s.programme.id}`, { entrees: [{ quizId: s.quiz, multiplier: 1 }, { quizId: encore, multiplier: 1 }] }, s.console_, 'PUT')).ok,
  )
  const sessionId = await jouerJusquAuPodium(s.ecran, s.quiz, s.a.socket)
  ;(s.ecran as any).emit('host:endSession', { sessionId })
  await patienter(1200)
  const snap = await instantane<{ players: unknown[]; clotureAuto?: number }>(s.ecran)
  assert.equal(snap.players.length, 2, 'la salle attend le quiz suivant')
  assert.equal(snap.clotureAuto, undefined)
})
