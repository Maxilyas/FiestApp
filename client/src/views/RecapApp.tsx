import { useEffect, useRef, useState } from 'react'
import type { Recap } from '../../../shared/types'
import { FinalPodium, Standings } from '../components/Podium'
import { TeamBoard, VerdictDesEquipes } from '../components/TeamBoard'
import { regleDesEquipes } from '../../../shared/teams'
import { PrixRemis } from '../components/PrixRemis'
import { StatsTable } from '../components/StatsTable'
import { AwardsBoard } from '../components/AwardsBoard'
import { Trophies } from '../components/Trophies'
import { JoinHead } from '../components/Invitation'
import { Icon } from '../components/Icon'
import { ArchiveBanner } from '../components/ArchiveBanner'
import { SpaceError, SpaceNav } from '../components/SpaceNav'
import { pageContext, route, spacePath } from '../routes'
import { lecteurDePage } from '../derniere'
import { BoutonCopier, BoutonPartager } from '../components/Partage'
import { formatDay } from '../../../shared/archive'
import { rangPartage } from '../../../shared/classement'

/**
 * La page souvenir : le podium, les équipes, le palmarès et tous les chiffres
 * de la soirée. Ouverte pendant la soirée par l'animateur, sur son téléphone —
 * elle se rafraîchit toute seule tant que la soirée est en cours —, et le
 * lendemain par les invités : entre deux soirées, celle de l'espace montre la
 * dernière soirée close (`lecteurDePage`). Volontairement sans compte : c'est
 * une page à partager aux invités, pas un outil d'animation.
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
    const lire = lecteurDePage<Recap>(slug, 'recap.json', archiveId)
    const load = () =>
      lire()
        .then(data => {
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
    // l'animateur pendant que les quiz s'enchaînent — et, entre deux
    // soirées, elle y revient dès que la suivante joue. Une soirée archivée,
    // elle, ne bouge plus.
    //
    // Mais pas dans un onglet caché : la page restait ouverte dans cinquante
    // poches toute la fin de soirée, et chacune redemandait le souvenir
    // toutes les 20 s. Elle se rattrape en revenant au premier plan.
    if (archiveId) return
    const id = setInterval(() => {
      if (!document.hidden) load()
    }, 20_000)
    const auRetour = () => {
      if (!document.hidden) load()
    }
    document.addEventListener('visibilitychange', auRetour)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', auRetour)
    }
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
      <main className="center-page">
        <p className="serif-note">Chargement…</p>
      </main>
    )
  }

  const space = recap.space
  // La soirée a commencé dès qu'une question a été posée — pas au premier
  // point marqué. Quand toute la salle s'était trompée, le classement vide
  // faisait dire « pas encore commencé » à une page qui avait déjà ses prix
  // et ses chiffres, et les cachait.
  if (recap.ranking.length === 0 && recap.stats.logged === 0) {
    return (
      <main className="join">
        <div className="join-grow" />
        <JoinHead
          eyebrow={space?.eyebrow ?? 'Le quiz de la soirée'}
          title={space?.headline ?? ''}
          compact={(space?.headline.length ?? 0) > 12}
          sub="La soirée n'a pas encore commencé."
        />
        <SpaceNav current="souvenir" />
        <div className="join-grow" />
      </main>
    )
  }

  const archive = recap.archive
  // Le lien qu'on envoie est celui de l'archive, même pendant la soirée :
  // `/<espace>/souvenir` changera de soirée à la suivante.
  const soireeMontree = archiveId ?? archive?.id ?? recap.soireeId ?? null
  const lienStable = new URL(spacePath(slug, 'souvenir', soireeMontree), window.location.href).href
  const dateLine = archive ? formatDay(archive.heldAt) : space?.dateLine
  // Le classement arrive dans l'ordre commun (shared/classement.ts) ; chaque
  // ligne y prend son rang partagé, que la liste sous le podium ne saurait
  // pas retrouver seule.
  const points = recap.ranking.map(r => r.points)
  const classement = recap.ranking.map(r => ({ ...r, rank: rangPartage(r.points, points) }))
  // Ceux qui ont joué, et pas seulement ceux qui ont marqué : une salle qui
  // s'est trompée partout n'est pas une salle vide. Le classement compte
  // encore pour les soirées d'avant le journal des réponses.
  const joueurs = Math.max(recap.ranking.length, recap.stats.players.filter(s => s.asked > 0).length)
  return (
    <div className="recap">
      {archive && <ArchiveBanner archive={archive} />}
      <header className="recap-header">
        {dateLine && <span className="label">{dateLine}</span>}
        <h1>{archive ? archive.title : space?.title}</h1>
        <p className="join-sub">Le souvenir de la soirée</p>
        <p className="muted">
          {joueurs} joueur{joueurs > 1 ? 's' : ''} · {recap.quizCount} quiz ·{' '}
          {recap.totalPoints.toLocaleString('fr-FR')} points distribués
        </p>
        {/* Le lien à envoyer : celui de l'archive, qui ne changera pas quand
            la suivante jouera — `/<espace>/souvenir`, lui, changera. Pendant
            la soirée, il n'y a encore que celui-là. */}
        <div className="row recap-partage">
          <BoutonCopier className="btn btn-small btn-ghost" texte={lienStable} />
          <BoutonPartager className="btn btn-small btn-ghost" titre={archive ? archive.title : (space?.title ?? '')} url={lienStable} />
        </div>
        <hr className="hairline" />
      </header>
      <SpaceNav current="souvenir" />
      <main className="page-corps">
        <section className="card">
          <h2>Le podium</h2>
          {classement.length > 0 ? (
            <FinalPodium rows={classement} />
          ) : (
            <p className="muted">Personne n'a marqué de point : le podium reste vide, les prix et les chiffres sont là.</p>
          )}
        </section>

        {recap.teams.length > 0 && (
          <section className="card">
            <h2>Les équipes au quiz</h2>
            {/* Le verdict de l'écran de victoire et de l'historique, ex æquo
                compris : le souvenir couronnait la meilleure moyenne, sans
                les prix, et contredisait la soirée qu'on avait vécue. */}
            <VerdictDesEquipes teams={recap.teams} avecPrix={recap.bonuses.some(b => b.points !== 0)} />
            <TeamBoard teams={recap.teams} />
            <p className="muted small">{regleDesEquipes(recap.teams.length)}</p>
          </section>
        )}

        {recap.bonuses.length > 0 && (
          <section className="card">
            <h2>Remis ce soir-là</h2>
            <p className="muted small">Les prix remis à l'écran, dans l'ordre, et les points qu'ils ont rapportés.</p>
            <PrixRemis bonuses={recap.bonuses} teams={recap.teams} />
          </section>
        )}

        {recap.stats.awards.length > 0 && (
          <section className="card">
            <h2>Le palmarès</h2>
            <p className="muted small">
              Les prix que les chiffres de la soirée désignent, remis à l'écran ou non — ceux qui ne
              se jouent pas au sommet du classement.
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
              défile dans son cadre, le prénom et les points restent en vue : dix-huit colonnes ne
              tiennent pas sur un téléphone.
            </p>
            <StatsTable stats={recap.stats} />
          </section>
        )}

        {classement.length > 3 && (
          <section className="card">
            <h2>Le reste du classement</h2>
            <Standings rows={classement.slice(3)} offset={3} />
          </section>
        )}

        {recap.stats.logged > 0 && (
          <section className="card bilan-invite">
            <h2>Ta soirée, question par question</h2>
            <p className="muted small">
              Ce que tu as répondu à chaque question, ce que ton équipe a choisi, ce que la salle a
              choisi — et les questions qui ont marqué la soirée.
            </p>
            {/* Le bilan de la soirée montrée, à son adresse d'archive quand elle
                en a une : un lien qui ne changera pas quand la suivante jouera. */}
            <a className="btn btn-accent" href={spacePath(slug, 'bilan', archiveId ?? archive?.id ?? null)}>
              <Icon name="list" />
              Relire mon bilan
            </a>
          </section>
        )}

        <p className="recap-foot muted">Merci d'être venus.</p>
      </main>
    </div>
  )
}
