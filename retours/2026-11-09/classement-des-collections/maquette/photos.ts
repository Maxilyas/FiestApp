// Maquette — le classement des collections (le 9 novembre 2026).
//
// « Un classement des joueurs en fonction de leur progression mais aussi de
// la collection […] savoir si on a une meilleure collection qu'eux, qui a le
// plus de maîtres dans le sentier, le Cabinet […] Donner une valeur à la
// collection » (le propriétaire) : trois propositions, de la plus sobre à la
// plus créative, posées dans le vrai client derrière une page de maquette
// (`/classement?p=1|2|3`, `prototype.patch`), photographiées au téléphone en
// 360 × 640 sur un serveur jetable — le premier écran tel qu'il s'ouvre, la
// page entière, ce qui s'ouvre au toucher. Les joueurs sont inventés
// (`client/src/views/classement/donnees.ts`) ; leurs avatars, leurs
// finitions, leurs bordures et leurs légendaires sont les vrais dessins.
//
//   git apply retours/2026-11-09/classement-des-collections/maquette/prototype.patch && npm run build -w client
//   cd server && npx tsx ../retours/2026-11-09/classement-des-collections/maquette/photos.ts ../export/classement-des-collections [mots,…]
//
// Le second argument ne photographie que les états dont le nom contient l'un
// de ses mots (`p2` : le tableau d'honneur seul). Chaque photo dit si la page
// déborde de côté, et combien défile ce qui défile (`mesures.txt`).
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { demarrer } from '../../../../server/test/banc'

const sortie = path.resolve(process.argv[2] ?? 'classement-des-collections')
const seulement = process.argv[3]?.split(',')
const retenu = (nom: string) => !seulement || seulement.some(mot => nom.includes(mot))
mkdirSync(sortie, { recursive: true })
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

interface Etat {
  nom: string
  /** L'adresse, après `/classement`. */
  adresse: string
  theme?: 'ivoire'
  /** La page entière, en plus du premier écran. */
  entiere?: boolean
  /** Une feuille ouverte : la photo de son bas, en plus. */
  feuilleEntiere?: boolean
  /** Un geste avant la photo : toucher ce sélecteur. */
  toucher?: string
  /** La page défilée jusqu'à ce sélecteur, en haut de l'écran. */
  defiler?: string
}

const ETATS: readonly Etat[] = [
  { nom: '0-entree-du-profil', adresse: '?vue=entree&p=1' },
  { nom: 'p1-1-palmares', adresse: '?p=1', entiere: true },
  { nom: 'p1-2-maitres', adresse: '?p=1&axe=maitres' },
  { nom: 'p1-3-legendaires', adresse: '?p=1&axe=legendaires' },
  { nom: 'p1-4-cabinet', adresse: '?p=1&axe=cabinet' },
  { nom: 'p1-5-mes-amis', adresse: '?p=1&amis' },
  { nom: 'p1-6-face-a-face-hugo', adresse: '?p=1&face=hugo', feuilleEntiere: true },
  { nom: 'p1-7-bareme', adresse: '?p=1&bareme', entiere: true },
  { nom: 'p1-8-palmares-ivoire', adresse: '?p=1', theme: 'ivoire' },
  { nom: 'p2-1-tableau', adresse: '?p=2', entiere: true },
  { nom: 'p2-2-record-maitres', adresse: '?p=2&record=maitres', feuilleEntiere: true },
  { nom: 'p2-3-record-cabinet', adresse: '?p=2&record=cabinet' },
  { nom: 'p2-4-comparaison-malik', adresse: '?p=2&face=malik', feuilleEntiere: true },
  { nom: 'p2-5-comparaison-zoe', adresse: '?p=2&face=zoe', feuilleEntiere: true },
  { nom: 'p2-6-tableau-ivoire', adresse: '?p=2', theme: 'ivoire' },
  { nom: 'p3-1-galerie', adresse: '?p=3', entiere: true },
  { nom: 'p3-2-vitrine-hugo', adresse: '?p=3&vitrine=hugo', feuilleEntiere: true },
  { nom: 'p3-3-vitrine-zoe', adresse: '?p=3&vitrine=zoe', feuilleEntiere: true },
  { nom: 'p3-4-bataille-malik', adresse: '?p=3&bataille=malik', feuilleEntiere: true },
  { nom: 'p3-5-bataille-hugo', adresse: '?p=3&bataille=hugo', feuilleEntiere: true },
  { nom: 'p3-6-galerie-ivoire', adresse: '?p=3', theme: 'ivoire' },
  // La synthèse (`?p=4`), les Divins comptés et mis en avant.
  { nom: 's-00-entree-du-profil', adresse: '?vue=entree&p=4' },
  { nom: 's-01-collectionneurs', adresse: '?p=4', entiere: true },
  { nom: 's-02-les-divins', adresse: '?p=4', defiler: '.cl-divins' },
  { nom: 's-03-les-records', adresse: '?p=4', defiler: '.cl-etagere' },
  { nom: 's-04-le-classement', adresse: '?p=4', defiler: '.cl-liste' },
  { nom: 's-05-mes-amis', adresse: '?p=4&amis', defiler: '.cl-liste' },
  { nom: 's-06-vitrine-max', adresse: '?p=4&vitrine=max', feuilleEntiere: true },
  { nom: 's-07-vitrine-zoe', adresse: '?p=4&vitrine=zoe', feuilleEntiere: true },
  { nom: 's-08-vitrine-hugo', adresse: '?p=4&vitrine=hugo' },
  { nom: 's-09-bataille-malik', adresse: '?p=4&bataille=malik', feuilleEntiere: true },
  { nom: 's-10-bataille-max', adresse: '?p=4&bataille=max', feuilleEntiere: true },
  { nom: 's-11-record-maitres', adresse: '?p=4&record=maitres' },
  { nom: 's-12-bareme', adresse: '?p=4&bareme', defiler: '.cl-bareme' },
  { nom: 's-13-ivoire', adresse: '?p=4', theme: 'ivoire' },
  { nom: 's-14-ivoire-divins', adresse: '?p=4', theme: 'ivoire', defiler: '.cl-divins' },
]

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
const mesures: string[] = []

try {
  const ctx = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  page.on('console', (m: any) => m.type() === 'error' && console.error('[console]', m.text()))

  /** Ce que la photo dit d'elle : la page déborde-t-elle de côté, et ce qui défile, de combien. */
  const mesurer = (): Promise<string> =>
    page.evaluate(`(() => {
      const large = document.documentElement.scrollWidth > innerWidth ? ' · DÉBORDE EN LARGEUR de ' + (document.documentElement.scrollWidth - innerWidth) + ' px' : ''
      const corps = document.querySelector('.carte-corps')
      const feuille = corps ? ' · feuille ' + corps.clientHeight + ' px' + (corps.scrollHeight > corps.clientHeight + 1 ? ', défile de ' + (corps.scrollHeight - corps.clientHeight) + ' px' : ', tient en entier') : ''
      const trop = [...document.querySelectorAll('.cl-nom b, .cl-detail, .cl-record-qui b, .cl-carte-nom, .cl-piece > span:last-child, .cl-socle b')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0, 24))
      return 'page ' + document.documentElement.scrollHeight + ' px' + feuille + large + (trop.length ? ' · coupés : ' + trop.join(' | ') : '')
    })()`)

  const attendre = async () => {
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
    await page.waitForTimeout(900)
  }

  for (const e of ETATS.filter(x => retenu(x.nom))) {
    await page.goto('about:blank')
    await page.goto(`${banc.url}/classement${e.adresse}`)
    await page.waitForSelector('.player-shell')
    // Ivoire vit dans `styles.css` : sans profil, la page le reçoit de la main, après la confirmation du thème.
    if (e.theme) {
      await page.waitForTimeout(400)
      await page.evaluate(`document.documentElement.dataset.theme = '${e.theme}'`)
    }
    if (e.toucher) await page.tap(e.toucher)
    // Défilée en texte : une fonction passée à `evaluate` partirait avec les `__name` de tsx, que la page ne connaît pas.
    if (e.defiler) await page.evaluate(`document.querySelector('${e.defiler}').scrollIntoView({ block: 'start' }); window.scrollBy(0, -14)`)
    await attendre()
    const vu = await mesurer()
    mesures.push(`${e.nom} : ${vu}`)
    console.log(`${e.nom} : ${vu}`)
    await page.screenshot({ path: path.join(sortie, `${e.nom}.png`) })
    if (e.entiere) {
      // La page entière dans un écran aussi haut qu'elle : en `fullPage`, la barre du menu, fixe, restait au milieu de la photo.
      const haut = (await page.evaluate('document.documentElement.scrollHeight')) as number
      await page.setViewportSize({ width: 360, height: haut })
      await page.waitForTimeout(400)
      await page.screenshot({ path: path.join(sortie, `${e.nom}-entiere.png`) })
      await page.setViewportSize({ width: 360, height: 640 })
    }
    if (e.feuilleEntiere) {
      // Le bas de la feuille, défilée jusqu'au bout : ce qu'on y lit en descendant.
      const defile = await page.evaluate(`(() => { const c = document.querySelector('.carte-corps'); if (!c || c.scrollHeight <= c.clientHeight + 1) return false; c.scrollTop = c.scrollHeight; return true })()`)
      if (defile) {
        await page.waitForTimeout(500)
        await page.screenshot({ path: path.join(sortie, `${e.nom}-bas.png`) })
      }
    }
  }
  writeFileSync(path.join(sortie, 'mesures.txt'), mesures.join('\n') + '\n')
  console.log(`\n${mesures.length} états photographiés dans ${sortie}`)
} finally {
  await navigateur.close()
  await banc.close()
}
