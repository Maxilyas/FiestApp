// La veille des modes de jeu (`core/veille.ts`, le souhait du propriétaire du
// 19 octobre 2026 : « une notification sur mon téléphone quand une erreur
// tombe — importante, c'est-à-dire l'indisponibilité d'un mode de jeu ») :
// une source qui échoue trois fois en dix minutes, et plus souvent qu'elle ne
// réussit, fait tomber son mode ; il se rétablit quand chaque source tombée
// a réussi de nouveau, sans un échec pendant un quart d'heure. L'horloge à la
// main ; la notification elle-même, au banc (`qg-erreurs.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { patienter } from './banc'
import { Veille, veille as veilleDuProcessus, type EvenementDeLaVeille } from '../src/core/veille'
import { messagePourEcran } from '../src/core/http'
import { lesModes, messageDePanne, messageDeRetour, modeDeLaSource, serviceDuTelephone, type PanneDUnMode } from '../../shared/pannes'

const MIN = 60_000
const sansInsecables = (s: string) => s.replace(/[  ]/g, ' ')

/** Une veille à l'heure qu'on lui donne, qui parle sans attendre d'autres pannes, et ce qu'elle a dit. */
function uneVeille() {
  const horloge = { t: Date.UTC(2026, 9, 19, 19, 4) }
  const v = new Veille({ maintenant: () => horloge.t, groupementMs: 0 })
  const dits: EvenementDeLaVeille[] = []
  const ecouteur = (e: EvenementDeLaVeille) => dits.push(e)
  v.demarrer(ecouteur)
  return {
    v,
    dits,
    horloge,
    avancer: (ms: number) => (horloge.t += ms),
    /** Ce qu'elle dit se dit au tour suivant : le temps de laisser tomber les autres. */
    laisserDire: () => patienter(5),
    fin: () => v.arreter(ecouteur),
  }
}

test('le mode d’une source : la route sous son modèle, ou le temps réel — et ce qui n’est pas un mode de jeu ne compte pas', () => {
  for (const [source, mode] of [
    ['GET /api/jour', 'jour'],
    ['POST /api/jour/repondre', 'jour'],
    ['GET /api/campagne/defi', 'defi'],
    ['POST /api/campagne/duel/:code/envoi', 'duels'],
    ['POST /api/campagne/rencontre', 'duels'],
    ['GET /api/campagne/amis', 'duels'],
    // Les réponses d'une série passent par une seule porte, qu'elle soit de la campagne, du défi ou d'un duel.
    ['POST /api/campagne/serie/:id/reponse', 'campagne'],
    ['POST /api/campagne/sentiers/epreuve', 'campagne'],
    ['POST /api/expedition/:id/reponse', 'expedition'],
    // Le Cabinet de curiosités, sous son nom : sa page, son départ, ses gestes.
    ['GET /api/cabinet', 'cabinet'],
    ['POST /api/cabinet/partie', 'cabinet'],
    ['POST /api/cabinet/partie/:id/geste', 'cabinet'],
    ['POST /api/joueur/compagnons/:cle', 'boutique'],
    ['POST /api/joueur/themes', 'boutique'],
    ['GET /api/joueur/moi', 'accueil'],
    ['POST /api/joueur/connexion', 'accueil'],
    ['GET /api/joueur/missions', 'accueil'],
    ['POST /api/joueur/salon', 'soirees'],
    ['socket host:launch', 'soirees'],
    ['socket player:action', 'soirees'],
  ] as const) {
    assert.equal(modeDeLaSource(source), mode, source)
  }
  // Le rappel du soir, la routine du matin, la base de la campagne qu'on dépose, le QG, un compte d'animateur : pas un mode.
  for (const source of ['POST /api/jour/rappel', 'POST /api/jour/reserve', 'POST /api/campagne/base', 'GET /api/admin/qg', 'POST /api/auth/login', 'GET /api/quizzes', 'requête illisible']) {
    assert.equal(modeDeLaSource(source), null, source)
  }
})

test('une route qui échoue trois fois, plus souvent qu’elle ne réussit, fait tomber son mode — une seule fois, les modes tombés ensemble dans la même', async () => {
  const { v, dits, laisserDire, fin } = uneVeille()
  try {
    v.noter('GET /api/jour', false)
    v.noter('GET /api/jour', false)
    assert.deepEqual(v.pannes(), [], 'deux échecs ne font pas une panne')
    v.noter('GET /api/jour', false)
    // Une base muette fait tomber tout ce qui la lit : les duels aussi, dans le même souffle.
    for (let i = 0; i < 4; i++) v.noter('GET /api/campagne/duels', false)
    await laisserDire()
    assert.equal(dits.length, 1, 'une seule notification pour les deux')
    const [dit] = dits
    assert.equal(dit.sorte, 'panne')
    assert.deepEqual(
      dit.sorte === 'panne' && dit.pannes.map(p => [p.mode, p.echecs, p.source]),
      [
        ['jour', 3, 'GET /api/jour'],
        ['duels', 4, 'GET /api/campagne/duels'],
      ],
    )
    // Elle dure : chaque échec se compte, rien ne se redit.
    v.noter('GET /api/jour', false)
    await laisserDire()
    assert.equal(dits.length, 1)
    assert.deepEqual(
      v.pannes().map(p => [p.mode, p.echecs]),
      [
        ['jour', 4],
        ['duels', 4],
      ],
    )
  } finally {
    fin()
  }
})

test('une route qui marche pour les autres, ou des échecs trop espacés, ne font pas une panne', async () => {
  const { v, dits, avancer, laisserDire, fin } = uneVeille()
  try {
    // Trois échecs, mais quatre réussites : un joueur malchanceux, pas un mode tombé.
    for (let i = 0; i < 4; i++) v.noter('POST /api/jour/repondre', true)
    for (let i = 0; i < 3; i++) v.noter('POST /api/jour/repondre', false)
    // Trois échecs en vingt minutes : la fenêtre n'en voit jamais plus de deux.
    v.noter('POST /api/expedition/:id/geste', false)
    v.noter('POST /api/expedition/:id/geste', false)
    avancer(11 * MIN)
    v.noter('POST /api/expedition/:id/geste', false)
    await laisserDire()
    assert.deepEqual([v.pannes(), dits], [[], []])
    // Ce qui n'est pas un mode ne compte pas, même en panne.
    for (let i = 0; i < 5; i++) v.noter('GET /api/admin/qg', false)
    await laisserDire()
    assert.deepEqual(v.pannes(), [])
  } finally {
    fin()
  }
})

test('un mode se rétablit quand chaque route tombée a réussi de nouveau, sans un échec pendant un quart d’heure', async () => {
  const { v, dits, avancer, laisserDire, fin } = uneVeille()
  try {
    // Les réponses du quiz du jour échouent ; la page, elle, s'ouvre.
    for (let i = 0; i < 3; i++) v.noter('POST /api/jour/repondre', false)
    v.noter('GET /api/jour', true)
    await laisserDire()
    assert.deepEqual(
      v.pannes().map(p => p.mode),
      ['jour'],
    )
    // Un quart d'heure plus tard, la page s'ouvre toujours : ce n'est pas elle qui était tombée.
    avancer(16 * MIN)
    v.noter('GET /api/jour', true)
    v.examiner()
    assert.deepEqual(
      v.pannes().map(p => p.mode),
      ['jour'],
      'la page qui s’ouvre ne dit rien des réponses',
    )
    // Une réponse passe, puis une autre échoue : le quart d'heure repart.
    v.noter('POST /api/jour/repondre', true)
    v.noter('POST /api/jour/repondre', false)
    avancer(10 * MIN)
    v.noter('POST /api/jour/repondre', true)
    v.examiner()
    assert.equal(v.pannes().length, 1, 'dix minutes après un échec, pas encore')
    avancer(6 * MIN)
    v.examiner()
    await laisserDire()
    assert.deepEqual(v.pannes(), [])
    assert.deepEqual(
      dits.map(d => d.sorte),
      ['panne', 'retour'],
    )
    assert.deepEqual(dits[1].sorte === 'retour' && dits[1].modes, ['jour'])
  } finally {
    fin()
  }
})

test('une panne d’avant un redémarrage s’hérite, déjà dite : sa source réussie et un quart d’heure plus tard, elle se dit rétablie', async () => {
  const { v, dits, horloge, avancer, laisserDire, fin } = uneVeille()
  try {
    const heritee: PanneDUnMode = { mode: 'duels', depuis: horloge.t - 40 * MIN, echecs: 7, dernierEchec: horloge.t - 30 * MIN, source: 'GET /api/campagne/duels' }
    v.heriter([heritee])
    await laisserDire()
    // Elle se montre au QG, sans sonner une seconde fois.
    assert.deepEqual(v.pannes(), [{ ...heritee, dernierEchec: horloge.t }])
    assert.deepEqual(dits, [])
    // Rien n'y passe pendant un quart d'heure : sans une réussite de sa source, rien ne dit qu'elle répond.
    avancer(16 * MIN)
    v.examiner()
    assert.equal(v.pannes().length, 1)
    v.noter('GET /api/campagne/duels', true)
    v.examiner()
    assert.deepEqual(dits, [{ sorte: 'retour', modes: ['duels'] }])
    assert.deepEqual(v.pannes(), [])
  } finally {
    fin()
  }
})

test('qui l’écoute ne la fait pas tomber, et seul le serveur qui l’écoute l’arrête', async () => {
  const horloge = { t: Date.UTC(2026, 9, 19, 19, 4) }
  const v = new Veille({ maintenant: () => horloge.t, groupementMs: 0 })
  const casse = () => {
    throw new Error('un téléphone qui ne répond pas')
  }
  v.demarrer(casse)
  const erreur = console.error
  const dit: unknown[] = []
  console.error = (...args: unknown[]) => dit.push(args)
  try {
    for (let i = 0; i < 3; i++) v.noter('GET /api/jour', false)
    await patienter(5)
    assert.deepEqual(
      v.pannes().map(p => p.mode),
      ['jour'],
    )
    assert.equal(dit.length, 1, 'l’échec de l’écouteur se dit au journal du serveur')
    // Un serveur d'avant, qui s'arrête après qu'un autre l'a prise, ne la fait pas taire.
    v.arreter(() => {})
    for (let i = 0; i < 3; i++) v.noter('GET /api/expedition', false)
    await patienter(5)
    assert.equal(dit.length, 2, 'celui qui l’écoute l’entend toujours')
    v.arreter(casse)
    // Un serveur neuf repart de zéro.
    v.remettreAZero()
    assert.deepEqual(v.pannes(), [])
  } finally {
    console.error = erreur
    v.arreter(casse)
  }
})

test('un message du temps réel compte comme une route : l’échec qu’un écran commun lit en toast compte aux soirées', () => {
  veilleDuProcessus.remettreAZero()
  const erreur = console.error
  console.error = () => {}
  try {
    // Une erreur faite pour être lue est un refus, pas une panne.
    for (let i = 0; i < 3; i++) messagePourEcran(new Error('Quiz introuvable'), 'host:launch')
    assert.deepEqual(veilleDuProcessus.pannes(), [])
    for (let i = 0; i < 3; i++) messagePourEcran(new TypeError('Cannot read properties of undefined'), 'host:launch')
    assert.deepEqual(
      veilleDuProcessus.pannes().map(p => [p.mode, p.source]),
      [['soirees', 'socket host:launch']],
    )
  } finally {
    console.error = erreur
    veilleDuProcessus.remettreAZero()
  }
})

test('ce que dit la notification : les modes, ce qui échoue, la page des erreurs — jamais un prénom ni un message d’erreur', () => {
  const t = Date.UTC(2026, 9, 19, 19, 4)
  const panne = messageDePanne([
    { mode: 'jour', depuis: t, echecs: 3, dernierEchec: t, source: 'GET /api/jour' },
    { mode: 'duels', depuis: t, echecs: 6, dernierEchec: t, source: 'GET /api/campagne/duels' },
  ])
  assert.deepEqual(
    { ...panne, titre: sansInsecables(panne.titre), corps: sansInsecables(panne.corps) },
    {
      titre: 'Panne : le quiz du jour et les duels',
      corps: '9 échecs en dix minutes (GET /api/campagne/duels). Touche pour voir les erreurs.',
      url: '/admin#erreurs',
      tag: 'qg-panne',
    },
  )
  // Le retour remplace la panne sur l'écran verrouillé : la même étiquette.
  const retour = messageDeRetour(['jour'])
  assert.deepEqual([sansInsecables(retour.titre), retour.tag, retour.url], ['Rétabli : le quiz du jour', 'qg-panne', '/admin#erreurs'])
  assert.equal(lesModes(['jour', 'campagne', 'soirees']), 'le quiz du jour, la campagne et les soirées')
  assert.deepEqual(
    ['fcm.googleapis.com', 'web.push.apple.com', 'updates.push.services.mozilla.com', 'wns2-par02p.notify.windows.com', '127.0.0.1'].map(serviceDuTelephone),
    ['Chrome ou Android', 'iPhone ou Mac', 'Firefox', 'Edge', 'un navigateur'],
  )
})
