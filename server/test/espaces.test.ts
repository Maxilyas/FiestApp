// Là où les espaces partagent quelque chose sans le savoir.
//
// Le cloisonnement tient : soixante-dix tentatives de fuite n'ont rien fait
// passer d'un espace à l'autre. Trois failles cédaient pourtant, aux endroits
// que les espaces partagent en coulisse — la réserve d'inscriptions d'une
// adresse, la carrière d'un profil qui joue ici et là le même soir, le nom
// d'une soirée (tablée du 24 septembre, robustesse-espaces).
//
// Chaque test a son serveur jetable : une soirée jouée dans l'un fausserait
// l'expérience de l'autre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { io as clientIo } from 'socket.io-client'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  cookieDe,
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
import { ReserveDInscriptions, PAR_ADRESSE, PAR_SOIREE } from '../src/core/inscriptions'

// L'Éclat est un tirage, et son premier fait tomber un palier : ici, le
// hasard ne décide de rien.
ProfileStore.tirageEclat = () => false

// ── Outils ────────────────────────────────────────────────────────────────

/** Un espace de plus, ouvert par l'administrateur et activé par son animateur. */
async function espace(banc: Banc, login: string, slug: string) {
  const admin = await connexionAnimateur(banc.url)
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login, name: login, slug }, admin)
  assert.equal(cree.status, 201, `création de ${slug}`)
  const { activation } = (await cree.json()) as { activation: { token: string } }
  const active = await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: `motdepasse-${login}` })
  assert.ok(active.ok, `activation de ${slug}`)
  return { cookie: cookieDe(active), slug }
}

/** Lit la base permanente — le fichier qui tient le rôle de Turso. */
function lire<T = any>(banc: Banc, sql: string, ...args: unknown[]): T[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}

const profilDe = (banc: Banc, login: string): string =>
  lire<{ id: string }>(banc, 'SELECT id FROM profiles WHERE login = ?', login)[0].id

/** Les lignes d'expérience d'un profil, sans celle des paliers (`#paliers`). */
const lignesXp = (banc: Banc, profileId: string) =>
  lire<{ soiree_id: string; space_id: string; xp: number }>(
    banc,
    `SELECT soiree_id, space_id, xp FROM profile_xp WHERE profile_id = ? AND soiree_id NOT LIKE '#%' ORDER BY space_id`,
    profileId,
  )

/** Joue un quiz de bout en bout : chacun répond, la salle révèle, « Suivant », jusqu'au podium. */
async function jouerQuiz(host: Socket, quizId: string, reponses: [Invite, number][], questions: number) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 20_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [qui, choice] of reponses) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
      assert.equal(ack.ok, true, `réponse ${q + 1} refusée : ${ack.error}`)
    }
    await revelee
    suivante =
      q + 1 < questions
        ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `la question ${q + 2}`)
        : vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  ;(host as any).emit('host:endSession', { sessionId })
}

/** Un geste de fin de soirée depuis l'écran commun, et son toast. */
async function geste(host: Socket, event: 'host:closeParty' | 'host:discardParty') {
  const toast = attendre<any>(host, 'toast', () => true, event, 20_000)
  ;(host as any).emit(event, {})
  const t = await toast
  assert.equal(t.kind, 'info', `${event} a échoué : ${t.message}`)
}

/** Capture ce que le serveur écrit au journal pendant `f`. */
async function journal<T>(f: () => Promise<T>): Promise<{ lignes: string[]; valeur: T }> {
  const lignes: string[] = []
  const [log, warn] = [console.log, console.warn]
  console.log = (...a: unknown[]) => void lignes.push(a.map(String).join(' '))
  console.warn = (...a: unknown[]) => void lignes.push(a.map(String).join(' '))
  try {
    return { lignes, valeur: await f() }
  } finally {
    console.log = log
    console.warn = warn
  }
}

// ── E1. La réserve d'inscriptions : par adresse ET par espace ─────────────

test('deux soirées derrière la même box : la vague de l’une ne ferme pas la porte de l’autre', async () => {
  const banc = await demarrer({ online: true, publicUrl: 'http://localhost' })
  const ouverts: Socket[] = []
  /** Une connexion derrière le proxy : l'adresse se lit dans l'en-tête. */
  const derriere = (xff: string) => {
    const s = clientIo(banc.url, { transports: ['websocket'], forceNew: true, extraHeaders: { 'x-forwarded-for': xff } })
    ouverts.push(s)
    return s
  }
  /** Des inscriptions depuis une adresse, trois par connexion (le plafond d'une connexion) : rend combien sont passées. */
  const inscrire = async (slug: string, xff: string, n: number, prefixe: string) => {
    let passees = 0
    for (let i = 0; i < n; i += 3) {
      const s = derriere(xff)
      await emitAck(s, 'party:watch', { slug })
      for (let j = i; j < Math.min(n, i + 3); j++) {
        const ack = await emitAck<any>(s, 'player:join', { slug, name: `${prefixe} ${j}`, avatar: '🎲' })
        if (ack.ok) passees++
      }
    }
    return passees
  }
  try {
    const B = await espace(banc, 'bruno', 'chez-bruno')
    const ECOLE = '203.0.113.7'
    assert.equal(await inscrire(ADMIN.slug, ECOLE, 60, 'Élève A'), 60, 'la salle A entre d’un coup')
    // La salle B, dans la même école, derrière la même box : sa vague entre
    // aussi, la réserve de A ne la regarde pas.
    const { lignes, valeur: dansB } = await journal(() => inscrire(B.slug, ECOLE, 3, 'Élève B'))
    assert.equal(dansB, 3, 'le premier invité de B, derrière la même box, entre')
    assert.deepEqual(lignes.filter(l => l.includes('[inscriptions]')), [], 'aucun refus chez B')

    // Le garde-fou de chaque soirée reste entier : A a vidé la sienne, le
    // robot qui enchaîne chez A est arrêté, et le journal le dit — une fois,
    // sans l'adresse, avec le nombre d'entrées de l'en-tête.
    const robot = await journal(() => inscrire(ADMIN.slug, `198.51.100.9, ${ECOLE}`, 12, 'Robot'))
    assert.ok(robot.valeur <= 2, `une rafale de plus chez A est refusée (${robot.valeur} sur 12 passées)`)
    const refus = robot.lignes.filter(l => l.includes('[inscriptions]'))
    assert.equal(refus.length, 1, `une seule ligne par clé et par minute (vu : ${refus.join(' | ')})`)
    assert.match(refus[0], /x-forwarded-for : 2 entrées/)
    assert.ok(!refus.join('').includes(ECOLE) && !refus.join('').includes('198.51.100.9'), 'jamais une adresse en clair')

    // À la clôture, le journal dit combien d'adresses ont inscrit la salle :
    // soixante invités sous une seule, c'est ici la box de l'école.
    const host = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    ouverts.push(host)
    const cloture = await journal(() => geste(host, 'host:closeParty'))
    const bilan = cloture.lignes.filter(l => l.includes('[inscriptions]'))
    assert.equal(bilan.length, 1, `une ligne à la clôture (vu : ${cloture.lignes.join(' | ')})`)
    // Soixante sous une seule entrée ; le robot, s'il est entré, sous deux.
    const n = 60 + robot.valeur
    assert.equal(
      bilan[0],
      `[inscriptions] soirée finie chez « banc » : ${n} invités ; ${n} inscriptions depuis la dernière clôture de l'espace,` +
        ` sous 1 adresse distincte ; x-forwarded-for : ${robot.valeur > 0 ? '1 à 2 entrées' : '1 entrée'}`,
    )
  } finally {
    for (const s of ouverts) s.close()
    await banc.close()
  }
})

test('la réserve d’une adresse : large pour le serveur, étroite pour chaque soirée', async () => {
  const reserve = new ReserveDInscriptions()
  const { lignes } = await journal(async () => {
    // Une adresse qui fait le tour des espaces : chaque soirée lui laisse sa
    // part, mais le serveur entier, pas plus que sa réserve large.
    let passees = 0
    for (let espace = 0; espace < 10; espace++) {
      for (let i = 0; i < PAR_SOIREE.burst; i++) if (reserve.prendre('192.0.2.1', `espace-${espace}`, 1)) passees++
    }
    assert.equal(passees, PAR_ADRESSE.burst, 'la réserve du serveur borne le tour des espaces')
    // Une autre adresse, ailleurs, n'en pâtit pas.
    assert.equal(reserve.prendre('192.0.2.2', 'espace-9', 1), true)
    // L'adresse locale — les tests, les essais à la maison — passe toujours.
    for (let i = 0; i < 100; i++) assert.equal(reserve.prendre('127.0.0.1', 'espace-0', 0), true)
  })
  assert.ok(lignes.some(l => l.includes('réserve du serveur vide')), 'le refus du serveur se dit')
  assert.ok(!lignes.join('').includes('192.0.2.1'), 'jamais une adresse en clair')
  assert.equal(reserve.empreinte('192.0.2.1'), reserve.empreinte('192.0.2.1'), 'une empreinte reconnaît sa clé')
  assert.notEqual(new ReserveDInscriptions().empreinte('192.0.2.1'), reserve.empreinte('192.0.2.1'), 'salée à chaque démarrage')
  const refus = 10 * PAR_SOIREE.burst - PAR_ADRESSE.burst
  // Puiser dans la réserve ne mesure rien : seul un invité vraiment entré compte.
  assert.deepEqual(reserve.mesure(), { refus, adresses: 0 })
  reserve.compter('192.0.2.1', 'espace-0', 2)
  reserve.compter('192.0.2.1', 'espace-0', 1)
  reserve.compter('127.0.0.1', 'espace-0', 0)
  reserve.compter('192.0.2.2', 'espace-9', 1)
  assert.deepEqual(reserve.mesure(), { refus, adresses: 3 })
  const cloture = await journal(async () => reserve.clore('espace-0', 42))
  assert.deepEqual(cloture.valeur, { invites: 42, inscriptions: 3, adresses: 2, entrees: { min: 0, max: 2 } })
  assert.match(cloture.lignes[0], /3 inscriptions depuis la dernière clôture de l'espace, sous 2 adresses distinctes ; x-forwarded-for : 0 à 2 entrées$/)
  assert.deepEqual(reserve.clore('espace-0', 0), { invites: 0, inscriptions: 0, adresses: 0, entrees: null }, 'oubliée une fois close')
})

test('la mesure d’un espace qui ne clôt jamais ne grossit pas sans fin', async () => {
  const reserve = new ReserveDInscriptions()
  for (let i = 0; i < 10_050; i++) reserve.compter(`10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`, 'espace', 1)
  const { lignes, valeur } = await journal(async () => reserve.clore('espace', 10_050))
  assert.equal(valeur.adresses, 10_000, 'les adresses retenues sont plafonnées')
  assert.equal(valeur.inscriptions, 10_050, 'les inscriptions, elles, se comptent toutes')
  assert.match(lignes[0], /sous au moins 10000 adresses distinctes ; x-forwarded-for : 1 entrée$/)
})

test('des inscriptions sans prénom ne vident pas la réserve de la salle', async () => {
  const banc = await demarrer({ online: true, publicUrl: 'http://localhost' })
  const ouverts: Socket[] = []
  const derriere = (xff: string) => {
    const s = clientIo(banc.url, { transports: ['websocket'], forceNew: true, extraHeaders: { 'x-forwarded-for': xff } })
    ouverts.push(s)
    return s
  }
  try {
    const BOX = '203.0.113.20'
    // Une seule connexion, derrière la box de la fête, envoie soixante
    // inscriptions au prénom vide : aucune ne crée personne.
    const robot = derriere(BOX)
    await emitAck(robot, 'party:watch', { slug: ADMIN.slug })
    for (let i = 0; i < PAR_SOIREE.burst; i++) {
      const ack = await emitAck<any>(robot, 'player:join', { slug: ADMIN.slug, name: i % 2 ? '' : '   ', avatar: '🎲' })
      assert.equal(ack.ok, false)
      assert.equal(ack.error, 'Il faut un prénom !')
    }
    // Le premier vrai invité derrière la même box entre.
    const tel = derriere(BOX)
    await emitAck(tel, 'party:watch', { slug: ADMIN.slug })
    const ack = await emitAck<any>(tel, 'player:join', { slug: ADMIN.slug, name: 'Camille', avatar: '🐱' })
    assert.equal(ack.ok, true, `le premier invité est refusé : ${ack.error}`)

    // Et la clôture ne compte que l'invité entré.
    const host = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    ouverts.push(host)
    const { lignes } = await journal(() => geste(host, 'host:discardParty'))
    const bilan = lignes.filter(l => l.includes('[inscriptions]'))
    assert.equal(bilan.length, 1, `une ligne à l’essai effacé (vu : ${lignes.join(' | ')})`)
    assert.match(bilan[0], /1 invité ; 1 inscription depuis la dernière clôture de l'espace, sous 1 adresse distincte ; x-forwarded-for : 1 entrée$/)
  } finally {
    for (const s of ouverts) s.close()
    await banc.close()
  }
})

// ── E2. Un palier ne se décide que sur des soirées closes ─────────────────

test('un essai en cours ailleurs ne fait pas tomber de palier, et son effacement ne laisse rien', async () => {
  const banc = await demarrer()
  try {
    const A = { cookie: await connexionAnimateur(banc.url), slug: ADMIN.slug }
    const B = await espace(banc, 'bruno', 'chez-bruno')
    const remi = await inscrireProfil(banc.url, 'remi', 'Rémi', '🐧')
    const R = profilDe(banc, 'remi')
    const hA = await ecranCommun(banc.url, A.cookie)
    const hB = await ecranCommun(banc.url, B.cookie)
    const qA = await creerQuiz(banc.url, A.cookie, [qcm('A1 ?'), qcm('A2 ?')])
    const qB = await creerQuiz(banc.url, B.cookie, [qcm('B1 ?'), qcm('B2 ?')])
    const habitue = () => lire(banc, "SELECT soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'hf:habitue:%'", R)

    // Une première soirée chez A, close.
    const r1 = await invite(banc.url, 'Rémi', '🐧', { slug: A.slug, cookie: remi })
    await jouerQuiz(hA, qA, [[r1, 0], [await invite(banc.url, 'Fig', '🐻', { slug: A.slug }), 1]], 2)
    await geste(hA, 'host:closeParty')

    // Le même soir, un essai chez A et une vraie soirée chez B : les deux
    // quiz se créditent dès leur verdict (invariant 10).
    const r2 = await invite(banc.url, 'Rémi', '🐧', { slug: A.slug, cookie: remi })
    const rB = await invite(banc.url, 'Rémi', '🐧', { slug: B.slug, cookie: remi })
    const figA = await invite(banc.url, 'Fig', '🐻', { slug: A.slug })
    const figB = await invite(banc.url, 'Fig', '🐻', { slug: B.slug })
    await Promise.all([jouerQuiz(hA, qA, [[r2, 0], [figA, 1]], 2), jouerQuiz(hB, qB, [[rB, 0], [figB, 1]], 2)])
    await patienter(500)
    assert.equal(lignesXp(banc, R).length, 3, 'trois soirées créditées, dont deux en cours')

    // B clôt : Rémi n'a que deux soirées closes. L'essai de A, en cours,
    // ne compte pas pour L'Habitué (trois soirées).
    await geste(hB, 'host:closeParty')
    assert.deepEqual(habitue(), [], 'pas de palier sur une soirée qui n’est pas close')

    // A efface son essai : il ne reste rien de lui, et rien de ce qu'il aurait fait tomber.
    await geste(hA, 'host:discardParty')
    await patienter(300)
    assert.equal(lignesXp(banc, R).length, 2)
    assert.deepEqual(habitue(), [], 'l’essai effacé ne laisse pas L’Habitué')
    const [{ xp }] = lire<{ xp: number }>(banc, 'SELECT xp FROM profiles WHERE id = ?', R)
    const [{ somme }] = lire<{ somme: number }>(banc, 'SELECT COALESCE(SUM(xp), 0) AS somme FROM profile_xp WHERE profile_id = ?', R)
    assert.equal(xp, somme, 'le total reste la somme de ses lignes')

    // Une troisième soirée close, cette fois : L'Habitué tombe, sous son nom.
    const r3 = await invite(banc.url, 'Rémi', '🐧', { slug: A.slug, cookie: remi })
    await jouerQuiz(hA, qA, [[r3, 0], [await invite(banc.url, 'Fig', '🐻', { slug: A.slug }), 1]], 2)
    await patienter(300)
    const troisieme = lignesXp(banc, R).map(l => l.soiree_id)
    await geste(hA, 'host:closeParty')
    const tombe = habitue()
    assert.equal(tombe.length, 1, 'L’Habitué tombe à la troisième soirée close')
    assert.ok(troisieme.includes(tombe[0].soiree_id), 'sous le nom de la soirée qui l’a fait tomber')
  } finally {
    await banc.close()
  }
})

test('deux soirées closes au même instant font tomber le palier qu’elles atteignent ensemble', async () => {
  const banc = await demarrer()
  // Une base distante lente : chaque clôture s'attarde dans ses crédits, et
  // les deux se chevauchent vraiment.
  const proto = ProfileStore.prototype as any
  const [remplacer, accorder] = [proto.remplacerRecompensesDeSoiree, proto.accorderPaliers]
  const lent =
    (f: (...a: unknown[]) => Promise<unknown>) =>
    async function (this: unknown, ...a: unknown[]) {
      await patienter(300)
      return f.apply(this, a)
    }
  try {
    const A = { cookie: await connexionAnimateur(banc.url), slug: ADMIN.slug }
    const B = await espace(banc, 'bruno', 'chez-bruno')
    const remi = await inscrireProfil(banc.url, 'remi', 'Rémi', '🐧')
    const R = profilDe(banc, 'remi')
    const hA = await ecranCommun(banc.url, A.cookie)
    const hB = await ecranCommun(banc.url, B.cookie)
    const qA = await creerQuiz(banc.url, A.cookie, [qcm('A1 ?'), qcm('A2 ?')])
    const qB = await creerQuiz(banc.url, B.cookie, [qcm('B1 ?'), qcm('B2 ?')])
    const habitue = () => lire(banc, "SELECT soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'hf:habitue:%'", R)

    // Une première soirée close chez A.
    const r1 = await invite(banc.url, 'Rémi', '🐧', { slug: A.slug, cookie: remi })
    await jouerQuiz(hA, qA, [[r1, 0], [await invite(banc.url, 'Fig', '🐻', { slug: A.slug }), 1]], 2)
    await geste(hA, 'host:closeParty')

    // Puis Rémi joue chez A et chez B le même soir, et les deux animateurs
    // cliquent « Clore » en même temps : trois soirées closes, L'Habitué.
    const rA = await invite(banc.url, 'Rémi', '🐧', { slug: A.slug, cookie: remi })
    const rB = await invite(banc.url, 'Rémi', '🐧', { slug: B.slug, cookie: remi })
    const figA = await invite(banc.url, 'Fig', '🐻', { slug: A.slug })
    const figB = await invite(banc.url, 'Fig', '🐻', { slug: B.slug })
    await Promise.all([jouerQuiz(hA, qA, [[rA, 0], [figA, 1]], 2), jouerQuiz(hB, qB, [[rB, 0], [figB, 1]], 2)])
    await patienter(500)
    assert.equal(lignesXp(banc, R).length, 3)
    const avant = new Set(lignesXp(banc, R).map(l => l.soiree_id))

    proto.remplacerRecompensesDeSoiree = lent(remplacer)
    proto.accorderPaliers = lent(accorder)
    await Promise.all([geste(hA, 'host:closeParty'), geste(hB, 'host:closeParty')])

    const tombe = habitue()
    assert.equal(tombe.length, 1, 'L’Habitué tombe une fois, à l’une des deux clôtures')
    assert.ok(avant.has(tombe[0].soiree_id), 'sous le nom de l’une des deux soirées')
  } finally {
    proto.remplacerRecompensesDeSoiree = remplacer
    proto.accorderPaliers = accorder
    await banc.close()
  }
})

test('l’Éclat d’un essai en cours ailleurs ne fait pas tomber La Pluie d’Éclats', async () => {
  const banc = await demarrer()
  try {
    const A = { cookie: await connexionAnimateur(banc.url), slug: ADMIN.slug }
    const B = await espace(banc, 'bruno', 'chez-bruno')
    const remi = await inscrireProfil(banc.url, 'remi', 'Rémi', '🐧')
    const R = profilDe(banc, 'remi')
    const hA = await ecranCommun(banc.url, A.cookie)
    const hB = await ecranCommun(banc.url, B.cookie)
    const qA = await creerQuiz(banc.url, A.cookie, [qcm('A1 ?'), qcm('A2 ?')])
    const qB = await creerQuiz(banc.url, B.cookie, [qcm('B1 ?'), qcm('B2 ?')])
    const pluie = () => lire(banc, "SELECT soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'hf:eclats:%'", R)
    const eclats = () => lire(banc, 'SELECT soiree_id FROM profile_eclats WHERE profile_id = ?', R)

    // Un essai chez A, où le hasard fait éclater Rémi au premier verdict.
    const rA = await invite(banc.url, 'Rémi', '🐧', { slug: A.slug, cookie: remi })
    ProfileStore.tirageEclat = () => true
    try {
      await jouerQuiz(hA, qA, [[rA, 0], [await invite(banc.url, 'Fig', '🐻', { slug: A.slug }), 1]], 2)
      await patienter(500)
    } finally {
      ProfileStore.tirageEclat = () => false
    }
    assert.equal(eclats().length, 1, 'l’Éclat est tombé pendant l’essai')

    // Pendant ce temps, une vraie soirée chez B, close : l'Éclat de l'essai,
    // qui se joue encore, ne compte pas pour ses paliers.
    const rB = await invite(banc.url, 'Rémi', '🐧', { slug: B.slug, cookie: remi })
    await jouerQuiz(hB, qB, [[rB, 0], [await invite(banc.url, 'Fig', '🐻', { slug: B.slug }), 1]], 2)
    await geste(hB, 'host:closeParty')
    assert.deepEqual(pluie(), [], 'pas de palier sur l’Éclat d’une soirée qui n’est pas close')

    // A efface son essai : l'Éclat part, et rien de ce qu'il aurait fait tomber ne reste.
    await geste(hA, 'host:discardParty')
    await patienter(300)
    assert.deepEqual(eclats(), [])
    assert.deepEqual(pluie(), [], 'l’essai effacé ne laisse pas La Pluie d’Éclats')
  } finally {
    ProfileStore.tirageEclat = () => false
    await banc.close()
  }
})

test('au démarrage, le recalcul ne range pas un palier sous l’essai qui se joue ailleurs', async () => {
  const banc = await demarrer()
  try {
    const A = { cookie: await connexionAnimateur(banc.url), slug: ADMIN.slug }
    const B = await espace(banc, 'bruno', 'chez-bruno')
    const remi = await inscrireProfil(banc.url, 'remi', 'Rémi', '🐧')
    const R = profilDe(banc, 'remi')
    const hA = await ecranCommun(banc.url, A.cookie)
    const hB = await ecranCommun(banc.url, B.cookie)
    const qA = await creerQuiz(banc.url, A.cookie, [qcm('A1 ?'), qcm('A2 ?')])
    const qB = await creerQuiz(banc.url, B.cookie, [qcm('B1 ?'), qcm('B2 ?')])
    const habitue = () => lire(banc, "SELECT soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'hf:habitue:%'", R)

    // Trois soirées closes chez A.
    for (let i = 0; i < 3; i++) {
      const r = await invite(banc.url, 'Rémi', '🐧', { slug: A.slug, cookie: remi })
      await jouerQuiz(hA, qA, [[r, 0], [await invite(banc.url, 'Fig', '🐻', { slug: A.slug }), 1]], 2)
      await geste(hA, 'host:closeParty')
    }
    const closes = lignesXp(banc, R).map(l => l.soiree_id)
    assert.equal(closes.length, 3)

    // Puis un essai chez B, joué : sa ligne est la plus récente de Rémi.
    const rB = await invite(banc.url, 'Rémi', '🐧', { slug: B.slug, cookie: remi })
    await jouerQuiz(hB, qB, [[rB, 0], [await invite(banc.url, 'Fig', '🐻', { slug: B.slug }), 1]], 2)
    await patienter(500)
    assert.equal(lignesXp(banc, R).length, 4)

    // On remonte le temps : une ligne d'un barème d'avant, et L'Habitué pas
    // encore décerné — c'est le recalcul du démarrage qui le fera tomber.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      db.prepare("DELETE FROM profile_badges WHERE profile_id = ? AND badge LIKE 'hf:habitue:%'").run(R)
      db.prepare("DELETE FROM profile_xp WHERE profile_id = ? AND soiree_id LIKE '#%'").run(R)
      const { detail } = db.prepare('SELECT detail FROM profile_xp WHERE profile_id = ? AND soiree_id = ?').get(R, closes[0]) as any
      db.prepare('UPDATE profile_xp SET detail = ? WHERE profile_id = ? AND soiree_id = ?').run(
        String(detail).replace(/^\{"v":\d+,/, '{"v":2,'),
        R,
        closes[0],
      )
    } finally {
      db.close()
    }
    await banc.redemarrer()
    const tombe = habitue()
    assert.equal(tombe.length, 1, 'le recalcul fait tomber L’Habitué sur les trois soirées closes')
    assert.ok(closes.includes(tombe[0].soiree_id), `sous le nom d’une soirée close (vu : ${tombe[0].soiree_id})`)

    // B efface son essai : le palier, qui ne lui devait rien, reste.
    await geste(await ecranCommun(banc.url, B.cookie), 'host:discardParty')
    await patienter(300)
    assert.equal(habitue().length, 1, 'l’essai effacé n’emporte pas le palier des soirées closes')
  } finally {
    await banc.close()
  }
})

// ── E3. Le nom d'une soirée porte son espace ──────────────────────────────

test('deux soirées nées à la même milliseconde, dans deux espaces : deux noms, deux lignes d’expérience', async () => {
  const banc = await demarrer()
  const vrai = Date.now
  try {
    const A = { cookie: await connexionAnimateur(banc.url), slug: ADMIN.slug }
    const B = await espace(banc, 'bruno', 'chez-bruno')
    const paula = await inscrireProfil(banc.url, 'paula', 'Paula', '🦉')
    const P = profilDe(banc, 'paula')
    const hA = await ecranCommun(banc.url, A.cookie)
    const hB = await ecranCommun(banc.url, B.cookie)
    const qA = await creerQuiz(banc.url, A.cookie, [qcm('A1 ?'), qcm('A2 ?')])
    const qB = await creerQuiz(banc.url, B.cookie, [qcm('B1 ?'), qcm('B2 ?')])

    // Les deux premiers invités arrivent à la même milliseconde : l'horloge
    // est figée le temps de leur entrée.
    const T = vrai()
    Date.now = () => T
    let tA: Invite, tB: Invite
    try {
      ;[tA, tB] = await Promise.all([
        invite(banc.url, 'Témoin', '🐻', { slug: A.slug }),
        invite(banc.url, 'Témoin', '🐻', { slug: B.slug }),
      ])
    } finally {
      Date.now = vrai
    }
    const pA = await invite(banc.url, 'Paula', '🦉', { slug: A.slug, cookie: paula })
    const pB = await invite(banc.url, 'Paula', '🦉', { slug: B.slug, cookie: paula })

    // Chez A, Paula trouve tout ; chez B, elle se trompe.
    await jouerQuiz(hA, qA, [[pA, 0], [tA, 1]], 2)
    await jouerQuiz(hB, qB, [[pB, 1], [tB, 0]], 2)
    await patienter(500)
    const lignes = lignesXp(banc, P)
    assert.equal(lignes.length, 2, `une ligne par soirée jouée (vu : ${JSON.stringify(lignes)})`)
    assert.notEqual(lignes[0].soiree_id, lignes[1].soiree_id, 'deux soirées, deux noms')
    assert.ok(Math.max(...lignes.map(l => l.xp)) > Math.min(...lignes.map(l => l.xp)), 'l’expérience de A n’est pas écrasée par celle de B')
    for (const l of lignes) assert.match(l.soiree_id, /^\d{4}-\d{2}-\d{2}-[\w-]+$/, 'un nom lisible dans une adresse')

    // « C'était un essai » chez B n'emporte que la sienne.
    await geste(hB, 'host:discardParty')
    await patienter(300)
    const restantes = lignesXp(banc, P)
    assert.equal(restantes.length, 1, 'la soirée de A reste')
    await geste(hA, 'host:closeParty')
    const archives = lire<{ id: string }>(banc, 'SELECT id FROM soirees')
    assert.deepEqual(archives.map(a => a.id), [restantes[0].soiree_id], 'l’archive et l’expérience portent le même nom')
  } finally {
    Date.now = vrai
    await banc.close()
  }
})
