// Les défis de tes cartes, et les épreuves de maître des gardiens (le
// 1er novembre 2026 : « comme c'est dur d'équilibrer les cartes, est-ce que
// l'on pourrait pas avoir des choses à gagner en fonction des cartes que l'on a
// sur nous. Des défis, avoir un nombre X d'or à la fin, battre sans parade » ;
// la proposition validée le même jour, `retours/2026-11-01/defis-des-cartes.md`).
//
// Chaque carte porte un défi, en trois rangs — Bronze, Argent, Or —, qui ne
// compte que si elle est dans ta main : une carte un peu faible devient
// intéressante pour ce qu'elle fait gagner, sans qu'on retouche ce qu'elle fait
// en jeu. Beaucoup demandent de l'avoir et de ne pas s'en servir. Chaque
// gardien a son épreuve de maître, dite à son annonce, que l'on connaît avant
// de choisir ses cartes : vaincu ainsi, son légendaire porte la marque du
// maître.
//
// Rien ne s'écrit pour eux : ils se lisent du journal de la traversée — son
// départ, ses gestes —, par son pli même (invariants 14 et 20), et le serveur
// range sur l'étagère, une fois pour toutes, ce qu'une traversée a atteint
// (invariant 22). Une cinquième notion n'entre pas dans la traversée : un défi
// est écrit au dos de l'une de tes cartes, une épreuve de maître dans l'annonce
// de son gardien. Ce module est pur, sans un chiffre écrit à la main
// (`bareme.ts`).

import { ACTES_DES_RANGS, ACTES_D_UNE_TRAVERSEE, MISES_DU_FLAMBEUR, OR_DU_TRESORIER, OR_D_UNE_MAITRISE } from './bareme'
import { NOMS_DES_DEFIS, RANGS, cleDeLaMaitrise, cleDuRang, type RangDUnDefi } from './sceaux'
import {
  GARDIENS_DES_ACTES,
  GARDIEN_D_HALLOWEEN,
  acteDe,
  carteDeLaTraversee,
  etatDuDepart,
  gardienDeLaTraversee,
  jouerUnGesteDeLaTraversee,
  type Acte,
  type AidesDUneEpreuve,
  type CleDeCarte,
  type DepartDeLaTraversee,
  type EtatDeLaTraversee,
  type GesteDeLaTraverseeEcrit,
} from './traversee'

/**
 * La version des règles des défis et des épreuves de maître : les traversées passées se relisent une fois à
 * chacune (`CabinetStore.relireLesDefis`, au démarrage) — un rang ou une épreuve de maître que la règle neuve donne
 * se range, rien ne se reprend (invariant 22). Elle monte quand une règle s'adoucit ou qu'un défi s'ajoute, pour
 * offrir d'emblée ce que les traversées d'avant tenaient ; un seuil relevé n'a pas à la monter.
 */
export const VERSION_DES_DEFIS = 1

// ── Ce que la traversée a fait, relevé ────────────────────────────────────

/** Une manche comptée contre un gardien : l'assaut et la manche, ses étoiles, sa mise, ce qu'elle a coûté. */
export interface MancheContreLeGardien {
  assaut: number
  manche: number
  etoiles: number
  misee: boolean
  coeurs: number
  paree: boolean
}

/** Un acte, tel que ses gestes l'ont fait : ce que les défis et l'épreuve de maître de son gardien lisent. */
export interface ActeRelu {
  acte: Acte
  gardien: string
  /** Son gardien vaincu : l'acte est fini. */
  fini: boolean
  /** L'or en poche à la chute de son gardien — son or et celui d'une amélioration qu'aucune carte ne prenait compris. */
  orALaChute: number | null
  /** Les manches que la Parade a couvertes. */
  parees: number
  /** Les cœurs perdus, aux épreuves et contre le gardien. */
  coeursPerdus: number
  /** Les achats chez le marchand. */
  achats: number
  /**
   * Ce qui a servi dans ses épreuves, sommé : Coup d'œil, Échange, le temps en plus de la Concentration. Null tant
   * qu'une de ses épreuves a été conclue sans le dire — avant le 1er novembre 2026, le serveur n'écrivait que les
   * étoiles : rien ne prouve alors qu'elles n'ont pas servi, et un défi qui les lit ne compte pas cet acte.
   */
  aides: AidesDUneEpreuve | null
  /** Ses assauts, et chaque manche comptée contre son gardien. */
  assauts: number
  contreLui: MancheContreLeGardien[]
  /** Sa chute : l'assaut, la manche, et si le coup était misé. */
  chute: { assaut: number; manche: number; misee: boolean } | null
  /** Le Second souffle a servi pendant l'acte, et pendant un assaut contre son gardien. */
  souffle: boolean
  souffleContreLui: boolean
}

/** Une traversée relevée : ses cartes, ses trois actes, ses mises, son Second souffle, sa victoire. */
export interface ReleveDeLaTraversee {
  cartes: readonly CleDeCarte[]
  actes: readonly ActeRelu[]
  mises: { gagnees: number; daffilee: number }
  /** L'acte où le Second souffle a servi ; null : il n'a pas servi. */
  souffle: Acte | null
  /** Les trois gardiens vaincus — le choix du légendaire pas encore fait compte déjà. */
  gagnee: boolean
}

const AUCUNE_AIDE: AidesDUneEpreuve = { eclairer: 0, changer: 0, temps: 0 }

function acteNeuf(d: DepartDeLaTraversee, acte: Acte): ActeRelu {
  return {
    acte,
    gardien: d.actes[acte]?.gardien ?? '',
    fini: false,
    orALaChute: null,
    parees: 0,
    coeursPerdus: 0,
    achats: 0,
    aides: AUCUNE_AIDE,
    assauts: 0,
    contreLui: [],
    chute: null,
    souffle: false,
    souffleContreLui: false,
  }
}

/** Le relevé, tenu à jour geste par geste : ce que `releverLaTraversee` rend, et ce que `defisDeLaTraversee` relit après chaque épreuve. */
interface EnCours {
  r: ReleveDeLaTraversee & { actes: ActeRelu[] }
  e: EtatDeLaTraversee
  suite: number
}

function commencer(d: DepartDeLaTraversee): EnCours {
  return {
    r: { cartes: [], actes: Array.from({ length: ACTES_D_UNE_TRAVERSEE }, (_, k) => acteNeuf(d, k as Acte)), mises: { gagnees: 0, daffilee: 0 }, souffle: null, gagnee: false },
    e: etatDuDepart(d),
    suite: 0,
  }
}

/**
 * Un geste de plus, passé au pli même de la traversée : un geste que le pli refuse ne compte pas — comme pour
 * l'état. Rend vrai quand c'était une épreuve conclue.
 */
function avancer(d: DepartDeLaTraversee, x: EnCours, { geste: g, faitLe }: GesteDeLaTraverseeEcrit): boolean {
  const avant = x.e
  const apres = jouerUnGesteDeLaTraversee(d, avant, g, faitLe)
  if (typeof apres === 'string') {
    x.e = { ...avant, rang: avant.rang + 1, ignores: avant.ignores + 1 }
    return false
  }
  x.e = apres
  const acte = x.r.actes[avant.acte]
  if (g.quoi === 'cartes') x.r = { ...x.r, cartes: apres.cartes.map(c => c.cle) }
  if (g.quoi === 'acheter') acte.achats++
  if (g.quoi !== 'conclure' || !apres.derniere) return false
  const b = apres.derniere
  // Ce qui a servi dans l'épreuve, que le serveur écrit au geste qui la conclut ; absent, l'acte ne prouve plus rien.
  acte.aides = acte.aides && g.aides ? { eclairer: acte.aides.eclairer + g.aides.eclairer, changer: acte.aides.changer + g.aides.changer, temps: acte.aides.temps + g.aides.temps } : null
  acte.coeursPerdus += b.coeurs
  if (b.gardien) acte.assauts++
  b.manches.forEach((m, k) => {
    if (!m.comptee) return
    if (m.paree) acte.parees++
    if (m.misee) {
      if ((m.etoiles ?? 0) > 0) {
        x.r.mises.gagnees++
        x.suite++
        x.r.mises.daffilee = Math.max(x.r.mises.daffilee, x.suite)
      } else x.suite = 0
    }
    if (b.gardien) acte.contreLui.push({ assaut: acte.assauts, manche: k, etoiles: m.etoiles ?? 0, misee: m.misee, coeurs: m.coeurs, paree: m.paree })
  })
  if (b.souffle) {
    acte.souffle = true
    if (b.gardien) acte.souffleContreLui = true
    x.r.souffle = avant.acte
  }
  if (b.vaincu) {
    acte.fini = true
    acte.orALaChute = apres.or
    // Le coup de grâce est la dernière manche comptée qui a frappé : après lui, plus rien ne compte.
    let k = -1
    b.manches.forEach((m, i) => {
      if (m.comptee && m.coups > 0) k = i
    })
    if (k >= 0) acte.chute = { assaut: acte.assauts, manche: k, misee: b.manches[k].misee }
  }
  x.r.gagnee = x.r.actes.every(a => a.fini)
  return true
}

/** La traversée relevée de son départ et de ses gestes, dans l'ordre : ce que les défis lisent. */
export function releverLaTraversee(d: DepartDeLaTraversee, gestes: readonly GesteDeLaTraverseeEcrit[]): ReleveDeLaTraversee {
  const x = commencer(d)
  for (const g of gestes) avancer(d, x, g)
  return x.r
}

// ── Les défis de tes cartes ───────────────────────────────────────────────

export interface DefiDUneCarte {
  carte: CleDeCarte
  /** Son nom, que l'Or fait porter comme un titre : « Le Trésorier » (`NOMS_DES_DEFIS`, `sceaux.ts`). */
  nom: string
  /** Ce qu'il demande, d'un mot, sous son nom. */
  idee: string
  /** Chaque rang en une phrase, composée des chiffres du barème. */
  rangs: readonly [string, string, string]
  /** Le plus haut rang qu'une traversée relevée tient ; 0 : aucun. Un rang tenu donne ceux d'en dessous. */
  rang: (r: ReleveDeLaTraversee) => 0 | RangDUnDefi
}

const FINIS_DITS = ['Un acte fini', 'Deux actes finis'] as const
const NOMBRES_DITS = ['Zéro', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix'] as const
const nombreDit = (n: number) => NOMBRES_DITS[n] ?? String(n)
const actesFinis = (n: number) => (n >= ACTES_D_UNE_TRAVERSEE ? 'La traversée gagnée' : (FINIS_DITS[n - 1] ?? `${n} actes finis`))

/** Le plus haut rang dont la condition tient : chaque condition se lit seule, et un rang tenu donne ceux d'en dessous. */
function plusHaut(tient: readonly [boolean, boolean, boolean]): 0 | RangDUnDefi {
  return tient[2] ? 3 : tient[1] ? 2 : tient[0] ? 1 : 0
}

/** Les rangs d'un défi « sans » : un, deux, puis trois actes finis sans que ceci ait servi. */
function sansRien(sans: (a: ActeRelu) => boolean): (r: ReleveDeLaTraversee) => 0 | RangDUnDefi {
  return r => {
    const n = r.actes.filter(a => a.fini && sans(a)).length
    return plusHaut([n >= ACTES_DES_RANGS[0], n >= ACTES_DES_RANGS[1], n >= ACTES_DES_RANGS[2]])
  }
}
const phrasesSans = (fin: string): readonly [string, string, string] => [`${actesFinis(ACTES_DES_RANGS[0])} ${fin}`, `${actesFinis(ACTES_DES_RANGS[1])} ${fin}`, `${actesFinis(ACTES_DES_RANGS[2])} ${fin}`]

/**
 * Les dix défis, un par carte, dans l'ordre des cartes. Six demandent d'avoir la carte et de s'en passer, acte
 * après acte ; le Trésorier, de l'or en poche ; le Flambeur, des mises gagnées ; l'Exécuteur, des gardiens abattus
 * d'un seul assaut ; le Revenant, de se relever et de finir quand même.
 */
export const DEFIS: readonly DefiDUneCarte[] = [
  {
    carte: 'coup-d-oeil',
    nom: NOMS_DES_DEFIS['coup-d-oeil'],
    idee: 'Garder l’indice pour soi',
    rangs: phrasesSans('sans un Coup d’œil'),
    rang: sansRien(a => a.aides !== null && a.aides.eclairer === 0),
  },
  {
    carte: 'echange',
    nom: NOMS_DES_DEFIS['echange'],
    idee: 'Jouer la manche qu’on te donne',
    rangs: phrasesSans('sans un Échange'),
    rang: sansRien(a => a.aides !== null && a.aides.changer === 0),
  },
  {
    carte: 'quitte-ou-double',
    nom: NOMS_DES_DEFIS['quitte-ou-double'],
    idee: 'Miser, et gagner',
    rangs: [
      `${nombreDit(MISES_DU_FLAMBEUR.gagnees)} mises gagnées dans une traversée`,
      `${nombreDit(MISES_DU_FLAMBEUR.daffilee[0])} mises gagnées d’affilée`,
      `${nombreDit(MISES_DU_FLAMBEUR.daffilee[1])} mises gagnées d’affilée`,
    ],
    rang: r => plusHaut([r.mises.gagnees >= MISES_DU_FLAMBEUR.gagnees, r.mises.daffilee >= MISES_DU_FLAMBEUR.daffilee[0], r.mises.daffilee >= MISES_DU_FLAMBEUR.daffilee[1]]),
  },
  {
    carte: 'concentration',
    nom: NOMS_DES_DEFIS['concentration'],
    idee: 'Répondre sans le temps offert',
    rangs: phrasesSans('sans puiser dans le temps en plus'),
    rang: sansRien(a => a.aides !== null && a.aides.temps === 0),
  },
  {
    carte: 'parade',
    nom: NOMS_DES_DEFIS['parade'],
    idee: 'Ne pas en avoir besoin',
    rangs: phrasesSans('sans qu’une Parade serve'),
    rang: sansRien(a => a.parees === 0),
  },
  {
    carte: 'cagnotte',
    nom: NOMS_DES_DEFIS['cagnotte'],
    idee: 'De l’or en poche',
    rangs: [
      `${OR_DU_TRESORIER[0]} pièces en poche à la chute d’un gardien`,
      `${OR_DU_TRESORIER[1]} pièces en poche à la chute d’un gardien`,
      `${OR_DU_TRESORIER[2]} pièces en poche à la chute du dernier`,
    ],
    rang: r => {
      const finis = r.actes.filter(a => a.fini && a.orALaChute !== null)
      const dernier = r.actes[ACTES_D_UNE_TRAVERSEE - 1]
      return plusHaut([finis.some(a => a.orALaChute! >= OR_DU_TRESORIER[0]), finis.some(a => a.orALaChute! >= OR_DU_TRESORIER[1]), dernier.fini && (dernier.orALaChute ?? 0) >= OR_DU_TRESORIER[2]])
    },
  },
  {
    carte: 'panacee',
    nom: NOMS_DES_DEFIS['panacee'],
    idee: 'Garder tous ses cœurs',
    rangs: phrasesSans('sans perdre un cœur'),
    rang: sansRien(a => a.coeursPerdus === 0),
  },
  {
    carte: 'pourboire',
    nom: NOMS_DES_DEFIS['pourboire'],
    idee: 'Le marchand peut attendre',
    rangs: phrasesSans('sans rien acheter'),
    rang: sansRien(a => a.achats === 0),
  },
  {
    carte: 'coup-de-grace',
    nom: NOMS_DES_DEFIS['coup-de-grace'],
    idee: 'Abattre d’un seul assaut',
    // Un gardien de l'acte I tombe presque toujours au premier assaut — six fois sur sept chez le joueur moyen du
    // calibrage — : le Bronze demande de l'abattre dès la deuxième manche ; ceux des actes II et III, eux, ont plus de
    // points de vie qu'un assaut n'a d'étoiles, sans mise ni Coup de grâce ++.
    rangs: ['Un gardien abattu dès la deuxième manche de ton premier assaut', 'Un gardien de l’acte II ou III vaincu au premier assaut', 'Le gardien de l’acte III vaincu au premier assaut'],
    rang: r => {
      const premiers = r.actes.filter(a => a.fini && a.chute?.assaut === 1)
      return plusHaut([r.actes.some(a => a.fini && dEntree(a)), premiers.some(a => a.acte >= 1), premiers.some(a => a.acte === 2)])
    },
  },
  {
    carte: 'second-souffle',
    nom: NOMS_DES_DEFIS['second-souffle'],
    idee: 'Revenir de loin',
    rangs: ['Ton Second souffle sert, et tu finis l’acte quand même', 'La traversée gagnée après ton Second souffle', 'Ton Second souffle sert avant l’acte III, et la traversée est gagnée'],
    rang: r => {
      const ou = r.souffle === null ? null : r.actes[r.souffle]
      return plusHaut([!!ou?.fini, r.souffle !== null && r.gagnee, r.souffle !== null && r.souffle < ACTES_D_UNE_TRAVERSEE - 1 && r.gagnee])
    },
  },
]

const DEFI_PAR_CARTE = new Map(DEFIS.map(x => [x.carte as string, x]))
/** Le défi d'une carte, par sa clé — une `Map`, jamais `TABLE[cle]` : un objet répond aussi de son prototype. */
export const defiDeLaCarte = (cle: unknown): DefiDUneCarte | null => (typeof cle === 'string' ? (DEFI_PAR_CARTE.get(cle) ?? null) : null)

// ── Les épreuves de maître ────────────────────────────────────────────────

/** Ce qu'une épreuve de maître lit : l'acte de son gardien, fini. */
type Maitrise = (a: ActeRelu) => boolean

const unSeulAssaut: Maitrise = a => a.chute?.assaut === 1
const sansFaute: Maitrise = a => a.contreLui.every(m => m.etoiles > 0)
const sansPerdreUnCoeur: Maitrise = a => a.contreLui.every(m => m.coeurs === 0) && !a.souffleContreLui
const toutesLesEtoiles: Maitrise = a => a.contreLui.length > 0 && a.contreLui.every(m => m.etoiles === 3)
const surUneMise: Maitrise = a => a.chute?.misee === true
/** Abattu dès la deuxième manche de son premier assaut : d'un assaut suivant, il ne lui restait presque rien. */
const dEntree: Maitrise = a => a.chute !== null && a.chute.assaut === 1 && a.chute.manche <= 1
const orEnPoche: Maitrise = a => a.orALaChute !== null && a.orALaChute >= OR_D_UNE_MAITRISE[a.acte]
/** Tombé dans l'assaut même où tu as perdu un cœur, avant le coup de grâce : se relever de ses erreurs. */
const apresUnCoeurPerdu: Maitrise = a => a.chute !== null && a.contreLui.some(m => m.assaut === a.chute!.assaut && m.manche < a.chute!.manche && m.coeurs > 0)
const apresLeSouffle: Maitrise = a => a.souffleContreLui

/** Les conditions des épreuves de maître, une par sorte — exportées pour le calibrage et les épreuves, qui les mesurent une à une. */
export const CONDITIONS_DE_MAITRISE = { unSeulAssaut, sansFaute, sansPerdreUnCoeur, toutesLesEtoiles, surUneMise, dEntree, orEnPoche, apresUnCoeurPerdu, apresLeSouffle } as const

const DITS = {
  unSeulAssaut: 'au premier assaut',
  sansFaute: 'sans rater une manche contre lui',
  sansPerdreUnCoeur: 'sans perdre un cœur contre lui',
  toutesLesEtoiles: 'avec trois étoiles à chaque manche contre lui',
  surUneMise: 'd’un coup porté sur une mise',
  dEntree: 'dès la deuxième manche de ton premier assaut',
  apresUnCoeurPerdu: 'dans l’assaut même où tu perds un cœur',
  apresLeSouffle: 'après que ton Second souffle t’a relevé contre lui',
} as const
type SorteDeMaitrise = keyof typeof DITS | 'orEnPoche'
const SORTES: Readonly<Record<SorteDeMaitrise, Maitrise>> = CONDITIONS_DE_MAITRISE

/**
 * L'épreuve de maître de chaque gardien, dans l'esprit de sa devise : le Dragon garde son or, le Phénix renaît de
 * ses cendres, la Comète ne passe qu'une fois. On la lit dès l'écran des trois gardiens, avant de choisir ses
 * cartes : certaines s'y préparent — sur une mise, après le Second souffle.
 */
const MAITRISES = new Map<string, SorteDeMaitrise>(
  Object.entries({
    // L'acte I : des gardiens doux — au calibrage, le joueur moyen qui les vainc les maîtrise une fois sur cinq à peu près.
    'lg:renard': 'toutesLesEtoiles',
    'lg:coq': 'dEntree',
    'lg:chouette': 'toutesLesEtoiles',
    'lg:tigre': 'dEntree',
    'lg:chauve-souris': 'apresUnCoeurPerdu',
    'lg:scarabee': 'orEnPoche',
    'lg:citrouille': 'surUneMise',
    // L'acte II : une fois sur cinq à dix ; le Lion, roi de sa carte, une fois sur vingt-cinq.
    'lg:sphinx': 'sansFaute',
    'lg:janus': 'surUneMise',
    'lg:phenix': 'apresUnCoeurPerdu',
    'lg:fantome': 'sansPerdreUnCoeur',
    'lg:salamandre': 'orEnPoche',
    'lg:lion': 'unSeulAssaut',
    'lg:oracle': 'sansFaute',
    'lg:serpent': 'sansPerdreUnCoeur',
    // L'acte III : une fois sur dix à quatre ; la Comète, qui ne passe qu'une fois, presque jamais.
    'lg:dragon': 'orEnPoche',
    'lg:kraken': 'apresLeSouffle',
    'lg:chimere': 'sansFaute',
    'lg:ouroboros': 'apresUnCoeurPerdu',
    'lg:trou-noir': 'sansPerdreUnCoeur',
    'lg:comete': 'unSeulAssaut',
  } satisfies Record<string, SorteDeMaitrise>),
)

/** L'acte où un gardien se rencontre : son cercle (`GARDIENS_DES_ACTES`), la Citrouille à l'acte I. */
const acteDuGardien = (gardien: string): Acte => (gardien === GARDIEN_D_HALLOWEEN ? 0 : (Math.max(0, GARDIENS_DES_ACTES.findIndex(l => l.includes(gardien))) as Acte))

/** L'épreuve de maître d'un gardien, en une phrase — « Le vaincre avec 300 pièces en poche » ; null : pas un gardien de la traversée. */
export function maitriseDite(gardien: unknown): string | null {
  const g = gardienDeLaTraversee(gardien)
  const sorte = g ? MAITRISES.get(g.cle) : undefined
  if (!g || !sorte) return null
  const le = sorte === 'orEnPoche' ? `avec ${OR_D_UNE_MAITRISE[acteDuGardien(g.cle)]} pièces en poche` : DITS[sorte]
  return `Le vaincre ${le}`
}

const COURTS = {
  unSeulAssaut: 'Au premier assaut',
  sansFaute: 'Sans rater une manche',
  sansPerdreUnCoeur: 'Sans perdre un cœur',
  toutesLesEtoiles: '★★★ à chaque manche',
  surUneMise: 'Sur une mise',
  dEntree: 'En deux manches',
  apresUnCoeurPerdu: 'Après un cœur perdu',
  apresLeSouffle: 'Après le Second souffle',
} as const satisfies Record<keyof typeof DITS, string>

/**
 * La même, en quelques mots, sous le médaillon du gardien (« Sans perdre un cœur ») : l'écran des trois gardiens en
 * disait la phrase entière de chacun, trois phrases sous trois médaillons — « trop de texte, pas assez visuel et
 * sobre » (le propriétaire, le 1er novembre 2026). L'annonce du gardien la redit en entier (`maitriseDite`).
 */
export function maitriseCourte(gardien: unknown): string | null {
  const g = gardienDeLaTraversee(gardien)
  const sorte = g ? MAITRISES.get(g.cle) : undefined
  if (!g || !sorte) return null
  return sorte === 'orEnPoche' ? `${OR_D_UNE_MAITRISE[acteDuGardien(g.cle)]} pièces en poche` : COURTS[sorte]
}

// ── Ce qu'une traversée a atteint ─────────────────────────────────────────

/** Ce qu'une traversée a atteint : ses clés, et ce que chaque épreuve conclue a fait tomber — son bilan le dit. */
export interface DefisDUneTraversee {
  cles: string[]
  parPartie: ReadonlyMap<string, readonly string[]>
}

/** Les clés que tient un relevé : chaque rang de chaque défi de ses cartes — ceux d'en dessous compris —, chaque gardien vaincu en maître. */
function clesDuReleve(r: ReleveDeLaTraversee): string[] {
  const cles: string[] = []
  for (const carte of r.cartes) {
    const x = defiDeLaCarte(carte)
    if (!x) continue
    const n = x.rang(r)
    for (const k of RANGS) if (k <= n) cles.push(cleDuRang(carte, k))
  }
  for (const a of r.actes) {
    const sorte = a.fini ? MAITRISES.get(a.gardien) : undefined
    if (sorte && SORTES[sorte](a)) cles.push(cleDeLaMaitrise(a.gardien))
  }
  return cles
}

/**
 * Ce qu'une traversée a atteint, épreuve par épreuve : le pli rejoué geste à geste, les défis relus après chaque
 * épreuve conclue — seules les épreuves font tomber un défi : un acte se finit à la chute de son gardien, une mise
 * se gagne dans une manche. Un rang atteint le reste, quoi que la suite fasse : la traversée perdue ne reprend rien.
 */
export function defisDeLaTraversee(d: DepartDeLaTraversee, gestes: readonly GesteDeLaTraverseeEcrit[]): DefisDUneTraversee {
  const x = commencer(d)
  const tenues = new Set<string>()
  const parPartie = new Map<string, string[]>()
  for (const g of gestes) {
    if (!avancer(d, x, g) || g.geste.quoi !== 'conclure') continue
    const neuves = clesDuReleve(x.r).filter(c => !tenues.has(c))
    for (const c of neuves) tenues.add(c)
    if (neuves.length > 0) parPartie.set(g.geste.partie, neuves)
  }
  return { cles: [...tenues], parPartie }
}

/** Le gardien d'une étape de gardien — l'acte qu'elle ouvre —, pour dire son épreuve de maître. */
export const gardienDeLActe = (d: Pick<DepartDeLaTraversee, 'actes'>, etape: string): string | null => d.actes[acteDe(etape)]?.gardien ?? null

/** Le nom d'une carte, pour dire un défi : « la Cagnotte ». */
export const carteDuDefi = (x: Pick<DefiDUneCarte, 'carte'>): string => carteDeLaTraversee(x.carte)?.nom ?? x.carte
