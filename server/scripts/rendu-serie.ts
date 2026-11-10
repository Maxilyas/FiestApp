// Le départ d'une série (`/campagne`, l'onglet « Série »), tenu sur un écran.
//
// « J'aimerais que tu passes en revue tous les écrans de l'application et que
// tu modifies ceux que tu trouves trop longs / ou ça serait logique de tout
// voir sans scroller » (le propriétaire, le 10 novembre 2026). On vient ici
// lancer une série, et dire sur quoi : le gros bouton et la ligne « Sur
// Toutes les catégories · Changer » se voient sans défiler. La ligne passait
// à moitié sous l'écran en 360 × 640 — les quatre pastilles des règles
// tenaient 125 px au-dessus du bouton ; elles se lisent dessous depuis.
//
// Ce qui ne se voit qu'au navigateur se mesure ici, sur un serveur jetable.
// Chaque cas photographié du petit téléphone de référence (360 × 640) au
// grand (412 × 915) : Tom, qui n'a jamais joué ; Léa, une habituée, après ses
// bonnes réponses du jour (« Aujourd'hui : +40 XP · encore 16 bonnes réponses
// au double », sur deux lignes en 360 de large) ; sa série laissée en route
// (« Reprendre ma série » au-dessus du gros bouton) ; six catégories choisies,
// la ligne du choix au plus haut ; son compagnon dans sa niche ; sous le
// bandeau du service ; le texte agrandi à 130 % ; l'Ivoire. À chaque photo :
// où finissent le gros bouton et la ligne du choix, combien de règles se
// lisent sans défiler, ce qui passe sous la niche — et, la réponse du serveur
// retenue une seconde, la page qui s'esquisse en l'attendant : ce qui bouge
// quand elle arrive (« A BOUGÉ »).
//
//   npm run build -w client
//   cd server && npx tsx scripts/rendu-serie.ts ../export/serie
//
// `SEULEMENT=nouveau,a-reprendre` ne joue que ces cas. Le script sort en
// erreur si le gros bouton ou la ligne du choix passent sous l'écran dans un
// cas qui doit tenir — le nouveau venu, l'habituée, la série à reprendre, le
// compagnon, l'Ivoire —, si la page déborde en largeur, ou si le gros bouton
// d'un nouveau venu bouge à l'arrivée de la page.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { ProfileStore } from '../src/auth/profiles'
import { CATEGORIES } from '../../shared/categories'
import { SOUS_LA_NICHE } from './a-l-ecran'

const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.resolve(process.argv[2] ?? path.join(ici, '../../export/serie'))
mkdirSync(sortie, { recursive: true })
ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

type Ecran = [number, number]
/** Le petit téléphone de référence, un moyen, un iPhone d'aujourd'hui, un grand Android. */
const TOUS_LES_ECRANS: Ecran[] = [[360, 640], [360, 740], [390, 844], [412, 915]]
const DEUX_ECRANS: Ecran[] = [[360, 640], [390, 844]]
const PETIT: Ecran[] = [[360, 640]]

/**
 * Ce que la page mesure : où finissent le gros bouton et la ligne du choix, où sont les règles et combien se lisent
 * sans défiler, de combien la page défile, si elle déborde en largeur. En texte : `tsx` y glisserait des `__name`.
 */
const LA_SERIE = `(() => {
  const boite = sel => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 ? { haut: Math.round(r.top + scrollY), bas: Math.round(r.bottom + scrollY) } : null
  }
  const regles = [...document.querySelectorAll('.campagne-puces li')].map(li => li.getBoundingClientRect().bottom + scrollY)
  return {
    ecran: innerWidth + '×' + innerHeight,
    pli: innerHeight,
    defile: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    large: document.documentElement.scrollWidth > innerWidth + 1,
    bandeau: (() => { const b = document.querySelector('#root .bandeau-du-service'); return b ? Math.round(b.parentElement.getBoundingClientRect().height) : 0 })(),
    onglets: boite('.campagne > .onglets-campagne'),
    heros: boite('.campagne-heros'),
    aujourdhui: boite('.campagne-xp-du-jour'),
    reprendre: boite('.campagne > button.btn:not(.btn-primary)'),
    geste: boite('.campagne > .btn-primary.btn-big'),
    choix: boite('.campagne > .quoi-ligne'),
    regles: boite('.campagne-puces'),
    reglesDansLeHeros: !!document.querySelector('.campagne-heros .campagne-puces'),
    reglesLues: regles.filter(bas => bas <= innerHeight + 0.5).length,
    reglesEnTout: regles.length,
    records: boite('.campagne-records'),
  }
})()`

/**
 * Image par image, pendant que la page se charge : où tombent le héros, le gros bouton, la ligne du choix et les
 * règles — et si la page attend encore (`aria-busy`). Ce qui change de place entre l'attente et la page se voit là.
 */
const SUIVRE_LA_PAGE = `(() => {
  const vus = []
  window.__laSerie = vus
  const haut = sel => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().top) : '–' }
  const voir = () => {
    const page = document.querySelector('.player-shell.campagne')
    if (page) {
      const vu = (page.hasAttribute('aria-busy') ? 'attente' : 'page') + ' : ' + ['.campagne-heros', '.campagne > .btn-primary.btn-big', '.campagne > .quoi-ligne', '.campagne-puces'].map(haut).join(', ')
      if (vus[vus.length - 1] !== vu) vus.push(vu)
    }
    requestAnimationFrame(voir)
  }
  requestAnimationFrame(voir)
})()`

const horloge = { t: Date.UTC(2026, 10, 10, 9, 0) }
const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] }) })
const navigateur = await chromium.launch({ headless: true })
const seulement = (process.env.SEULEMENT ?? '').split(',').filter(Boolean)
const retenu = (nom: string) => !seulement.length || seulement.includes(nom)
const rapport: Record<string, any> = {}
/** Les cas où le gros bouton et la ligne du choix doivent se voir sans défiler : sinon, le script sort en erreur. */
const DOIVENT_TENIR = ['nouveau', 'habituee', 'a-reprendre', 'compagnon', 'ivoire']
let rate = 0
const base = () => new Database(banc.quizDbUrl.replace(/^file:/, ''))

try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
  const idDeLea = (() => {
    const d = base()
    try {
      return (d.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id
    } finally {
      d.close()
    }
  })()
  // Léa, une habituée : sept séries d'une seule catégorie — ses records, repliés sous la ligne du choix.
  {
    const d = base()
    const ins = d.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, categories) VALUES (?, ?, '[]', 0, 0, ?, 1, 2, 'serie', ?)`)
    CATEGORIES.slice(0, 7).forEach((c, i) => ins.run(`r${i}`, idDeLea, [12, 10, 4, 15, 9, 10, 3][i], JSON.stringify([c])))
    d.close()
  }
  /** Une série par l'API : `justes` bonnes réponses, puis des fautes jusqu'à sa fin — ou laissée là (`laissee`). */
  const jouer = async (cookie: string, justes: number, laissee = false) => {
    const s = (await (await ecrire(banc.url, '/api/campagne/serie', {}, cookie)).json()) as { id: string }
    const d = base()
    const qs = JSON.parse((d.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(s.id) as { questions: string }).questions) as { bonne: number; reponses: string[] }[]
    d.close()
    for (let i = 0; i < (laissee ? justes : qs.length); i++) {
      const q = qs[i]
      const r = (await (await ecrire(banc.url, `/api/campagne/serie/${s.id}/reponse`, { index: i, choix: i < justes ? q.bonne : (q.bonne + 1) % q.reponses.length }, cookie)).json()) as { finie?: boolean }
      if (r.finie) return
    }
  }
  // Ses bonnes réponses du jour : « Aujourd'hui : +40 XP · encore 16 bonnes réponses au double ».
  await jouer(lea, 4)

  type Cas = {
    cookie: string
    /** Les catégories retenues sur ce téléphone (`quizz.campagne.categories`) : la ligne du choix les dit toutes. */
    categories?: string[]
    /** Le texte agrandi, en pour cent. */
    texte?: number
    /** La réponse du serveur retenue, en millisecondes : la page s'esquisse en l'attendant, et l'attente se photographie. */
    attente?: number
  }
  const serie = async (nom: string, cas: Cas, ecrans: Ecran[]) => {
    if (!retenu(nom)) return
    for (const [largeur, hauteur] of ecrans) {
      const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
      const [cle, valeur] = cas.cookie.split('=')
      await ctx.addCookies([{ name: cle, value: valeur, url: banc.url }])
      await ctx.addInitScript(SUIVRE_LA_PAGE)
      if (cas.categories) await ctx.addInitScript(`try { localStorage.setItem('quizz.campagne.categories', ${JSON.stringify(JSON.stringify(cas.categories))}) } catch {}`)
      const page = await ctx.newPage()
      page.on('pageerror', (e: Error) => console.error('[page]', e.message))
      const n = `${nom}-${largeur}x${hauteur}`
      if (cas.attente) {
        const attente = cas.attente
        await page.route(/\/api\/campagne$/, async (route: any) => {
          await new Promise(r => setTimeout(r, attente))
          await route.continue()
        })
      }
      await page.goto(`${banc.url}/campagne`, { waitUntil: 'commit' })
      if (cas.attente) {
        await page.waitForSelector('.campagne[aria-busy] .campagne-heros', { timeout: 15000 })
        await page.waitForTimeout(Math.min(400, cas.attente / 2))
        await page.screenshot({ path: path.join(sortie, `${n}-en-attente.png`) })
      }
      await page.waitForSelector('.campagne:not([aria-busy]) .campagne-heros', { timeout: 15000 })
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.evaluate('document.fonts.ready')
      await page.waitForTimeout(700)
      // Avant d'agrandir le texte : c'est le script qui ferait bouger la page, pas elle.
      const vus = (await page.evaluate('window.__laSerie')) as string[]
      if (cas.texte) {
        await page.addStyleTag({ content: `html { font-size: ${cas.texte}% !important; }` })
        await page.waitForTimeout(500)
      }
      const m = { ...((await page.evaluate(LA_SERIE)) as object), sousLaNiche: (await page.evaluate(SOUS_LA_NICHE)) as string[], vus } as any
      rapport[n] = m
      await page.screenshot({ path: path.join(sortie, `${n}.png`) })
      if (m.defile > 0) await page.screenshot({ path: path.join(sortie, `${n}-entiere.png`), fullPage: true })
      await ctx.close()

      const sous = (b: { bas: number } | null) => (b ? b.bas - m.pli : null)
      const geste = sous(m.geste)
      const choix = sous(m.choix)
      const dit = (quoi: string, de: number | null) => (de === null ? `pas de ${quoi}` : de > 0 ? `${quoi} ${de} px SOUS L’ÉCRAN` : `${quoi} entier (${-de} px de libre)`)
      const rateIci = DOIVENT_TENIR.includes(nom) && (m.large || geste === null || geste > 0 || choix === null || choix > 0)
      if (rateIci) rate++
      console.log(
        `${n} — ${m.large ? 'DÉBORDE EN LARGEUR · ' : ''}${dit('le gros bouton', geste)} · ${dit('la ligne du choix', choix)} · règles ${m.reglesDansLeHeros ? 'dans le héros' : 'sous le choix'}, ${m.reglesLues} sur ${m.reglesEnTout} lues sans défiler · défile de ${m.defile} px${m.bandeau ? ` · bandeau ${m.bandeau} px` : ''}${rateIci ? ' — DEVAIT TENIR' : ''}`,
      )
      const dessous = (m.sousLaNiche as string[]).filter(x => x !== '(pas de niche)')
      if (dessous.length) console.log(`   SOUS LA NICHE — ${dessous.join(' · ')}`)
      // Ce qui bouge quand la page arrive : le héros, le gros bouton, la ligne du choix, les règles — d'une image à l'autre.
      const images = vus.map(v => ({ quoi: v.split(' : ')[0], hauts: v.split(' : ')[1].split(', ') }))
      const noms = ['le héros', 'le gros bouton', 'la ligne du choix', 'les règles']
      const bouge = noms.filter((_, k) => new Set(images.map(i => i.hauts[k]).filter(h => h !== '–')).size > 1)
      if (bouge.length) console.log(`   A BOUGÉ à l’arrivée de la page : ${bouge.join(', ')} — ${vus.join(' → ')}`)
      // Le gros bouton d'un nouveau venu : ni ligne du jour ni série à reprendre ne viennent le pousser, il ne bouge pas.
      if (nom === 'en-attente' && bouge.includes('le gros bouton')) rate++
    }
  }

  await serie('nouveau', { cookie: tom }, TOUS_LES_ECRANS)
  await serie('en-attente', { cookie: tom, attente: 1000 }, PETIT)
  await serie('habituee', { cookie: lea }, TOUS_LES_ECRANS)
  // Six catégories choisies : la ligne du choix les nomme toutes, sur trois lignes en 360 de large.
  await serie('six-categories', { cookie: lea, categories: CATEGORIES.slice(0, 6) }, DEUX_ECRANS)
  // Une série laissée en route, quatre bonnes réponses : « Reprendre ma série · 4 bonnes » au-dessus du gros bouton.
  await jouer(lea, 4, true)
  await serie('a-reprendre', { cookie: lea }, TOUS_LES_ECRANS)
  await serie('agrandi', { cookie: lea, texte: 130 }, PETIT)

  // Son compagnon dans sa niche, en haut à droite : la première ligne s'y arrête.
  if (retenu('compagnon')) {
    const d = base()
    d.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', idDeLea)
    d.prepare(`INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, nom, created_at) VALUES (?, 'loup', 1000, 2, 'Croc', 1)`).run(idDeLea)
    d.close()
    // Ce qui s'est écrit derrière le dos du serveur ne se lit qu'après son redémarrage.
    await banc.redemarrer()
    await serie('compagnon', { cookie: lea }, DEUX_ECRANS)
  }

  // Sous le bandeau du service : 58 px de moins.
  if (retenu('bandeau')) {
    const admin = await connexionAnimateur(banc.url)
    const poser = (texte: string | null) => ecrire(banc.url, '/api/admin/maintenance/bandeau', { texte }, admin, 'PUT').then(r => r.status)
    console.log('le bandeau :', await poser('Le quiz du jour est en panne depuis ce matin : on répare, merci de votre patience !'))
    await serie('bandeau', { cookie: lea }, PETIT)
    await poser(null)
  }

  // L'Ivoire, en dernier : le thème se porte, et habillerait toutes les photos d'après.
  if (retenu('ivoire')) {
    const r = await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, lea, 'PUT')
    if (!r.ok) throw new Error(`L'Ivoire ne se porte pas (${r.status} ${await r.text()})`)
    await serie('ivoire', { cookie: lea }, DEUX_ECRANS)
  }

  writeFileSync(path.join(sortie, 'mesures.json'), JSON.stringify(rapport, null, 2))
  console.log(`Photos et mesures dans ${sortie}`)
  // Par le code de sortie de Node, pas `process.exit()` : ce qui vient de s'écrire part d'abord (règle `tests.md`).
  if (rate > 0) process.exitCode = 1
} finally {
  await navigateur.close()
  await banc.close()
}
