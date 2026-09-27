// « Recevoir par un code » : dix essais manqués par quart d'heure et par
// espace (`server/src/partages.ts`)… en série seulement.
//
// La réserve se LIT avant la requête à la base (`manquesRecents(...).length
// >= 10`) et l'échec ne s'y ÉCRIT qu'après (`push`) : toutes les requêtes
// parties ensemble passent la porte avant que la première ne revienne.
//
// Ce que ce test attend (il échoue aujourd'hui) : de quarante codes faux
// envoyés ensemble, dix au plus sont cherchés en base — les autres reçoivent 429.
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/codes-de-partage-en-rafale.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, demarrer, ecrire, patienter } from '../../../server/test/banc'
import { PartageStore } from '../../../server/src/core/partages'

/** Un code bien formé (six caractères de l'alphabet du partage), qui ne mène à rien. */
const code = (i: number) => `ZZZ${'ABCDEFGHJKMNPQRSTUVWXYZ'[i % 23]}${'ABCDEFGHJKMNPQRSTUVWXYZ'[Math.floor(i / 23) % 23]}Z`

test('en série, le onzième code faux est refusé — la base de comparaison', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const statuts: number[] = []
    for (let i = 0; i < 12; i++) statuts.push((await ecrire(banc.url, '/api/partages/recevoir', { code: code(i) }, cookie)).status)
    console.log('en série :', statuts.join(' '))
    assert.deepEqual(statuts.slice(10), [429, 429])
  } finally {
    await banc.close()
  }
})

test('en rafale, quarante codes faux partent ensemble : dix au plus doivent être essayés', async () => {
  const banc = await demarrer()
  // En ligne, la base permanente répond en dizaines de millisecondes ; le
  // fichier local du banc, avant même la requête suivante.
  const recevoir = PartageStore.prototype.recevoir
  PartageStore.prototype.recevoir = async function (...args: Parameters<typeof recevoir>) {
    await patienter(30)
    return recevoir.apply(this, args)
  }
  try {
    const cookie = await connexionAnimateur(banc.url)
    const statuts = await Promise.all(
      Array.from({ length: 40 }, async (_, i) => (await ecrire(banc.url, '/api/partages/recevoir', { code: code(i) }, cookie)).status),
    )
    const essayes = statuts.filter(s => s === 404 || s === 410).length
    console.log('en rafale :', statuts.join(' '))
    console.log(`codes essayés en base : ${essayes} sur 40`)
    assert.ok(essayes <= 10, `${essayes} codes essayés au lieu de dix au plus : la réserve ne tient pas en rafale`)
  } finally {
    PartageStore.prototype.recevoir = recevoir
    await banc.close()
  }
})
