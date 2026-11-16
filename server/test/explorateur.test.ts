// L'Explorateur (`hf:explorateur`) : une piste qui a changé deux fois de
// mesure en gardant sa clé — le niveau d'explorateur de l'Expédition (du 19
// au 26 octobre 2026), les salles complètes du Cabinet, puis ses traversées
// gagnées, une, cinq, quinze (le 1er novembre). Ses paliers rangés restent à
// leurs détenteurs (invariant 22), et il ne se cite ni ne se gagne que là où
// le Cabinet s'ouvre (`montreParLeServeur`), sauf à qui en tient déjà un.
//
// Ces épreuves viennent d'`expedition-codex.test.ts`, parti avec l'Expédition
// le 16 novembre 2026. Elles finissaient une expédition pour faire juger les
// paliers de la campagne ; elles finissent une série, qui les fait juger par
// le même chemin (`recompenser`). Ce qu'elles disaient de la renommée et du
// Globe-trotter est parti avec eux.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { CABINET_EN_PRODUCTION } from '../../shared/cabinet/ouverture'

ProfileStore.tirageEclat = () => false

const BASE = baseDEssai(120, { categories: ['Histoire', 'Sciences', 'Sport'] })

let banc: Banc

before(async () => {
  banc = await demarrer({ baseDeLaCampagne: BASE })
})

after(() => banc.close())

const lire = (cookie: string, chemin: string, b: Banc = banc) => fetch(`${b.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (cookie: string, chemin: string, corps: unknown = {}, b: Banc = banc) => ecrire(b.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(fn: (db: Database.Database) => T, b: Banc = banc): T {
  const db = new Database(b.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/**
 * Une traversée du Cabinet gagnée, posée en base derrière le dos du serveur — ce que L'Explorateur compte depuis le
 * 1er novembre 2026 (une salle complète du 26 octobre jusque-là) : son compte ne lit que son issue.
 */
const poserUneTraverseeGagnee = (b: Banc, profil: string) =>
  base(db => db.prepare(`INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le, finie_le, issue) VALUES (?, ?, '{}', 1, 2, 'gagnee')`).run(`gagnee-${profil}`, profil), b)

/**
 * Les paliers de L'Explorateur rangés sous une expédition, en base derrière le dos du serveur : un détenteur d'avant le
 * 26 octobre 2026, qui les a gagnés au niveau d'explorateur. Le serveur les relit à son démarrage suivant.
 */
const rangerLExplorateur = (b: Banc, profil: string, paliers: number) =>
  base(db => {
    const badge = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#campagne:une-expedition', '', '🎒', 'L’Explorateur', 1)`)
    for (let palier = 1; palier <= paliers; palier++) badge.run(profil, `hf:explorateur:${palier}`)
  }, b)

const idDe = async (cookie: string, b: Banc = banc) => (await lire(cookie, '/api/joueur/moi', b)).corps.profile.id as string
const sien = (moi: any) => moi.profile.hautsFaits.find((h: any) => h.key === 'hf:explorateur')
const piste = async (cookie: string, b: Banc = banc) => sien((await lire(cookie, '/api/joueur/moi', b)).corps)

/** Une partie de la campagne finie — une série commencée puis arrêtée là — : ce que sa fin a fait tomber. */
async function uneSeriePuisLaFin(c: string, b: Banc = banc): Promise<{ key: string }[]> {
  const serie = await poster(c, '/api/campagne/serie', {}, b)
  assert.equal(serie.status, 200, serie.corps.error)
  const fin = await poster(c, `/api/campagne/serie/${serie.corps.id}/abandon`, {}, b)
  assert.equal(fin.status, 200, fin.corps.error)
  return fin.corps.recompenses ?? []
}

test('L’Explorateur, aux traversées gagnées du Cabinet : sa piste se lit à la page du profil — rien sans traversée —, son bronze tombe à la fin de la partie qui suit la première, ce qu’il avait se garde ; un serveur où le Cabinet est fermé ne le cite ni ne le décerne', async () => {
  const c = await inscrireProfil(banc.url, 'explorateur', 'Explorateur')
  const id = await idDe(c)
  const avant = await piste(c)
  assert.deepEqual([avant.fois, avant.valeur, avant.prochain], [0, 0, 1])

  // Sans traversée gagnée, la fin d'une partie ne fait rien tomber pour lui.
  assert.ok(!(await uneSeriePuisLaFin(c)).some(r => r.key.startsWith('hf:explorateur')), 'aucune traversée : rien ne tombe')
  assert.equal((await piste(c)).valeur, 0)

  // Une traversée gagnée : la page du profil la compte aussitôt, et la fin de la partie suivante de la campagne fait
  // tomber le bronze — sous cette partie, comme tout palier de la campagne. Gagnée au Cabinet, il tombe au choix du
  // légendaire (`cabinet-defis.test.ts`) ; posée derrière son dos, à la fin suivante.
  poserUneTraverseeGagnee(banc, id)
  assert.equal((await piste(c)).valeur, 1)
  assert.deepEqual(
    (await uneSeriePuisLaFin(c)).filter(r => r.key.startsWith('hf:explorateur')).map(r => r.key),
    ['hf:explorateur:1'],
  )
  const apres = await piste(c)
  assert.deepEqual([apres.fois, apres.valeur, apres.prochain], [1, 1, 5])

  // Un détenteur d'avant : l'argent, gagné au niveau d'explorateur, rangé sous son expédition. Aucune traversée gagnée,
  // il le garde — la page le dit à l'argent, l'or à quinze traversées —, et la fin d'une partie ne lui reprend rien.
  const ancien = await inscrireProfil(banc.url, 'ancien-explorateur', 'Ancien')
  rangerLExplorateur(banc, await idDe(ancien), 2)
  // Relu au démarrage : le profil sait ce qu'il a.
  await banc.redemarrer()
  const garde = await piste(ancien)
  assert.deepEqual([garde.fois, garde.valeur, garde.prochain], [2, 0, 15])
  await uneSeriePuisLaFin(ancien)
  assert.equal((await piste(ancien)).fois, 2, 'rien ne se reprend')

  // La production telle qu'elle serait le jour où le drapeau du Cabinet s'y refermerait, forcé : la même traversée
  // gagnée n'y fait rien tomber, et la page du profil ne le cite pas à qui ne l'a pas — l'album ne lui fait pas de case
  // (`montreParLeServeur`). La production telle que le code la démarre, sans drapeau forcé : l'épreuve qui suit.
  const prod = await demarrer({ online: true, baseDeLaCampagne: BASE, cabinet: false })
  try {
    const p = await inscrireProfil(prod.url, 'production', 'Production')
    poserUneTraverseeGagnee(prod, await idDe(p, prod))
    const tombees = [...(await uneSeriePuisLaFin(p, prod)), ...(await uneSeriePuisLaFin(p, prod))]
    assert.ok(!tombees.some(r => r.key.startsWith('hf:explorateur')), 'ni décerné…')
    const moi = (await lire(p, '/api/joueur/moi', prod)).corps
    assert.ok(sien(moi) === undefined && moi.profile.hautsFaits.some((h: any) => h.key === 'hf:marathonien'), '…ni cité, quand les autres pistes le sont')

    // Un détenteur, lui, le garde cité même là : son argent, gagné quand le trophée comptait le niveau d'explorateur — la
    // production le montrait alors —, ne se cache pas avec le Cabinet fermé (invariant 22). Sa piste le dit à l'argent,
    // sans une traversée comptée : rien ne s'y lit ni ne s'y gagne.
    const detenteur = await inscrireProfil(prod.url, 'detenteur-production', 'Détenteur')
    rangerLExplorateur(prod, await idDe(detenteur, prod), 2)
    await prod.redemarrer()
    const tenu = await piste(detenteur, prod)
    assert.deepEqual([tenu?.fois, tenu?.valeur, tenu?.prochain], [2, 0, 15], 'cité à qui l’a, où que ce soit')
    assert.equal(await piste(p, prod), undefined, 'et toujours tu à qui ne l’a pas')
  } finally {
    await prod.close()
  }
})

// La production telle que le code la démarre, aucun drapeau forcé : L'Explorateur y a compté le niveau d'explorateur
// jusqu'au 26 octobre 2026, ses détenteurs l'ont gagné là, et le Cabinet n'y ouvre qu'avec son drapeau
// (`CABINET_EN_PRODUCTION`). Le trophée qui change de mesure ne se cache à aucun d'eux, que le drapeau soit ouvert ou
// non : c'est cette épreuve qui le garde, sans rougir le jour où il change. Qui ne l'a pas le voit, et le gagne, avec
// le Cabinet seulement.
test('en production, telle que le code la démarre : le détenteur de L’Explorateur le garde cité, le Cabinet fermé ou non ; qui ne l’a pas ne le voit et ne le gagne qu’avec le Cabinet ouvert', async () => {
  const prod = await demarrer({ online: true, baseDeLaCampagne: BASE })
  try {
    const detenteur = await inscrireProfil(prod.url, 'detenteur', 'Détenteur')
    rangerLExplorateur(prod, await idDe(detenteur, prod), 2)
    const neuf = await inscrireProfil(prod.url, 'sans-explorateur', 'Sans')
    poserUneTraverseeGagnee(prod, await idDe(neuf, prod))
    // Relu au démarrage : le profil sait ce qu'il a.
    await prod.redemarrer()
    const garde = await piste(detenteur, prod)
    assert.deepEqual([garde?.fois, garde?.valeur, garde?.prochain], [2, 0, 15], 'son argent, où qu’en soit le Cabinet')
    // Sa traversée gagnée ne compte qu'avec le Cabinet ouvert : fermé, ni la page ni la fin d'une partie ne la lisent.
    assert.equal((await piste(neuf, prod)) !== undefined, CABINET_EN_PRODUCTION, 'cité avec le Cabinet seulement')
    const tombees = await uneSeriePuisLaFin(neuf, prod)
    assert.equal(tombees.some(r => r.key === 'hf:explorateur:1'), CABINET_EN_PRODUCTION, 'décerné avec lui seulement')
  } finally {
    await prod.close()
  }
})
