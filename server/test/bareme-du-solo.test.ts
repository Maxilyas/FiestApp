// Le barème du solo (le 6 octobre 2026) : le quiz du jour, la campagne, leurs
// hauts faits et les paliers paient bien plus — « que ça avance vite pour
// ceux qui jouent en solo ». Le bonus de série dès la partie commencée, le
// Lève-tôt qui paie, un palier de sentier payé une fois, le Tour du monde
// une fois ; et le démarrage qui l'apporte recompte tout ce qui s'était déjà
// joué, puis rattrape les niveaux gelés de l'ancienne courbe
// (`core/baremeDuSolo.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { LIGNE_CAMPAGNE, LIGNE_JOUR, LIGNE_PALIERS, LIGNE_RATTRAPAGE, ProfileStore, VERSION_BAREME } from '../src/auth/profiles'
import { DRAPEAU } from '../src/core/baremeDuSolo'
import { XP_DE_SERIE_MAX, XP_MAX_DU_JOUR, xpDeSerie, xpDuJour, xpDuPodium } from '../../shared/jour'
import { xpDuJourDeCampagne } from '../../shared/campagne'
import { HAUTS_FAITS_DE_SOIREE, HAUTS_FAITS_HORS_SOIREE, XP_PALIER, clePalier, xpDe, xpHorsDesSoirees } from '../../shared/hautsfaits'
import { PALIER_DU_MAITRE, XP_DU_MAITRE, XP_D_UN_PALIER, XP_D_UN_PALIER_A_PORTRAIT, xpDuPalier } from '../../shared/sentiers'
import { niveauPour, progression, xpDuNiveau } from '../../shared/profil'
import { CATEGORIES } from '../../shared/categories'

ProfileStore.tirageEclat = () => false

// ── Les règles pures ───────────────────────────────────────────────────────

test('la ligne des paliers : chaque palier une fois, chaque haut fait hors soirée chaque fois — le Tour du monde une fois', () => {
  assert.equal(xpHorsDesSoirees([]), 0)
  // Un palier rangé sous deux noms (une soirée et un jour) ne paie qu'une fois.
  assert.equal(xpHorsDesSoirees([clePalier('hf:assidu', 1), clePalier('hf:assidu', 1), clePalier('hf:assidu', 2)]), XP_PALIER[0] + XP_PALIER[1])
  // Un haut fait du jour paie chaque jour où il tombe.
  assert.equal(xpHorsDesSoirees(['hf:leve-tot', 'hf:leve-tot', 'hf:laurier']), 2 * xpDe('hf:leve-tot') + xpDe('hf:laurier'))
  assert.equal(xpHorsDesSoirees(['hf:tour-du-monde', 'hf:tour-du-monde']), xpDe('hf:tour-du-monde'), 'sa condition tenue le reste : il paie une fois')
  // Ceux des soirées paient dans la ligne de leur soirée ; le reste — un Divin, une page — ne paie pas.
  assert.equal(xpHorsDesSoirees(['hf:grand-chelem', 'dv:chronos', 'heures:10', 'mois:2026-09']), 0)
  // Tous ceux du quiz du jour et de la campagne paient, désormais.
  assert.ok(HAUTS_FAITS_HORS_SOIREE.every(h => h.xp > 0 && h.origine))
  assert.ok(HAUTS_FAITS_DE_SOIREE.every(h => !h.origine))
  assert.deepEqual([...XP_PALIER], [50, 100, 200])
})

test('un palier de sentier : cinquante, cent s’il ouvre un portrait, deux cent cinquante pour le maître', () => {
  assert.deepEqual([1, 2, 3, 12].map(xpDuPalier), [XP_D_UN_PALIER, XP_D_UN_PALIER_A_PORTRAIT, XP_D_UN_PALIER, XP_D_UN_PALIER_A_PORTRAIT])
  assert.equal(xpDuPalier(PALIER_DU_MAITRE), XP_DU_MAITRE)
  assert.deepEqual([0, 14, 2.5].map(xpDuPalier), [0, 0, 0])
  assert.deepEqual([XP_D_UN_PALIER, XP_D_UN_PALIER_A_PORTRAIT, XP_DU_MAITRE], [50, 100, 250])
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
const JOUR = '2026-09-26'
const LENDEMAIN = '2026-09-27'
const HEURE = 3_600_000

type Reponse = { status: number; corps: any }
const lire = (banc: Banc, cookie: string, chemin: string): Promise<Reponse> =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: await r.json() }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}): Promise<Reponse> =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: await r.json() }))

/** La base permanente, le temps d'une lecture ou d'une écriture. */
function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Ses lignes d'expérience, par nom. */
const lignesDe = (banc: Banc, login: string): Record<string, number> =>
  Object.fromEntries(
    base(banc, db => db.prepare('SELECT soiree_id, xp FROM profile_xp WHERE profile_id = ?').all(idDe(banc, login)) as { soiree_id: string; xp: number }[]).map(r => [
      r.soiree_id,
      r.xp,
    ]),
  )

/** Joue toute la partie du jour ; `juste(i)` dit s'il trouve la question i. */
async function jouerLeJour(banc: Banc, cookie: string, juste: (i: number) => boolean) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = base(banc, db =>
    JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions),
  ) as { bonne: number; reponses: string[] }[]
  while (etat.question) {
    const i = etat.question.index
    const bonne = questions[i].bonne
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: juste(i) ? bonne : (bonne + 1) % questions[i].reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

/** La bonne réponse d'une question de `baseDEssai` : celle qui commence par « Bonne ». */
const bonneDe = (q: { reponses: string[] }) => q.reponses.findIndex(r => r.startsWith('Bonne'))

/** Joue une épreuve : `justes` bonnes réponses d'abord, puis des fautes ; rend chaque réponse du serveur. */
async function jouerLEpreuve(banc: Banc, cookie: string, epreuve: any, justes: number): Promise<any[]> {
  let e = epreuve
  const reponses: any[] = []
  for (let i = 0; !e.finie && e.question; i++) {
    const q = e.question
    const r = await poster(banc, cookie, `/api/campagne/epreuve/${e.id}/reponse`, { index: q.index, choix: i < justes ? bonneDe(q) : (bonneDe(q) + 1) % q.reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    reponses.push(r.corps)
    e = r.corps.epreuve
  }
  return reponses
}

test('le bonus de série se paie dès la partie commencée, et grandit chaque jour d’affilée', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Commencée puis laissée — le téléphone qui sonne : la série compte le jour, son bonus aussi.
    const commencee = (await poster(banc, alice, '/api/jour/commencer')).corps
    assert.equal(commencee.etat, 'en-cours')
    assert.equal(lignesDe(banc, 'alice')[LIGNE_JOUR], xpDeSerie(1), 'payé avant la première réponse')

    // Le lendemain : une partie entière, au deuxième jour d'affilée.
    horloge.t += 24 * HEURE
    const fin = await jouerLeJour(banc, alice, i => i < 8)
    assert.equal(fin.etat, 'finie')
    assert.equal(fin.xpSerie, xpDeSerie(2))
    assert.equal(fin.xp, xpDuJour(fin.points, fin.pointsPossibles))
    const lignes = lignesDe(banc, 'alice')
    // La nuit a payé le podium d'hier ? Seule, Alice n'y monte pas : rien.
    assert.equal(lignes[LIGNE_JOUR], xpDeSerie(1) + xpDeSerie(2) + fin.xp)
    // La page du profil relit chaque jour avec son bonus.
    const jours = (await lire(banc, alice, '/api/joueur/moi')).corps.profile.jour.jours
    assert.deepEqual(
      jours.map((j: any) => [j.jour, j.xp]),
      [
        [LENDEMAIN, fin.xp + xpDeSerie(2)],
        [JOUR, xpDeSerie(1)],
      ],
    )
    assert.equal(xpDeSerie(12), XP_DE_SERIE_MAX)
  } finally {
    await banc.close()
  }
})

test('un haut fait du jour paie : le Lève-tôt, dans la ligne des paliers — et la fin de la partie compte tout ce qu’elle a rapporté', async () => {
  // 7 h à Paris : la partie finie avant huit heures.
  const horloge = { t: Date.UTC(2026, 8, 26, 5, 0) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const fin = await jouerLeJour(banc, alice, () => true)
    assert.deepEqual(
      fin.hautsFaits.map((h: any) => h.key),
      ['hf:leve-tot'],
    )
    // Le Sans-Faute · Bronze et le Lève-tôt, dans la même ligne.
    assert.equal(lignesDe(banc, 'alice')[LIGNE_PALIERS], XP_PALIER[0] + xpDe('hf:leve-tot'))
    const profil = (await lire(banc, alice, '/api/joueur/moi?leger')).corps.profile
    assert.equal(profil.xp, XP_MAX_DU_JOUR + xpDeSerie(1) + XP_PALIER[0] + xpDe('hf:leve-tot'))
    // Avant la partie, le niveau 1 : tout ce qu'elle a rapporté se retire, pas ses seuls points.
    assert.equal(fin.niveauAvant, 1)
    assert.equal(fin.niveauApres, niveauPour(profil.xp))
  } finally {
    await banc.close()
  }
})

test('un palier de sentier validé en jouant paie une fois — rejoué, il ne paie plus que ses bonnes réponses', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: baseDEssai(120, { categories: ['Nature'] }) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const p1 = (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 })).corps
    const premiere = await jouerLEpreuve(banc, lea, p1, 16)
    assert.deepEqual(
      premiere.map(r => r.xpPalier ?? 0),
      premiere.map((_, i) => (i === 9 ? xpDuPalier(1) : 0)),
      'le palier paie à la dixième bonne réponse, celle qui le valide',
    )
    assert.equal(lignesDe(banc, 'lea')[LIGNE_CAMPAGNE], xpDuJourDeCampagne(16) + xpDuPalier(1))
    const rejeu = (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 })).corps
    assert.equal(rejeu.rejeu, true)
    const encore = await jouerLEpreuve(banc, lea, rejeu, 16)
    assert.ok(encore.every(r => r.xpPalier === undefined), 'rejoué : pas une seconde fois')
    assert.equal(lignesDe(banc, 'lea')[LIGNE_CAMPAGNE], xpDuJourDeCampagne(32) + xpDuPalier(1))
  } finally {
    await banc.close()
  }
})

test('le Tour du monde ne tombe qu’une fois : sa condition tenue le reste, il ne paie pas chaque série d’après', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: baseDEssai(40) })
  try {
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const id = idDe(banc, 'tom')
    // Dix bonnes réponses dans une série de chacune des douze catégories, jouées avant.
    base(banc, db => {
      const serie = db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, categories)
         VALUES (?, ?, '[]', 10, 3, 10, ?, ?, 'serie', ?)`,
      )
      CATEGORIES.forEach((c, i) => serie.run(`avant-${i}`, id, DEBUT - 3600_000, DEBUT - 1800_000, JSON.stringify([c])))
    })
    /** Une série perdue en trois questions : ce qu'elle fait tomber. */
    const perdue = async () => {
      const s = (await poster(banc, tom, '/api/campagne/serie')).corps
      const questions = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(s.id) as { questions: string }).questions)) as {
        bonne: number
      }[]
      let fin: any
      for (let i = 0; i < 3; i++) fin = (await poster(banc, tom, `/api/campagne/serie/${s.id}/reponse`, { index: i, choix: (questions[i].bonne + 1) % 4 })).corps
      assert.equal(fin.finie, true)
      return (fin.recompenses ?? []).map((r: any) => r.key)
    }
    assert.ok((await perdue()).includes('hf:tour-du-monde'), 'la première série d’après le décerne')
    assert.ok(!(await perdue()).includes('hf:tour-du-monde'), 'la suivante ne le redécerne pas')
    const rangees = base(banc, db => (db.prepare(`SELECT COUNT(*) AS n FROM profile_badges WHERE profile_id = ? AND badge = 'hf:tour-du-monde'`).get(id) as { n: number }).n)
    assert.equal(rangees, 1)
    // L'Alpiniste · Bronze (un record de dix) et le Tour du monde, une fois.
    assert.equal(lignesDe(banc, 'tom')[LIGNE_PALIERS], XP_PALIER[0] + xpDe('hf:tour-du-monde'))
  } finally {
    await banc.close()
  }
})

test('le démarrage qui apporte le barème recompte ce qui s’était déjà joué, une fois, et rattrape les niveaux gelés', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(40) })
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const carole = await inscrireProfil(banc.url, 'carole', 'Carole', '🐙')
    // Deux jours de quiz du jour pour Alice et Carole, le premier gagné par Alice.
    await jouerLeJour(banc, alice, () => true)
    await jouerLeJour(banc, carole, i => i < 5)
    horloge.t += 24 * HEURE
    await jouerLeJour(banc, alice, i => i < 8)
    // Quelques bonnes réponses de campagne pour Carole.
    const s = (await poster(banc, carole, '/api/campagne/serie')).corps
    const questions = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(s.id) as { questions: string }).questions)) as {
      bonne: number
    }[]
    for (let i = 0; i < 4; i++) await poster(banc, carole, `/api/campagne/serie/${s.id}/reponse`, { index: i, choix: questions[i].bonne })

    const [ida, idb, idc] = ['alice', 'bob', 'carole'].map(l => idDe(banc, l))
    // Ce que la base gardait avant le barème du solo : l'expérience d'avant,
    // et Bob, gelé au niveau 11 que l'ancienne courbe lui avait donné.
    base(banc, db => {
      db.prepare('UPDATE jour_parties SET xp = 1, xp_serie = 0').run()
      db.prepare('UPDATE jour_podiums SET xp = 25').run()
      db.prepare(`UPDATE profile_xp SET xp = 1 WHERE soiree_id IN (?, ?, ?)`).run(LIGNE_JOUR, LIGNE_CAMPAGNE, LIGNE_PALIERS)
      db.prepare(
        `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'soiree-de-septembre', 'ailleurs', 2500, ?, ?)`,
      ).run(idb, JSON.stringify({ v: VERSION_BAREME, gain: {}, releve: {} }), DEBUT - 30 * 24 * HEURE)
      db.prepare('INSERT INTO profile_niveaux (profile_id, pas, niveau, created_at) VALUES (?, 25, 11, ?)').run(idb, DEBUT)
      db.prepare('UPDATE profiles SET xp = (SELECT COALESCE(SUM(xp), 0) FROM profile_xp WHERE profile_id = profiles.id)').run()
      db.prepare('DELETE FROM meta WHERE key = ?').run(DRAPEAU)
    })
    await banc.redemarrer()

    // Les parties et les podiums, au barème du jour.
    const parties = base(banc, db => db.prepare('SELECT profile_id, jour, points, xp, xp_serie FROM jour_parties ORDER BY profile_id, jour').all()) as {
      profile_id: string
      jour: string
      points: number
      xp: number
      xp_serie: number
    }[]
    for (const p of parties) {
      assert.equal(p.xp, xpDuJour(p.points, 2000), `${p.profile_id} ${p.jour}`)
      assert.equal(p.xp_serie, xpDeSerie(p.profile_id === ida && p.jour === LENDEMAIN ? 2 : 1), `${p.profile_id} ${p.jour}`)
    }
    assert.deepEqual(base(banc, db => db.prepare('SELECT profile_id, xp FROM jour_podiums').all()), [{ profile_id: ida, xp: xpDuPodium(1, 2) }])
    const somme = (id: string) => parties.filter(p => p.profile_id === id).reduce((n, p) => n + p.xp + p.xp_serie, 0)
    const deAlice = lignesDe(banc, 'alice')
    assert.equal(deAlice[LIGNE_JOUR], somme(ida) + xpDuPodium(1, 2))
    // Ses paliers et son Laurier, au barème du jour : la ligne des paliers s'est réécrite.
    const badges = base(banc, db => db.prepare('SELECT badge FROM profile_badges WHERE profile_id = ?').all(ida) as { badge: string }[]).map(b => b.badge)
    assert.ok(badges.includes('hf:laurier'))
    assert.equal(deAlice[LIGNE_PALIERS], xpHorsDesSoirees(badges))
    assert.equal(lignesDe(banc, 'carole')[LIGNE_CAMPAGNE], xpDuJourDeCampagne(4))
    assert.equal(lignesDe(banc, 'carole')[LIGNE_JOUR], somme(idc))
    for (const login of ['alice', 'carole']) {
      const profil = (await lire(banc, login === 'alice' ? alice : carole, '/api/joueur/moi?leger')).corps.profile
      assert.equal(profil.xp, Object.values(lignesDe(banc, login)).reduce((n, x) => n + x, 0), `le total de ${login}`)
    }

    // Bob : son niveau ne bouge pas, sa barre repart du début du niveau 11 —
    // et La Légende · Bronze, que son niveau tenait sans qu'on la lui ait décernée.
    const lignesDeBob = lignesDe(banc, 'bob')
    assert.equal(lignesDeBob[LIGNE_RATTRAPAGE], xpDuNiveau(11) - 2500)
    const deBob = (await lire(banc, bob, '/api/joueur/moi?leger')).corps.profile
    assert.equal(deBob.niveau, 11)
    assert.equal(deBob.xp, xpDuNiveau(11) + XP_PALIER[0])
    assert.deepEqual(
      [deBob.acquis, deBob.requis],
      [XP_PALIER[0], xpDuNiveau(12) - xpDuNiveau(11)],
      'la barre d’un niveau 11 comme les autres : 1 260 à gagner, pas 4 760',
    )
    assert.deepEqual(progression(deBob.xp, [{ pas: 25, niveau: 11 }]), { niveau: 11, acquis: XP_PALIER[0], requis: xpDuNiveau(12) - xpDuNiveau(11) })

    // Une fois : le démarrage suivant ne recompte rien.
    const avant = ['alice', 'bob', 'carole'].map(l => lignesDe(banc, l))
    await banc.redemarrer()
    assert.deepEqual(
      ['alice', 'bob', 'carole'].map(l => lignesDe(banc, l)),
      avant,
    )
  } finally {
    await banc.close()
  }
})
