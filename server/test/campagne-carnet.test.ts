// Le carnet de révision (un retour de joueur du 10 octobre 2026 : « un mode
// qui incite à l'apprentissage, où l'on gagne toujours quelque chose, sans
// frustration ») : ce qu'on a raté en campagne revient le lendemain, puis
// trois jours après, puis une semaine ; retrouvé à chaque rendez-vous, c'est
// appris. Une révision n'a pas de vies, ses bonnes réponses paient comme en
// série ; le carnet se relit dans le journal des réponses, et le défi qui
// court n'y entre qu'à sa clôture — il soufflerait ses réponses.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { DUREE_D_UN_DUEL_MS, VIES, xpDeLaBonneReponse } from '../../shared/campagne'
import { INTERVALLES_DE_REVISION, QUESTIONS_PAR_REVISION, suiteDeLaRevision, suiviDeLaQuestion } from '../../shared/revision'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

const HEURE = 3_600_000
const JOUR = 24 * HEURE
/** Le mardi 6 octobre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Les questions qu'une série a reçues, telles qu'elle les garde. */
function questions(banc: Banc, serie: string): { id: string; bonne: number; reponses: string[]; etape?: number }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)
  } finally {
    db.close()
  }
}

/** Répond à la question `index`, juste ou faux ; rend la réponse du serveur. */
async function repondre(banc: Banc, cookie: string, serie: string, index: number, juste: boolean) {
  const q = questions(banc, serie)[index]
  const r = await poster(banc, cookie, `/api/campagne/serie/${serie}/reponse`, { index, choix: juste ? q.bonne : (q.bonne + 1) % q.reponses.length })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}

/** Ce que le carnet compte, sans la révision en cours. */
const compte = async (banc: Banc, cookie: string) => {
  const { enCours: _, ...reste } = (await lire(banc, cookie, '/api/campagne/carnet')).corps
  return reste
}

test('un rendez-vous se lit au jour de Paris — le lendemain, trois jours, une semaine — et une erreur remet au premier', () => {
  const minute = 60_000
  const le = (jours: number) => DEBUT + jours * JOUR
  assert.deepEqual(INTERVALLES_DE_REVISION, [1, 3, 7])
  assert.equal(suiviDeLaQuestion([{ le: DEBUT, juste: true }]), null, 'jamais ratée : elle n’entre pas au carnet')
  assert.deepEqual(suiviDeLaQuestion([{ le: DEBUT, juste: false }]), { apprise: false, etape: 0, revientLe: '2026-10-07' })
  // Retrouvée cinq minutes après l'avoir ratée — la série d'après la repose : rien ne compte.
  assert.deepEqual(suiviDeLaQuestion([{ le: DEBUT, juste: false }, { le: DEBUT + 5 * minute, juste: true }]), { apprise: false, etape: 0, revientLe: '2026-10-07' })
  // Le lendemain, trois jours après, une semaine après : apprise.
  const passages = [
    { le: DEBUT, juste: false },
    { le: le(1), juste: true },
  ]
  assert.deepEqual(suiviDeLaQuestion(passages), { apprise: false, etape: 1, revientLe: '2026-10-10' })
  passages.push({ le: le(4), juste: true })
  assert.deepEqual(suiviDeLaQuestion(passages), { apprise: false, etape: 2, revientLe: '2026-10-17' })
  // Trop tôt, un rendez-vous ne compte pas — ni ne défait rien.
  assert.deepEqual(suiviDeLaQuestion([...passages, { le: le(6), juste: true }]), { apprise: false, etape: 2, revientLe: '2026-10-17' })
  passages.push({ le: le(11), juste: true })
  assert.deepEqual(suiviDeLaQuestion(passages), { apprise: true, le: '2026-10-17' })
  // Oubliée : une erreur après l'avoir apprise la remet au premier rendez-vous.
  assert.deepEqual(suiviDeLaQuestion([...passages, { le: le(30), juste: false }]), { apprise: false, etape: 0, revientLe: '2026-11-06' })
  // En retard, un rendez-vous compte quand même, et le suivant part de là.
  assert.deepEqual(suiviDeLaQuestion([{ le: DEBUT, juste: false }, { le: le(9), juste: true }]), { apprise: false, etape: 1, revientLe: '2026-10-18' })
  // Paris change de jour à minuit : ratée à 23 h 30, elle revient dès minuit.
  assert.deepEqual(suiviDeLaQuestion([{ le: Date.UTC(2026, 9, 6, 21, 30), juste: false }]), { apprise: false, etape: 0, revientLe: '2026-10-07' })
  // Ce que la page dit après une réponse de révision.
  assert.deepEqual(suiteDeLaRevision(0, true), { etape: 1, dans: 3 })
  assert.deepEqual(suiteDeLaRevision(1, true), { etape: 2, dans: 7 })
  assert.deepEqual(suiteDeLaRevision(2, true), { etape: 3, apprise: true })
  assert.deepEqual(suiteDeLaRevision(2, false), { etape: 0, dans: 1 })
})

test('ce qu’il a raté revient le lendemain, sans vies ; une bonne réponse paie comme en série, et trois rendez-vous font un fait appris', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    assert.deepEqual((await lire(banc, lea, '/api/campagne/carnet')).corps, { aRevoir: 0, demain: 0, plusTard: 0, prochainJour: null, appris: 0, enCours: null })
    const vide = await poster(banc, lea, '/api/campagne/revision')
    assert.equal(vide.status, 400)
    assert.equal(vide.corps.error, 'Ton carnet est vide : une question ratée t’y attendra le lendemain')

    // Une série : une bonne réponse, puis trois ratées.
    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    const qs = questions(banc, serie.id)
    await repondre(banc, lea, serie.id, 0, true)
    for (const i of [1, 2, 3]) await repondre(banc, lea, serie.id, i, false)
    const ratees = qs.slice(1, 4).map(q => q.id)
    // Le jour même, rien à revoir : elles reviennent demain.
    assert.deepEqual(await compte(banc, lea), { aRevoir: 0, demain: 3, plusTard: 0, prochainJour: '2026-10-07', appris: 0 })
    const tropTot = await poster(banc, lea, '/api/campagne/revision')
    assert.equal(tropTot.status, 400)
    assert.equal(tropTot.corps.error, 'Rien à revoir aujourd’hui : reviens demain')

    // Le lendemain, une révision des trois.
    horloge.t = DEBUT + JOUR
    assert.equal((await compte(banc, lea)).aRevoir, 3)
    const solde = async () => (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    const avant = await solde()
    const rev = (await poster(banc, lea, '/api/campagne/revision')).corps
    assert.equal(rev.total, 3)
    assert.deepEqual(
      questions(banc, rev.id)
        .map(q => q.id)
        .sort(),
      [...ratees].sort(),
      'les questions ratées, et elles seules',
    )
    assert.ok(questions(banc, rev.id).every(q => q.etape === 0), 'chacune à son premier rendez-vous')
    // Une erreur ne coûte pas de vie : la question revient demain, c'est tout.
    const r0 = await repondre(banc, lea, rev.id, 0, false)
    assert.deepEqual([r0.juste, r0.vies, r0.finie, r0.revision], [false, VIES, false, { etape: 0, dans: 1 }])
    // Laissée en route, elle se reprend où elle en était.
    const reprise = (await poster(banc, lea, '/api/campagne/revision')).corps
    assert.deepEqual([reprise.id, reprise.question.index], [rev.id, 1])
    const r1 = await repondre(banc, lea, rev.id, 1, true)
    assert.deepEqual([r1.juste, r1.xp, r1.revision], [true, xpDeLaBonneReponse(1), { etape: 1, dans: 3 }])
    const r2 = await repondre(banc, lea, rev.id, 2, true)
    assert.equal(r2.finie, true)
    assert.equal(r2.niveauAtteint, undefined, 'une révision ne monte pas de marche')
    assert.equal(r2.recordAvant, undefined, 'ni ne bat de record')
    // Finie, elle redit son carnet : une demain, deux dans trois jours.
    assert.deepEqual(r2.carnet, { aRevoir: 0, demain: 1, plusTard: 2, prochainJour: '2026-10-08', appris: 0, enCours: null })
    // Deux bonnes réponses : deux confettis, et l'expérience d'une série.
    const apres = await solde()
    assert.equal(apres.boutique.confettis.gagnes, avant.boutique.confettis.gagnes + 2, 'une bonne réponse, un confetti')
    assert.equal(apres.xp, avant.xp + xpDeLaBonneReponse(1) + xpDeLaBonneReponse(2))
    // Le record et le compte des séries l'ignorent.
    const etat = (await lire(banc, lea, '/api/campagne')).corps
    assert.deepEqual([etat.record, etat.series], [1, 1])
    assert.equal((await poster(banc, lea, `/api/campagne/serie/${rev.id}/reponse`, { index: 3, choix: 0 })).corps.error, 'Cette révision est finie : ton carnet t’attend')

    // Trois jours plus tard, les trois sont dues : celle qu'il avait ratée
    // depuis la veille, et les deux de leur deuxième rendez-vous.
    horloge.t = DEBUT + 4 * JOUR
    assert.equal((await compte(banc, lea)).aRevoir, 3)
    const rev2 = (await poster(banc, lea, '/api/campagne/revision')).corps
    for (let i = 0; i < 3; i++) await repondre(banc, lea, rev2.id, i, true)
    // Une semaine après : les deux plus avancées sont apprises.
    horloge.t = DEBUT + 11 * JOUR
    const rev3 = (await poster(banc, lea, '/api/campagne/revision')).corps
    let fin: any
    for (let i = 0; i < 3; i++) fin = await repondre(banc, lea, rev3.id, i, true)
    assert.deepEqual(fin.carnet, { aRevoir: 0, demain: 0, plusTard: 1, prochainJour: '2026-10-24', appris: 2, enCours: null })
    // Le carnet les redonne, avec leur réponse : il les sait.
    const appris = (await lire(banc, lea, '/api/campagne/carnet/appris')).corps
    const retrouvees = new Set(ratees.filter(id => id !== questions(banc, rev.id)[0].id))
    assert.deepEqual(
      appris.map((f: any) => f.texte).sort(),
      BASE.questions
        .filter(q => retrouvees.has(q.id))
        .map(q => q.texte)
        .sort(),
    )
    for (const f of appris) {
      const q = BASE.questions.find(x => x.texte === f.texte)!
      assert.deepEqual([f.reponse, f.anecdote, f.categorie, f.le], [q.reponses[q.bonne], q.anecdote, q.meta.categorie, '2026-10-17'])
    }
  } finally {
    await banc.close()
  }
})

test('dix questions au plus par révision, les plus en retard d’abord ; la difficulté mesurée et la précision ne la comptent pas', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    // Quatre séries ratées d'emblée : douze questions au carnet, la première série la veille des autres.
    const ratees: string[][] = []
    for (let s = 0; s < 4; s++) {
      if (s === 1) horloge.t = DEBUT + JOUR
      const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
      for (const i of [0, 1, 2]) await repondre(banc, lea, serie.id, i, false)
      ratees.push(questions(banc, serie.id).slice(0, 3).map(q => q.id))
    }
    horloge.t = DEBUT + 3 * JOUR
    assert.equal((await compte(banc, lea)).aRevoir, 12)
    const rev = (await poster(banc, lea, '/api/campagne/revision')).corps
    assert.equal(rev.total, QUESTIONS_PAR_REVISION)
    const tirees = new Set(questions(banc, rev.id).map(q => q.id))
    assert.ok(
      ratees[0].every(id => tirees.has(id)),
      'celles qui attendent depuis le plus longtemps passent d’abord',
    )
    // Il retrouve la première : la mesure de sa difficulté ne bouge pas — une
    // réponse lue la veille ne dit rien de la question —, ni sa précision.
    const premiere = questions(banc, rev.id)[0]
    await repondre(banc, lea, rev.id, 0, true)
    await poster(banc, lea, `/api/campagne/serie/${rev.id}/signalement`, { index: 0, texte: 'Pour relire sa mesure.' })
    // La mesure se relit au plus toutes les dix minutes : on les laisse passer.
    horloge.t += 11 * 60_000
    const admin = await connexionAnimateur(banc.url)
    const signalee = (await lire(banc, admin, '/api/admin/campagne')).corps.signalements.find((s: any) => s.questionId === premiere.id)
    assert.deepEqual(signalee.mesure, { justes: 0, total: 1 }, 'la seule réponse de la série')
    assert.equal(signalee.rapports[0].ou, 'revision')
    const fiche = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.fiche
    assert.deepEqual([fiche.qcm, fiche.justes], [12, 0], 'ses douze QCM de série, pas celui qu’il revoit, réponse lue la veille')
  } finally {
    await banc.close()
  }
})

test('une experte retrouvée en révision ne compte pas pour L’Érudit : on en ferait trois d’une seule, ratée exprès', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    // Quinze bonnes réponses montent jusqu'aux expertes ; il rate les trois premières.
    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    const qs = questions(banc, serie.id) as { niveau?: string }[]
    for (let i = 0; i < 15; i++) await repondre(banc, lea, serie.id, i, true)
    assert.deepEqual(
      qs.slice(15, 18).map(q => q.niveau),
      ['expert', 'expert', 'expert'],
    )
    for (const i of [15, 16, 17]) await repondre(banc, lea, serie.id, i, false)
    const erudit = async () => (await lire(banc, lea, '/api/joueur/moi')).corps.profile.hautsFaits.find((h: any) => h.key === 'hf:erudit').valeur
    assert.equal(await erudit(), 0)
    horloge.t = DEBUT + JOUR
    const rev = (await poster(banc, lea, '/api/campagne/revision')).corps
    for (let i = 0; i < 3; i++) await repondre(banc, lea, rev.id, i, true)
    assert.equal(await erudit(), 0, 'ses trois expertes retrouvées en révision')
  } finally {
    await banc.close()
  }
})

test('le défi de la semaine et un défi entre amis n’entrent au carnet qu’à leur clôture : il soufflerait leurs réponses', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const defi = (await poster(banc, lea, '/api/campagne/defi')).corps
    for (const i of [0, 1, 2]) await repondre(banc, lea, defi.id, i, false)
    const duel = (await poster(banc, lea, '/api/campagne/duel', {})).corps
    for (const i of [0, 1, 2]) await repondre(banc, lea, duel.serie.id, i, false)
    // Les deux se tirent dans toute la base : une même question peut tomber dans l'un et l'autre.
    const dansLeDefi = new Set(questions(banc, defi.id).slice(0, 3).map(q => q.id))
    const dansLeDuel = new Set(questions(banc, duel.serie.id).slice(0, 3).map(q => q.id))
    // Le lendemain, rien : la semaine du défi court, ses amis jouent encore.
    horloge.t = DEBUT + JOUR
    assert.deepEqual(await compte(banc, lea), { aRevoir: 0, demain: 0, plusTard: 0, prochainJour: null, appris: 0 })
    // Lundi, le défi de la semaine passée est clos : ses questions ratées sont là, en retard.
    horloge.t = DEBUT + 6 * JOUR
    assert.equal((await compte(banc, lea)).aRevoir, dansLeDefi.size)
    // Le défi entre amis ferme au bout de sa semaine : les siennes arrivent.
    horloge.t = DEBUT + DUREE_D_UN_DUEL_MS
    assert.equal((await compte(banc, lea)).aRevoir, new Set([...dansLeDefi, ...dansLeDuel]).size)
  } finally {
    await banc.close()
  }
})
