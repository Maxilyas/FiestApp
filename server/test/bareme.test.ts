// Le barème des questions : ce qu'une réponse rapporte.
//
// Deux plaintes l'ont réécrit. À l'estimation, le barème payait le rang :
// 200 points au plus proche, 30 au second d'un duel — à 0,1 près comme à
// 1 000 près, et même à égalité d'écart quand la virgule flottante séparait
// deux distances pourtant égales. Au QCM, le bonus de rapidité fondait dès
// l'affichage, pendant que toute la salle lisait encore la question.
//
// Les formules sont pures : elles se testent directement. Deux parties jouées
// sur un serveur jetable vérifient que ce sont bien elles qui paient.
import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { pointsDesEstimations, pointsDuChoix, tempsDeLecture } from '../src/games/quiz'
import { indexerJournal } from '../src/core/journal'
import type { AnswerRow } from '../src/core/answers'
import { ecartEstimation } from '../../shared/classement'
import type { PlayableQuestion } from '../../shared/library'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  estimation,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'

const bancs: Banc[] = []

after(async () => {
  for (const banc of bancs) await banc.close()
})

// ── L'estimation ──────────────────────────────────────────────────────────

describe('l’estimation paie la distance, plus le rang', () => {
  test('même écart, mêmes points — de part et d’autre de la réponse', () => {
    const [bas, haut] = pointsDesEstimations(8, [7.9, 8.1])
    assert.equal(bas, haut, '7,9 et 8,1 pour 8 : le même écart')
    assert.ok(bas >= 190, `deux estimations à 0,1 près valent presque le maximum, vu ${bas}`)

    // En virgule flottante, 0,8 − 0,7 vaut 0,1000…09 et 0,9 − 0,8 vaut
    // 0,0999…98 : le second était « plus proche », et touchait 200 contre 30.
    assert.notEqual(Math.abs(0.7 - 0.8), Math.abs(0.9 - 0.8), 'le piège existe bien')
    assert.equal(ecartEstimation(0.7, 0.8), ecartEstimation(0.9, 0.8))
    const [a, b] = pointsDesEstimations(0.8, [0.7, 0.9])
    assert.equal(a, b, '0,7 et 0,9 pour 0,8 : le même écart')
  })

  test('le second d’un duel ne perd plus 170 points pour un cran de plus', () => {
    const [premier, second] = pointsDesEstimations(8, [7.9, 8.2])
    assert.ok(premier > second, 'le plus proche marque toujours davantage')
    assert.ok(premier - second <= 10, `7,9 et 8,2 pour 8 : ${premier} contre ${second}`)

    // Face à une réponse exacte, un an d'écart sur une date garde l'essentiel.
    const [pile, apres] = pointsDesEstimations(1994, [1994, 1995])
    assert.equal(pile, 200, 'la réponse exacte touche le maximum')
    assert.ok(apres >= 150, `un an d’écart, face à une réponse exacte, vaut ${apres}`)
  })

  test('plus loin ne rapporte jamais plus, et chacun garde sa participation', () => {
    const cible = 1994
    const valeurs = [1994, 1993, 1996, 1990, 2000, 1980, 2024, 1900, 19940, -5, 1995, 2010]
    const points = pointsDesEstimations(cible, valeurs)
    const parEcart = valeurs.map((v, i) => ({ ecart: Math.abs(v - cible), points: points[i] })).sort((x, y) => x.ecart - y.ecart)
    for (let i = 1; i < parEcart.length; i++) {
      assert.ok(parEcart[i].points <= parEcart[i - 1].points, `à ${parEcart[i].ecart} d’écart, pas plus qu’à ${parEcart[i - 1].ecart}`)
    }
    for (const p of points) assert.ok(p >= 30 && p <= 200, `entre la participation et le maximum, vu ${p}`)
  })

  test('une proposition absurde ne touche que sa participation, et ne change rien aux autres', () => {
    // À deux : la moitié de la salle ne peut pas faire la loi.
    const [proche, absurde] = pointsDesEstimations(1994, [1995, 19940])
    assert.equal(absurde, 30, '« 19940 » pour 1994 : la participation seule')
    assert.ok(proche >= 190, `l’autre n’en pâtit pas, vu ${proche}`)

    // À trois et plus, c'est une médiane : une faute de frappe ne la déplace
    // pas, là où une échelle linéaire donnait le maximum à toute la salle.
    const avecFaute = pointsDesEstimations(1994, [1994, 2004, 99999])
    const sansFaute = pointsDesEstimations(1994, [1994, 2004, 2010])
    assert.deepEqual(avecFaute.slice(0, 2), sansFaute.slice(0, 2))
    assert.equal(avecFaute[2], 30)
  })

  test('l’écart typique vient de la salle : six ans pèsent plus quand tout le monde tombe près', () => {
    const serree = pointsDesEstimations(1994, [1994, 1995, 1993, 2000])[3]
    const large = pointsDesEstimations(1994, [1970, 2020, 1980, 2000])[3]
    assert.ok(serree < large, `2000 pour 1994 : ${serree} dans une salle précise, ${large} dans une salle qui tâtonne`)
  })

  test('seul à répondre, on est jugé sur la réponse elle-même', () => {
    assert.equal(pointsDesEstimations(8, [8])[0], 200)
    assert.ok(pointsDesEstimations(8, [7])[0] >= 150, 'un cran à côté')
    assert.equal(pointsDesEstimations(8, [80])[0], 30, 'dix fois trop : rien que la participation')
  })

  test('le journal range les écarts égaux ex æquo : l’expérience du plus proche va aux deux', () => {
    const ligne = (playerId: string, value: number): AnswerRow => ({
      sessionId: 's1',
      quizTitle: 'Quiz',
      qIndex: 0,
      kind: 'number',
      playerId,
      answered: true,
      correct: null,
      choice: null,
      value,
      target: 0.8,
      ms: 3000,
      changes: 0,
      points: 0,
      durationMs: 20_000,
      observed: false,
      createdAt: 0,
    })
    const [quiz] = indexerJournal([ligne('a', 0.7), ligne('b', 0.9), ligne('c', 1.5)], [])
    const rangs = quiz.questions[0].rangsEstimation
    assert.deepEqual([rangs.get('a'), rangs.get('b'), rangs.get('c')], [1, 1, 3])
  })
})

// ── Le QCM ────────────────────────────────────────────────────────────────

describe('le QCM offre le temps de lire', () => {
  const question = (text: string, answers: string[], extra: Partial<PlayableQuestion> = {}): PlayableQuestion =>
    ({ kind: 'choice', text, answers, correct: 0, duration: 20, image: null, observeSeconds: null, ...extra }) as PlayableQuestion

  test('le bonus ne fond qu’après le temps de lecture, jusqu’à la moitié à l’échéance', () => {
    const lecture = tempsDeLecture(
      question('Quelle est la plus grande planète du système solaire ?', ['Saturne', 'Jupiter', 'Neptune', 'Uranus']),
    )
    assert.ok(lecture >= 4000 && lecture <= 6000, `une question ordinaire se lit en quatre à six secondes, vu ${lecture} ms`)
    assert.equal(pointsDuChoix(800, 20_000, lecture), 200, 'répondre pendant la lecture : le maximum')
    assert.equal(pointsDuChoix(lecture, 20_000, lecture), 200, 'et jusqu’à son dernier instant')
    assert.equal(pointsDuChoix(lecture + (20_000 - lecture) / 2, 20_000, lecture), 150, 'à mi-course, la moitié du bonus')
    assert.equal(pointsDuChoix(20_000, 20_000, lecture), 100, 'à l’échéance, la bonne réponse sans bonus')
    assert.equal(pointsDuChoix(21_400, 20_000, lecture), 100, 'livrée pendant la marge du réseau : pareil')
  })

  test('une question longue ou une photo laissent plus de temps — jamais plus de la moitié du chrono', () => {
    const courte = tempsDeLecture(question('Vrai ou faux : les flamants roses naissent gris.', ['Vrai', 'Faux']))
    const longue = tempsDeLecture(
      question('Lequel de ces aliments peut se conserver des millénaires sans périmer ?', ['Le miel', 'Le beurre', 'Le riz', 'Le chocolat']),
    )
    assert.ok(longue > courte, `${longue} ms pour la longue, ${courte} ms pour la courte`)

    const photo = question('Qui est-ce ?', ['Alice', 'Bob'], { image: '/media/image/x' })
    assert.equal(tempsDeLecture(photo) - tempsDeLecture({ ...photo, image: null }), 1500, 'une photo à regarder')
    // La photo « mémoire » a été regardée avant, pendant l'observation.
    assert.equal(tempsDeLecture({ ...photo, observeSeconds: 5 }), tempsDeLecture({ ...photo, image: null }))

    assert.equal(tempsDeLecture(question('x'.repeat(500), ['a', 'b'], { duration: 10 })), 5000, 'la moitié de dix secondes')
    // Un emoji se lit d'un coup d'œil, pas en deux unités de code.
    assert.equal(tempsDeLecture(question('Lequel ?', ['😂', '😴'])), tempsDeLecture(question('Lequel ?', ['a', 'b'])))
  })
})

// ── Sur un vrai serveur ───────────────────────────────────────────────────

/** Un serveur à soi, un quiz, l'écran commun, deux invités — et la première question posée. */
async function partie(questions: Parameters<typeof creerQuiz>[2]) {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, questions)
  const host = await ecranCommun(banc.url, cookie)
  const alice = await invite(banc.url, 'Alice', '🦊')
  const bob = await invite(banc.url, 'Bob', '🐼')
  const posee = attendre<any>(alice.socket, 'session:view', p => p.view.phase === 'question', 'la question')
  const sessionId = await lancerQuiz(host, quiz)
  const question = (await posee).view
  const revelation = (socket: Socket) =>
    attendre<any>(socket, 'session:view', p => p.view.phase === 'reveal', 'la révélation').then(p => p.view)
  const agir = (qui: Invite, action: Record<string, unknown>) =>
    emitAck<any>(qui.socket, 'player:action', { sessionId, action: { ...action, qIndex: question.qIndex, round: question.round } })
  return { host, alice, bob, revelation, agir }
}

describe('sur un vrai serveur', { concurrency: true }, () => {
  test('7,9 et 8,1 pour 8 : autant de points, et la cible pour les deux à l’écran commun', async () => {
    const { host, alice, bob, revelation, agir } = await partie([estimation('Combien de pattes a une araignée ?', 8)])
    const chezEux = Promise.all([revelation(alice.socket), revelation(bob.socket), revelation(host)])
    assert.equal((await agir(alice, { type: 'guess', value: 7.9 })).ok, true)
    assert.equal((await agir(bob, { type: 'guess', value: 8.1 })).ok, true)
    const [va, vb, vh] = await chezEux
    assert.equal(va.yourPoints, vb.yourPoints, 'le même écart vaut les mêmes points')
    assert.ok(va.yourPoints >= 190, `à 0,1 près, presque le maximum : vu ${va.yourPoints}`)
    assert.deepEqual(
      vh.guesses.map((g: any) => g.rank),
      [1, 1],
      'l’écran commun numérotait les lignes : « 2 » sous la cible, pour autant de points',
    )
  })

  test('une bonne réponse donnée pendant la lecture vaut le maximum', async () => {
    const { alice, bob, revelation, agir } = await partie([
      qcm('Lequel de ces aliments peut se conserver des millénaires sans périmer ?', ['Le miel', 'Le beurre', 'Le riz', 'Le chocolat'], 0),
    ])
    const chezEux = Promise.all([revelation(alice.socket), revelation(bob.socket)])
    // Deux secondes et demie : le temps de lire le début de la question. Le
    // bonus fondait déjà — 188 points au lieu de 200.
    await patienter(2500)
    assert.equal((await agir(alice, { type: 'answer', choice: 0 })).ok, true)
    assert.equal((await agir(bob, { type: 'answer', choice: 1 })).ok, true)
    const [va, vb] = await chezEux
    assert.equal(va.yourPoints, 200, 'la lecture ne coûte rien')
    assert.equal(vb.yourPoints, 0, 'une mauvaise réponse ne rapporte toujours rien')
  })
})
