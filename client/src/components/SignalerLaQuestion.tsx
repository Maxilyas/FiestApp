import { useState } from 'react'
import { Feuille } from './Pieces'
import { Icon } from './Icon'
import { Shape } from './Shape'
import { espacesFines } from '../format'
import { CATEGORIES } from '../../../shared/categories'
import { changementsProposes, texteDuSignalement, type Proposition, type QuestionSignalee } from '../../../shared/signalement'

/** Ce qu'on peut cocher : chaque point ouvre son bloc, dans cet ordre — celui où le QG les relit. */
type Point = 'bonne' | 'texte' | 'classement' | 'autre'

const POINTS: { point: Point; titre: string; aide: string }[] = [
  { point: 'bonne', titre: 'La bonne réponse est fausse', aide: 'Tu sais laquelle est juste' },
  { point: 'texte', titre: 'Il y a une faute', aide: 'Dans la question ou l’anecdote' },
  { point: 'classement', titre: 'Elle est mal classée', aide: 'Trop facile, trop dure, pas la bonne catégorie' },
  { point: 'autre', titre: 'Autre chose', aide: 'Dis-le en une phrase' },
]

const NOM_DU_BLOC: Record<Point, string> = { bonne: 'La bonne réponse', texte: 'Le texte', classement: 'Le classement', autre: 'Autre chose' }

/**
 * Signaler une erreur, en plusieurs points d'un coup (`shared/signalement.ts`).
 * Une seule phrase libre ne disait qu'un défaut à la fois : on coche ce qui
 * cloche, chaque point s'ouvre à sa place — choisir la bonne réponse,
 * corriger le texte là où il est écrit, dire la difficulté —, la feuille
 * tient le compte de ce qui change, et tout part d'un seul envoi.
 *
 * Deux temps dans la même feuille, sa hauteur fixe : les blocs qui s'ouvrent
 * et se ferment sous le doigt ne la font pas sauter. Rien ne part tant que
 * rien ne change, et ce qui part se compose ici (`texteDuSignalement`) : le
 * serveur ne reçoit encore qu'une phrase.
 */
export function SignalerLaQuestion({
  question: q,
  onEnvoyer,
  onFermer,
}: {
  question: QuestionSignalee
  /** Envoie la phrase ; rejetée, son motif se dit dans la feuille, qui reste ouverte. */
  onEnvoyer: (texte: string) => Promise<void>
  onFermer: () => void
}) {
  const [etape, setEtape] = useState<'quoi' | 'corriger'>('quoi')
  const [coches, setCoches] = useState<Point[]>([])
  const [bonne, setBonne] = useState(q.bonne)
  const [texte, setTexte] = useState(q.texte)
  const [anecdote, setAnecdote] = useState(q.anecdote ?? '')
  const [difficulte, setDifficulte] = useState<Proposition['difficulte']>(undefined)
  const [categorie, setCategorie] = useState(q.categorie ?? '')
  const [autre, setAutre] = useState('')
  const [preuve, setPreuve] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const coche = (p: Point) => coches.includes(p)
  const basculer = (p: Point) => setCoches(cs => (cs.includes(p) ? cs.filter(c => c !== p) : POINTS.map(x => x.point).filter(x => x === p || cs.includes(x))))
  // Seuls les blocs ouverts comptent : un bloc retiré garde ce qu'on y a écrit, sans l'envoyer.
  const proposition: Proposition = {
    ...(coche('bonne') && { bonne }),
    ...(coche('texte') && { texte, ...(q.anecdote !== null && { anecdote }) }),
    ...(coche('classement') && { difficulte, ...(categorie && { categorie }) }),
    ...(coche('autre') && { autre }),
    preuve,
  }
  const changements = changementsProposes(q, proposition)
  const n = changements.length

  const envoyer = async () => {
    const phrase = texteDuSignalement(q, proposition)
    if (!phrase || envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      await onEnvoyer(phrase)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'L’envoi n’est pas parti : réessaie dans un instant.')
      setEnvoi(false)
    }
  }

  if (etape === 'quoi') {
    return (
      <Feuille
        titre="Signaler une erreur"
        onFermer={onFermer}
        className="signaler-feuille"
        pied={
          <button type="button" className="btn btn-primary btn-block" disabled={coches.length === 0} onClick={() => setEtape('corriger')}>
            {coches.length === 0 ? 'Coche au moins une case' : coches.length === 1 ? 'Corriger ce point' : `Corriger ces ${coches.length} points`}
          </button>
        }
      >
        <p className="muted">{espacesFines('Coche tout ce qui cloche : tu corrigeras tout sur la même page. L’administrateur relit chaque signalement.')}</p>
        <div className="signaler-cases" role="group" aria-label="Ce qui ne va pas">
          {POINTS.map(({ point, titre, aide }) => (
            <button key={point} type="button" role="checkbox" aria-checked={coche(point)} className="signaler-case" onClick={() => basculer(point)}>
              <span className="signaler-coche" aria-hidden="true">
                {coche(point) && <Icon name="check" />}
              </span>
              <span className="signaler-case-texte">
                <b>{titre}</b>
                <span>{aide}</span>
              </span>
            </button>
          ))}
        </div>
      </Feuille>
    )
  }

  const ajouts = POINTS.filter(p => !coche(p.point))
  return (
    <Feuille
      titre="Corrige ce qui cloche"
      onFermer={onFermer}
      className="signaler-feuille"
      pied={
        <button type="button" className="btn btn-primary btn-block" disabled={n === 0 || envoi} onClick={() => void envoyer()}>
          {n === 0 ? 'Rien ne change encore' : n === 1 ? 'Envoyer ma correction' : `Envoyer mes ${n} corrections`}
        </button>
      }
    >
      <button type="button" className="link-inline signaler-retour" onClick={() => setEtape('quoi')}>
        <Icon name="arrow-left" />
        Ce qui ne va pas
      </button>

      {coche('bonne') && (
        <section className="signaler-bloc" aria-labelledby="signaler-bonne">
          <BlocTete id="signaler-bonne" nom={NOM_DU_BLOC.bonne} onRetirer={() => basculer('bonne')} />
          <div role="radiogroup" aria-labelledby="signaler-bonne" className="signaler-reponses">
            {q.reponses.map((r, i) => (
              <button key={i} type="button" role="radio" aria-checked={bonne === i} className="signaler-reponse" onClick={() => setBonne(i)}>
                <Shape index={i} inline />
                <span>{espacesFines(r)}</span>
                {i === q.bonne && <span className="signaler-donnee">donnée juste</span>}
                {bonne === i && <Icon name="check" />}
              </button>
            ))}
          </div>
        </section>
      )}

      {coche('texte') && (
        <section className="signaler-bloc" aria-labelledby="signaler-texte">
          <BlocTete id="signaler-texte" nom={NOM_DU_BLOC.texte} onRetirer={() => basculer('texte')} />
          <label className="field">
            <span className="label">La question</span>
            <textarea className="input" rows={2} value={texte} onChange={e => setTexte(e.target.value)} />
          </label>
          {q.anecdote !== null && (
            <label className="field">
              <span className="label">Le saviez-vous ?</span>
              <textarea className="input" rows={3} value={anecdote} onChange={e => setAnecdote(e.target.value)} />
            </label>
          )}
        </section>
      )}

      {coche('classement') && (
        <section className="signaler-bloc" aria-labelledby="signaler-classement">
          <BlocTete id="signaler-classement" nom={NOM_DU_BLOC.classement} onRetirer={() => basculer('classement')} />
          {q.marche && <p className="muted small">{espacesFines(`Ici, elle compte pour une ${q.marche}.`)}</p>}
          <div className="signaler-crans" role="group" aria-label="Sa difficulté, d’après toi">
            {(
              [
                [undefined, 'Bien classée'],
                ['trop-facile', 'Trop facile'],
                ['trop-dure', 'Trop dure'],
              ] as const
            ).map(([d, nom]) => (
              <button key={nom} type="button" className="signaler-cran" aria-pressed={difficulte === d} onClick={() => setDifficulte(d)}>
                {nom}
              </button>
            ))}
          </div>
          <label className="field">
            <span className="label">Sa catégorie</span>
            <select className="input" value={categorie} onChange={e => setCategorie(e.target.value)}>
              {!q.categorie && <option value="">Je ne sais pas</option>}
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {coche('autre') && (
        <section className="signaler-bloc" aria-labelledby="signaler-autre">
          <BlocTete id="signaler-autre" nom={NOM_DU_BLOC.autre} onRetirer={() => basculer('autre')} />
          <textarea className="input" rows={2} value={autre} placeholder="Dis-le en une phrase" aria-label="Autre chose" onChange={e => setAutre(e.target.value)} />
        </section>
      )}

      {ajouts.length > 0 && (
        <div className="signaler-ajouts">
          <span className="muted small">{espacesFines('Corriger aussi :')}</span>
          {ajouts.map(p => (
            <button key={p.point} type="button" className="signaler-ajout" onClick={() => basculer(p.point)}>
              + {NOM_DU_BLOC[p.point]}
            </button>
          ))}
        </div>
      )}

      <label className="field">
        <span className="label">Comment le sais-tu ? (facultatif)</span>
        <textarea className="input" rows={2} value={preuve} placeholder="Un lien, un livre, un souvenir précis…" onChange={e => setPreuve(e.target.value)} />
      </label>

      <div className="signaler-recap" role="status" aria-live="polite">
        <span className="label">{n === 0 ? 'Ce qui change' : `Ce qui change · ${n}`}</span>
        {n === 0 ? (
          <p className="muted small">{espacesFines('Rien pour l’instant : corrige ce qui ne va pas au-dessus.')}</p>
        ) : (
          changements.map(c => (
            <p key={c.ou}>
              <span className="muted">{espacesFines(`${c.ou} :`)}</span>{' '}
              {c.avant === null ? (
                <b>{espacesFines(c.apres)}</b>
              ) : (
                <>
                  {c.avant && <s>{espacesFines(c.avant)}</s>} → <b>{espacesFines(c.apres)}</b>
                </>
              )}
            </p>
          ))
        )}
      </div>
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <p className="muted small center">Rien ne change avant la relecture.</p>
    </Feuille>
  )
}

/** La tête d'un bloc : ce qu'il corrige, et de quoi le retirer — il redevient une case à ajouter. */
function BlocTete({ id, nom, onRetirer }: { id: string; nom: string; onRetirer: () => void }) {
  return (
    <div className="signaler-bloc-tete">
      <h3 id={id}>{nom}</h3>
      <button type="button" className="signaler-retirer" onClick={onRetirer}>
        Retirer
      </button>
    </div>
  )
}
