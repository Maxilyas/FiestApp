import { useEffect, useRef, useState } from 'react'
import type { Recap } from '../../../shared/types'
import { FinalPodium, Standings } from '../components/Podium'
import { TeamBoard } from '../components/TeamBoard'
import { StatsTable } from '../components/StatsTable'
import { AwardsBoard } from '../components/AwardsBoard'
import { Trophies } from '../components/Trophies'
import { JoinHead } from '../components/Invitation'
import { Icon } from '../components/Icon'
import { ArchiveBanner } from '../components/ArchiveBanner'
import { SpaceError, SpaceNav } from '../components/SpaceNav'
import { dataUrl, pageContext, route, spacePath } from '../routes'
import { formatDay } from '../../../shared/archive'

/**
 * La page souvenir : le podium, les équipes, le palmarès et tous les chiffres
 * de la soirée. Ouverte le lendemain par les invités, et pendant la fête par
 * l'animateur, sur son téléphone — elle se rafraîchit toute seule tant que la
 * soirée est en cours. Volontairement sans compte : c'est une page à partager
 * aux invités, pas un outil d'animation.
 */
export function RecapApp() {
  const { slug, archiveId } = pageContext()
  const [recap, setRecap] = useState<Recap | null>(null)
  const [error, setError] = useState('')
  // « /stats » — l'ancienne adresse des chiffres, celle du QR de la remise des
  // prix — ouvre le souvenir sur son tableau. Une seule fois : pas de saut à
  // chaque rafraîchissement.
  const viaStats = route.kind === 'public' && route.page === 'stats'
  const jumpToStats = useRef(viaStats || window.location.hash === '#stats')

  useEffect(() => {
    let loaded = false
    const load = () =>
      fetch(dataUrl(slug, 'recap.json', archiveId))
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: Recap) => {
          loaded = true
          setRecap(data)
          setError('')
        })
        // Un rafraîchissement raté ne vide pas la page : elle garde ce qu'elle a.
        .catch(() => {
          if (!loaded) setError('Impossible de charger le souvenir de la soirée.')
        })
    load()
    // Rafraîchi tout seul : la page reste ouverte sur le téléphone de
    // l'animateur pendant que les quiz s'enchaînent. Une soirée archivée,
    // elle, ne bouge plus.
    if (archiveId) return
    const id = setInterval(load, 20_000)
    return () => clearInterval(id)
  }, [slug, archiveId])

  useEffect(() => {
    if (recap?.space) document.title = `${recap.archive?.title ?? recap.space.title} · Souvenir`
  }, [recap])

  // L'adresse affichée devient la vraie, et le tableau arrive sous les yeux
  // dès que la page est là.
  useEffect(() => {
    if (viaStats) history.replaceState(null, '', spacePath(slug, 'souvenir', archiveId) + '#stats')
  }, [viaStats, slug, archiveId])
  useEffect(() => {
    if (!recap || !jumpToStats.current) return
    const table = document.getElementById('stats')
    if (!table) return
    jumpToStats.current = false
    table.scrollIntoView({ block: 'start' })
  }, [recap])

  if (error) return <SpaceError current="souvenir" message={error} />

  if (!recap) {
    return (
      <div className="center-page">
        <p className="serif-note">Chargement…</p>
      </div>
    )
  }

  const space = recap.space
  if (recap.ranking.length === 0) {
    return (
      <div className="join">
        <div className="join-grow" />
        <JoinHead
          eyebrow={space?.eyebrow ?? 'Le quiz de la soirée'}
          title={space?.headline ?? ''}
          compact={(space?.headline.length ?? 0) > 12}
          sub="La soirée n'a pas encore commencé."
        />
        <SpaceNav current="souvenir" />
        <div className="join-grow" />
      </div>
    )
  }

  const archive = recap.archive
  const dateLine = archive ? formatDay(archive.heldAt) : space?.dateLine
  return (
    <div className="recap">
      {archive && <ArchiveBanner archive={archive} />}
      <header className="recap-header">
        {dateLine && <span className="label">{dateLine}</span>}
        <h1>{archive ? archive.title : space?.title}</h1>
        <p className="join-sub">Le souvenir de la soirée</p>
        <p className="muted">
          {recap.ranking.length} joueurs · {recap.quizCount} quiz ·{' '}
          {recap.totalPoints.toLocaleString('fr-FR')} points distribués
        </p>
        <hr className="hairline" />
      </header>
      <SpaceNav current="souvenir" />

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
        <section id="stats" className="card">
          <h2>Toutes les statistiques</h2>
          <p className="muted small">
            {recap.stats.questions} questions posées · {recap.stats.logged} réponses enregistrées.
            Clique sur un en-tête pour trier — chacun peut y chercher son propre chiffre. Le tableau
            défile dans son cadre : dix-sept colonnes ne tiennent pas sur un téléphone.
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
          <a className="btn btn-accent" href={spacePath(slug, 'bilan', archiveId)}>
            <Icon name="list" />
            Relire mon bilan
          </a>
        </section>
      )}

      <p className="recap-foot muted">Merci d'être venus.</p>
    </div>
  )
}
