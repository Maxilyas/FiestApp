import { useEffect, useState, type CSSProperties } from 'react'
import type { QuizHostView } from '../../../../shared/games/quiz'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { Shape } from '../../components/Shape'
import { serverNow } from '../../clock'
import { espacesFines, formatNumber, secondes } from '../../format'

// La régie : la télécommande du chef qui anime sans jouer, au téléphone.
// Ce que la salle ne voit pas d'un coup d'œil : le temps qui reste, qui
// a répondu, qui l'on attend encore — puis, à la révélation, comment la
// salle s'est partagée. Jamais la bonne réponse avant la salle : le
// téléphone de l'animateur se voit par-dessus l'épaule, et la vue des
// écrans d'animateur ne la porte qu'à la révélation (invariant 1).

/** La part écoulée d'une question, relue cinq fois par seconde : l'anneau se vide sans saccade. */
function useEcoule(deadline: number | undefined, duree: number | undefined, actif: boolean) {
  const [maintenant, setMaintenant] = useState(serverNow)
  useEffect(() => {
    if (!actif) return
    const id = setInterval(() => setMaintenant(serverNow()), 200)
    return () => clearInterval(id)
  }, [actif])
  if (!deadline || !duree) return { part: 0, reste: 0 }
  const reste = Math.max(0, deadline - maintenant)
  return { part: Math.min(1, Math.max(0, 1 - reste / (duree * 1000))), reste }
}

/** Le chronomètre en anneau : il se vide, et se presse sur la fin. */
export function Anneau({ part, reste, pause }: { part: number; reste: number; pause: boolean }) {
  const r = 26
  const tour = 2 * Math.PI * r
  return (
    <span className={'regie-anneau' + (part > 0.75 && !pause ? ' presse' : '')} role="timer" aria-label={pause ? 'En pause' : `${Math.ceil(reste / 1000)} secondes`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} className="regie-anneau-fond" />
        <circle cx="32" cy="32" r={r} className="regie-anneau-plein" strokeDasharray={`${tour * (1 - part)} ${tour}`} />
      </svg>
      <b aria-hidden="true">{pause ? <Icon name="pause" /> : Math.ceil(reste / 1000)}</b>
    </span>
  )
}

/** Juste à la révélation : la bonne, les bonnes de « plusieurs » ; « ordre » et le sondage n'en marquent aucune. */
function estBonne(v: QuizHostView, i: number): boolean {
  if (v.variante === 'plusieurs') return !!v.bonnes?.includes(i)
  if (v.variante === 'ordre' || v.variante === 'sondage') return false
  return i === v.correct
}

export function Regie({ view: v }: { view: QuizHostView }) {
  const enQuestion = v.phase === 'question'
  const revelee = v.phase === 'reveal'
  const pause = !!v.paused
  const { part, reste } = useEcoule(v.deadline, v.duration, enQuestion && !pause)
  const restant = pause ? (v.remainingMs ?? 0) : reste
  const partEnPause = pause && v.duration ? Math.min(1, 1 - (v.remainingMs ?? 0) / (v.duration * 1000)) : part
  const repondu = v.answeredCount ?? 0
  const salle = v.participantCount ?? 0
  const max = Math.max(1, ...(v.counts ?? [0]))
  const barres = revelee && v.counts && v.variante !== 'ordre'

  return (
    <div className="regie">
      <section className="regie-question">
        {enQuestion ? (
          <Anneau part={partEnPause} reste={restant} pause={pause} />
        ) : (
          <span className="regie-anneau regie-revele" aria-hidden="true">
            <Icon name="check" />
          </span>
        )}
        <div>
          {v.category && <span className="label">{v.category}</span>}
          <h2 className="telecommande-question">{espacesFines(v.text ?? '')}</h2>
        </div>
      </section>

      {v.kind === 'choice' && v.answers && (
        <ol className="regie-reponses">
          {v.answers.map((texte, i) => (
            <li
              key={i}
              className={(revelee && estBonne(v, i) ? 'regie-bonne' : '') + (barres ? ' regie-barre' : '')}
              style={barres ? ({ '--part': (v.counts![i] ?? 0) / max } as CSSProperties) : undefined}
            >
              <Shape index={i} />
              <span className="regie-texte">{espacesFines(texte)}</span>
              {revelee && estBonne(v, i) && <Icon name="check" className="regie-coche" />}
              {barres && <span className="regie-nombre">{v.counts![i] ?? 0}</span>}
            </li>
          ))}
        </ol>
      )}

      {v.kind === 'number' && revelee && v.target !== undefined && (
        <p className="regie-cible">
          La réponse : <b>{formatNumber(v.target)}</b>
          {v.unit ? ` ${v.unit}` : ''}
        </p>
      )}

      <section className="regie-salle" aria-label="La salle">
        <div className="regie-salle-tete">
          <span className="label">{revelee ? 'Ont répondu' : 'Réponses'}</span>
          <span className="regie-compteur" aria-live="polite">
            <b>{repondu}</b>/{salle}
          </span>
        </div>
        {/* Qui l'on attend encore : c'est d'eux que l'animateur a besoin, le
            téléphone éteint ou le distrait — les hors-ligne d'abord. */}
        {enQuestion && (v.attendus?.length ?? 0) > 0 && (
          <ul className="regie-visages" aria-label="On attend">
            {v.attendus!.map(a => (
              <li key={a.playerId} className={'regie-visage' + (a.horsLigne ? ' regie-hors-ligne' : '')}>
                <Avatar className="regie-avatar" avatar={a.avatar} />
                <span className="regie-prenom">{a.name}</span>
              </li>
            ))}
            {(v.attendusEnPlus ?? 0) > 0 && <li className="regie-visage regie-en-plus">+{v.attendusEnPlus}</li>}
          </ul>
        )}
        {revelee && v.fastest && (
          <p className="regie-rapide">
            <Icon name="zap" /> Le plus rapide : <b>{v.fastest.name}</b>, {secondes(v.fastest.ms)}
          </p>
        )}
        {revelee && v.anecdote && <p className="regie-anecdote small">{espacesFines(v.anecdote)}</p>}
      </section>
    </div>
  )
}
