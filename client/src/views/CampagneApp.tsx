import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Shape } from '../components/Shape'
import { PieceTete, Sortie } from '../components/Pieces'
import { espacesFines } from '../format'
import { porterTheme } from '../themeJoueur'
import { answersSizeClass, questionSizeClass } from '../games/quiz/questionSize'
import {
  NIVEAUX,
  NOM_NIVEAU,
  VIES,
  type CorrectionDeCampagne,
  type EtatDeCampagne,
  type QuestionDeCampagne,
  type ReponseDeCampagne,
} from '../../../shared/campagne'

type Ecran =
  | { e: 'chargement' }
  | { e: 'anonyme' }
  | { e: 'erreur'; motif: string }
  | { e: 'accueil'; etat: EtatDeCampagne }
  | { e: 'jeu'; serie: string; question: QuestionDeCampagne; vies: number; justes: number; total: number; reponse: ReponseDeCampagne | null; choix: number | null }
  | { e: 'fin'; serie: string; justes: number; record: boolean; correction: CorrectionDeCampagne[] | null }

/**
 * La campagne solo (`/campagne`) : une série qui monte en difficulté, trois
 * vies, sans chronomètre. Ses questions sont celles que le quiz du jour a
 * déjà posées (`core/campagne.ts`). Le serveur compte les vies et ne donne la
 * bonne réponse qu'après la sienne : la page ne fait que montrer.
 *
 * Après chaque réponse, la bonne et son anecdote, comme au quiz du jour.
 * Une bonne réponse vaut un confetti ; la campagne ne rapporte pas
 * d'expérience.
 */
export function CampagneApp() {
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

  useEffect(() => {
    document.title = 'La campagne · FiestApp'
    let vivant = true
    ;(async () => {
      const moi = await api.joueur.moi()
      if (!vivant) return
      // Le thème de son profil habille sa page, comme le quiz du jour.
      void porterTheme(moi.profile?.theme)
      if (!moi.profile) return setEcran({ e: 'anonyme' })
      await relire()
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
      if (s.question) setEcran({ e: 'jeu', serie: s.id, question: s.question, vies: s.vies, justes: s.justes, total: s.total, reponse: null, choix: null })
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
      setEcranBrut({ ...ecran, reponse, choix, vies: reponse.vies, justes: reponse.justes })
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const suivante = () => {
    if (ecran.e !== 'jeu' || !ecran.reponse) return
    const r = ecran.reponse
    if (r.finie || !r.suivante) return setEcran({ e: 'fin', serie: ecran.serie, justes: r.justes, record: !!r.record, correction: null })
    setEcran({ ...ecran, question: r.suivante, reponse: null, choix: null })
  }

  if (ecran.e === 'chargement') {
    return (
      <div className="center-page">
        <p className="serif-note">Chargement…</p>
      </div>
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
    const pret = etat.questions >= 10
    const basculer = (c: string) => setCategories(avant => (avant.includes(c) ? avant.filter(x => x !== c) : [...avant, c]))
    return (
      <div className="player-shell campagne">
        <Sortie />
        <PieceTete piece="Seul" titre="La campagne" />
        <section className="card campagne-record">
          <span className="label">Ton record</span>
          <b>{etat.record}</b>
          <span className="muted small">
            {etat.series === 0 ? 'Ta première série t’attend' : `bonne${etat.record > 1 ? 's' : ''} réponse${etat.record > 1 ? 's' : ''} en une série — ${etat.series} jouée${etat.series > 1 ? 's' : ''}`}
          </span>
        </section>
        {/* L'échelle : la série monte de marche en marche. */}
        <ol className="campagne-echelle" aria-label="La difficulté monte">
          {NIVEAUX.map(n => (
            <li key={n}>{NOM_NIVEAU[n]}</li>
          ))}
        </ol>
        <ul className="campagne-regles">
          <li>
            <Icon name="star" /> Trois vies
          </li>
          <li>
            <Icon name="clock" /> Sans chrono
          </li>
          <li>🎊 Un confetti par bonne réponse</li>
        </ul>
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
                <div className="campagne-categories" role="group" aria-label="Catégories">
                  {etat.categories.map(c => (
                    <button
                      key={c.categorie}
                      type="button"
                      className={'pill-btn' + (categories.includes(c.categorie) ? ' active' : '')}
                      aria-pressed={categories.includes(c.categorie)}
                      onClick={() => basculer(c.categorie)}
                    >
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
                  })
                }
              >
                Reprendre ma série · {etat.enCours.justes} bonne{etat.enCours.justes > 1 ? 's' : ''}
              </button>
            )}
            <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void commencer()}>
              <Icon name="play" />
              {etat.enCours ? 'Une nouvelle série' : 'Commencer'}
            </button>
          </>
        ) : (
          <p className="muted">
            La campagne puise dans les questions déjà posées au quiz du jour : il en pose dix chaque jour. Reviens demain — ou
            joue celui d’aujourd’hui.
          </p>
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
    return (
      <div className="player-shell campagne">
        <section className="card result-banner result-ok campagne-fin">
          <span className="label">{ecran.record ? 'Nouveau record' : 'Fin de la série'}</span>
          <span className="big">{ecran.justes}</span>
          <p>
            bonne{ecran.justes > 1 ? 's' : ''} réponse{ecran.justes > 1 ? 's' : ''} · 🎊 +{ecran.justes} confetti{ecran.justes > 1 ? 's' : ''}
          </p>
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
              <button key={i} className="ans-btn" aria-disabled={busy || undefined} onClick={() => void repondre(i)}>
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
                  <p>Bien joué !</p>
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
          </>
        )}
        {erreur && (
          <p className="error" role="alert">
            {erreur}
          </p>
        )}
      </div>
    </div>
  )
}

/** Les vies qui restent, en cœurs et en mots. */
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
