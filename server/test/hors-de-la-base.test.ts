// Ce qui, au journal des réponses de la campagne, n'est pas une question de
// la base — un rébus de l'expédition, une frise, tout ce que le Cabinet de
// curiosités tire d'ailleurs — se lit dans une seule liste
// (`PREFIXES_HORS_DE_LA_BASE`, `shared/horsDeLaBase.ts`, la conception du
// Cabinet, D5). Le carnet du journal, le même en SQL et le signalement
// recopiaient chacun leurs préfixes : le Cabinet en apportait un troisième,
// et trois oublis possibles. Oublié des deux côtés du carnet, que
// `journal-des-reponses.test.ts` compare, il ne se serait pas vu — une pièce
// du Cabinet ratée entrait au carnet, et « À revoir », sur l'accueil, la
// comptait chaque jour sans qu'aucune révision ne puisse la reposer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { lireQuestionDeLaBase } from '../src/core/baseCampagne'
import { PREFIXES_HORS_DE_LA_BASE, REFUS_DU_SIGNALEMENT, horsDeLaBase, refusDuSignalement, sqlDansLaBase } from '../../shared/horsDeLaBase'
import { PREFIXE_DU_REBUS } from '../../shared/curiosites'
import { PREFIXE_DE_LA_FRISE } from '../../shared/frise'
import {
  PREFIXE_DU_CABINET,
  idDeLEclair,
  idDeLaFiche,
  idDeLaFriseATheme,
  idDeLaFriseDeSujet,
  idDeLaReplique,
  idDuLieu,
  idDuTableau,
  type PieceDuCabinet,
} from '../../shared/cabinet/pieces'

/** Chaque sorte d'identifiant qu'un jeu du Cabinet donne à ce qu'il ne tire pas de la base. */
const DU_CABINET = [
  idDuLieu('orleans-siege'),
  idDeLaFiche('victor-hugo'),
  idDeLaReplique('hotel-du-nord'),
  idDuTableau('Q12418'),
  idDeLEclair(['adcmb60c', 'b2kq81zz', 'c0000001', 'd0000002', 'e0000003']),
  idDeLaFriseATheme('grands-sieges', 2),
  idDeLaFriseDeSujet(['adcmb60c', 'b2kq81zz']),
]
/** Ce qui n'est pas de la base, d'où qu'il vienne. */
const HORS_DE_LA_BASE = [`${PREFIXE_DU_REBUS}portefeuille`, `${PREFIXE_DE_LA_FRISE}adcmb60c+b2kq81zz+c0000001+d0000002`, ...DU_CABINET]
/** Des questions de la base : huit lettres et chiffres (`lireQuestionDeLaBase`), celles du banc comprises. */
const DE_LA_BASE = ['adcmb60c', 'essai000', 'rebus000', 'frise123', 'cabinet1', 'cab00001']

test('une seule liste : le rébus, la frise et le Cabinet, chacun sa phrase au signalement — celles d’avant mot pour mot', () => {
  assert.deepEqual([...PREFIXES_HORS_DE_LA_BASE], [PREFIXE_DU_REBUS, PREFIXE_DE_LA_FRISE, PREFIXE_DU_CABINET])
  assert.deepEqual(Object.keys(REFUS_DU_SIGNALEMENT).sort(), [...PREFIXES_HORS_DE_LA_BASE].sort(), 'chaque préfixe a sa phrase, et rien qu’eux')
  assert.equal(REFUS_DU_SIGNALEMENT[PREFIXE_DU_REBUS], 'Un rébus ne se signale pas : seules les questions de la campagne le peuvent')
  assert.equal(REFUS_DU_SIGNALEMENT[PREFIXE_DE_LA_FRISE], 'Une frise ne se signale pas : seules les questions de la campagne le peuvent')
  assert.equal(REFUS_DU_SIGNALEMENT[PREFIXE_DU_CABINET], 'Ce jeu du Cabinet ne se signale pas : seules les questions de la campagne le peuvent')

  for (const id of HORS_DE_LA_BASE) assert.equal(horsDeLaBase(id), true, id)
  for (const id of DE_LA_BASE) assert.equal(horsDeLaBase(id), false, id)
  assert.equal(refusDuSignalement(`${PREFIXE_DU_REBUS}portefeuille`), REFUS_DU_SIGNALEMENT[PREFIXE_DU_REBUS])
  for (const id of DU_CABINET) assert.equal(refusDuSignalement(id), REFUS_DU_SIGNALEMENT[PREFIXE_DU_CABINET], id)
  for (const id of DE_LA_BASE) assert.equal(refusDuSignalement(id), null, id)
  // Une clé du prototype n'est pas un préfixe : la table ne se lit que par le préfixe trouvé.
  assert.equal(refusDuSignalement('constructor'), null)
})

test('le même partage en SQL qu’en mémoire ; un préfixe s’y écrit tel quel, et aucune question de la base ne peut le porter', () => {
  for (const p of PREFIXES_HORS_DE_LA_BASE) {
    // Ni guillemet ni joker de LIKE (`%`, `_`) : le préfixe s'écrit dans le texte de la requête, et y vaut lui-même.
    assert.match(p, /^[a-z]+:$/, `« ${p} » : des minuscules et un deux-points`)
    // LIKE ignore la casse, `startsWith` non : sans conséquence tant qu'aucun identifiant de la base n'a de deux-points.
    const lu = lireQuestionDeLaBase({ id: `${p}a1b2c3` })
    assert.ok('refus' in lu && lu.refus.startsWith('identifiant invalide'), `« ${p} » ne peut être l’identifiant d’une question de la base`)
    // Aucun n'en commence un autre : la phrase d'un refus ne dépend pas de l'ordre de la liste.
    for (const q of PREFIXES_HORS_DE_LA_BASE) if (q !== p) assert.ok(!q.startsWith(p), `« ${q} » commence par « ${p} »`)
  }
  const db = new Database(':memory:')
  try {
    db.exec('CREATE TABLE r (reserve_id TEXT NOT NULL)')
    const inserer = db.prepare('INSERT INTO r VALUES (?)')
    const tous = [...HORS_DE_LA_BASE, ...DE_LA_BASE, ...HORS_DE_LA_BASE.map(id => id.toUpperCase()), 'xcab:lieu:a', 'rebus', 'cab', '']
    for (const id of tous) inserer.run(id)
    const enSql = (db.prepare(`SELECT reserve_id FROM r WHERE ${sqlDansLaBase('reserve_id')}`).all() as { reserve_id: string }[]).map(l => l.reserve_id)
    // La seule différence : la casse, que LIKE ignore.
    assert.deepEqual(enSql, tous.filter(id => !horsDeLaBase(id.toLowerCase())))
    assert.deepEqual(
      enSql.filter(id => id === id.toLowerCase()),
      tous.filter(id => id === id.toLowerCase() && !horsDeLaBase(id)),
      'en minuscules — les identifiants que le code pose, ceux de la base comme les préfixes —, le même partage',
    )
  } finally {
    db.close()
  }
})

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sources = (dossier: string) =>
  readdirSync(path.join(RACINE, dossier), { recursive: true, encoding: 'utf8' })
    .filter(f => f.endsWith('.ts') && !f.includes('node_modules'))
    .map(f => path.join(dossier, f))

test('personne ne recopie la liste : ni un filtre SQL sur un préfixe, ni une phrase de refus, ailleurs que dans shared/horsDeLaBase.ts', () => {
  const fichiers = [...sources('server/src'), ...sources('shared')].filter(f => f !== path.join('shared', 'horsDeLaBase.ts'))
  assert.ok(fichiers.length > 100, `${fichiers.length} fichiers relus`)
  // Un préfixe de la liste, par sa constante ou en toutes lettres ; les autres préfixes du dépôt (la réserve des légendaires…) ne la concernent pas.
  const filtre = /LIKE '(\$\{(PREFIXE_DU_REBUS|PREFIXE_DE_LA_FRISE|PREFIXE_DU_CABINET)\}|rebus:|frise:|cab:)/
  const refus = /['"`][^'"`\n]*ne se signale pas/
  const recopies: string[] = []
  for (const f of fichiers) {
    readFileSync(path.join(RACINE, f), 'utf8')
      .split('\n')
      .forEach((ligne, i) => {
        if (filtre.test(ligne)) recopies.push(`${f}:${i + 1} — un filtre sur un préfixe passe par sqlDansLaBase`)
        if (refus.test(ligne)) recopies.push(`${f}:${i + 1} — un refus de signalement vit dans REFUS_DU_SIGNALEMENT`)
      })
  }
  assert.deepEqual(recopies, [])
  // Les trois lecteurs la lisent.
  for (const f of ['server/src/core/journalDesReponses.ts', 'server/src/core/campagne.ts']) {
    assert.match(readFileSync(path.join(RACINE, f), 'utf8'), /from '\.\.\/\.\.\/\.\.\/shared\/horsDeLaBase'/, `${f} lit shared/horsDeLaBase.ts`)
  }
})

// ── Par les routes ─────────────────────────────────────────────────────────

/** Mercredi 21 octobre 2026, 10 h à Paris : un jour sans fête. */
const MERCREDI = Date.UTC(2026, 9, 21, 8)
const MINUTE = 60_000
const JOUR = 24 * 60 * MINUTE

type Reponse<T = any> = { status: number; corps: T }
const lire = <T = any>(banc: Banc, cookie: string, chemin: string): Promise<Reponse<T>> =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const poster = <T = any>(banc: Banc, cookie: string, chemin: string, corps: unknown = {}): Promise<Reponse<T>> =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as T }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/** Une pièce telle que sa partie la garde : le cœur d'une question de série, et d'où elle vient. */
const piece = (p: Omit<PieceDuCabinet, 'texte' | 'reponses' | 'bonne' | 'categorie' | 'anecdote' | 'niveau'> & Partial<PieceDuCabinet>): PieceDuCabinet => ({
  texte: 'Où se trouve la place Stanislas ?',
  reponses: ['Nancy (Meurthe-et-Moselle), 1755'],
  bonne: 0,
  categorie: 'Histoire',
  anecdote: null,
  niveau: 'moyen',
  ...p,
})

test('une pièce du Cabinet ratée n’entre pas au carnet, et ne se signale pas — sa question de la base, si', async () => {
  const horloge = { t: MERCREDI }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(40) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id)

    // Une partie du Cabinet, écrite comme le Cabinet l'écrira : trois manches ratées — une question de la base posée au Pari,
    // cinq affirmations de l'Éclair, un lieu de l'Épingle.
    const pieces = [
      piece({
        id: 'essai000',
        texte: "Question d'essai numéro 0 : laquelle est la bonne ?",
        reponses: ['Autre A0', 'Bonne 0', 'Autre B0', 'Autre C0'],
        bonne: 1,
        anecdote: "L'anecdote de la question 0.",
        niveau: 'facile',
        forme: 'pari',
        cabinet: { jeu: 'pari', manche: 0, tirage: 0, etape: 1 },
      }),
      piece({
        id: idDeLEclair(['essai001', 'essai002', 'essai003', 'essai004', 'essai005']),
        texte: 'Cinq affirmations d’Histoire : vraies ou fausses ?',
        reponses: ['Vrai, faux, faux, vrai, faux'],
        forme: 'eclair',
        cabinet: { jeu: 'eclair', manche: 1, tirage: 1 },
      }),
      piece({ id: idDuLieu('place-stanislas'), forme: 'epingle', cabinet: { jeu: 'epingle', manche: 2, tirage: 2 } }),
    ]
    base(banc, db => {
      db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, issue)
         VALUES ('cab-ratee', ?, ?, 3, 0, 0, ?, ?, 'cabinet', 'manquee')`,
      ).run(id, JSON.stringify(pieces), horloge.t, horloge.t + 3 * MINUTE)
      const reponse = db.prepare(`INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, forme) VALUES ('cab-ratee', ?, ?, -1, 0, ?, ?)`)
      pieces.forEach((p, i) => reponse.run(i, p.id, horloge.t + (i + 1) * MINUTE, p.forme ?? null))
    })

    // Le lendemain, seule la question de la base est à revoir — sur l'accueil comme dans le carnet.
    horloge.t += JOUR
    const accueil = (await lire(banc, lea, '/api/joueur/moi?accueil')).corps.profile.campagne
    assert.equal(accueil.aRevoir, 1, 'l’accueil ne compte que la question de la base')
    assert.equal((await lire(banc, lea, '/api/campagne/carnet')).corps.aRevoir, 1, 'le carnet non plus')
    const revision = await poster(banc, lea, '/api/campagne/revision')
    assert.equal(revision.status, 200, revision.corps.error)
    assert.deepEqual([revision.corps.total, revision.corps.question.texte], [1, pieces[0].texte], 'la révision repose la question du Pari, et elle seule')

    // Le signalement : la question de la base, oui ; ce que le Cabinet a tiré d'ailleurs, non, et il le dit.
    for (const index of [1, 2]) {
      const refuse = await poster(banc, lea, '/api/campagne/serie/cab-ratee/signalement', { index, texte: 'Ce n’est pas la bonne réponse' })
      assert.deepEqual([refuse.status, refuse.corps.error], [400, 'Ce jeu du Cabinet ne se signale pas : seules les questions de la campagne le peuvent'], `la manche ${index + 1}`)
    }
    const signalee = await poster(banc, lea, '/api/campagne/serie/cab-ratee/signalement', { index: 0, texte: 'La réponse A se défend aussi' })
    assert.equal(signalee.status, 200, signalee.corps.error)
    assert.deepEqual(
      base(banc, db => db.prepare('SELECT question_id FROM campagne_signalements').all()),
      [{ question_id: 'essai000' }],
      'seule la question de la base est signalée',
    )
  } finally {
    await banc.close()
  }
})
