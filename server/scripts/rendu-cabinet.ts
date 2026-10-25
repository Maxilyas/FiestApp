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
// le bilan d'une partie quittée ; la partie qui l'attend au musée ; la chasse
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
// (`[contraste]`) — les mesures de `a-l-ecran.ts` ; et ce que le `click` qui
// suit le doigt a fait que la souris n'aurait pas fait (`[écho]`). Leur compte
// à la fin, et le tout dans `rapport.txt`. Le client construit d'abord
// (`npm run build -w client`).
//
// `THEME` : tout thème — offert, vendu ou gagné —, que Zoé et Léa portent d'office.
//
//   npx tsx scripts/rendu-cabinet.ts ../export/rendu-cabinet    (ECRAN=1366x768, THEME=ivoire, ENCOCHE=47)
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { demarrer, inscrireProfil } from '../test/banc'
import { DIX_HEURES, departEnBase } from '../test/cabinet-banc'
import { CE_QUI_DEBORDE, CE_QUI_EST_COUPE, CE_QUI_SE_CHEVAUCHE, SOUS_LA_NICHE, contrasteDeLaPage } from './a-l-ecran'
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

/** Le dialogue de « Quitter ? » : « Continuer » (`continuer`) ou « Quitter ». L'écho du doigt passé, il prend le toucher. */
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

/** Une manche du Détail : Éclairer efface un titre, un pas en arrière, puis le bon titre. */
async function unDetail(page: any, t: DetailTire, nom: string) {
  await page.waitForSelector('.cab-detail-cadre img')
  await photo(page, `${nom}-manche`)
  if (await page.locator('.cab-pouvoir:not([aria-disabled])').count()) {
    await toucher(page, page.locator('.cab-pouvoir'))
    await page.waitForSelector('.cab-titre.cab-effacee')
    await photo(page, `${nom}-eclaire`)
  }
  await toucher(page, page.locator('.cab-reculer'))
  await page.waitForSelector('.cab-detail-pas .cab-detail-vu:nth-child(2)')
  await photo(page, `${nom}-un-pas-en-arriere`, { attente: 900 })
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

/** Une manche du Mot mystère : « Quitter ? » et sa pause, un essai faux et ses couleurs, puis le mot. */
async function unMot(page: any, t: MotTire, nom: string) {
  await page.waitForSelector('.cab-clavier')
  await photo(page, `${nom}-manche`)
  // La pause de « Quitter ? » : la manche voilée, le chrono figé, la confirmation par-dessus.
  await toucher(page, page.locator('.cab-quitter'))
  await page.waitForSelector('.cab-voile')
  await page.waitForSelector('.dialog')
  await photo(page, `${nom}-pause`)
  await repondreAuDialogue(page, true)
  await page.waitForSelector('.cab-voile', { state: 'detached' })
  // Le mot à l'envers — ses lettres, pas à leur place : les trois couleurs d'un coup.
  const faux = [...t.lettres].reverse().join('') === t.lettres ? `${t.lettres.slice(1)}${t.lettres[0]}` : [...t.lettres].reverse().join('')
  await taper(page, faux)
  await toucher(page, page.locator('.cab-valider-le-mot'))
  await page.waitForSelector('.cab-mot-joue')
  await photo(page, `${nom}-un-essai`)
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
  if (await page.locator('.cab-pouvoir:not([aria-disabled])').count()) {
    await toucher(page, page.locator('.cab-pouvoir'))
    await page.waitForSelector('.cab-souffle')
    await photo(page, `${nom}-eclaire`)
  }
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
  await page.evaluate((cible: number) => {
    const g = globalThis as any
    const haut = g.document.querySelector('.cab-tete-partie')?.getBoundingClientRect().bottom ?? 0
    const bas = g.document.querySelector('.cab-pied-partie')?.getBoundingClientRect().top ?? g.innerHeight
    g.scrollBy(0, cible - (haut + bas) / 2)
  }, avant.y)
  await page.waitForTimeout(650)
  const point = await ouToucher()
  await page.touchscreen.tap(point.x, point.y)
  // Une fonction, jamais un texte : la politique de sécurité de la page refuse `eval` (skill `regarder-le-rendu`).
  await page.waitForFunction(() => ((globalThis as any).document.querySelector('.cab-ou-est')?.textContent ?? '').trim() !== '')
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
  const ordre: CleDeJeu[] = ['pari', 'eclair', 'detail', 'frise', 'mot', 'filet', 'epingle', 'indices', 'replique']
  for (const jeu of ordre) {
    await etape(`le jeu ${jeu}`, async () => {
      await sansPartieEnCours(page)
      await ouvrir(page, '#libre', '.cab-jeux')
      await toucher(page, await boutonQuiDit(page, '.cab-jeu', JEUX[jeu].nom))
      await page.waitForSelector('.cab-annonce')
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
const resume = `${rapport.length} photos en ${largeur} × ${hauteur}${theme ? `, ${theme}` : ''}${encoche ? `, encoche de ${encoche}` : ''} : ${aRevoir.length} à revoir, ${echos.length} écho(s) du doigt, ${echecs.length} étape(s) en échec.`
writeFileSync(path.join(sortie, 'rapport.txt'), [...rapport, '', ...echos, '', ...echecs, '', resume, ''].join('\n'))
console.log(`\n${resume}\n${sortie}`)
process.exit(echecs.length ? 1 : 0)
