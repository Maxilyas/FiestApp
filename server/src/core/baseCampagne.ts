import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SERVEUR } from '../racine'
import { CATEGORIES } from '../../../shared/categories'
import { lireEtiquetage, type MetadonneesDeQuestion } from '../../../shared/etiquettes'
import { MAX_ANECDOTE, MAX_TEXT } from '../../../shared/library'
import { sansAccent } from '../../../shared/homonymes'
// Partagée : l'écran de l'administrateur, qui corrige une question, borne ses champs à la même mesure.
import { MAX_REPONSE } from '../../../shared/campagne'
import { empreinteDe } from './jour'
import { rendreLaMain } from './tourniquet'

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
  /**
   * Sa bonne réponse soufflée par sa racine (`souffleeParSaRacine`), lue avec
   * elle, une fois : sur toute la base, la règle prend 50 ms, qu'un tirage ne
   * doit pas faire attendre. Le quiz tout prêt ne la prend qu'en dernier recours.
   */
  soufflee: boolean
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

const LETTRE = /[\p{L}\p{N}]/u
/** Ce qui suit un nom sans en être : Brueghel l'Ancien, Pline le Jeune. */
const SURNOM = new Set(['ancien', 'jeune', 'aine', 'cadet', 'pere', 'fils', 'jr', 'sr'])
const ARTICLE = new Set(['le', 'la', 'les', "l'", 'l’'])

/**
 * Le nom de famille d'une réponse qui est une personne, quand il la désigne à
 * lui seul : le dernier mot, sans son surnom (« l'Ancien »), d'une capitale
 * et de quatre lettres au moins. Ni un titre — « Claude de France », toutes
 * les reines de la question sont « de » quelque part —, ni un nom de règne :
 * Napoléon II a Napoléon III pour voisin de réponses, et son père dans
 * l'intitulé. Les faits de Wikidata s'en servent aussi : Théo van Gogh ne
 * fait pas un leurre honnête pour Vincent (`scripts/faits-wikidata.ts`).
 */
export function nomDeFamille(reponse: string): string | null {
  const mots = reponse.split(/\s+/)
  if (/^([IVXLC]+|1er|Ier|Ire)$/.test(mots[mots.length - 1])) return null
  while (mots.length > 1) {
    const dernier = sansAccent(mots[mots.length - 1]).replace(/^l['’]/, '')
    if (SURNOM.has(dernier) || ARTICLE.has(dernier)) mots.pop()
    else break
  }
  if (mots.length < 2) return null
  const nom = mots[mots.length - 1]
  const avant = sansAccent(mots[mots.length - 2])
  if (/^d['’]/.test(nom) || avant === 'de' || avant === 'du' || avant === 'des') return null
  return /^\p{Lu}/u.test(nom) && Array.from(nom).length >= 4 ? nom : null
}

/** Ce nom propre est-il écrit tel quel, capitale comprise, en mot entier ? « whistler » en minuscules n'est pas Whistler. */
function nomEcritDans(texte: string, nom: string): boolean {
  for (let i = texte.indexOf(nom); i >= 0; i = texte.indexOf(nom, i + 1)) {
    const avant = texte[i - 1]
    const apres = texte[i + nom.length]
    if ((avant === undefined || !LETTRE.test(avant)) && (apres === undefined || !LETTRE.test(apres))) return true
  }
  return false
}

/** Une racine : les cinq premières lettres d'un mot qui en a cinq au moins (l'heuristique de l'expert du quiz tout prêt). */
const RACINE = 5

/** Les mots d'une question qui ne soufflent rien, quelle que soit la réponse. */
const SANS_INDICE = new Set(['comment', 'combien', 'pourquoi', 'appelle', 'appelee', 'nomme', 'nommee', 'celui', 'celle', 'cette', 'autre', 'entre', 'avant', 'apres', 'depuis', 'pendant', 'plusieurs', 'premier', 'premiere', 'grand', 'grande', 'petit', 'petite'])

/**
 * Les racines que deux mots sans parenté partagent : « roi de France » ne
 * souffle pas François Ier, ni Saint-Jacques Saint-Brieuc, ni « parc
 * national » son nom, ni « superficie » le lac Supérieur — à la mesure de la
 * base, elles faisaient le gros des fausses alertes.
 */
const RACINES_SANS_INDICE = new Set(['franc', 'saint', 'natio', 'madam', 'super'])

/** Les racines d'un texte déjà sans accents ni casse ; `sauf` les écarte. */
function racinesDe(texte: string, sauf: ReadonlySet<string> = new Set()): Set<string> {
  const racines = new Set<string>()
  for (const mot of texte.split(/[^a-z]+/)) {
    const racine = mot.slice(0, RACINE)
    if (mot.length >= RACINE && !SANS_INDICE.has(mot) && !RACINES_SANS_INDICE.has(racine) && !sauf.has(racine)) racines.add(racine)
  }
  return racines
}

/**
 * La réponse que l'intitulé souffle par sa racine — pas écrite, ce que le juge
 * refuse, mais à demi : « Qui a peint *Les Deux Fridas* ? → Frida Kahlo »,
 * « …la reine d'Égypte, Cléopâtre ? → L'Égypte », « une strophe de quatre
 * vers → Un quatrain ». Les racines de cinq lettres que la bonne réponse
 * partage avec l'intitulé et qu'aucun leurre ne partage (l'expert du quiz
 * tout prêt, le 11 octobre 2026 : 1,4 % de la base). Le nom que la question
 * demande n'en est pas une — « Quel studio… ? → Studio Ghibli » ne souffle
 * rien. Pas un refus : une étymologie est souvent voulue, et une sur quatre
 * environ ne souffle rien ; `verifier` avertit, `racines` les liste, et le
 * quiz tout prêt ne les prend qu'en dernier recours.
 */
export function souffleeParSaRacine(q: Pick<QuestionDeLaBase, 'texte' | 'reponses' | 'bonne'>): string[] {
  if (q.reponses.length === 2) return []
  // D'abord ce qui ne coûte presque rien : une racine de la bonne réponse écrite quelque part dans l'intitulé.
  // Lue sur toute la base, la règle entière prenait 200 ms ; elle ne se déroule plus que pour une question sur vingt.
  const bonne = racinesDe(sansAccent(q.reponses[q.bonne]))
  if (bonne.size === 0) return []
  const texte = sansAccent(q.texte)
  if (![...bonne].some(r => texte.includes(r))) return []
  // Le nom que la question demande — « quel studio », « quelle ville », « quel super-héros » —, et ses morceaux.
  const demande = new Set<string>()
  for (const m of texte.matchAll(/\bquel(?:le)?s?\s+([a-z-]+)/g)) {
    for (const mot of m[1].split('-')) if (mot.length >= RACINE) demande.add(mot.slice(0, RACINE))
  }
  const intitule = racinesDe(texte, demande)
  const desLeurres = new Set(q.reponses.flatMap((r, i) => (i === q.bonne ? [] : [...racinesDe(sansAccent(r))])))
  return [...bonne].filter(r => intitule.has(r) && !desLeurres.has(r))
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
  // Le nom de famille trahit une personne aussi bien que son nom entier :
  // « …plus connu sous le nom de La Mère de Whistler » pour James Abbott
  // McNeill Whistler passait, le 10 octobre 2026, et seul le correcteur l'a
  // vu. Seulement quand la réponse est une personne de la question (ses
  // entités) : « France » ou « Noël » dans une réponse ne désignent rien.
  if (!vraiFaux && meta.entites.some(e => (e.type === 'personne' || e.type === 'personnage') && sansAccent(e.nom) === juste)) {
    const nom = nomDeFamille(reponses[bonne])
    if (nom && nomEcritDans(texte, nom)) return { refus: `le nom de la bonne réponse (${nom}) est écrit dans l’intitulé` }
  }
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

  return {
    question: { id, texte, reponses, bonne, anecdote, meta, empreinte: empreinteDe(texte), soufflee: souffleeParSaRacine({ texte, reponses, bonne }).length > 0 },
  }
}

/**
 * Une question telle qu'on la range : la question d'abord, ses métadonnées
 * ensuite, dans l'ordre des fichiers de la base — une relecture de PR s'y
 * fait question par question. Les dépôts de la routine (`campagne_ajouts`)
 * gardent la même forme : on les rapatrierait dans le dépôt sans la changer.
 */
export function entreeDeLaBase(q: QuestionDeLaBase): Record<string, unknown> {
  const m = q.meta
  return {
    id: q.id,
    texte: q.texte,
    reponses: q.reponses,
    bonne: q.bonne,
    anecdote: q.anecdote,
    categorie: m.categorie,
    sousTheme: m.sousTheme,
    etiquettes: m.etiquettes,
    difficulte: m.difficulte,
    ageMin: m.ageMin,
    date: m.date,
    entites: m.entites,
    portee: m.portee,
    valeur: m.valeur,
    leurres: m.leurres,
    dureeDeVie: m.dureeDeVie,
    explication: m.explication,
    source: m.source,
    confiance: m.confiance,
    aRelire: m.aRelire,
  }
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
    await rendreLaMain()
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

// ── La base vérifiée au build ───────────────────────────────────────────────

/**
 * Le fichier de la base vérifiée au build, à côté du serveur empaqueté —
 * `scripts/empaqueter.ts` en pose le nom (`__BASE_PREPAREE__`) ; null sous
 * tsx — `npm run dev`, les tests, les scripts —, qui relisent et vérifient
 * le dossier.
 */
declare const __BASE_PREPAREE__: string | undefined
export const BASE_PREPAREE: string | null =
  typeof __BASE_PREPAREE__ === 'string' ? path.join(path.dirname(fileURLToPath(import.meta.url)), __BASE_PREPAREE__) : null

/** Le format de la base préparée : celle d'un autre format s'écarte, et le dossier se relit et se vérifie. */
const VERSION_DE_LA_BASE_PREPAREE = 1

/** Ce qui dit qu'une base préparée est celle du dossier : chacun de ses fichiers, sa taille et sa date. */
type SignatureDuDossier = { fichier: string; taille: number; modifie: number }[]

function signatureDuDossier(dossier: string): SignatureDuDossier {
  if (!existsSync(dossier)) return []
  return readdirSync(dossier)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(fichier => {
      const s = statSync(path.join(dossier, fichier))
      return { fichier, taille: s.size, modifie: Math.trunc(s.mtimeMs) }
    })
}

/**
 * Vérifie toute la base, une fois, au build (`npm run build`,
 * `scripts/empaqueter.ts`), et la range dans `sortie` : une ligne
 * d'en-tête — son format, la signature du dossier, ce que le juge a écarté
 * —, puis une question par ligne, telle que le juge la rend, empreinte et
 * réponse soufflée comprises.
 */
export function preparerLaBase(sortie: string, dossier = DOSSIER_DE_LA_BASE): BaseLue {
  const signature = signatureDuDossier(dossier)
  const lue = lireLaBase(dossier)
  mkdirSync(path.dirname(sortie), { recursive: true })
  const entete = { version: VERSION_DE_LA_BASE_PREPAREE, signature, refusees: lue.refusees }
  writeFileSync(sortie, `${[entete, ...lue.questions].map(x => JSON.stringify(x)).join('\n')}\n`)
  return lue
}

/**
 * La base préparée au build, relue telle quelle : le juge ne repasse pas.
 * Il prenait 1,3 s de processeur à chaque réveil — treize secondes de
 * serveur saturé au dixième de cœur de l'hébergeur, trois à onze fois par
 * jour (le banc du 16 octobre 2026) —, pour une base qui n'a pas changé
 * depuis le build. Lue au fil du fichier, une ligne après l'autre : un seul
 * `JSON.parse` de ses vingt-cinq mégaoctets figerait le serveur deux
 * secondes, quand la lecture rend la main à chaque bloc du fichier. Écartée,
 * avec son motif, quand elle manque, ne se lit pas, ou ne dit plus le
 * dossier — un fichier de la base qui a changé depuis le build : le dossier
 * se relit alors et se vérifie.
 */
export async function lireLaBasePreparee(fichier: string, dossier = DOSSIER_DE_LA_BASE): Promise<{ lue: BaseLue } | { motif: string }> {
  if (!existsSync(fichier)) return { motif: 'absente' }
  // Des morceaux de 64 Ko, une soixantaine de questions : quelques
  // millisecondes chacun, la boucle reprend la main entre deux.
  const flux = createReadStream(fichier, { encoding: 'utf8', highWaterMark: 64 * 1024 })
  let refusees: BaseLue['refusees'] | null = null
  const questions: QuestionDeLaBase[] = []
  /** Une ligne : l'en-tête d'abord, puis une question ; un motif, quand l'en-tête l'écarte. */
  const lire = (ligne: string): string | null => {
    if (!ligne) return null
    if (refusees) {
      questions.push(JSON.parse(ligne) as QuestionDeLaBase)
      return null
    }
    const entete = JSON.parse(ligne) as { version?: unknown; signature?: unknown; refusees?: BaseLue['refusees'] }
    if (entete.version !== VERSION_DE_LA_BASE_PREPAREE) return `format ${String(entete.version)}`
    if (JSON.stringify(entete.signature) !== JSON.stringify(signatureDuDossier(dossier))) return 'le dossier a changé depuis le build'
    refusees = entete.refusees ?? []
    return null
  }
  try {
    let reste = ''
    for await (const morceau of flux as AsyncIterable<string>) {
      const texte = reste + morceau
      let debut = 0
      for (let fin = texte.indexOf('\n'); fin >= 0; fin = texte.indexOf('\n', debut)) {
        const motif = lire(texte.slice(debut, fin))
        if (motif) return { motif }
        debut = fin + 1
      }
      reste = texte.slice(debut)
    }
    const motif = lire(reste)
    if (motif) return { motif }
    return refusees ? { lue: { questions, refusees } } : { motif: 'vide' }
  } catch (e) {
    return { motif: `illisible : ${(e as Error).message}` }
  } finally {
    flux.destroy()
  }
}

/**
 * La base en mémoire, indexée : par identifiant, et par empreinte pour la
 * tenir à l'écart de la réserve du quiz du jour. Lue une fois, en fond peu
 * après le démarrage (`PRECHAUFFAGE_CAMPAGNE_MS`, `server.ts`) — ou à la
 * première demande, si elle arrive avant : lue seulement là, elle faisait
 * attendre 3,5 s le premier joueur après chaque déploiement, au dixième de
 * cœur, pour neuf mégaoctets de mémoire. Le serveur empaqueté la relit
 * vérifiée au build (`BASE_PREPAREE`).
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

  /**
   * La base du dépôt, lue une fois sans figer le serveur — vérifiée au build
   * quand `preparee` la donne, sinon relue et vérifiée ; ce qu'elle écarte
   * part au journal, une ligne par cause.
   */
  static async depuisLeDossier(dossier = DOSSIER_DE_LA_BASE, preparee: string | null = BASE_PREPAREE): Promise<BaseDeLaCampagne> {
    let lue: BaseLue | null = null
    if (preparee) {
      const debut = performance.now()
      const relue = await lireLaBasePreparee(preparee, dossier)
      if ('motif' in relue) console.warn(`[campagne] base préparée écartée (${relue.motif}) : le dossier se relit et se vérifie`)
      else {
        lue = relue.lue
        console.log(`[campagne] base préparée relue : ${lue.questions.length} questions en ${Math.round(performance.now() - debut)} ms`)
      }
    }
    const { questions, refusees } = lue ?? (await lireLaBaseSansBloquer(dossier))
    if (refusees.length > 0) {
      console.warn(`[campagne] ${refusees.length} question(s) de la base écartée(s) :`)
      for (const r of refusees.slice(0, 10)) console.warn(`  ${r.fichier} #${r.position} — ${r.motif}`)
    }
    // Ses index, vingt millisecondes sur toute la base, à leur tour de boucle
    // (`rendreLaMain`) : pas derrière le dernier morceau du fichier.
    await rendreLaMain()
    return new BaseDeLaCampagne(questions)
  }
}
