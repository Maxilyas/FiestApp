// « Rien seul » (invariant 19) : une soirée jouée seul reste dans
// l'historique mais ne compte pas — ni Éclat, ni L'Habitué.
//
// Les écussons de savoir, eux, comptent les bonnes réponses de TOUTES les
// soirées de la carrière (`carriereDe` additionne `categories` sans regarder
// `soireeQuiCompte`) : un profil seul devant son propre quiz — dont il a
// écrit les réponses — se fabrique un écusson qu'il montre ensuite sur sa
// carte à toute la salle. Même chemin pour les paliers qui comptent des
// réponses (Le Bavard, L'Encyclopédie, Le Devin) : ils tombent seul, et
// rapportent de l'expérience (hors de cet audit : `recompenses-comptes`).
//
// Ce test passe le jour où une soirée jouée seul ne nourrit ni les écussons
// ni les paliers.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  estimation,
  inscrireProfil,
  invite,
  lancerQuiz,
  qcm,
  type Invite,
  type Socket,
} from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Joue le quiz, seul : chaque question reçoit l'action donnée. */
async function jouerSeul(host: Socket, quizId: string, qui: Invite, actions: Record<string, unknown>[]): Promise<void> {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < actions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: actions[q] })
    assert.equal(ack.ok, true, `réponse ${q + 1} refusée : ${ack.error}`)
    await revelee
    suivante =
      q + 1 < actions.length
        ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `la question ${q + 2}`)
        : vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  ;(host as any).emit('host:endSession', { sessionId })
}

test('seul devant son quiz : ni écusson sur sa carte, ni palier', async () => {
  const banc = await demarrer()
  try {
    const hote = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const moi = async () => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: alice } })).json()) as any).profile

    // Vingt questions de sport dont elle connaît les réponses, et trois
    // estimations qu'elle tape au chiffre près.
    const questions = [
      ...Array.from({ length: 20 }, (_, i) => ({ ...qcm(`Sport ${i + 1}`, ['Oui', 'Non'], 0), category: 'Sport' })),
      ...[1994, 1998, 2018].map(annee => estimation(`L’année ${annee} ?`, annee)),
    ]
    const quiz = await creerQuiz(banc.url, hote, questions)
    const host = await ecranCommun(banc.url, hote)
    const seule = await invite(banc.url, 'Alice', '', { cookie: alice })
    await jouerSeul(host, quiz, seule, [
      ...Array.from({ length: 20 }, () => ({ type: 'answer', choice: 0 })),
      ...[1994, 1998, 2018].map(value => ({ type: 'guess', value })),
    ])
    // La clôture : c'est elle qui décerne les paliers.
    const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    assert.equal((await toast).kind, 'info')
    seule.socket.close()

    const page = await moi()
    // Une soirée seule ne compte pas : pas de soirée à la fiche…
    assert.equal(page.fiche.soirees, 0, 'une soirée jouée seul n’en est pas une')
    const sport = page.ecussons.find((e: any) => e.categorie === 'Sport')
    const paliers = page.hautsFaits.filter((h: any) => h.famille === 'carriere' && h.fois > 0).map((h: any) => h.key)

    // …mais la soirée suivante, sa carte montre un écusson à toute la salle.
    const zoe = await invite(banc.url, 'Zoé', '🐸')
    const a2 = await invite(banc.url, 'Alice', '', { cookie: alice })
    const carte = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${a2.playerId}.json`)).json()) as any
    console.log(
      `[constat] fiche.soirees=${page.fiche.soirees} · écusson Sport : ${sport.justes} bonnes réponses, palier ${sport.palier} · ` +
        `sur la carte : ${JSON.stringify(carte.profil?.ecussons ?? [])} · paliers tombés seul : ${JSON.stringify(paliers)} · xp=${page.xp}, niveau ${page.niveau}`,
    )
    assert.equal(sport.palier, 0, 'un écusson fait seul, devant ses propres réponses')
    assert.equal(carte.profil?.ecussons, undefined, 'la carte ne montre rien de ce qui s’est fait seul')
    assert.deepEqual(paliers, [], 'aucun palier ne tombe seul')
    zoe.socket.close()
    host.close()
  } finally {
    await banc.close()
  }
})
