// « Mes quiz » (`/edit`), photographié au téléphone sur un serveur jetable, du petit téléphone de référence au grand :
// la liste — une bibliothèque vide et ses premiers pas, celle qu'un compte reçoit à sa naissance, une bibliothèque
// fournie —, la fiche d'un quiz, les feuilles « Créer un quiz » et « Trier et filtrer », une recherche, « Partir d'un
// modèle » et « Pour qui ? », les dialogues du partage, le texte agrandi à 130 %, une tablette et un portable.
// À chaque photo : où finit chaque bloc par rapport à la barre du menu, combien de quiz se voient entiers, de combien la
// page défile, ce qui est coupé au bout, les cibles de doigt, le plus petit texte.
//
// En lignes depuis le 10 novembre 2026 (le propriétaire : « revoir l'onglet quiz […] modifier la disposition et
// l'aspect si tu trouves cela nécessaire ») : en 360 × 640, la liste ne montrait que trois quiz entiers sur dix, la
// fiche d'un quiz défilait de 448 px, la feuille « Créer un quiz » de 144, et une bibliothèque vide de 2 214. Le script
// sort en erreur si ce qui tient ne tient plus : le compte des quiz entiers de la liste (`QUIZ_ENTIERS`), la fiche
// entière au-dessus du menu sans défiler, les deux feuilles sans défiler, les quatre départs d'une bibliothèque vide
// au-dessus du menu, « Fermer » en tête des modèles rouverts ; et, partout, une page plus large que l'écran, une cible
// de doigt sous 44 px, un texte sous 11 px.
// L'éditeur d'un quiz (`/edit?quiz=…`) n'est pas photographié ici.
// Le client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-mes-quiz.ts [dossier]     # sans dossier : export/mes-quiz
//   SEULEMENT=fournie,fiche npx tsx scripts/rendu-mes-quiz.ts
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connexionAnimateur, cookieDe, creerQuiz, demarrer, ecrire, estimation, qcm } from '../test/banc'

const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.resolve(process.argv[2] ?? path.join(ici, '../../export/mes-quiz'))
mkdirSync(sortie, { recursive: true })
const seulement = (process.env.SEULEMENT ?? '').split(',').filter(Boolean)
const retenu = (nom: string) => !seulement.length || seulement.includes(nom)
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

type Ecran = [number, number]
/**
 * Le petit téléphone de référence, un iPhone dans Safari (ses barres dépliées), un moyen, un grand Android dans Chrome,
 * un iPhone d'aujourd'hui en application installée, un grand Android.
 */
const TOUS_LES_ECRANS: Ecran[] = [[360, 640], [390, 664], [360, 740], [412, 800], [390, 844], [412, 915]]
const DEUX_ECRANS: Ecran[] = [[360, 640], [390, 844]]
/** Une tablette, haute : les mesures larges et la fiche d'avant. Un portable, court : celles d'un écran moyen. */
const GRANDS_ECRANS: Ecran[] = [[768, 1024], [1366, 768]]

/**
 * Combien de quiz la liste montre entiers au-dessus du menu, au moins, pour chaque hauteur d'écran (mesuré le
 * 10 novembre 2026 sur une bibliothèque de dix quiz ; trois, quatre, quatre, cinq, six et six avant). Une ligne de
 * plus dans la tête, un bloc au-dessus de la liste, une ligne de quiz plus haute : le compte baisse, et le script le dit.
 */
const QUIZ_ENTIERS: Record<number, number> = { 640: 8, 664: 8, 740: 8, 800: 9, 844: 9, 915: 10 }
/** Une cible de doigt, au moins — à un demi-pixel près. */
const CIBLE = 44
/**
 * Une cible d'avant, plus basse, que cette reprise n'a pas touchée : « Fermer », en tête de toute feuille de
 * l'application (`Feuille`, `components/Pieces.tsx` : 40 px). Elle ne descend pas davantage.
 */
const D_AVANT: Record<string, number> = { fermer: 40 }
/** Le plus petit texte permis : les 11 px de `--t-label`. */
const PLANCHER = 11

/**
 * Ce que la page mesure, en haut : le pli (le haut de la barre du menu), où finit chaque bloc, les lignes de la liste,
 * de combien elle défile, ce qui est coupé au bout, les cibles de doigt, le plus petit texte. En texte : `tsx` y
 * glisserait des `__name`.
 */
const LA_PAGE = `(() => {
  const boite = s => {
    const el = typeof s === 'string' ? document.querySelector(s) : s
    if (!el) return null
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1 ? { haut: Math.round(r.top + scrollY), bas: Math.round(r.bottom + scrollY), l: Math.round(r.width * 2) / 2, h: Math.round(r.height * 2) / 2 } : null
  }
  const menu = document.querySelector('.menu-barre')
  const pli = Math.round(menu ? menu.getBoundingClientRect().top : innerHeight)
  const cartes = [...document.querySelectorAll('.quiz-cartes > .quiz-carte')].map(boite).filter(Boolean)
  // Ce qu'un écran court cache à l'œil (les déclarations de « .sr-only ») garde une boîte quand il a une marge
  // intérieure — « Plus », dans la fiche : 16 × 6 px — : c'est sa découpe qui le dit caché.
  const visible = e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.clipPath !== 'inset(50%)' && r.width > 2 && r.height > 2 }
  // Coupé au bout : un texte plus large que sa boîte — le nom d'un quiz, le premier morceau de ses faits, un geste rare.
  const coupes = [...document.querySelectorAll('.quiz-carte-texte b, .quiz-fait:first-child, .quiz-heros h1, .fiche-geste b, .fiche-geste-detail, .choix-ligne b, .choix-ligne .gros-detail, .bibliotheque-titre h1, .bibliotheque-creer')]
    .filter(e => visible(e) && e.scrollWidth > e.clientWidth + 1)
    .map(e => (e.matches('.quiz-heros h1, .fiche-geste b, .choix-ligne b, .bibliotheque-titre h1, .bibliotheque-creer') ? 'NE DEVAIT PAS : ' : '') + e.textContent.trim().slice(0, 44))
  // Les morceaux de faits que la ligne ne montre pas : passés à la ligne, sous la hauteur de leur cadre.
  const tus = [...document.querySelectorAll('.quiz-carte-faits')].map(f => {
    const cadre = f.getBoundingClientRect()
    return [...f.querySelectorAll('.quiz-fait')].filter(m => m.getBoundingClientRect().top > cadre.bottom - 2).map(m => m.textContent)
  }).filter(t => t.length).length
  // Les cibles de doigt : ce qu'on touche, par sa boîte.
  const cibles = {}
  for (const [nom, sel] of [['créer', '.bibliotheque-creer'], ['chercher', '.champ-recherche .input'], ['trier', '.bibliotheque-trier'], ['une ligne', '.quiz-carte-ouvrir'], ['lancer', '.quiz-carte-lancer'], ['le retour', '.quiz-fiche .jour-sortie'], ['un geste', '.quiz-fiche-gestes .btn'], ['un geste rare', '.fiche-geste'], ['supprimer', '.fiche-supprimer'], ['un départ', '.premiers-pas-choix .btn, .premiers-pas-tout-pret .btn'], ['un choix', '.carte-feuille .choix-ligne'], ['une pastille', '.carte-feuille .pill-btn'], ['fermer', '.carte-feuille .carte-fermer'], ['fermer les modèles', '.premiers-pas-tete .btn']]) {
    const tous = [...document.querySelectorAll(sel)].filter(visible).map(e => e.getBoundingClientRect())
    if (tous.length) cibles[nom] = { l: Math.round(Math.min(...tous.map(r => r.width)) * 2) / 2, h: Math.round(Math.min(...tous.map(r => r.height)) * 2) / 2 }
  }
  // Le plus petit texte qu'on lit sur la page, hors de la barre du menu (la sienne, d'avant).
  let petit = null
  const racine = document.querySelector('.carte-feuille') || document.querySelector('.mes-quiz')
  const marche = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT)
  for (let n = marche.nextNode(); n; n = marche.nextNode()) {
    const e = n.parentElement
    if (!n.textContent.trim() || !e || e.closest('.menu-barre') || !visible(e)) continue
    const r = e.getBoundingClientRect()
    if (r.width <= 2 || r.height <= 2) continue
    const taille = parseFloat(getComputedStyle(e).fontSize)
    if (!petit || taille < petit.taille) petit = { taille: Math.round(taille * 10) / 10, texte: n.textContent.trim().slice(0, 30) }
  }
  const feuille = document.querySelector('.carte-feuille')
  const corps = document.querySelector('.carte-feuille .carte-corps')
  return {
    pli,
    tete: boite('.bibliotheque-tete'),
    creer: boite('.bibliotheque-creer'),
    premiers: boite('.premiers-pas'),
    departs: boite('.premiers-pas-choix'),
    fermerLesModeles: boite('.premiers-pas-tete .btn'),
    outils: boite('.bibliotheque-outils'),
    cartes,
    tus,
    pied: boite('.bibliotheque-pied'),
    heros: boite('.quiz-heros'),
    gestes: boite('.quiz-fiche-gestes'),
    plus: boite('.fiche-plus'),
    supprimer: boite('.fiche-supprimer'),
    feuille: feuille ? { ...boite(feuille), defile: corps ? corps.scrollHeight - corps.clientHeight : 0 } : null,
    defile: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    large: document.documentElement.scrollWidth > innerWidth,
    coupes,
    cibles,
    petit,
  }
})()`

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
const mesures: Record<string, any> = {}
let rate = 0

try {
  const admin = await connexionAnimateur(banc.url)

  /** Un compte d'animateur neuf : sa bibliothèque vide, ses premiers pas. */
  const compteNeuf = async (login: string, name: string, slug: string) => {
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login, name, slug }, admin)
    const { activation } = (await cree.json()) as { activation: { token: string } }
    return cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: `${login}-pass-1` }))
  }
  const nadia = await compteNeuf('nadia', 'Nadia', 'chez-nadia')

  // Une bibliothèque fournie, celle de Bruno : sept modèles copiés — cinq à personnaliser, toutes leurs réponses à
  // écrire —, un quiz à lui au titre long et sans emoji, un quiz commencé — des questions à compléter —, un quiz vide,
  // un quiz archivé.
  const bruno = await compteNeuf('bruno', 'Bruno', 'chez-bruno')
  const modeles = (await (await fetch(`${banc.url}/api/modeles`, { headers: { Cookie: bruno } })).json()) as { id: string; title: string }[]
  for (const m of modeles.slice(0, 7)) {
    const r = await ecrire(banc.url, `/api/modeles/${encodeURIComponent(m.id)}`, {}, bruno)
    if (!r.ok) throw new Error(`le modèle ${m.id} ne se copie pas (${r.status})`)
  }
  await creerQuiz(
    banc.url,
    bruno,
    [qcm('La capitale de l’Australie ?', ['Canberra', 'Sydney', 'Melbourne', 'Perth']), qcm('Le plus long fleuve d’Europe ?', ['La Volga', 'Le Danube', 'Le Rhin', 'La Loire']), estimation('La hauteur du mont Blanc ?', 4806, 'm')],
    'Géographie des grandes vacances chez Mamie Jeanne',
  )
  await creerQuiz(banc.url, bruno, [qcm('Qui a peint La Joconde ?', ['Léonard de Vinci', 'Raphaël']), { kind: 'choice', text: 'Une question sans réponses', answers: ['', ''], correct: 0, duration: 20, image: null }, { kind: 'choice', text: '', answers: ['', ''], correct: 0, duration: 20, image: null }], '🎨 Les peintres')
  await creerQuiz(banc.url, bruno, [], '🧪 Sciences (à écrire)')
  const archive = await creerQuiz(banc.url, bruno, [qcm('Un vieux quiz ?', ['Oui', 'Non'])], '📼 Le quiz de l’an dernier')
  await ecrire(banc.url, `/api/quizzes/${archive}/archive`, { archive: true }, bruno)

  const contexte = async (cookie: string, [l, h]: Ecran) => {
    // Un doigt, pas une souris, sur un téléphone : le « survol » d'une souris resterait sur ce qui vient sous le dernier toucher.
    const telephone = l <= 700
    const ctx = await navigateur.newContext({ viewport: { width: l, height: h }, deviceScaleFactor: 2, isMobile: telephone, hasTouch: telephone })
    const [nom, valeur] = cookie.split('=')
    await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    return { ctx, page, toucher: (cible: any) => (telephone ? cible.tap() : cible.click()) }
  }

  /** Ce qui doit tenir dans ce cas, à cette taille : ce qui manque, en mots. */
  type Attendu = (m: any, ecran: Ecran) => string[]
  const mesurer = async (page: any, n: string, ecran: Ecran, attendu?: Attendu) => {
    await page.evaluate('window.scrollTo(0, 0)')
    await page.evaluate('document.fonts.ready')
    await page.waitForTimeout(500)
    const m = (await page.evaluate(LA_PAGE)) as any
    mesures[n] = m
    await page.screenshot({ path: path.join(sortie, `${n}.png`) })
    if (m.defile > 0) {
      const style = await page.addStyleTag({ content: '.menu-barre { display: none !important; }' })
      await page.screenshot({ path: path.join(sortie, `${n}-entiere.png`), fullPage: true })
      await style.evaluate((s: any) => s.remove())
    }
    const sous = (b: { bas: number } | null) => (b ? b.bas - m.pli : null)
    const dit = (quoi: string, b: { bas: number; h: number } | null) => (b ? `${quoi} →${b.bas} (${b.h} px${sous(b)! > 0 ? `, ${sous(b)} SOUS LE MENU` : ''})` : null)
    const entieres = (m.cartes as { bas: number }[]).filter(c => c.bas <= m.pli).length
    const blocs = [dit('la tête', m.tete), dit('les premiers pas', m.premiers), dit('ses départs', m.departs), dit('chercher et trier', m.outils), dit('son héros', m.heros), dit('ses deux gestes', m.gestes), dit('« Plus »', m.plus), dit('« Supprimer »', m.supprimer)].filter(Boolean)
    // Ce qui ne doit arriver nulle part, et ce que ce cas doit tenir.
    const manques: string[] = []
    if (m.large) manques.push('la page déborde en largeur')
    const basses = Object.entries(m.cibles as Record<string, { l: number; h: number }>).filter(([q, c]) => ecran[0] <= 700 && Math.min(c.l, c.h) < (D_AVANT[q] ?? CIBLE) - 0.5)
    if (basses.length) manques.push(`une cible de doigt sous ${CIBLE} px : ${basses.map(([q, c]) => `${q} ${c.l} × ${c.h}`).join(', ')}`)
    if (m.petit && m.petit.taille < PLANCHER - 0.05) manques.push(`un texte sous ${PLANCHER} px : « ${m.petit.texte} » (${m.petit.taille} px)`)
    const interdits = (m.coupes as string[]).filter(c => c.startsWith('NE DEVAIT PAS'))
    if (interdits.length) manques.push(`coupé au bout — ${interdits.join(' ; ')}`)
    if (attendu) manques.push(...attendu({ ...m, entieres }, ecran))
    if (manques.length) rate++
    console.log(
      `${n} — pli ${m.pli} · ${blocs.join(' · ')}${m.cartes.length ? ` · ${entieres} quiz entier${entieres > 1 ? 's' : ''} sur ${m.cartes.length} (des lignes de ${Math.min(...m.cartes.map((c: any) => c.h))} à ${Math.max(...m.cartes.map((c: any) => c.h))} px, la première à ${m.cartes[0].haut}${m.tus ? `, ${m.tus} dont la ligne tait un morceau` : ''})` : ''}${m.feuille ? ` · la feuille ${m.feuille.h} px, son corps défile de ${m.feuille.defile} px` : ''} · la page défile de ${m.defile} px${manques.length ? ` — DEVAIT TENIR : ${manques.join(' ; ')}` : ''}`,
    )
    const voulus = (m.coupes as string[]).filter(c => !c.startsWith('NE DEVAIT PAS'))
    if (voulus.length) console.log(`   coupé au bout : ${[...new Set(voulus)].map(c => `« ${c} »`).join(' ; ')}`)
    console.log(`   cibles : ${Object.entries(m.cibles as Record<string, { l: number; h: number }>).map(([q, c]) => `${q} ${c.l} × ${c.h}`).join(' · ')}${m.petit ? ` · le plus petit texte ${m.petit.taille} px (« ${m.petit.texte} »)` : ''}`)
  }
  /** Un cas : qui, quelle adresse, ce qu'on attend d'y voir, un geste éventuel avant la photo, et ce qui doit tenir. */
  const cas = async (nom: string, cookie: string, attente: string, ecrans: Ecran[], opts: { geste?: (page: any, toucher: (c: any) => Promise<void>) => Promise<void>; attendu?: Attendu; /** Le texte agrandi, en pour cent. */ texte?: number } = {}) => {
    if (!retenu(nom)) return
    for (const ecran of ecrans) {
      const { ctx, page, toucher } = await contexte(cookie, ecran)
      await page.goto(`${banc.url}/edit`)
      await page.waitForSelector(attente, { timeout: 15000 })
      await page.waitForLoadState('networkidle').catch(() => {})
      if (opts.geste) await opts.geste(page, toucher)
      if (opts.texte) await page.addStyleTag({ content: `html { font-size: ${opts.texte}% !important; }` })
      await mesurer(page, `${nom}-${ecran[0]}x${ecran[1]}`, ecran, opts.attendu)
      await ctx.close()
    }
  }
  const auDessus = (quoi: string, b: { bas: number } | null, m: any) => (!b ? [`${quoi} : introuvable`] : b.bas > m.pli ? [`${quoi} : ${b.bas - m.pli} px sous le menu`] : [])

  // La liste. Une bibliothèque vide : ses quatre départs au-dessus du menu, les modèles dessous.
  await cas('vide', nadia, '.premiers-pas', TOUS_LES_ECRANS, { attendu: m => auDessus('ses départs', m.departs, m) })
  await cas('amorce', admin, '.quiz-cartes > .quiz-carte', DEUX_ECRANS, { attendu: m => (m.defile > 0 ? [`la page défile de ${m.defile} px`] : []) })
  await cas('fournie', bruno, '.quiz-cartes > .quiz-carte', TOUS_LES_ECRANS, {
    attendu: (m, [, h]) => (m.entieres < QUIZ_ENTIERS[h] ? [`${m.entieres} quiz entiers, ${QUIZ_ENTIERS[h]} attendus`] : []),
  })
  // La fiche d'un quiz, entière au-dessus du menu, sans défiler : celui au titre le plus long, puis celui qui attend ses réponses.
  const ouvrir = (titre: RegExp) => async (page: any, toucher: (c: any) => Promise<void>) => {
    await toucher(page.getByRole('button', { name: titre }).first())
    await page.waitForSelector('.quiz-fiche')
  }
  const ficheEntiere: Attendu = m => [...auDessus('« Supprimer »', m.supprimer, m), ...(m.defile > 0 ? [`la page défile de ${m.defile} px`] : [])]
  await cas('fiche', bruno, '.quiz-cartes > .quiz-carte', TOUS_LES_ECRANS, { geste: ouvrir(/Géographie des grandes vacances/), attendu: ficheEntiere })
  await cas('fiche-a-completer', bruno, '.quiz-cartes > .quiz-carte', TOUS_LES_ECRANS, { geste: ouvrir(/Les peintres/), attendu: ficheEntiere })
  await cas('fiche-vide', bruno, '.quiz-cartes > .quiz-carte', DEUX_ECRANS, { geste: ouvrir(/Sciences/), attendu: ficheEntiere })
  // Les deux feuilles : tous leurs choix sans défiler.
  const feuilleEntiere: Attendu = m => (m.feuille?.defile > 0 ? [`la feuille défile de ${m.feuille.defile} px`] : [])
  await cas('creer', bruno, '.quiz-cartes > .quiz-carte', TOUS_LES_ECRANS, {
    geste: async (page, toucher) => {
      await toucher(page.getByRole('button', { name: 'Créer un quiz' }))
      await page.waitForSelector('.carte-feuille')
    },
    attendu: feuilleEntiere,
  })
  await cas('trier', bruno, '.quiz-cartes > .quiz-carte', TOUS_LES_ECRANS, {
    geste: async (page, toucher) => {
      await toucher(page.getByRole('button', { name: 'Trier et filtrer' }))
      await page.waitForSelector('.carte-feuille')
    },
    attendu: feuilleEntiere,
  })
  // Une recherche : ce qu'elle a trouvé d'abord sur la ligne ; un filtre, sa pastille au-dessus de la liste.
  await cas('recherche', bruno, '.quiz-cartes > .quiz-carte', DEUX_ECRANS, {
    geste: async page => {
      await page.getByRole('searchbox').fill('fleuve')
      await page.waitForSelector('.quiz-carte-trouve', { timeout: 8000 })
    },
  })
  // Ce qu'on ouvre depuis là : « Partir d'un modèle » — le catalogue, qui défile par nature, et se referme d'en haut —,
  // puis, sans rien exiger de plus que partout, « Pour qui ? » déplié sur un modèle à personnaliser et les deux
  // dialogues du partage.
  const parLaFeuille = (choix: RegExp, attente: string) => async (page: any, toucher: (c: any) => Promise<void>) => {
    await toucher(page.getByRole('button', { name: 'Créer un quiz' }))
    await page.waitForSelector('.carte-feuille')
    await toucher(page.getByRole('button', { name: choix }))
    await page.waitForSelector(attente)
  }
  await cas('modeles', bruno, '.quiz-cartes > .quiz-carte', DEUX_ECRANS, {
    geste: parLaFeuille(/Partir d’un modèle/, '.premiers-pas .modele'),
    // Ce qu'on vient d'ouvrir se referme sans le parcourir : « Fermer », à côté du titre.
    attendu: m => auDessus('« Fermer les modèles »', m.fermerLesModeles, m),
  })
  await cas('pour-qui', bruno, '.quiz-cartes > .quiz-carte', DEUX_ECRANS, {
    geste: async (page, toucher) => {
      await parLaFeuille(/Partir d’un modèle/, '.premiers-pas .modele')(page, toucher)
      await toucher(page.getByRole('button', { name: /^Pour qui \?/ }).first())
      await page.waitForSelector('.modele form, .modele .pour-qui')
    },
  })
  await cas('recevoir', bruno, '.quiz-cartes > .quiz-carte', DEUX_ECRANS, { geste: parLaFeuille(/Recevoir par un code/, '.dialog') })
  await cas('partager', bruno, '.quiz-cartes > .quiz-carte', DEUX_ECRANS, {
    geste: async (page, toucher) => {
      await ouvrir(/Géographie des grandes vacances/)(page, toucher)
      await toucher(page.getByRole('button', { name: /Partager par un code/ }))
      await page.waitForSelector('.dialog')
    },
  })
  // Le texte agrandi à 130 % sur le petit téléphone : les lignes grandissent avec lui, c'est voulu, et la fiche défile
  // de ce qui dépasse — mesuré sans rien exiger de plus que partout : ni page élargie, ni nom de geste coupé.
  await cas('fournie-agrandie', bruno, '.quiz-cartes > .quiz-carte', [[360, 640]], { texte: 130 })
  await cas('fiche-agrandie', bruno, '.quiz-cartes > .quiz-carte', [[360, 640]], { geste: ouvrir(/Géographie des grandes vacances/), texte: 130 })
  await cas('creer-agrandie', bruno, '.quiz-cartes > .quiz-carte', [[360, 640]], {
    geste: async (page, toucher) => {
      await toucher(page.getByRole('button', { name: 'Créer un quiz' }))
      await page.waitForSelector('.carte-feuille')
    },
    texte: 130,
  })
  // Une tablette : les mesures larges, la fiche d'avant. Un portable, court : celles d'un écran moyen, et sa fiche entière.
  await cas('fournie-grand', bruno, '.quiz-cartes > .quiz-carte', GRANDS_ECRANS)
  await cas('fiche-grand', bruno, '.quiz-cartes > .quiz-carte', GRANDS_ECRANS, { geste: ouvrir(/Géographie des grandes vacances/), attendu: ficheEntiere })

  writeFileSync(path.join(sortie, 'mesures.json'), JSON.stringify(mesures, null, 2))
  console.log(`\nPhotos et mesures dans ${sortie}${rate ? ` — ${rate} cas ne tiennent plus` : ''}`)
} finally {
  await navigateur.close()
  await banc.close()
}
// Par le code de sortie de Node : ce qui vient de s'écrire part d'abord (règle `tests.md`).
if (rate) process.exitCode = 1
