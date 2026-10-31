// La bande d'une manche : ce que la tête et le pied collés d'une partie
// laissent à l'écran. La question collée de l'Épingle et sa carte, le tableau
// du Détail s'y règlent (`--cab-tete`, `--cab-fenetre`, `--cab-place`,
// `styles.css`) ; la ligne à taper du Mot s'y ramène (`bandeALEcran`) ; le
// défilement s'arrête sur la carte, entre la question et le pied, quand l'arrêt
// est loin du haut de la page (`data-arret`), et garde la hauteur du pied sous
// une révélation (`--cab-question`, `--cab-pied`). Au petit téléphone, le
// texte agrandi, la question et la carte ne tenaient
// jamais ensemble, ni le tableau et ses titres (la tablée du 25 octobre 2026),
// et rien n'amenait la page à la carte (la tablée du 26).
//
// Et la rangée des manches de la tête : « Quitter » y garde son mot tant
// qu'il tient (`poserLeMotDeQuitter`, `surLaMemeRangee`).
//
// Une seule copie de ce qui la borne : la partie, le Mot et le rendu du musée
// d'avant la traversée la lisaient chacun à sa façon. Sans rien du DOM dans
// ses types : une épreuve la pose sur un faux élément, sous Node.

/** La tête collée d'une partie : ses manches, ses étoiles, « Quitter », le chrono. */
export const TETE_COLLEE = '.cab-tete-partie'

/** Le pied collé : la carte-bonus qui sert encore, le pied du jeu. Une carte-bonus qui ne sert plus se pose sous la manche (`cab-pied-pose`), et ne borne plus rien. */
export const PIED_COLLE = '.cab-pied-partie:not(.cab-pied-pose)'

/** La question qui se colle sous la tête — celle de l'Épingle, au-dessus de sa carte. */
export const QUESTION_COLLEE = '.cab-manche > .cab-question'

/** Ce qu'on surveille : ce qui change de taille change la bande. */
export const CE_QUI_BORNE_LA_BANDE = `${TETE_COLLEE}, ${PIED_COLLE}, ${QUESTION_COLLEE}`

/** L'air que la carte de l'Épingle laisse sous sa question collée. */
export const AIR_SOUS_LA_QUESTION = 8

/** La carte de l'Épingle tant qu'elle se joue : un point d'arrêt du défilement, quand il s'arme (`lArretDeLaCarteSArme`). */
export const CARTE_JOUABLE = '.cab-manche .cab-carte-jouable'

/** Ce qui se lit juste au-dessus de la question collée — le récit de l'Épingle, qui porte l'indice. */
export const LU_AU_DESSUS_DE_LA_QUESTION = '.cab-manche > :has(+ .cab-question)'

/**
 * La part de la fenêtre où un arrêt `proximity` happe la page : Chromium y ramène toute position à moins d'un tiers de la fenêtre
 * de lui — après un geste, à l'ouverture, et quand la page change de hauteur sous elle (mesuré au doigt et sur une page réduite,
 * le 26 octobre 2026).
 */
export const ATTRACTION_DE_L_ARRET = 1 / 3

/** Ce qui décide de l'arrêt sur la carte, en pixels de l'écran — ceux du document qui défile, comptés de son haut. */
export interface ArretDeLaCarte {
  /** Le bas de la carte dans le document. */
  readonly basDeLaCarte: number
  /** Où en est la page quand ce qui se lit au-dessus de la question commence juste sous la tête collée. */
  readonly lecture: number
  /** La marge d'arrêt sous la carte : le pied collé (`--cab-pied`). */
  readonly pied: number
  readonly fenetre: number
}

/**
 * L'arrêt sur la carte de l'Épingle s'arme-t-il ? La page s'y arrêterait le bas de la carte sur le haut du pied, et happerait
 * tout ce qui finit à moins d'un tiers de la fenêtre de là : il ne s'arme que si ce qui se lit au-dessus de la question — le
 * récit, qui porte l'indice — reste hors de cette attraction, de la page en haut à la page où le récit commence sous la tête. Armé
 * d'office, en 360 × 640 au texte normal, il s'arrêtait à 209 px du haut : la page s'ouvrait défilée, le récit sous la tête, et ni
 * le doigt ni `scrollTo(0, 0)` ne l'y ramenaient (la relecture du lot la-partie-et-la-visite). Si près, la carte tient déjà à
 * moitié à l'ouverture, et le doigt l'amène sans aide ; au texte agrandi, l'arrêt est loin, et s'arme. Un arrêt de plus en haut
 * de la page aurait libéré l'ouverture, mais happé à son tour tout ce qui est entre les deux : la fin d'un récit de huit lignes,
 * sous le pied à l'ouverture, ne se serait plus lue nulle part. Pur.
 */
export function lArretDeLaCarteSArme(a: ArretDeLaCarte): boolean {
  const arret = a.basDeLaCarte + a.pied - a.fenetre
  return arret - a.fenetre * ATTRACTION_DE_L_ARRET > Math.max(0, a.lecture)
}

/** Le haut et le bas d'une boîte à l'écran, comme `getBoundingClientRect` les dit. */
export interface BoiteALEcran {
  readonly top: number
  readonly bottom: number
}

/**
 * La bande à l'écran, en pixels d'écran : du bas de la tête collée au haut du
 * pied collé — le clavier du Mot —, sinon la fenêtre.
 */
export function bandeALEcran(doc: { querySelector(selecteur: string): { getBoundingClientRect(): BoiteALEcran } | null }, hauteurDeLaFenetre: number): BoiteALEcran {
  return { top: doc.querySelector(TETE_COLLEE)?.getBoundingClientRect().bottom ?? 0, bottom: doc.querySelector(PIED_COLLE)?.getBoundingClientRect().top ?? hauteurDeLaFenetre }
}

/** Ce que la bande mesure de la page, en pixels de la page : la fenêtre, et la hauteur de la tête, du pied et de la question collés (0 pour un absent). */
export interface MesureDeLaBande {
  readonly largeur: number
  readonly fenetre: number
  readonly tete: number
  readonly pied: number
  readonly question: number
}

/** La bande à l'ouverture d'une étape : laquelle, sur quelle largeur de fenêtre, et ce qu'elle laissait. */
export interface OuvertureDeLaBande {
  readonly cle: string
  readonly largeur: number
  readonly fenetre: number
  readonly place: number
}

/** Ce que la bande pose sur la page, et l'ouverture qu'elle retient. */
export interface BandePosee {
  readonly tete: number
  readonly fenetre: number
  readonly place: number
  readonly ouverture: OuvertureDeLaBande | null
}

/**
 * La bande d'une étape (`cle` : la partie, la manche, l'étape ; null entre
 * deux — la révélation, la mise, la pause, que rien n'y règle). Mesurée à son
 * ouverture, elle ne fait plus que se resserrer jusqu'à l'étape suivante : un
 * pied qui grandit — « Pas à pas » ouvert, la carte-bonus encore là — la
 * resserre, pour que la question et la carte tiennent encore ; un pied qui
 * rapetisse ne la regrandit pas. Elle suivait le pied : Éclairer servi, la
 * carte-bonus le quittait, et en 277 × 492 le tableau du Détail regrandissait
 * de onze pixels, ses titres descendus d'autant sous le doigt qui venait
 * d'Éclairer — la carte de l'Épingle passait de 188 à 241 pixels de large (la
 * relecture du lot page-1). La fenêtre de même : la barre d'adresse qui se
 * replie ne regrandit rien. Seule une autre largeur — le téléphone tourné —
 * la remesure. La tête, elle, se suit toujours : la question se colle dessous.
 * Pur.
 */
export function bandeDeLEtape(m: MesureDeLaBande, cle: string | null, avant: OuvertureDeLaBande | null): BandePosee {
  const fenetre = Math.round(m.fenetre)
  const place = Math.max(0, Math.floor(m.fenetre - m.tete - m.pied - m.question - AIR_SOUS_LA_QUESTION))
  if (cle === null) return { tete: m.tete, fenetre, place, ouverture: avant }
  const ouverture = avant && avant.cle === cle && avant.largeur === m.largeur ? avant : { cle, largeur: m.largeur, fenetre, place }
  return { tete: m.tete, fenetre: Math.min(ouverture.fenetre, fenetre), place: Math.min(ouverture.place, place), ouverture }
}

/** Deux boîtes sur la même rangée : leurs hauteurs se croisent de plus d'un demi-pixel — deux boîtes qui se frôlent n'en font pas une. */
export const surLaMemeRangee = (a: BoiteALEcran, b: BoiteALEcran): boolean => a.bottom > b.top + 0.5 && b.bottom > a.top + 0.5

/** La rangée des manches de la tête, telle que `poserLeMotDeQuitter` la lit et y écrit : l'élément même, ou son double dans une épreuve. */
export interface RangeeDeLaTete {
  querySelector(selecteur: string): { getBoundingClientRect(): BoiteALEcran } | null
  readonly dataset: { mot?: string }
}

/**
 * « Quitter » garde son mot tant qu'il tient sur la rangée des manches : le
 * mot montré le temps de la mesure, la rangée dit si « Quitter » passe à la
 * ligne, et le mot se cache alors (`data-mot="cache"`, `styles.css`) — le
 * bouton garde son icône, son nom et la cible d'un doigt. Les requêtes de
 * conteneur le cachent sous une largeur écrite pour les polices d'office :
 * sous le Sommet, l'Horloge, le Ciel, le Film noir ou le Carnet, un total ou
 * un mot plus larges faisaient passer « Quitter » à la ligne en 360 de large,
 * la tête haute de 131 pixels au lieu de 100 (le rendu du 26 octobre 2026), et
 * aucune largeur écrite ne couvre trente-cinq thèmes sans cacher le mot là où
 * il tient — sous l'Ivoire, il lui reste trois pixels. Sans « Quitter » — la
 * partie finie —, rien.
 */
export function poserLeMotDeQuitter(rangee: RangeeDeLaTete): void {
  delete rangee.dataset.mot
  const total = rangee.querySelector('.cab-total')?.getBoundingClientRect()
  const quitter = rangee.querySelector('.cab-quitter')?.getBoundingClientRect()
  if (total && quitter && !surLaMemeRangee(total, quitter)) rangee.dataset.mot = 'cache'
}

/** Ce qu'on écrit d'une boîte : ses propriétés. */
interface Ecrivable {
  readonly style: { setProperty(propriete: string, valeur: string): void }
}

/** La page d'une partie, telle que la bande la lit et y écrit : l'élément même, ou son double dans une épreuve. */
export interface PageDeLaPartie extends Ecrivable {
  querySelector(selecteur: string): object | null
  /** Le zoom posé sur la page — la tablée y pose le texte agrandi : la fenêtre se ramène à ses pixels. */
  readonly currentCSSZoom?: number
  /** Le document qui défile : sa marge d'arrêt du bas (`scroll-padding-bottom`, sur `html`) lit le pied à sa racine. */
  readonly ownerDocument?: { readonly documentElement: Ecrivable } | null
  /** `data-arret="carte"` : l'arrêt sur la carte de l'Épingle armé (`lArretDeLaCarteSArme`), que la feuille lit. */
  readonly dataset?: { arret?: string }
}

/** La hauteur d'une pièce de la page, en pixels de la page (`offsetHeight` : sous le zoom, `getBoundingClientRect` dit des pixels d'écran) ; 0 si elle n'y est pas. */
const hauteurDe = (page: PageDeLaPartie, selecteur: string) => (page.querySelector(selecteur) as { offsetHeight?: number } | null)?.offsetHeight ?? 0

/** La boîte d'une pièce à l'écran, en pixels de l'écran ; null si elle n'y est pas. */
const boiteDe = (page: PageDeLaPartie, selecteur: string) => (page.querySelector(selecteur) as { getBoundingClientRect?(): BoiteALEcran } | null)?.getBoundingClientRect?.() ?? null

/**
 * Arme l'arrêt sur la carte de l'Épingle, ou le désarme (`data-arret`), la carte à sa taille de l'étape : sa place vient d'être
 * posée, et la lire force la mise en page. Refait à chaque mesure, comme la bande : Éclairer servi, la carte-bonus quitte le pied,
 * l'arrêt remonte d'autant et peut tomber dans l'attraction du haut de la page. En pixels de l'écran, ceux du document qui défile :
 * la position de la page s'ajoute à ce que l'écran dit de la carte et du récit, le zoom aux hauteurs de la page.
 */
function armerLArret(page: PageDeLaPartie, fenetre: { readonly innerHeight: number; readonly scrollY?: number }, mesure: MesureDeLaBande, zoom: number) {
  if (!page.dataset) return
  const carte = boiteDe(page, CARTE_JOUABLE)
  const lu = boiteDe(page, LU_AU_DESSUS_DE_LA_QUESTION)
  const defile = fenetre.scrollY ?? 0
  const arme =
    carte !== null &&
    lArretDeLaCarteSArme({ basDeLaCarte: carte.bottom + defile, lecture: lu === null ? 0 : lu.top + defile - mesure.tete * zoom, pied: mesure.pied * zoom, fenetre: fenetre.innerHeight })
  if (arme) page.dataset.arret = 'carte'
  else delete page.dataset.arret
}

/**
 * Mesure la bande et la pose sur la page, en pixels de la page — la fenêtre
 * ramenée à eux : sous le zoom, `100dvh` vaut 1,3 fenêtre. Rend l'ouverture
 * de l'étape, à repasser à la mesure suivante (`bandeDeLEtape`).
 *
 * Le pied et la question collés se posent aussi, tels qu'ils sont : la carte de
 * l'Épingle s'arrête entre eux (`scroll-margin`), quand l'arrêt s'arme
 * (`armerLArret`). Et le pied à la racine du document (`html`), qui défile :
 * une révélation y garde sa hauteur sous ce que la page amène à l'écran
 * (`scroll-padding-bottom`) — posé sur la page seule, `html` ne le voyait pas.
 */
export function poserLaBande(
  page: PageDeLaPartie,
  fenetre: { readonly innerWidth: number; readonly innerHeight: number; readonly scrollY?: number },
  cle: string | null,
  avant: OuvertureDeLaBande | null,
): OuvertureDeLaBande | null {
  const zoom = page.currentCSSZoom || 1
  const mesure = {
    largeur: Math.round(fenetre.innerWidth / zoom),
    fenetre: fenetre.innerHeight / zoom,
    tete: hauteurDe(page, TETE_COLLEE),
    pied: hauteurDe(page, PIED_COLLE),
    question: hauteurDe(page, QUESTION_COLLEE),
  }
  const b = bandeDeLEtape(mesure, cle, avant)
  page.style.setProperty('--cab-tete', `${b.tete}px`)
  page.style.setProperty('--cab-fenetre', `${b.fenetre}px`)
  page.style.setProperty('--cab-place', `${b.place}px`)
  page.style.setProperty('--cab-pied', `${mesure.pied}px`)
  page.style.setProperty('--cab-question', `${mesure.question}px`)
  page.ownerDocument?.documentElement.style.setProperty('--cab-pied', `${mesure.pied}px`)
  armerLArret(page, fenetre, mesure, zoom)
  return b.ouverture
}
