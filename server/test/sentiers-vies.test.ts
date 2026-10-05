// Les vies des sentiers du savoir : douze par jour pour tous les sentiers,
// rendues à minuit (Paris), sans s'additionner d'un jour à l'autre ; au-delà,
// des vies achetées en confettis, qui attendent dans une réserve et ne
// périment pas. Rejouer un palier validé ne coûte rien, même sans vie. Et
// l'administration lit les paliers sur les vraies épreuves, les rejeux à part.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import React from 'react'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { PRIX_D_UNE_VIE, VIES_PAR_ACHAT_MAX, VIES_PAR_JOUR, type StatsDuPalier } from '../../shared/sentiers'

/** Samedi 26 septembre 2026, 22 h à Paris : minuit arrive dans deux heures. */
const DEBUT = Date.UTC(2026, 8, 26, 20, 0)

type Reponse = { status: number; corps: any }
const lire = (banc: Banc, cookie: string, chemin: string): Promise<Reponse> =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: await r.json() }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}): Promise<Reponse> =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: await r.json() }))
const bonneDe = (q: { reponses: string[] }) => q.reponses.findIndex(r => r.startsWith('Bonne'))

/** Une épreuve jouée jusqu'au bout : `justes` bonnes réponses d'abord, des fautes ensuite. */
async function epreuve(banc: Banc, cookie: string, branche: string, palier: number, justes: number): Promise<any> {
  const debut = await poster(banc, cookie, '/api/campagne/sentiers/epreuve', { branche, palier })
  assert.equal(debut.status, 200, debut.corps.error)
  let e = debut.corps
  let derniere: any = null
  for (let i = 0; !e.finie && e.question; i++) {
    const choix = i < justes ? bonneDe(e.question) : (bonneDe(e.question) + 1) % e.question.reponses.length
    const r = await poster(banc, cookie, `/api/campagne/epreuve/${e.id}/reponse`, { index: e.question.index, choix })
    assert.equal(r.status, 200, r.corps.error)
    derniere = r.corps
    e = r.corps.epreuve
  }
  return derniere
}

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

test('douze vies par jour : la treizième épreuve ratée attend minuit, ou une vie achetée ; rejouer reste libre', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(60, { categories: ['Nature'] }) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    // Le premier palier validé, pour avoir de quoi rejouer — et seize confettis.
    assert.equal((await epreuve(banc, lea, 'foret', 1, 16)).epreuve.issue, 'validee')

    // Pas assez de confettis : l'achat le dit, en clair.
    const cher = await poster(banc, lea, '/api/campagne/vies', { nombre: 1 })
    assert.equal(cher.status, 400)
    assert.equal(cher.corps.error, `Il te manque ${PRIX_D_UNE_VIE - 16} confettis pour une vie`)
    assert.equal((await poster(banc, lea, '/api/campagne/vies', { nombre: VIES_PAR_ACHAT_MAX + 1 })).corps.error, `Choisis de 1 à ${VIES_PAR_ACHAT_MAX} vies`)
    assert.equal((await poster(banc, lea, '/api/campagne/vies', { nombre: 1.5 })).corps.error, `Choisis de 1 à ${VIES_PAR_ACHAT_MAX} vies`)

    // Deux rejeux sans faute : trente-deux confettis de plus, quarante-huit en tout.
    for (let i = 0; i < 2; i++) assert.equal((await epreuve(banc, lea, 'foret', 1, 16)).epreuve.rejeu, true)
    const achat = await poster(banc, lea, '/api/campagne/vies', { nombre: 1 })
    assert.equal(achat.status, 200, achat.corps.error)
    assert.deepEqual([achat.corps.vies.jour, achat.corps.vies.reserve, achat.corps.confettis], [VIES_PAR_JOUR, 1, 48 - PRIX_D_UNE_VIE])

    // Douze échecs prennent celles du jour, le treizième la réserve.
    for (let i = 0; i < VIES_PAR_JOUR; i++) assert.equal((await epreuve(banc, lea, 'foret', 2, 0)).epreuve.issue, 'ratee')
    let etat = (await lire(banc, lea, '/api/campagne/sentiers')).corps
    assert.deepEqual([etat.vies.jour, etat.vies.reserve], [0, 1])
    const dernier = await epreuve(banc, lea, 'foret', 2, 0)
    assert.deepEqual([dernier.vies.jour, dernier.vies.reserve], [0, 0])

    // Plus rien : un palier en jeu attend, rejouer reste libre.
    const refus = await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 2 })
    assert.equal(refus.status, 400)
    assert.equal(refus.corps.error, 'Plus de vies pour aujourd’hui : elles reviennent à minuit, ou rachètes-en en confettis')
    assert.equal((await epreuve(banc, lea, 'foret', 1, 12)).epreuve.issue, 'validee', 'un rejeu ne demande pas de vie')
    assert.ok(etat.vies.renouveleesLe > horloge.t && etat.vies.renouveleesLe <= horloge.t + 2 * 3600_000, 'le prochain minuit de Paris')

    // Minuit à Paris : douze vies, pas une de plus — elles ne s'additionnent pas.
    horloge.t += 2 * 3600_000 + 60_000
    etat = (await lire(banc, lea, '/api/campagne/sentiers')).corps
    assert.deepEqual([etat.vies.jour, etat.vies.reserve], [VIES_PAR_JOUR, 0])
    assert.equal((await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 2 })).status, 200)
  } finally {
    await banc.close()
  }
})

test('l’administration lit les paliers sur les vraies épreuves — et un profil supprimé emporte ses vies et ses acquis', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(60, { categories: ['Nature', 'Sport'] }) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const max = await inscrireProfil(banc.url, 'max', 'Max', '🦉')
    // Léa : le premier palier du premier coup. Bob : un échec, puis validé.
    await epreuve(banc, lea, 'foret', 1, 16)
    await epreuve(banc, bob, 'foret', 1, 0)
    await epreuve(banc, bob, 'foret', 1, 14)
    // Un rejeu ne risque rien : il ne dit rien d'un premier essai, et se compte
    // à part. Léa rejoue le sien et le rate ; Max, qui tenait la forêt de ses
    // portraits d'avant (la reprise), y joue le premier palier pour la première
    // fois — un rejeu aussi, que l'administrateur ne voyait nulle part (le
    // propriétaire, le 5 octobre 2026).
    await epreuve(banc, lea, 'foret', 1, 0)
    const maxId = (await lire(banc, max, '/api/joueur/moi')).corps.profile.id as string
    base(banc, db => db.prepare(`INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, 'foret', 2, 1)`).run(maxId))
    assert.equal((await epreuve(banc, max, 'foret', 1, 16)).epreuve.rejeu, true)

    const toutes = await lire(banc, admin, '/api/admin/campagne/sentiers')
    assert.equal(toutes.status, 200, toutes.corps.error)
    const p1 = toutes.corps.paliers[0]
    assert.deepEqual(
      { palier: p1.palier, joueurs: p1.joueurs, essais: p1.essais, premierEssai: p1.premierEssai, viesAvantDeValider: p1.viesAvantDeValider, rejeux: p1.rejeux, rejeuxValides: p1.rejeuxValides },
      { palier: 1, joueurs: 2, essais: 3, premierEssai: 0.5, viesAvantDeValider: 0.5, rejeux: 2, rejeuxValides: 1 },
    )
    assert.deepEqual([toutes.corps.paliers[1].essais, toutes.corps.paliers[1].premierEssai, toutes.corps.paliers[1].rejeux], [0, null, 0], 'personne au deuxième')
    assert.deepEqual([toutes.corps.semaine.joueurs, toutes.corps.semaine.epreuves, toutes.corps.branche], [3, 5, null])
    // Une seule branche : celle qu'on demande.
    const stade = await lire(banc, admin, '/api/admin/campagne/sentiers?branche=stade')
    assert.deepEqual([stade.corps.branche, stade.corps.paliers[0].essais], ['stade', 0])
    // Pas pour un joueur.
    assert.notEqual((await lire(banc, lea, '/api/admin/campagne/sentiers')).status, 200)

    // Supprimé, le profil emporte ses vies achetées et ses acquis.
    const leaId = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id as string
    base(banc, db => {
      db.prepare(`INSERT INTO profile_vies (id, profile_id, nombre, prix, created_at) VALUES ('v1', ?, 2, 50, 1)`).run(leaId)
      db.prepare(`INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, 'stade', 4, 1)`).run(leaId)
    })
    const suppression = await ecrire(banc.url, `/api/admin/profils/${leaId}`, undefined, admin, 'DELETE')
    assert.equal(suppression.status, 200)
    const restes = base(banc, db =>
      ['profile_vies', 'sentier_acquis', 'campagne_series'].map(t => (db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE profile_id = ?`).get(leaId) as { n: number }).n),
    )
    assert.deepEqual(restes, [0, 0, 0])
  } finally {
    await banc.close()
  }
})

test('une ligne de palier dit ses rejeux à part — et rien de joué, elle le dit', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#campagne', origin: 'http://banc' } } })
  const { infosDuPalier } = await import(new URL('../../client/src/components/AdminCampagne.tsx', import.meta.url).href)
  const ligne = (p: Partial<StatsDuPalier>): string =>
    infosDuPalier({ palier: 1, joueurs: 0, essais: 0, premierEssai: null, viesAvantDeValider: null, rejeux: 0, rejeuxValides: 0, ...p })
  assert.equal(ligne({}), 'Aucune épreuve')
  // Le palier repris des portraits d'avant, joué pour la première fois : on le voit.
  assert.equal(ligne({ rejeux: 1, rejeuxValides: 1 }), '1 rejeu, validé')
  assert.equal(ligne({ rejeux: 1 }), '1 rejeu, raté')
  assert.equal(ligne({ rejeux: 2 }), '2 rejeux, aucun validé')
  assert.equal(
    ligne({ joueurs: 2, essais: 3, premierEssai: 0.5, viesAvantDeValider: 0.5, rejeux: 3, rejeuxValides: 2 }),
    '2 joueurs · 3 essais · 0,5 vie perdue avant de valider · 3 rejeux, 2 validés',
  )
})
