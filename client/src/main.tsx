import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { DialogHost } from './components/Dialog'
import './styles.css'

// Cinq routes statiques : pas besoin d'un routeur.
//   /          téléphone des invités
//   /host      écran commun (TV)
//   /edit      espace animateur : la bibliothèque de quiz
//   /stats     les chiffres, à consulter sur son téléphone pendant la fête
//   /souvenir  la page à relire le lendemain, sans clé
//
// Chaque route est un paquet à part : les téléphones n'ont pas à télécharger
// l'éditeur, l'écran commun ni la bibliothèque de QR codes pour répondre à
// un quiz en 4G.
const PlayerApp = lazy(() => import('./views/PlayerApp').then(m => ({ default: m.PlayerApp })))
const HostApp = lazy(() => import('./views/HostApp').then(m => ({ default: m.HostApp })))
const EditorApp = lazy(() => import('./views/EditorApp').then(m => ({ default: m.EditorApp })))
const StatsApp = lazy(() => import('./views/StatsApp').then(m => ({ default: m.StatsApp })))
const RecapApp = lazy(() => import('./views/RecapApp').then(m => ({ default: m.RecapApp })))

const path = window.location.pathname
const App = path.startsWith('/host')
  ? HostApp
  : path.startsWith('/edit')
    ? EditorApp
    : path.startsWith('/stats')
      ? StatsApp
      : path.startsWith('/souvenir')
        ? RecapApp
        : PlayerApp

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
