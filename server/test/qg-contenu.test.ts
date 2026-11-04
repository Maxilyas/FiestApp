// Le contenu au QG (le QG 2, lot 7 — la proposition du 3 novembre 2026,
// `retours/2026-11-03/le-qg.md`) : « Questions » — toutes les questions jouées
// de la campagne et du quiz du jour au même endroit, chacune avec ce que ses
// réponses disent d'elle — et « Réserves et base » — la réserve du quiz du
// jour, la base de la campagne catégorie par marche, le contenu du Cabinet.
//
// Les dérivations d'abord, pures (`shared/qgContenu.ts`) : la marche et ce
// que les réponses contredisent viennent de la campagne, jamais recalculés ;
// les jours d'une question du jour se fondent par le texte de ses réponses ;
// le tri en tranches rend l'ordre d'un tri d'une traite. Puis le banc : les
// routes, ce qu'elles ne disent pas — aucune question de soirée, aucun
// prénom —, un geste du QG qui les fait relire, et ce qu'elles coûtent à la
// base : une minute gardée, les jours clos du quiz du jour lus une fois.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import {
  attendre,
  baseDEssai,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { DOSSIER_DU_CONTENU, lireLeContenu } from '../src/core/cabinet/contenu'
import { CATEGORIES } from '../../shared/categories'
import { jourAvant } from '../../shared/jour'
import { MODES_DE_SERIE, TAUX_A_PRIORI, bitDuMode, forceDuDesaccord, marcheContredite, type MesureDUneQuestion, type Niveau } from '../../shared/campagne'
import type { VersionDeLaReserve } from '../../shared/qgSignalements'
import { dUneTraite, type CalculEnTranches } from '../../shared/tranches'
import {
  CONTENU_GARDE_MS,
  JOURS_DES_APPORTS,
  JOURS_DES_QUESTIONS_DU_JOUR,
  MOT_CHERCHE_MAX,
  QUESTIONS_PAR_PAGE,
  carteDeLaBaseEnTranches,
  cherchableDe,
  contenuDuCabinetAuQg,
  lireLeFiltre,
  modesDeLaQuestion,
  partDeBonnes,
  questionDeLaCampagneAuQg,
  questionsDeLaCampagneEnTranches,
  questionsDuJourAuQg,
  questionsRetenues,
  questionsRetenuesEnTranches,
  totauxDesQuestions,
  trierEnTranches,
  unePage,
  type FiltreDesQuestions,
  type LectureDesQuestionsDeLaCampagne,
  type PageDesQuestions,
  type PageDesReserves,
  type QuestionAuQg,
  type QuestionDeLaBaseLue,
  type QuestionPoseeDuJour,
} from '../../shared/qgContenu'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
const JOUR = '2026-09-26'

/** Un calcul en tranches mené au bout : son résultat, et combien de fois il a cédé. */
function mener<T>(calcul: CalculEnTranches<T>): { valeur: T; tranches: number } {
  let tranches = 0
  for (;;) {
    const r = calcul.next()
    if (r.done) return { valeur: r.value, tranches }
    tranches++
  }
}

/** Une question au QG, ce qui compte ici précisé, le reste à zéro. */
const ligne = (x: Partial<QuestionAuQg> & Pick<QuestionAuQg, 'cle'>): QuestionAuQg => ({
  source: 'campagne',
  texte: x.cle,
  categorie: null,
  modes: ['campagne'],
  difficulte: null,
  marche: null,
  marcheMesuree: null,
  contredite: null,
  reponses: 0,
  justes: 0,
  msMoyen: null,
  signalements: 0,
  derniere: 0,
  retiree: false,
  annulee: false,
  recueil: [],
  autres: 0,
  gestes: { source: 'campagne', questionId: x.cle, version: { texte: x.cle, reponses: [], bonne: 0, anecdote: null }, sousTheme: 'x' },
  ...x,
})

const filtre = (f: Partial<FiltreDesQuestions> = {}): FiltreDesQuestions => ({ mode: null, etat: 'toutes', mot: '', tri: null, sens: 'descend', page: 0, ...f })

// ── Les dérivations ─────────────────────────────────────────────────────────

test('le filtre de l’adresse se relit : rien hors de ses listes — pas même un mode des soirées —, un mot borné, une page entière et positive', () => {
  const rien = { mode: null, etat: 'toutes', mot: '', tri: null, sens: 'descend', page: 0 }
  assert.deepEqual(lireLeFiltre({}), rien)
  assert.deepEqual(lireLeFiltre({ mode: 'soiree', etat: 'tout', tri: 'prenom', sens: 'haut', page: '-2' }), rien, 'leurs questions sont aux animateurs : aucun mode ne les lit')
  assert.deepEqual(lireLeFiltre({ mode: 'campagne', etat: 'pieges', mot: '  fleuve  ', tri: 'bonnes', sens: 'monte', page: '3' }), {
    mode: 'campagne',
    etat: 'pieges',
    mot: 'fleuve',
    tri: 'bonnes',
    sens: 'monte',
    page: 3,
  })
  assert.equal(lireLeFiltre({ page: '2.5' }).page, 0)
  assert.equal(lireLeFiltre({ mot: ['un', 'deux'] }).mot, '', 'un mot répété dans l’adresse ne se lit pas')
  assert.ok([...lireLeFiltre({ mot: '🐙'.repeat(200) }).mot].length <= MOT_CHERCHE_MAX, 'un mot trop long se coupe, sans casser un emoji')
})

test('où une question s’est jouée : un bit par mode de série, lu en modes du QG — les duels et le dé ensemble, le Cabinet à part, une révision en campagne', () => {
  assert.equal(new Set(MODES_DE_SERIE.map(bitDuMode)).size, MODES_DE_SERIE.length, 'chaque mode son bit')
  assert.equal(bitDuMode('inconnu'), bitDuMode('serie'), 'un mode hors de la liste se lit en série, comme le mode d’une ligne')
  assert.equal(bitDuMode(null), bitDuMode('serie'))
  assert.deepEqual(modesDeLaQuestion(0), [])
  assert.deepEqual(modesDeLaQuestion(bitDuMode('serie') | bitDuMode('revision') | bitDuMode('sentier') | bitDuMode('sujet') | bitDuMode('defi')), ['campagne'])
  assert.deepEqual(modesDeLaQuestion(bitDuMode('rencontre')), ['duel'])
  assert.deepEqual(modesDeLaQuestion(bitDuMode('duel') | bitDuMode('cabinet') | bitDuMode('serie')), ['campagne', 'cabinet', 'duel'], 'dans l’ordre du QG')
})

test('la force d’un désaccord est une seule mesure : celle que la campagne calculait, que le quiz du jour reprend contre l’estimation de la routine', () => {
  // La formule d'avant, recopiée : `marcheContredite` la calculait elle-même, et ses contredites se rangent toujours ainsi.
  const avant = (part: number, depart: number, total: number) => {
    const d = Math.min(0.99, Math.max(0.01, depart))
    return Math.abs(part - d) / Math.sqrt((d * (1 - d)) / total)
  }
  for (const [part, depart, total] of [
    [0.1, 0.55, 10],
    [0.9, 0.3, 40],
    [0.5, 1, 7],
    [0, 0, 5],
  ]) {
    assert.equal(forceDuDesaccord(part, depart, total), avant(part, depart, total))
  }
  assert.equal(marcheContredite(3, { justes: 1, total: 10 })!.force, avant(0.1, TAUX_A_PRIORI[3], 10))
  assert.equal(marcheContredite(3, { justes: 1, total: 10, depart: 0.3 })!.force, avant(0.1, 0.3, 10), 'partie de sa famille')
})

test('une question de la campagne au QG : sa marche de tirage, ce que la mesure contredit, ce que chaque réponse a recueilli — les leurres posés à la place des siens compris', () => {
  const q: QuestionDeLaBaseLue = {
    id: 'q1',
    texte: 'Quel fleuve traverse Lyon ?',
    reponses: ['Le Rhône', 'La Loire', 'La Seine', 'La Garonne'],
    bonne: 0,
    anecdote: 'Et la Saône.',
    meta: { categorie: 'Géographie', sousTheme: 'france', difficulte: 3 },
  }
  const lecture: LectureDesQuestionsDeLaCampagne = {
    jouables: [q],
    marche: () => 'moyen',
    // La mesure gardée, celle que les tirages lisent : une sur dix.
    mesure: new Map<string, MesureDUneQuestion>([['q1', { justes: 1, total: 10 }]]),
    jouees: new Map([['q1', { derniere: 1234, modes: bitDuMode('serie') | bitDuMode('cabinet') }]]),
    // Le journal, à jour : trois sur douze depuis.
    compte: id => (id === 'q1' ? { justes: 3, total: 12 } : undefined),
    leurres: new Map([
      [
        'q1',
        new Map([
          ['La Loire', 4],
          ['La Seine', 2],
          ['Le Doubs', 1],
        ]),
      ],
    ]),
    signalements: new Map([['q1', 2]]),
  }
  const l = questionDeLaCampagneAuQg(q, 'moyen', lecture.jouees.get('q1')!, lecture)
  assert.deepEqual(
    [l.cle, l.source, l.modes, l.categorie, l.difficulte, l.marche, l.marcheMesuree],
    ['campagne:q1', 'campagne', ['campagne', 'cabinet'], 'Géographie', 3, 'moyen', 'expert'],
  )
  const regle = marcheContredite(3, { justes: 1, total: 10 })!
  assert.deepEqual(l.contredite, { force: regle.force, difficulteProposee: regle.difficulteProposee }, 'la règle de la campagne, sur sa mesure')
  assert.deepEqual([l.reponses, l.justes, partDeBonnes(l)], [12, 3, 0.25], 'ses réponses au journal, à jour')
  assert.deepEqual(
    l.recueil.map(r => [r.texte, r.bonne, r.n]),
    [
      ['Le Rhône', true, 3],
      ['La Loire', false, 4],
      ['La Seine', false, 2],
      ['La Garonne', false, 0],
      ['Le Doubs', false, 1],
    ],
    'ses réponses dans leur ordre, puis un leurre qu’une série a posé à la place des siens',
  )
  assert.deepEqual([l.autres, l.signalements, l.derniere, l.msMoyen], [2, 2, 1234, null], 'la campagne n’a pas de chrono')
  assert.deepEqual(l.gestes, {
    source: 'campagne',
    questionId: 'q1',
    version: { texte: q.texte, reponses: [...q.reponses], bonne: 0, anecdote: 'Et la Saône.' },
    sousTheme: 'france',
  })
  // Inconnue de la mesure : ni marche mesurée, ni contradiction.
  const neuve = questionDeLaCampagneAuQg({ ...q, id: 'q9' }, 'facile', { derniere: 1, modes: bitDuMode('duel') }, lecture)
  assert.deepEqual([neuve.marcheMesuree, neuve.contredite, neuve.reponses, neuve.modes], [null, null, 0, ['duel']])

  // Toute la base, une tranche à la fois : seules celles qu'une partie a posées, chacune à sa marche de tirage.
  const marches: Niveau[] = ['facile', 'difficile', 'expert']
  const enTout = {
    ...lecture,
    jouables: [q, { ...q, id: 'q2' }, { ...q, id: 'q3' }],
    marche: (i: number) => marches[i],
    jouees: new Map([...lecture.jouees, ['q3', { derniere: 9, modes: bitDuMode('rencontre') }]]),
  }
  const { valeur, tranches } = mener(questionsDeLaCampagneEnTranches(enTout, 1))
  assert.deepEqual(
    valeur.map(x => [x.cle, x.marche, x.modes]),
    [
      ['campagne:q1', 'facile', ['campagne', 'cabinet']],
      ['campagne:q3', 'expert', ['duel']],
    ],
  )
  assert.equal(tranches, 2, 'une question par tranche, ici')
})

test('une question du jour au QG : ses jours fondus par sa place dans la réserve, ses réponses rapportées par leur texte à l’ordre de son dernier jour — celui de ses gestes', () => {
  const [A, B, C, D] = ['Le Rhône', 'La Loire', 'La Seine', 'La Garonne']
  const tiree = (reponses: string[], bonne: number) => ({ reserveId: 'r1', texte: 'Quel fleuve traverse Lyon ?', reponses, bonne, categorie: 'Géographie', anecdote: null })
  const posees: QuestionPoseeDuJour[] = [
    // Le 1er octobre, à la troisième place : A, B, C, D — une réponse arrivée trop tard.
    {
      jour: '2026-10-01',
      index: 2,
      question: tiree([A, B, C, D], 0),
      annulee: false,
      signalements: 1,
      lignes: [
        [0, 3, 30_000, 3, 100],
        [1, 1, 5_000, 1, 110],
        [null, 1, null, 0, 120],
      ],
    },
    // Reposée le 20 par une réserve à sec, en tête, mélangée autrement : C, A, D, B — et ses points annulés pour tous.
    {
      jour: '2026-10-20',
      index: 0,
      question: tiree([C, A, D, B], 1),
      annulee: true,
      signalements: 0,
      lignes: [
        [1, 2, 8_000, 2, 500],
        [0, 2, 12_000, 2, 450],
        [3, 1, 4_000, 1, 300],
      ],
    },
    // Le 15 septembre, avant une correction : une réponse qui n'est plus parmi les siennes.
    { jour: '2026-09-15', index: 4, question: tiree([A, 'La Meuse', C, D], 0), annulee: false, signalements: 0, lignes: [[1, 2, 6_000, 2, 50]] },
    // Une autre, que personne n'a encore vue ce matin.
    { jour: '2026-10-20', index: 1, question: { ...tiree([A, B], 0), reserveId: 'r2', texte: 'Pas encore vue ?' }, annulee: false, signalements: 0, lignes: [] },
  ]
  const version: VersionDeLaReserve = { texte: 'Quel fleuve traverse Lyon ?', reponses: [A, B, C, D], bonne: 0, anecdote: null, categorie: 'Géographie', sousTheme: 'france', difficulte: 2, retiree: false }
  const lignes = questionsDuJourAuQg({ aujourdhui: '2026-10-20', aujourdhuiOuvert: true, posees, reserve: new Map([['r1', version]]) })
  assert.deepEqual(
    lignes.map(l => l.cle),
    ['jour:r1'],
    'une question que personne n’a vue n’est pas jouée',
  )
  const [q] = lignes
  assert.deepEqual(
    q.recueil.map(r => [r.texte, r.bonne, r.n]),
    [
      [C, false, 2],
      [A, true, 5],
      [D, false, 0],
      [B, false, 2],
    ],
    'à l’ordre du 20 octobre',
  )
  assert.deepEqual([q.reponses, q.justes, q.autres], [12, 5, 3], 'posée douze fois : une sans réponse, deux sur une réponse corrigée depuis')
  // Le temps des seules réponses données et rapportées : 59 secondes pour neuf.
  assert.equal(q.msMoyen, Math.round(59_000 / 9))
  assert.deepEqual([q.derniere, q.signalements, q.annulee, q.modes], [500, 1, true, ['jour']], 'sa dernière réponse, les signalements de tous ses jours, annulée son dernier jour')
  // Estimée 2 par la routine : facile ; trouvée à 42 %, ses réponses la disent moyenne — à la mesure de la campagne.
  assert.deepEqual([q.difficulte, q.marche, q.marcheMesuree], [2, 'facile', 'moyen'])
  assert.deepEqual(q.contredite, { force: forceDuDesaccord(5 / 12, TAUX_A_PRIORI[2], 12), difficulteProposee: 3 })
  assert.deepEqual(q.gestes, { source: 'jour', jour: '2026-10-20', index: 0, reserveId: 'r1', copie: { reponses: [C, A, D, B], bonne: 1 }, anecdote: null, reserve: version, annulable: true })
  // Son jour clos, ses points ne s'annulent plus ; sa réserve perdue, elle n'est plus jouable et n'annonce plus de marche.
  const [close] = questionsDuJourAuQg({ aujourdhui: '2026-10-21', aujourdhuiOuvert: true, posees, reserve: new Map() })
  assert.deepEqual([close.gestes.source === 'jour' && close.gestes.annulable, close.retiree, close.marche, close.contredite, close.categorie], [false, true, null, null, 'Géographie'])
  const [nuitClose] = questionsDuJourAuQg({ aujourdhui: '2026-10-20', aujourdhuiOuvert: false, posees, reserve: new Map([['r1', version]]) })
  assert.equal(nuitClose.gestes.source === 'jour' && nuitClose.gestes.annulable, false, 'la nuit a clos son jour')
})

// Quatre questions : a et d au quiz du jour, b en campagne et au Cabinet, c en duel.
const a = ligne({ cle: 'jour:a', source: 'jour', texte: 'Quel fleuve traverse Lyon ?', categorie: 'Géographie', modes: ['jour'], marche: 'facile', contredite: { force: 3, difficulteProposee: 4 }, reponses: 20, justes: 4, msMoyen: 8000, signalements: 1, derniere: 300 })
const b = ligne({ cle: 'campagne:b', texte: 'Qui a peint La Joconde ?', categorie: 'Arts & lettres', modes: ['campagne', 'cabinet'], marche: 'moyen', reponses: 10, justes: 9, derniere: 500 })
const c = ligne({ cle: 'campagne:c', texte: 'Le Doubs se jette dans… ?', categorie: 'Géographie', modes: ['duel'], marche: 'expert', reponses: 3, justes: 0, derniere: 100 })
const d = ligne({ cle: 'jour:d', source: 'jour', texte: 'Énigme : quel été ?', categorie: 'Culture générale', modes: ['jour'], marche: 'difficile', contredite: { force: 5, difficulteProposee: 5 }, reponses: 8, justes: 1, msMoyen: 12000, signalements: 2, derniere: 200 })
const QUATRE = [a, b, c, d]
const cles = (lignes: QuestionAuQg[]) => lignes.map(l => l.cle.split(':')[1]).join('')

test('les questions retenues : leur mode, leur état — contredites, pièges sur cinq réponses au moins, signalées —, un mot sans casse ni accents, chaque colonne dans les deux sens, le vide au bout', () => {
  assert.equal(cles(questionsRetenues(QUATRE, filtre())), 'abdc', 'les plus jouées d’abord')
  assert.equal(cles(questionsRetenues(QUATRE, filtre({ mode: 'jour' }))), 'ad')
  assert.equal(cles(questionsRetenues(QUATRE, filtre({ mode: 'cabinet' }))), 'b', 'jouée en campagne et au Cabinet, elle est des deux')
  assert.equal(cles(questionsRetenues(QUATRE, filtre({ mode: 'duel' }))), 'c')
  assert.equal(cles(questionsRetenues(QUATRE, filtre({ etat: 'contredites' }))), 'da', 'les plus nettement contredites d’abord')
  assert.equal(cles(questionsRetenues(QUATRE, filtre({ etat: 'pieges' }))), 'da', 'les moins trouvées d’abord ; trois réponses n’en disent rien')
  assert.equal(cles(questionsRetenues(QUATRE, filtre({ etat: 'signalees' }))), 'da')
  assert.equal(cles(questionsRetenues(QUATRE, filtre({ mot: 'ETE' }))), 'd', 'sans casse ni accents')
  assert.equal(cles(questionsRetenues(QUATRE, filtre({ mot: 'geographie' }))), 'ac', 'sa catégorie aussi')
  assert.equal(cles(questionsRetenues(QUATRE, filtre({ mode: 'jour', mot: 'fleuve', etat: 'pieges' }))), 'a')
  const triee = (tri: FiltreDesQuestions['tri'], sens: FiltreDesQuestions['sens']) => cles(questionsRetenues(QUATRE, filtre({ tri, sens })))
  assert.equal(triee('bonnes', 'monte'), 'dabc', 'trois réponses n’ont pas de part : au bout')
  assert.equal(triee('bonnes', 'descend'), 'badc', 'au bout dans les deux sens')
  assert.equal(triee('temps', 'descend'), 'dabc', 'sans chrono, au bout — la plus jouée d’abord')
  assert.equal(triee('texte', 'monte'), 'dcab', 'sans accents : « énigme » avant « le doubs »')
  assert.equal(triee('marche', 'monte'), 'abdc', 'une contredite après sa marche sœur')
  assert.equal(triee('mode', 'monte'), 'adbc')
  assert.equal(triee('derniere', 'descend'), 'badc')
  assert.equal(triee('categorie', 'monte'), 'bdac')
  assert.equal(triee('signalements', 'descend'), 'dabc')
  assert.equal(triee('reponses', 'monte'), 'cdba')
})

test('le tri et le filtre en tranches rendent l’ordre d’un tri d’une traite, quelle que soit la tranche', () => {
  // Un hasard réglé : le même à chaque fois.
  let graine = 7
  const hasard = () => ((graine = (graine * 16807) % 2147483647) - 1) / 2147483646
  const nombres = Array.from({ length: 503 }, () => Math.floor(hasard() * 50))
  const ordre = (x: number, y: number) => x - y
  for (const tranche of [1, 2, 3, 7, 64, 503, 1000]) {
    const { valeur, tranches } = mener(trierEnTranches(nombres, ordre, tranche))
    assert.deepEqual(valeur, [...nombres].sort(ordre), `par ${tranche}`)
    if (tranche < 64) assert.ok(tranches > nombres.length / tranche, `par ${tranche} : il cède en route`)
  }
  assert.deepEqual(mener(trierEnTranches([], ordre, 4)).valeur, [])

  const modes = ['jour', 'campagne', 'cabinet', 'duel'] as const
  const niveaux: Niveau[] = ['facile', 'moyen', 'difficile', 'expert']
  const lignes = Array.from({ length: 300 }, (_, i) =>
    ligne({
      cle: `campagne:${i}`,
      texte: `Question ${Math.floor(hasard() * 40)} ${hasard() < 0.3 ? 'été' : 'hiver'}`,
      categorie: hasard() < 0.1 ? null : CATEGORIES[Math.floor(hasard() * 4)],
      modes: [modes[Math.floor(hasard() * 4)]],
      marche: hasard() < 0.1 ? null : niveaux[Math.floor(hasard() * 4)],
      contredite: hasard() < 0.3 ? { force: Math.floor(hasard() * 5), difficulteProposee: 3 } : null,
      reponses: Math.floor(hasard() * 12),
      justes: Math.floor(hasard() * 4),
      msMoyen: hasard() < 0.5 ? null : Math.floor(hasard() * 9) * 1000,
      signalements: hasard() < 0.2 ? Math.floor(hasard() * 3) : 0,
      derniere: Math.floor(hasard() * 10),
    }),
  )
  for (const f of [
    filtre(),
    filtre({ etat: 'pieges' }),
    filtre({ etat: 'contredites' }),
    filtre({ etat: 'signalees', mode: 'jour' }),
    filtre({ mot: 'ete' }),
    ...(['texte', 'mode', 'categorie', 'marche', 'reponses', 'bonnes', 'temps', 'signalements', 'derniere'] as const).flatMap(tri => [filtre({ tri, sens: 'monte' }), filtre({ tri, sens: 'descend' })]),
  ]) {
    const dUnBloc = dUneTraite(questionsRetenuesEnTranches(lignes, f, cherchableDe, Infinity))
    assert.ok(dUnBloc.length > 0, JSON.stringify(f))
    assert.deepEqual(cles(mener(questionsRetenuesEnTranches(lignes, f, cherchableDe, 7)).valeur), cles(dUnBloc), JSON.stringify(f))
  }
})

test('une page de questions, ramenée dans celles qui existent ; les tuiles sur toutes', () => {
  const lignes = Array.from({ length: QUESTIONS_PAR_PAGE * 2 + 3 }, (_, i) => ligne({ cle: `campagne:${i}` }))
  assert.deepEqual([unePage(lignes, 0).pages, unePage(lignes, 0).lignes.length], [3, QUESTIONS_PAR_PAGE])
  assert.deepEqual([unePage(lignes, 2).page, unePage(lignes, 2).lignes.length, unePage(lignes, 2).lignes[0].cle], [2, 3, `campagne:${QUESTIONS_PAR_PAGE * 2}`])
  assert.equal(unePage(lignes, 9).page, 2, 'au-delà, la dernière')
  assert.deepEqual(unePage([], 4), { page: 0, pages: 1, lignes: [] })
  assert.deepEqual(totauxDesQuestions(QUATRE), { jouees: 4, contredites: 2, pieges: 2, signalees: 2, parMode: { jour: 2, campagne: 1, cabinet: 1, duel: 1 } })
})

test('la carte de la base : chaque jouable à la marche où la campagne la tire, la contredite par la règle de la campagne, la difficulté estimée à part — les catégories de la base d’abord', () => {
  const q = (id: string, categorie: string, difficulte: number) => ({ id, meta: { categorie, sousTheme: 'x', difficulte } })
  const jouables = [q('h1', 'Histoire', 1), q('h2', 'Histoire', 1), q('h3', 'Histoire', 4), q('g1', 'Géographie', 3), q('m1', 'Musique', 2)]
  const marches: Niveau[] = ['facile', 'moyen', 'difficile', 'moyen', 'facile']
  // h2, estimée 1, trouvée par personne sur dix : la campagne la contredit.
  const mesure = new Map<string, MesureDUneQuestion>([
    ['h2', { justes: 0, total: 10 }],
    ['h1', { justes: 9, total: 10 }],
  ])
  assert.ok(marcheContredite(1, mesure.get('h2')) && !marcheContredite(1, mesure.get('h1')))
  const { valeur: carte, tranches } = mener(carteDeLaBaseEnTranches(jouables, i => marches[i], mesure, ['Histoire', 'Géographie', 'Sport'], 2))
  assert.equal(tranches, 2)
  assert.deepEqual(
    carte.map(c => [c.categorie, c.marches.map(m => `${m.jouables}/${m.contredites}`).join(' '), c.difficultes.join('')]),
    [
      ['Histoire', '1/0 1/1 1/0 0/0', '20010'],
      ['Géographie', '0/0 1/0 0/0 0/0', '00100'],
      ['Sport', '0/0 0/0 0/0 0/0', '00000'],
      ['Musique', '1/0 0/0 0/0 0/0', '01000'],
    ],
    'une catégorie sans question garde sa ligne ; une hors de la liste vient au bout',
  )
})

test('le contenu du Cabinet se compte simplement : chaque sorte du contenu livré, ses groupes, le plus fourni d’abord', () => {
  const contenu = lireLeContenu(DOSSIER_DU_CONTENU)
  const compte = contenuDuCabinetAuQg(contenu)
  assert.deepEqual(
    compte.sortes.map(s => [s.sorte, s.entrees]),
    [
      ['lieux', contenu.lieux.length],
      ['fiches', contenu.fiches.length],
      ['repliques', contenu.repliques.length],
      ['frises', contenu.frises.length],
    ],
  )
  for (const s of compte.sortes) {
    assert.ok(s.entrees > 0, `${s.sorte} : du contenu livré`)
    assert.equal(
      s.groupes.reduce((n, g) => n + g.entrees, 0),
      s.entrees,
      `${s.sorte} : chaque entrée dans un groupe`,
    )
    assert.deepEqual(
      s.groupes.map(g => g.entrees),
      s.groupes.map(g => g.entrees).sort((x, y) => y - x),
      `${s.sorte} : le plus fourni d’abord`,
    )
  }
})

// ── Au banc ─────────────────────────────────────────────────────────────────

type Reponse = { status: number; corps: any }
const lire = (banc: Banc, cookie: string, chemin: string): Promise<Reponse> =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: await r.json() }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}): Promise<Reponse> =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: await r.json() }))
async function lesQuestions(banc: Banc, admin: string, demande = ''): Promise<PageDesQuestions> {
  const r = await lire(banc, admin, `/api/admin/questions${demande}`)
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}
async function lesReserves(banc: Banc, admin: string): Promise<PageDesReserves> {
  const r = await lire(banc, admin, '/api/admin/reserves')
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}

/** La base permanente du banc, lue telle quelle. */
function base<T>(banc: Banc, lecture: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return lecture(db)
  } finally {
    db.close()
  }
}
const tirage = (banc: Banc): { reserveId: string; reponses: string[]; bonne: number }[] =>
  base(banc, db => JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(JOUR) as { questions: string }).questions))
const questionsDe = (banc: Banc, serie: string): { id: string; bonne: number; reponses: string[] }[] =>
  base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions))

/** Toute la partie du jour : `juste(i)` dit s'il trouve la question i. */
async function jouerLeJour(banc: Banc, cookie: string, juste: (i: number) => boolean) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = tirage(banc)
  while (etat.question) {
    const i = etat.question.index
    const choix = juste(i) ? questions[i].bonne : (questions[i].bonne + 1) % questions[i].reponses.length
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
}

/** Les premières réponses d'une série de campagne : `juste(i)` dit s'il trouve la question i. */
async function jouerUneSerie(banc: Banc, cookie: string, n: number, juste: (i: number) => boolean) {
  const serie = (await poster(banc, cookie, '/api/campagne/serie')).corps
  const qs = questionsDe(banc, serie.id)
  for (let i = 0; i < n; i++) {
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: juste(i) ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length })
    assert.equal(r.status, 200, r.corps.error)
  }
  return qs.slice(0, n)
}

/** Une question de soirée jouée de bout en bout depuis l'écran commun, puis le quiz refermé. */
async function jouerUneSoiree(host: Socket, quizId: string, reponses: [Invite, number][]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) => attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  await vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la question')
  const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
  for (const [qui, choice] of reponses) {
    const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
    assert.equal(ack.ok, true, ack.error)
  }
  await revelee
  const podium = vue(sessionId, v => v.phase === 'finished', 'le podium')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  await podium
  ;(host as any).emit('host:endSession', { sessionId })
}

test('au banc : les questions jouées de la campagne et du quiz du jour, jamais celles d’une soirée, sans un prénom — filtrées, triées, en pages ; un geste du QG les fait relire', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(24, { categories: ['Histoire', 'Géographie'] }) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const zephyrine = await inscrireProfil(banc.url, 'zephyrine', 'Zéphyrine', '🦊')
    const barnabe = await inscrireProfil(banc.url, 'barnabe', 'Barnabé', '🐻')
    // Le quiz du jour : Zéphyrine trouve tout sauf la première, Barnabé rien ; elle signale la deuxième.
    await jouerLeJour(banc, zephyrine, i => i !== 0)
    await jouerLeJour(banc, barnabe, () => false)
    horloge.t += 60_000
    assert.equal((await poster(banc, zephyrine, '/api/jour/signaler', { jour: JOUR, index: 1, texte: 'Ambiguë' })).status, 200)
    // La campagne : quatre réponses de Zéphyrine, la dernière fausse.
    const qs = await jouerUneSerie(banc, zephyrine, 4, i => i < 3)
    // Une soirée, que le QG ne lit jamais : ses questions sont aux animateurs, et ses invités ne se nomment pas.
    const quiz = await creerQuiz(banc.url, admin, [qcm('Quelle est la couleur secrète du lot sept ?', ['Pourpre', 'Ocre'])], 'Le quiz très secret')
    const host = await ecranCommun(banc.url, admin)
    const salle = [await invite(banc.url, 'Zéphyrine', '🦊', { cookie: zephyrine }), await invite(banc.url, 'Gaspard Caché', '🐙')]
    await jouerUneSoiree(host, quiz, [
      [salle[0], 0],
      [salle[1], 1],
    ])

    const p = await lesQuestions(banc, admin)
    const tire = tirage(banc)
    const dit = JSON.stringify(p) + JSON.stringify(await lesReserves(banc, admin))
    for (const secret of ['couleur secrète', 'Le quiz très secret', 'Pourpre', 'Gaspard', 'Zéphyrine', 'zephyrine', 'Barnabé', 'barnabe']) {
      assert.ok(!dit.includes(secret), `les pages du contenu ne disent pas « ${secret} »`)
    }
    assert.deepEqual(p.totaux, { jouees: tire.length + 4, contredites: 0, pieges: 0, signalees: 1, parMode: { jour: tire.length, campagne: 4, cabinet: 0, duel: 0 } })
    assert.deepEqual([p.total, p.pages, p.filtre.page, p.lignes.length], [tire.length + 4, 1, 0, tire.length + 4])
    // Chaque question du jour : deux réponses, la bonne de Zéphyrine sauf à la première ; ses gestes visent ce jour, qui court.
    tire.forEach((t, i) => {
      const l = p.lignes.find(x => x.cle === `jour:${t.reserveId}`)!
      assert.ok(l, `la question ${i + 1} du jour`)
      assert.deepEqual([l.modes, l.reponses, l.justes, l.recueil[t.bonne].n, l.signalements], [['jour'], 2, i === 0 ? 0 : 1, i === 0 ? 0 : 1, i === 1 ? 1 : 0], `la question ${i + 1}`)
      assert.ok(l.gestes.source === 'jour' && l.gestes.jour === JOUR && l.gestes.index === i && l.gestes.annulable)
      assert.equal(l.msMoyen !== null, true, 'le quiz du jour a son chrono')
    })
    // Chaque question de la campagne : une réponse, sa marche de tirage ; la fausse se lit sur le leurre choisi.
    qs.forEach((q, i) => {
      const l = p.lignes.find(x => x.cle === `campagne:${q.id}`)!
      assert.ok(l, `la question ${i + 1} de la série`)
      assert.deepEqual([l.modes, l.reponses, l.justes, l.msMoyen], [['campagne'], 1, i < 3 ? 1 : 0, null])
      assert.ok(l.marche !== null && l.difficulte !== null)
      if (i === 3) assert.deepEqual(l.recueil.filter(r => r.n > 0).map(r => [r.texte, r.bonne]), [[q.reponses[(q.bonne + 1) % q.reponses.length], false]])
    })

    // Le filtre, le tri et les pages, au serveur.
    const campagne = await lesQuestions(banc, admin, '?mode=campagne&tri=texte&sens=monte')
    assert.deepEqual(
      campagne.lignes.map(l => l.texte),
      qs.map(q => p.lignes.find(x => x.cle === `campagne:${q.id}`)!.texte).sort(),
      'ses seules questions, par ordre alphabétique',
    )
    assert.deepEqual(campagne.filtre, { mode: 'campagne', etat: 'toutes', mot: '', tri: 'texte', sens: 'monte', page: 0 })
    const signalees = await lesQuestions(banc, admin, '?mode=jour&etat=signalees')
    assert.deepEqual(
      signalees.lignes.map(l => l.cle),
      [`jour:${tire[1].reserveId}`],
    )
    assert.equal((await lesQuestions(banc, admin, `?mot=${encodeURIComponent('  laquelle est la BONNE ')}`)).total, 4, 'des mots de l’intitulé, sans casse')
    assert.deepEqual((await lesQuestions(banc, admin, '?page=7')).filtre.page, 0, 'au-delà, la dernière page')

    // « Retirer de la campagne » depuis la feuille d'une question : la page relue ne la montre plus, sans attendre sa minute.
    assert.equal((await poster(banc, admin, '/api/admin/campagne/retirer', { questionId: qs[0].id })).status, 200)
    const apres = await lesQuestions(banc, admin)
    assert.equal(
      apres.lignes.some(l => l.cle === `campagne:${qs[0].id}`),
      false,
    )
    assert.equal(apres.totaux.jouees, p.totaux.jouees - 1)

    // Les réserves et la base : ce que dit la page du quiz du jour, ses prêtes catégorie par catégorie, deux semaines
    // d'apports jusqu'à aujourd'hui ; la base dans l'ordre de ses catégories, une retirée ; le contenu du Cabinet.
    const r = await lesReserves(banc, admin)
    const duJour = (await lire(banc, admin, '/api/admin/jour')).corps.reserve
    assert.deepEqual([r.jour.pretes, r.jour.joursDAvance, r.jour.posees], [duJour.pretes, duJour.joursDAvance, duJour.posees])
    assert.equal(
      r.jour.parCategorie.reduce((n, x) => n + x.pretes, 0),
      r.jour.pretes,
    )
    assert.deepEqual([r.jour.parJour.length, r.jour.parJour.at(-1)!.jour], [JOURS_DES_APPORTS, JOUR])
    assert.deepEqual(
      r.campagne.carte.map(x => x.categorie),
      [...CATEGORIES],
    )
    assert.deepEqual([r.campagne.questions, r.campagne.jouables, r.campagne.retirees], [24, 23, 1])
    assert.equal(r.campagne.carte.reduce((n, x) => n + x.marches.reduce((m, y) => m + y.jouables, 0), 0), 23, 'chaque jouable à une marche')
    assert.deepEqual(
      r.campagne.carte.filter(x => x.marches.some(y => y.jouables > 0)).map(x => x.categorie),
      ['Histoire', 'Géographie'],
    )
    assert.ok(r.cabinet && r.cabinet.sortes.length === 4 && r.cabinet.sortes.every(s => s.entrees > 0), 'le contenu livré du Cabinet')
  } finally {
    await banc.close()
  }
})

// ── Ce que la page coûte à la base ──────────────────────────────────────────

/**
 * Ce que la base permanente a servi pendant une mesure, comme `qg-charge.test.ts` : un aller-retour par `execute` ou
 * `batch`, et chaque instruction de chacun, avec ses arguments.
 */
const compte = { actif: false, lots: [] as { sql: string; args: unknown[] }[][] }
const enInstruction = (s: unknown) =>
  typeof s === 'string' ? { sql: s.replace(/\s+/g, ' ').trim(), args: [] } : { sql: (s as { sql: string }).sql.replace(/\s+/g, ' ').trim(), args: (s as { args?: unknown[] }).args ?? [] }
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    if (compte.actif) compte.lots.push((methode === 'batch' ? (args[0] as unknown[]) : [args[0]]).map(enInstruction))
    return origine.apply(this, args)
  }
}
async function mesurer<T>(travail: () => Promise<T>): Promise<{ lots: { sql: string; args: unknown[] }[][]; resultat: T }> {
  Object.assign(compte, { actif: true, lots: [] })
  try {
    return { resultat: await travail(), lots: compte.lots }
  } finally {
    compte.actif = false
  }
}
/** Les jours de réponses du quiz du jour qu'une mesure a lus : `[après, jusqu'à]` chacun. */
const joursLus = (lots: { sql: string; args: unknown[] }[][]) => lots.flat().filter(i => /FROM jour_reponses WHERE jour > \? AND jour <= \?/.test(i.sql)).map(i => i.args)

test('ce que la page des questions coûte à la base : rien pendant sa minute, puis aujourd’hui seul — les jours clos lus une fois, et celui que minuit vient de clore', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(16) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const zephyrine = await inscrireProfil(banc.url, 'zephyrine', 'Zéphyrine', '🦊')
    await jouerLeJour(banc, zephyrine, () => true)
    await jouerUneSerie(banc, zephyrine, 2, () => true)
    // La première lecture : aujourd'hui, et le trimestre clos du quiz du jour — du premier jour de la fenêtre à hier.
    const premiere = await mesurer(() => lesQuestions(banc, admin))
    assert.deepEqual(joursLus(premiere.lots), [
      ['2026-09-25', JOUR],
      [jourAvant(JOUR, JOURS_DES_QUESTIONS_DU_JOUR), '2026-09-25'],
    ])
    // Pendant sa minute, quoi qu'on trie ou filtre : rien de la base.
    const gardee = await mesurer(() => lesQuestions(banc, admin, '?etat=pieges&tri=texte&sens=monte&mot=essai'))
    assert.equal(gardee.lots.length, 0)
    // Sa minute passée : deux allers-retours — le quiz du jour d'un lot, ses jours clos gardés ; la campagne d'un autre,
    // ses signalements ouverts et ce qui est arrivé au journal ensemble — et ses réponses toujours là.
    horloge.t += CONTENU_GARDE_MS + 1000
    const relue = await mesurer(() => lesQuestions(banc, admin))
    assert.deepEqual(joursLus(relue.lots), [['2026-09-25', JOUR]])
    assert.equal(relue.lots.length, 2, relue.lots.map(l => l.map(i => i.sql.slice(0, 60)).join(' | ')).join('\n'))
    const deLaCampagne = relue.lots.find(l => l.some(i => /FROM campagne_signalements/.test(i.sql)))!
    assert.ok(deLaCampagne.length === 2 && deLaCampagne.some(i => /FROM campagne_reponses r LEFT JOIN campagne_series/.test(i.sql)), 'les signalements et le journal d’un seul lot')
    assert.deepEqual(
      relue.resultat.lignes.filter(l => l.source === 'jour').map(l => l.reponses),
      premiere.resultat.lignes.filter(l => l.source === 'jour').map(l => l.reponses),
    )
    // Le lendemain : aujourd'hui, et le jour que minuit vient de clore — lu une fois, puis gardé avec les autres.
    horloge.t = DEBUT + 24 * 3_600_000
    const lendemain = await mesurer(() => lesQuestions(banc, admin))
    assert.deepEqual(joursLus(lendemain.lots), [
      [JOUR, '2026-09-27'],
      ['2026-09-25', JOUR],
    ])
    const hier = lendemain.resultat.lignes.filter(l => l.source === 'jour')
    assert.ok(hier.length > 0 && hier.every(l => l.reponses === 1 && l.gestes.source === 'jour' && !l.gestes.annulable), 'ses réponses d’hier, que la nuit a closes')
    horloge.t += CONTENU_GARDE_MS + 1000
    assert.deepEqual(joursLus((await mesurer(() => lesQuestions(banc, admin))).lots), [[JOUR, '2026-09-27']])
    // La page des réserves, pendant sa minute : rien de la base non plus.
    await lesReserves(banc, admin)
    assert.equal((await mesurer(() => lesReserves(banc, admin))).lots.length, 0)
  } finally {
    await banc.close()
  }
})
