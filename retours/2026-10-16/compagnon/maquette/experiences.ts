// Maquette — cinq expériences pour que la niche ne devienne pas un décor,
// filmées chacune à part dans les vrais écrans : le réveil, le nourrir, la
// bulle, la sortie, le repli et la fiche.
//
//   cd server && npx tsx ../retours/2026-10-16/compagnon/maquette/experiences.ts [reveil|nourrir|bulle|sortie|fiche|tout]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseDEssai, demarrer, ecrire, inscrireProfil, patienter, ADMIN } from '../../../../server/test/banc'
import { xpDuNiveau } from '../../../../shared/profil'
import { CATEGORIES } from '../../../../shared/categories'
import { hautFait, palierDe, titreDePalier } from '../../../../shared/hautsfaits'
import { ProfileStore, VERSION_BAREME } from '../../../../server/src/auth/profiles'

const REPO = fileURLToPath(new URL('../../../..', import.meta.url))
const Database = createRequire(path.join(REPO, 'server/package.json'))('better-sqlite3')
const ici = path.dirname(fileURLToPath(import.meta.url))
const FILMS = path.join(ici, 'films')
mkdirSync(FILMS, { recursive: true })
const QUOI = process.argv[2] ?? 'tout'

ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')
const navigateur = await chromium.launch({ headless: true })
const js = (page: any, code: string) => page.evaluate(code)
const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })

async function contexte(cookie: string) {
  const [nom, valeur] = cookie.split('=')
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
  for (const f of ['niche.js', 'niche-plus.js']) await ctx.addInitScript({ path: path.join(ici, f) })
  await ctx.route('**/mq-humeurs/**', (route: any) =>
    route.fulfill({ path: path.join(ici, 'humeurs', decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!)), contentType: 'image/webp' }),
  )
  const page = await ctx.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  return { ctx, page }
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



const confettis = (page: any) => js(page, `(() => { for (const c of document.querySelectorAll('.xp-confettis, .solde-puce')) for (const n of c.childNodes) if (n.nodeType === 3 && /\\d/.test(n.textContent)) n.textContent = ' 872' })()`)
const poser = (page: any, ecran: string) =>
  js(page, `document.querySelector('.nc') ? __niche.reposer(${JSON.stringify(ecran)}) : __niche.poser(${JSON.stringify({ cle: 'loup-adulte', ecran, vit: true })})`)
async function doigtSur(page: any, locator: any) {
  const r = await locator.boundingBox()
  if (r) await js(page, `__nicheplus.doigt(${r.x + r.width / 2}, ${r.y + r.height / 2})`)
  await patienter(200)
}
/** Le quiz du jour, ouvert et lancé, la niche posée sur sa première question. */
async function auJour(page: any) {
  await page.goto(`${banc.url}/jour`)
  await page.waitForSelector('.jour-heros')
  await page.locator('.jour-heros .btn-primary').click()
  await page.waitForSelector('.ans-btn')
  await patienter(500)
  await poser(page, 'jour-question')
  await patienter(500)
}
async function indexDe(page: any, tirage: any[], i: number, juste: boolean) {
  const textes: string[] = await page.locator('.ans-btn').allTextContents()
  const bonne = Math.max(0, textes.findIndex(t => t.includes(tirage[i].reponses[tirage[i].bonne])))
  return juste ? bonne : (bonne + 1) % textes.length
}
/** Une réponse, le doigt d'abord, puis la révélation, la niche reposée. */
async function jouer(page: any, tirage: any[], i: number, juste: boolean) {
  const k = await indexDe(page, tirage, i, juste)
  await doigtSur(page, page.locator('.ans-btn').nth(k))
  await repondre(page, tirage, i, juste)
  await poser(page, 'jour-revelation')
}
/** La question suivante, sans la filmer : le temps du chargement est coupé. */
async function passer(page: any, film: Film) {
  const coupe = film.maintenant()
  await suivante(page)
  await poser(page, 'jour-question')
  await js(page, `__niche.humeur('neutre')`)
  await patienter(300)
  film.couper(coupe, film.maintenant())
}

/** 1 · Le réveil : ses volets sont fermés, il dort ; tu arrives, il t'ouvre sa fenêtre. */
async function reveil() {
  const { ctx, page } = await contexte(await lea('lea1'))
  await page.goto(`${banc.url}/`)
  await page.waitForSelector('button.identite-ligne')
  await patienter(1500)
  await confettis(page)
  await poser(page, 'accueil')
  await js(page, '__nicheplus.volets()')
  await patienter(400)
  const film = new Film(page, 'expe-1-reveil', 780, 1688)
  await film.debut()
  await patienter(1600)
  await js(page, '__nicheplus.ouvrir()')
  await patienter(3000)
  await film.fin()
  await ctx.close()
}

/** 2 · Le nourrir : chaque bonne réponse vole jusqu'à sa niche et remplit sa jauge. */
async function nourrir() {
  const { ctx, page } = await contexte(await lea('lea2'))
  await auJour(page)
  await js(page, '__nicheplus.jauge(56)')
  const tirage = tirageDuJour()
  const film = new Film(page, 'expe-2-nourrir', 780, 1688)
  await film.debut()
  await patienter(1500)
  await jouer(page, tirage, 0, true)
  await patienter(250)
  await js(page, `__nicheplus.nourrir({ de: '.result-banner .big', part: 60 })`)
  await patienter(1900)
  await passer(page, film)
  await patienter(1200)
  await jouer(page, tirage, 1, true)
  await patienter(250)
  await js(page, `__nicheplus.nourrir({ de: '.result-banner .big', part: 64 })`)
  await patienter(2200)
  await film.fin()
  await ctx.close()
}

/** 3 · La bulle : il réagit dans une bulle qui sort de sa niche, lisible du coin de l'œil. */
async function bulle() {
  const { ctx, page } = await contexte(await lea('lea3'))
  await auJour(page)
  const tirage = tirageDuJour()
  const film = new Film(page, 'expe-3-bulle', 780, 1688)
  await film.debut()
  await patienter(1500)
  await jouer(page, tirage, 0, true)
  await patienter(250)
  await js(page, `__niche.humeur('ravi', { geste: 'saute' }); __nicheplus.bulle('ravi')`)
  await patienter(2600)
  await passer(page, film)
  await patienter(1200)
  await jouer(page, tirage, 1, false)
  await patienter(250)
  await js(page, `__niche.humeur('depite', { geste: 'abat' }); __nicheplus.bulle('depite')`)
  await patienter(2800)
  await film.fin()
  await ctx.close()
}

/** 4 · La sortie : aux grands moments, il sort de sa niche, en grand, puis y retourne. */
async function sortie() {
  const { ctx, page } = await contexte(await lea('lea4'))
  await auJour(page)
  const tirage = tirageDuJour()
  const film = new Film(page, 'expe-4-sortie', 780, 1688)
  await film.debut()
  await patienter(1300)
  await jouer(page, tirage, 0, true)
  await patienter(400)
  const carte = await js(page, `(() => { const r = document.querySelector('.result-banner').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom } })()`)
  await js(page, `__nicheplus.sortir({ x: ${carte.x}, y: ${carte.y + 150}, h: 132, humeur: 'triomphe', tenue: 2000 })`)
  await patienter(4000)
  await film.fin()
  await ctx.close()
}

/** 5 · Le repli et la fiche : il se fait petit quand la page défile ; le toucher ouvre sa fiche. */
async function fiche() {
  const { ctx, page } = await contexte(await lea('lea5'))
  await page.goto(`${banc.url}/boutique`)
  await page.waitForSelector('.boutique-tete')
  await patienter(1500)
  await confettis(page)
  await poser(page, 'boutique')
  await js(page, '__nicheplus.suivreLeDefilement()')
  const film = new Film(page, 'expe-5-repli-fiche', 780, 1688)
  await film.debut()
  await patienter(1000)
  await js(page, `window.scrollBy({ top: 700, behavior: 'smooth' })`)
  await patienter(1800)
  await js(page, `window.scrollTo({ top: 0, behavior: 'smooth' })`)
  await patienter(1500)
  const n = await js(page, `(() => { const r = document.querySelector('.nc').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
  await js(page, `__nicheplus.doigt(${n.x}, ${n.y})`)
  await patienter(250)
  await js(page, `__nicheplus.fiche(${JSON.stringify({ nom: 'Nox', forme: 'loup adulte', depuis: 'Avec toi depuis le 13 octobre', part: 56, jauge: '412 / 500 vers le loup des étoiles', ensemble: '412 bonnes réponses ensemble · +4 aujourd’hui' })})`)
  await patienter(1400)
  await doigtSur(page, page.locator('.npl-caresser'))
  await js(page, '__nicheplus.caresserDansLaFiche()')
  await patienter(2200)
  await js(page, '__nicheplus.fermerFiche()')
  await patienter(900)
  await film.fin()
  await ctx.close()
}

try {
  for (const [nom, f] of Object.entries({ reveil, nourrir, bulle, sortie, fiche }))
    if (QUOI === 'tout' || QUOI === nom) await f()
} finally {
  await navigateur.close()
  await banc.close()
}
process.exit(0)
