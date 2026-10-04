import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { SERVEUR } from '../racine'
import { CATEGORIES } from '../../../shared/categories'
import { lireEtiquetage, type MetadonneesDeQuestion } from '../../../shared/etiquettes'
import { MAX_ANECDOTE, MAX_TEXT } from '../../../shared/library'
import { sansAccent } from '../../../shared/homonymes'
import { empreinteDe } from './jour'

/**
 * La base de la campagne : ses questions à elle, écrites et étiquetées
 * d'avance, une catégorie par fichier (`server/content/campagne/`), une
 * question par ligne.
 *
 * La campagne puisait d'abord dans les questions que le quiz du jour avait
 * déjà posées : une centaine, vues et corrigées par ceux qui jouent chaque
 * matin, et que la campagne leur reposait. Le propriétaire l'a refusé le 3
 * octobre 2026 : la campagne a sa base, très grande, pour qu'on n'y croise
 * jamais deux fois la même question — et elle reste à l'écart de la réserve
 * du quiz du jour, dans un sens comme dans l'autre (`empreintes`).
 *
 * Chaque entrée porte ses métadonnées au format de l'étiquetage
 * (`shared/etiquettes.ts`), relues par le même juge (`lireEtiquetage`) : la
 * difficulté estimée y sert d'a priori, que les réponses des joueurs
 * corrigent (`shared/campagne.ts`, `tauxLisse`).
 *
 * Elle s'agrandit par `server/scripts/base-campagne.ts` : la consigne
 * d'écriture, la vérification d'un lot, puis son rangement.
 */

export const DOSSIER_DE_LA_BASE = path.join(SERVEUR, 'content/campagne')

/** Une réponse tient sur un bouton de téléphone : bien moins que les 120 caractères qu'accepte l'éditeur. */
export const MAX_REPONSE = 70

/** Les étiquettes que la campagne ne pose jamais : ce qui gâche un film, divise la table, ou n'a rien à faire dans un jeu ouvert à tous. */
export const ETIQUETTES_ECARTEES: readonly string[] = ['sexualite', 'politique', 'divulgache']

export interface QuestionDeLaBase {
  /** Huit caractères, tirés à son rangement et qui ne changent plus : les réponses et les signalements s'y rattachent. */
  id: string
  texte: string
  /** Quatre réponses, ou « Vrai » et « Faux ». */
  reponses: string[]
  bonne: number
  anecdote: string | null
  meta: MetadonneesDeQuestion
  /** L'intitulé sans casse ni accents (`empreinteDe`) : ce qui la tient à l'écart de la réserve du quiz du jour. */
  empreinte: string
}

const ID = /^[a-z0-9]{8}$/
const EMOJI = /\p{Extended_Pictographic}/u
/** « Aucune de ces réponses », « Toutes » : une réponse qui n'en est pas une. */
const NON_REPONSE = /^(aucune?|toutes?|tous|les deux|ni l['’]un)\b/i
/** « Lequel n'est pas… » : une négation fait trébucher sur la lecture, pas sur le savoir. */
const NEGATION = /\b(n['’]\s?(est|était|sont|étaient|a|ont|avait|fait|font|appartient)|ne\s+(sont|fait|font|vit|vivent|compte|comptent|possède|possèdent))\s+pas\b/i

const lettreOuChiffre = (c: string | undefined) => c !== undefined && ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'))

/**
 * Le mot écrit en toutes lettres dans le texte, entre deux bords de mot : le
 * verdict de `(^|[^a-z0-9])mot($|[^a-z0-9])`, sans l'expression. En compiler
 * une par question coûtait 170 ms à chaque lecture de la base — la moitié du
 * temps où le serveur ne répondait plus à personne.
 */
function ecritDans(texte: string, mot: string): boolean {
  for (let i = texte.indexOf(mot); i >= 0; i = texte.indexOf(mot, i + 1)) {
    if (!lettreOuChiffre(texte[i - 1]) && !lettreOuChiffre(texte[i + mot.length])) return true
  }
  return false
}

/**
 * Relit une entrée de la base — ou d'un lot qu'une IA vient d'écrire, sans
 * identifiant encore (`sansId`). Refusée en entier au premier défaut, avec
 * sa raison : une question douteuse ne doit pas entrer, et le rédacteur doit
 * savoir quoi corriger. Les métadonnées passent par `lireEtiquetage`, le
 * juge de l'étiquetage de la réserve : une clé inconnue y refuse tout.
 */
export function lireQuestionDeLaBase(brut: unknown, { sansId = false } = {}): { question: QuestionDeLaBase } | { refus: string } {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { refus: 'pas un objet' }
  const b = brut as Record<string, unknown>
  const id = typeof b.id === 'string' ? b.id : ''
  if (!sansId && !ID.test(id)) return { refus: `identifiant invalide : ${String(b.id)}` }

  const texte = typeof b.texte === 'string' ? b.texte.trim() : ''
  const longueur = Array.from(texte).length
  if (longueur < 10) return { refus: 'intitulé vide ou trop court' }
  if (longueur > MAX_TEXT) return { refus: `intitulé de plus de ${MAX_TEXT} caractères` }
  if (/\s{2,}|\n/.test(texte)) return { refus: 'intitulé sur plusieurs lignes ou avec des espaces doubles' }

  const reponses = Array.isArray(b.reponses) ? b.reponses.map(r => (typeof r === 'string' ? r.trim() : '')) : []
  const vraiFaux = reponses.length === 2
  if (reponses.length !== 4 && !(vraiFaux && reponses[0] === 'Vrai' && reponses[1] === 'Faux')) {
    return { refus: 'quatre réponses, ou exactement ["Vrai", "Faux"]' }
  }
  if (reponses.some(r => !r)) return { refus: 'une réponse vide' }
  const longue = reponses.find(r => Array.from(r).length > MAX_REPONSE)
  if (longue) return { refus: `réponse de plus de ${MAX_REPONSE} caractères : ${longue}` }
  if (new Set(reponses.map(sansAccent)).size !== reponses.length) return { refus: 'deux réponses identiques' }
  const nonReponse = reponses.find(r => NON_REPONSE.test(r))
  if (nonReponse) return { refus: `une réponse qui n'en est pas une : ${nonReponse}` }

  const bonne = b.bonne
  if (typeof bonne !== 'number' || !Number.isInteger(bonne) || bonne < 0 || bonne >= reponses.length) return { refus: 'index de la bonne réponse hors des réponses' }

  let anecdote: string | null = null
  if (b.anecdote !== null && b.anecdote !== undefined) {
    if (typeof b.anecdote !== 'string' || !b.anecdote.trim()) return { refus: 'anecdote vide : null, ou une phrase' }
    anecdote = b.anecdote.trim()
    if (Array.from(anecdote).length > MAX_ANECDOTE) return { refus: `anecdote de plus de ${MAX_ANECDOTE} caractères` }
  }

  // Nulle part dans l'entrée, pas même un leurre ou une explication : l'écran
  // commun tourne sous Windows 10, et `emojis.test.ts` relit tout le dossier.
  const emoji = JSON.stringify(b).match(EMOJI)
  if (emoji) return { refus: `un emoji ou un pictogramme : ${emoji[0]}` }
  if (NEGATION.test(texte)) return { refus: 'une négation dans l’intitulé (« Lequel n’est pas… »)' }
  // La réponse dans l'intitulé se lit sans rien savoir. Les mots trop courts
  // (« Or », « Mer ») se croisent par hasard : on ne compare que les autres.
  const juste = sansAccent(reponses[bonne])
  if (!vraiFaux && juste.length >= 4 && ecritDans(sansAccent(texte), juste)) {
    return { refus: 'la bonne réponse est écrite dans l’intitulé' }
  }

  const lu = lireEtiquetage(b)
  if ('refus' in lu) return { refus: `étiquetage : ${lu.refus}` }
  if ('horsBase' in lu) return { refus: `hors de la base : ${lu.horsBase}` }
  const meta = lu.meta
  if (meta.confiance !== 3) return { refus: `confiance ${meta.confiance} : seule une question sûre entre dans la base` }
  const aRelire = meta.aRelire.filter(r => r !== 'sensible')
  if (aRelire.length > 0) return { refus: `à relire : ${aRelire.join(', ')}` }
  const ecartee = meta.etiquettes.find(e => ETIQUETTES_ECARTEES.includes(e))
  if (ecartee) return { refus: `étiquette écartée de la campagne : ${ecartee}` }
  // Les leurres : les mauvaises réponses de la question y sont toutes, à
  // l'identique, et la bonne jamais — ils serviront à doser une question.
  const mauvaises = reponses.filter((_, i) => i !== bonne)
  const absente = mauvaises.find(m => !meta.leurres.includes(m))
  if (absente !== undefined) return { refus: `mauvaise réponse absente des leurres (à recopier à l'identique) : ${absente}` }
  if (meta.leurres.some(l => sansAccent(l) === juste)) return { refus: 'la bonne réponse est parmi les leurres' }

  return { question: { id, texte, reponses, bonne, anecdote, meta, empreinte: empreinteDe(texte) } }
}

/** Le nom du fichier d'une catégorie : « Cinéma & séries » → cinema-series.json. */
export function fichierDeCategorie(categorie: string): string {
  return `${sansAccent(categorie)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.json`
}

export interface BaseLue {
  questions: QuestionDeLaBase[]
  /** Ce qui n'a pas pu entrer, et pourquoi : rien, si la base a été rangée par son script. */
  refusees: { fichier: string; position: number; motif: string }[]
}

/** Ce que le serveur relit d'une traite avant de rendre la main : une dizaine de millisecondes. */
export const QUESTIONS_PAR_TRANCHE = 200

/**
 * Lit toute la base, fichier par fichier. Une entrée défectueuse est
 * écartée et dite, jamais jouée ; un identifiant ou un intitulé en double
 * aussi — la première venue reste. D'une traite, pour les scripts ; le
 * serveur passe par `lireLaBaseSansBloquer`.
 */
export function lireLaBase(dossier = DOSSIER_DE_LA_BASE): BaseLue {
  const lecture = lectureDeLaBase(dossier)
  for (;;) {
    const pas = lecture.next()
    if (pas.done) return pas.value
  }
}

/**
 * La même lecture, qui rend la main entre deux tranches. Lue d'un bloc, la
 * base tenait le serveur 0,4 s — bien plus sur le dixième de processeur de
 * l'hébergeur —, et aucune soirée ne recevait rien pendant ce temps : ni
 * question, ni accusé de réponse. Une fois par processus
 * (`BaseDeLaCampagne`), à la première demande.
 */
export async function lireLaBaseSansBloquer(dossier = DOSSIER_DE_LA_BASE): Promise<BaseLue> {
  const lecture = lectureDeLaBase(dossier)
  for (;;) {
    const pas = lecture.next()
    if (pas.done) return pas.value
    await new Promise<void>(rendre => setImmediate(rendre))
  }
}

/** La lecture elle-même : chaque `yield` est un endroit où rendre la main. */
function* lectureDeLaBase(dossier: string): Generator<void, BaseLue> {
  const questions: QuestionDeLaBase[] = []
  const refusees: BaseLue['refusees'] = []
  if (!existsSync(dossier)) return { questions, refusees }
  const ids = new Set<string>()
  const empreintes = new Set<string>()
  const attendus = new Map(CATEGORIES.map(c => [fichierDeCategorie(c), c]))
  for (const fichier of readdirSync(dossier).filter(f => f.endsWith('.json')).sort()) {
    let entrees: unknown
    try {
      entrees = JSON.parse(readFileSync(path.join(dossier, fichier), 'utf8'))
    } catch (e) {
      refusees.push({ fichier, position: -1, motif: `JSON illisible : ${(e as Error).message}` })
      continue
    }
    if (!Array.isArray(entrees)) {
      refusees.push({ fichier, position: -1, motif: 'le fichier doit être un tableau' })
      continue
    }
    for (let position = 0; position < entrees.length; position++) {
      if (position % QUESTIONS_PAR_TRANCHE === 0) yield
      const lu = lireQuestionDeLaBase(entrees[position])
      if ('refus' in lu) {
        refusees.push({ fichier, position, motif: lu.refus })
        continue
      }
      const q = lu.question
      if (attendus.get(fichier) !== q.meta.categorie) refusees.push({ fichier, position, motif: `rangée hors de son fichier (${q.meta.categorie})` })
      else if (ids.has(q.id)) refusees.push({ fichier, position, motif: `identifiant en double : ${q.id}` })
      else if (empreintes.has(q.empreinte)) refusees.push({ fichier, position, motif: `intitulé en double : ${q.texte}` })
      else {
        ids.add(q.id)
        empreintes.add(q.empreinte)
        questions.push(q)
      }
    }
  }
  return { questions, refusees }
}

/**
 * La base en mémoire, indexée : par identifiant, et par empreinte pour la
 * tenir à l'écart de la réserve du quiz du jour. Lue une fois, en fond peu
 * après le démarrage (`PRECHAUFFAGE_CAMPAGNE_MS`, `server.ts`) — ou à la
 * première demande, si elle arrive avant : lue seulement là, elle faisait
 * attendre 3,5 s le premier joueur après chaque déploiement, au dixième de
 * cœur, pour neuf mégaoctets de mémoire.
 */
export class BaseDeLaCampagne {
  readonly questions: readonly QuestionDeLaBase[]
  readonly parId: ReadonlyMap<string, QuestionDeLaBase>
  readonly empreintes: ReadonlySet<string>

  constructor(questions: readonly QuestionDeLaBase[]) {
    this.questions = questions
    this.parId = new Map(questions.map(q => [q.id, q]))
    this.empreintes = new Set(questions.map(q => q.empreinte))
  }

  /** La base du dépôt, lue une fois sans figer le serveur ; ce qu'elle écarte part au journal, une ligne par cause. */
  static async depuisLeDossier(dossier = DOSSIER_DE_LA_BASE): Promise<BaseDeLaCampagne> {
    const { questions, refusees } = await lireLaBaseSansBloquer(dossier)
    if (refusees.length > 0) {
      console.warn(`[campagne] ${refusees.length} question(s) de la base écartée(s) :`)
      for (const r of refusees.slice(0, 10)) console.warn(`  ${r.fichier} #${r.position} — ${r.motif}`)
    }
    return new BaseDeLaCampagne(questions)
  }
}
