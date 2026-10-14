// La page des signalements du QG (`/admin#signalements`, le choix du 14
// octobre 2026 — « Est-ce que j'ai une page de monitoring pour les
// signalements, me permettant de reclasser la question, la modifier, la
// supprimer ? ») : ce que les joueurs signalent au quiz du jour et en
// campagne, réuni sur une page ; les mêmes gestes partout — corriger,
// reclasser, retirer, garder, et au quiz du jour annuler ses points pour
// tous ; chaque geste écrit son issue sur les signalements qu'il referme,
// que l'historique des trente jours relit ; et le joueur dont la remarque a
// servi en est remercié sur son accueil, une fois.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import React from 'react'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { JourStore } from '../src/core/jour'
import { extrait } from '../src/core/journalDesGestes'
import { CATEGORIES } from '../../shared/categories'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { toPlayable } from '../../shared/library'
import { phraseDuMerci, type AnnonceDeLAdministrateur } from '../../shared/profil'
import {
  QUESTION_DU_MERCI,
  classementEcrit,
  compteDesRelus,
  corrigeAussiLeJour,
  detailDeLaCorrection,
  issueDuRelu,
  lireLeClassement,
  nomDuSousTheme,
  placesDuJour,
  trierLesSignalements,
  type PageDesSignalements,
  type SignalementDuJour,
  type SignalementRelu,
  type VersionLue,
} from '../../shared/qgSignalements'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
const JOUR = '2026-09-26'

type Reponse = { status: number; corps: any }
const lire = (banc: Banc, cookie: string, chemin: string): Promise<Reponse> =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: await r.json() }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}): Promise<Reponse> =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: await r.json() }))
const page = async (banc: Banc, admin: string) => (await lire(banc, admin, '/api/admin/signalements')).corps as PageDesSignalements

/** La base permanente du banc, lue telle quelle. */
function base<T>(banc: Banc, lecture: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return lecture(db)
  } finally {
    db.close()
  }
}

interface QuestionTiree {
  reserveId: string
  texte: string
  reponses: string[]
  bonne: number
  categorie: string | null
  anecdote: string | null
}

const tirage = (banc: Banc): QuestionTiree[] =>
  base(banc, db => JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(JOUR) as { questions: string }).questions))
const annulees = (banc: Banc): number[] => base(banc, db => JSON.parse((db.prepare('SELECT annulees FROM jour_tirages WHERE jour = ?').get(JOUR) as { annulees: string }).annulees))

/** Une question de la réserve, telle que ses prochains tirages la poseront. */
function laReserve(banc: Banc, id: string) {
  const r = base(banc, db => db.prepare('SELECT question, categorie, metadonnees FROM jour_reserve WHERE id = ?').get(id) as { question: string; categorie: string | null; metadonnees: string | null })
  const def = JSON.parse(r.question)
  const p = toPlayable({ ...def, id })
  assert.ok(p && p.kind === 'choice')
  return { texte: p.text, reponses: p.answers, bonne: p.correct, anecdote: p.anecdote ?? null, categorie: r.categorie, enJson: def.category ?? null, meta: r.metadonnees ? JSON.parse(r.metadonnees) : null }
}

/** Joue toute la partie du jour : `juste(i)` dit s'il trouve la question i. */
async function jouer(banc: Banc, cookie: string, juste: (i: number) => boolean) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = tirage(banc)
  while (etat.question) {
    const i = etat.question.index
    const choix = juste(i) ? questions[i].bonne : (questions[i].bonne + 1) % questions[i].reponses.length
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
}

/** Les mercis de son accueil, le plus récent d'abord. */
const mercisDe = async (banc: Banc, cookie: string): Promise<Extract<AnnonceDeLAdministrateur, { sorte: 'merci' }>[]> =>
  ((await lire(banc, cookie, '/api/joueur/moi?accueil')).corps.profile.annonces ?? []).filter((a: AnnonceDeLAdministrateur) => a.sorte === 'merci')

// ── Les règles pures ──────────────────────────────────────────────────────

test('reclasser se relit : une catégorie de la liste, un sous-thème de cette catégorie, une difficulté de 1 à 5 — la catégorie seule sans métadonnées', () => {
  const histoire = SOUS_THEMES.Histoire[0].cle
  assert.equal(lireLeClassement(null, { avecMeta: true }), 'Choisis une catégorie')
  assert.equal(lireLeClassement({ categorie: 'Astrologie' }, { avecMeta: false }), 'Choisis une catégorie de la liste')
  assert.deepEqual(lireLeClassement({ categorie: 'Histoire', sousTheme: 'nimporte', difficulte: 9 }, { avecMeta: false }), { categorie: 'Histoire', sousTheme: null, difficulte: null })
  assert.equal(lireLeClassement({ categorie: 'Histoire', sousTheme: SOUS_THEMES.Géographie[0].cle, difficulte: 3 }, { avecMeta: true }), 'Choisis un sous-thème de la catégorie « Histoire »')
  assert.equal(lireLeClassement({ categorie: 'Histoire', sousTheme: histoire, difficulte: 6 }, { avecMeta: true }), 'La difficulté va de 1 à 5')
  assert.equal(lireLeClassement({ categorie: 'Histoire', sousTheme: histoire, difficulte: 2.5 }, { avecMeta: true }), 'La difficulté va de 1 à 5')
  assert.deepEqual(lireLeClassement({ categorie: 'Histoire', sousTheme: histoire, difficulte: '4' }, { avecMeta: true }), { categorie: 'Histoire', sousTheme: histoire, difficulte: 4 })
  assert.equal(classementEcrit({ categorie: 'Histoire', sousTheme: histoire, difficulte: 4 }), `Histoire › ${nomDuSousTheme('Histoire', histoire)} · difficulté 4`)
  assert.equal(classementEcrit({ categorie: '', sousTheme: null, difficulte: null }), 'sans catégorie')
})

test('le jour qui l’a posée prend la correction : la même bonne réponse, à la même place, autant de réponses — et la version qu’il a posée', () => {
  const reserve: VersionLue = { texte: 'Qui a fondé Rome ?', reponses: ['Romulus', 'Rémus', 'Énée'], bonne: 0, anecdote: null }
  // Le jour les a mélangées : chacune retrouve sa place dans la réserve.
  const copie = { reponses: ['Énée', 'Romulus', 'Rémus'], bonne: 1 }
  assert.deepEqual(placesDuJour(copie, reserve), [2, 0, 1])
  const corrigee = (x: Partial<VersionLue>): VersionLue => ({ ...reserve, ...x })
  assert.equal(corrigeAussiLeJour(copie, reserve, corrigee({ anecdote: 'Selon la légende.' })), true, 'une anecdote')
  assert.equal(corrigeAussiLeJour(copie, reserve, corrigee({ reponses: ['Romulus', 'Numa', 'Énée'] })), true, 'un leurre remplacé')
  assert.equal(corrigeAussiLeJour(copie, reserve, corrigee({ reponses: ['Rémus', 'Romulus', 'Énée'], bonne: 1 })), false, 'la même bonne, ailleurs : ses joueurs ont répondu par la place')
  assert.equal(corrigeAussiLeJour(copie, reserve, corrigee({ reponses: ['Romulus', 'Rémus', 'Énée', 'Numa'] })), false, 'une réponse de plus')
  assert.equal(corrigeAussiLeJour(copie, reserve, corrigee({ bonne: 1 })), false, 'une autre bonne réponse : pour la suite seulement')
  assert.equal(placesDuJour({ reponses: ['Énée', 'Romulus', 'Numa'], bonne: 1 }, reserve), null, 'le jour a posé une autre version')
  assert.equal(placesDuJour({ reponses: ['Énée', 'Romulus', 'Rémus'], bonne: 2 }, reserve), null, 'une autre bonne')
})

test('ce qu’une correction a changé, ce qui a été fait des relues, le merci : en une ligne chacun', () => {
  const avant = { texte: 'Quelle est la plus grande île de Méditerranée ?', reponses: ['La Sardaigne', 'La Corse', 'La Crète'], bonne: 0, anecdote: null }
  assert.equal(detailDeLaCorrection(avant, { ...avant, anecdote: 'La Sicile l’emporte.' }), 'l’anecdote')
  assert.equal(detailDeLaCorrection(avant, { ...avant, texte: 'La plus grande île de la Méditerranée ?', reponses: ['La Sardaigne', 'Chypre', 'La Crète'] }), 'l’intitulé, les réponses')
  assert.equal(detailDeLaCorrection(avant, { ...avant, reponses: ['La Sardaigne', 'La Sicile', 'La Crète'], bonne: 1 }), 'nouvelle bonne réponse : La Sicile')

  const relu = (x: Partial<SignalementRelu>): SignalementRelu => ({ source: 'jour', cle: `${JOUR}#0`, texte: 'Q', categorie: null, issue: null, detail: null, quand: 0, joueurs: 1, ...x })
  assert.equal(issueDuRelu(relu({ issue: 'retiree' })), 'Retirée de la réserve')
  assert.equal(issueDuRelu(relu({ source: 'campagne', issue: 'retiree' })), 'Retirée de la campagne')
  assert.equal(issueDuRelu(relu({ issue: 'corrigee', detail: 'l’anecdote' })), 'Corrigée · l’anecdote')
  assert.equal(issueDuRelu(relu({ issue: 'annulee' })), 'Points annulés pour tous')
  assert.equal(issueDuRelu(relu({})), 'Relue', 'relue avant qu’on écrive les issues')
  assert.deepEqual(compteDesRelus([relu({ issue: 'corrigee' }), relu({ issue: 'corrigee' }), relu({ issue: 'gardee' }), relu({})]), {
    gardee: 1,
    corrigee: 2,
    reclassee: 0,
    retiree: 0,
    annulee: 0,
    relue: 1,
  })

  const a = { nom: 'a', joueurs: 1, dernier: 300 }
  const b = { nom: 'b', joueurs: 4, dernier: 100 }
  const c = { nom: 'c', joueurs: 4, dernier: 200 }
  assert.deepEqual(trierLesSignalements([a, b, c], 'signalees').map(x => x.nom), ['c', 'b', 'a'], 'la plus signalée d’abord, la plus récente à égalité')
  assert.deepEqual(trierLesSignalements([a, b, c], 'recentes').map(x => x.nom), ['a', 'c', 'b'])

  assert.equal(
    phraseDuMerci({ mode: 'jour', issue: 'annulee', question: 'En quelle année est sorti le premier « Harry Potter »…' }),
    'La question du quiz du jour que tu as signalée, « En quelle année est sorti le premier « Harry Potter »… », a servi : ses points ont été annulés pour tous.',
  )
  assert.equal(phraseDuMerci({ mode: 'jour', issue: 'retiree', question: 'Q' }), 'La question du quiz du jour que tu as signalée, « Q », a servi : elle ne sera plus posée.')
  assert.equal(phraseDuMerci({ mode: 'campagne', issue: 'retiree', question: 'Q' }), 'La question de la campagne que tu as signalée, « Q », a servi : elle a quitté la campagne.')
  assert.equal(phraseDuMerci({ mode: 'campagne', issue: 'reclassee', question: 'Q' }), 'La question de la campagne que tu as signalée, « Q », a servi : elle a été reclassée.')
})

// ── Le quiz du jour ───────────────────────────────────────────────────────

test('au quiz du jour : qui signale, ce que le jour a posé ; corrigée à la même bonne réponse, le jour la prend aussi — à une autre, pour la suite, ses points annulés pour tous', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const admin = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const idBob = (await lire(banc, bob, '/api/joueur/moi')).corps.profile.id as string
    // Alice se trompe à la première question, Bob la trouve ; tous deux la signalent — et Alice la deuxième.
    await jouer(banc, alice, i => i !== 0)
    await jouer(banc, bob, () => true)
    const signaler = async (cookie: string, index: number, texte: string) => {
      horloge.t += 60_000
      const r = await poster(banc, cookie, '/api/jour/signaler', { jour: JOUR, index, texte })
      assert.equal(r.status, 200, r.corps.error)
    }
    await signaler(alice, 0, 'En France, il est sorti un an plus tard')
    await signaler(bob, 0, 'Ambigu')
    await signaler(alice, 1, 'La bonne réponse est fausse')
    const tire = tirage(banc)

    let p = await page(banc, admin)
    assert.deepEqual([p.campagne, p.relus], [[], []])
    assert.deepEqual(
      p.jour.map(s => [s.index, s.joueurs]),
      [
        [1, 1],
        [0, 2],
      ],
      'la plus récemment signalée d’abord',
    )
    const q0 = p.jour.find(s => s.index === 0)!
    assert.deepEqual([q0.texte, q0.reponses, q0.bonne, q0.categorie], [tire[0].texte, tire[0].reponses, tire[0].bonne, tire[0].categorie], 'telle que son jour l’a posée')
    assert.deepEqual([q0.parReponse[tire[0].bonne], q0.parReponse.reduce((n, x) => n + x, 0) + q0.sansReponse], [1, 2], 'ce que chaque réponse a recueilli')
    const fausse = tire[0].reponses[(tire[0].bonne + 1) % tire[0].reponses.length]
    assert.deepEqual(
      q0.rapports.map(r => [r.prenom, r.login, r.juste, r.reponse, r.traiteLe, r.issue]),
      [
        ['Bob', 'bob', true, tire[0].reponses[tire[0].bonne], null, null],
        ['Alice', 'alice', false, fausse, null, null],
      ],
      'qui la signale, ce qu’il y a répondu — le plus récent d’abord',
    )
    assert.equal(q0.annulable, true, 'son jour court')
    const r0 = q0.reserve!
    assert.ok(r0 && !r0.retiree)
    assert.equal(r0.texte, q0.texte)
    assert.deepEqual([...r0.reponses].sort(), [...q0.reponses].sort(), 'la réserve, dans l’ordre où elle a été écrite')

    // Corrigée à la même bonne réponse — un leurre, l'anecdote : le jour la prend.
    const leurre = r0.reponses.findIndex((_, i) => i !== r0.bonne)
    const correction0 = { texte: r0.texte, reponses: r0.reponses.map((x, i) => (i === leurre ? 'Un leurre plus franc' : x)), bonne: r0.bonne, anecdote: 'Sorti en 1997 au Royaume-Uni.' }
    horloge.t += 1000
    const c0 = await poster(banc, admin, '/api/admin/jour/corriger', { jour: JOUR, index: 0, correction: correction0 })
    assert.equal(c0.status, 200, c0.corps.error)
    assert.deepEqual(c0.corps, { jourAussi: true, nouvelle: false, annulee: false })
    const jour0 = tirage(banc)[0]
    assert.deepEqual(
      [jour0.reponses, jour0.bonne, jour0.anecdote],
      [tire[0].reponses.map(x => (x === r0.reponses[leurre] ? 'Un leurre plus franc' : x)), tire[0].bonne, correction0.anecdote],
      'ses réponses dans l’ordre de ce jour-là, la bonne à sa place',
    )
    const corrige = (await lire(banc, alice, `/api/jour/correction/${JOUR}`)).corps
    assert.deepEqual([corrige.questions[0].anecdote, corrige.questions[0].juste], [correction0.anecdote, false], 'l’écran de correction de chacun la montre corrigée')
    assert.deepEqual(laReserve(banc, q0.reserveId).reponses, correction0.reponses, 'et ses prochains tirages')

    p = await page(banc, admin)
    assert.deepEqual(
      p.jour.map(s => s.index),
      [1],
      'ses signalements se referment',
    )
    assert.deepEqual(
      p.relus.map(r => [r.source, r.cle, r.issue, r.detail, r.joueurs]),
      [['jour', `${JOUR}#0`, 'corrigee', 'les réponses, l’anecdote', 2]],
    )

    // Une autre bonne réponse : pour la suite seulement ; ses points s'annulent pour tous, en un geste.
    const q1 = p.jour[0]
    const r1 = q1.reserve!
    const autre = (r1.bonne + 1) % r1.reponses.length
    horloge.t += 1000
    const c1 = await poster(banc, admin, '/api/admin/jour/corriger', { jour: JOUR, index: 1, correction: { ...r1, bonne: autre }, annuler: true })
    assert.equal(c1.status, 200, c1.corps.error)
    assert.deepEqual(c1.corps, { jourAussi: false, nouvelle: true, annulee: true })
    assert.deepEqual(annulees(banc), [1], 'ses points annulés pour tous')
    assert.deepEqual([tirage(banc)[1].reponses, tirage(banc)[1].bonne], [tire[1].reponses, tire[1].bonne], 'le jour garde la sienne')
    const reserve1 = laReserve(banc, q1.reserveId)
    assert.equal(reserve1.reponses[reserve1.bonne], r1.reponses[autre], 'ses prochains tirages, la nouvelle')

    // Ce que la correction refuse, en le disant.
    await signaler(bob, 2, 'Une faute dans l’intitulé')
    p = await page(banc, admin)
    const q2 = p.jour.find(s => s.index === 2)!
    const r2 = q2.reserve!
    const refus = async (correction: unknown) => (await poster(banc, admin, '/api/admin/jour/corriger', { jour: JOUR, index: 2, correction })).corps.error
    assert.equal(await refus({}), 'Envoie l’intitulé, les réponses, l’index de la bonne et l’anecdote')
    assert.equal(await refus(r2), 'Rien n’a changé : « Garder » referme ses signalements')
    assert.equal(await refus({ ...r2, reponses: [...r2.reponses, 'A', 'B', 'C', 'D', 'E'].slice(0, 5) }), 'Une question du jour a de 2 à 4 réponses')
    assert.equal(await refus({ ...r2, reponses: r2.reponses.map((x, i) => (i === r2.bonne ? x : '  ')) }), 'Une réponse est vide : écris-la, ou retire-la')
    assert.equal(await refus({ ...r2, reponses: r2.reponses.map((x, i) => (i === r2.bonne ? x : r2.reponses[r2.bonne].toUpperCase())) }), 'Deux réponses disent la même chose')
    assert.match(await refus({ ...r2, texte: 'x'.repeat(301) }), /^Trop long : l’intitulé tient en 300 caractères/)
    assert.equal(await refus({ ...r2, texte: tire[3].texte }), 'Cet intitulé est déjà celui d’une autre question de la réserve')

    // Gardée, puis signalée de nouveau par Alice : elle revient à relire, le signalement de Bob replié avec ce qui en a été fait.
    horloge.t += 1000
    assert.equal((await poster(banc, admin, '/api/admin/jour/garder', { jour: JOUR, index: 2 })).status, 200)
    await signaler(alice, 2, 'Toujours pas d’accord')
    p = await page(banc, admin)
    const encore = p.jour.find(s => s.index === 2)!
    assert.deepEqual(
      encore.rapports.map(r => [r.prenom, r.traiteLe === null, r.issue]),
      [
        ['Alice', true, null],
        ['Bob', false, 'gardee'],
      ],
    )
    // Retirée de la réserve : ses prochains jours ne la poseront plus.
    horloge.t += 1000
    assert.equal((await poster(banc, admin, '/api/admin/jour/retirer', { reserveId: encore.reserveId, jour: JOUR, index: 2 })).status, 200)
    // Une question relue avant qu'on écrive les issues : l'historique la dit relue, sans plus.
    base(banc, db =>
      db.prepare('INSERT INTO jour_signalements (jour, question, profile_id, texte, cree_le, traite_le) VALUES (?, 3, ?, ?, ?, ?)').run(JOUR, idBob, 'Relue avant', DEBUT, DEBUT + 1000),
    )

    p = await page(banc, admin)
    assert.deepEqual(p.jour, [], 'plus rien à relire')
    assert.deepEqual(
      p.relus.map(r => [r.cle, r.issue, r.detail, r.joueurs]),
      [
        [`${JOUR}#2`, 'retiree', null, 1],
        [`${JOUR}#2`, 'gardee', null, 1],
        [`${JOUR}#1`, 'corrigee', `nouvelle bonne réponse : ${r1.reponses[autre]} · ses points annulés pour tous`, 1],
        [`${JOUR}#0`, 'corrigee', 'les réponses, l’anecdote', 2],
        [`${JOUR}#3`, null, null, 1],
      ],
      'chaque relecture, la plus récente d’abord — une question peut l’avoir été deux fois',
    )

    // Le merci : à qui la remarque a servi — gardée, elle ne dit rien ; relue avant les issues non plus.
    const deAlice = await mercisDe(banc, alice)
    assert.deepEqual(
      deAlice.map(a => [a.mode, a.issue]),
      [
        ['jour', 'retiree'],
        ['jour', 'corrigee'],
        ['jour', 'corrigee'],
      ],
    )
    assert.equal(deAlice[2].question, extrait(tire[0].texte, QUESTION_DU_MERCI))
    assert.match(deAlice[2].id, new RegExp(`^merci:jour:${JOUR}#0:\\d+$`))
    assert.deepEqual(
      (await mercisDe(banc, bob)).map(a => [a.mode, a.issue]),
      [['jour', 'corrigee']],
    )
  } finally {
    await banc.close()
  }
})

test('reclasser une question du jour : sa catégorie pour ses prochains tirages — son sous-thème et sa difficulté quand la routine l’a décrite —, le jour garde la sienne', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const admin = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    await jouer(banc, alice, () => true)
    for (const index of [0, 1]) {
      horloge.t += 60_000
      assert.equal((await poster(banc, alice, '/api/jour/signaler', { jour: JOUR, index, texte: 'Pas la bonne catégorie' })).status, 200)
    }
    const tire = tirage(banc)
    // La deuxième, la routine l'a décrite : une Histoire de difficulté 2, une étiquette.
    const histoire = SOUS_THEMES.Histoire[0].cle
    base(banc, db =>
      db
        .prepare('UPDATE jour_reserve SET categorie = ?, metadonnees = ? WHERE id = ?')
        .run('Histoire', JSON.stringify({ categorie: 'Histoire', sousTheme: histoire, etiquettes: ['france'], difficulte: 2, ageMin: 10, portee: 'france' }), tire[1].reserveId),
    )
    const p = await page(banc, admin)
    const q0 = p.jour.find(s => s.index === 0)!
    const q1 = p.jour.find(s => s.index === 1)!
    assert.deepEqual([q0.reserve!.sousTheme, q0.reserve!.difficulte], [null, null], 'pas encore décrite')
    assert.deepEqual([q1.reserve!.categorie, q1.reserve!.sousTheme, q1.reserve!.difficulte], ['Histoire', histoire, 2])
    const reclasser = (index: number, classement: unknown) => poster(banc, admin, '/api/admin/jour/reclasser', { jour: JOUR, index, classement })

    // Sans métadonnées : la catégorie seule.
    const vers = CATEGORIES.find(c => c !== q0.reserve!.categorie)!
    assert.equal((await reclasser(0, { categorie: 'Astrologie' })).corps.error, 'Choisis une catégorie de la liste')
    horloge.t += 1000
    assert.equal((await reclasser(0, { categorie: vers })).status, 200)
    const reserve0 = laReserve(banc, q0.reserveId)
    assert.deepEqual([reserve0.categorie, reserve0.enJson], [vers, vers], 'sa colonne, que le tirage lit, et sa question')

    // Décrite : son sous-thème et sa difficulté avec — ses autres métadonnées restent.
    const geo = SOUS_THEMES.Géographie[1].cle
    assert.equal((await reclasser(1, { categorie: 'Géographie' })).corps.error, 'Choisis un sous-thème de la catégorie « Géographie »')
    assert.equal((await reclasser(1, { categorie: 'Géographie', sousTheme: geo, difficulte: 9 })).corps.error, 'La difficulté va de 1 à 5')
    assert.equal((await reclasser(1, { categorie: 'Histoire', sousTheme: histoire, difficulte: 2 })).corps.error, 'Rien n’a changé : « Garder » referme ses signalements')
    horloge.t += 1000
    assert.equal((await reclasser(1, { categorie: 'Géographie', sousTheme: geo, difficulte: 4 })).status, 200)
    const reserve1 = laReserve(banc, q1.reserveId)
    assert.deepEqual(
      [reserve1.categorie, reserve1.meta.categorie, reserve1.meta.sousTheme, reserve1.meta.difficulte, reserve1.meta.etiquettes],
      ['Géographie', 'Géographie', geo, 4, ['france']],
    )
    assert.deepEqual(
      tirage(banc).map(q => q.categorie),
      tire.map(q => q.categorie),
      'le jour qui l’a posée garde la sienne : les écussons de chacun ne bougent pas',
    )
    assert.deepEqual(
      (await page(banc, admin)).relus.map(r => [r.cle, r.issue, r.detail]),
      [
        [`${JOUR}#1`, 'reclassee', `Géographie › ${nomDuSousTheme('Géographie', geo)} · difficulté 4`],
        [`${JOUR}#0`, 'reclassee', vers],
      ],
    )
    assert.deepEqual(
      (await mercisDe(banc, alice)).map(a => a.issue),
      ['reclassee', 'reclassee'],
    )
  } finally {
    await banc.close()
  }
})

test('« Corriger » et « Reclasser » partis ensemble sur la même question du jour : l’un après l’autre, aucun n’efface l’autre', async () => {
  // Les deux relisent la question de la réserve puis la réécrivent : sans
  // verrou commun, chacun la relisait avant que l'autre l'ait réécrite, et le
  // dernier écrit effaçait l'anecdote corrigée ou la catégorie neuve. Turso
  // répond par le réseau ; le fichier qui en tient lieu répond sans rendre la
  // main, et deux requêtes n'y croisent jamais : ici, chaque requête attend
  // son tour de boucle, comme une réponse du réseau.
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-signalements-'))
  const fichier = path.join(dir, 'permanente.db')
  const url = `file:${fichier.replace(/\\/g, '/')}`
  const profils = new ProfileStore(url)
  const jour = new JourStore(url, undefined, { profiles: profils, maintenant: () => DEBUT })
  const laVersion = (id: string) => {
    const db = new Database(fichier)
    try {
      const r = db.prepare('SELECT question, categorie FROM jour_reserve WHERE id = ?').get(id) as { question: string; categorie: string | null }
      const def = JSON.parse(r.question)
      const p = toPlayable({ ...def, id })
      assert.ok(p && p.kind === 'choice')
      return { texte: p.text, reponses: p.answers, bonne: p.correct, anecdote: p.anecdote ?? null, categorie: r.categorie, enJson: def.category ?? null }
    } finally {
      db.close()
    }
  }
  try {
    await profils.init()
    await jour.init()
    const tire = await jour.tirage(JOUR, true)
    assert.ok(tire && tire.questions.length > 0)
    const id = tire.questions[0].reserveId
    const avant = laVersion(id)
    const client = (jour as any).client
    const execute = client.execute.bind(client)
    const batch = client.batch.bind(client)
    const parLeReseau = () => new Promise(r => setTimeout(r, 5))
    client.execute = async (...a: unknown[]) => (await parLeReseau(), execute(...a))
    client.batch = async (...a: unknown[]) => (await parLeReseau(), batch(...a))
    const ailleurs = CATEGORIES.find(c => c !== avant.categorie)!
    await Promise.all([
      jour.corriger(JOUR, 0, { texte: avant.texte, reponses: avant.reponses, bonne: avant.bonne, anecdote: 'Une anecdote neuve.' }),
      jour.reclasser(JOUR, 0, { categorie: ailleurs }),
    ])
    const apres = laVersion(id)
    assert.deepEqual([apres.anecdote, apres.categorie, apres.enJson], ['Une anecdote neuve.', ailleurs, ailleurs])
  } finally {
    jour.close()
    profils.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── La campagne ───────────────────────────────────────────────────────────

/** Les questions d'une série, telles que la base permanente les garde : la bonne réponse avec. */
const questionsDe = (banc: Banc, serie: string): { id: string; bonne: number; texte: string; reponses: string[]; anecdote: string | null }[] =>
  base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions))

test('en campagne : reclasser une question sous son identifiant ; chaque geste dit son issue, et le joueur dont la remarque a servi est remercié', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(16) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob')
    // Léa répond juste aux quatre premières questions de sa série, et les signale.
    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    const qs = questionsDe(banc, serie.id)
    for (let i = 0; i < 4; i++) {
      assert.equal((await poster(banc, lea, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: qs[i].bonne })).status, 200)
      horloge.t += 60_000
      assert.equal((await poster(banc, lea, `/api/campagne/serie/${serie.id}/signalement`, { index: i, texte: `Remarque ${i}` })).status, 200)
    }
    let p = await page(banc, admin)
    assert.deepEqual(p.jour, [])
    assert.deepEqual(
      p.campagne.map(s => s.questionId),
      [qs[3].id, qs[2].id, qs[1].id, qs[0].id],
    )
    assert.deepEqual(
      p.campagne[3].rapports.map(r => [r.prenom, r.login, r.ou, r.juste, r.issue]),
      [['Léa', 'lea', 'serie', true, null]],
    )

    // Reclassée : sa catégorie, son sous-thème, sa difficulté — sous le même identifiant.
    const cible = p.campagne.find(s => s.questionId === qs[0].id)!
    const geo = SOUS_THEMES.Géographie[2].cle
    const reclasser = (questionId: string, classement: unknown) => poster(banc, admin, '/api/admin/campagne/reclasser', { questionId, classement })
    assert.equal((await reclasser('inconnue', { categorie: 'Géographie', sousTheme: geo, difficulte: 4 })).corps.error, 'Cette question n’est pas dans la base')
    assert.equal((await reclasser(cible.questionId, { categorie: 'Géographie', sousTheme: SOUS_THEMES.Histoire[0].cle, difficulte: 4 })).corps.error, 'Choisis un sous-thème de la catégorie « Géographie »')
    assert.equal(
      (await reclasser(cible.questionId, { categorie: cible.categorie, sousTheme: cible.sousTheme, difficulte: cible.difficulte })).corps.error,
      'Rien n’a changé : « Garder » referme ses signalements',
    )
    horloge.t += 1000
    assert.equal((await reclasser(cible.questionId, { categorie: 'Géographie', sousTheme: geo, difficulte: 4 })).status, 200)
    const rangee = base(banc, db => JSON.parse((db.prepare('SELECT entree FROM campagne_corrections WHERE question_id = ?').get(cible.questionId) as { entree: string }).entree))
    assert.deepEqual([rangee.id, rangee.categorie, rangee.sousTheme, rangee.difficulte, rangee.texte], [cible.questionId, 'Géographie', geo, 4, cible.texte])
    // La campagne la joue dans sa nouvelle catégorie, tout de suite.
    const parCategorie = (await lire(banc, admin, '/api/admin/campagne')).corps.parCategorie as { categorie: string; questions: number }[]
    assert.deepEqual(
      parCategorie.filter(c => c.questions > 0).map(c => [c.categorie, c.questions]),
      [
        ['Histoire', 15],
        ['Géographie', 1],
      ],
    )
    assert.equal((await reclasser(cible.questionId, { categorie: 'Géographie', sousTheme: geo, difficulte: 4 })).corps.error, 'Rien n’a changé : « Garder » referme ses signalements')

    // Retirée, gardée, corrigée : chacune son issue.
    horloge.t += 1000
    assert.equal((await poster(banc, admin, '/api/admin/campagne/retirer', { questionId: qs[1].id })).status, 200)
    horloge.t += 1000
    assert.equal((await poster(banc, admin, '/api/admin/campagne/garder', { questionId: qs[2].id })).status, 200)
    horloge.t += 1000
    const q3 = p.campagne.find(s => s.questionId === qs[3].id)!
    const correction = { texte: q3.texte, reponses: q3.reponses, bonne: q3.bonne, anecdote: 'Une anecdote reprise.' }
    assert.equal((await poster(banc, admin, '/api/admin/campagne/corriger', { questionId: q3.questionId, correction })).status, 200)

    p = await page(banc, admin)
    assert.deepEqual(p.campagne, [], 'plus rien à relire')
    assert.deepEqual(
      p.relus.map(r => [r.source, r.cle, r.categorie, r.issue, r.detail, r.joueurs]),
      [
        ['campagne', qs[3].id, 'Histoire', 'corrigee', 'l’anecdote', 1],
        ['campagne', qs[2].id, 'Histoire', 'gardee', null, 1],
        ['campagne', qs[1].id, 'Histoire', 'retiree', null, 1],
        ['campagne', qs[0].id, 'Géographie', 'reclassee', `Géographie › ${nomDuSousTheme('Géographie', geo)} · difficulté 4`, 1],
      ],
    )
    const deLea = await mercisDe(banc, lea)
    assert.deepEqual(
      deLea.map(a => [a.mode, a.issue]),
      [
        ['campagne', 'corrigee'],
        ['campagne', 'retiree'],
        ['campagne', 'reclassee'],
      ],
      'gardée, la sienne ne dit rien',
    )
    assert.match(deLea[2].id, new RegExp(`^merci:campagne:${qs[0].id}:\\d+$`))
    assert.deepEqual(await mercisDe(banc, bob), [], 'rien signalé, rien à remercier')

    // Signalée de nouveau après sa relecture — la première que la série de Bob
    // lui pose parmi celles qui se jouent encore : elle revient à relire, le
    // signalement de Léa replié avec ce qui en a été fait.
    horloge.t += 60_000
    const serieDeBob = (await poster(banc, bob, '/api/campagne/serie')).corps
    const sienne = questionsDe(banc, serieDeBob.id)
    const issues = new Map([
      [qs[0].id, 'reclassee'],
      [qs[2].id, 'gardee'],
      [qs[3].id, 'corrigee'],
    ])
    const position = sienne.findIndex(q => issues.has(q.id))
    assert.ok(position >= 0, 'sa série en pose une')
    for (let i = 0; i <= position; i++) assert.equal((await poster(banc, bob, `/api/campagne/serie/${serieDeBob.id}/reponse`, { index: i, choix: sienne[i].bonne })).status, 200)
    assert.equal((await poster(banc, bob, `/api/campagne/serie/${serieDeBob.id}/signalement`, { index: position, texte: 'Encore' })).status, 200)
    const revenue = (await page(banc, admin)).campagne.find(s => s.questionId === sienne[position].id)!
    assert.deepEqual(
      revenue.rapports.map(r => [r.prenom, r.traiteLe === null, r.issue]),
      [
        ['Bob', true, null],
        ['Léa', false, issues.get(sienne[position].id)],
      ],
    )
  } finally {
    await banc.close()
  }
})

// ── La page ───────────────────────────────────────────────────────────────

test('la page : chaque carte dit d’où vient sa question, qui la signale, et n’offre que les gestes qui valent encore', async () => {
  Object.assign(globalThis, { React })
  const { CarteDuJour, ListeDesRelus } = await import(new URL('../../client/src/components/QgSignalements.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  // Mercredi 14 octobre 2026, 11 h 20 à Paris.
  const maintenant = Date.UTC(2026, 9, 14, 9, 20)
  const reserve = {
    texte: 'En quelle année est sorti le premier “Harry Potter” en librairie ?',
    reponses: ['1997', '1998', '2001', '1995'],
    bonne: 0,
    anecdote: null,
    categorie: 'Arts & lettres',
    sousTheme: null,
    difficulte: null,
    retiree: false,
  }
  const s: SignalementDuJour = {
    jour: '2026-10-14',
    index: 3,
    reserveId: 'r1',
    texte: reserve.texte,
    reponses: ['1998', '1997', '2001', '1995'],
    bonne: 1,
    anecdote: null,
    categorie: 'Arts & lettres',
    parReponse: [46, 43, 16, 7],
    sansReponse: 0,
    reserve,
    annulee: false,
    annulable: true,
    joueurs: 2,
    rapports: [
      { profileId: 'p1', prenom: 'Léa', login: 'lea', texte: 'En France il est sorti en 1998 !', le: maintenant - 20 * 60_000, traiteLe: null, issue: null, reponse: '1998', juste: false },
      { profileId: 'p2', prenom: null, login: null, texte: 'Ambigu', le: maintenant - 2 * 3_600_000, traiteLe: null, issue: null, reponse: '1997', juste: true },
    ],
    dernier: maintenant - 20 * 60_000,
  }
  const rendre = (x: SignalementDuJour) =>
    // Lu sans les séparateurs de React ni les espaces insécables, des durées comme des guillemets.
    renderToStaticMarkup(React.createElement(CarteDuJour, { s: x, maintenant, occupe: false, faire: async () => {}, annuler: () => {} }))
      .replace(/<!-- -->/g, '')
      .replace(/[  ]/g, ' ')
  const gestes = (html: string) => [...html.matchAll(/<button type="button" class="salon-geste[^"]*"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)<\/button>/g)].map(m => m[1])

  const html = rendre(s)
  assert.doesNotMatch(html, /undefined|NaN/)
  assert.match(html, /Arts &amp; lettres · aujourd’hui, question 4/)
  assert.match(html, /<b class="num">2<\/b> joueurs · dernier signalement il y a 20 min/)
  assert.match(html, /112 réponses aujourd’hui, 38 % justes/)
  assert.match(html, /<b>Léa<\/b><span class="muted small"> @lea<\/span>/)
  assert.match(html, /a répondu « 1998 » · il y a 20 min/)
  assert.match(html, /<b>Profil supprimé<\/b>/, 'un profil parti')
  assert.deepEqual(gestes(html), ['Annuler ses points pour tous', 'Corriger', 'Reclasser', 'Retirer de la réserve', 'Garder'])
  // Son jour clos : plus d'annulation. Retirée de la réserve : il ne reste qu'à refermer.
  assert.deepEqual(gestes(rendre({ ...s, annulable: false })), ['Corriger', 'Reclasser', 'Retirer de la réserve', 'Garder'])
  const retiree = rendre({ ...s, annulable: false, reserve: { ...reserve, retiree: true } })
  assert.deepEqual(gestes(retiree), ['Refermer'])
  assert.match(retiree, /Déjà retirée de la réserve/)
  // Corrigée dans la réserve depuis ce jour-là : la carte le dit.
  assert.match(rendre({ ...s, reserve: { ...reserve, reponses: ['1997', '1999', '2001', '1995'] } }), /Corrigée dans la réserve depuis ce jour-là/)

  const relus = renderToStaticMarkup(
    React.createElement(ListeDesRelus, {
      maintenant,
      relus: [
        { source: 'jour', cle: '2026-10-14#3', jour: '2026-10-14', texte: s.texte, categorie: 'Arts & lettres', issue: 'annulee', detail: null, quand: maintenant - 30 * 60_000, joueurs: 3 },
        { source: 'campagne', cle: 'k3x9a2m1', texte: 'Qui a fondé Rome selon la légende ?', categorie: 'Histoire', issue: 'corrigee', detail: 'l’anecdote', quand: maintenant - 26 * 3_600_000, joueurs: 2 },
      ],
    }),
  )
    .replace(/<!-- -->/g, '')
    .replace(/[  ]/g, ' ')
  assert.match(relus, /Quiz du jour · Arts &amp; lettres · aujourd’hui, question 4 · 3 joueurs/)
  assert.match(relus, /class="signalement-issue signalement-issue-annulee">.*Points annulés pour tous</)
  assert.match(relus, /Campagne · Histoire · 2 joueurs/)
  assert.match(relus, /Corrigée · l’anecdote/)
  assert.match(relus, /hier à 9 h 20/)
})
