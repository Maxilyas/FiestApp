// Les joueurs croisés (le souhait du propriétaire du 11 octobre 2026 : « dans
// les défis, c'est dommage que ça montre pas des joueurs pour les ajouter en
// ami », puis « Défier quelqu'un, go ») : de quoi défier ou ajouter quelqu'un
// sans connaître son prénom — dans « Contre qui ? » et dans la feuille des
// amis. Ceux de ses dernières soirées d'abord (il était dans la salle), puis
// ses adversaires de duel, ceux du défi de la semaine, et, pour compléter,
// ceux de son niveau. Jamais lui, un masqué, un ami, ni qui il a retiré ;
// chaque source sa part, puis la place qui reste au plus proche.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { VIES } from '../../shared/campagne'
import { gainVide, releveVide } from '../../shared/profil'
import { JOUEURS_CROISES } from '../../shared/duels'
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

// Un mardi : la semaine du défi a de quoi se jouer.
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

/** Une soirée jouée ensemble : une ligne d'expérience chacun — la même soirée du même espace —, rangée à `quand`. */
function soiree(banc: Banc, soireeId: string, espace: string, quand: number, ids: string[]) {
  const detail = JSON.stringify({ v: VERSION_BAREME, gain: gainVide(), releve: releveVide() })
  base(banc, db => {
    const ligne = db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, 0, ?, ?)`)
    for (const id of ids) ligne.run(id, soireeId, espace, detail, quand)
  })
}

/** Des duels au hasard joués, écrits au journal : `justes` contre `sesJustes`, contre `contre` — un profil, ou personne qui existe encore. */
function duelJoue(banc: Banc, profileId: string, justes: number, sesJustes: number, quand: number, contre: string = randomUUID()) {
  const adversaire = { serie: randomUUID(), profil: contre, reponses: [...Array(sesJustes).fill(true), ...Array(VIES).fill(false)] }
  base(banc, db =>
    db
      .prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
         VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
      )
      .run(randomUUID(), profileId, justes + VIES, justes, quand, quand + 30_000, JSON.stringify(adversaire)),
  )
}

/** Joue une tentative jusqu'à sa fin : `justes` bonnes réponses, puis des fautes. */
async function jouer(banc: Banc, cookie: string, serie: string, justes: number): Promise<any> {
  const qs = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)) as {
    bonne: number
    reponses: string[]
  }[]
  let derniere: any = null
  for (let i = 0; i < qs.length && !derniere?.finie; i++) {
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie}/reponse`, { index: i, choix: i < justes ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    derniere = r.corps
  }
  return derniere
}

/** Ce que la liste dit de chacun : son prénom, et ce qui le fait paraître. */
const parQui = (croises: any[]) => croises.map(c => [c.nom, c.croise])

test('les joueurs croisés : ses soirées, ses duels, le défi de la semaine, puis son niveau — jamais un ami, un retiré, un masqué, ni un inconnu de la salle', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const comptes: Record<string, string> = {}
    for (const [login, nom, avatar] of [
      ['tom', 'Tom', '🐻'],
      ['ana', 'Ana', '🐨'],
      ['bob', 'Bob', '🐯'],
      ['noe', 'Noé', '🐸'],
      ['cle', 'Clé', '🦉'],
      ['hugo', 'Hugo', '🐼'],
      ['max', 'Max', '🦁'],
      ['zoe', 'Zoé', '🐙'],
      ['paul', 'Paul', '🐧'],
      ['ines', 'Inès', '🦄'],
    ]) {
      comptes[login] = await inscrireProfil(banc.url, login, nom, avatar)
    }
    const id = (login: string) => idDe(banc, login)

    // Rien encore : ni soirée, ni duel, ni défi, ni personne de classé — rien, pas une liste au hasard.
    assert.deepEqual((await lire(banc, lea, '/api/duels/croises')).corps, [])
    assert.equal((await fetch(`${banc.url}/api/duels/croises`)).status, 401, 'sans profil, personne')
    // Les cotes du classement se gardent dix minutes au plus : les duels écrits plus bas à la main, sans passer par le serveur, attendent la relecture.
    horloge.t += 11 * 60_000

    // Une soirée chez elle : Tom, Ana — son amie —, Bob — qu'elle a retiré —, et Noé, que l'administrateur masque.
    // La même soirée, du même nom, dans un autre espace : Clé n'y était pas avec elle.
    soiree(banc, 'la-soiree-des-renards', 'esp-lea', DEBUT - 3_600_000, [id('lea'), id('tom'), id('ana'), id('bob'), id('noe')])
    soiree(banc, 'la-soiree-des-renards', 'esp-ailleurs', DEBUT - 3_600_000, [id('cle')])
    // Le quiz du jour range sa ligne à part, comme Zoé : jouer le même jour n'est pas jouer ensemble.
    soiree(banc, '#jour', '', DEBUT - 60_000, [id('lea'), id('zoe')])
    assert.equal((await poster(banc, lea, `/api/campagne/amis/${id('ana')}/ajout`)).status, 200)
    assert.equal((await poster(banc, lea, `/api/campagne/amis/${id('bob')}/ajout`)).status, 200)
    assert.equal((await poster(banc, lea, `/api/campagne/amis/${id('bob')}/retrait`)).status, 200)
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/jour/masquer', { profileId: id('noe'), masque: true }, admin)).status, 200)

    // Ses duels : une rencontre contre la série de Max, puis Hugo qui la défie — son duel lui parvient à sa dernière réponse.
    duelJoue(banc, id('lea'), 9, 8, DEBUT - 120_000, id('max'))
    horloge.t += 60_000
    const lance = await poster(banc, comptes.hugo, '/api/campagne/duel', { adversaire: id('lea') })
    assert.equal(lance.status, 200, lance.corps.error)
    assert.deepEqual((await jouer(banc, comptes.hugo, lance.corps.serie.id, 2)).partiA, ['Léa'])

    // Le défi de la semaine : Zoé y a répondu.
    horloge.t += 60_000
    const defi = (await poster(banc, comptes.zoe, '/api/campagne/defi')).corps
    assert.ok(defi.id, defi.error)
    await jouer(banc, comptes.zoe, defi.id, 1)

    // Paul a joué des duels ces jours-ci : sa cote est la plus proche de la sienne.
    duelJoue(banc, id('paul'), 9, 8, DEBUT - 600_000)

    const croises = (await lire(banc, lea, '/api/duels/croises')).corps
    assert.deepEqual(
      parQui(croises),
      [
        ['Tom', 'soiree'],
        ['Hugo', 'duel'],
        ['Max', 'duel'],
        ['Zoé', 'defi'],
        ['Paul', 'niveau'],
      ],
      'la soirée d’abord, puis ses duels — le plus récent d’abord —, le défi, son niveau ; ni Ana, son amie, ni Bob, retiré, ni Noé, masqué, ni Clé, d’un autre espace, ni Inès, qu’elle n’a croisée nulle part',
    )
    // Chacun comme une ligne de recherche : de quoi le reconnaître, et contre qui l'on joue.
    assert.deepEqual(croises[0], { profileId: id('tom'), nom: 'Tom', avatar: '🐻', croise: 'soiree' })
    const paul = croises.find((c: any) => c.nom === 'Paul')
    assert.equal(typeof paul.cote, 'number')
    assert.equal(typeof paul.ligue, 'string')
    assert.equal(paul.rang, 1, 'le même duel gagné que Léa : la même cote, le rang partagé (invariant 15)')
    assert.ok(croises.every((c: any) => !('ami' in c)), 'jamais un ami')

    // La feuille des amis les montre aussi, sauf ceux qui l'ont ajoutée : ils sont au-dessus.
    assert.equal((await poster(banc, comptes.tom, `/api/campagne/amis/${id('lea')}/ajout`)).status, 200)
    const feuille = (await lire(banc, lea, '/api/duels/amis')).corps
    assert.deepEqual(feuille.tOntAjoute.map((a: any) => a.nom), ['Tom'])
    assert.deepEqual(parQui(feuille.croises), [
      ['Hugo', 'duel'],
      ['Max', 'duel'],
      ['Zoé', 'defi'],
      ['Paul', 'niveau'],
    ])
    assert.deepEqual(parQui((await lire(banc, lea, '/api/duels/croises')).corps)[0], ['Tom', 'soiree'], 'pour défier, Tom reste un joueur croisé')

    // Ajouté, Hugo quitte les joueurs croisés pour ses amis.
    assert.equal((await poster(banc, lea, `/api/campagne/amis/${id('hugo')}/ajout`)).status, 200)
    assert.ok(!parQui((await lire(banc, lea, '/api/duels/croises')).corps).some(([nom]: string[]) => nom === 'Hugo'))
  } finally {
    await banc.close()
  }
})

test('chaque source sa part : des soirées pleines ne cachent pas un adversaire, et la place qui reste va au plus proche', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const convives: string[] = []
    for (let i = 0; i < JOUEURS_CROISES + 2; i++) {
      await inscrireProfil(banc.url, `convive${i}`, `Convive${i}`, '🐙')
      convives.push(idDe(banc, `convive${i}`))
    }
    await inscrireProfil(banc.url, 'max', 'Max', '🦁')
    await inscrireProfil(banc.url, 'paul', 'Paul', '🐧')
    // Huit convives, chacun sa soirée avec elle — la plus récente d'abord ; une rencontre contre Max ; Paul classé.
    convives.forEach((c, i) => soiree(banc, `soiree-${i}`, 'esp-lea', DEBUT - (i + 1) * 3_600_000, [idDe(banc, 'lea'), c]))
    duelJoue(banc, idDe(banc, 'lea'), 9, 8, DEBUT - 60_000, idDe(banc, 'max'))
    duelJoue(banc, idDe(banc, 'paul'), 9, 8, DEBUT - 600_000)

    const croises = (await lire(banc, lea, '/api/duels/croises')).corps
    assert.equal(croises.length, JOUEURS_CROISES)
    assert.deepEqual(
      parQui(croises),
      [
        ['Convive0', 'soiree'],
        ['Convive1', 'soiree'],
        ['Convive2', 'soiree'],
        ['Convive3', 'soiree'],
        ['Convive4', 'soiree'],
        ['Max', 'duel'],
      ],
      'Max passe malgré huit convives ; la place qui reste va aux soirées, pas à Paul, qu’elle n’a croisé nulle part',
    )
  } finally {
    await banc.close()
  }
})
