// La tablée : une soirée jouée par des agents, pour recueillir leurs retours.
//
//   npm run tablee [-- options]                    démarre la régie (Ctrl+C l'arrête)
//   node server/scripts/tablee/pilote.mjs aide     ce que les agents peuvent faire
//
// Les tests disent si le code fait ce qu'on a voulu. Ils ne disent pas si la
// grand-mère trouve « Jouer sans compte », si l'animatrice comprend l'éditeur
// du premier coup, ni ce que devient l'écran d'un téléphone quand le clavier
// s'ouvre. La tablée fait jouer une soirée entière à des agents qui incarnent
// des invités et un animateur, chacun sur son appareil, puis leur demande ce
// qui les a gênés — la marche à suivre est dans .claude/skills/tablee/.
//
// La régie démarre un vrai serveur sur des bases jetables, un Chromium, et une
// porte locale que les agents poussent avec `pilote.mjs`, un geste à la fois
// (voir, toucher, écrire, répondre…). Tout se consigne dans un dossier daté
// d'`export/tablee/` : le journal des gestes, les captures, ce que les
// navigateurs ont signalé, les deux bases — et les retours des agents.
//
// Playwright n'est pas une dépendance du dépôt : on le prend là où il est
// installé — dans le dépôt s'il y est, sinon parmi les modules globaux
// (`npm install -g playwright`), comme sur les sessions Claude Code en ligne.
//
// Options :
//   --dossier <chemin>     où ranger la tablée (défaut : export/tablee/<date-heure>)
//   --port <n>             le port du serveur de jeu (défaut : un port libre)
//   --animateur <Prénom>   le compte que l'administrateur crée pour un ami, à
//                          activer par son lien (défaut : Nadia) ; --espace <nom>
//                          son adresse (défaut : chez-<prénom>)
//   --sans-animateur       personne à activer : on anime avec l'administrateur
//   --profil <Prénom/identifiant/avatar>   un profil de joueur déjà inscrit (répétable)
//   --sans-build           garder le client construit, même plus vieux que ses sources
//   --fiche <chemin>       où écrire la fiche que lisent les pilotes (défaut :
//                          export/tablee/courante.json) — pour une seconde
//                          tablée à côté d'une autre : TABLEE=<chemin> la vise
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'node:util'
import { createQuizServer } from '../../src/server'
import { sansAccent } from '../../../shared/homonymes'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../..')

// Playwright est chargé à l'exécution, sans ses types (il n'est pas une
// dépendance du dépôt) : ces noms disent seulement de quoi on parle.
type Navigateur = any
type Contexte = any
type Page = any
type Element = any

// ── Les options ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const option = (nom: string) => {
  const i = argv.indexOf(`--${nom}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const optionsRepetees = (nom: string) => argv.flatMap((a, i) => (a === `--${nom}` && argv[i + 1] ? [argv[i + 1]] : []))
const drapeau = (nom: string) => argv.includes(`--${nom}`)
/** Un chemin donné en relatif se lit depuis là où l'on a tapé la commande, que npm garde dans INIT_CWD. */
const depuisIci = (chemin: string) => path.resolve(process.env.INIT_CWD ?? process.cwd(), chemin)

/** Le fichier qui dit aux pilotes où frapper : la dernière régie démarrée, sauf `--fiche`. */
const COURANTE = depuisIci(option('fiche') ?? path.join(RACINE, 'export', 'tablee', 'courante.json'))

function arreter(message: string): never {
  console.error(`❌ ${message}`)
  process.exit(1)
}

// ── Le client construit ─────────────────────────────────────────────────────
//
// Le serveur sert `client/dist` : une tablée jouée sur un client d'hier
// recueillerait des retours sur des écrans qui n'existent plus. On le
// reconstruit dès qu'une source est plus récente que lui.

function plusRecent(chemin: string): number {
  if (!existsSync(chemin)) return 0
  const st = statSync(chemin)
  if (!st.isDirectory()) return st.mtimeMs
  return readdirSync(chemin).reduce((max, nom) => Math.max(max, plusRecent(path.join(chemin, nom))), st.mtimeMs)
}

function clientAJour(): boolean {
  const index = path.join(RACINE, 'client', 'dist', 'index.html')
  if (!existsSync(index)) return false
  const sources = ['client/src', 'client/public', 'client/index.html', 'shared'].map(c => plusRecent(path.join(RACINE, c)))
  return statSync(index).mtimeMs >= Math.max(...sources)
}

if (!drapeau('sans-build') && !clientAJour()) {
  console.log('🔨 Le client construit est plus vieux que ses sources : npm run build…')
  const build = spawnSync('npm', ['run', 'build', '-w', 'client'], {
    cwd: RACINE,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (build.status !== 0) arreter('La construction du client a échoué — voir ci-dessus.')
}

// ── Playwright, là où il est ────────────────────────────────────────────────

function chargerPlaywright(): any {
  const bases = [RACINE]
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' })
  if (globale.status === 0 && globale.stdout.trim()) bases.push(globale.stdout.trim())
  for (const base of bases) {
    try {
      return createRequire(path.join(base, 'tablee.js'))('playwright')
    } catch {
      // Pas ici : on tente la suivante.
    }
  }
  return arreter(
    'Playwright est introuvable. Installe-le hors du dépôt, une fois pour toutes : ' +
      '`npm install -g playwright`, puis `npx playwright install chromium`.',
  )
}

const playwright = chargerPlaywright()

// Le filet, comme celui du serveur (index.ts) : un onglet qui se ferme au
// mauvais moment, une promesse que personne n'attend, et Node éteindrait la
// régie — la soirée de tous les agents avec. On le consigne, et on continue.
process.on('unhandledRejection', raison => console.error('[tablee] promesse rejetée sans personne pour l’attendre :', raison))
process.on('uncaughtException', e => console.error('[tablee] exception échappée :', e))

// ── Le dossier de la tablée ─────────────────────────────────────────────────

const deux = (n: number) => String(n).padStart(2, '0')
function horodatage(d = new Date()) {
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}-${deux(d.getHours())}h${deux(d.getMinutes())}`
}

const DOSSIER = depuisIci(option('dossier') ?? path.join(RACINE, 'export', 'tablee', horodatage()))
for (const sous of ['bases', 'captures', 'retours', 'telechargements', 'photos']) {
  mkdirSync(path.join(DOSSIER, sous), { recursive: true })
}
/** Un chemin tel qu'on le montre : depuis la racine du dépôt quand il y est. */
const lisible = (chemin: string) => {
  const r = path.relative(RACINE, chemin)
  return r.startsWith('..') ? chemin : r.split(path.sep).join('/')
}

// Ce que dit le serveur de jeu — ses erreurs surtout — reste dans le dossier :
// un bug vu par un agent se recoupe avec le journal du serveur à la même heure.
const JOURNAL_REGIE = path.join(DOSSIER, 'regie.log')
for (const niveau of ['log', 'warn', 'error'] as const) {
  const original = console[niveau].bind(console)
  console[niveau] = (...args: unknown[]) => {
    original(...args)
    try {
      appendFileSync(JOURNAL_REGIE, `${new Date().toISOString()} ${niveau} ${format(...args)}\n`)
    } catch {
      // Le journal est un confort : il ne doit jamais faire tomber la régie.
    }
  }
}

/** Chaque geste de chaque agent, une ligne JSON : de quoi refaire la chronologie de la soirée. */
const JOURNAL_GESTES = path.join(DOSSIER, 'journal.jsonl')
function consigner(ligne: Record<string, unknown>) {
  try {
    appendFileSync(JOURNAL_GESTES, JSON.stringify({ t: new Date().toISOString(), ...ligne }) + '\n')
  } catch {
    // Idem : un journal qui coince ne coupe pas la soirée.
  }
}

// ── Le serveur de jeu ───────────────────────────────────────────────────────

function portLibre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const sonde = net.createServer()
    sonde.once('error', reject)
    sonde.listen(0, '127.0.0.1', () => {
      const a = sonde.address()
      const port = typeof a === 'object' && a ? a.port : 0
      sonde.close(() => resolve(port))
    })
  })
}

const ADMIN = { login: 'antoine', password: 'tablee-admin', slug: 'demo', name: 'Antoine' }
const MOT_DE_PASSE_PROFIL = 'tablee-profil'

const portJeu = Number(option('port')) || (await portLibre())
const BASE = `http://localhost:${portJeu}`
const serveur = await createQuizServer({
  port: portJeu,
  dbPath: path.join(DOSSIER, 'bases', 'locale.db'),
  quizDbUrl: `file:${path.join(DOSSIER, 'bases', 'permanente.db').replace(/\\/g, '/')}`,
  admin: ADMIN,
  // Le QR de l'écran commun doit mener là où les téléphones de la régie
  // peuvent aller : l'adresse du wifi, sur une machine sans wifi, n'existe pas.
  publicUrl: BASE,
})

/** Une écriture telle que la page la ferait, avec l'en-tête maison qu'exige l'API. */
async function appeler(chemin: string, corps: unknown, cookie?: string) {
  const res = await fetch(BASE + chemin, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', ...(cookie && { Cookie: cookie }) },
    body: JSON.stringify(corps),
  })
  const texte = await res.text()
  let json: any = null
  try {
    json = JSON.parse(texte)
  } catch {
    // Une réponse qui n'est pas du JSON se lit dans l'erreur ci-dessous.
  }
  if (!res.ok) throw new Error(`${chemin} : ${res.status} ${json?.error ?? texte.slice(0, 200)}`)
  return { json, cookie: /qz_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1] }
}

// L'animateur de la tablée arrive comme un ami à qui l'administrateur ouvre
// un compte : un lien d'activation, une bibliothèque vide. C'est le premier
// soir d'un animateur qu'on veut voir, pas celui de qui connaît tout.
interface Animateur {
  prenom: string
  identifiant: string
  espace: string
  activation: string
}
let animateur: Animateur | null = null
if (!drapeau('sans-animateur')) {
  const prenom = option('animateur') ?? 'Nadia'
  const identifiant = sansAccent(prenom).replace(/[^a-z0-9._-]+/g, '') || 'animateur'
  const espace = option('espace') ?? `chez-${identifiant.replace(/[^a-z0-9-]+/g, '')}`
  const admin = await appeler('/api/auth/login', { login: ADMIN.login, password: ADMIN.password })
  const cree = await appeler('/api/admin/accounts', { login: identifiant, name: prenom, slug: espace }, `qz_session=${admin.cookie}`)
  animateur = { prenom, identifiant, espace, activation: `${BASE}/activer#t=${cree.json.activation.token}` }
}

// Les profils déjà inscrits : l'habituée qui revient, l'homonyme qui a déjà
// son compte. Leur code de secours est gardé, pour qui voudrait l'essayer.
interface ProfilPret {
  prenom: string
  identifiant: string
  avatar: string
  secours: string
}
const profils: ProfilPret[] = []
for (const spec of optionsRepetees('profil')) {
  const [prenom, identifiant = sansAccent(prenom), avatar = '🦊'] = spec.split('/')
  const inscrit = await appeler('/api/joueur/inscription', {
    login: identifiant,
    password: MOT_DE_PASSE_PROFIL,
    name: prenom,
    avatar,
  })
  profils.push({ prenom, identifiant, avatar, secours: inscrit.json.recovery })
}

// ── Le navigateur, et des photos pour les quiz ──────────────────────────────

const navigateur: Navigateur = await playwright.chromium.launch({ headless: true })

// Des photos à glisser dans une question, dessinées ici : aucune image
// sous droits dans le dépôt, et de quoi poser une vraie question de mémoire
// (« combien de bougies ? »).
const PHOTOS: Record<string, string> = {
  'gateau.jpg': `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#3b2a4a"/><circle cx="650" cy="110" r="70" fill="#f6d365" opacity=".25"/>
    <ellipse cx="400" cy="520" rx="300" ry="40" fill="#e9e1d3"/>
    <rect x="170" y="330" width="460" height="190" rx="20" fill="#f4a6b8"/>
    <rect x="170" y="330" width="460" height="45" rx="20" fill="#fff4f0"/>
    <path d="M170 360 q 38 40 76 0 t 76 0 t 76 0 t 76 0 t 76 0 t 80 0" fill="none" stroke="#fff4f0" stroke-width="18"/>
    ${[0, 1, 2, 3, 4, 5, 6]
      .map(i => {
        const x = 215 + i * 62
        return `<rect x="${x - 7}" y="250" width="14" height="80" rx="4" fill="${['#7fc8f8', '#ffd166', '#95d5b2', '#cdb4db'][i % 4]}"/>
      <path d="M${x} 212 q 14 22 0 36 q -14 -14 0 -36z" fill="#ffb703"/>`
      })
      .join('')}
  </svg>`,
  'ballons.jpg': `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#bde0fe"/>
    ${[
      [150, 230, '#e63946'],
      [280, 170, '#457b9d'],
      [400, 250, '#ffd166'],
      [520, 160, '#2a9d8f'],
      [650, 240, '#9d4edd'],
    ]
      .map(
        ([x, y, c]) => `<path d="M${x} ${Number(y) + 95} Q ${Number(x) + 20} ${Number(y) + 190} ${x} 590" fill="none" stroke="#555" stroke-width="2"/>
      <ellipse cx="${x}" cy="${y}" rx="62" ry="80" fill="${c}"/><ellipse cx="${Number(x) - 22}" cy="${Number(y) - 30}" rx="12" ry="20" fill="#fff" opacity=".45"/>`,
      )
      .join('')}
  </svg>`,
  'plage.jpg': `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="330" fill="#8ecae6"/><circle cx="620" cy="110" r="60" fill="#ffb703"/>
    <rect y="300" width="800" height="150" fill="#219ebc"/><rect y="440" width="800" height="160" fill="#f4d35e"/>
    <path d="M300 300 l 60 -130 l 0 130 z" fill="#d62828"/><path d="M260 300 h 140 l -25 30 h -90 z" fill="#6d4c41"/>
    ${[
      [120, 120],
      [190, 90],
      [250, 140],
    ]
      .map(([x, y]) => `<path d="M${x} ${y} q 15 -15 30 0 q 15 -15 30 0" fill="none" stroke="#333" stroke-width="4"/>`)
      .join('')}
  </svg>`,
}
{
  const atelier = await navigateur.newPage({ viewport: { width: 800, height: 600 } })
  for (const [nom, svg] of Object.entries(PHOTOS)) {
    await atelier.setContent(`<body style="margin:0">${svg}</body>`)
    await atelier.screenshot({ path: path.join(DOSSIER, 'photos', nom), type: 'jpeg', quality: 85 })
  }
  await atelier.close()
}

// ── Les appareils ───────────────────────────────────────────────────────────

const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  ancien: 'Mozilla/5.0 (Linux; Android 10; SM-A105FN) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  tablette: 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
}

interface Appareil {
  icone: string
  description: string
  /** Un doigt, un clavier qui s'ouvre et qui cache le bas de l'écran. */
  tactile: boolean
  options: Record<string, unknown>
}

const telephone = (width: number, height: number, deviceScaleFactor: number, userAgent: string) => ({
  viewport: { width, height },
  deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
  userAgent,
})

const APPAREILS: Record<string, Appareil> = {
  telephone: { icone: '📱', description: 'téléphone Android, 412 × 915', tactile: true, options: telephone(412, 915, 2.625, UA.android) },
  // La taille de référence de CLAUDE.md : « sans défiler en 360 × 640 ».
  'petit-telephone': {
    icone: '📱',
    description: 'petit téléphone Android ancien, 360 × 640',
    tactile: true,
    options: telephone(360, 640, 2, UA.ancien),
  },
  iphone: { icone: '📱', description: 'iPhone, 390 × 844', tactile: true, options: telephone(390, 844, 3, UA.iphone) },
  tablette: { icone: '📱', description: 'tablette, 800 × 1280', tactile: true, options: telephone(800, 1280, 2, UA.tablette) },
  portable: {
    icone: '💻',
    description: 'ordinateur portable, 1366 × 768',
    tactile: false,
    options: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  },
  tele: {
    icone: '📺',
    description: 'télévision, 1920 × 1080',
    tactile: false,
    options: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  },
}

// ── Ce qu'on glisse dans les pages ──────────────────────────────────────────
//
// Des chaînes et non des fonctions : `tsx` renomme les fonctions qu'il
// compile (`__name`), et une fonction envoyée au navigateur y arriverait avec
// un appel qui n'y existe pas.

/**
 * Le clavier du téléphone. Il ne s'ouvre qu'au toucher d'un champ — un
 * `autoFocus` ne l'ouvre pas sur un vrai téléphone — et cache alors le bas de
 * l'écran : le bouton qu'on ne voit plus, c'est précisément ce que la tablée
 * doit montrer (CLAUDE.md : « le clavier pousserait le bouton hors de
 * l'écran »). Comme un vrai navigateur, on remonte le champ au-dessus.
 */
const CLAVIER = `(() => {
  if (window.__tablee) return
  window.__tablee = { clavier: false }
  const SAISIE = /^(text|search|email|password|tel|url|number)$/
  const estSaisie = el => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && SAISIE.test(el.type || 'text')) || el.isContentEditable)
  let touche = null, clavier = null, cale = null
  const cacher = () => { if (clavier) clavier.remove(); if (cale) cale.remove(); clavier = cale = null; window.__tablee.clavier = false }
  const montrer = champ => {
    if (!clavier) {
      clavier = document.createElement('div')
      clavier.setAttribute('aria-hidden', 'true')
      clavier.dataset.tablee = 'clavier'
      clavier.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:40vh;z-index:2147483647;background:#3c3f44;color:#c9ccd1;display:flex;align-items:center;justify-content:center;font:500 15px/1.2 system-ui,sans-serif;border-top:1px solid #55585e'
      clavier.textContent = '⌨ clavier du téléphone'
      cale = document.createElement('div')
      cale.setAttribute('aria-hidden', 'true')
      cale.style.cssText = 'height:40vh'
      document.documentElement.appendChild(cale)
      document.documentElement.appendChild(clavier)
    }
    window.__tablee.clavier = true
    const bas = champ.getBoundingClientRect().bottom
    const visible = window.innerHeight * 0.6
    if (bas > visible - 8) window.scrollBy(0, bas - visible + 16)
  }
  document.addEventListener('pointerdown', e => {
    const el = e.target && e.target.closest ? e.target.closest('input,textarea,[contenteditable]') : null
    touche = estSaisie(el) ? el : null
  }, true)
  document.addEventListener('focusin', e => { if (estSaisie(e.target) && e.target === touche) montrer(e.target) }, true)
  document.addEventListener('focusout', () => setTimeout(() => { if (!estSaisie(document.activeElement)) cacher() }, 0), true)
})()`

/** « Taille du texte » agrandie, comme la règlent beaucoup de téléphones de grands-parents. */
const zoomScript = (pourcent: number) => `(() => {
  const poser = () => { document.documentElement.style.zoom = '${pourcent}%' }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser); else poser()
})()`

/** Assez pour savoir si la page bouge encore : sa taille, son adresse, et si elle charge. */
const EMPREINTE = `(() => {
  const t = document.body ? document.body.innerText.trim() : ''
  const charge = t === '' || /^(Chargement…|Connexion…)$/.test(t)
  return (charge ? 'charge:' : '') + t.length + ':' + document.getElementsByTagName('*').length + ':' + location.pathname
})()`

/** Le texte visible de la page, sans les lignes vides en série. */
const TEXTE = `(() => (document.body ? document.body.innerText : '').split('\\n').map(l => l.trim()).filter((l, i, a) => l || (a[i - 1] || '').trim()).join('\\n').trim())()`

/**
 * Où en est le téléphone d'un invité, lu dans ce qu'il affiche : le raccourci
 * `question` s'en sert pour attendre la suivante sans que l'agent ait à
 * relire l'écran toutes les secondes — un agent met plusieurs secondes à
 * réagir, le chronomètre ne l'attend pas.
 */
const LIRE_TELEPHONE = `(() => {
  const txt = el => (el && el.textContent ? el.textContent : '').replace(/\\s+/g, ' ').trim()
  // Un bandeau de plusieurs lignes se lit ligne à ligne : « Trop tard ! · La bonne réponse : … ».
  const lignes = el => (el && el.innerText ? el.innerText : '').split('\\n').map(l => l.trim()).filter(Boolean).join(' · ')
  if (document.querySelector('.fin-tete')) return { etat: 'fin' }
  const joueur = document.querySelector('.quiz-player')
  const minuteur = document.querySelector('.quiz-player [role=timer]')
  const m = minuteur ? /(\\d+)/.exec(minuteur.getAttribute('aria-label') || '') : null
  const reste = m ? Number(m[1]) : null
  if (joueur) {
    const label = txt(joueur.querySelector('.quiz-topbar .label'))
    const categorie = txt(joueur.querySelector('.quiz-categorie'))
    const question = txt(joueur.querySelector('.quiz-question'))
    const image = !!joueur.querySelector('.quiz-img')
    const photoPartie = !!joueur.querySelector('.photo-gone')
    const pause = /En pause/.test(txt(joueur))
    if (joueur.classList.contains('observe')) return { etat: 'memoriser', label, reste }
    const boutons = [...joueur.querySelectorAll('.ans-btn')]
    if (question && boutons.length) {
      return { etat: 'qcm', label, categorie, question, reste, image, photoPartie, pause,
        reponses: boutons.map(b => txt(b.querySelector('.ans-text'))),
        ouvert: boutons.some(b => !b.disabled),
        choisi: boutons.findIndex(b => b.getAttribute('aria-pressed') === 'true') + 1 }
    }
    const champ = joueur.querySelector('.guess-form input')
    if (question && champ) {
      return { etat: 'estimation', label, categorie, question, reste, image, photoPartie, pause,
        unite: txt(joueur.querySelector('.guess-unit')), ouvert: !champ.disabled,
        deja: txt(joueur.querySelector('.guess-form .hint')) }
    }
    if (joueur.querySelector('.podium')) return { etat: 'podium', resume: lignes(joueur) }
    if (joueur.querySelector('.result-banner')) return { etat: 'revelation', resume: lignes(joueur.querySelector('.result-banner')) }
  }
  if (document.querySelector('.getready')) return { etat: 'prepare', resume: txt(document.querySelector('.getready')) }
  if (document.querySelector('.player-shell')) return { etat: 'attente' }
  return { etat: 'ailleurs' }
})()`

const VISION: Record<string, string> = {
  normale: 'none',
  deuteranopie: 'deuteranopia',
  protanopie: 'protanopia',
  tritanopie: 'tritanopia',
  achromatopsie: 'achromatopsia',
  flou: 'blurredVision',
  contraste: 'reducedContrast',
}

// ── Les participants ────────────────────────────────────────────────────────

interface Onglet {
  nom: string
  page: Page
  /** Ce que le navigateur a signalé depuis le dernier geste `console`. */
  signalements: string[]
  /** Parmi eux, les erreurs de la page elle-même — celles qu'on annonce d'office. */
  erreursNonLues: number
}

interface Participant {
  qui: string
  appareil: string
  contexte: Contexte
  onglets: Map<string, Onglet>
  prochainOnglet: number
  /** Ce qui est arrivé hors de ses gestes — un onglet ouvert, un fichier — à lui dire au suivant. */
  nouvelles: string[]
  /** Jusqu'où il a entendu la salle. */
  entendu: number
  captures: number
  gestes: number
  /** La dernière question que `question` lui a lue, quand elle est apparue, et s'il y a répondu. */
  question: { cle: string; vueA: number; repondu: boolean } | null
  /** La photo à mémoriser qu'on lui a déjà signalée : `question` ne la lui annonce qu'une fois. */
  memoriser: string | null
  /** La question dont on lui a déjà lu la révélation. */
  revelation: string | null
  podiumAnnonce: boolean
  vision: string
  mouvementReduit: boolean
  horsLigne: boolean
  zoom: number
}

const participants = new Map<string, Participant>()
/** Les pages que la régie a ouvertes elle-même — les autres sont des onglets nés d'un lien. */
const pagesConnues = new WeakSet<object>()

/** Ce qui se dit à voix haute dans la salle : chacun l'entend à son geste suivant. */
interface Parole {
  t: number
  qui: string
  texte: string
}
const salle: Parole[] = []

/** Un refus qu'on explique à l'agent : pas une panne de la régie. */
class Refus extends Error {}

const pause = (ms: number) => new Promise(r => setTimeout(r, ms))
const chemin = (url: string) => {
  try {
    const u = new URL(url)
    return u.origin === BASE ? `${u.pathname}${u.search}${u.hash}` || '/' : url
  } catch {
    return url
  }
}
const secondes = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`

async function allumer(qui: string, appareil: string): Promise<Participant> {
  const a = APPAREILS[appareil]
  if (!a) throw new Refus(`Appareil inconnu : « ${appareil} ». Au choix : ${Object.keys(APPAREILS).join(', ')}.`)
  const contexte: Contexte = await navigateur.newContext({
    ...a.options,
    baseURL: BASE,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  contexte.setDefaultTimeout(5000)
  contexte.setDefaultNavigationTimeout(20000)
  if (a.tactile) await contexte.addInitScript({ content: CLAVIER })
  const p: Participant = {
    qui,
    appareil,
    contexte,
    onglets: new Map(),
    prochainOnglet: 2,
    nouvelles: [],
    entendu: salle.length,
    captures: 0,
    gestes: 0,
    question: null,
    memoriser: null,
    revelation: null,
    podiumAnnonce: false,
    vision: 'none',
    mouvementReduit: false,
    horsLigne: false,
    zoom: 100,
  }
  // Un lien `target="_blank"` ouvre un onglet : on le branche, on le nomme,
  // et on le dit à l'agent — l'écran commun ouvre ainsi « Mes quiz », le
  // souvenir, le bilan.
  contexte.on('page', (page: Page) => {
    setTimeout(() => {
      if (pagesConnues.has(page)) return
      const nom = `onglet${p.prochainOnglet++}`
      brancher(p, page, nom)
      p.nouvelles.push(`🆕 Un nouvel onglet s'est ouvert : ${qui}:${nom} (${chemin(page.url())}) — vise-le avec « ${qui}:${nom} ».`)
    }, 50)
  })
  participants.set(qui, p)
  return p
}

function brancher(p: Participant, page: Page, nom: string): Onglet {
  pagesConnues.add(page)
  const o: Onglet = { nom, page, signalements: [], erreursNonLues: 0 }
  const signaler = (texte: string, erreur: boolean) => {
    o.signalements.push(`${new Date().toLocaleTimeString('fr-FR')} ${texte}`)
    if (o.signalements.length > 200) o.signalements.shift()
    if (erreur) o.erreursNonLues++
  }
  page.on('console', (m: any) => {
    const type = m.type()
    // « Failed to load resource » double la réponse HTTP, déjà notée plus bas.
    if ((type === 'error' || type === 'warning') && !m.text().startsWith('Failed to load resource')) {
      signaler(`[console ${type}] ${m.text()}`, type === 'error')
    }
  })
  page.on('pageerror', (e: Error) => signaler(`[exception] ${e.message}`, true))
  page.on('requestfailed', (r: any) => {
    // Le temps réel se coupe à chaque veille ou coupure : ce n'est pas un bug.
    if (r.url().includes('/socket.io/')) return
    signaler(`[requête échouée] ${r.method()} ${chemin(r.url())} — ${r.failure()?.errorText ?? '?'}`, false)
  })
  page.on('response', (r: any) => {
    if (r.status() >= 400) signaler(`[HTTP ${r.status()}] ${r.request().method()} ${chemin(r.url())}`, false)
  })
  page.on('dialog', (d: any) => {
    p.nouvelles.push(`💬 Le navigateur a affiché une boîte « ${d.message()} » (acceptée d'office).`)
    d.accept().catch(() => {})
  })
  page.on('download', async (d: any) => {
    const fichier = path.join(DOSSIER, 'telechargements', `${p.qui}-${d.suggestedFilename()}`)
    await d.saveAs(fichier).catch(() => {})
    p.nouvelles.push(`📥 Fichier téléchargé : ${fichier}`)
  })
  page.on('close', () => {
    if (p.onglets.get(nom)?.page === page) p.onglets.delete(nom)
  })
  p.onglets.set(nom, o)
  void reglerPage(p, page)
  return o
}

/** Ce que l'agent a réglé sur son appareil vaut pour chacun de ses onglets. */
async function reglerPage(p: Participant, page: Page) {
  try {
    if (p.vision !== 'none') {
      const cdp = await p.contexte.newCDPSession(page)
      await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: p.vision })
    }
    if (p.mouvementReduit) await page.emulateMedia({ reducedMotion: 'reduce' })
  } catch {
    // Un onglet déjà refermé n'a plus rien à régler.
  }
}

async function onglet(p: Participant, nom: string): Promise<Onglet> {
  const existant = p.onglets.get(nom)
  if (existant) return existant
  const page = await p.contexte.newPage()
  return brancher(p, page, nom)
}

/** Attend que la page ait fini de bouger : un geste rend l'écran d'après, pas celui d'avant. */
async function stabiliser(page: Page, maxMs = 2500) {
  const fin = Date.now() + maxMs
  let avant = ''
  let stable = 0
  while (Date.now() < fin) {
    await pause(120)
    const empreinte: string = await page.evaluate(EMPREINTE).catch(() => 'charge:')
    if (empreinte === avant && !empreinte.startsWith('charge:')) {
      if (++stable >= 2) return
    } else {
      stable = 0
      avant = empreinte
    }
  }
}

/** Ce qu'affiche la page : ses éléments et leurs références, comme les lit un lecteur d'écran. */
async function arbre(page: Page): Promise<string> {
  try {
    const brut = typeof page._snapshotForAI === 'function' ? await page._snapshotForAI() : await page.locator('body').ariaSnapshot()
    return typeof brut === 'string' ? brut : String(brut?.full ?? brut)
  } catch (e) {
    return `(écran illisible : ${(e as Error).message})`
  }
}

async function texteVisible(page: Page): Promise<string> {
  return page.evaluate(TEXTE).catch(() => '(page illisible)')
}

/** La ligne de tête de chaque sortie : qui, où, et ce qui est arrivé depuis le dernier geste. */
async function entete(p: Participant, o: Onglet): Promise<string> {
  const a = APPAREILS[p.appareil]
  const titre = await o.page.title().catch(() => '')
  const etats: string[] = []
  if (a.tactile && (await o.page.evaluate('!!(window.__tablee && window.__tablee.clavier)').catch(() => false))) {
    etats.push('⌨ clavier ouvert — il cache le bas de l’écran')
  }
  if (p.horsLigne) etats.push('📵 hors ligne')
  if (p.zoom !== 100) etats.push(`🔍 texte à ${p.zoom} %`)
  if (p.vision !== 'none') etats.push(`👁 vision ${Object.keys(VISION).find(k => VISION[k] === p.vision)}`)
  const lignes = [
    `${a.icone} ${p.qui}${o.nom === 'principal' ? '' : `:${o.nom}`} · ${chemin(o.page.url())}${titre ? ` · « ${titre} »` : ''}`,
  ]
  if (etats.length) lignes.push(`   ${etats.join(' · ')}`)
  const paroles = salle.slice(p.entendu).filter(m => m.qui !== p.qui)
  p.entendu = salle.length
  for (const m of paroles) lignes.push(`🗣 ${m.qui} dit : « ${m.texte} »`)
  lignes.push(...p.nouvelles.splice(0))
  if (o.erreursNonLues > 0) {
    lignes.push(`⚠ Le navigateur a signalé ${o.erreursNonLues} erreur(s) sur cette page — détail : « console ».`)
    o.erreursNonLues = 0
  }
  return lignes.join('\n')
}

async function ecran(p: Participant, o: Onglet, message?: string): Promise<string> {
  const tete = await entete(p, o)
  return [message, tete, '', await arbre(o.page)].filter(x => x !== undefined).join('\n')
}

/**
 * Trouve ce que l'agent désigne : une référence lue dans `voir` (e12), sinon
 * un texte — un bouton, un lien, un champ par son étiquette, puis n'importe
 * quel texte visible.
 */
async function localiser(page: Page, cible: string): Promise<Element> {
  if (/^e\d+$/.test(cible)) {
    const el = page.locator(`aria-ref=${cible}`)
    if ((await el.count().catch(() => 0)) === 0) {
      throw new Refus(`La référence ${cible} ne désigne plus rien : l'écran a changé. Relis-le avec « voir ».`)
    }
    return el
  }
  const candidats = [
    page.getByRole('button', { name: cible, exact: true }),
    page.getByRole('link', { name: cible, exact: true }),
    page.getByLabel(cible, { exact: true }),
    page.getByPlaceholder(cible, { exact: true }),
    page.getByRole('button', { name: cible }),
    page.getByRole('link', { name: cible }),
    page.getByRole('checkbox', { name: cible }),
    page.getByLabel(cible),
    page.getByPlaceholder(cible),
    page.getByText(cible, { exact: true }),
    page.getByText(cible),
  ]
  for (const c of candidats) {
    const n = await c.count().catch(() => 0)
    for (let i = 0; i < n; i++) {
      if (await c.nth(i).isVisible().catch(() => false)) return c.nth(i)
    }
  }
  throw new Refus(`Rien de visible ne s'appelle « ${cible} ». Relis l'écran avec « voir » et vise une référence (e12).`)
}

/** Toucher du doigt sur un téléphone, cliquer ailleurs — et dire pourquoi ça n'a pas pris. */
async function toucher(p: Participant, el: Element) {
  try {
    if (APPAREILS[p.appareil].tactile) await el.tap({ timeout: 4000 })
    else await el.click({ timeout: 4000 })
  } catch (e) {
    const m = (e as Error).message
    if (/intercepts pointer events/.test(m)) {
      if (/data-tablee="clavier"/.test(m)) {
        throw new Refus('Ce bouton est caché sous le clavier du téléphone : ferme-le (« clavier ») ou valide avec « touche Enter ».')
      }
      const ligne = m.split('\n').find(l => l.includes('intercepts pointer events')) ?? ''
      const dessus = ligne.replace('intercepts pointer events', '').replace(/^\s*-\s*/, '').trim()
      throw new Refus(`Quelque chose recouvre ce bouton${dessus ? ` (${dessus.slice(0, 160)})` : ''} : il ne réagit pas au toucher.`)
    }
    if (/not enabled|disabled/i.test(m)) throw new Refus('Ce bouton est grisé : il ne réagit pas pour l’instant.')
    if (/not visible|outside of the viewport/i.test(m)) throw new Refus('Cet élément n’est pas visible à l’écran.')
    if (/Timeout/i.test(m)) throw new Refus('Ce bouton ne réagit pas (rien ne s’est passé en 4 s).')
    throw e
  }
}

async function adresseDuQr(o: Onglet): Promise<string | null> {
  const texte = await o.page
    .locator('.join-url')
    .first()
    .textContent({ timeout: 500 })
    .catch(() => null)
  return texte?.trim() || null
}

/**
 * L'écran commun, celui que toute la salle regarde : une page `/host` où
 * l'animateur est connecté, et qui montre donc l'adresse à scanner. Un
 * invité curieux qui ouvre `/host` sur son téléphone n'y voit qu'une page de
 * connexion : ce n'est pas la télé.
 */
async function trouverTele(): Promise<{ p: Participant; o: Onglet; adresse: string } | null> {
  for (const p of participants.values()) {
    for (const o of p.onglets.values()) {
      let surHost = false
      try {
        surHost = new URL(o.page.url()).pathname === '/host'
      } catch {
        // Une page encore vierge n'a pas d'adresse lisible.
      }
      const adresse = surHost ? await adresseDuQr(o) : null
      if (adresse) return { p, o, adresse }
    }
  }
  return null
}

/** Attend qu'une condition tienne, en rendant la main si l'agent a lâché la commande. */
async function guetter<T>(
  maxMs: number,
  signal: { annule: boolean },
  essai: () => Promise<T | null | undefined | false>,
  pas = 250,
): Promise<T | null> {
  const fin = Date.now() + maxMs
  while (Date.now() < fin && !signal.annule) {
    const r = await essai()
    if (r) return r
    await pause(pas)
  }
  return null
}

function duree(arg: string | undefined, defaut = 100): number {
  if (arg === undefined) return defaut * 1000
  const s = Number(arg)
  if (!Number.isFinite(s) || s <= 0) throw new Refus(`« ${arg} » n'est pas un nombre de secondes.`)
  return Math.min(s, 590) * 1000
}

function lireQuestion(e: any): string {
  const lignes = [`❓ ${e.label}${e.categorie ? ` · ${e.categorie}` : ''}${e.pause ? ' · ⏸ en pause' : ''}`, `« ${e.question} »`]
  if (e.image) lignes.push(e.photoPartie ? '(une photo, déjà disparue — de mémoire !)' : '(avec une photo — « capture » pour la voir)')
  if (e.etat === 'qcm') e.reponses.forEach((r: string, i: number) => lignes.push(`   ${i + 1}. ${r}`))
  else lignes.push(`   (estimation : un nombre${e.unite ? `, en ${e.unite}` : ''})`)
  if (e.reste !== null) lignes.push(`⏱ il reste ${e.reste} s`)
  return lignes.join('\n')
}

// ── Les gestes ──────────────────────────────────────────────────────────────

async function gesteRegie(geste: string, args: string[], signal: { annule: boolean }): Promise<string> {
  switch (geste) {
    case 'etat': {
      const lignes = [`🎲 Tablée ${lisible(DOSSIER)} — serveur ${BASE}`]
      if (animateur) lignes.push(`   ${animateur.prenom} : activation ${animateur.activation} · espace ${BASE}/${animateur.espace}`)
      for (const pp of profils) lignes.push(`   profil ${pp.prenom} ${pp.avatar} : ${pp.identifiant} / ${MOT_DE_PASSE_PROFIL}`)
      const tv = await trouverTele()
      lignes.push(tv ? `📺 écran commun : ${tv.p.qui} — ${(await texteVisible(tv.o.page)).split('\n').slice(0, 3).join(' · ')}` : '📺 écran commun éteint')
      for (const p of participants.values()) {
        const pages = [...p.onglets.values()].map(o => `${o.nom} ${chemin(o.page.url())}`).join(', ')
        lignes.push(`${APPAREILS[p.appareil].icone} ${p.qui} (${p.appareil}) — ${p.gestes} gestes, ${p.captures} captures — ${pages || 'aucun onglet'}`)
      }
      lignes.push(`🗣 ${salle.length} paroles dans la salle`)
      return lignes.join('\n')
    }
    case 'salle':
      return salle.length ? salle.map(m => `${new Date(m.t).toLocaleTimeString('fr-FR')} ${m.qui} : « ${m.texte} »`).join('\n') : 'Personne n’a encore parlé.'
    case 'attendre-tele': {
      const tv = await guetter(duree(args[0], 590), signal, trouverTele, 1000)
      if (!tv) throw new Refus('Toujours pas d’écran commun allumé.')
      return `📺 L'écran commun est allumé (${tv.p.qui}).\n${await texteVisible(tv.o.page)}`
    }
    case 'arreter':
      setTimeout(() => void eteindre(), 100)
      return 'La régie s’éteint.'
    default:
      throw new Refus(`Geste de régie inconnu : ${geste} (etat, salle, attendre-tele, arreter).`)
  }
}

async function executer(cible: string, geste: string, args: string[], signal: { annule: boolean }): Promise<string> {
  if (cible === 'regie') return gesteRegie(geste, args, signal)
  const [qui, nomOnglet = 'principal'] = cible.toLowerCase().split(':')
  if (!/^[a-z0-9-]{1,24}$/.test(qui)) throw new Refus(`« ${cible} » : un nom en minuscules, sans espace (ex. jeanne, nadia:tele).`)

  if (geste === 'appareil') {
    if (participants.has(qui)) throw new Refus(`${qui} a déjà un appareil (${participants.get(qui)!.appareil}). « partir » d'abord pour en changer.`)
    const p = await allumer(qui, args[0] ?? 'telephone')
    const o = await onglet(p, 'principal')
    return `${APPAREILS[p.appareil].icone} ${qui} allume son appareil : ${APPAREILS[p.appareil].description}.\n${await entete(p, o)}`
  }

  const p = participants.get(qui) ?? (await allumer(qui, 'telephone'))
  p.gestes++
  if (geste === 'partir') {
    await p.contexte.close().catch(() => {})
    participants.delete(qui)
    return `${qui} range son appareil : il quitte la soirée.`
  }
  const o = await onglet(p, nomOnglet)
  const page = o.page

  switch (geste) {
    case 'voir':
      return ecran(p, o)

    case 'texte':
      return `${await entete(p, o)}\n\n${await texteVisible(page)}`

    case 'capture': {
      const entiere = args.includes('--entiere')
      const nom = (args.find(a => !a.startsWith('--')) ?? 'ecran').replace(/[^\w-]+/g, '-').slice(0, 40)
      const fichier = path.join(DOSSIER, 'captures', qui, `${String(++p.captures).padStart(3, '0')}-${nom}.png`)
      mkdirSync(path.dirname(fichier), { recursive: true })
      await page.screenshot({ path: fichier, fullPage: entiere, scale: 'css' })
      return `${await entete(p, o)}\n📸 ${fichier}\n   (regarde-la avec l'outil Read)`
    }

    case 'ouvrir': {
      const adresse = args[0]
      if (!adresse) throw new Refus('Ouvrir quoi ? ex. « ouvrir / » ou « ouvrir /chez-nadia ».')
      await page.goto(adresse, { waitUntil: 'domcontentloaded' }).catch((e: Error) => {
        throw new Refus(`La page ne s'ouvre pas : ${e.message.split('\n')[0]}`)
      })
      await stabiliser(page, 6000)
      return ecran(p, o)
    }

    case 'scanner': {
      const tv = await guetter(duree(args[0]), signal, trouverTele, 1000)
      if (!tv) throw new Refus('Pas de QR code à scanner : l’écran commun n’est pas encore allumé. Réessaie un peu plus tard.')
      await page.goto(tv.adresse, { waitUntil: 'domcontentloaded' })
      await stabiliser(page, 6000)
      return ecran(p, o, `📷 Tu scannes le QR code de l'écran commun : ${tv.adresse}`)
    }

    case 'toucher': {
      const cibleTexte = args.join(' ')
      if (!cibleTexte) throw new Refus('Toucher quoi ? ex. « toucher e12 » ou « toucher "Jouer sans compte" ».')
      await toucher(p, await localiser(page, cibleTexte))
      await stabiliser(page)
      return ecran(p, o)
    }

    case 'ecrire': {
      const [champ, ...mots] = args
      if (!champ || mots.length === 0) throw new Refus('Écrire où, et quoi ? ex. « ecrire e7 "Jeanne" ».')
      const el = await localiser(page, champ)
      // Le doigt d'abord : c'est lui qui ouvre le clavier d'un téléphone.
      if (APPAREILS[p.appareil].tactile) await toucher(p, el).catch(() => {})
      await el.fill(mots.join(' ')).catch((e: Error) => {
        throw new Refus(`Impossible d'écrire ici : ${e.message.split('\n')[0]}`)
      })
      await stabiliser(page)
      return ecran(p, o)
    }

    case 'touche': {
      if (!args[0]) throw new Refus('Quelle touche ? ex. « touche Enter ».')
      await page.keyboard.press(args[0]).catch(() => {
        throw new Refus(`Touche inconnue : ${args[0]} (Enter, Tab, Escape, Backspace, ArrowDown…).`)
      })
      await stabiliser(page)
      return ecran(p, o)
    }

    case 'clavier':
      await page.evaluate('document.activeElement && document.activeElement.blur()')
      await stabiliser(page)
      return ecran(p, o, '⌨ Tu fermes le clavier.')

    case 'choisir': {
      const [liste, ...mots] = args
      if (!liste || !mots.length) throw new Refus('Choisir quoi ? ex. « choisir e9 "Les Aigles" ».')
      const el = await localiser(page, liste)
      const voulu = mots.join(' ')
      await el.selectOption({ label: voulu }).catch(() =>
        el.selectOption(voulu).catch(() => {
          throw new Refus(`« ${voulu} » n'est pas dans cette liste.`)
        }),
      )
      await stabiliser(page)
      return ecran(p, o)
    }

    case 'defiler': {
      const sens = args[0] ?? 'bas'
      if (sens === 'bas' || sens === 'haut') {
        const vue = page.viewportSize() ?? { width: 400, height: 800 }
        await page.mouse.move(vue.width / 2, vue.height / 2)
        await page.mouse.wheel(0, (sens === 'bas' ? 1 : -1) * vue.height * 0.8)
      } else {
        await (await localiser(page, args.join(' '))).scrollIntoViewIfNeeded()
      }
      await stabiliser(page, 1000)
      return `${await entete(p, o)}\n↕ Tu fais défiler (${sens}). « capture » pour voir ce qui est à l'écran.`
    }

    case 'fichier': {
      const [champ, fichierDemande] = args
      if (!champ || !fichierDemande) throw new Refus('ex. « fichier e14 photos/gateau.jpg ».')
      const fichier = path.isAbsolute(fichierDemande) ? fichierDemande : path.join(DOSSIER, fichierDemande)
      if (!existsSync(fichier)) throw new Refus(`Pas de fichier ${fichier}.`)
      const el = await localiser(page, champ)
      const estChamp = await el.evaluate("n => n.tagName === 'INPUT' && n.type === 'file'").catch(() => false)
      if (estChamp) await el.setInputFiles(fichier)
      else {
        const [selecteur] = await Promise.all([page.waitForEvent('filechooser', { timeout: 4000 }), toucher(p, el)])
        await selecteur.setFiles(fichier)
      }
      await stabiliser(page, 4000)
      return ecran(p, o, `📎 Tu joins ${path.basename(fichier)}.`)
    }

    case 'retour':
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {})
      await stabiliser(page, 5000)
      return ecran(p, o)

    case 'recharger':
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
      await stabiliser(page, 6000)
      return ecran(p, o)

    case 'attendre': {
      const tele = args.includes('--tele')
      const disparu = args.includes('--disparu')
      const reste = args.filter(a => !a.startsWith('--'))
      const nombre = reste.length > 1 && /^\d+$/.test(reste[reste.length - 1]) ? reste.pop() : undefined
      const texte = reste.join(' ')
      if (!texte) throw new Refus('Attendre quoi ? ex. « attendre "Question 2" 60 ».')
      const maxMs = duree(nombre)
      // L'écran commun peut s'allumer pendant l'attente : on le cherche à
      // chaque regard, sans quoi le retardataire qui guette la question 2
      // échouait tant que l'animatrice écrivait encore son quiz.
      const vue = await guetter(maxMs, signal, async () => {
        const v = tele ? (await trouverTele())?.o.page : page
        if (!v) return null
        const visible = await v.getByText(texte).first().isVisible().catch(() => false)
        return (disparu ? !visible : visible) ? v : null
      }, 300)
      if (!vue) {
        const eteinte = tele && !(await trouverTele()) ? ' (l’écran commun n’est toujours pas allumé)' : ''
        throw new Refus(`Au bout de ${secondes(maxMs)}, « ${texte} » ${disparu ? 'est toujours là' : 'n’est pas apparu'}${eteinte}.`)
      }
      if (tele) return `📺 ${disparu ? 'Parti' : 'Apparu'} sur l'écran commun : « ${texte} »\n\n${await texteVisible(vue)}`
      await stabiliser(page)
      return ecran(p, o)
    }

    case 'question': {
      const maxMs = duree(args[0])
      const debut = Date.now()
      let ailleursDepuis = 0
      const e: any = await guetter(maxMs, signal, async () => {
        const etat: any = await page.evaluate(LIRE_TELEPHONE).catch(() => null)
        if (!etat) return null
        if ((etat.etat === 'qcm' || etat.etat === 'estimation') && etat.ouvert) {
          const cle = `${etat.label}|${etat.question}`
          if (p.question?.cle !== cle) return etat
          // La même, reposée par l'animateur : le téléphone a oublié la réponse donnée.
          const vierge = etat.etat === 'qcm' ? etat.choisi === 0 : !etat.deja
          if (p.question.repondu && vierge) return etat
        }
        // La photo d'une question de mémoire ne reste que quelques secondes :
        // l'agent doit pouvoir la regarder avant qu'elle disparaisse.
        if (etat.etat === 'memoriser' && p.memoriser !== etat.label) return etat
        // La révélation de la question qu'on lui a lue : c'est là qu'un invité
        // apprend s'il avait juste. La première tablée la sautait, et le
        // lecteur d'écran a conclu que son téléphone ne disait jamais la
        // bonne réponse — il la dit, en toutes lettres.
        if (etat.etat === 'revelation' && p.question && p.revelation !== p.question.cle) return etat
        if (etat.etat === 'podium' && !p.podiumAnnonce) return etat
        if (etat.etat === 'fin') return etat
        // Un rechargement ou une reconnexion passe un instant par un autre
        // écran : on ne s'en inquiète qu'au bout de quelques secondes.
        if (etat.etat !== 'ailleurs') ailleursDepuis = 0
        else if (!ailleursDepuis) ailleursDepuis = Date.now()
        else if (Date.now() - ailleursDepuis > 3000) return etat
        return null
      })
      if (!e) {
        const etat: any = await page.evaluate(LIRE_TELEPHONE).catch(() => ({ etat: '?' }))
        throw new Refus(`Pas de nouvelle question en ${secondes(Date.now() - debut)} (ton téléphone : ${etat.etat}). Redemande « question » pour attendre encore.`)
      }
      if (e.etat === 'qcm' || e.etat === 'estimation') {
        p.question = { cle: `${e.label}|${e.question}`, vueA: Date.now(), repondu: false }
        p.podiumAnnonce = false
        return `${await entete(p, o)}\n\n${lireQuestion(e)}\n→ « repondre <${e.etat === 'qcm' ? 'numéro' : 'nombre'}> » (ou « capture » pour voir l'écran)`
      }
      if (e.etat === 'memoriser') {
        p.memoriser = e.label
        return `${await entete(p, o)}\n\n👁 ${e.label} · Mémorise : une photo s'affiche seule${e.reste !== null ? ` (encore ${e.reste} s)` : ''}, la question arrive quand elle disparaît.\n→ « capture » pour la regarder vite, puis « question ».`
      }
      if (e.etat === 'revelation') {
        p.revelation = p.question?.cle ?? null
        return `${await entete(p, o)}\n\n🔔 Révélation sur ton téléphone : ${e.resume}\n→ « question » pour la suivante (« tele » pour l'écran commun).`
      }
      if (e.etat === 'podium') {
        p.podiumAnnonce = true
        return ecran(p, o, '🏁 Le quiz est terminé : ton téléphone affiche le podium.')
      }
      if (e.etat === 'fin') return ecran(p, o, '🌙 La soirée est close : ton téléphone affiche la fin de soirée.')
      return ecran(p, o, '↪ Ton téléphone n’est ni en jeu ni en salle d’attente :')
    }

    case 'repondre': {
      const voulu = args.join(' ').trim()
      if (!voulu) throw new Refus('Répondre quoi ? le numéro d’une réponse, son texte, ou un nombre.')
      const e: any = await page.evaluate(LIRE_TELEPHONE).catch(() => null)
      if (!e || (e.etat !== 'qcm' && e.etat !== 'estimation')) {
        throw new Refus(`Pas de question ouverte sur ton téléphone (il affiche : ${e?.etat ?? '?'}).`)
      }
      if (!e.ouvert) throw new Refus(e.pause ? 'La question est en pause : les réponses sont bloquées.' : 'Trop tard : les réponses sont closes.')
      const lue = p.question && p.question.cle === `${e.label}|${e.question}` ? p.question : null
      const depuis = lue ? Date.now() - lue.vueA : null
      const delai = depuis === null ? '' : ` — ${secondes(depuis)} après l'apparition de la question`
      if (e.etat === 'qcm') {
        const reponses: string[] = e.reponses
        // « 2007 » à une question dont les réponses sont des années : c'est
        // le texte d'une réponse, pas son numéro.
        let n = /^\d+$/.test(voulu) && Number(voulu) <= reponses.length ? Number(voulu) : 0
        if (!n) {
          const bas = voulu.toLowerCase()
          n = reponses.findIndex(r => r.toLowerCase() === bas) + 1 || reponses.findIndex(r => r.toLowerCase().includes(bas)) + 1
        }
        if (n < 1 || n > reponses.length) {
          throw new Refus(`Aucune réponse ne s'appelle « ${voulu} », et il n'y en a que ${reponses.length} : donne son numéro (1 à ${reponses.length}) ou son texte.`)
        }
        await toucher(p, page.locator('.quiz-player .ans-btn').nth(n - 1))
        // On relit la page plutôt que d'y confier un prédicat à
        // `waitForFunction` : la politique de sécurité de l'application
        // (`script-src 'self'`, sans `unsafe-eval`) le refuse dès qu'il n'est
        // pas vrai au premier regard, et la première tablée annonçait des
        // réponses « non enregistrées » qui l'étaient aussitôt.
        const presse = `(() => { const b = document.querySelectorAll('.quiz-player .ans-btn')[${n - 1}]; return !!b && b.getAttribute('aria-pressed') === 'true' })()`
        const accuse = !!(await guetter(4000, signal, async () => (await page.evaluate(presse).catch(() => false)) === true, 100))
        await stabiliser(page, 1200)
        if (lue && accuse) lue.repondu = true
        consigner({ qui, geste: 'reponse', question: e.label, choix: n, texte: reponses[n - 1], ms: depuis })
        const ligne = accuse
          ? `✅ Tu touches ${n}. « ${reponses[n - 1]} »${delai}.`
          : `⚠ Tu touches ${n}. « ${reponses[n - 1]} »${delai} — mais le téléphone ne montre pas ta réponse comme enregistrée.`
        return `${ligne}\n${await entete(p, o)}\n\n${await texteVisible(page)}`
      }
      const champ = page.locator('.quiz-player .guess-form input')
      if (APPAREILS[p.appareil].tactile) await toucher(p, champ).catch(() => {})
      await champ.fill(voulu)
      await champ.press('Enter')
      const accuse = await page
        .getByText('Ta réponse')
        .first()
        .waitFor({ state: 'visible', timeout: 4000 })
        .then(() => true)
        .catch(() => false)
      await stabiliser(page, 1200)
      if (lue && accuse) lue.repondu = true
      consigner({ qui, geste: 'reponse', question: e.label, estimation: voulu, ms: depuis })
      return `${accuse ? '✅' : '⚠'} Tu proposes ${voulu}${delai}${accuse ? '' : ' — le téléphone ne montre pas de réponse enregistrée'}.\n${await entete(p, o)}\n\n${await texteVisible(page)}`
    }

    case 'tele': {
      const tv = await trouverTele()
      if (!tv) throw new Refus('L’écran commun n’est pas allumé pour l’instant.')
      let photo = ''
      if (args.includes('--capture')) {
        const fichier = path.join(DOSSIER, 'captures', qui, `${String(++p.captures).padStart(3, '0')}-tele.png`)
        mkdirSync(path.dirname(fichier), { recursive: true })
        await tv.o.page.screenshot({ path: fichier, scale: 'css' })
        photo = `\n📸 ${fichier}\n   (regarde-la avec l'outil Read)`
      }
      return `${await entete(p, o)}\n📺 Tu lèves les yeux vers l'écran commun :${photo}\n\n${await texteVisible(tv.o.page)}`
    }

    case 'dire': {
      const texte = args.join(' ').trim().slice(0, 280)
      if (!texte) throw new Refus('Dire quoi ?')
      salle.push({ t: Date.now(), qui, texte })
      p.entendu = salle.length
      return `🗣 Tu dis à la salle : « ${texte} »`
    }

    case 'ecouter': {
      const deja = salle.slice(p.entendu).some(m => m.qui !== qui)
      if (!deja) await guetter(duree(args[0], 60), signal, async () => salle.slice(p.entendu).some(m => m.qui !== qui), 500)
      const tete = await entete(p, o)
      return tete.includes('🗣') ? tete : `${tete}\n(personne n'a parlé)`
    }

    case 'reseau': {
      const coupe = args[0] === 'coupe'
      if (!coupe && args[0] !== 'retabli') throw new Refus('« reseau coupe » ou « reseau retabli ».')
      await p.contexte.setOffline(coupe)
      p.horsLigne = coupe
      await pause(coupe ? 2500 : 3500)
      return ecran(p, o, coupe ? '📵 Tu perds le réseau.' : '📶 Le réseau revient.')
    }

    case 'veille': {
      const ms = duree(args[0], 30)
      // L'écran s'éteint : la page passe en arrière-plan, le réseau se tait,
      // les minuteurs se figent — ce que fait un téléphone posé sur la table.
      const cdp = await p.contexte.newCDPSession(page)
      await page.evaluate(`(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })()`)
      await p.contexte.setOffline(true)
      await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }).catch(() => {})
      await guetter(ms, signal, async () => false, 500)
      await cdp.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => {})
      await p.contexte.setOffline(p.horsLigne)
      await page.evaluate(`(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })()`)
      await pause(2500)
      await stabiliser(page)
      return ecran(p, o, `💤 Ton téléphone s'est mis en veille ${secondes(ms)}, puis tu le rallumes.`)
    }

    case 'zoom': {
      const pourcent = Number(args[0])
      if (!(pourcent >= 50 && pourcent <= 300)) throw new Refus('« zoom 130 » : un pourcentage entre 50 et 300.')
      p.zoom = pourcent
      await p.contexte.addInitScript({ content: zoomScript(pourcent) })
      for (const x of p.onglets.values()) await x.page.evaluate(zoomScript(pourcent)).catch(() => {})
      await stabiliser(page)
      return ecran(p, o, `🔍 Le texte est à ${pourcent} %.`)
    }

    case 'vision': {
      const type = VISION[args[0]]
      if (!type) throw new Refus(`Au choix : ${Object.keys(VISION).join(', ')}.`)
      p.vision = type
      for (const x of p.onglets.values()) await reglerPage(p, x.page)
      return `${await entete(p, o)}\n👁 Tes captures montreront l'écran tel que tu le vois.`
    }

    case 'mouvement': {
      p.mouvementReduit = args[0] === 'reduit'
      for (const x of p.onglets.values()) await x.page.emulateMedia({ reducedMotion: p.mouvementReduit ? 'reduce' : 'no-preference' })
      return `${await entete(p, o)}\n${p.mouvementReduit ? 'Animations réduites.' : 'Animations normales.'}`
    }

    case 'orientation': {
      const vue = page.viewportSize()
      if (!vue) throw new Refus('Pas d’écran à tourner.')
      const paysage = args[0] === 'paysage'
      const [petit, grand] = [Math.min(vue.width, vue.height), Math.max(vue.width, vue.height)]
      await page.setViewportSize(paysage ? { width: grand, height: petit } : { width: petit, height: grand })
      await stabiliser(page)
      return ecran(p, o, paysage ? '↻ Tu tournes le téléphone à l’horizontale.' : '↻ Tu remets le téléphone droit.')
    }

    case 'console': {
      const tout = [...p.onglets.values()].flatMap(x => x.signalements.splice(0).map(s => `${x.nom === 'principal' ? '' : `[${x.nom}] `}${s}`))
      for (const x of p.onglets.values()) x.erreursNonLues = 0
      return tout.length
        ? `Ce que le navigateur a signalé (un 401 sur une page où l'on n'est pas connecté est normal) :\n${tout.join('\n')}`
        : 'Le navigateur n’a rien signalé.'
    }

    case 'presse-papiers': {
      const contenu = await page.evaluate('navigator.clipboard.readText()').catch(() => null)
      return contenu ? `📋 Le presse-papiers contient : ${contenu}` : '📋 Le presse-papiers est vide.'
    }

    case 'onglets':
      return [...p.onglets.values()].map(x => `${qui}${x.nom === 'principal' ? '' : `:${x.nom}`} → ${chemin(x.page.url())}`).join('\n')

    case 'fermer':
      await page.close().catch(() => {})
      return `Onglet ${nomOnglet} fermé.`

    default:
      throw new Refus(`Geste inconnu : « ${geste} ». « node server/scripts/tablee/pilote.mjs aide » les liste.`)
  }
}

// ── La porte des agents ─────────────────────────────────────────────────────

function lireCorps(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let corps = ''
    req.setEncoding('utf8')
    req.on('data', c => (corps += c))
    req.on('end', () => resolve(corps))
    req.on('error', reject)
  })
}

const porte = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const repondre = (ok: boolean, sortie: string) => {
    if (res.writableEnded) return
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok, sortie }))
  }
  if (req.method !== 'POST' || req.url !== '/geste') {
    res.writeHead(404).end()
    return
  }
  // L'agent a lâché la commande (délai de son outil) : on cesse d'attendre pour lui.
  const signal = { annule: false }
  res.on('close', () => {
    signal.annule = true
  })
  const debut = Date.now()
  let demande: { cible?: string; geste?: string; args?: string[] } = {}
  try {
    demande = JSON.parse(await lireCorps(req))
    const cible = String(demande.cible ?? '')
    const geste = String(demande.geste ?? 'voir')
    const args = Array.isArray(demande.args) ? demande.args.map(String) : []
    const sortie = await executer(cible, geste, args, signal)
    consigner({ qui: cible, geste, args, ok: true, ms: Date.now() - debut })
    repondre(true, sortie)
  } catch (e) {
    const refus = e instanceof Refus
    const message = refus ? (e as Error).message : `La régie a trébuché : ${(e as Error).message?.split('\n')[0]}`
    if (!refus) console.error('[tablee] geste en échec :', demande, e)
    consigner({ qui: demande.cible, geste: demande.geste, args: demande.args, ok: false, erreur: message, ms: Date.now() - debut })
    repondre(false, `✗ ${message}`)
  }
})
await new Promise<void>(resolve => porte.listen(0, '127.0.0.1', resolve))
const adressePorte = porte.address()
const portRegie = typeof adressePorte === 'object' && adressePorte ? adressePorte.port : 0

const fiche = {
  dossier: DOSSIER,
  portRegie,
  base: BASE,
  pid: process.pid,
  lancee: new Date().toISOString(),
  admin: { identifiant: ADMIN.login, motDePasse: ADMIN.password, espace: `${BASE}/${ADMIN.slug}` },
  animateur: animateur && { ...animateur, espace: `${BASE}/${animateur.espace}` },
  profils: profils.map(pp => ({ ...pp, motDePasse: MOT_DE_PASSE_PROFIL })),
  photos: Object.keys(PHOTOS).map(nom => `photos/${nom}`),
}
writeFileSync(path.join(DOSSIER, 'regie.json'), JSON.stringify(fiche, null, 2))
mkdirSync(path.dirname(COURANTE), { recursive: true })
writeFileSync(COURANTE, JSON.stringify(fiche, null, 2))

let extinction = false
async function eteindre() {
  if (extinction) return
  extinction = true
  console.log('[tablee] extinction : navigateur, serveur…')
  porte.close()
  await navigateur.close().catch(() => {})
  await serveur.close().catch(() => {})
  // Le fichier ne désigne plus rien : les pilotes le diront au lieu d'attendre.
  try {
    if (JSON.parse(readFileSync(COURANTE, 'utf8')).pid === process.pid) rmSync(COURANTE)
  } catch {
    // Déjà parti, ou remplacé par une autre régie : rien à faire.
  }
  console.log(`[tablee] éteinte — tout est resté dans ${lisible(DOSSIER)}`)
  process.exit(0)
}
process.once('SIGINT', () => void eteindre())
process.once('SIGTERM', () => void eteindre())

console.log(`
🎲 La tablée est prête — ${lisible(DOSSIER)}

   Serveur de jeu   ${BASE}
   Administrateur   ${ADMIN.login} / ${ADMIN.password} — son espace : ${BASE}/${ADMIN.slug} (deux quiz livrés)${
     animateur
       ? `
   ${animateur.prenom.padEnd(16)} ${animateur.identifiant}, à activer : ${animateur.activation}
                    son espace : ${BASE}/${animateur.espace} (bibliothèque vide)`
       : ''
   }${profils
     .map(
       pp => `
   Profil prêt      ${pp.prenom} ${pp.avatar} — ${pp.identifiant} / ${MOT_DE_PASSE_PROFIL} (code de secours ${pp.secours})`,
     )
     .join('')}
   Photos           ${Object.keys(PHOTOS).map(n => `photos/${n}`).join(', ')}

   Les agents       node server/scripts/tablee/pilote.mjs <qui> <geste> …
                    node server/scripts/tablee/pilote.mjs aide
   Ctrl+C éteint la régie ; le dossier reste.
`)
