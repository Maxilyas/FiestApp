// Le classement gardé (`classementsGardes`) se range sous la révision du
// moment où la lecture FINIT, pas de celui où elle a commencé
// (`JourStore.joueursDu`, server/src/core/jour.ts:874-886). Une réponse
// écrite pendant la lecture — le temps d'aller chercher chez Turso un profil
// pas encore en mémoire, au réveil de l'hébergeur — laisse une lecture
// d'avant rangée comme fraîche. Et la nuit (`clore`) lit ce même cache : le
// podium, le Champion du jour et le laurier se décident sur des points
// périmés, pour de bon.
//
// La lenteur de Turso est jouée comme dans jour-partie.test.ts (« une
// annulation qui croise une réponse en route ») : un `byId` retenu le temps
// qu'une réponse passe.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/jour-regles/cache-perime.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { JourStore } from '../../../server/src/core/jour'
import { avecBanc, base, idDe, JOUR, lire, poster, tirage } from './outils'

ProfileStore.tirageEclat = () => false

async function scenario(banc: any, horloge: { t: number }) {
  {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const carole = await inscrireProfil(banc.url, 'carole', 'Carole', '🐼')

    // Bob finit à 1 500 : huit justes, dont une à l'échéance (100 pts).
    let etat = (await poster(banc, bob, '/api/jour/commencer')).corps
    const qs = tirage(banc)
    while (etat.question) {
      const i = etat.question.index
      if (i === 7) horloge.t += qs[i].duree * 1000
      const choix = i < 8 ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length
      await poster(banc, bob, '/api/jour/repondre', { jour: JOUR, index: i, choix })
      etat = (await poster(banc, bob, '/api/jour/suivante')).corps
    }
    assert.equal(etat.points, 1500)

    // Alice en est à 1 400 avant la dernière question, qu'elle va trouver : 1 600.
    etat = (await poster(banc, alice, '/api/jour/commencer')).corps
    while (etat.question.index < 9) {
      const i = etat.question.index
      const choix = i === 3 || i === 4 ? (qs[i].bonne + 1) % qs[i].reponses.length : qs[i].bonne
      await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: i, choix })
      etat = (await poster(banc, alice, '/api/jour/suivante')).corps
    }
    assert.equal(etat.points, 1400)
    assert.equal(etat.question.index, 9)

    // Carole ouvre sa partie. Sa lecture du classement va chercher le profil
    // de Bob chez Turso — retenu ici le temps qu'Alice réponde.
    const idBob = idDe(banc, 'bob')
    const proto = ProfileStore.prototype as any
    const byId = proto.byId
    let entrer!: () => void
    const entree = new Promise<void>(r => (entrer = r))
    let relacher!: () => void
    const porte = new Promise<void>(r => (relacher = r))
    let pris = false
    proto.byId = async function (this: ProfileStore, id: string) {
      if (id === idBob && !pris) {
        pris = true
        entrer()
        await porte
      }
      return byId.call(this, id)
    }
    try {
      const deCarole = poster(banc, carole, '/api/jour/commencer')
      await entree
      // Pendant ce temps, Alice répond juste à la dernière, et son téléphone
      // demande aussitôt la suite : lue fraîche, sa vue la met première.
      const derniere = await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: 9, choix: qs[9].bonne })
      assert.equal(derniere.corps.cumul, 1600)
      const fin = (await poster(banc, alice, '/api/jour/suivante')).corps
      assert.equal(fin.etat, 'finie')
      assert.equal(fin.rang, 1, 'lue fraîche, Alice est première')
      relacher()
      assert.equal((await deCarole).status, 200)
    } finally {
      proto.byId = byId
    }

    // La lecture de Carole, commencée avant la réponse, s'est rangée après :
    // le classement de tout le serveur rend Alice à 1 400, derrière Bob.
    const classement = (await lire(banc, carole, '/api/jour/classement')).corps
    const vus = classement.lignes.map((l: any) => [l.nom, l.points, l.rang])
    console.log('[cache] classement lu après la réponse d’Alice :', JSON.stringify(vus))

    // Minuit passe sans autre écriture ; la première visite du matin clôt la veille.
    horloge.t = Date.UTC(2026, 8, 27, 6, 0)
    const matin = (await lire(banc, bob, '/api/jour')).corps
    const podium = base(banc, db => db.prepare('SELECT profile_id, rang, points, xp FROM jour_podiums WHERE jour = ?').all(JOUR)) as {
      profile_id: string
      rang: number
      points: number
      xp: number
    }[]
    const parties = base(banc, db => db.prepare('SELECT profile_id, points FROM jour_parties WHERE jour = ?').all(JOUR)) as {
      profile_id: string
      points: number
    }[]
    const nomDe = (id: string) => (id === idBob ? 'Bob' : id === idDe(banc, 'alice') ? 'Alice' : 'Carole')
    console.log('[cache] podium payé :', JSON.stringify(podium.map(p => [nomDe(p.profile_id), p.rang, p.points, p.xp])))
    console.log('[cache] points en base :', JSON.stringify(parties.map(p => [nomDe(p.profile_id), p.points])))
    console.log('[cache] vainqueurs d’hier :', JSON.stringify(matin.vainqueursDHier))
    const fige = (await lire(banc, carole, `/api/jour/classement?jour=${JOUR}`)).corps
    console.log('[cache] classement figé d’hier :', JSON.stringify(fige.lignes.map((l: any) => [l.nom, l.points, l.rang])))

    assert.deepEqual(vus[0], ['Alice', 1600, 1], 'le classement doit suivre la réponse écrite')
    const rangAlice = podium.find(p => p.profile_id === idDe(banc, 'alice'))?.rang
    assert.equal(rangAlice, 1, 'Alice, 1 600 points contre 1 500, a gagné le jour')
    assert.deepEqual(matin.vainqueursDHier.map((v: any) => v.nom), ['Alice'])
  }
}

test('une lecture du classement croisée par une réponse reste en cache, et la nuit paie le podium sur ses points périmés', () =>
  avecBanc(scenario))

/**
 * La piste, jouée sans toucher au dépôt : la même lecture, rangée sous la
 * révision d'AVANT la lecture. Une écriture pendant la lecture la rend
 * aussitôt périmée, et la suivante relit la base.
 */
test('la piste : ranger la lecture sous la révision d’avant — le même scénario donne le bon podium', async () => {
  const proto = JourStore.prototype as any
  const original = proto.joueursDu
  proto.joueursDu = async function (this: any, jour: string, pour: string | null) {
    const garde = this.classementsGardes.get(jour)
    let tous = garde && garde.revision === this.revision ? garde.joueurs : null
    if (!tous) {
      const revision = this.revision
      const res = await this.client.execute({ sql: 'SELECT profile_id, points, finie_le, commencee_le FROM jour_parties WHERE jour = ?', args: [jour] })
      const profils: any[] = []
      for (let i = 0; i < res.rows.length; i += 8)
        profils.push(...(await Promise.all(res.rows.slice(i, i + 8).map((r: any) => this.deps.profiles.byId(String(r.profile_id))))))
      const lus: any[] = []
      res.rows.forEach((r: any, i: number) => {
        if (profils[i]) lus.push({ profil: profils[i], points: Number(r.points), enCours: r.finie_le == null, commenceeLe: Number(r.commencee_le) })
      })
      tous = lus
      this.classementsGardes.set(jour, { revision, joueurs: tous })
    }
    return tous.filter((j: any) => !this.masques.has(j.profil.id) || j.profil.id === pour)
  }
  try {
    await avecBanc(scenario)
  } finally {
    proto.joueursDu = original
  }
})
