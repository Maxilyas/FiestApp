// Le quiz du jour rapporte l'essentiel de l'expérience d'un joueur assidu
// (RECOMPENSES.md § 5.13 : 1 105 XP par mois contre 255 en soirée). Les
// niveaux, les finitions et les emojis de collection tombent donc surtout
// là — et c'est là qu'ils ne s'annoncent jamais : la fin de la partie
// (`Fin`, JourApp.tsx) montre la barre de niveau, sans « Niveau 2 ! », sans
// « Nouvel avatar de collection · Le porter » que la fin de soirée
// (`FinDeSoiree`, `collectionGagnee`) sait montrer. Et la soirée suivante ne
// le dira pas non plus : son « niveau avant » compte déjà l'expérience du jour.
//
// Ce test passe le jour où la fin de la partie du jour dit le niveau qu'elle
// vient de faire franchir (ici sous les noms de la fin de soirée,
// `niveauAvant` et `niveauApres`, qui suffisent au client pour
// `collectionGagnee` et `finitionsOuvertes`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from '../../../server/test/banc'
import { ProfileStore, VERSION_BAREME } from '../../../server/src/auth/profiles'
import { gainVide, releveVide } from '../../../shared/profil'
import { collectionGagnee } from '../../../shared/avatars'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)

const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

test('la partie du jour qui fait monter de niveau le dit, et ce qu’il ouvre', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT })
  try {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Cinquante-cinq points d'une soirée d'avant : le niveau 2 est à soixante.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      db.prepare(
        `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'une-soiree', '', 55, ?, 1)`,
      ).run(id, JSON.stringify({ v: VERSION_BAREME, gain: gainVide(), releve: releveVide() }))
      db.prepare('UPDATE profiles SET xp = 55 WHERE id = ?').run(id)
    } finally {
      db.close()
    }
    await banc.redemarrer()
    const moi = async () => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
    assert.equal((await moi()).niveau, 1)

    // Dix bonnes réponses au quiz du jour.
    let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const questions = JSON.parse((base.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions) as {
      bonne: number
    }[]
    base.close()
    while (etat.question) {
      const i = etat.question.index
      const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: questions[i].bonne })
      assert.equal(r.status, 200, r.corps.error)
      etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
    }
    const apres = await moi()
    console.log(
      `[constat] xp de la partie : +${etat.xp} · niveau ${apres.niveau} · ouvre ${JSON.stringify(collectionGagnee(1, apres.niveau))} · ` +
        `champs de la fin de partie : ${Object.keys(etat).sort().join(', ')}`,
    )
    assert.equal(apres.niveau, 2, 'la partie a bien fait passer le niveau 2')
    assert.equal(etat.niveauAvant, 1, 'la fin de la partie dit d’où il part…')
    assert.equal(etat.niveauApres, 2, '…et où il arrive : le paon s’ouvre, sans que rien ne le dise')
  } finally {
    await banc.close()
  }
})
