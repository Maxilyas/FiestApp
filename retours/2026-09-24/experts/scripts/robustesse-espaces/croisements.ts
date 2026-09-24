// Un même profil dans deux soirées EN MÊME TEMPS, et des fins de soirée qui se
// croisent à la même milliseconde.
//
// Tour 1 — trois espaces jouent en parallèle. Paula (profil) joue chez A et
// chez B, sur deux téléphones ; Quentin (profil) chez B et chez C. Puis, dans
// le même tour de boucle : A clôt, B clôt, C efface son essai.
// Attendu : Paula garde ses deux soirées (deux lignes d'expérience), Quentin
// seulement celle de B ; le total d'un profil est la somme de ses lignes ;
// chaque téléphone reçoit la fin de SA soirée ; aucune erreur au journal.
//
// Tour 2 — Paula rejoue chez A et chez B ; A efface son essai pendant que B
// clôt. Attendu : Paula ne perd que la soirée d'essai de A.
//
//   cd server && node --import tsx ../retours/2026-09-24/experts/scripts/robustesse-espaces/croisements.ts
import { ProfileStore } from '../../../../../server/src/auth/profiles'
import {
  ADMIN,
  attendre,
  bilan,
  connexionAnimateur,
  creerQuiz,
  ecranCommun,
  emitAck,
  espace,
  essai,
  eteindre,
  inscrireProfil,
  invite,
  lancerQuiz,
  lire,
  patienter,
  qcm,
  serveur,
  type Invite,
  type Socket,
} from './commun'

// L'Éclat est un tirage, et son premier fait tomber un palier : on le
// neutralise pour compter l'expérience au point près.
ProfileStore.tirageEclat = () => false

// Le journal du serveur : une erreur de crédit ne doit pas passer inaperçue.
const erreurs: string[] = []
const errOrig = console.error
console.error = (...a: unknown[]) => {
  erreurs.push(a.map(String).join(' '))
  errOrig(...a)
}

const { server, url, quizDbUrl } = await serveur('croisements')
const sockets: Socket[] = []

/** Joue un quiz entier : les réponses dites, puis « Suivant », jusqu'au podium. */
async function jouer(host: Socket, quizId: string, reponses: [Invite, number][]) {
  const vue = (sid: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sid && pred(p.view), label, 20_000)
  const sid = await lancerQuiz(host, quizId)
  for (let q = 0; q < 2; q++) {
    await vue(sid, v => v.phase === 'question' && v.qIndex === q, `question ${q + 1}`)
    const revelee = vue(sid, v => v.phase === 'reveal' && v.qIndex === q, `révélation ${q + 1}`)
    for (const [qui, choice] of reponses) {
      const ack: any = await emitAck(qui.socket, 'player:action', { sessionId: sid, action: { type: 'answer', choice } })
      if (!ack.ok) throw new Error(`réponse refusée : ${ack.error}`)
    }
    await revelee
    ;(host as any).emit('host:command', { sessionId: sid, command: { type: 'next' } })
  }
  await vue(sid, v => v.phase === 'finished', 'le podium')
  ;(host as any).emit('host:endSession', { sessionId: sid })
}

// Les lignes de soirée, sans celle des paliers de carrière (`#paliers`, une par profil).
const lignes = (profil: string) =>
  lire(quizDbUrl, "SELECT soiree_id, space_id, xp FROM profile_xp WHERE profile_id = ? AND soiree_id != '#paliers' ORDER BY space_id", [profil])
const total = async (profil: string) => Number((await lire(quizDbUrl, 'SELECT xp FROM profiles WHERE id = ?', [profil]))[0]?.xp)
const idDe = async (login: string) => String((await lire(quizDbUrl, 'SELECT id FROM profiles WHERE login = ?', [login]))[0].id)

try {
  const A = { cookie: await connexionAnimateur(url), slug: ADMIN.slug, id: '' }
  const B = await espace(url, 'bruno', 'chez-bruno', 'Bruno')
  const C = await espace(url, 'chloe', 'chez-chloe', 'Chloé')
  A.id = String((await lire(quizDbUrl, 'SELECT id FROM accounts WHERE slug = ?', [A.slug]))[0].id)
  const paula = await inscrireProfil(url, 'paula', 'Paula', '🦉')
  const quentin = await inscrireProfil(url, 'quentin', 'Quentin', '🐢')
  const P = await idDe('paula')
  const Q = await idDe('quentin')

  const hosts: Record<string, Socket> = {}
  const quiz: Record<string, string> = {}
  for (const [nom, e] of Object.entries({ A, B, C })) {
    quiz[nom] = await creerQuiz(url, e.cookie, [qcm(`Q1 ${nom}`), qcm(`Q2 ${nom}`)], `Quiz ${nom}`)
    hosts[nom] = await ecranCommun(url, e.cookie)
    sockets.push(hosts[nom])
  }
  const entrer = async (nom: string, slug: string, prenom: string, avatar: string, cookie?: string) => {
    const i = await invite(url, prenom, avatar, { slug, cookie })
    sockets.push(i.socket)
    return i
  }

  // ── Tour 1 ──
  const pA = await entrer('A', A.slug, 'Paula', '🦉', paula)
  const pB = await entrer('B', B.slug, 'Paula', '🦉', paula)
  const qB = await entrer('B', B.slug, 'Quentin', '🐢', quentin)
  const qC = await entrer('C', C.slug, 'Quentin', '🐢', quentin)
  const figA = [await entrer('A', A.slug, 'Fig', '🐻'), await entrer('A', A.slug, 'Ura', '🐙')]
  const figB = [await entrer('B', B.slug, 'Fig', '🐻')]
  const figC = [await entrer('C', C.slug, 'Fig', '🐻'), await entrer('C', C.slug, 'Ura', '🐙')]

  // Les trois quiz en parallèle.
  await Promise.all([
    jouer(hosts.A, quiz.A, [[pA, 0], ...figA.map(f => [f, 1] as [Invite, number])]),
    jouer(hosts.B, quiz.B, [[pB, 0], [qB, 1], ...figB.map(f => [f, 1] as [Invite, number])]),
    jouer(hosts.C, quiz.C, [[qC, 0], ...figC.map(f => [f, 1] as [Invite, number])]),
  ])
  await patienter(1500)
  const avantP = await lignes(P)
  const avantQ = await lignes(Q)
  console.log('   après les quiz — Paula', JSON.stringify(avantP), '· Quentin', JSON.stringify(avantQ))
  essai('quiz simultanés — Paula a une ligne par soirée (A et B), créditée au verdict', avantP.length === 2 && avantP.every(l => l.xp > 0))
  essai('quiz simultanés — Quentin a une ligne par soirée (B et C)', avantQ.length === 2)

  // Les fins de soirée que reçoivent les téléphones.
  const fins = new Map<Socket, any[]>()
  for (const i of [pA, pB, qB, qC]) {
    fins.set(i.socket, [])
    i.socket.on('soiree:fin', (f: any) => fins.get(i.socket)!.push(f))
    i.socket.on('party:reset', () => fins.get(i.socket)!.push({ reset: true }))
  }
  const toast = (h: Socket) => attendre<any>(h, 'toast', () => true, 'le toast de fin', 20_000)
  const tA = toast(hosts.A)
  const tB = toast(hosts.B)
  const tC = toast(hosts.C)
  // Le même tour de boucle : trois fins de soirée à la même milliseconde.
  ;(hosts.A as any).emit('host:closeParty', {})
  ;(hosts.B as any).emit('host:closeParty', {})
  ;(hosts.C as any).emit('host:discardParty')
  const [toA, toB, toC] = await Promise.all([tA, tB, tC])
  console.log('   toasts :', toA.message, '|', toB.message, '|', toC.message)
  essai('fins croisées — les trois gestes aboutissent', [toA, toB, toC].every(t => t.kind === 'info'))
  await patienter(1500)

  const apresP = await lignes(P)
  const apresQ = await lignes(Q)
  console.log('   après les fins — Paula', JSON.stringify(apresP), '· Quentin', JSON.stringify(apresQ))
  const somme = (l: any[]) => l.reduce((n, r) => n + Number(r.xp), 0)
  essai('fins croisées — Paula garde ses deux soirées (A et B)', apresP.length === 2, `${apresP.length} ligne(s)`)
  essai('fins croisées — Quentin ne garde que B (l’essai de C est effacé)', apresQ.length === 1 && apresQ[0].space_id === B.id)
  // Les paliers de carrière s'ajoutent au total par une ligne à part ; on compare à toutes les lignes.
  essai('fins croisées — total de Paula = somme de ses lignes', (await total(P)) === somme(await lire(quizDbUrl, 'SELECT xp FROM profile_xp WHERE profile_id = ?', [P])), `${await total(P)}`)
  essai('fins croisées — total de Quentin = somme de ses lignes', (await total(Q)) === somme(await lire(quizDbUrl, 'SELECT xp FROM profile_xp WHERE profile_id = ?', [Q])), `${await total(Q)}`)
  const finsDe = (i: Invite) => fins.get(i.socket)!
  essai(
    'fins croisées — chaque téléphone reçoit la fin de SA soirée',
    finsDe(pA).length === 1 && finsDe(pA)[0].soiree?.slug === A.slug &&
      finsDe(pB).length === 1 && finsDe(pB)[0].soiree?.slug === B.slug &&
      finsDe(qB).length === 1 && finsDe(qB)[0].soiree?.slug === B.slug &&
      finsDe(qC).length === 1 && finsDe(qC)[0].reset === true,
    JSON.stringify([pA, pB, qB, qC].map(i => finsDe(i).map(f => f.soiree?.slug ?? (f.reset ? 'reset' : '?')))),
  )
  const archives = async (slug: string) => {
    const l: any = await (await fetch(`${url}/s/${slug}/soirees.json`)).json()
    return l.archives.length
  }
  essai('fins croisées — une archive chez A, une chez B, aucune chez C', (await archives(A.slug)) === 1 && (await archives(B.slug)) === 1 && (await archives(C.slug)) === 0)

  // ── Tour 2 : A efface son essai pendant que B clôt ──
  const pA2 = await entrer('A', A.slug, 'Paula', '🦉', paula)
  const pB2 = await entrer('B', B.slug, 'Paula', '🦉', paula)
  const figA2 = [await entrer('A', A.slug, 'Fig', '🐻')]
  const figB2 = [await entrer('B', B.slug, 'Fig', '🐻')]
  await Promise.all([
    jouer(hosts.A, quiz.A, [[pA2, 0], ...figA2.map(f => [f, 1] as [Invite, number])]),
    jouer(hosts.B, quiz.B, [[pB2, 0], ...figB2.map(f => [f, 1] as [Invite, number])]),
  ])
  await patienter(1500)
  const milieu = await lignes(P)
  const t2A = toast(hosts.A)
  const t2B = toast(hosts.B)
  ;(hosts.A as any).emit('host:discardParty')
  ;(hosts.B as any).emit('host:closeParty', {})
  await Promise.all([t2A, t2B])
  await patienter(1500)
  const fin = await lignes(P)
  console.log('   tour 2 — avant', JSON.stringify(milieu), '· après', JSON.stringify(fin))
  essai('essai chez A pendant que B clôt — Paula a 3 lignes (A1, B1, B2), l’essai A2 est parti', fin.length === 3 && milieu.length === 4, `${milieu.length} → ${fin.length}`)
  essai('essai chez A pendant que B clôt — total = somme', (await total(P)) === somme(await lire(quizDbUrl, 'SELECT xp FROM profile_xp WHERE profile_id = ?', [P])))

  // ── Tour 3 : un palier gagné grâce à un essai d'un autre espace ──
  // Rémi a déjà une soirée (A). Il joue ensuite un essai chez A et une vraie
  // soirée chez B, en même temps. B clôt : sa carrière compte l'essai de A,
  // crédité dès le verdict — trois soirées, L'Habitué tombe, sous le nom de
  // la soirée de B. Puis A efface l'essai : il ne reste que deux soirées.
  const remi = await inscrireProfil(url, 'remi', 'Rémi', '🐧')
  const R = await idDe('remi')
  const rA1 = await entrer('A', A.slug, 'Rémi', '🐧', remi)
  await jouer(hosts.A, quiz.A, [[rA1, 0], [await entrer('A', A.slug, 'Fig', '🐻'), 1]])
  let t = toast(hosts.A)
  ;(hosts.A as any).emit('host:closeParty', {})
  await t
  const rA2 = await entrer('A', A.slug, 'Rémi', '🐧', remi)
  const rB = await entrer('B', B.slug, 'Rémi', '🐧', remi)
  await Promise.all([
    jouer(hosts.A, quiz.A, [[rA2, 0], [await entrer('A', A.slug, 'Fig', '🐻'), 1]]),
    jouer(hosts.B, quiz.B, [[rB, 0], [await entrer('B', B.slug, 'Fig', '🐻'), 1]]),
  ])
  await patienter(1000)
  t = toast(hosts.B)
  ;(hosts.B as any).emit('host:closeParty', {})
  await t
  const habitueApresB = await lire(quizDbUrl, "SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'hf:habitue:%'", [R])
  t = toast(hosts.A)
  ;(hosts.A as any).emit('host:discardParty')
  await t
  await patienter(500)
  const soireesRestantes = await lignes(R)
  const habitue = await lire(quizDbUrl, "SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'hf:habitue:%'", [R])
  console.log('   tour 3 — L’Habitué après la clôture de B', JSON.stringify(habitueApresB), '· soirées restantes', soireesRestantes.length, '· L’Habitué après l’essai effacé', JSON.stringify(habitue), '· total', await total(R))
  essai(
    'palier — un essai effacé chez A ne laisse pas L’Habitué (3 soirées) à qui n’en a plus que 2',
    !(soireesRestantes.length < 3 && habitue.length > 0),
    `${soireesRestantes.length} soirées, ${habitue.length} palier(s) L’Habitué`,
  )
  essai('journal — aucune erreur du serveur pendant les croisements', erreurs.length === 0, erreurs.slice(0, 3).join(' / '))
} finally {
  for (const s of sockets) s.close()
  await eteindre(server)
}
process.exit(bilan() > 0 ? 1 : 0)
