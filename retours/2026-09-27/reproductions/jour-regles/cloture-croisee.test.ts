// La nuit ne ferme pas la porte avant de compter. `repondre` vérifie
// l'heure (server/src/core/jour.ts:655-658), PUIS écrit (`enregistrer`) ; la
// clôture lit les parties (`clore`, :1212) sans rien qui empêche une écriture
// déjà partie d'arriver après elle. Une réponse de 23 h 59 min 59 dont
// l'écriture traîne le temps d'un aller-retour Turso passe derrière la
// clôture : le jour figé montre des points que son podium n'a jamais vus.
//
// La lenteur de Turso est jouée comme dans jour-partie.test.ts : l'écriture
// retenue le temps que la clôture passe.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/jour-regles/cloture-croisee.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { JourStore } from '../../../server/src/core/jour'
import { avecBanc, base, idDe, JOUR, lire, poster, tirage } from './outils'

ProfileStore.tirageEclat = () => false

test('une réponse de 23 h 59 écrite après la clôture : le jour figé et son podium se contredisent', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    // 23 h 50 : Bob fait neuf sur dix, dont une à l'échéance (1 700) ;
    // Alice en est à 1 600 avant sa dernière, qu'elle va trouver (1 800).
    horloge.t = Date.UTC(2026, 8, 26, 21, 50)
    const qs = () => tirage(banc)
    let etat = (await poster(banc, bob, '/api/jour/commencer')).corps
    while (etat.question) {
      const i = etat.question.index
      const q = qs()[i]
      if (i === 8) horloge.t += q.duree * 1000
      await poster(banc, bob, '/api/jour/repondre', { jour: JOUR, index: i, choix: i === 9 ? (q.bonne + 1) % q.reponses.length : q.bonne })
      etat = (await poster(banc, bob, '/api/jour/suivante')).corps
    }
    assert.equal(etat.points, 1700)
    etat = (await poster(banc, alice, '/api/jour/commencer')).corps
    while (etat.question.index < 9) {
      const i = etat.question.index
      const q = qs()[i]
      await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: i, choix: i < 8 ? q.bonne : (q.bonne + 1) % q.reponses.length })
      // La dernière paraît à 23 h 59 min 58.
      if (i === 8) horloge.t = Date.UTC(2026, 8, 26, 21, 59, 58)
      etat = (await poster(banc, alice, '/api/jour/suivante')).corps
    }
    assert.equal(etat.points, 1600)
    assert.equal(etat.question.echeance, Date.UTC(2026, 8, 26, 21, 59, 58) + etat.question.duree * 1000)

    // 23 h 59 min 59 : sa réponse juste à la dernière part ; l'écriture traîne.
    horloge.t = Date.UTC(2026, 8, 26, 21, 59, 59)
    const proto = JourStore.prototype as any
    const enregistrer = proto.enregistrer
    let entrer!: () => void
    const entree = new Promise<void>(r => (entrer = r))
    let relacher!: () => void
    const porte = new Promise<void>(r => (relacher = r))
    proto.enregistrer = async function (this: JourStore, partie: { question: number; profileId: string }, ...reste: unknown[]) {
      if (partie.question === 9 && partie.profileId === idDe(banc, 'alice')) {
        entrer()
        await porte
      }
      return enregistrer.call(this, partie, ...reste)
    }
    try {
      const reponse = poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: 9, choix: qs()[9].bonne })
      await entree
      // Minuit passe ; Bob ouvre le quiz du jour : la veille se clôt.
      horloge.t = Date.UTC(2026, 8, 26, 22, 0, 1)
      await lire(banc, bob, '/api/jour')
      relacher()
      const r = await reponse
      console.log(`[clôture] la réponse d’Alice : ${r.status}, cumul ${r.corps.cumul ?? r.corps.error}`)
    } finally {
      proto.enregistrer = enregistrer
    }

    const podium = base(banc, db => db.prepare('SELECT profile_id, rang, points FROM jour_podiums WHERE jour = ?').all(JOUR)) as {
      profile_id: string
      rang: number
      points: number
    }[]
    const fige = (await lire(banc, bob, `/api/jour/classement?jour=${JOUR}`)).corps
    const nom = (id: string) => (id === idDe(banc, 'alice') ? 'Alice' : 'Bob')
    console.log('[clôture] podium payé :', JSON.stringify(podium.map(p => [nom(p.profile_id), p.rang, p.points])))
    console.log('[clôture] classement figé :', JSON.stringify(fige.lignes.map((l: any) => [l.nom, l.points, l.rang])), 'fige =', fige.fige)
    const matinAlice = (await lire(banc, alice, '/api/jour')).corps.sonHier
    console.log('[clôture] « Hier » d’Alice :', JSON.stringify(matinAlice))
    // Le jour figé et son podium doivent dire la même chose : soit la réponse
    // arrivée après la clôture est refusée (Alice reste à 1 600, deuxième),
    // soit elle compte et le podium la suit.
    const premierFige = fige.lignes.find((l: any) => l.rang === 1)
    const premierPaye = podium.find(p => p.rang === 1)
    assert.equal(premierFige.nom, nom(premierPaye!.profile_id), 'le premier du classement figé est celui que le podium a payé')
    assert.equal(matinAlice.rang === 1, matinAlice.xpPodium === 25, '« 1ʳᵉ » va avec la première marche')
  }))
