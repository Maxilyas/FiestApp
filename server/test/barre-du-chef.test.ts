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

test('l’invitation en tête de la salle d’attente du chef : le code en grand et le QR, sur son seul téléphone', () => {
  const barre = source('components/BarreDuChef.tsx')
  // La barre pose l'invitation dans la place que la salle d'attente garde ;
  // chargée chez le chef seulement, elle n'apparaît nulle part ailleurs.
  assert.match(barre, /\{place && !enJeu && createPortal\(<InvitationDuSalon code=\{code\} lien=\{lienDuCode\} \/>, place\)\}/)
  assert.match(barre, /document\.getElementById\('place-invitation'\)/)
  // Le code se dit d'une traite à l'oreille, les six cases ne sont que pour l'œil.
  assert.match(barre, /<span className="code-cases" role="img" aria-label=\{`Le code du salon : \$\{ecrireCode\(code\)\}`\}>/)
  assert.match(barre, /title="QR code pour rejoindre le salon"/)
  // La place n'existe qu'en salle d'attente, hors d'un quiz ; vide, elle ne prend aucun espace.
  assert.match(source('views/PlayerApp.tsx'), /\{!session && <div id="place-invitation" className="place-invitation" \/>\}/)
  assert.match(source('styles.css'), /\.place-invitation:empty \{ display: none; \}/)
})
