// Le 31 octobre 2026, le propriétaire : « j'aimerais que les missions du jour
// soient toutes réalisables » — une mission d'étoiles (« huit bonnes réponses
// au quiz du jour ») ne se rattrapait pas après une partie ratée, et fermait
// le tampon du jour. Puis : « une compensation à tous les joueurs en offrant
// un coffre », « les tampons validés rétroactivement », « donner un coffre
// spécifique à une personne dans le QG », et un Éclat en boutique, vu avant
// d'être dépensé.
//
// Au banc : le rattrapage des jours passés et la compensation, une fois
// chacun au démarrage ; un coffre offert par l'administrateur ; l'Éclat
// acheté, puis dépensé.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { COFFRE_DE_COMPENSATION } from '../../shared/coffre'
import { PRIX_D_UN_ECLAT } from '../../shared/profil'
import { jourDe } from '../../shared/jour'
import { DRAPEAU_DE_LA_COMPENSATION, ProfileStore } from '../src/auth/profiles'
import { DRAPEAU_DES_ETOILES } from '../src/core/missions'

ProfileStore.tirageEclat = () => false

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}, methode = 'POST') =>
  ecrire(banc.url, chemin, corps, cookie, methode).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

test('les missions d’étoiles d’avant se font d’une partie finie, le tampon revient, et chacun reçoit un coffre d’or — une fois', async () => {
  // Le samedi 31 octobre 2026, à 10 h à Paris.
  const maintenant = Date.UTC(2026, 9, 31, 9)
  const banc = await demarrer({ horlogeDuJour: () => maintenant, hasardDuCoffre: () => 0 })
  try {
    const cookie = await inscrireProfil(banc.url, 'etoiles', 'Léa')
    const { profile } = (await lire(banc, cookie, '/api/joueur/moi?leger')).corps
    base(banc, db => {
      const mission = db.prepare('INSERT INTO profile_missions (profile_id, jour, rang, mission, tiree_le, faite_le) VALUES (?, ?, ?, ?, ?, ?)')
      const partie = db.prepare('INSERT INTO jour_parties (profile_id, jour, commencee_le, question, justes, finie_le) VALUES (?, ?, ?, 10, ?, ?)')
      // Le mercredi 14 : deux étoiles demandées, deux bonnes réponses seulement — les deux autres missions faites.
      mission.run(profile.id, '2026-10-14', 0, JSON.stringify({ sorte: 'jour-etoiles', cible: 2 }), 1, null)
      mission.run(profile.id, '2026-10-14', 1, JSON.stringify({ sorte: 'justes', cible: 10 }), 1, Date.UTC(2026, 9, 14, 18))
      mission.run(profile.id, '2026-10-14', 2, JSON.stringify({ sorte: 'duel', cible: 1 }), 1, Date.UTC(2026, 9, 14, 18))
      mission.run(profile.id, '2026-10-14', 3, '{}', 1, null)
      partie.run(profile.id, '2026-10-14', 1, 2, Date.UTC(2026, 9, 14, 7))
      // Le vendredi 16 : une étoile demandée, la partie jamais finie — rien à rattraper.
      mission.run(profile.id, '2026-10-16', 0, JSON.stringify({ sorte: 'jour-etoiles', cible: 1 }), 1, null)
      mission.run(profile.id, '2026-10-16', 3, '{}', 1, null)
      partie.run(profile.id, '2026-10-16', 1, 1, null)
      // Un serveur d'avant n'avait rien rattrapé, rien offert.
      db.prepare('DELETE FROM meta WHERE key IN (?, ?)').run(DRAPEAU_DES_ETOILES, DRAPEAU_DE_LA_COMPENSATION)
    })
    await banc.redemarrer()

    const lignes = () =>
      base(banc, db => db.prepare('SELECT jour, rang, faite_le FROM profile_missions WHERE profile_id = ? ORDER BY jour, rang').all(profile.id)) as {
        jour: string
        rang: number
        faite_le: number | null
      }[]
    assert.deepEqual(
      lignes().map(l => [l.jour, l.rang, l.faite_le === null ? null : jourDe(l.faite_le)]),
      [
        ['2026-10-14', 0, '2026-10-14'],
        ['2026-10-14', 1, '2026-10-14'],
        ['2026-10-14', 2, '2026-10-14'],
        ['2026-10-14', 3, '2026-10-14'],
        ['2026-10-16', 0, null],
        ['2026-10-16', 3, null],
      ],
      'la mission d’étoiles est faite, au dernier instant de son jour, et le tampon avec ; la partie pas finie ne fait rien',
    )
    // Trois missions et un tampon : l'expérience de la ligne à part, réécrite.
    assert.equal((base(banc, db => db.prepare("SELECT xp FROM profile_xp WHERE profile_id = ? AND soiree_id = '#missions'").get(profile.id)) as { xp: number }).xp, 100)

    // La compensation attend en tête, puis le coffre de la semaine du 12, que le tampon rattrapé remplit.
    const missions = (await lire(banc, cookie, '/api/joueur/missions')).corps
    assert.deepEqual(missions.coffres, [
      { semaine: COFFRE_DE_COMPENSATION.cle, tampons: 0, rang: 'or', offert: { mot: COFFRE_DE_COMPENSATION.mot } },
      { semaine: '2026-10-12', tampons: 1, rang: 'bois' },
    ])
    assert.ok(missions.missions.every((m: any) => m.sorte !== 'jour-etoiles'), 'le tirage du jour ne demande plus d’étoiles')

    const ouvert = await poster(banc, cookie, '/api/joueur/coffre', { semaine: COFFRE_DE_COMPENSATION.cle })
    assert.equal(ouvert.status, 200, ouvert.corps.error)
    assert.equal(ouvert.corps.coffre.rang, 'or')
    assert.deepEqual(ouvert.corps.coffre.offert, { mot: null })
    assert.deepEqual((await poster(banc, cookie, '/api/joueur/coffre', { semaine: COFFRE_DE_COMPENSATION.cle })).corps.coffre, ouvert.corps.coffre, 'rouvert, il redonne ce qu’il a donné')
    assert.equal((await poster(banc, cookie, '/api/joueur/coffre', { semaine: 'offert-pas-a-lui' })).status, 400, 'un coffre offert à personne ne s’ouvre pas')

    // Redémarré, rien ne se refait : ni rattrapage, ni seconde compensation.
    await banc.redemarrer()
    assert.deepEqual((await lire(banc, cookie, '/api/joueur/missions')).corps.coffres, [{ semaine: '2026-10-12', tampons: 1, rang: 'bois' }])
    assert.equal((base(banc, db => db.prepare('SELECT COUNT(*) AS n FROM profile_coffres_offerts').get()) as { n: number }).n, 1)
    // Un profil né après la compensation ne la reçoit pas : elle parle d'avant lui.
    const tard = await inscrireProfil(banc.url, 'tard', 'Tom')
    assert.deepEqual((await lire(banc, tard, '/api/joueur/missions')).corps.coffres, [])
  } finally {
    await banc.close()
  }
})

test('l’administrateur offre un coffre au rang choisi, avec un mot ; il attend sur l’accueil et s’ouvre une fois', async () => {
  const maintenant = Date.UTC(2026, 9, 31, 9)
  const banc = await demarrer({ horlogeDuJour: () => maintenant, hasardDuCoffre: () => 0 })
  try {
    const admin = await connexionAnimateur(banc.url)
    const cookie = await inscrireProfil(banc.url, 'cadeau', 'Léa')
    const { profile } = (await lire(banc, cookie, '/api/joueur/moi?leger')).corps
    assert.equal((await poster(banc, admin, `/api/admin/profils/${profile.id}/coffre`, { rang: 'diamant' })).status, 400, 'un rang des quatre')
    const offert = await poster(banc, admin, `/api/admin/profils/${profile.id}/coffre`, { rang: 'royal', mot: '  Pour   ta victoire  ' })
    assert.equal(offert.status, 200, offert.corps.error)
    const coffres = (await lire(banc, cookie, '/api/joueur/missions')).corps.coffres
    assert.deepEqual(coffres, [{ semaine: offert.corps.cle, tampons: 0, rang: 'royal', offert: { mot: 'Pour ta victoire' } }])
    const ouvert = await poster(banc, cookie, '/api/joueur/coffre', { semaine: offert.corps.cle })
    assert.equal(ouvert.status, 200, ouvert.corps.error)
    assert.equal(ouvert.corps.coffre.rang, 'royal')
    assert.notEqual(ouvert.corps.coffre.rarete, 'commune', 'le coffre royal ne donne jamais de commun')
    assert.deepEqual((await lire(banc, cookie, '/api/joueur/missions')).corps.coffres, [])
    // Un autre profil n'ouvre pas le coffre de Léa.
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom')
    assert.equal((await poster(banc, tom, '/api/joueur/coffre', { semaine: offert.corps.cle })).status, 400)
  } finally {
    await banc.close()
  }
})

test('un Éclat s’achète en boutique, attend en réserve, et se dépense sur l’avatar choisi', async () => {
  const banc = await demarrer()
  try {
    const cookie = await inscrireProfil(banc.url, 'chance', 'Léa', '🐸')
    const { profile } = (await lire(banc, cookie, '/api/joueur/moi?leger')).corps
    const pasAssez = await poster(banc, cookie, '/api/joueur/eclat')
    assert.equal(pasAssez.status, 400)
    assert.equal(pasAssez.corps.error, `Il te manque ${PRIX_D_UN_ECLAT} confettis pour un Éclat`)
    base(banc, db =>
      db.prepare('INSERT INTO profile_dons (id, profile_id, confettis, mot, created_at) VALUES (?, ?, ?, NULL, ?)').run('don-eclat', profile.id, PRIX_D_UN_ECLAT + 10, Date.now()),
    )
    const achat = await poster(banc, cookie, '/api/joueur/eclat')
    assert.equal(achat.status, 200, achat.corps.error)
    assert.equal(achat.corps.enReserve, 1)
    assert.equal(achat.corps.confettis.solde, 10)
    assert.equal(achat.corps.confettis.depenses, PRIX_D_UN_ECLAT)
    // Rangé sous `#achat:`, ni soirée ni jour ; l'achat garde son prix.
    const ligne = base(banc, db => db.prepare('SELECT soiree_id FROM profile_eclats WHERE profile_id = ?').get(profile.id)) as { soiree_id: string }
    assert.match(ligne.soiree_id, /^#achat:/)
    assert.equal((base(banc, db => db.prepare('SELECT prix FROM profile_eclats_achetes WHERE profile_id = ?').get(profile.id)) as { prix: number }).prix, PRIX_D_UN_ECLAT)
    assert.equal((await poster(banc, cookie, '/api/joueur/eclat')).status, 400, 'plus assez pour un second')

    const detail = (await lire(banc, cookie, '/api/joueur/moi')).corps.profile
    assert.equal(detail.eclatsEnReserve, 1)
    const depense = await poster(banc, cookie, '/api/joueur/moi', { eclatDeReserve: '🐸' }, 'PUT')
    assert.equal(depense.status, 200, depense.corps.error)
    const apres = (await lire(banc, cookie, '/api/joueur/moi')).corps.profile
    assert.equal(apres.eclatsEnReserve ?? 0, 0)
    assert.ok(apres.eclats.includes('🐸'))
    // La suppression du profil emporte l'achat.
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await poster(banc, admin, `/api/admin/profils/${profile.id}`, {}, 'DELETE')).status, 200)
    assert.equal((base(banc, db => db.prepare('SELECT COUNT(*) AS n FROM profile_eclats_achetes').get()) as { n: number }).n, 0)
  } finally {
    await banc.close()
  }
})
