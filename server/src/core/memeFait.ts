import { sansAccent } from '../../../shared/homonymes'
import { QUESTIONS_PAR_TRANCHE, type QuestionDeLaBase } from './baseCampagne'

// Deux questions qui posent le même fait sous deux intitulés : l'empreinte
// (l'intitulé exact, `empreinteDe`) les laissait passer, et rien ne les
// voyait d'une catégorie à l'autre — la consigne d'un lot ne rappelle que
// les intitulés de sa catégorie. Le 10 octobre 2026, trente-huit questions
// de la base en doublaient une autre : « Quel est le plus grand lac
// d'Afrique par sa superficie ? » en culture générale et en géographie,
// l'Hindenburg en culture générale et en histoire, Gotham City en lettres et
// au cinéma ; et, retournées, « Quel acteur a créé le personnage de
// Charlot ? » au cinéma contre « Quel nom les Français donnent-ils au
// vagabond de Charlie Chaplin ? » en pop culture.
//
// La règle, mesurée sur toute la base : la même bonne réponse, et une chose
// en commun — une entité autre que la réponse (« Batman » pour Gotham City),
// ou des intitulés qui partagent l'essentiel de leurs mots ; ou deux
// questions dont chacune a pour réponse le sujet de l'autre. La réponse
// seule ne suffit pas : « Victor Hugo » répond à bien des questions
// différentes, et une entité qui n'est que la réponse (« Athènes ») ne dit
// pas le fait. Sur la base, elle relevait quarante-neuf paires : les
// trente-huit doublons en sont sortis, et les dix paires gardées posent
// deux faits — Persepolis la bande dessinée et la cité antique, le cou de
// la girafe et le nôtre. Un refus dit « sans doute » : une question de plus
// se réécrit sans peine.

/** Ce qu'il faut d'une question pour en lire le fait. */
export type AvecUnFait = Pick<QuestionDeLaBase, 'texte' | 'reponses' | 'bonne' | 'meta'>

/** Une réponse ou un nom, sans ce qui ne le distingue pas : accents, casse, préposition, article, ponctuation. */
export function normeDUnNom(s: string): string {
  return sansAccent(s)
    .replace(/[’']/g, "'")
    .trim()
    .replace(/^(en|au|aux|a) /, '')
    .replace(/^(l'|le |la |les |un |une |des |du |de la |de l'|d')/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Les mots qui portent le sens d'un intitulé : sans accents, sans les petits mots. */
const VIDES = new Set(['dans', 'avec', 'quel', 'quelle', 'quels', 'quelles', 'lequel', 'laquelle', 'sont', 'était', 'etait', 'cette', 'quoi', 'pour', 'plus', 'comment', 'combien', 'nomme', 'appelle', 'appelait'])
export function motsDe(texte: string): Set<string> {
  return new Set(
    sansAccent(texte)
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(m => m.length > 3 && !VIDES.has(m)),
  )
}

/** La part de mots communs à deux intitulés (Jaccard) : 1, les mêmes ; 0, rien en commun. */
export function proximite(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let communs = 0
  for (const m of a) if (b.has(m)) communs++
  return communs / Math.max(1, a.size + b.size - communs)
}

/**
 * Au-delà, deux intitulés de même réponse posent le même fait : « Quel est
 * le plus vaste département de France métropolitaine ? » et « … de la France
 * métropolitaine ? » (1), « En 1896, quelle ville accueille les premiers
 * Jeux olympiques ? » et « Dans quelle ville se tiennent, en 1896, … » (0,75).
 */
export const PROXIMITE_DU_MEME_FAIT = 0.4

/** Ce qui se compare d'une question : sa bonne réponse, ses entités hors elle, ses mots et ses nombres. */
export interface Fait {
  reponse: string
  /**
   * Une réponse chiffrée — « 4 », « 11 », une année — répond à des questions
   * taillées pareil qui ne disent pas le même fait (« Combien de cordes compte
   * un violon ? », « … une basse ? ») : ses mots seuls ne suffisent pas.
   */
  chiffree: boolean
  entites: Set<string>
  mots: Set<string>
  /**
   * Les nombres de l'intitulé : deux intitulés de mêmes mots qui n'en
   * partagent aucun parlent de deux choses — « Quel pays remporte la Coupe
   * du monde 1998 ? » et « … 2018 ? », la France les deux fois.
   */
  nombres: Set<string>
}

/** Le fait d'une question ; null pour un vrai ou faux, dont la réponse ne dit rien du fait. */
export function faitDe(q: AvecUnFait): Fait | null {
  if (q.reponses.length === 2) return null
  const reponse = normeDUnNom(q.reponses[q.bonne] ?? '')
  if (!reponse) return null
  return {
    reponse,
    chiffree: q.meta.valeur !== null || /^\d/.test(reponse),
    entites: new Set(q.meta.entites.map(e => normeDUnNom(e.nom)).filter(e => e && e !== reponse)),
    mots: motsDe(q.texte),
    nombres: new Set(q.texte.match(/\d+/g) ?? []),
  }
}

/** Ces deux faits sont-ils le même — posé deux fois, ou retourné ? */
export function memeFait(a: Fait, b: Fait): boolean {
  // Retourné : chacune a pour réponse ce dont parle l'autre — Charlot et Charlie Chaplin, le canal de Suez et Ferdinand de Lesseps.
  if (a.reponse !== b.reponse) return a.entites.has(b.reponse) && b.entites.has(a.reponse)
  for (const e of a.entites) if (b.entites.has(e)) return true
  if (a.chiffree || b.chiffree) return false
  if (a.nombres.size > 0 && b.nombres.size > 0 && ![...a.nombres].some(n => b.nombres.has(n))) return false
  return proximite(a.mots, b.mots) >= PROXIMITE_DU_MEME_FAIT
}

interface Entree<Q> {
  question: Q
  fait: Fait
  /** Son ordre d'arrivée : chaque paire ne se dit qu'une fois. */
  rang: number
}

/**
 * Les faits d'une base, rangés par bonne réponse : chercher ne compare
 * qu'aux questions de même réponse, et à celles qui ont pour réponse une de
 * ses entités — quelques-unes, jamais toute la base.
 */
export class IndexDesFaits<Q extends AvecUnFait> {
  private readonly parReponse = new Map<string, Entree<Q>[]>()
  private rang = 0

  constructor(questions: Iterable<Q> = []) {
    for (const q of questions) this.ajouter(q)
  }

  ajouter(q: Q): void {
    const fait = faitDe(q)
    if (!fait) return
    const entree = { question: q, fait, rang: this.rang++ }
    const groupe = this.parReponse.get(fait.reponse)
    if (groupe) groupe.push(entree)
    else this.parReponse.set(fait.reponse, [entree])
  }

  private *candidates(fait: Fait): Generator<Entree<Q>> {
    yield* this.parReponse.get(fait.reponse) ?? []
    for (const e of fait.entites) yield* this.parReponse.get(e) ?? []
  }

  /** La question qui pose déjà ce fait, s'il y en a une. */
  chercher(q: AvecUnFait): Q | undefined {
    const fait = faitDe(q)
    if (!fait) return undefined
    for (const x of this.candidates(fait)) if (memeFait(fait, x.fait)) return x.question
    return undefined
  }

  /** Toutes les paires de la base qui posent le même fait. */
  *paires(): Generator<[Q, Q]> {
    for (const groupe of this.parReponse.values()) {
      for (const x of groupe) for (const y of this.candidates(x.fait)) if (y.rang > x.rang && memeFait(x.fait, y.fait)) yield [x.question, y.question]
    }
  }
}

/**
 * L'index d'une base entière, bâti par tranches qui rendent la main : d'un
 * bloc, 75 ms ici pour cinq mille questions, dix fois plus au dixième de cœur
 * de l'hébergeur — et aucune soirée ne recevait rien pendant ce temps.
 */
export async function indexSansBloquer<Q extends AvecUnFait>(questions: readonly Q[]): Promise<IndexDesFaits<Q>> {
  const index = new IndexDesFaits<Q>()
  for (let i = 0; i < questions.length; i++) {
    if (i > 0 && i % QUESTIONS_PAR_TRANCHE === 0) await new Promise<void>(rendre => setImmediate(rendre))
    index.ajouter(questions[i])
  }
  return index
}

/** Le motif d'un refus pour un fait que la base pose déjà : ce qu'il faut savoir pour en écrire un autre. */
export const motifDuMemeFait = (deja: Pick<QuestionDeLaBase, 'texte' | 'meta'>): string =>
  `pose sans doute le même fait que « ${deja.texte} » (${deja.meta.categorie}) : écris-en un autre`
