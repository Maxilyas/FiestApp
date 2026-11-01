import { Corrige, verdictDe } from '../../../components/Corrige'
import { Shape } from '../../../components/Shape'
import { espacesFines } from '../../../format'
import { answersSizeClass, questionSizeClass } from '../../../games/quiz/questionSize'
import { toucher } from '../../../toucher'
import type { QuizMontre, QuizRevele } from '../../../../../shared/cabinet/jeux/quiz'
import type { JeuALEcran, PropsDUneManche } from '../Partie'

// Le Quiz à l'écran : quatre questions classiques d'un même thème, quatre
// réponses chacune et leurs formes, comme en série, sous un seul chrono. Elles
// arrivent ensemble ; la page les montre une à une, tient les réponses, et les
// envoie ensemble — à la dernière, ou d'elle-même à l'échéance, avec celles
// qu'il a eu le temps de dire. Elle ne dit jamais en route si une réponse est
// juste : le serveur ne le sait pas encore, et la page ne le saurait qu'en le
// devinant (invariant 1) ; ses points disent celles qui sont dites.
//
// Ce que la page tient, le serveur l'ignore jusqu'à l'envoi : recharger le
// perd, et « Changer », qui vient avant de répondre, se grise dès la première
// réponse donnée sur place — comme à l'Éclair, dont il suit le pas.

/** Ce que la page tient d'une manche du Quiz : sa réponse à chaque question, et celle qu'il a sous les yeux. */
export interface LocalDuQuiz {
  choix: readonly (number | null)[]
  ici: number
}

function MancheDuQuiz({ montree: m, local, setLocal, envoyer, garde, busy }: PropsDUneManche<QuizMontre, LocalDuQuiz>) {
  const n = m.questions.length
  const ici = Math.max(0, Math.min(local.ici, n - 1))
  const q = m.questions[ici]
  const effacees = m.effacees[ici] ?? []
  const repondre = (i: number) => {
    if (busy || effacees.includes(i) || !garde()) return
    const choix = local.choix.map((c, k) => (k === ici ? i : c))
    const suivante = choix.findIndex(c => c === null)
    setLocal({ choix, ici: suivante < 0 ? ici : suivante })
    if (suivante < 0) envoyer({ quoi: 'repondre', reponse: { quiz: { choix } } })
  }
  if (!q) return null
  return (
    <>
      <div className="cab-tete-question">
        <span className="cab-surtitre">{`Question ${ici + 1} sur ${n}`}</span>
        {m.theme && <span className="label quiz-categorie">{m.theme}</span>}
      </div>
      {/* Celles qui sont dites, sans dire si elles sont justes. */}
      <ol className="cab-cinq" aria-hidden="true">
        {m.questions.map((_, i) => (
          <li key={i} className={i === ici ? 'cab-ici' : local.choix[i] !== null ? 'cab-dite' : undefined} />
        ))}
      </ol>
      <h2 className={'quiz-question cab-question' + questionSizeClass(q.texte)}>{espacesFines(q.texte)}</h2>
      <div className={'ans-grid' + answersSizeClass(q.reponses)}>
        {q.reponses.map((r, i) => {
          const effacee = effacees.includes(i)
          return (
            // La clé dit la question : la suivante arrive à la place de la précédente, ses cases ne la continuent pas.
            <button
              key={`${ici}:${i}`}
              type="button"
              className={'ans-btn' + (effacee ? ' cab-effacee' : '')}
              aria-disabled={effacee || busy || undefined}
              {...toucher(() => repondre(i))}
            >
              <Shape index={i} />
              <span className="ans-text">{espacesFines(r)}</span>
              {effacee && <span className="sr-only">, effacée</span>}
            </button>
          )
        })}
      </div>
    </>
  )
}

/** La révélation : chaque question corrigée comme en série, la bonne et la sienne. */
function RevelationDuQuiz({ corps }: { corps: QuizRevele }) {
  return (
    <>
      <ol className="campagne-correction cab-corrige">
        {corps.questions.map((q, i) => (
          <Corrige
            key={i}
            verdict={verdictDe({ juste: q.choix === q.bonne, choix: q.choix })}
            tete={`Question ${i + 1}`}
            texte={q.texte}
            reponses={q.reponses}
            bonne={q.bonne}
            choix={q.choix}
          />
        ))}
      </ol>
      {/* Une pièce pour les quatre, hors de la base : aucune ne revient au carnet, et l'écran le dit, comme à l'Éclair. */}
      <p className="cab-ligne cab-hors-carnet">{espacesFines('Ces questions ne vont pas au carnet de révision de la campagne.')}</p>
    </>
  )
}

export const QUIZ: JeuALEcran<QuizMontre, QuizRevele, LocalDuQuiz> = {
  localDe: m => ({ choix: m.questions.map(() => null), ici: 0 }),
  cleDe: m => m.questions.map(q => q.texte).join('·'),
  aLEcheance: (_m, l) => ({ quiz: { choix: [...l.choix] } }),
  cibleDEclairer: (_m, l) => l.ici,
  aJoueSurPlace: (_m, l) => l.choix.some(c => c !== null),
  // La question sous les yeux change sous les mêmes quatre cases : le cadre y relance la demi-seconde de garde.
  sousEcranDe: (_m, l) => String(l.ici),
  Manche: MancheDuQuiz,
  Revelation: RevelationDuQuiz,
}
