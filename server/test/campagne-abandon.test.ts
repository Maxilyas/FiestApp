// Abandonner une série de la campagne (un retour de joueur du 10 octobre
// 2026 : « je veux pouvoir recommencer alors même que j'ai encore des
// vies ») : elle finit là, comme perdue — son record et ses hauts faits se
// lisent sur ce qu'elle a joué. « Une nouvelle série » la refermait déjà,
// mais sans rien décerner : trente bonnes réponses avant de poser le
// téléphone ne faisaient jamais la Grande Série. Le défi de la semaine, lui,
// n'a qu'une tentative.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
/** Douze questions de chacune des douze catégories, de toutes les difficultés : la série monte jusqu'aux expertes. */
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function bonnes(banc: Banc, serie: string): number[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const { questions } = db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }
    return (JSON.parse(questions) as { bonne: number }[]).map(q => q.bonne)
  } finally {
    db.close()
  }
}

/** Commence une série et trouve ses `n` premières questions. */
async function jouer(banc: Banc, cookie: string, n: number, categories?: string[]) {
  const serie = (await poster(banc, cookie, '/api/campagne/serie', categories ? { categories } : {})).corps
  assert.ok(serie.id, serie.error)
  const reponses = bonnes(banc, serie.id)
  for (let i = 0; i < n; i++) {
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: reponses[i] })
    assert.equal(r.status, 200, r.corps.error)
  }
  return serie
}

const hautsFaits = async (banc: Banc, cookie: string): Promise<string[]> =>
  ((await lire(banc, cookie, '/api/joueur/moi')).corps.profile.hautsFaits as { key: string; fois?: number }[]).filter(h => (h.fois ?? 0) > 0).map(h => h.key)

test('abandonner une série la finit comme perdue : son record, ses hauts faits, et plus une réponse', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    // Quinze bonnes réponses, la première experte atteinte sans une erreur :
    // Sans une égratignure — puis elle repart, trois vies en poche.
    const serie = await jouer(banc, lea, 15)
    const fin = await poster(banc, lea, `/api/campagne/serie/${serie.id}/abandon`)
    assert.equal(fin.status, 200, fin.corps.error)
    assert.equal(fin.corps.justes, 15)
    assert.equal(fin.corps.recordAvant, 0)
    assert.equal(fin.corps.record, true, 'sa première série : un record')
    assert.equal(fin.corps.niveauAtteint, 'difficile')
    assert.ok(fin.corps.recompenses.some((r: any) => r.key === 'hf:intact'), 'ce qu’elle a joué décerne ce qu’il mérite')
    // Finie : plus une réponse, plus d'abandon, et la page ne la propose plus.
    const apres = await poster(banc, lea, `/api/campagne/serie/${serie.id}/reponse`, { index: 15, choix: 0 })
    assert.equal(apres.status, 400)
    assert.match(apres.corps.error, /Cette série est finie/)
    assert.equal((await poster(banc, lea, `/api/campagne/serie/${serie.id}/abandon`)).status, 400)
    const etat = (await lire(banc, lea, '/api/campagne')).corps
    assert.equal(etat.enCours, null)
    assert.equal(etat.record, 15)
    assert.equal(etat.series, 1)
    // La correction de ce qu'elle a joué s'ouvre, comme pour une série perdue.
    assert.equal((await lire(banc, lea, `/api/campagne/serie/${serie.id}/correction`)).corps.length, 15)
  } finally {
    await banc.close()
  }
})

test('une série laissée que « Une nouvelle série » referme décerne aussi ce qu’elle a joué, et rejouer garde ses catégories', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const laissee = await jouer(banc, lea, 15)
    assert.ok(!(await hautsFaits(banc, lea)).includes('hf:intact'))
    // Le téléphone posé, la série reprise ailleurs dit ses catégories : toutes, ici.
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.enCours.categories, undefined)
    const nouvelle = (await poster(banc, lea, '/api/campagne/serie', { categories: ['Histoire'] })).corps
    assert.notEqual(nouvelle.id, laissee.id)
    assert.ok((await hautsFaits(banc, lea)).includes('hf:intact'), 'Sans une égratignure, tombé à la fermeture')
    assert.deepEqual(nouvelle.categories, ['Histoire'])
    assert.deepEqual((await lire(banc, lea, '/api/campagne')).corps.enCours.categories, ['Histoire'], 'une série reprise sait ses catégories')
  } finally {
    await banc.close()
  }
})

test('le défi ne s’abandonne pas, et la série d’un autre est introuvable', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom')
    const defi = (await poster(banc, lea, '/api/campagne/defi')).corps
    assert.ok(defi.id, defi.error)
    const refus = await poster(banc, lea, `/api/campagne/serie/${defi.id}/abandon`)
    assert.equal(refus.status, 400)
    assert.match(refus.corps.error, /Le défi n’a qu’une tentative/)
    // La série de Léa, vue de chez Tom : introuvable (invariant 3).
    const serie = await jouer(banc, lea, 2)
    const intrus = await poster(banc, tom, `/api/campagne/serie/${serie.id}/abandon`)
    assert.equal(intrus.status, 400)
    assert.match(intrus.corps.error, /Cette série est introuvable/)
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.enCours.id, serie.id, 'elle l’attend toujours')
    // Sans profil, la campagne le dit.
    assert.equal((await fetch(`${banc.url}/api/campagne/serie/${serie.id}/abandon`, { method: 'POST', headers: { 'X-Requested-With': 'quizz' } })).status, 401)
  } finally {
    await banc.close()
  }
})
