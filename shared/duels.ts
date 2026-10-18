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
// Puis défier quelqu'un (le souhait du propriétaire du 11 octobre 2026 : « tu
// choisis sur quoi tu veux défier, une barre de recherche, un classement de
// la ligue avec des petites épées ; une fois le quiz fait de mon côté, ça
// envoie automatiquement une notification, pas de lien à partager ») : un
// duel classé entre deux vrais joueurs, sur un tirage figé. Celui qui défie
// joue d'abord ; à sa dernière réponse, l'autre le reçoit. Joué des deux
// côtés, chacun bouge contre la cote de l'autre, figée au lancement
// (`DuelJoue.coteAdverse`) — pas contre son score : un second profil qui
// rejouerait les questions en connaissant les réponses choisirait son score,
// pas sa cote, et battre un profil neuf à 1000 ne rapporte que ce qu'une
// cote de 1000 vaut, de moins en moins à mesure qu'on monte. Chacun se relit
// toujours seul : rien ne passe d'un profil à l'autre.
//
// Les défis entre amis d'avant, à plusieurs et par lien, restent amicaux.
//
// Puis la montée (le choix du propriétaire du 14 octobre 2026, plus bas) :
// deux cotes, une cachée — l'ELO, le niveau, qui règle Automate — et celle
// qu'on voit, celle des ligues, qui avance pour qui joue. Depuis le
// 16 octobre 2026, le dé à chances égales : sur la cote qu'on voit, Automate
// compte comme un adversaire de sa cote, son score n'y est plus pour rien ;
// et depuis le 17, l'ELO ne commence qu'à la Platine, qui se garde (plus bas
// aussi).
//
// Tout se relit dans le journal des rencontres finies (`releverLesDuels`) : la
// cote, les ligues de chaque semaine, les confettis qu'elles ont payés. Une
// règle changée vaut aussitôt pour tout ce qui a été joué, comme les
// confettis des soirées — rien ne se tient à côté.

import type { Adversaire, ResumeDeRencontre, RencontreDeCampagne, SonApparence } from './campagne'
import type { Finition } from './profil'
import type { LaurierPorte } from './jour'

/** La cote de tout le monde au premier duel : celle d'un joueur qui finit sa série vers sept bonnes réponses. */
export const COTE_DE_DEPART = 1000

/**
 * Le nom et l'avatar d'Automate, l'adversaire simulé du dé
 * (`core/campagne.ts`) : sans article, il se lit partout — « Toi 7 –
 * Automate 6 », « le score d'Automate ». Ici plutôt qu'au serveur : la
 * feuille du dé le montre avant d'avoir rien tiré.
 */
export const AUTOMATE = { nom: 'Automate', avatar: '🤖' } as const

/**
 * Le score qui vaut la cote de départ — le niveau de qui n'a encore rien
 * répondu, contre qui Automate joue son premier duel (`core/modeleDuSavoir.ts`).
 * Huit jusqu'au 14 octobre 2026, posé sans mesure : une bonne réponse
 * au-dessus du joueur réel. La médiane des séries de campagne allées au bout,
 * et celle des moyennes de chaque joueur, valent sept en production
 * (`server/scripts/calibrage-duels.ts`) : chacun partait au-dessus de son
 * niveau et commençait par reculer, et Automate jouait un peu trop fort
 * contre qui la campagne connaissait mal.
 */
export const SCORE_DE_REFERENCE = 7

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
 * que ses réponses de campagne disent de lui (le modèle du savoir) — des
 * parties serrées dès le premier duel, quand sa cote ne dit encore rien de
 * lui ; ensuite, celui de sa cote cachée, qui a appris de ses duels. Jamais
 * la cote qu'on voit : la montée la porte au-dessus de son niveau, et un
 * Automate réglé sur elle ferait perdre plus souvent.
 */
export const niveauPourLeDuel = (joues: number, cachee: number, niveauDeCampagne: number): number =>
  joues < DUELS_DE_PLACEMENT ? niveauDeCampagne : niveauDeLaCote(cachee)

/** Ses chances de gagner, à la manière de l'ELO : 0,5 à cotes égales, 0,24 contre deux cents points de plus. */
export const chancesDeGagner = (cote: number, adverse: number): number => 1 / (1 + 10 ** ((adverse - cote) / 400))

/** Le poids d'un duel selon ceux déjà joués : double pendant le placement. */
export const poidsDuDuel = (dejaJoues: number): number => (dejaJoues < DUELS_DE_PLACEMENT ? POIDS_DU_PLACEMENT : POIDS_D_UN_DUEL)

/** Gagné, égalité, perdu : ce que vaut l'issue d'un duel. */
export type Resultat = 1 | 0.5 | 0

export const resultatDuDuel = (toi: number, lui: number): Resultat => (toi > lui ? 1 : toi === lui ? 0.5 : 0)

/**
 * Ce qu'un duel fait à la cote cachée — l'ELO seul —, en points entiers : la
 * cote ne garde pas de virgule qui ferait mentir la somme des écarts.
 * `adverse` : la force d'en face — la cote de son score (`coteDuScore`)
 * contre une série rejouée, sa cote cachée figée au lancement contre un
 * joueur défié.
 */
export function ecartContre(cote: number, adverse: number, dejaJoues: number, resultat: Resultat): number {
  return Math.round(poidsDuDuel(dejaJoues) * (resultat - chancesDeGagner(cote, adverse)))
}

/** L'écart d'une rencontre sur la cote cachée : contre la cote de son score. */
export function ecartDuDuel(cote: number, sesJustes: number, dejaJoues: number, resultat: Resultat): number {
  return ecartContre(cote, coteDuScore(sesJustes), dejaJoues, resultat)
}

// ── La montée ───────────────────────────────────────────────────────────────
//
// Le choix du propriétaire du 14 octobre 2026, après le « je fais que
// reculer » d'une joueuse qui lançait beaucoup de duels : « je veux que tout
// le monde monte en Or s'il joue, même s'il n'est pas très bon ». L'ELO seul
// mesurait le niveau : un joueur de la médiane restait en Bronze même après
// deux cents duels, les trois plus actifs de la production étaient sous 1000
// (947 de médiane), et une partie sur deux faisait reculer.
//
// Deux cotes, donc. La cachée, l'ELO d'avant (`ecartContre`), dit le niveau
// et règle Automate (`niveauPourLeDuel`) : réglé sur la cote qu'on voit, qui
// monte au-dessus du niveau, il se renforcerait, et l'on perdrait plus souvent
// — la moitié des duels au lieu de quatre sur dix, simulé. Celle qu'on voit,
// celle des ligues, avance :
// - sous l'Or, chaque duel rapporte `PARTICIPATION_SOUS_L_OR`, et une défaite
//   ne coûte que `PERTE_SOUS_L_OR` de ce que l'ELO lui ferait payer : au pire
//   un point, pour une victoire d'au moins cinq. Contre Automate, réglé sur
//   son niveau, chacun gagne quatre duels sur dix : qui joue monte en Or,
//   même pas très fort ;
// - en Or, chaque duel rapporte `PARTICIPATION_AU_DESSUS`, et l'enjeu suit
//   l'écart : une défaite coûte `POIDS_D_UN_DUEL` × E² (E, ses chances) —
//   presque rien contre plus fort, beaucoup contre plus faible : on ne gagne
//   rien à s'acharner sur les petits ;
// - à partir de la Platine (`LIGUE_DE_L_ELO`), la participation plus l'ELO,
//   `POIDS_D_UN_DUEL` × (résultat − E) : à chances égales, une défaite coûte
//   ce qu'une victoire rapporte (le choix du 17 octobre 2026, plus bas) ;
// - qui lance un défi gagne `PART_DU_LANCEUR` de plus : provoquer paie ;
// - l'Argent, l'Or et la Platine, une fois atteints, ne se perdent plus
//   (`LIGUES_GARDEES`) — la Platine depuis le 17 octobre 2026 ;
// - un adversaire plus bas que ses ligues gardées compte à son plancher
//   (`apresLeDuel`, le 17 octobre 2026 aussi, plus bas).
// Pas de placement sur elle : le poids double des dix premiers duels sert à
// trouver vite le niveau, la cote cachée. Rejoués sur les vrais duels de
// production (`calibrage-duels.ts`), les trois joueurs les plus actifs
// passaient de 947 (Bronze) à l'Argent et l'Or ; à +4 sous l'Or, personne n'y
// arrivait encore. Des choix de produit, relus à chaque lecture.
//
// Puis le dé à chances égales (le choix du propriétaire du 16 octobre 2026,
// après « je perds 17 pour gagner 4. C'est normal ? »). Automate joue au
// niveau de la cote cachée — on le bat quatre duels sur dix —, mais l'enjeu
// lisait son score contre la cote qu'on voit, que la montée et les duels
// entre amis portaient de 260 à 310 points plus haut (les quatre joueurs en
// Or de la production) : pour la formule, 85 à 88 % de chances, « +4 / −17 »,
// six points perdus par duel en moyenne, et cent duels ramenaient chacun au
// plancher de l'Or. Sur la cote qu'on voit, il compte désormais comme un
// adversaire de sa cote (`forceQuOnVoit`) : « +17 / +2 » sous l'Or,
// « +13 / −5 » en Or, « +13 / −11 » dès la Platine, dit avant de tirer
// (`enjeuDuDe`) — le dé demande, puis tire. La cachée, elle, bouge toujours
// contre son score : c'est elle qui apprend le niveau.
//
// Puis la Platine, où « ça commence vraiment » (le choix du propriétaire du
// 17 octobre 2026). À chances égales, 24 × E² fait monter — « +13 / −5 »,
// quatre points par duel en moyenne —, et rien ne l'arrêtait : tout joueur
// assidu aurait fini chez les maîtres, et entre amis, le haut montait déjà
// de 2,3 points par duel. Le 16, l'ELO devait le remplacer dès l'Or — de
// 19 à 42 points repris aux joueurs en Or ; le propriétaire a gardé l'Or tel
// quel — « monter jusqu'en platine c'est bien comme ça » —, et l'ELO ne
// commence qu'à la Platine (`LIGUE_DE_L_ELO`), qui ne se perd plus une fois
// atteinte. Qui joue monte jusqu'en Platine ; au-delà, on monte en gagnant :
// à ses vraies chances, un duel n'y rapporte que son point de participation,
// et au dé, où l'on gagne quatre duels sur dix, « +13 / −11 » ne fait plus
// monter.
//
// Puis l'adversaire plus bas (le même jour : « de jouer des joueurs qui
// jouent peu et qui sont en ligue bronze, ça fait perdre beaucoup à des
// platines, ça donne donc pas envie de jouer le duel »). Sous la Platine, la
// cote qu'on voit dit surtout combien on a joué : un bronze a peu joué, il
// n'est pas plus faible. En production, les joueurs en Or ne battaient les
// bronzes qu'une fois sur trois, quand la formule leur prêtait 75 % de
// chances — les cotes cachées, 49 %. Sur la cote qu'on voit, un adversaire
// sous ses ligues gardées compte donc à son plancher (`apresLeDuel`) : en
// Platine, un bronze vaut 1300, la cote où chacun y entre — « +12 / −12 » à
// 1330, plus « +5 / −19 » ; en Or, « +11 / −7 », plus « +6 / −14 ». Entre
// joueurs de la Platine, rien ne change, et un diamant reste favori contre
// qui vient d'y entrer : battre des bronzes ne fait pas monter sans fin,
// comme des chances égales contre plus bas l'auraient permis. Les chances des
// cotes cachées, justes duel par duel, auraient fait de la cote au-dessus de
// la Platine un compte des duels joués — chacun y aurait gagné son point de
// participation en moyenne, fort ou pas —, et l'enjeu les aurait trahies.

/** Ce que chaque duel rapporte à la cote qu'on voit : sous l'Or, et à partir de l'Or. */
export const PARTICIPATION_SOUS_L_OR = 5
export const PARTICIPATION_AU_DESSUS = 1

/** Ce que gagne de plus, sur la cote qu'on voit, qui lance un défi à quelqu'un : provoquer paie. */
export const PART_DU_LANCEUR = 1

/** La part de sa défaite qu'il paie sous l'Or, de ce que l'ELO lui ferait payer. */
export const PERTE_SOUS_L_OR = 0.25

/** Les ligues qui ne se perdent plus une fois atteintes : la cote qu'on voit ne redescend plus sous leur seuil. */
export const LIGUES_GARDEES: readonly CleDeLigue[] = ['argent', 'or', 'platine']

/** La ligue où la montée devient l'ELO : en dessous, une défaite coûte moins qu'une victoire ne rapporte, à chances égales ; à partir d'elle, autant. */
export const LIGUE_DE_L_ELO: CleDeLigue = 'platine'

/**
 * Les réglages de la montée, ensemble : `calibrage-duels.ts` en essaie
 * d'autres sur les vrais duels, avec la vraie formule — une copie de la
 * formule dans le script aurait pu s'écarter de celle-ci sans un mot.
 */
export interface ReglagesDeLaMontee {
  sousLOr: number
  auDessus: number
  lanceur: number
  perteSousLOr: number
}

/** Ceux de l'application. */
export const MONTEE: ReglagesDeLaMontee = {
  sousLOr: PARTICIPATION_SOUS_L_OR,
  auDessus: PARTICIPATION_AU_DESSUS,
  lanceur: PART_DU_LANCEUR,
  perteSousLOr: PERTE_SOUS_L_OR,
}

const SEUIL_DE_L_OR = PAR_CLE.get('or')!.depuis
const SEUIL_DE_L_ELO = PAR_CLE.get(LIGUE_DE_L_ELO)!.depuis

/** Le plancher de la cote qu'on voit, une cote atteinte : le seuil de la plus haute ligue gardée qu'elle a passé — null tant qu'aucune. */
export function plancherApres(plancher: number | null, cote: number): number | null {
  let p = plancher
  for (const cle of LIGUES_GARDEES) {
    const seuil = PAR_CLE.get(cle)!.depuis
    if (cote >= seuil && (p === null || seuil > p)) p = seuil
  }
  return p
}

/**
 * Ce qu'un duel fait à la cote qu'on voit, avant son plancher : contre la
 * force d'en face qu'on voit aussi (`forceQuOnVoit`), avec la part de qui a
 * lancé le défi.
 */
export function ecartDeLaMontee(cote: number, adverse: number, resultat: Resultat, lance = false, reglages: ReglagesDeLaMontee = MONTEE): number {
  const e = chancesDeGagner(cote, adverse)
  const sousLOr = cote < SEUIL_DE_L_OR
  const part = (sousLOr ? reglages.sousLOr : reglages.auDessus) + (lance ? reglages.lanceur : 0)
  // À partir de la Platine, l'ELO : 24 × E² y faisait monter qui jouait à chances égales (le choix du 17 octobre 2026, plus haut).
  if (cote >= SEUIL_DE_L_ELO) return Math.round(part + POIDS_D_UN_DUEL * (resultat - e))
  const perte = POIDS_D_UN_DUEL * e * (sousLOr ? reglages.perteSousLOr : e)
  if (resultat === 1) return Math.round(part + POIDS_D_UN_DUEL * (1 - e))
  // Une égalité contre plus fort rapporte ce que l'ELO lui donnerait ; contre plus faible, elle coûte la moitié d'une défaite.
  if (resultat === 0.5) return Math.round(part + (e < 0.5 ? POIDS_D_UN_DUEL * (0.5 - e) : -perte / 2))
  return Math.round(part - perte)
}

/**
 * La force d'en face sur la cote qu'on voit : contre quelqu'un, sa cote
 * figée au lancement — comptée jamais sous son plancher (`apresLeDuel`) ;
 * au dé, la sienne même — Automate joue à son niveau, un duel à chances
 * égales (le choix du 16 octobre 2026, plus haut). Contre la cote de son
 * score, la cote qu'on voit, portée au-dessus du niveau par la montée, lui
 * prêtait 85 % de chances : « +4 / −17 ».
 */
export const forceQuOnVoit = (d: Pick<DuelJoue, 'coteAdverse'>, cote: number): number => d.coteAdverse ?? cote

/**
 * La cote qu'on voit après un duel, et son plancher : l'écart, contre une
 * force d'en face qui ne compte jamais sous ce plancher, puis jamais sous une
 * ligue gardée.
 */
export function apresLeDuel(
  cote: number,
  plancher: number | null,
  adverse: number,
  resultat: Resultat,
  lance = false,
  reglages: ReglagesDeLaMontee = MONTEE,
): { cote: number; plancher: number | null } {
  // Sous ses ligues gardées, la cote d'en face dit combien il a joué, pas comment : il compte à son plancher. En
  // Platine, un bronze faisait « +5 / −19 » sous l'ELO (le choix du 17 octobre 2026, plus haut).
  const brute = cote + ecartDeLaMontee(cote, Math.max(adverse, plancher ?? adverse), resultat, lance, reglages)
  const p = plancherApres(plancher, brute)
  return { cote: p === null ? brute : Math.max(brute, p), plancher: p }
}

/** Ce qu'un duel met en jeu, dit avant de le jouer : sa cote, et ce que lui ferait chaque issue. */
export interface EnjeuDuDuel {
  cote: number
  gagne: number
  egalite: number
  perdu: number
}

/** Où il en est, pour dire ce qu'un duel mettrait en jeu : la cote qu'on voit, et son plancher (`ReleveDesDuels`). */
export interface SaCote {
  cote: number
  plancher?: number | null
}

/**
 * Ce que met en jeu un duel contre une force d'en face : ce que chaque issue
 * ferait à la cote qu'on voit, plancher compris — sous l'Or, « +16 si tu
 * gagnes, +2 même si tu perds » ; plus bas que lui, l'adversaire y compte
 * (`apresLeDuel`). `lance` : c'est lui qui lance le défi.
 */
export function enjeuContre(moi: SaCote, adverse: number, lance = false): EnjeuDuDuel {
  const issue = (r: Resultat) => apresLeDuel(moi.cote, moi.plancher ?? null, adverse, r, lance).cote - moi.cote
  return { cote: moi.cote, gagne: issue(1), egalite: issue(0.5), perdu: issue(0) }
}

/**
 * Ce que met en jeu un duel au dé, connu avant de tirer : à chances égales,
 * contre sa propre cote (`forceQuOnVoit`) — le score d'Automate n'y est pour
 * rien. Son plancher se lit de sa cote même : une ligue gardée atteinte, elle
 * ne repasse jamais dessous (`releverLesDuels`).
 */
export const enjeuDuDe = (cote: number): EnjeuDuDuel => enjeuContre({ cote, plancher: plancherApres(null, cote) }, cote)

/**
 * Un duel classé fini, tel que le journal le garde : sa série, ses bonnes
 * réponses, celles d'en face, quand il a fini — et, contre un joueur défié,
 * ses cotes figées au lancement, contre lesquelles on bouge, et qui l'a lancé.
 */
export interface DuelJoue {
  serie: string
  justes: number
  sesJustes: number
  finiLe: number
  /** Contre un joueur défié : sa cote qu'on voit, figée au lancement — la cote qu'on voit bouge contre elle. */
  coteAdverse?: number
  /** Et sa cote cachée, figée avec : la cote cachée bouge contre elle. Un duel d'avant la montée n'en a pas : sa cote figée en tient lieu. */
  coteCacheeAdverse?: number
  /** C'est lui qui a lancé ce défi : `PART_DU_LANCEUR`. */
  lance?: true
}

/**
 * Une semaine de duels : combien, la meilleure cote qu'elle a vue — celle du
 * lundi comprise —, et celle avec laquelle il y est entré : de quoi dire les
 * places que la semaine lui a fait gagner (`ClassementDesDuels.progression`).
 */
export interface SemaineJouee {
  duels: number
  meilleure: number
  debut: number
}

// ── Les bordures de ligue ───────────────────────────────────────────────────
//
// Le souhait du propriétaire du 12 octobre 2026, sur la maquette des
// alliages : chaque ligue atteinte ouvre sa bordure crantée autour de
// l'avatar — la ligue en donne la forme et la pierre, la finition le métal —,
// et chaque duel gagné dans cette ligue en sertit un cran. Rien ne se tient à
// côté : comme la cote, les crans se relisent dans le journal des duels
// (`releverLesDuels`), et ne font que monter — redescendre de ligue ne
// reprend ni la bordure ni ses crans. Seul le choix de celle qu'on porte
// s'enregistre (`profiles.bordure`).

/** Les crans d'une bordure : un par duel gagné dans sa ligue — au douzième, elle est sertie. */
export const CRANS_D_UNE_BORDURE = 12

/** La bordure d'une ligue atteinte : ses crans sertis, ses duels gagnés dans la ligue (`CRANS_D_UNE_BORDURE` au plus). */
export interface BordureDeLigue {
  ligue: CleDeLigue
  crans: number
}

/** Le nom de la bordure de chaque ligue, dans une phrase comme sur une pastille. */
export const NOM_DE_LA_BORDURE: Record<CleDeLigue, string> = {
  bronze: 'Le Moletage',
  argent: 'Le Perlé',
  or: 'Les Fleurons',
  platine: 'Le Givre',
  diamant: 'La Couronne de brillants',
  maitre: 'Le Soleil noir',
}

/** Ne porter aucune bordure, même celles qu'on a. */
export const AUCUNE_BORDURE = 'aucune'

/**
 * Ce qu'il a choisi de porter : `auto` — sa plus haute bordure qui a un cran
 * au moins —, `aucune`, ou la bordure d'une ligue qu'il a atteinte.
 */
export type ChoixDeBordure = 'auto' | typeof AUCUNE_BORDURE | CleDeLigue

/** Un choix de bordure, tel qu'il arrive d'une page ou de la base : ce qui n'en est pas un vaut `auto`. */
export function choixDeBordure(brut: unknown): ChoixDeBordure {
  if (brut === AUCUNE_BORDURE) return AUCUNE_BORDURE
  return PAR_CLE.has(brut as CleDeLigue) ? (brut as CleDeLigue) : 'auto'
}

/**
 * La bordure qu'il porte. `auto` : la plus haute ligue où il a serti un cran
 * au moins — une bordure encore vide ne s'impose à personne, il la choisit
 * s'il veut la montrer ; `aucune` : rien. Une ligue qu'il n'a pas (une page
 * d'avant, une règle changée) se lit `auto`.
 */
export function bordurePortee(choix: unknown, bordures: readonly BordureDeLigue[] | undefined): BordureDeLigue | null {
  const c = choixDeBordure(choix)
  if (c === AUCUNE_BORDURE || !bordures) return null
  if (c !== 'auto') {
    const choisie = bordures.find(b => b.ligue === c)
    if (choisie) return choisie
  }
  for (let i = bordures.length - 1; i >= 0; i--) if (bordures[i].crans > 0) return bordures[i]
  return null
}

/** Ce que ses duels disent de lui : sa cote, et de quoi raconter chaque duel et chaque semaine. */
export interface ReleveDesDuels {
  /** La cote qu'on voit, celle des ligues, du classement et des bordures (la montée). */
  cote: number
  /** La cote cachée, l'ELO seul : son niveau, sur lequel Automate se règle (`niveauPourLeDuel`). */
  cachee: number
  /** Le plancher de la cote qu'on voit : le seuil de la plus haute ligue gardée qu'il a atteinte — null tant qu'aucune. */
  plancher: number | null
  joues: number
  /** L'écart de chaque duel, sous sa série : ce que sa fin a dit, et sa ligne dans la liste. */
  ecarts: Map<string, { avant: number; ecart: number }>
  semaines: Map<string, SemaineJouee>
  /** Son premier duel fini : deux homonymes au classement, le second arrivé porte la marque. */
  premierLe: number | null
  /** Son dernier duel fini, ou null : le classement ne nomme que ceux qui jouent encore. */
  dernierLe: number | null
  /**
   * Les bordures de ses ligues atteintes, de la plus basse à la plus haute —
   * toutes celles sous la plus haute cote qu'il a eue —, et leurs crans.
   * Vide tant qu'il n'a fini aucun duel : l'absence, pas une bordure de bronze.
   */
  bordures: BordureDeLigue[]
}

/**
 * Relit ses duels, du plus ancien au plus récent : ses deux cotes partent de
 * `COTE_DE_DEPART`. La cachée suit l'ELO seul, placement compris, contre le
 * score d'Automate au dé ; celle qu'on voit, la montée (`apresLeDuel`), contre
 * sa propre cote au dé (`forceQuOnVoit`) — c'est elle que disent les écarts,
 * les semaines et les bordures. Chaque semaine (`semaineDe`, le lundi de
 * Paris) retient ses duels et la meilleure cote qu'elle a vue — celle qu'il
 * avait en y entrant comprise : il était dans sa ligue avant de jouer, et un
 * duel perdu le lundi ne lui reprend pas sa récompense. Un duel gagné sertit
 * un cran de la ligue où il l'a joué — celle de sa cote avant le duel —, et
 * la plus haute cote atteinte ouvre les bordures de toutes les ligues jusqu'à
 * elle.
 */
export function releverLesDuels(duels: readonly DuelJoue[], semaineDe: (instant: number) => string): ReleveDesDuels {
  const ordre = [...duels].sort((a, b) => a.finiLe - b.finiLe || (a.serie < b.serie ? -1 : a.serie > b.serie ? 1 : 0))
  let cote = COTE_DE_DEPART
  let cachee = COTE_DE_DEPART
  let plancher: number | null = null
  let plusHaute = cote
  const victoires = new Map<CleDeLigue, number>()
  const ecarts = new Map<string, { avant: number; ecart: number }>()
  const semaines = new Map<string, SemaineJouee>()
  ordre.forEach((d, i) => {
    const resultat = resultatDuDuel(d.justes, d.sesJustes)
    const sonScore = coteDuScore(d.sesJustes)
    // Un duel d'avant la montée n'a figé qu'une cote, celle de l'ELO d'alors : la cachée bouge contre elle.
    cachee += ecartContre(cachee, d.coteCacheeAdverse ?? d.coteAdverse ?? sonScore, i, resultat)
    const apres = apresLeDuel(cote, plancher, forceQuOnVoit(d, cote), resultat, d.lance === true)
    const semaine = semaineDe(d.finiLe)
    const s = semaines.get(semaine) ?? { duels: 0, meilleure: cote, debut: cote }
    ecarts.set(d.serie, { avant: cote, ecart: apres.cote - cote })
    if (resultat === 1) {
      const ici = ligueDe(cote).cle
      victoires.set(ici, (victoires.get(ici) ?? 0) + 1)
    }
    cote = apres.cote
    plancher = apres.plancher
    plusHaute = Math.max(plusHaute, cote)
    semaines.set(semaine, { duels: s.duels + 1, meilleure: Math.max(s.meilleure, cote), debut: s.debut })
  })
  const atteintes = ordre.length > 0 ? LIGUES.slice(0, LIGUES.indexOf(ligueDe(plusHaute)) + 1) : []
  return {
    cote,
    cachee,
    plancher,
    joues: ordre.length,
    ecarts,
    semaines,
    premierLe: ordre.length > 0 ? ordre[0].finiLe : null,
    dernierLe: ordre.length > 0 ? ordre[ordre.length - 1].finiLe : null,
    bordures: atteintes.map(l => ({ ligue: l.cle, crans: Math.min(CRANS_D_UNE_BORDURE, victoires.get(l.cle) ?? 0) })),
  }
}

/** La ligue qu'une semaine retient : la meilleure qu'elle a vue — sans duel, celle qu'il avait. */
export const ligueDeLaSemaine = (s: Pick<SemaineJouee, 'meilleure'> | undefined, cote: number): Ligue => ligueDe(s ? s.meilleure : cote)

/** Ce qu'une semaine rapporte : sa meilleure ligue, si elle a eu ses duels. */
export function recompenseDeLaSemaine(s: Pick<SemaineJouee, 'duels' | 'meilleure'> | undefined): number {
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

// ── Le bilan de ses duels ────────────────────────────────────────────────────
//
// Le souhait du propriétaire du 13 octobre 2026 : un historique « un peu
// pauvre niveau métriques » — trois lignes et des barres. Son bilan, ses
// records, ses face-à-face, la courbe de sa cote, tous ses duels : comme la
// cote, tout se relit dans le journal de ses duels à chaque lecture
// (`bilanDesDuels`), rien ne se tient à côté. Un résultat qu'il n'a pas encore
// vu n'y compte pas : sa carte se retourne d'abord.

/** Un duel classé fini, et contre qui : un profil — '' pour Automate, qui n'en a pas. */
export interface DuelRaconte extends DuelJoue {
  contre: string
  /** Un duel contre quelqu'un : son code, que sa ligne d'historique rouvre — sans lui, un duel au dé. */
  code?: string
  /** Son résultat, qu'il n'a pas encore vu : le bilan le tait. */
  aVoir?: true
}

/** Ses face-à-face qu'on montre : ses adversaires les plus affrontés. */
export const FACE_A_FACE_MONTRES = 6

/** La courbe de sa cote : ses derniers duels, un point chacun. */
export const POINTS_DE_LA_COURBE = 30

/** Contre qui, tel que sa page le dit : un joueur — sa ligue, ce qu'il porte —, ou Automate, sans profil. */
export interface QuiAffronte extends SonApparence {
  profileId?: string
  nom: string
  avatar: string
  ligue?: CleDeLigue
}

/** Son bilan contre un adversaire : une ligne de ses face-à-face (`FaceAFace`, lui, dit un joueur touché). */
export interface BilanContre<Qui = QuiAffronte> {
  contre: Qui
  victoires: number
  defaites: number
  egalites: number
}

/** Ce que ses duels disent de lui, tous ceux qu'il a vus : de quoi remplir son historique. */
export interface BilanDesDuels<Qui = QuiAffronte> {
  joues: number
  victoires: number
  defaites: number
  egalites: number
  /** Ses victoires d'affilée jusqu'à son dernier duel : 0 s'il ne l'a pas gagné. */
  serie: number
  meilleureSerie: number
  /** La plus haute cote qu'il ait tenue, celle de départ comprise. */
  plusHaute: number
  /** Sa plus belle victoire : celle qui a le plus rapporté — la plus récente, à égalité. */
  plusBelle?: { contre: Qui; justes: number; sesJustes: number; ecart: number; le: number }
  /** Ses adversaires, les plus affrontés d'abord — les plus récents, à nombre égal. */
  faceAFace: BilanContre<Qui>[]
  /** Sa cote avant ses derniers duels (`POINTS_DE_LA_COURBE`), puis après chacun. */
  courbe: number[]
}

/** L'ordre du journal : celui où `releverLesDuels` les relit. */
const dansLOrdre = (a: DuelJoue, b: DuelJoue) => a.finiLe - b.finiLe || (a.serie < b.serie ? -1 : a.serie > b.serie ? 1 : 0)

/**
 * Le bilan de ses duels, relu dans son journal : chaque duel compté une fois,
 * avec l'écart que la cote lui a donné (`ReleveDesDuels.ecarts`) — un duel
 * que le relevé ne connaît pas ne compte pas plus ici. Une égalité rompt une
 * série de victoires comme une défaite. Pur : une archive se relit pareil.
 */
export function bilanDesDuels(duels: readonly DuelRaconte[], ecarts: ReleveDesDuels['ecarts']): BilanDesDuels<string> {
  const vus = duels.filter(d => !d.aVoir && ecarts.has(d.serie)).sort(dansLOrdre)
  const bilan: BilanDesDuels<string> = { joues: vus.length, victoires: 0, defaites: 0, egalites: 0, serie: 0, meilleureSerie: 0, plusHaute: COTE_DE_DEPART, faceAFace: [], courbe: [] }
  const parAdversaire = new Map<string, BilanContre<string> & { dernier: number }>()
  const apres: number[] = []
  vus.forEach((d, i) => {
    const { avant, ecart } = ecarts.get(d.serie)!
    const resultat = resultatDuDuel(d.justes, d.sesJustes)
    const face = parAdversaire.get(d.contre) ?? { contre: d.contre, victoires: 0, defaites: 0, egalites: 0, dernier: i }
    face.dernier = i
    if (resultat === 1) {
      bilan.victoires++
      face.victoires++
      bilan.serie++
      bilan.meilleureSerie = Math.max(bilan.meilleureSerie, bilan.serie)
      if (!bilan.plusBelle || ecart >= bilan.plusBelle.ecart) bilan.plusBelle = { contre: d.contre, justes: d.justes, sesJustes: d.sesJustes, ecart, le: d.finiLe }
    } else {
      bilan.serie = 0
      if (resultat === 0) {
        bilan.defaites++
        face.defaites++
      } else {
        bilan.egalites++
        face.egalites++
      }
    }
    parAdversaire.set(d.contre, face)
    bilan.plusHaute = Math.max(bilan.plusHaute, avant + ecart)
    apres.push(avant + ecart)
  })
  const total = (f: BilanContre<string>) => f.victoires + f.defaites + f.egalites
  bilan.faceAFace = [...parAdversaire.values()]
    .sort((a, b) => total(b) - total(a) || b.dernier - a.dernier)
    .map(({ dernier: _, ...face }) => face)
  const derniers = vus.slice(-POINTS_DE_LA_COURBE)
  if (derniers.length > 0) bilan.courbe = [ecarts.get(derniers[0].serie)!.avant, ...apres.slice(-POINTS_DE_LA_COURBE)]
  return bilan
}

/**
 * Un duel joué, tel que l'historique le dit : contre qui, les deux scores, ce
 * qu'il a fait à sa cote, quand — et ce qu'un toucher rouvre : la page d'un
 * duel contre quelqu'un, sa correction comprise ; la correction d'un duel au
 * dé, qui n'a pas de page.
 */
export interface DuelDeLHistoire {
  cle: string
  contre: QuiAffronte
  justes: number
  sesJustes: number
  ecart: number
  le: number
  /** Un duel contre quelqu'un : sa page. */
  code?: string
  /** Un duel au dé : sa série, dont la ligne ouvre la correction. */
  serie?: string
}

/** Ses duels joués, une page de son historique : la suite, s'il y en a, se demande (`GET /api/duels/historique`). */
export interface PageDHistoire {
  duels: DuelDeLHistoire[]
  suite: boolean
}

/** L'historique se lit page par page : les dix premiers avec la page des duels, vingt à chaque « Voir plus ». */
export const DUELS_DE_L_HISTOIRE = 10
export const DUELS_PAR_SUITE = 20

/** L'historique remonte un mois : au-delà, son bilan le dit. */
export const JOURS_DE_L_HISTOIRE = 30

/**
 * Une page de son historique : ses duels vus, finis depuis `depuis`, après le
 * curseur — le dernier de la page d'avant, sa date puis sa série : deux duels
 * de la même milliseconde ne se perdent pas entre deux pages —, les plus
 * récents d'abord, chacun avec ce qu'il a fait à sa cote.
 */
export function pageDeLHistoire(
  duels: readonly DuelRaconte[],
  ecarts: ReleveDesDuels['ecarts'],
  depuis: number,
  n: number,
  apres?: { le: number; cle: string },
): { duels: (DuelRaconte & { ecart: number })[]; suite: boolean } {
  const plusAncien = (d: DuelRaconte) => !apres || d.finiLe < apres.le || (d.finiLe === apres.le && d.serie < apres.cle)
  const vus = duels.filter(d => !d.aVoir && ecarts.has(d.serie) && d.finiLe >= depuis && plusAncien(d)).sort((a, b) => dansLOrdre(b, a))
  return { duels: vus.slice(0, n).map(d => ({ ...d, ecart: ecarts.get(d.serie)!.ecart })), suite: vus.length > n }
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
  /** Sa place au classement des duels, sa cote d'après comptée (`rangAuxDuels`) : la carte du verdict la dit sous sa cote. */
  rang?: number
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
  /** La bordure de ligue qu'il porte, s'il en porte une (`bordurePortee`). */
  bordure?: BordureDeLigue
  cote: number
  ligue: CleDeLigue
  rang: number
  /** Ses duels classés, tous : un débutant chanceux se distingue d'un habitué. */
  duels: number
  /**
   * Les places qu'il a gagnées depuis lundi (perdues, en négatif), comme un
   * tableau sportif : absent s'il n'a pas bougé, ou n'était pas classé avant
   * cette semaine.
   */
  progression?: number
}

/** « À ta portée » : les joueurs juste au-dessus de sa cote qu'on lui propose de défier. */
export const JOUEURS_A_PORTEE = 3

export interface ClassementDesDuels {
  joueurs: number
  lignes: LigneDesDuels[]
  /** Sa ligne, si elle n'est pas dans celles qu'on montre. */
  moi?: LigneDesDuels
  /** Qui regarde, s'il est classé : sa ligne se distingue. */
  sienne?: string
  /**
   * Sa ligne entre ses deux voisins — celui juste devant, celui juste
   * derrière, s'ils existent : l'onglet du classement les montre, même
   * au-delà des lignes qu'on envoie.
   */
  autour?: LigneDesDuels[]
  /**
   * Les places qu'il a gagnées depuis lundi (perdues, en négatif) : sa place
   * d'aujourd'hui contre celle qu'il aurait eue avec la cote de chacun au
   * lundi. Absente s'il n'était pas classé avant cette semaine.
   */
  progression?: number
  /**
   * Ceux qu'il peut aller chercher, le plus proche d'abord : les joueurs
   * juste au-dessus de sa cote (`JOUEURS_A_PORTEE`) — classé ou pas, de sa
   * cote à lui. En tête, personne au-dessus : ceux qui le talonnent
   * (`enTete`). L'onglet les montre avec ce qu'il gagnerait, et « Défier ».
   */
  aPortee?: LigneDesDuels[]
  /** En tête du classement : `aPortee` dit ceux qui le talonnent. */
  enTete?: true
}

/**
 * Un joueur qu'on peut défier — trouvé par son prénom, dans sa liste d'amis,
 * sur une ligne du classement : de quoi le reconnaître et savoir contre qui
 * on joue.
 */
export interface JoueurADefier extends SonApparence {
  profileId: string
  /** Son prénom, marqué « (2) » s'il en partage un autre et l'avatar avec (`nomsAffiches`). */
  nom: string
  avatar: string
  /** Sa cote et sa ligue, s'il a fini un duel classé — rien sinon : l'absence, pas une ligue de bronze. */
  cote?: number
  ligue?: CleDeLigue
  /** Sa place au classement des duels, s'il y est. */
  rang?: number
  /** Dans sa liste d'amis. */
  ami?: true
}

/**
 * Où en est le duel classé ouvert entre deux joueurs — un seul à la fois —,
 * vu de l'un d'eux : `a-finir`, il l'a lancé et sa tentative attend sa
 * dernière réponse ; `chez-l-autre`, il l'a lancé et joué, l'autre pas
 * encore ; `a-relever`, l'autre le lui a lancé, et il lui est parvenu ;
 * `a-venir`, l'autre le joue encore — il lui partira à sa dernière réponse ;
 * `retenu`, l'autre l'a joué, mais il l'avait retiré de ses amis : remis, il
 * le reçoit (`CampagneStore.ajouterUnAmi`).
 */
export type OuEnEstLeDuel = 'a-finir' | 'chez-l-autre' | 'a-relever' | 'a-venir' | 'retenu'

/**
 * Le duel classé ouvert entre eux, que sa carte dit à la place de « Défier »,
 * et la préparation sous lui (`FaceAFace.enCours`) : on défiait qui l'on
 * défiait déjà, et le refus ne tombait qu'au bout de la préparation (le
 * retour du propriétaire du 15 octobre 2026). Le refus d'un second duel et
 * ce qu'elles disent lisent la même règle (`CampagneStore.duelOuvertEntre`).
 */
export interface DuelOuvert {
  ou: OuEnEstLeDuel
  /**
   * Son code, que la carte rouvre — seulement s'il est à lui : lancé par lui,
   * ou parvenu. Avant, il n'existe pas pour lui (`DuelContre`), et son code
   * le laisserait jouer avant celui qui l'a lancé.
   */
  code?: string
}

/**
 * Un joueur touché hors d'une soirée — sa carte, une ligne de ses amis, la
 * préparation ouverte à son adresse (`/duels#defier-<id>`) : ce que les duels
 * savent de lui — sa ligue, sa cote, sa place, s'il est son ami —, sa propre
 * cote, pour dire ce qui se joue (`GET /api/duels/joueurs/:id`), et le duel
 * déjà ouvert entre eux, s'il y en a un.
 */
export interface FaceAFace {
  joueur: JoueurADefier
  /** Sa cote, ses duels joués, et le plancher de sa cote (absent : aucune ligue gardée, ou un serveur d'avant). */
  moi: { cote: number; joues: number; plancher?: number }
  /** Le duel classé déjà ouvert entre eux : un seul à la fois, la carte le dit au lieu de « Défier » (absent : aucun, ou un serveur d'avant). */
  enCours?: DuelOuvert
}

/**
 * Pourquoi un joueur croisé paraît, du plus proche au plus lointain : une
 * soirée jouée ensemble, un duel entre eux, le défi de la semaine, une cote
 * proche de la sienne.
 */
export type Croisement = 'soiree' | 'duel' | 'defi' | 'niveau'

/** Ce que sa ligne en dit — sans genre : on ne devine pas celui d'un prénom. */
export const RAISON_DU_CROISEMENT: Record<Croisement, string> = {
  soiree: 'en soirée avec toi',
  duel: 'un duel entre vous',
  defi: 'au défi de la semaine',
  niveau: 'de ton niveau',
}

/**
 * Un joueur croisé (le souhait du propriétaire du 11 octobre 2026 : « c'est
 * dommage que ça montre pas des joueurs pour les ajouter en ami ») : de quoi
 * défier ou ajouter quelqu'un sans connaître son prénom — « Contre qui ? »,
 * la feuille des amis. Jamais un ami : il est déjà dans sa liste.
 */
export interface JoueurCroise extends JoueurADefier {
  croise: Croisement
}

/** Les joueurs croisés qu'on montre : une poignée, pas une liste à faire défiler. */
export const JOUEURS_CROISES = 6

/** Ce qu'une recherche rend au plus : de quoi trouver quelqu'un, pas un annuaire. */
export const JOUEURS_TROUVES = 12

/** Une recherche commence à deux lettres : une seule rendrait la moitié des prénoms. */
export const LETTRES_POUR_CHERCHER = 2

/**
 * Un duel contre quelqu'un, dans la page des duels : contre qui, sur quoi,
 * à qui de jouer — et, joué des deux côtés, les deux scores et ce qu'il a
 * fait à sa cote.
 */
export interface DuelContre {
  code: string
  /**
   * Contre qui — sa ligue, s'il a fini un duel classé : l'anneau de son
   * avatar en prend la couleur ; et ce qu'il porte, son légendaire comme au
   * classement (`SonApparence`).
   */
  contre: { profileId: string; nom: string; avatar: string; ligue?: CleDeLigue } & SonApparence
  /** C'est lui qui l'a lancé. */
  lance: boolean
  sujet?: string
  categories?: string[]
  /** Ses bonnes réponses, sa tentative finie ; null : pas encore jouée jusqu'au bout. */
  justes: number | null
  /**
   * Celles d'en face, une fois les deux tentatives finies : le résultat. Le
   * score à battre ne part jamais avant sa dernière réponse — il se voyait
   * avant même de jouer (le souhait du propriétaire du 12 octobre 2026).
   */
  sesJustes: number | null
  /** Ce que le duel a fait à sa cote, joué des deux côtés. */
  ecart?: number
  /** Quand il a compté : la seconde tentative finie, ou sa fermeture. L'historique s'y range. */
  le?: number
  /** Joué des deux côtés, et pas encore vu par qui l'a lancé : son résultat l'attend (`DuelEntreAmis.nouveau`). */
  nouveau?: true
  /** Les minutes avant qu'il ferme ; 0 : fermé. */
  minutesRestantes: number
}

/** La page des duels (`GET /api/duels`) : sa cote, sa semaine, le classement, ses duels — en route et derniers. */
export interface EtatDesDuels {
  cote: number
  ligue: CleDeLigue
  joues: number
  /** Le plancher de sa cote, une ligue gardée atteinte : ce que la page dit d'un duel ne descend pas dessous (`enjeuContre`). */
  plancher?: number
  semaine: SemaineDesDuels
  /** La semaine passée, si elle a payé : sa ligue, ses duels, ses confettis. */
  semainePassee?: { ligue: CleDeLigue; duels: number; confettis: number }
  classement: ClassementDesDuels
  /** Son duel au hasard laissé en route : il se reprend. */
  enCours: RencontreDeCampagne | null
  /** Ses duels au hasard, les derniers joués. */
  dernieres: ResumeDeRencontre[]
  /** Ses duels contre quelqu'un : ceux qui attendent, puis les derniers joués (absent d'un serveur d'avant). */
  contre?: DuelContre[]
  /** Son bilan, ses records, ses face-à-face, la courbe de sa cote (absent d'un serveur d'avant). */
  bilan?: BilanDesDuels
  /** Ses derniers duels joués, au dé et contre quelqu'un mêlés, les plus récents d'abord (absent d'un serveur d'avant). */
  historique?: PageDHistoire
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
  /**
   * Ses duels joués des deux côtés dont il n'a pas encore vu le résultat :
   * combien, contre qui le dernier, et son code — la bannière de l'accueil y
   * mène d'un toucher. Il n'y avait ni signe ni message : le résultat se
   * rangeait dans « Tes duels joués », replié (le retour du propriétaire du
   * 12 octobre 2026).
   */
  resultats?: { n: number; de: string; code: string }
  /** Son duel laissé en route : contre qui. */
  enCours?: Pick<Adversaire, 'nom'>
  /** La semaine passée, si elle a payé : sa ligue et ses confettis — le lundi, l'accueil dit ce qui vient d'arriver au solde. */
  semainePassee?: { ligue: CleDeLigue; confettis: number }
  /** Ses bordures de ligue (`ReleveDesDuels.bordures`) : celle qu'il porte se montre autour de son avatar, en tête de l'accueil. */
  bordures?: BordureDeLigue[]
}
