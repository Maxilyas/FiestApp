// Les fonds de carte : ce qu'on voit derrière sa carte quand quelqu'un touche
// son nom. Quatre, gagnés sur la durée ; on ne porte que ceux qu'on a
// gagnés ; ils se relisent à chaque affichage — celui qu'on ne mérite plus
// cesse de se voir, sans que rien ne soit réécrit, et revient avec ce qui
// l'avait ouvert.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { ADMIN, demarrer, ecrire, inscrireProfil, invite, type Banc } from './banc'
import { fondsOuverts } from '../../shared/fonds'
import { xpDuNiveau } from '../../shared/profil'
import { VERSION_BAREME } from '../src/auth/profiles'

test('quatre fonds, chacun sa règle', () => {
  const rien = { niveau: 1, jour: { joues: 0, victoires: 0 }, recompenses: new Map<string, number>() }
  assert.deepEqual(fondsOuverts(rien), [])
  assert.deepEqual(fondsOuverts({ ...rien, jour: { joues: 30, victoires: 0 } }), ['nuit'], 'trente jours de quiz du jour')
  assert.deepEqual(fondsOuverts({ ...rien, niveau: 20 }), ['aurore'], 'le niveau 20')
  assert.deepEqual(fondsOuverts({ ...rien, jour: { joues: 29, victoires: 10 } }), ['kintsugi'], 'dix victoires au quiz du jour')
  assert.deepEqual(fondsOuverts({ ...rien, recompenses: new Map([['hf:habitue:3', 1]]) }), ['theatre'], 'L’Habitué · Or')
  assert.deepEqual(fondsOuverts({ ...rien, niveau: 19, jour: { joues: 29, victoires: 9 }, recompenses: new Map([['hf:habitue:2', 1]]) }), [])
})

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/**
 * Donne au profil tout juste le niveau voulu, par sa ligne du quiz du jour :
 * la seule que le démarrage ne relit pas. Descendre d'un niveau rejoue ce
 * que fait une soirée retirée de l'historique.
 */
function mettreAuNiveau(banc: Banc, id: string, niveau: number) {
  const xp = xpDuNiveau(niveau)
  base(banc, db => {
    db.prepare(`DELETE FROM profile_xp WHERE profile_id = ?`).run(id)
    db.prepare(
      `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#jour', '', ?, ?, 1)`,
    ).run(id, xp, JSON.stringify({ v: VERSION_BAREME, jours: 1 }))
    db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xp, id)
  })
}

test('un fond se choisit parmi ceux qu’on a gagnés ; la carte le montre, et le perd avec ce qui l’avait ouvert', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id)
    const changer = (fond: string | null) =>
      ecrire(banc.url, '/api/joueur/moi', { fond }, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))
    const moi = async () =>
      ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
    const carte = async (playerId: string) =>
      ((await (await fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${playerId}.json`)).json()) as any).profil

    // Rien de gagné : refusé, en clair — et un fond forgé n'existe pas.
    const refus = await changer('aurore')
    assert.equal(refus.status, 400)
    assert.match(refus.corps.error, /se gagne d’abord : le niveau 20/)
    assert.match((await changer('velours-noir')).corps.error, /n’existe pas/)
    assert.deepEqual((await moi()).fonds, [])

    // Au niveau 20, l'Aurore boréale se porte, et la carte la montre.
    mettreAuNiveau(banc, id, 20)
    await banc.redemarrer()
    assert.equal((await changer('aurore')).status, 200)
    assert.equal((await moi()).fond, 'aurore')
    const alice = await invite(banc.url, 'Alice', '', { cookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    assert.equal((await carte(alice.playerId)).fond, 'aurore')
    assert.equal(await carte(bob.playerId), undefined, 'un anonyme n’a pas de profil, donc pas de fond')

    // Une soirée retirée la fait redescendre au 19 : sa carte redevient
    // velours, sans que rien ne soit réécrit — et l'aurore revient au 20.
    mettreAuNiveau(banc, id, 19)
    await banc.redemarrer()
    assert.equal((await carte(alice.playerId)).fond, undefined)
    assert.equal((await moi()).fond, null)
    mettreAuNiveau(banc, id, 20)
    await banc.redemarrer()
    assert.equal((await carte(alice.playerId)).fond, 'aurore')

    // Les trois autres : trente jours et dix victoires au quiz du jour,
    // vingt-cinq soirées (L'Habitué · Or).
    base(banc, db => {
      const partie = db.prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 500, 5, 1, 0)`,
      )
      const victoire = db.prepare(`INSERT INTO jour_podiums (jour, profile_id, rang, points, xp) VALUES (?, ?, 1, 500, 25)`)
      for (let j = 1; j <= 30; j++) {
        const jour = `2026-08-${String(j).padStart(2, '0')}`
        partie.run(id, jour)
        if (j <= 10) victoire.run(jour, id)
      }
      db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'hf:habitue:3', 'soiree-25', '', '🎟️', 'L’Habitué · Or', 1)`,
      ).run(id)
    })
    await banc.redemarrer()
    assert.deepEqual((await moi()).fonds, ['nuit', 'aurore', 'kintsugi', 'theatre'])
    assert.equal((await changer('theatre')).status, 200)
    assert.equal((await carte(alice.playerId)).fond, 'theatre')

    // Retour au velours.
    assert.equal((await changer(null)).status, 200)
    assert.equal((await moi()).fond, null)
    assert.equal((await carte(alice.playerId)).fond, undefined)
  }))
