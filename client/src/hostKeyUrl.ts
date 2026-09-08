/**
 * La clé animateur arrive par l'adresse, en fragment : `/host#key=…`.
 *
 * Le fragment ne quitte jamais le navigateur — il n'est ni envoyé au serveur,
 * ni écrit dans ses journaux d'accès. L'ancienne forme `?key=…` reste lue pour
 * les adresses déjà notées quelque part. Dans les deux cas, la clé est retirée
 * de la barre d'adresse aussitôt lue : sur un vidéoprojecteur, elle se lit
 * depuis le fond de la salle.
 */
export function readKeyFromUrl(): string | null {
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('key')
  const fromQuery = new URLSearchParams(window.location.search).get('key')
  const key = fromHash ?? fromQuery
  if (key) window.history.replaceState({}, '', window.location.pathname)
  return key
}
