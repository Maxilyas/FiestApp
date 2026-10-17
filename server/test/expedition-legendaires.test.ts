// La voie de l'Expédition sur les légendaires (`shared/legendaires.ts`) :
// chacun de ceux qui ont leur joker se gagne aussi au bout de l'acte 3,
// gardé parmi les gardiens vaincus — une voie de plus (`aussi`), qui lit la
// ligne `expedition:…` rangée sur le profil, comme une saison. Pas ceux de
// saison : ils ne se gagnent qu'à leur saison, par elle seule. Une voie de
// plus ne reprend rien à personne (invariant 22).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LEGENDAIRES,
  cleDeLExpedition,
  estUneVoieDExpedition,
  legendaireDeLExpedition,
  legendairesDebloques,
  legendairesOuvertsPar,
  voiesDe,
  voiesMontrees,
} from '../../shared/legendaires'
import { EXPEDITION_EN_PRODUCTION, JOKERS_DES_LEGENDAIRES, LEGENDAIRES_A_JOKER, jokerDuLegendaire } from '../../shared/jokers'
import { avatarDeLAlbum, ouIlSeGagne } from '../../shared/album'
import { DIVINS } from '../../shared/divins'

test('chaque légendaire qui a son joker, hors des saisons, se gagne aussi au bout de l’expédition — une voie, une fois', () => {
  for (const l of LEGENDAIRES) {
    const voies = voiesDe(l).filter(estUneVoieDExpedition)
    if (LEGENDAIRES_A_JOKER.includes(l.key) && !l.saison) assert.deepEqual(voies, [{ hautFait: cleDeLExpedition(l.key), fois: 1 }], l.key)
    else assert.deepEqual(voies, [], `${l.key} : pas de joker, ou de saison`)
  }
  assert.equal(cleDeLExpedition('lg:kraken'), 'expedition:kraken')
  assert.equal(legendaireDeLExpedition('expedition:kraken')?.key, 'lg:kraken')
  assert.equal(legendaireDeLExpedition('expedition:inconnu'), undefined)
  assert.equal(legendaireDeLExpedition('saison:noel'), undefined)
})

test('vingt et un jokers de légendaires, un par légendaire, aucun pour un Divin ; chacun dit ce qu’il fait', () => {
  assert.equal(JOKERS_DES_LEGENDAIRES.length, 21)
  assert.equal(new Set(LEGENDAIRES_A_JOKER).size, 21)
  for (const j of JOKERS_DES_LEGENDAIRES) {
    assert.ok(LEGENDAIRES.some(l => l.key === j.legendaire), `${j.cle} : ${j.legendaire} existe`)
    assert.ok(j.nom && j.effet.endsWith('.'), j.cle)
    assert.equal(jokerDuLegendaire(j.legendaire), j)
  }
  for (const d of DIVINS) assert.equal(jokerDuLegendaire(d.key), undefined, `${d.key} : aucun joker (invariant 21)`)
  assert.equal(new Set(JOKERS_DES_LEGENDAIRES.map(j => j.cle)).size, 21, 'des clés uniques')
})

test('la ligne de l’expédition ouvre le légendaire, et l’annonce une fois', () => {
  const recompenses = new Map([['expedition:kraken', 1]])
  assert.ok(legendairesDebloques(recompenses).includes('lg:kraken'))
  assert.deepEqual(legendairesOuvertsPar(['expedition:kraken'], recompenses), ['lg:kraken'])
  // Déjà à lui par sa première voie : rien de neuf à annoncer.
  const deja = new Map([
    ['hf:lanterne-rouge', 3],
    ['expedition:kraken', 1],
  ])
  assert.deepEqual(legendairesOuvertsPar(['expedition:kraken'], deja), [])
  // Un légendaire sans joker ne s'ouvre pas ainsi : la voie n'existe pas.
  assert.ok(!legendairesDebloques(new Map([['expedition:licorne', 1]])).includes('lg:licorne'))
})

test('tant que l’expédition est fermée en production, sa voie compte mais ne se montre pas', () => {
  assert.equal(EXPEDITION_EN_PRODUCTION, false, 'l’étape 1 : elle s’ouvre avec ses jokers')
  for (const l of LEGENDAIRES) assert.ok(voiesMontrees(l).every(v => !estUneVoieDExpedition(v)), l.key)
  // L'album ne la dit nulle part : ni sa pastille, ni « où il se gagne ».
  for (const l of LEGENDAIRES) {
    const a = avatarDeLAlbum(l.key)!
    assert.ok(!a.lieux.includes('expedition'), l.key)
    assert.ok(!ouIlSeGagne(a).includes('expédition'), l.key)
  }
})
