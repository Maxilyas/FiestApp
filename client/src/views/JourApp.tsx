import { Sortie } from '../components/Pieces'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, motifDe, refusDuServeur, UnauthorizedError, type CorrectionDuJour } from '../api'
import { resetClock, serverNow } from '../clock'
import { rendreLeFocus } from '../focus'
import { insister, REESSAI_MS } from '../insister'
import { deNom, espacesFines, formatNumber, pourcent, pts } from '../format'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { useSecondesRestantes } from '../decompte'
import { placeDuJour } from '../../../shared/course'
import { showToast, useAppState } from '../state'
import { QuizPlayer, type Envoi } from '../games/quiz/PlayerView'
import { Avatar, Dessin } from '../components/Avatar'
import { Flamme, Icon } from '../components/Icon'
import { Niveau } from '../components/Niveau'
import { LAURIER_TEXTE, Laurier, NomLaure } from '../components/Laurier'
import { Onglets, type Onglet } from '../components/Onglets'
import { Rank, Score, motPoints } from '../components/Rank'
import { Shape } from '../components/Shape'
import { promptDialog } from '../components/Dialog'
import { Medaille, Serie, ontGagneHier } from '../components/Jour'
import { CollectionOuverte, Medaillon, PortraitsOuverts } from '../components/FinDeSoiree'
import { NOM_FINITION, finitionsOuvertes, type PublicProfileDetail } from '../../../shared/profil'
import type { QuizAction, QuizPlayerView } from '../../../shared/games/quiz'
import {
  NOM_MEDAILLE,
  XP_PODIUM_DU_JOUR,
  jourAvant,
  jourEnToutesLettres,
  minutesAvantMinuit,
  moisDe,
  moisEnToutesLettres,
  seuilsDesMedailles,
  type ClassementDuJour,
  type LigneDuJour,
  type PartieDuJour,
  type QuestionDuJour,
  type RevelationDuJour,
  type PalierTombe,
} from '../../../shared/jour'
import { ceQuIlAFallu } from '../../../shared/hautsfaits'
import { legendaire } from '../../../shared/legendaires'
import { gesteAccepte } from '../../../shared/console'
import { porterTheme } from '../themeJoueur'
import { nConfettis } from '../../../shared/themes'

/** La marge du serveur après l'échéance (`GRACE_MS`, `games/quiz.ts`), et un souffle : la question se révèle d'elle-même. */
const APRES_ECHEANCE_MS = 1500 + 600

type Ecran = 'partie' | 'classement' | 'correction'

type Periode = 'jour' | 'hier' | 'mois'

/**
 * L'adresse de chaque période du classement. `#classement` reste celle
 * d'aujourd'hui, comme les liens d'avant ; « Le classement du mois », sur la
 * page du profil, ouvrait sinon celui du jour, et il fallait trouver l'onglet.
 */
const ADRESSE_DE_PERIODE: Record<Periode, string> = { jour: '#classement', hier: '#classement-hier', mois: '#classement-mois' }

/** La période que désigne l'adresse, si c'est celle du classement. */
export const periodeDe = (hash: string): Periode | null =>
  (Object.keys(ADRESSE_DE_PERIODE) as Periode[]).find(p => ADRESSE_DE_PERIODE[p] === hash) ?? null

export const ecranDe = (hash: string): Ecran => (periodeDe(hash) ? 'classement' : hash === '#correction' ? 'correction' : 'partie')

/** L'entrée d'historique d'un écran ouvert d'ici — la fin, « Déjà 12 joueurs », la correction d'hier. */
const OUVERT_ICI = 'fiestappJourOuvert'

/**
 * Où mène « Retour », du classement ou de la correction : là d'où l'on
 * vient. Un cran en arrière quand l'écran d'avant est à nous — un écran de
 * cette page, qui a marqué son entrée ; ou la page de l'application qui a
 * ouvert celle-ci, dans le même onglet : la carte de l'accueil, « Mes
 * jours ». L'accueil sinon — un lien reçu, un nouvel onglet : reculer y
 * quitterait l'application, ou ne ferait rien.
 *
 * Il affichait la fin de la partie, qu'on n'avait pas vue en venant de
 * l'accueil, et le retour du téléphone rouvrait ensuite le classement.
 */
export function retourDuJour(etat: unknown, provenance: string, origine: string, entrees: number): 'reculer' | 'accueil' {
  if ((etat as Record<string, unknown> | null)?.[OUVERT_ICI] === true) return 'reculer'
  let deChezNous = false
  try {
    deChezNous = provenance !== '' && new URL(provenance).origin === origine
  } catch {
    // Une provenance illisible ne vient pas de chez nous.
  }
  return deChezNous && entrees > 1 ? 'reculer' : 'accueil'
}

/** Ce que l'écran dit d'abord, pour le focus qui s'est perdu : le résultat, sinon le titre. */
const CE_QUE_L_ECRAN_DIT = ['.result-banner', 'h1', 'h2'] as const

/**
 * Le quiz du jour (`/jour`) : dix questions, les mêmes pour tous les profils,
 * tirées à minuit. On y joue seul, une fois, et l'on apprend : la bonne
 * réponse et son anecdote arrivent après chaque réponse. Le chrono est celui
 * du serveur, la bonne réponse n'arrive jamais avant la sienne (invariant 1).
 *
 * Réservé aux profils. Sans profil, la page le dit et mène à l'accueil, où
 * l'on se connecte — rien de plus : la porte des soirées reste ouverte à tous.
 */
export function JourApp() {
  const { toast } = useAppState()
  const [profil, setProfil] = useState<PublicProfileDetail | null | undefined>(undefined)
  const [partie, setPartie] = useState<PartieDuJour | null>(null)
  const [revelation, setRevelation] = useState<RevelationDuJour | null>(null)
  const [envoi, setEnvoi] = useState<Envoi | null>(null)
  const [ecran, setEcran] = useState<Ecran>(() => ecranDe(window.location.hash))
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  /**
   * La partie était-elle déjà finie quand la page s'est ouverte ? Alors on
   * revient la consulter : la page du jour joué, pas la fête de la fin.
   * Retenu à la première partie reçue, jamais recalculé : celle qui finit
   * sous les yeux garde sa fin.
   */
  const [finieALArrivee, setFinieALArrivee] = useState<boolean | null>(null)

  useEffect(() => {
    const suivre = () => setEcran(ecranDe(window.location.hash))
    window.addEventListener('hashchange', suivre)
    return () => window.removeEventListener('hashchange', suivre)
  }, [])

  const recevoir = useCallback((p: PartieDuJour) => {
    setFinieALArrivee(avant => avant ?? p.etat === 'finie')
    setPartie(p)
    setRevelation(p.revelation ?? null)
    setEnvoi(null)
  }, [])

  const charger = useCallback(() => {
    setErreur('')
    api.joueur
      .moi()
      .then(async ({ profile }) => {
        setProfil(profile)
        if (profile) recevoir(await api.jour.etat())
      })
      .catch(e => {
        if (e instanceof UnauthorizedError) setProfil(null)
        else setErreur(motifDe(e))
      })
  }, [recevoir])
  useEffect(charger, [charger])
  // Le thème de son profil habille le quiz du jour, une fois le profil lu.
  const themePorte = profil === undefined ? undefined : (profil?.theme ?? null)
  useEffect(() => {
    if (themePorte !== undefined) void porterTheme(themePorte)
  }, [themePorte])

  // Au retour au premier plan, l'heure du téléphone a pu être recalée
  // pendant qu'il dormait : la prochaine mesure fait autorité, quel que soit
  // son aller-retour — comme à chaque connexion d'une soirée.
  useEffect(() => {
    const auRetour = () => {
      if (document.visibilityState === 'visible') resetClock()
    }
    document.addEventListener('visibilitychange', auRetour)
    return () => document.removeEventListener('visibilitychange', auRetour)
  }, [])

  /**
   * Chaque geste — commencer, la suivante, une réponse — en tire un numéro :
   * une relecture partie avant lui ne défait pas ce qu'il a changé.
   */
  const gestes = useRef(0)
  /** La relance d'un geste perdu en route : le geste suivant la remplace. */
  const relance = useRef<(() => void) | null>(null)
  useEffect(() => () => relance.current?.(), [])
  /** L'instant où l'écran affiché a paru (`performance.now()`). */
  const changement = useRef<number | null>(null)

  /** Le classement ou la correction, avec leur entrée d'historique : le retour du téléphone ramène ici. */
  const ouvrir = (vers: 'classement' | 'correction') => {
    history.pushState({ [OUVERT_ICI]: true }, '', `#${vers}`)
    setEcran(vers)
  }
  /** « Retour » : d'un cran — l'écran d'ici se remet au `hashchange` —, sinon l'accueil, sans entrée en double. */
  const revenir = () => {
    if (retourDuJour(history.state, document.referrer, window.location.origin, history.length) === 'reculer') history.back()
    else window.location.replace('/')
  }

  /** Relit la partie, telle que le serveur la voit. */
  const relire = () => {
    const n = gestes.current
    api.jour
      .etat()
      .then(p => n === gestes.current && recevoir(p))
      .catch(() => {})
  }

  /** Un geste qui rend la partie : commencer, la suivante, relire. */
  const geste = async (appel: () => Promise<PartieDuJour>) => {
    const n = ++gestes.current
    relance.current?.()
    setOccupe(true)
    try {
      recevoir(await appel())
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
      // Refusé, le geste dit que la page ne voyait plus la partie comme le
      // serveur : elle la relit. Perdue en route, la réponse du serveur a pu
      // servir la question — et lancer son chrono : on la redemande jusqu'à
      // l'avoir, sans rien changer d'autre à l'écran. Retouchée trente
      // secondes plus tard, elle révélait « Temps écoulé » sur une question
      // que le téléphone n'avait jamais montrée.
      if (refusDuServeur(e)) relire()
      else
        relance.current = insister(() => api.jour.etat().then(p => p.question && n === gestes.current && recevoir(p)), {
          premier: REESSAI_MS,
        })
    } finally {
      setOccupe(false)
    }
  }

  /**
   * Sa réponse : envoyée une fois, révélée aussitôt. Perdue en route, elle se
   * retouche — l'écran le lui demande, et un doublon arrivé quand même rend
   * la même révélation sans rien payer de plus.
   */
  const repondre = (action: QuizAction) => {
    const q = partie?.question
    if (!q || action.type !== 'answer' || envoi?.etat === 'envoi') return
    // Pas dans la demi-seconde qui suit l'affichage : ce toucher-là ne vient
    // pas d'une lecture. C'était le second d'un double toucher sur « Question
    // suivante », qui tombait sur la grille de la question d'après — et au
    // quiz du jour, la première réponse est définitive. Le temps de lecture
    // offert paie le maximum : attendre ne coûte rien.
    if (!gesteAccepte(changement.current, performance.now())) return
    ++gestes.current
    relance.current?.()
    setEnvoi({ qIndex: q.index, choice: action.choice, etat: 'envoi' })
    api.jour
      .repondre(q.jour, q.index, action.choice)
      .then(r => {
        setRevelation(r)
        setEnvoi(null)
        setPartie(p => p && { ...p, points: r.cumul, question: undefined })
      })
      .catch(e => {
        showToast({ kind: 'error', message: motifDe(e) })
        // Refusée — minuit est passé, la question n'est plus celle du
        // serveur —, la retoucher recevrait le même refus : la page le dit,
        // et relit la partie. Perdue en route, elle se retouche.
        if (refusDuServeur(e)) {
          setEnvoi({ qIndex: q.index, choice: action.choice, etat: 'refusee' })
          relire()
        } else setEnvoi({ qIndex: q.index, choice: action.choice, etat: 'perdue' })
      })
  }

  // L'échéance passée sans réponse : le serveur la compte « sans réponse »,
  // et la page va chercher ce qu'elle révèle. Seule une réponse en route
  // suspend ce rendez-vous — une réponse perdue, non : il laissait sinon la
  // page sur la question, réponses closes, jusqu'à ce qu'on la recharge.
  // Hors ligne à ce moment-là, la page redemande toutes les trois secondes,
  // et dès que le réseau revient.
  const question = partie?.question
  const enRoute = envoi?.etat === 'envoi'
  useEffect(() => {
    if (!question || enRoute) return
    const n = gestes.current
    return insister(() => api.jour.etat().then(p => n === gestes.current && recevoir(p)), {
      premier: Math.max(0, question.echeance - serverNow()) + APRES_ECHEANCE_MS,
    })
  }, [question, enRoute, recevoir])

  // L'écran affiché, en un mot. Chacun commence en haut, comme ceux d'une
  // soirée : au texte agrandi, la question suivante s'ouvrait là où l'on
  // avait fait défiler la révélation, chrono et numéro hors de l'écran. Le
  // focus qui s'est perdu avec le bouton touché se pose sur ce que l'écran
  // dit d'abord — un lecteur d'écran n'entendait ni la question ni le
  // résultat —, et la demi-seconde qui suit n'accepte aucun toucher.
  const cleDEcran = erreur
    ? 'erreur'
    : profil === null
      ? 'sans-profil'
      : profil === undefined || !partie
        ? null
        : ecran !== 'partie'
          ? ecran
          : revelation
            ? `revelation:${revelation.jour}:${revelation.index}`
            : partie.etat === 'en-cours' && partie.question
              ? `question:${partie.question.jour}:${partie.question.index}`
              : `partie:${partie.jour}:${partie.etat}${finieALArrivee ? ':jouee' : ''}`
  const precedent = useRef<string | null>(null)
  useLayoutEffect(() => {
    const avant = precedent.current
    precedent.current = cleDEcran
    if (cleDEcran === null || cleDEcran === avant) return
    changement.current = performance.now()
    window.scrollTo(0, 0)
    // Le premier écran se lit depuis le haut, comme toute page qui s'ouvre.
    if (avant !== null) rendreLeFocus(document.querySelector('.player-shell'), CE_QUE_L_ECRAN_DIT)
  }, [cleDEcran])

  // La fin rafraîchit le profil : sa barre d'expérience a bougé.
  const finie = partie?.etat === 'finie'
  useEffect(() => {
    if (finie) api.joueur.moi().then(({ profile }) => profile && setProfil(profile)).catch(() => {})
  }, [finie])

  const signaler = async (r: RevelationDuJour) => {
    const texte = await promptDialog({
      title: 'Signaler une erreur',
      message: 'Dis en une phrase ce qui ne va pas : l’administrateur relit chaque signalement, et peut annuler la question pour tous.',
      input: { value: '', placeholder: 'La réponse B est juste aussi…', maxLength: 280 },
      confirmLabel: 'Envoyer',
    })
    if (!texte) return
    try {
      await api.jour.signaler(r.jour, r.index, texte)
      showToast({ kind: 'info', message: 'Merci : c’est envoyé' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    }
  }

  const toastVu = toast && (
    <div className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
      {espacesFines(toast.message)}
    </div>
  )

  if (erreur) return <EchecDuChargement erreur={erreur} onReessayer={charger} />
  if (profil === null) {
    return (
      <div className="player-shell">
        <section className="card jour-carte">
          <span className="label">Le quiz du jour</span>
          <h1 className="jour-date">Dix questions, chaque jour</h1>
          <p className="muted">
            Les mêmes pour tous les profils, tirées à minuit. On y joue seul, une fois, et l’on apprend : la bonne
            réponse et son anecdote arrivent après chaque question.
          </p>
          {/* Le lien qu'un ami envoie : la plupart n'ont pas de profil. « Me
              connecter à mon profil », seul, mentait à qui n'en a pas, et la
              création finissait sur l'accueil, deux « Jouer » plus loin. */}
          <a className="btn btn-primary btn-big btn-block" href="/?creer=1&next=/jour">
            Créer mon profil et jouer
          </a>
          <a className="btn btn-block" href="/?next=/jour">
            J’ai déjà un profil
          </a>
        </section>
      </div>
    )
  }
  if (profil === undefined || !partie) {
    return (
      <div className="center-page">
        <p className="serif-note">Chargement…</p>
      </div>
    )
  }

  if (ecran === 'classement') {
    return (
      <>
        <Classement partie={partie} onRetour={revenir} />
        {toastVu}
      </>
    )
  }
  if (ecran === 'correction') {
    // La sienne une fois finie ; celle d'hier sinon — le lendemain la propose.
    const jour = partie.etat === 'finie' ? partie.jour : jourAvant(partie.jour)
    return (
      <>
        <Correction jour={jour} onRetour={revenir} />
        {toastVu}
      </>
    )
  }

  const bandeau = (points: number) => (
    <p className="jour-bandeau">
      <span className="label">Le quiz du jour · {jourEnToutesLettres(partie.jour, true)}</span>
      <span className="muted small num">{pts(points)}</span>
    </p>
  )

  if (revelation) {
    return (
      <div className="player-shell">
        {bandeau(revelation.cumul)}
        <Revelation r={revelation} />
        <button
          className="btn btn-primary btn-big btn-block"
          disabled={occupe}
          // Pas plus qu'une réponse dans la demi-seconde : un double toucher
          // sur la réponse sautait sinon la révélation et son anecdote.
          onClick={() => {
            if (gesteAccepte(changement.current, performance.now())) void geste(revelation.derniere ? api.jour.etat : api.jour.suivante)
          }}
        >
          {revelation.derniere ? 'Voir mon résultat' : 'Question suivante'}
        </button>
        <button className="lien-signaler link-inline small" onClick={() => void signaler(revelation)}>
          Signaler une erreur dans cette question
        </button>
        {toastVu}
      </div>
    )
  }

  if (partie.etat === 'en-cours' && partie.question) {
    return (
      <div className="player-shell">
        {bandeau(partie.points)}
        <QuizPlayer
          view={vueDeQuestion(partie.question, envoi)}
          send={repondre}
          teams={[]}
          myTeamId={null}
          players={[]}
          moi={undefined}
          participants={0}
          envoi={envoi}
        />
        <AnnonceDeLaFin key={partie.question.index} echeance={partie.question.echeance} />
        {toastVu}
      </div>
    )
  }

  if (partie.etat === 'finie') {
    return (
      <>
        {finieALArrivee ? (
          <JourJoue partie={partie} onClassement={() => ouvrir('classement')} onCorrection={() => ouvrir('correction')} />
        ) : (
          <Fin
            partie={partie}
            profil={profil}
            // La fin ne se voit qu'une fois : quittée, elle laisse la place au
            // jour joué, son classement incrusté — et le retour du classement
            // ou de la correction y ramène, plus à « mon résultat » (le
            // propriétaire du dépôt, le 4 octobre 2026).
            onClassement={() => setFinieALArrivee(true)}
            onCorrection={() => {
              setFinieALArrivee(true)
              ouvrir('correction')
            }}
          />
        )}
        {toastVu}
      </>
    )
  }

  // À jouer — ou en cours entre deux questions, sans rien à révéler : la suivante attend un geste.
  const enCours = partie.etat === 'en-cours'
  return (
    <div className="player-shell">
      {/* La sortie en tête, la même partout ; puis aujourd'hui d'abord — c'est pour lui qu'on vient —, hier dessous. */}
      <Sortie />
      <section className="card jour-carte jour-heros">
        <div className="jour-tete">
          <span className="label">Le quiz du jour</span>
          <Serie jours={partie.serie} />
        </div>
        <h1 className="jour-date">{capitale(jourEnToutesLettres(partie.jour))}</h1>
        {partie.etat === 'aucun' ? (
          <p className="muted">
            {/* « La réserve » est un mot d'administration : le joueur n'en a que faire. */}
            Pas de quiz aujourd’hui : il n’y a plus de questions à tirer.{' '}
            {partie.revientDemain === false ? 'Il revient dès qu’il y en aura de nouvelles.' : 'Il revient demain.'}
          </p>
        ) : (
          <>
            <p className="jour-meta">
              {partie.total} questions
              {partie.categories.length > 0 && ` · ${partie.categories.slice(0, 4).join(', ')}${partie.categories.length > 4 ? '…' : ''}`}
            </p>
            <p className="muted small">
              Un seul essai, qu’on reprend si le téléphone sonne. Le chrono tourne dès que la question paraît ; la bonne
              réponse et son anecdote arrivent juste après.
            </p>
            <button
              className="btn btn-primary btn-big btn-block"
              disabled={occupe}
              onClick={() => void geste(enCours ? api.jour.suivante : api.jour.commencer)}
            >
              <Icon name="play" />
              {enCours ? `Reprendre · ${pts(partie.points)}` : 'Jouer'}
            </button>
          </>
        )}
        {/* Le vainqueur d'hier est déjà dans « Hier, au quiz du jour » quand il s'affiche. */}
        {(partie.joueurs > 0 || (partie.vainqueursDHier.length > 0 && !partie.sonHier)) && (
          <p className="jour-pied muted small">
            {partie.joueurs > 0 && (
              <button type="button" className="link-inline" onClick={() => ouvrir('classement')}>
                Déjà {partie.joueurs} joueur{partie.joueurs > 1 ? 's' : ''} aujourd’hui
              </button>
            )}
            {partie.vainqueursDHier.length > 0 && !partie.sonHier && <span>{ontGagneHier(partie)}</span>}
          </p>
        )}
      </section>
      {partie.sonHier && <Lendemain partie={partie} laurier={profil.laurier} onCorrection={() => ouvrir('correction')} />}
      {partie.saison && <Saison saison={partie.saison} />}
      {toastVu}
    </div>
  )
}

/**
 * La page qui n'a pas pu se charger. Sans réseau, « Retour à l'accueil »
 * échouait aussi : il n'y avait rien pour réessayer.
 */
export function EchecDuChargement({ erreur, onReessayer }: { erreur: string; onReessayer: () => void }) {
  return (
    <div className="player-shell">
      <section className="card jour-carte">
        <span className="label">Le quiz du jour</span>
        <p className="error">{erreur}</p>
        <button className="btn btn-primary btn-big btn-block" onClick={onReessayer}>
          <Icon name="rotate" />
          Réessayer
        </button>
        <a className="btn btn-ghost btn-block" href="/">
          Retour à l’accueil
        </a>
      </section>
    </div>
  )
}

/**
 * Pendant une saison — Halloween, Noël, le Nouvel An — son légendaire en
 * silhouette, et ce qui manque pour l'ouvrir : des jours joués au quiz du
 * jour, ou une soirée ces jours-là.
 */
function Saison({ saison }: { saison: NonNullable<PartieDuJour['saison']> }) {
  const l = legendaire(saison.legendaire)
  if (!l) return null
  return (
    <section className="card jour-saison">
      <span className="jour-saison-medaillon" aria-hidden="true">
        <Dessin cle={saison.legendaire} verrouille />
      </span>
      <div>
        <span className="label">{capitale(saison.nom)}</span>
        <b>
          {l.nom} : {saison.joues} jour{saison.joues > 1 ? 's' : ''} sur {saison.requis}
        </b>
        <span className="muted small">
          {capitale(saison.periode)}, {saison.requis} jours de quiz du jour l’ouvrent — ou une soirée ces jours-là.
        </span>
      </div>
    </section>
  )
}

/** La carte d'un joueur, au toucher de son nom dans le classement : rien ne la télécharge avant. */
const carteJoueur = aLaDemande(() => import('../components/CarteJoueur'))

/** À combien de secondes de la fin on la dit au lecteur d'écran. */
const ANNONCE_DE_LA_FIN = 5

/**
 * « Plus que 5 secondes », dit une fois au lecteur d'écran : il lui faut
 * onze à quatorze secondes d'écoute avant de pouvoir toucher une réponse, et
 * le chronomètre ne s'annonce pas lui-même — il parlerait chaque seconde.
 * Le délai, lui, reste celui de la question : l'arbitrage du 27 septembre
 * 2026 garde le quiz du jour classé et payé à la vitesse [accessibilite-4].
 */
export function AnnonceDeLaFin({ echeance }: { echeance: number }) {
  const secondes = useSecondesRestantes(echeance)
  // Le même texte de 5 à 1 : la région ne parle qu'une fois par question.
  return (
    <p className="sr-only" role="status">
      {secondes > 0 && secondes <= ANNONCE_DE_LA_FIN ? `Plus que ${ANNONCE_DE_LA_FIN} secondes` : ''}
    </p>
  )
}

/** La question du jour, sous la forme que l'écran des soirées sait montrer. */
function vueDeQuestion(q: QuestionDuJour, envoi: Envoi | null): QuizPlayerView {
  return {
    phase: 'question',
    qIndex: q.index,
    qCount: q.total,
    kind: 'choice',
    yourChoice: envoi?.etat === 'recu' ? (envoi.choice ?? null) : null,
    text: q.texte,
    answers: q.reponses,
    ...(q.categorie && { category: q.categorie }),
    deadline: q.echeance,
    duration: q.duree,
  }
}

/** Ce que la réponse apprend : les points, la bonne réponse, la part de la salle, l'anecdote. */
function Revelation({ r }: { r: RevelationDuJour }) {
  const ton = r.annulee || r.choix === null ? '' : r.juste ? 'result-ok' : 'result-ko'
  return (
    <div className="quiz-player">
      <div className="quiz-topbar">
        <span className="label">
          Question {r.index + 1} / {r.total}
        </span>
      </div>
      {/* La question, rappelée : « La bonne réponse : Faux » ne dit rien sans elle. */}
      <p className="jour-rappel">{espacesFines(r.texte)}</p>
      <div className={'card result-banner ' + ton}>
        {r.annulee ? (
          <p>Question annulée : elle ne compte pour personne.</p>
        ) : r.tropTard ? (
          <>
            <span className="result-icon">
              <Icon name="clock" />
            </span>
            <p>Trop tard ! Ta réponse est arrivée après la fin.</p>
          </>
        ) : r.choix === null ? (
          <>
            <span className="result-icon">
              <Icon name="clock" />
            </span>
            <p>Temps écoulé.</p>
          </>
        ) : r.juste ? (
          <>
            <span className="big">+{pts(r.points)}</span>
            <p>Bien joué !</p>
          </>
        ) : (
          <>
            <span className="result-icon">
              <Icon name="x-circle" />
            </span>
            <p>
              Raté… tu avais dit <Shape index={r.choix} inline />
              <strong>{espacesFines(r.reponses[r.choix])}</strong>
            </p>
          </>
        )}
        <p className="muted">
          La bonne réponse : <Shape index={r.bonne} inline />
          <strong>{espacesFines(r.reponses[r.bonne])}</strong>
        </p>
        {r.trouveePar !== null && (
          <div className="jour-trouvee">
            <span className="jauge" aria-hidden="true">
              <span className="jauge-plein" style={{ width: `${Math.round(r.trouveePar * 100)}%` }} />
            </span>
            <span className="muted small">Trouvée par {pourcent(r.trouveePar)} des joueurs du jour</span>
          </div>
        )}
      </div>
      {r.anecdote && (
        <p className="card anecdote">
          <Icon name="message" />
          <span>
            <b>Le saviez-vous ?</b> {espacesFines(r.anecdote)}
          </span>
        </p>
      )}
    </div>
  )
}

/** La fin de la partie : le score, l'expérience, la médaille, la série, la place pour l'instant. */
export function Fin({
  partie,
  profil,
  onClassement,
  onCorrection,
}: {
  partie: PartieDuJour
  profil: PublicProfileDetail
  onClassement: () => void
  onCorrection: () => void
}) {
  const comptees = partie.comptees
  const seuils = seuilsDesMedailles(comptees)
  const monte = partie.niveauAvant !== undefined && partie.niveauApres !== undefined && partie.niveauApres > partie.niveauAvant
  const finitionsNeuves = monte
    ? finitionsOuvertes(partie.niveauApres!).filter(f => !finitionsOuvertes(partie.niveauAvant!).includes(f))
    : []
  const part = profil.requis > 0 ? Math.min(100, (profil.acquis / profil.requis) * 100) : 100
  return (
    <div className="player-shell fin-soiree">
      {/* La sortie, dès l'arrivée : la fin dépasse l'écran d'un téléphone —
          1 200 px en 360 × 640 pour une partie qui monte d'un niveau et
          ouvre son emoji —, et « Retour à l'accueil » attendait tout en bas,
          deux écrans plus loin. En tête, la fête n'en descend pas. */}
      {/* La sortie de la page, en tête et toujours la même : celle de la campagne et du salon. */}
      <Sortie />
      <header className="fin-tete">
        <span className="label">Le quiz du jour</span>
        <h1>{capitale(jourEnToutesLettres(partie.jour))}</h1>
      </header>
      <section className="card result-banner result-ok">
        <span className="big">{pts(partie.points)}</span>
        <p>
          {partie.justes} bonne{partie.justes > 1 ? 's' : ''} réponse{partie.justes > 1 ? 's' : ''} sur {comptees}
        </p>
        {placeDuJour(partie.rang, partie.joueurs, partie.points) && (
          <p className="muted">
            Pour l’instant : {placeDuJour(partie.rang, partie.joueurs, partie.points)}
            {partie.devant && ` · à ${pts(partie.devant.ecart)} de ${partie.devant.nom}`}
          </p>
        )}
      </section>
      <section className="card fin-gain">
        <p className="fin-xp">+{formatNumber(partie.xp)} points d’expérience</p>
        {/* Une bonne réponse, un confetti : au quiz du jour comme en soirée. */}
        {partie.justes > 0 && <p className="fin-confettis">🎊 +{nConfettis(partie.justes)}</p>}
        <p className="muted small">
          {pourcent(partie.pointsPossibles > 0 ? partie.points / partie.pointsPossibles : 0)} des points possibles :{' '}
          {formatNumber(partie.points)} sur {formatNumber(partie.pointsPossibles)}
        </p>
        <div className="xp-bar" role="progressbar" aria-label={`Niveau ${profil.niveau}`} aria-valuemin={0} aria-valuemax={profil.requis || 1} aria-valuenow={profil.requis > 0 ? profil.acquis : 1}>
          <div className="xp-fill" style={{ width: `${part}%` }} />
        </div>
        <p className="muted small">
          {profil.requis > 0
            ? `Niveau ${profil.niveau} · ${formatNumber(profil.acquis)} / ${formatNumber(profil.requis)} XP vers le niveau ${profil.niveau + 1}`
            : `Niveau ${profil.niveau} · au sommet`}
        </p>
        {/* La montée de niveau de cette partie, dite comme en fin de soirée. */}
        {monte && <p className="fin-monte">Niveau {partie.niveauApres} !</p>}
        {finitionsNeuves.length > 0 && (
          <p className="fin-finition">
            Nouvelle finition : <b>{finitionsNeuves.map(f => NOM_FINITION[f]).join(', ')}</b>
          </p>
        )}
      </section>
      {partie.niveauAvant !== undefined && partie.niveauApres !== undefined && (
        <CollectionOuverte avant={partie.niveauAvant} apres={partie.niveauApres} finition={profil.finition} />
      )}
      <section className="card jour-recompenses">
        <div className="jour-ligne">
          {partie.medaille ? (
            <Medaille medaille={partie.medaille} className="medaille-grande" />
          ) : (
            <span className="jour-pastille">
              <Icon name="target" />
            </span>
          )}
          <div>
            <b>{partie.medaille ? NOM_MEDAILLE[partie.medaille] : 'Pas de médaille aujourd’hui'}</b>
            <span className="muted small">
              Le bronze à {seuils.bronze} bonnes réponses, l’argent à {seuils.argent}, l’or à {seuils.or}.
            </span>
          </div>
        </div>
        {partie.serie > 0 && (
          <div className="jour-ligne">
            <span className="jour-pastille">
              <Flamme />
            </span>
            <div>
              <b>
                Série : {partie.serie} jour{partie.serie > 1 ? 's' : ''}
              </b>
              <span className="muted small">Un soir de soirée compte aussi : la fête ne casse jamais une série.</span>
            </div>
          </div>
        )}
        {(partie.paliers ?? []).map(p => (
          <Palier key={p.key} palier={p} />
        ))}
      </section>
      {(partie.legendaires ?? []).map(cle => (
        <LegendaireOuvert key={cle} cle={cle} dejaPorte={profil.legendaire === cle} />
      ))}
      <PortraitsOuverts cles={partie.portraits ?? []} porte={profil.legendaire ?? null} />
      {partie.saison && <Saison saison={partie.saison} />}
      {/* L'enjeu que la page taisait : le laurier est la seule récompense du
          jour que les autres voient. Et le rendez-vous, pour tous. */}
      {partie.rang === 1 && partie.points > 0 && (
        <p className="jour-enjeu">
          <Laurier laurier decoratif /> Reste en tête jusqu’à minuit, et tu porteras le laurier demain — au classement du
          jour et dans tes soirées.
        </p>
      )}
      <p className="muted small jour-note">
        Le classement se fige à minuit. Le podium gagne {XP_PODIUM_DU_JOUR.join(', ').replace(/, (\d+)$/, ' et $1')} XP.
        Demain, dix nouvelles questions dès minuit.
      </p>
      <div className="fin-actions">
        <button className="btn btn-primary" onClick={onClassement}>
          <Icon name="list" />
          Voir le classement
        </button>
        <button className="btn" onClick={onCorrection}>
          <Icon name="book" />
          Revoir mes réponses
        </button>
        <a className="btn btn-ghost" href="/">
          Retour à l’accueil
        </a>
      </div>
    </div>
  )
}


/** Le temps qui reste avant minuit à Paris, « 7 h 05 » ou « 12 min », remis à jour chaque minute. */
function useAvantMinuit(): string {
  const [maintenant, setMaintenant] = useState(() => serverNow())
  useEffect(() => {
    const id = setInterval(() => setMaintenant(serverNow()), 30_000)
    return () => clearInterval(id)
  }, [])
  const m = minutesAvantMinuit(maintenant)
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`
}

/** Au plus cinq lignes du classement, incrusté dans la page du jour joué : le haut, et soi s'il est plus bas. */
const LIGNES_INCRUSTEES = 5

/**
 * Le jour joué : ce qu'on retrouve en revenant après sa partie. La fin et
 * sa fête ne paraissent qu'une fois, juste après la dernière réponse ;
 * revues à chaque visite, elles cachaient ce qu'on vient chercher le soir —
 * sa place au classement, ses réponses — et « Reprendre » ne menait plus
 * qu'à elles (le propriétaire du dépôt, le 3 octobre 2026). Le résultat en
 * une carte, la correction d'un toucher, le classement du jour incrusté, et
 * le rendez-vous de demain.
 */
export function JourJoue({ partie, onClassement, onCorrection }: { partie: PartieDuJour; onClassement: () => void; onCorrection: () => void }) {
  const [classement, setClassement] = useState<ClassementDuJour | null>(null)
  const [carte, setCarte] = useState<string | null>(null)
  const laCarte = useALaDemande(carteJoueur, !!carte)
  const avantMinuit = useAvantMinuit()
  useEffect(() => {
    let vivant = true
    api.jour
      .classement({ jour: partie.jour })
      .then(c => vivant && setClassement(c))
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [partie.jour])
  useEffect(() => {
    if (!carte || laCarte !== 'perdu') return
    showToast({ kind: 'error', message: 'La carte ne s’ouvre pas : vérifie ta connexion.' })
    setCarte(null)
  }, [carte, laCarte])
  const lignes = classement?.lignes ?? []
  const montrees = lignes.slice(0, LIGNES_INCRUSTEES)
  const sienneEnDessous = classement?.sienne ? lignes.slice(LIGNES_INCRUSTEES).find(l => l.profileId === classement.sienne) : undefined
  const plusBas = sienneEnDessous ?? classement?.moi
  return (
    <div className="player-shell jour-joue">
      {/* La sortie de la page, en tête et toujours la même : celle de la campagne et du salon. */}
      <Sortie />
      <section className="card jour-carte">
        <div className="jour-tete">
          <span className="label">Le quiz du jour · joué</span>
          <Serie jours={partie.serie} />
        </div>
        <h1 className="jour-date">{capitale(jourEnToutesLettres(partie.jour))}</h1>
        <div className="jour-resultat">
          {partie.medaille ? (
            <Medaille medaille={partie.medaille} className="medaille-grande" />
          ) : (
            <span className="jour-pastille">
              <Icon name="target" />
            </span>
          )}
          <span>
            <b className="num">{pts(partie.points)}</b>
            <span className="muted small">
              {partie.justes} sur {partie.comptees} · {partie.medaille ? NOM_MEDAILLE[partie.medaille] : 'pas de médaille'} · +
              {formatNumber(partie.xp)} XP
            </span>
          </span>
        </div>
        <button type="button" className="btn btn-block" onClick={onCorrection}>
          <Icon name="book" />
          Revoir mes réponses
        </button>
      </section>

      <section className="card jour-classement-incruste" aria-labelledby="classement-du-jour">
        <div className="jour-classement-tete">
          <h2 id="classement-du-jour">Le classement du jour</h2>
          <span className="muted small">
            {classement
              ? `${classement.joueurs} joueur${classement.joueurs > 1 ? 's' : ''} · ${classement.fige ? 'figé' : 'se fige à minuit'}`
              : 'Chargement…'}
          </span>
        </div>
        <div className="leaderboard">
          {montrees.map(l => (
            <LigneDuClassement key={l.profileId} ligne={l} moi={l.profileId === classement?.sienne} onOuvrir={setCarte} />
          ))}
          {plusBas && (
            <>
              <p className="muted center small">…</p>
              <LigneDuClassement ligne={plusBas} moi onOuvrir={setCarte} />
            </>
          )}
        </div>
        <button type="button" className="link-inline jour-tout-classement" onClick={onClassement}>
          Hier, le mois : tout le classement
        </button>
      </section>

      <p className="jour-demain muted small">
        <Icon name="clock" /> Dix nouvelles questions dans <b>{avantMinuit}</b>
      </p>
      {carte && laCarte && laCarte !== 'perdu' && (
        <laCarte.CarteJoueur adresse={`/api/joueur/carte/${encodeURIComponent(carte)}`} onFermer={() => setCarte(null)} />
      )}
    </div>
  )
}

/**
 * Le légendaire qu'un palier du jour vient d'ouvrir — le Sphinx —, fêté
 * comme en fin de soirée, et qu'on porte d'un toucher.
 */
function LegendaireOuvert({ cle, dejaPorte }: { cle: string; dejaPorte: boolean }) {
  const [porte, setPorte] = useState(dejaPorte)
  const l = legendaire(cle)
  if (!l) return null
  const porter = async () => {
    try {
      const { profile } = await api.joueur.enregistrer({ legendaire: cle })
      setPorte(profile.legendaire === cle)
      showToast({ kind: 'info', message: `Tu portes ${l.nom}` })
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    }
  }
  return (
    <section className="card fin-legendaire">
      <span className="label">Avatar légendaire débloqué</span>
      <Medaillon cle={cle} className="fin-medaillon" />
      <h2>{l.nom}</h2>
      <p className="serif-note">{l.legende}</p>
      {porte ? (
        <p className="muted small">C’est lui que la salle verra, dès la prochaine soirée.</p>
      ) : (
        <button className="btn btn-primary" onClick={() => void porter()}>
          Le porter
        </button>
      )}
    </section>
  )
}

/** Un palier du quiz du jour qui vient de tomber, avec ce qu'il a fallu faire. */
function Palier({ palier }: { palier: PalierTombe }) {
  return (
    <div className="jour-ligne">
      <span className="jour-pastille jour-palier" aria-hidden="true">
        {palier.emoji}
      </span>
      <div>
        <b>Nouveau palier : {palier.title}</b>
        <span className="muted small">{ceQuIlAFallu(palier.key)}</span>
      </div>
    </div>
  )
}

/** Hier, au quiz du jour : sa place, ce que le podium lui a payé, le vainqueur. */
function Lendemain({ partie, laurier, onCorrection }: { partie: PartieDuJour; laurier?: boolean; onCorrection: () => void }) {
  const h = partie.sonHier!
  // Le rang s'il est bon à dire, sinon les points en titre (`placeDuJour`).
  const sa = placeDuJour(h.rang, h.joueurs, h.points)
  return (
    <section className="card jour-annonce">
      <span className="label">Hier, au quiz du jour</span>
      <div className="jour-ligne">
        {h.medaille && <Medaille medaille={h.medaille} className="medaille-geante" />}
        <div>
          <h2>{sa ?? pts(h.points)}</h2>
          <span className="muted">
            {[sa && pts(h.points), h.xpPodium > 0 && `+${h.xpPodium} XP de podium`, h.medaille && NOM_MEDAILLE[h.medaille].toLowerCase()]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      </div>
      {(h.paliers ?? []).map(p => (
        <Palier key={p.key} palier={p} />
      ))}
      {/* Le vainqueur d'hier le lisait sous son prénom, jamais ce qu'il vaut. */}
      {laurier && (
        <p className="jour-enjeu">
          <Laurier laurier decoratif /> Tu portes le laurier aujourd’hui : la salle le verra à côté de ton prénom.
        </p>
      )}
      {partie.vainqueursDHier.length > 0 && (
        <p className="muted small">
          {partie.vainqueursDHier.map(v => v.avatar).join(' ')} {ontGagneHier(partie)}.
        </p>
      )}
      <button className="btn btn-block" onClick={onCorrection}>
        <Icon name="book" />
        La correction d’hier
      </button>
    </section>
  )
}

/** Le classement : aujourd'hui, hier, le mois — tous les profils du serveur. */
export function Classement({ partie, onRetour }: { partie: PartieDuJour; onRetour: () => void }) {
  const [periode, setPeriode] = useState<Periode>(() => periodeDe(window.location.hash) ?? 'jour')
  /**
   * La période choisie s'écrit dans l'adresse, comme l'onglet du profil : un
   * rechargement la garde. Sur la même entrée, marque comprise — « Retour »
   * sait toujours d'où l'on vient, et ne repasse pas par chaque onglet.
   */
  const choisir = (p: Periode) => {
    setPeriode(p)
    history.replaceState(history.state, '', ADRESSE_DE_PERIODE[p])
  }
  const [classement, setClassement] = useState<ClassementDuJour | null>(null)
  const [erreur, setErreur] = useState('')
  const demande = useRef(0)
  /**
   * La carte ouverte : toucher un nom du classement la montre, comme en
   * soirée — tout le serveur, comme le classement lui-même (l'arbitrage du
   * 27 septembre 2026).
   */
  const [carte, setCarte] = useState<string | null>(null)
  const laCarte = useALaDemande(carteJoueur, !!carte)
  useEffect(() => {
    if (!carte || laCarte !== 'perdu') return
    showToast({ kind: 'error', message: 'La carte ne s’ouvre pas : vérifie ta connexion.' })
    setCarte(null)
  }, [carte, laCarte])
  useEffect(() => {
    const n = ++demande.current
    setClassement(null)
    const q = periode === 'jour' ? { jour: partie.jour } : periode === 'hier' ? { jour: jourAvant(partie.jour) } : { mois: moisDe(partie.jour) }
    api.jour
      .classement(q)
      .then(c => n === demande.current && setClassement(c))
      .catch(e => n === demande.current && setErreur(motifDe(e)))
  }, [periode, partie.jour])
  const onglets: Onglet<Periode>[] = [
    { id: 'jour', nom: 'Aujourd’hui' },
    { id: 'hier', nom: 'Hier' },
    { id: 'mois', nom: capitale(moisEnToutesLettres(moisDe(partie.jour)).split(' ')[0]) },
  ]
  return (
    <div className="player-shell">
      <header className="jour-titre">
        <span className="label">Le quiz du jour · {jourEnToutesLettres(partie.jour, true)}</span>
        <h2>Le classement</h2>
      </header>
      <Onglets
        onglets={onglets}
        actif={periode}
        onChoisir={choisir}
        label="Période"
        idOnglet={id => `periode-${id}`}
        idPanneau={() => 'classement-periode'}
        className="onglets-petits"
      />
      {/* Le panneau des onglets : le classement de la période choisie. */}
      <div className="classement-periode" role="tabpanel" id="classement-periode" aria-labelledby={`periode-${periode}`}>
        {erreur && <p className="error">{erreur}</p>}
        {!classement && !erreur && <p className="muted">Chargement…</p>}
        {classement && (
          <>
            <p className="muted small">
              {classement.joueurs === 0
                ? 'Personne n’a encore joué.'
                : `${classement.joueurs} joueur${classement.joueurs > 1 ? 's' : ''} · ${
                    classement.fige ? 'figé' : periode === 'mois' ? 'le total du mois' : 'se fige à minuit'
                  }`}
            </p>
            <div className="leaderboard">
              {classement.lignes.map(l => (
                <LigneDuClassement key={l.profileId} ligne={l} moi={l.profileId === classement.sienne} onOuvrir={setCarte} />
              ))}
              {classement.moi && (
                <>
                  <p className="muted center small">…</p>
                  <LigneDuClassement ligne={classement.moi} moi onOuvrir={setCarte} />
                </>
              )}
            </div>
          </>
        )}
      </div>
      <button className="btn btn-ghost btn-block" onClick={onRetour}>
        Retour
      </button>
      {carte && laCarte && laCarte !== 'perdu' && (
        <laCarte.CarteJoueur adresse={`/api/joueur/carte/${encodeURIComponent(carte)}`} onFermer={() => setCarte(null)} />
      )}
    </div>
  )
}

function LigneDuClassement({ ligne: l, moi, onOuvrir }: { ligne: LigneDuJour; moi: boolean; onOuvrir: (profileId: string) => void }) {
  return (
    <button
      type="button"
      className={'lb-row lb-ouvrable' + (moi ? ' me' : '')}
      // Le nom du bouton remplace tout son contenu : le rang et les points
      // doivent y être, comme au classement d'une soirée.
      aria-label={`La carte ${deNom(l.nom)}${l.laurier ? `, ${LAURIER_TEXTE}` : ''} — rang ${l.rang}, ${l.points} ${motPoints(l.points)}${l.enCours ? ', en cours' : ''}`}
      onClick={() => onOuvrir(l.profileId)}
    >
      <Rank n={l.rang} />
      <Avatar className="lb-avatar" avatar={l.avatar} finition={l.finition} legendaire={l.legendaire} eclat={l.eclat} />
      <span className="lb-name">
        <NomLaure nom={l.nom} laurier={l.laurier} />
        {l.enCours && <span className="muted small"> · en cours</span>}
      </span>
      <Niveau niveau={l.niveau} />
      <Score n={l.points} texte={formatNumber(l.points)} />
    </button>
  )
}

/** La correction d'un jour : chaque question, sa bonne réponse, la part de la salle, et ce qu'on avait dit. */
function Correction({ jour, onRetour }: { jour: string; onRetour: () => void }) {
  const [correction, setCorrection] = useState<CorrectionDuJour | null>(null)
  const [erreur, setErreur] = useState('')
  useEffect(() => {
    api.jour
      .correction(jour)
      .then(setCorrection)
      .catch(e => setErreur(motifDe(e)))
  }, [jour])
  return (
    <div className="player-shell">
      <header className="jour-titre">
        <span className="label">Le quiz du jour · {jourEnToutesLettres(jour, true)}</span>
        <h2>La correction</h2>
      </header>
      {erreur && <p className="muted">{erreur}</p>}
      {!correction && !erreur && <p className="muted">Chargement…</p>}
      {correction && <QuestionsCorrigees questions={correction.questions} />}
      <button className="btn btn-ghost btn-block" onClick={onRetour}>
        Retour
      </button>
    </div>
  )
}

/** Ce qu'est devenue une question de la correction, en un mot. */
export function verdictDeCorrection(q: CorrectionDuJour['questions'][number]): 'Juste' | 'Faux' | 'Sans réponse' | 'Annulée' {
  if (q.annulee) return 'Annulée'
  if (q.juste) return 'Juste'
  // Une ligne sans choix : la question laissée au temps, ou la réponse
  // arrivée après la fin ; pas de ligne : la partie s'est arrêtée avant.
  return q.choix !== null ? 'Faux' : 'Sans réponse'
}

/**
 * Chaque question de la correction : sa marque, sa bonne réponse, la part de
 * la salle, ce qu'on avait dit. La coche et la croix n'étaient que des
 * dessins : au lecteur d'écran, une réponse juste et une question laissée au
 * temps se lisaient pareil, et une question annulée gardait une croix.
 */
export function QuestionsCorrigees({ questions }: { questions: CorrectionDuJour['questions'] }) {
  return (
    <ol className="correction">
      {questions.map((q, i) => {
        const verdict = verdictDeCorrection(q)
        return (
          <li key={i} className={MARQUES[verdict].classe}>
            <span className="correction-marque" role="img" aria-label={verdict}>
              {MARQUES[verdict].icone ? <Icon name={MARQUES[verdict].icone} /> : '–'}
            </span>
            <span className="correction-corps">
              <span>{espacesFines(q.texte)}</span>
              <span className="muted small">
                <b>{espacesFines(q.reponses[q.bonne])}</b>
                {q.trouveePar !== null && ` · trouvée par ${pourcent(q.trouveePar)}`}
                {q.annulee && ' · annulée'}
              </span>
              {verdict === 'Faux' && q.choix !== null && (
                <span className="muted small">Tu avais dit : {espacesFines(q.reponses[q.choix])}</span>
              )}
              {verdict === 'Sans réponse' && <span className="muted small">Sans réponse</span>}
              {q.anecdote && <span className="small">{espacesFines(q.anecdote)}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** La marque de chaque verdict : sa couleur, son dessin — un tiret pour ce qui ne compte pas. */
const MARQUES: Record<ReturnType<typeof verdictDeCorrection>, { classe: string; icone: 'check' | 'x' | 'clock' | null }> = {
  Juste: { classe: 'ok', icone: 'check' },
  Faux: { classe: 'ko', icone: 'x' },
  'Sans réponse': { classe: 'sans', icone: 'clock' },
  Annulée: { classe: 'annulee', icone: null },
}

const capitale = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1)
