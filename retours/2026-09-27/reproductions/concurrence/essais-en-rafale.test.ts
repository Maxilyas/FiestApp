// Les essais de connexion en rafale passent le verrou par identifiant.
//
// `LoginBudget` promet « cinq échecs et le compte se ferme un quart d'heure,
// d'où que viennent les essais » (`auth/http.ts`). Mais le verrou se LIT
// avant le hachage (`allow`) et ne s'ÉCRIT qu'après (`failed`), et scrypt
// prend des dizaines de millisecondes dans le pool de threads : tous les
// essais partis ensemble passent la porte avant que le premier échec ne
// soit compté. Seule la réserve par adresse (vingt d'un coup) les borne —
// vingt essais par adresse et par quart d'heure au lieu de cinq en tout.
//
// Ce que ce test attend (il échoue aujourd'hui) : de vingt essais faux
// lancés ensemble contre le même profil, cinq au plus sont vérifiés.
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/essais-en-rafale.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demarrer, ecrire, inscrireProfil } from '../../../server/test/banc'

test('en série, le sixième essai est refusé — la base de comparaison', async () => {
  const banc = await demarrer()
  try {
    await inscrireProfil(banc.url, 'cible', 'Cible', '🦊', 'le-bon-mot-de-passe')
    const statuts: number[] = []
    for (let i = 0; i < 7; i++) {
      statuts.push((await ecrire(banc.url, '/api/joueur/connexion', { login: 'cible', password: `faux-${i}-xxxx` })).status)
    }
    console.log('en série :', statuts.join(' '))
    assert.deepEqual(statuts, [401, 401, 401, 401, 401, 429, 429])
  } finally {
    await banc.close()
  }
})

test('en rafale, vingt essais faux partent ensemble : cinq au plus doivent être vérifiés', async () => {
  const banc = await demarrer()
  try {
    await inscrireProfil(banc.url, 'cible', 'Cible', '🦊', 'le-bon-mot-de-passe')
    // Dix-neuf faux et le bon, lancés dans le même tour de boucle.
    const essais = Array.from({ length: 19 }, (_, i) => `faux-${i}-xxxx`)
    essais.push('le-bon-mot-de-passe')
    const statuts = await Promise.all(
      essais.map(async password => (await ecrire(banc.url, '/api/joueur/connexion', { login: 'cible', password })).status),
    )
    const verifies = statuts.filter(s => s === 401).length
    console.log('en rafale :', statuts.join(' '))
    console.log(`essais faux vérifiés : ${verifies} ; le bon mot de passe, en vingtième : ${statuts.at(-1)}`)
    assert.ok(verifies <= 5, `${verifies} essais faux vérifiés au lieu de cinq au plus : le verrou par identifiant ne tient pas en rafale`)
  } finally {
    await banc.close()
  }
})
