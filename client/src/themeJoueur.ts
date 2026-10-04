// Le thème d'un profil habille toutes ses pages, sur l'appareil où il est
// connecté — l'accueil, sa page, la boutique, ses quiz, son compte, son
// salon, la soirée, le quiz du jour, la campagne, le souvenir et le bilan —,
// jamais l'écran commun, que la salle regarde : là, l'animateur qui en a
// acheté un anime en Velours ou en Ivoire (`theme.ts`). Le thème suit la
// personne, plus la page (le choix du 4 octobre 2026 : les pièces du menu
// changeaient d'habit d'un toucher à l'autre). L'invité sans profil reste en
// Velours.
//
// Chaque thème a sa feuille (`themes/<clé>.css`), chargée à la demande : un
// invité anonyme n'en télécharge aucune. Ce module ne tire ni le catalogue
// (`shared/themes.ts`) ni le client d'API : il part avec toutes les pages,
// et la liste des feuilles suffit à dire ce qui existe.

/**
 * Les feuilles des thèmes : Vite en fait autant de morceaux, qui ne partent
 * qu'à la demande. Hors de Vite — les tests chargent les pages dans Node, où
 * `import.meta.glob` n'existe pas —, aucune : la page reste en Velours.
 */
const FEUILLES: Record<string, () => Promise<unknown>> = import.meta.env ? import.meta.glob('./themes/*.css') : {}

/** Le dernier thème porté sur ce téléphone : posé dès le démarrage, sans attendre le serveur. */
const CLE = 'quizz.theme-joueur'

/** La couleur de la barre du navigateur que pose la page, celle de Velours (`index.html`). */
let barreDeVelours: string | null = null
/** La dernière demande : un thème arrivé en retard ne remplace pas celui qu'on vient de choisir. */
let demande = 0
/** Les thèmes que la page a lus du profil (`porterTheme`) : une confirmation partie avant eux n'a plus rien à dire. */
let lus = 0
/** Le thème du profil, posé sur la page — null : Velours. */
let porte: string | null = null
/** L'habit de l'écran commun, le temps d'un aperçu (`commeLEcranCommun`) : il passe devant le thème du profil. */
let apercu: 'velours' | 'ivoire' | null = null

/**
 * Au-delà, la confirmation s'abandonne et le thème retenu reste. Rien
 * n'attend après elle : elle ne fait que l'habillage, mais une requête qui ne
 * revient jamais ne doit rien laisser en vol.
 */
const DELAI_CONFIRMATION_MS = 20_000

/** Un thème que ce téléphone sait porter : Ivoire (dans `styles.css`), ou l'un de ceux qui ont leur feuille. */
function connu(cle: unknown): cle is string {
  return typeof cle === 'string' && (cle === 'ivoire' || `./themes/${cle}.css` in FEUILLES)
}

/**
 * Teinte la barre du navigateur au fond du thème : un bandeau sombre
 * au-dessus d'un cahier d'écolier se voyait comme un défaut.
 */
function teinterLaBarre(cle: string | null) {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  barreDeVelours ??= meta.getAttribute('content')
  const fond = cle ? getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() : ''
  const teinte = fond || barreDeVelours
  if (teinte) meta.setAttribute('content', teinte)
}

/** L'attribut que lisent les feuilles des thèmes, et la barre du navigateur qui suit. */
function habiller(cible: string | null) {
  const racine = document.documentElement
  if (cible) racine.dataset.theme = cible
  else delete racine.dataset.theme
  teinterLaBarre(cible)
}

/**
 * Pose un thème sur la page : sa feuille d'abord, l'attribut ensuite — posé
 * avant, il laissait un instant les couleurs du thème sur les polices et le
 * décor de Velours. Velours, ou un thème inconnu de cette version de la page,
 * retire l'attribut. Une feuille qui ne vient pas (un déploiement l'a
 * remplacée) laisse la page comme elle était.
 */
async function poser(cle: string | null): Promise<void> {
  const numero = ++demande
  const cible = cle && cle !== 'velours' && connu(cle) ? cle : null
  if (cible && cible !== 'ivoire') {
    try {
      await FEUILLES[`./themes/${cible}.css`]()
    } catch {
      return
    }
  }
  if (numero !== demande) return
  porte = cible
  // Un aperçu de l'écran commun ouvert garde son habit : le thème attend sa fermeture.
  if (apercu === null) habiller(cible)
}

/**
 * Le temps d'un aperçu de l'écran commun (« Mes quiz »), la page prend son
 * habit — Velours, ou Ivoire si l'animateur projette en Ivoire (`theme.ts`) :
 * sous le thème du profil, l'aperçu montrait une question que la salle ne
 * verra jamais ainsi. Rend de quoi remettre le thème du profil.
 */
export function commeLEcranCommun(habit: 'velours' | 'ivoire'): () => void {
  apercu = habit
  habiller(habit === 'ivoire' ? 'ivoire' : null)
  return () => {
    apercu = null
    habiller(porte)
  }
}

/**
 * Le thème que le serveur dit porté par le profil connecté ici — null :
 * Velours, et un invité sans profil. Retenu ici pour le prochain démarrage.
 */
export function porterTheme(cle: string | null | undefined): Promise<void> {
  lus++
  try {
    if (cle && cle !== 'velours') localStorage.setItem(CLE, cle)
    else localStorage.removeItem(CLE)
  } catch {
    // Stockage indisponible : le thème vaut pour cette page, et le prochain
    // démarrage attendra le serveur.
  }
  return poser(cle ?? null)
}

/**
 * Au démarrage d'une page, le dernier thème porté ici, sans attendre le
 * serveur : sinon chaque ouverture passait par Velours avant de se rhabiller.
 * Le profil lu ensuite a le dernier mot (`porterTheme`, `confirmerTheme`).
 */
export function poserThemeRetenu(): void {
  let cle: string | null = null
  try {
    cle = localStorage.getItem(CLE)
  } catch {
    return
  }
  if (cle) void poser(cle)
}

/**
 * Le thème du profil connecté ici, demandé au serveur, pour les pages qui ne
 * lisent pas le profil — ses quiz, son compte, le souvenir et le bilan d'une
 * soirée… : celui retenu au démarrage peut dater d'un thème changé sur un
 * autre téléphone, ou d'une session close depuis — et un profil connecté par
 * `/connexion`, qui n'a vu aucune de ses pages ici, n'en a pas encore retenu.
 * Le profil que la page a lu entre-temps a le dernier mot ; sans réponse —
 * hors ligne, un serveur d'avant —, le thème retenu reste.
 */
export async function confirmerTheme(): Promise<void> {
  const avant = lus
  const abandon = new AbortController()
  const minuteur = setTimeout(() => abandon.abort(), DELAI_CONFIRMATION_MS)
  try {
    const res = await fetch('/api/joueur/theme', { credentials: 'same-origin', signal: abandon.signal })
    if (!res.ok) return
    const { theme } = (await res.json()) as { theme?: unknown }
    if (lus !== avant) return
    await porterTheme(typeof theme === 'string' ? theme : null)
  } catch {
    // Réseau coupé, réponse illisible : l'habillage reste celui du démarrage.
  } finally {
    clearTimeout(minuteur)
  }
}
