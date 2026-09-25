// La course d'un invité au fil du quiz : sa place au classement, dite entre
// deux questions, et ce qu'il en retient au podium. Des dérivations pures et
// partagées — le téléphone les affiche, les tests les lisent.
//
// Les invités le demandaient : « Total quiz : 450 pts · 3ᵉ place », en petit
// sous l'anecdote, ne disait rien des autres. Le parti pris, celui du rapport
// du 25 septembre 2026 (`retours/2026-09-25/classement-en-cours.md`) :
// · une seule cible, nommée : le plus proche strictement devant. Un duel par
//   invité, là où quarante-sept sur cinquante regardaient une course perdue
//   d'avance ; le meneur, lui, apprend qui le suit ;
// · les bonnes nouvelles seulement : la flèche ne monte que vers le haut,
//   « sur 12 » ne se dit qu'à la moitié haute, jamais « dernier », et pas de
//   rang à zéro point — « 0 pt · 1ʳᵉ place », c'était premier de rien ;
// · une étiquette, « Ce quiz » : le rang est celui du quiz, que la télé
//   montre au même instant ; les équipes, juste dessous, comptent la soirée.
import type { PlaceAuQuiz } from './games/quiz'
import { rangPartage } from './classement'
import { de, place as placeEcrite, points as enPoints, pts, rang as rangEcrit } from './typographie'

/** Une phrase dont un prénom se détache à l'œil : « À 40 pts d’ » · « Hugo » · « et 2 autres ». */
export interface Phrase {
  avant: string
  nom?: string
  apres?: string
}

/** Sa place, dite à la révélation : trois lignes courtes, sous le résultat. */
export interface LigneDeCourse {
  /** Quel classement, et ce qui reste à jouer : « Ce quiz ×2 · encore 6 questions ». */
  etiquette: string
  /** Le rang, écrit en grand : « 5ᵉ ». Absent en tête et à zéro, qu'une phrase dit mieux. */
  rang?: string
  /** Ce qui suit le rang, ou le remplace : « place sur 12 », « ex æquo », « Tu prends la tête ! »… */
  place: string
  /** On vient de prendre la tête : ça se fête. */
  fete?: boolean
  /** « 450 pts » — absent à zéro. */
  points?: string
  /** Les places gagnées depuis la question d'avant, 0 sinon : jamais de flèche vers le bas. */
  gagnees: number
  /** La cible : celui qu'on talonne — ou, en tête, celui qui talonne. */
  cible?: Phrase
  /** Tout, d'une traite, pour le lecteur d'écran : « ᵉ » s'y épelait, et une flèche décorative ne se dit pas. */
  oreille: string
}

export interface EntreeDeCourse {
  rang: number
  points: number
  place: PlaceAuQuiz
  /**
   * Le nom affiché d'un invité, marque d'homonymie comprise — l'instantané le
   * donne. Rien pour un arrivant qu'il ne connaît pas encore : la cible se dit
   * alors par son rang.
   */
  nomDe: (id: string) => string | undefined
  qIndex: number
  qCount: number
  multiplier: number
}

/** La moitié haute, arrondie au-dessus : là seulement se dit « sur 12 » — « 11ᵉ sur 12 » ne dirait qu'« avant-dernier ». */
export const moitieHaute = (rang: number, sur: number) => rang <= Math.ceil(sur / 2)

const autres = (n: number) => `${n} autre${n > 1 ? 's' : ''}`
const places = (n: number) => `${n} place${n > 1 ? 's' : ''} gagnée${n > 1 ? 's' : ''}`

export function ligneDeCourse(e: EntreeDeCourse): LigneDeCourse {
  const p = e.place
  const exAequo = p.exAequo ?? 0
  const reste = e.qCount - e.qIndex - 1
  const etiquette = `Ce quiz${e.multiplier > 1 ? ` ×${e.multiplier}` : ''} · ${
    reste > 1 ? `encore ${reste} questions` : reste === 1 ? 'encore 1 question' : 'c’était la dernière'
  }`
  const suiteOreille =
    (reste > 1 ? `Encore ${reste} questions` : reste === 1 ? 'Encore 1 question' : 'C’était la dernière question') +
    (e.multiplier === 2 ? ', points doublés' : e.multiplier === 3 ? ', points triplés' : '')

  // Sa place.
  const aMarque = e.points > 0
  const enTete = aMarque && e.rang === 1
  // Le rang d'avant ne vient que s'il a changé : monter, c'est l'avoir eu plus loin.
  const gagnees = aMarque && !enTete && p.avant !== undefined && p.avant > e.rang ? p.avant - e.rang : 0
  const haute = moitieHaute(e.rang, p.sur)
  let ligne: Pick<LigneDeCourse, 'rang' | 'place' | 'fete'>
  let placeOreille: string
  if (!aMarque) {
    ligne = { place: p.devant ? 'Pas encore de points' : 'Personne n’a encore marqué' }
    placeOreille = p.devant ? 'pas encore de points' : 'personne n’a encore marqué'
  } else if (enTete) {
    // On fête une fois, la question où l'on passe devant ; ensuite, on mène.
    const prise = p.avant !== undefined && p.avant > 1
    const [texte, dit] = prise
      ? exAequo > 0
        ? ['Tu rejoins la tête !', 'tu rejoins la tête']
        : ['Tu prends la tête !', 'tu prends la tête']
      : exAequo > 0
        ? ['En tête ex æquo', 'en tête ex æquo']
        : ['Tu mènes', 'tu mènes']
    ligne = { place: texte, ...(prise && { fete: true }) }
    placeOreille = `${dit}, ${enPoints(e.points)}`
  } else {
    ligne = { rang: rangEcrit(e.rang), place: `${exAequo > 0 ? 'ex æquo' : 'place'}${haute ? ` sur ${p.sur}` : ''}` }
    placeOreille =
      `rang ${e.rang}${haute ? ` sur ${p.sur}` : ''}${exAequo > 0 ? `, ex æquo avec ${autres(exAequo)}` : ''}, ` +
      `${enPoints(e.points)}${gagnees > 0 ? `, ${places(gagnees)}` : ''}`
  }

  // Sa cible.
  let cible: Phrase | undefined
  let cibleOreille: string | undefined
  if (p.devant) {
    const ecart = p.devant.points - e.points
    // Son rang moins celui de devant : la taille du groupe d'ex æquo qu'on talonne.
    const groupe = e.rang - p.devant.rang
    const nom = e.nomDe(p.devant.id)
    const suite = groupe > 1 ? ` et ${autres(groupe - 1)}` : ''
    if (nom) {
      cible = { avant: `À ${pts(ecart)} ${de(nom)}`, nom, ...(suite && { apres: suite }) }
      cibleOreille = `À ${enPoints(ecart)} ${de(nom)}${nom}${suite}`
    } else {
      cible = { avant: `À ${pts(ecart)} de la ${placeEcrite(p.devant.rang)}` }
      cibleOreille = `À ${enPoints(ecart)} du rang ${p.devant.rang}`
    }
  } else if (enTete && p.derriere) {
    if (p.derriere.points > 0) {
      const ecart = e.points - p.derriere.points
      const nom = e.nomDe(p.derriere.id)
      // Ex æquo en tête, on est plusieurs à être suivis.
      const suit = exAequo > 0 ? 'vous suit' : 'te suit'
      cible = nom ? { avant: '', nom, apres: ` ${suit} à ${pts(ecart)}` } : { avant: `${pts(ecart)} d’avance` }
      cibleOreille = nom ? `${nom} ${suit} à ${enPoints(ecart)}` : `${enPoints(ecart)} d’avance`
    } else {
      cible = { avant: 'Personne d’autre n’a encore marqué' }
      cibleOreille = cible.avant
    }
  }

  return {
    etiquette,
    ...ligne,
    ...(aMarque && { points: pts(e.points) }),
    gagnees,
    ...(cible && { cible }),
    oreille: `Ce quiz : ${placeOreille}. ${cibleOreille ? `${cibleOreille}. ` : ''}${suiteOreille}.`,
  }
}

/**
 * Au podium, pour qui n'y monte pas : l'écart à la troisième marche, quand il
 * talonne celui qui y est. Plus loin, l'échelle de ses voisins dit le reste.
 */
export function ecartAuPodium(rang: number, points: number, place: PlaceAuQuiz): number | null {
  if (rang <= 3 || points <= 0 || !place.devant || place.devant.rang > 3) return null
  return place.devant.points - points
}

/**
 * Au podium d'un quiz qui n'est pas le premier de la soirée, sa place à la
 * soirée : « Soirée : 4ᵉ place ». Le multiplicateur promet qu'un écart
 * redevient jouable sur la soirée, et le téléphone n'en disait rien. Lue dans
 * l'instantané, qui porte les points de toute la soirée. Rien à zéro.
 */
export function ligneDeSoiree(score: number, scores: readonly number[]): string | null {
  if (score <= 0) return null
  const r = rangPartage(score, scores)
  if (r > 1) return `Soirée : ${placeEcrite(r)}`
  return scores.filter(s => s === score).length > 1 ? 'Soirée : en tête ex æquo' : 'Soirée : tu mènes'
}
