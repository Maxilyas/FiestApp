// La niche du compagnon, photographiée sur chaque page du téléphone où elle
// vit (`client/src/components/Niche.tsx`) : l'accueil, le profil, la loge,
// la collection, la boutique et ses compagnons, le quiz du jour — sa page, une
// question, une révélation —, la campagne et ses onglets, les duels,
// l'expédition, le salon, et une soirée — la salle d'attente, une question,
// la révélation, le podium. Puis sa fiche, une caresse, et le repli quand la
// page défile. À chaque page, ce qui passe sous la niche se dit : un texte,
// un bouton, une image que la page ne lui a pas laissé (« sous la niche »).
// Léa, niveau 14, son loup adulte dans sa niche. Le client construit d'abord
// (`npm run build -w client`).
//
//   npx tsx scripts/rendu-niche.ts [dossier]        (ECRAN=390x844, THEME=ivoire)
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  inscrireProfil,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Invite,
} from '../test/banc'
import { VERSION_BAREME } from '../src/auth/profiles'
import { xpDuNiveau } from '../../shared/profil'

const sortie = path.resolve(process.argv[2] ?? 'rendu-niche')
mkdirSync(sortie, { recursive: true })
const [largeur, hauteur] = (process.env.ECRAN ?? '360x640').split('x').map(Number)
const theme = process.env.THEME ?? null

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

/**
 * Ce qui passe sous la niche, page en haut : chaque ligne de texte (ses
 * boîtes de ligne, pas son bloc entier), chaque bouton, lien, champ ou image
 * dont la boîte la touche. En texte : `tsx` glisserait des `__name` dans une
 * fonction passée à la page.
 */
const SOUS_LA_NICHE = `(() => {
  const niche = document.querySelector('.niche')
  if (!niche) return ['(pas de niche)']
  // Repliée et effacée — la page a défilé sous une tête collée — : rien ne passe dessous.
  if (Number(getComputedStyle(niche).opacity) === 0) return []
  const n = niche.getBoundingClientRect()
  const touche = r => r.width > 0 && r.height > 0 && r.right > n.left + 1 && r.left < n.right - 1 && r.bottom > n.top + 1 && r.top < n.bottom - 1
  const visible = el => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
    }
    return true
  }
  const nom = el => {
    const classe = (el.getAttribute('class') || '').split(/\\s+/).filter(Boolean).slice(0, 2).join('.')
    return el.tagName.toLowerCase() + (classe ? '.' + classe : '')
  }
  const vus = []
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
    const el = t.parentElement
    if (!el || !t.textContent.trim() || el.closest('.niche, .sr-only, script, style') || !visible(el)) continue
    const plage = document.createRange()
    plage.selectNodeContents(t)
    if ([...plage.getClientRects()].some(touche)) vus.push('texte « ' + t.textContent.trim().slice(0, 40) + ' » (' + nom(el) + ')')
  }
  for (const el of document.querySelectorAll('a, button, input, select, textarea, img, svg, [role=button]')) {
    if (el.closest('.niche') || !visible(el)) continue
    if (el.tagName === 'svg' && el.closest('a, button')) continue
    const r = el.getBoundingClientRect()
    // Une grande illustration (le cadran des duels) touche par sa boîte, pas par son dessin.
    if (el.tagName === 'svg' && r.width > 120 && r.height > 120) continue
    if (touche(r)) vus.push(nom(el))
  }
  return [...new Set(vus)]
})()`

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
let rapport: string[] = []

/** Léa, niveau 14, son loup adulte dans sa niche, le Phénix en avatar. */
async function lea(login: string): Promise<string> {
  const cookie = await inscrireProfil(banc.url, login, 'Léa', '🐸')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#rattrapage', '', ?, ?, 1)`).run(
    id,
    xpDuNiveau(14),
    JSON.stringify({ v: VERSION_BAREME }),
  )
  db.prepare('UPDATE profiles SET xp = ?, niche = ? WHERE id = ?').run(xpDuNiveau(14), 'loup', id)
  db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 1000, 2, 1)').run(id, 'loup')
  // De quoi l'avoir payé : une partie du quiz du jour d'avant, ses bonnes réponses en confettis.
  db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-09-20', 1, 10, NULL, 0, 1872, 1, 0)`).run(id)
  db.close()
  await banc.redemarrer()
  if (theme) await ecrire(banc.url, '/api/joueur/moi', { theme }, cookie, 'PUT')
  return cookie
}

async function contexte(cookie: string) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const [nom, valeur] = cookie.split('=')
  await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
  return ctx
}

/** La photo d'une page, en haut, sa niche arrivée — et ce qui passe dessous. */
async function photo(page: any, nom: string, { pleine = false, attente = 600 } = {}) {
  await page.waitForSelector('.niche .niche-bete img', { timeout: 8000 }).catch(() => {})
  await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
  await page.waitForTimeout(attente)
  const fichier = path.join(sortie, `${nom}.png`)
  await page.screenshot({ path: fichier, fullPage: pleine })
  const dessous: string[] = await page.evaluate(SOUS_LA_NICHE)
  const ligne = `${nom} : ${dessous.length === 0 ? 'rien sous la niche' : 'sous la niche — ' + dessous.join(' · ')}`
  rapport.push(ligne)
  console.log(ligne)
}

/** Le tirage du jour : la bonne réponse de chaque question. */
function tirageDuJour() {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  const r = db.prepare('SELECT questions FROM jour_tirages ORDER BY jour DESC LIMIT 1').get() as { questions: string }
  db.close()
  return JSON.parse(r.questions) as { reponses: string[]; bonne: number }[]
}

async function solo() {
  const cookie = await lea('lea')
  const ctx = await contexte(cookie)
  const page = await ctx.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  const aller = async (adresse: string, attendu: string) => {
    await page.goto('about:blank')
    await page.goto(`${banc.url}${adresse}`)
    await page.waitForSelector(attendu, { timeout: 15000 })
    await patienter(900)
  }
  await aller('/', 'button.identite-ligne')
  await photo(page, '01-accueil')
  // Sa fiche, au toucher de la niche, puis une caresse.
  await page.locator('.niche').click()
  await page.waitForSelector('.niche-fiche .niche-fiche-jauge .jauge-fine, .niche-fiche .niche-fiche-jauge .muted:not(:empty)')
  await patienter(700)
  await page.screenshot({ path: path.join(sortie, '02-fiche.png') })
  await page.locator('.niche-fiche .btn-primary').click()
  await patienter(420)
  await page.screenshot({ path: path.join(sortie, '03-fiche-caresse.png') })
  await page.locator('.niche-fiche .carte-fermer').click()

  await aller('/profil', '.profil-boutons .gros-compte')
  await photo(page, '04-profil')
  await aller('/profil#avatar', '.loge-panneau .loge-page-avatars')
  await photo(page, '05-loge')
  // La carte de la loge, collée en haut quand la page défile : la niche repliée à son coin.
  await page.mouse.wheel(0, 360)
  await patienter(700)
  await page.screenshot({ path: path.join(sortie, '05b-loge-defilee.png') })
  await aller('/profil#collection', '.collection')
  await photo(page, '06-collection')
  await aller('/profil#soirees', '.player-shell')
  await photo(page, '07-soirees')
  await aller('/profil#carriere', '.player-shell')
  await photo(page, '08-carriere')
  await aller('/boutique', '.boutique-tete')
  await photo(page, '09-boutique')
  await aller('/boutique#compagnons', '.vitrine-compagnons')
  await photo(page, '10-boutique-compagnons')
  // Le repli : la page défile, la niche se fait petite au coin.
  await page.mouse.wheel(0, 420)
  await patienter(700)
  await page.screenshot({ path: path.join(sortie, '11-repli.png') })

  await aller('/jour', '.jour-heros')
  await photo(page, '12-jour')
  await page.locator('.jour-heros .btn-primary').click()
  await page.waitForSelector('.ans-btn')
  await photo(page, '13-jour-question')
  const tirage = tirageDuJour()
  const textes: string[] = await page.locator('.ans-btn').allTextContents()
  const bonne = Math.max(0, textes.findIndex(t => t.includes(tirage[0].reponses[tirage[0].bonne])))
  for (let essai = 0; essai < 24 && !(await page.locator('.result-banner').count()); essai++) {
    await page.locator('.ans-btn').nth(bonne).click({ timeout: 1500 }).catch(() => {})
    await patienter(350)
  }
  await page.waitForSelector('.result-banner')
  await photo(page, '14-jour-revelation', { attente: 1200 })

  await aller('/campagne', '.campagne')
  await photo(page, '15-campagne', { attente: 1200 })
  // Une série : sa première question, sous la niche.
  await page.locator('.campagne .btn-primary.btn-big').first().click()
  await page.waitForSelector('.ans-btn', { timeout: 15000 })
  await photo(page, '15b-serie-question', { attente: 900 })
  await aller('/campagne#sentiers', '.campagne')
  await photo(page, '16-sentiers', { attente: 1500 })
  // Un sentier : il descend de lui-même jusqu'au palier à jouer, sa tête collée en haut — la niche repliée s'efface ; revenu en haut, elle reparaît.
  await aller('/campagne#sentier-foret', '.sentier-tete')
  await patienter(1200)
  await page.screenshot({ path: path.join(sortie, '16b-sentier-defile.png') })
  await page.evaluate('window.scrollTo(0, 0)')
  await photo(page, '16c-sentier-en-haut', { attente: 700 })
  await aller('/campagne#defi', '.campagne')
  await photo(page, '17-defi', { attente: 1200 })
  await aller('/campagne#carnet', '.campagne')
  await photo(page, '18-carnet', { attente: 1200 })
  await aller('/duels', '.duels')
  await photo(page, '19-duels', { attente: 1500 })
  await aller('/expedition', '.expedition')
  await photo(page, '20-expedition', { attente: 1200 })
  await aller('/salon', '.player-shell')
  await photo(page, '21-salon', { attente: 1500 })
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
    ],
    'Culture générale',
  )
  const cookieLea = await lea('lea2')
  const host = await ecranCommun(url, cookie)
  const amis: Invite[] = []
  for (const [nom, avatar] of [
    ['Tom', '🐼'],
    ['Julie', '🦊'],
    ['Karim', '🐙'],
  ] as const)
    amis.push(await invite(url, nom, avatar))
  amis.forEach((inv, i) =>
    inv.socket.on('session:view', ({ sessionId, view }: any) => {
      if (view.phase !== 'question' || view.myAnswer != null || view.answered) return
      setTimeout(() => (inv.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: (view.qIndex + i) % 4 } }, () => {}), 2600 + i * 250)
    }),
  )
  const moi = await invite(url, 'Léa', '🐸', { cookie: cookieLea })
  moi.socket.close()
  const ctx = await contexte(cookieLea)
  await ctx.addInitScript(([cle, me]: string[]) => localStorage.setItem(cle, me), [`quizz.me.${ADMIN.slug}`, JSON.stringify({ playerId: moi.playerId, token: moi.token })])
  const telephone = await ctx.newPage()
  telephone.on('pageerror', (e: Error) => console.error('[téléphone]', e.message))
  await telephone.goto(`${url}/${ADMIN.slug}`)
  await telephone.waitForSelector('.me-header')
  await patienter(1200)
  await photo(telephone, '22-soiree-attente')

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
  const LEA = [/Mars/, /Quatre/]
  for (let q = 0; q < 2; q++) {
    await phase('question', q)
    await telephone.waitForSelector('.ans-btn')
    if (q === 0) await photo(telephone, '23-soiree-question')
    await telephone.getByRole('button', { name: LEA[q] }).first().click({ timeout: 4000 }).catch(() => {})
    await patienter(2400)
    if (vue?.view.phase === 'question' && vue.view.qIndex === q) suivant()
    await phase('reveal', q)
    await telephone.waitForSelector('.result-banner')
    if (q === 0) await photo(telephone, '24-soiree-revelation', { attente: 1200 })
    if (vue?.view.phase === 'reveal' && vue.view.qIndex === q) suivant()
  }
  await phase('finished')
  await telephone.waitForSelector('.fin-quiz-ligne')
  await photo(telephone, '25-soiree-podium', { attente: 5000 })
  host.close()
  await ctx.close()
}

try {
  await solo()
  await soiree()
} finally {
  await navigateur.close()
  await banc.close()
}
console.log(`\n${rapport.filter(l => !l.endsWith('rien sous la niche')).length} page(s) où quelque chose passe sous la niche, sur ${rapport.length}.`)
process.exit(0)
