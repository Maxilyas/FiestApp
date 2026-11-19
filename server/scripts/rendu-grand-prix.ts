// Le Grand Prix (`/grand-prix`, `shared/grandPrix.ts`), photographié au
// téléphone sur un serveur jetable : le fantôme de Léa — ses vraies réponses
// du quiz du jour et de la campagne, écrites dans la base —, programmé au QG
// pour aujourd'hui ; Nina part, court, voit chaque révélation et la bat ;
// Hugo court et perd ; Léa lit son bilan ; l'accueil de chacun. À chaque
// photo, ce qui élargit la page.
//
//   cd server && npx tsx scripts/rendu-grand-prix.ts ../export/grand-prix
//
// `ECRAN=360x640` pour le petit téléphone (390 × 844 d'office), `THEME=ivoire`.
// Le client se construit d'abord (`npm run build -w client`).
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { ProfileStore } from '../src/auth/profiles'

const sortie = path.resolve(process.argv[2] ?? '../export/grand-prix')
mkdirSync(sortie, { recursive: true })
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')
const [largeur, hauteur] = (process.env.ECRAN ?? '390x844').split('x').map(Number)

/** Samedi 5 décembre 2026, 10 h à Paris ; l'horloge avance avec le script. */
const horloge = { t: Date.UTC(2026, 11, 5, 9, 0) }
const lance = Date.now()
const banc = await demarrer({ horlogeDuJour: () => horloge.t + (Date.now() - lance) })
const navigateur = await chromium.launch({ headless: true })
ProfileStore.tirageEclat = () => false

/** Des questions vraisemblables sur son terrain, pour que la photo se lise comme une course : texte, réponses, bonne, anecdote. */
const SON_TERRAIN: Record<string, [string, string[], number, string | null][]> = {
  disney: [
    ['Dans « Le Roi lion », comment s’appelle le père de Simba ?', ['Scar', 'Mufasa', 'Rafiki', 'Zazu'], 1, 'Mufasa vient du nom d’un roi du Kenya.'],
    ['Quel est le nom du bonhomme de neige de « La Reine des neiges » ?', ['Olaf', 'Sven', 'Kristoff', 'Hans'], 0, 'Il rêve de connaître l’été.'],
    ['Dans « Aladdin », comment s’appelle le singe d’Aladdin ?', ['Rajah', 'Iago', 'Abu', 'Pascal'], 2, null],
    ['Quel Pixar suit un rat qui rêve d’être chef ?', ['Ratatouille', 'Là-haut', 'Cars', 'Coco'], 0, 'Rémy cuisine à Paris, chez Gusteau.'],
    ['Dans « Hercule », quel cheval ailé accompagne le héros ?', ['Pégase', 'Maximus', 'Khan', 'Achille'], 0, 'Zeus le façonne à partir d’un nuage.'],
    ['Quelle princesse Disney a un raton laveur pour ami ?', ['Mulan', 'Pocahontas', 'Raiponce', 'Belle'], 1, 'Il s’appelle Meeko.'],
    ['Dans « La Petite Sirène », comment s’appelle le crabe ?', ['Polochon', 'Sébastien', 'Eurêka', 'Flotsam'], 1, null],
    ['Dans « Raiponce », comment s’appelle le cheval du palais ?', ['Maximus', 'Philippe', 'Samson', 'Frou-Frou'], 0, 'Il traque Flynn Rider avant de devenir son allié.'],
  ],
  equitation: [
    ['Quel cheval, plus petit que ses obstacles, devient champion olympique en 1988 ?', ['Jappeloup', 'Milton', 'Baloubet', 'Galoubet'], 0, 'Jappeloup mesurait 1,58 m au garrot.'],
    ['Comment appelle-t-on l’allure à trois temps du cheval ?', ['Le pas', 'Le trot', 'Le galop', 'L’amble'], 2, null],
    ['Quelle discipline juge les figures d’un cheval sur un rectangle de sable ?', ['Le saut d’obstacles', 'Le dressage', 'Le cross', 'L’attelage'], 1, 'On l’appelle aussi « la danse des chevaux ».'],
    ['Comment s’appelle l’obstacle fait de deux barres parallèles ?', ['Un vertical', 'Un oxer', 'Une rivière', 'Un mur'], 1, null],
    ['Quelle partie du cheval mesure-t-on pour donner sa taille ?', ['Le garrot', 'La croupe', 'Le chanfrein', 'Le boulet'], 0, 'Un poney ne dépasse pas 1,48 m au garrot.'],
    ['Combien de points coûte une barre tombée en saut d’obstacles ?', ['Une', 'Deux', 'Quatre', 'Huit'], 2, 'Quatre points : comme au Grand Prix.'],
    ['Quelle école d’équitation française a pour emblème le Cadre noir ?', ['Saumur', 'Chantilly', 'Versailles', 'Pau'], 0, null],
    ['Comment appelle-t-on un cheval de couleur blanche à peau noire ?', ['Un alezan', 'Un gris', 'Un bai', 'Un pie'], 1, 'Un « cheval blanc » est presque toujours un gris.'],
  ],
  'mythes-legendes': [
    ['Quel héros dompte Pégase grâce à une bride d’or offerte par Athéna ?', ['Persée', 'Bellérophon', 'Thésée', 'Jason'], 1, 'Bellérophon passe la bride d’or à Pégase endormi près de la source de Pirène.'],
    ['Quelle déesse grecque est née de l’écume de la mer ?', ['Héra', 'Athéna', 'Aphrodite', 'Artémis'], 2, 'Botticelli l’a peinte sur sa coquille.'],
    ['Du sang de quelle créature Pégase est-il né ?', ['L’Hydre', 'Méduse', 'La Chimère', 'Le Minotaure'], 1, 'Persée venait de lui trancher la tête.'],
    ['Qui garde les Enfers à trois têtes ?', ['Cerbère', 'Typhon', 'Charon', 'Orthos'], 0, null],
    ['Quel roi transforme en or tout ce qu’il touche ?', ['Crésus', 'Midas', 'Minos', 'Priam'], 1, 'Même son pain devient or.'],
    ['Quelle créature mi-femme mi-oiseau charme les marins de son chant ?', ['La sirène', 'La harpie', 'La gorgone', 'La nymphe'], 0, 'Ulysse se fait attacher au mât pour l’entendre.'],
    ['Quel titan porte le ciel sur ses épaules ?', ['Cronos', 'Prométhée', 'Atlas', 'Hypérion'], 2, null],
    ['Dans quelle ville se trouve le labyrinthe du Minotaure ?', ['Athènes', 'Knossos', 'Sparte', 'Delphes'], 1, 'Dédale l’a construit pour le roi Minos.'],
  ],
}

try {
  const admin = await connexionAnimateur(banc.url)
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦄')
  const nina = await inscrireProfil(banc.url, 'nina', 'Nina', '🦊')
  const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼')
  if (process.env.THEME) for (const c of [lea, nina, hugo]) await ecrire(banc.url, '/api/joueur/moi', { theme: process.env.THEME }, c, 'PUT')
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const id = (login: string) => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
  const ids: Record<string, string> = { lea: id('lea'), nina: id('nina'), hugo: id('hugo') }
  const leaId = ids.lea
  // Ses temps du quiz du jour, d'où se tire son rythme : plus lente quand elle se trompe.
  const tirage = db.prepare('INSERT INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, ?, ?)')
  const reponse = db.prepare('INSERT INTO jour_reponses (profile_id, jour, question, choix, ms, juste, points, repondue_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  for (const [j, jour] of ['2026-12-01', '2026-12-02', '2026-12-03'].entries()) {
    const questions = Array.from({ length: 10 }, (_, i) => ({ reserveId: `r-${j}-${i}`, texte: `Question du jour ${j}-${i} ?`, reponses: ['A', 'B', 'C', 'D'], bonne: 1, categorie: 'Histoire', duree: 20 }))
    tirage.run(jour, JSON.stringify(questions), '[]', horloge.t - 5 * 86_400_000)
    questions.forEach((_, i) => {
      const juste = i % 3 !== 1
      reponse.run(leaId, jour, i, juste ? 1 : 2, juste ? 4200 + i * 300 : 7300, juste ? 1 : 0, juste ? 150 : 0, horloge.t - 4 * 86_400_000)
    })
  }
  // Son terrain : des séries de campagne sur Disney, l'équitation, mythes et légendes — elle rate une question sur quatre.
  const serie = db.prepare('INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, sujet) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const rep = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, ?, ?, ?)')
  for (const [theme, liste] of Object.entries(SON_TERRAIN)) {
    const questions = liste.map(([texte, reponses, bonne, anecdote], i) => ({ id: `${theme}-${i}`, texte, reponses, bonne, categorie: 'Culture générale', anecdote, niveau: 'facile' }))
    serie.run(`serie-${theme}`, leaId, JSON.stringify(questions), questions.length, 3, 6, horloge.t - 3 * 86_400_000, horloge.t - 3 * 86_400_000 + 60_000, 'serie', theme)
    questions.forEach((q, i) => rep.run(`serie-${theme}`, i, q.id, i % 4 === 1 ? (q.bonne + 1) % 4 : q.bonne, i % 4 === 1 ? 0 : 1, horloge.t - 3 * 86_400_000))
  }
  db.close()

  // Le QG le programme pour aujourd'hui, Pégase en jeu, Pégase couronné pour elle.
  const programme = await ecrire(banc.url, '/api/admin/grand-prix', {
    fantome: leaId,
    jour: '2026-12-05',
    titre: 'Le Grand Prix de Léa',
    ruban: 'bleu-nuit',
    mot: 'Aujourd’hui, toute la bande court contre ton fantôme. Tiens bon !',
    prix: 'lg:pegase',
    prixFete: 'lg:pegase-couronne',
  }, admin)
  if (!programme.ok) throw new Error(`programmer : ${programme.status} ${await programme.text()}`)

  const bonneDe = (login: string): number => {
    const d = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    try {
      const c = d.prepare('SELECT grand_prix_id, obstacles, position FROM grand_prix_courses WHERE profile_id = ? AND finie_le IS NULL').get(ids[login]) as { grand_prix_id: string; obstacles: string; position: number }
      const q = d.prepare('SELECT question FROM grand_prix_questions WHERE grand_prix_id = ? AND rang = ?').get(c.grand_prix_id, JSON.parse(c.obstacles)[c.position]) as { question: string }
      return JSON.parse(q.question).bonne
    } finally {
      d.close()
    }
  }

  const contexte = async (cookie: string) => {
    const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const [nom, valeur] = cookie.split('=')
    await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    return page
  }
  const photo = async (page: any, n: string) => {
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(sortie, `${n}.png`) })
    const large = await page.evaluate('document.documentElement.scrollWidth > window.innerWidth')
    const haut = await page.evaluate('document.documentElement.scrollHeight')
    console.log(`${n}.png — page ${haut} px${large ? ' — DÉBORDE EN LARGEUR' : ''}`)
  }
  /** Répond à l'obstacle en cours : juste ou faux, après une demi-seconde (la garde du toucher). */
  const sauter = async (page: any, login: string, juste: boolean) => {
    await page.waitForSelector('button.gp-reponse')
    await page.waitForTimeout(700)
    const bonne = bonneDe(login)
    await page.locator('button.gp-reponse').nth(juste ? bonne : (bonne + 1) % 4).tap()
    await page.waitForSelector('.gp-suivant')
  }

  // Nina : l'accueil, la page, le départ, un obstacle — le fantôme saute sous ses yeux —, la révélation, l'arrivée.
  const n = await contexte(nina)
  await n.goto(`${banc.url}/`)
  await photo(n, '01-accueil-nina')
  await n.goto(`${banc.url}/grand-prix`)
  await n.waitForSelector('.gp-partir')
  await photo(n, '02-depart')
  await n.locator('.gp-partir').tap()
  await n.waitForSelector('button.gp-reponse')
  await photo(n, '03-course')
  await n.waitForTimeout(5200)
  await photo(n, '04-course-le-fantome-a-saute')
  await sauter(n, 'nina', true)
  await photo(n, '05-revelation')
  for (let i = 1; i < 10; i++) {
    await n.locator('.gp-suivant').tap()
    await sauter(n, 'nina', true)
  }
  await photo(n, '06-derniere-revelation')
  await n.locator('.gp-suivant').tap()
  await n.waitForSelector('.gp-arrivee')
  await photo(n, '07-arrivee-gagnee')
  await n.evaluate('window.scrollTo(0, document.body.scrollHeight)')
  await photo(n, '08-arrivee-gagnee-bas')
  // Son flot, rangé dans « Ma collection », au carnet des fêtes.
  await n.goto(`${banc.url}/profil#collection-timbres`)
  await n.waitForSelector('.carnet-flots-titre')
  await n.waitForSelector('.timbres-grille .gp-flot, .carnet-flots-titre + .timbres-grille')
  await n.locator('.carnet-flots-titre').scrollIntoViewIfNeeded()
  await photo(n, '08b-carnet-nina')

  // Hugo : il rate tout ce qu'il peut, et perd.
  const h = await contexte(hugo)
  await h.goto(`${banc.url}/grand-prix`)
  await h.waitForSelector('.gp-partir')
  await photo(h, '09-depart-hugo')
  await h.locator('.gp-partir').tap()
  for (let i = 0; i < 10; i++) {
    if (i > 0) await h.locator('.gp-suivant').tap()
    await sauter(h, 'hugo', i % 2 === 0)
  }
  await photo(h, '10-revelation-fausse')
  await h.locator('.gp-suivant').tap()
  await h.waitForSelector('.gp-arrivee')
  await photo(h, '11-arrivee-perdue')

  // Léa : son accueil — la feuille de son réveil, puis, fermée, le bandeau —, sa page : le bilan de son fantôme.
  const l = await contexte(lea)
  await l.goto(`${banc.url}/`)
  await l.waitForSelector('.gp-fete-feuille')
  await l.waitForTimeout(1200)
  await photo(l, '12-accueil-lea-sa-feuille')
  await l.locator('.carte-fermer').tap()
  await photo(l, '12b-accueil-lea')
  await l.reload()
  await l.waitForSelector('.gp-bandeau')
  if (await l.locator('.gp-fete-feuille').count()) console.log('LA FEUILLE REVIENT après avoir été fermée')
  await l.goto(`${banc.url}/grand-prix`)
  await l.waitForSelector('.gp-partir')
  await photo(l, '13-bilan-lea')

  // Le QG : la page du Grand Prix, au téléphone puis à l'ordinateur — le formulaire, son aperçu, la liste ; un fantôme cherché.
  const q = await contexte(admin)
  await q.goto(`${banc.url}/admin#grand-prix`)
  await q.waitForSelector('#grand-prix-liste')
  await photo(q, '14-qg')
  // Nina n'a joué aucun thème : le QG le dit. Léa a son terrain, et le choix de ses thèmes.
  await q.locator('.champ-recherche input').fill('nin')
  await q.waitForSelector('.maintenance-testeurs-liste button')
  await q.locator('.maintenance-testeurs-liste button').first().tap()
  await q.waitForSelector('.gp-qg-fantome .muted')
  await q.waitForTimeout(500)
  await photo(q, '15-qg-fantome-sans-terrain')
  await q.locator('.gp-qg-fantome button').first().tap()
  await q.locator('.champ-recherche input').fill('lé')
  await q.waitForSelector('.maintenance-testeurs-liste button')
  await q.locator('.maintenance-testeurs-liste button').first().tap()
  await q.waitForSelector('.gp-qg-terrain')
  await q.waitForTimeout(500)
  await q.locator('.gp-qg-terrain').scrollIntoViewIfNeeded()
  await photo(q, '15b-qg-son-terrain')
  const ordi = await navigateur.newContext({ viewport: { width: 1366, height: 768 } })
  const [nomA, valeurA] = admin.split('=')
  await ordi.addCookies([{ name: nomA, value: valeurA, url: banc.url }])
  const o = await ordi.newPage()
  await o.goto(`${banc.url}/admin#grand-prix`)
  await o.waitForSelector('#grand-prix-liste')
  await photo(o, '16-qg-ordinateur')
} finally {
  await navigateur.close()
  await banc.close()
}
