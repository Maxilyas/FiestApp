import { aLaDemande } from './aLaDemande'
import type { SphinxDesMissions } from '../../shared/sphinx'

// Le Sphinx de l'accueil, ce que l'accueil en sait sans le faire venir (le plan
// du 24 novembre 2026, `retours/2026-11-24/le-sphinx/plan.md`) : s'il surgit,
// s'il s'épingle, et de quoi le charger. Léger : l'accueil d'un profil
// l'importe, et l'accueil anonyme avec lui. La visite — sa boîte, son sable,
// ses images, sa police pixel — ne part qu'à la demande (`leSphinx`), quand les
// missions disent qu'il passe (`MissionsDuJour.sphinx`).

/** Ce que l'accueil sait du Sphinx : ce que disent ses missions, ou `parti` — la visite close sur cette page. */
export type SphinxIci = SphinxDesMissions | 'parti'

/**
 * Ce que l'accueil en montre. Une visite qui attend surgit, sauf quand
 * l'accueil propose de revenir à une soirée en cours (« Revenir chez Hugo ») :
 * on revient là pour retourner jouer, et le Sphinx, qui couvrirait tout
 * l'écran, s'y épingle seulement — comme remis à plus tard, sans rien écrire.
 */
export function ceQueMontreLeSphinx(sphinx: SphinxIci | undefined, soireesEnCours: number): { epingle: boolean; surgit: boolean } {
  if (sphinx === 'attend') return soireesEnCours > 0 ? { epingle: true, surgit: false } : { epingle: false, surgit: true }
  return { epingle: sphinx === 'epingle', surgit: false }
}

/**
 * La visite, à la demande : son code et sa feuille ensemble — la feuille porte
 * la police pixel (`components/sphinx.css`), qui ne part qu'avec lui. Ni la
 * soirée, ni l'entrée, ni l'accueil anonyme n'en téléchargent rien
 * (`sphinx-ecran.test.ts`). Jamais importée par un composant : rendue dans
 * Node, une feuille ferait échouer l'import.
 */
export const leSphinx = aLaDemande(() => Promise.all([import('./components/Sphinx'), import('./components/sphinx.css')]).then(([m]) => m))

/** Le stockage du navigateur tel que le Sphinx s'en sert : de quoi le remplacer dans les épreuves. */
type Stockage = Pick<Storage, 'getItem' | 'setItem'>

/** Le stockage du navigateur, s'il y en a un : son accès même peut lever, cookies bloqués. */
function leStockage(): Stockage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/** Son choix du son, retenu sur ce téléphone : `1`, il parle ; rien, il est muet. */
const CLE_DU_SON = 'quizz.sphinx.son'

/**
 * Le Sphinx parle-t-il à voix haute ? Muet par défaut : l'application ne fait
 * jamais sonner un téléphone (`client/src/sound.ts`), et une visite surprise
 * dans un transport ne doit pas biper. Un stockage refusé le laisse muet.
 */
export function sonVoulu(stockage: Stockage | undefined = leStockage()): boolean {
  try {
    return stockage?.getItem(CLE_DU_SON) === '1'
  } catch {
    return false
  }
}

/** Son choix, retenu sur ce téléphone ; un stockage refusé ne le retient que pour cette page. */
export function retenirLeSon(allume: boolean, stockage: Stockage | undefined = leStockage()): void {
  try {
    stockage?.setItem(CLE_DU_SON, allume ? '1' : '0')
  } catch {
    // Refusé : le haut-parleur garde son état le temps de la visite.
  }
}

/** Le jour où sa présentation s'est jouée en entier sur ce téléphone : rouverte le même jour, la visite va droit au but. */
const CLE_DE_LA_PRESENTATION = 'quizz.sphinx.presente'

/** Sa présentation s'est-elle déjà jouée ce jour-là, ici ? */
export function dejaPresente(jour: string, stockage: Stockage | undefined = leStockage()): boolean {
  try {
    return stockage?.getItem(CLE_DE_LA_PRESENTATION) === jour
  } catch {
    return false
  }
}

export function retenirLaPresentation(jour: string, stockage: Stockage | undefined = leStockage()): void {
  try {
    stockage?.setItem(CLE_DE_LA_PRESENTATION, jour)
  } catch {
    // Sans stockage, la présentation se rejouerait à la prochaine visite du jour : rien d'autre ne se perd.
  }
}

/** Ce que la visite laisse à l'album en y menant : la fiche à ouvrir, et le mot à y retourner. */
export interface PourLAlbum {
  divin: string
  mot?: number
}

/** Le temps d'une page : la visite y mène, l'album le lit en s'ouvrant et l'oublie. */
const CLE_DE_L_ALBUM = 'quizz.sphinx.album'

export function retenirPourLAlbum(ce: PourLAlbum): void {
  try {
    sessionStorage.setItem(CLE_DE_L_ALBUM, JSON.stringify(ce))
  } catch {
    // L'album s'ouvrira sur sa page des Divins sans ouvrir la fiche : la phrase y est.
  }
}

/** Ce que la visite a laissé à l'album, lu une fois. */
export function lirePourLAlbum(): PourLAlbum | null {
  try {
    const brut = sessionStorage.getItem(CLE_DE_L_ALBUM)
    sessionStorage.removeItem(CLE_DE_L_ALBUM)
    const ce = brut ? (JSON.parse(brut) as PourLAlbum) : null
    return ce && typeof ce.divin === 'string' ? { divin: ce.divin, ...(typeof ce.mot === 'number' && { mot: ce.mot }) } : null
  } catch {
    return null
  }
}
