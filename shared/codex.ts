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
// les premiers un style et une règle — la première expédition choisit entre
// trois styles, sans pari, ni fiole, ni talisman. Un légendaire qu'on a ouvre sa carte ; un
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
  ENERGIE_DES_ACTES,
  MAIN_MAX_EN_QUESTION,
  MAIN_MAX_SOUS_TROIS_TETES,
  VERSION_DE_LA_QUESTION_AU_CENTRE,
  VERSION_DES_HUIT_FAMILLES,
  VERSION_DU_CODEX,
  baseDe,
  carteDeRencontre,
  carteDuLegendaire,
  cransDe,
  energieDesActes,
  frappeDe,
  sceauxDe,
  seJoueEnQuestion,
  type CarteDeRencontre,
  type PoidsDesRaretes,
  type RareteDOffre,
  type SorteDeRencontre,
  type StyleDeJeu,
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
 * Les exploits, dans l'ordre où ils se disent. Banco, Génie et Inarrêtable
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
  // Lancée et Échauffement jusqu'au 19 octobre 2026 : l'Élan, devenu un style, les tient de départ. Frapper fort d'un coup
  // ouvre Génie ; tenir vingt d'affilée, Inarrêtable — la série qui ne retombe plus.
  { cle: 'une-seule-reponse', but: 'faire tomber une élite d’une seule réponse', carte: 'genie' },
  { cle: 'd-affilee', but: `répondre juste ${BONNES_D_AFFILEE} fois d’affilée`, carte: 'inarretable' },
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

/** Ce qu'un niveau ouvre : des cartes, et pour certains une règle, un style, ou un dos pour son paquet. */
export interface MarcheDuCodex {
  niveau: number
  cartes: readonly string[]
  regle?: RegleDuCodex
  /** Le style qu'il ouvre (« Ton style », le 19 octobre 2026) : ses communes sont dans ses cartes, ses deux cartes de départ comprises. */
  styles?: readonly StyleDeJeu[]
  dos?: DosDuPaquet
}

/**
 * L'échelle — la variété d'abord, la puissance ensuite (« Ton style », le 19
 * octobre 2026 : « j'ai l'impression de piocher tout le temps la même chose
 * et de pas avoir à choisir de style de jeu ») : au niveau 1, le paquet de
 * départ, quelques neutres et trois styles entiers à leurs communes — le
 * Rempart, l'Érudit, le Devin, et sa catégorie fétiche avec l'Érudit ; puis
 * un style de plus à chacun des trois suivants, avec sa règle — le Flambeur et
 * le pari au 2, l'Élan et les fioles au 3, le Métamorphe et les talismans au
 * 4 —, et des rares de ceux qu'on a déjà ; puis les deux styles de la version
 * 9, qui jouent autrement — le Sophiste et son doute au 5, le Téméraire et son
 * courage au 6, leurs rares au 6 et au 7, leurs épiques au 8 et au 9 : qui
 * les ouvre connaît déjà le jeu qu'ils détournent. Les rares et les épiques qui pèsent
 * le plus attendent : Sursis au niveau 6 — mesurée, elle seule ouverte au
 * niveau 1 menait le joueur moyen au bout une fois sur deux, plus qu'avec tout
 * le codex (`calibrage-rencontres.ts`, le 18 octobre 2026) —, Représailles au
 * 9, Maîtrise au 10. Jusque-là, le niveau 1 n'ouvrait que huit cartes à
 * gagner, presque toutes neutres, et les familles n'arrivaient qu'aux niveaux
 * 5 à 10 : on tirait les mêmes, sans style à suivre.
 *
 * Banco, Génie et Inarrêtable n'y sont pas : leur exploit les ouvre
 * (`EXPLOITS`) — Lancée et Échauffement l'étaient, mais l'Élan les tient de
 * départ. Toutes les autres cartes sans légendaire y sont, une fois
 * (`codex.test.ts`). Au sixième, un dos à soi pour son paquet. Un départ fige
 * le codex qu'il ouvre (`CodexDuDepart`) : retoucher l'échelle ne change
 * rien aux expéditions parties.
 */
export const ECHELLE: readonly MarcheDuCodex[] = [
  {
    niveau: 1,
    cartes: [
      'concentration',
      'prudence',
      'coup-d-oeil',
      'echange',
      'pioche',
      'arret-sur-image',
      'evidence',
      'parade',
      'muraille',
      'pansement',
      'plume',
      'savoir-faire',
      'memoire',
      'lucidite',
      'augure',
      'presage',
    ],
    regle: 'fetiche',
    styles: ['rempart', 'erudit', 'devin'],
  },
  { niveau: 2, cartes: ['doubler-la-mise', 'pourboire', 'cagnotte', 'double-chance', 'contre-attaque', 'lecon', 'voyance'], regle: 'pari', styles: ['flambeur'] },
  { niveau: 3, cartes: ['echauffement', 'lancee', 'foulee', 'assurance', 'second-souffle', 'expose', 'astrolabe'], regle: 'fioles', styles: ['elan'] },
  { niveau: 4, cartes: ['corser', 'simplifier', 'volte-face', 'acceleration', 'fortune', 'detour', 'meditation', 'sang-froid'], regle: 'talismans', styles: ['metamorphe'] },
  {
    niveau: 5,
    cartes: ['bibliotheque', 'cuirasse', 'troisieme-oeil', 'rythme', 'miroir', 'prisme', 'tout-ou-rien', 'panacee', 'insinuation', 'rumeur', 'objection'],
    styles: ['sophiste'],
  },
  {
    niveau: 6,
    cartes: ['sursis', 'sprint', 'cameleon', 'quitte-ou-double', 'bastion', 'vision', 'fougue', 'coup-de-sang', 'cicatrices', 'zizanie', 'coup-de-grace'],
    dos: 'etoile',
    styles: ['temeraire'],
  },
  { niveau: 7, cartes: ['rafle', 'pactole', 'vent-arriere', 'surmenage', 'revelation', 'engrenage', 'adrenaline', 'dernier-carre', 'temerite'] },
  { niveau: 8, cartes: ['metamorphose', 'polymorphe', 'paranoia', 'berserk'] },
  { niveau: 9, cartes: ['encyclopedie', 'represailles', 'hantise', 'baroud'] },
  { niveau: 10, cartes: ['maitrise'] },
]

/**
 * L'échelle de la question au centre (v10) : ses trente-six cartes à gagner,
 * les mêmes règles aux mêmes niveaux, cinq styles. Au niveau 1, le paquet de
 * départ — Double chance et Sursis y entrent, les seconds essais — et les
 * communes de trois styles : le Devin, l'Érudit et sa catégorie fétiche, le
 * Métamorphe, descendu du niveau 4 à la place du Rempart ; le Flambeur et le
 * pari au 2, l'Élan et les fioles au 3 ; puis des cartes seulement, chaque
 * niveau la sienne, jusqu'aux styles de l'étape 6. Banco, Génie et Inarrêtable
 * restent à leurs exploits (`codex.test.ts`).
 */
export const ECHELLE_EN_QUESTION: readonly MarcheDuCodex[] = [
  {
    niveau: 1,
    cartes: [
      'concentration',
      'coup-d-oeil',
      'echange',
      'arret-sur-image',
      'double-chance',
      'sursis',
      'plume',
      'savoir-faire',
      'memoire',
      'lucidite',
      'augure',
      'presage',
      'corser',
      'simplifier',
      'volte-face',
    ],
    regle: 'fetiche',
    styles: ['devin', 'erudit', 'metamorphe'],
  },
  { niveau: 2, cartes: ['doubler-la-mise', 'pourboire', 'cagnotte', 'voyance'], regle: 'pari', styles: ['flambeur'] },
  { niveau: 3, cartes: ['echauffement', 'lancee', 'assurance', 'expose'], regle: 'fioles', styles: ['elan'] },
  { niveau: 4, cartes: ['detour', 'rythme'], regle: 'talismans' },
  { niveau: 5, cartes: ['bibliotheque', 'troisieme-oeil', 'prisme'] },
  { niveau: 6, cartes: ['tout-ou-rien', 'quitte-ou-double', 'vision'], dos: 'etoile' },
  { niveau: 7, cartes: ['rafle', 'pactole'] },
  { niveau: 8, cartes: ['revelation'] },
  { niveau: 9, cartes: ['polymorphe'] },
  { niveau: 10, cartes: ['encyclopedie'] },
]

/** L'échelle d'un départ de cette version : celle de la question au centre dès la version 10. */
export const echelleDe = (v: number): readonly MarcheDuCodex[] => (v >= VERSION_DE_LA_QUESTION_AU_CENTRE ? ECHELLE_EN_QUESTION : ECHELLE)

/** Les styles qu'ouvre un niveau, du premier au sien, dans l'ordre de l'échelle : ceux que le départ propose — à la version du départ. */
export const stylesDuNiveau = (niveau: number, v = VERSION_DES_HUIT_FAMILLES): StyleDeJeu[] =>
  echelleDe(v)
    .filter(m => m.niveau <= niveau)
    .flatMap(m => m.styles ?? [])

/** Le niveau qui ouvre un style. */
export const niveauDuStyle = (style: StyleDeJeu, v = VERSION_DES_HUIT_FAMILLES) => echelleDe(v).find(m => m.styles?.includes(style))?.niveau ?? 1

/** Le niveau qui ouvre une règle. */
export const niveauDeLaRegle = (regle: RegleDuCodex, v = VERSION_DES_HUIT_FAMILLES) => echelleDe(v).find(m => m.regle === regle)?.niveau ?? 1

/**
 * Comment s'ouvre une carte : à son niveau, par son exploit, ou en ayant le
 * légendaire qui la donne — null : elle ne s'ouvre pas à cette version (une
 * des quarante-deux que la question au centre a retirées).
 */
export function ouvertureDe(cle: string, v = VERSION_DES_HUIT_FAMILLES): { niveau: number } | { exploit: CleDExploit } | { legendaire: string } | null {
  if (v >= VERSION_DE_LA_QUESTION_AU_CENTRE && !seJoueEnQuestion(cle)) return null
  const marche = echelleDe(v).find(m => m.cartes.includes(cle))
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

/**
 * Ce qu'ouvre un niveau, ses exploits et ses légendaires : le codex que son
 * départ figera — et ses dos de cartes et ses styles, que le départ choisit.
 */
export function codexDuNiveau(
  niveau: number,
  legendaires: readonly string[],
  exploits: readonly CleDExploit[] = [],
  /** La version du départ qu'il figera : la question au centre (v10) a son échelle et ses styles. */
  v = VERSION_DES_HUIT_FAMILLES,
): CodexDuDepart & { exploits: CleDExploit[]; dos: DosDuPaquet[]; styles: StyleDeJeu[] } {
  const marches = echelleDe(v).filter(m => m.niveau <= niveau)
  const ouvertes = new Set([
    ...marches.flatMap(m => m.cartes),
    ...exploits.flatMap(x => exploitDe(x)?.carte ?? []),
    ...legendaires.flatMap(l => carteDuLegendaire(l)?.cle ?? []),
  ])
  // Une carte retirée de la question au centre ne s'y ouvre jamais, même par son exploit.
  const seJoue = (cle: string) => v < VERSION_DE_LA_QUESTION_AU_CENTRE || seJoueEnQuestion(cle)
  return {
    niveau,
    cartes: CARTES_DES_RENCONTRES.filter(c => ouvertes.has(c.cle) && seJoue(c.cle)).map(c => c.cle),
    regles: marches.flatMap(m => (m.regle ? [m.regle] : [])),
    exploits: EXPLOITS.map(x => x.cle).filter(cle => exploits.includes(cle)),
    dos: dosOuverts(niveau, exploits),
    styles: stylesDuNiveau(niveau, v),
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
/**
 * Depuis le jeu complet, l'énergie suit les actes (`ENERGIE_DES_ACTES`) : le
 * cran 4 en ôte une à chacun, et sa phrase le dit sans chiffre d'acte.
 */
export const ASCENSION: readonly CranDAscension[] = [
  { cran: 1, regle: `Les adversaires ont ${POINTS_EN_ASCENSION} points de plus` },
  { cran: 2, regle: `Les adversaires frappent ${FRAPPE_EN_ASCENSION} de plus` },
  { cran: 3, regle: 'Le campement et la source rendent moitié moins de courage' },
  { cran: 4, regle: `Tu as ${ENERGIE_EN_ASCENSION} d’énergie de moins à chaque question` },
  { cran: 5, regle: 'Les gardiens ont moitié plus de points' },
]
export const ASCENSION_MAX = ASCENSION.length

/**
 * L'Ascension de la question au centre (v10), ses cinq crans retraduits : les
 * points d'un adversaire y sont des bonnes réponses — une de plus pour les
 * élites et les gardiens au cran 1, une encore pour les gardiens au cran 5 —,
 * et l'énergie de moins y est une carte de moins dans la main. L'attaque et le
 * repos ne changent pas.
 */
export const CRANS_EN_ASCENSION = 1
export const CRANS_DES_GARDIENS_EN_ASCENSION = 1
export const MAIN_EN_ASCENSION = 1
export const ASCENSION_EN_QUESTION: readonly CranDAscension[] = [
  { cran: 1, regle: 'Les élites et les gardiens demandent une bonne réponse de plus' },
  { cran: 2, regle: `Les adversaires frappent ${FRAPPE_EN_ASCENSION} de plus` },
  { cran: 3, regle: 'Le campement et la source rendent moitié moins de courage' },
  { cran: 4, regle: 'Ta main tient une carte de moins' },
  { cran: 5, regle: 'Les gardiens en demandent encore une de plus' },
]

/** Les crans de l'Ascension, tels qu'un départ de cette version les joue — et que le départ et les règles les disent. */
export const ascensionDe = (v: number): readonly CranDAscension[] => (v >= VERSION_DE_LA_QUESTION_AU_CENTRE ? ASCENSION_EN_QUESTION : ASCENSION)

/** Les crans d'un adversaire de cette sorte dans la question au centre, à cet acte et à ce cran de l'Ascension : ceux que le pli lui donne, et que le plan annonce. */
export const cransDeLAdversaire = (sorte: SorteDeRencontre, acte: number, ascension: number) =>
  cransDe(sorte, acte) + (ascension >= 1 && sorte !== 'question' ? CRANS_EN_ASCENSION : 0) + (ascension >= 5 && sorte === 'gardien' ? CRANS_DES_GARDIENS_EN_ASCENSION : 0)

/** Ce que tient la main de la question au centre : quatre cartes — cinq sous Trois têtes —, une de moins dès le cran 4. */
export const mainMaxEnQuestion = (troisTetes: boolean, ascension: number) => (troisTetes ? MAIN_MAX_SOUS_TROIS_TETES : MAIN_MAX_EN_QUESTION) - (ascension >= 4 ? MAIN_EN_ASCENSION : 0)

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

/**
 * L'énergie de chaque question, acte par acte, à la version d'un départ et à
 * son cran — ce que lui ajoutent ses cartes viendra en plus : le pli la donne,
 * les règles la disent.
 */
export const energieDesActesALAscension = (v: number, ascension: number): number[] => energieDesActes(v).map(n => n - (ascension >= 4 ? ENERGIE_EN_ASCENSION : 0))

/** L'énergie d'une question de cet acte. */
export const energieDuTour = (v: number, acte: number, ascension: number) =>
  energieDesActesALAscension(v, ascension)[Math.min(Math.max(0, acte), ENERGIE_DES_ACTES.length - 1)]

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
 *
 * Son style (le 19 octobre 2026) : une de ses cartes d'abord, à la rareté
 * tirée — sinon à une autre que l'offre permet —, une que son paquet n'a pas
 * encore s'il en reste ; puis deux cartes de partout, chacune au même poids.
 * Chaque récompense propose ainsi de quoi suivre son style, et de quoi en
 * sortir. Le poids des familles de son paquet s'efface avec lui : il tirait
 * les deux autres vers son style, et l'offre de l'Érudit n'était plus que de
 * l'Érudit (`calibrage-rencontres.ts --styles` : moins de cartes différentes
 * proposées en une expédition qu'avant les styles). Sans style, le hasard se
 * tire dans le même ordre qu'avant lui : une offre d'un départ d'avant se
 * rejoue telle qu'elle s'est jouée.
 */
export function offreDuCodex(
  graine: string,
  rang: number,
  ouvertes: readonly string[],
  paquet: readonly string[],
  poids: PoidsDesRaretes,
  legendaire = false,
  style?: StyleDeJeu,
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
  const raretes = (Object.entries(poids) as [RareteDOffre, number][]).filter(([, p]) => p > 0)
  const permises = new Set(raretes.map(([nom]) => nom))
  const poidsDe = (c: CarteDeRencontre) => (style ? 1 : 1 + (c.famille === 'neutre' ? 0 : (parFamille.get(c.famille) ?? 0)))
  /** Une rareté, tirée à ses poids. */
  const tirerLaRarete = () => {
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
    return rarete
  }
  /** Parmi ces cartes libres, celles de cette rareté — sinon d'une autre que l'offre permet. */
  const aSaRarete = (libres: CarteDeRencontre[], rarete: RareteDOffre | undefined) => {
    const siennes = libres.filter(c => c.rarete === rarete)
    return siennes.length > 0 ? siennes : libres.filter(c => permises.has(c.rarete as RareteDOffre))
  }
  /** L'une d'elles, chacune à son poids. */
  const choisir = (candidates: CarteDeRencontre[]) => {
    const somme = candidates.reduce((n, c) => n + poidsDe(c), 0)
    let t = r() * somme
    for (const c of candidates) {
      t -= poidsDe(c)
      if (t < 0) return c
    }
    return candidates[candidates.length - 1]
  }
  if (style && prises.length < CARTES_PAR_OFFRE) {
    const rarete = tirerLaRarete()
    const siennes = offrables.filter(c => c.famille === style && !prises.includes(c.cle))
    // Une qu'il n'a pas encore d'abord : reproposer celle qu'il tient déjà, c'était piocher la même chose.
    const neuves = siennes.filter(c => !paquet.some(cle => baseDe(cle) === c.cle))
    const candidates = [neuves, siennes].map(libres => aSaRarete(libres, rarete)).find(l => l.length > 0) ?? []
    if (candidates.length > 0) prises.push(choisir(candidates).cle)
  }
  for (let essai = 0; prises.length < CARTES_PAR_OFFRE && essai < 30; essai++) {
    const rarete = tirerLaRarete()
    const candidates = aSaRarete(
      offrables.filter(c => !prises.includes(c.cle)),
      rarete,
    )
    if (candidates.length === 0) break
    prises.push(choisir(candidates).cle)
  }
  return prises
}
