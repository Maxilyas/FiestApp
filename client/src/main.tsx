import React from 'react'
import ReactDOM from 'react-dom/client'
import { PlayerApp } from './views/PlayerApp'
import { HostApp } from './views/HostApp'
import { EditorApp } from './views/EditorApp'
import './styles.css'

// Trois routes statiques : pas besoin d'un routeur.
//   /       téléphone des invités
//   /host   écran commun (TV)
//   /edit   espace animateur : la bibliothèque de quiz
const path = window.location.pathname
const App = path.startsWith('/host') ? HostApp : path.startsWith('/edit') ? EditorApp : PlayerApp

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
