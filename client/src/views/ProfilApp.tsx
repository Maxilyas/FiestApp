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
  type FinitionChoisie,
  type PublicProfileDetail,
} from '../../../shared/profil'
import { Vitrine } from '../components/Vitrine'
import { FormulaireSoiree } from '../components/Rejoindre'
import { Categories, Courbes, FicheCarriere, GalerieLegendaires, HautsFaits } from '../components/Carriere'
import { formatNumber, ordinal } from '../format'
import { spacePath } from '../routes'
import type { PublicSpace } from '../../../shared/space'

/**
 * L'accueil (`/`) et la page de profil (`/profil`) : c'est le même écran.
 *
 * Demander « quelle soirée ? » avant de savoir qui est là n'avait aucun sens
 * pour celui qui revient : il a un profil, et souvent un espace à animer. On
 * se connecte donc d'abord, et c'est d'ici qu'on part — animer sa soirée, ou
 * en rejoindre une. Le chemin anonyme n'est pas refermé pour autant :
 * « Rejoindre une soirée » a le format de « Me connecter » et se voit sans
 * défiler, exactement comme à l'entrée d'une soirée.
 *
 * Rien de ce que cette page montre ne change quoi que ce soit au déroulé
 * d'une partie.
 */
export function ProfilApp() {
  const [profil, setProfil] = useState<PublicProfileDetail | null>(null)
  /** La soirée que ce profil anime, s'il en anime une. */
  const [espace, setEspace] = useState<PublicSpace | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [busy, setBusy] = useState(false)
  /** L'échappée : « quelle soirée ? », à un geste d'ici. */
  const [rejoindre, setRejoindre] = useState(false)

  const relire = () =>
    api.joueur.moi().then(r => {
      setProfil(r.profile)
      setEspace(r.espace)
    })

  useEffect(() => {
    document.title = 'Mon profil'
    relire()
      .catch(() => setProfil(null))
      .finally(() => setChargement(false))
  }, [])

  /**
   * Ouvrir sa console depuis son profil.
   *
   * La session d'animateur dure trente jours, celle du joueur un an : celui
   * qui revient six mois plus tard est encore reconnu ici et ne l'est plus
   * là-bas. On la rouvre avant de partir, sinon `/host` le renverrait à une
   * page de connexion qu'il vient justement de passer.
   */
  const animer = async () => {
    setBusy(true)
    setErreur('')
    try {
      await api.joueur.console()
      window.location.assign('/host')
    } catch (e) {
      setBusy(false)
      setErreur((e as Error).message)
    }
  }

  const enregistrer = async (patch: { avatar?: string; finition?: FinitionChoisie; legendaire?: string | null }) => {
    setBusy(true)
    setErreur('')
    try {
      // La route d'écriture rend le profil léger ; l'étagère et l'historique
      // n'ont pas bougé, on les garde plutôt que de tout redemander.
      const { profile } = await api.joueur.enregistrer(patch)
      setProfil(p => (p ? { ...p, ...profile } : p))
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (rejoindre) return <FormulaireSoiree onCancel={() => setRejoindre(false)} />

  if (chargement) {
    return (
      <div className="center-page">
        <p className="serif-note">Chargement…</p>
      </div>
    )
  }

  if (!profil) {
    // Le formulaire ne rend que le profil léger : on redemande le détail, qui
    // seul porte l'étagère et l'historique.
    //
    // L'échappée a le même format que « Me connecter » : personne n'est
    // obligé d'avoir un profil pour entrer dans une soirée, et cet écran-là
    // ne doit jamais le laisser croire.
    return (
      <ProfilForm
        onDone={() => relire()}
        echappee={
          <button type="button" className="btn btn-accent btn-big btn-block" onClick={() => setRejoindre(true)}>
            Rejoindre une soirée
          </button>
        }
      />
    )
  }

  const brille = (emoji: string) => profil.eclats.includes(emoji)
  // Les prix du palmarès : les hauts faits et les paliers ont leur section.
  const prix = profil.vitrine.filter(b => !b.key.startsWith('hf:'))
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
          legendaire={profil.legendaire ?? undefined}
        />
        <div className="profil-identite">
          <h2>
            {profil.name}
            <Niveau niveau={profil.niveau} big />
          </h2>
          <p className="muted">{formatNumber(profil.xp)} points d'expérience</p>
        </div>
      </header>

      {/* D'abord ce qu'on est venu faire : animer, ou rejoindre. Le niveau et
          l'étagère viennent après — on les regarde, on n'en part pas. */}
      <div className="card">
        <h3>
          <Icon name="zap" />
          Ce soir
        </h3>
        <div className="join-actions">
          {espace && (
            <button className="btn btn-primary btn-big btn-block" disabled={busy} onClick={animer}>
              Animer ma soirée
            </button>
          )}
          <button className="btn btn-accent btn-big btn-block" onClick={() => setRejoindre(true)}>
            Rejoindre une soirée
          </button>
        </div>
        {espace ? (
          <p className="muted small">
            « {espace.title} » — tes invités arrivent par{' '}
            <code>{`${window.location.host}/${espace.slug}`}</code>, l'adresse que portent les QR de
            tes tables.
          </p>
        ) : (
          <p className="muted small">
            Tu joues avec ce profil, d'une soirée à l'autre et d'un hôte à l'autre.
          </p>
        )}
      </div>

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
          L'expérience se mérite : répondre, viser juste, trouver parmi les plus rapides, finir sur le
          podium d'un quiz — et les hauts faits, à la clôture. Une question ne rapporte que posée à
          trois joueurs au moins. Rien de tout cela ne donne d'avantage pendant une soirée : les points
          du quiz se gagnent pareil pour tout le monde, profil ou pas.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>
            <Icon name="crown" />
            Avatars légendaires
          </h3>
          <span className="muted small">
            {profil.legendaires.length} / 12
          </span>
        </div>
        <p className="muted small">
          Douze médaillons, qui ne se gagnent que par un haut fait. Celui que tu portes remplace ton
          emoji sur tous les écrans.
        </p>
        <GalerieLegendaires
          debloques={profil.legendaires}
          porte={profil.legendaire}
          hautsFaits={profil.hautsFaits}
          busy={busy}
          onPorter={cle => enregistrer({ legendaire: cle })}
        />
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
            {profil.eclats.length === 1 ? 'Un de tes avatars a éclaté' : `${profil.eclats.length} de tes avatars ont éclaté`} :
            il change de couleurs, et toi seul l'as comme ça.
          </p>
        )}
        {profil.legendaire && (
          <p className="muted small">Choisir un emoji ôte ton avatar légendaire : on porte l'un ou l'autre.</p>
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
          {/* Par défaut, la plus belle qu'on a : chaque niveau qui en ouvre
              une nouvelle la fait porter d'office. On en épingle une autre si
              on préfère. */}
          <button
            className={'finition-btn' + (profil.finitionChoisie === 'auto' ? ' selected' : '')}
            disabled={busy}
            aria-pressed={profil.finitionChoisie === 'auto'}
            onClick={() => enregistrer({ finition: 'auto' })}
          >
            <Avatar avatar={profil.avatar} finition={profil.finition} eclat={brille(profil.avatar)} />
            <span className="finition-nom">La plus belle</span>
            <span className="muted small">{profil.finitionChoisie === 'auto' ? 'portée' : 'automatique'}</span>
          </button>
          {FINITIONS.map(f => {
            const ouverte = profil.ouvertes.includes(f)
            const choisie = profil.finitionChoisie === f
            return (
              <button
                key={f}
                className={'finition-btn' + (choisie ? ' selected' : '')}
                disabled={!ouverte || busy}
                aria-pressed={choisie}
                onClick={() => enregistrer({ finition: f })}
              >
                <Avatar avatar={profil.avatar} finition={f} eclat={brille(profil.avatar)} />
                <span className="finition-nom">{NOM_FINITION[f]}</span>
                <span className="muted small">
                  {ouverte ? (choisie ? 'épinglée' : 'ouverte') : `niveau ${NIVEAU_FINITION[f]}`}
                </span>
              </button>
            )
          })}
        </div>
        <p className="muted small">
          Les finitions se gagnent au niveau, jusqu'à Constellation au niveau 25. L'Éclat, lui, ne se
          gagne pas : une chance sur quarante par soirée qui compte, et c'est l'emoji lui-même qui
          change de couleurs.
        </p>
      </div>

      <div className="card">
        <h3>
          <Icon name="star" />
          Hauts faits
        </h3>
        {/* Montrer ce qui manque donne envie de revenir ; le cacher ne donne
            rien. Tout le catalogue se montre, et ce qu'on n'a pas s'estompe. */}
        <HautsFaits hautsFaits={profil.hautsFaits} />
      </div>

      <div className="card">
        <h3>
          <Icon name="bar-chart" />
          Ma fiche
        </h3>
        <FicheCarriere fiche={profil.fiche} />
        <Courbes soirees={profil.soirees} />
        {Object.keys(profil.categories).length > 0 && (
          <>
            <h4 className="hf-groupe">Par catégorie</h4>
            <Categories categories={profil.categories} />
          </>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>
            <Icon name="award" />
            Mes prix
          </h3>
          {prix.length > 0 && <span className="muted small">{prix.length}</span>}
        </div>
        <Vitrine badges={prix} />
      </div>

      {profil.soirees.length > 0 && (
        <div className="card">
          <h3>
            <Icon name="list" />
            Mes soirées
          </h3>
          {profil.soirees.map(s => (
            <div key={s.soireeId} className="soiree-row">
              <span className="soiree-quand">
                {/* Le souvenir de la soirée, dans l'espace où elle s'est jouée. */}
                {s.slug ? (
                  <a className="link-inline" href={spacePath(s.slug, 'souvenir', s.soireeId)}>
                    {new Date(s.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </a>
                ) : (
                  new Date(s.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                )}
              </span>
              <span className="soiree-detail">
                {s.chez && `chez ${s.chez} · `}
                {s.releve.reponses} réponse{s.releve.reponses > 1 ? 's' : ''}
                {s.releve.justes > 0 && `, ${s.releve.justes} juste${s.releve.justes > 1 ? 's' : ''}`}
                {/* `ordinal` connaît le « 1ᵉʳ » : à la main, on écrivait « 1ᵉ ». */}
                {s.releve.rang > 0 && s.releve.rang <= 3 && ` · ${ordinal(s.releve.rang)}`}
              </span>
              <span className="soiree-xp">+{formatNumber(s.xp)}</span>
            </div>
          ))}
        </div>
      )}

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
