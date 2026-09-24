import { useEffect } from 'react'
import { confirmDialog } from './components/Dialog'

/**
 * Le geste retour d'Android, en pleine soirée.
 *
 * Souvent involontaire — un pouce qui glisse du bord de l'écran —, il
 * ramenait à l'appareil photo qui avait scanné le QR, en pleine question.
 * Une entrée d'historique posée en salle d'attente l'absorbe, et le retour
 * demande alors s'il faut vraiment partir.
 *
 * Sans piéger personne : pendant que la question est posée, un second retour
 * quitte pour de bon — l'entrée est déjà consommée —, et « Quitter » fait le
 * retour qu'on demandait.
 */
const GARDE = 'fiestappGarde'

const gardee = () => (history.state as Record<string, unknown> | null)?.[GARDE] === true

/** Combien de pages demandent la garde en ce moment : StrictMode monte deux fois. */
let demandes = 0

export function useGardeRetour(actif: boolean) {
  useEffect(() => {
    if (!actif) return
    demandes++
    // Entre deux entrées de la même page, le navigateur remettait le
    // défilement qu'il avait noté : la fin de soirée, qui retire la garde,
    // s'ouvrait au milieu. Ici, chaque écran choisit le sien.
    history.scrollRestoration = 'manual'
    // Un rechargement garde l'état de l'entrée courante : on n'en empile pas
    // une de plus à chaque fois.
    const poser = () => {
      if (!gardee()) history.pushState({ ...(history.state ?? {}), [GARDE]: true }, '')
    }
    poser()

    let enQuestion = false
    const onPop = () => {
      // Revenu en avant sur l'entrée gardée, ou déjà en train de demander.
      if (gardee() || enQuestion) return
      enQuestion = true
      void confirmDialog({
        title: 'Quitter la soirée ?',
        message: 'Ta place t’attend : en revenant à cette adresse, tu la retrouves avec tes points.',
        cancelLabel: 'Rester',
        confirmLabel: 'Quitter',
        danger: true,
      }).then(quitter => {
        enQuestion = false
        if (quitter) history.back()
        else poser()
      })
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      demandes--
      // La soirée finie ou l'invité parti, l'entrée gardée ne protège plus
      // rien : laissée là, elle ferait tomber le prochain retour dans le vide.
      // Au tour suivant, pour laisser StrictMode remonter la page d'abord.
      setTimeout(() => {
        if (demandes === 0 && gardee()) history.back()
      }, 0)
    }
  }, [actif])
}
