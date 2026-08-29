import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  DEFAULT_DURATION,
  DEFAULT_OBSERVE,
  MAX_ANSWERS,
  MAX_DURATION,
  MAX_OBSERVE,
  MIN_DURATION,
  MIN_OBSERVE,
  emptyQuestion,
  parseImportedQuestions,
  questionProblem,
  toPlayable,
  type QuizDef,
  type QuizQuestionDef,
  type QuizSummary,
} from '../../../shared/library'
import { UnauthorizedError, api, compressImage, hostKey, setHostKey } from '../api'
import { questionSizeClass } from '../games/quiz/HostView'

const SHAPES = ['▲', '◆', '●', '■']

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function EditorApp() {
  const [needKey, setNeedKey] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [list, setList] = useState<QuizSummary[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      setList(await api.list())
      setNeedKey(false)
    } catch (e) {
      if (e instanceof UnauthorizedError) setNeedKey(true)
      else setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get('key')
    if (urlKey) {
      setHostKey(urlKey)
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (!hostKey()) return setNeedKey(true)
    reload()
  }, [reload])

  const submitKey = async (e: FormEvent) => {
    e.preventDefault()
    setHostKey(keyInput)
    setError('')
    try {
      setList(await api.list())
      setNeedKey(false)
    } catch {
      setError('Clé incorrecte')
    }
  }

  if (needKey) {
    return (
      <div className="center-page">
        <form className="card join-card" onSubmit={submitKey}>
          <h1>✏️ Mes quiz</h1>
          <input
            className="input"
            placeholder="Clé d'accès (HOST_KEY)"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary">Entrer</button>
        </form>
      </div>
    )
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
        <h1>✏️ Mes quiz</h1>
        <div className="row">
          <a className="btn btn-ghost" href={`/host?key=${hostKey()}`}>
            🖥️ Écran commun
          </a>
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
            + Nouveau quiz
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {list === null && <p className="muted">Chargement…</p>}

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
                  await api.duplicate(q.id)
                  reload()
                }}
              >
                Dupliquer
              </button>
              <button
                className="btn btn-ghost btn-small"
                onClick={async () => {
                  if (!window.confirm(`Supprimer « ${q.title} » ? C'est définitif.`)) return
                  await api.remove(q.id)
                  reload()
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

  useEffect(() => {
    api.get(id).then(setQuiz).catch(e => setError((e as Error).message))
  }, [id])

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
  }

  const patchQuestion = (index: number, fn: (q: QuizQuestionDef) => QuizQuestionDef) =>
    patch(q => ({ ...q, questions: q.questions.map((item, i) => (i === index ? fn(item) : item)) }))

  const save = async () => {
    if (!quiz) return
    setSaving(true)
    setError('')
    try {
      const saved = await api.save(quiz.id, quiz.title, quiz.questions)
      setQuiz(saved)
      setDirty(false)
      setSavedAt(Date.now())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const close = () => {
    if (dirty && !window.confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) return
    onClose()
  }

  if (!quiz) {
    return (
      <div className="center-page">
        <p className="muted">{error || 'Chargement…'}</p>
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
        />
        <div className="row">
          <span className="muted">
            {ready}/{quiz.questions.length} prête{ready > 1 ? 's' : ''}
          </span>
          <button className="btn btn-ghost" onClick={close}>
            Retour
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Enregistrement…' : dirty ? 'Enregistrer' : 'Enregistré ✓'}
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {savedAt && !dirty && <p className="muted">Enregistré à {formatDate(savedAt)}</p>}

      {quiz.questions.map((question, index) => (
        <QuestionCard
          key={index}
          index={index}
          total={quiz.questions.length}
          question={question}
          onChange={fn => patchQuestion(index, fn)}
          onMove={dir =>
            patch(q => {
              const target = index + dir
              if (target < 0 || target >= q.questions.length) return q
              const questions = [...q.questions]
              ;[questions[index], questions[target]] = [questions[target], questions[index]]
              return { ...q, questions }
            })
          }
          onDelete={() =>
            patch(q => ({ ...q, questions: q.questions.filter((_, i) => i !== index) }))
          }
        />
      ))}

      <div className="row">
        <button
          className="btn btn-big"
          onClick={() => patch(q => ({ ...q, questions: [...q.questions, emptyQuestion()] }))}
        >
          + Ajouter une question
        </button>
        <button className="btn" onClick={() => setImporting(v => !v)}>
          📥 Coller une liste
        </button>
      </div>

      {importing && (
        <BulkImport
          onImport={questions => {
            patch(q => ({ ...q, questions: [...q.questions, ...questions] }))
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
  return (
    <div className="preview-backdrop" onClick={onClose}>
      <div className="preview-frame" onClick={e => e.stopPropagation()}>
        {!playable ? (
          <p className="warn">{questionProblem(question)} — rien à projeter pour l'instant.</p>
        ) : (
          <div className="preview-stage">
            <h2 className={'quiz-question' + questionSizeClass(playable.text)}>{playable.text}</h2>
            {playable.image && <img className="quiz-img" src={playable.image} alt="" />}
            {playable.kind === 'number' ? (
              <p className="big-waiting">
                ⌨️ Chacun tape son estimation{playable.unit ? ` (en ${playable.unit})` : ''} — le plus
                proche gagne !
              </p>
            ) : (
              <div className="ans-grid">
                {playable.answers.map((a, i) => (
                  <div key={i} className={`ans-btn ans-${i}`}>
                    <span className="ans-shape">{SHAPES[i]}</span>
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
  onImport,
  onCancel,
}: {
  onImport: (questions: QuizQuestionDef[]) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const result = parseImportedQuestions(text)

  return (
    <div className="card import-panel">
      <h3>📥 Coller une liste de questions</h3>
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
        {result.questions.length} question{result.questions.length > 1 ? 's' : ''} reconnue
        {result.questions.length > 1 ? 's' : ''}
        {result.unmarked > 0 &&
          ` · ⚠️ ${result.unmarked} sans étoile : la 1ʳᵉ réponse sera prise pour la bonne`}
        {result.ignored > 0 && ` · ${result.ignored} bloc(s) ignoré(s)`}
      </p>
      <div className="row">
        <button
          className="btn btn-primary"
          disabled={result.questions.length === 0}
          onClick={() => onImport(result.questions)}
        >
          Ajouter au quiz
        </button>
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
  onChange: (fn: (q: QuizQuestionDef) => QuizQuestionDef) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
}

function QuestionCard({ index, total, question, onChange, onMove, onDelete }: QuestionCardProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [imageError, setImageError] = useState('')
  const problem = questionProblem(question)

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
    <div className="card question-card">
      <div className="question-head">
        <div className="row">
          <span className="pill">Question {index + 1}</span>
          <div className="kind-toggle">
            <button
              className={'pill-btn' + (question.kind === 'choice' ? ' active' : '')}
              onClick={() => onChange(q => ({ ...q, kind: 'choice' }))}
            >
              🔘 QCM
            </button>
            <button
              className={'pill-btn' + (question.kind === 'number' ? ' active' : '')}
              onClick={() => onChange(q => ({ ...q, kind: 'number' }))}
            >
              🔢 Estimation
            </button>
          </div>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-small" disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button
            className="btn btn-ghost btn-small"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button className="btn btn-ghost btn-small" onClick={() => setPreview(true)}>
            👁 Aperçu
          </button>
          <button className="btn btn-ghost btn-small" onClick={onDelete}>
            Supprimer
          </button>
        </div>
      </div>

      <textarea
        className="input"
        rows={2}
        maxLength={300}
        placeholder="Ta question…"
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
            />
            <span className="ans-shape">{SHAPES[i]}</span>
            <input
              className="input"
              maxLength={120}
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
            <img className="thumb" src={question.image} alt="" />
            <button
              className="btn btn-ghost btn-small"
              onClick={() => onChange(q => ({ ...q, image: null, observeSeconds: null }))}
            >
              Retirer la photo
            </button>
          </div>
        ) : (
          <button className="btn btn-small" disabled={busy} onClick={() => fileInput.current?.click()}>
            {busy ? 'Envoi…' : '📷 Ajouter une photo'}
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
            <span>🫥 La photo disparaît avant la question</span>
          </label>
          {question.observeSeconds !== null && (
            <label className="row">
              <span className="muted">Temps d'observation</span>
              <input
                className="input duration-input"
                type="number"
                min={MIN_OBSERVE}
                max={MAX_OBSERVE}
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
      {problem && <p className="warn">⚠️ {problem} — cette question ne sera pas jouée.</p>}
    </div>
  )
}
