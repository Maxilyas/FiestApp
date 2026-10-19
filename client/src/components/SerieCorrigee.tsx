import { Corrige, verdictDe } from './Corrige'
import { espacesFines } from '../format'
import { NOM_NIVEAU, type CorrectionDeCampagne } from '../../../shared/campagne'

/**
 * « Mes réponses » d'une partie de la campagne finie — une série, le défi de
 * la semaine, un duel, une épreuve des sentiers ou d'un parcours : chaque
 * question corrigée, son niveau, et l'anecdote qu'on a lue en jouant, pour
 * s'en souvenir. Pas de points ni de temps : la campagne compte ses bonnes
 * réponses, sans chronomètre. Cinq copies de la même liste vivaient dans
 * leurs pages — une seule retouche les change toutes.
 */
export function SerieCorrigee({ correction }: { correction: CorrectionDeCampagne[] }) {
  return (
    <ol className="campagne-correction">
      {correction.map((c, i) => (
        <Corrige
          key={i}
          verdict={verdictDe(c)}
          tete={`Question ${i + 1} · ${NOM_NIVEAU[c.niveau]}`}
          // Un vrai ou faux de l'expédition tiré d'une question à quatre choix : « Faux » ne se lit qu'avec ce qu'il proposait.
          texte={c.proposee !== undefined ? `${c.texte} — « ${c.proposee} »` : c.texte}
          reponses={c.reponses}
          bonne={c.bonne}
          choix={c.choix}
        >
          {/* Sa proposée fausse, « Faux » ne dit pas ce qu'il fallait répondre (un testeur, le 19 octobre 2026). */}
          {c.bonneReponse !== undefined && (
            <p className="corrige-vraie">
              C’était <b>{espacesFines(c.bonneReponse)}</b>
            </p>
          )}
          {c.anecdote && <p className="corrige-anecdote small">{espacesFines(c.anecdote)}</p>}
        </Corrige>
      ))}
    </ol>
  )
}
