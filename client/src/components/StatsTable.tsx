import { useState } from 'react'
import type { PartyStats, PlayerStat } from '../../../shared/types'

/** Ce qu'on peut trier, et comment chaque colonne se lit. */
interface Column {
  key: string
  label: string
  title: string
  /** Null = la donnée manque (il n'a pas joué d'estimation, par exemple). */
  value: (s: PlayerStat) => number | null
  format: (s: PlayerStat) => string
  /** Trié du plus petit au plus grand — un temps de réponse, un écart. */
  asc?: boolean
}

const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)} %`)
const secs = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`)

const COLUMNS: Column[] = [
  { key: 'points', label: 'Points', title: 'Points marqués sur la soirée', value: s => s.points, format: s => String(s.points) },
  { key: 'answered', label: 'Répondu', title: 'Questions auxquelles il a répondu', value: s => s.answered, format: s => `${s.answered}/${s.asked}` },
  { key: 'correct', label: 'Justes', title: 'Bonnes réponses', value: s => s.correct, format: s => String(s.correct) },
  { key: 'wrong', label: 'Fausses', title: 'Mauvaises réponses', value: s => s.wrong, format: s => String(s.wrong) },
  { key: 'accuracy', label: 'Réussite', title: 'Part de bonnes réponses parmi celles données', value: s => s.accuracy, format: s => pct(s.accuracy) },
  { key: 'avgMs', label: 'Temps moy.', title: 'Temps de réponse moyen sur ses bonnes réponses', value: s => s.avgMs, format: s => secs(s.avgMs), asc: true },
  { key: 'bestMs', label: 'Éclair', title: 'Sa réponse juste la plus rapide', value: s => s.bestMs, format: s => secs(s.bestMs), asc: true },
  { key: 'bestStreak', label: 'Série +', title: "Plus longue série de bonnes réponses d'affilée", value: s => s.bestStreak, format: s => String(s.bestStreak) },
  { key: 'worstStreak', label: 'Série −', title: "Plus longue série de mauvaises réponses d'affilée", value: s => s.worstStreak, format: s => String(s.worstStreak) },
  { key: 'missed', label: 'Passées', title: 'Questions laissées sans réponse', value: s => s.missed, format: s => String(s.missed) },
  { key: 'changes', label: 'Revirements', title: "Fois où il a changé d'avis avant la révélation", value: s => s.changes, format: s => String(s.changes) },
  { key: 'lastSecond', label: 'Dernière s.', title: 'Réponses validées dans la dernière seconde', value: s => s.lastSecond, format: s => String(s.lastSecond) },
  { key: 'alone', label: 'Seul', title: 'Fois où il était seul de la salle sur sa réponse', value: s => s.alone, format: s => String(s.alone) },
  { key: 'followed', label: 'Majorité', title: 'Fois où il a choisi la réponse la plus populaire', value: s => s.followed, format: s => String(s.followed) },
  { key: 'guesses', label: 'Estim.', title: 'Estimations jouées (dont exactes)', value: s => s.guesses, format: s => (s.guesses ? `${s.guesses} (${s.exact}✓)` : '—') },
  { key: 'avgGapPct', label: 'Écart estim.', title: 'Écart relatif moyen sur les estimations', value: s => s.avgGapPct, format: s => pct(s.avgGapPct), asc: true },
  { key: 'bias', label: 'Biais', title: 'Positif : il surestime. Négatif : il sous-estime.', value: s => s.bias, format: s => (s.bias === null ? '—' : `${s.bias > 0 ? '+' : ''}${Math.round(s.bias * 100)} %`) },
]

/**
 * Le tableau complet, une ligne par joueur, triable par colonne.
 *
 * Toutes les colonnes tiennent rarement sur un téléphone : le tableau défile
 * horizontalement dans son propre cadre plutôt que de faire déborder la page.
 */
export function StatsTable({ stats }: { stats: PartyStats }) {
  const [sortKey, setSortKey] = useState('points')
  const column = COLUMNS.find(c => c.key === sortKey) ?? COLUMNS[0]

  const rows = [...stats.players]
    .filter(s => s.asked > 0)
    .sort((a, b) => {
      const va = column.value(a)
      const vb = column.value(b)
      // Une donnée absente finit toujours en bas, quel que soit le sens du tri.
      if (va === null && vb === null) return a.name.localeCompare(b.name, 'fr')
      if (va === null) return 1
      if (vb === null) return -1
      const diff = column.asc ? va - vb : vb - va
      return diff || a.name.localeCompare(b.name, 'fr')
    })

  if (rows.length === 0) {
    return <p className="muted">Aucune réponse enregistrée — jouez un quiz d'abord.</p>
  }

  return (
    <div className="stats-scroll">
      <table className="stats-table">
        <thead>
          <tr>
            <th className="stats-name">Joueur</th>
            {COLUMNS.map(c => (
              <th key={c.key} title={c.title}>
                <button
                  className={'stats-sort' + (c.key === sortKey ? ' active' : '')}
                  onClick={() => setSortKey(c.key)}
                >
                  {c.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(s => (
            <tr key={s.playerId}>
              <td className="stats-name">
                <span className="lb-avatar">{s.avatar}</span> {s.name}
              </td>
              {COLUMNS.map(c => (
                <td key={c.key} className={c.key === sortKey ? 'stats-active' : undefined}>
                  {c.format(s)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
