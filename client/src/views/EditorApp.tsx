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
  tempsDObservation,
  toPlayable,
  voisineDe,
  type QuizDef,
  type QuizQuestionDef,
  type QuizSummary,
} from '../../../shared/library'
import { CATEGORIES } from '../../../shared/categories'
import { lireNombre } from '../../../shared/nombres'
import { POIDS_MAX_FICHIER, emporterQuiz, importerQuiz, nomDeFichier } from '../../../shared/echange'
import {
  brouillonDepasse,
  brouillonUtile,
  photosAVerifier,
  sansPhotosDisparues,
  type Brouillon,
} from '../../../shared/brouillon'
import { UnauthorizedError, api, auReveil, compressImage } from '../api'
import { garderBrouillon, oublierBrouillon, photosDisparues, retrouverBrouillon } from '../brouillon'
import { questionSizeClass } from '../games/quiz/questionSize'
import { choixDialog, confirmDialog, promptDialog } from '../components/Dialog'
import { Icon } from '../components/Icon'
import { Shape } from '../components/Shape'
import { TimerBar } from '../components/TimerBar'
import { serverNow } from '../clock'
import { LoginForm } from '../components/Invitation'
import { espacesFines } from '../format'

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

/** Une photo de la bibliothèque, en clair, pour qu'elle voyage dans le fichier ; null si elle ne se lit plus. */
async function photoEnClair(adresse: string): Promise<string | null> {
  const res = await fetch(adresse)
  if (!res.ok) return null
  const blob = await res.blob()
  return new Promise(resolve => {
    const lecteur = new FileReader()
    lecteur.onload = () => resolve(typeof lecteur.result === 'string' ? lecteur.result : null)
    lecteur.onerror = () => resolve(null)
    lecteur.readAsDataURL(blob)
  })
}

/** Fait télécharger ce texte sous ce nom, sans passer par le serveur. */
function telecharger(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  // Le téléchargement a besoin de l'adresse un instant après le clic.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function EditorApp() {
  const [needLogin, setNeedLogin] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [busy, setBusy] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [list, setList] = useState<QuizSummary[] | null>(null)
  /** Les quiz dont ce navigateur garde des modifications non enregistrées. */
  const [brouillons, setBrouillons] = useState<ReadonlySet<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  /** Le quiz qu'on emballe, ou l'import en cours : un clic à la fois. */
  const [echange, setEchange] = useState<string | null>(null)
  const fichier = useRef<HTMLInputElement>(null)

  const exporter = async (q: QuizSummary) => {
    setEchange(q.id)
    setError('')
    setNotice('')
    try {
      const quiz = await api.get(q.id)
      const nom = nomDeFichier(quiz.title)
      telecharger(nom, JSON.stringify(await emporterQuiz(quiz, photoEnClair)))
      // Le fichier part en silence dans les téléchargements : sans ce mot, on
      // ne sait ni où il est, ni ce que l'ami doit en faire.
      setNotice(
        `« ${quiz.title} » est dans tes téléchargements : ${nom}. Envoie ce fichier à un autre animateur — ` +
          'il l’ouvre avec « Importer un quiz », en haut de sa page Mes quiz.',
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEchange(null)
    }
  }

  const importer = async (choisi: File | undefined) => {
    if (!choisi) return
    setError('')
    setNotice('')
    if (choisi.size > POIDS_MAX_FICHIER) return setError('Ce fichier est bien trop lourd pour être un quiz')
    let brut: unknown
    try {
      brut = JSON.parse(await choisi.text())
    } catch {
      return setError('Ce fichier ne se lit pas : choisis un quiz exporté de l’application (.quiz.json)')
    }
    setEchange('import')
    try {
      const fait = await importerQuiz(brut, {
        envoyerPhoto: async enClair => (await api.uploadImage(enClair)).url,
        creer: (titre, questions) => api.create(titre, questions),
      })
      setNotice(
        `« ${fait.quiz.title} » est dans ta bibliothèque : ${fait.questions} question${fait.questions > 1 ? 's' : ''}` +
          (fait.photos > 0 ? `, ${fait.photos} photo${fait.photos > 1 ? 's' : ''}` : '') +
          (fait.photosIgnorees > 0 ? ` — ${fait.photosIgnorees} photo${fait.photosIgnorees > 1 ? 's' : ''} ignorée${fait.photosIgnorees > 1 ? 's' : ''}, dans un format inconnu` : ''),
      )
      reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEchange(null)
    }
  }

  const reload = useCallback(async () => {
    try {
      const quizzes = await api.list()
      setList(quizzes)
      // Signalés ici : sans quoi on ne les retrouvait qu'en ouvrant le bon quiz.
      setBrouillons(new Set(quizzes.filter(q => retrouverBrouillon(q.id)).map(q => q.id)))
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
          {/* Un quiz exporté d'une autre bibliothèque — celle d'un ami, ou d'un autre serveur. */}
          <input
            ref={fichier}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={e => {
              const choisi = e.target.files?.[0]
              // Le même fichier, choisi deux fois de suite, doit repartir.
              e.target.value = ''
              importer(choisi)
            }}
          />
          <button className="btn btn-ghost" disabled={echange !== null} onClick={() => fichier.current?.click()}>
            <Icon name="download" />
            {echange === 'import' ? 'Import…' : 'Importer un quiz'}
          </button>
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
      {notice && <p className="card notice">{notice}</p>}
      {list === null && <p className="serif-note">Chargement…</p>}

      {list?.length === 0 && (
        <div className="card notice">
          <p>Aucun quiz pour l'instant. Crée le premier !</p>
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
              {brouillons.has(q.id) && (
                <p className="warn small">
                  <Icon name="edit" /> Des modifications non enregistrées t’attendent dans ce navigateur
                </p>
              )}
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
                disabled={echange !== null}
                title="Un fichier à envoyer à un autre animateur, qui l’ouvre avec « Importer un quiz » : les questions et leurs photos"
                onClick={() => exporter(q)}
              >
                {echange === q.id ? 'Export…' : 'Exporter'}
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
                    oublierBrouillon(q.id)
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
  /** L'enregistrement attend que le serveur se réveille (voir `auReveil`). */
  const [reveil, setReveil] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  /**
   * Des modifications de ce quiz que ce navigateur a gardées sans que le
   * serveur les ait enregistrées. Tant qu'on n'a pas choisi de les reprendre
   * ou de les effacer, l'éditeur reste fermé : la première touche tapée dans
   * la version du serveur aurait écrasé le brouillon.
   */
  const [retrouve, setRetrouve] = useState<Brouillon | null>(null)
  const [reprise, setReprise] = useState<'en-cours' | 'faite' | null>(null)
  /** Les questions dont la photo n'existait plus sur le serveur quand on a repris le brouillon. */
  const [sansPhoto, setSansPhoto] = useState<ReadonlySet<string>>(new Set())
  /** `updatedAt` de la version du serveur d'où partent les modifications en cours. */
  const [base, setBase] = useState(0)
  /** Faux quand le navigateur refuse de garder le brouillon : l'éditeur ne promet plus rien. */
  const [garde, setGarde] = useState(true)
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

  /**
   * Le quiz tel qu'il est à l'instant, et le compte de ses modifications.
   * Un enregistrement peut attendre le réveil deux minutes, et l'on continue
   * d'écrire pendant ce temps : chaque essai envoie le quiz du moment, et la
   * version du serveur ne remplace celle de l'éditeur que si rien n'a bougé
   * depuis l'essai qui a abouti. Remplacée d'office, elle effaçait ce qu'on
   * avait tapé en attendant.
   */
  const courant = useRef<QuizDef | null>(null)
  const modifications = useRef(0)
  /** Faux une fois l'éditeur refermé : l'enregistrement cesse d'attendre le réveil. */
  const ouvert = useRef(true)

  const poser = (q: QuizDef) => {
    courant.current = q
    setQuiz(q)
  }

  useEffect(() => {
    ouvert.current = true
    return () => {
      ouvert.current = false
    }
  }, [])

  useEffect(() => {
    api
      .get(id)
      .then(serveur => {
        const brouillon = retrouverBrouillon(id)
        if (brouillon && brouillonUtile(brouillon, serveur)) setRetrouve(brouillon)
        else if (brouillon) oublierBrouillon(id)
        setBase(serveur.updatedAt)
        poser(serveur)
      })
      .catch(e => setError((e as Error).message))
  }, [id])

  // Ce qui n'est pas enregistré va aussi dans le navigateur, et s'en efface
  // une fois enregistré — ou défait (`undoMove`).
  useEffect(() => {
    if (!quiz || retrouve) return
    if (dirty) setGarde(garderBrouillon(quiz, base))
    else oublierBrouillon(quiz.id)
  }, [quiz, dirty, base, retrouve])

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
    if (!courant.current) return
    modifications.current++
    poser(fn(courant.current))
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

  /**
   * Une question vide juste après celle-ci, le curseur déjà dans son
   * intitulé — avec son temps et sa catégorie (voir emptyQuestion).
   */
  const insertAfter = (index: number) => {
    const question = emptyQuestion(quiz?.questions[index])
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
    if (!courant.current) return
    setSaving(true)
    setError('')
    let envoi = { quiz: courant.current, modifications: modifications.current }
    try {
      const saved = await auReveil(
        () => {
          envoi = { quiz: courant.current ?? envoi.quiz, modifications: modifications.current }
          return api.save(envoi.quiz.id, envoi.quiz.title, envoi.quiz.questions)
        },
        { surAttente: () => setReveil(true), continuer: () => ouvert.current },
      )
      setBase(saved.updatedAt)
      setSavedAt(Date.now())
      if (modifications.current === envoi.modifications) {
        poser(saved)
        setDirty(false)
        setReprise(null)
        // Enregistré, le déplacement est acquis : le défaire ensuite serait une
        // modification comme une autre, pas un retour à l'état enregistré.
        setUndo(null)
      } else {
        // On a écrit pendant l'envoi : ce qui a suivi reste à enregistrer —
        // même un déplacement défait, que le serveur, lui, a reçu.
        setDirty(true)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
      setReveil(false)
    }
  }

  const close = async () => {
    if (dirty && garde) {
      // Le brouillon attend dans ce navigateur : partir ne perd plus rien, et
      // effacer ce qu'on a écrit devient un geste à part.
      const choix = await choixDialog({
        title: 'Quitter sans enregistrer ?',
        message: 'Ce navigateur garde tes modifications : tu les retrouveras en rouvrant ce quiz.',
        confirmLabel: 'Quitter',
        cancelLabel: 'Rester',
        alternative: { label: 'Effacer mes modifications', danger: true },
      })
      if (!choix) return
      if (choix.geste === 'alternative') oublierBrouillon(id)
    } else if (dirty) {
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

  const reprendre = async () => {
    const serveur = courant.current
    if (!retrouve || !serveur) return
    setReprise('en-cours')
    // Une photo envoyée mais jamais enregistrée a pu être effacée depuis
    // (voir `photosAVerifier`) : repartie telle quelle, elle manquait en soirée.
    const disparues = await photosDisparues(photosAVerifier(retrouve, serveur))
    const { questions, privees } = sansPhotosDisparues(retrouve.questions, disparues)
    modifications.current++
    poser({ ...serveur, title: retrouve.title, questions })
    setDirty(true)
    setSansPhoto(new Set(privees))
    setRetrouve(null)
    setReprise('faite')
  }

  const effacerLeBrouillon = async () => {
    if (!quiz) return
    const ok = await confirmDialog({
      title: 'Effacer ces modifications ?',
      message: `Le quiz s’ouvrira tel qu’il a été enregistré, le ${formatDate(quiz.updatedAt)}.`,
      confirmLabel: 'Effacer',
      danger: true,
    })
    if (!ok) return
    oublierBrouillon(id)
    setRetrouve(null)
  }

  if (!quiz) {
    return (
      <div className="center-page">
        <p className={error ? 'error' : 'serif-note'}>{error || 'Chargement…'}</p>
      </div>
    )
  }

  if (retrouve) {
    return (
      <div className="center-page">
        <div className="card brouillon-carte">
          <h2>
            <Icon name="edit" />
            Des modifications t’attendent
          </h2>
          <p>
            {espacesFines(
              `Ce navigateur a gardé des modifications de « ${quiz.title} » qui n’ont pas été enregistrées — ` +
                `les dernières le ${formatDate(retrouve.at)}.`,
            )}
          </p>
          {brouillonDepasse(retrouve, quiz) && (
            <p className="warn">
              <Icon name="alert" />{' '}
              {espacesFines(
                `Le quiz a été enregistré depuis, le ${formatDate(quiz.updatedAt)} — d’un autre appareil ? ` +
                  'Les reprendre remplacera cette version quand tu enregistreras.',
              )}
            </p>
          )}
          <div className="row">
            <button className="btn btn-primary" disabled={reprise === 'en-cours'} onClick={reprendre}>
              {reprise === 'en-cours' ? 'Reprise…' : 'Reprendre mes modifications'}
            </button>
            <button className="btn btn-ghost" disabled={reprise === 'en-cours'} onClick={effacerLeBrouillon}>
              Les effacer
            </button>
            <button className="btn btn-ghost" disabled={reprise === 'en-cours'} onClick={onClose}>
              Retour
            </button>
          </div>
        </div>
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
              reveil ? 'Réveil du serveur…' : 'Enregistrement…'
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

      {reveil && (
        <p className="info" role="status">
          {espacesFines(
            'Le serveur dormait : il se réveille, ça prend environ une minute. Tu peux continuer à écrire' +
              (garde ? ', ce navigateur garde tes modifications.' : '.'),
          )}
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {/* Le message d'échec pousse à recharger la page : c'était là qu'on perdait tout. */}
      {error && dirty && garde && (
        <p className="muted">
          {espacesFines('Rien n’est perdu : ce navigateur garde tes modifications, même si tu fermes la page.')}
        </p>
      )}
      {reprise === 'faite' && (
        <p className="info" role="status">
          {espacesFines(
            'Tes modifications sont reprises : enregistre-les pour les garder.' +
              (sansPhoto.size === 1 ? ' Une photo n’existait plus sur le serveur : sa question le signale.' : '') +
              (sansPhoto.size > 1
                ? ` ${sansPhoto.size} photos n’existaient plus sur le serveur : leurs questions le signalent.`
                : ''),
          )}
        </p>
      )}
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
          photoDisparue={!!question.id && sansPhoto.has(question.id)}
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
            // La dernière prête ses réglages : un quiz se règle d'un bloc.
            const question = emptyQuestion(quiz.questions[quiz.questions.length - 1])
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
          questions={quiz.questions}
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
 *
 * Un brouillon se projette aussi, tel qu'il est : l'animatrice de la première
 * tablée tapait deux fausses réponses pour voir sa photo en grand. Ce qui
 * manque est dit au-dessus, et la question ne sera pas jouée pour autant.
 */
function QuestionPreview({ question, onClose }: { question: QuizQuestionDef; onClose: () => void }) {
  const problem = questionProblem(question)
  const text = question.text.trim()
  const observe = tempsDObservation(question)
  // Une photo « mémoire » passe d'abord seule, comme dans la salle : l'aperçu
  // en joue le compte à rebours, puis la question sans la photo.
  const [observeUntil, setObserveUntil] = useState<number | null>(() =>
    observe ? serverNow() + observe * 1000 : null,
  )
  useEffect(() => {
    if (observeUntil === null) return
    const timer = setTimeout(() => setObserveUntil(null), Math.max(0, observeUntil - serverNow()))
    return () => clearTimeout(timer)
  }, [observeUntil])
  const observing = observeUntil !== null
  // Échap referme l'aperçu, comme n'importe quelle fenêtre.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  // Les cases vides ne sont pas projetées : la partie les retire aussi.
  const answers = question.answers.map(a => a.trim()).filter(a => a.length > 0)
  return (
    <div className="preview-backdrop" onClick={onClose}>
      <div
        className="preview-frame"
        role="dialog"
        aria-modal="true"
        aria-label="Aperçu de l'écran commun"
        onClick={e => e.stopPropagation()}
      >
        {problem && (
          <p className="warn">
            <Icon name="alert" /> {problem} — cette question ne sera pas jouée.
          </p>
        )}
        {observing ? (
          <div className="preview-stage">
            <div className="quiz-status">
              <span className="pill flash">
                <Icon name="eye" /> Regardez bien…
              </span>
            </div>
            <TimerBar deadline={observeUntil} duration={observe ?? 5} />
            {question.image && <img className="quiz-img observe-img" src={question.image} alt="Photo à observer" />}
          </div>
        ) : (
          <div className="preview-stage">
            {question.category && <span className="label quiz-categorie">{question.category}</span>}
            {text ? (
              <h2 className={'quiz-question' + questionSizeClass(text)}>{text}</h2>
            ) : (
              <p className="serif-note">L'intitulé de la question s'affichera ici.</p>
            )}
            {question.image && observe === null && <img className="quiz-img" src={question.image} alt="Photo de la question" />}
            {observe !== null && (
              <p className="photo-gone">
                <Icon name="eye-off" /> La photo a disparu — de mémoire !
              </p>
            )}
            {question.kind === 'number' ? (
              <p className="big-waiting">
                <Icon name="keyboard" /> Chacun tape son estimation
                {question.unit.trim() ? ` (en ${question.unit.trim()})` : ''} — le plus proche gagne !
              </p>
            ) : (
              answers.length > 0 && (
                <div className="ans-grid">
                  {answers.map((a, i) => (
                    <div key={i} className={`ans-btn ans-${i}`}>
                      <Shape index={i} />
                      <span className="ans-text">{a}</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
        <div className="row">
          <span className="muted">
            Aperçu de l'écran commun ·{' '}
            {observing ? `la photo seule, ${observe} s` : `${question.duration} s pour répondre`}
          </span>
          <div className="row">
            {observing ? (
              <button className="btn btn-ghost btn-small" onClick={() => setObserveUntil(null)}>
                <Icon name="skip" />
                Passer à la question
              </button>
            ) : (
              observe !== null && (
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => setObserveUntil(serverNow() + observe * 1000)}
                >
                  <Icon name="rotate" />
                  Revoir la photo
                </button>
              )
            )}
            <button className="btn btn-ghost btn-small" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * La photo en grand, seule. La vignette de la carte suffit à la reconnaître,
 * pas à la lire : on n'y comptait pas les bougies d'un gâteau.
 */
function PhotoLoupe({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="preview-backdrop" onClick={onClose}>
      <div
        className="preview-frame loupe-frame"
        role="dialog"
        aria-modal="true"
        aria-label="La photo en grand"
        onClick={e => e.stopPropagation()}
      >
        <img className="loupe-img" src={src} alt="Photo de la question, en grand" />
        <div className="row">
          <span className="muted">La photo telle qu'elle sera projetée, en grand</span>
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
  questions,
  onImport,
  onCancel,
}: {
  /** Questions déjà dans le quiz : la liste collée arrive après, sauf avis contraire. */
  questions: QuizQuestionDef[]
  /** Les questions reconnues, et le numéro que prendra la première. */
  onImport: (questions: QuizQuestionDef[], number: number) => void
  onCancel: () => void
}) {
  const total = questions.length
  const [text, setText] = useState('')
  const [at, setAt] = useState(String(total + 1))
  // Un champ vide ou illisible vaut « à la fin » ; un numéro trop grand aussi.
  const typed = Number.parseInt(at, 10)
  const number = Number.isNaN(typed) ? total + 1 : Math.min(total + 1, Math.max(1, typed))
  // Les questions collées prennent les réglages de celle qui les précédera.
  const result = parseImportedQuestions(text, voisineDe(questions, number))
  const count = result.questions.length
  // Ce que chaque « = … » a donné, la cible à part de l'unité. « 10 935
  // mètres » lu comme 10, avec « 935 mètres » pour unité, s'affichait à
  // l'identique à la révélation — et classait toute la salle sur un faux.
  const estimations = result.questions.filter(q => q.kind === 'number')

  return (
    <div className="card import-panel">
      <h3>
        <Icon name="clipboard" />
        Coller une liste de questions
      </h3>
      <p className="muted">
        Une ligne vide entre deux questions. L'étoile marque la bonne réponse ; le signe égal
        transforme la question en estimation chiffrée. Une ligne qui commence par un dièse range
        les questions qui suivent dans une catégorie — « # Musique », « # Cinéma »… Sans dièse, elles
        prennent le temps et la catégorie de la question qui les précède.
      </p>
      <pre className="import-example">{`# Géographie

Quelle est la capitale de l'Australie ?
Sydney
* Canberra
Melbourne

Combien de pays composent l'Union européenne ?
= 27 pays`}</pre>
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
      {estimations.length > 0 && (
        <div>
          <p className="muted small">
            Les estimations, telles qu'elles seront jouées — la valeur à trouver en gras, l'unité à
            côté. Un nombre illisible compte parmi les blocs ignorés.
          </p>
          <ul className="import-lues">
            {estimations.map((q, i) => (
              <li key={i}>
                <span className="import-lue-texte">{q.text}</span>
                <span className="import-lue-valeur">
                  {/* Sans séparateur de milliers : « 10935 » se lit comme un
                      seul nombre, « 10 935 » ressemblerait à la saisie. */}
                  <strong>{String(q.target).replace('.', ',')}</strong>{' '}
                  {q.unit || <span className="muted">sans unité</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
  /** Sa photo n'existait plus sur le serveur à la reprise du brouillon : elle le dit, jusqu'à la suivante. */
  photoDisparue: boolean
  /** Non nul quand la carte vient d'arriver ici : on la montre, on l'éclaire. */
  spot: Spot | null
  onChange: (fn: (q: QuizQuestionDef) => QuizQuestionDef) => void
  /** La question prend ce numéro ; `focus` dit quel bouton a servi, pour le lui rendre. */
  onMoveTo: (number: number, focus: Spot['focus']) => void
  onInsertAfter: () => void
  onDuplicate: () => void
  onDelete: () => void
}

/** Une cible rendue au champ comme on l'écrit : « 0,8 », pas « 0.8 ». */
function cibleAffichee(target: number | null): string {
  return target === null ? '' : String(target).replace('.', ',')
}

function QuestionCard({
  index,
  total,
  question,
  photoDisparue,
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
  const [loupe, setLoupe] = useState(false)
  const [busy, setBusy] = useState(false)
  const [imageError, setImageError] = useState('')
  const problem = questionProblem(question)
  // La cible telle qu'on la tape. Relu en nombre à chaque touche, le champ
  // mangeait ce qui n'en est pas encore un : la virgule de « 0,8 » (la cible
  // devenait 8, sans un mot) et le signe de « -40 ».
  const [cible, setCible] = useState(() => cibleAffichee(question.target))
  useEffect(() => {
    // Une cible changée sans passer par ce champ y revient ; celle qu'on tape
    // garde son texte.
    if (lireNombre(cible) !== question.target) setCible(cibleAffichee(question.target))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.target])

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
              value={cible}
              onChange={e => {
                const target = lireNombre(e.target.value)
                setCible(e.target.value)
                onChange(q => ({ ...q, target }))
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
            Personne n'est bloqué : chacun propose un nombre, et plus il tombe près, plus il rapporte — la même
            distance, les mêmes points.
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
        {/* La catégorie : une liste fixe, la même chez tous les animateurs —
            c'est ce qui permet à la fiche d'un joueur de l'additionner d'une
            soirée à l'autre. */}
        <label className="row">
          <span className="muted">Catégorie</span>
          <select
            className="team-emoji-select categorie-select"
            aria-label="Catégorie de la question"
            value={question.category ?? ''}
            onChange={e => onChange(q => ({ ...q, category: e.target.value || null }))}
          >
            <option value="">Aucune</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
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
            <button
              type="button"
              className="thumb-btn"
              title="Voir la photo en grand"
              aria-label="Voir la photo en grand"
              onClick={() => setLoupe(true)}
            >
              <img className="thumb" src={question.image} alt="" />
              <Icon name="maximize" />
            </button>
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
      {loupe && question.image && <PhotoLoupe src={question.image} onClose={() => setLoupe(false)} />}
      {imageError && <p className="error">{imageError}</p>}
      {photoDisparue && !question.image && (
        <p className="warn">
          <Icon name="alert" />{' '}
          {espacesFines('La photo de cette question n’existe plus sur le serveur : ajoute-la de nouveau.')}
        </p>
      )}
      {problem && (
        <p className="warn">
          <Icon name="alert" /> {problem} — cette question ne sera pas jouée.
        </p>
      )}
    </div>
  )
}
