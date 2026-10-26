// Les pièces du Cabinet : ce qu'un verdict juge d'un coup — une manche, ou
// chacune des deux questions du Pari parié —, telles que le journal des
// réponses de la campagne les garde. Une partie du Cabinet est une série de
// la campagne (`mode = 'cabinet'`) : ses pièces s'ajoutent à
// `campagne_series.questions`, leurs réponses à `campagne_reponses`, et
// l'expérience, les confettis, le compagnon, les missions et le carnet les
// comptent sans rien savoir du Cabinet.
//
// Une pièce tirée de la base (le Pari, le Mot mystère, le Filet) garde
// l'identifiant de sa question. Tout le reste est hors de la base, sous un
// seul préfixe, `cab:` : ni carnet, ni signalement, ni mesure. Un seul
// préfixe plutôt qu'un par jeu — trois endroits du serveur recopiaient chacun
// les leurs, autant d'oublis possibles.
//
// Ce fichier n'importe que des types : le journal des réponses le lit sans
// tirer le Cabinet.

import type { Niveau } from '../campagne'
import type { CleDeJeu } from './jeux/regle'

/** Ce qui, au journal des réponses, vient du Cabinet sans être une question de la base. */
export const PREFIXE_DU_CABINET = 'cab:'

/**
 * Ce que `campagne_series.questions` garde à la position d'une réponse : le
 * cœur d'une question de série au premier niveau — le journal y lit
 * `categorie` et `niveau`, le signalement la version jouée —, et ce qui la
 * situe dans sa partie. Une pièce répondue ne change jamais : le journal relit
 * sa catégorie et sa marche au réveil.
 */
export interface PieceDuCabinet {
  id: string
  /** La question montrée ; pour un contenu `cab:`, ce qu'il demandait. */
  texte: string
  /** Les réponses telles que la partie les a mélangées ; pour un contenu `cab:`, la réponse dite (« Beaune (Côte-d'Or), 1443 »). */
  reponses: string[]
  bonne: number
  categorie: string | null
  anecdote: string | null
  /** La marche tirée ; `moyen` pour un contenu sans marche. */
  niveau: Niveau
  sousTheme?: string
  /** La forme de sa ligne — la clé de son jeu, sauf au Pari nu —, que relit `memeVersion`. */
  forme?: string
  cabinet: {
    jeu: CleDeJeu
    manche: 0 | 1 | 2
    tirage: number
    etape?: 1 | 2
    /**
     * Ce que sa manche a montré de plus qu'elle, sous les identifiants que le
     * journal sait déplier : les trois leurres du Détail, montrés chacun avec
     * son peintre — la réponse de chaque « Qui a peint… ? » qui les nomme —,
     * et ce que « Changer » a remplacé, la pièce que la manche remplacée aurait
     * laissée, quittée. Le journal le compte vu à l'heure de la pièce
     * (`JournalDesReponses.vuesDe`), et rien d'autre ne le lit : le carnet, la
     * mesure, le signalement, tes murs et le cartel ne jugent que le contenu
     * joué. Une manche n'écrit toujours qu'une pièce par verdict (la deuxième
     * tablée, le 26 octobre 2026).
     */
    montre?: readonly string[]
  }
}

/**
 * La colonne `joker` d'une pièce aidée : le pouvoir qui l'a aidée, jamais la
 * clé d'une carte-bonus — Bastion et Cuirasse sont aussi des cartes du second
 * essai de l'Expédition, et le carnet tiendrait pour ratée une juste qui en
 * porterait la clé. Changer, Protéger et Miser ne la marquent pas : Changer
 * pose une autre question, nue ; les deux autres ne changent que les étoiles.
 */
export const JOKER_D_ECLAIRER = 'pouvoir:eclairer'
/** … et le temps en plus, seulement si la réponse est arrivée dedans. */
export const JOKER_DU_TEMPS = 'pouvoir:temps'

/** Un lieu de l'Épingle. */
export const idDuLieu = (id: string) => `${PREFIXE_DU_CABINET}lieu:${id}`
/** Une fiche des Indices. */
export const idDeLaFiche = (id: string) => `${PREFIXE_DU_CABINET}qui:${id}`
/** Une réplique. */
export const idDeLaReplique = (id: string) => `${PREFIXE_DU_CABINET}replique:${id}`
/** Un tableau du Détail, par son identifiant Wikidata : il n'est pas la question « Qui a peint… ? » de la base. */
export const idDuTableau = (qid: string) => `${PREFIXE_DU_CABINET}tableau:${qid}`

const ECLAIR = `${PREFIXE_DU_CABINET}eclair:`
const FRISE_DE_SUJET = `${PREFIXE_DU_CABINET}frise:s:`

/** Les cinq affirmations de l'Éclair, une pièce : cinq questions récrites, dont aucune n'est plus celle de la base. */
export const idDeLEclair = (ids: readonly string[]) => ECLAIR + ids.join('+')
/**
 * Une manche d'une frise à thème : la frise et sa manche, pour que chaque
 * pièce reste unique dans sa partie — le signalement joint par (partie,
 * identifiant), et deux lignes au même identifiant y feraient deux rapports.
 */
export const idDeLaFriseATheme = (frise: string, manche: number) => `${PREFIXE_DU_CABINET}frise:t:${frise}:${manche}`
/** Une manche d'une frise d'un sujet de la base : les questions de ses nouveaux venus. */
export const idDeLaFriseDeSujet = (ids: readonly string[]) => FRISE_DE_SUJET + ids.join('+')

export const estDuCabinet = (id: string) => id.startsWith(PREFIXE_DU_CABINET)
/** Une manche d'une frise d'un sujet de la base : ses questions sont datées, et tes murs y lisent ses dates — jamais l'Éclair, qui se déplie aussi. */
export const estUneFriseDeSujet = (id: string) => id.startsWith(FRISE_DE_SUJET)

/**
 * Les questions de la base qu'une pièce a posées : un composé de l'Éclair ou
 * d'une frise de sujet se déplie en ses questions, tout autre identifiant
 * reste lui-même. Toute la campagne lit ses vues dépliées
 * (`JournalDesReponses.vuesDe`, qui déplie aussi un tableau du Détail en les
 * questions qui le nomment, de la fiche du serveur, et chaque identifiant de
 * ce que la pièce a montré de plus, `cabinet.montre`) : une question vue à
 * l'Éclair ne revient pas au Pari avant sept jours, ni jamais vue en série ou
 * en duel — sa révélation avait dit la bonne réponse.
 */
export function deplier(id: string): string[] {
  if (id.startsWith(ECLAIR)) return id.slice(ECLAIR.length).split('+')
  if (id.startsWith(FRISE_DE_SUJET)) return id.slice(FRISE_DE_SUJET.length).split('+')
  return [id]
}
