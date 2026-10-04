import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import { Glossaire } from '../components/Glossaire'
import { api, currentMe, motifDe } from '../api'
import { Avatar } from '../components/Avatar'
import { Niveau } from '../components/Niveau'
import { Laurier } from '../components/Laurier'
import { Icon, type IconName } from '../components/Icon'
import { Identite, IdentiteLigne } from '../components/Identite'
import { MenuBarre, PieceTete, Tuile, type Piece } from '../components/Pieces'
import { ProfilForm } from '../components/ProfilForm'
import { tronquer } from '../../../shared/avatars'
import { pageDeRetour } from '../../../shared/securite'
import { cibleEclat } from '../../../shared/legendaires'
import { brilleChez, type ProfilDAccueil, type PublicProfileDetail } from '../../../shared/profil'
import { FormulaireSoiree } from '../components/Rejoindre'
import { annonceDuChoix, type ChoixDuProfil } from '../components/choix'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { espacesFines, formatNumber } from '../format'
import { hautFait } from '../../../shared/hautsfaits'
import { route } from '../routes'
import { derniereSoireeGardee } from '../state'
import { Lendemain } from '../components/Lendemain'
import { AccueilJouer, JAnime } from '../components/AccueilDesRoles'
import { Installer } from '../components/Installer'
import type { PublicSpace } from '../../../shared/space'
import { porterTheme } from '../themeJoueur'
import { nConfettis } from '../../../shared/themes'

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
 * L'accueil (`/`), le profil (`/profil`) et la boutique (`/boutique`) : une
 * même page, qui lit son adresse (`VUE`), et la barre du menu dessous.
 *
 * Demander « quelle soirée ? » avant de savoir qui est là n'avait aucun sens
 * pour celui qui revient : il a un profil, et souvent un salon à ouvrir. On
 * se connecte donc d'abord, et c'est d'ici qu'on part — en gros boutons. Le
 * chemin anonyme n'est pas refermé pour autant : « Rejoindre une soirée » a
 * le format de « Me connecter » et se voit sans défiler, exactement comme à
 * l'entrée d'une soirée.
 *
 * Rien de ce que cette page montre ne change quoi que ce soit au déroulé
 * d'une partie.
 */
export function ProfilApp() {
  // L'accueil lit son en-tête (`ProfilDAccueil`) ; le profil et la boutique, le détail.
  const [profil, setProfil] = useState<PublicProfileDetail | ProfilDAccueil | null>(null)
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
  /** L'écran ouvert depuis une tuile du profil (`/profil#trophees`), ou ses tuiles. */
  const [ecran, setEcranOuvert] = useState<EcranDuProfil | null>(lireEcran)
  /** Le contenu des écrans du profil et de la boutique, dès que le profil est connu. */
  const lesPanneaux = useALaDemande(panneaux, !!profil)
  /**
   * Ouvrir un écran pose son adresse dans l'historique : le retour du
   * navigateur ramène aux tuiles, pas hors du profil. Et chaque écran
   * commence en haut, comme une page qu'on ouvre.
   */
  const ouvrir = (e: EcranDuProfil | null) => {
    if (e) history.pushState({ ...history.state, [DEPUIS]: lireEcran() }, '', `${window.location.pathname}${window.location.search}#${e}`)
    else if (window.location.hash) history.back()
    setEcranOuvert(e)
    window.scrollTo(0, 0)
  }
  /**
   * Revenir à « Mon style » d'un de ses réglages : d'un cran si c'est de là
   * qu'on l'a ouvert, sans quoi on remplace l'adresse — jamais d'entrée en
   * double, et l'adresse d'un réglage ouverte d'un lien ne sort pas du profil.
   */
  const revenirAuStyle = () => {
    if (history.state?.[DEPUIS] === 'style') history.back()
    else history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}#style`)
    setEcranOuvert('style')
    window.scrollTo(0, 0)
  }
  useEffect(() => {
    const auRetour = () => setEcranOuvert(lireEcran())
    window.addEventListener('popstate', auRetour)
    return () => window.removeEventListener('popstate', auRetour)
  }, [])

  // L'accueil ne lit que son en-tête, sa série et son solde : le détail —
  // historique, hauts faits, titres des soirées — coûtait quatre ou cinq
  // allers-retours à la base, l'un après l'autre, pour une ligne.
  const relire = () =>
    (VUE === 'accueil' ? api.joueur.moiAccueil() : api.joueur.moi()).then(r => {
      retenirProfil(!!r.profile)
      if (r.profile) void panneaux.charger().catch(() => {})
      setProfil(r.profile)
      setEspace(r.espace)
      setEnCours(r.enCours ?? [])
    })

  useEffect(() => {
    // L'onglet de l'accueil dit ce qu'est l'application ; celui de `/profil`,
    // ce qu'on y regarde.
    document.title = VUE === 'accueil' ? 'FiestApp · le quiz de soirée' : VUE === 'boutique' ? 'La boutique · FiestApp' : 'Mon profil · FiestApp'
    currentMe().then(m => setConsole(m?.space ?? null))
    relire()
      .catch(() => setProfil(null))
      .finally(() => setChargement(false))
  }, [])

  // Le thème de son profil habille sa page, une fois le profil lu : celui
  // retenu au démarrage attend le verdict. Sans profil, Velours.
  useEffect(() => {
    if (!chargement) void porterTheme(profil?.theme)
  }, [chargement, profil?.theme])

  // L'accueil affiché, le code du quiz du jour et de la campagne vient en
  // fond : toucher leur bouton ouvre la page sans le télécharger d'abord.
  // Pour un profil seulement — l'invité anonyme n'y a pas accès.
  const aUnProfil = !!profil
  useEffect(() => {
    if (VUE !== 'accueil' || !aUnProfil) return
    const precharger = () => {
      void import('./CampagneApp').catch(() => {})
      void import('./JourApp').catch(() => {})
    }
    const attente = window as Window & { requestIdleCallback?: (f: () => void) => number }
    if (attente.requestIdleCallback) attente.requestIdleCallback(precharger)
    else setTimeout(precharger, 1500)
  }, [aUnProfil])

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

  /**
   * Acheter un thème : le serveur compte, achète et le fait porter. Le solde
   * affiché est celui qu'il rend — jamais une soustraction faite ici, qu'un
   * autre onglet aurait pu fausser. Rend le motif d'un refus, que la
   * boutique montre là où l'on a touché.
   */
  const acheter = async (cle: string): Promise<string | null> => {
    if (enregistrement.current) return null
    enregistrement.current = true
    setBusy(true)
    setAnnonce('')
    try {
      const { profile, boutique } = await api.joueur.acheterTheme(cle)
      setProfil(p => (p ? { ...p, ...profile, boutique } : p))
      setAnnonce(annonceDuChoix({ theme: cle }))
      return null
    } catch (e) {
      return motifDe(e)
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
            {console_ && <JAnime espace={console_} />}
          </>
        }
        aideErreur={
          // La même phrase pour tout refus : dire « c'est un identifiant
          // d'animateur » apprendrait à n'importe qui quels comptes existent.
          // Une console ouverte met « Animer « … » » en bas, pas cette porte.
          // Un compte d'animateur d'avant que la migration n'a pas pu rattacher
          // (son identifiant était pris) garde sa porte, à côté.
          !console_ && (
            <p className="muted small">
              Un ancien compte d’animateur ?{' '}
              <a className="link-inline" href="/connexion?next=/compte">
                Connecte-toi ici
              </a>
            </p>
          )
        }
        creer={!!creation}
        prefill={creation ?? undefined}
        // L'application à installer, sous les trois boutons : ils restent visibles sans défiler.
        pied={<Installer />}
        onEnvoi={() => void panneaux.charger().catch(() => {})}
        onDone={(_, info) => {
          // Venu d'un lien vers le quiz du jour : on y va, sans repasser par l'accueil.
          if (suite) return window.location.assign(suite)
          // Un profil qui naît arrive à l'accueil — ce qu'on vient faire —,
          // pas sur la page du profil, encore vide (la remarque du 3 octobre 2026).
          if (info?.cree && VUE !== 'accueil') return window.location.replace('/')
          // Le profil est là : un rafraîchissement ne doit pas rouvrir la création.
          if (creation) history.replaceState(null, '', window.location.pathname)
          void relire()
        }}
        echappee={
          <>
            {/* Le même mot qu'à l'entrée d'une soirée : « Rejoindre une
                soirée » ici, « Jouer sans compte » là-bas, pour le même
                chemin (la remarque du propriétaire du 4 octobre 2026). Le
                formulaire du code, derrière, dit qu'on rejoint une soirée. */}
            <button type="button" className="btn btn-accent btn-big btn-block" onClick={() => setRejoindre(true)}>
              Jouer sans compte
            </button>
            {lendemain}
          </>
        }
      />
    )
  }

  const part = profil.requis > 0 ? Math.min(100, (profil.acquis / profil.requis) * 100) : 100
  const pret = lesPanneaux && lesPanneaux !== 'perdu' ? lesPanneaux : null
  const enChemin = <OngletEnChemin perdu={lesPanneaux === 'perdu'} />
  const barreXp = (
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
  )
  const avatar = (classe: string) => (
    <Avatar
      className={classe}
      avatar={profil.avatar}
      finition={profil.finition}
      eclat={brilleChez(profil, cibleEclat(profil.legendaire, profil.avatar))}
      legendaire={profil.legendaire ?? undefined}
    />
  )
  // Toujours là, vide d'abord : une région qui apparaît avec son texte
  // n'est pas toujours lue.
  const regionDAnnonce = (
    <p className="sr-only" role="status">
      {annonce}
    </p>
  )
  const menu = (ici: Piece) => <MenuBarre ici={ici} />

  // ── L'accueil : qui l'on est en une ligne, puis ce qu'on vient faire ──
  if (VUE === 'accueil') {
    return (
      // `player-shell` : la même mise en page que le téléphone d'un invité —
      // c'est le même écran, tenu dans la même main.
      <div className="player-shell accueil">
        {/* Soi-même en une ligne : un toucher mène au profil. */}
        <IdentiteLigne profil={profil} />
        <AccueilJouer enCours={enCours} onRejoindre={() => setRejoindre(true)} lendemain={lendemain} jour={profil.jour} />
        {/* Sous ce qu'on vient faire : l'application à installer — et, installée, le rappel du soir. */}
        <Installer avecProfil />
        {/* Pas de carte « J'anime » ici : qui anime avec son profil a déjà
            chaque porte — « Créer un salon » au-dessus, « Mes quiz » et
            « Compte » dans le menu, l'écran commun et l'historique dans son
            Compte (`AccueilDesRoles`). */}
        {erreur && <p className="error">{erreur}</p>}
        {menu('accueil')}
      </div>
    )
  }

  // Hors de l'accueil, la page a lu le détail (`relire`). Un en-tête seul
  // n'arrive jamais ici ; s'il le faisait, on attendrait plutôt que de lire
  // des champs absents.
  if (!('hautsFaits' in profil)) {
    return (
      <div className="center-page">
        <p className="serif-note">Chargement…</p>
      </div>
    )
  }

  // ── La boutique : les thèmes, leurs confettis ──
  if (VUE === 'boutique') {
    return (
      <div className="player-shell">
        {/* Le titre et le solde sur une ligne : la place va aux thèmes. */}
        <header className="boutique-tete">
          <h1>Boutique</h1>
          {profil.boutique && (
            <span className="solde-puce" title="Une bonne réponse, un confetti">
              <span aria-hidden="true">🎊</span> {formatNumber(profil.boutique.confettis.solde)}
              <span className="sr-only"> confettis</span>
            </span>
          )}
        </header>
        {regionDAnnonce}
        {pret ? (
          <pret.PanneauBoutique
            profil={profil}
            busy={busy}
            enregistrer={enregistrer}
            acheter={acheter}
            onSolde={solde =>
              setProfil(p =>
                p?.boutique ? { ...p, boutique: { ...p.boutique, confettis: { ...p.boutique.confettis, solde, depenses: p.boutique.confettis.gagnes - solde } } } : p,
              )
            }
          />
        ) : (
          enChemin
        )}
        {erreur && <p className="error">{erreur}</p>}
        {menu('boutique')}
      </div>
    )
  }

  // ── Le profil : un écran ouvert depuis sa tuile ──
  if (ecran) {
    const reglage = REGLAGES.find(e => e.id === ecran)
    const nom = reglage?.nom ?? ECRANS.find(e => e.id === ecran)?.nom ?? ''
    return (
      <div className="player-shell">
        <a
          className="lien-discret jour-sortie"
          href={reglage ? '/profil#style' : '/profil'}
          onClick={e => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            e.preventDefault()
            if (reglage) revenirAuStyle()
            else ouvrir(null)
          }}
        >
          <Icon name="arrow-left" />
          {reglage ? 'Mon style' : 'Mon profil'}
        </a>
        <PieceTete piece={reglage ? 'Mon style' : 'Mon profil'} titre={nom} />
        {regionDAnnonce}
        {ecran === 'avatars' && (pret ? <pret.PanneauAvatars profil={profil} busy={busy} enregistrer={enregistrer} /> : enChemin)}
        {ecran === 'style' &&
          (pret ? <pret.PanneauStyle profil={profil} busy={busy} enregistrer={enregistrer} onReglage={r => ouvrir(`style-${r}`)} /> : enChemin)}
        {reglage &&
          (pret ? (
            <pret.PanneauReglage reglage={reglage.id.slice('style-'.length) as 'finition' | 'titre' | 'fond' | 'theme'} profil={profil} busy={busy} enregistrer={enregistrer} />
          ) : (
            enChemin
          ))}
        {ecran === 'trophees' && (pret ? <pret.PanneauTrophees profil={profil} busy={busy} enregistrer={enregistrer} /> : enChemin)}
        {ecran === 'carriere' && (pret ? <pret.PanneauCarriere profil={profil} /> : enChemin)}
        {ecran === 'soirees' && (pret ? <pret.PanneauSoirees profil={profil} monEspace={espace?.slug} /> : enChemin)}
        {erreur && <p className="error">{erreur}</p>}
        {menu('profil')}
      </div>
    )
  }

  // ── Le profil : qui je suis, puis ses tuiles ──
  const nHautsFaits = profil.hautsFaits.filter(h => h.fois > 0).length
  const nPrix = (profil.prix ?? []).filter(x => x.fois > 0).length
  const precision = profil.fiche.precision !== null ? Math.round(profil.fiche.precision * 100) : null
  const detailDeTuile: Record<TuileDuProfil, string> = {
    avatars: profil.legendaires.length > 0 ? `${profil.legendaires.length} légendaire${profil.legendaires.length > 1 ? 's' : ''}, des branches, des emojis` : 'Des branches, des emojis, des légendaires',
    style: 'Finition, titre, fond',
    trophees: `${nHautsFaits} haut${nHautsFaits > 1 ? 's' : ''} fait${nHautsFaits > 1 ? 's' : ''} · ${nPrix} prix`,
    carriere: precision !== null ? `Précision ${precision} % · tes courbes` : 'Tes chiffres, tes courbes',
    soirees: profil.soirees.length === 0 ? 'Aucune encore' : `${profil.soirees.length} soirée${profil.soirees.length > 1 ? 's' : ''}, jouées ou animées`,
  }
  const iconeDeTuile: Record<TuileDuProfil, IconName> = {
    avatars: 'sparkles',
    style: 'palette',
    trophees: 'trophy',
    carriere: 'bar-chart',
    soirees: 'book',
  }
  return (
    <div className="player-shell">
      {/* Soi-même, en tête : son titre, sa barre d'expérience, ses confettis ; un toucher ouvre sa carte. */}
      <Identite profil={profil} />
      {/* Il a gagné hier : sa page le lui dit, comme la salle le voit. */}
      {profil.laurier && (
        <p className="carte-laurier">
          <Laurier laurier decoratif /> Vainqueur du quiz du jour d’hier
        </p>
      )}
      {regionDAnnonce}

      <div className="tuiles">
        {ECRANS.map(e => (
          <Tuile key={e.id} icone={iconeDeTuile[e.id]} titre={e.nom} detail={detailDeTuile[e.id]} onClick={() => ouvrir(e.id)} />
        ))}
      </div>

      <Glossaire
        mots={['xp', 'niveau', 'finition', 'eclat', 'legendaire', 'divin', 'hautsFaits', 'paliers', 'ecusson', 'laurier', 'serie', 'fond', 'precision', 'coupDOeil', 'reflexe', 'flair']}
      />

      {erreur && <p className="error">{erreur}</p>}
      {/* Plus de « Me déconnecter » ici : il est dans « Compte », la pièce
          du menu où se règle ce qui n'est pas du jeu — l'identifiant, le mot
          de passe. Il était aux deux endroits (le propriétaire du dépôt, le
          4 octobre 2026). */}
      {menu('profil')}
    </div>
  )
}


/**
 * Un onglet qui arrive : sa place, d'une hauteur d'écran — ce qui est
 * dessous ne saute pas quand il arrive. S'il ne viendra plus (le réseau, un
 * redéploiement), la page le dit.
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
 * Les écrans du profil, chacun derrière sa tuile. Les trois onglets d'avant
 * tenaient tout sur trois pages qu'on faisait défiler — avatars, finitions,
 * thèmes, hauts faits, prix, fiche, soirées — : cinq tuiles disent ce qu'il
 * y a, et chacune ouvre le sien. La boutique a sa page, dans le menu.
 */
type TuileDuProfil = 'avatars' | 'style' | 'trophees' | 'carriere' | 'soirees'
/** Un réglage du style a son écran, sous « Mon style ». */
type ReglageDuStyle = 'style-finition' | 'style-titre' | 'style-fond' | 'style-theme'
type EcranDuProfil = TuileDuProfil | ReglageDuStyle

const ECRANS: { id: TuileDuProfil; nom: string }[] = [
  { id: 'avatars', nom: 'Mes avatars' },
  { id: 'style', nom: 'Mon style' },
  { id: 'trophees', nom: 'Mes trophées' },
  { id: 'carriere', nom: 'Ma carrière' },
  { id: 'soirees', nom: 'Mes soirées' },
]

const REGLAGES: { id: ReglageDuStyle; nom: string }[] = [
  { id: 'style-finition', nom: 'Finition' },
  { id: 'style-titre', nom: 'Titre' },
  { id: 'style-fond', nom: 'Fond de carte' },
  { id: 'style-theme', nom: 'Thème' },
]

/** La page que sert la vue : l'accueil (`/`), le profil (`/profil`), la boutique (`/boutique`). */
const VUE: 'accueil' | 'profil' | 'boutique' =
  route.kind === 'account' && route.page === 'boutique' ? 'boutique' : route.kind === 'account' && route.page === 'profil' ? 'profil' : 'accueil'

/** L'écran d'où l'on a ouvert celui-ci, gardé dans l'historique : « ← Mon style » y revient d'un cran. */
const DEPUIS = 'fiestappProfilDepuis'

/** Les adresses d'avant — un onglet, la boutique dans l'apparence — mènent encore quelque part. */
const ANCIENNES: Record<string, EcranDuProfil> = { apparence: 'avatars' }

/** L'écran de l'adresse (`/profil#trophees`), ou les tuiles. */
function lireEcran(): EcranDuProfil | null {
  if (VUE !== 'profil') return null
  const h = window.location.hash.slice(1)
  return ECRANS.find(e => e.id === h)?.id ?? REGLAGES.find(e => e.id === h)?.id ?? ANCIENNES[h] ?? null
}

// La boutique des thèmes vivait dans l'apparence (`/profil#mes-themes`) : la
// fin de soirée d'une page d'avant y mène encore, et trouve sa page.
if (VUE === 'profil' && window.location.hash === '#mes-themes') window.location.replace('/boutique')

/**
 * La création préremplie qu'ouvre « Créer mon profil » à la fin d'une
 * soirée (`/?creer=1&prenom=…&avatar=…`, l'accueil) : elle ouvrait la connexion,
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

