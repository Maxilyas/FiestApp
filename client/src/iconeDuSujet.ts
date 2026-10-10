import type { IconName } from './components/Icon'
import type { Sujet } from '../../shared/sujets'

/**
 * L'icône d'un sujet (`shared/sujets.ts`) : l'horloge pour une époque, un
 * emblème pour un fil rouge. La série les choisit avec, les sentiers à thème
 * les montent avec : une seule table pour les deux.
 */
const ICONE_DU_SUJET: Record<string, IconName> = {
  france: 'flag',
  pionnieres: 'award',
  pieges: 'alert',
  premieres: 'zap',
  records: 'trophy',
  surnoms: 'message',
  mots: 'book',
  insolite: 'eye',
  enfance: 'star',
}

export const iconeDuSujet = (s: Sujet): IconName => ICONE_DU_SUJET[s.cle] ?? 'clock'
