// Affronter un inconnu (le choix du 10 octobre 2026, après la question « peut-
// on défier des inconnus ? ») : un adversaire tout de suite, sans liste
// d'amis ni attente — la série finie d'un autre joueur, de son niveau, dont
// on a vu le moins de questions —, rejouée contre son score. Ni classement,
// ni laurier, ni Éclat ; le record des séries ne la compte pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { VIES, issueDeRencontre, niveauPourUneRencontre, xpDeLaBonneReponse } from '../../shared/campagne'
import { choisirUnAdversaire, type CandidatALaRencontre } from '../src/core/campagne'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function questions(banc: Banc, serie: string): { id: string; bonne: number; reponses: string[] }[] {
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

/** Une série jouée jusqu'à sa dernière vie : `justes` bonnes réponses, puis trois fautes. */
async function serieFinie(banc: Banc, cookie: string, justes: number) {
  const s = (await poster(banc, cookie, '/api/campagne/serie')).corps
  for (let i = 0; i < justes; i++) await repondre(banc, cookie, s.id, i, true)
  for (let i = justes; i < justes + VIES; i++) await repondre(banc, cookie, s.id, i, false)
  return s.id as string
}

test('son niveau est la médiane de ses dernières séries ; l’adversaire, le plus proche, dont il a vu le moins de questions', () => {
  assert.equal(niveauPourUneRencontre([]), 8, 'sans série : la marche des moyennes')
  assert.equal(niveauPourUneRencontre([3, 30, 12]), 12, 'une série ratée d’entrée ou un coup de chance ne le déplacent pas')
  assert.equal(niveauPourUneRencontre([10, 14]), 12)
  assert.deepEqual([issueDeRencontre(11, 9), issueDeRencontre(9, 9), issueDeRencontre(8, 9)], ['gagnee', 'egalite', 'perdue'])

  const candidat = (serie: string, justes: number, dejaVues = 0): CandidatALaRencontre => ({ serie, profil: `p-${serie}`, justes, finieLe: 1, dejaVues })
  const hasard = () => 0.5
  // De son niveau d'abord : à un point près, c'est pareil.
  assert.equal(choisirUnAdversaire([candidat('loin', 25), candidat('proche', 13)], 12, hasard)?.serie, 'proche')
  assert.equal(choisirUnAdversaire([candidat('loin', 25), candidat('proche', 13, 9)], 12, hasard)?.serie, 'proche', 'même s’il en a vu, l’écart d’abord')
  // À niveau égal, celui dont il a vu le moins de questions.
  assert.equal(choisirUnAdversaire([candidat('vu', 12, 4), candidat('neuf', 13, 0)], 12, hasard)?.serie, 'neuf')
  assert.equal(choisirUnAdversaire([], 12, hasard), null)
})

test('une rencontre rejoue la série finie d’un autre, contre son score — ce qu’il avait fait de chaque question, après la sienne', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    // Personne n'a fini de série : personne à affronter.
    const seule = await poster(banc, lea, '/api/campagne/rencontre')
    assert.equal(seule.status, 400)
    assert.equal(seule.corps.error, 'Personne à affronter pour l’instant : d’autres joueurs doivent d’abord finir des séries')

    // Zoé abandonne la sienne : une série laissée avant sa dernière vie ne dit pas son niveau, elle ne sert pas.
    const laissee = (await poster(banc, zoe, '/api/campagne/serie')).corps
    await repondre(banc, zoe, laissee.id, 0, true)
    assert.equal((await poster(banc, zoe, `/api/campagne/serie/${laissee.id}/abandon`)).status, 200)
    // Tom va au bout de ses vies : six bonnes réponses, puis trois fautes.
    const sienne = await serieFinie(banc, tom, 6)
    horloge.t += 60_000

    const r = await poster(banc, lea, '/api/campagne/rencontre')
    assert.equal(r.status, 200, r.corps.error)
    assert.deepEqual(r.corps.adversaire, { nom: 'Tom', avatar: '🐻', justes: 6 })
    assert.equal(r.corps.serie.vies, VIES)
    const id = r.corps.serie.id as string
    assert.deepEqual(
      questions(banc, id).map(q => q.id),
      questions(banc, sienne).map(q => q.id),
      'ses questions, dans le même ordre',
    )
    assert.equal(r.corps.serie.question.bonne, undefined, 'jamais la bonne réponse avant la sienne (invariant 1)')

    // Ce que Tom avait fait de chaque question se dit après sa réponse à elle.
    const r0 = await repondre(banc, lea, id, 0, true)
    assert.deepEqual(r0.rencontre, { lui: true, toi: 1, sesJustes: 1 })
    assert.equal(r0.xp, xpDeLaBonneReponse(1), 'une bonne réponse paie comme en série')
    // Laissée en route, elle se reprend — et ne s'abandonne pas.
    const reprise = (await poster(banc, lea, '/api/campagne/rencontre')).corps
    assert.deepEqual([reprise.serie.id, reprise.serie.question.index, reprise.adversaire.nom, reprise.sesJustes], [id, 1, 'Tom', 1], 'et le score d’en face jusque-là')
    const abandon = await poster(banc, lea, `/api/campagne/serie/${id}/abandon`)
    assert.equal(abandon.status, 400)
    assert.equal(abandon.corps.error, 'Une rencontre se joue jusqu’au bout : elle ne s’abandonne pas')
    for (let i = 1; i < 7; i++) await repondre(banc, lea, id, i, true)
    // Tom s'est arrêté à la neuvième question : passé elle, il n'y a plus rien à comparer.
    const r7 = await repondre(banc, lea, id, 7, false)
    assert.deepEqual(r7.rencontre, { lui: false, toi: 7, sesJustes: 6 })
    await repondre(banc, lea, id, 8, false)
    const fin = await repondre(banc, lea, id, 9, false)
    assert.equal(fin.finie, true)
    assert.deepEqual(fin.rencontre, { lui: null, toi: 7, sesJustes: 6, issue: 'gagnee' })
    assert.equal(fin.recordAvant, undefined, 'le record des séries ne la compte pas')
    assert.deepEqual([(await lire(banc, lea, '/api/campagne')).corps.record, (await lire(banc, lea, '/api/campagne')).corps.series], [0, 0])
    assert.equal((await lire(banc, lea, `/api/campagne/serie/${id}/correction`)).status, 200, 'sa correction ne souffle rien : la série de Tom est finie')

    // Ses rencontres : celle-ci, gagnée.
    const miennes = (await lire(banc, lea, '/api/campagne/rencontres')).corps
    assert.equal(miennes.enCours, null)
    assert.deepEqual(
      miennes.passees.map((x: any) => [x.adversaire.nom, x.adversaire.justes, x.justes, x.issue]),
      [['Tom', 6, 7, 'gagnee']],
    )
    // Jamais deux fois la même série : Tom n'en a pas d'autre.
    assert.equal((await poster(banc, lea, '/api/campagne/rencontre')).status, 400)

    // Masqué au quiz du jour, Tom ne s'affronte plus — sa nouvelle série non plus —, et ne se nomme plus.
    await serieFinie(banc, tom, 4)
    const admin = await connexionAnimateur(banc.url)
    const idTom = (await lire(banc, tom, '/api/joueur/moi')).corps.profile.id
    assert.equal((await poster(banc, admin, '/api/admin/jour/masquer', { profileId: idTom, masque: true })).status, 200)
    assert.equal((await poster(banc, lea, '/api/campagne/rencontre')).status, 400)
    assert.deepEqual((await lire(banc, lea, '/api/campagne/rencontres')).corps.passees[0].adversaire, { nom: 'Un joueur', avatar: '🎲', justes: 6 })
  } finally {
    await banc.close()
  }
})
