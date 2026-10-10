// Les chapitres des sentiers (`shared/chapitres.ts`, le choix du 10 octobre
// 2026 : des sentiers « beaucoup plus orientés sur un thème précis ») : les
// huit premiers paliers vont par deux, chaque paire pose un thème nommé de sa
// catégorie, puis toute la catégorie du neuvième au maître. Le thème passe
// devant le reste de la catégorie, à la même marche : un chapitre change ce
// qu'on lit, jamais la difficulté que les mélanges ont mesurée.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase } from '../src/core/baseCampagne'
import { tirerUneEpreuve } from '../src/core/campagne'
import { BRANCHES } from '../../shared/branches'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { niveauDeQuestion } from '../../shared/campagne'
import { PALIER_DU_MAITRE, TOUTE_LA_CATEGORIE_DES, regleDuPalier } from '../../shared/sentiers'
import { CHAPITRES_A_THEME, PALIERS_PAR_CHAPITRE, chapitreDuPalier, chapitresDe } from '../../shared/chapitres'

const HEURE_MS = 3600_000
const JOUR_MS = 24 * HEURE_MS
const MAINTENANT = Date.UTC(2026, 9, 10, 20)
const NATURE = SOUS_THEMES.Nature.map(s => s.cle)

/** Une question inventée de la Nature : `n`, sa difficulté, son sous-thème. */
function question(n: number, difficulte: number, sousTheme: string) {
  const lu = lireQuestionDeLaBase({
    id: `c${String(n).padStart(7, '0')}`,
    texte: `La question de chapitre numéro ${n}, est-ce bien celle-ci ?`,
    reponses: [`Bonne ${n}`, `Autre A${n}`, `Autre B${n}`, `Autre C${n}`],
    bonne: 0,
    anecdote: `L'anecdote ${n}.`,
    categorie: 'Nature',
    sousTheme,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: [`Autre A${n}`, `Autre B${n}`, `Autre C${n}`],
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(lu.refus)
  return lu.question
}

/** Une Nature inventée : par sous-thème, `faciles` faciles, vingt moyennes et dix difficiles. */
function nature(faciles: (sousTheme: string) => number = () => 20) {
  let n = 0
  const questions = NATURE.flatMap(s => [
    ...Array.from({ length: faciles(s) }, () => question(n++, 2, s)),
    ...Array.from({ length: 20 }, () => question(n++, 3, s)),
    ...Array.from({ length: 10 }, () => question(n++, 4, s)),
  ])
  return new BaseDeLaCampagne(questions)
}

const compter = (tirees: readonly { question: { meta: { sousTheme: string } } }[]) => {
  const parSousTheme = new Map<string, number>()
  for (const x of tirees) parSousTheme.set(x.question.meta.sousTheme, (parSousTheme.get(x.question.meta.sousTheme) ?? 0) + 1)
  return parSousTheme
}

test('quatre chapitres par sentier, deux paliers chacun ; chaque sous-thème de la catégorie sert une fois ; toute la catégorie ensuite', () => {
  assert.equal(CHAPITRES_A_THEME * PALIERS_PAR_CHAPITRE, TOUTE_LA_CATEGORIE_DES - 1, 'les chapitres s’arrêtent où toute la catégorie commence')
  for (const b of BRANCHES) {
    const chapitres = chapitresDe(b.key)
    assert.equal(chapitres.length, CHAPITRES_A_THEME, b.key)
    assert.deepEqual(
      chapitres.map(c => c.paliers),
      [
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
      ],
    )
    const catalogue = SOUS_THEMES[b.categorie as keyof typeof SOUS_THEMES].map(s => s.cle)
    const servis = chapitres.flatMap(c => c.sousThemes)
    assert.deepEqual([...servis].sort(), [...catalogue].sort(), `${b.key} : chaque sous-thème de ${b.categorie}, une fois`)
    for (const c of chapitres) {
      // Il s'écrit sur le chemin, à côté de ses paliers : court.
      assert.ok(c.nom.length <= 34, `« ${c.nom} » tient sur le chemin`)
      assert.equal(chapitreDuPalier(b.key, c.paliers[0])?.nom, c.nom)
      assert.equal(chapitreDuPalier(b.key, c.paliers[1])?.nom, c.nom)
    }
    assert.equal(new Set(chapitres.map(c => c.nom)).size, CHAPITRES_A_THEME, 'quatre noms différents')
    for (let n = TOUTE_LA_CATEGORIE_DES; n <= PALIER_DU_MAITRE; n++) assert.equal(chapitreDuPalier(b.key, n), null, `palier ${n} : toute la catégorie`)
  }
  assert.equal(chapitreDuPalier('foret', 0), null)
})

test('le thème du chapitre passe devant le reste de la catégorie, à la même marche, ses sous-thèmes à tour de rôle', () => {
  const premier = chapitreDuPalier('foret', 1)!
  assert.deepEqual(premier.sousThemes, ['mammiferes', 'oiseaux'])
  const base = nature()
  const p1 = tirerUneEpreuve(base.questions, regleDuPalier(1)!, new Map(), new Map(), MAINTENANT, premier.sousThemes)
  assert.equal(p1.length, 16)
  assert.ok(
    p1.every(x => x.niveau === 'facile'),
    'le mélange du premier palier',
  )
  assert.deepEqual(Object.fromEntries(compter(p1)), { mammiferes: 8, oiseaux: 8 }, 'tout du thème, ses deux sous-thèmes à parts égales')

  // Un thème qui manque de faciles : la catégorie complète, en faciles — jamais une moyenne du thème.
  const maigre = nature(s => (premier.sousThemes.includes(s) ? 5 : 20))
  const p1b = tirerUneEpreuve(maigre.questions, regleDuPalier(1)!, new Map(), new Map(), MAINTENANT, premier.sousThemes)
  assert.ok(p1b.every(x => x.niveau === 'facile'))
  const duTheme = p1b.filter(x => premier.sousThemes.includes(x.question.meta.sousTheme)).length
  assert.equal(duTheme, 10, 'les dix faciles du thème, puis six d’ailleurs')

  // Vues il y a trois semaines, celles du thème passent encore devant les jamais vues d'ailleurs : c'est son thème.
  const faciles = base.questions.filter(q => niveauDeQuestion(q.meta.difficulte) === 'facile')
  const ilYATroisSemaines = new Map(faciles.filter(q => premier.sousThemes.includes(q.meta.sousTheme)).map((q, i) => [q.id, MAINTENANT - 21 * JOUR_MS + i]))
  const p1c = tirerUneEpreuve(base.questions, regleDuPalier(1)!, ilYATroisSemaines, new Map(), MAINTENANT, premier.sousThemes)
  assert.ok(p1c.every(x => premier.sousThemes.includes(x.question.meta.sousTheme)))
  // Vues ce soir, non : une redite de la veille se remarque, le reste de la catégorie les remplace.
  const ceSoir = new Map([...ilYATroisSemaines.keys()].map((id, i) => [id, MAINTENANT - HEURE_MS + i]))
  const p1d = tirerUneEpreuve(base.questions, regleDuPalier(1)!, ceSoir, new Map(), MAINTENANT, premier.sousThemes)
  assert.equal(p1d.filter(x => ceSoir.has(x.question.id)).length, 0, 'aucune question de ce soir tant que la catégorie en a d’autres')

  // Au neuvième, plus de chapitre : chaque sous-thème a sa question, comme avant.
  assert.equal(chapitreDuPalier('foret', 9), null)
  const p9 = tirerUneEpreuve(base.questions, regleDuPalier(9)!, new Map(), new Map(), MAINTENANT, premier.sousThemes)
  assert.equal(compter(p9).size, NATURE.length, 'toute la catégorie, même si on lui passe un thème')
})

test('une épreuve du serveur pose le thème du chapitre de son palier', async () => {
  const banc = await demarrer({ baseDeLaCampagne: nature() })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const id = ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: lea } })).json()) as any).profile.id as string
    // Les deux premiers paliers de la forêt, tenus d'avant : le troisième ouvre le deuxième chapitre.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    db.prepare(`INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, 'foret', 2, 1)`).run(id)
    const epreuve = (await (await ecrire(banc.url, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 3 }, lea)).json()) as any
    const questions = JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(epreuve.id) as { questions: string }).questions) as { sousTheme: string }[]
    db.close()
    const deuxieme = chapitreDuPalier('foret', 3)!
    assert.deepEqual(deuxieme.sousThemes, ['plantes', 'petites-betes'])
    assert.equal(questions.length, 16)
    assert.ok(
      questions.every(q => deuxieme.sousThemes.includes(q.sousTheme)),
      'seize questions de plantes et de petites bêtes',
    )
  } finally {
    await banc.close()
  }
})
