import { useEffect, useState } from 'react'
import type { FinDeSoiree as Fin, GainAnnonce, HautFaitAnnonce } from '../../../shared/fin'
import type { PublicProfile } from '../../../shared/profil'
import { NOM_FINITION } from '../../../shared/profil'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { api } from '../api'
import { spacePath } from '../routes'
import { formatNumber, ordinal } from '../format'
import { showToast } from '../state'
import { Avatar } from './Avatar'
import { Legendaire } from './Legendaire'
import { Divin } from './Divin'
import { Icon } from './Icon'

/**
 * La fin de soirée, sur le téléphone.
 *
 * Le téléphone ne savait jamais que la soirée était finie : il restait sur
 * « En attente du prochain quiz… » jusqu'à ce qu'on le range. Il raconte
 * maintenant la soirée de son porteur — son rang, ses hauts faits, éclats
 * et ombres —, et à qui a un profil ce qu'elle lui a rapporté : les niveaux,
 * les finitions, les paliers, et surtout les avatars légendaires, qu'on peut
 * porter tout de suite — et, une fois dans une vie peut-être, un Divin.
 *
 * Un invité anonyme a sa soirée aussi, entière. Le bloc du profil lui manque,
 * sans rien qui le lui reproche.
 */
export function FinDeSoiree({
  fin,
  profil,
  onSuivante,
}: {
  fin: Fin
  profil: PublicProfile | null
  onSuivante: () => void
}) {
  const [porte, setPorte] = useState<string | null>(profil?.legendaire ?? null)
  const eclats = fin.hautsFaits.filter(h => h.ton === 'eclat')
  const ombres = fin.hautsFaits.filter(h => h.ton === 'ombre')
  const gain = fin.profil

  const porter = async (cle: string) => {
    try {
      const { profile } = await api.joueur.enregistrer({ legendaire: cle })
      setPorte(profile.legendaire)
      showToast({ kind: 'info', message: `Tu portes ${legendaire(cle)?.nom ?? divin(cle)?.nom ?? 'ton avatar'}` })
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    }
  }

  return (
    <div className="player-shell fin-soiree">
      <header className="fin-tete">
        <span className="label">Fin de la soirée</span>
        <h1>{fin.soiree.titre}</h1>
      </header>

      <section className="card fin-moi">
        <Avatar
          className="player-avatar fin-avatar"
          avatar={fin.avatar}
          finition={fin.finition}
          eclat={fin.eclat}
          legendaire={porte ?? fin.legendaire}
        />
        <div>
          <h2>{fin.nom}</h2>
          {fin.rang > 0 ? (
            <p className="fin-rang">
              <b>{ordinal(fin.rang)}</b> sur {fin.joueurs} · {formatNumber(fin.points)} pts
            </p>
          ) : (
            <p className="muted">{fin.joueurs} joueurs ce soir</p>
          )}
        </div>
      </section>

      {/* Un Divin passe avant tout le reste : c'est la nouvelle de la soirée.
          Une page d'avant ne connaît pas le champ — il peut manquer. */}
      {(gain?.divins ?? []).map(({ key, legende, ton }) => {
        const d = divin(key)
        if (!d) return null
        return (
          <section key={key} className={`card fin-divin fin-divin-${ton}`}>
            <span className="label">Un Divin est descendu sur toi</span>
            <span className="fin-apparition">
              <Divin cle={key} />
            </span>
            <h2>{d.nom}</h2>
            <p className="serif-note">{legende}</p>
            {porte === key ? (
              <p className="muted small">C’est lui que la salle verra, dès la prochaine soirée.</p>
            ) : (
              <button className="btn btn-primary" onClick={() => void porter(key)}>
                Le porter
              </button>
            )}
          </section>
        )
      })}

      {/* L'Éclat : une chance sur quarante, qui tombait en silence — sous un
          légendaire, personne ne le voyait jamais. */}
      {gain?.eclat && (
        <section className="card fin-eclat">
          <span className="label">Une chance sur quarante</span>
          <span className="fin-apparition">
            {legendaire(gain.eclat) ? (
              <Avatar avatar={fin.avatar} legendaire={gain.eclat} finition={fin.finition} eclat />
            ) : (
              <Avatar avatar={gain.eclat} finition={fin.finition} eclat />
            )}
          </span>
          <h2>{legendaire(gain.eclat) ? `${legendaire(gain.eclat)?.nom} a éclaté !` : `Ton ${gain.eclat} a éclaté !`}</h2>
          <p className="serif-note">Il a changé de couleurs, pour toujours — et toi seul l’as comme ça.</p>
        </section>
      )}

      {gain && (
        <section className="card fin-gain">
          <p className="fin-xp">+{formatNumber(gain.xp)} points d’expérience</p>
          <BarreDeNiveau avant={gain.niveauAvant} apres={gain.niveauApres} profil={profil} />
          {gain.finitions.length > 0 && (
            <p className="fin-finition">
              Nouvelle finition : <b>{gain.finitions.map(f => NOM_FINITION[f]).join(', ')}</b>
              <Avatar
                className="fin-apercu"
                avatar={fin.avatar}
                finition={gain.finitions[gain.finitions.length - 1]}
              />
            </p>
          )}
          {gain.paliers.length > 0 && <Faits titre="Paliers de carrière" faits={gain.paliers} />}
        </section>
      )}

      {gain?.legendaires.map(cle => {
        const l = legendaire(cle)
        if (!l) return null
        return (
          <section key={cle} className="card fin-legendaire">
            <span className="label">Avatar légendaire débloqué</span>
            <span className="fin-medaillon">
              <Legendaire cle={cle} />
            </span>
            <h2>{l.nom}</h2>
            <p className="serif-note">{l.legende}</p>
            {porte === cle ? (
              <p className="muted small">C’est lui que la salle verra, dès la prochaine soirée.</p>
            ) : (
              <button className="btn btn-primary" onClick={() => void porter(cle)}>
                Le porter
              </button>
            )}
          </section>
        )
      })}

      {eclats.length > 0 && (
        <section className="card">
          <Faits titre="Tes exploits" faits={eclats} />
        </section>
      )}
      {ombres.length > 0 && (
        <section className="card fin-ombres">
          <Faits titre="Tes coups du sort" faits={ombres} />
          <p className="muted small">Ils comptent aussi : certains avatars légendaires ne se gagnent qu’ainsi.</p>
        </section>
      )}

      <div className="fin-actions">
        <button className="btn btn-primary" onClick={onSuivante}>
          Rejoindre la soirée suivante
        </button>
        <a className="btn" href={spacePath(fin.soiree.slug, 'souvenir', fin.soiree.id)}>
          <Icon name="book" />
          Revoir la soirée
        </a>
        {profil ? (
          <a className="btn btn-ghost" href="/profil">
            Mon profil
          </a>
        ) : (
          <p className="muted small fin-invitation">
            Avec un profil, tes hauts faits se gardent d’une soirée à l’autre, et les avatars
            légendaires se débloquent.{' '}
            <a className="link-inline" href="/profil">
              Créer mon profil
            </a>
          </p>
        )}
      </div>
    </div>
  )
}

/** Une rangée de hauts faits : l'emoji en grand, le titre dessous. */
function Faits({ titre, faits }: { titre: string; faits: HautFaitAnnonce[] }) {
  return (
    <>
      <h3>{titre}</h3>
      <ul className="faits">
        {faits.map(h => (
          <li key={h.key} className={`fait fait-${h.ton}`}>
            <span className="fait-emoji" aria-hidden="true">
              {h.emoji}
            </span>
            <span className="fait-titre">{h.title}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * La barre du niveau : elle part de là où elle était, et se remplit. Une
 * montée de niveau se voit — c'est tout l'intérêt de l'avoir gagnée ce soir.
 */
function BarreDeNiveau({ avant, apres, profil }: { avant: number; apres: number; profil: PublicProfile | null }) {
  const [plein, setPlein] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setPlein(true), 250)
    return () => clearTimeout(t)
  }, [])
  const part = profil ? Math.min(100, Math.round((profil.acquis / Math.max(1, profil.requis)) * 100)) : 100
  return (
    <div className="fin-niveau">
      <div className="row fin-niveaux">
        <span className="niveau big">{avant}</span>
        {apres > avant ? (
          <>
            <span className="fin-fleche" aria-hidden="true">→</span>
            <span className="niveau big fin-niveau-neuf">{apres}</span>
            <b className="fin-monte">Niveau {apres} !</b>
          </>
        ) : (
          <span className="muted small">Niveau {apres}</span>
        )}
      </div>
      <div className="xp-bar">
        <div className="xp-fill" style={{ width: plein ? `${part}%` : '0%' }} />
      </div>
    </div>
  )
}

/**
 * Ce que le dernier podium vient de rapporter : un instant de fête, par-dessus
 * l'écran, qui s'efface de lui-même. Un niveau gagné se fête plus fort.
 */
export function Celebration({ gain, onFin }: { gain: GainAnnonce; onFin: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFin, gain.niveauApres > gain.niveauAvant ? 5000 : 3000)
    return () => clearTimeout(t)
  }, [gain, onFin])
  const monte = gain.niveauApres > gain.niveauAvant
  return (
    <button type="button" className={'celebration' + (monte ? ' celebration-niveau' : '')} onClick={onFin} role="status">
      <span className="celebration-xp">+{formatNumber(gain.xp)} XP</span>
      {monte && <span className="celebration-niveau-texte">Niveau {gain.niveauApres} !</span>}
      {gain.finitions.length > 0 && (
        <span className="celebration-finition">
          Finition {gain.finitions.map(f => NOM_FINITION[f]).join(', ')} débloquée
        </span>
      )}
    </button>
  )
}
