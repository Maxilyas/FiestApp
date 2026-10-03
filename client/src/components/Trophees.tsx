import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { Legendaire } from './Legendaire'
import { formatNumber } from '../format'
import { rendreLeFocus } from '../focus'
import {
  VITRINE_MAX,
  ceQuIlAFallu,
  cleRangee,
  hautFait,
  hautsFaitsGagnes,
  palierDe,
  plusBeaux,
  titreDePalier,
} from '../../../shared/hautsfaits'
import { legendaire } from '../../../shared/legendaires'
import { recompensesDe, type Proche } from '../../../shared/proches'
import type { PublicProfileDetail } from '../../../shared/profil'

// Les pièces des trophées du profil que d'autres écrans reprennent : sa
// vitrine — ce que sa carte montre à la salle — et un objectif commencé. La
// liste des collections elle-même vit dans `TropheesAtlas`.

/**
 * Ce que sa vitrine montre — celle qu'il a choisie, sinon ses trois plus
 * beaux —, et de quoi la choisir : la ligne des trophées et le choix lisent
 * la même chose.
 */
export function laVitrine(profil: PublicProfileDetail) {
  const recompenses = recompensesDe(profil.hautsFaits)
  const parCle = new Map(profil.vitrine.map(b => [b.key, b]))
  const badgeDe = (cle: string) => {
    const rangee = cleRangee(cle, recompenses)
    return rangee ? parCle.get(rangee) : undefined
  }
  const gagnes = hautsFaitsGagnes(recompenses).filter(cle => badgeDe(cle))
  const choisie = profil.vitrineChoisie ?? null
  const montres = choisie ? choisie.flatMap(cle => badgeDe(cle) ?? []) : plusBeaux(profil.vitrine, VITRINE_MAX)
  return { badgeDe, gagnes, montres }
}

/**
 * Sa vitrine : les hauts faits que sa carte montre à qui touche son nom.
 * D'office, les trois plus durs à obtenir (`plusBeaux`) ; il peut aussi les
 * choisir — un coup du sort compris, s'il en est fier —, dans l'ordre où la
 * carte les montrera. Un haut fait de carrière s'y montre à son plus haut
 * palier, qui monte avec lui.
 */
export function MaVitrine({
  profil,
  busy,
  enregistrer,
}: {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: { vitrine: string[] | null }) => void
}) {
  const [choix, setChoix] = useState<string[] | null>(null)
  // Le bouton touché — « Choisir moi-même », « Montrer ceux-là » — part avec
  // la vue qu'il quitte : le focus tombait sur la page. Il se pose sur le
  // titre de la vue suivante, sauf à l'ouverture de l'onglet.
  const section = useRef<HTMLElement>(null)
  const ouverte = useRef(false)
  const enChoix = choix !== null
  useEffect(() => {
    if (ouverte.current) rendreLeFocus(section.current, ['h3'])
    ouverte.current = true
  }, [enChoix])
  const { badgeDe, gagnes, montres } = laVitrine(profil)
  const choisie = profil.vitrineChoisie ?? null

  if (choix) {
    const complet = choix.length >= VITRINE_MAX
    return (
      <section className="card" ref={section}>
        <h3>
          <Icon name="award" />
          Ma vitrine
        </h3>
        <p className="muted small">{`Jusqu’à ${VITRINE_MAX} hauts faits, dans l’ordre où ta carte les montrera.`}</p>
        {/* Une liste, pas un groupe : `role="group"` lui retirait ses éléments. */}
        <ul className="vitrine-choix vitrine-a-choisir" aria-label="Les hauts faits de ma carte">
          {gagnes.map(cle => {
            const b = badgeDe(cle)!
            const rang = choix.indexOf(cle)
            const pris = rang >= 0
            return (
              <li key={cle}>
                <button
                  type="button"
                  className={'vitrine-option' + (pris ? ' selected' : '')}
                  aria-pressed={pris}
                  disabled={!pris && complet}
                  onClick={() => setChoix(c => c && (c.includes(cle) ? c.filter(k => k !== cle) : [...c, cle]))}
                >
                  <span className="hf-emoji" aria-hidden="true">
                    {b.emoji}
                  </span>
                  <span className="hf-corps">
                    <span className="hf-titre">{b.title}</span>
                    <span className="muted small">{ceQuIlAFallu(b.key)}</span>
                  </span>
                  {/* Son rang sur la carte, dit aussi à l'oreille : il n'était qu'à l'œil. */}
                  {pris && (
                    <span className="vitrine-rang">
                      <span className="sr-only">, montré </span>
                      {rang + 1}
                      <span className="sr-only">{rang === 0 ? 'ᵉʳ' : 'ᵉ'}</span>
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="row">
          <button
            type="button"
            className="btn btn-primary btn-small"
            disabled={choix.length === 0}
            aria-disabled={busy || undefined}
            onClick={() => {
              enregistrer({ vitrine: choix })
              setChoix(null)
            }}
          >
            Montrer ceux-là
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setChoix(null)}>
            Annuler
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="card" ref={section}>
      <h3>
        <Icon name="award" />
        Ma vitrine
      </h3>
      {montres.length === 0 ? (
        <p className="muted small">
          Ta carte montrera tes trois plus beaux hauts faits : ils se décernent à la fin de chaque soirée.
        </p>
      ) : (
        <>
          <p className="muted small">
            {choisie
              ? 'Les hauts faits que ta carte montre à la salle : ceux que tu as choisis.'
              : 'Les hauts faits que ta carte montre à la salle : les plus durs à obtenir.'}
          </p>
          <ul className="vitrine-choix">
            {montres.map(b => (
              <li key={b.key}>
                <span className="hf-emoji" aria-hidden="true">
                  {b.emoji}
                </span>
                <span className="hf-corps">
                  <span className="hf-titre">
                    {b.title}
                    {b.fois > 1 && <span className="hf-fois">×{b.fois}</span>}
                  </span>
                  <span className="muted small">{ceQuIlAFallu(b.key)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {gagnes.length > 0 && (
        <div className="row vitrine-actions">
          <button type="button" className="btn btn-small" aria-disabled={busy || undefined} onClick={() => setChoix(choisie ?? [])}>
            {choisie ? 'Changer' : 'Choisir moi-même'}
          </button>
          {choisie && (
            <button type="button" className="btn btn-small btn-ghost" aria-disabled={busy || undefined} onClick={() => enregistrer({ vitrine: null })}>
              Les plus durs, d’office
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/** Un objectif commencé : le légendaire en silhouette dorée, ou l'emoji du haut fait — ce qu'on compte, et la jauge. */
export function UnProche({ p }: { p: Proche }) {
  const l = legendaire(p.key)
  const palier = palierDe(p.key)
  const h = l ? hautFait(p.hautFait ?? l.condition.hautFait) : palier?.hautFait
  if (!h) return null
  const titre = l ? l.nom : titreDePalier(palier!.hautFait, palier!.palier)
  const compte =
    h.famille === 'carriere'
      ? `${formatNumber(p.acquis)} sur ${formatNumber(p.requis)} ${p.requis < 2 ? h.mesureUne : h.mesure}`
      : `${h.title} : ${p.acquis} fois sur ${p.requis}`
  return (
    <div className="approche">
      {l ? (
        <span className="approche-medaillon">
          <Legendaire cle={p.key} verrouille />
        </span>
      ) : (
        <span className="approche-emoji" aria-hidden="true">
          {h.emoji}
        </span>
      )}
      <div className="approche-corps">
        <b>{titre}</b>
        <span className="muted small">{compte}</span>
        <span className="jauge" aria-label={`${p.acquis} sur ${p.requis}`}>
          <span className="jauge-plein" style={{ width: `${Math.min(100, (p.acquis / p.requis) * 100)}%` }} />
        </span>
      </div>
    </div>
  )
}
