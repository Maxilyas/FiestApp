import { useEffect, useState } from 'react'
import type { ArchiveList, ArchiveSummary } from '../../../shared/archive'
import { formatDay } from '../../../shared/archive'
import { Icon } from '../components/Icon'
import { confirmDialog, promptDialog } from '../components/Dialog'
import { api, UnauthorizedError } from '../api'
import { formatNumber } from '../format'

/**
 * L'historique des soirées (`/soirees`) : la soirée en cours, puis chaque
 * soirée archivée avec ses trois pages — souvenir, statistiques, bilan.
 * Publique, comme elles. L'animateur connecté peut renommer une soirée ou
 * en retirer une.
 */
export function ArchivesApp() {
  const [list, setList] = useState<ArchiveList | null>(null)
  const [error, setError] = useState('')
  const [host, setHost] = useState(false)

  const load = () =>
    fetch('/soirees.json')
      .then(r => r.json())
      .then(setList)
      .catch(() => setError("Impossible de charger l'historique."))
  useEffect(() => {
    load()
    // Les boutons de gestion n'apparaissent qu'à l'animateur connecté ; le
    // serveur revérifie de toute façon à chaque action.
    api.auth
      .me()
      .then(() => setHost(true))
      .catch(() => setHost(false))
  }, [])

  const manage = async (action: () => Promise<unknown>) => {
    try {
      await action()
      await load()
    } catch (e) {
      // Une clé périmée : les boutons disparaissent, la page reste lisible.
      if (e instanceof UnauthorizedError) setHost(false)
      else setError((e as Error).message)
    }
  }

  if (error) {
    return (
      <div className="center-page">
        <p className="error">{error}</p>
      </div>
    )
  }
  if (!list) {
    return (
      <div className="center-page">
        <p className="serif-note">Chargement…</p>
      </div>
    )
  }

  const current = list.current
  return (
    <div className="recap soirees">
      <header className="recap-header">
        <span className="label">Quizz Romane 30</span>
        <h1>Les soirées</h1>
        <p className="join-sub">L'historique, une fête après l'autre</p>
        <hr className="hairline" />
      </header>

      {current && (
        <section className="card soiree soiree-current">
          <div className="soiree-head">
            <div>
              <span className="label">En cours</span>
              <h2>La soirée du moment</h2>
              <p className="muted">
                {current.players} joueur{current.players > 1 ? 's' : ''} · {current.quizzes} quiz ·{' '}
                {current.questions} question{current.questions > 1 ? 's' : ''}
                {current.since !== null && ` · depuis le ${formatDay(current.since)}`}
              </p>
            </div>
          </div>
          <PageLinks base="" />
          <p className="muted small">
            Elle rejoindra l'historique quand l'animateur la sauvegardera depuis l'écran commun, ou
            repartira de zéro pour la suivante.
          </p>
        </section>
      )}

      {list.archives.length === 0 ? (
        <section className="card">
          <p className="muted">
            Aucune soirée archivée pour l'instant. Sur l'écran commun, « Sauvegarder » range la
            soirée en cours ici, et « Nouvelle soirée » le fait avant de tout effacer.
          </p>
        </section>
      ) : (
        list.archives.map(a => (
          <ArchiveCard
            key={a.id}
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
                message: 'Son souvenir, ses statistiques et son bilan disparaissent. C’est définitif.',
                confirmLabel: 'Retirer',
                danger: true,
              })
              if (ok) await manage(() => api.archives.remove(a.id))
            }}
          />
        ))
      )}
    </div>
  )
}

/** Les trois pages d'une soirée. `base` vaut `/soirees/<id>` pour une archive, rien pour la soirée en cours. */
function PageLinks({ base }: { base: string }) {
  return (
    <div className="row soiree-links">
      <a className="btn btn-small" href={`${base}/souvenir`}>
        <Icon name="book" />
        Souvenir
      </a>
      <a className="btn btn-small" href={`${base}/stats`}>
        <Icon name="bar-chart" />
        Statistiques
      </a>
      <a className="btn btn-small btn-accent" href={`${base}/bilan`}>
        <Icon name="list" />
        Bilan
      </a>
    </div>
  )
}

function ArchiveCard({
  archive: a,
  host,
  onRename,
  onRemove,
}: {
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
      {(a.winner || a.teamWinner) && (
        <p className="soiree-winner">
          {a.winner && (
            <>
              <Icon name="trophy" /> {a.winner.avatar} {a.winner.name} · {formatNumber(a.winner.points)} pts
            </>
          )}
          {a.winner && a.teamWinner && ' · '}
          {a.teamWinner && (
            <>
              <Icon name="users" /> {a.teamWinner.emoji} {a.teamWinner.name}
            </>
          )}
        </p>
      )}
      <PageLinks base={`/soirees/${a.id}`} />
    </section>
  )
}
