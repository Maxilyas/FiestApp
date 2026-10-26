// Le Cabinet de curiosités photographié comme le verra un joueur, au doigt
// (`hasTouch`, `tap()` : une case prise au lever du doigt change la page avant
// le `click` qui suit, et la souris ne le montre pas — règle `client.md`), sur
// un serveur jetable et la vraie base de la campagne, l'horloge du jour à la
// main : elle court avec celle de la machine — les chronos des manches sont
// les vrais —, et le script l'avance d'un jour pour le lendemain.
//
// La page sans profil ; Zoé, qui arrive — son musée et sa bienvenue, les
// règles, le Vestibule et ses quatre œuvres offertes, un cadre vide, les jeux
// libres, les gardiens endormis — ; puis Léa, qui a joué — trente-neuf œuvres,
// le Rempart complet et son Phénix, de la poussière d'or, douze jours de
// série, son loup dans sa niche — : son musée, une salle complète et ses
// cadres dorés, une œuvre et son cartel, une salle à une œuvre près, son cadre
// vide, les gardiens et une fiche, la visite du jour ; l'annonce et le choix
// de sa carte-bonus ; la fiche de sa niche, touchée en pleine manche (`[fiche]`
// si elle ne sort pas sous la niche) ; une manche et sa révélation de chacun des neuf jeux, en
// partie libre — le Pari parié, l'Éclair et ses cinq affirmations, le Détail
// éclairé et un pas en arrière, la Frise rangée, le Mot mystère et la pause de
// « Quitter ? », un essai et ses couleurs, le Filet éclairé, l'Épingle
// éclairée et plantée, les Indices — un indice de plus, un nom refusé —, la
// Réplique, puis sa seconde manche laissée au temps (« Qui l'a dit ? ») —, et
// le bilan d'une partie quittée ; le Filet d'une unité longue, écrite dans son
// plan ; la partie qui l'attend au musée ; une partie
// de la visite — son annonce, son seuil dans la tête, rechargée en pleine manche,
// sa case « En cours » et son « Reprendre », « Quitter ? » qui dit ce qu'on
// emporte, son bilan manqué et « Retenter », l'annonce de la retente, la visite
// pendant la retente et sa tête — ; une case pour dorer et son annonce, son
// œuvre écrite au musée, puis dorée dans la journée ; la chasse
// de la dernière œuvre de l'Érudit, gagnée sans faute — le bilan doré, la
// Chouette d'Argent qui s'éveille, « Mes réponses » —, l'œuvre et le cartel
// que la partie lui a laissé ; l'achat de la dernière œuvre du Devin et le
// Sphinx qui s'éveille ; ses murs ; et, l'horloge avancée d'un jour, le musée
// du lendemain.
//
// À chaque photo, ce qui élargit la page (`[déborde]`, et ce qui l'élargit),
// un texte que son cadre coupe (`[coupé]`), un texte qui passe sous un bouton
// de sa rangée (`[chevauche]`), ce qui passe sous la niche (`[sous la
// niche]`) et un texte qui ne se lit pas sur ce qui est peint derrière lui
// (`[contraste]`) — les mesures de `a-l-ecran.ts` —, un texte qui sort de son
// propre bouton (`[hors du bouton]`) ; et ce que le `click` qui suit le doigt a
// fait que la souris n'aurait pas fait (`[écho]`). Une partie dit en plus si sa
// tête se chevauche — le total sous « Quitter », la niche posée ou non, ou
// « Quitter » passé à la ligne ailleurs qu'au bout du chrono (`[tête]`) —, et
// si ce qu'on manipule tient avec ce qu'on lit entre la tête
// et le pied collés : la ligne à taper du Mot, à l'ouverture et après chaque
// essai (`[mot]`) ; la question et la carte entière de l'Épingle, à un
// défilement au moins, la carte à la même largeur avant et après Éclairer,
// jamais plus large « Pas à pas » ouvert (`[épingle]`) ; le tableau du Détail entier sous
// la tête et au-dessus de chaque titre amené au bas de l'écran, à la même
// hauteur tout du long (`[détail]`) — la tablée du 25 octobre 2026, au texte
// agrandi, et sa relecture. Leur compte à la fin, et le tout dans
// `rapport.txt`. Le client construit d'abord (`npm run build -w client`).
//
// `THEME` : tout thème — offert, vendu ou gagné —, que Zoé et Léa portent d'office.
// `ZOOM=130` : le texte à 130 %, posé comme la tablée le pose (`zoom` sur la page) ; `ECRAN=277x492`, comme Chrome Android le fait
// vraiment — la taille du texte du téléphone y est un zoom de la page. `JEUX=mot,epingle` : ces jeux seuls, dans la boucle des neuf.
//
//   npx tsx scripts/rendu-cabinet.ts ../export/rendu-cabinet    (ECRAN=1366x768, THEME=ivoire, ENCOCHE=47, ZOOM=130, JEUX=detail)
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { demarrer, inscrireProfil } from '../test/banc'
import { DIX_HEURES, departEnBase } from '../test/cabinet-banc'
import { CE_QUI_DEBORDE, CE_QUI_EST_COUPE, CE_QUI_SE_CHEVAUCHE, SOUS_LA_NICHE, contrasteDeLaPage } from './a-l-ecran'
import { PIED_COLLE, TETE_COLLEE } from '../../client/src/views/cabinet/bande'
import { HAUTEUR_DE_LA_CARTE, LARGEUR_DE_LA_CARTE, projeter } from '../../shared/cabinet/france'
import { JEUX, type CleDeJeu } from '../../shared/cabinet/jeux/regle'
import type { DetailTire } from '../../shared/cabinet/jeux/detail'
import type { EclairTire } from '../../shared/cabinet/jeux/eclair'
import type { EpingleTiree } from '../../shared/cabinet/jeux/epingle'
import type { FiletTire } from '../../shared/cabinet/jeux/filet'
import type { FriseTiree } from '../../shared/cabinet/jeux/frise'
import type { IndicesTires } from '../../shared/cabinet/jeux/indices'
import type { MotTire } from '../../shared/cabinet/jeux/mot'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import type { RepliqueTiree } from '../../shared/cabinet/jeux/replique'
import { OEUVRES, OEUVRES_DE_DEPART, oeuvre as oeuvreDe, oeuvresDeLaSalle, type CleDOeuvre } from '../../shared/cabinet/oeuvres'
import type { CleDeSalle } from '../../shared/cabinet/salles'
import { THEMES } from '../../shared/themes'

const sortie = path.resolve(process.argv[2] ?? 'rendu-cabinet')
mkdirSync(sortie, { recursive: true })
const [largeur, hauteur] = (process.env.ECRAN ?? '360x640').split('x').map(Number)
const telephone = largeur < 600
const theme = process.env.THEME ?? null
// Une clé inconnue se dit d'emblée : écrite en base, le serveur la lirait comme le Velours, et le rendu photographierait l'autre.
if (theme && !THEMES.some(t => t.key === theme)) throw new Error(`THEME=${theme} : aucun thème de ce nom (${THEMES.map(t => t.key).join(', ')})`)
// L'encoche d'un iPhone, en pixels : Chromium sans écran la tient à zéro, et la niche descend avec elle (`rendu-niche.ts`).
const encoche = Number(process.env.ENCOCHE ?? 0)
// Le texte agrandi, en pour cent, comme la tablée le pose : `zoom` sur la page, dès qu'elle existe.
const zoom = Number(process.env.ZOOM ?? 100)
if (!(zoom >= 50 && zoom <= 300)) throw new Error(`ZOOM=${process.env.ZOOM} : un pourcentage, de 50 à 300`)
const jeuxDemandes = process.env.JEUX ? (process.env.JEUX.split(',').map(j => j.trim()) as CleDeJeu[]) : null
const jeuxInconnus = (jeuxDemandes ?? []).filter(j => !(j in JEUX))
if (jeuxInconnus.length) throw new Error(`JEUX : ${jeuxInconnus.join(', ')} — aucun jeu de ce nom (${Object.keys(JEUX).join(', ')})`)

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

// ── L'horloge du jour ─────────────────────────────────────────────────────

/**
 * Le samedi 24 octobre 2026 à 10 h de Paris, qui court avec la machine : les
 * chronos des manches, que la page lit à l'heure du serveur (invariant 6),
 * sont les vrais. Le banc ferme le calendrier des fêtes : aucune Citrouille.
 */
const horloge = { depart: Date.now(), avance: 0 }
const maintenant = () => DIX_HEURES + (Date.now() - horloge.depart) + horloge.avance
const JOUR = 24 * 3_600_000

// ── Les photos et ce qu'elles ne disent pas ───────────────────────────────

const rapport: string[] = []
const echecs: string[] = []
/** Ce que le doigt a fait que la souris n'aurait pas fait : un défaut de la page, dit une fois chacun, sans arrêter le parcours. */
const echos: string[] = []
let numero = 0

/**
 * Un texte qui sort de son propre bouton, à gauche ou à droite : « Répondre » des Indices, un seul mot, débordait de treize
 * pixels de chaque côté au texte agrandi, et sur l'accent on lisait « épondr » (la tablée du 25 octobre 2026). `[coupé]` ne le
 * voit pas : un bouton ne coupe pas ce qui le déborde.
 */
const HORS_DU_BOUTON = `(() => {
  const visible = el => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false } return true }
  const sortis = []
  for (const b of document.querySelectorAll('.cab-page button, .carte-feuille button')) {
    if (!visible(b) || b.closest('.sr-only')) continue
    const r = b.getBoundingClientRect()
    // Le texte qu'on voit, nœud par nœud : ce qui ne se dit qu'à l'oreille (\`.sr-only\`) se pose hors de tout, exprès.
    let pire = 0, dit = ''
    const marcheur = document.createTreeWalker(b, NodeFilter.SHOW_TEXT)
    for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
      if (!t.textContent.trim() || t.parentElement.closest('.sr-only') || !visible(t.parentElement)) continue
      const plage = document.createRange()
      plage.selectNodeContents(t)
      for (const x of plage.getClientRects()) {
        const hors = Math.max(r.left - x.left, x.right - r.right)
        if (x.width > 1 && hors > pire) { pire = hors; dit = t.textContent.trim() }
      }
    }
    if (pire > 1) sortis.push('« ' + [...dit].slice(0, 30).join('') + ' » de ' + Math.round(pire) + ' px')
  }
  return sortis
})()`

/** Un texte tel qu'on le compare : sans les espaces fines ni le gluon que la page pose (`espacesFines`). */
const net = (s: string) =>
  s
    .replace(/\u{2060}/gu, '')
    .replace(/[\u{a0}\u{202f}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * La photo — son écran, ou la page entière —, ses images arrivées, puis ce
 * qu'elle ne dit pas d'elle-même : ce qui déborde, ce qui est coupé, ce qui
 * passe sous la niche (s'il y en a une), et ce qui se lit mal.
 */
async function photo(page: any, nom: string, { pleine = false, attente = 500 } = {}) {
  await page.evaluate('document.fonts.ready')
  // Trois secondes au plus : une image `loading="lazy"` hors de l'écran — une œuvre au bas d'une feuille — ne se charge pas, et
  // son `decode()` attendait toujours.
  await page.evaluate('Promise.race([Promise.all([...document.images].map(i => i.decode().catch(() => {}))), new Promise(r => setTimeout(r, 3000))])')
  await page.waitForTimeout(attente)
  const fichier = path.join(sortie, `${String(++numero).padStart(2, '0')}-${nom}.png`)
  await page.screenshot({ path: fichier, fullPage: pleine })
  const defauts: string[] = []
  const deborde: { large: number; fautifs: string[] } = await page.evaluate(CE_QUI_DEBORDE)
  if (deborde.large) defauts.push(`[déborde] ${deborde.large} px de large — ${deborde.fautifs.join(' · ')}`)
  const coupes: string[] = await page.evaluate(CE_QUI_EST_COUPE)
  if (coupes.length) defauts.push(`[coupé] ${coupes.slice(0, 6).join(' · ')}`)
  const dessous: string[] = await page.evaluate(CE_QUI_SE_CHEVAUCHE)
  if (dessous.length) defauts.push(`[chevauche] ${dessous.slice(0, 6).join(' · ')}`)
  const sortis: string[] = await page.evaluate(HORS_DU_BOUTON)
  if (sortis.length) defauts.push(`[hors du bouton] ${sortis.slice(0, 6).join(' · ')}`)
  // La niche se mesure page en haut, là où elle se pose : la page défilée passe dessous, comme sous toute la barre du haut.
  if ((await page.locator('.niche').count()) && Number(await page.evaluate('window.scrollY')) < 1) {
    const sousLaNiche: string[] = await page.evaluate(SOUS_LA_NICHE)
    if (sousLaNiche.length) defauts.push(`[sous la niche] ${sousLaNiche.join(' · ')}`)
  }
  const faibles = (await contrasteDeLaPage(page)).filter(l => l.ratio < l.seuil)
  if (faibles.length) defauts.push(`[contraste] ${faibles.slice(0, 6).map(l => `${l.ratio}:1 < ${l.seuil} « ${l.texte} »`).join(' · ')}`)
  const ligne = `${path.basename(fichier)} : ${defauts.length ? defauts.join(' ') : 'rien à redire'}`
  rapport.push(ligne)
  console.log(ligne)
}

/** Au-delà, une feuille ne finit plus : son corps défile sans fin, ou ne défile pas. */
const ECRANS_D_UNE_FEUILLE_AU_PLUS = 40

/**
 * Une feuille entière, morceau par morceau, jusqu'à son bas : son corps
 * défile en lui-même, et la photo de la page n'en montre que le haut. Arrêtée
 * à huit écrans, la feuille du choix de la carte-bonus de Léa — trente-neuf
 * œuvres — taisait ses dernières cartes, et le rapport disait « rien à
 * redire » (la relecture du lot).
 */
async function photoDeLaFeuille(page: any, nom: string) {
  const corps = page.locator('.carte-feuille .carte-corps').last()
  await corps.waitFor()
  for (let k = 0; k < ECRANS_D_UNE_FEUILLE_AU_PLUS; k++) {
    await photo(page, k === 0 ? nom : `${nom}-${k + 1}`)
    // Une fonction, pas un texte : une chaîne s'évalue en expression, et la fonction qu'elle écrit ne s'appelait pas.
    const fini: boolean = await corps.evaluate((c: any) => {
      const avant = c.scrollTop
      c.scrollTop += c.clientHeight - 60
      return c.scrollTop === avant
    })
    if (fini) return
  }
  echecs.push(`[rendu] ${nom} : la feuille ne finit pas après ${ECRANS_D_UNE_FEUILLE_AU_PLUS} écrans`)
}

/** La page du téléphone qui joue l'étape en cours : son écran dit où une étape s'est arrêtée. */
let surLEcran: any = null

/**
 * Une étape du parcours : son échec se dit, l'écran où elle s'est arrêtée se
 * photographie (`echec-…`), et le parcours continue — une photo manquée n'en
 * cache pas vingt.
 */
async function etape(nom: string, faire: () => Promise<void>) {
  try {
    await faire()
  } catch (e) {
    const ligne = `[rendu] ${nom} : ${(e as Error).message.split('\n')[0]}`
    echecs.push(ligne)
    console.error(ligne)
    await surLEcran?.screenshot({ path: path.join(sortie, `echec-${nom.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`) }).catch(() => {})
  }
}

// ── Le serveur, Zoé et Léa ────────────────────────────────────────────────

const banc = await demarrer({ horlogeDuJour: maintenant })
const fichier = banc.quizDbUrl.replace(/^file:/, '')
const navigateur = await chromium.launch({ headless: true })

/** L'identifiant d'un profil, lu comme la page le lit. */
async function idDe(cookie: string): Promise<string> {
  return ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
}

/**
 * Ce que Léa a gagné, écrit à la main : le Rempart complet, cinq de ses cadres
 * dorés ; l'Érudit à une œuvre près — la Leçon, au Pari, que sa chasse ira
 * chercher — ; le Devin à une commune près, qu'elle achètera ; dix œuvres du
 * Vestibule et quelques autres ; 1 200 poussières d'or ; douze jours de
 * visite d'affilée jusqu'à la veille. Le musée lu à froid réveille le Phénix
 * en silence (`reconcilier`). Rien de la Leçon ni de cette commune n'est
 * écrit : la page les montre en cadres vides.
 */
const LA_LECON: CleDOeuvre = 'lecon'
const communeDuDevin = oeuvresDeLaSalle('devin').find(o => o.rarete === 'commun')!.cle
function ecrireLeMuseeDeLea(id: string) {
  const db = new Database(fichier)
  try {
    const avant = (j: number) => maintenant() - j * JOUR
    const oeuvre = db.prepare(`INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, doree_le, dorure) VALUES (?, ?, 'partie', ?, ?, ?)`)
    const sesOeuvres: [CleDeSalle, number][] = [
      ['rempart', 8],
      ['erudit', 8],
      ['devin', 8],
      ['vestibule', 10],
      ['elan', 3],
      ['flambeur', 2],
      ['metamorphe', 1],
      ['sophiste', 1],
    ]
    let j = 40
    for (const [salle, combien] of sesOeuvres) {
      const aEcrire = oeuvresDeLaSalle(salle)
        .filter(o => o.cle !== LA_LECON && o.cle !== communeDuDevin && !OEUVRES_DE_DEPART.includes(o.cle as CleDOeuvre))
        .slice(0, salle === 'vestibule' ? combien - OEUVRES_DE_DEPART.length : combien)
      aEcrire.forEach((o, k) => {
        const doree = salle === 'rempart' && k < 5
        oeuvre.run(id, o.cle, avant(j--), doree ? avant(j) : null, doree ? 'partie' : null)
      })
    }
    db.prepare(`INSERT INTO cabinet_profils (profile_id, poussiere, serie, serie_jour, serie_record, cree_le, maj_le) VALUES (?, 1200, 12, '2026-10-23', 12, ?, ?)`).run(id, avant(40), avant(1))
    // Son loup, dans sa niche : la page qui lit le profil la pose (`porterNiche`), et ce qui passe dessous se mesure.
    db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', id)
    db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 0, 1, 1)').run(id, 'loup')
  } finally {
    db.close()
  }
}

/**
 * Le thème photographié, porté d'office par les deux profils, écrit en base :
 * offert, vendu ou gagné, le serveur le lit tel quel (`themePorte`). Acheté
 * pour Léa seule et demandé par la route, il laissait Zoé refusée (« s'achète
 * d'abord »), et un thème qui se gagne se refusait à toutes deux, avant la
 * première photo (la relecture du lot) ; ouvrir sa condition — des badges, des
 * paliers de maître — aurait changé ce que leurs gardiens montrent.
 */
function porterLeTheme(ids: string[]) {
  const db = new Database(fichier)
  try {
    const porter = db.prepare('UPDATE profiles SET theme = ? WHERE id = ?')
    for (const id of ids) porter.run(theme === 'velours' ? null : theme, id)
  } finally {
    db.close()
  }
}

/**
 * Une unité longue au Filet de la partie en cours, écrite dans son plan en base : le hasard du tirage n'en donne pas à chaque
 * rendu, et au texte agrandi « 82 chromosomes » sortait de l'écran, « − 8 chromosomes » de son bouton (le rendu du 26 octobre
 * 2026). Le serveur relu la sert telle quelle ; onze signes, quand une unité en a douze au plus (`MAX_UNIT`).
 */
function uneUniteLongue(id: string) {
  const db = new Database(fichier)
  try {
    const { partie } = db.prepare('SELECT partie FROM cabinet_profils WHERE profile_id = ?').get(id) as { partie: string | null }
    if (!partie) throw new Error('aucune partie en cours')
    const { cabinet } = db.prepare('SELECT cabinet FROM campagne_series WHERE id = ?').get(partie) as { cabinet: string }
    const depart = JSON.parse(cabinet) as { tirages: { jeu: string; question: { texte: string } }[] }
    for (const t of depart.tirages.filter(x => x.jeu === 'filet')) {
      Object.assign(t, { valeur: 46, annee: false, unite: 'chromosomes', piste: { min: 0, max: 82, pas: 1 } })
      t.question.texte = 'Combien de chromosomes comptent la plupart des cellules du corps humain ?'
    }
    db.prepare('UPDATE campagne_series SET cabinet = ? WHERE id = ?').run(JSON.stringify(depart), partie)
  } finally {
    db.close()
  }
}

/** La partie en cours d'un profil, lue en base, et ce qu'elle a tiré : la page ne le voit jamais avant le verdict. */
function tirageEnCours<T>(id: string, k: number): T {
  const db = new Database(fichier, { readonly: true })
  try {
    const { partie } = db.prepare('SELECT partie FROM cabinet_profils WHERE profile_id = ?').get(id) as { partie: string | null }
    if (!partie) throw new Error('aucune partie en cours')
    return departEnBase(fichier, partie).tirages[k] as T
  } finally {
    db.close()
  }
}

/** Un téléphone (ou le portable, en 1366 × 768), au doigt, son profil connecté, son encoche posée. */
async function telephoneDe(cookie: string | null, initial = '') {
  const ctx = await navigateur.newContext({
    viewport: { width: largeur, height: hauteur },
    deviceScaleFactor: telephone ? 2 : 1,
    isMobile: telephone,
    hasTouch: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  })
  if (cookie) {
    const [nom, valeur] = cookie.split('=')
    await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
  }
  if (initial) await ctx.addInitScript(initial)
  // Le texte agrandi, comme la tablée le pose : un `zoom` sur la page — une requête d'écran ne le voit pas, une de conteneur si.
  if (zoom !== 100) await ctx.addInitScript(`document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.zoom = '${zoom}%' })`)
  const page = await ctx.newPage()
  surLEcran = page
  page.setDefaultTimeout(20_000)
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  if (encoche) {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: encoche, topMax: encoche, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } })
  }
  return { ctx, page }
}

/** Une adresse du Cabinet ouverte à neuf : un fragment seul, vers la même page, ne la relirait pas. */
async function ouvrir(page: any, fragment: string, attendu: string) {
  await page.goto('about:blank')
  await page.goto(`${banc.url}/cabinet${fragment}`)
  await page.waitForSelector(attendu)
}

/**
 * Un toucher, comme le doigt : l'écran le laisse passer une demi-seconde après
 * avoir changé (`gesteAccepte`) — un toucher plus tôt visait l'écran d'avant,
 * et la page l'ignore.
 */
async function toucher(page: any, cible: any, attente = 650) {
  await cible.waitFor({ state: 'visible' })
  await cible.scrollIntoViewIfNeeded()
  await page.waitForTimeout(attente)
  await cible.tap()
}

/** Le bouton qui dit ce texte, parmi ceux du sélecteur. */
async function boutonQuiDit(page: any, selecteur: string, texte: string) {
  const textes: string[] = (await page.locator(selecteur).allTextContents()).map(net)
  // Le texte même d'abord : « Paris » ne doit pas toucher « Paris 8 ».
  const exact = textes.indexOf(net(texte))
  const i = exact >= 0 ? exact : textes.findIndex(x => x.includes(net(texte)))
  if (i < 0) throw new Error(`« ${texte} » introuvable parmi ${selecteur} (${textes.join(' | ')})`)
  return page.locator(selecteur).nth(i)
}

/** Le dialogue de « Quitter ? » : « Continuer » (`continuer`) ou « Quitter la partie ». L'écho du doigt passé, il prend le toucher. */
async function repondreAuDialogue(page: any, continuer: boolean) {
  await page.waitForSelector('.dialog')
  await toucher(page, page.locator(continuer ? '.dialog .dialog-actions .btn-ghost' : '.dialog button[type="submit"]'), 900)
  await page.waitForSelector('.dialog', { state: 'detached' })
}

/** La révélation d'une manche : son titre arrivé, la gerbe et la niche passées. */
async function laRevelation(page: any, nom: string) {
  await page.waitForSelector('.cab-titre-revele')
  await photo(page, `${nom}-revelation`, { attente: 1300 })
  await photo(page, `${nom}-revelation-entiere`, { pleine: true })
}

// ── Ce qu'une manche laisse voir entre la tête et le pied collés ──────────

/** Ce que les mesures d'une manche ont trouvé, dit une fois chacun : à la fin, et dans le rapport. */
const bandes: string[] = []
/** Ce qu'elles ont mesuré sans rien y redire — la largeur où la carte de l'Épingle s'est bornée —, pour le rapport. */
const mesures: string[] = []
const noterLaBande = (ligne: string) => {
  if (bandes.includes(ligne)) return
  bandes.push(ligne)
  console.error(ligne)
}

/**
 * La bande d'une manche, à l'écran : du bas de la tête collée au haut du pied collé, sinon au bas de la fenêtre — ce qui la borne,
 * pris de la page même (`bande.ts`) : le rendu en avait sa copie.
 */
const LA_BANDE = `const tete = document.querySelector(${JSON.stringify(TETE_COLLEE)}).getBoundingClientRect().bottom
  const pied = document.querySelector(${JSON.stringify(PIED_COLLE)})
  const bas = pied ? pied.getBoundingClientRect().top : innerHeight`

/** Le texte du total de la tête, et « Quitter » ; s'il est passé à la ligne, et s'il s'est assis au bout du chrono. */
const LA_TETE = `(() => {
  const total = document.querySelector('.cab-total'), quitter = document.querySelector('.cab-quitter')
  if (!total || !quitter) return null
  const plage = document.createRange()
  plage.selectNodeContents(total)
  const t = plage.getBoundingClientRect(), q = quitter.getBoundingClientRect()
  return { droite: t.right, gauche: q.left, memeLigne: t.bottom > q.top + 0.5 && q.bottom > t.top + 0.5, assis: getComputedStyle(quitter).position === 'absolute', hauteur: document.querySelector(${JSON.stringify(TETE_COLLEE)}).getBoundingClientRect().height }
})()`

/**
 * La tête d'une manche, avec et sans la niche d'un compagnon (la classe que la page pose quand le profil en a un) : au texte
 * agrandi, « 0 / 9 ★ » passait de 34 à 60 pixels sous « Quitter » (la tablée du 25 octobre 2026). Le texte du total s'arrête
 * avant « Quitter » sur leur ligne ; quand la place manque même au bouton sans son mot — 277 pixels de large, la niche posée —,
 * « Quitter » s'assied au bout de la ligne du chrono : le rapport le dit, avec la hauteur de la tête. Passé à la ligne
 * autrement, c'est un défaut (`[tête]`) : sous le Sommet, l'Horloge, le Ciel, le Film noir et le Carnet, son mot faisait
 * passer la rangée à la ligne, la tête haute de 131 pixels au lieu de 100, et le rapport ne le disait qu'en passant (le rendu
 * du 26 octobre 2026).
 */
async function laTete(page: any, nom: string) {
  const avec: boolean = await page.evaluate(`document.body.classList.contains('avec-niche')`)
  for (const niche of [avec, !avec]) {
    await page.evaluate(`document.body.classList.toggle('avec-niche', ${niche})`)
    await page.waitForTimeout(150)
    const m: { droite: number; gauche: number; memeLigne: boolean; assis: boolean; hauteur: number } | null = await page.evaluate(LA_TETE)
    const ou = `${nom}${niche ? ', la niche posée' : ''}`
    if (!m) noterLaBande(`[tête] ${nom} : ni total ni « Quitter »`)
    else if (m.memeLigne && m.droite > m.gauche + 0.5) noterLaBande(`[tête] ${ou} : le texte du total passe de ${Math.round(m.droite - m.gauche)} px sous « Quitter »`)
    else if (!m.memeLigne && !m.assis) noterLaBande(`[tête] ${ou} : « Quitter » passe à la ligne, la tête haute de ${Math.round(m.hauteur)} px`)
    else if (!m.memeLigne) mesures.push(`la tête ${ou.replace(/^la tête /, '')} : « Quitter » s’assied au bout du chrono, la tête haute de ${Math.round(m.hauteur)} px`)
  }
  await page.evaluate(`document.body.classList.toggle('avec-niche', ${avec})`)
}

/** La ligne à taper du Mot, entière entre la tête et le clavier collés — une image et son défilement doux passés. */
async function laLigneDuMot(page: any, quand: string) {
  await page.waitForTimeout(900)
  const m: { haut: number; bas: number; tete: number; pied: number } | null = await page.evaluate(`(() => {
  const ligne = document.querySelector('.cab-mot-en-cours')
  if (!ligne) return null
  ${LA_BANDE}
  const b = ligne.getBoundingClientRect()
  return { haut: b.top, bas: b.bottom, tete, pied: bas }
})()`)
  if (!m) noterLaBande(`[mot] ${quand} : pas de ligne à taper`)
  else if (m.haut < m.tete - 0.5 || m.bas > m.pied + 0.5) {
    noterLaBande(`[mot] ${quand} : la ligne à taper (${Math.round(m.haut)} → ${Math.round(m.bas)}) sort de la bande (${Math.round(m.tete)} → ${Math.round(m.pied)})`)
  }
}

/**
 * La question de l'Épingle et sa carte entière ensemble entre la tête et le pied, à un défilement au moins : la page en haut, ou
 * la carte amenée sur le pied — la question se colle alors sous la tête. Au texte agrandi, elles demandaient 381 pixels pour une
 * bande de 277 (la tablée du 25 octobre 2026). La largeur de la carte, bornée à ce qui reste, va au rapport ; elle est rendue, pour
 * qu'on la compare d'un moment de la manche à l'autre (`laMemeTaille`).
 */
async function laQuestionEtLaCarte(page: any, quand: string): Promise<number | null> {
  const mesurer = (): Promise<{ tete: number; bas: number; q: [number, number]; c: [number, number, number] } | null> =>
    page.evaluate(`(() => {
  const q = document.querySelector('.cab-manche > .cab-question'), c = document.querySelector('.cab-manche .cab-carte-jouable')
  if (!q || !c) return null
  ${LA_BANDE}
  const bq = q.getBoundingClientRect(), bc = c.getBoundingClientRect()
  return { tete, bas, q: [bq.top, bq.bottom], c: [bc.top, bc.bottom, bc.width] }
})()`)
  let derniere = null
  for (const defilement of ['window.scrollTo(0, 0)', LA_CARTE_SUR_LE_PIED]) {
    await page.evaluate(defilement)
    await page.waitForTimeout(250)
    const m = (derniere = await mesurer())
    if (m && m.q[0] >= m.tete - 0.5 && m.q[1] <= m.c[0] + 0.5 && m.c[1] <= m.bas + 0.5) {
      mesures.push(`l’Épingle ${quand} : la question et la carte ensemble — la carte de ${Math.round(m.c[2])} px de large`)
      return m.c[2]
    }
  }
  const m = derniere
  noterLaBande(
    m
      ? `[épingle] ${quand} : la question (${Math.round(m.q[0])} → ${Math.round(m.q[1])}) et la carte (${Math.round(m.c[0])} → ${Math.round(m.c[1])}, ${Math.round(m.c[2])} px de large) ne tiennent pas ensemble dans la bande (${Math.round(m.tete)} → ${Math.round(m.bas)})`
      : `[épingle] ${quand} : ni question ni carte`,
  )
  return m ? m.c[2] : null
}

/**
 * La même taille d'un moment de la manche à l'autre — la carte de l'Épingle avant et après Éclairer ; le tableau du Détail avant et
 * après Éclairer, et un pas en arrière : la bande suivait le pied, et la carte-bonus partie, la carte passait de 188 à 241 pixels de
 * large, le tableau regrandissait de onze, ses titres avec lui, sous le doigt (la relecture du lot page-1). Mesurée à l'ouverture de
 * la manche, elle ne regrandit plus. « Pas à pas » ouvert (`resserrable`), le pied grandit d'une rangée : la carte n'y regrandit
 * jamais, et ne se resserre que si la place lui manque — sans carte-bonus au pied à l'ouverture —, pour tenir avec la question ;
 * le rapport le dit.
 */
function laMemeTaille(quoi: string, avant: number | null, apres: number | null, quand: string, resserrable = false) {
  if (avant === null || apres === null) return
  const nom = quoi === 'épingle' ? 'la carte de l’Épingle' : 'le tableau du Détail'
  if (Math.abs(apres - avant) <= 0.5) mesures.push(`${nom} ${quand} : ${Math.round(apres)} px, comme à l’ouverture`)
  else if (resserrable && apres < avant) mesures.push(`${nom} ${quand} : resserrée de ${Math.round(avant)} à ${Math.round(apres)} px, le pied grandi`)
  else noterLaBande(`[${quoi}] ${quand} : ${Math.round(avant)} px à l’ouverture, ${Math.round(apres)} px ensuite`)
}

/** La hauteur du cadre du tableau du Détail, à l'écran. */
const hauteurDuCadre = async (page: any): Promise<number | null> =>
  page.evaluate(`(() => { const c = document.querySelector('.cab-detail-cadre'); return c ? c.getBoundingClientRect().height : null })()`)
/** La carte de l'Épingle amenée sur le pied collé, son bas juste au-dessus de lui. */
const LA_CARTE_SUR_LE_PIED = `(() => {
  const c = document.querySelector('.cab-manche .cab-carte-jouable').getBoundingClientRect()
  ${LA_BANDE}
  window.scrollBy(0, c.bottom - bas + 1)
})()`

/**
 * Chaque titre du Détail amené juste au-dessus du bas de l'écran — du pied collé, s'il y en a un — laisse le tableau entier sous
 * la tête, au-dessus de lui : en 360 × 640, le tableau et ses quatre titres ne tenaient pas ensemble (688 px pour 540), et Jeanne
 * faisait des allers-retours pendant cinquante-cinq secondes (la tablée du 25 octobre 2026).
 */
async function leTableauEtSesTitres(page: any, quand: string) {
  const n: number = await page.locator('.cab-titres .cab-titre').count()
  for (let i = 0; i < n; i++) {
    await page.evaluate(`(() => {
  const t = document.querySelectorAll('.cab-titres .cab-titre')[${i}].getBoundingClientRect()
  ${LA_BANDE}
  window.scrollBy(0, t.bottom - bas + 4)
})()`)
    await page.waitForTimeout(250)
    const m: { tete: number; cadre: [number, number]; titre: number } = await page.evaluate(`(() => {
  ${LA_BANDE}
  const c = document.querySelector('.cab-detail-cadre').getBoundingClientRect()
  const t = document.querySelectorAll('.cab-titres .cab-titre')[${i}].getBoundingClientRect()
  return { tete, cadre: [c.top, c.bottom], titre: t.top }
})()`)
    if (m.cadre[0] < m.tete - 0.5 || m.cadre[1] > m.titre + 0.5) {
      noterLaBande(`[détail] ${quand}, le titre ${i + 1} au bas de l’écran : le tableau (${Math.round(m.cadre[0])} → ${Math.round(m.cadre[1])}) ne tient pas entre la tête (${Math.round(m.tete)}) et lui (${Math.round(m.titre)})`)
    }
  }
  await page.evaluate('window.scrollTo(0, 0)')
  await page.waitForTimeout(250)
}

// ── Les neuf jeux, au doigt ───────────────────────────────────────────────

/** Une manche du Pari, juste, puis pariée et juste : ★★★. */
async function unPari(page: any, t: PariTire, nom: string | null) {
  await page.waitForSelector('.ans-btn')
  if (nom) await photo(page, `${nom}-manche`)
  await toucher(page, await boutonQuiDit(page, '.ans-btn', t.q1.reponses[t.q1.bonne]))
  await page.waitForSelector('.cab-choix-du-pari')
  if (nom) await photo(page, `${nom}-au-choix`)
  await toucher(page, page.locator('.cab-choix-du-pari .btn-primary'))
  await page.locator('.cab-tete-question .cab-surtitre', { hasText: 'pari' }).waitFor()
  if (nom) await photo(page, `${nom}-question-du-pari`)
  await toucher(page, await boutonQuiDit(page, '.ans-btn', t.q2.reponses[t.q2.bonne]))
  await page.waitForSelector('.cab-titre-revele')
}

/** Une manche de l'Éclair : les cinq affirmations, chacune juste. */
async function unEclair(page: any, t: EclairTire, nom: string) {
  await page.waitForSelector('.cab-vrai')
  await photo(page, `${nom}-manche`)
  const vraies = t.affirmations.map(a => a.proposee === a.question.bonne)
  for (const [i, vraie] of vraies.entries()) {
    await toucher(page, page.locator(vraie ? '.cab-vrai' : '.cab-faux'))
    if (i === 1) await photo(page, `${nom}-en-route`)
  }
}

/** Une manche du Détail : Éclairer efface un titre, un pas en arrière, puis le bon titre. Le tableau garde sa hauteur tout du long. */
async function unDetail(page: any, t: DetailTire, nom: string) {
  await page.waitForSelector('.cab-detail-cadre img')
  await photo(page, `${nom}-manche`)
  const ouverture = await hauteurDuCadre(page)
  await leTableauEtSesTitres(page, 'le Détail, sa carte-bonus au pied')
  if (await page.locator('.cab-pouvoir:not([aria-disabled])').count()) {
    await toucher(page, page.locator('.cab-pouvoir'))
    await page.waitForSelector('.cab-titre.cab-effacee')
    await photo(page, `${nom}-eclaire`)
    laMemeTaille('détail', ouverture, await hauteurDuCadre(page), 'éclairé, sa carte-bonus posée')
    await leTableauEtSesTitres(page, 'le Détail éclairé')
  }
  await toucher(page, page.locator('.cab-reculer'))
  await page.waitForSelector('.cab-detail-pas .cab-detail-vu:nth-child(2)')
  await photo(page, `${nom}-un-pas-en-arriere`, { attente: 900 })
  laMemeTaille('détail', ouverture, await hauteurDuCadre(page), 'un pas en arrière')
  await toucher(page, await boutonQuiDit(page, '.ans-btn.cab-titre', t.titres[t.bonne].titre))
}

/** Une manche de la Frise : chaque nouveau venu touché dans la réserve, puis posé en bas — du plus ancien au plus récent. */
async function uneFrise(page: any, t: FriseTiree, nom: string) {
  await page.waitForSelector('.cab-a-poser')
  await photo(page, `${nom}-manche`)
  const rangs = [...t.vagues[t.vague]].sort((a, b) => a - b)
  for (const [i, r] of rangs.entries()) {
    await toucher(page, await boutonQuiDit(page, '.cab-a-poser', t.evenements[r].libelle))
    if (i === 1) await photo(page, `${nom}-poser-ici`)
    await toucher(page, page.locator('.cab-poser-ici').last())
  }
  await photo(page, `${nom}-posee`)
  await toucher(page, page.locator('.cab-valider'))
}

/**
 * Un mot au clavier du Mot. Les lettres n'attendent la demi-seconde de garde qu'à un écran neuf (`gardeDeLEcran`) — la pause
 * refermée en fait un : la première l'attend, les autres suivent au pas d'un doigt rapide. Sans elle, les deux premières
 * lettres se perdaient, et « Valider », la ligne incomplète, restait en sourdine.
 */
async function taper(page: any, lettres: string) {
  // Une touche marquée par un essai dit sa couleur à l'oreille, après sa lettre (« A, bien placée »).
  for (const [i, l] of [...lettres].entries()) await toucher(page, page.locator('.cab-touche', { hasText: new RegExp(`^${l}(?:,|$)`) }), i === 0 ? 650 : 120)
}

/**
 * Une manche du Mot mystère : « Quitter ? » et sa pause, deux essais faux et leurs couleurs, puis le mot. La ligne à taper se
 * mesure à l'ouverture, à la reprise de la pause et après chaque essai.
 */
async function unMot(page: any, t: MotTire, nom: string) {
  await page.waitForSelector('.cab-clavier')
  await laLigneDuMot(page, 'le Mot, à l’ouverture')
  await photo(page, `${nom}-manche`)
  // La pause de « Quitter ? » : la manche voilée, le chrono figé, la confirmation par-dessus.
  await toucher(page, page.locator('.cab-quitter'))
  await page.waitForSelector('.cab-voile')
  await page.waitForSelector('.dialog')
  await photo(page, `${nom}-pause`)
  await repondreAuDialogue(page, true)
  await page.waitForSelector('.cab-voile', { state: 'detached' })
  await laLigneDuMot(page, 'le Mot, à la reprise de la pause')
  // Le mot à l'envers — ses lettres, pas à leur place : les trois couleurs d'un coup ; puis tourné d'une lettre.
  const envers = [...t.lettres].reverse().join('')
  const tourne = `${t.lettres.slice(1)}${t.lettres[0]}`
  for (const [k, faux] of [envers === t.lettres ? tourne : envers, tourne === t.lettres ? envers : tourne].entries()) {
    await taper(page, faux)
    await toucher(page, page.locator('.cab-valider-le-mot'))
    await page.waitForFunction((n: number) => (globalThis as any).document.querySelectorAll('.cab-mot-joue').length >= n, k + 1)
    await laLigneDuMot(page, `le Mot, après ${k === 0 ? 'un essai' : 'deux essais'}`)
    if (k === 0) await photo(page, `${nom}-un-essai`)
  }
  await taper(page, t.lettres)
  await toucher(page, page.locator('.cab-valider-le-mot'))
}

/** Une manche du Filet : Éclairer et sa zone, le curseur sur la valeur, le petit filet, et le lancer. */
async function unFilet(page: any, t: FiletTire, nom: string) {
  await page.waitForSelector('.cab-curseur')
  await photo(page, `${nom}-manche`)
  if (await page.locator('.cab-pouvoir:not([aria-disabled])').count()) {
    await toucher(page, page.locator('.cab-pouvoir'))
    await page.waitForSelector('.cab-filet-zone')
    await photo(page, `${nom}-eclaire`)
  }
  // Sans glisser : un grand pas de plus, un dixième de la piste, sous ses deux boutons amenés à l'écran.
  const avant = await page.locator('.cab-curseur').inputValue()
  await toucher(page, page.locator('.cab-grand-pas[aria-label="Un grand pas de plus"]'))
  await page.waitForFunction((v: string) => ((globalThis as any).document.querySelector('.cab-curseur') as any)?.value !== v, avant)
  await photo(page, `${nom}-un-grand-pas`)
  // Le curseur posé comme le doigt le pose, par l'évènement que React écoute ; la piste le range à son cran.
  await page.evaluate(
    `(() => { const i = document.querySelector('.cab-curseur'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(String(t.valeur))}); i.dispatchEvent(new Event('input', { bubbles: true })) })()`,
  )
  await toucher(page, page.locator('.cab-taille').first())
  await photo(page, `${nom}-vise`)
  await toucher(page, page.locator('.cab-lancer'))
}

/** Une manche de l'Épingle : Éclairer et sa zone, l'épingle posée au doigt sur le lieu, puis plantée. */
async function uneEpingle(page: any, t: EpingleTiree, nom: string) {
  await page.waitForSelector('.cab-carte-dessin')
  await photo(page, `${nom}-manche`)
  const ouverture = await laQuestionEtLaCarte(page, 'à l’ouverture, sa carte-bonus au pied')
  await page.evaluate('window.scrollTo(0, 0)')
  if (await page.locator('.cab-pouvoir:not([aria-disabled])').count()) {
    await toucher(page, page.locator('.cab-pouvoir'))
    await page.waitForSelector('.cab-souffle')
    await photo(page, `${nom}-eclaire`)
    laMemeTaille('épingle', ouverture, await laQuestionEtLaCarte(page, 'éclairée, sa carte-bonus posée'), 'éclairée, sa carte-bonus posée')
    await photo(page, `${nom}-la-question-et-la-carte`)
    await page.evaluate('window.scrollTo(0, 0)')
  }
  // Sans clavier : « Pas à pas » ouvre les pas au-dessus de lui, un pas vers le nord pose l'épingle — dite au-dessus de la carte —,
  // et la question et la carte tiennent encore ensemble, les pas ouverts ; refermés, la carte reprend sa place.
  await toucher(page, page.locator('.cab-pas-a-pas'))
  await page.waitForSelector('.cab-pas-de-l-epingle')
  await toucher(page, page.locator('.cab-pas[aria-label="Vers le nord"]'))
  await page.waitForFunction(() => ((globalThis as any).document.querySelector('.cab-ou-est')?.textContent ?? '').trim() !== '')
  await photo(page, `${nom}-pas-a-pas`)
  laMemeTaille('épingle', ouverture, await laQuestionEtLaCarte(page, 'les pas ouverts'), 'les pas ouverts', true)
  await toucher(page, page.locator('.cab-pas-a-pas'))
  await page.waitForSelector('.cab-pas-de-l-epingle', { state: 'detached' })
  await page.evaluate('window.scrollTo(0, 0)')
  const carte = page.locator('.cab-carte-dessin').first()
  // Le dessin garde ses proportions dans sa boîte (`xMidYMid meet`) : l'échelle, et la marge de chaque côté.
  const { x, y } = projeter({ lat: t.lieu.lat, lon: t.lieu.lon })
  const ouToucher = async () => {
    const boite = await carte.boundingBox()
    const echelle = Math.min(boite.width / LARGEUR_DE_LA_CARTE, boite.height / HAUTEUR_DE_LA_CARTE)
    return { x: boite.x + (boite.width - LARGEUR_DE_LA_CARTE * echelle) / 2 + x * echelle, y: boite.y + (boite.height - HAUTEUR_DE_LA_CARTE * echelle) / 2 + y * echelle }
  }
  // Le lieu amené entre la tête et le pied collés, comme le doigt fait défiler la page : posée au bord de l'écran par
  // `scrollIntoViewIfNeeded`, la carte avait son sud-ouest sous « Planter ici », et le toucher tombait sur le bouton.
  await carte.scrollIntoViewIfNeeded()
  const avant = await ouToucher()
  // Les sélecteurs de la bande, passés à la fonction : elle s'évalue dans la page, sans les imports d'ici.
  await page.evaluate(
    ({ cible, tete, pied }: { cible: number; tete: string; pied: string }) => {
      const g = globalThis as any
      const haut = g.document.querySelector(tete)?.getBoundingClientRect().bottom ?? 0
      const bas = g.document.querySelector(pied)?.getBoundingClientRect().top ?? g.innerHeight
      g.scrollBy(0, cible - (haut + bas) / 2)
    },
    { cible: avant.y, tete: TETE_COLLEE, pied: PIED_COLLE },
  )
  await page.waitForTimeout(650)
  const point = await ouToucher()
  // L'épingle du pas vers le nord est déjà posée : le toucher doit la déplacer, sur le dessin même. Un toucher tombé à côté de la
  // carte — sur la question collée, sur le pied — laissait le texte de la ligne inchangé, l'attente avalait son échec, et « Planter
  // ici » plantait l'épingle du pas (la relecture du lot page-1) : l'étape échoue, désormais.
  const OU_EST_L_EPINGLE = '.cab-manche .cab-carte-jouable .cab-carte-epingle'
  const posee = await page.evaluate((s: string) => (globalThis as any).document.querySelector(s)?.getAttribute('transform') ?? '', OU_EST_L_EPINGLE)
  await page.touchscreen.tap(point.x, point.y)
  // Une fonction, jamais un texte : la politique de sécurité de la page refuse `eval` (skill `regarder-le-rendu`).
  await page.waitForFunction(
    ({ s, avant }: { s: string; avant: string }) => {
      const t = (globalThis as any).document.querySelector(s)?.getAttribute('transform') ?? ''
      return t !== '' && t !== avant
    },
    { s: OU_EST_L_EPINGLE, avant: posee },
    { timeout: 5000 },
  )
  await photo(page, `${nom}-posee`)
  await toucher(page, page.locator('.cab-planter'))
}

/** Une manche des Indices : un indice de plus, un nom refusé, puis le bon. */
async function desIndices(page: any, t: IndicesTires, nom: string) {
  await page.waitForSelector('.cab-nom input')
  await photo(page, `${nom}-manche`)
  const vus = await page.locator('.cab-indices li').count()
  await toucher(page, page.locator('.cab-gestes-du-nom .btn:not(.btn-primary)'))
  await page.waitForFunction((avant: number) => (globalThis as any).document.querySelectorAll('.cab-indices li').length > avant, vus)
  await photo(page, `${nom}-un-indice-de-plus`)
  const nomTape = async (texte: string) => {
    await toucher(page, page.locator('.cab-nom input'))
    await page.keyboard.type(texte)
    await toucher(page, page.locator('.cab-gestes-du-nom .btn-primary'))
  }
  await nomTape('Personne Inconnue')
  await page.waitForFunction(() => ((globalThis as any).document.querySelector('.cab-non')?.textContent ?? '').trim() !== '')
  await photo(page, `${nom}-un-nom-refuse`)
  await nomTape(t.fiche.reponse)
}

/** Une manche de la Réplique, juste : le mot, puis qui l'a dite — ou, `auTemps`, le mot laissé à son échéance. */
async function uneReplique(page: any, t: RepliqueTiree, nom: string, auTemps = false) {
  await page.waitForSelector('.cab-replique')
  await photo(page, `${nom}-manche`)
  if (auTemps) {
    // Le chrono du mot court jusqu'au bout : la page envoie d'elle-même ce qu'elle a, et « Qui l'a dit ? » s'ouvre, le mot perdu.
    await page.waitForSelector('.cab-temps-du-mot', { timeout: 60_000 })
    await photo(page, `${nom}-temps-du-mot`)
  } else {
    await toucher(page, await boutonQuiDit(page, '.ans-btn', t.mots[t.bonMot]))
    await page.waitForSelector('.cab-trou-rempli')
    await photo(page, `${nom}-qui-l-a-dit`)
  }
  await toucher(page, await boutonQuiDit(page, '.ans-btn', t.personnes[t.bonneQui]))
}

/** Chaque jeu à sa manche, lue dans le plan en base. */
async function jouerLaManche(page: any, jeu: CleDeJeu, id: string, k: number, nom: string, auTemps = false) {
  switch (jeu) {
    case 'pari':
      return unPari(page, tirageEnCours<PariTire>(id, k), nom)
    case 'eclair':
      return unEclair(page, tirageEnCours<EclairTire>(id, k), nom)
    case 'detail':
      return unDetail(page, tirageEnCours<DetailTire>(id, k), nom)
    case 'frise':
      return uneFrise(page, tirageEnCours<FriseTiree>(id, k), nom)
    case 'mot':
      return unMot(page, tirageEnCours<MotTire>(id, k), nom)
    case 'filet':
      return unFilet(page, tirageEnCours<FiletTire>(id, k), nom)
    case 'epingle':
      return uneEpingle(page, tirageEnCours<EpingleTiree>(id, k), nom)
    case 'indices':
      return desIndices(page, tirageEnCours<IndicesTires>(id, k), nom)
    case 'replique':
      return uneReplique(page, tirageEnCours<RepliqueTiree>(id, k), nom, auTemps)
  }
}

/**
 * La fiche de la niche, touchée en pleine manche : la bulle sort sous la niche, son bord droit au sien, sa pointe sous son
 * milieu. En 1366 × 768, la niche suit la colonne élargie de la question, et sa fiche restait au coin d'avant, cent pixels plus
 * loin (la relecture du lot). Le doigt sur la niche touche le voile, qui la referme ; la manche court pendant ce temps.
 */
async function laFicheDeLaNiche(page: any) {
  if (!(await page.locator('.niche').count())) return
  await toucher(page, page.locator('.niche'))
  await page.waitForSelector('.niche-fiche')
  await photo(page, 'la-fiche-de-la-niche-en-pleine-manche', { attente: 700 })
  const niche = await page.locator('.niche').boundingBox()
  const fiche = await page.locator('.niche-fiche').boundingBox()
  const ecart = Math.round(niche.x + niche.width - (fiche.x + fiche.width))
  if (Math.abs(ecart) > 2) rapport.push(`la fiche de la niche : [fiche] son bord droit à ${ecart} px de celui de la niche, sa pointe sous rien`)
  await page.touchscreen.tap(niche.x + niche.width / 2, niche.y + niche.height / 2)
  await page.waitForSelector('.niche-fiche', { state: 'detached' })
}

/** « Commencer » à l'annonce, et la première manche ouverte. */
async function commencer(page: any) {
  await toucher(page, page.locator('.cab-annonce .btn-primary.btn-big'))
  await page.waitForSelector('.cab-tete-partie')
}

/**
 * « Revenir au musée », au bas du bilan. Le bouton agit au lever du doigt (`toucher`) : le musée paraît avant le `click` qui
 * suit, et cet écho tombait sur ce qui était venu sous le doigt — la tuile « Le prochain gardien », un lien, qui n'ignore pas
 * l'écho comme un bouton : Léa arrivait dans la salle de l'Érudit, ou à la visite du jour (le rendu du 25 octobre 2026). La page
 * l'arrête désormais à la capture (`arreterLEcho`, `CabinetApp.tsx`) ; s'il revenait, le rendu le dirait, le photographierait
 * la première fois, et rouvrirait le musée pour continuer.
 */
async function revenirAuMusee(page: any) {
  await toucher(page, page.locator('.fin-actions .btn-primary'))
  // Le bilan parti, l'écho a déjà eu lieu : il suit le lever du doigt sans attendre. Où il mène dépend de ce qui est venu sous
  // le doigt — la tuile du prochain gardien, la visite du jour.
  await page.waitForSelector('.cab-bilan', { state: 'detached' })
  await page.waitForSelector('.cab-page h1')
  await page.waitForTimeout(300)
  if (await page.locator('.cab-portes').count()) return
  const ou = net((await page.locator('h1').first().textContent()) ?? '?')
  const ligne = `[écho] « Revenir au musée » au doigt ouvre « ${ou} » : l'écho du doigt tombe sur la tuile du musée venue sous lui`
  if (!echos.includes(ligne)) {
    echos.push(ligne)
    console.error(ligne)
    await photo(page, 'echo-du-retour-au-musee')
  }
  await ouvrir(page, '', '.cab-portes')
}

/** La partie quittée, de la tête : sa confirmation, son bilan, et le retour au musée. */
async function quitter(page: any, nom: string | null) {
  await toucher(page, page.locator('.cab-quitter'))
  await repondreAuDialogue(page, false)
  await page.waitForSelector('.cab-bilan')
  if (nom) await photo(page, nom, { attente: 900 })
  await revenirAuMusee(page)
}

/** Une partie restée en plan par une étape en échec : reprise du musée et quittée, pour que la suivante parte. */
async function sansPartieEnCours(page: any) {
  await ouvrir(page, '', '.cab-portes')
  const reprendre = page.locator('.gros-bouton', { hasText: 't’attend' })
  if (!(await reprendre.count())) return
  await toucher(page, reprendre)
  await page.waitForSelector('.cab-tete-partie, .cab-annonce')
  if (await page.locator('.cab-annonce').count()) await commencer(page)
  await quitter(page, null)
}

// ── Le parcours ───────────────────────────────────────────────────────────

try {
  const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐨')
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const idDeLea = await idDe(lea)
  ecrireLeMuseeDeLea(idDeLea)
  if (theme) porterLeTheme([await idDe(zoe), idDeLea])
  // Les profils relus : le compagnon de Léa et leur thème sont en mémoire du serveur.
  await banc.redemarrer()

  // La page sans profil : la phrase du serveur, et comment entrer.
  await etape('sans profil', async () => {
    const { ctx, page } = await telephoneDe(null)
    await ouvrir(page, '', '.cab-page .btn-primary')
    await photo(page, 'sans-profil')
    await ctx.close()
  })

  // Zoé arrive : ses quatre œuvres offertes, la bienvenue, les règles.
  await etape('Zoé', async () => {
    const { ctx, page } = await telephoneDe(zoe)
    await ouvrir(page, '', '.cab-portes')
    await photo(page, 'zoe-musee')
    await photo(page, 'zoe-musee-entier', { pleine: true })
    await toucher(page, page.locator('.cab-bandeau .btn-primary'))
    await photoDeLaFeuille(page, 'zoe-regles')
    // Les neuf jeux, repliés sous l'essentiel : dépliés au doigt.
    await toucher(page, page.locator('.cab-regles-replie > summary'))
    await photoDeLaFeuille(page, 'zoe-regles-les-neuf-jeux')
    await toucher(page, page.locator('.carte-fermer'))
    await ouvrir(page, '#salle-vestibule', '.cab-mur')
    await photo(page, 'zoe-salle-du-vestibule')
    await photo(page, 'zoe-salle-du-vestibule-entiere', { pleine: true })
    const vide = oeuvresDeLaSalle('vestibule').find(o => !OEUVRES_DE_DEPART.includes(o.cle as CleDOeuvre))!.cle
    await ouvrir(page, `#oeuvre-${vide}`, '.cab-cadre-grand')
    await photo(page, 'zoe-cadre-vide')
    await ouvrir(page, '#libre', '.cab-jeux')
    await photo(page, 'zoe-jouer-librement', { pleine: true })
    await ouvrir(page, '#gardiens', '.cab-gardiens')
    await photo(page, 'zoe-gardiens')
    await ctx.close()
  })

  // Léa a joué : les règles lues, son loup dans sa niche.
  const { ctx, page } = await telephoneDe(lea, `try { localStorage.setItem('quizz.cabinet.regles-lues.${idDeLea}', '1') } catch {}`)
  await etape('le musée de Léa', async () => {
    await ouvrir(page, '', '.cab-portes')
    await photo(page, 'lea-musee')
    await photo(page, 'lea-musee-entier', { pleine: true })
    await ouvrir(page, '#salle-rempart', '.cab-mur')
    await photo(page, 'lea-salle-complete')
    await photo(page, 'lea-salle-complete-entiere', { pleine: true })
    const doree = oeuvresDeLaSalle('rempart')[0].cle
    await ouvrir(page, `#oeuvre-${doree}`, '.cab-oeuvre-levee')
    await page.waitForSelector('.cab-cartel')
    await photo(page, 'lea-oeuvre-et-son-cartel')
    await photo(page, 'lea-oeuvre-et-son-cartel-entiere', { pleine: true })
    await ouvrir(page, '#salle-erudit', '.cab-mur')
    await photo(page, 'lea-salle-a-une-oeuvre-pres', { pleine: true })
    await ouvrir(page, `#oeuvre-${LA_LECON}`, '.cab-cadre-grand')
    await photo(page, 'lea-cadre-vide')
    await ouvrir(page, '#gardiens', '.cab-gardiens')
    await photo(page, 'lea-gardiens')
    await photo(page, 'lea-gardiens-entiers', { pleine: true })
    await toucher(page, page.locator('.cab-gardien', { hasText: 'Phénix' }))
    await page.waitForSelector('.cab-fiche-gardien')
    await photo(page, 'lea-fiche-du-phenix')
    await toucher(page, page.locator('.carte-fermer'))
    await toucher(page, page.locator('.cab-gardien').nth(2))
    await page.waitForSelector('.cab-fiche-gardien')
    await photo(page, 'lea-fiche-d-un-gardien-endormi')
    await toucher(page, page.locator('.carte-fermer'))
    await ouvrir(page, '#visite', '.cab-cases')
    await photo(page, 'lea-visite-du-jour')
    await photo(page, 'lea-visite-du-jour-entiere', { pleine: true })
  })

  // Les neuf jeux en partie libre : l'annonce et sa carte-bonus d'abord — Coup d'œil, qui éclaire —, puis une manche de chacun.
  const ordre = (['pari', 'eclair', 'detail', 'frise', 'mot', 'filet', 'epingle', 'indices', 'replique'] as CleDeJeu[]).filter(j => !jeuxDemandes || jeuxDemandes.includes(j))
  for (const jeu of ordre) {
    await etape(`le jeu ${jeu}`, async () => {
      await sansPartieEnCours(page)
      await ouvrir(page, '#libre', '.cab-jeux')
      await toucher(page, await boutonQuiDit(page, '.cab-jeu', JEUX[jeu].nom))
      await page.waitForSelector('.cab-annonce')
      // L'annonce du Détail dit qu'il se joue à l'œil.
      if (jeu === 'detail') await photo(page, 'annonce-du-detail')
      if (jeu === 'pari') {
        await photo(page, 'annonce')
        await toucher(page, page.locator('.cab-annonce .cab-bloc .btn-block'))
        await page.waitForSelector('.cab-choix-carte')
        await photoDeLaFeuille(page, 'annonce-choix-de-la-carte-bonus')
        await toucher(page, await boutonQuiDit(page, '.cab-choix-carte', oeuvreDe('coup-d-oeil')!.nom))
        await page.waitForSelector('.carte-feuille', { state: 'detached' })
        await photo(page, 'annonce-avec-sa-carte-bonus')
      }
      await commencer(page)
      await page.waitForTimeout(300)
      await laTete(page, `la tête ${JEUX[jeu].a}`)
      if (jeu === 'pari') await laFicheDeLaNiche(page)
      await jouerLaManche(page, jeu, idDeLea, 0, jeu)
      await laRevelation(page, jeu)
      if (jeu === 'replique') {
        // La seconde manche, laissée au temps : « Qui l'a dit ? » s'ouvre de lui-même, le mot perdu.
        await toucher(page, page.locator('.cab-pied-partie .btn-primary'))
        await jouerLaManche(page, jeu, idDeLea, 1, `${jeu}-2`, true)
        await laRevelation(page, `${jeu}-2`)
      }
      if (jeu === 'pari') {
        // Entre deux manches, la partie attend au musée : il dit laquelle, et la reprend.
        await toucher(page, page.locator('.cab-partie > .jour-sortie'))
        await page.waitForSelector('.cab-portes')
        await photo(page, 'la-partie-qui-attend')
        await toucher(page, page.locator('.gros-bouton', { hasText: 't’attend' }))
        await page.waitForSelector('.cab-titre-revele')
      }
      await quitter(page, jeu === 'pari' ? 'bilan-d-une-partie-quittee' : null)
    })
  }

  // Le Filet d'une unité longue : sa valeur, ses bornes et ses grands pas tiennent dans la page, puis sa révélation.
  if (ordre.includes('filet')) {
    await etape('le Filet d’une unité longue', async () => {
      await sansPartieEnCours(page)
      await ouvrir(page, '#libre', '.cab-jeux')
      await toucher(page, await boutonQuiDit(page, '.cab-jeu', JEUX.filet.nom))
      await page.waitForSelector('.cab-annonce')
      await commencer(page)
      uneUniteLongue(idDeLea)
      await banc.redemarrer()
      await ouvrir(page, '', '.cab-portes')
      await toucher(page, page.locator('.gros-bouton', { hasText: 't’attend' }))
      await page.waitForSelector('.cab-curseur')
      await photo(page, 'filet-unite-longue')
      await photo(page, 'filet-unite-longue-entiere', { pleine: true })
      await toucher(page, page.locator('.cab-lancer'))
      await laRevelation(page, 'filet-unite-longue')
      await quitter(page, null)
    })
  }

  // Une partie de la visite, rechargée en pleine manche puis laissée entre deux : elle se rouvre d'elle-même, puis se reprend de
  // sa case ; quittée — ce qu'on emporte, dit avant —, elle est manquée, et son œuvre se retente pour une chasse, du bilan comme
  // de la case (la tablée du 25 octobre 2026). La retente ne s'annonce que : la chasse de la Leçon, plus bas, garde la sienne.
  let caseJouee = -1
  await etape('la visite d’une partie qui attend', async () => {
    await sansPartieEnCours(page)
    await ouvrir(page, '#visite', '.cab-cases')
    const cases = page.locator('.cab-case')
    for (let k = 0; k < (await cases.count()) && caseJouee < 0; k++) {
      const c = cases.nth(k)
      if (net(await c.innerText()).includes('Peut te faire gagner') && (await c.locator('.btn-primary', { hasText: 'Jouer' }).count())) caseJouee = k
    }
    if (caseJouee < 0) throw new Error('aucune case de la visite ne fait gagner une œuvre')
    const nom = net(await cases.nth(caseJouee).locator('.cab-case-jeu').innerText())
    const jeu = (Object.keys(JEUX) as CleDeJeu[]).find(j => JEUX[j].nom === nom)
    if (!jeu) throw new Error(`le jeu « ${nom} » de la case`)
    await toucher(page, cases.nth(caseJouee).locator('.btn-primary', { hasText: 'Jouer' }))
    await page.waitForSelector('.cab-annonce')
    await photo(page, 'visite-annonce-son-seuil-et-son-cadre-dore', { pleine: true })
    await commencer(page)
    await photo(page, 'visite-la-tete-et-son-seuil')
    // Rechargée sur l'entrée de la partie : la manche revient, sans détour par la visite qui la disait faite.
    await page.reload()
    await page.waitForSelector('.cab-tete-partie, .cab-cases')
    if (!(await page.locator('.cab-tete-partie').count())) echecs.push('[rendu] rechargée en pleine manche, la partie de la visite ne se rouvre pas')
    await photo(page, 'visite-rechargee-en-pleine-manche')
    await jouerLaManche(page, jeu, idDeLea, 0, `visite-${jeu}`)
    await page.waitForSelector('.cab-titre-revele')
    // Entre deux manches, « ← Le Cabinet » : la visite dit sa case « En cours », et un seul « Reprendre ».
    await toucher(page, page.locator('.cab-partie > .jour-sortie'))
    await page.waitForSelector('.cab-portes')
    await ouvrir(page, '#visite', '.cab-cases')
    await photo(page, 'visite-d-une-partie-qui-attend')
    await photo(page, 'visite-d-une-partie-qui-attend-entiere', { pleine: true })
    await toucher(page, page.locator('.cab-case .cab-reprendre'))
    await page.waitForSelector('.cab-tete-partie')
    // « Quitter ? » dit ce qu'on emporte : les étoiles, la poussière d'or, la case de la visite faite.
    await toucher(page, page.locator('.cab-quitter'))
    await page.waitForSelector('.dialog')
    await photo(page, 'quitter-ce-qu-on-emporte', { attente: 900 })
    await repondreAuDialogue(page, false)
    await page.waitForSelector('.cab-bilan')
    await photo(page, 'bilan-d-une-visite-manquee', { attente: 900 })
    await photo(page, 'bilan-d-une-visite-manquee-entier', { pleine: true })
    const retenter = page.locator('.fin-actions .btn', { hasText: 'Retenter' })
    if (!(await retenter.count())) throw new Error('le bilan d’une visite manquée ne propose pas « Retenter »')
    await toucher(page, retenter)
    await page.waitForSelector('.cab-annonce')
    await photo(page, 'annonce-de-la-retente', { pleine: true })
    await toucher(page, page.locator('.cab-page > .jour-sortie'))
    await page.waitForSelector('.cab-portes')
    await ouvrir(page, '#visite', '.cab-cases')
    await photo(page, 'visite-une-case-manquee-et-son-retenter', { pleine: true })
    // La retente commencée de sa case, puis la visite rouverte à neuf — hors de l'entrée de la partie : la retente attend, et la
    // case manquée met « Retenter » en sourdine sous la raison dite une fois au-dessus des cases, avec son seul « Reprendre » (la
    // relecture du lot page-2). Reprise de là, puis quittée : la chasse de la Leçon garde la seconde chasse du jour.
    await toucher(page, page.locator('.cab-case .btn', { hasText: 'Retenter' }))
    await page.waitForSelector('.cab-annonce')
    await commencer(page)
    await ouvrir(page, '#visite', '.cab-cases')
    const reprises = await page.locator('.cab-reprendre').count()
    if (reprises !== 1) echecs.push(`[rendu] la visite pendant sa retente : ${reprises} « Reprendre »`)
    await photo(page, 'visite-pendant-sa-retente', { pleine: true })
    await toucher(page, page.locator('.cab-reprendre'))
    await page.waitForSelector('.cab-tete-partie')
    await photo(page, 'la-tete-de-la-retente')
    await quitter(page, null)
  })

  // Une case pour dorer : son œuvre écrite au musée de Léa — celle qu'une autre case de la visite figée vise, ni la Leçon ni la
  // commune du Devin, que la suite gagne —, le serveur relu à froid. L'annonce dit le cadre doré et le double de son seuil.
  await etape('l’annonce d’une case pour dorer', async () => {
    const db = new Database(fichier)
    let aDorer = -1
    let saCible: string | null = null
    try {
      const { visites } = db.prepare('SELECT visites FROM cabinet_profils WHERE profile_id = ?').get(idDeLea) as { visites: string }
      // La visite du jour : la plus récente des visites figées, que le départ de la partie d'avant a figée.
      const figees = JSON.parse(visites) as { jour: string; cases: { cible: string | null }[] }[]
      const cases = figees.reduce<(typeof figees)[number] | null>((a, b) => (a && a.jour > b.jour ? a : b), null)?.cases ?? []
      const siennes = new Set((db.prepare('SELECT oeuvre FROM cabinet_oeuvres WHERE profile_id = ?').all(idDeLea) as { oeuvre: string }[]).map(r => r.oeuvre))
      aDorer = cases.findIndex((c, k) => k !== caseJouee && c.cible !== null && oeuvreDe(c.cible) && c.cible !== LA_LECON && c.cible !== communeDuDevin && !siennes.has(c.cible))
      if (aDorer < 0) throw new Error('aucune autre case de la visite ne vise une œuvre à écrire')
      saCible = cases[aDorer].cible
      db.prepare(`INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, doree_le, dorure) VALUES (?, ?, 'partie', ?, NULL, NULL)`).run(idDeLea, saCible, maintenant() - JOUR)
    } finally {
      db.close()
    }
    await banc.redemarrer()
    await ouvrir(page, '#visite', '.cab-cases')
    await photo(page, 'visite-une-case-pour-dorer', { pleine: true })
    await toucher(page, page.locator('.cab-case').nth(aDorer).locator('.btn-primary', { hasText: 'Jouer' }))
    await page.waitForSelector('.cab-annonce')
    await photo(page, 'annonce-d-une-case-pour-dorer', { pleine: true })
    await toucher(page, page.locator('.cab-page > .jour-sortie'))
    await page.waitForSelector('.cab-portes')
    // Son cadre doré dans la journée — la dorure achetée, écrite au musée — : la case ne promet plus que le double, ni l'annonce
    // le cadre, ni la carte-bonus ce qui l'ôterait (la relecture du lot page-2).
    const dorer = new Database(fichier)
    try {
      dorer.prepare(`UPDATE cabinet_oeuvres SET doree_le = ?, dorure = 'poussiere', prix_dorure = 0 WHERE profile_id = ? AND oeuvre = ?`).run(maintenant(), idDeLea, saCible)
    } finally {
      dorer.close()
    }
    await banc.redemarrer()
    await ouvrir(page, '#visite', '.cab-cases')
    await photo(page, 'visite-une-case-deja-doree', { pleine: true })
    await toucher(page, page.locator('.cab-case').nth(aDorer).locator('.btn-primary', { hasText: 'Jouer' }))
    await page.waitForSelector('.cab-annonce')
    await photo(page, 'annonce-d-une-case-deja-doree', { pleine: true })
    await toucher(page, page.locator('.cab-page > .jour-sortie'))
    await page.waitForSelector('.cab-portes')
  })

  // La chasse de la Leçon, au Pari, sans carte-bonus : trois manches parfaites — gagnée sans faute, son cadre doré, et l'Érudit
  // complet réveille la Chouette d'Argent.
  await etape('la chasse de la Leçon', async () => {
    await ouvrir(page, `#oeuvre-${LA_LECON}`, '.cab-cadre-grand')
    await toucher(page, page.locator('.cab-page > .btn-primary.btn-big'))
    await page.waitForSelector('.cab-annonce')
    await toucher(page, page.locator('.cab-annonce .cab-bloc .btn-block'))
    await toucher(page, page.locator('.cab-choix-carte').first())
    await page.waitForSelector('.carte-feuille', { state: 'detached' })
    await photo(page, 'chasse-annonce')
    await commencer(page)
    for (let k = 0; k < 3; k++) {
      if (k > 0) await toucher(page, page.locator('.cab-pied-partie .btn-primary'))
      await unPari(page, tirageEnCours<PariTire>(idDeLea, k), null)
    }
    await photo(page, 'chasse-derniere-revelation', { attente: 1300 })
    await toucher(page, page.locator('.cab-pied-partie .btn-primary'))
    await page.waitForSelector('.cab-bilan')
    await photo(page, 'bilan-gagne-et-dore', { attente: 1500 })
    await photo(page, 'bilan-gagne-et-dore-entier', { pleine: true })
    const gardien = page.locator('.cab-reveil').first()
    if (await gardien.count()) {
      await gardien.scrollIntoViewIfNeeded()
      await photo(page, 'un-gardien-qui-s-eveille', { attente: 900 })
    } else echecs.push('[rendu] la chasse de la Leçon : aucun gardien ne s’éveille au bilan')
    await toucher(page, page.locator('.fin-actions .btn', { hasText: 'Mes réponses' }))
    await photoDeLaFeuille(page, 'mes-reponses')
    await toucher(page, page.locator('.carte-fermer'))
    await revenirAuMusee(page)
    await photo(page, 'lea-musee-apres-la-chasse')
    await ouvrir(page, `#oeuvre-${LA_LECON}`, '.cab-oeuvre-levee')
    await page.waitForSelector('.cab-cartel-sujet, .cab-cartel')
    await photo(page, 'l-oeuvre-gagnee-et-son-cartel', { attente: 900 })
    await photo(page, 'l-oeuvre-gagnee-et-son-cartel-entiere', { pleine: true })
  })

  // L'achat de la dernière œuvre du Devin : sa confirmation, puis le Sphinx qui s'éveille, en grand.
  await etape('l’achat', async () => {
    await ouvrir(page, `#oeuvre-${communeDuDevin}`, '.cab-cadre-grand')
    await toucher(page, page.locator('.cab-page > .btn:not(.btn-primary)', { hasText: 'acheter' }))
    await page.waitForSelector('.dialog')
    await photo(page, 'achat-confirmation')
    await toucher(page, page.locator('.dialog button[type="submit"]'), 900)
    await page.waitForSelector('.cab-reveil')
    await photo(page, 'achat-un-gardien-qui-s-eveille', { attente: 1200 })
    await toucher(page, page.locator('.carte-pied .btn-primary'))
  })

  await etape('ses murs', async () => {
    await ouvrir(page, '#murs', '.cab-murs')
    await page.waitForSelector('.cab-murs .cab-carte-dessin, .cab-murs .cab-frise, .cab-murs .error')
    await photo(page, 'ses-murs', { attente: 900 })
    await photo(page, 'ses-murs-entiers', { pleine: true })
  })

  // Le lendemain : l'horloge avancée d'un jour — une visite neuve, la série à garder.
  await etape('le lendemain', async () => {
    horloge.avance += JOUR
    await ouvrir(page, '', '.cab-portes')
    await photo(page, 'lea-musee-le-lendemain')
  })
  await ctx.close()
} finally {
  await navigateur.close()
  await banc.close()
}

const aRevoir = rapport.filter(l => !l.endsWith('rien à redire'))
const resume = `${rapport.length} photos en ${largeur} × ${hauteur}${zoom !== 100 ? `, le texte à ${zoom} %` : ''}${theme ? `, ${theme}` : ''}${encoche ? `, encoche de ${encoche}` : ''} : ${aRevoir.length} à revoir, ${bandes.length} mesure(s) d’une manche à revoir, ${echos.length} écho(s) du doigt, ${echecs.length} étape(s) en échec.`
writeFileSync(path.join(sortie, 'rapport.txt'), [...rapport, '', ...mesures, '', ...bandes, '', ...echos, '', ...echecs, '', resume, ''].join('\n'))
console.log(`\n${resume}\n${sortie}`)
process.exit(echecs.length ? 1 : 0)
