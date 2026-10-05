import { useEffect, useRef, useState } from 'react'
import type { PublicPlayer } from '../../../shared/types'
import { moisEnToutesLettres } from '../../../shared/jour'
import { Avatar } from './Avatar'

/** Le temps d'un salut : de quoi lire un prénom du fond de la salle, sans retenir le suivant. */
const DUREE_DU_SALUT_MS = 6000

/**
 * L'entrée en scène du champion du mois : quand celui qui a fini le mois
 * dernier en tête du quiz du jour rejoint la soirée, l'écran commun le
 * salue quelques secondes. Le reste de l'année, son titre ne se lit qu'en
 * touchant son nom ; ce soir-là, la salle entière le voit arriver.
 *
 * Seulement à l'arrivée : ceux qui sont déjà là quand l'écran s'ouvre — un
 * rechargement, une télé qu'on rebranche — ne refont pas leur entrée, ni
 * celui qui revient d'une veille d'écran. Deux champions arrivés ensemble
 * passent l'un après l'autre.
 */
export function EntreeEnScene({ players }: { players: PublicPlayer[] }) {
  const vus = useRef<Set<string> | null>(null)
  const [file, setFile] = useState<PublicPlayer[]>([])
  useEffect(() => {
    if (vus.current === null) {
      vus.current = new Set(players.map(p => p.id))
      return
    }
    const deja = vus.current
    const arrives = players.filter(p => !deja.has(p.id))
    for (const p of arrives) deja.add(p.id)
    const champions = arrives.filter(p => p.champion)
    if (champions.length > 0) setFile(f => [...f, ...champions])
  }, [players])
  const salue = file[0]
  useEffect(() => {
    if (!salue) return
    const t = setTimeout(() => setFile(f => f.slice(1)), DUREE_DU_SALUT_MS)
    return () => clearTimeout(t)
  }, [salue])
  if (!salue?.champion) return null
  // Sa fiche à jour : un surnom donné entre-temps, un avatar changé.
  const p = players.find(x => x.id === salue.id) ?? salue
  return (
    <div className="entree-en-scene" role="status" key={p.id}>
      <span className="entree-rayons" aria-hidden="true" />
      <Avatar className="entree-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
      <span className="entree-texte">
        <span className="label">Place à</span>
        <b>{p.nomAffiche ?? p.name}</b>
        <span>{`Au sommet du quiz du jour en ${moisEnToutesLettres(salue.champion)}`}</span>
      </span>
    </div>
  )
}
