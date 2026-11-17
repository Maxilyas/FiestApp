// La luciole (le 20 octobre 2026) : le compagnon de l'Expédition, que la
// Première traversée donnait — une expédition menée au bout, une fois. Elle
// ne se vendait pas : « que dans la collection, pas boutique » (le
// propriétaire). Depuis le 25 octobre 2026, la première salle complète du
// Cabinet de curiosités l'amène aussi (`cabinet-gardiens.test.ts`). Le 31
// octobre 2026, l'Expédition effacée (le choix du propriétaire), elle
// s'achète à la boutique comme les autres compagnons : la boutique, le coffre
// et « À la une » la proposent ; qui l'a la garde, et le Cabinet l'offre
// toujours. Offerte, comme un compagnon du coffre, elle s'écrit à prix nul et
// s'installe dans une niche vide, jamais à la place de celui qui y vit. Qui
// avait déjà mené une expédition au bout l'a reçue à un démarrage d'octobre —
// ce rattrapage est parti avec le code de l'Expédition, le 16 novembre 2026.
// Sa métamorphose, la luciole-aurore, s'ouvre comme celle des autres : sa
// forme ultime et l'Éclat.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { COMPAGNONS_DE_LA_BOUTIQUE, COMPAGNON_DE_L_EXPEDITION, compagnon, pourLAvoir } from '../../shared/compagnons'
import { aLaUne } from '../../shared/aLaUne'
import { tirerLeCoffre } from '../../shared/tresor'
import type { ObjetDuTresor } from '../../shared/coffre'

/** Une question d'essai de la catégorie et de la difficulté qu'on veut : 2 facile, 3 moyenne, 4 difficile. */
function question(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `luci${String(i).padStart(4, '0')}`,
    texte: `Question d'essai de la luciole numéro ${i} : laquelle est la bonne ?`,
    reponses: [`Bonne ${i}`, ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de la question ${i}.`,
    categorie,
    sousTheme: SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: autres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${i} : ${lu.refus}`)
  return lu.question
}

/** Huit questions de chaque marche dans chacune des douze catégories : de quoi tirer deux expéditions et leurs gardiens. */
const BASE = new BaseDeLaCampagne(CATEGORIES.flatMap((c, k) => [2, 3, 4].flatMap((d, m) => Array.from({ length: 8 }, (_, i) => question(k * 100 + m * 10 + i, c, d)))))

function enBase<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => enBase(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)
const reponse = async (r: Response) => ({ status: r.status, corps: (await r.json()) as any })
const lire = (banc: Banc, cookie: string, chemin: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(reponse)
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, cookie).then(reponse)
const moi = async (banc: Banc, cookie: string) => (await lire(banc, cookie, '/api/joueur/moi')).corps.profile

/** Des confettis : une partie du quiz du jour d'avant, avec ses bonnes réponses. */
function confettis(banc: Banc, profileId: string, justes: number) {
  enBase(banc, db =>
    db
      .prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-09-20', 1, 10, NULL, 0, ?, 1, 0)`)
      .run(profileId, justes),
  )
}

/**
 * Un magasin des profils à lui, sur une base jetable : la luciole offerte
 * passe par `offrirUnCompagnon`, que seul le Cabinet appelle encore — au
 * banc, il faudrait une salle complète pour y arriver
 * (`cabinet-gardiens.test.ts` le joue par les routes).
 */
async function profilsDEssai(): Promise<{ profils: ProfileStore; fichier: string; fermer: () => void }> {
  const dossier = mkdtempSync(path.join(tmpdir(), 'quizz-luciole-'))
  const fichier = path.join(dossier, 'profils.db')
  const profils = new ProfileStore(`file:${fichier}`)
  await profils.init()
  return {
    profils,
    fichier,
    fermer: () => {
      profils.close()
      rmSync(dossier, { recursive: true, force: true })
    },
  }
}

/** Dix heures, le 20 octobre 2026 : le jour où la luciole est venue. */
const QUAND = Date.UTC(2026, 9, 20, 8)

test('la luciole se vend, comme les autres : la boutique, le coffre et « À la une » la proposent', () => {
  // Elle ne se vendait pas tant que l'Expédition l'amenait ; effacée le 31 octobre 2026, la luciole n'aurait plus
  // qu'une salle complète du Cabinet pour venir — le propriétaire l'a mise en boutique.
  assert.equal(COMPAGNON_DE_L_EXPEDITION, 'luciole')
  assert.ok(COMPAGNONS_DE_LA_BOUTIQUE.some(c => c.key === 'luciole'))
  // « À la une », jour après jour : un compagnon de la boutique qu'il n'a pas, elle aussi — et rien quand il les a tous.
  let aLaUneUnJour = false
  for (let j = 1; j <= 28; j++) {
    const jour = `2026-11-${String(j).padStart(2, '0')}`
    const une = aLaUne({ possedes: [], jour, compagnons: [], fondsAchetes: [] })
    if (une.some(u => u.sorte === 'compagnon' && u.cle === 'luciole')) aLaUneUnJour = true
    const toutes = aLaUne({ possedes: [], jour, compagnons: COMPAGNONS_DE_LA_BOUTIQUE.map(c => ({ compagnon: c.key, rang: 0, justes: 0 })), fondsAchetes: [] })
    assert.ok(!toutes.some(u => u.sorte === 'compagnon'), `${jour} : tous adoptés, plus de compagnon à la une`)
  }
  assert.ok(aLaUneUnJour, 'elle passe à la une un jour du mois')
  // Le coffre royal, tout tiré à chaque rareté : il ne lui manque qu'elle — le coffre la donne, comme le loup.
  const tirages = (manque: string) =>
    Array.from({ length: 100 }, (_, i) => {
      let premier = true
      const hasard = () => (premier ? ((premier = false), i / 100) : 0)
      const possede = (o: ObjetDuTresor) => !(o.sorte === 'compagnon' && o.cle === manque)
      return tirerLeCoffre('royal', { possede, hasard, jour: '2026-11-02' }).objet
    })
  assert.ok(tirages('luciole').some(o => o.sorte === 'compagnon' && o.cle === 'luciole'), 'la luciole est au trésor')
  assert.ok(tirages('loup').some(o => o.sorte === 'compagnon' && o.cle === 'loup'))
})

test('chaque refus l’envoie à la boutique : son chemin d’avant ne se dit plus', () => {
  // La luciole s'achète, et ce que les refus disent est la boutique, comme pour les autres. Le chemin qui la disait
  // gagnée — « mène une expédition au bout », « complète une salle du Cabinet » — est parti avec l'Expédition ; la
  // première salle complète du Cabinet l'offre toujours (`cabinet-gardiens.test.ts`), sans que rien l'annonce d'avance.
  assert.equal(pourLAvoir(compagnon('luciole')!), 'La Luciole s’achète d’abord, à la boutique')
  assert.equal(COMPAGNON_DE_L_EXPEDITION, 'luciole', 'sa clé reste : des lignes `profile_compagnons` la portent')
})

test('elle s’achète à son prix, et chaque refus dit où l’avoir', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    // Elle s'achète, depuis le 31 octobre 2026, à son prix : 1000 confettis, comme les autres.
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom')
    confettis(banc, idDe(banc, 'tom'), 3000)
    const achat = await poster(banc, tom, '/api/joueur/compagnons', { compagnon: 'luciole' })
    assert.equal(achat.status, 200, achat.corps.error)
    assert.equal(enBase(banc, db => (db.prepare(`SELECT prix FROM profile_compagnons WHERE profile_id = ? AND compagnon = 'luciole'`).get(idDe(banc, 'tom')) as { prix: number }).prix), 1000)

    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const id = idDe(banc, 'lea')
    // Elle ne s'installe pas avant d'être à lui, ne se règle pas : chaque refus dit où l'avoir — la boutique.
    const niche = await ecrire(banc.url, '/api/joueur/moi', { niche: 'luciole' }, lea, 'PUT').then(reponse)
    assert.equal(niche.corps.error, 'La Luciole s’achète d’abord, à la boutique')
    const nom = await ecrire(banc.url, '/api/joueur/compagnons/luciole', { nom: 'Lumi' }, lea, 'PUT').then(reponse)
    assert.equal(nom.corps.error, 'La Luciole s’achète d’abord, à la boutique')
    const avant = await moi(banc, lea)
    assert.equal(avant.niche, undefined, 'sans compagnon, pas de niche')
    assert.equal(avant.compagnons, undefined)
    // À elle, par l'achat : elle se règle comme les autres, son nom à lui seul.
    confettis(banc, id, 1000)
    assert.equal((await poster(banc, lea, '/api/joueur/compagnons', { compagnon: 'luciole' })).status, 200)
    assert.equal((await lire(banc, lea, '/api/joueur/niche')).corps.niche.compagnon, 'luciole')
    const nommee = await ecrire(banc.url, '/api/joueur/compagnons/luciole', { nom: 'Lumi' }, lea, 'PUT').then(reponse)
    assert.equal(nommee.status, 200, nommee.corps.error)
    assert.deepEqual(nommee.corps.profile.compagnons, [{ compagnon: 'luciole', rang: 0, nom: 'Lumi' }])
  } finally {
    await banc.close()
  }
})

test('offerte, elle arrive dans sa niche vide, à prix nul, une fois', async () => {
  // Ce que faisait la Première traversée de l'Expédition, et que fait encore la première salle complète du Cabinet.
  const { profils, fichier, fermer } = await profilsDEssai()
  try {
    const { profile } = await profils.register({ login: 'lea', password: 'motdepasse1', name: 'Léa', avatar: '🦊' })
    const id = profile.id
    assert.equal(await profils.offrirUnCompagnon(id, COMPAGNON_DE_L_EXPEDITION, QUAND), true, 'neuve : la fin qui l’offre l’annonce')
    const apres = profils.toPublic((await profils.byId(id))!)
    assert.deepEqual(apres.compagnons, [{ compagnon: 'luciole', rang: 0 }])
    assert.equal(apres.niche, 'luciole', 'sa niche était vide : elle s’y installe')
    assert.notEqual(apres.legendaire, 'cp:luciole-ver', 'elle ne devient pas son avatar')
    // Offerte, comme un compagnon du coffre : le solde ne la retranche pas, le QG ne la compte pas aux ventes (prix nul).
    const ligne = () => {
      const db = new Database(fichier)
      try {
        return db.prepare(`SELECT prix, created_at FROM profile_compagnons WHERE profile_id = ?`).all(id)
      } finally {
        db.close()
      }
    }
    assert.deepEqual(ligne(), [{ prix: 0, created_at: QUAND }])
    // Offerte une seconde fois, elle ne vient pas deux fois, et rien ne l'annonce.
    assert.equal(await profils.offrirUnCompagnon(id, COMPAGNON_DE_L_EXPEDITION, QUAND + 1), false)
    assert.deepEqual(ligne(), [{ prix: 0, created_at: QUAND }])
  } finally {
    fermer()
  }
})

test('celui qui vit dans sa niche la garde : la luciole attend son tour, et s’y installe d’un toucher', async () => {
  const { profils, fermer } = await profilsDEssai()
  try {
    const { profile } = await profils.register({ login: 'tom', password: 'motdepasse1', name: 'Tom', avatar: '🦊' })
    const id = profile.id
    assert.equal(await profils.offrirUnCompagnon(id, 'loup', QUAND), true)
    assert.equal(await profils.offrirUnCompagnon(id, COMPAGNON_DE_L_EXPEDITION, QUAND + 1), true)
    const apres = profils.toPublic((await profils.byId(id))!)
    assert.equal(apres.niche, 'loup', 'le loup garde sa niche : c’est lui qui grandit')
    assert.deepEqual(apres.compagnons, [
      { compagnon: 'loup', rang: 0 },
      { compagnon: 'luciole', rang: 0 },
    ])
    const installee = profils.toPublic(await profils.update(id, { niche: 'luciole' }))
    assert.equal(installee.niche, 'luciole')
  } finally {
    fermer()
  }
})

test('sa luciole-aurore : à sa forme ultime, l’Éclat la lui ouvre — à porter, à montrer dans sa niche ; pas avant', async () => {
  // Peinte le 20 octobre 2026 : sa métamorphose se gagne comme celle des autres, et ne remplace rien.
  const banc = await demarrer()
  try {
    const ines = await inscrireProfil(banc.url, 'ines', 'Inès')
    const id = idDe(banc, 'ines')
    enBase(banc, db => {
      db.prepare(`INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, 'luciole', 0, 3, 1)`).run(id)
      db.prepare(`UPDATE profiles SET niche = 'luciole' WHERE id = ?`).run(id)
    })
    await banc.redemarrer()
    const fermee = 'La luciole-aurore s’ouvre à sa forme ultime, quand l’Éclat tombe sur elle'
    const portee = await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'cp:luciole-aurore' }, ines, 'PUT').then(reponse)
    assert.equal(portee.corps.error, fermee)
    const montree = await ecrire(banc.url, '/api/joueur/compagnons/luciole', { montree: 4 }, ines, 'PUT').then(reponse)
    assert.equal(montree.corps.error, fermee)

    // L'Éclat tombé sur sa luciole-constellation, au quiz du jour : elle s'ouvre.
    enBase(banc, db =>
      db.prepare(`INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, 'cp:luciole-constellation', 'jour:2026-10-01', 1)`).run(id),
    )
    await banc.redemarrer()
    assert.deepEqual((await moi(banc, ines)).compagnons, [{ compagnon: 'luciole', rang: 3, eclat: true }])
    const ouverte = await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'cp:luciole-aurore' }, ines, 'PUT').then(reponse)
    assert.equal(ouverte.status, 200, ouverte.corps.error)
    assert.equal(ouverte.corps.profile.legendaire, 'cp:luciole-aurore')
    const dansSaNiche = await ecrire(banc.url, '/api/joueur/compagnons/luciole', { montree: 4 }, ines, 'PUT').then(reponse)
    assert.equal(dansSaNiche.status, 200, dansSaNiche.corps.error)
    assert.deepEqual(dansSaNiche.corps.profile.compagnons, [{ compagnon: 'luciole', rang: 3, montree: 4, eclat: true }])
    // Elle ne remplace rien : sa luciole-constellation se porte toujours.
    const constellation = await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'cp:luciole-constellation' }, ines, 'PUT').then(reponse)
    assert.equal(constellation.status, 200, constellation.corps.error)
  } finally {
    await banc.close()
  }
})

test('une expédition menée au bout avant la luciole ne redonne plus rien au démarrage : le rattrapage a eu lieu, sa luciole reste', async () => {
  // Le rattrapage du 20 octobre 2026 (`premieres_traversees`, posé en production) offrait la luciole à qui avait déjà gardé
  // un gardien. Il est parti avec l'Expédition : un démarrage ne lit plus les expéditions d'avant, et ne reprend rien.
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé')
    const id = idDe(banc, 'zoe')
    enBase(banc, db => {
      db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, issue) VALUES ('exp-zoe', ?, '[]', 0, 3, 0, ?, ?, 'expedition', 'legendaire')`,
      ).run(id, QUAND, QUAND + 1)
      // Sa luciole, reçue à l'époque, datée de sa traversée.
      db.prepare(`INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, 'luciole', 0, 0, ?)`).run(id, QUAND + 1)
      db.prepare(`UPDATE profiles SET niche = 'luciole' WHERE id = ?`).run(id)
    })
    await banc.redemarrer({ disqueEfface: true })
    const apres = await moi(banc, zoe)
    assert.deepEqual(apres.compagnons, [{ compagnon: 'luciole', rang: 0 }])
    assert.equal(apres.niche, 'luciole')
    // Sans elle — une base d'essai restée avant le rattrapage —, le démarrage ne la donne plus : il n'écrit rien.
    enBase(banc, db => {
      db.prepare('DELETE FROM profile_compagnons WHERE profile_id = ?').run(id)
      db.prepare('UPDATE profiles SET niche = NULL WHERE id = ?').run(id)
    })
    await banc.redemarrer({ disqueEfface: true })
    assert.equal((await moi(banc, zoe)).compagnons, undefined)
    assert.equal(enBase(banc, db => db.prepare(`SELECT 1 FROM campagne_meta WHERE cle = 'premieres_traversees'`).all().length), 0, 'plus de drapeau posé')
  } finally {
    await banc.close()
  }
})
