// S'occuper de son compagnon, de bout en bout sur un serveur jetable (la
// maquette validée le 20 octobre 2026, `retours/2026-10-20/mon-compagnon/`) :
// trois envies par jour, le cadeau qu'elles ouvrent — une fois, tiré une
// fois —, la complicité qui fait grandir son terrain et le grand cadeau tous
// les sept jours, la cueillette et son record, son jardin vérifié place par
// place, les deux légendaires de leurs exploits, et rien qui reste d'un
// profil supprimé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { trouvailleDe } from '../../shared/trouvailles'

/** Samedi 26 septembre 2026, 10 h à Paris : aucune saison. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
const JOUR_MS = 24 * 3600 * 1000

async function avecBanc(scenario: (banc: Banc, horloge: { maintenant: number }) => Promise<void>) {
  const horloge = { maintenant: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.maintenant })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

function enBase<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => enBase(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Un profil et son loup, adopté avec les confettis d'une partie du quiz du jour d'avant. */
async function avecSonLoup(banc: Banc, login = 'alice'): Promise<{ cookie: string; id: string }> {
  const cookie = await inscrireProfil(banc.url, login, 'Alice', '🦊')
  const id = idDe(banc, login)
  enBase(banc, db =>
    db
      .prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-09-20', 1, 10, NULL, 0, 1000, 1, 0)`)
      .run(id),
  )
  const r = await ecrire(banc.url, '/api/joueur/compagnons', { compagnon: 'loup' }, cookie)
  assert.equal(r.status, 200, ((await r.json()) as any).error)
  return { cookie, id }
}

/** Des cadeaux d'avant, du plus ancien au plus récent, écrits tels que la base les garde. */
function cadeauxDAvant(banc: Banc, id: string, objets: readonly string[], compagnon = 'loup') {
  enBase(banc, db => {
    const ligne = db.prepare('INSERT INTO profile_cadeaux (profile_id, compagnon, jour, objet, grand, ouvert_le) VALUES (?, ?, ?, ?, 0, 1)')
    db.transaction(() => objets.forEach((objet, i) => ligne.run(id, compagnon, `2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, '0')}`, objet)))()
  })
}

const reponse = async (r: Response) => ({ status: r.status, corps: (await r.json()) as any })
const soins = (banc: Banc, cookie?: string) => fetch(`${banc.url}/api/joueur/soins`, { headers: cookie ? { Cookie: cookie } : {} }).then(reponse)
const envie = (banc: Banc, cookie: string, cle: string, quoi: unknown) => ecrire(banc.url, `/api/joueur/compagnons/${cle}/envie`, { envie: quoi }, cookie).then(reponse)
const cadeau = (banc: Banc, cookie: string, cle = 'loup') => ecrire(banc.url, `/api/joueur/compagnons/${cle}/cadeau`, {}, cookie).then(reponse)
const cueillette = (banc: Banc, cookie: string, score: unknown, cle = 'loup') => ecrire(banc.url, `/api/joueur/compagnons/${cle}/cueillette`, { score }, cookie).then(reponse)
const jardin = (banc: Banc, cookie: string, j: unknown, cle = 'loup') => ecrire(banc.url, `/api/joueur/compagnons/${cle}/jardin`, { jardin: j }, cookie, 'PUT').then(reponse)

/** Ses trois envies du jour, comblées comme la page les comble ; la partie de cueillette fait sa note. */
async function sesTroisEnvies(banc: Banc, cookie: string, score = 12) {
  assert.equal((await envie(banc, cookie, 'loup', 'gouter')).status, 200)
  assert.equal((await envie(banc, cookie, 'loup', 'calin')).status, 200)
  const partie = await cueillette(banc, cookie, score)
  assert.equal(partie.status, 200, partie.corps.error)
  return partie.corps
}

test('ses envies du jour, puis son cadeau : une fois, tiré une fois — et rien sans profil ni sans compagnon', () =>
  avecBanc(async banc => {
    assert.equal((await soins(banc)).status, 401, 'un invité anonyme n’a pas de compagnon (invariant 8)')
    const sans = await inscrireProfil(banc.url, 'bob', 'Bob', '🐼')
    assert.deepEqual((await soins(banc, sans)).corps, { jour: '2026-09-26', compagnons: [], trouvailles: {}, troisEtoiles: 0 })

    const { cookie } = await avecSonLoup(banc)
    const neuf = await soins(banc, cookie)
    assert.deepEqual(neuf.corps.compagnons, [
      { compagnon: 'loup', envies: { gouter: false, calin: false, jeu: false }, cadeau: null, complicite: 0, record: 0, jardin: {} },
    ])

    // Ce qu'il n'a pas, ou ce qui n'est pas une envie, se refuse en clair.
    assert.deepEqual(await envie(banc, cookie, 'chat', 'gouter'), { status: 400, corps: { error: 'Le Chat des lanternes s’achète d’abord, à la boutique' } })
    assert.equal((await envie(banc, cookie, 'loup', 'jeu')).status, 400, 'la partie de cueillette comble la sienne en s’écrivant')
    assert.equal((await envie(banc, cookie, 'loup', 'dodo')).status, 400)

    assert.equal((await envie(banc, cookie, 'loup', 'gouter')).corps.compagnons[0].envies.gouter, true)
    assert.equal((await envie(banc, cookie, 'loup', 'gouter')).status, 200, 'une envie comblée deux fois ne s’écrit qu’une')
    assert.deepEqual(await cadeau(banc, cookie), { status: 400, corps: { error: 'Son cadeau attend ses trois envies : encore câlin et jouer.' } })
    assert.equal((await envie(banc, cookie, 'loup', 'calin')).status, 200)

    const partie = await cueillette(banc, cookie, 12)
    assert.equal(partie.status, 200, partie.corps.error)
    assert.deepEqual({ ...partie.corps, soins: undefined }, { score: 12, etoiles: 1, ancien: 0, nouveauRecord: true, envie: true, exploit: null, soins: undefined })
    assert.equal(partie.corps.soins.compagnons[0].record, 12)
    // Une partie dure trente secondes : deux envoyées d'un coup, la seconde ment.
    assert.deepEqual(await cueillette(banc, cookie, 30), { status: 400, corps: { error: 'Une partie dure trente secondes : joue-la jusqu’au bout.' } })
    assert.equal((await cueillette(banc, cookie, 999)).status, 400, 'un score qu’aucune partie ne fait')

    const ouvert = await cadeau(banc, cookie)
    assert.equal(ouvert.status, 200, ouvert.corps.error)
    const { objet, grand, complicite, terrain, tour, exploit } = ouvert.corps
    assert.equal(trouvailleDe(objet)?.rarete !== undefined && ['commune', 'peucommune', 'rare'].includes(trouvailleDe(objet)!.rarete), true, objet)
    assert.deepEqual({ grand, complicite, terrain, tour, exploit }, { grand: false, complicite: 1, terrain: null, tour: null, exploit: null })
    assert.deepEqual(ouvert.corps.soins.trouvailles, { [objet]: 1 })
    assert.deepEqual(ouvert.corps.soins.compagnons[0].cadeau, { objet, grand: false })
    // Rouvert — la scène rejouée après un rechargement —, il redonne ce qu'il a donné, et rien de plus.
    const rouvert = await cadeau(banc, cookie)
    assert.equal(rouvert.corps.objet, objet)
    assert.equal(rouvert.corps.complicite, 1)
    assert.deepEqual(rouvert.corps.soins.trouvailles, { [objet]: 1 })
  }))

test('jour après jour : la pirouette au troisième, le grand cadeau et la cour au septième — un jour manqué ne retire rien', () =>
  avecBanc(async (banc, horloge) => {
    const { cookie } = await avecSonLoup(banc)
    const ouverts: any[] = []
    for (let d = 0; d < 8; d++) {
      // Le cinquième jour, il ne vient pas : rien ne se perd, il ne boude pas.
      horloge.maintenant = DEBUT + (d + (d >= 5 ? 1 : 0)) * JOUR_MS
      const lu = await soins(banc, cookie)
      assert.deepEqual(lu.corps.compagnons[0].envies, { gouter: false, calin: false, jeu: false }, 'chaque jour, ses envies neuves')
      await sesTroisEnvies(banc, cookie)
      const ouvert = await cadeau(banc, cookie)
      assert.equal(ouvert.status, 200, ouvert.corps.error)
      ouverts.push(ouvert.corps)
    }
    assert.deepEqual(
      ouverts.map(o => o.complicite),
      [1, 2, 3, 4, 5, 6, 7, 8],
    )
    assert.deepEqual(
      ouverts.map(o => o.tour),
      [null, null, 'la pirouette', null, null, null, null, null],
    )
    assert.deepEqual(
      ouverts.map(o => o.grand),
      [false, false, false, false, false, false, true, false],
    )
    assert.ok(['rare', 'epique'].includes(trouvailleDe(ouverts[6].objet)!.rarete), 'le grand cadeau : une rare ou une épique')
    assert.deepEqual(
      ouverts.map(o => o.terrain),
      [null, null, null, null, null, null, 1, null],
      'sept jours de complicité : la cour',
    )
    const total = Object.values(ouverts[7].soins.trouvailles as Record<string, number>).reduce((a, b) => a + b, 0)
    assert.equal(total, 8, 'huit cadeaux, huit trouvailles — doubles compris')
  }))

test('son jardin : chaque place vérifiée, gardé au réveil — une place fermée ou une trouvaille qu’il n’a pas se refusent en clair', () =>
  avecBanc(async banc => {
    const { cookie, id } = await avecSonLoup(banc)
    // Vingt-cinq jours de complicité : le jardin, sept places.
    cadeauxDAvant(banc, id, ['lanterne', 'lanterne', 'gamelle', 'cerfvolant', 'bouleau', ...Array<string>(20).fill('balle')])
    const lu = await soins(banc, cookie)
    assert.equal(lu.corps.compagnons[0].complicite, 25)
    assert.deepEqual(lu.corps.trouvailles, { lanterne: 2, gamelle: 1, cerfvolant: 1, bouleau: 1, balle: 20 })

    const pose = await jardin(banc, cookie, { s1: 'lanterne', s4: 'lanterne', s6: 'bouleau', s2: 'gamelle', s5: 'cerfvolant', s7: null })
    assert.equal(pose.status, 200, pose.corps.error)
    assert.deepEqual(pose.corps.compagnons[0].jardin, { s1: 'lanterne', s4: 'lanterne', s6: 'bouleau', s2: 'gamelle', s5: 'cerfvolant' })

    assert.deepEqual(await jardin(banc, cookie, { s8: 'bouleau' }), { status: 400, corps: { error: 'Cette place n’est pas encore à lui : son jardin grandit avec votre complicité.' } })
    assert.deepEqual(await jardin(banc, cookie, { s1: 'lanterne', s4: 'lanterne', s6: 'lanterne' }), { status: 400, corps: { error: 'La lanterne de papier : tu n’en as pas d’autre à poser.' } })
    assert.deepEqual(await jardin(banc, cookie, { s6: 'cerisier' }), { status: 400, corps: { error: 'Pas encore dans tes trouvailles : le cerisier en fleurs.' } })
    assert.deepEqual(await jardin(banc, cookie, { s2: 'lanterne' }), { status: 400, corps: { error: 'Un grand objet demande une grande place.' } })
    assert.equal((await jardin(banc, cookie, { s2: 'gamelle' }, 'tortue')).status, 400, 'pas de jardin pour un compagnon qu’il n’a pas')

    // Refusé, il reste tel qu'il était — et le réveil sur disque effacé le garde : il vit dans la base permanente.
    await banc.redemarrer({ disqueEfface: true })
    assert.deepEqual((await soins(banc, cookie)).corps.compagnons[0].jardin, { s1: 'lanterne', s4: 'lanterne', s6: 'bouleau', s2: 'gamelle', s5: 'cerfvolant' })
    // Vidé, il ne garde rien.
    assert.deepEqual((await jardin(banc, cookie, {})).corps.compagnons[0].jardin, {})
    assert.equal(enBase(banc, db => (db.prepare('SELECT jardin FROM profile_compagnons WHERE profile_id = ?').get(id) as { jardin: string | null }).jardin), null)
  }))

test('les deux légendaires : cent jours de complicité, dix cueillettes à trois étoiles — une seule fois chacune', () =>
  avecBanc(async (banc, horloge) => {
    const { cookie, id } = await avecSonLoup(banc)
    cadeauxDAvant(banc, id, Array<string>(99).fill('gamelle'))
    enBase(banc, db => {
      const partie = db.prepare(`INSERT INTO profile_cueillettes (profile_id, compagnon, jouee_le, score) VALUES (?, 'loup', ?, 30)`)
      for (let i = 0; i < 9; i++) partie.run(id, 1 + i)
    })
    const lu = await soins(banc, cookie)
    assert.equal(lu.corps.troisEtoiles, 9)
    assert.equal(lu.corps.trouvailles.fontaine, undefined)

    // La dixième partie à trois étoiles : l'étoile filante le rejoint.
    const dixieme = await sesTroisEnvies(banc, cookie, 31)
    assert.equal(dixieme.etoiles, 3)
    assert.equal(dixieme.exploit, 'etoile')
    assert.equal(dixieme.soins.trouvailles.etoile, 1)
    // Le centième cadeau : la fontaine aux étoiles.
    const centieme = await cadeau(banc, cookie)
    assert.equal(centieme.corps.complicite, 100)
    assert.equal(centieme.corps.exploit, 'fontaine')
    assert.equal(centieme.corps.soins.trouvailles.fontaine, 1)
    // La onzième partie à trois étoiles ne redonne rien, ni le cent unième jour.
    horloge.maintenant += JOUR_MS
    const onzieme = await sesTroisEnvies(banc, cookie, 33)
    assert.equal(onzieme.exploit, null)
    const lendemain = await cadeau(banc, cookie)
    assert.equal(lendemain.corps.exploit, null)
    assert.equal(lendemain.corps.soins.trouvailles.fontaine, 1)
    assert.equal(lendemain.corps.soins.trouvailles.etoile, 1)
  }))

test('un profil supprimé emporte ses envies, ses cadeaux, ses cueillettes et son jardin', () =>
  avecBanc(async banc => {
    const { cookie, id } = await avecSonLoup(banc)
    await sesTroisEnvies(banc, cookie)
    assert.equal((await cadeau(banc, cookie)).status, 200)
    const admin = await connexionAnimateur(banc.url)
    const r = await fetch(`${banc.url}/api/admin/profils/${id}`, { method: 'DELETE', headers: { Cookie: admin, 'X-Requested-With': 'quizz' } })
    assert.equal(r.status, 200, await r.text())
    const restes = enBase(banc, db =>
      ['profile_envies', 'profile_cadeaux', 'profile_cueillettes', 'profile_compagnons'].map(t => (db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE profile_id = ?`).get(id) as { n: number }).n),
    )
    assert.deepEqual(restes, [0, 0, 0, 0])
  }))
