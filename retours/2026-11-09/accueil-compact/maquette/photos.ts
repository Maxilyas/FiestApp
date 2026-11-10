// Maquette — l'accueil d'un profil, plus compact : tout ce qu'on vient y faire
// sur un écran, sans défiler. Un serveur jetable et Léa, une habituée — son
// loup dans sa niche, douze jours de quiz du jour, un sentier qu'elle avance,
// sa ligue aux duels, le défi de la semaine relevé par neuf joueurs —, puis son
// accueil photographié au téléphone tel qu'il est et sous chaque proposition
// du prototype (`prototype.patch`, `quizz.maquette` : `lignes`, `tuiles`), du
// petit téléphone de référence (360 × 640) au grand (412 × 915). Puis les
// autres cas : Tom, qui vient de créer son profil ; une journée chargée — une
// soirée en cours, un duel joué, le carnet, le défi commencé, le Cabinet en
// route — ; l'accueil dans un navigateur, l'application pas installée, au
// lendemain d'une soirée ; l'Ivoire ; le texte agrandi à 130 %. À chaque
// photo, la hauteur de la page et ce qui passe sous la barre du menu.
//
//   git apply retours/2026-11-09/accueil-compact/maquette/prototype.patch && npm run build -w client
//   cd server && npx tsx ../retours/2026-11-09/accueil-compact/maquette/photos.ts [dossier] [avant|tout]
//
// `avant` ne photographie que l'accueil d'aujourd'hui : il se passe du patch.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../../../../server/test/banc'
import { ProfileStore } from '../../../../server/src/auth/profiles'
import { CATEGORIES } from '../../../../shared/categories'
import { VIES } from '../../../../shared/campagne'

const REPO = fileURLToPath(new URL('../../../..', import.meta.url))
const Database = createRequire(path.join(REPO, 'server/package.json'))('better-sqlite3')
const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.resolve(process.argv[2] ?? path.join(ici, 'captures'))
const quoi = process.argv[3] ?? 'tout'
mkdirSync(sortie, { recursive: true })
ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

/** L'accueil d'aujourd'hui (`null`), puis les propositions du prototype, par la valeur de `quizz.maquette`. */
const DISPOSITIONS: [string, string | null][] = [['avant', null], ...(quoi === 'avant' ? [] : ([['lignes', 'lignes'], ['tuiles', 'tuiles']] as [string, string][]))]
type Ecran = [number, number]
/** Le petit téléphone de référence, un moyen, un iPhone d'aujourd'hui, un grand Android. */
const TOUS_LES_ECRANS: Ecran[] = [[360, 640], [360, 740], [390, 844], [412, 915]]
const DEUX_ECRANS: Ecran[] = [[360, 640], [390, 844]]
const PETIT: Ecran[] = [[360, 640]]
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

/** Ce que la page mesure : sa hauteur, où tombe chaque bloc, ce qui passe sous la barre du menu. En texte : `tsx` y glisserait des `__name`. */
const MESURES = `(() => {
  const menu = document.querySelector('.menu-barre')
  const pli = menu ? menu.getBoundingClientRect().top : window.innerHeight
  const bas = el => Math.round(el.getBoundingClientRect().bottom + window.scrollY)
  const haut = el => Math.round(el.getBoundingClientRect().top + window.scrollY)
  const blocs = [...document.querySelectorAll('.accueil-tete, .une-cadre, .affiche, .missions-ligne, .jouer-section > .label, .gros-bouton, .jour-defi, .installer, .lendemain')]
    .filter(el => !el.closest('[aria-hidden="true"]') && el.getBoundingClientRect().height > 0)
    .map(el => ({ quoi: (el.className.split(' ')[0] + ' ' + (el.querySelector('b')?.textContent ?? el.textContent ?? '').trim().slice(0, 28)).trim(), haut: haut(el), bas: bas(el) }))
  const shell = document.querySelector('.player-shell')
  const coupes = [...document.querySelectorAll('.gros-detail, .gros-texte b, .une-nom, .une-detail, .missions-detail, .missions-tete b')]
    .filter(el => el.getBoundingClientRect().height > 0 && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
    .map(el => '« ' + el.textContent.trim().slice(0, 44) + ' »')
  return {
    ecran: window.innerWidth + '×' + window.innerHeight,
    pli: Math.round(pli),
    defile: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    contenu: shell ? Math.round([...shell.children].filter(e => !e.matches('.menu-barre, .sr-only, .banniere-duel-annonce')).reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom + window.scrollY), 0)) : null,
    large: document.documentElement.scrollWidth > window.innerWidth + 1,
    sousLePli: blocs.filter(b => b.bas > pli + 1).map(b => b.quoi + ' (' + b.haut + '–' + b.bas + ')'),
    coupes,
    blocs,
  }
})()`

const rapport: Record<string, any> = {}
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
    // Le sentier de la forêt, quatre paliers validés : « Vers le palier 5 de la forêt ».
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
  // Ses duels : une quinzaine, plutôt gagnés — sa ligue et son blason sur la tuile.
  duelsJoues(idLea, 14, 12, 8)
  // Neuf joueurs ont relevé le défi de la semaine.
  for (const [login, , , justes] of autres) await releverLeDefi(cookies[login], justes)
  await banc.redemarrer()
  await new Promise(r => setTimeout(r, 1500))

  type Cas = {
    /** Qui regarde son accueil. */
    cookie: string
    /** Une journée chargée : la réponse de l'accueil réécrite en route — une soirée en cours, un duel joué, le carnet, le défi commencé, le Cabinet en route. */
    chargee?: boolean
    /** Dans un navigateur d'Android, l'application pas installée, au lendemain d'une soirée : la ligne du lendemain et celle de l'installation. */
    navigateur?: boolean
    /** Le texte agrandi, en pour cent. */
    texte?: number
  }
  const photographier = async (nom: string, cas: Cas, ecrans: Ecran[]) => {
    for (const [largeur, hauteur] of ecrans) {
      for (const [disposition, maquette] of DISPOSITIONS) {
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
          ([m, c]: [string | null, { chargee: boolean; navigateur: boolean; maintenant: number }]) => {
            try {
              if (m) localStorage.setItem('quizz.maquette', m)
              else localStorage.removeItem('quizz.maquette')
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
          [maquette, { chargee: !!cas.chargee, navigateur: !!cas.navigateur, maintenant: Date.now() }] as [string | null, { chargee: boolean; navigateur: boolean; maintenant: number }],
        )
        const page = await ctx.newPage()
        page.on('pageerror', (e: Error) => console.error('[page]', e.message))
        if (cas.chargee) {
          await page.route(/\/api\/joueur\/moi\?accueil/, async (route: any) => {
            const reponse = await route.fetch()
            const j = await reponse.json()
            j.enCours = [{ nom: 'Hugo', slug: 'chez-hugo' }]
            j.profile.duels = { ...j.profile.duels, semainePassee: undefined, resultats: { n: 1, de: 'Hugo', code: 'ABCD' }, defisRecus: { n: 2, de: 'Zoé' } }
            j.profile.campagne = { ...j.profile.campagne, aRevoir: 7 }
            j.profile.defi = { ...j.profile.defi, enCours: { justes: 4 } }
            j.profile.cabinet = { acte: 2, coeurs: 4 }
            await route.fulfill({ response: reponse, json: j })
          })
        }
        await page.goto(`${banc.url}/`)
        await page.waitForSelector('.accueil-gestes')
        await page.waitForLoadState('networkidle')
        if (cas.texte) await page.addStyleTag({ content: `html { font-size: ${cas.texte}% !important; }` })
        await page.waitForTimeout(1600)
        const n = `${disposition}-${nom}-${largeur}x${hauteur}`
        await page.screenshot({ path: path.join(sortie, `${n}.png`) })
        rapport[n] = await page.evaluate(MESURES)
        // Ce qui dépasse se photographie aussi en entier — la barre du menu, fixe, se poserait au milieu : elle s'efface.
        if (rapport[n].defile > 0) {
          const style = await page.addStyleTag({ content: '.menu-barre { display: none !important; }' })
          await page.screenshot({ path: path.join(sortie, `${n}-entiere.png`), fullPage: true })
          await style.evaluate((s: any) => s.remove())
        }
        console.log(path.join(sortie, `${n}.png`))
        await ctx.close()
      }
    }
  }

  const seulement = (process.env.SEULEMENT ?? '').split(',').filter(Boolean)
  const cas: [string, Cas, Ecran[]][] = [
    ['habituee', { cookie: lea }, TOUS_LES_ECRANS],
    ['debutant', { cookie: tom }, DEUX_ECRANS],
    ['chargee', { cookie: lea, chargee: true }, DEUX_ECRANS],
    ['navigateur', { cookie: lea, navigateur: true }, DEUX_ECRANS],
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
  for (const [n, m] of Object.entries(rapport)) {
    console.log(`${n} — pli à ${m.pli}, contenu jusqu'à ${m.contenu}, défile de ${m.defile}${m.large ? ', DÉBORDE EN LARGEUR' : ''}`)
    if (m.sousLePli.length) console.log(`   sous le pli : ${m.sousLePli.join(' ; ')}`)
    if (m.coupes.length) console.log(`   coupé : ${m.coupes.join(' ; ')}`)
  }
} finally {
  await navigateur.close()
  await banc.close()
}
