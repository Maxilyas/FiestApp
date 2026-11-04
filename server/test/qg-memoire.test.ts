// La mémoire longue du QG, complétée (la revue d'expert du 4 novembre 2026,
// P1.3, `retours/2026-11-04/experts/analyse-et-management.md`) : chaque jour
// fini dit aussi ses soirées et leurs salons — les nouveaux animateurs —, ses
// invités avec et sans profil, ses naissances par écran et leur lendemain, ses
// missions, ses questions jouées de chaque mode, ses confettis source par
// source, et son serveur — null quand ses démarrages ne le couvrent pas,
// jamais zéro. Une ligne d'avant se lit sans eux ; une version neuve refait
// tout des journaux et garde le serveur que les démarrages ne savent plus.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire } from './banc'
import { dUneTraite } from '../../shared/tranches'
import { jourAvant } from '../../shared/jour'
import { gainsDesMissions } from '../../shared/missions'
import { confettisParJour, sansMouvement } from '../../shared/qgEconomie'
import { couvertsDepuis, serveurDuJour, SANTE_GARDEE_MS, type DemarrageDuServeur } from '../../shared/santeDuServeur'
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
