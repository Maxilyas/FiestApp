// Un prix remis une fois, même cliqué deux fois.
//
// Rien ne rendait « Attribuer » inerte avant le retour de l'instantané (120 ms
// au moins), et le serveur n'écartait pas le doublon : un double clic
// remettait le prix deux fois — deux points d'équipe au lieu d'un, de quoi
// retourner la victoire. La console tire maintenant un identifiant de remise
// au clic (`client/src/remise.ts`), que le serveur ne reconnaît qu'une fois ;
// « Redonner » en tire un neuf.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attendre, connexionAnimateur, demarrer, ecranCommun, emitAck, instantane, patienter, type Socket } from './banc'
import { DOUBLE_CLIC_MS, remiseDuClic, type RemiseEnRoute } from '../../client/src/remise'

async function prixRemis(host: Socket) {
  // L'heure du serveur sert de barrière : les gestes d'avant sont passés.
  await emitAck(host, 'time:sync', {})
  await patienter(300)
  return (await instantane<any>(host)).bonuses as { id: string; reason: string; points: number }[]
}

test('le même geste arrivé deux fois ne remet le prix qu’une fois — un retrait ne le fait pas revenir', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const host = await ecranCommun(banc.url, cookie)
    ;(host as any).emit('host:seedTeams', { count: 2 })
    const equipes = (await instantane<any>(host, s => s.teams.length === 2, 'les équipes')).teams
    const eclair = { teamId: equipes[0].id, points: 1, reason: 'L’Éclair' }

    // Le double clic : deux fois la même remise.
    ;(host as any).emit('host:awardTeam', { ...eclair, remise: 'r-1' })
    ;(host as any).emit('host:awardTeam', { ...eclair, remise: 'r-1' })
    let remis = await prixRemis(host)
    assert.deepEqual(remis.map(b => b.reason), ['L’Éclair'], 'un seul prix pour un double clic')

    // Retiré, puis un doublon en retard : il ne revient pas.
    ;(host as any).emit('host:removeBonus', { bonusId: remis[0].id })
    ;(host as any).emit('host:awardTeam', { ...eclair, remise: 'r-1' })
    remis = await prixRemis(host)
    assert.deepEqual(remis, [], 'le doublon en retard ne remet pas le prix retiré')

    // « Redonner » tire une remise neuve : le prix est remis de nouveau.
    ;(host as any).emit('host:awardTeam', { ...eclair, remise: 'r-2' })
    remis = await prixRemis(host)
    assert.equal(remis.length, 1)

    // Une page d'avant n'envoie pas de remise : chaque clic remet, comme avant.
    ;(host as any).emit('host:awardTeam', eclair)
    ;(host as any).emit('host:awardTeam', eclair)
    remis = await prixRemis(host)
    assert.equal(remis.length, 3)

    // Et la remise ne fuit pas d'une soirée à l'autre : l'identifiant d'un
    // essai effacé redevient neuf.
    const efface = attendre<any>(host, 'toast', () => true, 'l’essai effacé')
    ;(host as any).emit('host:discardParty')
    assert.equal((await efface).kind, 'info')
    ;(host as any).emit('host:seedTeams', { count: 2 })
    const neuves = (await instantane<any>(host, s => s.teams.length === 2 && s.bonuses.length === 0, 'la soirée suivante')).teams
    ;(host as any).emit('host:awardTeam', { teamId: neuves[0].id, points: 1, reason: 'L’Éclair', remise: 'r-1' })
    assert.equal((await prixRemis(host)).length, 1)
  } finally {
    await banc.close()
  }
})

test('la console reprend l’identifiant d’un double clic, et en tire un neuf pour « Redonner »', () => {
  let n = 0
  const tirer = () => `remise-${++n}`
  const clic = (avant: RemiseEnRoute | undefined, quoi: string, vus: string, maintenant: number) =>
    remiseDuClic(avant, { quoi, vus, maintenant }, tirer)

  const premier = clic(undefined, 'rouges:1', '', 1000)
  assert.equal(premier.id, 'remise-1')
  // Le second clic du double clic, avant l'instantané : le même geste.
  assert.equal(clic(premier, 'rouges:1', '', 1150).id, 'remise-1')
  // L'instantané est arrivé entre les deux clics : c'est encore un double clic.
  assert.equal(clic(premier, 'rouges:1', 'b1', 1300).id, 'remise-1')
  // Rien n'a bougé depuis longtemps — le clic s'est perdu : on le retouche, même geste.
  assert.equal(clic(premier, 'rouges:1', '', 1000 + 10 * DOUBLE_CLIC_MS).id, 'remise-1')
  // La remise est montrée, lue, et on redonne : un geste neuf.
  assert.equal(clic(premier, 'rouges:1', 'b1', 1000 + DOUBLE_CLIC_MS + 500).id, 'remise-2')
  // D'autres points, ou une autre équipe : un autre geste, même aussitôt.
  assert.equal(clic(premier, 'rouges:2', '', 1100).id, 'remise-3')
  assert.equal(clic(premier, 'bleus:1', '', 1100).id, 'remise-4')
})
