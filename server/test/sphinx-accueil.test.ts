// Le Sphinx de l'accueil, sur un serveur jetable (le plan du 24 novembre
// 2026, `retours/2026-11-24/le-sphinx/plan.md`) : à qui il parle, quand, ce
// qu'il laisse partir, ce qu'il écrit. Le tirage de la visite est fixé
// (`tirageDuSphinx`) : une chance sur trois se vérifie en dérivation pure,
// `sphinx-pur.test.ts`. (`sphinx.test.ts` est celui du légendaire, le Sphinx
// du quiz du jour.)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { legendeDe } from '../src/core/divins'
import { ENIGMES_DEJA_VUES_DU_PROPRIETAIRE, ORDRE_DU_SPHINX, enigmesDuSphinx, motsDeLaLegende, type Enigme } from '../src/core/sphinx'
import { jourAvant } from '../../shared/jour'

ProfileStore.tirageEclat = () => false

// ── Le banc ───────────────────────────────────────────────────────────────

/** Midi à Paris, un jour de septembre 2026 (heure d'été, UTC+2). */
const midi = (jour: number) => Date.UTC(2026, 8, jour, 10, 0)
const septembre = (jour: number) => `2026-09-${String(jour).padStart(2, '0')}`

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des jours joués au quiz du jour, écrits en base : ce qu'un habitué a derrière lui. */
function joue(banc: Banc, login: string, jours: readonly string[]) {
  const id = idDe(banc, login)
  base(banc, db => {
    for (const jour of jours) {
      db.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`).run(
        jour,
        JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 }))),
      )
      db.prepare(
        `INSERT OR IGNORE INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 500, 5, 2, 0)`,
      ).run(id, jour)
    }
  })
}

/** Les jours de septembre, du `premier` au `dernier`. */
const jours = (premier: number, dernier: number) => Array.from({ length: dernier - premier + 1 }, (_, i) => septembre(premier + i))

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any, texte: '' }))
const leSphinx = async (banc: Banc, cookie: string) => {
  const r = await lire(banc, cookie, '/api/joueur/sphinx')
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}
const missions = async (banc: Banc, cookie: string) => {
  const r = await lire(banc, cookie, '/api/joueur/missions')
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}
const geste = (banc: Banc, cookie: string, corps: unknown) => ecrire(banc.url, '/api/joueur/sphinx', corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const ouvrir = async (banc: Banc, admin: string, etat = 'ouverte') =>
  assert.equal((await ecrire(banc.url, '/api/admin/maintenance/pages/sphinx', { etat }, admin, 'PUT')).status, 200)

async function avecBanc(debut: number, reglages: Parameters<typeof demarrer>[0], scenario: (banc: Banc, horloge: { t: number }) => Promise<void>) {
  const horloge = { t: debut }
  // Le Sphinx passe chaque jour qu'il le peut : la chance d'une visite est à part.
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, tirageDuSphinx: () => 0, ...reglages })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

const enigmeDe = (numero: string): Enigme => enigmesDuSphinx().find(e => e.numero === numero)!

/** Les mots cachés d'une légende qu'un profil n'a pas gagnés : aucun ne doit partir vers lui. */
function motsQuIlNaPas(divin: string, siens: ReadonlySet<number>): string[] {
  return motsDeLaLegende(legendeDe(divin)!).flatMap((m, i) => (m.cache && !siens.has(i) ? [m.texte] : []))
}

/** Une réponse, sans l'énigme (ses vers et sa source disent ce qu'ils veulent) : aucun mot caché qu'il n'a pas ne s'y lit. */
function rienQueSesMots(reponse: unknown, divin: string, siens: ReadonlySet<number>, ou: string) {
  const texte = JSON.stringify(reponse, (cle, valeur) => (cle === 'enigme' ? undefined : valeur))
  for (const mot of motsQuIlNaPas(divin, siens)) {
    assert.ok(!new RegExp(`(^|[^\\p{L}])${mot}([^\\p{L}]|$)`, 'iu').test(texte), `${ou} : « ${mot} », un mot qu’il n’a pas gagné`)
  }
}

const DIVIN_DU_MOMENT = ORDRE_DU_SPHINX[0]

// ── L'ouverture ───────────────────────────────────────────────────────────

test('le Sphinx démarre « bientôt » une fois : fermé à tous sauf à ses testeurs — sa porte répond 423, ses missions se taisent', () =>
  avecBanc(midi(26), {}, async banc => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    joue(banc, 'lea', jours(23, 26))
    joue(banc, 'bob', jours(23, 26))
    assert.deepEqual(await leSphinx(banc, lea), { fermee: 'bientot' }, 'rien d’autre ne part')
    assert.ok(!('sphinx' in (await missions(banc, lea))))
    const refus = await geste(banc, lea, { geste: 'ecouter' })
    assert.deepEqual([refus.status, refus.corps], [423, { error: 'Le Sphinx arrive bientôt : reviens dans quelques jours', bientot: 'sphinx' }])
    assert.equal(base(banc, db => (db.prepare('SELECT COUNT(*) AS n FROM profile_sphinx').get() as { n: number }).n), 0, 'fermé, rien ne se pose')

    // Léa le teste : il passe chez elle, pas chez Bob.
    assert.equal((await ecrire(banc.url, `/api/admin/maintenance/pages/sphinx/testeurs/${idDe(banc, 'lea')}`, undefined, admin, 'PUT')).status, 200)
    assert.equal((await missions(banc, lea)).sphinx, 'attend')
    assert.ok((await leSphinx(banc, lea)).visite)
    const ecoute = await geste(banc, lea, { geste: 'ecouter' })
    assert.deepEqual([ecoute.status, ecoute.corps.accuse], [200, true], 'un accusé à chaque geste')
    assert.equal((await geste(banc, bob, { geste: 'ecouter' })).status, 423)

    // Ouvert à tous, il le reste au redémarrage suivant : « bientôt » ne se pose qu'une fois.
    await ouvrir(banc, admin)
    await banc.redemarrer()
    assert.equal((await missions(banc, bob)).sphinx, 'attend')
    // En maintenance, ses testeurs attendent avec les autres.
    await ouvrir(banc, await connexionAnimateur(banc.url), 'maintenance')
    assert.deepEqual(await leSphinx(banc, lea), { fermee: 'maintenance' })
  }))

// ── La visite ─────────────────────────────────────────────────────────────

test('seul un habitué est visité, une fois par jour, la même après un rechargement ; la réponse ne part qu’à la fin, et seuls ses mots', () =>
  avecBanc(midi(26), {}, async banc => {
    await ouvrir(banc, await connexionAnimateur(banc.url))
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    // Léa a joué quatre jours sur sept ; Bob trois, et un huitième jour, hors de la fenêtre.
    joue(banc, 'lea', [septembre(20), septembre(22), septembre(24), septembre(26)])
    joue(banc, 'bob', [septembre(19), septembre(21), septembre(23), septembre(25)])
    assert.ok(!('sphinx' in (await missions(banc, bob))), 'trois jours sur sept : pas encore un habitué')
    const deBob = await leSphinx(banc, bob)
    assert.deepEqual([deBob.habitue, deBob.joursJoues, deBob.visite], [false, 3, null])
    // Il voit la phrase du Divin du moment comme tout profil : sa forme et ce que tous en ont trouvé.
    assert.equal(deBob.phrase.divin.key, DIVIN_DU_MOMENT)
    assert.deepEqual([deBob.phrase.siens, deBob.phrase.parTous, deBob.phrase.reconstituee], [0, 0, false])
    rienQueSesMots(deBob, DIVIN_DU_MOMENT, new Set(), 'Bob')
    // Un petit mot offert n'est jamais un nombre.
    assert.ok(deBob.phrase.mots.filter((m: any) => m.offert).every((m: any) => !/\d|^(un|une|six|dix)$/i.test(m.texte)))

    assert.equal((await missions(banc, lea)).sphinx, 'attend')
    const premiere = await leSphinx(banc, lea)
    assert.deepEqual([premiere.habitue, premiere.joursJoues], [true, 4])
    const v = premiere.visite
    assert.deepEqual([v.etat, v.essaisRestants, v.divin.key, v.jour], ['proposee', 3, DIVIN_DU_MOMENT, septembre(26)])
    const enigme = enigmeDe(v.enigme.numero)
    assert.equal(enigme.difficulte, 'facile', 'sa première visite : une facile')
    assert.deepEqual(v.enigme.vers, enigme.vers)
    assert.match(v.enigme.source.recueil, /1858/)
    assert.equal(v.enigme.source.facSimile, enigme.facSimile)
    // La réponse ne part pas avant la fin : ni la solution, ni les réponses acceptées ou brûlantes.
    assert.equal(v.enigme.solution, undefined)
    const sansLesVers = JSON.stringify({ ...premiere, visite: { ...v, enigme: { ...v.enigme, vers: [] } } })
    assert.doesNotMatch(sansLesVers, /acceptees|presque|"solution"|"cle"/)
    assert.ok(!sansLesVers.toLowerCase().includes(`"${enigme.solution.toLowerCase()}"`))
    rienQueSesMots(premiere, DIVIN_DU_MOMENT, new Set(), 'Léa')

    // La même visite, relue, et après un redémarrage — une seule ligne.
    assert.equal((await leSphinx(banc, lea)).visite.enigme.numero, v.enigme.numero)
    await banc.redemarrer()
    assert.equal((await leSphinx(banc, lea)).visite.enigme.numero, v.enigme.numero)
    assert.equal(base(banc, db => (db.prepare('SELECT COUNT(*) AS n FROM profile_sphinx WHERE profile_id = ?').get(idDe(banc, 'lea')) as { n: number }).n), 1)

    // Plus tard : épinglé jusqu'à minuit.
    assert.equal((await geste(banc, lea, { geste: 'plus-tard' })).corps.visite.etat, 'plus-tard')
    assert.equal((await missions(banc, lea)).sphinx, 'epingle')

    // Trois essais : une réponse qui brûle n'en coûte pas, la même fausse redite non plus.
    const brule = await geste(banc, lea, { geste: 'repondre', reponse: enigme.presque.find(p => !enigme.acceptees.includes(p)) })
    assert.deepEqual([brule.corps.verdict, brule.corps.visite.essaisRestants, brule.corps.visite.etat], ['brulant', 3, 'proposee'])
    const faux = await geste(banc, lea, { geste: 'repondre', reponse: 'Une grenouille' })
    assert.deepEqual([faux.corps.verdict, faux.corps.visite.essaisRestants], ['faux', 2])
    const redite = await geste(banc, lea, { geste: 'repondre', reponse: 'la grenouille !' })
    assert.deepEqual([redite.corps.verdict, redite.corps.dejaDite, redite.corps.visite.essaisRestants], ['faux', true, 2])
    assert.equal((await geste(banc, lea, { geste: 'repondre', reponse: 'Un crapaud' })).corps.visite.essaisRestants, 1)
    for (const r of [brule, faux, redite]) {
      assert.equal(r.corps.visite.enigme.solution, undefined, 'toujours rien avant la fin')
      rienQueSesMots(r.corps, DIVIN_DU_MOMENT, new Set(), 'un verdict')
    }
    const perdu = await geste(banc, lea, { geste: 'repondre', reponse: 'Un têtard' })
    assert.deepEqual([perdu.corps.verdict, perdu.corps.visite.etat, perdu.corps.visite.essaisRestants], ['perdu', 'perdue', 0])
    assert.equal(perdu.corps.visite.enigme.solution, enigme.solution, 'la visite close, la solution part')
    assert.equal(perdu.corps.visite.mot, undefined, 'perdue : pas de mot')
    rienQueSesMots(perdu.corps, DIVIN_DU_MOMENT, new Set(), 'Léa, perdue')
    // Close : plus rien ne s'y joue, et le Sphinx ne repasse pas le même jour.
    assert.equal((await geste(banc, lea, { geste: 'repondre', reponse: enigme.solution })).status, 409)
    assert.ok(!('sphinx' in (await missions(banc, lea))))
    assert.equal((await leSphinx(banc, lea)).visite.etat, 'perdue')
    // Sans visite, un geste le dit ; un geste inconnu aussi ; et un invité sans profil n'a rien.
    assert.equal((await geste(banc, bob, { geste: 'ecouter' })).status, 404)
    assert.equal((await geste(banc, lea, { geste: 'danser' })).status, 400)
    assert.equal((await lire(banc, '', '/api/joueur/sphinx')).status, 401)
  }))

test('le mot gagné : d’abord un que personne n’a ; une énigme vue ne revient jamais ; un profil supprimé emporte ses lignes', () =>
  avecBanc(midi(20), {}, async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    await ouvrir(banc, admin)
    const cleo = await inscrireProfil(banc.url, 'cleo', 'Cléo', '🐙')
    const dede = await inscrireProfil(banc.url, 'dede', 'Dédé', '🐸')
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    for (const qui of ['cleo', 'dede', 'lea']) joue(banc, qui, jours(14, 28))
    const vues: string[] = []
    const sesMots = new Set<number>()
    for (let jour = 20; jour <= 27; jour++) {
      horloge.t = midi(jour)
      const visite = (await leSphinx(banc, cleo)).visite
      assert.ok(visite, `le ${jour}`)
      vues.push(visite.enigme.numero)
      const enigme = enigmeDe(visite.enigme.numero)
      if (jour <= 22) assert.equal(enigme.difficulte, 'facile', 'ses trois premières visites : des faciles')
      const juste = await geste(banc, cleo, { geste: 'repondre', reponse: enigme.acceptees[0] })
      assert.equal(juste.corps.verdict, 'juste')
      // Personne d'autre ne joue : chaque mot qu'il gagne est un mot que personne n'avait.
      assert.equal(juste.corps.motNeuf, true)
      const mot = juste.corps.visite.mot
      assert.equal(mot.texte, motsDeLaLegende(legendeDe(DIVIN_DU_MOMENT)!)[mot.index].texte)
      assert.equal(juste.corps.visite.enigme.solution, enigme.solution)
      sesMots.add(mot.index)
      assert.deepEqual([juste.corps.phrase.siens, juste.corps.phrase.parTous], [sesMots.size, sesMots.size])
      rienQueSesMots(juste.corps, DIVIN_DU_MOMENT, sesMots, `Cléo, le ${jour}`)
    }
    assert.equal(new Set(vues).size, vues.length, `une énigme vue ne revient jamais : ${vues.join(', ')}`)

    // Dédé résout la sienne le même jour : un mot que Cléo n'a pas encore trouvé.
    const deDede = (await leSphinx(banc, dede)).visite
    const sonMot = (await geste(banc, dede, { geste: 'repondre', reponse: enigmeDe(deDede.enigme.numero).solution })).corps
    assert.equal(sonMot.motNeuf, true)
    assert.ok(!sesMots.has(sonMot.visite.mot.index))
    // Léa voit combien ils en ont trouvé ensemble, jamais lesquels.
    const deLea = await leSphinx(banc, lea)
    assert.equal(deLea.phrase.parTous, sesMots.size + 1)
    assert.equal(deLea.phrase.siens, 0)
    rienQueSesMots(deLea, DIVIN_DU_MOMENT, new Set(), 'Léa')
    // Le chat clôt la sienne sans rien lui donner.
    const chat = (await geste(banc, lea, { geste: 'chat' })).corps
    assert.deepEqual([chat.verdict, chat.visite.etat, chat.visite.mot], ['abandon', 'abandonnee', undefined])
    assert.ok(chat.visite.enigme.solution)

    // Cléo supprimée : ses lignes partent avec elle, et ses mots du compte de tous.
    const idDeCleo = idDe(banc, 'cleo')
    assert.equal((await ecrire(banc.url, `/api/admin/profils/${idDeCleo}`, undefined, admin, 'DELETE')).status, 200)
    assert.equal(base(banc, db => (db.prepare('SELECT COUNT(*) AS n FROM profile_sphinx WHERE profile_id = ?').get(idDeCleo) as { n: number }).n), 0)
    assert.equal((await leSphinx(banc, lea)).phrase.parTous, 1)
  }))

test('une phrase reconstituée par tous se montre entière à chacun, et le Divin du moment passe au suivant', () =>
  avecBanc(midi(26), {}, async banc => {
    await ouvrir(banc, await connexionAnimateur(banc.url))
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    joue(banc, 'lea', jours(23, 26))
    // Bob a trouvé tous les mots cachés du Divin du moment, sauf un, en autant de visites d'avant.
    const caches = motsDeLaLegende(legendeDe(DIVIN_DU_MOMENT)!).flatMap((m, i) => (m.cache ? [i] : []))
    const idDeBob = idDe(banc, 'bob')
    const poser = (lesquels: readonly number[], depuis: number) =>
      base(banc, db => {
        lesquels.forEach((mot, i) =>
          db
            .prepare(`INSERT INTO profile_sphinx (profile_id, jour, enigme, divin, etat, essais, mot, proposee_le) VALUES (?, ?, ?, ?, 'resolue', 1, ?, 1)`)
            .run(idDeBob, jourAvant('2026-08-01', depuis + i), `x${depuis + i}`, DIVIN_DU_MOMENT, mot),
        )
      })
    poser(caches.slice(1), 0)
    await banc.redemarrer()
    const avant = await leSphinx(banc, lea)
    assert.deepEqual([avant.phrase.divin.key, avant.phrase.parTous, avant.phrase.aTrouver, avant.reconstituees], [DIVIN_DU_MOMENT, caches.length - 1, caches.length, []])
    assert.equal(avant.visite.divin.key, DIVIN_DU_MOMENT)
    // Léa trouve le dernier : le seul que personne n'avait.
    const juste = (await geste(banc, lea, { geste: 'repondre', reponse: enigmeDe(avant.visite.enigme.numero).solution })).corps
    assert.deepEqual([juste.motNeuf, juste.visite.mot.index], [true, caches[0]])
    // La phrase est reconstituée : entière à chacun — Bob compris, qui n'a pas ce mot —, et le Sphinx passe au suivant.
    for (const cookie of [lea, bob]) {
      const apres = await leSphinx(banc, cookie)
      assert.deepEqual(apres.reconstituees, [{ divin: { key: DIVIN_DU_MOMENT, nom: avant.phrase.divin.nom }, legende: legendeDe(DIVIN_DU_MOMENT) }])
      assert.equal(apres.phrase.divin.key, ORDRE_DU_SPHINX[1])
      assert.equal(apres.phrase.parTous, 0)
    }
    // Sa visite garde son Divin : la phrase entière, puisque tous l'ont reconstituée.
    assert.equal(juste.visite.phrase.reconstituee, true)
    assert.ok(juste.visite.phrase.mots.every((m: any) => m.texte))
  }))

test('les énigmes que le propriétaire a déjà vues comptent pour vues sur le profil de l’administrateur ; plus rien à lui poser, plus de visite', () => {
  // Les huit et une neuvième : sa seule énigme à voir.
  const neuvieme = enigmesDuSphinx().find(e => !(ENIGMES_DEJA_VUES_DU_PROPRIETAIRE as readonly string[]).includes(e.numero))!
  const reserve = [...ENIGMES_DEJA_VUES_DU_PROPRIETAIRE.map(enigmeDe), neuvieme]
  return avecBanc(midi(26), { enigmesDuSphinx: reserve }, async (banc, horloge) => {
    await ouvrir(banc, await connexionAnimateur(banc.url))
    const proprio = await inscrireProfil(banc.url, 'proprio', 'Antoine', '🦉')
    joue(banc, 'proprio', jours(23, 27))
    // Sans profil tenu par le compte d'administration, rien ne s'est posé — et le drapeau attend.
    assert.equal(base(banc, db => (db.prepare(`SELECT COUNT(*) AS n FROM profile_sphinx`).get() as { n: number }).n), 0)
    // Le compte d'administration tient son profil : au démarrage suivant, ses huit comptent pour vues, une fois.
    base(banc, db => db.prepare(`UPDATE accounts SET profile_id = ? WHERE role = 'admin'`).run(idDe(banc, 'proprio')))
    await banc.redemarrer()
    await banc.redemarrer()
    const vues = base(banc, db => db.prepare(`SELECT enigme, etat FROM profile_sphinx WHERE profile_id = ? ORDER BY enigme`).all(idDe(banc, 'proprio')))
    assert.deepEqual(vues, [...ENIGMES_DEJA_VUES_DU_PROPRIETAIRE].sort().map(enigme => ({ enigme, etat: 'vue' })))
    const sienne = (await leSphinx(banc, proprio)).visite
    assert.equal(sienne.enigme.numero, neuvieme.numero, 'la seule qu’il n’a pas vue')
    // Comptées pour vues, elles ne sont pas des visites : ce n'est que sa première, une facile si la réserve en a.
    assert.equal((await geste(banc, proprio, { geste: 'chat' })).corps.visite.etat, 'abandonnee')
    // Le lendemain, plus rien à lui poser : pas de visite.
    horloge.t = midi(27)
    assert.equal((await leSphinx(banc, proprio)).visite, null)
    assert.ok(!('sphinx' in (await missions(banc, proprio))))
  })
})
