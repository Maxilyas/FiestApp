// L’espace · Sciences — du robot à l’astronaute.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import type { DessinDePortrait } from './outils'

export const DESSINS: Record<string, DessinDePortrait> = {}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { espace: DESSINS } })
