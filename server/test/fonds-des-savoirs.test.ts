// Les fonds des savoirs (le 15 octobre 2026) : douze fonds de carte peints,
// un par catégorie de questions, les seuls que la boutique vend — au même
// prix chacun (`PRIX_D_UN_FOND`). Achetés, ils restent à lui, se portent
// derrière sa carte, comptent à ses dépenses, au QG, et partent avec son
// profil. Le trésor du coffre de la semaine, lui, ne se vend pas, ni les fonds
// qui se gagnent sur une piste.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { PRIX_D_UN_FOND } from '../../shared/fonds'

/** Samedi 26 septembre 2026, 10 h à Paris : aucune saison. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)

/** Un serveur jetable ; à l'horloge du quiz du jour réglée, sauf pour le QG, qui lit les trente derniers jours à l'heure vraie. */
async function avecBanc(scenario: (banc: Banc) => Promise<void>, { horloge = true } = {}) {
  const banc = await demarrer(horloge ? { horlogeDuJour: () => DEBUT } : {})
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

function enBase<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => enBase(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des confettis : une partie du quiz du jour d'avant, avec ses bonnes réponses. */
function confettis(banc: Banc, profileId: string, jour: string, justes: number) {
  enBase(banc, db =>
    db
      .prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 0, ?, 1, 0)`)
      .run(profileId, jour, justes),
  )
}

const acheter = (banc: Banc, cookie: string | undefined, fond: string, porter?: boolean) =>
  ecrire(banc.url, '/api/joueur/fonds', { fond, ...(porter === false && { porter }) }, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const porter = (banc: Banc, cookie: string, patch: object) =>
  ecrire(banc.url, '/api/joueur/moi', patch, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const moi = async (banc: Banc, cookie: string, accueil = false) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi${accueil ? '?accueil' : ''}`, { headers: { Cookie: cookie } })).json()) as any).profile

test('un fond des savoirs s’achète à son prix, se porte ou se garde ; le reste est refusé en clair', () =>
  avecBanc(async banc => {
    assert.equal((await acheter(banc, undefined, 'jazz')).status, 401, 'sans profil, pas de boutique')
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')

    const fauche = await acheter(banc, cookie, 'musee')
    assert.equal(fauche.status, 400)
    assert.equal(fauche.corps.error, `Il te manque ${PRIX_D_UN_FOND} confettis pour le Musée de nuit`)
    assert.equal((await acheter(banc, cookie, 'licorne')).corps.error, 'Ce fond n’existe pas')
    // Le trésor ne sort que du coffre de la semaine ; un fond d'une piste se gagne.
    assert.equal((await acheter(banc, cookie, 'dragon')).corps.error, 'Ce fond ne se vend pas : il ne sort que du coffre de la semaine')
    assert.equal((await acheter(banc, cookie, 'nuit')).corps.error, 'Ce fond ne se vend pas : il se gagne avec 30 jours de quiz du jour')

    confettis(banc, alice, '2026-09-20', 600)
    assert.equal((await moi(banc, cookie, true)).boutique.fondsAchetes, undefined, 'rien d’acheté : rien à lire')
    const achat = await acheter(banc, cookie, 'jazz')
    assert.equal(achat.status, 200, achat.corps.error)
    // Porté aussitôt, et ses fonds relus avec : la loge le propose sans recharger.
    assert.equal(achat.corps.fond, 'jazz')
    assert.deepEqual(achat.corps.fonds, ['jazz'])
    assert.deepEqual(achat.corps.boutique.confettis, { gagnes: 600, depenses: PRIX_D_UN_FOND, solde: 600 - PRIX_D_UN_FOND })
    assert.equal((await acheter(banc, cookie, 'jazz')).corps.error, 'Le Club de jazz est déjà à toi')

    // Acheté sans le porter : celui qu'il porte reste derrière sa carte, l'autre l'attend dans la loge.
    const garde = await acheter(banc, cookie, 'savane', false)
    assert.equal(garde.status, 200, garde.corps.error)
    assert.equal(garde.corps.fond, 'jazz')
    // Dans l'ordre du catalogue, celui des catégories : la Nature avant la Musique.
    assert.deepEqual(garde.corps.fonds, ['savane', 'jazz'])
    assert.equal((await acheter(banc, cookie, 'vitrail')).corps.error, `Il te manque ${3 * PRIX_D_UN_FOND - 600} confettis pour le Vitrail`)
    assert.equal((await porter(banc, cookie, { fond: 'savane' })).status, 200)
    // Un fond qu'il n'a pas ne se porte pas.
    assert.equal((await porter(banc, cookie, { fond: 'vitrail' })).corps.error, `Ce fond se gagne d’abord : ${PRIX_D_UN_FOND} confettis en boutique`)

    // Relu après un redémarrage : ses fonds sont à lui pour de bon.
    await banc.redemarrer()
    const relu = await moi(banc, cookie)
    assert.equal(relu.fond, 'savane')
    assert.deepEqual(relu.fonds, ['savane', 'jazz'])
    assert.equal(relu.boutique.confettis.solde, 600 - 2 * PRIX_D_UN_FOND)
    // L'accueil les sait aussi : « À la une » ne met en avant que les dix autres.
    assert.deepEqual((await moi(banc, cookie, true)).boutique.fondsAchetes, ['savane', 'jazz'])
  }))

test('deux achats partis ensemble ne dépensent pas deux fois les mêmes confettis', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    confettis(banc, idDe(banc, 'bob'), '2026-09-20', PRIX_D_UN_FOND + 100)
    // Deux onglets, deux fonds : un seul passe, l'autre lit le solde qui reste.
    const [a, b] = await Promise.all([acheter(banc, cookie, 'egypte', false), acheter(banc, cookie, 'epices', false)])
    assert.deepEqual([a.status, b.status].sort(), [200, 400])
    const refus = (a.status === 400 ? a : b).corps.error as string
    assert.match(refus, new RegExp(`^Il te manque ${PRIX_D_UN_FOND - 100} confettis pour (le Temple d’Égypte|le Marché aux épices)$`))
    assert.equal((await moi(banc, cookie)).boutique.confettis.solde, 100)
  }))

test('le QG le compte à ses dépenses et à ses ventes ; supprimer le profil emporte ses fonds', () =>
  avecBanc(async banc => {
    const admin = await connexionAnimateur(banc.url)
    const cookie = await inscrireProfil(banc.url, 'chloe', 'Chloé', '🐱')
    const chloe = idDe(banc, 'chloe')
    confettis(banc, chloe, '2026-09-20', 3 * PRIX_D_UN_FOND)
    for (const fond of ['foudre', 'jazz', 'arcade', 'table-de-jeux']) {
      const r = await acheter(banc, cookie, fond, false)
      // L'arcade n'existe pas : la table de jeux est le fond des jeux.
      if (fond === 'arcade') assert.equal(r.corps.error, 'Ce fond n’existe pas')
      else assert.equal(r.status, 200, r.corps.error)
    }
    const page = (await (await fetch(`${banc.url}/api/admin/economie`, { headers: { Cookie: admin } })).json()) as any
    assert.deepEqual(page.depenses.fonds, { objets: 3, confettis: 3 * PRIX_D_UN_FOND })
    assert.deepEqual(
      page.ventes.filter((v: any) => v.sorte === 'fond').map((v: any) => v.nom).sort(),
      ['La Table de jeux', 'Le Club de jazz', 'Le Laboratoire de la foudre'],
    )
    assert.equal(enBase(banc, db => (db.prepare('SELECT COUNT(*) AS n FROM profile_fonds WHERE profile_id = ?').get(chloe) as { n: number }).n), 3)
    const suppression = await fetch(`${banc.url}/api/admin/profils/${chloe}`, { method: 'DELETE', headers: { Cookie: admin, 'X-Requested-With': 'quizz' } })
    assert.equal(suppression.status, 200)
    assert.equal(enBase(banc, db => (db.prepare('SELECT COUNT(*) AS n FROM profile_fonds WHERE profile_id = ?').get(chloe) as { n: number }).n), 0)
  }, { horloge: false }))
