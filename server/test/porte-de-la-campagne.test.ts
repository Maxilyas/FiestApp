// La porte de la campagne (`core/porteDeLaCampagne.ts`) : le seul passage du
// Cabinet de curiosités vers `CampagneStore`, éprouvé sur le magasin même.
//
// Ses pièges se payaient sans un bruit : une porte qui écrivait une réponse
// sans `vuAilleurs` laissait l'expédition en route reposer, comme jamais vue,
// la question tout juste vue ; sans `reponseEcrite`, une lecture du journal
// partie avant elle passait pour fraîche ; un aller-retour de plus au réveil,
// c'est 30 à 225 ms avant que le port s'ouvre, sept réveils par jour. On compte
// comme `expedition-charge.test.ts` : chaque `execute` et chaque `batch` sur le
// fichier `file:` qui tient lieu de Turso est un aller-retour.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import type { InStatement, InValue } from '@libsql/client'
import { CampagneStore, type RecompensesDeCampagne } from '../src/core/campagne'
import { REVEIL_DU_CABINET, SECRET_DU_CABINET } from '../src/core/cabinet/tables'
import type { FinDUnePartie, StatsDuCabinet, StatsEnPlus } from '../src/core/porteDeLaCampagne'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { cleDeSerie } from '../src/auth/profiles'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { xpDeLaBonneReponse, xpDuJourDeCampagne } from '../../shared/campagne'
import type { VueDeLExpedition } from '../../shared/expedition'
import type { StatsDeCampagne } from '../../shared/profil'

// ── Le compteur ───────────────────────────────────────────────────────────

/** Ce que la base permanente a servi pendant une mesure : ses allers-retours, et le SQL de chacun. */
const compte = { actif: false, appels: 0, lots: [] as string[][] }

const texteDe = (s: unknown) => (typeof s === 'string' ? s : String((s as { sql: string }).sql))
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    if (compte.actif) {
      compte.appels++
      compte.lots.push(methode === 'batch' ? (args[0] as unknown[]).map(texteDe) : [texteDe(args[0])])
    }
    return origine.apply(this, args)
  }
}

async function mesurer<T>(travail: () => Promise<T>): Promise<{ appels: number; lots: string[][]; resultat: T }> {
  Object.assign(compte, { actif: true, appels: 0, lots: [] })
  try {
    const resultat = await travail()
    return { appels: compte.appels, lots: compte.lots, resultat }
  } finally {
    compte.actif = false
  }
}

// ── Le banc : le magasin seul, sur des bases jetables ────────────────────

/** Une question d'essai de la catégorie et de la difficulté qu'on veut : 2 facile, 3 moyenne, 4 difficile. */
function question(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `prte${String(i).padStart(4, '0')}`,
    texte: `Question d'essai numéro ${i} de la porte du Cabinet : laquelle est la bonne ?`,
    reponses: [`Bonne ${i}`, ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de la question ${i}.`,
    categorie,
    sousTheme: SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: autres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${i} : ${lu.refus}`)
  return lu.question
}

/** Huit questions de chaque marche dans chacune des douze catégories : de quoi partir en expédition. */
const BASE = new BaseDeLaCampagne(CATEGORIES.flatMap((c, k) => [2, 3, 4].flatMap((d, m) => Array.from({ length: 8 }, (_, i) => question(k * 100 + m * 10 + i, c, d)))))

/** Mercredi 21 octobre 2026, 10 h à Paris : l'horloge ne bouge pas, rien ne se relit en fond pendant qu'on compte. */
const MAINTENANT = Date.UTC(2026, 9, 21, 8, 0)
const QUI = 'profil-du-cabinet'

const dossier = mkdtempSync(path.join(tmpdir(), 'quizz-porte-'))
const fichier = (nom: string) => path.join(dossier, nom)
const adresse = (nom: string) => `file:${fichier(nom).replace(/\\/g, '/')}`
const ouverts: CampagneStore[] = []

function magasin(nom: string, opts: ConstructorParameters<typeof CampagneStore>[2] = {}): CampagneStore {
  const c = new CampagneStore(adresse(nom), undefined, { base: BASE, maintenant: () => MAINTENANT, ...opts })
  ouverts.push(c)
  return c
}

after(() => {
  for (const c of ouverts) c.close()
  rmSync(dossier, { recursive: true, force: true })
})

function lire<T>(nom: string, sql: string, ...args: unknown[]): T[] {
  const db = new Database(fichier(nom), { readonly: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}

/** Une partie du Cabinet telle que son départ l'écrirait, dix minutes avant l'heure de son magasin : une ligne de `campagne_series`, sans pièce encore. */
function partie(c: CampagneStore, id: string) {
  return c.porte().client.execute({
    sql: `INSERT INTO campagne_series (id, profile_id, mode, commencee_le, questions, position, vies, justes, cabinet) VALUES (?, ?, 'cabinet', ?, '[]', 0, 0, 0, '{}')`,
    args: [id, QUI, c.porte().maintenant() - 10 * 60_000],
  })
}

/** Une condition SQL et ses valeurs, à poser au bout d'un `WHERE`. */
type Garde = { sql: string; args: InValue[] }

/**
 * La garde d'un lot du Cabinet (D9), telle que son magasin l'écrira : le geste au rang qu'il croit suivre, que la base
 * ne prend qu'une fois (`ON CONFLICT DO NOTHING`), et chaque autre instruction du lot sous lui, par son `uid`. Le
 * même rang déjà pris — l'autre serveur d'une mise en ligne, un double toucher —, le lot n'écrit rien.
 */
function geste(serie: string, rang: number, uid: string): { ecrire: InStatement; sousLui: Garde } {
  return {
    ecrire: {
      sql: `INSERT INTO cabinet_gestes (serie_id, rang, geste, fait_le, uid) VALUES (?, ?, '{"quoi":"repondre","manche":2}', ?, ?) ON CONFLICT (serie_id, rang) DO NOTHING`,
      args: [serie, rang, MAINTENANT, uid],
    },
    sousLui: { sql: 'EXISTS (SELECT 1 FROM cabinet_gestes WHERE serie_id = ? AND rang = ? AND uid = ?)', args: [serie, rang, uid] },
  }
}

/** La fin d'une partie dont le lot commence par son geste : écrite si la base a pris le geste. */
const ecriteSiLeGestePasse: FinDUnePartie['ecrite'] = ([geste]) => geste.rowsAffected === 1

/** Ce qu'une pièce jugée écrit, comme le lot d'un geste du Cabinet : sa réponse, et la pièce au bout de la partie — sous le geste qui garde le lot. */
function piece(c: CampagneStore, serie: string, position: number, q: QuestionDeLaBase, juste: boolean, le: number, garde: Garde = { sql: '1', args: [] }): InStatement[] {
  const gardee = { id: q.id, texte: q.texte, reponses: q.reponses, bonne: q.bonne, categorie: q.meta.categorie, anecdote: q.anecdote, niveau: 'moyen', forme: 'pari' }
  return [
    {
      sql: `INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon, forme) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${garde.sql}`,
      args: [serie, position, q.id, juste ? q.bonne : (q.bonne + 1) % 4, juste ? 1 : 0, le, c.porte().compagnonDeLaNiche(QUI), 'pari', ...garde.args],
    },
    {
      sql: `UPDATE campagne_series SET questions = json_insert(questions, '$[#]', json(?)), position = position + 1, justes = justes + ? WHERE id = ? AND ${garde.sql}`,
      args: [JSON.stringify(gardee), juste ? 1 : 0, serie, ...garde.args],
    },
  ]
}

/** Ce que le serveur dit à son journal (`console.error`) pendant ce travail, qui le lit en route : un pas tombé ne se tait pas. */
async function enEcoutantLeJournal<T>(travail: (dits: readonly string[]) => Promise<T>): Promise<{ resultat: T; dits: string[] }> {
  const dits: string[] = []
  const erreur = console.error
  console.error = (...args: unknown[]) => void dits.push(args.map(String).join(' '))
  try {
    return { resultat: await travail(dits), dits }
  } finally {
    console.error = erreur
  }
}

/** Ce que le Cabinet tire de ses œuvres pour L'Explorateur : ses salles complètes, son seul champ (`ChampsDuCabinet`). */
const sesSalles = (n: number): StatsDuCabinet => ({ salles: n })
const sallesDe = (stats: StatsDeCampagne) => stats.salles

// ── Le réveil ─────────────────────────────────────────────────────────────

/** Les `ALTER` qu'un réveil a envoyés : une colonne ajoutée, un aller-retour chacun. */
const altersDe = (m: { lots: string[][] }) => m.lots.flat().filter(s => /^ALTER TABLE/.test(s))

test('le Cabinet naît dans le premier lot de la campagne : pas un aller-retour de plus au réveil', async () => {
  // Une base neuve : la colonne du départ figé s'y ajoute, une fois — un `ALTER`, au premier réveil seulement.
  const neuve = await mesurer(() => magasin('reveil-avec.db').init(REVEIL_DU_CABINET))
  const neuveSans = await mesurer(() => magasin('reveil-sans.db').init())
  assert.equal(neuve.appels, neuveSans.appels + 1, `${neuve.appels} allers-retours au premier réveil, ${neuveSans.appels} sans le Cabinet`)
  assert.deepEqual(
    altersDe(neuve).filter(s => !altersDe(neuveSans).includes(s)),
    ['ALTER TABLE campagne_series ADD COLUMN cabinet TEXT'],
    'ce que le Cabinet ajoute au premier réveil : sa seule colonne',
  )

  // Le réveil ordinaire, sur une base qui a déjà tout : autant qu'avant le Cabinet.
  const avec = await mesurer(() => magasin('reveil-avec.db').init(REVEIL_DU_CABINET))
  const sans = await mesurer(() => magasin('reveil-sans.db').init())
  assert.equal(avec.appels, sans.appels, `${avec.appels} allers-retours au réveil avec le Cabinet, ${sans.appels} sans`)

  // Tout dans le premier lot : ses trois tables, son secret proposé, puis relu.
  const premier = avec.lots[0]
  assert.match(premier[0], /CREATE TABLE IF NOT EXISTS campagne_series/)
  for (const table of ['cabinet_gestes', 'cabinet_profils', 'cabinet_oeuvres']) {
    assert.ok(
      premier.some(s => s.includes(`CREATE TABLE IF NOT EXISTS ${table}`)),
      `${table} naît dans le premier lot`,
    )
  }
  assert.ok(premier.some(s => /INSERT INTO campagne_meta .*ON CONFLICT \(cle\) DO NOTHING/.test(s)), 'le secret se propose dans le premier lot')
  assert.ok(premier.some(s => /SELECT valeur FROM campagne_meta WHERE cle = \?/.test(s)), 'et s’y relit')
  // Sa colonne passe par `ajouterColonne`, qui a déjà le schéma de la table (`schemaDe`) : là, rien à ajouter, rien à payer.
  assert.deepEqual(altersDe(avec), [], 'le réveil d’une base qui a tout n’ajoute aucune colonne')

  const tables = (nom: string) => lire<{ name: string }>(nom, `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'cabinet\\_%' ESCAPE '\\' ORDER BY name`).map(t => t.name)
  assert.deepEqual(tables('reveil-avec.db'), ['cabinet_gestes', 'cabinet_oeuvres', 'cabinet_profils'])
  assert.ok(lire<{ name: string }>('reveil-avec.db', 'PRAGMA table_info(campagne_series)').some(c => c.name === 'cabinet'), 'la colonne du départ figé')
  // Rien de lui sans lui : la campagne seule ne connaît pas ses tables.
  assert.deepEqual(tables('reveil-sans.db'), [])
})

test('le secret du Cabinet se tire une fois : un second serveur, un réveil relisent le même', async () => {
  const premier = magasin('secret.db')
  // La porte s'ouvre avant le réveil — le serveur la donne au Cabinet en le construisant —, mais le secret n'y est qu'après.
  const porte = premier.porte()
  assert.equal(premier.porte(), porte, 'la même porte à chaque fois')
  assert.throws(() => porte.secretDuCabinet(), TypeError)
  await premier.init(REVEIL_DU_CABINET)
  const secret = porte.secretDuCabinet()
  assert.match(secret, /^[0-9a-f]{64}$/)

  // Deux serveurs pendant une mise en ligne, puis le réveil d'après : chacun propose le sien, la base garde le premier.
  const second = magasin('secret.db')
  await second.init(REVEIL_DU_CABINET)
  assert.equal(second.porte().secretDuCabinet(), secret)
  const reveille = magasin('secret.db')
  await reveille.init(REVEIL_DU_CABINET)
  assert.equal(reveille.porte().secretDuCabinet(), secret)
  assert.deepEqual(lire('secret.db', 'SELECT valeur FROM campagne_meta WHERE cle = ?', SECRET_DU_CABINET), [{ valeur: secret }])

  // Une autre base, un autre secret : il ne vient pas du code.
  const ailleurs = magasin('secret-ailleurs.db')
  await ailleurs.init(REVEIL_DU_CABINET)
  assert.notEqual(ailleurs.porte().secretDuCabinet(), secret)

  // Ouverte sans le Cabinet, la campagne n'en a pas : un branchement oublié est une erreur du serveur, pas un refus à dire.
  const seule = magasin('secret-sans.db')
  await seule.init()
  assert.throws(() => seule.porte().secretDuCabinet(), TypeError)
})

// ── Le rituel d'une réponse ──────────────────────────────────────────────

const sorteDe = (v: VueDeLExpedition, id: string) => v.carte!.escales.find(e => e.id === id)?.sorte

/** Le pas vers une question : le premier étage n'a que des questions, et une source relirait le carnet. */
const versUneQuestion = (v: VueDeLExpedition) =>
  v.permises.find(id => sorteDe(v, id) === 'question') ?? v.permises.find(id => sorteDe(v, id) !== 'source' && sorteDe(v, id) !== 'inconnu') ?? v.permises[0]

test('une réponse écrite par la porte : l’expédition en route relit ce qu’il a vu, et le journal sait qu’il a du retard', async () => {
  const jeu = magasin('rituel.db')
  await jeu.init(REVEIL_DU_CABINET)
  const porte = jeu.porte()
  const avancer = (v: VueDeLExpedition) => jeu.gesteDExpedition(QUI, v.id, v.rang + 1, { quoi: 'avancer', vers: versUneQuestion(v) })
  /** Ce qui attend un geste avant le pas suivant — une offre, le campement —, sans le compter. */
  const pretAAvancer = async (v: VueDeLExpedition) => {
    for (let pas = 0; pas < 5 && (v.offre || v.campement); pas++) {
      v = (await jeu.gesteDExpedition(QUI, v.id, v.rang + 1, v.offre ? { quoi: 'prendre', jokers: [] } : { quoi: 'camper' })).expedition
    }
    return v
  }

  // Une première expédition, un pas puis abandonnée : la base, la mesure et le journal se lisent une fois — ce n'est pas
  // ce qu'on compte. Rien ne s'en rapporte au Cabinet (la décision du propriétaire du 25 octobre 2026) ; il apprend
  // seulement qu'elle part et qu'elle finit, pour la ligne « Ton expédition t'attend » de sa page (`expeditionChange`) :
  // en mémoire, sur-le-champ — aucun aller-retour de plus, le compte d'après le dit.
  const dites: [string, string | null][] = []
  jeu.expeditionChange = (profileId, enRoute) => dites.push([profileId, enRoute])
  const essai = await jeu.partirEnExpedition(QUI)
  assert.deepEqual(dites, [[QUI, essai.id]], 'partie : elle l’attend')
  await avancer(essai)
  await jeu.abandonnerLExpedition(QUI, essai.id)
  assert.deepEqual(dites, [[QUI, essai.id], [QUI, null]], 'finie : plus rien ne l’attend')
  // Un crochet qui tombe ne fait tomber ni le départ ni la fin, déjà écrits : il se dit au journal du serveur.
  jeu.expeditionChange = () => {
    throw new Error('le Cabinet est muet')
  }
  const { resultat: muette, dits } = await enEcoutantLeJournal(async () => {
    const e = await jeu.partirEnExpedition(QUI)
    await jeu.abandonnerLExpedition(QUI, e.id)
    return e
  })
  assert.ok(muette.id)
  assert.equal(dits.filter(d => d.includes('le Cabinet est muet')).length, 2, dits.join('\n'))
  jeu.expeditionChange = undefined

  const v = await jeu.partirEnExpedition(QUI)
  const escale = await mesurer(() => avancer(v))
  assert.equal(escale.appels, 1, `${escale.appels} allers-retours pour une escale : ce qu'il a vu, gardé du départ`)
  const q = escale.resultat.expedition.question!
  const apres = await pretAAvancer((await jeu.repondreEnExpedition(QUI, v.id, q.index, 0)).expedition)

  // Le journal rattrapé : la réponse de l'expédition y est, plus rien à relire tant qu'aucune n'est écrite.
  await porte.lireAvecLeJournal([])
  const frais = await mesurer(() => porte.lireAvecLeJournal([]))
  assert.equal(frais.appels, 0, 'lu depuis la dernière réponse écrite : le tirage d’un départ ne paie rien')

  // Une pièce du Cabinet, écrite par la porte.
  await partie(jeu, 'partie-rituel')
  const vue = BASE.questions[57]
  const ecrit = await mesurer(() => porte.ecrireDesReponses(QUI, piece(jeu, 'partie-rituel', 0, vue, true, MAINTENANT)))
  assert.equal(ecrit.appels, 1, 'une pièce qui ne finit pas la partie : son lot, rien d’autre')
  assert.deepEqual(ecrit.resultat.xp, [], 'rien de crédité avant la fin')
  assert.deepEqual(ecrit.resultat.recompenses, {})

  const enRetard = await mesurer(() => porte.lireAvecLeJournal([]))
  assert.equal(enRetard.appels, 1, 'une réponse écrite depuis : le journal se rattrape')
  assert.ok(enRetard.resultat.journal.vuesDe(QUI).vues.has(vue.id), 'et la sait')

  // L'escale suivante relit ce qu'il a vu : la question du Cabinet ne revient pas comme jamais vue.
  const suivante = await mesurer(() => avancer(apres))
  assert.equal(suivante.appels, 2, `${suivante.appels} allers-retours : ce qu'il a vu se relit, puis l'escale s'écrit`)
})

/** L'étagère des profils, pour voir ce que la fin d'une partie y range — et dans quel ordre, avec ce qui s'y écrit d'autre (`ordre`). */
function etagere(ordre: string[] = []) {
  const rangees: { sous: string; cles: string[]; quand: number | undefined }[] = []
  const paliers: { sous: string; justes: number; tampons: number; salles: number | undefined }[] = []
  const recompenses: RecompensesDeCampagne = {
    ranger: async (_id, sous, cles, quand) => {
      ordre.push('ranger')
      rangees.push({ sous, cles: [...cles], quand })
      return []
    },
    recompensesOf: () => new Map(),
    accorderPaliersDeCampagne: async (_id, sous, stats) => {
      ordre.push('paliers')
      paliers.push({ sous, justes: stats.justes, tampons: stats.tampons, salles: sallesDe(stats) })
      return ['hf:marathonien:1']
    },
    legendairesOuverts: () => [],
    tirerUnEclat: async () => null,
  }
  return { rangees, paliers, recompenses }
}

test('la fin d’une partie : son expérience créditée une fois, ses gardiens, ses paliers rangés sous elle, son compagnon qui grandit', async () => {
  const ordre: string[] = []
  const lignes: { xp: number; jours: number }[] = []
  const { rangees, paliers, recompenses } = etagere(ordre)
  const fin = magasin('fin.db', {
    recompenses,
    ecrireXp: async (_id, xp, jours) => {
      ordre.push('expérience')
      lignes.push({ xp, jours })
    },
  })
  await fin.init(REVEIL_DU_CABINET)
  const grandis: string[] = []
  fin.profils = {
    cached: (id: string) => ({ id }),
    compagnonDeLaNiche: () => 'loup',
    faireGrandir: async (id: string) => {
      ordre.push('compagnon')
      grandis.push(id)
    },
  } as unknown as CampagneStore['profils']
  // Ce que le Cabinet ajoute aux paliers, lu dans le lot de `statsDe` : ici ses œuvres, comptées en salles.
  let oeuvresLues: number | null = null
  fin.statsEnPlus = {
    lectures: id => [{ sql: 'SELECT COUNT(*) AS n FROM cabinet_oeuvres WHERE profile_id = ?', args: [id] }],
    lire: ([oeuvres]) => sesSalles((oeuvresLues = Number(oeuvres.rows[0].n))),
  }
  // Les gardiens du Cabinet (§ 2.6 de sa conception) : entre l'expérience et les paliers, à chaque fin écrite.
  const avantLesPaliers = async () => void ordre.push('gardiens')
  const porte = fin.porte()
  assert.equal(porte.compagnonDeLaNiche(QUI), 'loup', 'le compagnon de sa niche, que la ligne de chaque pièce retient')

  // Dix-neuf bonnes réponses ce matin, en série : les deux de la partie sont la vingtième — encore au double — et la vingt et unième.
  const db = new Database(fichier('fin.db'))
  try {
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le) VALUES ('matin', ?, '[]', 19, 3, 19, ?, ?)`).run(QUI, MAINTENANT - 3 * 3_600_000, MAINTENANT - 2 * 3_600_000)
    const reponse = db.prepare(`INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES ('matin', ?, ?, 0, 1, ?)`)
    for (let i = 0; i < 19; i++) reponse.run(i, BASE.questions[i].id, MAINTENANT - 3 * 3_600_000 + i * 60_000)
    const oeuvre = db.prepare(`INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le) VALUES (?, ?, 'achat', ?)`)
    for (const cle of ['bastion', 'evidence']) oeuvre.run(QUI, cle, MAINTENANT - 86_400_000)
  } finally {
    db.close()
  }
  await porte.lireAvecLeJournal([])

  await partie(fin, 'partie-fin')
  const [t1, t2] = [MAINTENANT - 90_000, MAINTENANT - 20_000]
  const g = geste('partie-fin', 1, 'uid-du-geste')
  const lot = [
    g.ecrire,
    ...piece(fin, 'partie-fin', 0, BASE.questions[40], true, t1, g.sousLui),
    ...piece(fin, 'partie-fin', 1, BASE.questions[41], false, MAINTENANT - 50_000, g.sousLui),
    ...piece(fin, 'partie-fin', 2, BASE.questions[42], true, t2, g.sousLui),
    { sql: 'SELECT position, justes FROM campagne_series WHERE id = ?', args: ['partie-fin'] },
  ]
  const laFin = { serieId: 'partie-fin', quand: MAINTENANT, justes: [t1, t2], ecrite: ecriteSiLeGestePasse, avantLesPaliers }
  const ecrit = await mesurer(() => porte.ecrireDesReponses(QUI, lot, laFin))
  // Le lot, l'expérience lue à son bout ; puis les paliers (`statsDe`), d'un lot qui lit aussi ce que le Cabinet y ajoute.
  // La ligne d'expérience et la croissance passent par les profils, que ce banc n'écrit pas.
  assert.equal(ecrit.appels, 2, `${ecrit.appels} allers-retours pour la fin d'une partie`)
  assert.ok(ecrit.lots[0].some(s => s.includes('json_group_array')), 'le journal se lit au bout du lot de la fin')
  assert.ok(ecrit.lots[1].some(s => s.includes('FROM cabinet_oeuvres')), 'ce que le Cabinet ajoute aux paliers, dans le lot de statsDe')

  // Ce que le lot a lu, une entrée par instruction, sans les lectures de l'expérience.
  assert.equal(ecrit.resultat.lus.length, lot.length)
  assert.deepEqual(ecrit.resultat.lus.at(-1)!.rows.map(r => ({ position: Number(r.position), justes: Number(r.justes) })), [{ position: 3, justes: 2 }])

  // L'expérience, une fois pour toute la partie : sa ligne réécrite entière, et ce que chacune a rapporté à son rang du jour.
  assert.deepEqual(lignes, [{ xp: xpDuJourDeCampagne(21), jours: 1 }])
  assert.deepEqual(ecrit.resultat.xp, [xpDeLaBonneReponse(20), xpDeLaBonneReponse(21)])
  assert.deepEqual(ecrit.resultat.xp, [10, 5], 'la vingtième au double, la vingt et unième non')

  // Dans l'ordre de la conception : l'expérience, les gardiens, l'étagère et ses paliers, puis le compagnon.
  assert.deepEqual(ordre, ['expérience', 'gardiens', 'ranger', 'paliers', 'compagnon'])
  // Ses paliers, rangés sous la partie, sur des stats qui comptent ses justes et ce que le Cabinet y ajoute.
  assert.deepEqual(rangees, [{ sous: cleDeSerie('partie-fin'), cles: [], quand: MAINTENANT }])
  assert.equal(oeuvresLues, 2, 'il lit ce que ses lectures ont rendu')
  assert.deepEqual(paliers, [{ sous: cleDeSerie('partie-fin'), justes: 21, tampons: 0, salles: 2 }])
  assert.deepEqual(
    ecrit.resultat.recompenses.recompenses?.map(r => r.key),
    ['hf:marathonien:1'],
  )
  assert.deepEqual(grandis, [QUI], 'le compagnon grandit à la fin d’une partie, jamais pendant une manche')
  assert.deepEqual(lire('fin.db', `SELECT DISTINCT compagnon FROM campagne_reponses WHERE serie_id = 'partie-fin'`), [{ compagnon: 'loup' }])

  // Le même geste, pris ailleurs — l'autre serveur d'une mise en ligne qui tient encore la partie, un double toucher — :
  // son lot n'écrit rien, et la fin ne se refait pas. Ni l'expérience, ni les gardiens, ni l'étagère, ni le compagnon :
  // la fin écrite les a eus. Son lot seul, un aller-retour.
  const autre = geste('partie-fin', 1, 'uid-de-l-autre-serveur')
  const ailleurs = await mesurer(() =>
    porte.ecrireDesReponses(QUI, [autre.ecrire, ...piece(fin, 'partie-fin', 3, BASE.questions[45], true, MAINTENANT, autre.sousLui)], { ...laFin, justes: [MAINTENANT] }),
  )
  assert.equal(ailleurs.appels, 1, `${ailleurs.appels} allers-retours pour une fin que la base n'a pas prise`)
  assert.equal(ailleurs.resultat.lus[0].rowsAffected, 0, 'le geste était déjà pris')
  assert.deepEqual(ailleurs.resultat.xp, [], 'rien de crédité')
  assert.deepEqual(ailleurs.resultat.recompenses, {}, 'rien de rangé')
  assert.deepEqual(ordre, ['expérience', 'gardiens', 'ranger', 'paliers', 'compagnon'], 'rien ne se refait')
  assert.deepEqual(
    lire<{ position: number }>('fin.db', `SELECT position FROM campagne_reponses WHERE serie_id = 'partie-fin' ORDER BY position`).map(r => r.position),
    [0, 1, 2],
    'et rien ne s’est écrit sous le geste d’un autre',
  )

  // Une partie sans une juste : rien à créditer, pas un aller-retour pour la ligne — ses paliers se relisent quand même.
  await partie(fin, 'partie-blanche')
  const blanche = await mesurer(() =>
    porte.ecrireDesReponses(QUI, piece(fin, 'partie-blanche', 0, BASE.questions[43], false, MAINTENANT), { serieId: 'partie-blanche', quand: MAINTENANT, justes: [], ecrite: () => true }),
  )
  assert.equal(blanche.appels, 2, `${blanche.appels} allers-retours pour une fin sans juste : le lot, les paliers`)
  assert.ok(!blanche.lots[0].some(s => s.includes('json_group_array')), 'aucune lecture de l’expérience au bout du lot')
  assert.equal(lignes.length, 1, 'la ligne d’expérience ne se réécrit pas')
  assert.deepEqual(blanche.resultat.xp, [])
  assert.equal(rangees.length, 2)
  assert.deepEqual(grandis, [QUI, QUI])
})

test('une partie à cheval sur minuit : chaque juste paie au rang qu’elle a dans son jour de Paris', async () => {
  // Mercredi 21 octobre 2026, 0 h 05 à Paris — 22 h 05 UTC la veille, à l'heure d'été.
  const apresMinuit = Date.UTC(2026, 9, 20, 22, 5)
  const lignes: { xp: number; jours: number }[] = []
  const minuit = magasin('minuit.db', { recompenses: etagere().recompenses, maintenant: () => apresMinuit, ecrireXp: async (_id, xp, jours) => void lignes.push({ xp, jours }) })
  await minuit.init(REVEIL_DU_CABINET)
  const porte = minuit.porte()

  // Vingt bonnes réponses mardi à 20 h : la juste de 23 h 59 est la vingt et unième de son jour, celle de 0 h 01 la première du sien.
  const db = new Database(fichier('minuit.db'))
  try {
    const mardi = Date.UTC(2026, 9, 20, 18, 0)
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le) VALUES ('mardi', ?, '[]', 20, 3, 20, ?, ?)`).run(QUI, mardi, mardi + 30 * 60_000)
    const reponse = db.prepare(`INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES ('mardi', ?, ?, 0, 1, ?)`)
    for (let i = 0; i < 20; i++) reponse.run(i, BASE.questions[i].id, mardi + i * 60_000)
  } finally {
    db.close()
  }
  await porte.lireAvecLeJournal([])

  await partie(minuit, 'partie-de-minuit')
  const [avant, apres] = [Date.UTC(2026, 9, 20, 21, 59), Date.UTC(2026, 9, 20, 22, 1)]
  const g = geste('partie-de-minuit', 1, 'uid-de-minuit')
  const lot = [g.ecrire, ...piece(minuit, 'partie-de-minuit', 0, BASE.questions[46], true, avant, g.sousLui), ...piece(minuit, 'partie-de-minuit', 1, BASE.questions[47], true, apres, g.sousLui)]
  const { xp } = await porte.ecrireDesReponses(QUI, lot, { serieId: 'partie-de-minuit', quand: apresMinuit, justes: [avant, apres], ecrite: ecriteSiLeGestePasse })
  assert.deepEqual(xp, [xpDeLaBonneReponse(21), xpDeLaBonneReponse(1)])
  assert.deepEqual(xp, [5, 10], 'la vingt et unième de mardi au simple, la première de mercredi au double')
  // La ligne, elle, se relit jour par jour : deux jours, chacun à son compte.
  assert.deepEqual(lignes, [{ xp: xpDuJourDeCampagne(21) + xpDuJourDeCampagne(1), jours: 2 }])
})

test('ce qui suit le lot ne fait jamais échouer la fin : la partie est écrite, et chaque pas qui tombe se dit au journal', async () => {
  const ordre: string[] = []
  const muet = (quoi: string, message: string) => async () => {
    ordre.push(quoi)
    throw new Error(message)
  }
  const recompenses: RecompensesDeCampagne = { ...etagere(ordre).recompenses, ranger: muet('ranger', 'étagère muette') }
  const tombe = magasin('tombe.db', { recompenses, ecrireXp: muet('expérience', 'ligne d’expérience refusée') })
  await tombe.init(REVEIL_DU_CABINET)
  tombe.profils = { faireGrandir: muet('compagnon', 'niche muette') } as unknown as CampagneStore['profils']
  const porte = tombe.porte()
  await porte.lireAvecLeJournal([])

  await partie(tombe, 'partie-tombee')
  const [t1, t2] = [MAINTENANT - 60_000, MAINTENANT - 30_000]
  const g = geste('partie-tombee', 1, 'uid-tombe')
  const lot = [g.ecrire, ...piece(tombe, 'partie-tombee', 0, BASE.questions[48], true, t1, g.sousLui), ...piece(tombe, 'partie-tombee', 1, BASE.questions[49], true, t2, g.sousLui)]
  const { resultat, dits } = await enEcoutantLeJournal(() =>
    porte.ecrireDesReponses(QUI, lot, { serieId: 'partie-tombee', quand: MAINTENANT, justes: [t1, t2], ecrite: ecriteSiLeGestePasse, avantLesPaliers: muet('gardiens', 'gardiens muets') }),
  )
  // Chaque pas tombe, et chacun a sa chance : un pas tombé n'emporte pas les suivants.
  assert.deepEqual(ordre, ['expérience', 'gardiens', 'ranger', 'compagnon'])
  assert.deepEqual(resultat.xp, [0, 0], 'la ligne refusée : un zéro par juste, que la bonne réponse suivante réécrira')
  assert.deepEqual(resultat.recompenses, {}, 'l’étagère muette ne range rien')
  for (const message of ['ligne d’expérience refusée', 'gardiens muets', 'étagère muette', 'niche muette']) {
    assert.ok(dits.some(d => d.includes(message)), `« ${message} » se dit au journal :\n${dits.join('\n')}`)
  }
  assert.equal(lire<{ n: number }>('tombe.db', `SELECT COUNT(*) AS n FROM campagne_reponses WHERE serie_id = 'partie-tombee'`)[0].n, 2, 'la partie est écrite')
})

test('un lot refusé remonte tel quel : rien n’est crédité ni rangé, et le journal se sait en retard', async () => {
  const lignes: number[] = []
  const { rangees, recompenses } = etagere()
  const ratee = magasin('ratee.db', { recompenses, ecrireXp: async (_id, xp) => void lignes.push(xp) })
  await ratee.init(REVEIL_DU_CABINET)
  const grandis: string[] = []
  ratee.profils = { faireGrandir: async (id: string) => void grandis.push(id) } as unknown as CampagneStore['profils']
  const porte = ratee.porte()
  await partie(ratee, 'partie-ratee')
  await porte.lireAvecLeJournal([])
  assert.equal((await mesurer(() => porte.lireAvecLeJournal([]))).appels, 0, 'le journal frais : rien à relire')

  const db = new Database(fichier('ratee.db'))
  db.exec(`CREATE TRIGGER panne_piece BEFORE INSERT ON campagne_reponses BEGIN SELECT RAISE(ABORT, 'base permanente muette'); END`)
  db.close()
  await assert.rejects(
    porte.ecrireDesReponses(QUI, piece(ratee, 'partie-ratee', 0, BASE.questions[44], true, MAINTENANT), { serieId: 'partie-ratee', quand: MAINTENANT, justes: [MAINTENANT], ecrite: () => true }),
    /base permanente muette/,
  )
  assert.deepEqual(lignes, [], 'rien de crédité')
  assert.deepEqual(rangees, [], 'rien de rangé')
  assert.deepEqual(grandis, [], 'personne ne grandit')
  // Écrit ou non — un lot resté sans réponse a pu passer —, on ne le sait pas : la lecture suivante du journal se rattrape.
  assert.equal((await mesurer(() => porte.lireAvecLeJournal([]))).appels, 1, 'le journal se relit après un lot refusé')
})

test('ce que le Cabinet ajoute aux paliers part dans le lot de statsDe, sans un aller-retour de plus, et ne remplace rien de la campagne', async () => {
  const stats = magasin('stats.db')
  await stats.init(REVEIL_DU_CABINET)
  await stats.porte().lireAvecLeJournal([])
  const sans = await mesurer(() => stats.statsDe(QUI))
  let lu: number | null = null
  stats.statsEnPlus = {
    lectures: id => [{ sql: 'SELECT COUNT(*) AS n FROM cabinet_oeuvres WHERE profile_id = ?', args: [id] }],
    lire: ([oeuvres]) => {
      lu = Number(oeuvres.rows[0].n)
      return sesSalles(4)
    },
  }
  const avec = await mesurer(() => stats.statsDe(QUI))
  assert.equal(avec.appels, sans.appels, `${avec.appels} allers-retours avec ce que le Cabinet ajoute, ${sans.appels} sans`)
  assert.equal(avec.appels, 1)
  assert.equal(lu, 0, 'il lit ce que ses lectures ont rendu')
  // Sans le Cabinet — un serveur où il est fermé ne le branche pas —, aucune salle : le champ a son défaut, que
  // L'Explorateur lit sans rien faire tomber (il était absent tant que `ChampsDuCabinet` n'en comptait aucun).
  assert.equal(sallesDe(sans.resultat), 0)
  assert.equal(sallesDe(avec.resultat), 4, 'et ce qu’il en tire s’ajoute aux paliers')

  // Un compte de la campagne rendu par erreur — les tampons du Globe-trotter, les bonnes réponses du Marathonien —
  // changerait en silence les paliers de tout le monde. Le typage le refuse…
  // @ts-expect-error — un compte de la campagne n'est pas un champ du Cabinet (`ChampsDuCabinet`)
  const tricheur: StatsEnPlus['lire'] = () => ({ tampons: 7, justes: 900 })
  // … et rendu quand même, la campagne compte par-dessus.
  stats.statsEnPlus = { lectures: () => [], lire: tricheur }
  const triche = await stats.statsDe(QUI)
  assert.equal(triche.tampons, 0, 'les tampons restent ceux du passeport')
  assert.equal(triche.justes, 0, 'les bonnes réponses, celles du journal')
})

test('la porte rend la base de la campagne telle qu’elle la garde, et son verrou', async () => {
  const garde = magasin('garde.db')
  await garde.init(REVEIL_DU_CABINET)
  const porte = garde.porte()
  assert.equal(porte.maintenant(), MAINTENANT)

  // Gardées par identité : les tas du Cabinet s'y accrochent (`WeakMap`) et ne se refont qu'avec elles.
  const jouables = await porte.jouables()
  assert.equal(await porte.jouables(), jouables)
  assert.equal(jouables.length, BASE.questions.length)
  assert.equal(porte.parIdDe(jouables), porte.parIdDe(jouables))
  assert.equal(porte.parIdDe(jouables).get(BASE.questions[3].id), BASE.questions[3])
  const histoire = porte.deLaCategorie(jouables, 'Histoire')
  assert.equal(porte.deLaCategorie(jouables, 'Histoire'), histoire)
  assert.ok(histoire.length === 24 && histoire.every(q => q.meta.categorie === 'Histoire'))
  assert.equal(porte.evenementsDe(jouables), porte.evenementsDe(jouables))
  // La mesure qu'il y a, gardée : la page d'un départ ne la fait pas relire.
  const mesure = await porte.mesures()
  assert.equal(await porte.mesures(), mesure)

  // Le verrou du profil est celui de la campagne, dans les deux sens. Une série qui commence d'abord : le geste du
  // Cabinet passe après elle, et la trouve écrite. Sous un verrou à part, il partirait avant son premier aller-retour.
  const seriesDe = () => lire<{ n: number }>('garde.db', `SELECT COUNT(*) AS n FROM campagne_series WHERE profile_id = ? AND mode = 'serie'`, QUI)[0].n
  const premiere = garde.commencer(QUI)
  const vues = await porte.avecVerrou(QUI, async () => seriesDe())
  await premiere
  assert.equal(vues, 1, 'le geste du Cabinet attend la série commencée avant lui')

  // Un geste du Cabinet d'abord : la série attend qu'il ait fini — quand celle d'un autre profil commence, elle.
  const ordre: string[] = []
  let relacher!: () => void
  const unGeste = porte.avecVerrou(QUI, async () => {
    ordre.push('geste du Cabinet')
    await new Promise<void>(r => (relacher = r))
    ordre.push('geste du Cabinet écrit')
  })
  const serie = garde.commencer(QUI).then(() => ordre.push('série commencée'))
  await garde.commencer('un-autre-profil')
  assert.deepEqual(ordre, ['geste du Cabinet'], 'la série d’un autre profil a commencé, la sienne attend')
  assert.equal(seriesDe(), 1)
  relacher()
  await Promise.all([unGeste, serie])
  assert.deepEqual(ordre, ['geste du Cabinet', 'geste du Cabinet écrit', 'série commencée'])
  assert.equal(seriesDe(), 2)
})
