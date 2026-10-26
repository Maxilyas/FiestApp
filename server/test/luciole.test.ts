// La luciole (le 20 octobre 2026) : le compagnon de l'Expédition, qui ne
// s'achète pas — la Première traversée la donne, une expédition menée au
// bout, une fois. Ni la boutique, ni le coffre, ni « À la une » ne la
// montrent : « que dans la collection, pas boutique » (le propriétaire) —
// l'album la dit, `album-des-avatars.test.ts`. Comme un compagnon du coffre,
// elle s'écrit à prix nul et s'installe dans une niche vide, jamais à la
// place de celui qui y vit ; qui avait déjà mené une expédition au bout la
// reçoit au démarrage. Sa métamorphose, la luciole-aurore (peinte le même
// jour), s'ouvre comme celle des autres : sa forme ultime et l'Éclat. Depuis
// le 25 octobre 2026, la première salle complète du Cabinet de curiosités
// l'amène aussi (`cabinet-gardiens.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { GARDIEN, type VueDeLExpedition } from '../../shared/expedition'
import { COMPAGNONS_DE_LA_BOUTIQUE, COMPAGNON_DE_L_EXPEDITION, cheminDeLaLuciole } from '../../shared/compagnons'
import { CABINET_EN_PRODUCTION } from '../../shared/cabinet/ouverture'
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

/** Les questions telles que l'expédition les garde, bonne réponse comprise : ce que seul le serveur sait. */
function bonneDe(banc: Banc, id: string, index: number): { bonne: number } {
  return enBase(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions)[index])
}

/**
 * Une expédition jouée sans une faute jusqu'au bout de l'acte 3 : une offre
 * laissée, une vie au campement, sinon le gardien s'il est là, ou la
 * première escale permise qui pose une question (`expedition.test.ts`).
 */
async function allerAuBout(banc: Banc, cookie: string): Promise<VueDeLExpedition> {
  const depart = await poster(banc, cookie, '/api/expedition')
  assert.equal(depart.status, 200, depart.corps.error)
  let v: VueDeLExpedition = depart.corps
  for (let pas = 0; pas < 400 && v.issue === 'en-route'; pas++) {
    if (v.question) {
      const r = await poster(banc, cookie, `/api/expedition/${v.id}/reponse`, { position: v.question.index, choix: bonneDe(banc, v.id, v.question.index).bonne })
      assert.equal(r.status, 200, r.corps.error)
      v = r.corps.expedition
      continue
    }
    const posent = (id: string) => ['question', 'elite', 'source'].includes(v.carte?.escales.find(e => e.id === id)?.sorte ?? '')
    const vers = v.permises.includes(GARDIEN) ? GARDIEN : (v.permises.find(posent) ?? v.permises[0])
    const geste = v.offre ? { quoi: 'prendre', jokers: [] } : v.campement ? { quoi: 'camper' } : { quoi: 'avancer', vers }
    const r = await poster(banc, cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste })
    assert.equal(r.status, 200, r.corps.error)
    v = r.corps.expedition
  }
  assert.equal(v.issue, 'au-bout')
  return v
}

/** Au bout, le premier gardien gardé : la fin. */
async function garder(banc: Banc, cookie: string, v: VueDeLExpedition) {
  const r = await poster(banc, cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'garder', legendaire: v.gardiens[0].cle } })
  assert.equal(r.status, 200, r.corps.error)
  assert.equal(r.corps.expedition.issue, 'legendaire')
  return r.corps
}

test('la luciole ne se vend pas : ni le coffre, ni « À la une » ne la proposent', () => {
  assert.equal(COMPAGNON_DE_L_EXPEDITION, 'luciole')
  assert.ok(!COMPAGNONS_DE_LA_BOUTIQUE.some(c => c.key === 'luciole'))
  // « À la une », jour après jour : un compagnon de la boutique qu'il n'a pas, jamais elle — et rien quand il a les trois.
  for (let j = 1; j <= 28; j++) {
    const jour = `2026-11-${String(j).padStart(2, '0')}`
    const une = aLaUne({ possedes: [], jour, compagnons: [], fondsAchetes: [] })
    assert.ok(!une.some(u => u.sorte === 'compagnon' && u.cle === 'luciole'), jour)
    const toutes = aLaUne({ possedes: [], jour, compagnons: COMPAGNONS_DE_LA_BOUTIQUE.map(c => ({ compagnon: c.key, rang: 0, justes: 0 })), fondsAchetes: [] })
    assert.ok(!toutes.some(u => u.sorte === 'compagnon'), `${jour} : les trois adoptés, plus de compagnon à la une`)
  }
  // Le coffre royal, tout tiré à chaque rareté : il ne lui manque qu'elle — jamais elle, des confettis au bout.
  const tirages = (manque: string) =>
    Array.from({ length: 100 }, (_, i) => {
      let premier = true
      const hasard = () => (premier ? ((premier = false), i / 100) : 0)
      const possede = (o: ObjetDuTresor) => !(o.sorte === 'compagnon' && o.cle === manque)
      return tirerLeCoffre('royal', { possede, hasard, jour: '2026-11-02' }).objet
    })
  assert.ok(!tirages('luciole').some(o => o.sorte === 'compagnon'), 'la luciole n’est pas au trésor')
  // Le témoin : le loup qui lui manque, le coffre le donne à sa rareté légendaire.
  assert.ok(tirages('loup').some(o => o.sorte === 'compagnon' && o.cle === 'loup'))
})

test('sa voie neuve : la première salle complète du Cabinet l’amène aussi — dite quand le Cabinet s’ouvre en production', () => {
  // L'Expédition laisse sa place au Cabinet : sans lui, la luciole ne rejoindrait plus personne de neuf. Le Cabinet
  // l'offre à la réconciliation qui trouve une salle complète (`cabinet-gardiens.test.ts`) ; ses mots la disent quand
  // il s'ouvre — fermé en production, ils enverraient chercher une page qui n'y répond pas.
  assert.equal(cheminDeLaLuciole(false), 'mène une expédition au bout')
  assert.equal(cheminDeLaLuciole(true), 'mène une expédition au bout, ou complète une salle du Cabinet')
  assert.equal(cheminDeLaLuciole(), cheminDeLaLuciole(CABINET_EN_PRODUCTION))
})

test('la Première traversée : une expédition menée au bout amène la luciole dans sa niche vide, à prix nul, une fois', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const id = idDe(banc, 'lea')
    // Elle ne s'achète pas, ne s'installe pas avant d'être à lui, ne se règle pas : chaque refus dit où la gagner.
    confettis(banc, id, 3000)
    const achat = await poster(banc, lea, '/api/joueur/compagnons', { compagnon: 'luciole' })
    assert.equal(achat.status, 400)
    assert.equal(achat.corps.error, 'La Luciole ne s’achète pas : elle rejoint qui mène une expédition au bout')
    const niche = await ecrire(banc.url, '/api/joueur/moi', { niche: 'luciole' }, lea, 'PUT').then(reponse)
    assert.equal(niche.corps.error, 'La Luciole se gagne d’abord : mène une expédition au bout')
    const nom = await ecrire(banc.url, '/api/joueur/compagnons/luciole', { nom: 'Lumi' }, lea, 'PUT').then(reponse)
    assert.equal(nom.corps.error, 'La Luciole se gagne d’abord : mène une expédition au bout')
    const avant = await moi(banc, lea)
    assert.equal(avant.niche, undefined, 'sans compagnon, pas de niche')

    // Une expédition abandonnée ne l'amène pas.
    const abandon = await poster(banc, lea, '/api/expedition')
    assert.equal((await poster(banc, lea, `/api/expedition/${abandon.corps.id}/abandon`)).status, 200)
    assert.equal((await moi(banc, lea)).compagnons, undefined)

    const fin = await garder(banc, lea, await allerAuBout(banc, lea))
    assert.equal(fin.compagnon, 'luciole', 'la fin l’annonce')
    const apres = await moi(banc, lea)
    assert.deepEqual(apres.compagnons, [{ compagnon: 'luciole', rang: 0 }])
    assert.equal(apres.niche, 'luciole', 'sa niche était vide : elle s’y installe')
    assert.notEqual(apres.legendaire, 'cp:luciole-ver', 'elle ne devient pas son avatar')
    // Offerte, comme un compagnon du coffre : le solde ne la retranche pas, le QG ne la compte pas aux ventes (prix nul).
    assert.equal(enBase(banc, db => (db.prepare(`SELECT prix FROM profile_compagnons WHERE profile_id = ? AND compagnon = 'luciole'`).get(id) as { prix: number }).prix), 0)
    const sa = (await lire(banc, lea, '/api/joueur/niche')).corps
    assert.equal(sa.niche.compagnon, 'luciole')
    // Elle se règle comme les autres : son nom, à lui seul.
    const nommee = await ecrire(banc.url, '/api/joueur/compagnons/luciole', { nom: 'Lumi' }, lea, 'PUT').then(reponse)
    assert.equal(nommee.status, 200, nommee.corps.error)
    assert.deepEqual(nommee.corps.profile.compagnons, [{ compagnon: 'luciole', rang: 0, nom: 'Lumi' }])

    // Une seconde expédition menée au bout ne l'amène pas deux fois.
    const encore = await garder(banc, lea, await allerAuBout(banc, lea))
    assert.equal(encore.compagnon, undefined)
    assert.equal(enBase(banc, db => (db.prepare(`SELECT COUNT(*) AS n FROM profile_compagnons WHERE profile_id = ?`).get(id) as { n: number }).n), 1)
  } finally {
    await banc.close()
  }
})

test('celui qui vit dans sa niche la garde : la luciole attend son tour, et s’y installe d’un toucher', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom')
    confettis(banc, idDe(banc, 'tom'), 1000)
    assert.equal((await poster(banc, tom, '/api/joueur/compagnons', { compagnon: 'loup' })).status, 200)
    const fin = await garder(banc, tom, await allerAuBout(banc, tom))
    assert.equal(fin.compagnon, 'luciole')
    const apres = await moi(banc, tom)
    assert.equal(apres.niche, 'loup', 'le loup garde sa niche : c’est lui qui grandit')
    assert.deepEqual(apres.compagnons, [
      { compagnon: 'loup', rang: 0 },
      { compagnon: 'luciole', rang: 0 },
    ])
    const installee = await ecrire(banc.url, '/api/joueur/moi', { niche: 'luciole' }, tom, 'PUT').then(reponse)
    assert.equal(installee.status, 200, installee.corps.error)
    assert.equal(installee.corps.profile.niche, 'luciole')
  } finally {
    await banc.close()
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

test('qui avait déjà mené une expédition au bout la reçoit au démarrage, datée de sa traversée — une fois', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé')
    const id = idDe(banc, 'zoe')
    await garder(banc, zoe, await allerAuBout(banc, zoe))
    // Le serveur d'avant la luciole : ni elle, ni sa niche, ni le drapeau du rattrapage.
    const finieLe = enBase(banc, db => {
      db.prepare('DELETE FROM profile_compagnons WHERE profile_id = ?').run(id)
      db.prepare('UPDATE profiles SET niche = NULL WHERE id = ?').run(id)
      db.prepare(`DELETE FROM campagne_meta WHERE cle = 'premieres_traversees'`).run()
      return (db.prepare(`SELECT finie_le FROM campagne_series WHERE profile_id = ? AND mode = 'expedition' AND issue = 'legendaire'`).get(id) as { finie_le: number }).finie_le
    })
    await banc.redemarrer({ disqueEfface: true })
    const apres = await moi(banc, zoe)
    assert.deepEqual(apres.compagnons, [{ compagnon: 'luciole', rang: 0 }])
    assert.equal(apres.niche, 'luciole')
    assert.equal(enBase(banc, db => (db.prepare(`SELECT created_at FROM profile_compagnons WHERE profile_id = ?`).get(id) as { created_at: number }).created_at), finieLe)
    // Une fois : le démarrage suivant ne relit rien.
    enBase(banc, db => db.prepare('DELETE FROM profile_compagnons WHERE profile_id = ?').run(id))
    await banc.redemarrer({ disqueEfface: true })
    assert.equal((await moi(banc, zoe)).compagnons, undefined)
  } finally {
    await banc.close()
  }
})
