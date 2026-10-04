import { useState, type FormEvent } from 'react'
import type { PublicTeam } from '../../../shared/types'
import { EMOJIS_D_EQUIPE } from '../../../shared/teams'
import { Feuille } from './Pieces'
import { Icon } from './Icon'
import { confirmDialog } from './Dialog'

/** Le nom d'une équipe tient sur une ligne de téléphone : le serveur coupe au-delà. */
const NOM_MAX = 20

/**
 * Créer ou renommer une équipe, depuis la barre du chef : un emoji, un nom,
 * un bouton. « On ne peut pas créer d'équipe facilement » (le propriétaire
 * du dépôt, le 4 octobre 2026) : au téléphone, il fallait passer par
 * l'écran commun. Sobre — l'aperçu de l'équipe telle que la salle la verra,
 * et rien d'autre à lire.
 */
export function FeuilleDEquipe({
  equipe,
  equipes,
  onCreer,
  onModifier,
  onRetirer,
  onFermer,
}: {
  /** L'équipe à renommer ; absente, on en crée une. */
  equipe?: PublicTeam
  /** Les équipes de la soirée : l'emoji proposé d'abord est un qu'aucune ne porte. */
  equipes: readonly PublicTeam[]
  onCreer: (nom: string, emoji: string) => void
  onModifier: (teamId: string, nom: string, emoji: string) => void
  onRetirer: (teamId: string) => void
  onFermer: () => void
}) {
  const pris = new Set(equipes.filter(t => t.id !== equipe?.id).map(t => t.emoji))
  const [emoji, setEmoji] = useState(() => equipe?.emoji ?? EMOJIS_D_EQUIPE.find(e => !pris.has(e)) ?? EMOJIS_D_EQUIPE[0])
  const [nom, setNom] = useState(equipe?.name ?? '')
  const propre = nom.trim()
  const palette = [...new Set([...(equipe ? [equipe.emoji] : []), ...EMOJIS_D_EQUIPE])]

  const valider = (e?: FormEvent) => {
    e?.preventDefault()
    if (!propre) return
    if (equipe) onModifier(equipe.id, propre, emoji)
    else onCreer(propre, emoji)
    onFermer()
  }
  const retirer = async () => {
    if (!equipe) return
    const ok = await confirmDialog({
      title: `Supprimer ${equipe.name} ?`,
      message: 'Ses membres repassent sans équipe et gardent leurs points.',
      confirmLabel: 'Supprimer l’équipe',
      danger: true,
    })
    if (!ok) return
    onRetirer(equipe.id)
    onFermer()
  }

  return (
    <Feuille
      titre={equipe ? 'L’équipe' : 'Nouvelle équipe'}
      onFermer={onFermer}
      pied={
        <button type="submit" form="feuille-equipe" className="btn btn-primary btn-block" disabled={!propre}>
          {equipe ? 'Enregistrer' : 'Créer l’équipe'}
        </button>
      }
    >
      <form id="feuille-equipe" className="feuille-equipe" onSubmit={valider}>
        {/* L'équipe telle que la salle la verra : son emoji, son nom. */}
        <div className="equipe-apercu" aria-hidden="true">
          <span className="equipe-apercu-emoji">{emoji}</span>
          <span className="equipe-apercu-nom">{propre || 'Son nom'}</span>
        </div>
        <label className="field">
          <span className="label">Son nom</span>
          {/* Pas d'autoFocus : le clavier cacherait l'aperçu et les emojis. */}
          <input className="input" value={nom} maxLength={NOM_MAX} placeholder="Les Renards" onChange={e => setNom(e.target.value)} />
        </label>
        <div className="equipe-emojis" role="group" aria-label="Son emoji">
          {palette.map(e => (
            <button
              key={e}
              type="button"
              className={'equipe-emoji' + (e === emoji ? ' active' : '')}
              aria-pressed={e === emoji}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
        {equipe && (
          <button type="button" className="btn btn-block btn-ghost geste-qui-defait" onClick={() => void retirer()}>
            <Icon name="trash" />
            Supprimer l’équipe
          </button>
        )}
      </form>
    </Feuille>
  )
}
