// Ce qu'un quiz perdait en voyageant : copié en liste, publié au catalogue,
// exporté, dupliqué — et relu par la bibliothèque en mémoire.
//
// L'audit du 27 septembre 2026 (mission « bibliothèque », `retours/2026-09-27/`)
// l'a rejoué : une anecdote sur deux lignes devenue une réponse, « - de 5 »
// recollé en « de 5 », une question de côté revenue en jeu, un blind test
// recollé sans extrait mais prêt ; l'ancienne version d'un quiz restée au
// catalogue à côté de la nouvelle ; « Qui est ce bébé ? » exporté sans sa
// photo mais prêt ; une moitié d'emoji dans les CSV ; un « (copie) » tombé
// d'un titre long ; et la bibliothèque en mémoire remise à une version
// d'avant la correction par une relecture revenue en retard.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  attendre,
  connexionAnimateur,
  cookieDe,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  invite,
  lancerQuiz,
  patienter,
  qcm,
} from './banc'
import { QuizStore } from '../src/core/quizStore'
import { buildReview } from '../src/core/review'
import { exportFiles } from '../src/core/export'
import { MAX_TITRE, emptyQuestion, normalizeQuestions, parseImportedQuestions, toPlayable, type QuizDef, type QuizQuestionDef } from '../../shared/library'
import { CE_QUI_NE_VOYAGE_PAS, ecrireListe } from '../../shared/liste'
import { PHOTO_PERDUE, emporterQuiz, importerFichier } from '../../shared/echange'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA'
const PIECE = '/media/image/0f3c2a64-9d1e-4b8a-8f0e-5a1b2c3d4e5f'

const banc = await demarrer()
after(() => banc.close())
const cookie = await connexionAnimateur(banc.url)

const lire = async (id: string, c = cookie) => (await (await fetch(`${banc.url}/api/quizzes/${id}`, { headers: { Cookie: c } })).json()) as QuizDef
const envoyer = async (dataUrl: string) => ((await (await ecrire(banc.url, '/api/images', { dataUrl }, cookie)).json()) as { url: string }).url

/** Ce qu'« Enregistrer » garde de ces questions : le point de départ réel de « Copier en liste ». */
const enregistre = (qs: Partial<QuizQuestionDef>[]) => normalizeQuestions(qs.map(q => ({ ...emptyQuestion(), ...q })))
const recolle = (qs: QuizQuestionDef[]) => parseImportedQuestions(ecrireListe(qs)).questions

// ── 1. « Copier en liste », puis « Coller une liste » ─────────────────────

test('une anecdote ou une note sur plusieurs lignes se recolle sans devenir une réponse ni couper la question', () => {
  const [vrai, capitale, ordre] = enregistre([
    { text: 'La tour Eiffel devait être démontée.', answers: ['Vrai', 'Faux', '', ''], correct: 0, anecdote: 'Elle ne devait rester que vingt ans.\nLa radio l’a sauvée.' },
    { text: 'Quelle est la capitale de l’Australie ?', answers: ['Sydney', 'Canberra', 'Melbourne', 'Perth'], correct: 1, note: 'Demande à Julie.\n\nElle y a vécu deux ans.' },
    { text: 'Remettez ces inventions dans l’ordre.', variante: 'ordre', answers: ['L’imprimerie', 'La machine à vapeur', 'Le téléphone', ''], intertitre: 'Manche\ndeux' },
  ])
  assert.ok(vrai.anecdote?.includes('\n'), 'la zone de texte garde le retour à la ligne')
  const [a, b, c] = recolle([vrai, capitale, ordre])
  assert.deepEqual([a.answers, a.correct, a.anecdote], [['Vrai', 'Faux', '', ''], 0, 'Elle ne devait rester que vingt ans. La radio l’a sauvée.'])
  assert.deepEqual([b.text, b.answers, b.correct, b.note], [capitale.text, capitale.answers, 1, 'Demande à Julie. Elle y a vécu deux ans.'])
  assert.deepEqual([c.answers.filter(Boolean), c.intertitre], [['L’imprimerie', 'La machine à vapeur', 'Le téléphone'], 'Manche deux'])
})

test('« - de 5 », « + de 10 » et « Photo : la plage » se recollent tels quels, bonne réponse comprise', () => {
  const [q, r] = enregistre([
    { text: 'Combien de fois Julie a-t-elle déménagé ?', answers: ['- de 5', '5 à 10', '+ de 10', 'Photo : la plage'], correct: 2 },
    { text: 'Et Marc ?', answers: ['- de 5', '+ de 10', '', ''], correct: 0 },
  ])
  const [rq, rr] = recolle([q, r])
  assert.deepEqual([rq.answers, rq.correct], [q.answers, 2])
  assert.deepEqual([rr.answers, rr.correct], [r.answers, 0])
})

test('une question de côté reste de côté ; un blind test recollé sans son extrait se range de côté', () => {
  const [deCote, blind] = enregistre([
    { text: 'Trop dure pour ce soir ?', answers: ['a', 'b', '', ''], correct: 0, deCote: true },
    { text: 'Quel est ce titre ?', answers: ['Macarena', 'Mambo n° 5', '', ''], correct: 0, son: PIECE },
  ])
  const [a, b] = recolle([deCote, blind])
  assert.equal(a.deCote, true, 'de côté a voyagé')
  assert.equal(toPlayable(a), null)
  assert.equal(b.deCote, true, 'l’extrait ne voyage pas en texte : sans lui, le blind test ne se jouerait que muet')
  assert.equal(toPlayable(b), null)
})

test('la liste dit ce qui ne voyage pas en texte : les photos, celles de la révélation, les extraits', () => {
  assert.match(CE_QUI_NE_VOYAGE_PAS, /photos/)
  assert.match(CE_QUI_NE_VOYAGE_PAS, /révélation/)
  assert.match(CE_QUI_NE_VOYAGE_PAS, /extraits/)
  const editeur = readFileSync(new URL('../../client/src/views/EditorApp.tsx', import.meta.url), 'utf8')
  assert.match(editeur, /setAnnounce\(\s*faite\s*\?\s*`Liste copiée dans le presse-papiers\. \$\{CE_QUI_NE_VOYAGE_PAS\}`/)
})

// ── 2. Le catalogue ───────────────────────────────────────────────────────

test('publier la nouvelle version d’un quiz au catalogue retire l’ancienne', async () => {
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'nadia', name: 'Nadia', slug: 'chez-nadia' }, cookie)
  const { activation } = (await cree.json()) as { activation: { token: string } }
  const nadia = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'nadia-pass-1' }))
  const id = await creerQuiz(banc.url, nadia, [qcm('Capitale du Canada ?', ['Ottawa', 'Toronto'])], 'Géo facile')
  const v1 = (await (await ecrire(banc.url, `/api/quizzes/${id}/catalogue`, { description: 'Pour s’échauffer.' }, nadia)).json()) as { id: string }
  assert.equal((await ecrire(banc.url, `/api/admin/catalogue/${v1.id}`, { statut: 'publie' }, cookie)).status, 200)
  const q = await lire(id, nadia)
  await ecrire(banc.url, `/api/quizzes/${id}`, { title: q.title, questions: [...q.questions, qcm('Plus long fleuve de France ?', ['La Loire', 'La Seine'])] }, nadia, 'PUT')
  const v2 = (await (await ecrire(banc.url, `/api/quizzes/${id}/catalogue`, { description: 'Corrigé.' }, nadia)).json()) as { id: string }
  assert.notEqual(v2.id, v1.id)
  assert.equal((await ecrire(banc.url, `/api/admin/catalogue/${v2.id}`, { statut: 'publie' }, cookie)).status, 200)
  const publies = (await (await fetch(`${banc.url}/api/catalogue`, { headers: { Cookie: cookie } })).json()) as { titre: string; questionCount: number }[]
  assert.deepEqual(
    publies.map(e => [e.titre, e.questionCount]),
    [['Géo facile', 2]],
  )
})

// ── 3. L'export dont une pièce ne se lit plus ─────────────────────────────

test('un export dont une pièce ne se lit plus arrive sans elle, mais ne se dit pas prêt', async () => {
  const photo = await envoyer(PNG)
  const son = await envoyer(MP3)
  const original = {
    title: 'Bébés',
    questions: enregistre([
      { text: 'Qui est ce bébé ?', answers: ['Julie', 'Marc', '', ''], correct: 0, image: photo },
      { text: 'Quel est ce titre ?', answers: ['Macarena', 'Mambo n° 5', '', ''], correct: 0, son },
    ]),
  }
  const enClair = async (adresse: string) => {
    const res = await fetch(`${banc.url}${adresse}`)
    return `data:${res.headers.get('content-type')};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  }
  // Ni la photo ni l'extrait ne se lisent plus au départ.
  const fichier = JSON.parse(JSON.stringify(await emporterQuiz(original, async () => null)))
  const fait = await importerFichier(fichier, {
    envoyerPhoto: async d => ((await (await ecrire(banc.url, '/api/images', { dataUrl: d }, cookie)).json()) as { url: string }).url,
    creer: async (titre, questions, reglages) => (await (await ecrire(banc.url, '/api/quizzes', { title: titre, questions, reglages }, cookie)).json()) as QuizDef,
  })
  const [bebe, titre] = (await lire(fait.quiz[0].id)).questions
  assert.deepEqual([bebe.image, bebe.photoAttendue, toPlayable(bebe)], [null, PHOTO_PERDUE, null], '« Qui est ce bébé ? » attend son bébé')
  assert.deepEqual([titre.son ?? null, titre.deCote, toPlayable(titre)], [null, true, null], 'le blind test sans extrait se range de côté')
  // Un export qui se lit, lui, arrive prêt.
  const entier = await importerFichier(JSON.parse(JSON.stringify(await emporterQuiz(original, enClair))), {
    envoyerPhoto: async d => ((await (await ecrire(banc.url, '/api/images', { dataUrl: d }, cookie)).json()) as { url: string }).url,
    creer: async (titre, questions, reglages) => (await (await ecrire(banc.url, '/api/quizzes', { title: titre, questions, reglages }, cookie)).json()) as QuizDef,
  })
  assert.ok((await lire(entier.quiz[0].id)).questions.every(q => toPlayable(q) !== null))
})

// ── 4. Les coupes de texte ────────────────────────────────────────────────

test('les CSV coupent un titre long sans laisser de moitié d’emoji', () => {
  const titre = `${'a'.repeat(38)}🎂 et la suite`
  const review = buildReview({
    rows: [
      {
        sessionId: 's1', quizTitle: titre, qIndex: 0, kind: 'choice', playerId: 'p1', answered: true, correct: true, choice: 0,
        value: null, target: null, ms: 5000, changes: 0, points: 100, durationMs: 20000, observed: false, createdAt: 1, teamId: 't1',
      } as any,
    ],
    players: [{ id: 'p1', name: 'Alice', avatar: '🦊', teamId: 't1', score: 100, connected: false } as any],
    teams: [{ id: 't1', name: 'Rouges', emoji: '🍒', createdAt: 0 } as any],
    bonuses: [],
    packsBySession: new Map(),
    library: [],
  })
  const equipes = exportFiles(review).find(f => f.name === 'equipes.csv')!.content
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(equipes), 'aucune moitié d’emoji')
  assert.match(equipes, new RegExp(`${'a'.repeat(38)}🎂…`))
})

test('la copie d’un quiz au titre long se dit copie', async () => {
  const long = 'Le grand quiz de fin d’année de la famille Dupont-Martin, édition deux mille vingt-six'
  const id = await creerQuiz(banc.url, cookie, [qcm('Une ?')], long)
  const copie = (await (await ecrire(banc.url, `/api/quizzes/${id}/duplicate`, {}, cookie)).json()) as QuizDef
  assert.ok(copie.title.endsWith(' (copie)'), copie.title)
  assert.ok(Array.from(copie.title).length <= MAX_TITRE, copie.title)
})

// ── 5. La bibliothèque en mémoire ─────────────────────────────────────────

test('deux quiz enregistrés depuis deux appareils : « Lancer » joue la dernière version de chacun', async () => {
  const all = QuizStore.prototype.all
  try {
    const a = await creerQuiz(banc.url, cookie, [qcm('A, première version ?')], 'Quiz A')
    const b = await creerQuiz(banc.url, cookie, [qcm('Quelle est la capitale de l’Australie ?', ['Sydney', 'Canberra'], 0)], 'Quiz B')
    // La relecture qui suit l'enregistrement du portable part la première et
    // revient la dernière, avec ce qu'elle a lu avant la correction du téléphone.
    let lente = true
    QuizStore.prototype.all = async function (this: QuizStore, ...args: Parameters<typeof all>) {
      const lue = await all.apply(this, args)
      if (lente) {
        lente = false
        await patienter(400)
      }
      return lue
    }
    const portable = ecrire(banc.url, `/api/quizzes/${a}`, { title: 'Quiz A', questions: [qcm('A, deuxième version ?')] }, cookie, 'PUT')
    await patienter(50)
    const telephone = ecrire(banc.url, `/api/quizzes/${b}`, { title: 'Quiz B', questions: [qcm('Quelle est la capitale de l’Australie ?', ['Sydney', 'Canberra'], 1)] }, cookie, 'PUT')
    assert.equal((await telephone).status, 200)
    assert.equal((await portable).status, 200)
    QuizStore.prototype.all = all
    await patienter(500)

    const tele = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊')
    const sessionId = await lancerQuiz(tele, b)
    await attendre<any>(tele, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question', 'la question', 15_000)
    const revelee = attendre<any>(tele, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'reveal', 'la révélation', 15_000)
    ;(alice.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: 1 } }, () => {})
    assert.equal((await revelee).view.correct, 1, 'le quiz B lancé est celui de la correction')
    ;(tele as any).emit('host:endSession', { sessionId })
    alice.socket.close()
    tele.close()
  } finally {
    QuizStore.prototype.all = all
  }
})

// ── 6. Le clic resté sans réponse ─────────────────────────────────────────

test('un « Enregistrer » resté sans réponse : le clic suivant reprend son jeton, sans faux conflit', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Une ?')], 'Réveil')
  const ouvert = await lire(id)
  const put = (corps: Record<string, unknown>) => ecrire(banc.url, `/api/quizzes/${id}`, corps, cookie, 'PUT')
  // Le premier clic écrit, mais sa réponse se perd pendant le réveil de l'hébergeur.
  assert.equal((await put({ title: 'Réveil', questions: [qcm('Une, retouchée ?')], base: ouvert.updatedAt, jeton: 'clic-1', essai: 1 })).status, 200)
  // Le clic suivant repart de la version d'où partait le premier : avec un
  // jeton neuf, le serveur y voyait un autre appareil…
  assert.equal((await put({ title: 'Réveil', questions: [qcm('Une, encore ?')], base: ouvert.updatedAt, jeton: 'clic-2', essai: 1 })).status, 409)
  // … avec le même jeton, et la suite de ses essais, il reconnaît son propre enregistrement.
  const repris = await put({ title: 'Réveil', questions: [qcm('Une, encore ?')], base: ouvert.updatedAt, jeton: 'clic-1', essai: 2 })
  assert.equal(repris.status, 200)
  assert.equal(((await repris.json()) as QuizDef).questions[0].text, 'Une, encore ?')
  // Et l'éditeur garde ce jeton tant que le serveur n'a pas répondu.
  const editeur = readFileSync(new URL('../../client/src/views/EditorApp.tsx', import.meta.url), 'utf8')
  assert.match(editeur, /const jeton = enSuspens\.current\?\.jeton \?\? newQuestionId\(\)\s*\n\s*let essai = enSuspens\.current\?\.essai \?\? 0/)
  assert.match(editeur, /if \(refusDuServeur\(e\)\) enSuspens\.current = null/)
})

// ── 7. Les recherches croisées ────────────────────────────────────────────

test('une recherche revenue en retard ne remplace pas la liste de la recherche suivante', () => {
  // Sous « france », la liste de « fr » : une recherche courte, plus lente,
  // revenait après la longue. Pas de navigateur ici : la mécanique se lit.
  for (const fichier of ['views/EditorApp.tsx', 'components/AdminDuJour.tsx']) {
    const source = readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
    assert.match(source, /let perimee = false[\s\S]{0,400}!perimee && setTrouves\([\s\S]{0,200}perimee = true/, fichier)
  }
})
