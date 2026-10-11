import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { BlasonDeLigue } from '../components/Blason'
import { espacesFines } from '../format'
import { sansAccent } from '../../../shared/homonymes'
import { LETTRES_POUR_CHERCHER, ligueParCle, type JoueurADefier } from '../../../shared/duels'
import type { AmiDeCampagne } from '../../../shared/campagne'

// Trouver quelqu'un à défier ou à ajouter à ses amis (le souhait du
// propriétaire du 11 octobre 2026 : « une barre de recherche », « une liste
// d'amis avec leur classement et leur ligue ») : par son prénom, et chacun
// dit sa ligue, sa cote et sa place — on sait contre qui l'on joue.

/** « Or · 1 240 · 3ᵉ » : sa ligue, sa cote et sa place ; rien de tout ça tant qu'il n'a fini aucun duel — l'absence, pas une ligue de bronze. */
export function sonRang(j: Pick<JoueurADefier, 'ligue' | 'cote' | 'rang'>): string {
  if (!j.ligue || j.cote === undefined) return 'pas encore de duel classé'
  return [ligueParCle(j.ligue).court, `cote ${j.cote}`, j.rang ? `${j.rang}${j.rang === 1 ? 'er' : 'e'}` : null].filter(Boolean).join(' · ')
}

/** Un joueur sur une ligne : son avatar, son prénom, sa ligue en blason, sa cote et sa place — puis ce qu'on peut faire (`children`). */
export function LigneDeJoueur({ joueur: j, children }: { joueur: JoueurADefier | AmiDeCampagne; children?: ReactNode }) {
  return (
    <div className="ligne-joueur">
      <span className="duel-ami-avatar" aria-hidden="true">
        {j.avatar}
      </span>
      <span className="ligne-joueur-nom">
        <b>{j.nom}</b>
        <span className="muted small">{espacesFines(sonRang(j))}</span>
      </span>
      {j.ligue && <BlasonDeLigue ligue={j.ligue} taille={24} decoratif />}
      {children}
    </div>
  )
}

/**
 * La barre de recherche : un prénom — sans les accents, « lea » trouve Léa —,
 * deux lettres au moins, et ceux qu'il désigne, chacun sur sa ligne avec ce
 * qu'on peut en faire (`rendre`). Aucun `autoFocus` : le clavier pousserait
 * le reste de la page hors de l'écran. La requête part une fois la frappe
 * posée, pas à chaque touche.
 */
export function ChercherUnJoueur({ libelle, rendre }: { libelle: string; rendre: (j: JoueurADefier) => ReactNode }) {
  const [texte, setTexte] = useState('')
  const [trouves, setTrouves] = useState<JoueurADefier[] | null>(null)
  const [erreur, setErreur] = useState('')
  const assez = sansAccent(texte).length >= LETTRES_POUR_CHERCHER
  useEffect(() => {
    if (!assez) {
      setTrouves(null)
      return
    }
    let vivant = true
    const minuteur = setTimeout(() => {
      setErreur('')
      api.duels
        .chercher(texte)
        .then(r => vivant && setTrouves(r))
        .catch(e => vivant && setErreur(motifDe(e)))
    }, 250)
    return () => {
      vivant = false
      clearTimeout(minuteur)
    }
  }, [texte, assez])
  return (
    <div className="chercher-joueur">
      <label className="chercher-champ">
        <Icon name="search" />
        <span className="sr-only">{libelle}</span>
        <input
          className="input"
          type="search"
          value={texte}
          onChange={e => setTexte(e.target.value)}
          placeholder="Un prénom…"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={40}
        />
      </label>
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <div role="status" aria-live="polite">
        {trouves &&
          (trouves.length === 0 ? (
            <p className="muted small">{espacesFines(`Personne ne s’appelle « ${texte.trim()} » ici.`)}</p>
          ) : (
            <ul className="joueurs-trouves" aria-label="Les joueurs trouvés">
              {trouves.map(j => (
                <li key={j.profileId}>{rendre(j)}</li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  )
}
