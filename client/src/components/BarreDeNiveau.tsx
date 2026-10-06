import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatNumber } from '../format'
import { CollectionOuverte } from './Ouverts'
import { NOM_FINITION, finitionsOuvertes, type PublicProfile } from '../../../shared/profil'

/**
 * Le dernier niveau que cette page a vu : celui du profil à son ouverture,
 * puis celui de chaque fin. Une fin de série ou d'épreuve dit la montée de
 * niveau qu'elle a faite en s'y comparant (`BarreDeNiveau`).
 */
let niveauVu: number | null = null

/** La page vient de lire le profil : son niveau sert de point de départ. */
export function retenirLeNiveau(niveau: number | undefined): void {
  if (niveau !== undefined) niveauVu = niveau
}

/**
 * La barre de niveau d'une fin de série ou d'épreuve de campagne, relue
 * après elle. Le quiz du jour la montrait ; la campagne ne disait que
 * « +12 XP », et l'on ne voyait pas qu'on avançait (le 6 octobre 2026). La
 * montée qu'elle a faite se dit comme au quiz du jour : « Niveau 8 ! », la
 * finition, l'emoji de collection à porter.
 */
export function BarreDeNiveau() {
  // Le niveau d'avant se lit au premier rendu : la relecture le remplace.
  const [avant] = useState(() => niveauVu)
  const [profil, setProfil] = useState<PublicProfile | null>(null)
  useEffect(() => {
    let vivant = true
    api.joueur
      .moiLeger()
      .then(({ profile }) => {
        if (!vivant || !profile) return
        niveauVu = profile.niveau
        setProfil(profile)
      })
      // Muette, elle ne montre rien : la fin de la série reste lisible sans elle.
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])
  if (!profil) return null
  const monte = avant !== null && profil.niveau > avant
  const finitions = monte && avant !== null ? finitionsOuvertes(profil.niveau).filter(f => !finitionsOuvertes(avant).includes(f)) : []
  const part = profil.requis > 0 ? Math.min(100, (profil.acquis / profil.requis) * 100) : 100
  return (
    <>
      <section className="card fin-gain barre-de-niveau">
        <div
          className="xp-bar"
          role="progressbar"
          aria-label={`Niveau ${profil.niveau}`}
          aria-valuemin={0}
          aria-valuemax={profil.requis || 1}
          aria-valuenow={profil.requis > 0 ? profil.acquis : 1}
        >
          <div className="xp-fill" style={{ width: `${part}%` }} />
        </div>
        <p className="muted small">
          {profil.requis > 0
            ? `Niveau ${profil.niveau} · ${formatNumber(profil.acquis)} / ${formatNumber(profil.requis)} XP vers le niveau ${profil.niveau + 1}`
            : `Niveau ${profil.niveau} · au sommet`}
        </p>
        {monte && <p className="fin-monte">Niveau {profil.niveau} !</p>}
        {finitions.length > 0 && (
          <p className="fin-finition">
            Nouvelle finition : <b>{finitions.map(f => NOM_FINITION[f]).join(', ')}</b>
          </p>
        )}
      </section>
      {monte && avant !== null && <CollectionOuverte avant={avant} apres={profil.niveau} finition={profil.finition} />}
    </>
  )
}
