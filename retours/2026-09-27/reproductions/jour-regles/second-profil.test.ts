// La triche au second profil : un joueur ouvre un deuxième profil (dix
// secondes, rien à prouver), le fait jouer d'abord — chaque révélation lui
// donne la bonne réponse, en index, et les questions comme les réponses
// sont dans le même ordre pour tous —, puis joue son vrai profil avec ces
// index, sans réfléchir. Il fait le maximum, prend le podium, le palier du
// Champion du jour et le laurier qui le suit jusque dans les soirées.
//
// Ce test décrit ce que la mission demande : « personne ne gagne en
// trichant ». Il échoue aujourd'hui ; il passera le jour où les index lus
// par un profil ne se transposent plus tels quels à un autre (réponses
// mélangées par profil), ou le jour où une partie jouée ainsi ne monte plus
// sur le podium.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/jour-regles/second-profil.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { avecBanc, base, idDe, jouer, JOUR, lire, poster } from './outils'

ProfileStore.tirageEclat = () => false

test('un second profil souffle les réponses au premier : sans-faute, podium, Champion du jour et laurier', () =>
  avecBanc(async (banc, horloge) => {
    // Alice joue honnêtement et très bien : neuf sur dix, sans traîner.
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alicePartie = await jouer(banc, horloge, alice, i => i !== 4)
    assert.equal(alicePartie.etat.points, 1800)

    // Mallory ouvre un second profil et le fait jouer d'abord, au hasard :
    // chaque révélation lui donne l'index de la bonne réponse.
    const mallory = await inscrireProfil(banc.url, 'mallory', 'Mallory', '🐺')
    const bis = await inscrireProfil(banc.url, 'mallory-bis', 'M', '🐸')
    const soufflees: number[] = []
    let etat = (await poster(banc, bis, '/api/jour/commencer')).corps
    const debutBis = Date.now()
    while (etat.question) {
      const r = await poster(banc, bis, '/api/jour/repondre', { jour: JOUR, index: etat.question.index, choix: 0 })
      soufflees[etat.question.index] = r.corps.bonne
      etat = (await poster(banc, bis, '/api/jour/suivante')).corps
    }
    const dureeBis = Date.now() - debutBis
    assert.equal(soufflees.length, 10, 'dix bonnes réponses lues en dix gestes')
    // Et la correction entière s'ouvre au second profil dès qu'il a fini.
    const correction = await lire(banc, bis, `/api/jour/correction/${JOUR}`)
    assert.equal(correction.status, 200)
    assert.deepEqual(
      correction.corps.questions.map((q: any) => q.bonne),
      soufflees,
    )

    // Mallory joue son vrai profil avec les index soufflés, sans lire.
    let partie = (await poster(banc, mallory, '/api/jour/commencer')).corps
    while (partie.question) {
      const i = partie.question.index
      const r = await poster(banc, mallory, '/api/jour/repondre', { jour: JOUR, index: i, choix: soufflees[i] })
      assert.equal(r.status, 200)
      partie = (await poster(banc, mallory, '/api/jour/suivante')).corps
    }
    console.log(
      `[second profil] le second profil a lu les dix réponses en ${dureeBis} ms ; ` +
        `Mallory : ${partie.points} pts, ${partie.justes}/10, médaille ${partie.medaille} ; Alice : ${alicePartie.etat.points} pts`,
    )

    // Le lendemain, la nuit paie le podium.
    horloge.t = Date.UTC(2026, 8, 27, 6, 0)
    const matin = (await lire(banc, alice, '/api/jour')).corps
    const podium = base(banc, db => db.prepare('SELECT profile_id, rang, xp FROM jour_podiums WHERE jour = ? ORDER BY rang').all(JOUR)) as {
      profile_id: string
      rang: number
      xp: number
    }[]
    const rangDe = (login: string) => podium.find(p => p.profile_id === idDe(banc, login))?.rang ?? 0
    const paliersDe = (login: string) =>
      base(banc, db =>
        (db.prepare(`SELECT badge FROM profile_badges WHERE profile_id = ? AND badge GLOB 'hf:*:[123]'`).all(idDe(banc, login)) as { badge: string }[]).map(
          b => b.badge,
        ),
      )
    const laurierDeMallory = (await lire(banc, mallory, '/api/joueur/moi')).corps.profile.laurier === true
    console.log(
      `[second profil] podium : ${JSON.stringify(podium.map(p => [p.profile_id === idDe(banc, 'mallory') ? 'Mallory' : p.profile_id === idDe(banc, 'alice') ? 'Alice' : 'M', p.rang, p.xp]))}` +
        ` ; vainqueurs d’hier vus par Alice : ${JSON.stringify(matin.vainqueursDHier)} ; paliers de Mallory : ${paliersDe('mallory').join(', ')} ; laurier : ${laurierDeMallory}`,
    )

    // Ce que la mission demande : personne ne gagne en trichant. Aujourd'hui,
    // Mallory fait dix sur dix, prend la première marche seule, le Sans-Faute
    // et le Champion du jour, et porte le laurier.
    assert.notEqual(partie.justes, 10, 'les index lus par un autre profil ne devraient pas faire un sans-faute')
    assert.notEqual(rangDe('mallory'), 1, 'une partie soufflée ne devrait pas prendre la première marche')
    assert.equal(rangDe('alice'), 1, 'la meilleure partie honnête devrait gagner')
  }))

test('un joueur seul et son second profil font une salle : podium, Champion du jour et laurier sans adversaire', () =>
  avecBanc(async (banc, horloge) => {
    // Un petit serveur où Zoé est seule à jouer le quiz du jour. Seule, elle
    // ne monte sur rien (invariant 19, « rien seul »).
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🦊')
    const bis = await inscrireProfil(banc.url, 'zoe-bis', 'Z', '🐸')
    await jouer(banc, horloge, zoe, i => i < 3)
    // Son second profil ouvre la partie, et s'en va : zéro point.
    await poster(banc, bis, '/api/jour/commencer')
    horloge.t = Date.UTC(2026, 8, 27, 6, 0)
    const matin = (await lire(banc, zoe, '/api/jour')).corps
    const moi = (await lire(banc, zoe, '/api/joueur/moi')).corps.profile
    console.log(`[salle de deux] « Hier » de Zoé : ${JSON.stringify(matin.sonHier)} ; laurier : ${moi.laurier === true}`)
    assert.equal(matin.sonHier.xpPodium, 0, 'une salle faite de soi-même ne paie pas de podium')
  }))
