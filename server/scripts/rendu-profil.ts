// La page du profil, photographiée au téléphone (360 × 640) sur un serveur
// jetable : ses deux groupes — « Me changer », la loge elle-même, sa carte et
// ses six pièces d'abord, son panneau ensuite, « Me retrouver », ses tuiles —,
// sa carte entière et son avatar touché, en grand, la loge sur chaque pièce —
// avatar, titre, vitrine, fond, thème, gerbe —, un essai de trois pièces
// porté d'un coup, la pastille d'une nouveauté, « Ma collection », ses lignes
// dépliées, l'album des thèmes et la fiche de l'un d'eux, et la boutique des
// thèmes, qui ne vend que ce qui s'achète.
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
  // Son Phénix a éclaté : la carte de la loge propose sa version rare.
  db.prepare(`INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, 'lg:phenix', 'une-soiree-d-avant', 1)`).run(id)
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

  // La loge en attendant ses panneaux, retenus trois secondes : sa carte et
  // ses pièces sont déjà là, à la place où la loge les reprendra.
  await page.route('**/PanneauxDuProfil-*.js', async (route: any) => {
    await new Promise(r => setTimeout(r, 3000))
    await route.continue()
  })
  await page.goto(`${banc.url}/profil`)
  await page.waitForSelector('.loge .loge-carte')
  await photo('1-profil-en-chemin')
  // La loge — ce qu'on porte, qu'on essaie et qu'on porte d'un coup —, puis ce
  // qu'on a. Le paquet relâché, la suite ne l'attend plus.
  await page.waitForSelector('.loge-panneau .famille-avatars')
  await page.unroute('**/PanneauxDuProfil-*.js')
  await page.waitForSelector('.tuile-compte')
  await photo('1-profil')
  await photo('1-profil-pleine', true)
  // Sa carte, comme la salle la voit — l'œil au bout de « Me changer » —, et son avatar touché : en grand, à sa place.
  await page.click('.profil-voir-carte')
  await page.waitForSelector('.carte-joueur .carte-tete')
  await photo('1-carte')
  await page.click('.carte-avatar-bouton')
  await page.waitForSelector('.carte-loupe')
  await photo('1-carte-avatar-en-grand')

  // La loge sur chaque pièce, touchée sur sa rangée — et la collection, de sa tuile.
  for (const [i, nom, piece, attente] of [
    ['2', 'loge avatar', '#loge-avatar', '.loge-panneau .famille-avatars'],
    ['3a', 'loge titre', '#loge-titre', '.loge-panneau .titres'],
    ['3b', 'loge vitrine', '#loge-vitrine', '.loge-panneau .vitrine-choix'],
    ['3c', 'loge fond', '#loge-fond', '.loge-panneau .fonds-choix'],
    ['4a', 'loge theme', '#loge-theme', '.loge-panneau .mes-themes'],
    ['4b', 'loge gerbe', '#loge-gerbe', '.loge-panneau .gerbes-choix'],
    ['5', 'Ma collection', '.tuile:has-text("Ma collection")', '.collection'],
  ] as const) {
    await page.goto(`${banc.url}/profil`)
    await page.waitForSelector('.loge-panneau .famille-avatars')
    await page.click(piece)
    await page.waitForSelector(attente)
    await photo(`${i}-${nom.toLowerCase().replace(/ /g, '-')}`)
    await photo(`${i}-${nom.toLowerCase().replace(/ /g, '-')}-pleine`, true)
  }
  // Ses trois familles d'avatars, chacune sa grille, ses cadenas et le chemin de la collection.
  for (const famille of ['Portraits', 'Emojis']) {
    await page.goto(`${banc.url}/profil#avatar`)
    await page.waitForSelector('.loge-panneau .famille-avatars')
    await page.click(`.onglets-puces [role="tab"]:has-text("${famille}")`)
    await photo(`2-loge-avatar-${famille.toLowerCase()}`)
    await photo(`2-loge-avatar-${famille.toLowerCase()}-pleine`, true)
  }

  // Un essai : un emoji sur la carte, puis un titre — la barre compte deux
  // changements —, puis un thème, qui habille toute la page ; « Porter » garde tout.
  await page.goto(`${banc.url}/profil#avatar`)
  await page.waitForSelector('.loge-panneau .famille-avatars')
  // Sa version d'origine, essayée sur la carte, puis une finition.
  await page.click('.loge-version')
  await page.click('.finition-choix:not(.selected) >> nth=1')
  await page.waitForSelector('.loge-barre')
  await photo('2b-loge-essai-version-finition')
  await page.click('.loge-barre .btn-ghost')
  await page.click('.onglets-puces [role="tab"]:has-text("Emojis")')
  await page.click('.loge-panneau .loge-grille-emojis .case-avatar >> nth=1')
  await page.waitForSelector('.loge-barre')
  await photo('2b-loge-essai-avatar')
  await page.click('#loge-titre')
  await page.waitForSelector('.loge-panneau .titres')
  await page.click('.loge-panneau .titre-choix:not(.selected) >> nth=0')
  await photo('3a-loge-essai-deux')
  await page.click('#loge-theme')
  await page.waitForSelector('.loge-panneau .mes-themes')
  await page.click('.loge-panneau .theme-vitrine[aria-label^="Océan"]')
  // Le thème essayé habille la page : sa feuille chargée, la racine le porte.
  await page.waitForSelector('html[data-theme="ocean"]', { state: 'attached' })
  await photo('4a-loge-essai-theme')
  await page.click('.loge-barre .btn-primary')
  await page.waitForSelector('.loge-barre', { state: 'detached' })
  await photo('4a-loge-porte')
  // Ce qu'il portait revient pour la suite : Velours, son Phénix, sans titre.
  await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:phenix', titre: null, theme: ivoire ? 'ivoire' : null }, cookie, 'PUT')

  // Une nouveauté : un thème acheté ailleurs depuis son dernier passage — sa
  // pièce en a la pastille, et le panneau marque sa carte.
  const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  base.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, 2)').run(id, 'jungle')
  base.close()
  await page.goto(`${banc.url}/profil`)
  await page.waitForSelector('#loge-theme .loge-neuf')
  await photo('1-loge-nouveau')
  await page.click('#loge-theme')
  await page.waitForSelector('.loge-panneau .theme-vitrine.neuve')
  await photo('4a-loge-theme-nouveau')

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
  // Du lien de la pièce « Thème » à la collection, puis « ← » : on revient à la loge, sur le thème.
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

  // La carte de la loge habillée : un titre porté, et sous la nuit étoilée —
  // posée à la main : ce fond se gagne en trente jours de quiz du jour.
  await ecrire(banc.url, '/api/joueur/moi', { titre: 'hf:phenix' }, cookie, 'PUT')
  await page.goto(`${banc.url}/profil`)
  await page.waitForSelector('.loge-carte-vitrine .loge-vitrine-case')
  await page.$eval('.loge-carte', (carte: any) => carte.classList.add('carte-fond', 'fond-nuit'))
  await photo('9-loge-habillee')
} finally {
  await navigateur.close()
  await banc.close()
}
