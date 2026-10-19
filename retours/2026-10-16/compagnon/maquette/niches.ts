// Maquette — la niche du compagnon, en haut à droite de toutes les pages :
// photographiée sur l'accueil, le profil, la boutique, le quiz du jour (une
// question, une bonne réponse, une ratée, au petit téléphone aussi) et la
// soirée (salle d'attente, question, podium) ; puis filmée, vivante.
//
//   cd server && npx tsx ../retours/2026-10-16/compagnon/maquette/niches.ts [photos|film]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
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
const SORTIE = path.join(ici, 'captures', 'niche')
const FILMS = path.join(ici, 'films')
mkdirSync(SORTIE, { recursive: true })
mkdirSync(FILMS, { recursive: true })
const QUOI = process.argv[2] ?? 'photos'

ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')
const navigateur = await chromium.launch({ headless: true })
const js = (page: any, code: string) => page.evaluate(code)

async function contexte(opts: Record<string, unknown>, cookies: [string, string][]) {
  const ctx = await navigateur.newContext(opts)
  for (const [nom, valeur] of cookies) await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
  for (const f of ['vivant.js', 'niche.js']) await ctx.addInitScript({ path: path.join(ici, f) })
  await ctx.route('**/mq-humeurs/**', (route: any) =>
    route.fulfill({ path: path.join(ici, 'humeurs', decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!)), contentType: 'image/webp' }),
  )
  return ctx
}

/** La niche posée sur la page telle qu'elle est, photographiée, puis retirée. */
async function photo(page: any, nom: string, ecran: string, humeur = 'neutre') {
  await js(page, `__niche.poser(${JSON.stringify({ cle: 'loup-adulte', humeur, ecran })})`)
  await patienter(450)
  await page.screenshot({ path: path.join(SORTIE, `${nom}.png`) })
  await js(page, '__niche.retirer()')
  console.log(`  ${nom}`)
}

/** Un film : le screencast du navigateur, image par image, chacune datée, puis encodé. */
class Film {
  private cdp: any
  private images: { t: number; f: string }[] = []
  private dossier = ''
  private n = 0
  constructor(
    private page: any,
    private nom: string,
    private w: number,
    private h: number,
  ) {}
  async debut() {
    this.cdp = await this.page.context().newCDPSession(this.page)
    this.dossier = path.join(FILMS, `${this.nom}-images`)
    rmSync(this.dossier, { recursive: true, force: true })
    mkdirSync(this.dossier, { recursive: true })
    this.cdp.on('Page.screencastFrame', async (e: any) => {
      if (this.dossier) {
        const f = path.join(this.dossier, `i${String(this.n++).padStart(6, '0')}.jpg`)
        writeFileSync(f, Buffer.from(e.data, 'base64'))
        this.images.push({ t: e.metadata.timestamp, f })
      }
      await this.cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {})
    })
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: this.w, maxHeight: this.h, everyNthFrame: 1 })
  }
  /** Ce qui ne se filme pas (un chargement, une attente) : les images de ce temps-là sont retirées au montage. */
  couper(de: number, a: number) {
    this.coupes.push([de, a])
  }
  private coupes: [number, number][] = []
  maintenant() {
    return Date.now() / 1000
  }
  async fin() {
    await this.cdp.send('Page.stopScreencast')
    const dossier = this.dossier
    this.dossier = ''
    let images = this.images.filter(im => !this.coupes.some(([de, a]) => im.t >= de && im.t < a))
    // Le temps coupé ne compte pas : chaque image dure jusqu'à la suivante, sans les trous.
    const lignes = ['ffconcat version 1.0']
    images.forEach((im, k) => {
      const suivante = images[k + 1]
      let d = suivante ? suivante.t - im.t : 0.4
      for (const [de, a] of this.coupes) if (suivante && im.t < de && suivante.t >= a) d -= a - de
      lignes.push(`file '${path.basename(im.f)}'`, `duration ${Math.max(0.01, d).toFixed(4)}`)
    })
    lignes.push(`file '${path.basename(images[images.length - 1].f)}'`)
    writeFileSync(path.join(dossier, 'liste.txt'), lignes.join('\n') + '\n')
    const sortie = path.join(FILMS, `${this.nom}.mp4`)
    const r = spawnSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dossier, 'liste.txt'), '-vf', `fps=30,scale=${this.w}:${this.h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', '-an', sortie],
      { encoding: 'utf8' },
    )
    if (r.status !== 0) throw new Error(`ffmpeg : ${r.stderr}`)
    rmSync(dossier, { recursive: true, force: true })
    console.log(`→ ${sortie} (${images.length} images)`)
  }
}

const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })
try {
  if (QUOI === 'photos') {
    await solo()
    await soiree()
  } else if (QUOI === 'soiree') await soiree()
  else await film()
} finally {
  await navigateur.close()
  await banc.close()
}
process.exit(0)

/** Léa, niveau 14, son Phénix — et un profil prêt. */
async function lea(login: string) {
  const cookie = await inscrireProfil(banc.url, login, 'Léa', '🐸')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
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
  await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:phenix' }, cookie, 'PUT')
  return cookie
}

/** Le tirage du jour : la bonne réponse de chaque question, par son texte. */
function tirageDuJour() {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  const r = db.prepare('SELECT questions FROM jour_tirages ORDER BY jour DESC LIMIT 1').get() as { questions: string }
  db.close()
  return JSON.parse(r.questions) as { reponses: string[]; bonne: number }[]
}
async function repondre(page: any, tirage: { reponses: string[]; bonne: number }[], i: number, juste: boolean, avant?: () => Promise<void>) {
  const textes: string[] = await page.locator('.ans-btn').allTextContents()
  const bonne = Math.max(0, textes.findIndex(t => t.includes(tirage[i].reponses[tirage[i].bonne])))
  const k = juste ? bonne : (bonne + 1) % textes.length
  if (avant) await avant()
  for (let essai = 0; essai < 24 && !(await page.locator('.result-banner').count()); essai++) {
    await page.locator('.ans-btn').nth(k).click({ timeout: 1500 }).catch(() => {})
    await patienter(350)
  }
  await page.waitForSelector('.result-banner')
}
async function suivante(page: any) {
  await patienter(700)
  for (let essai = 0; essai < 20; essai++) {
    await page.locator('.btn-primary.btn-big').first().click({ timeout: 2000 }).catch(() => {})
    try {
      await page.waitForSelector('.ans-btn, .fin-tete', { timeout: 1500 })
      return
    } catch {}
  }
}

async function solo() {
  const cookie = await lea('lea')
  const [nom, valeur] = cookie.split('=')
  const ctx = await contexte({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, [[nom, valeur]])
  const page = await ctx.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  const aller = async (adresse: string, attendu: string) => {
    await page.goto('about:blank')
    await page.goto(`${banc.url}${adresse}`)
    await page.waitForSelector(attendu)
    await patienter(1500)
    await js(page, `(() => { for (const c of document.querySelectorAll('.xp-confettis, .solde-puce')) for (const n of c.childNodes) if (n.nodeType === 3 && /\\d/.test(n.textContent)) n.textContent = ' 872' })()`)
  }
  await aller('/', 'button.identite-ligne')
  await photo(page, 'accueil', 'accueil')
  await aller('/profil', '.player-shell > .identite-ligne')
  await photo(page, 'profil', 'profil')
  await aller('/boutique', '.boutique-tete')
  await photo(page, 'boutique', 'boutique')

  await aller('/jour', '.jour-heros')
  await page.locator('.jour-heros .btn-primary').click()
  await page.waitForSelector('.ans-btn')
  await patienter(700)
  await photo(page, 'jour-question', 'jour-question')
  const tirage = tirageDuJour()
  await repondre(page, tirage, 0, true)
  await patienter(2800)
  await photo(page, 'jour-juste', 'jour-revelation', 'ravi')
  await suivante(page)
  await repondre(page, tirage, 1, false)
  await patienter(1200)
  await photo(page, 'jour-ratee', 'jour-revelation', 'depite')
  await suivante(page)
  await page.setViewportSize({ width: 360, height: 640 })
  await patienter(900)
  await photo(page, 'jour-petit', 'jour-question')
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
  const cookieLea = await lea('lea2')
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
      setTimeout(() => (inv.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: choix } }, () => {}), 2600 + i * 250)
    })
  }
  const moi = await invite(url, 'Léa', '🐸', { cookie: cookieLea })
  moi.socket.close()
  const [nomJoueur, valeurJoueur] = cookieLea.split('=')
  const ctx = await contexte({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, [[nomJoueur, valeurJoueur]])
  await ctx.addInitScript(([cle, me]: string[]) => localStorage.setItem(cle, me), [`quizz.me.${ADMIN.slug}`, JSON.stringify({ playerId: moi.playerId, token: moi.token })])
  const telephone = await ctx.newPage()
  telephone.on('pageerror', (e: Error) => console.error('[téléphone]', e.message))
  await telephone.goto(`${url}/${ADMIN.slug}`)
  await telephone.waitForSelector('.me-header')
  await patienter(1500)
  await photo(telephone, 'soiree-attente', 'soiree-attente')

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
  const LEA = [/Mars/, /Quatre/, /Gogh/]
  for (let q = 0; q < 3; q++) {
    await phase('question', q)
    await telephone.waitForSelector('.ans-btn')
    await patienter(800)
    if (q === 0) await photo(telephone, 'soiree-question', 'soiree-question')
    await telephone.getByRole('button', { name: LEA[q] }).first().click({ timeout: 4000 }).catch(() => {})
    await patienter(2600)
    if (vue?.view.phase === 'question' && vue.view.qIndex === q) suivant()
    await phase('reveal', q)
    await telephone.waitForSelector('.result-banner')
    await patienter(1000)
    if (vue?.view.phase === 'reveal' && vue.view.qIndex === q) suivant()
  }
  await phase('finished')
  await telephone.waitForSelector('.fin-quiz-ligne')
  await patienter(6500)
  await photo(telephone, 'soiree-podium', 'soiree-podium', 'triomphe')
  host.close()
  await ctx.close()
}

/** Le film : la niche vivante, de l'accueil à deux révélations du quiz du jour. */
async function film() {
  const cookie = await lea('lea')
  const [nom, valeur] = cookie.split('=')
  const ctx = await contexte({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, [[nom, valeur]])
  const page = await ctx.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  // La niche suit d'une page à l'autre : posée à chaque chargement, comme le ferait l'application.
  const niche = (ecran: string, humeur = 'neutre') =>
    js(page, `document.querySelector('.nc') ? __niche.reposer(${JSON.stringify(ecran)}) : __niche.poser(${JSON.stringify({ cle: 'loup-adulte', humeur, ecran, vit: true })})`)
  const confettis = () => js(page, `(() => { for (const c of document.querySelectorAll('.xp-confettis')) for (const n of c.childNodes) if (n.nodeType === 3 && /\\d/.test(n.textContent)) n.textContent = ' 872' })()`)
  await page.goto(`${banc.url}/`)
  await page.waitForSelector('button.identite-ligne')
  await patienter(1500)
  await confettis()
  await niche('accueil')
  const film = new Film(page, 'niche', 780, 1688)
  await film.debut()
  await patienter(1800)
  // Il te sourit en passant.
  await js(page, `__niche.humeur('ravi', { geste: 'saute' })`)
  await patienter(1300)
  await js(page, `__niche.humeur('neutre')`)
  await patienter(500)
  // Vers le quiz du jour : la niche ne bouge pas d'une page à l'autre.
  const versLeJour = page.locator('a[href="/jour"]').first()
  const bj = await versLeJour.boundingBox().catch(() => null)
  if (bj) await js(page, `__mqv.doigt(${bj.x + bj.width / 2}, ${bj.y + bj.height / 2})`)
  await patienter(250)
  let coupe = film.maintenant()
  await versLeJour.click({ timeout: 3000 }).catch(() => {})
  await page.waitForURL(/\/jour/, { timeout: 4000 }).catch(() => page.goto(`${banc.url}/jour`))
  await page.waitForSelector('.jour-heros')
  await patienter(700)
  await niche('jour')
  film.couper(coupe, film.maintenant())
  await patienter(1100)
  const depart = page.locator('.jour-heros .btn-primary')
  const b = await depart.boundingBox()
  if (b) await js(page, `__mqv.doigt(${b.x + b.width / 2}, ${b.y + b.height / 2})`)
  await patienter(250)
  coupe = film.maintenant()
  await depart.click()
  await page.waitForSelector('.ans-btn')
  await niche('jour-question')
  await patienter(300)
  film.couper(coupe, film.maintenant())
  await patienter(2200)
  const tirage = tirageDuJour()
  const doigtSur = async (k: number) => {
    const r = await page.locator('.ans-btn').nth(k).boundingBox()
    if (r) await js(page, `__mqv.doigt(${r.x + r.width / 2}, ${r.y + r.height / 2})`)
    await patienter(180)
  }
  const indexDe = async (i: number, juste: boolean) => {
    const textes: string[] = await page.locator('.ans-btn').allTextContents()
    const bonne = Math.max(0, textes.findIndex(t => t.includes(tirage[i].reponses[tirage[i].bonne])))
    return juste ? bonne : (bonne + 1) % textes.length
  }
  await doigtSur(await indexDe(0, true))
  await repondre(page, tirage, 0, true)
  await niche('jour-revelation')
  await patienter(250)
  await js(page, `__niche.humeur('ravi', { geste: 'saute' })`)
  await patienter(2800)
  coupe = film.maintenant()
  await suivante(page)
  await niche('jour-question')
  await js(page, `__niche.humeur('neutre')`)
  await patienter(300)
  film.couper(coupe, film.maintenant())
  await patienter(2000)
  await doigtSur(await indexDe(1, false))
  await repondre(page, tirage, 1, false)
  await niche('jour-revelation')
  await patienter(250)
  await js(page, `__niche.humeur('depite', { geste: 'abat' })`)
  await patienter(3000)
  await film.fin()
  await ctx.close()
}
