import { useEffect, useState } from 'react'
import type { ArchiveList, ArchiveSummary } from '../../../shared/archive'
import { formatDay } from '../../../shared/archive'
import { enumerer } from '../../../shared/classement'
import { Icon } from '../components/Icon'
import { confirmDialog, promptDialog } from '../components/Dialog'
import { INTROUVABLE, SpaceError, SpaceNav, estIntrouvable, useIsHost } from '../components/SpaceNav'
import { api, UnauthorizedError } from '../api'
import { dataUrl, pageContext, spacePath, type PublicPage } from '../routes'
import { formatNumber, pts } from '../format'

/**
 * L'historique des soirées d'un espace (`/<espace>/soirees`) : la soirée en
 * cours, puis chaque soirée archivée avec ses deux pages — le souvenir,
 * chiffres compris, et le bilan. Public, comme elles. L'animateur de
 * l'espace, connecté, peut renommer une soirée ou en retirer une.
 */
export function ArchivesApp() {
  const { slug } = pageContext()
  const [list, setList] = useState<ArchiveList | null>(null)
  const [error, setError] = useState('')
  // Les boutons de gestion n'apparaissent qu'à l'animateur de cet espace,
  // connecté ; le serveur revérifie de toute façon à chaque action.
  const isHost = useIsHost(slug)
  const [revoked, setRevoked] = useState(false)
  const host = isHost && !revoked

  const load = () =>
    fetch(dataUrl(slug, 'soirees.json'))
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setList)
      .catch(e => setError(estIntrouvable(e) ? INTROUVABLE : "Impossible de charger l'historique."))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(() => {
    if (list?.space) document.title = `${list.space.title} · Historique`
  }, [list])

  const manage = async (action: () => Promise<unknown>) => {
    try {
      await action()
      await load()
    } catch (e) {
      // Une session périmée : les boutons disparaissent, la page reste lisible.
      if (e instanceof UnauthorizedError) setRevoked(true)
      else setError((e as Error).message)
    }
  }

  if (error) return <SpaceError current="soirees" message={error} />
  if (!list) {
    return (
      <main className="center-page">
        <p className="serif-note">Chargement…</p>
      </main>
    )
  }

  const current = list.current
  return (
    <div className="recap soirees">
      <header className="recap-header">
        <span className="label">{list.space?.title}</span>
        <h1>Historique</h1>
        <p className="join-sub">L'historique, une soirée après l'autre</p>
        <hr className="hairline" />
      </header>
      <SpaceNav current="soirees" />
      <main className="page-corps">
      {current && (
        <section className="card soiree soiree-current">
          <div className="soiree-head">
            <div>
              <span className="label">En cours</span>
              <h2>{current.title ?? 'La soirée du moment'}</h2>
              <p className="muted">
                {current.players} joueur{current.players > 1 ? 's' : ''} · {current.quizzes} quiz ·{' '}
                {current.questions} question{current.questions > 1 ? 's' : ''}
                {current.since !== null && ` · depuis le ${formatDay(current.since)}`}
              </p>
            </div>
          </div>
          <PageLinks slug={slug} archiveId={null} />
          <p className="muted small">
            Elle s'enregistre toute seule après chaque quiz, et rejoindra la liste quand l'animateur
            la clora depuis l'écran commun.
          </p>
        </section>
      )}

      {list.archives.length === 0 ? (
        <section className="card">
          <p className="muted">
            Aucune soirée close pour l'instant. Chaque soirée s'enregistre après chaque quiz, et
            rejoint cette liste quand l'animateur la clôt depuis l'écran commun.
          </p>
        </section>
      ) : (
        list.archives.map(a => (
          <ArchiveCard
            key={a.id}
            slug={slug}
            archive={a}
            host={host}
            onRename={async () => {
              const title = await promptDialog({
                title: 'Renommer la soirée',
                input: { value: a.title, maxLength: 80 },
                confirmLabel: 'Renommer',
              })
              if (title) await manage(() => api.archives.rename(a.id, title))
            }}
            onRemove={async () => {
              const ok = await confirmDialog({
                title: `Retirer « ${a.title} » de l'historique ?`,
                message:
                  'Son souvenir et son bilan disparaissent, et ce qu’elle avait rapporté aux profils avec — expérience, prix, hauts faits. C’est définitif.',
                confirmLabel: 'Retirer',
                danger: true,
              })
              if (ok) await manage(() => api.archives.remove(a.id))
            }}
          />
        ))
      )}
      </main>
    </div>
  )
}

/** Les deux pages d'une soirée — celle en cours, ou une archive. */
function PageLinks({ slug, archiveId }: { slug: string; archiveId: string | null }) {
  const link = (page: PublicPage) => spacePath(slug, page, archiveId)
  return (
    <div className="row soiree-links">
      <a className="btn btn-small" href={link('souvenir')}>
        <Icon name="book" />
        Souvenir
      </a>
      <a className="btn btn-small btn-accent" href={link('bilan')}>
        <Icon name="list" />
        Bilan
      </a>
    </div>
  )
}

function ArchiveCard({
  slug,
  archive: a,
  host,
  onRename,
  onRemove,
}: {
  slug: string
  archive: ArchiveSummary
  host: boolean
  onRename: () => void
  onRemove: () => void
}) {
  return (
    <section className="card soiree">
      <div className="soiree-head">
        <div>
          <span className="label">{formatDay(a.heldAt)}</span>
          <h2>{a.title}</h2>
          <p className="muted">
            {a.players} joueur{a.players > 1 ? 's' : ''} · {a.quizzes} quiz · {a.questions} question
            {a.questions > 1 ? 's' : ''}
          </p>
        </div>
        {host && (
          <div className="row soiree-manage">
            <button className="btn btn-icon" title="Renommer" aria-label="Renommer" onClick={onRename}>
              <Icon name="edit" />
            </button>
            <button className="btn btn-icon" title="Retirer de l'historique" aria-label="Retirer" onClick={onRemove}>
              <Icon name="trash" />
            </button>
          </div>
        )}
      </div>
      {/* Le résumé est relu à chaque affichage, avec les règles du souvenir :
          « Camille (2) » plutôt que le prénom nu, et des ex æquo couronnés
          ensemble, comme sur l'écran de victoire. */}
      {(a.winners.length > 0 || a.teamWinners.length > 0) && (
        <p className="soiree-winner">
          {a.winners.length > 0 && (
            <>
              <Icon name="trophy" /> {enumerer(a.winners.map(w => `${w.avatar} ${w.name}`))}
              {a.winners.length > 1 && ', ex æquo'} · {pts(a.winners[0].points)}
            </>
          )}
          {a.winners.length > 0 && a.teamWinners.length > 0 && ' · '}
          {a.teamWinners.length > 0 && (
            <>
              <Icon name="users" /> {enumerer(a.teamWinners.map(t => `${t.emoji} ${t.name}`))}
              {a.teamWinners.length > 1 && ', ex æquo'}
            </>
          )}
        </p>
      )}
      <PageLinks slug={slug} archiveId={a.id} />
    </section>
  )
}
