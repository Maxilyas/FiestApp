// La phrase d'un Divin retrouvée par tous, annoncée sur l'accueil (la décision
// du propriétaire du 24 novembre 2026, la décision 2 du plan adaptée) : chaque
// profil la voit une fois, en tête de son accueil — son Divin, ceux qui y ont
// trouvé un mot, les trois premiers nommés comme on les lit (invariant 17),
// puis combien d'autres —, jamais un mot de la phrase ; ce qu'il a vu, le
// serveur le retient, pour tous ses appareils.
//
// Le propriétaire joue aussi : aucun message d'assertion ne cite un mot d'une
// légende — une place, un nom de Divin, un prénom inventé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { legendeDe } from '../src/core/divins'
import { ORDRE_DU_SPHINX, motsDeLaLegende } from '../src/core/sphinx'
import { jourAvant } from '../../shared/jour'
import type { AnnonceDeLAdministrateur } from '../../shared/profil'

ProfileStore.tirageEclat = () => false

const MIDI = Date.UTC(2026, 8, 26, 10, 0)
const DIVIN = ORDRE_DU_SPHINX[0]

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}
const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

const lire = (banc: Banc, cookie: string, chemin: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
/** Ce que l'accueil annonce d'une phrase retrouvée — la mémoire du Sphinx lue d'abord, comme la ligne des missions partie avec lui. */
async function sesAnnonces(banc: Banc, cookie: string): Promise<Extract<AnnonceDeLAdministrateur, { sorte: 'phrase' }>[]> {
  assert.equal((await lire(banc, cookie, '/api/joueur/sphinx')).status, 200)
  const r = await lire(banc, cookie, '/api/joueur/moi?accueil')
  assert.equal(r.status, 200, r.corps.error)
  return ((r.corps.profile.annonces ?? []) as AnnonceDeLAdministrateur[]).filter((a): a is Extract<AnnonceDeLAdministrateur, { sorte: 'phrase' }> => a.sorte === 'phrase')
}

/** Aucun mot caché de la légende : l'échec dit sa place, jamais le mot. */
function rienDeLaPhrase(reponse: unknown, ou: string) {
  const texte = JSON.stringify(reponse)
  motsDeLaLegende(legendeDe(DIVIN)!).forEach((m, i) => {
    if (m.cache) assert.ok(!new RegExp(`(^|[^\\p{L}])${m.texte}([^\\p{L}]|$)`, 'iu').test(texte), `${ou} : le mot caché n° ${i}`)
  })
}

test('une phrase retrouvée par tous s’annonce une fois sur l’accueil : son Divin, ses trois premiers trouveurs et combien d’autres, jamais un mot', async () => {
  const banc = await demarrer({ horlogeDuJour: () => MIDI, tirageDuSphinx: () => 0 })
  try {
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/maintenance/pages/sphinx', { etat: 'ouverte' }, admin, 'PUT')).status, 200)
    // Six trouveurs, dans l'ordre de leur premier mot : deux Camille sous le même renard, puis Tom, Inès, Paul, Nina.
    const trouveurs = [
      ['cam1', 'Camille', '🦊'],
      ['cam2', 'Camille', '🦊'],
      ['tom', 'Tom', '🐻'],
      ['ines', 'Inès', '🐸'],
      ['paul', 'Paul', '🐼'],
      ['nina', 'Nina', '🦉'],
    ] as const
    for (const [login, nom, avatar] of trouveurs) await inscrireProfil(banc.url, login, nom, avatar)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🐙')
    const caches = motsDeLaLegende(legendeDe(DIVIN)!).flatMap((m, i) => (m.cache ? [i] : []))
    assert.ok(caches.length >= trouveurs.length, 'assez de mots pour six trouveurs')
    // Chacun ses mots, le premier plus tôt que le suivant ; le dernier mot trouvé il y a deux jours.
    base(banc, db => {
      const poser = db.prepare(
        `INSERT INTO profile_sphinx (profile_id, jour, enigme, divin, etat, essais, mot, proposee_le, close_le) VALUES (?, ?, ?, ?, 'resolue', 1, ?, ?, ?)`,
      )
      caches.forEach((mot, i) => {
        const [login] = trouveurs[Math.min(i, trouveurs.length - 1)]
        const quand = MIDI - (caches.length - i + 1) * 86_400_000
        poser.run(idDe(banc, login), jourAvant('2026-09-24', caches.length - i), `x${i}`, DIVIN, mot, quand, quand)
      })
    })
    await banc.redemarrer()

    const annonces = await sesAnnonces(banc, lea)
    assert.equal(annonces.length, 1, 'une carte')
    const [carte] = annonces
    assert.deepEqual(
      [carte.id, carte.divin.key, carte.grace, carte.autres],
      [`phrase:${DIVIN}`, DIVIN, ['Camille', 'Camille (2)', 'Tom'], 3],
      'les trois premiers, l’homonyme marqué, puis combien d’autres',
    )
    assert.equal(carte.le, MIDI - 2 * 86_400_000, 'le jour du dernier mot trouvé')
    rienDeLaPhrase(carte, 'la carte')
    rienDeLaPhrase(annonces, 'l’accueil')

    // Montrée, il la retient au serveur : elle ne revient plus, sur aucun de ses appareils.
    assert.equal((await ecrire(banc.url, '/api/joueur/sphinx/annonce', { divin: DIVIN }, lea)).status, 200)
    assert.deepEqual(await sesAnnonces(banc, lea), [])
    // Les autres l'ont encore, Camille compris.
    const cam1 = (await ecrire(banc.url, '/api/joueur/connexion', { login: 'cam1', password: 'motdepasse1' })).headers.get('set-cookie')!.split(';')[0]
    assert.equal((await sesAnnonces(banc, cam1)).length, 1)
    // L'annonce retenue n'est ni une visite ni un mot : les mots de tous, et sa phrase, n'en bougent pas.
    const sienne = (await lire(banc, lea, '/api/joueur/sphinx')).corps.reconstituees[0]
    assert.deepEqual([sienne.parTous, sienne.aDevoiler], [caches.length, true])
    // Une phrase qui n'est pas retrouvée ne s'annonce pas.
    assert.equal((await ecrire(banc.url, '/api/joueur/sphinx/annonce', { divin: ORDRE_DU_SPHINX[1] }, lea)).status, 400)
    // Sa page fermée, rien ne s'annonce.
    assert.equal((await ecrire(banc.url, '/api/admin/maintenance/pages/sphinx', { etat: 'maintenance' }, admin, 'PUT')).status, 200)
    const fermee = await lire(banc, cam1, '/api/joueur/moi?accueil')
    assert.ok(!((fermee.corps.profile.annonces ?? []) as AnnonceDeLAdministrateur[]).some(a => a.sorte === 'phrase'))
  } finally {
    await banc.close()
  }
})

test('une phrase retrouvée il y a plus d’un mois ne s’annonce plus', async () => {
  const banc = await demarrer({ horlogeDuJour: () => MIDI, tirageDuSphinx: () => 0 })
  try {
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/maintenance/pages/sphinx', { etat: 'ouverte' }, admin, 'PUT')).status, 200)
    await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🐙')
    const caches = motsDeLaLegende(legendeDe(DIVIN)!).flatMap((m, i) => (m.cache ? [i] : []))
    base(banc, db => {
      const poser = db.prepare(
        `INSERT INTO profile_sphinx (profile_id, jour, enigme, divin, etat, essais, mot, proposee_le, close_le) VALUES (?, ?, ?, ?, 'resolue', 1, ?, ?, ?)`,
      )
      caches.forEach((mot, i) => poser.run(idDe(banc, 'tom'), jourAvant('2026-08-01', i), `x${i}`, DIVIN, mot, MIDI - 40 * 86_400_000, MIDI - 40 * 86_400_000))
    })
    await banc.redemarrer()
    assert.deepEqual(await sesAnnonces(banc, lea), [])
  } finally {
    await banc.close()
  }
})
