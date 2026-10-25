// Ce que le téléphone retient du Cabinet, et rien de plus : la carte-bonus
// choisie la dernière fois, les règles déjà lues, l'annonce des œuvres
// rapportées de l'Expédition déjà vue. Des commodités : une chasse, des
// étoiles, un achat sont au serveur, et rien d'une partie ne vit ici (la
// maquette tenait tout en `localStorage`, et un rechargement la rejouait).
// Chaque accès sous try/catch : des cookies bloqués donnaient une page noire
// (CLAUDE.md) — sans stockage, la page se joue pareil, elle oublie seulement.
//
// Chaque clé porte le profil, comme les annonces de l'accueil
// (`quizz.annonces.vues.<profil>`) : sur un téléphone partagé, Hugo héritait
// de la carte-bonus de Léa et de ses règles lues, et ses douze œuvres
// rapportées ne s'annonçaient jamais — 12 n'est pas plus que les 41 de Léa.

const CARTE = 'quizz.cabinet.carte'
const REGLES_LUES = 'quizz.cabinet.regles-lues'
const ACCUEIL_VU = 'quizz.cabinet.accueil-vu'

const cleDe = (base: string, profil: string) => `${base}.${profil}`

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

/** Les œuvres rapportées de l'Expédition, annoncées d'un seul coup : le nombre déjà dit, pour ne pas le redire. */
export const rapporteesVues = (profil: string): number => Number.parseInt(lire(cleDe(ACCUEIL_VU, profil)) ?? '0', 10) || 0
export const retenirLesRapportees = (profil: string, n: number) => ecrire(cleDe(ACCUEIL_VU, profil), String(n))
