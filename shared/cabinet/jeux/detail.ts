// Le Détail : reconnaître un tableau. Il s'ouvre sur un détail ; « Reculer
// d'un pas » en montre plus, et coûte une étoile — quatre cadrages emboîtés,
// du détail au tableau entier, les images que l'Expédition a fait découper
// (`server/content/details/`). Quatre titres proposés, chacun avec son
// peintre : le bon et trois d'époques voisines, parce que deviner à l'époque
// ne doit pas suffire (la maquette, `retours/2026-10-24/maquette/jeu.js`).
//
// Ici, la règle pure (le moule : `regle.ts`) : ce que vaut chaque cadrage, ce
// qu'Éclairer efface, ce que la manche montre et ce que la révélation dit,
// la pièce que le journal garde — un tableau n'est pas la question « Qui a
// peint… ? » de la base : `cab:tableau:<QID>`, ni carnet ni signalement ; ses
// trois leurres y comptent vus avec lui (`cabinet.montre`). Et ce
// que le serveur appelle sans le recopier : les fenêtres de quatre tableaux qui
// se suivent dans le temps (`fenetresDuDetail`), la manche d'une fenêtre — le
// bon au hasard parmi ses quatre, l'ordre des titres, figés au départ
// (`detailDUneFenetre`) —, la garde de la route des images (`refusDuCadrage`)
// et son adresse (`adresseDUnCadrage`), que la page lit aussi. Le choix de la
// fenêtre — la jamais vue d'abord — et les fichiers restent au serveur.
//
// Rien ici ne lit l'heure ni ne tire au hasard de lui-même : le hasard vient
// de qui l'appelle — celui du serveur pour le tirage, la graine secrète de la
// partie pour Éclairer —, et le pli rejoué redonne la même manche.

import { DUREES_DES_JEUX, ETOILES_AU_CADRAGE, TITRES_DU_DETAIL } from '../bareme'
import { idDuTableau, type PieceDuCabinet } from '../pieces'
import { effacablesAuPlus } from '../pouvoirs'
import { GESTE_A_JUGER, auHasard, battre, champsDuGeste, estUnIndex, reponseEnvoyee, rienAEclairer, type RegleQuiTranche } from './outils'
import { justeDeLaPiece, type VerdictDUneManche } from './regle'

/** Un tableau tel que le tirage le connaît : son identifiant Wikidata nomme ses cadrages, et ne quitte jamais le serveur. */
export interface TableauDuCabinet {
  qid: string
  titre: string
  peintre: string
  annee: number
}

/** Un titre proposé, avec son peintre : sous chaque titre, la maquette disait qui l'a peint. */
export interface TitrePropose {
  titre: string
  peintre: string
}

/**
 * Un titre tel que le départ le fige : avec l'identifiant de son tableau, qui
 * ne quitte jamais le serveur — ni `montrer` ni `reveler` ne le prennent. La
 * pièce le porte pour chaque leurre (`cabinet.montre`) : montré avec son
 * peintre, chacun dit la réponse des « Qui a peint… ? » qui le nomment.
 * Absent d'un départ écrit avant (le 26 octobre 2026, des bases jetables) :
 * ses leurres ne se comptent pas.
 */
export interface TitreTire extends TitrePropose {
  qid?: string
}

/** Ce que le départ fige d'une manche du Détail. */
export interface DetailTire {
  jeu: 'detail'
  tableau: TableauDuCabinet
  /** Les quatre titres, dans l'ordre où la page les montre — figé au départ, rejoué tel quel. */
  titres: TitreTire[]
  /** L'indice du bon dans `titres`. */
  bonne: number
  /** L'anecdote de sa question de la base ; sans elle, la révélation dit ce qu'il est. */
  anecdote: string | null
  /** La catégorie de la pièce : les missions « catégorie » la lisent. */
  categorie: string
}

/** Où en est une manche : le cadrage atteint (1, le détail, au tableau entier) et les titres qu'Éclairer a effacés. */
export interface EtatDuDetail {
  cadrage: number
  effaces: number[]
}

/** Ce que la page envoie au Détail : un pas en arrière, ou sa réponse — à l'échéance, peut-être aucune. */
export type GesteDuDetail = { quoi: 'reculer' } | { quoi: 'repondre'; titre: number | null }

/** Ce que la manche montre : jamais quel titre est le bon, ni rien du tableau — ni son identifiant, ni son année (invariant 1). */
export interface DetailMontre {
  jeu: 'detail'
  /** Le cadrage atteint : la page demande son image par la route du Détail. */
  cadrage: number
  cadrages: number
  /** « Ta réponse vaut ★★★ » : les étoiles d'une bonne réponse, maintenant. */
  vaut: number
  peutReculer: boolean
  titres: (TitrePropose & { efface: boolean })[]
}

/** La révélation : le tableau nommé, où il en était, ce qu'il avait répondu. */
export interface DetailRevele {
  jeu: 'detail'
  /** « Reconnu » — « Reconnu, au tableau entier », quand il ne valait plus d'étoile —, ou « C’était… ». */
  titre: string
  reconnu: boolean
  tableau: { titre: string; peintre: string; annee: number }
  /** Le cadrage où il a répondu, ou où il en était. */
  cadrage: number
  /** « Tu avais répondu « … » » : le titre choisi, quand ce n'était pas le bon. */
  repondu: string | null
  titres: (TitrePropose & { bon: boolean; choisi: boolean; efface: boolean })[]
  /** « Le savais-tu ? » */
  savais: string
}

/** Ce que demande la pièce d'un Détail, au journal et au cartel. */
export const QUESTION_DU_TABLEAU = 'Quel est ce tableau ?'

/** Les cadrages d'un tableau : autant que le barème en compte, du détail au tableau entier — les quatre images livrées. */
const CADRAGES = ETOILES_AU_CADRAGE.length

/** Les étoiles d'une bonne réponse à ce cadrage (de 1 à `CADRAGES`). */
const etoilesAuCadrage = (cadrage: number) => (ETOILES_AU_CADRAGE[cadrage - 1] ?? 0) as VerdictDUneManche['naturel']

/** L'ordre du temps : par année, puis par identifiant — la même graine redonne la même manche, quel que soit l'ordre du fichier. */
const avantDansLeTemps = (a: TableauDuCabinet, b: TableauDuCabinet) => a.annee - b.annee || (a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0)

/**
 * Les fenêtres du Détail : chaque suite de `TITRES_DU_DETAIL` tableaux
 * consécutifs dans l'ordre du temps, un seul par titre — deux titres pareils
 * feraient deux bonnes réponses ; de deux tableaux du même titre, le plus
 * ancien reste. Quatre tableaux qui se suivent : autour de chacun, trois
 * titres d'époques voisines — deviner à l'époque ne suffit pas. Aucune sous
 * quatre titres.
 */
export function fenetresDuDetail<T extends TableauDuCabinet>(tableaux: readonly T[]): T[][] {
  const titres = new Set<string>()
  const dansLeTemps: T[] = []
  for (const x of [...tableaux].sort(avantDansLeTemps)) {
    if (titres.has(x.titre)) continue
    titres.add(x.titre)
    dansLeTemps.push(x)
  }
  return Array.from({ length: Math.max(0, dansLeTemps.length - TITRES_DU_DETAIL + 1) }, (_, d) => dansLeTemps.slice(d, d + TITRES_DU_DETAIL))
}

/** La manche d'une fenêtre dont le bon est choisi : les quatre battus, l'ordre figé au départ. */
function mancheDeLaFenetre(fenetre: readonly TableauDuCabinet[], bon: TableauDuCabinet, hasard: () => number, o: { anecdote: string | null; categorie: string }): DetailTire {
  const proposes = battre(fenetre, hasard)
  return {
    jeu: 'detail',
    tableau: { qid: bon.qid, titre: bon.titre, peintre: bon.peintre, annee: bon.annee },
    titres: proposes.map(x => ({ titre: x.titre, peintre: x.peintre, qid: x.qid })),
    bonne: proposes.indexOf(bon),
    anecdote: o.anecdote,
    categorie: o.categorie,
  }
}

/**
 * La manche d'une fenêtre que le serveur a choisie (`fenetresDuDetail`) : le
 * bon au hasard parmi ses quatre titres, puis les quatre battus — l'ordre se
 * fige au départ.
 *
 * La fenêtre d'abord, le bon ensuite, et rien d'autre que le hasard pour le
 * choisir : ce qui le choisissait se lisait dans les quatre titres. Tirés
 * parmi ses cinq plus proches voisins en années, les trois leurres faisaient
 * du bon le seul des quatre dont les voisins contenaient les trois autres —
 * une fois sur deux sans regarder l'image, pour qui sait les années du
 * catalogue, que chaque révélation dit (la tablée du 25 octobre 2026, axe 9).
 * Une fenêtre tirée autour d'un bon choisi d'abord le désignait encore aux
 * deux bouts du temps, où moins de fenêtres le contiennent ; et choisi le
 * moins vu, le bon était le titre des quatre qu'on avait vu il y a le plus
 * longtemps : à coup sûr, une fois le catalogue révélé (la relecture du
 * 26 octobre 2026). Ainsi, chacun des quatre est le bon une fois sur quatre,
 * quoi qu'on sache d'eux. La fraîcheur passe par le choix de la fenêtre, au
 * serveur (`tirerUnDetail`) : il la sait sans rien en dire.
 */
export function detailDUneFenetre(
  fenetre: readonly TableauDuCabinet[],
  hasard: () => number,
  o: { anecdoteDe: (qid: string) => string | null; categorie: string },
): DetailTire {
  const bon = auHasard(fenetre, hasard)
  return mancheDeLaFenetre(fenetre, bon, hasard, { anecdote: o.anecdoteDe(bon.qid), categorie: o.categorie })
}

/**
 * La manche d'un tableau déjà choisi : la fenêtre au hasard parmi celles qui le
 * contiennent (`fenetresDuDetail`), jamais le tableau lui-même ni un autre de
 * son titre en leurre. Pour qui tire ses tableaux lui-même — le calibrage, qui
 * mesure ce que sait un joueur, pas ce qu'il devine. Le serveur, lui, tire la
 * fenêtre d'abord (`detailDUneFenetre`) : le bon choisi avant elle, les deux
 * bouts du temps le désignent un peu — 26 % de bonnes réponses sans regarder
 * l'image sur les cent tableaux, 39 % sur dix. Null : moins de quatre titres à
 * proposer.
 */
export function detailTire(
  tableau: TableauDuCabinet,
  autres: readonly TableauDuCabinet[],
  hasard: () => number,
  o: { anecdote: string | null; categorie: string },
): DetailTire | null {
  const siennes = fenetresDuDetail([tableau, ...autres.filter(x => x.qid !== tableau.qid && x.titre !== tableau.titre)]).filter(f => f.includes(tableau))
  return siennes.length > 0 ? mancheDeLaFenetre(auHasard(siennes, hasard), tableau, hasard, o) : null
}

/**
 * La route des images du Détail sert-elle ce cadrage ? Le premier dès
 * l'ouverture, un de plus à chaque « Reculer », tous une fois la manche
 * tranchée : servi d'avance, le tableau entier se téléchargerait avant la
 * réponse (invariant 1). Null : il se sert ; sinon, le refus en mots.
 */
export function refusDuCadrage(e: EtatDuDetail, cadrage: number, tranchee: boolean): string | null {
  if (!Number.isInteger(cadrage) || cadrage < 1 || cadrage > CADRAGES) return 'Ce cadrage n’existe pas'
  return tranchee || cadrage <= e.cadrage ? null : 'Recule d’un pas pour voir plus'
}

/**
 * L'adresse d'un cadrage, que la route sert (`server/src/cabinet.ts`) : la
 * partie, l'indice du tableau dans son plan figé (`DepartDUnePartie.tirages`,
 * que la vue dit — `VueDeLaPartie.tirage`), le cadrage. Ni l'identifiant du
 * tableau, ni son titre. Un indice du plan plutôt que la manche : après
 * « Changer », la même manche joue un autre tableau, et son adresse d'avant
 * aurait rendu du cache du téléphone l'image d'avant — un indice du plan ne
 * désigne jamais deux tableaux, et chaque adresse, une seule image, gardée
 * un jour par le téléphone.
 */
export const adresseDUnCadrage = (partie: string, tirage: number, cadrage: number) => `/api/cabinet/partie/${encodeURIComponent(partie)}/detail/${tirage}/${cadrage}`

/** « 2|1 » : le cadrage atteint, puis le titre choisi — `.` sans réponse, comme une affirmation pas répondue à l'Éclair. */
const composee = (cadrage: number, titre: number | null) => `${cadrage}|${titre ?? '.'}`

/** La colonne `composee` relue : la révélation d'une partie finie se refait du verdict, comme celle en cours (invariant 14). */
function relue(c: string | null | undefined): { cadrage: number; titre: number | null } | null {
  const m = typeof c === 'string' ? /^(\d+)\|(\d+|\.)$/.exec(c) : null
  return m ? { cadrage: Number(m[1]), titre: m[2] === '.' ? null : Number(m[2]) } : null
}

/** « Le savais-tu ? » : l'anecdote de sa question de la base, sinon ce qu'il est. */
const savaisDuDetail = (t: DetailTire) => t.anecdote ?? `${t.tableau.titre}, peint par ${t.tableau.peintre} en ${t.tableau.annee}.`

/** La réponse dite, au journal et au cartel. */
const reponseDite = (t: DetailTire) => `${t.tableau.titre} — ${t.tableau.peintre}, ${t.tableau.annee}`

export const REGLE_DU_DETAIL: RegleQuiTranche<DetailTire, EtatDuDetail, GesteDuDetail, DetailMontre, DetailRevele> = {
  cle: 'detail',
  etapes: 1,
  dureeMs: () => DUREES_DES_JEUX.detail * 1000,

  ouvrir: () => ({ cadrage: 1, effaces: [] }),

  lireLeGeste(brut, t) {
    const g = champsDuGeste(brut)
    if (g?.quoi === 'reculer') return { quoi: 'reculer' }
    if (g?.quoi !== 'repondre') return null
    const r = reponseEnvoyee(g, 'detail')
    // Sans réponse, la page envoie ce qu'elle a à l'échéance : rien, qui ne vaut rien.
    if (r === undefined) return { quoi: 'repondre', titre: null }
    return r !== null && estUnIndex(r.titre, t.titres.length) ? { quoi: 'repondre', titre: r.titre } : null
  },

  // « Reculer » coûte une étoile et laisse la manche ouverte ; une réponse, même vide à l'échéance, la tranche.
  tranche: (_t, _e, g) => g.quoi === 'repondre',

  apresLeGeste(_t, e, g) {
    if (g.quoi !== 'reculer') return GESTE_A_JUGER
    return e.cadrage >= CADRAGES ? 'Tu vois déjà le tableau entier' : { ...e, cadrage: e.cadrage + 1 }
  },

  juger(t, e, reponse) {
    const titre = typeof reponse === 'string' || reponse.quoi !== 'repondre' ? null : reponse.titre
    if (titre === null) return { naturel: 0, pieces: [{ juste: false, choix: null, composee: composee(e.cadrage, null) }] }
    // Un titre effacé est un mauvais titre : Éclairer n'efface jamais le bon.
    const naturel = titre === t.bonne ? etoilesAuCadrage(e.cadrage) : 0
    const juste = justeDeLaPiece(naturel, 'detail') === true
    return { naturel, pieces: [{ juste, choix: juste ? 0 : -1, composee: composee(e.cadrage, titre) }] }
  },

  eclairer(t, e, hasard) {
    // Deux titres restent toujours : un seul serait la réponse, donnée par la carte-bonus.
    const restants = t.titres.map((_, i) => i).filter(i => i !== t.bonne && !e.effaces.includes(i))
    if (e.effaces.length >= effacablesAuPlus(t.titres.length) || restants.length === 0) return rienAEclairer('detail')
    return { ...e, effaces: [...e.effaces, auHasard(restants, hasard)] }
  },

  montrer: (t, e) => ({
    jeu: 'detail',
    cadrage: e.cadrage,
    cadrages: CADRAGES,
    vaut: etoilesAuCadrage(e.cadrage),
    peutReculer: e.cadrage < CADRAGES,
    titres: t.titres.map((x, i) => ({ titre: x.titre, peintre: x.peintre, efface: e.effaces.includes(i) })),
  }),

  reveler(t, e, v) {
    const lu = relue(v.pieces[0]?.composee)
    const choisi = lu?.titre ?? null
    const reconnu = choisi === t.bonne
    const cadrage = lu?.cadrage ?? e.cadrage
    return {
      jeu: 'detail',
      // Reconnu au tableau entier, le bon titre ne vaut plus d'étoile : « Reconnu » seul, sur un bandeau sans étoile, se lisait
      // comme une victoire.
      titre: !reconnu ? 'C’était…' : cadrage >= CADRAGES ? 'Reconnu, au tableau entier' : 'Reconnu',
      reconnu,
      tableau: { titre: t.tableau.titre, peintre: t.tableau.peintre, annee: t.tableau.annee },
      cadrage,
      repondu: choisi !== null && !reconnu ? (t.titres[choisi]?.titre ?? null) : null,
      titres: t.titres.map((x, i) => ({ titre: x.titre, peintre: x.peintre, bon: i === t.bonne, choisi: i === choisi, efface: e.effaces.includes(i) })),
      savais: savaisDuDetail(t),
    }
  },

  piece: (t, _e, _v, i): PieceDuCabinet => {
    // Ses leurres, montrés avec leur peintre dès l'ouverture : chacun dit la réponse des « Qui a peint… ? » qui le
    // nomment. Seul le bon s'écrivait vu, et une partie libre, illimitée, soufflait neuf réponses de peintre que le duel
    // classé posait ensuite comme neuves (la deuxième tablée, le 26 octobre 2026).
    const leurres = t.titres.flatMap((x, k) => (k !== t.bonne && x.qid ? [idDuTableau(x.qid)] : []))
    return {
      id: idDuTableau(t.tableau.qid),
      texte: QUESTION_DU_TABLEAU,
      reponses: [reponseDite(t)],
      bonne: 0,
      categorie: t.categorie,
      anecdote: savaisDuDetail(t),
      // Un tableau n'a pas de marche mesurée : moyen, comme tout contenu sans elle.
      niveau: 'moyen',
      forme: 'detail',
      cabinet: { jeu: 'detail', manche: i.manche, tirage: i.tirage, ...(leurres.length > 0 && { montre: leurres }) },
    }
  },

  cartel: t => ({ sujet: QUESTION_DU_TABLEAU, reponse: reponseDite(t), anecdote: savaisDuDetail(t) }),
}
