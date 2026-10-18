// L'Expédition (le brief : `retours/2026-10-17/expedition.md`, validé par le
// propriétaire le 17 octobre 2026 — « on fait que rajouter des choses mais on
// ne sait plus quoi choisir ») : trois actes, chacun une carte tirée au sort,
// un gardien au bout de chacun, et un légendaire à garder au bout du
// troisième. Tout ce qui se calcule est ici, pur : le serveur tire et juge
// (invariant 1), la page dessine et conseille.
//
// L'état d'une expédition n'est écrit nulle part : il se replie de son départ
// (ses trois cartes, ses gardiens), de son journal de gestes et de ses
// réponses (`pliDeLExpedition`) — le même pli pour l'expédition qu'on joue et
// pour une finie (invariant 14). Le hasard se rejoue de la graine
// (`hasardDe`) : recharger ne retire rien.

import { hasardDe } from './missions'
import { CATEGORIES } from './categories'
import { VIES, type Niveau, type QuestionDeCampagne } from './campagne'
import { TAUX_DU_CALIBRAGE, couleurDePiste, type CouleurDePiste } from './sentiers'
import { LEGENDAIRES, legendaire } from './legendaires'
import {
  EFFACE,
  JOKERS_PAR_OFFRE,
  JOKERS_SANS_LEGENDAIRE,
  LEGENDAIRES_A_JOKER,
  MAIN_MAX,
  MAIN_MAX_DES_TROIS_TETES,
  PAQUET_DE_DEPART,
  PLACES_DE_L_EQUIPEE,
  POIDS_DES_RARETES,
  TALISMANS,
  joker as jokerDeCle,
  jokerDuLegendaire,
} from './jokers'
import { SOUS_THEMES } from './etiquettes'
import { lireNombreEnTete } from './nombres'
import type { PalierTombe } from './jour'
import type { CleDeSaison } from './saisons'
import { FAMILLES_DE_SUJETS, SUJETS, type FamilleDeSujet } from './sujets'
import {
  BONNES_D_AFFILEE,
  PARI_DE_L_EXPLOIT,
  niveauDeLaRegle,
  offreDuCodex,
  regleOuverte,
  type BilanDUneExpedition,
  type CleDExploit,
  type CodexDuDepart,
  type RegleDuCodex,
} from './codex'
import {
  COURAGE_A_L_ECHOPPE,
  COURAGE_D_UN_CAMPEMENT,
  COURAGE_D_UN_PIEGE,
  COURAGE_D_UNE_SOURCE,
  COURAGE_DE_LA_RENAISSANCE,
  COURAGE_DE_L_AUBE,
  COURAGE_DES_ABYSSES,
  COURAGE_MAX,
  COUT_DES_ABYSSES,
  ECUS_AU_DEPART,
  INSPIRATION_PAR_QUESTION,
  MISES,
  SAVOIR_DES_MARCHES,
  SEUIL_DES_ABYSSES,
  VERSION_DU_CODEX,
  adversaireDe,
  apercuDuTour,
  brisesDUneBonneReponse,
  carteALaVersion,
  carteDeRencontre,
  carteDuLegendaire,
  cartesDeCombat,
  cartesParQuestion,
  chiffresApresLaCarte,
  effaceesDuTour,
  enJeu,
  enPlusDeLaBibliotheque,
  estDeRoute,
  famillesDeLEquipee,
  frappeDUneErreur,
  frappeDe,
  frappeDeLaQuestion,
  gainDeLaMise,
  multiplicateurDeLaForme,
  offreDeCartes,
  paquetDesRencontres,
  raretesDeLOffre,
  refusDeLaCarte,
  sceauxDe,
  type AnnonceDuTour,
  type ContexteDUneCarte,
  type CoupDeRencontre,
  type QuestionDuTour,
  type RencontreEnCours,
  type SorteDeRencontre,
  type VueDeLaRencontre,
} from './rencontres'

export { EXPEDITION_EN_PRODUCTION } from './jokers'
export { RENCONTRES_EN_PRODUCTION } from './rencontres'

export const ACTES = 3
export const ETAGES = 6
export const COLONNES = 4
/** Les chemins qui montent du bas : leurs pas font les escales et les liens. */
export const CHEMINS = 5

/**
 * Une escale de la carte. Le gardien est la dernière de chaque acte, après
 * les campements. Le générateur tire toutes les sortes du brief depuis les
 * écus (l'étape 4) ; avant eux, il posait une question à la place d'une
 * échoppe ou de l'inconnu — les élites et les coffres sont venus avec les
 * jokers (l'étape 2). Une carte d'avant, gardée par son expédition, garde
 * ses escales.
 */
export type SorteDEscale = 'question' | 'elite' | 'source' | 'coffre' | 'inconnu' | 'echoppe' | 'campement' | 'gardien'

/**
 * Ce que cache l'inconnu (l'étape 4) : un marchand — une échoppe —, un piège
 * — une vie —, ou un légendaire de passage, dont le joker reste dans la main
 * jusqu'au bout de l'acte. Tiré de la graine et de l'escale : la carte le sait
 * dès le départ, mais la page ne le reçoit qu'une fois dévoilé (invariant 1).
 */
export type ContenuDeLInconnu = 'marchand' | 'piege' | 'passage'

export type FormeDEscale = 'quatre' | 'vrai-faux' | 'six' | 'devoilement'

/**
 * Les formes qu'une carte tire : toutes depuis l'étape 3 — quatre choix,
 * vrai ou faux, six choix, dévoilement. Celles d'avant, gardées par leur
 * expédition, restent à quatre choix.
 */
const FORMES_OUVERTES: ReadonlySet<FormeDEscale> = new Set(['quatre', 'vrai-faux', 'six', 'devoilement'])

/** Le thème d'une escale : une catégorie, un mélange de deux ou trois, ou un sujet de `shared/sujets.ts` — un thème pointu. */
export type ThemeDEscale = { categories: string[] } | { sujet: string }

export interface EscaleDeLaCarte {
  /** `e23` (étage 2, colonne 3), `cg` et `cd` pour les campements, `g` pour le gardien. */
  id: string
  /** De 0 (le bas) à 5 ; les campements sont à `ETAGES`, le gardien au-dessus. */
  etage: number
  /** De 0 à 3 ; un campement, 0 (gauche) ou 1 (droite). */
  colonne: number
  sorte: SorteDEscale
  theme?: ThemeDEscale
  forme?: FormeDEscale
  /** Les escales où l'on peut aller ensuite. */
  suite: string[]
  /** La chance qu'il la trouve, de 0 à 1, calculée au départ de l'expédition et gardée avec elle. */
  chance?: number
  /** L'inconnu dévoilé — par la boussole, la lanterne, ou parce qu'il y est passé : jamais gardé avec la carte, la vue seule le pose. */
  contenu?: ContenuDeLInconnu
  /** Un thème pointu dont son passeport n'a pas encore le tampon : la vue seule le pose, jamais la carte gardée. */
  aTamponner?: true
}

export interface CarteDUnActe {
  escales: EscaleDeLaCarte[]
  /** Les escales du bas : celles qu'on peut prendre en entrant dans l'acte. */
  depart: string[]
  /** Sa chance sur chaque question du gardien. */
  chanceDuGardien?: number
}

/**
 * La marche de chaque acte (le calibrage du brief : le joueur moyen au bout
 * une fois sur trois, le fort huit fois sur dix). Jamais d'experte : le
 * joueur moyen en trouve une sur dix, moins que le hasard. Le gardien
 * tombe à sa `aTrouver`-ième bonne réponse ; chaque erreur coûte une vie.
 * Des choix de produit (`docs/reference/baremes.md`).
 */
export const MARCHES_DES_ACTES: readonly { bas: Niveau; haut: Niveau; elite: Niveau; gardien: Niveau; aTrouver: number }[] = [
  { bas: 'facile', haut: 'facile', elite: 'moyen', gardien: 'facile', aTrouver: 4 },
  { bas: 'facile', haut: 'moyen', elite: 'moyen', gardien: 'moyen', aTrouver: 3 },
  { bas: 'moyen', haut: 'moyen', elite: 'difficile', gardien: 'difficile', aTrouver: 3 },
]

/** Les étages du bas d'un acte (0 à 2) prennent sa marche basse, ceux du haut (3 à 5) sa marche haute. */
const ETAGES_DU_BAS = 3

/**
 * Le poids de chaque sorte aux étages 2 à 6 — le premier étage n'a que des
 * questions —, et ce qu'un acte en tient au plus. Ce qu'un plafond refuse, et
 * le reste, devient une question. Des choix de produit.
 */
export type PoidsDesEscales = readonly { sorte: SorteDEscale; part: number; auPlus?: number; desLEtage?: number }[]
export const POIDS_DES_ESCALES: PoidsDesEscales = [
  { sorte: 'question', part: 0.46 },
  { sorte: 'elite', part: 0.12, auPlus: 2, desLEtage: 2 },
  { sorte: 'source', part: 0.1 },
  { sorte: 'coffre', part: 0.12 },
  { sorte: 'inconnu', part: 0.08, auPlus: 2 },
  { sorte: 'echoppe', part: 0.05, auPlus: 1 },
]
/**
 * Les cartes d'un départ en rencontres (la version 6) : plus d'adversaires,
 * une source et un coffre moins souvent — « peut-être plus de monstres à
 * battre, car ça reste simple avec tous les bonus en main » (la revue du
 * 18 octobre 2026). Mesuré par `calibrage-rencontres.ts`. Les cartes d'un
 * départ aux règles d'avant gardent `POIDS_DES_ESCALES`, et une carte tirée
 * reste telle quelle (`DepartDExpedition.cartes`).
 */
export const POIDS_DES_ESCALES_DES_RENCONTRES: PoidsDesEscales = [
  { sorte: 'question', part: 0.58 },
  { sorte: 'elite', part: 0.16, auPlus: 3, desLEtage: 2 },
  { sorte: 'source', part: 0.07 },
  { sorte: 'coffre', part: 0.08 },
  { sorte: 'inconnu', part: 0.04, auPlus: 2 },
  { sorte: 'echoppe', part: 0.04, auPlus: 1 },
]

/** La part des mélanges de deux ou trois catégories, puis des thèmes pointus, parmi les questions des étages 2 à 6. */
export const PART_DES_MELANGES = 0.18
export const PART_DES_THEMES_POINTUS = 0.14
/**
 * À la saison d'une fête (`shared/saisons.ts` : Halloween, Noël, le Nouvel
 * An), la part de ses thèmes pointus qui sont elle — sinon un sujet sur
 * quatre-vingt-douze. Un choix de produit (le 18 octobre 2026 : « ses escales
 * reviennent plus souvent ») : deux escales de la fête par expédition, en
 * moyenne.
 */
export const PART_DE_LA_FETE = 0.5

/** Les formes des étages 2 à 6 ; le premier étage pose quatre choix sept fois sur dix, sinon un vrai ou faux. */
export const POIDS_DES_FORMES: readonly { forme: FormeDEscale; part: number }[] = [
  { forme: 'quatre', part: 0.4 },
  { forme: 'vrai-faux', part: 0.2 },
  { forme: 'six', part: 0.2 },
  { forme: 'devoilement', part: 0.2 },
]

/** L'identifiant du gardien, sur chaque carte. */
export const GARDIEN = 'g'

const idDe = (etage: number, colonne: number) => `e${etage}${colonne}`

/**
 * La carte d'un acte, tirée de la graine de l'expédition : la même graine
 * redonne la même carte. Cinq chemins montent d'une colonne voisine à
 * l'autre sans jamais en croiser un autre ; leurs pas font les escales et les
 * liens. Puis chaque escale prend sa sorte, son thème et sa forme ; une source
 * et un coffre au moins (une question des étages 3 à 5 en devient un : sans
 * eux, aucune route ne laisserait le choix de se soigner ou de s'équiper) ;
 * deux campements au bout — celui de gauche pour les colonnes 1 et 2, celui de
 * droite pour 3 et 4 —, puis le gardien. `sujets` : les thèmes pointus qu'on
 * peut tirer, ceux qui ont assez de questions ; `fete` : celui de la saison du
 * départ, qui en tient la moitié (`PART_DE_LA_FETE`). Sans fête, pas un tirage
 * de plus : hors saison, une graine redonne la carte d'avant les saisons.
 * `poids` : la part de chaque sorte — celle d'un départ en rencontres a plus
 * d'adversaires ; le hasard tiré reste le même, seule la sorte qu'il désigne
 * change.
 */
export function carteDUnActe(graine: string, acte: number, sujets: readonly string[], fete?: string, poids: PoidsDesEscales = POIDS_DES_ESCALES): CarteDUnActe {
  const r = hasardDe(`${graine}:carte:${acte}`)
  const entier = (n: number) => Math.floor(r() * n)
  const liens = new Map<string, number[]>()
  const present = new Set<string>()
  const existe = (f: number, c: number, x: number) => (liens.get(`${f}:${c}`) ?? []).includes(x)
  // Deux pas qui se croisent — l'un de c vers c+1, l'autre de c+1 vers c — font un X illisible.
  const croise = (f: number, c: number, x: number) => (x === c + 1 && existe(f, c + 1, c)) || (x === c - 1 && existe(f, c - 1, c))
  for (let p = 0; p < CHEMINS; p++) {
    let c = p < COLONNES ? p : entier(COLONNES)
    present.add(`0:${c}`)
    for (let f = 0; f < ETAGES - 1; f++) {
      const options = [c - 1, c, c + 1].filter(x => x >= 0 && x < COLONNES)
      for (let i = options.length - 1; i > 0; i--) {
        const j = entier(i + 1)
        ;[options[i], options[j]] = [options[j], options[i]]
      }
      const suivant = options.find(o => !croise(f, c, o)) ?? c
      const cle = `${f}:${c}`
      const deja = liens.get(cle) ?? []
      if (!deja.includes(suivant)) liens.set(cle, [...deja, suivant])
      present.add(`${f + 1}:${suivant}`)
      c = suivant
    }
  }

  const escales: EscaleDeLaCarte[] = []
  const comptes = new Map<SorteDEscale, number>()
  for (let f = 0; f < ETAGES; f++) {
    for (let c = 0; c < COLONNES; c++) {
      if (!present.has(`${f}:${c}`)) continue
      let sorte: SorteDEscale = 'question'
      if (f > 0) {
        const t = r()
        let cumul = 0
        for (const p of poids) {
          cumul += p.part
          if (t < cumul) {
            const refusee = (p.auPlus !== undefined && (comptes.get(p.sorte) ?? 0) >= p.auPlus) || (p.desLEtage !== undefined && f < p.desLEtage)
            sorte = refusee ? 'question' : p.sorte
            break
          }
        }
      }
      comptes.set(sorte, (comptes.get(sorte) ?? 0) + 1)
      const e: EscaleDeLaCarte = { id: idDe(f, c), etage: f, colonne: c, sorte, suite: [] }
      if (sorte === 'question' || sorte === 'elite') {
        const s = r()
        if (f > 0 && s < PART_DES_MELANGES) {
          const combien = r() < 0.5 ? 2 : 3
          const choisies: string[] = []
          while (choisies.length < combien) {
            const cat = CATEGORIES[entier(CATEGORIES.length)]
            if (!choisies.includes(cat)) choisies.push(cat)
          }
          e.theme = { categories: choisies }
        } else if (f > 0 && s < PART_DES_MELANGES + PART_DES_THEMES_POINTUS && sujets.length > 0) {
          e.theme = { sujet: fete && r() < PART_DE_LA_FETE ? fete : sujets[entier(sujets.length)] }
        } else {
          e.theme = { categories: [CATEGORIES[entier(CATEGORIES.length)]] }
        }
        let forme: FormeDEscale = 'quatre'
        if (f === 0) forme = r() < 0.7 ? 'quatre' : 'vrai-faux'
        else {
          const t = r()
          let cumul = 0
          for (const p of POIDS_DES_FORMES) {
            cumul += p.part
            if (t < cumul) {
              forme = p.forme
              break
            }
          }
        }
        e.forme = FORMES_OUVERTES.has(forme) ? forme : 'quatre'
      }
      escales.push(e)
    }
  }

  // Une question des étages 3 à 5 d'abord ; sinon une autre escale de ces étages, puis du reste de la carte — tant que les coffres
  // devenaient des sources, la source ne manquait jamais : une carte sur deux cents n'avait plus de question à changer.
  const pourLaGarantie = (e: EscaleDeLaCarte) => (e.sorte === 'question' ? 0 : 2) + (e.etage >= 2 && e.etage <= 4 ? 0 : 1)
  for (const manque of ['source', 'coffre'] as const) {
    if (escales.some(e => e.sorte === manque)) continue
    const cible = escales
      .filter(e => e.etage >= 1 && (e.sorte === 'question' || e.sorte === 'elite' || e.sorte === 'inconnu' || e.sorte === 'echoppe'))
      .sort((a, b) => pourLaGarantie(a) - pourLaGarantie(b))[0]
    if (cible) {
      cible.sorte = manque
      delete cible.theme
      delete cible.forme
    }
  }

  const parId = new Map(escales.map(e => [e.id, e]))
  for (const e of escales) {
    if (e.etage < ETAGES - 1) e.suite = (liens.get(`${e.etage}:${e.colonne}`) ?? []).map(x => idDe(e.etage + 1, x)).filter(id => parId.has(id))
  }
  const enHaut = escales.filter(e => e.etage === ETAGES - 1)
  const campements: EscaleDeLaCarte[] = []
  if (enHaut.some(e => e.colonne <= 1)) campements.push({ id: 'cg', etage: ETAGES, colonne: 0, sorte: 'campement', suite: [GARDIEN] })
  if (enHaut.some(e => e.colonne >= 2)) campements.push({ id: 'cd', etage: ETAGES, colonne: 1, sorte: 'campement', suite: [GARDIEN] })
  for (const e of enHaut) e.suite = [e.colonne <= 1 ? 'cg' : 'cd']
  const gardien: EscaleDeLaCarte = { id: GARDIEN, etage: ETAGES + 1, colonne: 0, sorte: 'gardien', suite: [] }
  return {
    escales: [...escales, ...campements, gardien],
    depart: escales.filter(e => e.etage === 0).map(e => e.id),
  }
}

/** La marche d'une escale à question : celle de son acte, selon l'étage — l'élite celle du dessus, le gardien la sienne. */
export function marcheDe(acte: number, e: Pick<EscaleDeLaCarte, 'sorte' | 'etage'>): Niveau {
  const m = MARCHES_DES_ACTES[Math.min(acte, ACTES - 1)]
  if (e.sorte === 'gardien') return m.gardien
  if (e.sorte === 'elite') return m.elite
  return e.etage < ETAGES_DU_BAS ? m.bas : m.haut
}

/** Une escale où l'on répond : question, élite, source, gardien. */
export const aUneQuestion = (s: SorteDEscale) => s === 'question' || s === 'elite' || s === 'source' || s === 'gardien'

/** Le numéro d'une carte, ce que la page en dit — « Carte n° 48 213 » — : la graine reste au serveur. */
export function numeroDeLaCarte(graine: string): number {
  return 10_000 + Math.floor(hasardDe(`${graine}:numero`)() * 90_000)
}

/** La graine de la n-ième expédition d'un profil : la page annonce ses gardiens avant le départ, le départ les retrouve. */
export const graineDe = (profileId: string, n: number) => `${profileId}:${n}`

/**
 * Les trois gardiens d'une expédition, un par acte : des légendaires qu'il
 * n'a pas, qui ont leur joker (`LEGENDAIRES_A_JOKER` : vaincu, un gardien
 * suit en joker) et la voie de l'expédition (`estUneVoieDExpedition`) — pas
 * ceux de saison, qui ne se gagnent qu'à leur saison et ne gardent donc qu'à
 * elle (`deSaison`) —, et jamais l'invité du jour, qu'on emmène peut-être
 * déjà. Il n'en reste pas assez ? Les places se prennent parmi les siens : les
 * garder au bout ne rapporte que l'expérience de ses réponses (le choix du
 * 17 octobre 2026).
 *
 * `deSaison` : le légendaire de la saison du départ (le 18 octobre 2026). Il
 * garde l'acte 3 s'il ne l'a pas — et s'il n'est pas l'invité du jour : c'est
 * en expédition la seule porte vers lui, et elle ne s'ouvre qu'à sa saison.
 * Les deux premiers restent ceux d'avant : pas un tirage de plus.
 */
export function gardiensDe(graine: string, possedes: ReadonlySet<string>, invite?: string, deSaison?: string): string[] {
  const r = hasardDe(`${graine}:gardiens`)
  const candidats = LEGENDAIRES.filter(l => LEGENDAIRES_A_JOKER.includes(l.key) && !l.saison && l.key !== invite).map(l => l.key)
  const melanges = (liste: string[]) => {
    const l = [...liste]
    for (let i = l.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[l[i], l[j]] = [l[j], l[i]]
    }
    return l
  }
  const neufs = melanges(candidats.filter(k => !possedes.has(k)))
  const siens = melanges(candidats.filter(k => possedes.has(k)))
  const gardiens = [...neufs, ...siens].slice(0, ACTES)
  if (deSaison && !possedes.has(deSaison) && deSaison !== invite && gardiens.length === ACTES) gardiens[ACTES - 1] = deSaison
  return gardiens
}

/**
 * L'invité du jour, le même pour tous, tiré du jour de Paris parmi les
 * légendaires qui ont leur joker — ceux de saison compris : leur joker agit
 * toute l'année. Il prend une place de l'équipée même chez qui ne l'a pas :
 * c'est par lui qu'un profil sans légendaire découvre ce qu'ils font.
 */
export function inviteDuJour(jour: string): string {
  return LEGENDAIRES_A_JOKER[Math.floor(hasardDe(`invite:${jour}`)() * LEGENDAIRES_A_JOKER.length)]
}

/**
 * Ce qui refuse une équipée : deux places au plus, des légendaires distincts,
 * chacun avec son joker, à lui — ou l'invité du jour. Null : elle part.
 */
export function refusDeLEquipee(equipee: readonly string[], possedes: ReadonlySet<string>, invite: string): string | null {
  // « Ton équipe », à l'écran : « équipée » se lisait comme une faute (la revue du 18 octobre 2026) ; le code garde `equipee`.
  if (equipee.length > PLACES_DE_L_EQUIPEE) return `Ton équipe tient ${PLACES_DE_L_EQUIPEE} légendaires : laisses-en un`
  if (new Set(equipee).size !== equipee.length) return 'Un légendaire ne part qu’une fois'
  for (const cle of equipee) {
    if (!LEGENDAIRES_A_JOKER.includes(cle)) return 'Ce légendaire n’a pas encore de joker : choisis-en un autre'
    if (!possedes.has(cle) && cle !== invite) return 'Ce légendaire n’est pas à toi : seul l’invité du jour part sans être à toi'
  }
  return null
}

/**
 * L'offre d'un coffre ou d'une élite : trois jokers sans légendaire,
 * distincts, chacun d'une rareté tirée à son poids (`POIDS_DES_RARETES`). Du
 * hasard de la graine et du rang de l'offre : recharger ne la change pas.
 * Parmi les jokers que la version de son départ connaît (`v`, `Joker.depuis`) :
 * un joker venu après ne change pas les offres d'une expédition partie avant.
 */
export function offreDeJokers(graine: string, rang: number, v = 2): string[] {
  const r = hasardDe(`${graine}:offre:${rang}`)
  const catalogue = JOKERS_SANS_LEGENDAIRE.filter(j => (j.depuis ?? 2) <= v)
  const raretes = Object.entries(POIDS_DES_RARETES) as [keyof typeof POIDS_DES_RARETES, number][]
  const prises: string[] = []
  for (let essai = 0; prises.length < JOKERS_PAR_OFFRE && essai < 60; essai++) {
    const t = r()
    let cumul = 0
    let rarete = raretes[0][0]
    for (const [nom, poids] of raretes) {
      cumul += poids
      if (t < cumul) {
        rarete = nom
        break
      }
    }
    const candidats = catalogue.filter(j => j.rarete === rarete && !prises.includes(j.cle))
    if (candidats.length > 0) prises.push(candidats[Math.floor(r() * candidats.length)].cle)
  }
  return prises
}

// ── Le dévoilement (l'étape 3) ─────────────────────────────────────────────

/**
 * Le dévoilement : l'intitulé paraît mot à mot, le premier dès que la
 * question se pose, puis un tous les `MS_PAR_MOT` ; Arrêt sur image en
 * suspend le compte `ARRET_SUR_IMAGE_MS`. Une question ne se dévoile qu'à
 * `MOTS_DU_DEVOILEMENT` mots au moins : trois mots ne se dévoilent pas. Des
 * choix de produit (`docs/reference/baremes.md`).
 */
export const MS_PAR_MOT = 350
export const ARRET_SUR_IMAGE_MS = 5000
export const MOTS_DU_DEVOILEMENT = 6

/** Les mots d'un intitulé, tels que le dévoilement les livre un à un. */
export const motsDe = (texte: string): string[] => texte.split(/\s+/).filter(Boolean)

/** Le temps compté depuis le premier mot à l'instant `t` : la pause d'Arrêt sur image n'y entre pas. */
function tempsCompte(depuis: number, t: number, arret?: number): number {
  let compte = Math.max(0, t - depuis)
  if (arret !== undefined) compte -= Math.max(0, Math.min(t, arret + ARRET_SUR_IMAGE_MS) - Math.max(depuis, arret))
  return Math.max(0, compte)
}

/**
 * Combien des `total` mots d'un dévoilement sont dits à l'instant `t` —
 * l'heure du serveur, jamais celle du téléphone (invariant 6) : le premier
 * dès `depuis`, puis un tous les `MS_PAR_MOT`, sans compter la pause
 * d'Arrêt sur image joué à `arret`.
 */
export function motsDits(total: number, depuis: number, t: number, arret?: number): number {
  if (total <= 0 || t < depuis) return 0
  return Math.min(total, 1 + Math.floor(tempsCompte(depuis, t, arret) / MS_PAR_MOT))
}

/** L'instant où se dit le `n`-ième mot (de 1 à `total`) : la route l'attend pour l'écrire. */
export function instantDuMot(n: number, depuis: number, arret?: number): number {
  const sansPause = depuis + Math.max(0, n - 1) * MS_PAR_MOT
  return arret !== undefined && arret >= depuis && sansPause > arret ? sansPause + ARRET_SUR_IMAGE_MS : sansPause
}

// ── Les écus (l'étape 4) ───────────────────────────────────────────────────

/**
 * Les écus d'une escale trouvée, selon la couleur de la chance qu'elle
 * annonçait : plus la piste est noire, plus elle paie. Une élite trouvée
 * ajoute les siens, un gardien vaincu les siens ; un coffre qu'on passe sans
 * rien prendre en rapporte. Des choix de produit (`docs/reference/baremes.md`).
 * Ils meurent avec l'expédition : jamais un confetti — un confetti reste une
 * bonne réponse.
 */
export const ECUS_DES_PISTES: Readonly<Record<CouleurDePiste, number>> = { verte: 5, bleue: 10, rouge: 20, noire: 30 }
export const ECUS_D_UNE_ELITE = 25
export const ECUS_D_UN_GARDIEN = 40
export const ECUS_D_UN_COFFRE_LAISSE = 15

/** Au dévoilement, le prix de l'escale fois trois au premier mot, puis il descend, mot à mot, jusqu'au prix de l'escale au dernier. */
export const ECUS_AU_PREMIER_MOT = 3

/**
 * Ce que vend une échoppe — ou le marchand de l'inconnu —, et à quel prix :
 * une vie, l'un de ses trois jokers (selon sa rareté), son talisman, un
 * joker retiré de son paquet. Chaque article une fois par échoppe. Des choix
 * de produit.
 */
export const PRIX_DE_L_ECHOPPE: Readonly<{ vie: number; talisman: number; retirer: number; commun: number; rare: number; maudit: number }> = {
  vie: 40,
  commun: 20,
  rare: 35,
  maudit: 15,
  talisman: 50,
  retirer: 15,
}

/** Une offre — un coffre, une élite trouvée — propose un talisman de plus, de temps en temps : ils sont rares. */
export const CHANCE_D_UN_TALISMAN = 0.15

/**
 * Les écus d'une bonne réponse : la couleur de la chance que l'escale
 * annonçait, doublée sur un thème pointu et par le maillot jaune sur le
 * sport, divisée par deux en vrai ou faux — le hasard y fait la moitié du
 * travail —, trois fois plus au premier mot d'un dévoilement ; puis ce
 * qu'ajoute une élite, et Quitte ou double qui triple le tout.
 */
export function ecusDeLaReponse(o: {
  chance: number | undefined
  sujet?: boolean
  vraiFaux?: boolean
  sport?: boolean
  devoile?: { mots: number; sur: number }
  elite?: boolean
  quitteOuDouble?: boolean
}): number {
  // Une escale sans chance dite — une carte d'avant les chances — paie comme une bleue.
  let x = ECUS_DES_PISTES[couleurDePiste(o.chance ?? 0.5)]
  if (o.sujet) x *= 2
  if (o.sport) x *= 2
  if (o.vraiFaux) x /= 2
  if (o.devoile && o.devoile.sur > 0) {
    const mots = Math.min(o.devoile.sur, Math.max(1, o.devoile.mots))
    x *= 1 + ((ECUS_AU_PREMIER_MOT - 1) * (o.devoile.sur - mots)) / Math.max(1, o.devoile.sur - 1)
  }
  const total = Math.round(x) + (o.elite ? ECUS_D_UNE_ELITE : 0)
  return o.quitteOuDouble ? total * 3 : total
}

/** Ce qu'une escale à question promet, trouvée, tel que la carte le dit : sans ce que la réponse y changera (le dévoilement, Quitte ou double, le maillot jaune). */
export function prixDeLEscale(e: Pick<EscaleDeLaCarte, 'sorte' | 'theme' | 'forme' | 'chance'>): number {
  return ecusDeLaReponse({ chance: e.chance, sujet: !!e.theme && 'sujet' in e.theme, vraiFaux: e.forme === 'vrai-faux', elite: e.sorte === 'elite' })
}

/**
 * Ce que cache l'inconnu d'une escale : un marchand, un piège ou un
 * légendaire de passage, à parts égales, du hasard de la graine, de l'acte et
 * de l'escale — le même à chaque lecture, connu du serveur dès le départ.
 */
export function contenuDeLInconnu(graine: string, acte: number, id: string): ContenuDeLInconnu {
  const t = hasardDe(`${graine}:inconnu:${acte}:${id}`)()
  return t < 1 / 3 ? 'marchand' : t < 2 / 3 ? 'piege' : 'passage'
}

/**
 * Le légendaire de passage d'un inconnu : un de ceux qui ont leur joker,
 * hors de son équipée — dont les jokers sont déjà dans son paquet —, du même
 * hasard. Son joker va dans la main, jusqu'au bout de l'acte.
 */
export function legendaireDePassage(graine: string, acte: number, id: string, equipee: readonly string[]): string {
  const candidats = LEGENDAIRES_A_JOKER.filter(cle => !equipee.includes(cle))
  const liste = candidats.length > 0 ? candidats : LEGENDAIRES_A_JOKER
  return liste[Math.floor(hasardDe(`${graine}:passage:${acte}:${id}`)() * liste.length)]
}

/**
 * Le talisman d'une offre ou d'une échoppe, parmi ceux qu'il n'a pas : à
 * l'échoppe, toujours (s'il en reste) ; dans une offre, une fois sur
 * `CHANCE_D_UN_TALISMAN`. Du hasard de la graine et du rang de l'offre.
 */
export function talismanDeLOffre(graine: string, rang: number, tenus: readonly string[], toujours: boolean): string | null {
  const r = hasardDe(`${graine}:talisman:${rang}`)
  if (!toujours && r() >= CHANCE_D_UN_TALISMAN) return null
  const libres = TALISMANS.filter(t => !tenus.includes(t.cle))
  return libres.length > 0 ? libres[Math.floor(r() * libres.length)].cle : null
}

/** Ce qu'il achète à l'échoppe : une vie, un de ses jokers, son talisman, ou un joker retiré de son paquet. */
export type ArticleDeLEchoppe = 'vie' | 'joker' | 'talisman' | 'retirer'

/** Le prix d'un article : un joker selon sa rareté. */
export function prixDeLArticle(article: ArticleDeLEchoppe, cle?: string): number {
  if (article === 'joker') {
    // Une carte des rencontres (v5) que les jokers n'ont pas — Banco, Bibliothèque — se paie à sa rareté à elle, pas au prix d'une commune.
    const rarete = jokerDeCle(cle)?.rarete ?? carteDeRencontre(cle)?.rarete
    return rarete === 'rare' || rarete === 'maudit' ? PRIX_DE_L_ECHOPPE[rarete] : PRIX_DE_L_ECHOPPE.commun
  }
  return PRIX_DE_L_ECHOPPE[article]
}

// ── Les chances ────────────────────────────────────────────────────────────

/**
 * Le hasard de chaque forme : un sur quatre à quatre choix et au
 * dévoilement, un sur six à six choix, un sur deux en vrai ou faux.
 */
const HASARD: Record<FormeDEscale, number> = { quatre: 1 / 4, devoilement: 1 / 4, six: 1 / 6, 'vrai-faux': 1 / 2 }

/**
 * Une chance à quatre choix ramenée à une autre forme : le savoir se lit sous
 * le hasard d'un sur quatre, puis le hasard de la forme s'y ajoute.
 */
export function chanceSelonLaForme(p4: number, forme: FormeDEscale): number {
  const savoir = Math.max(0, (p4 - 1 / 4) / (3 / 4))
  const h = HASARD[forme]
  return h + (1 - h) * savoir
}

/**
 * Une chance dite à une forme, ramenée à une autre (les rencontres) : Corser
 * et Simplifier changent la forme d'une question annoncée, et l'annonce dit
 * encore sa chance — son savoir se lit sous le hasard de la première forme.
 */
export function chanceALaForme(chance: number, de: FormeDEscale, vers: FormeDEscale): number {
  if (de === vers) return chance
  const hDe = HASARD[de]
  const savoir = Math.max(0, Math.min(1, (chance - hDe) / (1 - hDe)))
  const h = HASARD[vers]
  return h + (1 - h) * savoir
}

/** La chance d'un joueur moyen à une marche (`TAUX_DU_CALIBRAGE`) : ce que la carte dit avant de le connaître. */
export const chanceDuJoueurMoyen = (marche: Niveau) => TAUX_DU_CALIBRAGE[marche]

/**
 * Sa chance de vaincre un gardien qui demande `aTrouver` bonnes réponses,
 * avec `vies` vies : trouver `aTrouver` fois avant d'avoir raté `vies` fois.
 */
export function chanceDeVaincre(p: number, aTrouver: number, vies: number): number {
  let somme = 0
  let combinaisons = 1
  for (let k = 0; k < vies; k++) {
    if (k > 0) combinaisons = (combinaisons * (aTrouver - 1 + k)) / k
    somme += combinaisons * p ** aTrouver * (1 - p) ** k
  }
  return Math.min(1, Math.max(0, somme))
}

/**
 * Ses vies au bout d'un tracé, en loi : la case `v` dit la chance d'arriver
 * avec `v` vies (la case 0, d'être tombé en route). Une erreur coûte une
 * vie, une source retrouvée et un campement en rendent une, jusqu'à trois.
 */
export function viesAuBout(carte: CarteDUnActe, trace: readonly string[], vies: number): number[] {
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  let d = new Array<number>(VIES + 1).fill(0)
  d[Math.min(VIES, Math.max(0, vies))] = 1
  for (const id of trace) {
    const e = parId.get(id)
    if (!e) continue
    const apres = new Array<number>(VIES + 1).fill(0)
    apres[0] = d[0]
    for (let v = 1; v <= VIES; v++) {
      if (e.sorte === 'campement') apres[Math.min(VIES, v + 1)] += d[v]
      else if (e.sorte === 'source') {
        const c = e.chance ?? 0.5
        apres[Math.min(VIES, v + 1)] += d[v] * c
        apres[v] += d[v] * (1 - c)
      } else if (e.sorte === 'question' || e.sorte === 'elite') {
        const c = e.chance ?? 0.5
        apres[v] += d[v] * c
        apres[v - 1] += d[v] * (1 - c)
      } else if (e.sorte === 'inconnu') {
        // Un piège sur trois tant qu'il ne s'est pas dévoilé ; dévoilé, on sait.
        const piege = e.contenu === undefined ? 1 / 3 : e.contenu === 'piege' ? 1 : 0
        apres[v] += d[v] * (1 - piege)
        apres[v - 1] += d[v] * piege
      } else apres[v] += d[v]
    }
    d = apres
  }
  return d
}

/** Les écus qu'un tracé promet, en moyenne : sur chaque escale à question, sa chance fois son prix. Sans chances dites (L'écholocation), rien. */
export function ecusEsperes(carte: CarteDUnActe, trace: readonly string[]): number {
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  let somme = 0
  for (const id of trace) {
    const e = parId.get(id)
    if (e && (e.sorte === 'question' || e.sorte === 'elite') && e.chance !== undefined) somme += e.chance * prixDeLEscale(e)
  }
  return Math.round(somme)
}

/** Ce que la page dit d'un tracé : la chance d'arriver au gardien vivant, puis de le vaincre. */
export function chancesDuTrace(carte: CarteDUnActe, trace: readonly string[], vies: number, acte: number): { arriver: number; vaincre: number } {
  const d = viesAuBout(carte, trace, vies)
  const p = carte.chanceDuGardien ?? chanceDuJoueurMoyen(MARCHES_DES_ACTES[Math.min(acte, ACTES - 1)].gardien)
  const aTrouver = MARCHES_DES_ACTES[Math.min(acte, ACTES - 1)].aTrouver
  let vaincre = 0
  for (let v = 1; v <= VIES; v++) vaincre += d[v] * chanceDeVaincre(p, aTrouver, v)
  return { arriver: 1 - d[0], vaincre }
}

/**
 * Le tracé le plus sûr d'ici au campement : celui qui donne la meilleure
 * chance de vaincre le gardien — arriver, et avec le plus de vies. Six
 * étages de trois liens au plus : sept cents tracés à peine, tous comptés.
 * La page le redessine à chaque escale touchée : il garde le début qu'on a
 * choisi (`debut`, depuis l'escale où l'on est) et passe par celle qu'on
 * vient de toucher (`par`). Aucun tracé ne le peut : [].
 */
export function traceLePlusSur(
  carte: CarteDUnActe,
  ici: string | null,
  vies: number,
  acte: number,
  { debut = [], par }: { debut?: readonly string[]; par?: string } = {},
): string[] {
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  let meilleur: { trace: string[]; vaincre: number } | null = null
  const explorer = (trace: string[]) => {
    const dernier = trace.length > 0 ? trace[trace.length - 1] : ici
    const suite = dernier === null ? carte.depart : (parId.get(dernier)?.suite ?? [])
    if (dernier !== null && parId.get(dernier)?.sorte === 'campement') {
      if (par !== undefined && !trace.includes(par)) return
      const { vaincre } = chancesDuTrace(carte, trace, vies, acte)
      if (!meilleur || vaincre > meilleur.vaincre + 1e-9) meilleur = { trace: [...trace], vaincre }
      return
    }
    for (const id of suite) if (id !== GARDIEN) explorer([...trace, id])
  }
  explorer([...debut])
  return (meilleur as { trace: string[] } | null)?.trace ?? []
}

/** Les escales qu'il peut encore atteindre d'ici, campements et gardien compris. */
export function escalesAtteignables(carte: CarteDUnActe, ici: string | null): Set<string> {
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  const vues = new Set<string>()
  const pile = [...(ici === null ? carte.depart : (parId.get(ici)?.suite ?? []))]
  while (pile.length > 0) {
    const id = pile.pop()!
    if (vues.has(id)) continue
    vues.add(id)
    pile.push(...(parId.get(id)?.suite ?? []))
  }
  return vues
}

// ── Le pli du journal ──────────────────────────────────────────────────────

/** Ce que l'expédition garde de son départ (`campagne_series.expedition`), versionné. */
export interface DepartDExpedition {
  /**
   * 1 : l'étape 1, sans jokers — le campement y rend sa vie d'office ; 2 :
   * les jokers ; 3 : les formes — ses offres connaissent Arrêt sur image
   * (`Joker.depuis`). Les formes elles-mêmes sont dans ses cartes. 4 : les
   * écus — l'échoppe et l'inconnu sur ses cartes, les talismans dans ses
   * offres, Quitte ou double au catalogue. 5 : le prototype des rencontres
   * (`shared/rencontres.ts`, le 18 octobre 2026) — le courage au lieu des
   * vies, une rencontre à chaque escale à question, des cartes à la place des
   * jokers ; hors de la production seulement (`RENCONTRES_EN_PRODUCTION`).
   * 6 : les rencontres revues le même soir — la main grandit avec les actes
   * (`CARTES_DES_ACTES`), et l'acte 1 n'offre ni rare en rencontre ni
   * maudite (`raretesDeLOffre`) ; une expédition partie en version 5 se
   * rejoue telle qu'elle s'est jouée. 7 : le codex (`shared/codex.ts`) — les
   * offres ne tirent que les cartes qu'il a ouvertes, et pèsent les familles
   * de son paquet ; le coffre d'un gardien vaincu propose une légendaire ;
   * plus d'équipe à choisir, l'invité du jour prête sa carte ; le pari, les
   * talismans et la catégorie fétiche attendent leur niveau.
   */
  v: 1 | 2 | 3 | 4 | 5 | 6 | 7
  graine: string
  numero: number
  /** Les trois gardiens, un par acte, dans l'ordre des actes. */
  gardiens: string[]
  /** Les trois cartes, tirées au départ et gardées telles quelles : une retouche du générateur ne déplace pas une escale sous les pieds de qui joue. */
  cartes: CarteDUnActe[]
  /** Les chances sont celles d'un joueur moyen : le modèle ne le connaît pas encore (moins de vingt premières réponses). */
  moyen: boolean
  /** Les légendaires qu'il emmène, deux au plus — les siens, ou l'invité du jour (v2). */
  equipee?: string[]
  /** L'invité du jour de son départ (v2). */
  invite?: string
  /**
   * Sa chance à quatre choix sur chaque marche de chaque catégorie, gardée au
   * départ avec celles des escales (v2) : le Commandement change la catégorie
   * de l'escale suivante, et la carte dit encore sa chance.
   */
  chances?: Record<string, Partial<Record<Niveau, number>>>
  /** Sa chance sur une source (v2) : Il connaît la maison en ouvre une. */
  chanceDeLaSource?: number
  /**
   * La saison de son départ (le 18 octobre 2026) : sa fête tient la moitié
   * des thèmes pointus de ses cartes, et son légendaire garde l'acte 3 s'il
   * ne l'a pas — tous deux déjà dans ses cartes et ses gardiens. Le pli ne la
   * lit pas : la page la dit.
   */
  saison?: CleDeSaison
  /**
   * Sa catégorie fétiche (v5) : l'Érudit en vit — Plume, Bibliothèque. Choisie
   * au départ parmi les douze, gardée avec elle.
   */
  fetiche?: string
  /**
   * Son codex à son départ (v7) : son niveau d'explorateur, les cartes qu'il
   * a ouvertes — ce que ses offres tirent —, les règles ouvertes. Figé : la
   * renommée gagnée en route, ou une échelle retouchée, ne change rien à une
   * expédition partie.
   */
  codex?: CodexDuDepart
}

/**
 * Un geste du journal (`expedition_gestes`). Fait pendant qu'une question
 * attend, un joker porte sa position : le pli ne juge une réponse qu'après les
 * gestes qui la visent — sans elle, un joker posé juste après une réponse se
 * serait compté avant elle (L'aube, une erreur faite avant d'être posée).
 */
export type GesteDExpedition =
  | { quoi: 'avancer'; vers: string }
  | { quoi: 'jouer'; joker: string; position?: number; categorie?: string; montre?: number }
  | { quoi: 'prendre'; jokers: string[]; talisman?: string }
  | { quoi: 'camper'; retirer?: string }
  /**
   * À l'échoppe (v4) : un article, et le joker qu'il vise — celui de l'étal,
   * ou celui qu'on retire. `prix` : ce qu'il a payé, que le serveur écrit —
   * comme à la boutique, un achat garde son prix quand le barème change.
   */
  | { quoi: 'acheter'; article: ArticleDeLEchoppe; joker?: string; prix?: number }
  | { quoi: 'garder'; legendaire: string }
  | { quoi: 'abandonner' }
  /**
   * En rencontre (v5) : il a préparé ses cartes, il mise, et voit la question
   * — la position qu'elle vise, comme un joker joué sur elle.
   */
  | { quoi: 'voir'; mise: number; position?: number }

/** Une question posée, telle que la partie la range : l'escale et l'acte où elle a été tirée, et ce qu'un joker doit en savoir. */
export interface QuestionPosee {
  escale: string
  acte: number
  /** Combien de réponses elle propose : à deux, un vrai ou faux, rien ne s'efface ni ne se double. */
  reponses?: number
  /** Ses réponses sont des années ou des nombres : la Prédiction s'y joue. */
  nombre?: boolean
  /** La forme où elle s'est posée, quand ce n'est pas celle de la base : Arrêt sur image ne se joue que sur un dévoilement. */
  forme?: FormeDEscale
  /** Sa catégorie : le maillot jaune double les écus du sport (v4). */
  categorie?: string
  /** Un dévoilement répondu : les mots dits quand sa réponse est arrivée, sur combien — ses écus en dépendent (v4). */
  devoile?: { mots: number; sur: number }
  /** Sa marche (v5) : son savoir dit ce que brise une bonne réponse. */
  niveau?: Niveau
  /** La forme où elle a été tirée (v5) : Corser et Simplifier la changent, la règle des cartes lit celle d'avant eux. */
  tiree?: FormeDEscale
  /** Elle a deux leurres de plus (v5) : Corser s'y joue. */
  six?: boolean
  /** Elle se date (v5) : le Sphinx en dit le siècle — sinon, il efface. */
  datee?: boolean
  /** Ses réponses sont des années, ou des nombres (v5) : l'annonce le dit. */
  reponseEn?: 'annee' | 'nombre'
  /** Un dévoilement (v5) : ses mots, de quoi dire ce qu'il briserait au premier. */
  mots?: number
}

export type IssueDExpedition = 'en-route' | 'au-bout' | 'legendaire' | 'perdue' | 'abandonnee'

/** Ce que le serveur doit tirer pour que l'expédition continue : la question d'une escale, celles du gardien, la reprise de La boucle. */
export interface ATirer {
  escale: string
  acte: number
  combien: number
  /** La catégorie que le Commandement a imposée à l'escale. */
  categorie?: string
  /** La boucle : reposer la question ratée de ce rang. */
  reprise?: number
}

export interface EtatDeLExpedition {
  /** L'acte en cours, de 0 à 2 ; 3 une fois le dernier gardien vaincu. */
  acte: number
  /** L'escale où il est ; null à l'entrée d'un acte. */
  ici: string | null
  /** Les escales passées dans l'acte en cours, dans l'ordre. */
  trace: string[]
  vies: number
  justes: number
  /** La question qui attend sa réponse (son rang dans les questions de la partie) ; null : rien n'attend. */
  enAttente: number | null
  /** Deux visages : l'autre question, au choix — il répond à l'une, l'autre ne se pose pas. */
  autre: number | null
  /** Les questions déjà passées — répondues, échangées, ou laissées par un gardien tombé : la prochaine tirée vient après. */
  passees: number
  /** Le combat en cours contre le gardien de l'acte ; `debut`, le rang de sa première question. */
  gardien: { trouvees: number; ratees: number; debut: number } | null
  vaincus: number
  issue: IssueDExpedition
  garde: string | null
  /** Le paquet, trié : on y pioche au hasard de la graine, son ordre ne dit rien. */
  paquet: string[]
  /** La main, dans l'ordre où elle s'est tirée. */
  main: string[]
  defausse: string[]
  /** Les jokers posés : ils agissent jusqu'au bout de l'acte. */
  poses: string[]
  /** Le joker joué sur la question qui attend — un au plus —, et la réponse que la Prédiction montre. */
  joue: { joker: string; montre?: number } | null
  /** La catégorie que le Commandement impose à la question qui attend. */
  categorie: string | null
  /** Ce qu'il faut tirer avant de continuer ; null : rien. */
  aTirer: ATirer | null
  /**
   * Une offre à prendre : celle d'un coffre — vide après L'horizon —, ou
   * d'une élite trouvée. Depuis les écus (v4), un talisman de temps en temps,
   * à prendre à la place d'un joker ; et le coffre qu'on passe sans rien
   * prendre rapporte ses écus.
   */
  offre: OffreDeJokers | null
  /** Arrivé à un campement : une vie, ou un joker retiré de son paquet. */
  campement: boolean
  /** Les jokers de carte en cours, jusqu'au pas suivant. */
  route: { detour: boolean; raccourci: boolean; commandement: string | null }
  /** Les escales qu'Il connaît la maison a ouvertes dans l'acte. */
  maisons: MaisonOuverte[]
  /** L'aube : aucune erreur depuis qu'elle est posée. */
  aube: boolean
  /** La boucle : la question ratée à reposer, puis le rang où elle se repose. */
  boucle: { reprise: number; position: number | null } | null
  /** L'élan : ses bonnes réponses d'affilée depuis qu'il est posé. Remonter des abysses : celles de sa dernière vie. */
  elan: number
  abysses: number
  /** L'horizon : le prochain coffre est vide. */
  coffreVide: boolean
  /** La dernière réponse jugée lui a coûté une vie : L'horizon la rend. */
  derniereErreur: boolean
  /** Combien de tirages — la pioche, les offres — ont déjà eu lieu : le rang du hasard du suivant. */
  tirages: number
  offres: number
  /** Ses écus (v4) : gagnés aux escales, dépensés à l'échoppe ; ils meurent avec l'expédition. */
  ecus: number
  /** Ses talismans (v4) : passifs, jusqu'au bout de l'expédition. */
  talismans: string[]
  /** L'échoppe où il est — ou le marchand de l'inconnu — : ce qu'elle vend, ce qu'il y a déjà acheté. Elle se quitte en avançant. */
  echoppe: EchoppeOuverte | null
  /** L'inconnu où il vient d'entrer : ce qu'il cachait, le légendaire de passage. */
  inconnu: { contenu: ContenuDeLInconnu; legendaire?: string } | null
  /** Les jokers des légendaires de passage : ils quittent sa main, son paquet ou sa défausse au bout de l'acte. */
  passages: string[]
  /** La lanterne est allumée : les pièges de l'acte se montrent. */
  lanterne: boolean
  /** Son courage (v5), sur `COURAGE_MAX` ; null avant les rencontres, qui comptaient des vies. */
  courage: number | null
  /** La rencontre en cours (v5) : l'adversaire, ses sceaux, le tour, les tas. */
  rencontre: RencontreEnCours | null
  /** Combien de rencontres ont commencé (v5). */
  rencontres: number
  /** Les cartes de route jouées dans l'acte (v5) : chacune une fois par acte. */
  routeJouees: string[]
  /** L'horizon (v5) : la prochaine récompense — une rencontre gagnée, un coffre — est vide. */
  recompenseVide: boolean
  /** Ce que la dernière réponse a fait en rencontre (v5) : la réponse le rend, la page le dit. */
  coup: CoupDeRencontre | null
  /**
   * Ce qu'elle a fait, que la renommée compte (`shared/codex.ts`) : les
   * escales où il est entré, les adversaires et les élites tombés — aux
   * règles d'avant, les questions et les élites trouvées. Ses gardiens et le
   * bout se lisent de `vaincus` et de `issue` (`bilanDuPli`).
   */
  bilan: { escales: number; adversaires: number; elites: number }
  /**
   * Les exploits qu'elle a faits (le codex), dans l'ordre où ils sont tombés :
   * le bilan les garde, la fin les dit. Ils ne changent rien au jeu — relevés
   * à toutes les versions, ils ne déplacent aucun tirage.
   */
  exploits: CleDExploit[]
  /** Ses bonnes réponses d'affilée dans toute l'expédition, sources comprises : une erreur repart de zéro. */
  affilee: number
  /** Le pari est ouvert (v7 : au niveau qu'il faut ; toujours avant). */
  pari: boolean
}

/** Une offre de jokers — un coffre, une élite trouvée. */
export interface OffreDeJokers {
  jokers: string[]
  aPrendre: number
  /** Un coffre (v4) : passé sans rien prendre, il rapporte `ECUS_D_UN_COFFRE_LAISSE`. */
  coffre?: true
  /** Le trésor d'un gardien vaincu (v7) : une carte légendaire de son codex, et deux autres. */
  gardien?: true
  /** Un talisman, à prendre à la place d'un joker (v4). */
  talisman?: string
}

/** Une échoppe ouverte : ses trois jokers, son talisman, et ce qu'il y a déjà acheté — `vie`, `talisman`, `retirer` ou la clé d'un joker. */
export interface EchoppeOuverte {
  jokers: string[]
  talisman: string | null
  achats: string[]
}

/** Une escale qu'Il connaît la maison a ouverte : changée en source ou en coffre, reliée à l'escale d'où il l'a joué. */
export interface MaisonOuverte {
  vers: string
  sorte: 'source' | 'coffre'
  depuis: string | null
}

/** Le paquet au départ : celui de tous, et le joker de chaque légendaire de l'équipée. */
export function paquetDeDepart(equipee: readonly string[]): string[] {
  return [...PAQUET_DE_DEPART, ...equipee.flatMap(cle => jokerDuLegendaire(cle)?.cle ?? [])].sort()
}

/** Ce que le pli lit du départ. */
type DepartLu = Pick<DepartDExpedition, 'v' | 'graine' | 'cartes' | 'gardiens' | 'equipee' | 'chanceDeLaSource' | 'chances' | 'fetiche' | 'codex'>

/** Ce qu'une expédition a fait, que la renommée compte : le bilan du pli, ses gardiens et le bout — et ses exploits. */
export function bilanDuPli(e: Pick<EtatDeLExpedition, 'bilan' | 'vaincus' | 'issue' | 'exploits'>): BilanDUneExpedition {
  return { ...e.bilan, gardiens: e.vaincus, auBout: e.issue === 'au-bout' || e.issue === 'legendaire', exploits: [...e.exploits] }
}

/**
 * L'état d'une expédition, replié de son départ, de ses gestes et de ses
 * réponses — rien d'autre. Une escale à question consomme la question tirée
 * pour elle ; le gardien, celles tirées pour lui, jusqu'à sa `aTrouver`-ième
 * bonne réponse ou la dernière vie : vaincu, l'acte suivant s'ouvre, et ses
 * questions de reste ne se posent pas.
 *
 * Les jokers (v2, le brief) : à chaque question, la main tire un joker du
 * paquet tant qu'elle en tient moins de trois ; un joker à jouer au plus par
 * question ; joué, il va à la défausse, qui ne revient au paquet qu'à l'acte
 * suivant — chaque joker sert une fois par acte, et le paquet qui s'épuise
 * avant le gardien est la tension du mode. Le hasard — la pioche, les offres,
 * la maison qu'on ouvre — vient de la graine et du rang du tirage : recharger
 * ne retire rien. Ce qu'un joker montre d'une question — les réponses
 * effacées, l'indice, ce que dit l'Oracle — ne se lit pas ici : le serveur seul
 * connaît la bonne réponse (invariant 1).
 *
 * Les écus (v4) : une escale à question trouvée paie selon la chance qu'elle
 * annonçait (`ecusDeLaReponse`), un gardien vaincu les siens, un coffre passé
 * sans rien prendre les siens ; l'échoppe les dépense. L'inconnu se joue en y
 * entrant : un marchand ouvre son échoppe, un piège prend une vie, un
 * légendaire de passage glisse son joker dans la main jusqu'au bout de l'acte.
 */
export function pliDeLExpedition(depart: DepartLu, gestes: readonly GesteDExpedition[], questions: readonly QuestionPosee[], reponses: ReadonlyMap<number, boolean>): EtatDeLExpedition {
  const avecJokers = depart.v >= 2
  const avecEcus = depart.v >= 4
  // Le prototype des rencontres (v5) : le courage, une rencontre à chaque escale à question, des cartes à la place des jokers.
  const avecRencontres = depart.v >= 5
  const e: EtatDeLExpedition = {
    acte: 0,
    ici: null,
    trace: [],
    vies: VIES,
    justes: 0,
    enAttente: null,
    autre: null,
    passees: 0,
    gardien: null,
    vaincus: 0,
    issue: 'en-route',
    garde: null,
    paquet: avecRencontres ? paquetDesRencontres(depart.equipee ?? []) : avecJokers ? paquetDeDepart(depart.equipee ?? []) : [],
    main: [],
    defausse: [],
    poses: [],
    joue: null,
    categorie: null,
    aTirer: null,
    offre: null,
    campement: false,
    route: { detour: false, raccourci: false, commandement: null },
    maisons: [],
    aube: false,
    boucle: null,
    elan: 0,
    abysses: 0,
    coffreVide: false,
    derniereErreur: false,
    tirages: 0,
    offres: 0,
    ecus: avecRencontres ? ECUS_AU_DEPART : 0,
    talismans: [],
    echoppe: null,
    inconnu: null,
    passages: [],
    lanterne: false,
    courage: avecRencontres ? COURAGE_MAX : null,
    rencontre: null,
    rencontres: 0,
    routeJouees: [],
    recompenseVide: false,
    coup: null,
    bilan: { escales: 0, adversaires: 0, elites: 0 },
    exploits: [],
    affilee: 0,
    pari: regleOuverte(depart, 'pari'),
  }
  // Le codex (v7) : ses offres ne tirent que les cartes qu'il a ouvertes, et les talismans attendent leur niveau.
  const avecLeCodex = depart.v >= VERSION_DU_CODEX && !!depart.codex
  const talismans = regleOuverte(depart, 'talismans')
  const fini = () => e.issue !== 'en-route' && e.issue !== 'au-bout'
  const pose = (cle: string) => e.poses.includes(cle)
  const oter = (liste: string[], cle: string) => {
    const i = liste.indexOf(cle)
    if (i >= 0) liste.splice(i, 1)
    return i >= 0
  }
  /** Un joker posé qui a servi — Renaissance, Peau de feu, La boucle — quitte la table pour la défausse. */
  const servi = (cle: string) => {
    if (oter(e.poses, cle)) e.defausse.push(cle)
  }
  /** Un exploit fait (le codex) : une fois par expédition. */
  const exploit = (x: CleDExploit) => {
    if (!e.exploits.includes(x)) e.exploits.push(x)
  }
  /** Une bonne réponse de plus d'affilée — la vingtième (`BONNES_D_AFFILEE`) est un exploit ; une erreur les remet à zéro (`e.affilee = 0`). */
  const deSuite = () => {
    if (++e.affilee >= BONNES_D_AFFILEE) exploit('d-affilee')
  }
  const tirer = () => {
    const max = pose('trois-tetes') ? MAIN_MAX_DES_TROIS_TETES : MAIN_MAX
    if (e.main.length >= max || e.paquet.length === 0) return
    const r = hasardDe(`${depart.graine}:pioche:${e.tirages++}`)
    e.main.push(e.paquet.splice(Math.floor(r() * e.paquet.length), 1)[0])
  }
  /** Une question s'ouvre au rang suivant : la main tire — en rencontre (v5), tout un tour s'ouvre. */
  const ouvrir = () => {
    e.enAttente = e.passees
    e.autre = null
    e.joue = null
    if (avecRencontres) {
      // Une source se répond sans cartes : rien à frapper.
      if (e.rencontre) nouveauTour()
      return
    }
    if (avecJokers) {
      tirer()
      if (pose('trois-tetes')) tirer()
    }
  }

  // ── Les rencontres (v5) ──

  /** Des cartes de la pioche vers la main ; la pioche vide, la défausse y revient — le cycle de Slay the Spire. */
  const piocher = (n: number) => {
    const r = e.rencontre
    if (!r) return
    for (let k = 0; k < n; k++) {
      if (r.pioche.length === 0) {
        if (r.defausse.length === 0) return
        r.pioche = [...r.defausse].sort()
        r.defausse = []
      }
      const h = hasardDe(`${depart.graine}:pioche:${e.tirages++}`)
      r.main.push(r.pioche.splice(Math.floor(h() * r.pioche.length), 1)[0])
    }
  }
  /** Un tour s'ouvre sur la question qui attend : l'inspiration, la main — et ce que le tour d'avant lui a laissé. */
  const nouveauTour = () => {
    const r = e.rencontre!
    r.tour = { phase: 'preparation', inspiration: INSPIRATION_PAR_QUESTION + r.suivant.inspiration, charge: r.suivant.charge, garde: 0, mise: 0, jouees: [], surLaQuestion: [] }
    const deplus = r.suivant.cartes + (r.pouvoirs.includes('trois-tetes') ? 2 : 0)
    r.suivant = { cartes: 0, inspiration: 0, charge: 0 }
    piocher(cartesParQuestion(depart.v, e.acte) + deplus)
    // La boucle : l'erreur revient à cette question-ci.
    if (r.boucle && r.boucle.position === null) r.boucle.position = e.enAttente
  }
  /** Une rencontre commence : tout son paquet de combat dans la pioche — ce qu'une rencontre a épuisé revient à la suivante. */
  const commencerUneRencontre = (sorte: SorteDeRencontre, escale: string, categorie: string | null) => {
    e.rencontres++
    e.rencontre = {
      sorte,
      escale,
      sceaux: sceauxDe(sorte, e.acte),
      max: sceauxDe(sorte, e.acte),
      frappe: frappeDe(sorte, e.acte),
      questions: 0,
      serie: 0,
      categorie,
      pouvoirs: [],
      pioche: cartesDeCombat(e.paquet).sort(),
      main: [],
      defausse: [],
      epuisees: [],
      tour: { phase: 'preparation', inspiration: 0, charge: 0, garde: 0, mise: 0, jouees: [], surLaQuestion: [] },
      suivant: { cartes: 0, inspiration: 0, charge: 0 },
      derniereFrappe: 0,
      perdu: 0,
      aube: 0,
      boucle: null,
    }
  }
  /**
   * Une offre de cartes (v5) — une rencontre gagnée, une élite, un coffre ; et,
   * depuis le codex (v7), le coffre d'un gardien vaincu, qui ouvre sur une
   * légendaire — ; vide après L'horizon.
   */
  const offrirDesCartes = (quelle: 'rencontre' | 'elite' | 'coffre' | 'gardien') => {
    if (e.recompenseVide) {
      e.recompenseVide = false
      e.offre = { jokers: [], aPrendre: 0 }
      return
    }
    const rang = e.offres++
    const talisman = quelle !== 'rencontre' && talismans ? talismanDeLOffre(depart.graine, rang, e.talismans, false) : null
    const poids = raretesDeLOffre(depart.v, e.acte, quelle === 'rencontre' ? 'rencontre' : 'elite')
    e.offre = {
      jokers: avecLeCodex
        ? offreDuCodex(depart.graine, rang, depart.codex!.cartes, e.paquet, poids, quelle === 'gardien')
        : offreDeCartes(depart.graine, rang, famillesDeLEquipee(depart.equipee ?? []), poids, depart.v >= 6),
      aPrendre: 1,
      ...(quelle === 'coffre' && { coffre: true as const }),
      ...(quelle === 'gardien' && { gardien: true as const }),
      ...(talisman && { talisman }),
    }
  }
  /** Les écus d'une rencontre gagnée : ce que la carte annonçait de l'escale — doublés par le maillot jaune sur le sport. */
  const ecusDeLaVictoire = (escale: EscaleDeLaCarte, categorie: string | null) => {
    const sport = e.talismans.includes('maillot-jaune') && (categorie === 'Sport' || (!categorie && !!escale.theme && 'categories' in escale.theme && escale.theme.categories.includes('Sport')))
    return ecusDeLaReponse({
      chance: chanceAnnoncee(depart, e.acte, escale, categorie),
      sujet: !categorie && !!escale.theme && 'sujet' in escale.theme,
      vraiFaux: escale.forme === 'vrai-faux',
      sport,
      elite: escale.sorte === 'elite',
    })
  }
  /** L'adversaire tombe : les écus, le courage de L'aube, puis une carte à choisir — ou l'acte suivant, pour le gardien. */
  const gagnerLaRencontre = () => {
    const r = e.rencontre!
    // Les exploits du codex : une élite tombée à sa première réponse, juste ; le dernier gardien, sans lui avoir laissé un point de
    // courage. Un adversaire ordinaire, un gardien des premiers actes y suffisaient : le joueur moyen les faisait tous à sa première
    // expédition (`calibrage-rencontres.ts`, le 18 octobre 2026) — des cadeaux, pas des exploits.
    if (r.sorte === 'elite' && r.questions === 1 && e.coup?.juste) exploit('une-seule-reponse')
    if (r.sorte === 'gardien' && r.perdu === 0 && e.acte === Math.min(ACTES, depart.cartes.length) - 1) exploit('gardien-intact')
    const courage = r.pouvoirs.includes('aube') ? Math.min(COURAGE_MAX - e.courage!, COURAGE_DE_L_AUBE * r.aube) : 0
    e.courage! += courage
    e.rencontre = null
    if (r.sorte === 'gardien') {
      e.coup = { ...e.coup!, victoire: { ecus: ECUS_D_UN_GARDIEN, courage } }
      vaincre()
      return
    }
    const escale = escaleEnJeu(depart, e, r.escale)
    const ecus = escale ? ecusDeLaVictoire(escale, r.categorie) : 0
    e.ecus += ecus
    e.coup = { ...e.coup!, victoire: { ecus, courage } }
    if (r.sorte === 'elite') e.bilan.elites++
    else e.bilan.adversaires++
    offrirDesCartes(r.sorte === 'elite' ? 'elite' : 'rencontre')
  }
  /**
   * Le verdict d'une question en rencontre : juste, il brise ses sceaux — son
   * savoir et sa Charge, fois sa forme — et sa mise paie ; faux, l'adversaire
   * frappe, moins la Garde, et la mise est perdue. Puis la main part à la
   * défausse, et le tour suivant s'ouvre — ou l'adversaire tombe, ou lui.
   */
  const jugerEnRencontre = (i: number, juste: boolean) => {
    const r = e.rencontre!
    const t = r.tour
    const q = questions[i] ?? { escale: r.escale, acte: e.acte }
    const mise = enJeu(t)
    const traversee = t.surLaQuestion.includes('passe-muraille')
    let coup: CoupDeRencontre
    if (traversee) {
      // Ni trouvée ni ratée : ni frappe, ni sceaux, et la mise est rendue.
      coup = { juste: false, brises: 0, frappe: 0, absorbee: 0, perdu: 0, mise: 0, traversee: true }
    } else if (juste) {
      const escale = r.sorte === 'gardien' ? undefined : escaleEnJeu(depart, e, r.escale)
      const marche: Niveau = r.sorte === 'gardien' ? MARCHES_DES_ACTES[Math.min(e.acte, ACTES - 1)].gardien : escale ? marcheDe(e.acte, escale) : 'facile'
      const brises = brisesDUneBonneReponse({
        savoir: SAVOIR_DES_MARCHES[q.niveau ?? marche],
        charge: t.charge,
        enPlus: enPlusDeLaBibliotheque({ v: depart.v, pouvoirs: r.pouvoirs, fetiche: depart.fetiche, categorie: q.categorie }),
        multiplicateur: multiplicateurDeLaForme(q),
        banco: t.jouees.includes('banco') ? Math.floor(mise / 5) : 0,
        double: t.jouees.includes('quitte-ou-double'),
      })
      r.sceaux = Math.max(0, r.sceaux - brises)
      r.serie++
      e.justes++
      deSuite()
      const gain = mise > 0 ? gainDeLaMise(t, r.pouvoirs) : 0
      e.ecus += gain
      if (mise >= PARI_DE_L_EXPLOIT) exploit('pari-de-40')
      if (r.pouvoirs.includes('aube')) r.aube++
      if (r.pouvoirs.includes('abysses') && e.courage! < SEUIL_DES_ABYSSES) e.courage = Math.min(COURAGE_MAX, e.courage! + COURAGE_DES_ABYSSES)
      if (r.pouvoirs.includes('elan') && r.serie % 3 === 0) {
        r.suivant.cartes += 2
        r.suivant.inspiration += 1
      }
      // La boucle : l'erreur reposée, retrouvée, rend son courage.
      if (r.boucle && r.boucle.position === i) {
        e.courage = Math.min(COURAGE_MAX, e.courage! + r.boucle.perte)
        r.boucle = null
        r.pouvoirs = r.pouvoirs.filter(c => c !== 'boucle')
      }
      r.derniereFrappe = 0
      coup = { juste: true, brises, frappe: 0, absorbee: 0, perdu: 0, mise: gain }
    } else {
      const f = frappeDUneErreur({
        frappe: frappeDeLaQuestion(r),
        sauve: t.jouees.includes('sursis') || t.surLaQuestion.includes('mue'),
        double: t.surLaQuestion.includes('tout-ou-rien') || t.jouees.includes('quitte-ou-double'),
        garde: t.garde,
      })
      e.courage! -= f.perdu
      r.perdu += f.perdu
      e.affilee = 0
      const contre = t.jouees.includes('contre-attaque') ? f.absorbee : 0
      r.sceaux = Math.max(0, r.sceaux - contre)
      r.serie = 0
      const perdue = Math.min(e.ecus, mise)
      e.ecus -= perdue
      // Peau de feu : la Garde a tout pris — la question suivante frappe plus fort.
      if (t.jouees.includes('peau-de-feu') && f.perdu === 0 && f.frappe > 0) r.suivant.charge += 4
      if (r.boucle && r.boucle.position === i) {
        // Ratée encore : la boucle a servi.
        r.boucle = null
        r.pouvoirs = r.pouvoirs.filter(c => c !== 'boucle')
      } else if (r.pouvoirs.includes('boucle') && !r.boucle && f.perdu > 0) r.boucle = { reprise: i, perte: f.perdu, position: null }
      r.derniereFrappe = f.perdu
      // Sans mise, rien de perdu : un « -0 » ne se compare à rien.
      coup = { juste: false, brises: contre, frappe: f.frappe, absorbee: f.absorbee, perdu: f.perdu, mise: perdue > 0 ? -perdue : 0 }
    }
    r.questions++
    // Ce qu'il n'a pas joué part à la défausse.
    r.defausse.push(...r.main)
    r.main = []
    e.coup = coup
    if (e.courage! <= 0) {
      if (r.pouvoirs.includes('renaissance')) {
        // Une fois par expédition : la carte quitte son paquet.
        e.courage = COURAGE_DE_LA_RENAISSANCE
        r.pouvoirs = r.pouvoirs.filter(c => c !== 'renaissance')
        oter(e.paquet, 'renaissance')
        e.coup = { ...coup, renaissance: true }
      } else {
        e.courage = 0
        e.rencontre = null
        e.issue = 'perdue'
        return
      }
    }
    if (r.sceaux <= 0) gagnerLaRencontre()
    else ouvrir()
  }
  /** Une carte jouée en rencontre (v5) : elle quitte la main — pour la défausse, les épuisées, ou les pouvoirs — et fait ce qu'elle dit. */
  const jouerEnRencontre = (g: Extract<GesteDExpedition, { quoi: 'jouer' }>) => {
    const r = e.rencontre!
    const carte = carteALaVersion(g.joker, depart.v)!
    const t = r.tour
    // Ce que ses chiffres lisent de la question, avant qu'elle ne parte de la main : sa catégorie, ce qui y est déjà effacé.
    const q = e.enAttente === null ? undefined : questions[e.enAttente]
    const effacees = q ? effaceesDuTour(t.surLaQuestion, r.pouvoirs, { reponses: q.reponses ?? 4, datee: q.datee }) : 0
    oter(r.main, g.joker)
    t.jouees.push(g.joker)
    if (carte.moment === 'reflexe' || g.joker === 'corser' || g.joker === 'simplifier') t.surLaQuestion.push(g.joker)
    if (carte.moment === 'pouvoir') r.pouvoirs.push(g.joker)
    else if (carte.epuisement) r.epuisees.push(g.joker)
    else r.defausse.push(g.joker)
    // Ses chiffres — l'inspiration qu'elle coûte, la Charge, la Garde, la série — : la règle que la page relit, carte levée.
    const x = chiffresApresLaCarte(g.joker, { inspiration: t.inspiration, charge: t.charge, garde: t.garde, serie: r.serie }, r.pouvoirs, {
      v: depart.v,
      fetiche: !!depart.fetiche && q?.categorie === depart.fetiche,
      effacees,
    })
    t.inspiration = x.inspiration
    t.charge = x.charge
    t.garde = x.garde
    r.serie = x.serie
    switch (g.joker) {
      case 'pioche':
        piocher(2)
        break
      case 'feu-d-artifice':
        r.pioche = [...r.pioche, ...r.defausse].sort()
        r.defausse = []
        piocher(3)
        break
      case 'abysses':
        e.courage! -= COUT_DES_ABYSSES
        break
      case 'horizon':
        e.courage = Math.min(COURAGE_MAX, e.courage! + r.derniereFrappe)
        r.derniereFrappe = 0
        e.recompenseVide = true
        break
      case 'echange':
      case 'mue': {
        // Une autre question, de la même escale : celle-ci ne se pose plus ; ce qui la visait ne vise pas l'autre.
        const i = e.enAttente!
        e.passees = i + 1
        e.enAttente = i + 1
        e.autre = null
        t.surLaQuestion = g.joker === 'mue' ? ['mue'] : []
        if (r.boucle?.position === i) {
          r.boucle = null
          r.pouvoirs = r.pouvoirs.filter(c => c !== 'boucle')
        }
        break
      }
      case 'deux-visages':
        e.autre = e.enAttente! + 1
        break
      case 'prediction':
        t.montre = g.montre
        break
    }
  }
  /** Il voit la question (v5) : sa mise est dite, le tour passe à la question. */
  const voir = (g: Extract<GesteDExpedition, { quoi: 'voir' }>) => {
    const r = e.rencontre
    if (!r || r.tour.phase !== 'preparation' || e.enAttente === null) return
    if (refusDeLaMise(e, g.mise) !== null) return
    r.tour.mise = g.mise
    r.tour.phase = 'question'
  }
  const offrir = (coffre: boolean) => {
    if (coffre && e.coffreVide) {
      e.coffreVide = false
      e.offre = { jokers: [], aPrendre: 0 }
      return
    }
    const rang = e.offres++
    const talisman = avecEcus ? talismanDeLOffre(depart.graine, rang, e.talismans, false) : null
    e.offre = {
      jokers: offreDeJokers(depart.graine, rang, depart.v),
      aPrendre: coffre && pose('tresor') ? 2 : 1,
      ...(avecEcus && coffre && { coffre: true as const }),
      ...(talisman && { talisman }),
    }
  }
  /** Une échoppe — ou le marchand de l'inconnu — : trois jokers, un talisman s'il en reste, du hasard de son rang d'offre. */
  const ouvrirLEchoppe = () => {
    const rang = e.offres++
    const poids = raretesDeLOffre(depart.v, e.acte, 'elite')
    const jokers = avecLeCodex
      ? offreDuCodex(depart.graine, rang, depart.codex!.cartes, e.paquet, poids)
      : avecRencontres
        ? offreDeCartes(depart.graine, rang, famillesDeLEquipee(depart.equipee ?? []), poids, depart.v >= 6)
        : offreDeJokers(depart.graine, rang, depart.v)
    e.echoppe = { jokers, talisman: talismans ? talismanDeLOffre(depart.graine, rang, e.talismans, true) : null, achats: [] }
  }
  /** Une vie de moins hors d'une question — un piège — : Renaissance relève, sinon l'expédition s'arrête là. */
  const blesser = () => {
    if (avecRencontres) {
      // Hors d'une rencontre, aucun pouvoir ne veille : un piège qui prend tout son courage finit l'expédition.
      e.courage = Math.max(0, e.courage! - COURAGE_D_UN_PIEGE)
      if (e.courage === 0) e.issue = 'perdue'
      return
    }
    e.vies -= 1
    if (e.vies > 0) return
    if (pose('renaissance')) {
      e.vies = 1
      servi('renaissance')
    } else {
      e.vies = 0
      e.issue = 'perdue'
    }
  }
  const entrerDansLInconnu = (id: string) => {
    const contenu = contenuDeLInconnu(depart.graine, e.acte, id)
    if (contenu === 'marchand') {
      ouvrirLEchoppe()
      e.inconnu = { contenu }
    } else if (contenu === 'piege') {
      e.inconnu = { contenu }
      blesser()
    } else {
      // Son joker va dans la main, même pleine : il ne reste que l'acte. En rencontre (v5), sa carte rejoint le paquet, le temps de l'acte.
      const legendaire = legendaireDePassage(depart.graine, e.acte, id, depart.equipee ?? [])
      const j = avecRencontres ? carteDuLegendaire(legendaire) : jokerDuLegendaire(legendaire)
      if (j) {
        if (avecRencontres) {
          e.paquet.push(j.cle)
          e.paquet.sort()
        } else e.main.push(j.cle)
        e.passages.push(j.cle)
      }
      e.inconnu = { contenu, legendaire }
    }
  }
  const vaincre = () => {
    const acte = e.acte
    e.vaincus++
    e.gardien = null
    if (avecEcus) e.ecus += ECUS_D_UN_GARDIEN
    if (avecRencontres) {
      // Son paquet reste le sien : le gardien y glisse sa carte, ceux de passage s'en vont, les cartes de route reviennent.
      const c = carteDuLegendaire(depart.gardiens[acte])
      if (c) e.paquet.push(c.cle)
      for (const p of e.passages) oter(e.paquet, p)
      e.passages = []
      e.paquet.sort()
      e.routeJouees = []
      e.rencontre = null
      // Le codex (v7) : le coffre d'un gardien vaincu — pas du dernier, qu'on garde — ouvre sur une légendaire de son codex.
      if (avecLeCodex && acte < Math.min(ACTES, depart.cartes.length) - 1) offrirDesCartes('gardien')
    } else if (avecJokers) {
      if (pose('aube') && e.aube) e.vies = Math.min(VIES, e.vies + 1)
      // Les posés finissent avec l'acte ; le gardien glisse son joker dans le paquet ; la défausse y revient.
      e.defausse.push(...e.poses)
      e.poses = []
      const j = jokerDuLegendaire(depart.gardiens[acte])
      if (j) e.paquet.push(j.cle)
      e.paquet.push(...e.defausse)
      e.defausse = []
      // Les jokers de passage s'en vont avec l'acte, d'où qu'ils soient.
      for (const p of e.passages) if (!oter(e.main, p)) oter(e.paquet, p)
      e.passages = []
      e.paquet.sort()
    }
    e.lanterne = false
    e.aube = false
    e.boucle = null
    e.elan = 0
    e.abysses = 0
    e.acte++
    e.ici = null
    e.trace = []
    e.route = { detour: false, raccourci: false, commandement: null }
    e.maisons = []
    e.joue = null
    // Ses questions de reste, tirées d'avance pour lui, ne se posent pas.
    while (questions[e.passees]?.escale === GARDIEN && questions[e.passees]?.acte === acte) e.passees++
    if (e.acte >= Math.min(ACTES, depart.cartes.length)) e.issue = 'au-bout'
  }

  /** Juge la question qui attend, si sa réponse est là ; vrai s'il l'a jugée. */
  const juger = (): boolean => {
    if (e.enAttente === null) return false
    const a = e.enAttente
    const b = e.autre
    const i = reponses.has(a) ? a : b !== null && reponses.has(b) ? b : null
    if (i === null) return false
    const juste = reponses.get(i)!
    if (avecRencontres) {
      e.enAttente = null
      e.autre = null
      e.passees = Math.max(a, b ?? a) + 1
      e.categorie = null
      if (e.rencontre) jugerEnRencontre(i, juste)
      else {
        // Une source (v5) : sans cartes ; retrouvée, elle rend du courage — ratée, elle ne coûte rien, le carnet la garde.
        e.coup = null
        if (juste) {
          e.justes++
          deSuite()
          const ici = e.ici ? escaleEnJeu(depart, e, e.ici) : undefined
          if (ici?.sorte === 'source') e.courage = Math.min(COURAGE_MAX, e.courage! + COURAGE_D_UNE_SOURCE)
        } else e.affilee = 0
      }
      return true
    }
    const sur = e.joue?.joker
    const escale = e.gardien || !e.ici ? undefined : escaleEnJeu(depart, e, e.ici)
    const sorte = e.gardien ? 'gardien' : escale?.sorte
    // Le Commandement de cette question : ses écus se lisent sur la chance que la carte annonçait sous lui.
    const commandee = e.categorie
    e.enAttente = null
    e.autre = null
    e.passees = Math.max(a, b ?? a) + 1
    e.categorie = null
    // La boucle : la question ratée revient ; retrouvée, elle rend sa vie. Sautée ou ratée encore, elle a servi.
    let retrouvee = false
    if (e.boucle && e.boucle.position !== null && e.boucle.position <= i) {
      retrouvee = juste && e.boucle.position === i
      e.boucle = null
      servi('boucle')
    }
    if (sur === 'passe-muraille') {
      // Traversée : ni trouvée ni ratée — elle part au carnet, sans coûter de vie.
    } else if (juste) {
      e.justes++
      deSuite()
      e.derniereErreur = false
      const surSaDerniere = e.vies === 1
      if (sorte === 'source' || retrouvee) e.vies = Math.min(VIES, e.vies + 1)
      if (pose('elan') && ++e.elan >= 3) {
        e.elan = 0
        tirer()
      }
      if (pose('abysses')) {
        if (!surSaDerniere) e.abysses = 0
        else if (++e.abysses >= 3) {
          e.abysses = 0
          e.vies = Math.min(VIES, e.vies + 1)
        }
      }
      if (avecEcus && escale && (sorte === 'question' || sorte === 'elite')) {
        const q = questions[i]
        e.ecus += ecusDeLaReponse({
          chance: chanceAnnoncee(depart, e.acte, escale, commandee),
          sujet: !commandee && !!escale.theme && 'sujet' in escale.theme,
          // Un vrai ou faux posé — tiré d'une autre, ou né tel : le hasard y fait la moitié du travail.
          vraiFaux: q?.reponses === 2,
          sport: e.talismans.includes('maillot-jaune') && q?.categorie === 'Sport',
          devoile: q?.devoile,
          elite: sorte === 'elite',
          quitteOuDouble: sur === 'quitte-ou-double',
        })
      }
      // Aux règles d'avant, une question trouvée est un adversaire tombé, pour la renommée ; une élite trouvée, une élite.
      if (sorte === 'question') e.bilan.adversaires++
      else if (sorte === 'elite') e.bilan.elites++
      if (e.gardien) e.gardien.trouvees++
      else if (sorte === 'elite' && avecJokers) offrir(false)
    } else {
      // Ratée, même une source : ce n'est plus « d'affilée ».
      e.affilee = 0
      // Une source ratée ne coûte rien, et n'est pas une erreur : le carnet la garde.
      const erreur = sorte !== 'source'
      let perte = erreur ? 1 : 0
      if (sur === 'sursis' || sur === 'mue') perte = 0
      else if ((sur === 'tout-ou-rien' || sur === 'quitte-ou-double') && erreur) perte = 2
      if (perte > 0 && e.vies === 1 && pose('peau-de-feu')) {
        perte = 0
        servi('peau-de-feu')
      }
      if (erreur) {
        e.aube = false
        e.elan = 0
        e.abysses = 0
      }
      e.derniereErreur = perte > 0
      if (perte > 0 && pose('boucle') && !e.boucle) e.boucle = { reprise: i, position: null }
      e.vies -= perte
      if (e.gardien) e.gardien.ratees++
      if (e.vies <= 0) {
        if (pose('renaissance')) {
          e.vies = 1
          servi('renaissance')
        } else {
          e.vies = 0
          e.gardien = null
          e.issue = 'perdue'
          return true
        }
      }
    }
    if (e.gardien) {
      if (e.gardien.trouvees >= MARCHES_DES_ACTES[e.acte].aTrouver) vaincre()
      else ouvrir()
    }
    return true
  }

  const avancer = (vers: string) => {
    if (e.issue !== 'en-route' || e.offre || e.campement) return
    if (!escalesPermises(depart, e).includes(vers)) return
    const escale = escaleEnJeu(depart, e, vers)
    if (!escale) return
    const lion = e.route.commandement
    e.route = { detour: false, raccourci: false, commandement: null }
    e.ici = vers
    e.trace.push(vers)
    e.bilan.escales++
    // L'échoppe se quitte en avançant ; ce que cachait l'inconnu d'avant ne se dit plus.
    e.echoppe = null
    e.inconnu = null
    if (escale.sorte === 'campement') {
      if (avecJokers) e.campement = true
      else e.vies = Math.min(VIES, e.vies + 1)
    } else if (escale.sorte === 'coffre') {
      if (avecRencontres) offrirDesCartes('coffre')
      else if (avecJokers) offrir(true)
    } else if (escale.sorte === 'echoppe') {
      if (avecEcus) ouvrirLEchoppe()
    } else if (escale.sorte === 'inconnu') {
      if (avecEcus) entrerDansLInconnu(vers)
    } else if (escale.sorte === 'gardien') {
      if (avecRencontres) commencerUneRencontre('gardien', vers, null)
      else e.gardien = { trouvees: 0, ratees: 0, debut: e.passees }
      ouvrir()
    } else if (avecRencontres && (escale.sorte === 'question' || escale.sorte === 'elite')) {
      // Le Commandement pose sa catégorie à toute la rencontre.
      commencerUneRencontre(escale.sorte, vers, lion)
      ouvrir()
    } else if (aUneQuestion(escale.sorte)) {
      const aSaCategorie = escale.sorte === 'question' || escale.sorte === 'elite'
      e.categorie = lion && aSaCategorie ? lion : null
      if (e.boucle && e.boucle.position === null && aSaCategorie) e.boucle.position = e.passees
      ouvrir()
    }
  }

  /** Ce que fait un joker — une carte, en v5 — de route : sur la carte, il vaut pour le pas suivant, ou pour l'acte. */
  const jouerSurLaCarte = (g: Extract<GesteDExpedition, { quoi: 'jouer' }>) => {
    if (g.joker === 'detour') e.route.detour = true
    else if (g.joker === 'raccourci') e.route.raccourci = true
    else if (g.joker === 'commandement') e.route.commandement = g.categorie ?? null
    else if (g.joker === 'maison' || g.joker === 'boule') {
      const m = maisonAOuvrir(depart, e, g.joker)
      if (m) e.maisons.push(m)
    } else if (g.joker === 'lanterne') e.lanterne = true
  }

  const jouer = (g: Extract<GesteDExpedition, { quoi: 'jouer' }>) => {
    if (refusDuJoker(depart, e, g.joker, questions, g) !== null) return
    if (avecRencontres) {
      // Une carte de route se joue une fois par acte, et reste dans son paquet ; les autres, en rencontre.
      if (estDeRoute(g.joker)) {
        jouerSurLaCarte(g)
        e.routeJouees.push(g.joker)
      } else jouerEnRencontre(g)
      return
    }
    const j = jokerDeCle(g.joker)!
    oter(e.main, g.joker)
    if (j.sorte === 'poser') {
      e.poses.push(g.joker)
      if (g.joker === 'aube') e.aube = true
      if (g.joker === 'elan') e.elan = 0
      if (g.joker === 'abysses') {
        // Le prix d'un maudit : le poser coûte une vie.
        e.vies -= 1
        e.abysses = 0
      }
      return
    }
    if (j.sorte === 'carte') {
      jouerSurLaCarte(g)
      e.defausse.push(g.joker)
      return
    }
    // À jouer, sur la question qui attend : il prend la place du joker de celle-ci.
    const i = e.enAttente!
    e.joue = { joker: g.joker, ...(g.montre !== undefined && { montre: g.montre }) }
    if (g.joker === 'echange' || g.joker === 'mue') {
      // Une autre question, de la même escale : celle-ci ne se pose plus, et ne tire pas de joker de plus.
      e.passees = i + 1
      e.enAttente = i + 1
      if (e.boucle?.position === i) {
        e.boucle = null
        servi('boucle')
      }
    } else if (g.joker === 'deux-visages') e.autre = i + 1
    else if (g.joker === 'pioche') {
      tirer()
      tirer()
    } else if (g.joker === 'reveil') e.vies = Math.min(VIES, e.vies + 1)
    else if (g.joker === 'horizon') {
      e.vies = Math.min(VIES, e.vies + 1)
      e.derniereErreur = false
      e.coffreVide = true
    } else if (g.joker === 'feu-d-artifice') {
      // Toute la défausse revient — pas lui, qu'on vient de jouer : il reviendrait aussitôt.
      e.paquet.push(...e.defausse)
      e.defausse = []
      e.paquet.sort()
    }
    e.defausse.push(g.joker)
  }

  const prendre = (g: Extract<GesteDExpedition, { quoi: 'prendre' }>) => {
    if (!e.offre) return
    const offre = e.offre
    // Le talisman prend la place d'un joker.
    const talisman = offre.talisman !== undefined && g.talisman === offre.talisman && offre.aPrendre > 0 ? offre.talisman : null
    const pris = [...new Set(g.jokers)].filter(j => offre.jokers.includes(j)).slice(0, offre.aPrendre - (talisman ? 1 : 0))
    e.paquet.push(...pris)
    e.paquet.sort()
    if (talisman && !e.talismans.includes(talisman)) e.talismans.push(talisman)
    // Un coffre qu'on passe sans rien prendre rapporte ses écus ; vide, il n'avait rien à laisser.
    if (offre.coffre && pris.length === 0 && !talisman && offre.jokers.length > 0) e.ecus += ECUS_D_UN_COFFRE_LAISSE
    e.offre = null
  }

  const acheter = (g: Extract<GesteDExpedition, { quoi: 'acheter' }>) => {
    // Le prix payé, que le journal garde ; un journal d'avant lui, celui du barème.
    const prix = g.prix ?? prixDeLArticle(g.article, g.joker)
    if (refusDeLAchat(e, g, prix) !== null || !e.echoppe) return
    const echoppe = e.echoppe
    e.ecus -= prix
    if (g.article === 'vie') {
      // En rencontre (v5), « une vie » est du courage.
      if (e.courage !== null) e.courage = Math.min(COURAGE_MAX, e.courage + COURAGE_A_L_ECHOPPE)
      else e.vies = Math.min(VIES, e.vies + 1)
      echoppe.achats.push('vie')
    } else if (g.article === 'joker') {
      e.paquet.push(g.joker!)
      e.paquet.sort()
      echoppe.achats.push(g.joker!)
    } else if (g.article === 'talisman') {
      e.talismans.push(echoppe.talisman!)
      echoppe.achats.push('talisman')
    } else {
      retirer(g.joker!)
      echoppe.achats.push('retirer')
    }
  }

  /** Un joker retiré — au campement, à l'échoppe —, d'où qu'il soit ; faux s'il n'est nulle part. */
  const retirer = (cle: string): boolean => {
    if (!(oter(e.paquet, cle) || oter(e.defausse, cle) || oter(e.main, cle))) return false
    // Celui de passage d'abord : il partait avec l'acte, et l'acte, sinon, prenait le même qu'un gardien a glissé.
    oter(e.passages, cle)
    return true
  }

  const camper = (cle: string | undefined) => {
    if (!e.campement) return
    if (cle === undefined) {
      if (e.courage !== null) e.courage = Math.min(COURAGE_MAX, e.courage + COURAGE_D_UN_CAMPEMENT)
      else e.vies = Math.min(VIES, e.vies + 1)
    } else if (!retirer(cle)) return
    e.campement = false
  }

  /** Un joker — une carte, un « voir » en rencontre — qui vise la question qui attend : il se joue avant qu'elle soit jugée. */
  const vise = (g: GesteDExpedition) => (g.quoi === 'jouer' || g.quoi === 'voir') && g.position !== undefined && (g.position === e.enAttente || g.position === e.autre)
  /**
   * Juge ce qui a sa réponse — jusqu'à la question que vise le geste `g` : la
   * suivante s'ouvre, et le joker joué sur elle se joue avant qu'elle soit
   * jugée. Jugées d'un coup, les questions du gardien passaient toutes avant
   * le joker de la deuxième, qui revenait dans la main au repli.
   */
  const jugerTout = (g?: GesteDExpedition) => {
    while (!fini() && !(g && vise(g)) && juger());
  }
  for (const g of gestes) {
    if (fini()) break
    if (!vise(g)) jugerTout(g)
    if (fini()) break
    if (g.quoi === 'abandonner') {
      e.issue = 'abandonnee'
      break
    }
    // Une question attend sans sa réponse : seul un joker qui la vise se joue par-dessus.
    if (e.enAttente !== null && !vise(g)) continue
    if (g.quoi === 'avancer') avancer(g.vers)
    else if (g.quoi === 'jouer') {
      if (avecJokers) jouer(g)
    } else if (g.quoi === 'prendre') prendre(g)
    else if (g.quoi === 'camper') camper(g.retirer)
    else if (g.quoi === 'acheter') {
      if (avecEcus) acheter(g)
    } else if (g.quoi === 'voir') {
      if (avecRencontres) voir(g)
    } else if (g.quoi === 'garder' && e.issue === 'au-bout' && depart.gardiens.includes(g.legendaire)) {
      e.issue = 'legendaire'
      e.garde = g.legendaire
    }
  }
  jugerTout()

  // Ce que le serveur doit tirer : la question de l'escale — la reprise de La boucle —, celles du gardien, l'autre de Deux visages.
  if (!fini() && e.enAttente !== null) {
    const derniere = e.autre ?? e.enAttente
    if (derniere >= questions.length) {
      const g = e.gardien
      // En rencontre (v5), une question à la fois, gardien compris : on ne sait pas d'avance combien il en faudra.
      const toutLeGardien = !avecRencontres && g !== null && questions.length <= g.debut
      const r = e.rencontre
      const categorie = r ? r.categorie : e.categorie
      const reprise = r ? (r.boucle?.position === e.enAttente ? r.boucle.reprise : undefined) : e.boucle?.position === e.enAttente ? e.boucle.reprise : undefined
      e.aTirer = {
        escale: g ? GARDIEN : (e.ici ?? ''),
        acte: e.acte,
        combien: toutLeGardien ? questionsDuGardien(e.acte, e.vies) : derniere - questions.length + 1,
        ...(categorie && { categorie }),
        ...(reprise !== undefined && { reprise }),
      }
    }
  }
  // Les vies de la série ne sont qu'un reflet pour les lectures de la campagne : en rencontre, celui du courage.
  if (avecRencontres) e.vies = e.courage! <= 0 ? 0 : Math.min(VIES, Math.ceil((e.courage! * VIES) / COURAGE_MAX))
  return e
}

/** Les cartes de route qu'il peut encore jouer dans l'acte (v5) : celles de son paquet, moins celles déjà jouées. */
export function routeDisponible(e: Pick<EtatDeLExpedition, 'paquet' | 'routeJouees'>): string[] {
  const jouees = [...e.routeJouees]
  const libres: string[] = []
  for (const cle of e.paquet) {
    if (!estDeRoute(cle)) continue
    const i = jouees.indexOf(cle)
    if (i >= 0) jouees.splice(i, 1)
    else libres.push(cle)
  }
  return libres
}

/**
 * Pourquoi cette mise ne se fait pas (v5) — null : elle se fait. Une des mises
 * permises, et de quoi la payer, doublée sous Doubler la mise ; depuis le
 * codex (v7), au niveau où le pari s'ouvre (`pari`). La page dit « pari ».
 */
export function refusDeLaMise(e: Pick<EtatDeLExpedition, 'ecus' | 'rencontre'> & { pari?: boolean }, mise: number): string | null {
  if (!MISES.includes(mise)) return `Parie ${MISES.join(', ').replace(/, (\d+)$/, ' ou $1')} écus`
  if (e.pari === false && mise > 0) return `Le pari s’ouvre au niveau ${niveauDeLaRegle('pari')} d’explorateur`
  const total = mise * (e.rencontre?.tour.jouees.includes('doubler-la-mise') ? 2 : 1)
  if (total > e.ecus) return `Il te manque ${total - e.ecus} écu${total - e.ecus > 1 ? 's' : ''} pour parier autant`
  return null
}

/** Ce que la question qui attend dit d'elle aux règles des cartes (v5) — jamais sa bonne réponse. */
export function questionDuTour(q: QuestionPosee | undefined): QuestionDuTour | null {
  if (!q) return null
  const reponses = q.reponses ?? 4
  const forme: FormeDEscale = reponses <= 2 ? 'vrai-faux' : (q.forme ?? 'quatre')
  return {
    reponses,
    tiree: q.tiree ?? forme,
    forme,
    six: !!q.six,
    nombre: !!q.nombre,
    datee: !!q.datee,
    categorie: q.categorie ?? null,
  }
}

/** Ce que les règles des cartes lisent de l'état d'une rencontre (v5). */
export function contexteDeLaCarte(depart: Pick<DepartDExpedition, 'v' | 'fetiche'>, e: EtatDeLExpedition, questions: readonly QuestionPosee[]): ContexteDUneCarte | null {
  const r = e.rencontre
  if (!r) return null
  return {
    v: depart.v,
    tour: r.tour,
    main: r.main,
    pouvoirs: r.pouvoirs,
    question: e.enAttente === null ? null : questionDuTour(questions[e.enAttente]),
    ...(depart.fetiche && { fetiche: depart.fetiche }),
    courage: e.courage ?? 0,
    derniereFrappe: r.derniereFrappe,
    defausse: r.defausse.length,
  }
}

/**
 * Pourquoi cette carte ne se joue pas maintenant (v5) — null : elle se joue.
 * Celles de route, sur la carte, une fois par acte ; les autres, en
 * rencontre (`refusDeLaCarte`). La Prédiction dit la réponse qu'elle montre.
 */
export function refusDUneCarte(
  depart: Pick<DepartDExpedition, 'v' | 'graine' | 'cartes' | 'chanceDeLaSource' | 'fetiche'>,
  e: EtatDeLExpedition,
  cle: string,
  questions: readonly QuestionPosee[],
  geste?: { categorie?: string; montre?: number },
): string | null {
  const carte = carteDeRencontre(cle)
  if (!carte) return 'Cette carte ne se lit pas : recharge la page'
  if (e.issue !== 'en-route') return 'L’expédition ne joue plus de carte'
  if (e.offre) return 'Choisis d’abord ce que tu prends'
  if (e.campement) return 'Choisis d’abord au campement : du courage, ou une carte retirée'
  if (carte.moment === 'route') {
    if (!routeDisponible(e).includes(cle)) return e.paquet.includes(cle) ? 'Déjà jouée dans cet acte : elle revient à l’acte suivant' : 'Cette carte n’est pas dans ton paquet : recharge la page'
    return refusSurLaCarte(depart, e, cle, geste, 'carte')
  }
  const c = contexteDeLaCarte(depart, e, questions)
  if (!c) return 'Elle se joue en rencontre'
  const refus = refusDeLaCarte(c, cle)
  if (refus) return refus
  if (cle === 'prediction' && geste && !(Number.isInteger(geste.montre) && geste.montre! >= 0 && geste.montre! < (c.question?.reponses ?? 0))) return 'Montre une des réponses à l’Oracle'
  return null
}

/**
 * La rencontre telle que la page la voit (v5) : l'adversaire, ses sceaux, sa
 * frappe à venir, le tour — et, de la question qui attend, l'annonce et
 * l'aperçu du verdict, jamais son texte avant qu'il la voie (invariant 1).
 */
export function vueDeLaRencontre(
  depart: Pick<DepartDExpedition, 'v' | 'graine' | 'cartes' | 'chanceDeLaSource' | 'chances' | 'fetiche' | 'gardiens'>,
  e: EtatDeLExpedition,
  questions: readonly QuestionPosee[],
): VueDeLaRencontre | undefined {
  const r = e.rencontre
  if (!r) return undefined
  const escale = r.sorte === 'gardien' ? undefined : escaleEnJeu(depart, e, r.escale)
  const q = e.enAttente === null ? undefined : questions[e.enAttente]
  const qt = questionDuTour(q)
  const echo = r.pouvoirs.includes('echolocation')
  const ctx = contexteDeLaCarte(depart, e, questions)
  const marche: Niveau = r.sorte === 'gardien' ? MARCHES_DES_ACTES[Math.min(e.acte, ACTES - 1)].gardien : escale ? marcheDe(e.acte, escale) : 'facile'
  let annonce: AnnonceDuTour | undefined
  if (q && qt) {
    // Sa chance : celle que la carte annonçait de l'escale — du gardien —, ramenée à la forme où elle se pose à présent.
    const dite = r.sorte === 'gardien' ? depart.cartes[e.acte]?.chanceDuGardien : escale ? chanceAnnoncee(depart, e.acte, escale, r.categorie) : undefined
    const chance = dite === undefined ? undefined : arrondiDeChance(chanceALaForme(dite, r.sorte === 'gardien' ? 'quatre' : (escale?.forme ?? 'quatre'), qt.forme))
    annonce = {
      categorie: q.categorie ?? null,
      niveau: q.niveau ?? marche,
      forme: qt.forme,
      reponses: qt.reponses,
      ...(q.mots !== undefined && { mots: q.mots }),
      ...(q.reponseEn && { reponseEn: q.reponseEn }),
      ...(!echo && chance !== undefined && { chance }),
      savoir: SAVOIR_DES_MARCHES[q.niveau ?? marche],
    }
  }
  const theme = r.categorie ? undefined : escale?.theme
  return {
    v: depart.v,
    sorte: r.sorte,
    adversaire: r.sorte === 'gardien' ? nomDuGardien(depart.gardiens[e.acte] ?? '') : adversaireDe(escale?.theme, r.categorie),
    ...(r.categorie ? { categorie: r.categorie } : theme && 'categories' in theme && theme.categories.length === 1 ? { categorie: theme.categories[0] } : {}),
    ...(theme && 'sujet' in theme && { sujet: theme.sujet }),
    sceaux: r.sceaux,
    max: r.max,
    frappe: frappeDeLaQuestion(r),
    questions: r.questions,
    serie: r.serie,
    phase: r.tour.phase,
    ...(e.enAttente !== null && { position: e.enAttente }),
    inspiration: r.tour.inspiration,
    charge: r.tour.charge,
    garde: r.tour.garde,
    mise: r.tour.mise,
    jouees: r.tour.jouees,
    pouvoirs: r.pouvoirs,
    main: r.main,
    pioche: r.pioche.length,
    defausse: r.defausse,
    epuisees: r.epuisees,
    refus: Object.fromEntries([...new Set(r.main)].map(cle => [cle, ctx ? refusDeLaCarte(ctx, cle) : null])),
    ...(r.tour.phase === 'preparation' && { mises: Object.fromEntries(MISES.map(m => [m, refusDeLaMise(e, m)])) }),
    // Le pari pas encore ouvert (v7) : la page ne le propose pas.
    ...(!e.pari && { pari: false as const }),
    ...(r.tour.phase === 'question' && qt && { effacees: effaceesDuTour(r.tour.surLaQuestion, r.pouvoirs, qt) }),
    ...(annonce && { annonce }),
    ...(annonce &&
      qt && {
        apercu: apercuDuTour({
          v: depart.v,
          tour: r.tour,
          pouvoirs: r.pouvoirs,
          sceaux: r.sceaux,
          frappe: frappeDeLaQuestion(r),
          savoir: annonce.savoir,
          question: { reponses: qt.reponses, forme: qt.forme, categorie: qt.categorie },
          ...(depart.fetiche && { fetiche: depart.fetiche }),
          ...(q?.mots !== undefined && { mots: q.mots }),
        }),
      }),
  }
}

/**
 * La carte de l'acte en cours, telle qu'il la joue : celle du départ, et les
 * escales qu'Il connaît la maison y a ouvertes — changées en source ou en
 * coffre, reliées à l'escale d'où il l'a joué.
 */
export function carteEnJeu(depart: Pick<DepartDExpedition, 'cartes' | 'chanceDeLaSource'>, e: Pick<EtatDeLExpedition, 'acte' | 'maisons'>): CarteDUnActe | null {
  const carte = depart.cartes[e.acte]
  if (!carte) return null
  if (e.maisons.length === 0) return carte
  const escales = carte.escales.map(x => ({ ...x, suite: [...x.suite] }))
  for (const m of e.maisons) {
    const vers = escales.find(x => x.id === m.vers)
    if (!vers) continue
    vers.sorte = m.sorte
    delete vers.theme
    delete vers.forme
    if (m.sorte === 'source' && depart.chanceDeLaSource !== undefined) vers.chance = depart.chanceDeLaSource
    else delete vers.chance
    const de = m.depuis === null ? null : escales.find(x => x.id === m.depuis)
    if (de && !de.suite.includes(m.vers)) de.suite.push(m.vers)
  }
  return { ...carte, escales }
}

/** Une escale de la carte en jeu. */
export const escaleEnJeu = (depart: Pick<DepartDExpedition, 'cartes' | 'chanceDeLaSource'>, e: Pick<EtatDeLExpedition, 'acte' | 'maisons'>, id: string) =>
  carteEnJeu(depart, e)?.escales.find(x => x.id === id)

/** Une chance au millième : ce que la page en écrit, sans faire voyager seize décimales — l'expédition, les paliers des sentiers. */
export const arrondiDeChance = (x: number) => Math.round(x * 1000) / 1000

/**
 * La chance qu'une escale annonce : celle du départ ; sous le Commandement,
 * celle de sa catégorie à sa marche, gardée au départ à quatre choix et
 * ramenée à la forme de l'escale. La carte la dit, et ses écus s'y lisent.
 */
export function chanceAnnoncee(depart: Pick<DepartDExpedition, 'chances'>, acte: number, x: EscaleDeLaCarte, commandement: string | null): number | undefined {
  if (commandement && (x.sorte === 'question' || x.sorte === 'elite')) {
    const p = depart.chances?.[commandement]?.[marcheDe(acte, x)]
    if (p !== undefined) return arrondiDeChance(chanceSelonLaForme(p, x.forme ?? 'quatre'))
  }
  return x.chance
}

/**
 * L'escale qu'Il connaît la maison ouvrirait d'ici : une question ou une élite
 * de l'étage du dessus, dans sa colonne ou une voisine, changée en source ou en
 * coffre — au hasard de la graine, de l'acte et du pas : rejoué, le même. Une
 * boule pour chacun (le Sapin, l'étape 4) en ouvre une de même, toujours en
 * coffre, de son propre hasard. Null : rien à ouvrir — au dernier étage,
 * au-dessus, ce sont les campements.
 */
export function maisonAOuvrir(
  depart: Pick<DepartDExpedition, 'graine' | 'cartes' | 'chanceDeLaSource'>,
  e: Pick<EtatDeLExpedition, 'acte' | 'ici' | 'trace' | 'maisons'>,
  quel: 'maison' | 'boule' = 'maison',
): MaisonOuverte | null {
  const carte = carteEnJeu(depart, e)
  if (!carte) return null
  const ici = e.ici === null ? null : carte.escales.find(x => x.id === e.ici)
  if (e.ici !== null && !ici) return null
  const etage = ici ? ici.etage + 1 : 0
  if (etage >= ETAGES) return null
  const candidates = carte.escales.filter(x => x.etage === etage && (x.sorte === 'question' || x.sorte === 'elite') && (!ici || Math.abs(x.colonne - ici.colonne) <= 1))
  if (candidates.length === 0) return null
  const r = hasardDe(`${depart.graine}:${quel}:${e.acte}:${e.trace.length}`)
  const vers = candidates[Math.floor(r() * candidates.length)]
  return { vers: vers.id, sorte: quel === 'boule' || r() >= 0.5 ? 'coffre' : 'source', depuis: e.ici }
}

/** Les pas d'ici : la suite de l'escale où il est — n'importe quelle escale de l'étage du dessus sous Le détour, une de plus sous Le raccourci. */
function pasDIci(depart: Pick<DepartDExpedition, 'cartes' | 'chanceDeLaSource'>, e: EtatDeLExpedition, route: { detour: boolean; raccourci: boolean }): string[] {
  const carte = carteEnJeu(depart, e)
  if (!carte) return []
  const parId = new Map(carte.escales.map(x => [x.id, x]))
  const suiteDe = (id: string | null) => (id === null ? carte.depart : (parId.get(id)?.suite ?? []))
  const ici = e.ici === null ? null : parId.get(e.ici)
  let pas = route.detour ? carte.escales.filter(x => x.etage === (ici ? ici.etage + 1 : 0)).map(x => x.id) : suiteDe(e.ici)
  if (route.raccourci) pas = [...new Set(pas.flatMap(id => suiteDe(id)))]
  return pas
}

/** Où il peut aller : les escales du bas à l'entrée d'un acte, la suite de l'escale où il est, le gardien depuis un campement — et ce que ses jokers de route y changent. */
export function escalesPermises(depart: Pick<DepartDExpedition, 'cartes' | 'chanceDeLaSource'>, e: EtatDeLExpedition): string[] {
  if (e.issue !== 'en-route' || e.enAttente !== null || e.gardien || e.offre || e.campement) return []
  return pasDIci(depart, e, e.route)
}

/**
 * Pourquoi ce joker ne se joue pas maintenant — null : il se joue. La page
 * grise ceux qui ne se jouent pas et dit pourquoi ; le serveur refuse le
 * geste ; le pli l'ignore, si un journal en gardait un.
 */
export function refusDuJoker(
  depart: Pick<DepartDExpedition, 'v' | 'graine' | 'cartes' | 'chanceDeLaSource' | 'fetiche'>,
  e: EtatDeLExpedition,
  cle: string,
  questions: readonly QuestionPosee[],
  geste?: { categorie?: string; montre?: number },
): string | null {
  // Les rencontres (v5) ont leurs cartes, et leur règle.
  if (depart.v >= 5) return refusDUneCarte(depart, e, cle, questions, geste)
  const j = jokerDeCle(cle)
  if (!j || depart.v < 2) return 'Ce joker ne se lit pas : recharge la page'
  if (e.issue !== 'en-route') return 'L’expédition ne joue plus de joker'
  if (!e.main.includes(cle)) return 'Ce joker n’est plus dans ta main : recharge la page'
  if (e.offre) return 'Choisis d’abord ce que tu prends'
  if (e.campement) return 'Choisis d’abord au campement : une vie, ou un joker retiré'
  if (j.sorte === 'poser') {
    if (e.poses.includes(cle)) return 'Il est déjà posé'
    if (cle === 'abysses' && e.vies < 2) return 'Il te faut deux vies pour le poser : il en coûte une'
    return null
  }
  if (j.sorte === 'carte') return refusSurLaCarte(depart, e, cle, geste, 'joker')
  // À jouer, sur la question qui attend.
  if (e.enAttente === null) return 'Ce joker se joue sur une question'
  if (e.joue) return 'Un seul joker par question'
  const q = questions[e.enAttente]
  if (q?.reponses === 2 && (cle in EFFACE || cle === 'double-chance')) return 'Pas sur un vrai ou faux : il répondrait à ta place'
  if (cle === 'arret-sur-image' && q?.forme !== 'devoilement') return 'Arrêt sur image se joue sur un dévoilement'
  // Deux textes qui se dévoilent ensemble, on n'en lirait aucun.
  if (cle === 'deux-visages' && q?.forme === 'devoilement') return 'Deux visages ne se joue pas sur un dévoilement'
  if (cle === 'prediction') {
    if (!q?.nombre) return 'La Prédiction se joue sur une année ou un nombre'
    if (geste && !(Number.isInteger(geste.montre) && geste.montre! >= 0 && geste.montre! < (q.reponses ?? 0))) return 'Montre une des réponses à l’Oracle'
  }
  if (cle === 'horizon' && !e.derniereErreur) return 'L’horizon se joue juste après une erreur qui t’a coûté une vie'
  if (cle === 'reveil' && e.vies >= VIES) return 'Tu as déjà tes trois vies'
  if (cle === 'feu-d-artifice' && e.defausse.length === 0) return 'Ta défausse est vide'
  if (cle === 'quitte-ou-double') {
    // Une source, le gardien ne paient pas d'écus par question : il n'y aurait rien à tripler.
    const sorte = e.gardien ? 'gardien' : e.ici ? escaleEnJeu(depart, e, e.ici)?.sorte : undefined
    if (sorte !== 'question' && sorte !== 'elite') return 'Quitte ou double se joue sur une question ou une élite : elles seules paient des écus'
  }
  return null
}

/**
 * Pourquoi un joker de carte — une carte de route, en rencontre — ne se joue
 * pas d'ici : entre deux escales, avant le campement, un joker de route à la
 * fois, quelque chose à sauter, à ouvrir ou à éclairer devant lui.
 */
function refusSurLaCarte(
  depart: Pick<DepartDExpedition, 'graine' | 'cartes' | 'chanceDeLaSource'>,
  e: EtatDeLExpedition,
  cle: string,
  geste: { categorie?: string } | undefined,
  mot: 'joker' | 'carte',
): string | null {
  if (e.enAttente !== null || e.gardien || e.rencontre) return mot === 'joker' ? 'Ce joker se joue sur le plan, entre deux escales' : 'Elle se joue sur le plan, entre deux escales'
  if (e.ici !== null && escaleEnJeu(depart, e, e.ici)?.sorte === 'campement') return 'Plus d’escale avant le gardien'
  if ((cle === 'detour' || cle === 'raccourci') && (e.route.detour || e.route.raccourci)) return mot === 'joker' ? 'Un joker de route est déjà en cours' : 'Une carte de route est déjà en cours'
  if (cle === 'raccourci' && pasDIci(depart, e, { detour: false, raccourci: true }).every(id => id === GARDIEN)) return 'Rien à sauter d’ici'
  if (cle === 'maison' && !maisonAOuvrir(depart, e)) return 'Aucune escale à ouvrir au-dessus de toi'
  if (cle === 'boule' && !maisonAOuvrir(depart, e, 'boule')) return 'Aucune escale à changer en coffre au-dessus de toi'
  if (cle === 'lanterne') {
    if (e.lanterne) return 'La lanterne est déjà allumée'
    const carte = carteEnJeu(depart, e)
    const devant = carte ? escalesAtteignables(carte, e.ici) : new Set<string>()
    if (!carte?.escales.some(x => x.sorte === 'inconnu' && devant.has(x.id))) return 'Aucun inconnu devant toi dans cet acte'
  }
  if (cle === 'commandement') {
    if (e.route.commandement) return 'Tu as déjà choisi la catégorie de l’escale suivante'
    if (geste && !(CATEGORIES as readonly string[]).includes(geste.categorie ?? '')) return 'Choisis une des douze catégories'
  }
  return null
}

/**
 * Pourquoi cet achat ne se fait pas — null : il se fait. Le pli l'ignore, le
 * serveur le refuse, la page le grise et dit pourquoi. Chaque article une
 * fois par échoppe ; une vie, sous trois ; un joker de l'étal ; un joker
 * retiré, de son paquet, de sa défausse ou de sa main ; et de quoi payer.
 */
export function refusDeLAchat(
  e: Pick<EtatDeLExpedition, 'issue' | 'echoppe' | 'ecus' | 'vies' | 'paquet' | 'defausse' | 'main' | 'talismans'> & { courage?: number | null },
  g: { article: ArticleDeLEchoppe; joker?: string },
  /** Le prix qu'il paie : celui du barème, sauf pour un achat que le journal garde à son prix. */
  prix = prixDeLArticle(g.article, g.joker),
): string | null {
  const echoppe = e.echoppe
  if (e.issue !== 'en-route' || !echoppe) return 'Il n’y a pas d’échoppe ici'
  // En rencontre (v5), l'échoppe vend du courage et des cartes : ses refus le disent en ces mots.
  const v5 = e.courage !== undefined && e.courage !== null
  if (g.article === 'vie') {
    if (v5) {
      if (echoppe.achats.includes('vie')) return 'Du courage, une fois par échoppe'
      if (e.courage! >= COURAGE_MAX) return 'Ton courage est au plus haut'
    } else if (echoppe.achats.includes('vie')) return 'Une vie par échoppe'
    else if (e.vies >= VIES) return 'Tu as déjà tes trois vies'
  } else if (g.article === 'joker') {
    if (!g.joker || !echoppe.jokers.includes(g.joker)) return v5 ? 'Cette carte n’est pas à l’étal' : 'Ce joker n’est pas à l’étal'
    if (echoppe.achats.includes(g.joker)) return v5 ? 'Déjà achetée' : 'Déjà acheté'
  } else if (g.article === 'talisman') {
    if (!echoppe.talisman) return 'Plus de talisman à vendre'
    if (echoppe.achats.includes('talisman') || e.talismans.includes(echoppe.talisman)) return 'Déjà acheté'
  } else {
    if (echoppe.achats.includes('retirer')) return v5 ? 'Une carte retirée par échoppe' : 'Un joker retiré par échoppe'
    if (!g.joker || ![...e.paquet, ...e.defausse, ...e.main].includes(g.joker)) return v5 ? 'Cette carte n’est pas dans ton paquet' : 'Ce joker n’est pas dans ton paquet'
  }
  if (e.ecus < prix) return `Il te manque ${prix - e.ecus} écu${prix - e.ecus > 1 ? 's' : ''}`
  return null
}

/** Combien de questions tirer pour le gardien : de quoi aller au bout de ses vies. */
export const questionsDuGardien = (acte: number, vies: number) => MARCHES_DES_ACTES[Math.min(acte, ACTES - 1)].aTrouver + Math.max(1, vies) - 1

// ── Ce que la page reçoit ──────────────────────────────────────────────────

/** Une question de l'expédition, telle que la page la reçoit : jamais la bonne réponse avant la sienne (invariant 1). */
export interface QuestionDExpedition extends QuestionDeCampagne {
  escale: string
  /** Les mauvaises réponses qu'un joker a effacées — Coup d'œil, Sagesse, Tout ou rien, L'écholocation. */
  effacees?: number[]
  /** Double chance : deux réponses, une juste suffit. */
  deux?: true
  /** L'Énigme : le siècle et le domaine de la question. */
  indice?: string
  /** La Prédiction : la réponse montrée à l'Oracle, et ce qu'il en dit. */
  prediction?: { montre: number; sens: SensDeLOracle }
  /** Sa forme, quand ce n'est pas celle de la base : six choix, un vrai ou faux tiré d'une question à quatre choix, un dévoilement. */
  forme?: FormeDEscale
  /** Un vrai ou faux tiré d'une question à quatre choix : la réponse proposée, à dire vraie ou fausse. */
  proposee?: string
  /**
   * Un dévoilement : son intitulé n'arrive pas ici (`texte` vide) — il se lit
   * mot à mot, du serveur, à mesure qu'il se dit —, seulement combien il a
   * de mots, de quoi dire où il en est.
   */
  devoilement?: { mots: number }
  /** La loupe (un talisman) : le siècle d'une question d'Histoire qui se date. */
  siecle?: string
}

/** Ce que dit l'Oracle d'une réponse montrée : la bonne est plus haut, plus bas, ou c'est elle. */
export type SensDeLOracle = 'haut' | 'bas' | 'juste'

/** Les jokers d'une expédition, tels que la page les voit : les siens, rien du hasard qui les tire. */
export interface JokersEnJeu {
  main: string[]
  paquet: string[]
  defausse: string[]
  poses: string[]
  /** Pour chaque joker de la main, pourquoi il ne se joue pas maintenant — null : il se joue (`refusDuJoker`). */
  refus: Record<string, string | null>
}

export interface VueDeLExpedition {
  id: string
  numero: number
  /** L'acte en cours, de 0 à 2 ; 3 au bout. */
  acte: number
  /** Ses trois gardiens ; `aLui` : déjà à lui — gagné ailleurs en route, ou tiré faute d'autres (`gardiensDe`). */
  gardiens: { cle: string; vaincu: boolean; aLui?: true }[]
  /** La carte de l'acte en cours ; aucune au bout. */
  carte: CarteDUnActe | null
  ici: string | null
  trace: string[]
  /** Les escales où il peut aller. */
  permises: string[]
  vies: number
  justes: number
  question?: QuestionDExpedition
  gardien?: { trouvees: number; aTrouver: number }
  issue: IssueDExpedition
  garde?: string
  /** Les chances de la carte sont celles d'un joueur moyen : la page le dit. */
  moyen: boolean
  /** Les gestes déjà faits : le suivant porte ce rang plus un. */
  rang: number
  /** Les légendaires qu'il a emmenés, et l'invité du jour de son départ. */
  equipee: string[]
  invite?: string
  /** Ses jokers ; absents d'une expédition de l'étape 1, qui n'en avait pas. */
  jokers?: JokersEnJeu
  /** Le joker joué sur la question qui attend. */
  joue?: string
  /** Ratée, la question qui attend ne coûte rien (Sursis, La mue) — ou deux vies (Tout ou rien, Quitte ou double). */
  perte?: 0 | 2
  /** Deux visages : l'autre question, au choix. */
  autre?: QuestionDExpedition
  /** Une offre à prendre : un coffre — vide après L'horizon —, une élite trouvée ; un talisman, parfois (v4). */
  offre?: OffreDeJokers
  /** Arrivé à un campement : une vie, ou un joker retiré. */
  campement?: true
  /** Les jokers de route en cours, jusqu'au pas suivant ; la lanterne, jusqu'au bout de l'acte. */
  route?: { detour?: true; raccourci?: true; commandement?: string; lanterne?: true }
  /** L'écholocation est posée : la carte ne dit plus sa chance. */
  sansChances?: true
  /** Ses écus et ses talismans (v4) ; absents d'une expédition d'avant les écus. */
  ecus?: number
  talismans?: string[]
  /** L'échoppe où il est — ou le marchand de l'inconnu — : il la quitte en avançant. */
  echoppe?: EchoppeOuverte
  /** L'inconnu où il vient d'entrer, dévoilé. */
  inconnu?: { contenu: ContenuDeLInconnu; legendaire?: string }
  /** La saison de son départ : la page la dit, et le gardien qu'elle a posé à l'acte 3. */
  saison?: CleDeSaison
  /** Le prototype des rencontres (v5) : son courage, sur `COURAGE_MAX`. */
  courage?: number
  /** Sa catégorie fétiche (v5). */
  fetiche?: string
  /** La rencontre en cours (v5) : l'adversaire, le tour, l'annonce et l'aperçu — la question n'arrive qu'une fois préparée. */
  rencontre?: VueDeLaRencontre
  /** Ses cartes (v5) : tout son paquet, et celles de route qu'il peut jouer sur la carte. */
  cartes?: CartesEnJeu
  /**
   * La renommée qu'elle lui rapporte, de ce qu'elle a fait jusqu'ici
   * (`renommeeDe`, `bilanDuPli`) : la fin la dit, et le niveau qu'elle fait
   * passer.
   */
  renommee?: number
  /**
   * Les exploits qu'elle a faits jusqu'ici, au codex (v7) : la révélation dit
   * celui qui tombe, la fin ceux qui sont neufs — ce que son codex n'avait pas
   * au départ (`CartesEnJeu.codex.exploits`).
   */
  exploits?: CleDExploit[]
}

/** Les cartes d'une expédition en rencontres (v5), telles que la page les voit hors d'une rencontre. */
export interface CartesEnJeu {
  /** La version de son départ : ses cartes se lisent à ses chiffres (`carteALaVersion`) — celles que le codex a retouchées. */
  v: number
  /** Tout son paquet : ses cartes pour toute l'expédition, celles de route comprises. */
  paquet: string[]
  /** Les cartes de route qu'il peut encore jouer sur la carte, dans cet acte. */
  route: string[]
  /** Pour chacune d'elles, pourquoi elle ne se joue pas maintenant — null : elle se joue. */
  refus: Record<string, string | null>
  /** Les cartes que chaque question tire, acte par acte (`cartesDesActes`) : les règles le disent, la page n'en recopie rien. */
  parQuestion: number[]
  /**
   * Son codex à son départ (v7) : son niveau, les règles ouvertes — les
   * règles disent celles qui attendent —, et la renommée qu'il avait : la fin
   * y ajoute celle de l'expédition (`VueDeLExpedition.renommee`) pour dire le
   * niveau gagné. Ses exploits d'alors : la fin dit ceux qu'elle ajoute, et
   * le dos doré habille son paquet ; absents d'un départ d'avant les exploits.
   */
  codex?: { niveau: number; regles: RegleDuCodex[]; renommee?: number; exploits?: CleDExploit[] }
}

/**
 * Son codex, sur la page de l'expédition (le 18 octobre 2026) : sa renommée,
 * de toutes ses expéditions finies — perdues et abandonnées comprises —, son
 * niveau d'explorateur, et ce qu'il ouvre — les cartes, celles des exploits
 * qu'il a faits et des légendaires qu'il a comprises, et les règles —, ses
 * exploits. Son départ le figera tel quel.
 */
export interface CodexDeLaPage {
  renommee: number
  niveau: number
  cartes: string[]
  regles: RegleDuCodex[]
  exploits: CleDExploit[]
}

/** Ce que la page de l'expédition lit en arrivant. */
export interface PageDeLExpedition {
  expedition: VueDeLExpedition | null
  /**
   * La prochaine expédition : son numéro et ses gardiens, annoncés avant le
   * départ — et ceux qu'il a déjà (`aLui`) : les garder au bout ne
   * rapporterait que l'expérience de leurs réponses, la page le dit avant.
   * L'invité du jour, et les légendaires qu'il peut emmener — les siens qui ont
   * leur joker.
   */
  prochaine: {
    numero: number
    gardiens: string[]
    aLui: string[]
    invite: string
    equipables: string[]
    saison?: CleDeSaison
    /** Le prototype des rencontres s'offre au départ : hors de la production (`RENCONTRES_EN_PRODUCTION`). */
    rencontres?: true
    /** Son codex (le 18 octobre 2026), là où les rencontres s'offrent. */
    codex?: CodexDeLaPage
  }
  /** Son passeport : les thèmes pointus qu'il a trouvés en expédition, chacun une fois — leurs clés (`shared/sujets.ts`). */
  passeport: string[]
}

/** Ce qu'une réponse rend : son verdict, et ce qui est tombé si l'expédition finit là. */
export interface ReponseDExpedition {
  juste: boolean
  bonne: number
  anecdote: string | null
  xp: number
  expedition: VueDeLExpedition
  /** Le gardien vient de tomber : sa clé. */
  vaincu?: string
  recompenses?: PalierTombe[]
  legendaires?: string[]
  /** Un dévoilement : son intitulé entier, qu'il n'avait peut-être pas fini de lire. */
  texte?: string
  /** Un dévoilement : les mots dits quand sa réponse est arrivée, à l'heure du serveur (invariant 6), sur combien. */
  devoile?: { mots: number; sur: number }
  /** Les écus qu'elle rapporte (v4) : ceux de l'escale, et ceux du gardien qui tombe. */
  ecus?: number
  /** Le tampon neuf qu'elle met à son passeport : le thème pointu de l'escale, trouvé pour la première fois. */
  tampon?: string
  /** En rencontre (v5) : ce qu'elle a brisé, ce qu'elle a coûté, ce que la mise a fait — et la victoire. */
  coup?: CoupDeRencontre
}

/** Une famille du passeport : ses sujets dans l'ordre du catalogue, et combien il en a tamponné. */
export interface FamilleDuPasseport {
  famille: FamilleDeSujet
  /** « Pays », « Époques » : le nom de son onglet parmi les thèmes. */
  nom: string
  sujets: { cle: string; nom: string; tamponne: boolean }[]
  tamponnes: number
}

/**
 * Son passeport (le 18 octobre 2026), famille par famille, dans l'ordre de
 * l'onglet des thèmes : chaque sujet qu'une carte peut tirer (`SUJETS`),
 * tamponné ou non. Un tampon d'un sujet sorti du catalogue reste au journal
 * et au Globe-trotter, mais ne se montre plus.
 */
export function passeportParFamille(tampons: readonly string[]): FamilleDuPasseport[] {
  const tenus = new Set(tampons)
  return FAMILLES_DE_SUJETS.map(({ famille, pluriel }) => {
    const sujets = SUJETS.filter(s => s.famille === famille).map(s => ({ cle: s.cle, nom: s.nom, tamponne: tenus.has(s.cle) }))
    return { famille, nom: pluriel, sujets, tamponnes: sujets.filter(s => s.tamponne).length }
  }).filter(f => f.sujets.length > 0)
}

/** Ce que rend un geste : l'expédition d'après, et, à sa fin, ce qui est tombé — le légendaire gardé. */
export interface ApresUnGeste {
  expedition: VueDeLExpedition
  recompenses?: PalierTombe[]
  legendaires?: string[]
}

// ── Ce qu'un joker montre d'une question : le serveur seul le calcule ──────

/**
 * Les mauvaises réponses qu'effacent les jokers d'une question — jamais plus
 * de deux sur quatre : une de plus, et le joker répondrait à sa place. Au
 * hasard de la graine et du rang de la question, dans le même ordre pour tous
 * les jokers : celle que L'écholocation efface le reste quand un Coup d'œil
 * s'y ajoute. Elle lit la bonne réponse : le serveur seul l'appelle.
 */
export function reponsesEffacees(graine: string, position: number, q: { reponses: readonly string[]; bonne: number }, combien: number): number[] {
  if (q.reponses.length <= 2 || combien <= 0) return []
  const r = hasardDe(`${graine}:efface:${position}`)
  const fausses = q.reponses.map((_, i) => i).filter(i => i !== q.bonne)
  for (let i = fausses.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[fausses[i], fausses[j]] = [fausses[j], fausses[i]]
  }
  return fausses.slice(0, Math.min(combien, q.reponses.length - 2)).sort((a, b) => a - b)
}

const ROMAINS: readonly [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

/** « Le XIXe siècle », « Le Ier siècle av. J.-C. ». Une date au siècle près, « 1800 », dit le siècle qu'elle ouvre. */
function siecleDe(annee: number, auSiecle: boolean): string {
  const ans = Math.abs(annee)
  let n = Math.floor((Math.max(1, ans) - 1) / 100) + 1
  if (auSiecle && ans % 100 === 0) n = ans / 100 + 1
  let romain = ''
  for (let reste = n; reste > 0; ) {
    const [valeur, chiffres] = ROMAINS.find(([v]) => v <= reste)!
    romain += chiffres
    reste -= valeur
  }
  return `Le ${n === 1 ? 'Ier' : `${romain}e`} siècle${annee < 0 ? ' av. J.-C.' : ''}`
}

/** Le siècle d'une question qui se date — null sinon : ce que la loupe dit d'une question d'Histoire, et le début de l'Énigme. */
export function siecleDeLaQuestion(q: { date?: { valeur: string; precision?: string } | null }): string | null {
  const annee = q.date ? Number(/^-?\d+/.exec(q.date.valeur)?.[0]) : Number.NaN
  return Number.isFinite(annee) && annee !== 0 ? siecleDe(annee, q.date?.precision === 'siecle') : null
}

/** L'indice de l'Énigme : le siècle de la question — ou qu'elle ne se date pas — et son domaine, sa catégorie et son sous-thème. */
export function indiceDeLEnigme(q: { categorie: string | null; sousTheme?: string; date?: { valeur: string; precision?: string } | null }): string {
  const quand = siecleDeLaQuestion(q) ?? 'Elle ne se date pas'
  const sousTheme = q.categorie && q.sousTheme ? SOUS_THEMES[q.categorie as keyof typeof SOUS_THEMES]?.find(s => s.cle === q.sousTheme)?.nom : undefined
  const domaine = [q.categorie, sousTheme].filter(Boolean).join(', ')
  return domaine ? `${quand} · ${domaine}` : quand
}

/** Le nombre d'une réponse : le premier qu'elle écrit, compté avant notre ère s'il l'est. Null : elle n'en écrit pas. */
function nombreDeLaReponse(texte: string): number | null {
  const debut = texte.search(/[+\-−]?\d/)
  if (debut < 0) return null
  const lu = lireNombreEnTete(texte.slice(debut))
  if (!lu) return null
  return /av(\.|ant)\s*J\.?-?C/i.test(texte) ? -Math.abs(lu.valeur) : lu.valeur
}

/** Ce que dit l'Oracle d'une réponse montrée, sur une question d'années ou de nombres : la bonne est plus haut, plus bas — ou c'est elle. */
export function sensDeLOracle(q: { reponses: readonly string[]; bonne: number }, montre: number): SensDeLOracle {
  if (montre === q.bonne) return 'juste'
  const bonne = nombreDeLaReponse(q.reponses[q.bonne] ?? '')
  const vue = nombreDeLaReponse(q.reponses[montre] ?? '')
  if (bonne === null || vue === null) return montre < q.bonne ? 'haut' : 'bas'
  return bonne > vue ? 'haut' : 'bas'
}

/** Le nom d'un gardien, tel que la page le dit : « Le Kraken », « La Chouette d'Argent ». */
export function nomDuGardien(cle: string): string {
  return legendaire(cle)?.nom ?? cle
}

/** Dans une phrase : « le Kraken », « la Chouette d’Argent », « l’Oracle », « Janus ». */
export function leGardien(cle: string): string {
  const nom = nomDuGardien(cle)
  return /^(Le|La|Les) |^L’/.test(nom) ? nom.charAt(0).toLowerCase() + nom.slice(1) : nom
}

/** Après « à » : « au Kraken », « à la Chouette d’Argent », « à l’Oracle », « à Janus ». */
export function auGardien(cle: string): string {
  const nom = nomDuGardien(cle)
  if (nom.startsWith('Le ')) return `au ${nom.slice(3)}`
  if (nom.startsWith('Les ')) return `aux ${nom.slice(4)}`
  return `à ${leGardien(cle)}`
}

/** Après « de » : « du Phénix », « de la Chouette d’Argent », « de l’Oracle », « de Janus ». */
export function duGardien(cle: string): string {
  const nom = nomDuGardien(cle)
  if (nom.startsWith('Le ')) return `du ${nom.slice(3)}`
  if (nom.startsWith('Les ')) return `des ${nom.slice(4)}`
  return `de ${leGardien(cle)}`
}

/** « La Comète est vaincue », « le Kraken est vaincu » : les noms en « La » sont les seuls au féminin. */
export const gardienAuFeminin = (cle: string) => nomDuGardien(cle).startsWith('La ')
