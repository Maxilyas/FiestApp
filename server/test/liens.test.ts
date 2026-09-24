// Les liens qu'on envoie après la clôture : ceux de l'archive, qui ne
// changent jamais — `/<espace>/souvenir` change de soirée dès que la suivante
// joue. Dérivation pure : pas de serveur.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { liensDeSoiree, liensDesBilans, texteDesLiens } from '../../shared/liens'

test('les liens d’une soirée close sont ceux de son archive', () => {
  const l = liensDeSoiree('https://fiesta.example', 'chez-nadia', '2026-09-24-k7x2q')
  assert.deepEqual(l, {
    souvenir: 'https://fiesta.example/chez-nadia/soirees/2026-09-24-k7x2q/souvenir',
    bilan: 'https://fiesta.example/chez-nadia/soirees/2026-09-24-k7x2q/bilan',
    fiches: 'https://fiesta.example/chez-nadia/soirees/2026-09-24-k7x2q/bilan/fiches',
    historique: 'https://fiesta.example/chez-nadia/soirees',
  })
  for (const url of [l.souvenir, l.bilan, l.fiches]) assert.ok(!url.endsWith('/chez-nadia/souvenir'), url)
})

test('tous les liens : le bilan de chacun, ouvert sur lui, une ligne par invité', () => {
  const liens = liensDesBilans('https://f.example', 'chez-lea', 'soiree-1', [
    { id: 'p1', nom: 'Camille' },
    { id: 'p2', nom: 'Camille (2)' },
  ])
  assert.deepEqual(liens, [
    { nom: 'Camille', url: 'https://f.example/chez-lea/soirees/soiree-1/bilan#p=p1' },
    { nom: 'Camille (2)', url: 'https://f.example/chez-lea/soirees/soiree-1/bilan#p=p2' },
  ])
  assert.equal(
    texteDesLiens(liens),
    'Camille : https://f.example/chez-lea/soirees/soiree-1/bilan#p=p1\nCamille (2) : https://f.example/chez-lea/soirees/soiree-1/bilan#p=p2',
  )
})
