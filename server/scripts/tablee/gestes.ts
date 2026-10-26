// Ce que la régie lit des arguments d'un geste, sans navigateur : de quoi
// l'éprouver (`server/test/tablee.test.ts`) — `regie.ts` démarre un serveur et
// un Chromium dès son import. Chaque geste se dit aussi dans l'aide du pilote
// (`pilote.mjs`) et dans les consignes qui l'emploient (règle `tablee.md`).

/** Où toucher dans un élément, en pour cent de sa boîte : de gauche à droite, de haut en bas. */
export interface Visee {
  x: number
  y: number
}

/** Ce que dit le refus d'une visée illisible : comment viser, deux exemples. */
const COMMENT_VISER =
  '« --a » dit où toucher l’élément, en pour cent : --a 30% (de sa largeur, de gauche à droite), ou --a 60%,55% (puis de sa hauteur, de haut en bas), chaque nombre de 0 à 100.'

/** Un pourcentage de 0 à 100, le « % » sous-entendu ; null sinon. Un point décimal : la virgule sépare les deux axes. */
function pourcent(texte: string | undefined): number | null {
  if (texte === undefined) return null
  const m = /^(\d{1,3}(?:\.\d+)?)%?$/.exec(texte)
  if (!m) return null
  const n = Number(m[1])
  return n <= 100 ? n : null
}

/**
 * Les arguments de `toucher` : la cible — une référence lue par `voir`, ou un
 * texte, que le shell a pu couper en mots — et, après `--a`, où la toucher.
 * Le pilote touchait toujours le centre : sur la carte de France, l'épingle
 * tombait au milieu de la carte, et le curseur du Filet, son bouton au milieu,
 * ne bougeait pas — la tablée du 25 octobre 2026 l'a pris pour un défaut des
 * jeux (« l'Épingle aux flèches seulement », « le Filet ne bouge que par un
 * cran »). Sans hauteur, le milieu. Une chaîne : le refus, en mots.
 */
export function lireLeToucher(args: readonly string[]): { cible: string; visee: Visee | null } | string {
  const ou = args.indexOf('--a')
  const cible = (ou < 0 ? args : args.slice(0, ou)).join(' ').trim()
  if (!cible) return 'Toucher quoi ? ex. « toucher e12 », « toucher "Jouer sans compte" » ou « toucher "Ton estimation" --a 30% ».'
  if (ou < 0) return { cible, visee: null }
  // « --a 60%, 55% » tapé avec une espace arrive en deux arguments : la même visée.
  const axes = args.slice(ou + 1).join('').split(',')
  const x = pourcent(axes[0])
  const y = axes.length === 1 ? 50 : pourcent(axes[1])
  if (axes.length > 2 || x === null || y === null) return COMMENT_VISER
  return { cible, visee: { x, y } }
}

/**
 * Le point à toucher, depuis le coin haut gauche de la boîte de l'élément — ce
 * que `tap({ position })` de Playwright attend, dans les unités de
 * `boundingBox()` (le zoom du texte compris). À 100 %, son dernier pixel : le
 * bord droit est déjà hors de lui, et le doigt toucherait le voisin.
 */
export function pointVise(boite: { width: number; height: number }, v: Visee): { x: number; y: number } {
  const sur = (longueur: number, part: number) => Math.min((longueur * part) / 100, Math.max(0, longueur - 1))
  return { x: sur(boite.width, v.x), y: sur(boite.height, v.y) }
}

/**
 * `ecrire` ou `coller` dans un curseur (`input type="range"`) : un doigt ne le
 * tape pas, il le touche où il veut. Playwright y vide d'abord le champ
 * (`fill('')`), qu'il refuse sur un curseur — « Malformed value », que la tablée
 * du 25 octobre 2026 a lu comme un bug du Filet ; et `fill('90')` l'aurait réglé
 * d'un coup, ce qu'aucun téléphone ne fait.
 */
export const UN_CURSEUR_NE_SE_TAPE_PAS = 'Un curseur ne se tape pas : touche-le où tu veux, --a 30%'

/** Les dés lancés d'un geste, au plus : de quoi tirer d'avance toute une partie de l'Éclair (cinq affirmations, trois manches). */
export const DES_PAR_GESTE_MAX = 20

/** Un entier de `min` à `max`, écrit en chiffres ; null sinon. */
function entre(texte: string, min: number, max: number): number | null {
  const n = /^\d{1,3}$/.test(texte) ? Number(texte) : NaN
  return n >= min && n <= max ? n : null
}

/**
 * Le dé (`de [faces] [fois]`) : six faces d'office, un seul. Un agent qui
 * « devine » ne tire rien au hasard : il prend la réponse qu'il sait, ou celle
 * qui lui paraît plausible — la tablée du 25 octobre 2026 savait l'année du
 * diapason de John Shore. Ses fiches lui disent quand le dé décide, et le
 * journal des gestes garde chaque tirage. Plusieurs d'un coup : un geste coûte
 * quelques secondes à un agent, et une manche a son chrono — il les lance à
 * l'annonce, avant « Commencer ». Une chaîne : le refus, en mots.
 */
export function lireLeDe(args: readonly string[]): { faces: number; fois: number } | string {
  const faces = args[0] === undefined ? 6 : entre(args[0], 2, 100)
  const fois = args[1] === undefined ? 1 : entre(args[1], 1, DES_PAR_GESTE_MAX)
  if (faces === null || fois === null || args.length > 2) {
    return `Un dé de 2 à 100 faces, lancé de 1 à ${DES_PAR_GESTE_MAX} fois : « de » (six faces), « de 12 », « de 12 9 » (neuf tirages), « de 4 » pour choisir parmi quatre.`
  }
  return { faces, fois }
}
