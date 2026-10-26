// Ce que le téléphone retient du Cabinet, et rien de plus : la carte-bonus
// choisie la dernière fois, les règles déjà lues, les pas de l'Épingle. Des
// commodités : une chasse, des étoiles, un achat sont au serveur, et rien d'une
// partie ne vit ici (la maquette tenait tout en `localStorage`, et un
// rechargement la rejouait). Chaque accès sous try/catch : des cookies bloqués
// donnaient une page noire (CLAUDE.md) — sans stockage, la page se joue pareil,
// elle oublie seulement.
//
// Chaque clé porte le profil, comme les annonces de l'accueil
// (`quizz.annonces.vues.<profil>`) : sur un téléphone partagé, Hugo héritait
// de la carte-bonus de Léa et de ses règles lues.

const CARTE = 'quizz.cabinet.carte'
const REGLES_LUES = 'quizz.cabinet.regles-lues'
const PAS_A_PAS = 'quizz.cabinet.pas-a-pas'

/**
 * Le profil de la page : celui dont elle lit ce qu'il retient, dès le profil
 * léger lu (`carteRetenue`, `reglesLues`, `CabinetApp.tsx`). L'écran d'un jeu ne
 * le reçoit pas — il n'a que sa manche (`JeuALEcran.localDe`), et aucune vue ne
 * porte le profil — : les pas de l'Épingle se relisent sous lui. Sans profil
 * lu, ils ne se retiennent pas, et rien ne se relit d'un autre.
 */
let profilDeLaPage: string | null = null

/** La clé d'une commodité, au profil — qui devient celui de la page. */
function cleDe(base: string, profil: string): string {
  profilDeLaPage = profil
  return `${base}.${profil}`
}

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle)
  } catch {
    return null
  }
}

function ecrire(cle: string, valeur: string | null) {
  try {
    if (valeur === null) localStorage.removeItem(cle)
    else localStorage.setItem(cle, valeur)
  } catch {
    // Sans stockage, rien ne se retient : la prochaine fois, on choisira de nouveau.
  }
}

/** La carte-bonus retenue : la page la propose d'abord à l'annonce, et le serveur refuse celle qu'il n'a plus. */
export const carteRetenue = (profil: string): string | null => lire(cleDe(CARTE, profil))
export const retenirLaCarte = (profil: string, cle: string | null) => ecrire(cleDe(CARTE, profil), cle)

/** Les règles lues : le musée ne souhaite plus la bienvenue. */
export const reglesLues = (profil: string): boolean => lire(cleDe(REGLES_LUES, profil)) !== null
export const retenirLesRegles = (profil: string) => ecrire(cleDe(REGLES_LUES, profil), '1')

/** Les pas de l'Épingle : « Pas à pas » ouvert, « Grands pas » pressé. */
export interface PasRetenus {
  readonly pasAPas: boolean
  readonly grands: boolean
}

/**
 * Les pas de l'Épingle tels qu'il les a laissés, au profil de la page : chaque
 * manche les rouvrait fermés, à petits pas, et Hugo, au lecteur d'écran, les
 * rouvrait à chaque manche sous un chrono qui courait (la tablée du
 * 26 octobre 2026). Une ligne de mots (« pas-a-pas grands ») : ce qui ne s'y
 * lit pas reste fermé.
 */
export function pasRetenus(): PasRetenus {
  const mots = profilDeLaPage === null ? [] : (lire(`${PAS_A_PAS}.${profilDeLaPage}`) ?? '').split(' ')
  return { pasAPas: mots.includes('pas-a-pas'), grands: mots.includes('grands') }
}

/** Retenir les pas de l'Épingle ; tout fermé, la clé s'efface. */
export function retenirLesPas(pas: PasRetenus) {
  if (profilDeLaPage === null) return
  const mots = [pas.pasAPas && 'pas-a-pas', pas.grands && 'grands'].filter(Boolean).join(' ')
  ecrire(`${PAS_A_PAS}.${profilDeLaPage}`, mots || null)
}
