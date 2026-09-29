// Le thème d'un profil habille son téléphone — la soirée, sa page, le quiz
// du jour —, jamais l'écran commun ni les pages de l'animateur : le thème
// suit la page, pas la personne (`shared/themes.ts`). L'animateur qui en a
// acheté un anime toujours en Velours ou en Ivoire (`theme.ts`), et
// l'invité sans profil joue en Velours.
//
// Chaque thème a sa feuille (`themes/<clé>.css`), chargée à la demande : un
// invité anonyme n'en télécharge aucune. Ce module ne tire pas le catalogue
// (`shared/themes.ts`) : il part avec toutes les pages, et la liste des
// feuilles suffit à dire ce qui existe.

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
  const racine = document.documentElement
  if (cible) racine.dataset.theme = cible
  else delete racine.dataset.theme
  teinterLaBarre(cible)
}

/**
 * Le thème que le serveur dit porté par le profil de ce téléphone — null :
 * Velours, et un invité sans profil. Retenu ici pour le prochain démarrage.
 */
export function porterTheme(cle: string | null | undefined): Promise<void> {
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
 * Au démarrage d'une page de joueur, le dernier thème porté ici, sans
 * attendre le serveur : sinon chaque ouverture passait par Velours avant de
 * se rhabiller. Le profil lu ensuite a le dernier mot (`porterTheme`).
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
