// Ce que la fin de soirée raconte à un profil, en plus de ce qu'elle lui
// rapporte : un record battu, les objectifs dont il s'approche, les prix qui
// entrent dans sa collection.
//
// Entre la quatrième et la dixième soirée, le joueur médian ne décrochait
// presque rien, et sa fin de soirée ne disait que l'expérience. Elle dit
// maintenant qu'il avance, même les soirs où rien ne tombe.
//
// Les dérivations (`core/objectifs.ts`) s'appellent directement ; la clôture,
// elle, se joue sur un serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'
import { QCM_POUR_PRECISION, approchesDeLaSoiree, recordsBattus } from '../src/core/objectifs'
import { PRIX_INDIVIDUELS } from '../src/core/stats'
import { carriereDe, gainVide, releveVide, type Carriere, type ReleveSoiree } from '../../shared/profil'
import { finLisible } from '../../shared/fin'

// Le premier Éclat fait tomber un palier : ici, le hasard ne décide de rien.
ProfileStore.tirageEclat = () => false

// ── De quoi écrire des soirées ────────────────────────────────────────────

/** Une soirée d'avant : un relevé, et un gain qui la fait compter — ou non, jouée seul. */
const soiree = (releve: Partial<ReleveSoiree>, compte = true) => ({
  releve: { ...releveVide(), ...releve },
  gain: { ...gainVide(), reponses: compte ? 1 : 0 },
})

const carriere = (c: Partial<Carriere>): Carriere => ({ ...carriereDe([], { eclats: 0, niveau: 1 }), ...c })

// ── 1. Les records ────────────────────────────────────────────────────────

test('un record se bat contre toutes les soirées d’avant — jamais à la première, ni seul', () => {
  const avant = [soiree({ meilleureSerie: 6, justes: 29, qcm: 40 }), soiree({ meilleureSerie: 9, justes: 12, qcm: 15 })]
  assert.deepEqual(recordsBattus(avant, soiree({ meilleureSerie: 11, justes: 34, qcm: 40 })), [
    { key: 'serie', valeur: 11, avant: 9 },
    { key: 'justes', valeur: 34, avant: 29 },
    // 34 sur 40 : 85 %, contre 29 sur 40 — les 12 sur 15 n'ont que quinze QCM.
    { key: 'precision', valeur: 34 / 40, avant: 29 / 40, sur: 40 },
  ])
  assert.deepEqual(recordsBattus([], soiree({ meilleureSerie: 11, justes: 34, qcm: 40 })), [], 'la première soirée : tout y serait un record')
  assert.deepEqual(recordsBattus(avant, soiree({ meilleureSerie: 11, justes: 34, qcm: 40 }, false)), [], 'seul, on ne bat rien')
  // Une soirée jouée seul ne se bat pas non plus : ses vingt bonnes réponses
  // d'affilée devant son téléphone ne ferment rien.
  assert.deepEqual(
    recordsBattus([...avant, soiree({ meilleureSerie: 20 }, false)], soiree({ meilleureSerie: 11 })).map(r => r.key),
    ['serie'],
  )
})

test('un record ne fête pas des miettes, et se lit comme il s’affiche', () => {
  const avant = [soiree({ meilleureSerie: 3, justes: 6, qcm: 30 })]
  assert.deepEqual(recordsBattus(avant, soiree({ meilleureSerie: 4, justes: 9, qcm: 10 })), [], 'quatre d’affilée, neuf justes : pas encore des records')
  // La précision se compare au pour cent près, sur vingt QCM au moins.
  const precision = (avant: ReturnType<typeof soiree>[], ceSoir: ReturnType<typeof soiree>) =>
    recordsBattus(avant, ceSoir).filter(r => r.key === 'precision')
  const precis = [soiree({ justes: 19, qcm: 25 })] // 76 %
  assert.deepEqual(precision(precis, soiree({ justes: 29, qcm: 38 })), [], '76,3 % ne bat pas 76 % : les deux s’écrivent « 76 % »')
  assert.deepEqual(precision(precis, soiree({ justes: 18, qcm: QCM_POUR_PRECISION - 1 })), [], 'dix-huit sur dix-neuf : trop peu de QCM')
  assert.deepEqual(
    precision([soiree({ justes: 10, qcm: 10 })], soiree({ justes: 19, qcm: 20 })),
    [],
    'dix sur dix un soir de dix questions n’est pas un record à battre : il ne se battrait jamais',
  )
  assert.deepEqual(precision(precis, soiree({ justes: 31, qcm: 38 })), [{ key: 'precision', valeur: 31 / 38, avant: 19 / 25, sur: 38 }])
})

// ── 2. Tu t'en approches ──────────────────────────────────────────────────

test('tu t’en approches : ce qui a avancé ce soir, à mi-chemin au moins — le légendaire d’abord', () => {
  const approches = approchesDeLaSoiree({
    recompenses: new Map([
      ['hf:foudre', 7],
      ['hf:encyclopedie:1', 1],
      ['hf:bavard:1', 1],
    ]),
    ceSoir: new Set(['hf:foudre']),
    avant: carriere({ soirees: 5, justes: 243, reponses: 400, reflexes: 12 }),
    apres: carriere({ soirees: 6, justes: 284, reponses: 470, reflexes: 15 }),
    legendaires: [],
  })
  // Le Tigre Foudre, à sept Foudres sur dix, est retenu devant Le Bavard ·
  // Argent (470 sur 500, plus proche) : c'est lui qu'on chasse. L'autre place
  // va au plus proche, L'Encyclopédie · Argent (284 sur 300), et les deux se
  // montrent du plus proche au plus loin. Le Réflexe, à 15 sur 20, et le
  // Renard (L'Habitué · Argent, 6 soirées sur 10) restent dehors.
  assert.deepEqual(approches, [
    { key: 'hf:encyclopedie:2', acquis: 284, requis: 300, ceSoir: 41 },
    { key: 'lg:tigre', acquis: 7, requis: 10, ceSoir: 1 },
  ])
})

test('tu t’en approches : ni ce qui n’a pas bougé, ni ce qu’on a déjà, ni ce que la fin dit ailleurs', () => {
  const base = { recompenses: new Map([['hf:foudre', 7]]), avant: carriere({ niveau: 8 }), apres: carriere({ niveau: 9, eclats: 2 }) }
  // La Foudre n'est pas tombée ce soir : sa jauge n'a pas bougé.
  assert.deepEqual(approchesDeLaSoiree({ ...base, ceSoir: new Set(), legendaires: [] }), [])
  // Le Tigre est déjà là (gagné sous une règle d'avant).
  assert.deepEqual(approchesDeLaSoiree({ ...base, ceSoir: new Set(['hf:foudre']), legendaires: ['lg:tigre'] }), [])
  // La Légende suit le niveau, que la barre montre juste au-dessus.
  assert.ok(!approchesDeLaSoiree({ ...base, ceSoir: new Set(), legendaires: [] }).some(a => a.key.startsWith('hf:legende')))
  // Un légendaire qui se gagne par un palier le représente : le Renard, pas L'Habitué · Argent.
  const renard = approchesDeLaSoiree({
    recompenses: new Map([['hf:habitue:1', 1]]),
    ceSoir: new Set(),
    avant: carriere({ soirees: 7 }),
    apres: carriere({ soirees: 8 }),
    legendaires: [],
  })
  assert.deepEqual(renard, [{ key: 'lg:renard', acquis: 8, requis: 10, ceSoir: 1 }])
  // À moins de la moitié, on ne s'approche pas encore.
  const loin = approchesDeLaSoiree({
    recompenses: new Map([['hf:bavard:1', 1]]),
    ceSoir: new Set(),
    avant: carriere({ reponses: 150 }),
    apres: carriere({ reponses: 240 }),
    legendaires: [],
  })
  assert.deepEqual(loin, [], '240 réponses sur 500')
})

// ── 3. La collection de prix ──────────────────────────────────────────────

test('la collection : tous les prix qu’une personne peut remporter, et pas ceux d’une équipe', () => {
  // Les clés des prix, lues dans le calcul lui-même : un prix ajouté sans
  // rejoindre la collection ferait mentir « 14 sur 20 ».
  const source = readFileSync(new URL('../src/core/stats.ts', import.meta.url), 'utf8')
  const cles = new Set([...source.matchAll(/key: '([a-z]+)'/g)].map(m => m[1]))
  const equipes = ['coupdepouce', 'solidaire']
  assert.deepEqual([...PRIX_INDIVIDUELS].sort(), [...cles].filter(k => !equipes.includes(k)).sort())
  assert.equal(PRIX_INDIVIDUELS.length, 20)
  assert.equal(new Set(PRIX_INDIVIDUELS).size, PRIX_INDIVIDUELS.length)
})

// ── 4. La clôture ─────────────────────────────────────────────────────────

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

type Reponses = [Invite, number][][]

/** Joue un quiz de bout en bout depuis l'écran commun, puis le referme. */
async function jouerQuiz(host: Socket, quizId: string, questions: Reponses): Promise<void> {
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

/** « Clore la soirée ». */
async function clore(host: Socket) {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
  ;(host as any).emit('host:closeParty', { title: 'La soirée des records' })
  const t = await toast
  assert.equal(t.kind, 'info', `la clôture a échoué : ${t.message}`)
}

function ecrireEnBase(banc: Banc, fn: (db: Database.Database) => void) {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    fn(db)
  } finally {
    db.close()
  }
}

test('à la clôture, la fin d’un profil dit son record battu, ce dont il s’approche et ses prix neufs', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const huit = await creerQuiz(banc.url, cookie, Array.from({ length: 8 }, (_, i) => qcm(`Question ${i + 1} ?`)), 'Huit')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Alice a une soirée derrière elle : six bonnes réponses d'affilée au
    // mieux, quatre-vingt-dix réponses, vingt justes — et Le Plus Précis
    // (`sansfaute`) déjà dans sa collection.
    ecrireEnBase(banc, db => {
      const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
      const profil = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      const releve = { ...releveVide(), reponses: 90, qcm: 90, justes: 20, meilleureSerie: 6, avatar: '🦊' }
      db.prepare(
        `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'la-veille', ?, 90, ?, ?)`,
      ).run(profil, espace, JSON.stringify({ v: VERSION_BAREME, gain: { ...gainVide(), reponses: 90 }, releve }), Date.now() - 86_400_000)
      db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'sansfaute', 'la-veille', ?, '💯', 'Le Plus Précis', ?)`,
      ).run(profil, espace, Date.now() - 86_400_000)
    })
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle: Invite[] = []
    for (const [nom, avatar] of [
      ['Bob', '🐻'],
      ['Dora', '🐙'],
      ['Eve', '🐝'],
    ]) {
      salle.push(await invite(banc.url, nom, avatar))
    }

    // Huit sur huit, seule : sa plus longue série passe de six à huit.
    await jouerQuiz(host, huit, Array.from({ length: 8 }, () => [[alice, 0], ...salle.map(i => [i, 1] as [Invite, number])]))
    const finAlice = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin de soirée d’Alice', 15_000)
    const finBob = attendre<any>(salle[0].socket, 'soiree:fin', () => true, 'la fin de soirée de Bob', 15_000)
    await clore(host)
    const fin = await finAlice
    assert.ok(finLisible(fin), 'la fin se relit sur le téléphone qui la garde')
    const profil = fin.profil
    assert.ok(profil, 'Alice a un profil')

    assert.deepEqual(profil.records, [{ key: 'serie', valeur: 8, avant: 6 }], 'huit justes seulement : pas de record de bonnes réponses')
    // 98 réponses sur 100 pour Le Bavard, deux soirées sur trois pour
    // L'Habitué ; L'Encyclopédie (28 sur 50) est plus loin.
    assert.deepEqual(profil.approches, [
      { key: 'hf:bavard:1', acquis: 98, requis: 100, ceSoir: 8 },
      { key: 'hf:habitue:1', acquis: 2, requis: 3, ceSoir: 1 },
    ])
    // Ses prix de ce soir entrent dans sa collection — sauf Le Plus Précis,
    // qui y était déjà.
    const prix = (fin.prix ?? []).map(p => p.key)
    assert.ok(prix.includes('sansfaute'), 'huit sur huit : Le Plus Précis, encore')
    assert.deepEqual(profil.collection, {
      nouveaux: prix.filter(k => k !== 'sansfaute'),
      eus: prix.length,
      total: 20,
    })

    // Bob est anonyme : rien de tout ça, et rien qui le lui reproche.
    assert.equal((await finBob).profil, undefined)
  }))

test('une fin mal formée ne se rouvre pas : records, approches et collection compris', () => {
  const fin = {
    soiree: { id: 's', titre: 'T', slug: 'banc' },
    nom: 'Alice',
    avatar: '🦊',
    rang: 1,
    points: 10,
    joueurs: 2,
    hautsFaits: [],
    profil: { xp: 1, niveauAvant: 1, niveauApres: 1, paliers: [], legendaires: [], divins: [], finitions: [] },
  }
  assert.ok(finLisible(fin), 'une fin d’avant, sans les nouveaux champs')
  assert.ok(finLisible({ ...fin, profil: { ...fin.profil, records: [{ key: 'serie', valeur: 8, avant: 6 }] } }))
  assert.ok(!finLisible({ ...fin, profil: { ...fin.profil, records: [{ key: 'serie' }] } }))
  assert.ok(!finLisible({ ...fin, profil: { ...fin.profil, approches: [{ key: 'lg:tigre', acquis: 7 }] } }))
  assert.ok(!finLisible({ ...fin, profil: { ...fin.profil, collection: { nouveaux: 'eclair', eus: 1, total: 20 } } }))
})
