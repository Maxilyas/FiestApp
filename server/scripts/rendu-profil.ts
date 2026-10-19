// La page du profil, photographiée au téléphone (360 × 640) sur un serveur
// jetable : soi-même en tête et ses quatre boutons — « M'habiller », « Ma
// collection », « Mes soirées », « Ma carrière » —, sa carte entière et son
// avatar touché, en grand, la loge — sa carte et ses six pièces d'abord, son
// panneau ensuite —, sur chaque pièce — avatar, titre, vitrine, fond, thème,
// gerbe —, un essai de trois pièces porté d'un coup, la pastille d'une
// nouveauté — un thème, puis un avatar d'une autre rareté que celle qu'elle
// porte, jusqu'à sa case —, « Ma collection », ses lignes dépliées, l'album des avatars — ses
// six pages et trois fiches —, l'album des thèmes et la fiche de l'un d'eux,
// et la boutique des thèmes, qui ne vend que ce qui s'achète.
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
  const photo = async (nomFichier: string, pleine = false, attente = 700) => {
    await page.waitForTimeout(attente)
    await page.screenshot({ path: path.join(sortie, `${nomFichier}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nomFichier}.png`))
  }

  // La loge en attendant ses panneaux, retenus trois secondes — d'abord, tant
  // que le navigateur ne les a pas en cache : sa carte et ses pièces sont
  // déjà là, à la place où la loge les reprendra. Le paquet relâché, la suite
  // ne l'attend plus.
  await page.route('**/PanneauxDuProfil-*.js', async (route: any) => {
    await new Promise(r => setTimeout(r, 3000))
    await route.continue()
  })
  await page.goto(`${banc.url}/profil#avatar`)
  await page.waitForSelector('.loge .loge-carte')
  await photo('2-loge-en-chemin')
  await page.waitForSelector('.loge-panneau .loge-page-avatars')
  await page.unroute('**/PanneauxDuProfil-*.js')

  // Le profil, épuré : soi-même en tête, puis ses quatre boutons.
  await page.goto(`${banc.url}/profil`)
  await page.waitForSelector('.profil-boutons .gros-compte')
  await photo('1-profil')
  await photo('1-profil-pleine', true)
  // Sa carte, comme la salle la voit — sa ligne en tête se touche —, et son avatar touché : en grand, à sa place.
  await page.click('button.identite-ligne')
  await page.waitForSelector('.carte-joueur .carte-tete')
  await photo('1-carte')
  await page.click('.carte-avatar-bouton')
  await page.waitForSelector('.carte-loupe')
  await photo('1-carte-avatar-en-grand')

  // La loge, ouverte de son bouton, sur chaque pièce touchée sur sa rangée — et la collection, de son bouton.
  for (const [i, nom, piece, attente] of [
    ['2', 'loge avatar', null, '.loge-panneau .loge-page-avatars'],
    ['3a', 'loge titre', '#loge-titre', '.loge-panneau .titres'],
    ['3b', 'loge vitrine', '#loge-vitrine', '.loge-panneau .vitrine-choix'],
    ['3c', 'loge fond', '#loge-fond', '.loge-panneau .fonds-choix'],
    ['4a', 'loge theme', '#loge-theme', '.loge-panneau .mes-themes'],
    ['4b', 'loge gerbe', '#loge-gerbe', '.loge-panneau .gerbes-choix'],
    ['5', 'Ma collection', 'collection', '.collection'],
  ] as const) {
    await page.goto(`${banc.url}/profil`)
    await page.waitForSelector('.profil-boutons .gros-compte')
    await page.click(`.profil-boutons .gros-bouton:has-text("${piece === 'collection' ? 'Ma collection' : 'M’habiller'}")`)
    if (piece && piece !== 'collection') {
      await page.waitForSelector('.loge-panneau .loge-page-avatars')
      await page.click(piece)
    }
    await page.waitForSelector(attente)
    await photo(`${i}-${nom.toLowerCase().replace(/ /g, '-')}`)
    await photo(`${i}-${nom.toLowerCase().replace(/ /g, '-')}-pleine`, true)
  }
  // Ses pages d'avatars, les gemmes de l'album : chacune sa grille, et le chemin de ce qui reste.
  for (const [gemme, nomDeLaPage] of [
    ['offert', 'offerts'],
    ['commune', 'commune'],
    ['peucommune', 'peu-commune'],
  ] as const) {
    await page.goto(`${banc.url}/profil#avatar`)
    await page.waitForSelector('.loge-panneau .loge-page-avatars')
    await page.click(`#loge-gemme-${gemme}`)
    await photo(`2-loge-avatar-${nomDeLaPage}`)
    await photo(`2-loge-avatar-${nomDeLaPage}-pleine`, true)
  }

  // Un essai : un emoji sur la carte, puis un titre — la barre compte deux
  // changements —, puis un thème, qui habille toute la page ; « Porter » garde tout.
  await page.goto(`${banc.url}/profil#avatar`)
  await page.waitForSelector('.loge-panneau .loge-page-avatars')
  // Sa version d'origine, essayée sur la carte, puis une finition.
  await page.click('.loge-version')
  await page.click('.finition-choix:not(.selected) >> nth=1')
  await page.waitForSelector('.loge-barre')
  await photo('2b-loge-essai-version-finition')
  await page.click('.loge-barre .btn-ghost')
  await page.click('#loge-gemme-offert')
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

  // Une nouveauté : un thème acheté ailleurs depuis son dernier passage —
  // « Profil », dans la barre de l'accueil, la compte en rouge ; « M'habiller »
  // aussi, qui ouvre la loge sur sa pièce, où le panneau marque sa carte.
  const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  base.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, 2)').run(id, 'jungle')
  base.close()
  await page.goto(banc.url)
  await page.waitForSelector('.menu-barre a[href="/profil"] .menu-compteur')
  await photo('1-accueil-nouveau')
  await page.goto(`${banc.url}/profil`)
  await page.waitForSelector('.profil-boutons .gros-bouton:has-text("M’habiller") .gros-compteur')
  await photo('1-profil-nouveau')
  await page.click('.profil-boutons .gros-bouton:has-text("M’habiller")')
  await page.waitForSelector('#loge-theme[aria-selected="true"]')
  await page.waitForSelector('.loge-panneau .theme-vitrine.neuve')
  await photo('1-loge-nouveau')
  // Regardé : plus rien à compter, la barre s'éteint.
  await page.waitForSelector('.menu-barre .menu-compteur', { state: 'detached' })
  await photo('4a-loge-theme-nouveau')

  // La collection, une ligne dépliée à la fois — par son adresse, comme le lien de « Mon thème ».
  for (const partie of ['themes', 'avatars', 'trophees', 'fonds', 'gerbes', 'finitions', 'bordures']) {
    await page.goto(`${banc.url}/profil#collection-${partie}`)
    await page.waitForSelector(`#collection-${partie}.trophee-ouvert`)
    await photo(`6-collection-${partie}`)
  }
  // Le style en albums : une fiche à gagner — où il en est —, une à elle — « Essayer » —, une bordure.
  for (const [partie, nomDeLaFiche, cas] of [
    ['fonds', 'fond-a-gagner', 'Nuit étoilée'],
    ['gerbes', 'gerbe-a-elle', 'La pluie d’étoiles'],
    ['finitions', 'finition-a-gagner', 'Prisme'],
    ['bordures', 'bordure-a-gagner', 'Les Fleurons'],
  ] as const) {
    await page.goto(`${banc.url}/profil#collection-${partie}`)
    await page.waitForSelector(`#collection-${partie}.trophee-ouvert`)
    await page.click(`#collection-${partie} .style-case[aria-label^="${cas}"]`)
    await page.waitForSelector('#fiche-style')
    await page.locator('#fiche-style').evaluate((e: any) => e.scrollIntoView({ block: 'center' }))
    await photo(`6-style-fiche-${nomDeLaFiche}`)
  }
  // « Essayer », d'une fiche : la loge s'ouvre, la finition à l'essai sur la carte, sans recharger la page.
  await page.goto(`${banc.url}/profil#collection-finitions`)
  await page.waitForSelector('#collection-finitions.trophee-ouvert')
  await page.click('#collection-finitions .style-case[aria-label^="Or"]')
  await page.waitForSelector('#fiche-style .album-essayer')
  await page.click('#fiche-style .album-essayer')
  await page.waitForSelector('.loge-barre')
  await photo('6-style-essayer-dans-la-loge')
  await page.click('.loge-barre .btn-ghost')
  // L'album des trophées, page par page — son adresse nomme la page —, puis trois fiches : une piste commencée et ce qu'ouvre chaque étape, une à gagner, un exploit.
  for (const p of ['soiree', 'jour', 'campagne', 'duels', 'sentiers', 'partout']) {
    await page.goto(`${banc.url}/profil#collection-trophees-${p}`)
    await page.waitForSelector(`#trophees-onglet-${p}[aria-selected="true"]`)
    await photo(`6-trophees-${p}`, true)
  }
  for (const [p, debut, nom] of [
    ['jour', 'Le Sans-Faute,', 'sans-faute'],
    ['jour', 'Le Champion du jour,', 'champion-du-jour'],
    ['soiree', 'Le Phénix,', 'phenix'],
  ] as const) {
    await page.goto(`${banc.url}/profil#collection-trophees-${p}`)
    await page.waitForSelector('.trophees-grille')
    await page.click(`.trophee-case[aria-label^="${debut}"]`)
    await page.waitForSelector('#fiche-trophee .trophee-fiche')
    await photo(`6-trophees-fiche-${nom}`)
  }
  // L'album des avatars, page par page — son adresse nomme la page —, puis trois fiches : à gagner, à gagner sur un sentier, et la sienne.
  for (const rarete of ['commune', 'peucommune', 'rare', 'epique', 'legendaire', 'divin']) {
    await page.goto(`${banc.url}/profil#collection-avatars-${rarete}`)
    await page.waitForSelector(`#gemme-${rarete}[aria-selected="true"]`)
    await photo(`6-album-${rarete}`, true)
  }
  for (const [rarete, debut, nom] of [
    ['legendaire', 'La Licorne Astrale,', 'licorne'],
    ['legendaire', 'Le Phénix,', 'phenix'],
    ['rare', 'Le lynx,', 'lynx'],
  ] as const) {
    await page.goto(`${banc.url}/profil#collection-avatars-${rarete}`)
    await page.waitForSelector('.album-avatars')
    await page.click(`.album-case[aria-label^="${debut}"]`)
    await page.waitForSelector('#fiche-avatar .album-detail')
    await photo(`6-album-fiche-${nom}`)
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
  await page.goto(`${banc.url}/profil#avatar`)
  await page.waitForSelector('.loge-carte-vitrine .loge-vitrine-case')
  await page.$eval('.loge-carte', (carte: any) => carte.classList.add('carte-fond', 'fond-nuit'))
  await photo('9-loge-habillee')

  // Les compagnons : leur rayon avant l'achat ; puis le loup acheté et mené
  // à sa forme ultime — cinq cent vingt bonnes réponses en le portant, en
  // campagne —, la tortue achetée sans la porter et grandie d'une forme ; le
  // rayon, la loge, l'album et la carte.
  const avecCompagnons = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  avecCompagnons
    .prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-09-20', 1, 10, NULL, 0, 2500, 1, 0)`)
    .run(id)
  avecCompagnons.close()
  await page.goto(`${banc.url}/boutique#compagnons`)
  await page.waitForSelector('.rayon-compagnons .compagnon-carte')
  await photo('10-boutique-compagnons')
  await photo('10-boutique-compagnons-pleine', true)
  // La vitrine : caressé, il bondit et des cœurs s'envolent ; sa forme ultime en grand ; la tortue, d'un point.
  await page.click('.compagnon-carte:first-child .compagnon-scene')
  await photo('10-boutique-compagnon-caresse', false, 260)
  await page.click('.compagnon-carte:first-child .compagnon-forme[aria-label^="Le loup des étoiles"]')
  await photo('10-boutique-compagnon-ultime', false, 1200)
  await page.click('.vitrine-point[aria-label="La Tortue-île"]')
  await photo('10-boutique-compagnon-tortue', false, 900)
  // Le loup adopté, porté en avatar — l'adoption ne le fait pas : il se choisit, comme dans la loge —, puis la tortue, qui attend son tour.
  await ecrire(banc.url, '/api/joueur/compagnons', { compagnon: 'loup' }, cookie)
  await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'cp:loup-louveteau' }, cookie, 'PUT')
  await ecrire(banc.url, '/api/joueur/compagnons', { compagnon: 'tortue', installer: false }, cookie)
  const nourrir = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  for (const [serie, n, compagnon] of [
    ['avec-le-loup', 520, 'loup'],
    ['avec-la-tortue', 160, 'tortue'],
  ] as const) {
    nourrir.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le) VALUES (?, ?, '[]', ?, 3, ?, 1, 2)`).run(serie, id, n, n)
    const reponse = nourrir.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon) VALUES (?, ?, ?, 0, 1, 2, ?)')
    for (let i = 0; i < n; i++) reponse.run(serie, i, `${serie}-${i}`, compagnon)
  }
  nourrir.close()
  // La même adresse ne recharge pas la page : elle relirait la boutique d'avant l'achat.
  await page.goto('about:blank')
  await page.goto(`${banc.url}/boutique#compagnons`)
  await page.waitForSelector('.rayon-compagnons .compagnon-sien')
  await photo('10-boutique-compagnons-a-toi')
  await photo('10-boutique-compagnons-a-toi-pleine', true)
  await page.goto(`${banc.url}/profil#avatar`)
  await page.waitForSelector('.loge-panneau .loge-page-avatars')
  // Il porte le loup à sa forme ultime : la loge s'ouvre sur la page légendaire, ses formes d'avant aux leurs.
  await photo('10-loge-loup-ultime')
  await page.click('#loge-gemme-rare')
  await photo('10-loge-compagnons')
  for (const rarete of ['commune', 'legendaire']) {
    await page.goto(`${banc.url}/profil#collection-avatars-${rarete}`)
    await page.waitForSelector(`#gemme-${rarete}[aria-selected="true"]`)
    await photo(`10-album-${rarete}`, true)
  }
  for (const [rarete, debut, nom] of [
    ['legendaire', 'Le loup des étoiles,', 'loup-des-etoiles'],
    ['legendaire', 'L’esprit des lanternes,', 'esprit-des-lanternes'],
    ['epique', 'La tortue-bosquet,', 'tortue-bosquet'],
  ] as const) {
    await page.goto(`${banc.url}/profil#collection-avatars-${rarete}`)
    await page.waitForSelector('.album-avatars')
    await page.click(`.album-case[aria-label^="${debut}"]`)
    await page.waitForSelector('#fiche-avatar .album-detail')
    await photo(`10-album-fiche-${nom}`)
  }
  await page.goto(`${banc.url}/profil`)
  await page.waitForSelector('.profil-boutons .gros-compte')
  await page.click('button.identite-ligne')
  await page.waitForSelector('.carte-joueur .carte-tete')
  await photo('10-carte-loup')
  await page.click('.carte-avatar-bouton')
  await page.waitForSelector('.carte-loupe')
  await photo('10-carte-loup-en-grand')

  // Les fonds des savoirs : le rayon, sa carte posée sur chacun ; une fiche
  // dépliée ; le vitrail acheté et porté, dans la loge ; puis la collection,
  // ses vingt-cinq fonds — ceux de la boutique à leur prix.
  await page.goto(`${banc.url}/boutique#fonds`)
  await page.waitForSelector('.vitrine-fonds .fond-vitrine')
  await photo('11-boutique-fonds', false, 1500)
  await photo('11-boutique-fonds-pleine', true)
  await page.click('.fond-vitrine[aria-label^="Le Vitrail"]')
  await page.waitForSelector('#detail-fond')
  await photo('11-boutique-fond-fiche', false, 1200)
  await ecrire(banc.url, '/api/joueur/fonds', { fond: 'vitrail' }, cookie)
  await page.goto(`${banc.url}/profil#fond`)
  await page.waitForSelector('.loge-carte')
  await photo('11-loge-fond-vitrail', false, 1500)
  await page.goto(`${banc.url}/profil#collection-fonds`)
  await page.waitForSelector('#collection-fonds.trophee-ouvert')
  await photo('11-collection-fonds-pleine', true, 1500)

  // Un avatar neuf rangé sur une autre rareté que le loup qu'elle porte — le
  // lynx, au sixième palier de la forêt —, un Éclat tombé sur son renard et
  // le niveau 15, qui ouvre le Prisme : « M'habiller » ouvre la loge sur
  // l'avatar, et le point rouge mène de la gemme de chaque rareté à sa case
  // (le retour du propriétaire du 15 octobre 2026 : passé « M'habiller », il
  // n'y avait plus de pastille à suivre). En dernier : la fiche du lynx, plus
  // haut, le montre encore à gagner.
  const encoreDuNeuf = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  encoreDuNeuf.prepare('UPDATE sentier_acquis SET paliers = 6 WHERE profile_id = ? AND branche = ?').run(id, 'foret')
  encoreDuNeuf.prepare(`INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, '🦊', 'une-autre-soiree', 3)`).run(id)
  encoreDuNeuf.prepare(`UPDATE profile_xp SET xp = ? WHERE profile_id = ? AND soiree_id = '#jour'`).run(xpDuNiveau(15), id)
  encoreDuNeuf.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xpDuNiveau(15), id)
  encoreDuNeuf.close()
  await banc.redemarrer()
  await page.goto(`${banc.url}/profil`)
  await page.waitForSelector('.profil-boutons .gros-bouton:has-text("M’habiller") .gros-compteur')
  await page.click('.profil-boutons .gros-bouton:has-text("M’habiller")')
  await page.waitForSelector('#loge-avatar[aria-selected="true"]')
  await page.waitForSelector('.gemmes-loge .gemme-neuf')
  await photo('12-loge-finition-nouvelle')
  await page.locator('.gemmes-loge').evaluate((e: any) => e.scrollIntoView({ block: 'center' }))
  await photo('12-loge-avatar-nouveau')
  await page.click('#loge-gemme-rare')
  await page.waitForSelector('.loge-page-avatars .case-avatar.neuve')
  await photo('12-loge-avatar-nouveau-rare')
} finally {
  await navigateur.close()
  await banc.close()
}
