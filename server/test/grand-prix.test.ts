// Le Grand Prix (`core/grandPrix.ts`), couru de bout en bout sur un serveur
// jetable : le QG le programme sur le fantôme d'une joueuse — ses vraies
// réponses du quiz du jour et de la campagne, écrites ici dans la base —, une
// autre le court, le chrono au serveur, et le bat ; son flot et l'avatar en
// plus tombent une fois, la fêtée reçoit le sien, et personne d'autre ne
// porte Pégase. Les règles pures (le score, le tirage d'un parcours) sont en
// tête, sans serveur.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { GRACE_MS } from '../src/games/quiz'
import {
  OBSTACLES_DU_GRAND_PRIX,
  PENALITE_D_UNE_BARRE,
  bat,
  cleDuFlot,
  flotDe,
  scoreDe,
  tirerLeParcours,
  tirerUnRythme,
  valeurDeLaCourse,
} from '../../shared/grandPrix'
import { legendairesVisibles, PRIX_DES_GRANDS_PRIX, PREFIXES_DES_VOIES_RANGEES } from '../../shared/legendaires'
import { suiteFixe } from '../../shared/hasard'

ProfileStore.tirageEclat = () => false

// ── Les règles pures ──────────────────────────────────────────────────────

test('une barre ou un refus coûtent quatre points, et le chrono ne dépasse jamais le temps de l’obstacle', () => {
  const s = scoreDe([
    { saut: { choix: 1, juste: true, ms: 4200 }, dureeMs: 20_000 },
    { saut: { choix: 2, juste: false, ms: 6000 }, dureeMs: 20_000 },
    { saut: { choix: null, juste: false, ms: null }, dureeMs: 20_000 },
    // Livrée pendant la marge du réseau : elle ne coûte pas plus que d'avoir attendu la fin.
    { saut: { choix: 0, juste: true, ms: 21_000 }, dureeMs: 20_000 },
  ])
  assert.deepEqual(s, { points: 2 * PENALITE_D_UNE_BARRE, tempsMs: 4200 + 6000 + 20_000 + 20_000, barres: 2, sautes: 4 })
})

test('battre, c’est moins de points, ou autant et plus vite — une égalité parfaite ne bat pas', () => {
  assert.ok(bat({ points: 0, tempsMs: 90_000 }, { points: 4, tempsMs: 30_000 }))
  assert.ok(bat({ points: 4, tempsMs: 50_000 }, { points: 4, tempsMs: 50_001 }))
  assert.ok(!bat({ points: 4, tempsMs: 50_000 }, { points: 4, tempsMs: 50_000 }))
  assert.ok(!bat({ points: 8, tempsMs: 1_000 }, { points: 4, tempsMs: 90_000 }))
  // La valeur du classement dit la même chose : les points, puis le chrono.
  assert.ok(valeurDeLaCourse({ points: 0, tempsMs: 90_000 }) > valeurDeLaCourse({ points: 4, tempsMs: 1_000 }))
  assert.ok(valeurDeLaCourse({ points: 4, tempsMs: 1_000 }) > valeurDeLaCourse({ points: 4, tempsMs: 2_000 }))
})

test('un parcours neuf : dix obstacles jamais courus, moitié du quiz du jour, puis les plus anciens quand le vivier s’épuise', () => {
  const vivier = [
    ...Array.from({ length: 12 }, (_, i) => ({ rang: i, source: 'jour' as const })),
    ...Array.from({ length: 12 }, (_, i) => ({ rang: 12 + i, source: 'campagne' as const })),
  ]
  const a = suiteFixe(7)
  const premier = tirerLeParcours(vivier, new Map(), a)
  assert.equal(premier.length, OBSTACLES_DU_GRAND_PRIX)
  assert.equal(new Set(premier).size, OBSTACLES_DU_GRAND_PRIX)
  assert.equal(premier.filter(r => r < 12).length, 5, 'moitié du quiz du jour : le vrai temps du fantôme')
  const deja = new Map(premier.map(r => [r, 0]))
  const second = tirerLeParcours(vivier, deja, a)
  assert.equal(second.filter(r => deja.has(r)).length, 0, 'un parcours neuf ne reprend rien de la course d’avant')
  // Vingt-quatre questions pour trois courses : la troisième reprend les plus anciennes.
  second.forEach(r => deja.set(r, 1))
  const troisieme = tirerLeParcours(vivier, deja, a)
  assert.equal(new Set(troisieme).size, OBSTACLES_DU_GRAND_PRIX)
  const reprises = troisieme.filter(r => deja.has(r))
  assert.equal(reprises.length, 6)
  assert.ok(reprises.every(r => deja.get(r) === 0), 'les plus anciennes d’abord')
})

test('le rythme du fantôme se tire de ses vrais temps du même verdict', () => {
  const temps = { justes: [3000, 4000], faux: [9000] }
  const a = suiteFixe(3)
  for (let i = 0; i < 20; i++) assert.ok([3000, 4000].includes(tirerUnRythme(temps, true, a)))
  assert.equal(tirerUnRythme(temps, false, a), 9000)
  assert.equal(tirerUnRythme({ justes: [3000], faux: [] }, false, a), 3000, 'sans temps du même verdict, ceux de l’autre')
})

test('Pégase est secret : il ne se montre qu’à qui l’a, et ce qu’un Grand Prix range est une voie rangée', () => {
  assert.deepEqual([...PRIX_DES_GRANDS_PRIX], ['lg:pegase', 'lg:pegase-couronne'])
  assert.ok(!legendairesVisibles([]).some(l => l.key === 'lg:pegase'))
  assert.ok(legendairesVisibles(['lg:pegase']).some(l => l.key === 'lg:pegase'))
  assert.ok(!legendairesVisibles(['lg:pegase']).some(l => l.key === 'lg:pegase-couronne'))
  assert.ok(PREFIXES_DES_VOIES_RANGEES.includes('flot:' as never) && PREFIXES_DES_VOIES_RANGEES.includes('grandprix:' as never))
  assert.deepEqual(flotDe(cleDuFlot('abc', true)), { grandPrix: 'abc', honneur: true })
  assert.deepEqual(flotDe(cleDuFlot('abc')), { grandPrix: 'abc', honneur: false })
})

// ── Sur un serveur ────────────────────────────────────────────────────────

/** Samedi 5 décembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 11, 5, 9, 0)
const JOUR = '2026-12-05'
const JOURS_D_AVANT = ['2026-12-01', '2026-12-02', '2026-12-03']

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base(banc: Banc) {
  return new Database(banc.quizDbUrl.replace(/^file:/, ''), { fileMustExist: true })
}

/**
 * Le passé de la fêtée, écrit dans ses journaux : trois jours de quiz du jour
 * (une question sur trois ratée, sept secondes ; les autres en cinq ; un
 * refus le dernier jour) et une série de campagne de dix QCM.
 */
function ecrireSonPasse(banc: Banc, fantome: string) {
  const db = base(banc)
  try {
    const tirage = db.prepare('INSERT INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, ?, ?)')
    const reponse = db.prepare('INSERT INTO jour_reponses (profile_id, jour, question, choix, ms, juste, points, repondue_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    for (const [j, jour] of JOURS_D_AVANT.entries()) {
      const questions = Array.from({ length: 10 }, (_, i) => ({
        reserveId: `r-${j}-${i}`,
        texte: `Question du jour ${j}-${i} ?`,
        reponses: ['A', 'B', 'C', 'D'],
        bonne: i % 4,
        categorie: 'Histoire',
        duree: 20,
        lectureMs: 2000,
        anecdote: `L’anecdote ${j}-${i}.`,
      }))
      tirage.run(jour, JSON.stringify(questions), '[]', DEBUT - 5 * 86_400_000)
      questions.forEach((q, i) => {
        const refus = j === 2 && i === 9
        const juste = !refus && i % 3 !== 0
        const choix = refus ? null : juste ? q.bonne : (q.bonne + 1) % 4
        reponse.run(fantome, jour, i, choix, refus ? null : juste ? 5000 : 7000, juste ? 1 : 0, juste ? 150 : 0, DEBUT - 4 * 86_400_000)
      })
    }
    const questions = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, texte: `Question de campagne ${i} ?`, reponses: ['W', 'X', 'Y', 'Z'], bonne: 2, categorie: 'Sciences', anecdote: null, niveau: 'facile' }))
    db.prepare('INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      'serie-1',
      fantome,
      JSON.stringify(questions),
      10,
      3,
      8,
      DEBUT - 3 * 86_400_000,
      DEBUT - 3 * 86_400_000 + 60_000,
      'serie',
    )
    const rep = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, ?, ?, ?)')
    questions.forEach((_, i) => rep.run('serie-1', i, `cq${i}`, i < 8 ? 2 : 0, i < 8 ? 1 : 0, DEBUT - 3 * 86_400_000))
  } finally {
    db.close()
  }
}

function idDuProfil(banc: Banc, login: string): string {
  const db = base(banc)
  try {
    return (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
  } finally {
    db.close()
  }
}

/** La bonne réponse de l'obstacle en cours d'une course, lue en base : le téléphone ne la voit jamais. */
function bonneDe(banc: Banc, course: string, position: number): number {
  const db = base(banc)
  try {
    const c = db.prepare('SELECT grand_prix_id, obstacles FROM grand_prix_courses WHERE id = ?').get(course) as { grand_prix_id: string; obstacles: string }
    const rang = JSON.parse(c.obstacles)[position]
    const q = db.prepare('SELECT question FROM grand_prix_questions WHERE grand_prix_id = ? AND rang = ?').get(c.grand_prix_id, rang) as { question: string }
    return JSON.parse(q.question).bonne
  } finally {
    db.close()
  }
}

function obstaclesDe(banc: Banc, course: string): number[] {
  const db = base(banc)
  try {
    return JSON.parse((db.prepare('SELECT obstacles FROM grand_prix_courses WHERE id = ?').get(course) as { obstacles: string }).obstacles)
  } finally {
    db.close()
  }
}

test('le Grand Prix, de la programmation au flot : le fantôme rejoue, le chrono est au serveur, la victoire paie une fois', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦄')
    const nina = await inscrireProfil(banc.url, 'nina', 'Nina', '🦊')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼')
    const leaId = idDuProfil(banc, 'lea')

    // Sans passé, pas de fantôme : il n'a pas de quoi courir.
    const tropTot = await poster(banc, admin, '/api/admin/grand-prix', { fantome: idDuProfil(banc, 'hugo'), jour: JOUR })
    assert.equal(tropTot.status, 400)
    assert.match(tropTot.corps.error, /assez joué/)

    ecrireSonPasse(banc, leaId)
    const apercu = await lire(banc, admin, `/api/admin/grand-prix/fantome/${leaId}`)
    assert.equal(apercu.status, 200)
    assert.deepEqual([apercu.corps.jour, apercu.corps.campagne, apercu.corps.pret], [30, 10, true])

    // Un avatar qui ne se met pas en jeu est refusé en clair.
    const mauvais = await poster(banc, admin, '/api/admin/grand-prix', { fantome: leaId, jour: JOUR, prix: 'lg:phenix' })
    assert.equal(mauvais.status, 400)

    const programme = await poster(banc, admin, '/api/admin/grand-prix', {
      fantome: leaId,
      jour: JOUR,
      titre: 'Le Grand Prix de Léa',
      ruban: 'violet',
      mot: 'Tiens bon !',
      prix: 'lg:pegase',
      prixFete: 'lg:pegase-couronne',
    })
    assert.equal(programme.status, 200, JSON.stringify(programme.corps))
    const gp = programme.corps.grandsPrix[0]
    assert.deepEqual([gp.titre, gp.ruban, gp.vivier.jour, gp.vivier.campagne], ['Le Grand Prix de Léa', 'violet', 30, 10])
    // Un seul Grand Prix par jour.
    assert.equal((await poster(banc, admin, '/api/admin/grand-prix', { fantome: leaId, jour: JOUR })).status, 400)

    // Le jour venu, la page le montre ; personne n'a encore couru.
    const avant = await lire(banc, nina, '/api/grand-prix')
    assert.equal(avant.status, 200)
    assert.equal(avant.corps.grandPrix.titre, 'Le Grand Prix de Léa')
    assert.equal(avant.corps.grandPrix.fantome.nom, 'Léa')
    assert.deepEqual([avant.corps.course, avant.corps.departs, avant.corps.vainqueurs.length, avant.corps.bilan, avant.corps.fete], [null, 0, 0, null, null])

    // Le départ sert le premier obstacle : sa question, son échéance, le temps du fantôme — jamais sa bonne réponse.
    let etat = (await poster(banc, nina, '/api/grand-prix/depart')).corps
    const course = etat.course.id
    assert.equal(etat.course.obstacle.position, 0)
    assert.equal(etat.course.obstacle.echeance, horloge.t + 20_000)
    assert.ok(!JSON.stringify(etat).includes('"bonne"'), 'invariant 1 : la bonne réponse n’arrive qu’avec la révélation')
    assert.ok(!JSON.stringify(etat).includes('anecdote'))
    // Un second départ reprend la course en route, il ne la double pas.
    assert.equal((await poster(banc, nina, '/api/grand-prix/depart')).corps.course.id, course)

    // Nina saute tout, sans faute, en une seconde chacun.
    for (let i = 0; i < OBSTACLES_DU_GRAND_PRIX; i++) {
      if (i > 0) etat = (await poster(banc, nina, `/api/grand-prix/course/${course}/suivante`)).corps
      assert.equal(etat.course.obstacle.position, i)
      horloge.t += 1000
      const r = await poster(banc, nina, `/api/grand-prix/course/${course}/reponse`, { position: i, choix: bonneDe(banc, course, i) })
      assert.equal(r.status, 200, JSON.stringify(r.corps))
      etat = r.corps
      assert.equal(etat.revelation.toi.juste, true)
      assert.equal(etat.revelation.toi.tempsMs, 1000)
      assert.equal(typeof etat.revelation.bonne, 'number')
      // Le fantôme dit sa réponse avec la révélation, pas avant.
      assert.ok('choix' in etat.revelation.fantome)
      horloge.t += 3000
    }
    assert.equal(etat.course.finie, true)
    assert.deepEqual(etat.course.toi, { points: 0, tempsMs: 10_000, barres: 0, sautes: 10 })
    assert.ok(etat.course.fantome.points > 0, 'le fantôme fait tomber des barres : il ratait une question sur trois')
    assert.deepEqual(etat.course.fin, { battu: true, rang: 1, flot: true, prix: 'lg:pegase' })
    // Une réponse renvoyée — l'accusé perdu en route — rend la même révélation, sans rien réécrire ni repayer.
    const renvoi = await poster(banc, nina, `/api/grand-prix/course/${course}/reponse`, { position: 9, choix: 0 })
    assert.equal(renvoi.status, 200)
    assert.equal(renvoi.corps.revelation.toi.juste, true)
    assert.equal(renvoi.corps.course.fin.flot, false)

    // Le flot et Pégase sont rangés : Nina le porte, Hugo ne peut pas.
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:pegase' }, nina, 'PUT')).status, 200)
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:pegase' }, hugo, 'PUT')).status, 400)

    // La page la classe première à la battre ; son meilleur départ est celui-là.
    etat = (await lire(banc, nina, '/api/grand-prix')).corps
    assert.deepEqual([etat.departs, etat.rang, etat.vainqueurs.length, etat.vainqueurs[0].nom, etat.coureurs], [1, 1, 1, 'Nina', 1])

    // Un deuxième départ : un parcours neuf, rien de la course d'avant.
    etat = (await poster(banc, nina, '/api/grand-prix/depart')).corps
    const seconde = etat.course.id
    assert.notEqual(seconde, course)
    const deja = new Set(obstaclesDe(banc, course))
    assert.equal(obstaclesDe(banc, seconde).filter(r => deja.has(r)).length, 0)

    // Une réponse partie après l'échéance et la marge est un refus : quatre points, tout le temps de l'obstacle.
    horloge.t += 20_000 + GRACE_MS + 100
    const tard = await poster(banc, nina, `/api/grand-prix/course/${seconde}/reponse`, { position: 0, choix: 0 })
    assert.equal(tard.status, 200)
    assert.equal(tard.corps.tropTard, true)
    assert.deepEqual([tard.corps.revelation.toi.choix, tard.corps.revelation.toi.penalite, tard.corps.revelation.toi.tempsMs], [null, 4, 20_000])

    // Un obstacle laissé passer se compte refus à la lecture suivante, sans chronomètre au serveur.
    await poster(banc, nina, `/api/grand-prix/course/${seconde}/suivante`)
    horloge.t += 30_000
    etat = (await lire(banc, nina, '/api/grand-prix')).corps
    assert.equal(etat.course.position, 2)
    assert.equal(etat.course.toi.points, 8)
    // Abandonnée, elle ne compte pas.
    etat = (await poster(banc, nina, `/api/grand-prix/course/${seconde}/abandon`)).corps
    assert.deepEqual([etat.course, etat.departs], [null, 1])

    // La fêtée : son bilan, son flot d'honneur et Pégase couronné, rangés le jour venu.
    const sienne = (await lire(banc, lea, '/api/grand-prix')).corps
    assert.deepEqual(sienne.fete, { prix: 'lg:pegase-couronne', mot: 'Tiens bon !' })
    assert.deepEqual([sienne.bilan.coureurs, sienne.bilan.departs, sienne.bilan.vainqueurs], [1, 1, 1])
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:pegase-couronne' }, lea, 'PUT')).status, 200)
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:pegase-couronne' }, nina, 'PUT')).status, 400)

    // Le carnet : le flot de Nina, et celui d'honneur de Léa.
    const carnetNina = (await lire(banc, nina, '/api/grand-prix/carnet')).corps.flots
    assert.deepEqual(carnetNina.map((f: any) => [f.grandPrix.titre, f.honneur, f.points, f.rang]), [['Le Grand Prix de Léa', false, 0, 1]])
    assert.equal(carnetNina[0].grandPrix.fantome.avatar, '🦄', 'le flot garde l’avatar du fantôme de ce jour-là')
    const carnetLea = (await lire(banc, lea, '/api/grand-prix/carnet')).corps.flots
    assert.deepEqual(carnetLea.map((f: any) => f.honneur), [true])

    // Le jour couru, le Grand Prix ne se reprogramme ni ne se retire plus : ses flots sont rangés.
    assert.equal((await poster(banc, admin, '/api/admin/grand-prix', { id: gp.id, fantome: leaId, jour: '2026-12-12' })).status, 400)
    assert.equal((await ecrire(banc.url, `/api/admin/grand-prix/${gp.id}`, {}, admin, 'DELETE')).status, 400)

    // Le lendemain, plus de Grand Prix : la page le dit, et un départ est refusé en clair.
    horloge.t += 86_400_000
    assert.equal((await lire(banc, nina, '/api/grand-prix')).corps.grandPrix, null)
    assert.equal((await poster(banc, nina, '/api/grand-prix/depart')).status, 400)
  } finally {
    await banc.close()
  }
})
