// La campagne sur Turso : ce qu'une réponse coûte à la base permanente.
//
// L'audit du 4 octobre 2026 : une bonne réponse relisait sa série, lisait
// le record à part, puis TOUTES les bonnes réponses du joueur depuis
// toujours — une ligne chacune, des milliers pour un fidèle — pour récrire
// sa ligne d'expérience : quatre à cinq allers-retours en série, et un
// chargement qui grossissait à chaque bonne réponse. En production, chaque
// `execute` et chaque `batch` est un aller-retour HTTP vers Turso : on les
// compte sur le fichier `file:` qui en tient lieu, comme `jour-charge.test.ts`.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { ProfileStore, LIGNE_CAMPAGNE } from '../src/auth/profiles'
import { XP_PAR_JUSTE } from '../../shared/campagne'

ProfileStore.tirageEclat = () => false

/** Ce que la base permanente a servi pendant une mesure. */
const compte = { actif: false, appels: 0, lignes: 0 }

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    const res = await origine.apply(this, args)
    if (compte.actif) {
      compte.appels++
      for (const l of (methode === 'batch' ? res : [res]) as { rows: unknown[] }[]) compte.lignes += l.rows.length
    }
    return res
  }
}

async function mesurer<T>(travail: () => Promise<T>): Promise<{ appels: number; lignes: number; resultat: T }> {
  Object.assign(compte, { actif: true, appels: 0, lignes: 0 })
  try {
    const resultat = await travail()
    return { appels: compte.appels, lignes: compte.lignes, resultat }
  } finally {
    compte.actif = false
  }
}

/** Samedi 26 septembre 2026, 10 h à Paris. */
const MAINTENANT = Date.UTC(2026, 8, 26, 8, 0)
/** Ses bonnes réponses d'avant : trois cents le 24, de 12 h à 16 h à Paris… */
const ANCIENNES = 300
/** …puis une à 23 h 59 59 et une à minuit pile, à Paris (heure d'été : UTC+2) — deux jours différents. */
const VEILLE_DE_MINUIT = Date.UTC(2026, 8, 24, 21, 59, 59, 999)
const MINUIT = Date.UTC(2026, 8, 24, 22, 0)

let banc: Banc
let cookie: string
let profileId: string

const poster = (chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => {
    const lu = (await r.json()) as any
    assert.equal(r.status, 200, `${chemin} : ${lu.error}`)
    return lu
  })

before(async () => {
  banc = await demarrer({ horlogeDuJour: () => MAINTENANT, baseDeLaCampagne: baseDEssai(40) })
  cookie = await inscrireProfil(banc.url, 'fidele', 'Fidèle')
  profileId = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  // Une longue série d'avant, écrite directement dans la base permanente.
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const total = ANCIENNES + 2
  db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le) VALUES ('ancienne', ?, '[]', ?, 3, ?, ?, ?)`).run(
    profileId,
    total,
    total,
    MINUIT - 86400_000,
    MINUIT,
  )
  const reponse = db.prepare(`INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES ('ancienne', ?, ?, 0, 1, ?)`)
  db.transaction(() => {
    for (let i = 0; i < ANCIENNES; i++) reponse.run(i, `ancienne-${i}`, Date.UTC(2026, 8, 24, 10, 0) + i * 48_000)
    reponse.run(ANCIENNES, 'avant-minuit', VEILLE_DE_MINUIT)
    reponse.run(ANCIENNES + 1, 'minuit', MINUIT)
  })()
  db.close()
})

after(() => banc.close())

/** Les questions de sa série, lues en base : le téléphone ne voit jamais la bonne avant sa réponse. */
function bonnes(serie: string): number[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  try {
    return (JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions) as { bonne: number }[]).map(
      q => q.bonne,
    )
  } finally {
    db.close()
  }
}

test('une bonne réponse de campagne : deux allers-retours, sans relire tout ce qu’il a jamais trouvé', async () => {
  const serie = await poster('/api/campagne/serie')
  const reponses = bonnes(serie.id)
  const juste = await mesurer(() => poster(`/api/campagne/serie/${serie.id}/reponse`, { index: 0, choix: reponses[0] }))
  assert.equal(juste.resultat.juste, true)
  assert.equal(juste.resultat.xp, XP_PAR_JUSTE)
  // Sa réponse, son record et ses bonnes réponses dans un lot ; sa ligne d'expérience dans l'autre.
  assert.ok(juste.appels <= 2, `${juste.appels} allers-retours pour une bonne réponse`)
  // Comptées par heure : quelques lignes, pas trois cents.
  assert.ok(juste.lignes < 20, `${juste.lignes} lignes lues pour une bonne réponse (${ANCIENNES + 3} bonnes réponses en tout)`)

  const fausse = await mesurer(() => poster(`/api/campagne/serie/${serie.id}/reponse`, { index: 1, choix: (reponses[1] + 1) % 4 }))
  assert.equal(fausse.resultat.juste, false)
  assert.equal(fausse.appels, 1, 'une mauvaise réponse : un seul aller-retour, sa série est en mémoire')
})

test('comptée par heure, sa ligne d’expérience reste exacte, jours de Paris compris', async () => {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  try {
    const ligne = db.prepare('SELECT xp, detail FROM profile_xp WHERE profile_id = ? AND soiree_id = ?').get(profileId, LIGNE_CAMPAGNE) as { xp: number; detail: string }
    // Les trois cents deux d'avant et celle d'aujourd'hui.
    assert.equal(ligne.xp, (ANCIENNES + 3) * XP_PAR_JUSTE)
    // Le 24, le 25 (minuit pile à Paris, 22 h en UTC) et aujourd'hui, le 26.
    assert.equal(JSON.parse(ligne.detail).jours, 3)
  } finally {
    db.close()
  }
})

test('la base de la campagne se lit en fond après le démarrage : le premier joueur ne l’attend plus', async () => {
  // Lue à sa première série, elle faisait attendre 3,5 s le premier joueur
  // de campagne après chaque déploiement ou réveil, au dixième de cœur.
  let lectures = 0
  const prechauffe = await demarrer({
    horlogeDuJour: () => MAINTENANT,
    baseDeLaCampagne: () => (lectures++, baseDEssai(40)),
    prechauffageCampagneMs: 20,
  })
  try {
    await patienter(300)
    assert.equal(lectures, 1, 'lue sans qu’un joueur la demande')
    const presse = await inscrireProfil(prechauffe.url, 'presse', 'Pressé')
    const reponse = await fetch(`${prechauffe.url}/api/campagne`, { headers: { Cookie: presse } })
    assert.equal(reponse.status, 200)
    assert.equal(lectures, 1, 'et pas relue à la première demande')
  } finally {
    await prechauffe.close()
  }
})
