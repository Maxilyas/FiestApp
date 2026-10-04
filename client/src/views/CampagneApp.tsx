import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Onglets } from '../components/Onglets'
import { ADRESSE_DES_SENTIERS, Sentiers, SentiersEnChemin, sentierDeLAdresse } from './Sentiers'
import { Shape } from '../components/Shape'
import { PieceTete, Sortie } from '../components/Pieces'
import { EMBLEME } from '../components/Ecusson'
import { OR, lueur } from '../components/Atlas'
import { promptDialog } from '../components/Dialog'
import { espacesFines } from '../format'
import { showToast, useAppState } from '../state'
import { porterTheme } from '../themeJoueur'
import { answersSizeClass, questionSizeClass } from '../games/quiz/questionSize'
import { toucher } from '../toucher'
import {
  NIVEAUX,
  NOM_NIVEAU,
  QUESTIONS_POUR_JOUER,
  SIGNALEMENT_MAX,
  VIES,
  XP_PAR_JUSTE,
  type CorrectionDeCampagne,
  type EtatDeCampagne,
  type Niveau,
  type QuestionDeCampagne,
  type ReponseDeCampagne,
} from '../../../shared/campagne'

type Ecran =
  | { e: 'chargement' }
  | { e: 'anonyme' }
  | { e: 'erreur'; motif: string }
  | { e: 'accueil'; etat: EtatDeCampagne }
  | {
      e: 'jeu'
      serie: string
      question: QuestionDeCampagne
      vies: number
      justes: number
      total: number
      reponse: ReponseDeCampagne | null
      choix: number | null
      /** L'expérience gagnée depuis qu'on a ouvert la série sur cette page. */
      xp: number
    }
  | {
      e: 'fin'
      serie: string
      justes: number
      record: boolean
      /** Le record d'avant la série : « L'ancien était de 12 », ou « Ton record : 12 ». */
      recordAvant: number | null
      /** La marche la plus haute atteinte : « jusqu'au niveau difficile ». */
      niveauAtteint: Niveau | null
      correction: CorrectionDeCampagne[] | null
      xp: number
    }

/** Les deux modes de la campagne : la série à trois vies, et les sentiers du savoir. */
type Mode = 'serie' | 'sentiers'
const modeDe = (hash: string): Mode => (hash === ADRESSE_DES_SENTIERS || sentierDeLAdresse(hash) ? 'sentiers' : 'serie')

/**
 * La campagne solo (`/campagne`) : une série qui monte en difficulté, trois
 * vies, sans chronomètre. Ses questions viennent de sa base à elle
 * (`core/baseCampagne.ts`). Le serveur compte les vies et ne donne la bonne
 * réponse qu'après la sienne : la page ne fait que montrer.
 *
 * Après chaque réponse, la bonne et son anecdote, comme au quiz du jour, et
 * de quoi signaler une erreur. Une bonne réponse vaut un confetti, et
 * l'expérience d'une bonne réponse en soirée, sans plafond : chacun monte à
 * son rythme.
 *
 * À côté, le second onglet : les sentiers du savoir (`Sentiers.tsx`), à
 * leur adresse (`#sentiers`, `#sentier-foret`), où se gagnent les avatars
 * du savoir.
 */
export function CampagneApp() {
  const { toast } = useAppState()
  const [mode, setMode] = useState<Mode>(() => modeDe(window.location.hash))
  const [ecran, setEcranBrut] = useState<Ecran>({ e: 'chargement' })
  const [categories, setCategories] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  // Chaque écran commence en haut, comme une page qu'on ouvre.
  const setEcran = (e: Ecran) => {
    setEcranBrut(e)
    window.scrollTo(0, 0)
  }

  const relire = async () => {
    const etat = await api.campagne.etat()
    setEcran({ e: 'accueil', etat })
  }

  // Le retour du navigateur d'un sentier à la série, ou l'inverse.
  useEffect(() => {
    const suivre = () => setMode(modeDe(window.location.hash))
    window.addEventListener('hashchange', suivre)
    window.addEventListener('popstate', suivre)
    return () => {
      window.removeEventListener('hashchange', suivre)
      window.removeEventListener('popstate', suivre)
    }
  }, [])
  /** Changer d'onglet n'empile rien : le retour du téléphone quitte la campagne, comme avant. */
  const choisirMode = (m: Mode) => {
    history.replaceState(history.state, '', m === 'sentiers' ? ADRESSE_DES_SENTIERS : `${window.location.pathname}${window.location.search}`)
    setMode(m)
    window.scrollTo(0, 0)
  }
  const onglets = (
    <Onglets
      onglets={[
        { id: 'serie', nom: 'La série', icone: 'list' },
        { id: 'sentiers', nom: 'Les sentiers', icone: 'target' },
      ]}
      actif={mode}
      onChoisir={choisirMode}
      label="Le mode de la campagne"
      idOnglet={m => `mode-${m}`}
      idPanneau={() => 'mode-campagne'}
      className="onglets-campagne"
    />
  )

  useEffect(() => {
    document.title = 'La campagne · FiestApp'
    let vivant = true
    // L'état part avec le profil, pas après lui, et le profil se lit en
    // léger : comme au quiz du jour, son détail ne servait qu'au thème.
    const etat = api.campagne.etat()
    etat.catch(() => {})
    ;(async () => {
      const moi = await api.joueur.moiLeger()
      if (!vivant) return
      // Le thème de son profil habille sa page, comme le quiz du jour.
      void porterTheme(moi.profile?.theme)
      if (!moi.profile) return setEcran({ e: 'anonyme' })
      const lu = await etat
      if (vivant) setEcran({ e: 'accueil', etat: lu })
    })().catch(e => vivant && setEcran({ e: 'erreur', motif: motifDe(e) }))
    return () => {
      vivant = false
    }
  }, [])

  const commencer = async () => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const s = await api.campagne.commencer(categories)
      if (s.question) setEcran({ e: 'jeu', serie: s.id, question: s.question, vies: s.vies, justes: s.justes, total: s.total, reponse: null, choix: null, xp: 0 })
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const repondre = async (choix: number) => {
    if (ecran.e !== 'jeu' || ecran.reponse || busy) return
    setBusy(true)
    setErreur('')
    try {
      const reponse = await api.campagne.repondre(ecran.serie, ecran.question.index, choix)
      // La révélation sur place : la question reste lisible au-dessus.
      setEcranBrut({ ...ecran, reponse, choix, vies: reponse.vies, justes: reponse.justes, xp: ecran.xp + (reponse.xp ?? 0) })
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const suivante = () => {
    if (ecran.e !== 'jeu' || !ecran.reponse) return
    const r = ecran.reponse
    if (r.finie || !r.suivante) {
      return setEcran({
        e: 'fin',
        serie: ecran.serie,
        justes: r.justes,
        record: !!r.record,
        recordAvant: r.recordAvant ?? null,
        niveauAtteint: r.niveauAtteint ?? null,
        correction: null,
        xp: ecran.xp,
      })
    }
    setEcran({ ...ecran, question: r.suivante, reponse: null, choix: null })
  }

  /**
   * « Signaler une erreur » : après sa réponse, comme au quiz du jour. Une
   * phrase, que l'administrateur relit (`/admin#campagne`) ; il peut retirer
   * la question pour tous.
   */
  const signaler = async (serie: string, index: number) => {
    const texte = await promptDialog({
      title: 'Signaler une erreur',
      message: 'Dis en une phrase ce qui ne va pas : l’administrateur relit chaque signalement, et peut retirer la question de la campagne.',
      input: { value: '', placeholder: 'La réponse B est juste aussi…', maxLength: SIGNALEMENT_MAX },
      confirmLabel: 'Envoyer',
    })
    if (!texte) return
    try {
      await api.campagne.signaler(serie, index, texte)
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

  // Ouverte sur les sentiers, la page n'attend pas la série pour s'esquisser.
  if (ecran.e === 'chargement' && mode === 'sentiers') return <SentiersEnChemin onglets={onglets} />
  if (ecran.e === 'chargement') return <CampagneEnChemin />
  if (ecran.e !== 'anonyme' && ecran.e !== 'erreur' && mode === 'sentiers') {
    return (
      <>
        <Sentiers onglets={onglets} onSerie={() => choisirMode('serie')} />
        {toastVu}
      </>
    )
  }

  if (ecran.e === 'anonyme' || ecran.e === 'erreur') {
    return (
      <div className="player-shell">
        <Sortie />
        <PieceTete piece="Seul" titre="La campagne" />
        {ecran.e === 'anonyme' ? (
          <>
            <p>La campagne se joue avec ton profil : tes records et tes confettis y restent.</p>
            <a className="btn btn-primary btn-big btn-block" href="/?next=/campagne">
              Me connecter
            </a>
            <a className="btn btn-block" href="/?creer=1&next=/campagne">
              Créer mon profil
            </a>
          </>
        ) : (
          <p className="error">{ecran.motif}</p>
        )}
      </div>
    )
  }

  if (ecran.e === 'accueil') {
    const { etat } = ecran
    const pret = etat.questions >= QUESTIONS_POUR_JOUER
    const basculer = (c: string) => setCategories(avant => (avant.includes(c) ? avant.filter(x => x !== c) : [...avant, c]))
    return (
      <div className="player-shell campagne">
        <Sortie />
        {onglets}
        <Heros etat={etat} />
        {/* Ce que la journée a déjà rapporté : sans plafond, il n'y a plus de « plein » à annoncer. */}
        {etat.xpAujourdhui > 0 && <p className="muted small campagne-xp-du-jour">Aujourd’hui : +{etat.xpAujourdhui} XP</p>}
        {pret ? (
          <>
            {etat.categories.length > 1 && (
              <details className="reglages-salon">
                <summary>
                  <Icon name="list" className="reglages-icone" />
                  <span>
                    <b>Catégories</b>
                    <span className="muted small">{categories.length === 0 ? 'toutes' : `${categories.length} choisie${categories.length > 1 ? 's' : ''}`}</span>
                  </span>
                  <Icon name="chevron-down" className="repli-chevron" />
                </summary>
                {/* En grille, l'emblème de chacune : tout tient sans rien faire glisser de côté. */}
                <div className="categories-grille" role="group" aria-label="Catégories">
                  <button type="button" className={'categorie-case' + (categories.length === 0 ? ' active' : '')} aria-pressed={categories.length === 0} onClick={() => setCategories([])}>
                    <Icon name="sparkles" />
                    Toutes
                  </button>
                  {etat.categories.map(c => (
                    <button
                      key={c.categorie}
                      type="button"
                      className={'categorie-case' + (categories.includes(c.categorie) ? ' active' : '')}
                      aria-pressed={categories.includes(c.categorie)}
                      onClick={() => basculer(c.categorie)}
                    >
                      <Icon name={EMBLEME[c.categorie] ?? 'star'} />
                      {c.categorie}
                    </button>
                  ))}
                </div>
              </details>
            )}
            {erreur && (
              <p className="error" role="alert">
                {erreur}
              </p>
            )}
            {etat.enCours?.question && (
              <button
                type="button"
                className="btn btn-block"
                onClick={() =>
                  setEcran({
                    e: 'jeu',
                    serie: etat.enCours!.id,
                    question: etat.enCours!.question!,
                    vies: etat.enCours!.vies,
                    justes: etat.enCours!.justes,
                    total: etat.enCours!.total,
                    reponse: null,
                    choix: null,
                    xp: 0,
                  })
                }
              >
                Reprendre ma série · {etat.enCours.justes} bonne{etat.enCours.justes > 1 ? 's' : ''}
              </button>
            )}
            <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void commencer()}>
              <Icon name="play" />
              {etat.enCours ? 'Une nouvelle série' : 'Commencer une série'}
            </button>
          </>
        ) : (
          <p className="muted">La campagne n’a pas encore de questions à poser : reviens bientôt — ou joue le quiz du jour.</p>
        )}
      </div>
    )
  }

  if (ecran.e === 'fin') {
    const voirCorrection = async () => {
      try {
        const correction = await api.campagne.correction(ecran.serie)
        setEcranBrut({ ...ecran, correction })
      } catch (e) {
        setErreur(motifDe(e))
      }
    }
    const s = ecran.justes > 1 ? 's' : ''
    return (
      <div className="player-shell campagne">
        <header className="fin-tete">
          <span className="label">La campagne</span>
          <h1>Série terminée</h1>
        </header>
        <section className="card result-banner result-ok campagne-fin">
          <span className="big">{ecran.justes}</span>
          <p>
            bonne{s} réponse{s}
            {ecran.niveauAtteint && `, jusqu’au niveau ${NOM_NIVEAU[ecran.niveauAtteint].toLowerCase()}`}
          </p>
          {/* Le record d'avant la série : battu, on le dit fièrement ; sinon, ce qu'il reste à battre. */}
          {ecran.record ? (
            <p className="campagne-record-battu">
              <span aria-hidden="true">🏆</span> Record battu : {ecran.justes}
              <span className="muted small">{ecran.recordAvant ? ` · l’ancien était de ${ecran.recordAvant}` : ' · ta première série'}</span>
            </p>
          ) : (
            !!ecran.recordAvant && <p className="muted small">Ton record : {ecran.recordAvant}</p>
          )}
          {/* Rien à compter, rien à dire : « +0 confetti » sonnait comme un reproche. */}
          {ecran.justes > 0 && (
            <p className="muted">
              🎊 +{ecran.justes} confetti{s}
              {ecran.xp > 0 && ` · +${ecran.xp}\u00a0XP`}
            </p>
          )}
        </section>
        {erreur && <p className="error">{erreur}</p>}
        <a className="btn btn-primary btn-big btn-block" href="/">
          <Icon name="home" />
          Retour à l’accueil
        </a>
        <div className="row campagne-suite">
          <button type="button" className="btn" onClick={() => void commencer()}>
            <Icon name="rotate" />
            Rejouer
          </button>
          {!ecran.correction && (
            <button type="button" className="btn btn-ghost" onClick={() => void voirCorrection()}>
              Mes réponses
            </button>
          )}
        </div>
        {ecran.correction && (
          <ol className="campagne-correction">
            {ecran.correction.map((c, i) => (
              <li key={i} className={'card ' + (c.juste ? 'campagne-juste' : 'campagne-rate')}>
                <span className="label">{NOM_NIVEAU[c.niveau]}</span>
                <p>{espacesFines(c.texte)}</p>
                <p className="muted small">
                  <Shape index={c.bonne} inline /> {espacesFines(c.reponses[c.bonne])}
                  {!c.juste && c.choix !== null && <> · tu avais dit {espacesFines(c.reponses[c.choix])}</>}
                </p>
                {/* L'anecdote, qu'on a lue en jouant : la correction la redonne, pour s'en souvenir. */}
                {c.anecdote && <p className="small campagne-anecdote">{espacesFines(c.anecdote)}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    )
  }

  // ── Une question de la série ──
  const { question: q, reponse: r } = ecran
  return (
    <div className="player-shell campagne">
      <div className="quiz-player">
        <div className="quiz-topbar">
          <span className="label">
            {NOM_NIVEAU[q.niveau]} · question {q.index + 1}
          </span>
          <Vies restantes={ecran.vies} />
        </div>
        {q.categorie && <span className="label quiz-categorie">{q.categorie}</span>}
        <h2 className={'quiz-question' + questionSizeClass(q.texte)}>{espacesFines(q.texte)}</h2>
        {!r ? (
          <div className={'ans-grid' + answersSizeClass(q.reponses)}>
            {q.reponses.map((a, i) => (
              <button key={i} className="ans-btn" aria-disabled={busy || undefined} {...toucher(() => void repondre(i))}>
                <Shape index={i} />
                <span className="ans-text">{espacesFines(a)}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className={'card result-banner ' + (r.juste ? 'result-ok' : 'result-ko')} role="status">
              {r.juste ? (
                <>
                  <span className="big">🎊 +1</span>
                  <p>
                    Bien joué !{r.xp > 0 ? ` +${r.xp}\u00a0XP` : ''}
                  </p>
                </>
              ) : (
                <>
                  <span className="result-icon">
                    <Icon name="x-circle" />
                  </span>
                  <p>
                    Raté… {ecran.vies > 0 ? `plus que ${ecran.vies} vie${ecran.vies > 1 ? 's' : ''}` : 'c’était ta dernière vie'}
                  </p>
                </>
              )}
              <p className="muted">
                La bonne réponse : <Shape index={r.bonne} inline />
                <strong>{espacesFines(q.reponses[r.bonne])}</strong>
              </p>
            </div>
            {r.anecdote && (
              <p className="card anecdote">
                <Icon name="message" />
                <span>
                  <b>Le saviez-vous ?</b> {espacesFines(r.anecdote)}
                </span>
              </p>
            )}
            <button type="button" className="btn btn-primary btn-big btn-block" onClick={suivante}>
              {r.finie ? 'Voir ma série' : 'Question suivante'}
            </button>
            <button type="button" className="lien-signaler link-inline small" onClick={() => void signaler(ecran.serie, q.index)}>
              Signaler une erreur dans cette question
            </button>
          </>
        )}
        {erreur && (
          <p className="error" role="alert">
            {erreur}
          </p>
        )}
      </div>
      {toastVu}
    </div>
  )
}

/** Les vies qui restent, en cœurs et en mots. */
/**
 * La page qui s'ouvre tout de suite : le défi et les règles d'abord, son
 * record et sa série à reprendre dès que le serveur les a dits. Elle
 * attendait derrière « Chargement… » — 3,5 s au premier joueur après un
 * déploiement, le temps que le serveur lise sa base.
 */
export function CampagneEnChemin() {
  return (
    <div className="player-shell campagne" aria-busy="true">
      <Sortie />
      <Heros etat={null} />
      <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled="true">
        <Icon name="play" />
        Commencer une série
      </button>
    </div>
  )
}

/**
 * Le héros de la page : le défi, le record, l'échelle et les règles d'un coup
 * d'œil, sur la trame de l'atlas. Sans son état encore — la page s'ouvre
 * avant lui —, le record attend sa place, sans rien décaler.
 */
function Heros({ etat }: { etat: EtatDeCampagne | null }) {
  return (
    <section className="atlas-branche campagne-heros" style={lueur(OR)}>
      <span className="atlas-categorie">La campagne solo</span>
      <h1>Jusqu’où iras-tu&nbsp;?</h1>
      <div className="campagne-record-hud">
        {etat ? <b>{etat.record}</b> : <b>–</b>}
        <span>
          ton record
          <br />
          {!etat
            ? '…'
            : etat.series === 0
              ? 'ta première série t’attend'
              : `${etat.series} série${etat.series > 1 ? 's' : ''} jouée${etat.series > 1 ? 's' : ''}`}
        </span>
      </div>
      {/* L'échelle : la série monte de marche en marche. */}
      <ol className="campagne-echelle" aria-label="La difficulté monte">
        {NIVEAUX.map(n => (
          <li key={n}>
            <i aria-hidden="true" />
            {NOM_NIVEAU[n]}
          </li>
        ))}
      </ol>
      <ul className="campagne-puces">
        <li>
          {/* Les cœurs pour l'œil, les mots pour tous : « 3 vies sur 3, trois vies » se lisait deux fois. */}
          <span aria-hidden="true">
            <Vies restantes={VIES} />
          </span>{' '}
          trois vies
        </li>
        <li>
          <Icon name="timer" /> sans chrono
        </li>
        <li>🎊 un confetti par bonne réponse</li>
        <li>
          <Icon name="zap" /> {XP_PAR_JUSTE} XP par bonne réponse, sans limite
        </li>
      </ul>
    </section>
  )
}

function Vies({ restantes }: { restantes: number }) {
  return (
    <span className="vies" role="img" aria-label={`${restantes} vie${restantes > 1 ? 's' : ''} sur ${VIES}`}>
      {Array.from({ length: VIES }, (_, i) => (
        <svg key={i} className={'icon coeur' + (i >= restantes ? ' perdu' : '')} viewBox="0 0 24 24" fill={i >= restantes ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
        </svg>
      ))}
    </span>
  )
}
