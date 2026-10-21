import { NOM_FINITION, type FinitionChoisie } from '../../../shared/profil'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { nomDansLaPhrase, portrait } from '../../../shared/branches'
import { compagnon, formeDeCompagnon } from '../../../shared/compagnons'
import { nomDuTitre } from '../../../shared/sentiers'
import { fond } from '../../../shared/fonds'
import { gerbe } from '../../../shared/gerbes'
import { theme } from '../../../shared/themes'
import { AUCUNE_BORDURE, NOM_DE_LA_BORDURE, type ChoixDeBordure } from '../../../shared/duels'
import type { Essai } from '../../../shared/loge'
import type { PublicProfileDetail } from '../../../shared/profil'

// Ce qu'un toucher du profil change, et ce que le lecteur d'écran en entend.
// À part des onglets qui l'emploient : la page du profil l'annonce, et
// l'importer depuis `Apparence` faisait partir l'onglet entier — les dessins
// de tous les médaillons avec lui — chez l'anonyme de l'accueil.

/**
 * Ce qu'un enregistrement du profil change : ce que la loge porte d'un coup
 * — un avatar, un titre, un thème… —, ou l'Éclat d'un avatar.
 */
export type ChoixDuProfil = {
  avatar?: string
  finition?: FinitionChoisie
  legendaire?: string | null
  titre?: string | null
  fond?: string | null
  /** La gerbe de ses bonnes réponses, parmi celles qu'il a gagnées ; `AUCUNE_GERBE` : aucune ; null : celle de tous. */
  gerbe?: string | null
  /** Le thème de ses pages, parmi ceux qu'il a ; null : Velours. */
  theme?: string | null
  vitrine?: string[] | null
  /** Porter la version rare d'un avatar qui a éclaté, ou sa version d'origine. */
  eclat?: { cle: string; brille: boolean }
  /** Dépenser un Éclat en réserve pour faire éclater cet avatar, définitivement (jamais un essai : il s'envoie seul). */
  eclatDeReserve?: string
  /** La bordure de ligue : `auto`, `aucune`, ou celle d'une ligue atteinte en duel. */
  bordure?: ChoixDeBordure
  /** Le compagnon de sa niche, parmi ceux qu'il a adoptés : c'est lui qui grandit. */
  niche?: string | null
}

/**
 * Ce que la page demande à la loge avant de la quitter — « ← Mon profil »,
 * un lien, le retour du navigateur — : un essai attend-il (`enCours`), et
 * que faire de lui (`demander` : « Porter », « Partir sans » ou « Rester » —
 * vrai si l'on peut partir, l'essai porté ou laissé). Un essai pas porté se
 * perdait en silence (le retour d'un joueur du 14 octobre 2026). Ici, et pas
 * dans `Loge.tsx` : la page n'importe rien de la loge, qui vient avec ses
 * panneaux.
 */
export interface GardeDeLaLoge {
  enCours: () => boolean
  demander: () => Promise<boolean>
}

/**
 * Ce que reçoit chaque pièce de la loge (`Loge.tsx`) : ce qu'il porte, ce
 * qu'il essaie, et de quoi essayer — un toucher essaie, il n'enregistre
 * rien, la version d'un avatar éclaté comprise ; « Porter », dans la barre
 * de la loge, enregistre tout l'essai.
 */
export interface PropsDUnePiece {
  profil: PublicProfileDetail
  /** L'essai en cours : ce que la carte de la loge montre. */
  essai: Essai
  essayer: (piece: Essai) => void
  busy: boolean
  /** Ce qui est arrivé depuis son dernier passage sur ce téléphone. */
  neufs?: ReadonlySet<string>
  /** Dépenser un Éclat en réserve sur un avatar : vrai s'il a pris. Absent d'une page qui ne sait pas l'enregistrer. */
  eclater?: (cle: string) => Promise<boolean>
}

/** Les champs d'un enregistrement, dans l'ordre où l'annonce les dit : celui de la rangée de la loge. */
const CHAMPS = ['avatar', 'eclat', 'eclatDeReserve', 'legendaire', 'finition', 'bordure', 'titre', 'vitrine', 'fond', 'theme', 'gerbe', 'niche'] as const

/**
 * Ce qu'un choix enregistré a changé, une phrase par pièce, pour le lecteur
 * d'écran : l'état « pressé » d'une case changeait sans rien dire. La loge
 * porte plusieurs pièces d'un coup : chacune a sa phrase.
 */
export function annonceDuChoix(choix: ChoixDuProfil): string {
  const phrases = CHAMPS.filter(k => choix[k] !== undefined).map(k => annonceDUnChamp({ [k]: choix[k] }))
  return phrases.length > 0 ? phrases.join(' ') : 'C’est enregistré.'
}

function annonceDUnChamp(choix: ChoixDuProfil): string {
  if (choix.avatar) return `Tu portes ${choix.avatar}.`
  if (choix.eclatDeReserve) return 'Ton Éclat en réserve a fait éclater cet avatar.'
  if (choix.eclat) return choix.eclat.brille ? 'Tu portes sa version rare.' : 'Tu portes sa version d’origine.'
  if (choix.legendaire !== undefined) {
    const tete = portrait(choix.legendaire) ?? formeDeCompagnon(choix.legendaire)
    const nom = legendaire(choix.legendaire)?.nom ?? divin(choix.legendaire)?.nom ?? (tete && nomDansLaPhrase(tete.nom))
    return nom ? `Tu portes ${nom}.` : 'Tu reviens à ton emoji.'
  }
  if (choix.finition) return choix.finition === 'auto' ? 'Ta plus belle finition, d’office.' : `Finition ${NOM_FINITION[choix.finition]}.`
  if (choix.bordure) {
    if (choix.bordure === 'auto') return 'Ta plus haute bordure, d’office.'
    return choix.bordure === AUCUNE_BORDURE ? 'Sans bordure.' : `Ta bordure : ${NOM_DE_LA_BORDURE[choix.bordure]}.`
  }
  if (choix.titre !== undefined) {
    // Un maître, un champion du mois : ce ne sont pas des hauts faits, et ils se disaient « Sans titre ».
    const titre = nomDuTitre(choix.titre)
    return titre ? `Ton titre : ${titre}.` : 'Sans titre.'
  }
  if (choix.fond !== undefined) {
    const nom = fond(choix.fond)?.nom
    return nom ? `Ton fond de carte : ${nom}.` : 'Sans fond de carte.'
  }
  if (choix.gerbe !== undefined) {
    const nom = gerbe(choix.gerbe)?.nom
    return nom ? `Ta gerbe : ${nom.charAt(0).toLowerCase()}${nom.slice(1)}.` : 'Sans gerbe.'
  }
  if (choix.theme !== undefined) {
    const nom = choix.theme ? theme(choix.theme)?.nom : undefined
    return `Ton thème : ${nom ?? 'Velours'}.`
  }
  if (choix.vitrine !== undefined) return choix.vitrine ? 'Ta vitrine est enregistrée.' : 'Ta vitrine montre tes plus beaux hauts faits.'
  if (choix.niche !== undefined) {
    const c = compagnon(choix.niche)
    return c ? `${c.nom} s’installe dans ta niche.` : 'Ta niche accueille ton compagnon.'
  }
  return 'C’est enregistré.'
}
