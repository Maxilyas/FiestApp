import React from 'react'
import ReactDOM from 'react-dom/client'
import { PlayerApp } from './views/PlayerApp'
import { HostApp } from './views/HostApp'
import { EditorApp } from './views/EditorApp'
import { RecapApp } from './views/RecapApp'
import './styles.css'

// Quatre routes statiques : pas besoin d'un routeur.
//   /          téléphone des invités
//   /host      écran commun (TV)
//   /edit      espace animateur : la bibliothèque de quiz
//   /souvenir  la page à relire le lendemain, sans clé
const path = window.location.pathname
const App = path.startsWith('/host')
  ? HostApp
  : path.startsWith('/edit')
    ? EditorApp
    : path.startsWith('/souvenir')
      ? RecapApp
      : PlayerApp

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
