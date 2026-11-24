import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { espacesFines } from '../format'
import { IMAGES } from './legendaires-peints'
import { FENETRE_DE_L_HABITUE, JOURS_DE_L_HABITUE, type MotDeLaPhrase, type PhraseDuSphinx } from '../../../shared/sphinx'

// La phrase d'un Divin telle qu'un profil la voit (`PhraseDuSphinx`, que le
// serveur ne lui envoie que mot à mot — invariant 21) : un trait par lettre
// des mots cachés, les petits mots offerts, ses mots à lui en or sous un
// filet ; puis combien tous les habitués en ont trouvé ensemble, un nombre et
// une jauge, jamais lesquels (la maquette validée,
// `retours/2026-11-24/le-sphinx/sphinx.html`). La visite du Sphinx et la fiche
// du Divin du moment dans l'album la montrent de même : légère, sans la police
// pixel ni le sable — l'album l'emporte sans faire venir la visite.

/** Combien de lettres un mot caché laisse voir : un trait chacune (« _’_____ »). */
const lettresDe = (forme: string) => [...forme].filter(c => c === '_').length

/** Ce que dit un mot caché à l'oreille : sa longueur, la seule chose qu'on en sait. */
const ditCache = (n: number) => (n === 1 ? 'mot caché d’une lettre' : `mot caché de ${n} lettres`)

/**
 * Un mot de la phrase : offert, trouvé — à lui, appris d'un autre, ou par
 * tous —, ou caché. `retourne` : il vient de le gagner, ses lettres se
 * retournent une à une. Sa place (`data-i`) : le mot gagné vole jusqu'à elle.
 * Caché, et l'album le permet (`onInscrire`), il se touche : on y inscrit le
 * mot qu'un autre nous a dit.
 */
function Mot({ mot, i, retourne, onInscrire, choisi }: { mot: MotDeLaPhrase; i: number; retourne: boolean; onInscrire?: (place: number) => void; choisi: boolean }) {
  if (mot.offert) {
    return (
      <span className="phrase-mot phrase-offert" data-i={i}>
        {mot.texte}
      </span>
    )
  }
  if (mot.texte !== undefined) {
    return (
      <span className={'phrase-mot phrase-trouve' + (mot.sien ? ' phrase-sien' : '') + (mot.appris ? ' phrase-appris' : '') + (retourne ? ' phrase-neuf' : '')} data-i={i}>
        {retourne
          ? [...mot.texte].map((c, k) => (
              <span key={k} className="phrase-lettre" style={{ '--k': k } as CSSProperties}>
                {c}
              </span>
            ))
          : mot.texte}
      </span>
    )
  }
  const traits = [...mot.forme].map((c, k) => (c === '_' ? <span key={k} className="phrase-trait" /> : <span key={k} className="phrase-ponct">{c}</span>))
  if (onInscrire) {
    return (
      <button
        type="button"
        className={'phrase-mot phrase-cache phrase-a-inscrire' + (choisi ? ' phrase-choisi' : '')}
        aria-label={`${ditCache(lettresDe(mot.forme))} : y inscrire un mot qu’on t’a dit`}
        aria-pressed={choisi}
        data-i={i}
        onClick={() => onInscrire(i)}
      >
        {traits}
      </button>
    )
  }
  return (
    <span className="phrase-mot phrase-cache" role="img" aria-label={ditCache(lettresDe(mot.forme))} data-i={i}>
      {traits}
    </span>
  )
}

/**
 * La phrase, mot par mot. `retourne`, la place du mot qu'il vient de gagner —
 * ou celles d'une phrase retrouvée qu'il vient de choisir de lire : leurs
 * lettres se retournent une à une, comme la maquette les montrait.
 * `onInscrire`, dans l'album : chaque trait se touche pour y inscrire un mot
 * (le premier retour de la production, le 24 novembre 2026 : « Je vois nulle
 * part où rentrer le mot des autres »), `choisie` celui qu'on a touché.
 */
export function PhraseDuDivin({
  phrase,
  retourne,
  className = '',
  onInscrire,
  choisie = null,
}: {
  phrase: PhraseDuSphinx
  retourne?: number | readonly number[]
  className?: string
  onInscrire?: (place: number) => void
  choisie?: number | null
}) {
  const retournes = new Set(typeof retourne === 'number' ? [retourne] : (retourne ?? []))
  return (
    <p className={`phrase-divin ${className}`.trim()}>
      {phrase.mots.map((m, i) => (
        <Mot key={i} mot={m} i={i} retourne={retournes.has(i)} onInscrire={onInscrire} choisi={choisie === i} />
      ))}
    </p>
  )
}

/** Ce que le serveur a dit d'un mot inscrit : juste ou non, ses erreurs qui restent ; ou son refus, tel quel. */
export type IssueDUneInscription = { juste: boolean; erreursRestantes: number } | { refus: string }

/**
 * Le mot qu'on lui a dit, sous sa phrase, pour le trait qu'il a touché : sa
 * longueur, le champ, « Inscrire ». Juste, le mot se retourne dans la phrase
 * et le champ s'en va ; faux, il le dit, et ce qu'il lui reste d'erreurs
 * aujourd'hui. Le champ prend le focus à l'ouverture — un geste l'a demandé —,
 * jamais d'office, par un attribut posé au rendu.
 */
export function InscrireUnMot({
  phrase,
  place,
  onInscrire,
  onFermer,
}: {
  phrase: PhraseDuSphinx
  place: number
  onInscrire: (mot: string) => Promise<IssueDUneInscription>
  onFermer: () => void
}) {
  const [mot, setMot] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [dit, setDit] = useState<string | null>(null)
  const champ = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setMot('')
    setDit(null)
    champ.current?.focus({ preventScroll: true })
  }, [place])
  const n = lettresDe(phrase.mots[place]?.forme ?? '')
  const soumettre = async (e: FormEvent) => {
    e.preventDefault()
    if (occupe || !mot.trim()) return
    setOccupe(true)
    try {
      const issue = await onInscrire(mot)
      if ('refus' in issue) setDit(issue.refus)
      else if (!issue.juste) {
        setDit(
          issue.erreursRestantes > 0
            ? `Ce n’est pas ce mot-là — ou personne ne l’a encore trouvé. Encore ${issue.erreursRestantes} erreur${issue.erreursRestantes > 1 ? 's' : ''} permise${issue.erreursRestantes > 1 ? 's' : ''} aujourd’hui.`
            : 'Ce n’est pas ce mot-là. Plus d’erreur permise aujourd’hui : demande-le à qui l’a trouvé, et reviens demain.',
        )
        setMot('')
      }
    } finally {
      setOccupe(false)
    }
  }
  return (
    <form className="phrase-inscrire" onSubmit={e => void soumettre(e)} autoComplete="off">
      <label htmlFor="phrase-inscrire-mot">{espacesFines(`Un mot qu’on t’a dit, pour ce trait : ${n} lettre${n > 1 ? 's' : ''}`)}</label>
      <div className="phrase-inscrire-ligne">
        <input
          id="phrase-inscrire-mot"
          ref={champ}
          value={mot}
          onChange={e => setMot(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          maxLength={40}
        />
        <button type="submit" className="btn btn-primary btn-small" disabled={occupe || !mot.trim()}>
          Inscrire
        </button>
      </div>
      <p className="phrase-inscrire-dit small" role="status" aria-live="polite">
        {dit ? espacesFines(dit) : ''}
      </p>
      <button type="button" className="link-btn phrase-inscrire-fermer" onClick={onFermer}>
        Fermer
      </button>
    </form>
  )
}

/**
 * À qui demander ses mots : ceux qui en ont trouvé, et combien — jamais
 * lesquels (invariant 21), ses amis d'abord. Un nom se touche : sa carte
 * s'ouvre, d'où l'on peut l'ajouter à ses amis ou le défier.
 */
export function QuiADesMotsDeLaPhrase({ phrase, onOuvrir }: { phrase: PhraseDuSphinx; onOuvrir?: (profileId: string) => void }) {
  const qui = phrase.quiADesMots ?? []
  if (qui.length === 0) return null
  const autres = phrase.autresQuiEnOnt ?? 0
  return (
    <div className="phrase-qui">
      <p className="phrase-qui-titre">{espacesFines('Ils ont des mots : demande-leur, puis touche un trait pour les inscrire.')}</p>
      <ul className="phrase-qui-liste">
        {qui.map(q => {
          const dit = `${q.nom}, ${q.mots} mot${q.mots > 1 ? 's' : ''}${q.ami ? ', ton ami' : ''}`
          const contenu = (
            <>
              {q.nom}
              <b>{` · ${q.mots}`}</b>
            </>
          )
          return (
            <li key={q.id} className={q.ami ? 'phrase-qui-ami' : undefined}>
              {onOuvrir ? (
                <button type="button" className="phrase-qui-nom" aria-label={`${dit} : ouvrir sa carte`} onClick={() => onOuvrir(q.id)}>
                  {contenu}
                </button>
              ) : (
                <span className="phrase-qui-nom" aria-label={dit}>
                  {contenu}
                </span>
              )}
            </li>
          )
        })}
        {autres > 0 && <li className="phrase-qui-autres">{`et ${autres} autre${autres > 1 ? 's' : ''}`}</li>}
      </ul>
    </div>
  )
}

/** Les places d'une phrase que la suivante dévoile : ce qui s'y retourne quand il choisit de la lire. */
export const placesDevoilees = (avant: PhraseDuSphinx, apres: PhraseDuSphinx): number[] =>
  apres.mots.flatMap((m, i) => (m.texte !== undefined && avant.mots[i]?.texte === undefined ? [i] : []))

/**
 * Ce que chacun sait de la phrase : ses mots, et combien tous les habitués en
 * ont trouvé ensemble — un nombre et une jauge, jamais lesquels. Pour la lire
 * entière, il faut se parler.
 */
export function CompteDeLaPhrase({ phrase }: { phrase: PhraseDuSphinx }) {
  const siens = phrase.siens
  const appris = phrase.appris ?? 0
  const part = phrase.aTrouver > 0 ? Math.round((100 * phrase.parTous) / phrase.aTrouver) : 0
  // Ses mots trouvés, puis ceux qu'il a appris des autres, à part : les uns en or, les autres en argent dans la phrase.
  const sesMots = siens > 0 ? `${siens} mot${siens > 1 ? 's' : ''}` : appris > 0 ? '' : 'aucun mot'
  const sesAppris = appris > 0 ? `${appris} appris` : ''
  return (
    <p className="phrase-compte">
      <b>{espacesFines(`Toi : ${[sesMots, sesAppris].filter(Boolean).join(', ')}`)}</b>
      {espacesFines(` · Tous les habitués : ${phrase.parTous} sur ${phrase.aTrouver}`)}
      <span className="phrase-jauge" aria-hidden="true">
        <i style={{ width: `${part}%` }} />
      </span>
    </p>
  )
}

/** Le médaillon du Sphinx, en petit : c'est lui qui parle dans l'album. */
const MEDAILLON = IMAGES['lg:sphinx']?.art[1]

/**
 * Le mot du Sphinx sous la phrase, dans l'album : à qui n'est pas un habitué,
 * comment le devenir — les barèmes de `shared/sphinx.ts`, jamais recopiés ;
 * à un habitué, ce que les autres ont trouvé qu'il n'a pas.
 */
export function ConseilDuSphinx({ phrase, habitue }: { phrase: PhraseDuSphinx; habitue: boolean }) {
  // Les mots des autres qu'il ne connaît pas encore : ceux qu'il a appris d'eux n'en sont plus.
  const autres = Math.max(0, phrase.parTous - phrase.siens - (phrase.appris ?? 0))
  let dit: string
  let gras: string | null = null
  let suite = ''
  if (phrase.aDevoiler) dit = 'Tous ensemble, vous l’avez retrouvée. Elle t’attend : lis-la quand tu voudras.'
  else if (phrase.reconstituee) dit = 'Tous ensemble, vous l’avez reconstituée.'
  else if (!habitue) dit = `Le Sphinx ne parle qu’aux habitués : joue ${JOURS_DE_L_HABITUE} jours sur ${FENETRE_DE_L_HABITUE}, et il viendra te souffler ses mots.`
  else if (autres > 0) {
    dit = 'Les autres habitués ont trouvé '
    gras = `${autres} mot${autres > 1 ? 's' : ''}`
    suite = ' que tu n’as pas. Demande-les-leur, et inscris-les sur ta phrase : à plusieurs, vous la lirez entière.'
  } else if (phrase.siens > 0) dit = 'Tu as tous les mots trouvés jusqu’ici : le Sphinx en soufflera d’autres.'
  else dit = 'Personne n’en a encore trouvé : le Sphinx souffle un mot à qui résout son énigme.'
  return (
    <p className="phrase-conseil">
      {MEDAILLON && <img className="phrase-conseil-sphinx" src={MEDAILLON} alt="" decoding="async" draggable={false} />}
      <span>
        {espacesFines(dit)}
        {gras && <b>{gras}</b>}
        {espacesFines(suite)}
      </span>
    </p>
  )
}
