// Les Divins : cinq avatars au-dessus des légendaires, dont personne ne
// connaît la règle.
//
// Deux promesses à tenir. La première : ils sont rares — des salles plus
// grandes que celles des hauts faits, des soirées entières, et rien qu'un
// quiz de cinq questions ne fabrique. La seconde : leur règle ne quitte
// jamais le serveur. Ni le paquet du navigateur, ni une réponse d'API, ni
// l'étagère d'un profil ne doit la laisser deviner.
//
// Les règles se testent comme les hauts faits, en dérivation pure ; le reste
// sur un serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import type { AnswerRow } from '../src/core/answers'
import type { ScoreEntry } from '../src/core/scores'
import type { PlayerRec } from '../src/core/party'
import { divinsDebloques, divinsDeSoiree, raconter } from '../src/core/divins'
import { ProfileStore } from '../src/auth/profiles'
import { DIVINS } from '../../shared/divins'
import { LEGENDAIRES } from '../../shared/legendaires'
import { clePalier } from '../../shared/hautsfaits'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
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

// Un Éclat tiré au hasard ferait tomber un palier : rien ici n'en dépend.
ProfileStore.tirageEclat = () => false

// ── De quoi écrire une soirée ─────────────────────────────────────────────

let horloge = 1_000
const tic = () => ++horloge

function joueur(id: string): PlayerRec {
  return { id, name: id, avatar: '🦊', token: `jeton-${id}`, teamId: null, profileId: `profil-${id}`, createdAt: tic() }
}

function ligne(playerId: string, extra: Partial<AnswerRow> = {}): AnswerRow {
  return {
    sessionId: 's1',
    quizTitle: 'Quiz',
    qIndex: 0,
    kind: 'choice',
    playerId,
    answered: true,
    correct: true,
    choice: 0,
    value: null,
    target: null,
    ms: 5_000,
    changes: 0,
    points: 0,
    durationMs: 20_000,
    observed: false,
    createdAt: tic(),
    ...extra,
  }
}

type Reponse = Partial<AnswerRow> | null
const FAUX: Reponse = { correct: false, choice: 1 }
type Partie = { answers: AnswerRow[]; scores: ScoreEntry[] }

/** Un quiz joué : une bonne réponse vaut `points` s'il est donné, 100 sinon. */
function quiz(sessionId: string, questions: number, joueurs: string[], qui: (q: number, id: string) => Reponse): Partie {
  const answers: AnswerRow[] = []
  const scores: ScoreEntry[] = []
  for (let q = 0; q < questions; q++) {
    for (const id of joueurs) {
      const r = qui(q, id)
      const l =
        r === null
          ? ligne(id, { sessionId, qIndex: q, answered: false, correct: null, choice: null, ms: null })
          : ligne(id, { sessionId, qIndex: q, ...r })
      if (l.answered && l.correct === true && l.points === 0) l.points = 100
      answers.push(l)
      if (l.points !== 0) scores.push({ playerId: id, sessionId, points: l.points, reason: `Q${q + 1}`, createdAt: tic() })
    }
  }
  return { answers, scores }
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `j${i + 1}`)

function divins(joueurs: string[], ...parties: Partie[]) {
  return divinsDeSoiree({
    players: joueurs.map(joueur),
    answers: parties.flatMap(p => p.answers),
    scores: parties.flatMap(p => p.scores),
  })
}

const de = (resultat: Map<string, string[]>, id: string) => resultat.get(id) ?? []

// ── 1. La salle ───────────────────────────────────────────────────────────

test('une salle de moins de six joueurs ne voit descendre aucun Divin, même quand tout y est', () => {
  const cinq = ids(5)
  const eclair = quiz('s1', 8, cinq, (_, id) => (id === 'j1' ? { ms: 800 } : FAUX))
  assert.equal(divins(cinq, eclair).size, 0, 'à cinq, rien ne descend')

  const six = ids(6)
  const memeChose = quiz('s1', 8, six, (_, id) => (id === 'j1' ? { ms: 800 } : FAUX))
  assert.deepEqual(de(divins(six, memeChose), 'j1'), ['dv:seraphin'], 'à six, le Séraphin')
})

// ── 2. Hélios ─────────────────────────────────────────────────────────────

test('Hélios : toutes les questions à choix d’une soirée justes, vingt au moins, dont trois contre la salle', () => {
  const six = ids(6)
  // j1 trouve tout, la salle rien : vingt questions où la majorité se trompe.
  const seul = (q: number, id: string) => (id === 'j1' ? { ms: 4_000 + q } : FAUX)
  const vingt = [quiz('s1', 10, six, seul), quiz('s2', 10, six, seul)]
  assert.ok(de(divins(six, ...vingt), 'j1').includes('dv:helios'))

  const dixNeuf = [quiz('s1', 10, six, seul), quiz('s2', 9, six, seul)]
  assert.ok(!de(divins(six, ...dixNeuf), 'j1').includes('dv:helios'), 'dix-neuf questions ne suffisent pas')

  const uneFaute = [quiz('s1', 10, six, seul), quiz('s2', 10, six, (q, id) => (q === 9 && id === 'j1' ? FAUX : seul(q, id)))]
  assert.ok(!de(divins(six, ...uneFaute), 'j1').includes('dv:helios'), 'une seule erreur, et il ne descend pas')

  const passe = [quiz('s1', 10, six, seul), quiz('s2', 10, six, (q, id) => (q === 9 && id === 'j1' ? null : seul(q, id)))]
  assert.ok(!de(divins(six, ...passe), 'j1').includes('dv:helios'), 'laisser passer une question non plus')
})

test('Hélios ne descend pas sur un quiz trop facile : il faut avoir eu raison contre la salle trois fois', () => {
  const six = ids(6)
  // Toute la salle trouve tout : personne n'a raison contre personne.
  const facile = [quiz('s1', 10, six, () => ({})), quiz('s2', 10, six, () => ({}))]
  assert.equal([...divins(six, ...facile).values()].flat().filter(k => k === 'dv:helios').length, 0)

  // Deux questions piégeuses ne suffisent pas ; trois, oui — et seul j1 y
  // a échappé.
  const piege = (n: number) => (q: number, id: string) => (q < n && id !== 'j1' ? FAUX : {})
  const deux = [quiz('s1', 10, six, piege(2)), quiz('s2', 10, six, () => ({}))]
  assert.ok(!de(divins(six, ...deux), 'j1').includes('dv:helios'))
  const trois = [quiz('s1', 10, six, piege(3)), quiz('s2', 10, six, () => ({}))]
  assert.deepEqual(
    [...divins(six, ...trois)].filter(([, cles]) => cles.includes('dv:helios')).map(([id]) => id),
    ['j1'],
  )
})

// ── 3. Le Séraphin ────────────────────────────────────────────────────────

test('le Séraphin : le plus rapide à trouver sur chaque question à choix d’un quiz de huit', () => {
  const six = ids(6)
  // Tout le monde trouve ; j1 arrive toujours le premier.
  const toujours = quiz('s1', 8, six, (_, id) => ({ ms: id === 'j1' ? 900 : 2_000 + Number(id.slice(1)) * 100 }))
  assert.deepEqual(de(divins(six, toujours), 'j1'), ['dv:seraphin'])
  assert.deepEqual(de(divins(six, toujours), 'j2'), [])

  const sept = quiz('s1', 7, six, (_, id) => ({ ms: id === 'j1' ? 900 : 2_000 }))
  assert.equal(divins(six, sept).size, 0, 'sept questions ne font pas un Séraphin')

  // j2 le devance une seule fois : c'est fini.
  const devance = quiz('s1', 8, six, (q, id) => ({ ms: id === 'j1' ? 900 : id === 'j2' && q === 5 ? 700 : 2_000 }))
  assert.ok(!de(divins(six, devance), 'j1').includes('dv:seraphin'))

  // À la milliseconde près, les deux sont les plus rapides — comme au réflexe.
  const egalite = quiz('s1', 8, six, (_, id) => ({ ms: id === 'j1' || id === 'j2' ? 900 : 2_000 }))
  assert.ok(de(divins(six, egalite), 'j1').includes('dv:seraphin'))
  assert.ok(de(divins(six, egalite), 'j2').includes('dv:seraphin'))

  // Seul à trouver, on est aussi le plus rapide.
  const seul = quiz('s1', 8, six, (_, id) => (id === 'j1' ? { ms: 15_000 } : FAUX))
  assert.ok(de(divins(six, seul), 'j1').includes('dv:seraphin'))
})

// ── 4. Les retournements ──────────────────────────────────────────────────

/** Trois quiz de cinq questions : quinze en tout, le compte d'une soirée. */
function soireeEnTrois(joueurs: string[], premier: (q: number, id: string) => Reponse, suite: (q: number, id: string) => Reponse) {
  return [quiz('s1', 5, joueurs, premier), quiz('s2', 5, joueurs, suite), quiz('s3', 5, joueurs, suite)]
}

test('le Lotus Sacré : dernier du premier quiz, premier de la soirée', () => {
  const huit = ids(8)
  // j1 rate tout le premier quiz, puis gagne tout le reste, largement.
  const remontee = soireeEnTrois(
    huit,
    (_, id) => (id === 'j1' ? FAUX : {}),
    (_, id) => (id === 'j1' ? { points: 150 } : FAUX),
  )
  assert.ok(de(divins(huit, ...remontee), 'j1').includes('dv:lotus'))

  const sept = ids(7)
  const petiteSalle = soireeEnTrois(
    sept,
    (_, id) => (id === 'j1' ? FAUX : {}),
    (_, id) => (id === 'j1' ? { points: 150 } : FAUX),
  )
  assert.ok(!de(divins(sept, ...petiteSalle), 'j1').includes('dv:lotus'), 'à sept, un retournement ne se juge pas')

  const deuxQuiz = [quiz('s1', 8, huit, (_, id) => (id === 'j1' ? FAUX : {})), quiz('s2', 8, huit, (_, id) => (id === 'j1' ? { points: 150 } : FAUX))]
  assert.ok(!de(divins(huit, ...deuxQuiz), 'j1').includes('dv:lotus'), 'il faut trois quiz au moins')

  // Arrivé après les deux premières questions : un retardataire n'est pas
  // un dernier.
  const [q1, ...suite] = remontee
  const retard = { answers: q1.answers.filter(r => !(r.playerId === 'j1' && r.qIndex < 2)), scores: q1.scores }
  assert.ok(!de(divins(huit, retard, ...suite), 'j1').includes('dv:lotus'))
})

test('l’Ange Déchu : premier du premier quiz, dernier de la soirée — en jouant jusqu’au bout', () => {
  const huit = ids(8)
  const chute = soireeEnTrois(
    huit,
    (_, id) => (id === 'j1' ? {} : FAUX),
    (_, id) => (id === 'j1' ? FAUX : {}),
  )
  assert.ok(de(divins(huit, ...chute), 'j1').includes('dv:dechu'))

  // S'en aller tôt, ce n'est pas tomber.
  const parti = soireeEnTrois(
    huit,
    (_, id) => (id === 'j1' ? {} : FAUX),
    (_, id) => (id === 'j1' ? null : {}),
  )
  assert.ok(!de(divins(huit, ...parti), 'j1').includes('dv:dechu'))

  // Rattrapé mais pas dépassé par tous : il n'est pas le dernier.
  const rattrape = soireeEnTrois(
    huit,
    (_, id) => (id === 'j1' ? {} : FAUX),
    (q, id) => (id === 'j1' || (id === 'j8' && q > 0) ? FAUX : {}),
  )
  assert.ok(!de(divins(huit, ...rattrape), 'j1').includes('dv:dechu'))
})

// ── 5. L'Arbre-Monde, et ce qu'un profil garde ────────────────────────────

/** Les récompenses rangées qui débloquent exactement ces légendaires. */
function recompensesPour(cles: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of LEGENDAIRES.filter(x => cles.includes(x.key))) {
    const c = l.condition
    if ('fois' in c) m.set(c.hautFait, c.fois)
    else for (let p = 1; p <= c.palier; p++) m.set(clePalier(c.hautFait, p), 1)
  }
  return m
}

test('l’Arbre-Monde descend avec le douzième légendaire, et repart avec lui', () => {
  const tous = LEGENDAIRES.map(l => l.key)
  assert.deepEqual(divinsDebloques(recompensesPour(tous)), ['dv:arbre'])
  for (const manquant of tous) {
    assert.deepEqual(divinsDebloques(recompensesPour(tous.filter(k => k !== manquant))), [], `sans ${manquant}, pas d’Arbre`)
  }
  // Ceux d'une soirée se lisent dans l'étagère, comme les hauts faits.
  const rangees = new Map([['dv:seraphin', 1], ['dv:dechu', 2]])
  assert.deepEqual(divinsDebloques(rangees), ['dv:seraphin', 'dv:dechu'])
})

// ── 6. Le secret ──────────────────────────────────────────────────────────

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap(nom => {
    const chemin = path.join(dossier, nom)
    if (statSync(chemin).isDirectory()) return nom === 'node_modules' || nom === 'dist' ? [] : sources(chemin)
    return /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })
}

test('ni les règles ni les légendes des Divins ne partent dans le navigateur', () => {
  // Tout ce que le client emporte vient de client/ et de shared/ : aucun de
  // ces fichiers ne doit importer le module des règles…
  const emporte = [...sources(path.join(racine, 'client/src')), ...sources(path.join(racine, 'shared'))].map(f => ({
    f,
    texte: readFileSync(f, 'utf8'),
  }))
  assert.deepEqual(
    emporte.filter(({ texte }) => /from\s+['"][^'"]*core\/divins['"]/.test(texte)).map(({ f }) => f),
    [],
  )
  // …ni recopier une légende : « Plus vite que tous, à chaque question »,
  // lue dans le code de la page, en dirait presque autant que la règle.
  const legendes = raconter(DIVINS.map(d => d.key)).map(d => d.legende)
  assert.equal(legendes.length, DIVINS.length, 'chaque Divin a son récit')
  for (const legende of legendes) {
    assert.deepEqual(emporte.filter(({ texte }) => texte.includes(legende)).map(({ f }) => f), [], legende)
  }
  // Le catalogue public ne porte que de quoi dessiner et nommer.
  for (const d of DIVINS) assert.deepEqual(Object.keys(d).sort(), ['key', 'nom'])
})

// ── 7. Sur un vrai serveur ────────────────────────────────────────────────

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

/** Joue un quiz de bout en bout depuis l'écran commun, puis le referme. */
async function jouerQuiz(host: Socket, quizId: string, questions: [Invite, number][][]) {
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

async function rangee(banc: Banc): Promise<string> {
  for (const limite = Date.now() + 8000; ; await patienter(100)) {
    const { current } = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
    if (current?.id) return current.id
    if (Date.now() > limite) assert.fail('la soirée aurait dû se ranger toute seule après son quiz')
  }
}

async function clore(host: Socket) {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
  ;(host as any).emit('host:closeParty', {})
  const t = await toast
  assert.equal(t.kind, 'info', `la clôture a échoué : ${t.message}`)
}

const moi = async (banc: Banc, cookie: string) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile

/** Alice et cinq invités anonymes, qui se trompent à chaque question. */
async function salleDeSix(banc: Banc, aliceCookie: string) {
  const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
  const salle: Invite[] = []
  for (const [nom, avatar] of [
    ['Bob', '🐻'],
    ['Dora', '🐙'],
    ['Eve', '🐝'],
    ['Fred', '🐸'],
    ['Gus', '🐧'],
  ]) {
    salle.push(await invite(banc.url, nom, avatar))
  }
  return { alice, salle }
}

test('un Divin descend à la clôture : son téléphone et la salle le voient, l’étagère n’en dit rien, et il se porte', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const huit = await creerQuiz(banc.url, cookie, Array.from({ length: 8 }, (_, i) => qcm(`Question ${i + 1} ?`)), 'Huit')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const porter = (legendaire: string | null) => ecrire(banc.url, '/api/joueur/moi', { legendaire }, aliceCookie, 'PUT')
    assert.equal((await moi(banc, aliceCookie)).divins.length, 0)
    const refuse = await porter('dv:seraphin')
    assert.equal(refuse.status, 400, 'un Divin pas encore descendu ne se porte pas')
    assert.match(((await refuse.json()) as any).error, /pas encore descendu/)

    const host = await ecranCommun(banc.url, cookie)
    const { alice, salle } = await salleDeSix(banc, aliceCookie)
    // Alice répond la première, juste, à chaque question : la plus rapide à
    // trouver, huit fois sur huit, dans une salle de six.
    await jouerQuiz(host, huit, Array.from({ length: 8 }, () => [[alice, 0], ...salle.map((i): [Invite, number] => [i, 1])]))
    await rangee(banc)

    const finAlice = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin de soirée d’Alice', 15_000)
    const cloture = attendre<any>(host, 'soiree:cloture', () => true, 'la clôture sur l’écran commun', 15_000)
    await clore(host)
    // Son téléphone le lui raconte ; la salle le voit, sans le récit.
    const [descendu] = (await finAlice).profil?.divins ?? []
    assert.equal(descendu?.key, 'dv:seraphin')
    assert.ok(descendu.legende.length > 0 && descendu.ton === 'eclat')
    const c = await cloture
    assert.deepEqual(c.divins.map((d: any) => [d.nom, d.gagne]), [['Alice', 'dv:seraphin']], 'toute la salle le voit descendre')
    assert.ok(!JSON.stringify(c).includes(descendu.legende), 'le récit reste à son porteur')

    // Le profil le garde — la liste, rien d'autre : ni sur l'étagère, ni
    // dans le compte des badges.
    const profil = await moi(banc, aliceCookie)
    assert.deepEqual(profil.divins.map((d: any) => d.key), ['dv:seraphin'])
    assert.ok(!profil.vitrine.some((b: any) => b.key.startsWith('dv:')), 'l’étagère dirait le soir où il est descendu')
    assert.equal(profil.badges, profil.vitrine.length, 'un badge de plus sans rien de neuf sur l’étagère le trahirait')

    assert.equal((await porter('dv:helios')).status, 400, 'Hélios ne s’est pas montré')
    const porte = await porter('dv:seraphin')
    assert.equal(porte.status, 200)
    assert.equal(((await porte.json()) as any).profile.legendaire, 'dv:seraphin')

    // À la soirée suivante, la salle le voit à la place de son emoji.
    const retour = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const snap = await instantane<any>(host, s => s.players.some((p: any) => p.id === retour.playerId), 'Alice dans la salle')
    assert.equal(snap.players.find((p: any) => p.id === retour.playerId)?.legendaire, 'dv:seraphin')
  }))

test('un Divin descend aussi sur une soirée d’avant les Divins, au démarrage qui les apporte', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const huit = await creerQuiz(banc.url, cookie, Array.from({ length: 8 }, (_, i) => qcm(`Question ${i + 1} ?`)), 'Huit')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const { alice, salle } = await salleDeSix(banc, aliceCookie)
    await jouerQuiz(host, huit, Array.from({ length: 8 }, () => [[alice, 0], ...salle.map((i): [Invite, number] => [i, 1])]))
    await rangee(banc)
    await clore(host)
    const cles = async () => (await moi(banc, aliceCookie)).divins.map((d: any) => d.key)
    assert.deepEqual(await cles(), ['dv:seraphin'])

    // On remonte le temps : la soirée a été close sous le barème 3, quand les
    // Divins n'existaient pas encore.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      db.prepare(`DELETE FROM profile_badges WHERE badge LIKE 'dv:%'`).run()
      for (const { profile_id, soiree_id, detail } of db.prepare('SELECT profile_id, soiree_id, detail FROM profile_xp').all() as any[]) {
        db.prepare('UPDATE profile_xp SET detail = ? WHERE profile_id = ? AND soiree_id = ?').run(
          String(detail).replace(/^\{"v":\d+,/, '{"v":3,'),
          profile_id,
          soiree_id,
        )
      }
    } finally {
      db.close()
    }
    await banc.redemarrer()
    assert.deepEqual(await cles(), ['dv:seraphin'], 'la relecture de l’historique le fait descendre')
  }))
