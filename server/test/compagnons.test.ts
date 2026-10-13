// Les compagnons de la boutique (le choix du 13 octobre 2026) : achetés
// 1000 confettis à leur première forme, ils grandissent avec les bonnes
// réponses données en les portant — celles qui rapportent un confetti, en
// soirée, au quiz du jour, en campagne —, à 100, 300 et 500. Une forme
// atteinte ne se perd jamais, l'on peut porter une forme d'avant, et qui
// portait sa plus haute porte la nouvelle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  attendre,
  baseDEssai,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  estimation,
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
import {
  COMPAGNONS,
  FORMES_DES_COMPAGNONS,
  JUSTES_DES_FORMES,
  PRIX_D_UN_COMPAGNON,
  formeDeCompagnon,
  formesOuvertes,
  prochaineForme,
  rangAtteint,
} from '../../shared/compagnons'
import { brilleChez } from '../../shared/profil'
import { cibleEclat } from '../../shared/legendaires'
import { ceQuIlAPorter, cibleDeLEclat, lignesDeLEssai } from '../../shared/loge'
import { CATEGORIES } from '../../shared/categories'
import React from 'react'
import { annonceDuChoix } from '../../client/src/components/choix'

ProfileStore.tirageEclat = () => false

// ── Le catalogue, pur ─────────────────────────────────────────────────────

test('trois compagnons, quatre formes chacun, la rareté qui monte avec eux', () => {
  assert.deepEqual(
    COMPAGNONS.map(c => c.key),
    ['loup', 'chat', 'tortue'],
  )
  assert.equal(FORMES_DES_COMPAGNONS.length, 12)
  assert.equal(new Set(FORMES_DES_COMPAGNONS.map(f => f.key)).size, 12, 'une clé par forme')
  for (const c of COMPAGNONS) {
    assert.deepEqual(
      c.formes.map(f => f.rarete),
      ['commune', 'rare', 'epique', 'legendaire'],
      `${c.nom} : commune, rare, épique, légendaire`,
    )
    assert.deepEqual(
      c.formes.map(f => f.rang),
      [0, 1, 2, 3],
    )
    for (const f of c.formes) {
      assert.match(f.key, new RegExp(`^cp:${c.key}-[a-z]+$`))
      assert.equal(formeDeCompagnon(f.key), f)
    }
  }
  assert.equal(formeDeCompagnon('lg:phenix'), undefined)
  assert.equal(formeDeCompagnon('cp:loup'), undefined, 'le compagnon n’est pas une forme')
  assert.equal(PRIX_D_UN_COMPAGNON, 1000)
  assert.deepEqual([...JUSTES_DES_FORMES], [0, 100, 300, 500])
})

test('il grandit à 100, 300 et 500 bonnes réponses ; ce qui reste se compte', () => {
  assert.deepEqual(
    [0, 99, 100, 299, 300, 499, 500, 4000].map(rangAtteint),
    [0, 0, 1, 1, 2, 2, 3, 3],
  )
  assert.deepEqual(prochaineForme({ compagnon: 'loup', rang: 0, justes: 62 }), { forme: formeDeCompagnon('cp:loup-jeune'), encore: 38 })
  assert.deepEqual(prochaineForme({ compagnon: 'chat', rang: 2, justes: 420 }), { forme: formeDeCompagnon('cp:chat-esprit'), encore: 80 })
  assert.equal(prochaineForme({ compagnon: 'tortue', rang: 3, justes: 900 }), null, 'la forme ultime n’a pas de suite')
  assert.deepEqual(
    formesOuvertes([
      { compagnon: 'loup', rang: 1 },
      { compagnon: 'tortue', rang: 0 },
    ]),
    ['cp:loup-louveteau', 'cp:loup-jeune', 'cp:tortue-bebe'],
  )
})

test('l’Éclat tombe sur le compagnon qu’il porte, et le suit sous toutes ses formes', () => {
  assert.equal(cibleEclat('cp:loup-jeune', '🦊'), 'cp:loup-jeune')
  const profil = { eclats: ['cp:loup-louveteau'] }
  assert.equal(brilleChez(profil, 'cp:loup-louveteau'), true)
  assert.equal(brilleChez(profil, 'cp:loup-ultime'), true, 'le louveteau éclaté a grandi : il brille encore')
  assert.equal(brilleChez(profil, 'cp:chat-chaton'), false, 'un autre compagnon ne brille pas pour lui')
  assert.equal(brilleChez({ ...profil, eclatsEteints: ['cp:loup-louveteau'] }, 'cp:loup-adulte'), false, 'éteint, il est éteint partout')
  // Sa version rare n'existe pas encore : la loge ne propose rien à choisir sous lui.
  assert.equal(cibleDeLEclat({ avatar: '🦊', legendaire: 'cp:loup-jeune' }), null)
})

test('la loge le dit : « Compagnon · Le Loup » à l’essai, « Tu portes le jeune loup » à l’oreille, et chaque forme atteinte est du nouveau', () => {
  assert.deepEqual(lignesDeLEssai({ legendaire: 'cp:loup-jeune' }, { niveau: 3 }), [{ piece: 'avatar', nom: 'Le jeune loup', detail: 'Compagnon · Le Loup' }])
  assert.equal(annonceDuChoix({ legendaire: 'cp:tortue-ile' }), 'Tu portes la tortue-île.')
  const profil = {
    hautsFaits: [],
    vitrine: [],
    legendaires: [],
    divins: [],
    niveau: 1,
    ouvertes: ['mat'],
    eclats: [],
    sentiers: {},
    compagnons: [{ compagnon: 'loup', rang: 1 }],
  }
  const avatars = ceQuIlAPorter(profil as any).avatar
  assert.ok(avatars.includes('cp:loup-louveteau') && avatars.includes('cp:loup-jeune'), 'ses deux formes')
  assert.ok(!avatars.includes('cp:loup-adulte'), 'pas celle qu’il n’a pas atteinte')
})

/** Le rayon des compagnons, rendu pour ce profil. */
async function rayon(profil: object): Promise<string> {
  Object.assign(globalThis, { React })
  const module = await import(new URL('../../client/src/components/RayonDesCompagnons.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module.RayonDesCompagnons, { profil, busy: false, acheter: async () => null }))
}

test('la boutique : trois compagnons, leurs quatre formes et ce qu’elles demandent — le prix, ou où il en est', async () => {
  const boutique = (solde: number, compagnons?: object[]) => ({ confettis: { gagnes: solde, depenses: 0, solde }, possedes: [], porte: null, jour: '2026-10-13', compagnons })
  const neuf = await rayon({ legendaire: null, boutique: boutique(1200) })
  assert.equal(neuf.match(/<article class="card compagnon-carte"/g)?.length, 3)
  assert.equal(neuf.match(/>L’acheter<\/button>/g)?.length, 3, 'de quoi les acheter tous les trois')
  assert.equal(neuf.match(/class="compagnon-prix">🎊 1000</g)?.length, 3)
  // Chaque forme dit ce qu'elle demande : l'achat, puis 100, 300, 500.
  assert.equal(neuf.match(/<span class="compagnon-seuil" aria-hidden="true">Achat<\/span>/g)?.length, 3)
  for (const n of ['100', '300', '500']) assert.equal(neuf.match(new RegExp(`<span class="compagnon-seuil" aria-hidden="true">${n}</span>`, 'g'))?.length, 3, n)
  // Le loup grandi d'une forme, porté ; trop peu de confettis pour les autres.
  const avecLeLoup = await rayon({ legendaire: 'cp:loup-jeune', boutique: boutique(50, [{ compagnon: 'loup', rang: 1, justes: 162 }]) })
  assert.match(avecLeLoup, /À toi · Le jeune loup, deuxième forme/)
  assert.match(avecLeLoup, /162 sur 300 bonnes réponses en le portant\s: le loup adulte/)
  assert.match(avecLeLoup, /<a class="link-inline" href="\/profil#avatar">Tu le portes · en changer<\/a>/)
  assert.equal(avecLeLoup.match(/>Encore 950 confettis</g)?.length, 2)
  assert.doesNotMatch(avecLeLoup, /<\/button>/, 'rien à acheter à ce prix-là')
  // À sa forme ultime, il n'a plus rien à atteindre.
  assert.match(await rayon({ legendaire: null, boutique: boutique(0, [{ compagnon: 'tortue', rang: 3, justes: 620 }]) }), /Sa forme ultime\s: son monde prend vie\./)
  // La tortue se dit au féminin : « Tu le portes » se lisait de travers sous elle.
  const avecLaTortue = await rayon({ legendaire: 'cp:tortue-jeune', boutique: boutique(0, [{ compagnon: 'tortue', rang: 1, justes: 120 }]) })
  assert.match(avecLaTortue, /120 sur 300 bonnes réponses en la portant\s: la tortue-bosquet/)
  assert.match(avecLaTortue, /<a class="link-inline" href="\/profil#avatar">Tu la portes · en changer<\/a>/)
  assert.match(avecLaTortue, /aria-label="Les formes de la Tortue-île"/)
})

// ── Sur un serveur jetable ────────────────────────────────────────────────

/** Samedi 26 septembre 2026, 10 h à Paris : aucune saison. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
/** Douze questions de chacune des douze catégories : de quoi jouer une série. */
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

function enBase<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => enBase(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des confettis : une partie du quiz du jour d'avant, avec ses bonnes réponses. */
function confettis(banc: Banc, profileId: string, jour: string, justes: number) {
  enBase(banc, db =>
    db
      .prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 0, ?, 1, 0)`,
      )
      .run(profileId, jour, justes),
  )
}

/** Une série de campagne d'avant, ses `n` bonnes réponses données en portant `compagnon`. */
function serieEnPortant(banc: Banc, profileId: string, id: string, n: number, compagnon: string | null) {
  enBase(banc, db => {
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le) VALUES (?, ?, '[]', ?, 3, ?, 1, 2)`).run(
      id,
      profileId,
      n,
      n,
    )
    const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon) VALUES (?, ?, ?, 0, 1, 2, ?)')
    db.transaction(() => {
      for (let i = 0; i < n; i++) reponse.run(id, i, `${id}-${i}`, compagnon)
    })()
  })
}

const lire = async (banc: Banc, cookie: string) => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
const acheter = (banc: Banc, cookie: string | undefined, compagnon: string, porter?: boolean) =>
  ecrire(banc.url, '/api/joueur/compagnons', { compagnon, ...(porter === false && { porter }) }, cookie).then(async r => ({
    status: r.status,
    corps: (await r.json()) as any,
  }))
const porter = (banc: Banc, cookie: string, patch: object) =>
  ecrire(banc.url, '/api/joueur/moi', patch, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))

test('un compagnon s’achète 1000 confettis à sa première forme, et se porte : ce qu’on n’a pas est refusé en clair', () =>
  avecBanc(async banc => {
    assert.equal((await acheter(banc, undefined, 'loup')).status, 401, 'sans profil, pas de boutique')
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    assert.equal((await lire(banc, cookie)).compagnons, undefined, 'sans compagnon, rien à lire')

    const fauche = await acheter(banc, cookie, 'loup')
    assert.equal(fauche.status, 400)
    assert.equal(fauche.corps.error, 'Il te manque 1000 confettis pour le Loup')
    assert.equal((await acheter(banc, cookie, 'dragon')).corps.error, 'Ce compagnon n’existe pas')

    confettis(banc, alice, '2026-09-20', 1200)
    const achat = await acheter(banc, cookie, 'loup')
    assert.equal(achat.status, 200, achat.corps.error)
    assert.equal(achat.corps.profile.legendaire, 'cp:loup-louveteau', 'acheté, et porté aussitôt')
    assert.deepEqual(achat.corps.profile.compagnons, [{ compagnon: 'loup', rang: 0 }])
    assert.deepEqual(achat.corps.boutique.confettis, { gagnes: 1200, depenses: 1000, solde: 200 })
    assert.deepEqual(achat.corps.boutique.compagnons, [{ compagnon: 'loup', rang: 0, justes: 0 }])
    assert.equal((await acheter(banc, cookie, 'loup')).corps.error, 'Le Loup est déjà à toi')
    assert.equal((await acheter(banc, cookie, 'chat')).corps.error, 'Il te manque 800 confettis pour le Chat des lanternes')

    // Ce qu'il n'a pas ne se porte pas : une forme pas encore atteinte, un compagnon pas acheté.
    const tropTot = await porter(banc, cookie, { legendaire: 'cp:loup-jeune' })
    assert.equal(tropTot.status, 400)
    assert.equal(tropTot.corps.error, 'Le jeune loup arrive à 100 bonnes réponses données en le portant')
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:tortue-bebe' })).corps.error, 'La Tortue-île s’achète d’abord, à la boutique')

    // Un emoji l'ôte ; il se reporte d'un geste.
    assert.equal((await porter(banc, cookie, { avatar: '🦊' })).corps.profile.legendaire, null)
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:loup-louveteau' })).corps.profile.legendaire, 'cp:loup-louveteau')

    // Acheté sans le porter : celui qu'il porte reste sur lui.
    confettis(banc, alice, '2026-09-21', 1000)
    const garde = await acheter(banc, cookie, 'chat', false)
    assert.equal(garde.status, 200, garde.corps.error)
    assert.equal(garde.corps.profile.legendaire, 'cp:loup-louveteau')
    assert.deepEqual(
      garde.corps.profile.compagnons.map((c: any) => c.compagnon),
      ['loup', 'chat'],
    )
    assert.deepEqual(garde.corps.boutique.confettis, { gagnes: 2200, depenses: 2000, solde: 200 })
    // La tortue se dit au féminin, jusque dans le refus.
    confettis(banc, alice, '2026-09-22', 1000)
    assert.equal((await acheter(banc, cookie, 'tortue', false)).status, 200)
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:tortue-jeune' })).corps.error, 'La jeune tortue arrive à 100 bonnes réponses données en la portant')

    // La salle le voit : il remplace son emoji à l'instantané.
    assert.equal(
      enBase(banc, db => (db.prepare('SELECT legendaire FROM profiles WHERE id = ?').get(alice) as { legendaire: string }).legendaire),
      'cp:loup-louveteau',
    )
  }))

test('il grandit avec les bonnes réponses données en le portant ; qui le portait à sa plus haute forme porte la nouvelle ; une forme atteinte ne se perd jamais', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, '2026-09-20', 1000)
    assert.equal((await acheter(banc, cookie, 'loup')).status, 200)

    // 99 bonnes réponses en le portant, et une sans lui : pas encore.
    serieEnPortant(banc, alice, 's1', 99, 'loup')
    serieEnPortant(banc, alice, 's2', 1, null)
    let moi = await lire(banc, cookie)
    assert.deepEqual(moi.boutique.compagnons, [{ compagnon: 'loup', rang: 0, justes: 99 }])
    assert.equal(moi.legendaire, 'cp:loup-louveteau')

    // La centième : le jeune loup. Il portait sa plus haute forme : il porte la nouvelle.
    serieEnPortant(banc, alice, 's3', 1, 'loup')
    moi = await lire(banc, cookie)
    assert.deepEqual(moi.boutique.compagnons, [{ compagnon: 'loup', rang: 1, justes: 100 }])
    assert.deepEqual(moi.compagnons, [{ compagnon: 'loup', rang: 1 }])
    assert.equal(moi.legendaire, 'cp:loup-jeune', 'il a grandi pour de bon')

    // Il préfère le louveteau : il le garde, même quand le loup grandit encore.
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:loup-louveteau' })).corps.profile.legendaire, 'cp:loup-louveteau')
    serieEnPortant(banc, alice, 's4', 200, 'loup')
    moi = await lire(banc, cookie)
    assert.deepEqual(moi.boutique.compagnons, [{ compagnon: 'loup', rang: 2, justes: 300 }])
    assert.equal(moi.legendaire, 'cp:loup-louveteau', 'qui avait choisi une forme d’avant la garde')
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:loup-adulte' })).status, 200)

    // Ses bonnes réponses s'en vont (une série effacée) : la forme reste.
    enBase(banc, db => db.prepare('DELETE FROM campagne_reponses').run())
    moi = await lire(banc, cookie)
    assert.deepEqual(moi.boutique.compagnons, [{ compagnon: 'loup', rang: 2, justes: 0 }])
    assert.equal(moi.legendaire, 'cp:loup-adulte')
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:loup-jeune' })).status, 200, 'une forme d’avant se porte toujours')
    assert.equal(
      (await porter(banc, cookie, { legendaire: 'cp:loup-ultime' })).corps.error,
      'Le loup des étoiles arrive à 500 bonnes réponses données en le portant',
    )
  }))

/** Les questions de sa série, lues en base : le téléphone ne voit jamais la bonne avant sa réponse. */
function bonnes(banc: Banc, serie: string): number[] {
  return enBase(banc, db => {
    const { questions } = db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }
    return (JSON.parse(questions) as { bonne: number }[]).map(q => q.bonne)
  })
}

test('en campagne et au quiz du jour, chaque réponse retient le compagnon qu’il porte', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, '2026-09-20', 1000)
    assert.equal((await acheter(banc, cookie, 'tortue')).status, 200)

    // Une série : deux justes, une fausse.
    const s = (await (await ecrire(banc.url, '/api/campagne/serie', {}, cookie)).json()) as any
    assert.ok(s.id, s.error)
    const reponses = bonnes(banc, s.id)
    for (const [i, juste] of [true, true, false].entries()) {
      const choix = juste ? reponses[i] : (reponses[i] + 1) % 2
      const r = await ecrire(banc.url, `/api/campagne/serie/${s.id}/reponse`, { index: i, choix }, cookie)
      assert.equal(r.status, 200)
    }
    assert.deepEqual(
      enBase(banc, db => db.prepare('SELECT juste, compagnon FROM campagne_reponses WHERE serie_id = ? ORDER BY position').all(s.id)),
      [
        { juste: 1, compagnon: 'tortue' },
        { juste: 1, compagnon: 'tortue' },
        { juste: 0, compagnon: 'tortue' },
      ],
    )

    // Le quiz du jour : toute la partie, sans compagnon d'abord pour la première.
    assert.equal((await porter(banc, cookie, { avatar: '🦊' })).status, 200)
    let etat = (await (await ecrire(banc.url, '/api/jour/commencer', {}, cookie)).json()) as any
    const questions = enBase(banc, db =>
      JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions),
    ) as { bonne: number }[]
    while (etat.question) {
      const i = etat.question.index
      if (i === 1) assert.equal((await porter(banc, cookie, { legendaire: 'cp:tortue-bebe' })).status, 200)
      const r = await ecrire(banc.url, '/api/jour/repondre', { jour: etat.jour, index: i, choix: questions[i].bonne }, cookie)
      assert.equal(r.status, 200)
      etat = await (await ecrire(banc.url, '/api/jour/suivante', {}, cookie)).json()
    }
    const lignes = enBase(banc, db => db.prepare('SELECT question, compagnon FROM jour_reponses WHERE profile_id = ? ORDER BY question').all(alice)) as {
      question: number
      compagnon: string | null
    }[]
    assert.equal(lignes.length, 10)
    assert.equal(lignes[0].compagnon, null, 'sans compagnon, rien à retenir')
    assert.ok(
      lignes.slice(1).every(l => l.compagnon === 'tortue'),
      'portée dès la deuxième question',
    )
    // Deux justes en campagne, neuf au quiz du jour.
    assert.deepEqual((await lire(banc, cookie)).boutique.compagnons, [{ compagnon: 'tortue', rang: 0, justes: 11 }])
  }))

// ── Une vraie soirée ──────────────────────────────────────────────────────

type Reponse = { choice: number } | { value: number }

/** Joue un quiz de bout en bout depuis l'écran commun, jusqu'à son podium, puis le referme. */
async function jouerQuiz(host: Socket, quizId: string, questions: [Invite, Reponse][][]): Promise<void> {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [qui, reponse] of questions[q]) {
      const action = 'choice' in reponse ? { type: 'answer', ...reponse } : { type: 'guess', ...reponse }
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action })
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

test('en soirée, ses bonnes réponses le nourrissent — les justes et l’estimation la plus proche — et la salle le voit grandir à la fin du quiz', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [
      qcm('Le ciel est bleu ?'),
      qcm('L’eau mouille ?'),
      qcm('La Lune est un fromage ?', ['Oui', 'Non'], 1),
      estimation('Combien de marches à la tour Eiffel ?', 1665),
    ])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, '2026-09-20', 1000)
    assert.equal((await acheter(banc, aliceCookie, 'loup')).status, 200)
    // 97 bonnes réponses en campagne : les trois de ce soir le font grandir.
    serieEnPortant(banc, alice, 'avant', 97, 'loup')

    const host = await ecranCommun(banc.url, cookie)
    const aliceTel = await invite(banc.url, 'Alice', '', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    const aliceALaSalle = (instantane: any) => instantane.players.find((p: any) => p.name === 'Alice')
    const grandi = attendre<any>(host, 'party:snapshot', s => aliceALaSalle(s)?.legendaire === 'cp:loup-jeune', 'le jeune loup à la salle', 15_000)

    // Alice : deux justes, une fausse, l'estimation la plus proche. Bob se trompe partout.
    await jouerQuiz(host, quiz, [
      [
        [aliceTel, { choice: 0 }],
        [bob, { choice: 1 }],
      ],
      [
        [aliceTel, { choice: 0 }],
        [bob, { choice: 1 }],
      ],
      [
        [aliceTel, { choice: 0 }],
        [bob, { choice: 0 }],
      ],
      [
        [aliceTel, { value: 1600 }],
        [bob, { value: 300 }],
      ],
    ])
    // Le quiz fini, il a grandi : la salle voit le jeune loup.
    await grandi
    let compagnons: any
    for (const limite = Date.now() + 8000; ; await patienter(100)) {
      compagnons = (await lire(banc, aliceCookie)).boutique.compagnons
      if (compagnons?.[0]?.justes >= 100 || Date.now() > limite) break
    }
    assert.deepEqual(compagnons, [{ compagnon: 'loup', rang: 1, justes: 100 }])
    // Ce soir : ses deux justes et son estimation la plus proche, rangées
    // dans son relevé comme ses confettis — la fausse n'y est pas.
    const releve = enBase(banc, db => {
      const { detail } = db.prepare(`SELECT detail FROM profile_xp WHERE profile_id = ? AND soiree_id NOT LIKE '#%'`).get(alice) as { detail: string }
      return JSON.parse(detail).releve
    })
    assert.deepEqual(releve.compagnons, { loup: 3 })

    // Chaque ligne du journal retient ce qu'il portait — Bob, rien —, le
    // miroir aussi : un réveil sur disque effacé la retrouve.
    const parJoueur = (lignes: { player_id: string; compagnon: string | null }[]) =>
      [...new Set(lignes.map(l => `${l.player_id === aliceTel.playerId ? 'Alice' : 'Bob'} ${l.compagnon}`))].sort()
    await patienter(400)
    assert.deepEqual(
      parJoueur(enBase(banc, db => db.prepare('SELECT player_id, compagnon FROM party_answers').all() as any)),
      ['Alice loup', 'Bob null'],
    )
    await banc.redemarrer({ disqueEfface: true })
    const locale = new Database(banc.dbPath)
    try {
      assert.deepEqual(parJoueur(locale.prepare('SELECT player_id, compagnon FROM answer_log').all() as any), ['Alice loup', 'Bob null'], 'le réveil les rend au journal')
    } finally {
      locale.close()
    }
  }))
