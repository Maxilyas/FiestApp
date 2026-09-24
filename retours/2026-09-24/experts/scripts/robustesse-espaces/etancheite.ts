// Trois soirées en même temps sur un serveur : restent-elles étanches ?
//
// Trois espaces (A = banc, l'administrateur ; B ; C), chacun son écran commun,
// son quiz et ses invités — dont une « Camille 🦊 » dans chacun. Chaque
// connexion enregistre TOUT ce qu'elle reçoit ; à la fin, on y cherche les
// marques des deux autres espaces (identifiants de partie, d'invité, prénoms).
// Entre-temps, A essaie tous les gestes qu'on peut faire avec un identifiant
// de B : commande sur sa partie, exclusion, renommage, jeton d'invité, carte,
// archive, quiz, pack.
//
//   cd server && node --import tsx ../retours/2026-09-24/experts/scripts/robustesse-espaces/etancheite.ts
import {
  ADMIN,
  attendre,
  bilan,
  connecter,
  connexionAnimateur,
  creerQuiz,
  ecranCommun,
  ecrire,
  emitAck,
  espace,
  eteindre,
  essai,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  serveur,
  type Socket,
} from './commun'

const { server, url } = await serveur('etancheite')
let recuSockets: () => Iterable<Socket> = () => []
try {
  const A = { cookie: await connexionAnimateur(url), slug: ADMIN.slug, id: '' }
  const B = await espace(url, 'bruno', 'chez-bruno', 'Bruno')
  const C = await espace(url, 'chloe', 'chez-chloe', 'Chloé')
  const espaces = { A, B, C }

  // Tout ce qu'une connexion reçoit, pour y chercher ce qui n'est pas de chez elle.
  const recu = new Map<Socket, { espace: string; lignes: string[] }>()
  recuSockets = () => recu.keys()
  const espionner = (s: Socket, esp: string) => {
    const r = { espace: esp, lignes: [] as string[] }
    recu.set(s, r)
    s.onAny((ev: string, ...args: unknown[]) => r.lignes.push(`${ev} ${JSON.stringify(args)}`))
    return s
  }

  const monde: Record<string, { host: Socket; invites: Awaited<ReturnType<typeof invite>>[]; quiz: string; session?: string }> = {}
  for (const [nom, e] of Object.entries(espaces)) {
    const quiz = await creerQuiz(url, e.cookie, [qcm(`Question-${nom}-1`, ['Oui', 'Non'], 0, 60), qcm(`Question-${nom}-2`, ['Oui', 'Non'], 0, 60)], `Quiz-${nom}`)
    const host = espionner(await ecranCommun(url, e.cookie), nom)
    const invites = []
    for (const prenom of [`Alba${nom}`, `Basile${nom}`, 'Camille']) {
      const i = await invite(url, prenom, '🦊', { slug: e.slug })
      espionner(i.socket, nom)
      invites.push(i)
    }
    monde[nom] = { host, invites, quiz }
  }

  // ── Homonymes d'un espace à l'autre ──
  for (const nom of ['A', 'B', 'C']) {
    const snap: any = await instantane(monde[nom].host, s => s.players?.length === 3, `les trois invités de ${nom}`)
    const camille = snap.players.find((p: any) => p.name === 'Camille')
    essai(`homonyme — « Camille 🦊 » chez ${nom} n'est pas marquée (2)`, !camille?.nomAffiche, camille?.nomAffiche ?? '')
  }

  // Les parties de A et B tournent en même temps ; C reste en attente.
  monde.A.session = await lancerQuiz(monde.A.host, monde.A.quiz)
  monde.B.session = await lancerQuiz(monde.B.host, monde.B.quiz)
  const enQuestion = (nom: string) =>
    attendre<any>(monde[nom].host, 'session:view', p => p.view?.phase === 'question' || p.view?.phase === 'observe', `la question de ${nom}`, 15000)
  await Promise.all([enQuestion('A'), enQuestion('B')])
  const hostA = monde.A.host
  const bInv = monde.B.invites[0]
  const aInv = monde.A.invites[0]

  // ── Commandes de A sur la partie de B ──
  let derniereVueB: any = null
  monde.B.host.on('session:view', (p: any) => (derniereVueB = p.view))
  await patienter(300)
  const phaseAvant = derniereVueB?.phase
  ;(hostA as any).emit('host:command', { sessionId: monde.B.session, command: { type: 'next' } })
  ;(hostA as any).emit('host:command', { sessionId: monde.B.session, command: { type: 'pause' } })
  ;(hostA as any).emit('host:endSession', { sessionId: monde.B.session })
  await patienter(500)
  const bSnap: any = await instantane(monde.B.host)
  essai(
    'commande — host:command / host:endSession de A avec l’identifiant de partie de B',
    bSnap.session?.id === monde.B.session && (derniereVueB?.phase ?? phaseAvant) === phaseAvant,
    `partie de B : ${bSnap.session?.id === monde.B.session ? 'toujours là' : 'TERMINÉE'}, phase ${derniereVueB?.phase}`,
  )

  // ── Gestes de A sur un invité de B ──
  const toastsB: unknown[] = []
  bInv.socket.on('toast', (t: unknown) => toastsB.push(t))
  ;(hostA as any).emit('host:renamePlayer', { playerId: bInv.playerId, name: 'Pirate' })
  ;(hostA as any).emit('host:assignPlayer', { playerId: bInv.playerId, teamId: null })
  ;(hostA as any).emit('host:removePlayer', { playerId: bInv.playerId })
  await patienter(500)
  const bApres: any = await instantane(monde.B.host)
  const bJoueur = bApres.players.find((p: any) => p.id === bInv.playerId)
  essai(
    'invité — renommer / placer / exclure un invité de B depuis A',
    bJoueur?.name === 'AlbaB' && toastsB.length === 0,
    bJoueur ? `${bJoueur.name}, ${toastsB.length} toast` : 'EXCLU',
  )

  // ── Un jeton de A présenté chez B ──
  const tel = connecter(url)
  espionner(tel, 'B')
  await emitAck(tel, 'party:watch', { slug: B.slug })
  const rejoint: any = await emitAck(tel, 'player:join', { slug: B.slug, token: aInv.token, name: 'x', avatar: '🦊' })
  const bApresJeton: any = await instantane(monde.B.host, s => true)
  essai(
    'jeton — player:join chez B avec le jeton d’un invité de A',
    !rejoint.ok && rejoint.reason === 'unknown-token' && bApresJeton.players.length === 3,
    JSON.stringify({ ok: rejoint.ok, reason: rejoint.reason }),
  )

  // Même jeton, sur la connexion de l'invité de A lui-même.
  const surA: any = await emitAck(aInv.socket, 'player:join', { slug: B.slug, token: aInv.token })
  essai('jeton — la connexion d’un invité de A demande à rejoindre B', !surA.ok, surA.error)

  // ── Une page de A qui veut suivre B ──
  const watch: any = await emitAck(hostA, 'party:watch', { slug: B.slug })
  essai('suivre — party:watch de B depuis l’écran commun de A', !watch.ok, watch.error)
  const hello = connecter(url, B.cookie)
  await emitAck(hello, 'party:watch', { slug: A.slug })
  const helloRes: any = await emitAck(hello, 'host:hello', {})
  essai('suivre — host:hello avec la session de B sur une connexion qui suit A', !helloRes.ok)
  hello.close()

  // ── Une réponse qui vise B avec le jeton de A ──
  const anonyme = connecter(url)
  const rep: any = await emitAck(anonyme, 'player:action', { slug: B.slug, token: aInv.token, sessionId: monde.B.session, action: { type: 'answer', choice: 0 } })
  essai('réponse — player:action chez B avec le jeton de A, connexion neuve', !rep.ok && rep.reason === 'unknown-player', rep.reason)
  const rep2: any = await emitAck(aInv.socket, 'player:action', { slug: B.slug, sessionId: monde.B.session, action: { type: 'answer', choice: 0 } })
  essai('réponse — l’invité de A vise la partie de B', !rep2.ok, rep2.reason)
  anonyme.close()

  // ── Un quiz de B lancé chez C ──
  const toastsC: any[] = []
  monde.C.host.on('toast', (t: any) => toastsC.push(t))
  const sessC = await lancerQuiz(monde.C.host, monde.B.quiz)
  await patienter(500)
  const cSnap: any = await instantane(monde.C.host)
  essai('quiz — selectPack chez C avec l’identifiant du quiz de B', toastsC.some(t => /introuvable/i.test(t.message)), toastsC.map(t => t.message).join(' | '))
  ;(monde.C.host as any).emit('host:endSession', { sessionId: sessC })
  void cSnap

  // ── HTTP : quiz, carte, archive ──
  const statut = async (chemin: string, cookie?: string, method = 'GET', body?: unknown) =>
    (method === 'GET' ? await fetch(`${url}${chemin}`, { headers: cookie ? { Cookie: cookie } : {} }) : await ecrire(url, chemin, body ?? {}, cookie, method)).status
  essai('quiz — GET /api/quizzes/<quiz de B> avec la session de A', (await statut(`/api/quizzes/${monde.B.quiz}`, A.cookie)) === 404)
  essai('quiz — PUT /api/quizzes/<quiz de B> avec la session de A', (await statut(`/api/quizzes/${monde.B.quiz}`, A.cookie, 'PUT', { title: 'x', questions: [] })) === 404)
  essai('quiz — POST duplicate du quiz de B avec la session de A', (await statut(`/api/quizzes/${monde.B.quiz}/duplicate`, A.cookie, 'POST')) === 404)
  essai('quiz — DELETE /api/quizzes/<quiz de B> avec la session de A', (await statut(`/api/quizzes/${monde.B.quiz}`, A.cookie, 'DELETE')) === 404)
  essai('carte — /s/<A>/joueurs/<invité de A> (témoin)', (await statut(`/s/${A.slug}/joueurs/${aInv.playerId}.json`)) === 200)
  essai('carte — /s/<B>/joueurs/<invité de A>', (await statut(`/s/${B.slug}/joueurs/${aInv.playerId}.json`)) === 404)

  // A joue sa première question, puis clôt la partie : elle se range dans l'historique.
  for (const i of monde.A.invites) await emitAck(i.socket, 'player:action', { sessionId: monde.A.session, action: { type: 'answer', choice: 0 } })
  await patienter(4000)
  ;(hostA as any).emit('host:endSession', { sessionId: monde.A.session })
  let archiveA = ''
  for (let t = 0; t < 40 && !archiveA; t++) {
    await patienter(250)
    const l: any = await (await fetch(`${url}/s/${A.slug}/soirees.json`)).json()
    archiveA = l.current?.id ?? l.archives?.[0]?.id ?? ''
  }
  essai('archive — la soirée de A s’est rangée (témoin)', !!archiveA, archiveA)
  essai('archive — /s/<A>/soirees/<id de A>/recap.json (témoin)', (await statut(`/s/${A.slug}/soirees/${archiveA}/recap.json`)) === 200)
  essai('archive — /s/<B>/soirees/<id de A>/recap.json', (await statut(`/s/${B.slug}/soirees/${archiveA}/recap.json`)) === 404)
  essai('archive — /s/<B>/soirees/<id de A>/bilan.json', (await statut(`/s/${B.slug}/soirees/${archiveA}/bilan.json`)) === 404)
  essai('archive — PUT /api/soirees/<id de A> avec la session de B', (await statut(`/api/soirees/${archiveA}`, B.cookie, 'PUT', { title: 'Piraté' })) === 404)
  essai('archive — DELETE /api/soirees/<id de A> avec la session de B', (await statut(`/api/soirees/${archiveA}`, B.cookie, 'DELETE')) === 404)
  const encore: any = await (await fetch(`${url}/s/${A.slug}/soirees.json`)).json()
  essai('archive — la soirée de A est intacte après les essais de B', (encore.current?.id ?? encore.archives?.[0]?.id) === archiveA && !/Piraté/.test(JSON.stringify(encore)))

  // ── La fouille : quelqu'un a-t-il reçu ce qui n'est pas de chez lui ? ──
  await patienter(500)
  const marques: Record<string, string[]> = {}
  for (const [nom] of Object.entries(espaces)) {
    marques[nom] = [monde[nom].session, ...monde[nom].invites.map(i => i.playerId), ...monde[nom].invites.map(i => i.token), `Alba${nom}`, `Basile${nom}`, `Question-${nom}`].filter(Boolean) as string[]
  }
  let fuites = 0
  let messages = 0
  for (const { espace: chez, lignes } of recu.values()) {
    messages += lignes.length
    for (const ligne of lignes) {
      for (const [autre, liste] of Object.entries(marques)) {
        if (autre === chez) continue
        const m = liste.find(x => ligne.includes(x))
        if (m) {
          fuites++
          if (fuites <= 5) console.log(`   fuite chez ${chez} : ${m} (de ${autre}) dans « ${ligne.slice(0, 160)} »`)
        }
      }
    }
  }
  essai(`diffusion — ${messages} messages reçus par ${recu.size} connexions, aucun ne porte une marque d’un autre espace`, fuites === 0, `${fuites} fuite(s)`)
} finally {
  for (const s of recuSockets()) s.close()
  await eteindre(server)
}

// ── Couplages : ce que les espaces partagent sans le savoir ──────────────
//
// 1. La réserve d'inscriptions par adresse (sockets.ts, JOIN_BURST) est
//    commune à tout le serveur : deux soirées derrière la même box (deux
//    salles d'un même bâtiment, un tournoi à plusieurs animateurs) puisent
//    dans le même seau. On passe par l'adresse réseau de la machine, pas par
//    127.0.0.1, que la réserve laisse passer sans compter.
// 2. La boucle d'événements est une seule : la clôture d'une grosse soirée
//    chez A retarde-t-elle les chronomètres de B ?
{
  const { monitorEventLoopDelay } = await import('node:perf_hooks')
  const { networkInterfaces } = await import('node:os')
  const ip = Object.values(networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address
  const c = await serveur('couplages')
  const ouverts: Socket[] = []
  try {
    const A = { cookie: await connexionAnimateur(c.url), slug: ADMIN.slug }
    const B = await espace(c.url, 'bruno', 'chez-bruno', 'Bruno')
    if (ip) {
      const net = `http://${ip}:${c.server.port}`
      let entres = 0
      for (let k = 0; k < 60; k++) {
        const i = await invite(net, `Invite${k}`, '🦊', { slug: A.slug }).catch(() => null)
        if (i) (entres++, ouverts.push(i.socket))
      }
      const chezB = await invite(net, 'Premier', '🐻', { slug: B.slug }).catch((e: Error) => e)
      essai(
        `réserve d’inscriptions — 60 invités chez A depuis une adresse, puis le premier invité de B depuis la même`,
        !(chezB instanceof Error),
        chezB instanceof Error ? `${entres} entrés chez A ; B refusé : « ${chezB.message} »` : 'B accepté',
      )
      if (!(chezB instanceof Error)) ouverts.push(chezB.socket)
    }

    // Une grosse soirée chez D (un espace neuf : A a déjà ses 60) : 120
    // invités, 8 questions jouées ; B en pleine question pendant la clôture.
    const D = await espace(c.url, 'dora', 'chez-dora', 'Dora')
    const hA = await ecranCommun(c.url, D.cookie)
    const hB = await ecranCommun(c.url, B.cookie)
    ouverts.push(hA, hB)
    const qA = await creerQuiz(c.url, D.cookie, Array.from({ length: 8 }, (_, k) => qcm(`Grosse ${k}`, ['Oui', 'Non', 'Peut-être', 'Jamais'], 0, 30)))
    const qB = await creerQuiz(c.url, B.cookie, [qcm('B longue', ['Oui', 'Non'], 0, 60)])
    const foule: Awaited<ReturnType<typeof invite>>[] = []
    for (let k = 0; k < 120; k++) {
      const i = await invite(c.url, `Foule${k}`, '🦊', { slug: D.slug })
      foule.push(i)
      ouverts.push(i.socket)
    }
    const bInv = await invite(c.url, 'Témoin', '🐻', { slug: B.slug })
    ouverts.push(bInv.socket)
    const h = monitorEventLoopDelay({ resolution: 10 })
    const sidA = await lancerQuiz(hA, qA)
    h.enable()
    for (let q = 0; q < 8; q++) {
      await attendre<any>(hA, 'session:view', p => p.sessionId === sidA && p.view.phase === 'question' && p.view.qIndex === q, `grosse question ${q}`, 30_000)
      const rev = attendre<any>(hA, 'session:view', p => p.sessionId === sidA && p.view.phase === 'reveal' && p.view.qIndex === q, `grosse révélation ${q}`, 30_000)
      await Promise.all(foule.map((i, k) => emitAck(i.socket, 'player:action', { sessionId: sidA, action: { type: 'answer', choice: k % 4 } })))
      await rev
      ;(hA as any).emit('host:command', { sessionId: sidA, command: { type: 'next' } })
    }
    await attendre<any>(hA, 'session:view', p => p.sessionId === sidA && p.view.phase === 'finished', 'grand podium', 30_000)
    const pendantLeJeu = h.max / 1e6
    h.reset()
    // B lance sa question ; A clôt sa soirée pendant ce temps.
    const sidB = await lancerQuiz(hB, qB)
    await attendre<any>(hB, 'session:view', p => p.sessionId === sidB && p.view.phase === 'question', 'la question de B', 20_000)
    const rtt: number[] = []
    let sonde = true
    const sonder = (async () => {
      while (sonde) {
        const t0 = Date.now()
        await emitAck(bInv.socket, 'time:sync', {})
        rtt.push(Date.now() - t0)
        await patienter(20)
      }
    })()
    const t0 = Date.now()
    const fin = attendre<any>(hA, 'toast', () => true, 'la clôture de A', 60_000)
    ;(hA as any).emit('host:closeParty', {})
    const toast = await fin
    const dureeCloture = Date.now() - t0
    sonde = false
    await sonder
    const pendantCloture = h.max / 1e6
    h.disable()
    const rttMax = Math.max(...rtt)
    console.log(`   boucle : retard max ${pendantLeJeu.toFixed(0)} ms pendant 8 questions à 120 ; ${pendantCloture.toFixed(0)} ms pendant la clôture (${dureeCloture} ms, « ${toast.message} ») ; aller-retour d’un téléphone de B : max ${rttMax} ms sur ${rtt.length} sondes`)
    essai('boucle — la clôture d’une soirée de 120 chez D ne gèle pas B plus de 250 ms', pendantCloture < 250 && rttMax < 300, `${pendantCloture.toFixed(0)} ms de gel, aller-retour max ${rttMax} ms`)
  } finally {
    for (const s of ouverts) s.close()
    await eteindre(c.server)
  }
}

process.exit(bilan() > 0 ? 1 : 0)
