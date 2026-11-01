// Une partie du Cabinet, de son départ à son bilan : un pli pur du départ figé
// et des gestes reçus (`pliDeLaPartie`, D2). Le serveur garde le résultat en
// mémoire, et le refait à la relecture d'une partie — un rechargement, un
// réveil, une mise en ligne qui fait vivre deux serveurs un instant — : rien
// d'une manche ne vit ailleurs que dans ses gestes écrits. Une manche reprend
// donc à l'instant de son chrono, avec ses essais et ses indices déjà vus ;
// elle ne se rouvre jamais avec un chrono neuf.
//
// Le départ (`DepartDUnePartie`) fige tout ce qui se tire, réponses comprises :
// les trois manches et les rechanges de « Changer » (`tirages`), la carte-bonus
// et sa force, le seuil, le chrono — chaque durée, la grâce, la pause —, et la
// graine du hasard d'Éclairer. Cette graine est
// un secret du serveur, tirée au départ (`randomUUID`) : jamais envoyée, ni
// faite de ce que la page connaît — son profil, sa partie, le rang de ses
// gestes. Faite d'eux (la conception d'abord : `${profileId}:${serieId}`), la
// page aurait refait le hasard d'Éclairer et lu, de la mauvaise réponse
// effacée, où est la bonne. L'Épingle et la Réplique, en plus, figent leur
// effet dans leur tirage : les deux remèdes se cumulent.
//
// Les gestes (`GesteDuCabinet`) se relisent d'abord (`lireUnGeste`,
// `lecture.ts`), puis passent ici, un par un, à l'heure d'arrivée que le
// serveur a prise avant son verrou : la règle du jeu (`jeux/`) juge, le pli
// tient les chronos, les pouvoirs, les pièces et la fin. Un geste qui se
// refuse rend son refus en mots (`refusDuGeste`, la seule règle : la vue la
// porte, la page n'en recopie rien) et rien ne s'écrit. Aucune minuterie : une
// manche expirée se juge au geste suivant — la page envoie d'elle-même sa
// réponse à l'échéance, `quitter` et `clore` en jugent aussi.
//
// Ce que le pli tranche, il le range en pièces (`PieceJugee`), dans l'ordre de
// leur verdict : la position d'une réponse au journal est l'indice de sa pièce
// dans `campagne_series.questions`. Le serveur écrit celles qui viennent
// d'apparaître ; le pli ne sait rien de la base.
//
// Pur : jamais l'horloge de la machine ni un hasard qui ne se rejoue pas. Une
// partie finie et la partie en cours passent par le même pli, la même vue, le
// même cartel (invariant 14) : une amélioration de la révélation profite aux
// parties d'avant — le cartel d'une œuvre et « Mes réponses » repassent par le
// départ et les gestes d'une partie finie, aussi vieille soit-elle. Ce qu'un
// barème changé ferait à une partie déjà commencée se règle donc au départ :
// ce qui se fige s'y fige (le seuil, le chrono) ; ce que le pli juge au barème
// du code — un barème de manche, ce que fait un pouvoir — monte la version du
// départ (`VERSIONS_DU_DEPART`) et garde la règle d'avant sous la sienne.

import type { Niveau } from '../campagne'
import { hasardDe } from '../missions'
import {
  ETOILES_D_UNE_PARTIE,
  GRACE_D_UNE_MANCHE_MS,
  MANCHES_PAR_PARTIE,
  MARCHES_DES_ENJEUX,
  MISES_PAR_EPREUVE,
  PAUSE_MAX_MS,
  PAUSES_PAR_MANCHE,
  POUSSIERE_DU_DOUBLE,
  POUSSIERE_MIN,
  POUSSIERE_PAR_ETOILE,
  SECONDES_PAR_FORCE,
} from './bareme'
import { dansLesTemps, etapeOuverte, limiteDe, pauseCompteeMs, pauseEnCours, pauseLaisseeMs, type EtapeChronometree } from './chrono'
import { oeuvre } from './oeuvres'
import { JOKER_DU_TEMPS, JOKER_D_ECLAIRER, type PieceDuCabinet } from './pieces'
import { etoilesApresLesPouvoirs, mancheProtegee, refusDuPouvoir, type CleDePouvoir, type Force } from './pouvoirs'
import { regleDe, type ContenuTire } from './jeux/index'
import { eclairerSertEncore } from './jeux/outils'
import type { TailleDuFilet } from './jeux/filet'
import { trancheLaManche, type CleDeJeu, type VerdictDUneManche } from './jeux/regle'

// ── Le départ ─────────────────────────────────────────────────────────────

/**
 * Les versions de départ que ce code relit et joue, de la première à celle des
 * parties qui commencent — écrites en dur, jamais dérivées de la dernière : le
 * cartel d'une œuvre et « Mes réponses » relisent le départ d'une partie finie,
 * et une version qui quitterait la liste les rendrait illisibles (l'Expédition
 * a perdu ses bilans à une v8 oubliée). Une version s'ajoute quand une règle
 * change ce qu'une partie déjà commencée juge au barème du code — un barème de
 * manche, ce que fait un pouvoir, une forme de tirage, toute retouche de la
 * Frise — ; la règle d'avant se garde alors sous la sienne, et le pli la
 * choisit par `d.v`. Une durée, la grâce, la pause n'en demandent pas : elles
 * se figent au départ (`ChronoDuDepart`).
 */
export const VERSIONS_DU_DEPART = [1, 2, 3] as const
export type VersionDuDepart = (typeof VERSIONS_DU_DEPART)[number]
/** Celle des parties qui commencent : la dernière de la liste. */
export const VERSION_DU_DEPART: VersionDuDepart = VERSIONS_DU_DEPART[VERSIONS_DU_DEPART.length - 1]

/**
 * Les versions de bilan que ce code relit, de la même façon : écrites en dur.
 * Un bilan est un fait de sa partie, jamais réécrit ; sa version monte quand sa
 * forme change, ou quand le barème du jour sortirait des bornes de la sienne
 * (`BORNES_DES_BILANS`, `lecture.ts`). Son nom dit le Cabinet : l'Expédition a
 * la sienne (`VERSION_DU_BILAN`, `shared/codex.ts`).
 */
export const VERSIONS_DU_BILAN_DU_CABINET = [1] as const
export type VersionDuBilan = (typeof VERSIONS_DU_BILAN_DU_CABINET)[number]
/** Celle des bilans qui s'écrivent. */
export const VERSION_DU_BILAN_DU_CABINET: VersionDuBilan = VERSIONS_DU_BILAN_DU_CABINET[VERSIONS_DU_BILAN_DU_CABINET.length - 1]

export type Manche = 0 | 1 | 2
/**
 * D'où part une partie : une case de la visite, une chasse, un jeu libre, une
 * porte de la tour (`montee.ts`, depuis la version 2 du départ), ou une épreuve
 * d'une traversée (`traversee.ts`, depuis la version 3).
 */
export type OrigineDUnePartie = 'visite' | 'chasse' | 'libre' | 'montee' | 'traversee'

/**
 * L'épreuve d'une traversée qu'une partie joue, figée à son départ : la
 * traversée, l'étape de sa carte, et l'assaut contre son gardien (zéro pour
 * une épreuve). La traversée se relit de ses gestes, qui nomment ses parties
 * (`etatDeLaTraversee`) : ceci ne sert qu'à relire une partie seule.
 */
export interface EpreuveDuDepart {
  id: string
  etape: string
  assaut: number
}

/** Ce qu'une porte de la tour promet, une fois ouverte : son œuvre — la cible du départ —, un cœur, ou les étoiles de l'étage doublées. */
export type ButinDUnePorte = 'oeuvre' | 'coeur' | 'etoiles'

/**
 * L'étage d'une montée qu'une partie joue, figé à son départ : la montée du
 * jour (la première, la deuxième…), l'étage, la porte choisie et ce qu'elle
 * promettait, et la carte-bonus que toute la montée emporte. La montée se
 * relit de ses parties du jour (`monteeDesParties`) : rien d'autre ne l'écrit.
 */
export interface MonteeDuDepart {
  n: number
  etage: number
  porte: number
  butin: ButinDUnePorte
  carte: string | null
}

/** La carte-bonus d'une partie, figée au départ avec son pouvoir et sa force : elle ne s'use jamais. */
export interface CarteDuDepart {
  cle: string
  pouvoir: CleDePouvoir
  force: Force
}

/**
 * Le chrono d'une partie, figé à son départ comme son seuil : la durée de
 * chaque étape de son jeu, ce que « Prendre son temps » y ajoute, la grâce et
 * la pause. Le pli le relit à chaque relecture — un réveil, une mise en ligne,
 * « Mes réponses » — : relu au barème du code, une durée changée aurait fait
 * changer d'échéance une manche en route, et passer en retard un geste arrivé
 * à l'heure. Un chiffre du chrono changé ne vaut donc que pour les parties qui
 * commencent, sans version.
 */
export interface ChronoDuDepart {
  /** La durée de chaque étape, sans le temps en plus : une, ou deux au Pari et à la Réplique (`DUREES_DES_JEUX`). */
  etapesMs: readonly number[]
  /** Ce que « Prendre son temps » ajoute à chaque étape (`SECONDES_PAR_FORCE` × la force de la carte) ; zéro sans elle. */
  enPlusMs: number
  /** Le réseau d'un téléphone (`GRACE_D_UNE_MANCHE_MS`). */
  graceMs: number
  /** La pause de « Quitter ? », au plus, par manche (`PAUSE_MAX_MS`). */
  pauseMs: number
}

/** Le chrono qu'un départ fige, aux chiffres du jour : le serveur l'écrit avec le plan, sous ses cartes — celle qui prend son temps l'allonge. */
export function chronoDuDepart(jeu: CleDeJeu, cartes: CarteDuDepart | readonly CarteDuDepart[] | null): ChronoDuDepart {
  const regle = regleDe(jeu)
  const temps = (Array.isArray(cartes) ? cartes : cartes ? [cartes] : []).find((c: CarteDuDepart) => c.pouvoir === 'temps')
  return {
    etapesMs: Array.from({ length: regle.etapes }, (_, i) => regle.dureeMs(i === 0 ? 1 : 2)),
    enPlusMs: temps ? SECONDES_PAR_FORCE * temps.force * 1000 : 0,
    graceMs: GRACE_D_UNE_MANCHE_MS,
    pauseMs: PAUSE_MAX_MS,
  }
}

/**
 * Les cartes d'une partie : celles d'une épreuve de traversée (`cartes`, une
 * par pouvoir au plus), ou la carte-bonus d'une partie du musée. Le pli ne lit
 * jamais `carte` seule : une épreuve en joue jusqu'à quatre à la fois.
 */
export const cartesDuDepart = (d: Pick<DepartDUnePartie, 'carte' | 'cartes'>): readonly CarteDuDepart[] => d.cartes ?? (d.carte ? [d.carte] : [])

/** La carte qui porte ce pouvoir, s'il y en a une. */
export const carteDuPouvoir = (d: Pick<DepartDUnePartie, 'carte' | 'cartes'>, pouvoir: CleDePouvoir): CarteDuDepart | null =>
  cartesDuDepart(d).find(c => c.pouvoir === pouvoir) ?? null

/** Une épreuve de traversée : ses étoiles ne passent par aucun pouvoir, la traversée en fait de l'or, des cœurs et des coups (`traversee.ts`). */
export const estUneEpreuve = (d: Pick<DepartDUnePartie, 'origine'>): boolean => d.origine === 'traversee'

/**
 * Les mises qu'une partie permet : une au musée ; à une épreuve, celles de sa
 * carte (`MISES_PAR_EPREUVE` — Quitte ou double au plus haut en a deux).
 */
const misesPermises = (d: DepartDUnePartie, force: Force): number => (estUneEpreuve(d) ? MISES_PAR_EPREUVE[force] : 1)
/** Les mises déjà jouées : chaque manche ouverte le dit. */
const misesJouees = (e: EtatDeLaPartie): number => e.manches.filter(m => m.misee).length

/** Ce qu'un départ fige : `campagne_series.cabinet`, jamais réécrit, jamais envoyé au téléphone (invariant 1). */
export interface DepartDUnePartie {
  /** Sa version, telle qu'écrite : le pli joue la règle de la sienne. */
  v: VersionDuDepart
  jeu: CleDeJeu
  origine: OrigineDUnePartie
  /** Sa case de la visite du jour. */
  visite?: Manche
  /** Le jour de Paris du départ (`jourDe`) : la visite, les chasses, la série et la poussière s'y rangent, même close le lendemain. */
  jour: string
  /** L'œuvre en jeu ; null : une partie libre, ou une case de visite sans rien à gagner. */
  cible: string | null
  /** L'œuvre était-elle déjà à lui au départ ? À gagner, ou à dorer. */
  but: 'gagner' | 'dorer' | null
  /** « Retenter cette œuvre au même jeu », après une visite manquée. */
  retente?: true
  /** L'étage de la tour que la partie joue : une porte s'ouvre au seuil, comme une œuvre se gagne. */
  montee?: MonteeDuDepart
  /** L'épreuve de la traversée que la partie joue (version 3) : ses étoiles deviennent de l'or, des cœurs perdus, des coups au gardien. */
  traversee?: EpreuveDuDepart
  /**
   * Les cartes d'une épreuve (version 3), une par pouvoir au plus, chacune à
   * la force de son niveau : `carte` y reste nulle. Seules y entrent celles
   * qu'une manche joue — Coup d'œil, Échange, Quitte ou double, Concentration ;
   * les autres agissent sur la traversée.
   */
  cartes?: readonly CarteDuDepart[]
  /** Les étoiles qu'il faut, figées : un seuil changé ne vaut que pour les parties qui commencent. */
  seuil: number | null
  /** Une partie libre parmi les cinq du jour qui paient, comptée par la base au départ ; vrai en visite et en chasse. */
  payee: boolean
  carte: CarteDuDepart | null
  /** Le chrono de ses manches, figé (`chronoDuDepart`). */
  chrono: ChronoDuDepart
  /**
   * La graine du hasard d'Éclairer, tirée au départ par le serveur
   * (`randomUUID`) : recharger redonne la même réponse effacée, la même lettre
   * soufflée, la même zone. Un secret — aucune vue ne la porte, aucune route
   * ne la rend (`cabinet-secret.test.ts`) : qui la saurait rejouerait Éclairer
   * et en déduirait la réponse.
   */
  graine: string
  /** « Les grands sièges », « L'aviation » : l'Épingle et la Frise le disent. */
  theme?: string
  /** Les trois manches, puis les rechanges de « Changer », autant que sa force : le plan entier, réponses comprises. */
  tirages: readonly ContenuTire[]
}

/**
 * Ce que l'enjeu d'une partie demande à son tirage : les marches que l'œuvre
 * visée ajoute aux jeux qui posent des questions de la base
 * (`MARCHES_DES_ENJEUX`), et une frise serrée pour une épique
 * (`ECART_D_UNE_FRISE_EPIQUE`). Le tireur le lit au départ ; le plan figé garde
 * ce qu'il a tiré, et la relecture n'en relit rien.
 */
export interface EnjeuDuTirage {
  marchesEnPlus: readonly Niveau[]
  friseSerree: boolean
  /**
   * Les marches d'une épreuve de traversée, à la place de celles du jeu : la
   * difficulté de son acte (`MARCHES_DES_ACTES`), un cran au-dessus contre un
   * gardien. Absentes, chaque jeu tire les siennes.
   */
  marches?: readonly Niveau[]
}

/** Une partie libre, une case pour la poussière : rien de plus que les marches de chaque jeu. */
export const ENJEU_ORDINAIRE: EnjeuDuTirage = { marchesEnPlus: [], friseSerree: false }

/**
 * L'enjeu d'un départ, de l'œuvre qu'il vise : sa rareté, ou la dorure — une
 * chasse pour dorer, une case de la visite dont l'œuvre est déjà à lui.
 * L'œuvre ne se nomme pas à la page, mais sa rareté si (`EnjeuDUneCase`) : la
 * marche qu'elle tire n'en dit pas plus.
 */
export function enjeuDuTirage(c: Pick<DepartDUnePartie, 'cible' | 'but'>): EnjeuDuTirage {
  const rarete = oeuvre(c.cible)?.rarete ?? null
  const marchesEnPlus = c.but === 'dorer' ? MARCHES_DES_ENJEUX.dorer : rarete ? MARCHES_DES_ENJEUX[rarete] : []
  return { marchesEnPlus, friseSerree: rarete === 'epique' }
}

/** Les marches qu'un jeu tire sous cet enjeu : les siennes, puis celles que l'enjeu ajoute — la fraîcheur départage, jamais la marche. */
export const marchesDeLEnjeu = (marches: readonly Niveau[], enjeu: EnjeuDuTirage): Niveau[] =>
  enjeu.marches ? [...enjeu.marches] : [...marches, ...enjeu.marchesEnPlus.filter(m => !marches.includes(m))]

/** L'année du jour de Paris du départ : la borne des pistes d'années du Filet, que le tireur lit — `lireLeDepart` n'y relit que la coupe de la piste. */
export const anneeDuDepart = (d: Pick<DepartDUnePartie, 'jour'>): number => Number(d.jour.slice(0, 4))

/** Une partie d'un jour d'avant, que la première page du jour clôt (`clore`) : un téléphone éteint en pleine manche, un joueur jamais revenu. */
export const estDUnJourDAvant = (d: Pick<DepartDUnePartie, 'jour'>, jour: string): boolean => d.jour < jour

// ── Les gestes ────────────────────────────────────────────────────────────

/** Ce qu'un `repondre` porte, sous la clé de son jeu : la page tient seule l'épingle, la frise rangée, le curseur, les affirmations, et les envoie ici. */
export type ReponseDUnJeu =
  | { pari: { choix: number } }
  | { eclair: { reponses: (boolean | null)[] } }
  | { filet: { x: number; taille: TailleDuFilet } }
  | { detail: { titre: number } }
  | { frise: { ordre: number[] } }
  | { epingle: { lat: number; lon: number } }
  | { replique: { qui: number } }
  | { quiz: { choix: (number | null)[] } }

/**
 * Ce que la page envoie, tel que `lireUnGeste` le relit, avec le rang qu'il
 * croit suivre (invariant 12) : un geste périmé se refuse, la vue d'à présent
 * avec. `clore` est le seul que le serveur écrit lui-même — jamais la page.
 */
export type GesteDuCabinet =
  | { quoi: 'ouvrir'; manche: Manche; miser?: true }
  | { quoi: 'pause'; manche: Manche }
  | { quoi: 'reprendre'; manche: Manche }
  | { quoi: 'eclairer'; manche: Manche; affirmation?: number }
  | { quoi: 'changer'; manche: Manche }
  | { quoi: 'essai'; manche: Manche; lettres: string }
  | { quoi: 'reculer'; manche: Manche }
  | { quoi: 'indice'; manche: Manche }
  | { quoi: 'nom'; manche: Manche; texte: string }
  | { quoi: 'garder'; manche: Manche }
  | { quoi: 'parier'; manche: Manche }
  | { quoi: 'mot'; manche: Manche; choix: number }
  | { quoi: 'repondre'; manche: Manche; auto?: true; reponse?: ReponseDUnJeu }
  | { quoi: 'quitter' }
  | { quoi: 'clore'; pourquoi: 'lendemain' }

/** Un geste écrit (`cabinet_gestes`), et l'heure du serveur à l'arrivée de sa requête, prise avant le verrou. */
export interface GesteEcrit {
  geste: GesteDuCabinet
  faitLe: number
}

// ── L'état ────────────────────────────────────────────────────────────────

/** Une étape d'une manche : son chrono, et ce qui l'a aidée. */
export interface EtapeDUneManche extends EtapeChronometree {
  /** Sa durée sans « Prendre son temps » : un geste arrivé au-delà, grâce comprise, a eu besoin du temps en plus. */
  dureeNormaleMs: number
  /** Éclairer a servi dans cette étape : sa pièce porte `pouvoir:eclairer`. */
  eclairee: boolean
  /** Un geste est arrivé dans le temps en plus : sa pièce porte `pouvoir:temps`, s'il n'a pas éclairé. */
  tempsEnPlus: boolean
}

/** Comment une manche s'est tranchée : jugée sur ce qu'elle portait, expirée — rien de ce qui arrivait en retard —, ou quittée. */
export type FinDUneManche = 'jugee' | 'expiree' | 'quittee'

/** Une manche ouverte, telle que le pli la tient. */
export interface MancheDuPli {
  manche: Manche
  /** Le contenu qu'elle joue, dans le plan : le sien (`manche`), ou la rechange que « Changer » a prise. */
  tirage: number
  /** Ceux que « Changer » y a remplacés, dans l'ordre : montrés sans verdict, ils comptent vus avec sa pièce (`trancher`). */
  remplacees: readonly number[]
  /** L'état de son jeu, que seule sa règle lit. */
  etat: unknown
  /** Une étape, ou deux au Pari parié et à la Réplique. */
  etapes: readonly EtapeDUneManche[]
  /** Un geste du jeu ou Éclairer y a été fait : « Changer » vient avant. */
  aJoue: boolean
  /** Misée avant d'être vue. */
  misee: boolean
  verdict: VerdictDUneManche | null
  trancheeLe: number | null
  fin: FinDUneManche | null
}

/** Une pièce tranchée, telle que le journal l'écrit : sa ligne de `campagne_reponses`, et la pièce à sa position. */
export interface PieceJugee {
  /** Sa position dans la partie : l'indice de la pièce dans `campagne_series.questions`. */
  position: number
  manche: Manche
  tirage: number
  etape?: 1 | 2
  piece: PieceDuCabinet
  juste: boolean
  /** L'index choisi au Pari ; ailleurs 0 juste, −1 fausse, null sans réponse. */
  choix: number | null
  composee: string | null
  /** `pouvoir:eclairer`, `pouvoir:temps`, ou rien (D6). */
  joker: string | null
  /** L'arrivée du geste qui l'a tranchée ; expirée, l'instant où son étape a cessé d'attendre. */
  repondueLe: number
}

export type FinDUnePartie = { le: number; pourquoi: 'jouee' | 'quittee' | 'lendemain' }

export interface EtatDeLaPartie {
  /** Le rang du prochain geste : un de plus que les gestes écrits, refusés à la relecture compris. */
  rang: number
  /** Les manches ouvertes, dans l'ordre : la dernière est celle où il en est. */
  manches: readonly MancheDuPli[]
  /** Les fois qu'Éclairer et Changer ont servi. */
  servis: { eclairer: number; changer: number }
  /** La manche misée ; null tant que la mise n'a pas servi. */
  misee: Manche | null
  pieces: readonly PieceJugee[]
  fin: FinDUnePartie | null
  /**
   * Les gestes écrits que la relecture a refusés : zéro, toujours, tant que la
   * version du départ suit les règles. Plus, et une règle a changé sans la
   * monter — le serveur le dit au journal.
   */
  ignores: number
}

export const ETAT_DU_DEPART: EtatDeLaPartie = { rang: 1, manches: [], servis: { eclairer: 0, changer: 0 }, misee: null, pieces: [], fin: null, ignores: 0 }

/**
 * Une pièce répondue : il a donné une réponse — un choix au Pari, une épingle,
 * un filet lancé, des essais ou des erreurs que le chrono a trouvés en route
 * (`choix` non nul). Quittée, ou laissée au chrono sans rien envoyer, elle n'en
 * a pas. Une partie ne compte que ce qui a été répondu (le 26 octobre 2026) :
 * sa poussière minimale (`POUSSIERE_MIN`), son jour de série, la manche que
 * Protéger relève — quitter d'emblée rapportait quatre poussières, tenait la
 * série et, sous Prudence, une étoile (la tablée du 25 octobre 2026).
 */
export const pieceRepondue = (p: Pick<PieceJugee, 'choix'>): boolean => p.choix !== null
/** La partie a-t-elle reçu une réponse, à une manche au moins ? */
export const laPartieARepondu = (e: Pick<EtatDeLaPartie, 'pieces'>): boolean => e.pieces.some(pieceRepondue)

// ── Les refus, en mots ────────────────────────────────────────────────────

export const PARTIE_FINIE = 'Cette partie est finie'
export const AUTRE_MANCHE = 'Ce geste vise une autre manche : recharge la page'
export const PAS_ENCORE_OUVERTE = 'Cette manche n’est pas encore ouverte'
export const MANCHE_JOUEE = 'Cette manche est déjà jouée'
export const REPONDS_D_ABORD = 'Réponds d’abord à cette manche'
export const PAS_LA_SUIVANTE = 'Ce n’est pas la manche suivante : recharge la page'
export const MISE_AVANT = 'La mise se décide avant de voir la manche'
export const TEMPS_ECOULE = 'Le temps de cette manche est écoulé'
export const EN_PAUSE = 'La partie est en pause : reprends-la d’abord'
export const DEJA_EN_PAUSE = 'La partie est déjà en pause'
export const PAS_EN_PAUSE = 'La partie n’est pas en pause'
export const AUCUN_CHRONO = 'Aucun chrono ne court : rien à mettre en pause'
export const PLUS_DE_PAUSE = 'Plus de pause pour cette manche : le chrono continue'
export const SANS_CARTE = 'Tu n’as emporté aucune carte-bonus'
export const PAS_CE_POUVOIR = 'Ta carte-bonus n’a pas ce pouvoir'
export const ILLISIBLE = 'Ce geste ne se lit pas : recharge la page'

// ── Le pli ────────────────────────────────────────────────────────────────

const courante = (e: EtatDeLaPartie): MancheDuPli | undefined => e.manches[e.manches.length - 1]
const derniere = (m: MancheDuPli): EtapeDUneManche => m.etapes[m.etapes.length - 1]
const remplacer = (e: EtatDeLaPartie, m: MancheDuPli): EtatDeLaPartie => ({ ...e, manches: e.manches.map(x => (x.manche === m.manche ? m : x)) })
const tireeDe = (d: DepartDUnePartie, m: MancheDuPli): unknown => d.tirages[m.tirage]

/**
 * L'étape du jeu où en est sa manche : un état qui porte `etape` (le Pari, la
 * Réplique) le dit ; les autres n'en ont qu'une. Le moule (`regle.ts`) le
 * promet : c'est ce que le pli lit pour ses chronos.
 */
const etapeDuJeu = (etat: unknown): 1 | 2 => ((etat as { etape?: unknown }).etape === 2 ? 2 : 1)
/** Le Pari, juste à sa première question : il garde ou il parie, et aucun chrono ne court. */
const auChoix = (etat: unknown): boolean => (etat as { auChoix?: unknown }).auChoix === true
/** Le chrono de la manche court-il ? Ni tranchée, ni au choix du Pari. */
const chronoActif = (m: MancheDuPli): boolean => m.verdict === null && !auChoix(m.etat)

/** Une étape qui s'ouvre à `t`, au chrono figé de son départ — jamais au barème du jour. */
function etapeNeuve(d: DepartDUnePartie, etape: 1 | 2, t: number, pauseDisponibleMs: number): EtapeDUneManche {
  const dureeNormaleMs = d.chrono.etapesMs[etape - 1]
  return { ...etapeOuverte(t, dureeNormaleMs + d.chrono.enPlusMs, pauseDisponibleMs, d.chrono.graceMs), dureeNormaleMs, eclairee: false, tempsEnPlus: false }
}

/** Une étape qui s'arrête à `t` : sa pause en cours se ferme — une étape tranchée ne recule plus son échéance. */
function arretee(e: EtapeDUneManche, t: number): EtapeDUneManche {
  return pauseEnCours(e) ? { ...e, pauses: e.pauses.map(p => (p.jusqua === undefined ? { ...p, jusqua: Math.max(p.depuis, t) } : p)) } : e
}

/** Le nouvel état du jeu d'une manche, à `t` : la seconde étape s'ouvre si le jeu y passe, avec ce qui reste de la pause. */
function avecLEtat(d: DepartDUnePartie, m: MancheDuPli, etat: unknown, t: number): MancheDuPli {
  if (etapeDuJeu(etat) <= m.etapes.length) return { ...m, etat }
  const avant = arretee(derniere(m), t)
  const etapes = [...m.etapes.slice(0, -1), avant, etapeNeuve(d, 2, t, pauseLaisseeMs(avant, t))]
  return { ...m, etat, etapes }
}

/**
 * Un geste arrivé dans le temps en plus de « Prendre son temps » : l'étape le
 * marque. Avant la durée normale (pauses et grâce comprises), rien — la carte
 * emportée n'a pas servi, et la ligne reste nue.
 */
function marquerLeTemps(d: DepartDUnePartie, m: MancheDuPli, t: number): MancheDuPli {
  if (!carteDuPouvoir(d, 'temps') || !chronoActif(m)) return m
  const e = derniere(m)
  if (e.tempsEnPlus || t <= e.ouverteLe + e.dureeNormaleMs + pauseCompteeMs(e, t) + e.graceMs) return m
  return { ...m, etapes: [...m.etapes.slice(0, -1), { ...e, tempsEnPlus: true }] }
}

/**
 * Ce qu'un contenu du plan avait montré quand « Changer » l'a remplacé — avant
 * tout geste du jeu, la règle le veut : la pièce qu'il aurait laissée, quitté à
 * cet instant, et ce qu'elle montrait de plus (les leurres d'un Détail). Une
 * seule règle de ce qu'une manche vue écrit : quittée, une manche laisse sa
 * pièce parce qu'il l'a vue — remplacée, elle ne laissait rien, et la question
 * de la base qu'il venait de lire revenait « jamais vue » au Cabinet comme
 * ailleurs (la deuxième tablée, le 26 octobre 2026).
 */
function ceQueMontraitLaRemplacee(d: DepartDUnePartie, m: MancheDuPli, tirage: number): string[] {
  const regle = regleDe(d.jeu)
  const tiree = d.tirages[tirage]
  const etat = regle.ouvrir(tiree)
  const quittee = regle.juger(tiree, etat, 'quittee')
  return quittee.pieces.flatMap(p => {
    const piece = regle.piece(tiree, etat, quittee, { manche: m.manche, tirage, ...(p.etape !== undefined && { etape: p.etape }), aidee: false })
    return [piece.id, ...(piece.cabinet.montre ?? [])]
  })
}

/**
 * La pièce d'une manche que « Changer » a touchée. Sa première porte ce que les
 * contenus remplacés avaient montré (`cabinet.montre`) — une manche n'écrit
 * toujours qu'une pièce par verdict. Et aucune n'est plus nue : la rechange se
 * joue sur l'échéance de la manche remplacée, le chrono continue, avec moins de
 * temps que sa question n'en avait — la mesure, qui ne lit que le Pari nu,
 * l'aurait comptée plus dure qu'elle n'est.
 */
function apresLeChangement(piece: PieceDuCabinet, jeu: CleDeJeu, remplacees: readonly string[]): PieceDuCabinet {
  const montre = [...new Set([...(piece.cabinet.montre ?? []), ...remplacees])].filter(id => id !== piece.id)
  return { ...piece, forme: piece.forme ?? jeu, cabinet: { ...piece.cabinet, ...(montre.length > 0 && { montre }) } }
}

/**
 * La manche tranchée à `quand` : son verdict, et ses pièces rangées à la suite
 * de celles d'avant. Chaque pièce dit si un pouvoir l'a aidée — Éclairer, ou
 * le temps en plus —, dans l'étape qu'elle juge : au Pari, la première
 * question et celle du pari chacune la sienne. La dernière manche finit la
 * partie.
 */
function trancher(d: DepartDUnePartie, e: EtatDeLaPartie, m: MancheDuPli, verdict: VerdictDUneManche, quand: number, fin: FinDUneManche): EtatDeLaPartie {
  const regle = regleDe(d.jeu)
  const etapes = [...m.etapes.slice(0, -1), arretee(derniere(m), quand)]
  const remplacees = m.remplacees.flatMap(k => ceQueMontraitLaRemplacee(d, m, k))
  const pieces: PieceJugee[] = verdict.pieces.map((p, i) => {
    const sienne = p.etape === undefined ? etapes : etapes.slice(p.etape - 1, p.etape)
    const eclairee = sienne.some(x => x.eclairee)
    const temps = sienne.some(x => x.tempsEnPlus)
    const situee = { manche: m.manche, tirage: m.tirage, ...(p.etape !== undefined && { etape: p.etape }), aidee: eclairee || temps }
    const piece = regle.piece(tireeDe(d, m), m.etat, verdict, situee)
    return {
      position: e.pieces.length + i,
      manche: m.manche,
      tirage: m.tirage,
      ...(p.etape !== undefined && { etape: p.etape }),
      piece: m.remplacees.length > 0 ? apresLeChangement(piece, d.jeu, i === 0 ? remplacees : []) : piece,
      juste: p.juste,
      choix: p.choix,
      composee: p.composee,
      joker: eclairee ? JOKER_D_ECLAIRER : temps ? JOKER_DU_TEMPS : null,
      repondueLe: quand,
    }
  })
  const tranchee: MancheDuPli = { ...m, etapes, verdict, trancheeLe: quand, fin }
  const apres = { ...remplacer(e, tranchee), pieces: [...e.pieces, ...pieces] }
  return m.manche === MANCHES_PAR_PARTIE - 1 ? { ...apres, fin: { le: quand, pourquoi: 'jouee' } } : apres
}

/**
 * Le temps qui a passé jusqu'à `t`, sans qu'aucun geste ne le dise : l'étape
 * en cours a-t-elle cessé d'attendre ? Le pli fait comme la page, qui envoie
 * d'elle-même une réponse vide à l'échéance, au dernier instant de la grâce
 * (`limiteDe`) : à la première étape de la Réplique, « Qui l'a dit ? »
 * s'ouvre, le mot perdu ; partout ailleurs, la manche se juge expirée — ce que
 * le serveur savait déjà compte (les essais du Mot, les erreurs des Indices,
 * le mot de la Réplique), rien d'autre.
 */
function avancer(d: DepartDUnePartie, etat: EtatDeLaPartie, t: number): EtatDeLaPartie {
  const regle = regleDe(d.jeu)
  let e = etat
  // Deux étapes au plus : le mot de la Réplique, puis « Qui l'a dit ? ».
  for (let fois = 0; fois < 2; fois++) {
    const m = courante(e)
    if (!m || !chronoActif(m) || dansLesTemps(derniere(m), t)) return e
    const limite = limiteDe(derniere(m))
    const tiree = tireeDe(d, m)
    const vide = regle.lireLeGeste({ quoi: 'repondre' }, tiree)
    if (vide && !trancheLaManche(regle, tiree, m.etat, vide)) {
      const apres = regle.apresLeGeste(tiree, m.etat, vide)
      if (typeof apres !== 'string' && etapeDuJeu(apres) > m.etapes.length) {
        e = remplacer(e, avecLEtat(d, m, apres, limite))
        continue
      }
    }
    return trancher(d, e, m, regle.juger(tiree, m.etat, 'expiree'), limite, 'expiree')
  }
  return e
}

/**
 * La partie qui finit à `t` : la manche ouverte et pas tranchée compte ce
 * qu'en dit son jeu, quittée — zéro, `choix` NULL, sa pièce écrite (il l'a
 * vue) ; un Pari juste au premier coup, laissé au choix, garde ses étoiles.
 * Une manche jamais ouverte compte zéro, sans pièce. Une partie que le temps a
 * déjà finie — sa dernière manche expirée avant « Quitter » ou la page du
 * lendemain — reste jouée, à l'heure où elle a fini : la réécrire quittée
 * aurait mis `quittee` au bilan d'une partie menée au bout.
 */
function finir(d: DepartDUnePartie, etat: EtatDeLaPartie, t: number, pourquoi: FinDUnePartie['pourquoi']): EtatDeLaPartie {
  if (etat.fin) return etat
  const m = courante(etat)
  let e = etat
  if (m && m.verdict === null) e = trancher(d, e, m, regleDe(d.jeu).juger(tireeDe(d, m), m.etat, 'quittee'), t, 'quittee')
  return { ...e, fin: { le: t, pourquoi } }
}

function ouvrir(d: DepartDUnePartie, e: EtatDeLaPartie, g: Extract<GesteDuCabinet, { quoi: 'ouvrir' }>, t: number): EtatDeLaPartie | string {
  const m = courante(e)
  if (m && m.verdict === null) return g.miser && g.manche === m.manche ? MISE_AVANT : REPONDS_D_ABORD
  if (g.manche !== e.manches.length) return PAS_LA_SUIVANTE
  if (g.miser) {
    const carte = carteDuPouvoir(d, 'miser')
    if (!carte) return cartesDuDepart(d).length === 0 ? SANS_CARTE : PAS_CE_POUVOIR
    const refus = refusDuPouvoir({ pouvoir: 'miser', force: carte.force, jeu: d.jeu, servi: misesJouees(e), limite: misesPermises(d, carte.force) })
    if (refus) return refus
  }
  const regle = regleDe(d.jeu)
  const neuve: MancheDuPli = {
    manche: g.manche,
    tirage: g.manche,
    remplacees: [],
    etat: regle.ouvrir(d.tirages[g.manche]),
    etapes: [etapeNeuve(d, 1, t, d.chrono.pauseMs)],
    aJoue: false,
    misee: g.miser === true,
    verdict: null,
    trancheeLe: null,
    fin: null,
  }
  return { ...e, manches: [...e.manches, neuve], misee: g.miser ? g.manche : e.misee }
}

/** Éclairer : la carte qui éclaire, ses usages, et ce que le jeu en fait — tiré de la graine secrète et du rang du geste. */
function eclairer(d: DepartDUnePartie, e: EtatDeLaPartie, m: MancheDuPli, cible: number | undefined, t: number): EtatDeLaPartie | string {
  const carte = carteDuPouvoir(d, 'eclairer')
  if (!carte) return cartesDuDepart(d).length === 0 ? SANS_CARTE : PAS_CE_POUVOIR
  const regle = regleDe(d.jeu)
  const tiree = tireeDe(d, m)
  const refus = refusDuPouvoir({ pouvoir: 'eclairer', force: carte.force, jeu: d.jeu, servi: e.servis.eclairer, aEclairer: eclairerSertEncore(regle, tiree, m.etat) })
  if (refus) return refus
  const etat = regle.eclairer(tiree, m.etat, hasardDe(`${d.graine}:eclairer:${e.rang}`), cible)
  if (typeof etat === 'string') return etat
  const marquee = marquerLeTemps(d, { ...m, etat, aJoue: true }, t)
  const etapes = [...marquee.etapes.slice(0, -1), { ...derniere(marquee), eclairee: true }]
  return { ...remplacer(e, { ...marquee, etapes }), servis: { ...e.servis, eclairer: e.servis.eclairer + 1 } }
}

/** Les rechanges qui restent au plan : celles d'après les trois manches, moins celles déjà prises. */
const rechangesDe = (d: DepartDUnePartie, e: EtatDeLaPartie) => Math.max(0, d.tirages.length - MANCHES_PAR_PARTIE - e.servis.changer)

/** Changer : la rechange suivante du plan, la même échéance — le chrono continue. */
function changer(d: DepartDUnePartie, e: EtatDeLaPartie, m: MancheDuPli): EtatDeLaPartie | string {
  const carte = carteDuPouvoir(d, 'changer')
  if (!carte) return cartesDuDepart(d).length === 0 ? SANS_CARTE : PAS_CE_POUVOIR
  const refus = refusDuPouvoir({ pouvoir: 'changer', force: carte.force, jeu: d.jeu, servi: e.servis.changer, aJoue: m.aJoue || m.etapes.length > 1, rechanges: rechangesDe(d, e) })
  if (refus) return refus
  const tirage = MANCHES_PAR_PARTIE + e.servis.changer
  const changee: MancheDuPli = { ...m, tirage, remplacees: [...m.remplacees, m.tirage], etat: regleDe(d.jeu).ouvrir(d.tirages[tirage]) }
  return { ...remplacer(e, changee), servis: { ...e.servis, changer: e.servis.changer + 1 } }
}

/**
 * Un geste de plus, arrivé à `t` : l'état d'après, ou le refus en mots — et
 * rien ne change. La seule règle des refus : le serveur l'applique avant
 * d'écrire, la vue la porte, la page n'en recopie rien.
 */
export function jouerUnGeste(d: DepartDUnePartie, avant: EtatDeLaPartie, g: GesteDuCabinet, t: number): EtatDeLaPartie | string {
  if (avant.fin) return PARTIE_FINIE
  const suite = (e: EtatDeLaPartie): EtatDeLaPartie => ({ ...e, rang: avant.rang + 1 })
  const suiteOuRefus = (r: EtatDeLaPartie | string) => (typeof r === 'string' ? r : suite(r))
  switch (g.quoi) {
    // La page du lendemain, ou « Quitter » : ce qui a expiré se juge d'abord, à son heure, puis la partie finit.
    case 'clore':
      return suite(finir(d, avancer(d, avant, t), t, 'lendemain'))
    case 'quitter':
      return suite(finir(d, avancer(d, avant, t), t, 'quittee'))
    case 'ouvrir':
      return suiteOuRefus(ouvrir(d, avant, g, t))
  }
  const ouverte = courante(avant)
  if (!ouverte) return PAS_ENCORE_OUVERTE
  if (g.manche !== ouverte.manche) return AUTRE_MANCHE
  if (ouverte.verdict) return MANCHE_JOUEE
  const etape = derniere(ouverte)
  const enRetard = chronoActif(ouverte) && !dansLesTemps(etape, t)
  // La réponse que la page envoie à l'échéance, arrivée après la grâce : elle porte l'expiration, rien de ce qu'elle tient.
  if (g.quoi === 'repondre' && enRetard) return suite(avancer(d, avant, t))
  const sansPause = (): MancheDuPli => ({ ...ouverte, etapes: [...ouverte.etapes.slice(0, -1), arretee(etape, t)] })
  let m = ouverte
  if (pauseEnCours(etape)) {
    if (g.quoi === 'reprendre') return suite(remplacer(avant, sansPause()))
    // Sous la confirmation de « Quitter ? », seule la réponse passe : au bout de la pause, le chrono a
    // repris sous le voile, et à l'échéance la page envoie d'elle-même ce qu'elle tenait — l'épingle, la frise, le
    // curseur. Arrivée à l'heure, elle ferme la pause et se juge sur ce qu'elle porte ; refusée, l'épingle partie
    // à temps aurait compté pour rien. Une réponse n'achète pas de temps : la pause s'arrête à son arrivée.
    if (g.quoi !== 'repondre') return g.quoi === 'pause' ? DEJA_EN_PAUSE : EN_PAUSE
    m = sansPause()
  } else if (g.quoi === 'reprendre') return PAS_EN_PAUSE
  if (enRetard) return TEMPS_ECOULE
  switch (g.quoi) {
    case 'pause':
      if (!chronoActif(m)) return AUCUN_CHRONO
      // Une pause qui ne fige plus rien — la pause de la manche passée — ou une de trop : chacune s'écrit avec sa reprise,
      // et une page qui les enchaînait au même instant écrivait des centaines de gestes par manche sans rien consommer.
      if (pauseLaisseeMs(etape, t) <= 0 || m.etapes.reduce((n, e) => n + e.pauses.length, 0) >= PAUSES_PAR_MANCHE) return PLUS_DE_PAUSE
      return suite(remplacer(avant, { ...m, etapes: [...m.etapes.slice(0, -1), { ...etape, pauses: [...etape.pauses, { depuis: t }] }] }))
    case 'eclairer':
      return suiteOuRefus(eclairer(d, avant, m, g.affirmation, t))
    case 'changer':
      return suiteOuRefus(changer(d, avant, m))
  }
  // Un geste du jeu : sa règle le relit, puis dit s'il tranche (`trancheLaManche`) — le verdict — ou l'état d'après.
  const regle = regleDe(d.jeu)
  const tiree = tireeDe(d, m)
  const lu = regle.lireLeGeste(g, tiree)
  if (!lu) return ILLISIBLE
  const jouee = marquerLeTemps(d, { ...m, aJoue: true }, t)
  if (trancheLaManche(regle, tiree, m.etat, lu)) return suite(trancher(d, remplacer(avant, jouee), jouee, regle.juger(tiree, m.etat, lu), t, 'jugee'))
  const etat = regle.apresLeGeste(tiree, m.etat, lu)
  if (typeof etat === 'string') return etat
  return suite(remplacer(avant, avecLEtat(d, jouee, etat, t)))
}

/** Le refus de ce geste, maintenant ; null : il passe. */
export function refusDuGeste(d: DepartDUnePartie, e: EtatDeLaPartie, g: GesteDuCabinet, t: number): string | null {
  const r = jouerUnGeste(d, e, g, t)
  return typeof r === 'string' ? r : null
}

/**
 * Le pli : l'état d'une partie, de son départ et de ses gestes, dans l'ordre.
 * Rejoué d'une traite ou geste par geste (`jouerUnGeste`), le même. Un geste
 * écrit que la relecture refuse — une règle changée sans monter la version du
 * départ — ne change rien, mais compte à son rang : le rang suivant reste
 * celui de la base.
 */
export function pliDeLaPartie(d: DepartDUnePartie, gestes: readonly GesteEcrit[]): EtatDeLaPartie {
  let e = ETAT_DU_DEPART
  for (const { geste, faitLe } of gestes) {
    const apres = jouerUnGeste(d, e, geste, faitLe)
    e = typeof apres === 'string' ? { ...e, rang: e.rang + 1, ignores: e.ignores + 1 } : apres
  }
  return e
}

// ── Ce que la vue lit ─────────────────────────────────────────────────────

export type PhaseDeLaPartie = 'avant' | 'jouer' | 'pause' | 'revele' | 'finie'

/**
 * Où en est la partie : `avant`, aucune manche ouverte — la mise se décide
 * sans avoir vu ; `jouer`, une manche ouverte ; `pause`, sous la confirmation
 * de « Quitter ? » ; `revele`, une manche tranchée, la suivante pas ouverte ;
 * `finie`.
 */
export function phaseDe(e: EtatDeLaPartie): PhaseDeLaPartie {
  if (e.fin) return 'finie'
  const m = courante(e)
  if (!m) return 'avant'
  if (m.verdict) return 'revele'
  return pauseEnCours(derniere(m)) ? 'pause' : 'jouer'
}

/** La manche où il en est : la dernière ouverte, ou la première avant tout. */
export const mancheDe = (e: EtatDeLaPartie): Manche => courante(e)?.manche ?? 0

/** La manche en cours, telle que le pli la tient : la vue en tire son chrono, `montrer` son corps, `reveler` sa révélation. */
export const mancheEnCours = (e: EtatDeLaPartie): MancheDuPli | undefined => courante(e)

/** L'étape en cours d'une manche. */
export const etapeEnCours = (m: MancheDuPli): EtapeDUneManche => derniere(m)

/** Le chrono de la manche court-il ? Ni tranchée, ni au choix du Pari : la vue ne dessine un chrono que là. */
export const leChronoCourt = (m: MancheDuPli): boolean => chronoActif(m)

/**
 * Le pouvoir d'une carte, maintenant — la carte-bonus d'une partie du musée,
 * ou l'une des cartes d'une épreuve : se joue-t-il, et sinon pourquoi — la vue
 * le porte, la page grise sans rien recopier. Null sans carte. Protéger et
 * Prendre son temps agissent seuls ; Éclairer et Changer dans une manche qui
 * se joue ; Miser avant la manche qui s'ouvre.
 */
export function pouvoirMaintenant(d: DepartDUnePartie, e: EtatDeLaPartie, t: number, carte: CarteDuDepart | null = d.carte): { jouable: boolean; refus?: string } | null {
  if (!carte) return null
  const { pouvoir, force } = carte
  const non = (refus: string) => ({ jouable: false, refus })
  if (e.fin) return non(PARTIE_FINIE)
  const m = courante(e)
  if (pouvoir === 'miser') {
    if (m && m.verdict === null) return non(MISE_AVANT)
    const refus = refusDuPouvoir({ pouvoir, force, jeu: d.jeu, servi: misesJouees(e), limite: misesPermises(d, force) })
    return refus ? non(refus) : { jouable: true }
  }
  if (pouvoir === 'proteger' || pouvoir === 'temps') return non(refusDuPouvoir({ pouvoir, force, jeu: d.jeu, servi: 0 }) ?? '')
  if (!m) return non(PAS_ENCORE_OUVERTE)
  if (m.verdict) return non(MANCHE_JOUEE)
  if (pauseEnCours(derniere(m))) return non(EN_PAUSE)
  if (chronoActif(m) && !dansLesTemps(derniere(m), t)) return non(TEMPS_ECOULE)
  const regle = regleDe(d.jeu)
  const tiree = tireeDe(d, m)
  const refus =
    pouvoir === 'eclairer'
      ? refusDuPouvoir({ pouvoir, force, jeu: d.jeu, servi: e.servis.eclairer, aEclairer: eclairerSertEncore(regle, tiree, m.etat) })
      : refusDuPouvoir({ pouvoir, force, jeu: d.jeu, servi: e.servis.changer, aJoue: m.aJoue || m.etapes.length > 1, rechanges: rechangesDe(d, e) })
  return refus ? non(refus) : { jouable: true }
}

// ── Les étoiles, le bilan ─────────────────────────────────────────────────

/** Ce qu'une manche vaut, après les pouvoirs : la vue le montre manche par manche, le bilan le fige. */
export interface EtoilesDUneManche {
  /** Ses étoiles naturelles, avant les pouvoirs ; null tant qu'elle n'est pas jugée — jamais ouverte, elle n'en a pas. */
  naturel: number | null
  /** Après Protéger et Miser. */
  etoiles: number | null
  protegee: boolean
  misee: boolean
  fin: FinDUneManche | null
}

/**
 * Une manche que Protéger peut relever : une réponse l'a tranchée — ni
 * quittée, ni finie par le chrono sans qu'il ait rien répondu. Le Pari laissé
 * au choix puis quitté garde ses étoiles, mais ne se relève pas : c'était
 * quitter.
 */
const relevable = (m: MancheDuPli | undefined): boolean => m?.verdict != null && m.fin !== 'quittee' && m.verdict.pieces.some(pieceRepondue)

/**
 * Une manche gardée au Pari : juste au premier coup, il a gardé ses étoiles
 * plutôt que de parier. Le geste qui tranche laisse l'état d'avant lui (le
 * moule, `regle.ts`) : une manche tranchée encore « au choix » l'a été par
 * « Garder » — ou quittée là, que `relevable` écarte déjà. Protéger ne la
 * relève pas : un choix, pas une manche imparfaite (la tablée du 26 octobre
 * 2026). Pas de version du départ neuve : la v1 se fige à la première mise en
 * préproduction (`docs/architecture/decisions.md`, l'arbitrage 7).
 */
const gardee = (m: MancheDuPli | undefined): boolean => m?.verdict != null && auChoix(m.etat)

/**
 * Les trois manches, jugées ou non. À une épreuve de traversée, les étoiles
 * restent les naturelles : ce que la mise y fait — l'or multiplié, deux cœurs
 * perdus —, la traversée le compte (`consequencesDe`, `traversee.ts`), qui lit
 * chaque manche misée.
 */
export function etoilesDesManches(d: DepartDUnePartie, e: EtatDeLaPartie): EtoilesDUneManche[] {
  if (estUneEpreuve(d)) {
    return Array.from({ length: MANCHES_PAR_PARTIE }, (_, k) => {
      const m = e.manches[k]
      const n = m?.verdict?.naturel ?? null
      return { naturel: n, etoiles: n, protegee: false, misee: m?.misee === true, fin: m?.fin ?? null }
    })
  }
  const naturel = Array.from({ length: MANCHES_PAR_PARTIE }, (_, k) => e.manches[k]?.verdict?.naturel ?? null)
  const repondues = Array.from({ length: MANCHES_PAR_PARTIE }, (_, k) => relevable(e.manches[k]))
  const gardees = Array.from({ length: MANCHES_PAR_PARTIE }, (_, k) => gardee(e.manches[k]))
  const etoiles = etoilesApresLesPouvoirs(naturel, d.carte, e.misee, repondues, gardees)
  const protegee = mancheProtegee(naturel, d.carte, repondues, gardees)
  return naturel.map((n, k) => ({ naturel: n, etoiles: etoiles[k], protegee: protegee === k, misee: e.misee === k, fin: e.manches[k]?.fin ?? null }))
}

/**
 * Le cadre doré : trois manches parfaites sans qu'un pouvoir ait servi.
 * Emporter une carte-bonus ne coûte rien ; l'avoir jouée, si — Éclairer,
 * Changer, la mise, la protection appliquée, le temps en plus utilisé.
 */
export const cadreDore = (naturel: readonly number[], aidee: boolean): boolean => naturel.length === MANCHES_PAR_PARTIE && naturel.every(n => n === 3) && !aidee

/** Ce que le pli sait d'une partie finie, avant le musée : l'issue et la poussière en dépendent (`bilanDe`). */
export interface ResultatDUnePartie {
  etoiles: [number, number, number]
  naturel: [number, number, number]
  /** Un pouvoir a servi, ou le temps en plus. */
  aidee: boolean
  /** Sur neuf, plafonné : une mise gagnée n'y passe pas au-delà. */
  total: number
  cadreDore: boolean
  quittee: boolean
  lendemain: boolean
  /** Une manche au moins a reçu une réponse (`laPartieARepondu`) : la poussière minimale ne se paie qu'à elle. */
  repondue: boolean
  /** La manche que son cartel garde : la plus étoilée naturellement qui a une anecdote, la première à égalité. */
  cartel: Manche | null
}

const trois = (x: readonly (number | null)[]): [number, number, number] => [x[0] ?? 0, x[1] ?? 0, x[2] ?? 0]

export function resultatDe(d: DepartDUnePartie, e: EtatDeLaPartie): ResultatDUnePartie {
  const manches = etoilesDesManches(d, e)
  const naturel = trois(manches.map(m => m.naturel))
  const etoiles = trois(manches.map(m => m.etoiles))
  const aidee =
    e.servis.eclairer > 0 || e.servis.changer > 0 || e.misee !== null || manches.some(m => m.protegee) || e.manches.some(m => m.etapes.some(x => x.tempsEnPlus))
  const regle = regleDe(d.jeu)
  let cartel: Manche | null = null
  for (const m of e.manches) {
    if (!m.verdict || !regle.cartel(tireeDe(d, m), m.verdict).anecdote) continue
    if (cartel === null || m.verdict.naturel > (e.manches[cartel].verdict?.naturel ?? -1)) cartel = m.manche
  }
  return {
    etoiles,
    naturel,
    aidee,
    total: Math.min(ETOILES_D_UNE_PARTIE, etoiles.reduce((a, b) => a + b, 0)),
    cadreDore: cadreDore(naturel, aidee),
    quittee: e.fin?.pourquoi === 'quittee',
    lendemain: e.fin?.pourquoi === 'lendemain',
    repondue: laPartieARepondu(e),
    cartel,
  }
}

export type IssueDUnePartie = 'gagnee' | 'gagnee-doree' | 'doree' | 'double' | 'manquee' | 'libre'
export const ISSUES: readonly IssueDUnePartie[] = ['gagnee', 'gagnee-doree', 'doree', 'double', 'manquee', 'libre']

/**
 * L'œuvre en jeu, telle que son musée la tient à la fin de la partie — une
 * chasse du matin l'a pu faire entrer avant la visite. Pendant la partie, rien
 * ne la change : achetée ou dorée en route, une chasse arrivée au seuil se
 * serait dite manquée (`refusDeLAchat` le refuse).
 */
export interface LOeuvreALui {
  possedee: boolean
  doree: boolean
}

/**
 * L'issue d'une partie finie : ce qu'elle fait à son œuvre. Une œuvre qui lui
 * manque se gagne au seuil figé du départ — et son cadre est doré si elle est
 * gagnée sans faute. Une œuvre déjà à lui se dore d'un cadre doré ; en visite,
 * regagnée au seuil sans cadre, elle paie un double. Une chasse pour dorer n'a
 * pas de double. Une partie libre, ou une case sans rien à gagner : libre.
 */
export function issueDe(d: DepartDUnePartie, r: Pick<ResultatDUnePartie, 'total' | 'cadreDore'>, aLui: LOeuvreALui | null): IssueDUnePartie {
  if (d.origine === 'libre' || d.cible === null || d.seuil === null) return 'libre'
  const atteint = r.total >= d.seuil
  if (!aLui?.possedee) return !atteint ? 'manquee' : r.cadreDore ? 'gagnee-doree' : 'gagnee'
  if (r.cadreDore && !aLui.doree) return 'doree'
  return d.origine === 'visite' && atteint ? 'double' : 'manquee'
}

/**
 * La poussière d'or qu'une partie rapporte, figée dans son bilan : en visite et
 * en chasse, deux par étoile, plus le double — et quatre au moins, même
 * ratée, s'il a répondu à une manche : quittée d'emblée, ou laissée au chrono
 * sans rien répondre, elle ne rapporte que ses étoiles ; une partie libre
 * parmi les cinq du jour qui paient, deux par étoile ; les suivantes, rien.
 */
export function poussiereDeLaPartie(d: DepartDUnePartie, r: { total: number; issue: IssueDUnePartie; repondue: boolean }): number {
  if (!d.payee) return 0
  if (d.origine === 'libre') return POUSSIERE_PAR_ETOILE * r.total
  const rarete = oeuvre(d.cible)?.rarete
  const double = r.issue === 'double' && rarete ? POUSSIERE_DU_DOUBLE[rarete] : 0
  return Math.max(r.repondue ? POUSSIERE_MIN : 0, POUSSIERE_PAR_ETOILE * r.total) + double
}

/** Le bilan d'une partie finie (`campagne_series.bilan`), écrit dans le lot qui la clôt : jamais réécrit. */
export interface BilanDUnePartie {
  /** Sa version, telle qu'écrite. */
  v: VersionDuBilan
  /** Après les pouvoirs : une manche misée parfaite vaut trois plus le bonus de sa mise (`BONUS_DE_MISE`). */
  etoiles: [number, number, number]
  /** Avant les pouvoirs : le cadre doré et la juste les lisent. */
  naturel: [number, number, number]
  aidee: boolean
  total: number
  quittee?: true
  /** Close par la page du lendemain. */
  lendemain?: true
  issue: IssueDUnePartie
  poussiere: number
  /** L'œuvre gagnée, dorée ou doublée. */
  oeuvre?: string
  cartel: Manche | null
}

/** Le bilan d'une partie que le pli dit finie, l'œuvre en jeu telle que son musée la tient à présent. */
export function bilanDe(d: DepartDUnePartie, e: EtatDeLaPartie, aLui: LOeuvreALui | null): BilanDUnePartie {
  const r = resultatDe(d, e)
  const issue = issueDe(d, r, aLui)
  return {
    v: VERSION_DU_BILAN_DU_CABINET,
    etoiles: r.etoiles,
    naturel: r.naturel,
    aidee: r.aidee,
    total: r.total,
    ...(r.quittee && { quittee: true as const }),
    ...(r.lendemain && { lendemain: true as const }),
    issue,
    poussiere: poussiereDeLaPartie(d, { total: r.total, issue, repondue: r.repondue }),
    ...(d.cible !== null && issue !== 'manquee' && issue !== 'libre' && { oeuvre: d.cible }),
    cartel: r.cartel,
  }
}
