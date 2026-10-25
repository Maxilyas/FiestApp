import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { ApiError, UnauthorizedError, api, motifDe } from '../api'
import { resetClock } from '../clock'
import { confirmDialog } from '../components/Dialog'
import { PieceTete, Sortie } from '../components/Pieces'
import { rendreLeFocus } from '../focus'
import { espacesFines } from '../format'
import { porterGerbe } from '../gerbe'
import { porterNiche } from '../niche'
import { retenirLeNiveau } from '../niveauVu'
import { showToast, useAppState } from '../state'
import { porterTheme } from '../themeJoueur'
import { arreterLEcho, toucher } from '../toucher'
import { JEUX, type CleDeJeu } from '../../../shared/cabinet/jeux/regle'
import { poussieresDites, type DemandeDeDepart } from '../../../shared/cabinet/musee'
import { oeuvre as oeuvreDe } from '../../../shared/cabinet/oeuvres'
import type { Manche } from '../../../shared/cabinet/partie'
import { fondreLesReveils, type MursDuCabinet, type PageDuCabinet, type ReveilDesGardiens, type VueDeLaPartie } from '../../../shared/cabinet/vues'
import { Annonce, annonceDe, estLaPartieDemandee } from './cabinet/Annonce'
import { cartelArrive, cartelDemande, cartelsQuiTiennent, sansLesPerdus, type EtatDuCartel } from './cabinet/Cartel'
import {
  RetourAuMusee,
  adresseDe,
  ecranDeLAdresse,
  effacerLaMarqueAuChargement,
  memeEcran,
  partieDansLEntree,
  poserLEntreeDeLaPartie,
  quitterVersLeMusee,
  type EcranDuMusee,
  type PartieDemandee,
} from './cabinet/ecrans'
import { Gardiens } from './cabinet/Gardiens'
import { Musee, enDebutDeLigne } from './cabinet/Musee'
import type { LesMurs } from './cabinet/Murs'
import { Oeuvre, oeuvreDeLaPage } from './cabinet/Oeuvre'
import { Partie, ecranDuJeu } from './cabinet/Partie'
import { FeuilleDesRegles } from './cabinet/Regles'
import { Salle } from './cabinet/Salle'
import { JouerLibrement, Visite } from './cabinet/Visite'
import { carteRetenue, reglesLues, retenirLaCarte, retenirLesRegles } from './cabinet/retenu'

// La page du Cabinet de curiosités (`/cabinet`) : le musée et ses écrans —
// une salle, une œuvre et son cartel, les gardiens, la visite du jour, les
// jeux libres, tes murs —, chacun à son fragment (`cabinet/ecrans.ts`), et ce que la
// page y fait : retenir sa carte-bonus, acheter une œuvre, dorer un cadre,
// changer un jeu de la visite. Tout ce qu'elle montre vient de la page du
// serveur (`GET /api/cabinet`, demandée d'emblée — l'adresse préchargée avec
// la page), et chaque refus se dit dans les mots du serveur.
//
// La partie a ses écrans à part, par-dessus l'écran d'où elle part, sur une
// entrée d'historique à elle (`cabinet/ecrans.ts`) : l'annonce, qui ne
// consomme rien — tout part à « Commencer » (`cabinet/Annonce.tsx`) —, puis
// ses manches et son bilan (`cabinet/Partie.tsx`). Un jeu que le serveur
// livre avant que la page n'ait son écran s'annonce sans « Commencer »
// (`AnnonceEnAttente`).
//
// Un gardien qu'une dépense réveille — l'achat qui complète une salle, la
// dorure du dernier cadre —, ou que la partie d'hier close par le serveur a
// réveillé, la page qui revient le porte, une fois (`PageDuCabinet.reveil`) :
// la page le garde jusqu'à ce qu'on l'ait lu, et l'annonce en grand par-dessus
// l'écran, jamais par-dessus une partie (`Reveil.tsx`, à la demande : rare,
// ses cartes font venir de quoi dessiner un médaillon).

/** L'annonce d'un gardien qui s'éveille, à la demande. */
const LE_REVEIL = aLaDemande(() => import('./cabinet/Reveil'))

/**
 * La luciole qu'une page dit venue — l'achat ou la dorure qui complète une
 * première salle, la partie d'hier close par le serveur — s'installe dans la
 * niche de la page : la feuille le promet (« en haut de chaque page »), et le
 * profil lu au montage ne l'avait pas encore. Le serveur l'a déjà installée
 * dans une niche vide (`offrirUnCompagnon`) ; la page relit le profil léger,
 * comme une fin de partie, et rien d'autre ne le fait relire.
 */
export function nicheApresLeReveil(p: Pick<PageDuCabinet, 'reveil'>): Promise<void> {
  if (!p.reveil?.compagnon) return Promise.resolve()
  return api.joueur.moiLeger().then(
    moi => porterNiche(moi.profile),
    () => {},
  )
}

/** Le dessin de tes murs, à la demande : leur carte de France et leur frise ne servent qu'à qui les ouvre. */
const LES_MURS = aLaDemande(() => import('./cabinet/Murs'))

/** Ce que la page sait de tes murs : demandés au serveur, lus, ou perdus en route. */
export type EtatDesMurs = { etat: 'chargement' } | { etat: 'lus'; murs: MursDuCabinet } | { etat: 'perdu'; motif: string }

/**
 * Tes murs à l'écran (`#murs`) — pur : la sortie, le titre, ce qu'ils sont,
 * puis ce qui est venu — les murs que le serveur dit, et leur dessin
 * (`Murs.tsx`, à la demande). Un seul cadre, quoi qu'il soit venu : rendu à
 * part pour l'attente, il était remplacé à l'arrivée du dessin, et son titre
 * emportait le focus que la page venait d'y poser (`rendreLeFocus`) — le
 * lecteur d'écran perdait sa place. Le dessin perdu en route, la page le dit :
 * rien n'y est perdu, les murs se dérivent du journal.
 */
export function EcranDesMurs({ etat, dessin, onRelire }: { etat: EtatDesMurs; dessin: typeof LesMurs | null | 'perdu'; onRelire?: () => void }) {
  const auMusee = useContext(RetourAuMusee)
  const Dessin = dessin === 'perdu' ? null : dessin
  return (
    <div className="player-shell cab-page cab-murs">
      <Sortie vers="Le Cabinet" href="/cabinet" onClick={auMusee} />
      <PieceTete piece="Le Cabinet de curiosités" titre="Tes murs" />
      <p className="cab-ligne">{espacesFines('Ce que tes parties t’ont appris trouve sa place ici : un lieu sur ta carte de France, une date sur ta frise.')}</p>
      {dessin === 'perdu' ? (
        <p className="error">{espacesFines('Tes murs ne se sont pas chargés : recharge la page.')}</p>
      ) : etat.etat === 'perdu' ? (
        <>
          <p className="error">{espacesFines(etat.motif)}</p>
          {onRelire && (
            <button type="button" className="btn btn-block" {...toucher(onRelire)}>
              Réessayer
            </button>
          )}
        </>
      ) : etat.etat === 'lus' && Dessin ? (
        <Dessin murs={etat.murs} />
      ) : (
        <p className="cab-ligne" aria-busy="true">
          Chargement…
        </p>
      )}
    </div>
  )
}

/** Tes murs, demandés au serveur à chaque visite — une partie finie entre deux y a posé un lieu ou des dates —, avec leur dessin. */
function MursALaDemande() {
  // Le module, jamais son composant seul : une fonction rangée dans un état se jouerait comme sa mise à jour.
  const charge = useALaDemande(LES_MURS)
  const dessin = charge && charge !== 'perdu' ? charge.LesMurs : charge
  const [etat, setEtat] = useState<EtatDesMurs>({ etat: 'chargement' })
  // Chaque demande a son numéro : seule la dernière se range — « Réessayer » touché deux fois, ou l'écran déjà quitté.
  const demande = useRef(0)
  const lire = useCallback(() => {
    const n = ++demande.current
    setEtat({ etat: 'chargement' })
    api.cabinet.murs().then(
      murs => n === demande.current && setEtat({ etat: 'lus', murs }),
      (e: unknown) => n === demande.current && setEtat({ etat: 'perdu', motif: motifDe(e) }),
    )
  }, [])
  // Demandés à l'ouverture, en même temps que leur dessin : l'un n'attend pas l'autre.
  useEffect(() => {
    lire()
    return () => {
      demande.current++
    }
  }, [lire])
  return <EcranDesMurs etat={etat} dessin={dessin} onRelire={lire} />
}

/** Le réveil à dire, quand son écran est venu ; perdu en route, il se tait — la page des gardiens le montre réveillé. */
function ReveilALaDemande({ reveil, onFermer }: { reveil: ReveilDesGardiens; onFermer: () => void }) {
  const ecran = useALaDemande(LE_REVEIL)
  if (!ecran || ecran === 'perdu') return null
  return <ecran.AnnonceDuReveil reveil={reveil} onFermer={onFermer} />
}

type Etat = { e: 'chargement' } | { e: 'anonyme' | 'bientot' | 'erreur'; motif: string } | { e: 'pret'; page: PageDuCabinet }

/** Une partie demandée, à son annonce ; ou celle qui se joue — commencée, ou reprise du musée. */
type EnPartie = { e: 'annonce'; partie: PartieDemandee } | { e: 'jeu'; vue: VueDeLaPartie }

/** Ce qui se lit de la page sans profil, ou là où le Cabinet n'ouvre pas : la phrase du serveur, et comment entrer. */
export function EcranSansMusee({ sorte, motif }: { sorte: 'anonyme' | 'bientot' | 'erreur'; motif: string }) {
  const retour = encodeURIComponent('/cabinet')
  return (
    <div className="player-shell cab-page">
      <Sortie />
      <PieceTete piece="Seul" titre="Le Cabinet de curiosités" />
      <p className={sorte === 'erreur' ? 'error' : 'cab-ligne'}>{espacesFines(motif)}</p>
      {/* Le chemin anonyme reste la valeur de l'application : se connecter ouvre son musée, sans rien fermer ailleurs. */}
      {sorte === 'anonyme' && (
        <>
          <p className="cab-ligne">{espacesFines('Ton musée vit avec ton profil : les œuvres que tu gagnes y restent.')}</p>
          <a className="btn btn-primary btn-big btn-block" href={`/?next=${retour}`}>
            Me connecter
          </a>
          <a className="btn btn-block" href={`/?creer=1&next=${retour}`}>
            Créer mon profil
          </a>
        </>
      )}
    </div>
  )
}

/**
 * Une partie d'un jeu dont la page n'a pas encore l'écran (`ecranDuJeu`) :
 * son jeu, ce qu'elle met en jeu, et rien de consommé — sans « Commencer ».
 * Reprise, elle attend où il l'a laissée : le serveur la clora le lendemain.
 */
export function AnnonceEnAttente({ jeu, enJeu, reprise, onRetour }: { jeu: CleDeJeu; enJeu: string | null; reprise?: boolean; onRetour: () => void }) {
  const j = JEUX[jeu]
  return (
    <div className="player-shell cab-page">
      <Sortie vers="Le Cabinet" href="/cabinet" onClick={onRetour} />
      <PieceTete piece={reprise ? 'Ta partie en cours' : enJeu ? espacesFines(enJeu) : 'Partie libre'} titre={j.nom} />
      <p className="cab-ligne">{espacesFines(j.geste)}</p>
      <p className="cab-ligne">{espacesFines(enDebutDeLigne(j.bareme))}</p>
      <p className="cab-raison">
        {espacesFines(reprise ? 'Ses écrans arrivent ici très bientôt : elle t’attend où tu l’as laissée.' : 'Ce jeu s’ouvre ici très bientôt : rien n’est encore joué.')}
      </p>
    </div>
  )
}

export function CabinetApp() {
  const [etat, setEtat] = useState<Etat>({ e: 'chargement' })
  const [ecran, setEcranBrut] = useState<EcranDuMusee>(() => ecranDeLAdresse(window.location.hash))
  const [enPartie, setEnPartie] = useState<EnPartie | null>(null)
  const [regles, setRegles] = useState(false)
  const [busy, setBusy] = useState(false)
  // Ce que le téléphone retient se lit au profil (`retenu.ts`), connu avec le profil léger, avant que le musée paraisse.
  // Sans lui, rien ne se retient, et ce qui ne se dit qu'une fois se tait : redit à chaque visite, il lasserait.
  const [profil, setProfil] = useState<string | null>(null)
  const [carte, setCarte] = useState<string | null>(null)
  const [bienvenue, setBienvenue] = useState(false)
  const [cartels, setCartels] = useState<Record<string, EtatDuCartel>>({})
  // Chaque demande de cartel a son numéro : seule celle qu'une place attend encore s'y range (`cartelArrive`).
  const demandesDeCartel = useRef(0)
  /**
   * Ce qu'une partie fait à une œuvre change son cartel — dorée ou doublée en jouant, il prend une manche de sa partie — sans que
   * la page le voie toujours : un double ne change ni `possedee` ni `doree`. Finie ici, la partie les fait tous oublier, et
   * l'œuvre ouverte redemande le sien ; un achat, une dorure, ce qui a changé ailleurs, la page neuve le dit
   * (`cartelsQuiTiennent`).
   */
  const oublierLesCartels = useCallback(() => setCartels({}), [])
  const { toast } = useAppState()
  const page = etat.e === 'pret' ? etat.page : null
  // Ce qu'une page a dit s'éveiller, gardé jusqu'à ce qu'on l'ait lu : la page suivante — le retour au premier plan, un geste — ne
  // le porte plus, le serveur ne le dit qu'une fois.
  const [reveil, setReveil] = useState<ReveilDesGardiens | null>(null)

  /** Une page neuve du serveur : elle prend la place de l'autre, ce qu'elle dit s'éveiller attend d'être lu, et la luciole entre dans sa niche. */
  const recevoir = useCallback((p: PageDuCabinet) => {
    setEtat({ e: 'pret', page: p })
    if (p.reveil) setReveil(r => fondreLesReveils(r, p.reveil) ?? null)
    void nicheApresLeReveil(p)
  }, [])

  /** La page lue, ou ce qu'en dit le refus : sans profil, fermé ici, ou une panne. */
  const lirePage = useCallback((lue: Promise<PageDuCabinet>) => {
    lue.then(
      p => recevoir(p),
      (e: unknown) => {
        if (e instanceof UnauthorizedError) setEtat({ e: 'anonyme', motif: e.message })
        else if (e instanceof ApiError && e.statut === 404) setEtat({ e: 'bientot', motif: e.message })
        else setEtat(avant => (avant.e === 'pret' ? avant : { e: 'erreur', motif: motifDe(e) }))
      },
    )
  }, [recevoir])
  const relire = useCallback(() => lirePage(api.cabinet.page()), [lirePage])

  useEffect(() => {
    // Demandée d'emblée, à l'adresse même que la page servie a préchargée (`DEPART.cabinet`), pour tout visiteur.
    const premiere = api.cabinet.page()
    premiere.catch(() => {})
    let vivant = true
    ;(async () => {
      try {
        const moi = await api.joueur.moiLeger()
        if (!vivant) return
        // Le thème de son profil habille la page, comme la campagne ; sa gerbe éclatera à ses bonnes réponses ; son compagnon, dans sa niche.
        void porterTheme(moi.profile?.theme)
        porterGerbe(moi.profile?.gerbe)
        porterNiche(moi.profile)
        // Le niveau d'où part la visite : le premier bilan dit la montée qu'il a faite en s'y comparant — sans lui, il la taisait.
        retenirLeNiveau(moi.profile?.niveau)
        const id = moi.profile?.id
        if (id) {
          setProfil(id)
          setCarte(carteRetenue(id))
          setBienvenue(!reglesLues(id))
        }
      } catch {
        // Sans le profil léger, le musée s'ouvre quand même : le thème attendra.
      }
      if (vivant) lirePage(premiere)
    })()
    return () => {
      vivant = false
    }
  }, [lirePage])

  // Le fragment dit l'écran : un lien vers `#salle-rempart`, le retour du navigateur, tout passe par lui. Une partie
  // ouverte par-dessus a son entrée d'historique (`poserLEntreeDeLaPartie`) : un retour qui la quitte la ferme.
  const enPartieRef = useRef(enPartie)
  enPartieRef.current = enPartie
  useEffect(() => {
    effacerLaMarqueAuChargement(window.history)
    const suivre = () => {
      // Fermée par le retour en pleine partie, elle continue sans cet écran — une pause laissée sous « Quitter ? », une manche qui
      // court à son échéance — : la page se relit, et « Reprendre » la rouvre telle qu'elle est, pas telle qu'au départ.
      if (enPartieRef.current?.e === 'jeu' && !partieDansLEntree(window.history.state)) relire()
      if (!partieDansLEntree(window.history.state)) setEnPartie(null)
      setEcranBrut(avant => {
        const neuf = ecranDeLAdresse(window.location.hash)
        return memeEcran(avant, neuf) ? avant : neuf
      })
    }
    window.addEventListener('hashchange', suivre)
    window.addEventListener('popstate', suivre)
    return () => {
      window.removeEventListener('hashchange', suivre)
      window.removeEventListener('popstate', suivre)
    }
  }, [])

  // Un geste du Cabinet change l'écran au lever du doigt (`toucher`) — « Revenir au musée », une réponse, « Quitter » — : le
  // `click` qui le suit tombe sur ce qui vient sous le doigt, une tuile du musée, un lien, et ne doit rien y jouer. Arrêté à la
  // capture du document, avant React et avant le lien (`arreterLEcho`).
  useEffect(() => {
    document.addEventListener('click', arreterLEcho, true)
    return () => document.removeEventListener('click', arreterLEcho, true)
  }, [])

  // Au retour au premier plan, l'horloge repart de zéro — un téléphone endormi a pu dériver — et la page se relit :
  // minuit a pu passer, une partie d'hier se clore, un autre onglet jouer (invariant 6).
  useEffect(() => {
    const auRetour = () => {
      if (document.visibilityState === 'visible') {
        resetClock()
        relire()
      }
    }
    document.addEventListener('visibilitychange', auRetour)
    return () => document.removeEventListener('visibilitychange', auRetour)
  }, [relire])

  // Chaque écran commence en haut, et le focus perdu avec l'écran quitté revient à son titre, sans défiler — dans une partie, la
  // question de sa manche (`.cab-question`), ou la mise (`h2`) : « Commencer » disparu, il tombait sur la page, faute d'un `h1`.
  const precedent = useRef<string | null>(null)
  const cleDEcran = enPartie ? `partie:${enPartie.e}` : (adresseDe(ecran) || 'musee')
  useEffect(() => {
    if (precedent.current === cleDEcran || etat.e !== 'pret') return
    const premiereFois = precedent.current === null
    precedent.current = cleDEcran
    // Le premier écran garde où le navigateur l'a posé : un rechargement en bas d'une salle y reste.
    if (premiereFois) return
    window.scrollTo(0, 0)
    rendreLeFocus(document.querySelector('.cab-page'), ['.cab-question', 'h1', 'h2'])
  }, [cleDEcran, etat.e])

  // Le cartel d'une œuvre à lui, demandé quand on l'ouvre, une fois — jusqu'à ce qu'une partie finie ou une page neuve le fasse
  // oublier : la peinture s'ouvre sans l'attendre.
  const oeuvreOuverte = ecran.e === 'oeuvre' && page ? oeuvreDeLaPage(page, ecran.oeuvre) : null
  const aSonCartel = oeuvreOuverte?.oeuvre.possedee ? oeuvreOuverte.oeuvre.cle : null
  // Chaque page neuve — d'un achat, d'une dorure, du retour au premier plan — dit ce qui a changé, ici ou ailleurs : les cartels
  // qu'elle dément s'oublient (`cartelsQuiTiennent`). Avant la demande de l'œuvre ouverte, qui part alors sous la page neuve.
  const pageDesCartels = useRef<PageDuCabinet | null>(null)
  useEffect(() => {
    if (!page) return
    const avant = pageDesCartels.current
    pageDesCartels.current = page
    setCartels(c => cartelsQuiTiennent(c, avant, page))
  }, [page])
  // Un cartel perdu se redemande quand on rouvre une œuvre, et à chaque page relue (le retour au premier plan, un échange).
  useEffect(() => {
    setCartels(sansLesPerdus)
  }, [aSonCartel, page])
  useEffect(() => {
    if (!aSonCartel || cartels[aSonCartel]) return
    const demande = ++demandesDeCartel.current
    setCartels(c => cartelDemande(c, aSonCartel, demande))
    api.cabinet.oeuvre(aSonCartel).then(
      cartel => setCartels(c => cartelArrive(c, aSonCartel, demande, { etat: 'lu', cartel })),
      (e: unknown) => setCartels(c => cartelArrive(c, aSonCartel, demande, { etat: 'perdu', motif: motifDe(e) })),
    )
  }, [aSonCartel, cartels])

  /** « ← Le Cabinet » : le musée, sans recharger la page, et le retour du navigateur ramène où l'on était. */
  const versLeMusee = useCallback(() => {
    quitterVersLeMusee(window.history, window.location.hash)
    setEnPartie(null)
    setEcranBrut({ e: 'musee' })
  }, [])

  /** Une partie demandée ou reprise, par-dessus l'écran : son entrée d'historique, que le retour du navigateur consomme. */
  const ouvrir = (partie: EnPartie) => {
    poserLEntreeDeLaPartie(window.history)
    setEnPartie(partie)
  }
  const jouer = (partie: PartieDemandee) => ouvrir({ e: 'annonce', partie })

  /**
   * Un geste qui écrit — un achat, une dorure, un échange — : la page d'après, sinon le refus du serveur et la page relue. Ce
   * que la dépense change au cartel de son œuvre, la page neuve le dit (`cartelsQuiTiennent`) — refusée aussi : « Son cadre est
   * déjà doré » dit qu'elle a changé ailleurs, et la page relue le montre.
   */
  const ecrire = async (geste: () => Promise<PageDuCabinet>, reussi: string) => {
    if (busy) return
    setBusy(true)
    try {
      recevoir(await geste())
      showToast({ kind: 'info', message: reussi })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
      relire()
    } finally {
      setBusy(false)
    }
  }

  const acheter = async (cle: string, prix: number) => {
    const nom = oeuvreDe(cle)?.nom ?? 'cette œuvre'
    const oui = await confirmDialog({ title: 'Acheter cette œuvre ?', message: `Elle coûte ${poussieresDites(prix)}.`, confirmLabel: 'L’acheter' })
    if (oui) await ecrire(() => api.cabinet.acheter(cle, prix), `${nom} entre dans ton musée`)
  }
  const dorer = async (cle: string, prix: number) => {
    const nom = oeuvreDe(cle)?.nom ?? 'Cette œuvre'
    const oui = await confirmDialog({ title: 'Dorer son cadre ?', message: `La dorure coûte ${poussieresDites(prix)}.`, confirmLabel: 'La dorer' })
    if (oui) await ecrire(() => api.cabinet.dorer(cle, prix), `${nom} prend son cadre doré`)
  }
  const echanger = (k: Manche) => ecrire(() => api.cabinet.echanger(k), 'Le jeu de cette partie a changé')

  /** « Commencer » : la partie part avec sa carte-bonus, et sa première manche s'ouvre ; refusée, le serveur dit pourquoi, et la page se relit. */
  const commencer = async (demande: PartieDemandee, carteChoisie: string | null) => {
    if (busy) return
    const jeu = page ? annonceDe(page, demande)?.jeu : undefined
    setBusy(true)
    try {
      const vue = await api.cabinet.commencer({ ...demande, carte: carteChoisie } as DemandeDeDepart)
      // Sur une entrée marquée, même si le retour a fermé l'annonce pendant la requête : la partie est partie, son chrono court,
      // et posée sur l'écran d'en dessous, le retour suivant la fermait sans rien demander pendant que sa garde posait « Quitter ? ».
      ouvrir({ e: 'jeu', vue })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
      // La réponse perdue en route a pu laisser la partie commencée, sa première manche ouverte — et « Commencer » se refusait
      // désormais : la page relue la trouve, et la partie demandée s'ouvre.
      const lue = api.cabinet.page()
      lirePage(lue)
      const attend = (await lue.catch(() => null))?.enCours
      if (attend && jeu && estLaPartieDemandee(attend, demande, jeu)) ouvrir({ e: 'jeu', vue: attend })
    } finally {
      setBusy(false)
    }
  }
  /** Le musée, après une partie ou entre deux manches : la page se relit — la poussière, l'œuvre gagnée, la partie qui l'attend. */
  const revenirDeLaPartie = () => {
    relire()
    versLeMusee()
  }
  const choisirLaCarte = (cle: string | null) => {
    if (profil) retenirLaCarte(profil, cle)
    setCarte(cle)
  }
  /** « C'est parti » : la bienvenue ne se redit plus, comme les règles lues. */
  const bienvenueLue = () => {
    if (profil) retenirLesRegles(profil)
    setBienvenue(false)
  }
  const ouvrirLesRegles = () => {
    setRegles(true)
    // Lues une fois, la bienvenue n'a plus à les proposer.
    bienvenueLue()
  }

  // Le toast, rendu par la page elle-même, en bas de l'écran (aucune réponse à y cacher) : l'Expédition n'en rendait aucun, et ses
  // refus partaient en silence.
  const avecLeToast = (contenu: ReactNode) => (
    <RetourAuMusee.Provider value={versLeMusee}>
      {contenu}
      {regles && page && <FeuilleDesRegles jeux={page.jeux} parties={page.visite.cases.length} onFermer={() => setRegles(false)} />}
      {/* Jamais par-dessus une partie : le chrono y courrait sous la feuille. Il attend le musée. */}
      {reveil && !enPartie && <ReveilALaDemande reveil={reveil} onFermer={() => setReveil(null)} />}
      {toast && (
        <div className={`toast toast-${toast.kind} cab-toast`} role={toast.kind === 'error' ? 'alert' : 'status'}>
          {espacesFines(toast.message)}
        </div>
      )}
    </RetourAuMusee.Provider>
  )

  if (etat.e === 'chargement') {
    return (
      <div className="player-shell cab-page" aria-busy="true">
        <Sortie />
        <PieceTete piece="Seul" titre="Le Cabinet de curiosités" />
        <p className="muted">Chargement…</p>
      </div>
    )
  }
  if (etat.e !== 'pret') return avecLeToast(<EcranSansMusee sorte={etat.e} motif={etat.motif} />)
  const p = etat.page

  if (enPartie?.e === 'jeu') {
    const vue = enPartie.vue
    if (!ecranDuJeu(vue.jeu)) return avecLeToast(<AnnonceEnAttente jeu={vue.jeu} enJeu={null} reprise onRetour={versLeMusee} />)
    return avecLeToast(
      <Partie
        key={vue.id}
        depart={vue}
        // La partie relue avec la page — au retour au premier plan, après un refus — : elle a pu continuer sans cet écran.
        relue={p.enCours?.id === vue.id ? p.enCours : null}
        onMusee={revenirDeLaPartie}
        onRelire={relire}
        // Finie, elle a pu gagner, dorer ou doubler une œuvre — celle d'une chasse partie de son écran, qu'un retour fait reparaître.
        onFinie={oublierLesCartels}
        onRejouer={vue.origine === 'libre' ? () => jouer({ origine: 'libre', jeu: vue.jeu }) : undefined}
      />,
    )
  }
  if (enPartie?.e === 'annonce') {
    const demande = enPartie.partie
    const a = annonceDe(p, demande)
    if (a && ecranDuJeu(a.jeu)) {
      return avecLeToast(
        <Annonce page={p} demande={demande} carte={carte} busy={busy} onCarte={choisirLaCarte} onCommencer={c => void commencer(demande, c)} onRetour={versLeMusee} />,
      )
    }
    if (a) return avecLeToast(<AnnonceEnAttente jeu={a.jeu} enJeu={a.enJeu} onRetour={versLeMusee} />)
  }

  switch (ecran.e) {
    case 'salle': {
      const s = p.salles.find(x => x.cle === ecran.salle)
      if (s) return avecLeToast(<Salle salle={s} page={p} />)
      break
    }
    case 'oeuvre':
      return avecLeToast(
        <Oeuvre
          page={p}
          cle={ecran.oeuvre}
          cartel={cartels[ecran.oeuvre] ?? { etat: 'chargement' }}
          carte={carte}
          busy={busy}
          onCarte={choisirLaCarte}
          onAcheter={(cle, prix) => void acheter(cle, prix)}
          onDorer={(cle, prix) => void dorer(cle, prix)}
          onJouer={jouer}
        />,
      )
    case 'gardiens':
      return avecLeToast(<Gardiens page={p} carte={carte} onCarte={choisirLaCarte} />)
    case 'visite':
      return avecLeToast(<Visite page={p} busy={busy} onJouer={jouer} onEchanger={k => void echanger(k)} />)
    case 'libre':
      return avecLeToast(<JouerLibrement page={p} onJouer={jouer} />)
    case 'murs':
      return avecLeToast(<MursALaDemande />)
  }
  return avecLeToast(
    <Musee
      page={p}
      bienvenue={bienvenue}
      onRegles={ouvrirLesRegles}
      onReprendre={() => p.enCours && ouvrir({ e: 'jeu', vue: p.enCours })}
      onBienvenueLue={bienvenueLue}
    />,
  )
}
