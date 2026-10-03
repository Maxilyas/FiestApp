import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import { Glossaire } from '../components/Glossaire'
import { api, currentMe, motifDe } from '../api'
import { Avatar } from '../components/Avatar'
import { Niveau } from '../components/Niveau'
import { Laurier } from '../components/Laurier'
import { Icon, type IconName } from '../components/Icon'
import { MenuBarre, PieceTete, Tuile, type Piece } from '../components/Pieces'
import { ProfilForm } from '../components/ProfilForm'
import { tronquer } from '../../../shared/avatars'
import { pageDeRetour } from '../../../shared/securite'
import { cibleEclat } from '../../../shared/legendaires'
import { brilleChez, coupDOeilMoyen, type PublicProfileDetail } from '../../../shared/profil'
import { FormulaireSoiree } from '../components/Rejoindre'
import { Categories, Courbes, FicheCarriere } from '../components/Carriere'
import { annonceDuChoix, type ChoixDuProfil } from '../components/choix'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { espacesFines, formatNumber, place, reponsesParType } from '../format'
import { hautFait } from '../../../shared/hautsfaits'
import { route, spacePath } from '../routes'
import { derniereSoireeGardee } from '../state'
import { Lendemain } from '../components/Lendemain'
import { MesJours, pointsDesJours } from '../components/Jour'
import { AccueilJouer, JAnime } from '../components/AccueilDesRoles'
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
    if (e) history.pushState(history.state, '', `${window.location.pathname}${window.location.search}#${e}`)
    else if (window.location.hash) history.back()
    setEcranOuvert(e)
    window.scrollTo(0, 0)
  }
  useEffect(() => {
    const auRetour = () => setEcranOuvert(lireEcran())
    window.addEventListener('popstate', auRetour)
    return () => window.removeEventListener('popstate', auRetour)
  }, [])

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
        <a className="ligne-identite" href="/profil">
          {avatar('player-avatar')}
          <span className="ligne-identite-texte">
            <b>
              {profil.name}
              <Niveau niveau={profil.niveau} />
            </b>
            {barreXp}
          </span>
          {/* Ses confettis au bout de la ligne : discrets, ils se dépensent à la boutique. */}
          {profil.boutique && <span className="ligne-solde">🎊 {nConfettis(profil.boutique.confettis.solde)}</span>}
        </a>
        <AccueilJouer enCours={enCours} onRejoindre={() => setRejoindre(true)} lendemain={lendemain} />
        {/* L'écran commun et ses pages, pour qui anime : le profil rattaché à
            un espace, sinon la console ouverte ici. */}
        {animateur && <JAnime espace={animateur} rouvrir={!!espace} />}
        {erreur && <p className="error">{erreur}</p>}
        {menu('accueil')}
      </div>
    )
  }

  // ── La boutique : les thèmes, leurs confettis ──
  if (VUE === 'boutique') {
    return (
      <div className="player-shell">
        {/* Le solde, la boutique le dit en tête de ses thèmes. */}
        <PieceTete piece="Les thèmes" titre="La boutique" />
        {regionDAnnonce}
        {pret ? <pret.PanneauBoutique profil={profil} busy={busy} enregistrer={enregistrer} acheter={acheter} /> : enChemin}
        {erreur && <p className="error">{erreur}</p>}
        {menu('boutique')}
      </div>
    )
  }

  // ── Le profil : un écran ouvert depuis sa tuile ──
  if (ecran) {
    const nom = ECRANS.find(e => e.id === ecran)?.nom ?? ''
    return (
      <div className="player-shell">
        <a
          className="lien-discret jour-sortie"
          href="/profil"
          onClick={e => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            e.preventDefault()
            ouvrir(null)
          }}
        >
          <Icon name="arrow-left" />
          Mon profil
        </a>
        <PieceTete piece="Mon profil" titre={nom} />
        {regionDAnnonce}
        {ecran === 'avatars' && (pret ? <pret.PanneauAvatars profil={profil} busy={busy} enregistrer={enregistrer} /> : enChemin)}
        {ecran === 'style' && (pret ? <pret.PanneauStyle profil={profil} busy={busy} enregistrer={enregistrer} /> : enChemin)}
        {ecran === 'trophees' && (pret ? <pret.PanneauTrophees profil={profil} busy={busy} enregistrer={enregistrer} /> : enChemin)}
        {ecran === 'carriere' && (
          <>
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
          </>
        )}
        {ecran === 'soirees' && (
          <div className="card">
            {profil.soirees.length === 0 && <p className="muted">Pas encore de soirée : la première s’ajoutera ici.</p>}
            {profil.soirees.map(s => {
              const date = new Date(s.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
              // Le titre que l'animateur lui a donné, la date sinon : une liste de
              // dates ne disait pas laquelle était la fête de Marc.
              const nomDeSoiree = s.titre ?? date
              return (
                <div key={s.soireeId} className="soiree-row">
                  <div className="soiree-texte">
                    <span className="soiree-quand">
                      {/* Le souvenir de la soirée, dans l'espace où elle s'est jouée. */}
                      {s.slug ? (
                        <a className="link-inline" href={spacePath(s.slug, 'souvenir', s.soireeId)}>
                          {nomDeSoiree}
                        </a>
                      ) : (
                        nomDeSoiree
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
          </div>
        )}
        {erreur && <p className="error">{erreur}</p>}
        {menu('profil')}
      </div>
    )
  }

  // ── Le profil : qui je suis, puis ses tuiles ──
  const detailDeTuile: Record<EcranDuProfil, string> = {
    avatars: profil.legendaire ? 'Un légendaire porté' : `${profil.avatar} porté`,
    style: [profil.finition && profil.finition !== 'mat' ? 'Une finition' : null, profil.titre ? 'un titre' : null].filter(Boolean).join(', ') || 'Finition, titre, fond',
    trophees: `${profil.vitrine.length} en vitrine`,
    carriere: `Niveau ${profil.niveau}`,
    soirees: profil.soirees.length === 0 ? 'Aucune encore' : `${profil.soirees.length} soirée${profil.soirees.length > 1 ? 's' : ''}`,
  }
  const iconeDeTuile: Record<EcranDuProfil, IconName> = {
    avatars: 'sparkles',
    style: 'star',
    trophees: 'trophy',
    carriere: 'bar-chart',
    soirees: 'list',
  }
  return (
    <div className="player-shell">
      <header className="me-header profil-tete">
        {avatar('player-avatar big')}
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
          {barreXp}
          <p className="muted small">
            {profil.requis > 0
              ? `${formatNumber(profil.acquis)} / ${formatNumber(profil.requis)} XP vers le niveau ${profil.niveau + 1}`
              : 'Au sommet'}
          </p>
          {/* Ses confettis, sous son expérience : un toucher mène à la boutique. */}
          {profil.boutique && (
            <a className="profil-solde" href="/boutique">
              🎊 {nConfettis(profil.boutique.confettis.solde)}
            </a>
          )}
        </div>
      </header>
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
      {menu('profil')}
    </div>
  )
}


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
 * Les écrans du profil, chacun derrière sa tuile. Les trois onglets d'avant
 * tenaient tout sur trois pages qu'on faisait défiler — avatars, finitions,
 * thèmes, hauts faits, prix, fiche, soirées — : cinq tuiles disent ce qu'il
 * y a, et chacune ouvre le sien. La boutique a sa page, dans le menu.
 */
type EcranDuProfil = 'avatars' | 'style' | 'trophees' | 'carriere' | 'soirees'

const ECRANS: { id: EcranDuProfil; nom: string }[] = [
  { id: 'avatars', nom: 'Mes avatars' },
  { id: 'style', nom: 'Mon style' },
  { id: 'trophees', nom: 'Mes trophées' },
  { id: 'carriere', nom: 'Ma carrière' },
  { id: 'soirees', nom: 'Mes soirées' },
]

/** La page que sert la vue : l'accueil (`/`), le profil (`/profil`), la boutique (`/boutique`). */
const VUE: 'accueil' | 'profil' | 'boutique' =
  route.kind === 'account' && route.page === 'boutique' ? 'boutique' : route.kind === 'account' && route.page === 'profil' ? 'profil' : 'accueil'

/** Les adresses d'avant — un onglet, la boutique dans l'apparence — mènent encore quelque part. */
const ANCIENNES: Record<string, EcranDuProfil> = { apparence: 'avatars' }

/** L'écran de l'adresse (`/profil#trophees`), ou les tuiles. */
function lireEcran(): EcranDuProfil | null {
  if (VUE !== 'profil') return null
  const h = window.location.hash.slice(1)
  return ECRANS.find(e => e.id === h)?.id ?? ANCIENNES[h] ?? null
}

// La boutique des thèmes vivait dans l'apparence (`/profil#mes-themes`) : la
// fin de soirée d'une page d'avant y mène encore, et trouve sa page.
if (VUE === 'profil' && window.location.hash === '#mes-themes') window.location.replace('/boutique')

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
