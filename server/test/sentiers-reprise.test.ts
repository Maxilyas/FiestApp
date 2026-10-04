// La reprise des avatars du savoir (`core/repriseDesPortraits.ts`) : jusqu'aux
// sentiers, un portrait s'ouvrait aux bonnes réponses de sa catégorie, en
// soirée comme au quiz du jour. Chacun garde ce qu'il avait, en paliers — k
// portraits valent les 2k premiers paliers de leur sentier —, une fois, au
// premier démarrage qui la connaît ; ensuite, plus rien ne les reprend.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { ADMIN, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { DRAPEAU, SEUILS_D_AVANT, paliersRepris } from '../src/core/repriseDesPortraits'
import { VERSION_BAREME } from '../src/auth/profiles'
import { gainVide, releveVide, totalGain } from '../../shared/profil'

test('les bonnes réponses d’avant valent deux paliers par portrait', () => {
  assert.deepEqual([...SEUILS_D_AVANT], [3, 20, 40, 75, 130, 200], 'les seuils d’avant les sentiers, figés')
  assert.deepEqual(paliersRepris({ Nature: 25, Histoire: 3, Sport: 2, Musique: 200 }), { mythes: 2, foret: 4, scene: 12 })
  assert.deepEqual(paliersRepris({}), {})
})

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Une soirée rangée dans sa carrière : ses bonnes réponses par catégorie — jouée seul, elle ne compte pas. */
function soireeRangee(banc: Banc, profileId: string, soireeId: string, justes: Record<string, number>, seul = false) {
  base(banc, db => {
    const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    const categories = Object.fromEntries(Object.entries(justes).map(([c, n]) => [c, { questions: n + 5, justes: n }]))
    const gain = { ...gainVide(), reponses: seul ? 0 : 50 }
    const detail = JSON.stringify({ v: VERSION_BAREME, gain, releve: { ...releveVide(), categories } })
    db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      profileId,
      soireeId,
      espace,
      totalGain(gain),
      detail,
      Date.now(),
    )
  })
}

const sentiers = async (banc: Banc, cookie: string) =>
  Object.fromEntries(
    ((await (await fetch(`${banc.url}/api/campagne/sentiers`, { headers: { Cookie: cookie } })).json()) as any).sentiers
      .filter((s: any) => s.paliers > 0)
      .map((s: any) => [s.branche, `${s.paliers}/${s.acquis}/${s.etoiles.slice(0, 4).join('')}`]),
  )
const legendaire = async (banc: Banc, cookie: string) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.legendaire

test('au premier démarrage qui la connaît, chacun garde ses portraits en paliers ; ensuite, plus rien ne bouge', async () => {
  const banc = await demarrer()
  try {
    // Une base neuve : le drapeau se pose sans rien parcourir.
    assert.ok(base(banc, db => db.prepare('SELECT 1 FROM meta WHERE key = ?').get(DRAPEAU)), 'posé dès le premier démarrage')

    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    // Alice : vingt-cinq en Nature (deux portraits), trois en Histoire (un),
    // et cent en Sport jouées seule, qui ne comptaient pas. Elle porte le
    // lynx (quarante en Nature) : une soirée retirée le lui avait repris.
    soireeRangee(banc, idDe(banc, 'alice'), 's1', { Nature: 25, Histoire: 3 })
    soireeRangee(banc, idDe(banc, 'alice'), 'seule', { Sport: 100 }, true)
    // Bob : quarante-cinq en Nature, il porte le blaireau, qui est à lui.
    soireeRangee(banc, idDe(banc, 'bob'), 's2', { Nature: 45 })
    base(banc, db => {
      db.prepare(`UPDATE profiles SET legendaire = 'br:lynx' WHERE login = 'alice'`).run()
      db.prepare(`UPDATE profiles SET legendaire = 'br:blaireau' WHERE login = 'bob'`).run()
      // Une base d'avant les sentiers : la reprise n'y a jamais tourné.
      db.prepare('DELETE FROM meta WHERE key = ?').run(DRAPEAU)
    })
    await banc.redemarrer()

    // Deux paliers par portrait, sans étoiles : validés sans épreuve.
    assert.deepEqual(await sentiers(banc, alice), { mythes: '2/2/0000', foret: '4/4/0000' })
    assert.deepEqual(await sentiers(banc, bob), { foret: '6/6/0000' })
    assert.equal(await legendaire(banc, alice), null, 'le lynx, qu’elle n’avait plus, s’ôte')
    assert.equal(await legendaire(banc, bob), 'br:blaireau', 'le blaireau reste')
    // Le blaireau se reprend d'un geste, et le sentier repart du palier suivant.
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'br:blaireau' }, alice, 'PUT')).status, 200)
    const saut = await ecrire(banc.url, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 6 }, alice)
    assert.equal(((await saut.json()) as any).error, 'Valide d’abord le palier 5')

    // Repassée, la reprise ne se rejoue pas : de nouvelles bonnes réponses en soirée n'ouvrent plus rien.
    soireeRangee(banc, idDe(banc, 'alice'), 's3', { Nature: 100 })
    await banc.redemarrer()
    assert.deepEqual(await sentiers(banc, alice), { mythes: '2/2/0000', foret: '4/4/0000' })
    // Et une soirée retirée de l'historique ne reprend rien.
    base(banc, db => db.prepare(`DELETE FROM profile_xp WHERE soiree_id = 's2'`).run())
    await banc.redemarrer()
    assert.deepEqual(await sentiers(banc, bob), { foret: '6/6/0000' })
    assert.equal(await legendaire(banc, bob), 'br:blaireau')
  } finally {
    await banc.close()
  }
})
