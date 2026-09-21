import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { DialogHost } from './components/Dialog'
import { applyTheme } from './theme'
import { route, type AccountPage, type PublicPage } from './routes'
import './styles.css'

// Les adresses (client/src/routes.ts) :
//   /                 l'accueil : « quelle soirée ? »
//   /<espace>         le téléphone des invités
//   /host             l'écran commun (TV) de l'animateur connecté
//   /edit             sa bibliothèque de quiz
//   /connexion, /activer, /compte, /admin : son compte
//   /<espace>/stats, /souvenir, /bilan, /soirees : les pages publiques de la soirée
//   /<espace>/soirees/<id>/… : les mêmes pages, tournées vers une soirée archivée
//
// Chaque route est un paquet à part : les téléphones n'ont pas à télécharger
// l'éditeur, l'écran commun ni la bibliothèque de QR codes pour répondre à
// un quiz en 4G.
const PlayerApp = lazy(() => import('./views/PlayerApp').then(m => ({ default: m.PlayerApp })))
const HostApp = lazy(() => import('./views/HostApp').then(m => ({ default: m.HostApp })))
const EditorApp = lazy(() => import('./views/EditorApp').then(m => ({ default: m.EditorApp })))
const StatsApp = lazy(() => import('./views/StatsApp').then(m => ({ default: m.StatsApp })))
const RecapApp = lazy(() => import('./views/RecapApp').then(m => ({ default: m.RecapApp })))
const BilanApp = lazy(() => import('./views/BilanApp').then(m => ({ default: m.BilanApp })))
const ArchivesApp = lazy(() => import('./views/ArchivesApp').then(m => ({ default: m.ArchivesApp })))
const LoginApp = lazy(() => import('./views/LoginApp').then(m => ({ default: m.LoginApp })))
const ActivateApp = lazy(() => import('./views/ActivateApp').then(m => ({ default: m.ActivateApp })))
const AccountApp = lazy(() => import('./views/AccountApp').then(m => ({ default: m.AccountApp })))
const AdminApp = lazy(() => import('./views/AdminApp').then(m => ({ default: m.AdminApp })))
const LandingApp = lazy(() => import('./views/LandingApp').then(m => ({ default: m.LandingApp })))

const ACCOUNT: Record<AccountPage, typeof HostApp> = {
  host: HostApp,
  edit: EditorApp,
  connexion: LoginApp,
  activer: ActivateApp,
  compte: AccountApp,
  admin: AdminApp,
}
const PUBLIC: Record<PublicPage, typeof RecapApp> = {
  souvenir: RecapApp,
  stats: StatsApp,
  bilan: BilanApp,
  'bilan/fiches': BilanApp,
  soirees: ArchivesApp,
}

const App =
  route.kind === 'account'
    ? ACCOUNT[route.page]
    : route.kind === 'join'
      ? PlayerApp
      : route.kind === 'public'
        ? PUBLIC[route.page]
        : LandingApp

// L'écran commun se projette parfois sur fond clair (mode « Ivoire ») : le
// choix est posé avant le premier rendu, pour que le noir ne clignote pas au
// chargement. Les autres pages — les téléphones surtout — restent en Velours.
if (App === HostApp) applyTheme()

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
