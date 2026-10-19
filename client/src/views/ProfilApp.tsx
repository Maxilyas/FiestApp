import { useEffect, useRef, useState, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react'
import { Glossaire } from '../components/Glossaire'
import { api, currentMe, motifDe } from '../api'
import { Niveau } from '../components/Niveau'
import { Laurier } from '../components/Laurier'
import { Icon, type IconName } from '../components/Icon'
import { IdentiteLigne } from '../components/Identite'
import { BoutonDesAmis, lesAmis } from '../components/FeuilleDesAmisADemande'
import { LogeEnChemin } from '../components/LogeTete'
import { GrosBouton, MenuBarre, PieceTete, type Piece } from '../components/Pieces'
import { ProfilForm } from '../components/ProfilForm'
import { tronquer } from '../../../shared/avatars'
import { pageDeRetour } from '../../../shared/securite'
import type { ProfilDAccueil, PublicProfileDetail } from '../../../shared/profil'
// Le type seul : les règles de la loge viennent avec ses panneaux, à la demande.
import type { PieceDeLaLoge } from '../../../shared/loge'
import { nouveautesAPorter, premierePieceNeuve, type VusDeLaLoge } from '../../../shared/piecesDeLaLoge'
import { retenirLeCompte, useNouveautesDuMenu } from '../nouveautes'
import { FormulaireSoiree } from '../components/Rejoindre'
import { annonceDuChoix, type ChoixDuProfil, type GardeDeLaLoge } from '../components/choix'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { espacesFines, formatNumber } from '../format'
import { hautFait } from '../../../shared/hautsfaits'
import { route } from '../routes'
import { derniereSoireeGardee } from '../state'
import { Lendemain } from '../components/Lendemain'
import { AccueilJouer, AnnoncesDeLAdministrateur, BanniereDuResultat, JAnime } from '../components/AccueilDesRoles'
import { Installer } from '../components/Installer'
import type { PublicSpace } from '../../../shared/space'
import { porterTheme } from '../themeJoueur'
import { porterGerbe } from '../gerbe'
import { porterNiche } from '../niche'
import { relireLesMissions } from '../missions'
import { boutonsDesPages } from '../maintenance'

const ETAPE_REJOINDRE = 'fiestappRejoindre'

/**
 * Les écrans du profil — « Mon avatar », « Ma collection »… —, à la demande :
 * ils portent les dessins de tous les médaillons, et l'accueil anonyme —
 * « Me connecter », « Rejoindre une soirée » — les téléchargeait avec lui,
 * 21 Ko et 179 ms de plus en 4G. Ils partent dès le chargement de la page du
 * profil — le compte de sa collection, ses écrans — et de la boutique (plus
 * bas).
 */
const panneaux = aLaDemande(() => import('../components/PanneauxDuProfil'))

/** Sa carte entière, comme la salle la voit, au toucher de sa ligne : rien ne la télécharge avant. */
const carteJoueur = aLaDemande(() => import('../components/CarteJoueur'))

/**
 * Le haut de l'accueil d'un profil — « À la une », les missions du jour —, à
 * la demande : l'accueil anonyme, qui partage la page, n'en télécharge rien.
 * Il part dès que le profil est lu (`relire`), ses missions avec la page
 * (`DEPART.missions`) : sa place est gardée en attendant, rien ne saute sous
 * le doigt.
 */
const hautDeLAccueil = aLaDemande(() => import('../components/HautDeLAccueil'))

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
  /** Sa carte entière, ouverte de sa ligne en tête de l'accueil et du profil — ou de la carte de la loge, avant ses panneaux. */
  const [carteOuverte, setCarteOuverte] = useState(false)
  const laCarte = useALaDemande(carteJoueur, carteOuverte)
  const ouvrirLaCarte = () => setCarteOuverte(true)
  /** L'écran ouvert depuis un bouton du profil (`/profil#collection`), ou ses boutons. */
  const [ecran, setEcranOuvert] = useState<EcranDuProfil | null>(lireEcran)
  /** L'écran montré, pour le retour du navigateur, qu'on écoute une fois pour toutes. */
  const ecranMontre = useRef(ecran)
  ecranMontre.current = ecran
  /**
   * La loge, tant qu'elle est là : de quoi lui demander avant de la quitter
   * sur un essai pas porté (`GardeDeLaLoge`) — elle s'y pose elle-même.
   */
  const gardeDeLaLoge = useRef<GardeDeLaLoge | null>(null)
  /** L'entrée de la loge dans l'historique, retenue à chaque pièce : le retour qui la quittait y revient si l'on reste. */
  const entreeDeLaLoge = useRef<{ etat: unknown; adresse: string } | null>(null)
  useEffect(() => {
    if (dansLaLoge(ecran)) entreeDeLaLoge.current = { etat: history.state, adresse: window.location.href }
  }, [ecran])
  /**
   * Partir d'un écran. De la loge, sur un essai pas porté, après sa réponse :
   * « Porter », « Partir sans » ou « Rester » — l'essai se perdait en silence.
   */
  const quitter = (partir: () => void) => {
    const garde = gardeDeLaLoge.current
    if (!dansLaLoge(ecran) || !garde?.enCours()) return partir()
    void garde.demander().then(ok => {
      if (ok) partir()
    })
  }
  /**
   * Le contenu des écrans du profil et de la boutique, dès que le profil est
   * connu — pas sur l'accueil, qui n'en montre rien : il les fait venir en
   * fond, une fois montré (`precharger`, plus bas).
   */
  const lesPanneaux = useALaDemande(panneaux, !!profil && VUE !== 'accueil')
  /**
   * Ouvrir un écran pose son adresse dans l'historique — une ligne de la
   * collection a la sienne (`#collection-themes`) —, avec l'écran d'où l'on
   * vient : le retour du navigateur y ramène, pas hors du profil. Et chaque
   * écran commence en haut, comme une page qu'on ouvre.
   */
  const ouvrir = (e: EcranDuProfil, adresse: string = e, requete: string = window.location.search) => {
    history.pushState({ ...history.state, [DEPUIS]: lireEcran() }, '', `${window.location.pathname}${requete}#${adresse}`)
    setEcranOuvert(e)
    window.scrollTo(0, 0)
  }
  /**
   * « ← » en tête d'un écran : d'un cran quand on l'a ouvert d'ici — des
   * tuiles, ou d'un autre écran (« Mon thème » mène à la collection) —,
   * comme le retour du navigateur. Ouvert d'un lien ou d'un favori, on
   * remplace l'adresse par les tuiles : jamais d'entrée en double, et le
   * retour ne sort pas du profil.
   */
  const revenir = () => {
    if (history.state?.[DEPUIS] !== undefined) return history.back()
    history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`)
    setEcranOuvert(null)
    window.scrollTo(0, 0)
  }
  /**
   * Un lien d'un écran vers un autre (`#avatar`, `#collection-themes`) passe
   * par `ouvrir` : son entrée d'historique retient d'où l'on vient. Laissé au
   * navigateur, il changeait l'adresse sans rien retenir, et « ← » ramenait
   * aux tuiles au lieu de l'écran qu'on quittait. « Essayer », dans une fiche
   * de la collection (`?essayer=or#fond`), de même : l'essai voyage dans
   * l'adresse, que la loge lit en s'ouvrant — laissé au navigateur, il
   * rechargeait toute la page.
   */
  const suivreUnLien = (e: MouseEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const lien = (e.target as Element).closest?.('a[href^="#"], a[href^="?essayer="]')?.getAttribute('href')
    const diese = lien ? lien.indexOf('#') : -1
    const adresse = lien && diese >= 0 ? lien.slice(diese + 1) : ''
    const cible = adresse ? ecranDe(adresse) : null
    if (!lien || !cible) return
    e.preventDefault()
    const aller = () => ouvrir(cible, adresse, lien.startsWith('?') ? lien.slice(0, diese) : window.location.search)
    // Vers une autre pièce, la loge reste, l'essai avec ; ailleurs — la collection —, elle demande d'abord.
    if (dansLaLoge(cible)) aller()
    else quitter(aller)
  }
  /**
   * Un lien de la loge vers une autre page — le menu, la boutique : sur un
   * essai pas porté, elle demande d'abord, puis la page part. Ceux vers un
   * écran du profil passent par `suivreUnLien`, qui demande de même.
   */
  const surLaLoge = (e: MouseEvent<HTMLElement>) => {
    suivreUnLien(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const lien = (e.target as Element).closest?.('a[href]')
    if (!(lien instanceof HTMLAnchorElement) || lien.target || /^[#?]/.test(lien.getAttribute('href') ?? '') || !gardeDeLaLoge.current?.enCours()) return
    e.preventDefault()
    quitter(() => window.location.assign(lien.href))
  }
  useEffect(() => {
    let enQuestion = false
    const auRetour = () => {
      // Déjà en train de demander : un second retour passe, la réponse dira où l'on reste.
      if (enQuestion) return
      const suivant = lireEcran()
      const garde = gardeDeLaLoge.current
      // Le retour du navigateur quitte la loge sur un essai pas porté : elle
      // reste à l'écran le temps de demander ; on reste, son entrée revient.
      if (dansLaLoge(ecranMontre.current) && !dansLaLoge(suivant) && garde?.enCours()) {
        enQuestion = true
        const entree = entreeDeLaLoge.current
        void garde.demander().then(partir => {
          enQuestion = false
          if (partir) setEcranOuvert(lireEcran())
          else if (entree) history.pushState(entree.etat, '', entree.adresse)
        })
        return
      }
      setEcranOuvert(suivant)
    }
    window.addEventListener('popstate', auRetour)
    return () => window.removeEventListener('popstate', auRetour)
  }, [])
  /**
   * Passer d'une pièce à l'autre, dans la loge : l'adresse suit (`#titre`),
   * sans entrée d'historique — le retour quitte la loge, comme on y est
   * entré, au lieu de repasser par chaque pièce touchée.
   */
  const changerDePiece = (piece: PieceDeLaLoge) => {
    history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}#${piece}`)
    setEcranOuvert(piece)
  }
  // La première fois qu'un profil paraît, ce qu'il porte se retient vu : la
  // prochaine nouveauté aura sa pastille sur « Profil », « M'habiller » et sa
  // pièce de la loge — même s'il passe par la boutique d'abord.
  const profilDetaille = profil && 'hautsFaits' in profil ? profil : null
  /** Ce qu'il vient de voir dans sa loge : la page le garde, et ses pastilles se recomptent. */
  const retenirLesVusDeLaLoge = (vus: VusDeLaLoge) => setProfil(p => (p && 'hautsFaits' in p ? { ...p, vusDeLaLoge: vus } : p))
  useEffect(() => {
    if (profilDetaille && lesPanneaux && lesPanneaux !== 'perdu') lesPanneaux.retenirLesPremiersVus(profilDetaille, retenirLesVusDeLaLoge)
  }, [profilDetaille?.id, lesPanneaux])
  // Ce que la loge a de neuf, recompté sur le détail dès que ses règles sont là ;
  // l'onglet le garde, et l'accueil ou le compte le montrent en attendant le serveur.
  const lesRegles = lesPanneaux && lesPanneaux !== 'perdu' ? lesPanneaux : null
  const nouveautesDuDetail = profilDetaille && lesRegles ? lesRegles.nouveautesDuProfil(profilDetaille) : null
  useEffect(() => {
    if (nouveautesDuDetail) retenirLeCompte(nouveautesDuDetail.nouveautes)
  }, [nouveautesDuDetail?.nouveautes])

  // L'accueil ne lit que son en-tête, sa série et son solde : le détail —
  // historique, hauts faits, titres des soirées — coûtait quatre ou cinq
  // allers-retours à la base, l'un après l'autre, pour une ligne.
  const relire = ({ missionsDemandees = false } = {}) =>
    (VUE === 'accueil' ? api.joueur.moiAccueil() : api.joueur.moi()).then(r => {
      if (r.profile && VUE !== 'accueil') void panneaux.charger().catch(() => {})
      // Le haut de l'accueil et ses missions, ensemble : ni l'un n'attend l'autre, ni l'un et l'autre la page.
      if (r.profile && VUE === 'accueil') {
        void hautDeLAccueil.charger().catch(() => {})
        if (!missionsDemandees) void relireLesMissions().catch(() => {})
      }
      setProfil(r.profile)
      setEspace(r.espace)
      setEnCours(r.enCours ?? [])
    })

  useEffect(() => {
    // L'onglet de l'accueil dit ce qu'est l'application ; celui de `/profil`,
    // ce qu'on y regarde.
    document.title = VUE === 'accueil' ? 'FiestApp · le quiz de soirée' : VUE === 'boutique' ? 'La boutique · FiestApp' : 'Mon profil · FiestApp'
    currentMe().then(m => setConsole(m?.space ?? null))
    // Ses missions sont parties avec la page (`donneesDeDepart`), comme son
    // profil : demandées ici, par tout visiteur — un invité reçoit un refus —,
    // jamais après une connexion, qui lirait le refus préchargé. Demandées une
    // fois l'accueil lu, elles arrivaient un aller-retour après lui.
    if (VUE === 'accueil') void relireLesMissions().catch(() => {})
    relire({ missionsDemandees: VUE === 'accueil' })
      .catch(() => setProfil(null))
      .finally(() => setChargement(false))
  }, [])

  // Le thème de son profil habille sa page, une fois le profil lu : celui
  // retenu au démarrage attend le verdict. Sans profil, Velours.
  useEffect(() => {
    if (!chargement) void porterTheme(profil?.theme)
  }, [chargement, profil?.theme])
  // Sa gerbe aussi : choisie ici, elle éclate à sa prochaine bonne réponse.
  useEffect(() => {
    if (!chargement) porterGerbe(profil?.gerbe)
  }, [chargement, profil?.gerbe])
  // Et la niche de son compagnon : adopté ou installé à la boutique, il y entre tout de suite.
  const niche = profil?.niche
  const rangDeLaNiche = profil?.compagnons?.find(c => c.compagnon === niche)?.rang
  useEffect(() => {
    if (!chargement) porterNiche(niche && rangDeLaNiche !== undefined ? { niche, compagnons: [{ compagnon: niche, rang: rangDeLaNiche }] } : null)
  }, [chargement, niche, rangDeLaNiche])

  // L'accueil affiché, le code du quiz du jour, de la campagne et des duels
  // vient en fond : toucher leur bouton ouvre la page sans le télécharger d'abord.
  // Pour un profil seulement — l'invité anonyme n'y a pas accès. Les écrans
  // du profil aussi, que « Profil », au menu, trouvera là : demandés dès le
  // profil lu, leurs douze morceaux passaient devant le premier écran de
  // l'accueil, qui n'en montre rien (mesuré le 11 octobre 2026 :
  // `PanneauxDuProfil`, 21 ko, arrivait juste avant lui). La feuille des amis
  // et sa carte de même : « Amis » ou sa ligne, touchés, les ouvrent tout de
  // suite — les écrans du profil n'apportent pas la carte : la loge aussi ne
  // la fait venir qu'au toucher.
  const aUnProfil = !!profil
  // L'accueil ne lit pas le détail : sa barre demande au serveur ce qui est neuf, une fois l'accueil montré.
  const compteDuMenu = useNouveautesDuMenu(VUE === 'accueil' && aUnProfil)
  const leHaut = useALaDemande(hautDeLAccueil, VUE === 'accueil' && aUnProfil)
  useEffect(() => {
    if (VUE !== 'accueil' || !aUnProfil) return
    const precharger = () => {
      void import('./CampagneApp').catch(() => {})
      void import('./Duels').catch(() => {})
      void import('./JourApp').catch(() => {})
      void panneaux.charger().catch(() => {})
      void lesAmis.charger().catch(() => {})
      void carteJoueur.charger().catch(() => {})
    }
    const attente = window as Window & { requestIdleCallback?: (f: () => void) => number }
    if (attente.requestIdleCallback) attente.requestIdleCallback(precharger)
    else setTimeout(precharger, 1500)
  }, [aUnProfil])

  /** Enregistre ce que la loge porte — une pièce, ou tout un essai d'un coup — : vrai s'il a pris. */
  const enregistrer = async (patch: ChoixDuProfil): Promise<boolean> => {
    // Un second toucher pendant l'enregistrement est ignoré ici, plutôt que
    // de désactiver chaque case : désactivée, la case touchée perdait le
    // focus, qui tombait sur la page — et le lecteur d'écran n'entendait rien.
    if (enregistrement.current) return false
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
      return true
    } catch (e) {
      setErreur((e as Error).message)
      return false
    } finally {
      enregistrement.current = false
      setBusy(false)
    }
  }

  /**
   * Acheter un thème : le serveur compte, achète, et le fait porter si on le
   * veut. Le solde affiché est celui qu'il rend — jamais une soustraction
   * faite ici, qu'un autre onglet aurait pu fausser. Rend le motif d'un
   * refus, que la boutique montre là où l'on a touché.
   */
  const acheter = async (cle: string, porter: boolean): Promise<string | null> => {
    if (enregistrement.current) return null
    enregistrement.current = true
    setBusy(true)
    setAnnonce('')
    try {
      const { profile, boutique } = await api.joueur.acheterTheme(cle, porter)
      setProfil(p => (p ? { ...p, ...profile, boutique } : p))
      // Gardé pour plus tard, la boutique le dit elle-même, là où l'on a touché.
      if (porter) setAnnonce(annonceDuChoix({ theme: cle }))
      return null
    } catch (e) {
      return motifDe(e)
    } finally {
      enregistrement.current = false
      setBusy(false)
    }
  }

  /** Acheter un compagnon : comme un thème, le serveur compte, achète, et le fait porter si on le veut. */
  const acheterCompagnon = async (cle: string, porter: boolean): Promise<string | null> => {
    if (enregistrement.current) return null
    enregistrement.current = true
    setBusy(true)
    setAnnonce('')
    try {
      const { profile, boutique } = await api.joueur.acheterCompagnon(cle, porter)
      setProfil(p => (p ? { ...p, ...profile, boutique } : p))
      if (porter && profile.legendaire) setAnnonce(annonceDuChoix({ legendaire: profile.legendaire }))
      return null
    } catch (e) {
      return motifDe(e)
    } finally {
      enregistrement.current = false
      setBusy(false)
    }
  }

  /** Acheter un fond des savoirs : le serveur rend ses fonds relus, le nouveau compris — la loge le propose sans recharger. */
  const acheterFond = async (cle: string, porter: boolean): Promise<string | null> => {
    if (enregistrement.current) return null
    enregistrement.current = true
    setBusy(true)
    setAnnonce('')
    try {
      const { profile, boutique, fond, fonds } = await api.joueur.acheterFond(cle, porter)
      setProfil(p => (p ? { ...p, ...profile, boutique, fond, fonds } : p))
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
        // Connecté, le profil montre ses écrans ; l'accueil, rien d'eux.
        onEnvoi={VUE === 'accueil' ? undefined : () => void panneaux.charger().catch(() => {})}
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
  // Toujours là, vide d'abord : une région qui apparaît avec son texte
  // n'est pas toujours lue.
  const regionDAnnonce = (
    <p className="sr-only" role="status">
      {annonce}
    </p>
  )
  const menu = (ici: Piece) => <MenuBarre ici={ici} nouveautes={nouveautesDuDetail?.nouveautes ?? compteDuMenu} />

  // ── L'accueil : qui l'on est en une ligne, puis ce qu'on vient faire ──
  if (VUE === 'accueil') {
    return (
      // `player-shell` : la même mise en page que le téléphone d'un invité —
      // c'est le même écran, tenu dans la même main.
      <div className="player-shell accueil">
        {/* Un duel qu'il a lancé vient d'être joué : une bannière tombe en haut, une fois (la maquette A4) —
            en tête de la page comme à l'écran, son « Voir » le premier au clavier. */}
        <BanniereDuResultat resultats={'duels' in profil ? profil.duels?.resultats : undefined} />
        {/* Soi-même en une ligne : un toucher ouvre sa carte, comme au
            profil — il menait au profil, que le menu ouvre déjà (le souhait
            du propriétaire du 14 octobre 2026). Au bout, ses amis : leur
            feuille monte sur l'accueil (le souhait du propriétaire du
            11 octobre 2026) — un profil seulement, l'invité anonyme n'a rien
            ici. */}
        <div className="accueil-tete">
          <IdentiteLigne profil={profil} onCarte={ouvrirLaCarte} sansOeil />
          <BoutonDesAmis />
        </div>
        {carteOuverte && laCarte && laCarte !== 'perdu' && <laCarte.CarteJoueur adresse="/api/joueur/carte" onFermer={() => setCarteOuverte(false)} />}
        {/* Ce que l'administrateur a fait pour lui — des confettis offerts, son prénom changé, un merci pour ses signalements —, dit une fois. */}
        <AnnoncesDeLAdministrateur profileId={profil.id} prenom={profil.name} annonces={'annonces' in profil ? profil.annonces : undefined} />
        {/* « À la une » et les missions du jour, sous soi : un bandeau fin et une ligne, au-dessus des gros boutons (la maquette C). */}
        {leHaut === 'perdu' ? null : leHaut ? (
          <leHaut.HautDeLAccueil boutique={'boutique' in profil ? profil.boutique : undefined} />
        ) : (
          <div className="haut-en-chemin" aria-hidden="true" />
        )}
        <AccueilJouer
          enCours={enCours}
          onRejoindre={() => setRejoindre(true)}
          lendemain={lendemain}
          jour={profil.jour}
          aujourdhui={'aujourdhui' in profil ? profil.aujourdhui : undefined}
          campagne={'campagne' in profil ? profil.campagne : undefined}
          duels={'duels' in profil ? profil.duels : undefined}
          etats={boutonsDesPages()}
        />
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
            acheterCompagnon={acheterCompagnon}
            acheterFond={acheterFond}
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

  // ── Le profil : un écran ouvert depuis son bouton ──
  if (ecran) {
    const e = ECRANS.find(x => x.id === ecran)!
    // « ← » dit où il ramène : l'écran d'où l'on vient — une pièce de la
    // loge, c'est « M'habiller » —, sinon le profil.
    const depuis = ECRANS.find(x => x.id === history.state?.[DEPUIS])
    const sortie = (
      <a
        className="lien-discret jour-sortie"
        href={depuis ? `#${depuis.id}` : '/profil'}
        onClick={ev => {
          if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return
          ev.preventDefault()
          quitter(revenir)
        }}
      >
        <Icon name="arrow-left" />
        {depuis ? (depuis.groupe === 'M’habiller' ? 'M’habiller' : depuis.nom) : 'Mon profil'}
      </a>
    )
    // La loge : tout ce qu'on porte, sur son écran — la pièce de l'adresse
    // ouverte. Sa carte et sa rangée paraissent avec le profil
    // (`LogeEnChemin`) ; le panneau de la pièce, avec les écrans.
    if (e.groupe === 'M’habiller') {
      return (
        <div className="player-shell loge-page" onClick={surLaLoge}>
          <header className="loge-tete">
            {sortie}
            <h1>M’habiller</h1>
          </header>
          {regionDAnnonce}
          {pret ? (
            <pret.PanneauLoge profil={profil} piece={ecran as PieceDeLaLoge} onPiece={changerDePiece} busy={busy} enregistrer={enregistrer} erreur={erreur} onVus={retenirLesVusDeLaLoge} garde={gardeDeLaLoge} />
          ) : (
            <LogeEnChemin profil={profil} piece={ecran as PieceDeLaLoge} onPiece={changerDePiece} onOuvrir={ouvrirLaCarte} attente={enChemin} />
          )}
          {/* Sa carte, touchée avant que la loge n'ait ses panneaux : rien n'y est encore à l'essai. La loge arrivée ouvre la sienne. */}
          {carteOuverte && laCarte && laCarte !== 'perdu' && <laCarte.CarteJoueur adresse="/api/joueur/carte" onFermer={() => setCarteOuverte(false)} />}
          {erreur && <p className="error">{erreur}</p>}
          {menu('profil')}
        </div>
      )
    }
    return (
      <div className="player-shell" onClick={suivreUnLien}>
        {sortie}
        <PieceTete piece={e.groupe} titre={e.nom} />
        {regionDAnnonce}
        {ecran === 'collection' && (pret ? <pret.PanneauCollection profil={profil} /> : enChemin)}
        {ecran === 'carriere' && (pret ? <pret.PanneauCarriere profil={profil} /> : enChemin)}
        {ecran === 'soirees' && (pret ? <pret.PanneauSoirees profil={profil} monEspace={espace?.slug} /> : enChemin)}
        {erreur && <p className="error">{erreur}</p>}
        {menu('profil')}
      </div>
    )
  }

  // ── Le profil : qui l'on est, puis quatre boutons ──
  // Épuré (le souhait du propriétaire du 12 octobre 2026 : « un bouton pour
  // s'habiller, collection, soirée et carrière ») : la loge, posée sur la
  // page le même jour, faisait défiler toute sa grille d'avatars avant la
  // collection ; avant elle, le vestiaire y étalait sa carte, son thème et
  // sa gerbe. Elle a repris son écran, derrière « M'habiller ».
  const precision = profil.fiche.precision !== null ? Math.round(profil.fiche.precision * 100) : null
  // Le total de sa collection et ce que la loge a de nouveau viennent avec
  // les écrans (`apercusDesTuiles`) : leurs catalogues alourdissaient
  // l'accueil, qui partage ce fichier.
  const plus = pret?.apercusDesTuiles(profil)
  const pieceNeuve = plus ? premierePieceNeuve(plus.nouveautes) : null
  return (
    <div className="player-shell" onClick={suivreUnLien}>
      <h1 className="sr-only">Mon profil</h1>
      {/* Soi-même en tête, comme à l'accueil : un toucher ouvre sa carte, comme la salle l'ouvre en touchant son nom. */}
      <IdentiteLigne profil={profil} onCarte={() => setCarteOuverte(true)} />
      {carteOuverte && laCarte && laCarte !== 'perdu' && <laCarte.CarteJoueur adresse="/api/joueur/carte" onFermer={() => setCarteOuverte(false)} />}
      {/* Il a gagné hier — ou le défi de la semaine passée : sa page le lui dit, comme la salle le voit. */}
      {profil.laurier && (
        <p className="carte-laurier">
          <Laurier laurier={profil.laurier} decoratif /> {profil.laurier === 'argent' ? 'Vainqueur du défi de la semaine dernière' : 'Vainqueur du quiz du jour d’hier'}
        </p>
      )}
      {regionDAnnonce}

      <div className="profil-boutons">
        {/* Ce qu'il a de neuf à porter, compté en rouge comme les défis reçus (le souhait du propriétaire du
            14 octobre 2026) — la pastille dorée « Nouveau » se fondait parmi les autres —, et la loge
            s'ouvre sur la première pièce qui en a. */}
        <GrosBouton
          icone={<Icon name="hanger" />}
          titre="M’habiller"
          detail="Avatar, titre, vitrine, fond, thème, gerbe"
          compteur={plus && plus.nouveautes.nouveautes > 0 ? { n: plus.nouveautes.nouveautes, label: nouveautesAPorter(plus.nouveautes.nouveautes) } : undefined}
          onClick={() => ouvrir(pieceNeuve ?? 'avatar')}
        />
        <GrosBouton
          icone={<Icon name="award" />}
          titre="Ma collection"
          jauge={plus ? plus.collection.acquis / Math.max(1, plus.collection.total) : 0}
          compte={plus && `${formatNumber(plus.collection.acquis)} sur ${formatNumber(plus.collection.total)}`}
          detail="Avatars, thèmes, trophées — et où gagner le reste"
          onClick={() => ouvrir('collection')}
        />
        <GrosBouton
          icone={<Icon name="book" />}
          titre="Mes soirées"
          detail={profil.soirees.length === 0 ? 'Aucune encore' : `${profil.soirees.length} soirée${profil.soirees.length > 1 ? 's' : ''}, jouées ou animées`}
          onClick={() => ouvrir('soirees')}
        />
        <GrosBouton
          icone={<Icon name="bar-chart" />}
          titre="Ma carrière"
          detail={precision !== null ? `Précision ${precision} % · tes courbes` : 'Tes chiffres, tes courbes'}
          onClick={() => ouvrir('carriere')}
        />
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
 * Les écrans du profil, chacun derrière son bouton : la loge — « M'habiller »,
 * une adresse par pièce (`#titre`) —, « Ma collection », « Mes soirées »,
 * « Ma carrière ». Les onglets d'avant tenaient tout sur trois pages qu'on
 * faisait défiler ; puis cinq tuiles mêlaient ce qu'on porte et ce qu'on
 * collectionne ; puis « Ma carte » rangeait titre, vitrine et fond sur un
 * seul écran ; puis chaque pièce eut sa page (le 11 octobre 2026), qu'on
 * quittait et rouvrait pour changer d'avatar puis de titre ; puis la loge,
 * où les six se touchent sur une rangée et s'essaient avant de se porter (la
 * maquette validée par le propriétaire le 12 octobre 2026), ouverte d'un
 * vestiaire, puis posée sur la page du profil, puis, le même jour, rendue à
 * son écran derrière un bouton : la page du profil, épurée, n'a plus que ses
 * quatre boutons. La boutique a sa page, dans le menu.
 */
type EcranDuProfil = PieceDeLaLoge | 'collection' | 'carriere' | 'soirees'

const ECRANS: { id: EcranDuProfil; nom: string; groupe: 'M’habiller' | 'Mon profil' }[] = [
  { id: 'avatar', nom: 'Mon avatar', groupe: 'M’habiller' },
  { id: 'titre', nom: 'Mon titre', groupe: 'M’habiller' },
  { id: 'vitrine', nom: 'Ma vitrine', groupe: 'M’habiller' },
  { id: 'fond', nom: 'Mon fond de carte', groupe: 'M’habiller' },
  { id: 'theme', nom: 'Mon thème', groupe: 'M’habiller' },
  { id: 'gerbe', nom: 'Ma gerbe', groupe: 'M’habiller' },
  { id: 'collection', nom: 'Ma collection', groupe: 'Mon profil' },
  { id: 'carriere', nom: 'Ma carrière', groupe: 'Mon profil' },
  { id: 'soirees', nom: 'Mes soirées', groupe: 'Mon profil' },
]

/** Cet écran est-il une pièce de la loge (`#avatar`, `#titre`…) ? En passer de l'une à l'autre ne la quitte pas. */
function dansLaLoge(e: EcranDuProfil | null): boolean {
  return !!e && ECRANS.find(x => x.id === e)?.groupe === 'M’habiller'
}

/** La page que sert la vue : l'accueil (`/`), le profil (`/profil`), la boutique (`/boutique`). */
const VUE: 'accueil' | 'profil' | 'boutique' =
  route.kind === 'account' && route.page === 'boutique' ? 'boutique' : route.kind === 'account' && route.page === 'profil' ? 'profil' : 'accueil'

/** L'écran d'où l'on a ouvert celui-ci, gardé dans l'historique — null : les tuiles. « ← » y revient d'un cran. */
const DEPUIS = 'fiestappProfilDepuis'

/**
 * Les adresses d'avant mènent à la page qui les a reprises — un onglet,
 * « Mes avatars », les réglages de « Mon style », les trophées, les parties
 * de « Ma carte ». « Mon style » (`#style`) et « Ma carte » (`#carte`)
 * eux-mêmes ouvrent le profil, d'où « M'habiller » mène à la loge.
 */
const ANCIENNES: Record<string, EcranDuProfil> = {
  apparence: 'avatar',
  avatars: 'avatar',
  'style-finition': 'avatar',
  'style-titre': 'titre',
  'style-fond': 'fond',
  'style-gerbe': 'gerbe',
  'style-theme': 'theme',
  'carte-titre': 'titre',
  'carte-vitrine': 'vitrine',
  'carte-fond': 'fond',
  trophees: 'collection',
}

/** L'écran d'une adresse (`trophees`, `collection-themes`), ou rien : les tuiles. */
function ecranDe(h: string): EcranDuProfil | null {
  // Une ligne de la collection a son adresse : c'est l'écran de la collection.
  if (h.startsWith('collection-')) return 'collection'
  return ECRANS.find(e => e.id === h)?.id ?? ANCIENNES[h] ?? null
}

/** L'écran de l'adresse (`/profil#collection`), ou les tuiles. */
function lireEcran(): EcranDuProfil | null {
  if (VUE !== 'profil') return null
  return ecranDe(window.location.hash.slice(1))
}

// Sans attendre la réponse du profil : les onglets arrivent avec elle, pas
// un aller-retour après. La boutique ne se montre pas sans eux, ni le compte
// de la collection sur le profil, ni ses écrans, qu'on y ouvre d'un toucher :
// sur un appareil neuf, ils attendaient la réponse du profil pour les
// demander, un tour de plus, 0,2 s en 4G. Posé ici, après `VUE`. Jamais sur
// l'accueil, qui n'en montre rien : ils y viennent en fond, une fois montré.
if (VUE === 'boutique' || VUE === 'profil') void panneaux.charger().catch(() => {})

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

