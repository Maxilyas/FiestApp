// Le barème de l'expérience : ce qu'une soirée rapporte à un profil.
//
// Il récompensait la présence. Cinquante points pour être venu, autant pour
// une question que pour trente ; un quiz d'une question à deux téléphones
// valait une victoire entière, qu'on pouvait rejouer à volonté ; et le podium
// de la soirée, recalculé à chaque quiz, pouvait reprendre en silence ce
// qu'il avait donné. Le barème récompense maintenant le mérite, et chacun de
// ses seuils est là pour fermer une porte qu'on avait trouvée ouverte.
//
// Tout ici est une dérivation pure des journaux (`progress.ts`) : on
// l'appelle directement, avec les lignes qu'une soirée aurait écrites.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AnswerRow } from '../src/core/answers'
import type { ScoreEntry } from '../src/core/scores'
import type { PlayerRec } from '../src/core/party'
import { buildProgress, type SoireeGain } from '../src/core/progress'
import { SEUILS, XP, niveauPour, xpDuNiveau } from '../../shared/profil'

// ── De quoi écrire une soirée ─────────────────────────────────────────────

let horloge = 1_000
/** Chaque ligne arrive après la précédente : l'ordre du journal compte. */
const tic = () => ++horloge

/** Un invité, avec un profil sauf mention contraire. */
function joueur(id: string, profileId: string | null = `profil-${id}`): PlayerRec {
  return { id, name: id, avatar: '🦊', token: `jeton-${id}`, teamId: null, profileId, createdAt: tic() }
}

/** Une ligne du journal : par défaut, une bonne réponse à un QCM en 5 s. */
function ligne(playerId: string, extra: Partial<AnswerRow> = {}): AnswerRow {
  return {
    sessionId: 's1',
    quizTitle: 'Quiz',
    qIndex: 0,
    kind: 'choice',
    playerId,
    answered: true,
    correct: true,
    choice: 0,
    value: null,
    target: null,
    ms: 5_000,
    changes: 0,
    points: 0,
    durationMs: 20_000,
    observed: false,
    createdAt: tic(),
    ...extra,
  }
}

/** Qui répond quoi à une question ; `null` : il laisse passer. */
type Reponse = Partial<AnswerRow> | null

/**
 * Un quiz joué : les lignes de chaque question, et les gains qu'elles ont
 * rapportés. Une bonne réponse vaut `points` s'il est donné, 100 sinon.
 */
function quiz(
  sessionId: string,
  questions: number,
  joueurs: string[],
  qui: (q: number, id: string) => Reponse,
): { answers: AnswerRow[]; scores: ScoreEntry[] } {
  const answers: AnswerRow[] = []
  const scores: ScoreEntry[] = []
  for (let q = 0; q < questions; q++) {
    for (const id of joueurs) {
      const r = qui(q, id)
      const l =
        r === null
          ? ligne(id, { sessionId, qIndex: q, answered: false, correct: null, choice: null, ms: null })
          : ligne(id, { sessionId, qIndex: q, ...r })
      if (l.answered && l.correct === true && l.points === 0) l.points = 100
      answers.push(l)
      if (l.points > 0) scores.push({ playerId: id, sessionId, points: l.points, reason: `Q${q + 1}`, createdAt: tic() })
    }
  }
  return { answers, scores }
}

/** Plusieurs quiz, bout à bout. */
function soiree(...parties: { answers: AnswerRow[]; scores: ScoreEntry[] }[]) {
  return { answers: parties.flatMap(p => p.answers), scores: parties.flatMap(p => p.scores) }
}

const FAUX: Reponse = { correct: false, choice: 1 }

/** Le gain d'un invité, ou undefined s'il n'en a pas. */
const de = (gains: SoireeGain[], id: string) => gains.find(g => g.playerId === id)

const ids = (n: number, prefixe = 'j') => Array.from({ length: n }, (_, i) => `${prefixe}${i + 1}`)

// ── 1. La question ────────────────────────────────────────────────────────

test('une question posée à un seul joueur ne rapporte rien — mais elle compte au relevé', () => {
  const players = [joueur('alice')]
  const { answers, scores } = quiz('s1', 1, ['alice'], () => ({}))
  const alice = de(buildProgress({ players, scores, answers }), 'alice')!
  assert.equal(alice.xp, 0, 'seul devant son téléphone, on ne fabrique pas d’expérience')
  assert.equal(alice.releve.reponses, 1, 'la réponse reste dans ses chiffres de carrière')
  assert.equal(alice.releve.justes, 1)
})

test('dès deux joueurs, une question rapporte : un duel est une vraie partie', () => {
  const players = [joueur('alice'), joueur('bob')]
  const { answers, scores } = quiz('s1', 1, ['alice', 'bob'], (_, id) => (id === 'alice' ? {} : FAUX))
  const gains = buildProgress({ players, scores, answers })
  assert.equal(de(gains, 'alice')!.xp, XP.reponse + XP.juste)
  assert.equal(de(gains, 'bob')!.xp, XP.reponse)
})

test('posée à trois, une question rapporte la réponse, et la justesse à qui a trouvé', () => {
  const players = [joueur('alice'), joueur('bob'), joueur('chloe')]
  // Chloé laisse passer : elle compte dans la salle, sans rien gagner.
  const { answers, scores } = quiz('s1', 1, ['alice', 'bob', 'chloe'], (_, id) =>
    id === 'alice' ? {} : id === 'bob' ? FAUX : null,
  )
  const gains = buildProgress({ players, scores, answers })
  assert.equal(de(gains, 'alice')!.xp, XP.reponse + XP.juste)
  assert.equal(de(gains, 'bob')!.xp, XP.reponse, 'répondre faux rapporte la réponse, pas la justesse')
  assert.equal(de(gains, 'chloe')!.xp, 0, 'laisser passer ne rapporte rien')
})

test('le réflexe va au tiers le plus rapide des bonnes réponses, ex æquo compris', () => {
  const joueurs = ids(6)
  const players = joueurs.map(id => joueur(id))
  // Six bonnes réponses : le tiers en fait deux. j3 arrive au même instant
  // que j2 : une égalité ne se tranche pas au hasard.
  const temps: Record<string, number> = { j1: 1_000, j2: 2_000, j3: 2_000, j4: 3_000, j5: 4_000, j6: 5_000 }
  const { answers, scores } = quiz('s1', 1, joueurs, (_, id) => ({ ms: temps[id] }))
  const gains = buildProgress({ players, scores, answers })
  const reflexes = joueurs.filter(id => de(gains, id)!.gain.reflexe > 0)
  assert.deepEqual(reflexes, ['j1', 'j2', 'j3'])
  assert.equal(de(gains, 'j1')!.gain.reflexe, XP.reflexe)
  assert.equal(de(gains, 'j1')!.releve.reflexes, 1)
})

test('à deux bonnes réponses, le plus rapide a son réflexe ; seul à trouver, personne', () => {
  const joueurs = ids(5)
  const players = joueurs.map(id => joueur(id))
  const deux = quiz('s1', 1, joueurs, (_, id) => (id === 'j1' || id === 'j2' ? { ms: id === 'j1' ? 800 : 900 } : FAUX))
  const gains = buildProgress({ players, ...deux })
  assert.equal(de(gains, 'j1')!.gain.reflexe, XP.reflexe, 'un duel se joue aussi à la vitesse')
  assert.equal(de(gains, 'j2')!.gain.reflexe, 0)

  // Une seule bonne réponse : être le plus rapide de un ne veut rien dire.
  const une = quiz('s1', 1, joueurs, (_, id) => (id === 'j1' ? { ms: 800 } : FAUX))
  assert.ok(buildProgress({ players, ...une }).every(g => g.gain.reflexe === 0))
})

// ── 2. Le quiz ────────────────────────────────────────────────────────────

/** Un quiz où j1 fait mieux que j2, qui fait mieux que j3, etc. */
const classement = (sessionId: string, questions: number, joueurs: string[]) =>
  quiz(sessionId, questions, joueurs, (q, id) => {
    // j1 trouve tout, j2 tout sauf la première, j3 tout sauf les deux premières…
    const rang = joueurs.indexOf(id)
    return q >= rang ? {} : FAUX
  })

test('un quiz n’a de podium qu’à partir de cinq questions et deux joueurs', () => {
  const quatre = ids(4)
  const players = quatre.map(id => joueur(id))

  const court = classement('s1', SEUILS.questionsQuiz - 1, quatre)
  assert.ok(buildProgress({ players, ...court }).every(g => g.gain.quiz === 0), 'quatre questions : pas de podium')

  const seul = classement('s1', SEUILS.questionsQuiz, ['j1'])
  assert.ok(buildProgress({ players: [joueur('j1')], ...seul }).every(g => g.gain.quiz === 0), 'seul : pas de podium')

  const vrai = classement('s1', SEUILS.questionsQuiz, quatre)
  const gains = buildProgress({ players, ...vrai })
  assert.deepEqual(
    quatre.map(id => de(gains, id)!.gain.quiz),
    // Le premier a tout juste : le sans-faute s'ajoute à sa victoire.
    [XP.podiumQuiz[0] + XP.sansFaute, XP.podiumQuiz[1], XP.podiumQuiz[2], 0],
  )
  assert.equal(de(gains, 'j1')!.releve.quizGagnes, 1)
  assert.equal(de(gains, 'j3')!.releve.podiumsQuiz, 1)
  assert.equal(de(gains, 'j4')!.releve.podiumsQuiz, 0)
})

test('le podium d’un quiz a une marche de moins que la salle : le dernier n’y monte jamais', () => {
  const podium = (n: number) => {
    const joueurs = ids(n)
    const gains = buildProgress({ players: joueurs.map(id => joueur(id)), ...classement('s1', 5, joueurs) })
    return joueurs.map(id => de(gains, id)!.gain.quiz - (id === 'j1' ? XP.sansFaute : 0))
  }
  // À deux, le second aurait gagné quinze points à perdre le duel.
  assert.deepEqual(podium(2), [XP.podiumQuiz[0], 0])
  assert.deepEqual(podium(3), [XP.podiumQuiz[0], XP.podiumQuiz[1], 0])
  assert.deepEqual(podium(4), [...XP.podiumQuiz, 0])

  // Deux premiers ex æquo d'un duel gagnent tous les deux : ils sont premiers.
  const egalite = quiz('s1', 5, ['j1', 'j2'], () => ({}))
  const gains = buildProgress({ players: [joueur('j1'), joueur('j2')], ...egalite })
  assert.deepEqual(['j1', 'j2'].map(id => de(gains, id)!.gain.quiz), [XP.podiumQuiz[0] + XP.sansFaute, XP.podiumQuiz[0] + XP.sansFaute])
})

test('deux premiers ex æquo d’un quiz touchent chacun la première place', () => {
  const joueurs = ids(4)
  const players = joueurs.map(id => joueur(id))
  const { answers, scores } = quiz('s1', 5, joueurs, (q, id) => {
    if (id === 'j1') return q === 0 ? {} : FAUX
    if (id === 'j2') return q === 1 ? {} : FAUX
    return FAUX
  })
  const gains = buildProgress({ players, scores, answers })
  assert.equal(de(gains, 'j1')!.gain.quiz, XP.podiumQuiz[0])
  assert.equal(de(gains, 'j2')!.gain.quiz, XP.podiumQuiz[0])
  assert.equal(de(gains, 'j3')!.gain.quiz, 0, 'personne n’est troisième derrière deux premiers : le rang suivant est 3, sans points')
})

test('le sans-faute demande cinq questions à choix, toutes justes', () => {
  const joueurs = ids(4)
  const players = joueurs.map(id => joueur(id))
  // j1 ne rate rien, j2 laisse passer la dernière : une question laissée
  // n'est pas une question juste.
  const { answers, scores } = quiz('s1', 5, joueurs, (q, id) => {
    if (id === 'j1') return {}
    if (id === 'j2') return q === 4 ? null : {}
    return FAUX
  })
  const gains = buildProgress({ players, scores, answers })
  assert.equal(de(gains, 'j1')!.gain.quiz, XP.podiumQuiz[0] + XP.sansFaute)
  assert.equal(de(gains, 'j2')!.gain.quiz, XP.podiumQuiz[1])
})

// ── 3. Les estimations ────────────────────────────────────────────────────

test('deux estimations exactes valent pareil, quelle que soit la seconde où elles sont arrivées', () => {
  const joueurs = ids(4)
  const players = joueurs.map(id => joueur(id))
  const valeurs: Record<string, number> = { j1: 1994, j2: 1994, j3: 2000, j4: 1800 }
  const { answers, scores } = quiz('s1', 1, joueurs, (_, id) => ({
    kind: 'number',
    correct: null,
    choice: null,
    value: valeurs[id],
    target: 1994,
    ms: id === 'j1' ? 1_000 : 9_000,
  }))
  const gains = buildProgress({ players, scores, answers })
  assert.equal(de(gains, 'j1')!.gain.estimation, XP.estimationMeilleure)
  assert.equal(de(gains, 'j2')!.gain.estimation, XP.estimationMeilleure, 'le second « 1994 » est premier aussi')
  assert.equal(de(gains, 'j3')!.gain.estimation, 0, 'troisième sur quatre : hors du tiers le plus proche')
  assert.equal(de(gains, 'j1')!.releve.estimationsExactes, 1)
})

// ── 4. La soirée ──────────────────────────────────────────────────────────

/** Une vraie soirée : trois quiz de cinq questions, six joueurs. j1 mène, j6 laisse tout passer. */
function vraieSoiree() {
  const joueurs = ids(6)
  const players = joueurs.map(id => joueur(id))
  const parties = ['s1', 's2', 's3'].map(s => classement(s, 5, joueurs))
  // j6 répond faux à tout : il est de la salle, sans jamais marquer.
  for (const p of parties) for (const l of p.answers) if (l.playerId === 'j6') Object.assign(l, { answered: true, correct: false, choice: 1, ms: 5_000 })
  return { players, joueurs, ...soiree(...parties) }
}

test('le podium de la soirée et l’assiduité ne se décident qu’à la clôture', () => {
  const { players, answers, scores } = vraieSoiree()
  assert.ok(answers.length / players.length >= SEUILS.questionsSoiree, 'quinze questions')

  const enCours = buildProgress({ players, scores, answers })
  assert.ok(enCours.every(g => g.gain.soiree === 0), 'rien avant la clôture : le podium de la soirée n’est pas encore joué')

  const close = buildProgress({ players, scores, answers }, { cloture: true })
  assert.equal(de(close, 'j1')!.gain.soiree, XP.podiumSoiree[0] + XP.assiduite)
  assert.equal(de(close, 'j2')!.gain.soiree, XP.podiumSoiree[1] + XP.assiduite)
  assert.equal(de(close, 'j3')!.gain.soiree, XP.podiumSoiree[2] + XP.assiduite)
  assert.equal(de(close, 'j4')!.gain.soiree, XP.assiduite, 'hors du podium, l’assiduité reste')
})

test('une soirée trop courte, ou jouée seul, n’a ni podium ni assiduité', () => {
  const six = ids(6)
  const players = six.map(id => joueur(id))
  const courte = soiree(classement('s1', 5, six), classement('s2', 5, six))
  const gains = buildProgress({ players, ...courte }, { cloture: true })
  assert.ok(gains.every(g => g.gain.soiree === 0), 'dix questions ne font pas une soirée')

  const seul = soiree(...['s1', 's2', 's3'].map(s => classement(s, 5, ['j1'])))
  const solitaire = buildProgress({ players: [joueur('j1')], ...seul }, { cloture: true })
  assert.ok(solitaire.every(g => g.gain.soiree === 0), 'seul, on ne fait pas une soirée')
})

test('à deux, la soirée a son podium — une seule marche — et son assiduité', () => {
  const deux = ids(2)
  const tete = soiree(...['s1', 's2', 's3'].map(s => classement(s, 5, deux)))
  const gains = buildProgress({ players: deux.map(id => joueur(id)), ...tete }, { cloture: true })
  assert.equal(de(gains, 'j1')!.gain.soiree, XP.podiumSoiree[0] + XP.assiduite)
  assert.equal(de(gains, 'j2')!.gain.soiree, XP.assiduite, 'le second d’un tête-à-tête n’est pas sur le podium')
})

test('l’expérience ne redescend jamais d’un quiz à l’autre, même quand le classement se renverse', () => {
  const joueurs = ids(4)
  const players = joueurs.map(id => joueur(id))
  // j1 gagne le premier quiz, j4 les deux suivants et prend la tête.
  const ordres = [joueurs, [...joueurs].reverse(), [...joueurs].reverse()]
  const parties = ordres.map((ordre, k) =>
    quiz(`s${k + 1}`, 5, joueurs, (q, id) => (q >= ordre.indexOf(id) ? {} : FAUX)),
  )
  const avant = new Map<string, number>()
  for (let k = 1; k <= parties.length; k++) {
    const jusquIci = soiree(...parties.slice(0, k))
    for (const g of buildProgress({ players, ...jusquIci })) {
      assert.ok(g.xp >= (avant.get(g.playerId) ?? 0), `${g.playerId} perd de l’expérience après le quiz ${k}`)
      avant.set(g.playerId, g.xp)
    }
  }
  // Et la clôture n'ajoute que ce qu'elle décide.
  const tout = soiree(...parties)
  for (const g of buildProgress({ players, ...tout }, { cloture: true })) {
    assert.ok(g.xp >= (avant.get(g.playerId) ?? 0), `${g.playerId} perd de l’expérience à la clôture`)
  }
})

test('un invité anonyme ne gagne rien, et garde sa place dans la salle', () => {
  const joueurs = ids(4)
  const players = [joueur('j1'), joueur('j2'), joueur('j3', null), joueur('j4')]
  const partie = classement('s1', 5, joueurs)
  const gains = buildProgress({ players, ...partie })
  assert.equal(de(gains, 'j3'), undefined, 'sans profil, rien à créditer')
  // Troisième, il prend la dernière marche : j4 reste quatrième.
  assert.equal(de(gains, 'j2')!.gain.quiz, XP.podiumQuiz[1])
  assert.equal(de(gains, 'j4')!.gain.quiz, 0)
})

// ── 5. La courbe ──────────────────────────────────────────────────────────

test('la courbe se mérite : le niveau 2 le premier soir, le niveau 10 au bout d’une vraie carrière', () => {
  // Une soirée ordinaire : trente questions, toutes répondues, treize justes.
  const ordinaire = 30 * XP.reponse + 13 * XP.juste
  assert.equal(niveauPour(ordinaire), 2)
  // Le seuil du niveau 10 demande une soixantaine de ces soirées-là, sans
  // réflexe ni podium : avec eux, `calibrage.ts` compte une douzaine à une
  // trentaine de soirées selon leur longueur. À 25, il en fallait une
  // trentaine, et les vraies soirées y arrivaient en six.
  const soirees = Math.ceil(xpDuNiveau(10) / ordinaire)
  assert.ok(soirees >= 50 && soirees <= 90, `niveau 10 en ${soirees} soirées ordinaires`)
})
