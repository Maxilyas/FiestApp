import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { Shape } from './Shape'
import { espacesFines } from '../format'

// Le corrigé d'une question, le même partout où l'on relit ses réponses : le
// quiz du jour, la série, le défi, le duel, les sentiers, les parcours. Sans
// rien de lourd : le quiz du jour le charge.

/** Ce qu'est devenue une question corrigée, en un mot : sa marque le dit au lecteur d'écran. */
export type Verdict = 'Juste' | 'Faux' | 'Sans réponse' | 'Annulée'

export function verdictDe(q: { juste: boolean; choix: number | null; annulee?: boolean }): Verdict {
  if (q.annulee) return 'Annulée'
  if (q.juste) return 'Juste'
  // Sans choix : la question laissée au temps, la réponse arrivée après la
  // fin, ou la partie arrêtée avant.
  return q.choix !== null ? 'Faux' : 'Sans réponse'
}

/** La marque de chaque verdict : sa couleur, son dessin — un tiret pour ce qui ne compte pas. */
const MARQUES: Record<Verdict, { classe: string; icone: 'check' | 'x' | 'clock' | null }> = {
  Juste: { classe: 'ok', icone: 'check' },
  Faux: { classe: 'ko', icone: 'x' },
  'Sans réponse': { classe: 'sans', icone: 'clock' },
  Annulée: { classe: 'annulee', icone: null },
}

/**
 * Une question corrigée : sa marque et son en-tête, l'intitulé, puis la bonne
 * réponse, centrée dans son cadre comme à la révélation, et dessous la sienne
 * quand elle était fausse, barrée — chacune sa légende, sa coche ou sa croix,
 * pour qui ne distingue pas les couleurs. Elles se lisaient en petit sous
 * l'intitulé, la bonne en gras et la sienne en gris — « ▲ Bonne · tu avais dit
 * … » sur une seule ligne en campagne —, et l'on prenait l'une pour l'autre :
 * un retour utilisateur du 13 octobre 2026, « les réponses ne ressortent pas,
 * on peut se tromper entre la bonne réponse et sa réponse fausse ; j'aimerais
 * que la bonne réponse soit centrée aussi ».
 *
 * La coche et la croix de la marque ne sont que des dessins : au lecteur
 * d'écran, elle dit son verdict en toutes lettres.
 */
export function Corrige({
  verdict,
  dit = verdict,
  tete,
  points,
  texte,
  reponses,
  bonne,
  choix,
  formes = true,
  sous,
  corps,
  children,
}: {
  verdict: Verdict
  /**
   * Le nom de la marque, quand le mot du verdict est déjà celui du jeu : à
   * l'Éclair, une affirmation vraie dite fausse se marquait « Faux », puis
   * « Vrai · tu as dit faux » — trois fois les mots du jeu, et l'oreille ne
   * savait plus qui s'était trompé (la tablée du 25 octobre 2026). Elle s'y
   * dit « Raté » ; ailleurs, le verdict.
   */
  dit?: string
  /** « Question 3 · Histoire », « Question 3 · Facile » : en capitales, à côté de la marque. */
  tete: string
  /** Ce qu'elle a rapporté, au bout de l'en-tête : le quiz du jour seulement. */
  points?: ReactNode
  texte: string
  reponses: readonly string[]
  bonne: number
  choix: number | null
  /** La forme de chaque réponse, celle de la salle : sans elles, une réponse composée de l'expédition, qui n'avait pas de choix. */
  formes?: boolean
  /** Ce que l'intitulé désigne, juste sous lui : les emojis d'un rébus de l'expédition (« ces emojis »). */
  sous?: ReactNode
  /** À la place de la bonne réponse et de la sienne, ce qui n'a pas de réponse à encadrer : la frise rangée de l'expédition. */
  corps?: ReactNode
  /** Ce qui suit les réponses : le temps, la part de la salle, l'anecdote. */
  children?: ReactNode
}) {
  const marque = MARQUES[verdict]
  const sienne = verdict === 'Faux' && choix !== null && choix !== bonne ? choix : null
  return (
    <li className={'corrige ' + marque.classe}>
      <div className="corrige-tete">
        <span className="corrige-marque" role="img" aria-label={dit}>
          {marque.icone ? <Icon name={marque.icone} /> : '–'}
        </span>
        <span className="label">{tete}</span>
        {points}
      </div>
      <p className="corrige-texte">{espacesFines(texte)}</p>
      {sous}
      {corps ?? (
        <div className="corrige-reponses">
          <p className="corrige-reponse corrige-bonne">
            <span className="corrige-legende">
              <Icon name="check" />
              {verdict === 'Juste' ? 'La bonne réponse · la tienne' : 'La bonne réponse'}
            </span>
            <span className="corrige-mot">
              {formes && <Shape index={bonne} inline />}
              {espacesFines(reponses[bonne])}
            </span>
          </p>
          {sienne !== null && (
            <p className="corrige-reponse corrige-sienne">
              <span className="corrige-legende">
                <Icon name="x" />
                Ta réponse
              </span>
              <span className="corrige-mot">
                {formes && <Shape index={sienne} inline />}
                <s>{espacesFines(reponses[sienne])}</s>
              </span>
            </p>
          )}
        </div>
      )}
      {children}
    </li>
  )
}
