import { useSyncExternalStore } from 'react'
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

/**
 * « +50 confettis », puis « à ta première visite » : en deux temps — couchée en bandeau, l'affiche ne montre sur la ligne
 * de son geste que ce qui y tient entier (`.affiche-bandeau .affiche-aller-texte`), et la phrase reste une phrase pour
 * qui l'écoute. Un nombre ne quitte pas son mot à la ligne.
 */
const confettisDeLaVisite = (n: number) => `+${formatNumber(n)} confetti${n > 1 ? 's' : ''}`

/**
 * Sur un écran de moins de 940 px de haut, ou de moins de 600 de large — tous les téléphones —, l'affiche se couche en
 * bandeau à la place d'« À la une » : en grand, elle faisait défiler l'accueil de 179 px en 360 × 640 et de 67 en
 * 390 × 844, le dernier cas où un téléphone d'aujourd'hui défilait encore (le relevé du 9 novembre 2026 ; le
 * propriétaire, le 10 : « applique aussi tes recommandations »). Au-delà — une tablette debout, un grand écran
 * d'ordinateur —, elle a sa place entière : 132 px de reste en 768 × 1024 (`rendu-accueil.ts`).
 */
const ECRAN_COURT = '(max-height: 939px), (max-width: 599px)'
const ecranCourt = () => typeof window !== 'undefined' && !!window.matchMedia?.(ECRAN_COURT).matches
function suivreLEcran(change: () => void) {
  const media = typeof window !== 'undefined' ? window.matchMedia?.(ECRAN_COURT) : undefined
  media?.addEventListener?.('change', change)
  return () => media?.removeEventListener?.('change', change)
}

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
 *
 * Deux formes, les mêmes mots et le même lien (`forme`) : l'affiche, en grand,
 * et le bandeau — couchée sur une rangée, sa scène et « Nouveau » à gauche, son
 * titre et son geste à droite, sa phrase encore lue à l'oreille. Sans `forme`,
 * l'écran choisit (`ECRAN_COURT`) ; l'aperçu du QG montre l'une et l'autre.
 */
export function AfficheDeLaNouveaute({
  affiche,
  onRanger,
  forme,
}: {
  affiche: Pick<AfficheDAccueil, 'id' | 'page' | 'titre' | 'phrase' | 'confettis'>
  onRanger?: () => void
  forme?: 'affiche' | 'bandeau'
}) {
  const destination = DESTINATIONS[affiche.page]
  const lesVisuels = useALaDemande(visuels)
  const court = useSyncExternalStore(suivreLEcran, ecranCourt, () => false)
  const enBandeau = forme ? forme === 'bandeau' : court
  const titre = `affiche-titre-${affiche.id}`
  // Ce que la première visite rapporte se dit sous le bouton qui y mène, dans le bouton même : une ligne à part grandissait
  // l'affiche d'une rangée, et la récompense se lit avec le geste qui la donne.
  const aller = (
    <span className="affiche-aller-texte">
      <span className="affiche-aller-ligne">
        {destination.bouton}
        <Icon name="arrow-right" />
      </span>
      {affiche.confettis > 0 && (
        <span className="affiche-cadeau">
          <span className="affiche-cadeau-combien">{confettisDeLaVisite(affiche.confettis)}</span>
          <span className="affiche-cadeau-quand"> à ta première visite</span>
        </span>
      )}
    </span>
  )
  return (
    <section className={`affiche affiche-${affiche.page}${enBandeau ? ' affiche-bandeau' : ''}`} aria-labelledby={titre}>
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
