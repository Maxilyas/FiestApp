// Ce que les deux gros gestes de la page des duels font attendre — le retour
// du propriétaire du 13 octobre 2026 : « quand je clique sur "Défier" ou le
// dé pour défier un automate, l'attente est perceptible ». En production,
// chaque `execute` et chaque `batch` est un aller-retour HTTP vers Turso —
// 230 ms en médiane, 765 au 95ᵉ centile, ce jour-là (`/healthz`) — : on
// compte ceux qui se suivent sur le fichier `file:` qui en tient lieu, comme
// `jour-charge.test.ts`.
//
// Le dé en attendait trois, l'un derrière l'autre : sa rencontre laissée et
// sa cote, puis ses séries et ce qu'il a vu, puis l'écriture — qu'il
// n'attend plus : sa première réponse s'en charge. « Défier » attendait tout
// l'état de la campagne — quatre lectures de son passé, 800 ms en
// production — pour n'en lire que les catégories et les sujets, les mêmes
// pour tous.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { ProfileStore } from '../src/auth/profiles'
import { VUE_RECENTE_MS, parFraicheur } from '../src/core/campagne'

ProfileStore.tirageEclat = () => false

// ── Le compteur ───────────────────────────────────────────────────────────

/** Ce que la base permanente a servi pendant une mesure : chaque lecture, et ses lignes. */
const compte = { actif: false, mesure: 0, appels: 0, finis: 0, sqls: [] as string[], lectures: [] as { sql: string; lignes: number }[] }

const sqlDe = (s: unknown) => (typeof s === 'string' ? s : (s as { sql: string }).sql)
const enClair = (s: unknown) => sqlDe(s).replace(/\s+/g, ' ').trim().slice(0, 70)

/** L'écriture d'une rencontre, retenue tant que le test ne la lâche pas : ce que le dé n'attend plus, et que sa première réponse attend. */
let retenue: Promise<void> | null = null
/** L'écriture d'un duel lancé, retenue de même : « Jouer le duel » ne l'attend plus non plus. */
let duelRetenu: Promise<void> | null = null

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    // Un aller-retour dure au moins un tour de boucle, comme sur le réseau :
    // ce qui part ensemble est en vol ensemble, et le rang d'un appel dit
    // combien d'allers-retours il a attendus (`enSerie`). Seuls comptent ceux
    // qui partent pendant la mesure : une clôture de fond lancée par la
    // requête d'avant n'est pas à elle.
    const mesure = compte.actif ? compte.mesure : 0
    const rang = compte.finis + 1
    if (mesure) await new Promise<void>(r => setImmediate(r))
    if (retenue && methode === 'execute' && /^\s*INSERT INTO campagne_series[\s\S]*'rencontre'/.test(sqlDe(args[0]))) await retenue
    if (duelRetenu && methode === 'batch' && /^\s*INSERT INTO campagne_duels/.test(sqlDe((args[0] as unknown[])[0]))) await duelRetenu
    const res = await origine.apply(this, args)
    if (mesure && compte.actif && mesure === compte.mesure) {
      compte.appels++
      compte.finis = Math.max(compte.finis, rang)
      const instructions = methode === 'batch' ? (args[0] as unknown[]) : [args[0]]
      compte.sqls.push(`${rang}. ${enClair(instructions[0])}`)
      const resultats = (methode === 'batch' ? res : [res]) as { rows: unknown[] }[]
      resultats.forEach((r, i) => compte.lectures.push({ sql: enClair(instructions[i]), lignes: r.rows.length }))
    }
    return res
  }
}

async function mesurer<T>(travail: () => Promise<T>): Promise<{ appels: number; enSerie: number; sqls: string[]; lectures: { sql: string; lignes: number }[]; resultat: T }> {
  Object.assign(compte, { actif: true, mesure: compte.mesure + 1, appels: 0, finis: 0, sqls: [], lectures: [] })
  try {
    const resultat = await travail()
    return { appels: compte.appels, enSerie: compte.finis, sqls: compte.sqls, lectures: compte.lectures, resultat }
  } finally {
    compte.actif = false
  }
}

// ── Un joueur qui a déjà joué ─────────────────────────────────────────────

let banc: Banc
let cookie: string

const lire = (chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => {
    const lu = (await r.json()) as any
    assert.equal(r.status, 200, `${chemin} : ${r.status} ${lu.error ?? ''}`)
    return lu
  })
const poster = (chemin: string, corps: unknown = {}, qui = cookie) =>
  ecrire(banc.url, chemin, corps, qui).then(async r => {
    const lu = (await r.json()) as any
    assert.equal(r.status, 200, `${chemin} : ${lu.error}`)
    return lu
  })
/** Ce qui vient d'abord : la requête — aboutie ou refusée —, ou le délai. */
const premier = (requete: Promise<unknown>, ms: number) =>
  Promise.race([requete.then(() => 'arrivée', () => 'arrivée'), new Promise<string>(r => setTimeout(() => r('en attente'), ms))])

before(async () => {
  // Le préchauffage de la campagne lit la base : loin des mesures.
  const base = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })
  banc = await demarrer({ baseDeLaCampagne: base, prechauffageCampagneMs: 3_600_000 })
  cookie = await inscrireProfil(banc.url, 'lea', 'Léa')
  const profileId = ((await lire('/api/joueur/moi?leger')) as any).profile.id as string
  // Trois séries finies d'avant, écrites dans la base permanente : son niveau,
  // et cent vingt questions qu'il a vues — un fidèle en a des milliers.
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const serie = db.prepare(
    `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, '[]', 40, 0, 30, ?, ?, 'serie')`,
  )
  const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, 0, ?, ?)')
  db.transaction(() => {
    for (let s = 0; s < 3; s++) {
      const id = randomUUID()
      const quand = Date.now() - (3 - s) * 86400_000
      serie.run(id, profileId, quand - 600_000, quand)
      for (let p = 0; p < 40; p++) reponse.run(id, p, base.questions[s * 40 + p].id, p < 30 ? 1 : 0, quand - 600_000 + p * 10_000)
    }
  })()
  db.close()
  // La réserve du quiz du jour lue une fois, comme sur un serveur réveillé depuis un moment : la mesure du dé ne compte que lui.
  await lire('/api/campagne/choix')
})

after(() => banc.close())

// ── Le dé ─────────────────────────────────────────────────────────────────

test('le dé répond d’un aller-retour — sa rencontre laissée, sa cote, ses séries et ce qu’il a vu — sans attendre que la rencontre s’écrive : sa première réponse l’attend', async () => {
  let lacher = () => {}
  retenue = new Promise<void>(r => (lacher = r))
  let rencontre = ''
  try {
    const de = mesurer(() => poster('/api/campagne/rencontre'))
    assert.equal(await premier(de, 3000), 'arrivée', 'le dé attend que sa rencontre s’écrive')
    const m = await de
    rencontre = m.resultat.serie.id
    assert.ok(m.resultat.serie.question, 'une question à jouer')
    assert.equal(m.resultat.adversaire.nom, 'Automate')
    assert.equal(m.enSerie, 1, `${m.enSerie} allers-retours l’un derrière l’autre avant de répondre :\n${m.sqls.join('\n')}`)
    // Ce qu'il a vu, et ce que tous ont trouvé, en un texte chacun : une ligne par
    // question — des milliers pour un fidèle — se décodait ligne à ligne, à
    // chaque dé (2,3 ms au lieu de 9,6 pour trois mille, et trois fois moins à
    // transférer). Ce qu'il a vu vient du journal des réponses
    // (`core/journalDesReponses.ts`), dont la lecture rapporte, d'un texte
    // aussi, ce qui lui est arrivé depuis.
    const parQuestion = m.lectures.filter(l => l.lignes >= 100)
    assert.deepEqual(parQuestion, [], `une ligne par question vue ou mesurée :\n${m.lectures.map(l => `${l.lignes} · ${l.sql}`).join('\n')}`)
    assert.ok(m.lectures.some(l => /MAX\(n\) AS jusqua, json_group_array/.test(l.sql) && l.lignes === 1), 'ce qu’il a vu, du journal lu d’un seul texte')

    // Sa première réponse, elle, attend l'écriture — le verrou du profil la
    // retient : elle compterait sur une rencontre que la base n'a pas.
    const reponse = poster(`/api/campagne/serie/${rencontre}/reponse`, { index: 0, choix: 0 })
    assert.equal(await premier(reponse, 300), 'en attente', 'la réponse est passée avant que la rencontre soit écrite')
    lacher()
    const r = await reponse
    assert.equal(typeof r.juste, 'boolean', 'la rencontre écrite, la réponse compte')
  } finally {
    lacher()
    retenue = null
  }

  // Laissée en route, elle se reprend d'un seul aller-retour, sans rien écrire.
  const reprise = await mesurer(() => poster('/api/campagne/rencontre'))
  assert.equal(reprise.resultat.serie.id, rencontre, 'la même rencontre, reprise')
  assert.equal(reprise.enSerie, 1, reprise.sqls.join('\n'))
  assert.equal(reprise.appels, 1, `une seule requête vers la base :\n${reprise.sqls.join('\n')}`)
})

test('une rencontre que la base refuse d’écrire : le dé a répondu, sa première réponse dit de le relancer — sans rien écrire —, et le suivant en tire une neuve', async () => {
  const nina = await inscrireProfil(banc.url, 'nina', 'Nina')
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const compter = (table: string, colonne: string, id: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${colonne} = ?`).get(id) as { n: number }).n
  try {
    // La base refuse la rencontre, comme Turso en panne (`miroir.test.ts`).
    db.exec(`CREATE TRIGGER panne BEFORE INSERT ON campagne_series WHEN NEW.mode = 'rencontre' BEGIN SELECT RAISE(ABORT, 'base en panne'); END`)
    let perdue: any
    try {
      perdue = await poster('/api/campagne/rencontre', {}, nina)
    } finally {
      db.exec('DROP TRIGGER panne')
    }
    assert.ok(perdue.serie.question, 'le dé a répondu, sans attendre l’écriture')
    const r = await ecrire(banc.url, `/api/campagne/serie/${perdue.serie.id}/reponse`, { index: 0, choix: 0 }, nina)
    assert.equal(r.status, 400)
    assert.equal(((await r.json()) as any).error, 'Ce duel n’a pas pu commencer : relance le dé')
    // Ni la rencontre, ni une réponse orpheline sous son identifiant.
    assert.equal(compter('campagne_series', 'id', perdue.serie.id), 0)
    assert.equal(compter('campagne_reponses', 'serie_id', perdue.serie.id), 0)

    // Le dé suivant en tire une neuve, écrite, qui se joue.
    const neuve = await poster('/api/campagne/rencontre', {}, nina)
    assert.notEqual(neuve.serie.id, perdue.serie.id)
    const jouee = await poster(`/api/campagne/serie/${neuve.serie.id}/reponse`, { index: 0, choix: 0 }, nina)
    assert.equal(typeof jouee.juste, 'boolean')
    assert.equal(compter('campagne_series', 'id', neuve.serie.id), 1)
    assert.equal(compter('campagne_reponses', 'serie_id', neuve.serie.id), 1)
  } finally {
    db.close()
  }
})

// ── « Défier » ────────────────────────────────────────────────────────────

test('« Défier » : ce que la préparation propose — les catégories et les sujets de la campagne — se lit sans toucher à la base', async () => {
  const etat = await lire('/api/campagne')
  const m = await mesurer(() => lire('/api/campagne/choix'))
  assert.deepEqual(m.resultat, { categories: etat.categories, sujets: etat.sujets }, 'les mêmes que la campagne')
  assert.equal(m.resultat.categories.length, CATEGORIES.length)
  assert.equal(m.appels, 0, `rien de son passé n’y sert :\n${m.sqls.join('\n')}`)
  // Comme toute la campagne : pour les profils.
  assert.equal((await fetch(`${banc.url}/api/campagne/choix`)).status, 401)
})

// ── La page ───────────────────────────────────────────────────────────────

test('la page des duels s’ouvre d’un aller-retour, ses duels contre quelqu’un compris', async () => {
  // Trois duels lancés contre d'autres : leur liste attendait le premier lot,
  // dont elle ne dépend pas, puis se lisait en deux fois — trois
  // allers-retours l'un derrière l'autre à chaque ouverture de la page.
  for (const login of ['tom', 'hugo', 'ines']) {
    const autre = await inscrireProfil(banc.url, login, login)
    const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: autre } })).json()) as any).profile.id
    await poster('/api/campagne/duel', { categories: [], adversaire: id })
  }
  // Le classement et les profils lus une fois, comme sur un serveur réveillé depuis un moment.
  assert.equal((await lire('/api/duels')).contre.length, 3)
  const m = await mesurer(() => lire('/api/duels'))
  assert.deepEqual(
    m.resultat.contre.map((d: any) => d.contre.nom).sort(),
    ['hugo', 'ines', 'tom'],
  )
  assert.equal(m.enSerie, 1, `${m.enSerie} allers-retours l’un derrière l’autre :\n${m.sqls.join('\n')}`)
})

test('ses amis et les défis qu’ils lui ont envoyés se lisent d’un aller-retour — leurs profils d’un second, au réveil —, sans les questions des défis', async () => {
  // Max a ajouté Jules et Noé ; eux et Zoé, qui l'a ajouté sans qu'il
  // l'ajoute, lui ont chacun envoyé un défi. La page des duels lit tout cela
  // en s'ouvrant (`GET /api/campagne/amis`) : ses amis, puis leurs profils,
  // puis chaque défi reçu par son code, puis le profil de Zoé — quatre
  // allers-retours l'un derrière l'autre au réveil, et chaque défi relu avec
  // ses questions, qu'aucune ligne ne montre.
  const max = await inscrireProfil(banc.url, 'max', 'Max')
  const idDe = async (qui: string) => ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: qui } })).json()) as any).profile.id as string
  const deMax = await idDe(max)
  for (const [login, prenom, sonAmi] of [
    ['jules', 'Jules', true],
    ['noe', 'Noé', true],
    ['zoe', 'Zoé', false],
  ] as const) {
    const autre = await inscrireProfil(banc.url, login, prenom)
    if (sonAmi) await poster(`/api/campagne/amis/${await idDe(autre)}/ajout`, {}, max)
    await poster(`/api/campagne/amis/${deMax}/ajout`, {}, autre)
    const { code } = await poster('/api/campagne/duel', {}, autre)
    assert.deepEqual(await poster(`/api/campagne/duel/${code}/envoi`, { amis: [deMax] }, autre), { envoyes: 1 })
  }
  const lireSesAmis = () =>
    fetch(`${banc.url}/api/campagne/amis`, { headers: { Cookie: max } }).then(async r => {
      assert.equal(r.status, 200)
      return (await r.json()) as any
    })
  const attendu = (m: { resultat: any }) => {
    assert.deepEqual(m.resultat.amis.map((a: any) => a.nom).sort(), ['Jules', 'Noé'])
    assert.deepEqual(m.resultat.recus.map((d: any) => d.auteur.nom).sort(), ['Jules', 'Noé', 'Zoé'])
  }
  const sansQuestions = (m: { lectures: { sql: string }[] }) =>
    assert.ok(!m.lectures.some(l => /SELECT \* FROM campagne_duels/.test(l.sql)), `un défi reçu relu en entier, ses questions comprises :\n${m.lectures.map(l => l.sql).join('\n')}`)

  // Le classement et les profils en mémoire : ses lectures à lui, d'un seul lot.
  await lireSesAmis()
  const chaud = await mesurer(lireSesAmis)
  attendu(chaud)
  assert.equal(chaud.enSerie, 1, chaud.sqls.join('\n'))
  assert.equal(chaud.appels, 1, `une seule requête vers la base :\n${chaud.sqls.join('\n')}`)

  // Au réveil, son profil déjà lu par la page (`moi?leger`) : le lot et le
  // classement, puis tous les profils qu'il nomme d'un coup.
  await banc.redemarrer()
  await idDe(max)
  const froid = await mesurer(lireSesAmis)
  attendu(froid)
  sansQuestions(froid)
  assert.equal(froid.enSerie, 2, `${froid.enSerie} allers-retours l’un derrière l’autre :\n${froid.sqls.join('\n')}`)
  assert.equal(froid.sqls.filter(s => /FROM profiles WHERE/.test(s)).length, 1, `leurs profils en plusieurs fois :\n${froid.sqls.join('\n')}`)
})

test('au réveil, son profil se charge d’un aller-retour, ses Éclats et ses récompenses avec', async () => {
  // Sa fiche, puis ses Éclats, puis ses récompenses : trois allers-retours l'un
  // derrière l'autre à sa première requête après chaque réveil de
  // l'hébergeur — sur la page des duels, avant tout le reste.
  await banc.redemarrer()
  const m = await mesurer(() => lire('/api/campagne/choix'))
  const duProfil = m.sqls.filter(s => /FROM profiles WHERE|FROM profile_eclats|FROM profile_badges/.test(s))
  assert.equal(duProfil.length, 1, `son profil en ${duProfil.length} fois :\n${m.sqls.join('\n')}`)
})

test('« Jouer le duel » répond d’un aller-retour — le duel déjà ouvert entre eux, leurs deux cotes, ce que chacun a vu, sa fiche de front —, sans attendre que le duel s’écrive : sa première réponse l’attend', async () => {
  // Le duel ouvert, puis les deux cotes et ce que chacun avait vu, puis
  // l'écriture : trois allers-retours l'un derrière l'autre, quatre quand la
  // fiche de l'adversaire n'était pas en mémoire — 3 à 6 s au 95ᵉ centile en
  // production (le relevé de l'heure, le 19 octobre 2026). Comme le dé, il
  // n'en attend plus qu'un.
  const ids: string[] = []
  for (const login of ['yanis', 'ruth']) {
    const autre = await inscrireProfil(banc.url, login, login)
    ids.push(((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: autre } })).json()) as any).profile.id)
  }
  const lancer = async (adversaire: string) => {
    let lacher = () => {}
    duelRetenu = new Promise<void>(r => (lacher = r))
    try {
      const lance = mesurer(() => poster('/api/campagne/duel', { adversaire }))
      assert.equal(await premier(lance, 3000), 'arrivée', '« Jouer le duel » attend que le duel s’écrive')
      const m = await lance
      // Sa première réponse, elle, attend l'écriture : le verrou du profil la retient.
      const reponse = poster(`/api/campagne/serie/${m.resultat.serie.id}/reponse`, { index: 0, choix: 0 })
      assert.equal(await premier(reponse, 300), 'en attente', 'la réponse est passée avant que le duel soit écrit')
      lacher()
      assert.equal(typeof (await reponse).juste, 'boolean', 'le duel écrit, la réponse compte')
      return m
    } finally {
      lacher()
      duelRetenu = null
    }
  }
  const m = await lancer(ids[0])
  assert.ok(m.resultat.code && m.resultat.serie.question, 'un duel lancé, et sa première question')
  assert.ok(m.resultat.enjeu, 'ce qu’il met en jeu, contre la cote d’en face')
  assert.equal(m.enSerie, 1, `${m.enSerie} allers-retours l’un derrière l’autre avant de répondre :\n${m.sqls.join('\n')}`)
  // Un second contre le même se refuse toujours, lu du même lot : le premier attend d'être joué.
  const second = await ecrire(banc.url, '/api/campagne/duel', { adversaire: ids[0] }, cookie)
  assert.equal(second.status, 400)
  assert.equal(((await second.json()) as any).error, 'Tu as déjà un duel en cours contre yanis : finis-le, il partira à ta dernière réponse')
  // Au réveil, la fiche de l'adversaire n'est plus en mémoire : elle se lit de front avec le lot.
  await banc.redemarrer()
  await lire('/api/campagne/choix')
  const reveil = await lancer(ids[1])
  assert.equal(reveil.enSerie, 1, `${reveil.enSerie} allers-retours l’un derrière l’autre, au réveil :\n${reveil.sqls.join('\n')}`)
})

test('un duel que la base refuse d’écrire : « Jouer le duel » a répondu, sa première réponse dit de le relancer — sans rien écrire —, et le suivant part', async () => {
  const sam = await inscrireProfil(banc.url, 'sam', 'Sam')
  const autre = await inscrireProfil(banc.url, 'lou', 'Lou')
  const lou = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: autre } })).json()) as any).profile.id as string
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const compter = (table: string, colonne: string, id: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${colonne} = ?`).get(id) as { n: number }).n
  try {
    // La base refuse le duel, comme Turso en panne (`miroir.test.ts`).
    db.exec(`CREATE TRIGGER panne BEFORE INSERT ON campagne_duels BEGIN SELECT RAISE(ABORT, 'base en panne'); END`)
    let perdu: any
    try {
      perdu = await poster('/api/campagne/duel', { adversaire: lou }, sam)
    } finally {
      db.exec('DROP TRIGGER panne')
    }
    assert.ok(perdu.serie.question, '« Jouer le duel » a répondu, sans attendre l’écriture')
    const r = await ecrire(banc.url, `/api/campagne/serie/${perdu.serie.id}/reponse`, { index: 0, choix: 0 }, sam)
    assert.equal(r.status, 400)
    assert.equal(((await r.json()) as any).error, 'Ce duel n’a pas pu commencer : lance-le de nouveau')
    // Ni le duel, ni sa tentative, ni l'envoi promis à Lou, ni une réponse orpheline.
    assert.equal(compter('campagne_duels', 'code', perdu.code), 0)
    assert.equal(compter('campagne_series', 'id', perdu.serie.id), 0)
    assert.equal(compter('campagne_envois_prevus', 'code', perdu.code), 0)
    assert.equal(compter('campagne_reponses', 'serie_id', perdu.serie.id), 0)

    // Le suivant, contre la même : rien ne l'attendait, il part, écrit, et se joue.
    const neuf = await poster('/api/campagne/duel', { adversaire: lou }, sam)
    assert.notEqual(neuf.serie.id, perdu.serie.id)
    const jouee = await poster(`/api/campagne/serie/${neuf.serie.id}/reponse`, { index: 0, choix: 0 }, sam)
    assert.equal(typeof jouee.juste, 'boolean')
    assert.equal(compter('campagne_duels', 'code', neuf.code), 1)
    assert.equal(compter('campagne_series', 'id', neuf.serie.id), 1)
  } finally {
    db.close()
  }
})

const client = (f: string) => readFileSync(new URL(`../../client/src/${f}`, import.meta.url), 'utf8')

test('« Défier » s’ouvre sans attendre : la page des duels demande en fond ce que la préparation propose, et elle n’attend plus que cela', () => {
  const page = client('views/CampagneApp.tsx')
  // Demandé avec son code, la page montrée : touché, « Défier » trouve tout là.
  assert.match(page, /void lancement\.charger\(\)\.catch\(\(\) => \{\}\)\s*(\/\/[^\n]*\n\s*)*void lesChoix\(\)/)
  assert.match(page, /if \(!laPreparation \|\| laPreparation === 'perdu' \|\| !choixPourLancer \|\| adversaireAttendu\)/)
  // Plus rien de l'état de la campagne : quatre lectures de son passé, pour deux listes.
  assert.doesNotMatch(page, /etatPourLancer/)
  assert.match(client('api.ts'), /choix: \(\) => req<ChoixDeLaCampagne>\('\/api\/campagne\/choix'\)/)
})

test('le dé touché le montre tout de suite : il s’allume et roule tant que le serveur lui répond — allumé, immobile, sous le mouvement réduit', () => {
  const duels = client('views/Duels.tsx')
  assert.match(duels, /className=\{'duels-hasard' \+ \(roule \? ' roule' : ''\)\}/)
  // Le dé seul roule : la flèche d'une rencontre à reprendre tournerait sur elle-même.
  assert.match(duels, /<Icon name=\{reprendre \? 'play' : 'dice'\} className=\{reprendre \? undefined : 'duels-de'\} \/>/)
  // Depuis le 16 octobre 2026, il ouvre sa feuille sans requête (`duels-enjeu.test.ts`) : il roule pendant celle qui
  // reprend un duel laissé en route.
  assert.match(duels, /<BoutonsDesDuels\s+busy=\{busy\}\s+roule=\{busy\}\s/, 'sur la page, il roule pendant sa requête')
  // La page qui arrive l'attend sans le faire rouler (`duels-page.test.ts` la rend).
  assert.match(duels, /<BoutonsDesDuels busy reprendre=\{null\} \/>/)
  const css = client('styles.css')
  assert.match(css, /\.duels-hasard\.roule \{[^}]*border-color: var\(--accent\)/, 'son anneau s’allume, même immobile')
  assert.match(css, /\.duels-hasard\.roule \.duels-de \{[^}]*animation: duels-roule /)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.duels-hasard\.roule \.duels-de \{ animation: none; \}/)
})

// ── Le tirage d'une série ─────────────────────────────────────────────────

test('ranger par fraîcheur : le même ordre qu’un tri complet — jamais vues, vues de la plus ancienne, puis celles de ces vingt-quatre heures', () => {
  // L'ordre d'avant, un tri stable à comparateur : la référence. Il relisait
  // la fraîcheur de chaque question à chaque comparaison — 8 ms sur la vraie
  // base, à chaque série, quatre à dix fois plus au dixième de cœur.
  const reference = <T extends { id: string }>(questions: readonly T[], vues: ReadonlyMap<string, number>, maintenant: number): T[] => {
    const f = (id: string) => {
      const le = vues.get(id)
      return le === undefined ? [0, 0, 0] : [maintenant - le < VUE_RECENTE_MS ? 1 : 0, 1, le]
    }
    return [...questions].sort((a, b) => {
      const [x, y] = [f(a.id), f(b.id)]
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
    })
  }
  const maintenant = Date.UTC(2026, 9, 13, 18)
  let graine = 7
  const hasard = () => ((graine = (graine * 16807) % 2147483647) - 1) / 2147483646
  for (let essai = 0; essai < 200; essai++) {
    const questions = Array.from({ length: 1 + Math.floor(hasard() * 60) }, (_, i) => ({ id: `q${i}` }))
    const vues = new Map<string, number>()
    for (const q of questions) {
      const r = hasard()
      // Des jamais vues, des vues il y a longtemps — certaines au même instant —, d'hier soir, et une horloge en avance.
      if (r < 0.3) continue
      vues.set(q.id, r < 0.5 ? maintenant - 30 * 86400_000 : r < 0.6 ? maintenant - 86400_000 * Math.floor(hasard() * 3) : r < 0.9 ? maintenant - Math.floor(hasard() * 2 * VUE_RECENTE_MS) : maintenant + 60_000)
    }
    assert.deepEqual(
      parFraicheur(questions, vues, maintenant).map(q => q.id),
      reference(questions, vues, maintenant).map(q => q.id),
      `essai ${essai}`,
    )
  }
})
