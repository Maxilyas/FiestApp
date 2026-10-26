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

/** Ce que la garde fait de `history` : le vrai, ou un faux dans les tests. */
export type HistoriqueGarde = Pick<History, 'state' | 'pushState' | 'back'> & { scrollRestoration?: ScrollRestoration }

/** Ce qu'elle écoute : la fenêtre, et son `popstate`. */
type Ecoute = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

/**
 * La marque d'une garde : `true` pour la soirée, qui reprend celle d'un
 * rechargement — l'invité y revient au même endroit, sous la même question —,
 * un jeton tiré une fois par montage pour une page qui dit sa question.
 */
export const marqueDeLaGarde = (aSaQuestion: boolean): true | string => (aSaQuestion ? `garde-${Math.random().toString(36).slice(2, 10)}` : true)

/** L'entrée porte-t-elle cette garde-là — et non celle d'un autre montage ? */
export const porteLaGarde = (etat: unknown, marque: true | string): boolean => (etat as Record<string, unknown> | null)?.[GARDE] === marque

/** Combien de gardes tiennent en ce moment : StrictMode monte deux fois, et la dernière seule retire l'entrée gardée. */
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

/**
 * Pose la garde sur `history` et écoute le retour sur `ecoute` ; rend de quoi
 * la lever. Sans React ni navigateur : `cabinet-ecran.test.ts` la joue sur un
 * faux historique, que le paramètre substitue au vrai.
 *
 * La question vit plus longtemps que la garde — au Cabinet, elle attend le
 * réseau (la pause) puis le joueur, et la partie peut se fermer entre-temps :
 * un second retour, la manche tranchée par un geste déjà en route. Levée, la
 * garde ne se repose plus quand une question finit après elle : elle
 * empilait une entrée que plus personne ne surveillait, et le retour suivant
 * tombait dans le vide.
 */
export function garder(history: HistoriqueGarde, ecoute: Ecoute, marque: true | string, question: () => Promise<IssueDuRetour>): () => void {
  let levee = false
  const gardee = () => porteLaGarde(history.state, marque)
  demandes++
  // Entre deux entrées de la même page, le navigateur remettait le
  // défilement qu'il avait noté : la fin de soirée, qui retire la garde,
  // s'ouvrait au milieu. Ici, chaque écran choisit le sien.
  history.scrollRestoration = 'manual'
  // Un rechargement garde l'état de l'entrée courante : on n'en empile pas
  // une de plus à chaque fois.
  const poser = () => {
    if (!levee && !gardee()) history.pushState({ ...((history.state as object | null) ?? {}), [GARDE]: marque }, '')
  }
  poser()

  let enQuestion = false
  const onPop = () => {
    // Revenu en avant sur l'entrée gardée, ou déjà en train de demander.
    if (gardee() || enQuestion) return
    enQuestion = true
    void question()
      .catch((): IssueDuRetour => 'reste')
      .then(issue => {
        enQuestion = false
        if (issue === 'reste') poser()
      })
  }
  ecoute.addEventListener('popstate', onPop)
  return () => {
    levee = true
    ecoute.removeEventListener('popstate', onPop)
    demandes--
    // La soirée finie ou l'invité parti, l'entrée gardée ne protège plus
    // rien : laissée là, elle ferait tomber le prochain retour dans le vide.
    // Au tour suivant, pour laisser StrictMode remonter la page d'abord.
    setTimeout(() => {
      if (demandes === 0 && gardee()) history.back()
    }, 0)
  }
}

export function useGardeRetour(actif: boolean, auRetour?: () => Promise<IssueDuRetour>) {
  // La question du jour, lue au moment du retour : la page la refait à chaque rendu, la garde ne se repose pas pour autant.
  const question = useRef(auRetour)
  question.current = auRetour
  const [marque] = useState(() => marqueDeLaGarde(auRetour !== undefined))
  useEffect(() => {
    if (!actif) return
    return garder(window.history, window, marque, () => (question.current ?? quitterLaSoiree)())
  }, [actif, marque])
}
