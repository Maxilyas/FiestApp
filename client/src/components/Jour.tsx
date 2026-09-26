import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatNumber, place, pts } from '../format'
import { NOM_MEDAILLE, jourEnToutesLettres, type Medaille as TypeDeMedaille, type PartieDuJour } from '../../../shared/jour'
import { Icon } from './Icon'
import { enumerer } from '../../../shared/classement'

// Les petites pièces du quiz du jour : la médaille, la flamme de la série, et
// la carte de l'accueil. Elles suivent le trait des icônes de l'application
// — jamais un emoji dans l'interface.

const TEINTE: Record<TypeDeMedaille, string> = { or: 'var(--accent)', argent: 'var(--argent-text)', bronze: 'var(--bronze-text)' }
const RANG: Record<TypeDeMedaille, number> = { or: 1, argent: 2, bronze: 3 }

/** Une médaille dessinée : or, argent, bronze, avec son chiffre. */
export function Medaille({ medaille, className }: { medaille: TypeDeMedaille; className?: string }) {
  const teinte = TEINTE[medaille]
  return (
    <svg className={'medaille' + (className ? ` ${className}` : '')} viewBox="0 0 24 24" role="img" aria-label={NOM_MEDAILLE[medaille]}>
      <path d="M7 1.5h4l2.2 7.2h-4z" fill={teinte} opacity="0.55" />
      <path d="M17 1.5h-4l-2.2 7.2h4z" fill={teinte} opacity="0.8" />
      <circle cx="12" cy="15" r="7.2" fill={teinte} />
      <circle cx="12" cy="15" r="5.2" fill="none" stroke="#1a1412" strokeOpacity="0.35" strokeWidth="1" />
      <text x="12" y="18.4" textAnchor="middle" fontFamily="Cormorant Garamond, Georgia, serif" fontWeight="600" fontSize="9.5" fill="#1a1412">
        {RANG[medaille]}
      </text>
    </svg>
  )
}

/** La série de jours joués : une flamme au trait. */
export function Flamme({ className }: { className?: string }) {
  return (
    <svg className={'icon flamme' + (className ? ` ${className}` : '')} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 21.5c3.9 0 6.4-2.5 6.4-6 0-3.2-2.1-5.2-3.3-6.9-.4 1.5-1.2 2.5-2.2 2.9.3-3-1.2-5.8-3.7-7.5.3 2.7-1 4.4-2.4 6.1-1.3 1.6-1.2 3.4-1.2 5.3 0 3.6 2.5 6.1 6.4 6.1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** « 6 jours » : la série, avec sa flamme — rien tant qu'elle ne compte pas. */
export function Serie({ jours }: { jours: number }) {
  if (jours < 1) return null
  return (
    <span className="serie" title="Jours d’affilée joués, soirées comprises">
      <Flamme />
      {jours} jour{jours > 1 ? 's' : ''}
    </span>
  )
}

/**
 * La carte du quiz du jour, sous « Ce soir » sur l'accueil : à jouer, à
 * reprendre, ou joué — avec sa place pour l'instant. Elle ne s'affiche que
 * pour un profil, et ne prend pas la place de ce qu'on est venu faire : la
 * soirée reste au-dessus.
 */
export function CarteDuJour() {
  const [partie, setPartie] = useState<PartieDuJour | null>(null)
  useEffect(() => {
    let vivant = true
    // Une panne ici ne coûte que la carte : l'accueil reste là.
    api.jour
      .etat()
      .then(p => vivant && setPartie(p))
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])
  if (!partie || partie.etat === 'aucun') return null
  const categories = partie.categories.slice(0, 3).join(', ') + (partie.categories.length > 3 ? '…' : '')
  return (
    <section className="card jour-carte" aria-label="Le quiz du jour">
      <div className="jour-tete">
        <span className="label">Le quiz du jour</span>
        <Serie jours={partie.serie} />
      </div>
      <p className="jour-date">{capitale(jourEnToutesLettres(partie.jour))}</p>
      {partie.etat === 'finie' ? (
        <>
          <p className="jour-score">
            <span className="num">{formatNumber(partie.points)}</span> pts
            {partie.rang > 0 && (
              <span className="muted">
                {' '}
                · {place(partie.rang)} sur {partie.joueurs} pour l’instant
              </span>
            )}
          </p>
          <p className="jour-meta">
            {partie.medaille && <Medaille medaille={partie.medaille} className="medaille-texte" />}
            {partie.justes} bonne{partie.justes > 1 ? 's' : ''} réponse{partie.justes > 1 ? 's' : ''} · +{partie.xp} XP
          </p>
          <a className="btn btn-accent btn-block" href="/jour#classement">
            Voir le classement
          </a>
        </>
      ) : (
        <>
          <p className="jour-meta">
            {partie.total} questions{categories && ` · ${categories}`}
          </p>
          <a className="btn btn-primary btn-big btn-block" href="/jour">
            <Icon name="play" />
            {partie.etat === 'en-cours' ? `Reprendre · ${pts(partie.points)}` : 'Jouer'}
          </a>
          {(partie.joueurs > 0 || partie.vainqueursDHier.length > 0) && (
            <p className="jour-pied muted small">
              {partie.joueurs > 0 && (
                <span>
                  Déjà {partie.joueurs} joueur{partie.joueurs > 1 ? 's' : ''} aujourd’hui
                </span>
              )}
              {partie.vainqueursDHier.length > 0 && <span>{ontGagneHier(partie)}</span>}
            </p>
          )}
        </>
      )}
    </section>
  )
}

const capitale = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1)

/** « Hugo a gagné hier », « Hugo et Zoé ont gagné hier » : tous les ex æquo en tête gagnent. */
export function ontGagneHier(partie: Pick<PartieDuJour, 'vainqueursDHier'>): string {
  const noms = partie.vainqueursDHier.map(v => v.nom)
  return `${enumerer(noms)} ${noms.length > 1 ? 'ont' : 'a'} gagné hier`
}
