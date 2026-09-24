import { useEffect, useState } from 'react'
import { Icon } from './Icon'

/**
 * « Copier le lien » : il se dit copié deux secondes, puis redevient bouton.
 * Sans presse-papier (page en http, navigateur ancien), il ne s'affiche pas —
 * l'adresse reste dans la barre du navigateur.
 */
export function BoutonCopier({
  texte,
  libelle = 'Copier le lien',
  className = 'btn',
}: {
  texte: string
  libelle?: string
  className?: string
}) {
  const [copie, setCopie] = useState(false)
  useEffect(() => {
    if (!copie) return
    const t = setTimeout(() => setCopie(false), 2000)
    return () => clearTimeout(t)
  }, [copie])
  if (typeof navigator === 'undefined' || !navigator.clipboard) return null
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        navigator.clipboard.writeText(texte).then(
          () => setCopie(true),
          () => {},
        )
      }}
    >
      <Icon name={copie ? 'check' : 'copy'} />
      {copie ? 'Lien copié' : libelle}
    </button>
  )
}

/**
 * « Partager » : la feuille de partage du téléphone (messagerie, groupe),
 * là où elle existe — sinon rien, « Copier » suffit. Annuler la feuille
 * rejette la promesse : ce n'est pas une erreur à dire.
 */
export function BoutonPartager({ titre, url, className = 'btn' }: { titre: string; url: string; className?: string }) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return null
  return (
    <button type="button" className={className} onClick={() => navigator.share({ title: titre, url }).catch(() => {})}>
      <Icon name="arrow-up" />
      Partager
    </button>
  )
}
