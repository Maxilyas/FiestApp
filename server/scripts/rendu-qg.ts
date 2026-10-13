// Le QG de l'administrateur (`/admin`), photographié sur un serveur jetable :
// trente jours d'activité inventée — parties du quiz du jour, séries de la
// campagne, duels, soirées archivées —, une vraie soirée en cours avec deux
// invités, une autre laissée en plan, deux signalements d'une question du
// jour ; au téléphone
// (360 × 640, la page entière), en 1366 × 768 et en 1920 × 1080, sous le
// Velours et sous l'Ivoire, puis une page ouverte de la barre de côté. Le
// client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-qg.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, creerQuiz, demarrer, ecranCommun, ecrire, inscrireProfil, invite, lancerQuiz, qcm } from '../test/banc'
import { jourDe } from '../../shared/jour'
import { minuitsDeParis } from '../../shared/qg'

const sortie = path.resolve(process.argv[2] ?? 'rendu-qg')
mkdirSync(sortie, { recursive: true })
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

const H = 3_600_000
const banc = await demarrer({ baseDeLaCampagne: baseDEssai(40) })
const navigateur = await chromium.launch({ headless: true })
try {
  const admin = await connexionAnimateur(banc.url)

  // Une soirée en cours chez l'administrateur : deux invités, un quiz lancé.
  const quiz = await creerQuiz(banc.url, admin, [qcm('Quelle est la capitale de l’Australie ?', ['Sydney', 'Canberra', 'Melbourne'], 1)], 'Le quiz du banc')
  const host = await ecranCommun(banc.url, admin)
  await invite(banc.url, 'Zoé', '🦊')
  await invite(banc.url, 'Gaspard', '🐙')
  await lancerQuiz(host, quiz)

  // Une soirée laissée en plan dans le salon de Tom : trois invités arrivés il y a huit heures, partis depuis.
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🦉')
  await ecrire(banc.url, '/api/joueur/espace', {}, tom)
  const espaces = (await (await fetch(`${banc.url}/api/admin/espaces`, { headers: { Cookie: admin } })).json()) as { id: string; slug: string; titulaire: { nom: string } | null }[]
  const salonDeTom = espaces.find(e => e.titulaire?.nom === 'Tom')!
  for (const [nom, avatar] of [['Inès', '🐼'], ['Malo', '🐯'], ['Jade', '🐨']]) (await invite(banc.url, nom, avatar, { slug: salonDeTom.slug })).socket.disconnect()
  {
    const locale = new Database(banc.dbPath)
    locale.prepare('UPDATE players SET created_at = created_at - ? WHERE space_id = ?').run(8 * H, salonDeTom.id)
    locale.close()
  }
  // Léa commence le quiz du jour : son tirage existe, ses questions se signalent.
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  await ecrire(banc.url, '/api/jour/commencer', {}, lea)

  // Trente jours d'activité, écrits dans la base permanente : chaque jour son
  // lot, plus fourni le week-end, aujourd'hui jusqu'à l'heure qu'il est.
  const maintenant = Date.now()
  const minuits = minuitsDeParis(maintenant, 30)
  const permanente = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  {
    const partie = permanente.prepare('INSERT INTO jour_parties (profile_id, jour, commencee_le, question) VALUES (?, ?, ?, 10)')
    const serie = permanente.prepare("INSERT INTO campagne_series (id, profile_id, questions, position, vies, commencee_le, mode) VALUES (?, ?, '[]', 0, 3, ?, ?)")
    const soiree = permanente.prepare("INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, 'Une soirée', ?, ?, ?, '{}')")
    const signalement = permanente.prepare('INSERT INTO jour_signalements (jour, question, profile_id, texte, cree_le, traite_le) VALUES (?, ?, ?, ?, ?, NULL)')
    let n = 0
    minuits.forEach((minuit, d) => {
      const weekEnd = [0, 5, 6].includes(new Date(minuit + 12 * H).getUTCDay())
      const vague = 1 + 0.25 * Math.sin(d / 3) + (weekEnd ? 0.2 : 0)
      const a = (k: number, total: number) => minuit + 7 * H + Math.floor((k / total) * 16 * H)
      const jours = Math.round(90 * vague)
      for (let k = 0; k < jours; k++) if (a(k, jours) <= maintenant) partie.run(`p-${k}`, jourDe(minuit + 12 * H), a(k, jours))
      const series = Math.round(120 * vague)
      for (let k = 0; k < series; k++) {
        const quand = a(k, series)
        const mode = k % 4 === 0 ? 'duel' : k % 9 === 0 ? 'rencontre' : k % 5 === 0 ? 'sentier' : 'serie'
        if (quand <= maintenant) serie.run(`s-${n++}`, `p-${(k * 7) % 80}`, quand, mode)
      }
      if (weekEnd && d < minuits.length - 1) {
        const joueurs = 8 + (d % 5) * 3
        const fiche = { v: 3, invites: Array.from({ length: joueurs }, (_, i) => ({ id: `i-${i}`, joue: true })) }
        soiree.run('banc-archive', `soiree-${d}`, minuit + 21 * H, minuit + 23 * H, JSON.stringify(fiche))
      }
    })
    signalement.run(jourDe(maintenant), 2, 'p-1', 'Deux bonnes réponses ?', maintenant)
    signalement.run(jourDe(maintenant), 2, 'p-2', 'Canberra, pas Sydney', maintenant)
  }
  permanente.close()

  const photographier = async (nom: string, largeur: number, hauteur: number, { pleine = true, theme, adresse = '/admin' }: { pleine?: boolean; theme?: string; adresse?: string } = {}) => {
    const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: largeur < 600 ? 2 : 1 })
    const [cle, valeur] = admin.split('=')
    await contexte.addCookies([{ name: cle, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}${adresse}`)
    await page.waitForSelector('.qg-tete')
    if (adresse === '/admin') await page.waitForSelector('.qg-graphe svg, .qg-participations .muted', { timeout: 15000 })
    if (theme) await page.evaluate(`document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)})`)
    await page.waitForTimeout(800)
    // Rien ne dépasse en largeur : la page ne défile qu'en hauteur.
    const deborde = (await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')) as number
    if (deborde > 0) console.error(`[${nom}] la page déborde de ${deborde} px en largeur`)
    await page.screenshot({ path: path.join(sortie, `${nom}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nom}.png`))
    await contexte.close()
  }

  await photographier('1-telephone', 360, 640)
  await photographier('2-ordinateur-1366', 1366, 768)
  await photographier('3-ordinateur-1920', 1920, 1080)
  await photographier('4-ordinateur-ivoire', 1366, 768, { theme: 'ivoire' })
  await photographier('5-telephone-ivoire', 360, 640, { theme: 'ivoire' })
  await photographier('6-page-du-jour', 1366, 768, { adresse: '/admin#jour', pleine: false })
  host.disconnect()
} finally {
  await navigateur.close()
  await banc.close()
}
