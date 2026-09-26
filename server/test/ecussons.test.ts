// Les écussons de savoir : une catégorie maîtrisée, au bronze, à l'argent, à
// l'or. Ils comptent les bonnes réponses d'une catégorie, en soirée comme au
// quiz du jour, et ne rapportent rien d'autre que d'être vus : la carte en
// montre trois, les plus hauts ; la page du profil, les douze, avec ce qui
// manque au suivant. Un invité anonyme n'en a pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { ADMIN, demarrer, inscrireProfil, invite, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { SEUILS_ECUSSON, ecussonsDe, palierEcusson, plusBeauxEcussons, prochainSeuil } from '../../shared/ecussons'
import { releveVide } from '../../shared/profil'
import { VERSION_BAREME } from '../src/auth/profiles'

test('un écusson par catégorie : les bonnes réponses des soirées et du quiz du jour s’additionnent', () => {
  const [bronze, argent, or] = SEUILS_ECUSSON
  assert.deepEqual([palierEcusson(0), palierEcusson(bronze - 1), palierEcusson(bronze), palierEcusson(argent), palierEcusson(or)], [0, 0, 1, 2, 3])
  assert.deepEqual([prochainSeuil(0), prochainSeuil(1), prochainSeuil(2), prochainSeuil(3)], [bronze, argent, or, null], 'à l’or, plus rien à viser')
  const soirees = { Histoire: { questions: 90, justes: 60 }, Sciences: { questions: 300, justes: or } }
  const jour = { Histoire: { questions: 20, justes: 15 }, Sport: { questions: 30, justes: bronze } }
  const tous = ecussonsDe(soirees, jour)
  assert.deepEqual(
    tous.map(e => e.categorie),
    [...CATEGORIES],
    'les douze, dans l’ordre de la liste fixe',
  )
  const de = (c: string) => tous.find(e => e.categorie === c)!
  assert.deepEqual(de('Histoire'), { categorie: 'Histoire', justes: 75, palier: 2 }, 'soixante en soirée et quinze au quiz du jour : l’argent')
  assert.equal(de('Musique').palier, 0)
  // La carte : les plus hauts d'abord, trois au plus, jamais un écusson qu'il n'a pas.
  assert.deepEqual(
    plusBeauxEcussons(tous).map(e => e.categorie),
    ['Sciences', 'Histoire', 'Sport'],
  )
  assert.deepEqual(plusBeauxEcussons(ecussonsDe({})), [])
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

test('sa page montre les douze, sa carte les trois plus hauts — les annulées du quiz du jour ne comptent pas', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    base(banc, db => {
      const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
      // Deux soirées rangées : soixante bonnes réponses en Histoire, deux
      // cents en Sciences, douze en Musique.
      const soiree = db.prepare(
        `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, 0, ?, ?)`,
      )
      const releve = (categories: Record<string, { questions: number; justes: number }>) =>
        JSON.stringify({ v: VERSION_BAREME, gain: {}, releve: { ...releveVide(), categories } })
      soiree.run(id, 'soiree-1', espace, releve({ Histoire: { questions: 50, justes: 40 }, Sciences: { questions: 150, justes: 120 } }), 1000)
      soiree.run(id, 'soiree-2', espace, releve({ Histoire: { questions: 30, justes: 20 }, Sciences: { questions: 100, justes: 80 }, Musique: { questions: 20, justes: 12 } }), 2000)
      // Trois jours de quiz du jour : quinze bonnes réponses en Histoire, et
      // une Histoire de plus dont l'administrateur a annulé les points.
      const tirage = db.prepare(`INSERT INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, ?, 1)`)
      const reponse = db.prepare(
        `INSERT INTO jour_reponses (profile_id, jour, question, choix, ms, juste, points, repondue_le) VALUES (?, ?, ?, 0, 1000, ?, 100, 1)`,
      )
      for (const [jour, annulees] of [
        ['2026-09-01', []],
        ['2026-09-02', []],
        ['2026-09-03', [5]],
      ] as const) {
        const questions = Array.from({ length: 10 }, (_, i) => ({ categorie: i < 6 ? 'Histoire' : 'Nature' }))
        tirage.run(jour, JSON.stringify(questions), JSON.stringify(annulees))
        for (let i = 0; i < 10; i++) reponse.run(id, jour, i, i < 6 ? 1 : 0)
      }
    })
    await banc.redemarrer()

    const moi = ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
    assert.equal(moi.ecussons.length, CATEGORIES.length)
    // Histoire : soixante en soirée, dix-sept au quiz du jour — la dix-huitième
    // a été annulée pour tous. Nature : douze questions, aucune trouvée.
    assert.deepEqual(
      moi.ecussons.filter((e: any) => e.justes > 0),
      [
        { categorie: 'Histoire', justes: 60 + 17, palier: 2 },
        { categorie: 'Sciences', justes: 200, palier: 3 },
        { categorie: 'Musique', justes: 12, palier: 0 },
      ],
    )

    // La carte : les trois plus hauts — ici deux —, et rien pour un anonyme.
    const alice = await invite(banc.url, 'Alice', '', { cookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    const carte = (id: string) => fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${id}.json`).then(r => r.json() as Promise<any>)
    assert.deepEqual((await carte(alice.playerId)).profil.ecussons, [
      { categorie: 'Sciences', palier: 3 },
      { categorie: 'Histoire', palier: 2 },
    ])
    assert.equal((await carte(bob.playerId)).profil, undefined)
  }))
