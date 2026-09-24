import { useEffect, useState, type FormEvent } from 'react'
import { Limite } from './Limite'
import type { PublicPlayer, PublicTeam } from '../../../shared/types'
import type { PublicSpace } from '../../../shared/space'
import type { PublicProfile } from '../../../shared/profil'
import { AVATARS } from '../../../shared/avatars'
import { cibleEclat } from '../../../shared/legendaires'
import { sansAccent } from '../../../shared/homonymes'
import { MOTIFS } from '../../../shared/erreurs'
import { ApiError, api, motifDe } from '../api'
import { loadChoix } from '../state'
import { JoinHead } from './Invitation'
import { CodeSecours, FormulaireSecours } from './Secours'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { TeamPicker } from './TeamPicker'
import { Icon } from './Icon'
import { espacesFines } from '../format'

/** Ce qu'on envoie au serveur pour être quelqu'un ce soir. */
export interface Identite {
  /** Absent = « prends celui de mon profil ». */
  name?: string
  avatar?: string
}

interface Props {
  space: PublicSpace
  /** Les invités déjà là — c'est d'eux qu'on déduit les homonymes. */
  players: PublicPlayer[]
  teams: PublicTeam[]
  /** Le profil reconnu au cookie sur ce téléphone, s'il y en a un. */
  profil: PublicProfile | null
  /** Rouvre la connexion pour que le serveur voie le cookie tout juste posé. */
  reconnecter: () => Promise<PublicProfile | null>
  /** Rejoint la soirée. Rend le motif du refus, ou null si c'est passé. */
  rejoindre: (choix: Identite & { teamId: string | null }) => Promise<string | null>
  /** Oublie le profil de ce téléphone — « ce n'est pas moi ». */
  oublierProfil: () => Promise<void>
}

type Etape = 'entree' | 'moi' | 'retour' | 'securiser' | 'code' | 'secours' | 'equipe'

/** Un avatar au hasard : sans ça, tous ceux qui ne touchent à rien arrivent identiques. */
export const tirage = () => AVATARS[Math.floor(Math.random() * AVATARS.length)]

/** « Camille » → « camille » : un identifiant proposé, qu'on peut changer. */
export const identifiantPour = (prenom: string) =>
  sansAccent(prenom).replace(/[^a-z0-9._-]+/g, '').slice(0, 32)

/**
 * Tout ce qu'un invité traverse entre le scan du QR et la salle d'attente :
 * la connexion, le prénom, les retrouvailles, la création de profil, le code
 * de secours et l'équipe.
 *
 * ── Le parti pris ────────────────────────────────────────────────────────
 *
 * L'entrée est **un écran de connexion**, et c'est voulu : il règle d'un coup
 * le prénom, l'avatar et la progression de tous ceux qui reviennent. Mais il
 * ne retient personne — « Jouer sans compte » a exactement le format de « Me
 * connecter », se voit sans défiler, et n'est jamais un lien gris en bas de
 * page. C'est à ça que se mesure cet écran.
 *
 * Et un profil reconnu ne choisit plus rien : il a choisi son prénom et son
 * avatar une fois, en créant son profil. On les lit, on ne les redemande pas.
 */
export function Entree({ space, players, teams, profil, reconnecter, rejoindre, oublierProfil }: Props) {
  // Ce que ce téléphone a déjà choisi ici : sa présence dit que l'entrée a
  // déjà été vue dans cet espace, et qu'il est inutile de la remontrer.
  const [choix] = useState(() => loadChoix(space.slug))
  const [etape, setEtape] = useState<Etape>(() => (profil ? 'retour' : choix ? 'moi' : 'entree'))
  const [name, setName] = useState(() => profil?.name ?? choix?.name ?? '')
  const [avatar, setAvatar] = useState(() => profil?.avatar ?? choix?.avatar ?? tirage())
  /** L'écran « moi » sert aussi de première étape à la création d'un profil. */
  const [creation, setCreation] = useState(false)
  const [identite, setIdentite] = useState<Identite>({})
  const [teamId, setTeamId] = useState<string | null>(null)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  /** L'identifiant libre que le serveur propose quand celui voulu est pris. */
  const [suggestion, setSuggestion] = useState('')
  /** Le code de secours, à noter — il ne repassera jamais. */
  const [recovery, setRecovery] = useState('')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')

  // Les avatars déjà portés par un invité du même prénom. On les éteint plutôt
  // que d'annoncer une erreur après coup : vingt-quatre emojis suffisent
  // toujours, et changer d'animal ne demande aucun effort.
  const pris = new Set(
    name.trim() ? players.filter(p => sansAccent(p.name) === sansAccent(name)).map(p => p.avatar) : [],
  )
  // Celui qu'on porte déjà ne s'éteint jamais : on garde toujours son choix,
  // et c'est la marque « (2) » qui distinguera si ça se croise vraiment.
  const estPris = (a: string) => a !== avatar && pris.has(a)

  // Le tirage au sort peut tomber sur l'avatar d'un homonyme. On en change
  // avant que l'invité s'en aperçoive — seulement quand le prénom bouge,
  // pour ne jamais retirer des mains un avatar délibérément choisi.
  useEffect(() => {
    if (!pris.has(avatar)) return
    const libre = AVATARS.find(a => !pris.has(a))
    if (libre) setAvatar(libre)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  // Chaque écran commence en haut. L'écran « moi » est plus long que la
  // fenêtre d'un petit téléphone : on y défile pour atteindre « Continuer »,
  // et l'écran d'équipe qui suivait héritait de ce défilement — son titre
  // passait au-dessus du bord.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [etape])

  const connectes = players.filter(p => p.connected).length
  const salut = (
    <JoinHead
      eyebrow={space.eyebrow}
      title={space.headline}
      compact={space.headline.length > 12}
      sub="Le quiz de la soirée"
    />
  )

  /**
   * Rejoint pour de bon. Le parent change d'écran si ça passe.
   *
   * Le bouton se rend quoi qu'il arrive : une exception en route (un
   * stockage refusé, par exemple) le laissait grisé pour toujours, sans un
   * mot — alors que l'invité était peut-être déjà inscrit.
   */
  const entrer = async (qui: Identite, equipe: string | null) => {
    setBusy(true)
    setErreur('')
    try {
      const refus = await rejoindre({ ...qui, teamId: equipe })
      if (refus) setErreur(refus)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  /** Dernière bifurcation : l'équipe s'il y en a, la soirée sinon. */
  const versLaSoiree = (qui: Identite) => {
    setIdentite(qui)
    setErreur('')
    if (teams.length > 0) return setEtape('equipe')
    void entrer(qui, null)
  }

  // ── Écran A : l'entrée ───────────────────────────────────────────────
  if (etape === 'entree') {
    const connexion = async (e: FormEvent) => {
      e.preventDefault()
      setBusy(true)
      setErreur('')
      try {
        await api.joueur.connexion(login.trim(), password)
        // Le cookie vient d'être posé, mais la poignée de main du socket est
        // déjà passée : sans cette reconnexion, la soirée ne rattacherait pas
        // le profil et l'expérience du soir se perdrait.
        const p = await reconnecter()
        setBusy(false)
        if (!p) return setErreur(MOTIFS.reseau)
        // Pas d'écran de confirmation : celui qui vient de taper son mot de
        // passe sait très bien qui il est. Son profil fournit son identité.
        versLaSoiree({})
      } catch (e) {
        setBusy(false)
        setErreur(motifDe(e))
      }
    }

    return (
      <form className="join entree" onSubmit={connexion}>
        {salut}
        <div className="field">
          <label className="label" htmlFor="e-login">
            Ton identifiant
          </label>
          {/* Pas d'`autoFocus` : le clavier qui s'ouvre tout seul pousserait
              hors de l'écran le bouton qui permet de passer, et c'est
              exactement ce qu'on ne veut pas cacher. */}
          <input
            id="e-login"
            className="input input-line"
            value={login}
            onChange={e => setLogin(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="e-pass">
            Ton mot de passe
          </label>
          <input
            id="e-pass"
            className="input input-line"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {erreur && (
          <div role="alert">
            <p className="error">{erreur}</p>
            <p className="muted small">Tu peux aussi jouer sans compte, juste en dessous.</p>
          </div>
        )}
        <button
          className="btn btn-primary btn-big btn-block"
          disabled={busy || !login.trim() || !password}
        >
          Me connecter
        </button>
        <p className="join-foot">
          {/* L'erreur de la connexion ratée ne suit pas : elle restait affichée
              sous le code neuf, une fois le profil retrouvé (Malik). */}
          <button
            type="button"
            className="link-inline"
            onClick={() => {
              setErreur('')
              setEtape('secours')
            }}
          >
            J'ai oublié mon mot de passe
          </button>
        </p>
        <p className="entree-ou">ou</p>
        <div className="join-actions">
          {/* Même largeur, même hauteur que « Me connecter » : seul le style
              diffère. Si quelqu'un doit chercher comment passer, c'est raté. */}
          <button
            type="button"
            className="btn btn-accent btn-big btn-block"
            onClick={() => {
              setCreation(false)
              setErreur('')
              setEtape('moi')
            }}
          >
            Jouer sans compte
          </button>
          <button
            type="button"
            className="btn btn-big btn-block"
            onClick={() => {
              setCreation(true)
              setErreur('')
              setEtape('moi')
            }}
          >
            Créer un profil
          </button>
        </div>
        <p className="entree-note">
          Un profil retient ton niveau et tes prix d'une soirée à l'autre. Il ne change rien aux
          points de ce soir.
        </p>
        <div className="join-grow" />
        {connectes > 0 && <p className="join-foot">{connectes} invité·e·s déjà là</p>}
      </form>
    )
  }

  // ── Écran D : le code de secours ─────────────────────────────────────
  if (etape === 'secours') {
    return (
      <FormulaireSecours
        prefill={login.trim()}
        onDone={async (p, neuf) => {
          const connu = await reconnecter()
          if (!connu && !p) return setEtape('entree')
          // Le code vient d'être consommé : celui qu'on rend est le nouveau,
          // et il doit se noter tout de suite comme à l'inscription.
          setErreur('')
          setRecovery(neuf)
          setEtape('code')
        }}
        onCancel={() => setEtape('entree')}
      />
    )
  }

  // ── Écran B′ : content de te revoir ──────────────────────────────────
  if (etape === 'retour' && profil) {
    return (
      <div className="join entree">
        {/* Chez qui l'on entre : les retrouvailles ne le disaient pas, et un
            profil reconnu d'un animateur à l'autre ne savait plus où il était. */}
        {salut}
        {/* Centré, pas collé en haut : c'est un visage qu'on reconnaît, pas un
            formulaire qu'on remplit. */}
        <div className="join-grow" />
        <div className="retrouvailles">
          <Avatar
            className="retour-avatar"
            avatar={profil.avatar}
            finition={profil.finition}
            eclat={profil.eclats.includes(cibleEclat(profil.legendaire, profil.avatar))}
            legendaire={profil.legendaire ?? undefined}
          />
          {/* « Content de te revoir » parlait au masculin, et dès la première
              visite : « Te revoilà » ne dit ni l'un ni l'autre. */}
          <p className="retour-salut">Te revoilà,</p>
          <h1 className="join-title compact">{profil.name}</h1>
          {/* La pastille de niveau toute seule ne dit rien : posée à côté d'un
              prénom elle se comprend, sur sa propre ligne c'est un « 1 » nu. */}
          {/* Le niveau seul : « 3 badges » parlait une langue que la page du
              profil ne parle nulle part — elle dit « prix » et « hauts faits ». */}
          <p className="muted">Niveau {profil.niveau}</p>
        </div>
        {erreur && <p className="error" role="alert">{erreur}</p>}
        <div className="join-grow" />
        {/* Aucun champ, aucune grille d'emojis : il a choisi son prénom et son
            avatar une fois, en créant son profil. */}
        <button
          className="btn btn-primary btn-big btn-block"
          disabled={busy}
          onClick={() => versLaSoiree({})}
        >
          Entrer dans la soirée
        </button>
        <div className="join-actions">
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => {
              // Son prénom du soir, pas celui de son profil : le profil, lui,
              // ne bouge pas.
              setName(profil.name)
              setAvatar(profil.avatar)
              setCreation(false)
              setEtape('moi')
            }}
          >
            Jouer sous un autre prénom ce soir
          </button>
        </div>
        {/* Discret, et c'est voulu : le téléphone prêté est le cas rare, pas
            le cas courant. */}
        <p className="join-foot">
          <button
            type="button"
            className="link-inline"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await oublierProfil()
              setBusy(false)
              setName('')
              setAvatar(tirage())
              setEtape('entree')
            }}
          >
            Ce n'est pas moi
          </button>
        </p>
      </div>
    )
  }

  // ── Écran C : sécuriser le profil ────────────────────────────────────
  if (etape === 'securiser') {
    const creer = async (e: FormEvent) => {
      e.preventDefault()
      setBusy(true)
      setErreur('')
      setSuggestion('')
      try {
        const res = await api.joueur.inscription({
          login: login.trim(),
          password,
          name: name.trim(),
          avatar,
        })
        // Le profil existe désormais : son code de secours se note quoi qu'il
        // arrive ensuite. Une reconnexion trop lente affichait « Connexion
        // perdue », le code ne se montrait jamais, et retenter créait un
        // second profil sous un autre identifiant. Si la reconnexion n'a pas
        // abouti, l'entrée dans la soirée s'en passera (écran suivant).
        await reconnecter()
        setBusy(false)
        setRecovery(res.recovery)
        setEtape('code')
      } catch (e) {
        setBusy(false)
        setErreur(motifDe(e))
        if (e instanceof ApiError && e.suggestion) setSuggestion(e.suggestion)
      }
    }

    return (
      <form className="join" onSubmit={creer}>
        <p className="label center">Créer ton profil · 2/2</p>
        <h2 className="center">
          <Icon name="sparkles" /> Garder ma progression
        </h2>
        <p className="muted small center">
          Ton identifiant te servira à revenir. Il n'y a pas d'adresse e-mail à donner.
        </p>
        <hr className="hairline" />
        <div className="field">
          <label className="label" htmlFor="c-login">
            Ton identifiant
          </label>
          <input
            id="c-login"
            className="input input-line"
            value={login}
            onChange={e => setLogin(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="c-pass">
            Ton mot de passe
          </label>
          <input
            id="c-pass"
            className="input input-line"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <span className="muted small">Au moins 8 caractères.</span>
        </div>
        {erreur && <p className="error" role="alert">{erreur}</p>}
        {/* Un refus qui ne propose rien laisse debout, dans le noir, quelqu'un
            qui ne sait pas quoi tenter d'autre. */}
        {suggestion && (
          <p className="warn">
            Essaie «&nbsp;{suggestion}&nbsp;» —{' '}
            <button
              type="button"
              className="link-inline"
              onClick={() => {
                setLogin(suggestion)
                setSuggestion('')
                setErreur('')
              }}
            >
              le prendre
            </button>
          </p>
        )}
        <div className="join-grow" />
        <div className="join-actions">
          <button
            className="btn btn-primary btn-big btn-block"
            disabled={busy || !login.trim() || !password}
          >
            Créer mon profil
          </button>
          {/* La sortie : on ne perd ni le prénom ni l'avatar déjà choisis. */}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => versLaSoiree({ name: name.trim(), avatar })}
          >
            Plus tard — je joue
          </button>
        </div>
      </form>
    )
  }

  // ── Écran C′ : le code de secours, une seule fois ────────────────────
  if (etape === 'code') {
    return (
      <div className="join">
        <h2 className="center">Note ce code de secours</h2>
        <CodeSecours code={recovery} />
        {erreur && <p className="error" role="alert">{erreur}</p>}
        <div className="join-grow" />
        {/* Court : en capitales espacées, « entrer dans la soirée » débordait
            des deux côtés d'un téléphone de 360 px.
            Sans profil reconnu (cookie refusé, reconnexion trop lente), on
            entre avec le prénom et l'avatar tout juste choisis — ce sont ceux
            du profil — plutôt que de buter sur « Il faut un prénom ! ». */}
        <button
          className="btn btn-primary btn-big btn-block"
          disabled={busy}
          onClick={() => versLaSoiree(profil || !name.trim() ? {} : { name: name.trim(), avatar })}
        >
          C'est noté — j'entre
        </button>
      </div>
    )
  }

  // ── Écran E : l'équipe ───────────────────────────────────────────────
  if (etape === 'equipe') {
    return (
      <div className="join">
        <JoinHead
          eyebrow="Le quiz de la soirée"
          title="Ton équipe"
          compact
          sub="Tes points restent les tiens — ils comptent aussi pour ton équipe."
        />
        <hr className="hairline" />
        <TeamPicker teams={teams} value={teamId} onPick={setTeamId} disabled={busy} />
        {erreur && <p className="error" role="alert">{erreur}</p>}
        <div className="join-grow" />
        <div className="join-actions">
          <button
            className="btn btn-primary btn-big btn-block"
            disabled={busy || !teamId}
            onClick={() => entrer(identite, teamId)}
          >
            {teamId ? 'Rejoindre la soirée' : 'Choisis ton équipe'}
          </button>
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => setEtape(identite.name ? 'moi' : 'retour')}
          >
            Revenir
          </button>
        </div>
      </div>
    )
  }

  // ── Écran B : moi ────────────────────────────────────────────────────
  const suivant = (e: FormEvent) => {
    e.preventDefault()
    setErreur('')
    // Créer un profil, c'est le même écran suivi d'un second : le prénom et
    // l'avatar ne se choisissent jamais deux fois.
    if (creation) {
      if (!login) setLogin(identifiantPour(name))
      return setEtape('securiser')
    }
    versLaSoiree({ name: name.trim(), avatar })
  }

  const homonyme = name.trim() && players.some(p => sansAccent(p.name) === sansAccent(name))

  return (
    // Le même en-tête resserré qu'à l'écran A : avec le grand titre, « Rejoindre
    // la soirée » tombait à 619–677 px, sous le bord d'un 360 × 640.
    <form className="join entree" onSubmit={suivant}>
      {salut}
      {/* Sans ce mot, l'étape 1 d'un profil ressemblait trait pour trait à une
          entrée sans compte : rien ne disait qu'on en créait un. */}
      {creation && <p className="label center">Créer ton profil · 1/2</p>}
      {profil && (
        <p className="profil-salut">
          <Avatar
            avatar={profil.avatar}
            finition={profil.finition}
            eclat={profil.eclats.includes(cibleEclat(profil.legendaire, profil.avatar))}
            legendaire={profil.legendaire ?? undefined}
          />
          Ton profil reste <strong>{profil.name}</strong>
          <Niveau niveau={profil.niveau} />
        </p>
      )}
      <hr className="hairline" />
      <div className="field">
        <label className="label" htmlFor="join-name">
          Ton prénom
        </label>
        {/* Pas d'`autoFocus`, ici non plus : le clavier ouvert d'office
            poussait « Rejoindre la soirée » hors de l'écran — et l'habitué
            qui revient, écran pré-rempli, n'a souvent rien à retaper. */}
        <input
          id="join-name"
          className="input input-line"
          autoComplete="given-name"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={24}
          // Au téléphone, la touche du clavier le referme au lieu de valider :
          // les avatars, qu'il cachait, restent à choisir, et « Continuer »
          // réapparaît juste dessous. Au clavier d'un ordinateur, Entrée valide.
          enterKeyHint="done"
          onKeyDown={e => {
            if (e.key !== 'Enter' || !window.matchMedia?.('(pointer: coarse)').matches) return
            e.preventDefault()
            e.currentTarget.blur()
          }}
        />
        <Limite valeur={name} max={24} />
      </div>
      <div className="field">
        <div className="field-head">
          <span className="label" id="avatar-label">
            Ton avatar
          </span>
          {connectes > 0 && <span className="muted small">{connectes} invité·e·s déjà là</span>}
        </div>
        <div className="emoji-grid" role="group" aria-labelledby="avatar-label">
          {AVATARS.map(a => (
            <button
              type="button"
              key={a}
              className={
                'emoji-btn' + (a === avatar ? ' selected' : '') + (estPris(a) ? ' pris' : '')
              }
              aria-pressed={a === avatar}
              aria-disabled={estPris(a)}
              aria-label={`Avatar ${a}${estPris(a) ? ', déjà pris par un homonyme' : ''}`}
              onClick={() => !estPris(a) && setAvatar(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      {/* On ne demande plus d'ajouter une initiale : c'était du travail pour
          l'invité. L'avatar distingue, et il est à côté du prénom partout. */}
      {homonyme && (
        <p className="warn">
          Il y a déjà un {espacesFines(`« ${name.trim()} »`)} — ton {avatar} vous distinguera.
        </p>
      )}
      {erreur && <p className="error" role="alert">{erreur}</p>}
      <div className="join-grow" />
      <button className="btn btn-primary btn-big btn-block" disabled={busy || !name.trim()}>
        {creation || teams.length > 0 ? 'Continuer' : 'Rejoindre la soirée'}
      </button>
      <p className="join-foot">
        Rien à installer · ton prénom suffit ·{' '}
        <button
          type="button"
          className="link-inline"
          onClick={() => {
            setErreur('')
            setEtape('entree')
          }}
        >
          j'ai un profil
        </button>
      </p>
    </form>
  )
}
