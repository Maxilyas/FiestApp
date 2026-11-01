// Les fêtes du 1er novembre 2026 — la Saint-Valentin, Pâques, la Fête de la
// musique, l'été, la rentrée —, à partir de 2027 : une fête tous les deux
// mois, chacune son légendaire peint, sa gerbe, et un timbre par an dans le
// carnet des fêtes (`shared/timbres.ts`), que les trois d'avant ont aussi.
// Ni joker ni gardien pour les cinq neuves : le quiz du jour et la soirée les
// ouvrent, rien d'autre (`cabinet-catalogue.test.ts`, `expedition-saison.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecrire,
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
import { ProfileStore } from '../src/auth/profiles'
import { calendrierDesSoirees, laureatsDeSaison } from '../src/core/saisons'
import { SAISONS, bornesDe, paquesDe, periodeDu, periodeDuMillesime, saison } from '../../shared/saisons'
import { LEGENDAIRES, legendairesDebloques } from '../../shared/legendaires'
import { LEGENDAIRES_A_JOKER } from '../../shared/jokers'
import { GERBES, gerbesOuvertes } from '../../shared/gerbes'
import { carnetDesFetes, cleDuTimbre, compteDuCarnet, jourDit, periodeDite, timbreDe, timbresDe } from '../../shared/timbres'
import { aPorterDesFetes } from '../../shared/gains'
import { gainVide } from '../../shared/profil'

ProfileStore.tirageEclat = () => false
// Ce fichier date ses soirées lui-même : il rouvre le calendrier que le banc ferme.
calendrierDesSoirees.periodeDu = periodeDu

test('Pâques suit la lune : son dimanche chaque année, et sa fête du vendredi saint au lundi', () => {
  // Des dimanches de Pâques connus — le plus tôt possible (22 mars) et le plus tard (25 avril) compris.
  const connus: Record<number, string> = {
    2024: '2024-03-31',
    2025: '2025-04-20',
    2026: '2026-04-05',
    2027: '2027-03-28',
    2028: '2028-04-16',
    2029: '2029-04-01',
    2030: '2030-04-21',
    2038: '2038-04-25',
    2285: '2285-03-22',
  }
  for (const [annee, jour] of Object.entries(connus)) assert.equal(paquesDe(Number(annee)), jour, annee)
  for (let a = 2027; a <= 2126; a++) {
    const p = paquesDe(a)
    assert.ok(p >= `${a}-03-22` && p <= `${a}-04-25`, p)
    assert.equal(new Date(`${p}T12:00:00Z`).getUTCDay(), 0, `${p} est un dimanche`)
  }
  assert.deepEqual(bornesDe(saison('paques')!, 2027), { debut: '2027-03-26', fin: '2027-03-29' })
  assert.deepEqual(bornesDe(saison('paques')!, 2038), { debut: '2038-04-23', fin: '2038-04-26' })
})

test('les huit fêtes, à la date de Paris — les cinq neuves à partir de 2027 seulement, jamais deux le même jour', () => {
  const de = (jour: string) => periodeDu(jour)?.saison.key ?? null
  // 2026 : aucune des cinq — elles n'existaient pas, et un recalcul de l'historique n'en ouvrira rien (`depuis`).
  for (const jour of ['2026-02-14', '2026-04-05', '2026-06-21', '2026-08-01', '2026-09-03']) assert.equal(de(jour), null, jour)
  const attendus: [string, string | null][] = [
    ['2027-02-11', null],
    ['2027-02-12', 'saint-valentin'],
    ['2027-02-15', 'saint-valentin'],
    ['2027-02-16', null],
    ['2027-03-25', null],
    ['2027-03-26', 'paques'],
    ['2027-03-29', 'paques'],
    ['2027-03-30', null],
    ['2028-04-14', 'paques'],
    ['2028-04-17', 'paques'],
    ['2027-06-18', null],
    ['2027-06-19', 'musique'],
    ['2027-06-22', 'musique'],
    ['2027-07-13', null],
    ['2027-07-14', 'ete'],
    ['2027-08-15', 'ete'],
    ['2027-08-16', null],
    ['2027-09-01', 'rentree'],
    ['2027-09-07', 'rentree'],
    ['2027-09-08', null],
    // Les trois d'avant n'ont pas bougé.
    ['2026-10-25', 'halloween'],
    ['2026-12-25', 'noel'],
    ['2027-01-01', 'nouvel-an'],
  ]
  for (const [jour, cle] of attendus) assert.equal(de(jour), cle, jour)
  for (let a = 2027; a <= 2046; a++) {
    const periodes = SAISONS.map(s => ({ cle: s.key, ...periodeDuMillesime(s, a) }))
    for (const p of periodes) for (const q of periodes) if (p !== q) assert.ok(p.fin < q.debut || q.fin < p.debut, `${p.cle} et ${q.cle} en ${a}`)
  }
})

test('chaque fête a son légendaire et sa gerbe, que sa saison ouvre ; les cinq neuves n’ont ni joker ni Expédition', () => {
  for (const s of SAISONS) {
    const l = LEGENDAIRES.find(x => x.key === s.legendaire)
    assert.ok(l, s.key)
    assert.equal(l!.saison, s.key)
    const fetee = new Map([[`saison:${s.key}`, 1]])
    assert.deepEqual(legendairesDebloques(fetee), [s.legendaire], `${s.key} ouvre ${s.legendaire}, et lui seul`)
    const gerbes = GERBES.filter(g => 'fete' in g.par && g.par.fete === s.key)
    assert.equal(gerbes.length, 1, `${s.key} : une gerbe`)
    assert.deepEqual(gerbesOuvertes(fetee), ['confettis', gerbes[0].key], `${s.key} : sa gerbe s’ouvre avec elle`)
    assert.ok(s.jours >= 2 && s.periode && s.court && s.emoji, s.key)
  }
  for (const cle of ['lg:rose', 'lg:oeuf', 'lg:gramophone', 'lg:coquillage', 'lg:cartable']) {
    assert.ok(!LEGENDAIRES_A_JOKER.includes(cle), cle)
    assert.equal(LEGENDAIRES.find(l => l.key === cle)?.aussi, undefined, `${cle} : sa saison seule`)
  }
  // Ouvert à la fin d'une partie, le légendaire d'une fête fait porter sa gerbe.
  assert.deepEqual(aPorterDesFetes(['lg:oeuf']), [{ piece: 'gerbe', cle: 'printemps', nom: 'Le printemps', par: 'Pâques' }])
  assert.deepEqual(aPorterDesFetes(['lg:phenix']), [])
})

test('un timbre par fête et par an : sa clé, et le carnet, page par page', () => {
  assert.equal(cleDuTimbre('nouvel-an', 2027), 'timbre:nouvel-an:2027')
  assert.equal(timbreDe('timbre:nouvel-an:2027')?.saison.key, 'nouvel-an')
  assert.equal(timbreDe('paques:2027')?.millesime, 2027)
  for (const faux of ['timbre:inconnue:2027', 'timbre:paques:27', 'saison:paques', 42, null]) assert.equal(timbreDe(faux), null, String(faux))
  assert.deepEqual(
    timbresDe(new Map([['timbre:paques:2027', 1], ['saison:paques', 1], ['timbre:halloween:2026', 2], ['hf:phenix', 1], ['timbre:noel:2026', 0]])),
    ['halloween:2026', 'paques:2027'],
  )
  const etats = (timbres: string[], jour: string) => carnetDesFetes(timbres, jour).map(p => [p.millesime, p.cases.map(c => `${c.fete} ${c.etat}`)])
  // Le 1er novembre 2026 : une page — Halloween, la première fête du carnet, en cours ; Noël à venir.
  assert.deepEqual(etats([], '2026-11-01'), [[2026, ['halloween en-cours', 'noel a-venir']]])
  // Le lendemain, Halloween passé sans lui : manqué — il ne se rattrape pas.
  assert.deepEqual(etats([], '2026-11-02'), [[2026, ['halloween manque', 'noel a-venir']]])
  // Le 31 décembre, le Nouvel An 2027 a commencé : sa page s'ouvre, ses huit fêtes dans l'ordre de l'année.
  assert.deepEqual(etats(['halloween:2026'], '2026-12-31'), [
    [2026, ['halloween gagne', 'noel manque']],
    [2027, ['nouvel-an en-cours', 'saint-valentin a-venir', 'paques a-venir', 'musique a-venir', 'ete a-venir', 'rentree a-venir', 'halloween a-venir', 'noel a-venir']],
  ])
  const paques = carnetDesFetes(['halloween:2026', 'paques:2027'], '2027-03-28')
  assert.deepEqual(
    paques[1].cases.find(c => c.fete === 'paques'),
    { fete: 'paques', millesime: 2027, debut: '2027-03-26', fin: '2027-03-29', etat: 'gagne' },
  )
  // Compté sur ses pages : l'année en cours entière, ses fêtes à venir comprises.
  assert.deepEqual(compteDuCarnet(['halloween:2026', 'paques:2027'], '2027-03-28'), { acquis: 2, total: 10 })
  // En dates : Pâques, qui suit la lune, ne se dit qu'ainsi.
  assert.equal(periodeDite('2027-03-26', '2027-03-29'), 'du 26 au 29 mars')
  assert.equal(periodeDite('2026-12-30', '2027-01-02'), 'du 30 décembre au 2 janvier')
  assert.equal(jourDit('2027-09-01'), '1er septembre')
})

test('une soirée d’une fête range sa saison et le timbre de son millésime ; une fête neuve, avant 2027, rien', () => {
  const gains = [{ profileId: 'alice', gain: { ...gainVide(), reponses: 12 } }]
  const joue = (t: number) => [{ answered: true, createdAt: t }]
  // Le samedi saint 2027, 20 h à Paris.
  assert.deepEqual(
    laureatsDeSaison(joue(Date.UTC(2027, 2, 27, 19)), gains).map(l => [l.badge, l.title]),
    [
      ['saison:paques', 'Saison : Pâques'],
      ['timbre:paques:2027', 'Timbre : Pâques 2027'],
    ],
  )
  assert.deepEqual(laureatsDeSaison(joue(Date.UTC(2026, 3, 4, 18)), gains), [], 'Pâques 2026 : la fête n’existait pas')
  // Le réveillon de 2026 range le timbre du Nouvel An 2027 : son millésime est l'année de sa fin.
  assert.deepEqual(laureatsDeSaison(joue(Date.UTC(2026, 11, 31, 21)), gains).map(l => l.badge), ['saison:nouvel-an', 'timbre:nouvel-an:2027'])
})

// ── Au quiz du jour ─────────────────────────────────────────────────────

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

async function jouer(banc: Banc, cookie: string) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  while (etat.question) {
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: 0 })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

/** Un jour de quiz du jour déjà joué, écrit comme la base l'aurait gardé. */
const unJourJoue = (banc: Banc, id: string, jour: string) =>
  base(banc, db =>
    db
      .prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 0, 0, 1, 0)`)
      .run(id, jour),
  )

test('au quiz du jour : deux jours de Pâques ouvrent l’Œuf d’or, sa gerbe et le timbre ; l’an d’après, le timbre seul', async () => {
  // Le samedi saint 2027, 10 h à Paris ; le vendredi déjà joué.
  const horloge = { t: Date.UTC(2027, 2, 27, 9) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id)
    unJourJoue(banc, id, '2027-03-26')
    const accueil = async () => (await lire(banc, alice, '/api/joueur/moi?accueil')).corps.profile
    assert.deepEqual((await accueil()).fete, { cle: 'paques', timbre: false }, 'la tuile du quiz du jour annonce la fête')
    assert.deepEqual((await lire(banc, alice, '/api/jour')).corps.saison, {
      cle: 'paques',
      nom: 'Pâques',
      legendaire: 'lg:oeuf',
      joues: 1,
      requis: 2,
      periode: 'du vendredi saint au lundi de Pâques',
      millesime: 2027,
    })

    const fin = await jouer(banc, alice)
    assert.deepEqual(fin.legendaires, ['lg:oeuf'])
    assert.equal(fin.timbre, 'paques:2027')
    assert.equal(fin.saison, undefined, 'le légendaire et le timbre à lui : la fête ne s’annonce plus')
    const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    assert.ok(moi.legendaires.includes('lg:oeuf'))
    assert.ok(moi.gerbes.includes('printemps'), 'la gerbe du printemps s’ouvre avec lui')
    assert.deepEqual(moi.carnet, { timbres: ['paques:2027'], jour: '2027-03-27' })
    // Ni sur l'étagère ni au compte des badges : le timbre a son carnet.
    assert.ok(!moi.vitrine.some((b: any) => b.key.startsWith('timbre:')))
    assert.equal(moi.badges, 0)
    assert.deepEqual((await accueil()).fete, { cle: 'paques', timbre: true })
    const lignes = base(banc, db => db.prepare(`SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? ORDER BY badge`).all(id))
    assert.deepEqual(lignes, [
      { badge: 'saison:paques', soiree_id: '#jour:2027-03-27' },
      { badge: 'timbre:paques:2027', soiree_id: '#jour:2027-03-27' },
    ])

    // Pâques 2028 tombe le 16 avril : le vendredi saint déjà joué, le samedi pour le timbre — le légendaire est déjà à lui.
    horloge.t = Date.UTC(2028, 3, 15, 8)
    unJourJoue(banc, id, '2028-04-14')
    assert.deepEqual((await lire(banc, alice, '/api/jour')).corps.saison, {
      cle: 'paques',
      nom: 'Pâques',
      legendaire: 'lg:oeuf',
      joues: 1,
      requis: 2,
      periode: 'du vendredi saint au lundi de Pâques',
      millesime: 2028,
      aLeLegendaire: true,
    })
    const encore = await jouer(banc, alice)
    assert.equal(encore.legendaires, undefined, 'rien de neuf à porter')
    assert.equal(encore.timbre, 'paques:2028', 'mais un timbre de plus au carnet')
    assert.deepEqual((await lire(banc, alice, '/api/joueur/moi')).corps.profile.carnet.timbres, ['paques:2027', 'paques:2028'])
  } finally {
    await banc.close()
  }
})

test('les jours d’Halloween 2026 joués avant les timbres rangent le leur au démarrage qui les apporte (`VERSION_DES_JOURS`)', async () => {
  const banc = await demarrer({ horlogeDuJour: () => Date.UTC(2026, 10, 5, 9) })
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id)
    for (const jour of ['2026-10-26', '2026-10-27', '2026-10-28']) unJourJoue(banc, id, jour)
    // Ce qu'un serveur d'avant les timbres en avait gardé : la saison, sous le troisième jour, et la relecture d'alors.
    base(banc, db => {
      db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'saison:halloween', '#jour:2026-10-28', '', '🎃', 'Saison : Halloween', 1)`,
      ).run(id)
      db.prepare(`UPDATE jour_meta SET valeur = '1' WHERE cle = 'relecture_des_jours'`).run()
    })
    await banc.redemarrer()
    // La relecture rejoue aussi les hauts faits de ces jours (le Lève-tôt des parties du matin) : seules la saison et le timbre comptent ici.
    const lignes = base(banc, db =>
      db.prepare(`SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? AND (badge LIKE 'saison:%' OR badge LIKE 'timbre:%') ORDER BY badge`).all(id),
    )
    assert.deepEqual(lignes, [
      { badge: 'saison:halloween', soiree_id: '#jour:2026-10-28' },
      { badge: 'timbre:halloween:2026', soiree_id: '#jour:2026-10-28' },
    ])
    const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    assert.deepEqual(moi.carnet.timbres, ['halloween:2026'])
  } finally {
    await banc.close()
  }
})

// ── En soirée ───────────────────────────────────────────────────────────

/** Un quiz d'une question, que tous les invités jouent, puis que l'écran commun termine. */
async function jouerUneQuestion(host: Socket, quizId: string, salle: Invite[]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  await vue(sessionId, v => v.phase === 'question', 'la question')
  const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
  for (const qui of salle) {
    const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
    assert.equal(ack.ok, true, ack.error)
  }
  await revelee
  const podium = vue(sessionId, v => v.phase === 'finished', 'le podium')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  await podium
  ;(host as any).emit('host:endSession', { sessionId })
}

test('une soirée d’Halloween 2026 close avant les timbres range le sien au démarrage qui les apporte (`VERSION_BAREME`)', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    let host = await ecranCommun(banc.url, cookie)
    const salle = [await invite(banc.url, 'Alice', '', { cookie: alice }), await invite(banc.url, 'Bob', '🐻')]
    await jouerUneQuestion(host, quiz, salle)
    host.close()
    // Jouée le soir d'Halloween 2026.
    const locale = new Database(banc.dbPath)
    locale.prepare('UPDATE answer_log SET created_at = ?').run(Date.UTC(2026, 9, 31, 20, 0))
    locale.close()
    await banc.redemarrer()
    host = await ecranCommun(banc.url, cookie)
    const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    await toast
    host.close()
    assert.deepEqual((await lire(banc, alice, '/api/joueur/moi')).corps.profile.carnet.timbres, ['halloween:2026'], 'témoin : la clôture le range')
    // Ce qu'un serveur d'avant les timbres en avait gardé : pas de timbre, et ses lignes d'expérience au barème 7.
    base(banc, d => {
      d.prepare(`DELETE FROM profile_badges WHERE badge LIKE 'timbre:%'`).run()
      d.prepare(`UPDATE profile_xp SET detail = json_set(detail, '$.v', 7) WHERE soiree_id NOT LIKE '#%'`).run()
    })
    await banc.redemarrer()
    assert.deepEqual((await lire(banc, alice, '/api/joueur/moi')).corps.profile.carnet.timbres, ['halloween:2026'])
  } finally {
    await banc.close()
  }
})
