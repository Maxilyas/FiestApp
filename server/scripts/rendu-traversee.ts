// La traversée du Cabinet photographiée écran par écran, au doigt, sur un
// serveur jetable (skill `regarder-le-rendu`) : l'écran-titre, les trois
// gardiens, le choix des cartes, la carte d'un acte et son chemin, une étape
// lointaine touchée sur la carte (ce qu'elle est, par où y aller), l'annonce
// d'une épreuve, l'épreuve elle-même (sa tête : les cœurs, l'or), son bilan, le
// coffre et son amélioration, le marchand, le gardien, le choix du légendaire
// et la fin. Le client se construit d'abord (`npm run build -w client`).
//
//   cd server && npx tsx scripts/rendu-traversee.ts            # 360 × 640
//   ECRAN=1366x768 npx tsx scripts/rendu-traversee.ts
//
// Les étapes lointaines — le marchand, le gardien, le légendaire — s'écrivent
// à la main dans la base, rejouées par le pli comme le serveur les aurait
// écrites, puis le serveur redémarre et les relit : vingt minutes de jeu en
// une seconde. À chaque photo, ce qui déborde de côté se dit.
//
// Et d'abord le choix des cartes, qui tient sur un écran (« je pense que l'on
// peut faire tenir tout sur le même écran », le propriétaire, le 10 novembre
// 2026) : ce qui ne se voit qu'au navigateur se mesure ici, aux six tailles
// d'un téléphone, du petit de référence (360 × 640) au grand (412 × 915), dont
// un iPhone dans Safari (390 × 664) et un grand Android dans Chrome
// (412 × 800). Tom, qui n'a jamais joué ; Léa, une habituée — son compagnon
// dans sa niche, des défis tenus, leurs sceaux en couleur et un liseré doré —,
// aucune carte prise, une, puis trois (« Partir ») ; un iPhone et son encoche,
// l'application installée, celui d'aujourd'hui et le plus grand ; le texte
// agrandi à 130 % ; une tablette et un portable. À chaque photo : où finit la
// tête et ce qu'elle garde de sa phrase, la hauteur des dix lignes, où finit
// la dernière par rapport au pied collé (le pli), de combien l'écran défile,
// le bouton du pied, ce que les descriptions montrent (une ligne, deux,
// coupées au bout — et si la page, qui en essayait deux, est revenue à une),
// les cibles de moins de 44 px et celles que leur voisine couvre, ce qui passe
// sous la niche.
//
//   SEULEMENT=cartes npx tsx scripts/rendu-traversee.ts      # le choix des cartes seul, une à deux minutes
//   SEULEMENT=traversee npx tsx scripts/rendu-traversee.ts   # la traversée seule
//   THEME=carnet SEULEMENT=cartes npx tsx scripts/rendu-traversee.ts   # sous un thème : sa police change ce qui tient
//
// Le script sort en erreur si, dans un cas qui doit tenir (`CARTES_A_TENIR` :
// tous, sauf le texte agrandi), une carte passe sous le pied, l'écran défile,
// le bouton sort de l'écran, une cible descend sous 44 px ou n'est plus à elle
// seule, la page déborde en largeur ou quelque chose passe sous la niche.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { demarrer, inscrireProfil } from '../test/banc'
import { DIX_HEURES } from '../test/cabinet-banc'
import { SOUS_LA_NICHE } from './a-l-ecran'
import {
  CARTES,
  VERSION_DE_LA_TRAVERSEE,
  atteignables,
  etapeDe,
  etatDeLaTraversee,
  lireLeDepartDeLaTraversee,
  offrables,
  tracerLaCarte,
  type DepartDeLaTraversee,
  type GesteDeLaTraversee,
} from '../../shared/cabinet/traversee'

const [largeur, hauteur] = (process.env.ECRAN ?? '360x640').split('x').map(Number)
const telephone = largeur < 700
// Dans `export/`, que git ignore, comme `rendu-themes.ts` : des photos ne se committent pas.
const sortie = path.resolve(process.env.SORTIE ?? path.join(process.cwd(), '..', 'export', 'rendus', `traversee-${largeur}x${hauteur}`))
mkdirSync(sortie, { recursive: true })
const seulement = (process.env.SEULEMENT ?? '').split(',').filter(Boolean)
const retenu = (nom: string) => !seulement.length || seulement.includes(nom)
// Le thème que Tom et Léa portent au choix des cartes (`THEME=carnet`) : la traversée garde sa nuit et son or, mais le texte
// prend la police du thème, plus ou moins large — c'est elle qui décide de ce qui tient.
const theme = process.env.THEME || null

function chargerPlaywright(): any {
  try {
    return createRequire(import.meta.url)('playwright')
  } catch {
    const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
    return createRequire(path.join(globale, 'rendu.js'))('playwright')
  }
}
const { chromium } = chargerPlaywright()

const horloge = { depart: Date.now() }
const maintenant = () => DIX_HEURES + (Date.now() - horloge.depart)
const banc = await demarrer({ horlogeDuJour: maintenant })
const fichier = banc.quizDbUrl.replace(/^file:/, '')
// La carte 3D a besoin de WebGL : Chromium sans écran le rend par SwiftShader.
const navigateur = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const cookie = await inscrireProfil(banc.url, 'voyageuse', 'Zoé')
const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: telephone ? 2 : 1, isMobile: telephone, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
const [nom, valeur] = cookie.split('=')
await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
const page = await ctx.newPage()
page.setDefaultTimeout(20_000)
page.on('pageerror', (e: Error) => console.error('[page]', e.message))
const echecs: string[] = []
let n = 0

async function photo(nomDeLaPhoto: string) {
  n++
  await page.waitForTimeout(400)
  const f = path.join(sortie, `${String(n).padStart(2, '0')}-${nomDeLaPhoto}.png`)
  await page.screenshot({ path: f })
  // Rien ne déborde de côté : un élément poussé hors de l'écran élargit la page.
  // Le script tourne sous Node, sans les types du navigateur : ce qui s'évalue dans la page passe par `globalThis`, comme
  // dans les autres rendus.
  const debords = await page.evaluate(() => {
    const g = globalThis as any
    const l: number = g.document.documentElement.clientWidth
    const hors: string[] = []
    for (const el of g.document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.right > l + 1 && g.getComputedStyle(el).position !== 'fixed') hors.push(`${String(el.tagName).toLowerCase()}.${el.className}`.slice(0, 80))
    }
    return { large: g.document.documentElement.scrollWidth > l, hors: hors.slice(0, 5) }
  })
  console.log(`📸 ${path.basename(f)}${debords.large ? `  ⚠ la page déborde : ${debords.hors.join(' | ')}` : ''}`)
}

/**
 * Une étape du rendu, qui dit son échec sans arrêter les suivantes. `SEULEMENT=cartes` ne joue que le choix des cartes
 * mesuré aux six tailles, `SEULEMENT=traversee` que la traversée d'un bout à l'autre ; sans lui, les deux.
 */
async function etape(nomDeLEtape: string, faire: () => Promise<void>, quoi: 'cartes' | 'traversee' = 'traversee') {
  if (!retenu(quoi)) return
  try {
    await faire()
  } catch (e) {
    const ligne = `[rendu] ${nomDeLEtape} : ${(e as Error).message.split('\n')[0]}`
    echecs.push(ligne)
    console.error(ligne)
    await page.screenshot({ path: path.join(sortie, `echec-${nomDeLEtape.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`) }).catch(() => {})
  }
}

const toucher = async (texte: RegExp | string) => {
  await page.getByRole('button', { name: texte }).first().click()
  await page.waitForTimeout(650)
}

/** Une traversée écrite à la main : ses gestes rejoués par le pli jusqu'à ce que `jusqua` dise stop, puis le serveur la relit. */
function avancerALaMain(jusqua: (sorte: string, e: ReturnType<typeof etatDeLaTraversee>) => boolean) {
  const db = new Database(fichier)
  try {
    const ligne = db.prepare('SELECT id, depart FROM cabinet_traversees ORDER BY commencee_le DESC LIMIT 1').get() as { id: string; depart: string }
    const depart = lireLeDepartDeLaTraversee(ligne.depart)!
    const lus = db.prepare('SELECT geste FROM cabinet_traversee_gestes WHERE traversee_id = ? ORDER BY rang').all(ligne.id) as { geste: string }[]
    const gestes: GesteDeLaTraversee[] = lus.map(l => JSON.parse(l.geste))
    const etat = () =>
      etatDeLaTraversee(
        depart,
        gestes.map(geste => ({ geste, faitLe: maintenant() })),
      )
    let e = etat()
    let p = 0
    // Une épreuve laissée en route par le rendu — un gardien affronté — se conclut sans faute d'abord.
    const enRoute = e.ou.sorte === 'epreuve' || e.ou.sorte === 'gardien' ? e.ou.partie : null
    if (enRoute) {
      gestes.push({ quoi: 'conclure', partie: enRoute, manches: [3, 3, 3].map(etoiles => ({ etoiles, misee: false })) })
      e = etat()
    }
    for (let garde = 0; garde < 200 && !jusqua(e.ou.sorte, e) && !e.fin; garde++) {
      if (e.ameliorations > 0) gestes.push({ quoi: 'ameliorer', carte: offrables(depart, e)[0].cle })
      else {
        const ids = e.ou.sorte === 'gardien' && e.ou.partie === null ? [e.ou.etape] : atteignables(depart, e)
        const suivante = etapeDe(depart, ids.find(id => etapeDe(depart, id)?.sorte === 'epreuve') ?? ids[0])!
        if (suivante.sorte === 'coffre' || suivante.sorte === 'marchand') gestes.push({ quoi: 'aller', etape: suivante.id })
        else {
          const partie = `ecrite-${++p}`
          gestes.push({ quoi: 'epreuve', etape: suivante.id, partie })
          // Sans faute, sauf la troisième manche de la première épreuve écrite — son bilan montre de l'or et un cœur perdu —, et
          // seulement s'il en reste assez : la traversée tient jusqu'au légendaire.
          const uneRatee = p === 1 && e.coeurs > 2
          gestes.push({ quoi: 'conclure', partie, manches: (uneRatee ? [3, 2, 0] : [3, 3, 3]).map(etoiles => ({ etoiles, misee: false })) })
        }
      }
      e = etat()
    }
    db.prepare('DELETE FROM cabinet_traversee_gestes WHERE traversee_id = ?').run(ligne.id)
    const inserer = db.prepare('INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (?, ?, ?, ?, ?)')
    gestes.forEach((g, k) => inserer.run(ligne.id, k + 1, JSON.stringify(g), maintenant(), `main-${k}`))
  } finally {
    db.close()
  }
}

async function rouvrir() {
  await banc.redemarrer()
  await page.goto(`${banc.url}/cabinet`)
  await page.waitForTimeout(2500)
}

/** Les bilans pas encore lus passent d'abord : chacun photographié, puis « Continuer ». */
async function passerLesBilans(nomDesPhotos: string) {
  for (let k = 0; k < 4 && (await page.locator('.cab-tv-bilan').count()); k++) {
    await photo(`${nomDesPhotos}-${k + 1}`)
    await toucher('Continuer')
  }
}

// ── Le choix des cartes, tenu sur un écran ────────────────────────────────

type Ecran = [number, number]
/**
 * Le petit téléphone de référence, un iPhone dans Safari (ses barres dépliées), un moyen, un grand Android dans Chrome, un
 * iPhone d'aujourd'hui en application installée, un grand Android.
 */
const SIX_ECRANS: Ecran[] = [[360, 640], [390, 664], [360, 740], [412, 800], [390, 844], [412, 915]]

/**
 * Ce que l'écran du choix mesure, remonté en haut : où finit sa tête, la hauteur de ses lignes et où finit la dernière
 * par rapport au pied collé (le pli), de combien il défile dans son cadre, le bouton du pied, les cibles de moins de
 * 44 px et celles que leur voisine couvre, ce que montrent la phrase de la tête et la description de chaque carte, les
 * noms passés sur deux lignes. En texte : `tsx` y glisserait des `__name`.
 */
const LE_CHOIX_DES_CARTES = `(() => {
  const ecran = document.querySelector('.cab-tv-ecran')
  const liste = ecran && ecran.querySelector('.cab-tv-lignes')
  const pied = ecran && ecran.querySelector('.cab-tv-pied')
  if (!ecran || !liste || !pied) return null
  ecran.scrollTo(0, 0)
  const boite = el => el.getBoundingClientRect()
  const visible = el => { const r = boite(el); return r.width > 2 && r.height > 2 }
  const lignesDe = el => Math.max(1, Math.round(boite(el).height / parseFloat(getComputedStyle(el).lineHeight)))
  const dit = el => el.textContent.trim().replace(/\\s+/g, ' ')
  const lignes = [...liste.querySelectorAll('.cab-tv-ligne')]
  const bouton = pied.querySelector('.cab-tv-cta')
  const tete = ecran.querySelector('.cab-tv-tete-ecran')
  const titre = tete && tete.querySelector('h2')
  const phrase = tete && tete.querySelector('p:not(.cab-tv-sur)')
  const suite = phrase && phrase.querySelector('.cab-tv-choix-suite')
  // Coupée au bout : bornée à ses lignes (elle déborde en hauteur), ou tenue sur une seule (elle déborde en largeur).
  const coupee = el => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1
  const descriptions = lignes.map(l => l.querySelector('.cab-tv-ligne-texte small')).filter(Boolean)
  const noms = lignes.map(l => l.querySelector('.cab-tv-ligne-texte b')).filter(Boolean)
  // Une cible de doigt : 44 px au moins, dans les deux sens — et à elle sur toute sa hauteur : ce qui se glisse sur elle prend
  // le doigt à sa place (la tête, serrée sous « ← Tes gardiens », mordait de 6 px sur sa cible). Sondée en son milieu et au
  // milieu de chacun de ses bords, à 2 px en dedans — jamais à ses coins : ceux d'une ligne sont arrondis, et son cadre y
  // coupe ses deux boutons. Une cible que l'écran ne montre pas en entier, qu'on atteint en défilant, ne se sonde pas.
  const pli = boite(pied).top
  const petites = []
  const couvertes = []
  const cible = (el, nom, bas) => {
    if (!el) return
    const r = boite(el)
    if (r.width < 43.5 || r.height < 43.5) petites.push(nom + ' ' + Math.round(r.width) + ' × ' + Math.round(r.height))
    if (r.top < 0 || r.bottom > bas + 0.5) return
    const x = (r.left + r.right) / 2
    const y = (r.top + r.bottom) / 2
    const aElle = [[x, y], [x, r.top + 2], [x, r.bottom - 2], [r.left + 2, y], [r.right - 2, y]].every(([px, py]) => {
      const dessus = document.elementFromPoint(px, py)
      return !!dessus && (dessus === el || el.contains(dessus))
    })
    if (!aElle) couvertes.push(nom)
  }
  lignes.forEach((l, k) => {
    const nom = noms[k] ? dit(noms[k]) : 'carte ' + (k + 1)
    cible(l.querySelector('.cab-tv-ligne-choix'), nom, pli)
    cible(l.querySelector('.cab-tv-ligne-voir'), 'Voir ' + nom, pli)
  })
  cible(bouton, 'le bouton du pied', innerHeight)
  cible(ecran.querySelector('.jour-sortie'), 'la sortie', pli)
  const derniere = lignes.length ? boite(lignes[lignes.length - 1]).bottom : 0
  // Le fondu posé au-dessus du pied : ce qu'il assombrit de la dernière carte, l'écran défilé jusqu'au bout.
  const fondu = parseFloat(getComputedStyle(pied, '::before').height) || 0
  const marge = lignes.length ? boite(ecran.querySelector('.cab-tv-colonne')).bottom - derniere : 0
  const b = bouton ? boite(bouton) : null
  return {
    ecran: innerWidth + '×' + innerHeight,
    cartes: lignes.length,
    pli: Math.round(pli),
    tete: tete ? Math.round(boite(tete).bottom) : 0,
    premiere: lignes.length ? Math.round(boite(lignes[0]).top) : 0,
    derniere: Math.round(derniere),
    hauteurs: lignes.map(l => Math.round(boite(l).height)),
    defile: Math.max(0, Math.round(ecran.scrollHeight - ecran.clientHeight)),
    large: document.documentElement.scrollWidth > innerWidth + 1 || ecran.scrollWidth > ecran.clientWidth + 1,
    fondu: Math.max(0, Math.round(fondu - marge)),
    // Ses deux temps — « Encore 3 à choisir », « 0 sur 3 » —, dits l'un après l'autre.
    bouton: b ? { texte: [...bouton.childNodes].map(dit).filter(Boolean).join(' · '), haut: Math.round(b.height), sous: Math.round(b.bottom - innerHeight) } : null,
    petites,
    couvertes,
    titre: titre ? lignesDe(titre) : 0,
    // La phrase de la tête : tue, son début seul (sa suite cachée à l'œil), ou entière.
    phrase: !phrase ? 'pas de phrase' : !visible(phrase) ? 'tue' : suite && !visible(suite) ? 'son début, sur une ligne' : 'entière, sur ' + lignesDe(phrase) + (lignesDe(phrase) > 1 ? ' lignes' : ' ligne'),
    // Là où la feuille donne deux lignes à une description, la page les a essayées et en a gardé une : avec elles, l'écran défilait.
    repli: ecran.dataset.lignes === 'une' && matchMedia('(min-width: 412px) and (min-height: 800px)').matches,
    descriptions: {
      tues: descriptions.filter(d => !visible(d)).length,
      uneLigne: descriptions.filter(d => visible(d) && lignesDe(d) === 1).length,
      plusieurs: descriptions.filter(d => visible(d) && lignesDe(d) > 1).length,
      coupees: descriptions.filter(d => visible(d) && coupee(d)).map(d => dit(noms[descriptions.indexOf(d)] || d)),
    },
    nomsSurDeuxLignes: noms.filter(n => lignesDe(n) > 1).map(dit),
    prises: lignes.filter(l => l.classList.contains('cab-tv-prise')).length,
    dorees: lignes.filter(l => l.classList.contains('cab-tv-ligne-doree')).length,
    sceaux: liste.querySelectorAll('.cab-tv-sceau-tenu').length,
  }
})()`

const mesures: Record<string, any> = {}
/**
 * Les cas du choix des cartes qui doivent tenir sur un écran — ses dix cartes au-dessus du pied, sans défiler, le bouton
 * entier —, à chacune de leurs tailles : sinon, le script sort en erreur. Le texte agrandi se regarde sans rien exiger :
 * ses lignes grandissent avec lui, et l'écran défile dans son cadre.
 */
const CARTES_A_TENIR = ['nouveau', 'habituee', 'encoche', 'grand-ecran']
let cartesRatees = 0

/** L'état du choix, d'une mesure à l'autre : les cartes qu'on y prend en plus. */
const ETATS_DU_CHOIX: { nom: string; prendre: RegExp[] }[] = [
  { nom: 'aucune', prendre: [] },
  { nom: 'une', prendre: [/^Parade/] },
  { nom: 'trois', prendre: [/^Coup d’œil/, /^Cagnotte/] },
]

/**
 * Le choix des cartes d'un profil, mesuré et photographié à chaque taille et dans chaque état. La taille change sous la
 * même page : ses mesures ne tiennent qu'à la feuille, que le navigateur relit à chaque taille. Rien n'y part — « Partir »
 * n'est pas touché, la traversée reste devant ses gardiens pour le cas suivant.
 */
async function choixDesCartes(nomDuCas: string, cookieDuProfil: string, ecrans: Ecran[], reglages: { texte?: number; encoche?: number } = {}) {
  const [l0, h0] = ecrans[0]
  const c = await navigateur.newContext({ viewport: { width: l0, height: h0 }, deviceScaleFactor: l0 < 700 ? 2 : 1, isMobile: l0 < 700, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  try {
    const [cle, valeurDuCookie] = cookieDuProfil.split('=')
    await c.addCookies([{ name: cle, value: valeurDuCookie, url: banc.url }])
    const p = await c.newPage()
    p.setDefaultTimeout(20_000)
    p.on('pageerror', (e: Error) => console.error('[page]', e.message))
    // Sans la carte en 3D : cet écran la couvre, et la carte graphique émulée la redessinait à chaque taille — vingt secondes
    // par photo. Son module perdu en route, la page garde son ciel de nuit en CSS (`CarteEn3D`).
    await p.route(/TraverseeEn3D/, (route: any) => route.abort())
    // Un iPhone a une encoche, Chromium sans écran n'en a pas (skill `regarder-le-rendu`) : 34 px en bas avec elle.
    if (reglages.encoche) {
      const cdp = await c.newCDPSession(p)
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: reglages.encoche, topMax: reglages.encoche, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } })
    }
    await p.goto(`${banc.url}/cabinet`)
    // Une traversée neuve, ou celle qu'un cas d'avant a laissée devant ses gardiens. Chaque toucher une demi-seconde après
    // l'écran qu'il vise (`gesteAccepte`) : plus tôt, la page l'ignore.
    const commencer = p.getByRole('button', { name: 'Commencer une traversée' })
    const choisir = p.getByRole('button', { name: 'Choisir mes trois cartes' })
    await commencer.or(choisir).first().waitFor()
    await p.waitForTimeout(900)
    if (await commencer.count()) {
      await commencer.click()
      await choisir.waitFor()
      await p.waitForTimeout(900)
    }
    await choisir.click()
    await p.locator('.cab-tv-lignes').waitFor()
    // Le thème du profil arrive avec sa feuille, à la demande, puis ses polices : rien ne se mesure avant elles.
    if (theme) {
      await p.waitForFunction(`document.documentElement.dataset.theme === ${JSON.stringify(theme)}`).catch(() => {
        throw new Error(`le thème « ${theme} » ne s’est pas posé sur la page : sa clé est-elle au catalogue ?`)
      })
      await p.waitForTimeout(300)
    }
    await p.evaluate('document.fonts.ready')
    if (reglages.texte) await p.addStyleTag({ content: `html { font-size: ${reglages.texte}% !important; }` })
    for (const etat of ETATS_DU_CHOIX) {
      for (const carte of etat.prendre) {
        await p.waitForTimeout(650)
        await p.getByRole('button', { name: carte }).first().click()
      }
      for (const [largeur, hauteur] of ecrans) {
        await p.setViewportSize({ width: largeur, height: hauteur })
        await p.waitForTimeout(450)
        const m = (await p.evaluate(LE_CHOIX_DES_CARTES)) as any
        const n = `cartes-${nomDuCas}-${largeur}x${hauteur}-${etat.nom}`
        if (!m) throw new Error(`${n} : l’écran du choix des cartes n’est pas là`)
        m.sousLaNiche = ((await p.evaluate(SOUS_LA_NICHE)) as string[]).filter(x => x !== '(pas de niche)')
        mesures[n] = m
        await p.screenshot({ path: path.join(sortie, `${n}.png`) })
        // L'écran entier quand il défile : son cadre déroulé le temps d'une photo, la tête et le pied à leur place dans le fil.
        if (m.defile > 0) {
          const deroule = await p.addStyleTag({ content: '.cab-tv, .cab-tv-plein, .cab-tv-ecran { position: static !important; overflow: visible !important; height: auto !important; } .cab-tv-pied { position: static !important; }' })
          await p.screenshot({ path: path.join(sortie, `${n}-entier.png`), fullPage: true })
          await deroule.evaluate((e: { remove(): void }) => e.remove())
        }
        const sousLePied = m.derniere - m.pli
        const h = [...m.hauteurs].sort((a: number, b: number) => a - b)
        const d = m.descriptions
        // Ce qui doit tenir : les dix cartes du catalogue au-dessus du pied, sans défiler, le bouton entier, chaque cible à 44 px
        // et à elle seule, rien de plus large que l'écran ni sous la niche.
        const tient =
          m.cartes === CARTES.length && sousLePied <= 0 && m.defile === 0 && !m.large && !!m.bouton && m.bouton.sous <= 0 && m.petites.length === 0 && m.couvertes.length === 0 && m.sousLaNiche.length === 0
        const devait = CARTES_A_TENIR.includes(nomDuCas)
        if (devait && !tient) cartesRatees++
        console.log(
          `${n} — ${m.large ? 'DÉBORDE EN LARGEUR · ' : ''}la tête finit à ${m.tete} px (titre sur ${m.titre} ligne${m.titre > 1 ? 's' : ''}, sa phrase ${m.phrase}) · ${m.cartes} cartes de ${h[0]} à ${h[h.length - 1]} px · ` +
            `${sousLePied > 0 ? `la dernière finit ${sousLePied} px SOUS LE PIED` : `la dernière finit ${-sousLePied} px au-dessus du pied`} (le pied commence à ${m.pli} px) · ` +
            `${m.defile > 0 ? `l’écran DÉFILE de ${m.defile} px` : 'rien ne défile'} · « ${m.bouton?.texte} » ${m.bouton?.haut} px${m.bouton?.sous > 0 ? `, ${m.bouton.sous} px SOUS L’ÉCRAN` : ''} · ` +
            `descriptions : ${d.uneLigne} sur une ligne, ${d.plusieurs} sur plusieurs, ${d.tues} tue${d.tues > 1 ? 's' : ''}, ${d.coupees.length} coupée${d.coupees.length > 1 ? 's' : ''} au bout` +
            `${m.repli ? ' (deux lignes essayées, une gardée)' : ''} · ` +
            `${m.prises} prise${m.prises > 1 ? 's' : ''}, ${m.sceaux} sceau${m.sceaux > 1 ? 'x' : ''} tenu${m.sceaux > 1 ? 's' : ''}, ${m.dorees} dorée${m.dorees > 1 ? 's' : ''}` +
            `${devait && !tient ? ' — DEVAIT TENIR' : ''}`,
        )
        if (m.fondu > 0) console.log(`   le fondu du pied assombrit ${m.fondu} px de la dernière carte, l’écran défilé jusqu’au bout`)
        if (m.petites.length) console.log(`   CIBLES DE MOINS DE 44 PX — ${m.petites.join(' · ')}`)
        if (m.couvertes.length) console.log(`   CIBLES COUVERTES — ${m.couvertes.join(' · ')}`)
        if (m.nomsSurDeuxLignes.length) console.log(`   leur nom sur deux lignes — ${m.nomsSurDeuxLignes.join(' · ')}`)
        if (d.coupees.length) console.log(`   leur description coupée au bout — ${d.coupees.join(' · ')}`)
        if (m.sousLaNiche.length) console.log(`   SOUS LA NICHE — ${m.sousLaNiche.join(' · ')}`)
      }
    }
  } finally {
    await c.close()
  }
}

await etape('choix-des-cartes', async () => {
  // Tom, qui n'a jamais joué : ni défi tenu, ni compagnon. Léa, une habituée : son loup dans sa niche, au coin haut droit, la
  // Cagnotte tenue à l'Argent — son liseré doré —, la Panacée à l'Or, la Parade au Bronze.
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  {
    const db = new Database(fichier)
    try {
      const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id
      db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', id)
      db.prepare(`INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, nom, created_at) VALUES (?, 'loup', 1000, 2, 'Croc', 1)`).run(id)
      const sceau = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#cabinet', '', '🃏', 'défi', 1)`)
      for (const cle of ['cabinet:defi:cagnotte:1', 'cabinet:defi:cagnotte:2', 'cabinet:defi:panacee:1', 'cabinet:defi:panacee:2', 'cabinet:defi:panacee:3', 'cabinet:defi:parade:1']) sceau.run(id, cle)
      // Le thème porté, écrit sur les deux profils : la page le lit et le pose comme en vrai (`porterTheme`).
      if (theme) db.prepare('UPDATE profiles SET theme = ? WHERE login IN (?, ?)').run(theme, 'tom', 'lea')
    } finally {
      db.close()
    }
  }
  // Ce qui s'est écrit derrière le dos du serveur ne se lit qu'après son redémarrage.
  await banc.redemarrer()
  if (theme) console.log(`Le choix des cartes, sous le thème « ${theme} »`)
  await choixDesCartes('nouveau', tom, SIX_ECRANS)
  await choixDesCartes('habituee', lea, SIX_ECRANS)
  // Un iPhone, l'application installée : 47 px d'encoche en haut, 34 en bas, que l'écran retranche et qu'aucune requête de média
  // ne voit — celui d'aujourd'hui, puis le plus grand, où la feuille donne deux lignes à une description.
  await choixDesCartes('encoche', lea, [[390, 844], [430, 932]], { encoche: 47 })
  // Le texte agrandi : au petit téléphone, puis là où deux lignes s'essaient — la page revient à une.
  await choixDesCartes('agrandi', tom, [[360, 640], [412, 800]], { texte: 130 })
  await choixDesCartes('grand-ecran', tom, [[768, 1024], [1366, 768]])
  writeFileSync(path.join(sortie, 'mesures-des-cartes.json'), JSON.stringify(mesures, null, 2))
}, 'cartes')

await etape('titre', async () => {
  await page.goto(`${banc.url}/cabinet`)
  await page.getByRole('button', { name: 'Commencer une traversée' }).waitFor()
  await page.waitForTimeout(2500)
  await photo('titre')
})
await etape('gardiens', async () => {
  await toucher('Commencer une traversée')
  await page.waitForTimeout(2500)
  await photo('trois-gardiens')
})
await etape('cartes', async () => {
  await toucher('Choisir mes trois cartes')
  await photo('choix-des-cartes')
  // « Voir » ouvre la fiche d'une carte, où elle se prend ; les autres se prennent d'un toucher sur leur ligne.
  await toucher('Voir la carte Coup d’œil')
  await photo('fiche-d-une-carte')
  await toucher('Prendre cette carte')
  for (const c of [/^Quitte ou double/, /^Cagnotte/]) await toucher(c)
  await page.evaluate(() => (globalThis as any).document.querySelector('.cab-tv-ecran')?.scrollTo(0, 99999))
  await photo('cartes-choisies')
})
await etape('carte', async () => {
  await toucher(/^Partir/)
  await page.waitForTimeout(1200)
  await photo('acte-1-carton')
  await page.waitForTimeout(2600)
  await photo('acte-1-carte')
})
await etape('regard', async () => {
  // Une étape lointaine touchée sur la carte. La caméra ne montre d'office que le rang d'à côté : la carte glisse d'abord vers
  // le bas, comme au doigt, pour montrer plus loin ; puis le doigt balaie la bande entre la tête et le panneau, du plus loin au
  // plus près et au milieu seulement — les îles y tiennent —, jusqu'à ce que le panneau en dise une. La carte est décorative :
  // rien ne dit où ses îles tombent à l'écran.
  const haut = (await page.locator('.cab-tv-hud').boundingBox())!
  const bas = (await page.locator('.cab-tv-panneau').boundingBox())!
  // Le geste part du milieu de la bande : plus haut, il tombait dans le bas de la tête, qui n'est pas la carte.
  const milieu = (haut.y + haut.height + bas.y) / 2
  await page.mouse.move(largeur / 2, milieu)
  await page.mouse.down()
  for (let k = 1; k <= 14; k++) await page.mouse.move(largeur / 2, milieu + k * 20)
  await page.mouse.up()
  await page.waitForTimeout(1500)
  await photo('carte-plus-loin')
  let vue = false
  const pasX = Math.max(20, Math.round(largeur / 30))
  for (let y = haut.y + haut.height + 6; y < bas.y - 6 && !vue; y += 16) {
    for (let x = Math.round(largeur * 0.15); x < largeur * 0.85 && !vue; x += pasX) {
      await page.touchscreen.tap(x, y)
      const dit: string | null = await page.evaluate(() => (globalThis as any).document.querySelector('.cab-tv-regard small')?.textContent ?? null)
      vue = !!dit && !/Derrière|Déjà/.test(dit)
    }
  }
  if (!vue) throw new Error('aucune étape lointaine sous le doigt')
  await page.waitForTimeout(500)
  await photo('regard-lointain')
  await page.getByRole('button', { name: 'Ne plus regarder cette étape' }).click()
  await page.waitForTimeout(400)
})
await etape('annonce', async () => {
  await page.locator('.cab-tv-option').first().click()
  await page.waitForTimeout(700)
  await photo('etape-choisie')
  await page.locator('.cab-tv-panneau .cab-tv-cta').click()
  await page.waitForTimeout(2200)
  await photo('annonce-epreuve')
})
await etape('epreuve', async () => {
  // Un Quiz s'ouvre sur l'un de ses thèmes au choix : le premier, s'il en propose.
  const unTheme = page.locator('.cab-tv-themes .cab-tv-option')
  if (await unTheme.count()) {
    await unTheme.first().click()
    await page.waitForTimeout(500)
  }
  await toucher(/^Commencer/)
  await page.waitForTimeout(1500)
  await photo('epreuve-premiere-manche')
})
await etape('quitter', async () => {
  // Sous Quitte ou double, la mise se décide d'abord : on ne mise pas.
  const pasCetteFois = page.getByRole('button', { name: 'Pas cette fois' })
  if (await pasCetteFois.count()) await toucher('Pas cette fois')
  await page.waitForTimeout(800)
  await photo('epreuve-manche')
  await page.getByRole('button', { name: 'Quitter' }).first().click()
  await page.waitForTimeout(800)
  await photo('quitter-l-epreuve')
  await page.getByRole('button', { name: 'Quitter la partie' }).click()
  await page.waitForTimeout(2500)
  await photo('bilan-de-l-epreuve')
  await toucher('Continuer')
  await page.waitForTimeout(1500)
  await photo('carte-apres-l-epreuve')
})
await etape('feuilles', async () => {
  await page.getByRole('button', { name: 'Tes cartes' }).click()
  await page.waitForTimeout(700)
  await photo('feuille-des-cartes')
  await page.getByRole('button', { name: 'Fermer' }).click()
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.waitForTimeout(700)
  await photo('feuille-du-menu')
  await page.getByRole('button', { name: 'Fermer' }).click()
})
await etape('marchand', async () => {
  avancerALaMain(sorte => sorte === 'marchand')
  await rouvrir()
  await passerLesBilans('bilan-avant-le-marchand')
  await photo('marchand')
  await page.evaluate(() => (globalThis as any).document.querySelector('.cab-tv-ecran')?.scrollTo(0, 99999))
  await photo('marchand-bas')
})
await etape('gardien', async () => {
  await page.locator('.cab-tv-pied .cab-tv-cta').click()
  await page.waitForTimeout(2600)
  await photo('annonce-du-gardien')
})
await etape('legendaire', async () => {
  avancerALaMain(sorte => sorte === 'legendaire')
  await rouvrir()
  await passerLesBilans('bilan-avant-le-legendaire')
  await photo('choix-du-legendaire')
  await page.locator('.cab-tv-legendaire').first().click()
  await page.waitForTimeout(400)
  await page.locator('.cab-tv-pied .cab-tv-cta').click()
  await page.waitForTimeout(1500)
  await photo('legendaire-gagne')
  // Sous le pli de sa fin : ses exploits, les paliers de ses pistes, les défis de ses cartes (le 4 novembre 2026).
  await page.evaluate(() => (globalThis as any).document.querySelector('.cab-tv-ecran')?.scrollTo(0, 99999))
  await photo('legendaire-gagne-bas')
})

await etape('quiz', async () => {
  // Une traversée neuve, écrite à la main, dont la première étape est un Quiz à trois thèmes au choix, l'un un sujet de la base —
  // la carte tire ses jeux au hasard, et le Quiz n'en est qu'un sur dix : son annonce, le thème choisi, une question, la
  // suivante, sa révélation.
  const db = new Database(fichier)
  try {
    const { profile_id: profil } = db.prepare('SELECT profile_id FROM cabinet_traversees ORDER BY commencee_le DESC LIMIT 1').get() as { profile_id: string }
    const actes = tracerLaCarte(Math.random, ['lg:renard', 'lg:sphinx', 'lg:dragon'], { epingle: ['Rome'], frise: ['Rome'] })
    const quiz = { jeu: 'quiz' as const, choix: [{ theme: 'Histoire' }, { theme: 'Les animaux', sujet: 'animaux', emoji: '🧩' }, { theme: 'Le football', sujet: 'sport/football', emoji: '⚽' }] }
    // L'étape faite Quiz perd le thème de son jeu d'avant : ses thèmes au choix font le sien.
    const enQuiz = ({ theme: _t, sujet: _s, emoji: _e, ...e }: (typeof actes)[0]['etapes'][number]) => ({ ...e, sorte: 'epreuve' as const, ...quiz })
    const depart: DepartDeLaTraversee = {
      v: VERSION_DE_LA_TRAVERSEE,
      jour: '2026-10-24',
      actes: [{ ...actes[0], etapes: actes[0].etapes.map(e => (e.id === 'a0r1c0' ? enQuiz(e) : e)) }, actes[1], actes[2]],
    }
    const id = `rendu-du-quiz-${Date.now()}`
    db.prepare('INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le) VALUES (?, ?, ?, ?)').run(id, profil, JSON.stringify(depart), maintenant())
    db.prepare('INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (?, 1, ?, ?, ?)').run(id, JSON.stringify({ quoi: 'cartes', cartes: ['cagnotte', 'parade', 'panacee'] }), maintenant(), 'rendu-0')
  } finally {
    db.close()
  }
  await rouvrir()
  await page.locator('.cab-tv-option', { hasText: 'Le Quiz' }).first().click()
  await page.waitForTimeout(700)
  await photo('quiz-choisi')
  await page.locator('.cab-tv-panneau .cab-tv-cta').click()
  await page.waitForTimeout(2200)
  await photo('quiz-annonce')
  await page.locator('.cab-tv-themes .cab-tv-option', { hasText: 'Les animaux' }).click()
  await page.waitForTimeout(600)
  await photo('quiz-theme-choisi')
  await page.evaluate(() => (globalThis as any).document.querySelector('.cab-tv-ecran')?.scrollTo(0, 99999))
  await photo('quiz-theme-choisi-bas')
  await toucher(/^Commencer/)
  await page.waitForTimeout(1500)
  await photo('quiz-question-1')
  await page.locator('.ans-btn').first().click()
  await page.waitForTimeout(900)
  await photo('quiz-question-2')
  for (let k = 0; k < 3; k++) {
    await page.locator('.ans-btn').nth(k).click()
    await page.waitForTimeout(900)
    await photo(`quiz-apres-la-reponse-${k + 2}`)
  }
  await page.waitForTimeout(1500)
  await photo('quiz-revelation')
  await page.evaluate(() => (globalThis as any).scrollTo(0, 99999))
  await photo('quiz-revelation-bas')
})
await etape('gardien-de-l-acte-ii', async () => {
  // Le gardien de l'acte II, après un premier assaut : quinze points de vie depuis la version 2, une jauge et ses chiffres.
  avancerALaMain((sorte, e) => sorte === 'gardien' && e.acte === 1)
  await rouvrir()
  await passerLesBilans('bilan-avant-le-gardien-ii')
  await photo('gardien-de-l-acte-ii')
})

if (cartesRatees > 0) console.log(`\nLe choix des cartes ne tient plus sur un écran : ${cartesRatees} mesure(s) qui devaient tenir (« DEVAIT TENIR », plus haut)`)
console.log(echecs.length ? `\n${echecs.length} étape(s) en échec :\n${echecs.join('\n')}` : `\nToutes les étapes passent — ${n} photos de la traversée, ${Object.keys(mesures).length} mesures du choix des cartes, dans ${sortie}`)
await navigateur.close()
await banc.close()
// Par le code de sortie de Node, pas `process.exit()` : ce qui vient de s'écrire part d'abord (règle `tests.md`).
if (echecs.length || cartesRatees > 0) process.exitCode = 1
