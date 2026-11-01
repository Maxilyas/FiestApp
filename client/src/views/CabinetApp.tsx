import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ApiError, UnauthorizedError, api, motifDe } from '../api'
import { resetClock } from '../clock'
import { PieceTete, Sortie } from '../components/Pieces'
import { rendreLeFocus } from '../focus'
import { espacesFines } from '../format'
import { porterGerbe } from '../gerbe'
import { porterNiche } from '../niche'
import { retenirLeNiveau } from '../niveauVu'
import { showToast, useAppState } from '../state'
import { porterTheme } from '../themeJoueur'
import { titreDePage } from '../titres'
import { arreterLEcho } from '../toucher'
import type { PageDeLaTraversee } from '../../../shared/cabinet/vues'
import { partieARouvrir, partieDansLEntree, poserLEntreeDeLaPartie, quitterLEpreuveFinie, quitterVersLeMusee } from './cabinet/ecrans'
import { Partie, ecranDuJeu } from './cabinet/Partie'
import { retenirLeProfil } from './cabinet/retenu'
import { ReglesDeLaTraversee, Traversee } from './cabinet/Traversee'

// La page du Cabinet de curiosités (`/cabinet`) : la traversée en trois actes
// (le propriétaire, le 31 octobre 2026 — « On enlève le trop-plein de toutes
// les cartes, la collection etc. C'est trop pour l'utilisateur, il faut que
// l'on revienne à quelque chose de très simple »). Plus de musée, de tour, de
// visite ni de barre : la carte de la traversée (`cabinet/Traversee.tsx`), et
// l'épreuve qui se joue par-dessus, sur l'écran de partie du Cabinet
// (`cabinet/Partie.tsx`), sur une entrée d'historique à elle
// (`poserLEntreeDeLaPartie`) — le retour du navigateur la ferme entre deux
// manches, et demande « Quitter ? » pendant une manche.
//
// Tout ce qu'elle montre vient du serveur (`GET /api/cabinet/traversee`,
// demandée d'emblée — l'adresse préchargée avec la page) ; chaque geste part à
// son rang, et chaque refus se dit dans les mots du serveur.

type Etat = { e: 'chargement' } | { e: 'anonyme' | 'bientot' | 'erreur'; motif: string } | { e: 'pret'; page: PageDeLaTraversee }

/** Ce qui se lit de la page sans profil, ou là où le Cabinet n'ouvre pas : la phrase du serveur, et comment entrer. */
export function EcranSansMusee({ sorte, motif }: { sorte: 'anonyme' | 'bientot' | 'erreur'; motif: string }) {
  const retour = encodeURIComponent('/cabinet')
  return (
    <div className="player-shell cab-page">
      <Sortie />
      <PieceTete piece="Seul" titre="Le Cabinet de curiosités" />
      <p className={sorte === 'erreur' ? 'error' : 'cab-ligne'}>{espacesFines(motif)}</p>
      {/* Le chemin anonyme reste la valeur de l'application : se connecter ouvre sa traversée, sans rien fermer ailleurs. */}
      {sorte === 'anonyme' && (
        <>
          <p className="cab-ligne">{espacesFines('Ta traversée vit avec ton profil : le légendaire que tu gagnes au bout devient ton avatar.')}</p>
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

export function CabinetApp() {
  const [etat, setEtat] = useState<Etat>({ e: 'chargement' })
  const [busy, setBusy] = useState(false)
  const [regles, setRegles] = useState(false)
  // L'épreuve quittée un instant — « ← Le Cabinet » entre deux manches, le retour du navigateur — : la carte la propose, « Reprendre »
  // la rouvre telle qu'elle est.
  const [masquee, setMasquee] = useState<string | null>(null)
  // L'épreuve finie qui attend sa conclusion : elle reste à l'écran, jamais proposée à reprendre, jusqu'à la page qui ne l'a plus.
  const [conclue, setConclue] = useState<string | null>(null)
  const conclueRef = useRef<string | null>(null)
  const { toast } = useAppState()
  const page = etat.e === 'pret' ? etat.page : null

  const recevoir = useCallback((p: PageDeLaTraversee) => {
    // Conclue — la page ne la porte plus : plus rien à garder à l'écran.
    if (conclueRef.current && p.traversee?.partie?.id !== conclueRef.current) {
      conclueRef.current = null
      setConclue(null)
    }
    setEtat({ e: 'pret', page: p })
  }, [])
  /** La page lue, ou ce qu'en dit le refus : sans profil, fermé ici, ou une panne — une page déjà là reste. */
  const lirePage = useCallback(
    (lue: Promise<PageDeLaTraversee>) => {
      lue.then(recevoir, (e: unknown) => {
        if (e instanceof UnauthorizedError) setEtat({ e: 'anonyme', motif: e.message })
        else if (e instanceof ApiError && e.statut === 404) setEtat({ e: 'bientot', motif: e.message })
        else setEtat(avant => (avant.e === 'pret' ? avant : { e: 'erreur', motif: motifDe(e) }))
      })
    },
    [recevoir],
  )
  const relire = useCallback(() => lirePage(api.cabinet.traversee()), [lirePage])

  useEffect(() => {
    // Demandée d'emblée, à l'adresse même que la page servie a préchargée (`DEPART.cabinet`), pour tout visiteur.
    const premiere = api.cabinet.traversee()
    premiere.catch(() => {})
    let vivant = true
    ;(async () => {
      try {
        const moi = await api.joueur.moiLeger()
        if (!vivant) return
        // Le thème de son profil habille la page, sa gerbe éclate à ses bonnes réponses, son compagnon dans sa niche.
        void porterTheme(moi.profile?.theme)
        porterGerbe(moi.profile?.gerbe)
        porterNiche(moi.profile)
        // Le niveau d'où part la page : un gain dit la montée qu'il a faite en s'y comparant.
        retenirLeNiveau(moi.profile?.niveau)
        // Ce que le téléphone retient se relit sous son profil — les pas de l'Épingle, d'une manche à l'autre.
        retenirLeProfil(moi.profile?.id)
      } catch {
        // Sans le profil léger, la traversée s'ouvre quand même : le thème attendra.
      }
      // Rechargée sur l'entrée d'une épreuve, la page décide à sa première page reçue : l'épreuve qui se rouvre garde son entrée,
      // toujours marquée, que le retour du navigateur consomme comme avant ; sans épreuve, la marque s'efface (`partieARouvrir`).
      // Effacée d'office au montage, la page en reposait une par-dessus à chaque rechargement, et le deuxième retour tombait dans
      // une entrée morte.
      if (vivant)
        lirePage(
          premiere.then(p => {
            partieARouvrir(window.history, p.traversee?.partie ?? null)
            return p
          }),
        )
    })()
    return () => {
      vivant = false
    }
  }, [lirePage])

  // Un geste change l'écran au lever du doigt (`toucher`) : le `click` qui le suit tombe sur ce qui vient sous le doigt et ne doit
  // rien y jouer. Arrêté à la capture du document, avant React et avant un lien (`arreterLEcho`).
  useEffect(() => {
    document.addEventListener('click', arreterLEcho, true)
    return () => document.removeEventListener('click', arreterLEcho, true)
  }, [])

  // Au retour au premier plan, l'horloge repart de zéro — un téléphone endormi a pu dériver — et la page se relit : une épreuve a pu
  // finir ailleurs, et se conclure (invariant 6).
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

  const partie = page?.traversee?.partie ?? null
  const montree = partie && (partie.id !== masquee || partie.id === conclue) && ecranDuJeu(partie.jeu) ? partie : null

  // Une épreuve montrée pose son entrée d'historique : le retour du navigateur la ferme entre deux manches — la carte la propose —,
  // et pendant une manche sa garde demande « Quitter ? » (`Partie.tsx`). Avant la garde, d'un effet de mise en page : une
  // épreuve s'ouvre sur sa première manche, et l'effet de `Partie` — un enfant, qui passe avant son parent — posait sa garde
  // d'abord, l'entrée de l'épreuve par-dessus. La manche finie, la garde levée reculait d'une entrée et tombait sous celle de
  // l'épreuve : la page la masquait, et la carte proposait « Reprendre l'épreuve » après chaque première manche (« lorsque l'on
  // réussit le défi, ça nous fait toujours reprendre l'épreuve », le propriétaire, le 1er novembre 2026).
  const idMontree = montree?.id ?? null
  useLayoutEffect(() => {
    if (idMontree) poserLEntreeDeLaPartie(window.history)
  }, [idMontree])
  const montreeRef = useRef(idMontree)
  montreeRef.current = idMontree
  useEffect(() => {
    const suivre = () => {
      const id = montreeRef.current
      // Le recul d'une épreuve finie (`apresLEpreuve`) ne la masque pas : la carte la conclut.
      if (id && id !== conclueRef.current && !partieDansLEntree(window.history.state)) {
        setMasquee(id)
        relire()
      }
    }
    window.addEventListener('popstate', suivre)
    return () => window.removeEventListener('popstate', suivre)
  }, [relire])

  // Chaque écran commence en haut, le focus à son titre : la carte, puis l'épreuve, puis la carte.
  const cleDEcran = idMontree ? `partie:${idMontree}` : 'carte'
  const precedent = useRef<string | null>(null)
  useEffect(() => {
    if (etat.e !== 'pret' || precedent.current === cleDEcran) return
    const premiereFois = precedent.current === null
    precedent.current = cleDEcran
    if (premiereFois) return
    window.scrollTo(0, 0)
    if (idMontree) rendreLeFocus(document.querySelector('.cab-page'), ['.cab-question', 'h2', 'h1'])
  }, [cleDEcran, etat.e, idMontree])

  // De l'épreuve à la carte, l'onglet reprend le titre de la page, tel que `main.tsx` le pose au chargement : « · FiestApp » compris.
  useEffect(() => {
    if (!idMontree && etat.e === 'pret') document.title = titreDePage('cabinet')
  }, [idMontree, etat.e])

  /** Une traversée neuve : sa carte et ses trois gardiens. */
  const commencer = async () => {
    if (busy) return
    setBusy(true)
    try {
      recevoir(await api.cabinet.partir())
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
      relire()
    } finally {
      setBusy(false)
    }
  }

  /** Un geste de la traversée, à son rang : la page d'après — et, aller vers une épreuve, sa partie, qui s'ouvre aussitôt. */
  const geste = async (g: Record<string, unknown>): Promise<PageDeLaTraversee | null> => {
    const t = page?.traversee
    if (!t || busy) return null
    setBusy(true)
    try {
      const r = await api.cabinet.enRoute(t.id, t.rang, g)
      setMasquee(null)
      recevoir(r.page)
      if (r.passe) showToast({ kind: 'info', message: r.passe })
      return r.page
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
      relire()
      return null
    } finally {
      setBusy(false)
    }
  }

  /** De l'épreuve mise de côté à la carte — « ← Le Cabinet » entre deux manches : la carte la propose, « Reprendre » la rouvre. */
  const versLaCarte = useCallback(() => {
    if (montreeRef.current) setMasquee(montreeRef.current)
    quitterVersLeMusee(window.history, window.location.hash, '')
    relire()
  }, [relire])

  /**
   * L'épreuve finie — sa dernière manche, le gardien à terre, le dernier cœur — : la page relue la conclut et en dit le butin.
   * Elle reste à l'écran le temps de l'aller-retour, sans se masquer : masquée tout de suite, la page qu'on tenait encore la disait
   * en cours, et la carte proposait « Reprendre l'épreuve » d'une épreuve gagnée (le retour du propriétaire, le 1er novembre 2026).
   */
  const apresLEpreuve = useCallback(() => {
    const id = montreeRef.current
    // Une fois par épreuve (`quitterLEpreuveFinie`) : annoncée deux fois, elle reculait deux fois, et sortait du Cabinet. Le second
    // appel relit seulement — une relecture perdue se retente ainsi au toucher suivant.
    if (quitterLEpreuveFinie(window.history, window.location.hash, id, conclueRef.current)) {
      conclueRef.current = id
      setConclue(id)
    }
    relire()
  }, [relire])

  const avecLeToast = (contenu: React.ReactNode) => (
    <>
      {contenu}
      {regles && <ReglesDeLaTraversee v={page?.traversee?.fin ? undefined : page?.traversee?.v} onFermer={() => setRegles(false)} />}
      {toast && (
        <div className={`toast toast-${toast.kind} cab-toast`} role={toast.kind === 'error' ? 'alert' : 'status'}>
          {espacesFines(toast.message)}
        </div>
      )}
    </>
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

  if (montree) {
    return avecLeToast(
      <Partie
        key={montree.id}
        depart={montree}
        // La partie relue avec la page — au retour au premier plan, après un refus — : elle a pu continuer sans cet écran.
        relue={montree}
        onMusee={versLaCarte}
        onEpreuveFinie={apresLEpreuve}
        onRelire={relire}
      />,
    )
  }
  return avecLeToast(<Traversee page={etat.page} busy={busy} onCommencer={() => void commencer()} onGeste={geste} onRegles={() => setRegles(true)} onReprendre={() => setMasquee(null)} />)
}
