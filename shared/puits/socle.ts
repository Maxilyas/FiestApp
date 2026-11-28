// Le puits du Sphinx : le socle des énigmes qu'on joue.
//
// Né de deux maquettes du 28 novembre 2026 (`retours/2026-11-28/`). Le
// propriétaire voulait « vraiment beaucoup d'énigmes sur une grande variété de
// sujets et de types », et « un jeu qui est modulaire et que l'on peut tester et
// utiliser sur plusieurs jeux ». D'où trois étages :
//
//   - une ÉNIGME est une fiche : son récit, sa source, ses pièces — des données ;
//   - un MOULE est une façon de jouer (traverser, verser, poser des reines…) : il
//     sait partir d'une fiche, appliquer un coup, dire si c'est fini ;
//   - un SOCLE est ce que des moules partagent, et la façon dont on les vérifie.
//
// Tout ici est pur. C'est ce qui laisse le serveur rejouer une partie coup par
// coup pour la juger, le téléphone la jouer sans attendre, et les tests résoudre
// chaque énigme avant qu'elle entre (`server/test/puits-enigmes.test.ts`).

/** Les six socles : ce qu'on fait dans une énigme, et donc ce que le programme en vérifie. */
export type Socle = 'chemin' | 'pose' | 'preuve' | 'sonde' | 'duel' | 'lettre'
export const SOCLES: Record<Socle, { nom: string; dit: string }> = {
  chemin: { nom: 'Le Chemin', dit: 'Une suite de coups, jusqu’au but.' },
  pose: { nom: 'La Pose', dit: 'Placer ou tracer, sous une contrainte.' },
  preuve: { nom: 'La Preuve', dit: 'Des indices, une seule conclusion.' },
  sonde: { nom: 'La Sonde', dit: 'Le Sphinx cache quelque chose : questionne-le.' },
  duel: { nom: 'Le Duel', dit: 'Tu joues contre lui, et il ne se trompe jamais.' },
  lettre: { nom: 'La Lettre', dit: 'Des mots, des chiffres, des codes.' },
}
export const ORDRE_DES_SOCLES = Object.keys(SOCLES) as Socle[]

/** De la plus facile à la plus dure : c'est le niveau qui dit de combien de paliers une énigme fait descendre. */
export type Niveau = 1 | 2 | 3 | 4 | 5

/** Ce que toute fiche dit, quel que soit son moule. Chaque moule y ajoute ses pièces. */
export interface Fiche {
  /** Son nom de code : il ne change jamais, les parties s'y rattachent. */
  id: string
  moule: string
  niveau: Niveau
  titre: string
  /** D'où vient l'énigme : un auteur, un titre, une année — ou le modèle dont le programme l'a tirée. */
  source: string
  /** Ce que le Sphinx raconte avant qu'on joue, phrase par phrase. */
  recit: readonly string[]
  /** La règle en une ligne, écrite au-dessus du plateau. */
  regle: string
  /** Une preuve ou une lettre se tranche d'une réponse : combien d'essais avant qu'elle s'ensable. */
  essais?: number
  /** Une sonde : combien de questions au plus. */
  coupsMax?: number
  /** Une énigme sans solution, et il faut le dire. */
  impossible?: boolean
  /** La solution en mots, quand elle ne se rejoue pas sur le plateau. */
  explication?: readonly string[]
  /** Fabriquée par son moule (`tirer`), pas écrite : c'est par elles que le puits n'a pas de fond. */
  tiree?: boolean
}

export type Fin = { gagne: true } | { perdu: string } | null
export type Joue<E> = { etat: E; refus?: undefined } | { refus: string; etat?: undefined }

/** Ce que le programme sait d'une fiche avant qu'elle entre. */
export interface Verdict<C = unknown> {
  ok: boolean
  /** Le plus petit nombre de coups (un chemin), de pièces (une pose), de questions qui suffit toujours (une sonde). */
  coups?: number
  /** Une suite de coups qui gagne, que `jouer` accepte un à un. */
  solution?: C[]
  note?: string
}

/**
 * Un moule. Sa règle ne connaît que de vrais coups : ce qu'on choisit à l'écran
 * avant de jouer — qui embarque, quelle cruche on tient — vit dans l'écran, pas
 * ici. C'est ce qui rend une partie rejouable d'après la seule liste de ses coups.
 */
export interface Moule<F extends Fiche = Fiche, E = unknown, C = unknown> {
  cle: string
  /** Sa catégorie, telle qu'on la lit : « Les traversées ». */
  nom: string
  socle: Socle
  /** Ce que compte un coup, au singulier et au pluriel. */
  unite: readonly [string, string]
  /** `tour` compte les fois où le joueur a recommencé : un secret s'y retire. */
  depart(f: F, tour: number): E
  jouer(f: F, e: E, coup: C): Joue<E>
  fini(f: F, e: E): Fin
  /** Tous les coups permis : c'est par là qu'un chemin se résout. */
  coups?(f: F, e: E): C[]
  /** Un état en peu de mots, quand son JSON pèserait sur le parcours. */
  signature?(e: E): string
  /** Dans un duel, le coup du Sphinx. Son hasard lui est donné : le serveur doit pouvoir le rejouer. */
  riposte?(f: F, e: E, hasard: () => number): C
  verifier?(f: F): Verdict<C>
  /** Fabrique une énigme : même graine, même énigme. */
  tirer?(graine: number, niveau: Niveau): F
  /** Ce que l'en-tête dit à la place du compte des coups (« 12 min sur 18 »). */
  jauge?(f: F, e: E): string | null
}

/** Un moule dont on ne sait pas le détail : ce que le serveur et l'écran manient, chaque moule ayant sa fiche, son état et son coup. */
export type MouleQuelconque = Moule<any, any, any>

/* ------------------------------------------------------------------ */
/* Le hasard, toujours le même pour une même graine                    */
/* ------------------------------------------------------------------ */

/** Une énigme tirée se retrouve telle quelle : le palier 40 du puits est le même à chaque visite, sur le serveur comme au téléphone. */
export function alea(graine: number): () => number {
  let a = (graine >>> 0) || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const entier = (hasard: () => number, a: number, b: number): number => a + Math.floor(hasard() * (b - a + 1))
export const parmi = <T>(hasard: () => number, liste: readonly T[]): T => liste[Math.floor(hasard() * liste.length)]!
export function melanger<T>(hasard: () => number, liste: readonly T[]): T[] {
  const l = liste.slice()
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1))
    ;[l[i], l[j]] = [l[j]!, l[i]!]
  }
  return l
}
/** Une graine tirée d'un texte : le hasard d'une partie se retrouve d'après son nom. */
export function graineDe(texte: string): number {
  let h = 2166136261
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619)
  return h >>> 0
}

/* ------------------------------------------------------------------ */
/* Résoudre                                                            */
/* ------------------------------------------------------------------ */

const signatureDe = <E>(m: Moule<Fiche, E, unknown>, e: E): string => (m.signature ? m.signature(e) : JSON.stringify(e))

/** Le plus court chemin d'une fiche : null si elle n'a pas de solution (ou si le parcours dépasse `max` états). */
export function plusCourt<F extends Fiche, E, C>(m: Moule<F, E, C>, f: F, max = 400_000): { coups: number; solution: C[] } | null {
  if (!m.coups) return null
  const sig = (e: E) => signatureDe(m as unknown as Moule<Fiche, E, unknown>, e)
  const depart = m.depart(f, 0)
  const vus = new Map<string, { d: string; coup: C } | null>([[sig(depart), null]])
  let front: E[] = [depart]
  let profondeur = 0
  while (front.length && vus.size <= max) {
    const suivant: E[] = []
    for (const e of front) {
      const fin = m.fini(f, e)
      if (fin && 'gagne' in fin) {
        const solution: C[] = []
        for (let k = sig(e); vus.get(k); k = vus.get(k)!.d) solution.unshift(vus.get(k)!.coup)
        return { coups: profondeur, solution }
      }
      for (const coup of m.coups(f, e)) {
        const r = m.jouer(f, e, coup)
        if (!r.etat) continue
        const apres = m.fini(f, r.etat)
        if (apres && 'perdu' in apres) continue
        const k = sig(r.etat)
        if (vus.has(k)) continue
        vus.set(k, { d: sig(e), coup })
        suivant.push(r.etat)
      }
    }
    front = suivant
    profondeur++
  }
  return null
}

/** Ce que le programme sait d'une fiche : son moule le dit, sinon le plus court chemin. */
export function verifier<F extends Fiche, E, C>(m: Moule<F, E, C>, f: F): Verdict<C> {
  if (m.verifier) return m.verifier(f)
  const r = plusCourt(m, f)
  return r ? { ok: true, coups: r.coups, solution: r.solution } : { ok: false, note: 'aucune solution' }
}

/* ------------------------------------------------------------------ */
/* Rejouer                                                             */
/* ------------------------------------------------------------------ */

/** Où en est une partie, d'après la seule liste de ses coups. */
export interface Rejeu<E> {
  etat: E
  /** Les coups qui ont compté depuis le dernier départ. */
  coups: number
  /** Les fois où l'énigme est repartie du début : une défaite, ou « Recommencer ». */
  tours: number
  /** Les défaites : dans un duel, les parties perdues ; ailleurs, les essais dépensés. */
  defaites: number
  fin: Fin
}

/** Le hasard du Sphinx à tel coup de telle partie : le même au téléphone et au serveur. */
export const hasardDuCoup = (graine: number, rang: number): (() => number) => alea(graine * 31 + rang * 7919 + 1)

/** Un geste d'une partie : un coup du moule, ou l'énigme reprise du début. */
export type Geste<C = unknown> = { coup: C } | { recommence: true }

/**
 * Rejoue une partie depuis son départ. C'est le seul chemin : le téléphone y
 * passe pour montrer l'énigme, le serveur pour la juger — une partie qu'on dit
 * gagnée l'est parce que ses coups, rejoués ici, mènent au but.
 * Un geste refusé arrête le rejeu et se rend (`refus`) : la liste était fausse.
 */
export function rejouer<F extends Fiche, E, C>(m: Moule<F, E, C>, f: F, graine: number, gestes: readonly Geste<C>[]): Rejeu<E> & { refus?: string; lus: number } {
  let tours = 0
  let defaites = 0
  let coups = 0
  let etat = m.depart(f, 0)
  let fin: Fin = null
  let lus = 0
  const repartir = () => { tours++; coups = 0; etat = m.depart(f, tours); fin = null }
  for (const [rang, geste] of gestes.entries()) {
    // Une partie gagnée ne se rejoue pas ; une défaite, elle, a déjà fait repartir l'énigme.
    if (fin && 'gagne' in fin) return { etat, coups, tours, defaites, fin, refus: 'La partie est finie.', lus }
    if ('recommence' in geste) { repartir(); lus++; continue }
    const r = m.jouer(f, etat, geste.coup)
    if (!r.etat) return { etat, coups, tours, defaites, fin, refus: r.refus, lus }
    etat = r.etat
    coups++
    lus++
    fin = m.fini(f, etat)
    if (!fin && m.riposte) {
      const reponse = m.jouer(f, etat, m.riposte(f, etat, hasardDuCoup(graine, rang)))
      if (reponse.etat) { etat = reponse.etat; fin = m.fini(f, etat) }
    }
    if (fin && 'perdu' in fin) {
      defaites++
      // Les essais épuisés, l'énigme ne repart plus : elle s'ensable sur cette défaite.
      if (f.essais != null && defaites >= f.essais) return { etat, coups, tours, defaites, fin, lus }
      const perdue = fin
      repartir()
      fin = lus === gestes.length ? perdue : null
    }
  }
  return { etat, coups, tours, defaites, fin, lus }
}

/* ------------------------------------------------------------------ */
/* Compter                                                             */
/* ------------------------------------------------------------------ */

/** De combien de paliers une énigme fait descendre : on choisit sa corde et son risque. */
export const chuteDe = (niveau: Niveau): number => (niveau <= 2 ? 1 : niveau === 3 ? 2 : 3)
/** Le niveau qu'un palier vise : il monte d'un cran tous les six paliers. */
export const niveauDuPalier = (palier: number): Niveau => Math.min(5, 1 + Math.floor(palier / PALIERS_PAR_NIVEAU)) as Niveau
export const PALIERS_PAR_NIVEAU = 6
/** Ce qu'un palier pèse sous le sable, pour le dire en mètres. */
export const METRES_PAR_PALIER = 5

/**
 * Les étoiles d'une énigme résolue, contre la meilleure façon possible — que le
 * programme connaît. Chaque socle la compte à sa manière : un chemin à ses
 * coups, un duel à ses parties perdues, une preuve à ses essais.
 */
export function etoilesDe(m: MouleQuelconque, f: Fiche, verdict: Verdict, r: Pick<Rejeu<unknown>, 'coups' | 'tours' | 'defaites'>): 1 | 2 | 3 {
  if (f.essais != null) return r.defaites === 0 ? 3 : r.defaites === 1 ? 2 : 1
  if (m.socle === 'duel') return r.defaites === 0 ? 3 : r.defaites <= 2 ? 2 : 1
  if (m.socle === 'sonde') return verdict.coups != null && r.coups <= verdict.coups ? 3 : 2
  if (m.socle === 'pose' || verdict.coups == null) return r.tours === 0 ? 3 : 2
  return r.coups <= verdict.coups ? 3 : r.coups <= verdict.coups * 1.5 ? 2 : 1
}

export const pluriel = (n: number, mot: string, mots = mot + 's'): string => `${n} ${n > 1 ? mots : mot}`
