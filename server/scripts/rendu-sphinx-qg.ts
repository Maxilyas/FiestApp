// Le Sphinx de l'accueil au QG (`/admin#sphinx`, l'étape 3 du plan du
// 24 novembre 2026), photographié sur un serveur jetable : trente jours de
// visites inventées par les vraies routes — dix habitués, chacun ses trois
// énigmes, résolues, perdues, données au chat, remises à plus tard, ouvertes
// aujourd'hui —, puis la page au téléphone (360 × 640) et en 1366 × 768 : le
// Divin du moment, l'audience, jour par jour, énigme par énigme, et « Voir la
// réponse » ouvert sur l'énigme n° 32, confirmé, puis sa réponse.
//
//   npm run build -w client
//   cd server && npx tsx scripts/rendu-sphinx-qg.ts ../export/sphinx-qg
//
// Ce que le propriétaire ne doit pas voir — il joue aussi : le banc ne pose que
// les trois énigmes de la maquette, qu'il a déjà vues (n° 32, 211 et 146,
// `enigmesDuSphinx`), lit une phrase inventée à la place de chaque légende
// (`phraseInventeeDuSphinx`), et seule l'énigme n° 32 s'ouvre — la seule dont
// la réponse se photographie. Rien ne s'écrit au journal : ni une solution, ni
// une réponse acceptée. Il sort en erreur si une page déborde de côté.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { ProfileStore } from '../src/auth/profiles'
import { enigmesDuSphinx, type Enigme } from '../src/core/sphinx'

const Database = createRequire(import.meta.url)('better-sqlite3')
const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.resolve(process.argv[2] ?? path.join(ici, '../../export/sphinx-qg'))
mkdirSync(sortie, { recursive: true })
ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

/** La phrase inventée de la maquette, à la place de chaque légende : elle ne dit la règle d'aucun Divin. */
const INVENTEE = 'Il descend sur qui défie le temps sans jamais perdre l’heure de son rendez-vous'
/** Les trois énigmes de la maquette, que le propriétaire a déjà vues : les seules que le banc pose. */
const DE_LA_MAQUETTE = ['32', '211', '146'] as const
const reserve: Enigme[] = DE_LA_MAQUETTE.map(n => {
  const e = enigmesDuSphinx().find(x => x.numero === n)
  if (!e) throw new Error(`l’énigme n° ${n} n’est plus dans la réserve`)
  return e
})

const JOUR_MS = 24 * 3_600_000
/** Aujourd'hui, 11 h à Paris. */
const AUJOURDHUI = Date.UTC(2026, 10, 24, 10, 0)
const horloge = { t: AUJOURDHUI }
const jourDe = (t: number) => new Date(t).toISOString().slice(0, 10)

const banc = await demarrer({
  horlogeDuJour: () => horloge.t,
  // Le Sphinx passe chez chaque habitué, chaque jour qu'il le peut : la chance d'une visite se vérifie ailleurs.
  tirageDuSphinx: () => 0,
  enigmesDuSphinx: reserve,
  phraseInventeeDuSphinx: INVENTEE,
})
const db = () => new Database(banc.quizDbUrl.replace(/^file:/, ''))
const idDe = (login: string): string => {
  const d = db()
  try {
    return (d.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
  } finally {
    d.close()
  }
}

/** Un habitué de toujours : chaque jour des trente-sept derniers joué au quiz du jour, écrit en base. */
function habitue(login: string) {
  const id = idDe(login)
  const d = db()
  try {
    const questions = JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 })))
    for (let i = 0; i <= 36; i++) {
      const jour = jourDe(AUJOURDHUI - i * JOUR_MS)
      d.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`).run(jour, questions)
      d.prepare(`INSERT OR IGNORE INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 900, 6, 2, 0)`).run(id, jour)
    }
  } finally {
    d.close()
  }
}

const admin = await connexionAnimateur(banc.url)
const ouvrir = await ecrire(banc.url, '/api/admin/maintenance/pages/sphinx', { etat: 'ouverte' }, admin, 'PUT')
if (ouvrir.status !== 200) throw new Error(`la page du Sphinx ne s’ouvre pas : ${ouvrir.status}`)

// ── Trente jours de visites, par les vraies routes ─────────────────────────

const JOUEURS = ['lea', 'tom', 'sofia', 'hugo', 'nina', 'marc', 'ines', 'paul', 'zoe', 'yanis']
const cookies = new Map<string, string>()
for (const login of JOUEURS) {
  cookies.set(login, await inscrireProfil(banc.url, login, login[0].toUpperCase() + login.slice(1), '🦊'))
  habitue(login)
}

/** Ce que devient sa visite : selon le joueur et son rang, résolue le plus souvent. */
const ISSUES = ['resolue', 'perdue', 'chat', 'resolue', 'plus-tard'] as const
const geste = (cookie: string, corps: unknown) => ecrire(banc.url, '/api/joueur/sphinx', corps, cookie).then(r => r.json() as Promise<any>)

for (let jour = 29; jour >= 0; jour--) {
  horloge.t = AUJOURDHUI - jour * JOUR_MS
  for (const [k, login] of JOUEURS.entries()) {
    // Chacun ses trois visites, étalées sur le mois, deux joueurs par jour au plus ; aujourd'hui, trois de plus.
    const rangs = [k * 2 + 1, k * 2 + 10, k * 2 + 21].map(r => 29 - (r % 30))
    const rang = rangs.indexOf(jour)
    const aujourdhui = jour === 0 && k < 3
    if (rang < 0 && !aujourdhui) continue
    const cookie = cookies.get(login)!
    const lu = (await (await fetch(`${banc.url}/api/joueur/sphinx`, { headers: { Cookie: cookie } })).json()) as any
    const visite = lu.visite
    if (!visite || visite.etat !== 'proposee') continue
    // Aujourd'hui : l'une attend encore, l'autre est remise à plus tard, la troisième résolue.
    const issue = aujourdhui ? (['proposee', 'plus-tard', 'resolue'] as const)[k] : ISSUES[(k + rang) % ISSUES.length]
    if (issue === 'proposee') continue
    if (issue === 'plus-tard') await geste(cookie, { geste: 'plus-tard' })
    else if (issue === 'chat') await geste(cookie, { geste: 'chat' })
    else if (issue === 'perdue') for (const faux of ['zzz un', 'zzz deux', 'zzz trois']) await geste(cookie, { geste: 'repondre', reponse: faux })
    else await geste(cookie, { geste: 'repondre', reponse: reserve.find(e => e.numero === visite.enigme.numero)!.solution })
  }
}
horloge.t = AUJOURDHUI

// Le compte d'administration tient le profil du propriétaire : au démarrage, ses énigmes connues comptent pour vues.
const proprio = await inscrireProfil(banc.url, 'proprio', 'Antoine', '🦉')
void proprio
habitue('proprio')
{
  const d = db()
  try {
    d.prepare(`UPDATE accounts SET profile_id = ? WHERE role = 'admin'`).run(idDe('proprio'))
  } finally {
    d.close()
  }
}
await banc.redemarrer()
{
  // Sauf l'énigme n° 32, rendue à ses énigmes à voir : à l'ordinateur, « Voir la réponse » dit ce que le geste lui retire ;
  // au téléphone, après lui, qu'elle ne lui coûte plus rien.
  const d = db()
  try {
    d.prepare(`DELETE FROM profile_sphinx WHERE profile_id = ? AND jour = 'vue:32'`).run(idDe('proprio'))
  } finally {
    d.close()
  }
}
const adminAvecProfil = await connexionAnimateur(banc.url)
// Ce matin, chacun passe sur son accueil : sa ligne des missions dit au Sphinx qu'il est un habitué.
for (const cookie of cookies.values()) await fetch(`${banc.url}/api/joueur/missions`, { headers: { Cookie: cookie } })

// ── Les photos ─────────────────────────────────────────────────────────────

const navigateur = await chromium.launch({ headless: true })
let n = 0
const ratees: string[] = []

type Ecran = { nom: string; w: number; h: number; telephone: boolean }
const ECRANS: Ecran[] = [
  { nom: 'ordinateur', w: 1366, h: 768, telephone: false },
  { nom: 'telephone', w: 360, h: 640, telephone: true },
]

async function photo(page: any, ecran: Ecran, quoi: string) {
  await page.waitForTimeout(250)
  const nom = `${String(++n).padStart(2, '0')}-${quoi}-${ecran.w}x${ecran.h}`
  await page.screenshot({ path: path.join(sortie, `${nom}.png`) })
  const large = (await page.evaluate('document.documentElement.scrollWidth - window.innerWidth')) as number
  if (large > 0) ratees.push(`${nom} : la page déborde en largeur de ${large} px`)
  console.log(`${nom}${large > 0 ? ` — déborde de ${large} px` : ''}`)
}

for (const ecran of ECRANS) {
  const ctx = await navigateur.newContext({
    viewport: { width: ecran.w, height: ecran.h },
    deviceScaleFactor: ecran.telephone ? 2 : 1,
    isMobile: ecran.telephone,
    hasTouch: ecran.telephone,
  })
  const [cle, valeur] = adminAvecProfil.split('=')
  await ctx.addCookies([{ name: cle, value: valeur, url: banc.url }])
  const page = await ctx.newPage()
  page.on('pageerror', (e: Error) => ratees.push(`erreur dans la page : ${e.message}`))
  await page.goto(`${banc.url}/admin#sphinx`)
  await page.waitForSelector('#sphinx-moment', { timeout: 30000 })
  await page.waitForTimeout(600)
  await photo(page, ecran, 'la-page')
  await page.locator('#sphinx-par-jour').scrollIntoViewIfNeeded()
  await photo(page, ecran, 'jour-par-jour')
  await page.locator('#sphinx-enigmes').scrollIntoViewIfNeeded()
  await photo(page, ecran, 'enigme-par-enigme')
  // La seule qui s'ouvre : l'énigme n° 32, celle de la maquette.
  const ligne = page.locator('.qg-sphinx-table .qg-jouee', { hasText: 'n° 32' })
  if (ecran.telephone) await ligne.tap()
  else await ligne.click()
  await page.waitForSelector('.qg-sphinx-vers', { timeout: 30000 })
  await photo(page, ecran, 'enigme-32')
  const voir = page.locator('.qg-sphinx-voir')
  if (ecran.telephone) await voir.tap()
  else await voir.click()
  await page.waitForSelector('.dialog', { timeout: 30000 })
  await photo(page, ecran, 'voir-la-reponse')
  await page.locator('.dialog button[type="submit"]').click()
  await page.waitForSelector('.qg-sphinx-reponse', { timeout: 30000 })
  await photo(page, ecran, 'sa-reponse')
  if (!ecran.telephone) {
    // Le rail : la page parmi les modes.
    await page.keyboard.press('Escape')
    await page.evaluate('window.scrollTo(0, 0)')
    await photo(page, ecran, 'le-rail')
  }
  await ctx.close()
}

await navigateur.close()
await banc.close()
if (ratees.length > 0) {
  console.error(ratees.join('\n'))
  process.exitCode = 1
}
console.log(`${n} photos dans ${sortie}`)
