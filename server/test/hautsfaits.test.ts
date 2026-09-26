// Les hauts faits, les paliers de carrière et les avatars légendaires.
//
// Les badges d'avant ne venaient que des prix du palmarès : on les gagnait
// sans le savoir, on ne savait pas ce qui venait ensuite, et rien ne se
// voyait. Les hauts faits se lisent à la clôture sur les journaux de la
// soirée — un exploit (éclat) ou une malchance assumée (ombre) —, les paliers
// de carrière sur les totaux de toutes les soirées, et les avatars
// légendaires se débloquent sur les uns et les autres.
//
// Tout ici est une dérivation pure : on l'appelle directement, avec les
// lignes qu'une soirée aurait écrites.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AnswerRow } from '../src/core/answers'
import type { ScoreEntry } from '../src/core/scores'
import type { PlayerRec } from '../src/core/party'
import { estCosmique, hautsFaitsDeSoiree, xpDesHautsFaits } from '../src/core/hautsfaits'
import { carriereDe, gainVide, releveVide, type ReleveSoiree } from '../../shared/profil'
import { buildProgress } from '../src/core/progress'
import {
  HAUTS_FAITS_DE_CARRIERE,
  HAUTS_FAITS_DE_SOIREE,
  PART_DES_JOUEURS,
  clePalier,
  hautFait,
  palierDe,
  paliersAtteints,
  plusBeaux,
  regleDuPalier,
  xpDe,
  XP_PALIER,
  type HautFaitDeCarriere,
} from '../../shared/hautsfaits'
import { LEGENDAIRES, legendairesDebloques, progresVers } from '../../shared/legendaires'

// ── De quoi écrire une soirée ─────────────────────────────────────────────

let horloge = 1_000
const tic = () => ++horloge

function joueur(id: string): PlayerRec {
  return { id, name: id, avatar: '🦊', token: `jeton-${id}`, teamId: null, profileId: `profil-${id}`, createdAt: tic() }
}

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

type Reponse = Partial<AnswerRow> | null
const FAUX: Reponse = { correct: false, choice: 1 }

/** Un quiz joué : une bonne réponse vaut `points` s'il est donné, 100 sinon. */
function quiz(sessionId: string, questions: number, joueurs: string[], qui: (q: number, id: string) => Reponse) {
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
      if (l.points !== 0) scores.push({ playerId: id, sessionId, points: l.points, reason: `Q${q + 1}`, createdAt: tic() })
    }
  }
  return { answers, scores }
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `j${i + 1}`)

/** Les hauts faits d'une soirée faite de ces quiz. */
function faits(joueurs: string[], ...parties: { answers: AnswerRow[]; scores: ScoreEntry[] }[]) {
  return hautsFaitsDeSoiree({
    players: joueurs.map(joueur),
    answers: parties.flatMap(p => p.answers),
    scores: parties.flatMap(p => p.scores),
  })
}

const de = (resultat: Map<string, string[]>, id: string) => resultat.get(id) ?? []

// ── 1. La salle ───────────────────────────────────────────────────────────

test('une salle de moins de quatre joueurs ne décerne aucun haut fait', () => {
  const trois = ids(3)
  const parfait = quiz('s1', 8, trois, (_, id) => (id === 'j1' ? {} : FAUX))
  assert.equal(faits(trois, parfait).size, 0, 'à trois téléphones, rien ne se fabrique')

  const quatre = ids(4)
  const memeChose = quiz('s1', 8, quatre, (_, id) => (id === 'j1' ? {} : FAUX))
  assert.ok(de(faits(quatre, memeChose), 'j1').includes('hf:grand-chelem'), 'à quatre, le Grand Chelem tombe')
})

// ── 2. Les éclats ─────────────────────────────────────────────────────────

test('Grand Chelem : toutes les questions à choix d’un quiz justes, huit au moins', () => {
  const joueurs = ids(4)
  const sept = quiz('s1', 7, joueurs, (_, id) => (id === 'j1' ? {} : FAUX))
  assert.ok(!de(faits(joueurs, sept), 'j1').includes('hf:grand-chelem'), 'sept questions ne font pas un Grand Chelem')
  const presque = quiz('s1', 8, joueurs, (q, id) => (id === 'j1' && q !== 7 ? {} : FAUX))
  assert.ok(!de(faits(joueurs, presque), 'j1').includes('hf:grand-chelem'), 'une seule erreur suffit à le manquer')
})

test('La Foudre : le plus rapide à trouver sur trois questions d’un même quiz', () => {
  const joueurs = ids(4)
  // Tout le monde trouve — être le plus rapide n'a de sens qu'à trois bonnes
  // réponses au moins —, et j1 arrive toujours le premier.
  const partie = quiz('s1', 3, joueurs, (_, id) => ({ ms: id === 'j1' ? 900 : 3_000 + Number(id.slice(1)) * 100 }))
  assert.ok(de(faits(joueurs, partie), 'j1').includes('hf:foudre'))
  assert.ok(!de(faits(joueurs, partie), 'j2').includes('hf:foudre'))
})

test('Le Phénix : gagner un quiz après avoir fini dans la moitié basse du précédent', () => {
  const joueurs = ids(4)
  // Premier quiz : j1 ne trouve rien. Second : il trouve tout, seul.
  const chute = quiz('s1', 5, joueurs, (_, id) => (id === 'j1' ? FAUX : {}))
  const envol = quiz('s2', 5, joueurs, (_, id) => (id === 'j1' ? {} : FAUX))
  assert.ok(de(faits(joueurs, chute, envol), 'j1').includes('hf:phenix'))
  // Dans l'autre ordre, ce n'est qu'une chute.
  assert.ok(!de(faits(joueurs, envol, chute), 'j1').includes('hf:phenix'))
})

test('Seul contre tous : seul à trouver, six réponses au moins', () => {
  const six = ids(6)
  const seul = quiz('s1', 1, six, (_, id) => (id === 'j1' ? {} : FAUX))
  assert.ok(de(faits(six, seul), 'j1').includes('hf:seul-contre-tous'))
  const cinq = ids(5)
  const petit = quiz('s1', 1, cinq, (_, id) => (id === 'j1' ? {} : FAUX))
  assert.ok(!de(faits(cinq, petit), 'j1').includes('hf:seul-contre-tous'), 'à cinq, être seul est moins rare')
})

test('L’Oracle : deux estimations au chiffre près dans la soirée', () => {
  const joueurs = ids(4)
  const estimer = (sessionId: string, cible: number) =>
    quiz(sessionId, 1, joueurs, (_, id) => ({
      kind: 'number',
      correct: null,
      choice: null,
      value: id === 'j1' ? cible : cible + 10 * Number(id.slice(1)),
      target: cible,
    }))
  assert.ok(de(faits(joueurs, estimer('s1', 1994), estimer('s2', 42)), 'j1').includes('hf:oracle'))
  assert.ok(!de(faits(joueurs, estimer('s1', 1994)), 'j1').includes('hf:oracle'), 'une seule, c’est de la chance')
})

test('Le Doublé, puis le Triplé : deux quiz gagnés, puis trois — l’un remplace l’autre', () => {
  const joueurs = ids(4)
  const gagne = (s: string) => quiz(s, 5, joueurs, (_, id) => (id === 'j1' ? {} : FAUX))
  assert.deepEqual(
    de(faits(joueurs, gagne('s1'), gagne('s2')), 'j1').filter(k => k === 'hf:double' || k === 'hf:triple'),
    ['hf:double'],
  )
  assert.deepEqual(
    de(faits(joueurs, gagne('s1'), gagne('s2'), gagne('s3')), 'j1').filter(k => k === 'hf:double' || k === 'hf:triple'),
    ['hf:triple'],
  )
})

test('L’Increvable : dix bonnes réponses d’affilée — une question laissée casse la série', () => {
  const joueurs = ids(4)
  const dix = quiz('s1', 10, joueurs, (_, id) => (id === 'j1' ? {} : FAUX))
  assert.ok(de(faits(joueurs, dix), 'j1').includes('hf:increvable'))
  const coupee = quiz('s1', 11, joueurs, (q, id) => (id === 'j1' ? (q === 5 ? null : {}) : FAUX))
  assert.ok(!de(faits(joueurs, coupee), 'j1').includes('hf:increvable'))
})

// ── 3. Les ombres ─────────────────────────────────────────────────────────

test('La Lanterne Rouge et le Zéro Pointé : dernier d’un quiz en ayant répondu à tout', () => {
  const joueurs = ids(4)
  const partie = quiz('s1', 5, joueurs, (q, id) => (id === 'j4' ? FAUX : q < Number(id.slice(1)) ? {} : FAUX))
  const r = faits(joueurs, partie)
  assert.ok(de(r, 'j4').includes('hf:lanterne-rouge'))
  assert.ok(de(r, 'j4').includes('hf:zero-pointe'))
  assert.ok(!de(r, 'j3').includes('hf:lanterne-rouge'))
  // Qui laisse passer une question n'a pas « tout tenté » : ni l'un ni l'autre.
  const absent = quiz('s1', 5, joueurs, (q, id) => (id === 'j4' ? (q === 2 ? null : FAUX) : {}))
  assert.deepEqual(
    de(faits(joueurs, absent), 'j4').filter(k => k === 'hf:lanterne-rouge' || k === 'hf:zero-pointe'),
    [],
  )
})

test('Le Presque : deuxième d’un quiz, à moins de vingt points du premier', () => {
  const joueurs = ids(4)
  const serre = quiz('s1', 5, joueurs, (q, id) => {
    if (q > 0) return FAUX
    if (id === 'j1') return { points: 500 }
    if (id === 'j2') return { points: 490 }
    return FAUX
  })
  assert.ok(de(faits(joueurs, serre), 'j2').includes('hf:presque'))
  const large = quiz('s1', 5, joueurs, (q, id) => {
    if (q > 0) return FAUX
    if (id === 'j1') return { points: 500 }
    if (id === 'j2') return { points: 400 }
    return FAUX
  })
  assert.ok(!de(faits(joueurs, large), 'j2').includes('hf:presque'))
})

test('L’Ascenseur Émotionnel : premier après un quiz, dans la moitié basse à la fin', () => {
  const joueurs = ids(4)
  const envol = quiz('s1', 5, joueurs, (q, id) => (id === 'j1' && q === 0 ? {} : FAUX))
  const chute = quiz('s2', 5, joueurs, (_, id) => (id === 'j1' ? FAUX : { points: 300 }))
  assert.ok(de(faits(joueurs, envol, chute), 'j1').includes('hf:ascenseur'))
})

test('Le Somnambule, le Kamikaze, la Girouette et le Contre-Courant', () => {
  // Sept joueurs : même quand j1 dort, six réponses arrivent — être seul sur
  // sa réponse ne compte qu'à six au moins.
  const sept = ids(7)
  // j1 dort cinq questions de suite ; j2 répond faux en une seconde, cinq
  // fois ; j3 change trois fois d'avis pour finir faux ; j4, trois fois seul
  // sur sa réponse, et faux.
  const partie = quiz('s1', 6, sept, (q, id) => {
    if (id === 'j1') return q < 5 ? null : {}
    if (id === 'j2') return q < 5 ? { correct: false, choice: 1, ms: 900 } : {}
    if (id === 'j3') return q === 0 ? { correct: false, choice: 1, changes: 3 } : {}
    if (id === 'j4') return q < 3 ? { correct: false, choice: 3 } : {}
    return {}
  })
  const r = faits(sept, partie)
  assert.ok(de(r, 'j1').includes('hf:somnambule'))
  assert.ok(de(r, 'j2').includes('hf:kamikaze'))
  assert.ok(de(r, 'j3').includes('hf:girouette'))
  assert.ok(de(r, 'j4').includes('hf:contre-courant'))
  assert.ok(!de(r, 'j5').some(k => ['hf:somnambule', 'hf:kamikaze', 'hf:girouette', 'hf:contre-courant'].includes(k)))
})

test('L’Estimation Cosmique : un facteur dix d’écart', () => {
  assert.equal(estCosmique(19940, 1994), true)
  assert.equal(estCosmique(199, 1994), true)
  assert.equal(estCosmique(2500, 1994), false)
  assert.equal(estCosmique(-5, 5), false, 'le mauvais signe, mais tout près')
  assert.equal(estCosmique(-50, 5), true, 'le mauvais signe, et dix fois trop loin')
  assert.equal(estCosmique(3, 0), false, 'trois pour zéro, c’est se tromper — pas d’un facteur dix')
  assert.equal(estCosmique(12, 0), true)
})

// ── 4. Ce que les hauts faits rapportent ──────────────────────────────────

test('chaque haut fait a son expérience ; une ombre rapporte peu, mais rapporte', () => {
  for (const h of HAUTS_FAITS_DE_SOIREE) {
    assert.ok(h.xp > 0, `${h.key} rapporte quelque chose`)
    if (h.ton === 'ombre') assert.ok(h.xp <= 10, `${h.key} : une ombre ne vaut pas un exploit`)
  }
  assert.equal(xpDesHautsFaits(['hf:grand-chelem', 'hf:lanterne-rouge', 'inconnu']), 45)
  assert.equal(xpDe(clePalier('hf:bavard', 2)), XP_PALIER[1])
  assert.equal(xpDe('sansfaute'), 0, 'un prix du palmarès ne rapporte pas d’expérience')
})

// ── 5. Les paliers de carrière ────────────────────────────────────────────

const soireeAvec = (releve: Partial<ReleveSoiree>, spaceId = 'espace-1') => ({
  releve: { ...releveVide(), ...releve },
  gain: { ...gainVide(), reponses: releve.reponses ?? 1 },
  spaceId,
})

test('les paliers de carrière se lisent sur les totaux de toutes les soirées', () => {
  const trois = carriereDe(
    [soireeAvec({ reponses: 40, justes: 20 }), soireeAvec({ reponses: 40, justes: 20 }), soireeAvec({ reponses: 30, justes: 15 }, 'espace-2')],
    { eclats: 0, niveau: 4 },
  )
  const atteints = paliersAtteints(trois)
  assert.ok(atteints.includes('hf:habitue:1'), 'trois soirées : L’Habitué, Bronze')
  assert.ok(!atteints.includes('hf:habitue:2'))
  assert.ok(atteints.includes('hf:bavard:1'), 'cent dix réponses : Le Bavard, Bronze')
  assert.ok(atteints.includes('hf:encyclopedie:1'), 'cinquante-cinq bonnes réponses')
  assert.ok(atteints.includes('hf:globe-trotteur:1'), 'deux hôtes différents')
  assert.ok(!atteints.some(k => k.startsWith('hf:legende')), 'le niveau 4 n’est pas une légende')
  assert.deepEqual(palierDe('hf:bavard:2')?.palier, 2)
  assert.equal(palierDe('hf:grand-chelem'), null, 'un haut fait de soirée n’a pas de palier')
})

test('une soirée jouée seul ne compte pas : le Renard Lunaire ne se gagne pas devant son téléphone', () => {
  // Une question, seul : la soirée s'inscrit dans l'historique du profil, à
  // zéro point — et dix d'entre elles faisaient L'Habitué, Argent.
  const [seul] = buildProgress({ players: [joueur('j1')], ...quiz('s1', 1, ['j1'], () => ({})) }, { cloture: true })
  assert.equal(seul.xp, 0)
  const dixSeul = carriereDe(
    Array.from({ length: 10 }, () => ({ releve: seul.releve, gain: seul.gain, spaceId: 'espace-1' })),
    { eclats: 0, niveau: 1 },
  )
  assert.equal(dixSeul.soirees, 0, 'seul, on ne fait pas une soirée')
  assert.ok(!paliersAtteints(dixSeul).some(k => k.startsWith('hf:habitue')))

  // La même question à deux fait une soirée, et dix font le Renard.
  const aDeux = buildProgress({ players: [joueur('j1'), joueur('j2')], ...quiz('s1', 1, ['j1', 'j2'], () => ({})) }, { cloture: true })
  const duo = aDeux.find(g => g.playerId === 'j1')!
  const dixADeux = carriereDe(
    Array.from({ length: 10 }, () => ({ releve: duo.releve, gain: duo.gain, spaceId: 'espace-1' })),
    { eclats: 0, niveau: 1 },
  )
  assert.equal(dixADeux.soirees, 10)
  assert.ok(legendairesDebloques(new Map(paliersAtteints(dixADeux).map(k => [k, 1]))).includes('lg:renard'))
})

// ── 6. Les avatars légendaires ────────────────────────────────────────────

test('un légendaire se débloque sur ses hauts faits, et se voit venir', () => {
  const phenix = LEGENDAIRES.find(l => l.key === 'lg:phenix')!
  const licorne = LEGENDAIRES.find(l => l.key === 'lg:licorne')!
  const renard = LEGENDAIRES.find(l => l.key === 'lg:renard')!
  const recompenses = new Map([
    ['hf:phenix', 1],
    ['hf:seul-contre-tous', 2],
    ['hf:habitue:1', 1],
  ])
  assert.deepEqual(legendairesDebloques(recompenses), ['lg:phenix'])
  assert.deepEqual(progresVers(licorne, recompenses), { acquis: 2, requis: 3 }, 'deux fois Seul contre tous sur trois')
  assert.deepEqual(progresVers(renard, recompenses), { acquis: 1, requis: 2 }, 'L’Habitué au Bronze, il faut l’Argent')
  recompenses.set('hf:habitue:2', 1)
  assert.ok(legendairesDebloques(recompenses).includes('lg:renard'))
  assert.ok(legendairesDebloques(recompenses).includes(phenix.key))
})

test('chaque légendaire a sa légende, et se gagne par un haut fait qui existe', () => {
  const cles = new Set([...HAUTS_FAITS_DE_SOIREE.map(h => h.key), 'hf:habitue', 'hf:reflexe'])
  assert.equal(LEGENDAIRES.length, 12)
  for (const l of LEGENDAIRES) {
    assert.ok(l.nom && l.legende, `${l.key} a un nom et une légende`)
    assert.ok(cles.has(l.condition.hautFait), `${l.key} se gagne par ${l.condition.hautFait}, qui existe`)
  }
  // Les ombres ont leurs légendaires aussi : la malchance assumée a son trophée.
  assert.ok(LEGENDAIRES.some(l => l.ton === 'ombre'))
})

// ── 7. Les plus beaux ─────────────────────────────────────────────────────

test('chaque haut fait a sa rareté mesurée, et un palier plus haut n’est jamais plus courant', () => {
  const cles = [
    ...HAUTS_FAITS_DE_SOIREE.map(h => h.key),
    ...HAUTS_FAITS_DE_CARRIERE.flatMap(h => [1, 2, 3].map(p => clePalier(h.key, p))),
  ]
  // Un haut fait de plus sans sa part passerait pour le plus courant de tous :
  // jamais sur la carte, même décroché une fois dans une vie.
  assert.deepEqual(Object.keys(PART_DES_JOUEURS).sort(), [...cles].sort())
  for (const cle of cles) assert.ok(PART_DES_JOUEURS[cle] >= 0 && PART_DES_JOUEURS[cle] <= 1, cle)
  for (const h of HAUTS_FAITS_DE_CARRIERE) {
    const [bronze, argent, or] = [1, 2, 3].map(p => PART_DES_JOUEURS[clePalier(h.key, p)])
    assert.ok(bronze >= argent && argent >= or, `${h.key} : l’or est plus rare que l’argent, l’argent que le bronze`)
  }
})

test('ses plus beaux hauts faits : les plus rares à décrocher, un palier par haut fait, sans les coups du sort ni les prix', () => {
  const b = (key: string, fois = 1, dernier = 0) => ({ key, fois, dernier })
  const etagere = [
    b('eclair', 6), // un prix du palmarès, six fois : il tombe à chaque soirée
    b('hf:foudre', 11),
    b('hf:oracle', 2),
    b('hf:zero-pointe'), // une ombre, et la plus rare de toutes
    b('hf:bavard:1'),
    b('hf:bavard:2'),
    b('hf:increvable', 2),
    b('hf:grand-chelem'),
  ]
  assert.deepEqual(
    plusBeaux(etagere, 3).map(x => x.key),
    ['hf:grand-chelem', 'hf:increvable', 'hf:bavard:2'],
    'le Grand Chelem d’abord, que peu décrochent ; Le Bavard une fois, à son plus haut palier',
  )
  assert.deepEqual(plusBeaux(etagere, 10).map(x => x.key), ['hf:grand-chelem', 'hf:increvable', 'hf:bavard:2', 'hf:oracle', 'hf:foudre'])
  assert.deepEqual(plusBeaux([b('eclair', 6), b('hf:lanterne-rouge', 3)], 3), [], 'rien de beau à montrer : rien')
  // L'expérience le disait mal : L'Oracle paie 50, le Grand Chelem 40.
  assert.ok(xpDe('hf:oracle') > xpDe('hf:grand-chelem'))
  assert.ok(PART_DES_JOUEURS['hf:oracle'] > PART_DES_JOUEURS['hf:grand-chelem'])
})

test('un palier se dit par ce qu’il demande — et La Légende par son niveau', () => {
  const carriere = (key: string) => hautFait(key) as HautFaitDeCarriere
  assert.equal(regleDuPalier(carriere('hf:bavard'), 3), '2000 réponses envoyées')
  assert.equal(regleDuPalier(carriere('hf:eclats'), 1), '1 avatar éclaté')
  assert.equal(regleDuPalier(carriere('hf:legende'), 2), 'Niveau 20')
})
