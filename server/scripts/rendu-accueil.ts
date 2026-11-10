// L'accueil d'un profil, tenu sur un écran : chaque cas photographié du petit
// téléphone de référence (360 × 640) au grand (412 × 915), et ce qui passe
// encore sous la barre du menu, mesuré.
//
// « J'aimerais que tout soit visible sans avoir à scroll plus bas » (le
// propriétaire, le 9 novembre 2026 ; la maquette « Les lignes »,
// `retours/2026-11-09/accueil-compact/`). Les épreuves gardent la structure et
// les mots (`accueil-compact.test.ts`) ; ce qui tient ou non dans la hauteur
// d'un écran ne se voit qu'au navigateur. Un serveur jetable et Léa, une
// habituée — son loup dans sa niche, douze jours de quiz du jour, un sentier
// qu'elle avance, sa ligue aux duels, le défi de la semaine relevé par neuf
// joueurs —, puis : Tom, qui vient de créer son profil ; une journée chargée —
// une soirée en cours, un duel joué, le carnet, le défi commencé, le Cabinet en
// route — ; l'accueil dans un navigateur, l'application pas installée, au
// lendemain d'une soirée ; l'affiche d'une nouveauté à la place d'« À la
// une » ; une tablette, où les lignes ont la place de leur suite ; le texte
// agrandi à 130 % ; l'Ivoire.
//
//   npm run build -w client
//   cd server && npx tsx scripts/rendu-accueil.ts ../export/accueil
//
// `SEULEMENT=habituee,chargee` ne photographie que ces cas ; `ENCOCHE=47` pose
// l'encoche d'un iPhone et sa barre d'accueil — l'application installée, où la
// page perd 81 px de hauteur. Le script sort en erreur si un cas qui doit
// tenir — l'habituée, le débutant, l'Ivoire, l'affiche d'une nouveauté — défile
// ou déborde en largeur ; les autres disent ce qui passe dessous.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { ProfileStore } from '../src/auth/profiles'
import { CATEGORIES } from '../../shared/categories'
import { VIES } from '../../shared/campagne'
import { DESTINATIONS, type PageALAffiche } from '../../shared/affiches'

const Database = createRequire(import.meta.url)('better-sqlite3')
const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.resolve(process.argv[2] ?? path.join(ici, '../../export/accueil'))
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
 * Les écrans hauts, pour l'affiche d'une nouveauté : haut mais étroit (360 × 940, moins de 600 de large), elle reste
 * couchée en bandeau ; sur une tablette debout, elle se montre en grand.
 */
const GRANDS: Ecran[] = [[360, 940], [768, 1024]]
/**
 * L'encoche d'un iPhone, en pixels (`ENCOCHE=47`, comme `rendu-niche.ts`) : l'application installée y perd l'encoche en
 * haut et la barre d'accueil en bas — une hauteur d'écran de 844 px n'en laisse que 763 à la page.
 */
const ENCOCHE = Number(process.env.ENCOCHE ?? 0)
/** Chrome sur Android : la page y propose d'installer l'application, au pied de l'accueil. */
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'

// Mercredi 11 novembre 2026, 10 h à Paris : le défi est ouvert depuis lundi.
const horloge = { t: Date.UTC(2026, 10, 11, 9, 0) }
const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] }) })
const navigateur = await chromium.launch({ headless: true })
const db = () => new Database(banc.quizDbUrl.replace(/^file:/, ''))
const idDe = (login: string) => {
  const d = db()
  try {
    return (d.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
  } finally {
    d.close()
  }
}

/** Joue sa tentative du défi par l'API : `justes` bonnes réponses, puis des fautes — jusqu'à la fin. */
async function releverLeDefi(cookie: string, justes: number) {
  const s = (await (await ecrire(banc.url, '/api/campagne/defi', {}, cookie)).json()) as any
  const d = db()
  const qs = JSON.parse((d.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(s.id) as any).questions)
  d.close()
  let fin = false
  for (let i = 0; !fin; i++) {
    const q = qs[i]
    const r = (await (await ecrire(banc.url, `/api/campagne/serie/${s.id}/reponse`, { index: i, choix: i < justes ? q.bonne : (q.bonne + 1) % q.reponses.length }, cookie)).json()) as any
    fin = r.finie
  }
}

/** Des duels classés déjà joués, écrits dans le journal : `n` fois `justes` contre `sesJustes` (`rendu-duels.ts`). */
function duelsJoues(profileId: string, n: number, justes: number, sesJustes: number) {
  const d = db()
  const t = horloge.t - 3 * 24 * 3_600_000
  for (let i = 0; i < n; i++) {
    const adversaire = { serie: randomUUID(), profil: randomUUID(), reponses: [...Array(sesJustes).fill(true), ...Array(VIES).fill(false)] }
    d.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
       VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
    ).run(randomUUID(), profileId, justes + VIES, justes, t + i * 60_000, t + i * 60_000 + 30_000, JSON.stringify(adversaire))
  }
  d.close()
}

/**
 * Ce que la page mesure : ce qui passe sous la barre du menu, la hauteur de ses lignes, ce qui est coupé au bout, les
 * suites qu'une ligne a la place de montrer. En texte : `tsx` y glisserait des `__name`.
 */
const MESURES = `(() => {
  const menu = document.querySelector('.menu-barre')
  const pli = menu ? menu.getBoundingClientRect().top : window.innerHeight
  const bas = el => Math.round(el.getBoundingClientRect().bottom + window.scrollY)
  const haut = el => Math.round(el.getBoundingClientRect().top + window.scrollY)
  const blocs = [...document.querySelectorAll('.accueil-tete, .une-cadre, .affiche, .missions-ligne, .jouer-section > .label, .gros-bouton, .installer, .lendemain')]
    .filter(el => el.getBoundingClientRect().height > 0)
    .map(el => ({ quoi: (el.className.split(' ')[0] + ' ' + (el.querySelector('b')?.textContent ?? el.textContent ?? '').trim().slice(0, 28)).trim(), haut: haut(el), bas: bas(el) }))
  const shell = document.querySelector('.player-shell')
  const visible = el => el.getBoundingClientRect().width > 2
  const coupes = [...document.querySelectorAll('.gros-essentiel, .gros-detail:not(.gros-a-suite), .une-nom, .missions-detail, .missions-tete b')]
    .filter(el => visible(el) && el.scrollWidth > el.clientWidth + 1)
    .map(el => '« ' + el.textContent.trim().slice(0, 44) + ' »')
  const lignes = [...document.querySelectorAll('.jouer-carte:not(.jouer-duo) > .gros-bouton')].map(el => Math.round(el.getBoundingClientRect().height))
  const titresSurDeuxLignes = [...document.querySelectorAll('.jouer-carte:not(.jouer-duo) .gros-texte b')]
    .filter(el => el.getBoundingClientRect().height > 1.6 * parseFloat(getComputedStyle(el).lineHeight))
    .map(el => el.textContent)
  const suites = [...document.querySelectorAll('.gros-a-suite')].filter(visible).map(el => {
    const ligne = el.querySelector('.gros-essentiel').getBoundingClientRect().top
    const montrees = [...el.querySelectorAll('.gros-suite')].filter(s => Math.abs(s.getBoundingClientRect().top - ligne) < 2)
    return el.querySelector('.gros-essentiel').textContent + ' [' + montrees.map(s => s.textContent).join('') + ']'
  })
  // L'affiche d'une nouveauté : sa forme, sa hauteur, son titre s'il ne tient pas sur ses deux lignes, et ce que la ligne
  // de son geste a la place de dire de ses confettis — des morceaux entiers, sur la ligne du bouton.
  const laffiche = (() => {
    const el = document.querySelector('.affiche')
    if (!el || el.getBoundingClientRect().height === 0) return null
    const titre = el.querySelector('.affiche-titre')
    // Ses confettis : les morceaux que leur rangée montre — celle du cadeau sous le nom du bouton d'or, ou toute la ligne
    // du geste sur le petit téléphone, où le cadeau s'y fond (display: contents).
    const cadeau = el.querySelector('.affiche-cadeau')
    const rangee = cadeau && getComputedStyle(cadeau).display !== 'contents' ? cadeau : el.querySelector('.affiche-aller-texte')
    const cadre = rangee ? rangee.getBoundingClientRect() : null
    const dits = [...el.querySelectorAll('.affiche-cadeau-combien, .affiche-cadeau-quand')].filter(s => {
      const r = s.getBoundingClientRect()
      return !!cadre && r.top < cadre.bottom - 2 && r.bottom > cadre.top + 2 && r.right <= cadre.right + 1
    })
    const plusTard = el.querySelector('.affiche-plus-tard')
    const boite = plusTard ? plusTard.getBoundingClientRect() : null
    return {
      forme: el.classList.contains('affiche-bandeau') ? 'bandeau' : 'affiche',
      haut: Math.round(el.getBoundingClientRect().height),
      lignesDuTitre: titre ? Math.round(titre.getBoundingClientRect().height / parseFloat(getComputedStyle(titre).lineHeight)) : 0,
      confettis: dits.map(s => s.textContent).join('').trim(),
      plusTard: boite ? Math.round(boite.width) + ' × ' + Math.round(boite.height) : '',
    }
  })()
  return {
    ecran: window.innerWidth + '×' + window.innerHeight,
    pli: Math.round(pli),
    defile: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    contenu: shell ? Math.round([...shell.children].filter(e => !e.matches('.menu-barre, .sr-only, .banniere-duel-annonce')).reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom + window.scrollY), 0)) : null,
    large: document.documentElement.scrollWidth > window.innerWidth + 1,
    sousLePli: blocs.filter(b => b.bas > pli + 1).map(b => b.quoi + ' (' + b.haut + '–' + b.bas + ')'),
    coupes,
    lignes,
    titresSurDeuxLignes,
    suites,
    laffiche,
    blocs,
  }
})()`

const rapport: Record<string, any> = {}
/**
 * Les cas qui doivent tenir sur l'écran, sans défiler ni déborder : s'ils ne tiennent plus, le script sort en erreur.
 * L'affiche d'une nouveauté en est depuis le 10 novembre 2026 : couchée en bandeau sur un téléphone, elle tient à la
 * place d'« À la une » ; en grand, là où l'écran a sa hauteur.
 */
const DOIVENT_TENIR = ['habituee', 'debutant', 'ivoire', 'affiche']
try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
  const autres: [string, string, string, number][] = [
    ['hugo', 'Hugo', '🦁', 11],
    ['camille', 'Camille', '🦄', 9],
    ['nadia', 'Nadia', '🐱', 9],
    ['karim', 'Karim', '🐯', 7],
    ['zoe', 'Zoé', '🐸', 6],
    ['rachid', 'Rachid', '🦉', 5],
    ['ines', 'Inès', '🐼', 4],
    ['marc', 'Marc', '🐶', 3],
    ['sofia', 'Sofia', '🐙', 2],
  ]
  const cookies: Record<string, string> = {}
  for (const [login, nom, avatar] of autres) cookies[login] = await inscrireProfil(banc.url, login, nom, avatar)
  const idLea = idDe('lea')

  {
    const d = db()
    // Son loup dans sa niche : le coin haut droit de l'accueil est à lui.
    d.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', idLea)
    d.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 0, 1, 1)').run(idLea, 'loup')
    // Le sentier de la forêt, quatre paliers validés : « Palier 5 de la forêt ».
    d.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)').run(idLea, 'foret', 4, horloge.t)
    // Douze jours de quiz du jour pour Léa, jusqu'à hier ; la salle aussi, pour ses places.
    const tirage = d.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`)
    const partie = d.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, ?, 10, NULL, ?, ?, ?, 0)`,
    )
    const questions = JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 })))
    for (let j = 0; j < 12; j++) {
      const midi = horloge.t - (12 - j) * 24 * 3_600_000
      const jour = new Date(midi).toISOString().slice(0, 10)
      tirage.run(jour, questions)
      partie.run(idLea, jour, midi, 1180 + ((j * 37) % 200), 7, midi + 120_000)
      autres.forEach(([login], k) => {
        if ((j + k) % 3 !== 0) partie.run(idDe(login), jour, midi, 600 + ((j * 53 + k * 97) % 900), 6, midi + 120_000)
      })
    }
    d.close()
  }
  // Ses duels : une quinzaine, plutôt gagnés — sa ligue et son blason sur sa ligne.
  duelsJoues(idLea, 14, 12, 8)
  // Neuf joueurs ont relevé le défi de la semaine.
  for (const [login, , , justes] of autres) await releverLeDefi(cookies[login], justes)
  // Ce qui s'est écrit derrière le dos du serveur ne se lit qu'après son redémarrage (les journaux en mémoire).
  await banc.redemarrer()
  await new Promise(r => setTimeout(r, 1500))

  type Cas = {
    /** Qui regarde son accueil. */
    cookie: string
    /** Une journée chargée : la réponse de l'accueil réécrite en route — une soirée en cours, un duel joué, le carnet, le défi commencé, le Cabinet en route. */
    chargee?: boolean
    /** Dans un navigateur d'Android, l'application pas installée, au lendemain d'une soirée : la ligne du lendemain et celle de l'installation. */
    navigateur?: boolean
    /** L'affiche d'une nouveauté, à la place d'« À la une », et « Nouveau » sur le bouton de sa page — tant qu'il n'y est pas allé ni ne l'a rangée. */
    affiche?: { page: PageALAffiche; titre: string; phrase: string; confettis: number }
    /** Le texte agrandi, en pour cent. */
    texte?: number
    /** Un jeudi sans duel de la semaine : la ligne des duels dit ce que sa semaine attend encore — sa relance, la plus longue des lignes (33 caractères). */
    relance?: boolean
  }
  const photographier = async (nom: string, cas: Cas, ecrans: Ecran[]) => {
    for (const [largeur, hauteur] of ecrans) {
      // Le mouvement réduit fige « À la une » : sans lui, chaque photo montrait une autre affiche.
      const ctx = await navigateur.newContext({
        viewport: { width: largeur, height: hauteur },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
        ...(cas.navigateur && { userAgent: ANDROID }),
      })
      const [cle, valeur] = cas.cookie.split('=')
      await ctx.addCookies([{ name: cle, value: valeur, url: banc.url }])
      await ctx.addInitScript(
        (c: { chargee: boolean; navigateur: boolean; maintenant: number }) => {
          try {
            // La bannière du résultat ne tombe qu'une fois : déjà tombée, elle ne couvre pas la photo.
            if (c.chargee) localStorage.setItem('quizz.duels.resultatAnnonce', 'ABCD')
            if (c.navigateur) {
              localStorage.setItem(
                'quizz.fin.chez-hugo',
                JSON.stringify({ v: 1, soiree: { id: '2026-11-10-2030-x1', titre: 'Chez Hugo', slug: 'chez-hugo' }, joueurId: 'p1', recueLe: c.maintenant, ouverte: false }),
              )
            }
          } catch {}
        },
        { chargee: !!cas.chargee, navigateur: !!cas.navigateur, maintenant: Date.now() },
      )
      // Où tombe la première section, image par image : « À la une » et les missions arrivent après la page, dans la place
      // qu'elle leur garde (`.haut-en-chemin`) — si elle n'a pas leur taille, les boutons sautent sous le doigt. En texte,
      // comme les mesures.
      await ctx.addInitScript(`(() => {
        const vus = []
        window.__hautsDeLaSection = vus
        const voir = () => {
          const el = document.querySelector('.jouer-section')
          if (el) {
            // Avec elle, la hauteur de ce qui la précède : la ligne de soi, puis « À la une » et les missions (ou leur place gardée).
            const h = s => Math.round(document.querySelector(s)?.getBoundingClientRect().height ?? 0)
            const haut = Math.round(el.getBoundingClientRect().top) + ' (soi ' + h('.accueil-tete') + ', le haut ' + h('.haut-accueil, .haut-en-chemin') + ')'
            if (vus[vus.length - 1] !== haut) vus.push(haut)
          }
          requestAnimationFrame(voir)
        }
        requestAnimationFrame(voir)
      })()`)
      const page = await ctx.newPage()
      // L'encoche d'un iPhone et sa barre d'accueil (34 px en bas), posées avant que la page n'ouvre rien : l'application
      // installée leur rend de la hauteur, que Chromium sans écran ne retire pas de lui-même.
      if (ENCOCHE) {
        const cdp = await ctx.newCDPSession(page)
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: ENCOCHE, topMax: ENCOCHE, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } })
      }
      page.on('pageerror', (e: Error) => console.error('[page]', e.message))
      if (cas.chargee || cas.affiche || cas.relance) {
        await page.route(/\/api\/joueur\/moi\?accueil/, async (route: any) => {
          const reponse = await route.fetch()
          const j = await reponse.json()
          // Ni le bilan du lundi, ni un duel de la semaine : il lui en reste trois à jouer pour sa récompense.
          if (cas.relance) j.profile.duels = { ...j.profile.duels, semainePassee: undefined, semaine: { ...j.profile.duels?.semaine, duels: 0 } }
          if (cas.chargee) {
            j.enCours = [{ nom: 'Hugo', slug: 'chez-hugo' }]
            j.profile.duels = { ...j.profile.duels, semainePassee: undefined, resultats: { n: 1, de: 'Hugo', code: 'ABCD' }, defisRecus: { n: 2, de: 'Zoé' } }
            j.profile.campagne = { ...j.profile.campagne, aRevoir: 7 }
            j.profile.defi = { ...j.profile.defi, enCours: { justes: 4 } }
            j.profile.cabinet = { acte: 2, coeurs: 4 }
          }
          if (cas.affiche) j.profile.affiches = [{ id: 'rendu', ...cas.affiche, rangee: false }]
          await route.fulfill({ response: reponse, json: j })
        })
      }
      await page.goto(`${banc.url}/`)
      await page.waitForSelector('.accueil-gestes')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(800)
      // Avant d'agrandir le texte : c'est le script qui le ferait sauter, pas la page.
      const hauts = (await page.evaluate('window.__hautsDeLaSection')) as string[]
      if (cas.texte) await page.addStyleTag({ content: `html { font-size: ${cas.texte}% !important; }` })
      await page.waitForTimeout(800)
      const n = `${nom}-${largeur}x${hauteur}`
      await page.screenshot({ path: path.join(sortie, `${n}.png`) })
      rapport[n] = { ...((await page.evaluate(MESURES)) as object), hauts }
      // Ce qui dépasse se photographie aussi en entier — la barre du menu, fixe, se poserait au milieu : elle s'efface.
      if (rapport[n].defile > 0) {
        const style = await page.addStyleTag({ content: '.menu-barre { display: none !important; }' })
        await page.screenshot({ path: path.join(sortie, `${n}-entiere.png`), fullPage: true })
        await style.evaluate((s: any) => s.remove())
      }
      await ctx.close()
    }
  }

  const seulement = (process.env.SEULEMENT ?? '').split(',').filter(Boolean)
  const cas: [string, Cas, Ecran[]][] = [
    ['habituee', { cookie: lea }, TOUS_LES_ECRANS],
    ['debutant', { cookie: tom }, DEUX_ECRANS],
    ['chargee', { cookie: lea, chargee: true }, DEUX_ECRANS],
    // La relance des duels, « Encore 3 duels pour ta récompense » : la plus longue des lignes, entière sur le petit téléphone.
    ['relance', { cookie: lea, relance: true }, DEUX_ECRANS],
    ['navigateur', { cookie: lea, navigateur: true }, DEUX_ECRANS],
    // L'affiche du Cabinet telle que le QG la propose (son titre de 41 caractères, 50 confettis), couchée en bandeau à
    // chaque taille de téléphone ; celle des duels, sans peinture ni confettis ; la plus longue qu'on puisse écrire — un
    // titre de 48 caractères larges, 500 confettis — ; puis en grand, là où l'écran a sa hauteur.
    ['affiche', { cookie: lea, affiche: { page: 'cabinet', titre: DESTINATIONS.cabinet.titre, phrase: DESTINATIONS.cabinet.phrase, confettis: 50 } }, TOUS_LES_ECRANS],
    ['affiche-duels', { cookie: lea, affiche: { page: 'duels', titre: DESTINATIONS.duels.titre, phrase: DESTINATIONS.duels.phrase, confettis: 0 } }, DEUX_ECRANS],
    [
      'affiche-longue',
      { cookie: lea, affiche: { page: 'collectionneurs', titre: 'Mesdames et Messieurs, le Grand Classement ouvre', phrase: DESTINATIONS.collectionneurs.phrase, confettis: 500 } },
      DEUX_ECRANS,
    ],
    ['affiche-entiere', { cookie: lea, affiche: { page: 'cabinet', titre: DESTINATIONS.cabinet.titre, phrase: DESTINATIONS.cabinet.phrase, confettis: 50 } }, GRANDS],
    ['tablette', { cookie: lea }, TABLETTE],
    ['agrandi', { cookie: lea, texte: 130 }, PETIT],
  ]
  for (const [nom, c, ecrans] of cas) if (!seulement.length || seulement.includes(nom)) await photographier(nom, c, ecrans)
  // L'Ivoire, en dernier : le thème se porte, et habillerait toutes les photos d'après.
  if (!seulement.length || seulement.includes('ivoire')) {
    const r = await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, lea, 'PUT')
    if (!r.ok) throw new Error(`L'Ivoire ne se porte pas (${r.status} ${await r.text()})`)
    await photographier('ivoire', { cookie: lea }, DEUX_ECRANS)
  }

  writeFileSync(path.join(sortie, 'mesures.json'), JSON.stringify(rapport, null, 2))
  let rate = 0
  for (const [n, m] of Object.entries(rapport)) {
    // Avec une encoche, seuls les grands écrans doivent tenir : aucun téléphone de 640 ou de 740 px de haut n'en a une.
    const doitTenir = DOIVENT_TENIR.some(c => n.startsWith(`${c}-`)) && (!ENCOCHE || Number(n.match(/x(\d+)$/)?.[1]) >= 800)
    // Ce dont la page défile : le contenu passé sous la barre du menu, et la marge qu'elle garde sous son dernier bloc.
    const verdict = m.large
      ? 'DÉBORDE EN LARGEUR'
      : m.defile > 0
        ? `la page défile de ${m.defile} px (${m.contenu - m.pli} px de contenu sous le menu)`
        : `tout tient (${m.pli - m.contenu} px au-dessus du menu)`
    if (doitTenir && (m.large || m.defile > 0)) rate++
    console.log(`${n} — ${verdict} · lignes de ${Math.min(...m.lignes)}${Math.max(...m.lignes) !== Math.min(...m.lignes) ? ` à ${Math.max(...m.lignes)}` : ''} px${doitTenir && (m.large || m.defile > 0) ? ' — DEVAIT TENIR' : ''}`)
    if (m.sousLePli.length) console.log(`   sous le menu : ${m.sousLePli.join(' ; ')}`)
    if (m.coupes.length) console.log(`   coupé au bout : ${m.coupes.join(' ; ')}`)
    if (m.titresSurDeuxLignes.length) console.log(`   titre sur deux lignes : ${m.titresSurDeuxLignes.join(' ; ')}`)
    if (m.suites.length) console.log(`   suites montrées : ${m.suites.join(' ; ')}`)
    if (m.laffiche) {
      const a = m.laffiche
      console.log(
        `   l'affiche : ${a.forme === 'bandeau' ? 'en bandeau' : 'en grand'}, ${a.haut} px${a.forme === 'bandeau' && a.lignesDuTitre > 2 ? ` · son titre sur ${a.lignesDuTitre} lignes` : ''}${a.confettis ? ` · ses confettis : « ${a.confettis} »` : ''} · « Plus tard » : ${a.plusTard} px`,
      )
    }
    // Ce qui précède peut changer de hauteur sans rien pousser (la place gardée devient le haut) : seul compte où tombe la section.
    // Un pixel d'écart est un arrondi (une police qui arrive) : il ne se voit pas.
    const tombes = (m.hauts as string[]).map(h => Number(h.split(' ')[0]))
    if (Math.max(...tombes) - Math.min(...tombes) > 1) console.log(`   LES BOUTONS ONT SAUTÉ pendant le chargement : la première section à ${m.hauts.join(' → ')} px du haut`)
  }
  console.log(`Photos et mesures dans ${sortie}`)
  // Par le code de sortie de Node, pas `process.exit()` : ce qui vient de s'écrire part d'abord (règle `tests.md`).
  if (rate > 0) process.exitCode = 1
} finally {
  await navigateur.close()
  await banc.close()
}
