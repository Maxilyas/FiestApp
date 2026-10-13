// Les soirées au QG (`/admin#soirees`) : en direct, laissées en plan, et ce
// que les trente derniers jours en disent — en chiffres seulement. Et le seul
// geste du QG sur la soirée d'un autre (le choix du 13 octobre 2026) : clore
// une soirée laissée en plan, comme son animateur l'aurait close.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
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
import {
  EN_PLAN_MS,
  bilanDesSoirees,
  jourDeLaSemaine,
  minuitsDeParis,
  trancheDeSalle,
  JOURS_DES_SOIREES,
  type DirectDuQg,
  type JournalDuQg,
  type PageDesSoirees,
  type SoireeDuQg,
} from '../../shared/qg'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

const H = 3_600_000
const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const faire = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Une question jouée de bout en bout depuis l'écran commun, puis le quiz refermé. */
async function jouerUneQuestion(host: Socket, quizId: string, reponses: [Invite, number][]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  await vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la question')
  const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
  for (const [qui, choice] of reponses) {
    const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
    assert.equal(ack.ok, true, ack.error)
  }
  await revelee
  const podium = vue(sessionId, v => v.phase === 'finished', 'le podium')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  await podium
  ;(host as any).emit('host:endSession', { sessionId })
}

test('clore une soirée laissée en plan : refusé tant qu’elle vit, puis rangée et créditée comme par son animateur', async () => {
  const horloge = { decalage: 0 }
  const banc = await demarrer({ horlogeDuJour: () => Date.now() + horloge.decalage })
  try {
    const admin = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, admin, [qcm('Une question du soir ?', ['Oui', 'Non'])], 'Le quiz du soir')
    const host = await ecranCommun(banc.url, admin)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const leaId = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id as string
    const salle = [await invite(banc.url, 'Léa', '🦊', { cookie: lea }), await invite(banc.url, 'Bob', '🐻')]
    await jouerUneQuestion(host, quiz, [
      [salle[0], 0],
      [salle[1], 1],
    ])
    // La soirée s'est rangée après son quiz ; son animateur ne la clôt pas.
    for (const limite = Date.now() + 8000; ; await patienter(100)) {
      const { current } = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
      if (current?.id) break
      if (Date.now() > limite) assert.fail('la soirée aurait dû se ranger après son quiz')
    }
    const direct = (await lire<DirectDuQg>(banc, admin, '/api/admin/qg/direct')).corps
    const spaceId = direct.soirees[0].spaceId
    // Pas encore close, elle est déjà à l'historique du mois, à jour de ce qu'elle a joué.
    const ouverte = (await lire<PageDesSoirees>(banc, admin, '/api/admin/soirees')).corps.historique
    assert.deepEqual(
      ouverte.map(s => [s.spaceId, s.invites, s.quiz, s.questions, s.ouverte]),
      [[spaceId, 2, 1, 1, true]],
    )

    // Elle vit encore : le QG ne la clôt pas.
    const tot = await faire(banc, admin, `/api/admin/soirees/${spaceId}/clore`)
    assert.equal(tot.status, 409)
    assert.match(tot.corps.error, /laissée en plan/)
    assert.equal((await faire(banc, admin, '/api/admin/soirees/inconnu/clore')).status, 404)

    // Six heures plus tard, sans un geste : laissée en plan, elle se clôt d'ici
    // — et ses téléphones reçoivent leur fin de soirée, comme à une clôture de son animateur.
    horloge.decalage = EN_PLAN_MS + 60_000
    const fin = attendre<any>(salle[0].socket, 'soiree:fin', () => true, 'la fin de soirée de Léa', 15_000)
    const close = await faire(banc, admin, `/api/admin/soirees/${spaceId}/clore`)
    assert.equal(close.status, 200, close.corps.error)
    assert.deepEqual(close.corps, { close: true, rangee: true })
    await fin

    // Comme une clôture ordinaire : l'archive, l'expérience des invités, la soirée vidée.
    const { current, archives } = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
    assert.equal(current, null, 'plus de soirée en cours')
    assert.equal(archives.length, 1)
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    try {
      const xp = base.prepare("SELECT xp FROM profile_xp WHERE profile_id = ? AND soiree_id NOT LIKE '#%'").all(leaId) as { xp: number }[]
      assert.equal(xp.length, 1, 'la soirée de Léa est créditée')
    } finally {
      base.close()
    }
    // Le geste au journal, sous sa sorte : le salon et les chiffres, jamais un prénom d'invité.
    const journal = (await lire<JournalDuQg>(banc, admin, '/api/admin/gestes?sorte=soiree')).corps
    assert.deepEqual(
      journal.gestes.map(g => [g.sorte, g.cible, g.resume]),
      [['soiree', spaceId, 'Soirée laissée en plan close : Antoine — 2 invités, 1 quiz']],
    )
    assert.deepEqual((await lire<DirectDuQg>(banc, admin, '/api/admin/qg/direct')).corps.soirees, [])
    const rangee = (await lire<PageDesSoirees>(banc, admin, '/api/admin/soirees')).corps.historique
    assert.deepEqual(
      rangee.map(s => [s.invites, s.quiz, s.questions, s.ouverte]),
      [[2, 1, 1, false]],
      'close, elle reste à l’historique du mois',
    )
    // Une seconde fois : il n'y a plus rien à clore.
    assert.equal((await faire(banc, admin, `/api/admin/soirees/${spaceId}/clore`)).status, 404)
    host.disconnect()
  } finally {
    await banc.close()
  }
})

test('la page des soirées : trente jours en chiffres, les jours de la semaine, la taille des salles — sans un prénom ni un titre', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    // Des soirées archivées, écrites telles que l'historique les range : un vendredi, un samedi, et une d'il y a quarante jours.
    const maintenant = Date.now()
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const ranger = base.prepare("INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, ?, ?, ?, ?, '{}')")
      const fiche = (joueurs: number, venus: number, quiz: number) =>
        JSON.stringify({
          v: 3,
          invites: Array.from({ length: venus }, (_, i) => ({ id: `i${i}`, name: `Invité secret ${i}`, avatar: '🦊', teamId: null, points: 0, joue: i < joueurs })),
          equipes: [],
          prix: [],
          quiz,
          questions: quiz * 10,
        })
      ranger.run('espace-a', 's1', 'L’anniversaire très privé', maintenant - 2 * 24 * H, maintenant - 2 * 24 * H + 2 * H, fiche(12, 13, 3))
      ranger.run('espace-b', 's2', 'Un titre secret', maintenant - 9 * 24 * H, maintenant - 9 * 24 * H + 3 * H, fiche(4, 4, 1))
      ranger.run('espace-a', 's3', 'Une vieille soirée', maintenant - 40 * 24 * H, maintenant - 40 * 24 * H + H, fiche(7, 8, 2))
    } finally {
      base.close()
    }
    const page = (await lire<PageDesSoirees>(banc, admin, '/api/admin/soirees')).corps
    assert.deepEqual(
      [page.trenteJours.soirees, page.trenteJours.avant, page.trenteJours.invites, page.trenteJours.quiz, page.trenteJours.questions],
      [2, 1, 16, 4, 40],
    )
    assert.equal(page.trenteJours.invitesMediane, 8)
    assert.equal(page.parJourDeLaSemaine.reduce((a, b) => a + b, 0), 3, 'les trois sur quatre-vingt-dix jours')
    assert.deepEqual(page.parTaille, [1, 1, 1, 0, 0], 'douze, quatre et sept invités qui ont joué')
    assert.deepEqual(
      page.historique.map(s => [s.invites, s.quiz]),
      [
        [12, 3],
        [4, 1],
      ],
      'le mois, le plus récent d’abord',
    )
    const texte = JSON.stringify(page)
    for (const secret of ['Invité secret', 'anniversaire', 'Un titre secret']) assert.ok(!texte.includes(secret), `« ${secret} » ne sort pas`)
  } finally {
    await banc.close()
  }
})

test('le jour de la semaine se lit à Paris, et une salle se range dans sa tranche', () => {
  // Samedi 10 octobre 2026 à 23 h 30 à Paris : 21 h 30 au temps universel, encore samedi.
  assert.equal(jourDeLaSemaine(Date.UTC(2026, 9, 10, 21, 30)), 5)
  // Dimanche 11 octobre à 0 h 30 à Paris : samedi 22 h 30 au temps universel.
  assert.equal(jourDeLaSemaine(Date.UTC(2026, 9, 10, 22, 30)), 6)
  assert.equal(jourDeLaSemaine(Date.UTC(2026, 9, 12, 10)), 0, 'le lundi d’abord')
  assert.deepEqual([1, 2, 5, 6, 10, 11, 15, 16, 20, 21, 80].map(trancheDeSalle), [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4])
})

test('le bilan des soirées : les trente jours bornés au minuit de Paris, la médiane qu’une grande salle ne tire pas', () => {
  // Mardi 13 octobre 2026, 21 h 04 à Paris.
  const maintenant = Date.UTC(2026, 9, 13, 19, 4)
  const minuits = minuitsDeParis(maintenant, JOURS_DES_SOIREES)
  const debutDuMois = minuits[JOURS_DES_SOIREES - 30]
  const s = (quand: number, joueurs: number) => ({ quand, joueurs, quiz: 2, questions: 20 })
  const bilan = bilanDesSoirees(
    [
      s(maintenant - H, 6),
      s(maintenant - 3 * 24 * H, 8),
      s(debutDuMois, 80),
      // Une minute avant le premier minuit du mois : des trente jours d'avant.
      s(debutDuMois - 60_000, 12),
      // Une fiche d'avant les fiches : elle compte, sans taille.
      s(maintenant - 5 * 24 * H, 0),
      // Pas encore commencée à cette heure, hors des quatre-vingt-dix jours : rien.
      s(maintenant + H, 9),
      s(minuits[0] - 1, 9),
    ],
    minuits,
    maintenant,
  )
  assert.deepEqual([bilan.trenteJours.soirees, bilan.trenteJours.avant, bilan.trenteJours.invites], [4, 1, 94])
  assert.equal(bilan.trenteJours.invitesMediane, 8, 'six, huit et quatre-vingts : huit')
  assert.equal(bilan.parJourDeLaSemaine.reduce((a, b) => a + b, 0), 5)
  assert.deepEqual(bilan.parTaille, [0, 2, 1, 0, 1])
  assert.equal(bilanDesSoirees([], minuits, maintenant).trenteJours.invitesMediane, null)
})

test('la page des soirées se lit d’un coup d’œil : le geste sur celle laissée en plan, les barres en chiffres, le mois sans un titre', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#soirees', origin: 'http://banc' } } })
  const { QgSoirees, BilanDesSoireesDuQg } = await import(new URL('../../client/src/components/QgSoirees.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const lu = (el: React.ReactElement) => renderToStaticMarkup(el).replace(/<!-- -->/g, '').replace(/ /g, ' ')
  // Mardi 13 octobre 2026, 21 h 04 à Paris.
  const maintenant = Date.UTC(2026, 9, 13, 19, 4)
  const soiree = (s: Partial<SoireeDuQg>): SoireeDuQg => ({
    spaceId: 'lea',
    salon: { nom: 'Le salon de Léa', avatar: '🦊' },
    etat: 'en-cours',
    inscrits: 15,
    connectes: 14,
    depuis: maintenant - 72 * 60_000,
    dernierSigne: maintenant - 60_000,
    quizJoues: 2,
    partie: { phase: 'question', quiz: 2, question: 6, questions: 15 },
    ecran: true,
    sauvegardeEnRetard: false,
    ...s,
  })
  const direct: DirectDuQg = {
    maintenant,
    soirees: [
      soiree({}),
      soiree({ spaceId: 'tom', salon: { nom: 'Le salon de Tom', avatar: null }, etat: 'en-plan', connectes: 0, dernierSigne: maintenant - 7 * H, partie: null }),
    ],
    invitesConnectes: 14,
    profilsEnLigne: 38,
    miroir: { enAttente: 0, echecsConsecutifs: 0, enEchecDepuis: null, espacesEnRetard: 0 },
    serveur: { env: 'production', version: null, enMarcheDepuisS: 600, memoireMo: 200, cpuPct: 3, bouclePct: 1, baseP95Ms: 80, connexions: 20 },
  }
  const haut = lu(React.createElement(QgSoirees, { direct, apresUnGeste: () => {} }))
  assert.doesNotMatch(haut, /undefined|NaN/)
  // Celle qui se joue se lit ; celle laissée en plan porte le seul geste du QG sur la soirée d'un autre.
  assert.match(haut, /En direct.*Le salon de Léa.*Laissées en plan.*Le salon de Tom.*sans un geste depuis 7 h 00.*Clore la soirée/s)
  assert.equal(haut.match(/Clore la soirée/g)?.length, 1)

  const page: PageDesSoirees = {
    maintenant,
    trenteJours: { soirees: 12, avant: 9, invites: 130, quiz: 31, questions: 420, invitesMediane: 9.5 },
    parJourDeLaSemaine: [1, 0, 2, 1, 9, 14, 3],
    parTaille: [4, 10, 9, 5, 2],
    historique: [
      { id: '2026-10-13-k1x2y-ab12cd', spaceId: 'lea', salon: { nom: 'Le salon de Léa', avatar: '🦊' }, quand: maintenant - 72 * 60_000, invites: 14, quiz: 2, questions: 30, ouverte: true },
      { id: '2026-10-10-k0a1b-ef34gh', spaceId: 'tom', salon: { nom: 'Le salon de Tom', avatar: null }, quand: Date.UTC(2026, 9, 10, 19), invites: 9, quiz: 3, questions: 45, ouverte: false },
    ],
  }
  const bas = lu(React.createElement(BilanDesSoireesDuQg, { page }))
  assert.doesNotMatch(bas, /undefined|NaN/)
  assert.match(bas, /Invités par soirée<\/span><span class="qg-tuile-valeur num">9,5<\/span>/)
  assert.match(bas, /Quiz par soirée<\/span><span class="qg-tuile-valeur num">2,6<\/span>/)
  // Chaque barre se dit en une phrase au lecteur d'écran ; la plus haute touche le haut de sa zone.
  assert.match(bas, /<span class="sr-only">samedi : 14 soirées<\/span>/)
  assert.match(bas, /<span class="sr-only">21 invités et plus : 2 soirées<\/span>/)
  assert.match(bas, /<span class="sr-only">mardi : 0 soirée<\/span>/)
  assert.equal(bas.match(/height:100%/g)?.length, 2, 'une barre au sommet par graphique')
  // Le mois : la date courte, le salon, ses chiffres — et celle qui n'est pas encore close le dit.
  assert.match(bas, /<th scope="row">mar\. 13 oct\.<\/th><td class="qg-tableau-texte">Le salon de Léa<span class="muted"> · pas encore close<\/span><\/td>/)
  assert.match(bas, /<th scope="row">sam\. 10 oct\.<\/th><td class="qg-tableau-texte">Le salon de Tom<\/td>/)
})
