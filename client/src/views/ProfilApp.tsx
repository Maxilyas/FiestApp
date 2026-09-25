import { useEffect, useState, type FormEvent, type ReactNode, type SyntheticEvent } from 'react'
import { api, currentMe, motifDe } from '../api'
import { Avatar } from '../components/Avatar'
import { Niveau } from '../components/Niveau'
import { Icon, type IconName } from '../components/Icon'
import { ProfilForm } from '../components/ProfilForm'
import { CodeSecours } from '../components/Secours'
import { AVATARS, tronquer } from '../../../shared/avatars'
import { DIVINS } from '../../../shared/divins'
import { cibleEclat } from '../../../shared/legendaires'
import {
  FINITIONS,
  NIVEAU_FINITION,
  NOM_FINITION,
  coupDOeilMoyen,
  type FinitionChoisie,
  type PublicProfileDetail,
} from '../../../shared/profil'
import { Vitrine } from '../components/Vitrine'
import { FormulaireSoiree } from '../components/Rejoindre'
import { Categories, Courbes, FicheCarriere, GalerieDivins, GalerieLegendaires, HautsFaits } from '../components/Carriere'
import { formatNumber, place, reponsesParType } from '../format'
import { route, spacePath } from '../routes'
import { derniereSoireeGardee } from '../state'
import { Lendemain } from '../components/Lendemain'
import type { PublicSpace } from '../../../shared/space'

const ETAPE_REJOINDRE = 'fiestappRejoindre'

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
  // Une étape de l'accueil, avec son entrée d'historique : le retour du
  // navigateur y ramène à l'accueil au lieu de quitter l'application.
  const [rejoindre, setRejoint] = useState(() => history.state?.[ETAPE_REJOINDRE] === true)
  const setRejoindre = (ouvrir: boolean) => {
    if (ouvrir) {
      history.pushState({ [ETAPE_REJOINDRE]: true }, '')
      setRejoint(true)
    } else if (history.state?.[ETAPE_REJOINDRE]) history.back()
    else setRejoint(false)
  }
  useEffect(() => {
    const auRetour = () => setRejoint(history.state?.[ETAPE_REJOINDRE] === true)
    window.addEventListener('popstate', auRetour)
    return () => window.removeEventListener('popstate', auRetour)
  }, [])
  /**
   * La soirée dont une session d'animateur est ouverte sur ce navigateur,
   * profil rattaché ou non. L'animateur qui n'a pas relié de profil n'avait
   * ici aucune porte, et ses identifiants de compte y étaient « incorrects ».
   */
  const [console_, setConsole] = useState<PublicSpace | null>(null)
  /** Les soirées en cours où ce profil joue déjà : on y revient d'un toucher. */
  const [enCours, setEnCours] = useState<{ nom: string; slug: string }[]>([])
  /** « Créer mon profil » depuis une fin de soirée : la création, préremplie. */
  const [creation] = useState(lireCreation)
  const [gardee] = useState(derniereSoireeGardee)

  const relire = () =>
    api.joueur.moi().then(r => {
      setProfil(r.profile)
      setEspace(r.espace)
      setEnCours(r.enCours ?? [])
    })

  useEffect(() => {
    // L'onglet de l'accueil dit ce qu'est l'application ; celui de `/profil`,
    // ce qu'on y regarde.
    document.title = route.kind === 'landing' ? 'FiestApp · le quiz de soirée' : 'Mon profil · FiestApp'
    currentMe().then(m => setConsole(m?.space ?? null))
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

  // Le lendemain, l'accueil ne connaissait aucune soirée jouée : il fallait
  // taper `/<espace>/bilan`. La dernière gardée sur ce téléphone, tous
  // espaces confondus — rien ne quitte le téléphone —, en une ligne sous
  // « Rejoindre une soirée », qui reste visible sans défiler.
  const lendemain = gardee && <Lendemain gardee={gardee} titre />

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
        marque={<p className="accueil-marque">FiestApp · le quiz de soirée</p>}
        aideErreur={
          // La même phrase pour tout refus : dire « c'est un identifiant
          // d'animateur » apprendrait à n'importe qui quels comptes existent.
          // Une console ouverte met « Animer « … » » en bas, pas cette porte.
          !console_ && (
            <p className="muted small">Tu animes une soirée ? Ta porte est tout en bas : « J’anime une soirée ».</p>
          )
        }
        pied={<PorteAnimateur console_={console_} />}
        creer={!!creation}
        prefill={creation ?? undefined}
        onDone={() => {
          // Le profil est là : un rafraîchissement ne doit pas rouvrir la création.
          if (creation) history.replaceState(null, '', window.location.pathname)
          void relire()
        }}
        echappee={
          <>
            <button type="button" className="btn btn-accent btn-big btn-block" onClick={() => setRejoindre(true)}>
              Rejoindre une soirée
            </button>
            {lendemain}
          </>
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
          eclat={brille(cibleEclat(profil.legendaire, profil.avatar))}
          legendaire={profil.legendaire ?? undefined}
        />
        {/* Le niveau et sa barre, sous le nom : une carte « Niveau » redisait
            ce que l'en-tête disait déjà, la pastille et l'expérience. */}
        <div className="profil-identite">
          <h2>
            {profil.name}
            <Niveau niveau={profil.niveau} big />
          </h2>
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
              ? `${formatNumber(profil.acquis)} / ${formatNumber(profil.requis)} XP vers le niveau ${profil.niveau + 1}`
              : 'Au sommet'}
          </p>
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
          {/* La soirée où l'on joue déjà d'abord : « Rejoindre une soirée »
              redemandait son nom à qui y était inscrit, et faisait douter
              d'avoir quitté la partie (Sofia, le 23 et le 24). */}
          {enCours.map(e => (
            <a key={e.slug} className="btn btn-primary btn-big btn-block" href={spacePath(e.slug)}>
              Revenir chez {e.nom}
            </a>
          ))}
          {espace && (
            <button className="btn btn-primary btn-big btn-block" disabled={busy} onClick={animer}>
              Animer ma soirée
            </button>
          )}
          {!espace && console_ && (
            <a className="btn btn-primary btn-big btn-block" href="/host">
              Animer « {console_.title} »
            </a>
          )}
          <button className="btn btn-accent btn-big btn-block" onClick={() => setRejoindre(true)}>
            Rejoindre une soirée
          </button>
          {lendemain}
        </div>
        {!espace && !console_ && (
          <p className="join-foot">
            <a className="link-inline" href="/connexion?next=/host">
              J’anime une soirée
            </a>
          </p>
        )}
      </div>

      <Repli
        id="avatar"
        icone="users"
        titre="Mon avatar"
        apercu={
          <Avatar
            className="repli-avatar"
            avatar={profil.avatar}
            finition={profil.finition}
            eclat={brille(cibleEclat(profil.legendaire, profil.avatar))}
            legendaire={profil.legendaire ?? undefined}
          />
        }
      >
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
          <p className="muted small">Choisir un emoji ôte ton avatar dessiné : on porte l'un ou l'autre.</p>
        )}
      </Repli>

      {/* Les catalogues repliés : douze médaillons, cinq Divins, huit
          finitions et trente hauts faits allongeaient la page avant même sa
          fiche. On les déplie d'un toucher sur le titre, qui dit déjà où l'on
          en est. */}
      <Repli id="legendaires" icone="crown" titre="Avatars légendaires" compte={`${profil.legendaires.length} / 12`}>
        <p className="muted small">
          Douze médaillons, qui ne se gagnent que par un haut fait. Celui que tu portes remplace ton
          emoji sur tous les écrans.
        </p>
        <GalerieLegendaires
          debloques={profil.legendaires}
          eclats={profil.eclats}
          porte={profil.legendaire}
          hautsFaits={profil.hautsFaits}
          busy={busy}
          onPorter={cle => enregistrer({ legendaire: cle })}
        />
      </Repli>

      <Repli id="divins" icone="sparkles" titre="Divins" compte={`${(profil.divins ?? []).length} / ${DIVINS.length}`}>
        <p className="muted small">
          Cinq avatars au-dessus des légendaires. Personne ne sait ce qui les fait descendre — pas même
          cette page.
        </p>
        <GalerieDivins
          descendus={profil.divins ?? []}
          porte={profil.legendaire}
          busy={busy}
          onPorter={cle => enregistrer({ legendaire: cle })}
        />
      </Repli>

      <Repli id="finitions" icone="trophy" titre="Finitions" compte={`${profil.ouvertes.length} / ${FINITIONS.length}`}>
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
            {/* L'état se dit par `aria-pressed` : lu aussi, il se disait deux fois. */}
            <span className="muted small" aria-hidden="true">
              {profil.finitionChoisie === 'auto' ? 'portée' : 'automatique'}
            </span>
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
                {/* « épinglée » redit `aria-pressed` : l'oreille entend « ouverte ». */}
                <span className="muted small" aria-hidden={choisie || undefined}>
                  {ouverte ? (choisie ? 'épinglée' : 'ouverte') : `niveau ${NIVEAU_FINITION[f]}`}
                </span>
                {choisie && <span className="sr-only">ouverte</span>}
              </button>
            )
          })}
        </div>
        <p className="muted small">
          Les finitions se gagnent au niveau, jusqu'à Constellation au niveau 25. L'Éclat, lui, ne se
          gagne pas : une chance sur quarante par soirée qui compte, et c'est l'emoji lui-même qui
          change de couleurs.
        </p>
      </Repli>

      <Repli
        id="hauts-faits"
        icone="star"
        titre="Hauts faits"
        compte={`${profil.hautsFaits.filter(h => h.fois > 0).length} / ${profil.hautsFaits.length}`}
      >
        {/* Montrer ce qui manque donne envie de revenir ; le cacher ne donne
            rien. Tout le catalogue se montre, et ce qu'on n'a pas s'estompe. */}
        <HautsFaits hautsFaits={profil.hautsFaits} />
      </Repli>

      <div className="card">
        <h3>
          <Icon name="bar-chart" />
          Ma fiche
        </h3>
        <FicheCarriere fiche={profil.fiche} partie="essentiel" />
        {/* Quatre chiffres d'abord ; les huit autres, les courbes et les
            catégories d'un toucher. */}
        <Deplier id="fiche" titre="Tous mes chiffres">
          <FicheCarriere fiche={profil.fiche} partie="reste" />
          <Courbes soirees={profil.soirees} />
          {Object.keys(profil.categories).length > 0 && (
            <>
              <h4 className="hf-groupe">Par catégorie</h4>
              <Categories categories={profil.categories} />
            </>
          )}
        </Deplier>
      </div>

      <Repli id="prix" icone="award" titre="Mes prix" compte={String(prix.length)} vide={prix.length === 0}>
        <Vitrine badges={prix} />
      </Repli>

      <Repli id="soirees" icone="list" titre="Mes soirées" compte={String(profil.soirees.length)} vide={profil.soirees.length === 0}>
        {profil.soirees.map(s => {
          const date = new Date(s.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
          // Le titre que l'animateur lui a donné, la date sinon : une liste de
          // dates ne disait pas laquelle était la fête de Marc.
          const nom = s.titre ?? date
          return (
            <div key={s.soireeId} className="soiree-row">
              <div className="soiree-texte">
                <span className="soiree-quand">
                  {/* Le souvenir de la soirée, dans l'espace où elle s'est jouée. */}
                  {s.slug ? (
                    <a className="link-inline" href={spacePath(s.slug, 'souvenir', s.soireeId)}>
                      {nom}
                    </a>
                  ) : (
                    nom
                  )}
                </span>
                <span className="soiree-detail">
                  {s.titre && `${date} · `}
                  {s.chez && `chez ${s.chez} · `}
                  {/* Par type de question : « 64 réponses, 1 juste » ne disait pas
                      que soixante-deux étaient des estimations. */}
                  {reponsesParType({ ...s.releve, coupDOeil: coupDOeilMoyen(s.releve) }, { compte: false }) || 'aucune réponse'}
                  {s.releve.rang > 0 && s.releve.rang <= 3 && ` · ${place(s.releve.rang)}`}
                </span>
                {/* Son bilan à soi, d'un toucher : il redemandait « Qui es-tu ? ». */}
                {s.slug && s.joueurId && (
                  <a className="link-inline small" href={`${spacePath(s.slug, 'bilan', s.soireeId)}#p=${encodeURIComponent(s.joueurId)}`}>
                    Mon bilan
                  </a>
                )}
              </div>
              <span className="soiree-xp">+{formatNumber(s.xp)} XP</span>
            </div>
          )
        })}
        {/* Les paliers ont leur ligne à part : sans ce mot, la somme des
            soirées ne faisait pas le total, et rien ne disait pourquoi. */}
        <p className="muted small">Les paliers de carrière s'ajoutent à part, dans « Hauts faits ».</p>
      </Repli>

      <Repli id="acces" icone="users" titre="Identifiant et mot de passe">
        <MotDePasse login={profil.login} />
      </Repli>

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

/**
 * La porte des animateurs, sur l'accueil d'un visiteur sans profil : sa
 * console s'il en a une ouverte ici, sinon un lien discret vers la connexion
 * au compte. Discret, parce que l'accueil est d'abord celui des invités —
 * « Rejoindre une soirée » ne doit jamais descendre sous le bord.
 */
function PorteAnimateur({ console_ }: { console_: PublicSpace | null }) {
  if (console_) {
    return (
      <a className="btn btn-block" href="/host">
        Animer « {console_.title} »
      </a>
    )
  }
  return (
    <p className="join-foot">
      <a className="link-inline" href="/connexion?next=/host">
        J’anime une soirée
      </a>
    </p>
  )
}

/**
 * La création préremplie qu'ouvre « Créer mon profil » à la fin d'une
 * soirée (`/profil?creer=1&prenom=…&avatar=…`) : elle ouvrait la connexion,
 * vide, et il fallait tout retaper.
 */
function lireCreation(): { name: string; avatar: string } | null {
  const q = new URLSearchParams(window.location.search)
  if (!q.has('creer')) return null
  return { name: tronquer((q.get('prenom') ?? '').trim(), 24), avatar: q.get('avatar') ?? '' }
}

/**
 * Relire son identifiant, changer son mot de passe. La route existait, pas
 * l'écran. Il faut l'actuel — ou le code de secours, qui se consomme et en
 * rend un neuf, à noter aussitôt. Les consoles que ce profil avait ouvertes
 * ailleurs se referment (invariant 16) : c'est le serveur qui s'en charge.
 */
function MotDePasse({ login }: { login: string }) {
  const [parCode, setParCode] = useState(false)
  const [preuve, setPreuve] = useState('')
  const [suivant, setSuivant] = useState('')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const [fait, setFait] = useState(false)
  const [code, setCode] = useState('')

  const envoyer = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErreur('')
    try {
      const res = await api.joueur.motDePasse(
        parCode ? { code: preuve.trim(), next: suivant } : { current: preuve, next: suivant },
      )
      setFait(true)
      setCode(res.recovery ?? '')
      setPreuve('')
      setSuivant('')
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p>
        Ton identifiant : <strong>{login}</strong>
      </p>
      {fait ? (
        <>
          <p className="info" role="status">
            Mot de passe changé. Tes autres appareils devront se reconnecter.
          </p>
          {code && (
            <>
              <p className="muted small">Ton code de secours a servi : voici le nouveau.</p>
              <CodeSecours code={code} />
            </>
          )}
        </>
      ) : (
        <form className="mdp-form" onSubmit={envoyer}>
          <div className="field">
            <label className="label" htmlFor="mdp-preuve">
              {parCode ? 'Ton code de secours' : 'Ton mot de passe actuel'}
            </label>
            <input
              id="mdp-preuve"
              className="input input-line"
              type={parCode ? 'text' : 'password'}
              value={preuve}
              onChange={e => setPreuve(e.target.value)}
              autoComplete={parCode ? 'off' : 'current-password'}
              autoCapitalize={parCode ? 'characters' : 'none'}
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="mdp-suivant">
              Ton nouveau mot de passe
            </label>
            <input
              id="mdp-suivant"
              className="input input-line"
              type="password"
              value={suivant}
              onChange={e => setSuivant(e.target.value)}
              autoComplete="new-password"
            />
            <span className="muted small">Au moins 8 caractères.</span>
          </div>
          {erreur && (
            <p className="error" role="alert">
              {erreur}
            </p>
          )}
          <button className="btn btn-primary btn-block" disabled={busy || !preuve.trim() || !suivant}>
            Changer mon mot de passe
          </button>
          <button
            type="button"
            className="link-inline"
            onClick={() => {
              setParCode(c => !c)
              setPreuve('')
              setErreur('')
            }}
          >
            {parCode ? 'Je connais mon mot de passe' : "Mot de passe oublié ? Mon code de secours"}
          </button>
        </form>
      )}
    </>
  )
}

/** Les sections que ce téléphone avait laissées ouvertes. */
const CLE_OUVERTES = 'quizz.profil.ouvertes'

function lireOuvertes(): Set<string> {
  // Sous try/catch : des cookies bloqués donnaient une page noire.
  try {
    const liste: unknown = JSON.parse(localStorage.getItem(CLE_OUVERTES) ?? '[]')
    return new Set(Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function retenirOuverte(id: string, ouverte: boolean) {
  try {
    const ouvertes = lireOuvertes()
    if (ouverte) ouvertes.add(id)
    else ouvertes.delete(id)
    localStorage.setItem(CLE_OUVERTES, JSON.stringify([...ouvertes]))
  } catch {
    // Stockage refusé : la page se rouvrira repliée, comme la première fois.
  }
}

/**
 * Ouverte ou non au dernier passage, et retenue à chaque toucher : la page se
 * rouvre comme on l'a laissée. Lue une fois, au premier affichage ; ensuite,
 * c'est le navigateur qui ouvre et referme.
 */
function useSouvenir(id: string) {
  const [open] = useState(() => lireOuvertes().has(id))
  return { open, onToggle: (e: SyntheticEvent<HTMLDetailsElement>) => retenirOuverte(id, e.currentTarget.open) }
}

/**
 * Une section du profil qu'on déplie d'un toucher sur son titre. Repliée
 * d'abord ; son titre dit où l'on en est — « 3 / 12 », ou l'avatar qu'on
 * porte —, de quoi donner envie d'ouvrir. Vide, elle ne montre que son titre
 * et son zéro : un chevron y promettrait quelque chose à déplier.
 */
function Repli({
  id,
  icone,
  titre,
  compte,
  apercu,
  vide,
  children,
}: {
  id: string
  icone: IconName
  titre: string
  compte?: string
  apercu?: ReactNode
  vide?: boolean
  children: ReactNode
}) {
  const souvenir = useSouvenir(id)
  const tete = (
    <>
      <h3>
        <Icon name={icone} />
        {titre}
      </h3>
      <span className="repli-compte">
        {apercu}
        {compte !== undefined && <span className="muted small">{compte}</span>}
        {/* Vide, la place du chevron reste : les comptes s'alignent. */}
        {vide ? <span className="icon" aria-hidden="true" /> : <Icon name="chevron-down" className="repli-chevron" />}
      </span>
    </>
  )
  if (vide) {
    return (
      <div className="card repli">
        <div className="card-head">{tete}</div>
      </div>
    )
  }
  return (
    <details className="card repli" {...souvenir}>
      <summary className="card-head">{tete}</summary>
      <div className="repli-corps">{children}</div>
    </details>
  )
}

/** Un repli dans une carte — « Tous mes chiffres » : un lien plutôt qu'un titre. */
function Deplier({ id, titre, children }: { id: string; titre: string; children: ReactNode }) {
  const souvenir = useSouvenir(id)
  return (
    <details className="repli-interne" {...souvenir}>
      <summary>
        {titre}
        <Icon name="chevron-down" className="repli-chevron" />
      </summary>
      {children}
    </details>
  )
}
