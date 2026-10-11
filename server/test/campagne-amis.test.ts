// Ses amis (le souhait du propriétaire du 11 octobre 2026 : « défi entre amis
// avec liste d'amis, comment cela fonctionne ? ») : ceux qui ont relevé un de
// ses défis, ou dont il a relevé un. Personne ne s'ajoute à la main — ni
// demande, ni attente, ni recherche d'un inconnu par son nom : rien à
// modérer. On leur envoie un défi d'un toucher, il les attend sous leur
// onglet du défi ; un ami se retire, et revient s'ils jouent de nouveau
// ensemble ; un masqué n'est l'ami de personne.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { DUREE_D_UN_DUEL_MS } from '../../shared/campagne'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Joue une tentative jusqu'à sa fin : `justes` bonnes réponses, puis des fautes. */
async function jouer(banc: Banc, cookie: string, serie: string, justes: number) {
  const qs = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)) as {
    bonne: number
    reponses: string[]
  }[]
  for (let i = 0; i < qs.length; i++) {
    const choix = i < justes ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie}/reponse`, { index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    if (r.corps.finie) return
  }
}

test('ses amis : ceux qui ont joué ses défis, ou dont il a joué un — un défi leur part d’un toucher et les attend', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐸')
    const [deLea, deTom, deHugo, deZoe] = ['lea', 'tom', 'hugo', 'zoe'].map(l => idDe(banc, l))

    // Personne encore : ni amis, ni défis reçus.
    assert.deepEqual((await lire(banc, lea, '/api/campagne/amis')).corps, { amis: [], recus: [] })

    // Léa lance un défi, Tom le relève : ils sont amis, l'un pour l'autre.
    const premier = (await poster(banc, lea, '/api/campagne/duel', {})).corps
    await jouer(banc, lea, premier.serie.id, 3)
    horloge.t += 60_000
    await jouer(banc, tom, (await poster(banc, tom, `/api/campagne/duel/${premier.code}`)).corps.id, 2)
    assert.deepEqual((await lire(banc, lea, '/api/campagne/amis')).corps.amis, [{ profileId: deTom, nom: 'Tom', avatar: '🐻' }])
    assert.deepEqual((await lire(banc, tom, '/api/campagne/amis')).corps.amis, [{ profileId: deLea, nom: 'Léa', avatar: '🦊' }])
    // Hugo lance le sien, que Léa relève : il s'ajoute, le plus récent en tête.
    const deHugoLeDefi = (await poster(banc, hugo, '/api/campagne/duel', {})).corps
    horloge.t += 60_000
    await poster(banc, lea, `/api/campagne/duel/${deHugoLeDefi.code}`)
    assert.deepEqual(
      (await lire(banc, lea, '/api/campagne/amis')).corps.amis.map((a: any) => a.nom),
      ['Hugo', 'Tom'],
    )

    // Son défi suivant part d'un toucher à Tom et Hugo ; Zoé, qui n'est pas son amie, ne reçoit rien — sans que Léa l'apprenne.
    const second = (await poster(banc, lea, '/api/campagne/duel', { categories: ['Histoire'] })).corps
    await jouer(banc, lea, second.serie.id, 4)
    const avant = (await lire(banc, lea, `/api/campagne/amis?duel=${second.code}`)).corps
    assert.equal(avant.sien, true, 'le sien : il peut l’envoyer')
    assert.ok(avant.amis.every((a: any) => !a.deja))
    const envoi = await poster(banc, lea, `/api/campagne/duel/${second.code}/envoi`, { amis: [deTom, deHugo, deZoe, 42] })
    assert.deepEqual(envoi.corps, { envoyes: 2 })
    assert.deepEqual(
      (await lire(banc, lea, `/api/campagne/amis?duel=${second.code}`)).corps.amis.map((a: any) => [a.nom, a.deja]),
      [
        ['Hugo', 'recu'],
        ['Tom', 'recu'],
      ],
      'parti : rien à renvoyer',
    )
    // Tom le trouve sous son onglet du défi — qui, sur quoi, le temps qui reste ; Zoé, rien.
    assert.deepEqual((await lire(banc, tom, '/api/campagne/amis')).corps.recus, [
      { code: second.code, auteur: { nom: 'Léa', avatar: '🦊' }, categories: ['Histoire'], minutesRestantes: DUREE_D_UN_DUEL_MS / 60_000 },
    ])
    assert.deepEqual((await lire(banc, zoe, '/api/campagne/amis')).corps.recus, [])
    // L'accueil le dit aussi, sur le bouton de la campagne : qui le défie, et combien.
    const accueil = async (cookie: string) => (await lire(banc, cookie, '/api/joueur/moi?accueil')).corps.profile.campagne
    assert.deepEqual((await accueil(tom)).defisRecus, { n: 1, de: 'Léa' })
    assert.equal((await accueil(zoe)).defisRecus, undefined)
    // Le défi d'un autre ne s'envoie pas : seul celui qui l'a lancé l'envoie, les autres partagent son lien.
    assert.equal((await lire(banc, tom, `/api/campagne/amis?duel=${second.code}`)).corps.sien, undefined)
    const refus = await poster(banc, tom, `/api/campagne/duel/${second.code}/envoi`, { amis: [deLea] })
    assert.equal(refus.status, 400)
    assert.equal(refus.corps.error, 'Ce défi est introuvable : vérifie son lien')
    // Relevé, il quitte ses défis reçus — et Léa le lit relevé.
    await poster(banc, tom, `/api/campagne/duel/${second.code}`)
    assert.deepEqual((await lire(banc, tom, '/api/campagne/amis')).corps.recus, [])
    assert.equal((await accueil(tom)).defisRecus, undefined, 'l’accueil ne le dit plus')
    assert.equal((await lire(banc, lea, `/api/campagne/amis?duel=${second.code}`)).corps.amis.find((a: any) => a.nom === 'Tom').deja, 'releve')

    // Tom retire Léa : ni elle ni ses défis ne lui parviennent plus — elle n'en sait rien…
    assert.deepEqual((await poster(banc, tom, `/api/campagne/amis/${deLea}/retrait`)).corps, { ok: true })
    assert.deepEqual((await lire(banc, tom, '/api/campagne/amis')).corps.amis, [])
    const troisieme = (await poster(banc, lea, '/api/campagne/duel', {})).corps
    assert.deepEqual((await poster(banc, lea, `/api/campagne/duel/${troisieme.code}/envoi`, { amis: [deTom] })).corps, { envoyes: 1 })
    assert.deepEqual((await lire(banc, tom, '/api/campagne/amis')).corps.recus, [], 'retirée, ses défis ne lui parviennent plus')
    assert.equal((await accueil(tom)).defisRecus, undefined, 'ni à l’accueil')
    // … jusqu'à ce qu'ils jouent de nouveau ensemble : il ouvre son lien, elle revient.
    horloge.t += 60_000
    await poster(banc, tom, `/api/campagne/duel/${troisieme.code}`)
    assert.deepEqual(
      (await lire(banc, tom, '/api/campagne/amis')).corps.amis.map((a: any) => a.nom),
      ['Léa'],
    )

    // Fermé, un défi envoyé ne s'attend plus.
    const quatrieme = (await poster(banc, lea, '/api/campagne/duel', {})).corps
    await poster(banc, lea, `/api/campagne/duel/${quatrieme.code}/envoi`, { amis: [deHugo] })
    assert.equal((await lire(banc, hugo, '/api/campagne/amis')).corps.recus.length, 2)
    horloge.t += DUREE_D_UN_DUEL_MS
    assert.deepEqual((await lire(banc, hugo, '/api/campagne/amis')).corps.recus, [])

    // Masquée par l'administrateur, Léa n'est plus l'amie de personne.
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await poster(banc, admin, '/api/admin/jour/masquer', { profileId: deLea, masque: true })).status, 200)
    assert.ok(!(await lire(banc, tom, '/api/campagne/amis')).corps.amis.some((a: any) => a.profileId === deLea))
    assert.ok(!(await lire(banc, hugo, '/api/campagne/amis')).corps.amis.some((a: any) => a.profileId === deLea))

    // Sans profil, la porte le dit.
    assert.equal((await fetch(`${banc.url}/api/campagne/amis`)).status, 401)
  } finally {
    await banc.close()
  }
})

test('deux amis du même prénom et du même avatar se distinguent à l’affichage, jamais en base', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const camille = await inscrireProfil(banc.url, 'camille', 'Camille', '🐱')
    const autre = await inscrireProfil(banc.url, 'camille2', 'Camille', '🐱')
    const duel = (await poster(banc, lea, '/api/campagne/duel', {})).corps
    await poster(banc, camille, `/api/campagne/duel/${duel.code}`)
    await poster(banc, autre, `/api/campagne/duel/${duel.code}`)
    const noms = (await lire(banc, lea, '/api/campagne/amis')).corps.amis.map((a: any) => a.nom).sort()
    assert.deepEqual(noms, ['Camille', 'Camille (2)'])
    assert.ok(base(banc, db => (db.prepare(`SELECT COUNT(*) AS n FROM profiles WHERE name = 'Camille'`).get() as { n: number }).n) === 2, 'les prénoms ne changent pas en base')
  } finally {
    await banc.close()
  }
})

test('un profil supprimé emporte ses envois, ce qu’on lui a envoyé, et les retraits qui le nommaient', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const [deLea, deTom] = ['lea', 'tom'].map(l => idDe(banc, l))
    const duel = (await poster(banc, lea, '/api/campagne/duel', {})).corps
    await poster(banc, tom, `/api/campagne/duel/${duel.code}`)
    // Tom lance le sien et l'envoie à Léa ; Léa en envoie un second à Tom ; chacun retire l'autre.
    const sien = (await poster(banc, tom, '/api/campagne/duel', {})).corps
    assert.deepEqual((await poster(banc, tom, `/api/campagne/duel/${sien.code}/envoi`, { amis: [deLea] })).corps, { envoyes: 1 })
    const second = (await poster(banc, lea, '/api/campagne/duel', {})).corps
    assert.deepEqual((await poster(banc, lea, `/api/campagne/duel/${second.code}/envoi`, { amis: [deTom] })).corps, { envoyes: 1 })
    await poster(banc, lea, `/api/campagne/amis/${deTom}/retrait`)
    await poster(banc, tom, `/api/campagne/amis/${deLea}/retrait`)

    const admin = await connexionAnimateur(banc.url)
    const fait = await ecrire(banc.url, `/api/admin/profils/${deTom}`, undefined, admin, 'DELETE')
    assert.equal(fait.status, 200)
    const reste = base(banc, db => ({
      envois: db.prepare('SELECT code, profile_id FROM campagne_envois').all(),
      retraits: db.prepare('SELECT profile_id, ami FROM campagne_amis_retires').all(),
    }))
    assert.deepEqual(reste, { envois: [], retraits: [] }, 'ni ses envois, ni ce qu’on lui a envoyé, ni un retrait qui le nomme')
  } finally {
    await banc.close()
  }
})
