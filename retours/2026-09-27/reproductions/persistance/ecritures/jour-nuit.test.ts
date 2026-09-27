// La nuit du quiz du jour, quand Turso hoquette pendant qu'elle paie le podium.
//
// `JourStore.clore` (core/jour.ts) écrit d'abord, d'un seul lot, que le jour
// est clos et qui est sur son podium ; puis, profil par profil et chacun dans
// ses requêtes, l'expérience du podium (`ecrireXp` → ligne `#jour` et total)
// et le Champion du jour. Si l'une échoue, la boucle s'arrête : ceux qui
// suivent ne sont pas payés non plus. Et plus rien ne recommence : le jour
// est déjà dans `jour_clotures`, `clorePasses` ne le revoit jamais. Leur
// podium ne rejoint leur expérience qu'à leur prochaine partie — jamais,
// s'ils ne rejouent pas.
//
// Écrite pour passer le jour où c'est corrigé.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/persistance/ecritures/jour-nuit.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, patienter, type Banc } from '../../../../server/test/banc'
import { ProfileStore } from '../../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
const JOUR = '2026-09-26'

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(permanente(banc), { fileMustExist: true })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

async function jouer(banc: Banc, cookie: string, justes: number) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as any).questions))
  while (etat.question) {
    const i = etat.question.index
    const choix = i < justes ? questions[i].bonne : (questions[i].bonne + 1) % questions[i].reponses.length
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
}

test('la nuit paie tout le podium, même si Turso se tait le temps d’un profil', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const cookies: Record<string, string> = {}
    for (const [login, nom] of [['alice', 'Alice'], ['bruno', 'Bruno'], ['chloe', 'Chloé'], ['david', 'David']]) {
      cookies[login] = await inscrireProfil(banc.url, login, nom)
    }
    await jouer(banc, cookies.alice, 10)
    await jouer(banc, cookies.bruno, 8)
    await jouer(banc, cookies.chloe, 6)
    await jouer(banc, cookies.david, 2)

    const id = (login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)
    // Au moment de payer Bruno, deuxième, Turso refuse d'écrire son total.
    base(banc, db => {
      db.exec('CREATE TABLE panne_temoin (armee INTEGER)')
      db.exec('INSERT INTO panne_temoin VALUES (1)')
      db.exec(`CREATE TRIGGER panne_bruno BEFORE UPDATE OF xp ON profiles
               WHEN NEW.id = '${id('bruno')}' AND EXISTS (SELECT 1 FROM panne_temoin)
               BEGIN SELECT RAISE(ABORT, 'base permanente muette'); END`)
    })
    // Minuit passe : le premier qui revient clôt la nuit pour tous.
    horloge.t += 24 * 3600_000
    const r1 = await fetch(`${banc.url}/api/jour`, { headers: { Cookie: cookies.david } })
    console.log('première demande du lendemain :', r1.status)
    base(banc, db => db.exec('DELETE FROM panne_temoin'))
    // Turso revenu, on revient : la page du profil, le classement d'hier.
    for (const login of ['alice', 'bruno', 'chloe', 'david']) {
      await fetch(`${banc.url}/api/jour`, { headers: { Cookie: cookies[login] } })
      await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookies[login] } })
    }
    await patienter(300)

    const etat = base(banc, db =>
      db
        .prepare(
          `SELECT p.login, pod.rang, pod.xp AS podium,
                  (SELECT xp FROM jour_parties WHERE profile_id = p.id AND jour = ?) AS partie,
                  (SELECT xp FROM profile_xp WHERE profile_id = p.id AND soiree_id = '#jour') AS ligne
           FROM profiles p LEFT JOIN jour_podiums pod ON pod.profile_id = p.id AND pod.jour = ? ORDER BY p.login`,
        )
        .all(JOUR, JOUR),
    ) as { login: string; rang: number | null; podium: number | null; partie: number; ligne: number | null }[]
    console.table(etat)
    assert.equal(base(banc, db => db.prepare('SELECT COUNT(*) AS n FROM jour_clotures').get() as { n: number }).n, 1, 'le jour est clos')
    for (const e of etat) {
      assert.equal(e.ligne ?? 0, e.partie + (e.podium ?? 0), `${e.login} : sa ligne du quiz du jour compte sa partie ET son podium`)
    }
  } finally {
    await banc.close()
  }
})
