// L'Éclair : cinq affirmations d'une même catégorie, vraies ou fausses, en
// quarante-cinq secondes. Chacune est une question de la base récrite : son
// intitulé et une réponse proposée — la bonne une fois sur deux, sinon une des
// mauvaises —, tirée au départ avec les quatre autres (`affirmationDe`).
//
// Les cinq arrivent ensemble et la page tient les réponses : elles partent
// ensemble, à la cinquième ou à l'échéance, et se jugent d'un coup. La page ne
// compte pas les justes en route — le compte trahissait chaque vérité
// (invariant 1) —, et le serveur ne sait rien de la manche avant l'envoi :
// Changer, jusque-là, ne perd rien.
//
// Une pièce pour les cinq, hors de la base (`cab:eclair:…`) : récrites, aucune
// n'est plus la question de la base. Elle n'entre ni au carnet ni au
// signalement, et le Cabinet la déplie pour ne pas reposer ses questions
// avant sept jours (`deplier`).

import { DUREES_DES_JEUX, JUSTES_DE_L_ECLAIR, PART_DES_VRAIES } from '../bareme'
import type { Niveau } from '../../campagne'
import { idDeLEclair } from '../pieces'
import { GESTE_A_JUGER, auHasard, champsDuGeste, naturelDe, reponseEnvoyee, rienAEclairer, type QuestionTiree } from './deLaBase'
import { justeDeLaPiece, type RegleDuJeu, type VerdictDUneManche } from './regle'

/** Une affirmation : une question de la base et la réponse qu'elle propose, un index de ses réponses. */
export interface AffirmationTiree {
  question: QuestionTiree
  proposee: number
}

export interface EclairTire {
  jeu: 'eclair'
  affirmations: readonly AffirmationTiree[]
}

/** Ce que le serveur sait d'une manche de l'Éclair avant l'envoi : ce qu'Éclairer a soufflé, rien d'autre. */
export interface EtatDeLEclair {
  soufflees: readonly number[]
}

/** Les réponses, dans l'ordre des affirmations : vraie, fausse, ou `null`, pas répondue. */
export type GesteDeLEclair = { quoi: 'repondre'; reponses: readonly (boolean | null)[] }

export interface EclairMontre {
  jeu: 'eclair'
  categorie: string | null
  /** L'intitulé et la réponse proposée de chacune, jamais si elle est vraie. */
  affirmations: { texte: string; proposee: string }[]
  /** Ce qu'Éclairer a soufflé : l'affirmation, et si elle est vraie. */
  soufflees: { affirmation: number; vraie: boolean }[]
}

export interface EclairRevele {
  jeu: 'eclair'
  /** « 4 sur 5 ». */
  titre: string
  justes: number
  /** Chacune vraie, ou fausse et la bonne réponse qu'elle cachait ; sa réponse à lui, `null` s'il n'a pas répondu. */
  affirmations: { texte: string; proposee: string; vraie: boolean; bonne: string; reponse: boolean | null; juste: boolean }[]
  /** « Le savais-tu ? » de la première ratée, sinon de la première qui en a un. */
  savais: string | null
}

/**
 * Une question de la base récrite en affirmation, du hasard du tirage : elle
 * propose sa bonne réponse une fois sur deux (`PART_DES_VRAIES`), sinon une des
 * mauvaises. Tirée au départ : la reprise redonne la même.
 */
export function affirmationDe(question: QuestionTiree, hasard: () => number): AffirmationTiree {
  const vraie = hasard() < PART_DES_VRAIES
  const mauvaises = question.reponses.map((_, k) => k).filter(k => k !== question.bonne)
  return { question, proposee: vraie || mauvaises.length === 0 ? question.bonne : auHasard(mauvaises, hasard) }
}

const estVraie = (a: AffirmationTiree) => a.proposee === a.question.bonne
const proposee = (a: AffirmationTiree) => a.question.reponses[a.proposee]

/** Le barème : au moins tant de justes pour ★★★, ★★, ★ (`JUSTES_DE_L_ECLAIR`). */
function etoilesDesJustes(justes: number): VerdictDUneManche['naturel'] {
  const palier = JUSTES_DE_L_ECLAIR.findIndex(n => justes >= n)
  return palier < 0 ? 0 : naturelDe(3 - palier)
}

/** « VFV.F » : ce qu'il a répondu à chacune — vraie, fausse, `.` pas répondue. Le journal le garde, la révélation le relit. */
const composeeDe = (reponses: readonly (boolean | null)[]) => reponses.map(r => (r === null ? '.' : r ? 'V' : 'F')).join('')
const lireLaComposee = (composee: string | null | undefined, n: number): (boolean | null)[] =>
  Array.from({ length: n }, (_, i) => (composee?.[i] === 'V' ? true : composee?.[i] === 'F' ? false : null))

/**
 * L'affirmation dont la révélation et le cartel disent « Le savais-tu ? » :
 * ce qu'il a raté s'apprend d'abord — la première ratée qui en a un —, sinon
 * la première qui en a un.
 */
function affirmationAApprendre(t: EclairTire, reponses: readonly (boolean | null)[]): AffirmationTiree | undefined {
  const sue = (i: number) => (reponses[i] === estVraie(t.affirmations[i]) ? 1 : 0)
  return t.affirmations
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.question.anecdote)
    .sort((x, y) => sue(x.i) - sue(y.i) || x.i - y.i)[0]?.a
}

/** La marche la plus haute de ses affirmations : celle que sa pièce garde. */
const RANG_DE_LA_MARCHE: Readonly<Record<Niveau, number>> = { facile: 0, moyen: 1, difficile: 2, expert: 3 }
const plusHaute = (niveaux: readonly Niveau[]): Niveau => niveaux.reduce((a, b) => (RANG_DE_LA_MARCHE[b] > RANG_DE_LA_MARCHE[a] ? b : a), 'facile')

export const REGLE_DE_L_ECLAIR: RegleDuJeu<EclairTire, EtatDeLEclair, GesteDeLEclair, EclairMontre, EclairRevele> = {
  cle: 'eclair',
  etapes: 1,
  dureeMs: () => DUREES_DES_JEUX.eclair * 1000,

  ouvrir: () => ({ soufflees: [] }),

  lireLeGeste(brut, t) {
    const g = champsDuGeste(brut)
    if (!g || g.quoi !== 'repondre') return null
    const n = t.affirmations.length
    const r = reponseEnvoyee(g, 'eclair')
    if (r === undefined) return { quoi: 'repondre', reponses: Array(n).fill(null) }
    if (r === null) return null
    // À l'échéance, la page envoie celles qu'il a eu le temps de dire : les autres ne sont pas répondues.
    const brutes = r.reponses
    if (!Array.isArray(brutes) || brutes.length > n || !brutes.every(x => x === null || typeof x === 'boolean')) return null
    return { quoi: 'repondre', reponses: Array.from({ length: n }, (_, i) => (brutes[i] as boolean | null | undefined) ?? null) }
  },

  // Un seul geste à l'Éclair, l'envoi : il tranche toujours.
  tranche: () => true,
  apresLeGeste: () => GESTE_A_JUGER,

  juger(t, _e, reponse) {
    const reponses = typeof reponse === 'object' ? reponse.reponses : []
    const justes = t.affirmations.filter((a, i) => reponses[i] === estVraie(a)).length
    const naturel = etoilesDesJustes(justes)
    if (!reponses.some(r => r !== null)) return { naturel, pieces: [{ juste: false, choix: null, composee: null }] }
    const juste = justeDeLaPiece(naturel, 'eclair') === true
    return { naturel, pieces: [{ juste, choix: juste ? 0 : -1, composee: composeeDe(t.affirmations.map((_, i) => reponses[i] ?? null)) }] }
  },

  eclairer(t, e, _hasard, cible) {
    // D'abord ce qui reste à souffler dans la manche : c'est ce que le pli demande pour griser Éclairer.
    if (e.soufflees.length >= t.affirmations.length) return rienAEclairer('eclair')
    if (cible === undefined || !Number.isInteger(cible) || cible < 0 || cible >= t.affirmations.length) return 'Choisis l’affirmation à éclairer'
    if (e.soufflees.includes(cible)) return 'Cette affirmation est déjà éclairée'
    return { soufflees: [...e.soufflees, cible] }
  },

  montrer(t, e) {
    return {
      jeu: 'eclair',
      // Cinq d'une même catégorie : celle de la première les dit toutes.
      categorie: t.affirmations[0]?.question.categorie ?? null,
      affirmations: t.affirmations.map(a => ({ texte: a.question.texte, proposee: proposee(a) })),
      soufflees: e.soufflees.map(i => ({ affirmation: i, vraie: estVraie(t.affirmations[i]) })),
    }
  },

  reveler(t, _e, v) {
    const reponses = lireLaComposee(v.pieces[0]?.composee, t.affirmations.length)
    const affirmations = t.affirmations.map((a, i) => ({
      texte: a.question.texte,
      proposee: proposee(a),
      vraie: estVraie(a),
      bonne: a.question.reponses[a.question.bonne],
      reponse: reponses[i],
      juste: reponses[i] === estVraie(a),
    }))
    const justes = affirmations.filter(a => a.juste).length
    return {
      jeu: 'eclair',
      titre: `${justes} sur ${t.affirmations.length}`,
      justes,
      affirmations,
      savais: affirmationAApprendre(t, reponses)?.question.anecdote ?? null,
    }
  },

  piece(t, _e, v, i) {
    const qs = t.affirmations.map(a => a.question)
    const dite = (a: AffirmationTiree) => (estVraie(a) ? 'vrai' : `faux : ${a.question.reponses[a.question.bonne]}`)
    return {
      id: idDeLEclair(qs.map(q => q.id)),
      // Ce qu'il demandait, et la réponse dite de chacune : la version jouée, même quand la base aura changé.
      texte: t.affirmations.map(a => `${a.question.texte} ${proposee(a)}`).join(' · '),
      reponses: [t.affirmations.map(dite).join(' · ')],
      bonne: 0,
      categorie: qs[0]?.categorie ?? null,
      anecdote: affirmationAApprendre(t, lireLaComposee(v.pieces[0]?.composee, qs.length))?.question.anecdote ?? null,
      niveau: plusHaute(qs.map(q => q.niveau)),
      forme: 'eclair',
      cabinet: { jeu: 'eclair', manche: i.manche, tirage: i.tirage },
    }
  },

  cartel(t, v) {
    const a = affirmationAApprendre(t, lireLaComposee(v.pieces[0]?.composee, t.affirmations.length)) ?? t.affirmations[0]
    return {
      sujet: `${a.question.texte} ${proposee(a)}`,
      reponse: estVraie(a) ? 'Vrai' : `Faux : c’était ${a.question.reponses[a.question.bonne]}`,
      anecdote: a.question.anecdote,
    }
  },
}
