// Maquette — le compagnon qui suit, en soirée : une vraie soirée sur un serveur
// jetable, photographiée à l'écran commun (1920 × 1080) et au téléphone de Léa
// (390 × 844), le compagnon posé par-dessus au moment de la photo.
//
//   cd server && npx tsx ../retours/2026-10-16/compagnon/maquette/soiree.ts [decouverte]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  demarrer,
  connexionAnimateur,
  creerQuiz,
  ecranCommun,
  invite,
  lancerQuiz,
  attendre,
  instantane,
  ecrire,
  inscrireProfil,
  patienter,
  ADMIN,
  qcm,
  type Invite,
} from '../../../../server/test/banc'
import { brancheDe, portrait } from '../../../../shared/branches'
import { xpDuNiveau } from '../../../../shared/profil'
import { VERSION_BAREME } from '../../../../server/src/auth/profiles'

const REPO = fileURLToPath(new URL('../../../..', import.meta.url))
const Database = createRequire(path.join(REPO, 'server/package.json'))('better-sqlite3')
const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.join(ici, 'captures')
mkdirSync(sortie, { recursive: true })
const DECOUVERTE = process.argv.includes('decouverte')

const fichiers = readdirSync(path.join(REPO, 'client/public/compagnons'))
const perso = (cle: string) => '/compagnons/' + fichiers.find(f => f.startsWith(`${cle}-perso-512.`))

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const banc = await demarrer()
const url = banc.url
const cookie = await connexionAnimateur(url)
const navigateur = await chromium.launch({ headless: true })

try {
  const packId = await creerQuiz(
    url,
    cookie,
    [
      qcm('Quelle planète surnomme-t-on la planète rouge ?', ['Vénus', 'Mars', 'Jupiter', 'Saturne'], 1, 30),
      qcm('Combien de cordes compte un violon ?', ['Trois', 'Quatre', 'Cinq', 'Six'], 1, 30),
      qcm('Qui a peint « La Nuit étoilée » ?', ['Claude Monet', 'Vincent van Gogh', 'Paul Cézanne', 'Edgar Degas'], 1, 30),
      qcm('Quel est le plus grand océan du monde ?', ['Atlantique', 'Indien', 'Arctique', 'Pacifique'], 3, 30),
      qcm('En quelle unité mesure-t-on une fréquence ?', ['Le watt', 'Le hertz', 'Le joule', 'Le newton'], 1, 30),
    ],
    'Culture générale',
  )

  // Léa d'abord : elle porte le Phénix, et son loup la suit. Tom a son chat.
  const AMIS = [
    ['Léa', '🐸'],
    ['Tom', '🐼'],
    ['Julie', '🦊'],
    ['Karim', '🐙'],
    ['Inès', '🦄'],
    ['Hugo', '🦁'],
    ['Chloé', '🐨'],
    ['Malik', '🦉'],
    ['Sarah', '🐯'],
    ['Paul', '🎸'],
  ] as const
  const profils: (string | undefined)[] = []
  for (const [i, [nom, avatar]] of AMIS.entries()) profils.push(i < 5 ? await inscrireProfil(url, `ami${i}`, nom, avatar) : undefined)
  {
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const idDe = (i: number) => (base.prepare('SELECT id FROM profiles WHERE login = ?').get(`ami${i}`) as { id: string }).id
    const espace = (base.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    for (const [i, niveau] of [
      [0, 14],
      [1, 9],
      [2, 20],
      [3, 12],
      [4, 6],
    ] as const) {
      base
        .prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#jour', '', ?, ?, 1)`)
        .run(idDe(i), xpDuNiveau(niveau), JSON.stringify({ v: VERSION_BAREME, jours: 1 }))
      base.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xpDuNiveau(niveau), idDe(i))
    }
    for (const [i, ligne] of [
      [0, 'hf:phenix'],
      [3, 'dv:helios'],
    ] as const)
      base
        .prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, 'une-soiree-d-avant', ?, '', '', 1)`)
        .run(idDe(i), ligne, espace)
    base.prepare('INSERT OR REPLACE INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, 12, 1)').run(idDe(2), brancheDe(portrait('br:venise')!).key)
    for (const [i, cp, rang] of [
      [0, 'loup', 1],
      [1, 'chat', 2],
    ] as const)
      base.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 1000, ?, 1)').run(idDe(i), cp, rang)
    base.close()
    await banc.redemarrer()
  }
  for (const [i, cle] of [
    [0, 'lg:phenix'],
    [2, 'br:venise'],
    [3, 'dv:helios'],
  ] as const) {
    const r = await ecrire(url, '/api/joueur/moi', { legendaire: cle }, profils[i], 'PUT')
    if (!r.ok) throw new Error(`${AMIS[i][0]} ne porte pas ${cle} (${r.status})`)
  }

  const host = await ecranCommun(url, cookie)
  const tvContexte = await navigateur.newContext({ viewport: { width: 1920, height: 1080 } })
  const [nomCookie, valeurCookie] = cookie.split('=')
  await tvContexte.addCookies([{ name: nomCookie, value: valeurCookie, url }])
  await tvContexte.addInitScript(() => localStorage.setItem('quizz.muted', '1'))
  await tvContexte.addInitScript({ path: path.join(ici, 'page.js') })
  // Les humeurs peintes, servies à la page depuis le dossier de la maquette.
  await tvContexte.route('**/mq-humeurs/**', (route: any) =>
    route.fulfill({ path: path.join(ici, 'humeurs', decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!)), contentType: 'image/webp' }),
  )
  const tele = await tvContexte.newPage()
  tele.on('pageerror', (e: Error) => console.error('[télé]', e.message))
  await tele.goto(`${url}/host`)
  await patienter(1500)

  // Les amis arrivent ; Léa en dernier, sur son téléphone.
  const invites: Invite[] = []
  for (const [i, [nom, avatar]] of AMIS.entries()) {
    if (i === 0) continue
    invites[i] = await invite(url, nom, avatar, { cookie: profils[i] })
  }
  const lea = await invite(url, 'Léa', '🐸', { cookie: profils[0] })
  lea.socket.close()
  const telContexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const [nomJoueur, valeurJoueur] = profils[0]!.split('=')
  await telContexte.addCookies([{ name: nomJoueur, value: valeurJoueur, url }])
  await telContexte.addInitScript(
    ([cle, me]: string[]) => localStorage.setItem(cle, me),
    [`quizz.me.${ADMIN.slug}`, JSON.stringify({ playerId: lea.playerId, token: lea.token })],
  )
  await telContexte.addInitScript({ path: path.join(ici, 'page.js') })
  // Les humeurs peintes, servies à la page depuis le dossier de la maquette.
  await telContexte.route('**/mq-humeurs/**', (route: any) =>
    route.fulfill({ path: path.join(ici, 'humeurs', decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!)), contentType: 'image/webp' }),
  )
  const telephone = await telContexte.newPage()
  telephone.on('pageerror', (e: Error) => console.error('[téléphone]', e.message))
  await telephone.goto(`${url}/${ADMIN.slug}`)
  await patienter(2500)

  // Les amis répondent seuls : juste un peu plus lentement que Léa, et pas toujours.
  const REPONSES: Record<number, (number | null)[]> = {
    1: [1, 0, 1, 3, 2],
    2: [1, 1, 0, 0, 1],
    3: [0, 1, 1, 3, 3],
    4: [1, 2, 0, 3, 0],
    5: [2, 1, 3, 1, 1],
    6: [1, 3, 1, 0, 2],
    7: [3, 1, 2, 3, 0],
    8: [1, 0, 0, 2, 1],
    9: [null, null, null, null, null],
  }
  for (let i = 1; i < AMIS.length; i++) {
    const inv = invites[i]
    inv.socket.on('session:view', ({ sessionId, view }: any) => {
      if (view.phase !== 'question' || view.myAnswer != null || view.answered) return
      const choix = REPONSES[i][view.qIndex]
      if (choix === null || choix === undefined) return
      setTimeout(() => (inv.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: choix } }, () => {}), 2600 + i * 350)
    })
  }

  async function photo(page: any, nom: string) {
    await page.evaluate('document.activeElement?.blur?.()')
    await page.screenshot({ path: path.join(sortie, `${nom}.png`) })
    console.log(`  ${nom}`)
  }
  async function releve(page: any, nom: string) {
    if (!DECOUVERTE) return
    const boites = await page.evaluate(
      `(() => [...document.querySelectorAll('.av')].map(e => { const r = e.getBoundingClientRect(); const p = e.parentElement; return { cls: e.className, parent: p && p.className, gp: p && p.parentElement && p.parentElement.className, t: (p && p.parentElement && p.parentElement.textContent || '').trim().slice(0, 50), x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) } }))()`,
    )
    writeFileSync(path.join(sortie, `${nom}.json`), JSON.stringify(boites, null, 1))
  }
  /** Le compagnon posé par la bibliothèque de la page ; une ancre manquée se dit, sans arrêter la soirée. */
  async function poser(page: any, o: Record<string, unknown>) {
    try {
      return await page.evaluate(`window.__mq.poser(${JSON.stringify(o)})`)
    } catch (e) {
      console.log(`  (pas posé : ${(e as Error).message.split('\n')[0]})`)
    }
  }
  async function inserer(page: any, sel: string, ou: string, html: string) {
    try {
      await page.evaluate(`window.__mq.inserer(${JSON.stringify(sel)}, ${JSON.stringify(ou)}, ${JSON.stringify(html)})`)
    } catch (e) {
      console.log(`  (pas inséré : ${(e as Error).message.split('\n')[0]})`)
    }
  }
  /** Un geste de la bibliothèque de la page (`page.js`) ; un échec se dit sans arrêter la soirée. */
  async function mq(page: any, fn: string, o: unknown) {
    try {
      return await page.evaluate(`window.__mq.${fn}(${JSON.stringify(o)})`)
    } catch (e) {
      console.log(`  (maquette, ${fn} : ${(e as Error).message.split('\n')[0]})`)
    }
  }
  /** La photo du moment, le compagnon posé ; puis la page rendue telle qu'elle était. */
  async function avecLui(page: any, nom: string, poses: () => Promise<unknown>, opts: { pleine?: boolean } = {}) {
    await poses()
    await patienter(500)
    await page.evaluate('document.activeElement?.blur?.()')
    await page.screenshot({ path: path.join(sortie, `${nom}.png`), fullPage: !!opts.pleine })
    console.log(`  ${nom}`)
    await mq(page, 'nettoyer', null)
  }
  const H = (cle: string, humeur = 'neutre') => `/mq-humeurs/${cle}-${humeur}.webp`
  const LOUP = { louveteau: H('loup-louveteau'), jeune: H('loup-jeune'), adulte: H('loup-adulte'), ultime: H('loup-ultime') }
  const CHAT = H('chat-adulte', 'ravi')
  void perso

  // ── La salle d'attente ──────────────────────────────────────────────────
  await patienter(1200)
  await photo(tele, 'tv-attente-brut')
  await releve(tele, 'tv-attente-brut')
  await photo(telephone, 'tel-attente-brut')
  await releve(telephone, 'tel-attente-brut')
  // Léa arrive : la salle voit son loup une fois, comme le champion du mois.
  await avecLui(tele, 'tv-arrivee', () =>
    mq(tele, 'banniere', {
      avatarDe: ['.team-groups', 'Léa'],
      label: 'Elle arrive avec son compagnon',
      titre: 'Léa et Nox',
      sous: 'Nox, son jeune loup, la suit ce soir',
      place: 118,
      src: H('loup-jeune', 'ravi'),
      h: 150,
      humeur: 'ravi',
      miroir: true,
      dy: -58,
    }),
  )
  // Sur son téléphone, il se tient à côté d'elle.
  await avecLui(telephone, 'tel-attente', () => mq(telephone, 'poser', { ancre: '.me-header', place: 'dedansDroite', src: LOUP.jeune, h: 84, dx: -6, dy: 8, miroir: true }))

  let vue: any = null
  host.on('session:view', (p: any) => (vue = p))
  const phase = (ph: string, q?: number) =>
    vue?.view.phase === ph && (q === undefined || vue.view.qIndex === q)
      ? Promise.resolve(vue)
      : attendre<any>(host, 'session:view', p => p.view.phase === ph && (q === undefined || p.view.qIndex === q), `${ph} ${q ?? ''}`, 30000)
  const suivant = () => {
    const { phase: ph, qIndex, round } = vue.view
    ;(host as any).emit('host:command', { sessionId: vue.sessionId, command: { type: 'next', phase: ph, qIndex, round } })
  }
  async function leaRepond(reponse: RegExp) {
    await patienter(1200)
    try {
      await telephone.getByRole('button', { name: reponse }).first().click({ timeout: 10_000 })
    } catch (e) {
      console.log(`  (Léa n'a pas pu répondre : ${(e as Error).message.split('\n')[0]})`)
    }
    await patienter(3800)
  }

  await lancerQuiz(host, packId)
  const LEA = [/Mars/, /Quatre/, /Monet/, /Pacifique/, /hertz/]
  for (let q = 0; q < 5; q++) {
    await phase('question', q)
    if (q === 0) {
      await patienter(800)
      await photo(telephone, 'tel-question-brut')
      await photo(tele, 'tv-question-brut')
    }
    await leaRepond(LEA[q])
    suivant()
    await phase('reveal', q)
    // La gerbe de Léa retombe avant la photo : ses confettis se mêlaient à la carte.
    await patienter(3800)
    if (q === 0 || q === 2) {
      await photo(telephone, `tel-revelation-${q}-brut`)
      await photo(tele, `tv-revelation-${q}-brut`)
      // À la révélation, et jamais pendant la question : ravi ou dépité, perché sur sa réponse.
      await avecLui(telephone, `tel-revelation-${q === 0 ? 'juste' : 'ratee'}`, () =>
        mq(telephone, 'poser', { ancre: '.result-banner', place: 'perche', src: H('loup-jeune', q === 0 ? 'ravi' : 'depite'), h: 82, dx: -26, dy: 12, humeur: q === 0 ? 'ravi' : 'depite', miroir: true }),
      )
    }
    suivant()
  }
  await phase('finished')
  await patienter(6500)
  await photo(tele, 'tv-podium-brut')
  await releve(tele, 'tv-podium-brut')
  await photo(telephone, 'tel-podium-brut')
  // Au podium de l'écran commun, il triomphe à côté d'elle ; Tom, deuxième ex æquo, n'est que dans la liste : son chat n'y paraît pas.
  await avecLui(tele, 'tv-podium', () => mq(tele, 'surLaMarche', { col: '.final-podium .podium-col.rank-1', src: H('loup-jeune', 'triomphe'), h: 128, humeur: 'triomphe', miroir: true, gap: 14 }))
  await avecLui(telephone, 'tel-podium', () =>
    mq(telephone, 'poser', { ancre: '.marche.marche-moi .marche-socle', place: 'perche', src: H('loup-jeune', 'triomphe'), h: 68, dx: 24, dy: 6, humeur: 'triomphe', miroir: true }),
  )

  ;(host as any).emit('host:endSession', { sessionId: vue.sessionId })
  await patienter(1500)
  ;(host as any).emit('host:closeParty', { title: 'Culture générale' })
  await patienter(4500)
  await photo(tele, 'tv-cloture-brut')
  await releve(tele, 'tv-cloture-brut')
  await photo(telephone, 'tel-cloture-brut')
  // La clôture : Nox a passé ses 300 bonnes réponses ce soir — la salle le voit loup adulte, et Tom a son chat.
  await avecLui(tele, 'tv-cloture', async () => {
    await mq(tele, 'surLaMarche', { col: '.cloture .final-podium .podium-col.rank-1', src: H('loup-adulte', 'triomphe'), h: 124, humeur: 'triomphe', miroir: true, gap: 14 })
    await mq(tele, 'surLaMarche', { col: '.cloture .final-podium .podium-col.rank-2', src: CHAT, h: 104, humeur: 'neutre', miroir: true, gap: 12 })
    await mq(tele, 'grandisCeSoir', {
      x: 1418,
      y: 737,
      w: 442,
      titre: 'Ce soir, il a grandi',
      lignes: [{ de: LOUP.jeune, vers: H('loup-adulte', 'ravi'), titre: 'Nox', texte: 'le loup de Léa devient un loup adulte' }],
    })
  })
  await avecLui(
    telephone,
    'tel-cloture',
    async () => {
      await mq(telephone, 'poser', { ancre: '.fin-moi', place: 'dedansDroite', src: LOUP.adulte, h: 92, dx: -4, dy: 4, miroir: true })
      await mq(telephone, 'carteCroissance', {
        ou: '.card.gains',
        label: 'Ton compagnon',
        de: LOUP.jeune,
        vers: H('loup-adulte', 'ravi'),
        titre: 'Nox a grandi !',
        texte: 'Ton jeune loup est devenu un loup adulte : 300 bonnes réponses ensemble, dont 4 ce soir.',
        jauge: { fait: 300, total: 500, texte: '300 / 500 vers le loup des étoiles' },
      })
    },
    { pleine: true },
  )
  host.close()
  void instantane
  void poser
  void inserer
} finally {
  await navigateur.close()
  await banc.close()
}
console.log(`Captures dans ${sortie}`)
process.exit(0)
