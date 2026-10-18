// Le passeport de l'Expédition (le 18 octobre 2026, l'idée retenue par le
// propriétaire : « Idée 1 2 stp ») : chaque thème pointu trouvé met son
// tampon au passeport, une fois — la réponse écrit son thème
// (`campagne_reponses.sujet`), le passeport se relit d'elle ; la carte dit
// ceux qui lui manquent ; le Globe-trotter les compte. Rien ne s'écrit à côté
// du journal, et la page n'attend pas un aller-retour de plus.
//
// La carte se tire au hasard de la graine : chaque essai force ses escales
// dans le départ gardé en base, puis redémarre le serveur, qui le relit.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { FAMILLES_DE_SUJETS, SUJETS } from '../../shared/sujets'
import { AUCUNE_CAMPAGNE } from '../../shared/profil'
import { paliersDeCampagneAtteints } from '../../shared/hautsfaits'
import { passeportParFamille, type DepartDExpedition, type EscaleDeLaCarte, type VueDeLExpedition } from '../../shared/expedition'

/** Une question d'essai de cette catégorie et de ce sous-thème : 2 facile, 3 moyenne, 4 difficile. */
function question(i: number, categorie: Categorie, difficulte: number, sousTheme = SOUS_THEMES[categorie][0].cle): QuestionDeLaBase {
  const lu = lireQuestionDeLaBase({
    id: `pass${String(i).padStart(4, '0')}`,
    texte: `Question d'essai du passeport numéro ${i} : laquelle est la bonne ?`,
    reponses: [`Bonne ${i}`, `Autre A${i}`, `Autre B${i}`, `Autre C${i}`],
    bonne: 0,
    anecdote: `L'anecdote de la question ${i}.`,
    categorie,
    sousTheme,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: [`Autre A${i}`, `Autre B${i}`, `Autre C${i}`, `Leurre D${i}`, `Leurre E${i}`],
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${i} : ${lu.refus}`)
  return lu.question
}

// Huit questions de chaque marche dans chaque catégorie ; puis les mammifères — Les animaux — et l'espace —
// L'astronomie —, de quoi tirer deux thèmes pointus à chaque marche.
const BASE = new BaseDeLaCampagne([
  ...CATEGORIES.flatMap((c, k) => [2, 3, 4].flatMap((d, m) => Array.from({ length: 8 }, (_, i) => question(k * 100 + m * 10 + i, c, d)))),
  ...[2, 3, 4].flatMap((d, m) => Array.from({ length: 8 }, (_, i) => question(2000 + m * 10 + i, 'Nature', d, 'mammiferes'))),
  ...[2, 3, 4].flatMap((d, m) => Array.from({ length: 8 }, (_, i) => question(3000 + m * 10 + i, 'Sciences', d, 'espace'))),
])

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

const questionsDe = (id: string): { id: string; reponses: string[]; bonne: number; sujet?: string }[] =>
  base(db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions))

/** Partir, puis récrire le départ gardé — `forcer` le change —, et redémarrer le serveur pour qu'il le relise. */
async function partirEt(cookie: string, forcer: (depart: DepartDExpedition) => void): Promise<VueDeLExpedition> {
  const v = (await poster(cookie, '/api/expedition')).corps as VueDeLExpedition
  base(db => {
    const depart = JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(v.id) as { expedition: string }).expedition) as DepartDExpedition
    forcer(depart)
    db.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(depart), v.id)
  }, true)
  await banc.redemarrer()
  return (await lire(cookie, '/api/expedition')).corps.expedition
}

/** Une escale changée en question à quatre choix sur ce thème pointu. */
function enThemePointu(e: EscaleDeLaCarte, sujet: string) {
  e.sorte = 'question'
  e.theme = { sujet }
  e.forme = 'quatre'
  e.chance = 0.5
}
const etage = (depart: DepartDExpedition, n: number) => depart.cartes[0].escales.filter(e => e.etage === n)
const pointues = (v: VueDeLExpedition, sujet: string) => v.carte!.escales.filter(e => e.theme && 'sujet' in e.theme && e.theme.sujet === sujet)

async function avancer(cookie: string, v: VueDeLExpedition, vers: string): Promise<VueDeLExpedition> {
  const r = await poster(cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'avancer', vers } })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps.expedition
}

async function repondre(cookie: string, v: VueDeLExpedition, juste: boolean) {
  const q = questionsDe(v.id)[v.question!.index]
  const r = await poster(cookie, `/api/expedition/${v.id}/reponse`, { position: v.question!.index, choix: juste ? q.bonne : (q.bonne + 1) % q.reponses.length })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}

const sujetDeLaReponse = (id: string, position: number): string | null =>
  base(db => (db.prepare('SELECT sujet FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(id, position) as { sujet: string | null }).sujet)

test('le passeport, famille par famille dans l’ordre de l’onglet des thèmes : chaque sujet qu’une carte peut tirer', () => {
  const vide = passeportParFamille([])
  assert.deepEqual(
    vide.map(f => f.famille),
    FAMILLES_DE_SUJETS.map(f => f.famille).filter(f => SUJETS.some(s => s.famille === f)),
  )
  assert.equal(
    vide.reduce((n, f) => n + f.sujets.length, 0),
    SUJETS.length,
  )
  assert.ok(vide.every(f => f.tamponnes === 0))
  // Un tampon d'un sujet sorti du catalogue ne se montre pas ; ceux qu'il a, si.
  const plein = passeportParFamille(['animaux', 'halloween', 'sport/football', 'avant-1800'])
  assert.equal(
    plein.reduce((n, f) => n + f.tamponnes, 0),
    2,
  )
  assert.ok(plein.find(f => f.famille === 'fete')!.sujets.find(s => s.cle === 'halloween')!.tamponne)
})

test('le Globe-trotter : bronze à dix tampons, argent à quarante, or au passeport complet', () => {
  const tombes = (tampons: number) => paliersDeCampagneAtteints({ ...AUCUNE_CAMPAGNE, tampons }).filter(c => c.startsWith('hf:globe-trotter'))
  assert.deepEqual(tombes(9), [])
  assert.deepEqual(tombes(10), ['hf:globe-trotter:1'])
  assert.deepEqual(tombes(40), ['hf:globe-trotter:1', 'hf:globe-trotter:2'])
  assert.deepEqual(tombes(SUJETS.length), ['hf:globe-trotter:1', 'hf:globe-trotter:2', 'hf:globe-trotter:3'], 'l’or : un tampon par sujet de l’onglet des thèmes')
})

test('un thème pointu trouvé met son tampon au passeport, une fois ; la carte dit ceux qui lui manquent', async () => {
  const lea = await inscrireProfil(banc.url, 'passeport', 'Passeport')
  assert.deepEqual((await lire(lea, '/api/expedition')).corps.passeport, [], 'un passeport vierge')
  // Les animaux en bas et au troisième étage, l'astronomie au deuxième.
  let v = await partirEt(lea, depart => {
    for (const e of etage(depart, 0)) enThemePointu(e, 'animaux')
    for (const e of etage(depart, 1)) enThemePointu(e, 'astronomie')
    for (const e of etage(depart, 2)) enThemePointu(e, 'animaux')
  })
  assert.ok([...pointues(v, 'animaux'), ...pointues(v, 'astronomie')].every(e => e.aTamponner), 'tous à tamponner')
  // La carte gardée n'en sait rien : la vue seule le pose.
  const garde = base(db => (db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(v.id) as { expedition: string }).expedition)
  assert.ok(!garde.includes('aTamponner'))

  // Trouvé : son tampon, que la réponse écrit avec elle.
  v = await avancer(lea, v, v.permises[0])
  assert.equal(questionsDe(v.id)[v.question!.index].sujet, 'animaux', 'tirée de son tas, elle porte son thème pointu')
  let r = await repondre(lea, v, true)
  assert.equal(r.tampon, 'animaux')
  assert.equal(sujetDeLaReponse(v.id, v.question!.index), 'animaux')
  v = r.expedition
  assert.ok(pointues(v, 'animaux').every(e => !e.aTamponner), 'les animaux sont au passeport : la carte ne les signale plus')
  assert.ok(pointues(v, 'astronomie').every(e => e.aTamponner))

  // Raté : ni tampon, ni signal éteint — la réponse dit quand même son thème.
  v = await avancer(lea, v, v.permises[0])
  r = await repondre(lea, v, false)
  assert.equal(r.tampon, undefined)
  assert.equal(sujetDeLaReponse(v.id, v.question!.index), 'astronomie')
  v = r.expedition
  assert.ok(pointues(v, 'astronomie').filter(e => !v.trace.includes(e.id)).every(e => e.aTamponner))

  // Retrouvé : rien de neuf.
  v = await avancer(lea, v, v.permises[0])
  r = await repondre(lea, v, true)
  assert.equal(r.tampon, undefined, 'un tampon par thème, une fois')

  // La page relit le passeport ; le Globe-trotter compte ses tampons.
  assert.deepEqual((await lire(lea, '/api/expedition')).corps.passeport, ['animaux'])
  const moi = (await lire(lea, '/api/joueur/moi')).corps.profile
  assert.equal(moi.hautsFaits.find((h: { key: string }) => h.key === 'hf:globe-trotter')?.valeur, 1)

  // Un redémarrage : la mémoire perdue, le passeport se relit avec l'expédition.
  await banc.redemarrer()
  v = (await lire(lea, '/api/expedition')).corps.expedition
  assert.ok(pointues(v, 'animaux').every(e => !e.aTamponner))
})
