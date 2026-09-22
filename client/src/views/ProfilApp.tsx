import { useEffect, useState } from 'react'
import { api } from '../api'
import { Avatar } from '../components/Avatar'
import { Niveau } from '../components/Niveau'
import { Icon } from '../components/Icon'
import { ProfilForm } from '../components/ProfilForm'
import { AVATARS } from '../../../shared/avatars'
import {
  FINITIONS,
  NIVEAU_FINITION,
  NOM_FINITION,
  type Finition,
  type PublicProfile,
} from '../../../shared/profil'
import { formatNumber } from '../format'

/**
 * La page d'un joueur récurrent : son niveau, ce qu'il a gagné, ses
 * finitions et ses éclats.
 *
 * Elle ne sert jamais à jouer — on y vient entre deux soirées. Rien de ce
 * qu'elle montre ne change quoi que ce soit au déroulé d'une partie.
 */
export function ProfilApp() {
  const [profil, setProfil] = useState<PublicProfile | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Mon profil'
    api.joueur
      .moi()
      .then(r => setProfil(r.profile))
      .catch(() => setProfil(null))
      .finally(() => setChargement(false))
  }, [])

  const enregistrer = async (patch: { avatar?: string; finition?: Finition }) => {
    setBusy(true)
    setErreur('')
    try {
      setProfil((await api.joueur.enregistrer(patch)).profile)
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (chargement) {
    return (
      <div className="center-page">
        <p className="serif-note">Chargement…</p>
      </div>
    )
  }

  if (!profil) {
    return <ProfilForm onDone={setProfil} onCancel={() => (window.location.href = '/')} />
  }

  const brille = (emoji: string) => profil.eclats.includes(emoji)
  const part = profil.requis > 0 ? Math.min(100, (profil.acquis / profil.requis) * 100) : 100

  return (
    // `player-shell` : la même mise en page que le téléphone d'un invité —
    // c'est le même écran, tenu dans la même main.
    <div className="player-shell">
      <header className="me-header profil-tete">
        <Avatar
          className="player-avatar big"
          avatar={profil.avatar}
          finition={profil.finition}
          eclat={brille(profil.avatar)}
        />
        <div className="profil-identite">
          <h2>
            {profil.name}
            <Niveau niveau={profil.niveau} big />
          </h2>
          <p className="muted">{formatNumber(profil.xp)} points d'expérience</p>
        </div>
      </header>

      <div className="card">
        <div className="card-head">
          <h3>
            <Icon name="sparkles" />
            Niveau {profil.niveau}
          </h3>
          <span className="muted small">
            {profil.requis > 0
              ? `${formatNumber(profil.acquis)} / ${formatNumber(profil.requis)} vers le niveau ${profil.niveau + 1}`
              : 'au sommet'}
          </span>
        </div>
        <div className="xp-bar">
          <div className="xp-fill" style={{ width: `${part}%` }} />
        </div>
        <p className="muted small">
          L'expérience se gagne en venant jouer : être là, répondre, viser juste, finir sur le podium.
          Elle ne donne aucun avantage pendant une soirée — les points du quiz se gagnent pareil pour
          tout le monde, profil ou pas.
        </p>
      </div>

      <div className="card">
        <h3>
          <Icon name="users" />
          Mon avatar
        </h3>
        <div className="emoji-grid" role="group" aria-label="Choisir mon avatar">
          {AVATARS.map(a => (
            <button
              key={a}
              className={'emoji-btn' + (a === profil.avatar ? ' selected' : '')}
              aria-pressed={a === profil.avatar}
              aria-label={`Avatar ${a}${brille(a) ? ', éclaté' : ''}`}
              disabled={busy}
              onClick={() => enregistrer({ avatar: a })}
            >
              <Avatar avatar={a} finition={profil.finition} eclat={brille(a)} />
            </button>
          ))}
        </div>
        {profil.eclats.length > 0 && (
          <p className="muted small">
            ✧ {profil.eclats.length === 1 ? 'Un de tes avatars a éclaté' : `${profil.eclats.length} de tes avatars ont éclaté`} :
            il change de couleurs, et toi seul l'as comme ça.
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>
            <Icon name="trophy" />
            Finitions
          </h3>
        </div>
        <div className="finitions">
          {FINITIONS.map(f => {
            const ouverte = profil.ouvertes.includes(f)
            return (
              <button
                key={f}
                className={'finition-btn' + (f === profil.finition ? ' selected' : '')}
                disabled={!ouverte || busy}
                aria-pressed={f === profil.finition}
                onClick={() => enregistrer({ finition: f })}
              >
                <Avatar avatar={profil.avatar} finition={f} eclat={brille(profil.avatar)} />
                <span className="finition-nom">{NOM_FINITION[f]}</span>
                <span className="muted small">
                  {ouverte ? (f === profil.finition ? 'portée' : 'ouverte') : `niveau ${NIVEAU_FINITION[f]}`}
                </span>
              </button>
            )
          })}
        </div>
        <p className="muted small">
          Les finitions se gagnent au niveau. L'Éclat, lui, ne se gagne pas : une chance sur quarante
          par soirée jouée, et c'est l'emoji lui-même qui change de couleurs.
        </p>
      </div>

      {erreur && <p className="error">{erreur}</p>}

      <div className="reset-row">
        <button
          className="btn btn-ghost"
          onClick={async () => {
            await api.joueur.deconnexion().catch(() => {})
            setProfil(null)
          }}
        >
          Me déconnecter
        </button>
      </div>
    </div>
  )
}
