import React from 'react'
import ReactDOM from 'react-dom/client'
import { PlayerApp } from './views/PlayerApp'
import { HostApp } from './views/HostApp'
import './styles.css'

// Deux routes statiques : pas besoin d'un routeur.
const isHost = window.location.pathname.startsWith('/host')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isHost ? <HostApp /> : <PlayerApp />}</React.StrictMode>,
)
