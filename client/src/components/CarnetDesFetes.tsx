import { useEffect, useMemo, useState } from 'react'
import { Timbre } from './Timbre'
import { Flot } from './GrandPrix'
import { api } from '../api'
import { carnetDesFetes, jourDit, periodeDite, type CaseDuCarnet } from '../../../shared/timbres'
import { jourEnToutesLettres } from '../../../shared/jour'
import type { FlotDuCarnet } from '../../../shared/grandPrix'
import { espacesFines } from '../format'
import type { PublicProfileDetail } from '../../../shared/profil'

/**
 * Ses flots des Grands Prix, sous ses timbres : un par Grand Prix où il a
 * battu le fantôme — l'avatar du fantôme au cœur, tel qu'il le portait ce
 * jour-là —, et le flot d'honneur d'or du jour où le fantôme, c'était lui.
 * Lus au magasin du Grand Prix à l'ouverture de la ligne, seulement s'il en a :
 * le profil ne porte que leurs clés, qui suffisent au compte.
 */
function FlotsDesGrandsPrix() {
  const [flots, setFlots] = useState<FlotDuCarnet[] | null>(null)
  const [perdu, setPerdu] = useState(false)
  useEffect(() => {
    api.grandPrix.carnet().then(
      r => setFlots(r.flots),
      () => setPerdu(true),
    )
  }, [])
  if (perdu) return <p className="muted small">Tes flots ne se lisent pas pour l’instant : réessaie dans un moment.</p>
  if (!flots) return <p className="muted small">Tes flots…</p>
  if (flots.length === 0) return null
  return (
    <ul className="timbres-grille" aria-label={`${flots.length} flot${flots.length > 1 ? 's' : ''} de Grand Prix`}>
      {flots.map(f => (
        <li key={f.grandPrix.id} className="timbres-case">
          <Flot ruban={f.grandPrix.ruban} honneur={f.honneur} fantome={f.grandPrix.fantome} nom={`${f.honneur ? 'Le flot d’honneur' : 'Le flot'} : ${f.grandPrix.titre}`} taille={84} />
          <span className="timbres-legende timbres-legende-gagne">{espacesFines(f.grandPrix.titre)}</span>
          <span className="timbres-legende">
            {espacesFines(
              `${jourEnToutesLettres(f.grandPrix.jour, true)} · ${f.honneur ? 'ton jour' : f.rang === 1 ? '1ʳᵉ place' : f.rang ? `${f.rang}ᵉ place` : 'battu'}`,
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

// « Le carnet des fêtes », dans « Ma collection » : une page par année, ses
// fêtes dans l'ordre de l'année, chacune son timbre — la maquette validée le
// 1er novembre 2026. On n'y règle rien, comme partout dans la collection : un
// timbre se gagne en jouant pendant sa fête, au quiz du jour ou en soirée.

/** Sous chaque timbre, ce qu'il en est : gagné, sa fête en cours et jusqu'à quand, ses dates à venir, ou manqué. */
function legendeDe(c: CaseDuCarnet): string {
  if (c.etat === 'gagne') return 'Gagné'
  if (c.etat === 'manque') return 'Manqué'
  if (c.etat === 'en-cours') return `En cours · jusqu’au ${jourDit(c.fin)}`
  return periodeDite(c.debut, c.fin)
}

export function CarnetDesFetes({ profil }: { profil: PublicProfileDetail }) {
  const carnet = profil.carnet
  const pages = useMemo(() => (carnet ? carnetDesFetes(carnet.timbres, carnet.jour) : []), [carnet])
  // La page de l'année en cours d'abord : la dernière du carnet.
  const [choisie, setChoisie] = useState<number | null>(null)
  if (!carnet || pages.length === 0) return null
  const page = pages.find(p => p.millesime === choisie) ?? pages[pages.length - 1]
  return (
    <>
      <p className="muted small">
        {espacesFines(
          'Un timbre par fête, chaque année : joue ses jours au quiz du jour, ou une soirée pendant elle. Une fête manquée ne se rattrape pas — elle revient l’an d’après.',
        )}
      </p>
      {pages.length > 1 && (
        <div className="timbres-annees" role="group" aria-label="Les années du carnet">
          {pages.map(p => (
            <button
              key={p.millesime}
              type="button"
              className={'pill-btn' + (p === page ? ' active' : '')}
              aria-pressed={p === page}
              onClick={() => setChoisie(p.millesime)}
            >
              {`${p.millesime} · ${p.gagnes}/${p.cases.length}`}
            </button>
          ))}
        </div>
      )}
      <ul className="timbres-grille" aria-label={`${page.millesime} : ${page.gagnes} timbre${page.gagnes > 1 ? 's' : ''} sur ${page.cases.length}`}>
        {page.cases.map(c => (
          <li key={c.fete} className="timbres-case">
            <Timbre fete={c.fete} millesime={c.millesime} etat={c.etat} />
            <span className={`timbres-legende timbres-legende-${c.etat}`}>{espacesFines(legendeDe(c))}</span>
          </li>
        ))}
      </ul>
      {(carnet.flots?.length ?? 0) > 0 && (
        <>
          <h4 className="carnet-flots-titre">Tes Grands Prix</h4>
          <FlotsDesGrandsPrix />
        </>
      )}
    </>
  )
}
