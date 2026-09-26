// Les emojis de collection : un par niveau qui n'ouvre pas de finition,
// réservés aux profils.
//
// Entre deux finitions, on passait trois niveaux sans rien gagner. Chacun de
// ces niveaux ouvre maintenant un emoji — mais seulement pour le profil qui
// l'a atteint : ni l'invité anonyme, ni un appel forgé ne le portent, et une
// soirée retirée de l'historique qui fait redescendre le profil le reprend.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { ADMIN, connecter, demarrer, ecrire, emitAck, inscrireProfil, type Banc } from './banc'
import { AVATARS, COLLECTION, DEFAULT_AVATAR, collectionGagnee, niveauRequis } from '../../shared/avatars'
import { NIVEAU_FINITION, xpDuNiveau } from '../../shared/profil'
import { VERSION_BAREME } from '../src/auth/profiles'

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

/** Le hérisson suivi d'un sélecteur de variante : le même dessin, une autre chaîne. */
const HERISSON_VARIANTE = '🦔\uFE0F'

/**
 * Donne au profil tout juste le niveau voulu, par sa ligne du quiz du jour :
 * la seule que le démarrage ne relit pas. Descendre d'un niveau rejoue ce
 * que fait une soirée retirée de l'historique.
 */
function mettreAuNiveau(banc: Banc, login: string, niveau: number) {
  const xp = xpDuNiveau(niveau)
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
    db.prepare('DELETE FROM profile_xp WHERE profile_id = ?').run(id)
    db.prepare(
      `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#jour', '', ?, ?, 1)`,
    ).run(id, xp, JSON.stringify({ v: VERSION_BAREME, jours: 1 }))
    db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xp, id)
  } finally {
    db.close()
  }
}

test('un emoji de collection à chaque niveau qui n’ouvre pas de finition, du 2 au 17 — aucun à l’inscription', () => {
  const niveaux = [...COLLECTION.map(c => c.niveau), ...Object.values(NIVEAU_FINITION).filter(n => n <= 17)]
  assert.deepEqual(
    niveaux.sort((a, b) => a - b),
    Array.from({ length: 17 }, (_, i) => i + 1),
    'chaque niveau jusqu’au 17 ouvre une chose, et une seule',
  )
  for (const c of COLLECTION) {
    assert.ok(!AVATARS.includes(c.emoji), `${c.emoji} ne se choisit pas à l’inscription`)
    assert.equal(Array.from(c.emoji).length, 1, `${c.emoji} tient en un seul point de code`)
  }
  assert.equal(niveauRequis('🦊'), 0)
  assert.equal(niveauRequis('🦔'), 7)
  assert.equal(niveauRequis(HERISSON_VARIANTE), 7, 'un sélecteur de variante ne le cache pas')
  assert.equal(niveauRequis('🦚🪐'), 17, 'le plus haut des deux compte')
  assert.deepEqual(collectionGagnee(6, 9), ['🦔', '🐝', '🦩'])
  assert.deepEqual(collectionGagnee(7, 7), [])
})

test('il se porte au niveau qui l’ouvre, jamais sans profil ; redescendu, le profil ne le porte plus', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const changer = (avatar: string) =>
      ecrire(banc.url, '/api/joueur/moi', { avatar }, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))
    const moi = async () =>
      ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile

    // Niveau 1 : le hérisson s'ouvre au 7, et le refus le dit.
    const refus = await changer('🦔')
    assert.equal(refus.status, 400)
    assert.match(refus.corps.error, /s’ouvre au niveau 7/)
    assert.equal((await moi()).avatar, '🦊')

    // Pas davantage à l'inscription : un profil neuf est au niveau 1.
    await inscrireProfil(banc.url, 'zoe', 'Zoé', '🦔')
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const zoe = base.prepare('SELECT avatar FROM profiles WHERE login = ?').get('zoe') as { avatar: string }
      assert.equal(zoe.avatar, DEFAULT_AVATAR)
    } finally {
      base.close()
    }

    // Niveau 7 : il se porte — et l'abeille, du 8, attend encore.
    mettreAuNiveau(banc, 'alice', 7)
    await banc.redemarrer()
    const porte = await changer('🦔')
    assert.equal(porte.status, 200)
    assert.equal(porte.corps.profile.avatar, '🦔')
    assert.equal((await changer('🐝')).status, 400)

    // En soirée, l'accusé dit l'avatar que la fiche retient — celui que la
    // salle verra. Alice entre avec le sien sans rien choisir, et l'abeille
    // qu'elle enverrait d'un second téléphone ne passe pas. Bob, anonyme,
    // n'a pas de niveau : son hérisson forgé devient l'avatar par défaut.
    const entrer = async (name: string, avatar: string, profil?: string): Promise<string> => {
      const socket = connecter(banc.url, profil)
      try {
        await emitAck(socket, 'party:watch', { slug: ADMIN.slug })
        const res = await emitAck<any>(socket, 'player:join', { slug: ADMIN.slug, name, avatar })
        assert.ok(res.ok, res.error)
        return res.avatar
      } finally {
        socket.close()
      }
    }
    assert.equal(await entrer('Alice', '', cookie), '🦔')
    assert.equal(await entrer('Alice', '🐝', cookie), '🦔', 'l’abeille du 8 ne passe pas')
    assert.equal(await entrer('Bob', '🦔'), DEFAULT_AVATAR)
    assert.equal(await entrer('Ève', HERISSON_VARIANTE), DEFAULT_AVATAR, 'un sélecteur de variante ne le fait pas passer')

    // Une soirée retirée la fait redescendre au 6 : sa page montre l'avatar
    // par défaut, sans que rien ne soit réécrit — elle le retrouve au 7.
    mettreAuNiveau(banc, 'alice', 6)
    await banc.redemarrer()
    assert.equal((await moi()).avatar, DEFAULT_AVATAR)
    mettreAuNiveau(banc, 'alice', 7)
    await banc.redemarrer()
    assert.equal((await moi()).avatar, '🦔')
  }))
