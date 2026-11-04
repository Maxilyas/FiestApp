// Les animateurs au QG (`/admin#animateurs`, le 4 novembre 2026 — la revue
// d'analyse, P1.1 et P1.2) : le carnet de chaque salon — son rythme, son
// retard, son état, l'entonnoir d'un nouvel animateur —, les premiers pas des
// profils sur la page des joueurs, l'origine d'un quiz, et « Leur écrire »,
// qui vise les titulaires d'un état. Les dérivations pures d'abord, puis au
// banc : ce que la page dit, ce qu'elle ne dit pas, ce qu'elle lit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import React from 'react'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { baseDEssai, connexionAnimateur, creerQuiz, demarrer, ecrire, inscrireProfil, qcm, type Banc } from './banc'
import { dUneTraite } from '../../shared/tranches'
import { jourAvant } from '../../shared/jour'
import { BIT_DU_MODE, minuitDuJour, naissancesEnSoiree, partEcrite, premiersPasDesProfils, type Presence, type ProfilDeLAudience } from '../../shared/qgJoueurs'
import {
  auxProfilsDe,
  carnetEnTranches,
  entonnoirDesAnimateurs,
  etatDUnSalon,
  lireLeSegmentDesAnnonces,
  nomDuSegmentDesAnnonces,
  originesEcrites,
  rythmeDUnSalon,
  type CarnetDesAnimateurs,
  type ComptesDesAnimateurs,
  type SalonDuCarnet,
} from '../../shared/qgAnimateurs'
import { lireLOrigineDuQuiz } from '../../shared/library'
import type { EspaceDAdministration } from '../../shared/space'
import type { FicheDuJoueur } from '../../shared/profil'
import type { JournalDuQg } from '../../shared/qg'

/** Mercredi 4 novembre 2026, 21 h à Paris — l'heure d'hiver : 20 h du temps universel. */
const MAINTENANT = Date.UTC(2026, 10, 4, 20, 0)
const AUJOURDHUI = '2026-11-04'
const J = 86_400_000
const H = 3_600_000
/** Un instant d'un jour de Paris, à telle heure. */
const a = (jour: string, heure: number) => minuitDuJour(jour) + heure * H
const il_y_a = (n: number) => jourAvant(AUJOURDHUI, n)

// ── Le rythme, l'état, l'entonnoir ──────────────────────────────────────────

test('le rythme d’un salon : l’écart médian entre ses jours de soirée, au calendrier de Paris — le changement d’heure n’y change rien, deux soirées le même soir n’en font qu’un', () => {
  assert.deepEqual(rythmeDUnSalon([], AUJOURDHUI), { jours: [], rythme: null, absent: null, retard: null }, 'un salon sans soirée')
  assert.deepEqual(rythmeDUnSalon([a(il_y_a(9), 21)], AUJOURDHUI), { jours: [il_y_a(9)], rythme: null, absent: 9, retard: null }, 'une seule soirée : pas encore de rythme')
  // Le 25 octobre 2026, Paris passe à l'heure d'hiver : du samedi 24 au samedi 31 à 21 h, sept jours et une heure — sept au calendrier.
  const samedis = [a('2026-10-17', 21), a('2026-10-24', 21), a('2026-10-31', 21)]
  assert.equal(samedis[2] - samedis[1], 7 * J + H)
  assert.deepEqual(rythmeDUnSalon(samedis, AUJOURDHUI), { jours: ['2026-10-17', '2026-10-24', '2026-10-31'], rythme: 7, absent: 4, retard: -3 })
  // Deux soirées le même soir — une clôture puis une autre : un seul jour, et le rythme ne tombe pas à zéro.
  assert.equal(rythmeDUnSalon([...samedis, a('2026-10-31', 23)], AUJOURDHUI).rythme, 7)
  // La médiane, pas la moyenne : un mois sans soirée ne fait pas d'un animateur du samedi un animateur du mois.
  assert.equal(rythmeDUnSalon([a('2026-09-05', 21), a('2026-09-12', 21), a('2026-09-19', 21), a('2026-10-24', 21)], AUJOURDHUI).rythme, 7)
})

test('l’état d’un salon : le premier dont il suit la règle — jamais fidèle sur une seule soirée', () => {
  const ne = (jours: number) => a(il_y_a(jours), 12)
  const soirees = (...jours: number[]) => rythmeDUnSalon(jours.map(j => a(il_y_a(j), 21)), AUJOURDHUI)
  // Sans soirée : nouveau sa première semaine, puis à lancer, puis parti.
  assert.equal(etatDUnSalon(ne(0), soirees(), AUJOURDHUI), 'nouveau')
  assert.equal(etatDUnSalon(ne(6), soirees(), AUJOURDHUI), 'nouveau')
  assert.equal(etatDUnSalon(ne(7), soirees(), AUJOURDHUI), 'a-lancer')
  assert.equal(etatDUnSalon(ne(89), soirees(), AUJOURDHUI), 'a-lancer')
  assert.equal(etatDUnSalon(ne(90), soirees(), AUJOURDHUI), 'parti')
  // Une seule soirée : nouveau son premier mois ; passé, il n'est pas revenu — en retard.
  assert.equal(etatDUnSalon(ne(40), soirees(29), AUJOURDHUI), 'nouveau')
  assert.equal(etatDUnSalon(ne(40), soirees(30), AUJOURDHUI), 'en-retard')
  // Ses premières soirées ce mois-ci : nouveau, quel que soit son rythme.
  assert.equal(etatDUnSalon(ne(40), soirees(20, 13), AUJOURDHUI), 'nouveau')
  // Un animateur du samedi : fidèle jusqu'au double de son rythme, en retard au-delà, parti à quatre-vingt-dix jours.
  assert.equal(etatDUnSalon(ne(100), soirees(42, 35, 28, 21, 14), AUJOURDHUI), 'fidele')
  assert.equal(etatDUnSalon(ne(100), soirees(43, 36, 29, 22, 15), AUJOURDHUI), 'en-retard')
  assert.equal(etatDUnSalon(ne(200), soirees(130, 123, 116, 90), AUJOURDHUI), 'parti')
})

test('l’entonnoir d’un nouvel animateur : ouvert, un quiz, une soirée, une deuxième sous trente jours — et ceux qu’on ne juge pas encore', () => {
  const e = entonnoirDesAnimateurs(
    [
      { quiz: 0, jours: [] },
      { quiz: 2, jours: [] },
      // Son quiz effacé depuis : jouer, c'est en avoir eu un.
      { quiz: 0, jours: [il_y_a(50)] },
      { quiz: 3, jours: [il_y_a(50), il_y_a(40)] },
      // Une deuxième, mais quarante jours après la première.
      { quiz: 3, jours: [il_y_a(80), il_y_a(40)] },
      // La première il y a dix jours : la dernière marche ne la juge pas encore.
      { quiz: 1, jours: [il_y_a(10)] },
    ],
    AUJOURDHUI,
  )
  assert.deepEqual(
    e.marches.map(m => [m.nom, m.n]),
    [
      ['Un salon ouvert', 6],
      ['Un premier quiz', 5],
      ['Une première soirée', 4],
      ['Une deuxième sous 30 jours', 1],
    ],
  )
  assert.equal(e.enAttente, 1)
})

// ── Les naissances en soirée, les premiers pas ──────────────────────────────

const profil = (id: string, cree: number, origine: ProfilDeLAudience['origine']): ProfilDeLAudience => ({ id, cree, suspendu: false, origine })

test('un profil né pendant une soirée est né à la première qui le compte, à douze heures au plus — né à sa fin, la page ne devine pas', () => {
  const s1 = { quand: a(il_y_a(10), 21), profils: ['zoe', 'ana'] }
  const s2 = { quand: a(il_y_a(9), 21), profils: ['zoe', 'max'] }
  const s3 = { quand: a(il_y_a(2), 21), profils: ['hugo', 'sam'] }
  const nes = naissancesEnSoiree(
    [s3, s2, s1],
    [
      profil('zoe', a(il_y_a(10), 20.5), 'entree'),
      profil('max', a(il_y_a(9), 23), 'soiree'),
      // Né à l'entrée, mais quatre jours avant la soirée qui le compte : une autre soirée, qu'il n'a pas jouée.
      profil('hugo', a(il_y_a(6), 21), 'entree'),
      // Né à la fin : il a joué sans profil, et sa soirée ne le compte pas.
      profil('sam', a(il_y_a(2), 23), 'fin-de-soiree'),
      profil('ana', a(il_y_a(300), 12), null),
    ],
  )
  assert.deepEqual([nes.get(s1), nes.get(s2), nes.get(s3)], [['zoe'], ['max'], undefined])
})

test('les premiers pas : semaine par semaine et écran par écran, chaque part sur ceux dont le délai est passé, le pont, et ce que chaque soirée close a fait naître', () => {
  const profils = [
    profil('p1', a(il_y_a(10), 20.5), 'entree'),
    profil('p2', a(il_y_a(9), 22), 'soiree'),
    profil('p3', a(il_y_a(1), 10), 'accueil'),
    profil('p4', a(AUJOURDHUI, 9), null),
    profil('p5', a(il_y_a(8), 12), 'fin-de-soiree'),
    // Né il y a cent jours : hors des neuf semaines.
    profil('vieux', a(il_y_a(100), 12), 'jour'),
    profil('x', a(il_y_a(300), 12), null),
    profil('y', a(il_y_a(300), 12), null),
  ]
  const presences = new Map<string, Presence[]>()
  const joue = (jour: string, qui: string, modes: number) => presences.set(jour, [...(presences.get(jour) ?? []), { jour, qui, modes, premiere: 600 }])
  joue(il_y_a(10), 'p1', BIT_DU_MODE.soiree)
  joue(il_y_a(9), 'p1', BIT_DU_MODE.jour)
  joue(il_y_a(7), 'p1', BIT_DU_MODE.campagne)
  joue(il_y_a(9), 'p2', BIT_DU_MODE.soiree)
  joue(il_y_a(6), 'p5', BIT_DU_MODE.jour)
  const s1 = { quand: a(il_y_a(10), 21), joueurs: 12, profils: ['p1', 'x', 'y'] }
  const s2 = { quand: a(il_y_a(9), 21), joueurs: 5, profils: ['p2'] }
  const pp = premiersPasDesProfils(
    profils,
    presences,
    [
      s1,
      s2,
      // Encore ouverte, d'il y a quarante jours, d'une fiche qui ne dit pas ses profils : rien de tout cela ne se détaille.
      { quand: a(AUJOURDHUI, 20), joueurs: 7, profils: ['x'], ouverte: true },
      { quand: a(il_y_a(40), 21), joueurs: 9, profils: ['y'] },
      { quand: a(il_y_a(2), 21), joueurs: 4 },
    ],
    AUJOURDHUI,
    MAINTENANT,
  )
  assert.equal(pp.semaines.length, 9)
  assert.deepEqual(pp.semaines.slice(0, 3), ['2026-11-02', '2026-10-26', '2026-10-19'])
  assert.deepEqual(
    pp.ecrans.map(e => e.origine),
    ['tous', 'accueil', 'entree', 'fin-de-soiree', 'soiree', null],
    'tous d’abord, ceux d’avant l’origine en dernier',
  )
  const tous = pp.ecrans[0].total
  assert.equal(tous.nes, 5, 'né ce matin, il compte parmi les nés — et dans aucune part')
  assert.deepEqual([tous.jourMeme, tous.lendemain, tous.deuxJours, tous.secondMode, tous.jamais], [
    { n: 2, sur: 4 },
    { n: 1, sur: 3 },
    { n: 1, sur: 3 },
    { n: 1, sur: 3 },
    { n: 1, sur: 4 },
  ])
  // La semaine d'un profil est celle de sa naissance, du lundi au dimanche : p1 né un dimanche, p2 le lundi d'après.
  const semaine = (lundi: string) => pp.ecrans[0].parSemaine[pp.semaines.indexOf(lundi)]
  assert.equal(semaine('2026-10-19').nes, 1)
  assert.equal(semaine('2026-10-26').nes, 2)
  assert.equal(semaine('2026-11-02').nes, 2)
  // Le pont : p1 et p5, nés en soirée — p5 à sa fin —, ont joué seuls leur première semaine ; p2 non.
  assert.deepEqual(pp.pont, { n: 2, sur: 3 })
  // Soirée par soirée, la plus récente d'abord : venus avec un profil, nés pendant elle, venus sans.
  assert.deepEqual(pp.soirees, [
    { quand: s2.quand, invites: 5, avecUnProfil: 0, nes: 1, sansProfil: 5 },
    { quand: s1.quand, invites: 12, avecUnProfil: 2, nes: 1, sansProfil: 10 },
  ])
  // Sous vingt, « 4 sur 9 » ; dès vingt, un pourcentage ; sur personne, rien.
  assert.deepEqual([partEcrite(4, 9), partEcrite(9, 20), partEcrite(0, 0)], ['4 sur 9', '45 %', '–'])
})

// ── Le carnet ───────────────────────────────────────────────────────────────

test('le carnet : chaque salon ses soirées, sa salle médiane, ses invités venus avec un profil, ses profils nés, ses quiz prêts par origine — et chaque état ses titulaires', () => {
  const salon = (spaceId: string, neLe: number, titulaire: SalonDuCarnet['titulaire'], prets: SalonDuCarnet['quiz']['prets'] = []): SalonDuCarnet => ({
    spaceId,
    nom: `Le salon de ${spaceId}`,
    titulaire,
    toi: spaceId === 'moi',
    neLe,
    quiz: { total: prets.length + 1, prets },
  })
  const t = (id: string, suspendu = false) => ({ id, nom: id, login: id, suspendu })
  const salons = [
    salon('lea', a(il_y_a(60), 12), t('lea'), ['tout-pret', 'tout-pret', 'modele', null]),
    salon('tom', a(il_y_a(90), 12), t('tom', true)),
    salon('nadia', a(il_y_a(10), 12), null),
    salon('moi', a(il_y_a(3), 12), t('moi')),
  ]
  const soiree = (spaceId: string, jours: number, joueurs: number, profils?: string[]) => ({ spaceId, quand: a(il_y_a(jours), 21), joueurs, ...(profils && { profils }) })
  const soirees = [
    soiree('lea', 35, 8, ['lea']),
    soiree('lea', 28, 10, ['lea']),
    soiree('lea', 21, 12),
    soiree('lea', 14, 9, ['lea']),
    soiree('lea', 7, 11, ['lea', 'zoe', 'max']),
    soiree('tom', 60, 6, ['tom']),
    soiree('tom', 53, 6, ['tom']),
    soiree('tom', 46, 6, ['tom']),
    // Un espace qui n'est plus ouvert : sa soirée ne compte pour personne.
    soiree('bob', 3, 20, ['zoe']),
  ]
  const profils = [profil('zoe', a(il_y_a(7), 20.8), 'entree'), profil('max', a(il_y_a(7), 22), 'soiree')]
  const c = dUneTraite(carnetEnTranches(salons, soirees, profils, MAINTENANT))
  const lea = c.salons.find(l => l.spaceId === 'lea')!
  assert.deepEqual(
    {
      etat: lea.etat,
      soirees: lea.soirees,
      recentes: lea.soireesRecentes,
      rythme: lea.rythme,
      absent: lea.absent,
      retard: lea.retard,
      invites: lea.invites,
      avecProfil: lea.avecProfil,
      nes: lea.nesChezLui,
      premiere: lea.premiere,
      derniere: lea.derniere,
    },
    {
      etat: 'fidele',
      soirees: 5,
      recentes: 5,
      rythme: 7,
      absent: 7,
      retard: 0,
      invites: 10,
      // Une fiche d'avant le 14 octobre 2026 ne dit pas ses profils : sa salle n'entre pas dans la part (8 + 10 + 9 + 11).
      avecProfil: { profils: 6, invites: 38 },
      nes: 2,
      premiere: a(il_y_a(35), 21),
      derniere: a(il_y_a(7), 21),
    },
  )
  assert.deepEqual(lea.quiz, {
    total: 5,
    prets: 4,
    parOrigine: [
      { origine: 'tout-pret', prets: 2 },
      { origine: 'modele', prets: 1 },
      { origine: null, prets: 1 },
    ],
  })
  assert.equal(originesEcrites(lea.quiz.parOrigine), '2 tout prêts, 1 modèle, 1 d’avant le 4 novembre')
  assert.equal(c.salons.find(l => l.spaceId === 'tom')?.etat, 'en-retard')
  assert.deepEqual(
    c.etats.map(e => [e.etat, e.salons, e.titulaires]),
    [
      ['a-lancer', 1, 0],
      ['nouveau', 1, 1],
      ['fidele', 1, 1],
      // Tom est suspendu : une annonce ne le toucherait pas.
      ['en-retard', 1, 0],
      ['parti', 0, 0],
    ],
  )
  // Chaque salon a un quiz ; Léa et Tom ont joué, et chacun est revenu dans la semaine — Tom, depuis, ne revient plus.
  assert.deepEqual(
    [c.entonnoir.marches.map(m => m.n), c.entonnoir.enAttente],
    [[4, 4, 2, 2], 0],
  )
})

test('les segments des annonces : ceux des joueurs, puis les animateurs, tous ou d’un état — refusés plutôt que devinés', () => {
  assert.equal(lireLeSegmentDesAnnonces('animateurs:en-retard'), 'animateurs:en-retard')
  assert.equal(lireLeSegmentDesAnnonces('animateurs'), 'animateurs')
  assert.equal(lireLeSegmentDesAnnonces('endormis'), 'endormis')
  assert.equal(lireLeSegmentDesAnnonces(undefined), null)
  assert.throws(() => lireLeSegmentDesAnnonces('animateurs:absents'), /Ce segment n’existe pas/)
  assert.deepEqual(
    [auxProfilsDe('animateurs:en-retard'), auxProfilsDe('animateurs'), auxProfilsDe('endormis')],
    ['aux animateurs en retard', 'aux animateurs', 'aux endormis'],
  )
  assert.equal(nomDuSegmentDesAnnonces('animateurs:nouveau'), 'Nouveaux animateurs')
  // L'origine d'un quiz que la page envoie : un des trois chemins qui passent par `POST /api/quizzes`, sinon une page d'avant.
  assert.deepEqual(['liste', 'import', 'editeur', 'modele', undefined].map(lireLOrigineDuQuiz), ['liste', 'import', 'editeur', 'inconnue', 'inconnue'])
})

// ── Au banc ─────────────────────────────────────────────────────────────────

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

const lire = async <T>(banc: Banc, cookie: string, chemin: string): Promise<T> => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })
  const corps = (await r.json()) as T & { error?: string }
  assert.equal(r.status, 200, `${chemin} : ${r.status} ${corps.error ?? ''}`)
  return corps
}

/** Les plans des lectures d'une mesure : aucune ne parcourt la table des soirées ni celle des profils. */
function parcourues(banc: Banc, instructions: readonly string[]): string[] {
  const lecteur = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  try {
    return instructions.filter(sql => {
      if (!/^SELECT\b/i.test(sql) || !/\b(soirees|profiles|quizzes)\b/.test(sql)) return false
      const numerotes = [...sql.matchAll(/\?(\d+)/g)].map(m => Number(m[1]))
      const parametres = numerotes.length > 0 ? Math.max(...numerotes) : (sql.match(/\?/g) ?? []).length
      const plan = lecteur.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...Array<null>(parametres).fill(null)) as { detail: string }[]
      return plan.some(e => /^SCAN (soirees|profiles|quizzes)\b(?! USING)/.test(e.detail))
    })
  } finally {
    lecteur.close()
  }
}

test('au banc : le carnet — ses états, ses soirées lues une fois par jour, ni titre ni prénom d’invité —, la fiche d’un titulaire, et « Leur écrire » aux seuls titulaires d’un état', async () => {
  const horloge = { t: MAINTENANT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const admin = await connexionAnimateur(banc.url)
    // Léa, Tom et Bob ouvrent leur salon ; Nadia a un compte d'avant, sans profil ; Bob est désactivé.
    const cookies: Record<string, string> = {}
    for (const [login, nom] of [
      ['lea', 'Léa'],
      ['tom', 'Tom'],
      ['bob', 'Bob'],
    ] as const) {
      cookies[login] = await inscrireProfil(banc.url, login, nom)
      assert.ok((await ecrire(banc.url, '/api/joueur/espace', {}, cookies[login])).status < 300)
    }
    assert.ok((await ecrire(banc.url, '/api/admin/accounts', { login: 'nadia', name: 'Chez Nadia', slug: 'chez-nadia' }, admin)).status < 300)
    // Zoé et Max naissent pendant une soirée de Léa ; Sam à sa fin — la page ne devine pas où.
    for (const [login, origine] of [
      ['zoe', 'entree'],
      ['max', 'soiree'],
      ['sam', 'fin-de-soiree'],
    ] as const) {
      assert.equal((await ecrire(banc.url, '/api/joueur/inscription', { login, password: 'motdepasse1', name: login, avatar: '🦊', origine })).status, 201)
    }
    const espaces = await lire<EspaceDAdministration[]>(banc, admin, '/api/admin/espaces')
    const salonDe = (nom: string) => espaces.find(e => e.titulaire?.nom === nom)!.id
    const [lea, tom, bob] = ['Léa', 'Tom', 'Bob'].map(salonDe)
    const nadia = espaces.find(e => e.login === 'nadia')!.id
    const toi = espaces.find(e => e.toi)!.id
    assert.ok((await ecrire(banc.url, `/api/admin/accounts/${bob}/disable`, {}, admin)).status < 300)

    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const ids = Object.fromEntries((db.prepare('SELECT login, id FROM profiles').all() as { login: string; id: string }[]).map(p => [p.login, p.id]))
    const naissance = db.prepare('UPDATE accounts SET created_at = ? WHERE id = ?')
    for (const [id, jours] of [
      [lea, 60],
      [tom, 90],
      [bob, 30],
      [nadia, 10],
      [toi, 40],
    ] as const)
      naissance.run(a(il_y_a(jours), 12), id)
    const ne = db.prepare('UPDATE profiles SET created_at = ? WHERE id = ?')
    ne.run(a(il_y_a(7), 20) + 50 * 60_000, ids.zoe)
    ne.run(a(il_y_a(7), 22), ids.max)
    ne.run(a(il_y_a(7), 23.5), ids.sam)
    // Les fiches des soirées : un titre et des prénoms d'invités que la page ne doit jamais dire.
    const soiree = db.prepare("INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, 'L’anniversaire de Léa', ?, ?, ?, '{}')")
    let n = 0
    const ficheDeSoiree = (joueurs: number, profils: string[]) =>
      JSON.stringify({
        v: 3,
        invites: Array.from({ length: joueurs }, (_, i) => ({ id: `i-${i}`, name: 'Camille', avatar: '🦊', teamId: null, points: 10, joue: true, ...(profils[i] && { profileId: profils[i] }) })),
        profils: true,
        equipes: [],
        prix: [],
        quiz: 2,
        questions: 24,
        jouees: joueurs * 24,
      })
    const jouer = (spaceId: string, quand: number, joueurs: number, profils: string[]) => soiree.run(spaceId, `soiree-${n++}`, quand, quand + 2 * H, ficheDeSoiree(joueurs, profils))
    // Léa, un samedi sur deux… tous les sept jours, deux soirées le dernier soir — le changement d'heure du 25 octobre au milieu.
    for (const [jours, joueurs] of [
      [35, 8],
      [28, 10],
      [21, 12],
      [14, 9],
    ] as const)
      jouer(lea, a(il_y_a(jours), 21), joueurs, [ids.lea])
    jouer(lea, a(il_y_a(7), 21), 11, [ids.lea, ids.zoe, ids.max])
    jouer(lea, a(il_y_a(7), 23), 3, [ids.lea])
    // Tom a joué trois samedis, il y a deux mois : en retard.
    for (const jours of [60, 53, 46]) jouer(tom, a(il_y_a(jours), 21), 6, [ids.tom])
    jouer(bob, a(il_y_a(20), 21), 5, [ids.bob])
    // L'administrateur, ce soir : sa première soirée, lue avec celles d'aujourd'hui.
    jouer(toi, a(AUJOURDHUI, 19), 4, [])
    db.close()
    // Les comptes vivent en mémoire : leur naissance réécrite se relit au démarrage.
    await banc.redemarrer()

    const { instructions: premiere, resultat: carnet } = await mesurer(() => lire<CarnetDesAnimateurs>(banc, admin, '/api/admin/animateurs'))
    const ligne = (spaceId: string) => carnet.salons.find(l => l.spaceId === spaceId)!
    assert.equal(carnet.desactives, 1)
    assert.ok(!carnet.salons.some(l => l.spaceId === bob), 'un espace désactivé ne compte pas')
    const deLea = ligne(lea)
    assert.deepEqual(
      [deLea.nom, deLea.titulaire, deLea.etat, deLea.soirees, deLea.rythme, deLea.absent, deLea.retard, deLea.invites, deLea.avecProfil, deLea.nesChezLui, deLea.derniere],
      ['Le salon de Léa', { id: ids.lea, nom: 'Léa', login: 'lea', suspendu: false }, 'fidele', 6, 7, 7, 0, 9.5, { profils: 8, invites: 53 }, 2, a(il_y_a(7), 23)],
    )
    assert.deepEqual([ligne(tom).etat, ligne(tom).retard], ['en-retard', 39])
    assert.deepEqual([ligne(nadia).etat, ligne(nadia).titulaire], ['a-lancer', null])
    assert.deepEqual([ligne(toi).etat, ligne(toi).toi, ligne(toi).premiere], ['nouveau', true, a(AUJOURDHUI, 19)])
    // Les quiz livrés de l'amorce sont des modèles : les quiz prêts de l'administrateur le disent.
    assert.ok(ligne(toi).quiz.parOrigine.some(o => o.origine === 'modele' && o.prets > 0))
    // Des soirées des autres, le salon et des chiffres : ni leur titre, ni un prénom d'invité.
    assert.doesNotMatch(JSON.stringify(carnet), /anniversaire|Camille/)

    // Ce qu'il lit : les soirées des jours finis une fois — puis seulement celles d'aujourd'hui —, par l'index de leur date.
    const desSoirees = (instructions: string[]) => instructions.filter(sql => /\bFROM soirees\b/.test(sql)).length
    assert.equal(desSoirees(premiere), 2)
    assert.deepEqual(parcourues(banc, premiere), [])
    const { instructions: encore } = await mesurer(() => lire<CarnetDesAnimateurs>(banc, admin, '/api/admin/animateurs'))
    assert.equal(desSoirees(encore), 1, 'rouvert le même jour : aujourd’hui seulement')
    assert.deepEqual(parcourues(banc, encore), [])

    // La fiche de Léa dit son salon au carnet ; celle de Zoé, qui n'en tient pas, rien.
    const fiche = await lire<FicheDuJoueur>(banc, admin, `/api/admin/profils/${ids.lea}`)
    assert.deepEqual(fiche.animateur, { etat: 'fidele', derniere: a(il_y_a(7), 23) })
    assert.equal((await lire<FicheDuJoueur>(banc, admin, `/api/admin/profils/${ids.zoe}`)).animateur, undefined)

    // « Leur écrire » : les titulaires des salons en retard — Tom seul.
    const comptes = await lire<ComptesDesAnimateurs>(banc, admin, '/api/admin/animateurs/segments')
    assert.deepEqual([comptes.comptes['animateurs:en-retard'], comptes.comptes['animateurs:fidele'], comptes.comptes['animateurs:a-lancer']], [1, 1, 0])
    const annonce = await ecrire(banc.url, '/api/admin/annonces', { id: 'aux-retards', message: 'Une soirée ce samedi ?', confettis: 0, segment: 'animateurs:en-retard' }, admin)
    assert.equal(annonce.status, 200)
    const lecteur = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    try {
      assert.deepEqual(lecteur.prepare("SELECT profile_id FROM qg_annonce_destinataires WHERE annonce_id = 'aux-retards'").all(), [{ profile_id: ids.tom }])
      assert.deepEqual(lecteur.prepare("SELECT segment FROM qg_annonce_segments WHERE annonce_id = 'aux-retards'").all(), [{ segment: 'animateurs:en-retard' }])
    } finally {
      lecteur.close()
    }
    const journal = await lire<JournalDuQg>(banc, admin, '/api/admin/gestes?sorte=annonce')
    assert.equal(journal.gestes[0]?.resume, 'Annonce aux animateurs en retard (1 profil) : « Une soirée ce samedi ? »')
    // Un état sans titulaire à toucher se refuse : l'annonce ne parlerait à personne.
    assert.equal((await ecrire(banc.url, '/api/admin/annonces', { id: 'aux-partis', message: 'Coucou', confettis: 0, segment: 'animateurs:parti' }, admin)).status, 400)

    // Le lendemain : les soirées d'hier deviennent des jours finis, relus une fois.
    horloge.t += J
    const { instructions: lendemain } = await mesurer(() => lire<CarnetDesAnimateurs>(banc, admin, '/api/admin/animateurs'))
    assert.equal(desSoirees(lendemain), 2)
    // Le carnet se lit à l'administrateur seul.
    for (const chemin of ['/api/admin/animateurs', '/api/admin/animateurs/segments']) {
      assert.ok([401, 403].includes((await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookies.lea } })).status), chemin)
    }
  } finally {
    await banc.close()
  }
})

test('au banc : chaque quiz dit d’où il vient — la page pour l’éditeur, une liste, un fichier ; la route pour un modèle, un quiz tout prêt, un code, le catalogue ; une copie garde son origine', async () => {
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(60) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const creer = async (corps: Record<string, unknown>) => {
      const r = await ecrire(banc.url, '/api/quizzes', { title: 'Un quiz', questions: [qcm('Vrai ?')], ...corps }, admin)
      assert.equal(r.status, 201)
      return ((await r.json()) as { id: string }).id
    }
    const liste = await creer({ title: 'Ma liste', origine: 'liste' })
    await creer({ title: 'Mon fichier', origine: 'import' })
    await creer({ title: 'À la main', origine: 'editeur' })
    // Une page d'avant ne dit rien ; une origine inventée ne passe pas.
    await creer({ title: 'D’une page d’avant' })
    await creer({ title: 'Inventée', origine: 'catalogue' })
    assert.equal((await ecrire(banc.url, '/api/modeles/anniversaire', {}, admin)).status, 201)
    const toutPret = await ecrire(banc.url, '/api/quiz-tout-pret', { categories: [], sujet: null, difficulte: 'facile', nombre: 10, enfants: false, estimations: false }, admin)
    assert.equal(toutPret.status, 201, `tout prêt : ${((await toutPret.clone().json()) as { error?: string }).error ?? ''}`)
    assert.equal((await ecrire(banc.url, `/api/quizzes/${liste}/duplicate`, {}, admin)).status, 201)
    const partage = (await (await ecrire(banc.url, `/api/quizzes/${liste}/partage`, {}, admin)).json()) as { code: string }
    assert.equal((await ecrire(banc.url, '/api/partages/recevoir', { code: partage.code }, admin)).status, 201)
    const propose = (await (await ecrire(banc.url, `/api/quizzes/${liste}/catalogue`, { description: 'Pour tous' }, admin)).json()) as { id: string }
    assert.ok((await ecrire(banc.url, `/api/admin/catalogue/${propose.id}`, { statut: 'publie' }, admin)).status < 300)
    assert.equal((await ecrire(banc.url, `/api/catalogue/${propose.id}`, {}, admin)).status, 201)

    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    try {
      const origines = (db.prepare('SELECT title, origine FROM quizzes ORDER BY created_at, rowid').all() as { title: string; origine: string | null }[]).map(q => q.origine)
      assert.deepEqual(origines.slice(0, 2), ['modele', 'modele'], 'les quiz d’amorce, des modèles livrés')
      assert.deepEqual(origines.slice(2), ['liste', 'import', 'editeur', 'inconnue', 'inconnue', 'modele', 'tout-pret', 'liste', 'partage', 'catalogue'])
    } finally {
      db.close()
    }
    // Le carnet les compte parmi les quiz prêts de l'espace, sans rien relire : la bibliothèque est en mémoire.
    const { instructions, resultat: carnet } = await mesurer(() => lire<CarnetDesAnimateurs>(banc, admin, '/api/admin/animateurs'))
    assert.deepEqual(instructions.filter(sql => /\bFROM quizzes\b/.test(sql)), [])
    const moi = carnet.salons.find(l => l.toi)!
    // Douze quiz, dix prêts : « Qui le connaît ? », de l'amorce, et l'anniversaire attendent leurs réponses — un modèle à trous n'est pas prêt.
    assert.deepEqual([moi.quiz.total, moi.quiz.prets], [12, 10])
    assert.deepEqual(
      Object.fromEntries(moi.quiz.parOrigine.map(o => [o.origine, o.prets])),
      { modele: 1, liste: 2, import: 1, editeur: 1, inconnue: 2, 'tout-pret': 1, partage: 1, catalogue: 1 },
    )
  } finally {
    await banc.close()
  }
})

test('« Les salons », l’onglet du carnet : la dernière soirée de chacun, plus « vu » — l’ouverture d’une console se dit pour ce qu’elle est', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#salons', origin: 'http://banc' } } })
  const module = await import(new URL('../../client/src/components/AdminSalons.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const espace = (e: Partial<EspaceDAdministration>): EspaceDAdministration => ({
    id: 'x', login: 'p-k3x9', name: 'Léa', slug: 's-k3x9', role: 'host', status: 'active', createdAt: 0, lastLoginAt: Date.now() - 60_000,
    salon: true, titulaire: { nom: 'Antoine', avatar: '🦁' }, quiz: 2, toi: false, ...e,
  })
  const html = renderToStaticMarkup(
    React.createElement(module.AdminSalons, {
      espaces: [espace({ id: 'a' }), espace({ id: 'b', titulaire: { nom: 'Bea', avatar: '🦊' } }), espace({ id: 'c', titulaire: { nom: 'Chloé', avatar: '🦉' }, status: 'disabled' })],
      dernieres: new Map([
        ['a', a('2026-10-31', 21)],
        ['b', null],
      ]),
      onChange: () => {},
    }),
  )
  assert.match(html, /s-k3x9 · 2 quiz · dernière soirée le 31 octobre/)
  assert.match(html, /s-k3x9 · 2 quiz · pas encore de soirée/)
  assert.doesNotMatch(html, / · vu /, 'la console ouverte ne passe plus pour une soirée')
})
