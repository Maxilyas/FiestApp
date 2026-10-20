// Le journal des coûts des chaînes de peinture (`server/scripts/anime/gemini.ts`) :
// chaque image payée s'y compte, au tarif de son modèle, et le budget de chaque
// chaîne le relit avant de payer la suivante. Le 20 octobre 2026, la chaîne des
// compagnons, qui ne nommait pas son modèle, plantait en l'écrivant : l'image
// de la luciole-aurore payée et rangée, mais absente du journal.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coutDUneImage, coutEstime } from '../scripts/anime/gemini'

/** Les jetons d'une image de Nano Banana Pro en 1K, tels que l'API les rend (la petite luciole, le 18 octobre 2026). */
const JETONS = {
  promptTokenCount: 766,
  candidatesTokenCount: 1326,
  candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }],
  thoughtsTokenCount: 234,
}

test('une image se compte au tarif du Pro quand la chaîne ne nomme pas son modèle', () => {
  const pro = coutEstime(JETONS, { modele: 'gemini-3-pro-image' })
  assert.equal(coutEstime(JETONS), pro)
  assert.equal(coutEstime(JETONS, { lot: true }), pro / 2)
  // Ce que son journal a compté pour elle.
  assert.ok(Math.abs(pro - 0.141212) < 1e-9, `${pro}`)
})

test('Nano Banana 2 coûte moitié moins par image ; un modèle inconnu se compte au Pro', () => {
  const pro = coutEstime(JETONS, { modele: 'gemini-3-pro-image' })
  assert.ok(coutEstime(JETONS, { modele: 'gemini-3.1-flash-image' }) < pro / 1.5)
  assert.equal(coutEstime(JETONS, { modele: 'un-modele-a-venir' }), pro)
  assert.equal(coutDUneImage('gemini-3.1-flash-image'), 0.07)
  assert.equal(coutDUneImage(''), 0.14)
})
