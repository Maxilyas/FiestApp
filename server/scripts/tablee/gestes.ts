// Ce que la régie lit sans navigateur — les arguments d'un geste, la vue d'une
// partie du Cabinet que la page reçoit, la marche de ce qu'il faut savoir au
// plan figé — et le script qui fait attendre une photo : de quoi l'éprouver
// (`server/test/tablee.test.ts`) — `regie.ts` démarre un serveur et un
// Chromium dès son import. Chaque geste se dit aussi
// dans l'aide du pilote (`pilote.mjs`) et dans les consignes qui l'emploient
// (règle `tablee.md`).
import { randomInt } from 'node:crypto'
import type { Niveau } from '../../../shared/campagne'
import type { ContenuTire } from '../../../shared/cabinet/jeux/index'

/** Où toucher dans un élément, en pour cent de sa boîte : de gauche à droite, de haut en bas. */
export interface Visee {
  x: number
  y: number
}

/** Ce que dit le refus d'une visée illisible : comment viser, deux exemples. */
const COMMENT_VISER =
  '« --a » dit où toucher l’élément, en pour cent : --a 30% (de sa largeur, de gauche à droite), ou --a 60%,55% (puis de sa hauteur, de haut en bas), chaque nombre de 0 à 100, une décimale après un point (--a 62.5%).'

/** Deux nombres, l'un sans son « % » : une décimale à la française, sans doute — « 62,5% » se lisait 62 % de large, 5 % de haut. */
const DEUX_AXES =
  'Deux nombres, chacun son « % » : --a 60%,55% (sa largeur, puis sa hauteur). Une décimale s’écrit avec un point : --a 62.5%.'

/** `--a` collé à son nombre ou pris dans les guillemets de la cible : celle-ci ne nommait plus rien de visible. */
const HORS_DES_GUILLEMETS =
  '« --a » se met hors des guillemets de la cible, une espace avant son nombre : toucher "Ton estimation" --a 30%.'

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
  if (/(^|\s)--a/.test(cible)) return HORS_DES_GUILLEMETS
  if (!cible) return 'Toucher quoi ? ex. « toucher e12 », « toucher "Jouer sans compte" » ou « toucher "Ton estimation" --a 30% ».'
  if (ou < 0) return { cible, visee: null }
  // « --a 60%, 55% » tapé avec une espace arrive en deux arguments : la même visée.
  const axes = args.slice(ou + 1).join('').split(',')
  if (axes.length > 2) return COMMENT_VISER
  // Deux nombres portent chacun leur « % » : « 62,5% » ne doit pas planter
  // l'épingle au bord nord de la carte, en silence.
  if (axes.length === 2 && !axes.every(a => a.endsWith('%'))) return DEUX_AXES
  const x = pourcent(axes[0])
  const y = axes.length === 1 ? 50 : pourcent(axes[1])
  if (x === null || y === null) return COMMENT_VISER
  return { cible, visee: { x, y } }
}

/**
 * Le nom que vise une lettre ou un chiffre seul : lui, ou lui suivi d'une
 * virgule — une touche du Mot, une fois colorée, s'appelle « R , bien
 * placée ». Après les noms exacts, la régie cherchait n'importe quel nom qui
 * contienne la cible : « R » touchait « Quitter », le premier bouton de la
 * page (Lucas, à la tablée du 26 octobre 2026, puis quatre gestes refusés
 * derrière la fenêtre ; Jeanne y a perdu des lettres). Un emoji garde la
 * recherche d'avant : l'avatar 🦊 s'appelle « Avatar 🦊 ». Null : la cible
 * n'est pas un signe seul.
 */
export function nomDUnSigneSeul(cible: string): RegExp | null {
  // Une lettre ou un chiffre n'a rien à échapper dans une expression.
  return /^[\p{L}\p{N}]$/u.test(cible) ? new RegExp(`^${cible}(?:\\s*,.*)?$`, 'iu') : null
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

/**
 * Ce que la page évalue avant une photo (`capture`, `tele --capture`) : le
 * décodage de chaque image que la photo montrera, `ms` au plus — le décodage
 * d'une image qu'on ne voit pas est asynchrone, et la Citrouille sortait en
 * disque vide —, puis combien n'en sont toujours pas peintes. La photo de
 * l'écran n'attend que ce qui y paraît. Celle de la page entière en montre le
 * bas : elle passe d'abord les images paresseuses en « eager », sans quoi
 * Chromium ne demande jamais celles qui sont loin sous l'écran — une case vide
 * sur la photo, et leur `decode()` attendait les `ms` pour rien (mesuré sur
 * Chromium, une image à 9 000 px sous un écran de 640). Une image cassée ne
 * retient pas la photo : ce qu'elle montre est à l'application. Une chaîne,
 * comme les autres scripts de la régie : l'épreuve l'évalue telle quelle, sur
 * de fausses images.
 */
export function attenteDesImages(entiere: boolean, ms: number): string {
  return `(async () => {
    const entiere = ${entiere}
    const montrees = [...document.images].filter(i => entiere || (b => b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth)(i.getBoundingClientRect()))
    if (entiere) for (const i of montrees) if (i.loading === 'lazy') i.loading = 'eager'
    let pasPretes = montrees.length
    await Promise.race([
      Promise.all(montrees.map(i => i.decode().catch(() => {}).then(() => { pasPretes-- }))),
      new Promise(r => setTimeout(r, ${ms})),
    ])
    return pasPretes
  })()`
}

/**
 * La ligne qui suit une photo prise avant certaines de ses images, vide s'il
 * n'y en a pas : sous six onglets qui tournent, trois secondes ne suffisent
 * pas toujours, et un vide sur la photo se lisait comme un bug de l'application.
 */
export function imagesPasPretes(n: number): string {
  if (n <= 0) return ''
  const combien = n === 1 ? 'Une image n’était pas encore peinte' : `${n} images n’étaient pas encore peintes`
  return `⏳ ${combien} : une case vide sur la photo vient du banc, pas de l’application — refais-la dans un instant.`
}

/**
 * Les dés lancés d'un geste, au plus : de quoi tirer d'avance toute une partie
 * de l'Éclair (`AFFIRMATIONS_DE_L_ECLAIR` × `MANCHES_PAR_PARTIE`, quinze
 * aujourd'hui), et un peu plus — `tablee.test.ts` le relit contre le barème.
 */
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

/**
 * Le dé lancé : ce que l'agent lit, et ce que le journal des gestes en garde de
 * plus que ses arguments — ses faces et chaque tirage, que la chronologie range
 * (« Les dés ») et où la synthèse relit si le dé a décidé. Le hasard est celui
 * de `node:crypto`, sauf un tirage donné, pour l'éprouver.
 */
export function lancerLeDe(
  qui: string,
  de: { faces: number; fois: number },
  tirer: (faces: number) => number = faces => randomInt(1, faces + 1),
): { sortie: string; auJournal: { faces: number; tirages: number[] } } {
  const tirages = Array.from({ length: de.fois }, () => tirer(de.faces))
  const dit = de.fois === 1 ? `le dé : ${tirages[0]}` : `${de.fois} dés : ${tirages.join(', ')}`
  return { sortie: `🎲 ${qui} lance ${dit} (de 1 à ${de.faces}).`, auJournal: { faces: de.faces, tirages } }
}

// ── La marche, que l'écran tait et que le dé lit ───────────────────────────
//
// Le dé d'un personnage du Cabinet a un seuil par marche, comme le calibrage
// tire ce que sait son joueur d'une question de la base à sa marche (`sait`,
// `filetSait`). La tablée du 26 octobre 2026 n'en avait qu'un : Ophélie a fait
// 9 sur 9 à un Mot visé épique, ses deux questions difficiles sues comme des
// faciles. Mais l'écran ne montre pas la marche, et la vue n'en porte rien :
// un seuil par marche ne se jouerait pas. La régie la lit au plan figé de la
// partie, à l'indice que la vue dit (`VueDeLaPartie.tirage`), et ne dit
// qu'elle, pour le dé — jamais la catégorie du plan, qui dirait d'avance aux
// Indices qui chercher.

/** Ce que la régie retient d'une vue de partie du Cabinet qu'a reçue la page : de quoi lire sa manche au plan figé, rien d'autre. */
export interface PartieVueParLaPage {
  /** La partie ; null, la page du musée n'en a pas d'ouverte. */
  partie: string | null
  /** L'heure du serveur de la vue : les réponses arrivent dans le désordre, la plus récente l'emporte. */
  maintenant: number
  /** L'indice, dans le plan figé, du contenu de la manche — la sienne, ou la rechange de « Changer » ; null avant la première. */
  tirage: number | null
  /** L'étape du Pari : 1, puis 2 après « Parier ». */
  etape: number | null
  /** Une manche se joue, pause comprise : la marche ne se dit que là. */
  enJeu: boolean
}

type Objet = Record<string, unknown>
const estUnObjet = (x: unknown): x is Objet => typeof x === 'object' && x !== null
/** Une vue de partie (`VueDeLaPartie`) : un cartel, des murs ou une erreur n'en ont ni la phase ni les manches. */
const estUneVue = (x: unknown): x is Objet => estUnObjet(x) && typeof x.id === 'string' && typeof x.phase === 'string' && Array.isArray(x.manches)

/**
 * La partie que porte la réponse d'une route du Cabinet : une vue (le départ,
 * un geste, « Mes réponses »), le refus d'un geste passé (sa vue d'à présent,
 * `partie`), ou la page du musée (`enCours`, null sans partie ouverte) ; null
 * pour le reste.
 */
export function partieDeLaReponse(corps: unknown): PartieVueParLaPage | null {
  if (!estUnObjet(corps)) return null
  const vue = [corps, corps.partie, corps.enCours].find(estUneVue)
  if (!vue) {
    // La page du musée sans partie ouverte : celle d'avant est finie, ou close par le serveur au jour neuf.
    return corps.enCours === null && typeof corps.maintenant === 'number' ? { partie: null, maintenant: corps.maintenant, tirage: null, etape: null, enJeu: false } : null
  }
  const manche = estUnObjet(vue.enCours) ? vue.enCours : null
  return {
    partie: vue.id as string,
    maintenant: typeof vue.maintenant === 'number' ? vue.maintenant : 0,
    tirage: typeof vue.tirage === 'number' ? vue.tirage : null,
    etape: typeof manche?.etape === 'number' ? manche.etape : null,
    enJeu: vue.phase === 'jouer' || vue.phase === 'pause',
  }
}

/** La vue la plus récente, à l'heure du serveur : un geste et la page du musée peuvent revenir dans le désordre. */
export function retenirLaPartie(avant: PartieVueParLaPage | null, lue: PartieVueParLaPage): PartieVueParLaPage {
  return avant && avant.maintenant > lue.maintenant ? avant : lue
}

/** Ce qu'il faut savoir dans une manche, à sa marche : « de la question », facile. */
export interface ChoseASavoir {
  quoi: string
  marches: Niveau[]
}

/**
 * La marche de ce qu'il faut savoir dans la manche que joue ce contenu du
 * plan : la question du Pari — celle du pari à l'étape 2 seulement, sans quoi
 * sa marche aurait dit s'il vaut la peine de parier —, chaque affirmation de
 * l'Éclair, le mot, la valeur du Filet. Null pour les jeux dont le calibrage
 * ne lit pas la marche (le Détail, la Frise, l'Épingle, les Indices, la
 * Réplique) : leur seuil est fixe.
 */
export function marchesASavoir(tire: ContenuTire, etape: number | null): ChoseASavoir | null {
  switch (tire.jeu) {
    case 'pari':
      return etape === 2 ? { quoi: 'de la question du pari', marches: [tire.q2.niveau] } : { quoi: 'de la question', marches: [tire.q1.niveau] }
    case 'eclair':
      return { quoi: 'des affirmations, dans l’ordre', marches: tire.affirmations.map(a => a.question.niveau) }
    case 'mot':
      return { quoi: 'du mot', marches: [tire.question.niveau] }
    case 'filet':
      return { quoi: 'de la valeur', marches: [tire.question.niveau] }
    default:
      return null
  }
}

/** La marche dite comme les consignes l'écrivent : c'est « la marche », au féminin. */
const MARCHE_DITE: Readonly<Record<Niveau, string>> = { facile: 'facile', moyen: 'moyenne', difficile: 'difficile', expert: 'experte' }

/** La ligne que la régie pose en tête de l'écran d'une manche : la marche seule, jamais ce qu'elle cache. */
export function ligneDeLaMarche(c: ChoseASavoir): string {
  return `🎲 Pour ton dé, la marche ${c.quoi} : ${c.marches.map(m => MARCHE_DITE[m]).join(', ')} — le banc te la dit, l’écran ne la montre pas.`
}
