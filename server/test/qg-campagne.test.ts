// La campagne au QG (`/admin#campagne`, les choix du 13 octobre 2026) : le
// mélange d'un palier réglé depuis le QG — pour les épreuves qui commencent,
// jamais celles en cours —, et ce que la page suit : les paliers du jour, le
// défi de la semaine sans jamais le tirer, les parcours de thème, les vies.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import {
  ESSAIS_POUR_CROIRE,
  REPONSES_POUR_ESTIMER,
  TAUX_DU_CALIBRAGE,
  chanceDeValider,
  difficulteDuMelange,
  estimationDuMelange,
  marcheMoyenne,
  melangePropre,
  memeMelange,
  refusDuMelange,
  regleDuPalier,
  tauxDuPalier,
  type AdminDesSentiers,
} from '../../shared/sentiers'
import { JOURS_DU_QG, minuitsDeParis, type VueDEnsemble } from '../../shared/qg'
import {
  campagneDeLaVue,
  lesPlusRatees,
  medianeDesScores,
  viesAcheteesParJour,
  viesPerduesParJour,
  type SuiviDeLaCampagne,
} from '../../shared/qgCampagne'

ProfileStore.tirageEclat = () => false

/** Mardi 13 octobre 2026, 10 h à Paris (UTC+2) : la semaine du défi est celle du lundi 12. */
const MARDI = Date.UTC(2026, 9, 13, 8, 0)
const MINUTE = 60_000

type Reponse = { status: number; corps: any }
const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}): Promise<Reponse> =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: await r.json() }))
const bonneDe = (q: { reponses: string[] }) => q.reponses.findIndex(r => r.startsWith('Bonne'))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Les marches qu'une épreuve pose, lues dans les questions qu'elle a tirées. */
function marchesDe(banc: Banc, serie: string): Record<string, number> {
  const questions = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)) as {
    niveau: string
  }[]
  const parMarche: Record<string, number> = {}
  for (const q of questions) parMarche[q.niveau] = (parMarche[q.niveau] ?? 0) + 1
  return parMarche
}

/** Répond à une épreuve commencée : `justes` bonnes réponses d'abord, des fautes ensuite, jusqu'à sa fin. */
async function finir(banc: Banc, cookie: string, epreuve: any, justes: number): Promise<any> {
  let e = epreuve
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

async function epreuve(banc: Banc, cookie: string, branche: string, palier: number, justes: number): Promise<any> {
  const debut = await poster(banc, cookie, '/api/campagne/sentiers/epreuve', { branche, palier })
  assert.equal(debut.status, 200, debut.corps.error)
  return finir(banc, cookie, debut.corps, justes)
}

/** Relève le défi de la semaine : `fautes` dit les questions qu'il rate — la troisième l'arrête ; `jusqua` le laisse en route. */
async function relever(banc: Banc, cookie: string, fautes: readonly number[], jusqua = Infinity) {
  const serie = (await poster(banc, cookie, '/api/campagne/defi')).corps
  assert.ok(serie.id, serie.error)
  const questions = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie.id) as { questions: string }).questions)) as {
    bonne: number
    reponses: string[]
  }[]
  let finie = false
  for (let i = serie.question.index; !finie && i < jusqua; i++) {
    const q = questions[i]
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: fautes.includes(i) ? (q.bonne + 1) % q.reponses.length : q.bonne })
    assert.equal(r.status, 200, r.corps.error)
    finie = Boolean(r.corps.finie)
  }
}

const suiviDe = async (banc: Banc, admin: string) => {
  const r = await lire<SuiviDeLaCampagne>(banc, admin, '/api/admin/campagne/suivi')
  assert.equal(r.status, 200)
  return r.corps
}

test('un mélange se règle sur ce que les joueurs trouvent vraiment : seize questions, jamais d’experte, le maître à part', () => {
  // Le calcul du calibrage : le cinquième palier du code, pour un joueur moyen.
  assert.equal(Math.round(chanceDeValider({ facile: 7, moyen: 9 }, 10, TAUX_DU_CALIBRAGE) * 100), 79)
  assert.equal(Math.round(chanceDeValider({ moyen: 3, difficile: 13 }, 10, TAUX_DU_CALIBRAGE) * 100), 2)

  // Sous dix épreuves, rien ne fonde un taux ; au-delà, un seul décalage pour toutes les marches.
  assert.equal(tauxDuPalier([{ niveau: 'facile', questions: REPONSES_POUR_ESTIMER - 1, justes: 100 }]), null)
  const calibres = tauxDuPalier([
    { niveau: 'facile', questions: 100, justes: 85 },
    { niveau: 'moyen', questions: 100, justes: 55 },
  ])!
  for (const n of ['facile', 'moyen', 'difficile', 'expert'] as const) assert.ok(Math.abs(calibres[n] - TAUX_DU_CALIBRAGE[n]) < 1e-6, n)
  const forts = tauxDuPalier([
    { niveau: 'facile', questions: 100, justes: 95 },
    { niveau: 'moyen', questions: 100, justes: 80 },
  ])!
  assert.ok(forts.difficile > TAUX_DU_CALIBRAGE.difficile, 'une marche qu’il ne pose pas se déduit des autres')

  // L'estimation part de la chance mesurée : un même mélange la redonne, telle quelle.
  const reponses = [
    { niveau: 'facile' as const, questions: 112, justes: 100 },
    { niveau: 'moyen' as const, questions: 144, justes: 100 },
  ]
  const reference = { melange: { facile: 7, moyen: 9 }, parEssai: 0.52, essais: 40 }
  assert.deepEqual(estimationDuMelange(reference, { moyen: 9, facile: 7 }, 10, reponses), { chance: 0.52, sur: 'mesures' })
  const plusFacile = estimationDuMelange(reference, { facile: 9, moyen: 7 }, 10, reponses)
  const plusDur = estimationDuMelange(reference, { facile: 5, moyen: 9, difficile: 2 }, 10, reponses)
  assert.equal(plusFacile.sur, 'mesures')
  assert.equal(Math.round(plusFacile.chance * 100), 71)
  assert.equal(Math.round(plusDur.chance * 100), 23)
  // Trop peu d'essais : le calcul seul, pour un joueur moyen.
  const peu = estimationDuMelange({ ...reference, essais: ESSAIS_POUR_CROIRE - 1 }, { facile: 9, moyen: 7 }, 10, reponses)
  assert.deepEqual(peu, { chance: chanceDeValider({ facile: 9, moyen: 7 }, 10, TAUX_DU_CALIBRAGE), sur: 'calcul' })
  // Une chance mesurée de 100 % garde une cote : un mélange plus dur la fait descendre.
  assert.ok(estimationDuMelange({ ...reference, parEssai: 1 }, { facile: 5, moyen: 11 }, 10, reponses).chance < 1)

  // Ce qui se règle, et ce qui ne se règle pas.
  assert.equal(refusDuMelange(5, { facile: 10, moyen: 6 }), null)
  assert.equal(refusDuMelange(5, { facile: 16, expert: 0 }), null, 'une marche à zéro ne pose rien')
  assert.match(refusDuMelange(13, { facile: 16 })!, /maître garde ses seize expertes/)
  assert.match(refusDuMelange(0, { facile: 16 })!, /n’existe pas/)
  assert.match(refusDuMelange(5, { facile: 10, expert: 6 })!, /Pas d’experte/)
  assert.match(refusDuMelange(5, { facile: 15 })!, /ce mélange en a 15/)
  assert.match(refusDuMelange(5, { facile: 15.5, moyen: 0.5 })!, /entier/)
  assert.match(refusDuMelange(5, { facile: 10, enorme: 6 })!, /facile, moyenne ou difficile/)
  assert.match(refusDuMelange(5, [16])!, /combien de questions/)
  assert.deepEqual(melangePropre({ difficile: 2, facile: 14, moyen: 0 }), { facile: 14, difficile: 2 })
  assert.ok(memeMelange({ facile: 16 }, { facile: 16, moyen: 0 }))

  // Réglé, un palier lit son mélange ; ni son seuil ni son portrait ne bougent.
  const regle = regleDuPalier(5, { 5: { facile: 4, moyen: 12 } })!
  assert.deepEqual([regle.melange, regle.seuil, regle.avatar], [{ facile: 4, moyen: 12 }, regleDuPalier(5)!.seuil, regleDuPalier(5)!.avatar])
  assert.deepEqual(regleDuPalier(5)!.melange, { facile: 7, moyen: 9 })
  assert.equal(difficulteDuMelange(regle.melange), 'moyen')
  assert.ok(marcheMoyenne({ facile: 4, moyen: 12 }) > marcheMoyenne(regleDuPalier(5)!.melange))
})

test('la campagne jour par jour, les vies prises dans la réserve, le défi en chiffres : des dérivations pures', () => {
  const maintenant = Date.UTC(2026, 9, 13, 19, 4)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
  const aujourdhui = minuits.at(-1)!
  const hier = minuits.at(-2)!
  const vue = campagneDeLaVue(
    [
      { quand: aujourdhui + MINUTE, qui: 'lea', mode: 'sentier' },
      { quand: aujourdhui + 2 * MINUTE, qui: 'lea', mode: 'sentier' },
      { quand: aujourdhui + 3 * MINUTE, qui: 'bob', mode: null },
      { quand: aujourdhui + 4 * MINUTE, qui: 'bob', mode: 'duel' },
      { quand: hier + MINUTE, qui: 'cleo', mode: 'defi' },
      { quand: maintenant + MINUTE, qui: 'dan', mode: 'serie' },
    ],
    minuits,
    maintenant,
  )
  assert.equal(vue.parJour.length, JOURS_DU_QG)
  assert.deepEqual(vue.parJour.at(-1)!.modes, { serie: 1, sentier: 2, sujet: 0, revision: 0, defi: 0 }, 'une série d’avant les modes en est une ; un duel n’est pas de la campagne')
  assert.deepEqual(vue.parJour.at(-2)!.modes.defi, 1)
  assert.deepEqual(vue.aujourdhui.sentier, { parties: 2, joueurs: 1 })
  assert.equal(vue.joueurs.aujourdhui, 2)

  // Douze vies par jour à chacun : quatorze perdues par Léa en prennent deux à la réserve, celle de Bob aucune.
  const echecs = [...Array.from({ length: 14 }, (_, i) => ({ qui: 'lea', quand: aujourdhui + i * MINUTE })), { qui: 'bob', quand: aujourdhui + 5 }, { qui: 'bob', quand: hier + 5 }]
  const vies = viesPerduesParJour(echecs, minuits, maintenant)
  assert.deepEqual([vies.perdues.at(-1), vies.auDela.at(-1), vies.perdues.at(-2), vies.auDela.at(-2)], [15, 2, 1, 0])
  const achats = viesAcheteesParJour(
    [
      { quand: aujourdhui + 5, nombre: 2, prix: 50 },
      { quand: minuits[0] - 1, nombre: 9, prix: 225 },
    ],
    minuits,
    maintenant,
  )
  assert.deepEqual([achats.achetees.at(-1), achats.confettis], [2, 50], 'un achat d’avant les trente jours ne compte pas')

  assert.equal(medianeDesScores([0, 1, 0, 2]), 3)
  assert.equal(medianeDesScores([1, 1]), 0.5, 'deux tentatives : la moyenne des deux')
  assert.equal(medianeDesScores([]), null)
  const q = (index: number, reponses: number, justes: number) => ({ index, texte: `Question ${index}`, categorie: null, reponses, justes })
  assert.deepEqual(
    lesPlusRatees([q(0, 5, 4), q(1, 5, 1), q(2, 4, 0), q(3, 8, 2), q(4, 10, 6)]).map(x => x.index),
    [1, 3, 4],
    'sur cinq réponses au moins : une seule faute ne fait pas la plus ratée',
  )
})

test('le mélange réglé vaut pour les épreuves qui commencent ; celle en cours garde ses questions, et le geste se note', async () => {
  const horloge = { t: MARDI }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(80, { categories: ['Nature'] }) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const [lea, bob] = await Promise.all([inscrireProfil(banc.url, 'lea', 'Léa', '🦊'), inscrireProfil(banc.url, 'bob', 'Bob', '🐻')])

    // Léa commence le premier palier avant le réglage : seize faciles.
    const avant = await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 })
    assert.equal(avant.status, 200, avant.corps.error)
    assert.deepEqual(marchesDe(banc, avant.corps.id), { facile: 16 })

    horloge.t += MINUTE
    const regle = await poster(banc, admin, '/api/admin/campagne/paliers/1/melange', { melange: { moyen: 6, facile: 10 } })
    assert.equal(regle.status, 200, regle.corps.error)
    assert.deepEqual(regle.corps, { palier: 1, avant: { facile: 16 }, apres: { facile: 10, moyen: 6 }, origine: false })

    // L'épreuve de Léa garde ses questions ; celle de Bob tire le mélange réglé.
    assert.deepEqual(marchesDe(banc, avant.corps.id), { facile: 16 })
    const apres = await poster(banc, bob, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 })
    assert.equal(apres.status, 200, apres.corps.error)
    assert.deepEqual(marchesDe(banc, apres.corps.id), { facile: 10, moyen: 6 })
    assert.equal((await finir(banc, bob, apres.corps, 16)).epreuve.issue, 'validee')
    assert.equal((await finir(banc, lea, avant.corps, 0)).epreuve.issue, 'ratee')

    // Les joueurs lisent la difficulté du palier sur le mélange réglé.
    const etat = (await lire(banc, lea, '/api/campagne/sentiers')).corps
    assert.deepEqual(etat.melanges, { 1: { facile: 10, moyen: 6 } })
    assert.equal(difficulteDuMelange(regleDuPalier(1, etat.melanges)!.melange), 'facile à moyen')

    // Ce que le QG en dit : le réglage, et ce que ses épreuves en ont fait depuis — celle de Léa, commencée avant, n'en est pas.
    const sentiers = (await lire<AdminDesSentiers>(banc, admin, '/api/admin/campagne/sentiers')).corps
    assert.deepEqual(sentiers.reglages, [{ palier: 1, melange: { facile: 10, moyen: 6 }, regleLe: MARDI + MINUTE, essais: 1, validees: 1 }])
    assert.ok(sentiers.niveauxParPalier.some(x => x.palier === 1 && x.niveau === 'moyen' && x.questions === 6 && x.justes === 6))
    assert.equal(sentiers.paliers[0].essais, 2, 'les trois mois mêlent l’ancien mélange et le nouveau')

    // Ce qui ne se règle pas se refuse, et un refus ne se note pas.
    for (const [chemin, corps, motif] of [
      ['/api/admin/campagne/paliers/13/melange', { melange: { facile: 16 } }, /maître garde ses seize expertes/],
      ['/api/admin/campagne/paliers/14/melange', { melange: { facile: 16 } }, /n’existe pas/],
      ['/api/admin/campagne/paliers/deux/melange', { melange: null }, /n’existe pas/],
      ['/api/admin/campagne/paliers/2/melange', { melange: { facile: 10, expert: 6 } }, /Pas d’experte/],
      ['/api/admin/campagne/paliers/2/melange', { melange: { facile: 15 } }, /ce mélange en a 15/],
      ['/api/admin/campagne/paliers/2/melange', {}, /combien de questions/],
      ['/api/admin/campagne/paliers/1/melange', { melange: { facile: 10, moyen: 6 } }, /déjà ce mélange/],
      ['/api/admin/campagne/paliers/2/melange', { melange: null }, /déjà son mélange d’origine/],
    ] as const) {
      const r = await poster(banc, admin, chemin, corps)
      assert.equal(r.status, 400, `${chemin} ${JSON.stringify(corps)}`)
      assert.match(r.corps.error, motif)
    }

    // Un redémarrage le relit.
    await banc.redemarrer()
    assert.deepEqual((await lire(banc, bob, '/api/campagne/sentiers')).corps.melanges, { 1: { facile: 10, moyen: 6 } })

    // Le mélange du code, réglé tel quel : le palier y revient.
    horloge.t += MINUTE
    const retour = await poster(banc, admin, '/api/admin/campagne/paliers/1/melange', { melange: { facile: 16 } })
    assert.deepEqual(retour.corps, { palier: 1, avant: { facile: 10, moyen: 6 }, apres: { facile: 16 }, origine: true })
    assert.equal((await lire(banc, bob, '/api/campagne/sentiers')).corps.melanges, undefined, 'plus rien de réglé : la page lit le code')
    // Et « Revenir au mélange d'origine » défait un réglage.
    horloge.t += MINUTE
    assert.equal((await poster(banc, admin, '/api/admin/campagne/paliers/7/melange', { melange: { moyen: 12, facile: 4 } })).status, 200)
    horloge.t += MINUTE
    assert.equal((await poster(banc, admin, '/api/admin/campagne/paliers/7/melange', { melange: null })).status, 200)
    assert.deepEqual((await lire<AdminDesSentiers>(banc, admin, '/api/admin/campagne/sentiers')).corps.reglages, [])

    // Le journal : une phrase par réglage, avec l'ancien mélange et le nouveau, sous le palier qu'il vise.
    const journal = (await lire(banc, admin, '/api/admin/gestes?sorte=campagne')).corps
    assert.deepEqual(
      journal.gestes.map((g: { resume: string; cible: string | null }) => [g.resume, g.cible]),
      [
        ['Palier 7 des sentiers rendu à son mélange d’origine : 4 faciles et 12 moyennes → 16 moyennes', 'palier:7'],
        ['Mélange du palier 7 des sentiers réglé : 16 moyennes → 4 faciles et 12 moyennes', 'palier:7'],
        ['Palier 1 des sentiers rendu à son mélange d’origine : 10 faciles et 6 moyennes → 16 faciles', 'palier:1'],
        ['Mélange du palier 1 des sentiers réglé : 16 faciles → 10 faciles et 6 moyennes', 'palier:1'],
      ],
    )
  } finally {
    await banc.close()
  }
})

test('le suivi de la campagne : les paliers du jour, le défi sans jamais le tirer, les parcours, les vies', async () => {
  const horloge = { t: MARDI }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(160, { categories: ['Histoire', 'Nature'] }) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const noms = ['lea', 'bob', 'cleo', 'dan', 'eve', 'fanny']
    const cookies = await Promise.all(noms.map((login, i) => inscrireProfil(banc.url, login, login[0].toUpperCase() + login.slice(1), ['🦊', '🐻', '🐝', '🐼', '🦉', '🐙'][i])))
    const [lea, bob, cleo, dan, eve, fanny] = cookies
    const ids = Object.fromEntries(noms.map(n => [n, idDe(banc, n)]))

    // La semaine d'avant : un défi que personne n'a encore clos.
    base(banc, db => {
      db.prepare('INSERT INTO campagne_defis (semaine, questions, tire_le) VALUES (?, ?, ?)').run('2026-10-05', '[]', MARDI - 7 * 24 * 60 * MINUTE)
      const tentative = db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, semaine) VALUES (?, ?, '[]', 5, 0, ?, ?, ?, 'defi', '2026-10-05')`,
      )
      tentative.run('avant-lea', ids.lea, 4, MARDI - 6 * 24 * 60 * MINUTE, MARDI - 6 * 24 * 60 * MINUTE + MINUTE)
      tentative.run('avant-bob', ids.bob, 2, MARDI - 6 * 24 * 60 * MINUTE, MARDI - 6 * 24 * 60 * MINUTE + MINUTE)
      // Des parcours de thème : Bob finit les animaux, Léa en valide une étape deux fois ; une étape d'il y a deux mois ne compte pas.
      const etape = db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, sujet, palier, issue) VALUES (?, ?, '[]', 10, 0, 8, ?, ?, 'sujet', ?, ?, ?)`,
      )
      for (let p = 1; p <= 6; p++) etape.run(`bob-${p}`, ids.bob, MARDI - 3 * 60 * MINUTE, MARDI - 3 * 60 * MINUTE + MINUTE, 'animaux', p, 'validee')
      etape.run('lea-1', ids.lea, MARDI - 2 * 60 * MINUTE, MARDI - 2 * 60 * MINUTE, 'animaux', 1, 'validee')
      etape.run('lea-1-bis', ids.lea, MARDI - 60 * MINUTE, MARDI - 60 * MINUTE, 'animaux', 1, 'validee')
      etape.run('lea-2', ids.lea, MARDI - 30 * MINUTE, MARDI - 30 * MINUTE, 'animaux', 2, 'ratee')
      etape.run('cleo-1', ids.cleo, MARDI - 30 * MINUTE, MARDI - 30 * MINUTE, 'avant-1800', 1, 'ratee')
      etape.run('dan-vieux', ids.dan, MARDI - 60 * 24 * 60 * MINUTE, MARDI - 60 * 24 * 60 * MINUTE, 'xixe', 1, 'validee')
    })
    // Un serveur neuf : celui-ci a déjà clos la semaine passée — vide alors — à la première lecture d'un laurier, une fois par semaine.
    await banc.redemarrer()

    let suivi = await suiviDe(banc, admin)
    assert.equal(suivi.defi.semaine, '2026-10-12')
    assert.deepEqual([suivi.defi.tire, suivi.defi.joueurs, suivi.defi.meilleur, suivi.defi.scores], [false, 0, null, []])
    assert.equal(base(banc, db => db.prepare("SELECT COUNT(*) AS n FROM campagne_defis WHERE semaine = '2026-10-12'").get() as { n: number }).n, 0, 'le QG ne tire pas le défi')
    assert.deepEqual(suivi.defi.passee, { semaine: '2026-10-05', joueurs: 2, vainqueurs: null }, 'personne n’a encore clos la semaine passée')
    assert.deepEqual(suivi.parcours, {
      lignes: [
        { sujet: 'animaux', nom: 'Les animaux', joueurs: 2, etapes: 7, finis: 1 },
        { sujet: 'avant-1800', nom: 'Avant 1800', joueurs: 1, etapes: 0, finis: 0 },
      ],
      commences: 3,
      sujets: 2,
    })
    assert.deepEqual(suivi.paliers, { valides: 0, premierCoup: 0 })

    // Le défi : cinq tentatives finies — chacune à sa troisième faute —, une en route ; une minute entre chaque.
    for (const [cookie, fautes, jusqua] of [
      [lea, [1, 4, 5]],
      [bob, [1, 2, 4]],
      [cleo, [0, 1, 2]],
      [dan, [1, 3, 5]],
      [eve, [4, 5, 6]],
      [fanny, [], 1],
    ] as const) {
      await relever(banc, cookie, fautes, jusqua)
      horloge.t += MINUTE
    }

    // Les sentiers : Léa valide le premier palier du premier coup, Bob après un échec, puis il s'achète une vie.
    assert.equal((await epreuve(banc, lea, 'foret', 1, 16)).epreuve.issue, 'validee')
    assert.equal((await epreuve(banc, bob, 'foret', 1, 0)).epreuve.issue, 'ratee')
    horloge.t += MINUTE
    assert.equal((await epreuve(banc, bob, 'foret', 1, 16)).epreuve.issue, 'validee')
    // Son achat, écrit à l'heure du banc : le profil date ses achats à l'horloge de la machine.
    base(banc, db => db.prepare('INSERT INTO profile_vies (id, profile_id, nombre, prix, created_at) VALUES (?, ?, 1, 25, ?)').run('achat-bob', ids.bob, horloge.t))

    suivi = await suiviDe(banc, admin)
    const d = suivi.defi
    assert.deepEqual([d.tire, d.joueurs, d.finies], [true, 6, 5])
    assert.deepEqual(d.scores, [1, 0, 1, 2, 1], 'trois, deux, aucune, trois, quatre bonnes réponses')
    assert.equal(medianeDesScores(d.scores), 3)
    assert.deepEqual([d.meilleur?.nom, d.meilleur?.justes, d.meilleur?.exAequo], ['Eve', 4, 0])
    assert.equal(typeof d.meilleur?.quand, 'number')
    assert.deepEqual(
      d.ratees.map(q => [q.index, q.reponses, q.justes]),
      [
        [1, 5, 1],
        [2, 5, 3],
        [0, 6, 5],
      ],
      'la question 4 n’a que quatre réponses : elle ne se juge pas encore',
    )
    assert.ok(d.ratees.every(q => q.texte.startsWith('Question d')))
    assert.deepEqual(suivi.paliers, { valides: 2, premierCoup: 1 })

    // Les trente jours se gardent dix minutes : une vie perdue ou achetée n'y paraît pas encore.
    assert.equal(suivi.vies.perdues.at(-1), 0)
    horloge.t += 11 * MINUTE
    suivi = await suiviDe(banc, admin)
    assert.deepEqual([suivi.vies.perdues.at(-1), suivi.vies.auDela.at(-1), suivi.vies.achetees.at(-1)], [1, 0, 1])
    assert.equal(suivi.vies.confettis, 25)
    assert.equal(suivi.jours.length, JOURS_DU_QG)

    // Masqué, un profil sort des chiffres du défi, comme de son classement.
    assert.equal((await poster(banc, admin, '/api/admin/jour/masquer', { profileId: ids.eve, masque: true })).status, 200)
    suivi = await suiviDe(banc, admin)
    assert.deepEqual([suivi.defi.joueurs, suivi.defi.finies, suivi.defi.meilleur?.nom, suivi.defi.meilleur?.exAequo], [5, 4, 'Lea', 1])
    assert.deepEqual(suivi.defi.scores, [1, 0, 1, 2])

    // Un joueur ouvre la page du défi : la semaine passée se clôt, et le QG lit ses vainqueurs.
    assert.equal((await lire(banc, lea, '/api/campagne/defi')).status, 200)
    assert.deepEqual((await suiviDe(banc, admin)).defi.passee, { semaine: '2026-10-05', joueurs: 2, vainqueurs: 1 })

    // La vue d'ensemble tient ce qu'on joue, sous-mode par sous-mode.
    const vue = (await lire<VueDEnsemble>(banc, admin, '/api/admin/qg')).corps
    assert.deepEqual(vue.campagne.aujourdhui.defi, { parties: 6, joueurs: 6 })
    assert.deepEqual(vue.campagne.aujourdhui.sentier, { parties: 3, joueurs: 2 })
    assert.deepEqual(vue.campagne.aujourdhui.sujet, { parties: 10, joueurs: 3 }, 'l’étape d’il y a deux mois n’est pas d’aujourd’hui')
  } finally {
    await banc.close()
  }
})

test('la page de la campagne au QG : ce qu’on joue, le défi en chiffres, les parcours, les vies', async () => {
  Object.assign(globalThis, { React })
  const { AujourdhuiDeLaCampagne, CeQuOnJoue, DefiDeLaSemaineAuQg, ParcoursDeThemeAuQg, ViesDesSentiersAuQg } = await import(
    new URL('../../client/src/components/QgCampagne.tsx', import.meta.url).href
  )
  const { renderToStaticMarkup } = await import('react-dom/server')
  const maintenant = Date.UTC(2026, 9, 13, 19, 4)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
  const series = minuits.flatMap((m, i) => [
    ...Array.from({ length: 40 + (i % 5) }, (_, k) => ({ quand: m + k * MINUTE, qui: `j${k}`, mode: 'serie' })),
    ...Array.from({ length: 20 }, (_, k) => ({ quand: m + k * MINUTE, qui: `j${k}`, mode: 'sentier' })),
  ])
  const vue = { campagne: campagneDeLaVue(series, minuits, maintenant), aujourdhui: { seriesDeCampagne: { aujourdhui: 64, habituel: 60, parJour: [] } } }
  const suivi: SuiviDeLaCampagne = {
    maintenant,
    jours: vue.campagne.parJour.map(j => j.jour),
    paliers: { valides: 21, premierCoup: 9 },
    defi: {
      semaine: '2026-10-12',
      tire: true,
      minutesRestantes: 4 * 24 * 60 + 300,
      joueurs: 43,
      finies: 31,
      scores: [0, 1, 1, 2, 3, 4, 6, 7, 5, 2],
      meilleur: { justes: 9, nom: 'Inès', avatar: '🦋', quand: maintenant - 3_600_000, exAequo: 1 },
      ratees: [{ index: 8, texte: 'Qui a écrit « Le Horla » ?', categorie: 'Littérature', reponses: 19, justes: 4 }],
      passee: { semaine: '2026-10-05', joueurs: 58, vainqueurs: 2 },
    },
    parcours: { lignes: [{ sujet: 'animaux', nom: 'Les animaux', joueurs: 42, etapes: 118, finis: 6 }], commences: 318, sujets: 41 },
    vies: { achetees: minuits.map((_, i) => i % 3), perdues: minuits.map(() => 60), auDela: minuits.map(() => 20), confettis: 32_100 },
  }
  const html = sansInsecables(
    renderToStaticMarkup(
      React.createElement(React.Fragment, null, [
        React.createElement(AujourdhuiDeLaCampagne, { key: 1, vue, suivi }),
        React.createElement(CeQuOnJoue, { key: 2, vue }),
        React.createElement(DefiDeLaSemaineAuQg, { key: 3, suivi }),
        React.createElement(ParcoursDeThemeAuQg, { key: 4, suivi }),
        React.createElement(ViesDesSentiersAuQg, { key: 5, suivi }),
      ]),
    ),
  )
  for (const attendu of [
    '20 sur les sentiers',
    'Paliers validés',
    '9 du premier coup',
    'Parcours de thème',
    'le carnet, à 1, 3 et 7 jours',
    'semaine du lundi 12 octobre',
    // L'avatar qu'elle porte (`AvatarEnLigne`), comme au classement du défi.
    '<span class="av-emoji">🦋</span></span> Inès et 1 autre · aujourd’hui à 20 h 04',
    '2 vainqueurs ex æquo',
    'Le plus souvent : 7 bonnes réponses · 7 tentatives',
    '9 · Qui a écrit « Le Horla » ?',
    '21 %',
    'Les animaux',
    '318 parcours commencés',
    '32 100 confettis',
    'au-delà des 12 du jour',
  ]) {
    assert.ok(html.includes(attendu), `« ${attendu} » dans la page`)
  }
  // La médiane des trente et une tentatives : la seizième, à six bonnes réponses.
  assert.match(html, /Score médian<\/span><span class="qg-tuile-valeur num">6</)
})

/** Les espaces insécables du texte, rendus ordinaires : le test lit des phrases. */
function sansInsecables(s: string): string {
  return s.replace(/[  ]/g, ' ')
}
