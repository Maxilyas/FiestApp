// L'heure du serveur, vue d'un téléphone.
//
// Les chronomètres de la soirée sont des instants absolus du serveur
// (`deadline`), et chaque écran les comparait à SA propre horloge. Or celle
// d'un téléphone dérive, et certaines sont réglées à la main : un appareil qui
// retarde de cinq secondes affichait cinq secondes qui n'existaient plus — son
// porteur répondait « à quatre secondes de la fin » alors que la question était
// close, et sa réponse disparaissait. Toujours les mêmes personnes, à toutes
// les questions.
//
// On mesure donc l'écart une fois par connexion, et tous les chronomètres se
// lisent à l'heure du serveur.

/** Une mesure d'horloge : ce que le serveur a répondu, et ce qu'a coûté l'aller-retour. */
export interface ClockSample {
  /** L'heure du serveur, telle qu'il l'a écrite en répondant. */
  serverTime: number
  /** L'heure locale au départ de la demande. */
  sentAt: number
  /** L'heure locale à l'arrivée de la réponse. */
  receivedAt: number
}

/**
 * L'écart à ajouter à l'horloge locale pour lire l'heure du serveur.
 *
 * On suppose l'aller et le retour de durée égale : à l'instant où la réponse
 * arrive, le serveur est donc à `serverTime` plus la moitié de l'aller-retour.
 * L'hypothèse est fausse sur un réseau asymétrique, mais l'erreur reste bornée
 * par la moitié de l'aller-retour — et c'est précisément pourquoi on ne garde
 * que la mesure la plus rapide.
 */
export function clockOffset({ serverTime, sentAt, receivedAt }: ClockSample): number {
  return serverTime + (receivedAt - sentAt) / 2 - receivedAt
}

/**
 * La mesure à garder entre celle qu'on a et une nouvelle. La plus rapide gagne :
 * un aller-retour court laisse moins de place à l'asymétrie, donc moins d'erreur.
 * Sans mesure précédente (`null`), la nouvelle s'impose — c'est ce qui permet à
 * une reconnexion de repartir d'une horloge propre si le téléphone s'est
 * resynchronisé entre-temps.
 */
export function bestSample(current: ClockSample | null, candidate: ClockSample): ClockSample {
  if (!current) return candidate
  const rtt = (s: ClockSample) => s.receivedAt - s.sentAt
  return rtt(candidate) < rtt(current) ? candidate : current
}
