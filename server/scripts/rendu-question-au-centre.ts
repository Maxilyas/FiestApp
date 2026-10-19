// La question au centre (la version 10 du départ, le 19 octobre 2026 — l'étape 2
// du plan, `retours/2026-10-19/la-question-au-centre.md`), photographiée au
// téléphone (360 × 640) sur un serveur jetable qui l'ouvre — le banc la ferme
// d'office. Un débutant au niveau 1, sans pari : son départ et ses trois
// styles, son codex de soixante-deux cartes, ses règles ; le plan et sa main
// de l'acte en petit, ses tas ; une rencontre qui s'ouvre sur sa question —
// les règles à la première, l'adversaire en crans et son attaque, la main sous
// la question —, une carte levée puis jouée, une bonne réponse qui lui fait
// perdre un cran, une erreur et l'attaque, l'adversaire qui tombe, sa carte à
// prendre ; puis le gardien, vaincu, et le plan de l'acte 2 — sa main rouverte.
// Une joueuse aguerrie ensuite, au niveau du pari : l'annonce et son pari, ce
// qu'il rapporte, la main éteinte jusqu'à la question. Ce qui élargit la page
// se dit (`[déborde]`). Le client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-question-au-centre.ts [dossier] [ivoire]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { CATEGORIES } from '../../shared/categories'
import { ecrireLeBilan } from '../../shared/codex'

const sortie = path.resolve(process.argv[2] ?? 'rendu-question-au-centre')
const ivoire = process.argv.includes('ivoire')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

// La question au centre, ouverte : le banc la ferme pour les épreuves d'avant elle.
const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }), questionAuCentre: true })
const navigateur = await chromium.launch({ headless: true })
try {
  const noe = await inscrireProfil(banc.url, 'noe', 'Noé', '🐢')
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  for (const c of [noe, lea]) if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, c, 'PUT')
  // Léa a déjà joué : une expédition partie et abandonnée, sa renommée portée au niveau 6 — le pari, les fioles, les talismans.
  {
    const partie = (await (await ecrire(banc.url, '/api/expedition', { rencontres: true, questionAuCentre: true }, lea)).json()) as { id: string }
    await ecrire(banc.url, `/api/expedition/${partie.id}/abandon`, {}, lea)
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      base.prepare('UPDATE campagne_series SET bilan = ? WHERE id = ?').run(ecrireLeBilan({ escales: 120, adversaires: 46, elites: 12, gardiens: 9, auBout: true, exploits: [] }), partie.id)
    } finally {
      base.close()
    }
  }

  for (const [qui, cookie, prefixe] of [
    ['Noé', noe, 'a'],
    ['Léa', lea, 'b'],
  ] as const) {
    const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
    const [nom, valeur] = cookie.split('=')
    await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error(`[page] ${qui} :`, e.message))
    const fait = new Set<string>()
    const photo = async (nomFichier: string, pleine = false) => {
      if (fait.has(nomFichier)) return
      fait.add(nomFichier)
      await page.waitForTimeout(450)
      await page.screenshot({ path: path.join(sortie, `${prefixe}-${nomFichier}.png`), fullPage: pleine })
      console.log(path.join(sortie, `${prefixe}-${nomFichier}.png`))
    }
    /** Ce qui déborde de côté : rien ne doit élargir la page (règle `css.md`). */
    const largeur = async (ou: string) => {
      const l = Number(await page.evaluate('document.documentElement.scrollWidth'))
      if (l > 360) console.error(`[déborde] ${qui}, ${ou} : ${l} pixels de large`)
    }
    const ici = async (): Promise<string> => {
      if (await page.locator('.exp-plan').count()) return 'carte'
      if (await page.locator('.exp-rencontre').count()) return 'annonce'
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
    /** Répond à la question à l'écran : juste, ou une autre qui n'est pas effacée. */
    const repondre = async (juste: boolean) => {
      await page.waitForSelector('.ans-btn')
      // La Prédiction de l'Oracle, jouée : la réponse touchée se montre d'abord à lui, et il dit ce qu'il en pense.
      if ((await page.locator('.exp-consigne', { hasText: 'montrer à l’Oracle' }).count()) > 0) {
        await page.locator('.ans-btn:not(.exp-effacee)').first().click()
        await page.locator('.exp-indice', { hasText: 'L’Oracle' }).waitFor()
        await photo('4e-oracle')
      }
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

    await page.goto(`${banc.url}/expedition`)
    await page.waitForSelector('.exp-depart-pied')
    await largeur('le départ')
    await photo('1-depart')
    await photo('1-depart-entier', true)
    if (await page.locator('.exp-style').count()) {
      await page.locator('.exp-style').scrollIntoViewIfNeeded()
      await photo('1b-style')
    }
    await page.locator('.exp-codex-du-depart .exp-ouvrir').click()
    await page.waitForSelector('.feuille-codex')
    await largeur('le codex')
    await photo('1c-codex')
    await page.locator('.feuille-codex .carte-fermer').click()
    await page.locator('.exp-haut-du-depart .exp-regles').click()
    await page.waitForSelector('.feuille-regles')
    await photo('1d-regles')
    await page.locator('#exp-regles-cartes').scrollIntoViewIfNeeded()
    await photo('1d-regles-cartes')
    await page.locator('.feuille-regles .carte-fermer').click()
    await page.click('.exp-depart-pied .btn-primary')
    await page.waitForSelector('.exp-plan')
    await largeur('le plan')
    await photo('2-plan')
    await page.locator('.exp-panneau .exp-pioche').click()
    await page.waitForSelector('.feuille-paquet')
    await photo('2b-tas')
    await page.locator('.feuille-paquet .carte-fermer').click()

    let questions = 0
    let rencontres = 0
    // Noé va jusqu'au gardien vaincu et au plan de l'acte 2 — sa main rouverte —, Léa ne joue que deux rencontres.
    const encore = () => (prefixe === 'a' ? !fait.has('7c-acte-2') : rencontres < 2)
    for (let tour = 0; tour < 300 && encore(); tour++) {
      const ou = await ici()
      if (ou === 'carte') {
        if (fait.has('7-gardien-vaincu')) {
          await largeur('le plan de l’acte 2')
          await photo('7c-acte-2')
          continue
        }
        if (await page.locator('.exp-panneau-titre').count()) await photo('6-avant-le-gardien')
        const adversaire = page.locator('.exp-carte-escale.exp-question, .exp-carte-escale.exp-elite').first()
        await ((await adversaire.count()) ? adversaire : page.locator('.exp-carte-escale').first()).click()
        await page.locator('.exp-panneau > .btn-primary').click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'annonce') {
        if (await page.locator('.feuille-regles').count()) {
          await photo('3-regles')
          await page.locator('.feuille-regles .carte-pied .btn-primary').click()
          await page.waitForTimeout(250)
        }
        await largeur('l’annonce')
        await photo('3-annonce')
        // Une carte du pari, s'il en a : levée, puis jouée.
        const pari = page.locator('.exp-cartes .exp-face:not(.exp-face-eteinte)').first()
        if (await pari.count()) {
          await pari.click()
          await page.waitForSelector('.exp-leve')
          await photo('3b-carte-du-pari')
          await page.locator('.exp-leve .btn-primary').click()
          await page.waitForTimeout(350)
        }
        const dix = page.locator('.exp-mise:not(.exp-refuse)', { hasText: '10' })
        if (await dix.count()) {
          await dix.first().click()
          await photo('3c-pari')
        }
        await page.locator('.exp-voir').click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'question') {
        if (await page.locator('.feuille-regles').count()) {
          await photo('4-regles-a-la-question')
          await page.locator('.feuille-regles .carte-pied .btn-primary').click()
          await page.waitForTimeout(250)
        }
        await largeur('la question')
        const auGardien = (await page.locator('.exp-adversaire-gardien').count()) > 0
        await photo(auGardien ? '7a-gardien' : questions === 0 ? '4-question' : '4-question-suivante')
        await photo('4-question-entiere', true)
        // Une carte de sa main : levée — ce qu'elle fait, ce qu'elle changerait —, puis jouée ; les autres s'éteignent.
        const carte = page.locator('.exp-cartes .exp-face:not(.exp-face-eteinte)').first()
        if (questions % 2 === 0 && (await carte.count())) {
          await carte.click()
          await page.waitForSelector('.exp-leve')
          await page.waitForTimeout(300)
          await photo(questions === 0 ? '4b-carte-levee' : '4b-carte-levee-suivante')
          await page.locator('.exp-leve .btn-primary').click()
          await page.waitForTimeout(400)
          if (await page.locator('.exp-visages').count()) await page.locator('.exp-visages .pill-btn').first().click()
          await photo(questions === 0 ? '4c-carte-jouee' : '4c-carte-jouee-suivante', true)
          // Une deuxième carte, levée : une carte par question, elle le dit.
          const autre = page.locator('.exp-cartes .exp-face.exp-face-eteinte').first()
          if (!fait.has('4d-une-par-question') && (await autre.count())) {
            await autre.click()
            await page.waitForSelector('.exp-leve')
            await photo('4d-une-par-question')
            await page.locator('.exp-leve .exp-reposer').click()
          }
        }
        questions++
        await repondre(questions % 4 !== 2)
        continue
      }
      if (ou === 'revelation') {
        const juste = (await page.locator('.result-banner.result-ok').count()) > 0
        const tombe = (await page.locator('.exp-adversaire-tombe').count()) > 0
        if (tombe) rencontres++
        const duGardien = (await page.locator('.exp-adversaire-gardien').count()) > 0
        await photo(duGardien ? (tombe ? '7b-gardien-tombe' : juste ? '7b-gardien-juste' : '7b-gardien-faux') : tombe ? '5c-il-tombe' : juste ? '5-juste' : '5b-faux', true)
        await page.locator('.result-banner ~ .btn-primary.btn-big').click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'offre') {
        await photo('5d-carte-a-prendre', true)
        await page.locator('.exp-a-prendre-carte, .exp-offre-ligne').first().click()
        await page.locator('.exp-offre .exp-depart-pied .btn-primary').click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'campement') {
        await photo('6b-campement')
        const repos = page.locator('.exp-camper .exp-choix-ligne', { hasText: 'Te reposer' })
        if (await repos.count()) await repos.click()
        await page.locator('.exp-camper .exp-depart-pied .btn-primary').click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'echoppe') {
        await photo('8-echoppe', true)
        await page.locator('.exp-echoppe-page .btn-ghost').click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'inconnu' || ou === 'vaincu') {
        await photo(ou === 'vaincu' ? '7-gardien-vaincu' : '8b-inconnu')
        await page.locator('.btn-primary.btn-big').last().click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'fin' || ou === 'choix') {
        await photo('9-fin', true)
        break
      }
      console.error(`[rendu] ${qui} : écran inconnu au tour ${tour}`)
      break
    }
    await contexte.close()
  }
} finally {
  await navigateur.close()
  await banc.close()
}
