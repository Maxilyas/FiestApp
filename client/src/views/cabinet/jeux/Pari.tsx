import { Corrige, verdictDe } from '../../../components/Corrige'
import { Icon } from '../../../components/Icon'
import { Shape } from '../../../components/Shape'
import { espacesFines } from '../../../format'
import { answersSizeClass, questionSizeClass } from '../../../games/quiz/questionSize'
import { toucher } from '../../../toucher'
import { MOTS_DU_PARI } from '../../../../../shared/cabinet/jeux/regle'
import type { PariMontre, PariRevele } from '../../../../../shared/cabinet/jeux/pari'
import type { JeuALEcran, PropsDUneManche } from '../Partie'

// Le Pari à l'écran (§ 3.6) : une question facile ou moyenne, ses quatre
// réponses et leurs formes, comme en série ; juste, le choix — garder ses
// étoiles, ou les parier sur une question plus difficile de la même catégorie,
// que le serveur ne montre qu'à « Parier » —, et entre les deux, aucun chrono.
// Les mots qui comptent les étoiles viennent du barème (`MOTS_DU_PARI`) : écrits
// ici à la main, les boutons auraient promis une étoile de moins que ce que le
// serveur garde, au premier barème retouché.
//
// La page ne tient rien d'une manche du Pari : une réponse part au toucher. À
// l'échéance, la réponse part vide, et la question se juge expirée.

/** Une étape du Pari : sa question et ses quatre réponses — celles qu'Éclairer a effacées en sourdine, et dites telles à l'oreille. */
function MancheDuPari({ montree: m, envoyer, garde, busy }: PropsDUneManche<PariMontre, null>) {
  const q = m.question
  if (m.auChoix && m.choix !== undefined) return <AuChoix m={m} envoyer={envoyer} garde={garde} busy={busy} />
  return (
    <>
      <div className="cab-tete-question">
        {m.etape === 2 && <span className="cab-surtitre">Le pari · question difficile</span>}
        {q.categorie && <span className="label quiz-categorie">{q.categorie}</span>}
      </div>
      <h2 className={'quiz-question cab-question' + questionSizeClass(q.texte)}>{espacesFines(q.texte)}</h2>
      <div className={'ans-grid' + answersSizeClass(q.reponses)}>
        {q.reponses.map((r, i) => {
          const effacee = m.effacees.includes(i)
          return (
            // La clé dit l'étape : la question du pari arrive à la place de la première, ses cases ne la continuent pas.
            <button
              key={`${m.etape}:${i}`}
              type="button"
              className={'ans-btn' + (effacee ? ' cab-effacee' : '')}
              aria-disabled={effacee || busy || undefined}
              {...toucher(() => !effacee && !busy && garde() && envoyer({ quoi: 'repondre', reponse: { pari: { choix: i } } }))}
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

/**
 * Juste à la première question : sa réponse, ce que valent garder et parier,
 * et les deux gestes. Ils prennent la place des réponses sous le doigt : au
 * lever du doigt seulement (`toucher`), le `click` qui suit la réponse touchée
 * ne garde pas à sa place.
 */
function AuChoix({ m, envoyer, garde, busy }: { m: PariMontre; envoyer: PropsDUneManche<PariMontre, null>['envoyer']; garde: () => boolean; busy: boolean }) {
  const choix = m.choix ?? 0
  return (
    <>
      <h2 className="quiz-question cab-question cab-question-faite">{espacesFines(m.question.texte)}</h2>
      <p className="cab-juste">
        <Icon name="check-circle" />
        <Shape index={choix} inline />
        <b>{espacesFines(m.question.reponses[choix])}</b>
        <span className="sr-only"> : juste</span>
      </p>
      <p className="cab-ligne cab-au-choix">{espacesFines(MOTS_DU_PARI.auChoix)}</p>
      <div className="cab-choix-du-pari">
        <button type="button" className="btn btn-big" aria-disabled={busy || undefined} {...toucher(() => !busy && garde() && envoyer({ quoi: 'garder' }))}>
          {MOTS_DU_PARI.garder}
        </button>
        <button type="button" className="btn btn-primary btn-big" aria-disabled={busy || undefined} {...toucher(() => !busy && garde() && envoyer({ quoi: 'parier' }))}>
          {MOTS_DU_PARI.parier}
        </button>
      </div>
    </>
  )
}

/** La révélation : la question — et celle du pari, s'il a parié —, chacune corrigée comme en série, la bonne et la sienne. */
function RevelationDuPari({ corps }: { corps: PariRevele }) {
  return (
    <ol className="campagne-correction cab-corrige">
      {corps.questions.map((q, i) => (
        <Corrige
          key={i}
          verdict={verdictDe({ juste: q.choix === q.bonne, choix: q.choix })}
          tete={i === 0 ? 'La question' : 'Le pari · question difficile'}
          texte={q.texte}
          reponses={q.reponses}
          bonne={q.bonne}
          choix={q.choix}
        />
      ))}
    </ol>
  )
}

export const PARI: JeuALEcran<PariMontre, PariRevele, null> = {
  localDe: () => null,
  cleDe: m => `${m.etape}:${m.question.texte}`,
  aLEcheance: () => undefined,
  Manche: MancheDuPari,
  Revelation: RevelationDuPari,
}
