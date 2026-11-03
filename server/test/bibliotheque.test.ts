// La bibliothèque (rapport du 25 septembre 2026, lot 4) : retrouver un quiz
// parmi quarante par ce qu'il contient — sans rien avoir à saisir de plus —,
// le ranger à l'écart sans le perdre, et tout emporter d'un seul fichier.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { dureeEstimeeS, normalizeQuestions, pourChercher, rechercherDans, resumerQuiz, type QuizDef, type QuizSummary } from '../../shared/library'
import { tronquer } from '../../shared/avatars'
import { FORMAT_BIBLIOTHEQUE, emporterBibliotheque, importerFichier, nomDeBibliotheque } from '../../shared/echange'
import {
  attendre,
  connexionAnimateur,
  cookieDe,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  estimation,
  qcm,
  type Banc,
} from './banc'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const quizDe = (title: string, questions: unknown[], extra: Partial<QuizDef> = {}): QuizDef => ({
  id: title,
  title,
  questions: normalizeQuestions(questions),
  updatedAt: 1,
  ...extra,
})

const bancs: Banc[] = []
after(async () => {
  for (const b of bancs) await b.close()
})

// ── Ce que la liste dérive des questions ───────────────────────────────────

test('le résumé d’un quiz se dérive de ses questions : photos, estimations, catégories, durée', () => {
  const quiz = quizDe('Années 90', [
    { kind: 'choice', text: 'Qui chantait la Macarena ?', answers: ['Los del Río', 'Ricky Martin'], correct: 0, category: 'Musique', image: '/media/image/a' },
    { kind: 'choice', text: 'Le Tamagotchi vient de…', answers: ['Japon', 'Corée'], correct: 0, category: 'Jeux & pop culture' },
    { kind: 'number', text: 'Année de sortie de Titanic ?', target: 1997, category: 'Cinéma & séries' },
    { kind: 'choice', text: 'Qui chantait Wannabe ?', answers: ['Spice Girls', 'All Saints'], correct: 0, category: 'Musique' },
    // Une photo seulement annoncée : la question est à compléter, pas illustrée.
    { kind: 'choice', text: 'Qui est sur la photo ?', answers: ['Moi', 'Toi'], correct: 0, photoAttendue: 'photo-de-classe.jpg' },
  ])
  const r = resumerQuiz(quiz)
  assert.equal(r.questionCount, 5)
  assert.equal(r.readyCount, 4)
  assert.equal(r.photos, 1)
  assert.equal(r.estimations, 1)
  assert.deepEqual(r.categories, ['Musique', 'Cinéma & séries', 'Jeux & pop culture'], 'la plus fréquente d’abord, puis l’alphabet')
  assert.equal(r.dureeS, dureeEstimeeS(quiz.questions))
  assert.equal(r.archivedAt, null)
  assert.equal(resumerQuiz({ ...quiz, archivedAt: 42 }).archivedAt, 42)
})

test('la recherche lit le titre, les intitulés et les réponses — sans casse, sans accent, dans n’importe quel ordre', () => {
  const quiz = quizDe('Spécial années 90', [
    { kind: 'choice', text: 'Qui chantait la Macarena ?', answers: ['Los del Río', 'Ricky Martin'], correct: 0 },
    { kind: 'number', text: 'Combien de Tamagotchi vendus ?', target: 82, unit: 'millions' },
    { kind: 'choice', text: '', answers: ['Zinedine', 'Fabien'], correct: 0 },
  ])
  assert.equal(pourChercher('  Élève  L’ÉTÉ '), "eleve l'ete")
  assert.equal(rechercherDans(quiz, ''), true, 'rien à chercher : tout se garde')
  assert.equal(rechercherDans(quiz, 'SPECIAL 90'), true, 'le titre, sans accent ni casse')
  assert.equal(rechercherDans(quiz, 'macarena'), 'Qui chantait la Macarena ?', 'l’intitulé qui l’a fait trouver')
  assert.equal(rechercherDans(quiz, 'rio los'), 'Qui chantait la Macarena ?', 'une réponse, les mots dans le désordre')
  assert.equal(rechercherDans(quiz, 'millions'), 'Combien de Tamagotchi vendus ?', 'l’unité d’une estimation')
  assert.equal(rechercherDans(quiz, 'zinedine'), true, 'une question sans intitulé trouve son quiz sans rien citer')
  assert.equal(rechercherDans(quiz, 'macarena titanic'), null, 'chaque mot doit y être')
  assert.equal(rechercherDans(quiz, 'pokemon'), null)
})

// ── Tout emporter, tout reprendre ──────────────────────────────────────────

test('une bibliothèque entière s’emporte en un fichier et se relit — titres dédoublonnés, photos envoyées une fois', async () => {
  const photo = '/media/image/p1'
  const quizzes = [
    { title: 'Blind test', questions: normalizeQuestions([{ ...qcm('Qui chante ?'), image: photo }]), reglages: { melangerReponses: true } },
    { title: 'Blind test', questions: normalizeQuestions([{ ...qcm('Et là ?'), image: photo }]) },
    { title: 'Géographie', questions: normalizeQuestions([estimation('Hauteur de l’Everest ?', 8849, 'm')]) },
  ]
  const avancees: string[] = []
  const fichier = await emporterBibliotheque(quizzes, async () => PNG, (faits, total) => avancees.push(`${faits}/${total}`))
  assert.equal(fichier.format, FORMAT_BIBLIOTHEQUE)
  assert.equal(fichier.quiz.length, 3)
  assert.deepEqual(avancees, ['1/3', '2/3', '3/3'])
  assert.equal(fichier.quiz[0].questions[0].image, PNG, 'la photo voyage en clair')
  assert.deepEqual(fichier.quiz[0].reglages, { melangerReponses: true })

  // Un quiz abîmé dans le fichier se compte, sans arrêter les autres.
  const relu = JSON.parse(JSON.stringify({ ...fichier, quiz: [...fichier.quiz, { format: 'autre chose' }] }))
  const envois: string[] = []
  const crees: { titre: string; questions: number; reglages: unknown }[] = []
  const fait = await importerFichier(relu, {
    envoyerPhoto: async enClair => {
      envois.push(enClair)
      return `/media/image/neuve-${envois.length}`
    },
    creer: async (titre, questions, reglages) => {
      crees.push({ titre, questions: questions.length, reglages })
      return { title: titre }
    },
    titresPris: ['Géographie'],
  })
  assert.deepEqual(
    crees.map(c => c.titre),
    ['Blind test', 'Blind test (2)', 'Géographie (2)'],
    'deux quiz du même nom dans le fichier ne se confondent pas, ni avec la bibliothèque',
  )
  assert.deepEqual(crees[0].reglages, { melangerReponses: true }, 'les réglages suivent chaque quiz')
  assert.equal(envois.length, 1, 'la photo commune à deux quiz ne s’envoie qu’une fois')
  assert.equal(fait.photos, 1)
  assert.equal(fait.questions, 3)
  assert.equal(fait.illisibles, 1)
  assert.equal(fait.quiz.length, 3)

  // Un quiz seul passe par le même chemin.
  const seul = await importerFichier(relu.quiz[2], {
    envoyerPhoto: async () => 'x',
    creer: async titre => ({ title: titre }),
  })
  assert.deepEqual(seul.quiz, [{ title: 'Géographie' }])

  await assert.rejects(
    importerFichier({ format: FORMAT_BIBLIOTHEQUE, version: 99, quiz: [] }, { envoyerPhoto: async () => 'x', creer: async () => ({}) }),
    /version plus récente/,
  )
  await assert.rejects(
    importerFichier({ format: FORMAT_BIBLIOTHEQUE, version: 1, quiz: [{ format: 'rien' }] }, { envoyerPhoto: async () => 'x', creer: async () => ({}) }),
    /Aucun quiz de cette bibliothèque ne se lit/,
  )
  assert.equal(nomDeBibliotheque(new Date(2026, 8, 5)), 'mes-quiz-2026-09-05.bibliotheque.json')
})

// ── Le serveur : chercher, archiver, chacun chez soi ──────────────────────

test('chercher et archiver : chez soi seulement, et un quiz archivé ne se propose plus à la soirée', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const lire = async (chemin: string, c = cookie) => (await fetch(`${banc.url}${chemin}`, { headers: { Cookie: c } })).json() as Promise<any>
  const annees90 = await creerQuiz(
    banc.url,
    cookie,
    [qcm('Qui chantait la Macarena ?', ['Los del Río', 'Ricky Martin']), estimation('Tamagotchi vendus ?', 82, 'millions')],
    'Années 90',
  )
  const cinema = await creerQuiz(banc.url, cookie, [qcm('Qui a réalisé Titanic ?', ['Cameron', 'Spielberg'])], 'Cinéma')

  const tous = await lire('/api/quizzes')
  const resume = tous.find((q: any) => q.id === annees90)
  assert.equal(resume.estimations, 1)
  assert.equal(resume.readyCount, 2)
  assert.ok(resume.dureeS > 0)

  const trouves = await lire(`/api/quizzes?q=${encodeURIComponent('macaréna')}`)
  assert.deepEqual(
    trouves.map((q: any) => [q.id, q.trouve]),
    [[annees90, 'Qui chantait la Macarena ?']],
    'la recherche lit les intitulés, et dit lequel',
  )
  assert.deepEqual((await lire('/api/quizzes?q=cinema')).map((q: any) => [q.id, q.trouve]), [[cinema, undefined]], 'un titre ne cite rien')

  // Le voisin ne trouve rien chez nous, et n'archive rien.
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'voisin', name: 'Voisin', slug: 'chez-le-voisin' }, cookie)
  const { activation } = (await cree.json()) as { activation: { token: string } }
  const voisin = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'voisin-pass-1' }))
  assert.deepEqual(await lire('/api/quizzes?q=macarena', voisin), [], 'la recherche ne sort pas de l’espace')
  assert.equal((await ecrire(banc.url, `/api/quizzes/${annees90}/archive`, { archive: true }, voisin)).status, 404)

  // Archivé : il reste dans la liste, marqué, à sa place — et sort du choix de la soirée.
  const avant = (await lire('/api/quizzes')).find((q: any) => q.id === annees90)
  assert.equal((await ecrire(banc.url, `/api/quizzes/${annees90}/archive`, { archive: true }, cookie)).status, 200)
  const apres = (await lire('/api/quizzes')).find((q: any) => q.id === annees90)
  assert.ok(apres.archivedAt > 0, 'le quiz est marqué archivé')
  assert.equal(apres.updatedAt, avant.updatedAt, 'archiver ne le fait pas remonter comme une modification')
  assert.ok((await lire(`/api/quizzes/${annees90}`)).archivedAt > 0)

  const host = await ecranCommun(banc.url, cookie)
  const choix = attendre<any>(host, 'session:view', p => p.view.phase === 'pickPack', 'la liste des quiz')
  ;(host as any).emit('host:launch')
  const propose = (await choix).view.packs.map((p: any) => p.id)
  assert.ok(propose.includes(cinema))
  assert.ok(!propose.includes(annees90), 'un quiz archivé ne se propose plus à la soirée')
  host.close()

  // Ressorti, il revient.
  assert.equal((await ecrire(banc.url, `/api/quizzes/${annees90}/archive`, { archive: false }, cookie)).status, 200)
  assert.equal((await lire('/api/quizzes')).find((q: any) => q.id === annees90).archivedAt, null)
  const host2 = await ecranCommun(banc.url, cookie)
  const choix2 = attendre<any>(host2, 'session:view', p => p.view.phase === 'pickPack', 'la liste des quiz')
  ;(host2 as any).emit('host:launch')
  assert.ok((await choix2).view.packs.some((p: any) => p.id === annees90), 'ressorti, il se propose de nouveau')
  host2.close()
})

// ── Ce que « Mes quiz » relit ───────────────────────────────────────────────

/** Ce que la base permanente a rendu pendant une mesure : chaque instruction, ses colonnes et ses lignes. */
const espion = { actif: false, lus: [] as { sql: string; colonnes: string[]; lignes: number }[] }
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    if (!espion.actif) return origine.apply(this, args)
    const sqls = (methode === 'batch' ? (args[0] as unknown[]) : [args[0]]).map(s => (typeof s === 'string' ? s : (s as { sql: string }).sql).replace(/\s+/g, ' ').trim())
    return origine.apply(this, args).then(r => {
      const resultats = (methode === 'batch' ? r : [r]) as ({ columns?: string[]; rows?: unknown[] } | undefined)[]
      resultats.forEach((x, i) => espion.lus.push({ sql: sqls[i], colonnes: x?.columns ?? [], lignes: x?.rows?.length ?? 0 }))
      return r
    })
  }
}

// « Mes quiz » relisait toutes les questions de la bibliothèque à chaque
// ouverture, puis les normalisait et les résumait d'une traite : 420 Ko et
// 1 160 questions pour la plus grosse de la production, et la sonde des gels
// relevait la page seule pendant des gels de 1,5 à 2,4 s, au dixième de cœur
// de l'hébergeur (le 3 novembre 2026). Le résumé de chaque quiz se garde sous
// sa version : seules se relisent les questions de ceux qui ont changé — ici,
// ou sur l'autre serveur d'une mise en ligne.
test('« Mes quiz » ne relit les questions que des quiz qui ont changé, et dit chacun tel qu’il est', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const lire = async (chemin: string) => (await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })).json() as Promise<any>
  const ids: string[] = []
  for (let i = 0; i < 4; i++) ids.push(await creerQuiz(banc.url, cookie, [qcm(`Question ${i} ?`, ['Oui', 'Non']), estimation(`Combien ${i} ?`, 40 + i)], `Quiz ${i}`))
  /** La liste, et ce que sa lecture a relu des questions : les quiz dont elle a rendu la colonne. */
  const laListe = async () => {
    Object.assign(espion, { actif: true, lus: [] })
    try {
      const liste = (await lire('/api/quizzes')) as (QuizSummary & { id: string })[]
      const questionsRelues = espion.lus.filter(l => l.colonnes.includes('questions')).reduce((n, l) => n + l.lignes, 0)
      const soireesRelues = espion.lus.filter(l => /\bFROM soirees\b/.test(l.sql)).length
      return { liste, questionsRelues, soireesRelues }
    } finally {
      espion.actif = false
    }
  }
  /** La liste sans ce que l'historique en dit (`joue`) : ce que le résumé seul doit dire. */
  const sansLaMemoire = (liste: (QuizSummary & { id: string })[]) => new Map(liste.map(({ joue: _joue, ...q }) => [q.id, q]))
  /** Chaque quiz tel qu'il est, résumé de zéro : ce que la liste doit dire. */
  const attendus = async () => {
    const resumes = new Map<string, QuizSummary>()
    for (const q of (await lire('/api/quizzes')) as { id: string }[]) resumes.set(q.id, resumerQuiz(await lire(`/api/quizzes/${q.id}`)))
    return resumes
  }

  // Une soirée d'hier, qui a joué le premier : son historique le dit « joué une fois ».
  const hier = Date.now() - 86_400_000
  const ecrite = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const { space_id: espace } = ecrite.prepare('SELECT space_id FROM quizzes WHERE id = ?').get(ids[0]) as { space_id: string }
    ecrite
      .prepare('INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(espace, 'soiree-d-hier', 'Hier', hier, hier, JSON.stringify({ v: 3, invites: [], jeux: [{ quizId: ids[0], questions: [] }] }), '{}')
  } finally {
    ecrite.close()
  }

  // Au réveil, la bibliothèque relue au démarrage pour la console a résumé chaque quiz au passage, et l'historique
  // relu pour le tirage des questions a gardé la mémoire de chaque espace : la première ouverture ne relit ni l'un ni l'autre.
  await banc.redemarrer()
  const auReveil = await laListe()
  assert.equal(auReveil.questionsRelues, 0, 'la première ouverture d’un réveil ne relit aucune question')
  assert.deepEqual(auReveil.soireesRelues, 0, 'ni son historique')
  assert.deepEqual(auReveil.liste.find(q => q.id === ids[0])?.joue, { fois: 1, dernier: hier }, 'ce que l’historique en sait')
  const resumes = await attendus()
  assert.ok(resumes.size >= 4, 'les quatre quiz, et ceux que la bibliothèque reçoit à sa naissance')
  assert.deepEqual(sansLaMemoire(auReveil.liste), resumes, 'chacun résumé comme de zéro')

  // Enregistré ici : l'enregistrement relit la bibliothèque pour la console, et la liste qui suit ne relit rien.
  const modifie = await lire(`/api/quizzes/${ids[0]}`)
  const enregistre = await ecrire(banc.url, `/api/quizzes/${ids[0]}`, { title: 'Quiz zéro', questions: [...modifie.questions, qcm('Une de plus ?')], base: modifie.updatedAt }, cookie, 'PUT')
  assert.equal(enregistre.status, 200)
  const apresEnregistrement = await laListe()
  assert.equal(apresEnregistrement.questionsRelues, 0, 'l’enregistrement a déjà résumé le quiz')
  assert.deepEqual(
    [apresEnregistrement.liste[0].id, apresEnregistrement.liste[0].title, apresEnregistrement.liste[0].questionCount],
    [ids[0], 'Quiz zéro', 3],
    'remonté en tête, son nouveau titre et sa question de plus',
  )

  // Archivé : sa version ne bouge pas, et la liste le dit pourtant archivé.
  assert.equal((await ecrire(banc.url, `/api/quizzes/${ids[1]}/archive`, { archive: true }, cookie)).status, 200)
  const archive = await laListe()
  assert.equal(archive.questionsRelues, 0)
  assert.ok((archive.liste.find(q => q.id === ids[1])?.archivedAt ?? 0) > 0, 'archivé, sans relire ses questions')

  // Enregistré par l'autre serveur d'une mise en ligne, sans que celui-ci le sache : seules ses questions se relisent.
  const autre = await lire(`/api/quizzes/${ids[2]}`)
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    db.prepare('UPDATE quizzes SET title = ?, questions = ?, updated_at = ? WHERE id = ?').run(
      'Quiz deux, d’ailleurs',
      JSON.stringify(normalizeQuestions([...autre.questions, qcm('Ailleurs ?'), qcm('Encore ?')])),
      autre.updatedAt + 1,
      ids[2],
    )
  } finally {
    db.close()
  }
  const ailleurs = await laListe()
  assert.equal(ailleurs.questionsRelues, 1, 'les questions du seul quiz qui a changé')
  assert.deepEqual(sansLaMemoire(ailleurs.liste), await attendus(), 'chacun tel qu’il est, le quiz changé ailleurs compris')
  assert.equal(ailleurs.liste.find(q => q.id === ids[2])?.questionCount, 4)

  // Effacé : il quitte la liste.
  assert.equal((await ecrire(banc.url, `/api/quizzes/${ids[3]}`, {}, cookie, 'DELETE')).status, 200)
  assert.ok(!(await laListe()).liste.some(q => q.id === ids[3]))
})

// `normalizeQuestions` passe chaque champ de chaque question par `tronquer`, à
// chaque relecture d'une bibliothèque — au démarrage, après chaque écriture :
// découper en points de code des milliers de textes déjà courts en prenait la
// moitié. Sous la borne en unités UTF-16, le texte y est en points de code :
// il se rend tel quel. La coupe, elle, ne change pas — comparée ici à
// `tronquer` d'avant, recopiée telle qu'elle était, sur des textes au hasard.
test('tronquer rend ce qu’il rendait, sans découper un texte déjà court', () => {
  const avant = (texte: string, max: number): string => {
    const points = Array.from(texte)
    if (points.length <= max) return texte
    if (typeof Intl.Segmenter !== 'function') return points.slice(0, max).join('')
    let garde = ''
    let compte = 0
    for (const { segment } of new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(texte)) {
      const n = Array.from(segment).length
      if (compte + n > max) break
      garde += segment
      compte += n
    }
    return garde || points.slice(0, max).join('')
  }
  const MORCEAUX = ['a', 'é', 'e\u0301', ' ', '中', '🎉', '👍🏽', '🇫🇷', '👨‍👩‍👧', 'x\u0301\u0302\u0303']
  let g = 7
  const hasard = () => (g = (g * 16807) % 2147483647) / 2147483647
  for (let k = 0; k < 4000; k++) {
    const texte = Array.from({ length: Math.floor(hasard() * 30) }, () => MORCEAUX[Math.floor(hasard() * MORCEAUX.length)]).join('')
    const max = Math.floor(hasard() * 40)
    assert.equal(tronquer(texte, max), avant(texte, max), `${JSON.stringify(texte)} coupé à ${max}`)
  }
})
