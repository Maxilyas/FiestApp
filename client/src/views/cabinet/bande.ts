// La bande d'une manche : ce que la tête et le pied collés d'une partie
// laissent à l'écran. La question collée de l'Épingle et sa carte, le tableau
// du Détail s'y règlent (`--cab-tete`, `--cab-fenetre`, `--cab-place`,
// `styles.css`) ; la ligne à taper du Mot s'y ramène (`bandeALEcran`). Au
// petit téléphone, le texte agrandi, la question et la carte ne tenaient
// jamais ensemble, ni le tableau et ses titres (la tablée du 25 octobre 2026).
//
// Une seule copie de ce qui la borne : la partie, le Mot et le rendu
// (`server/scripts/rendu-cabinet.ts`) la lisaient chacun à sa façon. Sans
// rien du DOM dans ses types : le rendu l'importe sous Node, et une épreuve
// la pose sur un faux élément.

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

/** La page d'une partie, telle que la bande la lit et y écrit : l'élément même, ou son double dans une épreuve. */
export interface PageDeLaPartie {
  querySelector(selecteur: string): object | null
  /** Le zoom posé sur la page — la tablée y pose le texte agrandi : la fenêtre se ramène à ses pixels. */
  readonly currentCSSZoom?: number
  readonly style: { setProperty(propriete: string, valeur: string): void }
}

/** La hauteur d'une pièce de la page, en pixels de la page (`offsetHeight` : sous le zoom, `getBoundingClientRect` dit des pixels d'écran) ; 0 si elle n'y est pas. */
const hauteurDe = (page: PageDeLaPartie, selecteur: string) => (page.querySelector(selecteur) as { offsetHeight?: number } | null)?.offsetHeight ?? 0

/**
 * Mesure la bande et la pose sur la page, en pixels de la page — la fenêtre
 * ramenée à eux : sous le zoom, `100dvh` vaut 1,3 fenêtre. Rend l'ouverture
 * de l'étape, à repasser à la mesure suivante (`bandeDeLEtape`).
 */
export function poserLaBande(
  page: PageDeLaPartie,
  fenetre: { readonly innerWidth: number; readonly innerHeight: number },
  cle: string | null,
  avant: OuvertureDeLaBande | null,
): OuvertureDeLaBande | null {
  const zoom = page.currentCSSZoom || 1
  const b = bandeDeLEtape(
    {
      largeur: Math.round(fenetre.innerWidth / zoom),
      fenetre: fenetre.innerHeight / zoom,
      tete: hauteurDe(page, TETE_COLLEE),
      pied: hauteurDe(page, PIED_COLLE),
      question: hauteurDe(page, QUESTION_COLLEE),
    },
    cle,
    avant,
  )
  page.style.setProperty('--cab-tete', `${b.tete}px`)
  page.style.setProperty('--cab-fenetre', `${b.fenetre}px`)
  page.style.setProperty('--cab-place', `${b.place}px`)
  return b.ouverture
}
