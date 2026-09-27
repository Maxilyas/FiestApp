// Minuit, vu d'une partie commencée la veille.
//
// 1. « Question suivante » touché après minuit, quand personne n'a encore
//    ouvert le quiz du jour : `suivante` lit le tirage d'aujourd'hui sans le
//    tirer (server/src/core/jour.ts:627) et répond `etat: 'aucun'` — que le
//    téléphone écrit « Pas de quiz aujourd'hui : la réserve de questions est
//    vide. Il revient demain. » (JourApp.tsx:292), sans bouton. La réserve
//    est pleine ; il faut recharger la page pour voir le quiz du jour.
// 2. La partie d'hier, jamais finie, reste « en cours » dans le classement
//    figé d'hier : « ses points peuvent encore monter » (shared/jour.ts:249),
//    alors que la nuit l'a close.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/jour-regles/minuit.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { avecBanc, JOUR, LENDEMAIN, lire, poster, tirage } from './outils'

ProfileStore.tirageEclat = () => false

test('« Question suivante » après minuit : le quiz du jour existe, le serveur dit qu’il n’y en a pas', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // 23 h 58 à Paris : Alice commence, répond à la première, lit l'anecdote.
    horloge.t = Date.UTC(2026, 8, 26, 21, 58)
    const q = (await poster(banc, alice, '/api/jour/commencer')).corps.question
    horloge.t += 2000
    const r = await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: q.index, choix: tirage(banc)[0].bonne })
    assert.equal(r.status, 200)

    // 0 h 00 min 30 : elle touche « Question suivante ». Personne n'a encore
    // ouvert le quiz du jour sur le serveur.
    horloge.t = Date.UTC(2026, 8, 26, 22, 0, 30)
    const suite = (await poster(banc, alice, '/api/jour/suivante')).corps
    // Ce qu'une simple visite rend au même instant :
    const visite = (await lire(banc, alice, '/api/jour')).corps
    console.log(
      `[minuit] suivante → jour ${suite.jour}, état « ${suite.etat} », ${suite.total} questions ; ` +
        `GET /api/jour juste après → état « ${visite.etat} », ${visite.total} questions`,
    )
    assert.equal(visite.etat, 'a-jouer')
    assert.equal(suite.jour, LENDEMAIN)
    assert.notEqual(suite.etat, 'aucun', 'la réserve n’est pas vide : le quiz du jour existe')
    assert.equal(suite.total, 10)
  }))

test('la partie d’hier jamais finie reste « en cours » dans le classement figé d’hier', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    horloge.t = Date.UTC(2026, 8, 26, 21, 58)
    const q = (await poster(banc, alice, '/api/jour/commencer')).corps.question
    await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: q.index, choix: tirage(banc)[0].bonne })
    await poster(banc, alice, '/api/jour/suivante')
    // Minuit : sa réponse à la deuxième est refusée, la partie ne finira jamais.
    horloge.t = Date.UTC(2026, 8, 26, 22, 0, 5)
    const tard = await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: 1, choix: 0 })
    assert.equal(tard.status, 400)
    await lire(banc, bob, '/api/jour') // la nuit se clôt
    const hier = (await lire(banc, bob, `/api/jour/classement?jour=${JOUR}`)).corps
    console.log('[minuit] classement figé d’hier :', JSON.stringify({ fige: hier.fige, lignes: hier.lignes.map((l: any) => [l.nom, l.points, l.enCours ?? false]) }))
    assert.equal(hier.fige, true)
    assert.equal(
      hier.lignes.some((l: any) => l.enCours),
      false,
      'un jour clos n’a plus de partie dont les points peuvent monter',
    )
  }))
