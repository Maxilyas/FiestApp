// Ce que le build calcule de chaque question de la base, une fois pour toutes
// (`preparerLaBase`, `scripts/empaqueter.ts`) : par les règles mêmes que le
// serveur lit — `sujetsEtRubriqueDe`, `familleCalculee`, `verdictCalcule` —,
// jamais par une copie. Le serveur ne l'importe pas : il en relit le résultat
// (`core/preparees.ts`). Seul ce module tire à la fois la campagne et le
// Cabinet, que rien d'autre ne lie.
import type { QuestionDeLaBase } from './baseCampagne'
import { familleCalculee } from './campagne'
import { masqueDuVerdict, verdictCalcule } from './cabinet/tirages/tas'
import type { PreparationDUneQuestion } from './preparees'
import { sujetsEtRubriqueDe } from '../../../shared/sujets'

/** Ce que le build range d'une question, à côté d'elle, dans la base préparée. */
export function preparationDeLaQuestion(q: QuestionDeLaBase): PreparationDUneQuestion {
  return { sujets: sujetsEtRubriqueDe(q.meta), famille: familleCalculee(q), cabinet: masqueDuVerdict(verdictCalcule(q)) }
}
