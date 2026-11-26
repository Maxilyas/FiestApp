// Le Sphinx de l'accueil au QG (`/admin#sphinx`, l'étape 3 du plan du
// 24 novembre 2026, `retours/2026-11-24/le-sphinx/plan.md`) : le Divin du
// moment et ce que tous en ont trouvé, les phrases reconstituées, l'audience,
// les visites jour par jour, et la réussite énigme par énigme.
//
// Ce module part dans le paquet du navigateur : il ne porte que des comptes.
// Ni une réponse — elle n'arrive que par le geste qui la demande (`POST
// /api/admin/sphinx/enigmes/:numero/reponse`), et ce geste la range parmi les
// énigmes que l'administrateur a vues —, ni une légende, ni sa forme, ni un mot
// trouvé (invariant 21) : le propriétaire joue aussi. Rien d'un joueur n'y est
// nommé.

import { jourAvant } from './jour'
import type { EtatDeLaVisite, SorteDePiece } from './sphinx'

/** Les jours que la page montre, aujourd'hui compris. */
export const JOURS_DU_SPHINX_AU_QG = 30

/**
 * Ce que devient une visite, dans l'ordre où la page les empile, de bas en haut : celui des traversées du Cabinet,
 * vérifié sur la console — l'ambre, le rouge, l'ardoise de ce qui attend encore, le vert —, l'ardoise claire d'une
 * visite remise à plus tard entre l'ardoise et le vert : jamais le rouge à côté du vert.
 */
export const ISSUES_DES_VISITES: readonly EtatDeLaVisite[] = ['abandonnee', 'perdue', 'proposee', 'plus-tard', 'resolue']

export const NOM_DE_L_ISSUE: Record<EtatDeLaVisite, string> = {
  proposee: 'Proposées',
  'plus-tard': 'Remises à plus tard',
  resolue: 'Résolues',
  perdue: 'Perdues',
  abandonnee: 'Langue au chat',
}

/** Les visites d'un jour, issue par issue. */
export type VisitesDUnJour = { jour: string } & Record<EtatDeLaVisite, number>

/** Une énigme de la réserve, telle que la page la montre : ses vers, ses comptes — jamais sa réponse. */
export interface EnigmeAuQg {
  numero: string
  sorte: SorteDePiece
  /** Un problème : son titre (« Le passeur ») ; une énigme se nomme par son numéro. */
  titre?: string
  difficulte: 'facile' | 'moyenne' | 'difficile'
  /** Ses vers — d'un problème, son récit et sa question : la page ne les montre qu'au toucher de sa ligne. */
  vers: string[]
  /** Les visites qui l'ont posée, de tout temps, et ce qu'elles sont devenues. */
  vues: number
  resolues: number
  perdues: number
  chat: number
  /**
   * Ce que le profil de l'administrateur en sait : `vue` — une visite, ou
   * comptée pour vue (les huit qu'il connaissait, une réponse lue ici) —,
   * `en-cours` — le Sphinx la lui pose en ce moment, de quelque jour qu'elle
   * date : sa réponse attend —, ou null : il ne l'a jamais vue.
   */
  aToi: 'vue' | 'en-cours' | null
}

/** La page du Sphinx au QG (`GET /api/admin/sphinx`). */
export interface PageDuSphinxAuQg {
  maintenant: number
  aujourdhui: string
  /** Le Divin du moment : son nom, et combien de ses mots cachés tous ont trouvés — jamais lesquels. Null : tous reconstitués. */
  moment: { divin: { key: string; nom: string }; parTous: number; aTrouver: number } | null
  /** Les phrases reconstituées, dans l'ordre du Sphinx : le Divin, et le jour où son dernier mot a été trouvé — jamais le texte. */
  reconstituees: { divin: { key: string; nom: string }; le: number | null }[]
  /**
   * Les habitués passés aujourd'hui : ceux que le Sphinx a vus sur leur accueil
   * depuis minuit — en mémoire, sur ce serveur —, et ceux qu'il a visités.
   */
  habitues: number
  /** Les trente derniers jours, le plus ancien d'abord. */
  jours: VisitesDUnJour[]
  /** La réserve, dans son ordre. */
  enigmes: EnigmeAuQg[]
  /** Le compte d'administration tient un profil : sans lui, aucune réponse ne se lit — rien où la ranger. */
  profil: boolean
}

/** La réponse d'une énigme, que seul le geste rend (`POST /api/admin/sphinx/enigmes/:numero/reponse`). */
export interface ReponseDuSphinxAuQg {
  numero: string
  /** La solution du livre ; une charade, avec son découpage. */
  solution: string
  cle?: string
  /** Les réponses que le Sphinx accepte, et celles qui brûlent sans coûter d'essai. */
  acceptees: string[]
  presque: string[]
  /** Elle était déjà parmi les énigmes vues de son profil. */
  deja: boolean
}

/** Les trente jours de la page, le plus ancien d'abord, chacun ses visites par issue — un jour sans visite à zéro. */
export function visitesParJour(lignes: readonly { jour: string; etat: string; n: number }[], aujourdhui: string): VisitesDUnJour[] {
  const jours = Array.from({ length: JOURS_DU_SPHINX_AU_QG }, (_, i) => jourAvant(aujourdhui, JOURS_DU_SPHINX_AU_QG - 1 - i))
  const parJour = new Map(jours.map(jour => [jour, { jour, proposee: 0, 'plus-tard': 0, resolue: 0, perdue: 0, abandonnee: 0 } as VisitesDUnJour]))
  for (const l of lignes) {
    const j = parJour.get(l.jour)
    if (j && (ISSUES_DES_VISITES as readonly string[]).includes(l.etat)) j[l.etat as EtatDeLaVisite] += l.n
  }
  return jours.map(j => parJour.get(j)!)
}

/** La réussite d'une énigme : ses résolues sur ses visites closes — remises ou en cours ne comptent pas. Null : aucune close. */
export function reussiteDe(e: Pick<EnigmeAuQg, 'resolues' | 'perdues' | 'chat'>): { resolues: number; sur: number } | null {
  const sur = e.resolues + e.perdues + e.chat
  return sur > 0 ? { resolues: e.resolues, sur } : null
}
