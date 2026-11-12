// Les faces d'un même fait (`core/faces.ts`, le 12 novembre 2026) : deux
// questions de la base qui posent le même fait sous deux formes — l'année
// d'une œuvre et le nom de son auteur. Le juge des faits les refusait toutes à
// l'écriture, et le premier acte du Filet perdait 115 des 129 années que
// chaque Français sait placer. Le choix du propriétaire : les laisser entrer,
// liées l'une à l'autre (`faceDe`), et garder le joueur au tirage — jamais
// deux faces d'un fait dans une partie, une face vue compte pour vue chez ses
// sœurs, et la mesure des difficultés écarte ce que la sœur avait soufflé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { BaseDeLaCampagne, entreeDeLaBase, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { CampagneStore, sujetsDeLaQuestion, tirerUneEpreuve, tirerUneSerie } from '../src/core/campagne'
import { soeursDe, vueDuFait } from '../src/core/faces'
import { JournalDesReponses, type ReponseDuJournal } from '../src/core/journalDesReponses'
import { IndexDesFaits, faitDe, lienEntre } from '../src/core/memeFait'
import { composerUnQuiz, idDansLeQuiz, uneAutreQuestion, type DejaDansLEspace } from '../src/core/quizToutPret'
import { tirerPourUneEscale } from '../src/core/tirageALaPiece'
import { TriDesEntrees } from '../scripts/lots-campagne'
import { regleDuPalier } from '../../shared/sentiers'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { suiteFixe } from '../../shared/hasard'
import type { Categorie } from '../../shared/categories'

const MAINTENANT = Date.UTC(2026, 10, 12, 20)
const JOUR_MS = 24 * 3_600_000

type Entite = [nom: string, type: string]

/** Une question de la base, la bonne réponse en premier, relue par le juge de la base. */
function question(
  id: string,
  texte: string,
  reponses: string[],
  {
    categorie = 'Nature' as Categorie,
    difficulte = 2,
    faceDe,
    entites = [] as Entite[],
    valeur = null as { nombre: number; unite: string } | null,
  }: { categorie?: Categorie; difficulte?: number; faceDe?: unknown; entites?: Entite[]; valeur?: { nombre: number; unite: string } | null } = {},
): QuestionDeLaBase {
  const lu = lireQuestionDeLaBase({
    id,
    texte,
    reponses,
    bonne: 0,
    anecdote: null,
    categorie,
    sousTheme: SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: entites.map(([nom, type]) => ({ nom, type, description: '' })),
    portee: 'monde',
    valeur,
    leurres: reponses.slice(1),
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
    ...(faceDe !== undefined && { faceDe }),
  })
  if ('refus' in lu) throw new Error(`${id} : ${lu.refus}`)
  return lu.question
}

/** Une question qui ne ressemble à aucune autre : sa forme à elle, ses réponses à elle. */
const seule = (n: number, difficulte = 2, categorie: Categorie = 'Nature', faceDe?: string[]) =>
  question(`q${String(n).padStart(7, '0')}`, `Énigme ${n} : quel secret garde la forêt ?`, [`Bonne ${n}`, `Autre A${n}`, `Autre B${n}`, `Autre C${n}`], {
    difficulte,
    categorie,
    faceDe,
  })

/** Deux faces d'un même fait : la seconde nomme la première. */
function paire(k: number, difficulte = 2): [QuestionDeLaBase, QuestionDeLaBase] {
  const a = seule(1000 + 2 * k, difficulte)
  return [a, seule(1001 + 2 * k, difficulte, 'Nature', [a.id])]
}

const aucunePaire = (ids: ReadonlySet<string>, paires: readonly (readonly [QuestionDeLaBase, QuestionDeLaBase])[]) =>
  paires.filter(([a, b]) => ids.has(a.id) && ids.has(b.id)).map(([a, b]) => `${a.id}+${b.id}`)

// ── La base ─────────────────────────────────────────────────────────────────

test('une question dit les faces de son fait : relue, écrite au bout de sa ligne, et la base en tire les sœurs dans les deux sens', () => {
  const a = seule(1)
  const b = seule(2, 2, 'Nature', ['q0000001', 'q0000002', 'zz999999', 'q0000001'])
  assert.deepEqual(b.faceDe, ['q0000001', 'zz999999'], 'sans elle-même ni doublon')
  assert.equal('faceDe' in a, false, 'sans face, pas de clé : la base préparée la range telle quelle')
  const ligne = entreeDeLaBase(b)
  assert.equal(Object.keys(ligne).at(-1), 'faceDe', 'au bout de la ligne : les autres lignes de la base ne bougent pas')
  assert.equal('faceDe' in entreeDeLaBase(a), false)
  const relue = lireQuestionDeLaBase(ligne)
  assert.ok('question' in relue && relue.question.faceDe?.join() === b.faceDe!.join(), 'relue telle qu’écrite')
  const refus = lireQuestionDeLaBase({ ...entreeDeLaBase(a), faceDe: ['pas un identifiant'] })
  assert.ok('refus' in refus && /faceDe/.test(refus.refus), 'un identifiant qui n’en est pas un refuse la ligne')

  const c = seule(3, 2, 'Nature', ['q0000001'])
  const d = seule(4)
  const base = new BaseDeLaCampagne([a, b, c, d])
  assert.deepEqual([...soeursDe(a)!].sort(), ['q0000002', 'q0000003'], 'nommée par deux autres, elle a deux sœurs')
  assert.deepEqual(soeursDe(b), ['q0000001'], 'un lien vers une question absente ne compte pas')
  assert.deepEqual(soeursDe(c), ['q0000001'], 'les sœurs de ses sœurs ne sont pas les siennes')
  assert.equal(soeursDe(d), undefined)
  assert.deepEqual(base.soeurs.get('q0000003'), ['q0000001'])
  // Vue sous une face, la sœur l'est aussi, à la même heure.
  assert.equal(vueDuFait(a, new Map([['q0000002', 100], ['q0000003', 50]])), 100)
  assert.equal(vueDuFait(c, new Map([['q0000001', 7], ['q0000003', 3]])), 7)
  assert.equal(vueDuFait(c, new Map([['q0000002', 7]])), undefined, 'pas la sœur de sa sœur')
  assert.equal(vueDuFait(d, new Map([['q0000001', 7]])), undefined)
})

// ── Le tirage ───────────────────────────────────────────────────────────────

test('une série ne pose jamais deux faces d’un même fait quand sa marche a autre chose', () => {
  // Dix paires de faciles, et assez du reste pour que la série ne revienne pas aux faciles.
  const paires = Array.from({ length: 10 }, (_, k) => paire(k))
  const reste = [...Array.from({ length: 5 }, (_, i) => seule(100 + i, 3)), ...Array.from({ length: 5 }, (_, i) => seule(200 + i, 4)), ...Array.from({ length: 60 }, (_, i) => seule(300 + i, 5))]
  const base = new BaseDeLaCampagne([...paires.flat(), ...reste])
  for (let essai = 0; essai < 40; essai++) {
    const serie = tirerUneSerie(base.questions, new Map())
    assert.equal(serie.filter(x => x.niveau === 'facile').length, 5)
    assert.deepEqual(aucunePaire(new Set(serie.map(x => x.question.id)), paires), [], `essai ${essai}`)
  }
})

test('une série prend pour vue une face dont il a vu la sœur — même hors de ce qu’elle joue', () => {
  // Les sœurs vivent en Histoire, la série se joue en Nature.
  const soeurs = Array.from({ length: 5 }, (_, i) => seule(400 + i, 2, 'Histoire'))
  const faces = soeurs.map((s, i) => seule(410 + i, 2, 'Nature', [s.id]))
  const neuves = Array.from({ length: 5 }, (_, i) => seule(420 + i))
  const experts = Array.from({ length: 60 }, (_, i) => seule(500 + i, 5))
  const base = new BaseDeLaCampagne([...soeurs, ...faces, ...neuves, ...experts])
  const jouables = base.questions.filter(q => q.meta.categorie === 'Nature')
  const vues = new Map(soeurs.map((q, i) => [q.id, MAINTENANT - 3 * JOUR_MS + i]))
  for (let essai = 0; essai < 20; essai++) {
    const faciles = tirerUneSerie(jouables, new Map(), vues, MAINTENANT).filter(x => x.niveau === 'facile')
    assert.deepEqual(faciles.map(x => x.question.id).sort(), neuves.map(q => q.id).sort(), `essai ${essai} : les jamais vues d’abord, sous aucune face`)
  }
})

test('une épreuve des sentiers ne prend jamais deux faces d’un fait, ni une face dont il a vu la sœur, tant qu’elle a mieux', () => {
  const paires = Array.from({ length: 10 }, (_, k) => paire(k))
  const neutres = Array.from({ length: 20 }, (_, i) => seule(600 + i))
  const base = new BaseDeLaCampagne([...paires.flat(), ...neutres])
  for (let essai = 0; essai < 25; essai++) {
    const epreuve = tirerUneEpreuve(base.questions, regleDuPalier(1)!, new Map(), new Map(), MAINTENANT)
    assert.equal(epreuve.length, 16)
    assert.deepEqual(aucunePaire(new Set(epreuve.map(x => x.question.id)), paires), [], `essai ${essai}`)
  }
  // Une face de chaque paire vue il y a trois jours : l'autre passe après les vingt neuves.
  const vues = new Map(paires.map(([a], i) => [a.id, MAINTENANT - 3 * JOUR_MS + i]))
  const deNeutres = new Set(neutres.map(q => q.id))
  for (let essai = 0; essai < 10; essai++) {
    const epreuve = tirerUneEpreuve(base.questions, regleDuPalier(1)!, vues, new Map(), MAINTENANT)
    assert.ok(
      epreuve.every(x => deNeutres.has(x.question.id)),
      epreuve.map(x => x.question.id).join(' '),
    )
  }
})

test('une escale — une manche du Cabinet — ne pose pas une autre face d’un fait que sa partie a posé, ni ne la prend pour neuve', () => {
  const paires = Array.from({ length: 6 }, (_, k) => paire(k))
  const neutres = Array.from({ length: 6 }, (_, i) => seule(700 + i))
  const base = new BaseDeLaCampagne([...paires.flat(), ...neutres])
  const deNeutres = neutres.map(q => q.id).sort()
  // Ce que la partie a posé, comme le garde `Posees` : son intitulé, ses réponses, son identifiant.
  const posees = paires.map(([a]) => ({ texte: a.texte, reponses: a.reponses, id: a.id }))
  const pasPosee = (q: QuestionDeLaBase) => !posees.some(p => p.id === q.id)
  for (let essai = 0; essai < 15; essai++) {
    const tirees = tirerPourUneEscale([base.questions], 'facile', 6, { sansVraiFaux: true, garde: pasPosee, vues: new Map(), mesure: new Map(), maintenant: MAINTENANT, posees })
    assert.deepEqual(tirees.map(x => x.question.id).sort(), deNeutres, `essai ${essai}`)
  }
  // Rien de posé : jamais deux faces dans un même tirage.
  for (let essai = 0; essai < 15; essai++) {
    const tirees = tirerPourUneEscale([base.questions], 'facile', 9, { sansVraiFaux: true, vues: new Map(), mesure: new Map(), maintenant: MAINTENANT })
    assert.equal(tirees.length, 9)
    assert.deepEqual(aucunePaire(new Set(tirees.map(x => x.question.id)), paires), [], `essai ${essai}`)
  }
  // Vue cette semaine sous une face : dans la fenêtre du Cabinet, sa sœur ne revient qu'en dernier recours.
  const vues = new Map(paires.map(([a], i) => [a.id, MAINTENANT - 3 * JOUR_MS + i]))
  const sansLesVues = base.questions.filter(pasPosee)
  for (let essai = 0; essai < 15; essai++) {
    const tirees = tirerPourUneEscale([sansLesVues], 'facile', 6, { sansVraiFaux: true, vues, mesure: new Map(), maintenant: MAINTENANT, fenetreMs: 7 * JOUR_MS })
    assert.deepEqual(tirees.map(x => x.question.id).sort(), deNeutres, `essai ${essai}`)
  }
})

const rien: DejaDansLEspace = { ids: new Set(), empreintes: new Set(), posees: new Map() }
const choixFacile = { categories: ['Nature'] as Categorie[], sujet: null, difficulte: 'facile' as const, nombre: 15, enfants: false, estimations: false }

test('un quiz tout prêt ne pose jamais deux faces d’un fait, et une face posée sous l’autre dans ses soirées n’est plus neuve', () => {
  const paires = Array.from({ length: 10 }, (_, k) => paire(k))
  const neutres = Array.from({ length: 20 }, (_, i) => seule(800 + i))
  const base = new BaseDeLaCampagne([...paires.flat(), ...neutres])
  const enQuiz = (ids: readonly (string | undefined)[]) => new Set(ids.map(id => id!.replace(/^base-/, '')))
  for (let graine = 1; graine <= 20; graine++) {
    const quiz = composerUnQuiz(base.questions, sujetsDeLaQuestion, new Map(), choixFacile, rien, suiteFixe(graine))
    assert.equal(quiz.length, 15)
    assert.deepEqual(aucunePaire(enQuiz(quiz.map(q => q.id)), paires), [], `graine ${graine}`)
  }
  // Ses soirées ont posé une face de chaque paire : l'autre passe après tout ce qu'elles n'ont jamais posé.
  const deja: DejaDansLEspace = { ...rien, posees: new Map(paires.map(([a], i) => [idDansLeQuiz(a.id), MAINTENANT - JOUR_MS + i])) }
  const deNeutres = new Set(neutres.map(q => q.id))
  for (let graine = 1; graine <= 10; graine++) {
    const quiz = composerUnQuiz(base.questions, sujetsDeLaQuestion, new Map(), choixFacile, deja, suiteFixe(graine))
    assert.ok([...enQuiz(quiz.map(q => q.id))].every(id => deNeutres.has(id)), `graine ${graine}`)
  }
})

test('« Une autre » ne remplace pas une question par une autre face du fait d’une question du quiz', () => {
  const paires = Array.from({ length: 5 }, (_, k) => paire(k))
  const remplacee = seule(900)
  const voisine = seule(901)
  const base = new BaseDeLaCampagne([...paires.flat(), remplacee, voisine])
  const quiz = [remplacee, ...paires.map(([a]) => a)].map(q => idDansLeQuiz(q.id))
  for (let graine = 1; graine <= 12; graine++) {
    const autre = uneAutreQuestion(base.questions, sujetsDeLaQuestion, new Map(), { id: idDansLeQuiz(remplacee.id), kind: 'choice' }, quiz, rien, suiteFixe(graine))
    assert.equal(autre?.id, idDansLeQuiz(voisine.id), `graine ${graine}`)
  }
})

// ── Le juge ─────────────────────────────────────────────────────────────────

const peintre = question(
  'pein1830',
  'Quel peintre a représenté la révolution de Juillet 1830 dans La Liberté guidant le peuple ?',
  ['Eugène Delacroix', 'Théodore Géricault', 'Jacques-Louis David', 'Gustave Courbet'],
  {
    categorie: 'Arts & lettres',
    difficulte: 3,
    entites: [
      ['La Liberté guidant le peuple', 'oeuvre'],
      ['Eugène Delacroix', 'personne'],
    ],
  },
)
const annee = question('anne1830', 'En quelle année Delacroix peint-il La Liberté guidant le peuple ?', ['1830', '1815', '1848', '1871'], {
  categorie: 'Arts & lettres',
  difficulte: 3,
  entites: [
    ['Eugène Delacroix', 'personne'],
    ['La Liberté guidant le peuple', 'oeuvre'],
  ],
  valeur: { nombre: 1830, unite: '' },
})
const gotham = question('gotham01', 'Dans quelle ville imaginaire Batman protège-t-il les habitants ?', ['Gotham City', 'Metropolis', 'Star City', 'Central City'], {
  categorie: 'Arts & lettres',
  entites: [
    ['Gotham City', 'lieu'],
    ['Batman', 'personnage'],
  ],
})
const gothamAuCinema = question('gotham02', 'Comment se nomme la cité que le justicier masqué de DC Comics veille la nuit ?', ['Gotham City', 'Metropolis', 'Smallville', 'Coast City'], {
  categorie: 'Cinéma & séries',
  entites: [['Batman', 'personnage']],
})

test('le juge des faits : une réponse chiffrée que l’autre écrit est une autre face du fait ; le même fait posé deux fois, un doublon', () => {
  assert.equal(lienEntre(faitDe(annee)!, faitDe(peintre)!), 'face', 'l’année que l’autre écrit dans son intitulé')
  assert.equal(lienEntre(faitDe(peintre)!, faitDe(annee)!), 'face', 'dans les deux sens')
  assert.equal(lienEntre(faitDe(gotham)!, faitDe(gothamAuCinema)!), 'doublon', 'la même réponse, Batman des deux côtés')
  assert.equal(lienEntre(faitDe(gotham)!, faitDe(annee)!), null)
  // L'index : un doublon l'emporte, les faces se rendent toutes.
  const index = new IndexDesFaits([peintre, gotham])
  assert.deepEqual(index.relever(annee), { faces: [peintre] })
  assert.deepEqual(index.relever(gothamAuCinema), { doublon: gotham, faces: [] })
  assert.deepEqual(index.relever(seule(5)), { faces: [] })
})

/** Une entrée telle qu'un lot l'écrit : sans identifiant. */
const enLot = (q: QuestionDeLaBase) => {
  const { id: _id, ...entree } = entreeDeLaBase(q)
  return entree
}

test('le rangement d’un lot range une autre face d’un fait de la base, liée à elle — et refuse toujours le doublon', () => {
  const tri = new TriDesEntrees([peintre, gotham], new Set())
  const jugee = tri.juger(enLot(annee), 'a#0')
  assert.ok('question' in jugee, JSON.stringify(jugee))
  assert.deepEqual(jugee.question.faceDe, [peintre.id])
  assert.deepEqual(jugee.faces, [peintre])
  const doublon = tri.juger(enLot(gothamAuCinema), 'a#1')
  assert.ok('refus' in doublon && doublon.sorte === 'fait' && /^pose sans doute le même fait que « Dans quelle ville imaginaire Batman/.test(doublon.refus), JSON.stringify(doublon))
  // Ses faces, le juge seul les dit : un lien écrit dans l'entrée ne compte pas.
  const ecrite = tri.juger({ ...enLot(seule(6)), faceDe: [gotham.id] }, 'a#2')
  assert.ok('question' in ecrite && !('faceDe' in ecrite.question), JSON.stringify(ecrite))
  // Deux faces d'un fait dans les mêmes lots : la seconde n'a pas d'identifiant à nommer.
  const vide = new TriDesEntrees([], new Set())
  assert.ok('question' in vide.juger(enLot(peintre), 'b#0'))
  const seconde = vide.juger(enLot(annee), 'b#1')
  assert.ok('refus' in seconde && seconde.sorte === 'fait', JSON.stringify(seconde))
  assert.equal(
    'refus' in seconde && seconde.refus,
    `une autre face du fait de « ${peintre.texte} » (b#0), pas encore rangée : range l’une, l’autre entrera ensuite, liée à elle`,
  )
})

// ── La mesure ───────────────────────────────────────────────────────────────

/** Une réponse telle que le journal la lit. */
const reponse = (r: Pick<ReponseDuJournal, 'n' | 'qui' | 'question' | 'juste' | 'le'> & Partial<ReponseDuJournal>): ReponseDuJournal => ({
  serie: `s-${r.qui}-${r.n}`,
  repondue: true,
  aidee: false,
  joker: null,
  forme: null,
  mode: 'serie',
  commencee: r.le,
  semaine: null,
  duel: null,
  fermeLe: null,
  carnet: null,
  categorie: 'Nature',
  niveau: 'facile',
  montre: null,
  compagnon: null,
  epreuve: null,
  choisie: null,
  composee: null,
  ...r,
})

test('la mesure écarte la première réponse de qui avait répondu à une autre face du fait', () => {
  const journal = new JournalDesReponses(() => MAINTENANT)
  journal.appliquer({
    reponses: [
      // Léa voit A, puis B : B lui était soufflée.
      reponse({ n: 1, qui: 'lea', question: 'qa', juste: true, le: MAINTENANT - 5 * JOUR_MS }),
      reponse({ n: 2, qui: 'lea', question: 'qb', juste: true, le: MAINTENANT - 4 * JOUR_MS }),
      // Tom voit B, puis A : c'est A qui lui était soufflée.
      reponse({ n: 3, qui: 'tom', question: 'qb', juste: false, le: MAINTENANT - 3 * JOUR_MS }),
      reponse({ n: 4, qui: 'tom', question: 'qa', juste: true, le: MAINTENANT - 2 * JOUR_MS }),
      // Zoé ne voit que B : rien à écarter. Une révision de B, après, ne compte jamais.
      reponse({ n: 5, qui: 'zoe', question: 'qb', juste: false, le: MAINTENANT - 2 * JOUR_MS }),
      reponse({ n: 6, qui: 'zoe', question: 'qa', juste: true, le: MAINTENANT - JOUR_MS, mode: 'revision' }),
      // Une question sans sœur : rien à écarter.
      reponse({ n: 7, qui: 'lea', question: 'qc', juste: true, le: MAINTENANT - JOUR_MS }),
    ],
    jusqua: 7,
    aSuivre: false,
  })
  const soeurs = new Map([
    ['qa', ['qb']],
    ['qb', ['qa']],
  ])
  const ecartees = (() => {
    const calcul = journal.horsDeLaMesure(soeurs, 2)
    for (;;) {
      const pas = calcul.next()
      if (pas.done) return pas.value
    }
  })()
  assert.deepEqual(
    Object.fromEntries(ecartees),
    {
      qb: { justes: 1, total: 1 },
      qa: { justes: 1, total: 1 },
    },
    'Léa en B, Tom en A — pas Zoé, dont la révision de A ne compte pas',
  )
  assert.equal(journal.horsDeLaMesure(new Map()).next().value?.size, 0, 'sans face, rien à relire')
})

test('la mesure de la campagne ne compte pas ce qu’une autre face avait soufflé', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-faces-'))
  const fichier = path.join(dir, 'permanente.db')
  const url = `file:${fichier.replace(/\\/g, '/')}`
  const a = seule(1)
  const b = seule(2, 2, 'Nature', [a.id])
  const autres = Array.from({ length: 30 }, (_, i) => seule(10 + i))
  const campagne = new CampagneStore(url, undefined, { base: new BaseDeLaCampagne([a, b, ...autres]), maintenant: () => MAINTENANT })
  try {
    await campagne.init()
    const db = new Database(fichier)
    try {
      const serie = db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, ?, 1, 3, 0, ?, ?, 'serie')`,
      )
      const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, 0, ?, 0, ?, ?)')
      const jouee = (id: string, qui: string, q: QuestionDeLaBase, juste: boolean, le: number) => {
        serie.run(id, qui, JSON.stringify([{ id: q.id, categorie: 'Nature', niveau: 'facile' }]), le, le)
        reponse.run(id, q.id, juste ? 1 : 0, le)
      }
      // Léa trouve A, puis B, qu'A lui soufflait ; Tom rate B, sans avoir vu A.
      jouee('s1', 'lea', a, true, MAINTENANT - 5 * JOUR_MS)
      jouee('s2', 'lea', b, true, MAINTENANT - 4 * JOUR_MS)
      jouee('s3', 'tom', b, false, MAINTENANT - 3 * JOUR_MS)
    } finally {
      db.close()
    }
    const mesure = await campagne.mesures()
    assert.equal(mesure.get(b.id)?.total, 1, 'la réponse soufflée de Léa ne compte pas')
    assert.equal(mesure.get(b.id)?.justes, 0)
    assert.equal(mesure.get(a.id)?.total, 1, 'la sienne à A, si')
    assert.equal(mesure.get(a.id)?.justes, 1)
  } finally {
    campagne.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
