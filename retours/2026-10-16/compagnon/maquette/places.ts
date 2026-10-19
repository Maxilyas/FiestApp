// Maquette — quatre places réservées au compagnon, photographiées dans les
// vrais écrans : l'accueil, une question du quiz du jour, sa révélation, une
// révélation ratée en soirée, et la question au petit téléphone (360 × 640).
//
//   cd server && npx tsx ../retours/2026-10-16/compagnon/maquette/places.ts
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  baseDEssai,
  demarrer,
  connexionAnimateur,
  creerQuiz,
  ecranCommun,
  invite,
  lancerQuiz,
  attendre,
  ecrire,
  inscrireProfil,
  patienter,
  ADMIN,
  qcm,
  type Invite,
} from '../../../../server/test/banc'
import { xpDuNiveau } from '../../../../shared/profil'
import { CATEGORIES } from '../../../../shared/categories'
import { hautFait, palierDe, titreDePalier } from '../../../../shared/hautsfaits'
import { ProfileStore, VERSION_BAREME } from '../../../../server/src/auth/profiles'

const REPO = fileURLToPath(new URL('../../../..', import.meta.url))
const Database = createRequire(path.join(REPO, 'server/package.json'))('better-sqlite3')
const ici = path.dirname(fileURLToPath(import.meta.url))
const SORTIE = path.join(ici, 'captures', 'places')
mkdirSync(SORTIE, { recursive: true })
const CONCEPTS = ['perchoir', 'sol', 'loge', 'scene']

ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')
const navigateur = await chromium.launch({ headless: true })
const js = (page: any, code: string) => page.evaluate(code)

async function contexte(opts: Record<string, unknown>, cookies: [string, string][]) {
  const ctx = await navigateur.newContext(opts)
  for (const [nom, valeur] of cookies) await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
  for (const f of ['page.js', 'places.js']) await ctx.addInitScript({ path: path.join(ici, f) })
  await ctx.route('**/mq-humeurs/**', (route: any) =>
    route.fulfill({ path: path.join(ici, 'humeurs', decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!)), contentType: 'image/webp' }),
  )
  return ctx
}

/** Les quatre propositions sur l'écran tel qu'il est : chacune posée, photographiée, puis défaite. */
async function photographier(page: any, ecran: string) {
  for (const c of CONCEPTS) {
    await js(page, `__pl.appliquer(${JSON.stringify(c)}, ${JSON.stringify(ecran)})`)
    await patienter(250)
    await page.screenshot({ path: path.join(SORTIE, `${c}-${ecran}.png`) })
    await js(page, '__pl.nettoyer()')
  }
  console.log(`  ${ecran} : ${CONCEPTS.length} propositions`)
}

const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })
const QUOI = process.argv[2] ?? 'tout'
try {
  if (QUOI !== 'soiree') await solo()
  if (QUOI !== 'solo') await soiree()
} finally {
  await navigateur.close()
  await banc.close()
}
process.exit(0)

async function solo() {
  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🐸')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  {
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#rattrapage', '', ?, ?, 1)`).run(id, xpDuNiveau(14), JSON.stringify({ v: VERSION_BAREME }))
    db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xpDuNiveau(14), id)
    const badge = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, 'une-soiree-d-avant', ?, ?, ?, 1)`)
    for (const cle of ['hf:phenix', 'hf:sans-faute:1', 'hf:oracle']) {
      const palier = palierDe(cle)
      const h = palier ? palier.hautFait : hautFait(cle)!
      badge.run(id, cle, espace, h.emoji, palier ? titreDePalier(palier.hautFait, palier.palier) : h.title)
    }
    db.close()
    await banc.redemarrer()
  }
  await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:phenix' }, cookie, 'PUT')

  const [nom, valeur] = cookie.split('=')
  const ctx = await contexte({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, [[nom, valeur]])
  const page = await ctx.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))

  // L'accueil.
  await page.goto(`${banc.url}/`)
  await page.waitForSelector('button.identite-ligne')
  await patienter(1800)
  // Un solde plausible : la base jetable n'a pas les soirées qui l'ont rempli.
  await js(page, `(() => { const c = document.querySelector('.xp-confettis'); if (c) for (const n of c.childNodes) if (n.nodeType === 3 && /\\d/.test(n.textContent)) n.textContent = ' 872' })()`)
  await photographier(page, 'accueil')

  // Le quiz du jour : la première question, puis sa révélation, juste.
  await page.goto('about:blank')
  await page.goto(`${banc.url}/jour`)
  await page.waitForSelector('.jour-heros')
  await page.locator('.jour-heros .btn-primary').click()
  await page.waitForSelector('.ans-btn')
  await patienter(700)
  await photographier(page, 'question')
  const tirage = (() => {
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    const r = db.prepare('SELECT questions FROM jour_tirages ORDER BY jour DESC LIMIT 1').get() as { questions: string }
    db.close()
    return JSON.parse(r.questions) as { reponses: string[]; bonne: number }[]
  })()
  const textes: string[] = await page.locator('.ans-btn').allTextContents()
  const bonne = Math.max(0, textes.findIndex(t => t.includes(tirage[0].reponses[tirage[0].bonne])))
  for (let essai = 0; essai < 24 && !(await page.locator('.result-banner').count()); essai++) {
    await page.locator('.ans-btn').nth(bonne).click({ timeout: 1500 }).catch(() => {})
    await patienter(350)
  }
  await page.waitForSelector('.result-banner')
  // La gerbe de la bonne réponse retombe avant la photo.
  await patienter(2800)
  await photographier(page, 'revelation')

  // La question suivante, au petit téléphone.
  await patienter(400)
  for (let essai = 0; essai < 20; essai++) {
    await page.locator('.btn-primary.btn-big').first().click({ timeout: 2000 }).catch(() => {})
    try {
      await page.waitForSelector('.ans-btn', { timeout: 1500 })
      break
    } catch {}
  }
  await page.setViewportSize({ width: 360, height: 640 })
  await patienter(900)
  await photographier(page, 'petit')
  await ctx.close()
}

async function soiree() {
  const url = banc.url
  const cookie = await connexionAnimateur(url)
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
  const AMIS = [
    ['Léa', '🐸'],
    ['Tom', '🐼'],
    ['Julie', '🦊'],
    ['Karim', '🐙'],
    ['Inès', '🦄'],
    ['Hugo', '🦁'],
    ['Chloé', '🐨'],
  ] as const
  const lea = await inscrireProfil(url, 'lea2', 'Léa', '🐸')
  const host = await ecranCommun(url, cookie)
  const invites: Invite[] = []
  for (const [i, [nom, avatar]] of AMIS.entries()) if (i > 0) invites[i] = await invite(url, nom, avatar)
  const REPONSES: Record<number, number[]> = { 1: [1, 0, 1], 2: [1, 1, 0], 3: [0, 1, 1], 4: [1, 2, 0], 5: [2, 1, 3], 6: [1, 3, 1] }
  for (let i = 1; i < AMIS.length; i++) {
    const inv = invites[i]
    inv.socket.on('session:view', ({ sessionId, view }: any) => {
      if (view.phase !== 'question' || view.myAnswer != null || view.answered) return
      const choix = REPONSES[i][view.qIndex]
      if (choix === undefined) return
      setTimeout(() => (inv.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: choix } }, () => {}), 900 + i * 250)
    })
  }
  const moi = await invite(url, 'Léa', '🐸', { cookie: lea })
  moi.socket.close()
  const [nomJoueur, valeurJoueur] = lea.split('=')
  const ctx = await contexte({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, [[nomJoueur, valeurJoueur]])
  await ctx.addInitScript(([cle, me]: string[]) => localStorage.setItem(cle, me), [`quizz.me.${ADMIN.slug}`, JSON.stringify({ playerId: moi.playerId, token: moi.token })])
  const telephone = await ctx.newPage()
  telephone.on('pageerror', (e: Error) => console.error('[téléphone]', e.message))
  await telephone.goto(`${url}/${ADMIN.slug}`)
  await telephone.waitForSelector('.me-header')

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
  await lancerQuiz(host, packId)
  const LEA = [/Mars/, /Quatre/, /Monet/]
  for (let q = 0; q < 3; q++) {
    await phase('question', q)
    await telephone.waitForSelector('.ans-btn')
    await patienter(900)
    await telephone.getByRole('button', { name: LEA[q] }).first().click({ timeout: 4000 }).catch(() => {})
    await patienter(2800)
    // Tout le monde a répondu : la salle passe seule à la révélation, et un
    // « suivant » de plus sauterait à la question d'après.
    if (vue?.view.phase === 'question' && vue.view.qIndex === q) suivant()
    await phase('reveal', q)
    try {
      await telephone.waitForSelector('.result-banner', { timeout: 12000 })
    } catch (e) {
      await telephone.screenshot({ path: path.join(SORTIE, `echec-${q}.png`) })
      console.log('vue de l’écran commun :', vue?.view.phase, vue?.view.qIndex)
      throw e
    }
    if (q < 2) {
      await patienter(1200)
      if (vue?.view.phase === 'reveal' && vue.view.qIndex === q) suivant()
    }
  }
  await patienter(1500)
  await photographier(telephone, 'soiree')
  host.close()
  await ctx.close()
}
