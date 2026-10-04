// La fin du programme d'un salon : son dernier quiz rendu, la barre du chef
// propose « Terminer la soirée » (`finDuProgramme` dans l'instantané).
//
// La soirée s'enregistrait seule trente secondes après le dernier podium, et
// le podium disparaissait sous les yeux de la salle : c'est l'animateur qui
// l'enlève (le propriétaire du dépôt, le 4 octobre 2026). « Terminer le
// quiz » sur le dernier du programme clôt tout de suite. L'écran commun
// d'avant garde son geste de fin ; un quiz relancé, ou ajouté au programme
// pendant le podium, défait la fin du programme.
import { after, before, test } from 'node:test'
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
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

let banc: Banc
before(async () => {
  banc = await demarrer()
})
after(() => banc.close())

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

test('le dernier quiz du programme joué, le podium reste jusqu’à « Terminer la soirée »', async () => {
  const s = await salon('chef1')
  let finie = false
  s.a.socket.on('soiree:fin', () => (finie = true))
  await jouerJusquAuPodium(s.ecran, s.quiz, s.a.socket)
  const annonce = await instantane<{ finDuProgramme?: true; clotureAuto?: unknown }>(s.a.socket, x => x.finDuProgramme === true, 'la fin du programme')
  assert.equal(annonce.clotureAuto, undefined, 'plus d’échéance à décompter')
  // Le podium se regarde aussi longtemps qu'on veut : rien ne le chasse.
  await patienter(1500)
  assert.equal(finie, false, 'la soirée ne s’est pas close seule')
  const vue = await instantane<{ players: unknown[] }>(s.ecran)
  assert.equal(vue.players.length, 2, 'la salle est toujours là, devant le podium')
  // Le geste du chef : « Terminer la soirée » de sa barre.
  const fin = attendre<any>(s.a.socket, 'soiree:fin', () => true, 'la fin de soirée', 8000)
  ;(s.ecran as any).emit('host:closeParty', {}, () => {})
  assert.ok((await fin).soiree, 'chacun reçoit sa fin de soirée')
  const apres = await instantane<{ players: unknown[]; finDuProgramme?: true }>(s.ecran, x => x.players.length === 0, 'la soirée vide')
  assert.equal(apres.finDuProgramme, undefined)
})

test('« Ouvrir le salon » le lendemain efface la clôture de la veille sur la télé', async () => {
  // L'écran commun gardait « La soirée est close » jusqu'au premier invité :
  // le chef qui rouvrait son salon la voyait encore (la remarque du
  // 4 octobre 2026). Ouvrir le salon, c'est commencer la soirée suivante.
  const s = await salon('chef0')
  const fin = attendre<any>(s.a.socket, 'soiree:fin', () => true, 'la fin de soirée', 8000)
  await jouerJusquAuPodium(s.ecran, s.quiz, s.a.socket)
  ;(s.ecran as any).emit('host:closeParty', {}, () => {})
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
  const snap = await instantane<{ players: unknown[]; finDuProgramme?: true }>(ecran)
  assert.equal(snap.finDuProgramme, undefined, 'pas de fin de programme : il n’en a pas')
  assert.equal(snap.players.length, 2, 'la soirée continue jusqu’à « Clore la soirée »')
})

test('un quiz ajouté au programme pendant le dernier podium défait la fin du programme', async () => {
  const s = await salon('chef2')
  await jouerJusquAuPodium(s.ecran, s.quiz, s.a.socket)
  await instantane<{ finDuProgramme?: true }>(s.ecran, x => x.finDuProgramme === true, 'la fin du programme')
  const encore = await creerQuiz(banc.url, s.console_, [qcm('Encore ?')], 'Encore un')
  const modif = await ecrire(
    banc.url,
    `/api/programmes/${s.programme.id}`,
    { entrees: [{ quizId: s.quiz, multiplier: 1 }, { quizId: encore, multiplier: 1 }] },
    s.console_,
    'PUT',
  )
  assert.ok(modif.ok)
  await instantane<{ finDuProgramme?: true }>(s.ecran, x => x.finDuProgramme === undefined, 'la fin du programme défaite')
  const snap = await instantane<{ players: unknown[] }>(s.ecran)
  assert.equal(snap.players.length, 2, 'la soirée continue : un quiz l’attend encore')
})

test('« Terminer le quiz » sur le dernier du programme clôt la soirée sans attendre', async () => {
  // Terminer à la main, c'est dire qu'on a fini : le chef restait dans la
  // salle d'attente, son code en grand, au lieu de sa fin de soirée.
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

test('le podium regardé, la fin du programme annoncée : « Terminer le quiz » clôt la soirée', async () => {
  const s = await salon('chef4')
  const sessionId = await jouerJusquAuPodium(s.ecran, s.quiz, s.a.socket)
  await instantane<{ finDuProgramme?: true }>(s.ecran, x => x.finDuProgramme === true, 'la fin du programme')
  const fin = attendre<any>(s.a.socket, 'soiree:fin', () => true, 'la fin de soirée, tout de suite', 5000)
  ;(s.ecran as any).emit('host:endSession', { sessionId })
  assert.ok((await fin).soiree)
})

test('« Terminer le quiz » quand le programme en garde un autre : la soirée continue', async () => {
  const s = await salon('chef5')
  const encore = await creerQuiz(banc.url, s.console_, [qcm('Encore ?')], 'Encore un')
  assert.ok(
    (await ecrire(banc.url, `/api/programmes/${s.programme.id}`, { entrees: [{ quizId: s.quiz, multiplier: 1 }, { quizId: encore, multiplier: 1 }] }, s.console_, 'PUT')).ok,
  )
  const sessionId = await jouerJusquAuPodium(s.ecran, s.quiz, s.a.socket)
  ;(s.ecran as any).emit('host:endSession', { sessionId })
  await patienter(1200)
  const snap = await instantane<{ players: unknown[]; finDuProgramme?: true }>(s.ecran)
  assert.equal(snap.players.length, 2, 'la salle attend le quiz suivant')
  assert.equal(snap.finDuProgramme, undefined)
})
