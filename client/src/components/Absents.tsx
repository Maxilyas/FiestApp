import { useEffect, useState } from 'react'
import type { PublicPlayer } from '../../../shared/types'
import type { QuizCommand, QuizHostView } from '../../../shared/games/quiz'
import { rendrePlace } from '../socket'
import { serverNow } from '../clock'
import { Icon } from './Icon'

interface Props {
  players: PublicPlayer[]
  /** La vue de la partie en cours, s'il y en a une. */
  quiz?: QuizHostView
  sendCommand?: (command: QuizCommand) => void
}

interface Ligne {
  playerId: string
  name: string
  avatar: string
  horsLigne: boolean
  /** La question en cours l'attend encore. */
  attendu: boolean
  dispense: boolean
}

/** « 482913 » → « 482 913 » : un code se dicte par moitiés. */
const lisible = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`

/**
 * « Qui manque ? », dans la console : ceux que la question attend encore,
 * les hors-ligne marqués — c'est ce qui aurait montré le fantôme de Rachid,
 * attendu à chaque question alors que son téléphone était mort. Et, pour un
 * hors-ligne, les deux gestes qui restent possibles pendant un quiz, quand le
 * panneau des invités a disparu : ne plus l'attendre, lui rendre sa place.
 *
 * Fermé par défaut, sous un bouton : la console est projetée, et la salle
 * n'a pas à lire qui traîne tant que l'animateur ne l'a pas demandé.
 */
export function Absents({ players, quiz, sendCommand }: Props) {
  const [ouvert, setOuvert] = useState(false)
  const [codes, setCodes] = useState<Record<string, { code: string; expiresAt: number }>>({})
  const [erreur, setErreur] = useState('')
  const [, setTic] = useState(0)

  // Un code périmé s'efface de lui-même : affiché, il ferait taper en vain.
  const enCours = Object.values(codes).length > 0
  useEffect(() => {
    if (!enCours) return
    const t = setInterval(() => setTic(n => n + 1), 5000)
    return () => clearInterval(t)
  }, [enCours])

  const enQuestion = quiz?.phase === 'question' && !!quiz.attendus
  const deLaQuestion: Ligne[] = enQuestion
    ? quiz.attendus!.map(a => ({
        playerId: a.playerId,
        name: a.name,
        avatar: a.avatar,
        horsLigne: !!a.horsLigne,
        attendu: true,
        dispense: !!a.dispense,
      }))
    : []
  const dejaLa = new Set(deLaQuestion.map(l => l.playerId))
  // Les autres hors-ligne : leur place peut se rendre à tout moment.
  const autres: Ligne[] = players
    .filter(p => !p.connected && !dejaLa.has(p.id))
    .map(p => ({ playerId: p.id, name: p.nomAffiche ?? p.name, avatar: p.avatar, horsLigne: true, attendu: false, dispense: false }))
  const lignes = [...deLaQuestion, ...autres]
  const enPlus = enQuestion ? quiz.attendusEnPlus ?? 0 : 0
  const nombre = enQuestion ? deLaQuestion.filter(l => !l.dispense).length + enPlus : autres.length

  if (lignes.length === 0 && enPlus === 0) return null

  const demanderCode = async (playerId: string) => {
    setErreur('')
    const res = await rendrePlace(playerId)
    if (!res.ok) return setErreur(res.error)
    setCodes(c => ({ ...c, [playerId]: { code: res.code, expiresAt: res.expiresAt } }))
  }

  const maintenant = serverNow()
  const libelle = enQuestion ? 'Qui n’a pas répondu ?' : 'Invités hors ligne'

  return (
    <div className="absents">
      <button
        className="btn btn-icon absents-btn"
        title={libelle}
        aria-label={`${libelle} (${nombre})`}
        aria-expanded={ouvert}
        onClick={() => setOuvert(o => !o)}
      >
        <Icon name="users" />
        {nombre > 0 && <span className="absents-nombre">{nombre}</span>}
      </button>
      {ouvert && (
        <section className="absents-panneau" aria-label={libelle}>
          <header className="absents-tete">
            <strong>{enQuestion ? `On attend encore ${nombre}` : `Hors ligne : ${autres.length}`}</strong>
            <button className="btn btn-icon btn-ghost" aria-label="Fermer" onClick={() => setOuvert(false)}>
              <Icon name="x" />
            </button>
          </header>
          <ul className="absents-liste">
            {lignes.map(l => {
              const code = codes[l.playerId]
              const codeValable = code && code.expiresAt > maintenant
              return (
                <li key={l.playerId} className={'absent' + (l.horsLigne ? ' hors-ligne' : '')}>
                  <div className="absent-qui">
                    <span className="absent-avatar" aria-hidden="true">
                      {l.avatar}
                    </span>
                    <span className="absent-nom">{l.name}</span>
                    {l.horsLigne && (
                      <span className="absent-etat">
                        <Icon name="moon" /> hors ligne
                      </span>
                    )}
                    {l.dispense && <span className="absent-etat">on ne l’attend plus</span>}
                  </div>
                  {l.horsLigne && (
                    <div className="absent-gestes">
                      {l.attendu && !l.dispense && sendCommand && (
                        <button
                          className="btn btn-small"
                          onClick={() => sendCommand({ type: 'nePlusAttendre', playerId: l.playerId })}
                        >
                          Ne plus l’attendre
                        </button>
                      )}
                      <button className="btn btn-small btn-ghost" onClick={() => void demanderCode(l.playerId)}>
                        {codeValable ? 'Un autre code' : 'Rendre sa place'}
                      </button>
                    </div>
                  )}
                  {codeValable && (
                    <p className="absent-code" role="status">
                      <span className="absent-code-chiffres">{lisible(code.code)}</span>
                      <span className="muted small">
                        Sur son nouveau téléphone, à l’entrée : « J’ai un code ». Valable 3 minutes, une seule fois.
                      </span>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
          {enPlus > 0 && <p className="muted small">et {enPlus} autres</p>}
          {erreur && (
            <p className="error small" role="alert">
              {erreur}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
