// Le Sphinx de l'accueil, au téléphone (l'étape 2 du plan du 24 novembre 2026,
// `retours/2026-11-24/le-sphinx/plan.md` ; la maquette validée, `sphinx.html`
// du même dossier) : la visite pas à pas, au doigt, sur un serveur jetable —
// l'accueil, l'arrivée, chaque réplique, la vitrine des Divins, le Divin du
// moment et sa phrase, le menu, l'énigme, une réponse qui brûle, une fausse, la
// bonne, le mot qui vole, la fin et l'album —, en 360 × 640 et en 390 × 844 ;
// puis « Plus tard » et l'épingle sur l'accueil, la visite rouverte de
// l'épingle, « Plus tard » l'énigme ouverte et sa reprise, ses essais gardés,
// puis la langue au chat, trois essais perdus, l'épingle seule quand
// une soirée attend, l'album d'un non-habitué — et les mots des autres
// qu'il y inscrit, un faux puis un juste —, une phrase reconstituée par
// tous, moins de mouvement, l'Ivoire et le texte agrandi à 130 %.
//
//   npm run build -w client
//   cd server && npx tsx scripts/rendu-sphinx.ts ../export/sphinx
//
// Ce que le propriétaire ne doit pas voir — il joue aussi : les photos ne
// posent que les trois énigmes de la maquette, qu'il a déjà vues (n° 32, 211
// et 146, par `enigmesDuSphinx`), et jamais la vraie phrase d'un Divin : le
// banc lit une phrase inventée à la place de chaque légende
// (`phraseInventeeDuSphinx`, celle de la maquette). Rien de ce qui suit ne
// s'écrit au journal : ni une solution, ni une réponse acceptée.
//
// À chaque photo, ce qui déborde de l'écran ou de son cadre, les cibles de
// doigt sous 44 px, le texte sous 11 px (à 100 %), ce qui passe sous la niche ;
// sur l'accueil, si l'épingle passe sur un bouton. Il sort en erreur si l'un
// d'eux casse (`SEULEMENT=lea,tom` : ces cas seulement ; `LONGUE=1` : une
// phrase inventée de vingt et un mots, la longueur de la plus longue légende ;
// sans dossier, `export/sphinx`).
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { ProfileStore } from '../src/auth/profiles'
import { enigmesDuSphinx, motsDeLaLegende, ORDRE_DU_SPHINX, type Enigme } from '../src/core/sphinx'
import { PASSEUR, PASSEUR_A_CHOISIR } from '../test/passeur'
import { CATEGORIES } from '../../shared/categories'
import { SOUS_LA_NICHE } from './a-l-ecran'

const Database = createRequire(import.meta.url)('better-sqlite3')
const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.resolve(process.argv[2] ?? path.join(ici, '../../export/sphinx'))
mkdirSync(sortie, { recursive: true })
ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

/**
 * La phrase inventée de la maquette : elle ne dit la règle d'aucun Divin. `LONGUE=1` en pose une de vingt et un mots,
 * inventée elle aussi : les vraies légendes en comptent de dix à vingt et un, et la plus longue doit tenir au-dessus du
 * Sphinx sans qu'aucune ne soit jamais photographiée.
 */
const INVENTEE = process.env.LONGUE
  ? 'Il descend sur qui défie le temps sans jamais perdre l’heure de son rendez-vous ni le fil des jours qui passent'
  : 'Il descend sur qui défie le temps sans jamais perdre l’heure de son rendez-vous'
/** Les trois énigmes de la maquette, que le propriétaire a déjà vues : les seules que les photos montrent. */
const DE_LA_MAQUETTE = ['32', '211', '146'] as const
const enigme = (numero: (typeof DE_LA_MAQUETTE)[number]): Enigme => {
  const e = enigmesDuSphinx().find(x => x.numero === numero)
  if (!e) throw new Error(`l’énigme n° ${numero} n’est plus dans la réserve`)
  return e
}
/** Une réponse qui brûle (elle ne coûte pas d'essai), une fausse, la juste : lues dans la réserve, jamais écrites au journal. */
const reponses = (e: Enigme) => ({ brule: e.presque[0], fausse: 'la pluie', juste: e.acceptees[0] ?? e.solution })

type Ecran = [number, number]
const PETIT: Ecran = [360, 640]
const MOYEN: Ecran = [390, 844]

// Mardi 24 novembre 2026, 10 h à Paris.
const horloge = { t: Date.UTC(2026, 10, 24, 9, 0) }
const jourDe = (t: number) => new Date(t).toISOString().slice(0, 10)
const banc = await demarrer({
  horlogeDuJour: () => horloge.t,
  baseDeLaCampagne: baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] }),
  // Le Sphinx passe chez chaque habitué, chaque jour : la chance d'une visite se vérifie ailleurs (`sphinx-pur.test.ts`).
  tirageDuSphinx: () => 0,
  enigmesDuSphinx: [enigme('32')],
  phraseInventeeDuSphinx: INVENTEE,
})
const navigateur = await chromium.launch({ headless: true })
const db = () => new Database(banc.quizDbUrl.replace(/^file:/, ''))
const idDe = (login: string) => {
  const d = db()
  try {
    return (d.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
  } finally {
    d.close()
  }
}

/** Un habitué : cinq des sept derniers jours joués au quiz du jour, écrits en base (comme `sphinx-accueil.test.ts`). */
function habitue(login: string) {
  const id = idDe(login)
  const d = db()
  try {
    const questions = JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 })))
    for (let i = 1; i <= 5; i++) {
      const jour = jourDe(horloge.t - i * 24 * 3_600_000)
      d.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`).run(jour, questions)
      d.prepare(`INSERT OR IGNORE INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 900, 6, 2, 0)`).run(id, jour)
    }
  } finally {
    d.close()
  }
}

/**
 * Les mots qu'un autre habitué a déjà trouvés : des visites résolues les jours d'avant, une par mot, écrites en base —
 * les énigmes y sont des numéros sans réserve, que personne ne voit.
 */
function motsDeTous(login: string, places: readonly number[]) {
  const id = idDe(login)
  const d = db()
  try {
    places.forEach((mot, k) => {
      d.prepare(
        `INSERT OR IGNORE INTO profile_sphinx (profile_id, jour, enigme, divin, etat, essais, reponses, mot, proposee_le, close_le) VALUES (?, ?, ?, ?, 'resolue', 1, '[]', ?, 1, 2)`,
      ).run(id, jourDe(horloge.t - (k + 30) * 24 * 3_600_000), `figurant-${k}`, ORDRE_DU_SPHINX[0], mot)
    })
  } finally {
    d.close()
  }
}

/** Son loup dans sa niche : le coin haut droit de l'accueil est à lui (l'épingle n'y va pas). */
function sonLoup(login: string) {
  const id = idDe(login)
  const d = db()
  try {
    d.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', id)
    d.prepare('INSERT OR IGNORE INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 0, 1, 1)').run(id, 'loup')
  } finally {
    d.close()
  }
}

/** La réserve que lira la prochaine visite tirée : le serveur la relit à son redémarrage. */
const reserve = async (numero: (typeof DE_LA_MAQUETTE)[number]) => banc.redemarrer({ reglages: { enigmesDuSphinx: [enigme(numero)] } })

/**
 * Ce que la page mesure, à chaque photo : ce qui sort de l'écran, ce qui déborde du cadre du haut (`.sx-haut`) sans y
 * défiler, ce que le haut montre et qui passe sous la boîte ou le menu, les cibles de doigt sous 44 px, le texte sous
 * 11 px (à 100 % : 0,6875 rem), et, l'épingle à l'écran, si elle passe sur un bouton. En texte : `tsx` glisserait des
 * `__name` dans une fonction.
 */
const MESURES = `(() => {
  const W = innerWidth, H = innerHeight
  const nom = el => el.tagName.toLowerCase() + '.' + String(el.className.baseVal ?? el.className).split(' ').filter(Boolean).slice(0, 2).join('.')
  const visible = el => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.05) return false
    }
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1
  }
  const scene = document.querySelector('.sx-scene')
  const racine = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const dehors = []
  const zone = scene || document.querySelector('.accueil') || document.body
  for (const el of zone.querySelectorAll('.sx-boite, .sx-choix, .sx-parchemin, .sx-focus, .sx-vitrine, .sx-mot-vole, .sx-epingle, .sx-sphinx canvas')) {
    if (!visible(el)) continue
    // Dans le cadre du haut, qui défile, seule sa part visible compte : un problème, plus long qu'une énigme, y défile
    // sur un petit téléphone, et son haut passé sous le bord du cadre n'est pas hors de l'écran (le 25 novembre 2026).
    const b = el.getBoundingClientRect()
    const cadre = el.closest('.sx-haut')?.getBoundingClientRect()
    const r = cadre ? { left: b.left, right: b.right, top: Math.max(b.top, cadre.top), bottom: Math.min(b.bottom, cadre.bottom) } : b
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) dehors.push(nom(el) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','))
  }
  // Ce que montre le haut, contre ce qui le borne : la boîte, ou le menu quand il est ouvert.
  const haut = document.querySelector('.sx-haut')
  const montre = haut ? [...haut.children].filter(el => visible(el) && !el.matches('.sx-mot-vole')) : []
  const boite = document.querySelector('.sx-boite')
  const menu = document.querySelector('.sx-choix')
  const sous = []
  // Ce qui dépasse du cadre du haut y défile, coupé par lui : seul compte ce qui s'en voit.
  const cadre = haut ? haut.getBoundingClientRect() : null
  const coupe = r => (cadre ? { left: r.left, right: r.right, top: Math.max(r.top, cadre.top), bottom: Math.min(r.bottom, cadre.bottom) } : r)
  for (const el of montre) {
    const r = coupe(el.getBoundingClientRect())
    for (const b of [boite, menu].filter(x => x && visible(x))) {
      const rb = b.getBoundingClientRect()
      const chevauche = Math.min(r.bottom, rb.bottom) - Math.max(r.top, rb.top)
      const large = Math.min(r.right, rb.right) - Math.max(r.left, rb.left)
      // Le contenu réel du haut : son dernier enfant visible, pas sa boîte entière (une grille centrée).
      if (chevauche > 2 && large > 2) {
        const derniers = [...el.querySelectorAll('*')].filter(visible).map(x => coupe(x.getBoundingClientRect())).filter(x => Math.min(x.bottom, rb.bottom) - Math.max(x.top, rb.top) > 2 && Math.min(x.right, rb.right) - Math.max(x.left, rb.left) > 2)
        if (derniers.length) sous.push(nom(el) + ' sous ' + nom(b) + ' (' + Math.round(chevauche) + ' px)')
      }
    }
  }
  // La solution d'un problème : l'étape que le Sphinx dit — à la dernière, la réponse sous elle — dans la part visible du
  // cadre. La boîte qui grandissait après coup relevait son bas, et la réponse finissait dessous (le 26 novembre 2026).
  const dite = document.querySelector('.sx-solution.sx-montre .sx-solution-fin') || document.querySelector('.sx-solution.sx-montre .sx-courante')
  const etapeCachee = dite && cadre ? (r => Math.max(0, Math.round(Math.max(cadre.top - r.top, r.bottom - cadre.bottom))))(dite.getBoundingClientRect()) : 0
  const coupeDansLeHaut = haut && getComputedStyle(haut).overflowY !== 'auto' && haut.scrollHeight > haut.clientHeight + 1 ? 'le haut déborde de ' + (haut.scrollHeight - haut.clientHeight) + ' px' : null
  const defileLeHaut = haut && getComputedStyle(haut).overflowY === 'auto' && haut.scrollHeight > haut.clientHeight + 1 ? haut.scrollHeight - haut.clientHeight : 0
  // Ce qui le fait défiler : ce qui dépasse le bas de son cadre, nommé.
  const quiDepasse = defileLeHaut && cadre
    ? [...haut.querySelectorAll('*')].filter(visible).filter(el => el.getBoundingClientRect().bottom > cadre.bottom + 1).slice(-3).map(el => nom(el) + ' ' + Math.round(el.getBoundingClientRect().bottom - cadre.bottom) + ' px')
        .concat(['cadre ' + haut.clientHeight + ', voile ' + (getComputedStyle(scene).getPropertyValue('--sx-divin') || 'naturel') + ', montré ' + [...haut.children].filter(visible).map(el => nom(el) + ' ' + el.getBoundingClientRect().height.toFixed(1) + ' (marges ' + getComputedStyle(el).marginTop + ')').join(' + ')])
    : []
  // Les cibles de doigt : ce qu'on touche dans la scène et l'épingle — un lien dans une phrase en est dispensé.
  const cibles = []
  for (const el of [...(scene ? scene.querySelectorAll('button, input, a') : []), ...document.querySelectorAll('.sx-epingle')]) {
    if (!visible(el) || (el.tagName === 'A' && el.closest('p'))) continue
    const r = el.getBoundingClientRect()
    if (r.height < 43.5 || r.width < 43.5) cibles.push(nom(el) + ' ' + Math.round(r.width) + '×' + Math.round(r.height))
  }
  // Le texte : rien sous l'étiquette (11 px à 100 %), hors de ce qui n'est dit qu'à l'oreille.
  const petits = []
  const marcheur = document.createTreeWalker(scene || document.querySelector('.album') || document.body, NodeFilter.SHOW_TEXT)
  for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
    const el = t.parentElement
    if (!el || !t.textContent.trim() || el.closest('.sr-only, .menu-barre, .niche') || !visible(el)) continue
    const taille = parseFloat(getComputedStyle(el).fontSize)
    if (taille < racine * 0.6875 - 0.01) petits.push('« ' + [...t.textContent.trim()].slice(0, 24).join('') + ' » ' + taille + ' px')
  }
  // L'épingle sur l'accueil : rien de ce qu'on touche sous elle.
  const epingle = document.querySelector('.sx-epingle')
  const surUnBouton = []
  if (epingle && visible(epingle)) {
    const e = epingle.getBoundingClientRect()
    for (const el of document.querySelectorAll('a, button, input, [role=button]')) {
      if (el === epingle || epingle.contains(el) || !visible(el)) continue
      const r = el.getBoundingClientRect()
      const x = Math.min(r.right, e.right) - Math.max(r.left, e.left), y = Math.min(r.bottom, e.bottom) - Math.max(r.top, e.top)
      if (x > 0.5 && y > 0.5) surUnBouton.push(nom(el) + ' (' + x.toFixed(1) + ' × ' + y.toFixed(1) + ' px)')
    }
  }
  return {
    large: document.documentElement.scrollWidth > W + 1 ? document.documentElement.scrollWidth : 0,
    // L'accueil tient sur un écran (règle profil.md) : l'épingle y prend sa place sans le faire défiler.
    defilePage: Math.max(0, document.documentElement.scrollHeight - H),
    dehors,
    sous: [...new Set(sous)],
    coupeDansLeHaut,
    etapeCachee,
    defileLeHaut,
    quiDepasse,
    enEnigme: !!document.querySelector('.sx-en-enigme'),
    cibles: [...new Set(cibles)],
    petits: [...new Set(petits)],
    epingle: epingle && visible(epingle) ? (() => { const r = epingle.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + '×' + Math.round(r.height) })() : null,
    surUnBouton,
  }
})()`

const rapport: Record<string, any> = {}
let n = 0
const ratees: string[] = []

interface Cas {
  cookie: string
  ecran: Ecran
  calme?: boolean
  texte?: number
  /** Une soirée en cours : la réponse de l'accueil réécrite en route, « Revenir chez Hugo » en tête. */
  soiree?: boolean
}

/** Un téléphone, au doigt, sur l'accueil d'un profil. */
async function telephone(cas: Cas) {
  const [w, h] = cas.ecran
  const ctx = await navigateur.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    ...(cas.calme && { reducedMotion: 'reduce' }),
  })
  const [cle, valeur] = cas.cookie.split('=')
  await ctx.addCookies([{ name: cle, value: valeur, url: banc.url }])
  // Le texte agrandi, posé avant la page : c'est elle qui doit tenir, pas le script qui la ferait sauter.
  if (cas.texte) {
    await ctx.addInitScript({
      content: `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'html { font-size: ${cas.texte}% !important; }'; document.head.append(s) })`,
    })
  }
  const page = await ctx.newPage()
  page.on('pageerror', (e: Error) => {
    console.error('[page]', e.message)
    ratees.push(`erreur dans la page : ${e.message}`)
  })
  if (cas.soiree) {
    await page.route(/\/api\/joueur\/moi\?accueil/, async (route: any) => {
      const reponse = await route.fetch()
      const j = await reponse.json()
      j.enCours = [{ nom: 'Hugo', slug: 'chez-hugo' }]
      await route.fulfill({ response: reponse, json: j })
    })
  }
  return { ctx, page, w, h }
}

/**
 * Une photo, ses mesures, et ce qui casse. Ce que le Sphinx montre au-dessus de lui — la vitrine, le Divin du moment —
 * doit tenir sans défiler, sauf au texte agrandi (`agrandi`) : son voile rétrécit d'abord, puis le cadre défile.
 * L'énigme peut défiler dans son cadre — huit vers —, et le rapport le dit.
 */
async function photo(page: any, cas: string, quoi: string, [w, h]: Ecran, { surAccueil = false, agrandi = cas === 'agrandi' } = {}) {
  await page.waitForTimeout(120)
  const nom = `${String(++n).padStart(2, '0')}-${cas}-${quoi}-${w}x${h}`
  await page.screenshot({ path: path.join(sortie, `${nom}.png`) })
  const m = (await page.evaluate(MESURES)) as any
  const niche = (await page.evaluate(SOUS_LA_NICHE)) as string[]
  m.niche = niche.filter(x => x !== '(pas de niche)')
  rapport[nom] = m
  const casse = [
    m.large && `la page déborde en largeur (${m.large} px)`,
    m.dehors.length && `hors de l’écran : ${m.dehors.join(' ; ')}`,
    m.sous.length && `sous la boîte : ${m.sous.join(' ; ')}`,
    m.coupeDansLeHaut,
    m.etapeCachee > 1 && `l’étape dite passe de ${m.etapeCachee} px hors de son cadre`,
    m.defileLeHaut > 0 && !m.enEnigme && !agrandi && `ce qu’il montre défile de ${m.defileLeHaut} px (${m.quiDepasse.join(', ')})`,
    m.cibles.length && `cibles sous 44 px : ${m.cibles.join(' ; ')}`,
    m.petits.length && `texte sous 11 px : ${m.petits.join(' ; ')}`,
    surAccueil && m.niche.length && `sous la niche : ${m.niche.join(' ; ')}`,
    surAccueil && m.defilePage > 0 && `l’accueil défile de ${m.defilePage} px`,
    m.surUnBouton.length && `l’épingle passe sur ${m.surUnBouton.join(' ; ')}`,
  ].filter(Boolean) as string[]
  const dit = [m.defileLeHaut ? `${m.enEnigme ? 'l’énigme' : 'ce qu’il montre'} défile de ${m.defileLeHaut} px dans son cadre` : null, m.epingle ? `épingle ${m.epingle}` : null].filter(Boolean)
  console.log(`${nom} — ${casse.length ? 'CASSE : ' + casse.join(' · ') : 'tient'}${dit.length ? ' · ' + dit.join(' · ') : ''}`)
  for (const c of casse) ratees.push(`${nom} : ${c}`)
}

// Le doigt sur la boîte, jamais sur un bouton : là où le texte s'écrit, en bas à gauche.
const toucherLaBoite = async (page: any) => {
  const b = await page.locator('.sx-boite').boundingBox()
  await page.touchscreen.tap(b.x + 30, b.y + b.height - 24)
  await page.waitForTimeout(140)
}
/** Le Sphinx a dit ce morceau (sa région lue à l'oreille), et sa réplique est écrite jusqu'à sa dernière lettre. */
async function quandIlADit(page: any, morceau: string) {
  await page.waitForFunction((m: string) => ((globalThis as any).document.querySelector('.sx-boite [aria-live]')?.textContent ?? '').includes(m), morceau, { timeout: 30000 })
  await page.waitForFunction(() => (globalThis as any).document.querySelectorAll('.sx-texte .sx-l:not(.sx-v)').length === 0, null, { timeout: 30000 })
  await page.waitForTimeout(250)
}
/** La boîte attend un toucher (le ▼). */
const enAttente = (page: any) => page.waitForSelector('.sx-boite.sx-attend', { timeout: 30000 })
/** Une réplique : attendue, photographiée si elle a un nom, puis touchée. */
async function replique(page: any, cas: string, quoi: string | null, ecran: Ecran) {
  await enAttente(page)
  await page.waitForTimeout(200)
  if (quoi) await photo(page, cas, quoi, ecran)
  await toucherLaBoite(page)
}
/** Le menu ouvert, puis le choix touché : « J'écoute ! » (0) ou « Plus tard » (1). */
async function choisir(page: any, cas: string, quoi: string | null, ecran: Ecran, rang: 0 | 1) {
  await page.waitForSelector('.sx-choix button', { timeout: 30000 })
  await page.waitForTimeout(250)
  if (quoi) await photo(page, cas, quoi, ecran)
  await page.locator('.sx-choix button').nth(rang).tap()
}
/** L'énigme, tous ses vers à l'écran, la réplique écrite. */
async function lEnigme(page: any) {
  await page.waitForSelector('.sx-parchemin.sx-montre', { timeout: 30000 })
  await page.waitForFunction(() => (globalThis as any).document.querySelectorAll('.sx-vers span:not(.sx-la)').length === 0, null, { timeout: 30000 })
  await page.waitForTimeout(2600)
}
/** Un problème : son récit entier à l'écran, la page descendue jusqu'à sa question, la consigne écrite. */
async function leProbleme(page: any) {
  await page.waitForSelector('.sx-probleme.sx-montre', { timeout: 30000 })
  await page.waitForFunction(() => (globalThis as any).document.querySelectorAll('.sx-recit p:not(.sx-la)').length === 0, null, { timeout: 30000 })
  await page.waitForTimeout(2600)
}
/** Une réponse tapée au doigt, puis « Répondre ». */
async function repondre(page: any, texte: string) {
  await page.locator('#sx-reponse').tap()
  await page.locator('#sx-reponse').fill(texte)
  await page.locator('.sx-reponse button').tap()
  await page.waitForTimeout(250)
}

/** L'accueil d'un profil, ouvert : il attend ses gros boutons. */
async function accueil(page: any) {
  await page.goto(`${banc.url}/`)
  await page.waitForSelector('.accueil-gestes', { timeout: 30000 })
}

/** La visite entière, de l'arrivée à l'album : la maquette, pas à pas. */
async function laVisite(cas: string, cookie: string, ecran: Ecran, e: Enigme) {
  const { ctx, page } = await telephone({ cookie, ecran })
  await accueil(page)
  await page.waitForTimeout(300)
  await photo(page, cas, 'accueil', ecran, { surAccueil: true })
  await page.waitForSelector('.sx-boite.sx-boite-la', { timeout: 30000 })
  await page.waitForTimeout(1500)
  await photo(page, cas, 'arrivee', ecran)
  await replique(page, cas, 'psst', ecran)
  await replique(page, cas, 'je-suis', ecran)
  await page.waitForTimeout(900)
  await replique(page, cas, 'vitrine', ecran)
  await replique(page, cas, 'les-plus-rares', ecran)
  await replique(page, cas, 'personne-ne-sait', ecran)
  await replique(page, cas, 'le-divin-du-moment', ecran)
  await choisir(page, cas, 'le-menu', ecran, 0)
  await lEnigme(page)
  await photo(page, cas, 'l-enigme', ecran)
  const r = reponses(e)
  if (r.brule) {
    await repondre(page, r.brule)
    await quandIlADit(page, 'Tu brûles')
    await photo(page, cas, 'ca-brule', ecran)
  }
  await repondre(page, r.fausse)
  await quandIlADit(page, 'Le sable a bougé')
  await photo(page, cas, 'une-fausse', ecran)
  await repondre(page, r.juste)
  await quandIlADit(page, 'Exact')
  await photo(page, cas, 'exact', ecran)
  // Le mot né là où était l'énigme, puis la phrase paraît sous lui : il part se ranger un demi-instant après.
  await page.waitForSelector('.sx-mot-vole.sx-montre', { timeout: 15000 })
  await page.waitForTimeout(500)
  await photo(page, cas, 'le-mot', ecran)
  await page.waitForSelector('.sx-focus.sx-montre', { timeout: 15000 })
  await page.waitForTimeout(150)
  await photo(page, cas, 'le-mot-et-sa-place', ecran)
  await page.waitForFunction(() => !!(globalThis as any).document.querySelector('.sx-focus .phrase-sien'), null, { timeout: 15000 })
  await replique(page, cas, 'le-mot-range', ecran)
  await replique(page, cas, 'les-autres', ecran)
  await replique(page, cas, 'la-fin', ecran)
  // Puis l'album, où sa phrase l'attend : la fiche du Divin ouverte, son mot qui s'y retourne.
  await page.waitForURL(/\/profil#collection-avatars-divin/, { timeout: 20000 })
  await page.waitForSelector('.album-phrase', { timeout: 20000 })
  await page.locator('.album-phrase').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1600)
  await photo(page, cas, 'l-album', ecran)
  await ctx.close()
}

const seulement = (process.env.SEULEMENT ?? '').split(',').filter(Boolean)
const veut = (cas: string) => !seulement.length || seulement.includes(cas)

try {
  const admin = await connexionAnimateur(banc.url)
  // Sa page démarre « bientôt » sur une base neuve : ouverte à tous, pour les photos.
  const ouverte = await ecrire(banc.url, '/api/admin/maintenance/pages/sphinx', { etat: 'ouverte' }, admin, 'PUT')
  if (!ouverte.ok) throw new Error(`la page du Sphinx ne s’ouvre pas (${ouverte.status})`)

  const profils: Record<string, string> = {}
  const nouveaux: [string, string, string][] = [
    ['lea', 'Léa', '🦊'],
    ['leaa', 'Léa', '🦊'],
    ['tom', 'Tom', '🐻'],
    ['zoe', 'Zoé', '🐸'],
    ['hugo', 'Hugo', '🦁'],
    ['ines', 'Inès', '🐼'],
    ['marc', 'Marc', '🐶'],
    ['sofia', 'Sofia', '🐙'],
    ['nina', 'Nina', '🦉'],
    ['paul', 'Paul', '🐯'],
    ['ana', 'Ana', '🐨'],
  ]
  for (const [login, nom, avatar] of nouveaux) profils[login] = await inscrireProfil(banc.url, login, nom, avatar)
  for (const k of [1, 2]) await inscrireProfil(banc.url, `figurant${k}`, `Figurant ${k}`, '🐱')
  for (const login of ['lea', 'leaa', 'tom', 'zoe', 'hugo', 'ines', 'marc', 'sofia', 'paul', 'ana']) habitue(login)
  sonLoup('lea')
  sonLoup('tom')
  // Les autres habitués en ont déjà trouvé quatre : la jauge en dit autant, jamais lesquels.
  const caches = motsDeLaLegende(INVENTEE).flatMap((m, i) => (m.cache ? [i] : []))
  motsDeTous('figurant1', caches.filter((_, k) => k % 2 === 1))
  // Ce qui s'est écrit derrière le dos du serveur ne se lit qu'après son redémarrage : les mots de tous, en mémoire.
  await banc.redemarrer()

  // ── Léa : la visite entière, puis l'album, au petit téléphone puis au grand ──
  if (veut('lea')) {
    await reserve('32')
    await laVisite('lea', profils.lea, PETIT, enigme('32'))
    await laVisite('lea', profils.leaa, MOYEN, enigme('32'))
  }

  // ── Tom : « Plus tard », l'épingle sur l'accueil, rouverte, « Plus tard » dans l'énigme, reprise, et la langue au chat ──
  if (veut('tom')) {
    await reserve('211')
    const { ctx, page } = await telephone({ cookie: profils.tom, ecran: PETIT })
    await accueil(page)
    for (let i = 0; i < 6; i++) await replique(page, 'tom', null, PETIT)
    await choisir(page, 'tom', null, PETIT, 1)
    await replique(page, 'tom', 'plus-tard', PETIT)
    await page.waitForSelector('.sx-epingle', { timeout: 20000 })
    await page.waitForTimeout(800)
    await photo(page, 'tom', 'l-epingle', PETIT, { surAccueil: true })
    await ctx.close()
    // L'épingle reste jusqu'à la fin de son énigme : rouverte sur un autre téléphone, au grand écran, puis touchée.
    const autre = await telephone({ cookie: profils.tom, ecran: MOYEN })
    await accueil(autre.page)
    await autre.page.waitForSelector('.sx-epingle', { timeout: 20000 })
    await autre.page.waitForTimeout(800)
    await photo(autre.page, 'tom', 'l-epingle', MOYEN, { surAccueil: true })
    await autre.page.locator('.sx-epingle').tap()
    await choisir(autre.page, 'tom', 'rouverte', MOYEN, 0)
    await lEnigme(autre.page)
    await photo(autre.page, 'tom', 'l-enigme', MOYEN)
    // Une fausse, puis « Plus tard », l'énigme ouverte (le retour du propriétaire du 24 novembre 2026) : le Sphinx
    // s'épingle, et l'épingle rouvre la même énigme, son essai perdu compté. Une réponse qu'aucune énigme n'attend.
    await repondre(autre.page, 'xylophone')
    await quandIlADit(autre.page, 'Encore deux essais')
    await autre.page.locator('.sx-plus-tard').tap()
    await quandIlADit(autre.page, 'Prends ton temps')
    await replique(autre.page, 'tom', 'plus-tard-dans-l-enigme', MOYEN)
    await autre.page.waitForSelector('.sx-epingle', { timeout: 20000 })
    await autre.page.waitForTimeout(800)
    await photo(autre.page, 'tom', 'l-epingle-apres-l-enigme', MOYEN, { surAccueil: true })
    await autre.page.locator('.sx-epingle').tap()
    await choisir(autre.page, 'tom', 'te-revoila', MOYEN, 0)
    await lEnigme(autre.page)
    const essais = await autre.page.locator('.sx-essais').getAttribute('aria-label')
    if (essais !== '2 essais restants') ratees.push(`tom : l’énigme reprise dit « ${essais} », pas « 2 essais restants »`)
    await photo(autre.page, 'tom', 'l-enigme-reprise', MOYEN)
    await autre.page.locator('.sx-chat').tap()
    await enAttente(autre.page)
    await autre.page.waitForTimeout(300)
    await photo(autre.page, 'tom', 'langue-au-chat', MOYEN)
    await toucherLaBoite(autre.page)
    await replique(autre.page, 'tom', 'un-autre-jour', MOYEN)
    await autre.page.waitForTimeout(1500)
    await photo(autre.page, 'tom', 'parti', MOYEN, { surAccueil: true })
    await autre.ctx.close()
  }

  // ── Zoé : trois essais perdus ──
  if (veut('zoe')) {
    await reserve('146')
    const { ctx, page } = await telephone({ cookie: profils.zoe, ecran: PETIT })
    await accueil(page)
    for (let i = 0; i < 6; i++) await replique(page, 'zoe', null, PETIT)
    await choisir(page, 'zoe', null, PETIT, 0)
    await lEnigme(page)
    for (const [k, mot] of ['la pluie', 'le vent', 'la mer'].entries()) {
      await repondre(page, mot)
      await quandIlADit(page, k === 0 ? 'Encore deux essais' : k === 1 ? 'Plus qu’un essai' : 'Le sable se referme')
    }
    await enAttente(page)
    await page.waitForTimeout(300)
    await photo(page, 'zoe', 'trois-essais-perdus', PETIT)
    await ctx.close()
  }

  // ── Sofia : une soirée l'attend — le Sphinx ne surgit pas, il s'épingle ──
  if (veut('sofia')) {
    await reserve('146')
    const { ctx, page } = await telephone({ cookie: profils.sofia, ecran: PETIT, soiree: true })
    await accueil(page)
    await page.waitForSelector('.sx-epingle', { timeout: 20000 })
    await page.waitForTimeout(2400)
    const surgi = await page.locator('.sx-scene').count()
    if (surgi) ratees.push('sofia : le Sphinx a surgi par-dessus « Revenir chez Hugo »')
    await photo(page, 'sofia', 'soiree-en-cours', PETIT, { surAccueil: true })
    await ctx.close()
  }

  // ── Hugo : moins de mouvement — le texte d'un coup, ni mosaïque, ni sable, ni secousse ──
  if (veut('calme')) {
    await reserve('32')
    const { ctx, page } = await telephone({ cookie: profils.hugo, ecran: PETIT, calme: true })
    await accueil(page)
    await page.waitForSelector('.sx-boite.sx-boite-la', { timeout: 30000 })
    await page.waitForTimeout(400)
    await photo(page, 'calme', 'arrivee', PETIT)
    await replique(page, 'calme', null, PETIT)
    await replique(page, 'calme', 'je-suis', PETIT)
    for (let i = 0; i < 4; i++) await replique(page, 'calme', null, PETIT)
    await choisir(page, 'calme', 'le-menu', PETIT, 0)
    await lEnigme(page)
    await photo(page, 'calme', 'l-enigme', PETIT)
    await ctx.close()
  }

  // ── Inès, sous l'Ivoire : la boîte garde sa nuit et son or ; puis son épingle sur l'accueil clair ──
  if (veut('ivoire')) {
    await reserve('211')
    const r = await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, profils.ines, 'PUT')
    if (!r.ok) throw new Error(`l’Ivoire ne se porte pas (${r.status})`)
    const { ctx, page } = await telephone({ cookie: profils.ines, ecran: MOYEN })
    await accueil(page)
    await replique(page, 'ivoire', 'psst', MOYEN)
    await replique(page, 'ivoire', null, MOYEN)
    await page.waitForTimeout(900)
    await replique(page, 'ivoire', 'vitrine', MOYEN)
    for (let i = 0; i < 3; i++) await replique(page, 'ivoire', null, MOYEN)
    await choisir(page, 'ivoire', 'le-menu', MOYEN, 0)
    await lEnigme(page)
    await photo(page, 'ivoire', 'l-enigme', MOYEN)
    await page.keyboard.press('Escape')
    await page.waitForSelector('.sx-epingle', { timeout: 20000 })
    await page.waitForTimeout(800)
    await photo(page, 'ivoire', 'l-epingle', MOYEN, { surAccueil: true })
    await ctx.close()
  }

  // ── Marc : le texte agrandi à 130 % ──
  if (veut('agrandi')) {
    await reserve('146')
    const { ctx, page } = await telephone({ cookie: profils.marc, ecran: PETIT, texte: 130 })
    await accueil(page)
    await replique(page, 'agrandi', 'psst', PETIT)
    await replique(page, 'agrandi', 'je-suis', PETIT)
    await page.waitForTimeout(900)
    await replique(page, 'agrandi', 'vitrine', PETIT)
    for (let i = 0; i < 2; i++) await replique(page, 'agrandi', null, PETIT)
    await replique(page, 'agrandi', 'le-divin-du-moment', PETIT)
    await choisir(page, 'agrandi', 'le-menu', PETIT, 0)
    await lEnigme(page)
    await photo(page, 'agrandi', 'l-enigme', PETIT)
    await repondre(page, 'la pluie')
    await quandIlADit(page, 'Le sable a bougé')
    await photo(page, 'agrandi', 'une-fausse', PETIT)
    await page.locator('.sx-chat').tap()
    await enAttente(page)
    await page.waitForTimeout(300)
    await photo(page, 'agrandi', 'langue-au-chat', PETIT)
    await ctx.close()
  }

  // ── Nina, qui n'est pas une habituée : l'album lui montre la phrase, et comment le devenir ──
  const lAlbum = async (cas: string, cookie: string, ecran: Ecran, divin: string) => {
    const { ctx, page } = await telephone({ cookie, ecran })
    await page.goto(`${banc.url}/profil#collection-avatars-divin`)
    await page.waitForSelector('.album-divins', { timeout: 30000 })
    await page.waitForTimeout(800)
    await page.locator(`.album-case[aria-label^="${divin}"]`).first().tap()
    await page.waitForSelector('.album-phrase', { timeout: 20000 })
    await page.locator('.album-phrase').scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    await photo(page, cas, 'l-album', ecran)
    await ctx.close()
  }
  if (veut('nina')) await lAlbum('nina', profils.nina, PETIT, 'Osiris')

  // ── Nina inscrit les mots des autres (le premier retour de la production, le 24 novembre 2026 : « Je vois nulle part
  // où rentrer le mot des autres ») : qui en a, un trait touché, un faux, puis celui que Figurant 1 lui a dit ──
  if (veut('inscrire')) {
    // Une copie : la phrase reconstituée, plus bas, relit `caches` entier.
    const aDire = [...caches]
    for (const ecran of [PETIT, MOYEN]) {
      const { ctx, page } = await telephone({ cookie: profils.nina, ecran })
      await page.goto(`${banc.url}/profil#collection-avatars-divin`)
      await page.waitForSelector('.album-divins', { timeout: 30000 })
      await page.waitForTimeout(800)
      await page.locator('.album-case[aria-label^="Osiris"]').first().tap()
      await page.waitForSelector('.phrase-qui', { timeout: 20000 })
      await page.locator('.phrase-divin').scrollIntoViewIfNeeded()
      await page.waitForTimeout(600)
      await photo(page, 'inscrire', 'qui-a-des-mots', ecran)
      // Chaque trait se touche sur 44 px de haut, sans grandir, et sa cible ne déborde pas sur une autre.
      const mal = (await page.evaluate(() => {
        const d = (globalThis as any).document
        return [...d.querySelectorAll('.phrase-a-inscrire')].flatMap((b: any) => {
          const r = b.getBoundingClientRect()
          const x = r.left + r.width / 2
          return [r.top + r.height / 2 - 21, r.top + r.height / 2 + 21].flatMap(y => (d.elementFromPoint(x, y)?.closest('.phrase-a-inscrire') === b ? [] : [`trait ${b.dataset.i} à ${Math.round(y - r.top)} px`]))
        })
      })) as string[]
      for (const m of mal) ratees.push(`inscrire ${ecran.join('×')} : cible courte, ${m}`)
      // Le second mot caché, que Figurant 1 a trouvé : faux d'abord, puis juste.
      const place = aDire[1]
      await page.locator(`.phrase-a-inscrire[data-i="${place}"]`).tap()
      await page.waitForSelector('#phrase-inscrire-mot', { timeout: 10000 })
      await page.locator('.phrase-inscrire').scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)
      await photo(page, 'inscrire', 'le-champ', ecran)
      await page.locator('#phrase-inscrire-mot').fill('tempête')
      await page.locator('.phrase-inscrire button[type="submit"]').tap()
      await page.waitForFunction(() => ((globalThis as any).document.querySelector('.phrase-inscrire-dit')?.textContent ?? '').includes('pas ce mot'), null, { timeout: 10000 })
      await photo(page, 'inscrire', 'un-faux', ecran)
      await page.locator('#phrase-inscrire-mot').fill(motsDeLaLegende(INVENTEE)[place].texte.toUpperCase())
      await page.locator('.phrase-inscrire button[type="submit"]').tap()
      await page.waitForSelector(`.phrase-appris[data-i="${place}"]`, { timeout: 10000 })
      await page.waitForTimeout(1500)
      await photo(page, 'inscrire', 'appris', ecran)
      await ctx.close()
      // Le même mot ne s'inscrit qu'une fois : au second téléphone, il est déjà là ; on recommence sur le suivant.
      aDire.splice(1, 2)
    }
  }

  // ── Paul : un problème, une visite sur cinq (le 25 novembre 2026) — le passeur de la maquette, que tout le monde
  // connaît : son récit, un nombre faux, le juste, son mot, puis la solution pas à pas ──
  if (veut('probleme')) {
    await banc.redemarrer({ reglages: { enigmesDuSphinx: [PASSEUR] } })
    const cas = 'probleme'
    const { ctx, page } = await telephone({ cookie: profils.paul, ecran: PETIT })
    await accueil(page)
    for (let i = 0; i < 6; i++) await replique(page, cas, null, PETIT)
    await choisir(page, cas, null, PETIT, 0)
    await leProbleme(page)
    await photo(page, cas, 'le-probleme', PETIT)
    await repondre(page, '5')
    await quandIlADit(page, 'Le sable a bougé')
    await photo(page, cas, 'un-nombre-faux', PETIT)
    await repondre(page, '7')
    await quandIlADit(page, 'Exact')
    await page.waitForFunction(() => !!(globalThis as any).document.querySelector('.sx-focus .phrase-sien'), null, { timeout: 20000 })
    await replique(page, cas, 'son-mot', PETIT)
    await choisir(page, cas, 'voir-la-solution', PETIT, 0)
    const etapes = PASSEUR.probleme!.explication.length
    for (let i = 1; i <= etapes; i++) await replique(page, cas, i === 1 || i === 4 || i === etapes ? `la-solution-${i}` : null, PETIT)
    await replique(page, cas, 'apres-la-solution', PETIT)
    await ctx.close()
  }

  // ── Ana : le même, à choisir — une mauvaise carte, d'un seul toucher, puis la solution, toujours ──
  if (veut('probleme-choix')) {
    await banc.redemarrer({ reglages: { enigmesDuSphinx: [PASSEUR_A_CHOISIR] } })
    const cas = 'probleme-choix'
    const { ctx, page } = await telephone({ cookie: profils.ana, ecran: MOYEN })
    await accueil(page)
    for (let i = 0; i < 6; i++) await replique(page, cas, null, MOYEN)
    await choisir(page, cas, null, MOYEN, 0)
    await leProbleme(page)
    await photo(page, cas, 'le-probleme', MOYEN)
    await page.locator('.sx-propositions button').nth(0).tap()
    await quandIlADit(page, 'Le sable se referme')
    await photo(page, cas, 'une-mauvaise-carte', MOYEN)
    await replique(page, cas, null, MOYEN)
    await replique(page, cas, 'regarde', MOYEN)
    for (let i = 1; i <= PASSEUR.probleme!.explication.length; i++) await replique(page, cas, i === 2 ? 'la-solution-2' : null, MOYEN)
    await replique(page, cas, 'un-autre-jour', MOYEN)
    await ctx.close()
  }

  // ── Une phrase reconstituée par tous : entière sous son voile, et le Sphinx passe au Divin suivant ──
  // Elle ne s'impose plus (la décision du 24 novembre 2026) : Marc trouve le dernier mot, et le Sphinx lui propose de la
  // lire ; Nina la voit annoncée sur son accueil, puis sa fiche, « La phrase est retrouvée : la lire », et ses mots qui se
  // retournent ; Inès, l'annonce en 390 × 844.
  if (veut('reconstituee')) {
    // Tous les mots qui manquent encore, sauf un, que Marc trouvera. Lus en base : les cas d'avant ont gagné des mots
    // tirés de la graine de leur profil, neuve à chaque lancement — en laisser un d'office (le premier), c'était, une
    // fois sur quelques-unes, laisser un mot déjà trouvé : la phrase était entière avant lui, et son menu ne venait pas.
    const trouves = new Set(
      (() => {
        const d = db()
        try {
          return (d.prepare('SELECT mot FROM profile_sphinx WHERE divin = ? AND mot IS NOT NULL').all(ORDRE_DU_SPHINX[0]) as { mot: number }[]).map(r => r.mot)
        } finally {
          d.close()
        }
      })(),
    )
    const manquent = caches.filter(i => !trouves.has(i))
    if (manquent.length < 2) throw new Error(`la phrase inventée n’a plus que ${manquent.length} mot(s) à trouver : Marc ne peut pas trouver le dernier`)
    motsDeTous('figurant2', manquent.slice(1))
    // Le lendemain : un seul mot neuf par jour à tout le serveur (`MOTS_NEUFS_PAR_JOUR`), et Léa a eu celui d'aujourd'hui —
    // Marc n'aurait reçu qu'un mot déjà trouvé, et la phrase ne se serait pas reconstituée sous ses yeux.
    horloge.t += 24 * 3_600_000
    // Marc, venu pour l'occasion : sa première visite, quoi que les autres cas aient joué aujourd'hui.
    const marc = await inscrireProfil(banc.url, 'marc2', 'Marc', '🐶')
    habitue('marc2')
    await reserve('32')
    {
      const cas = 'reconstituee'
      const { ctx, page } = await telephone({ cookie: marc, ecran: PETIT })
      await accueil(page)
      await page.waitForSelector('.sx-boite.sx-boite-la', { timeout: 30000 })
      for (let i = 0; i < 6; i++) await replique(page, cas, null, PETIT)
      await choisir(page, cas, null, PETIT, 0)
      await lEnigme(page)
      await repondre(page, reponses(enigme('32')).juste)
      await quandIlADit(page, 'Exact')
      await page.waitForFunction(() => !!(globalThis as any).document.querySelector('.sx-focus .phrase-sien'), null, { timeout: 15000 })
      await replique(page, cas, 'le-dernier-mot', PETIT)
      await choisir(page, cas, 'la-lire-ou-pas', PETIT, 0)
      await quandIlADit(page, 'La voici')
      await page.waitForTimeout(800)
      await photo(page, cas, 'la-voici', PETIT)
      await ctx.close()
    }
    for (const [qui, ecran] of [
      ['nina', PETIT],
      ['ines', MOYEN],
    ] as const) {
      const cas = `annonce-${qui}`
      const { ctx, page } = await telephone({ cookie: profils[qui], ecran })
      await accueil(page)
      await page.waitForSelector('.annonce-phrase', { timeout: 20000 })
      await page.waitForTimeout(600)
      await photo(page, cas, 'l-accueil', ecran, { surAccueil: true })
      if (qui === 'nina') {
        // « La voir » : la fiche du Divin s'ouvre dans l'album, le choix l'y attend.
        await page.locator('.annonce-phrase-ligne').tap()
        await page.waitForURL(/\/profil#collection-avatars-divin/, { timeout: 20000 })
        await page.waitForSelector('.album-phrase-lire', { timeout: 20000 })
        await page.locator('.album-phrase').scrollIntoViewIfNeeded()
        await page.waitForTimeout(800)
        await photo(page, cas, 'la-fiche', ecran)
        await page.locator('.album-phrase-lire').tap()
        await page.waitForSelector('.dialog', { timeout: 20000 })
        await photo(page, cas, 'la-lire', ecran)
        await page.locator('.dialog button[type="submit"]').tap()
        await page.waitForSelector('.album-phrase .phrase-neuf', { timeout: 20000 })
        await page.waitForTimeout(1600)
        await photo(page, cas, 'lue', ecran)
      }
      await ctx.close()
    }
  }

  writeFileSync(path.join(sortie, 'mesures.json'), JSON.stringify(rapport, null, 2))
  console.log(`\n${n} photos et leurs mesures dans ${sortie}`)
  if (ratees.length) {
    console.log(`\n${ratees.length} chose(s) qui cassent :\n${ratees.map(r => '  - ' + r).join('\n')}`)
    // Par le code de sortie de Node, pas `process.exit()` : ce qui vient de s'écrire part d'abord (règle `tests.md`).
    process.exitCode = 1
  }
} finally {
  await navigateur.close()
  await banc.close()
}
