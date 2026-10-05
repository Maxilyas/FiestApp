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
  suivreLHeure(cible)
}

// ── L'heure de Paris ──────────────────────────────────────────────────────
// Trois thèmes peints suivent le temps qu'il fait à Paris : l'Horloge
// astronomique en marque l'heure, le Ciel du jour en prend la lumière, les
// Très Riches Heures en montrent la page du mois (`themes/horloge.css`,
// `ciel.css`, `heures.css`). Une feuille ne sait pas l'heure qu'il est :
// cette horloge la lui pose sur <html> — `data-mois`, `data-ciel`, et les
// angles des aiguilles —, une fois par minute, et seulement tant qu'un de ces
// thèmes est porté. Ce module part avec toutes les pages : pour les autres
// thèmes, une comparaison et rien d'autre, ni minuteur ni calcul de date.

/** Les thèmes dont le décor lit l'heure de Paris. */
const SUIVENT_L_HEURE = new Set(['horloge', 'ciel', 'heures'])

/**
 * Les moments du ciel, à l'heure de Paris : l'aube à 5 h, le jour à 9 h, le
 * crépuscule à 18 h, la nuit à 21 h. D'un moment à l'autre, le décor passe
 * en fondu pendant une heure, à cheval sur la bascule : à 5 h pile, la nuit
 * et l'aube se partagent l'écran.
 */
const MOMENTS: readonly [number, string][] = [
  [5 * 60, 'aube'],
  [9 * 60, 'jour'],
  [18 * 60, 'crepuscule'],
  [21 * 60, 'nuit'],
]
const FONDU_MIN = 60

/** Le moment d'une minute de la journée, et celui vers lequel il fond s'il est près d'une bascule. */
export function momentDuCiel(minutes: number): { ciel: string; vers?: string; fondu?: number } {
  for (let i = 0; i < MOMENTS.length; i++) {
    const [bascule, vers] = MOMENTS[i]
    const ecart = minutes - bascule
    if (Math.abs(ecart) < FONDU_MIN / 2) {
      return { ciel: MOMENTS[(i + MOMENTS.length - 1) % MOMENTS.length][1], vers, fondu: (ecart + FONDU_MIN / 2) / FONDU_MIN }
    }
  }
  // Avant 5 h, c'est encore la nuit de la veille.
  return { ciel: [...MOMENTS].reverse().find(([b]) => minutes >= b)?.[1] ?? 'nuit' }
}

/** La lecture de l'heure de Paris, faite une fois : sa création coûte plus que chaque lecture. */
let paris: Intl.DateTimeFormat | null = null
let minuteur: ReturnType<typeof setTimeout> | undefined
/** Les propriétés posées sur <html>, que l'arrêt retire. */
const PROPRIETES = ['--horloge-heures', '--horloge-minutes', '--ciel-fondu']

/** Le mois (« 10 ») et la minute de la journée à Paris, quelle que soit l'heure du téléphone — heure d'été comprise. */
export function heureDeParis(quand: Date): { mois: string; minutes: number } {
  paris ??= new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const parts = paris.formatToParts(quand)
  const lire = (type: string) => parts.find(p => p.type === type)?.value ?? '0'
  return { mois: lire('month'), minutes: Number(lire('hour')) * 60 + Number(lire('minute')) }
}

/**
 * Pose l'heure de Paris sur <html>. Les aiguilles tournent d'un angle compté
 * depuis minuit (six degrés la minute, un demi pour les heures), qui ne
 * revient en arrière qu'à minuit : compté sur le cadran seul, le passage de
 * 59 à 0 faisait faire à l'aiguille un tour à l'envers. `data-heure-suivie`
 * dit que l'heure suit depuis plus d'une minute : seulement alors les
 * feuilles animent ce qui change — posée d'emblée, une transition faisait
 * tourner les aiguilles depuis midi à l'ouverture de la page — et pas à
 * minuit, où l'angle revient à zéro.
 */
function poserLHeure(premiere: boolean) {
  const { mois, minutes } = heureDeParis(new Date())
  const racine = document.documentElement
  racine.dataset.mois = mois
  racine.style.setProperty('--horloge-minutes', `${minutes * 6}deg`)
  racine.style.setProperty('--horloge-heures', `${minutes / 2}deg`)
  const { ciel, vers, fondu } = momentDuCiel(minutes)
  racine.dataset.ciel = ciel
  if (vers) {
    racine.dataset.cielVers = vers
    racine.style.setProperty('--ciel-fondu', fondu!.toFixed(3))
  } else {
    delete racine.dataset.cielVers
    racine.style.removeProperty('--ciel-fondu')
  }
  if (premiere || minutes === 0) delete racine.dataset.heureSuivie
  else racine.dataset.heureSuivie = ''
}

/** Une page qui revient au premier plan : ses minuteurs ont pu dormir, l'heure se relit tout de suite. */
function auRetour() {
  if (document.visibilityState === 'visible' && minuteur !== undefined) poserLHeure(false)
}

/** Lance l'horloge si ce thème en a besoin, l'arrête sinon. */
function suivreLHeure(cible: string | null) {
  const voulue = cible !== null && SUIVENT_L_HEURE.has(cible)
  if (voulue === (minuteur !== undefined)) return
  const racine = document.documentElement
  if (!voulue) {
    clearTimeout(minuteur)
    minuteur = undefined
    document.removeEventListener('visibilitychange', auRetour)
    for (const cle of ['mois', 'ciel', 'cielVers', 'heureSuivie']) delete racine.dataset[cle]
    for (const p of PROPRIETES) racine.style.removeProperty(p)
    return
  }
  const prochaine = () => {
    // À la minute pile (et un souffle) : Paris change de minute en même temps que l'horloge du téléphone.
    minuteur = setTimeout(
      () => {
        poserLHeure(false)
        prochaine()
      },
      60_000 - (Date.now() % 60_000) + 50,
    )
  }
  poserLHeure(true)
  prochaine()
  document.addEventListener('visibilitychange', auRetour)
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
