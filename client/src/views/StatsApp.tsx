import { useEffect, useState } from 'react'
import type { Recap } from '../../../shared/types'
import { StatsTable } from '../components/StatsTable'
import { AwardsBoard } from '../components/AwardsBoard'
import { TeamBoard } from '../components/TeamBoard'

/**
 * La page des chiffres, à son adresse propre (`/stats`).
 *
 * Elle vivait au fond de la page souvenir, où l'animateur ne la trouvait pas
 * pendant la fête. Elle est publique comme le souvenir : les mêmes données,
 * lisibles sur un téléphone entre deux quiz aussi bien que le lendemain.
 */
export function StatsApp() {
  const [recap, setRecap] = useState<Recap | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = () =>
      fetch('/recap.json')
        .then(r => r.json())
        .then(setRecap)
        .catch(() => setError('Impossible de charger les statistiques.'))
    load()
    // Rafraîchi tout seul : la page reste ouverte sur le téléphone de
    // l'animateur pendant que les quiz s'enchaînent.
    const id = setInterval(load, 20_000)
    return () => clearInterval(id)
  }, [])

  if (error) {
    return (
      <div className="center-page">
        <p className="error">{error}</p>
      </div>
    )
  }

  if (!recap) {
    return (
      <div className="center-page">
        <p className="muted">Chargement…</p>
      </div>
    )
  }

  const { stats } = recap

  return (
    <div className="recap">
      <header className="recap-header">
        <p className="pill">📊 Les chiffres de la soirée</p>
        <h1>Statistiques</h1>
        <p className="muted">
          {stats.questions} questions posées · {stats.logged} réponses enregistrées ·{' '}
          {recap.quizCount} quiz
        </p>
      </header>

      {stats.logged === 0 ? (
        <section className="card">
          <p className="muted">
            Rien à afficher pour l'instant : les chiffres arrivent dès la première question jouée.
          </p>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>Toutes les statistiques</h2>
            <p className="muted small">
              Clique sur un en-tête pour trier. Le tableau défile horizontalement — les dix-sept
              colonnes ne tiennent pas sur un téléphone.
            </p>
            <StatsTable stats={stats} />
          </section>

          {stats.awards.length > 0 && (
            <section className="card">
              <h2>Le palmarès</h2>
              <p className="muted small">
                Ce que l'application propose. C'est sur l'écran commun que tu les attribues.
              </p>
              <AwardsBoard awards={stats.awards} teams={recap.teams} />
            </section>
          )}

          {recap.teams.length > 0 && (
            <section className="card">
              <h2>Les équipes</h2>
              <TeamBoard teams={recap.teams} showGamePoints />
            </section>
          )}
        </>
      )}
    </div>
  )
}
