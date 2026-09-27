// Invariant 21 : « Le serveur n'envoie que la liste des Divins descendus, le
// récit à leur seul porteur. » Le récit (`raconter`, core/divins.ts) « en dit
// presque autant que la règle ».
//
// `/api/auth/me` (auth/routes.ts) répond à toute session du COMPTE, et y
// joint le profil rattaché tel que `toPublic` le rend — récits des Divins
// compris. Or une session de compte n'est pas le profil : c'est aussi la
// télé branchée par un code d'appairage, « souvent celle de quelqu'un
// d'autre — le bar, les parents, la salle louée » (auth/appairage.ts). La
// page qui la lit (`currentMe`, client/src/api.ts) n'a besoin que de
// l'avatar, du niveau et du prénom.
//
// Ce test passe le jour où ce qui part vers une session de compte ne porte
// plus le récit d'un Divin (ni, idéalement, rien que la page n'affiche).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, cookieDe, demarrer, ecrire, inscrireProfil } from '../../../server/test/banc'

test('la télé branchée chez un tiers ne reçoit pas le récit du Divin de l’animateur', async () => {
  const banc = await demarrer()
  try {
    await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Hélios est descendu sur Alice, lors d'une soirée d'avant.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'dv:helios', 'ancienne', '', '☀️', 'Hélios', 1)`,
      ).run(id)
    } finally {
      db.close()
    }
    await banc.redemarrer()

    // Alice anime : elle rattache son profil à l'espace, depuis sa console.
    const console_ = await connexionAnimateur(banc.url)
    const lien = await ecrire(banc.url, '/api/space/profil', { login: 'alice', password: 'motdepasse1' }, console_)
    assert.equal(lien.status, 200)

    // La télé du bar affiche un code ; Alice le valide depuis sa console.
    const { code, jeton } = (await (await ecrire(banc.url, '/api/auth/appairage', {})).json()) as any
    assert.equal((await ecrire(banc.url, '/api/auth/appairage/valider', { code }, console_)).status, 200)
    const tele = cookieDe(await ecrire(banc.url, '/api/auth/appairage/attente', { jeton }))

    const me = (await (await fetch(`${banc.url}/api/auth/me`, { headers: { Cookie: tele } })).json()) as any
    const recits = (me.profil?.divins ?? []).filter((d: any) => d.legende)
    console.log(`[constat] /api/auth/me, session de la télé branchée : profil.login=${me.profil?.login} · divins=${JSON.stringify(me.profil?.divins)}`)
    assert.deepEqual(recits, [], 'le récit d’Hélios part vers la télé du bar')
  } finally {
    await banc.close()
  }
})
