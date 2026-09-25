import { GLOSSAIRE, type Mot } from '../../../shared/glossaire'
import { Icon } from './Icon'

/**
 * « Que veulent dire ces mots ? » : une légende qu'on déplie, sous la page qui
 * les emploie. Un `title` ne s'affiche pas au toucher — Jeanne et Liam ont lu
 * « coup d'œil » et « biais » au téléphone sans jamais savoir ce qu'ils
 * voulaient dire. Repliée, elle ne prend qu'une ligne.
 */
export function Glossaire({
  mots,
  extra = [],
  titre = 'Que veulent dire ces mots ?',
}: {
  mots: Mot[]
  /** Des définitions propres à la page — les colonnes d'un tableau. */
  extra?: { terme: string; sens: string }[]
  titre?: string
}) {
  const lignes = [...mots.map(m => GLOSSAIRE[m]), ...extra]
  return (
    <details className="glossaire">
      <summary>
        <Icon name="book" />
        {titre}
      </summary>
      <dl>
        {lignes.map(({ terme, sens }) => (
          <div key={terme}>
            <dt>{terme}</dt>
            <dd>{sens}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
