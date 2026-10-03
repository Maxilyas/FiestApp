// Le chef qui anime seulement (« J'anime seulement », la remarque du
// propriétaire du 3 octobre 2026) : il suit la soirée sur l'écran de tout le
// monde, sa barre en bas, et peut répondre pour le plaisir — mais rien de
// lui ne compte. Ni points, ni journal, ni attente : la question ne
// l'attend pas pour se révéler ; ni classement, ni podium. Lui seul peut le
// dire — son profil tient l'espace — et un invité qui le prétend n'est pas
// écouté.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { attendre, cookieDe, creerQuiz, demarrer, ecranCommun, ecrire, inscrireProfil, instantane, invite, qcm, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

let banc: Banc
before(async () => {
  banc = await demarrer()
})
after(() => banc.close())

test('le chef qui anime seulement répond sans compter : ni points, ni attente, ni classement', async () => {
  const chef = await inscrireProfil(banc.url, 'chef', 'Chef', '🦁')
  const espaceRes = await ecrire(banc.url, '/api/joueur/espace', {}, chef)
  const console_ = cookieDe(espaceRes)
  const { espace } = (await espaceRes.json()) as { espace: { slug: string } }
  const quiz = await creerQuiz(banc.url, console_, [qcm('La première ?'), qcm('La seconde ?')], 'Le quiz du soir')
  await ecrire(banc.url, '/api/programmes', { titre: 'Ce soir', entrees: [{ quizId: quiz, multiplier: 1 }] }, console_)
  await ecrire(banc.url, '/api/joueur/salon', {}, chef)
  const ecran = await ecranCommun(banc.url, console_)

  const lui = await invite(banc.url, 'Chef', '🦁', { slug: espace.slug, cookie: chef, horsClassement: true })
  const a = await invite(banc.url, 'Alice', '🦊', { slug: espace.slug })
  // Un invité qui le prétend n'est pas écouté : il n'anime pas.
  const b = await invite(banc.url, 'Bruno', '🐼', { slug: espace.slug, horsClassement: true })
  const salle = await instantane<{ players: { id: string; horsClassement?: true }[] }>(ecran, x => x.players.length === 3, 'la salle')
  assert.equal(salle.players.find(p => p.id === lui.playerId)?.horsClassement, true, 'le chef, marqué')
  assert.equal(salle.players.find(p => p.id === b.playerId)?.horsClassement, undefined, 'l’invité, non')

  const choix = attendre<any>(ecran, 'session:view', p => p.view.phase === 'pickPack', 'le choix')
  ;(ecran as any).emit('host:launch', { depuis: null })
  const { sessionId, view } = await choix
  const question = attendre<any>(lui.socket, 'session:view', p => p.view.phase === 'question', 'la question, chez le chef')
  const questionHote = attendre<any>(ecran, 'session:view', p => p.view.phase === 'question', 'la question, à l’écran')
  ;(ecran as any).emit('host:command', { sessionId, command: { type: 'selectPack', packId: quiz, phase: 'pickPack', qIndex: 0, round: view.round } }, () => {})
  const q = (await question).view
  assert.equal(q.horsClassement, true, 'son téléphone le sait')

  // Il répond juste, le premier : la salle ne le compte pas.
  const visee = { qIndex: 0, round: q.round }
  const acc = await new Promise<any>(r => (lui.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: 0, ...visee } }, r))
  assert.equal(acc.ok, true, 'sa réponse est prise')
  assert.equal((await questionHote).view.participantCount, 2, 'deux joueurs attendus, pas trois')

  // Alice répond : une réponse sur deux — celle du chef n'est pas comptée.
  const uneSurDeux = attendre<any>(ecran, 'session:view', p => p.view.phase === 'question' && p.view.answeredCount === 1, 'une réponse sur deux')
  ;(a.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: 0, ...visee } }, () => {})
  assert.equal((await uneSurDeux).view.participantCount, 2)

  // Bruno répond : la question se révèle sans attendre personne d'autre.
  const revelee = attendre<any>(lui.socket, 'session:view', p => p.view.phase === 'reveal', 'la révélation, sans attendre le chef', 8000)
  ;(b.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: 1, ...visee } }, () => {})
  const r = (await revelee).view
  assert.equal(r.yourChoice, 0, 'il revoit sa réponse')
  assert.equal(r.yourPoints, null, 'aucun point pour lui')
  assert.equal(r.yourQuizRank, undefined, 'aucune place')

  const hote = await attendre<any>(ecran, 'session:view', p => p.view.phase === 'reveal', 'la révélation, à l’écran')
  assert.ok(!hote.view.standings.some((l: any) => l.name === 'Chef'), 'hors du classement du quiz')
  assert.equal(hote.view.fastest?.name, 'Alice', 'le plus rapide est un joueur')

  const apres = await instantane<{ players: { id: string; score: number }[] }>(ecran, x => (x.players.find(p => p.id === a.playerId)?.score ?? 0) > 0, 'les points d’Alice')
  assert.equal(apres.players.find(p => p.id === lui.playerId)?.score, 0, 'rien au journal des gains')
})

test('à la clôture, sa fin dit qu’il animait — ni « Tu n’as pas joué », ni place, ni hauts faits — et la salle ne le compte pas', async () => {
  const chef = await inscrireProfil(banc.url, 'chef2', 'Chef', '🦁')
  const espaceRes = await ecrire(banc.url, '/api/joueur/espace', {}, chef)
  const console_ = cookieDe(espaceRes)
  const { espace } = (await espaceRes.json()) as { espace: { slug: string } }
  const quiz = await creerQuiz(banc.url, console_, [1, 2, 3, 4, 5].map(n => qcm(`Question ${n} ?`)), 'Le quiz du soir')
  await ecrire(banc.url, '/api/joueur/salon', {}, chef)
  const ecran = await ecranCommun(banc.url, console_)
  const lui = await invite(banc.url, 'Chef', '🦁', { slug: espace.slug, cookie: chef, horsClassement: true })
  // Quatre joueurs : la salle des hauts faits. Le chef, lui, ne répond à rien —
  // un joueur qui en ferait autant serait L'Abstentionniste.
  const joueurs = await Promise.all(['Alice', 'Bruno', 'Chloé', 'Dan'].map((n, i) => invite(banc.url, n, ['🦊', '🐼', '🐙', '🦄'][i], { slug: espace.slug })))
  const choix = attendre<any>(ecran, 'session:view', p => p.view.phase === 'pickPack', 'le choix')
  ;(ecran as any).emit('host:launch', { depuis: null })
  const { sessionId, view } = await choix
  ;(ecran as any).emit('host:command', { sessionId, command: { type: 'selectPack', packId: quiz, phase: 'pickPack', qIndex: 0, round: view.round } }, () => {})
  for (let q = 0; q < 5; q++) {
    const v = (await attendre<any>(joueurs[0].socket, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === q, `la question ${q}`)).view
    const revelee = attendre<any>(ecran, 'session:view', p => p.view.phase === 'reveal' && p.view.qIndex === q, `la révélation ${q}`)
    joueurs.forEach((j, i) => (j.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: i % 2, qIndex: q, round: v.round } }, () => {}))
    const r = (await revelee).view
    ;(ecran as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: q, round: r.round } }, () => {})
  }
  const finChef = attendre<any>(lui.socket, 'soiree:fin', () => true, 'sa fin', 15000)
  const finAlice = attendre<any>(joueurs[0].socket, 'soiree:fin', () => true, 'celle d’Alice', 15000)
  ;(ecran as any).emit('host:closeParty', {}, () => {})
  const fin = await finChef
  assert.equal(fin.anime, true, 'il animait')
  assert.equal(fin.aJoue, false)
  assert.equal(fin.joueurId, undefined, 'pas dans l’archive : « Mon bilan » ne le chercherait pas')
  assert.deepEqual(fin.hautsFaits, [], 'ni L’Abstentionniste, ni rien')
  assert.equal(fin.prix, undefined)
  assert.equal(fin.joueurs, 4, 'la salle, sans lui')
  assert.equal((await finAlice).joueurs, 4)
  assert.equal((await finAlice).anime, undefined)
  const liste = (await (await fetch(`${banc.url}/s/${espace.slug}/soirees.json`)).json()) as { archives: { players: number }[] }
  assert.equal(liste.archives[0].players, 4, 'l’historique ne le compte pas')

  // Au téléphone, la phrase le dit ; un joueur qui n'a pas répondu garde la sienne.
  const { ligneDeRang } = await import('../../shared/fin')
  assert.deepEqual(ligneDeRang(fin), { cas: 'anime', joueurs: 4 })
  assert.deepEqual(ligneDeRang({ ...fin, anime: undefined }), { cas: 'absent', joueurs: 4 })
  const { readFileSync } = await import('node:fs')
  assert.match(readFileSync(new URL('../../client/src/components/FinDeSoiree.tsx', import.meta.url), 'utf8'), /case 'anime':\s*return \(\s*<p className="muted">\s*Tu animais la soirée/)
})

test('au téléphone : le salon ouvre la soirée pour les deux choix, et les classements écartent le chef', async () => {
  const { readFileSync } = await import('node:fs')
  const source = (f: string) => readFileSync(new URL(`../../client/src/${f}`, import.meta.url), 'utf8')
  // « J'anime seulement » n'envoie plus à la console d'avant : l'écran de tout le monde, sa barre en bas.
  const salon = source('views/SalonApp.tsx')
  assert.match(salon, /window\.location\.assign\(spacePath\(salon\.espace\.slug\)\)/)
  assert.doesNotMatch(salon, /: '\/host'\)/)
  // Il le redit à chaque présentation.
  assert.match(source('socket.ts'), /const horsClassement = chef \? !chef\.joue : undefined/)
  // Les classements de la soirée l'écartent ; son en-tête le dit.
  assert.match(source('components/Leaderboard.tsx'), /players\.filter\(p => !p\.horsClassement\)/)
  assert.match(source('views/PlayerApp.tsx'), /me\?\.horsClassement \? 'Tu animes · hors classement'/)
  // « 1ʳᵉ place sur 2 » à qui jouait seul face au chef : il ne compte pas dans le « sur combien ».
  assert.match(source('views/PlayerApp.tsx'), /participants=\{session \? session\.participantIds\.length - snap\.players\.filter\(p => p\.horsClassement/)
  // Une bonne réponse ne lui promet pas « +0 ».
  const vue = source('games/quiz/PlayerView.tsx')
  assert.match(vue, /if \(v\.horsClassement\) \{[\s\S]{0,200}Hors classement : tu animes/)
  assert.doesNotMatch(vue, /<span className="big">\+\{pts\(v\.yourPoints \?\? 0\)\}<\/span>\s*<p>/)
})
