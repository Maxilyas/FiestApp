// Ce qui tient : les tricheries qu'on a essayées et que le serveur refuse,
// et les nuits qui se rattrapent. Ce fichier doit passer aujourd'hui — il
// garde ce qui marche.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/jour-regles/ce-qui-tient.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { avecBanc, base, idDe, jouer, JOUR, lire, poster, tirage } from './outils'

ProfileStore.tirageEclat = () => false

test('dix requêtes à la fois : une partie, une question servie, une réponse payée une fois', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const debuts = await Promise.all(Array.from({ length: 10 }, () => poster(banc, alice, '/api/jour/commencer')))
    assert.ok(debuts.every(d => d.status === 200))
    assert.equal(new Set(debuts.map(d => d.corps.question.echeance)).size, 1, 'une seule échéance')
    const bonne = tirage(banc)[0].bonne
    horloge.t += 500
    // Dix réponses à la fois, la bonne et d'autres : la première écrite fait foi.
    const reponses = await Promise.all(
      Array.from({ length: 10 }, (_, n) => poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: 0, choix: n % 2 === 0 ? bonne : (bonne + 1) % 2 })),
    )
    assert.ok(reponses.every(r => r.status === 200))
    assert.equal(new Set(reponses.map(r => r.corps.cumul)).size, 1, 'le même cumul pour toutes')
    const lignes = base(banc, db => db.prepare('SELECT COUNT(*) AS n FROM jour_reponses WHERE jour = ?').get(JOUR)) as { n: number }
    assert.equal(lignes.n, 1)
    // Dix « suivante » à la fois : une seule question servie, une seule échéance.
    const suites = await Promise.all(Array.from({ length: 10 }, () => poster(banc, alice, '/api/jour/suivante')))
    assert.equal(new Set(suites.map(s => `${s.corps.question?.index}:${s.corps.question?.echeance}`)).size, 1)
    assert.equal(suites[0].corps.question.index, 1)
  }))

test('les réponses forgées : index négatif, NaN, trop grand, pas encore servie, choix hors bornes, jour d’un autre', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const q = (await poster(banc, alice, '/api/jour/commencer')).corps.question
    for (const index of [-1, 'NaN', 1.5, 10, 99, undefined, '1e1']) {
      const r = await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index, choix: 0 })
      assert.equal(r.status, 400, `index ${index}`)
    }
    // Seule bizarrerie : `Number(null)`, `Number('')`, `Number(false)` valent 0 —
    // un index nul vise la question 0. Sans gain : c'est celle qu'il a à l'écran.
    assert.equal((await poster(banc, alice, '/api/jour/repondre', { jour: '2026-09-27', index: 0, choix: 0 })).status, 400, 'demain n’existe pas encore')
    assert.equal((await poster(banc, alice, '/api/jour/repondre', { jour: 'x', index: 0, choix: 0 })).status, 400)
    // La suivante n'est pas servie : y répondre est refusé.
    assert.equal((await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: 1, choix: 0 })).status, 400)
    // Un choix hors bornes compte comme « sans réponse » : zéro, et la question passe.
    horloge.t += 500
    const r = (await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: q.index, choix: 7 })).corps
    assert.equal(r.points, 0)
    assert.equal(r.choix, null)
    // Rejouée ensuite avec la bonne : rien ne change.
    const encore = (await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: q.index, choix: tirage(banc)[0].bonne })).corps
    assert.equal(encore.points, 0)
  }))

test('une question expirée paie zéro partout : partie, classement, expérience, médaille, sans-faute', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    let etat = (await poster(banc, alice, '/api/jour/commencer')).corps
    const qs = tirage(banc)
    while (etat.question || etat.revelation) {
      if (!etat.question) {
        etat = (await poster(banc, alice, '/api/jour/suivante')).corps
        continue
      }
      const i = etat.question.index
      if (i === 5) {
        // Le téléphone sonne : la question passe sans réponse.
        horloge.t += (qs[i].duree + 5) * 1000
        etat = (await lire(banc, alice, '/api/jour')).corps
        assert.equal(etat.revelation.index, 5)
        assert.equal(etat.revelation.points, 0)
        etat = (await poster(banc, alice, '/api/jour/suivante')).corps
        continue
      }
      await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: i, choix: qs[i].bonne })
      etat = (await poster(banc, alice, '/api/jour/suivante')).corps
      if (etat.etat === 'finie') break
    }
    assert.equal(etat.etat, 'finie')
    assert.equal(etat.points, 1800)
    assert.equal(etat.justes, 9)
    assert.equal(etat.medaille, 'argent')
    assert.equal(etat.xp, Math.floor((75 * 1800) / 2000))
    assert.equal(etat.paliers, undefined, 'pas de sans-faute')
    const ligne = (await lire(banc, alice, '/api/jour/classement')).corps.lignes[0]
    assert.equal(ligne.points, 1800)
  }))

test('l’hébergeur a dormi trois jours : la première demande clôt les trois nuits, paie chaque podium, et le laurier va à la veille', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    // Trois jours : Alice gagne les deux premiers, Bob le troisième.
    for (let j = 0; j < 3; j++) {
      horloge.t = Date.UTC(2026, 8, 26 + j, 8, 0)
      await jouer(banc, horloge, alice, i => (j < 2 ? true : i < 5))
      await jouer(banc, horloge, bob, i => (j < 2 ? i < 5 : true))
    }
    // Un redémarrage (la mémoire oublie tout), puis le 30 septembre au matin.
    await banc.redemarrer()
    horloge.t = Date.UTC(2026, 8, 30, 6, 0)
    const matin = (await lire(banc, alice, '/api/jour')).corps
    const podiums = base(banc, db => db.prepare('SELECT jour, profile_id, rang, xp FROM jour_podiums ORDER BY jour').all()) as {
      jour: string
      profile_id: string
      rang: number
      xp: number
    }[]
    const nom = (id: string) => (id === idDe(banc, 'alice') ? 'Alice' : 'Bob')
    assert.deepEqual(
      podiums.map(p => [p.jour, nom(p.profile_id), p.rang, p.xp]),
      [
        ['2026-09-26', 'Alice', 1, 25],
        ['2026-09-27', 'Alice', 1, 25],
        ['2026-09-28', 'Bob', 1, 25],
      ],
    )
    assert.deepEqual(matin.vainqueursDHier, [], 'hier (29) personne n’a joué : pas de vainqueur')
    assert.equal(matin.serie, 0, 'le 29 sans partie casse la série')
    const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    assert.ok(!moi.laurier, 'le laurier ne va qu’aux vainqueurs de la veille')
    assert.equal(moi.jour.victoires, 2)
  }))

test('le classement : cinquante lignes et la sienne à part ; le mois de 31 jours ; un mois vide', () =>
  avecBanc(async (banc, horloge) => {
    // 55 profils, dont 54 écrits en base avec leurs points du 26 et du 31 octobre… de septembre et octobre.
    const cookies: string[] = []
    for (let n = 0; n < 55; n++) cookies.push(await inscrireProfil(banc.url, `joueur${n}`, `Joueur ${n}`, '🦊'))
    base(banc, db => {
      const ids = db.prepare('SELECT id, login FROM profiles').all() as { id: string; login: string }[]
      const insert = db.prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp)
         VALUES (?, ?, ?, 10, NULL, ?, 0, 1, 0)`,
      )
      for (const { id, login } of ids) {
        const n = Number(login.replace('joueur', ''))
        insert.run(id, JOUR, n, 2000 - n * 10)
        insert.run(id, '2026-10-31', n, n)
      }
    })
    const dernier = cookies[54]
    const jour = (await lire(banc, dernier, '/api/jour/classement')).corps
    assert.equal(jour.joueurs, 55)
    assert.equal(jour.lignes.length, 50)
    assert.equal(jour.moi.nom, 'Joueur 54')
    assert.equal(jour.moi.rang, 55)
    assert.equal(jour.sienne, jour.moi.profileId)
    const octobre = (await lire(banc, dernier, '/api/jour/classement?mois=2026-10')).corps
    assert.equal(octobre.joueurs, 55, 'le 31 compte dans le mois')
    assert.equal(octobre.lignes[0].nom, 'Joueur 54')
    const vide = (await lire(banc, dernier, '/api/jour/classement?mois=2026-02')).corps
    assert.deepEqual([vide.joueurs, vide.lignes.length, vide.fige], [0, 0, true])
    void horloge
  }))

test('dix profils ouvrent le quiz du jour à la même seconde : un seul tirage, dix questions posées', () =>
  avecBanc(async banc => {
    const cookies: string[] = []
    for (let n = 0; n < 10; n++) cookies.push(await inscrireProfil(banc.url, `p${n}`, `P${n}`, '🦊'))
    const vues = await Promise.all(cookies.map(c => lire(banc, c, '/api/jour')))
    assert.ok(vues.every(v => v.status === 200 && v.corps.total === 10))
    const [tirages, posees] = base(banc, db => [
      (db.prepare('SELECT COUNT(*) AS n FROM jour_tirages').get() as { n: number }).n,
      (db.prepare('SELECT COUNT(*) AS n FROM jour_reserve WHERE posee_le = ?').get(JOUR) as { n: number }).n,
    ])
    assert.deepEqual([tirages, posees], [1, 10])
  }))
