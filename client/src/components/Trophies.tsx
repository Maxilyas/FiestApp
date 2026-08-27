import type { Recap } from '../../../shared/types'

/**
 * Les prix qui ne se jouent pas au sommet du classement.
 *
 * Avec cinquante invités, trois cadeaux pour les trois premiers laissent
 * quarante-sept personnes hors course dès le deuxième quiz. Ces distinctions
 * donnent à beaucoup d'autres une raison de rester dans la partie — et à
 * l'animateur de quoi faire durer la remise des prix.
 */
export function Trophies({ recap }: { recap: Recap }) {
  const rien = !recap.bestShot && !recap.steadiest && recap.quizWinners.length === 0
  if (rien) return null

  return (
    <div className="trophies">
      {recap.bestShot && (
        <div className="card trophy">
          <span className="trophy-emoji">⚡</span>
          <h3>Le plus beau coup</h3>
          <p>
            <strong>
              {recap.bestShot.avatar} {recap.bestShot.name}
            </strong>{' '}
            — {recap.bestShot.points} points sur une seule question
          </p>
          <p className="muted">{recap.bestShot.reason}</p>
        </div>
      )}

      {recap.steadiest && (
        <div className="card trophy">
          <span className="trophy-emoji">🎯</span>
          <h3>Le plus régulier</h3>
          <p>
            <strong>
              {recap.steadiest.avatar} {recap.steadiest.name}
            </strong>{' '}
            — {recap.steadiest.count} questions marquées
          </p>
          <p className="muted">Présent sur tous les coups</p>
        </div>
      )}

      {recap.quizWinners.map((w, i) => (
        <div key={i} className="card trophy">
          <span className="trophy-emoji">🏅</span>
          <h3>{w.title}</h3>
          <p>
            <strong>
              {w.avatar} {w.name}
            </strong>{' '}
            — {w.points} points
          </p>
          <p className="muted">Vainqueur de ce quiz</p>
        </div>
      ))}
    </div>
  )
}
