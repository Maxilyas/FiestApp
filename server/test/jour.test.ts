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
  plusLongueSerie,
  serieAvecSabliers,
  serieDe,
  seriesParJour,
  xpDeSerie,
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

test('l’expérience du jour : vingt points par question au plus, à proportion des points', () => {
  // Le barème du solo (le 6 octobre 2026) : 200 pour un quiz parfait — 75 avant.
  assert.equal(XP_MAX_DU_JOUR, 200)
  assert.equal(xpDuJour(2000, 2000), 200)
  assert.equal(xpDuJour(1240, 2000), 124, '62 % des points, arrondis en dessous')
  assert.equal(xpDuJour(1239, 2000), 123)
  assert.equal(xpDuJour(0, 2000), 0)
  assert.equal(xpDuJour(2400, 2000), 200, 'jamais plus qu’un quiz parfait')
  assert.equal(xpDuJour(100, 0), 0, 'une journée dont tout a été annulé ne rapporte rien')
  // Le podium : 75, 45, 30 — une marche de moins que la salle, comme en soirée.
  assert.deepEqual([1, 2, 3, 4].map(r => xpDuPodium(r, 23)), [75, 45, 30, 0])
  assert.deepEqual([1, 2].map(r => xpDuPodium(r, 2)), [75, 0], 'à deux, seul le premier monte')
  assert.equal(xpDuPodium(1, 1), 0, 'seul, on ne monte sur rien')
})

test('le bonus de série : dix points par jour d’affilée, cent au plus', () => {
  assert.deepEqual([0, 1, 2, 9, 10, 11, 365].map(xpDeSerie), [0, 10, 20, 90, 100, 100, 100])
  // La série que chaque jour joué tenait, sabliers comptés : la même marche que la série du jour.
  const joues = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06', '2026-10-09'])
  assert.deepEqual(Object.fromEntries(seriesParJour(joues, [])), {
    '2026-10-01': 1,
    '2026-10-02': 2,
    '2026-10-03': 3,
    '2026-10-05': 1,
    '2026-10-06': 2,
    '2026-10-09': 1,
  })
  // Un sablier acheté le 2 couvre le 4 : la série tient, sans compter ce jour-là.
  assert.deepEqual(Object.fromEntries(seriesParJour(joues, ['2026-10-02'])), {
    '2026-10-01': 1,
    '2026-10-02': 2,
    '2026-10-03': 3,
    '2026-10-05': 4,
    '2026-10-06': 5,
    '2026-10-09': 1,
  })
  // Elle dit, chaque jour joué, ce que la série du jour disait ce jour-là.
  for (const jour of joues) assert.equal(seriesParJour(joues, ['2026-10-02']).get(jour), serieAvecSabliers(joues, ['2026-10-02'], jour).serie)
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

test('la plus longue série : des jours d’affilée, où qu’ils tombent', () => {
  assert.equal(plusLongueSerie(new Set()), 0)
  assert.equal(plusLongueSerie(new Set(['2026-09-01'])), 1)
  assert.equal(
    plusLongueSerie(new Set(['2026-03-04', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-03'])),
    3,
    'par-dessus la fin février, dans n’importe quel ordre',
  )
})
