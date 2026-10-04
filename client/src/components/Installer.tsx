import { useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  carteMasquee,
  estInstallee,
  installeeDepuisIci,
  installer,
  invitationOfferte,
  masquerLaCarte,
  suivreLInstallation,
  telephone,
  type Telephone,
} from '../installation'
import { Icon } from './Icon'
import { Onglets } from './Onglets'

/**
 * « FiestApp sur ton écran d'accueil », au pied de l'accueil d'un téléphone
 * (`client/src/installation.ts`) : une carte repliée — l'icône, une phrase —,
 * et « Comment faire ? » déplie les gestes de l'iPhone et ceux d'Android,
 * celui du téléphone d'abord, l'autre à un onglet — pour l'expliquer à
 * l'ami qui n'a pas le même. Sur Android, quand Chrome l'offre, un toucher
 * l'installe. Rien sur un ordinateur, rien dans l'application déjà
 * installée, et plus rien une fois masquée sur ce téléphone.
 */
export function Installer({ avecProfil = false }: { avecProfil?: boolean }) {
  const [ce] = useState(telephone)
  const [dejaInstallee] = useState(estInstallee)
  const [masquee, setMasquee] = useState(carteMasquee)
  const [ouverte, setOuverte] = useState(false)
  const [onglet, setOnglet] = useState<Telephone>(() => ce ?? 'iphone')
  const offerte = useSyncExternalStore(suivreLInstallation, invitationOfferte, () => false)
  // Installée pendant la visite : la carte n'a plus rien à proposer.
  const installeeIci = useSyncExternalStore(suivreLInstallation, installeeDepuisIci, () => false)
  if (!ce || dejaInstallee || masquee || installeeIci) return null
  return (
    <CarteDInstallation
      telephone={ce}
      onglet={onglet}
      ouverte={ouverte}
      offerte={offerte}
      avecProfil={avecProfil}
      onBasculer={() => setOuverte(o => !o)}
      onOnglet={setOnglet}
      onInstaller={() => void installer()}
      onMasquer={() => {
        masquerLaCarte()
        setMasquee(true)
      }}
    />
  )
}

const ONGLETS: { id: Telephone; nom: string }[] = [
  { id: 'iphone', nom: 'iPhone' },
  { id: 'android', nom: 'Android' },
]

/** La carte telle qu'on la voit : rendue seule dans les épreuves. */
export function CarteDInstallation({
  telephone,
  onglet,
  ouverte,
  offerte,
  avecProfil,
  onBasculer,
  onOnglet,
  onInstaller,
  onMasquer,
}: {
  telephone: Telephone
  onglet: Telephone
  ouverte: boolean
  /** Chrome a offert d'installer : un toucher suffit. */
  offerte: boolean
  avecProfil: boolean
  onBasculer: () => void
  onOnglet: (t: Telephone) => void
  onInstaller: () => void
  onMasquer: () => void
}) {
  return (
    <section className="card installer" aria-label="Installer l’application">
      <div className="installer-tete">
        {/* L'icône même qui rejoindra l'écran d'accueil : on la reconnaîtra. */}
        <img className="installer-icone" src="/icone.svg" alt="" width={44} height={44} />
        <p className="installer-titre">FiestApp sur ton écran d’accueil</p>
        <button type="button" className="installer-fermer" aria-label="Masquer cette carte" onClick={onMasquer}>
          <Icon name="x" />
        </button>
      </div>
      {/* Sur toute la largeur : à côté de l'icône, la phrase tenait sur cinq lignes en 360 px. */}
      <p className="installer-pourquoi muted small">
        Sans passer par un store : elle s’ouvre d’un toucher, en plein écran, comme une vraie appli.
        {avecProfil && ' Et elle peut te rappeler le quiz du jour, le soir.'}
      </p>
      {telephone === 'android' && offerte && (
        <button type="button" className="btn btn-accent btn-block" onClick={onInstaller}>
          <Icon name="download" />
          Installer l’application
        </button>
      )}
      <button
        type="button"
        className="link-inline installer-comment"
        aria-expanded={ouverte}
        aria-controls={ouverte ? 'installer-gestes' : undefined}
        onClick={onBasculer}
      >
        Comment faire ?
        <Icon name="chevron-down" />
      </button>
      {ouverte && (
        <div id="installer-gestes" className="installer-gestes">
          <Onglets
            onglets={ONGLETS}
            actif={onglet}
            onChoisir={onOnglet}
            label="Ton téléphone"
            idOnglet={id => `installer-onglet-${id}`}
            idPanneau={id => `installer-panneau-${id}`}
          />
          <div role="tabpanel" id={`installer-panneau-${onglet}`} aria-labelledby={`installer-onglet-${onglet}`}>
            {onglet === 'iphone' ? <GestesIphone /> : <GestesAndroid />}
          </div>
        </div>
      )}
    </section>
  )
}

/** Une étape : son numéro en pastille — la liste numérotée le dit déjà à l'oreille. */
function Etape({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li>
      <span className="installer-numero" aria-hidden="true">
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}

/** L'iPhone ne propose rien de lui-même : tout passe par « Partager », dans Safari. */
function GestesIphone() {
  return (
    <>
      <ol className="installer-etapes">
        <Etape n={1}>
          Ouvre cette page dans <b>Safari</b>.
        </Etape>
        <Etape n={2}>
          Touche <b>Partager</b> <Icon name="share-ios" />, en bas de l’écran — en haut sur iPad.
        </Etape>
        <Etape n={3}>
          Choisis <b>Sur l’écran d’accueil</b> <Icon name="plus-square" />, puis <b>Ajouter</b>.
        </Etape>
      </ol>
      <p className="muted small">
        Ouverte depuis Instagram, WhatsApp ou Messenger, la page ne s’installe pas : passe d’abord par « Ouvrir dans Safari ».
      </p>
    </>
  )
}

function GestesAndroid() {
  return (
    <>
      <ol className="installer-etapes">
        <Etape n={1}>
          Ouvre cette page dans <b>Chrome</b>.
        </Etape>
        <Etape n={2}>
          Touche le menu <Icon name="more-vertical" />, en haut à droite.
        </Etape>
        <Etape n={3}>
          Choisis <b>Installer l’application</b> — ou <b>Ajouter à l’écran d’accueil</b>.
        </Etape>
      </ol>
      <p className="muted small">
        Sur Samsung Internet : le menu ≡, en bas, puis <b>Ajouter la page à</b> › <b>Écran d’accueil</b>.
      </p>
    </>
  )
}
