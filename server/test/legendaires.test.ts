// Un légendaire se mérite sur la durée — et ce qui était gagné reste gagné.
//
// Tombés d'un seul haut fait, la plupart des légendaires se gagnaient dès la
// première soirée : à deux quiz de cinquante questions, le plus rapide avait
// sa Foudre à chaque quiz, le premier son Lion au premier soir. Les seuils
// montent, calés pour qu'il faille une vingtaine de quiz au premier qui le
// décroche (`server/scripts/calibrage.ts`). Mais durcir une règle ne reprend
// rien à personne : ce qu'un profil avait débloqué avant lui reste, tant que
// la soirée qui le lui avait donné est dans l'historique. Chaque test
// échouait avant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  ADMIN,
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
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { divinsDebloques } from '../src/core/divins'
import { LEGENDAIRES, legendairesDebloques, type Condition } from '../../shared/legendaires'
import { clePalier } from '../../shared/hautsfaits'

// Le hasard ne décide de rien ici : un Éclat n'a rien à faire dans ces comptes.
ProfileStore.tirageEclat = () => false

// ── 1. Les seuils ─────────────────────────────────────────────────────────

const debloque = (cle: string, recompenses: [string, number][]) => legendairesDebloques(new Map(recompenses)).includes(cle)

test('un seul haut fait ne fait plus un légendaire : il faut le refaire, soirée après soirée', () => {
  // [légendaire, ce qui suffisait, ce qu'il faut maintenant]
  const durcis: [string, [string, number][], [string, number][]][] = [
    ['lg:oracle', [['hf:oracle', 1]], [['hf:oracle', 8]]],
    ['lg:tigre', [['hf:foudre', 1]], [['hf:foudre', 10]]],
    ['lg:lion', [['hf:roi', 1]], [['hf:roi', 8]]],
    ['lg:fantome', [['hf:somnambule', 2]], [['hf:somnambule', 6]]],
    ['lg:trou-noir', [['hf:cosmique', 3]], [['hf:cosmique', 7]]],
    ['lg:comete', [['hf:reflexe:1', 1], ['hf:reflexe:2', 1]], [['hf:reflexe:1', 1], ['hf:reflexe:2', 1], ['hf:reflexe:3', 1]]],
  ]
  for (const [cle, avant, maintenant] of durcis) {
    assert.ok(!debloque(cle, avant), `${cle} ne tombe plus sur ce qui suffisait`)
    const presque = maintenant.map(([k, n]): [string, number] => [k, k.endsWith(':3') ? 0 : n - 1])
    assert.ok(!debloque(cle, presque), `${cle} : il manque encore une soirée`)
    assert.ok(debloque(cle, maintenant), `${cle} tombe au nouveau seuil`)
  }
  // Ceux qui demandaient déjà une vingtaine de quiz, ou davantage, n'ont pas bougé.
  assert.ok(debloque('lg:phenix', [['hf:phenix', 1]]))
  assert.ok(debloque('lg:chouette', [['hf:grand-chelem', 1]]))
  assert.ok(debloque('lg:dragon', [['hf:triple', 1]]))
  assert.ok(debloque('lg:licorne', [['hf:seul-contre-tous', 3]]))
  assert.ok(debloque('lg:kraken', [['hf:lanterne-rouge', 3]]))
  assert.ok(debloque('lg:renard', [['hf:habitue:1', 1], ['hf:habitue:2', 1]]))
})

test('ce qui était gagné avant reste gagné, tant que la règle d’alors tient', () => {
  const avant: Condition = { hautFait: 'hf:foudre', fois: 1 }
  const acquis = new Map([['lg:tigre', avant]])
  const uneFoudre = new Map([['hf:foudre', 1]])
  assert.ok(legendairesDebloques(uneFoudre, acquis).includes('lg:tigre'), 'une Foudre d’avant garde son Tigre')
  assert.ok(!legendairesDebloques(uneFoudre).includes('lg:tigre'), 'la même Foudre, sans acquis, n’y suffit plus')
  // La soirée qui l'avait donné est retirée de l'historique : il part avec elle.
  assert.ok(!legendairesDebloques(new Map(), acquis).includes('lg:tigre'))
  // Un acquis ne vaut que pour son légendaire.
  assert.ok(!legendairesDebloques(new Map([['hf:roi', 1]]), acquis).includes('lg:lion'))
})

test('l’Arbre-Monde compte aussi les légendaires gardés d’avant', () => {
  // Tout au seuil du jour, sauf le Tigre : une seule Foudre, gagnée avant.
  const recompenses = new Map<string, number>()
  for (const l of LEGENDAIRES) {
    const c = l.condition
    if ('fois' in c) recompenses.set(c.hautFait, c.fois)
    else for (let p = 1; p <= c.palier; p++) recompenses.set(clePalier(c.hautFait, p), 1)
  }
  recompenses.set('hf:foudre', 1)
  assert.deepEqual(divinsDebloques(recompenses), [], 'onze légendaires ne font pas l’Arbre')
  const acquis = new Map<string, Condition>([['lg:tigre', { hautFait: 'hf:foudre', fois: 1 }]])
  assert.deepEqual(divinsDebloques(recompenses, acquis), ['dv:arbre'])
})

// ── 2. Sur un vrai serveur ────────────────────────────────────────────────

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

/** Joue un quiz de bout en bout depuis l'écran commun, puis le referme. */
async function jouerQuiz(host: Socket, quizId: string, questions: [Invite, number][][]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    // Une réponse après l'autre : la première arrivée est la plus rapide.
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

/** La soirée, rangée toute seule après son quiz : son identifiant. */
async function rangee(banc: Banc): Promise<string> {
  for (const limite = Date.now() + 8000; ; await patienter(100)) {
    const { current } = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
    if (current?.id) return current.id
    if (Date.now() > limite) assert.fail('la soirée aurait dû se ranger toute seule après son quiz')
  }
}

async function clore(host: Socket) {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
  ;(host as any).emit('host:closeParty', {})
  const t = await toast
  assert.equal(t.kind, 'info', `la clôture a échoué : ${t.message}`)
}

const moi = async (banc: Banc, cookie: string) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile

/**
 * Une soirée de trois questions dans une salle de quatre, où `rapide` trouve
 * le premier à chaque fois — une Foudre, et rien de plus : il en fallait une
 * pour le Tigre, il en faut dix.
 */
async function soireeDeFoudre(banc: Banc, cookie: string, rapide: Invite): Promise<string> {
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?'), qcm('Trois ?')], 'Foudre')
  const host = await ecranCommun(banc.url, cookie)
  const [second, ...salle] = await Promise.all([
    invite(banc.url, 'Bob', '🐻'),
    invite(banc.url, 'Dora', '🐙'),
    invite(banc.url, 'Eve', '🐝'),
  ])
  const question: [Invite, number][] = [[rapide, 0], [second, 0], ...salle.map((i): [Invite, number] => [i, 1])]
  await jouerQuiz(host, quiz, [question, question, question])
  const soiree = await rangee(banc)
  await clore(host)
  for (const i of [second, ...salle]) i.socket.close()
  host.close()
  return soiree
}

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

test('un légendaire gagné avant le durcissement reste à son porteur — et à lui seul', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const soiree = await soireeDeFoudre(banc, cookie, alice)
    alice.socket.close()
    const apres = await moi(banc, aliceCookie)
    assert.ok(!apres.legendaires.includes('lg:tigre'), 'une Foudre ne fait plus le Tigre')

    // On remonte le temps : la base est celle d'avant le durcissement — la
    // Foudre y est, le serveur qui démarre ne l'a encore jamais relue.
    const db = new Database(permanente(banc))
    try {
      db.prepare(`DELETE FROM meta WHERE key = 'legendaires_durcis'`).run()
      db.prepare('DELETE FROM profile_legendaires').run()
    } finally {
      db.close()
    }
    await banc.redemarrer()
    assert.ok((await moi(banc, aliceCookie)).legendaires.includes('lg:tigre'), 'elle l’avait : elle le garde')
    const porte = await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:tigre' }, aliceCookie, 'PUT')
    assert.equal(porte.status, 200, 'et elle peut le porter')

    // Zoé fait la même chose après : les nouvelles règles valent pour elle,
    // et un redémarrage ne lui rend pas les anciennes.
    const zoeCookie = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    const zoe = await invite(banc.url, 'Zoé', '🐼', { cookie: zoeCookie })
    await soireeDeFoudre(banc, cookie, zoe)
    zoe.socket.close()
    assert.ok(!(await moi(banc, zoeCookie)).legendaires.includes('lg:tigre'))
    await banc.redemarrer()
    assert.ok(!(await moi(banc, zoeCookie)).legendaires.includes('lg:tigre'), 'pas au redémarrage suivant non plus')
    assert.ok((await moi(banc, aliceCookie)).legendaires.includes('lg:tigre'), 'Alice le garde toujours')

    // La soirée qui le lui avait donné sort de l'historique : il part avec elle.
    const retire = await ecrire(banc.url, `/api/soirees/${soiree}`, {}, cookie, 'DELETE')
    assert.equal(retire.status, 200)
    const sans = await moi(banc, aliceCookie)
    assert.ok(!sans.legendaires.includes('lg:tigre'))
    assert.equal(sans.legendaire, null, 'et elle ne le porte plus')
  }))
