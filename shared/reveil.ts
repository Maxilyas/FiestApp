// Une écriture qui attend que l'hébergeur se réveille.
//
// Sans requête pendant un quart d'heure, l'offre gratuite de l'hébergeur
// endort le serveur, et l'éditeur de quiz n'en fait aucune pendant qu'on
// écrit. Le premier « Enregistrer » qui suivait échouait à coup sûr — le
// client renonce à vingt secondes, le réveil en prend soixante — et « Le
// serveur ne répond pas — vérifie ta connexion » poussait à recharger la
// page : tout ce qu'on avait écrit depuis le dernier enregistrement partait.
//
// Pur et sans navigateur : le client s'en sert, `server/test/` le vérifie.

/**
 * Ce qu'une écriture attend avant de renoncer. Le réveil prend environ une
 * minute (MISE-EN-LIGNE.md, étape 5), et la petite instance gratuite démarre
 * parfois plus lentement encore : deux, pour ne pas renoncer au moment où il
 * allait répondre.
 */
export const ATTENTE_REVEIL_MS = 120_000

/**
 * Le répit entre deux essais quand l'hébergeur a répondu tout de suite — un
 * 503 : le relancer aussitôt ne ferait que le presser. Un délai dépassé, lui,
 * a déjà attendu, et l'essai suivant part sans attendre.
 */
export const PAUSE_REVEIL_MS = 5_000

export interface Attente {
  /** Vrai pour un échec qui passe tout seul (`statutPassager`, `echecPassager`). */
  passager: (erreur: unknown) => boolean
  /** Appelé au premier échec passager, une seule fois : c'est le moment de dire qu'on attend. */
  surAttente?: () => void
  /** Faux quand plus personne n'attend la réponse — l'éditeur est fermé : on renonce. */
  continuer?: () => boolean
  pendantMs?: number
  pauseMs?: number
  /** L'horloge et l'attente, que les tests remplacent. */
  maintenant?: () => number
  dormir?: (ms: number) => Promise<void>
}

/**
 * Rejoue `appel` tant qu'il échoue d'un échec passager, jusqu'à `pendantMs` ;
 * tout autre échec, et le dernier passager, remontent tels quels. Seul un
 * appel qu'on peut rejouer sans dommage passe par ici : un essai abandonné
 * par le client a pu arriver quand même, après le réveil.
 */
export async function enAttendantLeReveil<T>(appel: () => Promise<T>, attente: Attente): Promise<T> {
  const maintenant = attente.maintenant ?? Date.now
  const dormir = attente.dormir ?? ((ms: number) => new Promise<void>(fin => setTimeout(fin, ms)))
  const continuer = attente.continuer ?? (() => true)
  const pendantMs = attente.pendantMs ?? ATTENTE_REVEIL_MS
  const pauseMs = attente.pauseMs ?? PAUSE_REVEIL_MS
  const debut = maintenant()
  let prevenu = false
  for (;;) {
    const essai = maintenant()
    try {
      return await appel()
    } catch (erreur) {
      if (!attente.passager(erreur)) throw erreur
      const pause = Math.max(0, pauseMs - (maintenant() - essai))
      // On n'entame plus d'essai passé le délai : le dernier motif dit alors quoi faire.
      if (maintenant() + pause - debut >= pendantMs || !continuer()) throw erreur
      if (!prevenu) {
        prevenu = true
        attente.surAttente?.()
      }
      await dormir(pause)
      if (!continuer()) throw erreur
    }
  }
}
