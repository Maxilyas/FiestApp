import type { Recap } from '../../../shared/types'
import { enumerer } from '../../../shared/classement'
import { Icon } from './Icon'

type VainqueurDeQuiz = Recap['quizWinners'][number]

/**
 * Les vainqueurs du souvenir, une carte par quiz.
 *
 * Le souvenir écrit chaque ex æquo sur sa ligne, l'un derrière l'autre, sous
 * le titre du quiz et avec le même score : deux gagnantes à 300 recevaient
 * deux cartes « Vainqueur de ce quiz », comme si le quiz en avait couronné
 * une chacune. On les réunit. La liste ne dit pas de quelle partie vient
 * chaque ligne : un même quiz joué deux fois de suite, et gagné au même score
 * par deux invités différents, finirait sur une seule carte — c'est rare, et
 * un même invité, lui, ne revient jamais deux fois sur la même.
 */
function parQuiz(vainqueurs: VainqueurDeQuiz[]): VainqueurDeQuiz[][] {
  const cartes: VainqueurDeQuiz[][] = []
  for (const v of vainqueurs) {
    const carte = cartes[cartes.length - 1]
    const memeQuiz =
      carte &&
      carte[0].title === v.title &&
      carte[0].points === v.points &&
      !carte.some(w => w.name === v.name && w.avatar === v.avatar)
    if (memeQuiz) carte.push(v)
    else cartes.push([v])
  }
  return cartes
}

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
          <span className="trophy-icon">
            <Icon name="zap" />
          </span>
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
          <span className="trophy-icon">
            <Icon name="target" />
          </span>
          <h3>Le plus régulier</h3>
          <p>
            <strong>
              {recap.steadiest.avatar} {recap.steadiest.name}
            </strong>{' '}
            — {recap.steadiest.count} {recap.steadiest.count > 1 ? 'questions marquées' : 'question marquée'}
          </p>
          <p className="muted">Présent sur tous les coups</p>
        </div>
      )}

      {parQuiz(recap.quizWinners).map((carte, i) => (
        <div key={i} className="card trophy">
          <span className="trophy-icon">
            <Icon name="award" />
          </span>
          <h3>{carte[0].title}</h3>
          <p>
            <strong>{enumerer(carte.map(w => `${w.avatar} ${w.name}`))}</strong> — {carte[0].points} points
          </p>
          <p className="muted">{carte.length > 1 ? 'Vainqueurs ex æquo de ce quiz' : 'Vainqueur de ce quiz'}</p>
        </div>
      ))}
    </div>
  )
}
