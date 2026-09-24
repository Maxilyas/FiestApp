// L'enchaînement automatique devant une salle vide.
//
// Le 24 septembre, une coupure a vidé la salle de Nadia en plein quiz : en
// mode « 10 s », le serveur a joué trois questions et le podium devant
// personne. La règle : une question close d'elle-même, sans une seule
// réponse de toute la salle, n'enchaîne pas toute seule — la suite attend le
// clic de l'animateur, et l'écran dit pourquoi. Un « Révéler » cliqué dit que
// l'animateur est là : la suite part alors comme il l'a réglée. Le mode reste
// choisi : dès qu'une question reçoit une réponse, il reprend de lui-même.
//
// Le module de jeu se joue ici sans serveur : ce qui compte, c'est quel
// chronomètre il arme, et ce que dit la vue de l'écran commun.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quizModule, setQuizLibrary } from '../src/games/quiz'
import type { GameContext, GameSessionRec, ViewContext } from '../src/core/types'
import type { QuizDef } from '../../shared/library'

function partie(nbQuestions = 3) {
  const spaceId = 'banc-enchainement'
  const quiz: QuizDef = {
    id: 'enchainement',
    title: 'Enchaînement',
    updatedAt: 0,
    questions: Array.from({ length: nbQuestions }, (_, i) => ({
      kind: 'choice' as const,
      text: `Question ${i + 1} ?`,
      answers: ['Oui', 'Non'],
      correct: 0,
      target: null,
      unit: '',
      duration: 20,
      image: null,
      observeSeconds: null,
    })),
  }
  setQuizLibrary(spaceId, [quiz])
  const ids = ['alice', 'bob']
  /** Les chronomètres armés, par nom : c'est ce que le moteur persiste et réarme. */
  const minuteurs = new Map<string, number>()
  let now = 1_000_000
  const ctx: GameContext = {
    award: () => {},
    logAnswers: () => {},
    dropAnswers: () => {},
    setTimer: (id, ms) => void minuteurs.set(id, ms),
    clearTimer: id => void minuteurs.delete(id),
    end: () => {},
    verdict: () => {},
    participants: () => [],
    playerName: id => id,
    now: () => (now += 13),
  }
  const vctx: ViewContext = {
    playerName: id => id,
    player: () => undefined as any,
    memo: <T>(_: string, calculer: () => T) => calculer(),
  }
  const sess: GameSessionRec<any> = {
    id: 'enchainement',
    spaceId,
    status: 'running',
    participantIds: ids,
    state: quizModule.createInitialState(spaceId, ids, undefined),
  }
  quizModule.onHostCommand!(sess, { type: 'selectPack', packId: 'enchainement' }, ctx)
  quizModule.onHostCommand!(sess, { type: 'autoNext', seconds: 10 }, ctx)
  quizModule.onTimer!(sess, 'ready', ctx)
  const ecran = () => quizModule.hostView(sess, vctx) as any
  /** La fin du chronomètre de la question : la révélation. */
  const finDuTemps = () => quizModule.onTimer!(sess, 'question', ctx)
  return { sess, ctx, minuteurs, ecran, finDuTemps }
}

test('personne n’a répondu : la révélation n’enchaîne pas, et la console dit pourquoi', () => {
  const { sess, minuteurs, ecran, finDuTemps } = partie()
  assert.equal(sess.state.phase, 'question')
  finDuTemps()
  assert.equal(sess.state.phase, 'reveal')
  assert.equal(minuteurs.has('autoNext'), false, 'aucun enchaînement ne doit partir devant une salle vide')
  const v = ecran()
  assert.equal(v.autoNextAt, undefined, 'aucun compte à rebours à l’écran')
  assert.equal(v.autoNextSuspendu, true, 'la console doit dire pourquoi elle attend')
  // Le mode reste choisi : c'est l'animateur qui relance, d'un clic.
  assert.equal(v.autoNextSeconds, 10)
})

test('le clic de l’animateur relance, et une question répondue enchaîne de nouveau toute seule', () => {
  const { sess, ctx, minuteurs, ecran, finDuTemps } = partie()
  finDuTemps()
  quizModule.onHostCommand!(sess, { type: 'next' }, ctx)
  assert.equal(sess.state.phase, 'question')
  assert.equal(sess.state.qIndex, 1)
  assert.equal(ecran().autoNextSuspendu, undefined, 'la question suivante n’a plus rien à justifier')

  quizModule.onPlayerAction(sess, 'alice', { type: 'answer', choice: 0 }, ctx)
  finDuTemps()
  assert.equal(sess.state.phase, 'reveal')
  assert.equal(minuteurs.get('autoNext'), 10_000, 'une réponse suffit : l’enchaînement repart')
  assert.equal(ecran().autoNextSuspendu, undefined)
})

test('« Révéler » au clic, même sans réponse : l’animateur est là, la suite part comme il l’a réglée', () => {
  const { sess, ctx, minuteurs, ecran } = partie()
  quizModule.onHostCommand!(sess, { type: 'next' }, ctx)
  assert.equal(sess.state.phase, 'reveal')
  assert.equal(minuteurs.get('autoNext'), 10_000)
  assert.equal(ecran().autoNextSuspendu, undefined)
})

test('en manuel, rien ne change : pas de pause à dire', () => {
  const { sess, ctx, ecran, finDuTemps } = partie()
  quizModule.onHostCommand!(sess, { type: 'autoNext', seconds: null }, ctx)
  finDuTemps()
  assert.equal(ecran().autoNextSuspendu, undefined)
})

test('choisir un palier pendant la révélation suspendue relance l’enchaînement', () => {
  const { sess, ctx, minuteurs, ecran, finDuTemps } = partie()
  finDuTemps()
  quizModule.onHostCommand!(sess, { type: 'autoNext', seconds: 5 }, ctx)
  assert.equal(minuteurs.get('autoNext'), 5_000)
  assert.equal(ecran().autoNextSuspendu, undefined)
})
