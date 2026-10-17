import type { IconName } from './components/Icon'
import { EMBLEME } from './components/Ecusson'
import type { FamilleDeSujet, Sujet } from '../../shared/sujets'

/**
 * L'icône d'un sujet (`shared/sujets.ts`) : l'horloge pour une époque, un
 * emblème pour un fil rouge ou un thème, le repère d'une carte pour un pays,
 * celui de sa catégorie pour une rubrique.
 * La série les choisit avec, les parcours de thème les montent avec : une
 * seule table pour les deux — un thème qu'on ajoute y prend la sienne.
 */
const ICONE_DU_SUJET: Record<string, IconName> = {
  animaux: 'paw',
  dinosaures: 'dinosaure',
  inventions: 'bulb',
  'mythes-legendes': 'sparkles',
  'terre-espace': 'volcan',
  'grands-rendez-vous': 'medal',
  'petit-ecran': 'monitor',
  danse: 'dancer',
  sante: 'stethoscope',
  informatique: 'code',
  astronomie: 'telescope',
  'jeux-video': 'gamepad',
  bd: 'bulles',
  monuments: 'landmark',
  francais: 'lettres',
  anglais: 'hi',
  espagnol: 'enye',
  noel: 'sapin',
  'nouvel-an': 'artifice',
  halloween: 'citrouille',
  amour: 'heart',
  anniversaires: 'gateau',
  disney: 'chateau',
  'harry-potter': 'baguette',
  'james-bond': 'noeud',
  marvel: 'bouclier',
  'seigneur-des-anneaux': 'anneau',
  'star-wars': 'sabre',
  france: 'flag',
  francophonie: 'globe',
  'outre-mer': 'palmier',
  paris: 'tour-eiffel',
  'rois-de-france': 'crown',
  'revolution-empire': 'bicorne',
  presidents: 'pupitre',
  mer: 'ancre',
  aviation: 'avion',
  polar: 'search',
  mysteres: 'coffre',
  marques: 'tag',
  pionnieres: 'award',
  pieges: 'alert',
  premieres: 'zap',
  records: 'trophy',
  surnoms: 'message',
  citations: 'guillemets',
  mots: 'book',
  'calcul-mental': 'operations',
  insolite: 'eye',
  enfance: 'star',
}

/** Une famille qui partage son icône : les pays, chacun le même repère. */
const ICONE_DE_LA_FAMILLE: Partial<Record<FamilleDeSujet, IconName>> = { pays: 'repere' }

export const iconeDuSujet = (s: Sujet): IconName => ICONE_DU_SUJET[s.cle] ?? ICONE_DE_LA_FAMILLE[s.famille] ?? (s.categorie && EMBLEME[s.categorie]) ?? 'clock'
