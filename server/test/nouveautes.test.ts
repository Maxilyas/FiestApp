// La pastille rouge des nouveautés (le souhait du propriétaire du 14 octobre
// 2026 : « un petit indicateur rouge, un peu comme les notifications de
// duels », pour donner envie d'aller voir son profil) : ce que le serveur
// retient qu'un profil a vu dans sa loge, et ce qu'il compte de neuf — pour
// tous ses appareils. Retenu sur le téléphone, ce qu'on regardait sur
// l'ordinateur se redisait nouveau sur le téléphone, et seule la page du
// profil savait le compter.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, cookieDe, demarrer, ecrire, inscrireProfil } from './banc'
import { ceQuIlAPorter, retenirLesVus } from '../../shared/loge'
import { CLES_VUES_MAX, compteDesNouveautes, lireLesVus, premierePieceNeuve } from '../../shared/piecesDeLaLoge'

const lire = async (url: string, chemin: string, cookie?: string) => (await fetch(`${url}${chemin}`, { headers: cookie ? { Cookie: cookie } : {} })).json() as Promise<any>
const RIEN = { nouveautes: 0, pieces: {} }

test('le serveur compte ce qu’il a de neuf à porter : rien d’abord, puis ce qui arrive, jusqu’à ce qu’il le regarde — sur tous ses appareils', async () => {
  const banc = await demarrer()
  try {
    const telephone = await inscrireProfil(banc.url, 'neuf', 'Léa')
    // Sans profil, rien : un invité n'est pas une erreur.
    assert.deepEqual(await lire(banc.url, '/api/joueur/nouveautes'), RIEN)
    // Jamais passé par sa loge : rien de nouveau — la première visite ne crie pas « nouveau » sur
    // tout ce qu'il a —, et tout ce qu'il a se retient vu, d'un coup.
    assert.deepEqual(await lire(banc.url, '/api/joueur/nouveautes', telephone), RIEN)
    const { profile } = await lire(banc.url, '/api/joueur/moi', telephone)
    assert.deepEqual(profile.vusDeLaLoge, retenirLesVus(ceQuIlAPorter(profile), {}, null))

    // Un thème lui arrive : un de neuf, dans la pièce du thème.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, 1)').run(profile.id, 'jungle')
    } finally {
      db.close()
    }
    assert.deepEqual(await lire(banc.url, '/api/joueur/nouveautes', telephone), { nouveautes: 1, pieces: { theme: 1 } })
    // Sur l'ordinateur — une autre session —, le même compte, et le détail le même vu.
    const connexion = await ecrire(banc.url, '/api/joueur/connexion', { login: 'neuf', password: 'motdepasse1' })
    assert.equal(connexion.status, 200)
    const ordinateur = cookieDe(connexion, 'qz_joueur')
    assert.deepEqual(await lire(banc.url, '/api/joueur/nouveautes', ordinateur), { nouveautes: 1, pieces: { theme: 1 } })

    // Il regarde sa pièce « Thème » sur l'ordinateur : la page retient, le serveur garde — plus rien, téléphone compris.
    const detail = (await lire(banc.url, '/api/joueur/moi', ordinateur)).profile
    const regardee = retenirLesVus(ceQuIlAPorter(detail), detail.vusDeLaLoge, 'theme')
    const retenue = await ecrire(banc.url, '/api/joueur/vus', { vus: regardee }, ordinateur, 'PUT')
    assert.equal(retenue.status, 200)
    assert.deepEqual(await lire(banc.url, '/api/joueur/nouveautes', telephone), RIEN)
    assert.deepEqual((await lire(banc.url, '/api/joueur/moi', telephone)).profile.vusDeLaLoge, regardee)
  } finally {
    await banc.close()
  }
})

test('un haut fait neuf se compte une fois, titre et vitrine à la fois ; la loge s’ouvre sur la première pièce qui a du neuf', () => {
  const neufs = { avatar: [], titre: ['hf:phenix'], vitrine: ['hf:phenix'], fond: [], theme: ['jungle'], gerbe: [] }
  assert.deepEqual(compteDesNouveautes(neufs), { nouveautes: 2, pieces: { titre: 1, vitrine: 1, theme: 1 } })
  assert.equal(premierePieceNeuve(compteDesNouveautes(neufs)), 'titre')
  assert.equal(premierePieceNeuve(compteDesNouveautes({ ...neufs, titre: [], vitrine: [], theme: [] })), null)
})

test('ce qu’une page envoie à retenir se lit avant de s’écrire : sans profil, refusé ; illisible, refusé ; démesuré, réduit', async () => {
  const banc = await demarrer()
  try {
    const cookie = await inscrireProfil(banc.url, 'vus', 'Tom')
    assert.equal((await ecrire(banc.url, '/api/joueur/vus', { vus: { theme: ['velours'] } }, undefined, 'PUT')).status, 401)
    for (const vus of [undefined, 'tout', ['theme'], { inconnue: ['x'] }, {}]) {
      const res = await ecrire(banc.url, '/api/joueur/vus', { vus }, cookie, 'PUT')
      assert.equal(res.status, 400, JSON.stringify(vus))
      assert.deepEqual(await res.json(), { error: 'Rien à retenir : recharge la page.' })
    }
    // Des clés qui ne sont pas du texte, trop longues, en double, trop nombreuses : réduites, jamais gardées telles quelles.
    const brut = { theme: ['velours', 'velours', 3, '', 'x'.repeat(81), ...Array.from({ length: CLES_VUES_MAX + 50 }, (_, i) => `t${i}`)], gerbe: 'confettis' }
    assert.equal((await ecrire(banc.url, '/api/joueur/vus', { vus: brut }, cookie, 'PUT')).status, 200)
    const garde = (await lire(banc.url, '/api/joueur/moi', cookie)).profile.vusDeLaLoge
    assert.equal(garde.theme.length, CLES_VUES_MAX)
    assert.equal(garde.theme[0], 'velours')
    assert.ok(!('gerbe' in garde), 'une pièce qui n’est pas une liste ne se retient pas')
    assert.deepEqual(garde, lireLesVus(brut))
  } finally {
    await banc.close()
  }
})

test('ce qu’il a vu part avec son profil', async () => {
  const banc = await demarrer()
  try {
    const cookie = await inscrireProfil(banc.url, 'parti', 'Zoé')
    assert.deepEqual(await lire(banc.url, '/api/joueur/nouveautes', cookie), RIEN)
    const id = (await lire(banc.url, '/api/joueur/moi', cookie)).profile.id
    const compter = () => {
      const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
      try {
        return (db.prepare('SELECT COUNT(*) AS n FROM profile_loge_vus WHERE profile_id = ?').get(id) as { n: number }).n
      } finally {
        db.close()
      }
    }
    assert.equal(compter(), 1)
    const admin = await connexionAnimateur(banc.url)
    const suppression = await fetch(`${banc.url}/api/admin/profils/${id}`, { method: 'DELETE', headers: { Cookie: admin, 'X-Requested-With': 'quizz' } })
    assert.equal(suppression.status, 200)
    assert.equal(compter(), 0)
  } finally {
    await banc.close()
  }
})
