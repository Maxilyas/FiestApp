// Le quiz du jour, ses règles pures : le jour de Paris, l'expérience, la
// médaille, la série. La réserve, la partie et la nuit qui clôt la journée se
// jouent sur un serveur jetable, dans `jour-partie.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  XP_MAX_DU_JOUR,
  jourAvant,
  jourDe,
  jourEnToutesLettres,
  jourValide,
  medailleDe,
  moisEnToutesLettres,
  serieDe,
  xpDuJour,
  xpDuPodium,
} from '../../shared/jour'

test('un jour se lit à Paris : minuit à Paris, pas à Greenwich', () => {
  // 23 h 30 à Paris, le 26 septembre (été : UTC+2) — déjà le 26 à Londres aussi.
  assert.equal(jourDe(Date.UTC(2026, 8, 26, 21, 30)), '2026-09-26')
  // 0 h 30 à Paris le 27 : 22 h 30 UTC le 26. Le serveur, en UTC, dirait encore « 26 ».
  assert.equal(jourDe(Date.UTC(2026, 8, 26, 22, 30)), '2026-09-27')
  // L'hiver (UTC+1) : minuit à Paris, 23 h UTC la veille.
  assert.equal(jourDe(Date.UTC(2026, 0, 14, 22, 59)), '2026-01-14')
  assert.equal(jourDe(Date.UTC(2026, 0, 14, 23, 0)), '2026-01-15')
  assert.equal(jourAvant('2026-03-01'), '2026-02-28')
  assert.equal(jourAvant('2028-03-01'), '2028-02-29', 'une année bissextile')
  assert.equal(jourAvant('2026-12-31', -1), '2027-01-01')
  assert.ok(jourValide('2026-09-26'))
  assert.ok(!jourValide('2026-02-30'), 'un jour qui n’existe pas')
  assert.ok(!jourValide('26/09/2026'))
  assert.equal(jourEnToutesLettres('2026-09-26'), 'samedi 26 septembre')
  assert.equal(jourEnToutesLettres('2026-10-01', true), '1er octobre')
  assert.equal(moisEnToutesLettres('2026-09'), 'septembre 2026')
})

test('l’expérience du jour : le barème d’un quiz de soirée de dix questions, à proportion des points', () => {
  // Dix fois une réponse, une bonne réponse et un réflexe, plus le sans-faute.
  assert.equal(XP_MAX_DU_JOUR, 75)
  assert.equal(xpDuJour(2000, 2000), 75)
  assert.equal(xpDuJour(1240, 2000), 46, '62 % des points, arrondis en dessous')
  assert.equal(xpDuJour(0, 2000), 0)
  assert.equal(xpDuJour(2400, 2000), 75, 'jamais plus qu’un quiz parfait')
  assert.equal(xpDuJour(100, 0), 0, 'une journée dont tout a été annulé ne rapporte rien')
  // Le podium : 25, 15, 10 — une marche de moins que la salle, comme en soirée.
  assert.deepEqual([1, 2, 3, 4].map(r => xpDuPodium(r, 23)), [25, 15, 10, 0])
  assert.deepEqual([1, 2].map(r => xpDuPodium(r, 2)), [25, 0], 'à deux, seul le premier monte')
  assert.equal(xpDuPodium(1, 1), 0, 'seul, on ne monte sur rien')
})

test('la médaille : le bronze à six bonnes réponses, l’argent à huit, l’or à dix', () => {
  assert.deepEqual([5, 6, 7, 8, 9, 10].map(j => medailleDe(j, 10)), [null, 'bronze', 'bronze', 'argent', 'argent', 'or'])
  // Une question annulée : les seuils suivent les neuf qui restent.
  assert.equal(medailleDe(9, 9), 'or')
  assert.equal(medailleDe(8, 9), 'argent')
  assert.equal(medailleDe(0, 0), null)
})

test('la série : les jours d’affilée, soirées comprises — elle court jusqu’à minuit', () => {
  const joues = new Set(['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'])
  // Pas encore joué aujourd'hui : la série d'hier tient jusqu'à minuit.
  assert.equal(serieDe(joues, '2026-09-26'), 4)
  assert.equal(serieDe(new Set([...joues, '2026-09-26']), '2026-09-26'), 5)
  // Un jour sauté la casse.
  assert.equal(serieDe(joues, '2026-09-27'), 0)
  assert.equal(serieDe(new Set(), '2026-09-26'), 0)
})
