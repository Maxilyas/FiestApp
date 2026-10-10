// Le défi entre amis (un retour de joueur du 10 octobre 2026 : « un mode
// défi en différé, compétitif ») : on lance un tirage, on le joue, on
// envoie son lien ; chacun de ceux qui l'ouvrent, profil en main, joue les
// mêmes questions, une fois, dans la semaine. Le classement partage les
// rangs (invariant 15), la correction attend la fermeture — finie, la
// sienne soufflerait les réponses à ceux qu'on a défiés —, et rien ne s'y
// gagne qu'on n'aurait pas gagné en série : on se défierait soi-même d'un
// second profil.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { DUELS_OUVERTS_MAX, DUREE_D_UN_DUEL_MS, LETTRES_D_UN_CODE, lireCodeDuDuel } from '../../shared/campagne'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Les questions qu'une tentative a reçues, telles qu'elle les garde. */
function questions(banc: Banc, serie: string): { id: string; bonne: number; reponses: string[] }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)
  } finally {
    db.close()
  }
}

/** Joue une tentative : `justes` bonnes réponses, puis des fautes jusqu'à sa fin ; rend la dernière réponse. */
async function jouer(banc: Banc, cookie: string, serie: string, justes: number, { jusquAuBout = true } = {}) {
  const qs = questions(banc, serie)
  let derniere: any = null
  for (let i = 0; i < qs.length; i++) {
    if (!jusquAuBout && i >= justes) break
    const choix = i < justes ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie}/reponse`, { index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    derniere = r.corps
    if (derniere.finie) break
  }
  return derniere
}

test('un code de défi se lit sans se tromper : six lettres sans 0, O, 1, I ni L, en capitales', () => {
  assert.equal(lireCodeDuDuel('#duel-k7m2qx'), 'K7M2QX')
  assert.equal(lireCodeDuDuel(' K7M2QX '), 'K7M2QX')
  assert.equal(lireCodeDuDuel('K7M2Q0'), null, 'un zéro n’en est jamais')
  assert.equal(lireCodeDuDuel('K7M2Q'), null)
  assert.equal(lireCodeDuDuel(42), null)
  assert.ok(!/[0O1IL]/.test(LETTRES_D_UN_CODE))
})

test('le défi entre amis : le même tirage pour chacun, une tentative, un classement partagé, la correction à la fermeture', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼')

    // Léa le lance sur l'Histoire : son code, et sa tentative qui commence.
    const lance = await poster(banc, lea, '/api/campagne/duel', { categories: ['Histoire'] })
    assert.equal(lance.status, 200, lance.corps.error)
    const { code, serie } = lance.corps
    assert.equal(lireCodeDuDuel(code), code)
    assert.deepEqual(serie.categories, ['Histoire'])
    const tirage = questions(banc, serie.id)
    assert.ok(tirage.length >= 10)
    const fin = await jouer(banc, lea, serie.id, 5)
    assert.equal(fin.finie, true)
    assert.deepEqual(fin.defi, { rang: 1, joueurs: 1 }, 'sa place pour l’instant')
    // Finie, sa correction attend : ses amis jouent encore.
    const correction = await lire(banc, lea, `/api/campagne/serie/${serie.id}/correction`)
    assert.equal(correction.status, 400)
    assert.equal(correction.corps.error, 'La correction du défi s’ouvre à sa fermeture : tes amis jouent encore')

    // Tom ouvre le lien : qui l'a lancé, ce qu'il fait jouer, le classement.
    const page = (await lire(banc, tom, `/api/campagne/duel/${code.toLowerCase()}`)).corps
    assert.equal(page.code, code)
    assert.deepEqual(page.auteur, { nom: 'Léa', avatar: '🦊' })
    assert.deepEqual(page.categories, ['Histoire'])
    assert.equal(page.tentative, null)
    assert.equal(page.minutesRestantes, DUREE_D_UN_DUEL_MS / 60_000)
    assert.deepEqual(
      page.lignes.map((l: any) => [l.nom, l.justes, l.rang]),
      [['Léa', 5, 1]],
    )
    assert.equal((await lire(banc, lea, `/api/campagne/duel/${code}`)).corps.auteur.toi, true)

    // Il le relève : les mêmes questions, dans le même ordre, ses réponses à lui.
    const sienne = (await poster(banc, tom, `/api/campagne/duel/${code}`)).corps
    assert.deepEqual(
      questions(banc, sienne.id).map(q => q.id),
      tirage.map(q => q.id),
    )
    assert.deepEqual((await jouer(banc, tom, sienne.id, 7)).defi, { rang: 1, joueurs: 2 })
    // Une seule tentative : ni une seconde, ni un abandon pour repartir.
    const encore = await poster(banc, tom, `/api/campagne/duel/${code}`)
    assert.equal(encore.status, 400)
    assert.equal(encore.corps.error, 'Tu as relevé ce défi : son classement t’attend')
    const abandon = await poster(banc, tom, `/api/campagne/serie/${sienne.id}/abandon`)
    assert.equal(abandon.status, 400)
    assert.match(abandon.corps.error, /Le défi n’a qu’une tentative/)

    // Hugo s'arrête en route : il est classé, « en cours ».
    const laissee = (await poster(banc, hugo, `/api/campagne/duel/${code}`)).corps
    await jouer(banc, hugo, laissee.id, 2, { jusquAuBout: false })
    const pendant = (await lire(banc, lea, `/api/campagne/duel/${code}`)).corps
    assert.deepEqual(
      pendant.lignes.map((l: any) => [l.nom, l.justes, l.rang, !!l.enCours]),
      [
        ['Tom', 7, 1, false],
        ['Léa', 5, 2, false],
        ['Hugo', 2, 3, true],
      ],
    )
    // Le record des séries ne compte pas un défi.
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.record, 0)

    // Une semaine plus tard, il ferme : plus une réponse, plus une tentative,
    // et la correction de chacun s'ouvre — celle de la tentative laissée aussi.
    horloge.t = DEBUT + DUREE_D_UN_DUEL_MS
    const fermee = (await lire(banc, tom, `/api/campagne/duel/${code}`)).corps
    assert.equal(fermee.minutesRestantes, 0)
    assert.ok(fermee.lignes.every((l: any) => !l.enCours), 'plus personne en cours')
    const tard = await poster(banc, hugo, `/api/campagne/serie/${laissee.id}/reponse`, { index: 2, choix: 0 })
    assert.equal(tard.status, 400)
    assert.equal(tard.corps.error, 'Ce défi est fermé : son classement est figé')
    const nouvelle = await inscrireProfil(banc.url, 'zoe', 'Zoé')
    assert.equal((await poster(banc, nouvelle, `/api/campagne/duel/${code}`)).corps.error, 'Ce défi est fermé : son classement est figé')
    assert.equal((await lire(banc, lea, `/api/campagne/serie/${serie.id}/correction`)).status, 200)
    assert.equal((await lire(banc, hugo, `/api/campagne/serie/${laissee.id}/correction`)).corps.length, 2)

    // Ses défis se retrouvent sans le lien : celui de Léa, sa place dedans.
    const miens = (await lire(banc, lea, '/api/campagne/duels')).corps
    assert.deepEqual(miens, [{ code, auteur: 'toi', categories: ['Histoire'], joueurs: 3, justes: 5, rang: 2, minutesRestantes: 0 }])
    assert.equal((await lire(banc, hugo, '/api/campagne/duels')).corps[0].auteur, 'Léa')
  } finally {
    await banc.close()
  }
})

test('un défi introuvable le dit, et l’on n’en tient que cinq ouverts à la fois', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    for (const code of ['ZZZZZZ', 'pas-un-code']) {
      const r = await lire(banc, lea, `/api/campagne/duel/${code}`)
      assert.equal(r.status, 400)
      assert.equal(r.corps.error, 'Ce défi est introuvable : vérifie son lien')
    }
    for (let i = 0; i < DUELS_OUVERTS_MAX; i++) assert.equal((await poster(banc, lea, '/api/campagne/duel', {})).status, 200)
    const trop = await poster(banc, lea, '/api/campagne/duel', {})
    assert.equal(trop.status, 400)
    assert.equal(trop.corps.error, `Tu as déjà ${DUELS_OUVERTS_MAX} défis ouverts : attends que l’un d’eux ferme`)
    // Sans profil, le défi le dit comme la campagne.
    assert.equal((await fetch(`${banc.url}/api/campagne/duel/ZZZZZZ`)).status, 401)
  } finally {
    await banc.close()
  }
})
