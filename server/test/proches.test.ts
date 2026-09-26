// « Les plus proches », sur la page d'un profil : les légendaires et les
// paliers de carrière qu'il a commencés, rangés par ce qui manque — une
// dérivation pure du catalogue qu'il reçoit déjà.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAUTS_FAITS_DE_CARRIERE, HAUTS_FAITS_DE_SOIREE, type HautFaitVu } from '../../shared/hautsfaits'
import { lesPlusProches } from '../../shared/proches'

/** Le catalogue tel qu'un profil le voit : ses hauts faits de soirée, et ses valeurs de carrière — les paliers atteints s'en déduisent. */
function vu(soiree: Record<string, number>, carriere: Record<string, number>): HautFaitVu[] {
  return [
    ...HAUTS_FAITS_DE_SOIREE.map(h => ({
      key: h.key,
      famille: 'soiree' as const,
      emoji: h.emoji,
      title: h.title,
      rule: h.rule,
      ton: h.ton,
      fois: soiree[h.key] ?? 0,
    })),
    ...HAUTS_FAITS_DE_CARRIERE.map(h => {
      const valeur = carriere[h.key] ?? 0
      const palier = h.paliers.filter(seuil => valeur >= seuil).length
      return {
        key: h.key,
        famille: 'carriere' as const,
        emoji: h.emoji,
        title: h.title,
        rule: h.mesure,
        ton: 'eclat' as const,
        fois: palier,
        valeur,
        prochain: palier < 3 ? h.paliers[palier] : null,
      }
    }),
  ]
}

test('les plus proches : les légendaires et les paliers commencés, rangés par ce qui manque', () => {
  const hf = vu({ 'hf:foudre': 7, 'hf:oracle': 2 }, { 'hf:habitue': 8, 'hf:bavard': 60, 'hf:legende': 9 })
  assert.deepEqual(lesPlusProches(hf, []), [
    // L'Habitué · Argent (dix soirées) : c'est le Renard qui le dit, pas le palier une seconde fois.
    { key: 'lg:renard', acquis: 8, requis: 10 },
    { key: 'lg:tigre', acquis: 7, requis: 10 },
    { key: 'hf:bavard:1', acquis: 60, requis: 100 },
  ])
  // Le Renard gagné, son palier redevient un objectif comme un autre ; La Légende, elle, suit le niveau.
  assert.deepEqual(
    lesPlusProches(hf, ['lg:renard']).map(p => p.key),
    ['hf:habitue:2', 'lg:tigre', 'hf:bavard:1'],
  )
  assert.equal(lesPlusProches(hf, [], 5).length, 4, 'l’Oracle, à deux sur huit, vient ensuite')
})

test('rien de commencé, rien de proche ; à égalité, le légendaire d’abord', () => {
  assert.deepEqual(lesPlusProches(vu({}, {}), []), [])
  const egaux = vu({ 'hf:foudre': 5 }, { 'hf:bavard': 50 })
  assert.deepEqual(
    lesPlusProches(egaux, []).map(p => p.key),
    ['lg:tigre', 'hf:bavard:1'],
  )
})
