// Le chef qui joue, et garde la main.
//
// Son téléphone de joueur porte une barre en bas — la pause, révéler, la
// question suivante, le quiz suivant —, ses gestes passant par une seconde
// liaison, celle de l'animateur : une seule ne s'y prête pas (les vues de
// partie arriveraient en double, sans dire à quel rôle elles s'adressent, et
// une session d'animateur qui tombe couperait le joueur). Le quiz se lance
// au programme du salon, sans liste à parcourir. Seul le téléphone qui a
// ouvert le salon télécharge la barre, et rien de la question n'y paraît.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  attendre,
  connecter,
  cookieDe,
  creerQuiz,
  demarrer,
  ecrire,
  emitAck,
  inscrireProfil,
  invite,
  qcm,
  type Banc,
} from './banc'

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

// ── Ce que le téléphone retient ────────────────────────────────────────────

test('seul le téléphone qui a ouvert le salon se sait chef — et chez lui seulement', async () => {
  const stock = new Map<string, string>()
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => stock.get(k) ?? null,
      setItem: (k: string, v: string) => void stock.set(k, v),
      removeItem: (k: string) => void stock.delete(k),
    },
  })
  const { chefIci, retenirChef } = await import(new URL('../../client/src/chef.ts', import.meta.url).href)
  assert.equal(chefIci('s-abc234'), null, 'un invité ne l’est pas')
  retenirChef({ slug: 's-abc234', joue: true, rythme: 10, equipes: true })
  assert.deepEqual(chefIci('s-abc234'), { slug: 's-abc234', joue: true, rythme: 10, equipes: true })
  assert.equal(chefIci('chez-nadia'), null, 'chez un autre, il joue comme tout le monde')
  // Un rythme que la console ne connaît pas repasse au clic.
  stock.set('quizz.chef', JSON.stringify({ slug: 's-abc234', joue: false, rythme: 7 }))
  assert.deepEqual(chefIci('s-abc234'), { slug: 's-abc234', joue: false, rythme: null, equipes: false })
  // Un stockage illisible ne fait pas tomber la page.
  stock.set('quizz.chef', '{')
  assert.equal(chefIci('s-abc234'), null)
})

test('la barre vient à la demande, et ne montre rien de la question', () => {
  const joueur = source('views/PlayerApp.tsx')
  assert.match(joueur, /const barreDuChef = aLaDemande\(\(\) => import\('\.\.\/components\/BarreDuChef'\)\)/)
  assert.match(joueur, /useALaDemande\(barreDuChef, !!chef\)/, 'un invité n’en télécharge rien')
  // La vue d'animateur porte la note, puis la bonne réponse : la barre du
  // chef qui joue n'en lit que la phase, le compte des réponses et le programme.
  const barre = source('components/BarreDuChef.tsx')
  for (const champ of ['text', 'answers', 'note', 'correct', 'bonnes', 'ordre', 'target', 'counts', 'guesses', 'fastest', 'standings', 'image', 'son']) {
    assert.doesNotMatch(barre, new RegExp(`\\bv\\.${champ}\\b`), `la barre ne lit pas « ${champ} »`)
  }
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

let banc: Banc
before(async () => {
  banc = await demarrer()
})
after(() => banc.close())

test('un même navigateur tient les deux rôles : il joue par une liaison, anime par l’autre, et le quiz part au programme', async () => {
  const profil = await inscrireProfil(banc.url, 'chef', 'Chef', '🦁')
  const espace = await ecrire(banc.url, '/api/joueur/espace', {}, profil)
  const console_ = cookieDe(espace)
  const { espace: { slug } } = (await espace.json()) as { espace: { slug: string } }
  const quiz = await creerQuiz(banc.url, console_, [qcm('Un ?'), qcm('Deux ?')], 'Le quiz du chef')
  assert.ok((await ecrire(banc.url, '/api/programmes', { titre: 'Ce soir', entrees: [{ quizId: quiz, multiplier: 2 }] }, console_)).ok)
  await ecrire(banc.url, '/api/joueur/salon', {}, profil)
  // Les deux cookies, comme le navigateur les joint à chaque poignée de main.
  const cookies = `${profil}; ${console_}`

  const chef = await invite(banc.url, 'Chef', '🦁', { slug, cookie: cookies })
  const ami = await invite(banc.url, 'Ami', '🐸', { slug })
  const barre = connecter(banc.url, cookies)
  const hello = await emitAck<{ ok: boolean; slug: string }>(barre, 'host:hello', {})
  assert.deepEqual([hello.ok, hello.slug], [true, slug], 'la seconde liaison est celle de l’animateur')

  // « Lancer le quiz » : le choix arrive, au programme.
  const choix = attendre<any>(barre, 'session:view', p => p.view.phase === 'pickPack', 'le choix du quiz')
  ;(barre as any).emit('host:launch', { depuis: null })
  const { sessionId, view } = await choix
  assert.equal(view.programme.prochain, quiz)
  assert.equal(view.packs.find((p: any) => p.id === quiz).auProgramme.multiplier, 2)
  const question = attendre<any>(chef.socket, 'session:view', p => p.view.phase === 'question', 'la question, au téléphone du chef')
  const compte = attendre<any>(barre, 'session:view', p => p.view.phase === 'question', 'la question, à la barre')
  ;(barre as any).emit('host:command', { sessionId, command: { type: 'selectPack', packId: quiz, multiplier: 2, phase: 'pickPack', qIndex: 0, round: view.round } }, () => {})
  const vueJoueur = (await question).view
  assert.equal(vueJoueur.multiplier, 2)
  assert.equal(vueJoueur.correct, undefined, 'le chef reçoit la vue d’un joueur : pas la bonne réponse')
  assert.equal((await compte).view.participantCount, 2, 'le chef joue : il compte parmi les participants')

  // Il répond par sa liaison de joueur, et révèle par celle de l'animateur.
  const ack = await emitAck<any>(chef.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0, qIndex: 0, round: vueJoueur.round } })
  assert.equal(ack.ok, true)
  const revele = attendre<any>(ami.socket, 'session:view', p => p.view.phase === 'reveal', 'la révélation, chez l’ami')
  const enQuestion = (await compte).view
  ;(barre as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'question', qIndex: 0, round: enQuestion.round } }, () => {})
  const { view: chezAmi } = await revele
  assert.equal(chezAmi.laQuestion.trouvees, 1, 'la salle voit que le chef a trouvé')
})

// ── Les garde-fous de la barre (la tablée du 9 novembre 2026) ─────────────

test('« Révéler » ne part plus au premier toucher : la garde de la console, et une confirmation tant que la salle n’a pas répondu', () => {
  const barre = source('components/BarreDuChef.tsx')
  // « Question suivante » et « Révéler » sont sous le même pouce : le second
  // toucher d'un double toucher révélait la question suivante à zéro réponse.
  // La console avait sa garde (`gesteAccepte`), pas la barre.
  assert.ok(/import \{[^}]*\bgesteAccepte\b[^}]*\brevelationPrecoce\b[^}]*\} from '..\/..\/..\/shared\/console'/.test(barre), 'la barre lit les deux règles de la console')
  const reveler = barre.slice(barre.indexOf('const reveler = async'), barre.indexOf('let principal'))
  assert.ok(reveler.length > 0 && reveler.length < 2000, 'le geste « Révéler » de la barre')
  assert.ok(reveler.includes('gesteAccepte(changement.current, performance.now())'), 'il attend la demi-seconde qui suit un changement de phase')
  assert.ok(reveler.includes('revelationPrecoce(v.answeredCount ?? 0, v.participantCount ?? 0)'), 'il se confirme tant que moins de la moitié a répondu')
  // La visée se prend au toucher, pas à la confirmation (invariant 12) : la
  // question qui se révèle d'elle-même pendant la boîte ne fait pas passer à
  // la suivante.
  const visee = reveler.indexOf('const visee = { phase: v.phase, qIndex: v.qIndex, round: v.round }')
  assert.ok(visee > 0 && visee < reveler.indexOf('confirmDialog('), 'la visée d’abord, la boîte ensuite')
  assert.ok(reveler.includes("commande({ type: 'next', ...visee })"))
  assert.ok(/onClick=\{\(\) => void reveler\(\)\}>\s*Révéler/.test(barre), 'le bouton passe par ce geste')
  // « Question suivante » et « Le podium », sous le même doigt, attendent la même demi-seconde.
  assert.ok(/onClick=\{garde\(\(\) => commande\(\{ type: 'next' \}\)\)\}>\s*\{v\.qIndex \+ 1 < v\.qCount \? 'Question suivante' : 'Le podium'\}/.test(barre))
})

test('le gros « Terminer la soirée » du dernier podium demande, comme celui du menu', () => {
  const barre = source('components/BarreDuChef.tsx')
  // Il prenait la place de « Quiz suivant » et closait d'un toucher
  // (`onClick={clore}`) : une soirée close par un doigt qui glisse ne se rouvre pas.
  assert.ok(!barre.includes('onClick={clore}'), 'plus de clôture au premier toucher')
  assert.ok(barre.includes('principal = <TerminerLaSoiree onTerminer={() => void enregistrer()} />'))
  assert.ok(barre.includes("title: 'Terminer la soirée ?'"))
})

test('le chef range un invité sans équipe depuis sa barre, même en plein quiz', async () => {
  const barre = source('components/BarreDuChef.tsx')
  const liaison = source('socketDuChef.ts')
  assert.ok(liaison.includes("socket?.emit('host:assignPlayer', { playerId, teamId })"))
  assert.ok(barre.includes('onClick={() => rangerInvite(aRanger.id, t.id)}') || /rangerInvite\(aRanger\.id, t\.id\)/.test(barre), 'chaque équipe de la feuille y range l’invité')
  assert.ok(/c\.snapshot\.players\.filter\(p => !p\.teamId && !p\.horsClassement\)/.test(barre), 'ceux qui jouent sans équipe, pas le chef qui anime seulement')

  // Par la vraie liaison : quatre invités étaient entrés avant les équipes,
  // le quiz parti, plus personne ne pouvait les y mettre.
  const profil = await inscrireProfil(banc.url, 'rangeuse', 'Nadia', '🦉')
  const espace = await ecrire(banc.url, '/api/joueur/espace', {}, profil)
  const console_ = cookieDe(espace)
  const { espace: { slug } } = (await espace.json()) as { espace: { slug: string } }
  const quiz = await creerQuiz(banc.url, console_, [qcm('Un ?')], 'Le quiz de Nadia')
  assert.ok((await ecrire(banc.url, '/api/programmes', { titre: 'Ce soir', entrees: [{ quizId: quiz, multiplier: 1 }] }, console_)).ok)
  await ecrire(banc.url, '/api/joueur/salon', {}, profil)
  const cookies = `${profil}; ${console_}`
  const jeanne = await invite(banc.url, 'Jeanne', '🐢', { slug })
  const chef = connecter(banc.url, cookies)
  assert.equal((await emitAck<{ ok: boolean }>(chef, 'host:hello', {})).ok, true)
  // Les équipes arrivent après elle, puis le quiz part.
  const equipes = attendre<any>(chef, 'party:snapshot', s => s.teams.length === 2, 'les deux équipes')
  ;(chef as any).emit('host:seedTeams', { count: 2 })
  const [randonneurs] = (await equipes).teams
  const choix = attendre<any>(chef, 'session:view', p => p.view.phase === 'pickPack', 'le choix du quiz')
  ;(chef as any).emit('host:launch', { depuis: null })
  const { sessionId, view } = await choix
  const question = attendre<any>(jeanne.socket, 'session:view', p => p.view.phase === 'question', 'la question')
  ;(chef as any).emit('host:command', { sessionId, command: { type: 'selectPack', packId: quiz, multiplier: 1, phase: 'pickPack', qIndex: 0, round: view.round } }, () => {})
  await question
  const mot = attendre<any>(jeanne.socket, 'toast', () => true, 'le mot à Jeanne')
  const rangee = attendre<any>(chef, 'party:snapshot', s => s.players.some((p: any) => p.id === jeanne.playerId && p.teamId === randonneurs.id), 'Jeanne dans son équipe')
  ;(chef as any).emit('host:assignPlayer', { playerId: jeanne.playerId, teamId: randonneurs.id })
  await rangee
  assert.match((await mot).message, /t'a placé·e dans l'équipe/)
})

test('l’invitation en tête de la salle d’attente du chef : le code en grand et le QR, sur son seul téléphone', () => {
  const barre = source('components/BarreDuChef.tsx')
  // La barre pose l'invitation dans la place que la salle d'attente garde ;
  // chargée chez le chef seulement, elle n'apparaît nulle part ailleurs.
  assert.match(barre, /\{place && !enJeu && !commencee && createPortal\(<InvitationDuSalon code=\{code\} lien=\{lienDuCode\} \/>, place\)\}/)
  assert.match(barre, /document\.getElementById\('place-invitation'\)/)
  // Le code se dit d'une traite à l'oreille, les six cases ne sont que pour l'œil.
  assert.match(barre, /<span className="code-cases" role="img" aria-label=\{`Le code du salon : \$\{ecrireCode\(code\)\}`\}>/)
  assert.match(barre, /title="QR code pour rejoindre le salon"/)
  // La place n'existe qu'en salle d'attente, hors d'un quiz ; vide, elle ne prend aucun espace.
  assert.match(source('views/PlayerApp.tsx'), /\{!session && <div id="place-invitation" className="place-invitation" \/>\}/)
  assert.match(source('styles.css'), /\.place-invitation:empty \{ display: none; \}/)
})
