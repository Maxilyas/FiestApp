import type { CSSProperties } from 'react'
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
 * Un mot de la phrase : offert, trouvé — à lui ou par tous —, ou caché.
 * `retourne` : il vient de le gagner, ses lettres se retournent une à une.
 * Sa place (`data-i`) : le mot gagné vole jusqu'à elle.
 */
function Mot({ mot, i, retourne }: { mot: MotDeLaPhrase; i: number; retourne: boolean }) {
  if (mot.offert) {
    return (
      <span className="phrase-mot phrase-offert" data-i={i}>
        {mot.texte}
      </span>
    )
  }
  if (mot.texte !== undefined) {
    return (
      <span className={'phrase-mot phrase-trouve' + (mot.sien ? ' phrase-sien' : '') + (retourne ? ' phrase-neuf' : '')} data-i={i}>
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
  return (
    <span className="phrase-mot phrase-cache" role="img" aria-label={ditCache(lettresDe(mot.forme))} data-i={i}>
      {[...mot.forme].map((c, k) =>
        c === '_' ? <span key={k} className="phrase-trait" /> : <span key={k} className="phrase-ponct">{c}</span>,
      )}
    </span>
  )
}

/**
 * La phrase, mot par mot. `retourne`, la place du mot qu'il vient de gagner :
 * ses lettres se retournent une à une, comme la maquette les montrait.
 */
export function PhraseDuDivin({ phrase, retourne, className = '' }: { phrase: PhraseDuSphinx; retourne?: number; className?: string }) {
  return (
    <p className={`phrase-divin ${className}`.trim()}>
      {phrase.mots.map((m, i) => (
        <Mot key={i} mot={m} i={i} retourne={i === retourne} />
      ))}
    </p>
  )
}

/**
 * Ce que chacun sait de la phrase : ses mots, et combien tous les habitués en
 * ont trouvé ensemble — un nombre et une jauge, jamais lesquels. Pour la lire
 * entière, il faut se parler.
 */
export function CompteDeLaPhrase({ phrase }: { phrase: PhraseDuSphinx }) {
  const siens = phrase.siens
  const part = phrase.aTrouver > 0 ? Math.round((100 * phrase.parTous) / phrase.aTrouver) : 0
  return (
    <p className="phrase-compte">
      <b>{espacesFines(`Toi : ${siens > 0 ? `${siens} mot${siens > 1 ? 's' : ''}` : 'aucun mot'}`)}</b>
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
  const autres = Math.max(0, phrase.parTous - phrase.siens)
  let dit: string
  let gras: string | null = null
  let suite = ''
  if (phrase.reconstituee) dit = 'Tous ensemble, vous l’avez reconstituée.'
  else if (!habitue) dit = `Le Sphinx ne parle qu’aux habitués : joue ${JOURS_DE_L_HABITUE} jours sur ${FENETRE_DE_L_HABITUE}, et il viendra te souffler ses mots.`
  else if (autres > 0) {
    dit = 'Les autres habitués ont trouvé '
    gras = `${autres} mot${autres > 1 ? 's' : ''}`
    suite = ' que tu n’as pas. Comparez vos mots : à plusieurs, vous lirez la phrase entière.'
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
