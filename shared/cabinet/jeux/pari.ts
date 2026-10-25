// Le Pari : une question facile ou moyenne ; juste, il garde deux étoiles, ou
// les parie sur une question difficile de la même catégorie — réussie, trois
// étoiles ; ratée, rien. Garder n'en valait qu'une jusqu'au calibrage du
// 25 octobre 2026 : une commune y était presque hors d'atteinte, et les mots
// de l'écran suivent le barème (`ETOILES_DU_PARI`), jamais un nombre écrit en
// dur. Pur : la partie tire les deux questions au départ
// (`PariTire`), et rien ne se tire à « Parier » — la seconde est figée, et une
// reprise après un redémarrage redonne la même.
//
// Deux étapes, chacune son chrono (`etapes`, `dureeMs`) ; entre « Juste ! » et
// « Garder » ou « Parier », aucun : la difficile n'est pas encore montrée, il
// n'y a rien à chercher (`auChoix`). Le pli lit `etape` et `auChoix` pour ses
// échéances.
//
// Deux pièces au plus, une par question : chacune juste à sa bonne réponse,
// pas aux étoiles. Seule la première, répondue dans les temps et sans aide,
// est nue (D4) : la seconde n'est répondue que par qui parie — des joueurs
// sûrs d'eux —, et une première expirée ou quittée compterait fausse à la
// mesure, qui ne lit pas si elle a été répondue. Le temps en plus de « Prendre
// son temps », seul le pli le sait : il marque la ligne `pouvoir:temps` et le
// dit à `piece` (`aidee`) — nue, une réponse aidée compterait à la mesure, à la
// précision et à L'Érudit.

import { DUREES_DES_JEUX, ETOILES_DU_PARI } from '../bareme'
import { effacablesAuPlus } from '../pouvoirs'
import {
  GESTE_A_JUGER,
  auHasard,
  champsDuGeste,
  estUnIndex,
  naturelDe,
  pieceDeLaQuestion,
  reponseEnvoyee,
  rienAEclairer,
  type QuestionTiree,
} from './outils'
import type { RegleDuJeu, VerdictDUneManche } from './regle'

/** Les deux questions d'une manche du Pari, tirées au départ : la seconde, difficile ou experte, de la même catégorie. */
export interface PariTire {
  jeu: 'pari'
  q1: QuestionTiree
  q2: QuestionTiree
}

export interface EtatDuPari {
  /** La question en jeu : la première, puis celle du pari. */
  etape: 1 | 2
  /** Juste à la première : il garde ou il parie, et aucun chrono ne court. */
  auChoix: boolean
  /** Sa réponse à la première question, quand elle était juste ; null avant. */
  choix1: number | null
  /** Les réponses qu'Éclairer a effacées, à chaque étape : jamais la bonne, deux au plus (`effacablesAuPlus`). */
  effacees: readonly [readonly number[], readonly number[]]
}

/** Ce que la page envoie au Pari : une réponse — `null` si elle part sans, à l'échéance —, garder, parier. */
export type GesteDuPari = { quoi: 'repondre'; choix: number | null } | { quoi: 'garder' } | { quoi: 'parier' }

/** Ce que la page reçoit d'une manche du Pari : la question en jeu, jamais sa bonne réponse, jamais la seconde avant « Parier ». */
export interface PariMontre {
  jeu: 'pari'
  etape: 1 | 2
  auChoix: boolean
  question: { texte: string; reponses: string[]; categorie: string | null }
  /** Les réponses effacées de la question en jeu. */
  effacees: number[]
  /** Au choix, sa réponse juste — le serveur vient de la dire juste. */
  choix?: number
}

export interface PariRevele {
  jeu: 'pari'
  /** « Étoiles gardées », « Pari gagné ! », « Pari perdu », « Raté », « Pas de réponse ». */
  titre: string
  /** Les questions de la manche — la seconde, s'il a parié —, chacune ses réponses, la bonne et la sienne. */
  questions: { texte: string; reponses: string[]; bonne: number; choix: number | null }[]
  /** « Le savais-tu ? » de la question qui a tranché. */
  savais: string | null
}

type PieceJugee = VerdictDUneManche['pieces'][number]

const GARDER = naturelDe(ETOILES_DU_PARI.garder)
const PARIER = naturelDe(ETOILES_DU_PARI.parier)
/** Ce qu'il garde se dit au nombre du barème : « Étoile gardée » sous deux étoiles en promettait une de moins. */
const PLUSIEURS_GARDEES = ETOILES_DU_PARI.garder > 1
const GARDE_OU_PARIE = PLUSIEURS_GARDEES ? 'Garde tes étoiles, ou parie-les' : 'Garde ton étoile, ou parie-la'
const GARDEES = PLUSIEURS_GARDEES ? 'Étoiles gardées' : 'Étoile gardée'

const enJeu = (t: PariTire, e: EtatDuPari) => (e.etape === 2 ? t.q2 : t.q1)
const pieceJugee = (q: QuestionTiree, choix: number | null, etape: 1 | 2): PieceJugee => ({ juste: choix === q.bonne, choix, composee: null, etape })
/** La pièce d'une étape dans le verdict ; chacune dit la sienne. */
const pieceDeLEtape = (v: VerdictDUneManche, etape: 1 | 2) => v.pieces.find(p => (p.etape ?? 1) === etape)

const tranche = (t: PariTire, e: EtatDuPari, g: GesteDuPari): boolean => {
  switch (g.quoi) {
    // Au choix, une réponse n'a plus de question ; à la première, seule la juste attend son choix.
    case 'repondre':
      return !e.auChoix && (e.etape === 2 || g.choix !== t.q1.bonne)
    // Garder, c'est quitter au choix : l'étoile gagnée.
    case 'garder':
      return e.auChoix
    case 'parier':
      return false
  }
}

const AVANT_LE_CHOIX = 'Réponds d’abord à la question'
const APRES_LE_PARI = 'Le pari est fait : réponds à la question'

export const REGLE_DU_PARI: RegleDuJeu<PariTire, EtatDuPari, GesteDuPari, PariMontre, PariRevele> = {
  cle: 'pari',
  etapes: 2,
  dureeMs: () => DUREES_DES_JEUX.pari * 1000,

  ouvrir: () => ({ etape: 1, auChoix: false, choix1: null, effacees: [[], []] }),

  lireLeGeste(brut, t) {
    const g = champsDuGeste(brut)
    if (!g) return null
    if (g.quoi === 'garder' || g.quoi === 'parier') return { quoi: g.quoi }
    if (g.quoi !== 'repondre') return null
    const r = reponseEnvoyee(g, 'pari')
    if (r === undefined) return { quoi: 'repondre', choix: null }
    // Un index valable aux deux questions : la page ne choisit pas laquelle elle croit voir.
    if (r === null || !estUnIndex(r.choix, Math.min(t.q1.reponses.length, t.q2.reponses.length))) return null
    return { quoi: 'repondre', choix: r.choix }
  },

  tranche,

  apresLeGeste(t, e, g) {
    if (tranche(t, e, g)) return GESTE_A_JUGER
    switch (g.quoi) {
      case 'repondre':
        return e.auChoix ? GARDE_OU_PARIE : { ...e, auChoix: true, choix1: g.choix }
      case 'garder':
        return e.etape === 2 ? APRES_LE_PARI : AVANT_LE_CHOIX
      case 'parier':
        if (!e.auChoix) return e.etape === 2 ? APRES_LE_PARI : AVANT_LE_CHOIX
        return { ...e, etape: 2, auChoix: false }
    }
  },

  juger(t, e, reponse) {
    // Garder, quitter, une partie close le lendemain : la manche s'arrête là où elle en est.
    const repondue = typeof reponse === 'object' && reponse.quoi === 'repondre' ? reponse.choix : null
    if (e.etape === 2) {
      const q2 = pieceJugee(t.q2, repondue, 2)
      return { naturel: q2.juste ? PARIER : 0, pieces: [pieceJugee(t.q1, e.choix1, 1), q2] }
    }
    // Juste au premier coup, laissée au choix : il les avait gagnées, les étoiles sont gardées.
    if (e.auChoix) return { naturel: GARDER, pieces: [pieceJugee(t.q1, e.choix1, 1)] }
    const q1 = pieceJugee(t.q1, repondue, 1)
    return { naturel: q1.juste ? GARDER : 0, pieces: [q1] }
  },

  eclairer(t, e, hasard) {
    if (e.auChoix) return rienAEclairer('pari')
    const q = enJeu(t, e)
    const deja = e.effacees[e.etape - 1]
    const mauvaises = q.reponses.map((_, k) => k).filter(k => k !== q.bonne && !deja.includes(k))
    if (deja.length >= effacablesAuPlus(q.reponses.length) || mauvaises.length === 0) return rienAEclairer('pari')
    const effacees = [...deja, auHasard(mauvaises, hasard)]
    return { ...e, effacees: e.etape === 2 ? [e.effacees[0], effacees] : [effacees, e.effacees[1]] }
  },

  montrer(t, e) {
    const q = enJeu(t, e)
    return {
      jeu: 'pari',
      etape: e.etape,
      auChoix: e.auChoix,
      question: { texte: q.texte, reponses: [...q.reponses], categorie: q.categorie },
      effacees: [...e.effacees[e.etape - 1]],
      ...(e.auChoix && e.choix1 !== null && { choix: e.choix1 }),
    }
  },

  reveler(t, _e, v) {
    const p1 = pieceDeLEtape(v, 1)
    const p2 = pieceDeLEtape(v, 2)
    const vue = (q: QuestionTiree, p: PieceJugee | undefined) => ({ texte: q.texte, reponses: [...q.reponses], bonne: q.bonne, choix: p?.choix ?? null })
    const titre = p2 ? (p2.juste ? 'Pari gagné !' : 'Pari perdu') : p1?.juste ? GARDEES : p1?.choix == null ? 'Pas de réponse' : 'Raté'
    return {
      jeu: 'pari',
      titre,
      questions: p2 ? [vue(t.q1, p1), vue(t.q2, p2)] : [vue(t.q1, p1)],
      savais: (p2 ? t.q2 : t.q1).anecdote,
    }
  },

  piece(t, e, v, i) {
    const etape = i.etape ?? 1
    const cabinet = { jeu: 'pari' as const, manche: i.manche, tirage: i.tirage, etape }
    if (etape === 2) return pieceDeLaQuestion(t.q2, cabinet, 'pari')
    // Nue : répondue — expirée ou quittée, elle n'a pas de choix —, rien d'effacé, et dans la durée
    // normale : le pli marque `aidee` une réponse venue dans le temps en plus, ou éclairée.
    const nue = !i.aidee && pieceDeLEtape(v, 1)?.choix != null && e.effacees[0].length === 0
    return pieceDeLaQuestion(t.q1, cabinet, nue ? undefined : 'pari')
  },

  cartel(t, v) {
    // Ce qu'il a le mieux appris : la difficile, s'il l'a jouée.
    const q = pieceDeLEtape(v, 2) ? t.q2 : t.q1
    return { sujet: q.texte, reponse: q.reponses[q.bonne], anecdote: q.anecdote }
  },
}
