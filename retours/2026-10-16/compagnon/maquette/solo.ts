// Maquette — le compagnon qui suit, hors des soirées : l'accueil, la carte, la
// loge, la boutique, le quiz du jour, un duel, photographiés au téléphone de
// Léa (390 × 844) sur un serveur jetable, le compagnon posé par-dessus.
//
//   cd server && npx tsx ../retours/2026-10-16/compagnon/maquette/solo.ts [decouverte] [--seulement=accueil,carte,…]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseDEssai, demarrer, ecrire, inscrireProfil, patienter, ADMIN } from '../../../../server/test/banc'
import { xpDuNiveau } from '../../../../shared/profil'
import { CATEGORIES } from '../../../../shared/categories'
import { VIES } from '../../../../shared/campagne'
import { hautFait, palierDe, titreDePalier } from '../../../../shared/hautsfaits'
import { ProfileStore, VERSION_BAREME } from '../../../../server/src/auth/profiles'
import { CampagneStore } from '../../../../server/src/core/campagne'

const REPO = fileURLToPath(new URL('../../../..', import.meta.url))
const Database = createRequire(path.join(REPO, 'server/package.json'))('better-sqlite3')
const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.join(ici, 'captures')
mkdirSync(sortie, { recursive: true })
const DECOUVERTE = process.argv.includes('decouverte')
const SEULEMENT = process.argv.find(a => a.startsWith('--seulement='))?.slice('--seulement='.length).split(',')
const fait = (n: string) => !SEULEMENT || SEULEMENT.includes(n)

const fichiers = readdirSync(path.join(REPO, 'client/public/compagnons'))
const perso = (cle: string) => '/compagnons/' + fichiers.find(f => f.startsWith(`${cle}-perso-512.`))
const H = (cle: string, humeur = 'neutre') => `/mq-humeurs/${cle}-${humeur}.webp`
const LOUP = { louveteau: H('loup-louveteau'), jeune: H('loup-jeune'), adulte: H('loup-adulte'), ultime: H('loup-ultime') }
const TORTUE = { jeune: H('tortue-jeune') }
const CHAT = { chaton: H('chat-chaton', 'ravi') }
void perso

// Automate trouve cinq bonnes réponses : Léa le bat.
CampagneStore.reponsesDAutomate = () => [...Array(5).fill(true), ...Array(VIES).fill(false)]
ProfileStore.tirageEclat = () => false

const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')
const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })
const navigateur = await chromium.launch({ headless: true })
try {
  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🐸')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  {
    // Léa : niveau 14, le Phénix, le loup Nox (412 bonnes réponses en sa
    // compagnie : loup adulte) et la tortue Caillou, restée à la maison.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    // Dans la ligne du rattrapage, que ni le quiz du jour ni la campagne ne réécrivent.
    db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#rattrapage', '', ?, ?, 1)`).run(id, xpDuNiveau(14), JSON.stringify({ v: VERSION_BAREME }))
    db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xpDuNiveau(14), id)
    const badge = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, 'une-soiree-d-avant', ?, ?, ?, 1)`)
    for (const cle of ['hf:phenix', 'hf:sans-faute:1', 'hf:oracle']) {
      const palier = palierDe(cle)
      const h = palier ? palier.hautFait : hautFait(cle)!
      badge.run(id, cle, espace, h.emoji, palier ? titreDePalier(palier.hautFait, palier.palier) : h.title)
    }
    db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, 1)').run(id, 'foret', 5)
    const treize = Date.UTC(2026, 9, 13, 18)
    db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 1000, ?, ?)').run(id, 'loup', 2, treize)
    db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 0, ?, ?)').run(id, 'tortue', 1, treize + 3600_000)
    for (const [serie, n, compagnon] of [
      ['avec-le-loup', 412, 'loup'],
      ['avec-la-tortue', 160, 'tortue'],
      ['sans-compagnon', 900, null],
    ] as const) {
      db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le) VALUES (?, ?, '[]', ?, 3, ?, 1, 2)`).run(serie, id, n, n)
      const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon) VALUES (?, ?, ?, 0, 1, 2, ?)')
      for (let i = 0; i < n; i++) reponse.run(serie, i, `${serie}-${i}`, compagnon)
    }
    db.close()
    await banc.redemarrer()
  }
  const r = await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:phenix' }, cookie, 'PUT')
  if (!r.ok) throw new Error(`le Phénix refusé (${r.status})`)

  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const [nom, valeur] = cookie.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  await contexte.addInitScript({ path: path.join(ici, 'page.js') })
  // Les humeurs peintes, servies à la page depuis le dossier de la maquette.
  await contexte.route('**/mq-humeurs/**', (route: any) =>
    route.fulfill({ path: path.join(ici, 'humeurs', decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!)), contentType: 'image/webp' }),
  )
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  const aller = async (adresse: string) => {
    // Une adresse neuve à chaque fois : un changement de dièse gardait la carte ouverte.
    await page.goto('about:blank')
    await page.goto(`${banc.url}${adresse}`)
  }

  async function photo(n: string, pleine = false) {
    await page.waitForTimeout(700)
    await page.evaluate('document.activeElement?.blur?.()')
    await page.screenshot({ path: path.join(sortie, `${n}.png`), fullPage: pleine })
    console.log(`  ${n}`)
  }
  async function releve(n: string, sel = '.av') {
    if (!DECOUVERTE) return
    const boites = await page.evaluate(
      `(() => [...document.querySelectorAll(${JSON.stringify(sel)})].map(e => { const r = e.getBoundingClientRect(); const p = e.parentElement; return { cls: typeof e.className === 'string' ? e.className : '', parent: p && typeof p.className === 'string' ? p.className : '', t: (e.textContent || '').trim().slice(0, 60), x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) } }))()`,
    )
    writeFileSync(path.join(sortie, `${n}.json`), JSON.stringify(boites, null, 1))
  }
  async function mq(fn: string, ...args: unknown[]) {
    try {
      return await page.evaluate(`window.__mq.${fn}(${args.map(a => JSON.stringify(a)).join(', ')})`)
    } catch (e) {
      console.log(`  (maquette, ${fn} : ${(e as Error).message.split('\n')[0]})`)
    }
  }
  async function avecLui(n: string, poses: () => Promise<unknown>, pleine: boolean | number = false) {
    // Un nombre : la hauteur d'un téléphone plus grand, le temps de la photo — une photo
    // de toute la page laissait la barre du menu au milieu de ce que la maquette ajoute.
    if (typeof pleine === 'number') await page.setViewportSize({ width: 390, height: pleine })
    await poses()
    await patienter(700)
    await page.evaluate('document.activeElement?.blur?.()')
    await page.screenshot({ path: path.join(sortie, `${n}.png`), fullPage: pleine === true })
    console.log(`  ${n}`)
    await mq('nettoyer')
    if (typeof pleine === 'number') await page.setViewportSize({ width: 390, height: 844 })
  }

  // ── L'accueil : il se tient près d'elle, en tête ──────────────────────────
  if (fait('accueil')) {
    await aller('/')
    await page.waitForSelector('button.identite-ligne')
    await patienter(1800)
    await photo('solo-accueil-brut')
    await avecLui('solo-accueil', () =>
      mq('poserApres', { apres: '.identite-ligne .player-avatar', largeur: 46, marge: -6, src: LOUP.adulte, h: 64, sol: '.identite-ligne', dy: 6, miroir: true }),
    )
  }

  // ── Sa carte : comme la salle la voit ───────────────────────────────────
  if (fait('carte')) {
    await aller('/profil')
    await page.waitForSelector('.profil-boutons .gros-compte')
    await page.click('button.identite-ligne')
    await page.waitForSelector('.carte-joueur .carte-tete')
    await patienter(1200)
    await photo('solo-carte-brut')
    await avecLui('solo-carte', async () => {
      await mq('poser', { ancre: '.carte-joueur .carte-tete', place: 'dedansDroite', src: LOUP.adulte, h: 76, dx: -8, dy: 6, miroir: true, z: 5000 })
      await mq('ligneSous', '.carte-joueur .carte-tete', 'Avec <b style="color:var(--ink,#f3ece2);font-weight:600">Nox</b>, son loup adulte, depuis le 13 octobre')
    })
  }

  // ── La loge : une pièce de plus, « Compagnon » ──────────────────────────
  if (fait('loge')) {
    await aller('/profil#avatar')
    await page.waitForSelector('.loge-panneau .loge-page-avatars')
    await patienter(1200)
    await photo('solo-loge-brut')
    await releve('solo-loge-brut', '.loge-carte *, .loge-pieces *, .loge-qui')
    const loge = async () => {
      await mq('logeCompagnon', {
        icone: LOUP.adulte,
        qui: 'La salle le voit à côté de ton avatar : à ton arrivée, au podium, sur ta carte.',
        compagnons: [
          { nom: 'Nox', quoi: 'loup adulte', src: LOUP.adulte, h: 62, etat: 'Te suit', on: true },
          { nom: 'Caillou', quoi: 'jeune tortue', src: TORTUE.jeune, h: 52, etat: 'À la maison' },
          { nom: 'Personne', quoi: 'seule ce soir' },
        ],
        titreFormes: 'La forme qu’il montre',
        formes: [
          { nom: 'Louveteau', src: LOUP.louveteau },
          { nom: 'Jeune loup', src: LOUP.jeune },
          { nom: 'Loup adulte', src: LOUP.adulte, on: true },
          { nom: 'Encore 88', src: LOUP.ultime, ferme: true },
        ],
        jauge: { fait: 412, total: 500, texte: '412 bonnes réponses ensemble · le loup des étoiles à 500' },
        nom: 'Nox',
        aideNom: 'La salle le lit à ton arrivée. Seize lettres au plus ; l’administrateur peut le changer, comme un prénom.',
      })
      await mq('poser', { ancre: '.loge-carte .loge-carte-haut', place: 'dedansDroite', src: LOUP.adulte, h: 70, dx: -12, dy: 2, miroir: true })
    }
    await avecLui('solo-loge', loge)
    await avecLui('solo-loge-pleine', loge, 1240)
  }

  // ── La boutique : l'adoption, son nom d'abord ───────────────────────────
  if (fait('boutique')) {
    await aller('/boutique#compagnon-chat')
    await page.waitForSelector('.rayon-compagnons')
    await patienter(1600)
    await photo('solo-boutique-brut')
    await avecLui('solo-boutique', async () => {
      await mq(
        'changerTexte',
        'p@@Chacun grandit',
        'Il te suit partout, à côté de ton avatar, et grandit avec tes bonnes réponses : 100, 300, puis 500. Une forme atteinte ne se perd jamais.',
      )
      await mq('feuilleAdoption', {
        src: CHAT.chaton,
        qui: 'Le Chat des lanternes',
        titre: 'Comment s’appellera-t-il ?',
        nom: 'Mochi',
        idees: ['Mochi', 'Lampion', 'Grelot', 'Pixel'],
        suivre: 'Il me suit dès maintenant',
        suivreAide: 'Nox rentre à la maison : tu changes quand tu veux, dans la loge.',
        bouton: 'L’adopter · 🎊 1000',
      })
    })
  }

  // ── Le quiz du jour : il réagit à chaque révélation ─────────────────────
  if (fait('jour')) {
    await aller('/jour')
    await page.waitForSelector('.jour-heros')
    await patienter(800)
    await page.locator('.jour-heros .btn-primary').click()
    let juste = false
    let ratee = false
    for (let i = 0; i < 12; i++) {
      await page.waitForSelector('.ans-btn, .fin-tete', { timeout: 15000 })
      if (await page.locator('.fin-tete').count()) break
      for (let essai = 0; essai < 20 && !(await page.locator('.result-banner').count()); essai++) {
        await page.waitForTimeout(500)
        const reponses = page.locator('.ans-btn')
        const n = await reponses.count()
        if (n > 0) await reponses.nth(i % n).click({ timeout: 2000 }).catch(() => {})
      }
      await page.waitForSelector('.result-banner')
      await patienter(2600)
      // Sous la carte de la réponse : au-dessus, la question est déjà là.
      const sous = (humeur: string) => () =>
        mq('poser', { ancre: '.result-banner', place: 'sous', src: H('loup-adulte', humeur), h: 100, humeur, miroir: true, dx: -34, dy: 34 })
      if (!juste && (await page.locator('.result-banner.result-ok').count())) {
        juste = true
        await avecLui('solo-jour-juste', sous('ravi'))
      } else if (!ratee && (await page.locator('.result-banner.result-ko').count())) {
        ratee = true
        await avecLui('solo-jour-ratee', sous('depite'))
      }
      await page.locator('.btn-primary.btn-big').click()
    }
    await page.waitForSelector('.fin-tete')
    await patienter(2500)
    await photo('solo-jour-fin-brut', true)
    await avecLui(
      'solo-jour-fin',
      () =>
        mq('carteJauge', {
          ou: '.card.gains',
          label: 'Ton compagnon',
          src: H('loup-adulte', 'ravi'),
          h: 74,
          titre: 'Nox · +4 ensemble',
          texte: 'Il a fêté chacune de tes bonnes réponses.',
          jauge: { fait: 416, total: 500, texte: '416 / 500 · encore 84 avant le loup des étoiles' },
        }),
      true,
    )
  }

  // ── Un duel : la carte du verdict ───────────────────────────────────────
  if (fait('duel')) {
    await aller('/duels')
    await page.getByRole('button', { name: /Un duel contre Automate|Reprendre ton duel contre/ }).click()
    await page.waitForSelector('.feuille-du-de')
    await page.locator('.feuille-du-de').getByRole('button', { name: 'Jouer le duel' }).click()
    await page.waitForSelector('.ans-btn')
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const ligne = db
      .prepare(`SELECT questions, position FROM campagne_series WHERE profile_id = ? AND mode = 'rencontre' AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1`)
      .get(id) as { questions: string; position: number }
    db.close()
    const qs = JSON.parse(ligne.questions) as { bonne: number; reponses: string[] }[]
    for (let i = ligne.position; ; i++) {
      await page.waitForSelector('.ans-btn')
      const q = qs[i]
      await page.locator('.ans-btn').nth(i < 8 ? q.bonne : (q.bonne + 1) % q.reponses.length).click()
      const suite = page.getByRole('button', { name: /Question suivante|Voir qui a gagné|Voir mon duel/ })
      await suite.waitFor()
      const derniere = !(await suite.textContent())?.includes('Question suivante')
      await suite.click()
      if (derniere) break
    }
    await page.waitForSelector('.duels-verdict')
    await page.waitForSelector('.duels-carte3d.ouverte')
    await patienter(1600)
    await photo('solo-duel-brut')
    await releve('solo-duel-brut', '.duels-verdict *')
    await avecLui('solo-duel', () =>
      mq('poser', { ancre: '.duels-face-avatar.toi', place: 'gauche', src: H('loup-adulte', 'triomphe'), h: 78, dx: 18, dy: 14, humeur: 'triomphe' }),
    )
  }
} finally {
  await navigateur.close()
  await banc.close()
}
console.log(`Captures dans ${sortie}`)
process.exit(0)
