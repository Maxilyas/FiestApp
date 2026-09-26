import { useState } from 'react'
import { Icon } from './Icon'
import { Legendaire } from './Legendaire'
import { Chiffres } from './Chiffres'
import { HautsFaits } from './Carriere'
import { Flamme, Medaille } from './Jour'
import { formatNumber } from '../format'
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
import { lesPlusProches, recompensesDe, type Proche } from '../../../shared/proches'
import type { CarriereDuJour } from '../../../shared/jour'
import type { PrixDeCollection, PublicProfileDetail } from '../../../shared/profil'

// L'onglet « Trophées » du profil : ce que sa carte montre à la salle, son
// quiz du jour, ses hauts faits — les plus proches d'abord, le catalogue
// replié —, et sa collection de prix. Tout ce qu'il a gagné, et ce qui vient.

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
  const recompenses = recompensesDe(profil.hautsFaits)
  const parCle = new Map(profil.vitrine.map(b => [b.key, b]))
  const badgeDe = (cle: string) => {
    const rangee = cleRangee(cle, recompenses)
    return rangee ? parCle.get(rangee) : undefined
  }
  const gagnes = hautsFaitsGagnes(recompenses).filter(cle => badgeDe(cle))
  const choisie = profil.vitrineChoisie ?? null
  const montres = choisie ? choisie.flatMap(cle => badgeDe(cle) ?? []) : plusBeaux(profil.vitrine, VITRINE_MAX)

  if (choix) {
    const complet = choix.length >= VITRINE_MAX
    return (
      <section className="card">
        <h3>
          <Icon name="award" />
          Ma vitrine
        </h3>
        <p className="muted small">{`Jusqu’à ${VITRINE_MAX} hauts faits, dans l’ordre où ta carte les montrera.`}</p>
        <ul className="vitrine-choix vitrine-a-choisir" role="group" aria-label="Les hauts faits de ma carte">
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
                  {pris && (
                    <span className="vitrine-rang" aria-hidden="true">
                      {rang + 1}
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
            disabled={busy || choix.length === 0}
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
    <section className="card">
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
          <button type="button" className="btn btn-small" disabled={busy} onClick={() => setChoix(choisie ?? [])}>
            {choisie ? 'Changer' : 'Choisir moi-même'}
          </button>
          {choisie && (
            <button type="button" className="btn btn-small btn-ghost" disabled={busy} onClick={() => enregistrer({ vitrine: null })}>
              Les plus durs, d’office
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * Son quiz du jour : les médailles, les jours joués, la série et son record,
 * le meilleur score, les podiums. Rien tant qu'il n'y a pas joué, sinon
 * l'invitation.
 */
export function MonQuizDuJour({ jour }: { jour?: CarriereDuJour }) {
  if (!jour) return null
  return (
    <section className="card">
      <h3>
        <Flamme />
        Le quiz du jour
      </h3>
      {jour.joues === 0 ? (
        <p className="muted small">
          Dix questions chaque jour, les mêmes pour tous les profils.{' '}
          <a className="link-inline" href="/jour">
            Jouer celui d’aujourd’hui
          </a>
        </p>
      ) : (
        <>
          <div className="medailles-compte" role="list" aria-label="Mes médailles">
            {(['or', 'argent', 'bronze'] as const).map(m => (
              <span key={m} role="listitem">
                <Medaille medaille={m} className="medaille-grande" />
                <b className="num">{jour.medailles[m]}</b>
              </span>
            ))}
          </div>
          <Chiffres
            cases={[
              ['Jours joués', formatNumber(jour.joues)],
              ['Série', `${jour.serie} jour${jour.serie > 1 ? 's' : ''}`, `record : ${jour.record}`],
              ['Meilleur score', formatNumber(jour.meilleurScore)],
              [
                'Podiums',
                formatNumber(jour.podiums),
                jour.victoires > 0 ? `dont ${jour.victoires} victoire${jour.victoires > 1 ? 's' : ''}` : undefined,
              ],
            ]}
          />
        </>
      )}
    </section>
  )
}

/**
 * Ses hauts faits : d'abord les plus proches — de quoi savoir quoi chasser
 * à la prochaine soirée —, puis tout le catalogue, replié : trente lignes
 * allongeaient la page avant même ce qu'il vise.
 */
export function MesHautsFaits({ profil }: { profil: PublicProfileDetail }) {
  const proches = lesPlusProches(profil.hautsFaits, profil.legendaires)
  const gagnes = profil.hautsFaits.filter(h => h.fois > 0).length
  return (
    <section className="card">
      <h3>
        <Icon name="star" />
        Hauts faits <span className="muted small titre-compte">{`${gagnes} / ${profil.hautsFaits.length}`}</span>
      </h3>
      {proches.length > 0 && (
        <div className="proches">
          <span className="label">Les plus proches</span>
          {proches.map(p => (
            <UnProche key={p.key} p={p} />
          ))}
        </div>
      )}
      <details className="repli-interne">
        <summary>
          {`Les ${profil.hautsFaits.length} hauts faits`}
          <Icon name="chevron-down" className="repli-chevron" />
        </summary>
        <HautsFaits hautsFaits={profil.hautsFaits} />
      </details>
    </section>
  )
}

/** Un objectif commencé : le légendaire en silhouette dorée, ou l'emoji du haut fait — ce qu'on compte, et la jauge. */
function UnProche({ p }: { p: Proche }) {
  const l = legendaire(p.key)
  const palier = palierDe(p.key)
  const h = l ? hautFait(l.condition.hautFait) : palier?.hautFait
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

/**
 * Sa collection de prix de soirée : ceux qu'il a, et ceux qui manquent en
 * pointillé. Ils tombent à chaque soirée — six fois L'Éclair ne dit rien —,
 * c'est la collection qui compte.
 */
export function MesPrix({ prix }: { prix?: PrixDeCollection[] }) {
  if (!prix) return null
  const eus = prix.filter(p => p.fois > 0).length
  return (
    <section className="card">
      <h3>
        <Icon name="award" />
        Prix de soirée <span className="muted small titre-compte">{`${eus} / ${prix.length}`}</span>
      </h3>
      <p className="muted small">Une collection : ils se remettent à la fin de chaque soirée, et seule la première fois compte.</p>
      <ul className="prix-collection">
        {prix.map(p => (
          <li key={p.key} className={p.fois > 0 ? 'eu' : 'manque'} title={p.rule}>
            <span className="prix-emoji" aria-hidden="true">
              {p.emoji}
            </span>
            <span className="prix-titre">{p.fois > 0 ? p.title : '?'}</span>
            {p.fois > 1 && <span className="hf-fois">×{p.fois}</span>}
            <span className="sr-only">{p.fois > 0 ? ` : ${p.rule}` : `À gagner : ${p.rule}`}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
