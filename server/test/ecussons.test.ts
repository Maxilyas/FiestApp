// Les écussons de savoir : une catégorie maîtrisée, au bronze, à l'argent, à
// l'or. Ils comptent les bonnes réponses d'une catégorie dans tous les modes
// de jeu — en soirée, au quiz du jour, en campagne —, et ne rapportent rien
// d'autre que d'être vus : la carte en montre trois, les plus hauts ; la
// page du profil, les douze, avec ce qui manque au suivant. Un invité
// anonyme n'en a pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { ADMIN, baseDEssai, demarrer, ecrire, inscrireProfil, invite, type Banc } from './banc'
import { BRANCHES } from '../../shared/branches'
import { CATEGORIES } from '../../shared/categories'
import { SEUILS_ECUSSON, additionnerCategories, ecussonsDe, palierEcusson, plusBeauxEcussons, prochainSeuil } from '../../shared/ecussons'
import { gainVide, releveVide, totalGain } from '../../shared/profil'
import { VERSION_BAREME } from '../src/auth/profiles'

test('les seuils des écussons sont un choix de produit : 20, 75, 200 bonnes réponses', () => {
  // RECOMPENSES.md les annonce ; les épreuves suivantes se construisent sur
  // `SEUILS_ECUSSON` et passaient avec l'or à 150. Les changer se dit, ici
  // comme là-bas — comme le podium du jour (`jour.test.ts`).
  assert.deepEqual([...SEUILS_ECUSSON], [20, 75, 200])
})

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

test('« Ma carrière », par catégorie, et les écussons : une seule addition de tous les modes de jeu', () => {
  const soirees = { Histoire: { questions: 50, justes: 40 } }
  const jour = { Histoire: { questions: 20, justes: 15 }, Sport: { questions: 10, justes: 8 } }
  const campagne = { Histoire: { questions: 30, justes: 20 }, Nature: { questions: 16, justes: 12 } }
  const tous = additionnerCategories(soirees, jour, campagne)
  assert.deepEqual(tous, {
    Histoire: { questions: 100, justes: 75 },
    Sport: { questions: 10, justes: 8 },
    Nature: { questions: 16, justes: 12 },
  })
  // Les écussons lisent la même addition : quarante, quinze et vingt font l'argent.
  assert.deepEqual(ecussonsDe(tous), ecussonsDe(soirees, jour, campagne))
  assert.equal(ecussonsDe(tous).find(e => e.categorie === 'Histoire')!.palier, 2)
  // Une copie : la carrière qu'on a lue, gardée par l'appelant, ne bouge pas.
  additionnerCategories(soirees, soirees)
  assert.deepEqual(soirees, { Histoire: { questions: 50, justes: 40 } })
  assert.deepEqual(additionnerCategories(), {})
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
      // Deux soirées rangées, jouées dans une salle — seul, elles ne
      // compteraient pas : soixante bonnes réponses en Histoire, deux cents
      // en Sciences, douze en Musique.
      const soiree = db.prepare(
        `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      const rangee = (soireeId: string, categories: Record<string, { questions: number; justes: number }>, le: number) => {
        const gain = { ...gainVide(), reponses: Object.values(categories).reduce((n, c) => n + c.questions, 0) }
        const detail = JSON.stringify({ v: VERSION_BAREME, gain, releve: { ...releveVide(), categories } })
        soiree.run(id, soireeId, espace, totalGain(gain), detail, le)
      }
      rangee('soiree-1', { Histoire: { questions: 50, justes: 40 }, Sciences: { questions: 150, justes: 120 } }, 1000)
      rangee('soiree-2', { Histoire: { questions: 30, justes: 20 }, Sciences: { questions: 100, justes: 80 }, Musique: { questions: 20, justes: 12 } }, 2000)
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

// ── Tous les modes de jeu (le 6 octobre 2026) ─────────────────────────────
//
// La campagne pose aussi des questions classées, et sa base les écrit
// d'avance : une série, une épreuve des sentiers et le défi de la semaine
// disent ce qu'on sait d'une catégorie autant qu'une soirée. Ils ne
// comptaient ni pour les écussons ni pour « Ma carrière », par catégorie.

/** Mardi 6 octobre 2026, 10 h à Paris. */
const MARDI = Date.UTC(2026, 9, 6, 8, 0)

test('la campagne compte aussi — une série, une épreuve des sentiers, le défi de la semaine : sur sa page comme sur sa carte', async () => {
  const banc = await demarrer({ horlogeDuJour: () => MARDI, baseDeLaCampagne: baseDEssai(240, { categories: ['Histoire', 'Nature'] }) })
  try {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const poster = async (chemin: string, corps: unknown) => {
      const r = await ecrire(banc.url, chemin, corps, cookie)
      const lu = (await r.json()) as any
      assert.equal(r.status, 200, lu.error)
      return lu
    }
    // Ce que son téléphone a vu, catégorie par catégorie : la question
    // montrée dit sa catégorie, et la bonne réponse de la base d'essai
    // commence par « Bonne ».
    const vu: Record<string, { questions: number; justes: number }> = {}
    const repondre = (chemin: string, q: { index: number; categorie: string; reponses: string[] }, juste: boolean) => {
      const bonne = q.reponses.findIndex(r => r.startsWith('Bonne'))
      const c = (vu[q.categorie] ??= { questions: 0, justes: 0 })
      c.questions++
      if (juste) c.justes++
      return poster(chemin, { index: q.index, choix: juste ? bonne : (bonne + 1) % q.reponses.length })
    }

    // Une série d'Histoire seule : vingt bonnes réponses, puis ses trois vies.
    const serie = await poster('/api/campagne/serie', { categories: ['Histoire'] })
    for (let i = 0, q = serie.question; q; i++) q = (await repondre(`/api/campagne/serie/${serie.id}/reponse`, q, i < 20)).suivante
    // Le premier palier du sentier de la Nature : douze bonnes réponses, puis
    // des fautes jusqu'à la seizième — validée, l'épreuve va au bout.
    const sentier = BRANCHES.find(b => b.categorie === 'Nature')!.key
    let epreuve = await poster('/api/campagne/sentiers/epreuve', { branche: sentier, palier: 1 })
    for (let i = 0, id = epreuve.id; !epreuve.finie && epreuve.question; i++) epreuve = (await repondre(`/api/campagne/epreuve/${id}/reponse`, epreuve.question, i < 12)).epreuve
    // Le défi de la semaine, de toutes les catégories : cinq bonnes réponses, puis ses trois vies.
    const defi = await poster('/api/campagne/defi', {})
    for (let i = 0, q = defi.question; q; i++) q = (await repondre(`/api/campagne/serie/${defi.id}/reponse`, q, i < 5)).suivante
    assert.deepEqual(Object.keys(vu).sort(), ['Histoire', 'Nature'])
    assert.equal(vu.Nature.questions >= 16, true, 'les seize questions de l’épreuve')

    const moi = ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
    // « Ma carrière », par catégorie : ni soirée ni quiz du jour ici, la campagne seule.
    assert.deepEqual(moi.categories, vu)
    assert.deepEqual(
      moi.ecussons.filter((e: any) => e.justes > 0),
      CATEGORIES.filter(c => vu[c]).map(c => ({ categorie: c, justes: vu[c].justes, palier: palierEcusson(vu[c].justes) })),
    )
    // Vingt bonnes réponses en Histoire, au moins : le bronze. La Nature, à
    // douze et quelques, l'attend encore — la carte ne la montre pas.
    assert.equal(moi.ecussons.find((e: any) => e.categorie === 'Histoire').palier, 1)
    const carte = (await (await fetch(`${banc.url}/api/joueur/carte`, { headers: { Cookie: cookie } })).json()) as any
    assert.deepEqual(carte.profil.ecussons, [{ categorie: 'Histoire', palier: 1 }])
  } finally {
    await banc.close()
  }
})
