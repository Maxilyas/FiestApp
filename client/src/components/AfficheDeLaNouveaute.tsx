import { aLaDemande, useALaDemande } from '../aLaDemande'
import { Icon } from './Icon'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { DESTINATIONS, PASTILLE_NOUVEAU, type AfficheDAccueil } from '../../../shared/affiches'

/**
 * Ce que l'affiche montre au-dessus de son titre — les gardiens peints du
 * Cabinet —, à la demande : l'accueil anonyme, qui partage la page, n'en
 * télécharge rien, et l'accueil d'un profil seulement quand une affiche s'y
 * montre. Sa scène garde sa place en attendant : rien ne saute dessous.
 */
const visuels = aLaDemande(() => import('./VisuelsDesAffiches'))

/** « +50 confettis à ta première visite » : un nombre ne quitte pas son mot à la ligne. */
const cadeauDeLaVisite = (n: number) => `+${formatNumber(n)} confetti${n > 1 ? 's' : ''} à ta première visite`

/**
 * L'affiche d'une nouveauté, en haut de l'accueil d'un profil
 * (`shared/affiches.ts` ; le souhait du propriétaire du 1er novembre 2026 :
 * « un bandeau super joli » pour ce qui sort, à commencer par le Cabinet de
 * curiosités) : une scène peinte, « Nouveau », son titre et sa phrase, ce que
 * la première visite rapporte, et deux gestes — y aller, ou « Plus tard », qui
 * la range sur tous ses appareils ; la pastille de son gros bouton, elle,
 * reste jusqu'à la visite.
 *
 * Nocturne et dorée sous tous les thèmes, comme « À la une » : une affiche à
 * elle, que le décor d'un thème ne repeint pas. Sans `onRanger`, l'aperçu du
 * QG (`QgAffiches`) : rien ne s'y touche, rien ne mène nulle part.
 */
export function AfficheDeLaNouveaute({
  affiche,
  onRanger,
}: {
  affiche: Pick<AfficheDAccueil, 'id' | 'page' | 'titre' | 'phrase' | 'confettis'>
  onRanger?: () => void
}) {
  const destination = DESTINATIONS[affiche.page]
  const lesVisuels = useALaDemande(visuels)
  const titre = `affiche-titre-${affiche.id}`
  // Ce que la première visite rapporte se dit sous le bouton qui y mène, dans le bouton même : une ligne à part grandissait
  // l'affiche d'une rangée, et la récompense se lit avec le geste qui la donne.
  const aller = (
    <span className="affiche-aller-texte">
      <span className="affiche-aller-ligne">
        {destination.bouton}
        <Icon name="arrow-right" />
      </span>
      {affiche.confettis > 0 && <span className="affiche-cadeau">{espacesFines(cadeauDeLaVisite(affiche.confettis))}</span>}
    </span>
  )
  return (
    <section className={`affiche affiche-${affiche.page}`} aria-labelledby={titre}>
      <div className="affiche-scene" aria-hidden="true">
        {lesVisuels && lesVisuels !== 'perdu' && <lesVisuels.VisuelDeLAffiche page={affiche.page} />}
      </div>
      <p className="affiche-sur">
        <Icon name="sparkles" />
        {PASTILLE_NOUVEAU}
      </p>
      <h2 className="affiche-titre" id={titre}>
        {espacesFines(affiche.titre)}
      </h2>
      <p className="affiche-phrase">{espacesFines(affiche.phrase)}</p>
      <div className="affiche-gestes">
        {onRanger ? (
          <>
            <a className="affiche-aller" href={destination.chemin}>
              {aller}
            </a>
            <button type="button" className="affiche-plus-tard" onClick={onRanger}>
              Plus tard
            </button>
          </>
        ) : (
          <>
            <span className="affiche-aller">{aller}</span>
            <span className="affiche-plus-tard">Plus tard</span>
          </>
        )}
      </div>
    </section>
  )
}

/** La pastille « Nouveau » du gros bouton d'une page à l'affiche : ses étincelles luisent, pas son fond — le texte reste lisible sous tous les thèmes. */
export function PastilleNouveau() {
  return (
    <span className="pastille-nouveaute">
      <Icon name="sparkles" />
      {PASTILLE_NOUVEAU}
    </span>
  )
}
