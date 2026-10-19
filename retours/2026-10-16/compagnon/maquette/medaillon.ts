// Maquette — le médaillon qui suit, sur un quiz de soirée entier : Léa porte
// son loup (la troisième forme, Nox), peint comme l'appli le peint — sa pleine
// lune, son anneau épique, la tête qui sort du cercle. Dès la première
// question, ce médaillon-là la suit en haut à droite et vit : calme pendant la
// question, le souffle retenu, nourri (son anneau se remplit), dépité avec
// elle, la bulle pour la question que peu ont trouvée, et au podium il sort —
// le médaillon garde sa lune — puis rentre. Sous-titré en bas.
//
//   cd server && npx tsx ../retours/2026-10-16/compagnon/maquette/medaillon.ts [essai|film]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
const FILMS = path.join(ici, 'films')
const ESSAI = path.join(ici, 'controle', 'medaillon')
mkdirSync(FILMS, { recursive: true })
const QUOI = process.argv[2] ?? 'film'
if (QUOI === 'essai') {
  rmSync(ESSAI, { recursive: true, force: true })
  mkdirSync(ESSAI, { recursive: true })
}

ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')
const navigateur = await chromium.launch({ headless: true })
const js = (page: any, code: string) => page.evaluate(code)
const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })

/** La bande des sous-titres, sous l'écran du téléphone : 84 px, aux polices de l'appli. */
const BANDE = 84
const POLICES = {
  figtree: readFileSync(path.join(REPO, 'client/public/fonts/figtree-variable.woff2')).toString('base64'),
  cormorant: readFileSync(path.join(REPO, 'client/public/fonts/cormorant-garamond-600.woff2')).toString('base64'),
}
async function sousTitre(quand: string, quoi: string, fichier: string) {
  const page = await navigateur.newPage({ viewport: { width: 390, height: BANDE }, deviceScaleFactor: 2 })
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Figtree;src:url(data:font/woff2;base64,${POLICES.figtree}) format('woff2');font-weight:300 900}
@font-face{font-family:Cormorant;src:url(data:font/woff2;base64,${POLICES.cormorant}) format('woff2');font-weight:600}
html,body{margin:0;background:#110c0a}
.bande{box-sizing:border-box;width:390px;height:${BANDE}px;padding:0 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;border-top:1px solid rgba(217,181,106,.32);text-align:center}
.quand{font:600 10.5px/1 Figtree,sans-serif;letter-spacing:.15em;text-transform:uppercase;color:#d9b56a}
.quoi{font:600 21px/1.15 Cormorant,Georgia,serif;color:#f3ece2}
</style><div class="bande"><span class="quand">${quand}</span><span class="quoi">${quoi}</span></div>`)
  await page.evaluate('document.fonts.ready')
  await page.screenshot({ path: fichier })
  await page.close()
}

/** Un film : le screencast du navigateur, image par image, chacune datée, puis encodé — et ses sous-titres. */
class Film {
  private cdp: any
  private images: { t: number; f: string }[] = []
  private dossier = ''
  private n = 0
  private coupes: [number, number][] = []
  private marques: { t: number; quand: string; quoi: string }[] = []
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
  maintenant() {
    return Date.now() / 1000
  }
  /** Un sous-titre, de maintenant jusqu'au suivant. */
  marquer(quand: string, quoi: string) {
    this.marques.push({ t: this.maintenant(), quand, quoi })
  }
  /** L'heure d'un instant dans le film monté : le temps coupé avant lui ne compte pas. */
  private auMontage(t: number, t0: number) {
    let x = t - t0
    for (const [de, a] of this.coupes) {
      if (a <= t) x -= a - de
      else if (de < t) x -= t - de
    }
    return Math.max(0, x)
  }
  async fin() {
    await this.cdp.send('Page.stopScreencast')
    const dossier = this.dossier
    this.dossier = ''
    const images = this.images.filter(im => !this.coupes.some(([de, a]) => im.t >= de && im.t < a))
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
    const nu = path.join(dossier, 'nu.mp4')
    let r = spawnSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dossier, 'liste.txt'), '-vf', `fps=30,scale=${this.w}:${this.h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-an', nu],
      { encoding: 'utf8' },
    )
    if (r.status !== 0) throw new Error(`ffmpeg : ${r.stderr}`)
    const t0 = images[0].t
    const duree = this.auMontage(images[images.length - 1].t, t0) + 0.4
    // Les sous-titres : une image chacun, posée sous le téléphone de sa marque à la suivante, en fondu.
    const poses = this.marques.map((m, k) => ({ ...m, de: this.auMontage(m.t, t0), a: k + 1 < this.marques.length ? this.auMontage(this.marques[k + 1].t, t0) : duree }))
    const entrees: string[] = []
    const filtres: string[] = [`[0:v]pad=${this.w}:${this.h + BANDE * 2}:0:0:color=0x110c0a[b0]`]
    for (const [k, p] of poses.entries()) {
      const f = path.join(dossier, `st${k}.png`)
      await sousTitre(p.quand, p.quoi, f)
      entrees.push('-loop', '1', '-framerate', '30', '-t', duree.toFixed(3), '-i', f)
      const fondu = Math.min(0.16, (p.a - p.de) / 3)
      filtres.push(
        `[${k + 1}:v]format=rgba,fade=t=in:st=${p.de.toFixed(3)}:d=${fondu.toFixed(3)}:alpha=1,fade=t=out:st=${(p.a - fondu).toFixed(3)}:d=${fondu.toFixed(3)}:alpha=1[s${k}]`,
        `[b${k}][s${k}]overlay=0:${this.h}:enable='between(t,${p.de.toFixed(3)},${p.a.toFixed(3)})'[b${k + 1}]`,
      )
    }
    const sortie = path.join(FILMS, `${this.nom}.mp4`)
    r = spawnSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-i', nu, ...entrees, '-filter_complex', filtres.join(';'), '-map', `[b${poses.length}]`, '-t', duree.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', sortie],
      { encoding: 'utf8' },
    )
    if (r.status !== 0) throw new Error(`ffmpeg (sous-titres) : ${r.stderr}`)
    rmSync(dossier, { recursive: true, force: true })
    console.log(`→ ${sortie} (${images.length} images, ${duree.toFixed(1)} s)`)
    for (const p of poses) console.log(`  ${p.de.toFixed(1)}–${p.a.toFixed(1)} s · ${p.quand} · ${p.quoi}`)
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
  // Son loup, acheté et grandi jusqu'à l'adulte : la forme qu'elle porte.
  db.prepare(`INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, 'loup', 1000, 2, 1)`).run(id)
  db.close()
  await banc.redemarrer()
  await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'cp:loup-adulte' }, cookie, 'PUT')
  return cookie
}

// Le quiz : cinq questions, dont une que presque personne ne trouve (la troisième).
const QUESTIONS = [
  { texte: 'Quelle planète surnomme-t-on la planète rouge ?', reponses: ['Vénus', 'Mars', 'Jupiter', 'Saturne'], bonne: 1 },
  { texte: 'Combien de cordes compte un violon ?', reponses: ['Trois', 'Quatre', 'Cinq', 'Six'], bonne: 1 },
  { texte: 'Quel est l’animal national de l’Écosse ?', reponses: ['Le cerf', 'L’aigle royal', 'La licorne', 'Le lion'], bonne: 2 },
  { texte: 'Qui a peint « La Nuit étoilée » ?', reponses: ['Claude Monet', 'Vincent van Gogh', 'Paul Cézanne', 'Edgar Degas'], bonne: 1 },
  { texte: 'Dans quel pays se trouve le Machu Picchu ?', reponses: ['Bolivie', 'Chili', 'Pérou', 'Équateur'], bonne: 2 },
]
// Léa : juste, ratée, juste (la rare), juste, juste. Les invités : juste (1) ou non (0), question par question —
// la troisième, une seule (Inès) ; personne d'autre n'en a quatre : Léa gagne seule.
const LEA = [true, false, true, true, true]
const AMIS: [string, string, number[]][] = [
  ['Tom', '🐼', [1, 1, 0, 0, 1]],
  ['Julie', '🦊', [1, 0, 0, 1, 1]],
  ['Karim', '🐙', [1, 1, 0, 1, 0]],
  ['Inès', '🦄', [1, 1, 1, 0, 0]],
  ['Hugo', '🦁', [0, 0, 0, 1, 0]],
  ['Chloé', '🐨', [1, 1, 0, 1, 0]],
]

async function quizEntier() {
  const url = banc.url
  const cookie = await connexionAnimateur(url)
  const packId = await creerQuiz(url, cookie, QUESTIONS.map(q => qcm(q.texte, q.reponses, q.bonne, 30)), 'Culture générale')
  const cookieLea = await lea('lea')
  const host = await ecranCommun(url, cookie)
  const invites: Invite[] = []
  for (const [i, [nom, avatar, plan]] of AMIS.entries()) {
    const inv = await invite(url, nom, avatar)
    invites.push(inv)
    inv.socket.on('session:view', ({ sessionId, view }: any) => {
      if (view.phase !== 'question' || view.myAnswer != null || view.answered) return
      const q = QUESTIONS[view.qIndex]
      if (!q || !view.answers) return
      const bonne = q.reponses[q.bonne]
      const choix = plan[view.qIndex] ? view.answers.indexOf(bonne) : view.answers.findIndex((a: string) => a !== bonne)
      setTimeout(() => (inv.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: choix, qIndex: view.qIndex, round: view.round } }, () => {}), 5200 + i * 300)
    })
  }
  const moi = await invite(url, 'Léa', '🐸', { cookie: cookieLea })
  moi.socket.close()
  const [nomJoueur, valeurJoueur] = cookieLea.split('=')
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await ctx.addCookies([{ name: nomJoueur, value: valeurJoueur, url }])
  for (const f of ['niche.js', 'medaillon.js']) await ctx.addInitScript({ path: path.join(ici, f) })
  await ctx.route('**/mq-humeurs/**', (route: any) =>
    route.fulfill({
      path: path.join(ici, new URL(route.request().url()).pathname.includes('/perso/') ? 'humeurs-perso' : 'humeurs', decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!)),
      contentType: 'image/webp',
    }),
  )
  await ctx.addInitScript(([cle, me]: string[]) => localStorage.setItem(cle, me), [`quizz.me.${ADMIN.slug}`, JSON.stringify({ playerId: moi.playerId, token: moi.token })])
  const tel = await ctx.newPage()
  tel.on('pageerror', (e: Error) => console.error('[téléphone]', e.message))
  await tel.goto(`${url}/${ADMIN.slug}`)
  await tel.waitForSelector('.me-header svg.cp image')
  await patienter(1500)
  const svg: string = await js(tel, `document.querySelector('.me-header svg.cp').outerHTML`)

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

  // Le médaillon suit d'un écran à l'autre : posé à la première question, la page lui laisse son coin.
  const MEDAILLON = {
    svg,
    humeurs: { ravi: '/mq-humeurs/perso/loup-adulte-ravi.webp', depite: '/mq-humeurs/perso/loup-adulte-depite.webp', triomphe: '/mq-humeurs/perso/loup-adulte-triomphe.webp' },
    grandes: { ravi: '/mq-humeurs/loup-adulte-ravi.webp', triomphe: '/mq-humeurs/loup-adulte-triomphe.webp' },
    part: 52,
  }
  const niche = async (ecran: string, etiquette?: string) => {
    await js(tel, `document.querySelector('.md') || __medaillon.poser(${JSON.stringify(MEDAILLON)}); __niche.reposer(${JSON.stringify(ecran)})`)
    if (etiquette) await js(tel, `document.querySelector('.nc-bloc .label').textContent = ${JSON.stringify(etiquette)}`)
  }
  let n = 0
  const controle = async (nom: string) => {
    if (QUOI === 'essai') await tel.screenshot({ path: path.join(ESSAI, `${String(n++).padStart(2, '0')}-${nom}.png`) })
  }

  const film = new Film(tel, 'medaillon', 780, 1688)
  if (QUOI === 'film') await film.debut()
  film.marquer('La soirée', 'Nox est son avatar : là, dans sa ligne.')
  await patienter(1900)
  await controle('attente')

  // Le lancement ne se filme pas : de la salle d'attente à la première question.
  let coupe = film.maintenant()
  await lancerQuiz(host, packId)
  const PARTS = [56, 60, 64, 68, 72]
  for (let q = 0; q < QUESTIONS.length; q++) {
    await phase('question', q)
    await tel.waitForSelector('.ans-btn')
    await patienter(450)
    await niche('soiree-question')
    await js(tel, `__medaillon.humeur('neutre')`)
    await patienter(150)
    film.couper(coupe, film.maintenant())
    if (q === 0) film.marquer('Question 1', 'Son médaillon la suit en haut à droite, immobile.')
    else if (q === 1) film.marquer('Question 2', 'Calme, puis le souffle retenu.')
    else if (q === 2) film.marquer('Question 3', 'Une question difficile.')
    else if (q === 3) film.marquer('Question 4', 'Une bonne réponse ordinaire…')
    else film.marquer('Question 5', 'Pas de quoi sortir de son médaillon.')
    await patienter(q === 0 ? 2000 : q < 3 ? 1300 : 1000)
    await controle(`q${q + 1}-question`)

    // Le doigt touche une réponse : il retient son souffle.
    if (q === 0) film.marquer('Question 1', 'Tu touches une réponse : il retient son souffle.')
    const q0 = QUESTIONS[q]
    const viser = LEA[q] ? q0.reponses[q0.bonne] : q0.reponses.find((_, k) => k !== q0.bonne && k !== 0) ?? q0.reponses[0]
    const bouton = tel.locator('.ans-btn', { hasText: viser }).first()
    const r = await bouton.boundingBox()
    if (r) await js(tel, `__medaillon.doigt(${r.x + r.width / 2}, ${r.y + r.height / 2})`)
    await patienter(160)
    await bouton.click({ timeout: 4000 }).catch(() => {})
    await tel.mouse.move(2, 2)
    await js(tel, '__medaillon.retenir()')
    await patienter(q === 0 ? 1700 : 1200)
    await controle(`q${q + 1}-souffle`)

    // Les autres répondent : l'attente ne se filme pas.
    coupe = film.maintenant()
    const revele = phase('reveal', q)
    const relance = setTimeout(() => vue?.view.phase === 'question' && vue.view.qIndex === q && suivant(), 6000)
    await revele
    clearTimeout(relance)
    await tel.waitForSelector('.result-banner')
    await patienter(200)
    await niche('soiree-revelation', `Question ${q + 1} / ${QUESTIONS.length}`)
    film.couper(coupe, film.maintenant())
    if (q === 0) film.marquer('Question 1 · bonne réponse', 'Il grandit le temps de sa joie, son anneau se remplit.')
    else if (q === 1) film.marquer('Question 2 · ratée', 'Dépité avec toi : il pleut sur sa lune.')
    else if (q === 2) film.marquer('Question 3 · peu l’ont trouvée', 'Nourri, et une bulle de cœurs en plus.')
    else if (q === 3) film.marquer('Question 4 · bonne réponse', '…la même petite fête, sans plus.')
    else film.marquer('Question 5 · bonne réponse', 'Il reste chez lui : ce n’est pas encore le moment.')
    await patienter(220)
    await js(tel, `__medaillon.relacher(); __medaillon.grandir()`)
    await patienter(320)
    if (!LEA[q]) await js(tel, `__medaillon.humeur('depite', { geste: 'abat' })`)
    else if (q === 2)
      await js(tel, `(async () => { await __medaillon.nourrir({ de: '.result-banner .big', part: ${PARTS[q]}, vue: 2200 }); __medaillon.bulle('ravi', 1700) })()`)
    else await js(tel, `__medaillon.nourrir({ de: '.result-banner .big', part: ${PARTS[q]} })`)
    await patienter(q === 2 ? 1900 : q === 1 ? 2700 : 2300)
    await controle(`q${q + 1}-revelation`)

    // La question suivante, ou le podium : la transition ne se filme pas.
    coupe = film.maintenant()
    suivant()
  }

  await phase('finished')
  await tel.waitForSelector('.fin-quiz-ligne')
  await patienter(300)
  await niche('soiree-podium')
  film.couper(coupe, film.maintenant())
  film.marquer('Le podium · 1re place', 'L’expérience d’abord…')
  await patienter(2800)
  film.marquer('Le podium · 1re place', '…puis le grand moment : il sort, et laisse sa lune.')
  await patienter(300)
  await controle('podium')
  // Il se pose sous le classement, dans le bas de l'écran — là où le pouce l'atteint.
  const pieds = await js(tel, `(() => { const r = [...document.querySelectorAll('.fin-quiz .card, .fin-quiz section')].reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0); return Math.min(innerHeight - 16, Math.max(r + 150, innerHeight - 40)) })()`)
  await js(tel, `__medaillon.dehors({ x: 195, y: ${pieds}, h: 132, humeur: 'triomphe' })`)
  await patienter(1500)
  await controle('dehors')
  film.marquer('Le podium', 'Dehors, il est près du pouce : une caresse.')
  await patienter(500)
  const bete = await js(tel, `(() => { const r = document.querySelector('.md-dehors').getBoundingClientRect(); return { x: r.left + r.width * 0.55, y: r.top + r.height * 0.55 } })()`)
  await js(tel, `__medaillon.doigt(${bete.x}, ${bete.y})`)
  await patienter(180)
  await js(tel, '__medaillon.caresserDehors()')
  await patienter(1900)
  await controle('caresse')
  film.marquer('Fin du quiz', 'Il rentre dans son médaillon.')
  await patienter(300)
  await js(tel, '__medaillon.rentrer()')
  await patienter(1900)
  await controle('rentre')
  if (QUOI === 'film') await film.fin()
  for (const inv of invites) inv.socket.close()
  host.close()
  await ctx.close()
}

try {
  await quizEntier()
} finally {
  await navigateur.close()
  await banc.close()
}
process.exit(0)
