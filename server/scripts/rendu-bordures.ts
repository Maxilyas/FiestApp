// Les bordures de ligue dans l'application, photographiées au téléphone
// (360 × 640) sur un serveur jetable : sa ligne en tête du profil, la loge et
// sa rangée « Bordure » — une autre essayée sur sa carte —, le classement des
// duels où chacun porte la sienne, la carte d'un maître et son avatar en
// grand. Six joueurs, chacun ses duels écrits au journal et sa finition, du
// bronze aux maîtres. Le client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-bordures.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil } from '../test/banc'
import { VERSION_BAREME } from '../src/auth/profiles'
import { xpDuNiveau } from '../../shared/profil'
import { VIES } from '../../shared/campagne'
import { LIGUES, ligueDe, releverLesDuels, type CleDeLigue, type DuelJoue } from '../../shared/duels'

const sortie = path.resolve(process.argv[2] ?? 'rendu-bordures')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

/**
 * Des duels qui mènent à sa ligue, puis `crans` victoires de plus dedans :
 * gagnés contre de gros scores pour monter, contre de petits pour y rester.
 * Le journal les relira comme ils ont été pensés (`releverLesDuels`).
 */
function duelsJusqua(ligue: CleDeLigue, crans: number): { justes: number; sesJustes: number }[] {
  type Duel = { justes: number; sesJustes: number }
  const duels: Duel[] = []
  const releveAvec = (encore: Duel[] = []) =>
    releverLesDuels([...duels, ...encore].map((d, i): DuelJoue => ({ serie: String(i).padStart(4, '0'), finiLe: i, ...d })), () => 's')
  const cible = LIGUES.findIndex(l => l.cle === ligue)
  while (LIGUES.indexOf(ligueDe(releveAvec().cote)) < cible) duels.push({ justes: 20, sesJustes: 19 })
  const ici = () => releveAvec().bordures.find(b => b.ligue === ligue)?.crans ?? 0
  for (let garde = 0; ici() < crans && garde < 200; garde++) {
    // La victoire la plus douce qui le garde dans sa ligue : contre un petit score, puis un plus petit encore.
    const doux: Duel[] = [
      { justes: 9, sesJustes: 8 },
      { justes: 3, sesJustes: 0 },
    ]
    duels.push(doux.find(d => ligueDe(releveAvec([d]).cote).cle === ligue) ?? doux[1])
  }
  return duels
}

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
try {
  const joueurs = [
    { login: 'lea', nom: 'Léa', avatar: '🦊', niveau: 14, ligue: 'or', crans: 7 },
    { login: 'tom', nom: 'Tom', avatar: '🐻', niveau: 26, ligue: 'maitre', crans: 12 },
    { login: 'ines', nom: 'Inès', avatar: '🦉', niveau: 16, ligue: 'diamant', crans: 5 },
    { login: 'hugo', nom: 'Hugo', avatar: '🐯', niveau: 21, ligue: 'platine', crans: 9 },
    { login: 'malik', nom: 'Malik', avatar: '🐼', niveau: 4, ligue: 'argent', crans: 12 },
    { login: 'nina', nom: 'Nina', avatar: '🐸', niveau: 0, ligue: 'bronze', crans: 3 },
  ] as const
  const cookies: Record<string, string> = {}
  for (const j of joueurs) cookies[j.login] = await inscrireProfil(banc.url, j.login, j.nom, j.avatar)
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const maintenant = Date.now()
  for (const j of joueurs) {
    const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get(j.login) as { id: string }).id
    // Son niveau, pour sa finition.
    if (j.niveau > 0) {
      db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#jour', '', ?, ?, 1)`).run(
        id,
        xpDuNiveau(j.niveau),
        JSON.stringify({ v: VERSION_BAREME, jours: 1 }),
      )
      db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xpDuNiveau(j.niveau), id)
    }
    // Ses duels, ces derniers jours.
    const duels = duelsJusqua(j.ligue, j.crans)
    duels.forEach((d, i) => {
      const quand = maintenant - (duels.length - i) * 20 * 60_000
      const adversaire = { serie: randomUUID(), profil: randomUUID(), reponses: [...Array(d.sesJustes).fill(true), ...Array(VIES).fill(false)] }
      db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
         VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
      ).run(randomUUID(), id, d.justes + VIES, d.justes, quand - 60_000, quand, JSON.stringify(adversaire))
    })
  }
  db.close()
  await banc.redemarrer()
  // Hugo montre la bordure de l'argent, pleine, plutôt que le platine qu'il remplit ; Nina n'en veut aucune.
  await ecrire(banc.url, '/api/joueur/moi', { bordure: 'argent' }, cookies.hugo, 'PUT')
  await ecrire(banc.url, '/api/joueur/moi', { bordure: 'aucune' }, cookies.nina, 'PUT')

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const [nom, valeur] = cookies.lea.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  const photo = async (nomFichier: string, pleine = false) => {
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(sortie, `${nomFichier}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nomFichier}.png`))
  }

  // L'accueil et le profil : sa ligne en tête, sa bordure autour de son avatar.
  await page.goto(`${banc.url}/`)
  await page.waitForSelector('.identite-ligne .av-bordure')
  await photo('1-accueil')
  await page.goto(`${banc.url}/profil`)
  await page.waitForSelector('.identite-ligne .av-bordure')
  await photo('2-profil')

  // La loge : la rangée « Bordure » sous la finition ; une autre essayée sur sa carte.
  await page.goto(`${banc.url}/profil#avatar`)
  await page.waitForSelector('.loge-bordures .bordure-choix')
  await photo('3-loge')
  await page.locator('.loge-bordures').scrollIntoViewIfNeeded()
  await photo('3-loge-rangee')
  await page.locator('.bordure-choix', { hasText: 'Argent' }).click()
  await page.waitForSelector('.loge-barre')
  await photo('3-loge-essai')

  // Le classement des duels : chacun sa bordure.
  await page.goto(`${banc.url}/duels`)
  await page.getByRole('button', { name: 'Voir le classement' }).click()
  await page.waitForSelector('.duels-ligne .av-bordure')
  await photo('4-classement')
  await photo('4-classement-pleine', true)
  // La carte du maître, et son avatar en grand.
  await page.locator('.duels-ligne', { hasText: 'Tom' }).click()
  await page.waitForSelector('.carte-joueur .carte-tete .av-bordure')
  await photo('5-carte')
  await page.click('.carte-avatar-bouton')
  await page.waitForSelector('.carte-loupe .av-bordure')
  await photo('5-carte-en-grand')
} finally {
  await navigateur.close()
  await banc.close()
}
