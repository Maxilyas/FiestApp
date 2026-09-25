// Le nom d'une soirée, et tout ce qui s'écrit sous ce nom.
//
// Une soirée s'archive, crédite l'expérience du soir et range ses prix sous
// un identifiant : c'est lui qui fait d'un second archivage une mise à jour,
// et d'un second crédit un remplacement. On le recalculait à chaque besoin
// depuis le plus ancien invité encore là — exclure le téléphone d'essai de
// l'animateur suffisait à rebaptiser la soirée, et tout ce qui s'écrivait
// ensuite se comptait deux fois : l'expérience, l'historique, l'Éclat.
//
// Les prix de soirée, eux, se décernaient à chaque archivage sans jamais se
// reprendre : « Sauvegarder » en cours de soirée figeait des badges que la
// fin de soirée donnait à quelqu'un d'autre. Ils ne se décident plus qu'à la
// clôture, sur la soirée entière.
//
// Une question ne rapporte d'expérience que posée à deux joueurs au moins :
// chaque scénario a donc sa salle, deux figurants qui se trompent — Alice
// reste seule à trouver, sans réflexe à partager.
//
// Chaque test a son propre serveur jetable : une soirée jouée dans l'un
// fausserait l'historique et l'expérience de l'autre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  inscrireProfil,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { XP } from '../../shared/profil'
import { archiveIdOf } from '../src/core/archive'
import { ProfileStore } from '../src/auth/profiles'

// L'Éclat se tire une chance sur quarante par soirée, et le premier fait
// tomber un palier de carrière : dix points de plus à la clôture, que le
// crédit de la soirée suivante annoncerait. Ici, le hasard ne décide de rien.
ProfileStore.tirageEclat = () => false

// ── Outils ────────────────────────────────────────────────────────────────

/** Un serveur jetable le temps d'un test, refermé quoi qu'il arrive. */
async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

/** Qui répond quoi, question par question. */
type Reponses = [Invite, number][][]

/**
 * Joue un quiz de bout en bout depuis l'écran commun, puis le termine comme
 * l'animateur le ferait — c'est ce clic-là qui crédite l'expérience.
 *
 * Tous les participants répondent à chaque question : la salle révèle alors
 * d'elle-même après le souffle. Forcer la révélation pendant que ce souffle
 * court ferait sauter une question sur une machine chargée.
 */
async function jouerQuiz(host: Socket, quizId: string, questions: Reponses): Promise<void> {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [qui, choice] of questions[q]) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
      assert.equal(ack.ok, true, `réponse ${q + 1} refusée : ${ack.error}`)
    }
    await revelee
    suivante =
      q + 1 < questions.length
        ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `la question ${q + 2}`)
        : vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  ;(host as any).emit('host:endSession', { sessionId })
}

/**
 * L'ancien « Sauvegarder », qu'un écran resté sur une page d'avant peut
 * encore envoyer : la soirée se range sous un titre, sans rien clore.
 */
async function sauvegarder(host: Socket) {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée rangée', 15_000)
  ;(host as any).emit('host:archiveParty', {})
  const t = await toast
  assert.equal(t.kind, 'info', `l’archivage a échoué : ${t.message}`)
}

/** « Clore la soirée » : elle se range une dernière fois, puis tout repart de zéro. */
async function clore(host: Socket) {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
  ;(host as any).emit('host:closeParty', {})
  const t = await toast
  assert.equal(t.kind, 'info', `la clôture a échoué : ${t.message}`)
}

/** Les soirées closes de l'espace, de la plus récente à la plus ancienne. */
async function historique(banc: Banc): Promise<{ id: string; heldAt: number }[]> {
  const res = await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)
  return ((await res.json()) as any).archives
}

/**
 * La soirée en cours telle que l'historique la montre, à part : elle s'y
 * range toute seule après chaque quiz, sous `id`.
 */
async function enCours(banc: Banc): Promise<{ id?: string; title?: string } | null> {
  const res = await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)
  return ((await res.json()) as any).current
}

/** Deux figurants anonymes : avec eux, Alice ne joue jamais seule. */
async function figurants(banc: Banc): Promise<Invite[]> {
  return [await invite(banc.url, 'Bob', '🐻'), await invite(banc.url, 'Dora', '🐙')]
}

/** Des figurants qui se re-présentent après un redémarrage : leurs téléphones gardaient leur jeton. */
function reviennent(banc: Banc, salle: Invite[]): Promise<Invite[]> {
  return Promise.all(salle.map(i => invite(banc.url, '', '', { token: i.token })))
}

/** Ils se trompent tous : Alice reste seule à trouver. */
const faux = (salle: Invite[]): [Invite, number][] => salle.map(i => [i, 1])

/** Le fichier de la base permanente — celle qui tient le rôle de Turso. */
const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

/** Lit une base sans passer par le serveur, comme on irait vérifier à la main. */
function lire<T = any>(chemin: string, sql: string, ...args: unknown[]): T[] {
  const db = new Database(chemin, { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}

/** L'identifiant de l'espace du banc — son nom de soirée en porte l'empreinte. */
const espaceDe = (banc: Banc): string =>
  lire<{ id: string }>(permanente(banc), 'SELECT id FROM accounts WHERE slug = ?', ADMIN.slug)[0].id

const profilDe = (banc: Banc, login: string): string =>
  lire<{ id: string }>(permanente(banc), 'SELECT id FROM profiles WHERE login = ?', login)[0].id

/**
 * Les lignes d'expérience d'un profil — une par soirée, s'il n'y a pas de
 * doublon. Celle des paliers de carrière (`#paliers`) n'est pas une soirée.
 */
const lignesXp = (banc: Banc, profileId: string) =>
  lire<{ soiree_id: string; xp: number }>(
    permanente(banc),
    `SELECT soiree_id, xp FROM profile_xp WHERE profile_id = ? AND soiree_id NOT LIKE '#%' ORDER BY created_at`,
    profileId,
  )

/** Qui porte ce prix pour cette soirée. */
const laureats = (banc: Banc, soiree: string, badge: string) =>
  lire<{ profile_id: string }>(
    permanente(banc),
    'SELECT profile_id FROM profile_badges WHERE soiree_id = ? AND badge = ?',
    soiree,
    badge,
  ).map(r => r.profile_id)

/** L'heure d'arrivée d'un invité, telle que la base locale l'a notée. */
const arrivee = (banc: Banc, playerId: string): number =>
  lire<{ created_at: number }>(banc.dbPath, 'SELECT created_at FROM players WHERE id = ?', playerId)[0].created_at

/** L'heure de la première question jouée dans la soirée : celle qui la date. */
const premiereQuestion = (banc: Banc): number =>
  lire<{ t: number }>(banc.dbPath, 'SELECT MIN(created_at) AS t FROM answer_log WHERE answered = 1')[0].t

/**
 * Le nombre de badges que l'écran d'entrée annonce à ce profil. Il vient du
 * compteur gardé en mémoire : la page du profil, elle, le recalcule — il faut
 * donc le lire avant elle.
 */
async function badgesALEntree(banc: Banc, cookie: string): Promise<number | undefined> {
  const tel = connecter(banc.url, cookie)
  try {
    const salut = await emitAck<any>(tel, 'party:watch', { slug: ADMIN.slug })
    return salut.profile?.badges
  } finally {
    tel.close()
  }
}

/**
 * Ce que vaut une soirée où Alice trouve seule chaque question d'un quiz
 * d'une question : une réponse, une bonne réponse. Ni réflexe (il faut trois
 * bonnes réponses pour avoir un tiers le plus rapide), ni podium de quiz (il
 * faut cinq questions), ni podium de soirée (il faut quinze questions).
 */
const xpDeSoiree = (quiz: number) => quiz * (XP.reponse + XP.juste)

/**
 * Le décor des scénarios d'exclusion : le téléphone d'essai de l'animateur
 * arrive le premier — c'est toujours lui —, Alice ensuite, avec son profil,
 * puis deux figurants.
 */
async function essaiPuisAlice(banc: Banc) {
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
  const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
  const host = await ecranCommun(banc.url, cookie)
  const essai = await invite(banc.url, 'Test', '🤖')
  // Deux arrivées dans la même milliseconde ne diraient pas qui était là le premier.
  await patienter(20)
  const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
  const salle = await figurants(banc)
  return { quiz, aliceCookie, host, essai, alice, salle, aliceId: profilDe(banc, 'alice') }
}

// ── L'identifiant de la soirée ────────────────────────────────────────────

test('exclure le premier arrivé entre deux quiz ne rebaptise pas la soirée', () =>
  avecBanc(async banc => {
    const { quiz, aliceCookie, host, essai, alice, salle, aliceId } = await essaiPuisAlice(banc)

    const premier = attendre<any>(alice.socket, 'player:profil', p => p.xp > 0, 'le crédit du premier quiz', 15_000)
    await jouerQuiz(host, quiz, [[[alice, 0], [essai, 1], ...faux(salle)]])
    assert.equal((await premier).xp, xpDeSoiree(1), 'Alice trouve seule la question du premier quiz')
    // Une soirée se date à sa première question jouée.
    const debut = premiereQuestion(banc)
    // Le quiz fini, la soirée s'est rangée toute seule sous son nom.
    const rangee = await enCours(banc)
    assert.equal(rangee?.id, archiveIdOf(debut, espaceDe(banc)), 'la soirée s’est rangée d’elle-même après le quiz')

    ;(host as any).emit('host:removePlayer', { playerId: essai.playerId })
    await attendre(essai.socket, 'player:removed', () => true, 'l’exclusion du téléphone d’essai')

    const second = attendre<any>(alice.socket, 'player:profil', p => p.xp !== xpDeSoiree(1), 'le crédit du second quiz', 15_000)
    await jouerQuiz(host, quiz, [[[alice, 0], ...faux(salle)]])
    // Deux réponses, deux bonnes réponses.
    assert.equal(xpDeSoiree(2), 8)
    assert.equal((await second).xp, xpDeSoiree(2), 'l’expérience d’une soirée se remplace, elle ne s’additionne pas')
    await clore(host)

    const lignes = lignesXp(banc, aliceId)
    assert.equal(lignes.length, 1, `une seule ligne d’expérience pour la soirée (vu : ${lignes.map(l => l.soiree_id).join(', ')})`)
    assert.equal(lignes[0].xp, xpDeSoiree(2))
    const archives = await historique(banc)
    assert.equal(archives.length, 1, 'la soirée close n’apparaît qu’une fois dans l’historique')
    assert.equal(archives[0].id, lignes[0].soiree_id, 'l’archive et l’expérience portent le même nom')
    // L'heure de début reste celle du premier arrivé, même exclu depuis.
    assert.equal(archives[0].heldAt, debut)
    assert.equal(archives[0].id, archiveIdOf(debut, espaceDe(banc)))
    // Les paliers de carrière se comptent en soirées : rebaptisée, celle-ci
    // aurait compté double sur la fiche, et L'Habitué serait tombé une
    // soirée trop tôt.
    const moi = (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: aliceCookie } })).json()) as any
    assert.equal(moi.profile.fiche.soirees, 1, 'une soirée, comptée une fois')
  }))

test('un réveil sur disque effacé en pleine soirée garde son nom', () =>
  avecBanc(async banc => {
    const { quiz, aliceCookie, host, essai, alice, salle, aliceId } = await essaiPuisAlice(banc)
    const premier = attendre<any>(alice.socket, 'player:profil', p => p.xp > 0, 'le crédit du premier quiz', 15_000)
    await jouerQuiz(host, quiz, [[[alice, 0], [essai, 1], ...faux(salle)]])
    await premier
    const avant = await enCours(banc)
    assert.ok(avant?.id, 'la soirée s’est rangée après le premier quiz')

    ;(host as any).emit('host:removePlayer', { playerId: essai.playerId })
    await attendre(essai.socket, 'player:removed', () => true, 'l’exclusion du téléphone d’essai')
    // Le miroir distant part en arrière-plan : on lui laisse le temps d'arriver.
    await patienter(400)

    // L'hébergeur recycle l'instance : seule la base permanente reste.
    await banc.redemarrer({ disqueEfface: true })
    const host2 = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    const alice2 = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    assert.equal(alice2.playerId, alice.playerId, 'Alice retrouve son invité après le réveil')
    const salle2 = await reviennent(banc, salle)

    const second = attendre<any>(alice2.socket, 'player:profil', p => p.xp !== xpDeSoiree(1), 'le crédit du second quiz', 15_000)
    await jouerQuiz(host2, quiz, [[[alice2, 0], ...faux(salle2)]])
    assert.equal((await second).xp, xpDeSoiree(2), 'le réveil ne crédite pas la soirée une seconde fois')
    assert.equal((await enCours(banc))?.id, avant.id, 'la soirée garde son nom après le réveil')
    await clore(host2)

    const archives = await historique(banc)
    assert.deepEqual(
      archives.map(a => a.id),
      [avant.id],
      'l’archivage d’après le réveil met à jour l’archive au lieu d’en créer une seconde',
    )
    assert.deepEqual(
      lignesXp(banc, aliceId).map(l => l.soiree_id),
      [avant.id],
      'une seule ligne d’expérience, sous le nom d’avant le réveil',
    )
  }))

test('« Clore la soirée » : la suivante porte un autre nom, même après un réveil sur disque effacé', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const aliceId = profilDe(banc, 'alice')
    const host = await ecranCommun(banc.url, cookie)

    /** Alice joue une soirée d'un quiz ; rend l'expérience que son téléphone annonce. */
    const soireeDAlice = async (h: Socket, qui: Invite, salle: Invite[]) => {
      const credit = attendre<any>(qui.socket, 'player:profil', () => true, 'le crédit du quiz', 15_000)
      await jouerQuiz(h, quiz, [[[qui, 0], ...faux(salle)]])
      return (await credit).xp as number
    }

    // La première soirée, close.
    const alice1 = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    assert.equal(await soireeDAlice(host, alice1, await figurants(banc)), xpDeSoiree(1))
    await clore(host)

    // La deuxième, dans la foulée : un nom oublié en mémoire la confondrait
    // avec la première, et son expérience écraserait celle d'hier.
    const alice2 = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    assert.notEqual(alice2.playerId, alice1.playerId, 'après la clôture, Alice est une nouvelle invitée')
    assert.equal(await soireeDAlice(host, alice2, await figurants(banc)), 2 * xpDeSoiree(1), 'deux soirées, deux crédits')
    await clore(host)
    const deux = (await historique(banc)).map(a => a.id)
    assert.equal(deux.length, 2, 'deux soirées, deux archives')
    assert.notEqual(deux[0], deux[1])

    // La troisième commence, puis l'hébergeur recycle l'instance avant le
    // moindre quiz : le miroir ne doit pas lui rendre le nom de la précédente.
    await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    await patienter(400)
    await banc.redemarrer({ disqueEfface: true })
    const host3 = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    const alice3 = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    assert.equal(await soireeDAlice(host3, alice3, await figurants(banc)), 3 * xpDeSoiree(1), 'trois soirées, trois crédits')
    await clore(host3)

    const trois = (await historique(banc)).map(a => a.id)
    assert.equal(new Set(trois).size, 3, `trois soirées, trois noms (vu : ${trois.join(', ')})`)
    assert.deepEqual(
      lignesXp(banc, aliceId).map(l => l.soiree_id).sort(),
      [...trois].sort(),
      'une ligne d’expérience par soirée, chacune sous son nom',
    )
    // Trois soirées font L'Habitué, au Bronze : il tombe à la clôture de la
    // troisième, une seule fois, et sous son nom.
    assert.deepEqual(laureats(banc, trois[0], 'hf:habitue:1'), [aliceId], 'L’Habitué tombe à la troisième clôture')
    const paliers = lire<{ n: number }>(
      permanente(banc),
      `SELECT COUNT(*) AS n FROM profile_badges WHERE profile_id = ? AND badge = 'hf:habitue:1'`,
      aliceId,
    )
    assert.equal(paliers[0].n, 1, 'un palier ne tombe qu’une fois')
  }))

test('une soirée commencée avant la mise à jour garde le nom qu’elle avait', () =>
  avecBanc(async banc => {
    const { quiz, aliceCookie, host, essai, alice, salle, aliceId } = await essaiPuisAlice(banc)
    const premier = attendre<any>(alice.socket, 'player:profil', p => p.xp > 0, 'le crédit du premier quiz', 15_000)
    await jouerQuiz(host, quiz, [[[alice, 0], [essai, 1], ...faux(salle)]])
    await premier
    await patienter(400)
    // Le nom qu'elle avait : le serveur d'avant la datait à l'arrivée du
    // premier invité, sans l'empreinte de l'espace ; celui du jour la date à
    // sa première question jouée, avec l'empreinte. Ce qu'on garde ici, c'est
    // que le nom d'avant se retrouve pareil au réveil, et se fige.
    const debut = arrivee(banc, essai.playerId)

    // Le serveur d'avant ne rangeait le nom de la soirée nulle part, et le
    // tirait sans l'empreinte de l'espace. On imite ce qu'il aurait laissé à
    // une soirée en cours au moment du déploiement : des invités, leurs
    // points, une archive et de l'expérience déjà écrites sous ce nom-là —
    // et aucune ligne dans `party_soiree`.
    const avant = archiveIdOf(debut, null)
    const duJour = archiveIdOf(premiereQuestion(banc), espaceDe(banc))
    assert.notEqual(avant, duJour)
    const db = new Database(permanente(banc))
    try {
      const rebaptiser = db.transaction(() => {
        assert.equal(db.prepare('UPDATE soirees SET id = ? WHERE id = ?').run(avant, duJour).changes, 1, 'l’archive du premier quiz')
        assert.ok(
          db.prepare('UPDATE profile_xp SET soiree_id = ? WHERE soiree_id = ?').run(avant, duJour).changes > 0,
          'l’expérience du premier quiz',
        )
        db.prepare('UPDATE profile_badges SET soiree_id = ? WHERE soiree_id = ?').run(avant, duJour)
        db.prepare('DELETE FROM party_soiree').run()
      })
      rebaptiser()
    } finally {
      db.close()
    }
    // Le déploiement arrive sur un disque neuf : tout revient du miroir.
    await banc.redemarrer({ disqueEfface: true })

    // Le premier arrivé s'en va après la mise à jour…
    const host2 = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    ;(host2 as any).emit('host:removePlayer', { playerId: essai.playerId })
    await instantane<any>(
      host2,
      s => !s.players.some((p: any) => p.id === essai.playerId),
      'l’exclusion du téléphone d’essai',
    )
    // … et l'hébergeur recycle encore l'instance : le nom retrouvé au premier
    // réveil doit avoir été figé, miroir compris — sans le premier arrivé, on
    // ne saurait plus le recalculer.
    await patienter(400)
    await banc.redemarrer({ disqueEfface: true })
    const host3 = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    const alice3 = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    assert.equal(alice3.playerId, alice.playerId)
    const salle3 = await reviennent(banc, salle)

    const second = attendre<any>(alice3.socket, 'player:profil', p => p.xp !== xpDeSoiree(1), 'le crédit du second quiz', 15_000)
    await jouerQuiz(host3, quiz, [[[alice3, 0], ...faux(salle3)]])
    assert.equal((await second).xp, xpDeSoiree(2), 'la soirée d’avant la mise à jour ne se crédite pas deux fois')
    await clore(host3)

    const archives = await historique(banc)
    assert.deepEqual(archives.map(a => a.id), [avant], 'l’archive d’avant la mise à jour est mise à jour, pas doublée')
    assert.deepEqual(lignesXp(banc, aliceId).map(l => l.soiree_id), [avant])
  }))

// ── Les prix de soirée ────────────────────────────────────────────────────

test('les prix ne se décident qu’à la clôture : rien de ce qui se range en cours de soirée ne les fige', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const trois = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?'), qcm('Trois ?')], 'Trois questions')
    const quatre = await creerQuiz(
      banc.url,
      cookie,
      [qcm('Quatre ?'), qcm('Cinq ?'), qcm('Six ?'), qcm('Sept ?')],
      'Quatre questions',
    )
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const chloeCookie = await inscrireProfil(banc.url, 'chloe', 'Chloé', '🦉')
    const aliceId = profilDe(banc, 'alice')
    const chloeId = profilDe(banc, 'chloe')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const chloe = await invite(banc.url, 'Chloé', '🦉', { cookie: chloeCookie })

    // Premier quiz : Chloé sans faute, Alice se trompe à la dernière question.
    await jouerQuiz(host, trois, [
      [[chloe, 0], [alice, 0]],
      [[chloe, 0], [alice, 0]],
      [[chloe, 0], [alice, 1]],
    ])
    await patienter(400)
    const soiree = (await enCours(banc))?.id
    assert.ok(soiree, 'la soirée s’est rangée après le premier quiz')
    // À ce moment-là, Chloé mène : un prix décerné maintenant serait le mauvais.
    assert.deepEqual(laureats(banc, soiree, 'sansfaute'), [], 'le rangement d’après quiz ne décerne rien')
    await sauvegarder(host)
    assert.deepEqual(laureats(banc, soiree, 'sansfaute'), [], 'l’ancien « Sauvegarder » non plus')

    // Second quiz : tout s'inverse. Chloé finit à 3 sur 7, Alice à 6 sur 7.
    const renversement: [Invite, number][] = [
      [chloe, 1],
      [alice, 0],
    ]
    await jouerQuiz(host, quatre, [renversement, renversement, renversement, renversement])
    await clore(host)
    assert.deepEqual(
      (await historique(banc)).map(a => a.id),
      [soiree],
      'rangée après chaque quiz puis close, la soirée n’a qu’une archive',
    )

    // Un seul lauréat par prix et par soirée.
    const prix = lire<{ badge: string; profile_id: string }>(
      permanente(banc),
      `SELECT badge, profile_id FROM profile_badges WHERE soiree_id = ? AND badge NOT LIKE 'hf:%'`,
      soiree,
    )
    const parPrix = new Map<string, string[]>()
    for (const p of prix) parPrix.set(p.badge, [...(parPrix.get(p.badge) ?? []), p.profile_id])
    for (const [badge, porteurs] of parPrix) {
      assert.equal(porteurs.length, 1, `« ${badge} » : ${porteurs.length} lauréats pour une seule soirée`)
    }
    assert.deepEqual(laureats(banc, soiree, 'sansfaute'), [aliceId], 'Chloé, à 3 sur 7, n’est pas Le Plus Précis')

    // L'étagère range exactement ce que la salle a vu proclamer à la fin.
    const souvenir = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees/${soiree}/recap.json`)).json()) as any
    const profilDuJoueur = new Map([
      [alice.playerId, aliceId],
      [chloe.playerId, chloeId],
    ])
    const proclames = new Map<string, Set<string>>([
      [aliceId, new Set()],
      [chloeId, new Set()],
    ])
    for (const a of souvenir.stats.awards) {
      const profil = a.player && profilDuJoueur.get(a.player.playerId)
      if (profil) proclames.get(profil)!.add(a.key)
    }
    for (const [profil, cles] of proclames) {
      const ranges = new Set(prix.filter(p => p.profile_id === profil).map(p => p.badge))
      assert.deepEqual(ranges, cles, 'les prix rangés sont ceux de la clôture')
    }

    // Et le compteur suit — l'écran d'entrée d'abord, avant que la page du
    // profil ne le recalcule.
    for (const [profil, profilCookie] of [
      [aliceId, aliceCookie],
      [chloeId, chloeCookie],
    ]) {
      const tout = lire(permanente(banc), 'SELECT DISTINCT badge FROM profile_badges WHERE profile_id = ?', profil).length
      assert.equal(tout, proclames.get(profil)!.size, 'à deux, ni haut fait ni palier : les prix seuls')
      assert.equal(await badgesALEntree(banc, profilCookie), tout, 'l’écran d’entrée annonce le bon nombre de badges')
      const moi = (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: profilCookie } })).json()) as any
      assert.equal(moi.profile.badges, tout, 'la page du profil aussi')
      assert.equal(moi.profile.vitrine.length, tout, 'et son étagère ne garde rien de périmé')
    }
  }))

test('un invité exclu avant la clôture n’y reçoit rien : chaque prix garde un seul lauréat', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const trois = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?'), qcm('Trois ?')], 'Trois questions')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const chloeCookie = await inscrireProfil(banc.url, 'chloe', 'Chloé', '🦉')
    const aliceId = profilDe(banc, 'alice')
    const chloeId = profilDe(banc, 'chloe')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const chloe = await invite(banc.url, 'Chloé', '🦉', { cookie: chloeCookie })
    const salle = await figurants(banc)

    // Chloé sans faute, Alice se trompe à la dernière : le quiz crédite
    // l'une et l'autre dès son podium.
    const credit = attendre<any>(chloe.socket, 'player:profil', p => p.xp > 0, 'le crédit de Chloé', 15_000)
    await jouerQuiz(host, trois, [
      [[chloe, 0], [alice, 0], ...faux(salle)],
      [[chloe, 0], [alice, 0], ...faux(salle)],
      [[chloe, 0], [alice, 1], ...faux(salle)],
    ])
    await credit
    const soiree = (await enCours(banc))?.id
    assert.ok(soiree)
    assert.equal(lignesXp(banc, chloeId).length, 1, 'le quiz a crédité Chloé')

    // L'animateur exclut Chloé : ses réponses quittent le journal, l'archive
    // ne la connaît plus, et son expérience du soir repart avec elle.
    ;(host as any).emit('host:removePlayer', { playerId: chloe.playerId })
    await attendre(chloe.socket, 'player:removed', () => true, 'l’exclusion de Chloé')
    await clore(host)

    assert.deepEqual(laureats(banc, soiree, 'sansfaute'), [aliceId], 'Le Plus Précis va à Alice, seule lauréate')
    const gardes = lire<{ badge: string }>(
      permanente(banc),
      'SELECT badge FROM profile_badges WHERE profile_id = ?',
      chloeId,
    )
    assert.deepEqual(gardes, [], 'Chloé ne reçoit rien d’une soirée qui ne la compte plus')
    assert.deepEqual(lignesXp(banc, chloeId), [], 'ni l’expérience que le quiz lui avait créditée')
    assert.equal(await badgesALEntree(banc, chloeCookie), 0, 'et son compteur le dit')
  }))
