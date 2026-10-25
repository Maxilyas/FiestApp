// Ce que le téléphone retient du Cabinet, et rien de plus : la carte-bonus
// choisie la dernière fois, les règles déjà lues, l'annonce des œuvres
// rapportées de l'Expédition déjà vue. Des commodités : une chasse, des
// étoiles, un achat sont au serveur, et rien d'une partie ne vit ici (la
// maquette tenait tout en `localStorage`, et un rechargement la rejouait).
// Chaque accès sous try/catch : des cookies bloqués donnaient une page noire
// (CLAUDE.md) — sans stockage, la page se joue pareil, elle oublie seulement.

const CARTE = 'quizz.cabinet.carte'
const REGLES_LUES = 'quizz.cabinet.regles-lues'
const ACCUEIL_VU = 'quizz.cabinet.accueil-vu'

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
export const carteRetenue = (): string | null => lire(CARTE)
export const retenirLaCarte = (cle: string | null) => ecrire(CARTE, cle)

/** Les règles lues : le musée ne souhaite plus la bienvenue. */
export const reglesLues = (): boolean => lire(REGLES_LUES) !== null
export const retenirLesRegles = () => ecrire(REGLES_LUES, '1')

/** Les œuvres rapportées de l'Expédition, annoncées d'un seul coup : le nombre déjà dit, pour ne pas le redire. */
export const rapporteesVues = (): number => Number.parseInt(lire(ACCUEIL_VU) ?? '0', 10) || 0
export const retenirLesRapportees = (n: number) => ecrire(ACCUEIL_VU, String(n))
