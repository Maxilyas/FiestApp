// La fin d'une soirée : « Clore la soirée », « C'était un essai », ce que
// l'historique garde — ou rend —, et ce que les pages de l'espace montrent
// le lendemain.
//
// Il y avait deux gestes, « Sauvegarder » et « Nouvelle soirée », et aucun ne
// disait la fin : le téléphone restait sur « En attente du prochain quiz… »,
// une soirée d'essai gardait son expérience, et un « Nouvelle soirée » cliqué
// sans « Sauvegarder » d'abord perdait les prix. La soirée se range
// maintenant toute seule après chaque quiz ; la clôture est le seul geste de
// fin, et elle se raconte — à chaque téléphone la sienne, à la salle la
// sienne. Un essai s'efface sans rien laisser.
//
// Chaque test a son propre serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
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
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'
import { ArchiveStore } from '../src/core/archive'
import { xpDesHautsFaits } from '../src/core/hautsfaits'
import { XP, gainVide, niveauPour, releveVide } from '../../shared/profil'
import { ligneDeRang } from '../../shared/fin'

// L'Éclat se tire une chance sur quarante par soirée, et le premier fait
// tomber un palier de carrière — dix points de plus à la clôture. Ici, le
// hasard ne décide de rien : les tests qui en ont besoin le forcent.
ProfileStore.tirageEclat = () => false

// ── Outils ────────────────────────────────────────────────────────────────

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

type Reponses = [Invite, number][][]

/** Joue un quiz de bout en bout depuis l'écran commun, puis le referme. */
async function jouerQuiz(host: Socket, quizId: string, questions: Reponses): Promise<string> {
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
  return sessionId
}

/** « Clore la soirée », sous ce titre. */
async function clore(host: Socket, title?: string) {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
  ;(host as any).emit('host:closeParty', title ? { title } : {})
  const t = await toast
  assert.equal(t.kind, 'info', `la clôture a échoué : ${t.message}`)
  return t.message as string
}

/** L'historique de l'espace : la soirée en cours à part, les soirées closes ensuite. */
async function historique(banc: Banc): Promise<{ current: any; archives: any[] }> {
  return (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
}

/** Attend que la soirée en cours se soit rangée d'elle-même, et rend son identifiant. */
async function rangee(banc: Banc): Promise<string> {
  for (const limite = Date.now() + 8000; ; await patienter(100)) {
    const { current } = await historique(banc)
    if (current?.id) return current.id
    if (Date.now() > limite) assert.fail('la soirée aurait dû se ranger toute seule après son quiz')
  }
}

/** Trois figurants anonymes. */
async function figurants(banc: Banc, n = 3): Promise<Invite[]> {
  const noms: [string, string][] = [
    ['Bob', '🐻'],
    ['Dora', '🐙'],
    ['Eve', '🐝'],
  ]
  const salle: Invite[] = []
  for (const [nom, avatar] of noms.slice(0, n)) salle.push(await invite(banc.url, nom, avatar))
  return salle
}

const faux = (salle: Invite[]): [Invite, number][] => salle.map(i => [i, 1])

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

function lire<T = any>(banc: Banc, sql: string, ...args: unknown[]): T[] {
  const db = new Database(permanente(banc), { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}

function ecrireEnBase(banc: Banc, fn: (db: Database.Database) => void) {
  const db = new Database(permanente(banc))
  try {
    fn(db)
  } finally {
    db.close()
  }
}

const profilDe = (banc: Banc, login: string): string =>
  lire<{ id: string }>(banc, 'SELECT id FROM profiles WHERE login = ?', login)[0].id

const moi = async (banc: Banc, cookie: string) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile

/** Un téléphone qui se réveille et se re-présente avec le jeton qu'il gardait. */
async function reveil(banc: Banc, token: string) {
  const tel = connecter(banc.url)
  await emitAck(tel, 'party:watch', { slug: ADMIN.slug })
  return emitAck<any>(tel, 'player:join', { slug: ADMIN.slug, token })
}

// ── 1. « Clore la soirée » ────────────────────────────────────────────────

test('clore la soirée : chaque téléphone reçoit sa fin, l’écran commun la sienne, et un téléphone qui dormait la retrouve', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const huit = await creerQuiz(banc.url, cookie, Array.from({ length: 8 }, (_, i) => qcm(`Question ${i + 1} ?`)), 'Huit')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Alice a déjà une soirée derrière elle, chez le même hôte : celle-ci la
    // fait passer niveau 3, et la finition Argent tombe avec.
    const AVANT = 150
    ecrireEnBase(banc, db => {
      const espace = db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }
      db.prepare(
        `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'une-soiree-d-avant', ?, ?, ?, ?)`,
      ).run(profilDe(banc, 'alice'), espace.id, AVANT, JSON.stringify({ v: VERSION_BAREME, gain: gainVide(), releve: releveVide() }), Date.now())
    })
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle = await figurants(banc)
    const [bob, dora] = salle

    // Alice trouve tout, seule : un Grand Chelem. La salle ne marque rien.
    await jouerQuiz(host, huit, Array.from({ length: 8 }, () => [[alice, 0], ...faux(salle)]))
    await rangee(banc)

    const finAlice = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin de soirée d’Alice', 15_000)
    const finBob = attendre<any>(bob.socket, 'soiree:fin', () => true, 'la fin de soirée de Bob', 15_000)
    const cloture = attendre<any>(host, 'soiree:cloture', () => true, 'la clôture sur l’écran commun', 15_000)
    const message = await clore(host, 'La soirée des tests')
    assert.match(message, /La soirée des tests/, 'l’écran commun dit ce qu’il vient de clore')

    // Le téléphone d'Alice : sa soirée, et ce que son profil y a gagné.
    const fa = await finAlice
    assert.equal(fa.rang, 1)
    assert.equal(fa.joueurs, 4)
    assert.equal(fa.soiree.titre, 'La soirée des tests')
    assert.equal(fa.soiree.slug, ADMIN.slug, 'et où la relire')
    // Juste huit fois quand la salle se trompait : le Flair, en plus.
    assert.deepEqual(fa.hautsFaits.map((h: any) => h.key), ['hf:grand-chelem', 'hf:flair'])
    // Huit réponses justes, la première place du quiz, le sans-faute, puis
    // le Grand Chelem et le Flair à la clôture.
    const xp = 8 * (XP.reponse + XP.juste) + XP.podiumQuiz[0] + XP.sansFaute + xpDesHautsFaits(['hf:grand-chelem', 'hf:flair'])
    assert.equal(fa.profil?.xp, xp)
    assert.equal(fa.profil?.niveauAvant, niveauPour(AVANT))
    assert.equal(fa.profil?.niveauApres, niveauPour(AVANT + xp))
    assert.equal(fa.profil?.niveauApres, 3)
    assert.ok(fa.profil?.finitions.includes('argent'), 'la finition Argent tombe avec le niveau 3')
    assert.deepEqual(fa.profil?.legendaires, ['lg:chouette'], 'le Grand Chelem débloque la Chouette')

    // Celui de Bob, anonyme : sa soirée, ses ombres, et rien de plus.
    const fb = await finBob
    assert.equal(fb.profil, undefined, 'l’absence, pas l’infériorité')
    assert.ok(fb.hautsFaits.some((h: any) => h.key === 'hf:lanterne-rouge' && h.ton === 'ombre'))

    // L'écran commun annonce la salle.
    const c = await cloture
    assert.equal(c.podium[0]?.nom, 'Alice')
    assert.deepEqual(c.legendaires.map((l: any) => [l.nom, l.gagne]), [['Alice', 'lg:chouette']])
    assert.deepEqual(c.montees.map((m: any) => [m.nom, m.avant, m.apres]), [['Alice', niveauPour(AVANT), 3]])
    assert.equal(c.hautsFaits.length, 4, 'chacun ses hauts faits : un éclat pour Alice, des ombres pour la salle')

    // La soirée est dans l'historique, sous son titre, et plus en cours.
    const { current, archives } = await historique(banc)
    assert.equal(current, null)
    assert.deepEqual(archives.map(a => a.title), ['La soirée des tests'])

    // Le téléphone de Dora dormait pendant la clôture : il se re-présente
    // avec son jeton, et reçoit sa fin de soirée comme s'il avait été là.
    const reveille = await reveil(banc, dora.token)
    assert.equal(reveille.ok, false)
    assert.equal(reveille.reason, 'soiree-close')
    assert.equal(reveille.fin?.nom, 'Dora')

    // La page du profil range le Grand Chelem et le légendaire.
    const profil = await moi(banc, aliceCookie)
    assert.equal(profil.xp, AVANT + xp)
    assert.ok(profil.legendaires.includes('lg:chouette'))
    assert.equal(profil.hautsFaits.find((h: any) => h.key === 'hf:grand-chelem')?.fois, 1)
    assert.ok(profil.vitrine.some((b: any) => b.key === 'hf:grand-chelem'))
  }))

// La fin de soirée était une porte à sens unique : elle ne savait pas qui
// était son porteur dans l'archive (« Mon bilan » redemandait « Qui es-tu ? »),
// taisait ses prix, disait « 0 joueurs ce soir » à qui arrivait après la
// dernière question — et, après un redémarrage, le téléphone qui dormait
// lisait « On ne te retrouve plus » au lieu de revoir sa soirée.

test('la fin de soirée mène au bilan de son porteur, dit ses prix et la salle — et survit à un redémarrage', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const deux = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊')
    const salle = await figurants(banc, 2)
    await jouerQuiz(host, deux, [
      [[alice, 0], ...faux(salle)],
      [[alice, 0], ...faux(salle)],
    ])
    const id = await rangee(banc)
    // Pendant la soirée déjà, le souvenir sait l'adresse de son archive —
    // celle que « Copier » et « Partager » envoient —, et elle répond.
    const enCours = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/recap.json`)).json()) as any
    assert.equal(enCours.soireeId, id, 'le souvenir en cours donne l’adresse de son archive')
    assert.equal((await fetch(`${banc.url}/s/${ADMIN.slug}/soirees/${id}/recap.json`)).status, 200)
    // Zoé arrive après la dernière question : elle n'a rien joué.
    const zoe = await invite(banc.url, 'Zoé', '🦄')

    const finAlice = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin d’Alice', 15_000)
    const finBob = attendre<any>(salle[0].socket, 'soiree:fin', () => true, 'la fin de Bob', 15_000)
    const finZoe = attendre<any>(zoe.socket, 'soiree:fin', () => true, 'la fin de Zoé', 15_000)
    await clore(host, 'La soirée de Zoé')
    const fa = await finAlice
    assert.equal(fa.joueurId, alice.playerId, '« Mon bilan » s’ouvre sur elle')
    assert.equal(ligneDeRang(fa).cas, 'rang')
    // Bob a répondu deux fois, faux : 0 point, pas de rang — mais il a joué.
    // Il lisait « Tu n'as pas joué ce soir » au-dessus de ses prix.
    const fb = await finBob
    assert.equal(fb.points, 0)
    assert.equal(fb.aJoue, true, 'Bob a joué, même pour rien')
    assert.deepEqual(ligneDeRang(fb), { cas: 'zero', joueurs: 3 })
    const recap = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees/${id}/recap.json`)).json()) as any
    const siens = recap.stats.awards.filter((a: any) => a.player?.playerId === alice.playerId).map((a: any) => a.key)
    assert.ok(siens.length > 0, 'Alice, seule à trouver, remporte au moins un prix')
    assert.deepEqual((fa.prix ?? []).map((p: any) => p.key), siens, 'sa fin de soirée dit ses prix, ceux du souvenir')
    const fz = await finZoe
    assert.equal(fz.rang, 0)
    assert.equal(fz.joueurs, 3, 'la salle a joué, même sans elle')
    assert.equal(fz.prix, undefined)
    assert.equal(fz.aJoue, false)
    assert.deepEqual(ligneDeRang(fz), { cas: 'absent', joueurs: 3 })
    // Une fin d'un serveur d'avant ne dit pas s'il a joué : la phrase neutre.
    const { aJoue: _, ...davant } = fz
    assert.equal(ligneDeRang(davant).cas, 'neutre')

    // Le téléphone de Zoé dormait ; le serveur redémarre et oublie les fins.
    await banc.redemarrer()
    const reveille = await reveil(banc, zoe.token)
    assert.equal(reveille.ok, false)
    assert.equal(reveille.reason, 'unknown-token', 'une page d’avant repasse par l’entrée')
    assert.equal(reveille.derniere?.id, id, 'la soirée close se propose')
    assert.equal(reveille.derniere?.slug, ADMIN.slug)
    assert.match(reveille.error, /close/)
    // Il a pu dormir pendant deux clôtures : le message ne dit pas « la tienne ».
    assert.equal(reveille.error, 'La soirée est close. La dernière soirée de cet espace : La soirée de Zoé')
  }))

// L'arrivé après la dernière question lisait « N joueurs » compté par la
// fiche de l'archive, qui compte aussi ceux qui n'ont fait que passer : un
// autre chiffre que celui de la salle. Et « Mon bilan » l'envoyait à un
// bilan où il ne figure pas, qui lui demandait « Qui es-tu ? ».

test('l’arrivé après la dernière question lit la même salle que les autres, et n’a pas de « Mon bilan »', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const une = await creerQuiz(banc.url, cookie, [qcm('Un ?', ['Oui', 'Non'], 0, 5)])
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊')
    // Bob, Dora et Eve : les deux dernières sont là pendant la question, mais
    // ne répondent pas.
    const [bob, , eve] = await figurants(banc, 3)
    await jouerQuiz(host, une, [[[alice, 0], [bob, 1]]])
    await rangee(banc)
    const zoe = await invite(banc.url, 'Zoé', '🦄')
    const finAlice = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin d’Alice', 15_000)
    const finEve = attendre<any>(eve.socket, 'soiree:fin', () => true, 'la fin d’Eve', 15_000)
    const finZoe = attendre<any>(zoe.socket, 'soiree:fin', () => true, 'la fin de Zoé', 15_000)
    await clore(host)
    const [fa, fe, fz] = await Promise.all([finAlice, finEve, finZoe])
    assert.equal(fa.joueurs, 2, 'seuls Alice et Bob ont répondu')
    assert.equal(fz.joueurs, fa.joueurs, 'Zoé lit la même salle qu’Alice')
    assert.equal(fz.joueurId, undefined, 'Zoé n’est pas au bilan : pas de « Mon bilan »')
    assert.equal(fe.joueurId, eve.playerId, 'Eve figure au journal, et donc au bilan')
    assert.equal(fe.aJoue, false)
  }))

// Le jeton d'une soirée close, après un redémarrage, se voyait proposer la
// soirée close — mais sa lecture attendait la base permanente, dont le délai
// (dix secondes) dépasse celui de l'accusé du téléphone : une base muette
// laissait l'habitué dans une salle d'attente fantôme, sans prénom ni bouton.

test('une base permanente muette ne retient pas l’accusé d’un jeton inconnu', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const deux = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊')
    const salle = await figurants(banc, 2)
    await jouerQuiz(host, deux, [
      [[alice, 0], ...faux(salle)],
      [[alice, 0], ...faux(salle)],
    ])
    const id = await rangee(banc)
    await clore(host)

    // Le serveur redémarre, et la base permanente se tait.
    const lire = ArchiveStore.prototype.derniere
    ArchiveStore.prototype.derniere = function () {
      return patienter(10_000).then(() => null)
    }
    try {
      await banc.redemarrer()
      const debut = Date.now()
      const reveille = await reveil(banc, alice.token)
      assert.ok(Date.now() - debut < 3000, `l’accusé a mis ${Date.now() - debut} ms`)
      assert.equal(reveille.ok, false)
      assert.equal(reveille.reason, 'unknown-token')
    } finally {
      ArchiveStore.prototype.derniere = lire
    }
    // La base revenue, la soirée close se propose de nouveau.
    await banc.redemarrer()
    const apres = await reveil(banc, salle[0].token)
    assert.equal(apres.derniere?.id, id)
  }))

// Sur un jeton inconnu, on proposait la dernière soirée close de l'espace,
// que le jeton en soit ou non : le téléphone d'essai de l'animateur, après
// « C'était un essai », recevait la vraie soirée de la semaine d'avant ; et
// l'exclu, une soirée où il n'était plus. Ces jetons-là, le serveur les sait.

test('le jeton d’un essai effacé ou d’un exclu ne se voit pas proposer une soirée qui n’est pas la sienne', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const deux = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
    const host = await ecranCommun(banc.url, cookie)
    const salle = await figurants(banc, 2)
    await jouerQuiz(host, deux, [faux(salle), faux(salle)])
    await rangee(banc)
    await clore(host)

    // La soirée suivante : le téléphone d'essai, puis un exclu.
    const essai = await invite(banc.url, 'Test', '🤖')
    const exclu = await invite(banc.url, 'Intrus', '🐍')
    ;(host as any).emit('host:removePlayer', { playerId: exclu.playerId })
    await attendre(exclu.socket, 'player:removed', () => true, 'l’exclusion')
    const efface = attendre<any>(host, 'toast', () => true, 'l’essai effacé', 15_000)
    ;(host as any).emit('host:discardParty')
    await efface
    await patienter(200)

    for (const [qui, jeton] of [
      ['l’exclu', exclu.token],
      ['le téléphone d’essai', essai.token],
    ]) {
      const r = await reveil(banc, jeton)
      assert.equal(r.reason, 'unknown-token')
      assert.equal(r.derniere, undefined, `${qui} ne se voit pas proposer la soirée d’avant`)
    }
  }))

test('un avatar légendaire se porte une fois débloqué — pas avant — et se voit de toute la salle', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const huit = await creerQuiz(banc.url, cookie, Array.from({ length: 8 }, (_, i) => qcm(`Question ${i + 1} ?`)), 'Huit')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const porter = (legendaire: string | null) => ecrire(banc.url, '/api/joueur/moi', { legendaire }, aliceCookie, 'PUT')

    const refuse = await porter('lg:chouette')
    assert.equal(refuse.status, 400, 'un légendaire pas encore gagné ne se porte pas')
    assert.match(((await refuse.json()) as any).error, /pas encore à toi/)

    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle = await figurants(banc)
    await jouerQuiz(host, huit, Array.from({ length: 8 }, () => [[alice, 0], ...faux(salle)]))
    await rangee(banc)
    await clore(host)

    const porte = await porter('lg:chouette')
    assert.equal(porte.status, 200)
    assert.equal(((await porte.json()) as any).profile.legendaire, 'lg:chouette')
    assert.equal((await porter('lg:dragon')).status, 400, 'le Dragon demande un Triplé')

    // À la soirée suivante, toute la salle le voit.
    const retour = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const snap = await instantane<any>(host, s => s.players.some((p: any) => p.id === retour.playerId), 'Alice dans la salle')
    assert.equal(snap.players.find((p: any) => p.id === retour.playerId)?.legendaire, 'lg:chouette')

    // Choisir un emoji ôte le légendaire : on porte l'un ou l'autre.
    const emoji = await ecrire(banc.url, '/api/joueur/moi', { avatar: '🐯' }, aliceCookie, 'PUT')
    assert.equal(((await emoji.json()) as any).profile.legendaire, null)
  }))

// ── 2. « C'était un essai » ───────────────────────────────────────────────

test('« C’était un essai » : tout s’efface, archive, expérience et Éclat compris — et les téléphones repassent par l’entrée', () =>
  avecBanc(async banc => {
    const tirage = ProfileStore.tirageEclat
    ProfileStore.tirageEclat = () => true
    try {
      const cookie = await connexionAnimateur(banc.url)
      const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
      const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
      const aliceId = profilDe(banc, 'alice')
      const host = await ecranCommun(banc.url, cookie)
      const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
      const salle = await figurants(banc, 2)

      const creditee = attendre<any>(alice.socket, 'player:profil', p => p.xp > 0, 'le crédit du quiz', 15_000)
      await jouerQuiz(host, quiz, [[[alice, 0], ...faux(salle)]])
      await creditee
      const soiree = await rangee(banc)
      assert.equal(lire(banc, 'SELECT 1 FROM profile_eclats WHERE profile_id = ?', aliceId).length, 1, 'l’Éclat est tombé')

      const renvoyee = attendre(alice.socket, 'party:reset', () => true, 'le téléphone d’Alice renvoyé à l’entrée')
      const toast = attendre<any>(host, 'toast', () => true, 'l’essai effacé', 15_000)
      ;(host as any).emit('host:discardParty')
      assert.equal((await toast).kind, 'info')
      await renvoyee

      const { current, archives } = await historique(banc)
      assert.equal(current, null)
      assert.deepEqual(archives, [], 'l’archive que l’essai s’était faite repart avec lui')
      assert.deepEqual(lire(banc, 'SELECT soiree_id FROM profile_xp WHERE profile_id = ?', aliceId), [])
      assert.deepEqual(lire(banc, 'SELECT avatar FROM profile_eclats WHERE profile_id = ?', aliceId), [])
      assert.deepEqual(lire(banc, 'SELECT badge FROM profile_badges WHERE soiree_id = ?', soiree), [])
      const profil = await moi(banc, aliceCookie)
      assert.equal(profil.xp, 0, 'son total est recalculé')
      assert.deepEqual(profil.eclats, [])

      // Un essai n'a pas de fin à raconter : le jeton ne désigne plus personne.
      const reveille = await reveil(banc, alice.token)
      assert.equal(reveille.reason, 'unknown-token')
      assert.equal(reveille.fin, undefined)
    } finally {
      ProfileStore.tirageEclat = tirage
    }
  }))

// ── 3. L'historique ───────────────────────────────────────────────────────

test('retirer une soirée de l’historique reprend ce qu’elle avait crédité ; la soirée en cours ne se retire pas', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const trois = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?'), qcm('Trois ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const aliceId = profilDe(banc, 'alice')
    const host = await ecranCommun(banc.url, cookie)
    const retirer = (id: string) => ecrire(banc.url, `/api/soirees/${id}`, {}, cookie, 'DELETE')

    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle = await figurants(banc, 2)
    await jouerQuiz(host, trois, Array.from({ length: 3 }, () => [[alice, 0], ...faux(salle)]))
    const soiree = await rangee(banc)

    // En cours, elle s'efface depuis l'écran commun, pas depuis l'historique.
    const enCours = await retirer(soiree)
    assert.equal(enCours.status, 409)
    assert.match(((await enCours.json()) as any).error, /essai/)

    await clore(host)
    assert.ok((await moi(banc, aliceCookie)).xp > 0)
    assert.ok(lire(banc, 'SELECT 1 FROM profile_badges WHERE profile_id = ?', aliceId).length > 0, 'des prix à la clôture')

    assert.equal((await retirer(soiree)).status, 200)
    assert.deepEqual((await historique(banc)).archives, [])
    assert.deepEqual(lire(banc, 'SELECT soiree_id FROM profile_xp WHERE profile_id = ?', aliceId), [])
    assert.deepEqual(lire(banc, 'SELECT badge FROM profile_badges WHERE profile_id = ?', aliceId), [])
    const profil = await moi(banc, aliceCookie)
    assert.equal(profil.xp, 0, 'une soirée retirée ne compte plus nulle part')
    assert.equal(profil.badges, 0)
  }))

// ── 3 bis. Le lendemain ───────────────────────────────────────────────────
//
// La clôture efface la soirée en cours, et le souvenir comme le bilan de
// l'espace lisaient celle-là seulement : l'invité qui rouvrait le lendemain
// le souvenir scanné au podium lisait « La soirée n'a pas encore commencé ».
// Tant que la suivante n'a rien joué, ces pages désignent maintenant la
// dernière soirée close, et la page la montre à sa place.

test('le lendemain, les pages de l’espace mènent à la dernière soirée close — jusqu’à ce que la suivante joue', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const deux = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
    const host = await ecranCommun(banc.url, cookie)
    const page = async (fichier: 'recap.json' | 'bilan.json', slug = ADMIN.slug) => {
      const res = await fetch(`${banc.url}/s/${slug}/${fichier}`)
      assert.equal(res.status, 200, `${slug}/${fichier}`)
      return (await res.json()) as any
    }
    const jouer = (salle: Invite[]) => jouerQuiz(host, deux, [[[salle[0], 0], [salle[1], 1]], [[salle[0], 0], [salle[1], 1]]])

    // Un espace neuf n'a nulle part où mener.
    assert.equal((await page('recap.json')).derniere, undefined)

    await jouer(await figurants(banc, 2))
    const veille = await rangee(banc)
    assert.equal((await page('recap.json')).derniere, undefined, 'une soirée qui joue se montre elle-même')
    await clore(host, 'La veille')

    // Le lendemain : le souvenir et le bilan de l'espace désignent la soirée close…
    for (const fichier of ['recap.json', 'bilan.json'] as const) {
      const { derniere } = await page(fichier)
      assert.deepEqual([derniere?.id, derniere?.title], [veille, 'La veille'], fichier)
      assert.equal(typeof derniere?.heldAt, 'number')
    }
    // … qui se relit à son adresse.
    const relue = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees/${veille}/recap.json`)).json()) as any
    assert.equal(relue.archive?.title, 'La veille')

    // Chacun chez soi : le voisin, qui n'a jamais rien clos, n'en voit rien.
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'voisin', name: 'Voisin', slug: 'chez-le-voisin' }, cookie)
    const { activation } = (await cree.json()) as { activation: { token: string } }
    cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'voisin-pass-1' }))
    assert.equal((await page('recap.json', 'chez-le-voisin')).derniere, undefined, 'jamais la soirée d’un autre espace')

    // La suivante commence : des invités arrivent, rien n'est joué — la veille reste.
    const salle = await figurants(banc, 2)
    assert.equal((await page('recap.json')).derniere?.id, veille, 'la salle se remplit, la veille reste')
    // Dès la première question jouée, les pages parlent de la nouvelle.
    await jouer(salle)
    await rangee(banc)
    assert.equal((await page('recap.json')).derniere, undefined)
    assert.equal((await page('bilan.json')).derniere, undefined)

    // C'était un essai : effacé, il ne se montre jamais — la veille revient.
    const toast = attendre<any>(host, 'toast', () => true, 'l’essai effacé', 15_000)
    ;(host as any).emit('host:discardParty')
    assert.equal((await toast).kind, 'info')
    assert.equal((await page('recap.json')).derniere?.id, veille, 'un essai effacé ne se montre pas')

    // Une soirée retirée de l'historique non plus : il n'y a plus rien où mener.
    assert.equal((await ecrire(banc.url, `/api/soirees/${veille}`, {}, cookie, 'DELETE')).status, 200)
    assert.equal((await page('recap.json')).derniere, undefined)
    assert.equal((await page('bilan.json')).derniere, undefined)
  }))

// La soirée se nommait sur l'arrivée du plus ancien invité, absents compris :
// Mireille, revenue le 17 relire la veille, était entrée dans la soirée
// suivante sans y jouer — et celle du 24 s'archivait « du 17 », identifiant,
// historique et titre proposé à la clôture compris, pour toujours. Le nom se
// tire toujours une fois (invariant 11) ; seuls ceux qui ont répondu le datent.

test('un invité arrivé une semaine avant, reparti sans jouer, ne date pas la soirée — même après un réveil', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const deux = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
    const semaine = 7 * 24 * 3600 * 1000
    const maintenant = Date.now
    Date.now = () => maintenant() - semaine
    let mireille: Invite
    try {
      mireille = await invite(banc.url, 'Mireille', '🦉')
    } finally {
      Date.now = maintenant
    }
    mireille.socket.close()
    // L'hébergeur s'endort entre deux soirées : au réveil, des invités sans
    // nom rangé — rien n'a été joué, il n'y a rien à nommer.
    await banc.redemarrer()

    const host = await ecranCommun(banc.url, cookie)
    const salle = await figurants(banc, 2)
    const debut = Date.now()
    await jouerQuiz(host, deux, [
      [[salle[0], 0], [salle[1], 1]],
      [[salle[0], 0], [salle[1], 1]],
    ])
    const id = await rangee(banc)
    const { current } = await historique(banc)
    assert.ok(current.since >= debut - 60_000, `la soirée est datée du ${new Date(current.since).toISOString()}`)
    const jour = new Date(debut).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' })
    assert.ok(id.startsWith(jour), `l’identifiant ${id} devait porter le ${jour}`)
    const message = await clore(host)
    const [archive] = (await historique(banc)).archives
    assert.equal(archive.id, id)
    assert.ok(archive.heldAt >= debut - 60_000, 'l’historique garde la date du soir joué')
    const veille = new Date(debut - semaine).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' })
    assert.ok(!archive.title.includes(veille), `le titre « ${archive.title} » porte le jour de Mireille`)
    assert.ok(!message.includes(veille), message)
  }))

// Dater sur ceux qui ont répondu ne suffisait pas : l'animateur teste son QR
// le 17, ou l'invitée qui relisait la veille touche « Rejoindre la soirée
// suivante » — et le 24, ce même invité JOUE. Son arrivée datait encore la
// soirée « du 17 ». Elle se date à sa première question jouée.

test('un invité inscrit une semaine avant, qui joue ce soir, ne date pas la soirée de son arrivée', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const deux = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
    const semaine = 7 * 24 * 3600 * 1000
    const maintenant = Date.now
    Date.now = () => maintenant() - semaine
    let veille: Invite
    try {
      veille = await invite(banc.url, 'Antoine', '🦁')
    } finally {
      Date.now = maintenant
    }
    veille.socket.close()
    // Le 24, son téléphone revient avec le jeton du 17 : c'est le même invité.
    const testeur = await invite(banc.url, 'Antoine', '🦁', { token: veille.token })
    assert.equal(testeur.playerId, veille.playerId)
    const host = await ecranCommun(banc.url, cookie)
    const salle = await figurants(banc, 2)
    const debut = Date.now()
    await jouerQuiz(host, deux, [
      [[testeur, 0], [salle[0], 1], [salle[1], 1]],
      [[testeur, 0], [salle[0], 1], [salle[1], 1]],
    ])
    const id = await rangee(banc)
    const jour = new Date(debut).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' })
    assert.ok(id.startsWith(jour), `soirée jouée le ${jour}, identifiant ${id}`)
    const { current } = await historique(banc)
    assert.ok(current.since >= debut, `la soirée est datée du ${new Date(current.since).toISOString()}`)
    await clore(host)
    const [archive] = (await historique(banc)).archives
    assert.equal(archive.id, id)
    assert.ok(archive.heldAt >= debut, 'l’historique garde l’heure de la première question')
  }))

// Le lendemain racontait les prix que l'application avait calculés, et pas
// ceux que l'animateur avait remis : « Le coup de cœur de Sam », un prix
// libre au motif inventé, ne se relisait nulle part. Le souvenir et le bilan
// portent maintenant les prix remis, de la soirée en cours comme de
// l'archive — le même chemin, relu à la même source.

test('le souvenir et le bilan relisent les prix remis, prix libres compris, en cours comme archivés', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
    const host = await ecranCommun(banc.url, cookie)
    ;(host as any).emit('host:createTeam', { name: 'Les Carbonara', emoji: '🍝' })
    ;(host as any).emit('host:createTeam', { name: 'Les Randonneurs', emoji: '🥾' })
    const snap = await instantane<any>(host, s => s.teams.length === 2, 'les deux équipes')
    const [carbo, rando] = [...snap.teams].sort((a: any, b: any) => a.position - b.position).map((t: any) => t.id as string)
    const salle = await figurants(banc, 2)
    ;(host as any).emit('host:assignPlayer', { playerId: salle[0].playerId, teamId: carbo })
    ;(host as any).emit('host:assignPlayer', { playerId: salle[1].playerId, teamId: rando })
    await jouerQuiz(host, quiz, [[[salle[0], 0], [salle[1], 1]], [[salle[0], 0], [salle[1], 1]]])
    const soiree = await rangee(banc)

    // Deux prix, dans cet ordre : un calculé, puis un prix libre. Le registre
    // les rend du plus récent au plus ancien ; le lendemain, dans l'ordre vécu.
    ;(host as any).emit('host:awardTeam', { teamId: carbo, points: 2, reason: "L'Éclair" })
    await instantane<any>(host, s => s.bonuses.length === 1, 'le premier prix')
    await patienter(5)
    ;(host as any).emit('host:awardTeam', { teamId: rando, points: 3, reason: 'Le coup de cœur de Sam' })
    await instantane<any>(host, s => s.bonuses.length === 2, 'le prix libre')
    const attendu = [
      [carbo, 2, "L'Éclair"],
      [rando, 3, 'Le coup de cœur de Sam'],
    ]
    const remis = (page: any) => (page.bonuses ?? []).map((b: any) => [b.teamId, b.points, b.reason])
    const lire = async (chemin: string) => {
      const res = await fetch(`${banc.url}/s/${ADMIN.slug}/${chemin}`)
      assert.equal(res.status, 200, chemin)
      return (await res.json()) as any
    }

    for (const fichier of ['recap.json', 'bilan.json']) {
      assert.deepEqual(remis(await lire(fichier)), attendu, `${fichier}, la soirée en cours`)
    }
    await clore(host, 'Les 40 ans de Sam')
    for (const fichier of ['recap.json', 'bilan.json']) {
      assert.deepEqual(remis(await lire(`soirees/${soiree}/${fichier}`)), attendu, `${fichier}, la soirée archivée`)
    }
  }))

// Un prix ne rapporte jamais d'expérience : celui du palmarès se juge sur une
// seule soirée, celui qu'on remet à l'écran se donne à la main — prix libre
// compris. La même soirée, jouée deux fois, avec et sans prix remis, laisse
// donc au profil la même expérience.

test('un prix remis, même libre, ne rapporte aucune expérience', async () => {
  const soiree = async (avecPrix: boolean) => {
    let xp = -1
    await avecBanc(async banc => {
      const cookie = await connexionAnimateur(banc.url)
      const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
      const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
      const host = await ecranCommun(banc.url, cookie)
      ;(host as any).emit('host:createTeam', { name: 'Les Carbonara', emoji: '🍝' })
      const snap = await instantane<any>(host, s => s.teams.length === 1, 'l’équipe')
      const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
      const [bob] = await figurants(banc, 1)
      ;(host as any).emit('host:assignPlayer', { playerId: alice.playerId, teamId: snap.teams[0].id })
      await jouerQuiz(host, quiz, [[[alice, 0], [bob, 1]], [[alice, 0], [bob, 1]]])
      await rangee(banc)
      if (avecPrix) {
        ;(host as any).emit('host:awardTeam', { teamId: snap.teams[0].id, points: 5, reason: "L'Éclair" })
        ;(host as any).emit('host:awardTeam', { teamId: snap.teams[0].id, points: 3, reason: 'Le coup de cœur de Sam' })
        await instantane<any>(host, s => s.bonuses.length === 2, 'les deux prix')
      }
      await clore(host)
      xp = (await moi(banc, aliceCookie)).xp
    })
    return xp
  }
  const sans = await soiree(false)
  assert.ok(sans > 0, 'la soirée rapporte, elle')
  assert.equal(await soiree(true), sans)
})

// ── 4. L'animateur joue aussi ─────────────────────────────────────────────

test('chez lui aussi, l’animateur gagne de l’expérience — dès un duel', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const animCookie = await inscrireProfil(banc.url, 'anim', 'Antoine', '🦁')
    const lie = await ecrire(banc.url, '/api/space/profil', { login: 'anim', password: 'motdepasse1' }, cookie)
    assert.equal(lie.status, 200, 'le profil de l’animateur tient l’espace')
    const host = await ecranCommun(banc.url, cookie)
    const anim = await invite(banc.url, 'Antoine', '🦁', { cookie: animCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')

    // On le tenait hors concours, parce qu'il connaît ses quiz : il ne
    // progressait jamais aux fêtes qu'il organise — souvent les seules.
    const credite = attendre<any>(anim.socket, 'player:profil', p => p.xp > 0, 'le crédit de l’animateur', 15_000)
    await jouerQuiz(host, quiz, [[[anim, 0], [bob, 1]]])
    await credite
    const finAnim = attendre<any>(anim.socket, 'soiree:fin', () => true, 'la fin de soirée de l’animateur', 15_000)
    await clore(host)
    assert.equal((await moi(banc, animCookie)).xp, XP.reponse + XP.juste, 'une question posée à deux rapporte')
    assert.ok((await finAnim).profil, 'sa fin de soirée compte pour son profil')
  }))

// ── 5. Le recalcul ────────────────────────────────────────────────────────

test('au démarrage, l’expérience d’avant le barème au mérite se relit sur l’historique', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const trois = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?'), qcm('Trois ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const aliceId = profilDe(banc, 'alice')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle = await figurants(banc, 2)
    await jouerQuiz(host, trois, Array.from({ length: 3 }, () => [[alice, 0], ...faux(salle)]))
    const soiree = await rangee(banc)
    await clore(host)
    const juste = (await moi(banc, aliceCookie)).xp
    assert.equal(juste, 3 * (XP.reponse + XP.juste))

    // On remonte le temps : la ligne de cette soirée a été écrite par
    // l'ancien barème — présence comprise —, une soirée qui n'est plus dans
    // l'historique a laissé la sienne, et le vieux catalogue de carrière a
    // rangé « La Première Fois ».
    const espace = lire<{ space_id: string }>(banc, 'SELECT space_id FROM profile_xp WHERE profile_id = ?', aliceId)[0].space_id
    const ancien = (reponses: number, justes: number) =>
      JSON.stringify({
        gain: { presence: 50, reponses, justesse: 2 * justes, podium: 60, quiz: 15 },
        releve: { reponses, justes, rang: 1, quiz: 1 },
      })
    ecrireEnBase(banc, db => {
      db.prepare('UPDATE profile_xp SET xp = 999, detail = ? WHERE profile_id = ? AND soiree_id = ?').run(ancien(3, 3), aliceId, soiree)
      db.prepare('INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(aliceId, '2025-01-01-orpheline', espace, 145, ancien(10, 6), 1)
      db.prepare('INSERT INTO profile_badges VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        aliceId,
        'carriere:premiere',
        soiree,
        espace,
        '🎉',
        'La Première Fois',
        2,
      )
      db.prepare('UPDATE profiles SET xp = 1144 WHERE id = ?').run(aliceId)
    })

    await banc.redemarrer()
    const lignes = lire<{ soiree_id: string; xp: number }>(
      banc,
      `SELECT soiree_id, xp FROM profile_xp WHERE profile_id = ? AND soiree_id NOT LIKE '#%' ORDER BY soiree_id`,
      aliceId,
    )
    assert.deepEqual(
      lignes,
      [
        // La soirée sans archive garde ce que son relevé dit encore : dix
        // réponses, six justes.
        { soiree_id: '2025-01-01-orpheline', xp: 10 * XP.reponse + 6 * XP.juste },
        // Celle de l'historique se relit entière, au barème du jour.
        { soiree_id: soiree, xp: juste },
      ],
    )
    assert.deepEqual(
      lire(banc, `SELECT badge FROM profile_badges WHERE badge LIKE 'carriere:%'`),
      [],
      'l’ancien catalogue de carrière laisse place aux paliers',
    )
    assert.equal((await moi(banc, aliceCookie)).xp, juste + 10 * XP.reponse + 6 * XP.juste, 'le total suit')

    // Un second démarrage n'a plus rien à relire.
    await banc.redemarrer()
    assert.equal((await moi(banc, aliceCookie)).xp, juste + 10 * XP.reponse + 6 * XP.juste)
  }))

test('au démarrage d’un barème neuf, l’historique se relit — et la veille garde ses chiffres', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [{ ...qcm('Qui chante Thriller ?'), category: 'Musique' }])
    const animCookie = await inscrireProfil(banc.url, 'anim', 'Antoine', '🦁')
    const animId = profilDe(banc, 'anim')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'anim', password: 'motdepasse1' }, cookie)).status, 200)
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const aliceId = profilDe(banc, 'alice')
    const host = await ecranCommun(banc.url, cookie)
    const anim = await invite(banc.url, 'Antoine', '🦁', { cookie: animCookie })
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    // Alice se trompe : deux bonnes réponses feraient un réflexe, au plus
    // rapide des deux — à la milliseconde près.
    await jouerQuiz(host, quiz, [[[anim, 0], [alice, 1]]])
    const soiree = await rangee(banc)
    await clore(host)
    const juste = XP.reponse + XP.juste

    // On remonte le temps : le barème 2 tenait l'animateur hors concours —
    // aucune ligne pour lui —, Alice avait joué la veille une soirée sortie
    // depuis de l'historique, et un palier de carrière.
    const espace = lire<{ space_id: string }>(banc, 'SELECT space_id FROM profile_xp WHERE profile_id = ?', aliceId)[0].space_id
    const veille = {
      v: 2,
      gain: { reponses: 10, justesse: 30 },
      releve: { questions: 10, reponses: 10, qcm: 10, justes: 10, categories: { Musique: { questions: 10, justes: 10 } } },
    }
    ecrireEnBase(banc, db => {
      db.prepare('DELETE FROM profile_xp WHERE profile_id = ?').run(animId)
      db.prepare('UPDATE profiles SET xp = 0 WHERE id = ?').run(animId)
      const { detail } = db.prepare('SELECT detail FROM profile_xp WHERE profile_id = ? AND soiree_id = ?').get(aliceId, soiree) as any
      db.prepare('UPDATE profile_xp SET detail = ? WHERE profile_id = ? AND soiree_id = ?').run(
        String(detail).replace(/^\{"v":\d+,/, '{"v":2,'),
        aliceId,
        soiree,
      )
      db.prepare('INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(aliceId, '2026-09-22-veille', espace, 40, JSON.stringify(veille), 1)
      db.prepare('INSERT INTO profile_badges VALUES (?, ?, ?, ?, ?, ?, ?)').run(aliceId, 'hf:habitue:1', soiree, espace, '🎟️', 'L’Habitué', 2)
      db.prepare('INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(aliceId, '#paliers', '', 10, JSON.stringify({ v: 2, paliers: ['hf:habitue:1'] }), 3)
      db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(XP.reponse + 40 + 10, aliceId)
    })

    await banc.redemarrer()
    // Lu en base avant toute visite : la page `/profil` rattraperait sinon
    // dans l'archive un joueur que la relecture aurait oublié d'écrire.
    assert.deepEqual(
      lire(banc, 'SELECT joueur_id FROM profile_xp WHERE profile_id = ? AND soiree_id = ?', animId, soiree),
      [{ joueur_id: anim.playerId }],
      'la ligne recréditée retient le joueur qu’il était ce soir-là',
    )
    assert.equal((await moi(banc, animCookie)).xp, juste, 'la soirée de l’historique se recrédite à l’animateur')
    const aliceApres = await moi(banc, aliceCookie)
    assert.equal(aliceApres.xp, XP.reponse + 40 + 10, 'la veille et le palier gardent leur expérience')
    // Lue comme une ligne de l'ancien barème, la veille perdait ses catégories.
    assert.deepEqual(aliceApres.categories, { Musique: { questions: 11, justes: 10 } })
    // Plus rien d'une version d'avant : le démarrage suivant n'a rien à relire.
    assert.deepEqual(lire(banc, `SELECT soiree_id FROM profile_xp WHERE detail NOT LIKE '{"v":${VERSION_BAREME},%'`), [])
  }))

// Le recalcul passe avant l'ouverture du port, et chaque profil de chaque
// soirée y coûtait deux allers-retours, en série : 101 soirées, 68 s de
// démarrage à 20 ms de latence — des minutes de 502 au premier déploiement
// d'un barème neuf. Une soirée se crédite maintenant d'un seul lot, quel que
// soit le nombre de ses profils. On compte les requêtes, on ne chronomètre
// rien.
test('le recalcul au barème du jour écrit une soirée d’un seul lot, quel que soit le nombre de ses profils', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  const { Sqlite3Client } = await import('@libsql/client/sqlite3')
  const { ArchiveStore, buildArchive } = await import('../src/core/archive')
  const { recalculerHistorique } = await import('../src/core/recalcul')

  /** Un historique de `soirees` soirées, chacune jouée par `profils` profils, et une ligne d'un barème d'avant. */
  const historique = async (soirees: number, profils: number) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'quizz-recalcul-'))
    const url = `file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`
    const profiles = new ProfileStore(url)
    await profiles.init()
    const archives = new ArchiveStore(url)
    await archives.init('espace')
    const ids: string[] = []
    for (let i = 0; i < profils; i++) {
      ids.push((await profiles.register({ login: `p${i}`, password: 'motdepasse1', name: `P${i}`, avatar: '🦊' })).profile.id)
    }
    for (let k = 0; k < soirees; k++) {
      const t0 = Date.UTC(2025, 0, 1) + k * 86_400_000
      const players = ids.map((profileId, i) => ({
        id: `j${k}-${i}`, name: `P${i}`, avatar: '🦊', token: '', teamId: null, profileId, createdAt: t0 + i,
      }))
      // Deux figurants anonymes : un joueur seul ne rapporte rien.
      for (const f of ['x', 'y']) players.push({ id: `j${k}-${f}`, name: f, avatar: '🐻', token: '', teamId: null, profileId: null as any, createdAt: t0 + 99 })
      const answers = players.map((p, i) => ({
        sessionId: `s${k}`, quizTitle: 'Quiz', qIndex: 0, kind: 'choice' as const, playerId: p.id, answered: true,
        correct: i % 2 === 0, choice: i % 2, value: null, target: null, ms: 1000 + i * 37, changes: 0,
        points: i % 2 === 0 ? 500 : 0, durationMs: 20_000, observed: false, category: null, createdAt: t0 + 1000,
      }))
      const scores = answers.filter(a => a.points > 0).map(a => ({ playerId: a.playerId, sessionId: a.sessionId, points: a.points, reason: 'Q1', createdAt: a.createdAt }))
      const a = buildArchive({
        soiree: { id: `soiree-${k}`, heldAt: t0 } as any, players: players as any, teams: [], bonuses: [], scores, answers: answers as any,
        packsBySession: new Map([[`s${k}`, { title: 'Quiz', questions: [{ kind: 'choice', text: 'Q ?', answers: ['A', 'B'], correct: 0, duration: 20, image: null }] as any }]]),
        library: [],
      })!
      await archives.save('espace', a.id, a.heldAt, a.archive)
    }
    const c = (profiles as any).client
    await c.execute({
      sql: `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'soiree-0', 'espace', 1, '{"v":1}', 0)
            ON CONFLICT(profile_id, soiree_id) DO UPDATE SET detail = '{"v":1}'`,
      args: [ids[0]],
    })
    return { dir, profiles, archives, ids }
  }

  const proto = Sqlite3Client.prototype as any
  const origines = { execute: proto.execute, batch: proto.batch }
  let requetes = 0
  for (const m of ['execute', 'batch'] as const) {
    proto[m] = function (...args: unknown[]) {
      requetes++
      return origines[m].apply(this, args)
    }
  }
  const mesurer = async (soirees: number, profils: number) => {
    const h = await historique(soirees, profils)
    try {
      // Le recalcul d'abord ; puis les paliers, jugés profil par profil — hors du compte par soirée.
      requetes = 0
      const fait = await recalculerHistorique({ profiles: h.profiles, archives: h.archives, enCours: new Set() })
      assert.equal(fait?.soirees, soirees)
      // Chaque total dit la somme de ses lignes, en base comme en mémoire.
      const c = (h.profiles as any).client
      for (const id of h.ids) {
        const somme = Number((await c.execute({ sql: 'SELECT COALESCE(SUM(xp), 0) AS n FROM profile_xp WHERE profile_id = ?', args: [id] })).rows[0].n)
        assert.ok(somme > 0, 'chaque profil a gagné')
        assert.equal((await h.profiles.byId(id))?.xp, somme, 'le total suit ses lignes')
      }
      return requetes
    } finally {
      h.profiles.close()
      h.archives.close()
      rmSync(h.dir, { recursive: true, force: true })
    }
  }
  try {
    const peu = await mesurer(6, 3)
    const beaucoup = await mesurer(6, 12)
    // Neuf profils de plus dans chacune des six soirées : sur l'ancien
    // chemin, 6 × 9 × 2 = 108 requêtes de plus rien que pour les crédits.
    // Il ne reste que ce que chaque profil coûte une fois : ses paliers.
    assert.ok(
      beaucoup - peu <= 9 * 10,
      `neuf profils de plus coûtent ${beaucoup - peu} requêtes (${peu} → ${beaucoup}) : ils ne se paient plus par soirée`,
    )
    const plus = await mesurer(12, 3)
    console.log(`[recalcul] requêtes : 6 soirées × 3 profils ${peu}, × 12 profils ${beaucoup}, 12 soirées × 3 profils ${plus}`)
    assert.ok(plus - peu <= 6 * 4, `six soirées de plus coûtent ${plus - peu} requêtes : quelques-unes chacune, pas une par profil`)
  } finally {
    proto.execute = origines.execute
    proto.batch = origines.batch
  }
})
