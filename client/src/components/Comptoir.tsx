import { useEffect, useState } from 'react'
import { api } from '../api'
import { SABLIERS_MAX } from '../../../shared/jour'
import type { PublicProfileDetail } from '../../../shared/profil'
import type { VieDesSentiers } from '../../../shared/sentiers'
import { OBJETS, type CleDObjet, type Objet } from './Objets'
import { PrixDeLaTuile } from './Boutique'

// Le comptoir des objets : ce qui sert en jeu et s'achète en confettis — une
// vie des sentiers, un sablier pour la série du quiz du jour, l'Éclat. Trois
// lignes dans une carte (la refonte du 10 novembre 2026) : son dessin, son
// nom, ce qu'il change pour lui et ce qu'il en a, son prix. En grandes cases,
// une par objet, le comptoir faisait 593 px de haut pour trois articles, plus
// que l'écran d'un petit téléphone. Toucher une ligne ouvre son présentoir —
// ce que c'est, combien on en prend, ce que ça coûte —, d'où l'on achète,
// jamais d'un toucher. C'est le serveur qui compte : les vies avec les
// sentiers, les sabliers avec la série.

/** Ce que le comptoir sait de lui, et de quoi acheter : la ligne d'un objet et son présentoir le lisent au même endroit. */
export interface Comptoir {
  /**
   * Ce qu'il en a : en court sur sa ligne — rien quand il n'y a rien à dire,
   * un « 0 » seul ne disait pas de quoi —, en entier dans sa fiche. Null tant
   * qu'on ne le sait pas : les vies se lisent à part, avec les sentiers.
   */
  possede: (o: Objet) => { court: string | null; long: string } | null
  /** Combien il peut en prendre d'un coup — pour le sablier, la place qui reste : deux au plus, et ce qu'il a en prend. */
  maximum: (o: Objet) => number
  /** Achète ce nombre : le solde que le serveur rend part à la page. Lève le refus du serveur, que la fiche dit. */
  acheter: (o: Objet, nombre: number) => Promise<void>
}

/** Ce qu'il a de chaque objet, lu une fois pour la page, et tenu à jour par chaque achat. */
export function useComptoir(profil: PublicProfileDetail, onSolde: (solde: number) => void): Comptoir {
  const [vies, setVies] = useState<VieDesSentiers | null>(null)
  const [sabliers, setSabliers] = useState(profil.jour?.sabliers ?? 0)
  const [eclats, setEclats] = useState(profil.eclatsEnReserve ?? 0)
  useEffect(() => {
    let vivant = true
    api.campagne.sentiers
      .etat()
      .then(e => vivant && setVies(e.vies))
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])
  return {
    // Les vies du jour reviennent chaque matin : la ligne ne compte que la réserve.
    possede: o => {
      if (o.cle === 'vie') return vies ? { court: vies.reserve > 0 ? `${vies.reserve} en réserve` : null, long: `${vies.jour} aujourd’hui · ${vies.reserve} en réserve` } : null
      if (o.cle === 'eclat') return { court: eclats > 0 ? `${eclats} en réserve` : null, long: `${eclats} en réserve, dans ta loge` }
      const serie = profil.jour?.serie ?? 0
      return { court: `${sabliers} sur ${SABLIERS_MAX}`, long: `${sabliers} sur ${SABLIERS_MAX} · ta série : ${serie} jour${serie > 1 ? 's' : ''}` }
    },
    maximum: o => (o.cle === 'sablier' ? SABLIERS_MAX - sabliers : o.maximum),
    acheter: async (o, nombre) => {
      if (o.cle === 'vie') {
        const e = await api.campagne.sentiers.acheterVies(nombre)
        setVies(e.vies)
        if (e.confettis !== undefined) onSolde(e.confettis)
      } else if (o.cle === 'eclat') {
        const r = await api.joueur.acheterUnEclat()
        setEclats(r.enReserve)
        onSolde(r.confettis.solde)
      } else {
        const r = await api.jour.sablier(nombre)
        setSabliers(r.sabliers)
        onSolde(r.confettis.solde)
      }
    },
  }
}

export function RayonDesObjets({
  comptoir,
  solde,
  envie,
  onOuvrir,
}: {
  comptoir: Comptoir
  solde: number
  /** L'objet pour lequel il économise. */
  envie?: string
  onOuvrir: (cle: CleDObjet) => void
}) {
  return (
    <ul className="comptoir" aria-label="Les objets">
      {OBJETS.map(o => {
        const a = comptoir.possede(o)
        return (
          <li key={o.cle}>
            <button type="button" className={`comptoir-objet objet-${o.cle}`} aria-haspopup="dialog" onClick={() => onOuvrir(o.cle)}>
              <span className="objet-dessin">{o.dessin()}</span>
              <span className="comptoir-texte">
                <b className="objet-nom">{o.nom}</b>
                <span className="comptoir-accroche">
                  {o.accroche}
                  {a?.court && (
                    <span className="comptoir-a-toi" aria-hidden="true">
                      {` Tu en as ${a.court}.`}
                    </span>
                  )}
                </span>
                {a && <span className="sr-only">{`Tu en as : ${a.long}`}</span>}
                {envie === o.cle && <span className="sr-only">Ton envie.</span>}
              </span>
              <PrixDeLaTuile prix={o.prix} solde={solde} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
