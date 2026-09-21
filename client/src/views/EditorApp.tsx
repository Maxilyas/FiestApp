import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  DEFAULT_DURATION,
  DEFAULT_OBSERVE,
  MAX_ANSWERS,
  MAX_DURATION,
  MAX_OBSERVE,
  MIN_DURATION,
  MIN_OBSERVE,
  cloneQuestion,
  emptyQuestion,
  insertQuestions,
  moveQuestion,
  newQuestionId,
  parseImportedQuestions,
  questionProblem,
  toPlayable,
  type QuizDef,
  type QuizQuestionDef,
  type QuizSummary,
} from '../../../shared/library'
import { UnauthorizedError, api, compressImage } from '../api'
import { questionSizeClass } from '../games/quiz/questionSize'
import { confirmDialog, promptDialog } from '../components/Dialog'
import { Icon } from '../components/Icon'
import { Shape } from '../components/Shape'
import { LoginForm } from '../components/Invitation'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * La carte qui vient d'arriver quelque part — déplacée, insérée, dupliquée,
 * collée. On y défile, on l'éclaire un instant, et le clavier la suit :
 * réordonner la liste fait perdre le focus au bouton qu'on vient de cliquer.
 * `focus` dit où il va : l'intitulé d'une question neuve, sinon le bouton
 * qui a servi.
 */
interface Spot {
  id: string
  focus: 'text' | 'number' | 'up' | 'down'
  at: number
}

/** Le temps que l'œil retrouve la carte éclairée. */
const SPOT_MS = 1600

export function EditorApp() {
  const [needLogin, setNeedLogin] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [busy, setBusy] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [list, setList] = useState<QuizSummary[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      setList(await api.list())
      setNeedLogin(false)
    } catch (e) {
      if (e instanceof UnauthorizedError) setNeedLogin(true)
      else setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    reload()
    // Le lien « Les comptes » n'a de sens que pour l'administrateur.
    api.auth
      .me()
      .then(m => setIsAdmin(m.account.role === 'admin'))
      .catch(() => setIsAdmin(false))
  }, [reload])

  const submitLogin = async (login: string, password: string) => {
    setBusy(true)
    setLoginError('')
    try {
      const m = await api.auth.login(login, password)
      setIsAdmin(m.account.role === 'admin')
      await reload()
    } catch (e) {
      setLoginError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (needLogin) {
    return <LoginForm title="Mes quiz" error={loginError} busy={busy} onSubmit={submitLogin} />
  }

  if (editingId) {
    return (
      <QuizEditor
        id={editingId}
        onClose={() => {
          setEditingId(null)
          reload()
        }}
      />
    )
  }

  return (
    <div className="editor">
      <header className="editor-header">
        <h1>
          <Icon name="edit" />
          Mes quiz
        </h1>
        <div className="row">
          <a className="btn btn-ghost" href="/host">
            <Icon name="monitor" />
            Écran commun
          </a>
          <a className="btn btn-ghost" href="/compte">
            <Icon name="users" />
            Mon compte
          </a>
          {isAdmin && (
            <a className="btn btn-ghost" href="/admin">
              <Icon name="sparkles" />
              Les comptes
            </a>
          )}
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                const quiz = await api.create('Nouveau quiz')
                setEditingId(quiz.id)
              } catch (e) {
                setError((e as Error).message)
              }
            }}
          >
            <Icon name="plus" />
            Nouveau quiz
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {list === null && <p className="serif-note">Chargement…</p>}

      {list?.length === 0 && (
        <div className="card notice">
          <p>Aucun quiz pour l'instant. Créez le premier !</p>
        </div>
      )}

      <div className="quiz-list">
        {list?.map(q => (
          <div key={q.id} className="card quiz-row">
            <div className="quiz-row-main">
              <h3>{q.title}</h3>
              <p className="muted">
                {q.readyCount} question{q.readyCount > 1 ? 's' : ''} prête{q.readyCount > 1 ? 's' : ''}
                {q.questionCount > q.readyCount && ` · ${q.questionCount - q.readyCount} à compléter`}
                {' · '}
                modifié le {formatDate(q.updatedAt)}
              </p>
            </div>
            <div className="row">
              <button className="btn" onClick={() => setEditingId(q.id)}>
                Éditer
              </button>
              <button
                className="btn btn-ghost btn-small"
                onClick={async () => {
                  try {
                    await api.duplicate(q.id)
                    reload()
                  } catch (e) {
                    setError((e as Error).message)
                  }
                }}
              >
                Dupliquer
              </button>
              <button
                className="btn btn-ghost btn-small"
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: `Supprimer « ${q.title} » ?`,
                    message: 'Le quiz et ses questions disparaissent pour de bon.',
                    confirmLabel: 'Supprimer',
                    danger: true,
                  })
                  if (!ok) return
                  try {
                    await api.remove(q.id)
                    reload()
                  } catch (e) {
                    setError((e as Error).message)
                  }
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Édition d'un quiz ─────────────────────────────────────────────────────

function QuizEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const [quiz, setQuiz] = useState<QuizDef | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  /**
   * Le dernier déplacement, pour le défaire d'un clic : une faute de frappe,
   * 54 pour 45, ne doit pas coûter une recherche dans soixante cartes. On
   * garde le mouvement inverse plutôt qu'une copie de la liste, pour ne pas
   * écraser une photo arrivée entre-temps. `wasDirty` : défaire un
   * déplacement sur un quiz enregistré le laisse enregistré.
   */
  const [undo, setUndo] = useState<{ label: string; index: number; number: number; wasDirty: boolean } | null>(null)
  const [spot, setSpot] = useState<Spot | null>(null)
  /** Ce qui vient de bouger, pour les lecteurs d'écran — l'œil, lui, suit la carte éclairée. */
  const [announce, setAnnounce] = useState('')

  useEffect(() => {
    api.get(id).then(setQuiz).catch(e => setError((e as Error).message))
  }, [id])

  useEffect(() => {
    if (!spot) return
    const timer = setTimeout(() => setSpot(null), SPOT_MS)
    return () => clearTimeout(timer)
  }, [spot])

  // Filet de sécurité : on ne referme pas l'onglet sur une saisie non enregistrée.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const patch = (fn: (draft: QuizDef) => QuizDef) => {
    setQuiz(q => (q ? fn(q) : q))
    setDirty(true)
    // Toute autre modification tourne la page : le déplacement n'est plus « le dernier ».
    setUndo(null)
  }

  const patchQuestion = (index: number, fn: (q: QuizQuestionDef) => QuizQuestionDef) =>
    patch(q => ({ ...q, questions: q.questions.map((item, i) => (i === index ? fn(item) : item)) }))

  const spotlight = (id: string | undefined, focus: Spot['focus']) => {
    if (id) setSpot({ id, focus, at: Date.now() })
  }

  /**
   * La question en place `index` prend le numéro demandé (voir moveQuestion).
   * Le déplacement est recalculé dans l'état du moment ; ce qu'on lit ici de
   * `quiz` ne sert qu'au libellé, et l'ordre, lui, n'a pas pu changer entre
   * le clic et maintenant : la boîte de dialogue couvrait tout.
   */
  const moveTo = (index: number, number: number, focus: Spot['focus']) => {
    if (!quiz) return
    const before = quiz.questions
    const after = moveQuestion(before, index, number)
    if (after === before) return
    const to = after.indexOf(before[index])
    const label = `Question déplacée du n° ${index + 1} au n° ${to + 1}`
    patch(q => ({ ...q, questions: moveQuestion(q.questions, index, number) }))
    // Après patch, qui l'efface : c'est bien ce déplacement-ci qu'on pourra défaire.
    setUndo({ label, index: to, number: index + 1, wasDirty: dirty })
    setAnnounce(label)
    spotlight(before[index].id, focus)
  }

  const undoMove = () => {
    if (!undo || !quiz) return
    const { index, number, wasDirty } = undo
    const id = quiz.questions[index]?.id
    patch(q => ({ ...q, questions: moveQuestion(q.questions, index, number) }))
    setDirty(wasDirty)
    setAnnounce('Déplacement annulé')
    spotlight(id, 'number')
  }

  /** Une question vide juste après celle-ci, le curseur déjà dans son intitulé. */
  const insertAfter = (index: number) => {
    const question = emptyQuestion()
    patch(q => ({ ...q, questions: insertQuestions(q.questions, index + 2, [question]) }))
    setAnnounce(`Question insérée en n° ${index + 2}`)
    spotlight(question.id, 'text')
  }

  /** La copie arrive juste après l'original — une variante part d'un modèle. */
  const duplicate = (index: number) => {
    const id = newQuestionId()
    patch(q => ({
      ...q,
      questions: insertQuestions(q.questions, index + 2, [cloneQuestion(q.questions[index], id)]),
    }))
    setAnnounce(`Question dupliquée en n° ${index + 2}`)
    spotlight(id, 'text')
  }

  const save = async () => {
    if (!quiz) return
    setSaving(true)
    setError('')
    try {
      const saved = await api.save(quiz.id, quiz.title, quiz.questions)
      setQuiz(saved)
      setDirty(false)
      setSavedAt(Date.now())
      // Enregistré, le déplacement est acquis : le défaire ensuite serait une
      // modification comme une autre, pas un retour à l'état enregistré.
      setUndo(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const close = async () => {
    if (dirty) {
      const leave = await confirmDialog({
        title: 'Quitter sans enregistrer ?',
        message: 'Des modifications ne sont pas enregistrées. Elles seront perdues.',
        confirmLabel: 'Quitter quand même',
        cancelLabel: 'Rester',
        danger: true,
      })
      if (!leave) return
    }
    onClose()
  }

  if (!quiz) {
    return (
      <div className="center-page">
        <p className={error ? 'error' : 'serif-note'}>{error || 'Chargement…'}</p>
      </div>
    )
  }

  const ready = quiz.questions.filter(q => toPlayable(q) !== null).length

  return (
    <div className="editor">
      <header className="editor-header">
        <input
          className="input title-input"
          value={quiz.title}
          maxLength={80}
          onChange={e => patch(q => ({ ...q, title: e.target.value }))}
          placeholder="Titre du quiz"
          aria-label="Titre du quiz"
        />
        <div className="row">
          <span className="muted">
            {ready}/{quiz.questions.length} prête{ready > 1 ? 's' : ''}
          </span>
          <button className="btn btn-ghost" onClick={close}>
            Retour
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? (
              'Enregistrement…'
            ) : dirty ? (
              'Enregistrer'
            ) : (
              <>
                <Icon name="check" />
                Enregistré
              </>
            )}
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {savedAt && !dirty && <p className="muted">Enregistré à {formatDate(savedAt)}</p>}
      {undo && (
        <p className="muted undo-line">
          {undo.label} ·{' '}
          <button type="button" className="link-btn" onClick={undoMove}>
            Annuler
          </button>
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {quiz.questions.map((question, index) => (
        <QuestionCard
          // L'identifiant, pas la position : réordonner ou supprimer ne doit
          // pas faire glisser l'aperçu ouvert d'une carte sur sa voisine.
          key={question.id ?? index}
          index={index}
          total={quiz.questions.length}
          question={question}
          spot={spot && spot.id === question.id ? spot : null}
          onChange={fn => patchQuestion(index, fn)}
          onMoveTo={(number, focus) => moveTo(index, number, focus)}
          onInsertAfter={() => insertAfter(index)}
          onDuplicate={() => duplicate(index)}
          onDelete={() =>
            patch(q => ({ ...q, questions: q.questions.filter((_, i) => i !== index) }))
          }
        />
      ))}

      <div className="row">
        <button
          className="btn btn-big"
          onClick={() => {
            const question = emptyQuestion()
            patch(q => ({ ...q, questions: [...q.questions, question] }))
            spotlight(question.id, 'text')
          }}
        >
          <Icon name="plus" />
          Ajouter une question
        </button>
        <button className="btn" onClick={() => setImporting(v => !v)}>
          <Icon name="clipboard" />
          Coller une liste
        </button>
      </div>

      {importing && (
        <BulkImport
          total={quiz.questions.length}
          onImport={(questions, number) => {
            patch(q => ({ ...q, questions: insertQuestions(q.questions, number, questions) }))
            setAnnounce(
              questions.length > 1
                ? `${questions.length} questions ajoutées à partir du n° ${number}`
                : `Question ajoutée en n° ${number}`,
            )
            spotlight(questions[0]?.id, 'number')
            setImporting(false)
          }}
          onCancel={() => setImporting(false)}
        />
      )}
    </div>
  )
}

/**
 * La question telle qu'elle sera projetée. Vérifier qu'un intitulé trop long
 * ou une photo mal cadrée passe bien ne devrait pas obliger à lancer une
 * vraie partie devant les invités.
 */
function QuestionPreview({ question, onClose }: { question: QuizQuestionDef; onClose: () => void }) {
  const playable = toPlayable(question)
  // Échap referme l'aperçu, comme n'importe quelle fenêtre.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="preview-backdrop" onClick={onClose}>
      <div
        className="preview-frame"
        role="dialog"
        aria-modal="true"
        aria-label="Aperçu de l'écran commun"
        onClick={e => e.stopPropagation()}
      >
        {!playable ? (
          <p className="warn">{questionProblem(question)} — rien à projeter pour l'instant.</p>
        ) : (
          <div className="preview-stage">
            <h2 className={'quiz-question' + questionSizeClass(playable.text)}>{playable.text}</h2>
            {playable.image && <img className="quiz-img" src={playable.image} alt="Photo de la question" />}
            {playable.kind === 'number' ? (
              <p className="big-waiting">
                <Icon name="keyboard" /> Chacun tape son estimation{playable.unit ? ` (en ${playable.unit})` : ''} — le plus
                proche gagne !
              </p>
            ) : (
              <div className="ans-grid">
                {playable.answers.map((a, i) => (
                  <div key={i} className={`ans-btn ans-${i}`}>
                    <Shape index={i} />
                    <span className="ans-text">{a}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="row">
          <span className="muted">Aperçu de l'écran commun · {question.duration} s</span>
          <button className="btn btn-ghost btn-small" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Import en masse. Saisir cinquante questions une par une prend une soirée ;
 * les taper dans un carnet puis coller l'ensemble prend une minute.
 */
function BulkImport({
  total,
  onImport,
  onCancel,
}: {
  /** Questions déjà dans le quiz : la liste collée arrive après, sauf avis contraire. */
  total: number
  /** Les questions reconnues, et le numéro que prendra la première. */
  onImport: (questions: QuizQuestionDef[], number: number) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [at, setAt] = useState(String(total + 1))
  const result = parseImportedQuestions(text)
  // Un champ vide ou illisible vaut « à la fin » ; un numéro trop grand aussi.
  const typed = Number.parseInt(at, 10)
  const number = Number.isNaN(typed) ? total + 1 : Math.min(total + 1, Math.max(1, typed))
  const count = result.questions.length

  return (
    <div className="card import-panel">
      <h3>
        <Icon name="clipboard" />
        Coller une liste de questions
      </h3>
      <p className="muted">
        Une ligne vide entre deux questions. L'étoile marque la bonne réponse ; le signe égal
        transforme la question en estimation chiffrée.
      </p>
      <pre className="import-example">{`Quelle danse Romane préfère-t-elle ?
* La salsa
Le tango
La bachata

Combien de cours a-t-elle pris cette année ?
= 42 cours`}</pre>
      <textarea
        className="input import-area"
        rows={10}
        placeholder="Colle tes questions ici…"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <p className={result.unmarked > 0 ? 'warn' : 'muted'}>
        {count} question{count > 1 ? 's' : ''} reconnue
        {count > 1 ? 's' : ''}
        {count > 0 && (count > 1 ? ` · n° ${number} à ${number + count - 1}` : ` · n° ${number}`)}
        {result.unmarked > 0 &&
          ` · ${result.unmarked} sans étoile : la 1ʳᵉ réponse sera prise pour la bonne`}
        {result.ignored > 0 && ` · ${result.ignored} bloc(s) ignoré(s)`}
      </p>
      <div className="row">
        <button className="btn btn-primary" disabled={count === 0} onClick={() => onImport(result.questions, number)}>
          Ajouter au quiz
        </button>
        <label className="row">
          <span className="muted">à partir du n°</span>
          <input
            className="input position-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={total + 1}
            aria-label="Numéro que prendra la première question collée"
            value={at}
            onChange={e => setAt(e.target.value)}
          />
        </label>
        <button className="btn btn-ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  )
}

interface QuestionCardProps {
  index: number
  total: number
  question: QuizQuestionDef
  /** Non nul quand la carte vient d'arriver ici : on la montre, on l'éclaire. */
  spot: Spot | null
  onChange: (fn: (q: QuizQuestionDef) => QuizQuestionDef) => void
  /** La question prend ce numéro ; `focus` dit quel bouton a servi, pour le lui rendre. */
  onMoveTo: (number: number, focus: Spot['focus']) => void
  onInsertAfter: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function QuestionCard({
  index,
  total,
  question,
  spot,
  onChange,
  onMoveTo,
  onInsertAfter,
  onDuplicate,
  onDelete,
}: QuestionCardProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const textArea = useRef<HTMLTextAreaElement>(null)
  const numberButton = useRef<HTMLButtonElement>(null)
  const upButton = useRef<HTMLButtonElement>(null)
  const downButton = useRef<HTMLButtonElement>(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [imageError, setImageError] = useState('')
  const problem = questionProblem(question)

  useEffect(() => {
    if (!spot) return
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    card.current?.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' })
    const wanted = { text: textArea, number: numberButton, up: upButton, down: downButton }[spot.focus].current
    // La flèche qui a servi peut s'être éteinte (la question est arrivée en
    // tête ou en queue) : le clavier va alors au numéro, jamais nulle part.
    const target = wanted && !(wanted instanceof HTMLButtonElement && wanted.disabled) ? wanted : numberButton.current
    target?.focus({ preventScroll: true })
  }, [spot])

  /**
   * « Déplacer au n° » : on tape le numéro, la question le prend. Trois
   * gestes — clic, numéro, Entrée — là où les flèches en demandaient
   * quarante-deux pour aller de la 3 à la 45.
   */
  const askMove = async () => {
    const raw = await promptDialog({
      title: `Déplacer la question ${index + 1}`,
      message: `Elle prendra le numéro que tu tapes, de 1 à ${total}, et les autres se décalent.\nUn numéro plus grand l'envoie à la fin.`,
      input: { value: String(index + 1), placeholder: `1 à ${total}`, maxLength: 3, inputMode: 'numeric' },
      confirmLabel: 'Déplacer',
    })
    if (raw === null) return
    const number = Number.parseInt(raw, 10)
    // Des lettres ? On laisse tomber sans bruit — le pavé numérique rend le cas rare.
    if (Number.isNaN(number)) return
    onMoveTo(number, 'number')
  }

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setImageError('')
    try {
      const dataUrl = await compressImage(file)
      const { url } = await api.uploadImage(dataUrl)
      onChange(q => ({ ...q, image: url }))
    } catch (e) {
      setImageError((e as Error).message)
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div ref={card} className={'card question-card' + (spot ? ' is-moved' : '')}>
      <div className="question-head">
        <div className="row">
          {total > 1 ? (
            <button
              ref={numberButton}
              type="button"
              className="pill pill-button"
              title="Déplacer la question : lui donner un autre numéro"
              aria-label={`Question ${index + 1} sur ${total}, déplacer`}
              onClick={askMove}
            >
              <Icon name="hash" />
              Question {index + 1}
            </button>
          ) : (
            <span className="pill">Question {index + 1}</span>
          )}
          <div className="kind-toggle">
            <button
              className={'pill-btn' + (question.kind === 'choice' ? ' active' : '')}
              onClick={() => onChange(q => ({ ...q, kind: 'choice' }))}
            >
              <Icon name="list" />
              QCM
            </button>
            <button
              className={'pill-btn' + (question.kind === 'number' ? ' active' : '')}
              onClick={() => onChange(q => ({ ...q, kind: 'number' }))}
            >
              <Icon name="hash" />
              Estimation
            </button>
          </div>
        </div>
        <div className="row">
          <button
            ref={upButton}
            className="btn btn-ghost btn-small"
            disabled={index === 0}
            aria-label="Monter la question"
            title="Monter"
            onClick={() => onMoveTo(index, 'up')}
          >
            <Icon name="arrow-up" />
          </button>
          <button
            ref={downButton}
            className="btn btn-ghost btn-small"
            disabled={index === total - 1}
            aria-label="Descendre la question"
            title="Descendre"
            onClick={() => onMoveTo(index + 2, 'down')}
          >
            <Icon name="arrow-down" />
          </button>
          <button
            className="btn btn-ghost btn-small"
            aria-label="Insérer une question après celle-ci"
            title="Insérer une question après"
            onClick={onInsertAfter}
          >
            <Icon name="plus" />
          </button>
          <button
            className="btn btn-ghost btn-small"
            aria-label="Dupliquer la question"
            title="Dupliquer"
            onClick={onDuplicate}
          >
            <Icon name="copy" />
          </button>
          <button className="btn btn-ghost btn-small" onClick={() => setPreview(true)}>
            <Icon name="eye" />
            Aperçu
          </button>
          <button
            className="btn btn-ghost btn-small"
            onClick={async () => {
              // Une question vide s'efface sans cérémonie ; une question écrite
              // mérite qu'on demande — dix minutes de rédaction ne doivent pas
              // partir sur un clic de trop.
              const written = question.text.trim() || question.answers.some(a => a.trim()) || question.image
              if (written) {
                const ok = await confirmDialog({
                  title: `Supprimer la question ${index + 1} ?`,
                  message: question.text.trim() || 'Cette question et ses réponses seront perdues.',
                  confirmLabel: 'Supprimer',
                  danger: true,
                })
                if (!ok) return
              }
              onDelete()
            }}
          >
            Supprimer
          </button>
        </div>
      </div>

      <textarea
        ref={textArea}
        className="input"
        rows={2}
        maxLength={300}
        placeholder="Ta question…"
        aria-label={`Intitulé de la question ${index + 1}`}
        value={question.text}
        onChange={e => onChange(q => ({ ...q, text: e.target.value }))}
      />

      {question.kind === 'number' ? (
        <div className="number-edit">
          <label className="row">
            <span className="muted">Bonne réponse</span>
            <input
              className="input"
              type="text"
              inputMode="decimal"
              placeholder="Ex. 1994"
              value={question.target ?? ''}
              onChange={e => {
                const raw = e.target.value.replace(',', '.').trim()
                const value = Number(raw)
                onChange(q => ({ ...q, target: raw !== '' && Number.isFinite(value) ? value : null }))
              }}
            />
          </label>
          <label className="row">
            <span className="muted">Unité</span>
            <input
              className="input unit-input"
              maxLength={12}
              placeholder="ans, km, €…"
              value={question.unit}
              onChange={e => onChange(q => ({ ...q, unit: e.target.value }))}
            />
          </label>
          <p className="muted">
            Personne n'est bloqué : chacun propose un nombre, le plus proche empoche le maximum.
          </p>
        </div>
      ) : (
      <div className="answers-edit">
        {Array.from({ length: MAX_ANSWERS }, (_, i) => (
          <label key={i} className={`answer-edit ans-${i}` + (question.correct === i ? ' is-correct' : '')}>
            <input
              type="radio"
              name={`correct-${index}`}
              checked={question.correct === i}
              onChange={() => onChange(q => ({ ...q, correct: i }))}
              title="Bonne réponse"
              aria-label={`La réponse ${i + 1} est la bonne`}
            />
            <Shape index={i} />
            <input
              className="input"
              maxLength={120}
              aria-label={`Réponse ${i + 1}`}
              placeholder={i < 2 ? `Réponse ${i + 1}` : `Réponse ${i + 1} (optionnelle)`}
              value={question.answers[i] ?? ''}
              onChange={e =>
                onChange(q => {
                  const answers = [...q.answers]
                  answers[i] = e.target.value
                  return { ...q, answers }
                })
              }
            />
          </label>
        ))}
      </div>
      )}

      <div className="question-tools">
        <label className="row">
          <span className="muted">Temps</span>
          <input
            className="input duration-input"
            type="number"
            min={MIN_DURATION}
            max={MAX_DURATION}
            aria-label="Temps de réponse, en secondes"
            value={question.duration || DEFAULT_DURATION}
            onChange={e => onChange(q => ({ ...q, duration: Number(e.target.value) }))}
          />
          <span className="muted">s</span>
        </label>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={e => pickImage(e.target.files?.[0])}
        />
        {question.image ? (
          <div className="row">
            <img className="thumb" src={question.image} alt="Photo de la question" />
            <button
              className="btn btn-ghost btn-small"
              onClick={() => onChange(q => ({ ...q, image: null, observeSeconds: null }))}
            >
              Retirer la photo
            </button>
          </div>
        ) : (
          <button className="btn btn-small" disabled={busy} onClick={() => fileInput.current?.click()}>
            {busy ? (
              'Envoi…'
            ) : (
              <>
                <Icon name="camera" />
                Ajouter une photo
              </>
            )}
          </button>
        )}
      </div>

      {/* Photo « mémoire ». Réglage caché tant qu'il n'y a pas de photo : une
          durée d'observation sans rien à observer n'a aucun sens. */}
      {question.image && (
        <div className="observe-edit">
          <label className="row">
            <input
              type="checkbox"
              checked={question.observeSeconds !== null}
              onChange={e =>
                onChange(q => ({ ...q, observeSeconds: e.target.checked ? DEFAULT_OBSERVE : null }))
              }
            />
            <span>
              <Icon name="eye-off" /> La photo disparaît avant la question
            </span>
          </label>
          {question.observeSeconds !== null && (
            <label className="row">
              <span className="muted">Temps d'observation</span>
              <input
                className="input duration-input"
                type="number"
                min={MIN_OBSERVE}
                max={MAX_OBSERVE}
                aria-label="Temps d'observation, en secondes"
                value={question.observeSeconds}
                onChange={e => onChange(q => ({ ...q, observeSeconds: Number(e.target.value) }))}
              />
              <span className="muted">s</span>
            </label>
          )}
          {question.observeSeconds !== null && (
            <p className="muted small">
              La photo passe seule {question.observeSeconds} s — sans l'intitulé ni les réponses —
              puis elle disparaît et la question démarre. Elle revient à la révélation.
            </p>
          )}
        </div>
      )}

      {preview && <QuestionPreview question={question} onClose={() => setPreview(false)} />}
      {imageError && <p className="error">{imageError}</p>}
      {problem && (
        <p className="warn">
          <Icon name="alert" /> {problem} — cette question ne sera pas jouée.
        </p>
      )}
    </div>
  )
}
