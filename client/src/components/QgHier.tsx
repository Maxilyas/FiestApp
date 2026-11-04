import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { Icon } from './Icon'
import { TuileDuQg } from './QgGraphes'
import { espacesFines, formatNumber } from '../../../shared/typographie'
import { dureeEcrite, heureEcrite } from '../../../shared/qg'
import { jourEnToutesLettres } from '../../../shared/jour'
import { heureDuPointEcrite, pointDuMatin, type HierDuQg, type PointDuMatin } from '../../../shared/pointDuMatin'

/** Tant que la mémoire ne sait pas la veille, la page la redemande à ce pas : le serveur, lui, ne relit rien d'ici là. */
const RELECTURE_MS = 5 * 60_000

/** Les salons que la ligne nomme, au plus : le reste se compte. */
const SALONS_NOMMES = 4

/**
 * « Hier, en bref », en tête du poste de commande (la revue d'expert du
 * 4 novembre 2026, P1.4) : la journée face à son habitude, les nouveaux et
 * leur lendemain, les soirées et leurs animateurs, les incidents, ce qui
 * attend un geste, et une phrase pour ce qui s'écarte le plus — le lundi, la
 * semaine face aux quatre d'avant. La même dérivation que la notification du
 * point du matin (`pointDuMatin`), lue dans la mémoire du QG que le serveur
 * garde jusqu'à minuit (`GET /api/admin/qg/hier`) ; ce qui attend vient de la
 * liste du poste, à l'instant. Au téléphone, replié derrière sa ligne — la
 * notification même — ; à l'ordinateur, tout dehors. La notification l'ouvre
 * (`/admin#hier`).
 */
export function HierEnBref({ jour, aTraiter }: { jour: string | null; aTraiter: number | null }) {
  const [hier, setHier] = useState<HierDuQg | null>(null)
  const [deplie, setDeplie] = useState(() => {
    try {
      return window.location.hash === '#hier'
    } catch {
      return false
    }
  })
  const section = useRef<HTMLElement>(null)
  /** Ouvert par la notification : le bandeau se met en vue une fois, au premier lu. */
  const enVue = useRef(deplie)
  const attend = hier !== null && hier.entree === null
  useEffect(() => {
    let perimee = false
    const lire = () => {
      if (document.visibilityState !== 'visible') return
      // Un bandeau qui ne se lit pas se tait : le poste de commande vit sans lui.
      api.admin.hier().then(
        h => !perimee && setHier(h),
        () => {},
      )
    }
    lire()
    const tour = attend ? setInterval(lire, RELECTURE_MS) : null
    return () => {
      perimee = true
      if (tour) clearInterval(tour)
    }
  }, [jour, attend])
  useEffect(() => {
    const ici = section.current
    if (!enVue.current || !hier?.entree || !ici) return
    enVue.current = false
    // Sous la barre de commande, collée en haut : sans elle, sa tête — le jour, « Hier, en bref » — passait dessous.
    const barre = document.querySelector('.qg-commande')?.getBoundingClientRect().height ?? 0
    window.scrollTo({ top: Math.max(0, ici.getBoundingClientRect().top + window.scrollY - barre - 12) })
  }, [hier])

  if (!hier) return null
  const point = hier.entree ? pointDuMatin({ ...hier.entree, aTraiter }) : null
  if (!point) {
    return (
      <section className="qg-console qg-hier" aria-labelledby="qg-hier-titre" ref={section}>
        <div className="qg-console-tete">
          <h2 id="qg-hier-titre">Hier, en bref</h2>
        </div>
        <p className="muted small">La journée d’hier s’écrit à {heureDuPointEcrite(hier.point.minutes)}, avec le point du matin — ou dès qu’on ouvre la page des joueurs.</p>
      </section>
    )
  }
  return (
    <section className={'qg-console qg-hier' + (deplie ? '' : ' qg-hier-replie')} id="hier" aria-labelledby="qg-hier-titre" ref={section}>
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">{enTete(point.date)}</span>
          <h2 id="qg-hier-titre">Hier, en bref</h2>
          <span className="muted small">{point.semaine ? 'face aux sept jours d’avant, et la semaine face aux quatre d’avant' : 'face aux sept jours d’avant'}</span>
        </div>
      </div>
      <div className="qg-hier-corps">
        <div className="qg-hier-texte">
          {point.phrase && <p className="qg-hier-phrase">{espacesFines(point.phrase)}</p>}
          <button type="button" className="lien-discret qg-hier-deplier" aria-expanded={deplie} onClick={() => setDeplie(!deplie)}>
            {deplie ? 'Replier' : sansLaTete(point.notification.corps)}
            <Icon name="chevron-down" />
          </button>
          <ul className="qg-hier-lignes">
            {point.animateurs.length > 0 && <li>{lesAnimateurs(point)}</li>}
            <li>{lesIncidents(point)}</li>
            {point.aTraiter !== null && (
              <li>
                {point.aTraiter === 0
                  ? 'Rien n’attend de geste.'
                  : espacesFines(`${point.aTraiter > 1 ? `${formatNumber(point.aTraiter)} choses attendent` : 'Une chose attend'} un geste, dans « À traiter ».`)}
              </li>
            )}
          </ul>
        </div>
        <ul className="qg-tuiles qg-tuiles-quatre qg-hier-tuiles">
          {point.chiffres.map(c => (
            <TuileDuQg key={c.cle} nom={c.nom} valeur={c.valeur} ecart={c.ecart} detail={c.detail} />
          ))}
        </ul>
        {point.semaine && (
          <div className="qg-hier-semaine">
            <h3 className="qg-etiquette">La semaine du {jourEnToutesLettres(point.semaine.du, true)}, face aux quatre d’avant</h3>
            <ul className="qg-tuiles qg-tuiles-quatre">
              {point.semaine.chiffres.map(c => (
                <TuileDuQg key={c.cle} nom={c.nom} valeur={c.valeur} ecart={c.ecart} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

const enTete = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** La ligne repliée du téléphone : la notification sans sa tête — le bandeau la dit déjà. */
const sansLaTete = (corps: string) => corps.replace(/^Hier\s*:\s*/u, '')

/** « Chez Léa, sa toute première soirée · chez Max, qui revient » : le nouvel animateur, et celui qui revient. */
function lesAnimateurs(p: PointDuMatin): string {
  const nommes = p.animateurs.slice(0, SALONS_NOMMES).map(a => `${a.nom}${a.nouveau ? ', sa toute première soirée' : ', qui revient'}`)
  const reste = p.animateurs.length - nommes.length
  return espacesFines(`Chez ${nommes.join(' · chez ')}${reste > 0 ? ` · et ${formatNumber(reste)} autre${reste > 1 ? 's' : ''}` : ''}.`)
}

/** « Aucun incident. », « Incidents : Ressenti dégradé à 21 h 04, 12 min ». */
function lesIncidents(p: PointDuMatin): string {
  if (p.incidents.length === 0) return 'Aucun incident.'
  const dits = p.incidents.map(i => `${i.nom} à ${heureEcrite(i.debut)}, ${i.dureeMs === null ? 'encore ouvert' : dureeEcrite(i.dureeMs)}`)
  return espacesFines(`${p.incidents.length > 1 ? 'Incidents' : 'Un incident'} : ${dits.join(' · ')}.`)
}
