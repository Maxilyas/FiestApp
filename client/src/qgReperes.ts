import { useEffect, useSyncExternalStore } from 'react'
import { api } from './api'
import { JOURS_DES_REPERES, reperesDesSeaux, type RepereDuQg, type ReperesDuQg } from '../../shared/qgEffets'
import type { ModeDuQg } from '../../shared/qg'

/**
 * Les repères des courbes du QG (le principe 6 de la proposition du 3 novembre 2026, la revue du 4, P2.2) : lus une fois
 * pour toutes les courbes de la page — le poste de commande, les joueurs, chaque page de mode —, dans un magasin hors de
 * React comme le flux du direct (`qgFlux.ts`). Relus quand une courbe paraît et qu'ils ont plus d'une minute, et toutes
 * les cinq minutes tant qu'une courbe les montre, onglet visible : au serveur, les gestes d'avant aujourd'hui sont
 * gardés jusqu'à minuit, seuls ceux du jour se relisent. Un geste de la page qui en pose un (une annonce, une affiche)
 * les fait oublier (`oublierLesReperes`).
 */
const RELUS_APRES_MS = 60_000
const TOUR_MS = 5 * 60_000

let lus: ReperesDuQg | null = null
let lusLe = 0
let enRoute = false
const ecouteurs = new Set<() => void>()
const AUCUN: readonly RepereDuQg[] = []

function relire(apresMs: number) {
  if (enRoute || (lus && Date.now() - lusLe < apresMs)) return
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  enRoute = true
  api.admin
    .reperes(JOURS_DES_REPERES)
    .then(
      r => {
        lus = r
        lusLe = Date.now()
        for (const f of ecouteurs) f()
      },
      // Sans repères, les courbes se dessinent comme avant : rien à dire de plus.
      () => {},
    )
    .finally(() => {
      enRoute = false
    })
}

const abonner = (f: () => void) => {
  ecouteurs.add(f)
  return () => {
    ecouteurs.delete(f)
  }
}

/** Un geste qui pose un repère vient de partir : la courbe suivante les relit. */
export function oublierLesReperes() {
  lusLe = 0
}

/** Les repères, relus quand la courbe paraît, puis toutes les cinq minutes tant qu'elle est là. */
export function useReperesDuQg(): readonly RepereDuQg[] {
  useEffect(() => {
    relire(RELUS_APRES_MS)
    const tour = setInterval(() => relire(TOUR_MS), TOUR_MS)
    return () => clearInterval(tour)
  }, [])
  // Le troisième argument rend la page au serveur aussi (les tests) : rien n'y est encore lu.
  return useSyncExternalStore(abonner, () => lus?.reperes ?? AUCUN, () => AUCUN)
}

/**
 * Les repères d'une courbe, seau par seau : `bornes`, le début et la fin de chacun. Une page de mode ne pose que ceux qui
 * la touchent et ceux de tous (une mise en ligne, une annonce) : l'affiche de la boutique n'a rien à dire aux duels.
 */
export function reperesDeLaCourbe(reperes: readonly RepereDuQg[], bornes: readonly (readonly [number, number])[], mode?: ModeDuQg): RepereDuQg[][] {
  return reperesDesSeaux(mode ? reperes.filter(r => r.mode === null || r.mode === mode) : reperes, bornes)
}
