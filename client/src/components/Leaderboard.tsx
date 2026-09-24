import { memo } from 'react'
import type { PublicPlayer } from '../../../shared/types'
import { memesChamps } from '../egalite'
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

  return (
    <div className="leaderboard">
      {list.map(({ item: p, rang }) => (
        <Ligne key={p.id} p={p} rang={rang} moi={p.id === highlightId} onOuvrir={onOuvrir} />
      ))}
      {list.length === 0 && <p className="muted">Personne pour l'instant…</p>}
      {compact && rows.length > list.length && (
        <p className="muted center">et {rows.length - list.length} autres…</p>
      )}
    </div>
  )
}

interface LigneProps {
  p: PublicPlayer
  rang: number
  moi: boolean
  onOuvrir?: (playerId: string) => void
}

/**
 * Une ligne du classement, redessinée seulement quand elle change : chaque
 * arrivée dans la salle redessinait sinon toutes les autres (voir `egalite.ts`).
 */
const Ligne = memo(function Ligne({ p, rang, moi, onOuvrir }: LigneProps) {
  const contenu = (
    <>
      <Rank n={rang} />
      <Avatar className="lb-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
      <span className="lb-name">{p.nomAffiche ?? p.name}</span>
      <Niveau niveau={p.niveau} />
      <Score n={p.score} />
    </>
  )
  const classe = 'lb-row' + (moi ? ' me' : '')
  return onOuvrir ? (
    <button
      type="button"
      className={classe + ' lb-ouvrable'}
      // Le nom du bouton remplace tout son contenu : le rang et les
      // points doivent y être, sinon le lecteur d'écran n'entend qu'un nom.
      aria-label={`La carte de ${p.nomAffiche ?? p.name} — rang ${rang}, ${p.score} ${motPoints(p.score)}`}
      onClick={() => onOuvrir(p.id)}
    >
      {contenu}
    </button>
  ) : (
    <div className={classe}>{contenu}</div>
  )
}, (a, b) => a.rang === b.rang && a.moi === b.moi && a.onOuvrir === b.onOuvrir && memesChamps(a.p, b.p))
