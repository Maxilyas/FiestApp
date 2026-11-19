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

/** Des questions vraisemblables, pour que la photo se lise comme une course. */
const QUESTIONS: [string, string[], number, string, string][] = [
  ['Quel héros dompte Pégase grâce à une bride d’or offerte par Athéna ?', ['Persée', 'Bellérophon', 'Thésée', 'Jason'], 1, 'Mythes et légendes', 'Bellérophon passe la bride d’or à Pégase endormi près de la source de Pirène.'],
  ['Quel cheval, plus petit que ses obstacles, devient champion olympique en 1988 ?', ['Jappeloup', 'Milton', 'Baloubet', 'Galoubet'], 0, 'Sport', 'Jappeloup mesurait 1,58 m au garrot.'],
  ['Dans quelle ville se tiennent les Jeux olympiques de 2004 ?', ['Sydney', 'Pékin', 'Athènes', 'Londres'], 2, 'Sport', 'Les Jeux revenaient dans leur pays d’origine.'],
  ['Quel peintre a signé « La Nuit étoilée » ?', ['Monet', 'Van Gogh', 'Cézanne', 'Gauguin'], 1, 'Arts', 'Peinte depuis sa chambre de Saint-Rémy-de-Provence, en 1889.'],
  ['Quel est le nom de la licorne de la constellation de la Licorne ?', ['Monoceros', 'Pegasus', 'Draco', 'Lyra'], 0, 'Sciences', 'Monoceros, discrète, entre Orion et le Petit Chien.'],
  ['Dans « Le Roi lion », comment s’appelle le père de Simba ?', ['Scar', 'Mufasa', 'Rafiki', 'Zazu'], 1, 'Cinéma', 'Mufasa vient du nom d’un roi du Kenya.'],
  ['Quel mot anglais signifie « cheval » ?', ['Horse', 'House', 'Hose', 'Hoarse'], 0, 'Langues', null as unknown as string],
  ['Combien de pattes a une araignée ?', ['Six', 'Huit', 'Dix', 'Douze'], 1, 'Nature', 'Huit pattes, et souvent huit yeux.'],
  ['Quelle déesse grecque est née de l’écume de la mer ?', ['Héra', 'Athéna', 'Aphrodite', 'Artémis'], 2, 'Mythes et légendes', 'Botticelli l’a peinte sur sa coquille.'],
  ['Quelle planète est surnommée la planète rouge ?', ['Vénus', 'Jupiter', 'Mars', 'Saturne'], 2, 'Sciences', 'Sa poussière est riche en oxyde de fer.'],
  ['Qui a écrit « Le Petit Prince » ?', ['Saint-Exupéry', 'Camus', 'Prévert', 'Pagnol'], 0, 'Littérature', 'Publié à New York en 1943.'],
  ['Quel est le plus long fleuve de France ?', ['La Seine', 'Le Rhône', 'La Loire', 'La Garonne'], 2, 'Géographie', 'Un peu plus de mille kilomètres.'],
]

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
  // Trois jours de quiz du jour : elle rate une question sur trois, plus lente quand elle se trompe.
  const tirage = db.prepare('INSERT INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, ?, ?)')
  const reponse = db.prepare('INSERT INTO jour_reponses (profile_id, jour, question, choix, ms, juste, points, repondue_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  for (const [j, jour] of ['2026-12-01', '2026-12-02', '2026-12-03'].entries()) {
    const questions = Array.from({ length: 10 }, (_, i) => {
      const [texte, reponses, bonne, categorie, anecdote] = QUESTIONS[(j * 10 + i) % QUESTIONS.length]
      return { reserveId: `r-${j}-${i}`, texte: j * 10 + i < QUESTIONS.length ? texte : `${texte.slice(0, -2)} (${j}-${i}) ?`, reponses, bonne, categorie, duree: 20, lectureMs: 2500, anecdote }
    })
    tirage.run(jour, JSON.stringify(questions), '[]', horloge.t - 5 * 86_400_000)
    questions.forEach((q, i) => {
      const juste = i % 3 !== 1
      reponse.run(leaId, jour, i, juste ? q.bonne : (q.bonne + 1) % 4, juste ? 4200 + i * 300 : 7300, juste ? 1 : 0, juste ? 150 : 0, horloge.t - 4 * 86_400_000)
    })
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
} finally {
  await navigateur.close()
  await banc.close()
}
