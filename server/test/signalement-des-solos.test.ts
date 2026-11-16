// Le retour du propriétaire : « Sur les sentiers, tu peux que écrire et pas la
// nouvelle méthode pour signaler. » La série et le quiz du jour signalaient en
// plusieurs points d'un coup (`SignalerLaQuestion`) ; les sentiers et les
// parcours de thème en étaient restés à la modale où l'on tape une phrase.
// Une vue de jeu solo qui signale ne passe plus que par la feuille.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { QUESTION_A_LA_MARCHE, NIVEAUX } from '../../shared/campagne'

const vue = (f: string) => readFileSync(path.resolve(import.meta.dirname, '../../client/src/views', f), 'utf8')

// Celles qui ont déjà la feuille ; l'Expédition et le Cabinet n'y sont pas encore.
const VUES_A_LA_FEUILLE = ['CampagneApp.tsx', 'JourApp.tsx', 'Sentiers.tsx', 'Parcours.tsx']

for (const f of VUES_A_LA_FEUILLE) {
  test(`${f} signale par la feuille à points, pas par la phrase libre`, () => {
    const src = vue(f)
    assert.match(src, /<SignalerLaQuestion\b/, 'la feuille doit être rendue')
    assert.doesNotMatch(src, /promptDialog/, 'plus de modale où l’on tape une phrase')
  })
}

test('chaque marche a son accord, partagé par les vues qui signalent', () => {
  for (const n of NIVEAUX) assert.ok(QUESTION_A_LA_MARCHE[n])
  for (const f of ['CampagneApp.tsx', 'Sentiers.tsx', 'Parcours.tsx']) {
    assert.match(vue(f), /QUESTION_A_LA_MARCHE/, f)
  }
})
