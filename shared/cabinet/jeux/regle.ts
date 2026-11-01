// Le moule des dix jeux du Cabinet : ce que chacun dit de lui à l'annonce
// (`JEUX`), et la forme que prend sa règle (`RegleDuJeu`). Chaque jeu vit dans
// son module pur, à côté de celui-ci ; un registre les rassemble, typé par
// `CleDeJeu` : un jeu de plus qui oublie une pièce ne compile pas. Le dixième,
// le Quiz, est venu le 1er novembre 2026 : des questions classiques, sur tous
// les thèmes de la base — le musée qui dort n'a aucune œuvre à lui.
//
// Ici, pas une règle de jugement : les noms, les gestes, les barèmes dits, ce
// qu'Éclairer fait à chaque jeu. La page les lit pour l'annonce sans tirer les
// jeux eux-mêmes — elle n'en importe que ce qui ne juge pas (invariant 1). Les
// barèmes dits se composent des chiffres de `bareme.ts`, aucun n'est écrit en
// dur : un barème changé change aussi ce que l'annonce promet.

import type { PieceDuCabinet } from '../pieces'
import {
  AFFIRMATIONS_DE_L_ECLAIR,
  DUREES_DES_JEUX,
  ERREURS_DE_LA_FRISE,
  ESSAIS_DES_ETOILES,
  ESSAIS_DU_MOT,
  ETOILES_AU_CADRAGE,
  ETOILES_D_UNE_JUSTE,
  ETOILES_DE_LA_REPLIQUE,
  ETOILES_DU_FILET,
  ETOILES_DU_PARI,
  INDICES_DES_ETOILES,
  JUSTES_DE_L_ECLAIR,
  JUSTES_DU_QUIZ,
  KM_DE_L_EPINGLE,
  QUESTIONS_DU_QUIZ,
  RAYON_D_ECLAIRER_KM,
} from '../bareme'

/** Les dix jeux. Une clé ne change jamais : elle est la forme des réponses au journal, et le jeu de chaque œuvre. */
export type CleDeJeu = 'epingle' | 'frise' | 'mot' | 'detail' | 'filet' | 'pari' | 'eclair' | 'indices' | 'replique' | 'quiz'

/** Leur ordre, partout où la page les range. */
export const CLES_DES_JEUX: readonly CleDeJeu[] = ['epingle', 'frise', 'mot', 'detail', 'filet', 'pari', 'eclair', 'indices', 'replique', 'quiz']

/** Ce qu'un jeu dit de lui, sans rien juger. */
export interface DescriptionDUnJeu {
  cle: CleDeJeu
  /** « L’Épingle ». */
  nom: string
  /** « à l’Épingle » : « Cette œuvre se trouve à l’Épingle ». */
  a: string
  /** Le geste, en une phrase. */
  geste: string
  /** Le barème d'une manche, dit en étoiles. */
  bareme: string
  /** Ce qu'Éclairer y fait. */
  eclairer: string
  /**
   * Changer y sert-il ? La Frise se construit d'un bout à l'autre : remplacer
   * une manche défairait les deux autres. Une seule source — l'annonce, le
   * refus du pouvoir et le pli la lisent.
   */
  changeable: boolean
  /**
   * Les étapes d'une manche, chacune son chrono : deux au Pari et à la
   * Réplique, une ailleurs — l'Éclair n'en a qu'une pour ses cinq
   * affirmations. Prendre son temps en allonge chacune : la carte dit « par
   * manche » ou « à chacune de ses deux questions » (`forceDite`), et « à
   * chaque question » promettait à l'Éclair dix secondes par affirmation (la
   * tablée du 26 octobre 2026). Écrites ici pour que la page ne tire pas les
   * règles ; `cabinet-regles.test.ts` les relit contre `RegleDuJeu.etapes`.
   */
  etapes: 1 | 2
  /**
   * Ce qu'il faut savoir avant de commencer, quand le jeu ne se joue pas
   * comme les autres : le Détail se joue à l'œil. Rien ne décrit le tableau
   * avant le verdict — la description soufflerait la réponse (invariant 1) —,
   * et Hugo, au lecteur d'écran, l'a joué au hasard, zéro sur neuf (la tablée
   * du 25 octobre 2026). L'annonce le dit.
   */
  avertissement?: string
}

/** « ★★ » ; « rien » pour zéro — un barème ne dit jamais une étoile vide. */
const etoiles = (n: number) => (n > 0 ? '★'.repeat(n) : 'rien')

/** « 2 minutes », « 55 secondes » : une durée du barème, en minutes quand elle tombe juste. */
const dureeDite = (secondes: number) => (secondes % 60 === 0 ? `${secondes / 60} minute${secondes > 60 ? 's' : ''}` : `${secondes} secondes`)

/** « un pas », « une erreur », puis les nombres en lettres : un barème se lit, il ne se déchiffre pas. */
const LETTRES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix']
const enLettres = (n: number, genre: 'masculin' | 'feminin' = 'masculin') => (n === 1 && genre === 'feminin' ? 'une' : (LETTRES[n] ?? String(n)))

/** « 1 ou 2 », « 3 », « 4 à 6 » : les essais ou les indices de chaque étoile, de l'un à l'autre. */
function deA(de: number, a: number, dire: (n: number) => string = String): string {
  if (de === a) return dire(de)
  return `${dire(de)} ${a === de + 1 ? 'ou' : 'à'} ${dire(a)}`
}

/**
 * Un barème qui compte, ses bornes lues dans `bareme.ts` : « en 1 ou 2 essais
 * ★★★ · 3 ou 4 ★★ · 5 ★ ». Deux bornes seulement, la dernière étoile n'a pas
 * de plafond — « 4 et plus ★ » : aux Indices, chaque erreur compte et en
 * montre un de plus, et le compte passe les cinq indices d'une fiche.
 */
function baremeCompte(bornes: readonly number[], mot: string): string {
  const tranches = bornes.map((a, i) => deA(i === 0 ? 1 : bornes[i - 1] + 1, a))
  if (tranches.length < 3) tranches.push(`${bornes[bornes.length - 1] + 1} et plus`)
  return tranches.map((t, i) => `${i === 0 ? `en ${t} ${mot}` : t} ${etoiles(3 - i)}`).join(' · ')
}

/**
 * « sans faute ★★★ · une erreur ★★ · deux ★ » : les erreurs tolérées pour
 * chaque étoile ; le premier palier qui en tolère les nomme. Une borne qui ne
 * monte pas laisse un palier vide — aucune erreur ne vaut cette étoile — et il
 * ne se dit pas : la Frise à [0, 1, 1] (le calibrage du 25 octobre 2026) se
 * lisait « sans faute ★★★ · une erreur ★★ · deux à une ★ ». En deçà du dernier
 * palier dit, zéro.
 */
export function baremeDesErreurs(bornes: readonly number[]): string {
  return bornes
    .map((a, i) => {
      const de = i === 0 ? 0 : bornes[i - 1] + 1
      if (a < de) return null
      const nombre = deA(de, a, n => enLettres(n, 'feminin'))
      const premiere = i === 0 || bornes[i - 1] === 0
      const dit = a === 0 ? 'sans faute' : !premiere ? nombre : `${de === 0 ? `au plus ${enLettres(a, 'feminin')}` : nombre} erreur${a > 1 ? 's' : ''}`
      return `${dit} ${etoiles(3 - i)}`
    })
    .filter(t => t !== null)
    .join(' · ')
}

/**
 * Les mots du Pari qui comptent ses étoiles, au nombre du barème : une étoile
 * gardée, puis deux depuis le calibrage du 25 octobre 2026. Une seule source,
 * que l'annonce, le refus et la révélation du jeu (`pari.ts`) lisent, et la page
 * pour ses boutons : l'accord se décidait à deux endroits, chacun à sa façon,
 * et « Garder ★ » écrit en dur à l'écran en aurait promis une de moins.
 */
export function motsDuPari(e: Readonly<Record<'garder' | 'parier', number>>) {
  const une = e.garder === 1
  return {
    /** L'annonce : « Juste : garde deux étoiles, ou parie-les sur une question plus difficile. » */
    geste: `Juste : ${une ? 'garde une étoile, ou parie-la' : `garde ${enLettres(e.garder, 'feminin')} étoiles, ou parie-les`} sur une question plus difficile.`,
    /** La première question juste, au choix. */
    auChoix: `Juste ! Tu gardes ${etoiles(e.garder)}, ou tu paries pour ${etoiles(e.parier)} sur une question plus difficile. Raté, la manche ne rapporte rien.`,
    /** Les deux boutons du choix. */
    garder: `Garder ${etoiles(e.garder)}`,
    parier: `Parier → ${etoiles(e.parier)}`,
    /** Le refus d'une réponse de plus, au choix. */
    gardeOuParie: une ? 'Garde ton étoile, ou parie-la' : 'Garde tes étoiles, ou parie-les',
    /** La révélation d'une manche gardée. */
    gardees: une ? 'Étoile gardée' : 'Étoiles gardées',
  }
}

/** Les mots du Pari, au barème du code. */
export const MOTS_DU_PARI = motsDuPari(ETOILES_DU_PARI)

/** « au premier coup d’œil ★★★ · un pas ★★ · deux ★ » : les étoiles de chaque cadrage ; un cadrage qui ne vaut rien ne se dit pas — en deçà, zéro. */
function baremeDesCadrages(parCadrage: readonly number[]): string {
  return parCadrage
    .map((e, pas) => (e > 0 ? `${pas === 0 ? 'au premier coup d’œil' : pas === 1 ? 'un pas' : enLettres(pas)} ${etoiles(e)}` : null))
    .filter(t => t !== null)
    .join(' · ')
}

export const JEUX: Readonly<Record<CleDeJeu, DescriptionDUnJeu>> = {
  epingle: {
    cle: 'epingle',
    nom: 'L’Épingle',
    a: 'à l’Épingle',
    geste: 'Un récit, puis « Où ? » : plante ton épingle sur la carte de France.',
    bareme: KM_DE_L_EPINGLE.map((km, i) => `${i === 0 ? 'à moins de ' : ''}${km} km ${etoiles(3 - i)}`).join(' · '),
    eclairer: `entoure une grande zone (${RAYON_D_ECLAIRER_KM} km) qui contient le lieu`,
    changeable: true,
    etapes: 1,
  },
  frise: {
    cle: 'frise',
    nom: 'La Frise',
    a: 'à la Frise',
    geste: 'Range les événements du plus ancien au plus récent : à chaque manche, la frise s’allonge.',
    bareme: baremeDesErreurs(ERREURS_DE_LA_FRISE),
    eclairer: 'dévoile l’année d’un nouveau venu',
    changeable: false,
    etapes: 1,
  },
  mot: {
    cle: 'mot',
    nom: 'Le Mot mystère',
    a: 'au Mot mystère',
    // Son chrono, comme l'Éclair : « Trois parties de deux minutes » laissait croire la partie entière en deux minutes, quand une
    // seule manche du Mot les prend (la tablée du 26 octobre 2026).
    geste: `Trouve le mot, avec la question pour indice : ${ESSAIS_DU_MOT} essais en ${dureeDite(DUREES_DES_JEUX.mot)}.`,
    bareme: baremeCompte(ESSAIS_DES_ETOILES, 'essais'),
    eclairer: 'souffle une lettre à sa place',
    changeable: true,
    etapes: 1,
  },
  detail: {
    cle: 'detail',
    nom: 'Le Détail',
    a: 'au Détail',
    geste: 'Reconnais le tableau : chaque pas en arrière en montre plus, et vaut une étoile de moins.',
    bareme: baremeDesCadrages(ETOILES_AU_CADRAGE),
    eclairer: 'efface un mauvais titre',
    changeable: true,
    etapes: 1,
    avertissement: 'Un jeu qui se joue à l’œil : les tableaux ne sont pas décrits au lecteur d’écran — la description soufflerait la réponse.',
  },
  filet: {
    cle: 'filet',
    nom: 'Le Filet',
    a: 'au Filet',
    geste: 'Place ton curseur, puis choisis ton filet : petit, il rapporte plus.',
    bareme: `petit filet ${etoiles(ETOILES_DU_FILET.petit)} · moyen ${etoiles(ETOILES_DU_FILET.moyen)} · grand ${etoiles(ETOILES_DU_FILET.grand)}`,
    eclairer: 'montre une zone où est la réponse',
    changeable: true,
    etapes: 1,
  },
  pari: {
    cle: 'pari',
    nom: 'Le Pari',
    a: 'au Pari',
    geste: MOTS_DU_PARI.geste,
    bareme: `garder ${etoiles(ETOILES_DU_PARI.garder)} · parier et réussir ${etoiles(ETOILES_DU_PARI.parier)}`,
    eclairer: 'efface une mauvaise réponse',
    changeable: true,
    etapes: 2,
  },
  eclair: {
    cle: 'eclair',
    nom: 'L’Éclair',
    a: 'à l’Éclair',
    geste: `${AFFIRMATIONS_DE_L_ECLAIR} affirmations en ${dureeDite(DUREES_DES_JEUX.eclair)} : vraies ou fausses ?`,
    bareme: JUSTES_DE_L_ECLAIR.map((n, i) => `${i === 0 ? `${n} justes` : n} ${etoiles(3 - i)}`).join(' · '),
    eclairer: 'souffle la réponse de l’affirmation en cours',
    changeable: true,
    etapes: 1,
  },
  indices: {
    cle: 'indices',
    nom: 'Les Indices',
    a: 'aux Indices',
    geste: 'Qui suis-je ? Réponds avec le moins d’indices possible : une erreur compte aussi, et en montre un de plus.',
    bareme: baremeCompte(INDICES_DES_ETOILES, 'indices'),
    eclairer: 'un indice gratuit',
    changeable: true,
    etapes: 1,
  },
  replique: {
    cle: 'replique',
    nom: 'La Réplique',
    a: 'à la Réplique',
    geste: 'Complète la réplique, puis dis qui l’a dite.',
    bareme: `le bon mot ${etoiles(ETOILES_DE_LA_REPLIQUE.mot)} · la bonne personne ${etoiles(ETOILES_DE_LA_REPLIQUE.qui)}`,
    eclairer: 'efface une mauvaise proposition',
    changeable: true,
    etapes: 2,
  },
  quiz: {
    cle: 'quiz',
    nom: 'Le Quiz',
    a: 'au Quiz',
    // Le chrono de la manche entière, comme l'Éclair : « une minute par question » aurait promis quatre fois trop.
    geste: `${QUESTIONS_DU_QUIZ} questions sur le thème, quatre réponses chacune, en ${dureeDite(DUREES_DES_JEUX.quiz)}.`,
    bareme: JUSTES_DU_QUIZ.map((n, i) => `${i === 0 ? `${n} justes` : n} ${etoiles(3 - i)}`).join(' · '),
    eclairer: 'efface une mauvaise réponse de la question en cours',
    changeable: true,
    etapes: 1,
  },
}

/**
 * Ce que le verdict d'une manche rend : ses étoiles naturelles — avant les
 * pouvoirs, que le pli applique ensuite — et la pièce, ou les deux pièces du
 * Pari parié, que le journal écrit.
 */
export interface VerdictDUneManche {
  naturel: 0 | 1 | 2 | 3
  pieces: { juste: boolean; choix: number | null; composee: string | null; etape?: 1 | 2 }[]
}

/**
 * La forme de la règle d'un jeu. Pure : le contenu est tiré au départ par le
 * serveur (`Tiree`), l'état d'une manche se replie de ses gestes (`Etat`), et
 * la vue ne montre que ce que `montrer` choisit (invariant 1).
 */
export interface RegleDuJeu<Tiree, Etat, Geste, Montree, Revelee> {
  cle: CleDeJeu
  /**
   * Le Pari et la Réplique ont deux étapes, chacune son chrono. Leur état le
   * dit au pli, qui tient les chronos (`shared/cabinet/partie.ts`) : `etape`
   * (1 ou 2), et au Pari `auChoix` — juste à la première question, il garde
   * ou il parie, et aucun chrono ne court. L'échéance d'une étape, le pli la
   * joue comme la page : une réponse vide (`lireLeGeste({ quoi: 'repondre' })`)
   * qui tranche se juge expirée ; qui ne tranche pas ouvre l'étape suivante —
   * « Qui l'a dit ? », le mot perdu.
   */
  etapes: 1 | 2
  /** La durée d'une étape, « Prendre son temps » à part (`DUREES_DES_JEUX`) : le départ la fige (`chronoDuDepart`), le pli ne la relit jamais ici. */
  dureeMs: (etape: 1 | 2) => number
  /** L'état d'une manche qui s'ouvre. */
  ouvrir(t: Tiree): Etat
  /** Relit ce que la page envoie pour ce jeu ; null : illisible. */
  lireLeGeste(brut: unknown, t: Tiree): Geste | null
  /**
   * Ce geste tranche-t-il la manche, quand `repondre` ne suffit pas à le dire ?
   * Le jeu seul le sait — l'essai qui trouve le mot ou le cinquième, « Garder »
   * au Pari, quand la juste de sa première question attend son choix. Absent :
   * seul `repondre` tranche (`trancheLaManche`, le contrat des gestes). L'état
   * reste celui d'avant le geste qui tranche : ce qu'il portait, le verdict le
   * garde (`choix`, `composee`), et la révélation l'y relit.
   */
  tranche?(t: Tiree, e: Etat, g: Geste): boolean
  /** Un geste qui ne tranche pas (un essai, reculer, un indice, parier, le mot…) ; une chaîne : son refus, en mots. */
  apresLeGeste(t: Tiree, e: Etat, g: Geste): Etat | string
  /** Les étoiles naturelles et ce que la pièce écrit ; « expiree » : rien de ce qu'elle portait ne compte. */
  juger(t: Tiree, e: Etat, reponse: Geste | 'expiree' | 'quittee'): VerdictDUneManche
  /**
   * Éclairer, propre au jeu : son effet, ou son refus. Rien à souffler se dit
   * d'abord, quelle que soit la cible, par le refus des pouvoirs
   * (`rienAEclairer`) : le pli y lit si Éclairer sert encore. `hasard` est
   * rejoué — recharger redonne la même zone — mais imprévisible pour la
   * page : la zone du Filet, la réponse effacée du Pari se tirent de la
   * réponse, et qui rejouerait le hasard la retrouverait. Sa graine est un
   * secret du serveur, jamais faite de ce que la page connaît (son profil, sa
   * partie, le rang).
   */
  eclairer(t: Tiree, e: Etat, hasard: () => number, cible?: number): Etat | string
  /** Ce que la manche montre, sans la réponse ; la vue n'en ajoute rien. */
  montrer(t: Tiree, e: Etat): Montree
  /** La révélation : la réponse entière, et « Le savais-tu ? ». */
  reveler(t: Tiree, e: Etat, v: VerdictDUneManche): Revelee
  /**
   * Ce que la pièce garde au journal : son identifiant, sa forme, `composee`.
   * `aidee` : le pli marque la ligne d'un pouvoir (`joker` : Éclairer, ou le
   * verdict arrivé dans le temps en plus) — le jeu ne sait pas l'échéance. Une
   * pièce aidée porte la forme de son jeu : seule la première question du
   * Pari, sans aide, sort nue (D4).
   */
  piece(t: Tiree, e: Etat, v: VerdictDUneManche, i: { manche: 0 | 1 | 2; tirage: number; etape?: 1 | 2; aidee?: boolean }): PieceDuCabinet
  /** Ce que le cartel d'une œuvre gagnée dit de cette manche. */
  cartel(t: Tiree, v: VerdictDUneManche): { sujet: string; reponse: string; anecdote: string | null }
}

/**
 * Où va un geste : à `juger` s'il tranche la manche, sinon à `apresLeGeste`.
 * Le pli ne le demande qu'ici. Ce que le jeu en dit (`tranche`), ou le contrat
 * des gestes : `repondre` tranche, le reste attend sa réponse — « Reculer d'un
 * pas » au Détail, un indice, le mot de la Réplique. Le défaut inverse aurait
 * tranché à zéro le Détail dès son premier pas en arrière.
 */
export function trancheLaManche<T, E, G extends { quoi: string }>(r: Pick<RegleDuJeu<T, E, G, unknown, unknown>, 'tranche'>, t: T, e: E, g: G): boolean {
  return r.tranche ? r.tranche(t, e, g) : g.quoi === 'repondre'
}

/**
 * Une pièce est-elle juste ? Dès deux étoiles naturelles (`ETOILES_D_UNE_JUSTE`)
 * — jamais les étoiles après les pouvoirs : Protéger qui porte une manche de ★
 * à ★★ ne paie pas un confetti de plus. Le Pari rend null : chacune de ses
 * pièces est juste à sa bonne réponse.
 */
export const justeDeLaPiece = (naturel: number, jeu: CleDeJeu): boolean | null => (jeu === 'pari' ? null : naturel >= ETOILES_D_UNE_JUSTE)
