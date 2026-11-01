// Le Quiz, le dixième jeu du Cabinet (le 1er novembre 2026 : « des questions
// classiques sur des thèmes type QCM, avec tous les thèmes disponibles ») : sa
// règle pure — le barème aux justes, Éclairer question par question, ce que la
// manche montre (jamais la bonne réponse) et révèle, sa pièce composée hors de
// la base —, son tireur sur une base d'essai — le sujet promis d'abord, sinon
// la catégorie —, les thèmes que la carte d'une traversée peut lui promettre,
// famille par famille, et une épreuve du Quiz jouée par les routes.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import * as B from '../../shared/cabinet/bareme'
import { REGLE_DU_QUIZ, type EtatDuQuiz, type QuizMontre, type QuizTire } from '../../shared/cabinet/jeux/quiz'
import { rienAEclairer } from '../../shared/cabinet/jeux/outils'
import { JEUX } from '../../shared/cabinet/jeux/regle'
import { ENJEU_ORDINAIRE } from '../../shared/cabinet/partie'
import { deplier, estDuCabinet } from '../../shared/cabinet/pieces'
import { lireUnGeste } from '../../shared/cabinet/lecture'
import {
  CHOISIS_TON_THEME,
  EMOJI_DES_JEUX,
  VERSION_DE_LA_TRAVERSEE,
  emojiDUnSujet,
  emojiDuTheme,
  epreuveEnCours,
  etatDeLaTraversee,
  jouerUnGesteDeLaTraversee,
  lireLeDepartDeLaTraversee,
  lireUnGesteDeLaTraversee,
  refusDuTheme,
  themeDeLEtape,
  tracerLaCarte,
  viseeDeLEtape,
  type DepartDeLaTraversee,
  type EtapeDeLaCarte,
  type ThemeAuChoix,
  type ThemeDuQuiz,
} from '../../shared/cabinet/traversee'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { sujetParCle, sujetsEtRubriqueDe } from '../../shared/sujets'
import type { PageDeLaTraversee, VueDeLaPartie, VueDeLaTraversee } from '../../shared/cabinet/vues'
import type { QuestionDeLaBase } from '../src/core/baseCampagne'
import { tirerLePlan, type ContexteDuTirage } from '../src/core/cabinet/tirages/index'
import { qcmDuSujet, themesDuQuiz } from '../src/core/cabinet/tirages/tas'
import { inscrireProfil } from './banc'
import { DIX_HEURES, aLaMain, bancDuCabinet, baseDuCabinet, fermerLesMagasins, jouerUnQuiz, lire, ok, ouvrir, poster, quizDe, type BancDuCabinet } from './cabinet-banc'
import { tirageDe } from './cabinet-plans'

after(fermerLesMagasins)

const QUIZ = tirageDe('quiz', 0) as QuizTire
const ouvert = (): EtatDuQuiz => REGLE_DU_QUIZ.ouvrir(QUIZ)
const repondre = (choix: (number | null)[]) => ({ quoi: 'repondre' as const, choix })
// Les bonnes réponses du plan d'essai : 1, 0, 2, 3.
const BONNES = QUIZ.questions.map(q => q.bonne)

// ── La règle, en pur ──────────────────────────────────────────────────────

test('le Quiz juge ses quatre questions ensemble : 4 justes ★★★, 3 ★★, 2 ★, et une seule pièce, hors de la base', () => {
  assert.deepEqual(BONNES, [1, 0, 2, 3])
  const juge = (choix: (number | null)[]) => REGLE_DU_QUIZ.juger(QUIZ, ouvert(), repondre(choix))
  assert.equal(juge([1, 0, 2, 3]).naturel, 3)
  assert.equal(juge([1, 0, 2, 0]).naturel, 2)
  assert.equal(juge([1, 0, 0, 0]).naturel, 1)
  assert.equal(juge([0, 1, 0, 0]).naturel, 0)
  assert.deepEqual(B.JUSTES_DU_QUIZ, [4, 3, 2])
  assert.equal(B.QUESTIONS_DU_QUIZ, QUIZ.questions.length)
  // Une pièce juste dès deux étoiles naturelles : trois justes sur quatre.
  assert.deepEqual(juge([1, 0, 2, 0]).pieces, [{ juste: true, choix: 0, composee: '1020' }])
  assert.deepEqual(juge([1, 0, 0, 0]).pieces, [{ juste: false, choix: -1, composee: '1000' }])
  // À l'échéance, celles qu'il n'a pas eu le temps de dire ne sont pas répondues.
  assert.deepEqual(juge([1, null, null, null]), { naturel: 0, pieces: [{ juste: false, choix: -1, composee: '1...' }] })
  // Rien de répondu, expirée ou quittée : zéro, et `choix` NULL.
  for (const r of [repondre([null, null, null, null]), 'expiree' as const, 'quittee' as const]) {
    assert.deepEqual(REGLE_DU_QUIZ.juger(QUIZ, ouvert(), r), { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] })
  }
  // Sa pièce : un composé des quatre, que la fraîcheur déplie — aucune ne revient au Pari ni à l'Éclair de la semaine.
  const v = juge([1, 0, 2, 0])
  const piece = REGLE_DU_QUIZ.piece(QUIZ, ouvert(), v, { manche: 1, tirage: 1 })
  assert.ok(estDuCabinet(piece.id), piece.id)
  assert.deepEqual(deplier(piece.id), QUIZ.questions.map(q => q.id))
  assert.equal(piece.forme, 'quiz')
  assert.deepEqual(piece.cabinet, { jeu: 'quiz', manche: 1, tirage: 1 })
  assert.equal(piece.reponses.length, 1)
  assert.equal(piece.reponses[0], QUIZ.questions.map(q => q.reponses[q.bonne]).join(' · '))
  // Ce qu'il apprend : la première question ratée qui a une anecdote.
  assert.equal(piece.anecdote, QUIZ.questions[3].anecdote)
})

test('la manche montre ses questions sans leur bonne réponse ; la révélation dit tout, et la sienne', () => {
  const m = REGLE_DU_QUIZ.montrer(QUIZ, ouvert())
  assert.equal(m.theme, 'Géographie')
  assert.equal(m.questions.length, 4)
  assert.doesNotMatch(JSON.stringify(m), /bonne|anecdote|savais/, 'invariant 1 : rien qui dise la bonne réponse')
  assert.deepEqual(Object.keys(m.questions[0]).sort(), ['categorie', 'reponses', 'texte'])
  const r = REGLE_DU_QUIZ.reveler(QUIZ, ouvert(), REGLE_DU_QUIZ.juger(QUIZ, ouvert(), repondre([1, 0, 2, 0])))
  assert.equal(r.titre, '3 sur 4')
  assert.equal(r.justes, 3)
  assert.deepEqual(
    r.questions.map(q => [q.bonne, q.choix]),
    [
      [1, 1],
      [0, 0],
      [2, 2],
      [3, 0],
    ],
  )
  assert.equal(r.savais, QUIZ.questions[3].anecdote, 'le savais-tu de la ratée')
  const sansRien = REGLE_DU_QUIZ.reveler(QUIZ, ouvert(), REGLE_DU_QUIZ.juger(QUIZ, ouvert(), 'expiree'))
  assert.equal(sansRien.titre, '0 sur 4')
  assert.ok(sansRien.questions.every(q => q.choix === null))
})

test('Éclairer efface une mauvaise réponse de la question visée, deux au plus, jamais la bonne', () => {
  let e = ouvert()
  assert.equal(REGLE_DU_QUIZ.eclairer(QUIZ, e, () => 0), 'Choisis la question à éclairer')
  assert.equal(REGLE_DU_QUIZ.eclairer(QUIZ, e, () => 0, 9), 'Choisis la question à éclairer')
  for (const hasard of [0, 0.5, 0.99]) {
    const un = REGLE_DU_QUIZ.eclairer(QUIZ, e, () => hasard, 2) as EtatDuQuiz
    assert.equal(un.effacees[2].length, 1)
    assert.notEqual(un.effacees[2][0], QUIZ.questions[2].bonne, 'jamais la bonne')
    assert.deepEqual([un.effacees[0], un.effacees[1], un.effacees[3]], [[], [], []], 'les autres questions intactes')
  }
  e = REGLE_DU_QUIZ.eclairer(QUIZ, e, () => 0, 2) as EtatDuQuiz
  e = REGLE_DU_QUIZ.eclairer(QUIZ, e, () => 0, 2) as EtatDuQuiz
  assert.equal(new Set(e.effacees[2]).size, 2)
  assert.ok(!e.effacees[2].includes(QUIZ.questions[2].bonne))
  assert.equal(REGLE_DU_QUIZ.eclairer(QUIZ, e, () => 0, 2), 'Plus rien à effacer à cette question', 'deux au plus : deux propositions restent')
  // Chaque question à bout : rien à éclairer dans la manche — le pli grise Éclairer.
  for (const i of [0, 1, 3]) for (let k = 0; k < 2; k++) e = REGLE_DU_QUIZ.eclairer(QUIZ, e, () => 0, i) as EtatDuQuiz
  assert.equal(REGLE_DU_QUIZ.eclairer(QUIZ, e, () => 0, 0), rienAEclairer('quiz'))
  // Ce qu'il voit : les effacées de chaque question, à sa place.
  assert.deepEqual(REGLE_DU_QUIZ.montrer(QUIZ, e).effacees, e.effacees)
})

test('ce que la page envoie se relit : une réponse partielle à l’échéance, jamais plus que les questions ni un index hors d’elles', () => {
  const lu = (reponse: unknown) => REGLE_DU_QUIZ.lireLeGeste({ quoi: 'repondre', ...(reponse !== undefined && { reponse }) }, QUIZ)
  assert.deepEqual(lu({ quiz: { choix: [1, null] } }), repondre([1, null, null, null]))
  assert.deepEqual(lu(undefined), repondre([null, null, null, null]), 'rien d’envoyé : rien de répondu')
  assert.equal(lu({ quiz: { choix: [0, 0, 0, 0, 0] } }), null, 'plus de réponses que de questions')
  assert.equal(lu({ quiz: { choix: [4] } }), null, 'un index hors des quatre réponses')
  assert.equal(lu({ eclair: { reponses: [true] } }), null, 'la réponse d’un autre jeu')
  // Par la lecture commune, d'abord : sous la seule clé du jeu, des index ou `null`.
  assert.deepEqual(lireUnGeste({ quoi: 'repondre', manche: 0, reponse: { quiz: { choix: [2, null, 1] } } }), { quoi: 'repondre', manche: 0, reponse: { quiz: { choix: [2, null, 1] } } })
  assert.equal(lireUnGeste({ quoi: 'repondre', manche: 0, reponse: { quiz: { choix: ['2'] } } }), null)
  assert.equal(lireUnGeste({ quoi: 'repondre', manche: 0, reponse: { quiz: { choix: Array(21).fill(0) } } }), null)
})

// ── Le tireur, sur une base d'essai ───────────────────────────────────────

const PORTE = { deLaCategorie: (jouables: readonly QuestionDeLaBase[], c: Categorie) => jouables.filter(q => q.meta.categorie === c) }
const contexte = (jouables: readonly QuestionDeLaBase[], vise?: ContexteDuTirage['vise']): ContexteDuTirage => ({
  porte: PORTE,
  jouables,
  mesures: new Map(),
  vues: new Map(),
  maintenant: DIX_HEURES,
  hasard: Math.random,
  enjeu: ENJEU_ORDINAIRE,
  leurres: new Map(),
  ...(vise && { vise }),
})
const idsDuPlan = (plan: readonly QuizTire[]) => plan.flatMap(t => t.questions.map(q => q.id))

test('le tireur du Quiz : le sujet promis d’abord, sinon la catégorie, sinon une autre ; jamais deux fois une question', () => {
  const base = baseDuCabinet(16)
  const nature = base.questions.find(q => q.meta.categorie === 'Nature')!
  const cle = sujetsEtRubriqueDe(nature.meta)[0]
  const sujet = sujetParCle(cle)!
  assert.ok(sujet, cle)
  const siennes = new Set(qcmDuSujet(PORTE, base.questions, cle).map(q => q.id))
  assert.ok(siennes.size >= 16, `${siennes.size} QCM sous « ${sujet.nom} »`)
  for (let essai = 0; essai < 10; essai++) {
    // Le sujet promis : les trois manches et leurs rechanges y puisent, et le disent.
    const plan = tirerLePlan('quiz', contexte(base.questions, { categorie: null, theme: sujet.nom, sujet: cle }), 1) as QuizTire[]
    assert.equal(plan.length, 4)
    for (const t of plan) {
      assert.equal(t.theme, sujet.nom)
      assert.equal(t.questions.length, B.QUESTIONS_DU_QUIZ)
      for (const q of t.questions) {
        assert.ok(siennes.has(q.id), `${q.id} : hors de « ${sujet.nom} »`)
        assert.ok(['facile', 'moyen'].includes(q.niveau), `${q.id} : ${q.niveau}`)
        assert.equal(q.reponses.length, 4)
      }
    }
    const ids = idsDuPlan(plan)
    assert.equal(new Set(ids).size, ids.length, 'jamais deux fois la même question, rechanges comprises')
    // La catégorie promise : ses questions, et son nom.
    const histoire = tirerLePlan('quiz', contexte(base.questions, { categorie: 'Histoire', theme: 'Histoire' }), 0) as QuizTire[]
    for (const t of histoire) {
      assert.equal(t.theme, 'Histoire')
      assert.ok(t.questions.every(q => q.categorie === 'Histoire'))
    }
    // Rien de promis : trois catégories qui tournent.
    const libre = tirerLePlan('quiz', contexte(base.questions), 0) as QuizTire[]
    assert.equal(new Set(libre.map(t => t.theme)).size, 3)
    for (const t of libre) assert.ok(t.questions.every(q => q.categorie === t.theme))
  }
  // Un sujet trop maigre pour ses quatre questions : il tire ailleurs, et la manche dit où.
  const maigre = tirerLePlan('quiz', contexte(base.questions, { categorie: null, theme: 'Inconnu', sujet: 'pas-un-sujet' }), 0) as QuizTire[]
  assert.equal(maigre.length, 3)
  for (const t of maigre) assert.ok(CATEGORIES.includes(t.theme as Categorie), `${t.theme}`)
})

test('les thèmes du Quiz : les sujets et les rubriques qui ont leurs QCM, avec leur nom, leur famille et leur emoji', () => {
  const fournie = baseDuCabinet(16)
  const themes = themesDuQuiz(PORTE, fournie.questions)
  assert.ok(themes.length > 0)
  for (const t of themes) {
    const s = sujetParCle(t.cle)!
    assert.equal(t.nom, s.nom)
    assert.equal(t.famille, s.famille)
    assert.equal(t.emoji, emojiDUnSujet(s))
    assert.ok(qcmDuSujet(PORTE, fournie.questions, t.cle).length >= B.QCM_D_UN_THEME_DU_QUIZ, t.cle)
  }
  // Huit questions par marche, vingt-quatre par catégorie : aucun thème n'a ses quarante QCM, aucun ne se promet.
  assert.deepEqual(themesDuQuiz(PORTE, baseDuCabinet().questions), [])
  // L'emoji d'une rubrique est celui de sa catégorie, celui d'un sujet celui de sa famille ; une catégorie garde le sien.
  assert.equal(emojiDUnSujet({ famille: 'rubrique', categorie: 'Sport' }), emojiDuTheme('pari', 'Sport'))
  assert.equal(emojiDUnSujet({ famille: 'epoque' }), '🕰️')
  assert.equal(emojiDuTheme('quiz', 'Histoire', '🧩'), emojiDuTheme('pari', 'Histoire'))
  assert.equal(emojiDuTheme('quiz', 'Les animaux', '🧩'), '🧩')
  assert.equal(emojiDuTheme('quiz', 'Un thème sans emoji'), EMOJI_DES_JEUX.quiz)
})

// ── La carte d'une traversée ──────────────────────────────────────────────

/** Un hasard qui se rejoue : la carte d'un essai est toujours la même. */
function graine(n: number): () => number {
  let x = n >>> 0 || 1
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return ((x >>> 0) % 1_000_000) / 1_000_000
  }
}

/** Une étape de la carte sans le thème de son jeu : faite Quiz, ses thèmes au choix font le sien. */
const sansTheme = ({ theme: _t, sujet: _s, emoji: _e, ...e }: EtapeDeLaCarte): EtapeDeLaCarte => e

const THEMES_DU_QUIZ: ThemeDuQuiz[] = [
  { cle: 'animaux', nom: 'Les animaux', famille: 'theme', emoji: '🧩' },
  { cle: 'dinosaures', nom: 'Les dinosaures', famille: 'theme', emoji: '🧩' },
  { cle: 'annees-80', nom: 'Les années 80', famille: 'epoque', emoji: '🕰️' },
  { cle: 'harry-potter', nom: 'Harry Potter', famille: 'univers', emoji: '🌌' },
  { cle: 'sport/football', nom: 'Le football', famille: 'rubrique', emoji: '⚽' },
  { cle: 'cuisine/desserts', nom: 'Les desserts', famille: 'rubrique', emoji: '🍳' },
]

test('la carte propose au Quiz trois thèmes au choix, chacun d’une autre famille, jamais deux fois le même', () => {
  const vus = { categories: 0, sujets: 0, familles: new Set<string>(), etapes: 0, troisFamilles: 0 }
  for (let n = 1; n <= 60; n++) {
    const actes = tracerLaCarte(graine(n), ['lg:renard', 'lg:sphinx', 'lg:dragon'], { epingle: ['Rome'], frise: ['Rome'], quiz: THEMES_DU_QUIZ })
    const quiz = actes.flatMap(a => a.etapes).filter(e => e.jeu === 'quiz')
    const proposes = quiz.flatMap(e => e.choix ?? []).map(c => c.theme)
    assert.equal(new Set(proposes).size, proposes.length, `carte ${n} : un thème du Quiz proposé deux fois`)
    for (const e of quiz) {
      assert.equal(e.choix?.length, B.THEMES_AU_CHOIX_DU_QUIZ, `${e.id} : ses thèmes au choix`)
      assert.deepEqual([e.theme, e.sujet, e.emoji], [undefined, undefined, undefined], `${e.id} : son thème est celui qu'on choisira`)
      const familles = e.choix!.map(c => {
        if (!c.sujet) {
          assert.ok(CATEGORIES.includes(c.theme as Categorie), `${c.theme}`)
          assert.equal(c.emoji, undefined)
          vus.categories++
          return 'categorie'
        }
        const promis = THEMES_DU_QUIZ.find(t => t.cle === c.sujet)!
        assert.deepEqual([c.theme, c.emoji], [promis.nom, promis.emoji])
        vus.sujets++
        vus.familles.add(promis.famille)
        return promis.famille
      })
      vus.etapes++
      if (new Set(familles).size === familles.length) vus.troisFamilles++
    }
    // Le départ se relit avec ses thèmes au choix, et l'épreuve vise celui qu'il choisit — le premier, s'il n'a rien choisi.
    const depart: DepartDeLaTraversee = { v: VERSION_DE_LA_TRAVERSEE, jour: '2026-11-01', actes }
    assert.deepEqual(lireLeDepartDeLaTraversee(JSON.stringify(depart)), depart)
    for (const e of quiz) {
      for (const [k, c] of e.choix!.entries()) {
        const visee = viseeDeLEtape(depart, e, 0, k)!
        assert.deepEqual([visee.theme, visee.sujet], [c.theme, c.sujet ?? null])
        assert.deepEqual(themeDeLEtape(e, k), c)
      }
      assert.deepEqual(viseeDeLEtape(depart, e, 0)?.theme, e.choix![0].theme)
    }
  }
  assert.ok(vus.categories > 0 && vus.sujets > 0, JSON.stringify({ ...vus, familles: [...vus.familles] }))
  // Famille par famille : les rubriques, pourtant plus nombreuses ici que les univers, ne prennent pas tout…
  assert.deepEqual([...vus.familles].sort(), ['epoque', 'rubrique', 'theme', 'univers'])
  // … et une étape propose trois familles tant qu'il en reste : un choix entre trois rubriques n'en serait pas un.
  assert.ok(vus.troisFamilles >= vus.etapes * 0.9, `${vus.troisFamilles} étapes sur ${vus.etapes} à trois familles`)
  // Sans thèmes de la base — une base illisible au départ —, le Quiz ne propose que des catégories.
  const seules = tracerLaCarte(graine(3), ['lg:renard', 'lg:sphinx', 'lg:dragon'], { epingle: ['Rome'], frise: ['Rome'] })
  for (const e of seules.flatMap(a => a.etapes).filter(x => x.jeu === 'quiz')) assert.ok(e.choix!.every(c => CATEGORIES.includes(c.theme as Categorie) && !c.sujet))
  assert.equal(JEUX.quiz.nom, 'Le Quiz')
})

test('le thème d’un Quiz se choisit en y entrant : le pli le garde, le bilan le dit, la page qui n’en dit pas se refuse en mots', () => {
  const actes = tracerLaCarte(graine(5), ['lg:renard', 'lg:sphinx', 'lg:dragon'], { epingle: ['Rome'], frise: ['Rome'], quiz: THEMES_DU_QUIZ })
  const premiere = actes[0].etapes.find(e => e.id === 'a0r1c0')!
  const choix: ThemeAuChoix[] = [{ theme: 'Histoire' }, { theme: 'Les animaux', sujet: 'animaux', emoji: '🧩' }, { theme: 'Sport' }]
  const quiz = { ...sansTheme(premiere), sorte: 'epreuve' as const, jeu: 'quiz' as const, choix }
  const depart: DepartDeLaTraversee = { v: VERSION_DE_LA_TRAVERSEE, jour: '2026-11-01', actes: [{ ...actes[0], etapes: actes[0].etapes.map(e => (e.id === premiere.id ? quiz : e)) }, actes[1], actes[2]] }
  const partie = etatDeLaTraversee(depart, [{ geste: { quoi: 'cartes', cartes: ['cagnotte', 'parade', 'panacee'] }, faitLe: 0 }])
  // La page doit en choisir un, parmi les siens ; une étape sans choix n'en demande pas.
  assert.equal(refusDuTheme(quiz, undefined), CHOISIS_TON_THEME)
  assert.equal(refusDuTheme(quiz, 3), CHOISIS_TON_THEME)
  assert.equal(refusDuTheme(quiz, 1.5), CHOISIS_TON_THEME)
  assert.equal(refusDuTheme(quiz, 2), null)
  assert.equal(refusDuTheme(actes[0].etapes.find(e => e.sorte === 'epreuve' && !e.choix)!, undefined), null)
  // Le serveur écrit le thème choisi avec la partie qu'il commence ; un rang hors des siens se refuse.
  assert.equal(jouerUnGesteDeLaTraversee(depart, partie, { quoi: 'epreuve', etape: quiz.id, partie: 'p1', theme: 3 }, 1), CHOISIS_TON_THEME)
  const dedans = jouerUnGesteDeLaTraversee(depart, partie, { quoi: 'epreuve', etape: quiz.id, partie: 'p1', theme: 1 }, 1)
  assert.ok(typeof dedans !== 'string')
  assert.deepEqual(dedans.ou, { sorte: 'epreuve', etape: quiz.id, partie: 'p1', theme: 1 })
  assert.equal(epreuveEnCours(depart, dedans, 'p1', [], false)?.theme, 'Les animaux', 'la tête de l’épreuve dit le thème choisi')
  const finie = jouerUnGesteDeLaTraversee(depart, dedans, { quoi: 'conclure', partie: 'p1', manches: [3, 3, 3].map(etoiles => ({ etoiles, misee: false })) }, 2)
  assert.ok(typeof finie !== 'string')
  assert.equal(finie.derniere?.theme, 'Les animaux', 'le bilan dit le thème qui s’est joué')
  // Écrit, il se relit — et une page n'envoie qu'un rang.
  assert.deepEqual(lireUnGesteDeLaTraversee(JSON.stringify({ quoi: 'epreuve', etape: quiz.id, partie: 'p1', theme: 1 }), true), { quoi: 'epreuve', etape: quiz.id, partie: 'p1', theme: 1 })
  assert.deepEqual(lireUnGesteDeLaTraversee({ quoi: 'aller', etape: quiz.id, theme: 2 }), { quoi: 'aller', etape: quiz.id, theme: 2 })
  assert.equal(lireUnGesteDeLaTraversee({ quoi: 'aller', etape: quiz.id, theme: 'Les animaux' }), null)
  assert.equal(lireUnGesteDeLaTraversee({ quoi: 'aller', etape: quiz.id, theme: -1 }), null)
  // Sans rang, le premier : une carte écrite à la main, ou une traversée d'avant les thèmes au choix.
  const sansRang = jouerUnGesteDeLaTraversee(depart, partie, { quoi: 'epreuve', etape: quiz.id, partie: 'p1' }, 1)
  assert.ok(typeof sansRang !== 'string')
  assert.equal(epreuveEnCours(depart, sansRang, 'p1', [], false)?.theme, 'Histoire')
  // Des thèmes au choix illisibles rendent le départ illisible.
  assert.equal(lireLeDepartDeLaTraversee({ ...depart, actes: [{ ...depart.actes[0], etapes: depart.actes[0].etapes.map(e => (e.id === quiz.id ? { ...e, choix: [{ sujet: 'animaux' }] } : e)) }, depart.actes[1], depart.actes[2]] }), null)
})

// ── Une épreuve du Quiz, par les routes ───────────────────────────────────

test('une épreuve du Quiz par les routes : le thème choisi dans ses trois manches, la bonne réponse jamais avant la révélation', async () => {
  const b: BancDuCabinet = await bancDuCabinet({ baseDeLaCampagne: baseDuCabinet(16) })
  try {
    const cookie = await inscrireProfil(b.banc.url, 'quizeuse', 'Inès')
    const profil = (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string
    const nature = baseDuCabinet(16).questions.find(q => q.meta.categorie === 'Nature')!
    const cle = sujetsEtRubriqueDe(nature.meta)[0]
    const sujet = sujetParCle(cle)!
    // Une carte ordinaire — une rangée ne pose jamais deux fois le même jeu —, sa première étape faite Quiz, ce sujet au choix
    // parmi trois ; la traversée écrite à la main, ses cartes choisies.
    let x = 7
    const hasard = () => ((x = (x * 16807) % 2147483647) / 2147483647)
    const actes = tracerLaCarte(hasard, ['lg:renard', 'lg:sphinx', 'lg:dragon'], { epingle: ['Rome'], frise: ['Rome'] })
    const premiere = actes[0].etapes.find(e => e.id === 'a0r1c0')!
    const choix: ThemeAuChoix[] = [{ theme: 'Histoire' }, { theme: sujet.nom, sujet: cle, emoji: '🌿' }, { theme: 'Sport' }]
    const promise = { ...sansTheme(premiere), sorte: 'epreuve' as const, jeu: 'quiz' as const, choix }
    const depart: DepartDeLaTraversee = {
      v: VERSION_DE_LA_TRAVERSEE,
      jour: '2026-10-24',
      actes: [{ ...actes[0], etapes: actes[0].etapes.map(e => (e.id === premiere.id ? promise : e)) }, actes[1], actes[2]],
    }
    assert.equal(etatDeLaTraversee(depart, [{ geste: { quoi: 'cartes', cartes: ['cagnotte', 'parade', 'panacee'] }, faitLe: 0 }]).ou.sorte, 'carte')
    const id = `traversee-du-quiz-${profil}`
    const q = (s: string) => `'${s.replace(/'/g, "''")}'`
    aLaMain(
      b.fichier,
      [
        `INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le) VALUES (${q(id)}, ${q(profil)}, ${q(JSON.stringify(depart))}, 1)`,
        `INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (${q(id)}, 1, ${q(JSON.stringify({ quoi: 'cartes', cartes: ['cagnotte', 'parade', 'panacee'] }))}, 2, 'u0')`,
      ].join(';\n'),
    )
    const t = ok(await lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee'), 'la page').traversee!
    assert.equal(t.id, id)
    const etape = t.actes[0].etapes.find(e => e.id === premiere.id)!
    assert.deepEqual([etape.jeu, etape.choix], ['quiz', choix], 'la vue porte ses thèmes au choix')
    // Sans thème, ou un thème qui n'est pas des siens : refusé en mots, rien d'écrit.
    const aller = (g: Record<string, unknown>) => poster<PageDeLaTraversee & { error?: string }>(b, cookie, `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: g })
    for (const sans of [{ quoi: 'aller', etape: premiere.id }, { quoi: 'aller', etape: premiere.id, theme: 3 }]) {
      const refus = await aller(sans)
      assert.equal(refus.status, 400, JSON.stringify(sans))
      assert.equal(refus.corps.error, CHOISIS_TON_THEME)
    }
    const entree = ok(await aller({ quoi: 'aller', etape: premiere.id, theme: 1 }), 'l’entrée').traversee as VueDeLaTraversee
    assert.deepEqual(entree.ou, { sorte: 'epreuve', etape: premiere.id, partie: entree.partie!.id, theme: 1 }, 'la traversée garde le thème choisi')
    let v = entree.partie as VueDeLaPartie
    assert.equal(v.jeu, 'quiz')
    const siennes = new Set(qcmDuSujet(PORTE, baseDuCabinet(16).questions, cle).map(x => x.id))
    for (let k = 0; k < 3; k++) {
      if (k > 0) v = await ouvrir(b, cookie, v, k)
      const montree = v.enCours as QuizMontre | undefined
      assert.equal(montree?.jeu, 'quiz')
      assert.equal(montree?.theme, sujet.nom, `manche ${k} : l'écran dit le sujet promis`)
      // Invariant 1 : la manche part au téléphone sans sa bonne réponse.
      assert.doesNotMatch(JSON.stringify(v), /"bonne"|"anecdote"/, `manche ${k}`)
      const tiree = quizDe(b, v.id, v.tirage ?? k)
      assert.equal(tiree.theme, sujet.nom, `manche ${k} : le sujet promis`)
      assert.ok(tiree.questions.every(x => siennes.has(x.id)), `manche ${k} : des questions du sujet`)
      v = await jouerUnQuiz(b, cookie, v, k)
      assert.equal(v.revelation?.corps.jeu, 'quiz')
      // Sa pièce est un composé hors de la base : rien à signaler, comme l'Éclair.
      assert.deepEqual(v.revelation?.signalables, [])
    }
    // Finie sans faute : la carte la conclut à la lecture suivante, neuf étoiles d'or.
    const apres = ok(await lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee'), 'la page d’après').traversee!
    assert.equal(apres.ou.sorte, 'carte')
    assert.deepEqual(
      apres.derniere?.manches.map(m => m.etoiles),
      [3, 3, 3],
    )
    assert.equal(apres.derniere?.theme, sujet.nom, 'le bilan dit le thème choisi')
    assert.ok(apres.or > 0)
  } finally {
    await b.banc.close()
  }
})
