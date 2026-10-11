// Les duels classés (le souhait du propriétaire du 11 octobre 2026 : « Défier
// un joueur » hors de la campagne, une tuile de l'accueil sous le quiz du
// jour, « un classement ELO et des récompenses par semaine avec des ligues »).
//
// Un duel classé, c'est « Trouver un adversaire » : la série finie d'un autre
// joueur, rejouée — ses questions, dans le même ordre, son score à battre
// (`mode = 'rencontre'`, `shared/campagne.ts`). L'adversaire n'est pas là : il
// a joué sa série un autre jour, pour lui. Ce qu'on affronte, c'est donc son
// score sur ces questions, et sa cote est celle de ce score (`coteDuScore`) —
// battre douze bonnes réponses vaut plus que battre six, qui que soit celui
// qui les a faites. Seule la cote de celui qui joue bouge : personne ne perd
// de points pendant qu'il dort, et rien ne passe d'un profil à l'autre —
// perdre exprès contre son second profil ne donne rien au premier, et battre
// un score faible ne rapporte presque rien.
//
// Les défis entre amis restent amicaux : on y joue les questions d'un autre
// après lui, et un second profil y soufflerait toutes les réponses au premier.
//
// Tout se relit dans le journal des rencontres finies (`releverLesDuels`) : la
// cote, les ligues de chaque semaine, les confettis qu'elles ont payés. Une
// règle changée vaut aussitôt pour tout ce qui a été joué, comme les
// confettis des soirées — rien ne se tient à côté.

import type { Adversaire, ResumeDeRencontre, RencontreDeCampagne } from './campagne'
import type { Finition } from './profil'
import type { LaurierPorte } from './jour'

/** La cote de tout le monde au premier duel : celle d'un joueur qui finit sa série vers huit bonnes réponses. */
export const COTE_DE_DEPART = 1000

/** Le score qui vaut la cote de départ — la marche des moyennes, le niveau d'un joueur sans série (`niveauPourUneRencontre`). */
export const SCORE_DE_REFERENCE = 8

/** Ce que vaut une bonne réponse de plus dans la série d'en face : cent points, deux bonnes réponses, une ligue. */
export const POINTS_PAR_BONNE_REPONSE = 50

/**
 * Le poids d'un duel (le K de l'ELO) : ses dix premiers comptent double, de
 * quoi trouver vite sa ligue ; ensuite, un duel à égalité de chances vaut
 * douze points.
 */
export const DUELS_DE_PLACEMENT = 10
export const POIDS_DU_PLACEMENT = 48
export const POIDS_D_UN_DUEL = 24

/** Les duels d'une semaine qui ouvrent sa récompense : de quoi jouer, pas de quoi passer. */
export const DUELS_POUR_LA_RECOMPENSE = 3

/** Le classement ne nomme que ceux qui ont joué ces quatre dernières semaines : un ancien premier ne tient pas la tête pour toujours. */
export const JOURS_DU_CLASSEMENT = 28

/** Ce que le classement montre ; au-delà, sa propre ligne à part — comme au défi de la semaine. */
export const LIGNES_DU_CLASSEMENT = 50

export type CleDeLigue = 'bronze' | 'argent' | 'or' | 'platine' | 'diamant' | 'maitre'

export interface Ligue {
  cle: CleDeLigue
  /** « Ligue d’or » : son nom, dans une phrase. */
  nom: string
  /** « Or » : sur un blason, dans une ligne de classement. */
  court: string
  /** La cote à partir de laquelle on y est. */
  depuis: number
  /** Ce qu'elle rapporte chaque lundi, à qui a joué ses duels de la semaine (`DUELS_POUR_LA_RECOMPENSE`). */
  confettis: number
}

/**
 * Les ligues, de la plus basse à la plus haute : une tous les cent points —
 * deux bonnes réponses de mieux, en moyenne, dans sa série —, dix confettis
 * de plus chaque semaine à chacune. Des choix de produit, à régler sur les
 * vraies cotes : tout se relit à chaque lecture.
 */
export const LIGUES: readonly Ligue[] = [
  { cle: 'bronze', nom: 'Ligue de bronze', court: 'Bronze', depuis: Number.NEGATIVE_INFINITY, confettis: 10 },
  { cle: 'argent', nom: 'Ligue d’argent', court: 'Argent', depuis: 1100, confettis: 20 },
  { cle: 'or', nom: 'Ligue d’or', court: 'Or', depuis: 1200, confettis: 30 },
  { cle: 'platine', nom: 'Ligue de platine', court: 'Platine', depuis: 1300, confettis: 40 },
  { cle: 'diamant', nom: 'Ligue de diamant', court: 'Diamant', depuis: 1400, confettis: 50 },
  { cle: 'maitre', nom: 'Ligue des maîtres', court: 'Maîtres', depuis: 1500, confettis: 60 },
]

const PAR_CLE = new Map(LIGUES.map(l => [l.cle, l]))

/** Une ligue par sa clé ; une clé inconnue (une page d'avant, une règle changée) tombe en bronze. */
export const ligueParCle = (cle: unknown): Ligue => PAR_CLE.get(cle as CleDeLigue) ?? LIGUES[0]

/** La ligue d'une cote. */
export function ligueDe(cote: number): Ligue {
  let l = LIGUES[0]
  for (const x of LIGUES) if (cote >= x.depuis) l = x
  return l
}

/** La ligue d'au-dessus, ou null : on est déjà tout en haut. */
export function ligueSuivante(l: Ligue): Ligue | null {
  return LIGUES[LIGUES.indexOf(l) + 1] ?? null
}

/** La cote d'un score à battre : ce que vaut une série finie avec `justes` bonnes réponses. */
export const coteDuScore = (justes: number): number => COTE_DE_DEPART + POINTS_PAR_BONNE_REPONSE * (justes - SCORE_DE_REFERENCE)

/** Le score qu'une cote vaut, à l'inverse : le niveau des adversaires qu'on lui cherche. */
export const niveauDeLaCote = (cote: number): number => SCORE_DE_REFERENCE + (cote - COTE_DE_DEPART) / POINTS_PAR_BONNE_REPONSE

/**
 * Le niveau des adversaires qu'on lui cherche : pendant son placement, celui
 * de ses séries de la campagne (`niveauPourUneRencontre`) — des parties
 * serrées dès le premier duel, quand sa cote ne dit encore rien de lui ;
 * ensuite, celui de sa cote, qui a appris de ses duels.
 */
export const niveauPourLeDuel = (joues: number, cote: number, niveauDeCampagne: number): number =>
  joues < DUELS_DE_PLACEMENT ? niveauDeCampagne : niveauDeLaCote(cote)

/** Ses chances de gagner, à la manière de l'ELO : 0,5 à cotes égales, 0,24 contre deux cents points de plus. */
export const chancesDeGagner = (cote: number, adverse: number): number => 1 / (1 + 10 ** ((adverse - cote) / 400))

/** Le poids d'un duel selon ceux déjà joués : double pendant le placement. */
export const poidsDuDuel = (dejaJoues: number): number => (dejaJoues < DUELS_DE_PLACEMENT ? POIDS_DU_PLACEMENT : POIDS_D_UN_DUEL)

/** Gagné, égalité, perdu : ce que vaut l'issue d'un duel. */
export type Resultat = 1 | 0.5 | 0

export const resultatDuDuel = (toi: number, lui: number): Resultat => (toi > lui ? 1 : toi === lui ? 0.5 : 0)

/**
 * Ce qu'un duel fait à la cote, en points entiers : ce qu'on affiche est ce
 * qui compte — « +14 » ajoute quatorze, et la cote ne garde pas de virgule
 * qui ferait mentir la somme des écarts.
 */
export function ecartDuDuel(cote: number, sesJustes: number, dejaJoues: number, resultat: Resultat): number {
  return Math.round(poidsDuDuel(dejaJoues) * (resultat - chancesDeGagner(cote, coteDuScore(sesJustes))))
}

/** Ce qu'un duel met en jeu, dit avant de le jouer : sa cote, et ce que lui ferait chaque issue. */
export interface EnjeuDuDuel {
  cote: number
  gagne: number
  egalite: number
  perdu: number
}

export function enjeuDuDuel(cote: number, sesJustes: number, dejaJoues: number): EnjeuDuDuel {
  return {
    cote,
    gagne: ecartDuDuel(cote, sesJustes, dejaJoues, 1),
    egalite: ecartDuDuel(cote, sesJustes, dejaJoues, 0.5),
    perdu: ecartDuDuel(cote, sesJustes, dejaJoues, 0),
  }
}

/** Un duel classé fini, tel que le journal le garde : sa série, ses bonnes réponses, celles du score à battre, quand il a fini. */
export interface DuelJoue {
  serie: string
  justes: number
  sesJustes: number
  finiLe: number
}

/** Une semaine de duels : combien, et la meilleure cote qu'elle a vue — celle du lundi comprise. */
export interface SemaineJouee {
  duels: number
  meilleure: number
}

/** Ce que ses duels disent de lui : sa cote, et de quoi raconter chaque duel et chaque semaine. */
export interface ReleveDesDuels {
  cote: number
  joues: number
  /** L'écart de chaque duel, sous sa série : ce que sa fin a dit, et sa ligne dans la liste. */
  ecarts: Map<string, { avant: number; ecart: number }>
  semaines: Map<string, SemaineJouee>
  /** Son premier duel fini : deux homonymes au classement, le second arrivé porte la marque. */
  premierLe: number | null
  /** Son dernier duel fini, ou null : le classement ne nomme que ceux qui jouent encore. */
  dernierLe: number | null
}

/**
 * Relit ses duels, du plus ancien au plus récent : la cote part de
 * `COTE_DE_DEPART`, chaque duel la déplace de son écart. Chaque semaine
 * (`semaineDe`, le lundi de Paris) retient ses duels et la meilleure cote
 * qu'elle a vue — celle qu'il avait en y entrant comprise : il était dans sa
 * ligue avant de jouer, et un duel perdu le lundi ne lui reprend pas sa
 * récompense.
 */
export function releverLesDuels(duels: readonly DuelJoue[], semaineDe: (instant: number) => string): ReleveDesDuels {
  const ordre = [...duels].sort((a, b) => a.finiLe - b.finiLe || (a.serie < b.serie ? -1 : a.serie > b.serie ? 1 : 0))
  let cote = COTE_DE_DEPART
  const ecarts = new Map<string, { avant: number; ecart: number }>()
  const semaines = new Map<string, SemaineJouee>()
  ordre.forEach((d, i) => {
    const ecart = ecartDuDuel(cote, d.sesJustes, i, resultatDuDuel(d.justes, d.sesJustes))
    const semaine = semaineDe(d.finiLe)
    const s = semaines.get(semaine) ?? { duels: 0, meilleure: cote }
    ecarts.set(d.serie, { avant: cote, ecart })
    cote += ecart
    semaines.set(semaine, { duels: s.duels + 1, meilleure: Math.max(s.meilleure, cote) })
  })
  return {
    cote,
    joues: ordre.length,
    ecarts,
    semaines,
    premierLe: ordre.length > 0 ? ordre[0].finiLe : null,
    dernierLe: ordre.length > 0 ? ordre[ordre.length - 1].finiLe : null,
  }
}

/** La ligue qu'une semaine retient : la meilleure qu'elle a vue — sans duel, celle qu'il avait. */
export const ligueDeLaSemaine = (s: SemaineJouee | undefined, cote: number): Ligue => ligueDe(s ? s.meilleure : cote)

/** Ce qu'une semaine rapporte : sa meilleure ligue, si elle a eu ses duels. */
export function recompenseDeLaSemaine(s: SemaineJouee | undefined): number {
  return s && s.duels >= DUELS_POUR_LA_RECOMPENSE ? ligueDe(s.meilleure).confettis : 0
}

/**
 * Les confettis de ses ligues : chaque semaine close — avant `semaineEnCours`
 * — qui a eu ses duels paie sa meilleure ligue. Celle qui se joue encore ne
 * paie qu'au lundi : sa meilleure ligue peut encore monter.
 */
export function confettisDesLigues(r: Pick<ReleveDesDuels, 'semaines'>, semaineEnCours: string): number {
  let n = 0
  for (const [semaine, s] of r.semaines) if (semaine < semaineEnCours) n += recompenseDeLaSemaine(s)
  return n
}

/** Cette semaine, telle que sa page la dit : ses duels, sa meilleure ligue, ce qu'elle rapportera lundi, et quand. */
export interface SemaineDesDuels {
  duels: number
  ligue: CleDeLigue
  /** Ce que sa meilleure ligue rapportera lundi, ses duels joués (`DUELS_POUR_LA_RECOMPENSE`). */
  confettis: number
  minutesRestantes: number
}

/** Ce qu'un duel classé fini dit de sa cote : avant, après, l'écart, sa ligue — et sa semaine. */
export interface CoteApresLeDuel {
  avant: number
  apres: number
  ecart: number
  ligueAvant: CleDeLigue
  ligue: CleDeLigue
  semaine: SemaineDesDuels
}

/** Une ligne du classement des duels : comme celle du défi, sa cote et sa ligue au lieu de bonnes réponses. */
export interface LigneDesDuels {
  profileId: string
  /** Le prénom de son profil, marque d'homonymie comprise. */
  nom: string
  avatar: string
  niveau: number
  finition?: Finition
  legendaire?: string
  eclat?: true
  laurier?: LaurierPorte
  cote: number
  ligue: CleDeLigue
  rang: number
  /** Ses duels classés, tous : un débutant chanceux se distingue d'un habitué. */
  duels: number
}

export interface ClassementDesDuels {
  joueurs: number
  lignes: LigneDesDuels[]
  /** Sa ligne, si elle n'est pas dans celles qu'on montre. */
  moi?: LigneDesDuels
  /** Qui regarde, s'il est classé : sa ligne se distingue. */
  sienne?: string
}

/** La page des duels (`GET /api/duels`) : sa cote, sa semaine, le classement, sa rencontre en route et les dernières. */
export interface EtatDesDuels {
  cote: number
  ligue: CleDeLigue
  joues: number
  semaine: SemaineDesDuels
  /** La semaine passée, si elle a payé : sa ligue, ses duels, ses confettis. */
  semainePassee?: { ligue: CleDeLigue; duels: number; confettis: number }
  classement: ClassementDesDuels
  /** Son duel laissé en route : il se reprend. */
  enCours: RencontreDeCampagne | null
  dernieres: ResumeDeRencontre[]
}

/**
 * Le bouton des duels sur l'accueil (`ProfilDAccueil.duels`) : sa ligue et
 * sa cote, sa semaine ; un défi qu'un ami lui a envoyé, et son duel laissé
 * en route, qui passent devant.
 */
export interface DuelsDAccueil {
  cote: number
  ligue: CleDeLigue
  joues: number
  /** Sa semaine : ses duels — la récompense de lundi en demande `DUELS_POUR_LA_RECOMPENSE` —, et sa meilleure ligue, qui la fixe. */
  semaine: Pick<SemaineDesDuels, 'duels' | 'ligue'>
  defisRecus?: { n: number; de: string }
  /** Son duel laissé en route : contre qui. */
  enCours?: Pick<Adversaire, 'nom'>
}
