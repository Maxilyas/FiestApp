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
import { connexionAnimateur, creerQuiz, demarrer, ecrire, qcm } from './banc'
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
  const envoi = { title: 'Q', questions: [qcm('Premier essai')], base: ouvert.updatedAt, jeton: 'reveil-1' }
  // Le premier essai passe, mais sa réponse se perd : l'éditeur rejoue, même base, même jeton.
  assert.equal((await enregistrer(id, envoi)).status, 200)
  const rejoue = await enregistrer(id, { ...envoi, questions: [qcm('Écrit pendant l’attente')] })
  assert.equal(rejoue.status, 200)
  assert.equal((await lire(id)).questions[0].text, 'Écrit pendant l’attente')

  // Mais si un autre appareil a enregistré entre les deux, le rejeu est refusé.
  const id2 = await creerQuiz(banc.url, cookie, [qcm('Un ?')])
  const base = (await lire(id2)).updatedAt
  const premier = { title: 'Q', questions: [qcm('Premier essai')], base, jeton: 'reveil-2' }
  assert.equal((await enregistrer(id2, premier)).status, 200)
  const autre = await lire(id2)
  assert.equal((await enregistrer(id2, { title: 'Q', questions: [qcm('Autre appareil')], base: autre.updatedAt, jeton: 'autre' })).status, 200)
  assert.equal((await enregistrer(id2, premier)).status, 409)
})

test('une page d’avant, sans base, enregistre comme avant', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Un ?')])
  assert.equal((await enregistrer(id, { title: 'Q', questions: [qcm('Sans base')] })).status, 200)
  assert.equal((await enregistrer(id, { title: 'Q', questions: [qcm('Encore')] })).status, 200)
  assert.equal((await lire(id)).questions[0].text, 'Encore')
  // Un quiz d'un autre espace reste introuvable, base ou pas.
  assert.equal((await enregistrer('inconnu', { title: 'Q', questions: [], base: 1 })).status, 404)
})
