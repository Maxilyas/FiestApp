import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatNumber, pts } from '../format'
import { placeDuJour } from '../../../shared/course'
import {
  ETOILES_DE_LA_MEDAILLE,
  NOM_DE_LA_NOTE,
  jourDe,
  jourEnToutesLettres,
  type CarriereDuJour,
  type JourJoue,
  type Medaille as TypeDeMedaille,
  type PartieDuJour,
} from '../../../shared/jour'
import type { PointJoue } from './Carriere'
import { Flamme, Icon } from './Icon'
import { Etoiles } from './Etoiles'
import { enumerer } from '../../../shared/classement'

// Les petites pièces du quiz du jour : sa note, la flamme de la série, et
// la carte de l'accueil. Elles suivent le trait des icônes de l'application
// — jamais un emoji dans l'interface.

/**
 * La note d'une partie du jour, en étoiles — une, deux, trois —, celles des
 * sentiers. Elle se dessinait en médaille de bronze, d'argent ou d'or : les
 * métaux des trophées, et l'on confondait la note d'un jour avec un trophée
 * (la maquette du 13 octobre 2026).
 */
export function NoteDuJour({ medaille, grande }: { medaille: TypeDeMedaille; grande?: boolean }) {
  return <Etoiles n={ETOILES_DE_LA_MEDAILLE[medaille]} grandes={grande} />
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
  // `undefined` tant qu'elle arrive, `null` si elle ne viendra pas.
  const [partie, setPartie] = useState<PartieDuJour | null | undefined>(undefined)
  useEffect(() => {
    let vivant = true
    // Une panne ici ne coûte que la carte : l'accueil reste là.
    api.jour
      .etat()
      .then(p => vivant && setPartie(p))
      .catch(() => vivant && setPartie(null))
    return () => {
      vivant = false
    }
  }, [])
  // Sa place est gardée pendant qu'elle arrive : posée quatre cents
  // millisecondes après la page, elle poussait les onglets de 233 px — et le
  // pouce qui visait « Trophées » touchait la carte. Le jour se sait déjà ici.
  if (partie === undefined)
    return (
      <section className="card jour-carte jour-carte-attente" aria-busy="true" aria-label="Le quiz du jour">
        <div className="jour-tete">
          <span className="label">Le quiz du jour</span>
        </div>
        <p className="jour-date">{capitale(jourEnToutesLettres(jourDe(Date.now())))}</p>
      </section>
    )
  if (!partie || partie.etat === 'aucun') return null
  const categories = partie.categories.slice(0, 3).join(', ') + (partie.categories.length > 3 ? '…' : '')
  return (
    <section className="card jour-carte" aria-label="Le quiz du jour">
      <div className="jour-tete">
        <span className="label">Le quiz du jour</span>
        <Serie jours={partie.serie} />
      </div>
      <p className="jour-date">{capitale(jourEnToutesLettres(partie.jour))}</p>
      {/* La récompense d'hier, là où l'on arrive : son détail attendait sur /jour. */}
      {partie.sonHier && partie.sonHier.xpPodium > 0 && (
        <p className="jour-hier">
          Hier : {placeDuJour(partie.sonHier.rang, partie.sonHier.joueurs, partie.sonHier.points)} · +{partie.sonHier.xpPodium} XP
        </p>
      )}
      {/* Ce qui fait revenir, dit une fois, sur la page qu'on ouvre de soi-même :
          rien ne disait qu'une série se perd à minuit. */}
      {partie.etat === 'a-jouer' && !partie.serieTenue && partie.serie >= 2 && (
        <p className="jour-hier">Ta série de {partie.serie} jours tient jusqu’à minuit.</p>
      )}
      {partie.etat === 'finie' ? (
        <>
          <p className="jour-score">
            <span className="num">{formatNumber(partie.points)}</span> pts
            {placeDuJour(partie.rang, partie.joueurs, partie.points) && (
              <span className="muted">
                {' '}
                · {placeDuJour(partie.rang, partie.joueurs, partie.points)} pour l’instant
              </span>
            )}
          </p>
          <p className="jour-meta">
            {partie.medaille && <NoteDuJour medaille={partie.medaille} />}
            {partie.justes} bonne{partie.justes > 1 ? 's' : ''} réponse{partie.justes > 1 ? 's' : ''} · +{partie.xp + (partie.xpSerie ?? 0)} XP
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

/** Combien de jours « Mes jours » montre : une semaine. Le classement du mois dit le reste. */
const JOURS_MONTRES = 7

/**
 * Ses derniers jours au quiz du jour, sur sa page : la date, les points, la
 * place de ce jour-là, ce qu'il lui a rapporté — la partie et le podium.
 */
export function MesJours({ jour }: { jour?: CarriereDuJour }) {
  if (!jour || jour.joues === 0) return null
  return (
    <section className="card">
      <h3>
        <Flamme />
        Mes jours <span className="muted small titre-compte">{formatNumber(jour.joues)}</span>
      </h3>
      {jour.jours.slice(0, JOURS_MONTRES).map(j => (
        <div key={j.jour} className="soiree-row">
          <div className="soiree-texte">
            <span className="soiree-quand">{capitale(jourEnToutesLettres(j.jour))}</span>
            <span className="soiree-detail">
              {[pts(j.points), placeDuJour(j.rang, j.joueurs, j.points)].filter(Boolean).join(' · ')}
              {j.medaille && ` · ${NOM_DE_LA_NOTE[j.medaille].toLowerCase()}`}
            </span>
          </div>
          <span className="soiree-xp">+{formatNumber(j.xp)} XP</span>
        </div>
      ))}
      <a className="link-inline small" href="/jour#classement-mois">
        Le classement du mois
      </a>
    </section>
  )
}

/**
 * Les jours du quiz du jour, tels que les courbes les lisent : la précision
 * sur les questions qui comptaient, le réflexe sur ses bonnes réponses — et
 * pas de coup d'œil, le quiz du jour ne pose pas d'estimation.
 */
export function pointsDesJours(jours: readonly JourJoue[]): PointJoue[] {
  return jours.map(j => {
    const [annee, mois, jourDuMois] = j.jour.split('-').map(Number)
    return {
      releve: { qcm: j.comptees, justes: j.justes, estimationsComparees: 0, coupDOeil: 0, tempsJustesMs: j.tempsJustesMs },
      // À midi en temps universel : le même jour sous tous les fuseaux d'Europe.
      at: Date.UTC(annee, mois - 1, jourDuMois, 12),
    }
  })
}
