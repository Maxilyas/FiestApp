// Le tour pondéré des sous-thèmes (le 10 novembre 2026,
// `shared/sousThemes.ts`). Chaque sous-thème prenait un tour entier dans sa
// catégorie, et sept d'entre eux sont des spécialités — l'équitation, la
// plongée, l'anglais, l'espagnol, les métiers de la santé, les danses, le
// ballet : une série de Sport posait l'une des deux siennes une fois sur
// six, une de Culture générale l'une des trois siennes une fois sur quatre.
// Le propriétaire n'a pas voulu les sortir du tour — « une sorte de "pro
// rata" afin de garder quand même certaines questions » : elles passent une
// fois quand les autres passent trois fois.
//
// Ce que ce fichier garde : la liste des spécialités ; la mécanique, au compte
// près, sur une base d'essai ; les parts, sur la base livrée, face au tour
// égal — `aTourDeRole`, la marche seule des épreuves, n'a pas de pas, et
// sert de témoin — ; la série d'une spécialité choisie pour elle-même ; et
// le quiz tout prêt, qui fait le même tour.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lireLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { PreparationDuTirage, aTourDeRole, sujetsDeLaQuestion } from '../src/core/campagne'
import { composerUnQuiz, idDeLaBase, type DejaDansLEspace } from '../src/core/quizToutPret'
import { QUESTIONS_PAR_SERIE } from '../../shared/campagne'
import type { ChoixDuQuiz } from '../../shared/quizToutPret'
import { SOUS_THEMES, TOURS_D_UNE_SPECIALITE, entreeDansLeTour, pasDuSousTheme } from '../../shared/sousThemes'

// ── Le hasard, à la main ────────────────────────────────────────────────────

/** Un hasard qui recommence de sa graine. */
function hasardDe(graine: number): () => number {
  let g = graine
  return () => ((g = (g * 16807) % 2147483647) - 1) / 2147483646
}

/** `f` sous ce hasard, et combien de nombres elle y a tirés. */
function auHasard<T>(graine: number, f: () => T): { rendu: T; tires: number } {
  const avant = Math.random
  const hasard = hasardDe(graine)
  let tires = 0
  Math.random = () => {
    tires++
    return hasard()
  }
  try {
    return { rendu: f(), tires }
  } finally {
    Math.random = avant
  }
}

function melanger<T>(liste: readonly T[]): T[] {
  const copie = [...liste]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

// ── Ce qu'on compte ─────────────────────────────────────────────────────────

const estUneSpecialite = (q: QuestionDeLaBase) => pasDuSousTheme(q.meta.categorie, q.meta.sousTheme) > 1
const cleDe = (q: QuestionDeLaBase) => `${q.meta.categorie}/${q.meta.sousTheme}`

/** Combien de questions de chaque sous-thème, dans ces séries. */
function compter(series: readonly (readonly QuestionDeLaBase[])[]): Map<string, number> {
  const comptes = new Map<string, number>()
  for (const serie of series) for (const q of serie) comptes.set(cleDe(q), (comptes.get(cleDe(q)) ?? 0) + 1)
  return comptes
}

/** La part des spécialités parmi les questions de cette catégorie — de toutes, sans elle. */
function partDesSpecialites(series: readonly (readonly QuestionDeLaBase[])[], categorie?: string): number {
  const questions = series.flat().filter(q => !categorie || q.meta.categorie === categorie)
  return questions.filter(estUneSpecialite).length / questions.length
}

/** Des séries tirées pour un joueur qui n'a rien vu, une par graine. */
function tirer(jouables: readonly QuestionDeLaBase[], combien: number): QuestionDeLaBase[][] {
  const preparee = new PreparationDuTirage(jouables, new Map())
  return Array.from({ length: combien }, (_, i) => auHasard(1 + i, () => preparee.tirer()).rendu.map(x => x.question))
}

/** Les mêmes listes à tour égal : le témoin d'avant le pas. */
function tirerATourEgal(jouables: readonly QuestionDeLaBase[], combien: number): QuestionDeLaBase[][] {
  return Array.from({ length: combien }, (_, i) => auHasard(1 + i, () => aTourDeRole(melanger(jouables), new Map(), 0, QUESTIONS_PAR_SERIE)).rendu)
}

/** La base du dépôt, lue une fois pour tout le fichier. */
let baseLue: readonly QuestionDeLaBase[] | null = null
const laBase = () => (baseLue ??= lireLaBase().questions)

/** Une base d'essai : `parSousTheme` questions de chaque sous-thème, toutes les difficultés, sans deux jumelles. */
function baseDEssai(sousThemes: readonly (readonly [string, string])[], parSousTheme = 200): QuestionDeLaBase[] {
  return sousThemes.flatMap(([categorie, sousTheme]) =>
    Array.from({ length: parSousTheme }, (_, i) => {
      const nom = `${sousTheme}${i}`
      return {
        id: `${categorie}-${nom}`,
        texte: `Alpha${nom} beta${nom} gamma${nom} delta ?`,
        reponses: ['a', 'b', 'c', 'd'].map(r => `${r}-${categorie}-${nom}`),
        bonne: 0,
        meta: { categorie, sousTheme, difficulte: 1 + (i % 5) },
      } as unknown as QuestionDeLaBase
    }),
  )
}

// ── La liste ────────────────────────────────────────────────────────────────

test('sept spécialités, chacune dans sa catégorie : leur pas est de trois, celui de tous les autres d’un', () => {
  const specialites = Object.entries(SOUS_THEMES).flatMap(([categorie, liste]) => liste.filter(s => s.specialite).map(s => `${categorie}/${s.cle}`))
  assert.deepEqual(specialites.sort(), [
    'Arts & lettres/ballet',
    'Culture générale/anglais',
    'Culture générale/espagnol',
    'Culture générale/sante',
    'Musique/danses',
    'Sport/equitation',
    'Sport/plongee',
  ])
  assert.equal(TOURS_D_UNE_SPECIALITE, 3, 'les parts que ce fichier attend sont celles d’un tour sur trois')
  for (const [categorie, liste] of Object.entries(SOUS_THEMES)) {
    for (const s of liste) assert.equal(pasDuSousTheme(categorie, s.cle), s.specialite ? TOURS_D_UNE_SPECIALITE : 1, `${categorie}/${s.cle}`)
  }
  // La langue française et les bals, écartés de la liste par le propriétaire : tout le monde y a sa chance.
  assert.equal(pasDuSousTheme('Culture générale', 'francais'), 1)
  assert.equal(pasDuSousTheme('Autour de la fête', 'bal'), 1)
  // Une clé ne vaut que dans sa catégorie, et un sous-thème d'une base d'essai avance d'un.
  assert.equal(pasDuSousTheme('Musique', 'ballet'), 1)
  assert.equal(pasDuSousTheme('Sport', 'st0'), 1)
  assert.equal(pasDuSousTheme('Une catégorie inconnue', 'equitation'), 1)
})

test('une spécialité entre dans le tour à un rang tiré, de zéro à son pas ; les autres à zéro, sans rien tirer', () => {
  const jamais = () => assert.fail('un sous-thème ordinaire ne tire rien')
  assert.equal(entreeDansLeTour(1, jamais), 0)
  const hasard = hasardDe(7)
  const entrees = Array.from({ length: 3000 }, () => entreeDansLeTour(TOURS_D_UNE_SPECIALITE, hasard))
  assert.deepEqual([...new Set(entrees)].sort(), [0, 1, 2])
  for (const tour of [0, 1, 2]) {
    const part = entrees.filter(e => e === tour).length / entrees.length
    assert.ok(part > 0.3 && part < 0.37, `le tour ${tour}, une fois sur trois : ${part}`)
  }
})

// ── La mécanique, au compte près ────────────────────────────────────────────

test('dans sa catégorie, une spécialité passe une fois quand les autres passent trois fois', () => {
  const sport = baseDEssai([
    ['Sport', 'football'],
    ['Sport', 'rugby'],
    ['Sport', 'tennis'],
    ['Sport', 'equitation'],
  ])
  // Trois tours des trois autres, un de l'équitation : dix questions, six fois dans une série — quel que soit son tour d'entrée.
  for (const serie of tirer(sport, 30)) {
    assert.deepEqual(Object.fromEntries(compter([serie])), { 'Sport/football': 18, 'Sport/rugby': 18, 'Sport/tennis': 18, 'Sport/equitation': 6 })
  }
  // À tour égal, le témoin : quinze chacun.
  for (const serie of tirerATourEgal(sport, 5)) assert.deepEqual([...compter([serie]).values()], [15, 15, 15, 15])
})

test('les catégories tournent comme avant : le pas ne joue qu’entre les sous-thèmes de la même', () => {
  const base = baseDEssai([
    ['Sport', 'football'],
    ['Sport', 'equitation'],
    ['Histoire', 'guerres'],
  ])
  const entrees = new Set<number>()
  for (const serie of tirer(base, 30)) {
    const comptes = compter([serie])
    assert.equal(comptes.get('Histoire/guerres'), 30, 'la moitié de la série à chaque catégorie')
    // Vingt-deux tours du football, et l'équitation un tour sur trois : sept ou huit, selon son entrée.
    const equitation = comptes.get('Sport/equitation')!
    assert.ok(equitation === 7 || equitation === 8, `${equitation} questions d’équitation`)
    assert.equal(comptes.get('Sport/football'), 30 - equitation)
    entrees.add(equitation)
  }
  assert.equal(entrees.size, 2, 'les deux, d’une série à l’autre : son tour d’entrée se tire')
})

test('une liste sans spécialité ne tire pas un nombre de plus que son battage ; chaque spécialité en tire un', () => {
  // Au même hasard, une série d'histoire reste donc celle d'avant le pas (`tirage-prepare.test.ts` la compare).
  const sans = baseDEssai([
    ['Histoire', 'guerres'],
    ['Histoire', 'pouvoirs'],
    ['Sport', 'football'],
  ])
  assert.equal(auHasard(3, () => new PreparationDuTirage(sans, new Map()).tirer()).tires, sans.length - 1)
  const avec = baseDEssai([
    ['Sport', 'football'],
    ['Sport', 'equitation'],
    ['Sport', 'plongee'],
    ['Musique', 'danses'],
  ])
  assert.equal(auHasard(3, () => new PreparationDuTirage(avec, new Map()).tirer()).tires, avec.length - 1 + 3)
})

// ── Sur la base livrée ──────────────────────────────────────────────────────

test('une série d’une catégorie : ses spécialités y pèsent moins de la moitié de leur tour égal, et n’en sortent jamais', () => {
  const base = laBase()
  for (const [categorie, min, max] of [
    // À tour égal : 17 % en Sport, 25 % en Culture générale, 13 et 12 % en Musique et en Arts & lettres.
    ['Sport', 0.055, 0.085],
    ['Culture générale', 0.085, 0.115],
    ['Musique', 0.035, 0.065],
    ['Arts & lettres', 0.035, 0.065],
  ] as const) {
    const jouables = base.filter(q => q.meta.categorie === categorie)
    const series = tirer(jouables, 60)
    const part = partDesSpecialites(series)
    const egale = partDesSpecialites(tirerATourEgal(jouables, 60))
    assert.ok(part >= min && part <= max, `${categorie} : ${(100 * part).toFixed(1)} % de spécialités (${(100 * egale).toFixed(1)} % à tour égal)`)
    assert.ok(part < egale / 2 && part > egale / 4, `${categorie} : ${(100 * part).toFixed(1)} % contre ${(100 * egale).toFixed(1)} % à tour égal`)
    // « Garder quand même certaines questions » : chaque spécialité de la catégorie, dans chaque série.
    const siennes = SOUS_THEMES[categorie].filter(s => s.specialite).map(s => `${categorie}/${s.cle}`)
    for (const serie of series) {
      const comptes = compter([serie])
      for (const cle of siennes) assert.ok((comptes.get(cle) ?? 0) >= 1, `une série de ${categorie} sans ${cle}`)
    }
  }
})

test('une série de toutes les catégories : près de trois fois moins de spécialités, et toutes y viennent encore', () => {
  const base = laBase()
  const series = tirer(base, 300)
  const egales = tirerATourEgal(base, 300)
  const parSerie = (s: readonly (readonly QuestionDeLaBase[])[]) => s.flat().filter(estUneSpecialite).length / s.length
  // Cinq questions par catégorie : aucun sous-thème n'y repasse, et seul le tour d'entrée tiré y fait peser le pas.
  assert.ok(parSerie(series) < parSerie(egales) / 2, `${parSerie(series).toFixed(2)} par série, ${parSerie(egales).toFixed(2)} à tour égal`)
  assert.ok(parSerie(series) > parSerie(egales) / 5, `${parSerie(series).toFixed(2)} par série, ${parSerie(egales).toFixed(2)} à tour égal`)
  // Catégorie par catégorie, sur quelques dizaines de questions : une marge plus large que pour l'ensemble.
  for (const categorie of ['Sport', 'Culture générale', 'Musique', 'Arts & lettres']) {
    const part = partDesSpecialites(series, categorie)
    const egale = partDesSpecialites(egales, categorie)
    assert.ok(part < 0.6 * egale, `${categorie} : ${(100 * part).toFixed(1)} % contre ${(100 * egale).toFixed(1)} % à tour égal`)
  }
  const comptes = compter(series)
  for (const [categorie, liste] of Object.entries(SOUS_THEMES)) {
    for (const s of liste) if (s.specialite) assert.ok((comptes.get(`${categorie}/${s.cle}`) ?? 0) >= 5, `${categorie}/${s.cle} : ${comptes.get(`${categorie}/${s.cle}`) ?? 0} fois en 300 séries`)
  }
  // Et les catégories gardent leurs cinq questions par série : le pas ne leur prend rien.
  for (const serie of series.slice(0, 20)) {
    const parCategorie = new Map<string, number>()
    for (const q of serie) parCategorie.set(q.meta.categorie, (parCategorie.get(q.meta.categorie) ?? 0) + 1)
    assert.deepEqual([...new Set(parCategorie.values())], [5])
  }
})

test('choisie pour elle-même, une spécialité garde la série : son thème, sa rubrique', () => {
  const base = laBase()
  // L'équitation et la plongée tiennent leur rubrique : leur thème, c'est leur sous-thème.
  for (const sujet of ['equitation', 'plongee']) {
    const siennes = base.filter(q => sujetsDeLaQuestion(q).includes(sujet))
    for (const serie of tirer(siennes, 5)) {
      assert.equal(serie.length, QUESTIONS_PAR_SERIE)
      assert.ok(serie.every(q => q.meta.sousTheme === sujet), `une série sur « ${sujet} » toute de son sous-thème`)
    }
  }
  // La danse et la santé joignent plusieurs catégories, et leur étiquette amène dans la catégorie d'une spécialité
  // quelques questions d'autres sous-thèmes — une musique de ballet, un jazz qui se danse. Elle les laisse passer,
  // et ils s'épuisent vite : elle reste l'essentiel de sa catégorie (60, 90 et 85 % le 10 novembre 2026 ; 65, 94 et
  // 87 % à tour égal — une question de moins par série, et toutes sont du thème).
  for (const [sujet, categorie, sousTheme, auMoins] of [
    ['danse', 'Musique', 'danses', 0.5],
    ['danse', 'Arts & lettres', 'ballet', 0.8],
    ['sante', 'Culture générale', 'sante', 0.75],
  ] as const) {
    const siennes = base.filter(q => sujetsDeLaQuestion(q).includes(sujet))
    const deLaCategorie = tirer(siennes, 60)
      .flat()
      .filter(q => q.meta.categorie === categorie)
    const part = deLaCategorie.filter(q => q.meta.sousTheme === sousTheme).length / deLaCategorie.length
    assert.ok(part >= auMoins, `« ${sujet} » : ${(100 * part).toFixed(1)} % de ${sousTheme} parmi ses questions de ${categorie}`)
  }
})

// ── Le quiz tout prêt ───────────────────────────────────────────────────────

const RIEN_DEJA: DejaDansLEspace = { ids: new Set(), empreintes: new Set(), posees: new Map() }

function composer(choix: Partial<ChoixDuQuiz>, combien: number): QuestionDeLaBase[][] {
  const base = laBase()
  const parId = new Map(base.map(q => [q.id, q]))
  const complet: ChoixDuQuiz = { categories: [], sujet: null, difficulte: 'progressive', nombre: 50, enfants: false, estimations: false, ...choix }
  return Array.from({ length: combien }, (_, i) =>
    composerUnQuiz(base, sujetsDeLaQuestion, new Map(), complet, RIEN_DEJA, hasardDe(1 + i)).map(q => parId.get(idDeLaBase(q.id)!)!),
  )
}

test('le quiz tout prêt fait le même tour : un quiz de sport pose ses spécialités une fois sur quatorze, un quiz d’équitation n’en change pas', () => {
  const deSport = composer({ categories: ['Sport'] }, 30)
  assert.ok(deSport.every(quiz => quiz.length === 50))
  const part = partDesSpecialites(deSport)
  // À tour égal, deux sous-thèmes sur onze : 17 % (mesuré avant le pas, le 10 novembre 2026).
  assert.ok(part > 0.045 && part < 0.095, `${(100 * part).toFixed(1)} % de spécialités dans un quiz de sport`)
  const comptes = compter(deSport)
  for (const cle of ['Sport/equitation', 'Sport/plongee']) assert.ok((comptes.get(cle) ?? 0) >= 15, `${cle} : ${comptes.get(cle) ?? 0} fois en 30 quiz`)
  for (const quiz of composer({ sujet: 'equitation', nombre: 20 }, 3)) {
    assert.equal(quiz.length, 20)
    assert.ok(quiz.every(q => q.meta.sousTheme === 'equitation'))
  }
})
