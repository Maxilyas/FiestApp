import { useEffect, useRef, useState } from 'react'
import { Feuille } from './Pieces'
import { Icon } from './Icon'
import { Shape } from './Shape'
import { EMBLEME } from './Ecusson'
import { espacesFines } from '../format'
import { CATEGORIES } from '../../../shared/categories'
import { changementsProposes, decoupage, texteDuSignalement, type Proposition, type QuestionSignalee } from '../../../shared/signalement'

/**
 * Signaler une erreur, en touchant ce qui cloche (`shared/signalement.ts`).
 * La feuille est la question elle-même, telle qu'on vient de la jouer : on
 * touche la bonne réponse et la coche s'y déplace ; on touche le texte et on
 * le corrige sur place — le mot fautif barré, le nouveau en or, dans la
 * phrase ; la difficulté et la catégorie sont des pastilles. Ni case à
 * cocher, ni formulaire à remplir : une liste de cases et ses explications
 * faisaient un mur de texte (le retour du propriétaire du 2 novembre 2026 :
 * « trop de texte, pas assez vivant, il faut que ce soit plus visuel »).
 *
 * Tout part d'un seul envoi : ce qui part se compose ici
 * (`texteDuSignalement`), le serveur ne reçoit encore qu'une phrase. La
 * feuille garde sa hauteur : ce qui s'ouvre sous le doigt ne la fait pas
 * sauter.
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
  const [bonne, setBonne] = useState(q.bonne)
  const [texte, setTexte] = useState(q.texte)
  const [anecdote, setAnecdote] = useState(q.anecdote ?? '')
  const [difficulte, setDifficulte] = useState<Proposition['difficulte']>(undefined)
  const [categorie, setCategorie] = useState(q.categorie ?? '')
  const [autre, setAutre] = useState<string | null>(null)
  const [preuve, setPreuve] = useState('')
  const [edition, setEdition] = useState<'texte' | 'anecdote' | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const proposition: Proposition = {
    bonne,
    texte,
    ...(q.anecdote !== null && { anecdote }),
    difficulte,
    ...(categorie && { categorie }),
    ...(autre !== null && { autre }),
    preuve,
  }
  const n = changementsProposes(q, proposition).length
  // Une pastille de difficulté se touche une fois pour la choisir, une seconde pour la retirer.
  const basculerDifficulte = (d: NonNullable<Proposition['difficulte']>) => setDifficulte(actuelle => (actuelle === d ? undefined : d))

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

  return (
    <Feuille
      titre="Qu’est-ce qui cloche ?"
      onFermer={onFermer}
      className="signaler-feuille"
      pied={
        <button type="button" className="btn btn-primary btn-block" disabled={n === 0 || envoi} onClick={() => void envoyer()}>
          {n === 0 ? 'Touche ce qui ne va pas' : n === 1 ? 'Envoyer ma correction' : `Envoyer mes ${n} corrections`}
        </button>
      }
    >
      <div className="signaler-carte">
        <TexteATouche
          nom="la question"
          avant={q.texte}
          valeur={texte}
          enEdition={edition === 'texte'}
          onEditer={() => setEdition('texte')}
          onFini={() => setEdition(null)}
          onChange={setTexte}
          className="signaler-question"
        />
        <div className="ans-grid signaler-reponses" role="radiogroup" aria-label="La bonne réponse">
          {q.reponses.map((r, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={bonne === i}
              className={'ans-btn signaler-reponse' + (bonne === i ? ' chosen' : '') + (i === q.bonne && bonne !== i ? ' signaler-ancienne' : '')}
              onClick={() => setBonne(i)}
            >
              <Shape index={i} />
              <span className="ans-text">{espacesFines(r)}</span>
              {bonne === i && (
                <span className="signaler-coche" aria-hidden="true">
                  <Icon name="check" />
                </span>
              )}
            </button>
          ))}
        </div>
        {q.anecdote !== null && (
          <TexteATouche
            nom="l’anecdote"
            avant={q.anecdote}
            valeur={anecdote}
            enEdition={edition === 'anecdote'}
            onEditer={() => setEdition('anecdote')}
            onFini={() => setEdition(null)}
            onChange={setAnecdote}
            className="signaler-anecdote"
            icone="message"
          />
        )}
      </div>

      <div className="signaler-pastilles">
        <button type="button" className="signaler-pastille" aria-pressed={difficulte === 'trop-facile'} onClick={() => basculerDifficulte('trop-facile')}>
          <Jauge pleines={1} />
          Trop facile
        </button>
        <button type="button" className="signaler-pastille" aria-pressed={difficulte === 'trop-dure'} onClick={() => basculerDifficulte('trop-dure')}>
          <Jauge pleines={3} />
          Trop dure
        </button>
        {/* La catégorie : la pastille montre la sienne, la liste du téléphone s'ouvre au toucher. */}
        <label className={'signaler-pastille signaler-categorie' + (categorie && categorie !== q.categorie ? ' signaler-choisie' : '')}>
          <Icon name={EMBLEME[categorie] ?? 'hash'} />
          {categorie || 'Catégorie'}
          <select value={categorie} aria-label="Sa catégorie" onChange={e => setCategorie(e.target.value)}>
            {!q.categorie && <option value="">Je ne sais pas</option>}
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="signaler-pastille" aria-pressed={autre !== null} onClick={() => setAutre(a => (a === null ? '' : null))}>
          <Icon name="message" />
          Autre
        </button>
      </div>

      {autre !== null && (
        <input className="input" value={autre} placeholder="Dis-le en une phrase" aria-label="Autre chose" onChange={e => setAutre(e.target.value)} />
      )}
      {/* La source ne se demande qu'une correction faite : avant, ce serait un champ de plus à lire. */}
      {n > 0 && (
        <input className="input" value={preuve} placeholder="Ta source ? Un lien, un livre… (facultatif)" aria-label="Ta source" onChange={e => setPreuve(e.target.value)} />
      )}
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
    </Feuille>
  )
}

/**
 * Un texte de la question qui se corrige sur place : touché, il devient un
 * champ ; quitté, il se relit corrigé — ce qui part barré, ce qui vient en
 * or, au milieu de la phrase qui ne bouge pas.
 */
function TexteATouche({
  nom,
  avant,
  valeur,
  enEdition,
  onEditer,
  onFini,
  onChange,
  className,
  icone,
}: {
  nom: string
  avant: string
  valeur: string
  enEdition: boolean
  onEditer: () => void
  onFini: () => void
  onChange: (v: string) => void
  className: string
  icone?: 'message'
}) {
  const champ = useRef<HTMLTextAreaElement>(null)
  // Le champ prend le doigt qui l'a ouvert : on corrige d'un seul toucher.
  useEffect(() => {
    if (enEdition) champ.current?.focus()
  }, [enEdition])
  const d = decoupage(avant, valeur)
  if (enEdition) {
    return <textarea ref={champ} className={`input ${className} signaler-en-edition`} rows={3} value={valeur} aria-label={`Corriger ${nom}`} onChange={e => onChange(e.target.value)} onBlur={onFini} />
  }
  return (
    <button type="button" className={`${className} signaler-touchable` + (d ? ' signaler-corrige' : '')} aria-label={`Corriger ${nom}`} onClick={onEditer}>
      {icone && <Icon name={icone} />}
      <span className="signaler-texte">
        {d ? (
          <>
            {d.debut && `${espacesFines(d.debut)} `}
            {d.enleve && <s>{espacesFines(d.enleve)}</s>}
            {d.enleve && d.ajoute && ' '}
            {d.ajoute && <b>{espacesFines(d.ajoute)}</b>}
            {d.fin && ` ${espacesFines(d.fin)}`}
          </>
        ) : (
          espacesFines(avant)
        )}
      </span>
      <Icon name="edit" className="signaler-crayon" />
    </button>
  )
}

/** Trois barres de difficulté, au trait des icônes : une pleine pour « facile », trois pour « dure ». */
function Jauge({ pleines }: { pleines: number }) {
  return (
    <svg className="icon signaler-jauge" viewBox="0 0 24 24" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <rect key={i} x={4 + i * 6} y={16 - i * 5} width={4} height={4 + i * 5} rx={1} className={i < pleines ? 'signaler-barre-pleine' : undefined} />
      ))}
    </svg>
  )
}
