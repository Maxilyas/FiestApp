import { useEffect, useState, useSyncExternalStore } from 'react'

/** Au-delà, « Connexion… » tout seul n'est plus une attente, c'est une impasse. */
const PATIENCE_MS = 10_000

/**
 * L'écran d'avant la soirée, le temps que le serveur réponde.
 *
 * « Connexion… » sans rien d'autre pouvait durer toujours : un invité dans le
 * noir ne savait ni si ça venait, ni quoi faire. Passé dix secondes, on le
 * lui dit — et on lui donne le seul geste qui répare à coup sûr.
 */
export function AttenteConnexion() {
  const [longue, setLongue] = useState(false)
  useEffect(() => {
    const minuteur = setTimeout(() => setLongue(true), PATIENCE_MS)
    return () => clearTimeout(minuteur)
  }, [])
  return (
    <div className="center-page">
      <div className="attente" role="status">
        <p className="serif-note">Connexion…</p>
        {longue && (
          <>
            <p className="muted small">Ça traîne — vérifie ton wifi ou ta 4G.</p>
            <button type="button" className="btn btn-small" onClick={() => window.location.reload()}>
              Recharger la page
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function suivreReseau(prevenir: () => void) {
  window.addEventListener('online', prevenir)
  window.addEventListener('offline', prevenir)
  return () => {
    window.removeEventListener('online', prevenir)
    window.removeEventListener('offline', prevenir)
  }
}

/**
 * Le navigateur se sait-il hors ligne ? Wifi coupé, mode avion : il le sait
 * sur-le-champ, alors que socket.io attend un battement de cœur manqué — dix-
 * huit secondes — pour s'en apercevoir. `true` ne prouve rien (un wifi sans
 * internet se dit « en ligne ») ; `false`, si.
 */
export function useEnLigne(): boolean {
  return useSyncExternalStore(suivreReseau, () => navigator.onLine)
}

/**
 * La liaison perdue, dite en haut de l'écran pendant le quiz.
 *
 * La pastille « reconnexion… » n'existait qu'en salle d'attente : en pleine
 * question, un téléphone tombé du wifi ne montrait rien, et son porteur
 * tapait des réponses qui ne partaient pas. Le bandeau se pose dans la marge
 * haute, hors du flux : il ne pousse rien — une réponse ne doit jamais
 * glisser sous le doigt parce qu'un message vient d'apparaître.
 */
export function BandeauCoupure({ connecte }: { connecte: boolean }) {
  const enLigne = useEnLigne()
  if (connecte && enLigne) return null
  // `alert` plutôt que `status` : inséré d'un coup, il est annoncé à coup sûr
  // — et tant qu'il est là, rien de ce qu'on touche ne quitte le téléphone.
  return (
    <p className="bandeau bandeau-coupure" role="alert">
      Connexion perdue — reconnexion…
    </p>
  )
}

/**
 * Le conseil du wifi local.
 *
 * Garder l'écran allumé demande HTTPS (`navigator.wakeLock`) : sur
 * `http://192.168…`, et sur les navigateurs qui ne savent pas le faire, les
 * téléphones s'endormaient en pleine question sans rien dire. On ne peut pas
 * l'empêcher ; on peut le dire, discrètement, là où l'on regarde.
 */
export function ConseilVeille() {
  if ('wakeLock' in navigator) return null
  return <p className="bandeau bandeau-veille">Garde ton écran allumé pendant le quiz</p>
}
