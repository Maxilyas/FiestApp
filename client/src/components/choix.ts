import { NOM_FINITION, type FinitionChoisie } from '../../../shared/profil'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { nomDansLaPhrase, portrait } from '../../../shared/branches'
import { nomDuTitre } from '../../../shared/sentiers'
import { fond } from '../../../shared/fonds'
import { gerbe } from '../../../shared/gerbes'
import { theme } from '../../../shared/themes'
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
}

/**
 * Ce que reçoit chaque pièce de la loge (`Loge.tsx`) : ce qu'il porte, ce
 * qu'il essaie, et de quoi essayer — un toucher essaie, il n'enregistre
 * rien ; « Porter », dans la barre de la loge, enregistre tout l'essai.
 */
export interface PropsDUnePiece {
  profil: PublicProfileDetail
  /** L'essai en cours : ce que la carte de la loge montre. */
  essai: Essai
  essayer: (piece: Essai) => void
  busy: boolean
  /** Ce qui s'enregistre d'un toucher, hors de l'essai : la version — rare ou d'origine — d'un avatar éclaté. */
  enregistrer: (patch: ChoixDuProfil) => void
  /** Ce qui est arrivé depuis son dernier passage sur ce téléphone. */
  neufs?: ReadonlySet<string>
}

/** Les champs d'un enregistrement, dans l'ordre où l'annonce les dit : celui de la rangée de la loge. */
const CHAMPS = ['avatar', 'eclat', 'legendaire', 'finition', 'titre', 'vitrine', 'fond', 'theme', 'gerbe'] as const

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
  if (choix.eclat) return choix.eclat.brille ? 'Tu portes sa version rare.' : 'Tu portes sa version d’origine.'
  if (choix.legendaire !== undefined) {
    const tete = portrait(choix.legendaire)
    const nom = legendaire(choix.legendaire)?.nom ?? divin(choix.legendaire)?.nom ?? (tete && nomDansLaPhrase(tete.nom))
    return nom ? `Tu portes ${nom}.` : 'Tu reviens à ton emoji.'
  }
  if (choix.finition) return choix.finition === 'auto' ? 'Ta plus belle finition, d’office.' : `Finition ${NOM_FINITION[choix.finition]}.`
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
  return 'C’est enregistré.'
}
