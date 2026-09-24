// Le système de design, gardé par des tests : ce qui ne se voit qu'à l'écran,
// mais qui se lit dans le code — une marque d'homonymie qu'on ne coupe pas,
// une règle d'emojis qu'on n'enfreint pas par mégarde.
//
// Les constats viennent de la tablée du 24 septembre 2026
// (`retours/2026-09-24/verification/design.md`) : chacun a été rejoué à
// l'écran avant d'être corrigé ; ici, on garde la cause.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { partsDuNom } from '../../shared/homonymes'

const CSS = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')

/** Le corps de la première règle dont le sélecteur est exactement celui-ci. */
function regle(selecteur: string): string {
  const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`(?:^|\\})\\s*${echappe}\\s*\\{([^}]*)\\}`, 'm').exec(CSS)
  assert.ok(m, `la règle ${selecteur} existe`)
  return m[1]
}

// ── E6 · La marque d'homonymie ne se coupe jamais ─────────────────────────

test('le prénom d’une pastille se coupe, sa marque « (2) » jamais', () => {
  // Sur la console, « Camille (2) » devenait « Camil… » : les points de
  // suspension mangeaient la marque, la seule chose qui distingue deux
  // invités identiques (invariant 17).
  assert.deepEqual(partsDuNom({ name: 'Camille', nomAffiche: 'Camille (2)' }), { prenom: 'Camille', marque: ' (2)' })
  assert.deepEqual(partsDuNom({ name: 'Camille' }), { prenom: 'Camille', marque: '' })
  assert.deepEqual(partsDuNom({ name: 'Camille', nomAffiche: 'Camille' }), { prenom: 'Camille', marque: '' })

  // Le prénom porte les points de suspension ; la marque ne rétrécit pas.
  assert.match(regle('.chip-prenom'), /text-overflow:\s*ellipsis/)
  assert.match(regle('.chip-marque'), /flex:\s*none/)
  assert.doesNotMatch(regle('.chip-marque'), /overflow/)
  // Et c'est bien la vue qui les sépare.
  const hote = readFileSync(new URL('../../client/src/views/HostApp.tsx', import.meta.url), 'utf8')
  assert.match(hote, /className="chip-marque"/)
})
