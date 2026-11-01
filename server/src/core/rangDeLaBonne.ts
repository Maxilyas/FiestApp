// La place de la bonne réponse parmi des réponses qui se rangent — des
// années, des nombres, des jours de l'année — ne se devine plus.
//
// Le 1er novembre 2026, un joueur l'a remarqué : « les réponses des dates
// étaient toujours ou presque dans le milieu ». Mesuré sur la base ce jour-là,
// les quatre réponses rangées dans l'ordre : la bonne était la deuxième ou la
// troisième 97 fois sur cent pour les 718 questions à quatre années, 91 pour
// les autres nombres, 84 pour les jours de l'année (« Le 14 février »). Les
// rédacteurs écrivent « quatre années proches » autour de la bonne, de part et
// d'autre : écarter les deux extrêmes suffisait à jouer à pile ou face, et
// prendre, des deux du milieu, la plus proche de la moyenne trouvait 64 % des
// années sans rien savoir.
//
// Le tirage choisit donc le rang de la bonne réponse, puis ses leurres parmi
// ceux que la question porte (`meta.leurres` : ses mauvaises réponses et ceux
// du six choix, écrits et relus comme des leurres). Rien ne s'invente : une
// année fabriquée à côté de la bonne pouvait être juste elle aussi — la tour
// Eiffel commencée en 1887, achevée en 1889 —, et personne ne l'aurait relue.
//
// Le serveur seul tire (invariant 1) : la page reçoit les quatre réponses
// mélangées, comme avant, et rien ne dit lesquelles viennent d'où.

import { lireNombreEnTete } from '../../../shared/nombres'
import type { QuestionDeLaBase } from './baseCampagne'

/**
 * Le poids de chaque rang que la bonne réponse peut prendre parmi quatre, de
 * la plus petite à la plus grande. Un rang ne se tire que si la question a de
 * quoi le faire — trois leurres plus grands pour être la plus petite, trois
 * plus petits pour être la plus grande —, et ses leurres entourent la bonne :
 * tirés à poids égaux, les extrêmes manquaient (25, 28, 28 et 19 %). Ces
 * poids les compensent, mesurés sur la base du 1er novembre 2026 : 26, 25,
 * 24 et 25 %, et la plus proche de la moyenne ne trouve plus que 30 % des
 * années (`rang-de-la-bonne.test.ts` le relit sur la base livrée).
 */
export const POIDS_DES_RANGS: readonly number[] = [1.2, 1, 1, 1.6]

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
/** Ce qui suit le jour d'une date : « mai », « er mai » (le 1er), « juillet 1789 ». */
const JOUR_DE_L_ANNEE = new RegExp(`^(?:er\\s+)?(${MOIS.join('|')})(?:\\s+(\\d{3,4}))?$`, 'i')
const AVANT_NOTRE_ERE = /av(\.|ant)\s*J\.?-?C/i

/**
 * Une réponse qui se range parmi ses voisines : sa valeur, et sa forme — ce
 * qui entoure le nombre. « 1830 », « 330 m », « −40 °C », « 52 av. J.-C. »,
 * « Les années 1960 », « Le 14 février » ; deux réponses ne se comparent qu'à
 * la même forme : « 33 cl » et « 1 litre », « Peugeot 205 » et « Renault 5 »
 * ne se rangent pas ensemble. Null : rien ne la range.
 */
export function valeurRangee(texte: string): { valeur: number; forme: string } | null {
  const net = texte.trim()
  const debut = net.search(/[+\-−]?\d/)
  if (debut < 0) return null
  const lu = lireNombreEnTete(net.slice(debut))
  if (!lu) return null
  const avant = net.slice(0, debut).trim().toLowerCase()
  const reste = lu.reste.trim()
  // Un jour de l'année se range au calendrier, jamais au numéro de son jour : le 2 novembre vient après le 30 octobre.
  const jour = JOUR_DE_L_ANNEE.exec(reste)
  if (jour) {
    const an = jour[2] ? Number(jour[2]) : 0
    return { valeur: an * 400 + MOIS.indexOf(jour[1].toLowerCase()) * 32 + lu.valeur, forme: `${avant}|jour${jour[2] ? '|an' : ''}` }
  }
  return { valeur: AVANT_NOTRE_ERE.test(reste) ? -lu.valeur : lu.valeur, forme: `${avant}|${reste.toLowerCase()}` }
}

/** Les réponses qu'une partie pose d'une question, et sa bonne parmi elles — dans aucun ordre : la partie les mélange. */
export interface ReponsesTirees {
  reponses: string[]
  bonne: number
}

/** Ce que le tirage lit d'une question : ses réponses, sa bonne, ses leurres. */
type QuestionQuiSeRange = Pick<QuestionDeLaBase, 'reponses' | 'bonne'> & { meta: Pick<QuestionDeLaBase['meta'], 'leurres'> }

/** La bonne réponse lue, quand les quatre se rangent à la même forme, sans deux valeurs égales ; null sinon. */
function justeQuiSeRange(q: Pick<QuestionDeLaBase, 'reponses' | 'bonne'>): { valeur: number; forme: string } | null {
  if (q.reponses.length !== 4) return null
  const juste = valeurRangee(q.reponses[q.bonne])
  if (!juste) return null
  const valeurs = new Set([juste.valeur])
  for (const [i, r] of q.reponses.entries()) {
    if (i === q.bonne) continue
    const v = valeurRangee(r)
    if (!v || v.forme !== juste.forme || valeurs.has(v.valeur)) return null
    valeurs.add(v.valeur)
  }
  return juste
}

/**
 * Ses quatre réponses se rangent-elles ? Alors la partie tire ses leurres
 * parmi tous ceux qu'elle porte : ce qui compare une question jouée à la base
 * (`memeVersion`, au signalement) les y cherche.
 */
export const seRange = (q: Pick<QuestionDeLaBase, 'reponses' | 'bonne'>): boolean => justeQuiSeRange(q) !== null

/** Sa bonne réponse, et ses leurres de la même forme de part et d'autre — ses mauvaises réponses d'abord, une valeur une fois. */
function leursLeurres(q: QuestionQuiSeRange): { bonne: string; dessous: string[]; dessus: string[] } | null {
  const juste = justeQuiSeRange(q)
  if (!juste) return null
  const dessous: string[] = []
  const dessus: string[] = []
  const prises = new Set([juste.valeur])
  for (const l of [...q.reponses.filter((_, i) => i !== q.bonne), ...(q.meta.leurres ?? [])]) {
    const v = valeurRangee(l)
    if (!v || v.forme !== juste.forme || prises.has(v.valeur)) continue
    prises.add(v.valeur)
    ;(v.valeur < juste.valeur ? dessous : dessus).push(l)
  }
  return { bonne: q.reponses[q.bonne], dessous, dessus }
}

/** Les rangs que la bonne peut prendre parmi quatre : trois leurres au-dessus pour être la plus petite, trois au-dessous pour être la plus grande. */
const rangsDe = ({ dessous, dessus }: { dessous: readonly string[]; dessus: readonly string[] }) =>
  [0, 1, 2, 3].filter(k => k <= dessous.length && 3 - k <= dessus.length)

/**
 * Les rangs que la bonne réponse d'une question qui se range peut prendre au
 * tirage, de 0 (la plus petite) à 3 ; null si elle ne se range pas. Moins de
 * quatre : ses leurres ne l'entourent pas assez, et la place de la bonne dit
 * encore quelque chose — `verifier` le dit au rédacteur.
 */
export function rangsPossibles(q: QuestionQuiSeRange): number[] | null {
  const tas = leursLeurres(q)
  return tas && rangsDe(tas)
}

/** `n` éléments de `tas`, au hasard (un Fisher-Yates arrêté à `n`). */
function auHasard<T>(tas: readonly T[], n: number, hasard: () => number): T[] {
  const copie = [...tas]
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(hasard() * (copie.length - i))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie.slice(0, n)
}

/**
 * Les réponses d'une question à quatre choix qui se rangent, le rang de sa
 * bonne tiré (`POIDS_DES_RANGS`) et ses trois leurres pris au hasard de part
 * et d'autre, parmi ses mauvaises réponses et ses leurres de la même forme.
 * Pris au hasard plutôt que ses mauvaises réponses d'abord : elles entourent
 * la bonne de près, et la plus proche de la moyenne en retrouvait 36 %.
 * Null — elle se pose telle qu'elle est écrite — quand ses quatre réponses ne
 * se rangent pas toutes à la même forme, un vrai ou faux, ou deux valeurs
 * égales. Le hasard ne se consomme que pour elles : une autre question garde
 * le battage d'avant, au même hasard (`tirage-a-la-piece.test.ts`).
 */
export function reponsesAuRangTire(q: QuestionQuiSeRange, hasard: () => number = Math.random): ReponsesTirees | null {
  const tas = leursLeurres(q)
  if (!tas) return null
  const { bonne, dessous, dessus } = tas
  // Le rang écrit se tire toujours : ses mauvaises réponses sont au tas.
  const possibles = rangsDe(tas)
  let rang = possibles[possibles.length - 1]
  let tirage = hasard() * possibles.reduce((s, k) => s + POIDS_DES_RANGS[k], 0)
  for (const k of possibles) {
    tirage -= POIDS_DES_RANGS[k]
    if (tirage < 0) {
      rang = k
      break
    }
  }
  return { reponses: [bonne, ...auHasard(dessous, rang, hasard), ...auHasard(dessus, 3 - rang, hasard)], bonne: 0 }
}
