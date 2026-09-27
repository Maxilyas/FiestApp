// La Légende (niveau 10, 20, 30) est un palier de carrière : il ne se juge
// qu'à la clôture d'une soirée (`accorderPaliers`). Or le niveau compte le
// quiz du jour (ligne `#jour`, option B) : un joueur qui ne vient qu'au quiz
// du jour passe le niveau 10 sans que La Légende tombe — sa page montre la
// jauge pleine (« niveau 10 », prochain palier 10) et le palier manquant, et
// sa première soirée le lui « offrira » comme si elle l'avait fait.
//
// cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//   ../export/evaluations/recompenses-comptes/legende-du-jour.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

test('au niveau 10 par le seul quiz du jour, La Légende · Bronze tombe aussi', async () => {
  // Samedi 26 septembre 2026, 10 h à Paris.
  const banc = await demarrer({ horlogeDuJour: () => Date.UTC(2026, 8, 26, 8, 0) })
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Soixante-cinq jours de quiz du jour déjà joués, au plein de l'expérience (75).
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      const partie = db.prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 2000, 10, 1, 75)`,
      )
      for (let j = 0; j < 65; j++) partie.run(id, new Date(Date.UTC(2026, 6, 1) + j * 86_400_000).toISOString().slice(0, 10))
    } finally {
      db.close()
    }
    // Le soixante-sixième, joué pour de vrai : la fin de partie écrit sa ligne et ses paliers.
    let etat = (await poster(banc, alice, '/api/jour/commencer')).corps
    while (etat.question) {
      await poster(banc, alice, '/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: 0 })
      etat = (await poster(banc, alice, '/api/jour/suivante')).corps
    }
    assert.equal(etat.etat, 'finie')

    const profil = ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: alice } })).json()) as any).profile
    assert.ok(profil.niveau >= 10, `le quiz du jour l’a menée au niveau ${profil.niveau}`)
    const legende = profil.hautsFaits.find((h: any) => h.key === 'hf:legende')
    assert.deepEqual(
      { niveau: legende.valeur >= 10, palier: legende.fois },
      { niveau: true, palier: 1 },
      `sa page dit « niveau ${legende.valeur} » pour un palier à 10 : La Légende · Bronze devrait être tombée`,
    )
  } finally {
    await banc.close()
  }
})
