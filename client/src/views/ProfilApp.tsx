import { useEffect, useRef, useState, type FormEvent, type ReactNode, type SyntheticEvent } from 'react'
import { Glossaire } from '../components/Glossaire'
import { api, currentMe, motifDe } from '../api'
import { Avatar } from '../components/Avatar'
import { Niveau } from '../components/Niveau'
import { Laurier } from '../components/Laurier'
import { Icon, type IconName } from '../components/Icon'
import { Onglets, type Onglet as OngletDef } from '../components/Onglets'
import { ProfilForm } from '../components/ProfilForm'
import { CodeSecours } from '../components/Secours'
import { tronquer } from '../../../shared/avatars'
import { pageDeRetour } from '../../../shared/securite'
import { cibleEclat } from '../../../shared/legendaires'
import { coupDOeilMoyen, type PublicProfileDetail } from '../../../shared/profil'
import { FormulaireSoiree } from '../components/Rejoindre'
import { Categories, Courbes, FicheCarriere } from '../components/Carriere'
import { annonceDuChoix, type ChoixDuProfil } from '../components/choix'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { espacesFines, formatNumber, place, reponsesParType } from '../format'
import { hautFait } from '../../../shared/hautsfaits'
import { route, spacePath } from '../routes'
import { derniereSoireeGardee } from '../state'
import { Lendemain } from '../components/Lendemain'
import { CarteDuJour, MesJours, pointsDesJours } from '../components/Jour'
import { JAnime, JeJoue } from '../components/AccueilDesRoles'
import type { PublicSpace } from '../../../shared/space'

const ETAPE_REJOINDRE = 'fiestappRejoindre'

/**
 * Les onglets « Apparence » et « Trophées », à la demande : ils portent les
 * dessins de tous les médaillons, et l'accueil anonyme — « Me connecter »,
 * « Rejoindre une soirée » — les téléchargeait avec lui, 21 Ko et 179 ms de
 * plus en 4G. Ils partent dès qu'un profil répond, et tout de suite sur le
 * téléphone qui en a déjà montré un (`profilConnuIci`).
 */
const panneaux = aLaDemande(() => import('../components/PanneauxDuProfil'))

/** Ce téléphone a montré un profil la dernière fois. */
const CLE_PROFIL_CONNU = 'quizz.profil.connu'

function profilConnuIci(): boolean {
  // Sous try/catch : des cookies bloqués donnaient une page noire.
  try {
    return localStorage.getItem(CLE_PROFIL_CONNU) === '1'
  } catch {
    return false
  }
}

function retenirProfil(connu: boolean) {
  try {
    if (connu) localStorage.setItem(CLE_PROFIL_CONNU, '1')
    else localStorage.removeItem(CLE_PROFIL_CONNU)
  } catch {
    // Stockage refusé : les onglets attendront la réponse du profil.
  }
}

// Sans attendre la réponse du profil : sur un téléphone qui en a déjà montré
// un, les onglets arrivent avec elle, pas un aller-retour après.
if (profilConnuIci()) void panneaux.charger().catch(() => {})

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
  const enregistrement = useRef(false)
  /** Ce que le dernier choix a changé, dit au lecteur d'écran. */
  const [annonce, setAnnonce] = useState('')
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
  /** Où aller une fois connecté : le quiz du jour qu'un ami a envoyé (`?next=/jour`). */
  const [suite] = useState(lireSuite)
  const [gardee] = useState(derniereSoireeGardee)
  const [onglet, setOnglet] = useState<Onglet>(lireOnglet)
  /** Le contenu des onglets « Apparence » et « Trophées », dès que le profil est connu. */
  const lesPanneaux = useALaDemande(panneaux, !!profil)
  /** L'onglet choisi s'écrit dans l'adresse — on la partage, on y revient — et sur ce téléphone. */
  const choisirOnglet = (o: Onglet) => {
    setOnglet(o)
    history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}#${o}`)
    try {
      localStorage.setItem(CLE_ONGLET, o)
    } catch {
      // Stockage refusé : l'adresse le garde encore.
    }
  }

  const relire = () =>
    api.joueur.moi().then(r => {
      retenirProfil(!!r.profile)
      if (r.profile) void panneaux.charger().catch(() => {})
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

  const enregistrer = async (patch: ChoixDuProfil) => {
    // Un second toucher pendant l'enregistrement est ignoré ici, plutôt que
    // de désactiver chaque case : désactivée, la case touchée perdait le
    // focus, qui tombait sur la page — et le lecteur d'écran n'entendait rien.
    if (enregistrement.current) return
    enregistrement.current = true
    setBusy(true)
    setErreur('')
    setAnnonce('')
    try {
      // La route d'écriture rend le profil léger ; l'étagère et l'historique
      // n'ont pas bougé, on les garde plutôt que de tout redemander. Le fond
      // de carte n'y est pas : accepté, c'est celui qu'on vient d'envoyer.
      const { profile } = await api.joueur.enregistrer(patch)
      setProfil(p => (p ? { ...p, ...profile, ...(patch.fond !== undefined && { fond: patch.fond }) } : p))
      setAnnonce(annonceDuChoix(patch))
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      enregistrement.current = false
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
        marque={
          <>
            <p className="accueil-marque">FiestApp · le quiz de soirée</p>
            {/* Une console ouverte ici sans profil : c'est l'accueil d'un
                animateur, et ce qu'il y cherche vient d'abord. L'invité, lui,
                n'en a pas — rien ne bouge au-dessus de « Me connecter ». */}
            {console_ && <JAnime espace={console_} rouvrir={false} />}
          </>
        }
        aideErreur={
          // La même phrase pour tout refus : dire « c'est un identifiant
          // d'animateur » apprendrait à n'importe qui quels comptes existent.
          // Une console ouverte met « Animer « … » » en bas, pas cette porte.
          !console_ && (
            <p className="muted small">Tu animes une soirée ? Ta porte est tout en bas : « J’anime une soirée ».</p>
          )
        }
        pied={!console_ && <PorteAnimateur />}
        creer={!!creation}
        prefill={creation ?? undefined}
        onEnvoi={() => void panneaux.charger().catch(() => {})}
        onDone={() => {
          // Venu d'un lien vers le quiz du jour : on y va, sans repasser par l'accueil.
          if (suite) return window.location.assign(suite)
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

  const part = profil.requis > 0 ? Math.min(100, (profil.acquis / profil.requis) * 100) : 100
  const animateur = espace ?? console_

  return (
    // `player-shell` : la même mise en page que le téléphone d'un invité —
    // c'est le même écran, tenu dans la même main.
    <div className="player-shell">
      <header className="me-header profil-tete">
        <Avatar
          className="player-avatar big"
          avatar={profil.avatar}
          finition={profil.finition}
          eclat={profil.eclats.includes(cibleEclat(profil.legendaire, profil.avatar))}
          legendaire={profil.legendaire ?? undefined}
        />
        {/* Le niveau et sa barre, sous le nom : une carte « Niveau » redisait
            ce que l'en-tête disait déjà, la pastille et l'expérience. */}
        <div className="profil-identite">
          <h2>
            {profil.name}
            <Niveau niveau={profil.niveau} big />
          </h2>
          {/* Son titre, sous son prénom, comme sa carte le montre. */}
          {profil.titre && hautFait(profil.titre) && (
            <p className="titre-porte">{espacesFines(`« ${hautFait(profil.titre)!.title} »`)}</p>
          )}
          {/* Il a gagné hier : sa page le lui dit, comme la salle le voit. */}
          {profil.laurier && (
            <p className="carte-laurier">
              <Laurier laurier decoratif /> Vainqueur du quiz du jour d’hier
            </p>
          )}
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

      {/* D'abord ce qu'on est venu faire : animer, puis jouer. Le reste
          vient après — on le regarde, on n'en part pas. Le profil rattaché
          à un espace l'anime ; sinon, la console ouverte ici. */}
      {animateur && <JAnime espace={animateur} rouvrir={!!espace} />}
      <JeJoue
        enCours={enCours}
        chezMoi={animateur?.slug ?? null}
        onRejoindre={() => setRejoindre(true)}
        lendemain={lendemain}
      />

      {/* Le quiz du jour, sous la soirée : l'entre-deux, pas la raison de venir. */}
      <CarteDuJour />

      <Onglets
        onglets={ONGLETS}
        actif={onglet}
        onChoisir={choisirOnglet}
        label="Mon profil"
        idOnglet={id => `onglet-${id}`}
        idPanneau={id => `profil-${id}`}
        className="onglets-profil"
      />
      {/* Toujours là, vide d'abord : une région qui apparaît avec son texte
          n'est pas toujours lue. */}
      <p className="sr-only" role="status">
        {annonce}
      </p>

      {onglet === 'apparence' && (
        <div className="profil-onglet" role="tabpanel" id="profil-apparence" aria-labelledby="onglet-apparence">
          {lesPanneaux && lesPanneaux !== 'perdu' ? (
            <lesPanneaux.PanneauApparence profil={profil} busy={busy} enregistrer={enregistrer} />
          ) : (
            <OngletEnChemin perdu={lesPanneaux === 'perdu'} />
          )}
        </div>
      )}

      {onglet === 'trophees' && (
        <div className="profil-onglet" role="tabpanel" id="profil-trophees" aria-labelledby="onglet-trophees">
          {lesPanneaux && lesPanneaux !== 'perdu' ? (
            <lesPanneaux.PanneauTrophees profil={profil} busy={busy} enregistrer={enregistrer} />
          ) : (
            <OngletEnChemin perdu={lesPanneaux === 'perdu'} />
          )}
        </div>
      )}

      {onglet === 'carriere' && (
        <div className="profil-onglet" role="tabpanel" id="profil-carriere" aria-labelledby="onglet-carriere">
          <div className="card">
            <h3>
              <Icon name="bar-chart" />
              Ma fiche
            </h3>
            <FicheCarriere fiche={profil.fiche} partie="essentiel" />
            {/* Les courbes à la vue : on aimait les voir monter. Les huit
                autres chiffres et les catégories, d'un toucher. */}
            <h4 className="hf-groupe">Soirée après soirée</h4>
            <Courbes soirees={profil.soirees} />
            {profil.jour && profil.jour.jours.length > 0 && (
              <>
                <h4 className="hf-groupe">Jour après jour, au quiz du jour</h4>
                <Courbes unite="jour" soirees={pointsDesJours(profil.jour.jours)} />
              </>
            )}
            <Deplier id="fiche" titre="Tous mes chiffres">
              <FicheCarriere fiche={profil.fiche} partie="reste" />
            </Deplier>
            {Object.keys(profil.categories).length > 0 && (
              <>
                <h4 className="hf-groupe">Par catégorie</h4>
                <Categories categories={profil.categories} />
              </>
            )}
          </div>

          <MesJours jour={profil.jour} />

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
                      {s.espaceFerme && 'un espace fermé · '}
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
            {/* Les paliers et le quiz du jour ont leur ligne à part : sans ce
                mot, la somme des soirées ne faisait pas le total, et rien ne
                disait pourquoi. */}
            <p className="muted small">Les paliers de carrière et le quiz du jour s’ajoutent à part.</p>
          </Repli>

          <Repli id="acces" icone="users" titre="Identifiant et mot de passe">
            <MotDePasse login={profil.login} />
          </Repli>
        </div>
      )}

      <Glossaire
        mots={['xp', 'niveau', 'finition', 'eclat', 'legendaire', 'divin', 'hautsFaits', 'paliers', 'ecusson', 'laurier', 'serie', 'fond', 'precision', 'coupDOeil', 'reflexe', 'flair']}
      />

      {erreur && <p className="error">{erreur}</p>}

      <div className="reset-row">
        <button
          className="btn btn-ghost"
          onClick={async () => {
            setErreur('')
            // Tant que le serveur n'a pas fermé la session, le profil reste
            // ouvert et la page le dit : la requête perdue montrait le
            // formulaire de connexion, sans un mot, et le téléphone prêté
            // rouvrait le profil de son propriétaire au rechargement.
            try {
              await api.joueur.deconnexion()
            } catch (e) {
              return setErreur(motifDe(e))
            }
            retenirProfil(false)
            setProfil(null)
          }}
        >
          Me déconnecter
        </button>
      </div>
    </div>
  )
}

type Onglet = 'apparence' | 'trophees' | 'carriere'

/**
 * Un onglet qui arrive : sa place, d'une hauteur d'écran — le glossaire et
 * « Me déconnecter », dessous, ne sautent pas quand il arrive. S'il ne
 * viendra plus (le réseau, un redéploiement), la page le dit.
 */
function OngletEnChemin({ perdu }: { perdu: boolean }) {
  if (perdu) {
    return (
      <div className="onglet-en-chemin">
        <p className="error">Cet onglet n’a pas pu se charger : vérifie ta connexion.</p>
        <button type="button" className="btn btn-small" onClick={() => window.location.reload()}>
          Recharger la page
        </button>
      </div>
    )
  }
  return (
    <div className="onglet-en-chemin" aria-busy="true">
      <p className="serif-note">Chargement…</p>
    </div>
  )
}

/**
 * Les trois onglets du profil. Tout tenait sur une page — avatar,
 * légendaires, Divins, finitions, hauts faits, fiche, prix, soirées —, en
 * sections repliées qu'on ne savait plus où chercher : ce qu'on porte, ce
 * qu'on a gagné, ce qu'on a joué.
 */
const ONGLETS: OngletDef<Onglet>[] = [
  { id: 'apparence', nom: 'Apparence', icone: 'sparkles' },
  { id: 'trophees', nom: 'Trophées', icone: 'trophy' },
  { id: 'carriere', nom: 'Carrière', icone: 'bar-chart' },
]

/** L'onglet que ce téléphone avait laissé ouvert. */
const CLE_ONGLET = 'quizz.profil.onglet'

const estOnglet = (x: unknown): x is Onglet => ONGLETS.some(o => o.id === x)

/**
 * L'onglet ouvert : celui de l'adresse (`/profil#trophees`), sinon celui
 * qu'on avait laissé, sinon « Apparence ».
 */
function lireOnglet(): Onglet {
  const dansLAdresse = window.location.hash.slice(1)
  if (estOnglet(dansLAdresse)) return dansLAdresse
  // Sous try/catch : des cookies bloqués donnaient une page noire.
  try {
    const garde = localStorage.getItem(CLE_ONGLET)
    if (estOnglet(garde)) return garde
  } catch {
    // Stockage refusé : on part de l'apparence, comme la première fois.
  }
  return 'apparence'
}

/**
 * La porte des animateurs, sur l'accueil d'un visiteur sans profil ni
 * console ouverte ici : un lien discret vers la connexion au compte.
 * Discret, parce que l'accueil est d'abord celui des invités — « Rejoindre
 * une soirée » ne doit jamais descendre sous le bord. Une console ouverte
 * ici met sa carte en tête (`JAnime`).
 */
function PorteAnimateur() {
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
function lireSuite(): string {
  const next = new URLSearchParams(window.location.search).get('next')
  // Jamais ailleurs que chez soi (`shared/securite.ts`) ; sinon, l'accueil.
  return next ? pageDeRetour(next, window.location.origin, '') : ''
}

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
