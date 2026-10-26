// La règle du domaine (`.claude/rules/cabinet.md`), qu'un agent reçoit en ouvrant un fichier de la page,
// n'a changé dans aucun des vingt commits depuis 8e10152 : chaque lot a écrit « Pour la règle : … » dans
// son message, rien dans la règle. Elle dit encore l'ancienne pause (« ses trente secondes passées »,
// `PAUSE_MAX_MS` vaut 10 000), une visite figée par « un départ, un échange » seulement (la dépense et
// la fin d'une partie d'un jour d'avant la figent aussi, `instructionQuiFigeLaVisite`), et que « la page ne
// sait donc pas « retenter cette œuvre » d'une case manquée » — quand `Visite.tsx` et `Bilan.tsx` le
// proposent (`BoutonRetenter`, `DemandeLue`). Un agent qui s'y fie défait ce que les lots ont fait.
//
// Lancer : cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../retours/2026-10-26/reproductions/regle-cabinet-perimee.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PAUSE_MAX_MS } from '../../../shared/cabinet/bareme'

const lire = (chemin: string) => readFileSync(new URL(`../../../${chemin}`, import.meta.url), 'utf8')

test('la règle du Cabinet dit les règles de la page d’aujourd’hui', () => {
  const regle = lire('.claude/rules/cabinet.md')
  const visite = lire('client/src/views/cabinet/Visite.tsx')
  const musee = lire('shared/cabinet/musee.ts')
  assert.equal(PAUSE_MAX_MS, 10_000)
  assert.match(visite, /export function BoutonRetenter/, 'la page propose « Retenter » une case manquée')
  assert.match(musee, /une dépense, la fin d'une partie d'un jour d'avant/, 'la visite se fige aussi à la première dépense')
  const perimees = [
    /ses trente secondes passées/,
    /la page ne sait donc pas « retenter cette œuvre »/,
    /au premier lot du jour qui écrit — un départ, un échange —/,
  ].filter(r => r.test(regle))
  assert.deepEqual(perimees, [], 'phrases de la règle qui disent l’ancienne règle')
})
