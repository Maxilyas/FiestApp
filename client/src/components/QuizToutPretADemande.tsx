import { aLaDemande, useALaDemande } from '../aLaDemande'
import { Feuille } from './Pieces'
import type { QuizDef } from '../../../shared/library'

/**
 * La feuille du quiz tout prêt, chargée à la demande : avec la grille des
 * catégories et la liste des sujets, elle pesait dix kilo-octets de plus au
 * premier écran de la bibliothèque et du salon, pour une feuille qu'on
 * n'ouvre qu'une fois. La feuille de choix qui y mène la précharge en
 * s'ouvrant (`quizToutPret.charger()`) : au toucher, elle est déjà là.
 */
export const quizToutPret = aLaDemande(() => import('./QuizToutPret'))

export function FeuilleDuQuizToutPretADemande({
  onFermer,
  onCompose,
  verbe,
}: {
  onFermer: () => void
  onCompose: (quiz: QuizDef) => void
  verbe?: string
}) {
  const module = useALaDemande(quizToutPret)
  if (module === 'perdu') {
    return (
      <Feuille titre="Un quiz tout prêt" onFermer={onFermer}>
        <p className="error" role="alert">
          La feuille n’a pas pu se charger : recharge la page.
        </p>
      </Feuille>
    )
  }
  return module ? <module.FeuilleDuQuizToutPret onFermer={onFermer} onCompose={onCompose} verbe={verbe} /> : null
}
