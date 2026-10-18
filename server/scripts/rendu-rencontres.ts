// Le prototype des rencontres (les versions 5 et 6 du départ d'une
// expédition, le 18 octobre 2026), photographié au téléphone (360 × 640) sur
// un serveur jetable : le départ et son interrupteur, ses règles au « ? », la
// catégorie fétiche et sa feuille, l'équipe et les cartes des rencontres
// dépliées ; la carte de l'acte et ses cartes de route en petit ; une
// rencontre — les règles qui s'ouvrent à la première, l'adversaire et la
// question qu'il pose, ce que la réponse fera, la main sans un mot, une carte
// levée et ce qu'elle changerait, ses tas, une carte posée pour toute la
// rencontre, en haut, et levée, le pari —, puis la question vue et ses cartes
// de pendant, une bonne réponse qui fait perdre des points, une erreur que le
// bouclier pare, l'adversaire qui tombe et sa carte à prendre ; un coffre, le
// campement et la carte qu'on y retire, l'échoppe s'il s'en trouve une ; le
// gardien, vaincu, et l'acte suivant. Il joue juste deux fois sur trois.
// Le client construit d'abord (`npm run build -w client`).
//
// Léa a quatre légendaires, rangés comme gardés au bout d'expéditions
// passées : elle part avec le Dragon d'Or et Janus — le Flambeur et le
// Métamorphe — ; le Lion et le Phénix restent à choisir.
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
  // Un débutant, sans légendaire : son départ ne lui demande rien à choisir — l'invité du jour part d'office.
  const novice = await inscrireProfil(banc.url, 'noe', 'Noé', '🐢')
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, novice, 'PUT')
  // Relus au démarrage : le profil sait ce qu'il a.
  await banc.redemarrer()
  {
    const sien = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
    const [n, v] = novice.split('=')
    await sien.addCookies([{ name: n, value: v, url: banc.url }])
    const p = await sien.newPage()
    await p.goto(`${banc.url}/expedition`)
    await p.waitForSelector('.exp-prototype')
    await p.waitForTimeout(500)
    await p.screenshot({ path: path.join(sortie, '0-depart-sans-legendaire.png'), fullPage: true })
    console.log(path.join(sortie, '0-depart-sans-legendaire.png'))
    await sien.close()
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

  // Le départ : le prototype proposé d'office, sa catégorie fétiche à choisir.
  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-prototype')
  await photo('1-depart')
  await photo('1-depart-entier', true)
  // Les règles, au « ? » d'en haut : ce que le départ ne redit plus.
  await page.locator('.exp-haut-du-depart .exp-regles').click()
  await page.waitForSelector('.feuille-regles')
  await photo('1a-regles')
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
  await page.locator('.feuille-codex .carte-fermer').click()
  await page.locator('.exp-prototype .exp-changer').click()
  await page.waitForSelector('.feuille-fetiche')
  await photo('1b-fetiche')
  await page.locator('.exp-fetiche', { hasText: 'Histoire' }).click()
  await page.locator('.feuille-fetiche .carte-pied .btn-primary').click()
  // L'équipée : le Dragon et Janus, leurs cartes et leurs familles ; toutes les cartes des rencontres dépliées.
  await page.locator('.exp-equipee .exp-changer').click()
  await page.waitForSelector('.feuille-equipee')
  const partants = page.locator('.exp-equipable[aria-pressed="true"]')
  while (await partants.count()) await partants.first().click()
  for (const n of ['Dragon', 'Janus']) await page.locator('.exp-equipable', { hasText: n }).first().click()
  await photo('1c-equipee')
  await page.click('.exp-tous')
  await page.locator('#exp-toutes-les-cartes').scrollIntoViewIfNeeded()
  await photo('1d-toutes-les-cartes')
  await page.locator('.feuille-equipee .carte-pied .btn-primary').click()
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

  /** Une carte de la main qui se joue : la première de ces clés, qui n'est pas éteinte ; levée, photographiée une fois, puis jouée. */
  const jouerUneCarte = async (cles: string[], photoDeLaLevee?: string): Promise<boolean> => {
    for (const cle of cles) {
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
    if (ou === 'fin' || ou === 'choix') {
      await unePhoto(`9-${ou}`, true)
      break
    }
    if (ou === 'carte') {
      if (await page.locator('.exp-panneau .exp-carte-rencontre').count()) await unePhoto('2b-carte-route')
      if (await page.locator('.exp-panneau-titre').count()) await unePhoto('6-avant-le-gardien')
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
      await jouerUneCarte(['coup-d-oeil', 'deux-visages', 'echange'], '4b-reflexe-leve')
      if (await page.locator('.exp-visages').count()) await page.locator('.exp-visages .pill-btn').first().click()
      await unePhoto('4c-reflexe-joue')
      questions++
      await repondre(questions % 3 !== 0)
      continue
    }
    if (ou === 'revelation') {
      const juste = (await page.locator('.result-banner.result-ok').count()) > 0
      const tombe = (await page.locator('.exp-adversaire-tombe').count()) > 0
      await unePhoto(tombe ? '5c-il-tombe' : juste ? '5-juste' : '5b-faux', true)
      await page.locator('.result-banner ~ .btn-primary.btn-big').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'offre') {
      await largeur('l’offre')
      const coffre = (await page.locator('.exp-offre .exp-surtitre', { hasText: 'coffre' }).count()) > 0
      await unePhoto(coffre ? '8-coffre' : '5d-carte-a-prendre', true)
      await page.locator('.exp-a-prendre-carte, .exp-offre-ligne').first().click()
      await unePhoto(coffre ? '8-coffre-choisie' : '5e-carte-choisie', true)
      await page.locator('.exp-offre .exp-depart-pied .btn-primary').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'campement') {
      await unePhoto('6b-campement')
      // Le courage au plus haut, le campement propose d'office de retirer une carte : il en choisit une, parmi ses vraies cartes.
      if (await page.locator('.exp-camper .exp-rangee-carte').count()) {
        await page.locator('.exp-camper .exp-rangee-carte').first().click()
        await unePhoto('6c-campement-retirer')
      }
      if (await page.locator('.exp-a-retirer').count()) await page.locator('.exp-a-retirer .pill-btn').first().click()
      await page.locator('.exp-camper .exp-depart-pied .btn-primary').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'echoppe') {
      await unePhoto('8b-echoppe', true)
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
  await contexte.close()
} finally {
  await navigateur.close()
  await banc.close()
}
