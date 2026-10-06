// La page du profil, photographiée au téléphone (360 × 640) sur un serveur
// jetable : ses tuiles en deux groupes — « Me changer », « Me retrouver » —,
// chacun de ses écrans — « Mon avatar », « Ma carte », « Mon thème », « Ma
// collection », ses lignes dépliées, l'album des thèmes et la fiche de l'un
// d'eux —, et la boutique des thèmes, qui ne vend que ce qui s'achète.
// Une joueuse en route : un légendaire porté,
// des portraits, une gerbe, deux thèmes achetés. Le client construit d'abord
// (`npm run build -w client`).
//
//   npx tsx scripts/rendu-profil.ts [dossier] [ivoire]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { ADMIN, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { VERSION_BAREME } from '../src/auth/profiles'
import { xpDuNiveau } from '../../shared/profil'
import { hautFait, palierDe, titreDePalier } from '../../shared/hautsfaits'

const sortie = path.resolve(process.argv[2] ?? 'rendu-profil')
const ivoire = process.argv.includes('ivoire')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
try {
  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  // Léa en route : le niveau 14, le Phénix (son haut fait), la forêt au
  // cinquième palier et les mythologies au deuxième, deux thèmes achetés, le
  // Sans-Faute du quiz du jour (sa gerbe, la pluie d'étoiles).
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
  db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#jour', '', ?, ?, 1)`).run(
    id,
    xpDuNiveau(14),
    JSON.stringify({ v: VERSION_BAREME, jours: 1 }),
  )
  db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xpDuNiveau(14), id)
  // Chaque ligne d'étagère avec son emoji et son nom, comme une clôture les range : la vitrine les montre.
  const badge = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, 'une-soiree-d-avant', ?, ?, ?, 1)`)
  for (const cle of ['hf:phenix', 'hf:sans-faute:1', 'hf:oracle']) {
    const palier = palierDe(cle)
    const h = palier ? palier.hautFait : hautFait(cle)!
    badge.run(id, cle, espace, h.emoji, palier ? titreDePalier(palier.hautFait, palier.palier) : h.title)
  }
  for (const [branche, paliers] of [['foret', 5], ['mythes', 2]] as const) {
    db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, 1)').run(id, branche, paliers)
  }
  const achat = db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, 1)')
  for (const theme of ['neige', 'ocean']) achat.run(id, theme)
  db.close()
  await banc.redemarrer()
  await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:phenix', gerbe: 'etoiles', ...(ivoire && { theme: 'ivoire' }) }, cookie, 'PUT')

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const [nom, valeur] = cookie.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  const photo = async (nomFichier: string, pleine = false) => {
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(sortie, `${nomFichier}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nomFichier}.png`))
  }

  // Les tuiles : ce qu'on porte, trois par rangée, puis ce qu'on a.
  await page.goto(`${banc.url}/profil`)
  await page.waitForSelector('.tuiles-trois')
  await page.waitForSelector('.tuile-compte')
  await photo('1-tuiles')
  await photo('1-tuiles-pleine', true)

  // Chaque écran, ouvert de sa tuile ; la finition de « Mon avatar », dépliée.
  for (const [i, tuile, attente] of [
    [2, 'Mon avatar', '.famille-avatars'],
    [3, 'Ma carte', '.titres'],
    [4, 'Mon thème', '.mes-themes'],
    [5, 'Ma collection', '.collection'],
  ] as const) {
    await page.goto(`${banc.url}/profil`)
    await page.waitForSelector('.tuiles-trois')
    await page.click(`.tuile:has-text("${tuile}")`)
    await page.waitForSelector(attente)
    await photo(`${i}-${tuile.toLowerCase().replace(/ /g, '-')}`)
    await photo(`${i}-${tuile.toLowerCase().replace(/ /g, '-')}-pleine`, true)
  }
  await page.goto(`${banc.url}/profil#avatar`)
  await page.waitForSelector('.ma-finition')
  await page.click('.ma-finition button[aria-expanded]')
  await page.waitForSelector('#mes-finitions .finitions')
  await photo('2-mon-avatar-finition')

  // La collection, une ligne dépliée à la fois — par son adresse, comme le lien de « Mon thème ».
  for (const partie of ['themes', 'legendaires', 'savoir', 'fonds', 'gerbes', 'finitions', 'emojis']) {
    await page.goto(`${banc.url}/profil#collection-${partie}`)
    await page.waitForSelector(`#collection-${partie}.trophee-ouvert`)
    await photo(`6-collection-${partie}`)
  }
  // L'album des thèmes : toucher celui qui se gagne ouvre sa fiche, et le lieu qui le donne.
  await page.goto(`${banc.url}/profil#collection-themes`)
  await page.waitForSelector('#collection-themes .album-themes')
  await photo('6-collection-themes-pleine', true)
  await page.click('#collection-themes .vignette-theme[aria-label^="Babel,"]')
  await page.waitForSelector('#detail-theme .detail-theme')
  await photo('6-collection-themes-fiche')
  // Du lien de « Mon thème » à la collection, puis « ← » : on revient à « Mon thème ».
  await page.goto(`${banc.url}/profil#theme`)
  await page.waitForSelector('.mes-themes')
  await page.click('a[href="#collection-themes"]')
  await page.waitForSelector('#collection-themes.trophee-ouvert')
  await photo('7-du-theme-a-la-collection')
  await page.click('.jour-sortie')
  await page.waitForSelector('.mes-themes')
  console.log('retour :', new URL(page.url()).hash)

  // La boutique : ce qui s'achète, une rareté à la fois — ceux qui se gagnent n'y sont plus.
  await page.goto(`${banc.url}/boutique`)
  await page.waitForSelector('.vitrine-themes .theme-vitrine')
  await photo('8-boutique', true)
} finally {
  await navigateur.close()
  await banc.close()
}
