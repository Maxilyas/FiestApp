// Maquette — le compagnon vivant, filmé dans les vrais écrans : un serveur
// jetable, une joueuse qui joue pour de bon, et Nox, posé dans la page, qui
// respire, regarde, réagit avec ses humeurs peintes. Chaque moment est filmé à
// part (le screencast du navigateur, image par image), puis monté en fondu.
//
//   cd server && npx tsx ../retours/2026-10-16/compagnon/maquette/films.ts solo|soiree
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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
import { VIES } from '../../../../shared/campagne'
import { brancheDe, portrait } from '../../../../shared/branches'
import { hautFait, palierDe, titreDePalier } from '../../../../shared/hautsfaits'
import { ProfileStore, VERSION_BAREME } from '../../../../server/src/auth/profiles'
import { CampagneStore } from '../../../../server/src/core/campagne'

const REPO = fileURLToPath(new URL('../../../..', import.meta.url))
const Database = createRequire(path.join(REPO, 'server/package.json'))('better-sqlite3')
const ici = path.dirname(fileURLToPath(import.meta.url))
const SCENE = process.argv[2] ?? 'solo'
const FILMS = path.join(ici, 'films')
mkdirSync(FILMS, { recursive: true })

const INDEX = JSON.parse(readFileSync(path.join(ici, 'humeurs', 'index.json'), 'utf8')) as Record<string, { ratio: number }>
const forme = (cle: string, h: number, plus: Record<string, unknown> = {}) => ({ base: `/mq-humeurs/${cle}`, ratio: INDEX[cle].ratio, h, ...plus })
const largeurDe = (cle: string, h: number) => Math.round(h * INDEX[cle].ratio)
const H = (cle: string, humeur = 'neutre') => `/mq-humeurs/${cle}-${humeur}.webp`
const publics = readdirSync(path.join(REPO, 'client/public/compagnons'))
const RUBANS = '/compagnons/' + publics.find(f => f.startsWith('loup-ultime-vivant-rubans-512.'))

CampagneStore.reponsesDAutomate = () => [...Array(5).fill(true), ...Array(VIES).fill(false)]
ProfileStore.tirageEclat = () => false

const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')
const navigateur = await chromium.launch({ headless: true })

/** Ce que la page évalue part en texte : `tsx` glisserait des `__name` dans une fonction. */
const js = (page: any, code: string) => page.evaluate(code)

/** Un contexte de navigateur avec la maquette chargée avant la page, et les humeurs servies. */
async function contexte(opts: Record<string, unknown>, cookies: [string, string][]) {
  const ctx = await navigateur.newContext(opts)
  for (const [nom, valeur] of cookies) await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
  await ctx.addInitScript({ path: path.join(ici, 'page.js') })
  await ctx.addInitScript({ path: path.join(ici, 'vivant.js') })
  await ctx.route('**/mq-humeurs/**', (route: any) =>
    route.fulfill({ path: path.join(ici, 'humeurs', decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!)), contentType: 'image/webp' }),
  )
  return ctx
}

/**
 * Un film : des moments filmés chacun à part — le screencast du navigateur,
 * image par image, chacune datée —, encodés, puis montés en fondu.
 */
class Film {
  private cdp: any
  private segments: string[] = []
  private dossier = ''
  private images: { t: number; f: string }[] = []
  private n = 0
  constructor(
    private page: any,
    private nom: string,
    private w: number,
    private h: number,
  ) {}
  async debut(moment: string) {
    if (!this.cdp) {
      this.cdp = await this.page.context().newCDPSession(this.page)
      this.cdp.on('Page.screencastFrame', async (e: any) => {
        if (this.dossier) {
          const f = path.join(this.dossier, `i${String(this.n++).padStart(6, '0')}.jpg`)
          writeFileSync(f, Buffer.from(e.data, 'base64'))
          this.images.push({ t: e.metadata.timestamp, f })
        }
        await this.cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {})
      })
    }
    this.dossier = path.join(FILMS, `${this.nom}-${String(this.segments.length + 1).padStart(2, '0')}-${moment}`)
    rmSync(this.dossier, { recursive: true, force: true })
    mkdirSync(this.dossier, { recursive: true })
    this.images = []
    this.n = 0
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: this.w, maxHeight: this.h, everyNthFrame: 1 })
  }
  async fin() {
    await this.cdp.send('Page.stopScreencast')
    const dossier = this.dossier
    this.dossier = ''
    const images = this.images
    if (images.length < 2) throw new Error(`${dossier} : ${images.length} image(s) seulement`)
    const lignes = ['ffconcat version 1.0']
    images.forEach((im, k) => {
      const suivante = images[k + 1]
      lignes.push(`file '${path.basename(im.f)}'`, `duration ${(suivante ? suivante.t - im.t : 0.4).toFixed(4)}`)
    })
    lignes.push(`file '${path.basename(images[images.length - 1].f)}'`)
    writeFileSync(path.join(dossier, 'liste.txt'), lignes.join('\n') + '\n')
    const sortie = `${dossier}.mp4`
    const r = spawnSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dossier, 'liste.txt'), '-vf', `fps=30,scale=${this.w}:${this.h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-an', sortie],
      { encoding: 'utf8' },
    )
    if (r.status !== 0) throw new Error(`ffmpeg ${dossier} : ${r.stderr}`)
    rmSync(dossier, { recursive: true, force: true })
    this.segments.push(sortie)
    console.log(`  ${path.basename(sortie)} (${images.length} images, ${(images[images.length - 1].t - images[0].t).toFixed(1)} s)`)
  }
  /** Le montage : chaque moment enchaîné au suivant par un fondu. */
  monter() {
    const FONDU = 0.45
    const durees = this.segments.map(s => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', s], { encoding: 'utf8' }).stdout.trim()))
    const entrees = this.segments.flatMap(s => ['-i', s])
    let filtre = ''
    let offset = 0
    let avant = '[0:v]'
    for (let k = 1; k < this.segments.length; k++) {
      offset += durees[k - 1] - FONDU
      const sortie = k === this.segments.length - 1 ? '[v]' : `[x${k}]`
      filtre += `${avant}[${k}:v]xfade=transition=fade:duration=${FONDU}:offset=${offset.toFixed(3)}${sortie};`
      avant = sortie
    }
    const fichier = path.join(FILMS, `${this.nom}.mp4`)
    const args = ['-y', '-loglevel', 'error', ...entrees]
    if (this.segments.length > 1) args.push('-filter_complex', filtre.slice(0, -1), '-map', '[v]')
    args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', fichier)
    const r = spawnSync('ffmpeg', args, { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`montage ${fichier} : ${r.stderr}`)
    console.log(`→ ${fichier} (${durees.reduce((a, b) => a + b, 0).toFixed(1)} s avant fondus)`)
  }
}

/** Le rond du doigt sur un élément, puis le vrai clic. */
async function toucher(page: any, locator: any) {
  const b = await locator.boundingBox()
  if (b) await js(page, `__mqv.doigt(${b.x + b.width / 2}, ${b.y + b.height / 2})`)
  await patienter(180)
  await locator.click({ timeout: 4000 }).catch(() => {})
}

const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })
try {
  if (SCENE === 'solo') await solo()
  else await soiree()
} finally {
  await navigateur.close()
  await banc.close()
}
process.exit(0)

// ═══ Le solo : l'accueil, le quiz du jour, sa fin, un duel ════════════════

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
    db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 0, 2, ?)').run(id, 'loup', Date.UTC(2026, 9, 13, 18))
    db.close()
    await banc.redemarrer()
  }
  await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:phenix' }, cookie, 'PUT')

  const [nom, valeur] = cookie.split('=')
  const ctx = await contexte({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, [[nom, valeur]])
  const page = await ctx.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  const film = new Film(page, 'solo', 780, 1688)
  const aller = async (adresse: string) => {
    await page.goto('about:blank')
    await page.goto(`${banc.url}${adresse}`)
  }
  const NOX = 'loup-adulte'

  // ── 1. L'accueil : il t'attend, te salue, et se laisse caresser ─────────
  await aller('/')
  await page.waitForSelector('button.identite-ligne')
  await patienter(1800)
  // Un solde plausible : la base jetable n'a pas les soirées qui l'ont rempli.
  await js(page, `(() => { const c = document.querySelector('.xp-confettis'); if (c) for (const n of c.childNodes) if (n.nodeType === 3 && /\\d/.test(n.textContent)) n.textContent = ' 872' })()`)
  await js(
    page,
    `(() => { const av = document.querySelector('.identite-ligne .player-avatar'); const p = document.createElement('span'); p.className = 'mq-bloc mqv-place'; p.style.cssText = 'display:block;flex:none;align-self:stretch;width:46px;margin-left:-6px'; av.insertAdjacentElement('afterend', p) })()`,
  )
  {
    const place = await js(page, `__mqv.rectDe('.mqv-place')`)
    const ligne = await js(page, `__mqv.rectDe('.identite-ligne')`)
    await js(page, `__mqv.creer('nox', ${JSON.stringify(forme(NOX, 64, { miroir: true }))})`)
    await js(page, `__mqv.lui('nox').aller(${place.x + place.w / 2}, ${ligne.y + ligne.h + 6}, { instant: true })`)
  }
  await film.debut('accueil')
  await patienter(500)
  await js(page, `__mqv.lui('nox').reagir('ravi', { geste: 'saute', puis: 1100 })`)
  await patienter(2300)
  await js(page, `__mqv.lui('nox').caresse()`)
  await patienter(2700)
  await film.fin()

  // ── 2. Le quiz du jour : il regarde la question avec toi, puis réagit ───
  await aller('/jour')
  await page.waitForSelector('.jour-heros')
  await page.locator('.jour-heros .btn-primary').click()
  await page.waitForSelector('.ans-btn')
  const tirage = (() => {
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    const r = db.prepare('SELECT questions FROM jour_tirages ORDER BY jour DESC LIMIT 1').get() as { questions: string }
    db.close()
    return JSON.parse(r.questions) as { texte: string; reponses: string[]; bonne: number }[]
  })()
  const W = largeurDe(NOX, 100)
  /** À droite de la question, au-dessus des réponses : il la lit avec toi. */
  const aCoteDeLaQuestion = async (instant: boolean) => {
    const premier = await js(page, `__mqv.rectDe('.ans-btn')`)
    await js(page, `__mqv.lui('nox').aller(${390 - 14 - W / 2}, ${premier.y - 10}, { instant: ${instant} })`)
  }
  /** Sous la carte de la réponse, à droite. */
  const sousLaCarte = async () => {
    const carte = await js(page, `__mqv.rectDe('.result-banner')`)
    await js(page, `__mqv.lui('nox').aller(${390 - 34 - W / 2}, ${carte.y + carte.h + 136})`)
  }
  const indexDe = async (i: number, juste: boolean) => {
    const textes: string[] = await page.locator('.ans-btn').allTextContents()
    const q = tirage[i]
    const bonne = textes.findIndex(t => t.trim().endsWith(q.reponses[q.bonne].trim()) || t.includes(q.reponses[q.bonne]))
    return juste ? Math.max(0, bonne) : (Math.max(0, bonne) + 1) % textes.length
  }
  /** Une réponse : le doigt, puis on retouche tant que le temps de lecture la refuse. */
  const repondre = async (i: number, juste: boolean, doigt: boolean) => {
    const k = await indexDe(i, juste)
    const bouton = page.locator('.ans-btn').nth(k)
    if (doigt) await toucher(page, bouton)
    for (let essai = 0; essai < 24 && !(await page.locator('.result-banner').count()); essai++) {
      await bouton.click({ timeout: 1500 }).catch(() => {})
      await patienter(350)
    }
    await page.waitForSelector('.result-banner')
  }
  await js(page, `__mqv.creer('nox', ${JSON.stringify(forme(NOX, 100, { miroir: true }))})`)
  await aCoteDeLaQuestion(true)
  await patienter(400)
  await film.debut('question-juste')
  await patienter(2400)
  await repondre(0, true, true)
  await sousLaCarte()
  await patienter(320)
  await js(page, `__mqv.lui('nox').reagir('ravi', { geste: 'saute', coeurs: 5 })`)
  await patienter(3000)
  await film.fin()

  // ── 3. La question suivante, ratée : il baisse les oreilles ──────────────
  await page.locator('.btn-primary.btn-big').click()
  await page.waitForSelector('.ans-btn')
  await js(page, `__mqv.lui('nox').calme()`)
  await aCoteDeLaQuestion(true)
  await patienter(500)
  await film.debut('question-ratee')
  await patienter(2000)
  await repondre(1, false, true)
  await sousLaCarte()
  await patienter(320)
  await js(page, `__mqv.lui('nox').reagir('depite', { geste: 'abat', nuage: true })`)
  await patienter(3200)
  await film.fin()

  // Le reste du quiz, sans film : juste, presque toujours. « Question
  // suivante » se retouche tant que l'écran d'après n'est pas là : la page
  // refuse tout toucher dans sa première demi-seconde.
  const suivante = async () => {
    await patienter(700)
    for (let essai = 0; essai < 20; essai++) {
      await page.locator('.btn-primary.btn-big').first().click({ timeout: 2000 }).catch(() => {})
      try {
        await page.waitForSelector('.ans-btn, .fin-tete', { timeout: 1500 })
        return
      } catch {}
    }
    throw new Error('la question suivante ne vient pas')
  }
  for (let i = 2; ; i++) {
    await suivante()
    if (await page.locator('.fin-tete').count()) break
    await js(page, `__mqv.lui('nox').calme()`)
    await repondre(i, i !== 5, false)
  }
  await patienter(2200)

  // ── 4. La fin de la partie : ce que vous avez fait ensemble ──────────────
  await js(page, `__mqv.lui('nox')?.retirer()`)
  await js(
    page,
    `__mq.inserer('.card.gains', 'afterend', ${JSON.stringify(`<section class="card gains mq-bloc mqv-carte" aria-label="Ton compagnon">
  <span class="label">Ton compagnon</span>
  <div style="display:flex;align-items:flex-end;gap:16px;margin-top:8px">
    <span class="mqv-slot" style="display:block;flex:none;width:${largeurDe(NOX, 84)}px;height:84px"></span>
    <div style="display:flex;flex-direction:column;gap:2px;min-width:0;margin-bottom:6px">
      <b style="font-family:var(--serif,'Cormorant Garamond',serif);font-weight:600;font-size:1.6rem;line-height:1.1">Nox · <span class="mqv-compte">+0</span> ensemble</b>
      <span class="muted small">Il a fêté chacune de tes bonnes réponses.</span>
    </div>
  </div>
  <div class="gains-niveau">
    <div class="xp-bar" role="progressbar" aria-label="Vers le loup des étoiles"><div class="xp-fill mqv-jauge" style="width:80.8%;transition:width 1.4s ease"></div></div>
    <p class="muted small"><span class="mqv-total">404</span> / 500 · le loup des étoiles à 500</p>
  </div>
</section>`)})`,
  )
  await js(page, `document.querySelector('.mqv-carte').scrollIntoView({ block: 'center' })`)
  await patienter(600)
  {
    const slot = await js(page, `__mqv.rectDe('.mqv-slot')`)
    await js(page, `__mqv.creer('nox', ${JSON.stringify(forme(NOX, 84, { miroir: true }))})`)
    await js(page, `__mqv.lui('nox').aller(${slot.x + slot.w / 2}, ${slot.y + slot.h}, { instant: true })`)
  }
  await film.debut('fin')
  await patienter(900)
  await js(
    page,
    `(() => { let n = 0; const t = setInterval(() => { n++; document.querySelector('.mqv-compte').textContent = '+' + n; document.querySelector('.mqv-total').textContent = String(404 + n); if (n >= 8) clearInterval(t) }, 140); document.querySelector('.mqv-jauge').style.width = '82.4%' })()`,
  )
  await js(page, `__mqv.lui('nox').reagir('ravi', { geste: 'saute', coeurs: 6, puis: 1800 })`)
  await patienter(3600)
  await film.fin()

  // ── 5. Un duel gagné : il triomphe à côté de toi ─────────────────────────
  await aller('/duels')
  await page.getByRole('button', { name: /Un duel contre Automate|Reprendre ton duel contre/ }).click()
  await page.waitForSelector('.feuille-du-de')
  await page.locator('.feuille-du-de').getByRole('button', { name: 'Jouer le duel' }).click()
  await page.waitForSelector('.ans-btn')
  {
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    const ligne = db
      .prepare(`SELECT questions, position FROM campagne_series WHERE profile_id = ? AND mode = 'rencontre' AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1`)
      .get(id) as { questions: string; position: number }
    db.close()
    const qs = JSON.parse(ligne.questions) as { bonne: number; reponses: string[] }[]
    for (let i = ligne.position; ; i++) {
      await page.waitForSelector('.ans-btn')
      const q = qs[i]
      await page.locator('.ans-btn').nth(i < 8 ? q.bonne : (q.bonne + 1) % q.reponses.length).click()
      const suite = page.getByRole('button', { name: /Question suivante|Voir qui a gagné|Voir mon duel/ })
      await suite.waitFor()
      const derniere = !(await suite.textContent())?.includes('Question suivante')
      await suite.click()
      if (derniere) break
    }
  }
  await page.waitForSelector('.duels-carte3d.ouverte')
  await patienter(1400)
  {
    const toi = await js(page, `__mqv.rectDe('.duels-face-avatar.toi')`)
    await js(page, `__mqv.creer('nox', ${JSON.stringify(forme(NOX, 84, { z: 60 }))})`)
    await js(page, `__mqv.lui('nox').cacher()`)
    await js(page, `__mqv.lui('nox').aller(${toi.x - largeurDe(NOX, 84) / 2 + 22}, ${toi.y + toi.h + 14}, { instant: true })`)
  }
  await film.debut('duel')
  await patienter(500)
  await js(page, `__mqv.lui('nox').cacher(false); __mqv.lui('nox').geste('arrive')`)
  await patienter(700)
  await js(page, `__mqv.lui('nox').reagir('triomphe', { geste: 'hurle', gloire: true })`)
  await patienter(3400)
  await film.fin()

  film.monter()
}

// ═══ La soirée : le téléphone de Léa et l'écran commun, filmés ensemble ═══

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
        .prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#rattrapage', '', ?, ?, 1)`)
        .run(idDe(i), xpDuNiveau(niveau), JSON.stringify({ v: VERSION_BAREME }))
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
  const [nomCookie, valeurCookie] = cookie.split('=')
  const tvCtx = await contexte({ viewport: { width: 1920, height: 1080 } }, [[nomCookie, valeurCookie]])
  await tvCtx.addInitScript(() => localStorage.setItem('quizz.muted', '1'))
  const tele = await tvCtx.newPage()
  tele.on('pageerror', (e: Error) => console.error('[télé]', e.message))
  await tele.goto(`${url}/host`)
  await patienter(1500)
  const invites: Invite[] = []
  for (const [i, [nom, avatar]] of AMIS.entries()) {
    if (i === 0) continue
    invites[i] = await invite(url, nom, avatar, { cookie: profils[i] })
  }
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
  const filmTele = new Film(tele, 'tele', 1920, 1080)

  // ── L'arrivée de Léa, à l'écran commun : le bandeau, et Nox qui trottine ─
  await filmTele.debut('arrivee')
  await patienter(700)
  const lea = await invite(url, 'Léa', '🐸', { cookie: profils[0] })
  lea.socket.close()
  await patienter(900)
  await js(
    tele,
    `(() => {
      const sien = [...document.querySelectorAll('.team-groups .av')].find(av => { for (let p = av.parentElement; p; p = p.parentElement) { if (p.querySelectorAll('.av').length > 1) return false; if ((p.textContent || '').includes('Léa')) return true } return false })
      const div = document.createElement('div')
      div.className = 'entree-en-scene mq-bloc'
      div.setAttribute('role', 'status')
      div.style.cssText = 'padding-right:2.2rem;animation-duration:.7s,.5s;animation-delay:0s,7.4s'
      div.innerHTML = '<span class="entree-rayons" aria-hidden="true"></span><span class="mq-av"></span><span class="entree-texte"><span class="label">Elle arrive avec son compagnon</span><b>Léa et Nox</b><span>Nox, son loup, la suit ce soir</span></span><span class="mqv-place" style="display:block;flex:none;width:118px"></span>'
      if (sien) { const c = sien.cloneNode(true); c.classList.remove('lb-avatar'); c.classList.add('entree-avatar'); div.querySelector('.mq-av').replaceWith(c) } else div.querySelector('.mq-av').remove()
      document.body.appendChild(div)
    })()`,
  )
  await patienter(800)
  {
    // Il se pose dans le bandeau, les pattes sur son bord bas : le bandeau est
    // collé en haut de l'écran, et un loup plus grand y perdait les oreilles.
    const place = await js(tele, `__mqv.rectDe('.mqv-place')`)
    const bandeau = await js(tele, `__mqv.rectDe('.entree-en-scene.mq-bloc')`)
    const sol = bandeau.vy + bandeau.h - 8
    await js(tele, `__mqv.creer('nox', ${JSON.stringify(forme('loup-adulte', 104, { miroir: true, fixe: true, z: 80 }))})`)
    // Par la droite : tourné vers Léa, il trottine tête en avant.
    await js(tele, `__mqv.lui('nox').aller(${1920 + 120}, ${sol}, { instant: true })`)
    await js(tele, `__mqv.lui('nox').trotter(${place.vx + place.w / 2}, ${sol}, 2100)`)
    await patienter(2150)
    await js(tele, `__mqv.lui('nox').reagir('ravi', { geste: 'saute', coeurs: 6, puis: 1800 })`)
    await patienter(3600)
  }
  await filmTele.fin()
  await js(tele, `__mqv.lui('nox')?.retirer(); document.querySelectorAll('.mq-bloc').forEach(e => e.remove())`)

  // Le téléphone de Léa, en salle d'attente.
  const [nomJoueur, valeurJoueur] = profils[0]!.split('=')
  const telCtx = await contexte({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, [[nomJoueur, valeurJoueur]])
  await telCtx.addInitScript(
    ([cle, me]: string[]) => localStorage.setItem(cle, me),
    [`quizz.me.${ADMIN.slug}`, JSON.stringify({ playerId: lea.playerId, token: lea.token })],
  )
  const telephone = await telCtx.newPage()
  telephone.on('pageerror', (e: Error) => console.error('[téléphone]', e.message))
  await telephone.goto(`${url}/${ADMIN.slug}`)
  await telephone.waitForSelector('.me-header')
  await patienter(1800)
  const filmTel = new Film(telephone, 'telephone', 780, 1688)
  // 80 de haut au téléphone : en tête de page, plus grand, il perdait les
  // oreilles — et son nuage — contre le haut de l'écran.
  const HT = 80
  const WT = largeurDe('loup-adulte', HT)
  {
    const tete = await js(telephone, `__mqv.rectDe('.me-header')`)
    await js(telephone, `__mqv.creer('nox', ${JSON.stringify(forme('loup-adulte', HT, { miroir: true }))})`)
    await js(telephone, `__mqv.lui('nox').cacher()`)
    await js(telephone, `__mqv.lui('nox').aller(${tete.x + tete.w - WT / 2 - 10}, ${tete.y + tete.h + 46}, { instant: true })`)
  }
  await filmTel.debut('attente')
  await patienter(500)
  await js(telephone, `__mqv.lui('nox').cacher(false); __mqv.lui('nox').geste('arrive')`)
  await patienter(900)
  await js(telephone, `__mqv.lui('nox').reagir('ravi', { geste: 'saute', coeurs: 4, puis: 1500 })`)
  await patienter(2600)
  await filmTel.fin()

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
  // Nox à côté de la question, puis perché sur la réponse.
  const telNox = (code: string) => js(telephone, `__mqv.lui('nox').${code}`)
  const aCoteDeLaQuestion = async (instant: boolean) => {
    const premier = await js(telephone, `__mqv.rectDe('.ans-btn')`)
    if (premier) await telNox(`aller(${390 - 14 - WT / 2}, ${premier.y - 10}, { instant: ${instant} })`)
  }
  const surLaReponse = async () => {
    const carte = await js(telephone, `__mqv.rectDe('.result-banner')`)
    await telNox(`aller(${carte.x + carte.w - WT / 2 - 18}, ${carte.y + 14})`)
  }
  await js(telephone, `__mqv.creer('nox', ${JSON.stringify(forme('loup-adulte', HT, { miroir: true }))})`)
  await js(telephone, `__mqv.lui('nox').cacher()`)

  await lancerQuiz(host, packId)
  const LEA = [/Mars/, /Quatre/, /Monet/, /Pacifique/, /hertz/]
  for (let q = 0; q < 5; q++) {
    await phase('question', q)
    await telephone.waitForSelector('.ans-btn')
    await patienter(500)
    await telNox('calme()')
    await aCoteDeLaQuestion(true)
    await telNox('cacher(false)')
    const filme = q === 0 || q === 2
    if (filme) {
      await filmTel.debut(q === 0 ? 'juste' : 'ratee')
      await patienter(1800)
    }
    await toucher(telephone, telephone.getByRole('button', { name: LEA[q] }).first())
    await patienter(filme ? 1600 : 2400)
    suivant()
    await phase('reveal', q)
    await telephone.waitForSelector('.result-banner')
    await patienter(250)
    await surLaReponse()
    await patienter(300)
    await telNox(q === 2 ? `reagir('depite', { geste: 'abat', nuage: true })` : `reagir('ravi', { geste: 'saute', coeurs: 5 })`)
    if (filme) {
      await patienter(3200)
      await filmTel.fin()
    } else await patienter(1600)
    suivant()
  }

  // ── Le podium du quiz : sur le téléphone et à l'écran commun ─────────────
  await phase('finished')
  await patienter(6500)
  await telNox('calme()')
  {
    const socle = await js(telephone, `__mqv.rectDe('.marche.marche-moi .marche-socle')`)
    await js(telephone, `__mqv.creer('nox', ${JSON.stringify(forme('loup-adulte', 76, { miroir: true }))})`)
    await telNox('cacher()')
    await telNox(`aller(${socle.x + socle.w - largeurDe('loup-adulte', 76) / 2 + 24}, ${socle.y + 6}, { instant: true })`)
  }
  const placeSurLaMarche = async (page: any, col: string, h: number, cle: string, gap: number) => {
    const r = await js(
      page,
      `(() => { const col = document.querySelector(${JSON.stringify(col)}); const q = s => { const r = col.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height } }; return { av: q('.podium-avatar'), nom: q('.podium-name'), sol: q('.podium-step') } })()`,
    )
    const w = largeurDe(cle, h)
    const tete = Math.max(r.av.w, r.nom.w)
    const debut = r.sol.l + r.sol.w / 2 - (tete + gap + w) / 2
    const dx = Math.round(debut + tete / 2 - (r.av.l + r.av.w / 2))
    await js(page, `__mq.decaler(${JSON.stringify(col + ' .podium-avatar')}, ${dx}); __mq.decaler(${JSON.stringify(col + ' .podium-name')}, ${dx})`)
    return { x: debut + tete + gap + w / 2, y: r.sol.t + 6 }
  }
  {
    const pieds = await placeSurLaMarche(tele, '.final-podium .podium-col.rank-1', 132, 'loup-adulte', 14)
    await js(tele, `__mqv.creer('nox', ${JSON.stringify(forme('loup-adulte', 132, { miroir: true }))})`)
    await js(tele, `__mqv.lui('nox').cacher(); __mqv.lui('nox').aller(${pieds.x}, ${pieds.y}, { instant: true })`)
  }
  await Promise.all([filmTel.debut('podium'), filmTele.debut('podium')])
  await patienter(600)
  await Promise.all([telNox(`cacher(false)`), js(tele, `__mqv.lui('nox').cacher(false)`)])
  await Promise.all([telNox(`geste('arrive')`), js(tele, `__mqv.lui('nox').geste('arrive')`)])
  await patienter(650)
  await Promise.all([telNox(`reagir('triomphe', { geste: 'hurle', gloire: true })`), js(tele, `__mqv.lui('nox').reagir('triomphe', { geste: 'hurle', gloire: true })`)])
  await patienter(3600)
  await Promise.all([filmTel.fin(), filmTele.fin()])

  // ── La clôture : Nox a ses 500 bonnes réponses — il devient le loup des étoiles ─
  ;(host as any).emit('host:endSession', { sessionId: vue.sessionId })
  await patienter(1500)
  ;(host as any).emit('host:closeParty', { title: 'Culture générale' })
  await patienter(4500)
  await js(tele, `__mqv.lui('nox')?.retirer()`)
  await js(telephone, `__mqv.lui('nox')?.retirer()`)
  const ULTIME = { ...forme('loup-ultime', 0), vivant: RUBANS }
  // À l'écran commun : sur le podium de la soirée, puis le bloc « Ce soir, il a grandi ».
  {
    const pieds = await placeSurLaMarche(tele, '.cloture .final-podium .podium-col.rank-1', 128, 'loup-adulte', 16)
    await js(tele, `__mqv.creer('nox', ${JSON.stringify(forme('loup-adulte', 128, { miroir: true }))})`)
    await js(tele, `__mqv.lui('nox').aller(${pieds.x}, ${pieds.y}, { instant: true })`)
    await js(
      tele,
      `__mq.inserer('body', 'beforeend', ${JSON.stringify(`<div class="mq-bloc mqv-grandi" style="position:absolute;left:1418px;top:737px;width:442px;box-sizing:border-box;padding:18px 22px;border:1px solid var(--edge,rgba(217,181,106,.22));border-radius:18px;background:var(--surface,rgba(255,255,255,.035));z-index:55;display:flex;align-items:flex-end;gap:16px;opacity:0;transform:translateY(12px);transition:opacity .7s ease,transform .7s ease">
  <span class="mqv-atterrit" style="display:block;flex:none;width:${largeurDe('loup-ultime', 120)}px;height:120px;position:relative"><img alt="" src="${H('loup-ultime', 'triomphe')}" style="position:absolute;inset:0;width:100%;height:100%;transform:scaleX(-1);opacity:0;transition:opacity .25s ease;filter:drop-shadow(0 0 14px rgba(170,200,255,.55))"></span>
  <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px;min-width:0">
    <span style="font-family:var(--serif,'Cormorant Garamond',serif);font-size:1.55rem;color:var(--ink,#f3ece2)">Ce soir, il a grandi</span>
    <b style="font-family:var(--serif,'Cormorant Garamond',serif);font-weight:600;font-size:2rem;line-height:1.05">Nox</b>
    <span style="color:var(--muted,#a89b8a);font-size:1.05rem">le loup de Léa devient le loup des étoiles</span>
  </div>
</div>`)})`,
    )
  }
  // Sur le téléphone : la carte de la fin de soirée.
  await js(
    telephone,
    `__mq.inserer('.card.gains', 'afterend', ${JSON.stringify(`<section class="card gains mq-bloc mqv-carte" aria-label="Ton compagnon">
  <span class="label">Ton compagnon</span>
  <div style="display:flex;align-items:flex-end;justify-content:center;margin:10px 0 4px;height:150px">
    <span class="mqv-slot" style="display:block;width:${largeurDe('loup-adulte', 112)}px;height:112px"></span>
  </div>
  <b class="mqv-titre" style="display:block;font-family:var(--serif,'Cormorant Garamond',serif);font-weight:600;font-size:1.75rem;line-height:1.15">Nox · +4 ensemble ce soir</b>
  <p class="muted small mqv-texte" style="margin:4px 0 0">Plus que 4 bonnes réponses avant sa forme ultime…</p>
  <div class="gains-niveau">
    <div class="xp-bar" role="progressbar" aria-label="Vers le loup des étoiles"><div class="xp-fill mqv-jauge" style="width:99.2%;transition:width .8s ease"></div></div>
    <p class="muted small mqv-jauge-texte">496 / 500 vers le loup des étoiles</p>
  </div>
</section>`)})`,
  )
  await js(telephone, `document.querySelector('.mqv-carte').scrollIntoView({ block: 'center' })`)
  await patienter(700)
  {
    const slot = await js(telephone, `__mqv.rectDe('.mqv-slot')`)
    await js(telephone, `__mqv.creer('nox', ${JSON.stringify(forme('loup-adulte', 112, { miroir: true }))})`)
    await telNox(`aller(${slot.x + slot.w / 2}, ${slot.y + slot.h}, { instant: true })`)
  }
  await Promise.all([filmTel.debut('fin'), filmTele.debut('cloture')])
  await patienter(1200)
  // Les quatre dernières bonnes réponses tombent, la jauge se remplit.
  await js(telephone, `(() => { let n = 496; const t = setInterval(() => { n++; document.querySelector('.mqv-jauge-texte').textContent = n + ' / 500 vers le loup des étoiles'; document.querySelector('.mqv-jauge').style.width = (n / 5) + '%'; if (n >= 500) clearInterval(t) }, 220) })()`)
  await js(tele, `(() => { const g = document.querySelector('.mqv-grandi'); g.style.opacity = '1'; g.style.transform = 'none' })()`)
  await patienter(1100)
  // Il grandit, sur les deux écrans.
  await Promise.all([
    telNox(`grandir(${JSON.stringify({ ...ULTIME, h: 140 })})`),
    js(tele, `__mqv.lui('nox').grandir(${JSON.stringify({ ...ULTIME, h: 158 })})`),
  ])
  await js(
    telephone,
    `(() => { document.querySelector('.mqv-titre').textContent = 'Nox a grandi !'; document.querySelector('.mqv-texte').textContent = 'Ton loup est devenu le loup des étoiles : 500 bonnes réponses ensemble.'; document.querySelector('.mqv-jauge-texte').textContent = 'Forme ultime : le loup des étoiles' })()`,
  )
  await Promise.all([
    telNox(`reagir('triomphe', { geste: 'hurle', gloire: true })`),
    js(tele, `__mqv.lui('nox').reagir('triomphe', { geste: 'hurle', gloire: true })`),
  ])
  await patienter(2300)
  // À l'écran commun, le bond : du podium jusqu'au bloc qui raconte sa nuit.
  {
    const pieds = await js(tele, `__mqv.lui('nox').pieds()`)
    const cible = await js(tele, `__mqv.rectDe('.mqv-atterrit')`)
    await js(tele, `__mqv.lui('nox').cacher()`)
    await js(
      tele,
      `__mqv.bondir({ src: '/mq-humeurs/loup-bond.webp', ratio: ${INDEX['loup-bond'].ratio}, h: 150, de: { x: ${pieds.x}, y: ${pieds.y} }, vers: { x: ${cible.vx + cible.w / 2}, y: ${cible.vy + cible.h} }, hauteur: 260, duree: 1500 })`,
    )
    await js(tele, `document.querySelector('.mqv-atterrit img').style.opacity = '1'`)
  }
  await patienter(2600)
  await Promise.all([filmTel.fin(), filmTele.fin()])
  host.close()

  filmTel.monter()
  filmTele.monter()
}
