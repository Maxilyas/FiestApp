import { useState } from 'react'
import { PERIODES_DU_POSTE, PERIODE_PAR_DEFAUT, type PeriodeDuPoste } from '../../shared/qgPeriodes'

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

/** La période retenue, si elle en est une — tout l'historique compris, que seul le poste de commande lit ; sinon la journée. */
export function periodeRetenue(): PeriodeDuPoste {
  const lue = lire(CLE_DE_LA_PERIODE)
  return (PERIODES_DU_POSTE as readonly string[]).includes(lue ?? '') ? (lue as PeriodeDuPoste) : PERIODE_PAR_DEFAUT
}

export function usePeriodeDuQg(): [PeriodeDuPoste, (p: PeriodeDuPoste) => void] {
  const [periode, setPeriode] = useState<PeriodeDuPoste>(periodeRetenue)
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
