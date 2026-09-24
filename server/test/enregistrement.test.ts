// Deux appareils sur un même quiz.
//
// Le portable et le téléphone ouvrent le même quiz ; le téléphone change la
// question 1 et enregistre, le portable change la question 2 et enregistre :
// la question 1 revenait à l'ancien texte, et aucun des deux écrans ne le
// disait (tablée du 24 septembre, ED-2). L'éditeur envoie désormais la
// version d'où partent ses modifications (`base`) : si le quiz a été
// enregistré ailleurs depuis, le serveur répond 409 au lieu d'écraser.
//
// Deux choses ne doivent pas faire un faux conflit : l'enregistrement qui
// attend le réveil de l'hébergeur (`auReveil`) et rejoue son envoi — le
// premier essai a pu passer, sa réponse s'est perdue —, et une page d'avant,
// qui n'envoie pas de `base`.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, cookieDe, creerQuiz, demarrer, ecrire, patienter, qcm } from './banc'
import { QuizStore } from '../src/core/quizStore'
import type { QuizDef } from '../../shared/library'

const banc = await demarrer()
after(() => banc.close())
const cookie = await connexionAnimateur(banc.url)

const lire = async (id: string) =>
  (await (await fetch(`${banc.url}/api/quizzes/${id}`, { headers: { Cookie: cookie } })).json()) as QuizDef
const enregistrer = (id: string, corps: Record<string, unknown>) => ecrire(banc.url, `/api/quizzes/${id}`, corps, cookie, 'PUT')

test('le second « Enregistrer » parti d’une version dépassée est refusé, et dit quoi faire', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')], 'Main levée')
  const ouvert = await lire(id)

  // Le téléphone enregistre d'abord.
  const telephone = await enregistrer(id, {
    title: ouvert.title,
    questions: [qcm('MODIF DU TÉLÉPHONE'), qcm('Deux ?')],
    base: ouvert.updatedAt,
    jeton: 'telephone-1',
  })
  assert.equal(telephone.status, 200)
  const apresTelephone = (await telephone.json()) as QuizDef
  assert.ok(apresTelephone.updatedAt > ouvert.updatedAt)

  // Le portable, parti de la même version, est refusé.
  const portable = await enregistrer(id, {
    title: ouvert.title,
    questions: [qcm('Un ?'), qcm('MODIF DU PORTABLE')],
    base: ouvert.updatedAt,
    jeton: 'portable-1',
  })
  assert.equal(portable.status, 409)
  const refus = (await portable.json()) as { error: string; conflit?: { updatedAt: number } }
  assert.match(refus.error, /enregistré ailleurs/)
  assert.equal(refus.conflit?.updatedAt, apresTelephone.updatedAt)
  assert.equal((await lire(id)).questions[0].text, 'MODIF DU TÉLÉPHONE', 'rien n’est écrasé')

  // Le portable choisit de garder sa version : il repart de celle du serveur.
  const force = await enregistrer(id, {
    title: ouvert.title,
    questions: [qcm('Un ?'), qcm('MODIF DU PORTABLE')],
    base: refus.conflit!.updatedAt,
    jeton: 'portable-2',
  })
  assert.equal(force.status, 200)
  assert.equal((await lire(id)).questions[1].text, 'MODIF DU PORTABLE')
})

test('un envoi rejoué au réveil n’entre pas en conflit avec lui-même', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Un ?')])
  const ouvert = await lire(id)
  const envoi = { title: 'Q', questions: [qcm('Premier essai')], base: ouvert.updatedAt, jeton: 'reveil-1', essai: 1 }
  // Le premier essai passe, mais sa réponse se perd : l'éditeur rejoue, même base, même jeton.
  assert.equal((await enregistrer(id, envoi)).status, 200)
  const rejoue = await enregistrer(id, { ...envoi, questions: [qcm('Écrit pendant l’attente')], essai: 2 })
  assert.equal(rejoue.status, 200)
  assert.equal((await lire(id)).questions[0].text, 'Écrit pendant l’attente')

  // Mais si un autre appareil a enregistré entre les deux, le rejeu est refusé.
  const id2 = await creerQuiz(banc.url, cookie, [qcm('Un ?')])
  const base = (await lire(id2)).updatedAt
  const premier = { title: 'Q', questions: [qcm('Premier essai')], base, jeton: 'reveil-2', essai: 1 }
  assert.equal((await enregistrer(id2, premier)).status, 200)
  const autre = await lire(id2)
  assert.equal((await enregistrer(id2, { title: 'Q', questions: [qcm('Autre appareil')], base: autre.updatedAt, jeton: 'autre', essai: 1 })).status, 200)
  assert.equal((await enregistrer(id2, { ...premier, essai: 2 })).status, 409)
})

/**
 * Ralentit l'écriture en base le temps d'un test : les deux essais d'un même
 * clic se croisent alors comme au réveil de l'hébergeur, quand l'essai
 * abandonné par le client arrive en même temps que son rejeu.
 */
async function avecSaveLent<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const save = QuizStore.prototype.save
  QuizStore.prototype.save = async function (this: QuizStore, ...args: Parameters<typeof save>) {
    await patienter(ms)
    return save.apply(this, args)
  }
  try {
    return await fn()
  } finally {
    QuizStore.prototype.save = save
  }
}

test('deux essais du même clic qui arrivent ensemble passent tous les deux', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Un ?')])
  const base = (await lire(id)).updatedAt
  const envoi = { title: 'Q', base, jeton: 'course-1' }
  const [abandonne, rejoue] = await avecSaveLent(300, async () => {
    const abandonne = enregistrer(id, { ...envoi, questions: [qcm('Essai 1')], essai: 1 })
    await patienter(50)
    const rejoue = enregistrer(id, { ...envoi, questions: [qcm('Essai 2')], essai: 2 })
    return Promise.all([abandonne, rejoue])
  })
  assert.equal(abandonne.status, 200)
  assert.equal(rejoue.status, 200, 'son propre clic n’est pas « enregistré ailleurs »')
  assert.equal((await lire(id)).questions[0].text, 'Essai 2')
})

test('un essai périmé qui arrive après son rejeu ne réécrit rien', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Un ?')])
  const base = (await lire(id)).updatedAt
  const envoi = { title: 'Q', base, jeton: 'perime-1' }
  // Le rejeu passe le premier ; l'essai abandonné arrive ensuite.
  assert.equal((await enregistrer(id, { ...envoi, questions: [qcm('Essai 2')], essai: 2 })).status, 200)
  const perime = await enregistrer(id, { ...envoi, questions: [qcm('Essai 1')], essai: 1 })
  assert.equal(perime.status, 200)
  assert.equal(((await perime.json()) as QuizDef).questions[0].text, 'Essai 2', 'il rend le quiz en base')
  assert.equal((await lire(id)).questions[0].text, 'Essai 2', 'l’ancien texte n’écrase pas le nouveau')

  // Dans une course aussi : le rejeu, parti le premier, écrit ; l'abandonné, derrière, n'écrit rien.
  const id2 = await creerQuiz(banc.url, cookie, [qcm('Un ?')])
  const base2 = (await lire(id2)).updatedAt
  const [a, b] = await avecSaveLent(300, async () => {
    const a = enregistrer(id2, { title: 'Q', base: base2, jeton: 'perime-2', questions: [qcm('Essai 2')], essai: 2 })
    await patienter(50)
    const b = enregistrer(id2, { title: 'Q', base: base2, jeton: 'perime-2', questions: [qcm('Essai 1')], essai: 1 })
    return Promise.all([a, b])
  })
  assert.deepEqual([a.status, b.status], [200, 200])
  assert.equal((await lire(id2)).questions[0].text, 'Essai 2')
})

test('une page d’avant, sans base, enregistre comme avant', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Un ?')])
  assert.equal((await enregistrer(id, { title: 'Q', questions: [qcm('Sans base')] })).status, 200)
  assert.equal((await enregistrer(id, { title: 'Q', questions: [qcm('Encore')] })).status, 200)
  assert.equal((await lire(id)).questions[0].text, 'Encore')
})

test('un quiz d’un autre espace reste introuvable, base ou pas', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Chez moi ?')])
  const ouvert = await lire(id)
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'voisin', name: 'Voisin', slug: 'chez-le-voisin' }, cookie)
  assert.equal(cree.status, 201)
  const { activation } = (await cree.json()) as { activation: { token: string } }
  const voisin = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'voisin-pass-1' }))
  const chezLeVoisin = (corps: Record<string, unknown>) => ecrire(banc.url, `/api/quizzes/${id}`, corps, voisin, 'PUT')
  assert.equal((await chezLeVoisin({ title: 'Volé', questions: [qcm('Écrasé ?')], base: ouvert.updatedAt, jeton: 'v', essai: 1 })).status, 404)
  assert.equal((await chezLeVoisin({ title: 'Volé', questions: [qcm('Écrasé ?')] })).status, 404)
  assert.equal((await lire(id)).questions[0].text, 'Chez moi ?', 'rien n’a bougé chez moi')
})

test('un temps hors bornes est refusé à l’éditeur d’aujourd’hui, et rangé pour une page d’avant', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
  const base = (await lire(id)).updatedAt
  // Le « 4 » d'un champ vidé puis quitté partait en base à 5 s sans un mot.
  const refus = await enregistrer(id, { title: 'Q', questions: [qcm('Un ?'), qcm('Deux ?', ['Oui', 'Non'], 0, 4)], base, jeton: 't', essai: 1 })
  assert.equal(refus.status, 400)
  assert.match(((await refus.json()) as { error: string }).error, /Question 2 .*de 5 à 120 s/)
  assert.deepEqual((await lire(id)).questions.map(q => q.duration), [20, 20], 'rien n’est écrit')

  const observe = await enregistrer(id, { title: 'Q', questions: [{ ...qcm('Un ?'), observeSeconds: 90 }], base, jeton: 'o', essai: 1 })
  assert.equal(observe.status, 400)
  assert.match(((await observe.json()) as { error: string }).error, /de 2 à 30 s/)

  // Une page d'avant, sans base : bornée en silence, comme avant.
  assert.equal((await enregistrer(id, { title: 'Q', questions: [qcm('Un ?', ['Oui', 'Non'], 0, 4)] })).status, 200)
  assert.equal((await lire(id)).questions[0].duration, 5)
})
