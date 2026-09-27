// Deux enregistrements dans le même espace, deux relectures de la
// bibliothèque — et la plus ancienne arrive la dernière.
//
// Après chaque écriture, `refreshLibrary(spaceId)` relit tous les quiz de
// l'espace (`store.all`) puis les pose en mémoire (`setQuizLibrary`) : c'est
// cette copie que « Lancer » joue (`selectPack`, `games/quiz.ts:1032`). Deux
// relectures qui se croisent — le portable enregistre le quiz A pendant que le
// téléphone enregistre le quiz B — se posent dans l'ordre où leurs réponses
// reviennent de Turso, pas dans l'ordre où elles sont parties : la plus
// ancienne, arrivée la dernière, remet en mémoire le quiz B d'avant sa
// correction. Il y reste jusqu'à la prochaine écriture de l'espace.
//
// Ce que ce test attend (il échoue aujourd'hui) : le quiz lancé est la
// dernière version enregistrée.
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/bibliotheque-perimee.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  invite,
  lancerQuiz,
  patienter,
  qcm,
} from '../../../server/test/banc'
import { QuizStore } from '../../../server/src/core/quizStore'

test('deux quiz enregistrés depuis deux appareils : « Lancer » joue la dernière version de chacun', async () => {
  const banc = await demarrer()
  const all = QuizStore.prototype.all
  try {
    const cookie = await connexionAnimateur(banc.url)
    const a = await creerQuiz(banc.url, cookie, [qcm('A, première version ?')], 'Quiz A')
    const b = await creerQuiz(banc.url, cookie, [qcm('Quelle est la capitale de l’Australie ?', ['Sydney', 'Canberra'], 0)], 'Quiz B')

    // La relecture qui suit l'enregistrement du portable part la première et
    // revient la dernière : Turso répond à chaque requête à son rythme.
    let lente = true
    QuizStore.prototype.all = async function (this: QuizStore, ...args: Parameters<typeof all>) {
      const lue = await all.apply(this, args)
      if (lente) {
        lente = false
        await patienter(400)
      }
      return lue
    }
    const portable = ecrire(banc.url, `/api/quizzes/${a}`, { title: 'Quiz A', questions: [qcm('A, deuxième version ?')] }, cookie, 'PUT')
    await patienter(50)
    // Le téléphone corrige la bonne réponse du quiz B.
    const telephone = ecrire(
      banc.url,
      `/api/quizzes/${b}`,
      { title: 'Quiz B', questions: [qcm('Quelle est la capitale de l’Australie ?', ['Sydney', 'Canberra'], 1)] },
      cookie,
      'PUT',
    )
    assert.equal((await telephone).status, 200)
    assert.equal((await portable).status, 200)
    QuizStore.prototype.all = all
    await patienter(100)

    // Le soir, on lance le quiz B : quelle bonne réponse la salle verra-t-elle ?
    const tele = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊')
    const sessionId = await lancerQuiz(tele, b)
    await attendre<any>(tele, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question', 'la question', 15_000)
    const revelee = attendre<any>(tele, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'reveal', 'la révélation', 15_000)
    ;(alice.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: 1 } }, () => {})
    const vue = (await revelee).view
    const bonne = vue.correct ?? vue.question?.correct ?? vue.reveal?.correct
    console.log('bonne réponse révélée pour B :', JSON.stringify(bonne), '— vue :', JSON.stringify(vue).slice(0, 300))
    assert.equal(bonne, 1, 'le quiz B lancé est celui d’avant la correction enregistrée depuis le téléphone')
  } finally {
    QuizStore.prototype.all = all
    await banc.close()
  }
})
