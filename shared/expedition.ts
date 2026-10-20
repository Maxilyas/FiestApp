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
import { LETTRES_EN_TROP, gabaritDe, signesDe, sonArticle, type CaseAComposer } from './lettres'
import { CURIOSITE_DES_L_ETAGE, PART_DU_REBUS, RARETES_D_UNE_CURIOSITE, type SorteDeCuriosite } from './curiosites'
import { lireNombreEnTete } from './nombres'
import type { PalierTombe } from './jour'
import type { CleDeSaison } from './saisons'
import type { CleDeCompagnon } from './compagnons'
import { FAMILLES_DE_SUJETS, SUJETS, type FamilleDeSujet } from './sujets'
import {
  ASCENSION_MAX,
  BONNES_D_AFFILEE,
  PARI_DE_L_EXPLOIT,
  cransDeLAdversaire,
  energieDuTour,
  frappeDeLAdversaire,
  mainMaxEnQuestion,
  niveauDeLaRegle,
  offreDuCodex,
  pointsDeLAdversaire,
  regleOuverte,
  reposALAscension,
  soinALAscension,
  type BilanDUneExpedition,
  type CleDExploit,
  type CodexDuDepart,
  type DosDuPaquet,
  type RegleDuCodex,
} from './codex'
import {
  CLAIRVOYANCE_SUR_LA_QUESTION,
  COURAGE_A_L_ECHOPPE,
  COURAGE_D_UN_CAMPEMENT,
  COURAGE_D_UN_PIEGE,
  COURAGE_D_UNE_FIOLE,
  COURAGE_D_UNE_SOURCE,
  soinALaVersion,
  COURAGE_DE_LA_RENAISSANCE,
  COURAGE_DE_L_AUBE,
  COURAGE_DES_ABYSSES,
  COURAGE_DE_LA_PANACEE,
  COURAGE_DE_LA_PANACEE_PLUS,
  COURAGE_DU_SECOND_SOUFFLE,
  COURAGE_DU_SECOND_SOUFFLE_PLUS,
  COURAGE_MAX,
  COUT_DES_ABYSSES,
  BOUCLIER_DE_LA_CUIRASSE,
  BOUCLIER_DE_LA_CUIRASSE_PLUS,
  CARTES_PAR_OFFRE,
  CHANCE_D_UNE_OFFRE_AMELIOREE,
  ECUS_AU_DEPART,
  ENERGIE_D_UNE_FIOLE,
  FIOLES,
  FIOLES_EN_QUESTION,
  FIOLES_MAX,
  MAIN_A_L_OUVERTURE_DE_L_ACTE,
  MISES,
  SAVOIR_DES_MARCHES,
  SEUIL_DES_ABYSSES,
  VERSION_DE_LA_QUESTION_AU_CENTRE,
  VERSION_DES_FAMILLES,
  VERSION_DU_DETAIL,
  VERSION_DU_CODEX,
  VERSION_DU_JEU_COMPLET,
  adversaireDe,
  ameliorer,
  amelioreeParmi,
  apercuDuTour,
  attaqueEnQuestion,
  baseDe,
  brisesDUneBonneReponse,
  carteALaVersion,
  carteDeRencontre,
  carteDuLegendaire,
  cartesDeCombat,
  cartesParQuestion,
  cartesTireesDuTour,
  changeDeQuestion,
  chiffresApresLaCarte,
  courageDeLaCarte,
  cransDUneBonneReponse,
  douteApresLaQuestion,
  douteDUneErreur,
  ecusPerdusDesCartes,
  effaceesAvecLEssai,
  effaceesDuTour,
  formeDeLaCarte,
  enJeu,
  enPlusApresLaForme,
  enPlusDesPouvoirs,
  estAmelioree,
  estDeRoute,
  estDuPari,
  estUnStyle,
  famillesDeLEquipee,
  fioleDe,
  frappeDUneErreur,
  frappeDeLaQuestion,
  frappeEnPlus,
  gainDeLaMise,
  gainDuPariEnQuestion,
  multiplicateurDeLaForme,
  offreDeCartes,
  paquetDesRencontres,
  pariPerdu,
  parmi,
  raretesDeLOffre,
  refusDeLAmelioration,
  refusDeLaCarte,
  retombentALErreur,
  revientSiJuste,
  riposte,
  rongeDuDoute,
  secondEssaiDuTour,
  siJuste,
  suiteDUneBonneReponse,
  tireEnPlusEnQuestion,
  viseLaQuestion,
  type AnnonceDuTour,
  type CleDeFiole,
  type ContexteDUneCarte,
  type CoupDeRencontre,
  type QuestionDuTour,
  type RencontreEnCours,
  type SorteDeRencontre,
  type TourDeRencontre,
  type StyleDeJeu,
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
 * ses escales. La curiosité est venue avec la version 12 (`shared/curiosites.ts`).
 */
export type SorteDEscale = 'question' | 'elite' | 'source' | 'coffre' | 'inconnu' | 'echoppe' | 'campement' | 'gardien' | 'curiosite'

/**
 * Ce que cache l'inconnu (l'étape 4) : un marchand — une échoppe —, un piège
 * — une vie —, ou un légendaire de passage, dont le joker reste dans la main
 * jusqu'au bout de l'acte. Tiré de la graine et de l'escale : la carte le sait
 * dès le départ, mais la page ne le reçoit qu'une fois dévoilé (invariant 1).
 */
export type ContenuDeLInconnu = 'marchand' | 'piege' | 'passage'

/**
 * La forme d'une question : à quatre choix, vrai ou faux, à six choix, mot à
 * mot — et, depuis les coups de pouce (v11), à composer (`shared/lettres.ts`) ;
 * depuis la frise (v13), quatre événements à ranger (`shared/frise.ts`) ;
 * depuis le détail (v15), un tableau qui se montre d'un détail au tableau
 * entier, et son peintre à trouver parmi quatre.
 */
export type FormeDEscale = 'quatre' | 'vrai-faux' | 'six' | 'devoilement' | 'lettres' | 'frise' | 'detail'

/**
 * Les formes qu'une carte tire : toutes depuis l'étape 3 — quatre choix,
 * vrai ou faux, six choix, dévoilement —, à composer depuis les coups de
 * pouce, la frise depuis la version 13 et le détail depuis la 15, que seuls
 * leurs poids tirent (`POIDS_DES_FORMES_A_COMPOSER`,
 * `POIDS_DES_FORMES_A_LA_FRISE`, `POIDS_DES_FORMES_AU_DETAIL`). Celles
 * d'avant, gardées par leur expédition, restent à quatre choix.
 */
const FORMES_OUVERTES: ReadonlySet<FormeDEscale> = new Set(['quatre', 'vrai-faux', 'six', 'devoilement', 'lettres', 'frise', 'detail'])

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
  /** Une curiosité (v12) : ce qu'elle demande — d'où vient un plat, ou un rébus. La carte le dit avant qu'on y entre. */
  curiosite?: SorteDeCuriosite
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

/**
 * Les marches du détail (v15, « bien plus difficile », avec l'offset que le
 * propriétaire a demandé) : l'acte 3 pose ses hauts étages et son gardien
 * en experte — un choix de produit qui rompt le « jamais d'experte » des
 * versions d'avant (le joueur moyen en trouve une sur dix) : de tous les
 * leviers mesurés, le seul qui retienne le fort ; les crans et l'attaque
 * retiraient au moyen, pas à lui. L'élite garde sa marche difficile — elle a
 * ses crans de plus : experte aussi, le fort tombait sous cinquante
 * (`docs/reference/baremes.md`).
 */
export const MARCHES_PLUS_DURES: typeof MARCHES_DES_ACTES = [
  { bas: 'facile', haut: 'facile', elite: 'moyen', gardien: 'facile', aTrouver: 4 },
  { bas: 'facile', haut: 'moyen', elite: 'moyen', gardien: 'moyen', aTrouver: 3 },
  { bas: 'moyen', haut: 'expert', elite: 'difficile', gardien: 'expert', aTrouver: 3 },
]

/** Les marches d'un départ de cette version : plus dures depuis le détail (v15). */
export const marchesDe = (v = 0): typeof MARCHES_DES_ACTES => (v >= VERSION_DU_DETAIL ? MARCHES_PLUS_DURES : MARCHES_DES_ACTES)

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
export type PoidsDesFormes = readonly { forme: FormeDEscale; part: number }[]
export const POIDS_DES_FORMES: PoidsDesFormes = [
  { forme: 'quatre', part: 0.4 },
  { forme: 'vrai-faux', part: 0.2 },
  { forme: 'six', part: 0.2 },
  { forme: 'devoilement', part: 0.2 },
]
/**
 * Celles d'un départ des coups de pouce (v11) : une escale à composer sur
 * cinq dès l'étage 2 (le choix du propriétaire du 19 octobre 2026), prise aux
 * quatre choix et aux deux formes de la question au centre qui en valaient
 * deux crans — le vrai ou faux garde sa part, la porte de qui doute. Le
 * premier étage ne change pas. Des choix de produit.
 */
export const POIDS_DES_FORMES_A_COMPOSER: PoidsDesFormes = [
  { forme: 'quatre', part: 0.3 },
  { forme: 'vrai-faux', part: 0.2 },
  { forme: 'six', part: 0.15 },
  { forme: 'devoilement', part: 0.15 },
  { forme: 'lettres', part: 0.2 },
]
/**
 * Celles d'un départ de la frise (v13) : une escale sur dix dès l'étage 2,
 * prise aux quatre choix — les autres formes gardent leur part, et le même
 * tirage qu'en version 11 : seule la forme qu'il désigne change. Le premier
 * étage ne change pas. Des choix de produit (le brief :
 * `retours/2026-10-20/la-frise.md`).
 */
export const POIDS_DES_FORMES_A_LA_FRISE: PoidsDesFormes = [
  { forme: 'quatre', part: 0.2 },
  { forme: 'vrai-faux', part: 0.2 },
  { forme: 'six', part: 0.15 },
  { forme: 'devoilement', part: 0.15 },
  { forme: 'lettres', part: 0.2 },
  { forme: 'frise', part: 0.1 },
]
/**
 * Celles d'un départ du détail (v15) : l'escale sur dix de la frise, moitié
 * chacune (le propriétaire, le 20 octobre 2026) — le même tirage encore,
 * seule la forme qu'il désigne change. Un détail se pose en Arts & lettres
 * (`CATEGORIE_DU_DETAIL`) : ses tableaux viennent tous de là.
 */
export const POIDS_DES_FORMES_AU_DETAIL: PoidsDesFormes = [
  { forme: 'quatre', part: 0.2 },
  { forme: 'vrai-faux', part: 0.2 },
  { forme: 'six', part: 0.15 },
  { forme: 'devoilement', part: 0.15 },
  { forme: 'lettres', part: 0.2 },
  { forme: 'frise', part: 0.05 },
  { forme: 'detail', part: 0.05 },
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
 * change. `formes`, de même : celles d'un départ des coups de pouce (v11) ont
 * leurs escales à composer, sur le même tirage — ni une escale, ni un thème ne
 * bouge. `curiosites` : un départ des curiosités (v12) en pose une, la carte
 * faite, sur son propre fil (`poserLaCuriosite`).
 */
export function carteDUnActe(
  graine: string,
  acte: number,
  sujets: readonly string[],
  fete?: string,
  poids: PoidsDesEscales = POIDS_DES_ESCALES,
  formes: PoidsDesFormes = POIDS_DES_FORMES,
  curiosites = false,
): CarteDUnActe {
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
          for (const p of formes) {
            cumul += p.part
            if (t < cumul) {
              forme = p.forme
              break
            }
          }
        }
        e.forme = FORMES_OUVERTES.has(forme) ? forme : 'quatre'
        // Un détail (v15) : la carte dit d'où vient son tableau. Posé après le tirage, il n'en déplace rien.
        if (e.forme === 'detail') e.theme = { categories: [CATEGORIE_DU_DETAIL] }
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
  if (curiosites) poserLaCuriosite(graine, acte, escales)

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

/**
 * La curiosité d'un acte (v12) : une de ses escales à question, dès le
 * deuxième étage, devient une escale bonus — le plat une fois sur deux, le
 * rébus sinon (`PART_DU_REBUS`). Sur son propre fil, une fois la carte
 * faite : tirée dans celui de la carte, elle aurait décalé la sorte, le thème
 * et la forme de toutes les escales d'après — « tirée à part : aucune autre
 * escale ne bouge » (le choix du propriétaire du 19 octobre 2026). Une carte
 * sans question à changer n'en a pas.
 */
function poserLaCuriosite(graine: string, acte: number, escales: EscaleDeLaCarte[]): void {
  const r = hasardDe(`${graine}:curiosite:${acte}`)
  const candidates = escales.filter(e => e.sorte === 'question' && e.etage >= CURIOSITE_DES_L_ETAGE)
  if (candidates.length === 0) return
  const e = candidates[Math.floor(r() * candidates.length)]
  e.sorte = 'curiosite'
  e.curiosite = r() < PART_DU_REBUS ? 'rebus' : 'plat'
  delete e.theme
  delete e.forme
}

/** La marche d'une escale à question : celle de son acte, selon l'étage — l'élite celle du dessus, le gardien la sienne. */
export function marcheDe(acte: number, e: Pick<EscaleDeLaCarte, 'sorte' | 'etage'>, v = 0): Niveau {
  const m = marchesDe(v)[Math.min(acte, ACTES - 1)]
  if (e.sorte === 'gardien') return m.gardien
  if (e.sorte === 'elite') return m.elite
  return e.etage < ETAGES_DU_BAS ? m.bas : m.haut
}

/** Une escale où l'on répond : question, élite, source, gardien — et la curiosité (v12). */
export const aUneQuestion = (s: SorteDEscale) => s === 'question' || s === 'elite' || s === 'source' || s === 'gardien' || s === 'curiosite'

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

// ── Le détail (v15) ────────────────────────────────────────────────────────

/**
 * Le détail : un tableau dont on ne voit d'abord qu'un détail, puis un cadrage
 * plus large tous les `MS_PAR_CADRAGE`, jusqu'au tableau entier — le
 * `CADRAGES_DU_DETAIL`-ième —, à l'heure du serveur (invariant 6) ; Arrêt sur
 * image en suspend le compte, comme celui d'un dévoilement. Trouvé dans la
 * première moitié de ses cadrages, il vaut deux crans (`cransDeLaForme`). La
 * question ne nomme jamais le tableau : son intitulé de la base le ferait.
 * Des choix de produit (`docs/reference/baremes.md`).
 */
export const CADRAGES_DU_DETAIL = 4
export const MS_PAR_CADRAGE = 5000
export const QUESTION_DU_DETAIL = 'Qui a peint ce tableau ?'
/** La catégorie de ses tableaux : la carte la pose sur l'escale d'un détail. */
export const CATEGORIE_DU_DETAIL = 'Arts & lettres'

/** Combien de cadrages d'un détail se montrent à l'instant `t` — l'heure du serveur : le premier dès `depuis`, sans la pause d'Arrêt sur image. */
export function cadragesMontres(depuis: number, t: number, arret?: number): number {
  if (t < depuis) return 0
  return Math.min(CADRAGES_DU_DETAIL, 1 + Math.floor(tempsCompte(depuis, t, arret) / MS_PAR_CADRAGE))
}

/** L'adresse d'un cadrage (v15) : l'expédition, la position de sa question, son rang — jamais le tableau, que la route seule connaît. */
export const adresseDuCadrage = (expedition: string, position: number, cadrage: number) => `/api/expedition/${expedition}/detail/${position}/${cadrage}`

/** L'instant où se montre le `n`-ième cadrage (de 1 à `CADRAGES_DU_DETAIL`) : la route ne le sert pas avant. */
export function instantDuCadrage(n: number, depuis: number, arret?: number): number {
  const sansPause = depuis + Math.max(0, n - 1) * MS_PAR_CADRAGE
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
 * une vie, l'un de ses trois jokers (selon sa rareté — l'épique depuis le jeu
 * complet), son talisman, un joker retiré de son paquet ; au codex, sa fiole
 * — entre une commune et une rare : elle ne sert qu'une fois, mais quand on
 * veut ; depuis le jeu complet, une carte de son paquet améliorée — le prix
 * d'une fiole : elle ajoute moins qu'une carte neuve, mais pour toute
 * l'expédition. Chaque article une fois par échoppe. Des choix de produit.
 */
export const PRIX_DE_L_ECHOPPE: Readonly<{
  vie: number
  talisman: number
  retirer: number
  ameliorer: number
  commun: number
  rare: number
  epique: number
  maudit: number
  fiole: number
}> = {
  vie: 40,
  commun: 20,
  rare: 35,
  epique: 55,
  maudit: 15,
  talisman: 50,
  retirer: 15,
  ameliorer: 25,
  fiole: 25,
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

/**
 * La fiole d'un coffre ou d'une échoppe (le codex, au niveau qui les ouvre),
 * l'une des trois à parts égales : du hasard de la graine et du rang de
 * l'offre, à part de ses cartes — elle ne décale aucun autre tirage.
 */
export function fioleDeLOffre(graine: string, rang: number, v = 0): CleDeFiole {
  // Dans la question au centre (v10), l'énergie n'est plus : ses deux fioles à parts égales.
  const fioles = v >= VERSION_DE_LA_QUESTION_AU_CENTRE ? FIOLES_EN_QUESTION : FIOLES
  return fioles[Math.floor(hasardDe(`${graine}:fiole:${rang}`)() * fioles.length)].cle
}

/** Ce qu'il achète à l'échoppe : une vie, un de ses jokers, son talisman, un joker retiré de son paquet — ou sa fiole (le codex), une carte améliorée (le jeu complet). */
export type ArticleDeLEchoppe = 'vie' | 'joker' | 'talisman' | 'retirer' | 'fiole' | 'ameliorer'

/** Le prix d'un article : un joker selon sa rareté. */
export function prixDeLArticle(article: ArticleDeLEchoppe, cle?: string): number {
  if (article === 'joker') {
    // Une carte des rencontres (v5) que les jokers n'ont pas — Banco, Bibliothèque — se paie à sa rareté à elle, pas au prix d'une commune.
    const rarete = jokerDeCle(cle)?.rarete ?? carteDeRencontre(cle)?.rarete
    return rarete === 'rare' || rarete === 'epique' || rarete === 'maudit' ? PRIX_DE_L_ECHOPPE[rarete] : PRIX_DE_L_ECHOPPE.commun
  }
  return PRIX_DE_L_ECHOPPE[article]
}

// ── Les chances ────────────────────────────────────────────────────────────

/**
 * Le hasard de chaque forme : un sur quatre à quatre choix et au
 * dévoilement, un sur six à six choix, un sur deux en vrai ou faux — et un
 * sur dix à composer (v11) : des tuiles bien rangées font parfois trouver un
 * mot à moitié su ; un sur vingt-quatre pour une frise (v13), les vingt-quatre
 * ordres de quatre événements. Un choix de produit, que le calibrage lit.
 */
const HASARD: Record<FormeDEscale, number> = { quatre: 1 / 4, devoilement: 1 / 4, six: 1 / 6, 'vrai-faux': 1 / 2, lettres: 1 / 10, frise: 1 / 24, detail: 1 / 4 }

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
   * talismans et la catégorie fétiche attendent leur niveau. 8 : le jeu
   * complet (`VERSION_DU_JEU_COMPLET`) — ses quarante-deux cartes de plus,
   * l'épique dans les offres (`raretesDeLOffre`), et l'énergie qui suit les
   * actes (`ENERGIE_DES_ACTES`, deux à l'acte 1) ; une expédition partie en
   * version 7 garde ses trois d'énergie et ses offres. 9 : les huit familles
   * (`VERSION_DES_HUIT_FAMILLES`) — le Sophiste et le Téméraire, leurs seize
   * cartes, le doute ; une expédition partie en version 8 n'en tire aucune.
   * 10 : la question au centre (`VERSION_DE_LA_QUESTION_AU_CENTRE`) — la
   * question d'abord, le pari seul avant elle ; l'adversaire en crans,
   * l'erreur à prix fixe ; une carte par question, sans énergie, la main de
   * l'acte (`EtatDeLExpedition.cycle`) ; soixante-deux cartes, cinq styles ;
   * la préproduction d'abord, partout depuis le 20 octobre 2026
   * (`QUESTION_AU_CENTRE_EN_PRODUCTION`). 11 :
   * les coups de pouce (`VERSION_DES_COUPS_DE_POUCE`) — la forme à composer
   * sur ses cartes (`POIDS_DES_FORMES_A_COMPOSER`), L'initiale, Le repère et
   * La lettre au codex (`ECHELLE_DES_COUPS_DE_POUCE`) ; une expédition partie
   * en version 10 n'en a ni escale ni carte. 12 : les curiosités
   * (`VERSION_DES_CURIOSITES`) — une escale bonus par acte sur ses cartes, le
   * plat ou le rébus (`shared/curiosites.ts`), et sa récompense ; une
   * expédition partie en version 11 n'en a pas. 13 : la frise
   * (`VERSION_DE_LA_FRISE`) — quatre événements à ranger, une escale sur dix
   * (`POIDS_DES_FORMES_A_LA_FRISE`, `shared/frise.ts`) ; une expédition
   * partie en version 12 n'en a pas. 14 : les familles en façons de répondre
   * (`VERSION_DES_FAMILLES`) — les cartes reprises et retouchées
   * (`EN_FAMILLES`), le Rempart et son second essai (le geste `essai`) ; une
   * expédition partie en version 13 garde ses cartes à leurs mots. 15 : le
   * détail (`VERSION_DU_DETAIL`) — un tableau à reconnaître d'un détail
   * (`POIDS_DES_FORMES_AU_DETAIL`), un acte 3 plus dur, son gardien en
   * experte (`MARCHES_PLUS_DURES`), l'Élan
   * retouché (`EN_DETAIL`) ; une expédition partie en version 14 finit à ses
   * règles.
   */
  v: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
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
  /**
   * Le dos de son paquet (le codex) : choisi au départ parmi ceux qu'il a —
   * sinon le plus rare —, gardé avec lui. Le pli ne le lit pas : la page
   * l'habille. Absent d'un départ d'avant les dos.
   */
  dos?: DosDuPaquet
  /**
   * Son cran de l'Ascension (le codex, `shared/codex.ts`) : choisi au départ
   * parmi ceux qu'il a ouverts, gardé avec lui — ouvrir le suivant en route
   * ne durcit pas l'expédition qu'il joue. Absent : aucun cran, comme toute
   * expédition d'avant l'Ascension ; le pli ne le lit qu'au codex
   * (`ascensionDuDepart`).
   */
  ascension?: number
  /**
   * Son style (le 19 octobre 2026) : une famille, choisie au départ parmi
   * celles que son codex ouvre — ses deux cartes de départ dans le paquet,
   * une de ses cartes dans chaque offre. Un champ neuf, sans version : un
   * départ d'avant lui se lit sans style, et rejoue son paquet et ses offres
   * tels quels. Le pli ne le lit qu'au codex (`styleDuDepart`).
   */
  style?: StyleDeJeu
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
  /** Une offre prise : ses cartes, et son talisman ou sa fiole (le codex), chacun à la place d'une carte. */
  | { quoi: 'prendre'; jokers: string[]; talisman?: string; fiole?: CleDeFiole }
  /** Au campement : du repos, une carte retirée — ou, depuis le jeu complet, une carte améliorée. */
  | { quoi: 'camper'; retirer?: string; ameliorer?: string }
  /**
   * Une fiole bue (le codex) : quand il veut — pendant une question, elle
   * porte sa position, comme une carte jouée sur elle.
   */
  | { quoi: 'boire'; fiole: CleDeFiole; position?: number }
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
  /**
   * Les familles (v14) : la première réponse, fausse, d'une question qui
   * avait un second essai (`secondEssaiDuTour`). Le serveur l'écrit à la place
   * de la réponse, à la position de sa question — `campagne_reponses` n'en
   * tient qu'une par question : elle ne se juge pas, et il répond encore.
   * `choix`, la réponse effacée d'une question à choix — la vue ne la
   * propose plus. Jamais envoyé par la page (`gesteRecevable`).
   */
  | { quoi: 'essai'; position: number; choix?: number }

/**
 * Ce que la page envoie pour un geste : le rang qu'il croit suivre, et les
 * cartes qu'elle a jouées sur place avant lui, en préparation
 * (`jouerSurPlace`). Le serveur les rejoue dans l'ordre, chacune jugée comme
 * si elle était partie seule, et les écrit d'un même lot avec lui — toutes ou
 * aucune ; le rang est celui de la première.
 */
export interface GesteAvecSesCartes {
  rang: number
  geste: GesteDExpedition
  avant?: Extract<GesteDExpedition, { quoi: 'jouer' }>[]
}

/** Une question posée, telle que la partie la range : l'escale et l'acte où elle a été tirée, et ce qu'un joker doit en savoir. */
export interface QuestionPosee {
  escale: string
  acte: number
  /** Combien de réponses elle propose : à deux, un vrai ou faux, rien ne s'efface ni ne se double. */
  reponses?: number
  /** Ses réponses sont des années ou des nombres : la Prédiction s'y joue. */
  nombre?: boolean
  /**
   * La forme où elle s'est posée, quand ce n'est pas celle de la base : Arrêt
   * sur image ne se joue que sur un dévoilement. À composer (v11), ses
   * réponses (`reponses`) sont ses tuiles : ses lettres de trop s'effacent.
   */
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
  /** Sa bonne réponse se compose (v14) : Miroir et Métamorphose la posent à composer. */
  compose?: boolean
}

export type IssueDExpedition = 'en-route' | 'au-bout' | 'legendaire' | 'perdue' | 'abandonnee'

/** Ce que le serveur doit tirer pour que l'expédition continue : la question d'une escale, celles du gardien, la reprise de La boucle. */
export interface ATirer {
  escale: string
  acte: number
  combien: number
  /** La catégorie que le Commandement a imposée à l'escale — depuis les familles (v14), la fétiche de Leçon et de la Bibliothèque. */
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
  /** Les fioles qu'il porte (le codex), `FIOLES_MAX` au plus, dans l'ordre où il les a eues. */
  fioles: CleDeFiole[]
  /** Le cran de l'Ascension où il est parti (le codex) : 0 sans — et hors du codex. */
  ascension: number
  /**
   * La main de l'acte (la question au centre, v10) : la pioche, la main, la
   * défausse, gardées d'une question et d'une rencontre à l'autre — la
   * rencontre en cours tient les mêmes tableaux. Une carte jouée part à la
   * défausse, qui ne revient qu'à l'acte suivant : chaque carte sert une fois
   * par acte, et le gardien attend au bout. Null avant elle : chaque rencontre
   * battait tout le paquet.
   */
  cycle: { pioche: string[]; main: string[]; defausse: string[] } | null
  /**
   * Ce qui attend la question suivante (v10) : les Augures joués, qui y
   * effaceront chacun une mauvaise réponse — dès qu'une question en a de quoi,
   * dans cette rencontre ou la suivante.
   */
  dAvance: string[]
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
  /** La fiole d'un coffre (le codex), à prendre à la place d'une carte — s'il lui reste une place pour elle. */
  fiole?: CleDeFiole
  /** La récompense d'une curiosité trouvée (v12) : des cartes rares, une fiole, un talisman, un à prendre — laissée, elle ne rapporte rien. */
  curiosite?: true
}

/** Une échoppe ouverte : ses trois jokers, son talisman — sa fiole, au codex —, et ce qu'il y a déjà acheté : `vie`, `talisman`, `retirer`, `fiole`, `ameliorer` ou la clé d'un joker. */
export interface EchoppeOuverte {
  jokers: string[]
  talisman: string | null
  fiole?: CleDeFiole
  /** Elle améliore une carte de son paquet (le jeu complet). */
  ameliorer?: true
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
type DepartLu = Pick<DepartDExpedition, 'v' | 'graine' | 'cartes' | 'gardiens' | 'equipee' | 'chanceDeLaSource' | 'chances' | 'fetiche' | 'codex' | 'ascension'>

/** Ce qu'une expédition a fait, que la renommée compte : le bilan du pli, ses gardiens et le bout — ses exploits, et son cran d'Ascension. */
export function bilanDuPli(e: Pick<EtatDeLExpedition, 'bilan' | 'vaincus' | 'issue' | 'exploits' | 'ascension'>): BilanDUneExpedition {
  return {
    ...e.bilan,
    gardiens: e.vaincus,
    auBout: e.issue === 'au-bout' || e.issue === 'legendaire',
    exploits: [...e.exploits],
    ...(e.ascension > 0 && { ascension: e.ascension }),
  }
}

/** Le cran de l'Ascension d'un départ : celui qu'il a figé, au codex seulement — une expédition d'avant n'en a aucun. */
export const ascensionDuDepart = (depart: Pick<DepartDExpedition, 'v' | 'codex' | 'ascension'>) =>
  depart.v >= VERSION_DU_CODEX && depart.codex ? Math.min(Math.max(0, depart.ascension ?? 0), ASCENSION_MAX) : 0

/** Le style d'un départ : celui qu'il a figé, au codex seulement, et s'il en est un — rien pour un départ d'avant lui. */
export const styleDuDepart = (depart: Pick<DepartDExpedition, 'v' | 'codex' | 'style'>): StyleDeJeu | undefined =>
  depart.v >= VERSION_DU_CODEX && depart.codex && estUnStyle(depart.style) ? depart.style : undefined

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
  // La question au centre (v10) : la question d'abord, l'adversaire en crans, la main de l'acte, une carte par question.
  const enQuestion = depart.v >= VERSION_DE_LA_QUESTION_AU_CENTRE
  // Les familles (v14) : chaque style une façon de répondre — le second essai, les cartes qui reviennent, la fétiche qu'on fait venir.
  const familles = depart.v >= VERSION_DES_FAMILLES
  // L'Ascension (le codex) : ses crans durcissent le courage du départ, les adversaires et le repos.
  const ascension = ascensionDuDepart(depart)
  // Son style (le 19 octobre 2026) : ses deux cartes dans le paquet de départ, une des siennes dans chaque offre.
  const style = styleDuDepart(depart)
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
    paquet: avecRencontres ? paquetDesRencontres(depart.equipee ?? [], style, depart.v) : avecJokers ? paquetDeDepart(depart.equipee ?? []) : [],
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
    fioles: [],
    ascension,
    cycle: enQuestion ? { pioche: [], main: [], defausse: [] } : null,
    dAvance: [],
  }
  // Le codex (v7) : ses offres ne tirent que les cartes qu'il a ouvertes, et les talismans attendent leur niveau — les fioles aussi.
  const avecLeCodex = depart.v >= VERSION_DU_CODEX && !!depart.codex
  const talismans = regleOuverte(depart, 'talismans')
  const fioles = regleOuverte(depart, 'fioles')
  // Le jeu complet : ses cartes s'améliorent — au campement, à l'échoppe, et dans les offres des actes 2 et 3.
  const ameliorations = avecRencontres && depart.v >= VERSION_DU_JEU_COMPLET
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
      if (e.rencontre) {
        if (enQuestion) nouveauTourEnQuestion()
        else nouveauTour()
      }
      return
    }
    if (avecJokers) {
      tirer()
      if (pose('trois-tetes')) tirer()
    }
  }

  // ── Les rencontres (v5) ──

  /** La marche des questions d'une rencontre : celle du gardien de l'acte, sinon celle de son escale. */
  const marcheDeLaRencontre = (r: RencontreEnCours): Niveau => {
    if (r.sorte === 'gardien') return marchesDe(depart.v)[Math.min(e.acte, ACTES - 1)].gardien
    const escale = escaleEnJeu(depart, e, r.escale)
    return escale ? marcheDe(e.acte, escale, depart.v) : 'facile'
  }
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
  /**
   * Un tour s'ouvre sur la question qui attend : l'inspiration — celle de son
   * acte, depuis le jeu complet —, la main, et ce que le tour d'avant lui a
   * laissé ; Maîtrise et Cuirasse, posées, y ajoutent la leur.
   */
  const nouveauTour = () => {
    const r = e.rencontre!
    r.tour = {
      phase: 'preparation',
      inspiration: energieDuTour(depart.v, e.acte, ascension) + r.suivant.inspiration + (parmi(r.pouvoirs, 'maitrise') ? 1 : 0),
      charge: r.suivant.charge,
      garde: r.suivant.garde + (amelioreeParmi(r.pouvoirs, 'cuirasse') ? BOUCLIER_DE_LA_CUIRASSE_PLUS : parmi(r.pouvoirs, 'cuirasse') ? BOUCLIER_DE_LA_CUIRASSE : 0),
      mise: 0,
      jouees: [],
      surLaQuestion: [],
    }
    const deplus = r.suivant.cartes + (r.pouvoirs.includes('trois-tetes') ? 2 : 0)
    r.suivant = { cartes: 0, inspiration: 0, charge: 0, garde: 0 }
    piocher(cartesParQuestion(depart.v, e.acte) + deplus)
    // La boucle : l'erreur revient à cette question-ci.
    if (r.boucle && r.boucle.position === null) r.boucle.position = e.enAttente
  }
  // ── La question au centre (v10) ──

  /** Ce que tient sa main : quatre cartes, cinq sous Trois têtes posé — une de moins au cran 4 de l'Ascension. */
  const mainMax = () => mainMaxEnQuestion(!!e.rencontre?.pouvoirs.includes('trois-tetes'), ascension)
  /** Une carte qui entre dans la main de l'acte : ni celles de route, ni celles du pari tant qu'il n'est pas ouvert — elles y dormiraient. */
  const seTireDansLActe = (cle: string) => !estDeRoute(cle) && (e.pari || !estDuPari(cle))
  /** Des cartes de la pioche de l'acte vers la main, tant qu'elle a de la place ; la pioche vide, rien — la défausse attend l'acte suivant. */
  const piocherEnQuestion = (n: number) => {
    const c = e.cycle!
    for (let k = 0; k < n && c.main.length < mainMax() && c.pioche.length > 0; k++) {
      const h = hasardDe(`${depart.graine}:pioche:${e.tirages++}`)
      c.main.push(c.pioche.splice(Math.floor(h() * c.pioche.length), 1)[0])
    }
  }
  /**
   * Un acte s'ouvre : toutes ses cartes reviennent — la défausse et la main
   * d'avant —, et la main en tire trois. Les tableaux restent les mêmes : la
   * rencontre les tient aussi.
   */
  const ouvrirLeCycle = () => {
    const c = e.cycle!
    c.pioche.splice(0, c.pioche.length, ...cartesDeCombat(e.paquet).filter(seTireDansLActe).sort())
    c.main.length = 0
    c.defausse.length = 0
    piocherEnQuestion(MAIN_A_L_OUVERTURE_DE_L_ACTE)
  }
  /** Une carte gagnée en route — une offre, l'échoppe, un légendaire de passage — rejoint la pioche de l'acte : elle sert tout de suite. */
  const ajouterALActe = (cle: string) => {
    if (!e.cycle || !seTireDansLActe(cle)) return
    e.cycle.pioche.push(cle)
    e.cycle.pioche.sort()
  }
  /**
   * Un tour de la question au centre : la question d'abord — l'annonce et le
   * pari avant elle, s'il est ouvert, ou si elle se dévoile mot à mot : ses
   * mots ne courent qu'une fois vue (`voir`). Ce qu'Augure a effacé d'avance
   * s'y range, si elle a de quoi effacer.
   */
  const nouveauTourEnQuestion = () => {
    const r = e.rencontre!
    const q = e.enAttente === null ? undefined : questions[e.enAttente]
    r.tour = { phase: e.pari || q?.forme === 'devoilement' || q?.forme === 'detail' ? 'preparation' : 'question', inspiration: 0, charge: 0, garde: 0, mise: 0, jouees: [], surLaQuestion: [] }
    if (e.dAvance.length > 0 && q && (q.reponses ?? 4) > 2) r.tour.surLaQuestion.push(...e.dAvance.splice(0))
    // La boucle : l'erreur revient à cette question-ci.
    if (r.boucle && r.boucle.position === null) r.boucle.position = e.enAttente
  }

  /** Une rencontre commence : tout son paquet de combat dans la pioche — ce qu'une rencontre a épuisé revient à la suivante. */
  const commencerUneRencontre = (sorte: SorteDeRencontre, escale: string, categorie: string | null) => {
    e.rencontres++
    if (enQuestion) {
      // La question au centre : l'adversaire en crans, son attaque fixe ; la main est celle de l'acte.
      const crans = cransDeLAdversaire(sorte, e.acte, ascension)
      const c = e.cycle!
      e.rencontre = {
        sorte,
        escale,
        sceaux: crans,
        max: crans,
        frappe: frappeDeLAdversaire(sorte, e.acte, ascension),
        questions: 0,
        serie: 0,
        categorie,
        pouvoirs: [],
        pioche: c.pioche,
        main: c.main,
        defausse: c.defausse,
        epuisees: [],
        tour: { phase: 'question', inspiration: 0, charge: 0, garde: 0, mise: 0, jouees: [], surLaQuestion: [] },
        suivant: { cartes: 0, inspiration: 0, charge: 0, garde: 0 },
        trouvees: 0,
        derniereFrappe: 0,
        perdu: 0,
        aube: 0,
        boucle: null,
        doute: 0,
        enCrans: true,
      }
      return
    }
    const points = pointsDeLAdversaire(sorte, e.acte, ascension)
    e.rencontre = {
      sorte,
      escale,
      sceaux: points,
      max: points,
      frappe: frappeDeLAdversaire(sorte, e.acte, ascension),
      questions: 0,
      serie: 0,
      categorie,
      pouvoirs: [],
      pioche: cartesDeCombat(e.paquet).sort(),
      main: [],
      defausse: [],
      epuisees: [],
      tour: { phase: 'preparation', inspiration: 0, charge: 0, garde: 0, mise: 0, jouees: [], surLaQuestion: [] },
      suivant: { cartes: 0, inspiration: 0, charge: 0, garde: 0 },
      trouvees: 0,
      derniereFrappe: 0,
      perdu: 0,
      aube: 0,
      boucle: null,
      doute: 0,
    }
  }
  /**
   * Le jeu complet : aux actes 2 et 3, une carte d'une offre arrive parfois
   * améliorée (`CHANCE_D_UNE_OFFRE_AMELIOREE`). Son propre fil de hasard, un
   * tirage par carte — qu'elle s'améliore ou non — : les cartes de l'offre
   * restent celles qu'elle tirait, et rien d'autre ne se décale.
   */
  const ameliorees = (cartes: string[], rang: number): string[] => {
    const chance = ameliorations ? (CHANCE_D_UNE_OFFRE_AMELIOREE[e.acte] ?? 0) : 0
    if (chance <= 0) return cartes
    const h = hasardDe(`${depart.graine}:amelioree:${rang}`)
    return cartes.map(cle => (h() < chance && carteALaVersion(cle, depart.v)?.amelioration ? ameliorer(cle) : cle))
  }
  /**
   * Une offre de cartes (v5) — une rencontre gagnée, une élite, un coffre ; et,
   * depuis le codex (v7), le coffre d'un gardien vaincu, qui ouvre sur une
   * légendaire — ; vide après L'horizon. Un coffre, au niveau des fioles, en
   * cache une : on les trouve là, et à l'échoppe.
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
    const cartes = avecLeCodex
      ? offreDuCodex(depart.graine, rang, depart.codex!.cartes, e.paquet, poids, quelle === 'gardien', style)
      : offreDeCartes(depart.graine, rang, famillesDeLEquipee(depart.equipee ?? []), poids, depart.v >= 6)
    e.offre = {
      jokers: ameliorees(cartes, rang),
      aPrendre: 1,
      ...(quelle === 'coffre' && { coffre: true as const }),
      ...(quelle === 'gardien' && { gardien: true as const }),
      ...(talisman && { talisman }),
      ...(quelle === 'coffre' && fioles && { fiole: fioleDeLOffre(depart.graine, rang, depart.v) }),
    }
  }
  /**
   * La récompense d'une curiosité trouvée (v12) : trois places, une à prendre
   * — une carte rare de son codex, une fiole à leur niveau, un talisman au
   * sien. Une fiole quand son sac est plein, un talisman quand il les a tous,
   * ou une règle pas encore ouverte : une carte rare à leur place — une
   * fiole qu'il ne peut pas prendre ne serait qu'une place perdue. Ni
   * L'horizon, qui vide la récompense d'un combat, ni les écus d'un coffre
   * laissé : la curiosité est à part. Du hasard de la graine et du rang de
   * l'offre, comme les autres.
   */
  const offrirUneCuriosite = () => {
    const rang = e.offres++
    const talisman = talismans ? talismanDeLOffre(depart.graine, rang, e.talismans, true) : null
    const fiole = fioles && e.fioles.length < FIOLES_MAX ? fioleDeLOffre(depart.graine, rang, depart.v) : undefined
    const places = CARTES_PAR_OFFRE - (talisman ? 1 : 0) - (fiole ? 1 : 0)
    const cartes = avecLeCodex
      ? offreDuCodex(depart.graine, rang, depart.codex!.cartes, e.paquet, RARETES_D_UNE_CURIOSITE, false, style)
      : offreDeCartes(depart.graine, rang, famillesDeLEquipee(depart.equipee ?? []), RARETES_D_UNE_CURIOSITE, true)
    e.offre = {
      jokers: ameliorees(cartes.slice(0, places), rang),
      aPrendre: 1,
      curiosite: true,
      ...(talisman && { talisman }),
      ...(fiole && { fiole }),
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
    // La question au centre (v10) : L'aube n'y soigne plus ; les pouvoirs, qui ont agi toute la rencontre, rejoignent la défausse de l'acte.
    const courage = !enQuestion && r.pouvoirs.includes('aube') ? Math.min(COURAGE_MAX - e.courage!, COURAGE_DE_L_AUBE * r.aube) : 0
    e.courage! += courage
    if (enQuestion) e.cycle!.defausse.push(...r.pouvoirs)
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
    if (enQuestion) {
      jugerEnQuestion(i, juste)
      return
    }
    const r = e.rencontre!
    const t = r.tour
    const q = questions[i] ?? { escale: r.escale, acte: e.acte }
    const mise = enJeu(t)
    const traversee = t.surLaQuestion.includes('passe-muraille')
    // Le doute (v9) ronge d'abord, juste ou faux, puis baisse de 1 — sauf sous Paranoïa ; tombé du doute, il ne frappe plus.
    // Coup de grâce lit celui qu'il avait en répondant : ce que la page montrait.
    const doute = r.doute
    const ronge = rongeDuDoute(r.sceaux, doute)
    r.sceaux -= ronge
    r.doute = douteApresLaQuestion(doute, r.pouvoirs)
    const tombeDuDoute = ronge > 0 && r.sceaux <= 0
    let coup: CoupDeRencontre
    if (traversee) {
      // Ni trouvée ni ratée : ni frappe, ni sceaux, et la mise est rendue.
      coup = { juste: false, brises: 0, frappe: 0, absorbee: 0, perdu: 0, mise: 0, traversee: true }
    } else if (juste) {
      const escale = r.sorte === 'gardien' ? undefined : escaleEnJeu(depart, e, r.escale)
      const marche: Niveau = r.sorte === 'gardien' ? marchesDe(depart.v)[Math.min(e.acte, ACTES - 1)].gardien : escale ? marcheDe(e.acte, escale, depart.v) : 'facile'
      // Ce que ses pouvoirs y ajoutent et ce que sa forme vaut : la règle même de l'aperçu (`apercuDuTour`).
      const brises = brisesDUneBonneReponse({
        savoir: SAVOIR_DES_MARCHES[q.niveau ?? marche],
        charge: t.charge,
        enPlus: enPlusDesPouvoirs({ v: depart.v, pouvoirs: r.pouvoirs, fetiche: depart.fetiche, categorie: q.categorie, trouvees: r.trouvees, serie: r.serie, forme: q.reponses !== undefined && q.reponses <= 2 ? 'vrai-faux' : q.forme }),
        multiplicateur: multiplicateurDeLaForme(q, { pouvoirs: r.pouvoirs, surLaQuestion: t.surLaQuestion }),
        banco: enPlusApresLaForme(t, r.pouvoirs, doute),
        double: t.jouees.includes('quitte-ou-double'),
      })
      r.sceaux = Math.max(0, r.sceaux - brises)
      r.serie++
      r.trouvees++
      e.justes++
      deSuite()
      // Le pari, puis ce que les cartes du tour rapportent à part : les écus du Flambeur, le courage de Pansement et d'Adrénaline.
      const gain = mise > 0 ? gainDeLaMise(t, r.pouvoirs) : 0
      const plus = siJuste(t.jouees, r.pouvoirs)
      e.ecus += gain + plus.ecus
      if (plus.courage > 0) e.courage = Math.min(COURAGE_MAX, e.courage! + plus.courage)
      if (mise >= PARI_DE_L_EXPLOIT) exploit('pari-de-40')
      if (r.pouvoirs.includes('aube')) r.aube++
      if (r.pouvoirs.includes('abysses') && e.courage! < SEUIL_DES_ABYSSES) e.courage = Math.min(COURAGE_MAX, e.courage! + COURAGE_DES_ABYSSES)
      if (r.pouvoirs.includes('elan') && r.serie % 3 === 0) {
        r.suivant.cartes += 2
        r.suivant.inspiration += 1
      }
      // Le jeu complet : ce qu'une bonne réponse laisse à la question suivante — et le bouclier que Bastion garde entier.
      const suite = suiteDUneBonneReponse(t.jouees, r.pouvoirs)
      r.suivant.cartes += suite.cartes
      r.suivant.inspiration += suite.inspiration
      r.suivant.charge += suite.charge
      if (parmi(r.pouvoirs, 'bastion')) r.suivant.garde = t.garde
      // La boucle : l'erreur reposée, retrouvée, rend son courage.
      if (r.boucle && r.boucle.position === i) {
        e.courage = Math.min(COURAGE_MAX, e.courage! + r.boucle.perte)
        r.boucle = null
        r.pouvoirs = r.pouvoirs.filter(c => c !== 'boucle')
      }
      r.derniereFrappe = 0
      coup = { juste: true, brises, frappe: 0, absorbee: 0, perdu: 0, mise: gain, ...(plus.ecus > 0 && { ecus: plus.ecus }), ...(plus.courage > 0 && { courage: plus.courage }) }
    } else {
      const f = frappeDUneErreur({
        frappe: frappeDeLaQuestion(r) + frappeEnPlus(t.jouees),
        sauve: tombeDuDoute || parmi(t.jouees, 'sursis') || t.surLaQuestion.includes('mue'),
        double: t.surLaQuestion.includes('tout-ou-rien') || t.jouees.includes('quitte-ou-double'),
        garde: t.garde,
      })
      e.courage! -= f.perdu
      r.perdu += f.perdu
      e.affilee = 0
      // Contre-attaque et Représailles : ce que le bouclier a paré, l'adversaire le perd ; Berserk (v9), ce que l'attaque a pris.
      const contre = riposte(f.absorbee, t.jouees, r.pouvoirs, f.perdu)
      r.sceaux = Math.max(0, r.sceaux - contre)
      // Engrenage (v9) : l'erreur sème le doute — pour la question suivante.
      r.doute += douteDUneErreur(r.pouvoirs)
      // Inarrêtable : sa série ne retombe pas.
      if (!parmi(r.pouvoirs, 'inarretable')) r.serie = 0
      // Bastion : le bouclier reste, moins ce qu'il a paré.
      if (parmi(r.pouvoirs, 'bastion')) r.suivant.garde = Math.max(0, t.garde - f.absorbee)
      // Sous Assurance, le pari perdu est rendu.
      const perdue = Math.min(e.ecus, pariPerdu(t))
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
    e.coup = ronge > 0 ? { ...coup, doute: ronge } : coup
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
  /**
   * Le verdict de la question au centre (v10) : juste, l'adversaire perd ses
   * crans — sa forme, ses cartes, ses pouvoirs (`cransDUneBonneReponse`) — et
   * le pari paie ; faux, il attaque, toujours autant (`attaqueEnQuestion`), et
   * le pari est perdu. La main se garde : une carte y vient après chaque
   * question, s'il y a de la place.
   */
  const jugerEnQuestion = (i: number, juste: boolean) => {
    const r = e.rencontre!
    const t = r.tour
    const q = questions[i] ?? { escale: r.escale, acte: e.acte }
    const mise = enJeu(t)
    let coup: CoupDeRencontre
    if (t.surLaQuestion.includes('passe-muraille')) {
      // Ni trouvée ni ratée : ni attaque, ni cran, et le pari est rendu.
      coup = { juste: false, brises: 0, frappe: 0, absorbee: 0, perdu: 0, mise: 0, traversee: true }
    } else if (juste) {
      const crans = cransDUneBonneReponse({
        question: q,
        tour: t,
        pouvoirs: r.pouvoirs,
        fetiche: depart.fetiche,
        categorie: q.categorie,
        trouvees: r.trouvees,
        serie: r.serie,
        aube: !r.aubeEteinte,
        v: depart.v,
        ratee: !!r.ratee,
      })
      r.sceaux = Math.max(0, r.sceaux - crans)
      r.serie++
      r.trouvees++
      e.justes++
      deSuite()
      const gain = mise > 0 ? gainDuPariEnQuestion(t, r.pouvoirs) : 0
      const plus = siJuste(t.jouees, r.pouvoirs, depart.v)
      e.ecus += gain + plus.ecus
      if (mise >= PARI_DE_L_EXPLOIT) exploit('pari-de-40')
      // Mémoire tire après sa bonne réponse ; L'élan, à chaque série de trois.
      for (const cle of t.jouees) if (baseDe(cle) === 'memoire') r.suivant.cartes += estAmelioree(cle) ? 2 : 1
      if (r.pouvoirs.includes('elan') && r.serie % 3 === 0) r.suivant.cartes += 1
      // Les familles (v14) : Accélération fait tirer.
      r.suivant.cartes += cartesTireesDuTour(t.jouees, true, depart.v)
      // L'Élan (v14) : Foulée, le Rythme, et sous Vent arrière toute carte jouée, reviennent de la défausse dans sa main — s'il y a de
      // la place.
      const revenues: string[] = []
      if (familles) {
        for (const cle of t.jouees) {
          if (!revientSiJuste(cle, r.pouvoirs) || e.cycle!.main.length >= mainMax() || !oter(e.cycle!.defausse, cle)) continue
          e.cycle!.main.push(cle)
          revenues.push(cle)
        }
      }
      delete r.ratee
      // La boucle : l'erreur reposée, retrouvée, ne lui a rien coûté — puis elle rejoint la défausse.
      if (r.boucle && r.boucle.position === i) {
        e.courage = Math.min(COURAGE_MAX, e.courage! + r.boucle.perte)
        r.boucle = null
        if (oter(r.pouvoirs, 'boucle')) e.cycle!.defausse.push('boucle')
      }
      r.derniereFrappe = 0
      coup = { juste: true, brises: crans, frappe: 0, absorbee: 0, perdu: 0, mise: gain, ...(plus.ecus > 0 && { ecus: plus.ecus }), ...(revenues.length > 0 && { revenues }) }
    } else {
      const frappe = attaqueEnQuestion({ frappe: frappeDeLaQuestion(r), tour: t, pouvoirs: r.pouvoirs, v: depart.v })
      // Renaissance : l'erreur qui finirait l'expédition ne coûte rien — une fois par expédition, la carte quitte son paquet.
      const renaissance = frappe > 0 && e.courage! <= frappe && r.pouvoirs.includes('renaissance')
      if (renaissance) {
        oter(r.pouvoirs, 'renaissance')
        oter(e.paquet, 'renaissance')
      }
      const perdu = renaissance ? 0 : frappe
      e.courage! -= perdu
      r.perdu += perdu
      e.affilee = 0
      // Inarrêtable : sa série ne retombe pas. L'aube s'éteint à la première erreur.
      if (!parmi(r.pouvoirs, 'inarretable')) r.serie = 0
      if (r.pouvoirs.includes('aube')) r.aubeEteinte = true
      // Sous Assurance, le pari perdu est rendu.
      const perdue = Math.min(e.ecus, pariPerdu(t))
      e.ecus -= perdue
      // Les familles (v14) : la mise de Fortune est perdue ; Pansement et Muraille font tirer ; Contre-attaque et Représailles attendent ;
      // Troisième œil retombe dans la défausse.
      const misee = Math.min(e.ecus, ecusPerdusDesCartes(t.jouees, depart.v))
      e.ecus -= misee
      r.suivant.cartes += cartesTireesDuTour(t.jouees, false, depart.v)
      const retombe = familles ? r.pouvoirs.filter(cle => retombentALErreur(depart.v).has(baseDe(cle))) : []
      for (const cle of retombe) if (oter(r.pouvoirs, cle)) e.cycle!.defausse.push(cle)
      if (familles) r.ratee = true
      if (r.boucle && r.boucle.position === i) {
        // Ratée encore : la boucle a servi.
        r.boucle = null
        if (oter(r.pouvoirs, 'boucle')) e.cycle!.defausse.push('boucle')
      } else if (r.pouvoirs.includes('boucle') && !r.boucle && perdu > 0) r.boucle = { reprise: i, perte: perdu, position: null }
      r.derniereFrappe = perdu
      coup = {
        juste: false,
        brises: 0,
        frappe,
        absorbee: 0,
        perdu,
        mise: perdue > 0 ? -perdue : 0,
        ...(misee > 0 && { ecus: -misee }),
        ...(renaissance && { renaissance: true as const }),
        ...(retombe.length > 0 && { retombees: retombe }),
      }
    }
    r.questions++
    e.coup = coup
    // Une carte vient après chaque question — deux sous Trois têtes —, et ce que Mémoire et L'élan y ajoutent.
    piocherEnQuestion(1 + (r.pouvoirs.includes('trois-tetes') ? 1 : 0) + r.suivant.cartes)
    r.suivant.cartes = 0
    if (e.courage! <= 0) {
      e.courage = 0
      e.rencontre = null
      e.issue = 'perdue'
      return
    }
    if (r.sceaux <= 0) gagnerLaRencontre()
    else ouvrir()
  }
  /**
   * Une carte jouée dans la question au centre (v10) : elle quitte la main pour
   * la défausse de l'acte — ou les pouvoirs, le temps de la rencontre —, ses
   * crans vont à la bonne réponse (`chiffresApresLaCarte`), et elle fait ce
   * qu'elle dit. Augure garde son effacement pour la question suivante.
   */
  const jouerEnQuestion = (g: Extract<GesteDExpedition, { quoi: 'jouer' }>) => {
    const r = e.rencontre!
    const c = e.cycle!
    const carte = carteALaVersion(g.joker, depart.v)!
    const t = r.tour
    const q = e.enAttente === null ? undefined : questions[e.enAttente]
    // L'essai raté (v14) compte parmi les réponses effacées : Lucidité le voit, comme la page.
    const effacees = q ? effaceesAvecLEssai(t, r.pouvoirs, { reponses: q.reponses ?? 4, datee: q.datee, nombre: q.nombre, forme: q.forme }, depart.v) : 0
    const niveau = q?.niveau ?? marcheDeLaRencontre(r)
    const base = baseDe(g.joker)
    const plus = !!carte.amelioree
    oter(c.main, g.joker)
    t.jouees.push(g.joker)
    if (base === 'augure') e.dAvance.push(g.joker)
    else if (viseLaQuestion(carte)) t.surLaQuestion.push(g.joker)
    const x = chiffresApresLaCarte(g.joker, { inspiration: t.inspiration, charge: t.charge, garde: t.garde, serie: r.serie }, r.pouvoirs, {
      v: depart.v,
      fetiche: !!depart.fetiche && q?.categorie === depart.fetiche,
      effacees,
      niveau,
      savoir: SAVOIR_DES_MARCHES[niveau],
      ecus: e.ecus,
      courage: e.courage ?? COURAGE_MAX,
      // Contre-attaque (v14) : juste après une erreur — ce que la carte levée lisait de la vue.
      ratee: !!r.ratee,
    })
    t.charge = x.charge
    r.serie = x.serie
    // Où elle va : les pouvoirs le temps de la rencontre, la défausse sinon — Le feu d'artifice y va après ce qu'il rend.
    let versLaDefausse = carte.moment !== 'pouvoir'
    switch (base) {
      case 'presage':
        piocherEnQuestion(plus ? 2 : 1)
        break
      // Aux familles (v14), Assurance ne tire plus : elle pare l'attaque (`attaqueEnQuestion`) — améliorée, elle tire une carte.
      case 'assurance':
        if (!familles) piocherEnQuestion(plus ? 2 : 1)
        break
      case 'pourboire':
        piocherEnQuestion(1)
        break
      case 'reveil': {
        // La dernière carte de sa défausse revient — pas lui, qu'on vient de jouer.
        const revient = c.defausse.pop()
        if (revient !== undefined) c.main.push(revient)
        break
      }
      case 'feu-d-artifice':
        c.pioche.push(...c.defausse.splice(0))
        c.pioche.sort()
        c.defausse.push(g.joker)
        versLaDefausse = false
        piocherEnQuestion(mainMax())
        break
      case 'horizon':
        // L'erreur d'avant est effacée : elle ne lui a rien coûté — et la prochaine récompense est vide.
        e.courage = Math.min(COURAGE_MAX, e.courage! + r.derniereFrappe)
        r.derniereFrappe = 0
        e.recompenseVide = true
        break
      case 'deux-visages':
        e.autre = e.enAttente! + 1
        break
      case 'prediction':
        t.montre = g.montre
        break
    }
    // Échange, Volte-face, La mue — et Leçon depuis les familles (v14) : une autre question, de la même escale ; celle-ci ne se pose
    // plus, ce qui la visait ne vise pas l'autre, et son second essai ne passe pas à l'autre.
    if (changeDeQuestion(g.joker, depart.v)) {
      const i = e.enAttente!
      e.passees = i + 1
      e.enAttente = i + 1
      e.autre = null
      t.surLaQuestion = base === 'mue' ? ['mue'] : []
      delete t.essai
      // Leçon (v14) : l'autre se tire dans sa catégorie fétiche (`aTirer`).
      if (base === 'lecon' && depart.fetiche) t.categorie = depart.fetiche
      if (r.boucle?.position === i) {
        r.boucle = null
        if (oter(r.pouvoirs, 'boucle')) c.defausse.push('boucle')
      }
    }
    // Améliorée, elle tire une carte de plus (« Et tu tires une carte »).
    piocherEnQuestion(tireEnPlusEnQuestion(g.joker, depart.v))
    if (carte.moment === 'pouvoir') r.pouvoirs.push(g.joker)
    else if (versLaDefausse) c.defausse.push(g.joker)
  }
  /** Une carte jouée en rencontre (v5) : elle quitte la main — pour la défausse, les épuisées, ou les pouvoirs — et fait ce qu'elle dit. */
  const jouerEnRencontre = (g: Extract<GesteDExpedition, { quoi: 'jouer' }>) => {
    if (enQuestion) {
      jouerEnQuestion(g)
      return
    }
    const r = e.rencontre!
    const carte = carteALaVersion(g.joker, depart.v)!
    const t = r.tour
    // Ce que ses chiffres lisent de la question, avant qu'elle ne parte de la main : sa catégorie, ce qui y est déjà effacé.
    const q = e.enAttente === null ? undefined : questions[e.enAttente]
    const effacees = q ? effaceesDuTour(t.surLaQuestion, r.pouvoirs, { reponses: q.reponses ?? 4, datee: q.datee, nombre: q.nombre, forme: q.forme }, depart.v) : 0
    // Sa marche, ce qu'elle vaut (le jeu complet : Savoir-faire, Exposé) — ce que l'annonce dit à la page.
    const niveau = q?.niveau ?? marcheDeLaRencontre(r)
    oter(r.main, g.joker)
    t.jouees.push(g.joker)
    if (viseLaQuestion(carte)) t.surLaQuestion.push(g.joker)
    if (carte.moment === 'pouvoir') r.pouvoirs.push(g.joker)
    else if (carte.epuisement) r.epuisees.push(g.joker)
    else r.defausse.push(g.joker)
    // Ses chiffres — l'inspiration qu'elle coûte, la Charge, la Garde, la série, le doute — : la règle que la page relit, carte levée.
    const x = chiffresApresLaCarte(g.joker, { inspiration: t.inspiration, charge: t.charge, garde: t.garde, serie: r.serie, doute: r.doute }, r.pouvoirs, {
      v: depart.v,
      fetiche: !!depart.fetiche && q?.categorie === depart.fetiche,
      effacees,
      niveau,
      savoir: SAVOIR_DES_MARCHES[niveau],
      ecus: e.ecus,
      courage: e.courage ?? COURAGE_MAX,
    })
    t.inspiration = x.inspiration
    t.charge = x.charge
    t.garde = x.garde
    r.serie = x.serie
    r.doute = x.doute ?? r.doute
    // Le courage qu'elle coûte (v9) : Fougue, Coup de sang — le refus a dit qu'il en reste assez.
    e.courage! -= courageDeLaCarte(g.joker)
    // Ce qui ne se chiffre pas, de sa carte — et de son exemplaire amélioré : une carte de plus, plus de courage.
    const plus = !!carte.amelioree
    switch (baseDe(g.joker)) {
      case 'pioche':
      case 'sprint':
        piocher(plus ? 3 : 2)
        break
      // Celles qui tirent une carte à leur place : jouées, elles ne coûtent pas une carte de la main.
      case 'meditation':
      case 'assurance':
        piocher(plus ? 2 : 1)
        break
      case 'presage':
      case 'surmenage':
      case 'pourboire':
      case 'coup-de-sang':
        piocher(1)
        break
      // Doubler la mise améliorée en tire une aussi.
      case 'doubler-la-mise':
        if (plus) piocher(1)
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
      case 'panacee':
        // Une fois par expédition : jouée, elle quitte son paquet — cet exemplaire-là — et ne reviendra pas à la rencontre suivante.
        e.courage = Math.min(COURAGE_MAX, e.courage! + (plus ? COURAGE_DE_LA_PANACEE_PLUS : COURAGE_DE_LA_PANACEE))
        oter(e.paquet, g.joker)
        break
      case 'second-souffle':
        e.courage = Math.min(COURAGE_MAX, e.courage! + (plus ? COURAGE_DU_SECOND_SOUFFLE_PLUS : COURAGE_DU_SECOND_SOUFFLE))
        break
      case 'echange':
      case 'volte-face':
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
  /**
   * Les familles (v14) : sa première réponse, fausse, s'efface — la question
   * ne se juge pas, et il répond encore. La carte qui le donne est celle du
   * tour (`secondEssaiDuTour`, la règle même que le serveur a lue pour écrire
   * l'essai) ; Cuirasse compte les siens. Un essai que la règle ne donne pas
   * ne change rien : la question attend toujours sa réponse.
   */
  const essayer = (g: Extract<GesteDExpedition, { quoi: 'essai' }>) => {
    const r = e.rencontre
    const carte = r && g.position === e.enAttente ? secondEssaiEnAttente(depart, e, questions) : null
    if (!r || !carte) return
    r.tour.essai = carte
    if (baseDe(carte) === 'cuirasse') r.essais = (r.essais ?? 0) + 1
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
  /** Une échoppe — ou le marchand de l'inconnu — : trois jokers, un talisman s'il en reste, une fiole au codex, du hasard de son rang d'offre. */
  const ouvrirLEchoppe = () => {
    const rang = e.offres++
    const poids = raretesDeLOffre(depart.v, e.acte, 'elite')
    const jokers = avecLeCodex
      ? offreDuCodex(depart.graine, rang, depart.codex!.cartes, e.paquet, poids, false, style)
      : avecRencontres
        ? offreDeCartes(depart.graine, rang, famillesDeLEquipee(depart.equipee ?? []), poids, depart.v >= 6)
        : offreDeJokers(depart.graine, rang, depart.v)
    e.echoppe = {
      jokers,
      talisman: talismans ? talismanDeLOffre(depart.graine, rang, e.talismans, true) : null,
      ...(fioles && { fiole: fioleDeLOffre(depart.graine, rang, depart.v) }),
      ...(ameliorations && { ameliorer: true as const }),
      achats: [],
    }
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
          ajouterALActe(j.cle)
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
    // La question au centre : l'acte suivant rend toutes ses cartes — le gardien y a glissé la sienne, ceux de passage sont partis.
    else if (enQuestion) ouvrirLeCycle()
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
        e.coup = null
        const ici = e.ici ? escaleEnJeu(depart, e, e.ici) : undefined
        if (ici?.sorte === 'curiosite') {
          // Une curiosité (v12) : trouvée, sa récompense ; ratée, rien — pas même la série d'affilée de l'exploit, qu'elle ne fait
          // ni ne coupe : « ratée, elle ne coûte rien ».
          if (juste) {
            e.justes++
            offrirUneCuriosite()
          }
        } else if (juste) {
          // Une source (v5) : sans cartes ; retrouvée, elle rend du courage — ratée, elle ne coûte rien, le carnet la garde.
          e.justes++
          deSuite()
          if (ici?.sorte === 'source') e.courage = Math.min(COURAGE_MAX, e.courage! + soinALAscension(COURAGE_D_UNE_SOURCE, depart.v, ascension))
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
    // Le talisman prend la place d'un joker ; la fiole aussi, s'il lui reste une place pour elle.
    let places = offre.aPrendre
    const talisman = offre.talisman !== undefined && g.talisman === offre.talisman && places > 0 ? offre.talisman : null
    if (talisman) places--
    const fiole = offre.fiole !== undefined && g.fiole === offre.fiole && places > 0 && e.fioles.length < FIOLES_MAX ? offre.fiole : null
    if (fiole) places--
    const pris = [...new Set(g.jokers)].filter(j => offre.jokers.includes(j)).slice(0, places)
    e.paquet.push(...pris)
    e.paquet.sort()
    for (const p of pris) ajouterALActe(p)
    if (talisman && !e.talismans.includes(talisman)) e.talismans.push(talisman)
    if (fiole) e.fioles.push(fiole)
    // Un coffre qu'on passe sans rien prendre rapporte ses écus ; vide, il n'avait rien à laisser.
    if (offre.coffre && pris.length === 0 && !talisman && !fiole && offre.jokers.length > 0) e.ecus += ECUS_D_UN_COFFRE_LAISSE
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
      if (e.courage !== null) e.courage = Math.min(COURAGE_MAX, e.courage + soinALaVersion(COURAGE_A_L_ECHOPPE, depart.v))
      else e.vies = Math.min(VIES, e.vies + 1)
      echoppe.achats.push('vie')
    } else if (g.article === 'joker') {
      e.paquet.push(g.joker!)
      e.paquet.sort()
      ajouterALActe(g.joker!)
      echoppe.achats.push(g.joker!)
    } else if (g.article === 'talisman') {
      e.talismans.push(echoppe.talisman!)
      echoppe.achats.push('talisman')
    } else if (g.article === 'fiole') {
      e.fioles.push(echoppe.fiole!)
      echoppe.achats.push('fiole')
    } else if (g.article === 'ameliorer') {
      ameliorerLaCarte(g.joker!)
      echoppe.achats.push('ameliorer')
    } else {
      retirer(g.joker!)
      echoppe.achats.push('retirer')
    }
  }

  /**
   * Une fiole bue (le codex) : elle quitte son sac et fait ce qu'elle dit —
   * du courage, de l'énergie pour la question en cours, une mauvaise réponse
   * effacée de celle qu'il a sous les yeux.
   */
  const boire = (g: Extract<GesteDExpedition, { quoi: 'boire' }>) => {
    if (refusDeLaFiole(e, g.fiole, questions, depart.v) !== null) return
    oter(e.fioles, g.fiole)
    if (g.fiole === 'courage') e.courage = Math.min(COURAGE_MAX, e.courage! + soinALaVersion(COURAGE_D_UNE_FIOLE, depart.v))
    else if (g.fiole === 'energie') e.rencontre!.tour.inspiration += ENERGIE_D_UNE_FIOLE
    else e.rencontre!.tour.surLaQuestion.push(CLAIRVOYANCE_SUR_LA_QUESTION)
  }

  /** Un joker retiré — au campement, à l'échoppe —, d'où qu'il soit ; faux s'il n'est nulle part. */
  const retirer = (cle: string): boolean => {
    if (!(oter(e.paquet, cle) || oter(e.defausse, cle) || oter(e.main, cle))) return false
    // Celui de passage d'abord : il partait avec l'acte, et l'acte, sinon, prenait le même qu'un gardien a glissé.
    oter(e.passages, cle)
    // La question au centre : il quitte aussi l'acte — celui qui dort dans la pioche d'abord, sa main reste la sienne.
    if (e.cycle) void (oter(e.cycle.pioche, cle) || oter(e.cycle.defausse, cle) || oter(e.cycle.main, cle))
    return true
  }

  /** Un exemplaire de son paquet amélioré (le jeu complet) : il y prend sa clé « + » ; faux s'il ne s'améliore pas (`refusDeLAmelioration`). */
  const ameliorerLaCarte = (cle: string): boolean => {
    if (!ameliorations || refusDeLAmelioration(e.paquet, cle) !== null) return false
    e.paquet[e.paquet.indexOf(cle)] = ameliorer(cle)
    e.paquet.sort()
    // La question au centre : l'acte le voit aussi — celui de sa main d'abord, qu'il le voie changer.
    const tas = e.cycle && [e.cycle.main, e.cycle.pioche, e.cycle.defausse].find(t => t.includes(cle))
    if (tas) {
      tas[tas.indexOf(cle)] = ameliorer(cle)
      if (tas !== e.cycle!.main) tas.sort()
    }
    return true
  }

  /** Au campement : le repos, une carte retirée, ou — depuis le jeu complet — une carte améliorée ; un choix qui ne se fait pas n'est pas un choix. */
  const camper = (g: Extract<GesteDExpedition, { quoi: 'camper' }>) => {
    if (!e.campement) return
    if (g.ameliorer !== undefined) {
      if (g.retirer !== undefined || !ameliorerLaCarte(g.ameliorer)) return
    } else if (g.retirer === undefined) {
      if (e.courage !== null) e.courage = Math.min(COURAGE_MAX, e.courage + soinALAscension(COURAGE_D_UN_CAMPEMENT, depart.v, ascension))
      else e.vies = Math.min(VIES, e.vies + 1)
    } else if (!retirer(g.retirer)) return
    e.campement = false
  }

  /**
   * Un joker — une carte, un « voir » en rencontre, une fiole bue, un essai
   * raté (v14) — qui vise la question qui attend : il se joue avant qu'elle
   * soit jugée.
   */
  const vise = (g: GesteDExpedition) =>
    (g.quoi === 'jouer' || g.quoi === 'voir' || g.quoi === 'boire' || g.quoi === 'essai') && g.position !== undefined && (g.position === e.enAttente || g.position === e.autre)
  /**
   * Juge ce qui a sa réponse — jusqu'à la question que vise le geste `g` : la
   * suivante s'ouvre, et le joker joué sur elle se joue avant qu'elle soit
   * jugée. Jugées d'un coup, les questions du gardien passaient toutes avant
   * le joker de la deuxième, qui revenait dans la main au repli.
   */
  const jugerTout = (g?: GesteDExpedition) => {
    while (!fini() && !(g && vise(g)) && juger());
  }
  // La question au centre : la main du premier acte se tire au départ — il la voit sur le plan avant sa première rencontre.
  if (enQuestion) ouvrirLeCycle()
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
    else if (g.quoi === 'camper') camper(g)
    else if (g.quoi === 'acheter') {
      if (avecEcus) acheter(g)
    } else if (g.quoi === 'voir') {
      if (avecRencontres) voir(g)
    } else if (g.quoi === 'boire') {
      if (fioles) boire(g)
    } else if (g.quoi === 'essai') {
      essayer(g)
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
      // Les familles (v14) : l'autre question de Leçon, puis toutes celles d'une rencontre sous la Bibliothèque — celle qu'elle
      // remplace comprise —, se tirent dans sa catégorie fétiche.
      const fetiche = familles && r && depart.fetiche && (r.tour.categorie !== undefined || parmi(r.pouvoirs, 'bibliotheque')) ? depart.fetiche : null
      const categorie = fetiche ?? (r ? r.categorie : e.categorie)
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
  if (avecRencontres) e.vies = viesDuCourage(e.courage!)
  return e
}

/** Les vies qu'une expédition en rencontres dit à la campagne (v5) : le reflet de son courage. */
export const viesDuCourage = (courage: number) => (courage <= 0 ? 0 : Math.min(VIES, Math.ceil((courage * VIES) / COURAGE_MAX)))

/** La réponse effacée par l'essai raté d'une question (v14), lue du journal des gestes ; undefined : pas d'essai, ou sans choix. */
export function choixDeLEssai(gestes: readonly GesteDExpedition[], position: number): number | undefined {
  for (let k = gestes.length - 1; k >= 0; k--) {
    const g = gestes[k]
    if (g.quoi === 'essai' && g.position === position) return g.choix
  }
  return undefined
}

/**
 * La carte qui donnerait un second essai à la question qui attend, si sa
 * réponse était fausse (les familles, v14) — null : l'erreur se jugerait. La
 * règle que le pli applique à l'essai et que le serveur lit pour l'écrire à la
 * place de la réponse (`repondreEnExpedition`) : la question vue, ses cartes
 * et ses pouvoirs, ce qui y est déjà effacé (`secondEssaiDuTour`).
 */
export function secondEssaiEnAttente(depart: Pick<DepartDExpedition, 'v'>, e: Pick<EtatDeLExpedition, 'rencontre' | 'enAttente'>, questions: readonly QuestionPosee[]): string | null {
  const r = e.rencontre
  if (depart.v < VERSION_DES_FAMILLES || !r || r.tour.phase !== 'question' || e.enAttente === null) return null
  const q = questions[e.enAttente]
  if (!q) return null
  const reponses = q.reponses ?? 4
  return secondEssaiDuTour({
    v: depart.v,
    tour: r.tour,
    pouvoirs: r.pouvoirs,
    essais: r.essais,
    question: { reponses, forme: q.forme },
    effacees: effaceesDuTour(r.tour.surLaQuestion, r.pouvoirs, { reponses, datee: q.datee, nombre: q.nombre, forme: q.forme }, depart.v),
  })
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
export function refusDeLaMise(e: { ecus: number; pari?: boolean; rencontre: { tour: Pick<TourDeRencontre, 'jouees'> } | null }, mise: number): string | null {
  if (!MISES.includes(mise)) return `Parie ${MISES.join(', ').replace(/, (\d+)$/, ' ou $1')} écus`
  if (e.pari === false && mise > 0) return `Le pari s’ouvre au niveau ${niveauDeLaRegle('pari')} d’explorateur`
  const total = mise * (e.rencontre && parmi(e.rencontre.tour.jouees, 'doubler-la-mise') ? 2 : 1)
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
    ...(q.compose && { compose: true }),
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
    doute: r.doute,
    pari: e.pari,
    // Les familles (v14) : la mise de Fortune.
    ecus: e.ecus,
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
  // Une curiosité (v12) se répond sans cartes, comme une source : elles attendent les adversaires.
  if (!c && e.enAttente !== null && e.ici !== null && escaleEnJeu(depart, e, e.ici)?.sorte === 'curiosite') return 'Une curiosité se répond sans cartes : garde-les pour les adversaires'
  if (!c) return depart.v >= VERSION_DE_LA_QUESTION_AU_CENTRE ? 'Elle se joue en rencontre, la question sous les yeux' : 'Elle se joue en rencontre'
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
  const ctx = contexteDeLaCarte(depart, e, questions)
  const marche: Niveau = r.sorte === 'gardien' ? marchesDe(depart.v)[Math.min(e.acte, ACTES - 1)].gardien : escale ? marcheDe(e.acte, escale, depart.v) : 'facile'
  let annonce: AnnonceDuTour | undefined
  if (q && qt) {
    // Sa chance : celle que la carte annonçait de l'escale — du gardien —, ramenée à la forme où elle se pose à présent.
    const dite = r.sorte === 'gardien' ? depart.cartes[e.acte]?.chanceDuGardien : escale ? chanceAnnoncee(depart, e.acte, escale, r.categorie) : undefined
    const chance = dite === undefined ? undefined : arrondiDeChance(chanceALaForme(dite, r.sorte === 'gardien' ? 'quatre' : (escale?.forme ?? 'quatre'), qt.forme))
    annonce = annonceSousLesPouvoirs(
      {
        categorie: q.categorie ?? null,
        niveau: q.niveau ?? marche,
        forme: qt.forme,
        reponses: qt.reponses,
        ...(q.mots !== undefined && { mots: q.mots }),
        ...(q.reponseEn && { reponseEn: q.reponseEn }),
        ...(chance !== undefined && { chance }),
        savoir: SAVOIR_DES_MARCHES[q.niveau ?? marche],
      },
      r.pouvoirs,
    )
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
    trouvees: r.trouvees,
    ecus: e.ecus,
    courage: e.courage ?? 0,
    ...(r.doute > 0 && { doute: r.doute }),
    phase: r.tour.phase,
    ...(e.enAttente !== null && { position: e.enAttente }),
    inspiration: r.tour.inspiration,
    charge: r.tour.charge,
    garde: r.tour.garde,
    mise: r.tour.mise,
    jouees: r.tour.jouees,
    surLaQuestion: r.tour.surLaQuestion,
    pouvoirs: r.pouvoirs,
    main: r.main,
    pioche: r.pioche.length,
    defausse: r.defausse,
    epuisees: r.epuisees,
    refus: Object.fromEntries([...new Set(r.main)].map(cle => [cle, ctx ? refusDeLaCarte(ctx, cle) : null])),
    ...(r.tour.phase === 'preparation' && { mises: Object.fromEntries(MISES.map(m => [m, refusDeLaMise(e, m)])) }),
    // Le pari pas encore ouvert (v7) : la page ne le propose pas.
    ...(!e.pari && { pari: false as const }),
    ...(r.tour.phase === 'question' && qt && { effacees: effaceesAvecLEssai(r.tour, r.pouvoirs, qt, depart.v) }),
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
          trouvees: r.trouvees,
          serie: r.serie,
          doute: r.doute,
          aube: !r.aubeEteinte,
          ratee: !!r.ratee,
          ...(r.essais !== undefined && { essais: r.essais }),
          effacees: effaceesDuTour(r.tour.surLaQuestion, r.pouvoirs, qt, depart.v),
        }),
      }),
    ...(qt && { questionDuTour: qt }),
    derniereFrappe: r.derniereFrappe,
    // La question au centre (v10) : ses crans, et ce que tient la main de l'acte.
    ...(r.enCrans && { crans: true as const, mainMax: mainMaxEnQuestion(r.pouvoirs.includes('trois-tetes'), e.ascension) }),
    ...(r.aubeEteinte && { aubeEteinte: true as const }),
    // Les familles (v14) : le second essai de cette question, ceux de Cuirasse, et l'erreur d'avant.
    ...(r.tour.essai !== undefined && { essai: r.tour.essai }),
    ...(r.essais !== undefined && { essais: r.essais }),
    ...(r.ratee && { ratee: true as const }),
  }
}

/**
 * Celles qui attendent le serveur, même en préparation : ce qu'elles font
 * passe par ce que la vue ne dit pas — tirer des cartes, dont l'ordre est le
 * hasard du serveur ; une autre question ou une autre forme, qu'il repose ;
 * le courage rendu, l'écran qui le dit. Une carte de plus dans le `switch` de
 * `jouerEnRencontre` s'y ajoute : `expedition-sur-place.test.ts` joue chaque
 * carte sur place et au pli, et la refuse si les deux vues diffèrent.
 */
export const ATTENDENT_LE_SERVEUR: ReadonlySet<string> = new Set([
  'pioche',
  'sprint',
  'meditation',
  'assurance',
  'presage',
  'surmenage',
  'pourboire',
  'coup-de-sang',
  'doubler-la-mise',
  'feu-d-artifice',
  'abysses',
  'horizon',
  'panacee',
  'second-souffle',
  'echange',
  'volte-face',
  'mue',
  'deux-visages',
  'prediction',
])

/**
 * Cette carte peut-elle se jouer sur place, en préparation ? Ni de route, ni
 * de pendant la question, ni de celles qui attendent le serveur — une seule
 * règle : la page la lit avant de jouer sans lui, le serveur avant de rejouer
 * le lot qu'elle lui envoie.
 */
export function seJoueSurPlace(cle: string, v: number): boolean {
  // La question au centre (v10) : plus de préparation à jouer d'avance — chaque carte part au serveur, une par question.
  if (v >= VERSION_DE_LA_QUESTION_AU_CENTRE) return false
  const carte = carteALaVersion(cle, v)
  return !!carte && carte.moment !== 'route' && carte.moment !== 'reflexe' && !ATTENDENT_LE_SERVEUR.has(baseDe(cle)) && !formeDeLaCarte(cle)
}

/** L'annonce d'une question sous ses pouvoirs : L'écholocation posée, elle ne dit plus sa chance — à la vue du serveur comme à la carte jouée sur place. */
function annonceSousLesPouvoirs(annonce: AnnonceDuTour, pouvoirs: readonly string[]): AnnonceDuTour {
  if (!pouvoirs.includes('echolocation') || annonce.chance === undefined) return annonce
  const { chance: _chance, ...sans } = annonce
  return sans
}

/**
 * Une carte jouée dans la page, sans attendre le serveur (la phase
 * d'optimisation de l'Expédition, le 19 octobre 2026) : en préparation, une
 * carte jouée coûtait un aller-retour — quatre ou cinq par question, chacun
 * l'attente du réseau du téléphone, puis d'une écriture de Turso. Celles dont
 * tout l'effet se lit de la vue se jouent ici, par les règles mêmes du pli —
 * ce qu'elle quitte, ses chiffres (`chiffresApresLaCarte`), son courage
 * (`courageDeLaCarte`), les refus de la main (`refusDeLaCarte`) et des
 * mises (`refusDeLaMise`), l'annonce (`annonceSousLesPouvoirs`), l'aperçu
 * (`apercuDuTour`) —, et partent avec le geste qui suit, d'un seul
 * aller-retour (`GesteAvecSesCartes`). Null : elle attend le serveur
 * (`seJoueSurPlace`), ou ne se joue pas ici — la question vue, ou refusée.
 */
export function jouerSurPlace(r: VueDeLaRencontre, cle: string, fetiche?: string): VueDeLaRencontre | null {
  const qt = r.questionDuTour
  if (r.phase !== 'preparation' || !r.annonce || !qt || !r.main.includes(cle) || r.refus[cle] !== null || !seJoueSurPlace(cle, r.v)) return null
  const carte = carteALaVersion(cle, r.v)!
  // Dans l'ordre du pli : ce qu'elle lit d'effacé avant de viser la question, puis elle quitte la main, puis ses chiffres — un pouvoir
  // posé d'abord, qu'il se lise lui-même (Hantise).
  const effacees = effaceesDuTour(r.surLaQuestion, r.pouvoirs, { reponses: qt.reponses, datee: qt.datee, nombre: qt.nombre, forme: qt.forme }, r.v)
  const main = [...r.main]
  main.splice(main.indexOf(cle), 1)
  const jouees = [...r.jouees, cle]
  const surLaQuestion = viseLaQuestion(carte) ? [...r.surLaQuestion, cle] : r.surLaQuestion
  const pouvoirs = carte.moment === 'pouvoir' ? [...r.pouvoirs, cle] : r.pouvoirs
  const epuisees = carte.moment !== 'pouvoir' && carte.epuisement ? [...r.epuisees, cle] : r.epuisees
  const defausse = carte.moment !== 'pouvoir' && !carte.epuisement ? [...r.defausse, cle] : r.defausse
  const niveau = r.annonce.niveau
  const x = chiffresApresLaCarte(cle, { inspiration: r.inspiration, charge: r.charge, garde: r.garde, serie: r.serie, doute: r.doute ?? 0 }, pouvoirs, {
    v: r.v,
    fetiche: !!fetiche && r.annonce.categorie === fetiche,
    effacees,
    niveau,
    savoir: SAVOIR_DES_MARCHES[niveau],
    ecus: r.ecus,
    courage: r.courage,
  })
  const courage = r.courage - courageDeLaCarte(cle)
  const doute = x.doute ?? r.doute ?? 0
  const tour = { phase: 'preparation' as const, inspiration: x.inspiration, charge: x.charge, garde: x.garde, mise: r.mise, jouees, surLaQuestion }
  const ctx: ContexteDUneCarte = {
    v: r.v,
    tour,
    main,
    pouvoirs,
    question: qt,
    ...(fetiche && { fetiche }),
    courage,
    derniereFrappe: r.derniereFrappe,
    defausse: defausse.length,
    doute,
  }
  const { doute: _avant, ...sansDoute } = r
  return {
    ...sansDoute,
    courage,
    ...(doute > 0 && { doute }),
    annonce: annonceSousLesPouvoirs(r.annonce, pouvoirs),
    inspiration: x.inspiration,
    charge: x.charge,
    garde: x.garde,
    serie: x.serie,
    jouees,
    surLaQuestion,
    pouvoirs,
    main,
    defausse,
    epuisees,
    refus: Object.fromEntries([...new Set(main)].map(c => [c, refusDeLaCarte(ctx, c)])),
    mises: Object.fromEntries(MISES.map(m => [m, refusDeLaMise({ ecus: r.ecus, pari: r.pari !== false, rencontre: { tour } }, m)])),
    apercu: apercuDuTour({
      v: r.v,
      tour,
      pouvoirs,
      sceaux: r.sceaux,
      frappe: r.frappe,
      savoir: r.annonce.savoir,
      question: { reponses: qt.reponses, forme: qt.forme, categorie: qt.categorie },
      ...(fetiche && { fetiche }),
      ...(r.annonce.mots !== undefined && { mots: r.annonce.mots }),
      trouvees: r.trouvees,
      serie: x.serie,
      doute,
    }),
  }
}

/**
 * La vue de l'expédition, une carte jouée sur place (`jouerSurPlace`) : le
 * rang du geste suivant, la rencontre, le courage qu'elle coûte — les vies
 * qui en sont le reflet (`viesDuCourage`), la fiole qu'il rend buvable
 * (`refusDeLaFiole`). Null : elle attend le serveur.
 */
export function vueApresLaCarte(vue: VueDeLExpedition, cle: string): VueDeLExpedition | null {
  const r = vue.rencontre && jouerSurPlace(vue.rencontre, cle, vue.fetiche)
  if (!r) return null
  // En préparation, aucune fiole ne lit la question qui attend : la clairvoyance se refuse avant.
  const e = { issue: vue.issue, fioles: vue.fioles?.tenues ?? [], courage: r.courage, rencontre: { tour: r, pouvoirs: r.pouvoirs }, enAttente: r.position ?? null }
  return {
    ...vue,
    rang: vue.rang + 1,
    vies: viesDuCourage(r.courage),
    courage: r.courage,
    rencontre: r,
    ...(vue.fioles && { fioles: { tenues: vue.fioles.tenues, refus: Object.fromEntries([...new Set(vue.fioles.tenues)].map(f => [f, refusDeLaFiole(e, f, [], r.v)])) } }),
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
export function chanceAnnoncee(depart: Pick<DepartDExpedition, 'chances' | 'v'>, acte: number, x: EscaleDeLaCarte, commandement: string | null): number | undefined {
  if (commandement && (x.sorte === 'question' || x.sorte === 'elite')) {
    const p = depart.chances?.[commandement]?.[marcheDe(acte, x, depart.v)]
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
 * retiré, de son paquet, de sa défausse ou de sa main ; une carte améliorée,
 * de son paquet (`refusDeLAmelioration`) ; et de quoi payer.
 */
export function refusDeLAchat(
  e: Pick<EtatDeLExpedition, 'issue' | 'echoppe' | 'ecus' | 'vies' | 'paquet' | 'defausse' | 'main' | 'talismans'> & { courage?: number | null; fioles?: readonly string[] },
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
  } else if (g.article === 'fiole') {
    if (!echoppe.fiole) return 'Pas de fiole à vendre ici'
    if (echoppe.achats.includes('fiole')) return 'Déjà achetée'
    if ((e.fioles?.length ?? 0) >= FIOLES_MAX) return `Tes ${FIOLES_MAX} places de fiole sont prises : bois-en une d’abord`
  } else if (g.article === 'ameliorer') {
    // Le jeu complet : une carte de son paquet améliorée, une fois par échoppe — la règle même du campement.
    if (!echoppe.ameliorer) return 'On n’améliore pas de carte ici'
    if (echoppe.achats.includes('ameliorer')) return 'Une carte améliorée par échoppe'
    const refus = refusDeLAmelioration(e.paquet, g.joker ?? '')
    if (refus) return refus
  } else {
    if (echoppe.achats.includes('retirer')) return v5 ? 'Une carte retirée par échoppe' : 'Un joker retiré par échoppe'
    if (!g.joker || ![...e.paquet, ...e.defausse, ...e.main].includes(g.joker)) return v5 ? 'Cette carte n’est pas dans ton paquet' : 'Ce joker n’est pas dans ton paquet'
  }
  if (e.ecus < prix) return `Il te manque ${prix - e.ecus} écu${prix - e.ecus > 1 ? 's' : ''}`
  return null
}

/**
 * Pourquoi cette fiole ne se boit pas maintenant (le codex) — null : elle se
 * boit. Le courage, partout tant qu'il en manque ; l'énergie, en rencontre ;
 * la clairvoyance, la question sous les yeux, s'il reste à effacer — comme un
 * Coup d'œil : jamais sur un vrai ou faux, elle répondrait à sa place. Le pli
 * l'ignore, le serveur la refuse, la page le dit.
 */
export function refusDeLaFiole(
  e: Pick<EtatDeLExpedition, 'issue' | 'fioles' | 'courage' | 'enAttente'> & { rencontre: { tour: Pick<TourDeRencontre, 'phase' | 'surLaQuestion'>; pouvoirs: readonly string[] } | null },
  cle: string,
  questions: readonly QuestionPosee[],
  /** La version du départ : ce que l'Élan du détail (v15) efface déjà. */
  v = 0,
): string | null {
  const fiole = fioleDe(cle)
  if (!fiole) return 'Cette fiole ne se lit pas : recharge la page'
  if (e.issue !== 'en-route') return 'L’expédition ne se joue plus'
  if (!e.fioles.includes(fiole.cle)) return 'Cette fiole n’est plus dans ton sac : recharge la page'
  if (fiole.cle === 'courage') return e.courage !== null && e.courage >= COURAGE_MAX ? 'Ton courage est au plus haut' : null
  const r = e.rencontre
  if (fiole.cle === 'energie') return r ? null : 'Elle se boit en rencontre : son énergie ne dure qu’une question'
  if (!r || r.tour.phase !== 'question' || e.enAttente === null) return 'Elle se boit la question sous les yeux'
  const q = questions[e.enAttente]
  const reponses = q?.reponses ?? 4
  if (reponses <= 2) return 'Pas sur un vrai ou faux : elle répondrait à ta place'
  // À composer (v11), elle retire une lettre de trop, tant qu'il en reste.
  if (q?.forme === 'lettres')
    return effaceesDuTour(r.tour.surLaQuestion, r.pouvoirs, { reponses, datee: q.datee, forme: 'lettres' }, v) >= LETTRES_EN_TROP ? 'Il ne reste plus de lettre de trop' : null
  if (effaceesDuTour(r.tour.surLaQuestion, r.pouvoirs, { reponses, datee: q?.datee, nombre: q?.nombre }, v) >= reponses - 2) return 'Il ne reste que deux réponses : plus rien à effacer'
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
  /**
   * À composer (v11) : ses cases et ses tuiles — ses `reponses` sont vides :
   * ses choix la rendraient à quatre choix, et sa bonne réponse la dirait.
   */
  composer?: QuestionAComposer
  /** Ce que les coups de pouce joués sur elle en disent (v11) : « Elle commence par S », « Son époque : les années 1240 ». */
  pouces?: string[]
  /** Un rébus (une curiosité, v12) : ses emojis, en grand au-dessus de ses cases (`emojisDe` les sépare) ; sa réponse se compose. */
  rebus?: string
  /**
   * Une frise (v13) : ses événements dans l'ordre où la page les montre —
   * jamais celui du temps (invariant 1) — ; ses `reponses` sont vides.
   */
  frise?: FriseAPoser
  /**
   * Un détail (v15) : de quoi montrer chaque cadrage à son heure — la page les
   * demande un à un à leur route, qui ne sert aucun avant elle (invariant 1).
   * Ni le tableau, ni son peintre : son `texte` est `QUESTION_DU_DETAIL`.
   */
  detail?: DetailAPoser
}

/**
 * Un détail tel que la page le reçoit (v15) : l'heure du serveur où son
 * premier cadrage s'est montré, et celle d'Arrêt sur image, joué sur lui —
 * la page en lit le cadrage du moment (`cadragesMontres`, à `serverNow()`).
 */
export interface DetailAPoser {
  depuis: number
  arret?: number
}

/**
 * Une frise telle que la page la reçoit (v13) : ses événements, dans un ordre
 * tiré au hasard qui n'est jamais le bon, et l'année de ceux qu'une carte a
 * datés — null pour les autres.
 */
export interface FriseAPoser {
  evenements: string[]
  annees: (number | null)[]
}

/**
 * Une question à composer, telle que la page la reçoit : ses cases et ses
 * tuiles, jamais leur ordre (invariant 1). Les lettres de trop qu'une carte a
 * retirées n'y sont plus, ni les tuiles des lettres qu'un coup de pouce a
 * posées.
 */
export interface QuestionAComposer {
  /** L'article posé d'office devant les cases : « La », « L’ ». */
  article?: string
  /** Ses mots, case par case : null, une lettre à poser ; un signe, posé d'office. */
  mots: CaseAComposer[][]
  /** Les lettres qu'un coup de pouce a posées : le rang de leur case parmi celles à remplir, de 0, et la lettre — elles ne se retouchent pas. */
  posees: { rang: number; lettre: string }[]
  /** Ses tuiles, chacune son numéro — son rang au tirage, qui ne change pas quand une autre s'en va —, et sa lettre. */
  tuiles: { n: number; lettre: string }[]
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
  /** Son style, choisi au départ (le 19 octobre 2026) ; absent d'une expédition d'avant lui. */
  style?: StyleDeJeu
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
  /**
   * Ses fioles (le codex, au niveau qui les ouvre) : celles qu'il porte, et
   * pourquoi chacune ne se boit pas maintenant — null : elle se boit
   * (`refusDeLaFiole`). Absentes d'une expédition sans fioles.
   */
  fioles?: { tenues: CleDeFiole[]; refus: Partial<Record<CleDeFiole, string | null>> }
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
   * L'énergie de chaque question, acte par acte, à sa version et à son cran
   * (`energieDesActesALAscension`) : deux à l'acte 1 depuis le jeu complet.
   * Absente d'une page d'avant elle : trois partout.
   */
  energie?: number[]
  /**
   * Son codex à son départ (v7) : son niveau, les règles ouvertes — les
   * règles disent celles qui attendent —, et la renommée qu'il avait : la fin
   * y ajoute celle de l'expédition (`VueDeLExpedition.renommee`) pour dire le
   * niveau gagné. Ses exploits d'alors : la fin dit ceux qu'elle ajoute, et
   * le dos doré habille son paquet ; absents d'un départ d'avant les exploits.
   */
  codex?: { niveau: number; regles: RegleDuCodex[]; renommee?: number; exploits?: CleDExploit[]; ascensionOuverte?: number }
  /** Le dos de son paquet, choisi au départ (`DepartDExpedition.dos`) ; absent d'un départ d'avant les dos. */
  dos?: DosDuPaquet
  /**
   * Son cran de l'Ascension, figé au départ (`ascensionDuDepart`) : la barre
   * et les règles le disent, et ce que rendent le campement et la source s'y
   * lit (`reposALAscension`). Absent : aucun cran.
   */
  ascension?: number
  /**
   * La main de l'acte (la question au centre, v10), sur le plan comme en
   * rencontre : ses cartes, combien attendent dans la pioche — leur ordre est
   * le hasard du serveur —, la défausse, et ce que la main tient au plus.
   * Absente avant elle : la main ne vivait qu'en rencontre.
   */
  main?: string[]
  pioche?: number
  defausse?: string[]
  mainMax?: number
}

/**
 * Son codex, sur la page de l'expédition (le 18 octobre 2026) : sa renommée,
 * de toutes ses expéditions finies — perdues et abandonnées comprises —, son
 * niveau d'explorateur, et ce qu'il ouvre — les cartes, celles des exploits
 * qu'il a faits et des légendaires qu'il a comprises, et les règles —, ses
 * exploits. Son départ le figera tel quel. Les dos de cartes qu'il a : le
 * départ en prend un.
 */
export interface CodexDeLaPage {
  renommee: number
  niveau: number
  cartes: string[]
  regles: RegleDuCodex[]
  exploits: CleDExploit[]
  dos: DosDuPaquet[]
  /**
   * Les styles qu'il peut choisir (le 19 octobre 2026), dans l'ordre où le
   * codex les ouvre (`stylesDuNiveau`) : trois au niveau 1. Absents d'un
   * serveur d'avant eux.
   */
  styles?: StyleDeJeu[]
  /** Le plus haut cran de l'Ascension qu'il a ouvert (`ascensionOuverte`) — 0 tant qu'aucune expédition n'est allée au bout. */
  ascension: number
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
    /** Les rencontres partent : partout, depuis qu'elles sont le jeu (`RENCONTRES_EN_PRODUCTION`). */
    rencontres?: true
    /**
     * Le départ part en version 11, la question au centre et ses coups de
     * pouce — partout depuis le 20 octobre 2026 (`QUESTION_AU_CENTRE_EN_PRODUCTION`) :
     * la page le demande (`questionAuCentre: true`), et son codex, ses styles
     * et son Ascension sont ceux de cette version.
     */
    questionAuCentre?: true
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
  /**
   * Un vrai ou faux tiré d'une question à quatre choix, dont la réponse
   * proposée était fausse : la bonne de ses quatre réponses, avec le verdict
   * seulement (invariant 1) — « Faux » ne disait pas ce qu'il fallait savoir.
   * À composer (v11), toujours : la page n'en a eu que les tuiles.
   */
  bonneReponse?: string
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
  /** Une frise (v13) : la bonne, dans l'ordre du temps — chaque événement et son année —, avec le verdict seulement (invariant 1). */
  frise?: FriseRevelee
  /** Un détail (v15) : son tableau — son titre, son peintre, son année —, avec le verdict seulement (invariant 1). */
  detail?: TableauRevele
  /**
   * Les familles (v14) : la réponse était fausse, et cette carte lui donne un
   * second essai — elle s'efface, il répond encore. Rien n'est jugé : ni
   * bonne réponse (`bonne` vaut −1), ni anecdote, ni coup (invariant 1) ; la
   * vue porte la question, sa réponse ratée effacée.
   */
  essai?: string
}

/** Le tableau d'un détail, révélé (v15) : la page le montre entier, de sa route (`CADRAGES_DU_DETAIL`). */
export interface TableauRevele {
  titre: string
  peintre: string
  annee: number
}

/** Une frise révélée (v13) : ses événements dans l'ordre du temps, chacun son année. */
export interface FriseRevelee {
  evenements: string[]
  annees: number[]
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
  /** Le compagnon qui vient de le rejoindre : la luciole, à sa première expédition menée au bout — la Première traversée. */
  compagnon?: CleDeCompagnon
}

// ── Ce qu'un joker montre d'une question : le serveur seul le calcule ──────

/**
 * Les mauvaises réponses qu'effacent les jokers d'une question — jamais plus
 * de deux sur quatre : une de plus, et le joker répondrait à sa place. Au
 * hasard de la graine et du rang de la question, dans le même ordre pour tous
 * les jokers : celle que L'écholocation efface le reste quand un Coup d'œil
 * s'y ajoute. Elle lit la bonne réponse : le serveur seul l'appelle.
 */
export function reponsesEffacees(
  graine: string,
  position: number,
  q: { reponses: readonly string[]; bonne: number },
  combien: number,
  /** Les familles (v14) : la réponse fausse de son premier essai, effacée d'abord — les cartes effacent ensuite les autres, au même hasard. */
  essai?: number,
): number[] {
  const ratee = essai !== undefined && essai !== q.bonne && essai >= 0 && essai < q.reponses.length ? essai : undefined
  if (q.reponses.length <= 2 || combien + (ratee !== undefined ? 1 : 0) <= 0) return []
  const r = hasardDe(`${graine}:efface:${position}`)
  const fausses = q.reponses.map((_, i) => i).filter(i => i !== q.bonne)
  for (let i = fausses.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[fausses[i], fausses[j]] = [fausses[j], fausses[i]]
  }
  const dansLOrdre = ratee === undefined ? fausses : [ratee, ...fausses.filter(i => i !== ratee)]
  return dansLOrdre.slice(0, Math.min(combien + (ratee !== undefined ? 1 : 0), q.reponses.length - 2)).sort((a, b) => a - b)
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

/** Le domaine d'une question : sa catégorie et son sous-thème — « Histoire, Pouvoirs ». */
function domaineDe(q: { categorie: string | null; sousTheme?: string }): string {
  const sousTheme = q.categorie && q.sousTheme ? SOUS_THEMES[q.categorie as keyof typeof SOUS_THEMES]?.find(s => s.cle === q.sousTheme)?.nom : undefined
  return [q.categorie, sousTheme].filter(Boolean).join(', ')
}

/** L'indice de l'Énigme : le siècle de la question — ou qu'elle ne se date pas — et son domaine, sa catégorie et son sous-thème. */
export function indiceDeLEnigme(q: { categorie: string | null; sousTheme?: string; date?: { valeur: string; precision?: string } | null }): string {
  const quand = siecleDeLaQuestion(q) ?? 'Elle ne se date pas'
  const domaine = domaineDe(q)
  return domaine ? `${quand} · ${domaine}` : quand
}

// ── Les coups de pouce (v11) : ce qu'ils soufflent, le serveur seul le calcule ──

/**
 * L'époque d'une question qui se date, telle que Le repère la dit : sa
 * décennie — « les années 1240 » —, son siècle avant l'an mil ou datée au
 * siècle. Null : elle ne se date pas, ou sa réponse est une année ou un
 * nombre — l'époque la dirait : Le repère n'y dit que son domaine.
 */
function epoqueDe(q: { date?: { valeur: string; precision?: string } | null; nombre?: boolean }): string | null {
  if (q.nombre || !q.date) return null
  const annee = Number(/^-?\d+/.exec(q.date.valeur)?.[0])
  if (!Number.isFinite(annee) || annee === 0) return null
  if (q.date.precision === 'siecle' || annee < 1000) return siecleDe(annee, q.date.precision === 'siecle').replace(/^Le /, 'le ')
  return `les années ${Math.floor(annee / 10) * 10}`
}

/**
 * Ce que dit Le repère (v11) : l'époque de la question ; sans époque à dire,
 * qu'il efface — une mauvaise réponse, ou à composer une lettre de trop
 * (`effaceesDuTour`, comme le Sphinx) ; amélioré, son domaine aussi, sa
 * catégorie et son sous-thème. Il ne lit pas la réponse, seulement d'où vient
 * la question.
 */
export function ceQueDitLeRepere(
  q: { categorie: string | null; sousTheme?: string; date?: { valeur: string; precision?: string } | null; nombre?: boolean; forme?: string },
  plus: boolean,
): string {
  const epoque = epoqueDe(q)
  const domaine = domaineDe(q)
  const efface = q.forme === 'lettres' ? 'une lettre de trop s’en va' : 'une mauvaise réponse s’efface'
  return [epoque ? `Son époque : ${epoque}` : `Pas d’époque à dire : ${efface}`, ...(plus && domaine ? [`Son domaine : ${domaine}`] : [])].join(' · ')
}

/** « Elle », ou, quand la bonne réponse a un article, « Sans son article, elle » : on compte ses lettres comme on les compose. */
const elleSansSonArticle = (reponse: string) => (sonArticle(reponse).article ? 'Sans son article, elle' : 'Elle')

/**
 * Ce que dit L'initiale d'une question à choix (v11) : la première lettre de
 * sa bonne réponse — et sa dernière, améliorée. Elle n'appartient qu'à elle
 * deux fois sur trois, sur quatre choix — qui ne sait pas trouve huit fois sur
 * dix (mesuré sur la base livrée, le 19 octobre 2026) : une rare. Elle lit la
 * bonne réponse : le serveur seul l'appelle.
 */
export function ceQueDitLInitiale(q: { reponses: readonly string[]; bonne: number }, plus: boolean): string {
  const reponse = q.reponses[q.bonne] ?? ''
  const mots = signesDe(reponse)
  const premiere = mots[0]?.[0]
  if (!premiere) return 'Elle ne s’écrit pas en lettres'
  const dernier = mots[mots.length - 1]
  return `${elleSansSonArticle(reponse)} commence par ${premiere}${plus ? ` et finit par ${dernier[dernier.length - 1]}` : ''}`
}

/**
 * Ce que dit La lettre d'une question à choix (v11) : une lettre de sa bonne
 * réponse — deux, améliorée —, comme au pendu : « Elle contient un R ». Une
 * qu'une autre réponse encore à l'écran n'a pas, quand elle en a — sinon la
 * carte ne servirait à rien —, au hasard de la graine et du rang de la
 * question : la même à chaque lecture. Sur quatre choix, qui ne sait pas
 * trouve six fois sur dix — huit avec L'initiale : une commune. Elle lit la
 * bonne réponse : le serveur seul l'appelle.
 */
export function ceQueDitLaLettre(graine: string, position: number, q: { reponses: readonly string[]; bonne: number }, effacees: readonly number[], plus: boolean): string {
  const reponse = q.reponses[q.bonne] ?? ''
  const lettresDe = (r: string) => new Set([...signesDe(r).join('')].filter(s => /[A-Z]/.test(s)))
  const siennes = [...lettresDe(reponse)]
  if (siennes.length === 0) return 'Elle ne s’écrit pas en lettres'
  const autres = q.reponses.flatMap((r, i) => (i === q.bonne || effacees.includes(i) ? [] : [lettresDe(r)]))
  const parlantes = siennes.filter(l => autres.some(a => !a.has(l)))
  const tas = parlantes.length > 0 ? parlantes : siennes
  const h = hasardDe(`${graine}:lettre:${position}`)
  for (let i = tas.length - 1; i > 0; i--) {
    const j = Math.floor(h() * (i + 1))
    ;[tas[i], tas[j]] = [tas[j], tas[i]]
  }
  const dites = tas.slice(0, plus ? 2 : 1)
  return `${elleSansSonArticle(reponse)} contient ${dites.map(l => `un ${l}`).join(' et ')}`
}

/**
 * Les cases qu'un coup de pouce pose sur une question à composer (v11), par
 * leur rang parmi les `n` à remplir : L'initiale la première — et la
 * dernière, améliorée —, La lettre une autre, au hasard de la graine et du
 * rang de la question — deux, améliorée. Jamais plus que `n − 2` : il reste
 * toujours de quoi composer.
 */
export function casesPosees(graine: string, position: number, n: number, cartes: readonly string[]): number[] {
  const posees: number[] = []
  const poser = (rang: number) => {
    if (rang >= 0 && rang < n && !posees.includes(rang) && posees.length < n - 2) posees.push(rang)
  }
  const h = hasardDe(`${graine}:lettre:${position}`)
  for (const cle of cartes) {
    const base = baseDe(cle)
    // Les familles (v14) : Astrolabe et Métamorphose posent la première lettre, Troisième œil posé une autre à chaque question.
    if (base === 'initiale' || base === 'astrolabe' || base === 'metamorphose') {
      poser(0)
      if (base === 'initiale' && estAmelioree(cle)) poser(n - 1)
    } else if (base === 'lettre' || base === 'troisieme-oeil') {
      for (let k = 0; k < (estAmelioree(cle) ? 2 : 1); k++) {
        const libres = Array.from({ length: n }, (_, i) => i).filter(i => i > 0 && !posees.includes(i))
        if (libres.length > 0) poser(libres[Math.floor(h() * libres.length)])
      }
    }
  }
  return posees.sort((a, b) => a - b)
}

/**
 * Ce que montre une question à composer (v11), à son rang : ses cases, les
 * lettres que les coups de pouce y ont posées, et ses tuiles — moins
 * `retirees` lettres de trop (`effaceesDuTour`), au hasard de la graine et du
 * rang, dans le même ordre pour toutes les cartes qui en retirent, et moins
 * une tuile par lettre posée. Elle lit la bonne réponse : le serveur seul
 * l'appelle. Null : sa réponse ne se compose pas — une question gardée qui ne
 * se lit plus.
 */
export function questionAComposer(
  graine: string,
  position: number,
  q: { reponses: readonly string[]; bonne: number; tuiles: readonly string[]; enTrop: readonly number[] },
  retirees: number,
  cartes: readonly string[],
): QuestionAComposer | null {
  const g = gabaritDe(q.reponses[q.bonne] ?? '')
  if (!g) return null
  const posees = casesPosees(graine, position, g.lettres.length, cartes).map(rang => ({ rang, lettre: g.lettres[rang] }))
  const r = hasardDe(`${graine}:efface:${position}`)
  const deTrop = [...q.enTrop]
  for (let i = deTrop.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[deTrop[i], deTrop[j]] = [deTrop[j], deTrop[i]]
  }
  const parties = new Set(deTrop.slice(0, Math.max(0, retirees)))
  // Une tuile par lettre posée : la première de cette lettre qui reste — une lettre de trop n'en est jamais une de la réponse.
  for (const p of posees) {
    const i = q.tuiles.findIndex((l, k) => l === p.lettre && !q.enTrop.includes(k) && !parties.has(k))
    if (i >= 0) parties.add(i)
  }
  return {
    ...(g.article && { article: g.article }),
    mots: g.mots,
    posees,
    tuiles: q.tuiles.flatMap((lettre, n) => (parties.has(n) ? [] : [{ n, lettre }])),
  }
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
