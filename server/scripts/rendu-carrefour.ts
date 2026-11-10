// Le carrefour de « Mon profil », tenu sur un écran — et les pages à menu, qui
// ne défilent plus quand leur contenu tient.
//
// « J'aimerais que tu passes en revue tous les écrans de l'application et que
// tu modifies ceux que tu trouves trop longs / ou ça serait logique de tout
// voir sans scroller » (le propriétaire, le 10 novembre 2026, au lendemain de
// l'accueil en lignes). Deux choses ne se voient qu'au navigateur, et se
// mesurent ici, sur un serveur jetable :
//
// 1. Le carrefour (`/profil`) : soi en tête, puis cinq gros boutons — six avec
//    un compagnon —, en lignes dans une carte. Chaque cas photographié du petit
//    téléphone de référence (360 × 640) au grand (412 × 915) : Léa, une
//    habituée — son loup dans sa niche, sa bordure de ligue, sa place au
//    classement des collections — ; Tom, qui vient de créer son profil ; tout
//    à la fois — le laurier d'hier, ce que la loge a de neuf, « Nouveau » sur
//    le classement des collections, un compagnon au nom de seize lettres, des
//    nombres aussi longs qu'ils peuvent l'être — ; une tablette ; le texte
//    agrandi à 130 % ; sous le bandeau du service ; l'Ivoire. À chaque photo :
//    ce qui passe sous la barre du menu, la hauteur des lignes et de la ligne
//    de soi, ce qui est coupé au bout, un titre passé sur deux lignes, les
//    suites montrées, le compteur rouge à sa place, ce qui passe sous la
//    niche — et, suivie image par image pendant que la page se charge, la
//    carte : où elle tombe, la hauteur de chaque ligne (« LA CARTE A BOUGÉ »).
// 2. Les pages à menu et les coquilles sous le bandeau : « Mes soirées », « Ma
//    carrière », « Mon compagnon » sans compagnon, la collection, la loge, la
//    boutique, « Mes quiz », « Compte », les collectionneurs, puis, le
//    bandeau posé, une page en maintenance et l'accueil sans profil. Une page
//    dont la coquille n'est pas plus haute que son minimum ne défile pas ; une
//    page longue défile de ce qui dépasse, pas d'une barre de plus.
//
//   npm run build -w client
//   cd server && npx tsx scripts/rendu-carrefour.ts ../export/carrefour
//
// `SEULEMENT=habituee,pages` ne joue que ces cas ; `ENCOCHE=47` pose l'encoche
// d'un iPhone et sa barre d'accueil, en 390 × 844. Le script sort en erreur si
// un cas qui doit tenir — l'habituée, le débutant, tout à la fois, le bandeau,
// l'Ivoire — défile ou déborde en largeur, si la carte du carrefour a bougé
// pendant le chargement, ou si une page défile pour rien : sa coquille à son
// minimum, c'est lui qui dépasse l'écran, pas son contenu.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, relireJusqua } from '../test/banc'
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'
import { xpDuNiveau } from '../../shared/profil'
import { DESTINATIONS } from '../../shared/affiches'
import { ecrireDesDuels } from './duelsDEssai'
import { SOUS_LA_NICHE } from './a-l-ecran'

const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.resolve(process.argv[2] ?? path.join(ici, '../../export/carrefour'))
mkdirSync(sortie, { recursive: true })
ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

type Ecran = [number, number]
/** Le petit téléphone de référence, un moyen, un iPhone d'aujourd'hui, un grand Android. */
const TOUS_LES_ECRANS: Ecran[] = [[360, 640], [360, 740], [390, 844], [412, 915]]
const DEUX_ECRANS: Ecran[] = [[360, 640], [390, 844]]
const PETIT: Ecran[] = [[360, 640]]
const TABLETTE: Ecran[] = [[768, 1024]]

/**
 * Ce que toute page mesure : où commence la barre du menu, de combien la page défile, où finit ce qu'elle montre — le
 * dernier texte, la dernière image, la dernière boîte peinte, pas la coquille, qui s'étire —, et si elle déborde en
 * largeur. En texte : `tsx` y glisserait des `__name`.
 */
const LA_PAGE = `(() => {
  const menu = document.querySelector('.menu-barre')
  const pli = Math.round(menu ? menu.getBoundingClientRect().top : window.innerHeight)
  const hors = '.menu-barre, .sr-only, .niche, .carte-voile, .dialog-backdrop, .toast, .env-badge, .loge-barre, .boutique-panier, script, style'
  // Ni ce qu'un repli fermé garde pour plus tard — le glossaire, sous le carrefour : le mesurer le ferait mettre en page, et ses
  // seize définitions passaient pour 1200 px de contenu sous le menu —, ni ce qui est posé par-dessus la page.
  const visible = el => {
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) return false
    for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return false
    return true
  }
  let bas = 0
  const voir = r => { if (r.width > 0 && r.height > 0) bas = Math.max(bas, r.bottom + window.scrollY) }
  const marcheur = document.createTreeWalker(document.getElementById('root'), NodeFilter.SHOW_TEXT)
  for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
    const el = t.parentElement
    if (!el || !t.textContent.trim() || el.closest(hors) || !visible(el)) continue
    const plage = document.createRange()
    plage.selectNodeContents(t)
    for (const r of plage.getClientRects()) voir(r)
  }
  for (const el of document.querySelectorAll('#root img, #root svg, #root canvas, #root input, #root button, #root a, #root summary, #root .card, #root .jouer-carte, #root .gros-bouton')) {
    if (el.closest(hors) || !visible(el)) continue
    voir(el.getBoundingClientRect())
  }
  const bandeau = document.querySelector('#root .bandeau-du-service')
  // Sa coquille est-elle plus haute que son minimum ? Sinon, c'est lui — l'écran, moins ce qu'elle en retranche — qui
  // fait la hauteur de la page : si elle défile, elle défile pour rien.
  const coquille = document.querySelector('#root .player-shell, #root .center-page, #root .join, #root .filet')
  const minimum = coquille ? parseFloat(getComputedStyle(coquille).minHeight) || 0 : 0
  return {
    ecran: window.innerWidth + '×' + window.innerHeight,
    pli,
    defile: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    contenu: Math.round(bas),
    large: document.documentElement.scrollWidth > window.innerWidth + 1,
    bandeau: bandeau ? Math.round(bandeau.parentElement.getBoundingClientRect().height) : 0,
    coquille: coquille ? Math.round(coquille.getBoundingClientRect().height) : null,
    auMinimum: !!coquille && minimum > 0 && coquille.getBoundingClientRect().height <= minimum + 0.5,
  }
})()`

/** Ce que le carrefour mesure en plus : ses lignes, ce qui y est coupé au bout, ce qui passe sur plusieurs lignes, les suites montrées. */
const LE_CARREFOUR = `(() => {
  const visible = el => el.getBoundingClientRect().width > 2
  const lignesDe = el => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))
  const boutons = [...document.querySelectorAll('.profil-boutons > .gros-bouton')]
  const coupes = [...document.querySelectorAll('.profil-boutons .gros-essentiel, .profil-boutons .gros-detail:not(.gros-a-suite), .profil-boutons .gros-compte')]
    .filter(el => visible(el) && el.scrollWidth > el.clientWidth + 1)
    .map(el => '« ' + el.textContent.trim().slice(0, 48) + ' »')
  const surPlusieursLignes = [...document.querySelectorAll('.profil-boutons .gros-texte b, .profil-boutons .gros-detail')]
    .filter(el => visible(el) && lignesDe(el) > 1)
    .map(el => '« ' + el.textContent.trim().slice(0, 32) + ' » (' + lignesDe(el) + ')')
  const suites = [...document.querySelectorAll('.profil-boutons .gros-a-suite')].filter(visible).map(el => {
    const ligne = el.querySelector('.gros-essentiel').getBoundingClientRect().top
    const montrees = [...el.querySelectorAll('.gros-suite')].filter(s => Math.abs(s.getBoundingClientRect().top - ligne) < 2)
    return el.querySelector('.gros-essentiel').textContent + ' [' + montrees.map(s => s.textContent).join('') + ']'
  })
  // Le compteur rouge de « M'habiller » : dans sa ligne, sans mordre sur son titre.
  const compteur = document.querySelector('.profil-boutons .gros-compteur')
  const rouge = (() => {
    if (!compteur) return null
    const c = compteur.getBoundingClientRect()
    const titre = compteur.closest('.gros-bouton').querySelector('.gros-texte b').getBoundingClientRect()
    const carte = document.querySelector('.profil-boutons').getBoundingClientRect()
    const mord = c.right > titre.left + 1 && c.left < titre.right - 1 && c.bottom > titre.top + 1 && c.top < titre.bottom - 1
    return { dedans: c.top >= carte.top - 1 && c.right <= carte.right + 1, mord }
  })()
  return {
    // Soi, en tête : sa hauteur, la même avec ou sans bordure de ligue — elle se pose après la page.
    tete: Math.round(document.querySelector('.player-shell > .identite-ligne').getBoundingClientRect().height),
    lignes: boutons.map(el => Math.round(el.getBoundingClientRect().height)),
    titres: boutons.map(el => el.querySelector('.gros-texte b').textContent),
    coupes,
    surPlusieursLignes,
    suites,
    rouge,
    nouveau: !!document.querySelector('.profil-boutons .pastille-nouveaute'),
    miniature: !!document.querySelector('.profil-boutons .gros-icone .niche-mini'),
    jauges: document.querySelectorAll('.profil-boutons .gros-jauge .jauge-fine').length,
  }
})()`

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
const seulement = (process.env.SEULEMENT ?? '').split(',').filter(Boolean)
const retenu = (nom: string) => !seulement.length || seulement.includes(nom)
const encoche = Number(process.env.ENCOCHE ?? 0)
/** Une encoche ne se pose que sur un écran qui en a une : un iPhone d'aujourd'hui, pas le petit téléphone de référence. */
const reels = (ecrans: Ecran[]): Ecran[] => (encoche ? [[390, 844]] : ecrans)
const rapport: Record<string, any> = {}
/** Les cas du carrefour qui doivent tenir sur l'écran, sans défiler ni déborder : s'ils ne tiennent plus, le script sort en erreur. */
const DOIVENT_TENIR = ['habituee', 'debutant', 'tout', 'bandeau', 'ivoire']
let rate = 0

try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
  {
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id
    // Léa, une habituée : le niveau 14, sa bordure d'or — avec elle, sa ligne en tête prend toute sa hauteur —, le Phénix
    // qu'elle porte, deux sentiers, un thème acheté.
    db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#jour', '', ?, ?, 1)`).run(id, xpDuNiveau(14), JSON.stringify({ v: VERSION_BAREME, jours: 1 }))
    db.prepare('UPDATE profiles SET xp = ?, niche = ? WHERE id = ?').run(xpDuNiveau(14), 'loup', id)
    ecrireDesDuels(db, id, 'or', 7)
    db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'hf:phenix', 'une-soiree-d-avant', '', '🔥', 'Le Phénix', 1)`).run(id)
    for (const [branche, paliers] of [['foret', 5], ['mythes', 2]] as const) db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, 1)').run(id, branche, paliers)
    db.prepare(`INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, 'ocean', 0, 1)`).run(id)
    // Son loup dans sa niche, un nom à lui, 350 bonnes réponses avec lui : « Mon compagnon », sa miniature, sa jauge et son compte.
    db.prepare(`INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, nom, created_at) VALUES (?, 'loup', 1000, 2, 'Croc', 1)`).run(id)
    db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-09-20', 1, 10, NULL, 0, 3200, 1, 0)`).run(id)
    const questions = Array.from({ length: 10 }, (_, i) => ({ reserveId: `rendu-carrefour-${i}`, texte: `Question ${i + 1}`, reponses: ['A', 'B', 'C', 'D'], bonne: 0, categorie: null, duree: 20, lectureMs: 3000, anecdote: null }))
    const tirage = db.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`)
    const juste = db.prepare(`INSERT INTO jour_reponses (profile_id, jour, question, choix, ms, juste, points, repondue_le, compagnon) VALUES (?, ?, ?, 0, 1000, 1, 100, 1, 'loup')`)
    for (let j = 0; j < 35; j++) {
      const jour = new Date(Date.UTC(2026, 6, 1 + j)).toISOString().slice(0, 10)
      tirage.run(jour, JSON.stringify(questions))
      for (let q = 0; q < 10; q++) juste.run(id, jour, q)
    }
    db.close()
  }
  // Ce qui s'est écrit derrière le dos du serveur ne se lit qu'après son redémarrage (les journaux en mémoire).
  await banc.redemarrer()
  await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:phenix' }, lea, 'PUT')
  // Le premier relevé des collections se fait en fond, derrière la première visite : attendu, le bouton du classement dit sa place.
  await relireJusqua(
    () => fetch(`${banc.url}/api/collectionneurs`, { headers: { Cookie: lea } }).then(r => r.json() as Promise<{ enPreparation?: true }>),
    c => !c.enPreparation,
    20_000,
  )

  type Cas = {
    /** Qui regarde. */
    cookie?: string
    /**
     * Tout à la fois, la réponse du profil réécrite en route : le laurier d'hier — une ligne de plus au-dessus des
     * boutons —, « Nouveau » sur le classement des collections, et des nombres aussi longs qu'ils peuvent l'être.
     */
    tout?: boolean
    /** Le texte agrandi, en pour cent. */
    texte?: number
  }
  const ouvrir = async (cas: Cas, [largeur, hauteur]: Ecran) => {
    const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, isMobile: largeur < 600, hasTouch: largeur < 600, reducedMotion: 'reduce' })
    if (cas.cookie) {
      const [cle, valeur] = cas.cookie.split('=')
      await ctx.addCookies([{ name: cle, value: valeur, url: banc.url }])
    }
    // Où tombe la carte du carrefour, et la hauteur de ses lignes, image par image : le compte de sa collection, la
    // miniature de sa niche et la bordure de son avatar arrivent après la page — si leur place n'est pas gardée, tout
    // bouge sous le doigt. En texte, comme les mesures.
    await ctx.addInitScript(`(() => {
      const vus = []
      window.__laCarte = vus
      const voir = () => {
        const el = document.querySelector('.profil-boutons')
        if (el) {
          const vu = Math.round(el.getBoundingClientRect().top) + ' : ' + [...el.querySelectorAll(':scope > .gros-bouton')].map(b => Math.round(b.getBoundingClientRect().height)).join(', ')
          if (vus[vus.length - 1] !== vu) vus.push(vu)
        }
        requestAnimationFrame(voir)
      }
      requestAnimationFrame(voir)
    })()`)
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    // L'encoche d'un iPhone et sa barre d'accueil, 34 px en bas : Chromium sans écran les tient à zéro, et la barre du
    // menu, le retrait du corps et la hauteur des coquilles comptent toutes trois avec elle (skill `regarder-le-rendu`).
    if (encoche) {
      const cdp = await ctx.newCDPSession(page)
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: encoche, topMax: encoche, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } })
    }
    if (cas.tout) {
      await page.route(/\/api\/joueur\/moi$/, async (route: any) => {
        if (route.request().method() !== 'GET') return route.continue()
        const reponse = await route.fetch()
        const j = await reponse.json()
        j.profile.laurier = 2
        j.profile.collectionneur = { rang: 128, classes: 1024, carats: 12480 }
        j.profile.affiches = [{ id: 'rendu', page: 'collectionneurs', titre: DESTINATIONS.collectionneurs.titre, phrase: DESTINATIONS.collectionneurs.phrase, confettis: 0, rangee: false }]
        // Le carrefour n'en lit que le compte.
        j.profile.soirees = Array.from({ length: 128 }, () => j.profile.soirees[0] ?? {})
        j.profile.fiche = { ...j.profile.fiche, precision: 1 }
        // Son compagnon au plus long : un nom de seize lettres, sa forme ultime.
        const sien = j.profile.compagnons?.find((c: any) => c.compagnon === j.profile.niche)
        if (sien) Object.assign(sien, { nom: 'Capitaine Flocon', rang: 3 })
        await route.fulfill({ response: reponse, json: j })
      })
    }
    return { ctx, page }
  }
  /** La page arrivée : son réseau au repos, ses écrans venus à la demande — plus de place gardée —, ses images. */
  const attendre = async (page: any, attendu: string) => {
    await page.waitForSelector(attendu, { timeout: 15000 })
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForSelector('.onglet-en-chemin', { state: 'detached', timeout: 15000 }).catch(() => {})
    await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
    await page.waitForTimeout(800)
  }
  /** La photo de l'écran — et de la page entière si elle dépasse : la barre du menu, fixe, se poserait au milieu, elle s'efface. */
  const photographier = async (page: any, n: string, defile: number) => {
    await page.screenshot({ path: path.join(sortie, `${n}.png`) })
    if (defile > 0) {
      const style = await page.addStyleTag({ content: '.menu-barre { display: none !important; }' })
      await page.screenshot({ path: path.join(sortie, `${n}-entiere.png`), fullPage: true })
      await style.evaluate((s: any) => s.remove())
    }
  }

  // ── 1. Le carrefour ─────────────────────────────────────────────────────
  /**
   * Du neuf dans sa loge : un thème acheté ailleurs depuis son dernier passage — « M'habiller » le compte en rouge. Une
   * première visite d'abord : la première fois qu'un profil paraît, tout ce qu'il a se retient déjà vu.
   */
  let duNeuf = false
  const poserDuNeuf = async () => {
    if (duNeuf) return
    duNeuf = true
    const { ctx, page } = await ouvrir({ cookie: lea }, PETIT[0])
    await page.goto(`${banc.url}/profil`)
    await attendre(page, '.profil-boutons .gros-compte')
    await ctx.close()
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    db.prepare(`INSERT INTO profile_achats (profile_id, theme, prix, created_at) SELECT id, 'jungle', 0, 2 FROM profiles WHERE login = 'lea'`).run()
    db.close()
  }
  const carrefour = async (nom: string, cas: Cas, ecrans: Ecran[]) => {
    if (!retenu(nom)) return
    if (cas.tout) await poserDuNeuf()
    for (const ecran of reels(ecrans)) {
      const { ctx, page } = await ouvrir(cas, ecran)
      await page.goto(`${banc.url}/profil`)
      await attendre(page, '.profil-boutons .gros-compte')
      // Sa miniature attend le code de la niche, et le compteur rouge celui de la loge : la ligne a sa forme une fois là.
      if (cas.cookie === lea) await page.waitForSelector('.profil-boutons .gros-icone .niche-mini', { timeout: 8000 }).catch(() => console.error(`[${nom}] pas de niche sur « Mon compagnon »`))
      await page.waitForTimeout(600)
      // Avant d'agrandir le texte : c'est le script qui ferait bouger la carte, pas la page.
      const vus = (await page.evaluate('window.__laCarte')) as string[]
      if (cas.texte) {
        await page.addStyleTag({ content: `html { font-size: ${cas.texte}% !important; }` })
        await page.waitForTimeout(600)
      }
      const n = `${nom}-${ecran[0]}x${ecran[1]}`
      const m = { ...((await page.evaluate(LA_PAGE)) as object), ...((await page.evaluate(LE_CARREFOUR)) as object), sousLaNiche: (await page.evaluate(SOUS_LA_NICHE)) as string[], vus } as any
      rapport[n] = m
      await photographier(page, n, m.defile)
      await ctx.close()
      const doitTenir = DOIVENT_TENIR.includes(nom)
      const verdict = m.large ? 'DÉBORDE EN LARGEUR' : m.defile > 0 ? `défile de ${m.defile} px (${m.contenu - m.pli} px de contenu sous le menu)` : `tout tient (${m.pli - m.contenu} px au-dessus du menu)`
      const rateIci = doitTenir && (m.large || m.defile > 0)
      if (rateIci) rate++
      const hauteurs = [...new Set(m.lignes as number[])].sort((a, b) => a - b)
      console.log(`${n} — ${verdict} · ${m.lignes.length} lignes de ${hauteurs[0]}${hauteurs.length > 1 ? ` à ${hauteurs[hauteurs.length - 1]}` : ''} px · soi ${m.tete} px${m.bandeau ? ` · bandeau ${m.bandeau} px` : ''}${rateIci ? ' — DEVAIT TENIR' : ''}`)
      if (Math.min(...m.lignes) < 48) console.log(`   UNE LIGNE SOUS 48 PX : ${m.lignes.join(', ')}`)
      if (m.coupes.length) console.log(`   coupé au bout : ${m.coupes.join(' ; ')}`)
      if (m.surPlusieursLignes.length) console.log(`   sur plusieurs lignes : ${m.surPlusieursLignes.join(' ; ')}`)
      if (m.suites.length) console.log(`   suites montrées : ${m.suites.join(' ; ')}`)
      if (m.rouge && (!m.rouge.dedans || m.rouge.mord)) console.log(`   LE COMPTEUR ROUGE ${m.rouge.mord ? 'mord sur le titre' : 'sort de la carte'}`)
      if (cas.cookie === lea && !m.miniature) console.log('   PAS DE MINIATURE de la niche sur « Mon compagnon »')
      if (cas.tout && !m.nouveau) console.log('   PAS DE « Nouveau » sur le classement des collections')
      if (cas.tout && !m.rouge) console.log('   PAS DE COMPTEUR ROUGE sur « M’habiller »')
      const dessous = (m.sousLaNiche as string[]).filter(x => x !== '(pas de niche)')
      if (dessous.length) console.log(`   SOUS LA NICHE — ${dessous.join(' · ')}`)
      // Ce qui a bougé pendant le chargement, une fois toutes ses lignes là — sur un navigateur neuf, « Mon compagnon »
      // n'arrive qu'avec sa niche, une image après les autres : c'est d'avant, et ça ne se compte pas ici. Un pixel
      // d'écart est un arrondi (une police qui arrive) : il ne se voit pas.
      const images = vus.map(v => ({ haut: Number(v.split(' : ')[0]), lignes: v.split(' : ')[1].split(', ').map(Number) })).filter(i => i.lignes.length === m.lignes.length)
      const ecart = (valeurs: number[]) => Math.max(...valeurs) - Math.min(...valeurs)
      const bouge = images.length > 0 && (ecart(images.map(i => i.haut)) > 1 || m.lignes.some((_: number, k: number) => ecart(images.map(i => i.lignes[k])) > 1))
      if (bouge) {
        rate++
        console.log(`   LA CARTE A BOUGÉ pendant le chargement : ${vus.join(' → ')}`)
      }
    }
  }
  await carrefour('habituee', { cookie: lea }, TOUS_LES_ECRANS)
  await carrefour('debutant', { cookie: tom }, DEUX_ECRANS)
  // Aux quatre tailles : à côté de « Nouveau », le titre du classement des collections tient sur une ligne dès 402 px de large.
  await carrefour('tout', { cookie: lea, tout: true }, TOUS_LES_ECRANS)
  await carrefour('tablette', { cookie: lea, tout: true }, TABLETTE)
  await carrefour('agrandi', { cookie: lea, texte: 130 }, PETIT)

  // ── 2. Les pages à menu ─────────────────────────────────────────────────
  /** Une page : son adresse, qui la regarde, ce qu'on y attend. */
  type Page = [nom: string, adresse: string, qui: string | undefined, attendu: string]
  const pages = async (groupe: string, liste: Page[], ecrans: Ecran[]) => {
    if (!retenu('pages')) return
    for (const [nom, adresse, qui, attendu] of liste) {
      for (const ecran of reels(ecrans)) {
        const { ctx, page } = await ouvrir({ cookie: qui }, ecran)
        await page.goto(`${banc.url}${adresse}`)
        await attendre(page, attendu)
        const n = `${groupe}-${nom}-${ecran[0]}x${ecran[1]}`
        const m = (await page.evaluate(LA_PAGE)) as any
        rapport[n] = m
        await photographier(page, n, m.defile)
        await ctx.close()
        // Une page dont la coquille n'est pas plus haute que son minimum — l'écran, moins ce qu'elle en retranche — ne
        // défile pas : si elle défile, c'est ce minimum qui dépasse, pas son contenu. Une page longue défile de ce qui
        // dépasse, et de la marge qu'elle garde dessous.
        const deTrop = m.defile > 0 && m.auMinimum
        if (deTrop || m.large) rate++
        const sousQuoi = m.pli < Number(m.ecran.split('×')[1]) ? 'le menu' : 'l’écran'
        const tient = m.contenu <= m.pli
        const verdict = m.large
          ? 'DÉBORDE EN LARGEUR'
          : m.defile === 0
            ? `ne défile pas (${m.pli - m.contenu} px de libre)`
            : deTrop
              ? tient
                ? `DÉFILE DE ${m.defile} PX POUR RIEN : son contenu tient (${m.pli - m.contenu} px de libre), sa coquille dépasse`
                : `DÉFILE DE ${m.defile} PX, PLUS QU’IL NE FAUT : sa coquille, à son minimum, dépasse l’écran (${m.contenu - m.pli} px de contenu sous ${sousQuoi})`
              : tient
                ? `défile de ${m.defile} px : son contenu tient (${m.pli - m.contenu} px de libre), sa marge du bas passe sous ${sousQuoi}`
                : `défile de ${m.defile} px : ${m.contenu - m.pli} px de contenu sous ${sousQuoi}, ${m.defile - (m.contenu - m.pli)} px de marge au bout`
        console.log(`${n} — ${verdict}${m.bandeau ? ` · bandeau ${m.bandeau} px` : ''}`)
      }
    }
  }
  await pages(
    'page',
    [
      ['mes-soirees', '/profil#soirees', tom, '.piece-tete'],
      ['ma-carriere', '/profil#carriere', tom, '.piece-tete'],
      ['mon-compagnon-sans', '/profil#compagnon', tom, '.player-shell'],
      ['ma-collection', '/profil#collection', lea, '.collection'],
      ['la-loge', '/profil#avatar', lea, '.loge-panneau .loge-page-avatars'],
      ['boutique', '/boutique', lea, '.etagere .theme-vitrine'],
      ['mes-quiz', '/edit', tom, '.menu-barre'],
      ['compte', '/compte', tom, '.menu-barre'],
      ['collectionneurs', '/collectionneurs', tom, '.menu-barre'],
    ],
    DEUX_ECRANS,
  )

  // ── 3. Sous le bandeau du service ───────────────────────────────────────
  if (retenu('bandeau') || retenu('pages')) {
    const admin = await connexionAnimateur(banc.url)
    const poser = (chemin: string, corps: unknown) => ecrire(banc.url, chemin, corps, admin, 'PUT').then(r => r.status)
    console.log(
      'le bandeau, le quiz du jour fermé :',
      await poser('/api/admin/maintenance/bandeau', { texte: 'Le quiz du jour est en panne depuis ce matin : on répare, merci de votre patience !' }),
      await poser('/api/admin/maintenance/pages/jour', { etat: 'maintenance' }),
    )
    await carrefour('bandeau', { cookie: lea }, DEUX_ECRANS)
    await pages(
      'bandeau',
      [
        ['mes-soirees', '/profil#soirees', tom, '.piece-tete'],
        ['collectionneurs', '/collectionneurs', tom, '.menu-barre'],
        ['compte', '/compte', tom, '.menu-barre'],
        ['jour-en-maintenance', '/jour', tom, '.en-maintenance'],
        ['accueil-sans-profil', '/', undefined, '.entree-choix .join-actions .btn'],
      ],
      PETIT,
    )
    await poser('/api/admin/maintenance/bandeau', { texte: null })
    await poser('/api/admin/maintenance/pages/jour', { etat: 'ouverte' })
  }

  // L'Ivoire, en dernier : le thème se porte, et habillerait toutes les photos d'après.
  if (retenu('ivoire')) {
    const r = await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, lea, 'PUT')
    if (!r.ok) throw new Error(`L'Ivoire ne se porte pas (${r.status} ${await r.text()})`)
    await carrefour('ivoire', { cookie: lea }, DEUX_ECRANS)
  }

  writeFileSync(path.join(sortie, 'mesures.json'), JSON.stringify(rapport, null, 2))
  console.log(`Photos et mesures dans ${sortie}`)
  // Par le code de sortie de Node, pas `process.exit()` : ce qui vient de s'écrire part d'abord (règle `tests.md`).
  if (rate > 0) process.exitCode = 1
} finally {
  await navigateur.close()
  await banc.close()
}
