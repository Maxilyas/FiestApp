// Les gerbes (le 5 octobre 2026) : ce qui éclate sur son téléphone à une
// bonne réponse. Chacune se gagne par un haut fait ou un palier, se choisit
// parmi celles qu'on a, et se relit à chaque affichage : celle qu'on ne
// mérite plus cesse de se porter, sans que rien ne soit réécrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { GERBES, gerbesOuvertes } from '../../shared/gerbes'
import { hautFait } from '../../shared/hautsfaits'

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

test('chaque gerbe se gagne par un haut fait qui existe ; un palier plus haut vaut le sien', () => {
  for (const g of GERBES) {
    const par = g.par
    if ('hautFait' in par) assert.ok(hautFait(par.hautFait), `${g.key} : ${par.hautFait}`)
    if ('palier' in par) assert.ok(hautFait(par.palier), `${g.key} : ${par.palier}`)
  }
  assert.deepEqual(gerbesOuvertes(new Map()), ['confettis'], 'un profil a les confettis, rien de plus')
  assert.deepEqual(gerbesOuvertes(new Map([['hf:infatigable:2', 1]])), ['confettis', 'petales', 'flammes'])
  assert.deepEqual(gerbesOuvertes(new Map([['hf:laurier', 1]])), ['confettis', 'ballons'])
})

test('une gerbe se porte parmi celles qu’on a gagnées, et tombe avec ce qui l’ouvrait', async () => {
  const banc = await demarrer()
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const porter = (gerbe: string | null) => ecrire(banc.url, '/api/joueur/moi', { gerbe }, lea, 'PUT')
    assert.equal((await porter('confettis')).status, 200)
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, 'confettis')
    const refus = await porter('trophees')
    assert.equal(refus.status, 400)
    assert.match(((await refus.json()) as any).error, /défi/)
    assert.equal((await porter('n-existe-pas')).status, 400)
    // Le défi gagné : les trophées s'ouvrent.
    const id = base(banc, db => (db.prepare(`SELECT id FROM profiles WHERE login = 'lea'`).get() as { id: string }).id)
    base(banc, db =>
      db
        .prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'hf:defi', '#defi:2026-09-28', '', '⚔️', 'Le Vainqueur du défi', 1)`)
        .run(id),
    )
    await banc.redemarrer()
    const detail = (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    assert.deepEqual(detail.gerbes, ['confettis', 'trophees'])
    assert.equal((await porter('trophees')).status, 200)
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, 'trophees')
    // Ce qui l'ouvrait retiré, elle ne se porte plus — sans rien réécrire.
    base(banc, db => db.prepare(`DELETE FROM profile_badges WHERE profile_id = ? AND badge = 'hf:defi'`).run(id))
    await banc.redemarrer()
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, null)
    assert.equal((await porter(null)).status, 200)
  } finally {
    await banc.close()
  }
})
