// Le quiz du jour, juste jusqu'au bout : ce que l'analyse du 27 septembre
// 2026 a trouvé (retours/2026-09-27/synthese.md, axes 1 et 2), une épreuve
// par défaut.
//
// - Le podium de la nuit se paie sur les vrais points : un classement gardé
//   se rangeait sous la révision lue APRÈS sa lecture, et une réponse écrite
//   pendant qu'on allait chercher un profil chez Turso passait pour vue.
// - Minuit entre deux questions : « Question suivante » ouvre le quiz du
//   jour neuf — elle annonçait « Pas de quiz aujourd'hui ».
// - Une partie commencée compte, pour la jauge comme pour la récompense :
//   le troisième jour d'Halloween commencé puis laissé ouvre la Citrouille,
//   le septième jour commencé fait tomber L'Assidu.
// - La réserve à sec : le téléphone ne promet « demain » que si c'est vrai.
// - Un deuxième seul sur le podium : ni victoire, ni laurier.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { ADMIN, demarrer, ecrire, inscrireProfil, invite, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
const JOUR = '2026-09-26'
const LENDEMAIN = '2026-09-27'
const UN_JOUR = 24 * 3600 * 1000

interface Horloge {
  t: number
}

async function avecBanc(scenario: (banc: Banc, horloge: Horloge) => Promise<void>, debut = DEBUT) {
  const horloge = { t: debut }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/** Le tirage d'un jour, lu en base : les bonnes réponses que le téléphone ne voit jamais. */
const tirage = (banc: Banc, jour = JOUR): { bonne: number; reponses: string[]; duree: number }[] =>
  base(banc, db => {
    const r = db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string } | undefined
    return r ? JSON.parse(r.questions) : []
  })

const idDe = (banc: Banc, login: string) =>
  base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des parties finies, écrites en base : les jours qu'il a déjà joués. */
const partiesFinies = (banc: Banc, login: string, jours: string[]) =>
  base(banc, db => {
    const insert = db.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp)
       VALUES (?, ?, 1, 10, NULL, 0, 0, 1, 0)`,
    )
    for (const jour of jours) insert.run(idDe(banc, login), jour)
  })

/** Joue toute la partie du jour ; `juste(i)` dit s'il trouve la question i. */
async function jouer(banc: Banc, cookie: string, juste: (i: number) => boolean) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = tirage(banc, etat.jour)
  while (etat.question) {
    const i = etat.question.index
    const choix = juste(i) ? questions[i].bonne : (questions[i].bonne + 1) % questions[i].reponses.length
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

test('la nuit paie le podium sur les vrais points, même quand une réponse croise la lecture du classement', () =>
  avecBanc(async (banc, horloge) => {
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

    // Carole ouvre sa partie ; sa lecture du classement va chercher les
    // profils de ses joueurs chez Turso, d'un coup (`byIds`) — retenue le
    // temps qu'Alice réponde à la dernière.
    const idBob = idDe(banc, 'bob')
    const proto = ProfileStore.prototype as any
    const byIds = proto.byIds
    let entrer!: () => void
    const entree = new Promise<void>(r => (entrer = r))
    let relacher!: () => void
    const porte = new Promise<void>(r => (relacher = r))
    let pris = false
    proto.byIds = async function (this: ProfileStore, ids: string[]) {
      if (ids.includes(idBob) && !pris) {
        pris = true
        entrer()
        await porte
      }
      return byIds.call(this, ids)
    }
    try {
      const deCarole = poster(banc, carole, '/api/jour/commencer')
      await entree
      const derniere = await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: 9, choix: qs[9].bonne })
      assert.equal(derniere.corps.cumul, 1600)
      relacher()
      assert.equal((await deCarole).status, 200)
    } finally {
      proto.byIds = byIds
    }

    // La lecture de Carole, commencée avant la réponse, ne passe pas pour fraîche.
    const vus = (await lire(banc, carole, '/api/jour/classement')).corps.lignes.map((l: any) => [l.nom, l.points, l.rang])
    assert.deepEqual(vus[0], ['Alice', 1600, 1], 'le classement suit la réponse écrite')

    // Minuit passe sans autre écriture ; la première visite du matin clôt la veille.
    horloge.t = Date.UTC(2026, 8, 27, 6, 0)
    const matin = (await lire(banc, bob, '/api/jour')).corps
    const rangs = base(banc, db => db.prepare('SELECT profile_id, rang FROM jour_podiums WHERE jour = ?').all(JOUR)) as {
      profile_id: string
      rang: number
    }[]
    assert.equal(rangs.find(p => p.profile_id === idDe(banc, 'alice'))?.rang, 1, 'Alice, 1 600 points contre 1 500, a gagné le jour')
    assert.deepEqual(matin.vainqueursDHier.map((v: any) => v.nom), ['Alice'])
  }))

test('minuit entre deux questions : « Question suivante » ouvre le quiz du jour neuf, et la veille est close', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // 23 h 58 à Paris : Alice commence, répond juste à la première.
    horloge.t = Date.UTC(2026, 8, 26, 21, 58)
    const q = (await poster(banc, alice, '/api/jour/commencer')).corps.question
    horloge.t += 2000
    assert.equal((await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: q.index, choix: tirage(banc)[0].bonne })).status, 200)

    // 0 h 00 min 30 : elle touche « Question suivante », avant que personne
    // n'ait ouvert le quiz du jour sur le serveur.
    horloge.t = Date.UTC(2026, 8, 26, 22, 0, 30)
    const suite = (await poster(banc, alice, '/api/jour/suivante')).corps
    assert.equal(suite.jour, LENDEMAIN)
    assert.equal(suite.etat, 'a-jouer', 'la réserve n’est pas vide : le quiz du jour existe')
    assert.equal(suite.total, 10)
    // Son hier se lit après la nuit : la partie y est, close.
    assert.ok(suite.sonHier, 'le lendemain raconte sa partie d’hier')
    assert.equal(base(banc, db => (db.prepare('SELECT COUNT(*) AS n FROM jour_clotures WHERE jour = ?').get(JOUR) as { n: number }).n), 1)
  }))

test('la partie d’hier laissée à minuit ne paraît plus « en cours » dans le classement figé', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    horloge.t = Date.UTC(2026, 8, 26, 21, 58)
    const q = (await poster(banc, alice, '/api/jour/commencer')).corps.question
    await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: q.index, choix: tirage(banc)[0].bonne })
    // Minuit : sa partie ne finira jamais.
    horloge.t = Date.UTC(2026, 8, 26, 22, 0, 5)
    await lire(banc, bob, '/api/jour')
    const hier = (await lire(banc, bob, `/api/jour/classement?jour=${JOUR}`)).corps
    assert.equal(hier.fige, true)
    assert.equal(hier.lignes.length, 1)
    assert.equal(hier.lignes.some((l: any) => l.enCours), false, 'un jour clos n’a plus de partie dont les points peuvent monter')
  }))

test('le troisième jour d’Halloween commencé puis laissé ouvre la Citrouille', () =>
  avecBanc(
    async (banc, horloge) => {
      const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
      partiesFinies(banc, 'alice', ['2026-10-29', '2026-10-31'])
      // Le 1er novembre, dernier jour d'Halloween : elle commence, répond à
      // une question, et le téléphone sonne.
      const etat = (await poster(banc, alice, '/api/jour/commencer')).corps
      await poster(banc, alice, '/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: 0 })
      const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
      assert.ok(moi.legendaires.includes('lg:citrouille'), 'trois jours commencés pendant Halloween ouvrent la Citrouille')
      // Le lendemain, Halloween fini : elle la garde, et rien ne s'annonce plus.
      horloge.t = Date.UTC(2026, 10, 2, 9, 0)
      assert.equal((await lire(banc, alice, '/api/jour')).corps.saison, undefined)
      assert.ok((await lire(banc, alice, '/api/joueur/moi')).corps.profile.legendaires.includes('lg:citrouille'))
    },
    Date.UTC(2026, 10, 1, 9, 0),
  ))

test('la fin d’une partie fête encore ce que son début a fait tomber', () =>
  avecBanc(
    async banc => {
      const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
      partiesFinies(banc, 'alice', ['2026-10-26', '2026-10-28'])
      const fin = await jouer(banc, alice, () => true)
      assert.deepEqual(fin.legendaires, ['lg:citrouille'], 'la fin de la partie qui l’a ouverte la fête')
    },
    Date.UTC(2026, 9, 29, 9, 0),
  ))

test('le septième jour commencé fait tomber L’Assidu, sans attendre la fin de la partie', () =>
  avecBanc(async banc => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    partiesFinies(banc, 'alice', ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'])
    const etat = (await poster(banc, alice, '/api/jour/commencer')).corps
    await poster(banc, alice, '/api/jour/repondre', { jour: etat.jour, index: 0, choix: 0 })
    const assidu = (await lire(banc, alice, '/api/joueur/moi')).corps.profile.hautsFaits.find((h: any) => h.key === 'hf:assidu')
    assert.equal(assidu.valeur, 7)
    assert.equal(assidu.fois, 1, 'sept jours de quiz du jour — une partie commencée compte — font L’Assidu · Bronze')
    const rangee = base(banc, db => db.prepare(`SELECT soiree_id FROM profile_badges WHERE badge = 'hf:assidu:1'`).all()) as { soiree_id: string }[]
    assert.deepEqual(rangee.map(r => r.soiree_id), [`#jour:${JOUR}`], 'rangé sous le jour qui l’a fait tomber')
  }))

test('la réserve à sec : « Il revient demain » seulement si la réserve tient demain', () =>
  avecBanc(async banc => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Toute la réserve posée il y a trente jours : rien aujourd'hui, tout demain.
    base(banc, db => db.prepare('UPDATE jour_reserve SET posee_le = ?').run('2026-08-27'))
    let vue = (await lire(banc, alice, '/api/jour')).corps
    assert.equal(vue.etat, 'aucun')
    assert.equal(vue.revientDemain, true)
    // Posée aujourd'hui même : rien avant un mois.
    base(banc, db => db.prepare('UPDATE jour_reserve SET posee_le = ?').run(JOUR))
    vue = (await lire(banc, alice, '/api/jour')).corps
    assert.equal(vue.etat, 'aucun')
    assert.equal(vue.revientDemain, false)
  }))

test('un deuxième seul sur le podium du jour : ni victoire, ni Champion du jour, ni laurier', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const carole = await inscrireProfil(banc.url, 'carole', 'Carole', '🐼')
    const dan = await inscrireProfil(banc.url, 'dan', 'Dan', '🐸')
    // Quatre joueurs, trois marches : Alice 1re, Bob 2e, Carole 3e, Dan rien.
    await jouer(banc, alice, () => true)
    await jouer(banc, bob, i => i !== 3)
    await jouer(banc, carole, i => i !== 3 && i !== 5)
    await jouer(banc, dan, i => i < 2)

    horloge.t += UN_JOUR
    await lire(banc, bob, '/api/jour')
    const podium = base(banc, db => db.prepare('SELECT rang FROM jour_podiums ORDER BY rang').all() as { rang: number }[])
    assert.deepEqual(podium.map(p => p.rang), [1, 2, 3], 'trois marches, sans ex æquo')
    const champions = base(banc, db =>
      (
        db
          .prepare(`SELECT p.login FROM profile_badges b JOIN profiles p ON p.id = b.profile_id WHERE b.badge = 'hf:champion-du-jour:1' ORDER BY p.login`)
          .all() as { login: string }[]
      ).map(r => r.login),
    )
    assert.deepEqual(champions, ['alice'], 'seul le premier est Champion du jour')
    const lignes = (await lire(banc, bob, `/api/jour/classement?jour=${JOUR}`)).corps.lignes as { nom: string; laurier?: boolean }[]
    assert.deepEqual(lignes.filter(l => l.laurier).map(l => l.nom), ['Alice'], 'seul le premier porte le laurier')
    // La carte de Bob dit un jour joué, aucune victoire.
    const b = await invite(banc.url, 'Bob', '', { cookie: bob })
    const a = await invite(banc.url, 'Alice', '', { cookie: alice })
    const carte = (id: string) => fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${id}.json`).then(r => r.json() as Promise<any>)
    assert.deepEqual((await carte(b.playerId)).profil.jour, { joues: 1, victoires: 0 })
    assert.deepEqual((await carte(a.playerId)).profil.jour, { joues: 1, victoires: 1 })
  }))
