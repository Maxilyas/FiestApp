import { useEffect, useState } from 'react'
import type { Recap } from '../../../shared/types'
import { FinalPodium, Standings } from '../components/Podium'
import { TeamBoard } from '../components/TeamBoard'
import { StatsTable } from '../components/StatsTable'
import { AwardsBoard } from '../components/AwardsBoard'
import { Trophies } from '../components/Trophies'

/**
 * La page souvenir, ouverte le lendemain. Volontairement sans clé : c'est
 * une page à partager aux invités, pas un outil d'animation.
 */
export function RecapApp() {
  const [recap, setRecap] = useState<Recap | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/recap.json')
      .then(r => r.json())
      .then(setRecap)
      .catch(() => setError('Impossible de charger le souvenir de la soirée.'))
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

  if (recap.ranking.length === 0) {
    return (
      <div className="center-page">
        <div className="card join-card">
          <h1>🎉 Quizz Romane 30</h1>
          <p className="muted">La soirée n'a pas encore commencé.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="recap">
      <header className="recap-header">
        <p className="pill">19 septembre 2026</p>
        <h1>🎉 Les 30 ans de Romane</h1>
        <p className="muted">
          {recap.ranking.length} joueurs · {recap.quizCount} quiz ·{' '}
          {recap.totalPoints.toLocaleString('fr-FR')} points distribués
        </p>
      </header>

      <section className="card">
        <h2>Le podium</h2>
        <FinalPodium rows={recap.ranking} />
      </section>

      {recap.teams.length > 0 && (
        <section className="card">
          <h2>Les équipes au quiz</h2>
          <TeamBoard teams={recap.teams} showGamePoints />
          <p className="muted small">
            En doré, la moyenne par membre — c'est elle qui classe les équipes. En turquoise, les
            points rapportés au tableau des trois jeux.
          </p>
        </section>
      )}

      {recap.stats.awards.length > 0 && (
        <section className="card">
          <h2>Le palmarès</h2>
          <p className="muted small">
            Les prix de la soirée — ceux qui ne se jouent pas au sommet du classement.
          </p>
          <AwardsBoard awards={recap.stats.awards} teams={recap.teams} />
        </section>
      )}

      <Trophies recap={recap} />

      {recap.stats.logged > 0 && (
        <section className="card">
          <h2>Toutes les statistiques</h2>
          <p className="muted small">
            {recap.stats.questions} questions posées · {recap.stats.logged} réponses enregistrées.
            Clique sur un en-tête pour trier — chacun peut y chercher son propre chiffre.
          </p>
          <StatsTable stats={recap.stats} />
        </section>
      )}

      {recap.ranking.length > 3 && (
        <section className="card">
          <h2>Le reste du classement</h2>
          <Standings rows={recap.ranking.slice(3)} offset={3} />
        </section>
      )}

      <p className="recap-foot muted">Merci d'être venus 🩰</p>
    </div>
  )
}
