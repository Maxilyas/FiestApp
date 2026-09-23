import type { ProgressInput } from './progress'
import { relevesDeSoiree } from './progress'
import { indexerJournal, questionsDe, type QuizJoue } from './journal'
import { SEUILS } from '../../../shared/profil'
import { DIVINS, divin, type DivinDescendu } from '../../../shared/divins'
import { legendairesDebloques } from '../../../shared/legendaires'
import type { PrixDeSoiree } from '../auth/profiles'

/**
 * Ce qui fait descendre les Divins — et c'est un secret.
 *
 * Un légendaire annonce sa règle : on le veut parce qu'on sait ce qu'il
 * demande. Un Divin se tait. Ses règles vivent ici, côté serveur, et nulle
 * part ailleurs : ni `shared/` ni `client/` n'importent ce module (un test y
 * veille, `divins.test.ts`), le paquet du navigateur n'en porte donc pas une
 * ligne, et le serveur n'envoie jamais que la liste des Divins descendus.
 * Qui veut savoir doit jouer — ou lire le code du serveur.
 *
 * Ils sont faits pour être rares : des salles plus grandes que celles des
 * hauts faits, des soirées entières, aucune règle qu'on remplit par hasard
 * en un quiz de cinq questions. Comme les hauts faits, ils se jugent à la
 * clôture, sur les journaux, et se relisent sur les soirées archivées : un
 * Divin descend aussi sur une soirée d'il y a un an, au premier démarrage
 * qui suit (`recalcul.ts`, `VERSION_BAREME`).
 *
 * Et comme tout le profil, un Divin ne donne AUCUN avantage de jeu, ni
 * d'expérience : c'est une apparition, pas une récompense de plus.
 */

/** La salle où un Divin de soirée peut descendre : six joueurs qui ont répondu. */
const SALLE_DIVINE = 6
/** Celle d'un retournement de soirée — premier devenu dernier, ou l'inverse. */
const GRANDE_SALLE = 8
/** Hélios : autant de questions à choix, toutes justes. */
const PERFECTION = 20
/** …dont autant où la majorité de la salle se trompait : pas de perfection sur un quiz pour enfants. */
const CONTRE_LA_SALLE = 3
/** Le Séraphin : un quiz d'autant de questions à choix, le plus rapide à trouver sur chacune. */
const VITESSE = 8
/** Un retournement se juge sur une soirée d'au moins autant de quiz. */
const QUIZ_DU_RETOURNEMENT = 3
/** L'Ange Déchu tombe en jouant : il a répondu à cette part des questions qu'on lui a posées. */
const ASSIDU = 0.9

/**
 * Ce que chaque Divin raconte à qui l'a. Ces lignes disent presque la règle :
 * elles restent ici, et ne partent qu'avec un Divin descendu (`raconter`).
 */
const RECITS: Record<string, Omit<DivinDescendu, 'key'>> = {
  'dv:helios': { legende: 'Rien de ce qu’on lui a demandé ne lui a échappé.', ton: 'eclat' },
  'dv:seraphin': { legende: 'Plus vite que tous, à chaque question.', ton: 'eclat' },
  'dv:lotus': { legende: 'Il est monté du fond de l’eau jusqu’à la lumière.', ton: 'eclat' },
  'dv:arbre': { legende: 'Douze lumières à ses branches : il les a toutes cueillies.', ton: 'eclat' },
  'dv:dechu': { legende: 'Il brillait le plus haut. Il est tombé le plus bas.', ton: 'ombre' },
}

/** Les Divins descendus, avec leur récit — pour leur seul porteur. */
export function raconter(cles: readonly string[]): DivinDescendu[] {
  return cles.flatMap(key => (RECITS[key] ? [{ key, ...RECITS[key] }] : []))
}

/**
 * Les douze légendaires du catalogue d'origine. L'Arbre-Monde les demande
 * tous — ceux-là, nommément : un treizième ajouté un jour ne doit pas lui
 * reprendre l'Arbre qu'il porte.
 */
const DOUZE_LEGENDAIRES = [
  'lg:phenix',
  'lg:dragon',
  'lg:oracle',
  'lg:chouette',
  'lg:tigre',
  'lg:licorne',
  'lg:lion',
  'lg:renard',
  'lg:comete',
  'lg:kraken',
  'lg:fantome',
  'lg:trou-noir',
]

/**
 * Les Divins d'une soirée, invité par invité. Dérivation pure, comme les
 * hauts faits : elle lit les journaux et ne décide de rien d'autre.
 */
export function divinsDeSoiree(live: ProgressInput): Map<string, string[]> {
  const inscrits = new Set(live.players.map(p => p.id))
  const scores = live.scores.filter(s => inscrits.has(s.playerId))
  const answers = live.answers.filter(r => inscrits.has(r.playerId))
  const quiz = indexerJournal(answers, scores)
  const questions = questionsDe(quiz)
  const releves = relevesDeSoiree({ players: live.players, scores, answers }, { cloture: true })
  const joueurs = new Set(answers.filter(r => r.answered).map(r => r.playerId))
  const resultat = new Map<string, Set<string>>()
  const accorder = (id: string, cle: string) => {
    let s = resultat.get(id)
    if (!s) resultat.set(id, (s = new Set()))
    s.add(cle)
  }
  if (joueurs.size < SALLE_DIVINE) return new Map()

  // Hélios : toutes les questions à choix de la soirée justes — vingt au
  // moins, dont trois où la salle, en majorité, se trompait.
  const qcm = questions.filter(q => q.kind === 'choice')
  for (const id of joueurs) {
    const siennes = qcm.flatMap(q => {
      const r = q.parJoueur.get(id)
      return r ? [{ q, r }] : []
    })
    if (
      siennes.length >= PERFECTION &&
      siennes.every(({ r }) => r.answered && r.correct === true) &&
      siennes.filter(({ q }) => q.majoriteFausse).length >= CONTRE_LA_SALLE
    ) {
      accorder(id, 'dv:helios')
    }
  }

  // Le Séraphin : le plus rapide à trouver, sur chaque question à choix d'un
  // quiz — huit au moins. Seul à trouver, on est aussi le plus rapide ; à
  // égalité à la milliseconde, les deux le sont, comme au réflexe.
  for (const q of quiz) {
    if (q.joueurs.size < SALLE_DIVINE) continue
    const choix = q.questions.filter(qu => qu.kind === 'choice')
    if (choix.length < VITESSE) continue
    for (const id of q.joueurs) {
      const partout = choix.every(qu => {
        const r = qu.parJoueur.get(id)
        if (!r || !r.answered || r.correct !== true) return false
        return (r.ms ?? 0) <= (qu.justes[0]?.ms ?? 0)
      })
      if (partout) accorder(id, 'dv:seraphin')
    }
  }

  // Les retournements : le premier vrai quiz de la soirée, puis la soirée
  // entière. Le Lotus en sort par le haut, l'Ange Déchu par le bas.
  const premier = quiz.find(q => q.questions.length >= SEUILS.questionsQuiz && q.joueurs.size >= SALLE_DIVINE)
  const retournement =
    premier && joueurs.size >= GRANDE_SALLE && questions.length >= SEUILS.questionsSoiree && quiz.length >= QUIZ_DU_RETOURNEMENT
  if (premier && retournement) {
    const auPremier = [...premier.joueurs].map(j => premier.points.get(j) ?? 0)
    const plusBas = Math.min(...auPremier)
    const plusHaut = Math.max(...auPremier)
    const totaux = [...joueurs].map(j => releves.get(j)?.releve.points ?? 0)
    const dernier = Math.min(...totaux)
    const meilleur = Math.max(...totaux)
    for (const id of joueurs) {
      const rel = releves.get(id)?.releve
      if (!rel) continue
      // Le Lotus : dernier du premier quiz — présent du début à la fin, et
      // qui a répondu à la moitié au moins : un retardataire n'est pas un
      // dernier —, premier de la soirée.
      if (premier.joueurs.has(id) && dernierDuQuiz(premier, id, plusBas, plusHaut) && rel.rang === 1) {
        accorder(id, 'dv:lotus')
      }
      // L'Ange Déchu : premier du premier quiz, dernier de la soirée — en
      // jouant jusqu'au bout : s'en aller tôt, ce n'est pas tomber.
      if (
        premier.rangs.get(id) === 1 &&
        rel.reponses >= rel.questions * ASSIDU &&
        rel.points === dernier &&
        dernier < meilleur
      ) {
        accorder(id, 'dv:dechu')
      }
    }
  }

  return new Map([...resultat].map(([id, cles]) => [id, DIVINS.map(d => d.key).filter(k => cles.has(k))]))
}

/** Dernier de ce quiz, en l'ayant joué du début à la fin. */
function dernierDuQuiz(q: QuizJoue, id: string, plusBas: number, plusHaut: number): boolean {
  const siennes = q.questions.map(qu => qu.parJoueur.get(id))
  if (siennes.some(l => !l)) return false
  if (siennes.filter(l => l!.answered).length * 2 < siennes.length) return false
  return (q.points.get(id) ?? 0) === plusBas && plusBas < plusHaut
}

/**
 * Les Divins qu'un profil a vus descendre. Ceux d'une soirée se lisent dans
 * ses récompenses rangées, comme les hauts faits ; l'Arbre-Monde se déduit
 * des légendaires — il n'a pas de soirée à lui, et part avec le premier
 * légendaire qu'une soirée retirée lui reprendrait.
 */
export function divinsDebloques(recompenses: ReadonlyMap<string, number>): string[] {
  const legendaires = new Set(legendairesDebloques(recompenses))
  return DIVINS.filter(d =>
    d.key === 'dv:arbre' ? DOUZE_LEGENDAIRES.every(k => legendaires.has(k)) : (recompenses.get(d.key) ?? 0) > 0,
  ).map(d => d.key)
}

/**
 * Les lignes d'étagère des Divins d'une soirée, pour ceux qui ont un profil :
 * elles se rangent avec les prix et les hauts faits, et partent avec la
 * soirée si on la retire. Un invité anonyme n'en garde rien — il n'a pas
 * d'étagère.
 */
export function laureatsDivins(divins: ReadonlyMap<string, string[]>, profilDuJoueur: ReadonlyMap<string, string>): PrixDeSoiree[] {
  return [...divins].flatMap(([playerId, cles]) => {
    const profileId = profilDuJoueur.get(playerId)
    if (!profileId) return []
    return cles.flatMap(cle => {
      const d = divin(cle)
      return d ? [{ profileId, badge: d.key, emoji: '✨', title: d.nom }] : []
    })
  })
}
