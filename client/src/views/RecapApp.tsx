import { useEffect, useState } from 'react'
import type { Recap } from '../../../shared/types'
import { FinalPodium, Standings } from '../components/Podium'
import { TeamBoard } from '../components/TeamBoard'
import { StatsTable } from '../components/StatsTable'
import { AwardsBoard } from '../components/AwardsBoard'
import { Trophies } from '../components/Trophies'
import { JoinHead } from '../components/Invitation'
import { Icon } from '../components/Icon'
import { ArchiveBanner } from '../components/ArchiveBanner'
import { dataUrl, pageUrl } from '../archive'
import { formatDay } from '../../../shared/archive'

/**
 * La page souvenir, ouverte le lendemain. Volontairement sans clé : c'est
 * une page à partager aux invités, pas un outil d'animation.
 */
export function RecapApp() {
  const [recap, setRecap] = useState<Recap | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(dataUrl('recap.json'))
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
        <p className="serif-note">Chargement…</p>
      </div>
    )
  }

  if (recap.ranking.length === 0) {
    return (
      <div className="join">
        <div className="join-grow" />
        <JoinHead eyebrow="Les trente ans de" title="Romane" sub="La soirée n'a pas encore commencé." />
        <div className="join-grow" />
      </div>
    )
  }

  const archive = recap.archive
  return (
    <div className="recap">
      {archive && <ArchiveBanner archive={archive} />}
      <header className="recap-header">
        <span className="label">{archive ? formatDay(archive.heldAt) : '19 septembre 2026'}</span>
        <h1>{archive ? archive.title : 'Les 30 ans de Romane'}</h1>
        <p className="join-sub">Le souvenir de la soirée</p>
        <p className="muted">
          {recap.ranking.length} joueurs · {recap.quizCount} quiz ·{' '}
          {recap.totalPoints.toLocaleString('fr-FR')} points distribués
        </p>
        <hr className="hairline" />
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
            En champagne, la moyenne par membre — c'est elle qui classe les équipes. Le chiffre
            cerclé est ce que le quiz a rapporté au tableau des trois jeux.
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

      {recap.stats.logged > 0 && (
        <section className="card bilan-invite">
          <h2>Ta soirée, question par question</h2>
          <p className="muted small">
            Ce que tu as répondu à chaque question, ce que ton équipe a choisi, ce que la salle a
            choisi — et les questions qui ont marqué la soirée.
          </p>
          <a className="btn btn-accent" href={pageUrl('bilan')}>
            <Icon name="list" />
            Relire mon bilan
          </a>
        </section>
      )}

      <p className="recap-foot muted">Merci d'être venus.</p>
      <p className="muted small center">
        <a href="/soirees">Toutes les soirées</a>
      </p>
    </div>
  )
}
