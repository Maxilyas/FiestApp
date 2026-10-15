import { useEffect, useState } from 'react'
import { api } from './api'
import type { MissionsDuJour } from '../../shared/missions'

// Ses missions du jour, telles que la page les a lues (`GET /api/joueur/missions`) :
// la ligne de l'accueil, leur feuille et la scène du coffre les partagent —
// une lecture par page, puis celle que demande un geste (le coffre ouvert).
// La fin d'une partie relit les siennes à part (`MissionsDeLaFin`) : c'est
// elle qui annonce ce qui vient d'être fait.

let lues: MissionsDuJour | null = null
/** La première lecture a échoué, et rien n'a été lu depuis : la ligne se retire au lieu d'attendre. */
let perdues = false
let enRoute: Promise<MissionsDuJour> | null = null
const abonnes = new Set<(m: MissionsDuJour | 'perdu') => void>()

function poser(m: MissionsDuJour | 'perdu') {
  if (m === 'perdu') perdues = true
  else {
    lues = m
    perdues = false
  }
  for (const f of abonnes) f(m)
}

/** Les relit au serveur — une fois à la fois — et prévient chaque morceau de la page qui les montre. */
export function relireLesMissions(): Promise<MissionsDuJour> {
  enRoute ??= api.joueur
    .missions()
    .then(
      m => {
        poser(m)
        return m
      },
      (e: unknown) => {
        // Une relecture ratée ne retire pas ce qui se montrait déjà : seule la première se dit perdue.
        if (!lues) poser('perdu')
        throw e
      },
    )
    .finally(() => {
      enRoute = null
    })
  return enRoute
}

/**
 * S'abonner à ses missions : prévenu de chaque lecture, et tout de suite de
 * celle déjà faite. Arrivées entre le rendu d'un morceau de page et son
 * abonnement, elles ne prévenaient personne : la ligne de l'accueil restait
 * en chemin pour de bon (vu au rendu, une fois sur trois, quand le code de
 * l'accueil et sa réponse arrivaient ensemble). Rend de quoi se désabonner.
 */
export function abonnerAuxMissions(f: (m: MissionsDuJour | 'perdu') => void): () => void {
  abonnes.add(f)
  if (lues) f(lues)
  else if (perdues) f('perdu')
  return () => {
    abonnes.delete(f)
  }
}

/**
 * Ses missions, pour un morceau de la page qui les montre : demandées une
 * fois quand `demander` le dit — l'accueil, une fois montré —, puis tenues à
 * jour par chaque relecture. `null` en chemin, `'perdu'` si la lecture a
 * échoué (la page n'a pas de quoi les montrer).
 */
export function useMissionsDuJour(demander: boolean): MissionsDuJour | null | 'perdu' {
  const [m, setM] = useState<MissionsDuJour | null | 'perdu'>(lues ?? (perdues ? 'perdu' : null))
  useEffect(() => {
    const desabonner = abonnerAuxMissions(setM)
    if (demander && !lues) void relireLesMissions().catch(() => {})
    return desabonner
  }, [demander])
  return m
}

/**
 * Une mission de savoir vise une catégorie : la campagne s'ouvre sur elle,
 * comme si on venait de la choisir (`categoriesRetenues`, `CampagneApp.tsx` —
 * la même clé, écrite ici pour ne pas faire venir la page de la campagne
 * dans celle de l'accueil). Sous try/catch : un stockage refusé laisse la
 * campagne sur son dernier choix.
 */
export function viserLaCategorie(categorie: string): void {
  try {
    localStorage.setItem('quizz.campagne.categories', JSON.stringify([categorie]))
    localStorage.removeItem('quizz.campagne.sujet')
  } catch {
    // La campagne s'ouvrira sur son dernier choix : la mission se fait quand même.
  }
}
