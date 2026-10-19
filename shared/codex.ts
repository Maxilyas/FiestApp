// Le codex de l'Expédition : toutes les cartes des rencontres, de la commune
// à la légendaire, qu'on débloque en jouant. « Est-ce que l'on ferait pas un
// codex de carte global aussi, avec de commun à légendaire et on en débloque
// au fur et à mesure qu'on avance dans l'aventure ? Ça permettrait d'avoir des
// niveaux plus difficiles au début mais en jouant on débloque des cartes plus
// puissantes ce qui nous permet de plus avancer » (le propriétaire, le 18
// octobre 2026 ; la proposition tranchée le soir même, « Go tout faire avec
// tes recommandations »).
//
// La renommée se gagne à chaque expédition — perdue ou abandonnée aussi : sans
// quoi un joueur qui tombe à l'acte 1 resterait toujours au même niveau —, de
// ce qu'elle a fait : ses escales, ses adversaires, ses élites, ses gardiens,
// le bout. Elle fait le niveau d'explorateur ; chaque niveau ouvre des cartes,
// les premiers des règles — la première expédition n'a ni pari, ni fiole, ni
// talisman, ni catégorie fétiche. Un légendaire qu'on a ouvre sa carte ; un
// exploit — un but précis, fait une fois — la sienne, ou le dos doré du
// paquet ; le niveau 6, le dos étoilé. Une expédition menée au bout ouvre
// l'Ascension : des crans de difficulté, chacun ouvert par une victoire à
// celui d'en dessous, qu'on choisit au départ.
//
// Pur. Ce qu'une expédition a fait se compte de son pli (`bilanDuPli`,
// `shared/expedition.ts`) — invariant 14 : la renommée d'une expédition finie
// et celle qu'on joue passent par le même chemin ; le serveur garde le bilan
// de chacune à sa fin, et le départ fige le codex qu'il ouvre
// (`DepartDExpedition.codex`) : un barème changé ne change pas les cartes
// d'une expédition partie. Ses constantes sont des choix de produit
// (`docs/reference/baremes.md`).

import {
  CARTES_DES_RENCONTRES,
  CARTES_PAR_OFFRE,
  INSPIRATION_PAR_QUESTION,
  VERSION_DU_CODEX,
  carteDeRencontre,
  carteDuLegendaire,
  frappeDe,
  sceauxDe,
  type CarteDeRencontre,
  type PoidsDesRaretes,
  type SorteDeRencontre,
} from './rencontres'
import { hasardDe } from './missions'

// ── Les exploits ────────────────────────────────────────────────────────────

/**
 * Un exploit : un but précis, une récompense précise (la proposition du codex,
 * le 18 octobre 2026 : « Dans le codex, une carte verrouillée dit toujours
 * comment l'obtenir : un niveau, un exploit ou un légendaire »). Il se fait une
 * fois, dans n'importe quelle expédition — perdue ensuite aussi —, et le bilan
 * de celle-ci le garde : comme la renommée, il se relit des bilans.
 */
export type CleDExploit = 'pari-de-40' | 'une-seule-reponse' | 'd-affilee' | 'gardien-intact'

export interface Exploit {
  cle: CleDExploit
  /** Ce qu'il faut faire, en minuscule : il suit « Exploit : ». */
  but: string
  /** La carte qu'il ouvre au codex — hors de l'échelle : elle ne s'ouvre que par lui. */
  carte?: string
  /** Sans carte : un dos pour son paquet — le doré. */
  dos?: DosDuPaquet
}

/** Le pari qu'il faut gagner : le plus gros (`MISES`) — doublé par Doubler la mise, un pari de 20 y suffit. */
export const PARI_DE_L_EXPLOIT = 40
/**
 * Les bonnes réponses d'affilée qu'il faut, dans toute l'expédition : une
 * erreur, une source ratée comprise, repart de zéro. Dix, comme le proposait
 * le codex, le joueur moyen les enchaînait à sa première expédition : vingt.
 */
export const BONNES_D_AFFILEE = 20

/**
 * Les exploits, dans l'ordre où ils se disent. Banco, Lancée et Échauffement
 * ne s'ouvrent que par eux : chacun récompense la façon de jouer qu'il sert —
 * parier gros, frapper fort, enchaîner. Mesurés sur la carrière
 * (`calibrage-rencontres.ts`, le 18 octobre 2026, cent joueurs de chaque
 * sorte) : le gros pari tombe à la deuxième ou la troisième expédition, dès
 * que le pari s'ouvre — le premier but, qui apprend à parier ; les trois
 * autres sont des exploits — en vingt expéditions, le joueur moyen fait
 * chacun six fois sur dix environ, vers sa sixième à sa neuvième, le fort
 * presque toujours, le faible une ou deux fois sur dix, et vingt d'affilée
 * presque jamais. Au premier réglage — un adversaire ordinaire d'une seule
 * réponse, n'importe quel gardien, dix d'affilée —, le moyen les faisait tous
 * à sa première.
 */
export const EXPLOITS: readonly Exploit[] = [
  { cle: 'pari-de-40', but: `gagner un pari de ${PARI_DE_L_EXPLOIT} écus`, carte: 'banco' },
  { cle: 'une-seule-reponse', but: 'faire tomber une élite d’une seule réponse', carte: 'lancee' },
  { cle: 'd-affilee', but: `répondre juste ${BONNES_D_AFFILEE} fois d’affilée`, carte: 'echauffement' },
  { cle: 'gardien-intact', but: 'vaincre le gardien de l’acte 3 sans perdre de courage', dos: 'dore' },
]

export const exploitDe = (cle: string) => EXPLOITS.find(x => x.cle === cle)

// ── La renommée ─────────────────────────────────────────────────────────────

/** Ce qu'une expédition a fait, que la renommée compte — et ses exploits. */
export interface BilanDUneExpedition {
  /** Les escales où il est entré, gardiens compris. */
  escales: number
  /** Les adversaires tombés — aux règles d'avant, les questions d'escale trouvées. */
  adversaires: number
  /** Les élites tombées — trouvées, aux règles d'avant. */
  elites: number
  gardiens: number
  /** Allée au bout : le troisième gardien vaincu. */
  auBout: boolean
  /** Les exploits qu'elle a faits (la version 2 du bilan) ; ils ne rapportent pas de renommée. */
  exploits?: readonly CleDExploit[]
  /**
   * Le cran de l'Ascension où elle est partie — absent sans : allée au bout,
   * elle ouvre le suivant (`ascensionOuverte`). Une expédition d'avant
   * l'Ascension n'en avait pas : son bilan n'a pas à se refaire.
   */
  ascension?: number
}

/**
 * Le bilan gardé à la fin d'une expédition (`campagne_series.bilan`), à sa
 * version : un bilan d'une version d'avant se refait du pli. Elle monte quand
 * le bilan compte une chose de plus — la 2, ses exploits : chaque expédition
 * finie s'est repliée une fois, et les exploits d'avant comptent.
 */
export const VERSION_DU_BILAN = 2

/**
 * Ce que rapporte chaque chose faite, en renommée. Une première expédition
 * perdue à l'acte 1 en rapporte une vingtaine — de quoi passer le niveau 2 —,
 * une menée au bout cent cinquante environ.
 */
export const RENOMMEE: Readonly<Record<Exclude<keyof BilanDUneExpedition, 'exploits' | 'ascension'>, number>> = {
  escales: 1,
  adversaires: 3,
  elites: 6,
  gardiens: 12,
  auBout: 25,
}

/** La renommée d'une expédition, de ce qu'elle a fait. */
export function renommeeDe(b: BilanDUneExpedition): number {
  return (
    b.escales * RENOMMEE.escales +
    b.adversaires * RENOMMEE.adversaires +
    b.elites * RENOMMEE.elites +
    b.gardiens * RENOMMEE.gardiens +
    (b.auBout ? RENOMMEE.auBout : 0)
  )
}

/** Un bilan relu de la base : ses nombres et ses exploits, ou rien — d'une autre version, ou qui ne se lit pas. */
export function lireLeBilan(brut: unknown): BilanDUneExpedition | null {
  if (typeof brut !== 'string') return null
  try {
    const b = JSON.parse(brut)
    if (b?.v !== VERSION_DU_BILAN || !Array.isArray(b.exploits)) return null
    const n = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : null)
    const lu = { escales: n(b.escales), adversaires: n(b.adversaires), elites: n(b.elites), gardiens: n(b.gardiens), auBout: b.auBout === true }
    if (lu.escales === null || lu.adversaires === null || lu.elites === null || lu.gardiens === null) return null
    // Un exploit que le code ne connaît plus se tait : il n'ouvre rien.
    const exploits = EXPLOITS.map(x => x.cle).filter(cle => (b.exploits as unknown[]).includes(cle))
    // Un cran au-delà de l'Ascension d'aujourd'hui compte pour le dernier : il ne s'ouvre rien de plus haut.
    const ascension = Math.min(n(b.ascension) ?? 0, ASCENSION_MAX)
    return { ...(lu as Omit<BilanDUneExpedition, 'exploits'>), exploits, ...(ascension > 0 && { ascension }) }
  } catch {
    return null
  }
}

/** Le bilan tel que la base le garde, à sa version. */
export const ecrireLeBilan = (b: BilanDUneExpedition) => JSON.stringify({ v: VERSION_DU_BILAN, ...b, exploits: [...(b.exploits ?? [])] })

// ── Les niveaux ─────────────────────────────────────────────────────────────

/**
 * La renommée qu'il faut, au total, pour chaque niveau d'explorateur — le
 * premier d'office. Le joueur moyen gagne une centaine de renommée par
 * expédition, ses défaites comprises, le faible une soixantaine, le fort
 * cent vingt : le codex entier en une douzaine d'expéditions pour le moyen,
 * une vingtaine pour le faible (`calibrage-rencontres.ts`, la carrière). Un
 * premier acte joué jusqu'à son gardien, même perdu ensuite, passe le
 * niveau 2. Chaque niveau demande au moins autant que le précédent.
 */
export const NIVEAUX: readonly number[] = [0, 30, 100, 200, 320, 460, 620, 800, 1000, 1220]
export const NIVEAU_MAX = NIVEAUX.length

/** Son niveau d'explorateur, de 1 à `NIVEAU_MAX`. */
export function niveauDe(renommee: number): number {
  let n = 1
  while (n < NIVEAU_MAX && renommee >= NIVEAUX[n]) n++
  return n
}

/** Où il en est : son niveau, la renommée d'où il part, celle du suivant — null au dernier. */
export function progressionDe(renommee: number): { niveau: number; depuis: number; prochain: number | null } {
  const niveau = niveauDe(renommee)
  return { niveau, depuis: NIVEAUX[niveau - 1], prochain: niveau < NIVEAU_MAX ? NIVEAUX[niveau] : null }
}

/** Les règles qu'un niveau ouvre : la première expédition n'a que des cartes, l'énergie et le courage. */
export type RegleDuCodex = 'pari' | 'fioles' | 'talismans' | 'fetiche'

/**
 * Les règles d'avant le codex : une expédition partie sans lui (v6 et moins)
 * les a toutes. Les fioles sont venues après — elle n'en a pas.
 */
const REGLES_D_AVANT_LE_CODEX: readonly RegleDuCodex[] = ['pari', 'talismans', 'fetiche']

/** Ce qu'un niveau ouvre : des cartes, et pour certains une règle, ou un dos pour son paquet. */
export interface MarcheDuCodex {
  niveau: number
  cartes: readonly string[]
  regle?: RegleDuCodex
  dos?: DosDuPaquet
}

/**
 * L'échelle : au niveau 1, six cartes simples, des communes — le paquet de
 * départ, La pioche et Arrêt sur image ; puis une ou deux cartes par niveau,
 * une famille entière à partir du troisième. Les déblocages ouvrent surtout
 * des façons de jouer, un peu de puissance : chaque carte plus forte rendrait
 * le début injouable et la fin trop facile. Les rares qui pèsent le plus
 * attendent — Sursis au niveau 6 : mesurée, elle seule ouverte au niveau 1
 * menait le joueur moyen au bout une fois sur deux, plus qu'avec tout le
 * codex (`calibrage-rencontres.ts`, le 18 octobre 2026). Banco, Lancée et
 * Échauffement n'y sont pas : leur exploit les ouvre (`EXPLOITS`). Toutes les
 * autres cartes sans légendaire y sont, une fois (`codex.test.ts`). Une règle
 * par niveau, du deuxième au cinquième : le pari, les fioles, les talismans,
 * la catégorie fétiche — deux à la fois, la seconde expédition en aurait trop
 * appris d'un coup. Au sixième, un dos à soi pour son paquet.
 */
export const ECHELLE: readonly MarcheDuCodex[] = [
  { niveau: 1, cartes: ['concentration', 'prudence', 'coup-d-oeil', 'echange', 'pioche', 'arret-sur-image'] },
  { niveau: 2, cartes: ['double-chance'], regle: 'pari' },
  { niveau: 3, cartes: ['parade', 'contre-attaque'], regle: 'fioles' },
  { niveau: 4, cartes: ['detour', 'tout-ou-rien'], regle: 'talismans' },
  { niveau: 5, cartes: ['plume', 'bibliotheque'], regle: 'fetiche' },
  { niveau: 6, cartes: ['sursis', 'quitte-ou-double'], dos: 'etoile' },
  { niveau: 7, cartes: ['doubler-la-mise'] },
  { niveau: 8, cartes: ['corser', 'simplifier'] },
  { niveau: 9, cartes: ['lucidite'] },
  { niveau: 10, cartes: ['troisieme-oeil'] },
]

/** Le niveau qui ouvre une règle. */
export const niveauDeLaRegle = (regle: RegleDuCodex) => ECHELLE.find(m => m.regle === regle)?.niveau ?? 1

/** Comment s'ouvre une carte : à son niveau, par son exploit, ou en ayant le légendaire qui la donne. */
export function ouvertureDe(cle: string): { niveau: number } | { exploit: CleDExploit } | { legendaire: string } | null {
  const marche = ECHELLE.find(m => m.cartes.includes(cle))
  if (marche) return { niveau: marche.niveau }
  const exploit = EXPLOITS.find(x => x.carte === cle)
  if (exploit) return { exploit: exploit.cle }
  const legendaire = carteDeRencontre(cle)?.legendaire
  return legendaire ? { legendaire } : null
}

/**
 * Le codex d'un profil, tel que son départ le fige (v7) : son niveau, les
 * cartes qu'il ouvre — l'échelle jusqu'à lui, la carte de chaque exploit
 * qu'il a fait, puis celle de chaque légendaire qu'il a —, dans l'ordre du
 * catalogue, les règles ouvertes et ses exploits.
 */
export interface CodexDuDepart {
  niveau: number
  cartes: string[]
  regles: RegleDuCodex[]
  /**
   * Les exploits qu'il avait faits en partant : la fin dit ceux qu'elle
   * ajoute. Absents d'un départ d'avant les exploits — la fin n'en dit rien.
   */
  exploits?: CleDExploit[]
  /**
   * La renommée qu'il avait en partant : la fin y ajoute celle de
   * l'expédition, et dit le niveau qu'elle fait passer. Absente au calibrage.
   */
  renommee?: number
  /**
   * Le plus haut cran de l'Ascension qu'il avait ouvert en partant : la fin
   * dit celui que sa victoire ouvre (`cranOuvertParLaVictoire`). Absent d'un
   * départ d'avant l'Ascension — la fin n'en dit rien.
   */
  ascensionOuverte?: number
}

/** Ce qu'ouvre un niveau, ses exploits et ses légendaires : le codex que son départ figera — et ses dos de cartes, que le départ choisit. */
export function codexDuNiveau(
  niveau: number,
  legendaires: readonly string[],
  exploits: readonly CleDExploit[] = [],
): CodexDuDepart & { exploits: CleDExploit[]; dos: DosDuPaquet[] } {
  const marches = ECHELLE.filter(m => m.niveau <= niveau)
  const ouvertes = new Set([
    ...marches.flatMap(m => m.cartes),
    ...exploits.flatMap(x => exploitDe(x)?.carte ?? []),
    ...legendaires.flatMap(l => carteDuLegendaire(l)?.cle ?? []),
  ])
  return {
    niveau,
    cartes: CARTES_DES_RENCONTRES.filter(c => ouvertes.has(c.cle)).map(c => c.cle),
    regles: marches.flatMap(m => (m.regle ? [m.regle] : [])),
    exploits: EXPLOITS.map(x => x.cle).filter(cle => exploits.includes(cle)),
    dos: dosOuverts(niveau, exploits),
  }
}

/**
 * Une règle du codex est-elle ouverte à ce départ ? Une expédition d'avant le
 * codex (v6 et moins) a toutes celles d'alors ; une partie au codex, celles
 * qu'il a figées — une partie avant les fioles n'en a pas, même au niveau 3.
 */
export function regleOuverte(depart: { v: number; codex?: CodexDuDepart }, regle: RegleDuCodex): boolean {
  return depart.v < VERSION_DU_CODEX ? REGLES_D_AVANT_LE_CODEX.includes(regle) : !!depart.codex?.regles.includes(regle)
}

// ── Les dos de cartes ───────────────────────────────────────────────────────

/**
 * L'habit de son paquet : le dos de ses cartes, sur le plan et au codex —
 * rien de plus, aucune règle n'y lit (la proposition du codex). L'ordinaire
 * d'office, l'étoilé au niveau 6 (`ECHELLE`), le doré par un exploit
 * (`EXPLOITS`). Choisi au départ, gardé avec lui (`DepartDExpedition.dos`).
 */
export type DosDuPaquet = 'ordinaire' | 'etoile' | 'dore'
export interface DosDeCartes {
  cle: DosDuPaquet
  /** Son nom, en minuscule : il se dit dans une phrase — « le dos doré est à toi ». */
  nom: string
}
export const DOS_DES_CARTES: readonly DosDeCartes[] = [
  { cle: 'ordinaire', nom: 'le dos ordinaire' },
  { cle: 'etoile', nom: 'le dos étoilé' },
  { cle: 'dore', nom: 'le dos doré' },
]
export const dosDe = (cle: string): DosDeCartes | undefined => DOS_DES_CARTES.find(d => d.cle === cle)

/** Comment s'ouvre un dos : d'office, à son niveau, ou par son exploit. */
export function ouvertureDuDos(cle: DosDuPaquet): { niveau: number } | { exploit: CleDExploit } {
  const marche = ECHELLE.find(m => m.dos === cle)
  if (marche) return { niveau: marche.niveau }
  const exploit = EXPLOITS.find(x => x.dos === cle)
  return exploit ? { exploit: exploit.cle } : { niveau: 1 }
}

/** Les dos qu'il a, dans l'ordre du catalogue : le dernier est le plus rare — celui qu'un départ prend s'il n'en choisit pas. */
export function dosOuverts(niveau: number, exploits: readonly CleDExploit[]): DosDuPaquet[] {
  return DOS_DES_CARTES.map(d => d.cle).filter(cle => {
    const o = ouvertureDuDos(cle)
    return 'niveau' in o ? o.niveau <= niveau : exploits.includes(o.exploit)
  })
}

// ── L'Ascension ─────────────────────────────────────────────────────────────

/**
 * L'Ascension (la proposition du codex, « des niveaux de difficulté après une
 * première victoire ») : une expédition menée au bout ouvre son premier cran,
 * et une victoire à son plus haut cran ouvre le suivant. Chaque cran ajoute sa
 * règle à celles d'en dessous ; on part au cran qu'on veut parmi les siens, et
 * le départ le fige (`DepartDExpedition.ascension`). Pour qui va déjà au
 * bout : au codex entier, le joueur fort y va 93 fois sur cent, puis 88, 80,
 * 75, 65 et 43 du cran 1 au cran 5 ; le moyen 56, puis 39, 23, 15, 7 et plus
 * jamais (`calibrage-rencontres.ts --ascensions`). Elle ne retire rien à
 * personne et n'ouvre aucune carte : son seul prix est le cran suivant.
 */
export interface CranDAscension {
  cran: number
  /** Ce qu'il ajoute, tel que le départ et les règles le disent. */
  regle: string
}
/** Le cran 1 : les points de plus de chaque adversaire — une bonne réponse de plus, souvent, contre un adversaire ordinaire. */
export const POINTS_EN_ASCENSION = 6
/** Le cran 2 : la frappe de plus de chaque adversaire, dès sa première. */
export const FRAPPE_EN_ASCENSION = 3
/** Le cran 3 : la part du courage que rendent encore le campement et la source. */
export const REPOS_EN_ASCENSION = 0.5
/**
 * Le cran 4 : l'énergie de moins à chaque question — une carte de moins à
 * jouer. Partir avec 30 de courage, essayé d'abord, ne retirait rien au fort :
 * le campement et la source le remontaient avant qu'il en manque.
 */
export const ENERGIE_EN_ASCENSION = 1
/** Le cran 5 : ce que les points d'un gardien sont multipliés. */
export const GARDIENS_EN_ASCENSION = 1.5
export const ASCENSION: readonly CranDAscension[] = [
  { cran: 1, regle: `Les adversaires ont ${POINTS_EN_ASCENSION} points de plus` },
  { cran: 2, regle: `Les adversaires frappent ${FRAPPE_EN_ASCENSION} de plus` },
  { cran: 3, regle: 'Le campement et la source rendent moitié moins de courage' },
  { cran: 4, regle: `Tu as ${INSPIRATION_PAR_QUESTION - ENERGIE_EN_ASCENSION} d’énergie à chaque question, pas ${INSPIRATION_PAR_QUESTION}` },
  { cran: 5, regle: 'Les gardiens ont moitié plus de points' },
]
export const ASCENSION_MAX = ASCENSION.length

/** Les points d'un adversaire à ce cran : les siens, `POINTS_EN_ASCENSION` de plus dès le cran 1 — ceux d'un gardien, moitié plus au cran 5. */
export function pointsALAscension(points: number, sorte: SorteDeRencontre, ascension: number): number {
  const plus = points + (ascension >= 1 ? POINTS_EN_ASCENSION : 0)
  return sorte === 'gardien' && ascension >= 5 ? Math.round(plus * GARDIENS_EN_ASCENSION) : plus
}

/** La première frappe d'un adversaire à ce cran. */
export const frappeALAscension = (frappe: number, ascension: number) => frappe + (ascension >= 2 ? FRAPPE_EN_ASCENSION : 0)

/** Les points d'un adversaire de cette sorte, à cet acte et à ce cran : ceux que le pli lui donne, et que le plan annonce. */
export const pointsDeLAdversaire = (sorte: SorteDeRencontre, acte: number, ascension: number) => pointsALAscension(sceauxDe(sorte, acte), sorte, ascension)

/** Sa première frappe, à cet acte et à ce cran. */
export const frappeDeLAdversaire = (sorte: SorteDeRencontre, acte: number, ascension: number) => frappeALAscension(frappeDe(sorte, acte), ascension)

/** Ce que rend un repos — le campement, la source — à ce cran : moitié moins dès le cran 3, arrondi au-dessus. */
export const reposALAscension = (courage: number, ascension: number) => (ascension >= 3 ? Math.ceil(courage * REPOS_EN_ASCENSION) : courage)

/** L'énergie de chaque question à ce cran — ce que lui ajoutent ses cartes viendra en plus. */
export const energieALAscension = (ascension: number) => INSPIRATION_PAR_QUESTION - (ascension >= 4 ? ENERGIE_EN_ASCENSION : 0)

/**
 * Le plus haut cran qu'il peut choisir, de ses bilans : aucun sans une
 * victoire ; une victoire ouvre le cran 1, une au cran N le cran N + 1 — le
 * dernier au plus. Les victoires d'avant l'Ascension comptent : elle se lit
 * des bilans, comme la renommée.
 */
export function ascensionOuverte(bilans: Iterable<BilanDUneExpedition>): number {
  let ouverte = 0
  for (const b of bilans) if (b.auBout) ouverte = Math.max(ouverte, cranApresLaVictoire(b.ascension ?? 0))
  return ouverte
}

/** Le cran qu'une victoire à ce cran ouvre — le dernier au plus. */
const cranApresLaVictoire = (cran: number) => Math.min(ASCENSION_MAX, cran + 1)

/**
 * Le cran qu'ouvre une expédition allée au bout à ce cran, quand il avait
 * ouvert jusqu'à `ouverte` en partant : le suivant du sien, s'il passe
 * au-dessus — null sinon (une victoire sous son plus haut cran n'ouvre rien).
 * La règle de `ascensionOuverte`, pour la fin qui le dit.
 */
export function cranOuvertParLaVictoire(cran: number, ouverte: number): number | null {
  const apres = cranApresLaVictoire(cran)
  return apres > ouverte ? apres : null
}

// ── Les offres ──────────────────────────────────────────────────────────────

/** Ce que les offres ne proposent jamais : les cartes de base, comme Slay the Spire ses frappes — et les légendaires, que seul le coffre d'un gardien propose. */
const HORS_DES_OFFRES = new Set(['concentration', 'prudence'])

/**
 * Une offre du codex (v7) — une rencontre gagnée, une élite, un coffre,
 * l'échoppe : trois cartes distinctes parmi celles qu'il a ouvertes, chacune
 * à une rareté tirée à ses poids. Les familles ne viennent plus des
 * légendaires de l'équipe : une carte d'une famille pèse d'autant plus que
 * son paquet en tient déjà — prends deux cartes du Rempart, on t'en proposera
 * d'autres ; ton paquet prend une couleur sans qu'on te demande rien. Une
 * rareté qui n'a plus rien d'ouvert cède la place aux autres de l'offre. Le
 * coffre d'un gardien (`legendaire`) ouvre sur une carte légendaire de son
 * codex qu'il n'a pas déjà. Du hasard de la graine et du rang de l'offre :
 * recharger ne la change pas.
 */
export function offreDuCodex(
  graine: string,
  rang: number,
  ouvertes: readonly string[],
  paquet: readonly string[],
  poids: PoidsDesRaretes,
  legendaire = false,
): string[] {
  const r = hasardDe(`${graine}:offre:${rang}`)
  const prises: string[] = []
  if (legendaire) {
    const leurs = ouvertes.filter(cle => carteDeRencontre(cle)?.rarete === 'legendaire' && !paquet.includes(cle))
    if (leurs.length > 0) prises.push(leurs[Math.floor(r() * leurs.length)])
  }
  const parFamille = new Map<string, number>()
  for (const cle of paquet) {
    const f = carteDeRencontre(cle)?.famille
    if (f && f !== 'neutre') parFamille.set(f, (parFamille.get(f) ?? 0) + 1)
  }
  const offrables = ouvertes.map(cle => carteDeRencontre(cle)).filter((c): c is CarteDeRencontre => !!c && c.rarete !== 'legendaire' && !HORS_DES_OFFRES.has(c.cle))
  const raretes = (Object.entries(poids) as ['commun' | 'rare' | 'maudit', number][]).filter(([, p]) => p > 0)
  const poidsDe = (c: CarteDeRencontre) => 1 + (c.famille === 'neutre' ? 0 : (parFamille.get(c.famille) ?? 0))
  for (let essai = 0; prises.length < CARTES_PAR_OFFRE && essai < 30; essai++) {
    const u = r()
    let cumul = 0
    let rarete = raretes[0]?.[0]
    const total = raretes.reduce((n, [, p]) => n + p, 0)
    for (const [nom, p] of raretes) {
      cumul += p / total
      if (u < cumul) {
        rarete = nom
        break
      }
    }
    const libres = offrables.filter(c => !prises.includes(c.cle))
    const aSaRarete = libres.filter(c => c.rarete === rarete)
    const permises = new Set(raretes.map(([nom]) => nom))
    const candidates = aSaRarete.length > 0 ? aSaRarete : libres.filter(c => permises.has(c.rarete as 'commun' | 'rare' | 'maudit'))
    if (candidates.length === 0) break
    const somme = candidates.reduce((n, c) => n + poidsDe(c), 0)
    let t = r() * somme
    let choisie = candidates[candidates.length - 1]
    for (const c of candidates) {
      t -= poidsDe(c)
      if (t < 0) {
        choisie = c
        break
      }
    }
    prises.push(choisie.cle)
  }
  return prises
}
