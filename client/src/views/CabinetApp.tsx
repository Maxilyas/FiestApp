import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, UnauthorizedError, api, motifDe } from '../api'
import { resetClock } from '../clock'
import { confirmDialog } from '../components/Dialog'
import { PieceTete, Sortie } from '../components/Pieces'
import { rendreLeFocus } from '../focus'
import { espacesFines } from '../format'
import { porterGerbe } from '../gerbe'
import { porterNiche } from '../niche'
import { showToast, useAppState } from '../state'
import { porterTheme } from '../themeJoueur'
import { CLES_DES_JEUX, JEUX, type CleDeJeu } from '../../../shared/cabinet/jeux/regle'
import { poussieresDites } from '../../../shared/cabinet/musee'
import { oeuvre as oeuvreDe } from '../../../shared/cabinet/oeuvres'
import type { Manche } from '../../../shared/cabinet/partie'
import type { PageDuCabinet, VueDeLaPartie } from '../../../shared/cabinet/vues'
import type { EtatDuCartel } from './cabinet/Cartel'
import { RetourAuMusee, adresseDe, ecranDeLAdresse, memeEcran, type EcranDuMusee, type PartieDemandee } from './cabinet/ecrans'
import { Gardiens } from './cabinet/Gardiens'
import { Musee, enDebutDeLigne } from './cabinet/Musee'
import { Oeuvre, oeuvreDeLaPage } from './cabinet/Oeuvre'
import { FeuilleDesRegles } from './cabinet/Regles'
import { Salle } from './cabinet/Salle'
import { JouerLibrement, Visite, enJeuDit } from './cabinet/Visite'
import { carteRetenue, rapporteesVues, reglesLues, retenirLaCarte, retenirLesRapportees, retenirLesRegles } from './cabinet/retenu'

// La page du Cabinet de curiosités (`/cabinet`) : le musée et ses écrans —
// une salle, une œuvre et son cartel, les gardiens, la visite du jour, les
// jeux libres —, chacun à son fragment (`cabinet/ecrans.ts`), et ce que la
// page y fait : retenir sa carte-bonus, acheter une œuvre, dorer un cadre,
// changer un jeu de la visite. Tout ce qu'elle montre vient de la page du
// serveur (`GET /api/cabinet`, demandée d'emblée — l'adresse préchargée avec
// la page), et chaque refus se dit dans les mots du serveur.
//
// La partie — l'annonce, les manches, le bilan — a ses écrans à part, qui ne
// sont pas encore là : un départ demandé ouvre son annonce en attente, qui ne
// consomme rien (rien ne coûte avant « Commencer »).

type Etat = { e: 'chargement' } | { e: 'anonyme' | 'bientot' | 'erreur'; motif: string } | { e: 'pret'; page: PageDuCabinet }

/** Une partie demandée, à son annonce ; ou celle qui l'attend, reprise. */
type EnPartie = { e: 'annonce'; partie: PartieDemandee } | { e: 'reprise'; vue: VueDeLaPartie }

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
 * Une partie demandée, en attendant ses écrans : son jeu, ce qu'elle met en
 * jeu, et rien de consommé — le départ ne part qu'à « Commencer », que
 * l'annonce portera avec la carte-bonus choisie.
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
        {espacesFines(reprise ? 'Ses écrans arrivent ici très bientôt : elle t’attend où tu l’as laissée.' : 'Les parties du Cabinet s’ouvrent ici très bientôt : rien n’est encore joué.')}
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
  const [carte, setCarte] = useState<string | null>(() => carteRetenue())
  const [accueil, setAccueil] = useState(() => ({ bienvenue: !reglesLues(), rapportees: rapporteesVues() }))
  const [cartels, setCartels] = useState<Record<string, EtatDuCartel>>({})
  const { toast } = useAppState()
  const page = etat.e === 'pret' ? etat.page : null

  /** La page lue, ou ce qu'en dit le refus : sans profil, fermé ici, ou une panne. */
  const lirePage = useCallback((lue: Promise<PageDuCabinet>) => {
    lue.then(
      p => setEtat({ e: 'pret', page: p }),
      (e: unknown) => {
        if (e instanceof UnauthorizedError) setEtat({ e: 'anonyme', motif: e.message })
        else if (e instanceof ApiError && e.statut === 404) setEtat({ e: 'bientot', motif: e.message })
        else setEtat(avant => (avant.e === 'pret' ? avant : { e: 'erreur', motif: motifDe(e) }))
      },
    )
  }, [])
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
      } catch {
        // Sans le profil léger, le musée s'ouvre quand même : le thème attendra.
      }
      if (vivant) lirePage(premiere)
    })()
    return () => {
      vivant = false
    }
  }, [lirePage])

  // Le fragment dit l'écran : un lien vers `#salle-rempart`, le retour du navigateur, tout passe par lui.
  useEffect(() => {
    const suivre = () => setEcranBrut(avant => {
      const neuf = ecranDeLAdresse(window.location.hash)
      return memeEcran(avant, neuf) ? avant : neuf
    })
    window.addEventListener('hashchange', suivre)
    window.addEventListener('popstate', suivre)
    return () => {
      window.removeEventListener('hashchange', suivre)
      window.removeEventListener('popstate', suivre)
    }
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

  // Chaque écran commence en haut, et le focus perdu avec l'écran quitté revient à son titre, sans défiler.
  const precedent = useRef<string | null>(null)
  const cleDEcran = enPartie ? `partie:${enPartie.e}` : (adresseDe(ecran) || 'musee')
  useEffect(() => {
    if (precedent.current === cleDEcran || etat.e !== 'pret') return
    const premiereFois = precedent.current === null
    precedent.current = cleDEcran
    // Le premier écran garde où le navigateur l'a posé : un rechargement en bas d'une salle y reste.
    if (premiereFois) return
    window.scrollTo(0, 0)
    rendreLeFocus(document.querySelector('.cab-page'), ['h1'])
  }, [cleDEcran, etat.e])

  // Le cartel d'une œuvre à lui, demandé quand on l'ouvre, une fois par page : la peinture s'ouvre sans l'attendre.
  const oeuvreOuverte = ecran.e === 'oeuvre' && page ? oeuvreDeLaPage(page, ecran.oeuvre) : null
  const aSonCartel = oeuvreOuverte?.oeuvre.possedee ? oeuvreOuverte.oeuvre.cle : null
  useEffect(() => {
    if (!aSonCartel || cartels[aSonCartel]) return
    setCartels(c => ({ ...c, [aSonCartel]: { etat: 'chargement' } }))
    api.cabinet.oeuvre(aSonCartel).then(
      cartel => setCartels(c => ({ ...c, [aSonCartel]: { etat: 'lu', cartel } })),
      (e: unknown) => setCartels(c => ({ ...c, [aSonCartel]: { etat: 'perdu', motif: motifDe(e) } })),
    )
  }, [aSonCartel, cartels])

  /** « ← Le Cabinet » : le musée, sans recharger la page, et le retour du navigateur ramène où l'on était. */
  const versLeMusee = useCallback(() => {
    setEnPartie(null)
    if (window.location.hash) window.history.pushState(null, '', '/cabinet')
    setEcranBrut({ e: 'musee' })
  }, [])

  /** Un geste qui écrit — un achat, une dorure, un échange — : la page d'après, sinon le refus du serveur et la page relue. */
  const ecrire = async (geste: () => Promise<PageDuCabinet>, reussi: string) => {
    if (busy) return
    setBusy(true)
    try {
      setEtat({ e: 'pret', page: await geste() })
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
  const choisirLaCarte = (cle: string | null) => {
    retenirLaCarte(cle)
    setCarte(cle)
  }
  const lu = (quoi: 'bienvenue' | 'rapportees') => {
    if (quoi === 'bienvenue') retenirLesRegles()
    else if (page) retenirLesRapportees(page.rapportees)
    setAccueil(a => (quoi === 'bienvenue' ? { ...a, bienvenue: false } : { ...a, rapportees: page?.rapportees ?? a.rapportees }))
  }
  const ouvrirLesRegles = () => {
    setRegles(true)
    // Lues une fois, la bienvenue n'a plus à les proposer.
    retenirLesRegles()
    setAccueil(a => ({ ...a, bienvenue: false }))
  }

  // Le toast, rendu par la page elle-même, en bas de l'écran (aucune réponse à y cacher) : l'Expédition n'en rendait aucun, et ses
  // refus partaient en silence.
  const avecLeToast = (contenu: ReactNode) => (
    <RetourAuMusee.Provider value={versLeMusee}>
      {contenu}
      {regles && page && <FeuilleDesRegles jeux={page.jeux} parties={page.visite.cases.length} onFermer={() => setRegles(false)} />}
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

  if (enPartie?.e === 'reprise') return avecLeToast(<AnnonceEnAttente jeu={enPartie.vue.jeu} enJeu={null} reprise onRetour={versLeMusee} />)
  if (enPartie?.e === 'annonce') {
    const demande = enPartie.partie
    const deLaCase = demande.origine === 'visite' ? p.visite.cases[demande.case] : undefined
    const deLaChasse = demande.origine === 'chasse' ? oeuvreDeLaPage(p, demande.oeuvre) : null
    const jeu = demande.origine === 'libre' ? CLES_DES_JEUX.find(j => j === demande.jeu) : (deLaCase?.jeu ?? deLaChasse?.oeuvre.jeu)
    const enJeu = deLaCase ? enJeuDit(deLaCase.enJeu) : deLaChasse ? (deLaChasse.oeuvre.possedee ? `Pour dorer ${deLaChasse.oeuvre.nom}` : 'Une chasse') : null
    if (jeu) return avecLeToast(<AnnonceEnAttente jeu={jeu} enJeu={enJeu} onRetour={versLeMusee} />)
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
          onJouer={partie => setEnPartie({ e: 'annonce', partie })}
        />,
      )
    case 'gardiens':
      return avecLeToast(<Gardiens page={p} carte={carte} onCarte={choisirLaCarte} />)
    case 'visite':
      return avecLeToast(<Visite page={p} busy={busy} onJouer={partie => setEnPartie({ e: 'annonce', partie })} onEchanger={k => void echanger(k)} />)
    case 'libre':
      return avecLeToast(<JouerLibrement page={p} onJouer={partie => setEnPartie({ e: 'annonce', partie })} />)
  }
  return avecLeToast(
    <Musee
      page={p}
      accueil={accueil}
      onRegles={ouvrirLesRegles}
      onReprendre={() => p.enCours && setEnPartie({ e: 'reprise', vue: p.enCours })}
      onLu={lu}
    />,
  )
}
