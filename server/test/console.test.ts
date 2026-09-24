// La console de l'animateur : ce qui règle ses gestes, sans navigateur.
// `shared/console.ts` porte les chiffres ; la page (`HostView.tsx`) et le
// serveur (`games/quiz.ts`) les lisent tous deux.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ENCHAINEMENT_MAX_S, GARDE_APRES_PHASE_MS, PALIERS_ENCHAINEMENT, gesteAccepte } from '../../shared/console'

test('le double-clic sur « Révéler » ne tombe pas sur « Question suivante »', () => {
  // Le premier clic révèle ; la révélation arrive ~100 ms plus tard, et le
  // second clic du double-clic ~200 ms après le premier : il vise le nouvel
  // écran, et doit être ignoré.
  const revelation = 1_000
  assert.equal(gesteAccepte(revelation, revelation + 100), false)
  assert.equal(gesteAccepte(revelation, revelation + GARDE_APRES_PHASE_MS - 1), false)
  // Une demi-seconde plus tard, c'est un geste voulu.
  assert.equal(gesteAccepte(revelation, revelation + GARDE_APRES_PHASE_MS), true)
  // Sans changement connu, rien ne retient le geste.
  assert.equal(gesteAccepte(null, 0), true)
})

test('l’enchaînement commence au clic, puis va de la lecture au commentaire', () => {
  assert.equal(PALIERS_ENCHAINEMENT[0], null, 'le premier palier rend la main à l’animateur')
  const secondes = PALIERS_ENCHAINEMENT.slice(1) as number[]
  assert.ok(secondes.length > 0)
  for (const [i, s] of secondes.entries()) {
    assert.ok(Number.isInteger(s), `${s} s serait arrondi par le serveur`)
    assert.ok(s <= ENCHAINEMENT_MAX_S, `${s} s serait raccourci par le serveur`)
    if (i > 0) assert.ok(s > secondes[i - 1], 'les paliers vont en croissant')
  }
  // Le plus court laisse lire la bonne réponse, pour le quiz qu'on enchaîne
  // sans le commenter ; le plus long, le temps de faire rire la salle.
  assert.equal(secondes[0], 5, 'cinq secondes pour enchaîner sans commenter')
  assert.ok(secondes[secondes.length - 1] >= 20, 'de quoi commenter une révélation sans reprendre la main')
})
