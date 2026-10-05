// Le défi de la semaine (le 5 octobre 2026) : la même série pour tous du
// lundi au dimanche, une seule tentative, un classement de la semaine ; sa
// clôture, au premier passage d'après, range son vainqueur — Le Vainqueur
// du défi — et lui pose le laurier d'argent toute la semaine suivante.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecranCommun, ecrire, inscrireProfil, instantane, invite, type Banc } from './banc'
import { ProfileStore, cleDuDefi } from '../src/auth/profiles'
import { minutesAvantLundi, semaineAvant, semaineDe } from '../../shared/campagne'

ProfileStore.tirageEclat = () => false

const JOUR_MS = 24 * 3600 * 1000
/** Mardi 6 octobre 2026, 10 h à Paris (UTC+2). */
const MARDI = Date.UTC(2026, 9, 6, 8, 0)
const BASE = baseDEssai(120)

interface Horloge {
  t: number
}

async function avecBanc(scenario: (banc: Banc, horloge: Horloge) => Promise<void>) {
  const horloge = { t: MARDI }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

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

const questionsDe = (banc: Banc, serie: string) =>
  base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)) as {
    id: string
    bonne: number
    reponses: string[]
  }[]

/**
 * Relève le défi et répond jusqu'à `jusqua` questions (toutes, par défaut,
 * jusqu'à la troisième erreur) ; `juste(i)` dit s'il trouve la question i.
 * Rend sa série et sa dernière réponse.
 */
async function relever(banc: Banc, cookie: string, juste: (i: number) => boolean, jusqua = Infinity) {
  const serie = (await poster(banc, cookie, '/api/campagne/defi')).corps
  assert.ok(serie.id, serie.error)
  const questions = questionsDe(banc, serie.id)
  let derniere: any = null
  for (let i = serie.question.index; !derniere?.finie && i < jusqua; i++) {
    const q = questions[i]
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: juste(i) ? q.bonne : (q.bonne + 1) % q.reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    derniere = r.corps
  }
  return { serie: serie.id as string, derniere }
}

test('la semaine du défi se lit au calendrier de Paris, du lundi au dimanche', () => {
  assert.equal(semaineDe('2026-10-05'), '2026-10-05', 'un lundi ouvre sa semaine')
  assert.equal(semaineDe('2026-10-11'), '2026-10-05', 'le dimanche la ferme')
  assert.equal(semaineDe('2026-10-12'), '2026-10-12')
  assert.equal(semaineDe('2027-01-01'), '2026-12-28', 'une semaine à cheval sur deux années')
  assert.equal(semaineAvant('2026-10-05'), '2026-09-28')
  // Dimanche 11 octobre, 23 h à Paris : une heure avant la clôture.
  assert.equal(minutesAvantLundi(Date.UTC(2026, 9, 11, 21, 0)), 60)
  // Dimanche 25 octobre 2026, la nuit du passage à l'heure d'hiver : la semaine a une heure de plus.
  assert.equal(minutesAvantLundi(Date.UTC(2026, 9, 19, 0, 0) - 2 * 3600_000), 7 * 24 * 60 + 60)
})

test('la même série pour tous, une seule tentative, et sa correction qui attend la clôture', () =>
  avecBanc(async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo')
    const page = (await lire(banc, lea, '/api/campagne/defi')).corps
    assert.equal(page.semaine, '2026-10-05')
    assert.equal(page.tentative, null)
    assert.equal(page.joueurs, 0)
    // Léa s'arrête en route : sa tentative se reprend, elle ne recommence pas.
    const premiere = await relever(banc, lea, () => true, 3)
    const reprise = (await poster(banc, lea, '/api/campagne/defi')).corps
    assert.equal(reprise.id, premiere.serie, 'la tentative laissée en route se reprend')
    assert.equal(reprise.question.index, 3)
    assert.equal(reprise.justes, 3)
    // Une série de campagne ne la clôt pas, ni elle la série.
    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    assert.ok(serie.id)
    const leaFin = await relever(banc, lea, i => i < 12)
    assert.equal(leaFin.serie, premiere.serie)
    assert.equal(leaFin.derniere.justes, 12)
    assert.equal(leaFin.derniere.record, undefined, 'un défi a son classement, pas le record des séries')
    assert.deepEqual(leaFin.derniere.defi, { rang: 1, joueurs: 1 })
    assert.ok((await lire(banc, lea, '/api/campagne')).corps.enCours, 'sa série l’attend toujours')
    // Hugo a les mêmes questions, dans le même ordre, les réponses aussi.
    const hugoFin = await relever(banc, hugo, i => i < 7)
    assert.deepEqual(questionsDe(banc, hugoFin.serie), questionsDe(banc, leaFin.serie))
    assert.deepEqual(hugoFin.derniere.defi, { rang: 2, joueurs: 2 })
    // Une seule tentative par semaine.
    const encore = await poster(banc, hugo, '/api/campagne/defi')
    assert.equal(encore.status, 400)
    assert.match(encore.corps.error, /lundi/)
    // La correction attend la clôture : elle soufflerait les réponses à ceux qui jouent encore.
    const correction = await lire(banc, lea, `/api/campagne/serie/${leaFin.serie}/correction`)
    assert.equal(correction.status, 400)
    // Le classement de la semaine, rang partagé.
    const classement = (await lire(banc, hugo, '/api/campagne/defi')).corps
    assert.equal(classement.joueurs, 2)
    assert.deepEqual(
      classement.lignes.map((l: any) => [l.nom, l.justes, l.rang]),
      [
        ['Léa', 12, 1],
        ['Hugo', 7, 2],
      ],
    )
    assert.equal(classement.sienne, idDe(banc, 'hugo'))
    assert.equal(classement.tentative.finie, true)
  }))

test('lundi, le défi se clôt : son vainqueur range son haut fait, et porte le laurier d’argent toute la semaine', () =>
  avecBanc(async (banc, horloge) => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé')
    const leaFin = await relever(banc, lea, i => i < 9)
    await relever(banc, hugo, i => i < 5)
    // Zoé laisse sa tentative en route : elle compte ce qu'elle a trouvé.
    const zoeEnRoute = await relever(banc, zoe, () => true, 2)
    // Lundi 12 octobre, 9 h : la première demande clôt la semaine.
    horloge.t = Date.UTC(2026, 9, 12, 7, 0)
    const page = (await lire(banc, hugo, '/api/campagne/defi')).corps
    assert.equal(page.semaine, '2026-10-12')
    assert.equal(page.tentative, null, 'un nouveau défi, une nouvelle tentative')
    assert.deepEqual(page.vainqueurs.map((v: any) => v.nom), ['Léa'])
    assert.equal(page.saSemainePassee.rang, 2)
    assert.equal(page.saSemainePassee.joueurs, 3)
    assert.deepEqual(page.saSemainePassee.recompenses, [])
    const rangees = base(banc, db =>
      (db.prepare('SELECT profile_id, badge FROM profile_badges WHERE soiree_id = ?').all(cleDuDefi('2026-10-05')) as { profile_id: string; badge: string }[]).map(r => [
        r.profile_id,
        r.badge,
      ]),
    )
    assert.deepEqual(rangees, [[idDe(banc, 'lea'), 'hf:defi']])
    // Sa page le dit à Léa ; sa correction s'ouvre.
    const pageLea = (await lire(banc, lea, '/api/campagne/defi')).corps
    assert.deepEqual(pageLea.saSemainePassee.recompenses.map((r: any) => r.key), ['hf:defi'])
    assert.equal(pageLea.saSemainePassee.serie, leaFin.serie)
    assert.equal((await lire(banc, lea, `/api/campagne/serie/${leaFin.serie}/correction`)).status, 200)
    // La tentative laissée en route s'est arrêtée à la clôture.
    const reponse = await poster(banc, zoe, `/api/campagne/serie/${zoeEnRoute.serie}/reponse`, { index: 2, choix: 0 })
    assert.equal(reponse.status, 400)
    // Le laurier d'argent : à son profil, et dans la salle où elle joue.
    const moi = (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    assert.equal(moi.laurier, 'argent')
    assert.ok(!('laurier' in (await lire(banc, hugo, '/api/joueur/moi')).corps.profile))
    const ecran = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    const lui = await invite(banc.url, 'Léa', '🦊', { cookie: lea })
    const salle = await instantane<any>(ecran, s => s.players?.length === 1, 'Léa dans la salle')
    assert.equal(salle.players[0].laurier, 'argent')
    lui.socket.close()
    ecran.close()
    // Le titre se porte comme celui de tout haut fait.
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { titre: 'hf:defi' }, lea, 'PUT')).status, 200)
    // Une semaine plus tard, le laurier tombe : personne n'a relevé le défi d'après.
    horloge.t += 7 * JOUR_MS
    await lire(banc, hugo, '/api/campagne/defi')
    assert.ok(!('laurier' in (await lire(banc, lea, '/api/joueur/moi')).corps.profile))
  }))

test('des ex æquo en tête gagnent tous ; seul, on n’a battu personne', () =>
  avecBanc(async (banc, horloge) => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo')
    await relever(banc, lea, i => i < 6)
    await relever(banc, hugo, i => i < 6)
    horloge.t += 7 * JOUR_MS
    const page = (await lire(banc, lea, '/api/campagne/defi')).corps
    assert.deepEqual(page.vainqueurs.map((v: any) => v.nom).sort(), ['Hugo', 'Léa'])
    assert.equal(page.saSemainePassee.rang, 1)
    // La semaine d'après, Léa joue seule : pas de vainqueur.
    await relever(banc, lea, i => i < 20)
    horloge.t += 7 * JOUR_MS
    const seule = (await lire(banc, lea, '/api/campagne/defi')).corps
    assert.deepEqual(seule.vainqueurs, [])
    assert.equal(seule.saSemainePassee.rang, 1)
    assert.deepEqual(seule.saSemainePassee.recompenses, [])
  }))
