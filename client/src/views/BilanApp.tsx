import { Glossaire } from '../components/Glossaire'
import { deNom } from '../format'
import { useEffect, useMemo, useState } from 'react'
import type { Review, ReviewPlayer } from '../../../shared/review'
import { Icon } from '../components/Icon'
import { makeCtx, type BilanCtx } from '../components/BilanQuestion'
import { PlayerReview } from '../components/BilanPlayer'
import { RoomReview } from '../components/BilanRoom'
import { ArchiveBanner } from '../components/ArchiveBanner'
import { SpaceError, SpaceNav } from '../components/SpaceNav'
import { pageContext, spacePath } from '../routes'
import { lecteurDePage } from '../derniere'
import { readMe } from '../state'
import { formatDay } from '../../../shared/archive'

/**
 * Le bilan de la soirée (`/<espace>/bilan`), question par question.
 *
 * Public comme la page souvenir, et pensé pour un seul lien à poster dans le
 * groupe : chacun choisit son prénom et retrouve ce qu'il a répondu, ce que
 * son équipe a répondu et ce que la salle a répondu. Le téléphone qui a servi
 * à jouer se souvient de son invité : ouvert dessus, le lien va droit à son
 * bilan. L'onglet « La soirée » relit tout pour tout le monde, et
 * `/bilan/fiches` enchaîne une fiche imprimable par invité.
 *
 * Trois états, portés par l'adresse pour qu'un lien les retrouve :
 * `#p=<id>` le bilan d'un invité, `#salle` la relecture collective, rien du
 * tout le choix du prénom.
 */
type Mode = { kind: 'pick' } | { kind: 'me'; playerId: string } | { kind: 'room' }

function readMode(): Mode {
  const hash = window.location.hash.replace(/^#/, '')
  if (hash === 'salle') return { kind: 'room' }
  const m = /^p=([\w-]+)$/.exec(hash)
  return m ? { kind: 'me', playerId: m[1] } : { kind: 'pick' }
}

function hashOf(mode: Mode): string {
  if (mode.kind === 'me') return `#p=${mode.playerId}`
  if (mode.kind === 'room') return '#salle'
  return ''
}

export function BilanApp() {
  const { slug, archiveId } = pageContext()
  const fiches = window.location.pathname.endsWith('/bilan/fiches')
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode>(readMode)
  /** Le dernier bilan ouvert : l'onglet « Mon bilan » y revient. */
  const [lastPlayerId, setLastPlayerId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Entre deux soirées, celui de l'espace est le bilan de la dernière soirée close.
    lecteurDePage<Review>(slug, 'bilan.json', archiveId)()
      .then(setReview)
      .catch(() => setError('Impossible de charger le bilan de la soirée.'))
  }, [slug, archiveId])

  useEffect(() => {
    if (review?.space) document.title = `${review.archive?.title ?? review.space.title} · Bilan`
  }, [review])

  // Le bouton « retour » du navigateur doit marcher comme partout ailleurs.
  useEffect(() => {
    const onPop = () => setMode(readMode())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Les fiches s'impriment en Ivoire : de l'encre sur du papier crème, et pas un fond noir à imprimer.
  useEffect(() => {
    if (fiches) document.documentElement.dataset.theme = 'ivoire'
  }, [fiches])

  const ctx = useMemo(() => (review ? makeCtx(review) : null), [review])

  // Ouvert sur le téléphone qui a joué, sans lien particulier : droit à son bilan.
  useEffect(() => {
    if (!ctx || fiches || mode.kind !== 'pick' || window.location.hash) return
    const id = readMe(slug)?.playerId ?? null
    if (id && ctx.playerById.get(id)?.stat.asked) {
      history.replaceState(null, '', `#p=${id}`)
      setMode({ kind: 'me', playerId: id })
    }
    // Une fois, quand le bilan arrive : pas à chaque changement de mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx])

  useEffect(() => {
    if (mode.kind === 'me') setLastPlayerId(mode.playerId)
    setCopied(false)
    // Le bilan d'un invité peut être long : on remonte en haut quand on en change.
    window.scrollTo({ top: 0 })
  }, [mode])

  const navigate = (next: Mode) => {
    history.pushState(null, '', window.location.pathname + hashOf(next))
    setMode(next)
  }

  const copyLink = async () => {
    // Entre deux soirées, la page de l'espace montre la dernière soirée
    // close : le lien qu'on partage est celui de son archive, qui ne
    // changera pas quand la suivante jouera.
    const soiree = !archiveId ? review?.archive?.id : undefined
    const lien = soiree
      ? new URL(spacePath(slug, 'bilan', soiree) + window.location.hash, window.location.href).href
      : window.location.href
    try {
      await navigator.clipboard.writeText(lien)
      setCopied(true)
    } catch {
      // Sans presse-papier (page en http, navigateur ancien) : l'adresse est
      // dans la barre du navigateur, elle se copie à la main.
    }
  }

  if (error) return <SpaceError current="bilan" message={error} />

  if (!ctx) {
    return (
      <div className="center-page">
        <p className="serif-note">Chargement…</p>
      </div>
    )
  }

  const played = ctx.review.players.filter(p => p.stat.asked > 0)

  if (played.length === 0) {
    return (
      <div className="recap bilan">
        <BilanHead ctx={ctx} />
        <SpaceNav current="bilan" />
        <section className="card">
          <p className="muted">
            Rien à relire pour l'instant : le bilan se remplit dès la première question jouée.
          </p>
        </section>
      </div>
    )
  }

  if (fiches) return <Fiches ctx={ctx} players={played} />

  const selected = mode.kind === 'me' ? ctx.playerById.get(mode.playerId) : undefined

  return (
    <div className="recap bilan">
      <BilanHead ctx={ctx} />
      <SpaceNav current="bilan" />

      <nav className="row bilan-tabs" aria-label="Sections du bilan">
        <button
          className={'pill-btn' + (mode.kind !== 'room' ? ' active' : '')}
          onClick={() => navigate(lastPlayerId ? { kind: 'me', playerId: lastPlayerId } : { kind: 'pick' })}
        >
          <Icon name="star" />
          Mon bilan
        </button>
        <button
          className={'pill-btn' + (mode.kind === 'room' ? ' active' : '')}
          onClick={() => navigate({ kind: 'room' })}
        >
          <Icon name="users" />
          La soirée
        </button>
      </nav>

      {mode.kind === 'room' ? (
        <RoomReview ctx={ctx} />
      ) : selected && selected.stat.asked > 0 ? (
        <>
          <div className="row bilan-toolbar">
            <button className="btn btn-small btn-ghost" onClick={() => navigate({ kind: 'pick' })}>
              <Icon name="users" />
              Changer de prénom
            </button>
            <button className="btn btn-small btn-ghost" onClick={copyLink}>
              <Icon name={copied ? 'check' : 'clipboard'} />
              {copied ? 'Lien copié' : 'Copier le lien de ce bilan'}
            </button>
          </div>
          <PlayerReview ctx={ctx} player={selected} />
        </>
      ) : (
        <Picker ctx={ctx} players={played} onPick={id => navigate({ kind: 'me', playerId: id })} />
      )}

      <Glossaire mots={['bilan', 'souvenir', 'precision', 'coupDOeil']} />
      <p className="recap-foot muted">Merci d'avoir joué.</p>
      <p className="muted small center">
        Pour l'animateur :{' '}
        <a href={spacePath(slug, 'bilan/fiches', archiveId)}>les pages à imprimer, une par invité</a>
      </p>
    </div>
  )
}

/** « La soirée de Bob · samedi 14 mars » : le titre et la date de la soirée, archivée ou non. */
function partyLine(ctx: BilanCtx): string {
  const a = ctx.review.archive
  if (a) return `${a.title} · ${formatDay(a.heldAt)}`
  const space = ctx.review.space
  return space ? [space.title, space.dateLine].filter(Boolean).join(' · ') : ''
}

function BilanHead({ ctx }: { ctx: BilanCtx }) {
  const { review } = ctx
  const played = review.players.filter(p => p.stat.asked > 0).length
  const dateLine = review.archive ? formatDay(review.archive.heldAt) : review.space?.dateLine
  return (
    <header className="recap-header">
      {review.archive && <ArchiveBanner archive={review.archive} />}
      {dateLine && <span className="label">{dateLine}</span>}
      <h1>Le bilan de la soirée</h1>
      <p className="join-sub">{review.archive ? review.archive.title : review.space?.title}</p>
      {review.questions.length > 0 && (
        <p className="muted">
          {played} joueur{played > 1 ? 's' : ''} · {review.questions.length} question
          {review.questions.length > 1 ? 's' : ''} · {review.quizzes.length} quiz
        </p>
      )}
      <hr className="hairline" />
    </header>
  )
}

/** Le choix du prénom : les invités par équipe, en pastilles. */
function Picker({
  ctx,
  players,
  onPick,
}: {
  ctx: BilanCtx
  players: ReviewPlayer[]
  onPick: (playerId: string) => void
}) {
  const byName = (a: ReviewPlayer, b: ReviewPlayer) => a.name.localeCompare(b.name, 'fr')
  const teams = [...ctx.review.teams].sort((a, b) => a.position - b.position)
  const groups = teams
    .map(t => ({ key: t.id, title: `${t.emoji} ${t.name}`, members: players.filter(p => p.teamId === t.id).sort(byName) }))
    .filter(g => g.members.length > 0)
  const loose = players.filter(p => !p.teamId || !ctx.teamById.has(p.teamId)).sort(byName)
  if (loose.length > 0) groups.push({ key: 'none', title: teams.length ? 'Sans équipe' : 'Les joueurs', members: loose })

  return (
    <section className="card">
      <h2>Qui es-tu ?</h2>
      <p className="muted small">
        Choisis ton prénom : ton bilan question par question s'affiche, avec ce que ton équipe et la
        salle ont répondu.
      </p>
      <div className="bilan-groups">
        {groups.map(g => (
          <div key={g.key} className="bilan-group">
            <h3>{g.title}</h3>
            <div className="bilan-picker">
              {g.members.map(p => (
                <button key={p.id} className="bilan-chip" onClick={() => onPick(p.id)}>
                  <span className="lb-avatar">{p.avatar}</span>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Une fiche par invité, à la suite, chacune sur sa page une fois imprimée.
 * En Ivoire, comme les feuilles posées sur les tables.
 */
function Fiches({ ctx, players }: { ctx: BilanCtx; players: ReviewPlayer[] }) {
  const position = (p: ReviewPlayer) => (p.teamId ? (ctx.teamById.get(p.teamId)?.position ?? 99) : 99)
  const sorted = [...players].sort((a, b) => position(a) - position(b) || a.name.localeCompare(b.name, 'fr'))
  return (
    <div className="recap bilan fiches">
      <div className="card no-print bilan-print-bar">
        <div>
          <h2>Les pages à imprimer</h2>
          <p className="muted small">
            {/* « Fiche » était aussi le mot des chiffres d'un profil (« Ma fiche ») :
                ici, ce sont des bilans qu'on imprime. */}
            {sorted.length} bilan{sorted.length > 1 ? 's' : ''}, un par invité, par équipe puis par
            prénom. Dans la boîte d'impression, choisis « Enregistrer en PDF » : chaque bilan commence
            sur une nouvelle page.
          </p>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon name="clipboard" />
            Imprimer
          </button>
          <a className="btn btn-ghost" href={spacePath(pageContext().slug, 'bilan', pageContext().archiveId)}>
            Revenir au bilan
          </a>
        </div>
      </div>
      {sorted.map(p => (
        <section key={p.id} className="fiche">
          <header className="fiche-head">
            <span className="label">{partyLine(ctx)}</span>
            <h1>Le bilan {deNom(p.name)}</h1>
          </header>
          <PlayerReview ctx={ctx} player={p} />
        </section>
      ))}
    </div>
  )
}
