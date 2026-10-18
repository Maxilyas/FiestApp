// Le codex par ses routes, sur un vrai serveur (la version 7 du départ, le 18
// octobre 2026) : le bilan écrit à la fin d'une expédition — abandonnée
// aussi —, la renommée relue des bilans de toutes ses expéditions finies —
// rattrapée du pli pour celles qui n'en ont pas, une fois —, le niveau qu'elle
// fait et ce qu'il ouvre, figés au départ ; la carte de ses légendaires au
// codex, et l'invité du jour qui prête la sienne. Les règles et le pli :
// `codex.test.ts`.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { NIVEAUX, codexDuNiveau, ecrireLeBilan, type BilanDUneExpedition } from '../../shared/codex'
import { paquetDesRencontres } from '../../shared/rencontres'
import { cleDeLExpedition } from '../../shared/legendaires'
import type { DepartDExpedition, PageDeLExpedition, VueDeLExpedition } from '../../shared/expedition'

function question(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `codx${String(i).padStart(4, '0')}`,
    texte: `Question d'essai du codex numéro ${i} : laquelle de ces réponses est la bonne ?`,
    reponses: [`Bonne ${i}`, ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de la question ${i}.`,
    categorie,
    sousTheme: SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: autres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${i} : ${lu.refus}`)
  return lu.question
}

const BASE = new BaseDeLaCampagne(CATEGORIES.flatMap((c, k) => [2, 3, 4].flatMap((d, m) => Array.from({ length: 8 }, (_, i) => question(k * 100 + m * 10 + i, c, d)))))

let banc: Banc

before(async () => {
  banc = await demarrer({ baseDeLaCampagne: BASE })
})

after(() => banc.close())

const lire = (cookie: string, chemin: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (cookie: string, chemin: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(fn: (db: Database.Database) => T, ecriture = false): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: !ecriture, fileMustExist: true })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const bilanEnBase = (id: string) => base(db => (db.prepare('SELECT bilan FROM campagne_series WHERE id = ?').get(id) as { bilan: string | null }).bilan)
const ecrireLeBilanEnBase = (id: string, bilan: string | null) => base(db => db.prepare('UPDATE campagne_series SET bilan = ? WHERE id = ?').run(bilan, id), true)
const departDe = (id: string): DepartDExpedition => base(db => JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(id) as { expedition: string }).expedition))
const page = async (c: string): Promise<PageDeLExpedition> => (await lire(c, '/api/expedition')).corps

/** Partir aux rencontres, faire un pas, et abandonner : une expédition finie, son bilan écrit — une escale. */
async function unPasPuisAbandon(c: string): Promise<string> {
  const parti = await poster(c, '/api/expedition', { rencontres: true })
  assert.equal(parti.status, 200, parti.corps.error)
  let v = parti.corps as VueDeLExpedition
  assert.equal(v.renommee, 0, 'avant le premier pas, rien')
  const pas = await poster(c, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'avancer', vers: v.permises[0] } })
  assert.equal(pas.status, 200, pas.corps.error)
  v = pas.corps.expedition
  assert.equal(v.renommee, 1, 'la vue dit déjà ce qu’elle rapporte : une escale')
  const fin = await poster(c, `/api/expedition/${v.id}/abandon`)
  assert.equal(fin.status, 200, fin.corps.error)
  assert.equal(fin.corps.expedition.renommee, 1)
  return v.id
}

const UNE_ESCALE: BilanDUneExpedition = { escales: 1, adversaires: 0, elites: 0, gardiens: 0, auBout: false }

test('la fin d’une expédition écrit son bilan — abandonnée aussi : un joueur qui tombe tôt avance quand même', async () => {
  const c = await inscrireProfil(banc.url, 'bilan', 'Bilan')
  assert.deepEqual((await page(c)).prochaine.codex, { renommee: 0, ...codexDuNiveau(1, []) }, 'au premier départ, le niveau 1')
  const id = await unPasPuisAbandon(c)
  assert.equal(bilanEnBase(id), ecrireLeBilan(UNE_ESCALE))
  assert.equal((await page(c)).prochaine.codex?.renommee, 1, 'la page la relit')
})

test('la renommée se relit de toutes ses expéditions finies : son niveau, ses cartes, ses règles, figés au départ — sa catégorie fétiche part au niveau 5', async () => {
  const c = await inscrireProfil(banc.url, 'aguerri', 'Aguerri')
  const finie = await unPasPuisAbandon(c)
  // Le niveau 5, juste : le pari, les talismans et la catégorie fétiche ouverts.
  ecrireLeBilanEnBase(finie, ecrireLeBilan({ ...UNE_ESCALE, escales: NIVEAUX[4] }))
  const codex = (await page(c)).prochaine.codex!
  assert.deepEqual(codex, { renommee: NIVEAUX[4], ...codexDuNiveau(5, []) })
  assert.deepEqual(codex.regles, ['pari', 'talismans', 'fetiche'])
  const parti = await poster(c, '/api/expedition', { rencontres: true, fetiche: 'Histoire' })
  assert.equal(parti.status, 200, parti.corps.error)
  const v = parti.corps as VueDeLExpedition
  assert.equal(v.fetiche, 'Histoire', 'au niveau 5, sa catégorie fétiche part avec lui')
  assert.deepEqual(departDe(v.id).codex, { ...codexDuNiveau(5, []), renommee: NIVEAUX[4] })
  assert.deepEqual(v.cartes?.codex, { niveau: 5, regles: ['pari', 'talismans', 'fetiche'], renommee: NIVEAUX[4], exploits: [] })
  assert.deepEqual(v.exploits, [], 'aucun exploit au départ')
  // La renommée qui monte en route ne change rien à l'expédition partie : son codex est figé.
  ecrireLeBilanEnBase(finie, ecrireLeBilan({ ...UNE_ESCALE, escales: NIVEAUX[8] }))
  const relue = await page(c)
  assert.equal(relue.prochaine.codex?.niveau, 9, 'la prochaine partira au niveau 9')
  assert.equal(relue.expedition?.cartes?.codex?.niveau, 5, 'celle en route reste au 5')
})

test('une expédition finie sans bilan — d’avant le codex, d’avant les exploits, ou qui ne se lit pas — se relit de son pli, et son bilan s’écrit', async () => {
  const c = await inscrireProfil(banc.url, 'ancien', 'Ancien')
  const finie = await unPasPuisAbandon(c)
  for (const brut of [
    null,
    'pas du JSON',
    JSON.stringify({ v: 99, escales: 500, adversaires: 0, elites: 0, gardiens: 0, auBout: false }),
    // Le bilan de la version 1 (le 18 octobre 2026), sans ses exploits : replié une fois, ce qu'elle a fait d'exploit compte.
    JSON.stringify({ v: 1, escales: 500, adversaires: 0, elites: 0, gardiens: 0, auBout: false }),
  ]) {
    ecrireLeBilanEnBase(finie, brut)
    await banc.redemarrer()
    assert.equal((await page(c)).prochaine.codex?.renommee, 1, `${brut} : refait du pli, une escale`)
    assert.equal(bilanEnBase(finie), ecrireLeBilan(UNE_ESCALE), `${brut} : son bilan écrit, pour ne la replier qu’une fois`)
  }
})

test('ses exploits se relisent des bilans : chacun ouvre sa carte au codex, se fige au départ, et une expédition qui en refait un n’en dit rien de neuf', async () => {
  const c = await inscrireProfil(banc.url, 'exploits', 'Exploits')
  const finie = await unPasPuisAbandon(c)
  assert.deepEqual((await page(c)).prochaine.codex?.exploits, [])
  // Une expédition d'avant y a gagné un gros pari et tenu un gardien sans perdre de courage.
  ecrireLeBilanEnBase(finie, ecrireLeBilan({ ...UNE_ESCALE, exploits: ['gardien-intact', 'pari-de-40'] }))
  const codex = (await page(c)).prochaine.codex!
  assert.deepEqual(codex, { renommee: 1, ...codexDuNiveau(1, [], ['pari-de-40', 'gardien-intact']) })
  assert.deepEqual(codex.exploits, ['pari-de-40', 'gardien-intact'])
  assert.ok(codex.cartes.includes('banco'), 'Banco s’ouvre par son exploit, dès le niveau 1')
  assert.ok(!codex.cartes.includes('lancee'), 'Lancée attend le sien')
  const parti = await poster(c, '/api/expedition', { rencontres: true })
  assert.equal(parti.status, 200, parti.corps.error)
  const v = parti.corps as VueDeLExpedition
  assert.deepEqual(departDe(v.id).codex?.exploits, ['pari-de-40', 'gardien-intact'], 'figés au départ')
  assert.deepEqual(v.cartes?.codex?.exploits, ['pari-de-40', 'gardien-intact'], 'la page les lit : le dos doré, et ce qui sera neuf à la fin')
  assert.deepEqual(v.exploits, [])
})

test('ses légendaires ouvrent leur carte au codex ; plus d’équipe à choisir — l’invité du jour prête la sienne', async () => {
  const c = await inscrireProfil(banc.url, 'collection', 'Collection')
  const id = (await lire(c, '/api/joueur/moi')).corps.profile.id as string
  base(db => {
    db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#campagne:essai', '', '🧭', 'essai', 1)`).run(id, cleDeLExpedition('lg:phenix'))
  }, true)
  // Relu au démarrage : le profil sait ce qu'il a.
  await banc.redemarrer()
  const p = await page(c)
  assert.ok(p.prochaine.codex?.cartes.includes('renaissance'), 'la carte du Phénix, qu’il a')
  assert.deepEqual(p.prochaine.codex, { renommee: 0, ...codexDuNiveau(1, ['lg:phenix']) })
  // Une équipe demandée ne part pas : l'invité du jour seul, sa carte dans le paquet.
  const parti = await poster(c, '/api/expedition', { rencontres: true, equipee: ['lg:phenix'] })
  assert.equal(parti.status, 200, parti.corps.error)
  const v = parti.corps as VueDeLExpedition
  assert.deepEqual(v.equipee, [p.prochaine.invite])
  assert.deepEqual(v.cartes?.paquet, paquetDesRencontres([p.prochaine.invite]))
})
