import { deNom } from '../format'
import type { PublicPlayer } from '../../../shared/types'
import { classer } from '../../../shared/classement'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { Rank, Score, motPoints } from './Rank'

interface Props {
  players: PublicPlayer[]
  compact?: boolean
  highlightId?: string
  /** Toucher un nom ouvre sa carte — sur le téléphone, où l'on a le temps de la lire. */
  onOuvrir?: (playerId: string) => void
}

/**
 * Classement de la soirée.
 *
 * Deux règles qui comptent quand cinquante personnes regardent l'écran :
 * · à score égal, on affiche le même rang — deux personnes à 965 points ne
 *   sont pas 1ʳᵉ et 2ᵉ, elles sont premières toutes les deux ;
 * · le tri départage par prénom affiché, sinon deux ex æquo échangeraient
 *   leur place à chaque rafraîchissement et le classement clignoterait.
 *
 * C'est la règle commune (shared/classement.ts) : le podium, le souvenir et
 * le bilan écrivent les ex æquo dans ce même ordre.
 */
export function Leaderboard({ players, compact, highlightId, onOuvrir }: Props) {
  const rows = classer(players, p => p.score, p => p.nomAffiche ?? p.name, p => p.id)
  const list = compact ? rows.slice(0, 8) : rows
  // Au-delà de la 8ᵉ ligne, l'invité ne se voyait plus : une vraie soirée
  // compte quinze à cinquante invités. On garde les huit premiers, puis sa
  // propre ligne, avec le rang que `classer` lui donne (ex æquo compris).
  const moi = compact && highlightId ? rows.slice(list.length).find(r => r.item.id === highlightId) : undefined
  const caches = rows.length - list.length - (moi ? 1 : 0)

  const ligne = ({ item: p, rang }: (typeof rows)[number]) => {
    const contenu = (
      <>
        <Rank n={rang} />
        <Avatar className="lb-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
        <span className="lb-name">{p.nomAffiche ?? p.name}</span>
        <Niveau niveau={p.niveau} />
        <Score n={p.score} />
      </>
    )
    const classe = 'lb-row' + (p.id === highlightId ? ' me' : '')
    return onOuvrir ? (
      <button
        key={p.id}
        type="button"
        className={classe + ' lb-ouvrable'}
        // Le nom du bouton remplace tout son contenu : le rang et les
        // points doivent y être, sinon le lecteur d'écran n'entend qu'un nom.
        aria-label={`La carte ${deNom(p.nomAffiche ?? p.name)} — rang ${rang}, ${p.score} ${motPoints(p.score)}`}
        onClick={() => onOuvrir(p.id)}
      >
        {contenu}
      </button>
    ) : (
      <div key={p.id} className={classe}>
        {contenu}
      </div>
    )
  }

  return (
    <div className="leaderboard">
      {list.map(ligne)}
      {list.length === 0 && <p className="muted">Personne pour l'instant…</p>}
      {moi && (
        <p className="muted center lb-ellipse" aria-hidden="true">⋯</p>
      )}
      {moi && ligne(moi)}
      {compact && caches > 0 && (
        <p className="muted center">et {caches} {caches > 1 ? 'autres' : 'autre'}…</p>
      )}
    </div>
  )
}
