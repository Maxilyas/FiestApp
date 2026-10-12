import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { espacesFines } from '../format'
import { GrilleDesCategories, GrilleDesSujets } from './ChoixDuTheme'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { formatNumber } from '../../../shared/typographie'
import { sujetParCle, type Sujet } from '../../../shared/sujets'
import { CATEGORIES, type Categorie } from '../../../shared/categories'
import { ecrireDuree, type QuizDef } from '../../../shared/library'
import {
  DIFFICULTES_DU_QUIZ,
  NOMBRES_DU_QUIZ,
  NOMBRE_DU_QUIZ_PAR_DEFAUT,
  UNE_ESTIMATION_SUR,
  dureeDuQuizToutPretS,
  nommerLesCategories,
  type ApercuDuQuiz,
  type BaseDuQuizToutPret,
  type ChoixDuQuiz,
  type DifficulteDuQuiz,
} from '../../../shared/quizToutPret'

/**
 * Ce que « Composer » va faire, en une ligne : sur quoi — ses catégories
 * nommées, trois au plus : « 3 catégories » ne disait pas lesquelles —, la
 * difficulté, la durée ; et, l'aperçu du serveur venu, ce que la base en
 * donnera vraiment : moins de questions quand le choix est étroit, et ses
 * estimations. « Des estimations » promettait une question sur cinq, et un
 * sujet en a parfois moins, ou aucune — « Les records » (l'animatrice
 * exigeante, le 11 octobre 2026).
 */
export function resumeDuQuiz(choix: ChoixDuQuiz, apercu: ApercuDuQuiz | null): string {
  const quoi = (choix.sujet && sujetParCle(choix.sujet)?.nom) || nommerLesCategories(choix.categories) || 'Toutes les catégories'
  const difficulte = DIFFICULTES_DU_QUIZ.find(d => d.cle === choix.difficulte)?.nom.toLowerCase() ?? ''
  const duree = ecrireDuree(dureeDuQuizToutPretS(apercu?.questions ?? choix.nombre, choix.estimations, apercu?.estimations))
  const morceaux = [quoi, difficulte, duree]
  if (apercu && apercu.questions < choix.nombre) morceaux.push(`${apercu.questions} questions seulement`)
  if (choix.enfants) morceaux.push('des enfants jouent')
  if (!choix.estimations) morceaux.push('que des QCM')
  else if (apercu) {
    // Une sur cinq des questions qu'il aura : un choix étroit en a moins, et ses estimations avec elles.
    const voulues = Math.round(apercu.questions / UNE_ESTIMATION_SUR)
    const e = apercu.estimations
    const s = e > 1 ? 's' : ''
    morceaux.push(e === 0 ? 'aucune estimation ici' : e < voulues ? `${e} estimation${s} seulement` : `dont ${e} estimation${s}`)
  }
  return morceaux.join(' · ')
}

/**
 * Le dernier choix composé, retenu sur ce téléphone : qui compose un second
 * quiz pour la même tablée — une manche de plus — retrouve ses catégories,
 * sa difficulté, ses enfants, au lieu de tout rechoisir. Relu prudemment :
 * une catégorie ou un sujet que ce téléphone ne connaît plus n'y revient pas.
 * Sous try/catch : des cookies bloqués donnaient une page noire.
 */
const CLE_DU_CHOIX = 'quizz.quizToutPret'
export function choixRetenu(): Partial<ChoixDuQuiz> {
  try {
    const lu: unknown = JSON.parse(localStorage.getItem(CLE_DU_CHOIX) ?? '{}')
    if (!lu || typeof lu !== 'object' || Array.isArray(lu)) return {}
    const b = lu as Record<string, unknown>
    const categories = Array.isArray(b.categories) ? b.categories : null
    const difficulte = DIFFICULTES_DU_QUIZ.find(d => d.cle === b.difficulte)?.cle
    return {
      ...(categories && { categories: CATEGORIES.filter(c => categories.includes(c)) }),
      ...(typeof b.sujet === 'string' && sujetParCle(b.sujet) && { sujet: b.sujet }),
      ...(difficulte && { difficulte }),
      ...(typeof b.nombre === 'number' && NOMBRES_DU_QUIZ.includes(b.nombre) && { nombre: b.nombre }),
      ...(typeof b.enfants === 'boolean' && { enfants: b.enfants }),
      ...(typeof b.estimations === 'boolean' && { estimations: b.estimations }),
    }
  } catch {
    return {}
  }
}
function retenirLeChoix(choix: ChoixDuQuiz) {
  try {
    localStorage.setItem(CLE_DU_CHOIX, JSON.stringify(choix))
  } catch {
    // Sans stockage, la feuille repart réglée d'office : rien de plus grave.
  }
}

/**
 * Un quiz tout prêt (`shared/quizToutPret.ts`), dans sa feuille : ses
 * catégories — la grille de la campagne —, la difficulté, combien de
 * questions, des estimations ou non, des enfants ou non, puis les sujets,
 * qui font trois rangées de plus ; « Composer », collé en bas, toujours en
 * vue, sous ce qu'il composera — tout est réglé d'office, et l'animateur
 * pressé n'a qu'un toucher à faire. Le quiz composé rejoint sa
 * bibliothèque : « Créer un quiz » l'ouvre, le salon l'ajoute à ce soir.
 */
export function FeuilleDuQuizToutPret({
  onFermer,
  onCompose,
  verbe = 'Composer',
}: {
  onFermer: () => void
  onCompose: (quiz: QuizDef) => void
  /** Ce que fait son bouton : « Composer », ou « Lancer » à la console, où le quiz composé se joue aussitôt. */
  verbe?: string
}) {
  const [base, setBase] = useState<BaseDuQuizToutPret | null>(null)
  const [erreur, setErreur] = useState('')
  const [retenu] = useState(choixRetenu)
  const [categories, setCategories] = useState<string[]>(retenu.categories ?? [])
  const [sujet, setSujet] = useState<string | null>(retenu.sujet ?? null)
  const [difficulte, setDifficulte] = useState<DifficulteDuQuiz>(retenu.difficulte ?? 'progressive')
  const [nombre, setNombre] = useState(retenu.nombre ?? NOMBRE_DU_QUIZ_PAR_DEFAUT)
  const [enfants, setEnfants] = useState(retenu.enfants ?? false)
  // Cochées d'office, comme dans les quiz livrés : l'estimation au plus près fait parler la salle.
  const [estimations, setEstimations] = useState(retenu.estimations ?? true)
  const [compose, setCompose] = useState(false)
  const choix: ChoixDuQuiz = { categories: categories as Categorie[], sujet, difficulte, nombre, enfants, estimations }
  const cleDuChoix = JSON.stringify(choix)
  // L'aperçu du choix d'à présent : celui d'un autre choix, en route, ne se lit pas.
  const [apercu, setApercu] = useState<{ pour: string; lu: ApercuDuQuiz } | null>(null)

  useEffect(() => {
    let ouverte = true
    api.quizToutPret
      .base()
      .then(b => ouverte && setBase(b))
      .catch(e => ouverte && setErreur(motifDe(e)))
    return () => {
      ouverte = false
    }
  }, [])

  // Ce que le choix composerait, demandé un quart de seconde après le dernier toucher : pas une requête par pastille effleurée.
  useEffect(() => {
    if (!base) return
    let vivant = true
    const lu = JSON.parse(cleDuChoix) as ChoixDuQuiz
    const minuterie = setTimeout(() => {
      api.quizToutPret
        .apercu(lu)
        .then(a => vivant && setApercu({ pour: cleDuChoix, lu: a }))
        // Sans aperçu, la ligne dit ce qu'elle disait : rien de faux.
        .catch(() => {})
    }, 250)
    return () => {
      vivant = false
      clearTimeout(minuterie)
    }
  }, [base, cleDuChoix])

  const composer = async () => {
    if (compose || !base) return
    setCompose(true)
    setErreur('')
    try {
      const quiz = await api.quizToutPret.composer(choix)
      retenirLeChoix(choix)
      onCompose(quiz)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setCompose(false)
    }
  }

  const sujets = (base?.sujets ?? []).map(sujetParCle).filter((s): s is Sujet => !!s)
  const laDifficulte = DIFFICULTES_DU_QUIZ.find(d => d.cle === difficulte)!
  const lu = apercu && apercu.pour === cleDuChoix ? apercu.lu : null
  return (
    <Feuille
      titre="Un quiz tout prêt"
      onFermer={onFermer}
      pied={
        <>
          {/* Ce que « Composer » va faire, en une ligne — et combien de temps il durera : le bouton, lui, ne tient pas les catégories. */}
          <p className="tout-pret-resume" aria-live="polite">
            {espacesFines(resumeDuQuiz(choix, lu))}
          </p>
          <button type="button" className="btn btn-primary btn-big btn-block" aria-busy={compose || undefined} disabled={!base || compose} onClick={() => void composer()}>
            <Icon name="dice" />
            {/* Ce que la base donnera vraiment, l'aperçu venu : « Composer 12 questions » quand le choix est étroit. */}
            {compose ? 'Je compose…' : `${verbe} ${lu && lu.questions > 0 && lu.questions < nombre ? lu.questions : nombre} questions`}
          </button>
        </>
      }
    >
      <p className="tout-pret-intro">
        {base
          ? espacesFines(`Tiré de ${formatNumber(base.total)} questions relues, chacune avec son anecdote. Il rejoint tes quiz : tu le retouches à ton goût.`)
          : 'Les questions arrivent…'}
      </p>

      <section className="tout-pret-etape" aria-labelledby="tout-pret-quoi">
        <span className="label" id="tout-pret-quoi">
          Sur quoi&nbsp;?
        </span>
        {base && (
          <GrilleDesCategories
            categoriesJouables={base.categories}
            categories={categories}
            sujet={sujet}
            onCategories={c => {
              setCategories(c)
              setSujet(null)
            }}
          />
        )}
      </section>

      <section className="tout-pret-etape" aria-labelledby="tout-pret-difficulte">
        <span className="label" id="tout-pret-difficulte">
          La difficulté
        </span>
        <div className="tout-pret-pastilles" role="group" aria-labelledby="tout-pret-difficulte">
          {DIFFICULTES_DU_QUIZ.map(d => (
            <button key={d.cle} type="button" className={'pill-btn' + (difficulte === d.cle ? ' active' : '')} aria-pressed={difficulte === d.cle} onClick={() => setDifficulte(d.cle)}>
              {d.nom}
            </button>
          ))}
        </div>
        <p className="muted small">{espacesFines(laDifficulte.detail)}</p>
      </section>

      <section className="tout-pret-etape" aria-labelledby="tout-pret-nombre">
        <span className="label" id="tout-pret-nombre">
          Combien de questions&nbsp;?
        </span>
        <div className="tout-pret-pastilles" role="group" aria-labelledby="tout-pret-nombre">
          {NOMBRES_DU_QUIZ.map(n => (
            <button key={n} type="button" className={'pill-btn' + (nombre === n ? ' active' : '')} aria-pressed={nombre === n} onClick={() => setNombre(n)}>
              {n}
            </button>
          ))}
        </div>
      </section>

      <label className="tout-pret-case">
        <input type="checkbox" checked={estimations} onChange={e => setEstimations(e.target.checked)} />
        <span>
          <b>Des estimations</b>
          <span className="muted small">{espacesFines(`Une question sur ${UNE_ESTIMATION_SUR} se joue au plus près : une année, un nombre`)}</span>
        </span>
      </label>
      <label className="tout-pret-case">
        <input type="checkbox" checked={enfants} onChange={e => setEnfants(e.target.checked)} />
        <span>
          <b>Des enfants jouent</b>
          <span className="muted small">{espacesFines('D’abord ce que les enfants savent, et rien qu’un enfant de dix ans ne puisse comprendre')}</span>
        </span>
      </label>

      <GrilleDesSujets sujets={sujets} sujet={sujet} onSujet={setSujet} />

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
    </Feuille>
  )
}
