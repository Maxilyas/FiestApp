// L'enchaînement des questions et le choix du quiz, vus de la console.
//
// Léa pilotait debout, l'enchaînement réglé sur 20 s : pendant la photo à
// mémoriser, la console affichait « au clic », et chaque nouveau quiz
// repartait « au clic » — à régler de nouveau, téléphone en main. Et le
// choix du quiz ne disait pas lequel on avait déjà joué ce soir.
//
// Chaque test a son propre serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  invite,
  lancerQuiz,
  qcm,
  type Banc,
  type Socket,
} from './banc'

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

/** Une photo « mémoire » : son adresse suffit, le serveur ne sert pas l'image pendant la partie. */
const PHOTO = '/media/image/00000000-0000-4000-8000-000000000000'

const commande = (host: Socket, sessionId: string, command: unknown) =>
  (host as any).emit('host:command', { sessionId, command })

const vue = (host: Socket, pred: (v: any) => boolean, label: string) =>
  attendre<any>(host, 'session:view', p => pred(p.view), label, 15_000).then(p => p.view)

test('pendant la photo à mémoriser, la console sait que l’enchaînement est réglé', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [
      qcm('Pour commencer ?', ['Oui', 'Non'], 0, 60),
      { ...qcm('Combien de bougies ?', ['Trente', 'Quarante'], 0, 60), image: PHOTO, observeSeconds: 30 },
    ])
    await invite(banc.url, 'Alice')
    const host = await ecranCommun(banc.url, cookie)
    const sessionId = await lancerQuiz(host, quiz)
    await vue(host, v => v.phase === 'question', 'la première question')
    commande(host, sessionId, { type: 'autoNext', seconds: 20 })
    await vue(host, v => v.phase === 'question' && v.autoNextSeconds === 20, 'l’enchaînement réglé')
    commande(host, sessionId, { type: 'next' })
    await vue(host, v => v.phase === 'reveal', 'la révélation')
    commande(host, sessionId, { type: 'next' })
    const photo = await vue(host, v => v.phase === 'observe', 'la photo')
    assert.equal(photo.autoNextSeconds, 20, 'la photo dit l’enchaînement réglé')

    // Et « au clic » y reprend vraiment la main.
    commande(host, sessionId, { type: 'autoNext', seconds: null })
    await vue(host, v => v.phase === 'observe' && v.autoNextSeconds === null, 'la main reprise pendant la photo')
  }))

test('le quiz suivant garde l’enchaînement du précédent, et le choix dit ce qui a été joué ce soir', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const premier = await creerQuiz(banc.url, cookie, [qcm('Première ?', ['Oui', 'Non'], 0, 60)], 'Le premier')
    const second = await creerQuiz(banc.url, cookie, [qcm('Seconde ?', ['Oui', 'Non'], 0, 60)], 'Le second')
    await invite(banc.url, 'Alice')
    const host = await ecranCommun(banc.url, cookie)

    const choix = vue(host, v => v.phase === 'pickPack', 'le choix du premier quiz')
    const sessionId = await lancerQuiz(host, premier)
    const avant = await choix
    assert.equal(avant.packs.some((p: any) => p.joueCeSoir), false, 'rien n’est joué avant le premier quiz')
    await vue(host, v => v.phase === 'question', 'la question')
    commande(host, sessionId, { type: 'autoNext', seconds: 10 })
    await vue(host, v => v.autoNextSeconds === 10, 'l’enchaînement réglé')
    ;(host as any).emit('host:endSession', { sessionId })

    // Le quiz suivant : même enchaînement, et le premier marqué.
    const choixSuivant = vue(host, v => v.phase === 'pickPack', 'le choix du quiz suivant')
    const suivant = await lancerQuiz(host, second)
    const apres = await choixSuivant
    const joues = apres.packs.filter((p: any) => p.joueCeSoir).map((p: any) => p.id)
    assert.deepEqual(joues, [premier], 'le premier quiz est « joué ce soir », pas le second')
    const question = await vue(host, v => v.phase === 'question', 'la question du quiz suivant')
    assert.equal(question.autoNextSeconds, 10, 'l’enchaînement suit d’un quiz à l’autre')

    // La clôture l'oublie : la soirée suivante repart au clic, sans rien de joué.
    commande(host, suivant, { type: 'next' })
    await vue(host, v => v.phase === 'reveal', 'la révélation')
    ;(host as any).emit('host:endSession', { sessionId: suivant })
    const close = attendre<any>(host, 'toast', () => true, 'la clôture', 15_000)
    ;(host as any).emit('host:discardParty')
    await close
    await invite(banc.url, 'Bob', '🐻')
    const vierge = vue(host, v => v.phase === 'pickPack', 'le choix de la soirée suivante')
    const nouvelle = await lancerQuiz(host, premier)
    assert.equal((await vierge).packs.some((p: any) => p.joueCeSoir), false, 'une nouvelle soirée n’a rien joué')
    const q = await vue(host, v => v.phase === 'question', 'la question de la soirée suivante')
    assert.equal(q.autoNextSeconds, null, 'la soirée suivante repart au clic')
    ;(host as any).emit('host:endSession', { sessionId: nouvelle })
  }))
