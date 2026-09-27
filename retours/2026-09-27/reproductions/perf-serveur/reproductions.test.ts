// Les reproductions des constats de perf-serveur sur le quiz du jour : elles
// ÉCHOUENT sur le code d'aujourd'hui (b57035c) et passeront le jour où la
// correction sera faite. Elles COMPTENT (allers-retours vers la base
// permanente, lignes rendues) : rien ne dépend de la charge de la machine.
//
// Un serveur qui a vécu : 200 profils, trente jours de quiz du jour joués par
// tous, la veille close.
//   cd server && nice -n 10 node --import tsx --test --test-timeout=300000 ../export/evaluations/perf-serveur/reproductions.test.ts
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { mesurer, type Appel } from './compteur'
import { peupler, type Peuplement } from './peupler'
import { ADMIN, demarrer, ecrire, type Banc } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false
// `PROTOTYPE=1` : les pistes 1 et 2 prototypées (`prototype.ts`), pour chiffrer leur gain.
if (process.env.PROTOTYPE) await import('./prototype')

/** Dimanche 27 septembre 2026, 19 h à Paris. */
const SOIR = Date.UTC(2026, 8, 27, 17, 0)
const AUJOURDHUI = '2026-09-27'
const HIER = '2026-09-26'

let banc: Banc
let pop: Peuplement
const horloge = { t: SOIR }

const lire = (chemin: string, cookie: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(r => r.json() as Promise<any>)
const poster = (chemin: string, cookie: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, cookie).then(r => r.json() as Promise<any>)
const chargementsUnParUn = (appels: Appel[]) => appels.filter(a => a.sql === 'SELECT * FROM profiles WHERE id = ?').length

before(async () => {
  banc = await demarrer({ horlogeDuJour: () => horloge.t })
  const fichier = banc.quizDbUrl.replace(/^file:/, '')
  const spaceId = (new Database(fichier, { readonly: true }).prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
  pop = peupler(fichier, { spaceId, aujourdhui: AUJOURDHUI, profils: 200, hier: 200, parJour: 200, joueursDuSoir: 200 })
  await banc.redemarrer()
  // La nuit d'hier se clôt une fois pour toutes.
  await lire('/api/jour', pop.cookie(pop.ids[0]))
})

after(() => banc.close())

test('au réveil, la première visite du quiz du jour ne charge pas les 200 joueurs d’hier un par un', async () => {
  // L'hébergeur gratuit s'endort après un quart d'heure sans visite : la
  // mémoire des profils repart vide, et `vainqueursDe` / `sonJour` relisent
  // le classement d'hier (`joueursDu`), profil par profil (`byId`).
  await banc.redemarrer()
  const { mesure, appels } = await mesurer('GET /api/jour au réveil', () => lire('/api/jour', pop.cookie(pop.ids[0])))
  const unParUn = chargementsUnParUn(appels)
  assert.ok(
    mesure.appels <= 30,
    `${mesure.appels} allers-retours vers la base permanente, dont ${unParUn} « SELECT * FROM profiles WHERE id = ? » ` +
      `(chacun suivi de deux autres : ses Éclats, ses récompenses), huit profils à la fois`,
  )
})

test('au réveil, le classement du mois ne charge pas ses 200 joueurs un par un', async () => {
  await banc.redemarrer()
  const { mesure, appels } = await mesurer('GET /api/jour/classement?mois au réveil', () =>
    lire('/api/jour/classement?mois=2026-09', pop.cookie(pop.ids[0])),
  )
  assert.ok(mesure.appels <= 30, `${mesure.appels} allers-retours, dont ${chargementsUnParUn(appels)} chargements de profil un par un`)
})

test('l’accueil d’un profil ne rapatrie pas les points de tous les joueurs de ses trente derniers jours', async () => {
  // `joursJoues` lit « jour, points » de TOUS les joueurs de chacun de ses
  // trente derniers jours pour y ranger le sien : 30 × 200 lignes ici, à
  // chaque visite de chacun. Une première visite (d'un autre) peut charger
  // ces jours une fois : c'est la visite suivante qu'on compte.
  await lire('/api/joueur/moi', pop.cookie(pop.ids[0]))
  const { mesure, appels } = await mesurer('GET /api/joueur/moi', () => lire('/api/joueur/moi', pop.cookie(pop.ids[3])))
  const pire = [...appels].sort((a, b) => b.lignes - a.lignes)[0]
  assert.ok(
    mesure.lignes <= 1000,
    `${mesure.lignes} lignes rendues par la base (${(mesure.octets / 1024).toFixed(0)} Ko au moins), dont ${pire.lignes} par « ${pire.sql} » (${pire.qui})`,
  )
})

test('« Question suivante » ne relit pas le classement figé d’hier après chaque réponse', async () => {
  const cookie = pop.cookie(pop.ids[7])
  // Le classement d'hier est lu une fois (et gardé) par cette première visite.
  await lire('/api/jour', cookie)
  let etat = await poster('/api/jour/commencer', cookie)
  const hierLu = (appels: Appel[]) =>
    appels.filter(a => a.sql.startsWith('SELECT profile_id, points, finie_le, commencee_le FROM jour_parties WHERE jour = ?') && a.args[0] === HIER)
  let relectures = 0
  let lignes = 0
  let gestes = 0
  while (etat.question) {
    horloge.t += 4000
    await poster('/api/jour/repondre', cookie, { jour: AUJOURDHUI, index: etat.question.index, choix: 0 })
    const { resultat, appels } = await mesurer('suivante', () => poster('/api/jour/suivante', cookie))
    relectures += hierLu(appels).length
    lignes += hierLu(appels).reduce((n, a) => n + a.lignes, 0)
    gestes++
    etat = resultat
  }
  assert.equal(
    relectures,
    0,
    `le classement d'hier (${HIER}, figé depuis minuit) relu ${relectures} fois en ${gestes} « question suivante », ${lignes} lignes : ` +
      'chaque réponse du jour fait monter la révision unique qui garde tous les jours',
  )
})
