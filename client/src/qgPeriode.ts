import { useState } from 'react'
import { PERIODES_DU_QG, PERIODE_PAR_DEFAUT, type PeriodeDuQg } from '../../shared/qgPeriodes'

// La période de la barre du QG 2, et « Comparer » : le navigateur les retient
// d'une visite à l'autre — la journée à la première ouverture, puis la
// dernière choisie (le choix du 4 novembre 2026). Un stockage refusé ne casse
// rien : le choix vaut pour la visite (règle `client.md`).

const CLE_DE_LA_PERIODE = 'quizz.qg.periode'
const CLE_DE_LA_COMPARAISON = 'quizz.qg.comparer'

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle)
  } catch {
    return null
  }
}

function ecrire(cle: string, valeur: string) {
  try {
    localStorage.setItem(cle, valeur)
  } catch {
    // Stockage refusé : le choix vaut pour cette visite.
  }
}

/** La période retenue, si elle en est une ; sinon la journée. */
export function periodeRetenue(): PeriodeDuQg {
  const lue = lire(CLE_DE_LA_PERIODE)
  return (PERIODES_DU_QG as readonly string[]).includes(lue ?? '') ? (lue as PeriodeDuQg) : PERIODE_PAR_DEFAUT
}

export function usePeriodeDuQg(): [PeriodeDuQg, (p: PeriodeDuQg) => void] {
  const [periode, setPeriode] = useState<PeriodeDuQg>(periodeRetenue)
  return [
    periode,
    p => {
      setPeriode(p)
      ecrire(CLE_DE_LA_PERIODE, p)
    },
  ]
}

export function useComparaisonDuQg(): [boolean, (oui: boolean) => void] {
  const [comparer, setComparer] = useState(() => lire(CLE_DE_LA_COMPARAISON) === 'oui')
  return [
    comparer,
    oui => {
      setComparer(oui)
      ecrire(CLE_DE_LA_COMPARAISON, oui ? 'oui' : 'non')
    },
  ]
}
