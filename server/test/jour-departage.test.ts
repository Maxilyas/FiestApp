// Le départage des ex æquo du quiz du jour, au temps de réaction (le choix du
// propriétaire du 19 novembre 2026 : « que le temps de réaction soit compté
// pour départager les ex æquo ») : à points égaux, le plus rapide en moyenne
// sur ses bonnes réponses passe devant — au classement du jour et du mois, à
// la nuit (podium, laurier, victoire), à la place d'hier et à celle de ses
// jours joués. Au dixième de seconde : plus près, ils restent ex æquo. Le
// défi de la semaine, lui, se joue en prenant son temps, et n'en a pas.
//
// Les jours d'avant la règle gardent leurs ex æquo : leur podium a été payé à
// tous, et un classement départagé après coup aurait montré deuxième un
// joueur qui porte le laurier de ce jour-là.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { tempsMoyen } from '../src/core/jour'
import { classer } from '../../shared/classement'
import { xpDuPodium } from '../../shared/jour'

ProfileStore.tirageEclat = () => false

/** Jeudi 19 novembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 10, 19, 9, 0)
const JOUR = '2026-11-19'
/** Le lendemain, 7 h à Paris : la nuit est à clore. */
const LENDEMAIN = Date.UTC(2026, 10, 20, 6, 0)

interface Horloge {
  t: number
}

async function avecBanc(scenario: (banc: Banc, horloge: Horloge) => Promise<void>) {
  const horloge = { t: DEBUT }
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

/** La base du banc, le temps d'une lecture ou d'une écriture. */
function base<T>(banc: Banc, faire: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { fileMustExist: true })
  try {
    return faire(db)
  } finally {
    db.close()
  }
}

/** Le tirage du jour, lu en base : les bonnes réponses que le téléphone ne voit jamais. */
const tirage = (banc: Banc, jour = JOUR): { bonne: number; reponses: string[] }[] =>
  base(banc, db => JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string }).questions))

/**
 * Joue toute la partie : `juste(i)` dit s'il trouve la question i, `delai(i)`
 * combien de millisecondes après l'affichage part sa réponse — moins d'une
 * seconde, dans le temps de lecture : le bonus de rapidité reste plein, et
 * les points ne disent rien du temps.
 */
async function jouer(banc: Banc, horloge: Horloge, cookie: string, delai: (i: number) => number, juste: (i: number) => boolean = () => true) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = tirage(banc, etat.jour)
  while (etat.question) {
    const i = etat.question.index
    horloge.t += delai(i)
    const bonne = questions[i].bonne
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: juste(i) ? bonne : (bonne + 1) % questions[i].reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

const lignesDe = (classement: any) => classement.lignes.map((l: any) => [l.nom, l.rang, l.points, l.temps])

test('à valeur égale, le plus petit départage passe devant ; à départage égal, le rang reste partagé — sans départage, rien ne change', () => {
  const items = [
    { nom: 'Alice', valeur: 10, temps: 300 },
    { nom: 'Bob', valeur: 10, temps: 200 },
    { nom: 'Carole', valeur: 10, temps: 200 },
    { nom: 'Dan', valeur: 12, temps: 900 },
  ]
  const avec = classer(
    items,
    i => i.valeur,
    i => i.nom,
    i => i.nom,
    i => i.temps,
  )
  assert.deepEqual(
    avec.map(c => [c.item.nom, c.rang]),
    [
      ['Dan', 1],
      ['Bob', 2],
      ['Carole', 2],
      ['Alice', 4],
    ],
  )
  const sans = classer(
    items,
    i => i.valeur,
    i => i.nom,
    i => i.nom,
  )
  assert.deepEqual(
    sans.map(c => [c.item.nom, c.rang]),
    [
      ['Dan', 1],
      ['Alice', 2],
      ['Bob', 2],
      ['Carole', 2],
    ],
  )
})

test('le temps moyen se lit au dixième de seconde, et n’existe pas sans bonne réponse chronométrée', () => {
  assert.equal(tempsMoyen(2000, 10), 200)
  // 0,24 s et 0,2 s : le même dixième — un écart de réseau, pas de réflexe.
  assert.equal(tempsMoyen(2400, 10), 200)
  assert.equal(tempsMoyen(2500, 10), 300)
  assert.equal(tempsMoyen(41_234, 9), 4600)
  assert.equal(tempsMoyen(0, 0), null)
})

test('à points égaux, le plus rapide passe devant : le classement, la nuit, le laurier, hier, les jours joués et le mois', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const carole = await inscrireProfil(banc.url, 'carole', 'Carole', '🐼')
    const dan = await inscrireProfil(banc.url, 'dan', 'Dan', '🐸')
    // Dix sur dix pour les trois premiers, au même score — le bonus de
    // rapidité reste plein pendant le temps de lecture. Alice répond en
    // 0,2 s, Carole en 0,24 s (le même dixième), Bob en 0,7 s.
    await jouer(banc, horloge, alice, () => 200)
    // Le classement lu une fois se garde, et suit chaque réponse en mémoire
    // (`suivreAuClassement`) : le temps de Bob doit l'y suivre aussi.
    assert.deepEqual(lignesDe((await lire(banc, alice, '/api/jour/classement')).corps), [['Alice', 1, 2000, undefined]])
    await jouer(banc, horloge, bob, () => 700)
    await jouer(banc, horloge, carole, () => 240)
    // Dan se trompe une fois, très vite : moins de points, rien à départager.
    await jouer(banc, horloge, dan, () => 100, i => i !== 3)

    const classement = (await lire(banc, bob, '/api/jour/classement')).corps
    assert.deepEqual(lignesDe(classement), [
      ['Alice', 1, 2000, 200],
      ['Carole', 1, 2000, 200],
      ['Bob', 3, 2000, 700],
      ['Dan', 4, 1800, undefined],
    ])
    assert.equal((await lire(banc, bob, '/api/jour')).corps.rang, 3, 'sa place, dans sa partie')
    // Relu de la base (un redémarrage) : le même classement.
    await banc.redemarrer()
    assert.deepEqual(lignesDe((await lire(banc, bob, '/api/jour/classement')).corps), lignesDe(classement))
    const mois = (await lire(banc, bob, '/api/jour/classement?mois=2026-11')).corps
    assert.deepEqual(lignesDe(mois), lignesDe(classement), 'le mois se départage comme le jour')

    // La nuit : le laurier et le podium au plus rapide — Alice et Carole,
    // au même dixième, ex æquo.
    horloge.t = LENDEMAIN
    const matinDeBob = (await lire(banc, bob, '/api/jour')).corps
    assert.deepEqual(
      matinDeBob.vainqueursDHier.map((v: any) => v.nom),
      ['Alice', 'Carole'],
    )
    assert.equal(matinDeBob.sonHier.rang, 3)
    assert.equal(matinDeBob.sonHier.xpPodium, xpDuPodium(3, 4))
    assert.equal((await lire(banc, alice, '/api/jour')).corps.sonHier.xpPodium, xpDuPodium(1, 4))
    assert.deepEqual(
      base(banc, db => db.prepare('SELECT rang FROM jour_podiums WHERE jour = ? ORDER BY rang').all(JOUR)).map((r: any) => r.rang),
      [1, 1, 3],
    )
    const hier = (await lire(banc, bob, `/api/jour/classement?jour=${JOUR}`)).corps
    assert.equal(hier.fige, true)
    assert.deepEqual(lignesDe(hier), lignesDe(classement))
    // Sa place dans ses jours joués, celle du classement de ce jour-là.
    const jours = (await lire(banc, bob, '/api/joueur/moi')).corps.profile.jour.jours
    assert.deepEqual(
      jours.map((j: any) => [j.jour, j.rang, j.joueurs]),
      [[JOUR, 3, 4]],
    )
  }))

test('une question annulée ne compte plus à son temps : son départage se recompte avec ses points', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    // Alice hésite une seconde sur la première question, puis répond à
    // l'instant ; Bob répond à l'instant partout. Bob passe devant.
    await jouer(banc, horloge, alice, i => (i === 0 ? 1000 : 0))
    await jouer(banc, horloge, bob, () => 0)
    assert.deepEqual(lignesDe((await lire(banc, alice, '/api/jour/classement')).corps), [
      ['Bob', 1, 2000, 0],
      ['Alice', 2, 2000, 100],
    ])
    // La première question annulée pour tous : son temps s'en va avec ses
    // points, et les deux se retrouvent ex æquo.
    assert.equal((await poster(banc, admin, '/api/admin/jour/annuler', { jour: JOUR, index: 0 })).status, 200)
    assert.deepEqual(lignesDe((await lire(banc, alice, '/api/jour/classement')).corps), [
      ['Alice', 1, 1800, 0],
      ['Bob', 1, 1800, 0],
    ])
    assert.deepEqual(
      base(banc, db => db.prepare(`SELECT temps_des_justes AS t, justes_chronometrees AS n FROM jour_parties p JOIN profiles pr ON pr.id = p.profile_id WHERE pr.login = 'alice'`).get()),
      { t: 0, n: 9 },
    )
  }))

test('les jours d’avant la règle gardent leurs ex æquo : leur classement, leur nuit et leurs lauriers', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    await jouer(banc, horloge, alice, () => 200)
    await jouer(banc, horloge, bob, () => 700)
    // Le serveur a pris la règle le lendemain : ce jour-ci la précède.
    base(banc, db => db.prepare(`UPDATE jour_meta SET valeur = '2026-11-20' WHERE cle = 'departage_au_temps'`).run())
    await banc.redemarrer()
    assert.deepEqual(lignesDe((await lire(banc, bob, '/api/jour/classement')).corps), [
      ['Alice', 1, 2000, undefined],
      ['Bob', 1, 2000, undefined],
    ])
    horloge.t = LENDEMAIN
    const matin = (await lire(banc, bob, '/api/jour')).corps
    assert.deepEqual(
      matin.vainqueursDHier.map((v: any) => v.nom),
      ['Alice', 'Bob'],
    )
    assert.equal(matin.sonHier.rang, 1)
    // Le mois de la règle, lui, se départage en entier : il n'était pas clos.
    assert.deepEqual(lignesDe((await lire(banc, bob, '/api/jour/classement?mois=2026-11')).corps), [
      ['Alice', 1, 2000, 200],
      ['Bob', 2, 2000, 700],
    ])
  }))

test('la règle se date au premier démarrage, une fois, et le temps des parties de son mois se relit des réponses', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    await jouer(banc, horloge, alice, i => (i < 5 ? 300 : 0))
    const date = () => base(banc, db => (db.prepare(`SELECT valeur FROM jour_meta WHERE cle = 'departage_au_temps'`).get() as { valeur: string }).valeur)
    assert.equal(date(), JOUR)
    // Une base d'avant la règle : ni date, ni temps sur ses parties.
    base(banc, db => {
      db.prepare(`DELETE FROM jour_meta WHERE cle = 'departage_au_temps'`).run()
      db.prepare('UPDATE jour_parties SET temps_des_justes = 0, justes_chronometrees = 0').run()
    })
    horloge.t = Date.UTC(2026, 10, 21, 9, 0)
    await banc.redemarrer()
    assert.equal(date(), '2026-11-21', 'datée au jour où elle démarre')
    assert.deepEqual(
      base(banc, db => db.prepare('SELECT temps_des_justes AS t, justes_chronometrees AS n FROM jour_parties').get()),
      { t: 1500, n: 10 },
      'le temps de ses bonnes réponses, relu de `jour_reponses`',
    )
    // Redémarré encore, elle garde sa date.
    horloge.t = Date.UTC(2026, 10, 22, 9, 0)
    await banc.redemarrer()
    assert.equal(date(), '2026-11-21')
  }))
