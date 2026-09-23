import type { GameContext, GameModule, GameSessionRec, ViewContext } from '../core/types'
import { playableQuestions, type PlayableQuestion, type QuizDef } from '../../../shared/library'
import { distinctions } from '../../../shared/profil'
import { nomAffiche } from '../../../shared/homonymes'
import { classer, rangPartage, type Classe } from '../../../shared/classement'
import type {
  QuizAction,
  QuizCommand,
  QuizGuessRow,
  QuizHostView,
  QuizPackInfo,
  QuizPlayerView,
  QuizPodiumRow,
  Visee,
} from '../../../shared/games/quiz'

interface QuizPack {
  id: string
  title: string
  questions: PlayableQuestion[]
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
}

interface QuizState {
  phase: 'pickPack' | 'getReady' | 'observe' | 'question' | 'reveal' | 'finished'
  packs: QuizPackInfo[]
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
}

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

// QCM : bonne réponse + bonus de rapidité.
const CHOICE_POINTS = 100
const SPEED_BONUS = 100

// Estimation : on récompense d'abord la participation, puis la proximité
// relative au groupe (une erreur de 3 ans sur une date n'a pas le même sens
// qu'une erreur de 3 km sur une distance — seul le classement du groupe le dit).
const GUESS_POINTS = 30
const PROXIMITY_POINTS = 120
const CLOSEST_BONUS = 50

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
      .map(q => ({ id: q.id, title: q.title, questions: playableQuestions(q) }))
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
}

/**
 * Le quiz d'une partie, tel qu'il a été joué, relu dans l'état persisté de la
 * partie. Le bilan s'en sert pour retrouver les intitulés exacts : la
 * bibliothèque a pu être retouchée depuis, pas cette copie.
 */
export function playedPackOf(state: unknown): { title: string; questions: PlayableQuestion[] } | null {
  const pack = (state as Partial<QuizState> | null)?.pack
  if (!pack || typeof pack.title !== 'string' || !Array.isArray(pack.questions)) return null
  return { title: pack.title, questions: pack.questions }
}

// ── Déroulé ──────────────────────────────────────────────────────────────

/**
 * Photo « mémoire » : on la projette seule avant la question. Sans cette
 * phase, la question et les réponses seraient à l'écran en même temps que la
 * photo, et il suffirait de répondre vite en la regardant.
 */
function startQuestion(sess: GameSessionRec<QuizState>, index: number, ctx: GameContext) {
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
  // Une question reposée hérite sinon du souffle armé par la précédente, qui
  // la révélerait avant que personne ait eu le temps de répondre.
  ctx.clearTimer('settle')
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

function reveal(sess: GameSessionRec<QuizState>, ctx: GameContext) {
  const st = sess.state
  ctx.clearTimer('question')
  ctx.clearTimer('observe')
  ctx.clearTimer('settle')
  st.phase = 'reveal'
  st.lastAwards = {}
  // L'enchaînement s'arme quelle que soit la cause de la révélation : fin du
  // chronomètre, dernière réponse, ou clic de l'animateur.
  if (st.autoNextSeconds !== null) {
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
    for (const [playerId, r] of Object.entries(st.responses)) {
      if (r.choice !== q.correct) {
        award(sess, playerId, 0, ctx)
        continue
      }
      // 100 pts + bonus de rapidité (linéaire sur le temps restant)
      const remaining = Math.max(0, q.duration * 1000 - r.ms)
      award(sess, playerId, CHOICE_POINTS + Math.round((SPEED_BONUS * remaining) / (q.duration * 1000)), ctx)
    }
    return
  }

  const guesses = Object.entries(st.responses)
    .filter(([, r]) => r.value !== null)
    .map(([playerId, r]) => ({ playerId, error: Math.abs(r.value! - q.target) }))
  if (guesses.length === 0) return

  // La proximité se juge au rang dans le groupe, pas à la distance. Une
  // échelle linéaire entre le plus proche et le plus loin avait un défaut
  // fatal : une seule proposition absurde — « 19940 » pour 1994, faute de
  // frappe ou provocation — repoussait le maximum si loin que toute la salle
  // touchait le plein de points, et la question ne classait plus personne.
  // Avec le rang, l'écart des autres ne change rien à vos points.
  //
  // Le rang se partage à égalité d'écart (`shared/classement.ts`) : deux
  // « 1994 » exacts sont premiers tous les deux, et touchent autant, bonus du
  // plus proche compris. La rapidité les départageait : pour une seconde de
  // retard sur une réponse identique, le second perdait le bonus et une part
  // de la proximité — cent dix points à trois joueurs, plus de cinquante à
  // soixante.
  const ecarts = guesses.map(g => -g.error)
  const last = guesses.length - 1
  for (const g of guesses) {
    const rang = rangPartage(-g.error, ecarts)
    // Seul à répondre : tout le monde est « le plus proche », personne n'est pénalisé.
    const ratio = last === 0 ? 1 : (last - (rang - 1)) / last
    const points = GUESS_POINTS + Math.round(PROXIMITY_POINTS * ratio) + (rang === 1 ? CLOSEST_BONUS : 0)
    award(sess, g.playerId, points, ctx)
  }
}

/**
 * Combien de participants la question en cours attend encore : ceux qui
 * pouvaient y répondre et ne l'ont pas fait. Un retardataire arrivé après
 * qu'elle a été posée n'est pas attendu — c'est le même filtre que le journal,
 * sinon la salle patienterait pour quelqu'un qui n'a jamais vu la question.
 *
 * Un téléphone en veille reste attendu, lui : l'exclure reviendrait à révéler
 * dans le dos de quelqu'un dont le réseau a hoqueté une seconde.
 */
function awaited(sess: GameSessionRec<QuizState>): number {
  const st = sess.state
  return sess.participantIds.filter(id => (st.playFrom[id] ?? 0) <= st.qIndex && !(id in st.responses))
    .length
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

/** Le rang de chacun, pour la vue de chaque téléphone. */
function rangs(sess: GameSessionRec<QuizState>, vctx: ViewContext): Map<string, number> {
  return vctx.memo('quiz:rangs', () => new Map(classement(sess, vctx).map(c => [c.item.playerId, c.rang])))
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

/** Les propositions d'une question « estimation », de la plus proche à la plus loin. */
function guessRows(sess: GameSessionRec<QuizState>, target: number, vctx: ViewContext, limit: number): QuizGuessRow[] {
  const st = sess.state
  return Object.entries(st.responses)
    .filter(([, r]) => r.value !== null)
    .map(([playerId, r]) => ({ playerId, r, error: Math.abs(r.value! - target) }))
    .sort((a, b) => a.error - b.error || a.r.ms - b.r.ms)
    // Même raison que pour le classement : on ne décore que les lignes montrées.
    .slice(0, limit)
    .map(({ playerId, r }) => {
      const p = vctx.player(playerId)
      return {
        name: p ? nomAffiche(p) : vctx.playerName(playerId),
        avatar: p?.avatar ?? '🎉',
        value: r.value!,
        points: st.lastAwards[playerId] ?? 0,
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

  ctx.logAnswers(
    sess.participantIds
      .filter(playerId => (st.playFrom[playerId] ?? 0) <= st.qIndex)
      .map(playerId => {
        const r = st.responses[playerId]
        const answered = !!r && (r.choice !== null || r.value !== null)
        return {
          quizTitle: st.pack!.title,
          qIndex: st.qIndex,
          kind: q.kind,
          playerId,
          answered,
          correct: q.kind === 'choice' && answered ? r!.choice === q.correct : null,
          choice: r?.choice ?? null,
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
  createInitialState(spaceId): QuizState {
    const library = quizLibrary(spaceId)
    if (library.length === 0) {
      throw new Error('Aucun quiz prêt à jouer — créez-en un dans l’espace animateur (/edit)')
    }
    return {
      phase: 'pickPack',
      packs: library.map(p => ({ id: p.id, title: p.title, questionCount: p.questions.length })),
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
      autoNextSeconds: null,
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
    if (action?.type === 'answer' && q.kind === 'choice') {
      const choice = Number(action.choice)
      if (!Number.isInteger(choice) || choice < 0 || choice >= q.answers.length) return 'invalid'
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
    if (awaited(sess) === 0) ctx.setTimer('settle', SETTLE_MS)
  },

  onHostCommand(sess, command: QuizCommand, ctx) {
    const st = sess.state
    switch (command?.type) {
      case 'selectPack': {
        if (st.phase !== 'pickPack') return
        const pack = quizLibrary(sess.spaceId).find(p => p.id === command.packId)
        if (!pack) throw new Error('Quiz introuvable')
        st.pack = pack
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
        if (awaited(sess) === 0) ctx.setTimer('settle', SETTLE_MS)
        break
      }
      case 'cancel': {
        // Confirmée après que la partie a avancé — la boîte de dialogue était
        // restée ouverte —, elle retirerait les points de la question suivante.
        if (st.phase !== 'reveal' || perimee(st, command)) return
        // L'animateur reprend la main : un enchaînement programmé ne doit pas
        // emporter la question qu'il est en train de corriger.
        ctx.clearTimer('autoNext')
        st.autoNextAt = null
        cancelQuestion(sess, ctx)
        break
      }
      case 'replay': {
        if (st.phase !== 'reveal' || !st.pack || perimee(st, command)) return
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
        startQuestion(sess, st.qIndex, ctx)
        break
      }
      case 'next':
        // « Suivant » se lisait selon la phase courante : un « Révéler » parti
        // juste avant la révélation automatique arrivait après elle et passait
        // à la question suivante — la salle n'avait vu la bonne réponse que
        // quatre-vingt-seize millisecondes. Un clic qui ne vise plus le moment
        // présent est un doublon : ignoré sans un mot.
        if (perimee(st, command)) return
        if (st.phase === 'observe') {
          // « C'est bon, tout le monde a vu » : on passe à la question.
          beginAnswering(sess, ctx)
        } else if (st.phase === 'question') {
          reveal(sess, ctx) // l'animateur force la fin de la question
        } else if (st.phase === 'reveal') {
          goNext(sess, ctx)
        }
        break
      case 'autoNext': {
        const seconds = command.seconds
        st.autoNextSeconds = seconds === null ? null : Math.min(30, Math.max(2, Math.round(seconds)))
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
    }
  },

  onPlayerJoin(sess, playerId) {
    const st = sess.state
    // Arrivé pendant une question : il peut encore répondre (avec moins de
    // temps). Arrivé pendant une révélation : il démarre à la suivante.
    st.playFrom[playerId] = st.phase === 'reveal' ? st.qIndex + 1 : st.qIndex
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
    // Il était peut-être le dernier qu'on attendait : la salle a fini, on
    // révèle après le souffle, comme après une dernière réponse — pas au
    // bout du chronomètre.
    if (st.phase === 'question' && st.pausedMs === null && awaited(sess) === 0) {
      ctx.setTimer('settle', SETTLE_MS)
    }
  },

  onTimer(sess, timerId, ctx) {
    if (timerId === 'ready' && sess.state.phase === 'getReady') startQuestion(sess, 0, ctx)
    if (timerId === 'observe' && sess.state.phase === 'observe') beginAnswering(sess, ctx)
    if (timerId === 'question' && sess.state.phase === 'question') reveal(sess, ctx)
    if (timerId === 'settle' && sess.state.phase === 'question') reveal(sess, ctx)
    if (timerId === 'autoNext' && sess.state.phase === 'reveal') goNext(sess, ctx)
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
    }
    if (st.phase === 'getReady') return { ...base, deadline: st.deadline }
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
      return {
        ...base,
        kind: q.kind,
        text: q.text,
        answers: q.kind === 'choice' ? q.answers : undefined,
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
          justArrived: (st.playFrom[playerId] ?? 0) > st.qIndex,
          correct: q.kind === 'choice' ? q.correct : undefined,
          target: q.kind === 'number' ? q.target : undefined,
          yourPoints: playerId in st.lastAwards ? st.lastAwards[playerId] : null,
          ...(st.cancelled && { cancelled: true }),
          yourQuizTotal: st.totals[playerId] ?? 0,
          // Le rang ne se lit qu'entre deux questions : pendant la question,
          // aucun classement n'est calculé.
          yourQuizRank: rangs(sess, vctx).get(playerId),
        }),
      }
    }
    if (st.phase === 'finished') {
      return {
        ...base,
        yourQuizTotal: st.totals[playerId] ?? 0,
        yourQuizRank: rangs(sess, vctx).get(playerId),
        // Le même podium pour toute la salle : construit une fois par diffusion.
        podium: vctx.memo('quiz:podium', () => standings(sess, vctx, 3)),
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
    if (st.phase === 'pickPack') return { ...base, packs: st.packs }
    if (st.phase === 'getReady') return { ...base, deadline: st.deadline }
    if (st.phase === 'observe' && st.pack) {
      const q = st.pack.questions[st.qIndex]
      return {
        ...base,
        image: q.image,
        deadline: st.deadline,
        duration: q.observeSeconds ?? 0,
        participantCount: sess.participantIds.length,
      }
    }
    if ((st.phase === 'question' || st.phase === 'reveal') && st.pack) {
      const q = st.pack.questions[st.qIndex]
      const view: QuizHostView = {
        ...base,
        kind: q.kind,
        text: q.text,
        answers: q.kind === 'choice' ? q.answers : undefined,
        unit: q.kind === 'number' ? q.unit : undefined,
        category: q.category ?? undefined,
        image: hiddenPhoto(q, st.phase) ? null : q.image,
        photoGone: hiddenPhoto(q, st.phase) || undefined,
        deadline: st.deadline,
        duration: q.duration,
        ...(st.pausedMs !== null && { paused: true, remainingMs: st.pausedMs }),
        autoNextSeconds: st.autoNextSeconds,
        ...(st.autoNextAt !== null && { autoNextAt: st.autoNextAt }),
        answeredCount: Object.keys(st.responses).length,
        participantCount: sess.participantIds.length,
      }
      if (st.phase === 'reveal') {
        if (q.kind === 'choice') {
          view.correct = q.correct
          view.counts = q.answers.map(
            (_, i) => Object.values(st.responses).filter(r => r.choice === i).length,
          )
          let fastest: { name: string; ms: number } | null = null
          for (const [playerId, r] of Object.entries(st.responses)) {
            if (r.choice === q.correct && (!fastest || r.ms < fastest.ms)) {
              fastest = { name: vctx.playerName(playerId), ms: r.ms }
            }
          }
          view.fastest = fastest
        } else {
          view.target = q.target
          view.guesses = guessRows(sess, q.target, vctx, 8)
        }
        if (st.cancelled) view.cancelled = true
        view.standings = standings(sess, vctx, 5)
      }
      return view
    }
    // finished
    return { ...base, standings: standings(sess, vctx) }
  },
}
