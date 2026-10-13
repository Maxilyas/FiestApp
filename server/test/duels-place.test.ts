// Sa place au classement des duels, telle que l'onglet « Classement » de leur
// page la montre (la maquette A1, choisie par le propriétaire le 12 octobre
// 2026 : « le classement, l'historique avec aussi les matchs en cours », sans
// texte) : sa place sur combien, les places gagnées depuis lundi, ses deux
// voisins — même au-delà des lignes que la page reçoit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { VIES } from '../../shared/campagne'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

// Un mardi, 10 h à Paris : sa semaine a commencé la veille.
const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const JOUR_MS = 24 * 3_600_000
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

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

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des duels au hasard joués, écrits dans le journal : `n` fois `justes` contre `sesJustes`, finis à partir de `depuis`. */
function duelsJoues(banc: Banc, profileId: string, n: number, justes: number, sesJustes: number, depuis: number) {
  base(banc, db => {
    for (let i = 0; i < n; i++) {
      const adversaire = { serie: randomUUID(), profil: randomUUID(), reponses: [...Array(sesJustes).fill(true), ...Array(VIES).fill(false)] }
      db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
         VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
      ).run(randomUUID(), profileId, justes + VIES, justes, depuis + i * 60_000, depuis + i * 60_000 + 30_000, JSON.stringify(adversaire))
    }
  })
}

test('l’onglet du classement : sa place, ses deux voisins, et les places que la semaine lui a fait gagner — ou perdre', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐸')
    const neo = await inscrireProfil(banc.url, 'neo', 'Néo', '🐼')
    const [deLea, deTom, deZoe, deNeo] = ['lea', 'tom', 'zoe', 'neo'].map(l => idDe(banc, l))
    // La semaine passée : Tom en tête, puis Zoé, puis Léa, qui a perdu son premier duel.
    const semainePassee = horloge.t - 5 * JOUR_MS
    duelsJoues(banc, deTom, 3, 12, 8, semainePassee)
    duelsJoues(banc, deZoe, 1, 12, 8, semainePassee)
    duelsJoues(banc, deLea, 1, 5, 8, semainePassee)
    // Cette semaine, Léa gagne quatre fois et passe devant tout le monde ; Néo joue son tout premier duel, et le perd.
    duelsJoues(banc, deLea, 4, 12, 8, horloge.t - 3_600_000)
    duelsJoues(banc, deNeo, 1, 5, 8, horloge.t - 2 * 3_600_000)

    const pourLea = (await lire(banc, lea, '/api/duels')).corps.classement
    assert.deepEqual(
      pourLea.lignes.map((l: any) => [l.nom, l.rang]),
      [
        ['Léa', 1],
        ['Tom', 2],
        ['Zoé', 3],
        ['Néo', 4],
      ],
    )
    assert.deepEqual(
      pourLea.autour.map((l: any) => l.nom),
      ['Léa', 'Tom'],
      'en tête, personne devant : elle et celui qui la suit',
    )
    assert.equal(pourLea.progression, 2, 'troisième lundi, première aujourd’hui')
    // Tom, doublé : un rang de perdu — ses deux voisins autour de lui.
    const pourTom = (await lire(banc, tom, '/api/duels')).corps.classement
    assert.deepEqual(
      pourTom.autour.map((l: any) => l.nom),
      ['Léa', 'Tom', 'Zoé'],
    )
    assert.equal(pourTom.progression, -1)
    // Néo n'était pas classé avant cette semaine : rien qu'on puisse dire, et il ne comptait devant personne.
    const pourNeo = (await lire(banc, neo, '/api/duels')).corps.classement
    assert.equal(pourNeo.progression, undefined)
    assert.deepEqual(
      pourNeo.autour.map((l: any) => l.nom),
      ['Zoé', 'Néo'],
      'dernier : celui qui le précède, et lui',
    )
    // Zoé n'a pas joué : Léa l'a doublée.
    assert.equal((await lire(banc, zoe, '/api/duels')).corps.classement.progression, -1)
  } finally {
    await banc.close()
  }
})

// Les souhaits du propriétaire du 13 octobre 2026 pour l'onglet du
// classement : les places gagnées ou perdues depuis lundi sur chaque ligne,
// comme un tableau sportif ; et « À ta portée » — les joueurs juste au-dessus
// de lui, ce qu'il gagnerait à les battre, « Défier » : on regardait le
// classement sans rien pouvoir en faire.
test('chaque ligne dit ses places depuis lundi ; « À ta portée » : les joueurs juste au-dessus de sa cote, le plus proche d’abord — en tête, ceux qui le talonnent', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐸')
    const neo = await inscrireProfil(banc.url, 'neo', 'Néo', '🐼')
    const max = await inscrireProfil(banc.url, 'max', 'Max', '🦉')
    const [deLea, deTom, deZoe, deNeo] = ['lea', 'tom', 'zoe', 'neo'].map(l => idDe(banc, l))
    const semainePassee = horloge.t - 5 * JOUR_MS
    duelsJoues(banc, deTom, 3, 12, 8, semainePassee)
    duelsJoues(banc, deZoe, 1, 12, 8, semainePassee)
    duelsJoues(banc, deLea, 1, 5, 8, semainePassee)
    duelsJoues(banc, deLea, 4, 12, 8, horloge.t - 3_600_000)
    duelsJoues(banc, deNeo, 1, 5, 8, horloge.t - 2 * 3_600_000)

    // Chaque ligne, ses places depuis lundi : Léa en a gagné deux, Tom et Zoé une de perdue, Néo n'était pas classé.
    const pourLea = (await lire(banc, lea, '/api/duels')).corps.classement
    assert.deepEqual(
      pourLea.lignes.map((l: any) => [l.nom, l.progression]),
      [
        ['Léa', 2],
        ['Tom', -1],
        ['Zoé', -1],
        ['Néo', undefined],
      ],
    )
    // En tête, personne au-dessus : ceux qui la talonnent, le plus proche d'abord.
    assert.deepEqual(
      pourLea.aPortee.map((l: any) => l.nom),
      ['Tom', 'Zoé', 'Néo'],
    )
    assert.equal(pourLea.enTete, true)
    // Tom, deuxième : Léa seule au-dessus de lui.
    const pourTom = (await lire(banc, tom, '/api/duels')).corps.classement
    assert.deepEqual(
      pourTom.aPortee.map((l: any) => [l.nom, l.rang]),
      [['Léa', 1]],
    )
    assert.equal(pourTom.enTete, undefined)
    // Néo, dernier : les trois juste au-dessus, le plus proche d'abord.
    assert.deepEqual(
      (await lire(banc, neo, '/api/duels')).corps.classement.aPortee.map((l: any) => l.nom),
      ['Zoé', 'Tom', 'Léa'],
    )
    // Max n'a jamais joué : ceux juste au-dessus de sa cote de départ — pas Néo, descendu sous elle —, et il n'est en tête de rien.
    const pourMax = (await lire(banc, max, '/api/duels')).corps.classement
    assert.equal(pourMax.sienne, undefined)
    assert.deepEqual(
      pourMax.aPortee.map((l: any) => l.nom),
      ['Zoé', 'Tom', 'Léa'],
    )
    assert.equal(pourMax.enTete, undefined)
    // Masquée, Zoé n'est plus à la portée de personne.
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/jour/masquer', { profileId: deZoe, masque: true }, admin)).status, 200)
    assert.deepEqual(
      (await lire(banc, neo, '/api/duels')).corps.classement.aPortee.map((l: any) => l.nom),
      ['Tom', 'Léa'],
    )
  } finally {
    await banc.close()
  }
})
