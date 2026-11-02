// Un gel de la boucle à la fin d'une question. La réponse d'un invité, partie
// avant l'échéance, attend dans le noyau pendant que le serveur calcule ; le
// chronomètre de la question, lui, échoit pendant le gel. Gelé dans une lecture
// — une requête, une réponse de la base — ou dans un `setImmediate` — une étape
// de fond —, Node passe le chronomètre échu AVANT de lire les sockets : la
// question se fermait, et la réponse partie à temps recevait « Trop tard ». La
// marge de la question (`GRACE_MS`, 1,5 s) ne couvre pas un gel plus long :
// 2,9 s en production le 31 octobre 2026, pendant une soirée de vingt invités,
// au dixième de cœur de l'hébergeur.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, attendre, connecter, connexionAnimateur, creerQuiz, demarrer, ecranCommun, emitAck, lancerQuiz, qcm, type Banc } from './banc'
import { horloge, qcm as qcmDeLaSalle, salle } from './salle'
import { GRACE_MS } from '../src/games/quiz'

let banc: Banc | undefined

after(async () => {
  await banc?.close()
})

/** Gèle la boucle jusqu'à cette heure : le serveur et le test la partagent. */
function geler(jusqua: number) {
  while (Date.now() < jusqua) {
    // Un calcul qui ne rend pas la main.
  }
}

test('une réponse partie avant l’échéance, arrivée pendant un gel qui dépasse la marge, compte', async () => {
  banc = await demarrer()
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Gelée ?', ['Oui', 'Non'], 0, 5)])
  const host = await ecranCommun(banc.url, cookie)
  const socket = connecter(banc.url)
  assert.ok((await emitAck<any>(socket, 'party:watch', { slug: ADMIN.slug })).ok)
  assert.ok((await emitAck<any>(socket, 'player:join', { slug: ADMIN.slug, name: 'Alice', avatar: '🦊' })).ok)
  const sessionId = await lancerQuiz(host, quiz)
  const posee = (await attendre<any>(socket, 'session:view', p => p.view.phase === 'question', 'la question sur le téléphone')).view
  assert.equal(typeof posee.deadline, 'number', 'la vue de la question porte son échéance')

  // Une seconde avant l'échéance : assez tôt pour qu'une machine chargée, qui
  // réveille le test en retard, la laisse encore partir à temps.
  await new Promise(r => setTimeout(r, Math.max(0, posee.deadline - Date.now() - 1000)))
  let accuse!: (res: any) => void
  const reponse = new Promise<any>(r => (accuse = r))
  // La réponse part, puis la boucle gèle dans un `setImmediate` — comme une
  // étape de fond — jusqu'au-delà de la marge : le chronomètre de la question
  // échoit pendant le gel, la réponse attend d'être lue.
  await new Promise<void>(fini =>
    setImmediate(() => {
      ;(socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: 0, qIndex: posee.qIndex, round: posee.round } }, accuse)
      geler(posee.deadline + GRACE_MS + 500)
      fini()
    }),
  )
  const res = await Promise.race([reponse, new Promise(r => setTimeout(() => r({ ok: false, reason: 'pas d’accusé' }), 5_000))])
  assert.deepEqual(res, { ok: true }, 'partie avant l’échéance, la réponse compte')

  // Le chronomètre n'est pas perdu pour autant : la question se révèle, avec sa réponse.
  const revelee = (await attendre<any>(socket, 'session:view', p => p.view.phase === 'reveal', 'la révélation')).view
  assert.equal(revelee.yourChoice, 0)
  assert.ok(revelee.yourPoints > 0, `la bonne réponse rapporte (${revelee.yourPoints})`)
})

// L'horloge à la main (`salle.ts`) avance d'un coup : un chronomètre y sonne
// donc en retard, et passe son tour de boucle comme après un gel.
test('le chronomètre en retard reste armé le temps de son tour : la pause arrivée pendant ce tour l’éteint', () => {
  const h = horloge()
  const s = salle([{ id: 'q', title: 'Gelée', questions: [qcmDeLaSalle('Une ?'), qcmDeLaSalle('Deux ?')] }])
  try {
    s.inscrire('Alice')
    s.lancer(h.avancer)
    assert.equal(s.st.phase, 'question')
    assert.equal(s.engine.chronometreArme(), true, 'la question court')
    // La pause de l'animateur, lue pendant le tour que le chronomètre échu
    // laisse à ce qui est arrivé pendant le gel : sans lui, la question se
    // révélait en pause.
    setTimeout(() => s.commande({ type: 'pause' }), 20_000 + GRACE_MS + 5)
    h.avancer(30_000)
    assert.equal(s.st.phase, 'question', 'en pause, la question ne se révèle pas')
    assert.notEqual(s.st.pausedMs, null)
    assert.equal(s.engine.chronometreArme(), false, 'en pause, plus rien ne court')
    s.commande({ type: 'resume' })
    assert.equal(s.engine.chronometreArme(), true, 'reprise, la question court de nouveau')
    h.avancer(30_000)
    assert.equal(s.st.phase, 'reveal', 'son chronomètre la révèle, même en retard')
  } finally {
    s.fermer()
    h.arreter()
  }
})
