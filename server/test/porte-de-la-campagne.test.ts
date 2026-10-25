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
import type { InStatement } from '@libsql/client'
import { patienter } from './banc'
import { CampagneStore, type RecompensesDeCampagne } from '../src/core/campagne'
import { REVEIL_DU_CABINET, SECRET_DU_CABINET } from '../src/core/cabinet/tables'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { cleDeSerie } from '../src/auth/profiles'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { xpDeLaBonneReponse, xpDuJourDeCampagne } from '../../shared/campagne'
import { codexDuNiveau, niveauDe } from '../../shared/codex'
import { VERSION_DES_HUIT_FAMILLES } from '../../shared/rencontres'
import type { VueDeLExpedition } from '../../shared/expedition'

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

/** Une partie du Cabinet telle que son départ l'écrirait : une ligne de `campagne_series`, sans pièce encore. */
function partie(c: CampagneStore, id: string) {
  return c.porte().client.execute({
    sql: `INSERT INTO campagne_series (id, profile_id, mode, commencee_le, questions, position, vies, justes, cabinet) VALUES (?, ?, 'cabinet', ?, '[]', 0, 0, 0, '{}')`,
    args: [id, QUI, MAINTENANT - 120_000],
  })
}

/** Ce qu'une pièce jugée écrit, comme le lot d'un geste du Cabinet : sa réponse, et la pièce au bout de la partie. */
function piece(c: CampagneStore, serie: string, position: number, q: QuestionDeLaBase, juste: boolean, le: number): InStatement[] {
  const garde = { id: q.id, texte: q.texte, reponses: q.reponses, bonne: q.bonne, categorie: q.meta.categorie, anecdote: q.anecdote, niveau: 'moyen', forme: 'pari' }
  return [
    {
      sql: 'INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon, forme) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [serie, position, q.id, juste ? q.bonne : (q.bonne + 1) % 4, juste ? 1 : 0, le, c.porte().compagnonDeLaNiche(QUI), 'pari'],
    },
    {
      sql: `UPDATE campagne_series SET questions = json_insert(questions, '$[#]', json(?)), position = position + 1, justes = justes + ? WHERE id = ?`,
      args: [JSON.stringify(garde), juste ? 1 : 0, serie],
    },
  ]
}

// ── Le réveil ─────────────────────────────────────────────────────────────

test('le Cabinet naît dans le premier lot de la campagne : pas un aller-retour de plus au réveil, ni un schéma relu', async () => {
  // Une base neuve : la colonne du départ figé s'y ajoute, une fois — un `ALTER`, au premier réveil seulement.
  const neuve = await mesurer(() => magasin('reveil-avec.db').init(REVEIL_DU_CABINET))
  const neuveSans = await mesurer(() => magasin('reveil-sans.db').init())
  assert.equal(neuve.appels, neuveSans.appels + 1, `${neuve.appels} allers-retours au premier réveil, ${neuveSans.appels} sans le Cabinet`)

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
  // Sa colonne passe dans la boucle de celles de la campagne : le schéma de la table ne se lit qu'une fois.
  assert.equal(avec.lots.filter(l => /^PRAGMA table_info\(campagne_series\)/.test(l[0])).length, 1, 'le schéma de campagne_series relu une seule fois')

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
  // ce qu'on compte. Sa fin, le Cabinet l'apprend — et elle ne l'attend pas : son crochet ne rend jamais la main.
  const rapportees: string[] = []
  jeu.apresLExpedition = id => {
    rapportees.push(id)
    return new Promise<void>(() => {})
  }
  const essai = await jeu.partirEnExpedition(QUI)
  await avancer(essai)
  const finie = await Promise.race([jeu.abandonnerLExpedition(QUI, essai.id).then(() => true), patienter(3_000).then(() => false)])
  assert.ok(finie, 'la fin de l’expédition n’attend pas le Cabinet')
  await patienter(300)
  assert.deepEqual(rapportees, [QUI], 'la fin d’une expédition prévient le Cabinet')

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

  // Un crochet qui tombe ne fait pas tomber la fin : il se dit au journal du serveur.
  jeu.apresLExpedition = () => Promise.reject(new Error('le Cabinet est muet'))
  const dits: string[] = []
  const erreur = console.error
  console.error = (...args: unknown[]) => void dits.push(args.map(String).join(' '))
  try {
    await jeu.abandonnerLExpedition(QUI, v.id)
    await patienter(50)
  } finally {
    console.error = erreur
  }
  assert.ok(dits.some(d => d.includes('le Cabinet est muet')), dits.join('\n'))
})

/** L'étagère des profils, pour voir ce que la fin d'une partie y range. */
function etagere() {
  const rangees: { sous: string; cles: string[]; quand: number | undefined }[] = []
  const paliers: { sous: string; justes: number; tampons: number }[] = []
  const recompenses: RecompensesDeCampagne = {
    ranger: async (_id, sous, cles, quand) => {
      rangees.push({ sous, cles: [...cles], quand })
      return []
    },
    recompensesOf: () => new Map(),
    accorderPaliersDeCampagne: async (_id, sous, stats) => {
      paliers.push({ sous, justes: stats.justes, tampons: stats.tampons })
      return ['hf:marathonien:1']
    },
    legendairesOuverts: () => [],
    tirerUnEclat: async () => null,
  }
  return { rangees, paliers, recompenses }
}

test('la fin d’une partie : son expérience créditée une fois, ses paliers rangés sous elle, son compagnon qui grandit', async () => {
  const lignes: { xp: number; jours: number }[] = []
  const { rangees, paliers, recompenses } = etagere()
  const fin = magasin('fin.db', { recompenses, ecrireXp: async (_id, xp, jours) => void lignes.push({ xp, jours }) })
  await fin.init(REVEIL_DU_CABINET)
  const grandis: string[] = []
  fin.profils = {
    cached: (id: string) => ({ id }),
    compagnonDeLaNiche: () => 'loup',
    faireGrandir: async (id: string) => void grandis.push(id),
  } as unknown as CampagneStore['profils']
  // Ce que le Cabinet ajoute aux paliers, lu dans le lot de `statsDe` : ici ses œuvres, comptées dans un champ
  // d'aujourd'hui — les salles complètes de L'Explorateur viendront après l'ouverture.
  fin.statsEnPlus = {
    lectures: id => [{ sql: 'SELECT COUNT(*) AS n FROM cabinet_oeuvres WHERE profile_id = ?', args: [id] }],
    lire: ([oeuvres]) => ({ tampons: Number(oeuvres.rows[0].n) }),
  }
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
  const lot = [
    ...piece(fin, 'partie-fin', 0, BASE.questions[40], true, t1),
    ...piece(fin, 'partie-fin', 1, BASE.questions[41], false, MAINTENANT - 50_000),
    ...piece(fin, 'partie-fin', 2, BASE.questions[42], true, t2),
    { sql: 'SELECT position, justes FROM campagne_series WHERE id = ?', args: ['partie-fin'] },
  ]
  const ecrit = await mesurer(() => porte.ecrireDesReponses(QUI, lot, { serieId: 'partie-fin', quand: MAINTENANT, justes: [t1, t2] }))
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

  // Ses paliers, rangés sous la partie, sur des stats qui comptent ses justes et ce que le Cabinet y ajoute.
  assert.deepEqual(rangees, [{ sous: cleDeSerie('partie-fin'), cles: [], quand: MAINTENANT }])
  assert.deepEqual(paliers, [{ sous: cleDeSerie('partie-fin'), justes: 21, tampons: 2 }])
  assert.deepEqual(
    ecrit.resultat.recompenses.recompenses?.map(r => r.key),
    ['hf:marathonien:1'],
  )
  assert.deepEqual(grandis, [QUI], 'le compagnon grandit à la fin d’une partie, jamais pendant une manche')
  assert.deepEqual(lire('fin.db', `SELECT DISTINCT compagnon FROM campagne_reponses WHERE serie_id = 'partie-fin'`), [{ compagnon: 'loup' }])

  // Une partie sans une juste : rien à créditer, pas un aller-retour pour la ligne — ses paliers se relisent quand même.
  await partie(fin, 'partie-blanche')
  const blanche = await mesurer(() =>
    porte.ecrireDesReponses(QUI, piece(fin, 'partie-blanche', 0, BASE.questions[43], false, MAINTENANT), { serieId: 'partie-blanche', quand: MAINTENANT, justes: [] }),
  )
  assert.equal(blanche.appels, 2, `${blanche.appels} allers-retours pour une fin sans juste : le lot, les paliers`)
  assert.ok(!blanche.lots[0].some(s => s.includes('json_group_array')), 'aucune lecture de l’expérience au bout du lot')
  assert.equal(lignes.length, 1, 'la ligne d’expérience ne se réécrit pas')
  assert.deepEqual(blanche.resultat.xp, [])
  assert.equal(rangees.length, 2)
  assert.deepEqual(grandis, [QUI, QUI])
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
    porte.ecrireDesReponses(QUI, piece(ratee, 'partie-ratee', 0, BASE.questions[44], true, MAINTENANT), { serieId: 'partie-ratee', quand: MAINTENANT, justes: [MAINTENANT] }),
    /base permanente muette/,
  )
  assert.deepEqual(lignes, [], 'rien de crédité')
  assert.deepEqual(rangees, [], 'rien de rangé')
  assert.deepEqual(grandis, [], 'personne ne grandit')
  // Écrit ou non — un lot resté sans réponse a pu passer —, on ne le sait pas : la lecture suivante du journal se rattrape.
  assert.equal((await mesurer(() => porte.lireAvecLeJournal([]))).appels, 1, 'le journal se relit après un lot refusé')
})

test('ce que le Cabinet ajoute aux paliers part dans le lot de statsDe, sans un aller-retour de plus', async () => {
  const stats = magasin('stats.db')
  await stats.init(REVEIL_DU_CABINET)
  await stats.porte().lireAvecLeJournal([])
  const sans = await mesurer(() => stats.statsDe(QUI))
  let lu: number | null = null
  stats.statsEnPlus = {
    lectures: id => [{ sql: 'SELECT COUNT(*) AS n FROM cabinet_oeuvres WHERE profile_id = ?', args: [id] }],
    lire: ([oeuvres]) => {
      lu = Number(oeuvres.rows[0].n)
      return { tampons: 7 }
    },
  }
  const avec = await mesurer(() => stats.statsDe(QUI))
  assert.equal(avec.appels, sans.appels, `${avec.appels} allers-retours avec ce que le Cabinet ajoute, ${sans.appels} sans`)
  assert.equal(avec.appels, 1)
  assert.equal(lu, 0, 'il lit ce que ses lectures ont rendu')
  assert.equal(sans.resultat.tampons, 0)
  assert.equal(avec.resultat.tampons, 7, 'et ce qu’il en tire s’ajoute aux paliers')
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

  // Le verrou du profil est celui de la campagne : une série qui commence attend le geste du Cabinet en cours.
  const ordre: string[] = []
  let relacher!: () => void
  const geste = porte.avecVerrou(QUI, async () => {
    ordre.push('geste du Cabinet')
    await new Promise<void>(r => (relacher = r))
    ordre.push('geste du Cabinet écrit')
  })
  const serie = garde.commencer(QUI).then(() => ordre.push('série commencée'))
  await patienter(20)
  assert.deepEqual(ordre, ['geste du Cabinet'])
  relacher()
  await Promise.all([geste, serie])
  assert.deepEqual(ordre, ['geste du Cabinet', 'geste du Cabinet écrit', 'série commencée'])

  // Le codex qu'il ouvre aujourd'hui : sa renommée relue de ses bilans, d'un aller-retour — sans expédition, le premier niveau.
  const codex = await mesurer(() => porte.codexDuProfil(QUI, VERSION_DES_HUIT_FAMILLES))
  assert.equal(codex.appels, 1)
  assert.deepEqual(codex.resultat, codexDuNiveau(niveauDe(0), [], [], VERSION_DES_HUIT_FAMILLES).cartes)
})
