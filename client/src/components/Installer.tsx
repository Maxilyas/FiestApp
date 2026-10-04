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
import { espacesFines } from '../format'
import { Icon } from './Icon'
import { Onglets } from './Onglets'

/**
 * « Installer l'application », au pied de l'accueil d'un téléphone
 * (`client/src/installation.ts`) : repliée, une ligne — l'icône, son nom, une
 * flèche — qu'un toucher déroule. Dépliée, ce qu'elle apporte, les gestes de
 * l'iPhone et ceux d'Android, celui du téléphone d'abord, l'autre à un
 * onglet — pour l'expliquer à l'ami qui n'a pas le même —, et sur Android,
 * quand Chrome l'offre, un toucher qui l'installe. Petite, exprès : elle ne
 * prend pas la place de ce qu'on vient faire (le propriétaire du dépôt, le 4
 * octobre 2026). Rien sur un ordinateur, rien dans l'application déjà
 * installée, et plus rien une fois « Ne plus afficher » touché sur ce
 * téléphone.
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
    <section className={'card installer' + (ouverte ? ' ouverte' : '')}>
      {/* Repliée, une ligne qu'on touche pour dérouler — la carte entière. */}
      <button
        type="button"
        className="installer-tete"
        aria-expanded={ouverte}
        aria-controls={ouverte ? 'installer-detail' : undefined}
        onClick={onBasculer}
      >
        {/* L'icône même qui rejoindra l'écran d'accueil : on la reconnaîtra. */}
        <img className="installer-icone" src="/icone.svg" alt="" width={32} height={32} />
        <span className="installer-titre">Installer l’application</span>
        <Icon name="chevron-down" />
      </button>
      {ouverte && (
        <div id="installer-detail" className="installer-detail">
          <p className="muted small">
            Sans passer par un store : elle s’ouvre d’un toucher, en plein écran, comme une vraie appli.
            {avecProfil && ' Et elle peut te rappeler le quiz du jour, le soir.'}
          </p>
          {telephone === 'android' && offerte && (
            <button type="button" className="btn btn-accent btn-block" onClick={onInstaller}>
              <Icon name="download" />
              Installer maintenant
            </button>
          )}
          <Onglets
            onglets={ONGLETS}
            actif={onglet}
            onChoisir={onOnglet}
            label="Ton téléphone"
            idOnglet={id => `installer-onglet-${id}`}
            idPanneau={id => `installer-panneau-${id}`}
            className="onglets-petits"
          />
          <div role="tabpanel" id={`installer-panneau-${onglet}`} aria-labelledby={`installer-onglet-${onglet}`}>
            {onglet === 'iphone' ? <GestesIphone /> : <GestesAndroid />}
          </div>
          <button type="button" className="installer-masquer" onClick={onMasquer}>
            Ne plus afficher
          </button>
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
          Touche <b>Partager</b> <Icon name="share-ios" />, en bas — en haut sur iPad.
        </Etape>
        <Etape n={3}>
          Choisis <b>Sur l’écran d’accueil</b> <Icon name="plus-square" />, puis <b>Ajouter</b>.
        </Etape>
      </ol>
      {/* Les guillemets tiennent à leurs mots : « restait seul en bout de ligne. */}
      <p className="muted small">{espacesFines('Depuis Instagram, WhatsApp ou Messenger : « Ouvrir dans Safari » d’abord.')}</p>
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
        Samsung Internet : menu ≡, puis <b>Ajouter la page à</b> › <b>Écran d’accueil</b>.
      </p>
    </>
  )
}
