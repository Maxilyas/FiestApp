// Le dé à chances égales, sur ce qu'on choisit (le retour du propriétaire du
// 16 octobre 2026, en ligue d'or, presque platine : « je veux jouer contre un
// automate, déjà ça lance le défi et il est toujours en cours même si j'ai
// pas lancé. Je peux pas choisir le thème. Et surtout je perds 17 pour gagner
// 4. C'est normal ? »). Automate joue au niveau de la cote cachée — on le bat
// quatre fois sur dix —, mais l'enjeu lisait son score contre la cote qu'on
// voit, que la montée et les duels entre amis portaient 300 points plus haut :
// pour la formule, 88 % de chances. Il compte désormais comme un adversaire de
// sa cote ; dès l'Or, une défaite coûte l'ELO (24 × E), plus 24 × E² ; et le
// dé tire sur ce qu'on a choisi. Chaque test échouait avant, sauf celui du
// plancher : une règle qui tenait déjà, et que l'enjeu du dé suppose. Que sa
// feuille s'ouvre avant de tirer : `duels-enjeu.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { VIES } from '../../shared/campagne'
import {
  COTE_DE_DEPART,
  PARTICIPATION_AU_DESSUS,
  chancesDeGagner,
  enjeuDuDe,
  ecartDeLaMontee,
  niveauDeLaCote,
  plancherApres,
  releverLesDuels,
  type DuelJoue,
} from '../../shared/duels'
import { ProfileStore } from '../src/auth/profiles'
import { CampagneStore } from '../src/core/campagne'

ProfileStore.tirageEclat = () => false

const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const semaine = () => '2026-10-05'

/** Trente duels au dé contre un Automate qui fait toujours `sesJustes` : deux gagnés sur cinq, d'une bonne réponse. */
const contreAutomate = (sesJustes: number): DuelJoue[] =>
  Array.from({ length: 30 }, (_, i) => ({ serie: `d${String(i).padStart(2, '0')}`, finiLe: DEBUT + i * 60_000, sesJustes, justes: i % 5 < 2 ? sesJustes + 1 : sesJustes - 1 }))

test('au dé, un duel à chances égales : l’enjeu ne dépend plus du score d’Automate — en Or, presque platine, « +13 / −11 », plus « +4 / −17 »', () => {
  // Le retour même : 1274 en Or. Contre la cote de six bonnes réponses, la formule lui prêtait 88 % de chances.
  assert.deepEqual(enjeuDuDe(1274), { cote: 1274, gagne: 13, egalite: 1, perdu: -11 })
  assert.ok(chancesDeGagner(1274, 950) > 0.85, 'ce qui faisait « +4 / −17 »')
  // Sous l'Or, la montée : même perdu, il rapporte.
  assert.deepEqual(enjeuDuDe(COTE_DE_DEPART), { cote: COTE_DE_DEPART, gagne: 17, egalite: 4, perdu: 2 })
  // Son plancher se lit de sa cote même : l'Or tout juste atteint, rien à perdre ; un peu au-dessus, jusqu'au seuil.
  assert.equal(enjeuDuDe(1200).perdu, 0)
  assert.equal(enjeuDuDe(1205).perdu, -5)

  // Joué : contre un Automate à quatre ou à douze, la cote qu'on voit bouge pareil, duel pour duel.
  const contreQuatre = releverLesDuels(contreAutomate(4), semaine)
  const contreDouze = releverLesDuels(contreAutomate(12), semaine)
  assert.deepEqual([...contreQuatre.ecarts.entries()], [...contreDouze.ecarts.entries()])
  assert.equal(contreQuatre.cote, contreDouze.cote)
  assert.ok(contreQuatre.cote >= 1200, `trente duels, deux gagnés sur cinq : l’Or atteint, et gardé (${contreQuatre.cote})`)
  // Et chaque duel a fait ce que la feuille annonçait, avant de tirer — plancher compris.
  for (const { avant, ecart } of contreQuatre.ecarts.values()) {
    assert.ok(ecart === enjeuDuDe(avant).gagne || ecart === enjeuDuDe(avant).perdu, `${avant} : ${ecart}`)
  }
  // La cachée, elle, apprend de son score : c'est elle qui règle Automate.
  assert.ok(contreQuatre.cachee < contreDouze.cachee, `${contreQuatre.cachee} contre ${contreDouze.cachee}`)
  assert.ok(niveauDeLaCote(contreDouze.cachee) > niveauDeLaCote(contreQuatre.cachee))
})

test('dès l’Or, l’ELO : à ses vraies chances, un duel ne rapporte en moyenne que sa participation — 24 × E² en donnait jusqu’à quatre de plus', () => {
  // Entre amis aux cotes gonflées pareil, chacun à ses vraies chances : le haut montait de 2,3 points par duel
  // (mesuré en production le 16 octobre 2026), et Automate à chances égales en aurait rapporté quatre.
  for (const cote of [1200, 1290, 1400, 1550]) {
    for (let ecart = -400; ecart <= 400; ecart += 25) {
      const e = chancesDeGagner(cote, cote + ecart)
      const moyen = e * ecartDeLaMontee(cote, cote + ecart, 1) + (1 - e) * ecartDeLaMontee(cote, cote + ecart, 0)
      assert.ok(Math.abs(moyen - PARTICIPATION_AU_DESSUS) <= 0.5, `${cote} contre ${ecart > 0 ? '+' : ''}${ecart} : ${moyen.toFixed(2)} en moyenne`)
    }
  }
  // Une égalité à chances égales : la participation, rien d'autre.
  assert.equal(ecartDeLaMontee(1300, 1300, 0.5), PARTICIPATION_AU_DESSUS)
  // Sous l'Or, la montée ne change pas : même une défaite rapporte.
  assert.equal(ecartDeLaMontee(1100, 1100, 0), 2)
})

test('le plancher se lit de la cote : une ligue gardée atteinte, elle ne repasse jamais dessous — l’enjeu du dé s’en sert', () => {
  // Des journaux au hasard, gagnés, perdus, contre tous les scores et toutes les cotes : le plancher que le relevé tient
  // est toujours celui que sa cote dit (`enjeuDuDe` le relit d'elle, sans plancher à transmettre). Un hasard qui se rejoue.
  let graine = 7
  const hasard = () => {
    graine = (graine + 0x6d2b79f5) >>> 0
    let t = Math.imul(graine ^ (graine >>> 15), graine | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let essai = 0; essai < 60; essai++) {
    const journal: DuelJoue[] = Array.from({ length: 80 }, (_, i) => {
      const sesJustes = Math.floor(hasard() * 18)
      const d: DuelJoue = { serie: `e${i}`, finiLe: DEBUT + i * 60_000, sesJustes, justes: Math.max(0, sesJustes + Math.floor(hasard() * 7) - 3) }
      return hasard() < 0.5 ? { ...d, coteAdverse: 800 + Math.floor(hasard() * 900) } : d
    })
    for (let n = 1; n <= journal.length; n += 7) {
      const r = releverLesDuels(journal.slice(0, n), semaine)
      assert.equal(r.plancher, plancherApres(null, r.cote), `essai ${essai}, ${n} duels : ${r.cote} sur ${r.plancher}`)
    }
  }
})

// ── Le serveur ──────────────────────────────────────────────────────────────

// Douze questions par catégorie ; celles de Nature sont des animaux (`animaux`, `shared/sujets.ts`).
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Ce que la base garde d'une série : ses questions, et ce qu'elle visait. */
function enBase(banc: Banc, serie: string): { questions: { bonne: number; reponses: string[]; categorie: string }[]; categories: string | null; sujet: string | null } {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const l = db.prepare('SELECT questions, categories, sujet FROM campagne_series WHERE id = ?').get(serie) as { questions: string; categories: string | null; sujet: string | null }
    return { ...l, questions: JSON.parse(l.questions) }
  } finally {
    db.close()
  }
}

test('le dé tire sur ce qu’il a choisi — des catégories, un sujet — ; celui laissé en route reprend sur les siens', async () => {
  const avant = CampagneStore.reponsesDAutomate
  const niveaux: number[] = []
  // Automate fait sept bonnes réponses, puis trois fautes : le niveau qu'on lui demande, retenu.
  CampagneStore.reponsesDAutomate = ({ niveau }) => (niveaux.push(niveau), [...Array(7).fill(true), ...Array(VIES).fill(false)])
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    // Sur l'histoire : toute sa série en est, et elle le garde — la partie et la page le disent.
    const histoire = await poster(banc, lea, '/api/campagne/rencontre', { categories: ['Histoire'] })
    assert.equal(histoire.status, 200, histoire.corps.error)
    const id = histoire.corps.serie.id as string
    const garde = enBase(banc, id)
    assert.ok(garde.questions.length >= 10)
    assert.deepEqual([...new Set(garde.questions.map(q => q.categorie))], ['Histoire'])
    assert.deepEqual([garde.categories, garde.sujet], [JSON.stringify(['Histoire']), null])
    assert.deepEqual(histoire.corps.serie.categories, ['Histoire'])
    // Ce qu'il met en jeu : à chances égales, sa cote seule — ce que la feuille disait avant de tirer.
    assert.deepEqual(histoire.corps.enjeu, enjeuDuDe(COTE_DE_DEPART))

    // Laissé en route, il reprend sur l'histoire, quoi qu'on demande d'autre : rien de neuf n'est tiré.
    const reprise = await poster(banc, lea, '/api/campagne/rencontre', { sujet: 'animaux' })
    assert.equal(reprise.status, 200, reprise.corps.error)
    assert.equal(reprise.corps.serie.id, id)
    assert.equal(niveaux.length, 1)
    for (let i = 0; i < VIES; i++) {
      const q = garde.questions[i]
      const r = await poster(banc, lea, `/api/campagne/serie/${id}/reponse`, { index: i, choix: (q.bonne + 1) % q.reponses.length })
      assert.equal(r.status, 200, r.corps.error)
    }

    // Sur un sujet : il traverse les catégories — ici, les animaux de la nature.
    const animaux = await poster(banc, lea, '/api/campagne/rencontre', { sujet: 'animaux', categories: ['Histoire'] })
    assert.equal(animaux.status, 200, animaux.corps.error)
    const sur = enBase(banc, animaux.corps.serie.id)
    assert.deepEqual([...new Set(sur.questions.map(q => q.categorie))], ['Nature'])
    assert.deepEqual([sur.categories, sur.sujet], [null, 'animaux'])
    assert.equal(animaux.corps.serie.sujet, 'animaux')
    assert.equal(niveaux.length, 2, 'tiré de neuf : Automate a joué sa partie')
  } finally {
    CampagneStore.reponsesDAutomate = avant
    await banc.close()
  }
})

test('un sujet qui n’existe plus se refuse avec son motif ; sans choix, toutes les catégories', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    const perdu = await poster(banc, zoe, '/api/campagne/rencontre', { sujet: 'atlantide' })
    assert.equal(perdu.status, 400)
    assert.equal(perdu.corps.error, 'Ce sujet n’existe plus : choisis-en un autre')
    // Une catégorie qui n'en est pas une ne filtre rien : comme une série.
    const libre = await poster(banc, zoe, '/api/campagne/rencontre', { categories: ['Astrologie'] })
    assert.equal(libre.status, 200, libre.corps.error)
    const garde = enBase(banc, libre.corps.serie.id)
    assert.ok(new Set(garde.questions.map(q => q.categorie)).size > 1, 'toutes les catégories')
    assert.deepEqual([garde.categories, garde.sujet], [null, null])
  } finally {
    await banc.close()
  }
})
