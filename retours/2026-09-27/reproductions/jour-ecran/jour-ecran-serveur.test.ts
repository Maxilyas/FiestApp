// Les reproductions de l'audit « jour-ecran » qui se prouvent par l'API :
// chacune échoue sur le code d'aujourd'hui (b57035c) et passera le jour où
// le défaut sera corrigé.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/jour-ecran/jour-ecran-serveur.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

const JOUR = '2026-09-26'

async function avecBanc(depart: number, scenario: (banc: Banc, horloge: { t: number }) => Promise<void>) {
  const horloge = { t: depart }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
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

function tirage(banc: Banc, jour = JOUR): { bonne: number; reponses: string[] }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const r = db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string } | undefined
    return r ? JSON.parse(r.questions) : []
  } finally {
    db.close()
  }
}

// ── Déjà rapporté par jour-regles (n° 5) : gardé comme confirmation vue du téléphone ──
// Une partie commencée avant minuit, arrêtée sur une révélation. Juste après
// minuit, avant que personne n'ait ouvert le quiz du jour, « Question
// suivante » (`POST /api/jour/suivante`) rend `etat: 'aucun'` — et le
// téléphone affiche « Pas de quiz aujourd'hui : la réserve de questions est
// vide. Il revient demain. », alors que la réserve est pleine : la page
// rechargée propose aussitôt les dix questions du dimanche.
test('juste après minuit, « Question suivante » ne dit pas la réserve vide', () =>
  avecBanc(Date.UTC(2026, 8, 26, 21, 59, 30), async (banc, horloge) => {
    const noe = await inscrireProfil(banc.url, 'noe', 'Noé', '🐻')
    await poster(banc, noe, '/api/jour/commencer')
    const q = tirage(banc)
    assert.equal((await poster(banc, noe, '/api/jour/repondre', { jour: JOUR, index: 0, choix: q[0].bonne })).status, 200)

    horloge.t = Date.UTC(2026, 8, 26, 22, 0, 5) // dimanche 27, 0 h 00 min 05 s à Paris
    const suite = (await poster(banc, noe, '/api/jour/suivante')).corps
    const recharge = (await lire(banc, noe, '/api/jour')).corps
    assert.equal(recharge.etat, 'a-jouer', 'la page rechargée propose bien le quiz du dimanche')
    assert.equal(recharge.total, 10)
    assert.notEqual(suite.etat, 'aucun', 'la réserve n’est pas vide : « Pas de quiz aujourd’hui » est faux')
  }))

// ── jour-ecran-7 ──────────────────────────────────────────────────────────
// Le lendemain d'une victoire, la première page que le vainqueur ouvre est
// l'accueil (`GET /api/joueur/moi`). Elle lit son laurier et son expérience
// AVANT de clore la nuit (`detailDe` : `toDetail` puis `carriereDe`, qui
// appelle `clorePasses`) : ni « Vainqueur du quiz du jour d'hier », ni les
// 25 XP du podium. Rechargée, la même page les montre.
test('le lendemain, la page du vainqueur porte son laurier et son podium dès la première visite', () =>
  avecBanc(Date.UTC(2026, 8, 26, 8, 0), async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    for (const [cookie, juste] of [
      [alice, () => true],
      [bob, (i: number) => i > 3],
    ] as const) {
      let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
      const q = tirage(banc)
      while (etat.question) {
        const i = etat.question.index
        await poster(banc, cookie, '/api/jour/repondre', { jour: JOUR, index: i, choix: juste(i) ? q[i].bonne : (q[i].bonne + 1) % q[i].reponses.length })
        etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
      }
    }

    horloge.t = Date.UTC(2026, 8, 27, 7, 30) // dimanche, 9 h 30 à Paris
    const premiere = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    const seconde = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    assert.equal(seconde.laurier, true, 'rechargée, la page porte le laurier')
    assert.equal(premiere.laurier, true, 'dès la première visite du jour, le vainqueur d’hier porte son laurier')
    assert.equal(premiere.xp, seconde.xp, 'et son expérience compte déjà le podium de la nuit')
  }))

// ── Déjà rapporté par jour-regles (n° 9) : gardé comme confirmation ─────────
// Un jour clos, son classement est « figé » — et pourtant chaque partie
// restée inachevée y porte « · en cours » : `joueursDu` pose `enCours` sur
// toute partie sans `finie_le`, que le jour soit clos ou non.
test('un classement figé ne dit plus « en cours »', () =>
  avecBanc(Date.UTC(2026, 8, 26, 8, 0), async (banc, horloge) => {
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    await poster(banc, zoe, '/api/jour/commencer')
    const q = tirage(banc)
    await poster(banc, zoe, '/api/jour/repondre', { jour: JOUR, index: 0, choix: q[0].bonne })

    horloge.t = Date.UTC(2026, 8, 27, 7, 30)
    const hier = (await lire(banc, zoe, `/api/jour/classement?jour=${JOUR}`)).corps
    assert.equal(hier.fige, true)
    assert.deepEqual(
      hier.lignes.filter((l: any) => l.enCours).map((l: any) => l.nom),
      [],
      'un jour figé n’a plus de partie « en cours »',
    )
  }))
