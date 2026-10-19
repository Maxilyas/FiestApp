// Maquette — le quiz du jour et le défi de la semaine, en onglets sur l'accueil.
// Un serveur jetable : neuf joueurs ont relevé le défi de la semaine, six ont
// joué le quiz du jour ce matin, et Léa le joue depuis douze jours sans avoir
// jamais ouvert la campagne — le cas où, aujourd'hui, le défi ne paraît nulle
// part sur son accueil (`defiDAccueil` ne dit rien à qui n'a jamais joué la
// campagne). Puis l'accueil photographié au téléphone, en 360 × 640, tel
// qu'il est et sous les deux propositions du prototype (`prototype.patch`,
// `quizz.maquette` : `tuile`, `carte`) : le défi à relever, commencé, relevé,
// le quiz joué ; la page du défi à elle, la campagne à trois onglets.
//
//   git apply retours/2026-10-19/jour-et-defi/maquette/prototype.patch && npm run build -w client
//   cd server && npx tsx ../retours/2026-10-19/jour-et-defi/maquette/photos.ts [dossier] [avant|tout]
//
// `avant` ne photographie que l'accueil et le défi d'aujourd'hui : il se passe du patch.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../../../../server/test/banc'
import { ProfileStore } from '../../../../server/src/auth/profiles'
import { CATEGORIES } from '../../../../shared/categories'

const REPO = fileURLToPath(new URL('../../../..', import.meta.url))
const Database = createRequire(path.join(REPO, 'server/package.json'))('better-sqlite3')
const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.resolve(process.argv[2] ?? path.join(ici, 'captures'))
const quoi = process.argv[3] ?? 'tout'
mkdirSync(sortie, { recursive: true })
ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

// Mercredi 21 octobre 2026, 10 h à Paris : le défi est ouvert depuis lundi.
const horloge = { t: Date.UTC(2026, 9, 21, 8, 0) }
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

/** Joue sa tentative du défi par l'API : `justes` bonnes réponses, puis des fautes — jusqu'à la fin, ou `arret` réponses. */
async function releverLeDefi(cookie: string, justes: number, arret = Infinity) {
  const s = (await (await ecrire(banc.url, '/api/campagne/defi', {}, cookie)).json()) as any
  const d = db()
  const qs = JSON.parse((d.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(s.id) as any).questions)
  const deja = (d.prepare('SELECT position FROM campagne_series WHERE id = ?').get(s.id) as any).position as number
  d.close()
  let fin = false
  for (let i = deja; !fin && i < arret; i++) {
    const q = qs[i]
    const r = (await (await ecrire(banc.url, `/api/campagne/serie/${s.id}/reponse`, { index: i, choix: i < justes ? q.bonne : (q.bonne + 1) % q.reponses.length }, cookie)).json()) as any
    fin = r.finie
  }
}

/** Joue le quiz du jour d'aujourd'hui par l'API, comme `qg-jour.test.ts` : juste quand `juste(i)`. */
async function jouerLeJour(cookie: string, juste: (i: number) => boolean) {
  const poster = async (chemin: string, corps: unknown = {}) => (await (await ecrire(banc.url, chemin, corps, cookie)).json()) as any
  let etat = await poster('/api/jour/commencer')
  const d = db()
  const questions = JSON.parse((d.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as any).questions)
  d.close()
  while (etat.question) {
    const i = etat.question.index
    await poster('/api/jour/repondre', { jour: etat.jour, index: i, choix: juste(i) ? questions[i].bonne : (questions[i].bonne + 1) % questions[i].reponses.length })
    etat = await poster('/api/jour/suivante')
  }
}

try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
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

  // Douze jours de quiz du jour pour Léa, jusqu'à hier ; la salle aussi, pour ses places.
  {
    const d = db()
    const tirage = d.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`)
    const partie = d.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, ?, 10, NULL, ?, ?, ?, 0)`,
    )
    const questions = JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 })))
    for (let j = 9; j <= 20; j++) {
      const jour = `2026-10-${String(j).padStart(2, '0')}`
      const midi = Date.UTC(2026, 9, j, 10, 0)
      tirage.run(jour, questions)
      partie.run(idDe('lea'), jour, midi, 1180 + ((j * 37) % 200), 7, midi + 120_000)
      autres.forEach(([login], k) => {
        if ((j + k) % 3 !== 0) partie.run(idDe(login), jour, midi, 600 + ((j * 53 + k * 97) % 900), 6, midi + 120_000)
      })
    }
    d.close()
  }
  // Neuf joueurs ont relevé le défi de la semaine.
  for (const [login, , , justes] of autres) await releverLeDefi(cookies[login], justes)
  // Six ont déjà joué le quiz du jour ce matin, par l'API : écrites en base, leurs parties échappaient aux comptes gardés.
  for (const [k, [login]] of autres.slice(0, 6).entries()) await jouerLeJour(cookies[login], i => i < 9 - k)
  await new Promise(r => setTimeout(r, 1500))

  const photographe = async (maquette: string | null) => {
    // Le mouvement réduit fige « À la une » : sans lui, chaque photo montrait une autre affiche.
    const ctx = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
    const [nom, valeur] = lea.split('=')
    await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
    await ctx.addInitScript((m: string | null) => {
      try {
        if (m) localStorage.setItem('quizz.maquette', m)
        else localStorage.removeItem('quizz.maquette')
      } catch {}
    }, maquette)
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    const photo = async (n: string, pleine = false) => {
      await page.waitForTimeout(900)
      // Page entière : la barre du menu, fixe, se poserait au milieu ; elle s'efface.
      const style = pleine ? await page.addStyleTag({ content: '.menu-barre { display: none !important; }' }) : null
      await page.screenshot({ path: path.join(sortie, `${n}.png`), fullPage: pleine })
      if (style) await style.evaluate((s: any) => s.remove())
      console.log(path.join(sortie, `${n}.png`))
    }
    const accueil = async () => {
      await page.goto(`${banc.url}/`)
      await page.waitForSelector('.accueil-gestes')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1200)
    }
    return { ctx, page, photo, accueil }
  }

  // 0. Aujourd'hui : l'accueil, puis le défi au troisième onglet de la campagne.
  {
    const { ctx, page, photo, accueil } = await photographe(null)
    await accueil()
    await photo('0-avant-accueil')
    await photo('0-avant-accueil-entiere', true)
    await page.goto(`${banc.url}/campagne#defi`)
    await page.waitForSelector('.defi-heros')
    await page.waitForLoadState('networkidle')
    await photo('0-avant-defi')
    await ctx.close()
  }

  if (quoi !== 'avant') {
    const tuile = await photographe('tuile')
    const carte = await photographe('carte')
    const lesDeux = async (suffixe: string, onglet: 'jour' | 'defi') => {
      for (const [nom, p] of [['1-tuile', tuile], ['2-carte', carte]] as const) {
        await p.accueil()
        if (onglet === 'defi') await p.page.getByRole('tab', { name: /Défi de la semaine/ }).click()
        await p.photo(`${nom}-${onglet}${suffixe}`)
      }
    }

    // 1. Le quiz du jour d'office, puis l'onglet du défi, à relever.
    await lesDeux('', 'jour')
    await carte.photo('2-carte-jour-entiere', true)
    await tuile.photo('1-tuile-jour-entiere', true)
    await lesDeux('', 'defi')
    // La page du défi, à elle : sans les onglets de la campagne ; la campagne, à trois onglets.
    await carte.page.goto(`${banc.url}/campagne#defi`)
    await carte.page.waitForSelector('.defi-heros')
    await carte.page.waitForLoadState('networkidle')
    await carte.photo('3-page-du-defi')
    await carte.page.goto(`${banc.url}/campagne`)
    await carte.page.waitForSelector('.onglets-campagne')
    await carte.page.waitForLoadState('networkidle')
    await carte.photo('3-campagne-trois-onglets')

    // 2. Léa commence le défi : quatre bonnes réponses, puis elle s'arrête.
    await releverLeDefi(lea, 8, 4)
    await lesDeux('-a-finir', 'defi')
    // 3. Elle le finit : huit bonnes réponses en tout.
    await releverLeDefi(lea, 8)
    await lesDeux('-releve', 'defi')
    // 4. Elle joue le quiz du jour d'aujourd'hui : huit bonnes réponses.
    await jouerLeJour(lea, i => i < 8)
    await lesDeux('-joue', 'jour')
    await tuile.ctx.close()
    await carte.ctx.close()
  }
} finally {
  await navigateur.close()
  await banc.close()
}
