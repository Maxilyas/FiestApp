// Le modèle du savoir (le choix du propriétaire du 13 octobre 2026, après
// « est-ce que l'automate pourrait apprendre du niveau des personnes et
// s'adapter en continu ? ») : une force par joueur, un écart par catégorie,
// une difficulté par question, ajustés ensemble sur les premières réponses de
// campagne. Automate le lit au dé : il joue comme qui le lance, et rate où il
// rate. Des joueurs simulés, au hasard qui se rejoue, disent s'il retrouve
// ce qu'on leur a donné — et ce que la part de ceux qui ont trouvé
// (`tauxLisse`) ne voit pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { NIVEAUX, VIES, niveauDeQuestion, type Niveau } from '../../shared/campagne'
import { SCORE_DE_REFERENCE } from '../../shared/duels'
import { CampagneStore, ECART_D_AUTOMATE, partieDAutomate, type AutomateDuDe } from '../src/core/campagne'
import {
  AUCUN_ECART,
  ajusterLeModele,
  ajusterSansBloquer,
  chance,
  chancesSurLaSerie,
  difficulteAPriori,
  difficulteSansModele,
  forceDuJoueur,
  forcePourLeNiveau,
  indiceDeCategorie,
  scoreAttendu,
  scoreDeReference,
  serieDeReference,
  type ForceDUnJoueur,
} from '../src/core/modeleDuSavoir'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

// ── Des joueurs simulés ──────────────────────────────────────────────────

/** Un hasard qui se rejoue : le même tirage à chaque passage. */
function hasardFixe(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const normale = (h: () => number) => Math.sqrt(-2 * Math.log(1 - h())) * Math.cos(2 * Math.PI * h())

interface QuestionSimulee {
  id: string
  meta: { categorie: string; difficulte: number }
  /** Sa vraie difficulté : son estimation d'écriture s'en écarte. */
  vraie: number
}

/**
 * Une base : `n` questions par catégorie et par difficulté estimée, de vraies
 * difficultés autour de l'estimation — décalées en bloc, difficulté par
 * difficulté, de `decalees` (de la 1 à la 5).
 */
function baseSimulee(h: () => number, n = 8, decalees: readonly number[] = [0, 0, 0, 0, 0]): QuestionSimulee[] {
  return CATEGORIES.flatMap(categorie =>
    [1, 2, 3, 4, 5].flatMap(difficulte =>
      Array.from({ length: n }, (_, i) => ({
        id: `${indiceDeCategorie(categorie)}-${difficulte}-${i}`,
        meta: { categorie, difficulte },
        vraie: difficulteAPriori(difficulte).moyenne + decalees[difficulte - 1] + 0.6 * normale(h),
      })),
    ),
  )
}

interface JoueurSimule {
  id: string
  force: number
  ecarts: number[]
}

function joueursSimules(h: () => number, nombre: number): JoueurSimule[] {
  return Array.from({ length: nombre }, (_, i) => ({ id: `joueur-${i}`, force: 0.5 + normale(h), ecarts: CATEGORIES.map(() => 0.5 * normale(h)) }))
}

/** Sa vraie chance de trouver cette question. */
const vraieChance = (j: JoueurSimule, q: QuestionSimulee) => chance(j.force + j.ecarts[indiceDeCategorie(q.meta.categorie)] - q.vraie)

/** La marche d'une question sans mesure : celle du tirage (`niveauDeQuestion`). */
const marcheDe = (q: QuestionSimulee) => niveauDeQuestion(q.meta.difficulte)

/**
 * Ses séries, comme la campagne les tire : cinq de chaque marche, de la
 * facile à l'experte, puis des expertes, les jamais vues d'abord, jusqu'à la
 * troisième faute. Rend ses premières réponses, et toutes, question par
 * question.
 */
function jouerDesSeries(h: () => number, j: JoueurSimule, base: readonly QuestionSimulee[], series: number) {
  const parMarche = new Map<Niveau, QuestionSimulee[]>(NIVEAUX.map(n => [n, base.filter(q => marcheDe(q) === n)]))
  const premieres = new Map<string, boolean>()
  const toutes: { q: QuestionSimulee; juste: boolean }[] = []
  for (let s = 0; s < series; s++) {
    const fraiches = (n: Niveau) => {
      const pile = parMarche.get(n)!.map(q => ({ q, rang: (premieres.has(q.id) ? 1 : 0) + h() }))
      return pile.sort((a, b) => a.rang - b.rang).map(x => x.q)
    }
    const serie = [...NIVEAUX.flatMap(n => fraiches(n).slice(0, 5)), ...fraiches('expert').slice(5, 45)]
    let fautes = 0
    for (const q of serie) {
      const juste = h() < vraieChance(j, q)
      if (!premieres.has(q.id)) premieres.set(q.id, juste)
      toutes.push({ q, juste })
      if (!juste && ++fautes >= VIES) break
    }
  }
  return { premieres, toutes }
}

const correlation = (a: readonly number[], b: readonly number[]) => {
  const n = a.length
  const ma = a.reduce((s, x) => s + x, 0) / n
  const mb = b.reduce((s, x) => s + x, 0) / n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return num / Math.sqrt(da * db)
}
const moyenne = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

/** Une salle simulée, jouée, et son modèle ajusté. */
function salleSimulee(graine: number, joueurs = 60, series = 20) {
  const h = hasardFixe(graine)
  const base = baseSimulee(h)
  const salle = joueursSimules(h, joueurs)
  const premieres = new Map<string, Map<string, boolean>>()
  const mesure = new Map<string, { justes: number; total: number }>()
  for (const j of salle) {
    const joue = jouerDesSeries(h, j, base, series)
    premieres.set(j.id, joue.premieres)
    for (const { q, juste } of joue.toutes) {
      const m = mesure.get(q.id) ?? { justes: 0, total: 0 }
      m.total++
      if (juste) m.justes++
      mesure.set(q.id, m)
    }
  }
  const sansModele = serieDeReference(base, marcheDe, q => difficulteSansModele(q.meta.difficulte))
  const modele = ajusterLeModele({ questions: new Map(base.map(q => [q.id, q.meta])), joueurs: premieres, forceDeDepart: sansModele.forceDeDepart })
  return { h, base, salle, premieres, mesure, modele }
}

// ── Le modèle ────────────────────────────────────────────────────────────

test('ajusté sur leurs réponses, il retrouve la force des joueurs et leurs catégories', () => {
  const { salle, modele } = salleSimulee(1)
  const forces = salle.map(j => modele.forces.get(j.id)!)
  assert.ok(correlation(salle.map(j => j.force), forces.map(f => f.force)) > 0.9, 'leur force')
  // Leurs écarts de catégorie, rapprochés de zéro tant qu'ils y ont peu répondu : moins nets, mais dans le bon sens.
  const vrais = salle.flatMap(j => j.ecarts)
  const estimes = forces.flatMap(f => f.ecarts)
  assert.ok(correlation(vrais, estimes) > 0.4, `leurs écarts : ${correlation(vrais, estimes).toFixed(2)}`)
  assert.ok(modele.passes < 60, 'il converge')
})

// Une série s'arrête à la troisième faute : seuls les forts atteignent les
// expertes, et la part de ceux qui les trouvent les dit plus faciles qu'elles
// ne sont. La force de qui a répondu corrige la difficulté.
test('les expertes, que seuls les forts atteignent : la part de ceux qui les trouvent les croit faciles, le modèle non', () => {
  const { base, mesure, modele } = salleSimulee(2)
  const expertes = base.filter(q => q.meta.difficulte === 5 && (mesure.get(q.id)?.total ?? 0) >= 5)
  assert.ok(expertes.length >= 30, `${expertes.length} expertes assez jouées`)
  const biais = (estimee: (q: QuestionSimulee) => number) => moyenne(expertes.map(q => estimee(q) - q.vraie))
  const sansModele = biais(q => difficulteSansModele(q.meta.difficulte, mesure.get(q.id)))
  const avecModele = biais(q => modele.difficultes.get(q.id)!)
  assert.ok(sansModele < -0.3, `la part de ceux qui trouvent : ${sansModele.toFixed(2)} en logit, plus facile qu'elles ne sont`)
  assert.ok(Math.abs(avecModele) < 0.25, `le modèle : ${avecModele.toFixed(2)}`)
  // Et il range mieux les questions que leur estimation d'écriture.
  const jouees = base.filter(q => (mesure.get(q.id)?.total ?? 0) >= 5)
  const vraies = jouees.map(q => q.vraie)
  assert.ok(
    correlation(vraies, jouees.map(q => modele.difficultes.get(q.id)!)) > correlation(vraies, jouees.map(q => difficulteAPriori(q.meta.difficulte).moyenne)) + 0.03,
    'mieux que l’estimation d’écriture',
  )
})

// Sur les premières réponses de la production du 8 au 15 octobre 2026, le
// modèle gardait aux 5 leur a priori — un joueur sur dix — quand les habitués
// en trouvaient quatre, et une 5 que personne n'avait jouée restait
// introuvable. Il apprend ce que vaut chaque difficulté estimée, en bloc.
test('chaque difficulté estimée, en bloc : le modèle apprend ce qu’elle vaut, et une question jamais jouée en profite', () => {
  const h = hasardFixe(7)
  // Des 2 plus dures qu'écrites, des 5 bien plus faciles.
  const DECALEES = [0, 0.4, 0, 0, -1.2]
  const base = baseSimulee(h, 8, DECALEES)
  // Des questions écrites depuis, que personne n'a encore jouées.
  const neuves = baseSimulee(h, 3, DECALEES).map(q => ({ ...q, id: `neuve-${q.id}` }))
  const salle = joueursSimules(h, 60)
  const premieres = new Map(salle.map(j => [j.id, jouerDesSeries(h, j, base, 20).premieres]))
  const sansModele = serieDeReference(base, marcheDe, q => difficulteSansModele(q.meta.difficulte))
  const modele = ajusterLeModele({ questions: new Map([...base, ...neuves].map(q => [q.id, q.meta])), joueurs: premieres, forceDeDepart: sansModele.forceDeDepart })
  assert.equal(modele.decalages[2], 0, 'la 3 tient l’échelle')
  assert.ok(modele.decalages[4] < -0.6, `les 5 : ${modele.decalages[4].toFixed(2)}`)
  assert.ok(modele.decalages[1] > 0.15, `les 2 : ${modele.decalages[1].toFixed(2)}`)
  assert.ok(modele.passes < 60, `il converge : ${modele.passes} passes`)
  // Une 5 jamais jouée part de ce que ses semblables ont montré, plus de l'a priori seul.
  const cinq = neuves.filter(q => q.meta.difficulte === 5)
  const ecart = (d: (q: QuestionSimulee) => number) => moyenne(cinq.map(q => Math.abs(d(q) - q.vraie)))
  const avecModele = ecart(q => modele.difficultes.get(q.id)!)
  const aPriori = ecart(() => difficulteAPriori(5).moyenne)
  assert.ok(avecModele < aPriori - 0.4, `jamais jouées : ${avecModele.toFixed(2)} du vrai, contre ${aPriori.toFixed(2)} à l’a priori`)
  // Reparti de lui, l'ajustement suivant garde ce qu'il a appris.
  const suivant = ajusterLeModele({ questions: new Map([...base, ...neuves].map(q => [q.id, q.meta])), joueurs: premieres, forceDeDepart: sansModele.forceDeDepart, depart: modele })
  assert.ok(Math.abs(suivant.decalages[4] - modele.decalages[4]) < 0.01)
  assert.ok(suivant.passes < modele.passes)
})

test('au dé, sa force relue de ses réponses est celle de l’ajustement — sa dernière série comprise', () => {
  const { salle, premieres, modele, base } = salleSimulee(3, 30, 10)
  const parId = new Map(base.map(q => [q.id, q]))
  const question = (id: string) => {
    const q = parId.get(id)
    return q && { categorie: q.meta.categorie, difficulte: modele.difficultes.get(id)! }
  }
  const depart = serieDeReference(base, marcheDe, q => difficulteSansModele(q.meta.difficulte)).forceDeDepart
  for (const j of salle) {
    const relue = forceDuJoueur(premieres.get(j.id)!, question, depart)
    assert.ok(Math.abs(relue.force - modele.forces.get(j.id)!.force) < 0.01, j.id)
  }
  // Une série de plus, que le modèle n'a pas vue : sa force la compte déjà.
  const j = salle[0]
  const avant = forceDuJoueur(premieres.get(j.id)!, question, depart)
  const plus = new Map(premieres.get(j.id)!)
  for (const q of base.filter(q => !plus.has(q.id)).slice(0, 30)) plus.set(q.id, true)
  assert.ok(forceDuJoueur(plus, question, depart).force > avant.force + 0.1, 'trente bonnes réponses de plus le disent plus fort')
})

test('sans réponse, le joueur de la cote de départ ; tout trouvé, une force finie ; peu de réponses le laissent près du départ', () => {
  const base = baseSimulee(hasardFixe(4))
  const reference = serieDeReference(base, marcheDe, q => difficulteSansModele(q.meta.difficulte))
  const question = (id: string) => {
    const q = base.find(x => x.id === id)
    return q && { categorie: q.meta.categorie, difficulte: difficulteSansModele(q.meta.difficulte) }
  }
  const rien = forceDuJoueur(new Map(), question, reference.forceDeDepart)
  assert.deepEqual([rien.force, rien.reponses], [reference.forceDeDepart, 0])
  assert.ok(Math.abs(scoreDeReference(rien.force, rien.ecarts, reference) - SCORE_DE_REFERENCE) < 1e-6, 'le score de la cote de départ')
  // Tout trouvé : fort, mais pas infiniment.
  const tout = forceDuJoueur(new Map(base.map(q => [q.id, true])), question, reference.forceDeDepart)
  assert.ok(Number.isFinite(tout.force) && tout.force > reference.forceDeDepart + 2)
  // Trois bonnes réponses : un peu plus fort, sans plus.
  const trois = forceDuJoueur(new Map(base.slice(0, 3).map(q => [q.id, true])), question, reference.forceDeDepart)
  assert.ok(trois.force > reference.forceDeDepart && trois.force < reference.forceDeDepart + 0.7, `${trois.force}`)
  // Une question que la base n'a plus ne compte pas.
  assert.equal(forceDuJoueur(new Map([['partie', true]]), question, reference.forceDeDepart).reponses, 0)
})

test('ses écarts de catégorie : fort en sport, fâché avec le cinéma — et trois questions ratées ne font pas un écart', () => {
  const base = baseSimulee(hasardFixe(5))
  const question = (id: string) => {
    const q = base.find(x => x.id === id)
    return q && { categorie: q.meta.categorie, difficulte: difficulteAPriori(q.meta.difficulte).moyenne }
  }
  const premieres = new Map<string, boolean>()
  const de = (categorie: string) => base.filter(q => q.meta.categorie === categorie && q.meta.difficulte === 3)
  for (const q of de('Sport')) premieres.set(q.id, true)
  for (const q of de('Cinéma & séries')) premieres.set(q.id, false)
  for (const q of de('Cuisine').slice(0, 3)) premieres.set(q.id, false)
  // Le reste, une sur deux, partout ailleurs — sauf en musique, où il n'a rien répondu.
  base
    .filter(q => q.meta.difficulte === 3 && !['Sport', 'Cinéma & séries', 'Cuisine', 'Musique'].includes(q.meta.categorie))
    .forEach((q, i) => premieres.set(q.id, i % 2 === 0))
  const lui = forceDuJoueur(premieres, question, 0)
  const ecart = (c: string) => lui.ecarts[indiceDeCategorie(c)]
  assert.ok(ecart('Sport') > 0.3, `sport : ${ecart('Sport')}`)
  assert.ok(ecart('Cinéma & séries') < -0.3, `cinéma : ${ecart('Cinéma & séries')}`)
  assert.ok(Math.abs(ecart('Cuisine')) < Math.abs(ecart('Cinéma & séries')) / 2, `cuisine : ${ecart('Cuisine')}`)
  assert.equal(ecart('Musique'), 0, 'rien répondu en musique : aucun écart')
})

// Le placement : son niveau, ce que ses réponses disent de lui. Il était la
// médiane de ses dix dernières séries — une série ratée d'entrée ne le faisait
// pas passer pour un débutant, un coup de chance pour un expert ; le modèle le
// garde.
test('son niveau suit ses réponses : une série ratée d’entrée ne fait pas un débutant, un coup de chance pas un expert', () => {
  const h = hasardFixe(6)
  const base = baseSimulee(h)
  const reference = serieDeReference(base, marcheDe, q => q.vraie)
  const question = (id: string) => {
    const q = base.find(x => x.id === id)
    return q && { categorie: q.meta.categorie, difficulte: q.vraie }
  }
  const niveauDe = (premieres: ReadonlyMap<string, boolean>) => {
    const f = forceDuJoueur(premieres, question, reference.forceDeDepart)
    return scoreDeReference(f.force, f.ecarts, reference)
  }
  // Un habitué, de niveau douze, et vingt séries.
  const habitue: JoueurSimule = { id: 'habitue', force: forcePourLeNiveau(12, AUCUN_ECART, reference), ecarts: CATEGORIES.map(() => 0) }
  const sesReponses = jouerDesSeries(h, habitue, base, 20).premieres
  const niveau = niveauDe(sesReponses)
  assert.ok(Math.abs(niveau - 12) < 1.5, `l’habitué : ${niveau.toFixed(1)}`)
  // Une série ratée d'entrée : trois faciles qu'il n'avait jamais vues.
  const ratee = new Map(sesReponses)
  for (const q of base.filter(q => marcheDe(q) === 'facile' && !ratee.has(q.id)).slice(0, VIES)) ratee.set(q.id, false)
  assert.ok(niveau - niveauDe(ratee) < 0.6, `une série ratée : ${niveauDe(ratee).toFixed(1)}`)
  // Un débutant, de niveau six, et vingt séries : un débutant.
  const debutant: JoueurSimule = { id: 'debutant', force: forcePourLeNiveau(6, AUCUN_ECART, reference), ecarts: CATEGORIES.map(() => 0) }
  const lesSiennes = jouerDesSeries(h, debutant, base, 20).premieres
  const sonNiveau = niveauDe(lesSiennes)
  assert.ok(Math.abs(sonNiveau - 6) < 1.5, `le débutant : ${sonNiveau.toFixed(1)}`)
  // Un coup de chance : seize bonnes réponses d'affilée, quatre de chaque marche, qu'il n'avait jamais vues.
  const chanceux = new Map(lesSiennes)
  for (const n of NIVEAUX) for (const q of base.filter(q => marcheDe(q) === n && !chanceux.has(q.id)).slice(0, 4)) chanceux.set(q.id, true)
  assert.ok(niveauDe(chanceux) - sonNiveau < 1, `un coup de chance : ${niveauDe(chanceux).toFixed(1)}`)
  assert.ok(niveauDe(chanceux) < 8, 'pas un expert')
})

// ── La série de référence, et Automate ───────────────────────────────────

test('la série de référence : le joueur de la cote de départ y fait le score de référence, et la force monte avec le niveau', () => {
  const base = baseSimulee(hasardFixe(7))
  const reference = serieDeReference(base, marcheDe, q => q.vraie)
  assert.equal(reference.places.length, 60)
  assert.deepEqual(reference.places.slice(0, 20), [...Array(5).fill('facile'), ...Array(5).fill('moyen'), ...Array(5).fill('difficile'), ...Array(5).fill('expert')])
  assert.ok(Math.abs(scoreDeReference(reference.forceDeDepart, AUCUN_ECART, reference) - SCORE_DE_REFERENCE) < 1e-6)
  let avant = -Infinity
  for (const niveau of [3, 6, 9, 12, 15, 18]) {
    const force = forcePourLeNiveau(niveau, AUCUN_ECART, reference)
    assert.ok(force > avant, 'la force monte avec le niveau')
    assert.ok(Math.abs(scoreDeReference(force, AUCUN_ECART, reference) - niveau) < 1e-6)
    avant = force
  }
  // Une petite base, comme celle d'un test : ce qu'une marche trop courte n'a pas, le reste le donne.
  const petite = base.filter((_, i) => i % 20 === 0)
  const courte = serieDeReference(petite, marcheDe, q => q.vraie)
  assert.equal(courte.places.length, petite.length)
})

// Le dé tire ses questions à tour de rôle dans les douze catégories : la
// série de référence les tient à parts égales. Sur une série tombée dans ses
// catégories faibles, Automate fait moins bien lui aussi — il visait avant le
// même score sur chaque série, et une série tombée sur les points faibles de
// qui jouait se perdait d'avance.
test('Automate rate où rate qui le joue : sur une série tombée dans ses catégories faibles, il fait moins bien lui aussi', () => {
  const base = baseSimulee(hasardFixe(8))
  const reference = serieDeReference(base, marcheDe, q => q.vraie)
  const ecarts = CATEGORIES.map(c => (c === 'Sport' ? 0.8 : c === 'Cinéma & séries' ? -0.8 : 0))
  const force = forcePourLeNiveau(10, ecarts, reference)
  /** Une série toute d'une catégorie : cinq de chaque marche, puis des expertes, chacune à la difficulté du milieu de sa marche. */
  const serieDe = (categorie: string) =>
    reference.places.map(n => {
      const d = [...base.filter(q => marcheDe(q) === n && q.meta.categorie === categorie).map(q => q.vraie)].sort((a, b) => a - b)
      return { categorie, difficulte: d[Math.floor(d.length / 2)] }
    })
  const enSport = scoreAttendu(chancesSurLaSerie(serieDe('Sport'), force, ecarts))
  const enCinema = scoreAttendu(chancesSurLaSerie(serieDe('Cinéma & séries'), force, ecarts))
  assert.ok(enSport > 11, `en sport : ${enSport.toFixed(1)}`)
  assert.ok(enCinema < 9, `en cinéma : ${enCinema.toFixed(1)}`)
  // Question par question, à la même difficulté : ses écarts sont les siens, au logit près.
  const [s] = chancesSurLaSerie([{ categorie: 'Sport', difficulte: 0 }], force, ecarts)
  const [c] = chancesSurLaSerie([{ categorie: 'Cinéma & séries', difficulte: 0 }], force, ecarts)
  const logit = (p: number) => Math.log(p / (1 - p))
  assert.ok(s > c)
  assert.ok(Math.abs(logit(s) - logit(c) - 1.6) < 1e-9)
  // Et sur une série comme le dé les tire — toutes les catégories à tour de rôle —, son niveau, en moyenne.
  const h = hasardFixe(9)
  const tirees = Array.from({ length: 300 }, (_, k) =>
    scoreAttendu(
      chancesSurLaSerie(
        reference.places.map((n, i) => {
          const pile = base.filter(q => marcheDe(q) === n && q.meta.categorie === CATEGORIES[(i + k) % CATEGORIES.length])
          const q = pile[Math.floor(h() * pile.length)]
          return { categorie: q.meta.categorie, difficulte: q.vraie }
        }),
        force,
        ecarts,
      ),
    ),
  )
  assert.ok(Math.abs(moyenne(tirees) - 10) < 0.5, `en moyenne : ${moyenne(tirees).toFixed(2)}`)
})

test('son score se tient à deux bonnes réponses de ce qu’on attend de lui sur la série', () => {
  const base = baseSimulee(hasardFixe(10))
  const reference = serieDeReference(base, marcheDe, q => q.vraie)
  const ecarts = CATEGORIES.map((_, i) => (i % 3 === 0 ? 0.6 : i % 3 === 1 ? -0.6 : 0))
  const hasard = hasardFixe(11)
  for (const niveau of [5, 10, 15]) {
    const chances = chancesSurLaSerie(
      reference.places.map((n, i) => {
        const pile = base.filter(q => marcheDe(q) === n)
        const q = pile[(i * 7) % pile.length]
        return { categorie: q.meta.categorie, difficulte: q.vraie }
      }),
      forcePourLeNiveau(niveau, ecarts, reference),
      ecarts,
    )
    const cible = scoreAttendu(chances)
    const scores = Array.from({ length: 300 }, () => partieDAutomate(chances, cible, hasard).filter(Boolean).length)
    assert.ok(
      scores.every(x => Math.abs(x - cible) <= ECART_D_AUTOMATE),
      `cible ${cible.toFixed(1)} : de ${Math.min(...scores)} à ${Math.max(...scores)}`,
    )
    assert.ok(Math.abs(moyenne(scores) - cible) < 0.8)
  }
})

// ── En fond ──────────────────────────────────────────────────────────────

test('l’ajustement rend la main : le serveur répond pendant qu’il calcule, et s’arrête quand il s’éteint', async () => {
  const h = hasardFixe(12)
  const base = baseSimulee(h, 40)
  const joueurs = new Map<string, Map<string, boolean>>()
  for (let p = 0; p < 150; p++) {
    const siennes = new Map<string, boolean>()
    for (let k = 0; k < 600; k++) siennes.set(base[Math.floor(h() * base.length)].id, h() < 0.6)
    joueurs.set(`p${p}`, siennes)
  }
  const entree = { questions: new Map(base.map(q => [q.id, q.meta])), joueurs, forceDeDepart: 0.4 }
  let tours = 0
  let tourne = true
  const tourner = () => {
    tours++
    if (tourne) setImmediate(tourner)
  }
  setImmediate(tourner)
  const modele = await ajusterSansBloquer(entree)
  tourne = false
  assert.ok(modele && modele.reponses > 50_000)
  assert.ok(tours > 20, `${tours} tours pendant l’ajustement`)
  // Le même modèle qu'ajusté d'une traite.
  const dUneTraite = ajusterLeModele(entree)
  assert.equal(modele.passes, dUneTraite.passes)
  for (const [id, d] of dUneTraite.difficultes) assert.equal(modele.difficultes.get(id), d)
  // Le serveur qui s'éteint ne finit pas un calcul que personne ne lira.
  let appels = 0
  assert.equal(await ajusterSansBloquer(entree, () => ++appels > 3), null)
})

// ── Au dé ────────────────────────────────────────────────────────────────

const DEBUT = Date.UTC(2026, 9, 13, 8, 0)

test('le dé : Automate apprend de ses réponses de campagne — fort où il est fort, il rate où il rate', async () => {
  // Deux catégories seulement : le dé en pose à chaque marche.
  const base = baseDEssai(120, { categories: ['Sport', 'Cinéma & séries'] })
  const avant = CampagneStore.reponsesDAutomate
  const demandes: AutomateDuDe[] = []
  CampagneStore.reponsesDAutomate = automate => (demandes.push(automate), avant(automate))
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: base, prechauffageCampagneMs: 3_600_000 })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const profileId = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: lea } })).json()) as any).profile.id as string
    // Son passé, écrit dans la base permanente : vingt questions de sport trouvées, vingt de cinéma ratées.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const sport = base.questions.filter(q => q.meta.categorie === 'Sport').slice(0, 20)
    const cinema = base.questions.filter(q => q.meta.categorie === 'Cinéma & séries').slice(0, 20)
    const serie = randomUUID()
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, '[]', 40, 0, 20, ?, ?, 'serie')`).run(
      serie,
      profileId,
      DEBUT - 86400_000,
      DEBUT - 80000_000,
    )
    const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, 0, ?, ?)')
    db.transaction(() => {
      ;[...sport, ...cinema].forEach((q, i) => reponse.run(serie, i, q.id, sport.includes(q) ? 1 : 0, DEBUT - 86400_000 + i * 10_000))
    })()
    db.close()

    const r = await ecrire(banc.url, '/api/campagne/rencontre', {}, lea)
    const corps = (await r.json()) as any
    assert.equal(r.status, 200, corps.error)
    const automate = demandes.at(-1)!
    // Les questions de la série, dans l'ordre où Automate y a ses chances, et ce qu'il y a joué.
    const lue = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    const ligne = lue.prepare('SELECT questions, adversaire FROM campagne_series WHERE id = ?').get(corps.serie.id) as { questions: string; adversaire: string }
    lue.close()
    const posees = JSON.parse(ligne.questions) as { id: string }[]
    const garde = JSON.parse(ligne.adversaire) as { reponses: boolean[] }
    assert.equal(posees.length, automate.chances.length)
    // À difficulté égale, une chance de plus en sport qu'en cinéma.
    const parDifficulte = new Map<string, number[]>()
    posees.forEach((p, i) => {
      const q = base.parId.get(p.id)!
      const cle = `${q.meta.categorie}·${q.meta.difficulte}`
      parDifficulte.set(cle, [...(parDifficulte.get(cle) ?? []), automate.chances[i]])
    })
    let comparees = 0
    for (const d of [1, 2, 3, 4, 5]) {
      const s = parDifficulte.get(`Sport·${d}`)
      const c = parDifficulte.get(`Cinéma & séries·${d}`)
      if (!s || !c) continue
      comparees++
      assert.ok(moyenne(s) > moyenne(c) + 0.1, `difficulté ${d} : sport ${moyenne(s).toFixed(2)}, cinéma ${moyenne(c).toFixed(2)}`)
    }
    assert.ok(comparees >= 3, `${comparees} difficultés comparées`)
    // Ce qu'on attend de lui sur cette série, et le score qu'il y fait, à deux bonnes réponses près.
    assert.equal(automate.cible, scoreAttendu(automate.chances))
    assert.ok(Math.abs(garde.reponses.filter(Boolean).length - automate.cible) <= ECART_D_AUTOMATE)
  } finally {
    CampagneStore.reponsesDAutomate = avant
    await banc.close()
  }
})

/** Une série finie et ses réponses, écrites dans la base permanente : `[question, juste, quand]`. */
function ecrireUnPasse(banc: Awaited<ReturnType<typeof demarrer>>, profileId: string, reponses: readonly [string, boolean, number][]) {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const serie = randomUUID()
    const debut = Math.min(...reponses.map(r => r[2]))
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'serie')`).run(
      serie,
      profileId,
      reponses.length,
      reponses.filter(r => r[1]).length,
      debut,
      debut + 3600_000,
    )
    const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, 0, ?, ?)')
    db.transaction(() => reponses.forEach(([id, juste, quand], i) => reponse.run(serie, i, id, juste ? 1 : 0, quand)))()
  } finally {
    db.close()
  }
}

const idDuProfil = async (url: string, cookie: string) =>
  ((await (await fetch(`${url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id as string

// Revue, une question a déjà montré sa correction : la retrouver ne dit plus
// ce qu'on savait. Le modèle ne lit que la première réponse de chacun.
test('en fond, le modèle s’ajuste sur la première réponse de chacun — et `/healthz` le dit, sans un nom', async () => {
  const base = baseDEssai(60, { categories: ['Sport', 'Histoire'] })
  const ids = base.questions.map(q => q.id)
  const avant = CampagneStore.reponsesDAutomate
  const demandes: AutomateDuDe[] = []
  CampagneStore.reponsesDAutomate = automate => (demandes.push(automate), avant(automate))
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: base, prechauffageCampagneMs: 3_600_000 })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const [idLea, idTom] = [await idDuProfil(banc.url, lea), await idDuProfil(banc.url, tom)]
    // Léa a raté vingt questions, puis les a toutes retrouvées en les revoyant.
    const hier = DEBUT - 86400_000
    ecrireUnPasse(banc, idLea, [...ids.slice(0, 20).map((id, i): [string, boolean, number] => [id, false, hier + i * 10_000]), ...ids.slice(0, 20).map((id, i): [string, boolean, number] => [id, true, hier + 3600_000 + i * 10_000])])
    // Tom en a trouvé cinq, et une que la base n'a plus.
    ecrireUnPasse(banc, idTom, [...ids.slice(20, 25).map((id, i): [string, boolean, number] => [id, true, hier + i * 10_000]), ['partie00', true, hier + 60_000]])

    // Le dé de Léa : son niveau lit ses premières réponses — vingt fautes —, pas les dernières.
    const r = await ecrire(banc.url, '/api/campagne/rencontre', {}, lea)
    assert.equal(r.status, 200, ((await r.json()) as any).error)
    assert.ok(demandes.at(-1)!.niveau < SCORE_DE_REFERENCE - 1, `vingt fautes d’abord : ${demandes.at(-1)!.niveau}`)

    // Et le modèle, lancé en fond par ce dé, s'ajuste sans qu'il l'attende.
    let sante: any = null
    for (let essai = 0; essai < 100 && !sante?.campagne?.savoir?.ajusteLe; essai++) {
      await new Promise(rendre => setTimeout(rendre, 50))
      sante = await (await fetch(`${banc.url}/healthz`)).json()
    }
    const savoir = sante.campagne.savoir
    assert.equal(savoir.ajusteLe, DEBUT)
    // Deux joueurs ; vingt réponses de Léa — une par question —, cinq de Tom : la question partie ne compte pas.
    assert.deepEqual([savoir.joueurs, savoir.reponses, savoir.rateLe], [2, 25, null])
    assert.ok(savoir.passes >= 1 && typeof savoir.dureeMs === 'number')
    const brut = JSON.stringify(sante)
    for (const secret of [idLea, idTom, ids[0], 'Léa']) assert.ok(!brut.includes(secret), `« ${secret} » ne sort pas par /healthz`)
  } finally {
    CampagneStore.reponsesDAutomate = avant
    await banc.close()
  }
})

test('le dé : sans une réponse, le score de référence ; ses réponses comptent dès le dé suivant', async () => {
  const base = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })
  const avant = CampagneStore.reponsesDAutomate
  const demandes: AutomateDuDe[] = []
  CampagneStore.reponsesDAutomate = automate => (demandes.push(automate), [...Array(4).fill(true), ...Array(VIES).fill(false)])
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: base, prechauffageCampagneMs: 3_600_000 })
  try {
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    const poster = (chemin: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, zoe).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
    const premier = await poster('/api/campagne/rencontre')
    assert.equal(premier.status, 200, premier.corps.error)
    assert.equal(demandes.at(-1)!.niveau, SCORE_DE_REFERENCE, 'sans une réponse : la cote de départ')
    // Elle le joue jusqu'au bout : quatre bonnes réponses, puis trois fautes.
    const posees = (() => {
      const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
      try {
        return JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(premier.corps.serie.id) as { questions: string }).questions) as { bonne: number; reponses: string[] }[]
      } finally {
        db.close()
      }
    })()
    for (let i = 0; i < 4 + VIES; i++) {
      const q = posees[i]
      const r = await poster(`/api/campagne/serie/${premier.corps.serie.id}/reponse`, { index: i, choix: i < 4 ? q.bonne : (q.bonne + 1) % q.reponses.length })
      assert.equal(r.status, 200, r.corps.error)
      if (r.corps.finie) break
    }
    // Le dé suivant : ses réponses comptent déjà — quatre faciles, trois fautes : en dessous de la cote de départ.
    horloge.t += 60 * 60_000
    const second = await poster('/api/campagne/rencontre')
    assert.equal(second.status, 200, second.corps.error)
    assert.ok(demandes.at(-1)!.niveau < SCORE_DE_REFERENCE, `ses réponses le disent : ${demandes.at(-1)!.niveau}`)
  } finally {
    CampagneStore.reponsesDAutomate = avant
    await banc.close()
  }
})
