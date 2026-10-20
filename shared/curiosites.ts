// Les curiosités de l'Expédition (l'étape 4 de « La question au centre », le
// 19 octobre 2026) : des escales bonus — « des trucs bonus sur le chemin qui
// te filent des récompenses cool », disait le testeur. Une par acte, dès
// l'étage 2 : un plat dont on devine d'où il vient, ou un rébus en emojis à
// composer. Trouvée, elle offre une carte rare, une fiole ou un talisman, au
// choix ; ratée, elle ne coûte rien. Le brief : `retours/2026-10-19/les-curiosites.md`.
//
// Ici, ce qui ne dépend que d'elles : leurs sortes, ce que chacune demande, ce
// qu'un rébus doit être pour se poser. Le générateur les pose sur la carte
// (`carteDUnActe`), le pli les juge et les récompense (`pliDeLExpedition`),
// le serveur tire leurs questions (`server/src/core/curiosites.ts`).

import { EMOJI, estRecent } from './emojis'
import { gabaritDe } from './lettres'
import type { PoidsDesRaretes } from './rencontres'

/** Ce qu'une curiosité demande : d'où vient un plat, ou ce que cache un rébus. */
export type SorteDeCuriosite = 'plat' | 'rebus'

/** La part des rébus parmi les curiosités, le plat sinon. Un choix de produit. */
export const PART_DU_REBUS = 0.5

/** L'étage d'où une curiosité peut se poser, de 0 : le deuxième — le premier entre dans l'acte par ses questions. */
export const CURIOSITE_DES_L_ETAGE = 1

/** Le nom d'une curiosité, sur sa carte et en tête de sa question. */
export const NOM_DE_LA_CURIOSITE: Readonly<Record<SorteDeCuriosite, string>> = {
  plat: 'D’où vient ce plat ?',
  rebus: 'Le rébus',
}

/**
 * Les cartes que sa récompense propose : des rares — « une carte rare, une
 * fiole ou un talisman » (le choix du propriétaire du 19 octobre 2026). Une
 * offre du codex sans rien d'ouvert à cette rareté n'en propose pas d'autre
 * (`offreDuCodex`) : au niveau 1, il en a deux, Double chance et Sursis.
 */
export const RARETES_D_UNE_CURIOSITE: PoidsDesRaretes = { rare: 1 }

/**
 * Ce que sa récompense propose, en mots, aux règles du codex qu'il a
 * ouvertes : la carte de l'escale, l'en-tête de sa question et les règles le
 * disent des mêmes mots — le pli tire la même chose (`pliDeLExpedition`).
 */
export function ceQueRapporteUneCuriosite(fioles: boolean, talismans: boolean): string {
  if (fioles && talismans) return 'une carte rare, une fiole ou un talisman'
  if (fioles) return 'une carte rare ou une fiole'
  if (talismans) return 'une carte rare ou un talisman'
  return 'une carte rare'
}

/**
 * Ce qu'un rébus fait deviner : il le dit dans sa question — sans, on
 * chercherait un film dans un mot composé.
 */
export type GenreDeRebus = 'film' | 'personnage' | 'lieu' | 'mot' | 'metier' | 'jeu' | 'plat' | 'fete'

export const QUESTION_DU_REBUS: Readonly<Record<GenreDeRebus, string>> = {
  film: 'Quel film se cache derrière ces emojis ?',
  personnage: 'Quel personnage se cache derrière ces emojis ?',
  lieu: 'Quel lieu se cache derrière ces emojis ?',
  mot: 'Quel mot se cache derrière ces emojis ?',
  metier: 'Quel métier se cache derrière ces emojis ?',
  jeu: 'Quel jeu se cache derrière ces emojis ?',
  plat: 'Quel plat se cache derrière ces emojis ?',
  fete: 'Quelle fête se cache derrière ces emojis ?',
}

/** Un rébus de `server/content/curiosites/rebus.json`. */
export interface Rebus {
  /** Son identifiant, qui ne bouge jamais : ses réponses s'y rattachent (`PREFIXE_DU_REBUS`). */
  id: string
  /** De deux à quatre emojis, rien d'autre. */
  emojis: string
  /** Ce qu'il cache, à composer : deux mots au plus, de quatre à douze lettres, son article posé d'office (`gabaritDe`). */
  reponse: string
  genre: GenreDeRebus
  /** Comment il se lit, que la révélation dit : « Une porte et des feuilles : un portefeuille. » */
  lecture: string
}

/**
 * Le préfixe de l'identifiant d'un rébus dans le journal des réponses
 * (`campagne_reponses.reserve_id`) : il n'est pas une question de la base —
 * le carnet ne le reprend pas, la mesure ne le lit pas.
 */
export const PREFIXE_DU_REBUS = 'rebus:'

export const EMOJIS_D_UN_REBUS_MIN = 2
export const EMOJIS_D_UN_REBUS_MAX = 4

/** Un liant (ZWJ), une couleur de peau : des emojis que chaque téléphone dessine à sa façon, en un ou en deux. */
const LIANT_OU_PEAU = /[\u{200D}\u{1F3FB}-\u{1F3FF}]/u

/**
 * Les emojis d'un rébus, un par un — null : son texte n'est pas fait que
 * d'emojis simples. Ni lettre, ni chiffre, ni drapeau — sous Windows 10, un
 * drapeau s'écrit en deux lettres et dirait le pays —, ni liant ni couleur de
 * peau, ni emoji d'après Unicode 12 (`estRecent`).
 */
export function emojisDe(texte: string): string[] | null {
  const emojis = [...texte.matchAll(EMOJI)].map(m => m[0])
  if (emojis.join('') !== texte) return null
  if (emojis.some(e => LIANT_OU_PEAU.test(e) || estRecent(e))) return null
  return emojis
}

/** Pourquoi ce rébus ne se pose pas — null : il se pose. Le chargement du serveur l'écarte, le test du contenu le dit. */
export function refusDuRebus(brut: unknown): string | null {
  if (!brut || typeof brut !== 'object') return 'pas un rébus'
  const r = brut as Partial<Record<keyof Rebus, unknown>>
  if (typeof r.id !== 'string' || !/^[a-z0-9-]{2,40}$/.test(r.id)) return 'son identifiant : des minuscules, des chiffres et des tirets'
  if (typeof r.genre !== 'string' || !(r.genre in QUESTION_DU_REBUS)) return `son genre : ${Object.keys(QUESTION_DU_REBUS).join(', ')}`
  const emojis = typeof r.emojis === 'string' ? emojisDe(r.emojis) : null
  if (!emojis) return 'ses emojis : rien que des emojis simples, d’avant Unicode 13, sans drapeau ni liant'
  if (emojis.length < EMOJIS_D_UN_REBUS_MIN || emojis.length > EMOJIS_D_UN_REBUS_MAX) return `ses emojis : de ${EMOJIS_D_UN_REBUS_MIN} à ${EMOJIS_D_UN_REBUS_MAX}`
  if (typeof r.reponse !== 'string' || !gabaritDe(r.reponse)) return 'sa réponse : deux mots au plus, de quatre à douze lettres'
  if (typeof r.lecture !== 'string' || r.lecture.trim().length < 8 || r.lecture.length > 140) return 'sa lecture : une phrase de 140 signes au plus'
  return null
}
