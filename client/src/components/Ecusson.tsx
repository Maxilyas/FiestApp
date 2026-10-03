import { Icon, type IconName } from './Icon'
import { NOM_ECUSSON } from '../../../shared/ecussons'

/** L'emblème de chaque catégorie, au trait des icônes de l'application : l'écusson, et les catégories de la campagne. */
export const EMBLEME: Record<string, IconName> = {
  'Culture générale': 'bulb',
  Histoire: 'book',
  Géographie: 'globe',
  Sciences: 'zap',
  Nature: 'leaf',
  'Cinéma & séries': 'camera',
  Musique: 'music',
  'Arts & lettres': 'palette',
  Sport: 'target',
  Cuisine: 'utensils',
  'Jeux & pop culture': 'dice',
  'Autour de la fête': 'glass',
}

/**
 * Un écusson de savoir : un blason au trait, l'emblème de sa catégorie
 * dedans, teinté de son palier — bronze, argent, or. Sans palier, sa
 * silhouette en pointillé : ce qui reste à gagner, sur sa propre page
 * seulement. La couleur ne parle jamais seule : le palier se compte aussi en
 * crans au pied du blason — un, deux, trois —, et se dit en toutes lettres à
 * qui ne le voit pas. En niveaux de gris, l'argent et l'or étaient à 1,09:1
 * l'un de l'autre ; en protanopie, le bronze et l'or, le même jaune.
 */
export function Ecusson({ categorie, palier, legende }: { categorie: string; palier: 0 | 1 | 2 | 3; legende?: string }) {
  return (
    <span className={`ecusson palier-${palier}`}>
      <span className="ecusson-blason" aria-hidden="true">
        <svg className="ecusson-forme" viewBox="0 0 32 36">
          <path d="M16 1.5 29.5 6v10.5c0 8-5.5 14.6-13.5 17.9C8 31.1 2.5 24.5 2.5 16.5V6z" />
          {Array.from({ length: palier }, (_, i) => (
            <circle key={i} className="ecusson-cran" cx={16 + (i - (palier - 1) / 2) * 5} cy={27.5} r={1.5} />
          ))}
        </svg>
        <Icon name={EMBLEME[categorie] ?? 'star'} className="ecusson-embleme" />
      </span>
      <span className="ecusson-nom">
        {categorie}
        <span className="sr-only">{palier > 0 ? `, ${NOM_ECUSSON[palier].toLowerCase()}` : ', pas encore'}</span>
      </span>
      {legende && <span className="ecusson-legende">{legende}</span>}
    </span>
  )
}
