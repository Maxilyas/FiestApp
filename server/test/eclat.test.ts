// Ce qu'on porte, et ce qui éclate.
//
// Trois choses ne tenaient pas ensemble. Le halo d'une finition s'empilait
// autour du médaillon d'un légendaire, qui avait déjà son cercle d'or : deux
// ou trois anneaux, une cible. L'Éclat, lui, tombait sur l'emoji caché sous
// le légendaire — une chance sur quarante que personne ne voyait. Et il
// tombait en silence, légendaire ou pas.
//
// Maintenant la finition devient le cercle du légendaire, l'Éclat tombe sur
// le légendaire porté — il prend sa version rare, dessinée —, et la fin de
// soirée le dit, au téléphone comme à la salle. Chaque test échouait avant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
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
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { cibleEclat } from '../../shared/legendaires'

// Le hasard ne décide de rien ici : les tests qui veulent un Éclat le forcent.
ProfileStore.tirageEclat = () => false

// ── Le rendu des pages ────────────────────────────────────────────────────

/** Un composant du client, rendu en HTML — la même recette que `finitions.test.ts`. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  Object.assign(globalThis, { React: (await import('react')).default })
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const React = (await import('react')).default
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

const avatar = (props: object) => rendu('components/Avatar', 'Avatar', { avatar: '🦊', ...props })

// ── 1. La finition devient le cercle ──────────────────────────────────────

test('porté, un légendaire prend sa finition pour cercle — plus de halo autour du sien', async () => {
  for (const finition of ['argent', 'or', 'holo', 'prisme', 'aurore', 'constellation']) {
    const html = await avatar({ legendaire: 'lg:phenix', finition })
    assert.ok(!html.includes(`av-${finition}`), `${finition} : pas de halo empilé autour du médaillon`)
    assert.ok(html.includes(`lg-cercle-${finition}`), `${finition} : le cercle du médaillon est dans sa matière`)
  }
  // Mat est un bronze : chaque niveau change le cercle, même le premier.
  assert.ok((await avatar({ legendaire: 'lg:phenix', finition: 'mat' })).includes('lg-cercle-mat'))
  // Sur un emoji, rien ne change : la finition reste un halo.
  assert.ok((await avatar({ finition: 'holo' })).includes('av-holo'))
  // Hors d'un porteur — une galerie —, le médaillon garde son cercle d'origine.
  assert.ok(!(await rendu('components/Legendaire', 'Legendaire', { cle: 'lg:phenix' })).includes('lg-cercle'))
})

test('un légendaire de l’ombre garde son filet violet sous le cercle de la finition', async () => {
  const kraken = await avatar({ legendaire: 'lg:kraken', finition: 'or' })
  assert.ok(kraken.includes('stroke="#b48cff"'), 'on voit encore qu’il s’est gagné en jouant mal')
  assert.ok(!(await avatar({ legendaire: 'lg:phenix', finition: 'or' })).includes('stroke="#b48cff"'))
})

// ── 2. La version rare ────────────────────────────────────────────────────

test('un légendaire éclaté porte sa version rare, dessinée, avec les paillettes de l’Éclat', async () => {
  const normal = await avatar({ legendaire: 'lg:phenix', finition: 'or' })
  const eclate = await avatar({ legendaire: 'lg:phenix', finition: 'or', eclat: true })
  assert.ok(eclate.includes('lg-eclate') && eclate.includes('av-eclat'))
  assert.ok(eclate.includes('#c4f4ff') && !eclate.includes('#ffcf6e'), 'le Phénix de glace, pas le Phénix de feu')
  assert.ok(normal.includes('#ffcf6e') && !normal.includes('lg-eclate'))
  // Un Divin n'éclate pas, et ne prend pas de finition.
  const divin = await avatar({ legendaire: 'dv:helios', finition: 'holo', eclat: true })
  assert.ok(!divin.includes('av-eclat') && !divin.includes('av-holo') && !divin.includes('lg-cercle'))
})

test('ce qui éclate, c’est ce qu’on porte : le légendaire, l’emoji sinon — jamais un Divin', () => {
  assert.equal(cibleEclat('lg:phenix', '🦊'), 'lg:phenix')
  assert.equal(cibleEclat(null, '🦊'), '🦊')
  assert.equal(cibleEclat('dv:seraphin', '🦊'), '🦊', 'sous un Divin, c’est l’emoji qui éclate')
})

// ── 3. Sur un vrai serveur ────────────────────────────────────────────────

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  const tirage = ProfileStore.tirageEclat
  try {
    await scenario(banc)
  } finally {
    ProfileStore.tirageEclat = tirage
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

async function rangee(banc: Banc): Promise<void> {
  for (const limite = Date.now() + 8000; ; await patienter(100)) {
    const { current } = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
    if (current?.id) return
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

test('l’Éclat se dit à la fin de la soirée : au téléphone de celui qui l’a, et à toute la salle', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    ProfileStore.tirageEclat = () => true
    // Une question posée à deux : la soirée compte, le tirage a lieu.
    await jouerQuiz(host, quiz, [[[alice, 0], [bob, 1]]])
    await rangee(banc)

    const finAlice = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin de soirée d’Alice', 15_000)
    const finBob = attendre<any>(bob.socket, 'soiree:fin', () => true, 'la fin de soirée de Bob', 15_000)
    const cloture = attendre<any>(host, 'soiree:cloture', () => true, 'la clôture sur l’écran commun', 15_000)
    await clore(host)
    assert.equal((await finAlice).profil?.eclat, '🦊', 'son téléphone le lui dit')
    assert.equal((await finBob).profil, undefined, 'un anonyme n’a rien qui éclate')
    assert.deepEqual(
      (await cloture).eclats.map((e: any) => [e.nom, e.eclate]),
      [['Alice', '🦊']],
      'la salle le voit',
    )
    assert.deepEqual((await moi(banc, aliceCookie)).eclats, ['🦊'])
  }))

test('sous un légendaire, c’est le légendaire qui éclate — sa version rare, que toute la salle voit', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const huit = await creerQuiz(banc.url, cookie, Array.from({ length: 8 }, (_, i) => qcm(`Question ${i + 1} ?`)), 'Huit')
    const une = await creerQuiz(banc.url, cookie, [qcm('Encore ?')], 'Une')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)

    // Première soirée : un Grand Chelem dans une salle de quatre — la Chouette.
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle: Invite[] = []
    for (const [nom, emoji] of [
      ['Bob', '🐻'],
      ['Dora', '🐙'],
      ['Eve', '🐝'],
    ]) {
      salle.push(await invite(banc.url, nom, emoji))
    }
    await jouerQuiz(host, huit, Array.from({ length: 8 }, () => [[alice, 0], ...salle.map((i): [Invite, number] => [i, 1])]))
    await rangee(banc)
    await clore(host)
    const porte = await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:chouette' }, aliceCookie, 'PUT')
    assert.equal(porte.status, 200)

    // Seconde soirée, la Chouette au cou : l'Éclat tombe sur elle.
    ProfileStore.tirageEclat = () => true
    const retour = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    await jouerQuiz(host, une, [[[retour, 0], [bob, 1]]])
    await rangee(banc)
    const fin = attendre<any>(retour.socket, 'soiree:fin', () => true, 'la fin de soirée d’Alice', 15_000)
    await clore(host)
    assert.equal((await fin).profil?.eclat, 'lg:chouette')
    const profil = await moi(banc, aliceCookie)
    assert.deepEqual(profil.eclats, ['lg:chouette'], 'l’emoji caché dessous n’a rien reçu')

    // À la soirée suivante, la salle voit la Chouette éclatée.
    const encore = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const snap = await instantane<any>(host, s => s.players.some((p: any) => p.id === encore.playerId), 'Alice dans la salle')
    const vue = snap.players.find((p: any) => p.id === encore.playerId)
    assert.equal(vue?.legendaire, 'lg:chouette')
    assert.equal(vue?.eclat, true)
  }))
