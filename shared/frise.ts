// La frise de l'Expédition (l'étape 5 de « La question au centre », le
// 20 octobre 2026) : quatre événements à remettre dans l'ordre, du plus ancien
// au plus récent — « des événements à remettre dans l'ordre », disait le
// testeur. Le brief : `retours/2026-10-20/la-frise.md`.
//
// Ses événements viennent de la base de la campagne : chacun est une question
// datée, récrite en une ligne (`server/content/frises/evenements.json`). Son
// année est celle de la question, déjà relue — la ligne ne fait que dire ce
// qui s'est passé, jamais quand.
//
// Ici, ce qui ne dépend que d'elle : ce qu'une ligne doit être, le choix de
// quatre événements, l'ordre où la page les montre, ce que le téléphone envoie
// et ce que le serveur juge. Le générateur pose la forme sur la carte
// (`carteDUnActe`), le serveur tire la frise (`server/src/core/frises.ts`).

import type { Niveau } from './campagne'

/** Un événement de la frise, tel que le serveur le tient : sa ligne, et l'année et la catégorie de sa question. */
export interface EvenementDeLaFrise {
  /** L'identifiant de sa question dans la base : il ne bouge jamais. */
  id: string
  evenement: string
  annee: number
  categorie: string
}

/** Les événements d'une frise : trois se trouveraient une fois sur six au hasard ; quatre, une sur vingt-quatre. */
export const EVENEMENTS_D_UNE_FRISE = 4

/**
 * L'écart, en années, entre deux événements voisins d'une frise, à chaque
 * marche : la facile se range d'intuition — « le téléphone vient avant
 * l'avion » —, la difficile demande de savoir. Une catégorie trop serrée pour
 * l'écart demandé le divise par deux, jamais sous un an (`choisirLaFrise`).
 * Des choix de produit.
 */
export const ECART_DE_LA_FRISE: Readonly<Record<Niveau, number>> = { facile: 30, moyen: 10, difficile: 3, expert: 1 }

/** La question d'une frise, toujours la même : ce qui change, ce sont ses événements. */
export const QUESTION_DE_LA_FRISE = 'Remets ces événements dans l’ordre, du plus ancien au plus récent'

/**
 * Le préfixe de l'identifiant d'une frise dans le journal des réponses
 * (`campagne_reponses.reserve_id`), suivi des identifiants de ses événements,
 * dans l'ordre du temps, joints par `+` : elle n'est pas une question de la
 * base — le carnet ne la reprend pas, la mesure ne la lit pas —, et ce qu'il a
 * déjà vu dans une frise se relit de là (`evenementsVus`).
 */
export const PREFIXE_DE_LA_FRISE = 'frise:'

/** Une ligne d'événement : assez pour dire ce qui s'est passé, assez court pour quatre cartes en 360 pixels. */
export const LIBELLE_MIN = 10
export const LIBELLE_MAX = 70

/**
 * Ce qui daterait l'événement : une année ou un nombre de trois ou quatre
 * chiffres, un siècle, une décennie, « avant Jésus-Christ ». La frise se
 * jouerait sans rien savoir.
 */
// Un siècle s'écrit avec son mot : « François Ier », « la Ve République » sont des noms, pas des dates — et un motif des seuls
// chiffres romains, insensible à la casse, prenait « le » pour le cinquantième.
const CE_QUI_DATE = /\b\d{3,4}\b|si[eè]cle|ann[ée]es\s+\d|\bJ\.?-?C\b|J[ée]sus-Christ|\ban mil\b|mill[ée]naire/i

/** Pourquoi cette ligne ne se pose pas — null : elle se pose. Le chargement du serveur l'écarte, le test du contenu le dit. */
export function refusDuLibelle(brut: unknown): string | null {
  if (typeof brut !== 'string') return 'pas une ligne'
  const t = brut.trim()
  if (t !== brut) return 'des espaces au bord'
  if (t.length < LIBELLE_MIN || t.length > LIBELLE_MAX) return `de ${LIBELLE_MIN} à ${LIBELLE_MAX} signes : ${t.length}`
  if (!/^[A-ZÀ-ÖØ-Þ«0-9]/.test(t)) return 'une majuscule en tête'
  // Un titre garde la sienne — « Help! », « Where Is the Love? » — : seul le point d'une phrase est de trop.
  if (/[.:;,]$/.test(t)) return 'sans point au bout : une ligne, pas une phrase'
  const date = CE_QUI_DATE.exec(t)
  if (date) return `rien qui date : « ${date[0]} »`
  return null
}

/**
 * Quatre événements de ces candidats, assez écartés pour la marche — dans
 * l'ordre du temps. Ceux qu'il n'a jamais vus dans une frise d'abord, au
 * hasard, puis les autres ; un candidat se garde s'il est à `ecart` ans au
 * moins de chacun de ceux déjà gardés. Trop serrés, l'écart se divise par
 * deux, jamais sous un an : deux événements de la même année ne se rangent
 * pas. Null : ils n'en ont pas quatre d'années différentes.
 */
export function choisirLaFrise(
  candidats: readonly EvenementDeLaFrise[],
  ecart: number,
  hasard: () => number,
  dejaVu: (id: string) => boolean = () => false,
): EvenementDeLaFrise[] | null {
  const melanges = (tas: EvenementDeLaFrise[]) => {
    for (let i = tas.length - 1; i > 0; i--) {
      const j = Math.floor(hasard() * (i + 1))
      ;[tas[i], tas[j]] = [tas[j], tas[i]]
    }
    return tas
  }
  const ordre = [...melanges(candidats.filter(e => !dejaVu(e.id))), ...melanges(candidats.filter(e => dejaVu(e.id)))]
  for (let e = Math.max(1, Math.floor(ecart)); ; e = Math.max(1, Math.floor(e / 2))) {
    const gardes: EvenementDeLaFrise[] = []
    for (const x of ordre) {
      if (gardes.every(g => Math.abs(g.annee - x.annee) >= e)) gardes.push(x)
      if (gardes.length === EVENEMENTS_D_UNE_FRISE) return gardes.sort((a, b) => a.annee - b.annee)
    }
    if (e === 1) return null
  }
}

/**
 * L'ordre où la page montre les événements d'une frise : `montre[i]`, le rang
 * dans le temps de la carte montrée en `i`e. Jamais le bon ordre — il se
 * jouerait sans un geste —, tiré au hasard avec la question et gardé avec elle.
 */
export function ordreMontre(n: number, hasard: () => number): number[] {
  const montre = Array.from({ length: n }, (_, i) => i)
  do {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(hasard() * (i + 1))
      ;[montre[i], montre[j]] = [montre[j], montre[i]]
    }
  } while (n > 1 && montre.every((x, i) => x === i))
  return montre
}

/**
 * Ce que le téléphone envoie : les cartes montrées, de la plus ancienne à la
 * plus récente, par leur rang à l'écran — chacune une fois. Null : ce n'est pas
 * une frise remplie.
 */
export function lireUnOrdre(brut: unknown, n: number): number[] | null {
  if (!Array.isArray(brut) || brut.length !== n) return null
  if (!brut.every(x => Number.isInteger(x) && x >= 0 && x < n)) return null
  return new Set(brut).size === n ? (brut as number[]) : null
}

/** L'ordre qu'il a donné, en rangs dans le temps : ce que le journal garde (`campagne_reponses.composee`, « 1032 »). */
export const ordreDansLeTemps = (ordre: readonly number[], montre: readonly number[]) => ordre.map(i => montre[i])

/** Juste : chaque événement à sa place, en entier. */
export const friseJuste = (dansLeTemps: readonly number[]) => dansLeTemps.every((x, i) => x === i)

/** L'ordre gardé au journal (« 1032 »), relu ; null : illisible. */
export function ordreGarde(composee: string | null | undefined, n: number): number[] | null {
  if (typeof composee !== 'string' || composee.length !== n || !/^\d+$/.test(composee)) return null
  const ordre = [...composee].map(Number)
  return lireUnOrdre(ordre, n)
}

/** Une année telle que la frise la dit : « 1789 », « 52 av. J.-C. ». */
export const anneeDite = (annee: number) => (annee < 0 ? `${-annee} av. J.-C.` : String(annee))

/**
 * Les événements qu'une carte date sur une frise, par leur rang dans le temps
 * — une carte qui effacerait des réponses date des événements : autant que
 * de réponses effacées, deux au plus (`effaceesDuTour`), et ici jamais tous —
 * la frise se rangerait seule. Au hasard de la graine et du rang de la
 * question, dans le même ordre pour toutes les cartes, comme les réponses
 * effacées (`reponsesEffacees`).
 */
export function evenementsDates(hasard: () => number, n: number, combien: number): number[] {
  const rangs = Array.from({ length: n }, (_, i) => i)
  for (let i = rangs.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1))
    ;[rangs[i], rangs[j]] = [rangs[j], rangs[i]]
  }
  return rangs.slice(0, Math.max(0, Math.min(combien, n - 1))).sort((a, b) => a - b)
}
