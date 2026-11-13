import { sansAccent } from '../../../shared/homonymes'
import { QUESTIONS_PAR_TRANCHE, type QuestionDeLaBase } from './baseCampagne'
import { rendreLaMain } from './tourniquet'

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
//
// Retournées, deux questions ne se nomment pas toujours par leurs entités :
// « Quel animal fabuleux figure sur le drapeau du Bhoutan ? » (un dragon)
// et « Quel pays de l'Himalaya a un dragon blanc sur son drapeau ? » (le
// Bhoutan), écrites le même jour en culture générale et en géographie par la
// première génération en nombre, ne se voyaient pas : seul leur correcteur,
// qui les avait sur la même fiche, les a vues. Chacune écrit dans son
// intitulé la réponse de l'autre, et elles parlent de la même chose : le même
// fait. Sur la base, la règle relevait trois paires — Lacoste et son
// crocodile, la cité de Chichén Itzá au Mexique et bâtie par les Mayas, Les
// Demoiselles de Rochefort et la sœur de Catherine Deneuve : la dernière pose
// deux faits, mais l'une souffle la réponse de l'autre.
//
// Une réponse chiffrée, elle, se retourne dans un seul sens. « En quelle année
// Delacroix peint-il La Liberté guidant le peuple ? » (1830), quand la base a
// « Quel peintre a représenté la révolution de Juillet 1830 dans La Liberté
// guidant le peuple ? » : l'intitulé chiffré n'écrit pas « Eugène Delacroix »
// en entier, et le juge laissait passer. Le 9 novembre 2026, 36 des 140
// questions à nombre écrites pour le Filet du Cabinet étaient de ces redites,
// rattrapées à la main : la date d'une œuvre est presque toujours dans
// l'intitulé qui demande son auteur — la consigne veut qu'un fait daté se date
// dans l'intitulé. La règle (`chiffreeEcrite`) : la réponse chiffrée de l'une
// est écrite dans l'intitulé de l'autre, et elles parlent de la même chose —
// une entité commune, ou la réponse de l'autre parmi ses entités (« Quel pays
// d'Afrique centrale s'est appelé Zaïre de 1971 à 1997 ? » n'a pour entité que
// sa réponse). L'entité entière, jamais un mot : un contrôle par nom propre
// commun rapprochait la tour Montparnasse (1973) du « Tour de France 1973 »,
// et la Finlande (1917) de l'« Empire » russe. Mesurée sur les 27 815
// questions de la base, elle relevait 332 paires pour 218 questions à nombre,
// neuf sur dix de vraies redites ; le reste, la même personne, la même année
// et un autre fait (le moonwalk et « Billie Jean », en 1983) : « sans
// doute », comme les autres. La base garde les siennes — le choix du
// propriétaire, le 10 novembre 2026 : 176 de ces 218 questions servent au
// Filet du Cabinet —, et la règle ne vaut que pour ce qui arrive.
//
// Depuis le 12 novembre 2026, ce ne sont plus des doublons mais deux faces du
// même fait (`lienEntre`, `core/faces.ts`) : l'une se range, liée à l'autre, et
// le tirage ne les pose jamais ensemble — la date d'une œuvre écrite dans
// l'intitulé qui demande son auteur fermait au Filet toutes les années que
// chaque Français sait placer. La base a lié les siennes le même jour
// (`base-campagne.ts faces`).
//
// Et deux réponses chiffrées qui disent la même grandeur sont la même réponse
// (`grandeurDe`) : la base avait les noces d'or en « 50 ans » et en « 50 »,
// la semaine du Front populaire en « 40 h » et en « 40 heures », la chope de
// l'Oktoberfest en « 1 litre » et en « 100 cl » — dix-neuf paires qu'une
// entité commune aurait dû refuser, et qui ne se comparaient pas : dix-huit
// vrais doublons, sortis le même jour, et le quinquennat face au mandat du
// président, qui pose deux faits.

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

/** Les nombres d'un intitulé : une année, un rang, un compte. */
export const nombresDe = (texte: string): Set<string> => new Set(texte.match(/\d+/g) ?? [])

/** Deux intitulés qui ont des nombres et n'en partagent aucun parlent de deux choses : la Coupe du monde 1998 et celle de 2018. */
const aucunNombreCommun = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size > 0 && b.size > 0 && ![...a].some(n => b.has(n))

/**
 * Au-delà, deux intitulés de réponses différentes sont presque pareils : rien
 * ne les refuse, `voisines` les montre à un humain — « Quel peintre a réalisé
 * « La Ronde de nuit » ? » et « … des prisonniers ? » (0,6).
 */
export const PROXIMITE_DES_VOISINES = 0.6

/** Ce que `presquePareils` compare d'un intitulé, lu une fois pour toutes ses paires. */
export interface TraitsDUnIntitule {
  mots: Set<string>
  nombres: Set<string>
}
export const traitsDe = (texte: string): TraitsDUnIntitule => ({ mots: motsDe(texte), nombres: nombresDe(texte) })

/**
 * Deux intitulés presque pareils — sauf s'ils ne partagent aucun nombre, comme
 * pour le même fait (`memeFait`) : au pilote de Wikidata du 10 octobre 2026,
 * les vainqueurs des grands tours, année par année, faisaient mille paires,
 * et noyaient celles qui comptent.
 */
export function presquePareils(a: TraitsDUnIntitule, b: TraitsDUnIntitule): boolean {
  return !aucunNombreCommun(a.nombres, b.nombres) && proximite(a.mots, b.mots) >= PROXIMITE_DES_VOISINES
}

/** Ce qui se compare d'une question : sa bonne réponse, ses entités hors elle, ses mots et ses nombres. */
export interface Fait {
  reponse: string
  /**
   * Une réponse chiffrée — « 4 », « 11 », une année — répond à des questions
   * taillées pareil qui ne disent pas le même fait (« Combien de cordes compte
   * un violon ? », « … une basse ? ») : ses mots seuls ne suffisent pas.
   */
  chiffree: boolean
  /**
   * Les chiffres d'une réponse chiffrée, groupe par groupe — « 1830 », 3 et
   * 842 pour « 3 842 m », rien pour « Trois » — : ce qu'on cherche dans
   * l'intitulé d'une autre question (`chiffreeEcrite`).
   */
  chiffres: string[]
  /**
   * La grandeur que dit une réponse chiffrée, d'une seule façon (`grandeurDe`) :
   * « 50 ans » et « 50 », « 33 cl » et « 330 ml ». Null sans valeur étiquetée,
   * ou quand la réponse n'en écrit pas le nombre.
   */
  grandeur: string | null
  entites: Set<string>
  mots: Set<string>
  /**
   * Les nombres de l'intitulé : deux intitulés de mêmes mots qui n'en
   * partagent aucun parlent de deux choses — « Quel pays remporte la Coupe
   * du monde 1998 ? » et « … 2018 ? », la France les deux fois.
   */
  nombres: Set<string>
  /** L'intitulé écrit comme un nom (`normeDUnNom`), entre deux espaces : on y cherche la réponse d'une autre question. */
  intitule: string
}

/** Ce nom est-il écrit en toutes lettres dans cet intitulé ? Pas sous trois lettres : « or » et « ré » se croisent par hasard. */
const ecrit = (intitule: string, nom: string) => nom.length >= 3 && intitule.includes(` ${nom} `)

/**
 * Les unités qui disent la même grandeur, chacune avec le nom et le facteur
 * qui la ramènent à une seule. Une longueur, un volume, une masse se
 * convertissent : la canette de 33 cl est celle de 330 ml. Une durée ne fait
 * que s'abréger (« 40 h », « 40 heures ») : cent soixante-huit heures et
 * sept jours répondent à deux questions — « Combien d'heures compte une
 * semaine ? », « Combien de jours… ? » —, et les convertir relevait dans la
 * base quatre fausses paires, sans une vraie.
 */
const UNITES = new Map<string, readonly [nom: string, facteur: number]>([
  ['mm', ['mm', 1]],
  ['millimetre', ['mm', 1]],
  ['cm', ['mm', 10]],
  ['centimetre', ['mm', 10]],
  ['m', ['mm', 1e3]],
  ['metre', ['mm', 1e3]],
  ['km', ['mm', 1e6]],
  ['kilometre', ['mm', 1e6]],
  ['ml', ['ml', 1]],
  ['millilitre', ['ml', 1]],
  ['cl', ['ml', 10]],
  ['centilitre', ['ml', 10]],
  ['dl', ['ml', 100]],
  ['l', ['ml', 1e3]],
  ['litre', ['ml', 1e3]],
  ['mg', ['mg', 1]],
  ['g', ['mg', 1e3]],
  ['gramme', ['mg', 1e3]],
  ['kg', ['mg', 1e6]],
  ['kilo', ['mg', 1e6]],
  ['kilogramme', ['mg', 1e6]],
  ['t', ['mg', 1e9]],
  ['tonne', ['mg', 1e9]],
  ['s', ['seconde', 1]],
  ['min', ['minute', 1]],
  ['h', ['heure', 1]],
])

/**
 * La grandeur d'une valeur étiquetée (`meta.valeur`), écrite d'une seule
 * façon : le nombre dans la plus petite unité de sa famille, l'unité sans
 * accent ni pluriel. L'étiquette porte l'unité même quand la réponse
 * l'omet — « 50 », valeur 50 ans. Null quand la réponse n'écrit pas ce
 * nombre : la valeur étiquetée est parfois celle de l'intitulé (« En 2016,
 * quelle danseuse… ? », valeur 2016), et une réponse qui porte un autre
 * chiffre — « Apollo 11 » — se serait dite égale à une année.
 */
function grandeurDe(valeur: AvecUnFait['meta']['valeur'], reponse: string): string | null {
  if (!valeur || (reponse.match(/\d+/g) ?? []).join('') !== String(valeur.nombre).replace(/\D/g, '')) return null
  const ecrite = sansAccent(valeur.unite)
  // « ans » et « an », « litres » et « litre » — pas « ms », qui n'est pas un mètre au pluriel.
  const unite = UNITES.has(ecrite) || ecrite.length <= 2 ? ecrite : ecrite.replace(/s$/, '')
  const [nom, facteur] = UNITES.get(unite) ?? [unite, 1]
  // Arrondi : 1,15 × 100 fait 114,99999999999999.
  return `${Math.round(valeur.nombre * facteur * 1e6) / 1e6} ${nom}`
}

/** Le fait d'une question ; null pour un vrai ou faux, dont la réponse ne dit rien du fait. */
export function faitDe(q: AvecUnFait): Fait | null {
  if (q.reponses.length === 2) return null
  const ecrite = q.reponses[q.bonne] ?? ''
  const reponse = normeDUnNom(ecrite)
  if (!reponse) return null
  const chiffree = q.meta.valeur !== null || /^\d/.test(reponse)
  const chiffres = chiffree ? [...nombresDe(ecrite)] : []
  return {
    reponse,
    chiffree,
    chiffres,
    grandeur: grandeurDe(q.meta.valeur, ecrite),
    entites: new Set(q.meta.entites.map(e => normeDUnNom(e.nom)).filter(e => e && e !== reponse)),
    mots: motsDe(q.texte),
    nombres: nombresDe(q.texte),
    intitule: ` ${sansAccent(q.texte).replace(/[^a-z0-9]+/g, ' ').trim()} `,
  }
}

/** La même réponse, ou la même grandeur écrite autrement : « 50 ans » et « 50 », « 33 cl » et « 330 ml ». */
const memeReponse = (a: Fait, b: Fait) => a.reponse === b.reponse || (a.grandeur !== null && a.grandeur === b.grandeur)

/**
 * Retournées : chacune a pour réponse ce dont parle l'autre — Charlot et
 * Charlie Chaplin, le canal de Suez et Ferdinand de Lesseps. Ou chacune écrit
 * dans son intitulé la réponse de l'autre, et elles parlent de la même
 * chose : le dragon du drapeau du Bhoutan.
 */
const retournees = (a: Fait, b: Fait) =>
  (a.entites.has(b.reponse) && b.entites.has(a.reponse)) || (ecrit(a.intitule, b.reponse) && ecrit(b.intitule, a.reponse) && [...a.entites].some(e => b.entites.has(e)))

/**
 * La réponse chiffrée de `a` est-elle écrite dans l'intitulé de `b`, qui
 * parle de la même chose ? Un seul sens suffit : `b` n'a pas à lire sa
 * réponse dans l'intitulé de `a`.
 *
 * Ce dont elles parlent toutes deux : une entité de `a` que `b` a aussi, ou
 * qui est la réponse de `b` — la même question retournée, « Après combien
 * d'années fête-t-on les noces d'or ? » et « Comment appelle-t-on les 50 ans
 * de mariage ? ». Pas une entité qui porte le nombre dans son nom (« Coupe du
 * monde de football 2018 », « Pièce de 2 euros ») : elle n'est que la
 * réponse, toute question qui la nomme l'écrit, et une seule question « En
 * quelle année… ? » aurait fermé la base à tout ce qui parle de ce Mondial.
 *
 * Écrite : la réponse entière (« 1830 », « 18 ans », « 14 juillet ») ; ou ses
 * seuls chiffres, en mots entiers (« M6 » n'écrit pas 6), quand elle en a
 * trois de suite (« 330 m » pour « 330 mètres ») ou que la question est
 * retournée. Un petit nombre se croise sinon par hasard : sur la base,
 * vingt-quatre épisodes et « le 24 mai », quatre joueurs au bridge et « l'as
 * à 4 » — une trentaine de paires, autant de fausses que de vraies.
 */
function chiffreeEcrite(a: Fait, b: Fait): boolean {
  if (a.chiffres.length === 0) return false
  let commune = false
  let retournee = false
  for (const e of a.entites) {
    if (a.chiffres.every(n => ` ${e} `.includes(` ${n} `))) continue
    if (e === b.reponse) retournee = true
    else if (b.entites.has(e)) commune = true
  }
  if (!commune && !retournee) return false
  if (ecrit(b.intitule, a.reponse)) return true
  return (retournee || a.chiffres.some(n => n.length >= 3)) && a.chiffres.every(n => b.intitule.includes(` ${n} `))
}

/**
 * Ce que deux questions qui posent le même fait sont l'une pour l'autre : un
 * doublon — le même fait posé deux fois, ou retourné, ce qui se refuse —, ou
 * deux faces du même fait (`core/faces.ts`) : une réponse chiffrée que l'autre
 * écrit dans son intitulé, l'année d'une œuvre quand l'autre en demande
 * l'auteur. Le juge les refusait aussi, jusqu'au 12 novembre 2026 : chaque fait
 * connu n'existait que sous une face, et l'acte I du Filet perdait 115 des 129
 * années que chaque Français sait placer. Une face se range, liée à sa sœur
 * (`QuestionDeLaBase.faceDe`), et c'est le tirage qui ne les pose jamais
 * ensemble. Les autres retournées restent des doublons — Charlot et Charlie
 * Chaplin, le dragon du Bhoutan : le choix du propriétaire de commencer petit.
 */
export type LienEntreDeuxFaits = 'doublon' | 'face'

/** Le lien entre deux faits (`LienEntreDeuxFaits`) ; null : ce ne sont pas les mêmes. */
export function lienEntre(a: Fait, b: Fait): LienEntreDeuxFaits | null {
  if (!memeReponse(a, b)) {
    if (retournees(a, b)) return 'doublon'
    return chiffreeEcrite(a, b) || chiffreeEcrite(b, a) ? 'face' : null
  }
  for (const e of a.entites) if (b.entites.has(e)) return 'doublon'
  if (a.chiffree || b.chiffree) return null
  if (aucunNombreCommun(a.nombres, b.nombres)) return null
  return proximite(a.mots, b.mots) >= PROXIMITE_DU_MEME_FAIT ? 'doublon' : null
}

/** Ces deux faits sont-ils le même — posé deux fois, retourné, ou sous une autre face ? */
export function memeFait(a: Fait, b: Fait): boolean {
  return lienEntre(a, b) !== null
}

interface Entree<Q> {
  question: Q
  fait: Fait
  /** Son ordre d'arrivée : chaque paire ne se dit qu'une fois. */
  rang: number
}

/**
 * Les faits d'une base, rangés par bonne réponse et par entité : chercher ne
 * compare qu'aux questions de même réponse, à celles qui ont pour réponse une
 * de ses entités, à celles qui parlent de la même chose et à celles qui
 * parlent de sa réponse — quelques-unes, jamais toute la base.
 */
export class IndexDesFaits<Q extends AvecUnFait> {
  private readonly parReponse = new Map<string, Entree<Q>[]>()
  private readonly parEntite = new Map<string, Entree<Q>[]>()
  private rang = 0

  constructor(questions: Iterable<Q> = []) {
    for (const q of questions) this.ajouter(q)
  }

  ajouter(q: Q): void {
    const fait = faitDe(q)
    if (!fait) return
    const entree = { question: q, fait, rang: this.rang++ }
    for (const [index, cle] of [[this.parReponse, fait.reponse] as const, ...[...fait.entites].map(e => [this.parEntite, e] as const)]) {
      const groupe = index.get(cle)
      if (groupe) groupe.push(entree)
      else index.set(cle, [entree])
    }
  }

  private *candidates(fait: Fait): Generator<Entree<Q>> {
    yield* this.parReponse.get(fait.reponse) ?? []
    // Celles qui parlent de sa réponse : une question à nombre retournée ne se trouve que par là, quand c'est l'autre qui
    // arrive — « Quel pays s'est appelé Zaïre de 1971 à 1997 ? » n'a pas d'entité hors sa réponse.
    yield* this.parEntite.get(fait.reponse) ?? []
    for (const e of fait.entites) {
      yield* this.parReponse.get(e) ?? []
      yield* this.parEntite.get(e) ?? []
    }
  }

  /** La question qui pose déjà ce fait, s'il y en a une — en doublon ou sous une autre face. */
  chercher(q: AvecUnFait): Q | undefined {
    const fait = faitDe(q)
    if (!fait) return undefined
    for (const x of this.candidates(fait)) if (memeFait(fait, x.fait)) return x.question
    return undefined
  }

  /**
   * Ce que la base dit d'une question qui arrive : celle qu'elle doublerait —
   * elle se refuse —, ou celles dont elle serait une autre face — elle se
   * range, liée à elles (`QuestionDeLaBase.faceDe`). Un doublon l'emporte :
   * une face qui en double une autre ne se range pas.
   */
  relever(q: AvecUnFait): { doublon?: Q; faces: Q[] } {
    const fait = faitDe(q)
    const faces: Q[] = []
    if (!fait) return { faces }
    // Deux entités en commun font croiser deux fois la même candidate.
    const vues = new Set<number>()
    for (const x of this.candidates(fait)) {
      if (vues.has(x.rang)) continue
      vues.add(x.rang)
      const lien = lienEntre(fait, x.fait)
      if (lien === 'doublon') return { doublon: x.question, faces: [] }
      if (lien === 'face') faces.push(x.question)
    }
    return { faces }
  }

  /** Toutes les paires de la base qui posent le même fait, chacune une fois : deux questions qui partagent deux entités se croisent deux fois. */
  *paires(): Generator<[Q, Q]> {
    const dites = new Set<string>()
    for (const groupe of this.parReponse.values()) {
      for (const x of groupe) {
        for (const y of this.candidates(x.fait)) {
          const paire = `${x.rang}:${y.rang}`
          if (y.rang <= x.rang || dites.has(paire) || !memeFait(x.fait, y.fait)) continue
          dites.add(paire)
          yield [x.question, y.question]
        }
      }
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
    if (i > 0 && i % QUESTIONS_PAR_TRANCHE === 0) await rendreLaMain()
    index.ajouter(questions[i])
  }
  return index
}

/**
 * Le motif d'un refus pour un fait que la base pose déjà : ce qu'il faut
 * savoir pour en écrire un autre. Une question qui ne fait qu'écrire dans son
 * intitulé la réponse chiffrée d'une autre pose souvent un autre fait —
 * « Dans « Avatar » (2009), … » quand la base demande l'année du film — : le
 * motif lui dit le nombre, qu'elle peut retirer sans changer de sujet. Dit
 * « pose le même fait », dix questions sur le film reviendraient dix fois
 * avec leur année.
 */
export function motifDuMemeFait(deja: AvecUnFait, nouvelle?: AvecUnFait): string {
  const [d, n] = [faitDe(deja), nouvelle ? faitDe(nouvelle) : null]
  if (d && n && !memeReponse(d, n) && !retournees(d, n) && !chiffreeEcrite(n, d) && chiffreeEcrite(d, n)) {
    return `donne dans son intitulé la réponse (${deja.reponses[deja.bonne]}) de « ${deja.texte} » (${deja.meta.categorie}) : retire-la de l’intitulé, ou écris une autre question`
  }
  return `pose sans doute le même fait que « ${deja.texte} » (${deja.meta.categorie}) : écris-en un autre`
}
