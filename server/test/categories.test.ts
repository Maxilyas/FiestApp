// Les catégories de questions : de l'éditeur à la fiche du joueur.
//
// « Je suis nul en sport » n'était qu'une impression : aucune question ne
// disait de quoi elle parlait. Chaque question peut maintenant porter une
// catégorie, prise dans une liste fixe — la même chez tous les animateurs —,
// que le journal garde, le miroir aussi, et que la fiche d'un joueur
// additionne d'une soirée à l'autre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
} from './banc'
import { normalizeQuestions, parseImportedQuestions, toPlayable } from '../../shared/library'
import { categorieDe } from '../../shared/categories'

// ── 1. La liste, l'import, l'enregistrement ───────────────────────────────

test('une catégorie se reconnaît sans accent ni majuscule, et par son début', () => {
  assert.equal(categorieDe('Cinéma & séries'), 'Cinéma & séries')
  assert.equal(categorieDe('cinema'), 'Cinéma & séries')
  assert.equal(categorieDe('MUSIQUE'), 'Musique')
  assert.equal(categorieDe('Jeux'), 'Jeux & pop culture')
  assert.equal(categorieDe('science'), 'Sciences')
  assert.equal(categorieDe('Astrologie'), null, 'une catégorie qui n’est pas dans la liste n’en est pas une')
  assert.equal(categorieDe(''), null)
  assert.equal(categorieDe(42), null)
})

test('à l’import, une ligne « # Cinéma » range les questions qui suivent', () => {
  const { questions, ignored } = parseImportedQuestions(`# Cinéma

Qui a réalisé Alien ?
* Ridley Scott
James Cameron

En quelle année sort Titanic ?
= 1997

# Musique
Qui chante Thriller ?
* Michael Jackson
Prince

#
Sans catégorie ?
* Oui
Non

# Astrologie
Un signe ?
* Lion
Vierge`)
  assert.deepEqual(
    questions.map(q => q.category),
    ['Cinéma & séries', 'Cinéma & séries', 'Musique', null, null],
    'le dièse seul remet à zéro ; une catégorie inconnue aussi',
  )
  assert.equal(ignored, 1, 'la catégorie inconnue se signale')
  assert.equal(toPlayable(questions[0])?.category, 'Cinéma & séries', 'la catégorie passe dans la question jouée')
})

test('une question qui commence par un dièse reste une question', () => {
  const { questions, ignored } = parseImportedQuestions(`#1 des ventes en 1985 ?
* Nena
Madonna

#Musique
Qui chante Thriller ?
* Michael Jackson
Prince`)
  assert.equal(questions.length, 2)
  assert.equal(questions[0].text, '#1 des ventes en 1985 ?')
  assert.equal(questions[0].category, null)
  assert.equal(questions[1].category, 'Musique', 'collé au dièse, un nom de la liste reste une catégorie')
  assert.equal(ignored, 0)
})

test('le serveur ne garde que les catégories de la liste', () => {
  const [bonne, inventee, sans] = normalizeQuestions([
    { text: 'Un ?', answers: ['a', 'b'], category: 'musique' },
    { text: 'Deux ?', answers: ['a', 'b'], category: 'Astrologie' },
    { text: 'Trois ?', answers: ['a', 'b'] },
  ])
  assert.equal(bonne.category, 'Musique')
  assert.equal(inventee.category, null)
  assert.equal(sans.category, null, 'les quiz d’avant les catégories restent sans')
})

// ── 2. Du quiz à la fiche du joueur ───────────────────────────────────────

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

const lire = <T = any>(chemin: string, sql: string) => {
  const db = new Database(chemin, { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all() as T[]
  } finally {
    db.close()
  }
}

test('la catégorie passe par le journal et le miroir, et la fiche du joueur l’additionne', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [
      { ...qcm('Qui a réalisé Alien ?'), category: 'Cinéma & séries' },
      { ...qcm('Qui a réalisé Titanic ?'), category: 'Cinéma & séries' },
      { ...qcm('Qui chante Thriller ?'), category: 'Musique' },
    ])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle = [await invite(banc.url, 'Bob', '🐻'), await invite(banc.url, 'Dora', '🐙')]

    // Alice trouve les deux questions de cinéma, et se trompe en musique.
    // Le crédit arrive au podium, parfois dans le même paquet que lui.
    const creditee = attendre(alice.socket, 'player:profil', (p: any) => p.xp > 0, 'le crédit du podium', 30_000)
    const sessionId = await lancerQuiz(host, quiz)
    const vue = (pred: (v: any) => boolean, label: string) =>
      attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
    for (let q = 0; q < 3; q++) {
      const question = await vue(v => v.phase === 'question' && v.qIndex === q, `la question ${q + 1}`)
      assert.equal(question.view.category, ['Cinéma & séries', 'Cinéma & séries', 'Musique'][q], 'l’écran commun l’affiche')
      const revelee = vue(v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
      const reponses: [Invite, number][] = [[alice, q < 2 ? 0 : 1], ...salle.map((i): [Invite, number] => [i, 1])]
      for (const [qui, choice] of reponses) {
        assert.equal((await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })).ok, true)
      }
      await revelee
      ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
    }
    await vue(v => v.phase === 'finished', 'le podium')
    await creditee

    const moi = (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: aliceCookie } })).json()) as any
    assert.deepEqual(moi.profile.categories, {
      'Cinéma & séries': { questions: 2, justes: 2 },
      Musique: { questions: 1, justes: 0 },
    })

    // Le miroir la garde : un réveil sur disque effacé la retrouve.
    await patienter(400)
    const miroir = lire<{ category: string | null }>(
      banc.quizDbUrl.replace(/^file:/, ''),
      'SELECT DISTINCT category FROM party_answers ORDER BY category',
    )
    assert.deepEqual(miroir.map(r => r.category), ['Cinéma & séries', 'Musique'])
    await banc.redemarrer({ disqueEfface: true })
    const locales = lire<{ category: string | null }>(banc.dbPath, 'SELECT DISTINCT category FROM answer_log ORDER BY category')
    assert.deepEqual(locales.map(r => r.category), ['Cinéma & séries', 'Musique'], 'le réveil rend les catégories au journal')
  }))
