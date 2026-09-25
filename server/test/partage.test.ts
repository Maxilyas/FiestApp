// Partager un quiz (rapport du 25 septembre 2026, lot 6) : un code à un
// animateur du même serveur, une copie au catalogue que l'administrateur
// publie — toujours une copie, jamais un quiz public — et les modèles livrés.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createClient } from '@libsql/client'
import { ecrireCode, lireCode } from '../../shared/partage'
import { normalizeQuestions, playableQuestions } from '../../shared/library'
import { CATEGORIES } from '../../shared/categories'
import { connexionAnimateur, cookieDe, creerQuiz, demarrer, ecrire, estimation, qcm, type Banc } from './banc'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const bancs: Banc[] = []
after(async () => {
  for (const b of bancs) await b.close()
})

/** Un animateur de plus sur le banc, son espace, et sa session. */
async function animateur(banc: Banc, admin: string, login: string, name: string): Promise<string> {
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login, name, slug: `chez-${login}` }, admin)
  assert.equal(cree.status, 201)
  const { activation } = (await cree.json()) as { activation: { token: string } }
  return cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: `${login}-pass-1` }))
}

// ── Le code ────────────────────────────────────────────────────────────────

test('un code se lit comme on le tape ou le colle, et s’écrit en deux groupes', () => {
  assert.equal(ecrireCode('K7X2QF'), 'K7X-2QF')
  for (const saisie of ['K7X-2QF', 'k7x2qf', ' k7x 2qf ', 'https://quiz.example/edit?recevoir=K7X2QF', 'K7X–2QF']) {
    assert.equal(lireCode(saisie), 'K7X2QF', saisie)
  }
  // Ni 0, ni O, ni 1, ni I, ni L : le code ne les emploie jamais.
  for (const saisie of ['K7X2Q', 'K7X2QFF', 'K0X2QF', 'KOX2QF', 'K1X2QF', 'KIX2QF', 'KLX2QF', '']) {
    assert.equal(lireCode(saisie), null, saisie)
  }
})

// ── Le serveur ─────────────────────────────────────────────────────────────

test('un code donne une copie, photos recopiées chez le destinataire — figée, révocable, et chacun chez soi', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const admin = await connexionAnimateur(banc.url)
  const voisin = await animateur(banc, admin, 'voisin', 'Voisin')
  const lire = async (chemin: string, c: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: c } })

  const { url: photo } = (await (await ecrire(banc.url, '/api/images', { dataUrl: PNG }, admin)).json()) as { url: string }
  const id = await creerQuiz(banc.url, admin, [{ ...qcm('Qui est sur la photo ?', ['Mamie', 'Papi']), image: photo }, estimation('Âge de Mamie ?', 88)], 'Spécial famille')

  // Seul le propriétaire ouvre la porte.
  assert.equal((await ecrire(banc.url, `/api/quizzes/${id}/partage`, {}, voisin)).status, 404)
  const partage = await ecrire(banc.url, `/api/quizzes/${id}/partage`, {}, admin)
  assert.equal(partage.status, 201)
  const { code, expiresAt } = (await partage.json()) as { code: string; expiresAt: number }
  assert.ok(lireCode(code) === code)
  assert.ok(expiresAt > Date.now() + 6 * 24 * 3600 * 1000, 'sept jours')
  assert.equal((await lire(`/api/quizzes/${id}/partages`, voisin)).status, 404, 'le voisin ne voit pas les codes des autres')
  assert.deepEqual(((await (await lire(`/api/quizzes/${id}/partages`, admin)).json()) as any[]).map(p => p.code), [code])

  // Retouché après le partage : le code donne l'instantané.
  const original = (await (await lire(`/api/quizzes/${id}`, admin)).json()) as any
  await ecrire(banc.url, `/api/quizzes/${id}`, { title: 'Spécial famille', questions: [...original.questions, qcm('Ajoutée après ?')] }, admin, 'PUT')

  const recu = await ecrire(banc.url, '/api/partages/recevoir', { code: ecrireCode(code).toLowerCase() }, voisin)
  assert.equal(recu.status, 201)
  const copie = (await recu.json()) as any
  assert.equal(copie.title, 'Spécial famille')
  assert.deepEqual(copie.questions.map((q: any) => q.text), ['Qui est sur la photo ?', 'Âge de Mamie ?'], 'la copie du moment du partage')
  const photoCopiee = copie.questions[0].image as string
  assert.match(photoCopiee, /^\/media\/image\/[0-9a-f-]{36}$/)
  assert.notEqual(photoCopiee, photo, 'une photo à lui')
  assert.equal((await fetch(`${banc.url}${photoCopiee}`)).status, 200)
  const base = createClient({ url: banc.quizDbUrl })
  try {
    const ligne = await base.execute({ sql: 'SELECT space_id FROM quiz_images WHERE id = ?', args: [photoCopiee.split('/').pop()!] })
    const espaceDuVoisin = await base.execute({ sql: "SELECT id FROM accounts WHERE login = 'voisin'" })
    assert.equal(String(ligne.rows[0].space_id), String(espaceDuVoisin.rows[0].id), 'rangée dans l’espace du destinataire')

    // Reçu deux fois : un second quiz, qui ne se confond pas avec le premier.
    const encore = (await (await ecrire(banc.url, '/api/partages/recevoir', { code }, voisin)).json()) as any
    assert.equal(encore.title, 'Spécial famille (2)')

    // Le quiz supprimé chez l'admin, le ménage des photos passé — la photo du code vivant reste.
    await base.execute("UPDATE quiz_images SET created_at = 0")
    assert.equal((await ecrire(banc.url, `/api/quizzes/${id}`, {}, admin, 'DELETE')).status, 200)
    await new Promise(r => setTimeout(r, 300))
    assert.equal((await fetch(`${banc.url}${photo}`)).status, 200, 'protégée tant que le code vit')
  } finally {
    base.close()
  }

  // Annulé : le code ne mène plus à rien — et seul son propriétaire l'annule.
  assert.equal((await ecrire(banc.url, `/api/partages/${code}`, {}, voisin, 'DELETE')).status, 404)
  assert.equal((await ecrire(banc.url, `/api/partages/${code}`, {}, admin, 'DELETE')).status, 200)
  const perime = await ecrire(banc.url, '/api/partages/recevoir', { code }, voisin)
  assert.equal(perime.status, 410)
  assert.match(((await perime.json()) as any).error, /expiré ou a été annulé/)

  // Dix codes manqués par quart d'heure, pas un de plus.
  const inconnu = await ecrire(banc.url, '/api/partages/recevoir', { code: 'ZZZZZZ' }, voisin)
  assert.equal(inconnu.status, 404)
  for (let i = 0; i < 8; i++) await ecrire(banc.url, '/api/partages/recevoir', { code: 'ZZZZZZ' }, voisin)
  assert.equal((await ecrire(banc.url, '/api/partages/recevoir', { code: 'ZZZZZZ' }, voisin)).status, 429)
  // Les essais se comptent par espace : l'administrateur n'est pas bloqué.
  assert.equal((await ecrire(banc.url, '/api/partages/recevoir', { code: 'ZZZZZZ' }, admin)).status, 404)
})

test('le catalogue : une copie proposée, relue, publiée pour tous — retirée, elle disparaît', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const admin = await connexionAnimateur(banc.url)
  const nadia = await animateur(banc, admin, 'nadia', 'Nadia')
  const marc = await animateur(banc, admin, 'marc', 'Marc')
  const lire = async (chemin: string, c: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: c } })

  const id = await creerQuiz(banc.url, nadia, [qcm('Capitale du Canada ?', ['Ottawa', 'Toronto']), qcm('Plus long fleuve de France ?', ['La Loire', 'La Seine'])], 'Géo facile')
  assert.equal((await ecrire(banc.url, `/api/quizzes/${id}/catalogue`, { description: '' }, nadia)).status, 400, 'une phrase pour dire à quoi il sert')
  assert.equal((await ecrire(banc.url, `/api/quizzes/${id}/catalogue`, { description: 'Pour réviser' }, marc)).status, 404, 'on ne propose que les siens')
  const propose = await ecrire(banc.url, `/api/quizzes/${id}/catalogue`, { description: 'Deux questions pour s’échauffer.' }, nadia)
  assert.equal(propose.status, 201)
  const entree = (await propose.json()) as any
  assert.equal(entree.statut, 'propose')
  assert.equal(entree.auteur, 'Nadia')

  // Rien ne paraît avant d'être relu ; l'administrateur seul relit.
  assert.deepEqual(await (await lire('/api/catalogue', marc)).json(), [])
  assert.equal((await lire('/api/admin/catalogue', nadia)).status, 403)
  assert.equal((await ecrire(banc.url, `/api/catalogue/${entree.id}`, {}, marc)).status, 404, 'pas avant d’être publiée')
  const relue = (await (await lire(`/api/admin/catalogue/${entree.id}`, admin)).json()) as any
  assert.deepEqual(relue.questions.map((q: any) => q.text), ['Capitale du Canada ?', 'Plus long fleuve de France ?'])
  assert.equal((await ecrire(banc.url, `/api/admin/catalogue/${entree.id}`, { statut: 'publie' }, nadia)).status, 403)
  assert.equal((await ecrire(banc.url, `/api/admin/catalogue/${entree.id}`, { statut: 'publie' }, admin)).status, 200)

  const publie = (await (await lire('/api/catalogue', marc)).json()) as any[]
  assert.deepEqual(
    publie.map(e => [e.titre, e.auteur, e.questionCount, e.description]),
    [['Géo facile', 'Nadia', 2, 'Deux questions pour s’échauffer.']],
  )
  assert.equal(publie[0].questions, undefined, 'la liste ne livre pas les réponses')
  const copie = await ecrire(banc.url, `/api/catalogue/${entree.id}`, {}, marc)
  assert.equal(copie.status, 201)
  const quiz = (await copie.json()) as any
  assert.equal(quiz.title, 'Géo facile')
  assert.ok(((await (await lire('/api/quizzes', marc)).json()) as any[]).some(q => q.id === quiz.id), 'dans la bibliothèque de Marc')

  // Nadia retouche son quiz : la copie publiée ne bouge pas.
  await ecrire(banc.url, `/api/quizzes/${id}`, { title: 'Géo facile', questions: [qcm('Autre chose ?')] }, nadia, 'PUT')
  assert.equal(((await (await lire('/api/catalogue', marc)).json()) as any[])[0].questionCount, 2)

  // Retirée, elle ne se propose plus — et ne se copie plus.
  assert.equal((await ecrire(banc.url, `/api/admin/catalogue/${entree.id}`, { statut: 'retire' }, admin)).status, 200)
  assert.deepEqual(await (await lire('/api/catalogue', marc)).json(), [])
  assert.equal((await ecrire(banc.url, `/api/catalogue/${entree.id}`, {}, marc)).status, 404)
})

// ── Les modèles livrés ─────────────────────────────────────────────────────

const DOSSIER = new URL('../content/quiz/', import.meta.url)
const modeles = readdirSync(DOSSIER)
  .filter(f => f.endsWith('.json'))
  .map(f => ({ fichier: f, ...JSON.parse(readFileSync(new URL(f, DOSSIER), 'utf8')) }))

test('les modèles livrés : deux rayons, des jeux jouables tels quels, des fêtes à écrire', () => {
  assert.ok(modeles.length >= 10, `${modeles.length} modèles`)
  for (const m of modeles) {
    assert.ok(m.rayon === 'fete' || m.rayon === 'jeu', `${m.fichier} : un rayon`)
    assert.ok(typeof m.description === 'string' && m.description.length > 20, `${m.fichier} : une phrase qui dit à quoi il sert`)
    const questions = normalizeQuestions(m.questions)
    assert.equal(questions.length, m.questions.length, `${m.fichier} : chaque question se relit`)
    assert.ok(questions.length >= 8 && questions.length <= 15, `${m.fichier} : 8 à 15 questions`)
    const pretes = playableQuestions({ id: m.fichier, title: m.title, questions, updatedAt: 0 }).length
    if (m.rayon === 'jeu') {
      // Un jeu se joue tel quel : chaque fait porte sa source et sa catégorie.
      assert.equal(pretes, questions.length, `${m.fichier} : tout est prêt`)
      for (const q of m.questions) {
        assert.ok(typeof q.source === 'string' && q.source.length > 3, `${m.fichier} : « ${q.text} » a sa source`)
        assert.ok(CATEGORIES.includes(q.category), `${m.fichier} : « ${q.text} » a une catégorie de la liste`)
      }
      // La bonne réponse ne campe pas toujours sur la même case.
      const places = new Set(m.questions.filter((q: any) => q.kind !== 'number' && q.answers.length > 2).map((q: any) => q.correct))
      assert.ok(places.size !== 1, `${m.fichier} : la bonne réponse change de case`)
    } else {
      // Une fête s'écrit : rien ne se joue avant que l'animateur ait mis les vraies réponses.
      assert.equal(pretes, 0, `${m.fichier} : rien n’est prêt tant qu’on n’a pas écrit les réponses`)
    }
    for (const q of m.questions) {
      if (q.image) assert.ok(existsSync(new URL(`images/${q.image}`, DOSSIER)), `${m.fichier} : l’image ${q.image} est livrée`)
    }
  }
  // Le quiz de mémoire montre la photo qui disparaît.
  const memoire = modeles.find(m => m.fichier === 'memoire-photo.json')!
  assert.ok(memoire.questions.every((q: any) => q.image && q.observeSeconds > 0))
})

test('la bibliothèque de l’administrateur n’amorce que deux modèles ; les autres attendent « Partir d’un modèle »', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const admin = await connexionAnimateur(banc.url)
  const quizzes = (await (await fetch(`${banc.url}/api/quizzes`, { headers: { Cookie: admin } })).json()) as any[]
  assert.deepEqual(quizzes.map(q => q.id).sort(), ['culture-generale', 'qui-le-connait'])
  const proposes = (await (await fetch(`${banc.url}/api/modeles`, { headers: { Cookie: admin } })).json()) as any[]
  assert.equal(proposes.length, modeles.length)
  assert.equal(proposes[0].rayon, 'fete', 'la fête d’abord')
  const rayons = proposes.map(m => m.rayon).join(' ')
  assert.match(rayons, /^(fete )+(jeu ?)+$/, 'un rayon après l’autre')
  // Un modèle de couple se personnalise avec deux prénoms, partout.
  const mariage = await ecrire(banc.url, '/api/modeles/mariage', { prenoms: ['Léa', 'Sam'], accord: 'neutre' }, admin)
  assert.equal(mariage.status, 201)
  const quiz = (await mariage.json()) as any
  assert.equal(quiz.title, '💍 Le mariage de Léa et Sam')
  assert.doesNotMatch(JSON.stringify(quiz.questions), /\[Prénom/)
  assert.ok(quiz.questions.some((q: any) => q.answers.includes('Léa') && q.answers.includes('Sam')))
})
