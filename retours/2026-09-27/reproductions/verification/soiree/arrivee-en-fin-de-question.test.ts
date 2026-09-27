// Contre-expertise de moteur-3 (« arrivé pendant le souffle ») : le même
// sort attend celui qui arrive dans les dernières centaines de millisecondes
// d'une question ordinaire, chronomètre compris — sans souffle ni salle qui a
// fini. `onPlayerJoin` ne regarde que la phase, jamais le temps qui reste.
//
// Ce fichier n'affirme rien de faux sur le code d'aujourd'hui : il MESURE,
// pour dire si la correction proposée (le souffle seul) couvre le cas, ou s'il
// faut une borne de temps. Les deux épreuves passent aujourd'hui et décrivent
// ce qui se passe.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/verification/soiree/arrivee-en-fin-de-question.test.ts
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { horloge, qcm, salle } from '../../moteur/harnais'

let h: ReturnType<typeof horloge> | null = null
afterEach(() => {
  h?.arreter()
  h = null
})

test('arrivé 600 ms avant l’échéance d’une question que personne n’a finie : une ligne à 0 au journal, comme dans le souffle', () => {
  h = horloge()
  const s = salle([{ id: 'q', title: 'Fin de question', questions: [qcm('Un ?'), qcm('Deux ?')] }])
  s.inscrire('Alice')
  s.inscrire('Bruno')
  s.lancer()
  s.choisir('q')
  h.avancer(3000) // la question 1 est posée (20 s)
  s.repondre('Alice', { type: 'answer', choice: 0 })
  // Bruno ne répond pas : pas de souffle, le chronomètre court.
  h.avancer(20_000 - 600)
  assert.equal(s.st.phase, 'question')
  s.rejoindre('Zoé')
  h.avancer(600 + 1500 + 10) // l'échéance, puis la marge du réseau (GRACE_MS)
  assert.equal(s.st.phase, 'reveal')
  const ligne = s.answers.all().find(r => r.playerId === s.idDe('Zoé') && r.qIndex === 0)
  console.log('Zoé, arrivée à 600 ms de l’échéance :', JSON.stringify(ligne && { answered: ligne.answered, points: ligne.points }))
  assert.ok(ligne && ligne.answered === false && ligne.points === 0, 'aujourd’hui : présente, sans réponse, 0 point')
  s.fermer()
})

test('témoin : arrivé pendant la révélation, il commence à la question suivante — rien au journal', () => {
  h = horloge()
  const s = salle([{ id: 'q', title: 'Témoin', questions: [qcm('Un ?'), qcm('Deux ?')] }])
  s.inscrire('Alice')
  s.lancer()
  s.choisir('q')
  h.avancer(3000)
  s.repondre('Alice', { type: 'answer', choice: 0 })
  h.avancer(700)
  assert.equal(s.st.phase, 'reveal')
  s.rejoindre('Zoé')
  assert.equal(s.st.playFrom[s.idDe('Zoé')], 1)
  assert.equal(s.answers.all().filter(r => r.playerId === s.idDe('Zoé')).length, 0)
  s.fermer()
})
