// Le Mot mystère : la réponse d'une question de la base, un seul mot de cinq à
// sept lettres, à trouver en cinq essais avec l'intitulé pour indice. Chaque
// essai rend ses couleurs — bien placée, ailleurs, absente, les lettres doubles
// comptées comme au Wordle —, calculées ici et rendues par le serveur : la page
// ne connaît jamais le mot (invariant 1). Sans dictionnaire en V1 : un essai
// qui n'est pas un mot se dépense.
//
// L'essai qui trouve, ou le cinquième, tranche la manche (`tranche`). À
// l'échéance, ce qu'il avait essayé dans les temps compte, rien d'autre.

import { DUREES_DES_JEUX, ESSAIS_DES_ETOILES, ESSAIS_DU_MOT, LETTRES_DU_MOT_MAX, LETTRES_DU_MOT_MIN } from '../bareme'
import { gabaritDe, seCompose, sonArticle } from '../../lettres'
import { GESTE_A_JUGER, auHasard, champsDuGeste, naturelDe, pieceDeLaQuestion, rienAEclairer, type QuestionTiree } from './deLaBase'
import { justeDeLaPiece, type RegleDuJeu, type VerdictDUneManche } from './regle'

/** La question de la base et son mot : `VILNIUS`, en capitales sans accents, et la réponse telle qu'elle s'écrit (« Vilnius »). */
export interface MotTire {
  jeu: 'mot'
  question: QuestionTiree
  lettres: string
  affiche: string
}

/** Ce que le serveur sait d'une manche : ses essais, dans l'ordre, et les positions qu'Éclairer a soufflées. */
export interface EtatDuMot {
  essais: readonly string[]
  soufflees: readonly number[]
}

/** Un essai, ou l'envoi de l'échéance, qui ne porte rien : ce qui compte, le serveur l'a déjà. */
export type GesteDuMot = { quoi: 'essai'; lettres: string } | { quoi: 'repondre' }

export type CouleurDUneLettre = 'bien' | 'ailleurs' | 'absente'

export interface EssaiColore {
  lettres: string
  couleurs: CouleurDUneLettre[]
}

export interface MotMontre {
  jeu: 'mot'
  categorie: string | null
  /** L'intitulé, sans ses réponses : l'une d'elles est le mot. */
  texte: string
  longueur: number
  essaisMax: number
  essais: EssaiColore[]
  /** Les lettres qu'Éclairer a soufflées, à leur place. */
  soufflees: { position: number; lettre: string }[]
}

export interface MotRevele {
  jeu: 'mot'
  /** « Trouvé en 3 essais », « C’était « Vilnius » ». */
  titre: string
  trouve: boolean
  /** La réponse telle qu'elle s'écrit, et ses lettres. */
  reponse: string
  lettres: string
  essais: EssaiColore[]
  texte: string
  savais: string | null
}

/**
 * Les couleurs d'un essai : bien placée d'abord ; puis, de gauche à droite,
 * ailleurs tant que le mot garde de cette lettre une place qu'aucune bien
 * placée n'a prise ; absente sinon. Deux E dans l'essai pour un seul dans le
 * mot : un seul se colore.
 */
export function couleursDuMot(essai: string, mot: string): CouleurDUneLettre[] {
  const couleurs: CouleurDUneLettre[] = Array.from(essai, (l, i) => (l === mot[i] ? 'bien' : 'absente'))
  const restantes = new Map<string, number>()
  for (let i = 0; i < mot.length; i++) if (couleurs[i] !== 'bien') restantes.set(mot[i], (restantes.get(mot[i]) ?? 0) + 1)
  for (let i = 0; i < essai.length; i++) {
    const reste = restantes.get(essai[i]) ?? 0
    if (couleurs[i] === 'bien' || reste === 0) continue
    couleurs[i] = 'ailleurs'
    restantes.set(essai[i], reste - 1)
  }
  return couleurs
}

const RANG_DE_LA_COULEUR: Readonly<Record<CouleurDUneLettre, number>> = { absente: 0, ailleurs: 1, bien: 2 }

/** Ce que le clavier montre de chaque touche : ce que les essais en ont appris de mieux. La page le lit des couleurs reçues, jamais du mot. */
export function etatDesTouches(essais: readonly EssaiColore[]): Record<string, CouleurDUneLettre> {
  const touches: Record<string, CouleurDUneLettre> = {}
  for (const { lettres, couleurs } of essais)
    for (let i = 0; i < lettres.length; i++) {
      const avant = touches[lettres[i]]
      if (avant === undefined || RANG_DE_LA_COULEUR[couleurs[i]] > RANG_DE_LA_COULEUR[avant]) touches[lettres[i]] = couleurs[i]
    }
  return touches
}

/** Les mots d'un texte, en capitales sans accents : de quoi voir si l'intitulé dit déjà la réponse. */
const motsEnCapitales = (texte: string) =>
  texte.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/Œ/g, 'OE').replace(/Æ/g, 'AE').split(/[^A-Z]+/)

/**
 * Le mot d'une question de la base, ou null si elle ne se pose pas au Mot
 * mystère : une bonne réponse d'un seul mot de `LETTRES_DU_MOT_MIN` à
 * `LETTRES_DU_MOT_MAX` lettres après son article, ni trait d'union ni
 * apostrophe ; un intitulé sans chiffre — « 600 000 habitants » ne se tape
 * pas —, qui ne parle pas de ses choix et ne dit pas le mot. Le tirage du
 * serveur y passe chaque question de son tas.
 */
export function motDeLaQuestion(q: { texte: string; reponses: readonly string[]; bonne: number }): { lettres: string; affiche: string } | null {
  const affiche = q.reponses[q.bonne]
  if (affiche === undefined || !seCompose(q) || /\d/.test(q.texte)) return null
  const gabarit = gabaritDe(affiche)
  if (!gabarit || gabarit.mots.length !== 1 || gabarit.mots[0].some(c => c !== null)) return null
  const { lettres } = gabarit
  if (lettres.length < LETTRES_DU_MOT_MIN || lettres.length > LETTRES_DU_MOT_MAX) return null
  if (motsEnCapitales(q.texte).includes(lettres)) return null
  return { lettres, affiche: affiche.trim() }
}

/** La réponse dite dans une phrase : « C’était « la Joconde » » — l'article en minuscule, comme on le dit. */
function reponseDite(affiche: string): string {
  const { article, reste } = sonArticle(affiche)
  if (!article) return reste
  return `${article.toLowerCase()}${article.endsWith('’') ? '' : ' '}${reste}`
}

/** Le barème : trouvé en tant d'essais au plus pour ★★★, ★★, ★ (`ESSAIS_DES_ETOILES`) ; pas trouvé, rien. */
function etoilesDesEssais(essais: readonly string[], mot: string): VerdictDUneManche['naturel'] {
  const n = essais.indexOf(mot) + 1
  if (n === 0) return 0
  const palier = ESSAIS_DES_ETOILES.findIndex(max => n <= max)
  return palier < 0 ? 0 : naturelDe(3 - palier)
}

const finie = (t: MotTire, e: EtatDuMot) => e.essais.length >= ESSAIS_DU_MOT || e.essais.includes(t.lettres)
const aLaLongueur = (t: MotTire, lettres: string) => lettres.length === t.lettres.length
const colores = (t: MotTire, essais: readonly string[]): EssaiColore[] => essais.map(lettres => ({ lettres, couleurs: couleursDuMot(lettres, t.lettres) }))

const tranche = (t: MotTire, e: EtatDuMot, g: GesteDuMot): boolean => {
  if (finie(t, e) || g.quoi === 'repondre') return true
  return aLaLongueur(t, g.lettres) && (g.lettres === t.lettres || e.essais.length + 1 >= ESSAIS_DU_MOT)
}

export const REGLE_DU_MOT: RegleDuJeu<MotTire, EtatDuMot, GesteDuMot, MotMontre, MotRevele> = {
  cle: 'mot',
  etapes: 1,
  dureeMs: () => DUREES_DES_JEUX.mot * 1000,

  ouvrir: () => ({ essais: [], soufflees: [] }),

  lireLeGeste(brut) {
    const g = champsDuGeste(brut)
    if (!g) return null
    if (g.quoi === 'repondre') return { quoi: 'repondre' }
    // Des capitales sans accents, comme le clavier de la page les tape ; la longueur se refuse en mots.
    if (g.quoi !== 'essai' || typeof g.lettres !== 'string' || !/^[A-Z]+$/.test(g.lettres)) return null
    return { quoi: 'essai', lettres: g.lettres }
  },

  tranche,

  apresLeGeste(t, e, g) {
    if (tranche(t, e, g)) return GESTE_A_JUGER
    if (g.quoi !== 'essai') return GESTE_A_JUGER
    if (!aLaLongueur(t, g.lettres)) return `Il faut ${t.lettres.length} lettres`
    return { ...e, essais: [...e.essais, g.lettres] }
  },

  juger(t, e, reponse) {
    // L'essai qui tranche compte ; à l'échéance, ce qu'il avait essayé dans les temps — le serveur l'a.
    const dernier = typeof reponse === 'object' && reponse.quoi === 'essai' && aLaLongueur(t, reponse.lettres) && !finie(t, e) ? [reponse.lettres] : []
    const essais = [...e.essais, ...dernier]
    if (essais.length === 0) return { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] }
    const naturel = etoilesDesEssais(essais, t.lettres)
    const juste = justeDeLaPiece(naturel, 'mot') === true
    return { naturel, pieces: [{ juste, choix: juste ? 0 : -1, composee: essais.join(',') }] }
  },

  eclairer(t, e, hasard) {
    // Ce qu'il sait déjà — soufflé, ou bien placé dans un essai — ne se souffle pas ; et jamais le mot entier.
    const connues = new Set(e.soufflees)
    for (const essai of e.essais) for (let i = 0; i < essai.length; i++) if (essai[i] === t.lettres[i]) connues.add(i)
    const libres = Array.from(t.lettres, (_, i) => i).filter(i => !connues.has(i))
    if (connues.size >= t.lettres.length - 1 || libres.length === 0) return rienAEclairer('mot')
    return { ...e, soufflees: [...e.soufflees, auHasard(libres, hasard)] }
  },

  montrer(t, e) {
    return {
      jeu: 'mot',
      categorie: t.question.categorie,
      texte: t.question.texte,
      longueur: t.lettres.length,
      essaisMax: ESSAIS_DU_MOT,
      essais: colores(t, e.essais),
      soufflees: e.soufflees.map(position => ({ position, lettre: t.lettres[position] })),
    }
  },

  reveler(t, _e, v) {
    const essais = (v.pieces[0]?.composee ?? '').split(',').filter(Boolean)
    const n = essais.indexOf(t.lettres) + 1
    return {
      jeu: 'mot',
      titre: n > 0 ? `Trouvé en ${n} essai${n > 1 ? 's' : ''}` : `C’était « ${reponseDite(t.affiche)} »`,
      trouve: n > 0,
      reponse: t.affiche,
      lettres: t.lettres,
      essais: colores(t, essais),
      texte: t.question.texte,
      savais: t.question.anecdote,
    }
  },

  piece: (t, _e, _v, i) => pieceDeLaQuestion(t.question, { jeu: 'mot', manche: i.manche, tirage: i.tirage }, 'mot'),

  cartel: t => ({ sujet: t.question.texte, reponse: t.affiche, anecdote: t.question.anecdote }),
}
