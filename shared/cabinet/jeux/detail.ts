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
// peint… ? » de la base : `cab:tableau:<QID>`, ni carnet ni signalement. Et
// deux règles que le serveur appelle sans les recopier : la manche tirée d'un
// tableau choisi (`detailTire`, ses voisins et l'ordre des titres, figés au
// départ) et la garde de la route des images (`refusDuCadrage`). Le choix du
// tableau — jamais vu d'abord — et ses fichiers restent au serveur.
//
// Rien ici ne lit l'heure ni ne tire au hasard de lui-même : le hasard vient
// de la graine de la partie, et le pli rejoué redonne la même manche.

import { DUREES_DES_JEUX, ETOILES_AU_CADRAGE, TITRES_DU_DETAIL, VOISINS_EN_ANNEES } from '../bareme'
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

/** Ce que le départ fige d'une manche du Détail. */
export interface DetailTire {
  jeu: 'detail'
  tableau: TableauDuCabinet
  /** Les quatre titres, dans l'ordre où la page les montre — figé au départ, rejoué tel quel. */
  titres: TitrePropose[]
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
  /** « Reconnu », ou « C’était… ». */
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

/**
 * La manche tirée d'un tableau que le serveur a choisi : trois autres titres
 * pris au hasard parmi les `VOISINS_EN_ANNEES` tableaux les plus proches en
 * années, puis les quatre battus — l'ordre se fige au départ. Plus large que
 * cinq, l'époque redevenait un indice ; au plus proche seul, les mêmes
 * voisins revenaient toujours ensemble. Jamais le tableau lui-même ni un
 * titre déjà proposé : deux titres pareils feraient deux bonnes réponses.
 * À égalité d'écart, l'identifiant départage — la même graine redonne la même
 * manche, quel que soit l'ordre du fichier. Null : moins de trois voisins.
 */
export function detailTire(
  tableau: TableauDuCabinet,
  autres: readonly TableauDuCabinet[],
  hasard: () => number,
  o: { anecdote: string | null; categorie: string },
): DetailTire | null {
  const ecart = (x: TableauDuCabinet) => Math.abs(x.annee - tableau.annee)
  const proches: TableauDuCabinet[] = []
  for (const x of [...autres].sort((a, b) => ecart(a) - ecart(b) || (a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0))) {
    if (proches.length === VOISINS_EN_ANNEES) break
    if (x.qid === tableau.qid || x.titre === tableau.titre || proches.some(p => p.titre === x.titre)) continue
    proches.push(x)
  }
  const leurres = TITRES_DU_DETAIL - 1
  if (proches.length < leurres) return null
  const proposes = battre([{ x: tableau, bon: true }, ...battre(proches, hasard).slice(0, leurres).map(x => ({ x, bon: false }))], hasard)
  return {
    jeu: 'detail',
    tableau: { qid: tableau.qid, titre: tableau.titre, peintre: tableau.peintre, annee: tableau.annee },
    titres: proposes.map(({ x }) => ({ titre: x.titre, peintre: x.peintre })),
    bonne: proposes.findIndex(p => p.bon),
    anecdote: o.anecdote,
    categorie: o.categorie,
  }
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
    return {
      jeu: 'detail',
      titre: reconnu ? 'Reconnu' : 'C’était…',
      reconnu,
      tableau: { titre: t.tableau.titre, peintre: t.tableau.peintre, annee: t.tableau.annee },
      cadrage: lu?.cadrage ?? e.cadrage,
      repondu: choisi !== null && !reconnu ? (t.titres[choisi]?.titre ?? null) : null,
      titres: t.titres.map((x, i) => ({ titre: x.titre, peintre: x.peintre, bon: i === t.bonne, choisi: i === choisi, efface: e.effaces.includes(i) })),
      savais: savaisDuDetail(t),
    }
  },

  piece: (t, _e, _v, i): PieceDuCabinet => ({
    id: idDuTableau(t.tableau.qid),
    texte: QUESTION_DU_TABLEAU,
    reponses: [reponseDite(t)],
    bonne: 0,
    categorie: t.categorie,
    anecdote: savaisDuDetail(t),
    // Un tableau n'a pas de marche mesurée : moyen, comme tout contenu sans elle.
    niveau: 'moyen',
    forme: 'detail',
    cabinet: { jeu: 'detail', manche: i.manche, tirage: i.tirage },
  }),

  cartel: t => ({ sujet: QUESTION_DU_TABLEAU, reponse: reponseDite(t), anecdote: savaisDuDetail(t) }),
}
