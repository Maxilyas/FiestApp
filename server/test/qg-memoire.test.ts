// La mémoire longue du QG, complétée (la revue d'expert du 4 novembre 2026,
// P1.3, `retours/2026-11-04/experts/analyse-et-management.md`) : chaque jour
// fini dit aussi ses soirées et leurs salons — les nouveaux animateurs —, ses
// invités avec et sans profil, ses naissances par écran et leur lendemain, ses
// missions, ses questions jouées de chaque mode, ses confettis source par
// source, et son serveur — null quand ses démarrages ne le couvrent pas,
// jamais zéro. Une ligne d'avant se lit sans eux ; une version neuve refait
// tout des journaux et garde le serveur que les démarrages ne savent plus.
//
// Puis le point du matin (P1.4) : la dérivation qui fait la notification et
// « Hier, en bref » — des nombres seulement dans la notification —, son
// réglage, et au banc, l'horloge à la main : rien avant l'heure, la mémoire de
// la veille écrite par son passage, une notification par jour même après un
// redémarrage, le lundi la semaine, coupé il écrit sans sonner.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { abonnementDe, dechiffrer, serviceDePush } from './push'
import { dUneTraite } from '../../shared/tranches'
import { jourAvant } from '../../shared/jour'
import { gainsDesMissions } from '../../shared/missions'
import { confettisParJour, sansMouvement } from '../../shared/qgEconomie'
import { couvertsDepuis, serveurDuJour, SANTE_GARDEE_MS, type DemarrageDuServeur } from '../../shared/santeDuServeur'
import {
  HEURE_DU_POINT,
  jourDuPoint,
  lireLeReglageDuPoint,
  messageDuPoint,
  phraseDuReglageDuPoint,
  pointDOffice,
  pointDuMatin,
  pointRegle,
  type EntreeDuPoint,
  type HierDuQg,
  type JourDuPoint,
} from '../../shared/pointDuMatin'
import type { PageDesAlertes } from '../../shared/qgAlertes'
import {
  VERSION_DE_LA_MEMOIRE,
  joursDeLaMemoire,
  lireLeServeurDUnJour,
  minuitDuJour,
  nesEnSoiree,
  soireesDuJour,
  type ChiffresDUnJour,
  type PageDesJoueurs,
} from '../../shared/qgJoueurs'

const H = 3_600_000
const J = 24 * H
/** Un instant d'un jour de Paris, à telle heure. */
const a = (jour: string, heure: number) => minuitDuJour(jour) + heure * H

// ── Les dérivations ─────────────────────────────────────────────────────────

/** Trois démarrages : un réveil le 1er, un autre le 2, la version v2 mise en ligne le 3, qui répond encore le 4 à midi. */
const MAINTENANT_DU_SERVEUR = a('2026-11-04', 12)
const demarrage = (id: string, version: string, de: number, a_: number | null): DemarrageDuServeur => ({
  id,
  demarreLe: de,
  pretEnMs: 900,
  version,
  env: 'production',
  vuLe: a_ ?? MAINTENANT_DU_SERVEUR,
  arreteLe: a_,
})
const DEMARRAGES = [
  demarrage('d0', 'v1', a('2026-11-01', 7), a('2026-11-01', 23.5)),
  demarrage('d1', 'v1', a('2026-11-02', 7), a('2026-11-02', 22)),
  demarrage('d2', 'v2', a('2026-11-03', 6 + 55 / 60), null),
]

test('le serveur d’un jour : ses heures éveillées au dixième, ses mises en ligne — et seulement là où ses démarrages couvrent tout', () => {
  assert.deepEqual(serveurDuJour(DEMARRAGES, minuitDuJour('2026-11-02'), minuitDuJour('2026-11-03'), MAINTENANT_DU_SERVEUR, 'd2'), { heures: 15, versions: [] })
  assert.deepEqual(serveurDuJour(DEMARRAGES, minuitDuJour('2026-11-03'), minuitDuJour('2026-11-04'), MAINTENANT_DU_SERVEUR, 'd2'), { heures: 17.1, versions: ['v2'] })
  // Couverts depuis huit jours, jamais avant le plus ancien démarrage : avant lui, rien ne dit que le serveur dormait.
  assert.equal(couvertsDepuis(DEMARRAGES, MAINTENANT_DU_SERVEUR), a('2026-11-01', 7))
  assert.equal(couvertsDepuis(DEMARRAGES, MAINTENANT_DU_SERVEUR + 30 * J), MAINTENANT_DU_SERVEUR + 30 * J - SANTE_GARDEE_MS)
  assert.equal(couvertsDepuis([], MAINTENANT_DU_SERVEUR), Infinity)
  // Ce qu'une ligne de la mémoire en garde : null, ou ses heures et ses versions ; le reste se lit absent.
  assert.equal(lireLeServeurDUnJour(null), null)
  assert.deepEqual(lireLeServeurDUnJour({ heures: 3, versions: ['abc1234'] }), { heures: 3, versions: ['abc1234'] })
  for (const faux of [undefined, 'x', 3, { heures: -1, versions: [] }, { heures: 2 }, { heures: 2, versions: [4] }]) assert.equal(lireLeServeurDUnJour(faux), undefined)
})

test('les confettis d’une plage, jour par jour : chaque source et chaque puits, rien hors de ses jours', () => {
  const minuits = ['2026-11-01', '2026-11-02'].map(minuitDuJour)
  const fin = minuitDuJour('2026-11-03')
  const m = sansMouvement()
  m.gagnes.jour.push({ quand: a('2026-11-01', 9), confettis: 6 }, { quand: a('2026-11-02', 9), confettis: 4 })
  m.gagnes.missions.push({ quand: a('2026-11-01', 12), confettis: 10 })
  m.gagnes.dons.push({ quand: minuits[0] - 1, confettis: 50 }, { quand: fin, confettis: 50 })
  m.achats.push({ sorte: 'themes', quand: a('2026-11-02', 13), confettis: 300, objets: 1, article: 'aurore' }, { sorte: 'vies', quand: fin, confettis: 40, objets: 2, article: null })
  const [premier, second] = confettisParJour(m, minuits, fin)
  assert.deepEqual([premier.gagnes.jour, premier.gagnes.missions, premier.gagnes.dons, premier.depenses.themes], [6, 10, 0, 0])
  assert.deepEqual([second.gagnes.jour, second.gagnes.dons, second.depenses.themes, second.depenses.vies], [4, 0, 300, 0])
})

test('les jours d’une plage, la mémoire v2 : soirées et salons, naissances et lendemain, missions, questions, confettis, serveur', () => {
  const jours = ['2026-11-01', '2026-11-02', '2026-11-03']
  const minuits = jours.map(minuitDuJour)
  const fin = minuitDuJour('2026-11-04')
  const journaux = {
    solo: [
      { qui: 'neo', quand: a('2026-11-01', 9), mode: 'jour' as const, questions: 10 },
      { qui: 'ana', quand: a('2026-11-02', 21), mode: 'campagne' as const, questions: 15 },
    ],
    soireesDesProfils: [],
    soirees: [
      // La toute première soirée d'un salon, et celle d'un salon qui joue depuis un mois — sa fiche d'avant les profils.
      { quand: a('2026-11-03', 21), joueurs: 5, profils: ['cid'], spaceId: 'espace-a', jouees: 40 },
      { quand: a('2026-11-03', 22), joueurs: 3, spaceId: 'espace-b', jouees: 12 },
    ],
    inscriptions: [],
    achats: [],
  }
  const m = sansMouvement()
  m.gagnes.jour.push({ quand: a('2026-11-01', 9), confettis: 6 })
  const confettis = confettisParJour(m, minuits, fin)
  const plus = {
    // Néo, né la veille de la plage, rejoue le lendemain ; Ana et Bob naissent le 1er, Ana seule rejoue ; Cid, né le 2,
    // vient à la soirée du 3. Un profil né avant la veille ne compte nulle part.
    naissances: [
      { qui: 'vieux', quand: a('2026-10-30', 10), origine: 'jour' as const },
      { qui: 'neo', quand: a('2026-10-31', 10), origine: 'entree' as const },
      { qui: 'ana', quand: a('2026-11-01', 9), origine: 'jour' as const },
      { qui: 'bob', quand: a('2026-11-01', 11), origine: null },
      { qui: 'cid', quand: a('2026-11-02', 20), origine: 'soiree' as const },
    ],
    premieresSoirees: new Map([
      ['espace-a', a('2026-11-03', 21)],
      ['espace-b', a('2026-10-03', 21)],
    ]),
    missions: [
      ...[0, 1, 2, 3].map(rang => ({ qui: 'neo', quand: a('2026-11-01', 12 + rang / 10), rang })),
      { qui: 'ana', quand: a('2026-11-01', 18), rang: 0 },
      { qui: 'ana', quand: fin, rang: 1 },
    ],
    confettis,
    serveur: { demarrages: DEMARRAGES, maintenant: MAINTENANT_DU_SERVEUR, courant: 'd2' },
    heritage: new Map(),
  }
  const [premier, deuxieme, troisieme] = dUneTraite(joursDeLaMemoire(journaux, minuits, fin, new Map(), plus)).map(j => j.chiffres)
  assert.ok([premier, deuxieme, troisieme].every(c => c.v === VERSION_DE_LA_MEMOIRE))

  assert.deepEqual([premier.naissances, deuxieme.naissances, troisieme.naissances], [{ jour: 1, avant: 1 }, { soiree: 1 }, {}])
  assert.deepEqual([nesEnSoiree(premier), nesEnSoiree(deuxieme)], [0, 1])
  assert.deepEqual([premier.lendemain, deuxieme.lendemain, troisieme.lendemain], [1, 1, 1], 'Néo, Ana, Cid : chacun le lendemain de sa naissance')
  assert.deepEqual([premier.missions, deuxieme.missions], [
    { faites: 4, profils: 2, toutes: 1 },
    { faites: 0, profils: 0, toutes: 0 },
  ])
  assert.deepEqual([premier.questions?.jour, deuxieme.questions?.campagne, troisieme.questions?.soiree], [10, 15, 52])
  assert.equal(premier.confettis?.gagnes.jour, 6)
  assert.deepEqual(troisieme.soirees, [
    { espace: 'espace-a', invites: 5, profils: 1 },
    { espace: 'espace-b', invites: 3, profils: null },
  ])
  assert.deepEqual(troisieme.nouveauxSalons, ['espace-a'])
  assert.deepEqual(soireesDuJour(troisieme), { soirees: 2, animateurs: 2, nouveaux: 1, invites: 8, avecProfil: 1, sansProfil: 7 })
  assert.deepEqual(soireesDuJour(premier), { soirees: 0, animateurs: 0, nouveaux: 0, invites: 0, avecProfil: 0, sansProfil: 0 })
  // Le 1er n'est pas couvert — avant le premier démarrage, rien ne dit que le serveur dormait : null, jamais zéro.
  assert.deepEqual([premier.serveur, deuxieme.serveur, troisieme.serveur], [null, { heures: 15, versions: [] }, { heures: 17.1, versions: ['v2'] }])

  // Une version neuve : ce que la mémoire savait du serveur passe avant les démarrages, null compris.
  const heritage = new Map([
    ['2026-11-01', { heures: 12.5, versions: [] }],
    ['2026-11-02', null],
  ])
  const refaits = dUneTraite(joursDeLaMemoire(journaux, minuits, fin, new Map(), { ...plus, heritage })).map(j => j.chiffres.serveur)
  assert.deepEqual(refaits, [{ heures: 12.5, versions: [] }, null, { heures: 17.1, versions: ['v2'] }])

  // Sans ce que le rattrapage lit en plus, un jour ne dit que l'audience.
  const [seul] = dUneTraite(joursDeLaMemoire(journaux, minuits, fin)).map(j => j.chiffres)
  for (const champ of ['soirees', 'nouveauxSalons', 'naissances', 'lendemain', 'missions', 'questions', 'confettis', 'serveur']) assert.ok(!(champ in seul), champ)
})

test('une ligne d’avant se lit sans ce qu’elle ne savait pas : absent, jamais zéro', () => {
  const dAvant: ChiffresDUnJour = {
    v: 1,
    joueurs: 4,
    modes: { soiree: 3, campagne: 1, cabinet: 0, jour: 0, duel: 0 },
    parties: { soiree: 3, campagne: 1, cabinet: 0, jour: 0, duel: 0 },
    nouveauxProfils: 1,
    achats: 0,
    profils: 2,
    semaine: 2,
    mois: 2,
    invites: 2,
    heures: Array.from({ length: 24 }, () => 0),
  }
  assert.equal(soireesDuJour(dAvant), null)
  assert.equal(nesEnSoiree(dAvant), null)
})

// ── Au banc : le rattrapage écrit chaque jour fini ─────────────────────────

/** Mercredi 4 novembre 2026, 21 h à Paris. */
const MAINTENANT = Date.UTC(2026, 10, 4, 20, 0)
const AUJOURDHUI = '2026-11-04'
const il_y_a = (n: number) => jourAvant(AUJOURDHUI, n)

test('au banc : chaque jour fini s’écrit avec sa mémoire v2, sans un salon dans la page des joueurs — et une version neuve garde son serveur', async () => {
  const horloge = { t: MAINTENANT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const admin = await connexionAnimateur(banc.url)
    for (const [login, origine] of [
      ['lea', 'entree'],
      ['max', 'jour'],
      ['zoe', 'accueil'],
    ]) {
      const res = await ecrire(banc.url, '/api/joueur/inscription', { login, password: 'motdepasse1', name: login, avatar: '🦊', origine })
      assert.equal(res.status, 201)
    }
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const ids = Object.fromEntries((db.prepare('SELECT login, id FROM profiles').all() as { login: string; id: string }[]).map(p => [p.login, p.id]))
    // Léa naît il y a trois jours et joue le lendemain ; Max et Zoé — d'avant l'origine — il y a deux jours, et
    // jouent le lendemain : Max en campagne, Zoé à une soirée, la toute première d'un salon.
    const naissance = db.prepare('UPDATE profiles SET created_at = ?, origine = ? WHERE id = ?')
    naissance.run(a(il_y_a(3), 10), 'entree', ids.lea)
    naissance.run(a(il_y_a(2), 10), 'jour', ids.max)
    naissance.run(a(il_y_a(2), 11), null, ids.zoe)
    db.prepare('INSERT INTO jour_parties (profile_id, jour, commencee_le, question, justes) VALUES (?, ?, ?, 10, 6)').run(ids.lea, il_y_a(2), a(il_y_a(2), 9))
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES ('s-max', ?, '[]', 15, 0, 0, ?, NULL, 'serie')`).run(
      ids.max,
      a(il_y_a(1), 20),
    )
    const mission = db.prepare("INSERT INTO profile_missions (profile_id, jour, rang, mission, tiree_le, faite_le) VALUES (?, ?, ?, 'm', ?, ?)")
    for (const rang of [0, 1, 2, 3]) mission.run(ids.lea, il_y_a(2), rang, a(il_y_a(2), 8), a(il_y_a(2), 12 + rang / 10))
    db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 300, ?)').run(ids.max, 'aurore', a(il_y_a(1), 13))
    const soiree = db.prepare(`INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, 'Un titre qui ne sort jamais', ?, ?, ?, ?)`)
    const invites = [
      { id: 'i1', name: 'Inès', avatar: '🐱', teamId: null, points: 30, joue: true },
      { id: 'i2', name: 'Hugo', avatar: '🐶', teamId: null, points: 20, joue: true },
      { id: 'i3', name: 'zoe', avatar: '🦊', teamId: null, points: 10, joue: true, profileId: ids.zoe },
    ]
    // Sa fiche ne dit pas ses questions jouées : son archive si — trois invités, deux questions chacun.
    soiree.run(
      'un-espace',
      'soiree-hier',
      a(il_y_a(1), 21),
      a(il_y_a(1), 23),
      JSON.stringify({ v: 3, invites, profils: true, equipes: [], prix: [], quiz: 1, questions: 2 }),
      JSON.stringify({ players: invites, answers: invites.flatMap(i => [0, 1].map(q => ({ playerId: i.id, sessionId: 's1', qIndex: q, answered: true }))) }),
    )
    // Un salon qui jouait déjà il y a dix jours : pas un nouvel animateur. Sa fiche d'hier, d'avant les profils.
    const deux = invites.slice(0, 2)
    soiree.run('autre-espace', 'soiree-ancienne', a(il_y_a(10), 21), a(il_y_a(10), 23), JSON.stringify({ v: 3, invites: deux, equipes: [], prix: [], quiz: 1, questions: 1, jouees: 2 }), '{}')
    soiree.run('autre-espace', 'soiree-hier-2', a(il_y_a(1), 22), a(il_y_a(1), 23), JSON.stringify({ v: 3, invites: deux, equipes: [], prix: [], quiz: 1, questions: 2, jouees: 4 }), '{}')
    db.close()

    const lire = async <T>(chemin: string): Promise<T> => {
      const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: admin } })
      assert.equal(r.status, 200, chemin)
      return (await r.json()) as T
    }
    const page = await lire<PageDesJoueurs>('/api/admin/joueurs')
    assert.doesNotMatch(JSON.stringify(page), /un-espace|autre-espace|Un titre|Inès/, 'des soirées des autres, rien que des chiffres')

    const memoire = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    const lesJours = () => new Map((memoire.prepare('SELECT jour, chiffres FROM qg_jours').all() as { jour: string; chiffres: string }[]).map(r => [r.jour, JSON.parse(r.chiffres) as ChiffresDUnJour]))
    try {
      const jours = lesJours()
      const [avantHier, veille, hier] = [il_y_a(3), il_y_a(2), il_y_a(1)].map(j => jours.get(j)!)
      assert.ok([avantHier, veille, hier].every(c => c.v === VERSION_DE_LA_MEMOIRE))
      assert.deepEqual([avantHier.naissances, veille.naissances], [{ entree: 1 }, { jour: 1, avant: 1 }])
      assert.deepEqual([veille.lendemain, hier.lendemain], [1, 2], 'Léa le lendemain de sa naissance ; Max et Zoé aussi')
      assert.deepEqual(veille.missions, { faites: 3, profils: 1, toutes: 1 })
      assert.deepEqual([veille.questions?.jour, hier.questions?.campagne, hier.questions?.soiree], [10, 15, 6 + 4], 'la soirée d’hier apprend ses questions de son archive')
      const { confettis: payes } = gainsDesMissions(3, 1)
      assert.deepEqual([veille.confettis?.gagnes.jour, veille.confettis?.gagnes.missions, hier.confettis?.depenses.themes], [6, payes, 300])
      assert.deepEqual(
        [...(hier.soirees ?? [])].sort((x, y) => (x.espace < y.espace ? -1 : 1)),
        [
          { espace: 'autre-espace', invites: 2, profils: null },
          { espace: 'un-espace', invites: 3, profils: 1 },
        ],
      )
      assert.deepEqual(hier.nouveauxSalons, ['un-espace'])
      // Le banc vient de démarrer : ses démarrages ne couvrent aucun jour fini. Null, jamais zéro heure.
      assert.ok([...jours.values()].every(c => c.serveur === null))

      // Une version d'avant : tout se refait des journaux, la même chose — et le serveur d'hier, que la mémoire
      // savait et que ses démarrages ne savent plus, reste.
      const avant = lesJours()
      const ecriture = new Database(banc.quizDbUrl.replace(/^file:/, ''))
      ecriture.prepare("UPDATE qg_jours SET chiffres = json_set(chiffres, '$.v', 1)").run()
      ecriture.prepare(`UPDATE qg_jours SET chiffres = json_set(chiffres, '$.serveur', json('{"heures":12.5,"versions":["abc1234"]}')) WHERE jour = ?`).run(il_y_a(1))
      ecriture.close()
      await banc.redemarrer()
      await lire<PageDesJoueurs>('/api/admin/joueurs')
      const apres = lesJours()
      assert.deepEqual(apres.get(il_y_a(1))?.serveur, { heures: 12.5, versions: ['abc1234'] })
      apres.get(il_y_a(1))!.serveur = null
      assert.deepEqual(apres, avant, 'refaite des journaux, à la version du jour')
    } finally {
      memoire.close()
    }
  } finally {
    await banc.close()
  }
})

// ── Le point du matin : sa dérivation ──────────────────────────────────────

/** Les espaces de la typographie, ramenées à des espaces : la comparaison lit les mots. */
const net = (s: string) => s.replace(/[  ]/g, ' ').replace(/⁠/g, '')

/** Un jour du point, rien d'autre que ce qu'on lui donne. */
const jourVide = (jour: string, x: Partial<JourDuPoint> = {}): JourDuPoint => ({
  jour,
  joueurs: 0,
  parties: 0,
  profils: 0,
  semaine: 0,
  nes: 0,
  nesEnSoiree: 0,
  lendemain: 0,
  soirees: { nombre: 0, invites: 0, avecProfil: 0, salons: [] },
  ...x,
})

test('le point lit chaque jour de la mémoire en quelques nombres — une ligne d’avant sans ce qu’elle ne savait pas', () => {
  const heures = Array.from({ length: 24 }, () => 0)
  const ligne: ChiffresDUnJour = {
    v: VERSION_DE_LA_MEMOIRE,
    joueurs: 9,
    modes: { soiree: 7, campagne: 2, cabinet: 0, jour: 1, duel: 1 },
    parties: { soiree: 10, campagne: 2, cabinet: 0, jour: 3, duel: 1 },
    nouveauxProfils: 2,
    achats: 0,
    profils: 4,
    semaine: 6,
    mois: 9,
    invites: 8,
    heures,
    soirees: [
      { espace: 'e1', invites: 5, profils: 2 },
      { espace: 'e1', invites: 3, profils: null },
      { espace: 'e2', invites: 2, profils: 0 },
    ],
    nouveauxSalons: ['e2'],
    naissances: { soiree: 1, jour: 1 },
    lendemain: 1,
  }
  assert.deepEqual(jourDuPoint('2026-11-03', ligne), {
    jour: '2026-11-03',
    joueurs: 9,
    parties: 16,
    profils: 4,
    semaine: 6,
    nes: 2,
    nesEnSoiree: 1,
    lendemain: 1,
    soirees: {
      nombre: 3,
      invites: 10,
      avecProfil: 2,
      salons: [
        { espace: 'e1', nouveau: false },
        { espace: 'e2', nouveau: true },
      ],
    },
  })
  const { soirees, nouveauxSalons, naissances, lendemain, ...dAvant } = ligne
  assert.ok(soirees && nouveauxSalons && naissances && lendemain !== undefined)
  const lu = jourDuPoint('2026-11-03', { ...dAvant, v: 1 })
  assert.deepEqual([lu.soirees, lu.nesEnSoiree, lu.lendemain], [null, null, null])
})

test('le point du matin : la veille face à son habitude, ce qui s’écarte le plus, et une notification de nombres — jamais un salon', () => {
  const hier = '2026-11-03'
  // Sept jours d'habitude : vingt-cinq joueurs, un profil né un jour sur deux, une seule soirée de dix invités. Le jour
  // d'avant eux ne compte pas.
  const habitude = Array.from({ length: 7 }, (_, k) =>
    jourVide(jourAvant(hier, 7 - k), {
      joueurs: 25,
      parties: 35,
      profils: 18,
      nes: k % 2 ? 0 : 1,
      ...(k === 3 && { soirees: { nombre: 1, invites: 10, avecProfil: 4, salons: [{ espace: 'e-max', nouveau: true }] } }),
    }),
  )
  const laVeille: JourDuPoint = jourVide(hier, {
    joueurs: 28,
    parties: 40,
    profils: 20,
    nes: 3,
    nesEnSoiree: 2,
    lendemain: 1,
    soirees: { nombre: 1, invites: 12, avecProfil: 5, salons: [{ espace: 'e-lea', nouveau: true }] },
  })
  const entree: EntreeDuPoint = {
    hier,
    jours: [jourVide(jourAvant(hier, 8), { joueurs: 999 }), ...habitude, laVeille],
    incidents: [{ regle: 'ressenti', debut: a(hier, 21), fin: a(hier, 21.2) }],
    salons: { 'e-lea': 'Léa' },
  }
  const point = pointDuMatin({ ...entree, aTraiter: 2 })!
  assert.equal(point.date, 'mardi 3 novembre')
  assert.deepEqual(
    point.chiffres.map(c => [c.cle, c.valeur, c.habituel, c.ecart?.sens ?? null, c.ecart && net(c.ecart.texte), c.detail && net(c.detail)]),
    [
      ['joueurs', 28, 25, 'plus', '12 %', 'dont 20 profils'],
      ['nes', 3, 1, null, '1 d’habitude', 'dont 2 en soirée · 1 sur 1 né la veille a rejoué'],
      ['soirees', 1, 0, null, '0 d’habitude', '1 animateur, dont un nouveau'],
      ['invites', 12, 1, null, '1 d’habitude', '5 avec un profil, 7 sans'],
    ],
  )
  // Douze invités contre une poignée d'habitude s'écartent bien plus que vingt-huit joueurs contre vingt-cinq.
  assert.equal(point.phrase, '12 invités, quand il y en a 1 d’habitude.')
  assert.deepEqual(point.animateurs, [{ nom: 'Léa', nouveau: true }])
  assert.deepEqual(
    point.incidents.map(i => [i.nom, i.dureeMs]),
    [['Ressenti dégradé', 12 * 60_000]],
  )
  assert.equal(point.semaine, null, 'un mardi ne parle pas de la semaine')
  assert.deepEqual([point.notification.titre, net(point.notification.corps)], ['Le point du matin', 'Hier : 28 joueurs (+12 %), 3 profils nés, 1 soirée, 12 invités · 1 incident · 2 choses à traiter'])
  assert.doesNotMatch(JSON.stringify(point.notification), /Léa|e-lea|e-max/, 'un écran verrouillé se lit par-dessus l’épaule')
  assert.deepEqual(messageDuPoint(point), { ...point.notification, url: '/admin#hier', tag: 'qg-point' })

  // Rien à traiter le dit ; ce qu'on ne sait pas se tait.
  assert.match(net(pointDuMatin({ ...entree, aTraiter: 0 })!.notification.corps), /· rien à traiter$/)
  assert.match(net(pointDuMatin({ ...entree, incidents: [], aTraiter: null })!.notification.corps), /12 invités$/)
  // Une journée comme les autres ; sans soirée, ses invités se taisent.
  const pareil = pointDuMatin({ ...entree, jours: [...habitude, jourVide(hier, { joueurs: 25, parties: 35, profils: 18, nes: 1 })], incidents: [], aTraiter: 1 })!
  assert.equal(pareil.phrase, 'Une journée comme les autres.')
  assert.equal(net(pareil.notification.corps), 'Hier : 25 joueurs, 1 profil né, aucune soirée · 1 chose à traiter')
  // Sans jour d'avant, rien à comparer ; sans la veille, pas de point.
  const seul = pointDuMatin({ ...entree, jours: [laVeille], aTraiter: null })!
  assert.deepEqual([seul.phrase, seul.chiffres[0].ecart], [null, null])
  assert.equal(pointDuMatin({ ...entree, jours: habitude, aTraiter: null }), null)
})

test('le point du lundi : la semaine finie face aux quatre d’avant, complètes seulement', () => {
  const dimanche = '2026-11-08'
  const jours: JourDuPoint[] = []
  for (let k = 34; k >= 0; k--) {
    const cetteSemaine = k < 7
    const soirees = cetteSemaine ? k < 6 : k % 7 < 4
    jours.push(
      jourVide(jourAvant(dimanche, k), {
        joueurs: 30,
        profils: 10,
        // Chaque dimanche compte les profils de sa semaine.
        semaine: k % 7 === 0 ? (cetteSemaine ? 54 : 50) : 0,
        nes: cetteSemaine ? 3 : 2,
        soirees: { nombre: soirees ? 1 : 0, invites: soirees ? 15 : 0, avecProfil: 0, salons: [] },
      }),
    )
  }
  const point = pointDuMatin({ hier: dimanche, jours, incidents: [], salons: {}, aTraiter: 0 })!
  assert.equal(point.semaine?.du, '2026-11-02')
  assert.deepEqual(
    point.semaine?.chiffres.map(c => [c.cle, c.valeur, c.habituel, c.ecart && net(c.ecart.texte)]),
    [
      ['actifs', 54, 50, '8 %'],
      ['nes', 21, 14, '14 d’habitude'],
      ['soirees', 6, 4, '4 d’habitude'],
      ['invites', 90, 60, '50 %'],
    ],
  )
  assert.deepEqual([point.notification.titre, net(point.notification.corps)], ['Le point du lundi', 'La semaine : 54 profils actifs (+8 %), 21 profils nés, 6 soirées, 90 invités · rien à traiter'])
  // Une semaine à qui il manque un jour ne se dit pas : le lundi redevient un matin.
  const troue = pointDuMatin({ hier: dimanche, jours: jours.filter(j => j.jour !== jourAvant(dimanche, 3)), incidents: [], salons: {}, aTraiter: 0 })!
  assert.deepEqual([troue.semaine, troue.notification.titre], [null, 'Le point du matin'])
})

test('le réglage du point : son heure dans ses bornes et sur son pas, sa notification ; ce qui vaut d’office ne s’écrit pas', () => {
  const dOffice = pointDOffice(true)
  assert.deepEqual(dOffice, { actif: true, minutes: HEURE_DU_POINT })
  assert.equal(pointDOffice(false).actif, false, 'hors de la production, la notification attend qu’on l’allume')
  assert.deepEqual(lireLeReglageDuPoint({ minutes: 555 }, {}, dOffice), { minutes: 555 })
  assert.deepEqual(lireLeReglageDuPoint({ minutes: HEURE_DU_POINT }, { minutes: 555 }, dOffice), {}, 'revenu à l’heure d’office, rien ne s’écrit')
  assert.deepEqual(lireLeReglageDuPoint({ actif: false }, { minutes: 555 }, dOffice), { actif: false, minutes: 555 })
  assert.deepEqual(pointRegle({ actif: false }, dOffice), { actif: false, minutes: HEURE_DU_POINT })
  for (const faux of [{ minutes: 557 }, { minutes: 5 * 60 }, { minutes: 11 * 60 + 5 }, { minutes: '8:40' }]) {
    assert.throws(() => lireLeReglageDuPoint(faux, {}, dOffice), (e: Error) => net(e.message) === 'L’heure du point se règle de 6 h 00 à 11 h 00, de cinq en cinq minutes.')
  }
  assert.throws(() => lireLeReglageDuPoint({ actif: 'oui' }, {}, dOffice), /s’allume ou se coupe/)
  for (const vide of [null, {}, 'matin']) assert.throws(() => lireLeReglageDuPoint(vide, {}, dOffice), /Un réglage attendu/)
  assert.equal(net(phraseDuReglageDuPoint(dOffice, { actif: true, minutes: 555 })), 'Point du matin réglé : à 9 h 15 (avant 8 h 40)')
  assert.equal(phraseDuReglageDuPoint(dOffice, { actif: false, minutes: HEURE_DU_POINT }), 'Point du matin réglé : la notification coupée')
})

// ── Le point du matin, au banc ─────────────────────────────────────────────

/** Ce que la base permanente a servi pendant une mesure : chaque instruction, comme `qg-joueurs.test.ts`. */
const compte = { actif: false, instructions: [] as string[] }
const sqlDe = (s: unknown) => (typeof s === 'string' ? s : (s as { sql: string }).sql).replace(/\s+/g, ' ').trim()
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    if (compte.actif) compte.instructions.push(...(methode === 'batch' ? (args[0] as unknown[]) : [args[0]]).map(sqlDe))
    return origine.apply(this, args)
  }
}
async function mesurer<T>(travail: () => Promise<T>): Promise<{ instructions: string[]; resultat: T }> {
  Object.assign(compte, { actif: true, instructions: [] })
  try {
    const resultat = await travail()
    return { instructions: [...compte.instructions], resultat }
  } finally {
    compte.actif = false
  }
}

test('au banc : rien avant l’heure ; son passage écrit la veille et sonne une fois par jour, même après un redémarrage — le lundi la semaine, coupé il écrit sans sonner', async () => {
  const push = await serviceDePush()
  const horloge = { t: a(AUJOURDHUI, 8.5) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, pointDuMatinMs: 20, rappels: { servicesDePush: url => url.hostname === '127.0.0.1' } })
  const tel = push.telephone('admin')
  const recus = () => push.recus.filter(r => r.nom === 'admin').map(r => dechiffrer(r.corps, tel) as { titre: string; corps: string; url: string; tag: string })
  const attendre = async (n: number) => {
    for (let i = 0; i < 400 && recus().length < n; i++) await patienter(10)
    return recus()
  }
  const lire = async <T>(b: Banc, cookie: string, chemin: string): Promise<T> => {
    const r = await fetch(`${b.url}${chemin}`, { headers: { Cookie: cookie } })
    assert.equal(r.status, 200, chemin)
    return (await r.json()) as T
  }
  const base = () => new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  const ecrits = () => {
    const db = base()
    try {
      return {
        jours: (db.prepare('SELECT jour FROM qg_jours ORDER BY jour').all() as { jour: string }[]).map(r => r.jour),
        points: db.prepare('SELECT jour, envoye_le IS NOT NULL AS parti, telephones FROM qg_points ORDER BY jour').all() as { jour: string; parti: number; telephones: number | null }[],
      }
    } finally {
      db.close()
    }
  }
  try {
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/alertes/telephones', { abonnement: abonnementDe(tel) }, admin)).status, 200)
    // Léa, née il y a quarante jours, a joué hier.
    await inscrireProfil(banc.url, 'lea', 'Léa')
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const lea = (db.prepare("SELECT id FROM profiles WHERE login = 'lea'").get() as { id: string }).id
    db.prepare('UPDATE profiles SET created_at = ? WHERE id = ?').run(MAINTENANT - 40 * J, lea)
    db.prepare('INSERT INTO jour_parties (profile_id, jour, commencee_le, question, justes) VALUES (?, ?, ?, 10, 6)').run(lea, il_y_a(1), a(il_y_a(1), 9))
    db.close()

    // 8 h 30 : rien ne part, rien ne s'écrit — et le poste de commande ne lit rien qu'il ne sache.
    await patienter(200)
    assert.equal(recus().length, 0, 'rien avant 8 h 40')
    assert.deepEqual(ecrits(), { jours: [], points: [] })
    const { instructions: avant, resultat: tot } = await mesurer(() => lire<HierDuQg>(banc, admin, '/api/admin/qg/hier'))
    assert.deepEqual([tot.entree, tot.point], [null, { actif: true, minutes: HEURE_DU_POINT }])
    assert.deepEqual(
      avant.filter(sql => /\bqg_(jours|incidents)\b/.test(sql)),
      [],
      'la mémoire ne sait pas encore la veille : rien ne se lit',
    )

    // 8 h 41 : la mémoire de la veille s'écrit — sans une visite de la page des joueurs —, puis la notification part.
    horloge.t = a(AUJOURDHUI, 8 + 41 / 60)
    const [matin] = await attendre(1)
    assert.equal(matin.titre, 'Le point du matin')
    assert.match(net(matin.corps), /^Hier : 1 joueur \(0 d’habitude\), aucun profil né, aucune soirée · (rien à traiter|\d+ choses? à traiter)$/)
    assert.deepEqual([matin.url, matin.tag], ['/admin#hier', 'qg-point'])
    assert.doesNotMatch(JSON.stringify(matin), /Léa|lea/)
    for (let i = 0; i < 100 && ecrits().points[0]?.parti !== 1; i++) await patienter(10)
    const apres = ecrits()
    assert.equal(apres.jours.at(-1), il_y_a(1))
    assert.deepEqual(apres.points, [{ jour: AUJOURDHUI, parti: 1, telephones: 1 }])

    // « Hier, en bref » : la veille, lue une fois, puis gardée — le poste qui se relit ne lit plus rien.
    const premier = await lire<HierDuQg>(banc, admin, '/api/admin/qg/hier')
    assert.equal(premier.entree?.hier, il_y_a(1))
    assert.equal(net(pointDuMatin({ ...premier.entree!, aTraiter: null })!.notification.corps), 'Hier : 1 joueur (0 d’habitude), aucun profil né, aucune soirée')
    const { instructions: ensuite } = await mesurer(() => lire<HierDuQg>(banc, admin, '/api/admin/qg/hier'))
    assert.deepEqual(
      ensuite.filter(sql => /\bqg_(jours|incidents|points)\b/.test(sql)),
      [],
      'gardée jusqu’à minuit',
    )

    // Un redémarrage dans la matinée : la réservation tient, rien ne repart.
    await banc.redemarrer()
    await patienter(200)
    assert.equal(recus().length, 1, 'une seule notification par jour')
    assert.deepEqual(ecrits().points, [{ jour: AUJOURDHUI, parti: 1, telephones: 1 }])

    // Le lundi suivant : la semaine finie hier, face aux quatre d'avant — la mémoire, rattrapée, les a toutes.
    horloge.t = a('2026-11-09', 8.75)
    const [, lundi] = await attendre(2)
    assert.equal(lundi.titre, 'Le point du lundi')
    assert.match(net(lundi.corps), /^La semaine : 1 profil actif \(0 d’habitude\), aucun profil né, aucune soirée/)

    // Coupé, à dix heures : à 9 h rien ne s'écrit ; à 10 h 01 la veille s'écrit, et rien ne sonne.
    const admin2 = await connexionAnimateur(banc.url)
    const coupe = await ecrire(banc.url, '/api/admin/point-du-matin', { actif: false, minutes: 600 }, admin2, 'PUT')
    assert.equal(coupe.status, 200)
    const page = (await coupe.json()) as PageDesAlertes
    assert.deepEqual([page.point?.actif, page.point?.minutes, page.point?.dOffice], [false, 600, { actif: true, minutes: HEURE_DU_POINT }])
    assert.deepEqual([page.point?.dernier?.jour, page.point?.dernier?.envoyeLe !== null, page.point?.dernier?.telephones], ['2026-11-09', true, 1])
    for (const [corps, motif] of [
      [{ minutes: 557 }, /de cinq en cinq minutes/],
      [{ actif: false, minutes: 600 }, /déjà celui-là/],
    ] as const) {
      const refus = await ecrire(banc.url, '/api/admin/point-du-matin', corps, admin2, 'PUT')
      assert.equal(refus.status, 400)
      assert.match(((await refus.json()) as { error: string }).error, motif)
    }
    horloge.t = a('2026-11-10', 9)
    await patienter(200)
    assert.ok(!ecrits().jours.includes('2026-11-09'), 'avant son heure, la veille attend')
    horloge.t = a('2026-11-10', 10 + 1 / 60)
    for (let i = 0; i < 400 && !ecrits().points.some(p => p.jour === '2026-11-10'); i++) await patienter(10)
    assert.ok(ecrits().jours.includes('2026-11-09'), 'son passage écrit la veille')
    assert.deepEqual(ecrits().points.at(-1), { jour: '2026-11-10', parti: 0, telephones: null })
    await patienter(100)
    assert.equal(recus().length, 2, 'coupé, il ne sonne pas')
  } finally {
    await banc.close()
    await push.fermer()
  }
})
