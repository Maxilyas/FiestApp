// Le miroir distant de la soirée : ce qui doit survivre quand la base
// permanente décroche, quand le processus est tué net, et quand l'hébergeur
// rallume l'instance sur un disque effacé — ce qu'il fait À CHAQUE réveil.
//
// Chaque défaut testé ici a été reproduit pendant la revue :
//
// · une panne de Turso pendant l'arrivée de Bob et un quiz : au réveil,
//   Alice avait 0 point, Bob n'existait plus, et plus aucune réponse ;
// · un processus tué 300 ms après une révélation : la question se révélait
//   une seconde fois au redémarrage, et payait deux fois ;
// · une « Nouvelle soirée » dont l'effacement distant échouait : la salle
//   était vide, l'écran disait « Rien n'a été effacé », et l'ancienne
//   soirée ressuscitait au réveil ;
// · la copie exacte d'un quiz joué, perdue avec le disque : l'archive
//   reprenait la bibliothèque du jour ;
// · un miroir en panne toute la soirée sans que personne ne le sache.
//
// La panne est simulée dans la base permanente elle-même (un fichier `file:`
// qui tient le rôle de Turso) : des déclencheurs refusent toute écriture sur
// les tables `party_*` tant qu'une table témoin le leur dit. Les autres
// tables — comptes, quiz, archives, profils — répondent normalement.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { PartyBackup, type GainMiroir, type ReponseMiroir } from '../src/core/backup'
import { initDb } from '../src/core/db'
import type { QuizServerOptions } from '../src/server'

type Reglages = NonNullable<QuizServerOptions['miroir']>

/** Des réessais rapides et une alerte précoce : le banc ne va pas attendre les délais de production. */
const RAPIDE: Reglages = { reessaisMs: [40, 80, 160], alerteMs: 400, delaiExtinctionMs: 3000 }

// ── Outils ────────────────────────────────────────────────────────────────

/** Un serveur jetable le temps d'un test, refermé quoi qu'il arrive. */
async function avecBanc(reglages: Reglages, scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer({ miroir: reglages })
  try {
    await scenario(banc)
  } finally {
    retablir(banc)
    await banc.close()
  }
}

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

const compter = (chemin: string, sql: string, ...args: unknown[]): number =>
  Number(Object.values(lire(chemin, sql, ...args)[0] as object)[0])

/** L'espace de l'administrateur du banc — c'est lui qui signe chaque ligne du miroir. */
const espaceDuBanc = (banc: Banc): string =>
  lire<{ id: string }>(permanente(banc), 'SELECT id FROM accounts WHERE slug = ?', ADMIN.slug)[0].id

const TABLES_DU_MIROIR = [
  'party_players',
  'party_teams',
  'party_bonus',
  'party_answers',
  'party_scores',
  'party_sessions',
  'party_soiree',
]

/**
 * Pose les déclencheurs de panne, une fois pour toutes. Ils ne mordent que
 * pour les opérations inscrites dans la table témoin : une panne complète,
 * ou seulement les effacements.
 */
function preparerPanne(banc: Banc) {
  const db = new Database(permanente(banc))
  try {
    db.exec('CREATE TABLE IF NOT EXISTS panne_miroir (operation TEXT PRIMARY KEY)')
    for (const table of TABLES_DU_MIROIR) {
      for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
        db.exec(
          `CREATE TRIGGER IF NOT EXISTS panne_${table}_${op.toLowerCase()} BEFORE ${op} ON ${table}
           WHEN EXISTS (SELECT 1 FROM panne_miroir WHERE operation = '${op}')
           BEGIN SELECT RAISE(ABORT, 'panne simulée du miroir'); END`,
        )
      }
    }
  } finally {
    db.close()
  }
}

function panne(banc: Banc, operations = ['INSERT', 'UPDATE', 'DELETE']) {
  preparerPanne(banc)
  const db = new Database(permanente(banc))
  try {
    for (const op of operations) db.prepare('INSERT OR IGNORE INTO panne_miroir (operation) VALUES (?)').run(op)
  } finally {
    db.close()
  }
}

function retablir(banc: Banc) {
  try {
    const db = new Database(permanente(banc), { fileMustExist: true })
    try {
      const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'panne_miroir'").get()
      if (table) db.prepare('DELETE FROM panne_miroir').run()
    } finally {
      db.close()
    }
  } catch {
    // Le dossier du banc est peut-être déjà effacé : il n'y a plus rien à rétablir.
  }
}

/** Attend qu'une condition devienne vraie — ou échoue, en disant laquelle. */
async function jusqua(cond: () => boolean | Promise<boolean>, label: string, timeoutMs = 8000) {
  const limite = Date.now() + timeoutMs
  while (Date.now() < limite) {
    if (await cond()) return
    await patienter(40)
  }
  throw new Error(`délai dépassé en attendant : ${label}`)
}

/** Qui répond quoi, question par question. */
type Reponses = [Invite, number][][]

/**
 * Joue un quiz de bout en bout depuis l'écran commun, puis le termine comme
 * l'animateur le ferait. Tous les participants répondent : la salle révèle
 * d'elle-même après le souffle.
 */
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
  await attendre(host, 'session:ended', (p: any) => p.sessionId === sessionId, 'la fin de la partie')
  return sessionId
}

/** Le classement public de la soirée en cours, trié par prénom. */
async function classement(url: string, slug = ADMIN.slug): Promise<{ name: string; points: number }[]> {
  const recap = (await (await fetch(`${url}/s/${slug}/recap.json`)).json()) as any
  return recap.ranking
    .map((r: any) => ({ name: r.name, points: r.points }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
}

/** Ce que la base locale et le miroir disent de la soirée d'un espace. */
function etat(banc: Banc, espace: string) {
  const local = banc.dbPath
  const loin = permanente(banc)
  return {
    local: {
      invites: compter(local, 'SELECT COUNT(*) FROM players WHERE space_id = ?', espace),
      gains: compter(local, 'SELECT COUNT(*) FROM score_entries WHERE space_id = ?', espace),
      reponses: compter(local, 'SELECT COUNT(*) FROM answer_log WHERE space_id = ?', espace),
    },
    miroir: {
      invites: compter(loin, 'SELECT COUNT(*) FROM party_players WHERE space_id = ?', espace),
      gains: compter(loin, 'SELECT COUNT(*) FROM party_scores WHERE space_id = ?', espace),
      reponses: compter(loin, 'SELECT COUNT(*) FROM party_answers WHERE space_id = ?', espace),
    },
  }
}

/** Rend tout ce que la console dit pendant `travail`, en le laissant passer — et quand elle l'a dit. */
async function ecouterLaConsole<T>(
  travail: () => Promise<T>,
): Promise<{ resultat: T; lignes: string[]; quand: Map<string, number> }> {
  const lignes: string[] = []
  const quand = new Map<string, number>()
  const avant = { log: console.log, warn: console.warn, error: console.error }
  for (const nom of ['log', 'warn', 'error'] as const) {
    console[nom] = (...args: unknown[]) => {
      const ligne = args.map(String).join(' ')
      lignes.push(ligne)
      quand.set(ligne, Date.now())
      avant[nom](...args)
    }
  }
  try {
    return { resultat: await travail(), lignes, quand }
  } finally {
    Object.assign(console, avant)
  }
}

// ── 1. Une panne pendant la fête ─────────────────────────────────────────

/**
 * Le scénario de la revue : Alice arrive, la base permanente décroche, Bob
 * arrive et un quiz de deux questions se joue. La panne se lève, et
 * l'hébergeur rallume aussitôt l'instance sur un disque effacé.
 */
async function panneEtReveil(banc: Banc) {
  const espace = espaceDuBanc(banc)
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
  const host = await ecranCommun(banc.url, cookie)
  const alice = await invite(banc.url, 'Alice', '🦊')
  await jusqua(() => etat(banc, espace).miroir.invites === 1, 'Alice dans le miroir')

  panne(banc)
  const bob = await invite(banc.url, 'Bob', '🐻')
  await jouerQuiz(host, quiz, [
    [
      [alice, 0],
      [bob, 0],
    ],
    [
      [alice, 0],
      [bob, 1],
    ],
  ])
  await patienter(300)
  const pendant = etat(banc, espace)
  // La panne mord vraiment : rien de tout ça n'a atteint le miroir.
  assert.equal(pendant.miroir.invites, 1, 'pendant la panne, Bob n’est pas dans le miroir')
  assert.equal(pendant.miroir.gains, 0, 'pendant la panne, aucun gain dans le miroir')
  assert.equal(pendant.local.reponses, 4, 'deux questions, deux invités : quatre lignes au journal')
  const avant = await classement(banc.url)
  assert.ok(avant.every(r => r.points > 0), `chacun a marqué : ${JSON.stringify(avant)}`)

  // La panne se lève, et l'hébergeur recycle l'instance dans la foulée :
  // l'arrêt doit vider la file, sans attendre le prochain réessai.
  retablir(banc)
  await banc.redemarrer({ disqueEfface: true })

  assert.deepEqual(await classement(banc.url), avant, 'au réveil, chacun retrouve ses points')
  // De tous les états de la partie passés par la file, c'est le dernier — la
  // partie terminée — que le miroir a gardé : le réveil ne la relance pas.
  const salle = await instantane<any>(await ecranCommun(banc.url, await connexionAnimateur(banc.url)))
  assert.equal(salle.session, null, 'aucune partie ne reprend au réveil')
  assert.deepEqual(
    lire(permanente(banc), 'SELECT status FROM party_sessions WHERE space_id = ?', espace),
    [{ status: 'ended' }],
  )
  const apres = etat(banc, espace)
  assert.deepEqual(apres.local, pendant.local, 'au réveil, la base locale est celle d’avant — invités, gains, réponses')
  assert.deepEqual(apres.miroir, pendant.local, 'le miroir porte chaque ligne une seule fois')

  // Le réveil a repris les identifiants du miroir : une nouvelle panne, et
  // la resynchronisation qui suit son rétablissement, ne doublent rien.
  panne(banc)
  await invite(banc.url, 'Chloé', '🦉')
  await patienter(200)
  retablir(banc)
  const sante = async () => ((await (await fetch(`${banc.url}/healthz`)).json()) as any).miroir
  await jusqua(async () => (await sante()).enAttente === 0 && (await sante()).echecsConsecutifs === 0, 'la file vidée')
  assert.deepEqual(
    etat(banc, espace).miroir,
    { ...pendant.local, invites: 3 },
    'Chloé a rejoint le miroir, et rien n’y est doublé',
  )
  const ids = (chemin: string, sql: string) => lire<{ id: string }>(chemin, sql, espace).map(r => r.id).sort()
  assert.deepEqual(
    ids(banc.dbPath, 'SELECT uid AS id FROM score_entries WHERE space_id = ?'),
    ids(permanente(banc), 'SELECT id FROM party_scores WHERE space_id = ?'),
    'chaque gain garde, ici et au loin, l’identifiant tiré à son écriture',
  )
}

test('une panne du miroir pendant la fête : la file rattrape tout, et le réveil ne perd rien', () =>
  avecBanc(RAPIDE, panneEtReveil))

test('une file trop longue cède la place à une resynchronisation de l’espace entier', async () => {
  const { lignes } = await ecouterLaConsole(() =>
    // Un seuil minuscule : la moindre attente déborde, et c'est l'espace
    // entier, relu dans la base locale, qui repart au rétablissement.
    avecBanc({ ...RAPIDE, seuilOctets: 2000 }, panneEtReveil),
  )
  assert.ok(
    lignes.some(l => /resynchronis/i.test(l) && /file/i.test(l)),
    'le journal dit que la file a débordé et que l’espace sera resynchronisé',
  )
})

// ── 2. Une écriture rejouée n'ajoute rien ────────────────────────────────

test('une même écriture rejouée n’ajoute rien au miroir', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-miroir-'))
  const url = `file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`
  const locale = initDb(path.join(dir, 'locale.db'))
  const backup = new PartyBackup(url, undefined, { base: locale, reessaisMs: [20] })
  try {
    await backup.init('espace-1')
    const miroir = backup.forSpace('espace-1')
    // La première écriture aboutit, mais sa réponse se perd en route : la
    // file la renvoie telle quelle.
    const client = (backup as any).client
    const batch = client.batch.bind(client)
    let coupures = 1
    client.batch = async (...args: any[]) => {
      const r = await batch(...args)
      if (coupures-- > 0) throw new TypeError('fetch failed')
      return r
    }
    const gain: GainMiroir = { uid: 'gain-1', playerId: 'p1', sessionId: 's1', points: 100, reason: 'Q1', createdAt: 1 }
    miroir.saveScore(gain)
    // Et l'appelant la redemande, identique.
    miroir.saveScore(gain)
    const reponse: ReponseMiroir = {
      uid: 'reponse-1',
      sessionId: 's1',
      quizTitle: 'Quiz',
      qIndex: 0,
      kind: 'choice',
      playerId: 'p1',
      answered: true,
      correct: true,
      choice: 0,
      value: null,
      target: null,
      ms: 1200,
      changes: 0,
      points: 100,
      durationMs: 20000,
      observed: false,
      createdAt: 2,
    }
    miroir.saveAnswers([reponse])
    miroir.saveAnswers([reponse])
    await backup.close()
    const chemin = url.replace(/^file:/, '')
    assert.deepEqual(
      lire(chemin, 'SELECT id, points FROM party_scores'),
      [{ id: 'gain-1', points: 100 }],
      'le gain porte l’identifiant tiré en local, une seule fois',
    )
    assert.deepEqual(lire(chemin, 'SELECT id FROM party_answers'), [{ id: 'reponse-1' }], 'la réponse aussi')
  } finally {
    locale.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('pendant une panne, les états successifs d’une partie se remplacent dans la file', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-miroir-'))
  const url = `file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`
  const locale = initDb(path.join(dir, 'locale.db'))
  const backup = new PartyBackup(url, undefined, { base: locale, reessaisMs: [60_000] })
  try {
    await backup.init('espace-1')
    const client = (backup as any).client
    const batch = client.batch.bind(client)
    let enPanne = true
    client.batch = async (...args: any[]) => {
      if (enPanne) throw new TypeError('fetch failed')
      return batch(...args)
    }
    const miroir = backup.forSpace('espace-1')
    const partie = (n: number) => ({
      id: 'partie-1',
      spaceId: 'espace-1',
      status: 'running' as const,
      participantIds: '[]',
      state: JSON.stringify({ phase: 'question', n }),
      timers: '{}',
      createdAt: 1,
      updatedAt: n,
    })
    // Cent réponses en cours de question : cent états de la même partie.
    for (let n = 1; n <= 100; n++) miroir.saveSession(partie(n))
    await patienter(20)
    // Le premier est parti avant la panne constatée ; les 99 autres n'en font qu'un.
    assert.equal(backup.sante().enAttente, 2, 'la file garde le premier envoi et le dernier état')
    // Puis dix révélations : leurs gains s'additionnent, leur état se remplace.
    for (let n = 101; n <= 110; n++) {
      miroir.ouvrirLot()
      miroir.saveScore({ uid: `gain-${n}`, playerId: 'p1', sessionId: 'partie-1', points: 100, reason: `Q${n}`, createdAt: n })
      miroir.saveSession(partie(n))
      miroir.fermerLot()
    }
    assert.equal(backup.sante().enAttente, 1 + 10 + 1, 'dix gains et un seul état attendent derrière le premier envoi')

    enPanne = false
    await backup.close()
    const chemin = url.replace(/^file:/, '')
    assert.deepEqual(
      lire(chemin, 'SELECT updated_at FROM party_sessions'),
      [{ updated_at: 110 }],
      'la base distante a le dernier état',
    )
    assert.equal(compter(chemin, 'SELECT COUNT(*) FROM party_scores'), 10)
  } finally {
    locale.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 3. La copie exacte du quiz joué ──────────────────────────────────────

test('la copie exacte d’un quiz joué survit au réveil : l’archive garde ses intitulés d’origine', () =>
  avecBanc(RAPIDE, async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const titre = 'Le quiz joué'
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Intitulé d’origine ?', ['Oui', 'Non'], 0)], titre)
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊')
    const sessionId = await jouerQuiz(host, quiz, [[[alice, 0]]])
    await jusqua(
      () => compter(permanente(banc), 'SELECT COUNT(*) FROM party_answers WHERE session_id = ?', sessionId) === 1,
      'le journal de la partie dans le miroir',
    )
    await patienter(300)

    // Le lendemain matin, l'animateur retouche le quiz — même titre, même
    // forme, un autre intitulé : la bibliothèque ne peut plus servir de copie.
    const retouche = await ecrire(
      banc.url,
      `/api/quizzes/${quiz}`,
      { title: titre, questions: [qcm('Intitulé réécrit ?', ['Oui', 'Non'], 0)] },
      cookie,
      'PUT',
    )
    assert.equal(retouche.status, 200)

    // L'instance s'est endormie entre-temps : le disque est effacé.
    await banc.redemarrer({ disqueEfface: true })
    const bilan = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/bilan.json`)).json()) as any
    assert.equal(bilan.questions[0].text, 'Intitulé d’origine ?', 'le bilan du lendemain relit la question posée')

    const host2 = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    const rangee = attendre<any>(host2, 'toast', () => true, 'la soirée rangée', 15_000)
    ;(host2 as any).emit('host:archiveParty', {})
    assert.equal((await rangee).kind, 'info')
    // Rangée, elle reste en cours : l'historique la montre à part.
    const { current } = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
    const archive = (await (
      await fetch(`${banc.url}/s/${ADMIN.slug}/soirees/${current.id}/bilan.json`)
    ).json()) as any
    assert.equal(archive.questions[0].text, 'Intitulé d’origine ?', 'l’archive porte l’intitulé posé ce soir-là')
    assert.equal(archive.questions[0].uncertain, false)
    // La partie terminée reste au miroir, avec son statut : rien ne la
    // reprendra, mais c'est d'elle que le prochain réveil relira la copie.
    assert.equal(
      compter(permanente(banc), "SELECT COUNT(*) FROM party_sessions WHERE id = ? AND status = 'ended'", sessionId),
      1,
    )
  }))

// ── 4. « Clore la soirée » quand le miroir refuse d’effacer ─────────────

test('« Clore la soirée » avec le miroir en panne : rien d’effacé, et le message dit vrai', () =>
  avecBanc(RAPIDE, async banc => {
    const espace = espaceDuBanc(banc)
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊')
    await jouerQuiz(host, quiz, [[[alice, 0]]])
    await jusqua(() => etat(banc, espace).miroir.gains === 1, 'le gain d’Alice dans le miroir')
    const avant = etat(banc, espace)
    // Close, la soirée envoie sa fin à chaque téléphone ; un essai effacé,
    // ou une soirée vierge, le renvoie à l'entrée.
    let reinitialisee = false
    alice.socket.on('party:reset', () => (reinitialisee = true))
    alice.socket.on('soiree:fin', () => (reinitialisee = true))

    // Le miroir accepte encore d'écrire, mais plus d'effacer.
    panne(banc, ['DELETE'])
    const refus = attendre<any>(host, 'toast', () => true, 'la réponse à « Clore la soirée »', 15_000)
    ;(host as any).emit('host:closeParty', {})
    const toast = await refus
    assert.equal(toast.kind, 'error', `la clôture devait échouer : ${toast.message}`)
    assert.match(toast.message, /^Rien n’a été effacé/)
    assert.match(toast.message, /réessaie/, 'le message dit quoi faire')
    await patienter(300)
    assert.deepEqual(etat(banc, espace), avant, 'rien n’a été effacé — ni ici, ni dans le miroir')
    assert.equal(
      (await instantane<any>(host, s => s.players.length === 1, 'la salle intacte')).players[0].name,
      'Alice',
      'l’écran commun montre toujours la salle',
    )
    assert.equal(reinitialisee, false, 'le téléphone d’Alice ne lit pas « c’est fini » pour une soirée qui continue')
    assert.equal(compter(permanente(banc), 'SELECT COUNT(*) FROM party_soiree WHERE space_id = ?', espace), 1)

    // La panne levée, la clôture passe — et efface les deux côtés.
    retablir(banc)
    const vierge = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    assert.equal((await vierge).kind, 'info')
    await jusqua(() => reinitialisee, 'le téléphone d’Alice reçoit sa fin de soirée')
    const efface = etat(banc, espace)
    assert.deepEqual(efface.local, { invites: 0, gains: 0, reponses: 0 })
    assert.deepEqual(efface.miroir, { invites: 0, gains: 0, reponses: 0 })
    for (const table of TABLES_DU_MIROIR) {
      assert.equal(compter(permanente(banc), `SELECT COUNT(*) FROM ${table} WHERE space_id = ?`, espace), 0, `${table} vidée`)
    }

    // Et rien de l'ancienne soirée ne ressuscite au réveil.
    await banc.redemarrer({ disqueEfface: true })
    const host2 = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    assert.deepEqual((await instantane<any>(host2)).players, [], 'la salle se réveille vide')
    assert.deepEqual(etat(banc, espace).local, { invites: 0, gains: 0, reponses: 0 })
    const soirees = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
    assert.equal(soirees.current, null, 'aucune soirée en cours')
  }))

// ── 5. La santé du miroir se voit ────────────────────────────────────────

test('/healthz et l’écran commun suivent la panne du miroir, puis le rétablissement', () =>
  avecBanc(RAPIDE, async banc => {
    const sante = async () => ((await (await fetch(`${banc.url}/healthz`)).json()) as any)
    const espace = espaceDuBanc(banc)
    const cookie = await connexionAnimateur(banc.url)
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊')
    await jusqua(() => etat(banc, espace).miroir.invites === 1, 'Alice dans le miroir')

    const calme = await sante()
    assert.equal(calme.ok, true)
    assert.equal(calme.miroir.enAttente, 0)
    assert.equal(calme.miroir.echecsConsecutifs, 0)
    assert.equal(calme.miroir.enEchecDepuis, null)
    assert.ok(calme.miroir.dernierSucces, 'le dernier succès est daté')
    assert.equal((await instantane<any>(host)).sauvegardeEnRetard, undefined, 'pas de pastille quand tout va bien')

    const recusParAlice: any[] = []
    alice.socket.on('party:snapshot', (s: any) => recusParAlice.push(s))
    const recusParLEcran: any[] = []
    host.on('party:snapshot', (s: any) => recusParLEcran.push(s))

    panne(banc)
    await invite(banc.url, 'Bob', '🐻')
    await jusqua(async () => (await sante()).miroir.echecsConsecutifs >= 2, 'des échecs à /healthz')
    const enPanne = await sante()
    assert.equal(enPanne.ok, true, 'le serveur, lui, répond : l’hébergeur ne doit pas le redémarrer')
    assert.ok(enPanne.miroir.enAttente > 0, 'des écritures attendent')
    assert.ok(enPanne.miroir.enEchecDepuis, 'la panne est datée')
    // La route est publique : rien n'y désigne un espace.
    assert.ok(!JSON.stringify(enPanne).includes(espace), 'aucun identifiant d’espace')
    assert.ok(!JSON.stringify(enPanne).includes(ADMIN.slug), 'aucun nom d’espace')

    const alerte = await instantane<any>(host, s => s.sauvegardeEnRetard === true, 'la pastille de l’écran commun')
    assert.equal(alerte.sauvegardeEnRetard, true)
    // Les réessais continuent, mais l'instantané ne bouge qu'aux transitions.
    // (L'arrivée de Bob a pu laisser une diffusion en route : on la laisse arriver.)
    await patienter(300)
    const recusALAlerte = recusParLEcran.length
    await patienter(800)
    assert.ok((await sante()).miroir.echecsConsecutifs > enPanne.miroir.echecsConsecutifs, 'la file réessaie toujours')
    assert.equal(recusParLEcran.length, recusALAlerte, 'aucun instantané de plus à chaque réessai')
    assert.ok(
      recusParAlice.every(s => !('sauvegardeEnRetard' in s)),
      'la pastille n’est jamais envoyée aux téléphones',
    )

    retablir(banc)
    const leve = await instantane<any>(host, s => s.sauvegardeEnRetard === undefined, 'la pastille qui disparaît')
    assert.equal(leve.sauvegardeEnRetard, undefined)
    await jusqua(async () => (await sante()).miroir.enAttente === 0, 'la file vidée')
    const retabli = await sante()
    assert.equal(retabli.miroir.echecsConsecutifs, 0)
    assert.equal(retabli.miroir.enEchecDepuis, null)
    assert.ok(Date.parse(retabli.miroir.dernierSucces) >= Date.parse(enPanne.miroir.enEchecDepuis))
    assert.equal(etat(banc, espace).miroir.invites, 2, 'Bob a rejoint le miroir')
  }))

test('à l’arrêt, une base muette n’est pas attendue au-delà du délai, et ce qui reste est dit', async () => {
  const banc = await demarrer({ miroir: { ...RAPIDE, delaiExtinctionMs: 400 } })
  try {
    await invite(banc.url, 'Alice', '🦊')
    panne(banc)
    await invite(banc.url, 'Bob', '🐻')
    await patienter(100)
    const debut = Date.now()
    // Éteindre puis rallumer : l'arrêt ne doit pas attendre la base au-delà
    // de son délai — l'hébergeur, lui, coupe net.
    const { lignes, quand } = await ecouterLaConsole(() => banc.redemarrer())
    const abandon = lignes.find(l => /abandonn/i.test(l) && /\d/.test(l))
    assert.ok(abandon, `l’arrêt dit combien d’écritures il abandonne :\n${lignes.join('\n')}`)
    const attente = quand.get(abandon)! - debut
    assert.ok(attente < 2500, `l’arrêt a attendu ${attente} ms une base muette, pour un délai de 400 ms`)
  } finally {
    retablir(banc)
    await banc.close()
  }
})

// ── 6. Un arrêt brutal juste après une révélation ────────────────────────

const SERVEUR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const enfants = new Set<ChildProcess>()
const dossiers: string[] = []
after(() => {
  for (const e of enfants) e.kill('SIGKILL')
  for (const d of dossiers) rmSync(d, { recursive: true, force: true })
})

/** Ce qui, hérité de l'environnement du test, changerait le comportement du serveur. */
const HERITAGE_A_OUBLIER = [
  'RENDER',
  'NODE_ENV',
  'PORT',
  'DB_PATH',
  'QUIZ_DB_URL',
  'QUIZ_DB_TOKEN',
  'ADMIN_LOGIN',
  'ADMIN_PASSWORD',
  'ADMIN_SLUG',
  'ADMIN_NAME',
  'PUBLIC_URL',
  'RENDER_EXTERNAL_URL',
  'APP_ENV',
  'MAX_PLAYERS',
  'WIFI_SSID',
  'WIFI_PASS',
  'NODE_OPTIONS',
  'NODE_TEST_CONTEXT',
]

/** `src/index.ts` dans un processus enfant, comme l'hébergeur le lance. Rend son port une fois prêt. */
function lancerServeur(env: Record<string, string>) {
  const propre: NodeJS.ProcessEnv = { ...process.env }
  for (const cle of HERITAGE_A_OUBLIER) delete propre[cle]
  const proc = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: SERVEUR,
    env: { ...propre, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  enfants.add(proc)
  let texte = ''
  proc.stdout!.on('data', d => (texte += d))
  proc.stderr!.on('data', d => (texte += d))
  const fin = new Promise<void>(resolve =>
    proc.on('close', () => {
      enfants.delete(proc)
      resolve()
    }),
  )
  const pret = new Promise<number>((resolve, reject) => {
    proc.stdout!.on('data', () => {
      const m = /serveur prêt sur http:\/\/localhost:(\d+)/.exec(texte)
      if (m) resolve(Number(m[1]))
    })
    void fin.then(() => reject(new Error(`arrêté avant d’être prêt :\n${texte}`)))
    setTimeout(() => reject(new Error(`toujours pas prêt après 60 s :\n${texte}`)), 60_000).unref()
  })
  pret.catch(() => {})
  return { proc, pret, fin, sortie: () => texte }
}

test('tué juste après une révélation, le serveur ne paie pas la question deux fois au réveil', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-miroir-'))
  dossiers.push(dir)
  const dbPath = path.join(dir, 'locale.db')
  const env = {
    RENDER: 'true',
    PORT: '0',
    DB_PATH: dbPath,
    QUIZ_DB_URL: `file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`,
    ADMIN_LOGIN: 'antoine',
    ADMIN_PASSWORD: 'amorcage-2026',
    ADMIN_SLUG: 'essai',
  }
  const premier = lancerServeur(env)
  const url = `http://localhost:${await premier.pret}`
  const cookie = await connexionAnimateur(url, 'antoine', 'amorcage-2026')
  const quiz = await creerQuiz(url, cookie, [qcm('Vite ?'), qcm('Encore ?')])
  const host = await ecranCommun(url, cookie)
  const alice = await invite(url, 'Alice', '🦊', { slug: 'essai' })
  const sessionId = await lancerQuiz(host, quiz)
  await attendre(host, 'session:view', (p: any) => p.sessionId === sessionId && p.view.phase === 'question', 'la question', 15_000)
  // La salle réfléchit : la recopie de la partie n'a rien en attente, et la
  // réponse d'Alice part aussitôt dans le miroir — la révélation, elle,
  // tombe dans la fenêtre de deux secondes qui suit.
  await patienter(2500)
  const revelee = attendre<any>(host, 'session:view', (p: any) => p.view.phase === 'reveal', 'la révélation', 15_000)
  const ack = await emitAck<any>(alice.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
  assert.equal(ack.ok, true)
  await revelee
  const paye = (await instantane<any>(host, s => s.players.some((p: any) => p.score > 0), 'les points d’Alice')).players[0]
    .score as number
  assert.ok(paye > 100, `Alice a marqué (${paye})`)

  // Manque de mémoire, arrêt forcé : le processus meurt sans rien finir.
  await patienter(300)
  premier.proc.kill('SIGKILL')
  await premier.fin
  host.close()
  alice.socket.close()

  // L'hébergeur le relance sur un disque vierge : tout revient du miroir.
  for (const suffixe of ['', '-wal', '-shm']) rmSync(`${dbPath}${suffixe}`, { force: true })
  const second = lancerServeur(env)
  const url2 = `http://localhost:${await second.pret}`
  try {
    // Un chronomètre réarmé sonnerait dans les cinquante millisecondes.
    await patienter(1500)
    assert.deepEqual(
      await classement(url2, 'essai'),
      [{ name: 'Alice', points: paye }],
      'la question n’est payée qu’une fois',
    )
    const miroir = path.join(dir, 'permanente.db')
    assert.equal(compter(miroir, 'SELECT COUNT(*) FROM party_scores WHERE session_id = ?', sessionId), 1, 'un seul gain au miroir')
    assert.equal(
      compter(miroir, 'SELECT COUNT(*) FROM party_answers WHERE session_id = ? AND q_index = 0', sessionId),
      1,
      'une seule ligne au journal pour la question',
    )
  } finally {
    second.proc.kill('SIGTERM')
    await second.fin
  }
})
