// Régression (relecture sceptique du 26 octobre 2026, angle serveur et règles
// pures) : deux textes de shared/cabinet/ disent encore la règle d'avant le lot
// equilibre-2 (96e8fa2).
//
// 1. Le Scarabée. Depuis le 26 octobre 2026, un jour ne compte à la série qu'à
//    la première manche répondue de sa visite ou de sa chasse (`jourCompte`,
//    ecriture.ts ; `JOURS_DU_SCARABEE`, bareme.ts:128-134) ; la page produit le
//    dit (« trente jours de visite ou de chasse répondues d'affilée »,
//    docs/produit/le-cabinet.md). La condition que le serveur envoie à la page
//    et à l'album (`conditionDuGardien`, `GardienVu.condition`) est restée
//    « 30 jours de visite ou de chasse d'affilée » (shared/cabinet/salles.ts:94),
//    que la tablée lisait comme « commencer une visite chaque jour ».
// 2. Les Indices. Le commentaire du geste « nom » refusé
//    (shared/cabinet/jeux/indices.ts:251-254) promet qu'« au premier indice,
//    trois au compte valent encore ★★★ » : c'était vrai à [3, 4] ; à
//    `INDICES_DES_ETOILES` [2, 4], une erreur au premier indice coûte une étoile.
//
// Lancer : cd /home/user/FiestApp/server && nice -n 10 node --import tsx --test --test-timeout=120000 ../retours/2026-10-26/reproductions/serveur-textes-de-l-ancienne-regle.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { conditionDuGardien } from '../../../shared/cabinet/salles'
import { comptesDesIndices, etoilesDesIndices } from '../../../shared/cabinet/jeux/indices'

test('la condition du Scarabée dit qu’un jour ne compte qu’à une manche répondue', () => {
  const condition = conditionDuGardien('lg:scarabee')
  assert.ok(condition, 'le Scarabée a sa condition')
  assert.match(condition, /répond/, `« ${condition} » : une visite commencée puis quittée chaque jour ne le réveille plus`)
})

test('le commentaire des Indices ne promet pas ★★★ à trois au compte', () => {
  // Au premier indice, un nom refusé : un indice vu de plus et une erreur.
  const apresUneErreur = comptesDesIndices({ vus: 2, offerts: 0, essais: ['Zola'] } as never)
  assert.equal(apresUneErreur, 3)
  const source = readFileSync(path.join(import.meta.dirname, '../../../shared/cabinet/jeux/indices.ts'), 'utf8')
  const promet = /au premier indice, trois au compte valent encore ★★★/.test(source)
  assert.ok(!promet || etoilesDesIndices(apresUneErreur) === 3, `le commentaire promet ★★★, le barème en donne ${etoilesDesIndices(apresUneErreur)}`)
})
