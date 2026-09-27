// CLAUDE.md, pièges : « le jeton de la réserve ne sait qu'ajouter : une route
// de plus derrière lui ne lit ni n'efface rien ». MISE-EN-LIGNE.md, étape 8 :
// « un jeton qui ne sait faire que ça — ajouter des questions. S'il fuitait,
// il ne coûterait que des questions en trop ».
//
// La consigne qu'il lit (`GET /api/jour/reserve`) recopie jusqu'à trois
// cents intitulés de la réserve, celles qui n'ont pas encore été posées
// d'abord (`JourStore.consigne`, `ORDER BY posee_le IS NOT NULL`) : les
// questions des trois semaines à venir. Un jeton qui fuit donne donc le quiz
// du jour de demain — de quoi chercher les réponses la veille, monter sur le
// podium et porter le laurier.
//
// Ce test échoue aujourd'hui ; il passera quand la consigne ne recopiera plus
// que des intitulés déjà posés (ou quand la documentation dira ce que le
// jeton lit).
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/invariants/jeton-reserve.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demarrer, ecrire, inscrireProfil, type Banc } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

const JETON = 'j'.repeat(40)
const UN_JOUR = 24 * 3600 * 1000

const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

test('la consigne lue avec le jeton de la réserve ne donne pas les questions de demain', async () => {
  const horloge = { t: Date.UTC(2026, 8, 28, 8, 0) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, jetonDeLaReserve: JETON })
  try {
    // Aujourd'hui, avec le seul jeton : la consigne.
    const res = await fetch(`${banc.url}/api/jour/reserve`, { headers: { Authorization: `Bearer ${JETON}` } })
    assert.equal(res.status, 200)
    const { consigne } = (await res.json()) as { consigne: string }

    // Demain, un joueur ouvre le quiz du jour : ses questions étaient-elles dans la consigne d'hier ?
    horloge.t += UN_JOUR
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    let etat = (await poster(banc, alice, '/api/jour/commencer')).corps
    const demain: string[] = []
    while (etat.question) {
      demain.push(etat.question.texte)
      const r = await poster(banc, alice, '/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: 0 })
      assert.equal(r.status, 200, r.corps.error)
      etat = (await poster(banc, alice, '/api/jour/suivante')).corps
    }
    assert.ok(demain.length > 0, 'témoin : le quiz de demain a des questions')
    const devoilees = demain.filter(t => consigne.includes(t.replace(/\s+/g, ' ').trim()))
    assert.deepEqual(devoilees, [], `${devoilees.length} des ${demain.length} questions de demain se lisaient la veille avec le jeton`)
  } finally {
    await banc.close()
  }
})
