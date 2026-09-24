// La scène des écrans d'animateur : podium de la soirée, remise des prix,
// victoire, clôture.
//
// C'était un état de la page. Léa animait depuis son téléphone, la télé
// suivait le quiz à la seconde — puis décrochait : « Prix » et « Victoire »
// ne s'ouvraient que sur l'écran qu'on touchait, et elle s'est levée pour
// ouvrir la victoire à la télécommande de la télé. La scène est maintenant
// tenue par le serveur, et tous les écrans d'animateur de l'espace la suivent.
//
// Chaque test a son propre serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'

// La clôture tire l'Éclat : ici, le hasard ne décide de rien.
ProfileStore.tirageEclat = () => false

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

const envoyer = (s: Socket, event: string, payload?: unknown) => (s as any).emit(event, payload)

/** L'instantané dont la scène satisfait le prédicat — le dernier reçu, ou le prochain. */
const scene = (s: Socket, pred: (sc: any) => boolean, label: string) =>
  instantane<any>(s, snap => pred(snap.scene ?? null), label).then(snap => snap.scene ?? null)

/** Le serveur a traité tout ce que cette connexion a envoyé, et ses diffusions sont parties. */
async function barriere(s: Socket) {
  await emitAck(s, 'time:sync', {})
  await patienter(300)
}

test('la télécommande ouvre les prix, la télé les montre ; la victoire suit, et le retour aussi', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    await invite(banc.url, 'Alice')
    const tele = await ecranCommun(banc.url, cookie)
    const telecommande = await ecranCommun(banc.url, cookie)
    assert.equal(await scene(tele, sc => sc === null, 'la salle d’attente'), null)

    envoyer(telecommande, 'host:scene', { ecran: 'prix', depuis: null })
    assert.deepEqual(await scene(tele, sc => sc?.ecran === 'prix', 'les prix à la télé'), { ecran: 'prix' })

    envoyer(telecommande, 'host:scene', { ecran: 'victoire', depuis: 'prix' })
    await scene(tele, sc => sc?.ecran === 'victoire', 'la victoire à la télé')

    // Le podium dit ce qu'il montre, et l'onglet passe aussi.
    envoyer(tele, 'host:scene', { ecran: 'podium', onglet: 'joueurs', depuis: 'victoire' })
    assert.deepEqual(await scene(telecommande, sc => sc?.ecran === 'podium', 'le podium à la télécommande'), {
      ecran: 'podium',
      onglet: 'joueurs',
    })

    // « Revenir », d'où qu'il vienne, ramène tout le monde en salle d'attente.
    envoyer(telecommande, 'host:scene', { ecran: null, depuis: 'podium' })
    await scene(tele, sc => sc === null, 'la télé revenue en salle d’attente')

    // Un écran qui se présente maintenant trouve la scène du moment.
    envoyer(telecommande, 'host:scene', { ecran: 'prix', depuis: null })
    await scene(tele, sc => sc?.ecran === 'prix', 'les prix, encore')
    const rallumee = await ecranCommun(banc.url, cookie)
    assert.equal((await instantane<any>(rallumee)).scene?.ecran, 'prix', 'une télé rallumée retrouve les prix')
  }))

test('un geste qui visait une autre scène est ignoré (invariant 12)', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    await invite(banc.url, 'Alice')
    const tele = await ecranCommun(banc.url, cookie)
    const telecommande = await ecranCommun(banc.url, cookie)

    envoyer(telecommande, 'host:scene', { ecran: 'prix', depuis: null })
    await scene(tele, sc => sc?.ecran === 'prix', 'les prix')
    // La télé avait encore la salle d'attente sous les yeux quand on y a
    // cliqué « Podium » : la télécommande a ouvert les prix entre-temps.
    envoyer(tele, 'host:scene', { ecran: 'podium', depuis: null })
    // Un « Revenir » parti de la victoire, qui n'est plus à l'écran.
    envoyer(tele, 'host:scene', { ecran: null, depuis: 'victoire' })
    // Une scène inconnue, ou une visée illisible, ne visent rien.
    envoyer(tele, 'host:scene', { ecran: 'coulisses', depuis: 'prix' })
    envoyer(tele, 'host:scene', { ecran: null, depuis: 42 })
    // La clôture ne s'ouvre pas à la main.
    envoyer(tele, 'host:scene', { ecran: 'cloture', depuis: 'prix' })
    await barriere(tele)
    assert.deepEqual((await instantane<any>(telecommande)).scene, { ecran: 'prix' }, 'les prix restent à l’écran')

    // Sans visée — une page d'avant —, le geste passe.
    envoyer(tele, 'host:scene', { ecran: 'victoire' })
    await scene(telecommande, sc => sc?.ecran === 'victoire', 'la victoire, sans visée')
  }))

test('la scène ne part qu’aux écrans d’animateur, et un téléphone ne la change pas', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const alice = await invite(banc.url, 'Alice')
    const tele = await ecranCommun(banc.url, cookie)

    envoyer(alice.socket, 'host:scene', { ecran: 'victoire', depuis: null })
    envoyer(alice.socket, 'host:telecommande', { active: true })
    await barriere(alice.socket)
    const snap = await instantane<any>(tele)
    assert.equal(snap.scene, undefined, 'un téléphone n’ouvre aucune scène')
    assert.equal(snap.telecommande, undefined, 'un téléphone ne se déclare pas télécommande')

    envoyer(tele, 'host:scene', { ecran: 'prix', depuis: null })
    await scene(tele, sc => sc?.ecran === 'prix', 'les prix')
    await barriere(tele)
    assert.equal((await instantane<any>(alice.socket)).scene, undefined, 'la salle ne reçoit pas la scène')
  }))

test('la télécommande branchée se dit aux autres écrans, et s’en va avec sa connexion', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    await invite(banc.url, 'Alice')
    const tele = await ecranCommun(banc.url, cookie)
    const telecommande = await ecranCommun(banc.url, cookie)
    assert.equal((await instantane<any>(tele)).telecommande, undefined)

    envoyer(telecommande, 'host:telecommande', { active: true })
    await instantane<any>(tele, s => s.telecommande === true, 'la télécommande annoncée')
    envoyer(telecommande, 'host:telecommande', { active: false })
    await instantane<any>(tele, s => s.telecommande === undefined, 'la télécommande rangée')

    envoyer(telecommande, 'host:telecommande', { active: true })
    await instantane<any>(tele, s => s.telecommande === true, 'la télécommande, de nouveau')
    telecommande.close()
    await instantane<any>(tele, s => s.telecommande === undefined, 'la télécommande éteinte')
  }))

test('un quiz lancé prend la scène ; la clôture prend tous les écrans, et « La soirée suivante » les libère tous', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Première ?', ['Oui', 'Non'], 0, 60)])
    const alice = await invite(banc.url, 'Alice')
    await invite(banc.url, 'Bob', '🐻')
    const tele = await ecranCommun(banc.url, cookie)
    const telecommande = await ecranCommun(banc.url, cookie)

    // Un podium resté à la télé passait devant tout le quiz suivant.
    envoyer(telecommande, 'host:scene', { ecran: 'podium', depuis: null })
    await scene(tele, sc => sc?.ecran === 'podium', 'le podium')
    const sessionId = await lancerQuiz(telecommande, quiz)
    await scene(tele, sc => sc === null, 'le quiz qui prend la scène')

    // Une question jouée : la clôture a quelque chose à raconter.
    await attendre<any>(tele, 'session:view', p => p.view.phase === 'question', 'la question', 15_000)
    assert.equal((await emitAck<any>(alice.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })).ok, true)
    envoyer(telecommande, 'host:command', { sessionId, command: { type: 'next' } })
    await attendre<any>(tele, 'session:view', p => p.view.phase === 'reveal', 'la révélation')
    envoyer(telecommande, 'host:endSession', { sessionId })

    const annonceTele = attendre<any>(tele, 'soiree:cloture', () => true, 'la clôture à la télé', 15_000)
    envoyer(telecommande, 'host:closeParty', { title: 'Soirée de la scène' })
    assert.equal((await annonceTele).soiree.titre, 'Soirée de la scène')
    await scene(tele, sc => sc?.ecran === 'cloture', 'la clôture à la télé')
    // Une clôture n'ouvre ni les prix ni le podium d'une soirée effacée.
    envoyer(tele, 'host:scene', { ecran: 'prix', depuis: 'cloture' })
    await barriere(tele)
    assert.equal((await instantane<any>(telecommande)).scene?.ecran, 'cloture')

    // Une télé rallumée pendant la clôture la retrouve, annonce comprise.
    const rallumee = connecterEcran(banc.url, cookie)
    const annonce = attendre<any>(rallumee.socket, 'soiree:cloture', () => true, 'l’annonce à la télé rallumée')
    await rallumee.pret
    assert.equal((await annonce).soiree.titre, 'Soirée de la scène')
    assert.equal((await instantane<any>(rallumee.socket)).scene?.ecran, 'cloture')

    // « La soirée suivante », cliquée à la télécommande, libère aussi la télé.
    envoyer(telecommande, 'host:scene', { ecran: null, depuis: 'cloture' })
    await scene(tele, sc => sc === null, 'la télé revenue en salle d’attente')
  }))

test('« C’était un essai » ramène la salle d’attente sur tous les écrans', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    await invite(banc.url, 'Alice')
    const tele = await ecranCommun(banc.url, cookie)
    const telecommande = await ecranCommun(banc.url, cookie)
    envoyer(telecommande, 'host:scene', { ecran: 'victoire', depuis: null })
    await scene(tele, sc => sc?.ecran === 'victoire', 'la victoire')
    envoyer(telecommande, 'host:discardParty')
    await scene(tele, sc => sc === null, 'la salle d’attente après l’essai')
  }))

test('au redémarrage, la scène repart de la salle d’attente', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    await invite(banc.url, 'Alice')
    const tele = await ecranCommun(banc.url, cookie)
    envoyer(tele, 'host:scene', { ecran: 'prix', depuis: null })
    await scene(tele, sc => sc?.ecran === 'prix', 'les prix')

    // La scène est un choix d'affichage, gardé en mémoire : la base locale
    // est jetable, et l'écran qu'on ne regrette jamais d'afficher après une
    // coupure, c'est la salle d'attente et son QR.
    await banc.redemarrer()
    const apres = await ecranCommun(banc.url, cookie)
    const snap = await instantane<any>(apres)
    assert.equal(snap.players.length, 1, 'la soirée, elle, est toujours là')
    assert.equal(snap.scene, undefined)
  }))

/** Un écran commun dont on écoute les messages avant qu'il se présente. */
function connecterEcran(url: string, cookie: string) {
  const socket = connecter(url, cookie)
  const pret = emitAck<any>(socket, 'host:hello', {}).then(res => assert.equal(res.ok, true))
  return { socket, pret }
}
