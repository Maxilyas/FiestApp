// Le Grand Prix : un parcours de dix obstacles, le temps d'un jour, contre le
// fantôme d'un joueur — ses vraies réponses, rejouées à son vrai rythme. Le
// souhait du propriétaire du 19 novembre 2026, pour un anniversaire :
// « battre son double », puis « il faudrait que ça soit générique […] on
// pourrait ensuite mettre n'importe qui ». Le code ne connaît donc personne :
// un Grand Prix se règle au QG — un fantôme, un jour, des rubans, un mot,
// un avatar en plus s'il le veut (la maquette :
// `retours/2026-11-19/grand-prix/README.md`).
//
// Les règles d'un vrai concours de saut d'obstacles : une barre tombée ou un
// refus coûtent quatre points, et à points égaux le chrono départage. Ce
// fichier n'en garde que le pur — ce qu'un saut coûte, ce qu'une course vaut,
// qui bat qui — et les types que la page reçoit : la page, le serveur et les
// tests jugent une course par les mêmes fonctions.

import type { ApparenceDeLAvatar } from './profil'

/** Dix obstacles, une question chacun : deux minutes et demie de course (le choix du propriétaire, le 19 novembre 2026). */
export const OBSTACLES_DU_GRAND_PRIX = 10

/** Ce que coûte une barre tombée — une réponse fausse — ou un refus — pas de réponse à temps : la règle du saut d'obstacles. */
export const PENALITE_D_UNE_BARRE = 4

/**
 * Le temps d'un obstacle quand sa question n'en dit pas : celui des questions
 * du quiz du jour (`DEFAULT_DURATION`, `shared/library.ts`), où presque toutes
 * ont vingt secondes. Le fantôme les a jouées dans ce temps-là : le coureur a
 * le même.
 */
export const DUREE_D_UN_OBSTACLE_S = 20

/** Le nom d'un Grand Prix, comme le titre d'une affiche : il tient sur l'accueil d'un téléphone. */
export const TITRE_DU_GRAND_PRIX_MAX = 48

/** Le mot de l'administrateur à la personne fêtée, comme celui d'un coffre offert. */
export const MOT_DU_GRAND_PRIX_MAX = 140

/**
 * Les rubans d'un flot, au choix du QG : le rond extérieur, ses plis, et les
 * deux pans qui pendent. L'or est celui du flot d'honneur, la fêtée seule le
 * reçoit — il ne se choisit pas.
 */
export const RUBANS = {
  'bleu-nuit': { nom: 'Bleu nuit', rond: '#3466c9', pli: '#1f3f8a' },
  bordeaux: { nom: 'Bordeaux', rond: '#a3374d', pli: '#6e1f31' },
  sapin: { nom: 'Vert sapin', rond: '#2f7a55', pli: '#1c4f37' },
  violet: { nom: 'Violet', rond: '#6a4bb8', pli: '#43307a' },
  rose: { nom: 'Rose', rond: '#d26a9a', pli: '#9a3f6b' },
} as const

export type CleDeRuban = keyof typeof RUBANS

export const RUBAN_PAR_DEFAUT: CleDeRuban = 'bleu-nuit'

/** Les rubans du flot d'honneur : l'or, pour la personne fêtée seule. */
export const RUBAN_D_HONNEUR = { nom: 'Or', rond: '#e2c27a', pli: '#a9853f' } as const

export function estUnRuban(cle: unknown): cle is CleDeRuban {
  return typeof cle === 'string' && Object.prototype.hasOwnProperty.call(RUBANS, cle)
}

// ── Les clés rangées ─────────────────────────────────────────────────────
//
// Un flot et l'avatar en plus se rangent comme les gardiens du Cabinet : une
// ligne de `profile_badges` sous la clé de leur Grand Prix, que la clé
// primaire rend idempotente. Ce sont des voies rangées
// (`PREFIXES_DES_VOIES_RANGEES`, `shared/legendaires.ts`) : ni étagère, ni
// compte des badges.

/** Le préfixe d'un flot rangé : `flot:<grand prix>`, ou `flot:<grand prix>:honneur` pour la fêtée. */
export const PREFIXE_D_UN_FLOT = 'flot:'

/** Le préfixe de l'avatar en plus d'un Grand Prix : `grandprix:pegase` donne `lg:pegase`. */
export const PREFIXE_D_UN_PRIX = 'grandprix:'

/** La clé sous laquelle tout ce qu'un Grand Prix fait tomber se range. */
export const rangementDuGrandPrix = (id: string) => `#grand-prix:${id}`

export const cleDuFlot = (id: string, honneur = false) => `${PREFIXE_D_UN_FLOT}${id}${honneur ? ':honneur' : ''}`

/** Le flot que dit une clé rangée — son Grand Prix et s'il est d'honneur —, ou null. */
export function flotDe(cle: unknown): { grandPrix: string; honneur: boolean } | null {
  if (typeof cle !== 'string' || !cle.startsWith(PREFIXE_D_UN_FLOT)) return null
  const reste = cle.slice(PREFIXE_D_UN_FLOT.length)
  const honneur = reste.endsWith(':honneur')
  const grandPrix = honneur ? reste.slice(0, -':honneur'.length) : reste
  return /^[A-Za-z0-9_-]{1,64}$/.test(grandPrix) ? { grandPrix, honneur } : null
}

/**
 * Ses flots, lus dans ses récompenses : un par Grand Prix — le flot d'honneur
 * et celui d'un fantôme battu ne font qu'un, s'il a couru contre lui-même et
 * gagné. Ils comptent dans « Ma collection » et dans sa valeur comme un
 * timbre du carnet (le choix du propriétaire, le 19 novembre 2026).
 */
export function flotsDe(recompenses: ReadonlyMap<string, number>): string[] {
  const parGrandPrix = new Map<string, string>()
  for (const [cle, n] of recompenses) {
    const f = n > 0 ? flotDe(cle) : null
    if (f && !parGrandPrix.has(f.grandPrix)) parGrandPrix.set(f.grandPrix, cle)
    // L'honneur l'emporte : c'est celui que son carnet montre.
    if (f?.honneur) parGrandPrix.set(f.grandPrix, cle)
  }
  return [...parGrandPrix.values()]
}

/** La clé rangée qui donne un avatar en plus : `lg:pegase` → `grandprix:pegase`. */
export const cleDuPrix = (legendaire: string) => `${PREFIXE_D_UN_PRIX}${legendaire.replace(/^lg:/, '')}`

// ── Une course ───────────────────────────────────────────────────────────

/** Un saut : la réponse donnée à un obstacle — le choix, s'il est juste, et le temps mis depuis que la question s'est montrée. */
export interface Saut {
  /** L'index de la réponse choisie, dans l'ordre montré ; null : rien à temps, un refus. */
  choix: number | null
  juste: boolean
  /** Le temps depuis que la question s'est montrée, lecture comprise ; null pour un refus. */
  ms: number | null
}

export const estUnRefus = (s: Saut) => s.choix === null

/** Ce que coûte un saut : rien sans faute, une barre sinon — réponse fausse ou refus. */
export function penaliteDuSaut(s: Saut): number {
  return s.juste && s.choix !== null ? 0 : PENALITE_D_UNE_BARRE
}

/**
 * Le temps qu'un saut ajoute au chrono : son temps, jamais plus que celui de
 * l'obstacle — une réponse livrée pendant la marge du réseau ne coûte pas plus
 * que d'avoir attendu la fin —, et tout le temps de l'obstacle pour un refus.
 */
export function tempsDuSaut(s: Saut, dureeMs: number): number {
  if (s.choix === null || s.ms === null) return dureeMs
  return Math.max(0, Math.min(Math.round(s.ms), dureeMs))
}

export interface ScoreDeCourse {
  /** Les points de pénalité : quatre par barre tombée ou refus. */
  points: number
  /** Le chrono : la somme des temps de chaque saut, en millisecondes. */
  tempsMs: number
  /** Les barres tombées et les refus, ensemble. */
  barres: number
  /** Les obstacles sautés. */
  sautes: number
}

export const SCORE_DE_DEPART: ScoreDeCourse = { points: 0, tempsMs: 0, barres: 0, sautes: 0 }

/** Le score d'une course après ces sauts, chacun avec le temps de son obstacle. */
export function scoreDe(sauts: readonly { saut: Saut; dureeMs: number }[]): ScoreDeCourse {
  return sauts.reduce<ScoreDeCourse>((s, { saut, dureeMs }) => {
    const penalite = penaliteDuSaut(saut)
    return {
      points: s.points + penalite,
      tempsMs: s.tempsMs + tempsDuSaut(saut, dureeMs),
      barres: s.barres + (penalite > 0 ? 1 : 0),
      sautes: s.sautes + 1,
    }
  }, SCORE_DE_DEPART)
}

/**
 * Battre le fantôme : moins de points, ou autant et un chrono plus court. Une
 * égalité parfaite ne bat pas — « battre », c'est faire mieux.
 */
export function bat(a: Pick<ScoreDeCourse, 'points' | 'tempsMs'>, b: Pick<ScoreDeCourse, 'points' | 'tempsMs'>): boolean {
  return a.points < b.points || (a.points === b.points && a.tempsMs < b.tempsMs)
}

/**
 * La valeur d'une course pour `classer` (`shared/classement.ts`, invariant
 * 15) : les points d'abord, puis le chrono — en un seul nombre entier, du plus
 * haut au plus bas. Un chrono tient sous dix millions de millisecondes : dix
 * obstacles de vingt secondes en font deux cent mille.
 */
export function valeurDeLaCourse(s: Pick<ScoreDeCourse, 'points' | 'tempsMs'>): number {
  return -(s.points * 10_000_000 + Math.min(Math.max(0, Math.round(s.tempsMs)), 9_999_999))
}

/** Un chrono à la française, au dixième : « 58,2 s ». */
export function chronoDit(ms: number): string {
  return `${(Math.round(ms / 100) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`
}

/** Des points de pénalité à la française : « 0 pt », « 8 pts ». */
export const pointsDits = (points: number) => `${points} ${points > 1 ? 'pts' : 'pt'}`

// ── Le rythme du fantôme ─────────────────────────────────────────────────

/**
 * Le temps qu'aurait mis le fantôme à une question qu'il a jouée sans chrono
 * (la campagne n'en a pas) : tiré parmi ses vrais temps du quiz du jour, ceux
 * d'une réponse du même verdict — il répond plus vite quand il sait (5,2 s
 * contre 7,3 s pour la première fantôme mesurée). Sans aucun temps à lui, la
 * médiane de tous les joueurs du quiz du jour, 5,4 s le 19 novembre 2026.
 */
export const RYTHME_DE_TOUS_MS = 5400

export function tirerUnRythme(
  sesTemps: { justes: readonly number[]; faux: readonly number[] },
  juste: boolean,
  aleatoire: () => number,
): number {
  const memes = juste ? sesTemps.justes : sesTemps.faux
  const autres = juste ? sesTemps.faux : sesTemps.justes
  const parmi = memes.length > 0 ? memes : autres
  if (parmi.length === 0) return RYTHME_DE_TOUS_MS
  return Math.round(parmi[Math.min(parmi.length - 1, Math.floor(aleatoire() * parmi.length))])
}

// ── Le tirage d'un parcours ──────────────────────────────────────────────

/**
 * Les obstacles d'une course neuve, en rangs du vivier : dix questions que ce
 * coureur n'a pas encore courues dans ce Grand Prix — « un parcours neuf à
 * chaque départ » : rejouées, il connaîtrait les réponses —, et d'abord celles
 * qu'il n'a jamais vues en campagne (`dejaVues` : un duel sur le même thème
 * lui en aurait montré), prises tour à tour dans chaque thème du terrain (4,
 * 3, 3 sur trois thèmes) : le fantôme se bat sur chacun, pas seulement sur
 * celui où il a le plus joué. Vivier épuisé, les déjà vues, puis les moins
 * récemment courues reviennent, celles de la course d'avant en dernier.
 */
export function tirerLeParcours(
  vivier: readonly { rang: number; theme?: string | null }[],
  dejaCourues: ReadonlyMap<number, number>,
  aleatoire: () => number,
  combien = OBSTACLES_DU_GRAND_PRIX,
  dejaVues: ReadonlySet<number> = new Set(),
): number[] {
  const melanger = <T>(xs: T[]): T[] => {
    const a = [...xs]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(aleatoire() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  const pris: number[] = []
  const prendre = (xs: { rang: number }[], n: number) => {
    for (const q of xs) {
      if (pris.length >= combien || n <= 0) break
      if (!pris.includes(q.rang)) {
        pris.push(q.rang)
        n--
      }
    }
  }
  // Une file par thème, chacune mélangée, les thèmes dans un ordre tiré : la première file donne la quatrième.
  const tourATour = (xs: readonly { rang: number; theme?: string | null }[]) => {
    const parTheme = new Map<string, { rang: number }[]>()
    for (const q of xs) parTheme.set(q.theme ?? '', [...(parTheme.get(q.theme ?? '') ?? []), q])
    const files = melanger([...parTheme.values()].map(f => melanger(f)))
    while (pris.length < combien && files.some(f => f.length > 0)) {
      for (const f of files) {
        const q = f.shift()
        if (q && pris.length < combien && !pris.includes(q.rang)) pris.push(q.rang)
      }
    }
  }
  const neuves = vivier.filter(x => !dejaCourues.has(x.rang))
  tourATour(neuves.filter(x => !dejaVues.has(x.rang)))
  tourATour(neuves.filter(x => dejaVues.has(x.rang)))
  if (pris.length < combien) {
    // Les plus anciennes d'abord : l'ordre dans lequel il les a courues.
    const revues = melanger(vivier.filter(q => dejaCourues.has(q.rang))).sort((a, b) => (dejaCourues.get(a.rang) ?? 0) - (dejaCourues.get(b.rang) ?? 0))
    prendre(revues, combien - pris.length)
  }
  return melanger(pris)
}

// ── Ce que la page reçoit ────────────────────────────────────────────────

/** Le fantôme tel que la page le montre : son prénom et son avatar, tel qu'il le porte. */
export interface FantomeVu extends ApparenceDeLAvatar {
  id: string
  nom: string
  avatar: string
}

/**
 * Un thème de son terrain — un sujet ou une rubrique de la campagne
 * (`shared/sujets.ts`) —, tel qu'il était le jour où le QG l'a choisi : les
 * réponses qu'il y a données en le choisissant, et sa part de bonnes.
 */
export interface ThemeDuTerrain {
  /** La clé du sujet ou de la rubrique : « disney », « arts-lettres/peinture ». */
  cle: string
  nom: string
  /** Ses réponses aux QCM des parties qu'il a jouées sur ce thème — le temps qu'il y a passé. */
  reponses: number
  /** Sa part de bonnes réponses, en pour cent. */
  pourcent: number
}

/**
 * Le terrain : les thèmes où il a passé le plus de temps, trois au plus —
 * « je préférerais que ce soit là où elle a passé le plus de temps […] c'est
 * juste que si tu vas loin tu fais plus de fautes » (le propriétaire, le
 * 19 novembre 2026, contre ses trois meilleures parts, qu'on avait d'abord
 * proposées). Le QG les propose dans cet ordre, les trois premiers cochés.
 * Le Grand Prix le met en valeur sur ce qu'il aime.
 */
export const THEMES_DU_TERRAIN = 3

/** Il faut au moins un parcours entier, et un peu de choix : deux parcours, sur son terrain. */
export const QUESTIONS_POUR_COURIR = OBSTACLES_DU_GRAND_PRIX * 2

export interface GrandPrixVu {
  id: string
  titre: string
  /** Le jour où il court, à Paris : « 2026-12-05 ». */
  jour: string
  ruban: CleDeRuban
  fantome: FantomeVu
  /** L'avatar peint qu'on gagne en plus du flot (`lg:pegase`), ou null. */
  prix: string | null
  /** Son terrain : les thèmes où il se bat. */
  terrain: ThemeDuTerrain[]
}

/** Un obstacle servi : la question, sans sa bonne réponse ni son anecdote (invariant 1). */
export interface ObstacleVu {
  position: number
  texte: string
  reponses: string[]
  categorie: string | null
  duree: number
  /** L'échéance de l'obstacle, à l'horloge du serveur (`serverNow`, invariant 6). */
  echeance: number
  /**
   * Quand le fantôme a sauté, en millisecondes depuis que la question s'est
   * montrée ; null s'il a refusé. Son temps seul : sa réponse, et si sa barre
   * est tombée, n'arrivent qu'avec la révélation.
   */
  fantomeMs: number | null
}

/** Un saut tel que la révélation le dit. */
export interface SautVu extends Saut {
  tempsMs: number
  penalite: number
}

export interface RevelationDObstacle {
  position: number
  texte: string
  reponses: string[]
  bonne: number
  anecdote: string | null
  categorie: string | null
  toi: SautVu
  fantome: SautVu
}

/** Ce que la fin d'une course a fait tomber. */
export interface FinDeCourse {
  battu: boolean
  /** Son rang parmi ceux qui ont battu le fantôme, dans l'ordre d'arrivée (« 8ᵉ à la battre ») ; null s'il n'a pas battu. */
  rang: number | null
  /** Le flot tombe à la première victoire. */
  flot: boolean
  /** L'avatar en plus qui vient de tomber, ou null. */
  prix: string | null
}

export interface CourseVue {
  id: string
  /** Le nombre d'obstacles déjà sautés. */
  position: number
  total: number
  /** L'obstacle en cours, servi ; null entre deux obstacles ou à la fin. */
  obstacle: ObstacleVu | null
  /** Les obstacles déjà sautés, révélés. */
  revelations: RevelationDObstacle[]
  toi: ScoreDeCourse
  fantome: ScoreDeCourse
  finie: boolean
  fin: FinDeCourse | null
  /** Un essai de l'administrateur : hors classement, sans flot. */
  essai: boolean
}

export interface VainqueurVu extends ApparenceDeLAvatar {
  id: string
  nom: string
  avatar: string
  /** L'ordre d'arrivée : le premier à avoir battu le fantôme est 1. */
  rang: number
  points: number
  tempsMs: number
  /** Ses départs, victoire comprise. */
  departs: number
}

/** Ce que la personne fêtée lit de sa journée : le bilan de son fantôme. */
export interface BilanDuFantome {
  coureurs: number
  departs: number
  vainqueurs: number
  /** Ceux que son fantôme tient en échec : partis, jamais vainqueurs, les plus obstinés d'abord. */
  tenus: (ApparenceDeLAvatar & { id: string; nom: string; avatar: string; departs: number })[]
  /** Sa question la plus redoutable : celle où le plus de coureurs ont fait tomber la barre. */
  redoutable: { texte: string; tombees: number; sur: number } | null
}

export interface EtatDuGrandPrix {
  /** L'heure du serveur, pour l'échéance d'un obstacle (`avecLHeure`). */
  maintenant: number
  /** Le Grand Prix d'aujourd'hui, ou null. */
  grandPrix: GrandPrixVu | null
  /** Sa course en route, ou null. */
  course: CourseVue | null
  /** Ses départs finis. */
  departs: number
  /** Sa meilleure course finie, ou null. */
  meilleure: Pick<ScoreDeCourse, 'points' | 'tempsMs'> | null
  /** Son rang parmi les vainqueurs, s'il l'a battu. */
  rang: number | null
  vainqueurs: VainqueurVu[]
  /** Ceux qui ont couru au moins une fois. */
  coureurs: number
  /** Le fantôme lui-même lit son bilan ; null pour les autres. */
  bilan: BilanDuFantome | null
  /** Ce que la personne fêtée a reçu : l'avatar en plus dans sa version à elle ; null pour les autres. */
  fete: { prix: string | null; mot: string | null } | null
}

/** Le Grand Prix du jour sur l'accueil : il prend la place de l'affiche d'une nouveauté. */
export interface GrandPrixDAccueil {
  id: string
  titre: string
  ruban: CleDeRuban
  fantome: FantomeVu
  /** Il l'a déjà battu aujourd'hui. */
  battu: boolean
  vainqueurs: number
  /** C'est son Grand Prix à lui : il est le fantôme. */
  fete: boolean
  /** Le mot de l'administrateur, pour la fêtée seule. */
  mot: string | null
  /** L'avatar en plus dans sa version à elle, pour la fêtée seule. */
  prixFete: string | null
  nomDuPrixFete: string | null
  /** L'avatar en plus que gagnent les autres. */
  prix: string | null
  /** Son terrain : la fêtée lit où on la défie, les autres où la battre. */
  terrain: ThemeDuTerrain[]
}

/** Un flot de « Tes Grands Prix », au carnet des fêtes de « Ma collection » : le Grand Prix — l'avatar du fantôme tel qu'il le portait ce jour-là —, et sa course. */
export interface FlotDuCarnet {
  grandPrix: GrandPrixVu
  /** Le flot d'honneur : il était la personne fêtée, le fantôme. */
  honneur: boolean
  /** Sa meilleure course victorieuse ; null pour un flot d'honneur. */
  points: number | null
  tempsMs: number | null
  /** Son rang d'arrivée parmi ceux qui ont battu le fantôme ; null pour un flot d'honneur. */
  rang: number | null
  /** Ceux qui ont couru ce Grand Prix. */
  sur: number
}

/** Un Grand Prix au QG : ce qu'il est, et ce qui s'y est couru. */
export interface GrandPrixAuQg {
  id: string
  /** Tel que les joueurs le verront au cœur du flot — figé, s'il a couru. */
  fantome: FantomeVu | null
  jour: string
  titre: string
  ruban: CleDeRuban
  mot: string | null
  prix: string | null
  prixFete: string | null
  terrain: ThemeDuTerrain[]
  vivier: { jour: number; campagne: number }
  coureurs: number
  departs: number
  vainqueurs: number
}

/** La page du Grand Prix au QG : les Grands Prix, et ce qu'on peut y mettre en jeu. */
export interface PageDesGrandsPrix {
  /** Le jour de Paris à l'horloge du serveur : avant lui, un Grand Prix se change encore ; à lui, il court. */
  aujourdhui: string
  grandsPrix: GrandPrixAuQg[]
  prix: { cle: string; nom: string }[]
  rubans: { cle: CleDeRuban; nom: string; rond: string; pli: string }[]
}

/**
 * Ce que le QG lit d'un fantôme avant de le programmer : ses thèmes, du plus
 * joué au moins joué — chacun ses réponses à rejouer —, et le terrain
 * d'office, ses trois premiers.
 */
export interface ApercuDuFantome {
  id: string
  nom: string
  themes: ThemeDuTerrain[]
  parDefaut: string[]
}

