// La voie de l'Expédition sur les légendaires (`shared/legendaires.ts`) :
// chacun de ceux qui ont leur joker se gagne aussi au bout de l'acte 3,
// gardé parmi les gardiens vaincus — une voie de plus (`aussi`), qui lit la
// ligne `expedition:…` rangée sur le profil, comme une saison. Ceux de saison
// aussi depuis le 18 octobre 2026 : ils ne gardent l'acte 3 que d'une
// expédition partie à leur saison (`expedition-saison.test.ts`). Une voie de
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

test('chaque légendaire qui a son joker se gagne aussi au bout de l’expédition — une voie, une fois ; ceux de saison compris', () => {
  for (const l of LEGENDAIRES) {
    const voies = voiesDe(l).filter(estUneVoieDExpedition)
    if (LEGENDAIRES_A_JOKER.includes(l.key)) assert.deepEqual(voies, [{ hautFait: cleDeLExpedition(l.key), fois: 1 }], l.key)
    else assert.deepEqual(voies, [], `${l.key} : pas de joker`)
  }
  // De saison, sa voie ne s'ouvre qu'à elle : il ne garde que l'acte 3 d'une expédition partie ces jours-là.
  assert.ok(legendairesDebloques(new Map([['expedition:citrouille', 1]])).includes('lg:citrouille'))
  assert.equal(cleDeLExpedition('lg:kraken'), 'expedition:kraken')
  assert.equal(legendaireDeLExpedition('expedition:kraken')?.key, 'lg:kraken')
  assert.equal(legendaireDeLExpedition('expedition:inconnu'), undefined)
  assert.equal(legendaireDeLExpedition('saison:noel'), undefined)
})

test('vingt-trois jokers de légendaires, un par légendaire, aucun pour un Divin ; chacun dit ce qu’il fait', () => {
  // Vingt et un à la V1 ; la lanterne de la Citrouille et la boule du Sapin avec l'inconnu et les écus (l'étape 4).
  assert.equal(JOKERS_DES_LEGENDAIRES.length, 23)
  assert.equal(new Set(LEGENDAIRES_A_JOKER).size, 23)
  for (const j of JOKERS_DES_LEGENDAIRES) {
    assert.ok(LEGENDAIRES.some(l => l.key === j.legendaire), `${j.cle} : ${j.legendaire} existe`)
    assert.ok(j.nom && j.effet.endsWith('.'), j.cle)
    assert.equal(jokerDuLegendaire(j.legendaire), j)
  }
  for (const d of DIVINS) assert.equal(jokerDuLegendaire(d.key), undefined, `${d.key} : aucun joker (invariant 21)`)
  assert.equal(new Set(JOKERS_DES_LEGENDAIRES.map(j => j.cle)).size, 23, 'des clés uniques')
  // De saison, les deux venus avec les écus : leur joker agit toute l'année, eux ne se gagnent qu'à leur saison.
  for (const cle of ['lg:citrouille', 'lg:sapin']) assert.ok(jokerDuLegendaire(cle) && LEGENDAIRES.find(l => l.key === cle)?.saison, cle)
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

test('ses jokers venus, l’expédition s’ouvre en production : sa voie se montre, et l’album dit où la gagner', () => {
  // L'étape 1 la gardait fermée : sans jokers, le joueur moyen n'arrivait au bout que cinq fois sur cent.
  assert.equal(EXPEDITION_EN_PRODUCTION, true, 'l’étape 2 : elle s’ouvre avec ses jokers')
  const avecLaVoie = LEGENDAIRES.filter(l => LEGENDAIRES_A_JOKER.includes(l.key))
  assert.equal(avecLaVoie.length, 23, 'vingt-trois légendaires ont la voie — le Bouquet, la Citrouille et le Sapin à leur saison')
  for (const l of LEGENDAIRES) {
    assert.equal(voiesMontrees(l).some(estUneVoieDExpedition), avecLaVoie.includes(l), l.key)
    const a = avatarDeLAlbum(l.key)!
    assert.equal(a.lieux.includes('expedition'), avecLaVoie.includes(l), l.key)
    // Un légendaire de saison se dit par sa fête — « pour Halloween » — : l'expédition est dans sa règle, en dates.
    if (!l.saison) assert.equal(ouIlSeGagne(a).includes('expédition'), avecLaVoie.includes(l), l.key)
  }
})
