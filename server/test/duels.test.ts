// Les duels classés (le souhait du propriétaire du 11 octobre 2026 : « Défier
// un joueur » hors de la campagne, une tuile de l'accueil sous le quiz du
// jour, « un classement ELO et des récompenses par semaine avec des ligues »).
// Un duel classé est une rencontre : la série finie d'un autre, rejouée contre
// son score. La cote se relit dans le journal des rencontres ; seule celle de
// qui joue bouge ; ses ligues paient chaque lundi, dès trois duels.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { VIES, semaineDe } from '../../shared/campagne'
import { jourDe } from '../../shared/jour'
import {
  COTE_DE_DEPART,
  DUELS_DE_PLACEMENT,
  DUELS_POUR_LA_RECOMPENSE,
  LIGUES,
  chancesDeGagner,
  confettisDesLigues,
  coteDuScore,
  ecartDuDuel,
  enjeuDuDuel,
  ligueDe,
  niveauDeLaCote,
  niveauPourLeDuel,
  recompenseDeLaSemaine,
  releverLesDuels,
  type DuelJoue,
} from '../../shared/duels'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

// Un mardi : la semaine a de quoi se jouer avant son lundi.
const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const JOUR_MS = 24 * 3_600_000
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })
const semaineDeLInstant = (t: number) => semaineDe(jourDe(t))

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function questions(banc: Banc, serie: string): { bonne: number; reponses: string[] }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)
  } finally {
    db.close()
  }
}

async function repondre(banc: Banc, cookie: string, serie: string, index: number, juste: boolean) {
  const q = questions(banc, serie)[index]
  const r = await poster(banc, cookie, `/api/campagne/serie/${serie}/reponse`, { index, choix: juste ? q.bonne : (q.bonne + 1) % q.reponses.length })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}

/** Une série jouée jusqu'à sa dernière vie : `justes` bonnes réponses, puis trois fautes — de quoi servir d'adversaire. */
async function serieFinie(banc: Banc, cookie: string, justes: number) {
  const s = (await poster(banc, cookie, '/api/campagne/serie')).corps
  for (let i = 0; i < justes; i++) await repondre(banc, cookie, s.id, i, true)
  for (let i = justes; i < justes + VIES; i++) await repondre(banc, cookie, s.id, i, false)
}

/** Un duel classé joué jusqu'au bout : `justes` bonnes réponses, puis trois fautes. Rend son départ et sa dernière réponse. */
async function duelJoue(banc: Banc, cookie: string, justes: number) {
  const depart = await poster(banc, cookie, '/api/campagne/rencontre')
  assert.equal(depart.status, 200, depart.corps.error)
  const id = depart.corps.serie.id as string
  let fin: any = null
  for (let i = 0; i < justes; i++) fin = await repondre(banc, cookie, id, i, true)
  for (let i = justes; i < justes + VIES; i++) fin = await repondre(banc, cookie, id, i, false)
  assert.equal(fin.finie, true)
  return { depart: depart.corps, fin }
}

test('la cote : un score à battre a sa cote, une victoire contre plus fort rapporte plus, les dix premiers duels comptent double', () => {
  assert.equal(coteDuScore(8), COTE_DE_DEPART, 'huit bonnes réponses : la cote de départ')
  assert.equal(coteDuScore(10), 1100, 'deux de mieux : une ligue de plus')
  assert.equal(niveauDeLaCote(1100), 10)
  assert.equal(chancesDeGagner(1000, 1000), 0.5)
  assert.ok(Math.abs(chancesDeGagner(1000, 1200) - 0.24) < 0.01)
  // Le placement : les dix premiers duels comptent double.
  assert.deepEqual(enjeuDuDuel(1000, 8, 0), { cote: 1000, gagne: 24, egalite: 0, perdu: -24 })
  assert.deepEqual(enjeuDuDuel(1000, 8, DUELS_DE_PLACEMENT), { cote: 1000, gagne: 12, egalite: 0, perdu: -12 })
  // Battre un gros score rapporte plus ; perdre contre un petit coûte plus.
  assert.ok(ecartDuDuel(1000, 12, 20, 1) > ecartDuDuel(1000, 8, 20, 1))
  assert.ok(ecartDuDuel(1000, 4, 20, 0) < ecartDuDuel(1000, 8, 20, 0))
  // Placé, on lui cherche des adversaires de sa cote ; avant, de ses séries.
  assert.equal(niveauPourLeDuel(3, 1300, 9), 9)
  assert.equal(niveauPourLeDuel(DUELS_DE_PLACEMENT, 1300, 9), 14)
  // Les ligues : une tous les cent points, la bronze sans plancher.
  assert.deepEqual(
    [700, 1099, 1100, 1250, 1499, 1500, 2000].map(c => ligueDe(c).cle),
    ['bronze', 'bronze', 'argent', 'or', 'diamant', 'maitre', 'maitre'],
  )
  assert.deepEqual(
    LIGUES.map(l => l.confettis),
    [10, 20, 30, 40, 50, 60],
    'dix confettis de plus à chaque ligue — un choix de produit',
  )
})

test('le relevé des duels rejoue la cote dans l’ordre, et chaque semaine paie sa meilleure ligue — celle du lundi comprise —, dès trois duels', () => {
  const lundi = Date.UTC(2026, 9, 5, 10, 0)
  const duel = (serie: string, justes: number, sesJustes: number, finiLe: number): DuelJoue => ({ serie, justes, sesJustes, finiLe })
  // Donnés dans le désordre : l'ordre se relit à leur fin.
  const r = releverLesDuels([duel('c', 10, 8, lundi + 3 * 3_600_000), duel('a', 10, 8, lundi), duel('b', 9, 8, lundi + 3_600_000)], semaineDeLInstant)
  assert.equal(r.joues, 3)
  assert.equal(r.ecarts.get('a')!.avant, COTE_DE_DEPART)
  const somme = [...r.ecarts.values()].reduce((n, e) => n + e.ecart, 0)
  assert.equal(r.cote, COTE_DE_DEPART + somme, 'la cote est la somme de ses écarts, au point près')
  assert.ok(r.ecarts.get('b')!.avant === COTE_DE_DEPART + r.ecarts.get('a')!.ecart)
  const semaine = semaineDeLInstant(lundi)
  assert.deepEqual(r.semaines.get(semaine), { duels: 3, meilleure: r.cote })
  // Close, la semaine paie sa meilleure ligue ; en cours, pas encore.
  assert.equal(confettisDesLigues(r, semaine), 0, 'la semaine qui se joue ne paie qu’au lundi')
  const suivante = semaineDeLInstant(lundi + 7 * JOUR_MS)
  assert.equal(confettisDesLigues(r, suivante), ligueDe(r.cote).confettis)
  // Deux duels ne suffisent pas.
  assert.equal(recompenseDeLaSemaine({ duels: DUELS_POUR_LA_RECOMPENSE - 1, meilleure: 1600 }), 0)
  // Un duel perdu ne reprend pas la ligue qu'il avait en entrant dans la semaine.
  const haut = releverLesDuels(
    [
      // La semaine d'avant, il bat douze gros scores : il entre dans celle-ci chez les maîtres…
      ...Array.from({ length: 12 }, (_, i) => duel(`h${i}`, 30, 25, lundi - 7 * JOUR_MS + i * 60_000)),
      // … puis perd trois fois contre un score d'une bonne réponse : il redescend.
      ...Array.from({ length: 3 }, (_, i) => duel(`p${i}`, 0, 1, lundi + i * 60_000)),
    ],
    semaineDeLInstant,
  )
  const cetteSemaine = haut.semaines.get(semaine)!
  assert.deepEqual([ligueDe(cetteSemaine.meilleure).cle, ligueDe(haut.cote).cle], ['maitre', 'diamant'], 'il a perdu une ligue en route')
  assert.equal(recompenseDeLaSemaine(cetteSemaine), 60, 'sa semaine paie la ligue avec laquelle il y est entré')
})

test('un duel classé dit son enjeu avant de jouer, sa cote à la fin — et ne bouge que celle de qui joue', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    // Tom finit une série de huit : le score à battre, à la cote de départ.
    await serieFinie(banc, tom, 8)
    horloge.t += 60_000

    // Avant son premier duel : la cote de départ, en bronze, rien dans la semaine.
    const avant = (await lire(banc, lea, '/api/duels')).corps
    assert.deepEqual([avant.cote, avant.ligue, avant.joues, avant.semaine.duels, avant.semaine.confettis], [COTE_DE_DEPART, 'bronze', 0, 0, 0])
    assert.equal(avant.classement.joueurs, 0, 'personne n’a encore joué de duel')
    assert.equal(avant.enCours, null)

    const { depart, fin } = await duelJoue(banc, lea, 9)
    assert.deepEqual(depart.enjeu, { cote: COTE_DE_DEPART, gagne: 24, egalite: 0, perdu: -24 }, 'ce que le duel met en jeu, dit avant de jouer')
    assert.equal(fin.rencontre.issue, 'gagnee')
    assert.deepEqual(
      { ...fin.duel, semaine: { ...fin.duel.semaine, minutesRestantes: undefined } },
      { avant: 1000, apres: 1024, ecart: 24, ligueAvant: 'bronze', ligue: 'bronze', semaine: { duels: 1, ligue: 'bronze', confettis: 0, minutesRestantes: undefined } },
      'sa fin dit sa cote, sa ligue et sa semaine',
    )

    const apres = (await lire(banc, lea, '/api/duels')).corps
    assert.deepEqual([apres.cote, apres.joues, apres.semaine.duels], [1024, 1, 1])
    assert.deepEqual(
      apres.dernieres.map((r: any) => [r.adversaire.nom, r.justes, r.issue, r.ecart]),
      [['Tom', 9, 'gagnee', 24]],
      'chaque duel dit ce qu’il a fait à sa cote',
    )
    assert.deepEqual(
      apres.classement.lignes.map((l: any) => [l.nom, l.cote, l.ligue, l.rang, l.duels]),
      [['Léa', 1024, 'bronze', 1, 1]],
    )
    assert.equal(apres.classement.sienne, apres.classement.lignes[0].profileId)
    // L'adversaire n'était pas là : sa cote n'a pas bougé, et il n'est pas classé.
    const deTom = (await lire(banc, tom, '/api/duels')).corps
    assert.deepEqual([deTom.cote, deTom.joues], [COTE_DE_DEPART, 0])
    // Classée, sa carte s'ouvre à qui la touche au classement — sa ligue et sa cote dessus.
    const idLea = apres.classement.lignes[0].profileId as string
    const carte = await lire(banc, tom, `/api/joueur/carte/${idLea}`)
    assert.equal(carte.status, 200)
    assert.deepEqual(carte.corps.profil.duels, { ligue: 'bronze', cote: 1024 })
    // Sans duel classé, rien : l'absence, pas une ligue de bronze.
    assert.equal((await lire(banc, tom, '/api/joueur/carte')).corps.profil.duels, undefined)

    // Un défi entre amis se joue pour le plaisir : il ne change pas sa cote.
    const lance = await poster(banc, lea, '/api/campagne/duel', { categories: [] })
    assert.equal(lance.status, 200, lance.corps.error)
    const tentative = lance.corps.serie.id as string
    for (let i = 0; i < 12; i++) await repondre(banc, lea, tentative, i, true)
    for (let i = 12; i < 12 + VIES; i++) await repondre(banc, lea, tentative, i, false)
    assert.equal((await lire(banc, lea, '/api/duels')).corps.cote, 1024, 'amical : la cote ne bouge pas')
  } finally {
    await banc.close()
  }
})

test('les ligues paient chaque lundi, dans le solde de confettis : dès trois duels dans la semaine, la meilleure ligue de la semaine', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    for (let i = 0; i < DUELS_POUR_LA_RECOMPENSE; i++) await serieFinie(banc, tom, 8)
    horloge.t += 60_000
    const solde = async () => (await lire(banc, lea, '/api/joueur/moi?accueil')).corps.profile.boutique.confettis.solde as number

    // Deux duels : la semaine n'a pas encore sa récompense.
    await duelJoue(banc, lea, 9)
    const deux = await duelJoue(banc, lea, 9)
    assert.deepEqual([deux.fin.duel.semaine.duels, deux.fin.duel.semaine.confettis], [2, 0])
    const accueil = (await lire(banc, lea, '/api/joueur/moi?accueil')).corps.profile.duels
    assert.deepEqual([accueil.ligue, accueil.joues, accueil.semaine.duels], ['bronze', 2, 2], 'l’accueil dit sa ligue et sa semaine')
    // Le troisième l'ouvre : la ligue de bronze, dix confettis — lundi.
    const trois = await duelJoue(banc, lea, 9)
    assert.deepEqual([trois.fin.duel.semaine.duels, trois.fin.duel.semaine.confettis], [3, 10])
    const avantLundi = await solde()

    // Lundi, la semaine est close : elle paie, et la page le dit.
    horloge.t += 7 * JOUR_MS
    assert.equal(await solde(), avantLundi + 10, 'dix confettis de plus, ceux de la ligue de bronze')
    const etat = (await lire(banc, lea, '/api/duels')).corps
    assert.deepEqual(etat.semainePassee, { ligue: 'bronze', duels: 3, confettis: 10 })
    assert.deepEqual([etat.semaine.duels, etat.semaine.confettis], [0, 0], 'la nouvelle semaine repart de zéro')
  } finally {
    await banc.close()
  }
})

test('le classement des duels : rang partagé, les masqués écartés, ceux qui n’ont pas joué depuis quatre semaines aussi', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    const max = await inscrireProfil(banc.url, 'max', 'Max', '🐯')
    for (let i = 0; i < 4; i++) await serieFinie(banc, max, 8)
    horloge.t += 60_000
    // Léa et Tom gagnent leur duel pareil — ex æquo —, Zoé perd le sien.
    await duelJoue(banc, lea, 9)
    await duelJoue(banc, tom, 9)
    await duelJoue(banc, zoe, 2)
    const classement = (await lire(banc, zoe, '/api/duels')).corps.classement
    assert.deepEqual(
      classement.lignes.map((l: any) => [l.nom, l.cote, l.rang]),
      [
        ['Léa', 1024, 1],
        ['Tom', 1024, 1],
        ['Zoé', 976, 3],
      ],
      'deux premiers ex æquo, puis une troisième (invariant 15)',
    )
    // Masqué au quiz du jour, Tom n'y paraît plus — sauf pour lui-même.
    const admin = await connexionAnimateur(banc.url)
    const idTom = (await lire(banc, tom, '/api/joueur/moi')).corps.profile.id
    assert.equal((await poster(banc, admin, '/api/admin/jour/masquer', { profileId: idTom, masque: true })).status, 200)
    assert.deepEqual(
      (await lire(banc, lea, '/api/duels')).corps.classement.lignes.map((l: any) => l.nom),
      ['Léa', 'Zoé'],
    )
    assert.ok((await lire(banc, tom, '/api/duels')).corps.classement.lignes.some((l: any) => l.nom === 'Tom'))
    // Quatre semaines sans duel : il sort du classement — sa cote, il la garde.
    horloge.t += 29 * JOUR_MS
    await duelJoue(banc, zoe, 9)
    const tard = (await lire(banc, lea, '/api/duels')).corps
    assert.deepEqual(
      tard.classement.lignes.map((l: any) => l.nom),
      ['Zoé'],
    )
    assert.equal(tard.cote, 1024, 'sa cote reste à lui')
  } finally {
    await banc.close()
  }
})
