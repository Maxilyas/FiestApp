import { useEffect, useRef, useState } from 'react'
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
 *
 * Une page peut dire elle-même ce que le retour demande (`auRetour`) : au
 * Cabinet de curiosités, pendant une manche, c'est son « Quitter ? » — la
 * pause, puis la partie comptée avec ses étoiles (`views/cabinet/Partie.tsx`).
 * Sa garde porte alors un jeton à elle, tiré à son montage : une garde laissée
 * par un rechargement (la page la garde, `effacerLaMarqueAuChargement`) ne se
 * prend pas pour la sienne — sans quoi la manche suivante n'en posait pas, le
 * retour fermait la partie sans rien demander, et la garde retirée en partant
 * reculait d'une entrée de trop, parfois hors du Cabinet.
 */
const GARDE = 'fiestappGarde'

/** Ce que décide la question du retour : partir (la page s'en charge), ou rester — la garde se repose. */
export type IssueDuRetour = 'parti' | 'reste'

/** Combien de pages demandent la garde en ce moment : StrictMode monte deux fois. */
let demandes = 0

/** La question de la soirée : partir pour de bon, ou rester. */
function quitterLaSoiree(): Promise<IssueDuRetour> {
  return confirmDialog({
    title: 'Quitter la soirée ?',
    message: 'Ta place t’attend : en revenant à cette adresse, tu la retrouves avec tes points.',
    cancelLabel: 'Rester',
    confirmLabel: 'Quitter',
    danger: true,
  }).then(quitter => {
    if (quitter) history.back()
    return quitter ? 'parti' : 'reste'
  })
}

export function useGardeRetour(actif: boolean, auRetour?: () => Promise<IssueDuRetour>) {
  // La question du jour, lue au moment du retour : la page la refait à chaque rendu, la garde ne se repose pas pour autant.
  const question = useRef(auRetour)
  question.current = auRetour
  // `true` pour la soirée, qui reprend la garde d'un rechargement ; un jeton à soi pour une page qui dit sa question.
  const [marque] = useState<true | string>(() => (auRetour ? `garde-${Math.random().toString(36).slice(2, 10)}` : true))
  useEffect(() => {
    if (!actif) return
    const gardee = () => (history.state as Record<string, unknown> | null)?.[GARDE] === marque
    demandes++
    // Entre deux entrées de la même page, le navigateur remettait le
    // défilement qu'il avait noté : la fin de soirée, qui retire la garde,
    // s'ouvrait au milieu. Ici, chaque écran choisit le sien.
    history.scrollRestoration = 'manual'
    // Un rechargement garde l'état de l'entrée courante : on n'en empile pas
    // une de plus à chaque fois.
    const poser = () => {
      if (!gardee()) history.pushState({ ...(history.state ?? {}), [GARDE]: marque }, '')
    }
    poser()

    let enQuestion = false
    const onPop = () => {
      // Revenu en avant sur l'entrée gardée, ou déjà en train de demander.
      if (gardee() || enQuestion) return
      enQuestion = true
      void (question.current ?? quitterLaSoiree)()
        .catch((): IssueDuRetour => 'reste')
        .then(issue => {
          enQuestion = false
          if (issue === 'reste') poser()
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
  }, [actif, marque])
}
