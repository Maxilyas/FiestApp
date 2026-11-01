// La traversée du Cabinet : trois actes, trois gardiens, une partie d'une
// vingtaine de minutes qui se reprend où on l'a laissée (le propriétaire, le
// 31 octobre 2026 — « Je veux pouvoir faire des parties. Chaque partie est
// différente », puis « il ne faut pas choisir de carte pendant le jeu,
// uniquement améliorer les cartes que l'on a choisies au début » ; la
// maquette jouée, `retours/2026-10-31/la-partie.md`).
//
// Quatre notions, pas une de plus : les cœurs, l'or, tes cartes, la carte.
// Toute idée future passe par l'une des quatre ou n'entre pas — c'est le
// garde-fou contre l'empilement qui a noyé l'Expédition puis le musée.
//
// Une étape de la carte est une partie ordinaire du Cabinet, trois manches
// d'un des dix jeux (`partie.ts`, l'origine `traversee`) : le pli, le chrono,
// les tireurs et la révélation n'apprennent rien. La traversée ne fait que
// lire ses étoiles — chaque étoile vaut de l'or, chaque manche ratée coûte un
// cœur, chaque étoile frappe le gardien — et ce que ses cartes y changent.
//
// Ici, pur : le catalogue des dix cartes et des gardiens, la carte de trois
// actes tracée au départ, les gestes et le pli qui les relit (comme une
// partie : un départ figé, des gestes, invariant 14), la seule règle des
// refus — le serveur l'applique avant d'écrire, la vue la porte, la page n'en
// recopie rien. Le serveur écrit deux gestes lui-même : `epreuve`, la partie
// qu'une étape commence, et `conclure`, les étoiles qu'elle a rendues — un
// fait de la partie finie, figé dans le journal de la traversée pour que la
// traversée se relise sans rejouer ses vingt parties.

import {
  ACTES_D_UNE_TRAVERSEE,
  CARTES_D_UNE_TRAVERSEE,
  CHANGEMENTS_PAR_PARTIE,
  CHEMINS_D_UNE_RANGEE,
  COEURS_DE_DEPART,
  COEURS_DE_LA_PANACEE,
  COEURS_DU_SECOND_SOUFFLE,
  COEURS_D_UNE_MISE_PERDUE,
  ECLAIRAGES_PAR_PARTIE,
  EPREUVES_D_UN_JEU_MAX,
  ERREURS_PAREES,
  MANCHES_PAR_PARTIE,
  MARCHES_DES_ACTES,
  MARCHES_DES_GARDIENS,
  MISES_PAR_EPREUVE,
  MULTIPLICATEUR_DE_LA_MISE,
  OR_DE_LA_CAGNOTTE,
  OR_D_UN_GARDIEN,
  OR_PAR_ETOILE,
  OR_SANS_AMELIORATION,
  PARADE_CONTRE_LES_GARDIENS,
  NIVEAU_OFFERT,
  PRIX_DU_MARCHAND,
  PRIX_MIN,
  PV_DES_GARDIENS,
  PV_DU_COUP_DE_GRACE,
  RANGEES_D_UN_ACTE,
  RANGEE_DU_COFFRE,
  REMISE_DU_POURBOIRE,
  SECONDES_PAR_FORCE,
  THEMES_AU_CHOIX_DU_QUIZ,
} from './bareme'
import type { Niveau } from '../campagne'
import { CATEGORIES, type Categorie } from '../categories'
import { jourValide } from '../jour'
import type { Sujet } from '../sujets'
import { auHasard, battre } from './jeux/outils'
import { CLES_DES_JEUX, JEUX, type CleDeJeu } from './jeux/regle'
import type { CarteDuDepart } from './partie'
import type { CleDePouvoir, Force } from './pouvoirs'

// ── Les dix cartes ────────────────────────────────────────────────────────

export type CleDeCarte =
  | 'coup-d-oeil'
  | 'echange'
  | 'quitte-ou-double'
  | 'concentration'
  | 'parade'
  | 'cagnotte'
  | 'panacee'
  | 'pourboire'
  | 'coup-de-grace'
  | 'second-souffle'

/** À jouer d'un geste dans une manche ; toujours active ; une fois par traversée. */
export type SorteDeCarte = 'a-jouer' | 'toujours' | 'une-fois'

/** Le niveau d'une carte : la carte, la carte +, la carte ++ — la force de son pouvoir, quand elle en a un. */
export type NiveauDeCarte = Force
export const NIVEAU_MAX: NiveauDeCarte = 3

export interface CarteDeLaTraversee {
  cle: CleDeCarte
  nom: string
  sorte: SorteDeCarte
  /** Le pouvoir qu'elle joue dans une manche (`partie.ts`) ; null : elle agit sur la traversée — l'or, les cœurs, le gardien. */
  pouvoir: CleDePouvoir | null
  /** Ce qu'elle fait à ce niveau, en une phrase : le choix du départ, l'amélioration, la partie la disent. */
  dit: (niveau: NiveauDeCarte) => string
}

const FOIS = ['', 'Une fois', 'Deux fois', 'Trois fois'] as const
const unOuDes = (n: number, un: string, des: string) => `${n} ${n > 1 ? des : un}`

/**
 * Les dix : les quatre pouvoirs du Cabinet qui jouent dans une manche, la
 * Parade, et cinq cartes qui jouent sur la traversée. Les peintures sont
 * celles des cartes du même nom (`client/public/cartes/`). Chaque phrase se
 * compose des chiffres du barème, jamais écrits à la main.
 */
export const CARTES: readonly CarteDeLaTraversee[] = [
  {
    cle: 'coup-d-oeil',
    nom: 'Coup d’œil',
    sorte: 'a-jouer',
    pouvoir: 'eclairer',
    dit: n => `${FOIS[ECLAIRAGES_PAR_PARTIE[n]] ?? `${ECLAIRAGES_PAR_PARTIE[n]} fois`} par épreuve : un indice sur la manche en cours.`,
  },
  {
    cle: 'echange',
    nom: 'Échange',
    sorte: 'a-jouer',
    pouvoir: 'changer',
    dit: n => `${FOIS[CHANGEMENTS_PAR_PARTIE[n]] ?? `${CHANGEMENTS_PAR_PARTIE[n]} fois`} par épreuve : une autre manche du même jeu, avant de répondre.`,
  },
  {
    cle: 'quitte-ou-double',
    nom: 'Quitte ou double',
    sorte: 'a-jouer',
    pouvoir: 'miser',
    dit: n =>
      `${FOIS[MISES_PAR_EPREUVE[n]]} par épreuve, mise sur une manche avant de la voir : réussie, son or ${MULTIPLICATEUR_DE_LA_MISE[n] === 2 ? 'double' : 'triple'} ; ratée, elle coûte ${COEURS_D_UNE_MISE_PERDUE} cœurs.`,
  },
  { cle: 'concentration', nom: 'Concentration', sorte: 'toujours', pouvoir: 'temps', dit: n => `${SECONDES_PAR_FORCE * n} secondes de plus à chaque manche.` },
  {
    cle: 'parade',
    nom: 'Parade',
    sorte: 'toujours',
    pouvoir: null,
    dit: n =>
      `${ERREURS_PAREES[n] > 1 ? `Tes ${ERREURS_PAREES[n]} premières manches ratées` : 'Ta première manche ratée'} de chaque épreuve ${ERREURS_PAREES[n] > 1 ? 'ne coûtent' : 'ne coûte'} pas de cœur${n >= PARADE_CONTRE_LES_GARDIENS ? ', contre les gardiens aussi' : ' (pas contre les gardiens)'}.`,
  },
  { cle: 'cagnotte', nom: 'Cagnotte', sorte: 'toujours', pouvoir: null, dit: n => `${OR_DE_LA_CAGNOTTE[n]} pièces de plus à chaque manche réussie.` },
  { cle: 'panacee', nom: 'Panacée', sorte: 'toujours', pouvoir: null, dit: n => `${unOuDes(COEURS_DE_LA_PANACEE[n], 'cœur', 'cœurs')} de plus au maximum.` },
  { cle: 'pourboire', nom: 'Pourboire', sorte: 'toujours', pouvoir: null, dit: n => `Le marchand te fait ${REMISE_DU_POURBOIRE[n]} pièces de remise sur chaque achat.` },
  { cle: 'coup-de-grace', nom: 'Coup de grâce', sorte: 'toujours', pouvoir: null, dit: n => `Chaque gardien commence avec ${PV_DU_COUP_DE_GRACE[n]} points de vie en moins.` },
  {
    cle: 'second-souffle',
    nom: 'Second souffle',
    sorte: 'une-fois',
    pouvoir: null,
    dit: n => {
      const c = COEURS_DU_SECOND_SOUFFLE[n]
      return `Une fois par traversée : à ton dernier cœur perdu, tu te relèves avec ${c === null ? 'tous tes cœurs' : unOuDes(c, 'cœur', 'cœurs')}.`
    },
  },
]

export const CLES_DES_CARTES: readonly CleDeCarte[] = CARTES.map(c => c.cle)
const PAR_CLE = new Map(CARTES.map(c => [c.cle as string, c]))

/** Une carte par sa clé, venue du téléphone ou de la base : par une `Map`, jamais `TABLE[cle]` — un objet répond aussi de son prototype. */
export const carteDeLaTraversee = (cle: unknown): CarteDeLaTraversee | null => (typeof cle === 'string' ? (PAR_CLE.get(cle) ?? null) : null)

/** Ce que dit sa sorte, sous son nom. */
export const SORTES_DITES: Readonly<Record<SorteDeCarte, string>> = { 'a-jouer': 'À jouer', toujours: 'Toujours active', 'une-fois': 'Une fois' }

/** « Coup d’œil », « Coup d’œil + », « Coup d’œil ++ » — une espace insécable : le signe ne passe jamais seul à la ligne. */
export const nomAuNiveau = (c: Pick<CarteDeLaTraversee, 'nom'>, niveau: NiveauDeCarte): string => `${c.nom}${niveau === 1 ? '' : niveau === 2 ? ' +' : ' ++'}`

// ── Les gardiens ──────────────────────────────────────────────────────────

/**
 * Un gardien : un légendaire, sa devise, et ses trois jeux, joués à tour de
 * rôle d'un assaut à l'autre. Jamais la Frise : elle se construit sur trois
 * manches, et un assaut s'arrête à la chute du gardien. Aucun Divin
 * (invariant 21). Son nom vient de son légendaire (`legendaire()`,
 * `shared/legendaires.ts`) : la page le lit là, une seule copie.
 */
export interface GardienDeLaTraversee {
  cle: string
  devise: string
  jeux: readonly [CleDeJeu, CleDeJeu, CleDeJeu]
}

export const GARDIENS_DE_LA_TRAVERSEE: readonly GardienDeLaTraversee[] = [
  { cle: 'lg:renard', devise: 'Il ment avec aplomb. Démêle le vrai du faux.', jeux: ['eclair', 'pari', 'replique'] },
  { cle: 'lg:coq', devise: 'Premier levé, premier à répondre.', jeux: ['eclair', 'filet', 'pari'] },
  // Le Quiz, venu le 1er novembre 2026, chez trois gardiens qui posent des questions : la Chouette, le Sphinx, le Kraken. Un
  // assaut lit ses jeux à son heure : une traversée en route y passe à l'assaut d'après.
  { cle: 'lg:chouette', devise: 'Elle a tout lu, et elle s’en souvient.', jeux: ['mot', 'indices', 'quiz'] },
  { cle: 'lg:tigre', devise: 'Il frappe vite. Ne traîne pas.', jeux: ['eclair', 'pari', 'filet'] },
  { cle: 'lg:chauve-souris', devise: 'Elle voit dans le noir ce que tu cherches.', jeux: ['detail', 'mot', 'eclair'] },
  { cle: 'lg:scarabee', devise: 'Il garde les lieux anciens.', jeux: ['epingle', 'detail', 'indices'] },
  { cle: 'lg:citrouille', devise: 'Ce soir, c’est sa fête.', jeux: ['mot', 'eclair', 'replique'] },
  { cle: 'lg:sphinx', devise: 'Il ne laisse passer que ceux qui savent.', jeux: ['quiz', 'indices', 'mot'] },
  { cle: 'lg:janus', devise: 'Deux visages : l’un dit vrai, l’autre ment.', jeux: ['eclair', 'replique', 'indices'] },
  { cle: 'lg:phenix', devise: 'Il renaît de ses cendres. Toi, de tes erreurs.', jeux: ['pari', 'filet', 'detail'] },
  { cle: 'lg:fantome', devise: 'Il hante les tableaux et les vieux films.', jeux: ['detail', 'replique', 'indices'] },
  { cle: 'lg:salamandre', devise: 'Elle joue avec le feu, et avec les chiffres.', jeux: ['filet', 'pari', 'eclair'] },
  { cle: 'lg:lion', devise: 'Il règne sur la carte de France.', jeux: ['epingle', 'pari', 'indices'] },
  { cle: 'lg:oracle', devise: 'Il connaît les dates avant qu’elles arrivent.', jeux: ['filet', 'eclair', 'indices'] },
  { cle: 'lg:serpent', devise: 'Il glisse un mot faux dans chaque phrase.', jeux: ['mot', 'eclair', 'pari'] },
  { cle: 'lg:dragon', devise: 'Il garde son or. Prends-le-lui.', jeux: ['pari', 'filet', 'epingle'] },
  { cle: 'lg:kraken', devise: 'Il remonte des abysses avec ses questions.', jeux: ['epingle', 'filet', 'quiz'] },
  { cle: 'lg:chimere', devise: 'Trois têtes, trois jeux, aucune pitié.', jeux: ['detail', 'mot', 'epingle'] },
  { cle: 'lg:ouroboros', devise: 'Tout revient. Surtout les erreurs.', jeux: ['filet', 'eclair', 'replique'] },
  { cle: 'lg:trou-noir', devise: 'Rien ne lui échappe, pas même la lumière.', jeux: ['filet', 'detail', 'mot'] },
  { cle: 'lg:comete', devise: 'Elle ne passe qu’une fois. Ne la rate pas.', jeux: ['epingle', 'filet', 'eclair'] },
]

const GARDIEN_PAR_CLE = new Map(GARDIENS_DE_LA_TRAVERSEE.map(g => [g.cle, g]))
export const gardienDeLaTraversee = (cle: unknown): GardienDeLaTraversee | null => (typeof cle === 'string' ? (GARDIEN_PAR_CLE.get(cle) ?? null) : null)

/** Les gardiens de chaque acte, du plus doux au plus redoutable ; la Citrouille ne garde l'acte I qu'à Halloween. */
export const GARDIENS_DES_ACTES: readonly (readonly string[])[] = [
  ['lg:renard', 'lg:coq', 'lg:chouette', 'lg:tigre', 'lg:chauve-souris', 'lg:scarabee'],
  ['lg:sphinx', 'lg:janus', 'lg:phenix', 'lg:fantome', 'lg:salamandre', 'lg:lion', 'lg:oracle', 'lg:serpent'],
  ['lg:dragon', 'lg:kraken', 'lg:chimere', 'lg:ouroboros', 'lg:trou-noir', 'lg:comete'],
]
export const GARDIEN_D_HALLOWEEN = 'lg:citrouille'

/**
 * Les trois gardiens d'une traversée, un par acte : ceux qu'il n'a pas encore
 * d'abord — l'un d'eux sera à lui au bout, et « qu'est-ce qu'on gagne ? » a sa
 * réponse avant le premier geste. Tous déjà à lui, l'acte en tire un quand
 * même : la traversée se joue pour elle-même. À Halloween, la Citrouille garde
 * l'acte I une fois sur deux, si elle lui manque.
 */
export function choisirLesGardiens(hasard: () => number, possedes: ReadonlySet<string>, halloween: boolean): [string, string, string] {
  const un = (liste: readonly string[]) => {
    const neufs = liste.filter(g => !possedes.has(g))
    const parmi = neufs.length > 0 ? neufs : liste
    return parmi[Math.min(parmi.length - 1, Math.floor(hasard() * parmi.length))]
  }
  const premier = halloween && !possedes.has(GARDIEN_D_HALLOWEEN) && hasard() < 0.5 ? GARDIEN_D_HALLOWEEN : un(GARDIENS_DES_ACTES[0])
  return [premier, un(GARDIENS_DES_ACTES[1]), un(GARDIENS_DES_ACTES[2])]
}

// ── Les actes et leurs thèmes ─────────────────────────────────────────────

export type Acte = 0 | 1 | 2

/** Trois lieux du Cabinet, trois lumières : la carte 3D les teinte, l'annonce de chaque acte les nomme. */
export const ACTES: readonly { court: string; nom: string; teinte: number }[] = [
  { court: 'Acte I', nom: 'La Serre aux merveilles', teinte: 152 },
  { court: 'Acte II', nom: 'La Bibliothèque engloutie', teinte: 262 },
  { court: 'Acte III', nom: 'L’Observatoire', teinte: 32 },
]

/** Le thème que trois jeux portent d'eux-mêmes : leur contenu n'a qu'une sorte. */
export const THEMES_FIXES: Readonly<Partial<Record<CleDeJeu, string>>> = { detail: 'Peinture', indices: 'Personnages célèbres', replique: 'Répliques cultes' }

/** Les jeux qui tirent des questions de la base, sur l'une de ses douze catégories. */
const JEUX_DE_LA_BASE: readonly CleDeJeu[] = ['pari', 'eclair', 'mot', 'filet']

export const EMOJI_DES_JEUX: Readonly<Record<CleDeJeu, string>> = {
  pari: '🎲',
  eclair: '⚡',
  mot: '🔤',
  filet: '🎯',
  detail: '🖼️',
  frise: '⏳',
  epingle: '📍',
  indices: '🕵️',
  replique: '🎬',
  quiz: '❓',
}

const EMOJI_DES_CATEGORIES: Readonly<Record<Categorie, string>> = {
  'Culture générale': '🧠',
  Histoire: '🏰',
  Géographie: '🌍',
  Sciences: '🔬',
  Nature: '🌿',
  'Cinéma & séries': '🎬',
  Musique: '🎵',
  'Arts & lettres': '🎨',
  Sport: '⚽',
  Cuisine: '🍳',
  'Jeux & pop culture': '🎮',
  'Autour de la fête': '🎉',
}

/**
 * L'emoji d'un thème : sa catégorie ; celui que la carte a gardé pour un sujet
 * du Quiz (`EtapeDeLaCarte.emoji`) ; sinon celui de son jeu — une frise, un
 * lieu, un tableau.
 */
export function emojiDuTheme(jeu: CleDeJeu, theme: string, emoji?: string): string {
  const categorie = CATEGORIES.find(c => c === theme)
  if (categorie) return EMOJI_DES_CATEGORIES[categorie]
  if (emoji) return emoji
  return jeu === 'indices' ? '👤' : jeu === 'replique' ? '💬' : jeu === 'detail' ? '🎨' : jeu === 'frise' ? '📜' : jeu === 'quiz' ? '❓' : '🗺️'
}

/** L'emoji d'une famille de sujets, sur la carte du Quiz : une fête, un thème, un univers, un pays, une époque, un fil rouge. */
const EMOJI_DES_FAMILLES: Readonly<Partial<Record<Sujet['famille'], string>>> = {
  fete: '🎉',
  theme: '🧩',
  univers: '🌌',
  pays: '🧭',
  epoque: '🕰️',
  fil: '🧵',
}

/**
 * L'emoji d'un sujet de la base que le Quiz promet : celui de sa famille, et
 * celui de sa catégorie pour une rubrique — « 🍳 Techniques et vocabulaire » se
 * lit en cuisine. Le serveur le pose sur la carte (`ThemeDuQuiz.emoji`) : la
 * page n'importe pas les sujets pour un emoji.
 */
export const emojiDUnSujet = (s: Pick<Sujet, 'famille' | 'categorie'>): string =>
  (s.famille === 'rubrique' && s.categorie ? EMOJI_DES_CATEGORIES[s.categorie] : EMOJI_DES_FAMILLES[s.famille]) ?? EMOJI_DES_JEUX.quiz

/** La catégorie que vise une étape, si son thème en est une : le tireur la cherche d'abord. */
export const categorieDuTheme = (theme: string | undefined): Categorie | null => CATEGORIES.find(c => c === theme) ?? null

// ── La carte ──────────────────────────────────────────────────────────────

export type SorteDEtape = 'depart' | 'epreuve' | 'coffre' | 'marchand' | 'gardien'

/**
 * Une étape de la carte : `a<acte>r<rangée>c<colonne>`. La rangée 0 est le
 * départ de l'acte, les rangées 1 à 3 ses épreuves (un coffre à la deuxième),
 * la 4 le marchand, la 5 le gardien. Une épreuve porte son jeu et son thème,
 * vus d'avance : choisir son chemin, c'est choisir à quoi l'on joue.
 */
export interface EtapeDeLaCarte {
  id: string
  rangee: number
  colonne: number
  sorte: SorteDEtape
  jeu?: CleDeJeu
  theme?: string
  /** Au Quiz, le sujet ou la rubrique de la base que le thème nomme (`animaux`, `sport/football`) : le tirage le vise. */
  sujet?: string
  /** … et son emoji, que le serveur a choisi (`emojiDUnSujet`). */
  emoji?: string
  /**
   * Au Quiz, les thèmes au choix (`THEMES_AU_CHOIX_DU_QUIZ`) : il en choisit un en y entrant, et l'étape n'a alors ni
   * thème, ni sujet, ni emoji à elle (`themeDeLEtape`). Une carte tracée avant le 1er novembre 2026 n'en a pas.
   */
  choix?: readonly ThemeAuChoix[]
  suivantes: readonly string[]
}

/** Un thème qu'une épreuve du Quiz propose au choix : son nom, et au besoin le sujet de la base qu'il nomme et son emoji. */
export interface ThemeAuChoix {
  theme: string
  sujet?: string
  emoji?: string
}

/**
 * Le thème d'une étape : le sien, ou celui qu'il a choisi parmi ses thèmes au choix — le premier tant qu'il n'a rien
 * choisi, la carte d'un rendu ou d'un test écrite à la main. Null : un jeu sans thème.
 */
export function themeDeLEtape(e: Pick<EtapeDeLaCarte, 'theme' | 'sujet' | 'emoji' | 'choix'>, choisi?: number): ThemeAuChoix | null {
  if (e.choix && e.choix.length > 0) return e.choix[choisi ?? 0] ?? e.choix[0]
  if (e.theme === undefined) return null
  return { theme: e.theme, ...(e.sujet !== undefined && { sujet: e.sujet }), ...(e.emoji !== undefined && { emoji: e.emoji }) }
}

export interface ActeDeLaCarte {
  gardien: string
  etapes: readonly EtapeDeLaCarte[]
}

export const RANGEE_DU_MARCHAND = RANGEES_D_UN_ACTE + 1
export const RANGEE_DU_GARDIEN = RANGEES_D_UN_ACTE + 2
const MILIEU = Math.floor(CHEMINS_D_UNE_RANGEE / 2)
export const idDEtape = (acte: number, rangee: number, colonne: number) => `a${acte}r${rangee}c${colonne}`
export const departDeLActe = (acte: number) => idDEtape(acte, 0, MILIEU)
/** L'acte d'une étape, lu dans son identifiant. */
export const acteDe = (etape: string): Acte => Math.min(ACTES_D_UNE_TRAVERSEE - 1, Math.max(0, Number(etape[1]) || 0)) as Acte

/** Un thème que le Quiz peut promettre, au-delà des catégories : un sujet ou une rubrique de la base, assez fourni. */
export interface ThemeDuQuiz {
  cle: string
  nom: string
  famille: Sujet['famille']
  emoji: string
}

/**
 * Ce que le contenu écrit à la main offre de thèmes : le serveur les lit au
 * départ (`contenuDuCabinet`) ; et les sujets et les rubriques de la base où
 * le Quiz a de quoi jouer (`themesDuQuiz`) — sans eux, il ne promet que des
 * catégories.
 */
export interface ThemesDuContenu {
  epingle: readonly string[]
  frise: readonly string[]
  quiz?: readonly ThemeDuQuiz[]
}

/** Ce qu'une traversée a déjà placé : les jeux les moins vus d'abord, et un thème du contenu jamais deux fois. */
interface Usage {
  jeux: Map<CleDeJeu, number>
  categories: Map<string, number>
  contenus: Set<string>
}

/** Les jeux d'une rangée : jamais deux fois le même, les moins placés de la traversée d'abord, au hasard entre égaux. */
function jeuxDUneRangee(n: number, usage: Usage, jeux: readonly CleDeJeu[], hasard: () => number): CleDeJeu[] {
  const compte = (j: CleDeJeu) => usage.jeux.get(j) ?? 0
  const dispo = jeux.filter(j => compte(j) < (EPREUVES_D_UN_JEU_MAX[j] ?? Infinity))
  const pris = battre(dispo.length >= n ? dispo : jeux, hasard)
    .sort((a, b) => compte(a) - compte(b))
    .slice(0, n)
  for (const j of pris) usage.jeux.set(j, compte(j) + 1)
  return battre(pris, hasard)
}

/** Ce qu'une épreuve promet : son thème en mots, et au Quiz le sujet de la base qu'il nomme et son emoji — ou ses thèmes au choix. */
type ThemeDUneEpreuve = Pick<EtapeDeLaCarte, 'theme' | 'sujet' | 'emoji' | 'choix'>

/**
 * Un thème du Quiz : une famille d'abord — les catégories, puis chaque famille
 * de sujets que le serveur a trouvée assez fournie (les thèmes, les époques,
 * les pays, les univers, les fêtes, les fils rouges, les rubriques) —, puis
 * l'un des siens, au hasard. Tirés d'un seul tas, les quelque cent rubriques
 * auraient fait presque toutes les épreuves ; famille par famille, la carte
 * varie (« pour donner de la diversité », le propriétaire, le 1er novembre
 * 2026). Jamais deux fois le même dans une traversée, ni la catégorie d'une
 * voisine ; une famille déjà proposée à la même étape (`prises`) passe après
 * les autres.
 */
function themeDuQuiz(
  usage: Usage,
  voisins: readonly (string | undefined)[],
  contenu: ThemesDuContenu,
  hasard: () => number,
  prises: Set<string>,
): ThemeAuChoix {
  const libre = (cle: string) => !usage.contenus.has(`quiz:${cle}`)
  const familles = new Map<string, ThemeDuQuiz[]>()
  for (const s of (contenu.quiz ?? []).filter(s => libre(s.cle))) familles.set(s.famille, [...(familles.get(s.famille) ?? []), s])
  const categories = CATEGORIES.filter(c => !voisins.includes(c) && libre(c))
  const toutes = [...(categories.length > 0 ? ['categorie'] : []), ...familles.keys()]
  const neuves = toutes.filter(f => !prises.has(f))
  const famille = auHasard(neuves.length > 0 ? neuves : toutes, hasard)
  const siens = famille === undefined ? undefined : familles.get(famille)
  if (!siens) {
    prises.add('categorie')
    const c = auHasard(categories.length > 0 ? categories : CATEGORIES.filter(x => !voisins.includes(x)), hasard)
    usage.contenus.add(`quiz:${c}`)
    return { theme: c }
  }
  prises.add(famille!)
  const s = auHasard(siens, hasard)
  usage.contenus.add(`quiz:${s.cle}`)
  return { theme: s.nom, sujet: s.cle, emoji: s.emoji }
}

/**
 * Les thèmes au choix d'une épreuve du Quiz (`THEMES_AU_CHOIX_DU_QUIZ`), chacun
 * d'une autre famille tant qu'il en reste : un choix entre trois rubriques du
 * football n'en serait pas un. Choisir son thème, c'est choisir ce qu'on sait.
 */
function choixDuQuiz(usage: Usage, voisins: readonly (string | undefined)[], contenu: ThemesDuContenu, hasard: () => number): ThemeAuChoix[] {
  const prises = new Set<string>()
  const choix: ThemeAuChoix[] = []
  for (let k = 0; k < THEMES_AU_CHOIX_DU_QUIZ; k++) choix.push(themeDuQuiz(usage, [...voisins, ...choix.map(c => c.theme)], contenu, hasard, prises))
  return choix
}

/** Le thème d'une épreuve : celui de son jeu, un thème du contenu encore libre, celui du Quiz, ou une catégorie que ses voisines n'ont pas. */
function themeDUneEpreuve(jeu: CleDeJeu, usage: Usage, voisins: readonly (string | undefined)[], contenu: ThemesDuContenu, hasard: () => number): ThemeDUneEpreuve {
  const fixe = THEMES_FIXES[jeu]
  if (fixe) return { theme: fixe }
  if (jeu === 'epingle' || jeu === 'frise') {
    const tous = contenu[jeu]
    if (tous.length === 0) return {}
    const libres = tous.filter(t => !usage.contenus.has(t))
    const t = battre(libres.length > 0 ? libres : tous, hasard)[0]
    usage.contenus.add(t)
    return { theme: t }
  }
  if (jeu === 'quiz') return { choix: choixDuQuiz(usage, voisins, contenu, hasard) }
  if (!JEUX_DE_LA_BASE.includes(jeu)) return {}
  const compte = (c: string) => usage.categories.get(c) ?? 0
  const libres = CATEGORIES.filter(c => !voisins.includes(c))
  const c = battre(libres, hasard).sort((a, b) => compte(a) - compte(b))[0]
  usage.categories.set(c, compte(c) + 1)
  return { theme: c }
}

/**
 * La carte d'un acte : le départ, trois rangées de trois étapes (dont un
 * coffre à la deuxième), le marchand, le gardien. Chaque chemin file tout
 * droit ; entre deux voisins, une diagonale au plus, dans un sens ou dans
 * l'autre — deux qui se croiseraient n'existent jamais, et la carte se lit
 * d'un coup d'œil.
 */
function tracerUnActe(acte: number, gardien: string, usage: Usage, contenu: ThemesDuContenu, jeux: readonly CleDeJeu[], hasard: () => number): ActeDeLaCarte {
  const suivantes = new Map<string, string[]>()
  const lier = (de: string, vers: string) => suivantes.set(de, [...(suivantes.get(de) ?? []), vers])
  const colonnes = Array.from({ length: CHEMINS_D_UNE_RANGEE }, (_, c) => c)
  const depart = departDeLActe(acte)
  for (const c of colonnes) lier(depart, idDEtape(acte, 1, c))
  for (let r = 1; r < RANGEES_D_UN_ACTE; r++) {
    for (const c of colonnes) lier(idDEtape(acte, r, c), idDEtape(acte, r + 1, c))
    for (let c = 0; c + 1 < CHEMINS_D_UNE_RANGEE; c++) {
      const t = hasard()
      if (t < 0.38) lier(idDEtape(acte, r, c), idDEtape(acte, r + 1, c + 1))
      else if (t < 0.76) lier(idDEtape(acte, r, c + 1), idDEtape(acte, r + 1, c))
    }
  }
  const marchand = idDEtape(acte, RANGEE_DU_MARCHAND, MILIEU)
  const auGardien = idDEtape(acte, RANGEE_DU_GARDIEN, MILIEU)
  for (const c of colonnes) lier(idDEtape(acte, RANGEES_D_UN_ACTE, c), marchand)
  lier(marchand, auGardien)
  const coffre = Math.min(CHEMINS_D_UNE_RANGEE - 1, Math.floor(hasard() * CHEMINS_D_UNE_RANGEE))
  const etapes: EtapeDeLaCarte[] = [{ id: depart, rangee: 0, colonne: MILIEU, sorte: 'depart', suivantes: suivantes.get(depart) ?? [] }]
  for (let r = 1; r <= RANGEES_D_UN_ACTE; r++) {
    const epreuves = colonnes.filter(c => !(r === RANGEE_DU_COFFRE && c === coffre))
    const sesJeux = jeuxDUneRangee(epreuves.length, usage, jeux, hasard)
    const themes: (string | undefined)[] = []
    for (const c of colonnes) {
      const id = idDEtape(acte, r, c)
      const k = epreuves.indexOf(c)
      if (k < 0) {
        etapes.push({ id, rangee: r, colonne: c, sorte: 'coffre', suivantes: suivantes.get(id) ?? [] })
        continue
      }
      const jeu = sesJeux[k]
      const { theme, sujet, emoji, choix } = themeDUneEpreuve(jeu, usage, themes, contenu, hasard)
      // Ses voisines évitent sa catégorie — chacune de ses catégories au choix, au Quiz.
      themes.push(theme, ...(choix ?? []).map(x => x.theme))
      etapes.push({
        id,
        rangee: r,
        colonne: c,
        sorte: 'epreuve',
        jeu,
        ...(theme !== undefined && { theme }),
        ...(sujet !== undefined && { sujet }),
        ...(emoji !== undefined && { emoji }),
        ...(choix && { choix }),
        suivantes: suivantes.get(id) ?? [],
      })
    }
  }
  etapes.push({ id: marchand, rangee: RANGEE_DU_MARCHAND, colonne: MILIEU, sorte: 'marchand', suivantes: [auGardien] })
  etapes.push({ id: auGardien, rangee: RANGEE_DU_GARDIEN, colonne: MILIEU, sorte: 'gardien', suivantes: [] })
  return { gardien, etapes }
}

/** La carte des trois actes, tirée une fois au départ et figée avec lui : la traversée ne se retrace jamais. */
export function tracerLaCarte(
  hasard: () => number,
  gardiens: readonly [string, string, string],
  contenu: ThemesDuContenu,
  jeux: readonly CleDeJeu[] = CLES_DES_JEUX,
): ActeDeLaCarte[] {
  const usage: Usage = { jeux: new Map(), categories: new Map(), contenus: new Set() }
  return gardiens.map((g, a) => tracerUnActe(a, g, usage, contenu, jeux, hasard))
}

// ── Le départ ─────────────────────────────────────────────────────────────

/**
 * Les versions de départ que ce code relit, écrites en dur (la leçon de
 * l'Expédition, `partie.ts`). La 2, le 1er novembre 2026 : le barème de
 * l'équilibre (`bareme.ts`, la traversée) — relue à ses chiffres, une
 * traversée de la 1 en route aurait pu se perdre après coup, un cœur de moins
 * au départ, ou voir un achat d'hier refusé.
 */
export const VERSIONS_DE_LA_TRAVERSEE = [1, 2] as const
export type VersionDeLaTraversee = (typeof VERSIONS_DE_LA_TRAVERSEE)[number]
export const VERSION_DE_LA_TRAVERSEE: VersionDeLaTraversee = VERSIONS_DE_LA_TRAVERSEE[VERSIONS_DE_LA_TRAVERSEE.length - 1]

/** Ce qu'une version de la traversée lit de son barème — ce que la 2 a changé ; le reste est le même pour toutes. */
export interface BaremeDeLaTraversee {
  coeursDeDepart: number
  orParEtoile: number
  pvDesGardiens: readonly [number, number, number]
  prix: Readonly<Record<'coeur' | 'amelioration' | 'auPlusHaut', number>>
  /** Ce qu'une amélioration offerte (le coffre, le gardien vaincu) donne au plus. */
  niveauOffert: NiveauDeCarte
}

/**
 * Le barème de chaque version : la 1 écrite en dur, telle qu'elle s'est jouée
 * du 31 octobre au 1er novembre 2026 — trop facile, ses cartes au plus haut
 * dès le deuxième gardien ; la 2 lit `bareme.ts`. Une version ne quitte jamais
 * cette table : sans elle, ses traversées ne se reliraient plus.
 */
const BAREMES_DES_VERSIONS: Readonly<Record<VersionDeLaTraversee, BaremeDeLaTraversee>> = {
  1: { coeursDeDepart: 5, orParEtoile: 5, pvDesGardiens: [6, 8, 10], prix: { coeur: 25, amelioration: 45, auPlusHaut: 45 }, niveauOffert: 3 },
  2: { coeursDeDepart: COEURS_DE_DEPART, orParEtoile: OR_PAR_ETOILE, pvDesGardiens: PV_DES_GARDIENS, prix: PRIX_DU_MARCHAND, niveauOffert: NIVEAU_OFFERT },
}

/** Le barème que lit une traversée, celui de sa version : son départ, sa vue — la page en compose ses phrases. */
export const baremeDe = (d: Pick<DepartDeLaTraversee, 'v'>): BaremeDeLaTraversee => BAREMES_DES_VERSIONS[d.v]

/**
 * Ce qu'une traversée fige à son départ (`cabinet_traversees.depart`) : la
 * carte des trois actes — chemins, jeux, thèmes, gardiens. Rien de secret :
 * tout se voit dès l'écran-titre — ses trois gardiens d'abord, « qu'est-ce
 * qu'on gagne ? » a sa réponse avant le premier geste —, et chaque épreuve
 * tire ses questions au moment d'y entrer, au serveur (invariant 1). Les
 * trois cartes se choisissent ensuite, devant ses gardiens : c'est son
 * premier geste (`cartes`).
 */
export interface DepartDeLaTraversee {
  v: VersionDeLaTraversee
  /** Le jour de Paris du départ. */
  jour: string
  actes: readonly ActeDeLaCarte[]
}

export const CHOISIS_TROIS_CARTES = `Choisis ${CARTES_D_UNE_TRAVERSEE} cartes pour partir`

/** Les cartes choisies pour partir, relues : trois clés connues, toutes différentes ; ou le refus en mots. */
export function lireLesCartesChoisies(brut: unknown): CleDeCarte[] | string {
  if (!Array.isArray(brut) || brut.length !== CARTES_D_UNE_TRAVERSEE) return CHOISIS_TROIS_CARTES
  const cartes = brut.map(c => carteDeLaTraversee(c)?.cle ?? null)
  if (cartes.some(c => c === null) || new Set(cartes).size !== cartes.length) return CHOISIS_TROIS_CARTES
  return cartes as CleDeCarte[]
}

// ── Les gestes ────────────────────────────────────────────────────────────

/** Une manche d'une épreuve finie, telle que sa partie l'a jugée : ses étoiles naturelles — null, jamais ouverte —, et sa mise. */
export interface MancheConclue {
  etoiles: number | null
  misee: boolean
}

/**
 * Ce que la page envoie — `aller`, `ameliorer`, `acheter`, `legendaire`,
 * `abandonner` —, et les deux gestes que le serveur écrit seul : `epreuve`
 * (aller vers une épreuve ou un gardien commence sa partie) et `conclure` (la
 * partie finie rend ses étoiles).
 */
export type GesteDeLaTraversee =
  /** Ses trois cartes, telles que la page les nomme : le pli les relit, et refuse en mots ce qui n'en fait pas trois (`lireLesCartesChoisies`). */
  | { quoi: 'cartes'; cartes: readonly string[] }
  /** Vers une épreuve du Quiz, le thème choisi parmi ses thèmes au choix (son rang dans `EtapeDeLaCarte.choix`). */
  | { quoi: 'aller'; etape: string; theme?: number }
  /** … que le serveur écrit avec la partie qu'il commence : la traversée relit le thème qui s'est joué. */
  | { quoi: 'epreuve'; etape: string; partie: string; theme?: number }
  | { quoi: 'conclure'; partie: string; manches: readonly MancheConclue[] }
  | { quoi: 'ameliorer'; carte: CleDeCarte }
  | { quoi: 'acheter'; article: 'coeur' }
  | { quoi: 'acheter'; article: 'amelioration'; carte: CleDeCarte }
  | { quoi: 'legendaire'; gardien: string }
  | { quoi: 'abandonner' }

export interface GesteDeLaTraverseeEcrit {
  geste: GesteDeLaTraversee
  faitLe: number
}

// ── L'état ────────────────────────────────────────────────────────────────

export interface CarteEnMain {
  cle: CleDeCarte
  niveau: NiveauDeCarte
}

/** Où il en est : au choix de ses cartes, devant la carte, dans une épreuve, au coffre, chez le marchand, face au gardien, au choix du légendaire. */
export type OuEnEst =
  | { sorte: 'cartes' }
  | { sorte: 'carte' }
  /** `theme` : le thème choisi d'une épreuve du Quiz, son rang parmi ses thèmes au choix. */
  | { sorte: 'epreuve'; etape: string; partie: string; theme?: number }
  /**
   * Le coffre ouvert, et ce qu'il a donné : une amélioration, ou de l'or quand aucune carte ne la prenait plus.
   * L'écran le lit ici — déduit de ses cartes, une carte montée au plus haut par le coffre même le disait payé en or.
   */
  | { sorte: 'coffre'; etape: string; recompense: 'amelioration' | 'or' }
  | { sorte: 'marchand'; etape: string }
  | { sorte: 'gardien'; etape: string; partie: string | null }
  | { sorte: 'legendaire' }

/** Une manche payée : ce qu'elle a rapporté et coûté, et si elle a compté. */
export interface ManchePayee extends MancheConclue {
  or: number
  coeurs: number
  /** La Parade l'a couverte : ratée, elle n'a rien coûté. */
  paree: boolean
  /** Ses coups au gardien. */
  coups: number
  /** Après la chute du gardien ou le dernier cœur, une manche ne compte plus. */
  comptee: boolean
}

/** Ce qu'une épreuve a fait à la traversée : la page le dit à son bilan, manche par manche. */
export interface BilanDEpreuve {
  etape: string
  partie: string
  /** Le thème qui s'est joué, quand il s'est choisi (le Quiz) : l'étape n'en a pas à elle. */
  theme?: string
  gardien: boolean
  manches: readonly ManchePayee[]
  /** L'or gagné, celui du gardien vaincu compris. */
  or: number
  coeurs: number
  /** Le Second souffle a servi. */
  souffle: boolean
  /** Les points de vie du gardien avant et après l'assaut. */
  pv?: { avant: number; apres: number; max: number }
  vaincu: boolean
  /** Le dernier cœur est tombé : la traversée est perdue. */
  perdue: boolean
  /** Ce qu'offre le gardien vaincu, en plus de son or : une amélioration, ou de l'or quand tout est au plus haut. */
  recompense?: 'amelioration' | 'or'
}

export type IssueDeLaTraversee = 'gagnee' | 'perdue' | 'abandonnee'
export interface FinDeLaTraversee {
  issue: IssueDeLaTraversee
  le: number
  /** Le légendaire choisi au bout : il est à lui (le serveur le range). */
  legendaire?: string
}

export interface EtatDeLaTraversee {
  /** Le rang du prochain geste : un de plus que les gestes écrits, refusés à la relecture compris. */
  rang: number
  acte: Acte
  /** L'étape où il se tient : le départ de l'acte, la dernière étape atteinte. */
  position: string
  visitees: readonly string[]
  ou: OuEnEst
  cartes: readonly CarteEnMain[]
  coeurs: number
  or: number
  /** Le gardien de l'acte, une fois le combat engagé : ses points de vie, et ceux du départ. */
  pv: { restent: number; max: number } | null
  assauts: number
  /** Les améliorations offertes qui attendent son choix : un coffre, un gardien vaincu. */
  ameliorations: number
  /** Le Second souffle a servi. */
  souffle: boolean
  vaincus: readonly string[]
  /** Les épreuves conclues, et les manches réussies : le bilan de la traversée. */
  epreuves: number
  reussies: number
  /** La dernière épreuve conclue : la page en dit le bilan au retour sur la carte. */
  derniere: BilanDEpreuve | null
  fin: FinDeLaTraversee | null
  /** Les gestes écrits que la relecture a refusés : zéro tant que les règles suivent la version. */
  ignores: number
}

// ── Ce que valent les cartes en main ──────────────────────────────────────

export const niveauDe = (cartes: readonly CarteEnMain[], cle: CleDeCarte): NiveauDeCarte | 0 => cartes.find(c => c.cle === cle)?.niveau ?? 0
const sous = <T>(table: Readonly<Record<Force, T>>, n: NiveauDeCarte | 0, sinon: T): T => (n === 0 ? sinon : table[n])

/** Ce qui dit sous quelles règles se lit une traversée : sa version, que portent son départ et sa vue. */
type SaVersion = Pick<DepartDeLaTraversee, 'v'>

export const coeursMax = (d: SaVersion, cartes: readonly CarteEnMain[]): number => baremeDe(d).coeursDeDepart + sous(COEURS_DE_LA_PANACEE, niveauDe(cartes, 'panacee'), 0)
export const pvDuGardien = (d: SaVersion, acte: Acte, cartes: readonly CarteEnMain[]): number =>
  Math.max(1, baremeDe(d).pvDesGardiens[acte] - sous(PV_DU_COUP_DE_GRACE, niveauDe(cartes, 'coup-de-grace'), 0))
export type Article = 'coeur' | 'amelioration'
/** Un article du marchand, Pourboire compris : un cœur, ou l'amélioration de cette carte — vers la carte +, ou vers la carte ++. */
export function prixAuMarchand(d: SaVersion, article: Article, cartes: readonly CarteEnMain[], cle?: CleDeCarte): number {
  const prix = baremeDe(d).prix
  const brut = article === 'coeur' ? prix.coeur : cle && niveauDe(cartes, cle) + 1 >= NIVEAU_MAX ? prix.auPlusHaut : prix.amelioration
  return Math.max(PRIX_MIN, brut - sous(REMISE_DU_POURBOIRE, niveauDe(cartes, 'pourboire'), 0))
}

/** Les cartes qu'une amélioration sert encore : pas au plus haut, et pas un Second souffle déjà dépensé — le marchand les vend. */
export const ameliorables = (e: Pick<EtatDeLaTraversee, 'cartes' | 'souffle'>): CarteEnMain[] =>
  e.cartes.filter(c => c.niveau < NIVEAU_MAX && !(c.cle === 'second-souffle' && e.souffle))

/** Celles qu'une amélioration offerte — le coffre, le gardien vaincu — peut prendre : sous le niveau qu'elle donne au plus (`NIVEAU_OFFERT`). */
export const offrables = (d: SaVersion, e: Pick<EtatDeLaTraversee, 'cartes' | 'souffle'>): CarteEnMain[] =>
  ameliorables(e).filter(c => c.niveau < baremeDe(d).niveauOffert)

/** Les cartes qu'une épreuve emporte dans ses manches : celles qui ont un pouvoir, à la force de leur niveau. */
export const cartesDeLEpreuve = (cartes: readonly CarteEnMain[]): CarteDuDepart[] =>
  cartes.flatMap(c => {
    const pouvoir = carteDeLaTraversee(c.cle)?.pouvoir
    return pouvoir ? [{ cle: c.cle, pouvoir, force: c.niveau }] : []
  })

export const etapeDe = (d: Pick<DepartDeLaTraversee, 'actes'>, id: string): EtapeDeLaCarte | null => d.actes[acteDe(id)]?.etapes.find(x => x.id === id) ?? null

/** Le jeu d'un assaut contre un gardien : ses trois jeux, à tour de rôle. */
export const jeuDeLAssaut = (gardien: string, assaut: number): CleDeJeu | null => {
  const g = gardienDeLaTraversee(gardien)
  return g ? g.jeux[(Math.max(1, assaut) - 1) % g.jeux.length] : null
}

/** Ce qu'une étape demande au tirage : son jeu, ses marches, ce que son thème vise — au Quiz, un sujet de la base aussi. */
export interface ViseeDUneEtape {
  jeu: CleDeJeu
  marches: readonly Niveau[]
  categorie: Categorie | null
  theme: string | null
  sujet: string | null
}

/**
 * La visée d'une épreuve, ou du prochain assaut de son gardien ; null : une étape qui ne se joue pas. `choisi` : le
 * thème choisi parmi ses thèmes au choix (le Quiz).
 */
export function viseeDeLEtape(d: DepartDeLaTraversee, etape: EtapeDeLaCarte, assaut: number, choisi?: number): ViseeDUneEtape | null {
  const acte = acteDe(etape.id)
  if (etape.sorte === 'gardien') {
    const jeu = jeuDeLAssaut(d.actes[acte].gardien, assaut)
    return jeu ? { jeu, marches: MARCHES_DES_GARDIENS[acte], categorie: null, theme: null, sujet: null } : null
  }
  if (etape.sorte !== 'epreuve' || !etape.jeu) return null
  const t = themeDeLEtape(etape, choisi)
  return {
    jeu: etape.jeu,
    marches: MARCHES_DES_ACTES[acte],
    categorie: categorieDuTheme(t?.theme),
    theme: THEMES_FIXES[etape.jeu] ? null : (t?.theme ?? null),
    sujet: t?.sujet ?? null,
  }
}

/** Pourquoi il ne peut pas entrer dans cette épreuve avec ce thème ; null : il peut. Un thème au choix se choisit, et parmi les siens. */
export function refusDuTheme(etape: Pick<EtapeDeLaCarte, 'choix'>, theme: number | undefined): string | null {
  if (!etape.choix || etape.choix.length === 0) return null
  return theme !== undefined && Number.isInteger(theme) && theme >= 0 && theme < etape.choix.length ? null : CHOISIS_TON_THEME
}

/** L'état au départ : devant ses trois gardiens, ses cartes à choisir, les cœurs au complet. */
export function etatDuDepart(d: DepartDeLaTraversee): EtatDeLaTraversee {
  return {
    rang: 1,
    acte: 0,
    position: departDeLActe(0),
    visitees: [departDeLActe(0)],
    ou: { sorte: 'cartes' },
    cartes: [],
    coeurs: baremeDe(d).coeursDeDepart,
    or: 0,
    pv: null,
    assauts: 0,
    ameliorations: 0,
    souffle: false,
    vaincus: [],
    epreuves: 0,
    reussies: 0,
    derniere: null,
    fin: null,
    ignores: 0,
  }
}

// ── Les refus, en mots ────────────────────────────────────────────────────

export const TRAVERSEE_FINIE = 'Cette traversée est finie'
export const CHOISIS_D_ABORD = 'Choisis d’abord tes trois cartes'
export const CARTES_DEJA_CHOISIES = 'Tes cartes sont déjà choisies'
export const ETAPE_INCONNUE = 'Cette étape n’est pas sur ta carte : recharge la page'
export const PAS_PAR_LA = 'Ce chemin ne part pas d’ici'
export const AMELIORE_D_ABORD = 'Choisis d’abord ta carte à améliorer'
export const EPREUVE_EN_COURS = 'Finis d’abord ton épreuve'
export const LE_GARDIEN_T_ATTEND = 'Le gardien t’attend'
export const CHOISIS_TON_LEGENDAIRE = 'Choisis ton légendaire'
export const ETAPE_A_JOUER = 'Cette étape se joue : recharge la page'
export const CHOISIS_TON_THEME = 'Choisis d’abord ton thème'
export const PAS_CETTE_PARTIE = 'Cette partie n’est pas celle de ton épreuve : recharge la page'
export const RIEN_A_AMELIORER = 'Aucune amélioration ne t’attend'
export const PAS_TA_CARTE = 'Tu n’as pas cette carte'
export const CARTE_AU_PLUS_HAUT = 'Cette carte est déjà au plus haut'
/** Une espace insécable devant le signe : il partait seul à la ligne (`nomAuNiveau`). */
export const PLUS_HAUT_CHEZ_LE_MARCHAND = 'La carte ++ s’achète chez le marchand'
export const SOUFFLE_DEPENSE = 'Ton Second souffle a déjà servi'
export const PAS_CHEZ_LE_MARCHAND = 'Le marchand n’est pas là'
export const COEURS_AU_COMPLET = 'Tes cœurs sont au complet'
export const PAS_ASSEZ_D_OR = 'Pas assez d’or'
export const PAS_UN_VAINQUEUR = 'Tu n’as pas vaincu ce gardien'
export const ILLISIBLE_EN_ROUTE = 'Ce geste ne se lit pas : recharge la page'

/** La carte qu'une amélioration viserait, si elle la sert ; sinon le refus en mots. */
function refusDAmeliorer(e: EtatDeLaTraversee, cle: CleDeCarte): string | null {
  const c = e.cartes.find(x => x.cle === cle)
  if (!c) return PAS_TA_CARTE
  if (c.niveau >= NIVEAU_MAX) return CARTE_AU_PLUS_HAUT
  if (c.cle === 'second-souffle' && e.souffle) return SOUFFLE_DEPENSE
  return null
}

/** Une carte d'un niveau de plus : la Panacée donne aussitôt le cœur qu'elle ajoute au maximum. */
function ameliorer(d: SaVersion, e: EtatDeLaTraversee, cle: CleDeCarte): EtatDeLaTraversee {
  const cartes = e.cartes.map(c => (c.cle === cle ? { ...c, niveau: Math.min(NIVEAU_MAX, c.niveau + 1) as NiveauDeCarte } : c))
  return { ...e, cartes, coeurs: e.coeurs + coeursMax(d, cartes) - coeursMax(d, e.cartes) }
}

/**
 * Une amélioration offerte (un coffre, un gardien) : à choisir parmi les cartes qui la prennent (`offrables`), ou de
 * l'or quand aucune ne la prend plus — toutes à la carte + depuis la version 2, la carte ++ chez le marchand seulement.
 */
function offrirUneAmelioration(d: SaVersion, e: EtatDeLaTraversee): { etat: EtatDeLaTraversee; recompense: 'amelioration' | 'or' } {
  if (offrables(d, e).length > 0) return { etat: { ...e, ameliorations: e.ameliorations + 1 }, recompense: 'amelioration' }
  return { etat: { ...e, or: e.or + OR_SANS_AMELIORATION }, recompense: 'or' }
}

/**
 * Pourquoi il ne peut pas aller à cette étape maintenant ; null : il peut.
 * Depuis la carte, le coffre ou le marchand, une étape qui suit la sienne ;
 * face au gardien, entre deux assauts, le gardien seul ; jamais pendant une
 * épreuve, ni avec une amélioration à choisir.
 */
export function refusDAller(d: DepartDeLaTraversee, e: EtatDeLaTraversee, id: string): string | null {
  if (e.fin) return TRAVERSEE_FINIE
  const etape = etapeDe(d, id)
  if (!etape) return ETAPE_INCONNUE
  if (e.ameliorations > 0) return AMELIORE_D_ABORD
  switch (e.ou.sorte) {
    case 'cartes':
      return CHOISIS_D_ABORD
    case 'epreuve':
      return EPREUVE_EN_COURS
    case 'legendaire':
      return CHOISIS_TON_LEGENDAIRE
    case 'gardien':
      if (e.ou.partie !== null) return EPREUVE_EN_COURS
      return id === e.ou.etape ? null : LE_GARDIEN_T_ATTEND
  }
  return etapeDe(d, e.position)?.suivantes.includes(id) ? null : PAS_PAR_LA
}

/** Les étapes où il peut aller maintenant : la carte les éclaire, les autres restent dans l'ombre. */
export function atteignables(d: DepartDeLaTraversee, e: EtatDeLaTraversee): string[] {
  if (e.fin || e.ameliorations > 0) return []
  if (e.ou.sorte === 'gardien') return e.ou.partie === null ? [e.ou.etape] : []
  if (e.ou.sorte === 'epreuve' || e.ou.sorte === 'legendaire' || e.ou.sorte === 'cartes') return []
  return [...(etapeDe(d, e.position)?.suivantes ?? [])]
}

/**
 * Celles des étapes `depuis` d'où un chemin mène jusqu'à `cible`, dans son
 * acte : la page le dit sous une étape lointaine touchée sur la carte (« Par le
 * Pari ou le coffre »), pour choisir son chemin d'après ce qui l'attend plus
 * loin — sans quoi seules les étapes d'à côté se lisaient (le retour du
 * propriétaire, le 1er novembre 2026). Vide : aucune n'y mène, ou la cible est
 * d'un autre acte — le pont part du gardien, pas des chemins d'un acte.
 */
export function cheminsVers(d: Pick<DepartDeLaTraversee, 'actes'>, depuis: readonly string[], cible: string): string[] {
  const acte = d.actes[acteDe(cible)]
  if (!acte) return []
  const parId = new Map(acte.etapes.map(x => [x.id, x]))
  if (!parId.has(cible)) return []
  const mene = new Map<string, boolean>()
  const yMene = (id: string): boolean => {
    if (id === cible) return true
    const su = mene.get(id)
    if (su !== undefined) return su
    // Posé faux d'abord : un chemin qui reviendrait sur lui-même — la carte n'en trace pas — ne tournerait pas sans fin.
    mene.set(id, false)
    const oui = (parId.get(id)?.suivantes ?? []).some(yMene)
    mene.set(id, oui)
    return oui
  }
  return depuis.filter(id => parId.has(id) && yMene(id))
}

// ── Une épreuve conclue ───────────────────────────────────────────────────

/**
 * Ce qu'une épreuve fait à la traversée, manche par manche, dans l'ordre où
 * elles se sont jouées. Une manche réussie (une étoile au moins) rapporte
 * l'or de ses étoiles, la Cagnotte en plus — multiplié par la mise —, et
 * frappe le gardien d'autant ; une manche ratée coûte un cœur — deux, misée —,
 * sauf si la Parade la couvre. Au dernier cœur, le Second souffle relève une
 * fois ; sinon la traversée est perdue, et rien ne compte plus. Le gardien à
 * terre, les manches d'après ne comptent pas : l'assaut s'arrête là.
 *
 * `enCours` : l'épreuve se joue encore — une manche pas encore jugée ne compte
 * pas (la vue d'une manche dit déjà ce que valent les précédentes). Finie, une
 * manche jamais ouverte compte ratée : quitter une épreuve ne fuit pas ses
 * cœurs.
 */
export function consequencesDe(
  d: DepartDeLaTraversee,
  e: EtatDeLaTraversee,
  o: { etape: string; partie: string; manches: readonly MancheConclue[]; enCours: boolean },
): { etat: EtatDeLaTraversee; bilan: BilanDEpreuve } {
  const etape = etapeDe(d, o.etape)
  const gardien = etape?.sorte === 'gardien'
  const n = (cle: CleDeCarte) => niveauDe(e.cartes, cle)
  const parade = n('parade')
  const paresMax = parade !== 0 && (!gardien || parade >= PARADE_CONTRE_LES_GARDIENS) ? ERREURS_PAREES[parade] : 0
  const qod = n('quitte-ou-double')
  const mult = qod === 0 ? 1 : MULTIPLICATEUR_DE_LA_MISE[qod]
  const cagnotte = sous(OR_DE_LA_CAGNOTTE, n('cagnotte'), 0)
  const souffleN = n('second-souffle')
  const max = coeursMax(d, e.cartes)
  const orParEtoile = baremeDe(d).orParEtoile
  let { coeurs, or, souffle } = e
  let pv = gardien ? (e.pv?.restent ?? pvDuGardien(d, acteDe(o.etape), e.cartes)) : null
  const pvAvant = pv
  let parees = 0
  let vaincu = false
  let perdue = false
  let reussies = 0
  let souffleIci = false
  const manches: ManchePayee[] = []
  for (let k = 0; k < MANCHES_PAR_PARTIE; k++) {
    const m = o.manches[k] ?? { etoiles: null, misee: false }
    const nulle: ManchePayee = { ...m, or: 0, coeurs: 0, paree: false, coups: 0, comptee: false }
    if (vaincu || perdue || (o.enCours && m.etoiles === null)) {
      manches.push(nulle)
      continue
    }
    const x = m.misee ? mult : 1
    if (m.etoiles !== null && m.etoiles >= 1) {
      const gain = (m.etoiles * orParEtoile + cagnotte) * x
      or += gain
      reussies++
      let coups = 0
      if (pv !== null) {
        coups = Math.min(pv, m.etoiles * x)
        pv -= coups
        if (pv <= 0) vaincu = true
      }
      manches.push({ ...nulle, or: gain, coups, comptee: true })
      continue
    }
    const paree = parees < paresMax
    if (paree) parees++
    const perte = paree ? 0 : m.misee ? COEURS_D_UNE_MISE_PERDUE : 1
    coeurs -= perte
    if (coeurs <= 0) {
      if (souffleN !== 0 && !souffle) {
        const c = COEURS_DU_SECOND_SOUFFLE[souffleN]
        coeurs = c === null ? max : Math.min(max, c)
        souffle = true
        souffleIci = true
      } else {
        coeurs = 0
        perdue = true
      }
    }
    manches.push({ ...nulle, coeurs: perte, paree, comptee: true })
  }
  const perdus = manches.reduce((s, m) => s + m.coeurs, 0)
  let etat: EtatDeLaTraversee = { ...e, coeurs, or, souffle, reussies: e.reussies + reussies }
  let recompense: BilanDEpreuve['recompense']
  if (gardien && pv !== null && pvAvant !== null) etat = { ...etat, pv: { restent: pv, max: e.pv?.max ?? pvAvant } }
  if (vaincu && !perdue) {
    etat = { ...etat, or: etat.or + OR_D_UN_GARDIEN, coeurs: max }
    if (e.acte < ACTES_D_UNE_TRAVERSEE - 1) {
      const offerte = offrirUneAmelioration(d, etat)
      etat = offerte.etat
      recompense = offerte.recompense
    }
  }
  // Le thème qui s'est joué, s'il s'est choisi : le bilan le dit, l'étape n'en ayant pas à elle.
  const choisi = etape?.choix && e.ou.sorte === 'epreuve' && e.ou.etape === o.etape ? themeDeLEtape(etape, e.ou.theme) : null
  const bilan: BilanDEpreuve = {
    etape: o.etape,
    partie: o.partie,
    ...(choisi && { theme: choisi.theme }),
    gardien,
    manches,
    or: etat.or - e.or,
    coeurs: perdus,
    souffle: souffleIci,
    ...(gardien && pvAvant !== null && pv !== null && { pv: { avant: pvAvant, apres: pv, max: e.pv?.max ?? pvAvant } }),
    vaincu,
    perdue,
    ...(recompense && { recompense }),
  }
  return { etat, bilan }
}

// ── Le pli ────────────────────────────────────────────────────────────────

/**
 * Un geste de plus, arrivé à `t` : l'état d'après, ou le refus en mots — et
 * rien ne change. La seule règle des refus : le serveur l'applique avant
 * d'écrire, la vue la porte, la page n'en recopie rien.
 */
export function jouerUnGesteDeLaTraversee(d: DepartDeLaTraversee, avant: EtatDeLaTraversee, g: GesteDeLaTraversee, t: number): EtatDeLaTraversee | string {
  if (avant.fin) return TRAVERSEE_FINIE
  const suite = (e: EtatDeLaTraversee): EtatDeLaTraversee => ({ ...e, rang: avant.rang + 1 })
  const e = avant
  // Ses trois cartes, devant ses gardiens : le premier geste, et rien avant lui — sauf renoncer.
  if (g.quoi === 'cartes') {
    if (e.ou.sorte !== 'cartes') return CARTES_DEJA_CHOISIES
    const lues = lireLesCartesChoisies(g.cartes)
    if (typeof lues === 'string') return lues
    const cartes = lues.map(cle => ({ cle, niveau: 1 as NiveauDeCarte }))
    return suite({ ...e, cartes, coeurs: coeursMax(d, cartes), ou: { sorte: 'carte' } })
  }
  if (e.ou.sorte === 'cartes' && g.quoi !== 'abandonner') return CHOISIS_D_ABORD
  switch (g.quoi) {
    case 'aller':
    case 'epreuve': {
      const refus = refusDAller(d, e, g.etape)
      if (refus) return refus
      const etape = etapeDe(d, g.etape)!
      const visitees = e.visitees.includes(etape.id) ? e.visitees : [...e.visitees, etape.id]
      const seJoue = etape.sorte === 'epreuve' || etape.sorte === 'gardien'
      // Une épreuve et un gardien ne s'y rendent qu'en commençant leur partie : le serveur l'écrit, la page ne fait que demander.
      if (seJoue !== (g.quoi === 'epreuve')) return ETAPE_A_JOUER
      if (g.quoi === 'aller') {
        if (etape.sorte === 'coffre') {
          const { etat, recompense } = offrirUneAmelioration(d, { ...e, position: etape.id, visitees })
          return suite({ ...etat, ou: { sorte: 'coffre', etape: etape.id, recompense } })
        }
        if (etape.sorte === 'marchand') return suite({ ...e, position: etape.id, visitees, ou: { sorte: 'marchand', etape: etape.id } })
        return ETAPE_A_JOUER
      }
      if (etape.sorte === 'epreuve') {
        // Le thème choisi d'un Quiz, tel que le serveur l'a écrit ; absent, le premier — une carte écrite à la main.
        const theme = etape.choix && g.theme !== undefined ? g.theme : undefined
        if (theme !== undefined && refusDuTheme(etape, theme)) return CHOISIS_TON_THEME
        return suite({ ...e, position: etape.id, visitees, ou: { sorte: 'epreuve', etape: etape.id, partie: g.partie, ...(theme !== undefined && { theme }) } })
      }
      // Le gardien : le premier assaut engage le combat à ses points de vie du moment — Coup de grâce compris.
      const pv = e.pv ?? { restent: pvDuGardien(d, e.acte, e.cartes), max: pvDuGardien(d, e.acte, e.cartes) }
      return suite({ ...e, position: etape.id, visitees, pv, assauts: e.assauts + 1, ou: { sorte: 'gardien', etape: etape.id, partie: g.partie } })
    }
    case 'conclure': {
      const ou = e.ou
      if ((ou.sorte !== 'epreuve' && ou.sorte !== 'gardien') || ou.partie !== g.partie) return PAS_CETTE_PARTIE
      const { etat, bilan } = consequencesDe(d, e, { etape: ou.etape, partie: g.partie, manches: g.manches, enCours: false })
      const apres: EtatDeLaTraversee = { ...etat, epreuves: e.epreuves + 1, derniere: bilan }
      if (bilan.perdue) return suite({ ...apres, ou: { sorte: 'carte' }, fin: { issue: 'perdue', le: t } })
      if (ou.sorte === 'epreuve') return suite({ ...apres, ou: { sorte: 'carte' } })
      if (!bilan.vaincu) return suite({ ...apres, ou: { sorte: 'gardien', etape: ou.etape, partie: null } })
      const vaincus = [...e.vaincus, d.actes[e.acte].gardien]
      if (e.acte >= ACTES_D_UNE_TRAVERSEE - 1) return suite({ ...apres, vaincus, pv: null, ou: { sorte: 'legendaire' } })
      // L'acte suivant s'ouvre aussitôt : l'amélioration du gardien se choisit devant sa carte, avant le premier pas.
      const acte = (e.acte + 1) as Acte
      const depart = departDeLActe(acte)
      return suite({ ...apres, vaincus, acte, position: depart, visitees: [...apres.visitees, depart], pv: null, assauts: 0, ou: { sorte: 'carte' } })
    }
    case 'ameliorer': {
      if (e.ameliorations <= 0) return RIEN_A_AMELIORER
      const refus = refusDAmeliorer(e, g.carte)
      if (refus) return refus
      // Offerte, elle ne mène pas au plus haut niveau (`NIVEAU_OFFERT`) : la carte ++ se paie chez le marchand.
      if (niveauDe(e.cartes, g.carte) >= baremeDe(d).niveauOffert) return PLUS_HAUT_CHEZ_LE_MARCHAND
      return suite({ ...ameliorer(d, e, g.carte), ameliorations: e.ameliorations - 1 })
    }
    case 'acheter': {
      if (e.ou.sorte !== 'marchand') return PAS_CHEZ_LE_MARCHAND
      if (g.article === 'coeur') {
        if (e.coeurs >= coeursMax(d, e.cartes)) return COEURS_AU_COMPLET
        const prix = prixAuMarchand(d, 'coeur', e.cartes)
        if (e.or < prix) return PAS_ASSEZ_D_OR
        return suite({ ...e, or: e.or - prix, coeurs: e.coeurs + 1 })
      }
      const refus = refusDAmeliorer(e, g.carte)
      if (refus) return refus
      const prix = prixAuMarchand(d, 'amelioration', e.cartes, g.carte)
      if (e.or < prix) return PAS_ASSEZ_D_OR
      return suite({ ...ameliorer(d, e, g.carte), or: e.or - prix })
    }
    case 'legendaire': {
      if (e.ou.sorte !== 'legendaire') return e.ou.sorte === 'epreuve' || e.ou.sorte === 'gardien' ? EPREUVE_EN_COURS : TRAVERSEE_FINIE
      if (!e.vaincus.includes(g.gardien)) return PAS_UN_VAINQUEUR
      return suite({ ...e, fin: { issue: 'gagnee', le: t, legendaire: g.gardien } })
    }
    case 'abandonner': {
      if ((e.ou.sorte === 'epreuve' || e.ou.sorte === 'gardien') && e.ou.partie !== null) return EPREUVE_EN_COURS
      return suite({ ...e, fin: { issue: 'abandonnee', le: t } })
    }
  }
}

/** Le refus de ce geste, maintenant ; null : il passe. */
export function refusDuGesteDeLaTraversee(d: DepartDeLaTraversee, e: EtatDeLaTraversee, g: GesteDeLaTraversee, t: number): string | null {
  const r = jouerUnGesteDeLaTraversee(d, e, g, t)
  return typeof r === 'string' ? r : null
}

/** Le pli : l'état d'une traversée, de son départ et de ses gestes, dans l'ordre — un geste refusé à la relecture compte à son rang. */
export function etatDeLaTraversee(d: DepartDeLaTraversee, gestes: readonly GesteDeLaTraverseeEcrit[]): EtatDeLaTraversee {
  let e = etatDuDepart(d)
  for (const { geste, faitLe } of gestes) {
    const apres = jouerUnGesteDeLaTraversee(d, e, geste, faitLe)
    e = typeof apres === 'string' ? { ...e, rang: e.rang + 1, ignores: e.ignores + 1 } : apres
  }
  return e
}

/** La partie qu'une épreuve joue en ce moment ; null : aucune. */
export const partieEnCours = (e: EtatDeLaTraversee): string | null => ((e.ou.sorte === 'epreuve' || e.ou.sorte === 'gardien') && e.ou.partie) || null

/**
 * Ce qu'une épreuve vaut déjà à la traversée, vu de sa partie : les cœurs et
 * l'or, ses manches jugées comptées, le gardien et ses points de vie, ce que
 * coûterait « Quitter ». La tête de la partie le dit à chaque manche ; quand le
 * gardien tombe ou que le dernier cœur part, l'épreuve n'a plus rien à jouer
 * (`fin`) — la page la clôt, et la traversée la conclut.
 */
export interface EpreuveEnCours {
  coeurs: number
  coeursMax: number
  or: number
  gardien?: { cle: string; pv: number; pvMax: number; assaut: number }
  manches: readonly ManchePayee[]
  fin?: 'vaincu' | 'perdue'
  siTuQuittes: { coeurs: number; perdue: boolean }
  acte: Acte
  theme?: string
}

/** L'épreuve en cours de cette partie ; null : la traversée n'y joue plus (« Mes réponses » d'une épreuve d'avant). */
export function epreuveEnCours(d: DepartDeLaTraversee, e: EtatDeLaTraversee, partie: string, manches: readonly MancheConclue[], finie: boolean): EpreuveEnCours | null {
  const ou = e.ou
  if ((ou.sorte !== 'epreuve' && ou.sorte !== 'gardien') || ou.partie !== partie) return null
  const vu = consequencesDe(d, e, { etape: ou.etape, partie, manches, enCours: !finie })
  const quitte = finie ? vu : consequencesDe(d, e, { etape: ou.etape, partie, manches, enCours: false })
  const etape = etapeDe(d, ou.etape)
  const theme = etape ? themeDeLEtape(etape, ou.sorte === 'epreuve' ? ou.theme : undefined)?.theme : undefined
  const fin = vu.bilan.vaincu ? 'vaincu' : vu.bilan.perdue ? 'perdue' : undefined
  return {
    coeurs: vu.etat.coeurs,
    coeursMax: coeursMax(d, vu.etat.cartes),
    or: vu.etat.or,
    ...(ou.sorte === 'gardien' && vu.bilan.pv && { gardien: { cle: d.actes[e.acte].gardien, pv: vu.bilan.pv.apres, pvMax: vu.bilan.pv.max, assaut: e.assauts } }),
    manches: vu.bilan.manches,
    ...(fin && { fin }),
    siTuQuittes: { coeurs: quitte.bilan.coeurs, perdue: quitte.bilan.perdue },
    acte: e.acte,
    ...(theme && { theme }),
  }
}

// ── La relecture ──────────────────────────────────────────────────────────

type Brut = Readonly<Record<string, unknown>>
const objet = (x: unknown): x is Brut => typeof x === 'object' && x !== null && !Array.isArray(x)
const chaine = (x: unknown): x is string => typeof x === 'string'
const entier = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max
const json = (x: unknown): unknown => {
  if (typeof x !== 'string') return x
  try {
    return JSON.parse(x)
  } catch {
    return null
  }
}
const ID_D_ETAPE = /^a\dr\dc\d$/
const unId = (x: unknown): x is string => chaine(x) && x.length > 0 && x.length <= 64
const unJeu = (x: unknown): x is CleDeJeu => chaine(x) && (CLES_DES_JEUX as readonly string[]).includes(x)

function lEtape(x: unknown): EtapeDeLaCarte | null {
  if (!objet(x) || !chaine(x.id) || !ID_D_ETAPE.test(x.id) || !entier(x.rangee, 0, 9) || !entier(x.colonne, 0, 9)) return null
  if (!chaine(x.sorte) || !['depart', 'epreuve', 'coffre', 'marchand', 'gardien'].includes(x.sorte)) return null
  if (!Array.isArray(x.suivantes) || !x.suivantes.every(s => chaine(s) && ID_D_ETAPE.test(s))) return null
  if (!(x.jeu === undefined || unJeu(x.jeu)) || !(x.theme === undefined || chaine(x.theme))) return null
  // Le sujet du Quiz et son emoji : leur forme seulement — un sujet retiré de la base depuis se tire encore, d'un autre thème.
  if (!(x.sujet === undefined || unId(x.sujet)) || !(x.emoji === undefined || (chaine(x.emoji) && x.emoji.length <= 16))) return null
  if (x.sorte === 'epreuve' && x.jeu === undefined) return null
  const choix = x.choix === undefined ? undefined : lesThemesAuChoix(x.choix)
  if (choix === null) return null
  return {
    id: x.id,
    rangee: x.rangee,
    colonne: x.colonne,
    sorte: x.sorte as SorteDEtape,
    ...(x.jeu !== undefined && { jeu: x.jeu as CleDeJeu }),
    ...(x.theme !== undefined && { theme: x.theme as string }),
    ...(x.sujet !== undefined && { sujet: x.sujet as string }),
    ...(x.emoji !== undefined && { emoji: x.emoji as string }),
    ...(choix && { choix }),
    suivantes: [...(x.suivantes as string[])],
  }
}

/** Les thèmes au choix d'une étape, relus à leur forme — un thème, et au besoin un sujet et un emoji ; null : illisibles. */
function lesThemesAuChoix(x: unknown): ThemeAuChoix[] | null {
  if (!Array.isArray(x) || x.length === 0 || x.length > 9) return null
  const lus = x.map((t): ThemeAuChoix | null =>
    objet(t) && chaine(t.theme) && t.theme.length > 0 && t.theme.length <= 120 && (t.sujet === undefined || unId(t.sujet)) && (t.emoji === undefined || (chaine(t.emoji) && t.emoji.length <= 16))
      ? { theme: t.theme, ...(t.sujet !== undefined && { sujet: t.sujet as string }), ...(t.emoji !== undefined && { emoji: t.emoji as string }) }
      : null,
  )
  return lus.every(t => t !== null) ? (lus as ThemeAuChoix[]) : null
}

/** Le rang d'un thème au choix, tel qu'un geste le porte : absent, ou un entier — le pli dit s'il est parmi ceux de l'étape. */
const unThemeChoisi = (x: unknown): { theme?: number } | null => (x === undefined ? {} : entier(x, 0, 9) ? { theme: x } : null)

/**
 * Le départ figé d'une traversée, relu champ par champ ; null : illisible, ou
 * d'une version que ce code ne joue pas. Sa forme seulement, jamais les
 * chiffres du jour : une carte tracée hier se relit telle qu'elle était.
 */
export function lireLeDepartDeLaTraversee(brut: unknown): DepartDeLaTraversee | null {
  const d = json(brut)
  if (!objet(d) || !(VERSIONS_DE_LA_TRAVERSEE as readonly unknown[]).includes(d.v) || !jourValide(d.jour)) return null
  if (!Array.isArray(d.actes) || d.actes.length !== ACTES_D_UNE_TRAVERSEE) return null
  const actes: ActeDeLaCarte[] = []
  for (const a of d.actes as unknown[]) {
    if (!objet(a) || !gardienDeLaTraversee(a.gardien) || !Array.isArray(a.etapes)) return null
    const etapes = a.etapes.map(lEtape)
    if (etapes.some(x => x === null)) return null
    actes.push({ gardien: a.gardien as string, etapes: etapes as EtapeDeLaCarte[] })
  }
  return { v: d.v as VersionDeLaTraversee, jour: d.jour as string, actes }
}

const lesManches = (x: unknown): MancheConclue[] | null => {
  if (!Array.isArray(x) || x.length !== MANCHES_PAR_PARTIE) return null
  const manches = x.map(m => (objet(m) && (m.etoiles === null || entier(m.etoiles, 0, 3)) && typeof m.misee === 'boolean' ? { etoiles: m.etoiles as number | null, misee: m.misee } : null))
  return manches.every(m => m !== null) ? (manches as MancheConclue[]) : null
}

/**
 * Un geste relu : venu de la page (`duServeur` faux) — seulement ce qu'elle a
 * le droit d'envoyer —, ou écrit en base, ceux du serveur compris. Null :
 * illisible.
 */
export function lireUnGesteDeLaTraversee(brut: unknown, duServeur = false): GesteDeLaTraversee | null {
  const g = json(brut)
  if (!objet(g) || !chaine(g.quoi)) return null
  switch (g.quoi) {
    // Des clés, rien de plus : le pli dit en mots ce qui n'en fait pas trois de différentes (« Choisis 3 cartes pour partir »).
    case 'cartes':
      return Array.isArray(g.cartes) && g.cartes.length <= CARTES.length && g.cartes.every(c => chaine(c) && c.length <= 32)
        ? { quoi: 'cartes', cartes: [...(g.cartes as string[])] }
        : null
    case 'aller': {
      const theme = unThemeChoisi(g.theme)
      return chaine(g.etape) && ID_D_ETAPE.test(g.etape) && theme ? { quoi: 'aller', etape: g.etape, ...theme } : null
    }
    case 'ameliorer': {
      const c = carteDeLaTraversee(g.carte)
      return c ? { quoi: 'ameliorer', carte: c.cle } : null
    }
    case 'acheter': {
      if (g.article === 'coeur') return { quoi: 'acheter', article: 'coeur' }
      const c = carteDeLaTraversee(g.carte)
      return g.article === 'amelioration' && c ? { quoi: 'acheter', article: 'amelioration', carte: c.cle } : null
    }
    case 'legendaire':
      return gardienDeLaTraversee(g.gardien) ? { quoi: 'legendaire', gardien: g.gardien as string } : null
    case 'abandonner':
      return { quoi: 'abandonner' }
    case 'epreuve': {
      const theme = unThemeChoisi(g.theme)
      return duServeur && chaine(g.etape) && ID_D_ETAPE.test(g.etape) && unId(g.partie) && theme ? { quoi: 'epreuve', etape: g.etape, partie: g.partie, ...theme } : null
    }
    case 'conclure': {
      const manches = duServeur && unId(g.partie) ? lesManches(g.manches) : null
      return manches ? { quoi: 'conclure', partie: g.partie as string, manches } : null
    }
  }
  return null
}

/** Ce que l'or d'une manche réussie vaudrait, sans mise : la page le dit à l'annonce d'une épreuve. */
export const orDUneManche = (d: SaVersion, etoiles: number, cartes: readonly CarteEnMain[]): number =>
  etoiles * baremeDe(d).orParEtoile + sous(OR_DE_LA_CAGNOTTE, niveauDe(cartes, 'cagnotte'), 0)

/** Le nom d'un jeu, pour l'annonce d'une étape : « Le Pari ». */
export const nomDuJeu = (jeu: CleDeJeu): string => JEUX[jeu].nom
