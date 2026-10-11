// Le service worker de l'application installée, et rien d'autre que ses
// notifications (`server/src/core/rappels.ts`) — le rappel du soir du quiz du
// jour, le défi qu'un ami vient d'envoyer : il montre la notification que le
// serveur envoie, et ouvre sa page quand on la touche.
//
// Il ne garde rien en cache et n'intercepte aucune requête : l'application
// reste celle que le serveur sert, à jour à chaque ouverture. Écrit à la
// main, hors du paquet : un service worker garde son adresse (`/sw.js`), et
// c'est elle qui décide des pages qu'il couvre — toutes.

/** Ce que dit une notification arrivée sans message lisible : un push montre toujours quelque chose. */
const PAR_DEFAUT = { titre: 'Le quiz du jour t’attend', corps: 'Dix questions, jusqu’à minuit.', url: '/jour' }

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', evenement => evenement.waitUntil(self.clients.claim()))

self.addEventListener('push', evenement => {
  let message = PAR_DEFAUT
  try {
    message = { ...PAR_DEFAUT, ...(evenement.data ? evenement.data.json() : {}) }
  } catch {
    // Illisible : le texte par défaut.
  }
  evenement.waitUntil(
    self.registration.showNotification(message.titre, {
      body: message.corps,
      lang: 'fr',
      icon: '/icone-192.png',
      // Une seule à la fois par sujet : le rappel suivant remplace celui
      // qu'on n'a pas lu ; un défi a la sienne (`defi-K7M2QX`), qui ne chasse
      // ni le rappel ni le défi d'un autre ami.
      tag: typeof message.tag === 'string' && message.tag ? message.tag : 'quiz-du-jour',
      data: { url: message.url },
    }),
  )
})

self.addEventListener('notificationclick', evenement => {
  evenement.notification.close()
  const url = new URL((evenement.notification.data && evenement.notification.data.url) || '/jour', self.location.origin)
  evenement.waitUntil(ouvrir(url))
})

/**
 * La page de la notification si elle est déjà ouverte — menée à son adresse
 * exacte : la campagne ouverte sur la série va au défi reçu (`#duel-…`) —,
 * sinon l'application à cette page. Jamais une autre page de l'application
 * menée ailleurs : c'était peut-être une soirée en cours.
 */
async function ouvrir(url) {
  const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const deja = fenetres.find(f => new URL(f.url).pathname === url.pathname)
  if (!deja) return self.clients.openWindow(url.href)
  if (deja.url !== url.href && typeof deja.navigate === 'function') {
    // Une page que ce service worker ne tient pas refuse d'être menée : elle passe devant, telle quelle.
    const menee = await deja.navigate(url.href).catch(() => null)
    if (menee) return menee.focus()
  }
  return deja.focus()
}

// Le service de push a renouvelé l'abonnement (Firefox le fait) : le nouveau
// rejoint le serveur, avec la session de ce téléphone, que la requête porte,
// et l'adresse de l'ancien — il en garde les réglages : le soir, les défis.
self.addEventListener('pushsubscriptionchange', evenement => {
  evenement.waitUntil(
    (async () => {
      let nouvel = evenement.newSubscription
      if (!nouvel) {
        const ancienne = evenement.oldSubscription && evenement.oldSubscription.options.applicationServerKey
        const cle = ancienne || octets((await (await fetch('/api/jour/rappel', { credentials: 'same-origin' })).json()).cle)
        nouvel = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cle })
      }
      await fetch('/api/jour/rappel', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' },
        body: JSON.stringify({ abonnement: nouvel.toJSON(), ...(evenement.oldSubscription && { ancien: evenement.oldSubscription.endpoint }) }),
      })
    })().catch(() => {
      // Sans réseau, ou déconnecté : la page du jour le rattachera à la prochaine visite.
    }),
  )
})

/** La clé du serveur, de base64url en octets. */
function octets(texte) {
  const brut = atob(texte.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(brut, c => c.charCodeAt(0))
}
