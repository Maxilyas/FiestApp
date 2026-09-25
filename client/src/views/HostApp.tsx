import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { helloHost, socket } from '../socket'
import { setState, showToast, useAppState } from '../state'
import { choixDialog, confirmDialog, promptDialog } from '../components/Dialog'
import { ChampNombre } from '../components/ChampNombre'
import { api, motifDe } from '../api'
import { dataUrl, spacePath } from '../routes'
import { ONGLETS } from '../onglets'
import { formatDay } from '../../../shared/archive'
import { titreDeCloture } from '../../../shared/space'
import { espacesFines } from '../format'
import { initAudio, isMuted, toggleMuted } from '../sound'
import { currentTheme, toggleTheme } from '../theme'
import { Leaderboard } from '../components/Leaderboard'
import { Coupe } from '../components/Coupe'
import { TeamBoard } from '../components/TeamBoard'
import { FinalPodium, Standings } from '../components/Podium'
import { Trophies } from '../components/Trophies'
import { AwardsBoard } from '../components/AwardsBoard'
import { Icon } from '../components/Icon'
import { Rank, Score, motPoints } from '../components/Rank'
import { LoginForm } from '../components/Invitation'
import { ConsoleActions, ConsoleSlot } from '../components/HostConsole'
import { Absents } from '../components/Absents'
import { detailDesPoints, effetDUnPrix, rankTeams, regleDesEquipes, vainqueursDuQuiz } from '../../../shared/teams'
import { classer, enumerer } from '../../../shared/classement'
import type { EcranDeScene, PublicPlayer, PublicTeam, Recap } from '../../../shared/types'
import { sound } from '../sound'
import { QuizHost } from '../games/quiz/HostView'
import type { QuizHostView } from '../../../shared/games/quiz'
import { Avatar } from '../components/Avatar'
import { Niveau } from '../components/Niveau'
import { distinctions } from '../../../shared/profil'
import { partsDuNom } from '../../../shared/homonymes'
import type { ArchiveList } from '../../../shared/archive'
import { AnnoncesDeNiveau, ClotureEcran } from '../components/Cloture'
import { BoutonCopier } from '../components/Partage'
import { useEcranAllume } from '../veille'
import { RemiseEnScene } from '../components/RemiseEnScene'
import { CodeDeLaTele } from '../components/Appairage'
import { retenirTelecommande, telecommandeParDefaut } from '../telecommande'

/** QR wifi standard : le téléphone rejoint le réseau en le scannant. */
function wifiQrValue(wifi: { ssid: string; pass: string }): string {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1')
  return wifi.pass
    ? `WIFI:T:WPA;S:${esc(wifi.ssid)};P:${esc(wifi.pass)};;`
    : `WIFI:T:nopass;S:${esc(wifi.ssid)};;`
}

/** L'encre des QR codes : le noir chaud du fond, sur blanc. */
const QR_INK = '#1a1412'

/**
 * Le plein écran n'existe pas partout : sur iPhone, il est réservé aux
 * vidéos, et `requestFullscreen` n'y est même pas défini — le bouton levait
 * une exception et ne faisait rien. On ne montre que ce qui marche.
 */
const PLEIN_ECRAN = document.fullscreenEnabled === true

/**
 * L'adresse projetée, avec une coupure permise avant le nom de l'espace : sur
 * un téléphone, elle passait à la ligne au milieu du mot (« roman / e »).
 */
function adresseCoupable(url: string) {
  const i = url.lastIndexOf('/')
  if (i <= 0) return url
  return (
    <>
      {url.slice(0, i)}
      <wbr />
      {url.slice(i)}
    </>
  )
}

/** De quoi baptiser six équipes sans réfléchir, dans l'ambiance de la soirée. */
// Tous antérieurs à Unicode 13 : les emojis récents (boule à facettes,
// visage pointillé…) s'affichent en carré vide sur Windows 10.
const TEAM_EMOJIS = ['💃', '🕺', '🎤', '✨', '🥁', '🌶️', '🦩', '🍹', '⭐', '🔥', '🌙', '🎺', '🌺', '🦜']

/**
 * Le prénom d'une pastille d'invité : il se coupe, sa marque d'homonymie
 * jamais (invariant 17). « Camil… » et « Camil… » côte à côte, c'était deux
 * invités qu'on ne distinguait plus là où l'on fait les équipes.
 */
function NomDePastille({ joueur }: { joueur: PublicPlayer }) {
  const { prenom, marque } = partsDuNom(joueur)
  return (
    <>
      <span className="chip-prenom">{prenom}</span>
      {marque && <span className="chip-marque">{marque.trim()}</span>}
    </>
  )
}

/**
 * Le plancher du prénom, posé sur le bouton (`--plancher`) : la première
 * colonne de sa grille ne descend pas plus bas. Quatre caractères — c'est
 * le sélecteur d'équipe qui cède avec lui, et au pire cas (badge, marque,
 * lune, équipe, croix) cinq ne tenaient plus dans la colonne de 1366. Un
 * prénom plus court ne se coupe pas du tout : un plancher en `ch` l'aurait
 * suivi d'un blanc, la lettre « 0 » étant plus large que la plupart des
 * autres.
 */
function plancherDuPrenom(joueur: PublicPlayer): string {
  return [...partsDuNom(joueur).prenom].length > 4 ? '4ch' : 'max-content'
}

/**
 * Une équipe et ses membres, avec de quoi la renommer, la supprimer, et
 * déplacer quelqu'un qui s'est trompé de bouton à l'inscription.
 */
function TeamGroup({
  team,
  members,
  teams,
}: {
  team: PublicTeam | null
  members: PublicPlayer[]
  teams: PublicTeam[]
}) {
  return (
    <div className={'team-group' + (team ? '' : ' team-group-none')}>
      <div className="team-group-head">
        {team ? (
          <>
            <select
              className="team-emoji-select"
              value={team.emoji}
              title="Changer l'emoji"
              aria-label={`Emoji de l'équipe ${team.name}`}
              onChange={e => socket.emit('host:updateTeam', { teamId: team.id, emoji: e.target.value })}
            >
              {/* L'emoji courant peut venir d'une soirée précédente : on l'ajoute
                  à la liste, sinon le select afficherait autre chose que la réalité. */}
              {[...new Set([team.emoji, ...TEAM_EMOJIS])].map(e => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <button
              className="chip-name team-group-name"
              title="Renommer l'équipe"
              aria-label={`Renommer l'équipe ${team.name}`}
              onClick={async () => {
                const name = await promptDialog({
                  title: `Nouveau nom pour « ${team.name} »`,
                  input: { value: team.name, placeholder: "Nom de l'équipe", maxLength: 20 },
                  confirmLabel: 'Renommer',
                })
                if (name) socket.emit('host:updateTeam', { teamId: team.id, name })
              }}
            >
              {team.name}
            </button>
            <span className="muted small">{members.length}</span>
            <button
              className="chip-remove"
              title="Supprimer l'équipe"
              aria-label={`Supprimer l'équipe ${team.name}`}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: `Supprimer l'équipe « ${team.name} » ?`,
                  message: `Ses ${members.length} membres ne sont pas exclus : ils repassent « sans équipe » et gardent leurs points.`,
                  confirmLabel: "Supprimer l'équipe",
                  danger: true,
                })
                if (ok) socket.emit('host:removeTeam', { teamId: team.id })
              }}
            >
              <Icon name="x" />
            </button>
          </>
        ) : (
          <span className="team-group-name muted">Sans équipe ({members.length})</span>
        )}
      </div>

      <div className="players-grid">
        {members.map(p => (
          <div key={p.id} className={'player-chip' + (p.connected ? '' : ' offline')}>
            <Avatar className="player-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
            <Niveau niveau={p.niveau} />
            {/* Les libellés de la puce prennent le nom affiché, marque comprise :
                c'est une porte de plus par où sort un prénom (invariant 17).
                Avec `p.name`, deux « Camille » avaient les mêmes boutons pour
                qui les entend, et « Exclure Camille » ne disait pas laquelle. */}
            {/* Un surnom pour la soirée : l'écran commun, le souvenir et le
                bilan l'affichent ; le profil de l'invité garde son prénom, et
                la soirée suivante le lui rend. */}
            <button
              className="chip-name"
              style={{ '--plancher': plancherDuPrenom(p) } as CSSProperties}
              title={`${p.nomAffiche ?? p.name} — donner un surnom pour la soirée`}
              aria-label={`Donner un surnom à ${p.nomAffiche ?? p.name}`}
              onClick={async () => {
                const name = await promptDialog({
                  title: `Un surnom pour « ${p.nomAffiche ?? p.name} » ce soir`,
                  message: p.niveau
                    ? 'Il s’affiche partout ce soir. Son profil garde son prénom, et la soirée suivante le lui rend.'
                    : 'Il s’affiche partout ce soir, à la place du prénom choisi à l’entrée.',
                  input: { value: p.name, placeholder: 'Surnom', maxLength: 24 },
                  confirmLabel: 'Donner ce surnom',
                })
                if (name) socket.emit('host:renamePlayer', { playerId: p.id, name })
              }}
            >
              <NomDePastille joueur={p} />
            </button>
            {/* Hors ligne : la transparence seule ne se lit pas du fond de la
                salle, et un lecteur d'écran n'en sait rien. */}
            {!p.connected && (
              <span className="chip-offline" title="Hors ligne" role="img" aria-label="hors ligne">
                <Icon name="moon" />
              </span>
            )}
            {teams.length > 0 && (
              <select
                className="chip-team"
                value={p.teamId ?? ''}
                title="Changer d'équipe"
                aria-label={`Équipe de ${p.nomAffiche ?? p.name}`}
                onChange={e =>
                  socket.emit('host:assignPlayer', {
                    playerId: p.id,
                    teamId: e.target.value || null,
                  })
                }
              >
                <option value="">— sans équipe</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="chip-remove"
              title="Exclure de la soirée"
              aria-label={`Exclure ${p.nomAffiche ?? p.name} de la soirée`}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: `Retirer « ${p.nomAffiche ?? p.name} » de la soirée ?`,
                  message: 'Ses points seront effacés et son téléphone reviendra à l’inscription.',
                  confirmLabel: 'Exclure',
                  danger: true,
                })
                if (ok) socket.emit('host:removePlayer', { playerId: p.id })
              }}
            >
              <Icon name="x" />
            </button>
          </div>
        ))}
        {members.length === 0 && <p className="muted small">Personne pour l'instant</p>}
      </div>
    </div>
  )
}

export function HostApp() {
  const s = useAppState()
  useEffect(() => {
    // Rouverte dans l'onglet de « Mes quiz » (sa console fermée entre-temps),
    // la console en gardait le nom : « Mes quiz » la remplaçait alors par
    // l'éditeur, et le QR quittait l'écran. Une console n'est aucun onglet
    // nommé : ses liens doivent toujours en ouvrir un autre.
    if ((Object.values(ONGLETS) as string[]).includes(window.name)) window.name = ''
  }, [])
  /** L'animateur reconnu par le serveur — `null` tant que la session n'a pas été vérifiée. */
  const [me, setMe] = useState<{ slug: string; name: string; branchee: boolean } | null>(null)
  /**
   * Une bibliothèque vide : « Lancer un quiz » ne répondait que par un toast
   * qui dictait une adresse. Relue au retour dans l'onglet — c'est dans
   * « Mes quiz », à côté, qu'on vient d'en créer un.
   */
  const [bibliothequeVide, setBibliothequeVide] = useState(false)
  useEffect(() => {
    if (!me) return
    const lire = () =>
      api
        .list()
        // Des quiz sans question prête ne se jouent pas (`setQuizLibrary`) :
        // pour « Lancer un quiz », c'est encore une bibliothèque vide.
        .then(l => setBibliothequeVide(l.every(q => q.readyCount === 0)))
        .catch(() => {})
    const auRetour = () => {
      if (document.visibilityState === 'visible') lire()
    }
    lire()
    document.addEventListener('visibilitychange', auRetour)
    window.addEventListener('focus', lire)
    return () => {
      document.removeEventListener('visibilitychange', auRetour)
      window.removeEventListener('focus', lire)
    }
  }, [me])
  /** Le serveur a refusé la poignée de main : pas de session, ou une session périmée. */
  const [needLogin, setNeedLogin] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [muted, setMuted] = useState(isMuted)
  /** Velours (noir chaud) ou Ivoire (fond clair, pour un vidéoprojecteur qui délave les noirs). */
  const [theme, setTheme] = useState(currentTheme)
  /** Cet écran se tient en télécommande : les gestes en grand, sans la scène projetée. */
  const [telecommande, setTelecommande] = useState(telecommandeParDefaut)
  /** Motif et points du prix libre, celui qui ne se calcule pas. */
  const [freeReason, setFreeReason] = useState('')
  const [freePoints, setFreePoints] = useState(1)
  const [freeTeam, setFreeTeam] = useState('')
  /** Les prix de caractère, calculés côté serveur à partir du journal des points. */
  const [recap, setRecap] = useState<Recap | null>(null)
  /** Formulaire de création d'équipe. */
  const [newTeam, setNewTeam] = useState('')
  const [newEmoji, setNewEmoji] = useState(TEAM_EMOJIS[0])
  /** Combien d'équipes créer d'un coup ; null tant qu'on garde la suggestion. */
  const [nbEquipes, setNbEquipes] = useState<number | null>(null)
  /** L'emplacement de la console animateur, où chaque écran pose ses boutons. */
  const [consoleSlot, setConsoleSlot] = useState<HTMLElement | null>(null)

  // L'écran commun ne s'éteint pas en pleine soirée : le QR doit rester au
  // mur pendant l'arrivée des invités, un quiz en mode « Auto » ne touche
  // plus la souris, et un téléphone qui pilote ou qu'on recopie sur la télé
  // se met en veille au bout de trente secondes.
  useEcranAllume(me !== null)

  // Rechargés à chaque ouverture d'un écran de fin : les prix et les
  // statistiques changent après chaque quiz joué.
  const spaceSlug = s.snapshot?.space.slug ?? null
  const spaceTitle = s.snapshot?.space.title ?? null
  /**
   * L'écran de fin de soirée projeté à la place du jeu, `null` en salle
   * d'attente. C'était un état de la page : ouvert au téléphone, il ne
   * passait pas à la télé. Le serveur le tient maintenant pour tous les
   * écrans d'animateur de l'espace (`host:scene`). La clôture ne se montre
   * qu'avec son annonce : un écran qui ne l'a pas reçue reste en salle
   * d'attente.
   */
  const ecran = s.snapshot?.scene?.ecran ?? null
  const screen =
    ecran === 'cloture'
      ? s.cloture
        ? 'cloture'
        : null
      : ecran === 'prix'
        ? 'awards'
        : ecran === 'victoire'
          ? 'victory'
          : ecran
  useEffect(() => {
    if (spaceTitle) document.title = `${spaceTitle} · Écran commun`
  }, [spaceTitle])
  // La clôture quittée — « La soirée suivante », cliquée ici ou à l'autre
  // console — ne laisse pas son annonce derrière elle. Un écran qui n'en a
  // jamais reçu la scène n'y touche pas : l'annonce arrive avant elle.
  const aVuLaCloture = useRef(false)
  useEffect(() => {
    if (ecran === 'cloture') aVuLaCloture.current = true
    else if (aVuLaCloture.current && s.snapshot) {
      aVuLaCloture.current = false
      setState({ cloture: null })
    }
  }, [ecran, s.snapshot])
  // La fanfare sonne sur l'écran qui montre la scène, pas sur la
  // télécommande qui l'a ouverte.
  const ecranPrecedent = useRef(ecran)
  useEffect(() => {
    if (ecran !== ecranPrecedent.current && !telecommande && (ecran === 'podium' || ecran === 'victoire')) sound.fanfare()
    ecranPrecedent.current = ecran
  }, [ecran, telecommande])
  /**
   * Les coulisses — la liste des quiz, la grille des prix — vont à la
   * télécommande quand il y en a une. Elles se lisent par scène : l'écran
   * de fin, ou la phase du quiz.
   */
  const sessionEnCours = s.snapshot?.session
  const phaseEnCours = sessionEnCours
    ? (s.views[sessionEnCours.id]?.view as QuizHostView | undefined)?.phase
    : undefined
  const cleCoulisses = `${ecran ?? ''}:${phaseEnCours ?? ''}`
  // Un numéro par scène traversée, pas la clé elle-même : les prix rouverts
  // après un détour par la salle d'attente sont une scène neuve, et ce qu'on
  // y avait repris « d'ici » ne doit pas y revenir.
  const scenes = useRef({ cle: cleCoulisses, numero: 0 })
  if (scenes.current.cle !== cleCoulisses) scenes.current = { cle: cleCoulisses, numero: scenes.current.numero + 1 }
  const numeroDeScene = scenes.current.numero
  /**
   * La télécommande s'est vue pendant cette scène. Son téléphone verrouillé,
   * ou dix-huit secondes dans l'appareil photo, et le serveur la retire :
   * la télé projetait alors la grille, tous les lauréats et la consigne
   * avec. Les coulisses restent donc cachées jusqu'à la scène suivante.
   */
  const [telecommandeVue, setTelecommandeVue] = useState<number | null>(null)
  const telecommandeLa = !!s.snapshot?.telecommande
  useEffect(() => {
    if (telecommandeLa) setTelecommandeVue(numeroDeScene)
  }, [telecommandeLa, numeroDeScene])
  /**
   * « Choisir d'ici » : la télé reprend les coulisses pour cette scène. Marc
   * anime du portable branché à la télé et ouvre /host sur son téléphone —
   * étroit, donc télécommande —, et son portable ne pouvait plus ni choisir
   * un quiz ni remettre un prix. Oublié à la scène suivante.
   */
  const [coulissesIci, setCoulissesIci] = useState<number | null>(null)
  const reprendreCoulisses = () => setCoulissesIci(numeroDeScene)
  const finirAnnonces = useCallback(() => setState({ progres: null }), [])
  useEffect(() => {
    if (!screen || screen === 'cloture' || !spaceSlug) return
    fetch(dataUrl(spaceSlug, 'recap.json'))
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setRecap)
      .catch(() => {
        // Un podium sans prix ni trophées, sans un mot, ressemblerait à un
        // écran normal : l'animateur doit savoir qu'il manque quelque chose.
        setRecap(null)
        showToast({ kind: 'error', message: 'Impossible de charger les prix et les statistiques' })
      })
  }, [screen, spaceSlug])

  const telecommandeRef = useRef(telecommande)
  const basculerTelecommande = () => {
    const active = !telecommande
    telecommandeRef.current = active
    retenirTelecommande(active)
    setTelecommande(active)
    socket.emit('host:telecommande', { active })
  }

  // La session voyage dans le cookie de la poignée de main : le serveur la
  // reconnaît (ou non) à chaque connexion, sans rien à retenir ici.
  useEffect(() => {
    socket.connect()
    const hello = async () => {
      // Sans réponse, on ne conclut rien sur la session : la liaison est
      // vérifiée, et la prochaine connexion reposera la question.
      const res = await helloHost().catch(() => null)
      if (!res) return
      if (res.ok && res.slug && res.name) {
        setMe({ slug: res.slug, name: res.name, branchee: !!res.branchee })
        setNeedLogin(false)
        // Chaque connexion se redit télécommande : le serveur l'oublie avec
        // la précédente.
        socket.emit('host:telecommande', { active: telecommandeRef.current })
      } else {
        setMe(null)
        setNeedLogin(true)
      }
    }
    // Une session révoquée — déconnexion ou mot de passe changé depuis « Mon
    // compte » — coupe l'écran commun côté serveur. Après ce motif-là,
    // socket.io ne se reconnecte jamais tout seul : « reconnexion… » restait
    // affiché pour toujours, et la console n'envoyait plus rien.
    const coupe = (motif: string) => {
      if (motif !== 'io server disconnect') return
      setMe(null)
      setNeedLogin(true)
      // Débranchée exprès, la télé n'a pas à dire qu'on l'a fermée.
      if (!debranchement.current) setError('Session fermée — reconnecte-toi')
      debranchement.current = false
    }
    if (socket.connected) hello()
    socket.on('connect', hello)
    socket.on('disconnect', coupe)
    return () => {
      socket.off('connect', hello)
      socket.off('disconnect', coupe)
    }
  }, [])

  /**
   * « Ce n'est pas le tien ? Débrancher » : tout animateur du serveur peut
   * valider le code qu'une télé affiche, et elle s'ouvrait sur son espace
   * sans que personne devant la télé ne sache lequel. La session de cette
   * télé se ferme, et elle revient à son code.
   */
  const debranchement = useRef(false)
  const debrancher = async () => {
    debranchement.current = true
    try {
      await api.auth.logout()
    } catch (e) {
      debranchement.current = false
      showToast({ kind: 'error', message: motifDe(e) })
      return
    }
    setMe(null)
    setError('')
    setNeedLogin(true)
  }

  // La télé branchée depuis le téléphone : son cookie est posé, la prochaine
  // poignée de main le porte.
  const branchee = useCallback(() => {
    setError('')
    socket.disconnect()
    socket.connect()
  }, [])

  const submitLogin = async (login: string, password: string) => {
    setBusy(true)
    setError('')
    try {
      await api.auth.login(login, password)
      // Le cookie est posé : la prochaine poignée de main le porte.
      socket.disconnect()
      socket.connect()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Le focus suit la vue. « Lancer un quiz » disparaît sous le doigt qui
  // vient de le presser : au clavier, le focus tombait sur la page entière,
  // et le Tab suivant repartait du haut de l'écran. Quand la vue change et
  // que le focus s'est perdu — et seulement alors —, il se pose sur le titre
  // de la nouvelle scène : un lecteur d'écran le lit, le clavier repart de là.
  const scene = useRef<HTMLElement>(null)
  const vue = `${screen ?? ''}|${sessionEnCours?.id ?? ''}|${phaseEnCours ?? ''}`
  const vuePrecedente = useRef(vue)
  useEffect(() => {
    if (vuePrecedente.current === vue) return
    vuePrecedente.current = vue
    const actif = document.activeElement
    if (actif && actif !== document.body) return
    const titre = scene.current?.querySelector<HTMLElement>('h1, h2, h3')
    if (!titre) return
    titre.tabIndex = -1
    titre.focus({ preventScroll: true })
  }, [vue])

  if (needLogin) {
    return (
      <main className="porte-ecran">
        <LoginForm title="Écran commun" error={error} busy={busy} onSubmit={submitLogin} />
        <CodeDeLaTele onBranchee={branchee} />
      </main>
    )
  }
  if (!me) {
    return (
      <main className="center-page">
        <p className="serif-note">Connexion…</p>
      </main>
    )
  }

  const snap = s.snapshot
  if (!snap) {
    return (
      <main className="center-page">
        <p className="serif-note">Connexion…</p>
      </main>
    )
  }

  // Sur le PC on ouvre souvent l'écran en "localhost" : le QR doit quand même
  // montrer l'adresse que les téléphones peuvent ouvrir. Elle se termine par
  // le nom de l'espace : c'est lui qui dit quelle soirée on rejoint.
  const slug = snap.space.slug
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const joinUrl = isLocalhost && snap.joinUrl ? snap.joinUrl : `${window.location.origin}/${slug}`
  const connectedCount = snap.players.filter(p => p.connected).length
  const offlineCount = snap.players.length - connectedCount
  const session = snap.session
  const activeView = session ? s.views[session.id] : undefined
  const quizView = activeView?.view as QuizHostView | undefined
  const teams = snap.teams

  // Dès qu'une question est à l'écran, tout le reste s'efface : sur un
  // vidéoprojecteur, ce qui compte doit occuper toute la place.
  // La télécommande garde la salle d'attente sous la main — les invités, les
  // équipes — pendant que la télé projette la scène.
  const staging = !telecommande && ((!!quizView && quizView.phase !== 'pickPack') || screen !== null)
  /**
   * Une télécommande est branchée ailleurs : cet écran est celui de la
   * salle, et les coulisses — la grille des prix, la liste des quiz, la
   * consigne écrite pour l'animateur — restent dans sa main.
   */
  const coulissesAilleurs =
    !telecommande && coulissesIci !== numeroDeScene && (!!snap.telecommande || telecommandeVue === numeroDeScene)
  const answering = quizView?.phase === 'question'

  /** Ce que la bande d'état annonce au centre : où en est la soirée. */
  const stageLabel =
    screen === 'cloture'
      ? 'Soirée close'
      : screen === 'podium'
      ? 'Podium'
      : screen === 'awards'
        ? 'Remise des prix'
        : screen === 'victory'
          ? 'Victoire'
          : !quizView
            ? "Salle d'attente"
            : quizView.phase === 'pickPack'
              ? 'Nouveau quiz'
              : quizView.phase === 'finished'
                ? 'Podium du quiz'
                : `Question ${quizView.qIndex + 1} / ${quizView.qCount}`

  // L'ordre commun (shared/classement.ts), celui du souvenir : à égalité, le
  // prénom affiché. Chaque ligne emporte son rang partagé — la liste sous le
  // podium commence au quatrième, et ne saurait pas sinon qu'il est troisième
  // ex æquo.
  const ranking = classer(
    snap.players.filter(p => p.score !== 0),
    p => p.score,
    p => p.nomAffiche ?? p.name,
    p => p.id,
  )
    // Les distinctions suivent le joueur jusque sur l'écran commun : c'est là
    // qu'un niveau se montre à toute la salle.
    .map(({ item: p, rang }) => ({
      name: p.nomAffiche ?? p.name,
      avatar: p.avatar,
      points: p.score,
      rank: rang,
      ...distinctions(p),
    }))

  const teamStandings = rankTeams(teams)
  const teamPodium = teamStandings.map(t => ({ name: t.name, avatar: t.emoji, points: t.average, rank: t.rank }))
  // L'onglet du podium est dans la scène : la télé montre ce qu'on choisit
  // à la télécommande. Sans choix, les équipes d'abord, s'il y en a.
  const podiumTab = snap.scene?.onglet === 'joueurs' || teams.length === 0 ? 'solo' : 'teams'
  const showTeamPodium = podiumTab === 'teams' && teams.length > 0
  // Le vainqueur se joue sur le barème plus les prix : les prix peuvent
  // renverser l'ordre du quiz, c'est tout leur intérêt. Et à égalité, elles
  // gagnent ensemble : la liste départage par nom, pas l'écran de victoire.
  const champions = vainqueursDuQuiz(teams)
  const bonuses = snap.bonuses
  const givenTitles = new Set(bonuses.map(b => b.reason))
  const teamById = (id: string) => teams.find(t => t.id === id)

  /**
   * Ouvre un écran de fin — ou revient à la salle d'attente — sur tous les
   * écrans d'animateur de l'espace. Le geste dit l'écran qu'il quittait : si
   * l'autre console a changé la scène entre-temps, le serveur l'ignore.
   */
  const poserScene = (suivant: EcranDeScene | null, onglet?: 'equipes' | 'joueurs') => {
    initAudio()
    socket.emit('host:scene', { ecran: suivant, ...(onglet && { onglet }), depuis: ecran })
  }
  const openScreen = (next: 'podium' | 'awards' | 'victory') =>
    poserScene(next === 'awards' ? 'prix' : next === 'victory' ? 'victoire' : 'podium')
  const setPodiumTab = (onglet: 'teams' | 'solo') => poserScene('podium', onglet === 'teams' ? 'equipes' : 'joueurs')

  /**
   * Brancher la télé depuis ce téléphone : elle affiche un code sur sa page
   * de connexion, on le tape ici, et elle s'ouvre sur cet espace — sans
   * taper d'adresse ni de mot de passe à la télécommande de la télé.
   */
  const brancherTele = async () => {
    const code = await promptDialog({
      title: 'Brancher la télé',
      message: 'Ouvre /host sur la télé : elle affiche un code. Tape-le ici — la télé pourra alors piloter ta soirée.',
      input: { value: '', placeholder: 'ABC 234', maxLength: 12 },
      confirmLabel: 'Brancher',
    })
    if (!code) return
    try {
      await api.auth.validerAppairage(code)
      showToast({ kind: 'info', message: 'La télé est branchée — elle s’ouvre dans un instant' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    }
  }

  /** Premier geste de l'animateur : c'est aussi le moment où le navigateur autorise enfin le son. */
  const lancerQuiz = () => {
    initAudio()
    socket.emit('host:launch')
  }

  const createTeam = (e: FormEvent) => {
    e.preventDefault()
    if (!newTeam.trim()) return
    socket.emit('host:createTeam', { name: newTeam, emoji: newEmoji })
    setNewTeam('')
    // L'emoji suivant, pour ne pas créer six équipes avec la même vignette.
    setNewEmoji(TEAM_EMOJIS[(TEAM_EMOJIS.indexOf(newEmoji) + 1) % TEAM_EMOJIS.length])
  }

  const backButton = (
    <button className="btn btn-ghost" onClick={() => poserScene(null)}>
      Revenir
    </button>
  )

  // Les onglets du podium : dans son en-tête à la télé, sous la main à la
  // télécommande.
  const ongletsPodium = teams.length > 0 && (
    <div className="row podium-tabs">
      <button
        className={'pill-btn' + (podiumTab === 'teams' ? ' active' : '')}
        aria-pressed={podiumTab === 'teams'}
        onClick={() => setPodiumTab('teams')}
      >
        <Icon name="users" />
        Les équipes
      </button>
      <button
        className={'pill-btn' + (podiumTab === 'solo' ? ' active' : '')}
        aria-pressed={podiumTab === 'solo'}
        onClick={() => setPodiumTab('solo')}
      >
        <Icon name="trophy" />
        Les joueurs
      </button>
    </div>
  )

  /** Ce que la télécommande dit de la scène projetée, au lieu de la projeter. */
  const apercu = (contenu?: ReactNode) => (
    <div className="telecommande-apercu" role="status">
      <span className="label">À l’écran</span>
      <strong className="telecommande-scene">{stageLabel}</strong>
      {contenu}
    </div>
  )

  /**
   * « Clore la soirée » : le seul geste de fin. Il remplace « Sauvegarder »
   * — la soirée s'enregistre toute seule après chaque quiz — et « Nouvelle
   * soirée », qui effaçait tout et perdait les prix quand on n'avait pas
   * sauvegardé d'abord. Une soirée d'essai, elle, s'efface sans rien garder.
   */
  const clore = async () => {
    // Le titre sous lequel la soirée est déjà rangée, s'il y en a un.
    const rangee = await fetch(dataUrl(slug, 'soirees.json'))
      .then(r => (r.ok ? (r.json() as Promise<ArchiveList>) : null))
      .then(l => l?.current?.title)
      .catch(() => undefined)
    const choix = await choixDialog({
      title: 'Clore la soirée',
      message:
        'Elle rejoint l’historique sous ce nom. Chaque invité reçoit sa fin de soirée sur son téléphone — son rang, ses hauts faits, ses niveaux —, puis la suivante part de zéro.',
      input: { value: titreDeCloture(rangee, snap.space, formatDay(Date.now())), maxLength: 80 },
      confirmLabel: 'Clore la soirée',
      alternative: { label: 'C’était un essai', danger: true },
    })
    if (!choix) return
    if (choix.geste === 'confirmer') {
      socket.emit('host:closeParty', { title: choix.valeur })
      return
    }
    const ok = await confirmDialog({
      title: 'Effacer cet essai ?',
      message: `Rien n’est gardé : ni la soirée dans l’historique, ni l’expérience, les prix et les hauts faits de ses ${snap.players.length} invités. Les téléphones repassent par l’entrée.`,
      confirmLabel: 'Tout effacer',
      danger: true,
    })
    if (ok) socket.emit('host:discardParty')
  }
  const cloreButton = snap.players.length > 0 && (
    <button className="btn" onClick={() => void clore()}>
      <Icon name="flag" />
      Clore la soirée
    </button>
  )

  return (
    <ConsoleSlot.Provider value={consoleSlot}>
      <div className={'host' + (staging ? ' staging' : '') + (telecommande ? ' telecommande' : '')}>
        {/* La bande d'état : le titre, où on en est, comment rejoindre. */}
        <header className="host-band">
          <div className="band-left">
            <span className="brand">{espacesFines(snap.space.title)}</span>
            {quizView?.packTitle && (
              <>
                <span className="band-sep" aria-hidden="true" />
                <span className="band-sub">{quizView.packTitle}</span>
              </>
            )}
            {!s.connected && (
              <span className="pill offline-pill">
                <Icon name="alert" /> reconnexion…
              </span>
            )}
            {/* La base en ligne refuse les écritures depuis un moment : la
                soirée continue ici, mais l'animateur doit le savoir avant de
                laisser l'hébergeur s'endormir. Discret — la salle le voit aussi. */}
            {snap.sauvegardeEnRetard && (
              <span className="pill sauvegarde-pill" role="status">
                Sauvegarde en retard — la soirée continue
              </span>
            )}
          </div>
          <div className="band-center">
            <span>{stageLabel}</span>
            {quizView && quizView.phase !== 'pickPack' && quizView.phase !== 'finished' && (quizView.multiplier ?? 1) > 1 && (
              <span className="pill multi">×{quizView.multiplier} points</span>
            )}
          </div>
          <div className="band-right">
            <span className="band-answered">
              {answering ? (
                <>
                  <b>{quizView?.answeredCount ?? 0}</b> / {quizView?.participantCount ?? 0} ont répondu
                </>
              ) : (
                <>{connectedCount} connecté·e·s</>
              )}
            </span>
            <div className="qr-stack">
              <div className="qr-box">
                <QRCodeSVG value={joinUrl} size={46} bgColor="#ffffff" fgColor={QR_INK} title="QR code pour rejoindre la soirée" />
              </div>
              <div className="qr-text">
                <span className="label">Rejoindre</span>
                <span className="join-url">{joinUrl}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Les montées de niveau du dernier podium, proclamées à la salle. */}
        {s.progres && <AnnoncesDeNiveau progres={s.progres} onFin={finirAnnonces} />}

        {/* Le repère principal : la scène et ses colonnes, entre le bandeau
            (banner) et la console (contentinfo). */}
        <main className={'host-grid' + (staging ? ' staging' : '')}>
          {!staging && (
            <section className="card">
              <h2>Invités ({snap.players.length})</h2>

              {/* Groupés par équipe : c'est la vue dont on a besoin pour repérer
                  d'un coup d'œil qui s'est trompé d'équipe, et l'y remettre. */}
              <div className="team-groups">
                {teams.map(t => (
                  <TeamGroup
                    key={t.id}
                    team={t}
                    members={snap.players.filter(p => p.teamId === t.id)}
                    teams={teams}
                  />
                ))}
                {(() => {
                  const orphans = snap.players.filter(p => !p.teamId)
                  return orphans.length > 0 || teams.length === 0 ? (
                    <TeamGroup team={null} members={orphans} teams={teams} />
                  ) : null
                })()}
              </div>

              <form className="row team-create" onSubmit={createTeam}>
                <select
                  className="team-emoji-select"
                  value={newEmoji}
                  aria-label="Emoji de la nouvelle équipe"
                  onChange={e => setNewEmoji(e.target.value)}
                >
                  {TEAM_EMOJIS.map(e => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
                <input
                  className="input team-name-input"
                  placeholder="Nouvelle équipe"
                  aria-label="Nom de la nouvelle équipe"
                  value={newTeam}
                  maxLength={20}
                  onChange={e => setNewTeam(e.target.value)}
                />
                <button className="btn btn-small" disabled={!newTeam.trim()}>
                  Ajouter
                </button>
              </form>
              {teams.length === 0 &&
                (() => {
                  // Six équipes pour sept invités, c'était une soirée en solo
                  // déguisée : on propose une équipe pour quatre, de deux à
                  // six — et six, comme avant, tant que personne n'est là.
                  const invites = snap.players.length
                  const nombre = nbEquipes ?? (invites === 0 ? 6 : Math.min(6, Math.max(2, Math.round(invites / 4))))
                  return (
                    <div className="row team-seed">
                      <select
                        value={nombre}
                        aria-label="Nombre d'équipes à créer"
                        onChange={e => setNbEquipes(Number(e.target.value))}
                      >
                        {[2, 3, 4, 5, 6].map(n => (
                          <option key={n} value={n}>
                            {n} équipes
                          </option>
                        ))}
                      </select>
                      <button className="btn btn-small" onClick={() => socket.emit('host:seedTeams', { count: nombre })}>
                        <Icon name="sparkles" />
                        Les créer d'un coup
                      </button>
                    </div>
                  )
                })()}
            </section>
          )}

          <section className="card main-stage" ref={scene}>
            {screen === 'cloture' && s.cloture ? (
              <>
                {telecommande ? (
                  apercu()
                ) : (
                  <ClotureEcran cloture={s.cloture} souvenirUrl={`${joinUrl}/soirees/${s.cloture.soiree.id}`} />
                )}
                {/* La clôture ouvre le lendemain : le bilan, les fiches à
                    imprimer, l'historique, et le lien à envoyer — celui de
                    l'archive, que la soirée suivante ne changera pas. On le
                    trouvait le lendemain, par l'historique, en devinant lequel
                    des deux « Souvenir » copier. */}
                <ConsoleActions>
                  <a
                    className="btn"
                    href={spacePath(slug, 'souvenir', s.cloture.soiree.id)}
                    target={ONGLETS.soiree}
                  >
                    <Icon name="book" />
                    Le souvenir
                  </a>
                  <BoutonCopier texte={`${joinUrl}/soirees/${s.cloture.soiree.id}`} />
                  <a className="btn" href={spacePath(slug, 'bilan', s.cloture.soiree.id)} target={ONGLETS.soiree}>
                    <Icon name="list" />
                    Le bilan
                  </a>
                  <a
                    className="btn"
                    href={spacePath(slug, 'bilan/fiches', s.cloture.soiree.id)}
                    target={ONGLETS.soiree}
                  >
                    <Icon name="download" />
                    Les fiches
                  </a>
                  <a className="btn" href={spacePath(slug, 'soirees')} target={ONGLETS.soiree}>
                    <Icon name="clock" />
                    L’historique
                  </a>
                  <button
                    className="btn btn-primary"
                    onClick={() => poserScene(null)}
                  >
                    <Icon name="play" />
                    La soirée suivante
                  </button>
                </ConsoleActions>
              </>
            ) : screen === 'podium' ? (
              <div className="quiz-host stage-scroll">
                {/* Le titre, les onglets et le QR du souvenir sur une ligne,
                    le podium à gauche et les listes à droite : empilés, ils
                    faisaient deux écrans en 1366 × 768, et le QR — le seul
                    moyen pour un invité d'emporter la page, il ne peut pas
                    cliquer sur un lien projeté au mur — tombait sous la
                    console. */}
                {telecommande ? (
                  apercu(ongletsPodium)
                ) : (
                <>
                <div className="scene-tete">
                  <h2>
                    <Icon name={showTeamPodium ? 'users' : 'trophy'} />
                    {showTeamPodium ? 'Les équipes au quiz' : 'Le classement de la soirée'}
                  </h2>
                  {ongletsPodium}
                  <div className="qr-stack scene-qr">
                    <div className="qr-box">
                      <QRCodeSVG value={`${joinUrl}/souvenir`} size={84} bgColor="#ffffff" fgColor={QR_INK} title="QR code du souvenir de la soirée" />
                    </div>
                    <div className="qr-text">
                      <span className="label">Le souvenir de la soirée</span>
                      <span className="join-url">{joinUrl}/souvenir</span>
                    </div>
                  </div>
                </div>

                {showTeamPodium ? (
                  <div className="scene-podium">
                    {/* Le podium se fait à la moyenne, avant les prix ; le
                        tableau, aux points d'équipe, prix compris. Sans le
                        dire, l'un démentait l'autre dès le premier prix. */}
                    <div className="podium-legende">
                      <FinalPodium rows={teamPodium} />
                      <p className="muted small center">Le podium à la moyenne, avant les prix</p>
                    </div>
                    <div className="scene-listes">
                      <Coupe>
                        <TeamBoard teams={teams} />
                      </Coupe>
                      <p className="muted small">{regleDesEquipes(teams.length)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="scene-podium">
                    <FinalPodium rows={ranking} />
                    {(ranking.length > 3 || recap) && (
                      <div className="scene-listes">
                        {ranking.length > 3 && (
                          <Coupe>
                            <Standings rows={ranking.slice(3)} offset={3} />
                          </Coupe>
                        )}
                        {/* Les distinctions sous la suite du classement, cartes
                            coupées entières : trois cartes prenaient toute la
                            colonne, et la liste tombait à une ligne. */}
                        {recap && (
                          <Coupe className="coupe-trophees" lignes=".trophy" autres={n => `et ${n} autre${n > 1 ? 's' : ''} distinction${n > 1 ? 's' : ''}`}>
                            <Trophies recap={recap} />
                          </Coupe>
                        )}
                      </div>
                    )}
                  </div>
                )}
                </>
                )}

                <ConsoleActions>
                  <a className="btn btn-accent" href={spacePath(slug, 'souvenir')} target={ONGLETS.soiree}>
                    <Icon name="book" />
                    Page souvenir
                  </a>
                  <a className="btn" href={spacePath(slug, 'bilan')} target={ONGLETS.soiree}>
                    <Icon name="list" />
                    Le bilan
                  </a>
                  <button className="btn" onClick={() => openScreen('awards')}>
                    <Icon name="award" />
                    Remise des prix
                  </button>
                  {backButton}
                </ConsoleActions>
              </div>
            ) : screen === 'awards' && coulissesAilleurs ? (
              <>
                <RemiseEnScene bonuses={bonuses} teams={teams} />
                <ConsoleActions>
                  <span className="muted small console-note">La grille est à la télécommande</span>
                  <button className="btn btn-primary" onClick={() => openScreen('victory')}>
                    <Icon name="crown" />
                    Écran de victoire
                  </button>
                  <button className="btn" onClick={reprendreCoulisses}>
                    <Icon name="award" />
                    Remettre les prix d’ici
                  </button>
                  {backButton}
                </ConsoleActions>
              </>
            ) : screen === 'awards' ? (
              <div className="quiz-host stage-scroll">
                {telecommande && apercu()}
                <h2>
                  <Icon name="award" />
                  Remise des prix
                </h2>
                {/* « Rien n'est attribué tant que tu ne cliques pas » : vrai des
                    points, faux du palmarès, qui se relit au souvenir et se
                    range sur l'étagère des profils remis ou non. Une
                    animatrice qui avait épargné un prix à voix haute le
                    retrouvait le lendemain. */}
                <p className="muted center">
                  Chaque prix attribué ajoute ses points d'équipe à l'équipe du lauréat — 0 pour
                  l'honneur — et peut changer la gagnante. Le palmarès reste au souvenir, remis ou
                  non, sans jamais rapporter d'expérience.
                </p>

                <AwardsBoard
                  awards={recap?.stats.awards ?? []}
                  teams={teams}
                  givenTitles={givenTitles}
                  onAward={(teamId, points, reason) => {
                    // La télé sonne le prix remis (RemiseEnScene) : la
                    // télécommande, dans la main, ne la double pas.
                    if (!telecommande) sound.reveal()
                    socket.emit('host:awardTeam', { teamId, points, reason })
                  }}
                />

                {/* Tout ce qui ne se calcule pas : le karaoké, le déguisement,
                    la table qui a rangé. */}
                <div className="card free-award">
                  <h3>
                    <Icon name="star" />
                    Prix libre
                  </h3>
                  <div className="row">
                    <select
                      className="team-emoji-select free-team"
                      value={freeTeam}
                      aria-label="Équipe qui reçoit le prix"
                      onChange={e => setFreeTeam(e.target.value)}
                    >
                      <option value="">Choisir une équipe…</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.emoji} {t.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      placeholder="Motif (ex. « ont chanté le plus fort »)"
                      aria-label="Motif du prix"
                      maxLength={60}
                      value={freeReason}
                      onChange={e => setFreeReason(e.target.value)}
                    />
                    <label className="award-points-champ">
                      <ChampNombre
                        className="input award-points"
                        min={-10}
                        max={10}
                        aria-label="Points d’équipe du prix"
                        valeur={freePoints}
                        onValeur={setFreePoints}
                      />
                      <span className="award-points-unite" aria-hidden="true">pts d’équipe</span>
                    </label>
                    <button
                      className="btn btn-primary btn-small"
                      disabled={!freeTeam || !freeReason.trim()}
                      onClick={() => {
                        if (!telecommande) sound.reveal()
                        socket.emit('host:awardTeam', {
                          teamId: freeTeam,
                          // Arrondi comme l'effet annoncé en dessous.
                          points: Math.round(freePoints),
                          reason: freeReason,
                        })
                        setFreeReason('')
                      }}
                    >
                      Attribuer
                    </button>
                  </div>
                  {freeTeam && Number.isFinite(freePoints) && (
                    <p className="award-effet" aria-live="polite">
                      {effetDUnPrix(teams, freeTeam, freePoints)}
                    </p>
                  )}
                </div>

                {bonuses.length > 0 && (
                  <div className="card">
                    <h3>Prix déjà remis</h3>
                    <div className="given-list">
                      {bonuses.map(b => {
                        const team = teamById(b.teamId)
                        return (
                          <div key={b.id} className="given-row">
                            <span className="given-points">
                              {b.points > 0 ? '+' : ''}
                              {b.points}
                            </span>
                            <span className="given-team">
                              {team ? `${team.emoji} ${team.name}` : '—'}
                            </span>
                            <span className="given-reason">{b.reason}</span>
                            <button
                              className="chip-remove"
                              title="Retirer ce prix"
                              aria-label={`Retirer le prix « ${b.reason} »`}
                              onClick={() => socket.emit('host:removeBonus', { bonusId: b.id })}
                            >
                              <Icon name="x" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Le tableau complet se lit sur un téléphone, pas au
                    vidéoprojecteur : le souvenir s'ouvre à côté, droit sur
                    ses chiffres. */}
                <div className="stage-foot scene-projetee">
                  <div className="qr-stack">
                    <div className="qr-box">
                      <QRCodeSVG value={`${joinUrl}/stats`} size={84} bgColor="#ffffff" fgColor={QR_INK} title="QR code des chiffres de la soirée" />
                    </div>
                    <div className="qr-text">
                      <span className="label">Les chiffres</span>
                      <span className="join-url">{joinUrl}/stats</span>
                    </div>
                  </div>
                </div>

                <ConsoleActions>
                  <button className="btn btn-primary" onClick={() => openScreen('victory')}>
                    <Icon name="crown" />
                    Écran de victoire
                  </button>
                  <a className="btn" href={spacePath(slug, 'stats')} target={ONGLETS.soiree}>
                    <Icon name="bar-chart" />
                    Les chiffres
                  </a>
                  {backButton}
                </ConsoleActions>
              </div>
            ) : screen === 'victory' ? (
              <div className="quiz-host victory stage-scroll">
                {telecommande ? (
                  apercu()
                ) : (
                <>
                <h2>
                  <Icon name="crown" />
                  {champions.length > 1 ? 'Les équipes qui remportent le quiz' : "L'équipe qui remporte le quiz"}
                </h2>
                {teams.length > 0 ? (
                  <>
                    {/* Couronner la première de la liste, c'était couronner
                        l'alphabet : un prix à +1 remis aux Aigles, deuxièmes,
                        les faisait passer devant les Zèbres, qui avaient gagné
                        le quiz. À égalité, elles gagnent ensemble. */}
                    {champions.length === 0 ? (
                      <p className="muted center">Aucun quiz joué, aucun prix remis : rien à couronner pour l'instant.</p>
                    ) : (
                      <div className="victory-winner">
                        <span className="victory-emoji">{champions.map(t => t.emoji).join(' ')}</span>
                        <span className="victory-name">{enumerer(champions.map(t => t.name))}</span>
                        {champions.length > 1 ? (
                          <span className="victory-points">
                            Ex æquo · {champions[0].finalPoints} {motPoints(champions[0].finalPoints)} d'équipe chacune
                          </span>
                        ) : (
                          <>
                            <span className="victory-points">
                              {champions[0].finalPoints} {motPoints(champions[0].finalPoints)} d'équipe
                            </span>
                            <span className="muted">{detailDesPoints(champions[0])}</span>
                          </>
                        )}
                      </div>
                    )}
                    <div className="victory-boards">
                      <div className="tableau">
                        <h3>
                          <Icon name="users" />
                          Les équipes
                        </h3>
                        {/* Le même tableau qu'au téléphone et au souvenir. Sa
                            légende disait « le gros chiffre est le total du
                            quiz », faux dès le deuxième quiz ; la règle entière
                            passait sous la console en 1366 × 768 : chaque
                            ligne dit d'où viennent ses points, et la règle se
                            lit au podium et au panneau des équipes. */}
                        <Coupe>
                          <TeamBoard teams={teams} />
                        </Coupe>
                      </div>

                      {/* Le classement individuel a sa place ici : c'est pour lui
                          que chacun a joué, et il explique le total des équipes. */}
                      <div className="tableau">
                        <h3>
                          <Icon name="trophy" />
                          Les joueurs
                        </h3>
                        {/* Coupé à ce qui tient : à douze, la liste passait
                            sous la console en 1366 × 768 dès le sixième. */}
                        <Coupe enPlus={Math.max(0, ranking.length - 30)}>
                        <div className="leaderboard">
                          {ranking.slice(0, 30).map((p, i) => (
                            <div key={i} className="lb-row">
                              <Rank n={p.rank} />
                              <Avatar className="lb-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
                              <span className="lb-name">{p.name}</span>
                              <Niveau niveau={p.niveau} />
                              <Score n={p.points} />
                            </div>
                          ))}
                        </div>
                        </Coupe>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="muted">Aucune équipe — rien à couronner.</p>
                )}
                </>
                )}
                <ConsoleActions>
                  <button className="btn btn-primary" disabled={connectedCount === 0} onClick={lancerQuiz}>
                    <Icon name="play" />
                    Quiz suivant
                  </button>
                  <button className="btn" onClick={() => openScreen('awards')}>
                    <Icon name="award" />
                    Revenir aux prix
                  </button>
                  {cloreButton}
                  {backButton}
                </ConsoleActions>
              </div>
            ) : activeView && quizView ? (
              <QuizHost
                view={quizView}
                teams={teams}
                telecommande={telecommande}
                coulissesAilleurs={coulissesAilleurs}
                reprendreCoulisses={reprendreCoulisses}
                apresQuiz={{
                  suivant: lancerQuiz,
                  // Comme « Lancer un quiz » : sans invité connecté, il n'y a
                  // personne à qui le poser.
                  personne: connectedCount === 0,
                  // Le podium du quiz se referme, et la remise des prix
                  // s'ouvre sur tous les écrans : deux gestes, dans l'ordre,
                  // par la même connexion.
                  prix:
                    teams.length > 0
                      ? () => {
                          socket.emit('host:endSession', { sessionId: activeView.sessionId })
                          poserScene('prix')
                        }
                      : undefined,
                }}
                sendCommand={command => socket.emit('host:command', { sessionId: activeView.sessionId, command })}
                endSession={() => socket.emit('host:endSession', { sessionId: activeView.sessionId })}
              />
            ) : (
              <>
                {/* L'invitation : avant le premier quiz, la seule chose que la
                    salle doit voir de loin, c'est comment entrer. */}
                {telecommande ? (
                  // Le QR se scanne à la télé ; la télécommande garde
                  // l'adresse à dicter, et de quoi jouer depuis ce téléphone.
                  <div className="telecommande-invite">
                    {apercu(<span className="join-url">{joinUrl}</span>)}
                    <a className="btn btn-accent jouer-ici" href={spacePath(slug)} target={ONGLETS.jouer}>
                      <Icon name="play" />
                      Jouer depuis cet appareil
                    </a>
                  </div>
                ) : (
                <div className="invite">
                  <span className="label">Pour rejoindre le quiz</span>
                  <p className="invite-url">{adresseCoupable(joinUrl)}</p>
                  <div className="invite-qrs">
                    {snap.wifi && (
                      <div className="invite-qr">
                        <div className="qr-box">
                          <QRCodeSVG value={wifiQrValue(snap.wifi)} size={148} bgColor="#ffffff" fgColor={QR_INK} title="QR code du wifi" />
                        </div>
                        <span className="label">1 · Wifi {espacesFines(`« ${snap.wifi.ssid} »`)}</span>
                      </div>
                    )}
                    <div className="invite-qr">
                      <div className="qr-box">
                        <QRCodeSVG value={joinUrl} size={148} bgColor="#ffffff" fgColor={QR_INK} title="QR code pour rejoindre la soirée" />
                      </div>
                      <span className="label">{snap.wifi ? '2 · Le quiz' : 'Scanner pour jouer'}</span>
                    </div>
                  </div>
                  {/* Un écran ne scanne pas son propre QR : l'animateur qui
                      pilote depuis son téléphone et veut jouer aussi ouvre la
                      soirée dans un autre onglet, où le cookie de son profil
                      et celui de la console cohabitent. Au mur, où rien ne se
                      touche, le lien reste caché (styles.css). */}
                  <a className="btn btn-accent jouer-ici" href={spacePath(slug)} target={ONGLETS.jouer}>
                    <Icon name="play" />
                    Jouer depuis cet appareil
                  </a>
                  <p className="muted invite-note">
                    Le temps de lire la question est offert, puis la rapidité rapporte des points bonus.
                    Les scores s'ajoutent au classement de la soirée.
                  </p>
                  {offlineCount > 0 && (
                    <p className="muted small invite-note">
                      {offlineCount} inscrit{offlineCount > 1 ? 's' : ''} hors ligne : un téléphone dont
                      l'écran s'est éteint n'entrera dans le quiz qu'à son retour.
                    </p>
                  )}
                </div>
                )}
                {/* N'importe quel animateur du serveur peut valider le code
                    qu'une télé affiche : branchée ainsi, elle dit par qui, et
                    se débranche si ce n'est pas le bon. */}
                {me.branchee && !telecommande && (
                  <p className="muted small branchee-par">
                    Branchée par {me.name} — ce n’est pas le tien ?{' '}
                    <button className="btn btn-ghost btn-small" onClick={() => void debrancher()}>
                      <Icon name="x" />
                      Débrancher
                    </button>
                  </p>
                )}
                <ConsoleActions>
                  {bibliothequeVide ? (
                    <a className="btn btn-primary" href="/edit" target={ONGLETS.quiz}>
                      <Icon name="plus" />
                      Créer mon premier quiz
                    </a>
                  ) : (
                    <button
                      className="btn btn-primary"
                      disabled={connectedCount === 0}
                      onClick={lancerQuiz}
                    >
                      <Icon name="play" />
                      {connectedCount === 0 ? 'En attente des invités…' : 'Lancer un quiz'}
                    </button>
                  )}
                  {/* Dans un autre onglet : l'écran commun reste projeté. La
                      session est dans le cookie, rien à passer dans l'adresse. */}
                  <a className="btn" href="/edit" target={ONGLETS.quiz}>
                    <Icon name="edit" />
                    Mes quiz
                  </a>
                  {/* À la télécommande seulement : c'est d'ici qu'on allume la télé. */}
                  {telecommande && (
                    <button className="btn" onClick={() => void brancherTele()}>
                      <Icon name="monitor" />
                      Brancher la télé
                    </button>
                  )}
                  <a className="btn btn-ghost" href="/compte" target={ONGLETS.compte}>
                    <Icon name="users" />
                    Mon compte
                  </a>
                  {/* Les écrans de fin, une fois qu'ils ont quelque chose à
                      montrer : avant, neuf boutons d'égale importance
                      cachaient « Lancer un quiz ». « Prix » vient avec les
                      équipes : un prix libre — le déguisement — se remet
                      avant le premier quiz, et le podium d'un quiz où
                      personne n'a marqué ne le cache plus. */}
                  {ranking.length > 0 && (
                    <button className="btn" onClick={() => openScreen('podium')}>
                      <Icon name="trophy" />
                      Podium
                    </button>
                  )}
                  {teams.length > 0 && (
                    <button className="btn" onClick={() => openScreen('awards')}>
                      <Icon name="award" />
                      Prix
                    </button>
                  )}
                  {teams.length > 0 && (ranking.length > 0 || bonuses.length > 0) && (
                    <button className="btn" onClick={() => openScreen('victory')}>
                      <Icon name="crown" />
                      Victoire
                    </button>
                  )}
                  {ranking.length > 0 && (
                    <a className="btn" href={spacePath(slug, 'stats')} target={ONGLETS.soiree}>
                      <Icon name="bar-chart" />
                      Les chiffres
                    </a>
                  )}
                  <a className="btn btn-ghost" href={spacePath(slug, 'soirees')} target={ONGLETS.soiree}>
                    <Icon name="book" />
                    Historique
                  </a>
                  {cloreButton}
                </ConsoleActions>
              </>
            )}
          </section>

          {!staging && (
            <div className="host-col">
              {teams.length > 0 && (
                <section className="card">
                  <h2>Les équipes</h2>
                  <TeamBoard teams={teams} />
                  <p className="muted small">{regleDesEquipes(teams.length)}</p>
                </section>
              )}

              <section className="card">
                <h2>Classement de la soirée</h2>
                <Leaderboard players={snap.players} />
              </section>
            </div>
          )}
        </main>

        {/* La console animateur : discrète, en bas, toujours au même endroit.
            Chaque écran y pose ses boutons ; le son, l'habillage et le plein
            écran restent à droite quoi qu'il arrive. */}
        <footer className="host-console">
          <span className="console-label">{telecommande ? 'Télécommande' : 'Console animateur'}</span>
          <div className="console-actions" ref={setConsoleSlot} />
          <div className="console-icons">
            {/* Qui manque, et les gestes d'un téléphone perdu : ici, parce que
                pendant un quiz le panneau des invités disparaît. */}
            <Absents
              players={snap.players}
              quiz={quizView}
              sendCommand={
                activeView ? command => socket.emit('host:command', { sessionId: activeView.sessionId, command }) : undefined
              }
            />
            {/* Un téléphone tenu droit est une télécommande, sauf s'il est
                recopié sur la télé : c'est l'animateur qui tranche. */}
            <button
              className="btn btn-icon"
              // Une bascule garde son nom et son infobulle : c'est
              // `aria-pressed` qui dit son état, sinon on entend l'inverse de
              // ce qui est.
              title="Télécommande : les gestes en grand, la scène à la télé"
              aria-label="Télécommande"
              aria-pressed={telecommande}
              onClick={basculerTelecommande}
            >
              <Icon name={telecommande ? 'monitor' : 'smartphone'} />
            </button>
            {/* Un bouton bascule garde un nom fixe et dit son état par
                `aria-pressed` : avec un libellé qui changeait aussi, un lecteur
                d'écran lisait « Couper les sons, activé », son allumé. Son
                infobulle aussi est fixe : elle devient sa description, et
                « Fond clair — Fond sombre (Velours), activé » se contredisait. */}
            <button
              className="btn btn-icon"
              title="Sons"
              aria-label="Sons"
              aria-pressed={!muted}
              onClick={() => {
                initAudio()
                setMuted(toggleMuted())
              }}
            >
              <Icon name={muted ? 'volume-off' : 'volume'} />
            </button>
            {/* Un vidéoprojecteur délave les noirs : l'écran commun peut passer
                sur fond clair, sans toucher aux téléphones des invités. */}
            <button
              className="btn btn-icon"
              title="Fond clair pour le vidéoprojecteur (Ivoire)"
              aria-label="Fond clair"
              aria-pressed={theme === 'ivoire'}
              onClick={() => setTheme(toggleTheme())}
            >
              <Icon name={theme === 'ivoire' ? 'sun' : 'moon'} />
            </button>
            {PLEIN_ECRAN && (
              <button
                className="btn btn-icon"
                title="Plein écran"
                aria-label="Plein écran"
                onClick={() => {
                  if (document.fullscreenElement) document.exitFullscreen()
                  else document.documentElement.requestFullscreen().catch(() => {})
                }}
              >
                <Icon name="maximize" />
              </button>
            )}
          </div>
        </footer>

        {s.toast && <div className={`toast toast-${s.toast.kind}`}>{espacesFines(s.toast.message)}</div>}
      </div>
    </ConsoleSlot.Provider>
  )
}
