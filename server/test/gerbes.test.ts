// Les gerbes (le 5 octobre 2026) : ce qui éclate sur son téléphone à une
// bonne réponse. Chacune se gagne par un haut fait ou un palier, se choisit
// parmi celles qu'on a, et se relit à chaque affichage : celle qu'on ne
// mérite plus cesse de se porter, sans que rien ne soit réécrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ALLURE_PAR_DEFAUT, AUCUNE_GERBE, GERBES, GERBE_PAR_DEFAUT, gerbe, gerbesOuvertes } from '../../shared/gerbes'
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
  assert.equal(gerbe(GERBE_PAR_DEFAUT)?.par && 'profil' in gerbe(GERBE_PAR_DEFAUT)!.par, true, 'celle de tous est ouverte à tout profil')
  assert.equal(gerbe(AUCUNE_GERBE), undefined, '« aucune » n’est pas une gerbe')
})

// Les dix gerbes avaient la même allure, et ne différaient que par leurs
// emojis : un ballon filait aussi vite qu'une étincelle.
test('chaque gerbe a son allure, et aucune ne charge un petit téléphone ni ne traîne', () => {
  const allures = GERBES.map(g => g.allure ?? ALLURE_PAR_DEFAUT)
  assert.equal(new Set(allures.map(a => JSON.stringify(a))).size, GERBES.length, 'dix allures différentes')
  for (const [i, a] of allures.entries()) {
    const g = GERBES[i].key
    assert.ok(a.nombre >= 6 && a.nombre <= 30, `${g} : ${a.nombre} particules`)
    assert.ok(a.taille[0] > 0 && a.taille[0] <= a.taille[1] && a.taille[1] <= 2.5, `${g} : taille`)
    // Le délai le plus long (0,3 s) compris : jamais plus de quatre secondes à l'écran.
    assert.ok(a.duree[0] > 0 && a.duree[0] <= a.duree[1] && a.duree[1] + 0.3 <= 4, `${g} : durée`)
  }
  const de = (cle: string) => GERBES.find(g => g.key === cle)!.allure!
  assert.ok(de('ballons').duree[0] > de('etincelles').duree[1], 'un ballon flotte, une étincelle file')
  assert.ok(de('ballons').nombre < de('pixels').nombre)
})

test('une gerbe se porte parmi celles qu’on a gagnées, et tombe avec ce qui l’ouvrait', async () => {
  const banc = await demarrer()
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const porter = (gerbe: string | null) => ecrire(banc.url, '/api/joueur/moi', { gerbe }, lea, 'PUT')
    // Un profil neuf porte les confettis : rien n'éclatait tant qu'on
    // n'était pas allé en choisir une (le choix du 10 octobre 2026).
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, 'confettis')
    // Qui n'en veut aucune le dit ; null revient à celle de tous.
    assert.equal((await porter(AUCUNE_GERBE)).status, 200)
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, null)
    assert.equal((await porter(null)).status, 200)
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, 'confettis')
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
    // Ce qui l'ouvrait retiré, elle ne se porte plus — sans rien réécrire :
    // c'est celle de tous qui éclate.
    base(banc, db => db.prepare(`DELETE FROM profile_badges WHERE profile_id = ? AND badge = 'hf:defi'`).run(id))
    await banc.redemarrer()
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, 'confettis')
    assert.equal((await porter(null)).status, 200)
  } finally {
    await banc.close()
  }
})
