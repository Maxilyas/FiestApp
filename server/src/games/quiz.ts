import type { GameContext, GameModule, GameSessionRec, ViewContext } from '../core/types'
import { dureeDesJouables, playableQuestions, type PlayableQuestion, type QuizDef } from '../../../shared/library'
import { MAX_ENTREES, avancementDuProgramme, type EntreeDeProgramme } from '../../../shared/programme'
import { distinctions } from '../../../shared/profil'
import { nomAffiche } from '../../../shared/homonymes'
import { classer, decimales, ecartEstimation, groupesDExAequo, rangDansLesTries, rangPartage, type Classe } from '../../../shared/classement'
import { ENCHAINEMENT_MAX_S } from '../../../shared/console'
import { preparerPartie, type ReglagesDuQuiz } from '../../../shared/hasard'
import type {
  QuizAction,
  QuizAttendu,
  QuizCommand,
  QuizGuessRow,
  QuizHostView,
  QuizPackInfo,
  QuizPlayerView,
  QuizPodiumRow,
  Visee,
  LancementDeQuiz,
  PlaceAuQuiz,
  ProgrammeDuSoir,
  VoisinAuClassement,
  VoteDeSondage,
} from '../../../shared/games/quiz'

interface QuizPack {
  id: string
  title: string
  questions: PlayableQuestion[]
  /** Les réglages du quiz, lus au lancement : la copie jouée ne les garde pas, elle en est le résultat. */
  reglages?: ReglagesDuQuiz
}

/** Ce qu'un joueur a envoyé pour la question en cours. */
interface Response {
  ms: number
  /** QCM : index choisi. */
  choice: number | null
  /** Estimation : nombre proposé. */
  value: number | null
  /** Nombre de fois où il s'est ravisé — un prix récompense les hésitants. */
  changes: number
  /** « Plusieurs » : les cases cochées ; « ordre » : l'ordre choisi. */
  choix?: number[]
}

interface QuizState {
  phase: 'pickPack' | 'getReady' | 'intertitre' | 'observe' | 'question' | 'cible' | 'reveal' | 'finished'
  /**
   * « Qui dans la salle ? » : les invités qu'on peut désigner, figés quand la
   * question est posée — un arrivant ne déplace pas les votes des autres.
   */
  candidats?: string[]
  /** Estimation en direct : l'animateur a tapé la cible de la question en cours. */
  cibleSaisie?: boolean
  packs: QuizPackInfo[]
  /** Le programme de ce soir, tel qu'il était au lancement (écrans d'animateur seulement). */
  programme?: ProgrammeDuSoir
  /** Le quiz joué est copié dans l'état : l'éditer pendant la partie ne change rien. */
  pack: QuizPack | null
  qIndex: number
  /**
   * Le tour : il avance chaque fois qu'une question est posée, « Reposer »
   * compris. Les vues le portent et les gestes le renvoient — c'est ainsi
   * qu'un clic ou une réponse dit quelle question il visait (voir `perimee`).
   * Absent d'une partie lancée avant qu'il existe : il naît à la question
   * suivante, et d'ici là les gestes se jugent comme avant.
   */
  round?: number
  /** L'animateur a annulé les points de la question révélée. */
  cancelled?: boolean
  questionStartAt: number
  deadline: number
  responses: Record<string, Response>
  lastAwards: Record<string, number>
  totals: Record<string, number>
  /** Arrivé en cours de route : première question qu'il pourra jouer. */
  playFrom: Record<string, number>
  /** Chronomètre figé par l'animateur : temps restant, en ms. */
  pausedMs: number | null
  /** Points multipliés pour ce quiz : 1, 2 ou 3. */
  multiplier: number
  /** Secondes avant d'enchaîner tout seul après une révélation ; null = manuel. */
  autoNextSeconds: number | null
  /** Échéance de cet enchaînement, pour l'afficher côté écran commun. */
  autoNextAt: number | null
  /**
   * L'enchaînement attend le clic : la question vient d'être révélée sans une
   * seule réponse. Absent d'une partie d'avant — elle enchaîne comme avant.
   */
  autoNextSuspendu?: boolean
  /**
   * Un autre quiz s'est joué avant celui-ci, ce soir : le classement de la
   * soirée n'est plus le sien, et son podium le dit. Absent d'une partie
   * lancée avant qu'il existe.
   */
  soireeEntamee?: boolean
  /**
   * Les invités hors ligne que l'animateur a choisi de ne plus attendre. Ils
   * le restent tant que leur téléphone se tait : une question posée pendant
   * qu'ils sont revenus les attend de nouveau (voir `startQuestion`).
   * Absent d'une partie lancée avant qu'il existe.
   */
  dispenses?: string[]
}

/** Au-delà, la console dit « et 12 autres » : les prénoms servent à trouver le fantôme, pas à faire l'appel d'une salle de cinq cents. */
const ATTENDUS_MONTRES = 30

const READY_MS = 3000

/**
 * Marge réseau : le chronomètre du serveur coupe un peu après l'échéance
 * affichée. Il était à 400 ms, soit moins qu'un aller simple depuis un
 * téléphone en 4G dans une salle où cinquante autres partagent la cellule —
 * les réponses de dernière seconde mouraient en route. Une seconde et demie
 * couvre un aller-retour de trois secondes, et ne se voit pas : la barre est
 * déjà vide, ce temps-là se lit comme du suspense.
 */
const GRACE_MS = 1500

/**
 * Le souffle avant une révélation déclenchée par la dernière réponse.
 *
 * Elle partait à l'instant même où cette réponse arrivait, et coupait la
 * parole à celles encore en vol : deux doigts posés au même moment aux deux
 * bouts de la salle, et celui dont le paquet arrivait second voyait sa réponse
 * jetée. La règle est maintenant « on révèle quand la salle est calme depuis
 * ce délai » — un changement d'avis le relance, et le chronomètre de la
 * question reste la borne qui tranche.
 */
const SETTLE_MS = 700

// ── Le barème ────────────────────────────────────────────────────────────
//
// Deux cents points au plus par question, pour les deux types : un quiz qui
// mêle QCM et estimations ne doit pas se jouer sur l'un des deux.

// QCM : cent points pour la bonne réponse, et jusqu'à cent de rapidité. Une
// bonne réponse vaut donc de la moitié au tout du maximum — la part de Kahoot
// et de Mentimeter.
const CHOICE_POINTS = 100
const SPEED_BONUS = 100

/**
 * Le temps de lecture offert. Le bonus de rapidité fondait dès l'affichage,
 * alors que les premières secondes toute la salle lit la question et ses
 * réponses : ce temps-là coûtait des points, et davantage à qui lit moins
 * vite ou joue loin de l'écran. Kahoot montre la question seule au moins
 * cinq secondes, plus pour un texte long, avant d'ouvrir les réponses. Ici
 * elles s'ouvrent tout de suite, mais le bonus ne fond qu'après ce temps :
 * une seconde pour lever les yeux, 55 ms par caractère de la question et des
 * réponses — 180 mots par minute, la vitesse de lecture que retient Kahoot —,
 * une seconde et demie de plus pour une photo à regarder. Jamais plus de la
 * moitié du chrono : la seconde moitié reste une course.
 */
const LECTURE_MS = 1000
const LECTURE_MS_PAR_CARACTERE = 55
const LECTURE_PHOTO_MS = 1500

// Estimation : trente points pour avoir proposé un nombre — personne ne reste
// bloqué faute de savoir —, puis jusqu'à cent soixante-dix selon la distance
// (voir `pointsDesEstimations`).
const GUESS_POINTS = 30
const PROXIMITY_POINTS = 170
/** L'écart qu'on pardonne toujours : deux crans du dernier chiffre de la réponse — deux ans sur 1994, 0,2 sur 7,5. */
const CRANS_TOLERES = 2

/** Le temps de lire une question et ses réponses, en ms : le bonus de rapidité ne fond qu'après. */
export function tempsDeLecture(q: PlayableQuestion): number {
  const textes = [q.text, ...(q.kind === 'choice' ? q.answers : [])]
  // Par caractère, pas par unité de code : un emoji se lit d'un coup d'œil.
  const caracteres = textes.reduce((n, t) => n + [...t.trim()].length, 0)
  // Une photo « mémoire » a été regardée avant, pendant l'observation.
  const photo = q.image && !q.observeSeconds ? LECTURE_PHOTO_MS : 0
  return Math.min((q.duration * 1000) / 2, LECTURE_MS + LECTURE_MS_PAR_CARACTERE * caracteres + photo)
}

/**
 * Les points d'une bonne réponse à un QCM arrivée `ms` après l'affichage :
 * le maximum pendant le temps de lecture, puis une pente jusqu'à la moitié à
 * l'échéance — la moitié encore pour une réponse partie juste avant, que le
 * réseau livre pendant la marge.
 */
export function pointsDuChoix(ms: number, dureeMs: number, lectureMs: number): number {
  const course = dureeMs - lectureMs
  const reste = course > 0 ? Math.min(1, Math.max(0, (dureeMs - ms) / course)) : 1
  return CHOICE_POINTS + Math.round(SPEED_BONUS * reste)
}

/**
 * Les points de chaque estimation d'une question, dans l'ordre des valeurs.
 *
 * C'est la distance qui paie, plus le rang. Au rang, le plus proche touchait
 * 200 points et, à deux joueurs, l'autre 30 — qu'il ait tapé 8,2 pour 8 ou
 * 800. Chacun marque maintenant selon SA distance : la moitié de la
 * proximité à l'écart typique de la salle (la médiane des écarts), le quart
 * au double, tout à la réponse exacte — la courbe de GeoGuessr ou de
 * TimeGuessr, qui ne font pas un gouffre d'un pas de plus. La même distance
 * vaut les mêmes points, de part et d'autre de la réponse (`ecartEstimation`).
 *
 * L'écart typique garde ce que le rang avait de bon : il vient de la salle,
 * il sait donc qu'une erreur de 3 ans sur une date n'a pas le sens d'une
 * erreur de 3 km, et une faute de frappe (« 19940 » pour 1994) ne le déplace
 * pas — c'est une médiane. Deux bornes le tiennent quand la salle est trop
 * petite pour en juger :
 * · jamais moins de deux crans du dernier chiffre de la réponse : quand tout
 *   le monde tombe tout près, 7,9 et 8,2 pour 8 valent presque autant, au
 *   lieu que le premier prenne tout ;
 * · jamais plus que la réponse elle-même : une erreur aussi grande que la
 *   bonne réponse n'a rien de typique, et « 50 » pour 8 ne touche que sa
 *   participation, même à deux.
 */
export function pointsDesEstimations(cible: number, valeurs: readonly number[]): number[] {
  const ecarts = valeurs.map(v => ecartEstimation(v, cible))
  const tolerance = CRANS_TOLERES * 10 ** -Math.min(12, decimales(cible))
  const typique = Math.max(tolerance, Math.min(mediane(ecarts), Math.abs(cible)))
  return ecarts.map(e => GUESS_POINTS + Math.round(PROXIMITY_POINTS * 2 ** (-e / typique)))
}

function mediane(xs: readonly number[]): number {
  if (xs.length === 0) return 0
  const tries = [...xs].sort((a, b) => a - b)
  const milieu = tries.length >> 1
  return tries.length % 2 ? tries[milieu] : (tries[milieu - 1] + tries[milieu]) / 2
}

// ── Bibliothèque ─────────────────────────────────────────────────────────
//
// Le moteur de jeu est synchrone alors que la bibliothèque vit dans une base
// asynchrone (potentiellement distante). On garde donc une copie en mémoire,
// rafraîchie au démarrage et après chaque édition — jamais pendant une partie.
// Une bibliothèque par espace : chaque animateur ne joue que ses quiz.

const libraries = new Map<string, QuizPack[]>()

export function setQuizLibrary(spaceId: string, quizzes: QuizDef[]) {
  libraries.set(
    spaceId,
    quizzes
      // Archivé, il attend à l'écart : il ne se propose plus au choix de la soirée.
      .filter(q => !q.archivedAt)
      .map(q => ({
        id: q.id,
        title: q.title,
        questions: playableQuestions(q),
        ...(q.reglages && Object.keys(q.reglages).length > 0 && { reglages: q.reglages }),
      }))
      .filter(p => p.questions.length > 0),
  )
}

/** La bibliothèque d'un espace telle qu'elle se joue : titres et questions jouables. */
export function quizLibrary(spaceId: string): QuizPack[] {
  return libraries.get(spaceId) ?? []
}

/** Oublie la bibliothèque d'un espace : son compte est supprimé. */
export function clearQuizLibrary(spaceId: string) {
  libraries.delete(spaceId)
  programmes.delete(spaceId)
  questionsPosees.delete(spaceId)
}

/**
 * Le programme de ce soir de chaque espace, tel que la console le lit au
 * lancement — rechargé comme la bibliothèque, à chaque modification.
 */
const programmes = new Map<string, { titre: string; entrees: EntreeDeProgramme[] }>()

export function setProgramme(spaceId: string, programme: { titre: string; entrees: EntreeDeProgramme[] } | null) {
  if (programme) programmes.set(spaceId, { titre: programme.titre, entrees: programme.entrees })
  else programmes.delete(spaceId)
}

/**
 * La liste du choix : le programme d'abord, dans son ordre, chacun avec son
 * multiplicateur ; le reste comme la bibliothèque le range. Et ce que chaque
 * quiz contient — catégories, estimations, durée —, pour le reconnaître
 * sans l'ouvrir.
 */
function choixDeLaSoiree(
  spaceId: string,
  library: QuizPack[],
  joues: Set<string>,
): { packs: QuizPackInfo[]; programme?: ProgrammeDuSoir } {
  const programme = programmes.get(spaceId)
  const avancement = programme ? avancementDuProgramme(programme.entrees, new Set(library.map(p => p.id)), joues) : null
  const rangs = new Map(avancement?.entrees.map((e, i) => [e.quizId, { rang: i + 1, multiplier: e.multiplier }]))
  const packs = library.map(p => {
    const parCategorie = new Map<string, number>()
    for (const q of p.questions) if (q.category) parCategorie.set(q.category, (parCategorie.get(q.category) ?? 0) + 1)
    const auProgramme = rangs.get(p.id)
    // Un tirage joue moins de questions que le quiz n'en a : la carte dit
    // ce qui se jouera, et la durée suit.
    const jouees = Math.min(p.questions.length, p.reglages?.tirage ?? Infinity)
    return {
      id: p.id,
      title: p.title,
      questionCount: jouees,
      ...(joues.has(p.id) && { joueCeSoir: true as const }),
      categories: [...parCategorie.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).map(([c]) => c),
      estimations: p.questions.filter(q => q.kind === 'number').length,
      dureeS: dureeDesJouables(p.questions.slice(0, jouees)),
      ...(auProgramme && { auProgramme }),
    }
  })
  // Un tri stable : hors programme, l'ordre de la bibliothèque demeure.
  packs.sort((a, b) => (a.auProgramme?.rang ?? MAX_ENTREES + 1) - (b.auProgramme?.rang ?? MAX_ENTREES + 1))
  if (!programme || !avancement || avancement.entrees.length === 0) return { packs }
  return {
    packs,
    programme: {
      titre: programme.titre,
      total: avancement.entrees.length,
      prochain: avancement.prochain?.quizId ?? null,
      ensuite: avancement.ensuite?.quizId ?? null,
    },
  }
}

/**
 * Le quiz d'une partie, tel qu'il a été joué, relu dans l'état persisté de la
 * partie. Le bilan s'en sert pour retrouver les intitulés exacts : la
 * bibliothèque a pu être retouchée depuis, pas cette copie.
 */
export function playedPackOf(state: unknown): { id?: string; title: string; questions: PlayableQuestion[] } | null {
  const pack = (state as Partial<QuizState> | null)?.pack
  if (!pack || typeof pack.title !== 'string' || !Array.isArray(pack.questions)) return null
  return { ...(typeof pack.id === 'string' && { id: pack.id }), title: pack.title, questions: pack.questions }
}

/**
 * Pour chaque question de l'espace, le début de la dernière soirée où elle a
 * été posée : le tirage d'un quiz (`tirerQuestions`) choisit d'abord celles
 * qu'on n'a jamais posées. Rechargé à chaque écriture de l'historique.
 */
const questionsPosees = new Map<string, ReadonlyMap<string, number>>()

export function setQuestionsPosees(spaceId: string, dernieres: ReadonlyMap<string, number>) {
  questionsPosees.set(spaceId, dernieres)
}

// ── Déroulé ──────────────────────────────────────────────────────────────

/**
 * Photo « mémoire » : on la projette seule avant la question. Sans cette
 * phase, la question et les réponses seraient à l'écran en même temps que la
 * photo, et il suffirait de répondre vite en la regardant.
 */
function startQuestion(sess: GameSessionRec<QuizState>, index: number, ctx: GameContext, sansIntertitre = false) {
  const st = sess.state
  const q = st.pack!.questions[index]
  st.qIndex = index
  // Un nouveau tour : un geste qui visait le précédent — la même question
  // avant qu'on la repose comprise — ne s'applique plus à celui-ci.
  st.round = (st.round ?? 0) + 1
  st.cancelled = false
  st.responses = {}
  st.lastAwards = {}
  st.pausedMs = null
  st.cibleSaisie = false
  // « Qui dans la salle ? » : ceux qui peuvent jouer cette question, dans
  // l'ordre d'arrivée — soixante au plus, une liste qui se parcourt encore au doigt.
  st.candidats =
    q.kind === 'choice' && q.variante === 'sondage'
      ? sess.participantIds.filter(id => (st.playFrom[id] ?? 0) <= index).slice(0, MAX_CANDIDATS)
      : undefined
  // Revenu en ligne, on l'attend de nouveau — à partir de cette question-ci,
  // jamais au milieu de celle où il revient : la salle n'a pas à réattendre
  // pour une question déjà presque jouée. Ne plus l'attendre est un choix de
  // l'animateur sur une panne, pas une sortie du jeu.
  if (st.dispenses?.length) st.dispenses = st.dispenses.filter(id => !ctx.connected(id))
  // Une question reposée hérite sinon du souffle armé par la précédente, qui
  // la révélerait avant que personne ait eu le temps de répondre.
  ctx.clearTimer('settle')
  // L'intertitre d'abord : une diapo sans réponse, que l'animateur passe d'un
  // clic — ou qui dure ce que dure l'enchaînement, s'il en a réglé un. Une
  // question reposée ne le rejoue pas : la salle vient de le voir.
  if (q.intertitre && !sansIntertitre) {
    st.phase = 'intertitre'
    st.deadline = 0
    if (st.autoNextSeconds !== null) {
      st.deadline = ctx.now() + st.autoNextSeconds * 1000
      ctx.setTimer('intertitre', st.autoNextSeconds * 1000)
    }
    return
  }
  apresIntertitre(sess, ctx)
}

/** La photo à observer, s'il y en a une ; sinon la question. */
function apresIntertitre(sess: GameSessionRec<QuizState>, ctx: GameContext) {
  const st = sess.state
  const q = st.pack!.questions[st.qIndex]
  ctx.clearTimer('intertitre')
  if (q.image && q.observeSeconds) {
    st.phase = 'observe'
    st.deadline = ctx.now() + q.observeSeconds * 1000
    ctx.setTimer('observe', q.observeSeconds * 1000)
    return
  }
  beginAnswering(sess, ctx)
}

/** La question s'affiche et le chronomètre part. */
function beginAnswering(sess: GameSessionRec<QuizState>, ctx: GameContext) {
  const st = sess.state
  const q = st.pack!.questions[st.qIndex]
  ctx.clearTimer('observe')
  st.phase = 'question'
  st.questionStartAt = ctx.now()
  st.deadline = st.questionStartAt + q.duration * 1000
  st.pausedMs = null
  ctx.setTimer('question', q.duration * 1000 + GRACE_MS)
}

function award(sess: GameSessionRec<QuizState>, playerId: string, points: number, ctx: GameContext) {
  const st = sess.state
  // Tout gain passe ici : c'est le seul endroit où appliquer le multiplicateur.
  const gain = points * st.multiplier
  st.lastAwards[playerId] = gain
  if (gain <= 0) return
  st.totals[playerId] = (st.totals[playerId] ?? 0) + gain
  ctx.award(playerId, gain, `Quiz « ${st.pack!.title} » — Q${st.qIndex + 1}`)
}

/** `auClic` : l'animateur a forcé la révélation — il est là, lui. */
function reveal(sess: GameSessionRec<QuizState>, ctx: GameContext, auClic = false) {
  const st = sess.state
  ctx.clearTimer('question')
  ctx.clearTimer('observe')
  ctx.clearTimer('settle')
  // Une estimation en direct se ferme, puis attend que l'animateur tape la
  // bonne réponse : le poids du gâteau ne se connaît qu'une fois pesé.
  const posee = st.pack!.questions[st.qIndex]
  if (posee.kind === 'number' && posee.enDirect && !st.cibleSaisie) {
    st.phase = 'cible'
    return
  }
  st.phase = 'reveal'
  st.lastAwards = {}
  // L'enchaînement s'arme quelle que soit la cause de la révélation : fin du
  // chronomètre, dernière réponse, ou clic de l'animateur — sauf devant une
  // salle vide. Le 24 septembre, une coupure a fait jouer trois questions et
  // un podium à personne : une question close d'elle-même sans une seule
  // réponse de toute la salle attend l'animateur, et l'écran dit pourquoi.
  // Son clic « Révéler », lui, dit qu'il est là : la suite part comme il l'a
  // réglée. Le mode reste choisi, et repart de lui-même à la première
  // question qui reçoit une réponse.
  st.autoNextSuspendu = st.autoNextSeconds !== null && !auClic && Object.keys(st.responses).length === 0
  if (st.autoNextSeconds !== null && !st.autoNextSuspendu) {
    st.autoNextAt = ctx.now() + st.autoNextSeconds * 1000
    ctx.setTimer('autoNext', st.autoNextSeconds * 1000)
  }
  scoreQuestion(sess, ctx)
  logQuestion(sess, ctx)
}

/** Distribue les points de la question qui vient de se terminer. */
function scoreQuestion(sess: GameSessionRec<QuizState>, ctx: GameContext) {
  const st = sess.state
  const q = st.pack!.questions[st.qIndex]

  if (q.kind === 'choice') {
    // « Qui dans la salle ? » ne rapporte rien : rien n'y est juste.
    if (q.variante === 'sondage') return
    const lectureMs = tempsDeLecture(q)
    for (const [playerId, r] of Object.entries(st.responses)) {
      award(sess, playerId, reponseJuste(q, r) ? pointsDuChoix(r.ms, q.duration * 1000, lectureMs) : 0, ctx)
    }
    return
  }

  // Une échelle linéaire entre le plus proche et le plus loin avait un défaut
  // fatal : une seule proposition absurde — « 19940 » pour 1994 — repoussait
  // le maximum si loin que toute la salle touchait le plein de points. Le
  // rang l'avait réglé, mais en payant 200 au premier et 30 au second d'un
  // duel à 0,1 près. La médiane règle les deux : voir `pointsDesEstimations`.
  const guesses = Object.entries(st.responses).filter(([, r]) => r.value !== null)
  if (guesses.length === 0) return
  const points = pointsDesEstimations(q.target, guesses.map(([, r]) => r.value!))
  guesses.forEach(([playerId], i) => award(sess, playerId, points[i], ctx))
}

/** Soixante invités au plus à désigner : au-delà, la liste ne se parcourt plus au doigt. */
const MAX_CANDIDATS = 60

/**
 * Juste ou non : la bonne case pour un QCM ; toutes les bonnes, et elles
 * seules, pour « plusieurs » ; le bon ordre entier pour « ordre » — tout ou
 * rien, payé comme un QCM. Un sondage n'a rien de juste.
 */
function reponseJuste(q: PlayableQuestion, r: Response | undefined): boolean {
  if (!r || q.kind !== 'choice') return false
  if (q.variante === 'sondage') return false
  if (q.variante === 'plusieurs' || q.variante === 'ordre') {
    const attendu = q.variante === 'plusieurs' ? q.bonnes : q.ordre
    return !!r.choix && !!attendu && r.choix.length === attendu.length && r.choix.every((c, i) => c === attendu[i])
  }
  return r.choice === q.correct
}

/** Des index envoyés par un téléphone : chacun une fois, tous dans les réponses — ou null. */
function lireIndex(brut: unknown, n: number): number[] | null {
  if (!Array.isArray(brut) || brut.length === 0 || brut.length > n) return null
  const lus = brut.map(Number)
  if (lus.some(i => !Number.isInteger(i) || i < 0 || i >= n) || new Set(lus).size !== lus.length) return null
  return lus
}

/**
 * Combien de participants la question en cours attend encore : ceux qui
 * pouvaient y répondre et ne l'ont pas fait. Un retardataire arrivé après
 * qu'elle a été posée n'est pas attendu — c'est le même filtre que le journal,
 * sinon la salle patienterait pour quelqu'un qui n'a jamais vu la question.
 *
 * Un téléphone en veille reste attendu, lui : l'exclure reviendrait à révéler
 * dans le dos de quelqu'un dont le réseau a hoqueté une seconde. Mais une
 * panne définitive — le téléphone mort de Rachid — faisait attendre toute la
 * salle, chrono entier, à chaque question : l'animateur peut donc « ne plus
 * l'attendre » (`dispenses`). C'est lui qui choisit, jamais le serveur.
 */
function awaited(sess: GameSessionRec<QuizState>): string[] {
  const st = sess.state
  return sess.participantIds.filter(
    id => (st.playFrom[id] ?? 0) <= st.qIndex && !(id in st.responses) && !st.dispenses?.includes(id),
  )
}

/**
 * Ceux que la console montre comme attendus : les hors-ligne qu'on attend
 * encore d'abord — c'est pour les trouver qu'on regarde —, puis ceux qu'on
 * n'attend plus, puis les connectés, chaque groupe dans l'ordre d'arrivée.
 * Ceux qu'on n'attend plus restent dans la liste, marqués : l'animateur voit
 * qu'il a tranché, et pour qui. Mais derrière ceux qu'il doit encore
 * trancher : triés sur « hors ligne » seul, quarante téléphones morts dont
 * trente dispensés gardaient la tête de la liste, et les dix autres
 * passaient derrière le plafond, hors de portée de « Ne plus l'attendre ».
 */
function attendus(sess: GameSessionRec<QuizState>, vctx: ViewContext): { liste: QuizAttendu[]; enPlus: number } {
  const st = sess.state
  const lignes = sess.participantIds
    .filter(id => (st.playFrom[id] ?? 0) <= st.qIndex && !(id in st.responses))
    .map(id => {
      const horsLigne = !vctx.connected(id)
      return { id, horsLigne, rang: !horsLigne ? 2 : st.dispenses?.includes(id) ? 1 : 0 }
    })
    .sort((a, b) => a.rang - b.rang)
  // On ne décore que les lignes montrées : cette vue se recalcule à chaque
  // réponse, et décorer cinq cents invités à chaque fois coûtait le podium.
  const liste = lignes.slice(0, ATTENDUS_MONTRES).map(({ id, horsLigne }) => ({
    playerId: id,
    // La troisième porte du prénom (invariant 17) : « Camille (2) », pas « Camille ».
    name: vctx.playerName(id),
    avatar: vctx.player(id)?.avatar ?? '🎉',
    ...(horsLigne && { horsLigne: true as const }),
    ...(st.dispenses?.includes(id) && { dispense: true as const }),
  }))
  return { liste, enPlus: lignes.length - liste.length }
}

function cancelQuestion(sess: GameSessionRec<QuizState>, ctx: GameContext) {
  const st = sess.state
  // La question sort aussi des statistiques : elle n'aurait pas dû être posée,
  // et une question reposée ne doit pas compter deux fois.
  ctx.dropAnswers(st.qIndex)
  for (const [playerId, points] of Object.entries(st.lastAwards)) {
    if (points <= 0) continue
    st.totals[playerId] = (st.totals[playerId] ?? 0) - points
    ctx.award(playerId, -points, `Annulation — Q${st.qIndex + 1}`)
  }
  st.lastAwards = {}
  st.cancelled = true
}

/**
 * Vrai si le geste visait un autre moment que celui-ci : une autre phase,
 * une autre question, ou la même avant qu'on la repose.
 *
 * Un champ absent ne dit rien : c'est un écran resté sur une page d'avant, et
 * son geste se lit comme avant — à la lumière du moment présent.
 */
function perimee(st: QuizState, visee: Visee | null | undefined): boolean {
  if (!visee || typeof visee !== 'object') return false
  return (
    (visee.phase != null && visee.phase !== st.phase) ||
    (visee.qIndex != null && visee.qIndex !== st.qIndex) ||
    (visee.round != null && visee.round !== st.round)
  )
}

/** Question suivante, ou podium si c'était la dernière. */
function goNext(sess: GameSessionRec<QuizState>, ctx: GameContext) {
  const st = sess.state
  if (!st.pack) return
  ctx.clearTimer('autoNext')
  st.autoNextAt = null
  st.autoNextSuspendu = false
  if (st.qIndex + 1 < st.pack.questions.length) startQuestion(sess, st.qIndex + 1, ctx)
  else {
    st.phase = 'finished'
    // Le podium est à l'écran : l'expérience du quiz se crédite maintenant,
    // sans attendre le clic « Terminer le quiz » — qui ne vient parfois
    // jamais, quand le dernier podium reste affiché jusqu'au bout de la nuit.
    ctx.verdict()
  }
}

/** Une ligne du classement du quiz. */
interface LigneDuClassement {
  playerId: string
  points: number
  /** Le nom tel qu'on l'affiche — « Camille (2) » : c'est lui qui range les ex æquo. */
  nom: string
}

/**
 * Le classement du quiz, du premier au dernier, chacun avec son rang. Trié
 * une fois par diffusion et partagé par toutes les vues qui la composent :
 * chaque téléphone le retriait pour lui seul, à chaque réponse reçue — à
 * 500 invités, une demi-minute de processeur par question.
 *
 * La règle est celle de `shared/classement.ts`, la seule : le rang partagé
 * — trois joueurs à zéro sont premiers ensemble —, et les ex æquo rangés
 * par nom affiché, puis par identifiant. Le podium du quiz les rangeait par
 * identifiant seul : l'écran commun montrait Zoé avant Alice, et le souvenir
 * du lendemain Alice avant Zoé. Les noms se lisent une fois par diffusion,
 * dans les marques d'homonymie déjà gardées en mémoire (`vctx.playerName`).
 */
function classement(sess: GameSessionRec<QuizState>, vctx: ViewContext): Classe<LigneDuClassement>[] {
  return vctx.memo('quiz:classement', () =>
    classer(
      sess.participantIds.map(id => ({ playerId: id, points: sess.state.totals[id] ?? 0, nom: vctx.playerName(id) })),
      l => l.points,
      l => l.nom,
      l => l.playerId,
    ),
  )
}

/**
 * Le classement des places, indexé une fois par diffusion : la position de
 * chacun, et les bornes de son groupe d'ex æquo. Les voisins de chaque
 * téléphone s'y lisent en temps constant — les chercher en parcourant le
 * classement ferait un tour de salle par téléphone, N² par révélation.
 *
 * Seuls ceux qui ont pu jouer une question y tiennent une place. Un
 * retardataire arrivé pendant la révélation n'a rien joué : compté, il
 * rejoindrait les ex æquo à zéro, et chacun d'eux recevrait sa vue une fois
 * de plus — à la première question d'une grande salle, des centaines de
 * téléphones par arrivée. À zéro, il n'est devant personne : aucun rang ne
 * change de l'écarter.
 */
function indexDesPlaces(sess: GameSessionRec<QuizState>, vctx: ViewContext) {
  const st = sess.state
  return vctx.memo('quiz:places', () => {
    const lignes = classement(sess, vctx).filter(c => (st.playFrom[c.item.playerId] ?? 0) <= st.qIndex)
    return { lignes, position: new Map(lignes.map((c, i) => [c.item.playerId, i])), ...groupesDExAequo(lignes) }
  })
}

/**
 * Son rang au quiz, lu dans le même index que sa place : une reconnexion ne
 * calcule que sa vue, et ne doit pas indexer deux fois toute la salle pour
 * elle. Un retardataire qui n'a encore rien joué n'y est pas : il est
 * derrière tous ceux qui ont plus que lui — la règle du rang partagé,
 * comptée pour lui seul.
 */
function rangDe(sess: GameSessionRec<QuizState>, vctx: ViewContext, playerId: string): number | undefined {
  const { lignes, position } = indexDesPlaces(sess, vctx)
  const i = position.get(playerId)
  if (i !== undefined) return lignes[i].rang
  if (!sess.participantIds.includes(playerId)) return undefined
  // Les retardataires sont tous à zéro : un seul compte par diffusion.
  const sien = sess.state.totals[playerId] ?? 0
  return vctx.memo(`quiz:rang-hors-place:${sien}`, () => 1 + lignes.reduce((devant, c) => devant + (c.item.points > sien ? 1 : 0), 0))
}

/** Son total avant la question révélée : ce qu'elle lui a rapporté en moins. */
function totalDAvant(st: QuizState, playerId: string): number {
  return (st.totals[playerId] ?? 0) - (st.lastAwards[playerId] ?? 0)
}

/**
 * Son rang avant la question révélée — rien tant que personne n'avait
 * marqué : tout le monde était alors premier ex æquo.
 *
 * Une diffusion lit ici toute la salle, une reconnexion un seul téléphone.
 * La première lecture compte donc ceux qui étaient devant ; à la deuxième,
 * c'est une diffusion : les totaux d'avant se rangent, une fois, et chacun y
 * lit le sien par dichotomie. Rangés dès la première, une vague de cinq
 * cents réveils rangerait cinq cents fois la salle, pour un téléphone chacun.
 */
function rangDAvant(sess: GameSessionRec<QuizState>, vctx: ViewContext, playerId: string): number | undefined {
  const st = sess.state
  const avant = vctx.memo('quiz:avant', () => ({ lectures: 0, tries: null as number[] | null }))
  const sien = totalDAvant(st, playerId)
  if (avant.lectures++ === 0) {
    let devant = 0
    let marque = false
    for (const id of sess.participantIds) {
      const total = totalDAvant(st, id)
      if (total > 0) marque = true
      if (total > sien) devant++
    }
    return marque ? devant + 1 : undefined
  }
  avant.tries ??= sess.participantIds.map(id => totalDAvant(st, id)).sort((a, b) => b - a)
  return avant.tries[0] > 0 ? rangDansLesTries(sien, avant.tries) : undefined
}

/**
 * Sa place au classement du quiz : le plus proche devant lui, le plus proche
 * derrière, ses ex æquo — et, à la révélation, le rang qu'il avait avant la
 * question. Rien ne se trie ni ne se décore pour un téléphone : le
 * classement l'a été une fois pour toute la salle, et le téléphone décore
 * ses voisins avec l'instantané qu'il a déjà.
 */
function placeAuQuiz(
  sess: GameSessionRec<QuizState>,
  vctx: ViewContext,
  playerId: string,
  avecAvant: boolean,
): PlaceAuQuiz | undefined {
  const { lignes, position, premier, dernier } = indexDesPlaces(sess, vctx)
  const i = position.get(playerId)
  if (i === undefined) return undefined
  const voisin = (j: number): VoisinAuClassement | undefined => {
    const c = lignes[j]
    return c && { id: c.item.playerId, points: c.item.points, rang: c.rang }
  }
  const devant = voisin(premier[i] - 1)
  const derriere = voisin(dernier[i] + 1)
  const exAequo = dernier[i] - premier[i]
  const avant = avecAvant ? rangDAvant(sess, vctx, playerId) : undefined
  return {
    ...(devant && { devant }),
    ...(derriere && { derriere }),
    ...(exAequo > 0 && { exAequo }),
    ...(avant !== undefined && avant !== lignes[i].rang && { avant }),
  }
}

function standings(sess: GameSessionRec<QuizState>, vctx: ViewContext, limit?: number): QuizPodiumRow[] {
  const rows = classement(sess, vctx)
  // On ne décore que les lignes montrées : chaque décoration interroge le
  // registre des invités, et le podium n'en montre que trois.
  return (limit ? rows.slice(0, limit) : rows).map(({ item, rang }) => {
    const p = vctx.player(item.playerId)
    return {
      name: p ? nomAffiche(p) : item.nom,
      avatar: p?.avatar ?? '🎉',
      points: item.points,
      // Le rang voyage avec la ligne : l'écran commun affiche la suite du
      // podium à partir du quatrième, et le déduisait de sa position dans
      // cette suite — « 4 » pour un troisième ex æquo.
      rank: rang,
      ...distinctions(p),
    }
  })
}

/** Sa place sur le podium, s'il y monte : les mêmes trois lignes que `standings`. */
function podiumDe(sess: GameSessionRec<QuizState>, vctx: ViewContext, playerId: string): { yourPodiumIndex?: number } {
  const ids = vctx.memo('quiz:podium-ids', () => classement(sess, vctx).slice(0, 3).map(c => c.item.playerId))
  const i = ids.indexOf(playerId)
  return i >= 0 ? { yourPodiumIndex: i } : {}
}

/**
 * Les réponses telles que la question les montre : les invités d'un
 * sondage — leur nom affiché, marque d'homonymie comprise (invariant 17) —,
 * ou celles écrites.
 */
function reponsesMontrees(sess: GameSessionRec<QuizState>, q: PlayableQuestion, vctx: ViewContext): string[] | undefined {
  if (q.kind !== 'choice') return undefined
  // Soixante noms pour chaque téléphone de la salle : lus une fois par diffusion.
  if (q.variante === 'sondage') return vctx.memo('quiz:candidats', () => (sess.state.candidats ?? []).map(id => vctx.playerName(id)))
  return q.answers
}

/**
 * Une estimation en direct annulée avant d'être mesurée n'a pas de cible :
 * la sienne vaut zéro dans la copie jouée, et « 0 kg » à l'écran serait faux.
 */
function cibleInconnue(st: QuizState, q: PlayableQuestion): boolean {
  return q.kind === 'number' && !!q.enDirect && !st.cibleSaisie
}

/** Combien ont désigné chaque réponse — pour « plusieurs », chaque case cochée compte. */
function compteParReponse(sess: GameSessionRec<QuizState>, q: PlayableQuestion & { kind: 'choice' }): number[] {
  const reponses = Object.values(sess.state.responses)
  const n = q.variante === 'sondage' ? (sess.state.candidats?.length ?? 0) : q.answers.length
  return Array.from({ length: n }, (_, i) => {
    if (q.variante === 'plusieurs') return reponses.filter(r => r.choix?.includes(i)).length
    // « Ordre » : ceux qui ont mis cette réponse à sa bonne place.
    if (q.variante === 'ordre') return reponses.filter(r => r.choix?.[q.ordre!.indexOf(i)] === i).length
    return reponses.filter(r => r.choice === i).length
  })
}

/** « Qui dans la salle ? » : les invités les plus désignés, puis par nom — le même pour toute la salle. */
function votesDuSondage(sess: GameSessionRec<QuizState>, vctx: ViewContext, limite: number): VoteDeSondage[] {
  const candidats = sess.state.candidats ?? []
  const comptes = compteParReponse(sess, sess.state.pack!.questions[sess.state.qIndex] as PlayableQuestion & { kind: 'choice' })
  return candidats
    // Un invité exclu depuis n'est plus à désigner : ses votes reçus partent avec lui.
    .flatMap((id, i) => {
      const joueur = vctx.player(id)
      return joueur ? [{ name: vctx.playerName(id), avatar: joueur.avatar, votes: comptes[i] ?? 0 }] : []
    })
    .filter(v => v.votes > 0)
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'fr'))
    .slice(0, limite)
}

/** Les propositions d'une question « estimation », de la plus proche à la plus loin. */
function guessRows(sess: GameSessionRec<QuizState>, target: number, vctx: ViewContext, limit: number): QuizGuessRow[] {
  const st = sess.state
  const propositions = Object.entries(st.responses)
    .filter(([, r]) => r.value !== null)
    .map(([playerId, r]) => ({ playerId, r, error: ecartEstimation(r.value!, target) }))
  // Le rang se lit sur toute la salle, pas sur les lignes montrées.
  const ecarts = propositions.map(p => -p.error)
  return propositions
    .sort((a, b) => a.error - b.error || a.r.ms - b.r.ms)
    // Même raison que pour le classement : on ne décore que les lignes montrées.
    .slice(0, limit)
    .map(({ playerId, r, error }) => {
      const p = vctx.player(playerId)
      return {
        name: p ? nomAffiche(p) : vctx.playerName(playerId),
        avatar: p?.avatar ?? '🎉',
        value: r.value!,
        points: st.lastAwards[playerId] ?? 0,
        // L'écran commun numérotait les lignes : 8,1 pour 8 s'affichait
        // « 2 » sous la cible de 7,9, pour autant de points.
        rank: rangPartage(-error, ecarts),
        ...distinctions(p),
      }
    })
}

/**
 * Écrit la question au journal : une ligne par joueur qui pouvait y répondre,
 * qu'il ait répondu ou non. C'est la seule trace des erreurs, des temps de
 * réponse et des questions laissées passer — le classement, lui, n'enregistre
 * que les gains positifs.
 *
 * Les retardataires sont exclus des questions posées avant leur arrivée :
 * on ne peut pas leur reprocher une question qu'ils n'ont jamais vue.
 */
function logQuestion(sess: GameSessionRec<QuizState>, ctx: GameContext) {
  const st = sess.state
  const q = st.pack!.questions[st.qIndex]
  const durationMs = q.duration * 1000
  // Un sondage n'a ni juste ni faux : écrit au journal, il ferait baisser la
  // précision de ceux qui ont voté, et monter l'assiduité de rien.
  if (q.kind === 'choice' && q.variante === 'sondage') return
  // « Plusieurs » et « ordre » disent juste ou faux ; leurs cases n'ont pas
  // de place dans la colonne d'une seule réponse, qui compte la répartition.
  const variante = q.kind === 'choice' && !!q.variante

  ctx.logAnswers(
    sess.participantIds
      .filter(playerId => (st.playFrom[playerId] ?? 0) <= st.qIndex)
      .map(playerId => {
        const r = st.responses[playerId]
        const answered = !!r && (r.choice !== null || r.value !== null || (r.choix?.length ?? 0) > 0)
        return {
          quizTitle: st.pack!.title,
          qIndex: st.qIndex,
          kind: q.kind,
          playerId,
          answered,
          correct: q.kind === 'choice' && answered ? reponseJuste(q, r) : null,
          choice: variante ? null : (r?.choice ?? null),
          value: r?.value ?? null,
          target: q.kind === 'number' ? q.target : null,
          ms: answered ? r!.ms : null,
          changes: r?.changes ?? 0,
          points: st.lastAwards[playerId] ?? 0,
          durationMs,
          observed: !!q.image && !!q.observeSeconds,
          category: q.category ?? null,
        }
      }),
  )
}

/**
 * Vrai quand la photo a été montrée puis retirée : pendant la question, elle
 * ne doit plus être à l'écran, ni même son URL sur le téléphone. À la
 * révélation elle revient, pour vérifier ensemble ce qu'on avait vu.
 */
function hiddenPhoto(q: PlayableQuestion, phase: QuizState['phase']): boolean {
  return phase === 'question' && !!q.image && !!q.observeSeconds
}

// ── Module ───────────────────────────────────────────────────────────────

export const quizModule: GameModule<QuizState> = {
  // Une réponse n'écrit que la ligne de son auteur (`responses[playerId]`),
  // et seule la phase `question` en accepte : la vue d'un invité y lit l'état
  // commun et SA réponse, jamais celle des autres. Le rang et le podium, eux,
  // ne se lisent qu'à la révélation — un changement de phase, que le moteur
  // rediffuse à toute la salle. Une vue de téléphone qui viendrait à lire la
  // réponse d'un autre en pleine question doit faire tomber cette promesse.
  vueDependDesAutres: false,

  createInitialState(spaceId, _participants, config): QuizState {
    const library = quizLibrary(spaceId)
    if (library.length === 0) {
      throw new Error('Aucun quiz prêt à jouer — ouvre « Mes quiz » pour en créer un, ou partir d’un modèle')
    }
    const lancement = (config ?? {}) as LancementDeQuiz
    const joues = new Set(Array.isArray(lancement.joues) ? lancement.joues : [])
    const auto = lancement.autoNextSeconds
    const { packs, programme } = choixDeLaSoiree(spaceId, library, joues)
    return {
      phase: 'pickPack',
      packs,
      ...(programme && { programme }),
      ...(joues.size > 0 && { soireeEntamee: true }),
      pack: null,
      qIndex: 0,
      round: 0,
      questionStartAt: 0,
      deadline: 0,
      responses: {},
      lastAwards: {},
      totals: {},
      playFrom: {},
      multiplier: 1,
      pausedMs: null,
      // Le réglage du quiz d'avant, relu comme la commande le relit.
      autoNextSeconds:
        typeof auto === 'number' && Number.isFinite(auto) ? Math.min(ENCHAINEMENT_MAX_S, Math.max(2, Math.round(auto))) : null,
      autoNextAt: null,
    }
  },

  onPlayerAction(sess, playerId, action: QuizAction, ctx) {
    const st = sess.state
    // L'ordre compte : une réponse arrivée après la révélation d'une question
    // qu'on avait mise en pause est en retard, pas gelée.
    if (st.phase !== 'question' || !st.pack) return 'too-late'
    // En retard aussi, la réponse qui visait une autre question : tapée sur la
    // précédente et retenue par une coupure, ou sur celle-ci avant qu'on la
    // repose. Acceptée, elle s'inscrivait sur une question que l'invité
    // n'avait jamais vue, son temps compté depuis le début de celle-là.
    if (perimee(st, { qIndex: action?.qIndex, round: action?.round })) return 'too-late'
    if (st.pausedMs !== null) return 'paused'
    // Arrivé pendant une révélation, on joue à partir de la question suivante :
    // celle-ci n'est pas la sienne, et le journal ne l'y attend pas. Des points
    // marqués hors du journal, c'est un classement que le bilan n'explique plus.
    if ((st.playFrom[playerId] ?? 0) > st.qIndex) return 'not-participant'
    const q = st.pack.questions[st.qIndex]

    // Changer d'avis est permis jusqu'à la révélation, pour les deux types de
    // question. Un doigt qui glisse sur un téléphone tenu dans le noir ne doit
    // pas coûter la question.
    //
    // C'est le dernier envoi qui fait foi, y compris pour l'heure : sinon on
    // pourrait taper une réponse au hasard dès la première seconde pour
    // s'assurer le bonus de rapidité, puis la corriger tranquillement.
    // Se raviser coûte donc du bonus — ce qui est exactement le compromis
    // qu'on veut.
    if (action?.type === 'answer' && q.kind === 'choice' && (!q.variante || q.variante === 'sondage')) {
      const choice = Number(action.choice)
      // Un sondage désigne un invité parmi ceux de la question.
      const n = q.variante === 'sondage' ? (st.candidats?.length ?? 0) : q.answers.length
      if (!Number.isInteger(choice) || choice < 0 || choice >= n) return 'invalid'
      const before = st.responses[playerId]
      // Rien à réécrire, mais la réponse est bien celle-là : c'est un succès.
      // Le joueur qui retape la même case parce qu'il doute doit être confirmé.
      if (before?.choice === choice) return
      st.responses[playerId] = {
        choice,
        value: null,
        ms: ctx.now() - st.questionStartAt,
        changes: (before?.changes ?? -1) + 1,
      }
    } else if (
      (action?.type === 'answers' && q.kind === 'choice' && q.variante === 'plusieurs') ||
      (action?.type === 'order' && q.kind === 'choice' && q.variante === 'ordre')
    ) {
      const brut = action.type === 'answers' ? action.choices : action.order
      const lus = lireIndex(brut, q.answers.length)
      // Cochées : un ensemble, rangé ; un ordre : une suite complète.
      const choix = lus && (action.type === 'answers' ? [...lus].sort((a, b) => a - b) : lus.length === q.answers.length ? lus : null)
      if (!choix) return 'invalid'
      const before = st.responses[playerId]
      if (before?.choix && before.choix.length === choix.length && before.choix.every((c, i) => c === choix[i])) return
      st.responses[playerId] = {
        choice: null,
        choix,
        value: null,
        ms: ctx.now() - st.questionStartAt,
        changes: (before?.changes ?? -1) + 1,
      }
    } else if (action?.type === 'guess' && q.kind === 'number') {
      const value = Number(action.value)
      if (!Number.isFinite(value)) return 'invalid'
      const before = st.responses[playerId]
      // Comme pour un QCM : la même valeur renvoyée — double appui, ou renvoi
      // d'une réponse dont l'accusé s'est perdu — est confirmée sans rien
      // réécrire. Ce n'est pas une hésitation, et ça ne doit pas coûter de temps.
      if (before?.value === value) return
      st.responses[playerId] = {
        choice: null,
        value,
        ms: ctx.now() - st.questionStartAt,
        changes: (before?.changes ?? -1) + 1,
      }
    } else {
      return 'invalid'
    }

    // Tout le monde a répondu → on révèle, mais après un souffle : voir SETTLE_MS.
    if (awaited(sess).length === 0) ctx.setTimer('settle', SETTLE_MS)
  },

  onHostCommand(sess, command: QuizCommand, ctx) {
    const st = sess.state
    switch (command?.type) {
      case 'selectPack': {
        if (st.phase !== 'pickPack') return
        const pack = quizLibrary(sess.spaceId).find(p => p.id === command.packId)
        if (!pack) throw new Error('Quiz introuvable')
        // La copie jouée : ses réponses et ses questions dans l'ordre que ses
        // réglages demandent, tiré une fois pour toute la salle. C'est elle
        // que le journal numérote et que l'archive range (`shared/hasard.ts`).
        st.pack = {
          id: pack.id,
          title: pack.title,
          questions: preparerPartie(pack.questions, pack.reglages, Math.random, questionsPosees.get(sess.spaceId)),
        }
        const m = Number(command.multiplier ?? 1)
        st.multiplier = [1, 2, 3].includes(m) ? m : 1
        st.phase = 'getReady'
        st.deadline = ctx.now() + READY_MS
        ctx.setTimer('ready', READY_MS)
        break
      }
      case 'pause': {
        if (st.phase !== 'question' || st.pausedMs !== null) return
        st.pausedMs = Math.max(0, st.deadline - ctx.now())
        ctx.clearTimer('question')
        // Le souffle ne doit pas révéler la question pendant la pause.
        ctx.clearTimer('settle')
        break
      }
      case 'resume': {
        if (st.phase !== 'question' || st.pausedMs === null) return
        // On repousse l'échéance du temps resté figé, pour que les points de
        // rapidité restent cohérents avec ce que les joueurs ont vécu.
        const frozen = st.pausedMs
        const q = st.pack!.questions[st.qIndex]
        st.questionStartAt = ctx.now() - (q.duration * 1000 - frozen)
        st.deadline = ctx.now() + frozen
        st.pausedMs = null
        ctx.setTimer('question', frozen + GRACE_MS)
        // La salle avait fini de répondre avant la pause : on lui rend son souffle.
        if (awaited(sess).length === 0) ctx.setTimer('settle', SETTLE_MS)
        break
      }
      case 'cancel': {
        // Confirmée après que la partie a avancé — la boîte de dialogue était
        // restée ouverte —, elle retirerait les points de la question suivante.
        if ((st.phase !== 'reveal' && st.phase !== 'cible') || perimee(st, command)) return
        // L'animateur reprend la main : un enchaînement programmé ne doit pas
        // emporter la question qu'il est en train de corriger.
        ctx.clearTimer('autoNext')
        st.autoNextAt = null
        // Une estimation en direct qu'on ne mesurera pas — le gâteau est
        // mangé : elle se révèle annulée, sans cible ni points, au lieu de
        // bloquer la partie devant un champ vide.
        if (st.phase === 'cible') st.phase = 'reveal'
        cancelQuestion(sess, ctx)
        break
      }
      case 'replay': {
        if ((st.phase !== 'reveal' && st.phase !== 'cible') || !st.pack || perimee(st, command)) return
        ctx.clearTimer('autoNext')
        st.autoNextAt = null
        cancelQuestion(sess, ctx)
        // Arrivés pendant la révélation, ils attendaient la question suivante ;
        // celle-ci, reposée, se joue devant eux : elle est aussi la leur. Sans
        // ça, ils y répondaient et marquaient, mais le journal les ignorait —
        // et leur téléphone leur souhaitait encore la bienvenue.
        for (const id of sess.participantIds) {
          if ((st.playFrom[id] ?? 0) > st.qIndex) st.playFrom[id] = st.qIndex
        }
        startQuestion(sess, st.qIndex, ctx, true)
        break
      }
      case 'next':
        // « Suivant » se lisait selon la phase courante : un « Révéler » parti
        // juste avant la révélation automatique arrivait après elle et passait
        // à la question suivante — la salle n'avait vu la bonne réponse que
        // quatre-vingt-seize millisecondes. Un clic qui ne vise plus le moment
        // présent est un doublon : ignoré sans un mot.
        if (perimee(st, command)) return
        if (st.phase === 'intertitre') {
          // La diapo a assez duré : la question.
          apresIntertitre(sess, ctx)
        } else if (st.phase === 'observe') {
          // « C'est bon, tout le monde a vu » : on passe à la question.
          beginAnswering(sess, ctx)
        } else if (st.phase === 'question') {
          reveal(sess, ctx, true) // l'animateur force la fin de la question
        } else if (st.phase === 'reveal') {
          goNext(sess, ctx)
        }
        break
      case 'autoNext': {
        const seconds = command.seconds
        st.autoNextSeconds = seconds === null ? null : Math.min(ENCHAINEMENT_MAX_S, Math.max(2, Math.round(seconds)))
        // Un palier choisi à la main relance, même devant une salle vide :
        // c'est l'animateur qui le demande.
        st.autoNextSuspendu = false
        if (st.autoNextSeconds === null) {
          // Reprendre la main : l'enchaînement en attente est annulé.
          ctx.clearTimer('autoNext')
          st.autoNextAt = null
        } else if (st.phase === 'reveal') {
          // Activé pendant une révélation : elle enchaîne sans attendre la suivante.
          st.autoNextAt = ctx.now() + st.autoNextSeconds * 1000
          ctx.setTimer('autoNext', st.autoNextSeconds * 1000)
        }
        break
      }
      case 'cible': {
        if (st.phase !== 'cible' || !st.pack || perimee(st, command)) return
        const q = st.pack.questions[st.qIndex]
        const valeur = Number(command.value)
        if (q.kind !== 'number' || !Number.isFinite(valeur)) throw new Error('Tape la bonne réponse en chiffres')
        // La copie jouée prend la cible : le journal, le bilan et l'archive la liront.
        st.pack.questions[st.qIndex] = { ...q, target: valeur }
        st.cibleSaisie = true
        reveal(sess, ctx, true)
        break
      }
      case 'nePlusAttendre': {
        const playerId = command.playerId
        // Seulement un participant hors ligne : un téléphone qui répond encore
        // n'est pas en panne, et la règle d'attendre le protège d'un hoquet.
        if (typeof playerId !== 'string' || !sess.participantIds.includes(playerId) || ctx.connected(playerId)) return
        if (st.dispenses?.includes(playerId)) return
        st.dispenses = [...(st.dispenses ?? []), playerId]
        // C'était peut-être le dernier qu'on attendait : la salle a fini, on
        // révèle après le souffle, comme après une dernière réponse.
        if (st.phase === 'question' && st.pausedMs === null && awaited(sess).length === 0) {
          ctx.setTimer('settle', SETTLE_MS)
        }
        break
      }
    }
  },

  onPlayerJoin(sess, playerId) {
    const st = sess.state
    // Arrivé pendant une question : il peut encore répondre (avec moins de
    // temps). Arrivé quand elle est close — révélée, attendant sa cible, ou
    // le quiz fini — : il démarre à la suivante. Compté pour une estimation
    // qu'on mesurait, il entrait au journal d'une question qu'il n'avait
    // jamais vue, et sa révélation lui disait « Pas de réponse » au lieu de
    // « Bienvenue » ; arrivé au podium, il y tenait une place de dernier.
    st.playFrom[playerId] = st.phase === 'reveal' || st.phase === 'cible' || st.phase === 'finished' ? st.qIndex + 1 : st.qIndex
  },

  onPlayerLeave(sess, playerId, ctx) {
    const st = sess.state
    // Un exclu part avec tout ce qu'il avait laissé. Sa réponse restait dans
    // la question en cours : elle comptait au barème, aux compteurs de
    // l'écran commun, au « plus rapide » — affiché « ??? » —, et dans une
    // estimation elle volait le premier rang à ceux qui restaient. Ses gains
    // de la question partent aussi : une annulation après coup lui aurait
    // sinon écrit une ligne négative au journal, à lui qui n'existe plus.
    delete st.responses[playerId]
    delete st.lastAwards[playerId]
    delete st.playFrom[playerId]
    delete st.totals[playerId]
    if (st.dispenses) st.dispenses = st.dispenses.filter(id => id !== playerId)
    // Il était peut-être le dernier qu'on attendait : la salle a fini, on
    // révèle après le souffle, comme après une dernière réponse — pas au
    // bout du chronomètre.
    if (st.phase === 'question' && st.pausedMs === null && awaited(sess).length === 0) {
      ctx.setTimer('settle', SETTLE_MS)
    }
  },

  onTimer(sess, timerId, ctx) {
    if (timerId === 'ready' && sess.state.phase === 'getReady') startQuestion(sess, 0, ctx)
    if (timerId === 'intertitre' && sess.state.phase === 'intertitre') apresIntertitre(sess, ctx)
    if (timerId === 'observe' && sess.state.phase === 'observe') beginAnswering(sess, ctx)
    if (timerId === 'question' && sess.state.phase === 'question') reveal(sess, ctx)
    if (timerId === 'settle' && sess.state.phase === 'question') reveal(sess, ctx)
    if (timerId === 'autoNext' && sess.state.phase === 'reveal') goNext(sess, ctx)
  },

  // Pendant la question — en pause comprise —, une réponse donnée n'est pas
  // encore jugée : elle le sera à la révélation, qui la paie. Une estimation
  // en direct attend encore sa cible : sa réponse n'est pas jugée non plus.
  reponseEnSuspens(sess, playerId) {
    const phase = sess.state.phase
    return (phase === 'question' || phase === 'cible') && playerId in sess.state.responses
  },

  playerView(sess, playerId, vctx): QuizPlayerView {
    const st = sess.state
    const mine = st.responses[playerId]
    const base = {
      phase: st.phase,
      qIndex: st.qIndex,
      round: st.round,
      qCount: st.pack?.questions.length ?? 0,
      yourChoice: mine?.choice ?? null,
      yourGuess: mine?.value ?? null,
      ...(mine?.choix && { yourChoices: mine.choix }),
    }
    if (st.phase === 'getReady') return { ...base, deadline: st.deadline }
    // Une estimation en direct est close : la bonne réponse se mesure encore.
    if (st.phase === 'cible' && st.pack) {
      const q = st.pack.questions[st.qIndex]
      return { ...base, kind: q.kind, text: q.text, unit: q.kind === 'number' ? q.unit : undefined }
    }
    // L'intertitre ne dit rien de la question : il part à toute la salle.
    if (st.phase === 'intertitre' && st.pack) return { ...base, intertitre: st.pack.questions[st.qIndex].intertitre }
    // Observation : la photo, et rien d'autre. Ni l'intitulé ni les réponses ne
    // partent au téléphone — sinon il suffirait de répondre en la regardant.
    if (st.phase === 'observe' && st.pack) {
      const q = st.pack.questions[st.qIndex]
      return {
        ...base,
        image: q.image,
        deadline: st.deadline,
        duration: q.observeSeconds ?? 0,
        multiplier: st.multiplier,
      }
    }
    if ((st.phase === 'question' || st.phase === 'reveal') && st.pack) {
      const q = st.pack.questions[st.qIndex]
      const justArrived = (st.playFrom[playerId] ?? 0) > st.qIndex
      return {
        ...base,
        kind: q.kind,
        text: q.text,
        answers: reponsesMontrees(sess, q, vctx),
        ...(q.kind === 'choice' && q.variante && { variante: q.variante }),
        unit: q.kind === 'number' ? q.unit : undefined,
        category: q.category ?? undefined,
        // Photo « mémoire » : elle a disparu, et son URL avec elle. Elle
        // revient à la révélation, pour qu'on puisse vérifier ensemble.
        image: hiddenPhoto(q, st.phase) ? null : q.image,
        photoGone: hiddenPhoto(q, st.phase) || undefined,
        deadline: st.deadline,
        duration: q.duration,
        multiplier: st.multiplier,
        ...(st.pausedMs !== null && { paused: true, remainingMs: st.pausedMs }),
        ...(st.phase === 'reveal' && {
          // L'anecdote et la photo de la révélation : jamais avant (invariant 1).
          ...(q.anecdote && { anecdote: q.anecdote }),
          ...(q.imageRevelation && { imageRevelation: q.imageRevelation }),
          justArrived,
          correct: q.kind === 'choice' ? q.correct : undefined,
          ...(q.kind === 'choice' && q.variante === 'plusieurs' && { bonnes: q.bonnes }),
          ...(q.kind === 'choice' && q.variante === 'ordre' && { ordre: q.ordre }),
          ...(q.kind === 'choice' && (q.variante === 'plusieurs' || q.variante === 'ordre') && { yourCorrect: reponseJuste(q, mine) }),
          // Le même classement des votes pour toute la salle : calculé une fois par diffusion.
          ...(q.kind === 'choice' && q.variante === 'sondage' && { votes: vctx.memo('quiz:votes', () => votesDuSondage(sess, vctx, 3)) }),
          target: q.kind === 'number' && !cibleInconnue(st, q) ? q.target : undefined,
          yourPoints: playerId in st.lastAwards ? st.lastAwards[playerId] : null,
          ...(st.cancelled && { cancelled: true }),
          yourQuizTotal: st.totals[playerId] ?? 0,
          // Le rang ne se lit qu'entre deux questions : pendant la question,
          // aucun classement n'est calculé.
          yourQuizRank: rangDe(sess, vctx, playerId),
          // Sa place entre ses voisins — pas pour qui vient d'arriver : il n'a
          // encore rien joué, et « à 180 pts de Karim » l'accueillerait mal.
          ...(!justArrived && { place: placeAuQuiz(sess, vctx, playerId, true) }),
        }),
      }
    }
    if (st.phase === 'finished') {
      return {
        ...base,
        yourQuizTotal: st.totals[playerId] ?? 0,
        yourQuizRank: rangDe(sess, vctx, playerId),
        // Le même podium pour toute la salle : construit une fois par diffusion.
        podium: vctx.memo('quiz:podium', () => standings(sess, vctx, 3)),
        ...podiumDe(sess, vctx, playerId),
        // Sa place, à chacun : ses voisins, pour qui n'y monte pas. Arrivé
        // après la dernière question, on n'a rien joué : pas de place.
        ...((st.playFrom[playerId] ?? 0) <= st.qIndex && { place: placeAuQuiz(sess, vctx, playerId, false) }),
        ...(st.soireeEntamee && { soireeEntamee: true }),
      }
    }
    return base
  },

  hostView(sess, vctx): QuizHostView {
    const st = sess.state
    const base = {
      phase: st.phase,
      qIndex: st.qIndex,
      round: st.round,
      qCount: st.pack?.questions.length ?? 0,
      packTitle: st.pack?.title,
      multiplier: st.multiplier,
    }
    if (st.phase === 'pickPack') return { ...base, packs: st.packs, ...(st.programme && { programme: st.programme }) }
    if (st.phase === 'getReady') return { ...base, deadline: st.deadline }
    // L'estimation en direct attend sa cible : la console la demande.
    if (st.phase === 'cible' && st.pack) {
      const q = st.pack.questions[st.qIndex]
      return {
        ...base,
        kind: q.kind,
        text: q.text,
        unit: q.kind === 'number' ? q.unit : undefined,
        enDirect: true,
        ...(q.note && { note: q.note }),
        answeredCount: Object.keys(st.responses).length,
        participantCount: sess.participantIds.length,
      }
    }
    if (st.phase === 'intertitre' && st.pack) {
      const q = st.pack.questions[st.qIndex]
      return {
        ...base,
        intertitre: q.intertitre,
        ...(st.deadline > 0 && { deadline: st.deadline }),
        ...(q.note && { note: q.note }),
        autoNextSeconds: st.autoNextSeconds,
      }
    }
    if (st.phase === 'observe' && st.pack) {
      const q = st.pack.questions[st.qIndex]
      return {
        ...base,
        // La note suit l'animateur dès la photo : il la lit pendant qu'on observe.
        ...(q.note && { note: q.note }),
        image: q.image,
        deadline: st.deadline,
        duration: q.observeSeconds ?? 0,
        participantCount: sess.participantIds.length,
        // Sans lui, la console affichait « au clic » pendant la photo alors
        // que l'enchaînement était réglé — et un clic sur « au clic », qui se
        // croyait déjà actif, n'envoyait rien.
        autoNextSeconds: st.autoNextSeconds,
      }
    }
    if ((st.phase === 'question' || st.phase === 'reveal') && st.pack) {
      const q = st.pack.questions[st.qIndex]
      const view: QuizHostView = {
        ...base,
        kind: q.kind,
        text: q.text,
        answers: reponsesMontrees(sess, q, vctx),
        ...(q.kind === 'choice' && q.variante && { variante: q.variante }),
        ...(q.kind === 'number' && q.enDirect && { enDirect: true }),
        // Le blind test : l'écran commun joue l'extrait pendant la question.
        ...(q.son && st.phase === 'question' && { son: q.son }),
        unit: q.kind === 'number' ? q.unit : undefined,
        category: q.category ?? undefined,
        image: hiddenPhoto(q, st.phase) ? null : q.image,
        photoGone: hiddenPhoto(q, st.phase) || undefined,
        deadline: st.deadline,
        duration: q.duration,
        ...(q.note && { note: q.note }),
        ...(st.pausedMs !== null && { paused: true, remainingMs: st.pausedMs }),
        autoNextSeconds: st.autoNextSeconds,
        ...(st.autoNextAt !== null && { autoNextAt: st.autoNextAt }),
        ...(st.phase === 'reveal' && st.autoNextSuspendu && { autoNextSuspendu: true }),
        answeredCount: Object.keys(st.responses).length,
        participantCount: sess.participantIds.length,
      }
      // Qui n'a pas répondu : à la console seulement. `playerView` n'en dit
      // rien — la salle n'a pas à savoir qui traîne (invariant 1).
      if (st.phase === 'question') {
        const { liste, enPlus } = attendus(sess, vctx)
        view.attendus = liste
        if (enPlus > 0) view.attendusEnPlus = enPlus
      }
      if (st.phase === 'reveal') {
        if (q.kind === 'choice') {
          view.correct = q.correct
          view.counts = compteParReponse(sess, q)
          if (q.variante === 'plusieurs') view.bonnes = q.bonnes
          if (q.variante === 'ordre') view.ordre = q.ordre
          if (q.variante === 'sondage') view.votes = votesDuSondage(sess, vctx, 8)
          let fastest: { name: string; ms: number } | null = null
          for (const [playerId, r] of Object.entries(st.responses)) {
            if (reponseJuste(q, r) && (!fastest || r.ms < fastest.ms)) {
              fastest = { name: vctx.playerName(playerId), ms: r.ms }
            }
          }
          view.fastest = fastest
        } else if (!cibleInconnue(st, q)) {
          view.target = q.target
          view.guesses = guessRows(sess, q.target, vctx, 8)
        }
        if (st.cancelled) view.cancelled = true
        if (q.anecdote) view.anecdote = q.anecdote
        if (q.imageRevelation) view.imageRevelation = q.imageRevelation
        view.standings = standings(sess, vctx, 5)
      }
      return view
    }
    // finished
    return { ...base, standings: standings(sess, vctx) }
  },
}
