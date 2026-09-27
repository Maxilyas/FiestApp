// Réessayer une lecture jusqu'à ce qu'elle passe.
//
// Le quiz du jour n'a pas de liaison temps réel : ce que le serveur décide
// seul — la révélation d'une question laissée au temps, la question servie
// pendant qu'un tunnel avalait la réponse — le téléphone ne l'apprend qu'en
// le demandant. Demandé une fois, hors ligne à ce moment-là, et la page
// restait sur « Réponses closes », sans bouton ni message, jusqu'à ce qu'on
// la recharge — même le réseau revenu.

/** Entre deux essais manqués : assez pour ne pas harceler un réseau absent, assez peu pour que la page reparte seule. */
export const REESSAI_MS = 3000

/** Ce qui dit que le réseau revient : la fenêtre, et son évènement `online`. */
type Veilleur = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

/**
 * Lance `essai` dans `premier` ms, puis toutes les `reessai` ms tant qu'il
 * échoue — et sur-le-champ quand le navigateur se dit de nouveau en ligne,
 * une fois un essai manqué : avant, rien ne presse. Jamais deux essais en
 * vol. Rend de quoi tout arrêter : l'écran qui change n'attend plus rien.
 */
export function insister(
  essai: () => Promise<unknown>,
  { premier = 0, reessai = REESSAI_MS, veilleur = window as Veilleur }: { premier?: number; reessai?: number; veilleur?: Veilleur } = {},
): () => void {
  let arrete = false
  let enVol = false
  let minuteur: ReturnType<typeof setTimeout> | undefined
  const arreter = () => {
    arrete = true
    clearTimeout(minuteur)
    veilleur.removeEventListener('online', tenter)
  }
  function tenter() {
    clearTimeout(minuteur)
    if (arrete || enVol) return
    enVol = true
    essai().then(
      () => {
        enVol = false
        arreter()
      },
      () => {
        enVol = false
        if (arrete) return
        veilleur.addEventListener('online', tenter)
        minuteur = setTimeout(tenter, reessai)
      },
    )
  }
  minuteur = setTimeout(tenter, premier)
  return arreter
}
