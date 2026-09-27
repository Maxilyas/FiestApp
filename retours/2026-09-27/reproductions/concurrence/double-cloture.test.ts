// Deux « Clore la soirée » qui se croisent.
//
// `closeParty` pose `fermeture` mais ne la lit pas : une seconde clôture
// demandée pendant que la première attend la base permanente (ses crédits
// prennent des secondes à cent profils) relit les mêmes journaux, passe
// derrière elle dans la file, puis — une fois la première finie et la salle
// vidée — recrédite, réannonce et revide.
//
// Ce que ce test attend (il échoue aujourd'hui) :
//  1. la dernière annonce de clôture que voit l'écran commun garde son podium ;
//  2. la fin de soirée qu'un téléphone endormi retrouve au réveil est celle
//     qu'il aurait reçue en direct ;
//  3. un invité entré dans la soirée suivante entre les deux ne disparaît pas.
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/double-cloture.test.ts
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
  type Invite,
  type Socket,
} from '../../../server/test/banc'
import { ProfileStore, VERSION_BAREME } from '../../../server/src/auth/profiles'
import { ArchiveStore } from '../../../server/src/core/archive'
import { gainVide, releveVide } from '../../../shared/profil'

ProfileStore.tirageEclat = () => false

type Reponses = [Invite, number][][]

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

test('deux « Clore la soirée » croisés : une seule fin, et la soirée suivante intacte', async () => {
  const banc = await demarrer()
  const saveDOrigine = ArchiveStore.prototype.save
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Q1 ?'), qcm('Q2 ?'), qcm('Q3 ?')], 'Trois')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Alice a déjà joué chez un autre hôte : ce soir, « Le Globe-trotteur »
    // (deux hôtes) tombe à la clôture — un palier, que sa fin doit lui dire.
    {
      const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
      try {
        const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
        db.prepare(
          `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'une-soiree-ailleurs', 'un-autre-hote', 0, ?, ?)`,
        ).run(id, JSON.stringify({ v: VERSION_BAREME, gain: gainVide(), releve: releveVide() }), Date.now() - 86_400_000)
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

    // La base permanente de l'hébergeur répond en dizaines de millisecondes,
    // et une clôture à cent profils en attend des centaines : on rend
    // l'archivage lent, comme en ligne.
    ArchiveStore.prototype.save = async function (...args: Parameters<typeof saveDOrigine>) {
      await patienter(300)
      return saveDOrigine.apply(this, args)
    }

    // Deux consoles : la télé et le téléphone de l'animateur. Chacune clôt.
    const telephone = await ecranCommun(banc.url, cookie)
    const annonces: any[] = []
    tele.on('soiree:cloture', (c: any) => annonces.push(c))
    const finsEnDirect: any[] = []
    alice.socket.on('soiree:fin', (f: any) => finsEnDirect.push(f))
    const toastTele = attendre<any>(tele, 'toast', () => true, 'la clôture (télé)', 20_000)
    const toastTel = attendre<any>(telephone, 'toast', () => true, 'la clôture (téléphone)', 20_000)
    const premiereAnnonce = attendre<any>(tele, 'soiree:cloture', () => true, 'la première annonce', 20_000)
    ;(tele as any).emit('host:closeParty', { title: 'La soirée des deux clics' })
    ;(telephone as any).emit('host:closeParty', { title: 'La soirée des deux clics' })

    // Dès la première annonce, la soirée suivante commence : Zoé scanne le QR.
    await premiereAnnonce
    const zoe = await invite(banc.url, 'Zoé', '🦋')
    const [t1, t2] = await Promise.all([toastTele, toastTel])
    await patienter(800)

    console.log('toasts :', t1.message, '|', t2.message)
    console.log(`annonces de clôture reçues par la télé : ${annonces.length}`)
    annonces.forEach((a, i) => console.log(`  annonce ${i + 1} : montées = ${JSON.stringify(a.montees)}, légendaires = ${JSON.stringify(a.legendaires)}`))
    annonces.forEach((a, i) => console.log(`  annonce ${i + 1} : podium = ${JSON.stringify(a.podium.map((p: any) => p.nom))}`))

    // 1. La salle lit son podium sur la télé : la dernière annonce le garde.
    const derniere = annonces.at(-1)
    assert.ok(derniere, 'la télé aurait dû recevoir l’annonce de clôture')

    // 2. Le téléphone d'Alice dormait : au réveil, il retrouve SA fin.
    const reveil = connecter(banc.url, aliceCookie)
    await emitAck(reveil, 'party:watch', { slug: ADMIN.slug })
    const rep = await emitAck<any>(reveil, 'player:join', { slug: ADMIN.slug, token: alice.token })
    console.log('fin en direct :', JSON.stringify(finsEnDirect[0]))
    console.log('fin au réveil :', JSON.stringify(rep.fin))

    // 3. Zoé était entrée dans la soirée suivante : elle y est toujours.
    const salle = await instantane(tele, s => s.players.length > 0, 'la salle de la soirée suivante', ).catch(() => null)
    const noms = (salle?.players ?? []).map((p: any) => p.name)
    console.log('salle après les deux clôtures :', JSON.stringify(noms))
    // Et son téléphone l'a-t-il appris ? Il se re-présente avec son jeton.
    const zoeRevient = connecter(banc.url)
    await emitAck(zoeRevient, 'party:watch', { slug: ADMIN.slug })
    const zoeRep = await emitAck<any>(zoeRevient, 'player:join', { slug: ADMIN.slug, token: zoe.token })
    console.log('Zoé se re-présente :', JSON.stringify({ ok: zoeRep.ok, reason: zoeRep.reason, error: zoeRep.error }))

    assert.deepEqual(
      {
        annoncesDeCloture: annonces.length,
        podiumDeLaDerniereAnnonce: derniere.podium.map((p: any) => p.nom),
        finAuReveil: rep.fin,
        zoeDansLaSalle: noms.includes('Zoé'),
        zoeRetrouvee: zoeRep.ok === true,
      },
      {
        annoncesDeCloture: 1,
        podiumDeLaDerniereAnnonce: annonces[0].podium.map((p: any) => p.nom),
        finAuReveil: finsEnDirect[0],
        zoeDansLaSalle: true,
        zoeRetrouvee: true,
      },
      'deux clôtures croisées : annonce réécrite, fin gardée dégradée, soirée suivante effacée',
    )
  } finally {
    ArchiveStore.prototype.save = saveDOrigine
    await banc.close()
  }
})
