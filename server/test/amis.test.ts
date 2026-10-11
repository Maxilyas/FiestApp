// La feuille des amis (le souhait du propriétaire du 11 octobre 2026 : « une
// fenêtre avec la liste des amis, s'il est connecté, ajouter, supprimer,
// défier ») : sa liste, ceux qui l'ont ajouté sans qu'il les ait ajoutés, et
// qui est en ligne — entre amis réciproques seulement. On ajoute n'importe
// qui par son prénom, sans qu'il accepte : montrée à sens unique, la présence
// laisserait un inconnu guetter quand on se connecte. Puis le joueur touché
// (sa carte, la préparation ouverte à son adresse) : ce que la recherche
// dirait de lui, s'il est son ami, et sa propre cote. Et la carte d'un ami
// réciproque, qui s'ouvre même sans classement où elle se touche.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { AJOUTS_MONTRES } from '../../shared/campagne'
import { COTE_DE_DEPART } from '../../shared/duels'
import { EN_LIGNE_MS, ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

const idDe = (banc: Banc, login: string) => {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
  } finally {
    db.close()
  }
}

/** Ses amis et ce que la feuille en dit : le prénom, et « en ligne » s'il l'est. */
const lesAmis = (feuille: any) => feuille.amis.map((a: any) => [a.nom, a.enLigne === true])

test('« en ligne » : passé ces cinq dernières minutes, en mémoire seulement', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-amis-'))
  const profils = new ProfileStore(`file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`)
  try {
    await profils.init()
    const ines = (await profils.register({ login: 'ines', password: 'motdepasse1', name: 'Inès', avatar: '🦊' })).profile
    const jo = (await profils.register({ login: 'jo', password: 'motdepasse1', name: 'Jo', avatar: '🐻' })).profile
    assert.equal(profils.enLigne(ines.id), false, 'jamais passée : rien ne la dit en ligne')
    // Toute requête qui dit son profil passe par sa session : elle est là.
    const jeton = await profils.createSession(ines.id, 'banc')
    assert.equal(profils.sessionProfileId(jeton), ines.id)
    assert.equal(profils.enLigne(ines.id), true)
    assert.equal(profils.enLigne(ines.id, Date.now() + EN_LIGNE_MS - 1_000), true, 'quatre minutes et cinquante-neuf secondes après : encore là')
    assert.equal(profils.enLigne(ines.id, Date.now() + EN_LIGNE_MS + 1_000), false, 'cinq minutes sans rien : plus en ligne')
    assert.equal(profils.enLigne(jo.id), false, 'l’autre n’est pas passé')
  } finally {
    ;(profils as any).close?.()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('la feuille des amis : sa liste, qui l’a ajouté, et « en ligne » entre amis réciproques seulement', async () => {
  // L'horloge des duels avance d'une minute entre deux ajouts : dans la même milliseconde, ils n'auraient pas d'ordre.
  const horloge = { t: Date.UTC(2026, 9, 6, 8, 0) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  const ajouter = async (cookie: string, ami: string) => {
    horloge.t += 60_000
    assert.equal((await poster(banc, cookie, `/api/campagne/amis/${ami}/ajout`)).status, 200)
  }
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐸')
    const max = await inscrireProfil(banc.url, 'max', 'Max', '🐯')
    const noe = await inscrireProfil(banc.url, 'noe', 'Noé', '🐨')
    const [deLea, deTom, deHugo, deZoe, deMax, deNoe] = ['lea', 'tom', 'hugo', 'zoe', 'max', 'noe'].map(l => idDe(banc, l))

    // Personne encore.
    assert.deepEqual((await lire(banc, lea, '/api/duels/amis')).corps, { amis: [], tOntAjoute: [] })
    assert.equal((await fetch(`${banc.url}/api/duels/amis`)).status, 401, 'sans profil, pas d’amis')

    // Léa ajoute Tom puis Hugo ; Tom l'ajoute en retour, Hugo non.
    await ajouter(lea, deTom)
    await ajouter(lea, deHugo)
    await ajouter(tom, deLea)
    // Zoé, Max et Noé l'ajoutent sans qu'elle les ait ajoutés ; elle a retiré Max, et l'administrateur masque Noé.
    for (const qui of [zoe, max, noe]) await ajouter(qui, deLea)
    assert.equal((await poster(banc, lea, `/api/campagne/amis/${deMax}/retrait`)).status, 200)
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/jour/masquer', { profileId: deNoe, masque: true }, admin)).status, 200)

    // Tom et Hugo passent à l'instant : seul Tom, qui l'a ajoutée aussi, se dit en ligne.
    await lire(banc, tom, '/api/duels/amis')
    await lire(banc, hugo, '/api/duels/amis')
    const feuille = (await lire(banc, lea, '/api/duels/amis')).corps
    assert.deepEqual(
      lesAmis(feuille),
      [
        ['Hugo', false],
        ['Tom', true],
      ],
      'Hugo est en ligne lui aussi, mais il ne l’a pas ajoutée : rien ne le dit',
    )
    assert.deepEqual(feuille.amis.find((a: any) => a.nom === 'Tom'), { profileId: deTom, nom: 'Tom', avatar: '🐻', enLigne: true })
    // Ceux qui l'ont ajoutée : Zoé seule — ni Max, qu'elle a retiré, ni Noé, masqué, ni Tom, déjà dans sa liste.
    assert.deepEqual(feuille.tOntAjoute, [{ profileId: deZoe, nom: 'Zoé', avatar: '🐸' }])

    // De l'autre côté, Hugo voit Léa parmi ceux qui l'ont ajouté — sans un mot de sa présence : il ne l'a pas ajoutée.
    const deHugoLaFeuille = (await lire(banc, hugo, '/api/duels/amis')).corps
    assert.deepEqual(deHugoLaFeuille, { amis: [], tOntAjoute: [{ profileId: deLea, nom: 'Léa', avatar: '🦊' }] })

    // Léa rend la pareille à Zoé : elle quitte « ils t'ont ajouté » pour sa liste, et, passée à l'instant, s'y dit en ligne.
    await ajouter(lea, deZoe)
    const apres = (await lire(banc, lea, '/api/duels/amis')).corps
    assert.deepEqual(apres.tOntAjoute, [])
    assert.deepEqual(lesAmis(apres), [
      ['Zoé', true],
      ['Hugo', false],
      ['Tom', true],
    ])

    // Tom la retire : il reste dans sa liste à elle, mais ne s'y dit plus en ligne — sans qu'elle apprenne pourquoi.
    assert.equal((await poster(banc, tom, `/api/campagne/amis/${deLea}/retrait`)).status, 200)
    assert.equal(lesAmis((await lire(banc, lea, '/api/duels/amis')).corps).find((a: [string, boolean]) => a[0] === 'Tom')[1], false)

    // Ceux qui l'ont ajoutée se comptent au plus AJOUTS_MONTRES, les plus récents d'abord.
    const venus: string[] = []
    for (let i = 0; i < AJOUTS_MONTRES + 2; i++) {
      const login = `fan${i}`
      const cookie = await inscrireProfil(banc.url, login, `Fan${i}`, '🐙')
      await ajouter(cookie, deHugo)
      venus.unshift(`Fan${i}`)
    }
    const deHugoEnfin = (await lire(banc, hugo, '/api/duels/amis')).corps.tOntAjoute.map((a: any) => a.nom)
    assert.equal(deHugoEnfin.length, AJOUTS_MONTRES)
    assert.deepEqual(deHugoEnfin, venus.slice(0, AJOUTS_MONTRES))
  } finally {
    await banc.close()
  }
})

test('un joueur touché : ce que la recherche dirait de lui, s’il est son ami, et sa propre cote — jamais lui-même ni un masqué', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐸')
    const [deLea, deTom, deZoe] = ['lea', 'tom', 'zoe'].map(l => idDe(banc, l))

    assert.deepEqual((await lire(banc, lea, `/api/duels/joueurs/${deTom}`)).corps, {
      joueur: { profileId: deTom, nom: 'Tom', avatar: '🐻' },
      moi: { cote: COTE_DE_DEPART, joues: 0 },
    })
    // Ajouté, il le dit : la carte propose alors de le retirer.
    assert.equal((await poster(banc, lea, `/api/campagne/amis/${deTom}/ajout`)).status, 200)
    assert.equal((await lire(banc, lea, `/api/duels/joueurs/${deTom}`)).corps.joueur.ami, true)
    // Ni lui-même, ni un inconnu, ni un masqué ; sans profil, rien.
    assert.equal((await lire(banc, lea, `/api/duels/joueurs/${deLea}`)).status, 404)
    assert.equal((await lire(banc, lea, '/api/duels/joueurs/inconnu')).status, 404)
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/jour/masquer', { profileId: deZoe, masque: true }, admin)).status, 200)
    const masquee = await lire(banc, lea, `/api/duels/joueurs/${deZoe}`)
    assert.equal(masquee.status, 404)
    assert.equal(masquee.corps.error, 'Ce joueur est introuvable : cherche-le de nouveau')
    assert.equal((await fetch(`${banc.url}/api/duels/joueurs/${deTom}`)).status, 401)
  } finally {
    await banc.close()
  }
})

test('la carte d’un ami réciproque s’ouvre sans classement où la toucher ; à sens unique, jamais', async () => {
  // Carol n'a joué ni au quiz du jour ni en duel : sa carte ne s'ouvrait à
  // personne. L'ajouter par son prénom ne suffit pas — on l'ouvrirait alors à
  // n'importe qui —, mais si elle l'ajoute aussi, elle a choisi qui la voit.
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const carol = await inscrireProfil(banc.url, 'carol', 'Carol', '🐼')
    const [deAlice, deCarol] = ['alice', 'carol'].map(l => idDe(banc, l))
    assert.equal((await lire(banc, alice, `/api/joueur/carte/${deCarol}`)).status, 404)
    assert.equal((await poster(banc, alice, `/api/campagne/amis/${deCarol}/ajout`)).status, 200)
    assert.equal((await lire(banc, alice, `/api/joueur/carte/${deCarol}`)).status, 404, 'à sens unique : sa carte reste fermée')
    assert.equal((await poster(banc, carol, `/api/campagne/amis/${deAlice}/ajout`)).status, 200)
    const carte = await lire(banc, alice, `/api/joueur/carte/${deCarol}`)
    assert.equal(carte.status, 200, 'amies l’une de l’autre : elle s’ouvre')
    assert.deepEqual([carte.corps.nom, carte.corps.avatar, carte.corps.profil.prenom], ['Carol', '🐼', 'Carol'])
    const permis = new Set(['nom', 'avatar', 'profil', 'niveau', 'finition', 'eclat', 'legendaire', 'laurier'])
    assert.deepEqual(Object.keys(carte.corps).filter(k => !permis.has(k)), [], 'la carte de la salle, rien de plus : ni identifiant, ni rien du compte')
    // Elle la retire : sa carte se referme.
    assert.equal((await poster(banc, carol, `/api/campagne/amis/${deAlice}/retrait`)).status, 200)
    assert.equal((await lire(banc, alice, `/api/joueur/carte/${deCarol}`)).status, 404)
  } finally {
    await banc.close()
  }
})
