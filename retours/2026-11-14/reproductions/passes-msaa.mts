// Le classement du jour en friture sur un téléphone Android : ce que Chrome
// fait de la page, relevé dans sa trace — faute de pouvoir rejouer la panne,
// qui est celle d'une carte graphique (`retours/2026-11-14/friture.md`).
//
// La question : la page se peint-elle en multi-échantillonnage (MSAA) ? Le
// classement du 13 novembre 2026 à ses avatars près — au rang 3, un légendaire
// éclaté aux Abysses sous une plaque sombre, comme sur la capture —, ouvert
// dans un Chromium à rastérisation graphique, quatre échantillons comme sur
// Android, en 360 × 739 à la densité 2. La trace de Skia nomme chaque
// opération : `StrokeTessellateOp` est un trait tracé en MSAA (les tentacules
// des méduses), que Chrome ne choisit que pour un calque qu'il peint en MSAA
// dynamique ; `AAHairlineOp`, le même trait lissé à part, sans MSAA.
//
// Ce qu'il a montré, le 14 novembre 2026 (Chromium 153) : sans le point sans
// lissage de l'avatar (`?sans=sonde`), des centaines de traits tracés en MSAA
// (562 à 874 selon l'essai : le compte suit les images peintes) ; avec lui —
// la page de tous —, aucun, et autant lissés à part. La photo est la même à
// l'œil (594 pixels sur un million à plus de 24 niveaux d'écart, sur les
// bords). Il ne dit rien de la friture elle-même : elle ne se lit que sur le
// téléphone.
//
//   npm run build -w client
//   cd server && [THEME=guinguette] npx tsx ../retours/2026-11-14/reproductions/passes-msaa.mts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { demarrer, inscrireProfil } from '../../../server/test/banc'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const Database = createRequire(path.join(RACINE, 'server/package.json'))('better-sqlite3')
// Playwright n'est pas une dépendance du dépôt : pris parmi les modules globaux, sans ses types.
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

const sortie = path.resolve(process.argv[2] ?? path.join(RACINE, 'export/rendus/passes-msaa'))
mkdirSync(sortie, { recursive: true })
const theme = process.env.THEME ?? 'guinguette'

/** Le classement du 13 novembre 2026, à ses avatars près : des prénoms inventés. */
const lignes = [
  { profileId: 'p1', nom: 'Agathe', avatar: '🦁', niveau: 9, finition: 'argent', eclat: true, points: 1558, rang: 1 },
  { profileId: 'p2', nom: 'Jeanne', avatar: '🦔', niveau: 17, finition: 'holo', legendaire: 'lg:renard', laurier: 1, bordure: { ligue: 'platine', crans: 4 }, points: 1400, rang: 2 },
  // Celui dont l'avatar perd ses tuiles : aux Abysses, son légendaire éclaté, sa plaque sombre.
  { profileId: 'p3', nom: 'Basile', avatar: '🐳', niveau: 30, finition: 'abysses', legendaire: 'lg:ouroboros', eclat: true, plaque: 'halloween', points: 1390, rang: 3 },
  { profileId: 'p4', nom: 'Louise', avatar: '🦓', niveau: 23, finition: 'envol', legendaire: 'br:lynx', bordure: { ligue: 'or', crans: 7 }, points: 1300, rang: 4 },
  { profileId: 'p5', nom: 'Félix', avatar: '🦊', niveau: 22, finition: 'aurore', legendaire: 'lg:coq', plaque: 'braises', points: 1200, rang: 5 },
  { profileId: 'p6', nom: 'Perrine', avatar: '🐳', niveau: 19, finition: 'prisme', legendaire: 'cp:panda-sakura', eclat: true, bordure: { ligue: 'bronze', crans: 3 }, points: 1200, rang: 5 },
  { profileId: 'moi', nom: 'Rose', avatar: '🦈', niveau: 22, finition: 'aurore', legendaire: 'lg:lion', laurier: 'argent', bordure: { ligue: 'platine', crans: 6 }, plaque: 'guinguette', points: 1198, rang: 7 },
  { profileId: 'p8', nom: 'Achille', avatar: '🦉', niveau: 28, finition: 'constellation', legendaire: 'cp:tortue-fleurs', points: 997, rang: 8 },
]

const horloge = Date.parse('2026-11-13T19:00:00Z')
const JOUR = '2026-11-13'
const banc = await demarrer({ horlogeDuJour: () => horloge })
let navigateur: any = null
try {
  const cookie = await inscrireProfil(banc.url, 'rose', 'Rose', '🦈')
  {
    // Sa partie du jour, finie : la page ouvre son classement.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('rose') as { id: string }).id
    db.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES ('${JOUR}', ?, '[]', 1)`).run(
      JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 }))),
    )
    db.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '${JOUR}', ?, 10, NULL, 1198, 7, ?, 0)`,
    ).run(id, horloge - 3600_000, horloge - 3480_000)
    db.close()
  }

  const relever = async (nom: string, adresse: string) => {
    navigateur = await chromium.launch({
      headless: true,
      channel: 'chromium',
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-gpu-rasterization', '--gpu-rasterization-msaa-sample-count=4'],
    })
    const contexte = await navigateur.newContext({ viewport: { width: 360, height: 739 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
    const [cle, valeur] = cookie.split('=')
    await contexte.addCookies([{ name: cle, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.route('**/api/jour/classement**', (route: any) =>
      route.fulfill({ json: { periode: JOUR, joueurs: lignes.length, lignes, sienne: 'moi', fige: false } }),
    )
    await page.route('**/api/joueur/moi**', async (route: any) => {
      const reponse = await route.fetch()
      const corps = await reponse.json().catch(() => null)
      if (corps?.profile) corps.profile.theme = theme === 'velours' ? null : theme
      await route.fulfill({ response: reponse, json: corps })
    })
    await page.clock.setFixedTime(new Date(horloge))
    await navigateur.startTracing(page, { categories: ['disabled-by-default-skia.gpu'] })
    await page.goto(banc.url + adresse)
    await page.waitForSelector('.leaderboard .lb-row', { timeout: 20000 })
    await page.waitForTimeout(3500)
    const photo = path.join(sortie, `${nom}.png`)
    await page.screenshot({ path: photo })
    const trace = JSON.parse((await navigateur.stopTracing()).toString('utf8'))
    await navigateur.close()
    navigateur = null
    // Chaque opération de dessin de Skia, comptée une fois (son début) : les noms en `Op`.
    const operations = new Map<string, number>()
    for (const e of trace.traceEvents ?? trace) {
      if (e.cat !== 'disabled-by-default-skia.gpu' || !['X', 'B'].includes(e.ph) || e.name.includes('::') || !e.name.endsWith('Op')) continue
      operations.set(e.name, (operations.get(e.name) ?? 0) + 1)
    }
    const tri = [...operations].sort((a, b) => b[1] - a[1])
    console.log(`${nom} (${adresse}) — ${photo}`)
    console.log('  ' + tri.map(([n, c]) => `${n} ${c}`).join(' · '))
    return operations
  }

  const avec = await relever('la-page-de-tous', '/jour#classement')
  const sans = await relever('sans-le-point', '/jour?sans=sonde#classement')
  const traits = (o: Map<string, number>) => o.get('StrokeTessellateOp') ?? 0
  console.log(`traits tracés en MSAA : ${traits(sans)} sans le point, ${traits(avec)} avec`)
  if (!traits(sans)) console.log('  → ce Chromium ne peint pas en MSAA : rien à comparer (carte graphique émulée absente ?)')
  else if (traits(avec)) {
    console.log('  → le point ne fait plus renoncer au MSAA : la règle de Chrome a changé, ou il ne se peint plus')
    process.exitCode = 1
  }
} finally {
  if (navigateur) await navigateur.close()
  await banc.close()
}
