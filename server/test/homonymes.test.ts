// Les marques d'homonymie comparent l'avatar qu'on voit (la décision du
// 14 octobre 2026, après « un joueur n'a qu'un avatar ») : « Camille (2) »
// n'existe que pour distinguer deux lignes qui se ressemblent, et une ligne
// montre le légendaire, le portrait, le compagnon ou le Divin qu'il porte,
// sinon son emoji. Comparés seuls, les emojis laissaient identiques deux
// Camille sous le même Phénix, et marquaient celle qu'un légendaire
// distinguait déjà. Ni la finition, ni l'Éclat, ni la bordure ne comptent :
// trop discrets au fond de la salle, et ils bougent avec la progression.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { nomsAffiches, visageDe } from '../../shared/homonymes'
import { ArchiveStore, reviewOfArchive } from '../src/core/archive'
import type { AnswerRow } from '../src/core/answers'
import type { ProfileBadge } from '../src/core/party'
import type { PartyArchive } from '../../shared/archive'
import { qcm, salle } from './salle'

test('la règle : deux Camille se ressemblent sous le même dessin, quels que soient leurs emojis — et un dessin distingue deux renards', () => {
  assert.equal(visageDe({ avatar: '🦊', legendaire: 'lg:phenix' }), 'lg:phenix')
  assert.equal(visageDe({ avatar: '🦊', legendaire: null }), '🦊')
  const marques = nomsAffiches([
    { id: 'a', name: 'Camille', avatar: '🦊', legendaire: 'lg:phenix' },
    { id: 'b', name: 'Camille', avatar: '🐻', legendaire: 'lg:phenix' },
    { id: 'c', name: 'camille', avatar: '🦊' },
    { id: 'd', name: 'Camille', avatar: '🦊', legendaire: null },
  ])
  // B porte le même Phénix que A ; D, le même renard nu que C. A et C ne se
  // ressemblent pas : le Phénix de A cache son renard.
  assert.deepEqual([...marques], [
    ['b', 'Camille (2)'],
    ['d', 'Camille (2)'],
  ])
})

const PHENIX: ProfileBadge = { niveau: 14, finition: 'or', eclat: false, legendaire: 'lg:phenix' }

test('en soirée, la marque suit ce que chacun porte — un légendaire pris ou quitté dans la loge en pleine soirée compris', () => {
  // Ce que chaque profil porte, tel que l'instantané le lit (`badgeOf`) : la loge le change sans rien dire à la soirée.
  const portes = new Map<string, ProfileBadge>([
    ['profil-a', PHENIX],
    ['profil-b', PHENIX],
  ])
  const s = salle([{ id: 'q', title: 'Quiz', questions: [qcm('Oui ?')] }], {
    badgeOf: profileId => portes.get(profileId) ?? { niveau: 14, finition: 'or', eclat: false },
  })
  try {
    const a = s.inscrire('Camille', '🦊')
    s.party.bindProfile(a, 'profil-a')
    const b = s.inscrire('Camille', '🐻')
    s.party.bindProfile(b, 'profil-b')
    // Ce que l'instantané écrit sous chaque ligne, puis ce que le moteur écrit dans les vues (`ViewContext.playerName`).
    const noms = (...ids: string[]) => {
      const joueurs = s.party.publicPlayers(new Map())
      return ids.map(id => [joueurs.find(p => p.id === id)!.nomAffiche ?? null, s.party.nomAffiche(id)])
    }
    assert.deepEqual(
      noms(a, b),
      [
        [null, 'Camille'],
        ['Camille (2)', 'Camille (2)'],
      ],
      'deux fois le même Phénix sur le vidéoprojecteur : la seconde arrivée marquée',
    )

    // B le quitte dans la loge : son ours la distingue, la marque s'efface.
    portes.delete('profil-b')
    assert.deepEqual(noms(a, b), [
      [null, 'Camille'],
      [null, 'Camille'],
    ])

    // Une Camille sans profil, au renard : celui de A est sous son Phénix.
    const c = s.inscrire('Camille', '🦊')
    assert.deepEqual(noms(a, b, c), [
      [null, 'Camille'],
      [null, 'Camille'],
      [null, 'Camille'],
    ])

    // A quitte le sien à son tour : deux renards, la dernière arrivée marquée.
    portes.delete('profil-a')
    assert.deepEqual(noms(a, c), [
      [null, 'Camille'],
      ['Camille (2)', 'Camille (2)'],
    ])
  } finally {
    s.fermer()
  }
})

// ── Les soirées passées ───────────────────────────────────────────────────

let instant = 1_000
function reponse(playerId: string, points: number): AnswerRow {
  return {
    sessionId: 's1',
    quizTitle: 'Quiz',
    qIndex: 0,
    kind: 'choice',
    playerId,
    answered: true,
    correct: points > 0,
    choice: points > 0 ? 0 : 1,
    value: null,
    target: null,
    ms: 5_000,
    changes: 0,
    points,
    durationMs: 20_000,
    observed: false,
    createdAt: ++instant,
  }
}

/**
 * A et B, deux Camille à profil sur deux emojis, sous le même Phénix
 * aujourd'hui ; C, une Camille sans profil, au renard comme A. B gagne.
 */
function soiree(): PartyArchive {
  return {
    version: 1,
    players: [
      { id: 'a', name: 'Camille', avatar: '🦊', teamId: null, profileId: 'profil-a', createdAt: 1 },
      { id: 'b', name: 'Camille', avatar: '🐻', teamId: null, profileId: 'profil-b', createdAt: 2 },
      { id: 'c', name: 'Camille', avatar: '🦊', teamId: null, profileId: null, createdAt: 3 },
    ],
    teams: [],
    bonuses: [],
    scores: [
      { playerId: 'a', sessionId: 's1', points: 100, reason: 'Quiz « Quiz » — Q1', createdAt: 10 },
      { playerId: 'b', sessionId: 's1', points: 300, reason: 'Quiz « Quiz » — Q1', createdAt: 11 },
      { playerId: 'c', sessionId: 's1', points: 200, reason: 'Quiz « Quiz » — Q1', createdAt: 12 },
    ],
    answers: [reponse('a', 100), reponse('b', 300), reponse('c', 200)],
    packs: {},
  }
}

const apparences = (profileId: string): ProfileBadge | undefined => (profileId === 'profil-a' || profileId === 'profil-b' ? PHENIX : undefined)

test('le souvenir et le bilan d’une soirée passée marquent ce que la page montre : ce que chacun porte aujourd’hui', () => {
  const noms = (review: ReturnType<typeof reviewOfArchive>) => Object.fromEntries(review.players.map(p => [p.id, p.name]))
  assert.deepEqual(noms(reviewOfArchive(soiree(), apparences)), { a: 'Camille', b: 'Camille (2)', c: 'Camille' })
  // Sans lecteur de profils, la page montre les emojis : les marques les comparent.
  assert.deepEqual(noms(reviewOfArchive(soiree())), { a: 'Camille', b: 'Camille', c: 'Camille (2)' })
})

test('l’historique nomme son vainqueur sur ce que portent ses homonymes — leurs profils se lisent avec le sien, et pas un de plus', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-homonymes-'))
  const store = new ArchiveStore(`file:${path.join(dir, 'permanente.db')}`)
  try {
    await store.init('espace')
    // Zoé, à profil, joue sans homonyme : son profil n'a rien à dire de la marque de B.
    const archive = soiree()
    archive.players.push({ id: 'z', name: 'Zoé', avatar: '🐸', teamId: null, profileId: 'profil-z', createdAt: 4 })
    archive.answers.push(reponse('z', 0))
    await store.save('espace', 'soiree-1', 1, archive, 'Chez Camille')
    const demandes: string[][] = []
    const apparencesDe = async (ids: readonly string[]) => {
      demandes.push([...ids].sort())
      return apparences
    }
    const [resume] = await store.list('espace', apparencesDe)
    assert.deepEqual(resume.winners, [{ name: 'Camille (2)', avatar: '🐻', finition: 'or', legendaire: 'lg:phenix', points: 300 }])
    assert.deepEqual(demandes, [['profil-a', 'profil-b']], 'le Phénix de A décide de la marque de B ; Zoé ne se lit pas')
  } finally {
    store.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
