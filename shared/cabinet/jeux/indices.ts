// Les Indices : « Qui suis-je ? ». Cinq indices sur une personne, du plus
// obscur au plus évident ; le premier d'office, puis un de plus à la demande.
// Chaque indice vu coûte, chaque erreur aussi — elle en montre un de plus —,
// et la réponse se tape : un nom, jugé au serveur, qui seul connaît la fiche
// (invariant 1).
//
// Ici, la règle pure (le moule : `regle.ts`) : ce qu'une saisie doit être pour
// désigner la personne (`bonneIdentite`), le compte et ses étoiles, l'indice
// qu'Éclairer offre, ce que la manche montre et ce que la révélation dit, la
// pièce que le journal garde — `cab:qui:<id>`, hors de la base. Le choix de la
// fiche reste au serveur, qui lit le contenu et ce que le joueur a déjà vu.

import { DUREES_DES_JEUX, INDICES_DES_ETOILES, LETTRES_POUR_UNE_FAUTE, MOTS_D_UNE_IDENTITE_MAX } from '../bareme'
import type { Fiche } from '../contenu'
import { idDeLaFiche } from '../pieces'
import { sansAccent } from '../../homonymes'
import { GESTE_A_JUGER, champsDuGeste, choixDe, naturelDe, pieceDuContenu, rienAEclairer, type RegleQuiTranche } from './outils'
import { justeDeLaPiece, type VerdictDUneManche } from './regle'

/** Ce que le départ fige d'une manche des Indices : la fiche entière, sa réponse et ses clés comprises. */
export interface IndicesTires {
  jeu: 'indices'
  fiche: Fiche
}

/** Ce que le serveur sait d'une manche : les indices montrés, ceux qu'Éclairer a offerts parmi eux, les noms faux, tels que tapés. */
export interface EtatDesIndices {
  vus: number
  offerts: number
  essais: readonly string[]
}

/** Un indice de plus, un nom proposé, ou l'envoi de l'échéance — qui ne porte rien : un nom tapé et pas envoyé ne compte pas. */
export type GesteDesIndices = { quoi: 'indice' } | { quoi: 'nom'; texte: string } | { quoi: 'repondre' }

/** Ce que la page reçoit : les indices vus, rien de ceux qui restent cachés, ni la réponse, ni ses clés. */
export interface IndicesMontres {
  jeu: 'indices'
  indices: string[]
  /** Les indices encore cachés : « Encore 2 indices cachés ». */
  caches: number
  /** « Ta réponse vaut ★★★ » : ce que vaudrait une bonne réponse, maintenant. */
  vaut: VerdictDUneManche['naturel']
  /** « Déjà essayé : Hugo ». */
  essayes: string[]
  offerts: number
}

export interface IndicesReveles {
  jeu: 'indices'
  /** « Trouvé », « C’était Victor Hugo ». */
  titre: string
  trouve: boolean
  reponse: string
  /** « Victor Hugo, avec 3 indices sous les yeux (dont 1 offert) et 1 erreur. » — trouvé seulement. */
  detail: string | null
  /** Les cinq, à la révélation. */
  indices: string[]
  /** « Le savais-tu ? » */
  savais: string
}

/** Ce que demande une manche des Indices, au journal et au cartel. */
export const QUESTION_DES_INDICES = 'Qui suis-je ?'

/**
 * Les mots qui ne désignent personne : « Jeanne d’Arc », « de Gaulle »,
 * « La Fayette ». Écartés de la saisie, ils ne comptent pas parmi les quatre
 * mots, et ne la rendent ni juste ni fausse : seuls, ils ne nomment personne.
 */
const MOTS_VIDES: ReadonlySet<string> = new Set(['d', 'de', 'des', 'du', 'l', 'la', 'le', 'les'])

/**
 * Les lettres que l'effacement des accents n'ouvre pas : la décomposition
 * sépare « é » en « e » et son accent, mais « ø », « ł » ou « ß » sont des
 * lettres à part entière. Laissées telles, elles coupaient le mot (« Wałęsa »
 * en « wa » et « esa »), et une fiche refusait sa propre réponse.
 */
const LETTRES_A_OUVRIR: ReadonlyMap<string, string> = new Map([
  ['œ', 'oe'],
  ['æ', 'ae'],
  ['ø', 'o'],
  ['ł', 'l'],
  ['đ', 'd'],
  ['ð', 'd'],
  ['þ', 'th'],
  ['ß', 'ss'],
  ['ı', 'i'],
])
const A_OUVRIR = new RegExp(`[${[...LETTRES_A_OUVRIR.keys()].join('')}]`, 'g')

/**
 * Les mots d'un texte, comparables : sans casse ni accents (`sansAccent`, la
 * règle des homonymes), ses lettres à part ouvertes, coupés à tout ce qui
 * n'est ni lettre ni chiffre — l'apostrophe, le trait d'union, la virgule. La
 * saisie et la fiche passent par la même règle : ce qui s'écrit pareil se
 * compare pareil.
 */
function motsDe(texte: string): string[] {
  return sansAccent(texte)
    .replace(A_OUVRIR, lettre => LETTRES_A_OUVRIR.get(lettre) ?? lettre)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/**
 * Les mots d'une saisie qui nomment quelqu'un : les mots vides écartés. Le
 * jugement, le refus d'un nom vide et le « déjà essayé » lisent les mêmes —
 * et le juge des fiches (`server/src/core/cabinet/contenu.ts`), qui compte
 * ceux d'une réponse et lit ceux d'un indice comme une saisie les lirait.
 */
export const motsUtiles = (texte: string) => motsDe(texte).filter(m => !MOTS_VIDES.has(m))

/**
 * Une faute de frappe au plus entre deux mots : une lettre changée, oubliée,
 * ajoutée, ou deux voisines inversées (« Volatire »). Deux inversées sont un
 * seul geste du doigt : comptées pour deux fautes, elles refusaient la plus
 * commune des fautes au téléphone.
 */
function uneFauteAuPlus(a: string, b: string): boolean {
  if (a.length === b.length) {
    const ecarts: number[] = []
    for (let i = 0; i < a.length && ecarts.length <= 2; i++) if (a[i] !== b[i]) ecarts.push(i)
    if (ecarts.length <= 1) return true
    const [i, j] = ecarts
    return ecarts.length === 2 && j === i + 1 && a[i] === b[j] && a[j] === b[i]
  }
  if (Math.abs(a.length - b.length) !== 1) return false
  const [court, long] = a.length < b.length ? [a, b] : [b, a]
  // Le premier écart est la lettre en trop du plus long : le reste doit suivre, décalé d'une.
  let i = 0
  while (i < court.length && court[i] === long[i]) i++
  for (let k = i; k < court.length; k++) if (court[k] !== long[k + 1]) return false
  return true
}

/**
 * Un mot tapé désigne-t-il ce mot attendu ? Le même, ou une faute de frappe
 * près dès que l'attendu a `LETTRES_POUR_UNE_FAUTE` lettres. La faute se
 * compte au mot de la fiche : sous cinq lettres, chaque lettre est le mot —
 * « Hugi » n'est pas Hugo —, mais « Csar », une lettre oubliée de « cesar »,
 * l'est. Le juge des fiches la lit aussi : un indice dont un mot est proche
 * d'une clé la soufflerait — tapé, ce mot trouverait la personne.
 */
export function proches(tape: string, attendu: string): boolean {
  if (tape === attendu) return true
  return attendu.length >= LETTRES_POUR_UNE_FAUTE && uneFauteAuPlus(tape, attendu)
}

/**
 * La saisie désigne-t-elle la personne de la fiche ? Un à quatre mots
 * (`MOTS_D_UNE_IDENTITE_MAX`), les mots vides écartés ; chacun proche d'un mot
 * du nom ou d'une clé, et l'un d'eux au moins proche d'une clé. La réponse
 * fourre-tout reste fermée : une liste de noms a un mot qui n'est pas du sien,
 * et « Victor » seul, sans la clé `hugo`, trouverait tous les Victor.
 */
export function bonneIdentite(saisie: string, fiche: Pick<Fiche, 'reponse' | 'cles'>): boolean {
  const mots = motsUtiles(saisie)
  if (mots.length === 0 || mots.length > MOTS_D_UNE_IDENTITE_MAX) return false
  const cles = fiche.cles.flatMap(motsDe)
  const permis = [...motsDe(fiche.reponse), ...cles]
  return mots.every(m => permis.some(p => proches(m, p))) && mots.some(m => cles.some(c => proches(m, c)))
}

/** Le compte d'une manche : les indices vus, moins ceux qu'Éclairer a offerts, plus les erreurs — chacune a aussi montré un indice. */
export const comptesDesIndices = (e: EtatDesIndices) => e.vus - e.offerts + e.essais.length

/**
 * Les étoiles d'une bonne réponse à ce compte : au plus deux ★★★, trois ★★,
 * au-delà ★ (`INDICES_DES_ETOILES`). Trouvé, il gagne toujours une étoile au
 * moins — la révélation le relit ainsi, et seul un nom faux tranche à zéro.
 */
export function etoilesDesIndices(compte: number): VerdictDUneManche['naturel'] {
  const palier = INDICES_DES_ETOILES.findIndex(max => compte <= max)
  return palier < 0 ? 1 : naturelDe(3 - palier)
}

const lesIndices = (t: IndicesTires) => t.fiche.indices.length
// Vide et « déjà essayé » se lisent comme le jugement : « De », envoyé en commençant « De Gaulle », ne coûtait
// une erreur que parce qu'il ne les lisait pas pareil — et au cinquième indice, il tranchait la manche à zéro.
const vide = (texte: string) => motsUtiles(texte).length === 0
const memeNom = (a: string, b: string) => motsUtiles(a).join(' ') === motsUtiles(b).join(' ')
const dejaEssaye = (e: EtatDesIndices, texte: string) => e.essais.some(x => memeNom(x, texte))

/**
 * Le geste tranche-t-il ? L'échéance, toujours ; un nom, s'il est juste, ou
 * faux quand plus aucun indice ne reste à montrer — au cinquième, une erreur
 * tranche à zéro. Un nom vide — des mots vides seuls compris — ou déjà essayé
 * ne coûte rien : il se refuse en mots (un double toucher, un oubli).
 */
function tranche(t: IndicesTires, e: EtatDesIndices, g: GesteDesIndices): boolean {
  switch (g.quoi) {
    case 'repondre':
      return true
    case 'indice':
      return false
    case 'nom':
      return !vide(g.texte) && !dejaEssaye(e, g.texte) && (bonneIdentite(g.texte, t.fiche) || e.vus >= lesIndices(t))
  }
}

/** « 2|1 » : les indices vus, puis les erreurs. */
const composee = (vus: number, erreurs: number) => `${vus}|${erreurs}`

function relue(c: string | null | undefined): { vus: number; erreurs: number } | null {
  const m = typeof c === 'string' ? /^(\d+)\|(\d+)$/.exec(c) : null
  return m ? { vus: Number(m[1]), erreurs: Number(m[2]) } : null
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

export const REGLE_DES_INDICES: RegleQuiTranche<IndicesTires, EtatDesIndices, GesteDesIndices, IndicesMontres, IndicesReveles> = {
  cle: 'indices',
  etapes: 1,
  dureeMs: () => DUREES_DES_JEUX.indices * 1000,

  // Le premier indice d'office.
  ouvrir: () => ({ vus: 1, offerts: 0, essais: [] }),

  lireLeGeste(brut) {
    const g = champsDuGeste(brut)
    switch (g?.quoi) {
      case 'indice':
        return { quoi: 'indice' }
      // Pas recoupé ici : la lecture du geste de la partie (`lireUnGeste`, `shared/cabinet/partie.ts`) coupe le
      // texte par `tronquer`, avant la règle du jeu et avant de l'écrire : tous les textes d'un geste, d'un seul endroit.
      case 'nom':
        return typeof g.texte === 'string' ? { quoi: 'nom', texte: g.texte } : null
      case 'repondre':
        return { quoi: 'repondre' }
      default:
        return null
    }
  },

  tranche,

  apresLeGeste(t, e, g) {
    if (tranche(t, e, g)) return GESTE_A_JUGER
    switch (g.quoi) {
      case 'repondre':
        return GESTE_A_JUGER
      case 'indice':
        return e.vus >= lesIndices(t) ? 'Tu as vu tous les indices : réponds' : { ...e, vus: e.vus + 1 }
      case 'nom':
        if (vide(g.texte)) return 'Écris un nom'
        if (dejaEssaye(e, g.texte)) return 'Tu as déjà essayé ce nom'
        // « Non : une étoile de moins, et un indice de plus. »
        return { ...e, vus: e.vus + 1, essais: [...e.essais, g.texte.trim()] }
    }
  },

  juger(t, e, reponse) {
    if (typeof reponse === 'object' && reponse.quoi === 'nom' && !vide(reponse.texte)) {
      if (bonneIdentite(reponse.texte, t.fiche)) {
        const naturel = etoilesDesIndices(comptesDesIndices(e))
        const juste = justeDeLaPiece(naturel, 'indices') === true
        return { naturel, pieces: [{ juste, choix: choixDe(true, juste), composee: composee(e.vus, e.essais.length) }] }
      }
      // Faux au dernier indice : l'erreur tranche à zéro, et compte avec les autres.
      return { naturel: 0, pieces: [{ juste: false, choix: -1, composee: composee(e.vus, e.essais.length + 1) }] }
    }
    // L'échéance, une partie close le lendemain : rien de trouvé — ses erreurs disent s'il avait répondu. Quitter
    // laisse la manche ouverte : zéro, `choix` nul, comme toute manche quittée. Ce qu'il a vu reste écrit.
    const repondue = reponse !== 'quittee' && e.essais.length > 0
    return { naturel: 0, pieces: [{ juste: false, choix: choixDe(repondue, false), composee: composee(e.vus, e.essais.length) }] }
  },

  // Un indice gratuit : il se montre comme les autres, et ne compte pas.
  eclairer: (t, e) => (e.vus >= lesIndices(t) ? rienAEclairer('indices') : { ...e, vus: e.vus + 1, offerts: e.offerts + 1 }),

  montrer: (t, e) => ({
    jeu: 'indices',
    indices: t.fiche.indices.slice(0, e.vus),
    caches: lesIndices(t) - e.vus,
    vaut: etoilesDesIndices(comptesDesIndices(e)),
    essayes: [...e.essais],
    offerts: e.offerts,
  }),

  reveler(t, e, v) {
    const lu = relue(v.pieces[0]?.composee) ?? { vus: e.vus, erreurs: e.essais.length }
    // Trouvé, il a au moins une étoile (`etoilesDesIndices`) ; seul un nom faux, ou rien, laisse la manche à zéro.
    const trouve = v.naturel > 0
    const { reponse } = t.fiche
    const offerts = e.offerts ? ` (dont ${e.offerts} offert${e.offerts > 1 ? 's' : ''})` : ''
    const erreurs = lu.erreurs ? ` et ${pluriel(lu.erreurs, 'erreur')}` : ''
    return {
      jeu: 'indices',
      titre: trouve ? 'Trouvé' : `C’était ${reponse}`,
      trouve,
      reponse,
      detail: trouve ? `${reponse}, avec ${pluriel(lu.vus, 'indice')} sous les yeux${offerts}${erreurs}.` : null,
      indices: [...t.fiche.indices],
      savais: t.fiche.savais,
    }
  },

  piece: (t, _e, _v, i) =>
    pieceDuContenu({ id: idDeLaFiche(t.fiche.id), texte: QUESTION_DES_INDICES, reponse: t.fiche.reponse, categorie: t.fiche.categorie, anecdote: t.fiche.savais }, 'indices', i),

  cartel: t => ({ sujet: QUESTION_DES_INDICES, reponse: t.fiche.reponse, anecdote: t.fiche.savais }),
}
