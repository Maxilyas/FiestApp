// Les modes au QG 2 (le lot 5, d'après la proposition du 3 novembre 2026 :
// « Les modes aussi restent très sommaires et pas forcément très pratiques ») :
// côte à côte — la quantité, la réussite, la durée d'une partie, le retour à
// J+7, mode par mode — et le gabarit que chaque page de mode pose en tête, son
// entonnoir compris. Les dérivations sur des journaux inventés, l'horloge à la
// main ; puis un vrai serveur, qui les lit des mêmes lignes que la vue
// d'ensemble ; puis le gabarit rendu.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import React from 'react'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, inscrireProfil, type Banc } from './banc'
import { jourDe } from '../../shared/jour'
import { gainVide, releveVide } from '../../shared/profil'
import { JOURS_DU_QG, MODES_DU_QG, jourDeLInstant, minuitsDeParis, type VueDEnsemble } from '../../shared/qg'
import { activiteDeLaPeriode, totauxEntre } from '../../shared/qgPeriodes'
import {
  JOURS_DU_RETOUR,
  entonnoirDesDuels,
  entonnoirDesSoirees,
  entonnoirDuSolo,
  lignesDesModes,
  marchesDeLEntonnoir,
  mediane,
  modesCoteACote,
  partiesParJoueur,
  retourAJ7,
  seJoueEnQcm,
  type PartieDesModes,
  type SoireeDesModes,
} from '../../shared/qgModes'
import type { SoireeDUnProfil, PageDeLActivite } from '../../shared/qgActivite'
import type { SuiviDesDuels } from '../../shared/qgDuels'
import { dUneTraite } from '../../shared/tranches'

const H = 3_600_000
const MINUTE = 60_000

// Mercredi 4 novembre 2026, 21 h à Paris : les trente jours enjambent le 25 octobre, qui a vingt-cinq heures.
const maintenant = Date.UTC(2026, 10, 4, 20)
const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
const jour = (i: number) => minuits[i]

const partie = (p: Partial<PartieDesModes> & Pick<PartieDesModes, 'qui' | 'quand' | 'mode'>): PartieDesModes => ({ questions: 10, fin: null, justes: 0, qcm: 10, ...p })

test('côte à côte : la réussite aux seuls QCM, la médiane d’une partie finie, les joueurs comptés comme la participation', () => {
  const t = maintenant - 2 * H
  const parties: PartieDesModes[] = [
    // Le quiz du jour : ses questions posées qui comptent, une annulée ôtée par le serveur (`comptees`).
    partie({ qui: 'lea', quand: t, mode: 'jour', questions: 10, justes: 6, qcm: 9, fin: t + 4 * MINUTE }),
    partie({ qui: 'tom', quand: t, mode: 'jour', questions: 4, justes: 2, qcm: 3, fin: null }),
    // La campagne : deux finies, de six et huit minutes — la médiane en fait sept ; une laissée en route.
    partie({ qui: 'lea', quand: t, mode: 'campagne', questions: 14, justes: 11, qcm: 14, fin: t + 6 * MINUTE }),
    partie({ qui: 'lea', quand: t + H, mode: 'campagne', questions: 16, justes: 12, qcm: 16, fin: t + H + 8 * MINUTE }),
    partie({ qui: 'zoe', quand: t, mode: 'campagne', questions: 3, justes: 1, qcm: 3, fin: null }),
    // Le Cabinet : ses pièces se jugent chacune à sa façon — pas de réussite, mais sa durée.
    partie({ qui: 'ana', quand: t, mode: 'cabinet', questions: 6, justes: 4, qcm: null, fin: t + 3 * MINUTE }),
    // Finie après la fenêtre : sa durée n'y compte pas encore.
    partie({ qui: 'ana', quand: t, mode: 'duel', questions: 12, justes: 9, qcm: 12, fin: maintenant + MINUTE }),
    // Avant la fenêtre : rien.
    partie({ qui: 'tom', quand: t - 10 * H, mode: 'duel', questions: 12, justes: 12, qcm: 12, fin: t - 9 * H }),
  ]
  // Une soirée : trois invités qui ont joué, dont Tom et son profil ; ses QCM répondus et ses justes, dans son relevé.
  const soirees: SoireeDesModes[] = [{ quand: t, quiz: 2, joueurs: 3, jouees: 60, profils: ['tom'] }]
  const deProfils: SoireeDUnProfil[] = [{ qui: 'tom', quand: t, quiz: 2, questions: 20, qcm: 16, justes: 12 }]

  const lignes = lignesDesModes(parties, soirees, deProfils, t - H, maintenant)
  assert.deepEqual(
    lignes.map(l => l.mode),
    [...MODES_DU_QG],
    'une ligne par mode, dans l’ordre de leurs couleurs',
  )
  const de = Object.fromEntries(lignes.map(l => [l.mode, l]))
  assert.deepEqual(de.jour, { mode: 'jour', joueurs: 2, parties: 2, questions: 14, reussite: { justes: 8, sur: 12 }, duree: { medianeMs: 4 * MINUTE, finies: 1 } })
  assert.deepEqual(de.campagne, { mode: 'campagne', joueurs: 2, parties: 3, questions: 33, reussite: { justes: 24, sur: 33 }, duree: { medianeMs: 7 * MINUTE, finies: 2 } })
  assert.equal(de.cabinet.reussite, null, 'le Cabinet ne pose pas de QCM : sa réussite ne se compte pas')
  assert.deepEqual(de.cabinet.duree, { medianeMs: 3 * MINUTE, finies: 1 })
  assert.deepEqual(de.duel, { mode: 'duel', joueurs: 1, parties: 1, questions: 12, reussite: { justes: 9, sur: 12 }, duree: { medianeMs: null, finies: 0 } })
  // La soirée : ses quiz pour parties, les questions de ses invités, et la réussite que ses profils ont donnée ; un quiz ne date pas sa fin.
  assert.deepEqual(de.soiree, { mode: 'soiree', joueurs: 3, parties: 2, questions: 60, reussite: { justes: 12, sur: 16 }, duree: null })
  // Sa réussite se compte avec elle : la ligne d'un profil se date à son premier crédit, la soirée à sa première
  // question. Tenue juste avant la fenêtre et créditée dedans, une soirée n'y compte rien — « aucune partie, 75 % » ;
  // tenue dedans, sa ligne compte.
  const veille = { spaceId: 'chez-nadia', id: 'soiree-a', quand: t - H - 10 * MINUTE, quiz: 1, joueurs: 4, jouees: 40 }
  const ce = { spaceId: 'chez-nadia', id: 'soiree-b', quand: t, quiz: 1, joueurs: 4, jouees: 40 }
  const avecLeurSoiree = lignesDesModes(
    [],
    [veille, ce],
    [
      { qui: 'tom', quand: t - H + 5 * MINUTE, quiz: 1, questions: 10, qcm: 8, justes: 6, soiree: 'chez-nadia|soiree-a' },
      { qui: 'lea', quand: t + 20 * MINUTE, quiz: 1, questions: 10, qcm: 10, justes: 9, soiree: 'chez-nadia|soiree-b' },
    ],
    t - H,
    maintenant,
  )
  assert.deepEqual(avecLeurSoiree.find(l => l.mode === 'soiree')?.reussite, { justes: 9, sur: 10 })
  assert.deepEqual(
    lignesDesModes([], [veille], [{ qui: 'tom', quand: t - H + 5 * MINUTE, quiz: 1, questions: 10, qcm: 8, justes: 6, soiree: 'chez-nadia|soiree-a' }], t - H, maintenant).find(
      l => l.mode === 'soiree',
    )?.reussite,
    { justes: 0, sur: 0 },
    'sans soirée dans la période, pas de réussite',
  )

  // Un mode sans partie : des zéros, une réussite sur rien, pas de médiane — et aucune division par zéro.
  const vide = lignesDesModes([], [], [], t - H, maintenant)
  assert.deepEqual(
    vide.find(l => l.mode === 'jour'),
    { mode: 'jour', joueurs: 0, parties: 0, questions: 0, reussite: { justes: 0, sur: 0 }, duree: { medianeMs: null, finies: 0 } },
  )
  assert.equal(mediane([]), null)
  assert.equal(mediane([5, 1, 3]), 3)
  assert.equal(mediane([4, 1, 3, 10]), 3.5, 'paire : entre les deux du milieu — une partie de trois jours ne tire pas la médiane à elle')
  // Les modes de série qui posent des QCM ; une série sans mode est une série, un mode inconnu aussi — comme
  // `modeDeSerieLu` —, et `constructor` n'est pas un mode : le prototype d'un objet ne répond pas à sa place.
  assert.deepEqual(
    ['serie', 'sentier', 'sujet', 'revision', 'defi', 'duel', 'rencontre', null, 'inconnu', 'constructor', 'cabinet', 'expedition'].map(seJoueEnQcm),
    [true, true, true, true, true, true, true, true, true, true, false, false],
  )
})

test('le retour à J+7 : des joueurs d’un jour, ceux qui rejouent dans les sept jours suivants — jours de Paris, le 25 octobre compris', () => {
  const n = minuits.length
  // Le dernier jour qui a ses sept jours derrière lui : la veille d'aujourd'hui moins sept.
  const dernier = n - 2 - JOURS_DU_RETOUR
  const a = (i: number, h = 12) => jour(i) + h * H
  const parties: Pick<PartieDesModes, 'qui' | 'quand' | 'mode'>[] = [
    // Léa : un jour, puis sept jours après — elle revient ; puis huit jours après encore — elle ne revient pas.
    { qui: 'lea', quand: a(3), mode: 'jour' },
    { qui: 'lea', quand: a(10), mode: 'jour' },
    { qui: 'lea', quand: a(18), mode: 'jour' },
    // Tom : deux parties le même jour — ce n'est pas un retour.
    { qui: 'tom', quand: a(5, 9), mode: 'jour' },
    { qui: 'tom', quand: a(5, 20), mode: 'jour' },
    // Zoé : la veille d'aujourd'hui, et aujourd'hui — ni l'un ni l'autre n'a ses sept jours derrière lui.
    { qui: 'zoe', quand: a(n - 2), mode: 'jour' },
    { qui: 'zoe', quand: a(n - 1), mode: 'jour' },
    // Un autre mode ne compte pas pour celui-ci : Léa joue au Cabinet le lendemain de son quiz du jour.
    { qui: 'lea', quand: a(4), mode: 'cabinet' },
  ]
  // Le 25 octobre a vingt-cinq heures : à 23 h 30, c'est encore le 25 ; à 0 h 30, le 26 — deux jours, et un retour.
  const vingtCinq = minuits.findIndex(m => jourDe(m + 12 * H) === '2026-10-25')
  assert.equal(minuits[vingtCinq + 1] - minuits[vingtCinq], 25 * H, 'le jour du retour à l’heure d’hiver')
  const tard = minuits[vingtCinq] + 24.5 * H
  const tot = minuits[vingtCinq + 1] + 0.5 * H
  assert.deepEqual([jourDeLInstant(minuits, tard), jourDeLInstant(minuits, tot)], [vingtCinq, vingtCinq + 1])
  parties.push({ qui: 'noe', quand: tard, mode: 'campagne' }, { qui: 'noe', quand: tot, mode: 'campagne' })
  // En soirée, les profils : ceux qu'une ligne d'expérience nomme.
  const deProfils = [
    { qui: 'tom', quand: a(6, 21) },
    { qui: 'tom', quand: a(12, 21) },
  ]

  const retour = retourAJ7(parties, deProfils, minuits, maintenant)
  assert.equal(retour.jours, dernier + 1, 'les jours des trente qui ont leurs sept jours derrière eux')
  assert.equal(retour.jours, 22)
  // Léa : trois jours joués, deux dans la fenêtre — le 3 revient le 10, le 10 ne revient que le 18. Tom : un jour, sans retour. Zoé : hors des jours suivis.
  assert.deepEqual(retour.modes.jour, { revenus: 1, sur: 4 })
  // Noé : le 25 revient le 26 ; le 26 n'a pas de suite.
  assert.deepEqual(retour.modes.campagne, { revenus: 1, sur: 2 })
  // Le Cabinet de Léa, un jour sans suite ; les duels, aucun joueur : un jour sans joueur ne compte rien.
  assert.deepEqual(retour.modes.cabinet, { revenus: 0, sur: 1 })
  assert.deepEqual(retour.modes.duel, { revenus: 0, sur: 0 })
  // La soirée de Tom, six jours plus tard une autre.
  assert.deepEqual(retour.modes.soiree, { revenus: 1, sur: 2 })
  // Ce qui tombe après maintenant ou avant le premier minuit ne compte nulle part.
  const horsChamp = retourAJ7([{ qui: 'x', quand: maintenant + H, mode: 'jour' }, { qui: 'y', quand: minuits[0] - 1, mode: 'jour' }], [], minuits, maintenant)
  assert.deepEqual(horsChamp.modes.jour, { revenus: 0, sur: 0 })
})

test('côte à côte, en tranches : chaque période de la barre, la même qu’à la main, et une période par tranche', () => {
  const parties: PartieDesModes[] = [
    partie({ qui: 'lea', quand: maintenant - 20 * MINUTE, mode: 'jour', justes: 7, qcm: 10, fin: maintenant - 15 * MINUTE }),
    partie({ qui: 'tom', quand: maintenant - 5 * H, mode: 'campagne', justes: 5, qcm: 8, questions: 8, fin: maintenant - 5 * H + 9 * MINUTE }),
    partie({ qui: 'zoe', quand: jour(26) + 10 * H, mode: 'duel', justes: 4, qcm: 9, questions: 9, fin: jour(26) + 10 * H + 3 * MINUTE }),
    partie({ qui: 'ana', quand: jour(5) + 10 * H, mode: 'cabinet', qcm: null, fin: jour(5) + 10 * H + 4 * MINUTE }),
  ]
  const soirees: SoireeDesModes[] = [{ quand: jour(27) + 21 * H, quiz: 3, joueurs: 8, jouees: 240 }]
  let tranches = 0
  const calcul = modesCoteACote(parties, soirees, [], minuits, maintenant)
  let r = calcul.next()
  for (; !r.done; r = calcul.next()) tranches++
  assert.ok(tranches >= 5, `une période par tranche, puis le retour — ${tranches}`)
  assert.deepEqual(r.value, dUneTraite(modesCoteACote(parties, soirees, [], minuits, maintenant)))
  const p = r.value.periodes
  const parties1 = (periode: keyof typeof p) => Object.fromEntries(p[periode].map(l => [l.mode, l.parties]))
  // Une heure : le quiz du jour de tantôt ; 24 heures : la campagne de cet après-midi ; sept jours : le duel et la soirée ; trente : le Cabinet.
  assert.deepEqual(parties1('1h'), { soiree: 0, campagne: 0, cabinet: 0, jour: 1, duel: 0 })
  assert.deepEqual(parties1('24h'), { soiree: 0, campagne: 1, cabinet: 0, jour: 1, duel: 0 })
  assert.deepEqual(parties1('7j'), { soiree: 3, campagne: 1, cabinet: 0, jour: 1, duel: 1 })
  assert.deepEqual(parties1('30j'), { soiree: 3, campagne: 1, cabinet: 1, jour: 1, duel: 1 })
  assert.deepEqual(p['1h'].find(l => l.mode === 'jour')?.duree, { medianeMs: 5 * MINUTE, finies: 1 })
})

test('l’entonnoir : la part du départ de chaque marche, ce qui se perd en route — et ce qu’on lit déjà pour chaque mode', () => {
  assert.deepEqual(
    marchesDeLEntonnoir([
      { nom: 'Partie commencée', n: 105 },
      { nom: 'Partie finie', n: 96 },
    ]),
    [
      { nom: 'Partie commencée', n: 105, duDepart: 100, perte: null },
      { nom: 'Partie finie', n: 96, duDepart: 91, perte: 9 },
    ],
  )
  // Un départ vide, une marche vide : rien ne se divise par zéro.
  assert.deepEqual(
    marchesDeLEntonnoir([
      { nom: 'a', n: 0 },
      { nom: 'b', n: 0 },
    ]).map(m => [m.duDepart, m.perte]),
    [
      [null, null],
      [null, null],
    ],
  )
  assert.deepEqual(
    marchesDeLEntonnoir([
      { nom: 'a', n: 4 },
      { nom: 'b', n: 0 },
      { nom: 'c', n: 0 },
    ]).map(m => [m.duDepart, m.perte]),
    [
      [100, null],
      [0, 100],
      [0, null],
    ],
  )

  // Commencée, puis finie avant la fin de la période : la vue d'ensemble les compte période par période.
  const t = maintenant - 3 * H
  const solo = [
    { qui: 'lea', quand: t, mode: 'jour' as const, fin: t + 5 * MINUTE },
    { qui: 'tom', quand: t, mode: 'jour' as const, fin: null },
    { qui: 'zoe', quand: t, mode: 'campagne' as const, fin: t + 20 * MINUTE },
    // La veille à la même heure : finie trop tard pour la période d'avant, arrêtée au même instant.
    { qui: 'lea', quand: t - 24 * H, mode: 'jour' as const, fin: maintenant - 24 * H + 10 * MINUTE },
  ]
  const faits = { inscriptions: [], achats: [] }
  const totaux = totauxEntre(solo, [], faits, t - H, maintenant)
  assert.deepEqual(totaux.finies, { soiree: 0, campagne: 1, cabinet: 0, jour: 1, duel: 0 })
  const jourDe24h = activiteDeLaPeriode('24h', solo, [], faits, minuits, maintenant)
  assert.deepEqual([jourDe24h.totaux.parties.jour, jourDe24h.totaux.finies?.jour], [2, 1])
  assert.deepEqual([jourDe24h.avant?.totaux.parties.jour, jourDe24h.avant?.totaux.finies?.jour], [1, 0], 'la veille : commencée, pas finie au même instant')
  assert.deepEqual(entonnoirDuSolo(totaux, 'jour'), [
    { nom: 'Partie commencée', n: 2 },
    { nom: 'Partie finie', n: 1 },
  ])
  // Un serveur d'avant ne comptait pas les finies : pas d'entonnoir plutôt qu'un faux.
  assert.equal(entonnoirDuSolo({ parties: totaux.parties }, 'jour'), null)

  // Les soirées du mois : un quiz lancé, assez de questions pour un podium, puis close — chaque marche dans la précédente.
  const s = (quand: number, questions: number, ouverte: boolean) => ({ quand, questions, ouverte })
  const historique = [s(t, 30, false), s(t, 3, false), s(t, 12, true), s(t, 5, false), s(t - 10 * 24 * H, 40, false)]
  assert.deepEqual(entonnoirDesSoirees(historique, t - H, maintenant), [
    { nom: 'Un quiz lancé', n: 4 },
    { nom: '5 questions jouées', n: 3 },
    { nom: 'Close', n: 2 },
  ])
  // Les duels classés : lancés sur la période, et ceux joués des deux côtés.
  const lances: NonNullable<SuiviDesDuels['lancesDuMois']> = [
    { quand: t, joue: true },
    { quand: t + H, joue: false },
    { quand: t - 3 * 24 * H, joue: true },
  ]
  assert.deepEqual(entonnoirDesDuels(lances, t - H, maintenant), [
    { nom: 'Duel classé lancé', n: 2 },
    { nom: 'Joué des deux côtés', n: 1 },
  ])

  // Ce qu'un joueur y a joué, en moyenne : au dixième, et rien sans joueur — pas de division par zéro.
  const zero = { soiree: 0, campagne: 0, cabinet: 0, jour: 0, duel: 0 }
  assert.equal(partiesParJoueur({ parties: { ...zero, duel: 37 }, modes: { ...zero, duel: 9 } }, 'duel'), 4.1)
  assert.equal(partiesParJoueur({ parties: { ...zero, jour: 2 }, modes: zero }, 'jour'), null)
})

// ── Un vrai serveur ───────────────────────────────────────────────────────

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

test('un vrai serveur : les modes côte à côte lus des mêmes lignes que la vue d’ensemble — une question annulée ôtée, le Cabinet sans réussite, la soirée par ses profils', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    await inscrireProfil(banc.url, 'tom', 'Tom', '🦉')
    const idDe = (login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)
    const [lea, tom] = [idDe('lea'), idDe('tom')]
    const instant = Date.now()
    const minuitsDuBanc = minuitsDeParis(instant, JOURS_DU_QG)
    // Tantôt : dix minutes plus tôt, la veille si l'épreuve tourne juste après minuit — chaque partie y est rangée sous
    // son jour (`jourDe(tantot)`), et finie avant maintenant.
    const tantot = instant - 10 * MINUTE
    const veille = minuitsDuBanc[minuitsDuBanc.length - 2] + 12 * H
    base(banc, db => {
      const partieDuJour = db.prepare('INSERT INTO jour_parties (profile_id, jour, commencee_le, question, justes, finie_le) VALUES (?, ?, ?, ?, ?, ?)')
      // Aujourd'hui : Léa a fini, six justes sur dix posées ; Tom en est à sa cinquième, deux justes. La quatrième est annulée pour tous.
      partieDuJour.run(lea, jourDe(tantot), tantot, 10, 6, tantot + 4 * MINUTE)
      partieDuJour.run(tom, jourDe(tantot), tantot, 4, 2, null)
      db.prepare(`INSERT INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, '[]', '[3]', ?)`).run(jourDe(tantot), tantot)
      // Neuf jours plus tôt, puis sept : Léa revient dans la semaine.
      for (const k of [9, 7]) {
        const quand = minuitsDuBanc[minuitsDuBanc.length - 1 - k] + 12 * H
        partieDuJour.run(lea, jourDe(quand), quand, 10, 8, quand + 5 * MINUTE)
      }
      const serie = db.prepare('INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)')
      serie.run(randomUUID(), lea, '[]', 14, 11, veille, veille + 6 * MINUTE, 'serie')
      serie.run(randomUUID(), lea, '[]', 16, 12, veille + H, veille + H + 8 * MINUTE, 'sentier')
      serie.run(randomUUID(), lea, '[]', 6, 4, tantot, tantot + 3 * MINUTE, 'cabinet')
      serie.run(randomUUID(), tom, '[]', 12, 9, tantot, tantot + 4 * MINUTE, 'rencontre')
      // Une soirée d'hier soir : trois invités, dont Tom et son profil — son relevé dit seize QCM répondus, douze justes.
      const invites = [
        { id: 'i1', name: 'Inès', avatar: '🐱', teamId: null, points: 30, joue: true },
        { id: 'i2', name: 'Hugo', avatar: '🐶', teamId: null, points: 20, joue: true },
        { id: 'i3', name: 'Tom', avatar: '🦉', teamId: null, points: 10, joue: true, profileId: tom },
      ]
      const fiche = { v: 3, invites, profils: true, equipes: [], prix: [], quiz: 2, questions: 20, jouees: 60 }
      db.prepare(`INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES ('un-espace', 'soiree-hier', 'L’anniversaire de Léa', ?, ?, ?, '{}')`).run(
        veille + 9 * H,
        veille + 11 * H,
        JSON.stringify(fiche),
      )
      db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'soiree-hier', 'un-espace', 40, ?, ?)`).run(
        tom,
        JSON.stringify({ v: 3, gain: gainVide(), releve: { ...releveVide(), questions: 20, reponses: 18, qcm: 16, justes: 12, quizJoues: 2 } }),
        veille + 10 * H,
      )
    })

    const page = (await lire<PageDeLActivite>(banc, admin, '/api/admin/activite')).corps
    assert.ok(page.modes, 'les modes côte à côte, avec l’activité')
    const sur30 = Object.fromEntries(page.modes.periodes['30j'].map(l => [l.mode, l]))
    // Le quiz du jour : 6 + 2 + 8 + 8 justes, sur 9 + 3 + 10 + 10 questions qui comptent — la quatrième annulée ôtée là où elle a été posée.
    assert.deepEqual(sur30.jour.reussite, { justes: 24, sur: 32 })
    assert.deepEqual(sur30.jour.duree, { medianeMs: 5 * MINUTE, finies: 3 })
    assert.deepEqual(sur30.campagne.reussite, { justes: 23, sur: 30 })
    assert.deepEqual(sur30.campagne.duree, { medianeMs: 7 * MINUTE, finies: 2 })
    assert.equal(sur30.cabinet.reussite, null)
    assert.deepEqual(sur30.cabinet.duree, { medianeMs: 3 * MINUTE, finies: 1 })
    assert.deepEqual(sur30.duel.reussite, { justes: 9, sur: 12 })
    assert.deepEqual([sur30.soiree.reussite, sur30.soiree.duree, sur30.soiree.joueurs, sur30.soiree.parties], [{ justes: 12, sur: 16 }, null, 3, 2])
    // Sur une heure : ce qui s'est joué tantôt seulement.
    const surUneHeure = Object.fromEntries(page.modes.periodes['1h'].map(l => [l.mode, l.parties]))
    assert.deepEqual(surUneHeure, { soiree: 0, campagne: 0, cabinet: 1, jour: 2, duel: 1 })
    // Le retour : Léa, neuf jours plus tôt, est revenue deux jours après ; sept jours plus tôt n'a pas encore ses sept jours.
    assert.equal(page.modes.retour.jours, 22)
    assert.deepEqual(page.modes.retour.modes.jour, { revenus: 1, sur: 1 })
    // Des chiffres, rien d'autre : ni le prénom d'un invité, ni le titre d'une soirée.
    const texte = JSON.stringify(page.modes)
    for (const absent of ['Inès', 'Hugo', 'anniversaire', 'un-espace', 'Léa', 'Tom']) assert.ok(!texte.includes(absent), `« ${absent} » dans les modes`)

    // La vue d'ensemble compte, période par période, les parties finies : l'entonnoir des pages des modes.
    const vue = (await lire<VueDEnsemble>(banc, admin, '/api/admin/qg')).corps
    const jour24 = vue.periodes?.['24h'].totaux
    assert.deepEqual([jour24?.parties.jour, jour24?.finies?.jour], [2, 1], 'Léa a fini, Tom joue encore')
    assert.deepEqual([jour24?.parties.cabinet, jour24?.finies?.cabinet], [1, 1])
  } finally {
    await banc.close()
  }
})

// ── Le gabarit, rendu ─────────────────────────────────────────────────────

test('le gabarit d’un mode se lit d’un coup d’œil : ses tuiles sur la période, sa courbe, « En ce moment », son entonnoir', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#jour', origin: 'http://banc' } } })
  const { GabaritDUnMode, Chiffre, TuileParJoueur } = await import(new URL('../../client/src/components/QgModes.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const t = maintenant - 3 * H
  const solo = [
    { qui: 'lea', quand: t, mode: 'jour' as const, fin: t + 5 * MINUTE },
    { qui: 'tom', quand: t, mode: 'jour' as const, fin: null },
    { qui: 'zoe', quand: t + H, mode: 'jour' as const, fin: t + H + 6 * MINUTE },
    { qui: 'lea', quand: t - 24 * H, mode: 'jour' as const, fin: t - 24 * H + 4 * MINUTE },
  ]
  const faits = { inscriptions: [], achats: [] }
  const vue = {
    maintenant,
    periodes: { '24h': activiteDeLaPeriode('24h', solo, [], faits, minuits, maintenant) },
    aTraiter: { reserve: { joursDAvance: 9 } },
  } as unknown as VueDEnsemble
  const totaux = vue.periodes!['24h'].totaux
  // Les espaces insécables, fines ou non, lues comme des espaces : la page colle « 33 » à « % ».
  const rendre = (props: object) =>
    renderToStaticMarkup(React.createElement(GabaritDUnMode, props))
      .replace(/<!-- -->/g, '')
      .replace(/[  ]/g, ' ')
  const html = rendre({
    mode: 'jour',
    vue,
    periode: '24h',
    comparer: true,
    tuiles: React.createElement(Chiffre, { nom: 'La réserve', valeur: '9', detail: 'jours d’avance' }),
    entonnoir: { titre: 'D’une partie commencée à sa fin', etapes: entonnoirDuSolo(totaux, 'jour') },
  })
  for (const attendu of [
    'Sur les dernières 24 heures',
    'comparé à la période d’avant, arrêtée au même instant',
    '<span class="qg-tuile-nom"><i class="qg-tuile-cle qg-mode-jour" aria-hidden="true"></i>Joueurs</span><span class="qg-tuile-valeur num">3</span>',
    // Trois parties contre une la veille : sous vingt, le chiffre d'avant.
    '1 avant',
    'La réserve',
    // Le pas en mots : « seau par seau » ne se lisait que de qui l'avait écrit (la revue d'ergonomie du 4 novembre 2026).
    'Heure par heure, sur les dernières 24 heures',
    'aria-pressed="true">Joueurs</button>',
    'class="qg-mode-jour"',
    // La période d'avant, en filet, puisqu'on compare.
    'class="qg-avant"',
    'La période d’avant',
    // En ce moment : le flux n'a encore rien dit au rendu du serveur.
    'En ce moment',
    'le direct se branche…',
    'Entonnoir',
    'D’une partie commencée à sa fin',
    'Partie commencée',
    'Partie finie',
    '−33 % à cette marche · 67 % du départ',
  ]) {
    assert.ok(html.includes(attendu), `le gabarit dit « ${attendu} »`)
  }
  for (const absent of ['NaN', 'undefined', 'null']) assert.ok(!html.includes(absent), `pas de « ${absent} »`)
  // Le signe collé au nombre : au téléphone, « 100 » finissait une ligne et « % » ouvrait la suivante.
  const brut = renderToStaticMarkup(
    React.createElement(GabaritDUnMode, { mode: 'jour', vue, periode: '24h', entonnoir: { titre: 'D’une partie commencée à sa fin', etapes: entonnoirDuSolo(totaux, 'jour') } }),
  )
  assert.ok(brut.includes('33 % à cette marche') && brut.includes('67 % du départ'), 'l’insécable devant « % »')

  // La tuile de ce qu'un joueur y a joué : trois parties pour trois joueurs, une pour une la veille — son chiffre d'avant, pas un pourcentage.
  const parJoueur = renderToStaticMarkup(React.createElement(TuileParJoueur, { mode: 'jour', vue, periode: '24h', detail: 'en moyenne' })).replace(/<!-- -->/g, '')
  assert.match(parJoueur, /<span class="qg-tuile-nom">Parties par joueur<\/span><span class="qg-tuile-valeur num">1<\/span>/)
  assert.match(parJoueur, /comme avant<span aria-hidden="true"> · <\/span>en moyenne/)
  assert.match(
    renderToStaticMarkup(React.createElement(TuileParJoueur, { mode: 'duel', vue, periode: '24h', detail: 'en moyenne' })),
    /<span class="qg-tuile-valeur num">–<\/span><\/li>$/,
    'un mode sans joueur : un tiret, ni chiffre d’avant ni détail',
  )

  // Sans la vue — elle se lit encore —, il attend, sans rien inventer ; sans comparer, pas de filet ; une soirée dit ses participations.
  const enAttente = rendre({ mode: 'soiree', vue: null, periode: '7j' })
  for (const attendu of ['Sur les sept derniers jours', 'Participations', 'Chargement…', 'téléphones connectés à une soirée']) assert.ok(enAttente.includes(attendu), `« ${attendu} »`)
  assert.ok(!enAttente.includes('qg-avant') && !enAttente.includes('Entonnoir'), 'ni filet ni entonnoir sans données')
  for (const absent of ['NaN', 'undefined']) assert.ok(!enAttente.includes(absent), `pas de « ${absent} »`)

  // Le Cabinet garde ses tuiles, sur ses trente jours : le gabarit ne pose que sa courbe et « En ce moment ». Une partie
  // du Cabinet y est une épreuve de sa traversée ; aux duels, un duel — chaque côté, contre Automate compris.
  const cabinet = rendre({ mode: 'cabinet', vue, periode: '24h', sansTuiles: true, enCeMoment: React.createElement('span', null, '3 traversées en route') })
  assert.ok(!cabinet.includes('qg-chiffres') && !cabinet.includes('qg-tuile-nom'), 'ni tuiles ni « Sur les dernières 24 heures » : la page a les siennes')
  for (const attendu of ['Heure par heure, sur les dernières 24 heures', '>Épreuves</button>', 'En ce moment', '3 traversées en route']) assert.ok(cabinet.includes(attendu), `le Cabinet dit « ${attendu} »`)
  assert.ok(rendre({ mode: 'duel', vue, periode: '24h' }).includes('<span class="qg-tuile-nom"><i class="qg-tuile-cle qg-mode-duel" aria-hidden="true"></i>Duels</span>'))
})
