import { useEffect, useState } from 'react'
import { serverNow } from './clock'

/**
 * Les secondes pleines qui restent avant une échéance, à l'heure du serveur.
 *
 * Le composant ne se réveille qu'au passage de chaque seconde, pas tous les
 * dixièmes : le chiffre affiché ne change qu'une fois par seconde, et le
 * chronomètre, rendu dix fois par seconde, occupait le téléphone pendant
 * toute la question pour rien. Chaque réveil relit `serverNow()` : une
 * horloge resynchronisée entre-temps (une reconnexion) est prise en compte
 * à la seconde suivante, jamais cumulée.
 *
 * `actif` à faux (un chronomètre en pause) : plus aucun réveil.
 */
export function useSecondesRestantes(deadline: number, actif = true): number {
  const [secondes, setSecondes] = useState(() => secondesAvant(deadline))
  useEffect(() => {
    if (!actif) return
    let id: ReturnType<typeof setTimeout>
    const reveil = () => {
      const reste = deadline - serverNow()
      setSecondes(Math.max(0, Math.ceil(reste / 1000)))
      if (reste <= 0) return
      // Juste après le passage de la seconde : réveillé une milliseconde trop
      // tôt, le chiffre ne changerait pas, et il faudrait un réveil de plus.
      id = setTimeout(reveil, (reste % 1000 || 1000) + 5)
    }
    reveil()
    return () => clearTimeout(id)
  }, [deadline, actif])
  return secondes
}

function secondesAvant(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - serverNow()) / 1000))
}
