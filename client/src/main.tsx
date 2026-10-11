import React, { Component, Suspense, type ComponentType, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { DialogHost } from './components/Dialog'
import { applyTheme } from './theme'
import { confirmerTheme, poserThemeRetenu } from './themeJoueur'
import { installerClavier } from './clavier'
import { ecouterLInstallation } from './installation'
import { Patience } from './annonce'
import { route, type AccountPage, type PublicPage } from './routes'
import { donneesDuFragment } from '../../shared/depart'
import { titreDePage } from './titres'
import './styles.css'

// Les adresses (client/src/routes.ts) :
//   /                 l'accueil : mon profil, et de quoi animer ou rejoindre
//   /<espace>         le téléphone des invités
//   /host             l'écran commun (TV) de l'animateur connecté
//   /edit             sa bibliothèque de quiz
//   /connexion, /activer, /compte, /admin : son compte
//   /profil           le profil d'un joueur récurrent (pas un compte d'animateur)
//   /jour             le quiz du jour, pour les profils
//   /<espace>/souvenir, /bilan, /soirees : les pages publiques de la soirée
//   (/<espace>/stats ouvre le souvenir sur ses chiffres)
//   /<espace>/soirees/<id>/… : les mêmes pages, tournées vers une soirée archivée
//
// Chaque route est un paquet à part : les téléphones n'ont pas à télécharger
// l'éditeur, l'écran commun ni la bibliothèque de QR codes pour répondre à
// un quiz en 4G.
//
// Son code se charge avant le premier rendu, sans `lazy` : une route
// paresseuse suspendait, React posait son attente, puis retenait la page au
// moins trois dixièmes de seconde après elle (`aLaDemande.ts`) — même son
// code déjà en cache, au retour d'un joueur. L'attente que le serveur écrit
// dans la page (`ecrireAttente`) reste à l'écran jusqu'à la page elle-même.
const PlayerApp = () => import('./views/PlayerApp').then(m => m.PlayerApp)
const HostApp = () => import('./views/HostApp').then(m => m.HostApp)
const EditorApp = () => import('./views/EditorApp').then(m => m.EditorApp)
const RecapApp = () => import('./views/RecapApp').then(m => m.RecapApp)
const BilanApp = () => import('./views/BilanApp').then(m => m.BilanApp)
const ArchivesApp = () => import('./views/ArchivesApp').then(m => m.ArchivesApp)
const LoginApp = () => import('./views/LoginApp').then(m => m.LoginApp)
const ActivateApp = () => import('./views/ActivateApp').then(m => m.ActivateApp)
const AccountApp = () => import('./views/AccountApp').then(m => m.AccountApp)
const AdminApp = () => import('./views/AdminApp').then(m => m.AdminApp)
const LandingApp = () => import('./views/LandingApp').then(m => m.LandingApp)
const ProfilApp = () => import('./views/ProfilApp').then(m => m.ProfilApp)
const JourApp = () => import('./views/JourApp').then(m => m.JourApp)
// Les duels (`/duels`) jouent leurs parties sur l'écran de la campagne : sur
// leur page, son code et le leur partent ensemble, plutôt que l'un derrière
// l'autre — et la campagne seule ne télécharge jamais le leur. La page attend
// le leur par la porte même qu'elle lit (`chargerLesDuels`) : arrivé par une
// autre, il lui manquait parfois au premier rendu, qui montrait « Chargement… ».
const CampagneApp = () => {
  const duels = route.kind === 'account' && route.page === 'duels'
  if (duels) void import('./views/Duels').catch(() => {})
  return import('./views/CampagneApp').then(async m => {
    if (duels) await m.chargerLesDuels().catch(() => {})
    return m.CampagneApp
  })
}
const SalonApp = () => import('./views/SalonApp').then(m => m.SalonApp)

/** Une page, à charger : son code vient à part. */
type PageACharger = () => Promise<ComponentType>

const ACCOUNT: Record<AccountPage, PageACharger> = {
  host: HostApp,
  edit: EditorApp,
  connexion: LoginApp,
  activer: ActivateApp,
  compte: AccountApp,
  admin: AdminApp,
  profil: ProfilApp,
  jour: JourApp,
  salon: SalonApp,
  // La télé ouvre l'écran commun : sans session, il affiche le code qui la branche.
  tele: HostApp,
  // L'accueil, le profil et la boutique sont la même page, qui lit son adresse.
  boutique: ProfilApp,
  campagne: CampagneApp,
  duels: CampagneApp,
}
const PUBLIC: Record<PublicPage, PageACharger> = {
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
// Demandé d'emblée : le code de la page part avant tout le reste du démarrage.
const code = App()

/**
 * Le repère principal, pour qui saute de région en région au lecteur
 * d'écran. Les pages qui ont un en-tête, une navigation ou une console le
 * posent elles-mêmes autour de leur contenu : posé sur la racine, il
 * effaçait leurs « banner » et « contentinfo » — la console de l'écran
 * commun n'était plus qu'un « main » — et « aller au contenu » tombait sur le
 * titre. Les autres pages, l'entrée, les formulaires et le téléphone, sont
 * tout entières contenu : un `<main>` les enveloppe, sans rien changer à
 * leurs hauteurs, qui se comptent en `vh`.
 */
const REPERE_PROPRE = new Set<unknown>([HostApp, EditorApp, AccountApp, AdminApp, ArchivesApp, RecapApp, BilanApp])
const Page = ({ Vue }: { Vue: ComponentType }) =>
  REPERE_PROPRE.has(App) ? (
    <Vue />
  ) : (
    <main>
      <Vue />
    </main>
  )

// Un nom d'onglet dès le premier rendu, avant le préfixe d'environnement.
if (route.kind === 'account') document.title = titreDePage(route.page)
// Une adresse qui ne mène nulle part le dit aussi dans son onglet.
else if (route.kind === 'unknown') document.title = 'Adresse introuvable · FiestApp'

/**
 * Les pages qui lisent déjà le profil : elles en portent le thème elles-mêmes
 * (`porterTheme`), sans le redemander. La soirée en tête — toute la salle y
 * arrive d'un coup.
 */
const LISENT_LE_PROFIL = new Set<unknown>([PlayerApp, ProfilApp, JourApp, CampagneApp, SalonApp])

// L'écran commun se projette parfois sur fond clair (mode « Ivoire ») : le
// choix est posé avant le premier rendu, pour que le noir ne clignote pas au
// chargement. Toutes les autres pages — l'accueil, ses quiz, son compte, son
// salon, la soirée, le quiz du jour, le souvenir et le bilan… — portent le
// thème du profil connecté ici : celui qu'il portait la dernière fois, dès le
// démarrage (`themeJoueur.ts`), puis celui que dit le serveur. Les fiches du
// bilan s'impriment en Ivoire (`BilanApp`).
if (App === HostApp) applyTheme()
else if (!(route.kind === 'public' && route.page === 'bilan/fiches')) {
  poserThemeRetenu()
  if (!LISENT_LE_PROFIL.has(App)) void confirmerTheme()
}

// Ce que le serveur n'a pas pu précharger avec la page : le fragment de
// l'adresse (`#sentiers`) ne lui parvient pas. Demandé d'ici, il part avant
// que le code de la page n'arrive pour le demander, et son `fetch` reprend
// la réponse (`donneesDuFragment`, `shared/depart.ts`).
for (const adresse of donneesDuFragment(route, window.location.hash)) {
  const lien = document.createElement('link')
  lien.rel = 'preload'
  lien.as = 'fetch'
  lien.href = adresse
  lien.crossOrigin = 'anonymous'
  document.head.append(lien)
}

// Les écrans d'entrée ancrent leur bouton en bas de page : le clavier d'un
// téléphone le cachait. L'écran commun n'a pas de clavier qui monte.
if (App !== HostApp) installerClavier()

// L'invitation de Chrome à installer l'application arrive tôt, souvent avant
// l'accueil, et ne revient pas : gardée dès le démarrage, elle attend la
// carte de l'accueil (`installation.ts`) — et ne surgit plus d'elle-même en
// bas d'un téléphone, en pleine question. L'écran commun n'a rien à installer.
if (App !== HostApp) ecouterLInstallation()

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

/**
 * Le filet : une erreur de rendu, et React démonte la page entière. L'invité
 * restait devant un écran noir, sans un mot et sans bouton — il a suffi d'un
 * stockage refusé au chargement d'un module pour que la page de jeu y passe.
 * Recharger est presque toujours le bon remède, y compris pour un paquet de
 * code disparu après un déploiement : c'est donc la seule chose qu'on propose,
 * et toute la page y mène.
 */
class Filet extends Component<{ children: ReactNode }, { panne: boolean }> {
  state = { panne: false }

  static getDerivedStateFromError() {
    return { panne: true }
  }

  componentDidCatch(erreur: unknown) {
    console.error(erreur)
  }

  render() {
    if (!this.state.panne) return this.props.children
    return (
      <button type="button" className="filet" onClick={() => window.location.reload()}>
        <span className="filet-titre">Oups</span>
        {/* « Oups » seul ne disait pas l'essentiel à qui a une soirée en cours :
            sa place et ses points sont au serveur, pas dans la page. */}
        <span className="muted">Un souci d’affichage — rien n’est perdu.</span>
        <span className="btn btn-primary btn-big">Touche pour recharger</span>
      </button>
    )
  }
}

/** Un code qui ne viendra pas tombe dans le filet, comme sous `lazy`. */
const Perdu = ({ erreur }: { erreur: unknown }): ReactNode => {
  throw erreur
}

const racine = ReactDOM.createRoot(document.getElementById('root')!)
const rendre = (page: ReactNode) =>
  racine.render(
    <React.StrictMode>
      <Filet>
        {/* Rien n'y suspend plus : le filet d'une page qui suspendrait un jour. */}
        <Suspense fallback={<Patience texte={<p className="muted">Chargement…</p>} />}>{page}</Suspense>
        <DialogHost />
      </Filet>
    </React.StrictMode>,
  )
// Le premier rendu est la page même : React n'a pas d'attente à retenir.
code.then(
  Vue => rendre(<Page Vue={Vue} />),
  (erreur: unknown) => rendre(<Perdu erreur={erreur} />),
)
