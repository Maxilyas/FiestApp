// Le Sphinx de l'accueil, sur un serveur jetable (le plan du 24 novembre
// 2026, `retours/2026-11-24/le-sphinx/plan.md`) : à qui il parle, quand, ce
// qu'il laisse partir, ce qu'il écrit. Le tirage de la visite est fixé
// (`tirageDuSphinx`) : une chance sur trois se vérifie en dérivation pure,
// `sphinx-pur.test.ts`. (`sphinx.test.ts` est celui du légendaire, le Sphinx
// du quiz du jour.)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, cookieDe, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { legendeDe } from '../src/core/divins'
import { ENIGMES_DEJA_VUES_DU_PROPRIETAIRE, ORDRE_DU_SPHINX, enigmesDuSphinx, motsDeLaLegende, type Enigme } from '../src/core/sphinx'
import { jourAvant } from '../../shared/jour'
import { PASSEUR, PASSEUR_A_CHOISIR } from './passeur'

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

/**
 * La réserve de ces épreuves : les énigmes en vers seules. Elles répondent par
 * les réponses acceptées du livre, et une visite sur cinq, sur la vraie
 * réserve, poserait un problème — tiré par l'identifiant de chaque profil,
 * neuf à chaque banc : l'épreuve rougirait une fois sur cinq. Les problèmes ont
 * les leurs, sur le passeur (`passeur.ts`).
 */
const EN_VERS = enigmesDuSphinx().filter(e => e.sorte !== 'probleme')

async function avecBanc(debut: number, reglages: Parameters<typeof demarrer>[0], scenario: (banc: Banc, horloge: { t: number }) => Promise<void>) {
  const horloge = { t: debut }
  // Le Sphinx passe chaque jour qu'il le peut : la chance d'une visite est à part.
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, tirageDuSphinx: () => 0, enigmesDuSphinx: EN_VERS, ...reglages })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

const enigmeDe = (numero: string): Enigme => enigmesDuSphinx().find(e => e.numero === numero)!

/** Les mots cachés d'une légende qu'un profil n'a pas gagnés : aucun ne doit partir vers lui. */
function motsQuIlNaPas(divin: string, siens: ReadonlySet<number>): { place: number; texte: string }[] {
  return motsDeLaLegende(legendeDe(divin)!).flatMap((m, i) => (m.cache && !siens.has(i) ? [{ place: i, texte: m.texte }] : []))
}

/**
 * Une réponse, sans l'énigme (ses vers et sa source disent ce qu'ils veulent) : aucun mot caché qu'il n'a pas ne s'y
 * lit. L'échec dit sa place, jamais le mot : le propriétaire joue aussi, et la sortie des épreuves peut lui être montrée.
 */
function rienQueSesMots(reponse: unknown, divin: string, siens: ReadonlySet<number>, ou: string) {
  const texte = JSON.stringify(reponse, (cle, valeur) => (cle === 'enigme' ? undefined : valeur))
  for (const { place, texte: mot } of motsQuIlNaPas(divin, siens)) {
    assert.ok(!new RegExp(`(^|[^\\p{L}])${mot}([^\\p{L}]|$)`, 'iu').test(texte), `${ou} : le mot caché n° ${place}, qu’il n’a pas gagné`)
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

    // Plus tard : épinglé jusqu'à sa fin.
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

// Le retour du propriétaire, le 24 novembre 2026, au premier jour en
// production : « Est-ce que à chaque fois le sphinx interpelle quand on ouvre
// l'appli ? Il devrait interpeller qu'une seule fois puis c'est à l'utilisateur
// d'ouvrir l'énigme quand il le souhaite. » Une visite proposée surgissait à
// chaque accueil tant qu'on ne l'avait pas remise à plus tard : l'appli fermée
// pendant sa présentation, ou l'énigme ouverte puis quittée, il revenait.
test('le Sphinx ne surgit qu’une fois : arrivé sur l’accueil, ou son énigme écoutée, il s’épingle jusqu’à sa fin', () =>
  avecBanc(midi(26), {}, async banc => {
    await ouvrir(banc, await connexionAnimateur(banc.url))
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐯')
    joue(banc, 'lea', jours(23, 26))
    joue(banc, 'tom', jours(23, 26))

    // Tirée, la visite attend : l'accueil relu avant qu'il n'arrive — une page fermée trop tôt — la fait encore surgir.
    assert.equal((await missions(banc, lea)).sphinx, 'attend')
    assert.equal((await missions(banc, lea)).sphinx, 'attend')
    // Il arrive : rien ne change à la visite, et plus jamais il ne surgit ce jour-là — même après un redémarrage.
    const arrive = await geste(banc, lea, { geste: 'surgir' })
    assert.deepEqual([arrive.status, arrive.corps.accuse, arrive.corps.visite.etat, arrive.corps.visite.essaisRestants], [200, true, 'proposee', 3])
    assert.equal((await missions(banc, lea)).sphinx, 'epingle')
    await banc.redemarrer()
    assert.equal((await missions(banc, lea)).sphinx, 'epingle')
    // L'épingle rouvre la même visite, et l'énigme s'écoute comme avant.
    assert.equal((await leSphinx(banc, lea)).visite.etat, 'proposee')
    assert.equal((await geste(banc, lea, { geste: 'ecouter' })).status, 200)
    assert.equal((await missions(banc, lea)).sphinx, 'epingle')

    // Tom écoute l'énigme sans que son arrivée se soit dite (une page d'avant), puis ferme l'appli : épinglé aussi.
    assert.equal((await missions(banc, tom)).sphinx, 'attend')
    assert.equal((await geste(banc, tom, { geste: 'ecouter' })).corps.visite.etat, 'proposee')
    assert.equal((await missions(banc, tom)).sphinx, 'epingle')
  }))

// Le choix du propriétaire, le 25 novembre 2026 : « peut-être qu'il s'en fout
// […] garder l'énigme pas uniquement la journée mais jusqu'à la résolution ».
// Elle mourait à minuit : ignorée, elle comptait pour vue et ne revenait
// jamais, et le Sphinx en reposait une autre trois jours plus tard.
const visitesDe = (banc: Banc, login: string) =>
  base(banc, db => (db.prepare('SELECT COUNT(*) AS n FROM profile_sphinx WHERE profile_id = ?').get(idDe(banc, login)) as { n: number }).n)
/** Une réponse que le Sphinx ne prend ni pour juste ni pour brûlante. */
const RATEE = 'zzzz'

test('une énigme reste jusqu’à sa fin : épinglée les jours suivants, ses essais gardés, sans autre visite ; finie, il ne repasse pas le même jour', () =>
  avecBanc(midi(22), {}, async (banc, horloge) => {
    await ouvrir(banc, await connexionAnimateur(banc.url))
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    joue(banc, 'lea', jours(16, 28))
    assert.equal((await missions(banc, lea)).sphinx, 'attend')
    const posee = (await leSphinx(banc, lea)).visite
    assert.equal((await geste(banc, lea, { geste: 'surgir' })).status, 200)
    // Le lendemain, puis deux jours après : la même, épinglée — et pas une de plus.
    for (const jour of [23, 25]) {
      horloge.t = midi(jour)
      assert.equal((await missions(banc, lea)).sphinx, 'epingle', `le ${jour}`)
      const v = (await leSphinx(banc, lea)).visite
      assert.deepEqual([v.enigme.numero, v.jour, v.etat, v.essaisRestants], [posee.enigme.numero, septembre(22), 'proposee', 3], `le ${jour}`)
    }
    assert.equal(visitesDe(banc, 'lea'), 1)
    // Essayée, puis remise à plus tard : ses essais la suivent d'un jour à l'autre, et d'un redémarrage.
    assert.equal((await geste(banc, lea, { geste: 'repondre', reponse: RATEE })).corps.visite.essaisRestants, 2)
    assert.equal((await geste(banc, lea, { geste: 'plus-tard' })).corps.visite.etat, 'plus-tard')
    await banc.redemarrer()
    horloge.t = midi(26)
    assert.equal((await missions(banc, lea)).sphinx, 'epingle')
    const juste = await geste(banc, lea, { geste: 'repondre', reponse: enigmeDe(posee.enigme.numero).acceptees[0] })
    assert.deepEqual([juste.status, juste.corps.verdict, juste.corps.visite.jour, juste.corps.visite.essaisRestants], [200, 'juste', septembre(22), 1])
    assert.ok(juste.corps.visite.mot, 'résolue un autre jour, elle souffle son mot')
    // Finie aujourd'hui : il ne repasse pas ce jour-là, et sa page la montre close.
    assert.ok(!('sphinx' in (await missions(banc, lea))))
    assert.equal((await leSphinx(banc, lea)).visite.etat, 'resolue')
    assert.equal((await geste(banc, lea, { geste: 'repondre', reponse: RATEE })).status, 409)
    assert.equal(visitesDe(banc, 'lea'), 1)
    // Le lendemain, une autre — et elle surgit : il a joué celle d'avant.
    horloge.t = midi(27)
    assert.equal((await missions(banc, lea)).sphinx, 'attend')
    const suivante = (await leSphinx(banc, lea)).visite
    assert.deepEqual([suivante.jour, suivante.etat], [septembre(27), 'proposee'])
    assert.notEqual(suivante.enigme.numero, posee.enigme.numero)
  }))

test('une visite d’avant, restée ouverte sous la règle de minuit, attend encore si c’est sa dernière ; suivie d’une autre, elle ne revient pas', () =>
  avecBanc(midi(26), {}, async banc => {
    await ouvrir(banc, await connexionAnimateur(banc.url))
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐯')
    joue(banc, 'lea', jours(20, 26))
    joue(banc, 'tom', jours(20, 26))
    const [facile, autre, troisieme] = EN_VERS.filter(e => e.difficulte === 'facile')
    const poser = (login: string, jour: string, enigme: string, etat: string, ecoutee: number | null) =>
      base(banc, db =>
        db
          .prepare(`INSERT INTO profile_sphinx (profile_id, jour, enigme, divin, etat, proposee_le, ecoutee_le) VALUES (?, ?, ?, ?, ?, 1, ?)`)
          .run(idDe(banc, login), jour, enigme, DIVIN_DU_MOMENT, etat, ecoutee),
      )
    // Léa avait laissé la sienne d'avant-hier sans répondre, déjà écoutée : elle l'attend, épinglée.
    poser('lea', septembre(24), facile.numero, 'plus-tard', 1)
    // Tom en avait laissé une, puis abandonné la suivante : la première ne revient pas.
    poser('tom', septembre(21), autre.numero, 'proposee', null)
    poser('tom', septembre(23), troisieme.numero, 'abandonnee', 1)
    await banc.redemarrer()
    assert.equal((await missions(banc, lea)).sphinx, 'epingle')
    assert.equal((await leSphinx(banc, lea)).visite.enigme.numero, facile.numero)
    // Tom : une visite neuve, épinglée sans surgir — il avait donné sa langue au chat sans un essai.
    assert.equal((await missions(banc, tom)).sphinx, 'epingle')
    const deTom = (await leSphinx(banc, tom)).visite
    assert.deepEqual([deTom.jour, deTom.etat], [septembre(26), 'proposee'])
    assert.ok(![autre.numero, troisieme.numero].includes(deTom.enigme.numero), 'une énigme qu’il n’a jamais vue')
  }))

test('la suivante ne surgit que s’il a joué celle d’avant : sa langue au chat sans un essai, elle s’épingle en silence', () =>
  avecBanc(midi(22), {}, async (banc, horloge) => {
    await ouvrir(banc, await connexionAnimateur(banc.url))
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐯')
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    joue(banc, 'tom', jours(16, 28))
    joue(banc, 'lea', jours(16, 28))
    // Sa toute première surgit toujours. Tom n'en veut pas : il donne sa langue au chat sans rien essayer.
    assert.equal((await missions(banc, tom)).sphinx, 'attend')
    assert.equal((await geste(banc, tom, { geste: 'chat' })).corps.visite.etat, 'abandonnee')
    // Léa essaie une fois, puis abandonne.
    assert.equal((await missions(banc, lea)).sphinx, 'attend')
    assert.equal((await geste(banc, lea, { geste: 'repondre', reponse: RATEE })).corps.verdict, 'faux')
    assert.equal((await geste(banc, lea, { geste: 'chat' })).corps.visite.etat, 'abandonnee')

    horloge.t = midi(23)
    // Chez Tom, la suivante attend épinglée, sans surgir — relue, et après un redémarrage : rien ne l'écrit, tout se lit.
    assert.equal((await missions(banc, tom)).sphinx, 'epingle')
    assert.equal((await missions(banc, tom)).sphinx, 'epingle')
    await banc.redemarrer()
    assert.equal((await missions(banc, tom)).sphinx, 'epingle')
    const deTom = (await leSphinx(banc, tom)).visite
    assert.deepEqual([deTom.jour, deTom.etat, deTom.essaisRestants], [septembre(23), 'proposee', 3])
    // Chez Léa, elle surgit.
    assert.equal((await missions(banc, lea)).sphinx, 'attend')
    // Tom l'ouvre de lui-même, par l'épingle, et la résout : la suivante surgira chez lui aussi.
    assert.equal((await geste(banc, tom, { geste: 'ecouter' })).status, 200)
    assert.equal((await geste(banc, tom, { geste: 'repondre', reponse: enigmeDe(deTom.enigme.numero).acceptees[0] })).corps.verdict, 'juste')
    horloge.t = midi(24)
    assert.equal((await missions(banc, tom)).sphinx, 'attend')
  }))

test('une énigme qui a attendu souffle un mot du Divin du moment à sa fin, pas de celui dont tous ont retrouvé la phrase entre-temps', () =>
  avecBanc(midi(26), {}, async (banc, horloge) => {
    await ouvrir(banc, await connexionAnimateur(banc.url))
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const ana = await inscrireProfil(banc.url, 'ana', 'Ana', '🐸')
    await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    joue(banc, 'lea', jours(20, 28))
    joue(banc, 'ana', jours(20, 28))
    // Bob a trouvé tous les mots cachés du Divin du moment, sauf un, en autant de visites d'avant.
    const caches = motsDeLaLegende(legendeDe(DIVIN_DU_MOMENT)!).flatMap((m, i) => (m.cache ? [i] : []))
    base(banc, db =>
      caches.slice(1).forEach((mot, i) =>
        db
          .prepare(`INSERT INTO profile_sphinx (profile_id, jour, enigme, divin, etat, essais, mot, proposee_le) VALUES (?, ?, ?, ?, 'resolue', 1, ?, 1)`)
          .run(idDe(banc, 'bob'), jourAvant('2026-08-01', i), `x${i}`, DIVIN_DU_MOMENT, mot),
      ),
    )
    await banc.redemarrer()
    // Léa reçoit sa visite et la remet à plus tard.
    assert.equal((await missions(banc, lea)).sphinx, 'attend')
    const deLea = (await leSphinx(banc, lea)).visite
    assert.equal(deLea.divin.key, DIVIN_DU_MOMENT)
    assert.equal((await geste(banc, lea, { geste: 'plus-tard' })).status, 200)
    // Ana résout la sienne : le dernier mot, la phrase reconstituée — le Divin du moment passe au suivant.
    const deAna = (await leSphinx(banc, ana)).visite
    const dAna = (await geste(banc, ana, { geste: 'repondre', reponse: enigmeDe(deAna.enigme.numero).acceptees[0] })).corps
    assert.deepEqual([dAna.verdict, dAna.visite.mot.index], ['juste', caches[0]])
    const SUIVANT = ORDRE_DU_SPHINX[1]
    assert.equal((await leSphinx(banc, lea)).phrase.divin.key, SUIVANT)

    // Le lendemain, Léa retrouve son énigme : elle vise le Divin du moment, et sa fin en souffle un mot.
    horloge.t = midi(27)
    const attend = (await leSphinx(banc, lea)).visite
    assert.deepEqual([attend.enigme.numero, attend.jour, attend.divin.key, attend.phrase.divin.key], [deLea.enigme.numero, septembre(26), SUIVANT, SUIVANT])
    rienQueSesMots(attend, SUIVANT, new Set(), 'Léa, son énigme qui attend')
    const sonMot = (await geste(banc, lea, { geste: 'repondre', reponse: enigmeDe(deLea.enigme.numero).acceptees[0] })).corps
    assert.deepEqual([sonMot.verdict, sonMot.motNeuf, sonMot.visite.divin.key], ['juste', true, SUIVANT])
    const duSuivant = motsDeLaLegende(legendeDe(SUIVANT)!)
    assert.ok(duSuivant[sonMot.visite.mot.index]?.cache, 'un mot caché de la phrase du Divin du moment')
    assert.ok(sonMot.visite.mot.texte === duSuivant[sonMot.visite.mot.index].texte, 'son texte, à sa place')
    rienQueSesMots(sonMot, SUIVANT, new Set([sonMot.visite.mot.index]), 'Léa, son mot')
    // Rangé sous ce Divin : sa phrase le compte, et tous avec elle — après un redémarrage aussi.
    await banc.redemarrer()
    const relue = await leSphinx(banc, lea)
    assert.deepEqual([relue.phrase.divin.key, relue.phrase.siens, relue.phrase.parTous], [SUIVANT, 1, 1])
    assert.equal(relue.visite.divin.key, SUIVANT)
  }))

// Le premier retour de la production, le 24 novembre 2026 : « Je vois nulle
// part où rentrer le mot des autres. » Sur la phrase inventée de la maquette
// (`phraseInventeeDuSphinx`) : ses mots s'écrivent ici sans rien dévoiler.
const INVENTEE = 'Il descend sur qui défie le temps sans jamais perdre l’heure de son rendez-vous.'
const placeDe = (texte: string) => motsDeLaLegende(INVENTEE).findIndex(m => m.texte === texte)

/** Des mots trouvés par un profil, des visites résolues les jours d'avant — comme les rendus les écrivent. */
function aTrouve(banc: Banc, login: string, textes: readonly string[]) {
  const id = idDe(banc, login)
  base(banc, db => {
    textes.forEach((texte, k) =>
      db
        .prepare(`INSERT INTO profile_sphinx (profile_id, jour, enigme, divin, etat, essais, reponses, mot, proposee_le, close_le) VALUES (?, ?, ?, ?, 'resolue', 1, '[]', ?, 1, 2)`)
        .run(id, septembre(1 + k), `essai-${k}`, DIVIN_DU_MOMENT, placeDe(texte)),
    )
  })
}

test('un mot qu’on t’a dit s’inscrit sur ton trait : juste et déjà trouvé, il se retourne ; cinq erreurs par jour ; et à qui demander', () =>
  avecBanc(midi(26), { phraseInventeeDuSphinx: INVENTEE }, async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐯')
    await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    const inscrire = (cookie: string, corps: unknown) =>
      ecrire(banc.url, '/api/joueur/sphinx/inscrire', corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
    const descend = { divin: DIVIN_DU_MOMENT, place: placeDe('descend'), mot: 'DESCEND' }
    // Sa page fermée, sa porte aussi.
    assert.equal((await inscrire(tom, descend)).status, 423)
    await ouvrir(banc, admin)

    // Léa a trouvé deux mots, Zoé un ; les mots de tous se relisent au démarrage.
    aTrouve(banc, 'lea', ['descend', 'temps'])
    aTrouve(banc, 'zoe', ['défie'])
    await banc.redemarrer()

    // Tom n'en a aucun : il voit qui en a, et combien — jamais lesquels, ni lui-même.
    const avant = (await leSphinx(banc, tom)).phrase
    assert.deepEqual(
      avant.quiADesMots.map((q: any) => [q.nom, q.mots]),
      [
        ['Léa', 2],
        ['Zoé', 1],
      ],
    )
    for (const cache of ['descend', 'temps', 'défie']) assert.ok(!JSON.stringify(avant).includes(cache), `${cache} ne part pas vers Tom`)

    // Un mot juste que personne n'a trouvé : la même réponse qu'un faux, et une erreur de moins.
    const personne = await inscrire(tom, { divin: DIVIN_DU_MOMENT, place: placeDe('jamais'), mot: 'jamais' })
    assert.deepEqual([personne.status, personne.corps.juste, personne.corps.erreursRestantes], [200, false, 4])
    assert.equal(personne.corps.phrase.mots[placeDe('jamais')].texte, undefined)
    // Celui que Léa lui a dit, tapé comme il vient : il se retourne, en argent, et ne coûte rien.
    const juste = await inscrire(tom, descend)
    assert.deepEqual([juste.status, juste.corps.juste, juste.corps.erreursRestantes], [200, true, 4])
    assert.deepEqual(juste.corps.phrase.mots[placeDe('descend')], { forme: '_______', texte: 'descend', appris: true })
    assert.deepEqual([juste.corps.phrase.siens, juste.corps.phrase.appris], [0, 1])
    // Il le garde, sur tous ses appareils, après un redémarrage ; il ne s'inscrit pas deux fois.
    await banc.redemarrer()
    assert.equal((await leSphinx(banc, tom)).phrase.mots[placeDe('descend')].appris, true)
    assert.equal((await inscrire(tom, descend)).status, 409)
    // Un petit mot offert ne s'inscrit pas, un Divin inconnu non plus.
    assert.equal((await inscrire(tom, { divin: DIVIN_DU_MOMENT, place: placeDe('sur'), mot: 'sur' })).status, 400)
    assert.equal((await inscrire(tom, { divin: 'dv:inconnu', place: 1, mot: 'x' })).status, 400)
    // Appris n'est pas trouvé : il ne rejoint pas ceux à qui demander, et Léa ne voit que Zoé.
    assert.deepEqual(
      (await leSphinx(banc, lea)).phrase.quiADesMots.map((q: any) => q.nom),
      ['Zoé'],
    )

    // Cinq erreurs par jour : au-delà, il demande, il ne devine plus — même juste.
    for (const restantes of [3, 2, 1, 0]) {
      assert.equal((await inscrire(tom, { divin: DIVIN_DU_MOMENT, place: placeDe('temps'), mot: 'tempête' })).corps.erreursRestantes, restantes)
    }
    const plusRien = await inscrire(tom, { divin: DIVIN_DU_MOMENT, place: placeDe('temps'), mot: 'temps' })
    assert.equal(plusRien.status, 429)
    assert.match(plusRien.corps.error, /demande/)
    // Le lendemain, ses erreurs sont neuves.
    horloge.t += 24 * 3_600_000
    const lendemain = await inscrire(tom, { divin: DIVIN_DU_MOMENT, place: placeDe('temps'), mot: 'Temps' })
    assert.deepEqual([lendemain.corps.juste, lendemain.corps.erreursRestantes, lendemain.corps.phrase.appris], [true, 5, 2])
  }))

test('le mot gagné : d’abord un que personne n’a ; une énigme vue ne revient jamais ; un profil supprimé emporte ses lignes', () =>
  avecBanc(midi(20), {}, async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    await ouvrir(banc, admin)
    const cleo = await inscrireProfil(banc.url, 'cleo', 'Cléo', '🐙')
    const dede = await inscrireProfil(banc.url, 'dede', 'Dédé', '🐸')
    const eve = await inscrireProfil(banc.url, 'eve', 'Ève', '🐨')
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    for (const qui of ['cleo', 'dede', 'eve', 'lea']) joue(banc, qui, jours(14, 28))
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

    // Dédé résout la sienne le même jour, après Cléo : le premier du jour n'emporte plus le mot neuf (le choix du
    // propriétaire du 26 novembre 2026, « ça tombe toujours sur celui qui se lève le plus tôt »). Chaque énigme résolue a
    // la même chance — une par jour jusqu'ici, elle est entière : un second mot neuf.
    const deDede = (await leSphinx(banc, dede)).visite
    const sonMot = (await geste(banc, dede, { geste: 'repondre', reponse: enigmeDe(deDede.enigme.numero).solution })).corps
    assert.deepEqual([sonMot.verdict, sonMot.motNeuf, sonMot.pasLeMotNeuf], ['juste', true, undefined])
    assert.ok(!sesMots.has(sonMot.visite.mot.index), 'un mot que personne n’avait')
    // Ève, la troisième : deux mots neufs par jour au plus (`MOTS_NEUFS_PAR_JOUR_MAX`). Elle repart avec un mot que
    // d'autres avaient, et le Sphinx dit pourquoi.
    const deTous = new Set([...sesMots, sonMot.visite.mot.index])
    const dEve = (await leSphinx(banc, eve)).visite
    const sonMotAElle = (await geste(banc, eve, { geste: 'repondre', reponse: enigmeDe(dEve.enigme.numero).solution })).corps
    assert.deepEqual([sonMotAElle.verdict, sonMotAElle.motNeuf, sonMotAElle.pasLeMotNeuf], ['juste', false, true])
    assert.ok(deTous.has(sonMotAElle.visite.mot.index), 'un mot déjà trouvé, qu’elle n’avait pas')
    // Léa voit combien ils en ont trouvé ensemble, jamais lesquels.
    const deLea = await leSphinx(banc, lea)
    assert.equal(deLea.phrase.parTous, deTous.size)
    assert.equal(deLea.phrase.siens, 0)
    rienQueSesMots(deLea, DIVIN_DU_MOMENT, new Set(), 'Léa')
    // Le chat clôt la sienne sans rien lui donner.
    const chat = (await geste(banc, lea, { geste: 'chat' })).corps
    assert.deepEqual([chat.verdict, chat.visite.etat, chat.visite.mot], ['abandon', 'abandonnee', undefined])
    assert.ok(chat.visite.enigme.solution)

    // Cléo supprimée : ses lignes partent avec elle, et ses mots du compte de tous — restent ceux de Dédé et d'Ève.
    const idDeCleo = idDe(banc, 'cleo')
    assert.equal((await ecrire(banc.url, `/api/admin/profils/${idDeCleo}`, undefined, admin, 'DELETE')).status, 200)
    assert.equal(base(banc, db => (db.prepare('SELECT COUNT(*) AS n FROM profile_sphinx WHERE profile_id = ?').get(idDeCleo) as { n: number }).n), 0)
    assert.equal((await leSphinx(banc, lea)).phrase.parTous, new Set([sonMot.visite.mot.index, sonMotAElle.visite.mot.index]).size)
  }))

test('une phrase reconstituée par tous ne s’impose à personne — chacun la lit s’il le choisit —, et le Divin du moment passe au suivant', () =>
  avecBanc(midi(26), {}, async banc => {
    const admin = await connexionAnimateur(banc.url)
    await ouvrir(banc, admin)
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
    // La phrase est reconstituée, et le Sphinx passe au suivant. Elle ne s'impose à personne (la décision du 24 novembre
    // 2026) : ni Léa ni Bob ne la reçoivent entière — chacun ses mots, la forme du reste, et qu'elle se dévoile à sa demande.
    const siensDe = new Map([
      [lea, new Set([caches[0]])],
      [bob, new Set(caches.slice(1))],
    ])
    for (const [cookie, siens] of siensDe) {
      const apres = await leSphinx(banc, cookie)
      assert.equal(apres.reconstituees.length, 1)
      const r = apres.reconstituees[0]
      assert.deepEqual([r.divin.key, r.reconstituee, r.aDevoiler, 'legende' in r], [DIVIN_DU_MOMENT, true, true, false])
      rienQueSesMots(apres, DIVIN_DU_MOMENT, siens, 'la phrase retrouvée, pas choisie')
      assert.equal(apres.phrase.divin.key, ORDRE_DU_SPHINX[1])
      assert.equal(apres.phrase.parTous, 0)
    }
    // Sa visite garde son Divin : retrouvée, et pas entière pour autant.
    assert.deepEqual([juste.visite.phrase.reconstituee, juste.visite.phrase.aDevoiler], [true, true])
    rienQueSesMots(juste, DIVIN_DU_MOMENT, siensDe.get(lea)!, 'le verdict')

    // Une phrase pas encore retrouvée ne se lit pas ; un Divin inconnu non plus.
    assert.equal((await ecrire(banc.url, '/api/joueur/sphinx/phrase', { divin: ORDRE_DU_SPHINX[1] }, lea)).status, 409)
    assert.equal((await ecrire(banc.url, '/api/joueur/sphinx/phrase', { divin: 'dv:personne' }, lea)).status, 400)
    // Léa choisit de la lire : entière, pour de bon, et sur tous ses appareils.
    const lue = await ecrire(banc.url, '/api/joueur/sphinx/phrase', { divin: DIVIN_DU_MOMENT }, lea)
    assert.equal(lue.status, 200)
    const corps = (await lue.json()) as any
    assert.ok(corps.accuse && corps.phrase.legende === legendeDe(DIVIN_DU_MOMENT), 'la phrase entière, ponctuation comprise')
    assert.ok(corps.phrase.mots.every((m: any) => m.texte) && !corps.phrase.aDevoiler)
    const autreAppareil = cookieDe(await ecrire(banc.url, '/api/joueur/connexion', { login: 'lea', password: 'motdepasse1' }), 'qz_joueur')
    for (const cookie of [lea, autreAppareil]) {
      const r = (await leSphinx(banc, cookie)).reconstituees[0]
      assert.ok(r.legende === legendeDe(DIVIN_DU_MOMENT) && r.mots.every((m: any) => m.texte), 'entière sur chacun de ses appareils')
    }
    // Rien n'a changé pour Bob, ni pour les mots de tous : la ligne de son choix n'est ni une visite ni un mot.
    rienQueSesMots(await leSphinx(banc, bob), DIVIN_DU_MOMENT, siensDe.get(bob)!, 'Bob, après le choix de Léa')
    assert.equal((await leSphinx(banc, bob)).reconstituees[0].parTous, caches.length)
    // Un second geste ne change rien ; la page fermée, sa porte se ferme aussi.
    assert.equal((await ecrire(banc.url, '/api/joueur/sphinx/phrase', { divin: DIVIN_DU_MOMENT }, lea)).status, 200)
    await ouvrir(banc, admin, 'maintenance')
    assert.equal((await ecrire(banc.url, '/api/joueur/sphinx/phrase', { divin: DIVIN_DU_MOMENT }, bob)).status, 423)
  }))

// Le choix du propriétaire du 26 novembre 2026 : « que les gens puissent finir tout seuls par dévoiler l'énigme en ayant
// tous les mots […] avoir le choix de continuer à avoir des mots sur un Divin même si ceux-ci ont déjà été découverts ».
test('une phrase retrouvée par tous, chacun peut la finir avec le Sphinx, mot à mot — ou revenir au Divin du moment', () =>
  avecBanc(midi(20), {}, async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    await ouvrir(banc, admin)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const ana = await inscrireProfil(banc.url, 'ana', 'Ana', '🐸')
    for (const qui of ['lea', 'ana']) joue(banc, qui, jours(14, 28))
    const caches = motsDeLaLegende(legendeDe(DIVIN_DU_MOMENT)!).flatMap((m, i) => (m.cache ? [i] : []))
    const SUIVANT = ORDRE_DU_SPHINX[1]
    // Bob a retrouvé à lui seul toute la phrase du premier Divin ; Léa en avait trouvé chaque mot, sauf deux.
    const poser = (login: string, lesquels: readonly number[]) =>
      base(banc, db =>
        lesquels.forEach((mot, i) =>
          db
            .prepare(`INSERT INTO profile_sphinx (profile_id, jour, enigme, divin, etat, essais, mot, proposee_le) VALUES (?, ?, ?, ?, 'resolue', 1, ?, 1)`)
            .run(idDe(banc, login), jourAvant('2026-08-01', i), `x${login}${i}`, DIVIN_DU_MOMENT, mot),
        ),
      )
    poser('bob', caches)
    poser('lea', caches.slice(2))
    // Ana porte le Divin du moment, le suivant : elle en connaît la légende.
    base(banc, db =>
      db
        .prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#essai', '', '✨', 'Divin', 1)`)
        .run(idDe(banc, 'ana'), SUIVANT),
    )
    await banc.redemarrer()
    const finir = (cookie: string, divin: unknown) =>
      ecrire(banc.url, '/api/joueur/sphinx/finir', { divin }, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

    const avant = await leSphinx(banc, lea)
    assert.deepEqual([avant.phrase.divin.key, avant.aFinir, avant.visite.divin.key], [SUIVANT, undefined, SUIVANT], 'd’office, le Divin du moment')
    // Une phrase qui attend encore des mots, un Divin inconnu, une phrase qu'on connaît déjà entière : refusés.
    assert.equal((await finir(lea, SUIVANT)).status, 409)
    assert.equal((await finir(lea, 'dv:personne')).status, 400)
    assert.equal((await finir(bob, DIVIN_DU_MOMENT)).status, 409)

    // Léa choisit de la finir : sa visite en cours, posée pour le Divin du moment, lui en soufflera un mot.
    const choisie = await finir(lea, DIVIN_DU_MOMENT)
    assert.deepEqual([choisie.status, choisie.corps.aFinir], [200, { divin: { key: DIVIN_DU_MOMENT, nom: avant.reconstituees[0].divin.nom }, choisie: true }])
    const ouverte = await leSphinx(banc, lea)
    assert.deepEqual(
      [ouverte.aFinir.divin.key, ouverte.visite.divin.key, ouverte.visite.phrase.divin.key, ouverte.phrase.divin.key],
      [DIVIN_DU_MOMENT, DIVIN_DU_MOMENT, DIVIN_DU_MOMENT, SUIVANT],
    )
    const premier = (await geste(banc, lea, { geste: 'repondre', reponse: enigmeDe(ouverte.visite.enigme.numero).solution })).corps
    // Un mot qu'elle n'avait pas, que d'autres avaient : ni neuf, ni « pas le mot neuf » — celui-là se joue au Divin du moment.
    assert.deepEqual([premier.verdict, premier.motNeuf, premier.pasLeMotNeuf, premier.retrouvee], ['juste', false, undefined, undefined])
    assert.ok(caches.slice(0, 2).includes(premier.visite.mot.index), 'un des deux qui lui manquaient')
    assert.deepEqual([premier.visite.phrase.siens, 'legende' in premier.visite.phrase], [caches.length - 1, false])
    rienQueSesMots(premier, DIVIN_DU_MOMENT, new Set([...caches.slice(2), premier.visite.mot.index]), 'son mot de la suite')
    assert.equal(premier.phrase.divin.key, SUIVANT, 'la chasse commune n’a pas bougé')

    // Elle revient au Divin du moment : la visite du lendemain en vient.
    const revenue = await finir(lea, null)
    assert.deepEqual([revenue.status, revenue.corps.aFinir], [200, null])
    horloge.t = midi(21)
    assert.equal((await leSphinx(banc, lea)).visite.divin.key, SUIVANT)
    // Puis elle la choisit de nouveau, et trouve le dernier mot : elle l'a finie elle-même, la voici entière.
    assert.equal((await finir(lea, DIVIN_DU_MOMENT)).status, 200)
    const reprise = (await leSphinx(banc, lea)).visite
    assert.equal(reprise.divin.key, DIVIN_DU_MOMENT)
    const dernier = (await geste(banc, lea, { geste: 'repondre', reponse: enigmeDe(reprise.enigme.numero).solution })).corps
    assert.equal(dernier.verdict, 'juste')
    assert.equal(dernier.visite.phrase.legende, legendeDe(DIVIN_DU_MOMENT))
    // Le Sphinx revient de lui-même au Divin du moment, et une phrase finie ne se choisit plus.
    const finie = await leSphinx(banc, lea)
    assert.deepEqual([finie.aFinir, finie.reconstituees[0].legende === legendeDe(DIVIN_DU_MOMENT)], [undefined, true])
    assert.equal((await finir(lea, DIVIN_DU_MOMENT)).status, 409)
    horloge.t = midi(22)
    assert.equal((await leSphinx(banc, lea)).visite.divin.key, SUIVANT)

    // Ana porte le Divin du moment : il n'a rien à lui en souffler, et finit avec elle la plus ancienne qui lui manque.
    const dAna = await leSphinx(banc, ana)
    assert.deepEqual([dAna.aFinir, dAna.visite.divin.key], [{ divin: { key: DIVIN_DU_MOMENT, nom: avant.reconstituees[0].divin.nom }, choisie: false }, DIVIN_DU_MOMENT])
    // Sa porte se ferme avec la page.
    await ouvrir(banc, admin, 'maintenance')
    assert.equal((await finir(lea, null)).status, 423)
  }))

test('qui porte le Divin, ou en a trouvé chaque mot, voit sa phrase retrouvée sans geste', () =>
  avecBanc(midi(26), {}, async banc => {
    await ouvrir(banc, await connexionAnimateur(banc.url))
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const ana = await inscrireProfil(banc.url, 'ana', 'Ana', '🐸')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    const caches = motsDeLaLegende(legendeDe(DIVIN_DU_MOMENT)!).flatMap((m, i) => (m.cache ? [i] : []))
    // Bob a trouvé chaque mot, à lui seul.
    base(banc, db =>
      caches.forEach((mot, i) =>
        db
          .prepare(`INSERT INTO profile_sphinx (profile_id, jour, enigme, divin, etat, essais, mot, proposee_le) VALUES (?, ?, ?, ?, 'resolue', 1, ?, 1)`)
          .run(idDe(banc, 'bob'), jourAvant('2026-08-01', i), `x${i}`, DIVIN_DU_MOMENT, mot),
      ),
    )
    // Ana porte ce Divin : elle en connaît la légende.
    base(banc, db =>
      db
        .prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#essai', '', '✨', 'Divin', 1)`)
        .run(idDe(banc, 'ana'), DIVIN_DU_MOMENT),
    )
    await banc.redemarrer()
    for (const [qui, cookie] of [
      ['Bob, qui a tout trouvé', bob],
      ['Ana, qui le porte', ana],
    ] as const) {
      const r = (await leSphinx(banc, cookie)).reconstituees[0]
      assert.ok(r.legende === legendeDe(DIVIN_DU_MOMENT) && !r.aDevoiler, `${qui} la voit entière`)
    }
    // Zoé, ni l'un ni l'autre : rien de plus que la forme.
    const deZoe = await leSphinx(banc, zoe)
    assert.equal(deZoe.reconstituees[0].aDevoiler, true)
    rienQueSesMots(deZoe, DIVIN_DU_MOMENT, new Set(), 'Zoé')
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

// ── Les problèmes ─────────────────────────────────────────────────────────

// Une visite sur cinq, un problème (le souhait du propriétaire du 25 novembre
// 2026) : sa réponse et sa solution pas à pas ne partent qu'une fois la visite
// close, comme la solution d'une énigme. Le banc ne pose que le passeur, que
// tout le monde connaît (`passeur.ts`).
test('un problème à nombre : son récit et sa question partent, jamais sa réponse ; trois essais ; résolu, sa solution pas à pas et son mot', () =>
  avecBanc(midi(26), { enigmesDuSphinx: [PASSEUR] }, async banc => {
    await ouvrir(banc, await connexionAnimateur(banc.url))
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    joue(banc, 'lea', jours(20, 26))
    assert.equal((await missions(banc, lea)).sphinx, 'attend')
    const v = (await leSphinx(banc, lea)).visite
    assert.deepEqual([v.enigme.sorte, v.enigme.numero, v.essaisRestants, v.enigme.vers], ['probleme', PASSEUR.numero, 3, []])
    assert.deepEqual(v.enigme.probleme, {
      titre: PASSEUR.probleme!.titre,
      recit: PASSEUR.probleme!.recit,
      question: PASSEUR.probleme!.question,
      aide: PASSEUR.probleme!.aide,
      figure: PASSEUR.probleme!.figure,
      reponse: { sorte: 'nombre' },
      source: PASSEUR.probleme!.source,
    })
    // Ni sa valeur, ni sa solution, ni son explication avant la fin.
    const avant = JSON.stringify(v)
    for (const champ of ['valeur', 'solution', 'explication', 'bonne', 'acceptees']) assert.ok(!avant.includes(`"${champ}"`), `« ${champ} » avant la fin`)
    assert.equal(v.enigme.source.recueil, PASSEUR.probleme!.source.texte, 'sa source à lui, pas le recueil de 1858')

    // Un mot n'est pas un nombre : redemandé, sans coûter d'essai.
    const illisible = await geste(banc, lea, { geste: 'repondre', reponse: 'beaucoup' })
    assert.deepEqual([illisible.status, illisible.corps.error], [400, 'Écris un nombre : en chiffres, comme 12.'])
    const faux = await geste(banc, lea, { geste: 'repondre', reponse: '5' })
    assert.deepEqual([faux.corps.verdict, faux.corps.visite.essaisRestants], ['faux', 2])
    assert.equal(faux.corps.visite.enigme.explication, undefined, 'toujours rien avant la fin')
    const redit = await geste(banc, lea, { geste: 'repondre', reponse: 'cinq' })
    assert.deepEqual([redit.corps.dejaDite, redit.corps.visite.essaisRestants], [true, 2])
    const juste = await geste(banc, lea, { geste: 'repondre', reponse: 'sept' })
    assert.deepEqual([juste.corps.verdict, juste.corps.visite.etat], ['juste', 'resolue'])
    assert.equal(juste.corps.visite.enigme.solution, PASSEUR.solution)
    assert.deepEqual(juste.corps.visite.enigme.explication, PASSEUR.probleme!.explication)
    assert.ok(juste.corps.visite.mot, 'résolu, il souffle son mot comme une énigme')
  }))

test('un problème à choisir se joue d’un seul toucher : une mauvaise proposition le perd, et sa solution part avec la bonne', () =>
  avecBanc(midi(26), { enigmesDuSphinx: [PASSEUR_A_CHOISIR] }, async banc => {
    await ouvrir(banc, await connexionAnimateur(banc.url))
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐯')
    joue(banc, 'tom', jours(20, 26))
    const v = (await leSphinx(banc, tom)).visite
    assert.equal(v.essaisRestants, 1)
    assert.deepEqual(v.enigme.probleme.reponse, { sorte: 'choix', propositions: [{ texte: 'Le loup', emoji: '🐺' }, { texte: 'La chèvre', emoji: '🐐' }, { texte: 'Le chou', emoji: '🥬' }] })
    assert.equal(v.enigme.bonne, undefined)
    // Une place hors de la liste ne se joue pas.
    assert.equal((await geste(banc, tom, { geste: 'repondre', reponse: '3' })).status, 400)
    const perdu = await geste(banc, tom, { geste: 'repondre', reponse: '0' })
    assert.deepEqual([perdu.corps.verdict, perdu.corps.visite.etat, perdu.corps.visite.essaisRestants], ['perdu', 'perdue', 0])
    assert.deepEqual([perdu.corps.visite.enigme.bonne, perdu.corps.visite.enigme.solution], [1, PASSEUR_A_CHOISIR.solution])
    assert.equal(perdu.corps.visite.enigme.explication.length, PASSEUR.probleme!.explication.length, 'perdu, il voit quand même la solution')
    assert.equal(perdu.corps.visite.mot, undefined)
  }))
