import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { BlasonDeLigue } from '../components/Blason'
import { deNom, espacesFines } from '../format'
import { sansAccent } from '../../../shared/homonymes'
import { LETTRES_POUR_CHERCHER, ligueParCle, type JoueurADefier } from '../../../shared/duels'
import type { AmiDeCampagne } from '../../../shared/campagne'
import type { RepliDeCarte } from '../components/CarteJoueur'

// Trouver quelqu'un à défier ou à ajouter à ses amis (le souhait du
// propriétaire du 11 octobre 2026 : « une barre de recherche », « une liste
// d'amis avec leur classement et leur ligue ») : par son prénom, et chacun
// dit sa ligue, sa cote et sa place — on sait contre qui l'on joue.

/** « Or · 1 240 · 3ᵉ » : sa ligue, sa cote et sa place ; rien de tout ça tant qu'il n'a fini aucun duel — l'absence, pas une ligue de bronze. */
export function sonRang(j: Pick<JoueurADefier, 'ligue' | 'cote' | 'rang'>): string {
  if (!j.ligue || j.cote === undefined) return 'pas encore de duel classé'
  // « cote » et son nombre sur la même ligne : un nombre ne quitte pas son mot.
  return [ligueParCle(j.ligue).court, `cote ${j.cote}`, j.rang ? `${j.rang}${j.rang === 1 ? 'er' : 'e'}` : null].filter(Boolean).join(' · ')
}

/**
 * Ce que sa carte montre s'il ne l'a pas ouverte à qui regarde (`RepliDeCarte`) :
 * son visage et son prénom, tels que sa ligne les montre, et ce qu'elle dit de lui.
 */
export function repliDe(j: JoueurADefier | AmiDeCampagne): RepliDeCarte {
  return { carte: { nom: j.nom, avatar: j.avatar, finition: j.finition, legendaire: j.legendaire, ...(j.eclat && { eclat: true }) }, detail: sonRang(j) }
}

/**
 * Un joueur sur une ligne : son avatar, son prénom, sa ligue en blason, sa
 * cote et sa place — puis ce qu'on peut faire (`children`). Avec `onOuvrir`,
 * la ligne entière est un bouton qui ouvre sa carte, sans rien d'autre à
 * toucher : ses gestes sont sur la carte (`GestesDuJoueur`). Un ami en ligne
 * — entre amis réciproques seulement — a sa pastille sur l'avatar ; les
 * autres, rien : l'absence, pas « hors ligne ».
 */
export function LigneDeJoueur({ joueur: j, onOuvrir, children }: { joueur: JoueurADefier | AmiDeCampagne; onOuvrir?: () => void; children?: ReactNode }) {
  const enLigne = 'enLigne' in j && j.enLigne
  const contenu = (
    <>
      {/* Ce qu'il porte, comme au classement : l'emoji seul lui donnait un autre visage. */}
      <span className={'duel-ami-avatar' + (enLigne ? ' en-ligne' : '')} aria-hidden="true">
        <Avatar avatar={j.avatar} finition={j.finition} legendaire={j.legendaire} eclat={j.eclat} />
      </span>
      <span className="ligne-joueur-nom">
        <b>{j.nom}</b>
        <span className="muted small">{espacesFines(sonRang(j))}</span>
      </span>
      {j.ligue && <BlasonDeLigue ligue={j.ligue} taille={24} decoratif />}
    </>
  )
  if (onOuvrir) {
    return (
      // Le nom du bouton remplace tout son contenu : sa ligue, sa cote, sa place — et s'il est en ligne — doivent y être.
      <button type="button" className="ligne-joueur ligne-joueur-ouvrable" aria-label={`La carte ${deNom(j.nom)} — ${sonRang(j)}${enLigne ? ', en ligne' : ''}`} onClick={onOuvrir}>
        {contenu}
      </button>
    )
  }
  return (
    <div className="ligne-joueur">
      {contenu}
      {children}
    </div>
  )
}

/**
 * Les joueurs qu'un prénom désigne — sans les accents, « lea » trouve Léa —,
 * à partir de deux lettres (`LETTRES_POUR_CHERCHER`) : `joueurs` reste null
 * en deçà, et en chemin. La requête part une fois la frappe posée, pas à
 * chaque touche.
 */
export function useJoueursTrouves(texte: string): { joueurs: JoueurADefier[] | null; cherche: boolean; erreur: string } {
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
  return { joueurs: assez ? trouves : null, cherche: assez, erreur }
}

/** Le champ de recherche d'un prénom. Aucun `autoFocus` : le clavier pousserait le reste de la page hors de l'écran. */
export function ChampDUnPrenom({ libelle, texte, onTexte }: { libelle: string; texte: string; onTexte: (texte: string) => void }) {
  return (
    <label className="chercher-champ">
      <Icon name="search" />
      <span className="sr-only">{libelle}</span>
      <input
        className="input"
        type="search"
        value={texte}
        onChange={e => onTexte(e.target.value)}
        placeholder="Un prénom…"
        autoComplete="off"
        enterKeyHint="search"
        maxLength={40}
      />
    </label>
  )
}

/**
 * La barre de recherche : un prénom, deux lettres au moins, et ceux qu'il
 * désigne, chacun sur sa ligne avec ce qu'on peut en faire (`rendre`).
 */
export function ChercherUnJoueur({ libelle, rendre }: { libelle: string; rendre: (j: JoueurADefier) => ReactNode }) {
  const [texte, setTexte] = useState('')
  const { joueurs: trouves, erreur } = useJoueursTrouves(texte)
  return (
    <div className="chercher-joueur">
      <ChampDUnPrenom libelle={libelle} texte={texte} onTexte={setTexte} />
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
