import { Icon } from './Icon'
import { EMBLEME } from './Ecusson'
import { iconeDuSujet } from '../iconeDuSujet'
import { espacesFines } from '../format'
import { FAMILLES_DE_SUJETS, sujetParCle, type Sujet } from '../../../shared/sujets'

/**
 * Ce que joue une partie de la campagne : des catégories — toutes, d'office
 * —, ou un sujet qui les traverse (`shared/sujets.ts`), chaque famille sa
 * rangée, une famille sans sujet jouable n'en a pas. En grille, l'emblème de
 * chacun : tout tient sans rien faire glisser de côté. La série et le défi
 * entre amis choisissent dans la même (le souhait du propriétaire du 11
 * octobre 2026 : choisir « sur quel thème » on défie).
 */
export function ChoixDuTheme({
  categoriesJouables,
  sujets,
  categories,
  sujet,
  onCategories,
  onSujet,
}: {
  /** Les catégories que la base sert. */
  categoriesJouables: readonly string[]
  /** Les sujets qui ont de quoi faire une partie. */
  sujets: readonly Sujet[]
  categories: readonly string[]
  /** Le sujet choisi : les catégories restent de côté, sans être oubliées. */
  sujet: string | null
  onCategories: (choisies: string[]) => void
  /** Toucher le sujet choisi le quitte : les catégories reviennent. */
  onSujet: (choisi: string | null) => void
}) {
  return (
    <>
      <GrilleDesCategories categoriesJouables={categoriesJouables} categories={categories} sujet={sujet} onCategories={onCategories} />
      <GrilleDesSujets sujets={sujets} sujet={sujet} onSujet={onSujet} />
    </>
  )
}

/**
 * La grille des catégories seule : le quiz tout prêt glisse ses réglages
 * entre elle et les sujets, qui font trois rangées de plus — dessous, la
 * difficulté se cherchait au fond de la feuille.
 */
export function GrilleDesCategories({
  categoriesJouables,
  categories,
  sujet,
  onCategories,
}: {
  categoriesJouables: readonly string[]
  categories: readonly string[]
  sujet: string | null
  onCategories: (choisies: string[]) => void
}) {
  // Sur un sujet, toucher une catégorie la choisit seule : la basculer retirerait celle qu'on ne voyait plus choisie.
  const basculer = (c: string) => onCategories(sujet ? [c] : categories.includes(c) ? categories.filter(x => x !== c) : [...categories, c])
  const toutes = !sujet && categories.length === 0
  return (
    <div className="categories-grille" role="group" aria-label="Catégories">
      <button type="button" className={'categorie-case' + (toutes ? ' active' : '')} aria-pressed={toutes} onClick={() => onCategories([])}>
        <Icon name="sparkles" />
        Toutes
      </button>
      {categoriesJouables.map(c => {
        const choisie = !sujet && categories.includes(c)
        return (
          <button key={c} type="button" className={'categorie-case' + (choisie ? ' active' : '')} aria-pressed={choisie} onClick={() => basculer(c)}>
            <Icon name={EMBLEME[c] ?? 'star'} />
            {c}
          </button>
        )
      })}
    </div>
  )
}

/** Les sujets, chaque famille sa rangée ; rien sans sujet jouable. */
export function GrilleDesSujets({ sujets, sujet, onSujet }: { sujets: readonly Sujet[]; sujet: string | null; onSujet: (choisi: string | null) => void }) {
  if (sujets.length === 0) return null
  const leSujet = sujet ? sujetParCle(sujet) : undefined
  return (
    <div className="campagne-sujets">
      <p className="sujets-titre">Ou un sujet, au-delà des catégories</p>
      {FAMILLES_DE_SUJETS.map(({ famille, nom }) => {
        const ici = sujets.filter(s => s.famille === famille)
        if (ici.length === 0) return null
        return (
          <div key={famille}>
            <p className="label">{nom}</p>
            <div className="categories-grille" role="group" aria-label={nom}>
              {ici.map(s => (
                <button
                  key={s.cle}
                  type="button"
                  className={'categorie-case' + (sujet === s.cle ? ' active' : '')}
                  aria-pressed={sujet === s.cle}
                  onClick={() => onSujet(sujet === s.cle ? null : s.cle)}
                >
                  <Icon name={iconeDuSujet(s)} />
                  {s.nom}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {leSujet && <p className="muted small">{espacesFines(leSujet.description)}</p>}
    </div>
  )
}
