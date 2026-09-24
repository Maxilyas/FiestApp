// Les garde-fous que le smoke n'a jamais eus : ce qu'une soirée rejouée d'un
// bout à l'autre ne tente jamais, et qui la perdrait pourtant.
//
// · Un téléphone d'invité, une connexion qui ne s'est présentée à personne ou
//   l'écran commun d'un autre animateur n'actionnent aucune commande de cette
//   soirée — pas même « Nouvelle soirée », le seul geste de l'application qui
//   ne se rattrape pas.
// · Un chronomètre réarmé après un réveil sur disque effacé sonne pour de
//   vrai, et à son heure : la question se révèle, la suivante part, la photo
//   laisse place à la question.
// · Les refus de réponse que la soirée normale ne provoque pas ont chacun
//   leur accusé, leur motif, et ne comptent pas.
//
// Ces tests figent un comportement qui tenait déjà : ils passaient dès leur
// écriture. Chaque scénario a son serveur, et ils tournent en même temps.
import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  cookieDe,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  instantane,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import type { ClientToServerEvents } from '../../shared/events'
import { PALIERS_ENCHAINEMENT } from '../../shared/console'
import type { QuizQuestionDef } from '../../shared/library'

const SLUG = ADMIN.slug

const bancs: Banc[] = []

after(async () => {
  // Pas de fermeture test par test : `close()` referme toutes les connexions
  // ouvertes par le banc, y compris celles d'un scénario voisin encore en cours.
  for (const banc of bancs) await banc.close()
})

// ── Outils ────────────────────────────────────────────────────────────────

/** La dernière vue de partie reçue par chaque connexion. */
const vues = new WeakMap<Socket, any>()

function suivre(socket: Socket) {
  socket.on('session:view', (p: any) => vues.set(socket, p.view))
}

/** La dernière vue reçue si elle convient — sinon la prochaine qui conviendra. */
function vue(socket: Socket, pred: (v: any) => boolean, label: string, timeoutMs = 8000): Promise<any> {
  const deja = vues.get(socket)
  if (deja && pred(deja)) return Promise.resolve(deja)
  return attendre<any>(socket, 'session:view', p => pred(p.view), label, timeoutMs).then(p => p.view)
}

/** Ce qu'un écran avait sous les yeux : c'est ce que ses gestes emportent. */
const viseeDe = (v: any) => ({ phase: v.phase, qIndex: v.qIndex, round: v.round })

const envoyer = (s: Socket, event: string, ...args: unknown[]) => (s as any).emit(event, ...args)

function commande(host: Socket, sessionId: string, command: unknown) {
  envoyer(host, 'host:command', { sessionId, command })
}

/** Une réponse telle que la page l'envoie : avec la question qu'elle vise. */
function repondre(qui: Invite, sessionId: string, v: any, choice: number) {
  return emitAck<any>(qui.socket, 'player:action', {
    sessionId,
    action: { type: 'answer', choice, qIndex: v.qIndex, round: v.round },
  })
}

const joueur = (snap: any, id: string) => snap.players.find((p: any) => p.id === id)

/** Un invité dont on suit les vues dès la connexion — la première arrive derrière l'accusé. */
async function arrivee(url: string, name: string, avatar = '🦊'): Promise<Invite> {
  const socket = connecter(url)
  suivre(socket)
  const watched = await emitAck<any>(socket, 'party:watch', { slug: SLUG })
  assert.ok(watched.ok, `suivre la soirée : ${watched.error}`)
  const res = await emitAck<any>(socket, 'player:join', { slug: SLUG, name, avatar })
  assert.ok(res.ok, `${name} n’a pas pu rejoindre : ${res.error}`)
  return { socket, playerId: res.playerId, token: res.token }
}

/** Un serveur à soi, un quiz, un écran commun et des invités. */
async function soiree(questions: Partial<QuizQuestionDef>[], prenoms: string[]) {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, questions)
  const host = await ecranCommun(banc.url, cookie)
  suivre(host)
  const invites: Invite[] = []
  for (const [i, prenom] of prenoms.entries()) invites.push(await arrivee(banc.url, prenom, ['🦊', '🐼', '🐸', '🦁'][i % 4]))
  return { banc, cookie, quiz, host, invites }
}

/** Une photo « mémoire » : son adresse suffit, le serveur ne sert pas l'image pendant la partie. */
const PHOTO = '/media/image/00000000-0000-4000-8000-000000000000'

describe('les garde-fous', { concurrency: true }, () => {
  // ── 1. Les commandes d'animateur ────────────────────────────────────────

  /**
   * Toutes les commandes d'animateur du contrat, `host:hello` mis à part —
   * c'est lui qui présente l'écran commun. Le typecheck exige d'y ajouter
   * toute commande nouvelle : elle ne peut pas échapper à ce test.
   */
  type CommandeAnimateur = Exclude<Extract<keyof ClientToServerEvents, `host:${string}`>, 'host:hello'>
  const COMMANDES: Record<CommandeAnimateur, true> = {
    'host:launch': true,
    'host:command': true,
    'host:endSession': true,
    'host:closeParty': true,
    'host:discardParty': true,
    'host:resetParty': true,
    'host:archiveParty': true,
    'host:renamePlayer': true,
    'host:removePlayer': true,
    'host:createTeam': true,
    'host:updateTeam': true,
    'host:removeTeam': true,
    'host:seedTeams': true,
    'host:assignPlayer': true,
    'host:awardTeam': true,
    'host:removeBonus': true,
    'host:scene': true,
    'host:telecommande': true,
  }

  interface Cibles {
    sessionId: string
    quiz: string
    alice: string
    bob: string
    equipe: string
    autreEquipe: string
    prix: string
  }

  /** Tous les gestes d'un animateur, pointés sur ce qui existe dans la soirée. */
  const gestes = (c: Cibles): [CommandeAnimateur, unknown?][] => [
    ['host:launch'],
    ['host:command', { sessionId: c.sessionId, command: { type: 'selectPack', packId: c.quiz } }],
    ['host:command', { sessionId: c.sessionId, command: { type: 'autoNext', seconds: 5 } }],
    ['host:command', { sessionId: c.sessionId, command: { type: 'pause' } }],
    ['host:command', { sessionId: c.sessionId, command: { type: 'next' } }],
    ['host:endSession', { sessionId: c.sessionId }],
    ['host:renamePlayer', { playerId: c.bob, name: 'Pirate' }],
    ['host:assignPlayer', { playerId: c.alice, teamId: c.autreEquipe }],
    ['host:removePlayer', { playerId: c.bob }],
    ['host:createTeam', { name: 'Pirates', emoji: '🏴' }],
    ['host:updateTeam', { teamId: c.equipe, name: 'Piratés', emoji: '💀' }],
    ['host:removeTeam', { teamId: c.autreEquipe }],
    ['host:seedTeams'],
    ['host:awardTeam', { teamId: c.equipe, points: 5, reason: 'Pot-de-vin' }],
    ['host:removeBonus', { bonusId: c.prix }],
    ['host:scene', { ecran: 'victoire', depuis: null }],
    ['host:scene', { ecran: 'prix' }],
    ['host:telecommande', { active: true }],
    ['host:archiveParty', { title: 'Soirée volée' }],
    ['host:closeParty', { title: 'Soirée volée' }],
    ['host:discardParty'],
    ['host:resetParty'],
  ]

  /** Ce qu'on compare : la soirée telle qu'un écran commun tout neuf la relit, et son historique. */
  interface Photo {
    joueurs: string[]
    equipes: string[]
    prix: string[]
    partie: string | null
    archives: number
    /** Le titre sous lequel la soirée en cours est déjà rangée, s'il y en a un. */
    enCours: string | null
    /** L'écran de fin ouvert sur les écrans d'animateur, et la télécommande branchée. */
    scene: string | null
  }

  async function photographier(banc: Banc, cookie: string): Promise<Photo> {
    const ecran = connecter(banc.url, cookie)
    try {
      // La vue de la partie suit l'instantané, juste derrière l'accusé : on
      // l'écoute avant de se présenter.
      const vueEnCours = attendre<any>(ecran, 'session:view', () => true, 'la vue de la partie', 3000).catch(() => null)
      assert.equal((await emitAck<any>(ecran, 'host:hello', {})).ok, true, 'l’écran commun du témoin')
      const snap = await instantane<any>(ecran)
      const v = snap.session ? (await vueEnCours)?.view : null
      const { archives, current } = (await (await fetch(`${banc.url}/s/${SLUG}/soirees.json`)).json()) as any
      return {
        joueurs: snap.players.map((p: any) => `${p.id} ${p.name} ${p.teamId}`).sort(),
        equipes: snap.teams.map((t: any) => `${t.id} ${t.name} ${t.emoji}`).sort(),
        prix: snap.bonuses.map((b: any) => `${b.id} ${b.teamId} ${b.points} ${b.reason}`).sort(),
        partie: snap.session
          ? `${snap.session.id} ${v?.phase} Q${v?.qIndex} tour ${v?.round}${v?.paused ? ' en pause' : ''}` +
            ` · ${v?.answeredCount ?? '-'} réponse(s) · auto ${v?.autoNextSeconds ?? 'non'}`
          : null,
        archives: archives.length,
        enCours: current?.title ?? null,
        scene: `${snap.scene?.ecran ?? 'salle d’attente'}${snap.telecommande ? ' · télécommande' : ''}`,
      }
    } finally {
      ecran.close()
    }
  }

  test('aucune commande d’animateur ne passe par un téléphone d’invité, une connexion anonyme ou un autre espace', async () => {
    assert.deepEqual(
      new Set(gestes({} as Cibles).map(([event]) => event)),
      new Set(Object.keys(COMMANDES)),
      'chaque commande du contrat est tentée',
    )

    const { banc, cookie, quiz, host, invites } = await soiree(
      [qcm('Première ?', ['Oui', 'Non'], 0, 60), qcm('Seconde ?', ['Oui', 'Non'], 0, 60)],
      ['Alice', 'Bob'],
    )
    const [alice, bob] = invites
    const photo = () => photographier(banc, cookie)

    // Les intrus. Un invité inscrit, avec son identité à lui…
    const mallory = await arrivee(banc.url, 'Mallory', '🐍')
    // … une connexion qui suit la soirée sans y jouer…
    const curieux = connecter(banc.url)
    assert.equal((await emitAck<any>(curieux, 'party:watch', { slug: SLUG })).ok, true)
    // … une connexion qui ne s'est présentée à personne, un faux cookie
    // d'animateur en poche : la forme d'un jeton, aucune session derrière…
    const anonyme = connecter(banc.url, `qz_session=${'A'.repeat(43)}`)
    // … et l'écran commun, bien réel, d'un autre animateur.
    const admin = await connexionAnimateur(banc.url)
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'voisin', name: 'Voisin', slug: 'chez-le-voisin' }, admin)
    assert.equal(cree.status, 201, 'création du compte du voisin')
    const { activation } = (await cree.json()) as { activation: { token: string } }
    const active = await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'voisin-pass-1' })
    const voisin = await ecranCommun(banc.url, cookieDe(active))

    const intrus: [string, Socket][] = [
      ['le téléphone d’un invité', mallory.socket],
      ['une connexion qui suit la soirée sans y jouer', curieux],
      ['une connexion anonyme au faux cookie d’animateur', anonyme],
      ['l’écran commun d’un autre animateur', voisin],
    ]
    // Sans session, on ne se fait pas passer pour l'écran commun.
    for (const [qui, s] of intrus.slice(0, 3)) {
      assert.equal((await emitAck<any>(s, 'host:hello', {})).ok, false, `${qui} ne devient pas écran commun`)
    }

    /** Tous les gestes depuis une connexion ; l'heure du serveur sert de barrière. */
    const tenter = async (s: Socket, c: Cibles) => {
      for (const [event, charge] of gestes(c)) envoyer(s, event, ...(charge === undefined ? [] : [charge]))
      // Une connexion est traitée dans l'ordre : quand l'heure revient, tous
      // les gestes d'avant sont passés. Le reste du temps couvre une
      // diffusion regroupée, ou une écriture partie en arrière-plan.
      await emitAck(s, 'time:sync', {})
      await patienter(300)
    }

    // ── Premier tour : la soirée n'a encore ni équipe, ni partie, ni archive.
    const personne = { sessionId: 'aucune', equipe: 'aucune', autreEquipe: 'aucune', prix: 'aucun' }
    const cibles1: Cibles = { ...personne, quiz, alice: alice.playerId, bob: bob.playerId }
    const avant1 = await photo()
    assert.equal(avant1.joueurs.length, 3)
    for (const [qui, s] of intrus) {
      await tenter(s, cibles1)
      assert.deepEqual(await photo(), avant1, `${qui} ne doit rien changer à la soirée`)
    }

    // Témoin : depuis l'écran commun, les mêmes gestes portent. Ils posent le
    // décor du second tour — équipes, prix, et une partie en cours.
    envoyer(host, 'host:seedTeams')
    let snap = await instantane<any>(host, s => s.teams.length === 6, 'les six équipes par défaut')
    const [equipe, autreEquipe] = snap.teams.map((t: any) => t.id)
    envoyer(host, 'host:assignPlayer', { playerId: alice.playerId, teamId: equipe })
    envoyer(host, 'host:assignPlayer', { playerId: bob.playerId, teamId: autreEquipe })
    envoyer(host, 'host:awardTeam', { teamId: equipe, points: 2, reason: 'Karaoké' })
    snap = await instantane<any>(
      host,
      s => s.bonuses.length === 1 && joueur(s, bob.playerId)?.teamId === autreEquipe,
      'les équipes composées et le prix remis',
    )
    const prix = snap.bonuses[0].id
    const sessionId = await lancerQuiz(host, quiz)
    const q1 = await vue(alice.socket, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
    for (const qui of [alice, bob, mallory]) assert.equal((await repondre(qui, sessionId, q1, 0)).ok, true)
    const revelation = await vue(host, v => v.phase === 'reveal' && v.qIndex === 0, 'la première révélation')
    commande(host, sessionId, { type: 'next', ...viseeDe(revelation) })
    await vue(host, v => v.phase === 'question' && v.qIndex === 1, 'la seconde question')

    // ── Second tour : tout existe, et une question est ouverte.
    const cibles2: Cibles = { sessionId, quiz, alice: alice.playerId, bob: bob.playerId, equipe, autreEquipe, prix }
    const avant2 = await photo()
    assert.match(avant2.partie ?? '', /question Q1 .* 0 réponse\(s\) · auto non/)
    assert.equal(avant2.equipes.length, 6)
    assert.equal(avant2.prix.length, 1)
    for (const [qui, s] of intrus) {
      await tenter(s, cibles2)
      assert.deepEqual(await photo(), avant2, `${qui} ne doit rien changer à la partie en cours`)
    }

    // Témoin, encore : depuis l'écran commun, chacun de ces gestes porte. Sans
    // lui, un geste mal formé passerait ici pour un geste refusé.
    const temoin = async (event: CommandeAnimateur, charge: unknown, porte: (p: Photo) => boolean, label: string) => {
      envoyer(host, event, ...(charge === undefined ? [] : [charge]))
      const limite = Date.now() + 8000
      for (;;) {
        const p = await photo()
        if (porte(p)) return
        if (Date.now() > limite) assert.fail(`${label} : le geste de l’écran commun n’a pas porté (${JSON.stringify(p)})`)
        await patienter(100)
      }
    }
    const aJoueur = (p: Photo, ligne: string) => p.joueurs.includes(ligne)
    await temoin('host:renamePlayer', { playerId: bob.playerId, name: 'Pirate' }, p => aJoueur(p, `${bob.playerId} Pirate ${autreEquipe}`), 'renommer')
    await temoin('host:assignPlayer', { playerId: alice.playerId, teamId: autreEquipe }, p => aJoueur(p, `${alice.playerId} Alice ${autreEquipe}`), 'changer d’équipe')
    await temoin('host:updateTeam', { teamId: equipe, name: 'Piratés', emoji: '💀' }, p => p.equipes.includes(`${equipe} Piratés 💀`), 'renommer une équipe')
    await temoin('host:awardTeam', { teamId: equipe, points: 5, reason: 'Pot-de-vin' }, p => p.prix.some(l => l.endsWith(' 5 Pot-de-vin')), 'remettre un prix')
    await temoin('host:removeBonus', { bonusId: prix }, p => !p.prix.some(l => l.startsWith(prix)), 'retirer un prix')
    await temoin('host:removeTeam', { teamId: autreEquipe }, p => !p.equipes.some(l => l.startsWith(autreEquipe)), 'supprimer une équipe')
    await temoin('host:createTeam', { name: 'Pirates', emoji: '🏴' }, p => p.equipes.some(l => l.endsWith(' Pirates 🏴')), 'créer une équipe')
    await temoin('host:command', { sessionId, command: { type: 'autoNext', seconds: 5 } }, p => /auto 5$/.test(p.partie ?? ''), 'enchaîner seul')
    await temoin('host:command', { sessionId, command: { type: 'pause' } }, p => /en pause/.test(p.partie ?? ''), 'mettre en pause')
    await temoin('host:command', { sessionId, command: { type: 'next' } }, p => /reveal Q1/.test(p.partie ?? ''), 'révéler')
    await temoin('host:endSession', { sessionId }, p => p.partie === null, 'terminer le quiz')
    await temoin('host:archiveParty', { title: 'Soirée rangée' }, p => p.enCours === 'Soirée rangée', 'ranger la soirée sous un titre')
    await temoin('host:launch', undefined, p => /pickPack/.test(p.partie ?? ''), 'lancer un quiz')
    await temoin('host:removePlayer', { playerId: bob.playerId }, p => !p.joueurs.some(l => l.startsWith(bob.playerId)), 'exclure')
    await temoin(
      'host:closeParty',
      { title: 'Soirée close' },
      p => p.joueurs.length === 0 && p.archives === 1 && p.enCours === null,
      'clore la soirée',
    )
    // Une soirée d'essai : on joue, puis on efface sans rien garder.
    const essai = await arrivee(banc.url, 'Essai', '🦊')
    const sessionEssai = await lancerQuiz(host, quiz)
    const qe = await vue(essai.socket, v => v.phase === 'question' && v.qIndex === 0, 'la question de l’essai')
    assert.equal((await repondre(essai, sessionEssai, qe, 0)).ok, true)
    // Seule la question révélée entre au journal : celle qu'on refermerait
    // encore ouverte ne compterait pas.
    await vue(host, v => v.phase === 'reveal' && v.qIndex === 0, 'la révélation de l’essai')
    envoyer(host, 'host:endSession', { sessionId: sessionEssai })
    for (let limite = Date.now() + 8000; (await photo()).enCours === null; await patienter(100)) {
      if (Date.now() > limite) assert.fail('l’essai aurait dû se ranger tout seul après son quiz')
    }
    await temoin('host:discardParty', undefined, p => p.joueurs.length === 0 && p.archives === 1 && p.enCours === null, 'effacer un essai')
    await arrivee(banc.url, 'Dora', '🐼')
    await temoin('host:resetParty', undefined, p => p.joueurs.length === 0, 'l’ancien « Nouvelle soirée » clôt la soirée')
  })

  test('chaque palier d’enchaînement de la console s’arme tel quel à la révélation', async () => {
    // Le serveur bornait l'enchaînement : un palier que la console propose
    // mais qu'il raccourcirait ferait partir la question suivante pendant
    // que l'animateur commente encore — ce que les paliers longs évitent.
    const { quiz, host } = await soiree([qcm('Une ?'), qcm('Deux ?')], ['Alice'])
    const sessionId = await lancerQuiz(host, quiz)
    const question = await vue(host, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
    commande(host, sessionId, { type: 'next', ...viseeDe(question) })
    await vue(host, v => v.phase === 'reveal' && v.qIndex === 0, 'la révélation')
    for (const palier of [...PALIERS_ENCHAINEMENT.slice(1), null]) {
      const avant = Date.now()
      commande(host, sessionId, { type: 'autoNext', seconds: palier })
      const v = await vue(host, v => (v.autoNextSeconds ?? null) === palier, `l’enchaînement à ${palier ?? 'la main'}`)
      assert.equal(v.phase, 'reveal', 'la révélation est toujours à l’écran')
      if (palier === null) {
        assert.equal(v.autoNextAt, undefined, 'repasser au clic désarme l’enchaînement')
      } else {
        assert.ok(v.autoNextAt >= avant + palier * 1000, `${palier} s : armé ${avant + palier * 1000 - v.autoNextAt} ms trop court`)
        assert.ok(v.autoNextAt <= Date.now() + palier * 1000, `${palier} s : armé trop loin`)
      }
    }
  })

  // ── 2. Les chronomètres, après un réveil sur disque effacé ──────────────
  //
  // L'hébergeur gratuit efface la base locale à chaque réveil : la partie
  // revient du miroir distant, chronomètres compris, et le moteur les réarme.
  // Encore faut-il qu'ils sonnent — et pas avant leur heure : une échéance
  // perdue en route les réarmerait à cinquante millisecondes.

  /** Un nouvel écran commun après le réveil, et la première vue qui satisfait le prédicat. */
  async function apresLeReveil(banc: Banc, cookie: string, pred: (v: any) => boolean, label: string) {
    const ecran = connecter(banc.url, cookie)
    // Posé avant de se présenter : la vue en cours arrive juste derrière l'accusé.
    const attendue = attendre<any>(ecran, 'session:view', p => pred(p.view), label, 20_000)
    assert.equal((await emitAck<any>(ecran, 'host:hello', {})).ok, true, 'l’écran commun se représente')
    const { view } = await attendue
    return { view, a: Date.now() }
  }

  test('réveil sur disque effacé : la question en cours se révèle à son heure', async () => {
    const { banc, cookie, quiz, host } = await soiree([qcm('Tic-tac ?', ['Oui', 'Non'], 0, 12)], ['Alice'])
    await lancerQuiz(host, quiz)
    const question = await vue(host, v => v.phase === 'question', 'la question')
    // On éteint bien avant l'échéance : c'est le serveur rallumé qui doit révéler.
    assert.ok(Date.now() + 2000 < question.deadline, 'la question vient de commencer')
    await banc.redemarrer({ disqueEfface: true })

    const { view, a } = await apresLeReveil(banc, cookie, v => v.phase === 'reveal', 'la révélation après le réveil')
    assert.ok(a >= question.deadline, `révélée ${question.deadline - a} ms avant l’échéance`)
    assert.equal(view.qIndex, 0)
    assert.equal(view.correct, 0, 'la bonne réponse est à l’écran')
    assert.equal(view.answeredCount, 0)
  })

  test('réveil sur disque effacé : l’enchaînement automatique lance la question suivante', async () => {
    const { banc, cookie, quiz, host } = await soiree([qcm('Une ?'), qcm('Deux ?')], ['Alice'])
    const sessionId = await lancerQuiz(host, quiz)
    const question = await vue(host, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
    commande(host, sessionId, { type: 'autoNext', seconds: 8 })
    commande(host, sessionId, { type: 'next', ...viseeDe(question) })
    const revelation = await vue(host, v => v.phase === 'reveal' && typeof v.autoNextAt === 'number', 'la révélation qui enchaîne')
    assert.ok(Date.now() + 2000 < revelation.autoNextAt, 'l’enchaînement vient d’être armé')
    await banc.redemarrer({ disqueEfface: true })

    const { view, a } = await apresLeReveil(banc, cookie, v => v.phase === 'question' && v.qIndex === 1, 'la question suivante')
    assert.ok(a >= revelation.autoNextAt, `enchaînée ${revelation.autoNextAt - a} ms avant l’heure`)
    assert.equal(view.text, 'Deux ?')
  })

  test('réveil sur disque effacé : la photo à mémoriser laisse place à la question', async () => {
    const { banc, cookie, quiz, host } = await soiree(
      [{ ...qcm('Combien de bougies sur le gâteau ?', ['Trente', 'Quarante']), image: PHOTO, observeSeconds: 10 }],
      ['Alice'],
    )
    await lancerQuiz(host, quiz)
    const observation = await vue(host, v => v.phase === 'observe', 'la photo à mémoriser')
    assert.ok(Date.now() + 2000 < observation.deadline, 'la photo vient d’apparaître')
    await banc.redemarrer({ disqueEfface: true })

    const { view, a } = await apresLeReveil(banc, cookie, v => v.phase === 'question', 'la question après la photo')
    assert.ok(a >= observation.deadline, `question posée ${observation.deadline - a} ms avant la fin de la photo`)
    assert.equal(view.image, null, 'la photo a disparu')
    assert.equal(view.photoGone, true, 'et l’écran le dit')
    assert.deepEqual(view.answers, ['Trente', 'Quarante'])
  })

  // ── 3. Les accusés que la soirée normale ne provoque jamais ─────────────

  test('pendant la photo, en pause, hors de la partie, sans identité : chaque refus a son accusé, et ne compte pas', async () => {
    const { banc, quiz, host, invites } = await soiree(
      [
        { ...qcm('Combien de bougies sur le gâteau ?', ['Trente', 'Quarante'], 0, 60), image: PHOTO, observeSeconds: 3 },
        qcm('Et ensuite ?', ['Oui', 'Non'], 0, 60),
      ],
      ['Alice', 'Bob'],
    )
    const [alice, bob] = invites
    // Le téléphone de Bob s'endort avant le lancement : il n'est pas de la partie.
    bob.socket.close()
    await instantane<any>(host, s => joueur(s, bob.playerId)?.connected === false, 'Bob endormi')
    const sessionId = await lancerQuiz(host, quiz)

    // ── too-late : une réponse pendant la photo à mémoriser.
    const observation = await vue(alice.socket, v => v.phase === 'observe', 'la photo sur le téléphone')
    const pendantLaPhoto = await repondre(alice, sessionId, observation, 0)
    assert.equal(pendantLaPhoto.ok, false)
    assert.equal(pendantLaPhoto.reason, 'too-late')
    assert.equal(typeof pendantLaPhoto.error, 'string')
    // Une page d'avant, qui ne dit pas quelle question elle vise, pareil.
    const sansVisee = await emitAck<any>(alice.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
    assert.equal(sansVisee.reason, 'too-late')
    const question = await vue(alice.socket, v => v.phase === 'question', 'la question après la photo')
    assert.equal(question.yourChoice, null, 'la réponse tapée pendant la photo n’a pas été retenue')

    // ── not-participant : Bob se réveille et répond, sans s'être représenté.
    // La réponse porte l'espace et le jeton — c'est la voie des coupures.
    const reveil = connecter(banc.url)
    const horsPartie = await emitAck<any>(reveil, 'player:action', {
      slug: SLUG,
      token: bob.token,
      sessionId,
      action: { type: 'answer', choice: 0, qIndex: question.qIndex, round: question.round },
    })
    assert.equal(horsPartie.ok, false)
    assert.equal(horsPartie.reason, 'not-participant')
    assert.match(horsPartie.error, /pas dans cette partie/)

    // ── unknown-player : un jeton que personne ne porte, puis pas de jeton du tout.
    const action = { type: 'answer', choice: 0, qIndex: question.qIndex, round: question.round }
    const jetonInconnu = await emitAck<any>(connecter(banc.url), 'player:action', {
      slug: SLUG,
      token: 'jeton-que-personne-ne-porte',
      sessionId,
      action,
    })
    assert.equal(jetonInconnu.reason, 'unknown-player')
    assert.match(jetonInconnu.error, /retente/)
    const curieux = connecter(banc.url)
    await emitAck(curieux, 'party:watch', { slug: SLUG })
    assert.equal((await emitAck<any>(curieux, 'player:action', { sessionId, action })).reason, 'unknown-player')

    // ── paused : l'animateur a figé le chronomètre.
    commande(host, sessionId, { type: 'pause' })
    await vue(alice.socket, v => v.paused === true, 'la pause sur le téléphone')
    const enPause = await repondre(alice, sessionId, question, 0)
    assert.equal(enPause.ok, false)
    assert.equal(enPause.reason, 'paused')
    assert.match(enPause.error, /pause/)
    commande(host, sessionId, { type: 'resume' })
    await vue(alice.socket, v => v.phase === 'question' && !v.paused, 'la reprise')
    assert.equal((await vue(host, v => !v.paused, 'la reprise à l’écran')).answeredCount, 0, 'aucun refus n’a compté')

    // La même réponse, après la reprise, passe — et Alice était la seule attendue.
    assert.equal((await repondre(alice, sessionId, question, 0)).ok, true)
    const revelation = await vue(host, v => v.phase === 'reveal', 'la révélation')
    assert.equal(revelation.answeredCount, 1, 'seule la réponse d’après la reprise compte')
    assert.deepEqual(revelation.counts, [1, 0])

    // ── Arrivé pendant la révélation, Carl répond à la question révélée.
    // Refusé « trop tard », et non « pas dans la partie » : la phase se juge
    // avant la participation. Aucune page honnête n'envoie ce geste — son
    // téléphone lui souhaite la bienvenue —, et le message reste vrai pour
    // lui : la question était finie quand il est arrivé.
    const carl = await arrivee(banc.url, 'Carl', '🦁')
    const accueil = await vue(carl.socket, v => v.phase === 'reveal', 'l’accueil de Carl')
    assert.equal(accueil.justArrived, true)
    const surCelleCi = await repondre(carl, sessionId, accueil, 0)
    assert.equal(surCelleCi.ok, false)
    assert.equal(surCelleCi.reason, 'too-late')
    // Il joue à partir de la suivante.
    commande(host, sessionId, { type: 'next', ...viseeDe(revelation) })
    const suivante = await vue(carl.socket, v => v.phase === 'question' && v.qIndex === 1, 'la question suivante chez Carl')
    assert.equal((await repondre(carl, sessionId, suivante, 1)).ok, true, 'Carl joue la question suivante')
  })
})
