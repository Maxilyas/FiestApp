// Hors mission (robustesse) : la page du profil (`detailDe`,
// auth/profileRoutes.ts:79) lit le quiz du jour sans filet — `carriereDe` et
// `categoriesDe` — là où la carrière (`statsDuJourDe`) et la carte
// (`categoriesDe(...).catch`) s'en protègent. Une table du quiz du jour
// illisible fait répondre 500 à toute la page — l'accueil d'un profil
// connecté. Simulée ici en renommant la table des réponses du jour.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, inscrireProfil } from '../../../server/test/banc'

test('une table du quiz du jour illisible ne fait pas tomber la page du profil', async () => {
  const banc = await demarrer()
  try {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const lire = () => fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })
    assert.equal((await lire()).status, 200)
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    db.exec('ALTER TABLE jour_reponses RENAME TO jour_reponses_cachee')
    db.close()
    const r = await lire()
    console.log(`[constat] /api/joueur/moi, quiz du jour illisible : ${r.status}`)
    assert.equal(r.status, 200, 'la page du profil tombe avec le quiz du jour')
  } finally {
    await banc.close()
  }
})
