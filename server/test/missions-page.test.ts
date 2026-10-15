// Ce que la page sait de ses missions (`client/src/missions.ts`) : la ligne
// de l'accueil, leur feuille et la fin de chaque partie les lisent dans un
// même magasin — une lecture par page, partagée, puis celles qu'un geste
// demande. Un morceau de page qui s'y abonne après la réponse — entre son
// rendu et son effet — l'apprend quand même : sans ça, la ligne de l'accueil
// restait en chemin pour de bon, une fois sur trois au rendu, quand le code
// de l'accueil et la réponse arrivaient ensemble.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { MissionsDuJour } from '../../shared/missions'

const VUE: MissionsDuJour = {
  jour: '2026-10-15',
  missions: [],
  trois: false,
  nouvelles: [],
  semaine: { lundi: '2026-10-12', tampons: [true, true, true, false, false, false, false] },
  coffres: [],
  minutesAvantMinuit: 600,
}

test('arrivées avant qu’un morceau de page s’y abonne, ses missions lui parviennent quand même — et une lecture ratée aussi', async () => {
  const fetchAvant = globalThis.fetch
  let reponse = (): Response => new Response(JSON.stringify({ error: 'Erreur serveur — réessaie dans un instant' }), { status: 500 })
  let demandes = 0
  globalThis.fetch = (async () => {
    demandes++
    return reponse()
  }) as typeof fetch
  try {
    const { abonnerAuxMissions, relireLesMissions } = await import(new URL('../../client/src/missions.ts', import.meta.url).href)
    // La première lecture échoue avant tout abonnement : qui s'abonne ensuite l'apprend, la ligne se retire au lieu d'attendre.
    await assert.rejects(relireLesMissions())
    const vues: unknown[] = []
    const desabonner = abonnerAuxMissions((m: unknown) => vues.push(m))
    assert.deepEqual(vues, ['perdu'])

    // La suivante réussit : l'abonné l'apprend, et qui s'abonne après aussi, sans rien redemander.
    reponse = () => new Response(JSON.stringify(VUE), { status: 200, headers: { 'Content-Type': 'application/json' } })
    await relireLesMissions()
    assert.deepEqual(vues, ['perdu', VUE])
    const tard: unknown[] = []
    const desabonnerTard = abonnerAuxMissions((m: unknown) => tard.push(m))
    assert.deepEqual(tard, [VUE], 'celles déjà lues lui arrivent à l’abonnement')
    assert.equal(demandes, 2)

    // Une relecture ratée ne retire pas ce qui se montrait ; désabonné, plus rien.
    reponse = () => new Response('{}', { status: 500 })
    await assert.rejects(relireLesMissions())
    assert.deepEqual(vues, ['perdu', VUE])
    desabonner()
    desabonnerTard()
    reponse = () => new Response(JSON.stringify(VUE), { status: 200 })
    await relireLesMissions()
    assert.deepEqual(vues, ['perdu', VUE])
    assert.deepEqual(tard, [VUE])

    // Deux morceaux qui demandent ensemble ne font qu'une lecture.
    const avant = demandes
    await Promise.all([relireLesMissions(), relireLesMissions()])
    assert.equal(demandes, avant + 1)
  } finally {
    globalThis.fetch = fetchAvant
  }
})
