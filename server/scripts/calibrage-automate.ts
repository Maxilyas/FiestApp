// Le calibrage d'Automate, l'adversaire du dé : ce que le modèle du savoir
// (`core/modeleDuSavoir.ts`) change à ses duels, mesuré sur des joueurs
// simulés qui jouent la vraie base, au vrai tirage (`tirerUneSerie`).
//
// Chaque joueur a une force et un écart par catégorie, et les questions une
// vraie difficulté, que leur estimation d'écriture approche. Il joue d'abord
// ses séries — son passé, sur lequel le modèle s'ajuste —, puis des duels au
// dé : dans un monde contre l'Automate d'avant (ses chances décalées pour
// viser le niveau de sa cote sur chaque série, la médiane de ses séries
// pendant le placement), dans l'autre contre celui du modèle (sa force et
// ses écarts, le niveau de sa cote sur une série tirée pour lui en moyenne).
// Le même passé, les mêmes duels, la même règle de la cote (`ecartDuDuel`).
//
// Ce qu'on lit : la part des duels gagnés, à égalité, perdus ; l'écart du
// score d'Automate au niveau de la cote, et ce qu'il fait à l'enjeu ; la
// part des duels gagnés quand la série est dure pour lui ; et où sa cote
// finit, à côté de celle que sa vraie force vaut.
//
// La base entière a onze mille questions : chacune n'y est presque jamais
// rejouée, et sa difficulté reste presque celle de l'écriture. `--une-sur 10`
// n'en garde qu'une sur dix, comme une base que les joueurs ont fini par
// faire le tour ; `--categories 1` donne aux joueurs des catégories plus
// marquées (l'écart type de leurs écarts, 0,5 d'office).
//
// Mesuré le 13 octobre 2026, à l'arrivée du modèle : les duels gagnés, à
// égalité et perdus ne bougent presque pas (44 / 13 / 43 % avant, 45 / 13 /
// 42 % avec lui) — le dé fait tourner les douze catégories, et une série
// tombe rarement sur les points faibles de qui joue. Ce qui change : ses
// chances collent à celles du joueur à sa force (une corrélation de 0,89 à
// 0,91 ; de 0,79 à 0,88 aux catégories marquées), le niveau de son placement
// tombe deux fois plus près du vrai (0,8 bonne réponse d'écart, puis 0,4),
// et l'enjeu se déséquilibre moins (« +7 / −17 » ou pire, de 27 % des duels à
// 22 %). Son score ne s'écarte jamais de trois bonnes réponses du niveau de
// la cote.
//
//   npx tsx scripts/calibrage-automate.ts [--joueurs 40] [--passe 15] [--duels 30] [--une-sur 1] [--categories 0.5] [--graine 1]
import { BaseDeLaCampagne, lireLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { ECART_D_AUTOMATE, jouerSesChances, partieDAutomate, tirerUneSerie } from '../src/core/campagne'
import {
  ajusterLeModele,
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
  type ModeleDuSavoir,
} from '../src/core/modeleDuSavoir'
import { VIES, niveauDeQuestion, tauxLisse } from '../../shared/campagne'
import { CATEGORIES } from '../../shared/categories'
import { SCORE_DE_REFERENCE, coteDuScore, ecartDuDuel, niveauPourLeDuel, resultatDuDuel, COTE_DE_DEPART } from '../../shared/duels'

function option(nom: string, defaut: number): number {
  const i = process.argv.indexOf(`--${nom}`)
  return i >= 0 ? Number(process.argv[i + 1]) : defaut
}
const JOUEURS = option('joueurs', 40)
const PASSE = option('passe', 15)
const DUELS = option('duels', 30)

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
const h = hasardFixe(option('graine', 1))
const normale = () => Math.sqrt(-2 * Math.log(1 - h())) * Math.cos(2 * Math.PI * h())
// Le tirage bat ses questions avec `Math.random` : le même hasard, pour que deux passages se comparent.
Math.random = h

const UNE_SUR = option('une-sur', 1)
const base = new BaseDeLaCampagne(lireLaBase().questions.filter((_, i) => i % UNE_SUR === 0))
const jouables = base.questions
/** Leur vraie difficulté : l'estimation d'écriture s'en écarte d'autant qu'une IA se trompe. */
const vraie = new Map(jouables.map(q => [q.id, difficulteAPriori(q.meta.difficulte).moyenne + 0.6 * normale()]))

interface Joueur {
  id: string
  force: number
  ecarts: number[]
  premieres: Map<string, boolean>
  vues: Map<string, number>
  /** Ses séries de campagne, leurs bonnes réponses : la médiane des dix dernières, l'Automate d'avant. */
  series: number[]
}
const salle: Joueur[] = Array.from({ length: JOUEURS }, (_, i) => ({
  id: `j${i}`,
  force: 0.5 + normale(),
  ecarts: CATEGORIES.map(() => option('categories', 0.5) * normale()),
  premieres: new Map(),
  vues: new Map(),
  series: [],
}))
const mesure = new Map<string, { justes: number; total: number }>()
let instant = Date.UTC(2026, 9, 1)

const vraiesChances = (j: Joueur, qs: readonly QuestionDeLaBase[]) => qs.map(q => chance(j.force + j.ecarts[indiceDeCategorie(q.meta.categorie)] - vraie.get(q.id)!))

type Mesure = Map<string, { justes: number; total: number }>

/** Ses réponses, rangées comme la campagne les range : la mesure de chaque question, ses vues, ses premières réponses. */
function repondre(j: Joueur, qs: readonly QuestionDeLaBase[], reponses: readonly boolean[], dans: Mesure = mesure) {
  reponses.forEach((juste, i) => {
    const q = qs[i]
    const m = dans.get(q.id) ?? { justes: 0, total: 0 }
    m.total++
    if (juste) m.justes++
    dans.set(q.id, m)
    if (!j.premieres.has(q.id)) j.premieres.set(q.id, juste)
    j.vues.set(q.id, instant)
    instant += 15_000
  })
  instant += 3600_000
}

// ── Son passé : des séries ───────────────────────────────────────────────
for (let s = 0; s < PASSE; s++) {
  for (const j of salle) {
    const qs = tirerUneSerie(jouables, mesure, j.vues, instant).map(x => x.question)
    const reponses = jouerSesChances(vraiesChances(j, qs), h)
    repondre(j, qs, reponses)
    j.series.push(reponses.filter(Boolean).length)
  }
}
const marcheDans = (dans: Mesure) => (q: QuestionDeLaBase) => niveauDeQuestion(q.meta.difficulte, dans.get(q.id))
const sansModele = serieDeReference(jouables, marcheDans(mesure), q => difficulteSansModele(q.meta.difficulte, mesure.get(q.id)))
const debut = Date.now()
const modele: ModeleDuSavoir = ajusterLeModele({
  questions: new Map(jouables.map(q => [q.id, q.meta])),
  joueurs: new Map(salle.map(j => [j.id, j.premieres])),
  forceDeDepart: sansModele.forceDeDepart,
})
const dureeDuModele = Date.now() - debut
const difficulteDe = (q: QuestionDeLaBase) => modele.difficultes.get(q.id) ?? difficulteSansModele(q.meta.difficulte, mesure.get(q.id))

/**
 * Les séries de référence d'un monde, refaites à chaque tour de duels — le
 * serveur la refait quand la mesure change, toutes les dix minutes : les
 * marches bougent avec les réponses. Celle du modèle, et celle aux vraies
 * difficultés — ce que la vraie force d'un joueur vaut, en bonnes réponses,
 * et en cote.
 */
const referencesDans = (dans: Mesure) => ({
  reference: serieDeReference(jouables, marcheDans(dans), difficulteDe),
  laVraie: serieDeReference(jouables, marcheDans(dans), q => vraie.get(q.id)!),
})
type References = ReturnType<typeof referencesDans>

// ── Les deux Automates ───────────────────────────────────────────────────

/** L'Automate d'avant : les parts lissées de la série, décalées du même pas pour viser `niveau` sur cette série. */
function chancesDAvant(qs: readonly QuestionDeLaBase[], niveau: number, dans: Mesure): number[] {
  const taux = qs.map(q => Math.min(0.995, Math.max(0.005, tauxLisse(q.meta.difficulte, dans.get(q.id)?.justes, dans.get(q.id)?.total))))
  const decalees = (pas: number) => taux.map(t => chance(Math.log(t / (1 - t)) + pas))
  let [bas, haut] = [-12, 12]
  for (let i = 0; i < 60; i++) {
    const milieu = (bas + haut) / 2
    if (scoreAttendu(decalees(milieu)) < niveau) bas = milieu
    else haut = milieu
  }
  return decalees((bas + haut) / 2)
}
const medianeDe = (xs: readonly number[]) => {
  if (xs.length === 0) return SCORE_DE_REFERENCE
  const t = [...xs].sort((a, b) => a - b)
  const m = Math.floor(t.length / 2)
  return t.length % 2 === 1 ? t[m] : (t[m - 1] + t[m]) / 2
}

/** Ce qu'Automate joue contre lui sur ces questions, dans chaque monde : ses chances, et le niveau qu'il vise. */
function automate(
  monde: 'avant' | 'modele',
  j: Joueur,
  qs: readonly QuestionDeLaBase[],
  cote: number,
  joues: number,
  dans: Mesure,
  reference: References['reference'],
): { chances: number[]; cible: number; niveau: number } {
  if (monde === 'avant') {
    const niveau = niveauPourLeDuel(joues, cote, medianeDe(j.series.slice(-10)))
    const chances = chancesDAvant(qs, niveau, dans)
    return { chances, cible: niveau, niveau }
  }
  const lui = forceDuJoueur(
    j.premieres,
    id => {
      const q = base.parId.get(id)
      return q && { categorie: q.meta.categorie, difficulte: difficulteDe(q) }
    },
    reference.forceDeDepart,
  )
  const sonNiveau = lui.reponses === 0 ? SCORE_DE_REFERENCE : scoreDeReference(lui.force, lui.ecarts, reference)
  const niveau = niveauPourLeDuel(joues, cote, sonNiveau)
  const force = forcePourLeNiveau(niveau, lui.ecarts, reference)
  const chances = chancesSurLaSerie(qs.map(q => ({ difficulte: difficulteDe(q), categorie: q.meta.categorie })), force, lui.ecarts)
  return { chances, cible: scoreAttendu(chances), niveau }
}

// ── Les duels, dans chaque monde ─────────────────────────────────────────

interface Bilan {
  gagnes: number
  egalites: number
  perdus: number
  /** L'écart du score d'Automate au niveau de la cote, duel par duel. */
  ecarts: number[]
  /** L'enjeu le plus déséquilibré de chaque duel : |gagne + perdu|, « +7 / −17 » vaut 10. */
  desequilibres: number[]
  /** Les duels sur une série plus dure pour lui que d'ordinaire — une bonne réponse attendue de moins, au moins —, et ceux qu'il y gagne ; de même plus facile. */
  durs: number
  dursGagnes: number
  faciles: number
  facilesGagnes: number
  /** Question par question : la chance d'Automate, et la vraie chance du joueur — rate-t-il où il rate ? */
  chancesDAutomate: number[]
  sesChances: number[]
  /** Pendant le placement : le niveau visé, moins son vrai niveau. */
  placement: number[]
  /** Après ses duels : sa cote, et celle de sa vraie force. */
  cotes: { finale: number; vraie: number }[]
}

function jouerLesDuels(monde: 'avant' | 'modele'): Bilan {
  const graine = hasardFixe(option('graine', 1) * 7919 + (monde === 'avant' ? 1 : 2))
  const bilan: Bilan = {
    gagnes: 0,
    egalites: 0,
    perdus: 0,
    ecarts: [],
    desequilibres: [],
    durs: 0,
    dursGagnes: 0,
    faciles: 0,
    facilesGagnes: 0,
    chancesDAutomate: [],
    sesChances: [],
    placement: [],
    cotes: [],
  }
  // Chaque monde part du même passé : la même mesure, les mêmes joueurs. Les
  // duels se jouent par tours, comme une salle : chacun le sien, puis le suivant.
  const dans: Mesure = new Map([...mesure].map(([id, m]) => [id, { ...m }]))
  const joueurs = salle.map(j => ({
    j: { ...j, premieres: new Map(j.premieres), vues: new Map(j.vues), series: [...j.series] } as Joueur,
    cote: COTE_DE_DEPART,
  }))
  let refs = referencesDans(dans)
  for (let d = 0; d < DUELS; d++) {
    refs = referencesDans(dans)
    for (const joueur of joueurs) {
      const { j } = joueur
      const cote = joueur.cote
      const sonVraiNiveau = scoreDeReference(j.force, j.ecarts, refs.laVraie)
      Math.random = graine
      const qs = tirerUneSerie(jouables, dans, j.vues, instant).map(x => x.question)
      const a = automate(monde, j, qs, cote, d, dans, refs.reference)
      const sesReponses = partieDAutomate(a.chances, a.cible, graine)
      const sienScore = sesReponses.filter(Boolean).length
      const vraies = vraiesChances(j, qs)
      const reponses = jouerSesChances(vraies, graine)
      const sonScore = reponses.filter(Boolean).length
      const resultat = resultatDuDuel(sonScore, sienScore)
      if (resultat === 1) bilan.gagnes++
      else if (resultat === 0.5) bilan.egalites++
      else bilan.perdus++
      bilan.ecarts.push(sienScore - a.niveau)
      // Le déséquilibre de l'enjeu sur la cote cachée, l'ELO seul — celle qu'Automate suit, et que ce calibrage simule.
      bilan.desequilibres.push(Math.abs(ecartDuDuel(cote, sienScore, d, 1) + ecartDuDuel(cote, sienScore, d, 0)))
      const durete = scoreAttendu(vraies) - sonVraiNiveau
      if (durete <= -1) {
        bilan.durs++
        if (resultat === 1) bilan.dursGagnes++
      } else if (durete >= 1) {
        bilan.faciles++
        if (resultat === 1) bilan.facilesGagnes++
      }
      // Ce qu'il aurait fait de chaque question à la force d'Automate : rate-t-il où le joueur rate ?
      const aSaForce = vraiesChances({ ...j, force: forcePourLeNiveau(a.niveau, j.ecarts, refs.laVraie) }, qs)
      bilan.chancesDAutomate.push(...a.chances)
      bilan.sesChances.push(...aSaForce)
      if (d < 10) bilan.placement.push(a.niveau - sonVraiNiveau)
      joueur.cote += ecartDuDuel(cote, sienScore, d, resultat)
      repondre(j, qs, reponses, dans)
    }
  }
  for (const { j, cote } of joueurs) bilan.cotes.push({ finale: cote, vraie: coteDuScore(scoreDeReference(j.force, j.ecarts, refs.laVraie)) })
  return bilan
}

const avant = jouerLesDuels('avant')
const apres = jouerLesDuels('modele')

// ── Ce qu'on lit ─────────────────────────────────────────────────────────
const pc = (x: number) => `${Math.round(x * 100)} %`
const f = (x: number, d = 1) => x.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d })
const moyenne = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
const total = (b: Bilan) => b.gagnes + b.egalites + b.perdus
function correlation(a: readonly number[], b: readonly number[]): number {
  const ma = moyenne(a)
  const mb = moyenne(b)
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return num / Math.sqrt(da * db)
}

let n = 0
for (const j of salle) n += j.premieres.size
console.log(`\nAutomate, sur ${JOUEURS} joueurs simulés : ${PASSE} séries de passé chacun, puis ${DUELS} duels au dé, sur ${jouables.length} questions`)
console.log(`le modèle : ${n} premières réponses, ${modele.passes} passes, ${dureeDuModele} ms\n`)
const lignes: [string, (b: Bilan) => string][] = [
  ['duels gagnés', b => pc(b.gagnes / total(b))],
  ['à égalité', b => pc(b.egalites / total(b))],
  ['perdus', b => pc(b.perdus / total(b))],
  ['score d’Automate − niveau de la cote, en moyenne', b => f(moyenne(b.ecarts))],
  ['… à 3 bonnes réponses ou plus', b => pc(b.ecarts.filter(x => Math.abs(x) >= 3).length / b.ecarts.length)],
  ['… à 4 ou plus', b => pc(b.ecarts.filter(x => Math.abs(x) >= 4).length / b.ecarts.length)],
  ['enjeu déséquilibré de 10 points ou plus (« +7 / −17 »)', b => pc(b.desequilibres.filter(x => x >= 10).length / b.desequilibres.length)],
  ['série plus dure pour lui d’une réponse ou plus : gagnés', b => `${pc(b.dursGagnes / Math.max(1, b.durs))} (${b.durs})`],
  ['série plus facile pour lui d’une réponse ou plus : gagnés', b => `${pc(b.facilesGagnes / Math.max(1, b.faciles))} (${b.faciles})`],
  ['ses chances, question par question, et celles du joueur à sa force', b => f(correlation(b.chancesDAutomate, b.sesChances), 2)],
  ['… leur écart moyen', b => f(moyenne(b.chancesDAutomate.map((c, i) => Math.abs(c - b.sesChances[i]))), 3)],
  ['placement : niveau visé − vrai niveau, en valeur absolue', b => f(moyenne(b.placement.map(Math.abs)))],
  ['cote finale − cote de sa vraie force, en moyenne', b => f(moyenne(b.cotes.map(c => c.finale - c.vraie)), 0)],
  ['… en valeur absolue', b => f(moyenne(b.cotes.map(c => Math.abs(c.finale - c.vraie))), 0)],
]
console.log(`${''.padEnd(58)}${'avant'.padStart(10)}${'modèle'.padStart(10)}`)
for (const [nom, lire] of lignes) console.log(`${nom.padEnd(58)}${lire(avant).padStart(10)}${lire(apres).padStart(10)}`)
console.log(`\nLe score d’Automate se tient à ${ECART_D_AUTOMATE} bonnes réponses de ce qu’on attend de lui : avant, du niveau de la cote ; avec le modèle, de son score attendu sur la série.`)
console.log(`Trois vies par série (${VIES}) ; la cote de départ, ${COTE_DE_DEPART}, vaut ${SCORE_DE_REFERENCE} bonnes réponses.`)
