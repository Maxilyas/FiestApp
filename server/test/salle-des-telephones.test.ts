// Les téléphones ne reçoivent que ce qui change de la salle (`party:salle`).
//
// La liste entière de la salle repartait à chaque téléphone à chaque arrivée
// et à chaque révélation : 44 Ko vers chacun de 300 téléphones, 95 % de ce que
// le serveur envoyait pendant une soirée (le banc du 3 novembre 2026). Un
// changement ne part que s'il refait, sur chaque téléphone, la salle que les
// autres reçoivent — même sur celui qui vient de recevoir la sienne, plus
// récente, en se présentant (invariant 4). Et pendant un quiz, les points de
// la soirée attendent son podium sur les téléphones : chaque révélation les
// changeait tous.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { SalleDesTelephones, type EnvoiALaSalle } from '../src/core/salleDesTelephones'
import { appliquerLeChangement, type ChangementDeLaSalle } from '../../shared/salle'
import type { PartySnapshot, PublicPlayer, PublicTeam } from '../../shared/types'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'

// ── Les règles pures ───────────────────────────────────────────────────────

const joueur = (id: string, champs: Partial<PublicPlayer> = {}): PublicPlayer => ({ id, name: id, avatar: '🦊', score: 0, teamId: null, ...champs })
const equipe = (id: string, champs: Partial<PublicTeam> = {}): PublicTeam => ({ id, name: id, emoji: '🐝', position: 0, memberCount: 0, total: 0, average: 0, bonus: 0, ...champs })

function salle(players: PublicPlayer[], teams: PublicTeam[] = [], reste: Partial<PartySnapshot> = {}): PartySnapshot {
  return { players, teams, bonuses: [], session: null, joinUrl: null, wifi: null, space: { slug: 'banc' } as PartySnapshot['space'], ...reste }
}

/** Ce que tient un téléphone après l'envoi. */
function recu(tenu: PartySnapshot, envoi: EnvoiALaSalle, apres: PartySnapshot): PartySnapshot {
  if (envoi.quoi === 'rien') return tenu
  if (envoi.quoi === 'instantane') return apres
  return appliquerLeChangement(tenu, envoi.changement)
}

const changement = (envoi: EnvoiALaSalle): ChangementDeLaSalle => {
  assert.equal(envoi.quoi, 'changement', `un changement attendu, pas ${envoi.quoi}`)
  return (envoi as { changement: ChangementDeLaSalle }).changement
}

test('la première fois, la salle part entière ; rien de neuf, rien ne part', () => {
  const s = new SalleDesTelephones()
  const a = salle([joueur('a'), joueur('b')])
  assert.equal(s.versLaSalle(a).quoi, 'instantane')
  assert.equal(s.versLaSalle(structuredClone(a)).quoi, 'rien')
  assert.equal(s.versLaSalle(a, true).quoi, 'instantane', 'le filet des cinq minutes renvoie tout')
})

test('une arrivée ne part qu’elle : une ligne, au bout de la salle', () => {
  const s = new SalleDesTelephones()
  const avant = salle(Array.from({ length: 20 }, (_, i) => joueur(`j${i}`)))
  s.versLaSalle(avant)
  const apres = salle([...avant.players, joueur('nouvelle')])
  const c = changement(s.versLaSalle(apres))
  assert.deepEqual(c, { joueurs: [joueur('nouvelle')] })
  assert.deepEqual(appliquerLeChangement(avant, c), apres)
})

test('les équipes partent entières, un départ par son seul identifiant', () => {
  const s = new SalleDesTelephones()
  const avant = salle(Array.from({ length: 10 }, (_, i) => joueur(`j${i}`, { teamId: 'rouge' })), [equipe('rouge', { memberCount: 10 })])
  s.versLaSalle(avant)
  const apres = salle(avant.players.slice(1), [equipe('rouge', { memberCount: 9, total: 120, average: 12 })])
  const c = changement(s.versLaSalle(apres))
  assert.deepEqual(c, { partis: ['j0'], equipes: apres.teams })
  assert.deepEqual(appliquerLeChangement(avant, c), apres)
})

test('ce qui n’est ni joueur ni équipe part entier, sans les joueurs : le lancement d’un quiz', () => {
  const s = new SalleDesTelephones()
  const avant = salle(Array.from({ length: 20 }, (_, i) => joueur(`j${i}`)))
  s.versLaSalle(avant)
  const apres = salle(avant.players, [], { session: { id: 'quiz', participantIds: avant.players.map(p => p.id) } })
  const c = changement(s.versLaSalle(apres))
  const { players: _p, teams: _t, ...reste } = apres
  assert.deepEqual(c, { reste })
  assert.deepEqual(appliquerLeChangement(avant, c), apres)
  // Un champ qui disparaît du reste disparaît aussi chez le téléphone.
  const avecCode = salle(avant.players, [], { session: apres.session, code: '123456' })
  s.versLaSalle(avecCode)
  const sansCode = salle(avant.players, [], { session: apres.session })
  assert.deepEqual(appliquerLeChangement(avecCode, changement(s.versLaSalle(sansCode))), sansCode)
})

test('au podium d’un quiz, tout le monde a marqué : ses seuls points partent, pas ses lignes', () => {
  const s = new SalleDesTelephones()
  const avant = salle(Array.from({ length: 30 }, (_, i) => joueur(`j${i}`, { name: `Invité numéro ${i}`, niveau: 4 })))
  s.versLaSalle(avant)
  const apres = salle(avant.players.map((p, i) => ({ ...p, score: 100 * (i + 1) })))
  const c = changement(s.versLaSalle(apres))
  assert.equal(c.joueurs, undefined)
  assert.deepEqual(c.points, Object.fromEntries(apres.players.map(p => [p.id, p.score])))
  assert.deepEqual(appliquerLeChangement(avant, c), apres)
  // Un invité dont autre chose a changé avec ses points part entier.
  const renomme = salle(apres.players.map(p => (p.id === 'j3' ? { ...p, name: 'Jeanne', score: 1000 } : p)))
  assert.deepEqual(changement(s.versLaSalle(renomme)), { joueurs: [renomme.players[3]] })
})

test('un changement ne part que s’il pèse moins que la salle : vidée d’un coup, elle part entière', () => {
  const trente = Array.from({ length: 30 }, (_, i) => joueur(`j${i}`))
  const videe = new SalleDesTelephones()
  videe.versLaSalle(salle(trente))
  assert.equal(videe.versLaSalle(salle([])).quoi, 'instantane', 'une salle vide s’écrit en moins de signes que ses trente partis')
})

test('celui qui a reçu sa salle en se présentant retombe sur celle des autres : un arrivé puis exclu dans la même fenêtre', () => {
  const s = new SalleDesTelephones()
  const base = salle([joueur('a'), joueur('b'), joueur('c'), joueur('d')])
  s.versLaSalle(base)
  // Zoé arrive ; un téléphone se présente et reçoit la salle avec elle ; Zoé est exclue avant l'envoi regroupé.
  const avecZoe = salle([...base.players, joueur('zoe')])
  s.envoyeAUnSeul(avecZoe)
  const apres = salle([...base.players, joueur('eve')])
  const envoi = s.versLaSalle(apres)
  assert.deepEqual(recu(avecZoe, envoi, apres), apres, 'Zoé ne reste pas sur son écran')
  assert.deepEqual(recu(base, envoi, apres), apres)
})

test('… une équipe choisie puis quittée dans la même fenêtre', () => {
  const s = new SalleDesTelephones()
  const rouge = equipe('rouge', { memberCount: 1 })
  const bleue = equipe('bleue', { position: 1 })
  const base = salle([joueur('a', { teamId: 'rouge' }), joueur('b'), joueur('c'), joueur('d')], [rouge, bleue])
  s.versLaSalle(base)
  // A passe chez les bleus — un téléphone se présente — puis revient chez les rouges : la salle n'a pas changé.
  const entreDeux = salle([joueur('a', { teamId: 'bleue' }), ...base.players.slice(1)], [{ ...rouge, memberCount: 0 }, { ...bleue, memberCount: 1 }])
  s.envoyeAUnSeul(entreDeux)
  const envoi = s.versLaSalle(structuredClone(base))
  assert.notEqual(envoi.quoi, 'rien', 'le téléphone qui a vu l’entre-deux doit être corrigé')
  assert.deepEqual(recu(entreDeux, envoi, base), base)
  assert.deepEqual(recu(base, envoi, base), base)
})

test('une salle dont l’ordre changerait part entière, jamais un écran faux', () => {
  const s = new SalleDesTelephones()
  const base = salle([joueur('a'), joueur('b'), joueur('c'), joueur('d'), joueur('e'), joueur('f')])
  s.versLaSalle(base)
  // La salle n'ajoute qu'au bout (`Party`) : un ordre neuf ne vient que d'un code qui l'aurait changé.
  assert.equal(s.versLaSalle(salle([joueur('b'), joueur('a'), ...base.players.slice(2)])).quoi, 'instantane')
  // Un téléphone à qui manquerait un invité que la salle garde, inchangé : le changement ne le lui rendrait pas.
  const t = new SalleDesTelephones()
  t.versLaSalle(base)
  t.envoyeAUnSeul(salle(base.players.filter(p => p.id !== 'f')))
  assert.equal(t.versLaSalle(salle([...base.players, joueur('g')])).quoi, 'instantane')
})

/** Un hasard reproductible : chaque graine rejoue la même soirée. */
function hasard(graine: number) {
  let x = graine >>> 0 || 1
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 4294967296
  }
}

test('au hasard, des soirées entières : chaque téléphone tient, après chaque envoi, la salle que reçoit l’écran commun', () => {
  for (let graine = 1; graine <= 300; graine++) {
    const h = hasard(graine)
    const tirer = <T>(xs: readonly T[]): T => xs[Math.floor(h() * xs.length)]
    let joueurs: PublicPlayer[] = []
    let equipes: PublicTeam[] = [equipe('rouge'), equipe('bleue', { position: 1 })]
    let session: PartySnapshot['session'] = null
    let suivant = 0
    const maintenant = () => salle(structuredClone(joueurs), structuredClone(equipes), { session: structuredClone(session) })
    const s = new SalleDesTelephones()
    // Ce que tient chaque téléphone de la salle.
    const telephones: PartySnapshot[] = []
    let envois = 0
    for (let pas = 0; pas < 120; pas++) {
      const r = h()
      if (r < 0.3) joueurs.push(joueur(`p${suivant++}`, { teamId: h() < 0.5 ? tirer(equipes).id : null }))
      else if (r < 0.38 && joueurs.length) joueurs = joueurs.filter(p => p !== tirer(joueurs))
      else if (r < 0.48 && joueurs.length) tirer(joueurs).teamId = tirer([null, ...equipes.map(e => e.id)])
      else if (r < 0.54 && joueurs.length) tirer(joueurs).name = `n${pas}`
      else if (r < 0.6) equipes = equipes.map(e => ({ ...e, total: e.total + Math.floor(h() * 3) }))
      else if (r < 0.63) session = session ? null : { id: `q${pas}`, participantIds: joueurs.map(p => p.id) }
      else if (r < 0.66 && joueurs.length) joueurs = joueurs.map(p => ({ ...p, score: p.score + 10 }))
      else if (r < 0.8) {
        // Un téléphone se présente, ou fait un geste : il reçoit la salle d'à présent.
        const sien = maintenant()
        s.envoyeAUnSeul(sien)
        if (telephones.length && h() < 0.5) telephones[Math.floor(h() * telephones.length)] = sien
        else telephones.push(sien)
      } else {
        const apres = maintenant()
        const envoi = s.versLaSalle(apres, h() < 0.03)
        envois++
        for (let i = 0; i < telephones.length; i++) {
          telephones[i] = recu(telephones[i], envoi, apres)
          assert.deepEqual(telephones[i], apres, `graine ${graine}, pas ${pas} : un téléphone tient une autre salle (${envoi.quoi})`)
        }
      }
    }
    assert.ok(envois > 0)
  }
})

// ── Une soirée jouée ───────────────────────────────────────────────────────

let banc: Banc
let cookie: string
let host: Socket

before(async () => {
  banc = await demarrer()
  cookie = await connexionAnimateur(banc.url)
  host = await ecranCommun(banc.url, cookie)
})

after(async () => {
  await banc.close()
})

/** Tout ce qu'un téléphone reçoit de la salle, dans l'ordre. */
function ecouterLaSalle(socket: Socket): { quoi: string; charge: any }[] {
  const recus: { quoi: string; charge: any }[] = []
  socket.on('party:snapshot', (charge: unknown) => recus.push({ quoi: 'party:snapshot', charge }))
  socket.on('party:salle', (charge: unknown) => recus.push({ quoi: 'party:salle', charge }))
  return recus
}

async function repondre(qui: Invite, sessionId: string, view: any, choice: number) {
  const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice, qIndex: view.qIndex, round: view.round } })
  assert.equal(ack.ok, true, ack.error)
}

test('pendant un quiz, une révélation ne renvoie aux téléphones que leurs équipes ; les points de la soirée arrivent au podium', async () => {
  ;(host as any).emit('host:seedTeams')
  const { teams } = await instantane<any>(host, s => s.teams.length >= 2, 'les équipes')
  const alice = await invite(banc.url, 'Alice', '🦊')
  const bob = await invite(banc.url, 'Bob', '🐻')
  for (const [qui, team] of [
    [alice, teams[0]],
    [bob, teams[1]],
  ] as const) {
    assert.equal((await emitAck<any>(qui.socket, 'player:setTeam', { teamId: team.id })).ok, true)
  }
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Première ?', ['Oui', 'Non'], 0), qcm('Seconde ?', ['Oui', 'Non'], 0)], 'Deux questions')
  const sessionId = await lancerQuiz(host, quiz)
  const premiere = await attendre<any>(alice.socket, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question', 'la première question', 15_000)
  // La salle au complet chez les deux, partie comprise : ce qui reste en route n'est pas une révélation.
  await Promise.all([alice, bob].map(i => instantane<any>(i.socket, s => s.session?.id === sessionId && s.players.length === 2, 'la partie au téléphone')))
  await patienter(400)
  const chezAlice = ecouterLaSalle(alice.socket)
  const chezBob = ecouterLaSalle(bob.socket)

  const revelation = attendre<any>(host, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'reveal', 'la révélation')
  await repondre(alice, sessionId, premiere.view, 0)
  await repondre(bob, sessionId, premiere.view, 1)
  await revelation
  // L'écran commun voit les points tout de suite.
  const hote = await instantane<any>(host, s => (s.players.find((p: any) => p.id === alice.playerId)?.score ?? 0) > 0, 'les points d’Alice à l’écran commun')
  const sesPoints = hote.players.find((p: any) => p.id === alice.playerId).score
  // Les téléphones, eux, reçoivent leurs équipes : la moyenne de celle d'Alice a bougé.
  const equipeDAlice = (s: any) => s.teams.find((t: any) => t.id === teams[0].id)
  const auTelephone = await instantane<any>(alice.socket, s => equipeDAlice(s)?.average > 0, 'la moyenne de son équipe au téléphone')
  assert.equal(equipeDAlice(auTelephone).average, equipeDAlice(hote).average)
  await patienter(400)
  for (const recus of [chezAlice, chezBob]) {
    assert.deepEqual(
      recus.map(r => r.quoi),
      ['party:salle'],
      'une révélation : un changement de la salle, jamais la salle entière',
    )
    assert.equal(recus[0].charge.joueurs, undefined, 'aucun joueur : les points de la soirée attendent le podium')
    assert.ok(recus[0].charge.equipes, 'les équipes, entières')
  }
  assert.equal(auTelephone.players.find((p: any) => p.id === alice.playerId).score, 0, 'au téléphone, les points de la soirée d’avant le quiz')

  // La seconde question, puis le podium du quiz : les points de la soirée repartent aux téléphones.
  const seconde = attendre<any>(alice.socket, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question' && p.view.qIndex === 1, 'la seconde question')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  const vue2 = await seconde
  const fin = attendre<any>(host, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'reveal' && p.view.qIndex === 1, 'la seconde révélation')
  await repondre(alice, sessionId, vue2.view, 0)
  await repondre(bob, sessionId, vue2.view, 1)
  await fin
  const auPodiumRecus = ecouterLaSalle(alice.socket)
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  await attendre<any>(alice.socket, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'finished', 'le podium du quiz')
  const auPodium = await instantane<any>(alice.socket, s => (s.players.find((p: any) => p.id === alice.playerId)?.score ?? 0) > sesPoints, 'les points de la soirée au podium')
  const hoteAuPodium = await instantane<any>(host, s => s.players.find((p: any) => p.id === alice.playerId)?.score === auPodium.players.find((p: any) => p.id === alice.playerId).score)
  assert.deepEqual(
    auPodium.players.map((p: any) => [p.id, p.score]),
    hoteAuPodium.players.map((p: any) => [p.id, p.score]),
    'au podium, le téléphone et l’écran commun disent les mêmes points',
  )
  // Et ils y arrivent seuls, sans les lignes des invités.
  const lesPoints = auPodiumRecus.find(r => r.quoi === 'party:salle' && r.charge.points)
  assert.ok(lesPoints, `les points de la soirée, en changement (${JSON.stringify(auPodiumRecus.map(r => r.quoi))})`)
  assert.equal(lesPoints.charge.points[alice.playerId], auPodium.players.find((p: any) => p.id === alice.playerId).score)
  assert.equal(lesPoints.charge.joueurs, undefined)
})
