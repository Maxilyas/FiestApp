import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { DialogHost } from './components/Dialog'
import { applyTheme } from './theme'
import { route, type AccountPage, type PublicPage } from './routes'
import './styles.css'

// Les adresses (client/src/routes.ts) :
//   /                 l'accueil : mon profil, et de quoi animer ou rejoindre
//   /<espace>         le téléphone des invités
//   /host             l'écran commun (TV) de l'animateur connecté
//   /edit             sa bibliothèque de quiz
//   /connexion, /activer, /compte, /admin : son compte
//   /profil           le profil d'un joueur récurrent (pas un compte d'animateur)
//   /<espace>/souvenir, /bilan, /soirees : les pages publiques de la soirée
//   (/<espace>/stats ouvre le souvenir sur ses chiffres)
//   /<espace>/soirees/<id>/… : les mêmes pages, tournées vers une soirée archivée
//
// Chaque route est un paquet à part : les téléphones n'ont pas à télécharger
// l'éditeur, l'écran commun ni la bibliothèque de QR codes pour répondre à
// un quiz en 4G.
const PlayerApp = lazy(() => import('./views/PlayerApp').then(m => ({ default: m.PlayerApp })))
const HostApp = lazy(() => import('./views/HostApp').then(m => ({ default: m.HostApp })))
const EditorApp = lazy(() => import('./views/EditorApp').then(m => ({ default: m.EditorApp })))
const RecapApp = lazy(() => import('./views/RecapApp').then(m => ({ default: m.RecapApp })))
const BilanApp = lazy(() => import('./views/BilanApp').then(m => ({ default: m.BilanApp })))
const ArchivesApp = lazy(() => import('./views/ArchivesApp').then(m => ({ default: m.ArchivesApp })))
const LoginApp = lazy(() => import('./views/LoginApp').then(m => ({ default: m.LoginApp })))
const ActivateApp = lazy(() => import('./views/ActivateApp').then(m => ({ default: m.ActivateApp })))
const AccountApp = lazy(() => import('./views/AccountApp').then(m => ({ default: m.AccountApp })))
const AdminApp = lazy(() => import('./views/AdminApp').then(m => ({ default: m.AdminApp })))
const LandingApp = lazy(() => import('./views/LandingApp').then(m => ({ default: m.LandingApp })))
const ProfilApp = lazy(() => import('./views/ProfilApp').then(m => ({ default: m.ProfilApp })))

const ACCOUNT: Record<AccountPage, typeof HostApp> = {
  host: HostApp,
  edit: EditorApp,
  connexion: LoginApp,
  activer: ActivateApp,
  compte: AccountApp,
  admin: AdminApp,
  profil: ProfilApp,
}
const PUBLIC: Record<PublicPage, typeof RecapApp> = {
  souvenir: RecapApp,
  stats: RecapApp,
  bilan: BilanApp,
  'bilan/fiches': BilanApp,
  soirees: ArchivesApp,
}

// L'accueil et `/profil` sont la même page : on se connecte avec son profil,
// et c'est de là qu'on anime sa soirée ou qu'on en rejoint une. `LandingApp`
// ne sert plus qu'aux adresses qui ne mènent nulle part.
const App =
  route.kind === 'account'
    ? ACCOUNT[route.page]
    : route.kind === 'join'
      ? PlayerApp
      : route.kind === 'public'
        ? PUBLIC[route.page]
        : route.kind === 'landing'
          ? ProfilApp
          : LandingApp

// L'écran commun se projette parfois sur fond clair (mode « Ivoire ») : le
// choix est posé avant le premier rendu, pour que le noir ne clignote pas au
// chargement. Les autres pages — les téléphones surtout — restent en Velours.
if (App === HostApp) applyTheme()

/**
 * Le bandeau d'environnement.
 *
 * Le serveur pose `<meta name="app-env">` dans la page hors production. Deux
 * onglets sur deux instances sont indiscernables autrement — et se tromper
 * coûte cher des deux côtés : projeter la préproduction un soir de fête, ou
 * écrire ses quiz dans une base qui sera effacée. En production, la balise
 * est absente et il ne se passe rien.
 */
const appEnv = document.querySelector('meta[name="app-env"]')?.getAttribute('content')
if (appEnv) {
  const badge = document.createElement('div')
  badge.className = 'env-badge'
  badge.textContent = appEnv
  document.body.appendChild(badge)

  // Le préfixe dans l'onglet, pour distinguer deux fenêtres côte à côte. Il se
  // repose à chaque fois que le titre change : les pages le réécrivent avec le
  // nom de la soirée une fois l'instantané reçu, et un préfixe posé une seule
  // fois au démarrage serait aussitôt effacé.
  const marque = `[${appEnv}] `
  const prefixer = () => {
    if (!document.title.startsWith(marque)) document.title = marque + document.title
  }
  prefixer()
  const titre = document.querySelector('title')
  if (titre) new MutationObserver(prefixer).observe(titre, { childList: true })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense
      fallback={
        <div className="center-page">
          <p className="muted">Chargement…</p>
        </div>
      }
    >
      <App />
    </Suspense>
    <DialogHost />
  </React.StrictMode>,
)
