import type { IconName } from './components/Icon'
import type { Sujet } from '../../shared/sujets'

/**
 * L'icône d'un sujet (`shared/sujets.ts`) : l'horloge pour une époque, un
 * emblème pour un fil rouge ou un thème. La série les choisit avec, les
 * sentiers à thème les montent avec : une seule table pour les deux — un
 * thème qu'on ajoute y prend la sienne.
 */
const ICONE_DU_SUJET: Record<string, IconName> = {
  animaux: 'paw',
  inventions: 'bulb',
  'mythes-legendes': 'sparkles',
  'terre-espace': 'planet',
  'grands-rendez-vous': 'medal',
  'petit-ecran': 'monitor',
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
