// La saison des fêtes dans l'Expédition (le 18 octobre 2026, l'idée retenue
// par le propriétaire : « Idée 1 2 stp ») : une expédition partie à la saison
// d'une fête — Halloween, Noël, le Nouvel An (`shared/saisons.ts`) — voit sa
// fête tenir la moitié des thèmes pointus de ses cartes (`PART_DE_LA_FETE`),
// et son légendaire garder l'acte 3 s'il ne l'a pas : en expédition, la seule
// porte vers lui, ouverte à sa saison seulement. Le banc ferme le calendrier
// des expéditions, comme celui des soirées ; ce fichier le rouvre.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { calendrierDesExpeditions } from '../src/core/saisons'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { SAISONS, periodeDu } from '../../shared/saisons'
import { sujetParCle } from '../../shared/sujets'
import { LEGENDAIRES_A_JOKER } from '../../shared/jokers'
import { ACTES, PART_DE_LA_FETE, carteDUnActe, gardiensDe, type DepartDExpedition, type VueDeLExpedition } from '../../shared/expedition'

calendrierDesExpeditions.periodeDu = periodeDu

function question(i: number, categorie: Categorie, difficulte: number, sousTheme = SOUS_THEMES[categorie][0].cle): QuestionDeLaBase {
  const lu = lireQuestionDeLaBase({
    id: `sais${String(i).padStart(4, '0')}`,
    texte: `Question d'essai de la saison numéro ${i} : laquelle est la bonne ?`,
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

// De quoi tirer trois actes, et Halloween : vingt et une questions de chaque marche, soixante-trois — de quoi en faire un
// thème pointu (`QUESTIONS_POUR_UN_SENTIER_DE_SUJET`).
const BASE = new BaseDeLaCampagne([
  ...CATEGORIES.flatMap((c, k) => [2, 3, 4].flatMap((d, m) => Array.from({ length: 8 }, (_, i) => question(k * 100 + m * 10 + i, c, d)))),
  ...[2, 3, 4].flatMap((d, m) => Array.from({ length: 21 }, (_, i) => question(2000 + m * 100 + i, 'Autour de la fête', d, 'halloween'))),
])

/** Midi à Paris, ce jour-là : la saison se lit au jour de Paris. */
const jour = (mois: number, j: number) => Date.UTC(2026, mois - 1, j, 10)
let maintenant = jour(10, 28)
let banc: Banc

before(async () => {
  banc = await demarrer({ baseDeLaCampagne: BASE, horlogeDuJour: () => maintenant })
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

const departDe = (id: string): DepartDExpedition => base(db => JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(id) as { expedition: string }).expedition))

test('chaque saison de l’Expédition a sa fête parmi les sujets, et son légendaire son joker', () => {
  // Les cinq fêtes du 1er novembre 2026 n'ont pas de joker : l'Expédition ne les fête pas (`saisonDuDepart`).
  const deLExpedition = SAISONS.filter(s => LEGENDAIRES_A_JOKER.includes(s.legendaire))
  assert.deepEqual(deLExpedition.map(s => s.key).sort(), ['halloween', 'noel', 'nouvel-an'])
  for (const s of deLExpedition) assert.equal(sujetParCle(s.key)?.famille, 'fete', s.key)
})

test('à une fête sans joker, l’expédition part comme hors saison : ni sa fête, ni son légendaire à l’acte 3', async () => {
  // Le samedi saint 2027 : Pâques tombe le 28 mars, sa fête court du vendredi saint au lundi.
  maintenant = Date.UTC(2027, 2, 27, 10)
  try {
    assert.equal(periodeDu('2027-03-27')?.saison.key, 'paques')
    const paul = await inscrireProfil(banc.url, 'paques', 'Paul')
    const page = (await lire(paul, '/api/expedition')).corps
    assert.equal(page.prochaine.saison, undefined)
    assert.ok(!page.prochaine.gardiens.includes('lg:oeuf'), page.prochaine.gardiens.join(' '))
  } finally {
    maintenant = jour(10, 28)
  }
})

test('à sa saison, la fête tient la moitié des thèmes pointus des cartes', () => {
  const sujets = ['animaux', 'annees-80', 'astronomie', 'halloween', 'pieges']
  const part = (fete?: string) => {
    let pointus = 0
    let siens = 0
    for (let i = 0; i < 800; i++) {
      for (const e of carteDUnActe(`saison:${i}`, i % ACTES, sujets, fete).escales) {
        if (e.theme && 'sujet' in e.theme) {
          pointus++
          if (e.theme.sujet === 'halloween') siens++
        }
      }
    }
    return siens / pointus
  }
  // La moitié par la fête, puis sa part du tirage ordinaire : un sujet sur cinq ici.
  assert.ok(Math.abs(part('halloween') - (PART_DE_LA_FETE + (1 - PART_DE_LA_FETE) / sujets.length)) < 0.05, `${part('halloween')}`)
  assert.ok(Math.abs(part() - 1 / sujets.length) < 0.05, `hors saison, un sur cinq : ${part()}`)
})

test('à sa saison, son légendaire garde l’acte 3 — s’il ne l’a pas, et s’il n’est pas l’invité du jour', () => {
  for (let i = 0; i < 50; i++) {
    const graine = `gardiens:${i}`
    const avant = gardiensDe(graine, new Set(), 'lg:kraken')
    assert.deepEqual(gardiensDe(graine, new Set(), 'lg:kraken', 'lg:citrouille'), [avant[0], avant[1], 'lg:citrouille'], 'les deux premiers restent ceux d’avant')
    assert.deepEqual(gardiensDe(graine, new Set(['lg:citrouille']), 'lg:kraken', 'lg:citrouille'), avant, 'déjà à lui : rien ne change')
    assert.deepEqual(gardiensDe(graine, new Set(), 'lg:citrouille', 'lg:citrouille'), gardiensDe(graine, new Set(), 'lg:citrouille'), 'l’invité du jour ne garde pas l’acte')
  }
})

test('la page annonce la saison, le départ la garde ; hors saison, rien ; déjà à lui, la fête seule', async () => {
  maintenant = jour(10, 28)
  const lea = await inscrireProfil(banc.url, 'saison', 'Saison')
  const page = (await lire(lea, '/api/expedition')).corps
  assert.equal(page.prochaine.saison, 'halloween')
  assert.equal(page.prochaine.gardiens[ACTES - 1], 'lg:citrouille', 'la Citrouille garde l’acte 3')

  const v = (await poster(lea, '/api/expedition')).corps as VueDeLExpedition
  assert.equal(v.saison, 'halloween')
  assert.equal(v.gardiens[ACTES - 1].cle, 'lg:citrouille')
  const depart = departDe(v.id)
  assert.equal(depart.saison, 'halloween')
  assert.deepEqual(depart.gardiens, page.prochaine.gardiens, 'le départ retrouve ce que la page annonçait')
  // Halloween est le seul sujet que la base sert assez : chaque thème pointu est lui.
  const pointus = depart.cartes.flatMap(c => c.escales.flatMap(e => (e.theme && 'sujet' in e.theme ? [e.theme.sujet] : [])))
  assert.ok(pointus.every(s => s === 'halloween'), pointus.join(' '))
  assert.equal((await poster(lea, `/api/expedition/${v.id}/abandon`)).status, 200)

  // Le lendemain de sa saison : plus rien.
  maintenant = jour(11, 2)
  const apres = (await lire(lea, '/api/expedition')).corps
  assert.equal(apres.prochaine.saison, undefined)
  assert.notEqual(apres.prochaine.gardiens[ACTES - 1], 'lg:citrouille')

  // Déjà à lui : la fête reste sur les cartes, la Citrouille ne garde plus rien.
  maintenant = jour(10, 31)
  const id = (await lire(lea, '/api/joueur/moi')).corps.profile.id
  base(db => {
    db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'saison:halloween', '#jour:2026-10-27', '', '🎃', 'Saison : Halloween', 1)`).run(id)
  }, true)
  await banc.redemarrer()
  const sienne = (await lire(lea, '/api/expedition')).corps
  assert.equal(sienne.prochaine.saison, 'halloween')
  assert.notEqual(sienne.prochaine.gardiens[ACTES - 1], 'lg:citrouille')
})
