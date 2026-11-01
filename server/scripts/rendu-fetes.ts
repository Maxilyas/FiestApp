// Les fêtes et le carnet des fêtes, photographiés au téléphone (360 × 640)
// sur un serveur jetable, l'horloge du quiz du jour posée à Pâques 2027 : la
// tuile de l'accueil qui annonce le timbre, la carte de la fête au quiz du
// jour, la fin de la partie qui ouvre L'Œuf d'or, son timbre et sa gerbe,
// le carnet des fêtes — l'année en cours, puis 2026, Halloween gagné et Noël
// manqué —, la page légendaire de l'album et les gerbes de la collection ;
// puis Pâques 2028, le légendaire déjà à elle : la carte du jour ne dit plus
// que le timbre de l'année. Le client construit d'abord
// (`npm run build -w client`).
//
//   [THEME=ivoire] npx tsx scripts/rendu-fetes.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil } from '../test/banc'
import { ProfileStore } from '../src/auth/profiles'

const sortie = path.resolve(process.argv[2] ?? 'rendu-fetes')
mkdirSync(sortie, { recursive: true })
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

// Le samedi saint 2027, 10 h à Paris (l'heure d'hiver court jusqu'au 28 mars) ; l'heure avance pour de vrai ensuite.
const horloge = { t: Date.UTC(2027, 2, 27, 9) }
const depart = Date.now()
const banc = await demarrer({ horlogeDuJour: () => horloge.t + (Date.now() - depart) })
const navigateur = await chromium.launch({ headless: true })
// Un Éclat tombé ferait une carte de plus à la fin : on regarde la fête.
ProfileStore.tirageEclat = () => false
try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  if (process.env.THEME) await ecrire(banc.url, '/api/joueur/moi', { theme: process.env.THEME }, lea, 'PUT')
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id
  const unJourJoue = db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 0, 0, 1, 0)`)
  // Halloween 2026 joué et gagné — sa saison et son timbre, sous le jour qui l'a ouverte —, Noël 2026 manqué ; et le vendredi saint d'hier.
  for (const jour of ['2026-10-26', '2026-10-27', '2026-10-28', '2027-03-26']) unJourJoue.run(id, jour)
  const ranger = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#jour:2026-10-28', '', '🎃', ?, 1)`)
  ranger.run(id, 'saison:halloween', 'Saison : Halloween')
  ranger.run(id, 'timbre:halloween:2026', 'Timbre : Halloween 2026')
  db.close()
  // Ce qui vient d'être écrit derrière le dos du serveur ne se lit qu'après son réveil.
  await banc.redemarrer()

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const [nom, valeur] = lea.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  const photo = async (n: string, pleine = false) => {
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(sortie, `${n}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${n}.png`))
  }
  /** Ce qui élargit la page : une fête trop longue sur une tuile, un timbre trop large. */
  const deborde = async (n: string) => {
    const large = await page.evaluate('document.documentElement.scrollWidth > window.innerWidth')
    if (large) console.log(`[déborde] ${n}`)
  }

  /** Une partie du jour, chaque question à sa première réponse, jusqu'à sa fin. */
  const jouer = async () => {
    await page.locator('.jour-heros .btn-primary').click()
    for (let i = 0; i < 12; i++) {
      await page.waitForSelector('.ans-btn, .fin-tete', { timeout: 15000 })
      if (await page.locator('.fin-tete').count()) break
      // Rien dans la première demi-seconde d'un écran : on retouche jusqu'à ce que la réponse parte.
      for (let essai = 0; essai < 20 && !(await page.locator('.result-banner').count()); essai++) {
        await page.waitForTimeout(500)
        await page.locator('.ans-btn').first().click({ timeout: 2000 }).catch(() => {})
      }
      await page.waitForSelector('.result-banner')
      await page.waitForTimeout(650)
      await page.locator('.btn-primary.btn-big').click()
    }
    await page.waitForSelector('.fin-tete')
  }

  // 1. L'accueil pendant Pâques : la tuile du quiz du jour annonce le timbre.
  await page.goto(`${banc.url}/`)
  await page.waitForSelector('.gros-bouton')
  await photo('1-accueil')
  await deborde('accueil')

  // 2. Le quiz du jour : la carte de la fête, un jour sur deux.
  await page.goto(`${banc.url}/jour`)
  await page.waitForSelector('.jour-heros')
  await photo('2-jour', true)
  await deborde('jour')

  // 3. La partie jusqu'à sa fin : L'Œuf d'or, son timbre, sa gerbe à porter. Le légendaire et le timbre se photographient
  // à l'écran : la page entière, prise sans défiler, montre un médaillon pas encore décodé en disque irisé vide.
  await jouer()
  await photo('3-fin')
  await page.evaluate("document.querySelector('.timbre-tombe').scrollIntoView({ block: 'end' })")
  await page.waitForTimeout(1500)
  await photo('3-fin-legendaire-et-timbre')
  await photo('3-fin-entiere', true)
  await deborde('fin')

  // 4. Le carnet des fêtes : l'année en cours, Pâques tamponné ; puis 2026.
  await page.goto(`${banc.url}/profil#collection-timbres`)
  await page.waitForSelector('#collection-timbres.trophee-ouvert .timbres-grille')
  await page.locator('#collection-timbres').scrollIntoViewIfNeeded()
  await photo('4-carnet')
  await photo('4-carnet-entier', true)
  await deborde('carnet')
  await page.locator('#collection-timbres .timbres-annees button', { hasText: '2026' }).click()
  await photo('5-carnet-2026')

  // 6. L'album, sa page légendaire : L'Œuf d'or en couleur, les quatre autres fêtes en silhouette.
  await page.goto(`${banc.url}/profil#collection-avatars-legendaire`)
  await page.waitForSelector('#collection-avatars.trophee-ouvert')
  await page.click('.album-case[aria-label^="L’Œuf d’or"]')
  await page.waitForSelector('#fiche-avatar')
  await page.locator('#fiche-avatar').scrollIntoViewIfNeeded()
  await photo('6-album-oeuf')
  await page.click('.album-case[aria-label^="La Rose"]')
  await page.waitForSelector('#fiche-avatar')
  await page.locator('#fiche-avatar').scrollIntoViewIfNeeded()
  await photo('6-album-rose')

  // 7. Les gerbes de la collection : le printemps à elle, les sept autres fêtes éteintes.
  await page.goto(`${banc.url}/profil#collection-gerbes`)
  await page.waitForSelector('#collection-gerbes.trophee-ouvert')
  await page.locator('#collection-gerbes').scrollIntoViewIfNeeded()
  await photo('7-gerbes', true)

  // 8. Pâques 2028 (le 16 avril), le vendredi saint joué : le légendaire est à elle, la carte ne dit plus que le timbre.
  horloge.t = Date.UTC(2028, 3, 15, 8) - (Date.now() - depart)
  {
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    base.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2028-04-14', 1, 10, NULL, 0, 0, 1, 0)`).run(id)
    base.close()
  }
  await page.goto(`${banc.url}/jour`)
  await page.waitForSelector('.jour-heros')
  await photo('8-jour-2028', true)
  await deborde('jour 2028')
  await jouer()
  await photo('9-fin-2028', true)
} finally {
  await navigateur.close()
  await banc.close()
}
