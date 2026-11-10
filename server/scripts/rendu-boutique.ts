// La boutique (`/boutique`), photographiée et mesurée au téléphone sur un serveur jetable, du petit téléphone de
// référence au grand : l'arrivée — une habituée, son loup dans sa niche, 1400 confettis ; un nouveau venu, 80 confettis
// et son envie en tête —, chaque rayon par son segment, le présentoir de chaque sorte d'article — un thème feuilleté, son
// étoile, « L'acheter » puis « Confirmer », « Le porter » ; un compagnon, ses formes, son essai dans la niche, « Garder » ;
// un fond sur sa carte ; un objet et sa quantité ; ce qui est trop cher et son envie —, la barre de l'essai, la feuille de
// ce qu'on essaie, « Tes confettis », le texte agrandi à 130 %, une tablette, l'Ivoire.
//
// En grilles depuis le 10 novembre 2026 (la maquette validée par le propriétaire, `retours/2026-11-10/boutique/` :
// « J'ai l'impression que les utilisateurs ont du mal et ne voient pas grand-chose sur leur téléphone ») : en 360 × 640,
// la boutique d'avant montrait un article entier à l'arrivée et faisait 3587 px de haut, 6,2 écrans. Le script sort en
// erreur si ce qui est gagné se perd : le compte des thèmes entiers à l'arrivée (`THEMES_ENTIERS`), la hauteur de la
// page en écrans (`ECRANS_AU_PLUS`), les cinq compagnons sur une rangée, un nom coupé sur une tuile, « Confirmer » ailleurs
// que sous « L'acheter », un présentoir qui défile ou dont les gestes sortent de l'écran, la barre de l'essai sur le
// menu, un rayon sous la niche ; et, partout, une page plus large que l'écran, une cible de doigt sous 44 px, un texte
// sous 11 px.
// Le client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-boutique.ts [dossier]     # sans dossier : export/boutique
//   SEULEMENT=arrivee,presentoirs npx tsx scripts/rendu-boutique.ts
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { demarrer, inscrireProfil } from '../test/banc'

const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.resolve(process.argv[2] ?? path.join(ici, '../../export/boutique'))
mkdirSync(sortie, { recursive: true })
const seulement = (process.env.SEULEMENT ?? '').split(',').filter(Boolean)
const retenu = (nom: string) => !seulement.length || seulement.includes(nom)
const depuisLeServeur = createRequire(path.join(ici, '../package.json'))
const Database = depuisLeServeur('better-sqlite3')
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

type Ecran = [number, number]
/**
 * Le petit téléphone de référence, un iPhone dans Safari (ses barres dépliées), un moyen, un grand Android dans Chrome,
 * un iPhone d'aujourd'hui en application installée, un grand Android.
 */
const TOUS_LES_ECRANS: Ecran[] = [[360, 640], [390, 664], [360, 740], [412, 800], [390, 844], [412, 915]]
const DEUX_ECRANS: Ecran[] = [[360, 640], [390, 844]]

/**
 * Combien de thèmes l'arrivée montre entiers au-dessus du menu, au moins, pour chaque hauteur d'écran — l'habituée,
 * sa niche au coin, sans envie posée (mesuré le 10 novembre 2026 ; un seul article entier avant, à toutes les
 * tailles). Une ligne de plus au-dessus de la grille, une tuile plus haute : le compte baisse, et le script le dit.
 */
const THEMES_ENTIERS: Record<number, number> = { 640: 9, 664: 9, 740: 9, 800: 12, 844: 12, 915: 15 }
/** Avec son envie en tête (62 px et son écart) : une rangée de moins là où la dernière tenait à quelques pixels. */
const THEMES_ENTIERS_AVEC_ENVIE: Record<number, number> = { 640: 6, 664: 6, 740: 9, 800: 9, 844: 12, 915: 12 }
/** La hauteur de la page, en écrans visibles au-dessus du menu, au plus — 6,2 avant, en 360 × 640. */
const ECRANS_AU_PLUS = 4.2
/** Une cible de doigt, au moins — à un demi-pixel près. */
const CIBLE = 44
/** Une cible d'avant, plus basse, que cette refonte n'a pas touchée : « Fermer », en tête de toute feuille (`Feuille`, 40 px). */
const D_AVANT: Record<string, number> = { fermer: 40 }
/** Le plus petit texte permis : les 11 px de `--t-label`. */
const PLANCHER = 11

/**
 * Ce que la page mesure : le pli (le haut de la barre du menu), la hauteur de la page, chaque rayon, les tuiles
 * entières au-dessus du pli, ce qui est coupé, les cibles de doigt, le plus petit texte, la feuille ouverte. En
 * texte : `tsx` y glisserait des `__name`.
 */
const LA_PAGE = `(() => {
  const boite = s => {
    const el = typeof s === 'string' ? document.querySelector(s) : s
    if (!el) return null
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1 ? { haut: Math.round(r.top), bas: Math.round(r.bottom), gauche: Math.round(r.left), droite: Math.round(r.right), l: Math.round(r.width * 2) / 2, h: Math.round(r.height * 2) / 2 } : null
  }
  const visible = e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.clipPath !== 'inset(50%)' && r.width > 2 && r.height > 2 }
  const menu = document.querySelector('.menu-barre')
  const pli = Math.round(menu ? menu.getBoundingClientRect().top : innerHeight)
  const feuille = document.querySelector('.carte-feuille')
  const corps = document.querySelector('.carte-feuille .carte-corps')
  const entieres = sel => [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= pli + 0.5 && r.left >= 0 && r.right <= innerWidth + 0.5 }).length
  const rayons = [...document.querySelectorAll('.rayon-de-la-boutique')].map(s => ({ id: s.id.replace('rayon-', ''), titre: s.querySelector('h2')?.textContent, ligne: s.querySelector('.rayon-tete p')?.textContent, h: Math.round(s.getBoundingClientRect().height) }))
  // Coupé : un nom plus large ou plus haut que sa boîte — sur une tuile, dans un médaillon, au comptoir, dans le présentoir.
  // Une feuille ouverte, on ne lit qu'elle : la page de dessous est inerte.
  const coupes = [...(feuille || document).querySelectorAll('.article-nom, .compagnon-vitrine-nom, .objet-nom, .rayon-tete h2, .rayon-tete p, .presentoir-nom, .presentoir-gestes .btn, .boutique-panier .btn, .boutique-panier-texte b, .carte-envie-nom, .boutique-rayons a')]
    .filter(e => visible(e) && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1))
    .map(e => e.textContent.trim().slice(0, 40))
  // Les cinq compagnons : une seule rangée, tous à la même hauteur.
  const hauts = [...document.querySelectorAll('.rang-des-compagnons > li')].map(e => Math.round(e.getBoundingClientRect().top))
  const colonnes = sel => new Set([...document.querySelectorAll(sel)].map(e => Math.round(e.getBoundingClientRect().left))).size
  // Les cibles de doigt : ce qu'on touche, par sa boîte.
  const cibles = {}
  const racine = feuille || document
  for (const [nom, sel] of feuille
    ? [['fermer', '.carte-fermer'], ['un rond de la barre', '.presentoir-rond'], ['un geste', '.presentoir-gestes .btn'], ['une forme', '.compagnon-forme'], ['un pas', '.vies-pas-btn'], ['retirer', '.boutique-panier-annuler'], ['installer', '.compagnon-installer']]
    : [['un rayon', '.boutique-rayons a'], ['le solde', '.solde-puce'], ['son envie', '.carte-envie'], ['un thème', '.article-theme'], ['un compagnon', '.compagnon-vitrine'], ['un fond', '.article-fond'], ['un objet', '.comptoir-objet'], ['les porter', '.rayon-suite .link-inline'], ['retirer', '.boutique-panier-annuler'], ['garder', '.boutique-panier .btn']]) {
    const tous = [...racine.querySelectorAll(sel)].filter(visible).map(e => e.getBoundingClientRect())
    if (tous.length) cibles[nom] = { l: Math.round(Math.min(...tous.map(r => r.width)) * 2) / 2, h: Math.round(Math.min(...tous.map(r => r.height)) * 2) / 2 }
  }
  // Le plus petit texte qu'on lit, hors de la barre du menu (la sienne, d'avant).
  let petit = null
  const marche = document.createTreeWalker(feuille || document.querySelector('.player-shell'), NodeFilter.SHOW_TEXT)
  for (let n = marche.nextNode(); n; n = marche.nextNode()) {
    const e = n.parentElement
    if (!n.textContent.trim() || !e || e.closest('.menu-barre, .niche') || !visible(e)) continue
    const taille = parseFloat(getComputedStyle(e).fontSize)
    if (!petit || taille < petit.taille) petit = { taille: Math.round(taille * 10) / 10, texte: n.textContent.trim().slice(0, 30) }
  }
  const gestes = [...document.querySelectorAll('.carte-feuille .presentoir-gestes .btn')].map(b => ({ nom: b.textContent.trim(), ...boite(b), principal: b.classList.contains('btn-primary'), presse: b.getAttribute('aria-pressed') }))
  return {
    pli,
    page: document.documentElement.scrollHeight,
    large: document.documentElement.scrollWidth > innerWidth,
    themes: entieres('.article-theme'),
    articles: entieres('.article-boutique, .compagnon-vitrine, .comptoir-objet'),
    colonnesDesThemes: colonnes('.grille-themes > li'),
    colonnesDesFonds: colonnes('.grille-fonds > li'),
    rangeesDesCompagnons: new Set(hauts).size,
    rayons,
    barre: boite('.boutique-rayons-defile'),
    niche: boite('.niche'),
    envie: boite('.carte-envie'),
    panier: boite('.boutique-panier'),
    coupes,
    cibles,
    petit,
    feuille: feuille ? { ...boite(feuille), titre: feuille.getAttribute('aria-label'), defile: corps ? corps.scrollHeight - corps.clientHeight : 0, rang: feuille.querySelector('.presentoir-rang')?.textContent ?? '', etoile: feuille.querySelector('.presentoir-etoile')?.getAttribute('aria-pressed') ?? null, gestes } : null,
  }
})()`

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
const mesures: Record<string, any> = {}
let rate = 0
const dire = (texte: string) => {
  rate++
  console.error(`  ✗ ${texte}`)
}

try {
  // Tom vient d'arriver : 80 confettis. Léa est une habituée : 1400, deux thèmes à elle, son loup dans sa niche.
  // Zoé a de quoi tout acheter : c'est elle qui achète, pour que les mesures des deux autres ne bougent pas.
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐼')
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐸')
  const idDe = async (cookie: string) => ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id as string
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const don = db.prepare(`INSERT INTO profile_dons (id, profile_id, confettis, mot, created_at) VALUES (?, ?, ?, NULL, 1)`)
  don.run('don-tom', await idDe(tom), 80)
  don.run('don-lea', await idDe(lea), 1400)
  don.run('don-zoe', await idDe(zoe), 6000)
  const achat = db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, 1)')
  for (const theme of ['neige', 'ocean']) achat.run(await idDe(lea), theme)
  db.prepare(`INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, nom, created_at) VALUES (?, 'loup', 0, 1, 'Croc', 1)`).run(await idDe(lea))
  db.close()
  await banc.redemarrer()
  // L'envie de Tom, par la vraie route : le thème Jungle.
  const poserLEnvie = (cookie: string, envie: object | null) =>
    fetch(`${banc.url}/api/joueur/envie`, { method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' }, body: JSON.stringify({ envie }) })
  const posee = await poserLEnvie(tom, { sorte: 'theme', cle: 'jungle' })
  if (!posee.ok) dire(`l'envie de Tom ne s'est pas posée : ${posee.status}`)

  const ouvrir = async (cookie: string, [l, h]: Ecran, adresse = '/boutique', agrandi = false) => {
    const ctx = await navigateur.newContext({ viewport: { width: l, height: h }, deviceScaleFactor: 2, isMobile: l < 700, hasTouch: true })
    const [nom, valeur] = cookie.split('=')
    await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => dire(`la page a levé : ${e.message}`))
    await page.goto(`${banc.url}${adresse}`)
    await page.waitForSelector('.la-boutique .rayon-de-la-boutique')
    // Le texte agrandi par le téléphone : la racine à 130 %, tout ce qui se mesure en `rem` le suit.
    if (agrandi) await page.addStyleTag({ content: 'html { font-size: 130%; }' })
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(900)
    return { ctx, page }
  }
  const photo = async (page: any, nom: string, attente = 350) => {
    await page.waitForTimeout(attente)
    await page.screenshot({ path: path.join(sortie, `${nom}.png`) })
  }
  /** La page entière : on la fait défiler d'abord (les images viennent quand leur case se montre), puis l'écran prend sa hauteur. */
  const entiere = async (page: any, nom: string, [l, h]: Ecran) => {
    const haut = (await page.evaluate('document.documentElement.scrollHeight')) as number
    for (let y = 0; y < haut; y += 500) {
      await page.evaluate(`scrollTo(0, ${y})`)
      await page.waitForTimeout(100)
    }
    await page.evaluate('scrollTo(0, 0)')
    await page.setViewportSize({ width: l, height: haut })
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(sortie, `${nom}-entiere.png`) })
    await page.setViewportSize({ width: l, height: h })
  }
  const mesurer = async (page: any, nom: string) => {
    const m = (await page.evaluate(LA_PAGE)) as any
    mesures[nom] = m
    return m
  }
  /** Ce qui vaut pour toute photo : rien de plus large que l'écran, ni cible trop petite, ni texte trop petit, ni nom coupé. */
  const partout = (nom: string, m: any, { agrandi = false } = {}) => {
    if (m.large) dire(`${nom} : LA PAGE EST PLUS LARGE QUE L'ÉCRAN`)
    for (const [quoi, c] of Object.entries(m.cibles) as [string, { l: number; h: number }][]) {
      const plancher = D_AVANT[quoi] ?? CIBLE
      if (c.h < plancher - 0.5 || c.l < plancher - 0.5) dire(`${nom} : ${quoi} se touche sur ${c.l} × ${c.h} px, sous ${plancher}`)
    }
    if (m.petit && m.petit.taille < (agrandi ? PLANCHER * 1.3 : PLANCHER) - 0.05) dire(`${nom} : un texte de ${m.petit.taille} px (« ${m.petit.texte} »)`)
    if (m.coupes.length && !agrandi) dire(`${nom} : COUPÉ — ${m.coupes.join(' | ')}`)
  }
  const fermer = async (page: any) => {
    await page.locator('.carte-feuille .carte-fermer').tap()
    await page.waitForSelector('.carte-feuille', { state: 'detached' })
  }
  const geste = (page: any, nom: string) => page.locator('.carte-feuille .presentoir-gestes .btn', { hasText: nom })

  // ── L'arrivée : ce qu'on voit sans défiler, à chaque taille ──
  if (retenu('arrivee')) {
    for (const [qui, cookie, attendu] of [['lea', lea, THEMES_ENTIERS], ['tom', tom, THEMES_ENTIERS_AVEC_ENVIE]] as const) {
      for (const ecran of TOUS_LES_ECRANS) {
        const nom = `arrivee-${qui}-${ecran[0]}x${ecran[1]}`
        const { ctx, page } = await ouvrir(cookie, ecran)
        const m = await mesurer(page, nom)
        const ecrans = m.page / m.pli
        console.log(`${nom} — pli ${m.pli} · page ${m.page} px (${ecrans.toFixed(1)} écrans) · ${m.themes} thèmes entiers, ${m.articles} articles · ${m.colonnesDesThemes} thèmes et ${m.colonnesDesFonds} fonds par rangée · le plus petit texte ${m.petit?.taille} px`)
        for (const r of m.rayons) console.log(`   ${r.id} « ${r.titre} » — ${r.ligne} · ${r.h} px`)
        partout(nom, m)
        if (m.themes < attendu[ecran[1]]) dire(`${nom} : ${m.themes} thèmes entiers à l'arrivée, ${attendu[ecran[1]]} attendus`)
        if (ecrans > ECRANS_AU_PLUS) dire(`${nom} : la page fait ${ecrans.toFixed(1)} écrans, plus de ${ECRANS_AU_PLUS}`)
        if (m.rangeesDesCompagnons !== 1) dire(`${nom} : les compagnons sont sur ${m.rangeesDesCompagnons} rangées`)
        if (qui === 'tom' && !m.envie) dire(`${nom} : son envie n'est pas en tête`)
        if (qui === 'lea' && !m.niche) dire(`${nom} : sa niche n'est pas au coin`)
        await photo(page, nom)
        // La rangée des rayons, collée, s'arrête avant la niche repliée : la page défilée, rien ne passe dessous.
        await page.evaluate('scrollTo(0, 700)')
        await page.waitForTimeout(500)
        const colle = (await page.evaluate(LA_PAGE)) as any
        if (colle.niche && colle.barre && colle.barre.droite > colle.niche.gauche + 0.5 && colle.barre.bas > colle.niche.haut) dire(`${nom} : LA RANGÉE DES RAYONS PASSE SOUS LA NICHE (${colle.barre.droite} > ${colle.niche.gauche})`)
        if (ecran[1] === 640 || ecran[1] === 844) await entiere(page, nom, ecran)
        await ctx.close()
      }
    }
  }

  // ── Chaque rayon par son segment : son titre s'arrête sous la rangée collée ──
  if (retenu('rayons')) {
    for (const ecran of DEUX_ECRANS) {
      const { ctx, page } = await ouvrir(lea, ecran)
      for (const r of ['compagnons', 'fonds', 'objets', 'themes']) {
        const nom = `rayon-${r}-${ecran[0]}x${ecran[1]}`
        await page.locator(`.boutique-rayons a[href="#${r}"]`).tap()
        await page.waitForTimeout(900)
        const ou = (await page.evaluate(`(() => { const t = document.querySelector('#rayon-${r} h2').getBoundingClientRect(); const b = document.querySelector('.boutique-rayons').getBoundingClientRect(); return { titre: Math.round(t.top), barre: Math.round(b.bottom), fin: innerHeight + scrollY >= document.documentElement.scrollHeight - 4, ici: document.querySelector('.boutique-rayons a[aria-current]')?.textContent } })()`)) as any
        console.log(`${nom} — son titre à ${ou.titre} px, la rangée finit à ${ou.barre} · allumé : ${ou.ici}`)
        if (ou.titre < ou.barre - 1) dire(`${nom} : SON TITRE PASSE SOUS LA RANGÉE COLLÉE (${ou.titre} < ${ou.barre})`)
        partout(nom, await mesurer(page, nom))
        await photo(page, nom)
      }
      await ctx.close()
    }
  }

  // ── Le présentoir : chaque sorte d'article, l'achat en deux touchers, l'essai ──
  if (retenu('presentoirs')) {
    for (const ecran of DEUX_ECRANS) {
      const t = `${ecran[0]}x${ecran[1]}`
      // Zoé achète : un thème, feuilleté d'abord.
      const { ctx, page } = await ouvrir(zoe, ecran)
      const fiche = async (nom: string, { tient = true } = {}) => {
        // La feuille monte du bas : mesurée pendant sa montée, ses gestes seraient encore sous l'écran.
        await page.waitForTimeout(450)
        const m = await mesurer(page, nom)
        partout(nom, m)
        const f = m.feuille
        if (!f) return dire(`${nom} : pas de présentoir`), m
        console.log(`${nom} — « ${f.titre} » ${f.rang ? `(${f.rang}) ` : ''}· ${f.h} px de haut, défile de ${f.defile} · ${f.gestes.map((g: any) => `[${g.nom}]`).join(' ')}`)
        if (tient && f.defile > 1) dire(`${nom} : LE PRÉSENTOIR DÉFILE de ${f.defile} px`)
        for (const g of f.gestes) if (g.bas > ecran[1] + 0.5 || g.haut < 0) dire(`${nom} : « ${g.nom} » sort de l'écran`)
        return m
      }
      await page.locator('.article-theme').first().tap()
      await page.waitForSelector('.feuille-boutique')
      const premier = await fiche(`presentoir-theme-${t}`)
      await photo(page, `presentoir-theme-${t}`, 700)
      await page.locator('.presentoir-rond[aria-label="Le suivant"]').tap()
      await page.waitForTimeout(250)
      const second = await fiche(`presentoir-theme-suivant-${t}`)
      if (premier.feuille?.titre === second.feuille?.titre) dire(`presentoir-theme-${t} : « Le suivant » n'a rien feuilleté`)
      // Son envie : l'étoile se presse, et le dit.
      await page.locator('.presentoir-etoile').tap()
      await page.waitForSelector('.presentoir-etoile[aria-pressed="true"]', { timeout: 5000 }).catch(() => dire(`presentoir-theme-${t} : l'étoile ne s'est pas pressée`))
      await photo(page, `presentoir-theme-envie-${t}`)
      // « L'acheter », puis « Confirmer » au même endroit.
      const avant = (await mesurer(page, `presentoir-theme-avant-${t}`)).feuille.gestes.find((g: any) => g.principal)
      await geste(page, 'L’acheter').tap()
      await page.waitForTimeout(200)
      const confirmer = await fiche(`presentoir-theme-confirmer-${t}`)
      const apres = confirmer.feuille?.gestes.find((g: any) => g.principal)
      if (!apres || !/^Confirmer/.test(apres.nom)) dire(`presentoir-theme-${t} : pas de « Confirmer » après « L'acheter »`)
      else if (Math.abs(apres.gauche - avant.gauche) > 1 || Math.abs(apres.haut - avant.haut) > 1 || Math.abs(apres.l - avant.l) > 1) dire(`presentoir-theme-${t} : « CONFIRMER » N'EST PAS SOUS « L'ACHETER » (${JSON.stringify(avant)} → ${JSON.stringify(apres)})`)
      await photo(page, `presentoir-theme-confirmer-${t}`)
      await geste(page, 'Confirmer').tap()
      await page.waitForSelector('.presentoir-acquis', { timeout: 8000 }).catch(() => dire(`presentoir-theme-${t} : l'achat n'a pas abouti`))
      await fiche(`presentoir-theme-achete-${t}`)
      await photo(page, `presentoir-theme-achete-${t}`)
      await geste(page, 'Le porter').tap()
      await page.waitForSelector('.carte-feuille', { state: 'detached', timeout: 8000 }).catch(() => dire(`presentoir-theme-${t} : « Le porter » n'a pas refermé le présentoir`))
      await photo(page, `apres-le-porter-${t}`, 1200)
      // Un compagnon : sa fiche, ses formes, son essai dans la niche, « Garder ».
      await page.locator(`.boutique-rayons a[href="#compagnons"]`).tap()
      await page.waitForTimeout(700)
      await page.locator('.compagnon-vitrine').nth(1).tap()
      await page.waitForSelector('.feuille-boutique .compagnon-formes')
      await fiche(`presentoir-compagnon-${t}`, { tient: ecran[1] >= 800 })
      await photo(page, `presentoir-compagnon-${t}`, 900)
      await page.locator('.compagnon-forme').nth(3).tap()
      await photo(page, `presentoir-compagnon-forme-${t}`, 500)
      await geste(page, 'L’essayer').tap()
      await page.waitForSelector('.boutique-panier', { timeout: 5000 }).catch(() => dire(`presentoir-compagnon-${t} : pas de barre de l'essai`))
      const essai = await mesurer(page, `essai-compagnon-${t}`)
      partout(`essai-compagnon-${t}`, essai)
      if (essai.panier && essai.panier.bas > essai.pli + 0.5) dire(`essai-compagnon-${t} : LA BARRE DE L'ESSAI PASSE SUR LE MENU (${essai.panier.bas} > ${essai.pli})`)
      await page.evaluate('scrollTo(0, 0)')
      await photo(page, `essai-compagnon-${t}`, 900)
      // Un second essai, un thème : la barre en compte deux, « Voir » ouvre la feuille de ce qu'on essaie.
      await page.locator('.article-theme').nth(2).tap()
      await page.waitForSelector('.feuille-boutique')
      await geste(page, 'L’essayer').tap()
      await page.waitForSelector('.carte-feuille', { state: 'detached' })
      await photo(page, `essai-deux-${t}`, 1200)
      await page.locator('.boutique-panier .btn-primary').tap()
      await page.waitForSelector('.feuille-du-panier')
      partout(`essai-feuille-${t}`, await mesurer(page, `essai-feuille-${t}`))
      await photo(page, `essai-feuille-${t}`, 500)
      await page.locator('.feuille-du-panier .panier-ligne .boutique-panier-annuler').first().tap()
      await page.waitForTimeout(300)
      if (await page.locator('.feuille-du-panier').count()) await fermer(page)
      // Il n'en reste qu'un : « Garder » ouvre son présentoir sur « Confirmer ».
      await page.locator('.boutique-panier .btn-primary').tap()
      await page.waitForSelector('.feuille-boutique')
      const garder = await fiche(`essai-garder-${t}`, { tient: ecran[1] >= 800 })
      if (!garder.feuille?.gestes.some((g: any) => /^Confirmer/.test(g.nom))) dire(`essai-garder-${t} : « Garder » n'ouvre pas sur « Confirmer »`)
      await photo(page, `essai-garder-${t}`, 500)
      await geste(page, 'Annuler').tap()
      await fermer(page)
      await page.locator('.boutique-panier-annuler').tap()
      // Un fond : sa carte dessus.
      await page.locator(`.boutique-rayons a[href="#fonds"]`).tap()
      await page.waitForTimeout(700)
      await page.locator('.article-fond').first().tap()
      await page.waitForSelector('.feuille-boutique')
      await fiche(`presentoir-fond-${t}`)
      await photo(page, `presentoir-fond-${t}`, 700)
      await fermer(page)
      // Un objet : la vie, deux d'un coup.
      await page.locator(`.boutique-rayons a[href="#objets"]`).tap()
      await page.waitForTimeout(700)
      await page.locator('.comptoir-objet.objet-vie').tap()
      await page.waitForSelector('.feuille-boutique')
      await page.locator('.vies-pas-btn[aria-label="Un de plus"]').tap()
      const vie = await fiche(`presentoir-objet-${t}`)
      if (!vie.feuille?.gestes.some((g: any) => /^Acheter · 🎊 50$/.test(g.nom))) dire(`presentoir-objet-${t} : deux vies ne se disent pas « Acheter · 🎊 50 »`)
      await photo(page, `presentoir-objet-${t}`, 400)
      await geste(page, 'Acheter').tap()
      await geste(page, 'Confirmer').tap()
      await page.waitForSelector('.presentoir-acquis', { timeout: 8000 }).catch(() => dire(`presentoir-objet-${t} : l'achat n'a pas abouti`))
      await photo(page, `presentoir-objet-achete-${t}`, 400)
      await fermer(page)
      // « Tes confettis », par son solde.
      await page.evaluate('scrollTo(0, 0)')
      await page.locator('.solde-puce').tap()
      await page.waitForSelector('.feuille-boutique .confettis-sources')
      partout(`confettis-${t}`, await mesurer(page, `confettis-${t}`))
      await photo(page, `confettis-${t}`, 500)
      await fermer(page)
      await ctx.close()

      // Tom n'a pas de quoi : son envie tient lieu d'achat, et l'Éclat se vise.
      const pauvre = await ouvrir(tom, ecran, '/boutique#theme-aurore')
      await pauvre.page.waitForSelector('.feuille-boutique')
      const cher = await mesurer(pauvre.page, `presentoir-trop-cher-${t}`)
      partout(`presentoir-trop-cher-${t}`, cher)
      console.log(`presentoir-trop-cher-${t} — ${cher.feuille?.gestes.map((g: any) => `[${g.nom}${g.principal ? ' *' : ''}]`).join(' ')}`)
      if (!cher.feuille?.gestes.some((g: any) => g.nom === 'J’en ai envie' && g.principal)) dire(`presentoir-trop-cher-${t} : « J'en ai envie » n'est pas le geste d'un article trop cher`)
      await photo(pauvre.page, `presentoir-trop-cher-${t}`, 700)
      await pauvre.ctx.close()
    }
  }

  // ── Le texte agrandi, une tablette, l'Ivoire : des photos, et rien de plus large que l'écran ──
  if (retenu('autres')) {
    const agrandi = await ouvrir(lea, [360, 640], '/boutique', true)
    const m = await mesurer(agrandi.page, 'agrandi-360x640')
    console.log(`agrandi-360x640 — page ${m.page} px · ${m.themes} thèmes entiers · coupé : ${m.coupes.join(' | ') || 'rien'}`)
    partout('agrandi-360x640', m, { agrandi: true })
    await photo(agrandi.page, 'agrandi-360x640')
    await entiere(agrandi.page, 'agrandi-360x640', [360, 640])
    await agrandi.ctx.close()
    const tablette = await ouvrir(lea, [768, 1024])
    const mt = await mesurer(tablette.page, 'tablette-768x1024')
    console.log(`tablette-768x1024 — page ${mt.page} px · ${mt.colonnesDesThemes} thèmes et ${mt.colonnesDesFonds} fonds par rangée`)
    partout('tablette-768x1024', mt)
    await photo(tablette.page, 'tablette-768x1024')
    await tablette.ctx.close()
    await fetch(`${banc.url}/api/joueur/moi`, { method: 'PUT', headers: { Cookie: lea, 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' }, body: JSON.stringify({ theme: 'ivoire' }) })
    const ivoire = await ouvrir(lea, [360, 640])
    partout('ivoire-360x640', await mesurer(ivoire.page, 'ivoire-360x640'))
    await photo(ivoire.page, 'ivoire-360x640', 900)
    await ivoire.page.locator('.article-theme').first().tap()
    await ivoire.page.waitForSelector('.feuille-boutique')
    await photo(ivoire.page, 'ivoire-presentoir-360x640', 700)
    await ivoire.ctx.close()
  }

  writeFileSync(path.join(sortie, 'mesures.json'), JSON.stringify(mesures, null, 2))
  console.log(rate ? `\n${rate} défaut(s). Photos dans ${sortie}` : `\nTout tient. Photos dans ${sortie}`)
} finally {
  await navigateur.close()
  await banc.close()
}
// Sans `process.exit()` : ce qui vient d'être écrit doit partir (règle `tests.md`).
if (rate) process.exitCode = 1
