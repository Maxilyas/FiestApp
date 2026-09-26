// Le laurier du vainqueur d'hier au quiz du jour : il suit son prénom toute
// la journée — au classement du jour, sur sa carte, sur sa page, et jusque
// dans les soirées où il joue. Tous les ex æquo en tête le portent ; un
// profil masqué, non ; un invité anonyme n'en porte jamais (invariant 8).
//
// Rien ne tourne à minuit. Si personne n'est revenu au quiz du jour, c'est
// la salle qui joue qui réclame les lauriers : la nuit se clôt alors en
// arrière-plan, et la salle voit le laurier changer de tête sans rien
// demander.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { ADMIN, connexionAnimateur, demarrer, ecrire, inscrireProfil, instantane, invite, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
const JOUR = '2026-09-26'
const UN_JOUR = 24 * 3600 * 1000

async function avecBanc(scenario: (banc: Banc, horloge: { t: number }) => Promise<void>) {
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

/**
 * Joue toute la partie du jour ; `juste(i)` dit s'il trouve la question i.
 * L'horloge du jour ne bouge pas : deux sans-faute font ex æquo.
 */
async function jouer(banc: Banc, cookie: string, juste: (i: number) => boolean) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const questions = JSON.parse(
    (db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions,
  ) as { bonne: number; reponses: string[] }[]
  db.close()
  while (etat.question) {
    const i = etat.question.index
    const bonne = questions[i].bonne
    const choix = juste(i) ? bonne : (bonne + 1) % questions[i].reponses.length
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

/** Qui porte le laurier : dans des lignes du classement du jour, ou des joueurs d'un instantané. */
const laures = (lignes: { nom?: string; name?: string; laurier?: boolean }[]) =>
  lignes
    .filter(l => l.laurier)
    .map(l => l.nom ?? l.name)
    .sort()

test('le vainqueur d’hier porte le laurier toute la journée, ex æquo compris — la nuit close en arrière-plan par la salle qui joue', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const carole = await inscrireProfil(banc.url, 'carole', 'Carole', '🐼')
    // Alice et Bob font dix sur dix, ex æquo ; Carole se trompe une fois.
    await jouer(banc, alice, () => true)
    await jouer(banc, bob, () => true)
    await jouer(banc, carole, i => i !== 3)

    // Une soirée où jouent Alice, Carole et Zoé, anonyme. Le jour même,
    // personne n'a de laurier : la journée n'est pas close.
    const zoe = await invite(banc.url, 'Zoé', '🐸')
    const aliceEnSoiree = await invite(banc.url, 'Alice', '', { cookie: alice })
    const caroleEnSoiree = await invite(banc.url, 'Carole', '', { cookie: carole })
    const avant = await instantane(zoe.socket, s => s.players.length === 3, 'les trois invités')
    assert.deepEqual(laures(avant.players), [])
    assert.deepEqual(laures((await lire(banc, carole, '/api/jour/classement')).corps.lignes), [])

    // Minuit passe, et personne ne revient au quiz du jour. La salle, elle,
    // continue : quelqu'un arrive, sa diffusion réclame les lauriers, la
    // nuit se clôt en arrière-plan — et la salle voit celui d'Alice.
    horloge.t += UN_JOUR
    await invite(banc.url, 'Yann', '🐙')
    const apres = await instantane(zoe.socket, s => s.players.some((p: any) => p.name === 'Alice' && p.laurier), 'le laurier d’Alice')
    assert.deepEqual(laures(apres.players), ['Alice'], 'Carole, deuxième, n’en porte pas')
    const joueur = (nom: string) => apres.players.find((p: any) => p.name === nom)
    assert.ok(!('laurier' in joueur('Zoé')), 'un invité anonyme n’affiche rien')
    assert.ok(!('laurier' in joueur('Carole')))

    // Le classement d'hier le montre, ex æquo compris ; celui d'aujourd'hui
    // aussi, à qui joue déjà.
    assert.deepEqual(laures((await lire(banc, carole, `/api/jour/classement?jour=${JOUR}`)).corps.lignes), ['Alice', 'Bob'])
    await jouer(banc, alice, () => true)
    await jouer(banc, carole, i => i !== 5)
    assert.deepEqual(laures((await lire(banc, carole, '/api/jour/classement')).corps.lignes), ['Alice'])

    // Sa carte et sa page le disent ; celles de Carole, rien.
    const carte = (id: string) => fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${id}.json`).then(r => r.json() as Promise<any>)
    assert.equal((await carte(aliceEnSoiree.playerId)).laurier, true)
    assert.ok(!('laurier' in (await carte(caroleEnSoiree.playerId))))
    assert.equal((await lire(banc, alice, '/api/joueur/moi')).corps.profile.laurier, true)
    assert.ok(!('laurier' in (await lire(banc, carole, '/api/joueur/moi')).corps.profile))

    // Masqué, Bob ne s'annonce plus : son laurier tombe, jusque sur sa page.
    const admin = await connexionAnimateur(banc.url)
    const idBob = (await lire(banc, admin, '/api/admin/jour/profils?q=bob')).corps.find((p: any) => p.login === 'bob').id
    assert.equal((await poster(banc, admin, '/api/admin/jour/masquer', { profileId: idBob, masque: true })).status, 200)
    assert.ok(!('laurier' in (await lire(banc, bob, '/api/joueur/moi')).corps.profile))
    assert.deepEqual(laures((await lire(banc, bob, `/api/jour/classement?jour=${JOUR}`)).corps.lignes), ['Alice'])

    // Alice a encore battu Carole : son laurier tient un jour de plus. Un
    // jour sans partie ensuite, et il tombe — même en pleine soirée.
    horloge.t += UN_JOUR
    await invite(banc.url, 'Xavier', '🐧')
    await instantane(zoe.socket, s => s.players.length === 5 && laures(s.players).join() === 'Alice', 'Alice lauréate de la veille')
    horloge.t += UN_JOUR
    await invite(banc.url, 'Wanda', '🐨')
    const fin = await instantane(zoe.socket, s => s.players.length === 6, 'Wanda arrivée')
    assert.deepEqual(laures(fin.players), [], 'un jour sans partie : plus de laurier')
    assert.ok(!('laurier' in (await lire(banc, alice, '/api/joueur/moi')).corps.profile))
  }))
