// Que la soirée et le quiz du jour se parlent.
//
// L'audit du 27 septembre 2026 (`retours/2026-09-27/`, axe 13) : le lien
// `/jour` reçu par un anonyme n'offrait que « Me connecter à mon profil » ;
// le lendemain s'ouvrait sur « 3ᵉ place sur 3 · 0 pt » ; la fin de soirée ne
// disait rien du quiz du jour, ni la fin de partie de la montée de niveau
// qu'elle venait de faire ; la série ne prévenait jamais qu'elle tombe à
// minuit ; la carte, seule vitrine des cosmétiques, ne se voyait qu'en
// soirée.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { placeDuJour } from '../../shared/course'
import { finLisible } from '../../shared/fin'
import { GLOSSAIRE } from '../../shared/glossaire'
import { pageDeRetour } from '../../shared/securite'

// L'Éclat est un tirage : il ferait tomber un palier une fois sur quarante.
ProfileStore.tirageEclat = () => false

/** Une source du client, telle qu'on l'écrit. */
const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Le tirage du jour, lu en base : les bonnes réponses que le téléphone ne voit jamais. */
function tirage(banc: Banc, jour: string): { bonne: number }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const r = db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string } | undefined
    return r ? JSON.parse(r.questions) : []
  } finally {
    db.close()
  }
}

// ── Le rang du quiz du jour, dit comme la course ──────────────────────────

test('le rang du quiz du jour se dit comme la course : jamais à zéro point, « sur N » à la moitié haute', () => {
  assert.equal(placeDuJour(3, 3, 0), null, 'le lendemain ne s’ouvre plus sur « 3ᵉ place sur 3 · 0 pt »')
  assert.equal(placeDuJour(0, 12, 450), null)
  assert.equal(placeDuJour(1, 3, 1800), '1ʳᵉ place sur 3')
  assert.equal(placeDuJour(3, 3, 200), '3ᵉ place', 'le podium se dit, pas « dernier »')
  assert.equal(placeDuJour(5, 23, 900), '5ᵉ place sur 23')
  assert.equal(placeDuJour(87, 100, 300), null, 'à cent joueurs, pas de « 87ᵉ place sur 100 » en titre')
  // Les quatre endroits qui l'écrivaient passent par elle.
  for (const f of ['views/JourApp.tsx', 'components/Jour.tsx']) {
    const s = source(f)
    assert.doesNotMatch(s, /place\(\w+\.rang\)\}? sur/, `${f} écrit encore son rang à la main`)
    assert.match(s, /placeDuJour\(/)
  }
})

// ── Le lien /jour reçu par un anonyme ─────────────────────────────────────

test('le lien /jour d’un anonyme mène à la création d’un profil, puis au quiz', () => {
  const jour = source('views/JourApp.tsx')
  assert.match(jour, /href="\/\?creer=1&next=\/jour"/)
  assert.match(jour, /Créer mon profil et jouer/)
  assert.match(jour, /href="\/\?next=\/jour"/)
  assert.doesNotMatch(jour, /la réserve de questions/, '« la réserve » est un mot d’administration')
  // L'accueil y retourne une fois connecté, jamais ailleurs que chez soi.
  const profil = source('views/ProfilApp.tsx')
  assert.match(profil, /pageDeRetour\(next, window\.location\.origin, ''\)/)
  assert.match(profil, /if \(suite\) return window\.location\.assign\(suite\)/)
  assert.equal(pageDeRetour('/jour', 'https://fiestapp.example', ''), '/jour')
  assert.equal(pageDeRetour('https://ailleurs.example/jour', 'https://fiestapp.example', ''), '')
  // Et « Mon compte » mène à la création, qui y ramène.
  assert.match(source('views/AccountApp.tsx'), /href="\/\?creer=1&next=\/compte"/)
})

// ── Le quiz du jour : la série, la montée de niveau ───────────────────────

test('la partie dit sa montée de niveau, et la série sait si aujourd’hui compte déjà', async () => {
  const banc = await demarrer()
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const avant = (await lire(banc, alice, '/api/jour')).corps
    assert.equal(avant.etat, 'a-jouer')
    assert.equal(avant.serieTenue, false, 'rien joué aujourd’hui : minuit casserait la série')

    let etat = (await poster(banc, alice, '/api/jour/commencer')).corps
    assert.equal((await lire(banc, alice, '/api/jour')).corps.serieTenue, true, 'une partie commencée tient la série')
    const questions = tirage(banc, etat.jour)
    while (etat.question) {
      const i = etat.question.index
      const r = await poster(banc, alice, '/api/jour/repondre', { jour: etat.jour, index: i, choix: questions[i].bonne })
      assert.equal(r.status, 200, r.corps.error)
      etat = (await poster(banc, alice, '/api/jour/suivante')).corps
    }
    assert.equal(etat.etat, 'finie')
    // Dix sur dix : 75 XP, le niveau 2 — et le paon qu'il ouvre.
    assert.equal(etat.niveauAvant, 1)
    assert.equal(etat.niveauApres, 2)
  } finally {
    await banc.close()
  }
})

test('à la fin du quiz du jour : le laurier en jeu, le rendez-vous, la montée de niveau, la série qui tient', () => {
  const jour = source('views/JourApp.tsx')
  assert.match(jour, /Reste en tête jusqu’à minuit, et tu porteras le laurier demain/)
  assert.match(jour, /Demain, dix nouvelles questions dès minuit\./)
  assert.match(jour, /Tu portes le laurier aujourd’hui : la salle le verra à côté de ton prénom\./)
  assert.match(jour, /<CollectionOuverte avant=\{partie\.niveauAvant\} apres=\{partie\.niveauApres\}/)
  const carte = source('components/Jour.tsx')
  assert.match(carte, /!partie\.serieTenue && partie\.serie >= 2/)
  assert.match(carte, /tient jusqu’à minuit/)
  assert.match(carte, /Hier : \{placeDuJour\(/)
  // La série et le fond de carte ont leurs mots.
  assert.match(GLOSSAIRE.serie.sens, /Minuit la casse/)
  assert.ok(GLOSSAIRE.fond)
})

// ── La fin de soirée parle du quiz du jour ────────────────────────────────

async function jouerQuiz(host: Socket, quizId: string, questions: [Invite, number][][]): Promise<void> {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [qui, choice] of questions[q]) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
      assert.equal(ack.ok, true, `réponse ${q + 1} refusée : ${ack.error}`)
    }
    await revelee
    suivante =
      q + 1 < questions.length
        ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `la question ${q + 2}`)
        : vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  ;(host as any).emit('host:endSession', { sessionId })
}

test('la fin de soirée d’un profil dit sa série et s’il a joué le quiz du jour', async () => {
  const banc = await demarrer()
  try {
    const hote = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const quiz = await creerQuiz(banc.url, hote, [qcm('Oui ?', ['Oui', 'Non'], 0)])
    const host = await ecranCommun(banc.url, hote)
    const a = await invite(banc.url, 'Alice', '', { cookie: alice })
    const b = await invite(banc.url, 'Bob', '🐻')
    await jouerQuiz(host, quiz, [[[a, 0], [b, 1]]])
    const fin = attendre<any>(a.socket, 'soiree:fin', () => true, 'la fin de soirée d’Alice', 15_000)
    ;(host as any).emit('host:closeParty', {})
    const f = await fin
    assert.deepEqual(f.profil.jour, { serie: 1, aJoue: false }, 'la soirée vient d’ouvrir sa série ; le quiz d’aujourd’hui l’attend')
    assert.equal(finLisible(f), true)
    assert.equal(finLisible({ ...f, profil: { ...f.profil, jour: { serie: '1' } } }), false)
    // Sur son téléphone seulement, jamais à l'écran commun.
    assert.match(source('components/FinDeSoiree.tsx'), /\{gain\?\.jour && \(/)
    host.close()
  } finally {
    await banc.close()
  }
})

// ── Sa carte, depuis sa page ──────────────────────────────────────────────

test('« Voir ma carte » : sa carte telle que la salle la verra, sans « ce soir »', async () => {
  const banc = await demarrer()
  try {
    assert.equal((await fetch(`${banc.url}/api/joueur/carte`)).status, 401)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const { status, corps } = await lire(banc, alice, '/api/joueur/carte')
    assert.equal(status, 200)
    assert.equal(corps.nom, 'Alice')
    assert.equal(corps.avatar, '🦊')
    assert.equal(corps.profil.prenom, 'Alice')
    assert.equal(corps.profil.niveau, 1)
    assert.ok(Array.isArray(corps.profil.vitrine))
    assert.equal('ceSoir' in corps, false, 'il n’est dans aucune soirée ici')
    // La page y mène, par la même carte que la salle ouvre.
    assert.match(source('components/Apparence.tsx'), /<CarteJoueur adresse="\/api\/joueur\/carte"/)
    // Et la carte explique ses mots, ceux qu'elle montre.
    assert.match(source('components/CarteJoueur.tsx'), /<Glossaire mots=\{motsDeLaCarte\(/)
  } finally {
    await banc.close()
  }
})
