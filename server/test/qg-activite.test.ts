// L'activité au QG (`/admin#activite`, le souhait du propriétaire du
// 17 octobre 2026 : « voir la quantité de ce que font les joueurs, nombre de
// duels / questions sur les différents modes et pas forcément uniquement la
// participation par joueur ») : les questions jouées et les parties, mode par
// mode et jour par jour, et ce que chaque profil a joué — sur quoi il
// s'acharne. Des soirées des autres, rien que des chiffres : ni le prénom
// d'un invité, ni le titre qu'on leur a donné.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import React from 'react'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, inscrireProfil, type Banc } from './banc'
import { jourDe } from '../../shared/jour'
import { gainVide, releveVide, type FicheDuJoueur } from '../../shared/profil'
import { JOURS_DU_QG, minuitDe, minuitsDeParis } from '../../shared/qg'
import {
  activiteDesJoueurs,
  activiteParJour,
  joueursAMontrer,
  modePrefere,
  parModeVide,
  totauxDeLActivite,
  type PageDeLActivite,
  type PartieSeule,
  type SoireeDUnProfil,
  type SoireeJouee,
} from '../../shared/qgActivite'

const H = 3_600_000
const MINUTE = 60_000
const sansInsecables = (s: string) => s.replace(/[  ]/g, ' ')

const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

// Mardi 13 octobre 2026, 21 h à Paris.
const maintenant = Date.UTC(2026, 9, 13, 19)
const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
const aujourdhui = minuits[minuits.length - 1] + 10 * H
const hier = minuits[minuits.length - 2] + 10 * H
// Léa ne fait que de la campagne, Zoé que le quiz du jour, Tom des duels et des soirées.
const SEULES: PartieSeule[] = [
  { qui: 'lea', quand: hier, mode: 'campagne', questions: 14 },
  { qui: 'lea', quand: aujourdhui, mode: 'campagne', questions: 9 },
  { qui: 'zoe', quand: aujourdhui, mode: 'jour', questions: 10 },
  { qui: 'tom', quand: aujourdhui, mode: 'duel', questions: 12 },
  { qui: 'tom', quand: aujourdhui + H, mode: 'duel', questions: 8 },
  // Avant la période, et après maintenant : rien.
  { qui: 'tom', quand: minuits[0] - 1, mode: 'jour', questions: 10 },
  { qui: 'tom', quand: maintenant + 1, mode: 'jour', questions: 10 },
]
// Une soirée hier soir : huit invités ont joué deux quiz, cent quatre-vingts questions en tout.
const SOIREES: SoireeJouee[] = [{ quand: hier + 11 * H, quiz: 2, joueurs: 8, jouees: 180 }]
// Tom y était, avec son profil : vingt-quatre questions posées, deux quiz.
const DES_PROFILS: SoireeDUnProfil[] = [{ qui: 'tom', quand: hier + 11 * H, quiz: 2, questions: 24 }]

test('les questions jouées et les parties, jour par jour et mode par mode, et ce que chaque profil a joué : des dérivations pures', () => {
  const parJour = activiteParJour(SEULES, SOIREES, minuits, maintenant)
  assert.equal(parJour.length, JOURS_DU_QG)
  assert.deepEqual(parJour.at(-1), { jour: '2026-10-13', questions: { soiree: 0, campagne: 9, jour: 10, duel: 20 }, parties: { soiree: 0, campagne: 1, jour: 1, duel: 2 } })
  // La soirée compte ses quiz pour parties, et les questions de tous ses invités.
  assert.deepEqual(parJour.at(-2), { jour: '2026-10-12', questions: { soiree: 180, campagne: 14, jour: 0, duel: 0 }, parties: { soiree: 2, campagne: 1, jour: 0, duel: 0 } })
  assert.deepEqual(parJour[0], { jour: '2026-09-14', questions: parModeVide(), parties: parModeVide() })
  // Les joueurs : des profils distincts seuls ; en soirée, chaque invité qui a joué, une fois par soirée.
  assert.deepEqual(totauxDeLActivite(SEULES, SOIREES, minuits, maintenant), {
    questions: { soiree: 180, campagne: 23, jour: 10, duel: 20 },
    parties: { soiree: 2, campagne: 2, jour: 1, duel: 2 },
    joueurs: { soiree: 8, campagne: 1, jour: 1, duel: 1 },
    soirees: 1,
  })

  // Chaque profil, le plus assidu d'abord : Tom et ses quarante-quatre questions, ses soirées lues dans sa ligne d'expérience.
  const classes = activiteDesJoueurs(SEULES, DES_PROFILS, minuits, maintenant)
  assert.deepEqual(classes, [
    { qui: 'tom', questions: { soiree: 24, campagne: 0, jour: 0, duel: 20 }, parties: { soiree: 2, campagne: 0, jour: 0, duel: 2 }, jours: 2 },
    { qui: 'lea', questions: { soiree: 0, campagne: 23, jour: 0, duel: 0 }, parties: { soiree: 0, campagne: 2, jour: 0, duel: 0 }, jours: 2 },
    { qui: 'zoe', questions: { soiree: 0, campagne: 0, jour: 10, duel: 0 }, parties: { soiree: 0, campagne: 0, jour: 1, duel: 0 }, jours: 1 },
  ])
  // Sur quoi chacun s'acharne : le mode où il joue le plus, et sa part.
  assert.deepEqual(classes.map(modePrefere), [
    { mode: 'soiree', part: 55 },
    { mode: 'campagne', part: 100 },
    { mode: 'jour', part: 100 },
  ])
  assert.equal(modePrefere({ questions: parModeVide() }), null)
  // Un seul par vue : le plus assidu de tous, puis le premier de chaque mode — Zoé n'est première qu'au quiz du jour, elle est là.
  assert.deepEqual(
    joueursAMontrer(classes, 1).map(a => a.qui),
    ['tom', 'lea', 'zoe'],
  )
  assert.deepEqual(
    joueursAMontrer(classes.slice(0, 2), 1).map(a => a.qui),
    ['tom', 'lea'],
  )
})

test('un vrai serveur : trente jours de questions jouées par mode, chaque profil et ce qu’il a joué, sa fiche — sans un prénom d’invité ni un titre de soirée', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    await inscrireProfil(banc.url, 'tom', 'Tom', '🦉')
    const lea = idDe(banc, 'lea')
    const tom = idDe(banc, 'tom')
    const instant = Date.now()
    const minuit = minuitDe(instant)
    const veille = minuitDe(minuit - 1) + 12 * H
    // Aujourd'hui, quelques minutes plus tôt — au pire minuit, si l'épreuve tourne juste après.
    const tantot = Math.max(minuit, instant - 5 * MINUTE)
    base(banc, db => {
      const serie = db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, '[]', ?, 0, 0, ?, NULL, ?)`,
      )
      // Léa : une série et une épreuve hier, une partie du jour tantôt ; Tom : un duel contre Automate tantôt.
      serie.run(randomUUID(), lea, 14, veille, 'serie')
      serie.run(randomUUID(), lea, 16, veille + H, 'sentier')
      serie.run(randomUUID(), tom, 12, tantot, 'rencontre')
      db.prepare('INSERT INTO jour_parties (profile_id, jour, commencee_le, question, justes) VALUES (?, ?, ?, 10, 6)').run(lea, jourDe(tantot), tantot)
      // Une soirée d'hier soir, rangée avant le compte des questions jouées :
      // sa fiche ne le dit pas, son archive si — trois invités, deux questions
      // chacun, dont Tom et son profil.
      const invites = [
        { id: 'i1', name: 'Inès', avatar: '🐱', teamId: null, points: 30, joue: true },
        { id: 'i2', name: 'Hugo', avatar: '🐶', teamId: null, points: 20, joue: true },
        { id: 'i3', name: 'Tom', avatar: '🦉', teamId: null, points: 10, joue: true, profileId: tom },
      ]
      const fiche = { v: 3, invites, profils: true, equipes: [], prix: [], quiz: 1, questions: 2 }
      const reponses = invites.flatMap(i => [0, 1].map(q => ({ playerId: i.id, sessionId: 's1', qIndex: q, answered: q === 0 })))
      db.prepare(`INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, 'L’anniversaire de Léa', ?, ?, ?, ?)`).run(
        'un-espace',
        'soiree-hier',
        veille + 9 * H,
        veille + 11 * H,
        JSON.stringify(fiche),
        JSON.stringify({ players: invites, answers: reponses }),
      )
      db.prepare('INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, 40, ?, ?)').run(
        tom,
        'soiree-hier',
        'un-espace',
        JSON.stringify({ v: 3, gain: gainVide(), releve: { ...releveVide(), questions: 2, reponses: 1, quizJoues: 1 } }),
        veille + 10 * H,
      )
    })

    const page = (await lire<PageDeLActivite>(banc, admin, '/api/admin/activite')).corps
    assert.equal(page.parJour.length, JOURS_DU_QG)
    assert.deepEqual(page.totaux, {
      // Six questions posées en soirée : trois invités, deux chacun, une laissée au temps par chacun.
      questions: { soiree: 6, campagne: 30, jour: 10, duel: 12 },
      parties: { soiree: 1, campagne: 2, jour: 1, duel: 1 },
      joueurs: { soiree: 3, campagne: 1, jour: 1, duel: 1 },
      soirees: 1,
    })
    assert.deepEqual(page.parJour.at(-1)!.questions, { soiree: 0, campagne: 0, jour: 10, duel: 12 })
    // Chaque profil et ce qu'il a joué, le plus assidu d'abord ; Tom compte ses questions de la soirée.
    assert.equal(page.profilsActifs, 2)
    assert.deepEqual(
      page.joueurs.map(j => [j.nom, j.login, j.suspendu, j.questions, j.parties, j.jours]),
      [
        ['Léa', 'lea', false, { soiree: 0, campagne: 30, jour: 10, duel: 0 }, { soiree: 0, campagne: 2, jour: 1, duel: 0 }, 2],
        ['Tom', 'tom', false, { soiree: 2, campagne: 0, jour: 0, duel: 12 }, { soiree: 1, campagne: 0, jour: 0, duel: 1 }, 2],
      ],
    )
    // La fiche d'avant a appris ses questions jouées, une fois : la page suivante ne relit plus l'archive.
    const stockee = base(banc, db => JSON.parse(String((db.prepare(`SELECT summary FROM soirees WHERE id = 'soiree-hier'`).get() as { summary: string }).summary)))
    assert.equal(stockee.jouees, 6)
    // Ni le prénom d'un invité, ni le titre de sa soirée : des chiffres.
    const texte = JSON.stringify(page)
    for (const absent of ['Inès', 'Hugo', 'anniversaire', 'un-espace', 'soiree-hier']) assert.ok(!texte.includes(absent), `« ${absent} » dans la réponse`)

    // Sa fiche dit ses trente jours, mode par mode.
    const f = (await lire<FicheDuJoueur>(banc, admin, `/api/admin/profils/${lea}`)).corps
    assert.deepEqual(f.activite, { questions: { soiree: 0, campagne: 30, jour: 10, duel: 0 }, parties: { soiree: 0, campagne: 2, jour: 1, duel: 0 }, jours: 2 })
    const g = (await lire<FicheDuJoueur>(banc, admin, `/api/admin/profils/${tom}`)).corps
    assert.deepEqual(g.activite?.questions, { soiree: 2, campagne: 0, jour: 0, duel: 12 })
    // Réservée à l'administrateur.
    assert.equal((await fetch(`${banc.url}/api/admin/activite`)).status, 401)
  } finally {
    await banc.close()
  }
})

test('la page de l’activité se lit d’un coup d’œil : trente jours en tout, jour par jour, et qui joue à quoi', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#activite', origin: 'http://banc' } } })
  const { ActiviteAuQg } = await import(new URL('../../client/src/components/QgActivite.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const classes = activiteDesJoueurs(SEULES, DES_PROFILS, minuits, maintenant)
  const noms: Record<string, string> = { tom: 'Tom', lea: 'Léa', zoe: 'Zoé' }
  const page: PageDeLActivite = {
    maintenant,
    parJour: activiteParJour(SEULES, SOIREES, minuits, maintenant),
    totaux: totauxDeLActivite(SEULES, SOIREES, minuits, maintenant),
    joueurs: classes.map(a => ({ ...a, id: a.qui, nom: noms[a.qui], login: a.qui, suspendu: a.qui === 'zoe' })),
    profilsActifs: 3,
  }
  const html = sansInsecables(renderToStaticMarkup(React.createElement(ActiviteAuQg, { page })).replace(/<!-- -->/g, ''))
  for (const attendu of [
    'Ces trente jours',
    '233 questions jouées, tous modes confondus',
    'questions · 2 quiz · 1 soirée, 8 invités',
    'questions · 2 parties · 1 joueur',
    'questions · 2 duels · 1 joueur',
    'Jour par jour',
    'Questions jouées',
    'Qui joue à quoi',
    '3 profils actifs ces trente jours',
    // Tom : ses questions, ses jours, et sur quoi il s'acharne ; sa barre dit chaque mode au lecteur d'écran.
    '44 questions · 2 jours sur 30 · surtout les soirées, 55 %',
    'aria-label="Soirées : 24 questions, Duels : 20 questions"',
    '23 questions · 2 jours sur 30 · rien que la campagne',
    'suspendu',
  ]) {
    assert.ok(html.includes(attendu), `« ${attendu} » dans la page`)
  }
  for (const absent of ['NaN', 'undefined', 'null']) assert.ok(!html.includes(absent), `pas de « ${absent} »`)
})

test('la fiche d’un joueur dit ses trente jours : ses questions, ses jours, chaque mode, le plus joué d’abord', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#profils', origin: 'http://banc' } } })
  const { sesTrenteJours } = await import(new URL('../../client/src/components/QgFicheJoueur.tsx', import.meta.url).href)
  const [tom, lea] = activiteDesJoueurs(SEULES, DES_PROFILS, minuits, maintenant)
  assert.equal(sesTrenteJours(tom), '44 questions en 2 jours : soirées 24, duels 20')
  assert.equal(sesTrenteJours(lea), '23 questions en 2 jours : campagne 23')
  // Une partie commencée, sa première question pas encore jouée ; rien du tout.
  assert.equal(sesTrenteJours({ questions: parModeVide(), parties: { ...parModeVide(), jour: 1, campagne: 1 }, jours: 1 }), '2 parties commencées, aucune question jouée')
  assert.equal(sesTrenteJours({ questions: parModeVide(), parties: parModeVide(), jours: 0 }), 'rien joué')
})
