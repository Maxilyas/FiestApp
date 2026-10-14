// Les duels, photographiés au téléphone sur un serveur jetable — en 360 × 640,
// ou à la taille des maquettes choisies le 12 octobre 2026 (`ECRAN=390x844`),
// sous le thème qu'on veut (`THEME=ivoire`) : le bouton de l'accueil, la page
// d'un débutant et « Comment ça marche ? » ; un duel au dé, contre Automate —
// la feuille du dé tiré, ce qu'il met en jeu —, jusqu'à sa carte du verdict,
// scellée puis retournée ; la page d'un habitué — ses trois onglets : en
// cours, historique, classement, ce que chacun à sa portée mettrait en jeu —,
// la feuille du classement, sa place en tête, et la carte d'un joueur, ses
// gestes au pied ; le dé laissé en route, puis une montée de ligue ; puis
// défier quelqu'un : Tom touché au classement, « Défier Tom » sur
// sa carte, la préparation, une partie jusqu'à « Duel envoyé », et le duel qui
// l'attend chez Léa ; Tom qui le reçoit — compté en rouge à l'accueil, « À
// toi » dans ses duels —, ses deux cartes, le joue et le gagne — la carte se
// retourne ; Léa qui l'apprend — la bannière de l'accueil, une fois, la tuile
// allumée —, sa carte qui se retourne, ses réponses, la carte revue ouverte ;
// la barre de recherche ; la feuille des amis — qui est en ligne, qui l'a
// ajoutée, un prénom tapé, Zoé ajoutée de sa carte —, et la même feuille sur
// l'accueil, d'où « Défier » mène à la préparation ; enfin les joueurs
// croisés — ceux d'une soirée d'hier, dans « Contre qui ? » et sous ses amis —,
// et la carte entière de l'une, qui n'a joué ni au quiz du jour ni en duel.
// Les cotes des autres viennent de duels écrits dans la base : la cote se
// relit dans le journal des rencontres (`shared/duels.ts`). Le client
// construit d'abord (`npm run build -w client`).
//
//   [ECRAN=390x844] [THEME=ivoire] [CALME=1] npx tsx scripts/rendu-duels.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from '../test/banc'
import { CATEGORIES } from '../../shared/categories'
import { VIES } from '../../shared/campagne'
import { gainVide, releveVide } from '../../shared/profil'
import { VERSION_BAREME } from '../src/auth/profiles'
import { CampagneStore } from '../src/core/campagne'

// Automate, l'adversaire du dé : huit bonnes réponses, puis trois fautes — chaque photo, la même partie.
CampagneStore.reponsesDAutomate = () => [...Array(8).fill(true), ...Array(VIES).fill(false)]

const sortie = path.resolve(process.argv[2] ?? 'rendu-duels')
mkdirSync(sortie, { recursive: true })
const [largeur, hauteur] = (process.env.ECRAN ?? '360x640').split('x').map(Number)

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const base = (banc: Banc) => new Database(banc.quizDbUrl.replace(/^file:/, ''), { fileMustExist: true })

/** L'identifiant d'un profil, lu par sa page. */
async function idDe(banc: Banc, cookie: string): Promise<string> {
  const r = await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })
  return ((await r.json()) as { profile: { id: string } }).profile.id
}

/** Des duels classés déjà joués, écrits dans le journal : `n` fois `justes` contre `sesJustes`. */
function duelsJoues(banc: Banc, profileId: string, n: number, justes: number, sesJustes: number) {
  const db = base(banc)
  const t = Date.now() - 3 * 24 * 3_600_000
  for (let i = 0; i < n; i++) {
    const adversaire = { serie: randomUUID(), profil: randomUUID(), reponses: [...Array(sesJustes).fill(true), ...Array(VIES).fill(false)] }
    db.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
       VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
    ).run(randomUUID(), profileId, justes + VIES, justes, t + i * 60_000, t + i * 60_000 + 30_000, JSON.stringify(adversaire))
  }
  db.close()
}

const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })
const navigateur = await chromium.launch({ headless: true })
try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
  const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼')
  const ines = await inscrireProfil(banc.url, 'ines', 'Inès', '🐙')
  const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐯')
  const max = await inscrireProfil(banc.url, 'max', 'Max', '🦉')
  const camille = await inscrireProfil(banc.url, 'camille', 'Camille', '🐨')
  const noah = await inscrireProfil(banc.url, 'noah', 'Noah', '🦁')
  const jade = await inscrireProfil(banc.url, 'jade', 'Jade', '🦄')
  // Le thème voulu, porté par Léa, Tom et Zoé : leurs pages s'en habillent.
  if (process.env.THEME) for (const cookie of [lea, tom, zoe]) await ecrire(banc.url, '/api/joueur/moi', { theme: process.env.THEME }, cookie, 'PUT')
  // Ce qu'ils portent : Léa le loup de la forêt, Tom son blaireau, Inès le cerf — les écrans des duels les
  // montrent peints, jamais l'emoji d'en dessous (le retour du propriétaire du 13 octobre 2026).
  for (const [cookie, paliers, portrait] of [
    [lea, 8, 'br:loup'],
    [tom, 4, 'br:blaireau'],
    [ines, 12, 'br:cerf'],
  ] as const) {
    const id = await idDe(banc, cookie)
    const db = base(banc)
    db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)').run(id, 'foret', paliers, Date.now())
    db.close()
    await ecrire(banc.url, '/api/joueur/moi', { legendaire: portrait }, cookie, 'PUT')
  }
  // Une soirée chez Léa, hier, avec Camille, Noah et Jade : des joueurs croisés, qu'elle n'a pas en amis.
  const deLaSoiree = await Promise.all([lea, camille, noah, jade].map(c => idDe(banc, c)))
  {
    const db = base(banc)
    const detail = JSON.stringify({ v: VERSION_BAREME, gain: gainVide(), releve: releveVide() })
    const ligne = db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'la-soiree-des-renards', 'chez-lea', 0, ?, ?)`)
    for (const id of deLaSoiree) ligne.run(id, detail, Date.now() - 24 * 3_600_000)
    db.close()
  }
  duelsJoues(banc, deLaSoiree[3], 3, 10, 8)
  // Les autres ont déjà joué : Inès chez les maîtres, Hugo en platine, Tom en argent, Zoé tout près de l'argent —
  // dès l'Or, la montée ne donne qu'un point par duel : il en faut plus pour les hautes ligues.
  duelsJoues(banc, await idDe(banc, ines), 22, 30, 25)
  duelsJoues(banc, await idDe(banc, hugo), 14, 30, 18)
  duelsJoues(banc, await idDe(banc, tom), 6, 12, 8)
  duelsJoues(banc, await idDe(banc, zoe), 5, 12, 8)
  // Un premier défi de Léa, que Tom, Hugo et Inès relèvent : ses amis.
  const premier = (await (await ecrire(banc.url, '/api/campagne/duel', {}, lea)).json()) as { code: string }
  for (const cookie of [tom, hugo, ines]) await ecrire(banc.url, `/api/campagne/duel/${premier.code}`, {}, cookie)

  const telephone = async (cookie: string) => {
    const contexte = await navigateur.newContext({
      viewport: { width: largeur, height: hauteur },
      deviceScaleFactor: 2,
      reducedMotion: process.env.CALME ? 'reduce' : 'no-preference',
    })
    const [nom, valeur] = cookie.split('=')
    await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    return page
  }
  /** Une photo, l'écran posé (`attente`) : la carte du verdict se prend scellée, juste arrivée, puis retournée. */
  const photo = async (page: any, nomFichier: string, pleine = false, attente = 600) => {
    await page.waitForTimeout(attente)
    await page.screenshot({ path: path.join(sortie, `${nomFichier}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nomFichier}.png`))
  }
  /** Une partie en cours jouée jusqu'au bout : les bonnes réponses lues dans la base, `justes` fois, puis des fautes. */
  const jusquAuBout = async (page: any, cookie: string, mode: 'rencontre' | 'duel', justes: number) => {
    await page.waitForSelector('.ans-btn')
    const id = await idDe(banc, cookie)
    const db = base(banc)
    // La plus récente : Léa a aussi un défi entre amis d'avant, commencé et laissé.
    const ligne = db
      .prepare(`SELECT questions, position FROM campagne_series WHERE profile_id = ? AND mode = ? AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1`)
      .get(id, mode) as { questions: string; position: number }
    db.close()
    const qs = JSON.parse(ligne.questions) as { bonne: number; reponses: string[] }[]
    for (let i = ligne.position; ; i++) {
      await page.waitForSelector('.ans-btn')
      const q = qs[i]
      await page.locator('.ans-btn').nth(i < justes ? q.bonne : (q.bonne + 1) % q.reponses.length).click()
      const suite = page.getByRole('button', { name: /Question suivante|Voir qui a gagné|Voir mon duel/ })
      await suite.waitFor()
      const derniere = !(await suite.textContent())?.includes('Question suivante')
      await suite.click()
      if (derniere) break
    }
  }
  /**
   * Un duel au dé, contre Automate, joué jusqu'au bout depuis la page : tiré, sa feuille dit ce qu'il met en jeu
   * (`feuille`, sa photo), « Jouer le duel » le commence ; sa carte du verdict arrive.
   */
  const jouerLeDuel = async (page: any, cookie: string, justes: number, avant?: () => Promise<void>, feuille?: string) => {
    await page.getByRole('button', { name: /Un duel contre Automate|Reprendre ton duel contre/ }).click()
    await page.waitForSelector('.feuille-du-de')
    if (feuille) await photo(page, feuille)
    await page.locator('.feuille-du-de').getByRole('button', { name: 'Jouer le duel' }).click()
    await page.waitForSelector('.ans-btn')
    if (avant) await avant()
    await jusquAuBout(page, cookie, 'rencontre', justes)
    await page.waitForSelector('.duels-verdict')
  }
  /** La carte du verdict : scellée à l'arrivée, puis retournée d'elle-même. */
  const verdict = async (page: any, nomFichier: string) => {
    await photo(page, `${nomFichier}-scellee`, false, 150)
    await page.waitForSelector('.duels-carte3d.ouverte')
    await photo(page, nomFichier, false, 1100)
  }

  // L'accueil de Léa : le bouton des duels, sous le quiz du jour.
  const page = await telephone(lea)
  await page.goto(banc.url)
  await page.waitForSelector('.gros-bouton[href="/duels"]')
  await photo(page, '01-accueil')
  // Sa page, avant son premier duel : le cadran, sa semaine, « Défier » et le dé, ses trois onglets.
  await page.click('.gros-bouton[href="/duels"]')
  await page.waitForSelector('.duels-cadran-point')
  await page.waitForSelector('.duels-vide')
  await photo(page, '02-debutant')
  // « ? » : comment ça marche, et les ligues, dans leur feuille.
  await page.getByRole('button', { name: 'Comment ça marche ?' }).first().click()
  await page.waitForSelector('.duels-ligues-liste')
  await photo(page, '02b-regles')
  await page.getByRole('button', { name: 'Fermer' }).click()
  // Un duel au dé, contre Automate : ce qu'il met en jeu dans sa feuille, puis en jeu, puis la carte du verdict.
  await jouerLeDuel(page, lea, 9, () => photo(page, '03-en-jeu'), '02c-le-de-tire')
  await verdict(page, '04-gagne')
  await photo(page, '04-gagne-pleine', true)
  // La croix : ses duels — en cours, l'historique en barres, sa place au classement.
  await page.getByRole('button', { name: 'Fermer : mes duels' }).click()
  await page.waitForSelector('.duels-onglets')
  await photo(page, '05-habitue')
  await page.getByRole('tab', { name: 'Historique' }).click()
  await page.waitForSelector('.duels-barres')
  await photo(page, '05a-historique')
  await page.getByRole('tab', { name: 'Classement' }).click()
  await page.waitForSelector('.duels-podium')
  await photo(page, '05b-classement-onglet')
  // L'échelle entière : chacun à sa portée, ce qu'il gagnerait et ce qu'une défaite lui ferait.
  await photo(page, '05b-classement-onglet-pleine', true)
  // « Tout voir » : la feuille du classement, sa place en tête, puis chacun sous sa ligue.
  await page.click('.duels-podium')
  await page.waitForSelector('.duels-ta-place')
  await photo(page, '05c-classement')
  // Un nom touché au classement : sa carte, sa ligue dessus, et ses gestes au pied.
  await page.locator('.duels-ligne', { hasText: 'Inès' }).click()
  await page.waitForSelector('.carte-joueur .carte-gestes')
  await photo(page, '05d-carte-d-ines')
  await page.keyboard.press('Escape')

  // Zoé, tout près de l'argent : le dé tiré, sa feuille fermée — le duel l'attend, « En cours », le dé le reprend —,
  // puis repris, sa feuille encore, un duel gagné, et elle y monte.
  const pourZoe = await telephone(zoe)
  await pourZoe.goto(`${banc.url}/duels`)
  await pourZoe.waitForSelector('.duels-cadran-point')
  await pourZoe.getByRole('button', { name: 'Un duel contre Automate' }).click()
  await pourZoe.waitForSelector('.feuille-du-de')
  await pourZoe.getByRole('button', { name: 'Fermer' }).click()
  await pourZoe.waitForSelector('.duels-a-toi')
  await photo(pourZoe, '06a-le-de-attend')
  await jouerLeDuel(pourZoe, zoe, 10)
  await verdict(pourZoe, '06-promotion')

  // Défier quelqu'un : Tom touché au classement, « Défier Tom » sur sa carte — la préparation, lui déjà choisi ; l'histoire.
  await page.goto(`${banc.url}/duels`)
  await page.getByRole('tab', { name: 'Classement' }).click()
  await page.click('.duels-podium')
  await page.locator('.duels-ligne', { hasText: 'Tom' }).click()
  // Le bouton de sa carte, exactement : « À ta portée », derrière elle, dit aussi « Défier Tom : +21 si tu gagnes ».
  await page.getByRole('button', { name: 'Défier Tom', exact: true }).click()
  await page.waitForSelector('.defier-etape')
  await photo(page, '07-lancer')
  // Sur quoi : une ligne, « Changer » au bout, qui ouvre la feuille du choix — ses catégories, puis ses thèmes.
  await page.locator('.quoi-ligne').click()
  await page.getByRole('button', { name: 'Histoire', exact: true }).click()
  await photo(page, '07a-sur-quoi')
  await page.getByRole('tab', { name: /^Thèmes/ }).click()
  await photo(page, '07a-sur-quel-theme')
  await page.getByRole('tab', { name: 'Catégories' }).click()
  await page.getByRole('button', { name: 'Choisir · Histoire' }).click()
  await page.getByRole('button', { name: 'Jouer le duel' }).click()
  await page.waitForSelector('.duels-enjeu')
  await photo(page, '07b-en-jeu-contre-tom')
  await jusquAuBout(page, lea, 'duel', 6)
  // Sa dernière réponse : « Duel envoyé », son score parti caché, « Accueil » en or.
  await page.waitForSelector('.duels-envoye')
  await photo(page, '08-duel-envoye')
  // « Mes duels » : il attend Tom, et sa page le montre — sa carte jouée, celle de Tom au sablier.
  await page.getByRole('link', { name: 'Mes duels' }).click()
  await page.waitForSelector('.duels-attente')
  await photo(page, '08b-lea-attend')
  await page.locator('.duels-attente').click()
  await page.waitForSelector('.duels-cartes')
  await photo(page, '08c-lea-cartes')
  // Tom : le bouton de son accueil le dit — qui le défie, compté en rouge —, et le duel l'attend dans ses duels, « À toi ».
  const pourTom = await telephone(tom)
  await pourTom.goto(banc.url)
  await pourTom.waitForSelector('.gros-bouton[href="/duels"] .gros-compteur')
  await photo(pourTom, '09-accueil-de-tom')
  await pourTom.click('.gros-bouton[href="/duels"]')
  await pourTom.waitForSelector('.duels-a-toi')
  await photo(pourTom, '10-tom-le-recoit')
  // Il l'ouvre : la carte de Léa face cachée, la sienne à jouer, ce qui se joue ; il le joue, et le gagne.
  await pourTom.locator('.duels-a-toi', { hasText: 'Léa' }).click()
  await pourTom.waitForSelector('.duels-cartes')
  await photo(pourTom, '11-tom-les-cartes')
  await pourTom.getByRole('button', { name: 'Relever le duel' }).click()
  await pourTom.waitForSelector('.ans-btn')
  await photo(pourTom, '11b-tom-en-jeu')
  await jusquAuBout(pourTom, tom, 'duel', 9)
  await pourTom.waitForSelector('.duels-verdict')
  await verdict(pourTom, '12-tom-gagne')
  await photo(pourTom, '12-tom-gagne-pleine', true)
  // Léa l'apprend : la bannière tombe sur son accueil, une fois ; la tuile reste allumée.
  await page.goto(banc.url)
  await page.waitForSelector('.banniere-duel')
  await photo(page, '13-accueil-resultat', false, 900)
  await page.waitForSelector('.banniere-duel', { state: 'detached', timeout: 10_000 })
  await photo(page, '13b-accueil-tuile-allumee')
  await page.goto(banc.url)
  await page.waitForSelector('.gros-allume')
  await page.waitForTimeout(1200)
  console.log('bannière au second passage :', await page.locator('.banniere-duel').count(), '(0 attendu)')
  // Ses duels : le résultat en tête de « En cours » ; touché, sa carte se retourne.
  await page.click('.gros-bouton[href="/duels"]')
  await page.waitForSelector('.duels-resultat')
  await photo(page, '14-lea-resultat-en-cours')
  await page.locator('.duels-resultat').click()
  await page.waitForSelector('.duels-verdict')
  await verdict(page, '14a-lea-verdict')
  // Ses réponses : la correction sous la carte.
  await page.getByRole('button', { name: 'Réponses' }).click()
  await page.waitForSelector('.campagne-correction')
  await photo(page, '14b-lea-reponses', true)
  // Revue, la carte arrive ouverte : le résultat est vu.
  await page.reload()
  await page.waitForSelector('.duels-carte3d.ouverte')
  await photo(page, '14c-lea-revue', false, 150)
  // L'historique le compte, maintenant qu'elle l'a vu.
  await page.goto(`${banc.url}/duels`)
  await page.getByRole('tab', { name: 'Historique' }).click()
  await page.waitForSelector('.duels-barres')
  await photo(page, '15-lea-historique')
  // Défier quelqu'un par son prénom : la barre de recherche.
  await page.goto(`${banc.url}/duels`)
  await page.getByRole('button', { name: 'Défier', exact: true }).click()
  await page.waitForSelector('.chercher-champ input')
  await page.fill('.chercher-champ input', 'zo')
  await page.waitForSelector('.joueurs-trouves .ligne-joueur')
  await photo(page, '16-chercher')
  // Ses amis : l'icône des amis ouvre leur feuille, par-dessus la page — Tom, ami des deux côtés et passé à l'instant, en ligne ; Max vient de l'ajouter.
  await ecrire(banc.url, `/api/campagne/amis/${await idDe(banc, lea)}/ajout`, {}, max)
  await page.goto(`${banc.url}/duels`)
  await page.getByRole('button', { name: 'Mes amis' }).click()
  await page.waitForSelector('.amis-sections .ligne-joueur-ouvrable')
  await photo(page, '17-amis')
  // Un prénom tapé : ses amis qu'il désigne, puis les autres joueurs.
  await page.fill('.carte-feuille .chercher-champ input', 'zo')
  await page.waitForSelector('#amis-autres-titre')
  await photo(page, '17b-amis-chercher')
  // Zoé touchée : sa carte, et « Ajouter à mes amis » à son pied.
  await page.locator('.ligne-joueur-ouvrable', { hasText: 'Zoé' }).click()
  await page.waitForSelector('.carte-joueur .carte-gestes')
  await photo(page, '17c-carte-de-zoe')
  await page.getByRole('button', { name: 'Ajouter à mes amis' }).click()
  await page.waitForSelector('.carte-gestes-ami')
  await photo(page, '17d-zoe-ajoutee')
  // Retirer se confirme sur place.
  await page.getByRole('button', { name: 'Retirer Zoé de mes amis' }).click()
  await page.waitForSelector('.carte-gestes-retrait')
  await photo(page, '17e-retirer-zoe')
  await page.getByRole('button', { name: 'Garder' }).click()
  await page.keyboard.press('Escape')
  // L'accueil : « Amis » au bout de sa ligne ; la feuille monte sur l'accueil, et « Défier » sur une carte mène à la préparation.
  await page.goto(banc.url)
  await page.waitForSelector('.bouton-des-amis')
  await photo(page, '18-accueil-amis')
  await page.click('.bouton-des-amis')
  await page.waitForSelector('.amis-sections .ligne-joueur-ouvrable')
  await photo(page, '18b-amis-sur-l-accueil')
  await page.locator('.ligne-joueur-ouvrable', { hasText: 'Hugo' }).click()
  await page.getByRole('button', { name: 'Défier Hugo' }).click()
  await page.waitForSelector('.defi-heros h1:has-text("Défier Hugo")')
  await photo(page, '19-defier-depuis-l-accueil')
  // « Contre qui ? » : ses amis, puis les joueurs croisés — ceux de la soirée d'hier, Max de son duel —, chaque prénom ouvre sa carte, « Choisir » à côté.
  await page.goto(`${banc.url}/duels`)
  await page.getByRole('button', { name: 'Défier', exact: true }).click()
  await page.waitForSelector('ul[aria-label="Défier un joueur croisé"]')
  await photo(page, '20-contre-qui')
  await photo(page, '20-contre-qui-pleine', true)
  // Camille touchée : sa carte entière — elle n'a joué ni au quiz du jour ni en duel —, et « Défier Camille » à son pied la choisit ici même.
  await page.locator('.ligne-joueur-ouvrir', { hasText: 'Camille' }).click()
  await page.waitForSelector('.carte-joueur .carte-gestes')
  await photo(page, '20b-carte-de-camille')
  await page.locator('.carte-joueur').getByRole('button', { name: 'Défier Camille' }).click()
  await page.waitForSelector('.defi-heros h1:has-text("Défier Camille")')
  await photo(page, '20c-camille-choisie')
  // La feuille des amis : sous sa liste, les joueurs croisés, chacun ce qui le fait paraître.
  await page.goto(`${banc.url}/duels`)
  await page.getByRole('button', { name: 'Mes amis' }).click()
  await page.waitForSelector('#amis-croises-titre')
  await page.locator('#amis-croises-titre').scrollIntoViewIfNeeded()
  await photo(page, '21-amis-croises')
  // L'ancien lien d'un défi entre amis, parti avant les duels : il mène à sa page, celle d'avant.
  await pourTom.goto(`${banc.url}/campagne#duel-${premier.code}`)
  await pourTom.waitForSelector('.defi-heros')
  console.log('ancien lien →', new URL(pourTom.url()).pathname + new URL(pourTom.url()).hash)
} finally {
  await navigateur.close()
  await banc.close()
}
