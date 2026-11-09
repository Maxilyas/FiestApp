// La ligne d'un joueur qui ne se dessine plus au classement du quiz du jour
// (le retour du propriétaire du 9 novembre 2026, une photo d'un téléphone
// Android sous Le Ciel : la huitième ligne vide, le médaillon de son légendaire
// seul à sa place — « soit la ligne est vide, soit de la friture sur toute la
// ligne »).
//
// Ce que la production servait ce jour-là, relu en lecture seule — les mêmes
// avatars, des prénoms inventés : huit profils, dont sept médaillons, six
// lumières de finition, quatre bordures, et en dernier un légendaire éclaté
// sous les Abysses. Rejoué ici dans un Chromium à la carte graphique émulée et
// à la mémoire bornée (skill `regarder-le-rendu`), à plusieurs budgets, la
// photo une puis quatre secondes après l'ouverture ; et, la mémoire large, le
// relevé des calques que le navigateur compose.
//
// Ce qu'il a montré : chaque ligne gardait son calque (`slide-in … both`),
// chaque légendaire le sien (la perspective de `.lg-carte`, même à plat), et
// ce qui passe devant un médaillon un troisième — vingt-cinq calques, 52 Mo,
// sur un décor qui en prend déjà quatre en plein écran. Dès 56 Mo de mémoire,
// il manquait d'une à cinq lignes selon l'essai — jamais les mêmes —,
// certaines réduites à leur médaillon. Corrigé (`styles.css`,
// `calques-des-listes.test.ts`) : dix calques, 48 Mo, plus un seul dans le
// classement, et ses huit lignes dessinées jusqu'à 40 Mo. Sous 52 Mo, c'est
// un bout de la page qui manque — son titre, son bouton du bas : le reste
// est le décor du thème, et la même page pèse 10 Mo sous le Velours.
//
//   npm run build -w client
//   cd server && [MEMS=512,64,56,52,48,44,40] [THEME=ciel] npx tsx ../retours/2026-11-09/reproductions/classement-sans-sa-ligne.ts [dossier]
//
// `LIGNES=tout` : une ligne par sorte d'avatar — un Divin, un sceau, une
// matière, chaque lumière — pour relever ce qui garderait encore un calque.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { demarrer, inscrireProfil } from '../../../server/test/banc'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const Database = createRequire(path.join(RACINE, 'server/package.json'))('better-sqlite3')
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

const sortie = path.resolve(process.argv[2] ?? path.join(RACINE, 'export/rendus/classement-sans-sa-ligne'))
mkdirSync(sortie, { recursive: true })
const budgets = (process.env.MEMS ?? '512,56,48').split(',')
const theme = process.env.THEME ?? 'ciel'
const DENSITE = 2.625

type Ligne = Record<string, unknown> & { profileId: string; nom: string; avatar: string; niveau: number; points: number; rang: number }

/** Le classement du 9 novembre 2026, à ses avatars près. */
const DU_JOUR: Ligne[] = [
  { profileId: 'p1', nom: 'Agathe', avatar: '🦁', niveau: 9, finition: 'argent', eclat: true, points: 1558, rang: 1 },
  { profileId: 'p2', nom: 'Jeanne', avatar: '🦔', niveau: 17, finition: 'holo', legendaire: 'lg:renard', laurier: 1, bordure: { ligue: 'platine', crans: 4 }, points: 1400, rang: 2 },
  { profileId: 'p3', nom: 'Louise', avatar: '🦓', niveau: 23, finition: 'aurore', legendaire: 'br:lynx', bordure: { ligue: 'or', crans: 7 }, points: 1400, rang: 2 },
  { profileId: 'p4', nom: 'Félix', avatar: '🦊', niveau: 22, finition: 'aurore', legendaire: 'lg:coq', points: 1200, rang: 4 },
  { profileId: 'p5', nom: 'Perrine', avatar: '🐳', niveau: 19, finition: 'prisme', legendaire: 'cp:panda-sakura', bordure: { ligue: 'bronze', crans: 3 }, points: 1200, rang: 4 },
  { profileId: 'moi', nom: 'Rose', avatar: '🦈', niveau: 22, finition: 'aurore', legendaire: 'lg:lion', laurier: 'argent', bordure: { ligue: 'platine', crans: 6 }, points: 1198, rang: 6 },
  { profileId: 'p7', nom: 'Achille', avatar: '🦉', niveau: 28, finition: 'constellation', legendaire: 'cp:tortue-fleurs', points: 997, rang: 7 },
  // Celui dont la ligne manquait : le seul aux Abysses, son légendaire éclaté.
  { profileId: 'p8', nom: 'Basile', avatar: '🐳', niveau: 30, finition: 'abysses', legendaire: 'lg:ouroboros', eclat: true, points: 600, rang: 8 },
]

/** Une ligne par sorte d'avatar : ce qu'un classement peut porter de plus lourd. */
const TOUT: Ligne[] = [
  { profileId: 'moi', nom: 'Divin', avatar: '🦊', niveau: 50, finition: 'singularite', legendaire: 'dv:helios', points: 2000, rang: 1 },
  { profileId: 't2', nom: 'Scellé', avatar: '🦊', niveau: 45, finition: 'disco', legendaire: 'lg:phenix', sceau: true, bordure: { ligue: 'maitre', crans: 12 }, points: 1900, rang: 2 },
  { profileId: 't3', nom: 'Jade', avatar: '🦊', niveau: 40, finition: 'envol', legendaire: 'lg:dragon', eclat: 'jade', points: 1800, rang: 3 },
  { profileId: 't4', nom: 'Orage', avatar: '🦊', niveau: 35, finition: 'orage', legendaire: 'lg:kraken', eclat: true, points: 1700, rang: 4 },
  { profileId: 't5', nom: 'Singularité', avatar: '🐼', niveau: 50, finition: 'singularite', eclat: 'opale', bordure: { ligue: 'diamant', crans: 12 }, points: 1600, rang: 5 },
  { profileId: 't6', nom: 'Abysses', avatar: '🐸', niveau: 30, finition: 'abysses', points: 1500, rang: 6 },
  { profileId: 't7', nom: 'Disco', avatar: '🐙', niveau: 45, finition: 'disco', eclat: true, points: 1400, rang: 7 },
  { profileId: 't8', nom: 'Portrait', avatar: '🦊', niveau: 40, finition: 'envol', legendaire: 'br:lynx', eclat: true, points: 1300, rang: 8 },
  { profileId: 't9', nom: 'Compagnon', avatar: '🦊', niveau: 35, finition: 'orage', legendaire: 'cp:loup-ultime', eclat: true, points: 1200, rang: 9 },
  { profileId: 't10', nom: 'Prisme', avatar: '🦄', niveau: 15, finition: 'prisme', points: 1100, rang: 10 },
]
const lignes = process.env.LIGNES === 'tout' ? TOUT : DU_JOUR

const horloge = Date.UTC(2026, 10, 9, 17, 0)
const banc = await demarrer({ horlogeDuJour: () => horloge })
// Playwright n'est pas une dépendance du dépôt : pris parmi les modules globaux, sans ses types.
let navigateur: any = null
try {
  const cookie = await inscrireProfil(banc.url, 'rose', 'Rose', '🦈')
  {
    // Sa partie du jour, finie : la page ouvre son classement.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('rose') as { id: string }).id
    db.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES ('2026-11-09', ?, '[]', 1)`).run(
      JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 }))),
    )
    db.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-11-09', ?, 10, NULL, 1198, 7, ?, 0)`,
    ).run(id, horloge - 3600_000, horloge - 3480_000)
    db.close()
  }

  const ouvrir = async (memoire: string) => {
    navigateur = await chromium.launch({
      headless: true,
      channel: 'chromium',
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-gpu-rasterization', `--force-gpu-mem-available-mb=${memoire}`],
    })
    const contexte = await navigateur.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: DENSITE, hasTouch: true, isMobile: true })
    const [nom, valeur] = cookie.split('=')
    await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    // Le classement relevé à la place de celui du banc, et le thème de la joueuse — peint, sans l'avoir acheté.
    await page.route('**/api/jour/classement**', (route: any) =>
      route.fulfill({ json: { periode: '2026-11-09', joueurs: lignes.length, lignes, sienne: 'moi', fige: false } }),
    )
    await page.route('**/api/joueur/moi**', async (route: any) => {
      const reponse = await route.fetch()
      const corps = await reponse.json().catch(() => null)
      if (corps?.profile) corps.profile.theme = theme === 'velours' ? null : theme
      await route.fulfill({ response: reponse, json: corps })
    })
    await page.goto(`${banc.url}/jour#classement`)
    await page.waitForSelector('.leaderboard .lb-row', { timeout: 20000 })
    return { contexte, page }
  }

  // 1. Les calques, la mémoire large : ce que la page demande à la carte graphique, l'entrée des lignes finie.
  {
    const { contexte, page } = await ouvrir('512')
    await page.waitForTimeout(4000)
    const cdp = await contexte.newCDPSession(page)
    // L'arbre des calques ne se redit que s'il change : sous un thème où rien
    // ne bouge, une sonde d'un pixel le fait changer — et ne se compte pas.
    // Le premier arbre part avant que chaque calque sache son nœud : le
    // dernier reçu en une seconde et demie les nomme tous.
    let calques: any[] = []
    cdp.on('LayerTree.layerTreeDidChange', (e: any) => {
      if (e.layers) calques = e.layers
    })
    await cdp.send('DOM.enable')
    await cdp.send('DOM.getDocument', { depth: 0 })
    await cdp.send('LayerTree.enable')
    await page.waitForTimeout(500)
    await page.evaluate(`(() => { const s = document.createElement('i'); s.className = 'sonde-des-calques'; s.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;will-change:opacity'; document.body.appendChild(s) })()`)
    await page.waitForTimeout(1000)
    if (!calques.length) throw new Error('L’arbre des calques n’est pas venu : rien à relever')
    const parNoeud = new Map<string, { n: number; surface: number; raisons: Set<string> }>()
    for (const c of calques) {
      if (!c.drawsContent || (c.width <= 1 && c.height <= 1)) continue
      let quoi = '(la page)'
      if (c.backendNodeId) {
        try {
          const { node } = await cdp.send('DOM.describeNode', { backendNodeId: c.backendNodeId })
          const attributs: string[] = node.attributes ?? []
          const i = attributs.indexOf('class')
          quoi = node.nodeName.toLowerCase() + (i >= 0 ? '.' + attributs[i + 1].split(' ').slice(0, 2).join('.') : '') + (node.pseudoType ? '::' + node.pseudoType : '')
        } catch {
          quoi = '(nœud parti)'
        }
      }
      const raisons: string[] = await cdp.send('LayerTree.compositingReasons', { layerId: c.layerId }).then((r: any) => r.compositingReasonIds ?? [], () => [])
      const vu = parNoeud.get(quoi) ?? { n: 0, surface: 0, raisons: new Set<string>() }
      vu.n++
      vu.surface += c.width * c.height
      for (const r of raisons) vu.raisons.add(r)
      parNoeud.set(quoi, vu)
    }
    const surface = [...parNoeud.values()].reduce((s, v) => s + v.surface, 0)
    const dessines = [...parNoeud.values()].reduce((s, v) => s + v.n, 0)
    // La sonde écartée du compte, comme de la liste.
    const tous = calques.filter(c => !(c.width <= 1 && c.height <= 1)).length
    console.log(`${tous} calques sous « ${theme} », dont ${dessines} dessinés : ${Math.round((surface * DENSITE * DENSITE * 4) / 1e6)} Mo à la densité ${DENSITE} :`)
    for (const [quoi, v] of [...parNoeud].sort((a, b) => b[1].surface - a[1].surface)) {
      console.log(`  ${String(v.n).padStart(2)} × ${quoi.padEnd(34)} ${String(Math.round((v.surface * DENSITE * DENSITE * 4) / 1e5) / 10).padStart(5)} Mo  ${[...v.raisons].join(', ')}`)
    }
    // Dans le classement, plus un seul : une ligne, un médaillon qui en garderait un se dessinerait à part — ou pas.
    const dansLaListe = [...parNoeud.keys()].filter(q => /lb-row|\.lg|\.lu|\.av|\.pt|\.dv|\.bo|\.sc/.test(q))
    console.log(dansLaListe.length ? `  → encore un calque dans le classement : ${dansLaListe.join(', ')}` : '  → aucun calque dans le classement')
    await navigateur.close()
    navigateur = null
  }

  // 2. La mémoire bornée : une photo par budget, une puis quatre secondes après l'ouverture.
  for (const memoire of budgets) {
    const { page } = await ouvrir(memoire)
    for (const [n, attente] of [['1-une-seconde', 1000], ['2-quatre-secondes', 3000]] as const) {
      await page.waitForTimeout(attente)
      const fichier = path.join(sortie, `${theme}-${String(memoire).padStart(3, '0')}-mo-${n}.png`)
      await page.screenshot({ path: fichier })
      console.log(fichier)
    }
    await navigateur.close()
    navigateur = null
  }
} finally {
  if (navigateur) await navigateur.close()
  await banc.close()
}
