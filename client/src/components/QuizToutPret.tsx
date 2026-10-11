import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { espacesFines } from '../format'
import { GrilleDesCategories, GrilleDesSujets } from './ChoixDuTheme'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { formatNumber } from '../../../shared/typographie'
import { nomDuChoix } from '../../../shared/nomDuChoix'
import { sujetParCle, type Sujet } from '../../../shared/sujets'
import type { Categorie } from '../../../shared/categories'
import type { QuizDef } from '../../../shared/library'
import {
  DIFFICULTES_DU_QUIZ,
  NOMBRES_DU_QUIZ,
  NOMBRE_DU_QUIZ_PAR_DEFAUT,
  UNE_ESTIMATION_SUR,
  type BaseDuQuizToutPret,
  type DifficulteDuQuiz,
} from '../../../shared/quizToutPret'

/**
 * Un quiz tout prêt (`shared/quizToutPret.ts`), dans sa feuille : ses
 * catégories — la grille de la campagne —, la difficulté, combien de
 * questions, des estimations ou non, des enfants ou non, puis les sujets,
 * qui font trois rangées de plus ; « Composer », collé en bas, toujours en
 * vue, sous ce qu'il composera — tout est réglé d'office, et l'animateur
 * pressé n'a qu'un toucher à faire. Le quiz composé rejoint sa
 * bibliothèque : « Créer un quiz » l'ouvre, le salon l'ajoute à ce soir.
 */
export function FeuilleDuQuizToutPret({ onFermer, onCompose }: { onFermer: () => void; onCompose: (quiz: QuizDef) => void }) {
  const [base, setBase] = useState<BaseDuQuizToutPret | null>(null)
  const [erreur, setErreur] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [sujet, setSujet] = useState<string | null>(null)
  const [difficulte, setDifficulte] = useState<DifficulteDuQuiz>('progressive')
  const [nombre, setNombre] = useState(NOMBRE_DU_QUIZ_PAR_DEFAUT)
  const [enfants, setEnfants] = useState(false)
  // Cochées d'office, comme dans les quiz livrés : l'estimation au plus près fait parler la salle.
  const [estimations, setEstimations] = useState(true)
  const [compose, setCompose] = useState(false)

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

  const composer = async () => {
    if (compose || !base) return
    setCompose(true)
    setErreur('')
    try {
      onCompose(await api.quizToutPret.composer({ categories: categories as Categorie[], sujet, difficulte, nombre, enfants, estimations }))
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setCompose(false)
    }
  }

  const sujets = (base?.sujets ?? []).map(sujetParCle).filter((s): s is Sujet => !!s)
  const quoi = nomDuChoix(categories, sujet)
  const laDifficulte = DIFFICULTES_DU_QUIZ.find(d => d.cle === difficulte)!
  return (
    <Feuille
      titre="Un quiz tout prêt"
      onFermer={onFermer}
      pied={
        <>
          {/* Ce que « Composer » va faire, en une ligne : le bouton, lui, ne tient pas les catégories. */}
          <p className="tout-pret-resume">
            {espacesFines(
              `${quoi ?? 'Toutes les catégories'} · ${laDifficulte.nom.toLowerCase()}${enfants ? ' · des enfants jouent' : ''}${estimations ? '' : ' · que des QCM'}`,
            )}
          </p>
          <button type="button" className="btn btn-primary btn-big btn-block" aria-busy={compose || undefined} disabled={!base || compose} onClick={() => void composer()}>
            <Icon name="dice" />
            {compose ? 'Je compose…' : `Composer ${nombre} questions`}
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
          <span className="muted small">{espacesFines('Rien qu’un enfant de dix ans ne puisse connaître')}</span>
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
