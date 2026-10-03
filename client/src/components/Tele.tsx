import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Avatar } from './Avatar'
import { useCodeDeLaTele } from './Appairage'
import { serverNow } from '../clock'
import { espacesFines } from '../format'
import { ecrireCode } from '../../../shared/space'
import type { PublicPlayer } from '../../../shared/types'

// Ce que montre une télé, quand ce n'est pas l'écran d'un animateur au
// clavier : d'abord de quoi la brancher (`/tele`), puis, branchée à un salon
// qu'on anime depuis son téléphone, la salle d'attente vue de loin. Rien à
// toucher : la télécommande de la télé ne sait ni taper ni cliquer. La page
// qui les montre pose leur repère principal, comme chaque page.

const QR_INK = '#1a1412'

/** Les secondes qui restent avant l'échéance, relues chaque seconde à l'heure du serveur (invariant 6). */
function useSecondesAvant(echeance: number | null): number | null {
  const [maintenant, setMaintenant] = useState(serverNow)
  useEffect(() => {
    if (echeance === null) return
    const t = setInterval(() => setMaintenant(serverNow()), 1000)
    return () => clearInterval(t)
  }, [echeance])
  return echeance === null ? null : Math.max(0, Math.round((echeance - maintenant) / 1000))
}

/** Six caractères en cases, coupés en deux groupes de trois, comme on les lit à voix haute. */
function Cases({ code, className }: { code: string; className: string }) {
  return (
    <span className={className} role="img" aria-label={`Le code : ${code.split('').join(' ')}`}>
      {code.split('').map((c, i) => (
        <span key={i} className={'tv-case' + (i === 3 ? ' tv-case-coupe' : '')} aria-hidden="true">
          {c}
        </span>
      ))}
    </span>
  )
}

/**
 * La télé à brancher : le code en grand au milieu, les trois gestes du
 * téléphone qui le valide, et le temps qu'il lui reste. L'animateur qui a
 * un mot de passe d'espace garde sa porte, d'un lien discret : l'écran
 * de connexion mangeait la moitié de la télé pour la minorité qui l'emploie.
 */
export function EcranDeBranchement({ onBranchee, onConnexion }: { onBranchee: () => void; onConnexion: () => void }) {
  const { code, erreur, expireA } = useCodeDeLaTele(onBranchee)
  const reste = useSecondesAvant(expireA)
  return (
    <div className="tv tv-branchement">
      <header className="tv-marque">
        <span className="tv-logo">FiestApp</span>
        <span>l’écran de la soirée</span>
      </header>
      <section className="tv-centre" aria-labelledby="tv-brancher">
        <h1 className="tv-sur" id="tv-brancher">
          Brancher cette télé
        </h1>
        {code ? <Cases code={code} className="tv-cases" /> : <p className="tv-doux">{erreur || 'Un code arrive…'}</p>}
        <ol className="tv-etapes">
          <li>
            <b>1</b> Sur ton téléphone, <em>Créer un salon</em>
          </li>
          <li>
            <b>2</b> Choisis <em>Sur une télé</em>
          </li>
          <li>
            <b>3</b> Tape ce code
          </li>
        </ol>
      </section>
      <footer className="tv-pied">
        <span className="tv-pouls" aria-hidden="true" /> En attente d’un téléphone
        {reste !== null && reste > 0 && ` · le code change dans ${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, '0')}`}
        <button type="button" className="link-inline tv-connexion" onClick={onConnexion}>
          J’ai un identifiant d’animateur
        </button>
      </footer>
    </div>
  )
}

/**
 * La salle d'attente à la télé, quand on anime depuis son téléphone : le
 * code et le QR à gauche — c'est ce que la salle doit voir de loin —, la
 * soirée et ceux qui arrivent à droite. Les équipes, les réglages et
 * « Lancer » restent dans la main du chef.
 */
export function SalleDeLaTele({
  titre,
  code,
  entreeUrl,
  players,
  chef,
}: {
  titre: string
  code?: string
  entreeUrl: string
  players: PublicPlayer[]
  /** Qui tient la télécommande : la salle sait de qui viendra le signal. */
  chef: string
}) {
  const visages = players.filter(p => p.connected)
  return (
    <div className="tv tv-salle">
      <section className="tv-salle-qr" aria-labelledby="tv-rejoindre">
        <h2 className="tv-sur" id="tv-rejoindre">
          {code ? 'Le code du salon' : 'Pour rejoindre'}
        </h2>
        {code ? <Cases code={code} className="tv-cases tv-cases-salon" /> : <p className="tv-adresse">{entreeUrl.replace(/^https?:\/\//, '')}</p>}
        <p className="tv-doux">{code ? `${ecrireCode(code)} dans « Rejoindre une soirée », ou scanne :` : 'ou scanne :'}</p>
        <span className="tv-qr">
          <QRCodeSVG value={entreeUrl} size={200} bgColor="#ffffff" fgColor={QR_INK} title="QR code pour rejoindre la soirée" />
        </span>
        <p className="tv-doux">Pas besoin de compte</p>
      </section>
      <section className="tv-salle-droite" aria-labelledby="tv-titre">
        <p className="tv-sur">Ce soir</p>
        <h1 className="tv-titre" id="tv-titre">
          {espacesFines(titre)}
        </h1>
        <p className="tv-compte">
          <b>{visages.length}</b> joueur{visages.length > 1 ? 's' : ''}
        </p>
        <ul className="tv-visages">
          {visages.map(p => (
            <li key={p.id}>
              <Avatar className="tv-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
              <span>{p.nomAffiche ?? p.name}</span>
            </li>
          ))}
        </ul>
      </section>
      <footer className="tv-pied">{espacesFines(`${chef} lance la partie depuis son téléphone`)}</footer>
    </div>
  )
}
