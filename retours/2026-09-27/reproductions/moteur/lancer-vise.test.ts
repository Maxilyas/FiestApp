// Invariant 12 : « un geste dit ce qu'il visait ». Les commandes d'une partie
// portent la phase, la question et le tour ; « Terminer » porte la partie ;
// la scène porte l'écran qu'elle quittait. `host:launch` ne porte rien — et
// `GameEngine.launch()` termine la partie en cours, quelle qu'elle soit
// (`engine.ts:215`).
//
// Deux écrans d'animateur (la console du PC et la télécommande) : l'un lance
// et choisit le quiz ; l'autre, qui n'avait pas encore reçu la partie — ou
// dont le clic a voyagé lentement sur une liaison qui hoquetait —, envoie
// « Lancer un quiz » à son tour. Le quiz qui venait de commencer s'arrête
// net pour toute la salle, remplacé par la liste des quiz.
//
// Cette épreuve envoie `host:launch` avec ce qu'il visait (`depuis: null`,
// « aucune partie en cours ») : elle échoue sur b57035c, qui ne lit pas ce
// champ, et passera quand le serveur ignorera un lancement périmé.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
} from '../../../server/test/banc'

let banc: Banc
let cookie: string
before(async () => {
  banc = await demarrer()
  cookie = await connexionAnimateur(banc.url)
})
after(async () => {
  await banc.close()
})

test('moteur-11 · « Lancer un quiz » parti d’un écran qui n’avait pas vu la partie ne l’interrompt pas', async () => {
  const console_ = await ecranCommun(banc.url, cookie)
  const telecommande = await ecranCommun(banc.url, cookie)
  await invite(banc.url, 'Alice', '🦊')
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?', ['Oui', 'Non'], 0, 60), qcm('Deux ?', ['Oui', 'Non'], 0, 60)], 'Le bon quiz')
  const sessionId = await lancerQuiz(console_, quiz)
  await attendre<any>(console_, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question', 'la question 1', 15_000)

  let interrompue = false
  console_.on('session:ended', (p: any) => {
    if (p.sessionId === sessionId) interrompue = true
  })
  // Le clic de la télécommande, parti quand elle ne voyait aucune partie.
  ;(telecommande as any).emit('host:launch', { depuis: null })
  await patienter(500)
  assert.equal(interrompue, false, 'le quiz en pleine question continue pour la salle')
  ;(console_ as any).emit('host:endSession', { sessionId })
  await patienter(200)
})
