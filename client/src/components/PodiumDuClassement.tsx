import type { ReactNode } from 'react'
import { classeDeLaPlaque } from './Plaque'

// Le podium d'un classement hors d'une soirée — le quiz du jour, le défi de
// la semaine, le classement entier des duels : les trois premiers sortent de
// la liste et montent sur une scène ; la liste reprend dessous, à la
// quatrième place. Le choix du propriétaire du 18 novembre 2026 : l'écrin pour
// tous, le podium pour les trois premiers
// (`retours/2026-11-18/plaques/trois-propositions/`). Puis, le 19 : chaque
// marche, une peinture du thème de sa plaque, le gagnant debout dessus, son
// rang sur une pièce d'or, d'argent ou de bronze dans le médaillon
// (`retours/2026-11-19/podium-peint/`, la feuille : `--marche-peinte`) — sans
// plaque, la marche de la maison, le Velours. Le podium d'un quiz en soirée
// (`Marches`, `PlayerView.tsx`) n'en montre jamais (invariant 8).

/**
 * Les places du podium. Un choix de produit (`baremes.md`) : au-delà, il ne
 * tient plus sur un téléphone.
 */
export const PLACES_DU_PODIUM = 3

/**
 * Ce qui monte sur le podium, et ce qui reste dans la liste : les trois
 * premiers, ex æquo compris (le rang se lit par `shared/classement.ts`,
 * invariant 15). Pas de scène sous trois joueurs, ni quand plus de trois se
 * partagent les trois premières places — quatre ex æquo n'y tiendraient
 * pas : la liste les garde tous, comme avant. `lignes` : du plus haut au plus
 * bas.
 */
export function surLePodium<T extends { rang: number }>(lignes: readonly T[]): { podium: T[]; liste: T[] } {
  const tete = lignes.filter(l => l.rang <= PLACES_DU_PODIUM)
  if (lignes.length < PLACES_DU_PODIUM || tete.length !== PLACES_DU_PODIUM) return { podium: [], liste: [...lignes] }
  return { podium: tete, liste: lignes.filter(l => l.rang > PLACES_DU_PODIUM) }
}

/** Une marche : qui s'y tient, ce qu'il a fait, et de quoi ouvrir sa carte — le nom du bouton est celui de sa ligne. */
export interface MarcheDuPodium {
  profileId: string
  rang: number
  plaque?: string | null
  moi?: boolean
  /** Le nom de sa marche pour l'oreille : celui de sa ligne, son rang et son score compris. */
  label: string
  /** Son avatar tel qu'il le porte (`Avatar`, à la classe `lb-avatar`) : un dessin, jamais l'emoji d'en dessous. */
  visage: ReactNode
  nom: ReactNode
  /** Son score, sa cote, sa valeur — ce que sa ligne disait au bout. */
  valeur: ReactNode
}

/**
 * La scène : la deuxième à gauche, la première au milieu, la troisième à
 * droite. Deux ex æquo montent à la même hauteur, et son propre prénom se lit
 * à l'or. Un toucher ouvre sa carte, comme sa ligne. De haut en bas : le
 * prénom, le score, lui debout, sa marche — il s'y tient, devant ce qui est
 * posé sur ses coins.
 */
export function PodiumDuClassement({ marches, onOuvrir }: { marches: readonly MarcheDuPodium[]; onOuvrir?: (profileId: string) => void }) {
  if (marches.length === 0) return null
  const ordre = [1, 0, 2].filter(i => marches[i])
  return (
    <div className="podium-du-classement" role="list" aria-label="Le podium">
      {ordre.map(i => {
        const m = marches[i]
        const place = Math.min(PLACES_DU_PODIUM, Math.max(1, m.rang))
        const corps = (
          <>
            <span className="pdc-nom">{m.nom}</span>
            <span className="pdc-valeur">{m.valeur}</span>
            <span className="pdc-avatar">{m.visage}</span>
            <span className="pdc-socle">
              <b>{m.rang}</b>
            </span>
          </>
        )
        return (
          <div key={m.profileId} role="listitem" className={`pdc-marche pdc-${place}` + (m.moi ? ' me' : '') + classeDeLaPlaque(m.plaque)}>
            {onOuvrir ? (
              <button type="button" className="pdc-joueur" aria-label={m.label} onClick={() => onOuvrir(m.profileId)}>
                {corps}
              </button>
            ) : (
              <div className="pdc-joueur" role="group" aria-label={m.label}>
                {corps}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
