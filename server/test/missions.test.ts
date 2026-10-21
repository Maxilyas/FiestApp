// Les missions du jour et le coffre de la semaine (le plan d'action validé
// avec le propriétaire le 14 octobre 2026 : « le manque d'objectif à court
// terme ») : trois missions tirées à la première visite du jour, jugées sur
// les journaux de chaque mode, ce qui est fait retenu une fois — quinze
// confettis et vingt-cinq points chacune, autant pour les trois et un
// tampon —, et le lundi, le coffre de la semaine, tiré une fois.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import {
  activiteDesJours,
  AUCUNE_ACTIVITE,
  avancement,
  DECOUVERTES,
  lundiDe,
  resteAGagner,
  tirerLesMissions,
  type ContexteDuTirage,
  type Mission,
} from '../../shared/missions'
import { rangDuCoffre } from '../../shared/coffre'
import { jourDe } from '../../shared/jour'
import { tirerLeCoffre } from '../../shared/tresor'
import { coffresEnAttente, faitesARetenir, LectureEnRoute, Missions, type DepsDesMissions } from '../src/core/missions'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

const CONTEXTE: ContexteDuTirage = { quizDuJourJoue: false, joursDuJour: 0, decouvertesJouees: new Set(), defiFini: false, aRevoir: 0, hier: [] }

// ── Le tirage, pur ─────────────────────────────────────────────────────────

test('trois missions par jour : une habitude, un savoir, une découverte — les mêmes pour la même graine', () => {
  for (let i = 0; i < 200; i++) {
    const graine = `profil-${i}|2026-10-15`
    const m = tirerLesMissions(graine, CONTEXTE)
    assert.deepEqual(m, tirerLesMissions(graine, CONTEXTE), 'deux lectures ensemble tirent les mêmes')
    assert.equal(m.length, 3)
    assert.ok(['jour', 'jour-etoiles'].includes(m[0].sorte), m[0].sorte)
    assert.ok(['justes', 'categorie'].includes(m[1].sorte), m[1].sorte)
    assert.ok(DECOUVERTES.includes(m[2].sorte), m[2].sorte)
    if (m[1].sorte === 'categorie') assert.ok((CATEGORIES as readonly string[]).includes(m[1].categorie!))
    // Sans carnet à revoir ni habitude du quiz du jour : ni révision, ni étoiles.
    assert.notEqual(m[2].sorte, 'revision')
    assert.equal(m[0].sorte, 'jour')
  }
})

test('le tirage tient compte de ce qu’il a fait : le défi fini, le quiz du jour déjà joué, la découverte d’hier', () => {
  const tirages = (c: Partial<ContexteDuTirage>) => Array.from({ length: 300 }, (_, i) => tirerLesMissions(`p${i}|2026-10-15`, { ...CONTEXTE, ...c }))
  assert.ok(tirages({ defiFini: true }).every(m => m[2].sorte !== 'defi'), 'le défi ne se relève pas deux fois')
  assert.ok(tirages({}).some(m => m[2].sorte === 'defi'))
  // Le quiz du jour déjà joué : l'habitude ne vise plus des étoiles qu'il a peut-être manquées.
  assert.ok(tirages({ quizDuJourJoue: true, joursDuJour: 7 }).every(m => m[0].sorte === 'jour'))
  assert.ok(tirages({ joursDuJour: 7 }).some(m => m[0].sorte === 'jour-etoiles' && m[0].cible === 2))
  // La découverte d'hier ne revient pas le lendemain.
  assert.ok(tirages({ hier: [{ sorte: 'jour', cible: 1 }, { sorte: 'justes', cible: 10 }, { sorte: 'duel', cible: 1 }] }).every(m => m[2].sorte !== 'duel'))
  // Un carnet à revoir propose la révision, au plus cinq questions.
  const revisions = tirages({ aRevoir: 12 }).filter(m => m[2].sorte === 'revision')
  assert.ok(revisions.length > 0)
  assert.ok(revisions.every(m => m[2].cible === 5))
  // Ce qu'il ne joue jamais passe trois fois plus souvent que ce qu'il joue.
  const joue = new Set(DECOUVERTES.filter(s => s !== 'sentier'))
  const sentiers = tirages({ decouvertesJouees: joue }).filter(m => m[2].sorte === 'sentier').length
  assert.ok(sentiers > 300 / 5, `${sentiers} épreuves sur 300`)
})

test('ce que chaque mission lit de sa journée', () => {
  const jour = '2026-10-15'
  const midi = Date.UTC(2026, 9, 15, 10)
  const activites = activiteDesJours({
    jour: [{ jour, finie: true, justes: 8, questions: 10 }],
    jourParCategorie: [{ jour, categorie: 'Histoire', n: 3 }],
    series: [
      { id: 's1', mode: 'serie', issue: null, finieLe: midi },
      { id: 'd1', mode: 'rencontre', issue: null, finieLe: midi },
      { id: 'e1', mode: 'sentier', issue: 'ratee', finieLe: midi },
      { id: 'e2', mode: 'sentier', issue: null, finieLe: midi },
      { id: 'p1', mode: 'sujet', issue: 'validee', finieLe: midi },
    ],
    reponses: [
      ...Array.from({ length: 6 }, (_, i) => ({ serie: 's1', mode: 'serie', juste: i !== 3, le: midi + i, categorie: 'Histoire' })),
      { serie: 'r1', mode: 'revision', juste: false, le: midi, categorie: 'Sport' },
      { serie: 'r1', mode: 'revision', juste: true, le: midi + 1, categorie: 'Sport' },
    ],
    soirees: [{ le: midi, confettis: 4 }],
  })
  const a = activites.get(jour)!
  const m = (sorte: Mission['sorte'], cible = 1, categorie?: string): Mission => ({ sorte, cible, ...(categorie && { categorie }) })
  assert.equal(avancement(m('jour'), a), 1)
  assert.equal(avancement(m('jour-etoiles', 2), a), 2, 'huit sur dix : deux étoiles')
  // Le quiz du jour (8), la campagne (5 + 1 révision), une soirée (4).
  assert.equal(avancement(m('justes', 30), a), 18)
  // Le carnet ne dit rien de son savoir : sa bonne réponse en Sport n'y compte pas.
  assert.equal(avancement(m('categorie', 10, 'Histoire'), a), 8)
  assert.equal(avancement(m('categorie', 10, 'Sport'), a), 0)
  assert.equal(avancement(m('serie', 7), a), 5, 'cinq bonnes réponses dans la même série')
  assert.equal(avancement(m('duel'), a), 1)
  assert.equal(avancement(m('sentier', 3), a), 1, 'une épreuve sans issue n’a pas été jouée')
  assert.equal(avancement(m('parcours'), a), 1)
  assert.equal(avancement(m('revision', 5), a), 2)
  assert.equal(avancement(m('defi'), a), 0)
  assert.equal(avancement(m('jour'), AUCUNE_ACTIVITE), 0)
})

test('ce qui est fait se retient une fois, la ligne des trois avec les trois ; un jour passé se date à son dernier instant', () => {
  const lignes = (jour: string, faites: (number | null)[]) => [
    ...([{ sorte: 'jour', cible: 1 }, { sorte: 'justes', cible: 5 }, { sorte: 'duel', cible: 1 }] as Mission[]).map((mission, rang) => ({ jour, rang, mission, faiteLe: faites[rang] })),
    { jour, rang: 3, mission: null, faiteLe: faites[3] },
  ]
  const fait: ReturnType<typeof activiteDesJours> = new Map([
    ['2026-10-14', { ...AUCUNE_ACTIVITE, quizDuJour: { finie: true, justes: 6, questions: 10 }, justes: 6, duels: 1 }],
    ['2026-10-15', { ...AUCUNE_ACTIVITE, justes: 2 }],
  ])
  const maintenant = Date.UTC(2026, 9, 15, 9)
  const a = faitesARetenir([...lignes('2026-10-14', [null, null, 1, null]), ...lignes('2026-10-15', [null, null, null, null])], fait, '2026-10-15', maintenant)
  // La veille : le quiz du jour, ses bonnes réponses, et les trois — le duel l'était déjà.
  assert.deepEqual(
    a.map(f => `${f.jour}#${f.rang}`),
    ['2026-10-14#0', '2026-10-14#1', '2026-10-14#3'],
  )
  // Minuit à Paris, le 15 octobre 2026 (heure d'été) : 22 h en temps universel la veille.
  assert.ok(a.every(f => f.quand === Date.UTC(2026, 9, 14, 22) - 1))
  // Aujourd'hui, rien de fait : deux bonnes réponses sur cinq.
  assert.equal(resteAGagner({ missions: [], trois: false }).confettis, 15)
})

test('les coffres qui attendent : une semaine passée qui a des tampons, pas encore ouverte, à son rang', () => {
  assert.equal(rangDuCoffre(0), null)
  assert.equal(rangDuCoffre(1), 'bois')
  assert.equal(rangDuCoffre(4), 'argent')
  assert.equal(rangDuCoffre(6), 'or')
  assert.equal(rangDuCoffre(7), 'royal')
  const jours = ['2026-10-05', '2026-10-07', '2026-10-08', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']
  assert.equal(lundiDe('2026-10-18'), '2026-10-12', 'un dimanche est encore de sa semaine')
  assert.deepEqual(coffresEnAttente(jours, new Set()), [
    { semaine: '2026-10-05', tampons: 3, rang: 'argent' },
    { semaine: '2026-10-12', tampons: 7, rang: 'royal' },
  ])
  assert.deepEqual(coffresEnAttente(jours, new Set(['2026-10-05'])), [{ semaine: '2026-10-12', tampons: 7, rang: 'royal' }])
})

test('le coffre ne donne jamais ce qu’on a déjà, et descend d’un cran quand une rareté est épuisée', () => {
  const jour = '2026-10-15'
  const hasards = (...xs: number[]) => () => xs.shift() ?? 0
  // Royal, tiré tout en haut : un légendaire.
  const haut = tirerLeCoffre('royal', { possede: () => false, hasard: hasards(0.999, 0), jour })
  assert.equal(haut.rarete, 'legendaire')
  // Tout le légendaire à lui : l'épique.
  const sansLegendaire = tirerLeCoffre('royal', {
    possede: o => o.sorte === 'compagnon' || (o.sorte === 'fond' && ['dragon', 'cite-celeste'].includes(o.cle)) || o.sorte === 'theme' || (o.sorte === 'gerbe' && o.cle === 'tresor'),
    hasard: hasards(0.999, 0),
    jour,
  })
  assert.equal(sansLegendaire.rarete, 'epique')
  assert.notEqual(sansLegendaire.objet.sorte, 'theme')
  // Il a tout : des confettis, au rang du coffre.
  assert.deepEqual(tirerLeCoffre('or', { possede: () => true, hasard: hasards(0.5, 0.5), jour }), { objet: { sorte: 'confettis', confettis: 120 }, rarete: 'commune' })
  // Le coffre de bois ne donne jamais de légendaire.
  for (let i = 0; i < 100; i++) assert.notEqual(tirerLeCoffre('bois', { possede: () => false, hasard: hasards(i / 100, 0.5), jour }).rarete, 'legendaire')
})

test('une lecture restée en route ne retient plus les suivantes du profil : elle échoue en disant son étape, la suivante passe', async () => {
  // Le 15 octobre 2026, en production : une lecture des missions du
  // propriétaire n'a jamais rendu la main, et toutes les suivantes — une par
  // page — l'attendaient (`unALaFois`) : sa route « charge sans fin », sa ligne
  // restait vide, sans une erreur au journal, jusqu'au redémarrage.
  const jour = '2026-10-15'
  const lignes = [
    { jour, rang: 0, mission: { sorte: 'serie', cible: 3 } as Mission, faiteLe: null },
    { jour, rang: 1, mission: { sorte: 'justes', cible: 4 } as Mission, faiteLe: null },
    { jour, rang: 2, mission: { sorte: 'categorie', cible: 2, categorie: 'Histoire' } as Mission, faiteLe: null },
    { jour, rang: 3, mission: null, faiteLe: null },
  ]
  let lectures = 0
  const missions = new Missions({
    profiles: {
      // La première ne revient jamais ; les suivantes, tout de suite.
      lignesDesMissions: () => (++lectures === 1 ? new Promise(() => {}) : Promise.resolve(lignes)),
      accomplirDesMissions: async () => [],
      joursAuxTrois: async () => [],
      semainesDesCoffres: async () => new Set<string>(),
      soireesDepuis: async () => [],
    } as unknown as DepsDesMissions['profiles'],
    jour: { activiteDepuis: async () => ({ jour: [], jourParCategorie: [] }), coffresDuMois: async () => [] },
    campagne: { activiteDepuis: async () => ({ series: [], reponses: [] }), aRevoirDe: async () => 0 },
    maintenant: () => Date.UTC(2026, 9, 15, 8),
    dureeMaxMs: 150,
  })
  const enRoute = missions.duJour('lea')
  const suivante = missions.duJour('lea')
  await assert.rejects(enRoute, (e: unknown) => e instanceof LectureEnRoute && e.message.includes('« ses journaux »'))
  const lue = await suivante
  assert.equal(lue.jour, jour)
  assert.equal(lue.missions.length, 3, 'la suivante a lu, sans attendre celle restée en route')
  // Et une lecture ordinaire n'est pas coupée.
  assert.equal((await missions.duJour('lea')).missions.length, 3)
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

/** Une base d'essai : douze questions de chacune des douze catégories, de toutes les difficultés. */
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

/** Joue une série jusqu'au bout : `justes` bonnes réponses d'abord, puis des fautes jusqu'à la dernière vie. */
async function jouerSerie(banc: Banc, cookie: string, justes: number, categories: string[]) {
  const serie = (await poster(banc, cookie, '/api/campagne/serie', { categories })).corps
  assert.ok(serie.id, serie.error)
  const questions = base(banc, db =>
    JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie.id) as { questions: string }).questions),
  ) as { bonne: number; reponses: string[] }[]
  let fin: any = null
  for (let i = 0; !fin?.finie; i++) {
    const q = questions[i]
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: i < justes ? q.bonne : (q.bonne + 1) % q.reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    fin = r.corps
  }
}

test('trois missions faites en une série : chacune paie, les trois aussi, une seule fois — puis le lundi, le coffre', async () => {
  // Le jeudi 15 octobre 2026, à 10 h à Paris.
  let maintenant = Date.UTC(2026, 9, 15, 8)
  const banc = await demarrer({ horlogeDuJour: () => maintenant, baseDeLaCampagne: BASE, hasardDuCoffre: () => 0 })
  try {
    const cookie = await inscrireProfil(banc.url, 'missions', 'Léa')
    assert.equal((await lire(banc, '', '/api/joueur/missions')).status, 401, 'un invité n’a pas de missions')
    const { profile } = (await lire(banc, cookie, '/api/joueur/moi')).corps
    // Ses missions du jour, posées d'avance : le tirage, lui, dépend de son identifiant.
    const missions: Mission[] = [
      { sorte: 'serie', cible: 3 },
      { sorte: 'justes', cible: 4 },
      { sorte: 'categorie', cible: 2, categorie: 'Histoire' },
    ]
    base(banc, db => {
      const inserer = db.prepare('INSERT INTO profile_missions (profile_id, jour, rang, mission, tiree_le) VALUES (?, ?, ?, ?, ?)')
      missions.forEach((m, rang) => inserer.run(profile.id, '2026-10-15', rang, JSON.stringify(m), maintenant))
      inserer.run(profile.id, '2026-10-15', 3, '{}', maintenant)
    })
    const avant = (await lire(banc, cookie, '/api/joueur/missions')).corps
    assert.equal(avant.jour, '2026-10-15')
    assert.deepEqual(
      avant.missions.map((m: any) => [m.titre, m.avance, m.faite]),
      [
        ['Enchaîne 3 bonnes réponses dans une série', 0, false],
        ['Trouve 4 bonnes réponses', 0, false],
        ['Trouve 2 bonnes réponses en Histoire', 0, false],
      ],
    )
    assert.deepEqual(avant.nouvelles, [])
    assert.deepEqual(avant.semaine, { lundi: '2026-10-12', tampons: [false, false, false, false, false, false, false] })
    assert.deepEqual(avant.coffres, [])
    assert.deepEqual(resteAGagner(avant), { confettis: 60, xp: 100 })

    // Cinq bonnes réponses en Histoire, d'une seule série : les trois d'un coup.
    await jouerSerie(banc, cookie, 5, ['Histoire'])
    const apres = (await lire(banc, cookie, '/api/joueur/missions')).corps
    assert.ok(apres.missions.every((m: any) => m.faite && m.avance === m.cible))
    assert.equal(apres.trois, true)
    assert.deepEqual(apres.nouvelles, [0, 1, 2, 3], 'la fin de la partie les annonce')
    assert.deepEqual(apres.semaine.tampons, [false, false, false, true, false, false, false], 'le jeudi a son tampon')
    // Quinze confettis par mission, quinze pour les trois ; vingt-cinq points chacun, dans leur ligne à part.
    const xp = base(banc, db => db.prepare("SELECT xp FROM profile_xp WHERE profile_id = ? AND soiree_id = '#missions'").get(profile.id) as { xp: number })
    assert.equal(xp.xp, 100)
    const detail = (await lire(banc, cookie, '/api/joueur/moi')).corps.profile
    assert.equal(detail.boutique.confettis.gagnes, 5 + 60, 'cinq bonnes réponses, et les missions')

    // Relue, rien ne se retient deux fois.
    const encore = (await lire(banc, cookie, '/api/joueur/missions')).corps
    assert.deepEqual(encore.nouvelles, [])
    assert.equal((base(banc, db => db.prepare("SELECT xp FROM profile_xp WHERE profile_id = ? AND soiree_id = '#missions'").get(profile.id)) as { xp: number }).xp, 100)

    // Son coffre ne s'ouvre pas avant lundi.
    const tot = await poster(banc, cookie, '/api/joueur/coffre', { semaine: '2026-10-12' })
    assert.equal(tot.status, 400)
    assert.equal(tot.corps.error, 'Ce coffre s’ouvre lundi : d’ici là, remplis ta carte.')

    // Le lundi 19 : ses missions du jour sont neuves, et le coffre de bois attend.
    maintenant = Date.UTC(2026, 9, 19, 8)
    const lundi = (await lire(banc, cookie, '/api/joueur/missions')).corps
    assert.equal(lundi.jour, '2026-10-19')
    assert.equal(lundi.missions.length, 3)
    assert.ok(lundi.missions.every((m: any) => !m.faite))
    assert.deepEqual(lundi.coffres, [{ semaine: '2026-10-12', tampons: 1, rang: 'bois' }])
    assert.equal((await poster(banc, cookie, '/api/joueur/coffre', { semaine: '2026-10-05' })).status, 400, 'une semaine sans tampon n’a pas de coffre')
    assert.equal((await poster(banc, cookie, '/api/joueur/coffre', { semaine: 'mardi' })).status, 400)
    // Le hasard à zéro : la rareté commune, et son premier thème — le Cahier d'écolier, offert.
    const ouvert = await poster(banc, cookie, '/api/joueur/coffre', { semaine: '2026-10-12' })
    assert.equal(ouvert.status, 200, ouvert.corps.error)
    assert.deepEqual(
      { ...ouvert.corps.coffre, ouvertLe: 0 },
      {
        semaine: '2026-10-12',
        tampons: 1,
        rang: 'bois',
        rarete: 'commune',
        objet: { sorte: 'theme', cle: 'cahier' },
        nom: 'Cahier d’écolier',
        detail: 'Un thème de la boutique, offert : il habille toutes tes pages.',
        ouvertLe: 0,
      },
    )
    // Rouvert, il redonne ce qu'il a donné — le hasard ne se rejoue pas.
    assert.deepEqual((await poster(banc, cookie, '/api/joueur/coffre', { semaine: '2026-10-12' })).corps.coffre, ouvert.corps.coffre)
    assert.deepEqual((await lire(banc, cookie, '/api/joueur/missions')).corps.coffres, [])
    // Offert, le thème est à lui, sans rien coûter, et ne se vend plus.
    const boutique = (await lire(banc, cookie, '/api/joueur/moi')).corps.profile.boutique
    assert.ok(boutique.possedes.includes('cahier'))
    assert.equal(boutique.confettis.depenses, 0)
    assert.equal(base(banc, db => db.prepare("SELECT prix FROM profile_achats WHERE profile_id = ? AND theme = 'cahier'").get(profile.id) as { prix: number }).prix, 0)
  } finally {
    await banc.close()
  }
})

test('trois missions faites dimanche à 23 h 50, lues lundi : leur tampon, et le coffre qui attend, dans la même réponse', async () => {
  // Ses tampons se lisent avec ses journaux, avant que la lecture ne retienne
  // ce qui est fait (`duJour`) : un dimanche retenu lundi s'y ajoute — sans
  // quoi son coffre n'attendrait qu'à la lecture suivante.
  // Le dimanche 18 octobre 2026, à 23 h 50 à Paris (21 h 50 en temps universel, à l'heure d'été).
  let maintenant = Date.UTC(2026, 9, 18, 21, 50)
  const banc = await demarrer({ horlogeDuJour: () => maintenant, baseDeLaCampagne: BASE })
  try {
    const cookie = await inscrireProfil(banc.url, 'dimanche', 'Noé')
    const { profile } = (await lire(banc, cookie, '/api/joueur/moi?leger')).corps
    const missions: Mission[] = [
      { sorte: 'serie', cible: 3 },
      { sorte: 'justes', cible: 4 },
      { sorte: 'categorie', cible: 2, categorie: 'Histoire' },
    ]
    base(banc, db => {
      const inserer = db.prepare('INSERT INTO profile_missions (profile_id, jour, rang, mission, tiree_le) VALUES (?, ?, ?, ?, ?)')
      missions.forEach((m, rang) => inserer.run(profile.id, '2026-10-18', rang, JSON.stringify(m), maintenant))
      inserer.run(profile.id, '2026-10-18', 3, '{}', maintenant)
    })
    // Jouées dimanche soir, sans rouvrir l'accueil : rien n'est encore retenu.
    await jouerSerie(banc, cookie, 5, ['Histoire'])

    // Lundi 19, à 10 h : la première lecture tire ses missions du jour et retient celles de dimanche.
    maintenant = Date.UTC(2026, 9, 19, 8)
    const lundi = (await lire(banc, cookie, '/api/joueur/missions')).corps
    assert.equal(lundi.jour, '2026-10-19')
    assert.equal(lundi.missions.length, 3)
    assert.deepEqual(lundi.nouvelles, [], 'celles de dimanche ne s’annoncent pas comme celles du jour')
    assert.deepEqual(lundi.coffres, [{ semaine: '2026-10-12', tampons: 1, rang: 'bois' }], 'le coffre de la semaine passée attend déjà')
    // Retenues au dernier instant de dimanche : leur tampon est de la semaine passée.
    const faites = base(banc, db =>
      db.prepare("SELECT rang, faite_le FROM profile_missions WHERE profile_id = ? AND jour = '2026-10-18' ORDER BY rang").all(profile.id),
    ) as { rang: number; faite_le: number | null }[]
    assert.deepEqual(
      faites.map(f => [f.rang, f.faite_le === null ? null : jourDe(f.faite_le)]),
      [0, 1, 2, 3].map(rang => [rang, '2026-10-18']),
    )
    // Relue, la base le dit d'elle-même.
    assert.deepEqual((await lire(banc, cookie, '/api/joueur/missions')).corps.coffres, lundi.coffres)
  } finally {
    await banc.close()
  }
})

test('un fond ou une gerbe du trésor se porte dès qu’un coffre le donne, et pas avant', async () => {
  let maintenant = Date.UTC(2026, 9, 15, 8)
  // Le hasard tout en haut pour la rareté — la plus haute que le coffre permet —, puis tout en bas pour son premier objet.
  let tirages = 0
  const banc = await demarrer({ horlogeDuJour: () => maintenant, baseDeLaCampagne: BASE, hasardDuCoffre: () => (tirages++ % 2 === 0 ? 0.999 : 0) })
  try {
    const cookie = await inscrireProfil(banc.url, 'tresor', 'Tom')
    const { profile } = (await lire(banc, cookie, '/api/joueur/moi')).corps
    const avant = await ecrire(banc.url, '/api/joueur/moi', { fond: 'voie-lactee' }, cookie, 'PUT')
    assert.equal(avant.status, 400)
    assert.equal(((await avant.json()) as { error: string }).error, 'Ce fond se gagne d’abord : un coffre de la semaine')
    // Sept jours aux trois missions, la semaine du 12 : un coffre royal.
    base(banc, db => {
      const inserer = db.prepare('INSERT INTO profile_missions (profile_id, jour, rang, mission, tiree_le, faite_le) VALUES (?, ?, ?, ?, ?, ?)')
      for (let j = 12; j <= 18; j++) inserer.run(profile.id, `2026-10-${j}`, 3, '{}', maintenant, maintenant)
    })
    maintenant = Date.UTC(2026, 9, 19, 8)
    assert.deepEqual((await lire(banc, cookie, '/api/joueur/missions')).corps.coffres, [{ semaine: '2026-10-12', tampons: 7, rang: 'royal' }])
    const { coffre } = (await poster(banc, cookie, '/api/joueur/coffre', { semaine: '2026-10-12' })).corps
    // Royal, tout en haut : le légendaire, et le premier du trésor — le Dragon d'or.
    assert.equal(coffre.rang, 'royal')
    assert.equal(coffre.rarete, 'legendaire')
    assert.deepEqual(coffre.objet, { sorte: 'fond', cle: 'dragon' })
    const porte = await ecrire(banc.url, '/api/joueur/moi', { fond: 'dragon' }, cookie, 'PUT')
    assert.equal(porte.status, 200)
    const detail = (await lire(banc, cookie, '/api/joueur/moi')).corps.profile
    assert.ok(detail.fonds.includes('dragon'))
    assert.equal(detail.fond, 'dragon')
    // Ses sept jours aux trois missions paient leur bonus ; un fond du trésor, rien.
    assert.equal(detail.boutique.confettis.gagnes, 7 * 15)
  } finally {
    await banc.close()
  }
})
