// Les sentiers à thème (`shared/sentiersDeSujets.ts`, le choix du 10 octobre
// 2026) : un sujet de la campagne — une époque, un fil rouge — monté en six
// paliers de dix questions, sept bonnes réponses pour passer, sans vies.
// Rien d'autre ne les compte : ni les vies des sentiers, ni leurs paliers à
// portrait ; une bonne réponse paie comme en série.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import type { Categorie } from '../../shared/categories'
import { niveauDeQuestion, xpDeLaBonneReponse } from '../../shared/campagne'
import { VIES_PAR_JOUR } from '../../shared/sentiers'
import {
  PALIERS_DES_SUJETS,
  PALIERS_D_UN_SUJET,
  QUESTIONS_D_UN_PALIER_DE_SUJET,
  QUESTIONS_POUR_UN_SENTIER_DE_SUJET,
  SEUIL_D_UN_SUJET,
  epreuveDeSujetFinie,
  etoilesDuSujet,
  issueDuSujet,
} from '../../shared/sentiersDeSujets'

test('six paliers de dix questions, des faciles aux difficiles, sept pour passer — la règle d’une ligne', () => {
  assert.equal(PALIERS_DES_SUJETS.length, PALIERS_D_UN_SUJET)
  const poids = { facile: 1, moyen: 2, difficile: 3, expert: 4 }
  let avant = 0
  for (const r of PALIERS_DES_SUJETS) {
    const total = Object.values(r.melange).reduce((n, x) => n + (x ?? 0), 0)
    assert.equal(total, QUESTIONS_D_UN_PALIER_DE_SUJET, `palier ${r.n} : dix questions`)
    assert.equal(r.melange.expert, undefined, 'jamais une experte')
    assert.equal(r.seuil, SEUIL_D_UN_SUJET)
    const dur = Object.entries(r.melange).reduce((n, [niveau, x]) => n + poids[niveau as keyof typeof poids] * (x ?? 0), 0) / total
    assert.ok(dur > avant, `palier ${r.n} plus dur que le précédent`)
    avant = dur
  }
  // Sept sur dix : la troisième faute de trop l'arrête ; validée, elle va au bout pour les étoiles.
  assert.equal(issueDuSujet(7, 7), 'validee')
  assert.equal(issueDuSujet(5, 8), null, 'trois fautes : sept restent possibles')
  assert.equal(issueDuSujet(5, 9), 'ratee', 'la quatrième')
  assert.equal(epreuveDeSujetFinie(7, 7), false, 'validée, elle continue')
  assert.equal(epreuveDeSujetFinie(7, 10), true)
  assert.deepEqual([6, 7, 8, 9, 10].map(j => etoilesDuSujet(j)), [0, 1, 1, 2, 3])
  // Chaque sujet de la base en a au moins cent (`campagne-sujets.test.ts`) : tous ont leur sentier.
  assert.ok(QUESTIONS_POUR_UN_SENTIER_DE_SUJET <= 100)
})

/** Une question d'essai des années 80 — ou sans date —, de la catégorie et de la difficulté qu'on veut. */
function question(i: number, categorie: Categorie, difficulte: number, annee: string | null): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `them${String(i).padStart(4, '0')}`,
    texte: `Question d'essai d'un sentier à thème numéro ${i} : laquelle est la bonne ?`,
    reponses: [`Bonne ${i}`, ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de la question ${i}.`,
    categorie,
    sousTheme: SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: annee ? { valeur: annee, precision: 'annee' } : null,
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

const CATEGORIES_DU_BANC: Categorie[] = ['Histoire', 'Sport', 'Musique', 'Cinéma & séries']
/** Quatre-vingt-dix questions des années 80 — trente de chacune des trois marches — et vingt sans date. */
const BASE = new BaseDeLaCampagne([
  ...Array.from({ length: 90 }, (_, i) => question(i, CATEGORIES_DU_BANC[i % 4], [2, 3, 4][i % 3], '1985')),
  ...Array.from({ length: 20 }, (_, i) => question(100 + i, CATEGORIES_DU_BANC[i % 4], 2, null)),
])

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function questions(banc: Banc, serie: string): { id: string; bonne: number; reponses: string[]; niveau: string }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)
  } finally {
    db.close()
  }
}

/** Joue une épreuve de sujet : `justes` bonnes réponses d'abord, des fautes ensuite, jusqu'à sa fin. */
async function jouer(banc: Banc, cookie: string, id: string, justes: number) {
  const qs = questions(banc, id)
  let derniere: any = null
  for (let i = 0; i < qs.length; i++) {
    const r = await poster(banc, cookie, `/api/campagne/sujets/epreuve/${id}/reponse`, { index: i, choix: i < justes ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    derniere = r.corps
    if (derniere.epreuve.finie) break
  }
  return derniere
}

test('un sentier à thème se monte palier par palier, sans vies, sur les questions de son sujet', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    // Seuls les sujets qui ont de quoi : les années 80, pas les records ni la France.
    const etat = (await lire(banc, lea, '/api/campagne/sujets')).corps
    assert.deepEqual(etat, { sujets: [{ sujet: 'annees-80', paliers: 0, etoiles: [0, 0, 0, 0, 0, 0] }], epreuve: null })
    assert.equal((await poster(banc, lea, '/api/campagne/sujets/epreuve', { sujet: 'records', palier: 1 })).corps.error, 'Ce sentier n’a pas encore assez de questions : reviens bientôt')
    assert.equal((await poster(banc, lea, '/api/campagne/sujets/epreuve', { sujet: 'annees-80', palier: 2 })).corps.error, 'Valide d’abord le palier 1')

    // Le premier palier : dix faciles des années 80.
    const p1 = (await poster(banc, lea, '/api/campagne/sujets/epreuve', { sujet: 'annees-80', palier: 1 })).corps
    assert.deepEqual([p1.sujet, p1.palier, p1.total, p1.seuil, p1.rejeu], ['annees-80', 1, 10, 7, false])
    assert.equal(p1.question.bonne, undefined, 'jamais la bonne réponse avant la sienne (invariant 1)')
    const tirees = questions(banc, p1.id)
    assert.ok(tirees.every(q => BASE.parId.get(q.id)!.meta.date?.valeur === '1985'), 'toutes du sujet')
    assert.ok(tirees.every(q => q.niveau === 'facile'))
    // Raté : quatre fautes de suite — et pas une vie de moins aux sentiers.
    const rate = await jouer(banc, lea, p1.id, 0)
    assert.deepEqual([rate.epreuve.issue, rate.epreuve.finie, rate.epreuve.justes + rate.epreuve.fausses], ['ratee', true, 4])
    assert.equal((await lire(banc, lea, '/api/campagne/sentiers')).corps.vies.jour, VIES_PAR_JOUR, 'les vies des sentiers ne bougent pas')

    // Rejoué tout de suite : sept bonnes, puis le bout, pour les étoiles.
    const p1b = (await poster(banc, lea, '/api/campagne/sujets/epreuve', { sujet: 'annees-80', palier: 1 })).corps
    assert.notEqual(p1b.id, p1.id)
    const premiere = await poster(banc, lea, `/api/campagne/sujets/epreuve/${p1b.id}/reponse`, { index: 0, choix: questions(banc, p1b.id)[0].bonne })
    assert.equal(premiere.corps.xp, xpDeLaBonneReponse(1), 'une bonne réponse paie comme en série')
    // Laissée, elle reprend où elle en était.
    const reprise = (await poster(banc, lea, '/api/campagne/sujets/epreuve', { sujet: 'annees-80', palier: 1 })).corps
    assert.deepEqual([reprise.id, reprise.question.index], [p1b.id, 1])
    const qs = questions(banc, p1b.id)
    let fin: any
    for (let i = 1; i < 10; i++) {
      fin = (await poster(banc, lea, `/api/campagne/sujets/epreuve/${p1b.id}/reponse`, { index: i, choix: i < 9 ? qs[i].bonne : (qs[i].bonne + 1) % 4 })).corps
    }
    assert.deepEqual([fin.epreuve.issue, fin.epreuve.finie, fin.epreuve.justes, fin.etoiles], ['validee', true, 9, 2])
    const apres = (await lire(banc, lea, '/api/campagne/sujets')).corps
    assert.deepEqual(apres.sujets[0], { sujet: 'annees-80', paliers: 1, etoiles: [2, 0, 0, 0, 0, 0] })

    // Le deuxième palier mêle les moyennes ; le premier se rejoue sans rien risquer.
    const p2 = (await poster(banc, lea, '/api/campagne/sujets/epreuve', { sujet: 'annees-80', palier: 2 })).corps
    assert.deepEqual(
      questions(banc, p2.id)
        .map(q => q.niveau)
        .sort(),
      [...Array(7).fill('facile'), ...Array(3).fill('moyen')],
    )
    // Rejouer le premier referme le deuxième laissé là, sans rien coûter.
    const rejeu = (await poster(banc, lea, '/api/campagne/sujets/epreuve', { sujet: 'annees-80', palier: 1 })).corps
    assert.equal(rejeu.rejeu, true)
    const parfait = await jouer(banc, lea, rejeu.id, 10)
    assert.deepEqual([parfait.etoiles, parfait.record], [3, true])
    // Son record des séries n'en sait rien ; ses confettis, si.
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.record, 0)
    for (const q of questions(banc, rejeu.id)) assert.equal(niveauDeQuestion(BASE.parId.get(q.id)!.meta.difficulte), 'facile')
    // Ses erreurs vont au carnet, comme celles d'une série : les quatre du
    // premier essai, la dernière du deuxième — demain.
    const carnet = (await lire(banc, lea, '/api/campagne/carnet')).corps
    assert.deepEqual([carnet.aRevoir, carnet.demain], [0, 5])
  } finally {
    await banc.close()
  }
})

test('une épreuve à thème finie, même ratée, fait tomber les paliers de la campagne : Le Marathonien compte ses bonnes réponses', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    // 249 bonnes réponses d'avant, dans une révision finie : ni record ni experte.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const id = (db.prepare(`SELECT id FROM profiles WHERE login = 'lea'`).get() as { id: string }).id
      db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES ('avant', ?, '[]', 0, 0, 249, 1, 2, 'revision')`).run(id)
    } finally {
      db.close()
    }
    const e = (await poster(banc, lea, '/api/campagne/sujets/epreuve', { sujet: 'annees-80', palier: 1 })).corps
    // Trois bonnes, puis quatre fautes : ratée, la 250e est dedans.
    const fin = await jouer(banc, lea, e.id, 3)
    assert.deepEqual([fin.epreuve.issue, fin.epreuve.finie], ['ratee', true])
    assert.deepEqual(
      (fin.recompenses ?? []).map((r: any) => r.key),
      ['hf:marathonien:1'],
    )
  } finally {
    await banc.close()
  }
})
