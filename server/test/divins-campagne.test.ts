// Les Divins de la campagne solo, sur un vrai serveur : cinq des douze venus
// le 21 novembre 2026 — le Démiurge et Ariane à la fin d'une série, Mnémosyne
// à la fin d'une révision du carnet, Héraclès à la fin de toute partie de la
// campagne, Sisyphe à la fin d'une épreuve de sentier.
//
// Leurs règles vivent dans `core/divins.ts`, en dérivation pure ; ici, ce
// que le câblage en fait : la partie qui tient la règle l'annonce à son seul
// joueur, à part de ses trophées, et la range sous elle — et celle qui la
// manque d'un rien n'annonce rien. Le dernier pas se joue toujours par les
// routes ; ce qui le précède — des journées de mille réponses, onze vies
// perdues — s'écrit à la main dans la base, comme un autre serveur l'aurait
// écrit. Les duels et ce qui se juge d'un mode à l'autre ont leurs fichiers
// (`divins-duels.test.ts`, `divins-au-dela.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore, cleDeSerie } from '../src/auth/profiles'
import type { BaseDeLaCampagne } from '../src/core/baseCampagne'
import { QUESTIONS_PAR_SERIE } from '../../shared/campagne'
import { QUESTIONS_PAR_REVISION } from '../../shared/revision'
import { QUESTIONS_PAR_EPREUVE, VIES_PAR_JOUR } from '../../shared/sentiers'
import type { CleDeBranche } from '../../shared/branches'

// Un Éclat tiré au hasard ferait tomber un palier : rien ici n'en dépend.
ProfileStore.tirageEclat = () => false

const HEURE = 3_600_000
const JOUR = 24 * HEURE
/** Mardi 6 octobre 2026, 10 h à Paris (heure d'été, UTC+2). */
const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
/**
 * Le minuit de Paris qui ouvre ce mardi : 22 h la veille, en temps universel.
 * Ce qui s'écrit à la main « aujourd'hui » part de là, et « hier » finit
 * juste avant : un jour compté en temps universel se tromperait des deux.
 */
const MINUIT = Date.UTC(2026, 9, 5, 22, 0)

interface Horloge {
  t: number
}

async function avecBanc(baseDeLaCampagne: BaseDeLaCampagne, scenario: (banc: Banc, horloge: Horloge) => Promise<void>) {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)
const divinsRanges = (banc: Banc, login: string) =>
  base(banc, db =>
    (db.prepare(`SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'dv:%' ORDER BY badge`).all(idDe(banc, login)) as {
      badge: string
      soiree_id: string
    }[]).map(r => `${r.badge} sous ${r.soiree_id}`),
  )

// ── Jouer par les routes ───────────────────────────────────────────────────

const commencerSerie = async (banc: Banc, cookie: string, categories?: string[]) => (await poster(banc, cookie, '/api/campagne/serie', categories ? { categories } : {})).corps
const commencerRevision = async (banc: Banc, cookie: string, corps: unknown = {}) => (await poster(banc, cookie, '/api/campagne/revision', corps)).corps
const commencerEpreuve = async (banc: Banc, cookie: string, branche: CleDeBranche, palier: number) =>
  (await poster(banc, cookie, '/api/campagne/sentiers/epreuve', { branche, palier })).corps

/** Les questions qu'une partie a reçues, telles qu'elle les garde — une révision y dit celles qu'elle revoit en avance. */
const questionsDe = (banc: Banc, partie: string) =>
  base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(partie) as { questions: string }).questions)) as {
    id: string
    bonne: number
    reponses: string[]
    enAvance?: object
  }[]

/**
 * Répond à une partie jusqu'à sa fin — une série ou une révision par la porte
 * des séries, une épreuve par la sienne (`porte`) ; `juste(i)` dit s'il
 * trouve la question i. Rend sa dernière réponse : c'est elle qui annonce.
 * `jusqua` : il s'arrête avant cette question, la partie encore en route ;
 * `depuis` : il la reprend là où il l'avait laissée.
 */
async function finir(
  banc: Banc,
  cookie: string,
  partie: { id?: string; error?: string },
  juste: (i: number) => boolean,
  { porte = 'serie', depuis = 0, jusqua = Infinity }: { porte?: 'serie' | 'epreuve'; depuis?: number; jusqua?: number } = {},
) {
  assert.ok(partie.id, partie.error)
  const questions = questionsDe(banc, partie.id)
  let fin: any = null
  for (let i = depuis; i < jusqua && !(porte === 'serie' ? fin?.finie : fin?.epreuve.finie); i++) {
    const q = questions[i]
    assert.ok(q, `la partie n’a pas fini à sa dernière question (${questions.length})`)
    const r = await poster(banc, cookie, `/api/campagne/${porte}/${partie.id}/reponse`, { index: i, choix: juste(i) ? q.bonne : (q.bonne + 1) % q.reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    fin = r.corps
  }
  return fin
}

const annonces = (fin: any): string[] => (fin.divins ?? []).map((d: any) => d.key).sort()

/**
 * Ce que tout Divin descendu doit à son joueur : son récit, à lui seul et à
 * part de ses trophées — et rien de lui sur son étagère, qui dirait la partie
 * où il est descendu.
 */
async function descendus(banc: Banc, cookie: string, fin: any, ...cles: string[]) {
  assert.deepEqual(annonces(fin), [...cles].sort())
  for (const d of fin.divins) assert.ok(d.legende.length > 0 && d.ton === 'eclat', `${d.key} : son récit, à lui seul`)
  assert.ok(!(fin.recompenses ?? []).some((r: any) => r.key.startsWith('dv:')), 'un Divin n’est pas un trophée')
  const moi = (await lire(banc, cookie, '/api/joueur/moi')).corps.profile
  assert.ok(!moi.vitrine.some((b: any) => b.key.startsWith('dv:')), 'l’étagère dirait la partie où il est descendu')
  assert.ok(!moi.hautsFaits.some((h: any) => h.key.startsWith('dv:')), 'ni case ni jauge parmi ses trophées')
}

// ── Écrire à la main ce qui précède ────────────────────────────────────────

/**
 * Une partie finie et ses réponses, écrites au journal : `[question, juste]`,
 * toutes à `quand`. Le journal des réponses les lit à sa lecture suivante,
 * comme celles d'un autre serveur.
 */
function ecrireUnePartie(banc: Banc, login: string, reponses: readonly [string, boolean][], quand: number, mode: 'serie' | 'revision' = 'serie') {
  const profil = idDe(banc, login)
  base(banc, db => {
    const partie = randomUUID()
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, '[]', ?, 0, ?, ?, ?, ?)`).run(
      partie,
      profil,
      reponses.length,
      reponses.filter(r => r[1]).length,
      quand - 60_000,
      quand,
      mode,
    )
    const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, 0, ?, ?)')
    db.transaction(() => reponses.forEach(([question, juste], i) => reponse.run(partie, i, question, juste ? 1 : 0, quand)))()
  })
}

/** Des bonnes réponses de campagne, à des questions inventées : elles ne pèsent que dans le compte de sa journée. */
const ecrireDesJustes = (banc: Banc, login: string, combien: number, quand: number, mode: 'serie' | 'revision' = 'serie') =>
  ecrireUnePartie(
    banc,
    login,
    Array.from({ length: combien }, (_, i): [string, boolean] => [`inventee-${i}`, true]),
    quand,
    mode,
  )

/** Une révision finie d'un jour d'avant : ses questions, ses bonnes réponses, et quand elle a commencé. */
function ecrireUneRevision(banc: Banc, login: string, questions: number, justes: number, commenceeLe: number) {
  const profil = idDe(banc, login)
  base(banc, db =>
    db
      .prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, ?, ?, 3, ?, ?, ?, 'revision')`)
      .run(
        randomUUID(),
        profil,
        JSON.stringify(Array.from({ length: questions }, (_, i) => ({ id: `q${i}`, texte: 't', reponses: ['a', 'b'], bonne: 0, categorie: 'Histoire', anecdote: null, niveau: 'facile', etape: 0 }))),
        questions,
        justes,
        commenceeLe,
        commenceeLe + 5 * 60_000,
      ),
  )
}

/** Des épreuves de sentier finies, en jeu : `[branche, palier, issue, l'instant de sa fin]`. */
function ecrireDesEpreuves(banc: Banc, login: string, epreuves: readonly [CleDeBranche, number, 'ratee' | 'validee', number][]) {
  const profil = idDe(banc, login)
  base(banc, db => {
    const ligne = db.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, branche, palier, seuil, rejeu, issue)
       VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'sentier', ?, ?, 10, 0, ?)`,
    )
    // Ratée à sa septième faute, sans une bonne réponse ; validée au seuil, dix sur seize.
    for (const [branche, palier, issue, finieLe] of epreuves) {
      ligne.run(randomUUID(), profil, issue === 'ratee' ? 7 : QUESTIONS_PAR_EPREUVE, issue === 'ratee' ? 0 : 10, finieLe - 60_000, finieLe, branche, palier, issue)
    }
  })
}

/** `n` épreuves ratées du même palier, de dix minutes en dix minutes à partir de `depuis`. */
const ratees = (branche: CleDeBranche, palier: number, n: number, depuis: number) =>
  Array.from({ length: n }, (_, i): [CleDeBranche, number, 'ratee', number] => [branche, palier, 'ratee', depuis + i * 10 * 60_000])

// ── 1. Le Démiurge ─────────────────────────────────────────────────────────

test('le Démiurge descend sur la série menée au bout de ses soixante questions sans une faute — ni à cinquante-neuf, ni sur une série plus courte', () =>
  // Soixante questions d'histoire, vingt de sport : une série de toutes les catégories va au bout de ses soixante, une série de sport en a vingt.
  avecBanc(baseDEssai(80, { categories: ['Histoire', 'Histoire', 'Histoire', 'Sport'] }), async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐻')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐙')

    // Léa : soixante sur soixante. Sa série tient aussi le fil d'Ariane — soixante d'affilée en font vingt-cinq —,
    // et les deux descendent ensemble, chacun son récit, rangés sous elle.
    const serieDeLea = await commencerSerie(banc, lea)
    assert.equal(serieDeLea.total, QUESTIONS_PAR_SERIE)
    const finDeLea = await finir(banc, lea, serieDeLea, () => true)
    assert.equal(finDeLea.justes, 60)
    await descendus(banc, lea, finDeLea, 'dv:demiurge', 'dv:ariane')
    assert.deepEqual(divinsRanges(banc, 'lea'), [`dv:ariane sous ${cleDeSerie(serieDeLea.id)}`, `dv:demiurge sous ${cleDeSerie(serieDeLea.id)}`])

    // Hugo : soixante questions lui aussi, une seule faute, à la trente et unième. Sa série va au bout — il lui
    // reste deux vies — : le fil d'Ariane, tenu trente questions, mais pas le Démiurge.
    const serieDHugo = await commencerSerie(banc, hugo)
    assert.equal(serieDHugo.total, QUESTIONS_PAR_SERIE)
    const finDHugo = await finir(banc, hugo, serieDHugo, i => i !== 30)
    assert.deepEqual([finDHugo.justes, finDHugo.vies], [59, 2])
    await descendus(banc, hugo, finDHugo, 'dv:ariane')
    assert.deepEqual(divinsRanges(banc, 'hugo'), [`dv:ariane sous ${cleDeSerie(serieDHugo.id)}`])

    // Zoé : une série de sport, menée au bout sans une faute — mais elle n'avait que vingt questions. Rien.
    const serieDeZoe = await commencerSerie(banc, zoe, ['Sport'])
    assert.equal(serieDeZoe.total, 20)
    const finDeZoe = await finir(banc, zoe, serieDeZoe, () => true)
    assert.deepEqual([finDeZoe.justes, finDeZoe.finie, finDeZoe.divins], [20, true, undefined])
    assert.deepEqual(divinsRanges(banc, 'zoe'), [])
  }))

// ── 2. Ariane ──────────────────────────────────────────────────────────────

test('Ariane descend sur vingt-cinq bonnes réponses d’affilée dans une série, pas sur deux suites de vingt-quatre — annoncée à sa fin, « Arrêter là » compris, rangée sans un mot quand une autre série la referme', () =>
  avecBanc(baseDEssai(120), async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐻')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐙')
    const ines = await inscrireProfil(banc.url, 'ines', 'Inès', '🐸')

    // Léa : vingt-cinq d'affilée, puis ses trois fautes.
    const serieDeLea = await commencerSerie(banc, lea)
    const finDeLea = await finir(banc, lea, serieDeLea, i => i < 25)
    assert.deepEqual([finDeLea.justes, finDeLea.vies], [25, 0])
    await descendus(banc, lea, finDeLea, 'dv:ariane')
    assert.deepEqual(divinsRanges(banc, 'lea'), [`dv:ariane sous ${cleDeSerie(serieDeLea.id)}`])

    // Hugo en trouve presque deux fois plus, mais lâche le fil à la vingt-cinquième : deux suites de vingt-quatre.
    const finDHugo = await finir(banc, hugo, await commencerSerie(banc, hugo), i => i !== 24 && i < 49)
    assert.deepEqual([finDHugo.justes, finDHugo.vies, finDHugo.divins], [48, 0, undefined])
    assert.deepEqual(divinsRanges(banc, 'hugo'), [])

    // Zoé tient le fil vingt-cinq questions, puis s'arrête là, ses trois vies en main : c'est une fin, qui l'annonce aussi.
    const serieDeZoe = await commencerSerie(banc, zoe)
    const enRoute = await finir(banc, zoe, serieDeZoe, () => true, { jusqua: 25 })
    assert.deepEqual([enRoute.justes, enRoute.finie, enRoute.divins], [25, false, undefined], 'rien avant sa fin')
    const arretee = await poster(banc, zoe, `/api/campagne/serie/${serieDeZoe.id}/abandon`)
    assert.equal(arretee.status, 200, arretee.corps.error)
    await descendus(banc, zoe, arretee.corps, 'dv:ariane')
    assert.deepEqual(divinsRanges(banc, 'zoe'), [`dv:ariane sous ${cleDeSerie(serieDeZoe.id)}`])

    // Inès de même, mais pose son téléphone : la série qu'elle commence ensuite referme la première, qui range
    // ce qu'elle avait fait descendre — sous elle, sans fin pour le dire. Et la suivante ne l'annonce pas à sa place.
    const laissee = await commencerSerie(banc, ines)
    await finir(banc, ines, laissee, () => true, { jusqua: 25 })
    assert.deepEqual(divinsRanges(banc, 'ines'), [])
    const suivante = await commencerSerie(banc, ines)
    assert.equal(suivante.divins, undefined)
    assert.deepEqual(divinsRanges(banc, 'ines'), [`dv:ariane sous ${cleDeSerie(laissee.id)}`])
    assert.equal((await finir(banc, ines, suivante, i => i < 25)).divins, undefined)
    assert.deepEqual(divinsRanges(banc, 'ines'), [`dv:ariane sous ${cleDeSerie(laissee.id)}`])
  }))

// ── 3. Mnémosyne ───────────────────────────────────────────────────────────

/** Vingt questions d'histoire, vingt de sport : de quoi remplir un carnet, et viser une révision courte. */
const BASE_DU_CARNET = baseDEssai(40, { categories: ['Histoire', 'Sport'] })
const duCarnet = (categorie: string, n: number) =>
  BASE_DU_CARNET.questions
    .filter(q => q.meta.categorie === categorie)
    .slice(0, n)
    .map((q): [string, boolean] => [q.id, false])

test('Mnémosyne descend sur la cinquième révision pleine sans faute d’affilée — une révision courte n’y compte ni ne casse rien, une seule faute parmi les cinq la retient', () =>
  avecBanc(BASE_DU_CARNET, async (banc, horloge) => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐻')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐙')
    const ilYA = (jours: number) => DEBUT - jours * JOUR

    // Léa : quatre révisions pleines sans faute ces derniers jours, et une courte au milieu, à moitié ratée.
    for (const jours of [5, 4, 3, 2]) ecrireUneRevision(banc, 'lea', QUESTIONS_PAR_REVISION, 10, ilYA(jours))
    ecrireUneRevision(banc, 'lea', 4, 2, ilYA(3.5))
    // Son carnet du jour : dix questions d'histoire et trois de sport, ratées hier.
    ecrireUnePartie(banc, 'lea', [...duCarnet('Histoire', 10), ...duCarnet('Sport', 3)], ilYA(1))
    // Elle revoit d'abord le sport, trois questions, et en rate une : une révision courte ne juge rien…
    const courte = await commencerRevision(banc, lea, { categories: ['Sport'] })
    assert.equal(courte.total, 3)
    const finCourte = await finir(banc, lea, courte, i => i !== 1)
    assert.deepEqual([finCourte.finie, finCourte.divins], [true, undefined])
    // … et ne casse rien : sa cinquième pleine, sans faute, la fait descendre.
    const pleine = await commencerRevision(banc, lea)
    assert.equal(pleine.total, QUESTIONS_PAR_REVISION)
    await descendus(banc, lea, await finir(banc, lea, pleine, () => true), 'dv:mnemosyne')
    assert.deepEqual(divinsRanges(banc, 'lea'), [`dv:mnemosyne sous ${cleDeSerie(pleine.id)}`])

    // Zoé : quatre sans faute, et une faute dans la cinquième — neuf sur dix.
    for (const jours of [5, 4, 3, 2]) ecrireUneRevision(banc, 'zoe', QUESTIONS_PAR_REVISION, 10, ilYA(jours))
    ecrireUnePartie(banc, 'zoe', duCarnet('Histoire', 10), ilYA(1))
    const finDeZoe = await finir(banc, zoe, await commencerRevision(banc, zoe), i => i !== 6)
    assert.deepEqual([finDeZoe.justes, finDeZoe.finie, finDeZoe.divins], [9, true, undefined])
    assert.deepEqual(divinsRanges(banc, 'zoe'), [])

    // Hugo : la plus ancienne de ses quatre était à neuf sur dix. Sa cinquième, sans faute, la compte encore
    // parmi les cinq dernières : rien.
    ecrireUneRevision(banc, 'hugo', QUESTIONS_PAR_REVISION, 9, ilYA(5))
    for (const jours of [4, 3, 2]) ecrireUneRevision(banc, 'hugo', QUESTIONS_PAR_REVISION, 10, ilYA(jours))
    ecrireUnePartie(banc, 'hugo', duCarnet('Histoire', 10), ilYA(1))
    const cinquieme = await finir(banc, hugo, await commencerRevision(banc, hugo), () => true)
    assert.deepEqual([cinquieme.justes, cinquieme.finie, cinquieme.divins], [10, true, undefined])
    assert.deepEqual(divinsRanges(banc, 'hugo'), [])
    // Trois jours plus tard, ses dix questions reviennent : cette sixième pousse la fautive hors des cinq dernières.
    horloge.t = DEBUT + 3 * JOUR
    const sixieme = await commencerRevision(banc, hugo)
    assert.equal(sixieme.total, QUESTIONS_PAR_REVISION)
    await descendus(banc, hugo, await finir(banc, hugo, sixieme, () => true), 'dv:mnemosyne')
    assert.deepEqual(divinsRanges(banc, 'hugo'), [`dv:mnemosyne sous ${cleDeSerie(sixieme.id)}`])
  }))

test('Mnémosyne ne compte que les révisions dues : cinq passes le même matin sur les mêmes dix questions ne la font pas descendre — et un « Revoir tout » entre deux ne casse rien', () =>
  // Le 21 novembre 2026 : toute révision de dix questions comptait, celles de « Revoir tout mon carnet » comprises.
  // Une révision due, puis quatre passes en avance sur les mêmes dix questions, réponses encore sous les yeux, et
  // elle descendait en deux minutes — quand le carnet lui-même tient une réponse en avance pour ne rien prouver.
  avecBanc(BASE_DU_CARNET, async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐻')
    const ilYA = (jours: number) => DEBUT - jours * JOUR
    const posees = (partie: string) =>
      questionsDe(banc, partie)
        .map(q => q.id)
        .sort()
    const enAvance = (partie: string) => questionsDe(banc, partie).filter(q => q.enAvance).length

    // Léa : dix questions ratées hier. Sa révision du matin, toutes dues, sans faute…
    ecrireUnePartie(banc, 'lea', duCarnet('Histoire', 10), ilYA(1))
    const due = await commencerRevision(banc, lea)
    assert.deepEqual([due.total, enAvance(due.id)], [QUESTIONS_PAR_REVISION, 0])
    assert.equal((await finir(banc, lea, due, () => true)).divins, undefined)
    // … puis quatre fois « Revoir tout mon carnet » : les mêmes dix, toutes en avance, quatre sans-faute de plus.
    for (let passe = 2; passe <= 5; passe++) {
      const revue = await commencerRevision(banc, lea, { tout: true })
      assert.deepEqual(posees(revue.id), posees(due.id), 'les mêmes dix questions')
      assert.equal(enAvance(revue.id), QUESTIONS_PAR_REVISION)
      const fin = await finir(banc, lea, revue, () => true)
      assert.deepEqual([fin.justes, fin.finie, fin.divins], [10, true, undefined], `sa passe ${passe}`)
    }
    assert.deepEqual(divinsRanges(banc, 'lea'), [])

    // Hugo : quatre révisions dues sans faute ces derniers jours. Ce matin, son carnet lui doit dix questions de
    // sport et trois d'histoire ; sept autres d'histoire, ratées cette nuit, ne reviennent que demain.
    for (const jours of [5, 4, 3, 2]) ecrireUneRevision(banc, 'hugo', QUESTIONS_PAR_REVISION, 10, ilYA(jours))
    ecrireUnePartie(banc, 'hugo', [...duCarnet('Sport', 10), ...duCarnet('Histoire', 3)], ilYA(1))
    ecrireUnePartie(banc, 'hugo', duCarnet('Histoire', 10).slice(3), MINUIT + HEURE)
    // Il revoit toute son histoire : trois dues, sept en avance — et une faute. Une seule question en avance
    // suffit : cette révision-là ne compte pas…
    const melee = await commencerRevision(banc, hugo, { tout: true, categories: ['Histoire'] })
    assert.deepEqual([melee.total, enAvance(melee.id)], [QUESTIONS_PAR_REVISION, 7])
    const finMelee = await finir(banc, hugo, melee, i => i !== 4)
    assert.deepEqual([finMelee.justes, finMelee.finie, finMelee.divins], [9, true, undefined])
    // … et sa faute ne casse rien : sa cinquième due, le sport, sans faute, la fait descendre.
    const cinquieme = await commencerRevision(banc, hugo)
    assert.deepEqual([cinquieme.total, enAvance(cinquieme.id)], [QUESTIONS_PAR_REVISION, 0])
    await descendus(banc, hugo, await finir(banc, hugo, cinquieme, () => true), 'dv:mnemosyne')
    assert.deepEqual(divinsRanges(banc, 'hugo'), [`dv:mnemosyne sous ${cleDeSerie(cinquieme.id)}`])
  }))

// ── 4. Héraclès ────────────────────────────────────────────────────────────

test('Héraclès descend sur la partie qui porte sa journée à mille bonnes réponses, tous modes ensemble — à 999, rien ; à cheval sur minuit, rien', () =>
  avecBanc(baseDEssai(120), async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐻')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐙')
    const ines = await inscrireProfil(banc.url, 'ines', 'Inès', '🐸')
    /** Une série : `justes` bonnes réponses, puis ses trois fautes. */
    const jouer = async (cookie: string, justes: number) => {
      const serie = await commencerSerie(banc, cookie)
      return { serie: serie.id as string, fin: await finir(banc, cookie, serie, i => i < justes) }
    }

    // Léa : 990 depuis minuit, à Paris — des séries et des révisions, qui comptent aussi. Sa série du matin en ajoute dix.
    ecrireDesJustes(banc, 'lea', 600, MINUIT + 30 * 60_000)
    ecrireDesJustes(banc, 'lea', 390, MINUIT + 2 * HEURE, 'revision')
    const deLea = await jouer(lea, 10)
    assert.equal(deLea.fin.justes, 10)
    await descendus(banc, lea, deLea.fin, 'dv:heracles')
    assert.deepEqual(divinsRanges(banc, 'lea'), [`dv:heracles sous ${cleDeSerie(deLea.serie)}`])

    // Hugo : 989, et dix de plus — 999 à la fin de sa série. Rien.
    ecrireDesJustes(banc, 'hugo', 989, MINUIT + 30 * 60_000)
    const presque = await jouer(hugo, 10)
    assert.deepEqual([presque.fin.justes, presque.fin.divins], [10, undefined])
    assert.deepEqual(divinsRanges(banc, 'hugo'), [])
    // Une série de plus, une seule bonne réponse : la millième. C'est cette partie-là qui le fait descendre.
    const millieme = await jouer(hugo, 1)
    await descendus(banc, hugo, millieme.fin, 'dv:heracles')
    assert.deepEqual(divinsRanges(banc, 'hugo'), [`dv:heracles sous ${cleDeSerie(millieme.serie)}`])

    // Zoé : 995 hier soir, jusqu'à 23 h 30 à Paris, et dix ce matin — 1 005 en douze heures, mais pas le même jour.
    ecrireDesJustes(banc, 'zoe', 995, MINUIT - 30 * 60_000)
    const deZoe = await jouer(zoe, 10)
    assert.deepEqual([deZoe.fin.justes, deZoe.fin.divins], [10, undefined])
    assert.deepEqual(divinsRanges(banc, 'zoe'), [])

    // Inès : 995, et sa millième tombe dans une épreuve de sentier — les mythologies posent de l'histoire. Toute
    // partie de la campagne juge sa journée à sa fin, pas la série seule.
    ecrireDesJustes(banc, 'ines', 995, MINUIT + 30 * 60_000)
    const epreuve = await finir(banc, ines, await commencerEpreuve(banc, ines, 'mythes', 1), i => i < 10, { porte: 'epreuve' })
    assert.deepEqual([epreuve.epreuve.justes, epreuve.epreuve.issue], [10, 'validee'])
    await descendus(banc, ines, epreuve, 'dv:heracles')
    assert.deepEqual(divinsRanges(banc, 'ines'), [`dv:heracles sous ${cleDeSerie(epreuve.epreuve.id)}`])
  }))

test('Héraclès se juge à sa plus grosse journée, quel que soit le jour de la fin : la millième d’une série laissée en route descend à la fin suivante — et deux jours ne s’additionnent pas', () =>
  // Le 21 novembre 2026 : sa journée ne se jugeait qu'au jour de la fin qui la lisait. Une série ne finit qu'à
  // sa troisième faute : qui posait son téléphone après sa millième bonne réponse n'avait aucune fin ce jour-là,
  // et celle du lendemain ne comptait plus que le lendemain — il ne descendait jamais.
  avecBanc(baseDEssai(120), async (banc, horloge) => {
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐨')
    const lola = await inscrireProfil(banc.url, 'lola', 'Lola', '🐼')

    // Tom : 995 depuis minuit, puis cinq bonnes réponses dans une série qu'il laisse en route. Mille ce jour-là,
    // et pas une fin pour le dire.
    ecrireDesJustes(banc, 'tom', 995, MINUIT + 30 * 60_000)
    const laissee = await finir(banc, tom, await commencerSerie(banc, tom), () => true, { jusqua: 5 })
    assert.deepEqual([laissee.justes, laissee.finie, laissee.divins], [5, false, undefined])
    assert.deepEqual(divinsRanges(banc, 'tom'), [])
    // Lola : 600 hier soir, 989 depuis minuit, et dix de plus dans sa série — 999 aujourd'hui, 1 599 en deux jours. Rien.
    ecrireDesJustes(banc, 'lola', 600, MINUIT - 30 * 60_000)
    ecrireDesJustes(banc, 'lola', 989, MINUIT + 30 * 60_000)
    const presque = await finir(banc, lola, await commencerSerie(banc, lola), i => i < 10)
    assert.deepEqual([presque.justes, presque.divins], [10, undefined])

    // Le lendemain, Tom commence une autre série. Celle d'hier se referme sans un mot — ce n'est pas une fin qu'il vit…
    horloge.t = DEBUT + JOUR
    const suivante = await commencerSerie(banc, tom)
    assert.deepEqual(divinsRanges(banc, 'tom'), [])
    // … et trois fautes d'entrée finissent celle-ci : pas une bonne réponse ce jour-ci, et c'est cette fin qui
    // lit sa journée d'hier. Il descend, rangé sous elle.
    const fin = await finir(banc, tom, suivante, () => false)
    assert.deepEqual([fin.justes, fin.finie], [0, true])
    await descendus(banc, tom, fin, 'dv:heracles')
    assert.deepEqual(divinsRanges(banc, 'tom'), [`dv:heracles sous ${cleDeSerie(suivante.id)}`])
    // Lola rejoue aussi, une bonne réponse : la millième, si hier et aujourd'hui s'ajoutaient. Sa plus grosse journée reste à 999.
    const lendemain = await finir(banc, lola, await commencerSerie(banc, lola), i => i < 1)
    assert.deepEqual([lendemain.justes, lendemain.finie, lendemain.divins], [1, true, undefined])
    assert.deepEqual(divinsRanges(banc, 'lola'), [])
  }))

// ── 5. Sisyphe ─────────────────────────────────────────────────────────────

test('Sisyphe descend sur le palier validé en jeu après onze échecs le même jour — ni dix sur ce palier, ni onze la veille, ni en le rejouant', () =>
  avecBanc(baseDEssai(240, { categories: ['Nature', 'Sport'] }), async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐻')
    const ines = await inscrireProfil(banc.url, 'ines', 'Inès', '🐸')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐙')
    const leo = await inscrireProfil(banc.url, 'leo', 'Léo', '🐼')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐨')
    /** Joue le palier jusqu'au bout : dix bonnes réponses — le seuil —, puis des fautes. */
    const valider = async (cookie: string, branche: CleDeBranche, palier: number) => {
      const fin = await finir(banc, cookie, await commencerEpreuve(banc, cookie, branche, palier), i => i < 10, { porte: 'epreuve' })
      assert.equal(fin.epreuve.issue, 'validee')
      return fin
    }
    const dixMinutes = MINUIT + 10 * 60_000

    // Léa : onze fois le premier palier de la forêt lui a échappé depuis minuit. Il lui reste une vie.
    ecrireDesEpreuves(banc, 'lea', ratees('foret', 1, 11, dixMinutes))
    assert.equal((await lire(banc, lea, '/api/joueur/moi?accueil')).corps.profile.campagne.vies, VIES_PAR_JOUR - 11, 'ce sont ces échecs-là qui ont coûté ses vies')
    const finDeLea = await valider(lea, 'foret', 1)
    assert.equal(finDeLea.epreuve.rejeu, false)
    await descendus(banc, lea, finDeLea, 'dv:sisyphe')
    assert.deepEqual(divinsRanges(banc, 'lea'), [`dv:sisyphe sous ${cleDeSerie(finDeLea.epreuve.id)}`])

    // Hugo : onze échecs aussi, mais un sur le premier palier — validé depuis — et dix sur le deuxième, qu'il valide.
    ecrireDesEpreuves(banc, 'hugo', [...ratees('foret', 1, 1, MINUIT + 60_000), ['foret', 1, 'validee', MINUIT + 5 * 60_000], ...ratees('foret', 2, 10, dixMinutes)])
    const finDHugo = await valider(hugo, 'foret', 2)
    assert.deepEqual([finDHugo.epreuve.rejeu, finDHugo.divins], [false, undefined])

    // Inès : dix sur le premier palier de la forêt, le onzième sur celui du stade — le même numéro, un autre rocher.
    ecrireDesEpreuves(banc, 'ines', [...ratees('foret', 1, 10, dixMinutes), ...ratees('stade', 1, 1, MINUIT + 3 * HEURE)])
    const finDInes = await valider(ines, 'foret', 1)
    assert.deepEqual([finDInes.epreuve.rejeu, finDInes.divins], [false, undefined])

    // Zoé : ses onze échecs sont d'hier — le dernier à 23 h 50, à Paris. Ses vies sont revenues, le compte aussi.
    ecrireDesEpreuves(banc, 'zoe', ratees('foret', 1, 11, MINUIT - 110 * 60_000))
    const finDeZoe = await valider(zoe, 'foret', 1)
    assert.deepEqual([finDeZoe.epreuve.rejeu, finDeZoe.divins], [false, undefined])

    // Léo : onze échecs ce matin, puis le palier validé — sur un autre serveur, disons, qui n'aurait rien rangé.
    // Le rejouer ne risque rien : un rejeu validé ne le fait pas descendre.
    ecrireDesEpreuves(banc, 'leo', [...ratees('foret', 1, 11, dixMinutes), ['foret', 1, 'validee', MINUIT + 3 * HEURE]])
    const finDeLeo = await valider(leo, 'foret', 1)
    assert.deepEqual([finDeLeo.epreuve.rejeu, finDeLeo.divins], [true, undefined])

    for (const login of ['hugo', 'ines', 'zoe', 'leo']) assert.deepEqual(divinsRanges(banc, login), [], login)

    // Tom : onze échecs, puis ses dix bonnes réponses — le palier est validé — et « Arrêter là » sans jouer les
    // six questions qui restent. C'est une fin d'épreuve comme l'autre : elle l'annonce.
    ecrireDesEpreuves(banc, 'tom', ratees('foret', 1, 11, dixMinutes))
    const auSeuil = await finir(banc, tom, await commencerEpreuve(banc, tom, 'foret', 1), () => true, { porte: 'epreuve', jusqua: 10 })
    assert.deepEqual([auSeuil.epreuve.issue, auSeuil.epreuve.finie, auSeuil.divins], ['validee', false, undefined], 'validé, mais pas fini : rien encore')
    const arretee = await poster(banc, tom, `/api/campagne/epreuve/${auSeuil.epreuve.id}/abandon`)
    assert.equal(arretee.status, 200, arretee.corps.error)
    await descendus(banc, tom, arretee.corps.fin, 'dv:sisyphe')
    assert.deepEqual(divinsRanges(banc, 'tom'), [`dv:sisyphe sous ${cleDeSerie(auSeuil.epreuve.id)}`])
  }))

test('Sisyphe compte ses échecs au jour où l’épreuve validée a commencé : prise à 23 h 50 après onze échecs et finie passé minuit, elle le fait descendre — prise après minuit, non', () =>
  // Le 21 novembre 2026 : ses échecs se comptaient au jour de la FIN de l'épreuve. Validée à 23 h 58 avec la
  // dernière vie du jour, finie à 0 h 02, elle cherchait ses onze échecs dans une journée qui venait de commencer.
  avecBanc(baseDEssai(240, { categories: ['Nature', 'Sport'] }), async (banc, horloge) => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐻')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐙')
    const minuitSuivant = MINUIT + JOUR
    // Tous trois : onze fois le premier palier de la forêt leur a échappé dans la journée.
    for (const login of ['lea', 'hugo', 'zoe']) ecrireDesEpreuves(banc, login, ratees('foret', 1, 11, MINUIT + 10 * 60_000))

    // 23 h 50 : Léa et Hugo prennent leur dernière vie du jour.
    horloge.t = minuitSuivant - 10 * 60_000
    const deLea = await commencerEpreuve(banc, lea, 'foret', 1)
    const dHugo = await commencerEpreuve(banc, hugo, 'foret', 1)
    assert.deepEqual([deLea.rejeu, dHugo.rejeu], [false, false])
    // 23 h 58 : Léa atteint le seuil — validé, pas fini.
    horloge.t = minuitSuivant - 2 * 60_000
    const auSeuil = await finir(banc, lea, deLea, () => true, { porte: 'epreuve', jusqua: 10 })
    assert.deepEqual([auSeuil.epreuve.issue, auSeuil.epreuve.finie, auSeuil.divins], ['validee', false, undefined])

    // 0 h 02 : ses six dernières questions tombent le lendemain. Ses onze échecs sont du jour où elle a commencé.
    horloge.t = minuitSuivant + 2 * 60_000
    const finDeLea = await finir(banc, lea, deLea, () => false, { porte: 'epreuve', depuis: 10 })
    assert.deepEqual([finDeLea.epreuve.issue, finDeLea.epreuve.finie, finDeLea.epreuve.justes], ['validee', true, 10])
    await descendus(banc, lea, finDeLea, 'dv:sisyphe')
    assert.deepEqual(divinsRanges(banc, 'lea'), [`dv:sisyphe sous ${cleDeSerie(deLea.id)}`])
    // Hugo n'a répondu à rien avant minuit : le seuil même tombe le lendemain. C'est toujours la vie de la veille qu'il joue.
    const finDHugo = await finir(banc, hugo, dHugo, i => i < 10, { porte: 'epreuve' })
    assert.equal(finDHugo.epreuve.issue, 'validee')
    await descendus(banc, hugo, finDHugo, 'dv:sisyphe')
    assert.deepEqual(divinsRanges(banc, 'hugo'), [`dv:sisyphe sous ${cleDeSerie(dHugo.id)}`])

    // Zoé, les mêmes onze échecs, ne s'y remet qu'à 0 h 02 : ses vies sont revenues, et c'est une autre journée.
    const finDeZoe = await finir(banc, zoe, await commencerEpreuve(banc, zoe, 'foret', 1), i => i < 10, { porte: 'epreuve' })
    assert.deepEqual([finDeZoe.epreuve.issue, finDeZoe.epreuve.rejeu, finDeZoe.divins], ['validee', false, undefined])
    assert.deepEqual(divinsRanges(banc, 'zoe'), [])
  }))

// ── 6. Il ne redescend pas ─────────────────────────────────────────────────

test('descendue une fois, Ariane ne redescend pas : l’exploit refait ne l’annonce plus, et son étagère n’en garde qu’une ligne', () =>
  avecBanc(baseDEssai(120), async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const premiere = await commencerSerie(banc, lea)
    await descendus(banc, lea, await finir(banc, lea, premiere, i => i < 25), 'dv:ariane')

    // La même suite dans une deuxième série : sa règle est tenue de nouveau, rien ne s'annonce.
    const deuxieme = await finir(banc, lea, await commencerSerie(banc, lea), i => i < 25)
    assert.deepEqual([deuxieme.justes, deuxieme.divins], [25, undefined])
    assert.deepEqual(divinsRanges(banc, 'lea'), [`dv:ariane sous ${cleDeSerie(premiere.id)}`])

    // Une troisième, soixante sur soixante : le Démiurge descend, lui, pour la première fois — seul. Ariane,
    // que cette série tient aussi, reste rangée sous la première.
    const troisieme = await commencerSerie(banc, lea)
    await descendus(banc, lea, await finir(banc, lea, troisieme, () => true), 'dv:demiurge')
    assert.deepEqual(divinsRanges(banc, 'lea'), [`dv:ariane sous ${cleDeSerie(premiere.id)}`, `dv:demiurge sous ${cleDeSerie(troisieme.id)}`])
  }))
