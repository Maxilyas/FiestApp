// Une fin de soirée à la fois.
//
// Une clôture attend la base permanente des secondes durant — l'archive, les
// crédits, cent profils. `closeParty` et `discardParty` posaient leur drapeau
// sans le lire : un second « Clore » (la télécommande et la console, ou un
// second toucher faute de retour) relisait la soirée entière, passait
// derrière le premier dans la file, puis recréditait, annonçait une seconde
// clôture au podium vide et effaçait l'invité entré entre les deux. Et
// « Clore » touché pendant qu'un essai s'effaçait réarchivait l'essai que la
// console venait de dire perdu.
//
// Le même geste attend donc le premier et en reçoit l'issue ; le geste
// contraire est refusé ; chaque console dit « Clôture en cours… ». Et qui
// scanne le QR pendant la clôture repasse par l'entrée au lieu de rester
// sur une salle d'attente dont il ne fait plus partie.
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
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'
import { ArchiveStore } from '../src/core/archive'
import { gainVide, releveVide, totalGain } from '../../shared/profil'

ProfileStore.tirageEclat = () => false

// ── Outils ────────────────────────────────────────────────────────────────

type Reponses = [Invite, number][][]

/** Joue un quiz de bout en bout depuis l'écran commun, puis le referme. */
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

function lire<T = any>(banc: Banc, sql: string, ...args: unknown[]): T[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}

/** La base permanente de l'hébergeur prend son temps : l'archivage de la clôture aussi. */
function archivageLent(ms: number): { entre: Promise<void>; retablir: () => void } {
  const dOrigine = ArchiveStore.prototype.save
  let signaler!: () => void
  const entre = new Promise<void>(r => (signaler = r))
  ArchiveStore.prototype.save = async function (...args: Parameters<typeof dOrigine>) {
    signaler()
    await patienter(ms)
    return dOrigine.apply(this, args)
  }
  return { entre, retablir: () => (ArchiveStore.prototype.save = dOrigine) }
}

// ── Deux « Clore » ────────────────────────────────────────────────────────

test('deux « Clore la soirée » croisés : une seule clôture, la fin gardée intacte, la soirée suivante aussi', async () => {
  const banc = await demarrer()
  const lent = archivageLent(300)
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Q1 ?'), qcm('Q2 ?'), qcm('Q3 ?')], 'Trois')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Alice a déjà joué chez un autre hôte, dans une salle — seule, la
    // soirée ne compterait pas : ce soir, « Le Globe-trotteur » tombe à la
    // clôture — un palier, que sa fin gardée doit encore dire.
    {
      const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
      try {
        const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
        const ailleurs = { ...gainVide(), reponses: 8 }
        db.prepare(
          `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'une-soiree-ailleurs', 'un-autre-hote', ?, ?, ?)`,
        ).run(id, totalGain(ailleurs), JSON.stringify({ v: VERSION_BAREME, gain: ailleurs, releve: releveVide() }), Date.now() - 86_400_000)
      } finally {
        db.close()
      }
    }
    const tele = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    const dora = await invite(banc.url, 'Dora', '🐙')
    await jouerQuiz(tele, quiz, [
      [[alice, 0], [bob, 1], [dora, 0]],
      [[alice, 0], [bob, 1], [dora, 1]],
      [[alice, 0], [bob, 0], [dora, 1]],
    ])
    await patienter(500)

    // La télé et le téléphone de l'animateur : chacun clôt.
    const telephone = await ecranCommun(banc.url, cookie)
    const annonces: any[] = []
    tele.on('soiree:cloture', (c: any) => annonces.push(c))
    const finsEnDirect: any[] = []
    alice.socket.on('soiree:fin', (f: any) => finsEnDirect.push(f))
    const vus: unknown[] = []
    telephone.on('party:snapshot', (s: any) => vus.push(s.finEnRoute))
    const toastTele = attendre<any>(tele, 'toast', () => true, 'la clôture (télé)', 20_000)
    const toastTel = attendre<any>(telephone, 'toast', () => true, 'la clôture (téléphone)', 20_000)
    const premiereAnnonce = attendre<any>(tele, 'soiree:cloture', () => true, 'l’annonce de clôture', 20_000)
    ;(tele as any).emit('host:closeParty', { title: 'La soirée des deux clics' })
    // La première clôture attend la base ; la seconde console touche à son tour.
    await lent.entre
    ;(telephone as any).emit('host:closeParty', { title: 'Un autre titre' })

    // Dès l'annonce, la soirée suivante commence : Zoé scanne le QR.
    await premiereAnnonce
    const zoe = await invite(banc.url, 'Zoé', '🦋')
    const [t1, t2] = await Promise.all([toastTele, toastTel])
    await patienter(800)

    // Les deux consoles lisent la même issue ; la salle, une seule annonce.
    assert.equal(t1.kind, 'info', t1.message)
    assert.equal(t2.message, t1.message, 'la seconde console reçoit l’issue de la première clôture')
    assert.match(t1.message, /La soirée des deux clics/)
    assert.equal(annonces.length, 1, 'une seule annonce de clôture')
    // Bob et Dora ont chacun une bonne réponse : leur ordre tient à la vitesse.
    const podium = annonces[0].podium.map((p: any) => p.nom)
    assert.deepEqual([podium[0], [...podium].sort()], ['Alice', ['Alice', 'Bob', 'Dora']], 'la clôture garde son podium')
    assert.equal(lire(banc, 'SELECT id FROM soirees').length, 1, 'une seule archive')
    // L'autre console a lu « Clôture en cours… », puis plus rien une fois finie.
    assert.ok(vus.includes('close'), 'l’autre console aurait dû voir la clôture en cours')
    assert.equal((await instantane(telephone, s => !s.finEnRoute, 'la clôture finie')).finEnRoute, undefined)

    // Le téléphone d'Alice dormait : au réveil, il retrouve la fin qu'il
    // aurait reçue en direct — palier compris.
    const reveil = connecter(banc.url, aliceCookie)
    await emitAck(reveil, 'party:watch', { slug: ADMIN.slug })
    const rep = await emitAck<any>(reveil, 'player:join', { slug: ADMIN.slug, token: alice.token })
    assert.equal(finsEnDirect.length, 1)
    assert.deepEqual(rep.fin, finsEnDirect[0])
    assert.deepEqual(
      rep.fin.profil.paliers.map((p: any) => p.key),
      ['hf:globe-trotteur:1'],
    )

    // Zoé, entrée dans la soirée suivante, y est toujours.
    const salle = await instantane(tele, s => s.players.length > 0, 'la salle de la soirée suivante')
    assert.deepEqual(salle.players.map((p: any) => p.name), ['Zoé'])
    const zoeRevient = connecter(banc.url)
    await emitAck(zoeRevient, 'party:watch', { slug: ADMIN.slug })
    const zoeRep = await emitAck<any>(zoeRevient, 'player:join', { slug: ADMIN.slug, token: zoe.token })
    assert.equal(zoeRep.ok, true, `Zoé ne se retrouve plus : ${zoeRep.error ?? zoeRep.reason}`)
  } finally {
    lent.retablir()
    await banc.close()
  }
})

// ── L'essai et la clôture ─────────────────────────────────────────────────

test('« C’était un essai » puis « Clore » sur l’autre console : la clôture est refusée, l’essai ne revient pas', async () => {
  const banc = await demarrer()
  const retirerDOrigine = ProfileStore.prototype.retirerSoireeEntiere
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Q1 ?'), qcm('Q2 ?')], 'Deux')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const tele = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    await jouerQuiz(tele, quiz, [
      [[alice, 0], [bob, 1]],
      [[alice, 0], [bob, 1]],
    ])
    // Le podium a rangé la soirée et crédité Alice.
    for (let i = 0; i < 50 && lire(banc, "SELECT 1 FROM profile_xp WHERE soiree_id NOT LIKE '#%'").length === 0; i++) {
      await patienter(100)
    }
    const soiree = lire<{ id: string }>(banc, 'SELECT id FROM soirees')[0]?.id
    assert.ok(soiree, 'la soirée aurait dû se ranger après son quiz')

    // L'effacement attend la base permanente, comme en ligne.
    let signaler!: () => void
    const effacementEnCours = new Promise<void>(r => (signaler = r))
    ProfileStore.prototype.retirerSoireeEntiere = async function (...args: Parameters<typeof retirerDOrigine>) {
      signaler()
      await patienter(300)
      return retirerDOrigine.apply(this, args)
    }
    const telephone = await ecranCommun(banc.url, cookie)
    const vus: unknown[] = []
    telephone.on('party:snapshot', (s: any) => vus.push(s.finEnRoute))
    const toastEssai = attendre<any>(tele, 'toast', () => true, 'l’essai effacé', 20_000)
    const toastClose = attendre<any>(telephone, 'toast', () => true, 'la clôture refusée', 20_000)
    ;(tele as any).emit('host:discardParty')
    await effacementEnCours
    ;(telephone as any).emit('host:closeParty', { title: 'Finalement, on garde' })
    const [t1, t2] = await Promise.all([toastEssai, toastClose])
    await patienter(500)

    assert.deepEqual(t1, { kind: 'info', message: 'Essai effacé — rien n’a été gardé' })
    assert.deepEqual(lire(banc, 'SELECT id FROM soirees WHERE id = ?', soiree), [], 'l’essai n’est pas réarchivé')
    assert.deepEqual(lire(banc, 'SELECT xp FROM profile_xp WHERE soiree_id = ?', soiree), [], 'ni recrédité')
    assert.equal(t2.kind, 'error')
    assert.match(t2.message, /essai est en train de s’effacer/)
    assert.ok(vus.includes('discard'), 'l’autre console aurait dû voir l’effacement en cours')
  } finally {
    ProfileStore.prototype.retirerSoireeEntiere = retirerDOrigine
    await banc.close()
  }
})

test('« Clore » puis « C’était un essai » : l’effacement est refusé, la soirée se clôt une fois', async () => {
  const banc = await demarrer()
  const lent = archivageLent(300)
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Q1 ?')], 'Une')
    const tele = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊')
    const bob = await invite(banc.url, 'Bob', '🐻')
    await jouerQuiz(tele, quiz, [[[alice, 0], [bob, 1]]])
    await patienter(500)

    const telephone = await ecranCommun(banc.url, cookie)
    const toastClose = attendre<any>(tele, 'toast', () => true, 'la clôture', 20_000)
    const toastEssai = attendre<any>(telephone, 'toast', () => true, 'l’effacement refusé', 20_000)
    const annonces: any[] = []
    tele.on('soiree:cloture', (c: any) => annonces.push(c))
    ;(tele as any).emit('host:closeParty', { title: 'On garde' })
    await lent.entre
    ;(telephone as any).emit('host:discardParty')
    const [t1, t2] = await Promise.all([toastClose, toastEssai])
    await patienter(300)

    assert.equal(t1.kind, 'info', t1.message)
    assert.equal(t2.kind, 'error')
    assert.match(t2.message, /en train de se clore/)
    assert.equal(annonces.length, 1)
    assert.deepEqual(
      lire(banc, 'SELECT title FROM soirees').map((s: any) => s.title),
      ['On garde'],
      'la soirée close reste dans l’historique',
    )
  } finally {
    lent.retablir()
    await banc.close()
  }
})

// ── Entrer pendant la clôture ─────────────────────────────────────────────

test('entré pendant la clôture : son téléphone repasse par l’entrée, jamais oublié en silence', async () => {
  const banc = await demarrer()
  const lent = archivageLent(400)
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Q1 ?')], 'Une')
    const tele = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊')
    const bob = await invite(banc.url, 'Bob', '🐻')
    await jouerQuiz(tele, quiz, [[[alice, 0], [bob, 1]]])
    await patienter(500)

    const toast = attendre<any>(tele, 'toast', () => true, 'la clôture', 20_000)
    const recusParAlice: string[] = []
    for (const ev of ['soiree:fin', 'party:reset']) alice.socket.on(ev, () => recusParAlice.push(ev))
    ;(tele as any).emit('host:closeParty', { title: 'Fin' })
    await lent.entre

    // Zoé scanne le QR que la télé montre encore.
    const zoe = await invite(banc.url, 'Zoé', '🦋')
    const recus: string[] = []
    for (const ev of ['soiree:fin', 'party:reset', 'player:removed']) zoe.socket.on(ev, () => recus.push(ev))
    const t = await toast
    await patienter(800)

    assert.equal(t.kind, 'info', t.message)
    // Alice lit sa fin de soirée, et rien d'autre ; Zoé, qui n'en a pas,
    // retourne à l'entrée pour la soirée suivante.
    assert.deepEqual(recusParAlice, ['soiree:fin'])
    assert.deepEqual(recus, ['party:reset'])
    const reponse = await emitAck<any>(zoe.socket, 'player:join', { slug: ADMIN.slug, name: 'Zoé', avatar: '🦋' })
    assert.equal(reponse.ok, true, `Zoé ne peut pas rejoindre la soirée suivante : ${reponse.error}`)
  } finally {
    lent.retablir()
    await banc.close()
  }
})
