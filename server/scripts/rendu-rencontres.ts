// Les rencontres — le prototype du 18 octobre 2026, le jeu depuis le 19 : le
// départ ne les demande plus —, photographiées au téléphone (360 × 640) sur un serveur
// jetable : le départ d'un débutant au niveau 1 et son codex aux cartes
// éteintes, une carte fermée levée ; puis le départ d'une joueuse aguerrie
// — son niveau et sa jauge, ses règles au « ? », son codex, la catégorie
// fétiche et sa feuille — ; la carte de l'acte et ses cartes de route en
// petit ; une rencontre — les règles qui s'ouvrent à la première,
// l'adversaire et la question qu'il pose, ce que la réponse fera, la main
// sans un mot, une carte levée et ce qu'elle changerait, ses tas, une carte
// posée pour toute la rencontre, en haut, et levée, le pari —, puis la
// question vue et ses cartes de pendant, une bonne réponse qui fait perdre
// des points, une erreur que le bouclier pare, l'adversaire qui tombe et sa
// carte à prendre ; un coffre, le campement et la carte qu'on y retire,
// l'échoppe s'il s'en trouve une ; le gardien, vaincu, son trésor, et l'acte
// suivant ; la fin et la renommée qu'elle rapporte. Il joue juste ses
// vingt-deux premières questions — vingt d'affilée : un exploit, dit à la
// révélation et à la fin —, puis deux fois sur trois. Les objets (le codex) :
// le dos de son paquet choisi au départ, ses dos au codex ; la fiole d'une
// échoppe achetée, celle d'un coffre prise, puis levée dans la barre et bue.
// L'Ascension : ses crans au départ, celui qu'elle choisit, sur le plan.
// Les cartes améliorées (le jeu complet) : leur section des règles, le
// campement qui en améliore une — avant et après, côte à côte —, la carte
// « + » dans la main et levée, une offre qui en propose une, l'échoppe.
// Le plan fondu dans l'écran : une escale plus loin touchée sur le plan, qui se
// dit sous les cartes ; un mélange, ses catégories en emblèmes et nommées.
// Les huit familles : le départ du Sophiste et sa carte qui sème le doute —
// l'adversaire qui doute, l'aperçu, une erreur qui lui coûte quand même —,
// puis le départ du Téméraire et sa carte payée en courage.
// Le client construit d'abord (`npm run build -w client`).
//
// Léa a quatre légendaires, rangés comme gardés au bout d'expéditions
// passées — le Dragon d'Or, Janus, le Lion, le Phénix : leurs cartes sont à
// son codex — et une expédition finie, de quoi la mettre au niveau 6 — le dos
// étoilé, qu'elle choisit —, avec deux exploits : un pari de 40 écus gagné
// (Banco s'ouvre) et un gardien vaincu sans perdre de courage (le dos doré) ;
// menée au bout au cran 1 de l'Ascension, elle lui a ouvert le cran 2, où
// elle part.
//
//   npx tsx scripts/rendu-rencontres.ts [dossier] [ivoire]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { CATEGORIES } from '../../shared/categories'
import { cleDeLExpedition } from '../../shared/legendaires'
import { ecrireLeBilan } from '../../shared/codex'

const sortie = path.resolve(process.argv[2] ?? 'rendu-rencontres')
const ivoire = process.argv.includes('ivoire')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const SIENS = ['lg:dragon', 'lg:janus', 'lg:lion', 'lg:phenix']

// Quatre-vingts questions par catégorie, de toutes les difficultés : de quoi tirer trois actes et leurs gardiens.
const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })
const navigateur = await chromium.launch({ headless: true })
try {
  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, cookie, 'PUT')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const ranger = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#campagne:rendu', '', '🧭', 'rendu', 1)`)
    for (const cle of SIENS) ranger.run(id, cleDeLExpedition(cle))
  } finally {
    db.close()
  }
  // Un débutant, sans légendaire : son départ ne lui demande rien à choisir — l'invité du jour part d'office —, et son codex, au
  // niveau 1, n'a que six cartes ; les autres, éteintes, disent comment s'ouvrir.
  const novice = await inscrireProfil(banc.url, 'noe', 'Noé', '🐢')
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, novice, 'PUT')
  // Relus au démarrage : le profil sait ce qu'il a.
  await banc.redemarrer()
  {
    const sien = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
    const [n, v] = novice.split('=')
    await sien.addCookies([{ name: n, value: v, url: banc.url }])
    const p = await sien.newPage()
    const saPhoto = async (nomFichier: string, pleine = false) => {
      await p.waitForTimeout(500)
      await p.screenshot({ path: path.join(sortie, `${nomFichier}.png`), fullPage: pleine })
      console.log(path.join(sortie, `${nomFichier}.png`))
    }
    await p.goto(`${banc.url}/expedition`)
    await p.waitForSelector('.exp-codex-du-depart')
    await saPhoto('0-depart-niveau-1', true)
    await p.locator('.exp-codex-du-depart .exp-ouvrir').click()
    await p.waitForSelector('.feuille-codex')
    await saPhoto('0a-codex-niveau-1')
    await p.locator('.feuille-codex .exp-codex-fermee .exp-codex-carte').first().click()
    await p.waitForSelector('.exp-leve')
    await saPhoto('0b-carte-fermee')
    await sien.close()
  }
  // Léa a déjà joué : une expédition partie et abandonnée, sa renommée portée au niveau 6 — le pari, les fioles, les talismans, sa
  // catégorie fétiche, le dos étoilé.
  {
    const partie = (await (await ecrire(banc.url, '/api/expedition', { rencontres: true }, cookie)).json()) as { id: string }
    await ecrire(banc.url, `/api/expedition/${partie.id}/abandon`, {}, cookie)
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      base
        .prepare('UPDATE campagne_series SET bilan = ? WHERE id = ?')
        .run(ecrireLeBilan({ escales: 120, adversaires: 46, elites: 12, gardiens: 9, auBout: true, exploits: ['pari-de-40', 'gardien-intact'], ascension: 1 }), partie.id)
    } finally {
      base.close()
    }
  }
  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const [nom, valeur] = cookie.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  const photo = async (nomFichier: string, pleine = false) => {
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(sortie, `${nomFichier}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nomFichier}.png`))
  }
  const fait = new Set<string>()
  /** Une photo, la première fois seulement. */
  const unePhoto = async (nomFichier: string, pleine = false) => {
    if (fait.has(nomFichier)) return
    fait.add(nomFichier)
    await photo(nomFichier, pleine)
  }
  /** Ce qui déborde de côté : rien ne doit élargir la page (règle `css.md`) — et ce qui l'élargit, nommé. */
  const largeur = async (ou: string) => {
    const l = await page.evaluate('document.documentElement.scrollWidth')
    if (Number(l) <= 360) return
    // Les suspects ordinaires : une boîte plus large que l'écran, ou ce qui est posé en absolu au-delà du bord — un `.sr-only` dont
    // le cadre est plus haut qu'un cadre qui défile n'est pas coupé par lui (le 18 octobre 2026, le paquet de l'offre).
    const fautifs = await page.evaluate(
      `[...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > 361 && !e.closest('.carte-voile') && (r.width > 361 || ['absolute', 'fixed'].includes(getComputedStyle(e).position)) }).map(e => e.tagName.toLowerCase() + '.' + String(e.className.baseVal ?? e.className).split(' ').join('.') + ' ' + Math.round(e.getBoundingClientRect().right)).slice(0, 4).join(' · ')`,
    )
    console.error(`[déborde] ${ou} : ${l} pixels de large — ${fautifs}`)
  }

  // Le départ : les rencontres sans rien demander — c'est le jeu —, son style à choisir parmi les huit de son niveau.
  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-style')
  await largeur('le départ')
  await photo('1-depart')
  await photo('1-depart-entier', true)
  // Les règles, au « ? » d'en haut : ce que le départ ne redit plus.
  await page.locator('.exp-haut-du-depart .exp-regles').click()
  await page.waitForSelector('.feuille-regles')
  await photo('1a-regles')
  // Le jeu complet : ses cartes améliorées, la section qui les dit.
  await page.locator('#exp-regles-ameliorees').scrollIntoViewIfNeeded()
  await photo('1a-regles-ameliorees')
  await page.locator('.feuille-regles .carte-fermer').click()
  // Le codex : toutes les cartes, une page par rareté ; une carte levée, peinte.
  await page.locator('.exp-codex-du-depart .exp-ouvrir').click()
  await page.waitForSelector('.feuille-codex')
  await page.waitForTimeout(400)
  await largeur('le codex')
  // Un nom qui ne tient pas dans son bandeau, sur trois colonnes en 360 : « Concentratio ».
  const coupes = await page.evaluate(`[...document.querySelectorAll('.feuille-codex .exp-vc-nom')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent).join(', ')`)
  if (coupes) console.error(`[coupé] le codex : ${coupes}`)
  await photo('1a-codex')
  await page.locator('.feuille-codex .onglet', { hasText: 'Rares' }).click()
  await page.waitForTimeout(300)
  await photo('1a-codex-rares')
  await page.locator('.feuille-codex .exp-codex-carte').first().click()
  await page.waitForSelector('.exp-leve')
  await page.waitForTimeout(300)
  await photo('1a-codex-levee')
  await page.locator('.exp-leve .exp-reposer').click()
  // Le jeu complet : les épiques, au pourpre de l'album — l'une levée —, puis les maudites, à leur rouge.
  await page.locator('.feuille-codex .onglet', { hasText: 'Épiques' }).click()
  await page.waitForTimeout(300)
  await photo('1a-codex-epiques')
  await page.locator('.feuille-codex .exp-codex-carte').first().click()
  await page.waitForSelector('.exp-leve')
  await page.waitForTimeout(300)
  await photo('1a-codex-epique-levee')
  await page.locator('.exp-leve .exp-reposer').click()
  await page.locator('.feuille-codex .onglet', { hasText: 'Maudites' }).click()
  await page.waitForTimeout(300)
  await photo('1a-codex-maudites')
  // Au pied du codex, ses exploits : deux faits, deux à faire ; puis ses dos, tels que la pioche les porte.
  await page.locator('.feuille-codex .exp-exploits').first().scrollIntoViewIfNeeded()
  await photo('1a-codex-exploits')
  await page.locator('.feuille-codex .exp-un-dos').last().scrollIntoViewIfNeeded()
  await photo('1a-codex-dos')
  await page.locator('.feuille-codex .carte-fermer').click()
  // Son style (le 19 octobre 2026) : rien de retenu, le Rempart, le premier des siens ; elle prend l'Érudit, et sa catégorie
  // fétiche se choisit avec lui.
  await page.locator('.exp-style').scrollIntoViewIfNeeded()
  await photo('1b-style')
  await page.locator('.exp-un-style', { hasText: 'Érudit' }).click()
  await largeur('son style')
  // Un nom qui ne tient pas sur sa tuile, à trois par ligne en 360 : « Méta… », tant que le dessin était à côté.
  const stylesCoupes = await page.evaluate(`[...document.querySelectorAll('.exp-un-style span')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent).join(', ')`)
  if (stylesCoupes) console.error(`[coupé] les styles : ${stylesCoupes}`)
  await photo('1b-style-erudit')
  await page.locator('.exp-style .exp-changer').click()
  await page.waitForSelector('.feuille-fetiche')
  await photo('1b-fetiche')
  await page.locator('.exp-fetiche', { hasText: 'Histoire' }).click()
  await page.locator('.feuille-fetiche .carte-pied .btn-primary').click()
  // Le paquet qui partira : Plume et Savoir-faire à la place d'une Concentration et d'une Prudence.
  await page.locator('.exp-voir-le-paquet').click()
  await page.waitForSelector('.feuille-paquet')
  await photo('1b-paquet-erudit')
  await page.locator('.feuille-paquet .carte-fermer').click()
  // Le dos de son paquet : elle en a trois — le plus rare d'office, le doré ; elle prend l'étoilé, que le plan portera.
  await page.locator('.exp-choix-du-dos').scrollIntoViewIfNeeded()
  await page.locator('.exp-choix-du-dos [role="radio"][aria-label="le dos étoilé"]').click()
  await photo('1d-dos')
  // L'Ascension : sa victoire au cran 1 a ouvert le cran 2 — « Sans » d'office ; elle le choisit, ses deux règles dites dessous,
  // et le plan le dira à chaque pas.
  await page.locator('.exp-ascension').scrollIntoViewIfNeeded()
  await photo('1f-ascension-sans')
  await page.locator('.exp-ascension').getByRole('button', { name: 'Cran 2' }).click()
  await largeur('l’Ascension au départ')
  await photo('1f-ascension')
  // Plus d'équipe à choisir (le codex) : l'invité du jour part avec elle, ses légendaires ont ouvert leur carte à son codex.
  await page.waitForTimeout(200)
  await photo('1e-depart-pret', true)
  await page.click('.exp-depart-pied .btn-primary')
  await page.waitForSelector('.exp-plan')
  await largeur('la carte')
  await photo('2-carte')

  const ici = async (): Promise<string> => {
    if (await page.locator('.exp-plan').count()) return 'carte'
    if (await page.locator('.exp-rencontre').count()) return 'preparation'
    if (await page.locator('.exp-offre').count()) return 'offre'
    if (await page.locator('.exp-camper').count()) return 'campement'
    if (await page.locator('.exp-echoppe-page').count()) return 'echoppe'
    if (await page.locator('.exp-inconnu').count()) return 'inconnu'
    if (await page.locator('.result-banner').count()) return 'revelation'
    if (await page.locator('.ans-btn').count()) return 'question'
    if (await page.locator('.exp-vaincu').count()) return 'vaincu'
    if (await page.locator('.exp-choix').count()) return 'choix'
    if (await page.locator('.exp-fin-tete').count()) return 'fin'
    return 'autre'
  }

  /** Une carte de la main qui se joue : la première de ces clés — améliorée d'abord —, qui n'est pas éteinte ; levée, photographiée une fois, puis jouée. */
  const jouerUneCarte = async (cles: string[], photoDeLaLevee?: string): Promise<boolean> => {
    for (const cle of cles.flatMap(c => [`${c}+`, c])) {
      const carte = page.locator(`.exp-cartes .exp-face[data-carte="${cle}"]:not(.exp-face-eteinte)`).first()
      if (!(await carte.count())) continue
      await carte.click()
      await page.waitForSelector('.exp-leve')
      await page.waitForTimeout(300)
      if (photoDeLaLevee) await unePhoto(photoDeLaLevee)
      await page.locator('.exp-leve .btn-primary').click()
      await page.waitForTimeout(350)
      return true
    }
    return false
  }

  /** Répond à la question à l'écran : juste, ou une autre qui n'est pas effacée. */
  const repondre = async (juste: boolean) => {
    await page.waitForSelector('.ans-btn')
    const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '')))
    const effacees: boolean[] = await page.$$eval('.ans-btn', (els: any[]) => els.map(e => e.classList.contains('exp-effacee')))
    const proposee = (await page.locator('.exp-proposee b').count()) > 0 ? String(await page.locator('.exp-proposee b').textContent()) : null
    const bonne = proposee === null ? textes.findIndex(t => t.startsWith('Bonne')) : textes.indexOf(proposee.includes('Bonne') ? 'Vrai' : 'Faux')
    const fausse = textes.findIndex((t, i) => i !== bonne && !effacees[i])
    if ((await page.locator('.exp-consigne', { hasText: 'Double chance' }).count()) > 0) {
      await page.locator('.ans-btn').nth(juste ? bonne : fausse).click()
      await page.locator('.ans-btn').nth(textes.findIndex((t, i) => i !== bonne && i !== fausse && !effacees[i])).click()
      await page.locator('.quiz-player > .btn-primary').click()
    } else await page.locator('.ans-btn').nth(juste ? bonne : fausse).click()
    await page.waitForSelector('.result-banner')
  }

  let questions = 0
  for (let tour = 0; tour < 260; tour++) {
    const ou = await ici()
    if (ou === 'choix') {
      // Au bout : elle garde le premier, puis la fin — et la renommée qu'elle rapporte.
      await unePhoto('9-choix', true)
      await page.locator('.exp-choix-ligne').first().click()
      await page.locator('.exp-choix > .btn-primary').click()
      await page.waitForSelector('.exp-fin-tete')
      continue
    }
    if (ou === 'fin') {
      await unePhoto('9-fin', true)
      if (await page.locator('.exp-renommee').count()) {
        await page.locator('.exp-renommee').scrollIntoViewIfNeeded()
        await unePhoto('9b-renommee')
      }
      break
    }
    if (ou === 'carte') {
      if (await page.locator('.exp-panneau .exp-carte-rencontre').count()) await unePhoto('2b-carte-route')
      if (await page.locator('.exp-panneau-titre').count()) await unePhoto('6-avant-le-gardien')
      // Le plan fondu dans l'écran (le 19 octobre 2026) : une escale plus loin, touchée sur le plan, se dit sous les cartes ; un
      // mélange proposé montre ses catégories sur sa carte, et touché, les nomme.
      const plusLoin = page.locator('.exp-plan .exp-point.exp-plus-loin').first()
      if (!fait.has('2d-plan-touche') && (await plusLoin.count())) {
        await plusLoin.click()
        await largeur('le plan touché')
        await unePhoto('2d-plan-touche')
      }
      const melange = page.locator('.exp-carte-escale:has(.exp-embleme-melange)').first()
      if (!fait.has('2e-melange') && (await melange.count())) {
        await melange.click()
        await unePhoto('2e-melange')
      }
      // Le paquet, touché depuis la carte : tout ce qu'il a, et la règle du cycle.
      if (!fait.has('2c-paquet')) {
        await page.locator('.exp-panneau .exp-pioche').click()
        await page.waitForSelector('.feuille-paquet')
        await unePhoto('2c-paquet')
        await page.locator('.feuille-paquet .carte-fermer').click()
      }
      // Une rencontre d'abord, puis ce qu'il n'a pas encore vu : un coffre, une échoppe, une source.
      for (const sorte of ['question', 'coffre', 'echoppe', 'source', 'elite']) {
        const la = page.locator(`.exp-carte-escale.exp-${sorte}`).first()
        if (!fait.has(`vu-${sorte}`) && (await la.count())) {
          fait.add(`vu-${sorte}`)
          await la.click()
          break
        }
      }
      if (!(await page.locator('.exp-carte-escale[aria-pressed="true"]').count())) await page.locator('.exp-carte-escale').first().click()
      await page.locator('.exp-panneau > .btn-primary').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'preparation') {
      // Les règles, ouvertes d'elles-mêmes à la première rencontre : lues, puis « Compris » — elles ne reviennent qu'au « ? ».
      if (await page.locator('.feuille-regles').count()) {
        await unePhoto('3-regles')
        await page.locator('.feuille-regles .carte-pied .btn-primary').click()
        await page.waitForTimeout(250)
      }
      await largeur('la préparation')
      const gardien = (await page.locator('.exp-adversaire-gardien').count()) > 0
      await unePhoto(gardien ? '7-gardien-preparation' : '3-preparation')
      // Une fiole dans la barre : levée, ce qu'elle fait — bue, si elle se boit maintenant ; sinon, pourquoi.
      if (!fait.has('4d-fiole-levee') && (await page.locator('.exp-barre .exp-fiole').count())) {
        await unePhoto('4d-fiole-barre')
        await page.locator('.exp-barre .exp-fiole').first().click()
        await page.waitForSelector('.feuille-fiole')
        await unePhoto('4d-fiole-levee')
        const boire = page.locator('.feuille-fiole .btn-primary')
        if (await boire.count()) {
          await boire.click()
          await page.waitForTimeout(400)
          await unePhoto('4e-fiole-bue')
        } else await page.locator('.feuille-fiole .carte-fermer').click()
      }
      // « ← Partir » : le départ la garde, « Reprendre » la rouvre où elle en était — partir la rouvrait sur place.
      if (!fait.has('3a-partir')) {
        await page.click('a.jour-sortie')
        await page.waitForSelector('.exp-depart-pied')
        await unePhoto('3a-partir')
        await page.click('.exp-depart-pied .btn-primary')
        await page.waitForSelector('.exp-rencontre')
      }
      if (!fait.has('3b-tas')) {
        await page.locator('.exp-cartes-tas').click()
        await page.waitForSelector('.feuille-paquet')
        await unePhoto('3b-tas')
        // Ses tas en vraies cartes : la rangée défile de côté, une carte touchée se montre en grand par-dessus la feuille.
        await page.locator('.feuille-paquet .exp-rangee').last().evaluate((e: any) => e.scrollBy(200, 0))
        await unePhoto('3b-tas-defile')
        await page.locator('.feuille-paquet .exp-rangee-carte').first().click()
        await page.waitForSelector('.exp-leve')
        await unePhoto('3b-tas-carte')
        await page.locator('.exp-leve .exp-reposer').click()
        await page.locator('.feuille-paquet .carte-fermer').click()
      }
      // Une carte améliorée dans sa main (le jeu complet) : son « + » vert au coin ; levée, ce qu'elle fait en mieux.
      const amelioree = page.locator('.exp-cartes .exp-face[data-carte$="+"]').first()
      if (!fait.has('3h-amelioree-levee') && (await amelioree.count())) {
        await unePhoto('3h-main-amelioree')
        await amelioree.click()
        await page.waitForSelector('.exp-leve')
        await page.waitForTimeout(300)
        await unePhoto('3h-amelioree-levee')
        await page.locator('.exp-leve .exp-reposer').click()
      }
      // Ses cartes d'avant la question, une par une, tant qu'il en a : frapper plus fort, le bouclier, la forme, le pari.
      for (let k = 0; k < 3; k++) {
        if (!(await jouerUneCarte(['tresor', 'corser', 'simplifier', 'concentration', 'prudence', 'doubler-la-mise'], '3c-carte-levee'))) break
      }
      await unePhoto('3d-preparee')
      // Une carte posée pour toute la rencontre : en haut, comme un talisman ; touchée, elle se lève.
      if (!fait.has('3f-posee-levee') && (await page.locator('.exp-barre .exp-posees .exp-pose').count())) {
        await unePhoto('3f-posee')
        await page.locator('.exp-barre .exp-posees .exp-pose').first().click()
        await page.waitForSelector('.exp-leve')
        await unePhoto('3f-posee-levee')
        await page.locator('.exp-leve .exp-reposer').click()
      }
      // Il mise dix écus quand il le peut : l'aperçu le dit.
      const dix = page.locator('.exp-mise:not(.exp-refuse)', { hasText: '10' })
      if (await dix.count()) {
        await dix.first().click()
        await unePhoto('3e-mise')
      }
      await page.locator('.exp-voir').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'question') {
      await largeur('la question')
      await unePhoto(questions === 0 ? '4-question' : '4-question-suivante')
      // Une fiole qui se boit la question sous les yeux — la clairvoyance : une mauvaise réponse s'efface.
      if (!fait.has('4f-fiole-question') && (await page.locator('.exp-barre .exp-fiole').count())) {
        // Ce qui couvre la fiole, s'il y a quelque chose : le doigt toucherait cela, pas elle.
        const dessus = await page.evaluate(
          `(() => { const f = document.querySelector('.exp-barre .exp-fiole'); const r = f.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return f.contains(e) ? '' : (e ? e.tagName.toLowerCase() + '.' + String(e.className.baseVal ?? e.className).split(' ').join('.') : 'rien') + ' sur la fiole (' + Math.round(r.x) + ', ' + Math.round(r.y) + ', ' + Math.round(r.width) + ' × ' + Math.round(r.height) + '), défilée de ' + Math.round(scrollY) })()`,
        )
        if (dessus) {
          console.error(`[couvert] ${dessus}`)
          await photo('fiole-couverte')
          await page.screenshot({ path: path.join(sortie, 'fiole-couverte-entiere.png'), fullPage: true })
        }
        const touchee = await page
          .locator('.exp-barre .exp-fiole')
          .first()
          .click({ timeout: dessus ? 3000 : 30000 })
          .then(
            () => true,
            () => false,
          )
        if (!touchee) console.error('[couvert] la fiole ne se touche pas')
        else {
          await page.waitForSelector('.feuille-fiole')
          const boire = page.locator('.feuille-fiole .btn-primary')
          if (await boire.count()) {
            await boire.click()
            await page.waitForTimeout(400)
            await unePhoto('4f-fiole-question')
          } else await page.locator('.feuille-fiole .carte-fermer').click()
        }
      }
      await jouerUneCarte(['coup-d-oeil', 'deux-visages', 'echange'], '4b-reflexe-leve')
      if (await page.locator('.exp-visages').count()) await page.locator('.exp-visages .pill-btn').first().click()
      await unePhoto('4c-reflexe-joue')
      questions++
      // Ses vingt-deux premières justes — vingt d'affilée, un exploit —, puis deux sur trois.
      await repondre(questions <= 22 || questions % 3 !== 0)
      continue
    }
    if (ou === 'revelation') {
      const juste = (await page.locator('.result-banner.result-ok').count()) > 0
      const tombe = (await page.locator('.exp-adversaire-tombe').count()) > 0
      // Un exploit qui tombe : la révélation le dit, et ce qu'il ouvrira.
      if (await page.locator('.exp-gain-exploit').count()) await unePhoto('5f-exploit', true)
      await unePhoto(tombe ? '5c-il-tombe' : juste ? '5-juste' : '5b-faux', true)
      await page.locator('.result-banner ~ .btn-primary.btn-big').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'offre') {
      await largeur('l’offre')
      const coffre = (await page.locator('.exp-offre .exp-surtitre', { hasText: 'coffre' }).count()) > 0
      // Le trésor d'un gardien vaincu (le codex) : une carte légendaire de son codex parmi les trois.
      const tresor = (await page.locator('.exp-offre .exp-surtitre', { hasText: 'trésor' }).count()) > 0
      await unePhoto(tresor ? '7c-tresor' : coffre ? '8-coffre' : '5d-carte-a-prendre', true)
      // Dès l'acte 2 (le jeu complet), une carte offerte peut arriver améliorée : son « + » vert, déjà.
      if (await page.locator('.exp-offre .exp-a-prendre-carte[data-carte$="+"]').count()) await unePhoto('5g-offre-amelioree', true)
      // La fiole d'un coffre, à la place d'une carte, s'il lui reste une place pour elle.
      const fiole = page.locator('.exp-offre-fiole:not([aria-disabled="true"])')
      if (await fiole.count()) await fiole.click()
      else await page.locator('.exp-a-prendre-carte, .exp-offre-ligne').first().click()
      await unePhoto(tresor ? '7c-tresor-choisie' : coffre ? '8-coffre-choisie' : '5e-carte-choisie', true)
      await page.locator('.exp-offre .exp-depart-pied .btn-primary').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'campement') {
      await unePhoto('6b-campement')
      // Le courage au plus haut, le repos ne donne rien : le campement propose d'office d'améliorer une carte (le jeu complet). La
      // première fois, il améliore Concentration — sinon la première — et regarde ce qu'elle deviendra, côte à côte ; ensuite, il
      // retire une carte, parmi ses vraies cartes. Sous son plafond, il se repose.
      const repos = (await page.locator('.exp-camper .exp-choix-ligne[aria-checked="true"]', { hasText: 'Te reposer' }).count()) > 0
      if (!repos && !fait.has('6d-campement-ameliorer') && (await page.locator('.exp-camper .exp-rangee-carte').count())) {
        await largeur('le campement')
        await unePhoto('6c-campement-ameliorer-choix')
        const concentration = page.locator('.exp-camper .exp-rangee-carte[data-carte="concentration"]')
        await ((await concentration.count()) ? concentration : page.locator('.exp-camper .exp-rangee-carte')).first().click()
        await page.waitForSelector('.exp-avant-apres')
        await largeur('l’amélioration au campement')
        await unePhoto('6d-campement-ameliorer', true)
      } else if (!repos) {
        await page.locator('.exp-camper .exp-choix-ligne', { hasText: 'Retirer' }).click()
        if (await page.locator('.exp-camper .exp-rangee-carte').count()) {
          await page.locator('.exp-camper .exp-rangee-carte').first().click()
          await unePhoto('6e-campement-retirer')
        }
      }
      if (await page.locator('.exp-a-retirer').count()) await page.locator('.exp-a-retirer .pill-btn').first().click()
      await page.locator('.exp-camper .exp-depart-pied .btn-primary').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'echoppe') {
      await unePhoto('8b-echoppe', true)
      // Sa fiole, achetée si elle se vend et qu'elle a de quoi la payer : la barre la porte.
      const fiole = page.locator('.exp-echoppe-page .exp-offre-ligne', { hasText: 'Fiole' })
      if (!fait.has('8d-fiole-achetee') && (await fiole.count())) {
        await fiole.first().click()
        const acheter = page.locator('.exp-echoppe-page .exp-depart-pied .btn-primary')
        if ((await acheter.getAttribute('aria-disabled')) !== 'true') {
          await acheter.click()
          await page.waitForTimeout(400)
          await unePhoto('8d-fiole-achetee')
        }
      }
      // Une carte améliorée (le jeu complet) : celles qui le peuvent en rangée, la choisie avant et après — achetée s'il en a de quoi.
      const ameliorer = page.locator('.exp-echoppe-page .exp-offre-ligne:not([aria-disabled="true"])', { hasText: 'Améliorer une carte' })
      if (!fait.has('8e-echoppe-ameliorer') && (await ameliorer.count())) {
        await ameliorer.click()
        if (await page.locator('.exp-echoppe-page .exp-rangee-carte').count()) {
          await page.locator('.exp-echoppe-page .exp-rangee-carte').first().click()
          await page.waitForSelector('.exp-avant-apres')
          await largeur('l’amélioration à l’échoppe')
          await unePhoto('8e-echoppe-ameliorer', true)
          const acheter = page.locator('.exp-echoppe-page .exp-depart-pied .btn-primary')
          if ((await acheter.getAttribute('aria-disabled')) !== 'true') {
            await acheter.click()
            await page.waitForTimeout(400)
          }
        }
      }
      await page.locator('.exp-echoppe-page .btn-ghost').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'inconnu' || ou === 'vaincu') {
      await unePhoto(ou === 'vaincu' ? '7b-gardien-vaincu' : '8c-inconnu')
      await page.locator('.btn-primary.btn-big').last().click()
      await page.waitForTimeout(300)
      continue
    }
    console.error(`[rendu] écran inconnu au tour ${tour}`)
    break
  }

  // Les huit familles (le 19 octobre 2026) : le Sophiste sème le doute — sa carte levée, le doute sur l'adversaire et dans
  // l'aperçu, puis une erreur qui lui coûte quand même —, le Téméraire paie en courage — ce que sa carte coûte, levée, puis le
  // courage qu'elle a pris. Chacun part de son style, joue jusqu'à ses photos, puis abandonne.
  for (const [style, siennes, n] of [
    ['Sophiste', ['insinuation', 'rumeur'], '10'],
    ['Téméraire', ['fougue', 'cicatrices'], '11'],
  ] as const) {
    const enRoute = (await (await fetch(`${banc.url}/api/expedition`, { headers: { Cookie: cookie } })).json()) as { expedition: { id: string } | null }
    if (enRoute.expedition) await ecrire(banc.url, `/api/expedition/${enRoute.expedition.id}/abandon`, {}, cookie)
    await page.goto(`${banc.url}/expedition`)
    await page.waitForSelector('.exp-style')
    await page.locator('.exp-un-style', { hasText: style }).click()
    await page.locator('.exp-style').scrollIntoViewIfNeeded()
    await largeur(`le départ du ${style}`)
    await photo(`${n}-depart`)
    await page.click('.exp-depart-pied .btn-primary')
    await page.waitForSelector('.exp-plan')
    let jouee = false
    let verdict = false
    for (let tour = 0; tour < 120 && !verdict; tour++) {
      const ou = await ici()
      if (ou === 'carte') {
        const adversaire = page.locator('.exp-carte-escale.exp-question, .exp-carte-escale.exp-elite').first()
        await ((await adversaire.count()) ? adversaire : page.locator('.exp-carte-escale').first()).click()
        await page.locator('.exp-panneau > .btn-primary').click()
      } else if (ou === 'preparation') {
        if (await page.locator('.feuille-regles').count()) await page.locator('.feuille-regles .carte-pied .btn-primary').click()
        if (!jouee && (await jouerUneCarte([...siennes], `${n}a-carte-levee`))) {
          jouee = true
          await largeur(`la préparation du ${style}`)
          await photo(`${n}b-joue`)
          await photo(`${n}b-joue-entier`, true)
        }
        await page.locator('.exp-voir').click()
      } else if (ou === 'question') {
        // Le Sophiste se trompe, son doute semé : l'adversaire perd quand même ; le Téméraire a juste.
        await repondre(!(jouee && style === 'Sophiste'))
      } else if (ou === 'revelation') {
        if (jouee) {
          await photo(`${n}c-verdict`, true)
          verdict = true
        } else await page.locator('.result-banner ~ .btn-primary.btn-big').click()
      } else if (ou === 'offre') {
        await page.locator('.exp-a-prendre-carte, .exp-offre-ligne').first().click()
        await page.locator('.exp-offre .exp-depart-pied .btn-primary').click()
      } else if (ou === 'campement') {
        const repos = page.locator('.exp-camper .exp-choix-ligne', { hasText: 'Te reposer' })
        if (await repos.count()) await repos.click()
        await page.locator('.exp-camper .exp-depart-pied .btn-primary').click()
      } else if (ou === 'echoppe') await page.locator('.exp-echoppe-page .btn-ghost').click()
      else if (ou === 'inconnu' || ou === 'vaincu') await page.locator('.btn-primary.btn-big').last().click()
      else break
      await page.waitForTimeout(300)
    }
    if (!verdict) console.error(`[rendu] le ${style} n'a jamais eu ${siennes.join(' ni ')} en main`)
  }
  await contexte.close()
} finally {
  await navigateur.close()
  await banc.close()
}
