// L'Expédition a quitté le dépôt (le 16 novembre 2026), pas les bases : la
// production garde dix expéditions de quatre profils, leurs 223 réponses, une
// expédition restée en route pour toujours, et 528 gestes dans une table qui
// ne se crée plus (`expedition_gestes`). Rien ne s'en reprend (invariant 22) :
// l'expérience, les confettis, la précision, les écussons, le carnet se
// relisent de ces lignes à chaque lecture, comme de toute partie.
//
// Ce fichier écrit une expédition finie, ses réponses et une expédition en
// route à la main, comme la production les a, puis lit ce qu'un profil en
// tire par les routes. Les nombres ont été mesurés sur le code d'avant le
// retrait (le commit e96881d, où l'Expédition se compilait encore) et écrits
// en dur : le retrait ne devait en changer aucun, et un changement qui en
// bouge un reprend ou donne quelque chose à des joueurs qui ne rejoueront
// jamais ces parties.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Mercredi 21 octobre 2026, 10 h à Paris : l'Expédition se jouait du 19 au 23. */
const EN_OCTOBRE = Date.UTC(2026, 9, 21, 8)
/** Lundi 16 novembre 2026, 10 h à Paris : le jour où son code est parti. */
const AUJOURDHUI = Date.UTC(2026, 10, 16, 9)
const MINUTE = 60_000

type Reponse<T = any> = { status: number; corps: T }
const lire = <T = any>(banc: Banc, cookie: string, chemin: string): Promise<Reponse<T>> =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie }, redirect: 'manual' }).then(async r => ({ status: r.status, corps: (await r.json().catch(() => null)) as T }))
const poster = <T = any>(banc: Banc, cookie: string, chemin: string, corps: unknown = {}, methode = 'POST'): Promise<Reponse<T>> =>
  ecrire(banc.url, chemin, corps, cookie, methode).then(async r => ({ status: r.status, corps: (await r.json().catch(() => null)) as T }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/** La question `essai<i>` de la base d'essai, telle qu'une expédition la gardait : sa bonne réponse en tête, son escale, son acte. */
const question = (i: number, enPlus: Record<string, unknown> = {}) => ({
  id: `essai${String(i).padStart(3, '0')}`,
  texte: `Question d'essai numéro ${i} : laquelle est la bonne ?`,
  reponses: [`Bonne ${i}`, `Autre A${i}`, `Autre B${i}`, `Autre C${i}`],
  bonne: 0,
  categorie: i % 2 === 0 ? 'Histoire' : 'Sciences',
  anecdote: `L'anecdote de la question ${i}.`,
  niveau: (['facile', 'moyen', 'moyen', 'difficile', 'expert'] as const)[i % 5],
  escale: `1-${i}`,
  acte: 0,
  ...enPlus,
})

/**
 * Le départ d'une expédition, tel que `campagne_series.expedition` le garde :
 * plus rien ne le lit, la colonne reste. Abrégé — un vrai porte ses trois
 * cartes entières.
 */
const DEPART = JSON.stringify({ v: 15, numero: 1, graine: 'a1b2c3', gardiens: ['sphinx', 'kraken', 'phenix'], cartes: [{ escales: [], liens: [] }, { escales: [], liens: [] }, { escales: [], liens: [] }], equipee: [], style: 'erudit' })

/** Une expédition finie le 21 octobre — quatorze réponses de toutes les sortes que la production garde — et une autre restée en route, deux réponses. */
function ecrireLesExpeditions(banc: Banc, profil: string) {
  const finie = [
    // Trouvée, sans aide : la précision, l'écusson d'Histoire.
    { q: question(0), choix: 0, juste: 1 },
    // Trouvée avec un joker : un confetti et son expérience, mais ni la précision ni l'écusson.
    { q: question(1), choix: 0, juste: 1, joker: 'coup-d-oeil' },
    // Ratée : au carnet.
    { q: question(2), choix: 2, juste: 0 },
    // Un vrai ou faux tiré d'une question à quatre choix : aidée par sa forme.
    { q: question(3, { forme: 'vrai-faux', reponses: ['Vrai', 'Faux'], proposee: 'Bonne 3', bonneReponse: 'Bonne 3' }), choix: 0, juste: 1, forme: 'vrai-faux' },
    // Juste au second essai (`CARTES_DU_SECOND_ESSAI`) : ratée d'abord, elle reste ratée au carnet.
    { q: question(5), choix: 0, juste: 1, joker: 'parade' },
    // Un rébus : hors de la base, ni carnet ni signalement.
    { q: { ...question(6), id: 'rebus:le-roi-lion', texte: 'Quel film se cache derrière ces emojis ?', forme: 'lettres', rebus: '🦁👑', reponses: ['Le Roi lion'], tuiles: ['L', 'E', 'R', 'O', 'I', 'L', 'I', 'O', 'N', 'X', 'Z'], enTrop: [9, 10] }, choix: -1, juste: 0, forme: 'lettres', composee: 'LEROIXION' },
    // Une frise : hors de la base aussi, l'ordre qu'il avait donné dans `composee`.
    { q: { ...question(7), id: 'frise:essai010+essai012+essai014+essai016', texte: 'Range ces événements du plus ancien au plus récent', forme: 'frise', reponses: ['Le premier', 'Le deuxième', 'Le troisième', 'Le dernier'], frise: { annees: [1492, 1789, 1889, 1969], montre: [2, 0, 3, 1] } }, choix: -1, juste: 0, forme: 'frise', composee: '1023' },
    // Trouvée sur un thème pointu : son tampon au passeport d'alors (`sujet`).
    { q: question(8, { sujet: 'dinosaures' }), choix: 0, juste: 1, sujet: 'dinosaures' },
    // Reprise du carnet par une source : trouvée, elle paie, sans dire le savoir.
    { q: question(2, { carnet: true }), choix: 0, juste: 1 },
    // Une experte trouvée sans aide : L'Érudit la compte.
    { q: question(4), choix: 0, juste: 1 },
    // Une experte ratée.
    { q: question(9), choix: 1, juste: 0 },
    // Un détail : une question de la base, posée sous l'intitulé de la forme et le tableau qu'elle nomme — reconnu.
    { q: question(12, { forme: 'detail', detail: { qid: 'Q45585', titre: 'La Nuit étoilée', peintre: 'Vincent van Gogh', annee: 1889 }, devoileLe: EN_OCTOBRE + 12 * MINUTE }), choix: 0, juste: 1, forme: 'detail' },
    // Traversée par Passe-muraille : sans réponse, comptée ratée — au carnet.
    { q: question(13), choix: null, juste: 0, joker: 'passe-muraille' },
    // Un vrai ou faux à la proposée fausse, posé avant que sa question garde sa bonne réponse (`bonneReponse`) : « Mes réponses » la
    // relit dans la base. Il a dit « Vrai » : ratée.
    { q: question(14, { forme: 'vrai-faux', reponses: ['Vrai', 'Faux'], bonne: 1, proposee: 'Autre A14' }), choix: 0, juste: 0, forme: 'vrai-faux' },
  ]
  const enRoute = [
    { q: question(10), choix: 0, juste: 1 },
    // Ratée sous un Coup d'œil : une erreur aidée entre au carnet comme une autre.
    { q: question(11), choix: 3, juste: 0, joker: 'coup-d-oeil' },
  ]
  base(banc, db => {
    const serie = db.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, issue, expedition, bilan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'expedition', ?, ?, ?)`,
    )
    const reponse = db.prepare(
      `INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, joker, forme, sujet, composee, compagnon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'luciole')`,
    )
    // Sa luciole, offerte à prix nul par la Première traversée d'alors, dans sa niche : chaque réponse la retient, et elle en grandit.
    db.prepare(`INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, 'luciole', 0, 0, ?)`).run(profil, EN_OCTOBRE - MINUTE)
    db.prepare(`UPDATE profiles SET niche = 'luciole' WHERE id = ?`).run(profil)
    const justes = (l: typeof finie) => l.filter(r => r.juste === 1).length
    // Sa position saute six questions de reste de ses gardiens, tirées d'avance et jamais posées : « L'activité » du QG compte ses
    // réponses, pas elle.
    serie.run('exp-finie', profil, JSON.stringify(finie.map(r => r.q)), finie.length + 6, 0, justes(finie), EN_OCTOBRE, EN_OCTOBRE + 40 * MINUTE, 'abandonnee', DEPART, JSON.stringify({ v: 2, escales: 9, adversaires: 6, elites: 1, gardiens: 0, auBout: false, exploits: [] }))
    serie.run('exp-en-route', profil, JSON.stringify(enRoute.map(r => r.q)), enRoute.length, 2, justes(enRoute), EN_OCTOBRE + 60 * MINUTE, null, null, DEPART, null)
    for (const [id, l, debut] of [['exp-finie', finie, EN_OCTOBRE], ['exp-en-route', enRoute, EN_OCTOBRE + 60 * MINUTE]] as const) {
      l.forEach((r: any, i) => reponse.run(id, i, r.q.id, r.choix, r.juste, debut + (i + 1) * MINUTE, r.joker ?? null, r.forme ?? null, r.sujet ?? null, r.composee ?? null))
    }
    // Le Sphinx gardé au bout d'une expédition, comme un profil de la production le tient : sa voie rangée, sous sa partie.
    db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'expedition:sphinx', '#campagne:exp-finie', '', '🦁', 'Le Sphinx', ?)`).run(profil, EN_OCTOBRE + 40 * MINUTE)
    // Ses gestes : la table dort en production, et ne se crée plus — une base qui l'a la garde telle quelle.
    db.exec('CREATE TABLE IF NOT EXISTS expedition_gestes (serie_id TEXT NOT NULL, rang INTEGER NOT NULL, geste TEXT NOT NULL, fait_le INTEGER NOT NULL, PRIMARY KEY (serie_id, rang))')
    const geste = db.prepare('INSERT INTO expedition_gestes (serie_id, rang, geste, fait_le) VALUES (?, ?, ?, ?)')
    geste.run('exp-finie', 0, JSON.stringify({ quoi: 'avancer', escale: '1-0' }), EN_OCTOBRE)
    geste.run('exp-finie', 1, JSON.stringify({ quoi: 'abandonner' }), EN_OCTOBRE + 40 * MINUTE)
    geste.run('exp-en-route', 0, JSON.stringify({ quoi: 'avancer', escale: '1-10' }), EN_OCTOBRE + 60 * MINUTE)
  })
}

/** Ce qu'un profil tire de ses parties, par les routes : sa page, sa carte, son carnet, la campagne, sa fiche au QG. */
async function sonde(banc: Banc, lea: string, admin: string, id: string) {
  const moi = (await lire(banc, lea, '/api/joueur/moi')).corps.profile
  const carte = (await lire(banc, lea, '/api/joueur/carte')).corps.profil
  const carnet = (await lire(banc, lea, '/api/campagne/carnet')).corps
  const etat = (await lire(banc, lea, '/api/campagne')).corps
  const fiche = (await lire(banc, admin, `/api/admin/profils/${id}`)).corps
  return {
    xp: moi.xp,
    niveau: moi.niveau,
    ecussons: Object.fromEntries(moi.ecussons.filter((e: any) => e.justes > 0).map((e: any) => [e.categorie, e.justes])),
    categories: moi.categories,
    campagne: carte.campagne,
    savoir: carte.savoir,
    precision: [carte.fiche.qcm, carte.fiche.justes],
    carnet: [carnet.aRevoir, carnet.demain, carnet.plusTard, carnet.appris, carnet.categories],
    etat: [etat.record, etat.series, etat.enCours],
    auQg: [fiche.campagne, fiche.confettis, fiche.activite],
    niche: [moi.niche, moi.boutique.compagnons],
    legendaires: [moi.legendaires, moi.badges, moi.vitrine.length],
  }
}

test('une expédition d’avant et ses réponses se lisent comme avant : expérience, confettis, précision, écussons, carnet, compagnon, correction, signalement', async () => {
  const horloge = { t: EN_OCTOBRE }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(40, { categories: ['Histoire', 'Sciences'] }) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id)
    ecrireLesExpeditions(banc, id)
    // Le serveur d'aujourd'hui se réveille sur cette base : son journal des réponses la relit en entier.
    horloge.t = AUJOURDHUI
    await banc.redemarrer()

    // Ce qui se relit à chaque lecture : neuf bonnes réponses sur seize, quatre sans aide sur six qui disent le savoir —
    // le détail reconnu paie, sans rien dire du savoir : sa forme l'écarte de la mesure ; ni l'erreur aidée, ni la question
    // traversée ne comptent à la précision.
    assert.deepEqual(await sonde(banc, lea, admin, id), {
      // Sa ligne d'expérience ne se réécrit qu'à sa bonne réponse suivante (plus bas) : écrites à la main, ces lignes n'en ont pas.
      xp: 0,
      niveau: 1,
      ecussons: { Histoire: 4 },
      categories: { Histoire: { questions: 5, justes: 4 }, Sciences: { questions: 1, justes: 0 } },
      campagne: { record: 0, justes: 9, paliers: 0 },
      savoir: [
        { categorie: 'Histoire', questions: 5, justes: 4 },
        { categorie: 'Sciences', questions: 1, justes: 0 },
      ],
      precision: [6, 4],
      // Six à revoir : la ratée, la juste au second essai, l'experte ratée, la traversée par Passe-muraille, le vrai ou faux raté, et
      // l'erreur aidée de l'expédition en route — ni le rébus ni la frise.
      carnet: [6, 0, 0, 0, [{ categorie: 'Histoire', aRevoir: 2, enTout: 2 }, { categorie: 'Sciences', aRevoir: 4, enTout: 4 }]],
      // Ni un record de série, ni une série, ni une série en cours.
      etat: [0, 0, null],
      // Seize questions jouées — ses réponses, pas la position de sa partie, qui en dirait vingt-deux.
      auQg: [{ record: 0, justes: 9 }, { solde: 9, offerts: 0 }, { questions: { soiree: 0, campagne: 16, cabinet: 0, jour: 0, duel: 0 }, parties: { soiree: 0, campagne: 2, cabinet: 0, jour: 0, duel: 0 }, jours: 1 }],
      // Sa luciole a grandi de chacune des neuf, aidée ou non, finie ou en route.
      niche: ['luciole', [{ compagnon: 'luciole', rang: 0, justes: 9 }]],
      // Sa voie rangée lui donne le Sphinx, sans être un trophée : ni au compte des badges, ni sur l'étagère.
      legendaires: [['lg:sphinx'], 0, 0],
    })

    // « Mes réponses » de l'expédition finie, par la route de la série : chaque forme s'y relit — le vrai ou faux et sa réponse
    // proposée, le rébus et ses emojis, la frise, ses années et l'ordre qu'il avait donné, le détail, son tableau nommé et l'intitulé
    // de sa forme, à l'adresse d'alors (l'épreuve suivante dit ce qu'elle répond).
    const corrigee = await lire(banc, lea, '/api/campagne/serie/exp-finie/correction')
    assert.equal(corrigee.status, 200)
    assert.equal(corrigee.corps[11].texte, 'Qui a peint ce tableau ?')
    assert.equal(corrigee.corps[0].texte, "Question d'essai numéro 0 : laquelle est la bonne ?")
    assert.deepEqual(
      corrigee.corps.map((c: any) => [c.reponses, c.bonne, c.choix, c.juste, c.niveau, (c.bonneReponse ? [c.proposee, c.bonneReponse] : c.proposee) ?? c.rebus ?? c.frise ?? c.detail ?? null]),
      [
        [['Bonne 0', 'Autre A0', 'Autre B0', 'Autre C0'], 0, 0, true, 'facile', null],
        [['Bonne 1', 'Autre A1', 'Autre B1', 'Autre C1'], 0, 0, true, 'moyen', null],
        [['Bonne 2', 'Autre A2', 'Autre B2', 'Autre C2'], 0, 2, false, 'moyen', null],
        [['Vrai', 'Faux'], 0, 0, true, 'difficile', 'Bonne 3'],
        [['Bonne 5', 'Autre A5', 'Autre B5', 'Autre C5'], 0, 0, true, 'facile', null],
        [['Le Roi lion', 'LER OIXI'], 0, 1, false, 'moyen', '🦁👑'],
        [['Le premier', 'Le deuxième', 'Le troisième', 'Le dernier'], 0, 1, false, 'moyen', { annees: [1492, 1789, 1889, 1969], sienne: [1, 0, 2, 3] }],
        [['Bonne 8', 'Autre A8', 'Autre B8', 'Autre C8'], 0, 0, true, 'difficile', null],
        [['Bonne 2', 'Autre A2', 'Autre B2', 'Autre C2'], 0, 0, true, 'moyen', null],
        [['Bonne 4', 'Autre A4', 'Autre B4', 'Autre C4'], 0, 0, true, 'expert', null],
        [['Bonne 9', 'Autre A9', 'Autre B9', 'Autre C9'], 0, 1, false, 'expert', null],
        [['Bonne 12', 'Autre A12', 'Autre B12', 'Autre C12'], 0, 0, true, 'moyen', { titre: 'La Nuit étoilée', peintre: 'Vincent van Gogh', annee: 1889, image: '/api/expedition/exp-finie/detail/11/4' }],
        [['Bonne 13', 'Autre A13', 'Autre B13', 'Autre C13'], 0, null, false, 'difficile', null],
        [['Vrai', 'Faux'], 1, 0, false, 'expert', ['Autre A14', 'Bonne 14']],
      ],
    )

    // Une question de la base posée en expédition se signale toujours, et le QG dit où elle s'est jouée ; ni un rébus, ni une frise.
    assert.equal((await poster(banc, lea, '/api/campagne/serie/exp-finie/signalement', { index: 2, texte: 'La réponse B se défend aussi' })).status, 200)
    assert.equal((await poster(banc, lea, '/api/campagne/serie/exp-finie/signalement', { index: 1, texte: 'Pour relire sa mesure' })).status, 200)
    assert.deepEqual((await poster(banc, lea, '/api/campagne/serie/exp-finie/signalement', { index: 5, texte: 'Ce rébus ne se lit pas' })).corps, {
      error: 'Un rébus ne se signale pas : seules les questions de la campagne le peuvent',
    })
    assert.deepEqual((await poster(banc, lea, '/api/campagne/serie/exp-finie/signalement', { index: 6, texte: 'Cette frise est fausse' })).corps, {
      error: 'Une frise ne se signale pas : seules les questions de la campagne le peuvent',
    })
    const signalements = (await lire(banc, admin, '/api/admin/signalements')).corps.campagne
    assert.deepEqual(
      signalements.map((s: any) => [s.questionId, s.mesure, s.rapports.map((r: any) => [r.ou, r.reponse, r.juste])]).sort((a: any, b: any) => (a[0] < b[0] ? -1 : 1)),
      [
        // Trouvée sous un Coup d'œil : la mesure des difficultés ne la compte pas.
        ['essai001', { justes: 0, total: 0 }, [['expedition', 'Bonne 1', true]]],
        // Ratée nue, puis reprise du carnet par une source : la première seule se mesure.
        ['essai002', { justes: 0, total: 1 }, [['expedition', 'Autre B2', false], ['expedition', 'Bonne 2', true]]],
      ],
      'jouée deux fois dans l’expédition — ratée, puis reprise du carnet —, et « en expédition » au QG ; la mesure ne compte ni la reprise du carnet, ni la réponse aidée',
    )

    // Sa bonne réponse suivante réécrit sa ligne d'expérience, du journal : les neuf du 21 octobre au double (les vingt premières
    // d'un jour), et celle d'aujourd'hui — cent points, le niveau 2, dix confettis.
    const serie = await poster(banc, lea, '/api/campagne/serie', { categories: ['Histoire'] })
    assert.equal(serie.status, 200, 'une série part : l’expédition restée en route ne la retient pas')
    const q = serie.corps.question
    const reponse = await poster(banc, lea, `/api/campagne/serie/${serie.corps.id}/reponse`, { index: q.index, choix: q.reponses.findIndex((x: string) => x.startsWith('Bonne')) })
    assert.deepEqual([reponse.status, reponse.corps.juste, reponse.corps.xp], [200, true, 10])
    const apres = await sonde(banc, lea, admin, id)
    assert.deepEqual(
      { xp: apres.xp, niveau: apres.niveau, ecussons: apres.ecussons, campagne: apres.campagne, precision: apres.precision, auQg: apres.auQg, niche: apres.niche },
      {
        niche: ['luciole', [{ compagnon: 'luciole', rang: 0, justes: 10 }]],
        xp: 100,
        niveau: 2,
        ecussons: { Histoire: 5 },
        campagne: { record: 0, justes: 10, paliers: 0 },
        precision: [7, 5],
        auQg: [{ record: 0, justes: 10 }, { solde: 10, offerts: 0 }, { questions: { soiree: 0, campagne: 17, cabinet: 0, jour: 0, duel: 0 }, parties: { soiree: 0, campagne: 3, cabinet: 0, jour: 0, duel: 0 }, jours: 2 }],
      },
    )
  } finally {
    await banc.close()
  }
})

test('l’expédition restée en route ne bloque ni ne fausse rien : aucune reprise, aucun départ refusé, aucune partie en cours comptée', async () => {
  const horloge = { t: EN_OCTOBRE }
  // Un client minimal tient lieu de construit : la redirection de `/expedition` n'existe que là où le serveur sert des pages, et
  // `npm test` passe avant le build — sans lui, l'épreuve passait ici et rougissait en CI, où `client/dist` n'existe pas encore.
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>FiestApp</title></head><body></body></html>')
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(40, { categories: ['Histoire', 'Sciences'] }), clientDist: dist })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id)
    ecrireLesExpeditions(banc, id)
    horloge.t = AUJOURDHUI
    await banc.redemarrer()

    // Aucune de ses routes : « introuvable », à un profil connecté comme à un inconnu — jamais « Connexion requise », que la porte des
    // animateurs répondrait à une adresse qu'aucune route ne prend avant elle.
    for (const [cookie, qui] of [[lea, 'un profil'], ['', 'un inconnu'], [admin, 'un animateur']] as const) {
      // La dernière est l'image du tableau d'un détail, que la correction d'une expédition d'avant cite encore : en production,
      // elle répond ainsi depuis le 31 octobre 2026, et « Mes réponses » garde sa place sans elle (`TableauEntier`).
      for (const chemin of ['/api/expedition', '/api/expedition/exp-en-route/geste', '/api/expedition/exp-en-route/devoilement?position=0', '/api/expedition/exp-finie/detail/11/4']) {
        const lu = await lire(banc, cookie, chemin)
        assert.deepEqual([lu.status, lu.corps], [404, { error: 'Introuvable' }], `${chemin}, pour ${qui}`)
      }
      const ecrit = await poster(banc, cookie, '/api/expedition/exp-en-route/abandon')
      assert.deepEqual([ecrit.status, ecrit.corps], [404, { error: 'Introuvable' }], `un abandon, pour ${qui}`)
    }
    // Son adresse d'avant mène au Cabinet, sans drapeau : un favori, un lien partagé.
    const page = await fetch(`${banc.url}/expedition`, { redirect: 'manual' })
    assert.deepEqual([page.status, page.headers.get('location')], [302, '/cabinet'])

    // Rien ne la croit reprenable : ni la campagne, ni l'accueil, ni la page du Cabinet n'en disent un mot.
    const etat = (await lire(banc, lea, '/api/campagne')).corps
    assert.equal(etat.enCours, null, 'la campagne n’a pas de série en cours')
    const accueil = (await lire(banc, lea, '/api/joueur/moi?accueil')).corps.profile
    assert.equal(JSON.stringify(accueil).includes('exp-en-route'), false, 'l’accueil ne la cite pas')
    const cabinet = await lire(banc, lea, '/api/cabinet')
    assert.equal(cabinet.status, 200)
    assert.equal('expedition' in cabinet.corps, false, 'la page du Cabinet ne porte plus la ligne « Ton expédition t’attend »')
    // Sa correction attend une fin qui ne viendra pas : elle ne souffle rien.
    assert.deepEqual((await lire(banc, lea, '/api/campagne/serie/exp-en-route/correction')).corps, { error: 'La correction attend la fin de la série' })
    // Les routes de la série ne la jouent ni ne l'abandonnent.
    assert.deepEqual((await poster(banc, lea, '/api/campagne/serie/exp-en-route/reponse', { index: 2, choix: 0 })).corps, { error: 'Cette série est introuvable' })
    assert.deepEqual((await poster(banc, lea, '/api/campagne/serie/exp-en-route/abandon')).corps, { error: 'Cette série est introuvable' })

    // Le QG ne la compte nulle part en cours : ni une épreuve à libérer, ni une traversée à rendre sur sa fiche.
    const fiche = (await lire(banc, admin, `/api/admin/profils/${id}`)).corps
    assert.deepEqual([fiche.epreuve, fiche.traversee], [null, null])

    // Chaque départ part : une série, une révision, le dé, une épreuve, une traversée du Cabinet.
    assert.equal((await poster(banc, lea, '/api/campagne/serie', {})).status, 200, 'une série')
    assert.equal((await poster(banc, lea, '/api/campagne/revision', {})).status, 200, 'une révision')
    assert.equal((await poster(banc, lea, '/api/campagne/rencontre', {})).status, 200, 'le dé')
    // Les mythologies : le sentier d'Histoire, que la base d'essai sait poser.
    const epreuve = await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'mythes', palier: 1 })
    assert.equal(epreuve.status, 200, `une épreuve : ${JSON.stringify(epreuve.corps).slice(0, 200)}`)
    const traversee = await poster(banc, lea, '/api/cabinet/traversee', {})
    assert.equal(traversee.status, 200, `une traversée : ${JSON.stringify(traversee.corps).slice(0, 200)}`)
    assert.doesNotMatch(JSON.stringify(traversee.corps), /exp[ée]dition|t’attend/i)
    // Elle est restée telle quelle : ni close, ni touchée.
    assert.deepEqual(base(banc, db => db.prepare("SELECT finie_le, issue, position, justes FROM campagne_series WHERE id = 'exp-en-route'").get()), {
      finie_le: null,
      issue: null,
      position: 2,
      justes: 1,
    })
  } finally {
    await banc.close()
  }
})

test('un profil supprimé emporte ses expéditions et leurs réponses ; ses gestes restent dans la table qui dort, sans lien vers lui', async () => {
  const horloge = { t: EN_OCTOBRE }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(40, { categories: ['Histoire', 'Sciences'] }) })
  try {
    const admin = await connexionAnimateur(banc.url)
    await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id)
    ecrireLesExpeditions(banc, id)
    horloge.t = AUJOURDHUI
    await banc.redemarrer()

    const supprime = await poster(banc, admin, `/api/admin/profils/${id}`, {}, 'DELETE')
    assert.deepEqual([supprime.status, supprime.corps], [200, { ok: true, salon: null }])
    const compte = (sql: string) => base(banc, db => (db.prepare(sql).get() as { n: number }).n)
    assert.equal(compte('SELECT COUNT(*) AS n FROM campagne_series'), 0)
    assert.equal(compte('SELECT COUNT(*) AS n FROM campagne_reponses'), 0)
    // La table n'a pas de `profile_id`, et plus rien ne l'efface : une base neuve ne l'a pas, un `DELETE` y lèverait.
    assert.equal(compte('SELECT COUNT(*) AS n FROM expedition_gestes'), 3)
  } finally {
    await banc.close()
  }
})

// Le Globe-trotter (`hf:globe-trotter`, les tampons du passeport) est parti du catalogue avec l'Expédition. Aucun profil
// de la production n'en tenait un palier ; une base de préproduction ou de développement peut en garder. Sans son
// catalogue et sans tombe, la ligne se lisait à moitié (mesuré le 16 novembre 2026) : deux entrées « Le Globe-trotter »
// sur l'étagère et dans la vitrine d'office, deux badges comptés, mais aucune page de l'album, son titre porté lu vide,
// et plus rien à sa ligne d'expérience. Elle se tait donc partout (`PREFIXES_DES_TROPHEES_PARTIS`), et reste en base.
test('une ligne du Globe-trotter restée rangée se tait partout, sans erreur et sans quitter la base : ni étagère, ni vitrine, ni badge, ni titre, ni expérience', async () => {
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(40, { categories: ['Histoire', 'Sciences'] }) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id)
    base(banc, db => {
      const badge = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#campagne:exp-finie', '', '🧳', 'Le Globe-trotter', 1)`)
      badge.run(id, 'hf:globe-trotter:1')
      badge.run(id, 'hf:globe-trotter:2')
      // Il le portait en titre, et l'avait mis dans sa vitrine.
      db.prepare(`UPDATE profiles SET titre = 'hf:globe-trotter', vitrine = ? WHERE id = ?`).run(JSON.stringify(['hf:globe-trotter']), id)
    })
    await banc.redemarrer()

    const moi = await lire(banc, lea, '/api/joueur/moi')
    assert.equal(moi.status, 200)
    const p = moi.corps.profile
    assert.deepEqual([p.xp, p.niveau, p.badges, p.titre, p.vitrine], [0, 1, 0, null, []])
    assert.equal(p.hautsFaits.some((h: any) => h.key === 'hf:globe-trotter'), false, 'plus de piste à son nom')
    assert.ok(p.hautsFaits.some((h: any) => h.key === 'hf:globe-trotteur'), 'Le Globe-trotteur des soirées, lui, n’a pas bougé')
    // Aucune page ne le cite, aucune ne tombe.
    for (const [cookie, chemin] of [
      [lea, '/api/joueur/moi'],
      [lea, '/api/joueur/moi?accueil'],
      [lea, '/api/joueur/moi?leger'],
      [lea, '/api/joueur/carte'],
      [lea, '/api/joueur/nouveautes'],
      [lea, '/api/joueur/missions'],
      [lea, '/api/collectionneurs'],
      [lea, '/api/campagne'],
      [lea, '/api/cabinet'],
      [admin, `/api/admin/profils/${id}`],
    ] as const) {
      const lu = await lire(banc, cookie, chemin)
      assert.equal(lu.status, 200, chemin)
      assert.doesNotMatch(JSON.stringify(lu.corps), /globe-trotter|Globe-trotter\b/, chemin)
    }

    // Une partie finie fait juger les paliers de la campagne et réécrire ses lignes d'expérience : rien ne tombe, rien ne s'efface.
    const serie = await poster(banc, lea, '/api/campagne/serie', {})
    const q = serie.corps.question
    const reponse = await poster(banc, lea, `/api/campagne/serie/${serie.corps.id}/reponse`, { index: q.index, choix: q.reponses.findIndex((x: string) => x.startsWith('Bonne')) })
    assert.deepEqual([reponse.status, reponse.corps.juste], [200, true])
    assert.equal((await poster(banc, lea, `/api/campagne/serie/${serie.corps.id}/abandon`)).status, 200)
    const apres = (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    assert.deepEqual([apres.xp, apres.badges, apres.titre, apres.vitrine], [10, 0, null, []])
    assert.deepEqual(
      base(banc, db => db.prepare(`SELECT badge FROM profile_badges WHERE profile_id = ? AND badge LIKE 'hf:globe-trotter:%' ORDER BY badge`).all(id)),
      [{ badge: 'hf:globe-trotter:1' }, { badge: 'hf:globe-trotter:2' }],
      'ses lignes restent en base',
    )
  } finally {
    await banc.close()
  }
})

// Venue d'`expedition-mesure.test.ts`, mot pour mot : les jokers sont partis avec l'Expédition, et la colonne `joker` de
// `campagne_reponses`, que le carnet, la précision et la mesure lisent encore, ne s'écrit plus que par le Cabinet, pour ses
// deux pouvoirs (`core/cabinet/ecriture.ts`). Aucune route d'un autre mode n'en lit un.
test('aucun autre mode n’accepte un joker : ni le quiz du jour, ni la campagne et ses duels, ni la soirée, ni le Cabinet (invariant 8)', () => {
  const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  // Le Cabinet a ses cartes-bonus, jamais un joker de l'Expédition : ses routes n'en lisent aucun.
  for (const fichier of ['src/quizDuJour.ts', 'src/campagne.ts', 'src/sockets.ts', 'src/missions.ts', 'src/cabinet.ts']) {
    assert.doesNotMatch(readFileSync(path.join(racine, fichier), 'utf8'), /joker/i, `${fichier} : un joker ne sort jamais de l’expédition`)
  }
})

test('une base neuve n’a pas de table des gestes, et un profil s’y supprime sans erreur', async () => {
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(40) })
  try {
    const admin = await connexionAnimateur(banc.url)
    await inscrireProfil(banc.url, 'tom', 'Tom', '🐼')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('tom') as { id: string }).id)
    assert.deepEqual(base(banc, db => db.prepare("SELECT name FROM sqlite_master WHERE name = 'expedition_gestes'").all()), [])
    const supprime = await poster(banc, admin, `/api/admin/profils/${id}`, {}, 'DELETE')
    assert.deepEqual([supprime.status, supprime.corps], [200, { ok: true, salon: null }])
  } finally {
    await banc.close()
  }
})
