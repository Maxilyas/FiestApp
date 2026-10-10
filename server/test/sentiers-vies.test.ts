// Les vies des sentiers du savoir : douze par jour pour tous les sentiers,
// rendues à minuit (Paris), sans s'additionner d'un jour à l'autre ; au-delà,
// des vies achetées en confettis, qui attendent dans une réserve et ne
// périment pas. Rejouer un palier validé ne coûte rien, même sans vie. Et
// l'administration lit les paliers sur les vraies épreuves — ceux qui y
// échouent compris —, les rejeux à part.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import React from 'react'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import {
  CONFETTIS_DES_ETOILES,
  PRIX_D_UNE_VIE,
  QUESTIONS_PAR_EPREUVE,
  SEUIL_DES_PALIERS,
  VIES_PAR_ACHAT_MAX,
  VIES_PAR_JOUR,
  lectureDuPalier,
  type StatsDuPalier,
} from '../../shared/sentiers'

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
    // Le premier palier validé à douze, pour avoir de quoi rejouer : douze
    // confettis — une étoile, qui ne paie pas (`CONFETTIS_DES_ETOILES`).
    assert.equal((await epreuve(banc, lea, 'foret', 1, 12)).epreuve.issue, 'validee')

    // Pas assez de confettis : l'achat le dit, en clair.
    const cher = await poster(banc, lea, '/api/campagne/vies', { nombre: 1 })
    assert.equal(cher.status, 400)
    assert.equal(cher.corps.error, `Il te manque ${PRIX_D_UNE_VIE - 12} confettis pour une vie`)
    assert.equal((await poster(banc, lea, '/api/campagne/vies', { nombre: VIES_PAR_ACHAT_MAX + 1 })).corps.error, `Choisis de 1 à ${VIES_PAR_ACHAT_MAX} vies`)
    assert.equal((await poster(banc, lea, '/api/campagne/vies', { nombre: 1.5 })).corps.error, `Choisis de 1 à ${VIES_PAR_ACHAT_MAX} vies`)

    // Un rejeu sans faute : seize confettis de plus, et ses trois étoiles en
    // paient vingt-cinq — le prix d'une vie.
    const sansFaute = await epreuve(banc, lea, 'foret', 1, 16)
    assert.deepEqual([sansFaute.epreuve.rejeu, sansFaute.etoiles, sansFaute.confettisDesEtoiles], [true, 3, CONFETTIS_DES_ETOILES[3]])
    const achat = await poster(banc, lea, '/api/campagne/vies', { nombre: 1 })
    assert.equal(achat.status, 200, achat.corps.error)
    assert.deepEqual([achat.corps.vies.jour, achat.corps.vies.reserve, achat.corps.confettis], [VIES_PAR_JOUR, 1, 12 + 16 + CONFETTIS_DES_ETOILES[3] - PRIX_D_UNE_VIE])
    // Trois étoiles encore : la même note ne paie pas deux fois.
    const encore = await epreuve(banc, lea, 'foret', 1, 16)
    assert.deepEqual([encore.etoiles, encore.confettisDesEtoiles], [3, undefined])

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

test('l’administration lit les paliers sur les vraies épreuves, ceux qui échouent compris — et un profil supprimé emporte ses vies et ses acquis', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(60, { categories: ['Nature', 'Sport'] }) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const max = await inscrireProfil(banc.url, 'max', 'Max', '🦉')
    // Léa : les deux premiers paliers du premier coup. Bob : un échec, puis
    // le premier validé ; au deuxième, trois échecs et un abandon. C'est le
    // cas que le propriétaire a lu le 5 octobre 2026 : « 0,0 vie perdue avant
    // de valider » sur un palier où l'un avait validé du premier coup
    // pendant que l'autre y laissait ses vies.
    await epreuve(banc, lea, 'foret', 1, 16)
    await epreuve(banc, bob, 'foret', 1, 0)
    await epreuve(banc, bob, 'foret', 1, 14)
    await epreuve(banc, lea, 'foret', 2, 16)
    for (let i = 0; i < 3; i++) assert.equal((await epreuve(banc, bob, 'foret', 2, 0)).epreuve.issue, 'ratee')
    const quittee = (await poster(banc, bob, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 2 })).corps
    const faute = (bonneDe(quittee.question) + 1) % quittee.question.reponses.length
    assert.equal((await poster(banc, bob, `/api/campagne/epreuve/${quittee.id}/reponse`, { index: 0, choix: faute })).status, 200)
    assert.equal((await poster(banc, bob, `/api/campagne/epreuve/${quittee.id}/abandon`)).status, 200)
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
    const [p1, p2, p3] = toutes.corps.paliers as StatsDuPalier[]
    // Une faute de trop arrête l'épreuve : Bob, sans une bonne réponse, s'arrête à la septième question.
    const chute = QUESTIONS_PAR_EPREUVE - SEUIL_DES_PALIERS + 1
    assert.deepEqual(p1, {
      palier: 1,
      joueurs: 2,
      valides: 2,
      premierCoup: 1,
      essais: 3,
      echecsDesBloques: 0,
      abandons: 0,
      questions: 16 + chute + 16,
      justes: 16 + 0 + 14,
      seuils: [{ seuil: SEUIL_DES_PALIERS, essais: 3, validees: 2 }],
      enAttente: 0,
      rejeux: 2,
      rejeuxValides: 1,
    })
    // Bob reste au deuxième : ses quatre échecs comptent, abandon compris, et ne disparaissent pas derrière le premier coup de Léa.
    assert.deepEqual(p2, {
      palier: 2,
      joueurs: 2,
      valides: 1,
      premierCoup: 1,
      essais: 5,
      echecsDesBloques: 4,
      abandons: 1,
      questions: 16 + 3 * chute + 1,
      justes: 16,
      seuils: [{ seuil: SEUIL_DES_PALIERS, essais: 5, validees: 1 }],
      enAttente: 0,
      rejeux: 0,
      rejeuxValides: 0,
    })
    assert.deepEqual(lectureDuPalier(p2), {
      bloques: 1,
      passent: 0.5,
      premierEssai: 0.5,
      parEssai: 0.2,
      essaisPourValider: 1,
      echecsParBloque: 4,
      viesPerdues: 4,
      bonnesReponses: 16 / (16 + 3 * chute + 1),
    })
    // Au troisième, personne n'a joué : Léa l'attend, et Max, que la reprise y a posé.
    assert.deepEqual([p3.joueurs, p3.essais, p3.enAttente], [0, 0, 2])
    // Les bonnes réponses par marche couvrent toutes les épreuves, hors rejeux.
    const niveaux = toutes.corps.niveaux as { niveau: string; questions: number; justes: number }[]
    assert.deepEqual(niveaux.map(n => n.niveau), ['facile', 'moyen', 'difficile', 'expert'])
    assert.deepEqual(
      [niveaux.reduce((n, x) => n + x.questions, 0), niveaux.reduce((n, x) => n + x.justes, 0)],
      [p1.questions + p2.questions, p1.justes + p2.justes],
    )
    // Les plus bloqués, nommés : Bob, sur le deuxième.
    assert.deepEqual(
      toutes.corps.bloques.map((x: any) => [x.prenom, x.branche, x.palier, x.echecs]),
      [['Bob', 'foret', 2, 4]],
    )
    assert.deepEqual(toutes.corps.semaine, { joueurs: 3, epreuves: 10, viesAchetees: 0, viesPerdues: 5, paliersValides: 3 })
    assert.equal(toutes.corps.branche, null)
    // Une seule branche : celle qu'on demande.
    const stade = await lire(banc, admin, '/api/admin/campagne/sentiers?branche=stade')
    assert.deepEqual([stade.corps.branche, stade.corps.paliers[0].essais, stade.corps.bloques], ['stade', 0, []])
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

test('une ligne de palier dit qui passe et qui reste bloqué, l’effort, chaque seuil — et ses rejeux à part', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#campagne', origin: 'http://banc' } } })
  const { progressionDuPalier, effortDuPalier, parEssaiAuSeuil } = await import(new URL('../../client/src/components/AdminCampagne.tsx', import.meta.url).href)
  const p = (x: Partial<StatsDuPalier>): StatsDuPalier => ({
    palier: 1,
    joueurs: 0,
    valides: 0,
    premierCoup: 0,
    essais: 0,
    echecsDesBloques: 0,
    abandons: 0,
    questions: 0,
    justes: 0,
    seuils: [],
    enAttente: 0,
    rejeux: 0,
    rejeuxValides: 0,
    ...x,
  })
  assert.equal(progressionDuPalier(p({})), 'Aucune épreuve')
  assert.equal(effortDuPalier(p({}), 10), '')
  // L'un valide du premier coup, l'autre échoue cinq fois : la ligne dit les
  // deux. Elle disait « 0,0 vie perdue avant de valider ».
  const mur = p({ joueurs: 2, valides: 1, premierCoup: 1, essais: 6, echecsDesBloques: 5, questions: 60, justes: 33, seuils: [{ seuil: 10, essais: 6, validees: 1 }] })
  assert.equal(progressionDuPalier(mur), '2 joueurs · 1 l’a validé, 1 du premier coup · 1 bloqué (5 échecs)')
  assert.equal(effortDuPalier(mur, 10), '6 essais, 1 pour valider · 55 % de bonnes réponses')
  assert.equal(parEssaiAuSeuil(mur, 10), 1 / 6)
  assert.equal(parEssaiAuSeuil(mur, 12), null, 'personne à l’autre seuil')
  // Plusieurs bloqués : leurs échecs en moyenne. Personne n'a validé : on le dit.
  assert.equal(progressionDuPalier(p({ joueurs: 3, essais: 7, echecsDesBloques: 7 })), '3 joueurs · aucun ne l’a validé · 3 bloqués (2,3 échecs chacun)')
  // Un seuil d'avant se lit à côté : la chance d'un essai à douze sur seize.
  const avant = p({ joueurs: 4, valides: 3, premierCoup: 1, essais: 9, echecsDesBloques: 2, abandons: 2, seuils: [{ seuil: 12, essais: 6, validees: 1 }, { seuil: 10, essais: 3, validees: 2 }] })
  assert.equal(effortDuPalier(avant, 10), '9 essais, 2,3 pour valider · 2 abandons · à 12/16 : 17 % par essai (6 essais)')
  // Ceux qui l'attendent sans l'avoir tenté.
  assert.equal(progressionDuPalier(p({ enAttente: 1 })), '1 l’attend sans l’avoir tenté')
  assert.equal(progressionDuPalier(p({ joueurs: 1, valides: 1, premierCoup: 1, essais: 1, enAttente: 3 })), '1 joueur · 1 l’a validé, 1 du premier coup · 3 l’attendent sans l’avoir tenté')
  // Le palier repris des portraits d'avant, joué pour la première fois : on le voit.
  assert.equal(effortDuPalier(p({ rejeux: 1, rejeuxValides: 1 }), 10), '1 rejeu, validé')
  assert.equal(effortDuPalier(p({ rejeux: 1 }), 10), '1 rejeu, raté')
  assert.equal(effortDuPalier(p({ rejeux: 2 }), 10), '2 rejeux, aucun validé')
  assert.equal(effortDuPalier(p({ joueurs: 2, valides: 2, premierCoup: 1, essais: 3, rejeux: 3, rejeuxValides: 2 }), 10), '3 essais, 1,5 pour valider · 3 rejeux, 2 validés')
})
