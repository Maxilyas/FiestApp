import { NOM_FINITION, type FinitionChoisie } from '../../../shared/profil'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { nomDansLaPhrase, portrait } from '../../../shared/branches'
import { hautFait } from '../../../shared/hautsfaits'
import { fond } from '../../../shared/fonds'
import { gerbe } from '../../../shared/gerbes'
import { theme } from '../../../shared/themes'

// Ce qu'un toucher du profil change, et ce que le lecteur d'écran en entend.
// À part des onglets qui l'emploient : la page du profil l'annonce, et
// l'importer depuis `Apparence` faisait partir l'onglet entier — les dessins
// de tous les médaillons avec lui — chez l'anonyme de l'accueil.

/** Ce qu'un toucher du profil change : un champ à la fois. */
export type ChoixDuProfil = {
  avatar?: string
  finition?: FinitionChoisie
  legendaire?: string | null
  titre?: string | null
  fond?: string | null
  /** La gerbe de ses bonnes réponses, parmi celles qu'il a gagnées ; null : aucune. */
  gerbe?: string | null
  /** Le thème de ses pages, parmi ceux qu'il a ; null : Velours. */
  theme?: string | null
  vitrine?: string[] | null
  /** Porter la version rare d'un avatar qui a éclaté, ou sa version d'origine. */
  eclat?: { cle: string; brille: boolean }
}

/**
 * Ce qu'un choix enregistré a changé, en une phrase pour le lecteur
 * d'écran : l'état « pressé » d'une case changeait sans rien dire.
 */
export function annonceDuChoix(choix: ChoixDuProfil): string {
  if (choix.avatar) return `Tu portes ${choix.avatar}.`
  if (choix.eclat) return choix.eclat.brille ? 'Tu portes sa version rare.' : 'Tu portes sa version d’origine.'
  if (choix.legendaire !== undefined) {
    const tete = portrait(choix.legendaire)
    const nom = legendaire(choix.legendaire)?.nom ?? divin(choix.legendaire)?.nom ?? (tete && nomDansLaPhrase(tete.nom))
    return nom ? `Tu portes ${nom}.` : 'Tu reviens à ton emoji.'
  }
  if (choix.finition) return choix.finition === 'auto' ? 'Ta plus belle finition, d’office.' : `Finition ${NOM_FINITION[choix.finition]}.`
  if (choix.titre !== undefined) {
    const titre = choix.titre ? hautFait(choix.titre)?.title : undefined
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
